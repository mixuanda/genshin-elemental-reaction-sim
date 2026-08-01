import { createHash } from "node:crypto";
import {
  linkSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { fileURLToPath } from "node:url";
import {
  canonicalStringify,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  EC_SECONDARY_WET_PROPAGATION_ENGINE_VERSION,
  EC_SECONDARY_WET_PROPAGATION_SCHEMA_VERSION,
  LEGACY_SIMULATION_RUN_MANIFEST_VERSION,
  assertTrustedSimulationResultV145,
  reactionDeliveryResultReferencesSchema,
  simulationResultV145Schema,
  targetPhaseV2ResultReferencesSchema,
  type SimConfig,
  type SimulationResult
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const UPDATE_FLAG =
  "UPDATE_EC_PROPAGATION_V141_GOLDEN";
const EXPECTED_SCENARIO_SHA256 =
  "b00a4a02e859e7744660fb71ed859763a67b0cb08dfb8cc8146e46f409d6e92c";
const FIXTURE_URL = new URL(
  "../../../test-vectors/fixtures/electro-charged-propagation-1.41.golden.json",
  import.meta.url
);
const SOURCE_TARGET_ID = "enemy-0";
const EXPECTED_CANDIDATE_OUTCOMES = [
  {
    targetId: SOURCE_TARGET_ID,
    selected: true,
    reason: "SOURCE_STREAM_TARGET"
  },
  {
    targetId: "wet-boundary",
    selected: true,
    reason: "NEARBY_WET_IN_RANGE"
  },
  {
    targetId: "dry-nearby",
    selected: false,
    reason: "NO_HYDRO_AURA"
  },
  {
    targetId: "wet-outside",
    selected: false,
    reason: "OUT_OF_RANGE"
  },
  {
    targetId: "wet-unresolved",
    selected: false,
    reason: "POSITION_UNRESOLVED"
  },
  {
    targetId: "wet-immune",
    selected: true,
    reason: "NEARBY_WET_IN_RANGE"
  }
] as const;

function makePropagationGoldenConfig(): SimConfig {
  const base = makeConfig();
  const template = base.characters[0]!;
  return makeConfig({
    dataVersion: "ec-propagation-community-provisional-1",
    randomSeed: "ec-propagation-v141-golden-seed",
    meta: {
      name: "Electro-Charged propagation Golden",
      version: "1.41.0",
      verificationStatus: "provisional",
      note:
        "Community-provisional regression vector. Nearby-Wet selection is not implemented by the pinned gcsim reference and is not official game data."
    },
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: SOURCE_TARGET_ID,
          name: "Source",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          resistance: 0.1,
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        },
        {
          id: "wet-boundary",
          name: "Wet boundary",
          position: { x: 3.5, y: 0 },
          hitboxRadius: 0.5,
          resistance: 0.5,
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        },
        {
          id: "dry-nearby",
          name: "Dry nearby",
          position: { x: 1, y: 0 },
          hitboxRadius: 0
        },
        {
          id: "wet-outside",
          name: "Wet outside",
          position: { x: 3.51, y: 0 },
          hitboxRadius: 0.5,
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        },
        {
          id: "wet-unresolved",
          name: "Wet unresolved",
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        },
        {
          id: "wet-immune",
          name: "Wet immune",
          position: { x: 2, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        }
      ],
      targetPhases: [
        {
          id: "immune-at-first-tick",
          label: "Immune at first tick",
          targetId: "wet-immune",
          startFrame: 10,
          endFrame: 11,
          reason: "TEST_EC_IMMUNE",
          effects: {
            damage: "immune",
            aura: "normal",
            hitConfirm: "normal"
          }
        }
      ]
    },
    characters: [
      {
        ...template,
        id: "ec-owner",
        name: "EC Owner",
        element: "electro",
        level: 90,
        stats: {
          ...neutralStats,
          em: 120,
          reactionBonus: 0.2
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v8" },
    targetTaskModel: { mode: "target-phase-v2" },
    reactionDeliveryModel: {
      mode: "deferred-event-heap-v1"
    },
    electroChargedPropagationModel: {
      mode: "nearby-wet-radius-v1",
      radius: 3,
      verificationStatus: "provisional"
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "ec-owner",
      swapFrames: 1,
      abilities: [
        {
          id: "start-ec",
          actorId: "ec-owner",
          name: "Start EC",
          kind: "skill",
          cancelFrame: 11,
          animationEndFrame: 11,
          cooldownFrames: 0,
          hits: [
            {
              id: "start-source-with-unresolved-candidate",
              label: "Start source with unresolved candidate",
              frame: 0,
              scaling: 1,
              element: "electro",
              targeting: {
                targetId: SOURCE_TARGET_ID,
                outcome: "landed"
              },
              application: {
                gaugeUnits: 1,
                icdTag:
                  "start-source-with-unresolved-candidate",
                icdGroup: "no-icd"
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "ec-owner",
          abilityId: "start-ec"
        }
      ]
    }
  });
}

function projectPropagationScenario(
  result: SimulationResult
) {
  const reactionDamage = result.reactionDamageLog.filter(
    (entry) =>
      entry.reaction === "electroCharged" &&
      entry.withinSimulation
  );
  const reactionDamageIds = new Set(
    reactionDamage.map((entry) => entry.id)
  );
  const propagationDamageEventIds = new Set(
    reactionDamage.flatMap((entry) => entry.damageEventIds)
  );
  const triggerDamageEventIds = new Set(
    reactionDamage.flatMap((entry) =>
      entry.triggerDamageEventId === null
        ? []
        : [entry.triggerDamageEventId]
    )
  );
  const relevantDamageEventIds = new Set([
    ...triggerDamageEventIds,
    ...propagationDamageEventIds
  ]);
  const relevantHitResolutionIds = new Set(
    reactionDamage.flatMap(
      (entry) =>
        entry.electroChargedPropagation?.candidates.flatMap(
          (candidate) =>
            candidate.hitResolutionLogId === null
              ? []
              : [candidate.hitResolutionLogId]
        ) ?? []
    )
  );
  const candidateAuraWitnesses =
    result.targetStateTimeline.points.filter((point) =>
      point.cause ===
        "electro-charged-propagation-candidate" &&
      point.links.some(
        (link) =>
          link.kind === "reaction-damage-log" &&
          reactionDamageIds.has(link.id)
      )
    );
  const propagationDamageApplicationPoints =
    result.targetStateTimeline.points.filter(
      (point) =>
        point.cause === "reaction-damage-application" &&
        point.links.some(
          (link) =>
            (link.kind === "reaction-damage-log" &&
              reactionDamageIds.has(link.id)) ||
            (link.kind === "damage-event" &&
              propagationDamageEventIds.has(link.id))
        )
    );

  return {
    identity: {
      schemaVersion: result.schemaVersion,
      engineVersion: result.engineVersion,
      dataVersion: result.dataVersion,
      randomSeed: result.randomSeed,
      configHash: result.runManifest.configHash,
      reproducibilityKey: result.reproducibilityKey,
      resolvedRuntimeOptions:
        result.resolvedRuntimeOptions
    },
    configContract: {
      reactionEngine: result.config.reactionEngine,
      targetClockModel: result.config.targetClockModel,
      targetTaskModel: result.config.targetTaskModel,
      reactionDeliveryModel:
        result.config.reactionDeliveryModel,
      electroChargedPropagationModel:
        result.config.electroChargedPropagationModel,
      timeline: {
        mode: result.config.timeline?.mode ?? null,
        fps: result.config.timeline?.fps ?? null
      },
      enemyTargets: result.enemyTargets
    },
    periodicElectroCharged:
      result.periodicReactionLog.filter(
        (entry) => entry.reaction === "electroCharged"
      ),
    reactionDamage,
    reactionBDecisions: reactionDamage.flatMap(
      (entry) => entry.damageGroupDecisions
    ),
    triggerDamageEvents: result.damageEvents.filter((event) =>
      triggerDamageEventIds.has(event.id)
    ),
    propagationDamageChildren: result.damageEvents.filter(
      (event) => propagationDamageEventIds.has(event.id)
    ),
    relevantHitResolutions:
      result.hitResolutionLog.filter(
        (entry) =>
          relevantHitResolutionIds.has(entry.id) ||
          (entry.damageEventId !== null &&
            relevantDamageEventIds.has(entry.damageEventId))
      ),
    allRelatedDamageEvents: result.damageEvents.filter((event) =>
      relevantDamageEventIds.has(event.id)
    ),
    targetStateTimeline: result.targetStateTimeline,
    candidateAuraWitnesses,
    propagationDamageApplicationPoints,
    auraInitialStates: result.auraInitialStates,
    auraEndStates: result.auraEndStates,
    totals: {
      totalDamage: result.totalDamage,
      dps: result.dps,
      damageEventCount: result.damageEvents.length,
      reactedHits: result.reactedHits,
      skippedActionCount: result.skippedActions.length
    }
  };
}

type PropagationGoldenScenario = ReturnType<
  typeof projectPropagationScenario
>;

type FrozenV141PropagationGoldenScenario = Omit<
  PropagationGoldenScenario,
  "identity"
> & {
  identity: Omit<
    PropagationGoldenScenario["identity"],
    "schemaVersion" | "engineVersion"
  > & {
    schemaVersion: typeof EC_SECONDARY_WET_PROPAGATION_SCHEMA_VERSION;
    engineVersion: typeof EC_SECONDARY_WET_PROPAGATION_ENGINE_VERSION;
  };
};

function normalizeIdentityForFrozenV141(
  scenario: PropagationGoldenScenario,
  result: SimulationResult
): FrozenV141PropagationGoldenScenario {
  const {
    reactionFormulaModel: _reactionFormulaModel,
    ...frozenConfigCommon
  } = result.config;
  const frozenConfigHash = createSimulationConfigHash({
    ...frozenConfigCommon,
    schemaVersion:
      EC_SECONDARY_WET_PROPAGATION_SCHEMA_VERSION,
    engineVersion:
      EC_SECONDARY_WET_PROPAGATION_ENGINE_VERSION
  });
  const frozenRunIdentity = {
    version: LEGACY_SIMULATION_RUN_MANIFEST_VERSION,
    identityAlgorithm:
      result.runManifest.identityAlgorithm,
    schemaVersion:
      EC_SECONDARY_WET_PROPAGATION_SCHEMA_VERSION,
    engineVersion:
      EC_SECONDARY_WET_PROPAGATION_ENGINE_VERSION,
    dataVersion: result.dataVersion,
    configHash: frozenConfigHash,
    resolvedRuntimeOptions:
      result.resolvedRuntimeOptions,
    plugins: result.runManifest.plugins
  } as unknown as Parameters<
    typeof createSimulationReproducibilityKey
  >[0];

  return {
    ...scenario,
    identity: {
      ...scenario.identity,
      schemaVersion:
        EC_SECONDARY_WET_PROPAGATION_SCHEMA_VERSION,
      engineVersion:
        EC_SECONDARY_WET_PROPAGATION_ENGINE_VERSION,
      configHash: frozenConfigHash,
      reproducibilityKey:
        createSimulationReproducibilityKey(
          frozenRunIdentity
        )
    }
  };
}

interface PropagationGoldenFixture {
  fixtureVersion: "electro-charged-propagation-1.41";
  description: string;
  provenance: {
    referenceProject: "genshinsim/gcsim";
    referenceCommit: string;
    mechanicsDataStatus: "community-provisional";
    capturedAt: string;
    notes: string[];
  };
  scenario: FrozenV141PropagationGoldenScenario;
  scenarioSha256: string;
}

function semanticHash(value: unknown): string {
  return createHash("sha256")
    .update(canonicalStringify(value))
    .digest("hex");
}

function atomicCreateJsonFixture(
  outputUrl: URL,
  value: unknown
): void {
  const outputPath = fileURLToPath(outputUrl);
  const temporaryPath =
    `${outputPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(
    temporaryPath,
    `${JSON.stringify(value, null, 2)}\n`,
    { flag: "wx" }
  );
  try {
    linkSync(temporaryPath, outputPath);
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      throw new Error(
        `Refusing to overwrite frozen fixture ${outputPath}.`
      );
    }
    throw error;
  } finally {
    unlinkSync(temporaryPath);
  }
}

function loadOrCreateFixture(
  generatedFixture: PropagationGoldenFixture
): PropagationGoldenFixture {
  if (process.env[UPDATE_FLAG] === "1") {
    atomicCreateJsonFixture(FIXTURE_URL, generatedFixture);
    return generatedFixture;
  }
  return JSON.parse(
    readFileSync(FIXTURE_URL, "utf8")
  ) as PropagationGoldenFixture;
}

describe("Electro-Charged nearby-Wet propagation Golden", () => {
  it("freezes the complete deterministic P5 fanout and source-only Aura lifecycle", () => {
    const config = makePropagationGoldenConfig();
    const first = simulate(config, { critMode: "noCrit" });
    const repeated = simulate(config, { critMode: "noCrit" });

    expect(simulationResultV145Schema.parse(first)).toEqual(
      first
    );
    expect(simulationResultV145Schema.parse(repeated)).toEqual(
      repeated
    );
    expect(assertTrustedSimulationResultV145(first)).toBe(first);
    expect(assertTrustedSimulationResultV145(repeated)).toBe(
      repeated
    );
    expect(
      reactionDeliveryResultReferencesSchema.parse(first)
    ).toEqual(first);
    expect(
      reactionDeliveryResultReferencesSchema.parse(repeated)
    ).toEqual(repeated);
    expect(
      targetPhaseV2ResultReferencesSchema.parse(first)
    ).toEqual(first);
    expect(
      targetPhaseV2ResultReferencesSchema.parse(repeated)
    ).toEqual(repeated);
    expect(repeated).toEqual(first);
    expect(first.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(first.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );

    const firstProjection =
      normalizeIdentityForFrozenV141(
        projectPropagationScenario(first),
        first
      );
    const repeatedProjection =
      normalizeIdentityForFrozenV141(
        projectPropagationScenario(repeated),
        repeated
      );
    expect(repeatedProjection).toEqual(firstProjection);

    const generatedFixture: PropagationGoldenFixture = {
      fixtureVersion:
        "electro-charged-propagation-1.41",
      description:
        "Deterministic 1.41 runtime vector for source, in-range Wet, dry, out-of-range Wet, unresolved Wet, and immune Wet Electro-Charged propagation candidates.",
      provenance: {
        referenceProject: "genshinsim/gcsim",
        referenceCommit:
          "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
        mechanicsDataStatus: "community-provisional",
        capturedAt: "2026-07-29",
        notes: [
          "The pinned gcsim reference remains single-target and does not implement nearby-Wet propagation.",
          "The radius, all-target registration-order selection, secondary ownership, and source-only Wane rules are community-provisional and are not official game data.",
          "The secondary Electro-Charged damage applies no Aura, starts no periodic stream, and does not mutate an existing stream.",
          "This fixture is a regression contract, not a claim of complete gcsim or live-game parity."
        ]
      },
      scenario: firstProjection,
      scenarioSha256: semanticHash(firstProjection)
    };
    expect(generatedFixture.scenario.identity).toMatchObject({
      schemaVersion:
        EC_SECONDARY_WET_PROPAGATION_SCHEMA_VERSION,
      engineVersion:
        EC_SECONDARY_WET_PROPAGATION_ENGINE_VERSION,
      dataVersion:
        "ec-propagation-community-provisional-1",
      randomSeed: "ec-propagation-v141-golden-seed"
    });
    expect(
      generatedFixture.scenario.configContract
        .electroChargedPropagationModel
    ).toEqual({
      mode: "nearby-wet-radius-v1",
      radius: 3,
      verificationStatus: "provisional"
    });

    const reactionDamage =
      generatedFixture.scenario.reactionDamage[0]!;
    const audit =
      reactionDamage.electroChargedPropagation!;
    expect(reactionDamage).toMatchObject({
      damageFrame: 10,
      targetingMode:
        "electro-charged-nearby-wet",
      checkedTargetIds: [
        SOURCE_TARGET_ID,
        "wet-boundary",
        "wet-immune"
      ],
      hitTargetIds: [
        SOURCE_TARGET_ID,
        "wet-boundary",
        "wet-immune"
      ],
      unresolvedTargetIds: ["wet-unresolved"]
    });
    expect(audit).toMatchObject({
      model: "nearby-wet-radius-v1",
      verificationStatus: "provisional",
      mechanicsDataStatus: "community-provisional",
      generation: 1,
      tickIndex: 0,
      evaluationFrame: 10,
      eventPriority: 5,
      radius: 3,
      selectionMode:
        "all-in-range-registration-order-v1"
    });
    expect(
      audit.candidates.map(
        ({ targetId, selected, reason }) => ({
          targetId,
          selected,
          reason
        })
      )
    ).toEqual(EXPECTED_CANDIDATE_OUTCOMES);
    expect(
      generatedFixture.scenario.reactionBDecisions.map(
        ({
          reaction,
          targetId,
          damageAllowed,
          blockedReason
        }) => ({
          reaction,
          targetId,
          damageAllowed,
          blockedReason
        })
      )
    ).toEqual([
      {
        reaction: "electroCharged",
        targetId: SOURCE_TARGET_ID,
        damageAllowed: true,
        blockedReason: null
      },
      {
        reaction: "electroCharged",
        targetId: "wet-boundary",
        damageAllowed: true,
        blockedReason: null
      },
      {
        reaction: "electroCharged",
        targetId: "wet-immune",
        damageAllowed: true,
        blockedReason: null
      }
    ]);

    const children =
      generatedFixture.scenario.propagationDamageChildren;
    expect(children.map((event) => event.targetId)).toEqual([
      SOURCE_TARGET_ID,
      "wet-boundary",
      "wet-immune"
    ]);
    expect(
      new Set(
        children.map(
          (event) => event.parentDamageEventId
        )
      ).size
    ).toBe(1);
    expect(
      children.find(
        (event) => event.targetId === "wet-immune"
      )
    ).toMatchObject({
      targetDamagePolicy: "immune",
      finalDamage: 0
    });
    expect(
      generatedFixture.scenario.periodicElectroCharged.some(
        (entry) =>
          entry.targetId !== SOURCE_TARGET_ID
      )
    ).toBe(false);

    const candidateAuraWitnesses =
      generatedFixture.scenario.candidateAuraWitnesses;
    expect(
      candidateAuraWitnesses.map((point) => point.targetId)
    ).toEqual(
      EXPECTED_CANDIDATE_OUTCOMES.map(
        (candidate) => candidate.targetId
      )
    );
    for (const candidate of audit.candidates) {
      const witness = candidateAuraWitnesses.find(
        (point) =>
          point.id ===
          candidate.auraObservationTimelinePointId
      );
      expect(witness).toMatchObject({
        id: candidate.auraObservationTimelinePointId,
        frame: audit.evaluationFrame,
        targetId: candidate.targetId,
        targetName: candidate.targetName,
        pointKind: "observation",
        cause:
          "electro-charged-propagation-candidate",
        eventType: "reactionDamage",
        eventPriority: audit.eventPriority,
        eventSequence: audit.eventSequence,
        reaction: "electroCharged",
        reactions: ["electroCharged"],
        primaryDamageEventId: null,
        links: [
          {
            kind: "reaction-damage-log",
            id: reactionDamage.id
          }
        ],
        auraApplied: [],
        auraConsumed: []
      });
      expect(witness?.auraAfter).toEqual(
        witness?.auraBefore
      );
      expect(
        witness?.auraBefore.find(
          (entry) => entry.element === "hydro"
        )?.gaugeUnits ?? 0
      ).toBe(candidate.hydroGaugeUnits);
    }
    const witnessIntraEventSequences =
      candidateAuraWitnesses.map(
        (point) => point.intraEventSequence!
      );
    expect(witnessIntraEventSequences).toEqual(
      [...witnessIntraEventSequences].sort(
        (left, right) => left - right
      )
    );
    expect(
      new Set(witnessIntraEventSequences).size
    ).toBe(candidateAuraWitnesses.length);

    const secondaryDamageTimeline =
      generatedFixture.scenario.propagationDamageApplicationPoints.filter(
        (point) =>
          point.targetId !== SOURCE_TARGET_ID
      );
    expect(
      secondaryDamageTimeline.map(
        (point) => point.targetId
      )
    ).toEqual(["wet-boundary", "wet-immune"]);
    expect(
      secondaryDamageTimeline.every(
        (point) =>
          point.cause ===
            "reaction-damage-application" &&
          point.reaction === "electroCharged" &&
          point.reactions.includes("electroCharged") &&
          canonicalStringify(point.auraBefore) ===
            canonicalStringify(point.auraAfter) &&
          point.auraApplied.length === 0 &&
          point.auraConsumed.length === 0
      )
    ).toBe(true);
    for (const candidate of audit.candidates) {
      const damageApplication =
        generatedFixture.scenario.propagationDamageApplicationPoints.find(
          (point) => point.targetId === candidate.targetId
        );
      if (candidate.selected) {
        expect(damageApplication).toBeDefined();
        expect(
          candidate.auraObservationTimelinePointId
        ).toBeLessThan(damageApplication!.id);
      } else {
        expect(damageApplication).toBeUndefined();
      }
    }

    expect(generatedFixture.scenarioSha256).toBe(
      EXPECTED_SCENARIO_SHA256
    );
    const fixture = loadOrCreateFixture(generatedFixture);
    expect(fixture).toEqual(generatedFixture);
    expect(semanticHash(fixture.scenario)).toBe(
      fixture.scenarioSha256
    );
  });
});
