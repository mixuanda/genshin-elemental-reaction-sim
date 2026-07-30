import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  canonicalStringify,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  EC_NEXT_TARGET_TICK_ENGINE_VERSION,
  EC_NEXT_TARGET_TICK_SCHEMA_VERSION,
  electroChargedCleanupResultReferencesSchema,
  targetPhaseV2ResultReferencesSchema,
  type FrameHitDefinition,
  type SimConfig,
  type SimulationResult
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

type CleanupGoldenScenarioId =
  | "hydroDepletedCleanupF1"
  | "hydroDepletedHitlag5F6";

const UPDATE_FLAG =
  "UPDATE_EC_QUICKEN_CLEANUP_V140_GOLDEN";
const CLEANUP_GOLDEN_SCENARIO_IDS: CleanupGoldenScenarioId[] =
  [
    "hydroDepletedCleanupF1",
    "hydroDepletedHitlag5F6"
  ];
const FIXTURE_URL = new URL(
  "../../../test-vectors/fixtures/electro-charged-quicken-cleanup-1.40.golden.json",
  import.meta.url
);
const SAME_TARGET_GEOMETRY = {
  kind: "circle" as const,
  coordinateSpace: "world" as const,
  origin: { x: 0, y: 0 },
  radius: 1
};

function applicationHit({
  id,
  element,
  gaugeUnits,
  hitlagFrames
}: {
  id: string;
  element: NonNullable<FrameHitDefinition["element"]>;
  gaugeUnits: number;
  hitlagFrames?: number;
}): FrameHitDefinition {
  return {
    id,
    label: id,
    frame: 0,
    scaling: 0,
    element,
    geometry: SAME_TARGET_GEOMETRY,
    application: {
      gaugeUnits,
      icdTag: id,
      icdGroup: "no-icd"
    },
    ...(hitlagFrames === undefined
      ? {}
      : {
          targetHitlag: {
            haltFrames: hitlagFrames,
            factor: 0
          }
        })
  };
}

function makeCleanupGoldenConfig(
  hitlagFrames?: number
): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    dataVersion: "ec-quicken-cleanup-provisional-1",
    randomSeed:
      hitlagFrames === undefined
        ? "ec-quicken-cleanup-aura-v8-1-0-90"
        : `ec-quicken-cleanup-aura-v8-1-${hitlagFrames}-90`,
    meta: {
      name: "EC cleanup after Quicken to Bloom Golden",
      version: "1.40.0",
      verificationStatus: "provisional",
      note:
        "Fixed-gcsim-provisional regression vector only; this is not official game data or a claim of complete gcsim parity."
    },
    duration: 1.5,
    cycleLength: 1.5,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Hydro Electro target",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            { element: "hydro", gaugeUnits: 1 },
            { element: "electro", gaugeUnits: 1 }
          ]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "driver",
        name: "Reaction driver",
        element: "dendro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v8" },
    targetClockModel:
      hitlagFrames === undefined
        ? { mode: "disabled" }
        : { mode: "target-local-hitlag-v1" },
    targetTaskModel: { mode: "target-phase-v2" },
    reactionDeliveryModel: {
      mode: "deferred-event-heap-v1"
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "driver",
      swapFrames: 1,
      abilities: [
        {
          id: "compound-chain",
          actorId: "driver",
          name: "Compound reaction chain",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            applicationHit({
              id: "dendro-quicken",
              element: "dendro",
              gaugeUnits: 0.8
            }),
            applicationHit({
              id: "electro-stream",
              element: "electro",
              gaugeUnits: 0.8,
              ...(hitlagFrames === undefined
                ? {}
                : { hitlagFrames })
            })
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "driver",
          abilityId: "compound-chain",
          atFrame: 0
        }
      ]
    }
  };
}

function projectCleanupScenario(result: SimulationResult) {
  return {
    version: {
      schemaVersion: result.schemaVersion,
      engineVersion: result.engineVersion,
      dataVersion: result.dataVersion,
      randomSeed: result.randomSeed,
      configHash: result.runManifest.configHash,
      reproducibilityKey: result.reproducibilityKey,
      resolvedRuntimeOptions:
        result.resolvedRuntimeOptions,
      reactionEngineMode:
        result.config.reactionEngine?.mode ?? null,
      targetClockModelMode:
        result.config.targetClockModel.mode,
      targetTaskModelMode:
        result.config.targetTaskModel.mode,
      reactionDeliveryModelMode:
        result.config.reactionDeliveryModel.mode,
      timelineMode: result.config.timeline?.mode ?? null,
      fps: result.config.timeline?.fps ?? null
    },
    reactionTasks: result.reactionTaskLog,
    cleanupTargetPhases: result.targetPhaseLog.filter(
      (phase) =>
        phase.reactableTick.transitions.some(
          (transition) =>
            transition.kind === "electro-charged-cleanup"
        )
    ),
    periodicElectroCharged: result.periodicReactionLog.filter(
      (entry) => entry.reaction === "electroCharged"
    ),
    reactionDamageLog: result.reactionDamageLog,
    damageEvents: result.damageEvents,
    cleanupTimelinePoints:
      result.targetStateTimeline.points.filter(
        (point) =>
          point.cause === "electro-charged-cleanup"
      ),
    electroChargedDamageEvents: result.damageEvents
      .filter(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.reaction === "electroCharged"
      )
      .map((event) => ({
        id: event.id,
        frame: event.frame,
        eventPriority: event.eventPriority,
        eventSequence: event.eventSequence,
        targetId: event.targetId,
        sourceActorId: event.sourceActorId,
        creditOwnerId: event.creditOwnerId,
        reaction: event.reaction,
        reactionAudit: event.reactionAudit,
        finalDamage: event.finalDamage,
        displayDamage: event.displayDamage
      })),
    dendroCoreLog: result.dendroCoreLog,
    targetClockLog: result.targetClockLog,
    targetHitlagLog: result.targetHitlagLog,
    auraEndStates: result.auraEndStates,
    totalDamage: result.totalDamage,
    damageEventCount: result.damageEvents.length,
    reactedHits: result.reactedHits
  };
}

type CleanupGoldenScenario = ReturnType<
  typeof projectCleanupScenario
>;

interface CleanupGoldenFixture {
  fixtureVersion: "electro-charged-quicken-cleanup-1.40";
  description: string;
  provenance: {
    referenceProject: "genshinsim/gcsim";
    mechanicsDataStatus: "fixed-gcsim-provisional";
    referenceCommit: string;
    capturedAt: string;
    notes: string[];
  };
  commonConfig: {
    schemaVersion: typeof EC_NEXT_TARGET_TICK_SCHEMA_VERSION;
    engineVersion: typeof EC_NEXT_TARGET_TICK_ENGINE_VERSION;
    reactionEngine: { mode: "aura-v8" };
    targetTaskModel: { mode: "target-phase-v2" };
    reactionDeliveryModel: {
      mode: "deferred-event-heap-v1";
    };
    timeline: { mode: "legal-frame-v1"; fps: 60 };
  };
  scenarios: Record<
    CleanupGoldenScenarioId,
    CleanupGoldenScenario
  >;
  hashes: Record<CleanupGoldenScenarioId, string>;
}

function semanticHash(value: unknown): string {
  return createHash("sha256")
    .update(canonicalStringify(value))
    .digest("hex");
}

function loadFrozenFixture(): CleanupGoldenFixture {
  if (process.env[UPDATE_FLAG] === "1") {
    throw new Error(
      "electro-charged-quicken-cleanup-1.40.golden.json is frozen; create a new versioned fixture instead."
    );
  }
  return JSON.parse(
    readFileSync(FIXTURE_URL, "utf8")
  ) as CleanupGoldenFixture;
}

function projectV140CompatibilitySemantics(
  scenario: CleanupGoldenScenario
) {
  const {
    schemaVersion: _schemaVersion,
    engineVersion: _engineVersion,
    configHash: _configHash,
    reproducibilityKey: _reproducibilityKey,
    ...compatibleVersion
  } = scenario.version;
  return {
    ...scenario,
    version: compatibleVersion
  };
}

describe("aura-v8 Electro-Charged cleanup Golden", () => {
  it("keeps current identity separate while matching the frozen 1.40 F1 and Hitlag5-to-F6 semantics", () => {
    const scenarioRuns: Array<{
      id: CleanupGoldenScenarioId;
      hitlagFrames?: number;
      expectedCleanupGlobalFrame: number;
    }> = [
      {
        id: "hydroDepletedCleanupF1",
        expectedCleanupGlobalFrame: 1
      },
      {
        id: "hydroDepletedHitlag5F6",
        hitlagFrames: 5,
        expectedCleanupGlobalFrame: 6
      }
    ];
    const scenarioMap = new Map<
      CleanupGoldenScenarioId,
      CleanupGoldenScenario
    >();
    for (const scenarioRun of scenarioRuns) {
      if (scenarioMap.has(scenarioRun.id)) {
        throw new Error(
          `Refusing duplicate cleanup Golden scenario ${scenarioRun.id}.`
        );
      }
      const config = makeCleanupGoldenConfig(
        scenarioRun.hitlagFrames
      );
      const first = simulate(config, {
        critMode: "noCrit"
      });
      const repeated = simulate(config, {
        critMode: "noCrit"
      });
      expect(
        electroChargedCleanupResultReferencesSchema.parse(first)
      ).toEqual(first);
      expect(
        electroChargedCleanupResultReferencesSchema.parse(
          repeated
        )
      ).toEqual(repeated);
      expect(
        targetPhaseV2ResultReferencesSchema.parse(first)
      ).toEqual(first);
      expect(
        targetPhaseV2ResultReferencesSchema.parse(repeated)
      ).toEqual(repeated);
      expect(canonicalStringify(repeated)).toBe(
        canonicalStringify(first)
      );
      expect(first.schemaVersion).toBe(
        CURRENT_SCHEMA_VERSION
      );
      expect(first.engineVersion).toBe(
        CURRENT_ENGINE_VERSION
      );
      expect(
        first.reactionTaskLog[0]?.electroChargedCleanup
      ).toMatchObject({
        outcome: "stop",
        deadlineTargetFrame: 1,
        resolvedGlobalFrame:
          scenarioRun.expectedCleanupGlobalFrame,
        resolvedTargetFrame: 1
      });
      scenarioMap.set(
        scenarioRun.id,
        projectCleanupScenario(first)
      );
    }
    expect([...scenarioMap.keys()].sort()).toEqual(
      [...CLEANUP_GOLDEN_SCENARIO_IDS].sort()
    );
    const scenarios = Object.fromEntries(
      scenarioMap
    ) as Record<
      CleanupGoldenScenarioId,
      CleanupGoldenScenario
    >;
    const fixture = loadFrozenFixture();
    expect(fixture.commonConfig).toEqual({
      schemaVersion: EC_NEXT_TARGET_TICK_SCHEMA_VERSION,
      engineVersion: EC_NEXT_TARGET_TICK_ENGINE_VERSION,
      reactionEngine: { mode: "aura-v8" },
      targetTaskModel: { mode: "target-phase-v2" },
      reactionDeliveryModel: {
        mode: "deferred-event-heap-v1"
      },
      timeline: { mode: "legal-frame-v1", fps: 60 }
    });
    for (const scenarioId of Object.keys(
      scenarios
    ) as CleanupGoldenScenarioId[]) {
      expect(
        projectV140CompatibilitySemantics(
          scenarios[scenarioId]
        )
      ).toEqual(
        projectV140CompatibilitySemantics(
          fixture.scenarios[scenarioId]
        )
      );
      expect(semanticHash(fixture.scenarios[scenarioId])).toBe(
        fixture.hashes[scenarioId]
      );
    }

    const f1 =
      fixture.scenarios.hydroDepletedCleanupF1;
    const f6 =
      fixture.scenarios.hydroDepletedHitlag5F6;
    expect(
      f1.reactionTasks[0]?.electroChargedCleanup
    ).toMatchObject({
      outcome: "stop",
      deadlineTargetFrame: 1,
      resolvedGlobalFrame: 1,
      resolvedTargetFrame: 1
    });
    expect(
      f6.reactionTasks[0]?.electroChargedCleanup
    ).toMatchObject({
      outcome: "stop",
      deadlineTargetFrame: 1,
      resolvedGlobalFrame: 6,
      resolvedTargetFrame: 1
    });
    expect(
      f1.electroChargedDamageEvents.map(
        (event) => event.frame
      )
    ).toEqual([10]);
    expect(
      f6.electroChargedDamageEvents.map(
        (event) => event.frame
      )
    ).toEqual([10]);
    expect(f1.targetHitlagLog).toEqual([]);
    expect(
      f6.targetHitlagLog.map(
        ({ globalFrame, extensionFrames }) => ({
          globalFrame,
          extensionFrames
        })
      )
    ).toEqual([{ globalFrame: 0, extensionFrames: 5 }]);
  });
});
