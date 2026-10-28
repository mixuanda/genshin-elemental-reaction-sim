import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  canonicalStringify,
  assertTrustedSimulationResult,
  simulationResultSchema,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
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
import {
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID
} from "@genshin-dps-lab/icd-profiles";
import { describe, expect, it } from "vitest";
import taskOrderGoldenV136Json from "../../../test-vectors/fixtures/quicken-bloom-task-order-1.36.golden.json";
import taskOrderGoldenV137Json from "../../../test-vectors/fixtures/quicken-bloom-task-order-1.37.golden.json";
import taskOrderGoldenV138Json from "../../../test-vectors/fixtures/quicken-bloom-task-order-1.38.golden.json";
import taskOrderGoldenV139Json from "../../../test-vectors/fixtures/quicken-bloom-task-order-1.39.golden.json";
import taskOrderGoldenV140Json from "../../../test-vectors/fixtures/quicken-bloom-task-order-1.40.golden.json";
import { parseSimulationHit } from "../calculator-bridge";
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
      icd: { mode: "no-icd-v1" }
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
    reactionDamageGroupModel: {
      mode: "legacy-reaction-damage-group-window-v1",
      policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID
    },
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

const taskOrderScenarioIds: TaskOrderScenarioId[] = ["fifo", "missingQuicken", "missingHydro", "auraV6Compatibility"];
function projectHistoricalTaskOrderVectors(): Record<TaskOrderScenarioId, TaskOrderProjection> {
  return Object.fromEntries(taskOrderScenarioIds.map((id) => [
    id, projectTaskOrderResult(historicalTaskOrder(`${id}/legacy-event-heap-v1`)),
  ])) as Record<TaskOrderScenarioId, TaskOrderProjection>;
}

function normalizeHistoricalVectorsToV138(
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

function normalizeHistoricalVectorsToV139(
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

function normalizeHistoricalVectorsToV140(
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

const historicalTaskOrderBytes = readFileSync(new URL(
  "../../../test-vectors/src/fixtures/historical-quicken-bloom-task-order-v153-84ff5cd.json", import.meta.url,
));
const historicalTaskOrderArchive = JSON.parse(historicalTaskOrderBytes.toString("utf8")) as {
  fixtureVersion: string; source: { commit: string };
  cases: Array<{ caseId: string; sourceWireSha256: string; sourceWireText: string }>;
};
const byteSha256 = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function historicalTaskOrder(caseId: string): SimulationResult {
  const row = historicalTaskOrderArchive.cases.find((entry) => entry.caseId === caseId);
  if (!row) throw new Error(`Missing authentic Quicken/Bloom input ${caseId}`);
  expect(byteSha256(row.sourceWireText)).toBe(row.sourceWireSha256);
  const result = JSON.parse(row.sourceWireText) as SimulationResult;
  expect(result.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(result.runManifest.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(simulationResultSchema.parse(result)).toEqual(result);
  expect(assertTrustedSimulationResult(result)).toBe(result);
  return result;
}

// Expected mechanics only, not a historical/current wire converter. Every
// field except the separately checked run identity is retained, including all
// profile-specific phase rows, clock fields, IDs, queue positions and backlinks.
function taskOrderMechanics(result: SimulationResult) {
  const { runManifest: _manifest, resolvedRuntimeOptions: _options, reproducibilityKey: _key, ...mechanics } = result;
  return mechanics;
}

// Closed source-proven maps, not universal offsets. Legacy/V2 retain actual
// future expiry/tick tasks (V2 also retains target-decay wakes); V1 does not.
// V1 has a phase prologue before direct resolution; its Aura application must
// therefore remain substep2, distinct from legacy/V2 substep1.
const CURRENT_TASK_ORDER: Record<string, {
  queuePairs: readonly (readonly [number, number])[]; directCount: number;
  applicationOldStep: number; directCoreOldStep: number | null;
  followupSequence: number | null; coreSpawnSequence: number | null;
}> = {
  "fifo/legacy-event-heap-v1": { queuePairs: [[1, 1], [2, 2], [3, 4], [4, 6], [5, 8], [6, 9]], directCount: 2, applicationOldStep: 0, directCoreOldStep: null, followupSequence: 4, coreSpawnSequence: 8 },
  "missingQuicken/legacy-event-heap-v1": { queuePairs: [[1, 1], [2, 2], [3, 3], [4, 5], [5, 6], [6, 8], [7, 9], [8, 11]], directCount: 3, applicationOldStep: 0, directCoreOldStep: 1, followupSequence: 5, coreSpawnSequence: 6 },
  "missingHydro/legacy-event-heap-v1": { queuePairs: [[1, 1], [2, 2], [3, 3], [4, 5], [5, 7]], directCount: 3, applicationOldStep: 0, directCoreOldStep: null, followupSequence: 5, coreSpawnSequence: null },
  "auraV6Compatibility/legacy-event-heap-v1": { queuePairs: [[1, 1], [2, 2], [3, 3]], directCount: 2, applicationOldStep: 0, directCoreOldStep: 1, followupSequence: null, coreSpawnSequence: 3 },
  "fifo/target-phase-v1": { queuePairs: [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6]], directCount: 2, applicationOldStep: 1, directCoreOldStep: null, followupSequence: 3, coreSpawnSequence: 5 },
  "fifo/target-phase-v2": { queuePairs: [[1, 1], [2, 2], [4, 6], [5, 9], [6, 12], [8, 14]], directCount: 2, applicationOldStep: 0, directCoreOldStep: null, followupSequence: 6, coreSpawnSequence: 12 },
  "missingQuicken/target-phase-v1": { queuePairs: [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 8]], directCount: 3, applicationOldStep: 1, directCoreOldStep: 2, followupSequence: 4, coreSpawnSequence: 5 },
  "missingQuicken/target-phase-v2": { queuePairs: [[1, 1], [2, 2], [3, 3], [5, 7], [6, 8], [7, 11], [9, 13], [10, 15]], directCount: 3, applicationOldStep: 0, directCoreOldStep: 1, followupSequence: 7, coreSpawnSequence: 8 },
  "missingHydro/target-phase-v1": { queuePairs: [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]], directCount: 3, applicationOldStep: 1, directCoreOldStep: null, followupSequence: 4, coreSpawnSequence: null },
  "missingHydro/target-phase-v2": { queuePairs: [[1, 1], [2, 2], [3, 3], [5, 7], [6, 10]], directCount: 3, applicationOldStep: 0, directCoreOldStep: null, followupSequence: 7, coreSpawnSequence: null },
};

function expectCurrentTaskOrderContract(scenario: TaskOrderScenarioId, result: SimulationResult): void {
  const before = JSON.stringify(result);
  const mode = result.config.targetTaskModel.mode;
  const key = `${scenario}/${mode}`;
  const order = CURRENT_TASK_ORDER[key];
  if (!order) throw new Error(`Unreviewed Quicken/Bloom profile ${key}`);
  const historical = historicalTaskOrder(key);
  expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  expect(result.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  expect(result.resolvedRuntimeOptions).toEqual({ ...historical.resolvedRuntimeOptions, flatStatBuffSemantics: "canonical-v1" });
  expect(result.runManifest.resolvedRuntimeOptions).toEqual(result.resolvedRuntimeOptions);
  expect(result.runManifest.reproducibilityKey).toBe(result.reproducibilityKey);
  expect(result.reproducibilityKey).not.toBe(historical.reproducibilityKey);
  const { reproducibilityKey: _oldKey, resolvedRuntimeOptions: _oldOptions, ...oldManifest } = historical.runManifest;
  const { reproducibilityKey: _currentKey, resolvedRuntimeOptions: _currentOptions, ...currentManifest } = result.runManifest;
  expect(currentManifest).toEqual(oldManifest);
  expect(simulationResultSchema.parse(JSON.parse(before))).toEqual(result);
  expect(assertTrustedSimulationResult(result)).toBe(result);

  const queue = new Map(order.queuePairs);
  expect(queue.size).toBe(order.queuePairs.length);
  expect(new Set(queue.values()).size).toBe(queue.size);
  expect([...queue.keys()]).toEqual([...queue.keys()].sort((a, b) => a - b));
  expect([...queue.values()]).toEqual([...queue.values()].sort((a, b) => a - b));
  const currentSequence = (old: number): number => {
    const next = queue.get(old);
    if (next === undefined) throw new Error(`Unreviewed ${key} queue position ${old}`);
    return next;
  };
  const mapSequence = <T extends object>(row: T): T => {
    if (!("eventSequence" in row) || row.eventSequence == null) return row;
    if (typeof row.eventSequence !== "number") throw new Error("Expected a numeric queue position");
    return { ...row, eventSequence: currentSequence(row.eventSequence) };
  };
  const expected = structuredClone(taskOrderMechanics(historical));
  expected.damageEvents = expected.damageEvents.map(mapSequence);
  expected.hitEvents = expected.hitEvents.map(mapSequence);
  expected.hitResolutionLog = expected.hitResolutionLog.map(mapSequence);
  expected.reactionTaskLog = expected.reactionTaskLog.map(mapSequence);
  expected.dendroCoreLog = expected.dendroCoreLog.map(mapSequence);
  expected.dendroCoreTimeline.points = expected.dendroCoreTimeline.points.map(mapSequence);
  expected.targetStateTimeline.points = expected.targetStateTimeline.points.map(mapSequence);
  expected.reactionDamageLog = expected.reactionDamageLog.map((delivery) => ({
    ...delivery, damageGroupDecisions: delivery.damageGroupDecisions.map((decision) => ({
      ...decision, damageGroupTaskSequence: currentSequence(decision.damageGroupTaskSequence),
    })),
  }));
  const directIds = Array.from({ length: order.directCount }, (_, id) => id);
  expect(expected.hitResolutionLog.filter((row) => row.reactionDamageLogId === null).map((row) => row.id)).toEqual(directIds);
  for (const id of directIds) {
    const resolution = expected.hitResolutionLog[id]!;
    if (mode === "legacy-event-heap-v1") {
      expect(resolution).not.toHaveProperty("eventPriority");
      expect(resolution).not.toHaveProperty("eventSequence");
      expect(resolution).not.toHaveProperty("intraEventSequence");
      resolution.eventPriority = 3;
      resolution.eventSequence = id + 1;
      resolution.intraEventSequence = 0;
    } else {
      expect(resolution).toMatchObject({ eventPriority: 3, eventSequence: id + 1, intraEventSequence: order.applicationOldStep });
    }
    const point = expected.targetStateTimeline.points[id + 1]!;
    expect(point).toMatchObject({ id: id + 1, cause: "direct-hit-application", eventType: "hit",
      eventPriority: 3, eventSequence: id + 1, intraEventSequence: order.applicationOldStep, primaryDamageEventId: id });
    point.intraEventSequence = order.applicationOldStep + 1;
  }
  expect(expected.targetStateTimeline.points.filter((point) => point.cause === "direct-hit-application").map((point) => point.id)).toEqual(directIds.map((id) => id + 1));
  const directCoreRows = expected.dendroCoreLog.filter((row) => row.operation === "spawn-scheduled" && row.eventType === "hit");
  expect(directCoreRows.map((row) => row.id)).toEqual(order.directCoreOldStep === null ? [] : [0]);
  if (order.directCoreOldStep !== null) {
    expect(directCoreRows[0]!.intraEventSequence).toBe(order.directCoreOldStep);
    directCoreRows[0]!.intraEventSequence = order.directCoreOldStep + 1;
  }
  expect(taskOrderMechanics(result)).toStrictEqual(expected);
  expectCurrentTaskMechanics(scenario, result, order);
  expect(JSON.stringify(result)).toBe(before);
}

function expectCurrentTaskMechanics(scenario: TaskOrderScenarioId, result: SimulationResult, order: (typeof CURRENT_TASK_ORDER)[string]): void {
  // Independent level90 / EM0 / resistance10% arithmetic, not Golden totals or
  // production formula helpers. Aggravate additionally has 0.5 DEF mitigation.
  const aggravate = 1446.8535 * 1.15 * 0.5 * 0.9;
  const electroCharged = 1446.8535 * 2 * 0.9;
  const superconduct = 1446.8535 * 1.5 * 0.9;
  const numbers = {
    fifo: [0, aggravate, electroCharged],
    missingQuicken: [0, 0, 0, electroCharged],
    missingHydro: [0, 0, aggravate, superconduct],
    auraV6Compatibility: [0, aggravate],
  }[scenario];
  const frames = { fifo: [0, 0, 10], missingQuicken: [0, 0, 0, 10], missingHydro: [0, 0, 0, 1], auraV6Compatibility: [0, 0] }[scenario];
  expect(result.damageEvents.map((event) => event.id)).toEqual(numbers.map((_, id) => id));
  expect(result.damageEvents.map((event) => event.frame)).toEqual(frames);
  result.damageEvents.forEach((event, id) => {
    expect([event.sourceActorId, event.targetId]).toEqual(["driver", "enemy-0"]);
    expect(event.finalDamage).toBeCloseTo(numbers[id]!, 10);
    expect(event.displayDamage).toBe(Math.round(numbers[id]!));
  });
  const total = numbers.reduce((sum, damage) => sum + damage, 0);
  expect(result.totalDamage).toBeCloseTo(total, 10);
  expect(result.dps).toBeCloseTo(total, 10);
  expect(result.byCharacter.driver).toBeCloseTo(total, 10);
  expect(result.reactedHits).toBe(order.directCount);
  const mode = result.config.targetTaskModel.mode;
  for (const log of result.quickenStateLog) {
    if (mode === "target-phase-v2") {
      expect(log).toMatchObject({ targetFrame: log.frame, expiresAtTargetFrameBefore: log.expiresAtFrameBefore, expiresAtTargetFrame: log.expiresAtFrame });
    } else {
      expect(log).not.toHaveProperty("targetFrame");
      expect(log).not.toHaveProperty("expiresAtTargetFrameBefore");
      expect(log).not.toHaveProperty("expiresAtTargetFrame");
    }
  }
  if (scenario === "auraV6Compatibility") {
    expect(result.reactionTaskLog).toEqual([]);
  } else {
    expect(result.reactionTaskLog).toHaveLength(1);
    const task = result.reactionTaskLog[0]!;
    const electro = directHit(result, "electro-followup");
    expect(task).toMatchObject({ id: 0, kind: "quicken-bloom-followup", frame: 0, sourceActorId: "driver", targetId: "enemy-0",
      triggerDamageEventId: 0, triggerHitId: "dendro-quicken", triggerEventType: "hit", triggerEventPriority: 3,
      triggerEventSequence: 1, eventPriority: 3, eventSequence: order.followupSequence, intraEventSequence: 0 });
    expect(electro.eventPriority).toBe(3);
    expect(electro.eventSequence).toBeLessThan(task.eventSequence);
    const triggered = scenario === "fifo";
    expect(task.status).toBe(triggered ? "triggered" : "skipped");
    expect(task.blockedReason).toBe(triggered ? null : scenario === "missingQuicken" ? "MISSING_QUICKEN" : "MISSING_HYDRO");
    expect(task.quickenStateLogIds).toEqual(triggered ? [1] : []);
    expect(task.dendroCoreLogIds).toEqual(triggered ? [0] : []);
    expect(task.dendroCoreIds).toEqual(triggered ? [0] : []);
    if (triggered) {
      expect(task.bloomReaction).toMatchObject({ operation: "quicken-followup", sourceBudget: "quicken-state", quickenGaugeUnitsBefore: 0.8,
        quickenConsumedGaugeUnits: 0.4, quickenGaugeUnitsAfter: 0.4, hydroGaugeUnitsBefore: 0.8,
        hydroConsumedGaugeUnits: 0.8, hydroGaugeUnitsAfter: 0, coreSpawnFrame: 30 });
      expect(task.auraAfter.some((entry) => entry.element === "hydro")).toBe(false);
      expect(task.auraAfter.find((entry) => entry.element === "quicken")).toMatchObject({ gaugeUnits: 0.4, expiresAtFrame: 300 });
    } else {
      expect(task.bloomReaction).toBeNull();
      expect(task.auraConsumed).toEqual([]);
      expect(task.auraAfter).toEqual(task.auraBefore);
    }
    const point = result.targetStateTimeline.points[order.directCount + 1]!;
    expect(point).toMatchObject({ cause: "quicken-bloom-followup", eventType: "quickenBloomFollowup", frame: 0,
      eventPriority: 3, eventSequence: order.followupSequence, intraEventSequence: triggered ? 2 : 1, primaryDamageEventId: 0 });
    expect(point.links).toEqual([{ kind: "damage-event", id: 0 }, { kind: "reaction-task-log", id: 0 },
      ...(triggered ? [{ kind: "quicken-state-log", id: 1 }] : [])]);
    if (mode === "target-phase-v1") expect(result.targetTaskPhaseLog.flatMap((phase) => phase.reactionTaskLogIds)).toEqual([0]);
    if (mode === "target-phase-v2") {
      expect(result.targetPhaseLog.flatMap((phase) => phase.reactionTaskLogIds)).toEqual([0]);
      expect(result.targetPhaseLog.every((phase) => phase.targetTasks.length === 0)).toBe(true);
    }
  }
  if (scenario === "missingHydro") {
    expect(result.dendroCoreLog).toEqual([]);
  } else {
    const origin = scenario === "missingQuicken" ? 1 : 0;
    expect(result.dendroCoreLog).toHaveLength(2);
    expect(result.dendroCoreLog[0]).toMatchObject({ id: 0, coreId: 0, operation: "spawn-scheduled", frame: 0, spawnFrame: 30,
      sourceActorId: "driver", sourceTargetId: "enemy-0", originDamageEventId: origin,
      eventType: scenario === "fifo" ? "quickenBloomFollowup" : "hit", eventSequence: scenario === "fifo" ? order.followupSequence : origin + 1 });
    if (scenario === "fifo") expect(result.dendroCoreLog[0]).toMatchObject({ reactionTaskLogId: 0 });
    else expect(result.dendroCoreLog[0]).not.toHaveProperty("reactionTaskLogId");
    expect(result.dendroCoreLog[1]).toMatchObject({ id: 1, coreId: 0, operation: "spawn", frame: 30, spawnedAtFrame: 30,
      expiresAtFrame: 330, eventType: "dendroCoreSpawn", eventPriority: 2, eventSequence: order.coreSpawnSequence,
      sourceActorId: "driver", sourceTargetId: "enemy-0", originDamageEventId: origin });
  }
}

type TaskOrderMode = SimConfig["targetTaskModel"]["mode"];
const taskOrderModes = ["legacy-event-heap-v1", "target-phase-v1", "target-phase-v2"] as const;
const hostileTaskOrderCases: Array<{
  name: string; mode: TaskOrderMode; scenario?: "missingQuicken" | "missingHydro";
  mutate: (result: SimulationResult) => void;
}> = [
  ...taskOrderModes.flatMap((mode) => [
    { name: `${mode}: dangling trigger`, mode, mutate: (result: SimulationResult) => {
      result.reactionTaskLog[0]!.triggerDamageEventId = 999;
    } },
    { name: `${mode}: follow-up aliases its trigger queue position`, mode, mutate: (result: SimulationResult) => {
      result.reactionTaskLog[0]!.eventSequence = result.reactionTaskLog[0]!.triggerEventSequence;
    } },
    { name: `${mode}: core schedule belongs to the later Electro hit`, mode, mutate: (result: SimulationResult) => {
      result.dendroCoreLog[0]!.originDamageEventId = 1;
    } },
  ]),
  { name: "missing Quicken falsely reports missing Hydro", mode: "legacy-event-heap-v1", scenario: "missingQuicken", mutate: (result) => {
    result.reactionTaskLog[0]!.blockedReason = "MISSING_HYDRO";
  } },
  { name: "missing Hydro falsely reports missing Quicken", mode: "target-phase-v1", scenario: "missingHydro", mutate: (result) => {
    result.reactionTaskLog[0]!.blockedReason = "MISSING_QUICKEN";
  } },
  { name: "v2 phase loses ownership of the later core task", mode: "target-phase-v2", mutate: (result) => {
    result.targetPhaseLog[0]!.reactionTaskLogIds = [];
  } },
  { name: "unversioned reaction task field", mode: "target-phase-v2", mutate: (result) => {
    Object.assign(result.reactionTaskLog[0]!, { unversionedField: true });
  } },
];

describe("Quicken/Bloom public causal boundaries", () => {
  it.each(hostileTaskOrderCases)("rejects $name at public parsing and real capture import", ({ mode, scenario, mutate }) => {
    const intervening = scenario === "missingQuicken" ? applicationHit("hydro-removes-quicken", "hydro", 2)
      : scenario === "missingHydro" ? applicationHit("cryo-removes-hydro", "cryo", 0.8) : undefined;
    const result = simulate(makeTaskOrderConfig("aura-v7", intervening, mode), { critMode: "noCrit" });
    const before = JSON.stringify(result);
    expect(simulationResultSchema.parse(result)).toEqual(result);
    expect(assertTrustedSimulationResult(result)).toBe(result);
    const capture = { schemaVersion: "calculator-event-v1", eventId: 0, sourceResult: result };
    expect(parseSimulationHit(JSON.stringify(capture)).sourceResult).toEqual(result);
    const forged = structuredClone(result);
    mutate(forged);
    expect(JSON.stringify(forged)).not.toBe(before);
    const parsed = simulationResultSchema.safeParse(forged);
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Forged Quicken/Bloom result unexpectedly parsed");
    expect(() => parseSimulationHit(JSON.stringify({ ...capture, sourceResult: forged }))).toThrow(parsed.error.message);
    // Untrusted capture import parses the full public schema before the trusted
    // helper. Do not assume that helper alone validates arbitrary raw JSON.
    expect(JSON.stringify(result)).toBe(before);
  });
});

describe("authentic historical Quicken/Bloom inputs", () => {
  it("pins all five frozen byte streams and the ten original pre-marker profile inputs", () => {
    expect(byteSha256(historicalTaskOrderBytes)).toBe("7950d7abca01af336e41979d8787fe390b32168e819b493aae83f121fa4e9b52");
    expect(historicalTaskOrderArchive).toMatchObject({
      fixtureVersion: "historical-quicken-bloom-task-order-v153-84ff5cd-v1",
      source: { commit: "84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5", tree: "72bd69a8c54a3e115685c7ee52f5862064c70f55" },
    });
    expect(historicalTaskOrderArchive.cases.map((row) => row.caseId)).toEqual(Object.keys(CURRENT_TASK_ORDER));
    const frozenHashes = {
      "1.36": "6a1b2840ff3f6e2d8abbba0b80e98823336ab33cca3a6658fef4223974cdae84",
      "1.37": "d7d6a4c5ec77fcc658f024b44044765cac74f5d60e59bff4fa4d8ed49317bfb6",
      "1.38": "07b35af482d2cf1f5cf77eb978682c51eb014300413ea516973dba1807863cfc",
      "1.39": "a09f6c001bc0282299f96a81232fab56caa0803f3b5b83f4d85233772ef50534",
      "1.40": "b13f96768e589b77ff62daef1fd5cae0a3b1bab2a98fc88ce7c3f415356805b4",
    };
    for (const [version, hash] of Object.entries(frozenHashes)) {
      expect(byteSha256(readFileSync(new URL(`../../../test-vectors/fixtures/quicken-bloom-task-order-${version}.golden.json`, import.meta.url)))).toBe(hash);
    }
  });
});

describe("aura-v7 queued Quicken to Bloom follow-up", () => {
  it("keeps authentic historical identity separate through the frozen 1.40, 1.39, 1.38, 1.37, and 1.36 task-order Goldens", () => {
    const vectors = projectHistoricalTaskOrderVectors();
    expect(
      Object.values(vectors).every(
        (vector) =>
          vector.version.schemaVersion === "1.53.0" &&
          vector.version.engineVersion === "1.53.0-callback-bus"
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
      normalizeHistoricalVectorsToV140(vectors);
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
      normalizeHistoricalVectorsToV139(normalizedV140);
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
      normalizeHistoricalVectorsToV138(normalizedV139);
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
      [TaskOrderScenarioId, FrameHitDefinition | undefined]
    > = [
      ["fifo", undefined],
      [
        "missingQuicken",
        applicationHit(
          "hydro-removes-quicken",
          "hydro",
          2
        )
      ],
      [
        "missingHydro",
        applicationHit(
          "cryo-removes-hydro",
          "cryo",
          0.8
        )
      ]
    ];
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

      for (const result of [legacy, phased, phasedV2]) expectCurrentTaskOrderContract(scenario, result);

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
        // Complete damage/task/core/timeline arrays are checked above against
        // each profile's explicit oracle. The profiles genuinely differ in
        // queue positions, phase rows and substeps; never discard those fields.
        expect(result.byCharacter, assertionLabel).toEqual(legacy.byCharacter);
        expect(result.damageCurve, assertionLabel).toEqual(legacy.damageCurve);
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
    expectCurrentTaskOrderContract("fifo", result);
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
    expectCurrentTaskOrderContract("missingQuicken", result);
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
    expectCurrentTaskOrderContract("missingHydro", result);
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
    expectCurrentTaskOrderContract("auraV6Compatibility", result);
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
