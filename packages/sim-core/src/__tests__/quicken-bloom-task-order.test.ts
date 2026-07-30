import { createHash } from "node:crypto";
import {
  canonicalStringify,
  EC_NEXT_TARGET_TICK_ENGINE_VERSION,
  EC_NEXT_TARGET_TICK_SCHEMA_VERSION,
  QUICKEN_BLOOM_TASK_ENGINE_VERSION,
  QUICKEN_BLOOM_TASK_SCHEMA_VERSION,
  SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION,
  SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
  TARGET_REACTABLE_PHASE_ENGINE_VERSION,
  TARGET_REACTABLE_PHASE_SCHEMA_VERSION,
  TARGET_TASK_PHASE_ENGINE_VERSION,
  TARGET_TASK_PHASE_SCHEMA_VERSION,
  type AuraReactionEngineConfig,
  type FrameHitDefinition,
  type SimConfig,
  type SimulationResult
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import taskOrderGoldenV136Json from "../../../test-vectors/fixtures/quicken-bloom-task-order-1.36.golden.json";
import taskOrderGoldenV137Json from "../../../test-vectors/fixtures/quicken-bloom-task-order-1.37.golden.json";
import taskOrderGoldenV138Json from "../../../test-vectors/fixtures/quicken-bloom-task-order-1.38.golden.json";
import taskOrderGoldenV139Json from "../../../test-vectors/fixtures/quicken-bloom-task-order-1.39.golden.json";
import taskOrderGoldenV140Json from "../../../test-vectors/fixtures/quicken-bloom-task-order-1.40.golden.json";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

type ReactionMode = Extract<
  AuraReactionEngineConfig["mode"],
  "aura-v6" | "aura-v7"
>;

const SAME_TARGET_GEOMETRY = {
  kind: "circle" as const,
  coordinateSpace: "world" as const,
  origin: { x: 0, y: 0 },
  radius: 1
};

function applicationHit(
  id: string,
  element: NonNullable<FrameHitDefinition["element"]>,
  gaugeUnits: number
): FrameHitDefinition {
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
    }
  };
}

function makeTaskOrderConfig(
  mode: ReactionMode,
  interveningHit?: FrameHitDefinition,
  targetTaskMode: SimConfig["targetTaskModel"]["mode"] =
    "legacy-event-heap-v1"
): SimConfig {
  const base = makeConfig();
  const hits = [
    applicationHit("dendro-quicken", "dendro", 0.8),
    ...(interveningHit === undefined
      ? []
      : [interveningHit]),
    applicationHit("electro-followup", "electro", 0.8)
  ];

  return {
    ...base,
    dataVersion: "quicken-bloom-task-order-provisional-1",
    randomSeed: `quicken-bloom-task-order-${mode}-${
      interveningHit?.id ?? "fifo"
    }`,
    meta: {
      name: "Quicken Bloom queued follow-up ordering",
      version: "1.36.0",
      verificationStatus: "provisional"
    },
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Hydro + Electro target",
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
    reactionEngine: { mode },
    targetTaskModel: { mode: targetTaskMode },
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
          id: "same-frame-chain",
          actorId: "driver",
          name: "Same-frame chain",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "driver",
          abilityId: "same-frame-chain",
          atFrame: 0
        }
      ]
    }
  };
}

function directHit(
  result: ReturnType<typeof simulate>,
  hitId: string
) {
  const event = result.damageEvents.find(
    (candidate) =>
      candidate.kind === "direct" &&
      candidate.hitId === hitId
  );
  expect(event, `missing direct event for ${hitId}`).toBeDefined();
  return event!;
}

function projectAura(
  aura: readonly {
    element: string;
    gaugeUnits: number;
    expiresAtFrame: number | null;
  }[]
) {
  return aura.map(
    ({ element, gaugeUnits, expiresAtFrame }) =>
      `${element}:${gaugeUnits}@${expiresAtFrame ?? "none"}`
  );
}

function projectTaskOrderResult(result: SimulationResult) {
  return {
    version: {
      schemaVersion: result.config.schemaVersion,
      engineVersion: result.config.engineVersion,
      dataVersion: result.config.dataVersion,
      randomSeed: result.config.randomSeed,
      reactionEngineMode:
        result.config.reactionEngine?.mode ?? null,
      timelineMode: result.config.timeline?.mode ?? null,
      targetTaskModelMode: result.config.targetTaskModel.mode,
      reactionDeliveryModelMode:
        result.config.reactionDeliveryModel.mode
    },
    directDamageEvents: result.damageEvents
      .filter((event) => event.kind === "direct")
      .map((event) => ({
        id: event.id,
        order: `P${event.eventPriority}/S${event.eventSequence}`,
        frame: event.frame,
        hitId: event.hitId,
        element: event.element,
        reaction: event.reaction,
        reactions: event.reactionAudit.reactions,
        bloomOperations:
          event.reactionAudit.bloomReactions.map(
            (entry) => entry.operation
          ),
        pendingHydroBloomFollowup:
          event.reactionAudit.catalyzeReaction?.quicken
            ?.pendingHydroBloomFollowup ?? false,
        finalDamage: event.finalDamage,
        displayDamage: event.displayDamage
      })),
    reactionTasks: result.reactionTaskLog.map((task) => ({
      id: task.id,
      kind: task.kind,
      frame: task.frame,
      triggerHitId: task.triggerHitId,
      triggerDamageEventId: task.triggerDamageEventId,
      triggerOrder: `P${task.triggerEventPriority}/S${task.triggerEventSequence}`,
      taskOrder: `P${task.eventPriority}/S${task.eventSequence}/I${task.intraEventSequence}`,
      status: task.status,
      blockedReason: task.blockedReason,
      auraBefore: projectAura(task.auraBefore),
      auraConsumed: task.auraConsumed.map(
        ({ element, gaugeUnits }) =>
          `${element}:${gaugeUnits}`
      ),
      auraAfter: projectAura(task.auraAfter),
      bloomReaction:
        task.bloomReaction === null
          ? null
          : {
              operation: task.bloomReaction.operation,
              triggerElement:
                task.bloomReaction.triggerElement,
              sourceBudget:
                task.bloomReaction.sourceBudget,
              hydro: {
                before:
                  task.bloomReaction
                    .hydroGaugeUnitsBefore,
                consumed:
                  task.bloomReaction
                    .hydroConsumedGaugeUnits,
                after:
                  task.bloomReaction
                    .hydroGaugeUnitsAfter
              },
              quicken: {
                before:
                  task.bloomReaction
                    .quickenGaugeUnitsBefore,
                consumed:
                  task.bloomReaction
                    .quickenConsumedGaugeUnits,
                after:
                  task.bloomReaction
                    .quickenGaugeUnitsAfter
              },
              quickenMutation: {
                operation:
                  task.bloomReaction.quickenStateMutation
                    .operation,
                generationBefore:
                  task.bloomReaction.quickenStateMutation
                    .generationBefore,
                generationAfter:
                  task.bloomReaction.quickenStateMutation
                    .generationAfter,
                expiresAtFrameBefore:
                  task.bloomReaction.quickenStateMutation
                    .expiresAtFrameBefore,
                expiresAtFrameAfter:
                  task.bloomReaction.quickenStateMutation
                    .expiresAtFrameAfter
              },
              coreSpawnFrame:
                task.bloomReaction.coreSpawnFrame
            },
      quickenStateLogIds: task.quickenStateLogIds,
      dendroCoreLogIds: task.dendroCoreLogIds,
      dendroCoreIds: task.dendroCoreIds
    })),
    quickenStateOrder: result.quickenStateLog.map(
      (entry) =>
        `#${entry.id}:F${entry.frame}:${entry.operation}:G${entry.generation}:${entry.quickenGaugeUnitsBefore}>${entry.quickenGaugeUnitsAfter}:X${entry.expiresAtFrame ?? "none"}:D${entry.triggerDamageEventId ?? "none"}:${entry.reason}`
    ),
    dendroCoreOrder: result.dendroCoreLog.map(
      (entry) =>
        `#${entry.id}/C${entry.coreId}:F${entry.frame}:P${entry.eventPriority}/S${entry.eventSequence}/I${entry.intraEventSequence}:${entry.eventType}:${entry.operation}:D${entry.originDamageEventId}${
          entry.operation === "spawn-scheduled"
            ? `:T${entry.reactionTaskLogId ?? "none"}:spawnF${entry.spawnFrame}`
            : entry.operation === "spawn"
              ? `:spawnedF${entry.spawnedAtFrame}:expireF${entry.expiresAtFrame}`
              : ""
        }`
    ),
    targetTimelineOrder: result.targetStateTimeline.points.map(
      (point) =>
        `#${point.id}:F${point.frame}:${point.pointKind}:${point.cause}:${point.eventType ?? "none"}:P${point.eventPriority ?? "none"}/S${point.eventSequence ?? "none"}/I${point.intraEventSequence ?? "none"}:${point.reactions.join("+") || "none"}:D${point.primaryDamageEventId ?? "none"}:${
          point.links
            .map((link) => `${link.kind}#${link.id}`)
            .join("+") || "no-links"
        }`
    ),
    targetTaskPhaseLog: result.targetTaskPhaseLog,
    targetPhaseLog: result.targetPhaseLog,
    totalDamage: result.totalDamage,
    reactedHits: result.reactedHits
  };
}

type TaskOrderProjection = ReturnType<
  typeof projectTaskOrderResult
>;
type TaskOrderScenarioId =
  | "fifo"
  | "missingQuicken"
  | "missingHydro"
  | "auraV6Compatibility";

type TaskOrderProjectionV138 = Omit<
  TaskOrderProjection,
  "version"
> & {
  version: Omit<
    TaskOrderProjection["version"],
    "reactionDeliveryModelMode"
  >;
};
type TaskOrderProjectionV137 = Omit<
  TaskOrderProjectionV138,
  "targetPhaseLog"
>;
type TaskOrderProjectionV136 = Omit<
  TaskOrderProjectionV137,
  "targetTaskPhaseLog" | "version"
> & {
  version: Omit<
    TaskOrderProjectionV137["version"],
    "targetTaskModelMode"
  >;
};

interface TaskOrderGoldenFixture<TProjection> {
  fixtureVersion: string;
  config: {
    schemaVersion: string;
    engineVersion: string;
    dataVersion: string;
    timelineMode: string;
    queuedReactionEngineMode: string;
    compatibilityReactionEngineMode: string;
    targetTaskModelMode?: string;
    reactionDeliveryModelMode?: string;
  };
  vectors: Record<
    TaskOrderScenarioId,
    TProjection
  >;
  hashes: Record<TaskOrderScenarioId, string>;
}

const taskOrderGoldenV136 =
  taskOrderGoldenV136Json as unknown as TaskOrderGoldenFixture<TaskOrderProjectionV136>;
const taskOrderGoldenV137 =
  taskOrderGoldenV137Json as unknown as TaskOrderGoldenFixture<TaskOrderProjectionV137>;
const taskOrderGoldenV138 =
  taskOrderGoldenV138Json as unknown as TaskOrderGoldenFixture<TaskOrderProjectionV138>;
const taskOrderGoldenV139 =
  taskOrderGoldenV139Json as unknown as TaskOrderGoldenFixture<TaskOrderProjection>;
const taskOrderGoldenV140 =
  taskOrderGoldenV140Json as unknown as TaskOrderGoldenFixture<TaskOrderProjection>;

function semanticHash(value: unknown): string {
  return createHash("sha256")
    .update(canonicalStringify(value))
    .digest("hex");
}

function projectAllTaskOrderVectors(): Record<
  TaskOrderScenarioId,
  TaskOrderProjection
> {
  return {
    fifo: projectTaskOrderResult(
      simulate(makeTaskOrderConfig("aura-v7"), {
        critMode: "noCrit"
      })
    ),
    missingQuicken: projectTaskOrderResult(
      simulate(
        makeTaskOrderConfig(
          "aura-v7",
          applicationHit(
            "hydro-removes-quicken",
            "hydro",
            2
          )
        ),
        { critMode: "noCrit" }
      )
    ),
    missingHydro: projectTaskOrderResult(
      simulate(
        makeTaskOrderConfig(
          "aura-v7",
          applicationHit(
            "cryo-removes-hydro",
            "cryo",
            0.8
          )
        ),
        { critMode: "noCrit" }
      )
    ),
    auraV6Compatibility: projectTaskOrderResult(
      simulate(makeTaskOrderConfig("aura-v6"), {
        critMode: "noCrit"
      })
    )
  };
}

function normalizeCurrentVectorsToV138(
  vectors: Record<TaskOrderScenarioId, TaskOrderProjection>
): Record<TaskOrderScenarioId, TaskOrderProjectionV138> {
  return Object.fromEntries(
    Object.entries(vectors).map(([id, vector]) => {
      const {
        reactionDeliveryModelMode:
          _reactionDeliveryModelMode,
        ...historicalVersion
      } = vector.version;
      return [
        id,
        {
          ...vector,
          version: {
            ...historicalVersion,
            schemaVersion:
              TARGET_REACTABLE_PHASE_SCHEMA_VERSION,
            engineVersion:
              TARGET_REACTABLE_PHASE_ENGINE_VERSION
          }
        }
      ];
    })
  ) as unknown as Record<
    TaskOrderScenarioId,
    TaskOrderProjectionV138
  >;
}

function normalizeCurrentVectorsToV139(
  vectors: Record<TaskOrderScenarioId, TaskOrderProjection>
): Record<TaskOrderScenarioId, TaskOrderProjection> {
  return Object.fromEntries(
    Object.entries(vectors).map(([id, vector]) => [
      id,
      {
        ...vector,
        version: {
          ...vector.version,
          schemaVersion:
            SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
          engineVersion:
            SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION
        }
      }
    ])
  ) as unknown as Record<
    TaskOrderScenarioId,
    TaskOrderProjection
  >;
}

function normalizeCurrentVectorsToV140(
  vectors: Record<TaskOrderScenarioId, TaskOrderProjection>
): Record<TaskOrderScenarioId, TaskOrderProjection> {
  return Object.fromEntries(
    Object.entries(vectors).map(([id, vector]) => [
      id,
      {
        ...vector,
        version: {
          ...vector.version,
          schemaVersion:
            EC_NEXT_TARGET_TICK_SCHEMA_VERSION,
          engineVersion:
            EC_NEXT_TARGET_TICK_ENGINE_VERSION
        }
      }
    ])
  ) as unknown as Record<
    TaskOrderScenarioId,
    TaskOrderProjection
  >;
}

function normalizeV138VectorsToV137(
  vectors: Record<
    TaskOrderScenarioId,
    TaskOrderProjectionV138
  >
): Record<TaskOrderScenarioId, TaskOrderProjectionV137> {
  return Object.fromEntries(
    Object.entries(vectors).map(([id, vector]) => {
      const {
        targetPhaseLog: _targetPhaseLog,
        ...historicalVector
      } = vector;
      return [
        id,
        {
          ...historicalVector,
          version: {
            ...historicalVector.version,
            schemaVersion:
              TARGET_TASK_PHASE_SCHEMA_VERSION,
            engineVersion:
              TARGET_TASK_PHASE_ENGINE_VERSION
          }
        }
      ];
    })
  ) as unknown as Record<
    TaskOrderScenarioId,
    TaskOrderProjectionV137
  >;
}

function normalizeV137VectorsToV136(
  vectors: Record<
    TaskOrderScenarioId,
    TaskOrderProjectionV137
  >
): Record<TaskOrderScenarioId, TaskOrderProjectionV136> {
  return Object.fromEntries(
    Object.entries(vectors).map(([id, vector]) => {
      const {
        targetTaskPhaseLog: _targetTaskPhaseLog,
        ...historicalVector
      } = vector;
      const {
        targetTaskModelMode: _targetTaskModelMode,
        ...historicalVersion
      } = historicalVector.version;
      return [
        id,
        {
          ...historicalVector,
          version: {
            ...historicalVersion,
            schemaVersion:
              QUICKEN_BLOOM_TASK_SCHEMA_VERSION,
            engineVersion:
              QUICKEN_BLOOM_TASK_ENGINE_VERSION
          }
        }
      ];
    })
  ) as unknown as Record<
    TaskOrderScenarioId,
    TaskOrderProjectionV136
  >;
}

describe("aura-v7 queued Quicken to Bloom follow-up", () => {
  it("keeps the current identity separate and normalizes through the frozen 1.40, 1.39, 1.38, 1.37, and 1.36 task-order Goldens", () => {
    const vectors = projectAllTaskOrderVectors();
    expect(
      Object.values(vectors).every(
        (vector) =>
          vector.version.schemaVersion === "1.41.0" &&
          vector.version.engineVersion ===
            "1.41.0-ec-secondary-wet-propagation"
      )
    ).toBe(true);

    expect(taskOrderGoldenV136.fixtureVersion).toBe("1.0.0");
    expect(taskOrderGoldenV136.config).toEqual({
      schemaVersion: QUICKEN_BLOOM_TASK_SCHEMA_VERSION,
      engineVersion: QUICKEN_BLOOM_TASK_ENGINE_VERSION,
      dataVersion:
        "quicken-bloom-task-order-provisional-1",
      timelineMode: "legal-frame-v1",
      queuedReactionEngineMode: "aura-v7",
      compatibilityReactionEngineMode: "aura-v6"
    });
    expect(taskOrderGoldenV137.fixtureVersion).toBe("1.0.0");
    expect(taskOrderGoldenV137.config).toEqual({
      schemaVersion: TARGET_TASK_PHASE_SCHEMA_VERSION,
      engineVersion: TARGET_TASK_PHASE_ENGINE_VERSION,
      dataVersion:
        "quicken-bloom-task-order-provisional-1",
      timelineMode: "legal-frame-v1",
      queuedReactionEngineMode: "aura-v7",
      compatibilityReactionEngineMode: "aura-v6",
      targetTaskModelMode: "legacy-event-heap-v1"
    });
    expect(taskOrderGoldenV138.fixtureVersion).toBe("1.0.0");
    expect(taskOrderGoldenV138.config).toEqual({
      schemaVersion: TARGET_REACTABLE_PHASE_SCHEMA_VERSION,
      engineVersion: TARGET_REACTABLE_PHASE_ENGINE_VERSION,
      dataVersion:
        "quicken-bloom-task-order-provisional-1",
      timelineMode: "legal-frame-v1",
      queuedReactionEngineMode: "aura-v7",
      compatibilityReactionEngineMode: "aura-v6",
      targetTaskModelMode: "legacy-event-heap-v1"
    });
    expect(taskOrderGoldenV139.fixtureVersion).toBe("1.0.0");
    expect(taskOrderGoldenV139.config).toEqual({
      schemaVersion: SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
      engineVersion: SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION,
      dataVersion:
        "quicken-bloom-task-order-provisional-1",
      timelineMode: "legal-frame-v1",
      queuedReactionEngineMode: "aura-v7",
      compatibilityReactionEngineMode: "aura-v6",
      targetTaskModelMode: "legacy-event-heap-v1",
      reactionDeliveryModelMode: "deferred-event-heap-v1"
    });
    expect(taskOrderGoldenV140.fixtureVersion).toBe("1.0.0");
    expect(taskOrderGoldenV140.config).toEqual({
      schemaVersion: EC_NEXT_TARGET_TICK_SCHEMA_VERSION,
      engineVersion: EC_NEXT_TARGET_TICK_ENGINE_VERSION,
      dataVersion:
        "quicken-bloom-task-order-provisional-1",
      timelineMode: "legal-frame-v1",
      queuedReactionEngineMode: "aura-v7",
      compatibilityReactionEngineMode: "aura-v6",
      targetTaskModelMode: "legacy-event-heap-v1",
      reactionDeliveryModelMode: "deferred-event-heap-v1"
    });
    const normalizedV140 =
      normalizeCurrentVectorsToV140(vectors);
    expect(normalizedV140).toEqual(
      taskOrderGoldenV140.vectors
    );
    expect(
      Object.fromEntries(
        Object.entries(normalizedV140).map(
          ([id, vector]) => [id, semanticHash(vector)]
        )
      )
    ).toEqual(taskOrderGoldenV140.hashes);

    const normalizedV139 =
      normalizeCurrentVectorsToV139(normalizedV140);
    expect(normalizedV139).toEqual(
      taskOrderGoldenV139.vectors
    );
    expect(
      Object.fromEntries(
        Object.entries(normalizedV139).map(
          ([id, vector]) => [id, semanticHash(vector)]
        )
      )
    ).toEqual(taskOrderGoldenV139.hashes);

    const normalizedV138 =
      normalizeCurrentVectorsToV138(normalizedV139);
    expect(normalizedV138).toEqual(
      taskOrderGoldenV138.vectors
    );
    expect(
      Object.fromEntries(
        Object.entries(normalizedV138).map(
          ([id, vector]) => [id, semanticHash(vector)]
        )
      )
    ).toEqual(taskOrderGoldenV138.hashes);

    const normalizedV137 =
      normalizeV138VectorsToV137(normalizedV138);
    expect(normalizedV137).toEqual(
      taskOrderGoldenV137.vectors
    );
    expect(
      Object.fromEntries(
        Object.entries(normalizedV137).map(
          ([id, vector]) => [id, semanticHash(vector)]
        )
      )
    ).toEqual(taskOrderGoldenV137.hashes);

    const normalizedV136 =
      normalizeV137VectorsToV136(normalizedV137);
    expect(normalizedV136).toEqual(
      taskOrderGoldenV136.vectors
    );
    expect(
      Object.fromEntries(
        Object.entries(normalizedV136).map(
          ([id, vector]) => [id, semanticHash(vector)]
        )
      )
    ).toEqual(taskOrderGoldenV136.hashes);
    expect(
      Object.values(vectors).every(
        (vector) =>
          vector.version.targetTaskModelMode ===
            "legacy-event-heap-v1" &&
          vector.version.reactionDeliveryModelMode ===
            "deferred-event-heap-v1" &&
          vector.targetTaskPhaseLog.length === 0 &&
          vector.targetPhaseLog.length === 0
      )
    ).toBe(true);
  });

  it("keeps non-Burning Quicken to Bloom in the core queue under target phase v1 and v2", () => {
    const scenarios: Array<
      [string, FrameHitDefinition | undefined]
    > = [
      ["fifo", undefined],
      [
        "missing-quicken",
        applicationHit(
          "hydro-removes-quicken",
          "hydro",
          2
        )
      ],
      [
        "missing-hydro",
        applicationHit(
          "cryo-removes-hydro",
          "cryo",
          0.8
        )
      ]
    ];
    const omitIntraEventSequence = <
      TEntry extends { intraEventSequence: number }
    >(
      entries: readonly TEntry[]
    ) =>
      entries.map(
        ({
          intraEventSequence: _intraEventSequence,
          ...entry
        }) => entry
      );
    const omitQueueScheduling = <
      TEntry extends {
        eventSequence: number;
        intraEventSequence: number;
      }
    >(
      entries: readonly TEntry[]
    ) =>
      entries.map(
        ({
          eventSequence: _eventSequence,
          intraEventSequence: _intraEventSequence,
          ...entry
        }) => entry
      );
    const omitDamageEventSequence = (
      entries: SimulationResult["damageEvents"]
    ) =>
      entries.map(
        ({ eventSequence: _eventSequence, ...entry }) =>
          entry
      );
    const omitQuickenTargetClockProjection = (
      entries: SimulationResult["quickenStateLog"]
    ) =>
      entries.map(
        ({
          targetFrame: _targetFrame,
          expiresAtTargetFrame: _expiresAtTargetFrame,
          expiresAtTargetFrameBefore:
            _expiresAtTargetFrameBefore,
          ...entry
        }) => entry
      );

    for (const [scenario, interveningHit] of scenarios) {
      const legacy = simulate(
        makeTaskOrderConfig(
          "aura-v7",
          interveningHit,
          "legacy-event-heap-v1"
        ),
        { critMode: "noCrit" }
      );
      const phased = simulate(
        makeTaskOrderConfig(
          "aura-v7",
          interveningHit,
          "target-phase-v1"
        ),
        { critMode: "noCrit" }
      );
      const phasedV2 = simulate(
        makeTaskOrderConfig(
          "aura-v7",
          interveningHit,
          "target-phase-v2"
        ),
        { critMode: "noCrit" }
      );

      expect(
        phased.targetTaskPhaseLog.length,
        `${scenario} should expose frozen v1 target phases`
      ).toBeGreaterThan(0);
      expect(
        phasedV2.targetPhaseLog.length,
        `${scenario} should expose v2 target phases`
      ).toBeGreaterThan(0);
      expect(phasedV2.targetTaskPhaseLog, scenario).toEqual(
        []
      );
      expect(
        phasedV2.targetPhaseLog.every(
          (phase) => phase.targetTasks.length === 0
        ),
        `${scenario} core reaction tasks must not become target-owned callbacks`
      ).toBe(true);
      expect(
        phasedV2.targetPhaseLog.flatMap(
          (phase) => phase.reactionTaskLogIds
        ),
        `${scenario} v2 phases should reference each later core task exactly once`
      ).toEqual(
        phasedV2.reactionTaskLog.map((task) => task.id)
      );
      for (const task of phasedV2.reactionTaskLog) {
        expect(
          task.triggerEventSequence,
          `${scenario} core task must execute after its trigger`
        ).toBeLessThan(task.eventSequence);
      }

      for (const [mode, result] of [
        ["target-phase-v1", phased],
        ["target-phase-v2", phasedV2]
      ] as const) {
        const assertionLabel = `${scenario}/${mode}`;
        expect(result.totalDamage, assertionLabel).toBe(
          legacy.totalDamage
        );
        expect(result.reactedHits, assertionLabel).toBe(
          legacy.reactedHits
        );
        expect(
          mode === "target-phase-v2"
            ? omitDamageEventSequence(result.damageEvents)
            : result.damageEvents,
          assertionLabel
        ).toEqual(
          mode === "target-phase-v2"
            ? omitDamageEventSequence(legacy.damageEvents)
            : legacy.damageEvents
        );
        expect(
          mode === "target-phase-v2"
            ? omitQuickenTargetClockProjection(
                result.quickenStateLog
              )
            : result.quickenStateLog,
          assertionLabel
        ).toEqual(
          mode === "target-phase-v2"
            ? omitQuickenTargetClockProjection(
                legacy.quickenStateLog
              )
            : legacy.quickenStateLog
        );
        expect(
          mode === "target-phase-v2"
            ? omitQueueScheduling(result.reactionTaskLog)
            : omitIntraEventSequence(
                result.reactionTaskLog
              ),
          assertionLabel
        ).toEqual(
          mode === "target-phase-v2"
            ? omitQueueScheduling(legacy.reactionTaskLog)
            : omitIntraEventSequence(
                legacy.reactionTaskLog
              )
        );
        expect(
          mode === "target-phase-v2"
            ? omitQueueScheduling(result.dendroCoreLog)
            : omitIntraEventSequence(result.dendroCoreLog),
          assertionLabel
        ).toEqual(
          mode === "target-phase-v2"
            ? omitQueueScheduling(legacy.dendroCoreLog)
            : omitIntraEventSequence(legacy.dendroCoreLog)
        );
        expect(result.auraEndStates, assertionLabel).toEqual(
          legacy.auraEndStates
        );
      }
    }
  });

  it("runs after an already-enqueued same-frame Electro hit in FIFO order", () => {
    const result = simulate(
      makeTaskOrderConfig("aura-v7"),
      { critMode: "noCrit" }
    );
    const dendro = directHit(result, "dendro-quicken");
    const electro = directHit(result, "electro-followup");
    const [task] = result.reactionTaskLog;

    expect(dendro.reactionAudit.reactions).toEqual([
      "quicken"
    ]);
    expect(dendro.reactionAudit.bloomReactions).toEqual([]);
    expect(
      dendro.reactionAudit.catalyzeReaction?.quicken
        ?.pendingHydroBloomFollowup
    ).toBe(true);
    expect(electro.reactionAudit.reactions).toEqual([
      "aggravate",
      "electroCharged"
    ]);

    expect(task).toMatchObject({
      id: 0,
      kind: "quicken-bloom-followup",
      frame: 0,
      triggerHitId: "dendro-quicken",
      triggerDamageEventId: dendro.id,
      triggerEventType: "hit",
      triggerEventPriority: dendro.eventPriority,
      triggerEventSequence: dendro.eventSequence,
      eventPriority: dendro.eventPriority,
      status: "triggered",
      blockedReason: null,
      quickenStateLogIds: [1],
      dendroCoreLogIds: [0],
      dendroCoreIds: [0]
    });
    expect(dendro.eventSequence).toBeLessThan(
      electro.eventSequence
    );
    expect(electro.eventSequence).toBeLessThan(
      task!.eventSequence
    );
    expect(task!.bloomReaction).toMatchObject({
      reaction: "bloom",
      operation: "quicken-followup",
      triggerElement: "dendro",
      quickenGaugeUnitsBefore: 0.8,
      quickenConsumedGaugeUnits: 0.4,
      quickenGaugeUnitsAfter: 0.4,
      hydroGaugeUnitsBefore: 0.8,
      hydroConsumedGaugeUnits: 0.8,
      hydroGaugeUnitsAfter: 0,
      coreSpawnFrame: 30
    });
    expect(
      result.dendroCoreLog
        .filter(
          (entry) => entry.operation === "spawn-scheduled"
        )
        .map((entry) => ({
          eventType: entry.eventType,
          reactionTaskLogId: entry.reactionTaskLogId,
          spawnFrame: entry.spawnFrame
        }))
    ).toEqual([
      {
        eventType: "quickenBloomFollowup",
        reactionTaskLogId: 0,
        spawnFrame: 30
      }
    ]);
    expect(
      result.damageEvents
        .filter(
          (event) =>
            event.kind === "transformative-reaction" &&
            event.reaction === "electroCharged"
        )
        .map((event) => event.frame)
    ).toEqual([10]);
    expect(result.totalDamage).toBeCloseTo(
      3353.08298625,
      10
    );
    expect(result.reactedHits).toBe(2);
  });

  it("skips with MISSING_QUICKEN when an intervening Hydro hit removes Quicken", () => {
    const result = simulate(
      makeTaskOrderConfig(
        "aura-v7",
        applicationHit(
          "hydro-removes-quicken",
          "hydro",
          2
        )
      ),
      { critMode: "noCrit" }
    );
    const dendro = directHit(result, "dendro-quicken");
    const intervening = directHit(
      result,
      "hydro-removes-quicken"
    );
    const [task] = result.reactionTaskLog;

    expect(
      dendro.reactionAudit.catalyzeReaction?.quicken
        ?.pendingHydroBloomFollowup
    ).toBe(true);
    expect(intervening.reactionAudit.reactions).toEqual([
      "bloom"
    ]);
    expect(task).toMatchObject({
      triggerHitId: "dendro-quicken",
      status: "skipped",
      blockedReason: "MISSING_QUICKEN",
      auraConsumed: [],
      bloomReaction: null,
      quickenStateLogIds: [],
      dendroCoreLogIds: [],
      dendroCoreIds: []
    });
    expect(task!.auraAfter).toEqual(task!.auraBefore);
  });

  it("skips with MISSING_HYDRO when an intervening Cryo hit consumes Hydro", () => {
    const result = simulate(
      makeTaskOrderConfig(
        "aura-v7",
        applicationHit("cryo-removes-hydro", "cryo", 0.8)
      ),
      { critMode: "noCrit" }
    );
    const dendro = directHit(result, "dendro-quicken");
    const intervening = directHit(
      result,
      "cryo-removes-hydro"
    );
    const [task] = result.reactionTaskLog;

    expect(
      dendro.reactionAudit.catalyzeReaction?.quicken
        ?.pendingHydroBloomFollowup
    ).toBe(true);
    expect(intervening.reactionAudit.reactions).toEqual([
      "freeze"
    ]);
    expect(task).toMatchObject({
      triggerHitId: "dendro-quicken",
      status: "skipped",
      blockedReason: "MISSING_HYDRO",
      auraConsumed: [],
      bloomReaction: null,
      quickenStateLogIds: [],
      dendroCoreLogIds: [],
      dendroCoreIds: []
    });
    expect(task!.auraAfter).toEqual(task!.auraBefore);
  });

  it("keeps aura-v6 synchronous compatibility output frozen", () => {
    const result = simulate(
      makeTaskOrderConfig("aura-v6"),
      { critMode: "noCrit" }
    );
    const dendro = directHit(result, "dendro-quicken");
    const electro = directHit(result, "electro-followup");

    expect(result.reactionTaskLog).toEqual([]);
    expect(dendro.reactionAudit.reactions).toEqual([
      "quicken",
      "bloom"
    ]);
    expect(
      dendro.reactionAudit.bloomReactions.map(
        (entry) => entry.operation
      )
    ).toEqual(["quicken-followup"]);
    expect(electro.reactionAudit.reactions).toEqual([
      "aggravate"
    ]);
    expect(
      result.damageEvents.filter(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.reaction === "electroCharged"
      )
    ).toEqual([]);
    expect(result.totalDamage).toBeCloseTo(
      748.7466862499999,
      10
    );
    expect(result.reactedHits).toBe(2);
    expect(
      result.dendroCoreLog
        .filter(
          (entry) => entry.operation === "spawn-scheduled"
        )
        .map((entry) => ({
          eventType: entry.eventType,
          reactionTaskLogId: entry.reactionTaskLogId
        }))
    ).toEqual([
      {
        eventType: "hit",
        reactionTaskLogId: undefined
      }
    ]);
  });
});
