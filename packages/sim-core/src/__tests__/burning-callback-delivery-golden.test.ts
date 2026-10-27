import { createHash } from "node:crypto";
import { linkSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  LEGACY_SIMULATION_RUN_MANIFEST_VERSION,
  assertTrustedSimulationResult,
  canonicalStringify,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  simConfigV144Schema,
  simulationResultSchema,
  simulationRunManifestV144Schema,
  targetPhaseV3ResultReferencesSchema,
  type DamageEvent,
  type HitResolutionLogEntry,
  type SimConfig,
  type SimConfigV144,
  type SimulationResult,
  type SimulationRunManifestV144,
  type TargetPhaseV3Delivery,
  type TargetPhaseV3TargetTask,
  type TargetPhaseV3DeliveryAttempt,
  type TargetPhaseV3LogEntry,
  type TargetStateTimelinePoint,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID } from "@genshin-dps-lab/icd-profiles";
import { projectSimulationResultV150ToV149 } from "../../../test-vectors/src/project-v150-to-v149";
import { projectSimulationResultV151ToV150 } from "../../../test-vectors/src/project-v151-to-v150";
import { projectSimulationResultV152ToV151 } from "../../../test-vectors/src/project-v152-to-v151";
import { projectSimulationResultV153ToV152 } from "../../../test-vectors/src/project-v153-to-v152";
import { parseSimulationHit } from "../calculator-bridge";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const UPDATE_FLAG = "UPDATE_BURNING_CALLBACK_DELIVERY_V144_GOLDEN";
const FROZEN_FIXTURE_SHA256 =
  "4caf9609daac1fde41195399e5c3af8daca60e14849aa4c5195b286ae947da65";
const FIXTURE_URL = new URL(
  "../../../test-vectors/fixtures/burning-callback-delivery-1.44.golden.json",
  import.meta.url,
);
const OWNER_ID = "enemy-0";
const ELECTRO_RECIPIENT_ID = "electro-recipient";
const PLAIN_RECIPIENT_ID = "plain-recipient";
const OUTSIDE_RADIUS_ID = "outside-radius";
const UNRESOLVED_POSITION_ID = "unresolved-position";

function makeBurningCallbackGoldenConfig(): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    reactionDamageGroupModel: {
      mode: "legacy-reaction-damage-group-window-v1",
      policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
    },
    dataVersion: "burning-callback-delivery-provisional-1",
    randomSeed: "burning-callback-delivery-golden-seed",
    meta: {
      name: "Burning callback delivery v1.44 Golden",
      version: "1.44.0",
      verificationStatus: "provisional",
      note: "Fixed-gcsim-provisional regression vector only; not official server truth or a claim of complete gcsim parity.",
    },
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: ELECTRO_RECIPIENT_ID,
          name: "Electro recipient before owner",
          position: { x: 0.5, y: 0 },
          hitboxRadius: 0,
          initialAura: [{ element: "electro", gaugeUnits: 1 }],
        },
        {
          id: OWNER_ID,
          name: "Burning owner",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [{ element: "dendro", gaugeUnits: 1 }],
        },
        {
          id: PLAIN_RECIPIENT_ID,
          name: "Plain recipient after owner",
          position: { x: 0.75, y: 0 },
          hitboxRadius: 0,
        },
        {
          id: OUTSIDE_RADIUS_ID,
          name: "Outside Burning radius",
          position: { x: 5, y: 0 },
          hitboxRadius: 0,
        },
        {
          id: UNRESOLVED_POSITION_ID,
          name: "Unresolved position",
          hitboxRadius: 0,
        },
      ],
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "burning-driver",
        name: "Burning callback driver",
        element: "pyro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0,
          em: 100,
          reactionBonus: 0.2,
        },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v9" },
    targetClockModel: { mode: "disabled" },
    targetTaskModel: { mode: "target-phase-v3" },
    reactionDeliveryModel: {
      mode: "deferred-event-heap-v1",
    },
    electroChargedPropagationModel: {
      mode: "nearby-wet-radius-v1",
      radius: 3,
      verificationStatus: "provisional",
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "burning-driver",
      swapFrames: 1,
      abilities: [
        {
          id: "start-burning",
          actorId: "burning-driver",
          name: "Start Burning",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "start-burning-hit",
              label: "Start Burning hit",
              frame: 0,
              scaling: 0,
              element: "pyro",
              targeting: {
                targetId: OWNER_ID,
                outcome: "landed",
              },
              application: {
                gaugeUnits: 1,
                icd: { mode: "no-icd-v1" },
              },
            },
          ],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "burning-driver",
          abilityId: "start-burning",
          atFrame: 0,
        },
      ],
    },
  };
}

function requireOne<T>(values: T[], description: string): T {
  if (values.length !== 1) {
    throw new Error(
      `Expected exactly one ${description}; received ${values.length}.`,
    );
  }
  return values[0]!;
}

function projectHit(entry: HitResolutionLogEntry) {
  return {
    id: entry.id,
    frame: entry.frame,
    eventPriority: entry.eventPriority ?? null,
    eventSequence: entry.eventSequence ?? null,
    intraEventSequence: entry.intraEventSequence ?? null,
    sourceActorId: entry.sourceActorId,
    sourceActionId: entry.sourceActionId,
    hitId: entry.hitId,
    targetIndex: entry.targetIndex,
    targetCount: entry.targetCount,
    targetId: entry.targetId,
    targetingSource: entry.targetingSource,
    resolutionKind: entry.resolutionKind,
    targetPosition: entry.targetPosition,
    geometryKind: entry.geometryKind,
    geometryRadius: entry.geometryRadius,
    outcome: entry.outcome,
    landed: entry.landed,
    reason: entry.reason,
    targetEffectSource: entry.targetEffectSource,
    damageEventId: entry.damageEventId,
    finalDamage: entry.finalDamage,
    displayDamage: entry.displayDamage,
  };
}

function projectDamage(entry: DamageEvent) {
  return {
    id: entry.id,
    kind: entry.kind,
    frame: entry.frame,
    eventPriority: entry.eventPriority,
    eventSequence: entry.eventSequence,
    parentDamageEventId: entry.parentDamageEventId,
    sourceActorId: entry.sourceActorId,
    actionId: entry.actionId,
    hitId: entry.hitId,
    targetResolutionId: entry.targetResolutionId,
    targetId: entry.targetId,
    element: entry.element,
    reaction: entry.reaction,
    reactionAudit: {
      reaction: entry.reactionAudit.reaction,
      reactions: entry.reactionAudit.reactions,
      auraBefore: entry.reactionAudit.auraBefore,
      auraApplied: entry.reactionAudit.auraApplied,
      auraConsumed: entry.reactionAudit.auraConsumed,
      auraAfter: entry.reactionAudit.auraAfter,
    },
    damageComposition: entry.damageComposition,
    finalDamage: entry.finalDamage,
    displayDamage: entry.displayDamage,
  };
}

function projectTimelinePoint(entry: TargetStateTimelinePoint) {
  return {
    id: entry.id,
    frame: entry.frame,
    targetFrame: entry.targetFrame ?? null,
    targetId: entry.targetId,
    pointKind: entry.pointKind,
    cause: entry.cause,
    eventType: entry.eventType,
    eventPriority: entry.eventPriority,
    eventSequence: entry.eventSequence,
    intraEventSequence: entry.intraEventSequence,
    reaction: entry.reaction,
    reactions: entry.reactions,
    primaryDamageEventId: entry.primaryDamageEventId,
    links: entry.links,
    auraBefore: entry.auraBefore,
    auraApplied: entry.auraApplied,
    auraConsumed: entry.auraConsumed,
    auraAfter: entry.auraAfter,
  };
}

function projectAttemptWireToFrozenV144(attempt: TargetPhaseV3DeliveryAttempt) {
  const {
    elementalApplicationIcdLogId: _elementalApplicationIcdLogId,
    ...frozenAttempt
  } = attempt;
  return frozenAttempt;
}

function projectDeliveryToFrozenV144<
  T extends { attempts: TargetPhaseV3DeliveryAttempt[] },
>(delivery: T) {
  return {
    ...delivery,
    attempts: delivery.attempts.map(projectAttemptWireToFrozenV144),
  };
}

function projectReactionDamageToFrozenV144(
  entry: SimulationResult["reactionDamageLog"][number],
) {
  const {
    hitResolutionLogIds: _hitResolutionLogIds,
    elementalApplicationIcdLogIds: _elementalApplicationIcdLogIds,
    damageGroupDecisions,
    ...frozenEntry
  } = entry;
  return {
    ...frozenEntry,
    damageGroupDecisions: damageGroupDecisions.map((decision) => ({
      reaction: decision.reaction,
      sourceActorId: decision.sourceActorId,
      targetId: decision.targetId,
      windowStartFrame: decision.windowStartFrame,
      hitIndex: decision.hitIndex,
      resetFrames: 30 as const,
      sequence:
        decision.icdGroup === "reaction-a"
          ? ([true, true, false] as const)
          : ([true, false] as const),
      damageAllowed: decision.damageAllowed,
      blockedReason: decision.blockedReason,
    })),
  };
}

function projectAttempt(
  result: SimulationResult,
  attempt: TargetPhaseV3DeliveryAttempt,
) {
  const hit =
    attempt.hitResolutionLogId === null
      ? null
      : result.hitResolutionLog[attempt.hitResolutionLogId];
  const damage =
    attempt.damageEventId === null
      ? null
      : result.damageEvents[attempt.damageEventId];
  const timelinePoint =
    attempt.targetStateTimelinePointId === null
      ? null
      : result.targetStateTimeline.points[attempt.targetStateTimelinePointId];
  if (
    (attempt.hitResolutionLogId !== null && hit === undefined) ||
    (attempt.damageEventId !== null && damage === undefined) ||
    (attempt.targetStateTimelinePointId !== null && timelinePoint === undefined)
  ) {
    throw new Error(
      `Burning callback attempt ${attempt.order} has a dangling reference.`,
    );
  }
  return {
    attempt: projectAttemptWireToFrozenV144(attempt),
    hit: hit === null || hit === undefined ? null : projectHit(hit),
    damage:
      damage === null || damage === undefined ? null : projectDamage(damage),
    targetStateTimelinePoint:
      timelinePoint === null || timelinePoint === undefined
        ? null
        : projectTimelinePoint(timelinePoint),
  };
}

/** Only genuine pre-marker historical input may enter the frozen 1.44 projection.
 * The current canonical identity is validated separately, never relabelled.
 */
function projectHistoricalConfigToFrozenV144(config: SimConfig): SimConfigV144 {
  const {
    reactionFormulaModel: _reactionFormulaModel,
    directDamageGroupModel: _directDamageGroupModel,
    elementalApplicationIcdModel: _elementalApplicationIcdModel,
    reactionOwnedElementalApplicationModel:
      _reactionOwnedElementalApplicationModel,
    reactionDamageGroupModel: _reactionDamageGroupModel,
    basicReactionSchedulerModel: _basicReactionSchedulerModel,
    freezeBrokenAttackModel: _freezeBrokenAttackModel,
    callbackBusModel: _callbackBusModel,
    ...frozenCommon
  } = config;
  const legacyWire = structuredClone(frozenCommon);
  const startBurningHit = legacyWire.timeline?.abilities[0]?.hits?.[0];
  if (startBurningHit === undefined) {
    throw new Error(
      "Burning callback Golden projection requires its configured starter hit.",
    );
  }
  (
    startBurningHit as unknown as {
      application: unknown;
    }
  ).application = {
    gaugeUnits: 1,
    icdTag: "start-burning",
    icdGroup: "no-icd",
  };
  return simConfigV144Schema.parse({
    ...legacyWire,
    schemaVersion: BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
    engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  });
}

function projectHistoricalManifestToFrozenV144(
  result: SimulationResult,
  frozenConfig: SimConfigV144,
): SimulationRunManifestV144 {
  const identity = {
    version: LEGACY_SIMULATION_RUN_MANIFEST_VERSION,
    identityAlgorithm: result.runManifest.identityAlgorithm,
    schemaVersion: BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
    engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
    dataVersion: result.runManifest.dataVersion,
    configHash: createSimulationConfigHash(frozenConfig),
    resolvedRuntimeOptions: result.runManifest.resolvedRuntimeOptions,
    plugins: result.runManifest.plugins,
  } satisfies Omit<SimulationRunManifestV144, "reproducibilityKey">;
  return simulationRunManifestV144Schema.parse({
    ...identity,
    reproducibilityKey: createSimulationReproducibilityKey(identity),
  });
}

function projectBurningCallbackScenario(result: SimulationResult) {
  const frozenConfig = projectHistoricalConfigToFrozenV144(result.config);
  const frozenManifest = projectHistoricalManifestToFrozenV144(
    result,
    frozenConfig,
  );
  const ownerPhase = requireOne(
    result.targetPhaseLog.filter(
      (phase): phase is TargetPhaseV3LogEntry =>
        phase.model === "target-phase-v3" &&
        phase.targetId === OWNER_ID &&
        phase.globalFrame === 15,
    ),
    "F15 Burning owner phase",
  );
  const ownerTask = requireOne(
    ownerPhase.targetTasks.filter(
      (task) =>
        task.kind === "burning-tick" &&
        task.tickIndex === 1 &&
        task.delivery !== null,
    ),
    "F15 Burning callback task",
  );
  if (ownerTask.delivery === null) {
    throw new Error("F15 Burning callback task must own a delivery.");
  }
  const delivery = ownerTask.delivery;
  const frozenDelivery = projectDeliveryToFrozenV144(delivery);
  const burningState =
    ownerTask.burningStateLogId === null
      ? undefined
      : result.burningStateLog[ownerTask.burningStateLogId];
  if (burningState === undefined) {
    throw new Error(
      "F15 Burning callback task has a dangling burningStateLogId.",
    );
  }
  const rootReactionDamage =
    result.reactionDamageLog[delivery.reactionDamageLogId];
  if (rootReactionDamage === undefined) {
    throw new Error("Burning delivery has a dangling reactionDamageLogId.");
  }
  const rootDamageEvents = rootReactionDamage.damageEventIds.map((id) => {
    const entry = result.damageEvents[id];
    if (entry === undefined) {
      throw new Error(`Root Burning damageEventId ${id} is dangling.`);
    }
    return projectDamage(entry);
  });
  const overload = requireOne(
    result.reactionDamageLog.filter(
      (entry) =>
        entry.reaction === "overload" &&
        entry.triggerFrame === 15 &&
        entry.damageFrame === 16,
    ),
    "F16 nested Overload delivery",
  );
  const overloadTrigger =
    overload.triggerDamageEventId === null
      ? undefined
      : result.damageEvents[overload.triggerDamageEventId];
  if (overloadTrigger === undefined) {
    throw new Error(
      "Nested Overload must backlink to its F15 root damage event.",
    );
  }
  const overloadDamageEvents = overload.damageEventIds.map((id) => {
    const entry = result.damageEvents[id];
    if (entry === undefined) {
      throw new Error(`Nested Overload damageEventId ${id} is dangling.`);
    }
    return projectDamage(entry);
  });
  const overloadHitResolutionRows = overload.damageEventIds.map((id) => {
    const damage = result.damageEvents[id]!;
    const hit = result.hitResolutionLog[damage.targetResolutionId];
    if (hit === undefined) {
      throw new Error(
        `Nested Overload targetResolutionId ${damage.targetResolutionId} is dangling.`,
      );
    }
    return projectHit(hit);
  });
  const overloadTimelinePoints = overload.damageEventIds.map((id) => {
    const point = requireOne(
      result.targetStateTimeline.points.filter(
        (candidate) => candidate.primaryDamageEventId === id,
      ),
      `nested Overload timeline point for damage ${id}`,
    );
    return projectTimelinePoint(point);
  });
  const damageByReaction = result.damageEvents.reduce<Record<string, number>>(
    (totals, entry) => {
      totals[entry.reaction] =
        (totals[entry.reaction] ?? 0) + entry.finalDamage;
      return totals;
    },
    {},
  );
  const lastCurvePoint = result.damageCurve.at(-1);

  return {
    identity: {
      schemaVersion: frozenManifest.schemaVersion,
      engineVersion: frozenManifest.engineVersion,
      dataVersion: result.dataVersion,
      randomSeed: result.randomSeed,
      configHash: frozenManifest.configHash,
      reproducibilityKey: frozenManifest.reproducibilityKey,
      runManifest: frozenManifest,
      resolvedRuntimeOptions: result.resolvedRuntimeOptions,
      compatibilityMode: result.compatibilityMode,
      mechanicsStatus: result.mechanicsStatus,
      configSemanticHash: semanticHash(frozenConfig),
    },
    config: frozenConfig,
    callback: {
      ownerPhase: {
        id: ownerPhase.id,
        model: ownerPhase.model,
        targetId: ownerPhase.targetId,
        globalFrame: ownerPhase.globalFrame,
        targetFrame: ownerPhase.targetFrame,
        targetOrder: ownerPhase.targetOrder,
        auraBeforeTargetTasks: ownerPhase.auraBeforeTargetTasks,
        auraAfterTargetTasks: ownerPhase.auraAfterTargetTasks,
        reactableTick: ownerPhase.reactableTick,
        hitResolutionLogIds: ownerPhase.hitResolutionLogIds,
        reactionTaskLogIds: ownerPhase.reactionTaskLogIds,
      },
      ownerTask: {
        ...ownerTask,
        delivery: frozenDelivery,
      },
      delivery: frozenDelivery,
      burningState,
      rootReactionDamage: projectReactionDamageToFrozenV144(rootReactionDamage),
      attempts: delivery.attempts.map((attempt) =>
        projectAttempt(result, attempt),
      ),
      rootDamageEvents,
    },
    nestedOverload: {
      reactionDamage: projectReactionDamageToFrozenV144(overload),
      triggerDamageEvent: projectDamage(overloadTrigger),
      hitResolutionRows: overloadHitResolutionRows,
      damageEvents: overloadDamageEvents,
      targetStateTimelinePoints: overloadTimelinePoints,
      owningTargetPhases: result.targetPhaseLog
        .filter(
          (phase): phase is TargetPhaseV3LogEntry =>
            phase.model === "target-phase-v3" && phase.globalFrame === 16,
        )
        .map((phase) => ({
          id: phase.id,
          targetId: phase.targetId,
          targetOrder: phase.targetOrder,
          hitResolutionLogIds: phase.hitResolutionLogIds,
          reactionTaskLogIds: phase.reactionTaskLogIds,
        })),
    },
    damageCurve: result.damageCurve,
    summary: {
      totalDamage: result.totalDamage,
      dps: result.dps,
      displayDamageTotal: result.damageEvents.reduce(
        (sum, entry) => sum + entry.displayDamage,
        0,
      ),
      damageEventCount: result.damageEvents.length,
      hitResolutionCount: result.hitResolutionLog.length,
      reactedHits: result.reactedHits,
      skippedActionCount: result.skippedActions.length,
      byCharacter: result.byCharacter,
      bySkill: result.bySkill,
      targetSummaries: result.targetSummaries,
      damageByReaction,
      damageCurveEnd:
        lastCurvePoint === undefined
          ? null
          : {
              damageEventId: lastCurvePoint.damageEventId,
              frame: lastCurvePoint.frame,
              cumulativeDamage: lastCurvePoint.cumulativeDamage,
              cumulativeByComponent: lastCurvePoint.cumulativeByComponent,
              cumulativeByReaction: lastCurvePoint.cumulativeByReaction,
            },
    },
  };
}

type BurningCallbackGoldenScenario = ReturnType<
  typeof projectBurningCallbackScenario
>;

interface BurningCallbackGoldenFixture {
  fixtureVersion: "burning-callback-delivery-1.44";
  description: string;
  provenance: {
    mechanicsDataStatus: "fixed-gcsim-provisional";
    referenceProject: "genshinsim/gcsim";
    referenceCommit: "ef41805d855a60b9e1035293584b85c085dc69e7";
    officialServerTruth: false;
    completeGcsimParity: false;
    capturedAt: "2026-07-31";
    scope: string;
    limitations: string[];
  };
  commonConfig: {
    schemaVersion: typeof BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION;
    engineVersion: typeof BURNING_CALLBACK_DELIVERY_ENGINE_VERSION;
    reactionEngine: { mode: "aura-v9" };
    targetClockModel: { mode: "disabled" };
    targetTaskModel: { mode: "target-phase-v3" };
    reactionDeliveryModel: {
      mode: "deferred-event-heap-v1";
    };
    timeline: { mode: "legal-frame-v1"; fps: 60 };
  };
  scenario: BurningCallbackGoldenScenario;
  scenarioSha256: string;
}

function semanticHash(value: unknown): string {
  return createHash("sha256").update(canonicalStringify(value)).digest("hex");
}

function serializeJsonFixture(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function byteSha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function atomicCreateJsonFixture(outputUrl: URL, value: unknown): void {
  const outputPath = fileURLToPath(outputUrl);
  const temporaryPath = `${outputPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporaryPath, serializeJsonFixture(value), { flag: "wx" });
  try {
    linkSync(temporaryPath, outputPath);
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      throw new Error(`Refusing to overwrite frozen fixture ${outputPath}.`);
    }
    throw error;
  } finally {
    unlinkSync(temporaryPath);
  }
}

function expectCallbackBacklinks(
  scenario: BurningCallbackGoldenScenario,
): void {
  const { callback, nestedOverload } = scenario;
  expect(callback.ownerTask.delivery).toEqual(callback.delivery);
  expect(callback.ownerTask.burningStateLogId).toBe(callback.burningState.id);
  expect(callback.burningState.reactionDamageLogId).toBe(
    callback.rootReactionDamage.id,
  );
  expect(callback.delivery.reactionDamageLogId).toBe(
    callback.rootReactionDamage.id,
  );
  expect(callback.rootReactionDamage.damageEventIds).toEqual(
    callback.rootDamageEvents.map((entry) => entry.id),
  );
  expect(
    callback.attempts.map(({ attempt }) => ({
      order: attempt.order,
      targetId: attempt.targetId,
      targetOrder: attempt.targetOrder,
      applicationPhase: attempt.applicationPhase,
      outcome: attempt.outcome,
    })),
  ).toEqual([
    {
      order: 0,
      targetId: ELECTRO_RECIPIENT_ID,
      targetOrder: 0,
      applicationPhase: "after-reactable-tick",
      outcome: "landed",
    },
    {
      order: 1,
      targetId: OWNER_ID,
      targetOrder: 1,
      applicationPhase: "before-reactable-tick",
      outcome: "landed",
    },
    {
      order: 2,
      targetId: PLAIN_RECIPIENT_ID,
      targetOrder: 2,
      applicationPhase: "before-reactable-tick",
      outcome: "landed",
    },
    {
      order: 3,
      targetId: OUTSIDE_RADIUS_ID,
      targetOrder: 3,
      applicationPhase: "before-reactable-tick",
      outcome: "miss",
    },
    {
      order: 4,
      targetId: UNRESOLVED_POSITION_ID,
      targetOrder: 4,
      applicationPhase: "before-reactable-tick",
      outcome: "unresolved",
    },
  ]);
  for (const projected of callback.attempts) {
    const { attempt, hit, damage, targetStateTimelinePoint } = projected;
    if (attempt.outcome === "landed") {
      expect(hit?.id).toBe(attempt.hitResolutionLogId);
      expect(hit?.damageEventId).toBe(attempt.damageEventId);
      expect(damage?.id).toBe(attempt.damageEventId);
      expect(damage?.targetResolutionId).toBe(attempt.hitResolutionLogId);
      expect(targetStateTimelinePoint?.id).toBe(
        attempt.targetStateTimelinePointId,
      );
      expect(targetStateTimelinePoint?.primaryDamageEventId).toBe(
        attempt.damageEventId,
      );
      expect(targetStateTimelinePoint?.links).toContainEqual({
        kind: "reaction-damage-log",
        id: callback.rootReactionDamage.id,
      });
    } else if (attempt.outcome === "miss") {
      expect(hit?.id).toBe(attempt.hitResolutionLogId);
      expect(hit?.outcome).toBe("miss");
      expect(damage).toBeNull();
      expect(targetStateTimelinePoint).toBeNull();
    } else {
      expect(hit).toBeNull();
      expect(damage).toBeNull();
      expect(targetStateTimelinePoint).toBeNull();
    }
  }
  expect(nestedOverload.reactionDamage).toMatchObject({
    reaction: "overload",
    triggerFrame: 15,
    damageFrame: 16,
    scheduled: true,
    withinSimulation: true,
  });
  expect(nestedOverload.reactionDamage.triggerDamageEventId).toBe(
    nestedOverload.triggerDamageEvent.id,
  );
  expect(nestedOverload.triggerDamageEvent.targetId).toBe(ELECTRO_RECIPIENT_ID);
  expect(nestedOverload.triggerDamageEvent.frame).toBe(15);
  expect(nestedOverload.damageEvents).not.toHaveLength(0);
  expect(nestedOverload.damageEvents.map((entry) => entry.frame)).toEqual(
    nestedOverload.damageEvents.map(() => 16),
  );
  expect(
    nestedOverload.targetStateTimelinePoints.map(
      (entry) => entry.primaryDamageEventId,
    ),
  ).toEqual(nestedOverload.reactionDamage.damageEventIds);
  expect(
    nestedOverload.owningTargetPhases.flatMap(
      (phase) => phase.hitResolutionLogIds,
    ),
  ).toEqual(
    expect.arrayContaining(
      nestedOverload.hitResolutionRows.map((entry) => entry.id),
    ),
  );
}

function expectHistoricalBurningGolden(): void {
  const first = historicalBurningResult();
  const repeated = historicalBurningResult();
  expect(repeated).toStrictEqual(first);
  expect(simulationResultSchema.parse(first)).toEqual(first);
  expect(assertTrustedSimulationResult(first)).toBe(first);
  const frozenV149TargetPhaseFacet = projectSimulationResultV150ToV149(
    projectSimulationResultV151ToV150(
      projectSimulationResultV152ToV151(
        projectSimulationResultV153ToV152(first),
      ),
    ),
  );
  expect(
    targetPhaseV3ResultReferencesSchema.safeParse(frozenV149TargetPhaseFacet)
      .success,
  ).toBe(true);

  const scenario = projectBurningCallbackScenario(first);
  const generated: BurningCallbackGoldenFixture = {
    fixtureVersion: "burning-callback-delivery-1.44",
    description:
      "Deterministic exact-1.44 target-phase-v3 Golden for synchronous multi-target Burning callback delivery and a positive-delay nested Overload child.",
    provenance: {
      mechanicsDataStatus: "fixed-gcsim-provisional",
      referenceProject: "genshinsim/gcsim",
      referenceCommit: "ef41805d855a60b9e1035293584b85c085dc69e7",
      officialServerTruth: false,
      completeGcsimParity: false,
      capturedAt: "2026-07-31",
      scope:
        "Burning owner callback order, explicit cross-target delivery attempts, cross-log backlinks, and separation of zero-delay callback work from positive-delay child reactions.",
      limitations: [
        "This fixture is fixed-code regression evidence, not an official server measurement.",
        "The pinned gcsim reference informs the provisional callback boundary; this fixture does not claim complete gcsim or game-mechanics parity.",
        "Only the modeled Aura-v9, target-phase-v3, and deferred positive-delay delivery boundary is frozen here.",
      ],
    },
    commonConfig: {
      schemaVersion: BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
      engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
      reactionEngine: { mode: "aura-v9" },
      targetClockModel: { mode: "disabled" },
      targetTaskModel: { mode: "target-phase-v3" },
      reactionDeliveryModel: {
        mode: "deferred-event-heap-v1",
      },
      timeline: { mode: "legal-frame-v1", fps: 60 },
    },
    scenario,
    scenarioSha256: semanticHash(scenario),
  };
  const updateRequested = process.env[UPDATE_FLAG] === "1";
  const generatedBytes = serializeJsonFixture(generated);
  const frozenBytes = updateRequested
    ? generatedBytes
    : readFileSync(FIXTURE_URL, "utf8");
  const fixture = updateRequested
    ? generated
    : (JSON.parse(frozenBytes) as BurningCallbackGoldenFixture);

  expect(fixture).toStrictEqual(generated);
  expect(fixture.provenance).toMatchObject({
    mechanicsDataStatus: "fixed-gcsim-provisional",
    referenceCommit: "ef41805d855a60b9e1035293584b85c085dc69e7",
    officialServerTruth: false,
    completeGcsimParity: false,
  });
  expect(semanticHash(fixture.scenario)).toBe(fixture.scenarioSha256);
  expect(fixture.scenario.identity).toMatchObject({
    schemaVersion: "1.44.0",
    engineVersion: "1.44.0-burning-callback-delivery",
    dataVersion: "burning-callback-delivery-provisional-1",
    randomSeed: "burning-callback-delivery-golden-seed",
  });
  expectCallbackBacklinks(fixture.scenario);
  expect(fixture.scenario.summary.damageCurveEnd).toMatchObject({
    cumulativeDamage: fixture.scenario.summary.totalDamage,
  });
  expect(
    byteSha256(generatedBytes),
    "generated Burning callback fixture bytes",
  ).toBe(FROZEN_FIXTURE_SHA256);
  expect(
    byteSha256(frozenBytes),
    "frozen Burning callback fixture bytes",
  ).toBe(FROZEN_FIXTURE_SHA256);

  if (updateRequested) {
    atomicCreateJsonFixture(FIXTURE_URL, generated);
  }
}

const historicalBurningBytes = readFileSync(new URL(
  "../../../test-vectors/src/fixtures/historical-burning-callback-v153-84ff5cd.json", import.meta.url,
));
const historicalBurningArchive = JSON.parse(historicalBurningBytes.toString("utf8")) as {
  fixtureVersion: string; source: { commit: string }; sourceWireSha256: string; sourceWireText: string;
};
function historicalBurningResult(): SimulationResult {
  expect(byteSha256(historicalBurningArchive.sourceWireText)).toBe(historicalBurningArchive.sourceWireSha256);
  const result = JSON.parse(historicalBurningArchive.sourceWireText) as SimulationResult;
  expect(result.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(result.runManifest.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(simulationResultSchema.parse(result)).toEqual(result);
  expect(assertTrustedSimulationResult(result)).toBe(result);
  return result;
}

function burningMechanics(result: SimulationResult) {
  const { runManifest: _manifest, resolvedRuntimeOptions: _options, reproducibilityKey: _key, ...mechanics } = result;
  return mechanics;
}
function currentBurningDeliveries(result: SimulationResult): Array<{
  phase: TargetPhaseV3LogEntry; task: TargetPhaseV3TargetTask; delivery: TargetPhaseV3Delivery;
}> {
  return result.targetPhaseLog.flatMap((phase) => phase.model !== "target-phase-v3" ? []
    : phase.targetTasks.flatMap((task) => task.kind !== "burning-tick" || task.delivery === null ? []
      : [{ phase, task, delivery: task.delivery }]));
}

function expectCurrentBurningContract(result: SimulationResult): void {
  const before = JSON.stringify(result);
  const historical = historicalBurningResult();
  expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  expect(result.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  expect(result.resolvedRuntimeOptions).toEqual({ ...historical.resolvedRuntimeOptions, flatStatBuffSemantics: "canonical-v1" });
  expect(result.runManifest.resolvedRuntimeOptions).toEqual(result.resolvedRuntimeOptions);
  expect(result.runManifest.reproducibilityKey).toBe(result.reproducibilityKey);
  expect(result.reproducibilityKey).not.toBe(historical.reproducibilityKey);
  const { reproducibilityKey: _oldKey, resolvedRuntimeOptions: _oldOptions, ...oldManifest } = historical.runManifest;
  const { reproducibilityKey: _key, resolvedRuntimeOptions: _options, ...manifest } = result.runManifest;
  expect(manifest).toEqual(oldManifest);
  expect(simulationResultSchema.parse(JSON.parse(before))).toEqual(result);
  expect(assertTrustedSimulationResult(result)).toBe(result);

  // Full expected mechanics, not a wire converter. The only changed causal
  // field is this exact starter application substep; hit resolution owns I0.
  // All queues, callbacks, attempts, clock fields, IDs and backlinks stay exact.
  const expected = structuredClone(burningMechanics(historical));
  expect(expected.hitResolutionLog[0]).toMatchObject({ id: 0, frame: 0, eventPriority: 3,
    eventSequence: 1, intraEventSequence: 0, targetId: OWNER_ID, damageEventId: 0 });
  const starter = expected.targetStateTimeline.points[5]!;
  expect(starter).toMatchObject({ id: 5, frame: 0, cause: "direct-hit-application", eventType: "hit",
    targetId: OWNER_ID, eventPriority: 3, eventSequence: 1, intraEventSequence: 0, primaryDamageEventId: 0 });
  expect(expected.targetStateTimeline.points.filter((point) => point.cause === "direct-hit-application").map((point) => point.id)).toEqual([5]);
  starter.intraEventSequence = 1;
  expect(burningMechanics(result)).toStrictEqual(expected);

  // Independent fixed-profile level90 / EM100 / bonus20% / resistance10%
  // arithmetic. Transformative damage ignores DEF and never crits.
  const masteryBonus = 16 * 100 / (100 + 2000);
  const burningDamage = 1446.8535 * 0.25 * (1 + masteryBonus + 0.2) * 0.9;
  const overloadDamage = 1446.8535 * 2.75 * (1 + masteryBonus + 0.2) * 0.9;
  const burning = result.damageEvents.filter((event) => event.kind === "transformative-reaction" && event.reaction === "burning");
  const overload = result.damageEvents.filter((event) => event.reaction === "overload");
  expect(burning).toHaveLength(12);
  expect(overload).toHaveLength(3);
  expect(result.damageEvents).toHaveLength(16);
  expect(result.damageEvents[0]).toMatchObject({ id: 0, frame: 0, kind: "direct", finalDamage: 0, targetId: OWNER_ID });
  expect(burning.map((event) => event.frame)).toEqual([15, 15, 15, 30, 30, 30, 45, 45, 45, 60, 60, 60]);
  expect(overload.map((event) => event.frame)).toEqual([16, 16, 16]);
  for (const [events, damage] of [[burning, burningDamage], [overload, overloadDamage]] as const) {
    events.forEach((event, index) => {
      expect(event.targetId).toBe([ELECTRO_RECIPIENT_ID, OWNER_ID, PLAIN_RECIPIENT_ID][index % 3]);
      expect([event.sourceActorId, event.scalingOwnerId, event.creditOwnerId]).toEqual(Array(3).fill("burning-driver"));
      expect(event.finalDamage).toBeCloseTo(damage, 10);
      expect(event.displayDamage).toBe(Math.round(damage));
    });
  }
  const total = 12 * burningDamage + 3 * overloadDamage;
  expect(result.totalDamage).toBeCloseTo(total, 9);
  expect(result.dps).toBeCloseTo(total, 9);
  expect(result.byCharacter["burning-driver"]).toBeCloseTo(total, 9);
  expect(result.damageCurve.at(-1)!.cumulativeDamage).toBeCloseTo(total, 9);

  const deliveries = currentBurningDeliveries(result);
  expect(deliveries.map(({ phase }) => phase.globalFrame)).toEqual([15, 30, 45, 60]);
  expect(deliveries.map(({ task }) => task.eventSequence)).toEqual([7, 11, 24, 31]);
  expect(deliveries.map(({ delivery }) => delivery.eventSequence)).toEqual([10, 23, 30, 37]);
  const callbackHitIds: number[] = [];
  for (const [index, { phase, task, delivery }] of deliveries.entries()) {
    const frame = 15 * (index + 1);
    const damageIds = [1, 7, 10, 13][index]!;
    const reactionId = [0, 2, 3, 4][index]!;
    expect(phase).toMatchObject({ targetId: OWNER_ID, targetOrder: 1, targetFrame: frame });
    expect(task).toMatchObject({ status: "applied", generation: 1, tickIndex: index + 1, deadlineTargetFrame: frame });
    // Owner registration index1 among five targets; root runs between its
    // callback and its Reactable.Tick boundary, never as a later P5 task.
    const ownerPriority = 0.5 + 0.5 / 6;
    expect(task.eventPriority).toBe(ownerPriority);
    expect(delivery.eventPriority).toBe(ownerPriority + (0.5 / 6) * 0.25);
    expect(delivery).toMatchObject({ model: "burning-callback-zero-delay-v1", reactionDamageLogId: reactionId });
    expect(delivery.attempts.map((attempt) => [attempt.order, attempt.targetId, attempt.targetOrder, attempt.applicationPhase, attempt.outcome])).toEqual([
      [0, ELECTRO_RECIPIENT_ID, 0, "after-reactable-tick", "landed"],
      [1, OWNER_ID, 1, "before-reactable-tick", "landed"],
      [2, PLAIN_RECIPIENT_ID, 2, "before-reactable-tick", "landed"],
      [3, OUTSIDE_RADIUS_ID, 3, "before-reactable-tick", "miss"],
      [4, UNRESOLVED_POSITION_ID, 4, "before-reactable-tick", "unresolved"],
    ]);
    expect(result.reactionDamageLog[reactionId]).toMatchObject({ id: reactionId, reaction: "burning", damageFrame: frame,
      triggerDamageEventId: index === 0 ? 0 : 2, damageEventIds: [damageIds, damageIds + 1, damageIds + 2] });
    const state = result.burningStateLog[task.burningStateLogId!]!;
    expect(state).toMatchObject({ operation: "tick", frame, reactionDamageLogId: reactionId, fuelDecayPerFrame: 0.4 / 60,
      fuelExpiresAtFrame: 121, nextTickFrame: frame + 15, applicationAllowed: index === 0 });
    // Aura fuel skips decay through attachmentFrame+1 (here F1); this
    // callback observes F−1 before Reactable.Tick advances through F. Thus
    // fuel has F−2 then F−1 decay steps, while existing Dendro has F steps.
    expect(state.fuelGaugeUnitsBefore).toBeCloseTo(0.8 - (frame - 2) * 0.4 / 60, 10);
    expect(state.fuelGaugeUnitsAfter).toBe(state.fuelGaugeUnitsBefore);
    expect(phase.reactableTick.auraAfter.find((entry) => entry.element === "burningFuel")!.gaugeUnits)
      .toBeCloseTo(0.8 - (frame - 1) * 0.4 / 60, 10);
    expect(phase.reactableTick.auraAfter.find((entry) => entry.element === "dendro")!.gaugeUnits)
      .toBeCloseTo(0.8 - frame * 0.4 / 60, 10);
    for (const attempt of delivery.attempts) {
      if (attempt.outcome === "unresolved") {
        expect([attempt.hitResolutionLogId, attempt.damageEventId, attempt.elementalApplicationIcdLogId, attempt.targetStateTimelinePointId]).toEqual([null, null, null, null]);
        continue;
      }
      const hit = result.hitResolutionLog[attempt.hitResolutionLogId!]!;
      callbackHitIds.push(hit.id);
      expect(hit).toMatchObject({ frame, targetId: attempt.targetId, outcome: attempt.outcome, damageEventId: attempt.damageEventId });
      const application = result.elementalApplicationIcdLog[attempt.elementalApplicationIcdLogId!]!;
      expect(application).toMatchObject({ sourceKind: "burning-tick", reactionDamageLogId: reactionId,
        hitResolutionLogId: hit.id, damageEventId: attempt.damageEventId, targetId: attempt.targetId,
        frame, eventSequence: delivery.eventSequence, deliveryPhase: attempt.applicationPhase });
      if (attempt.outcome === "miss") {
        expect([attempt.damageEventId, attempt.targetStateTimelinePointId]).toEqual([null, null]);
        continue;
      }
      expect(application).toMatchObject({ effectiveGaugeUnits: index === 0 ? 1 : 0, decision: { allowed: index === 0 } });
      expect(result.damageEvents[attempt.damageEventId!]!).toMatchObject({ targetId: attempt.targetId, targetResolutionId: hit.id,
        frame, eventPriority: delivery.eventPriority, eventSequence: delivery.eventSequence });
      const point = result.targetStateTimeline.points[attempt.targetStateTimelinePointId!]!;
      expect(point).toMatchObject({ frame, targetId: attempt.targetId, primaryDamageEventId: attempt.damageEventId,
        eventPriority: delivery.eventPriority, eventSequence: delivery.eventSequence, intraEventSequence: attempt.order });
      expect(point.links).toContainEqual({ kind: "reaction-damage-log", id: reactionId });
      expect(point.links).toContainEqual({ kind: "damage-event", id: attempt.damageEventId });
    }
  }
  const phaseOwnedHits = result.targetPhaseLog.flatMap((phase) => phase.hitResolutionLogIds);
  expect(phaseOwnedHits).toEqual([0, 5, 6, 7, 8]);
  expect(callbackHitIds.every((id) => !phaseOwnedHits.includes(id))).toBe(true);
  expect(result.reactionDamageLog[1]).toMatchObject({ id: 1, reaction: "overload", triggerDamageEventId: 1,
    triggerFrame: 15, damageFrame: 16, damageEventIds: [4, 5, 6] });
  expect(result.damageEvents[1]!.reactionAudit).toMatchObject({ reaction: "overload", auraAfter: [] });
  const consumed = result.damageEvents[1]!.reactionAudit.auraConsumed;
  if (consumed === null) throw new Error("The landed Burning callback must expose its Electro consumption audit");
  expect(consumed).toHaveLength(1);
  expect(consumed[0]!.element).toBe("electro");
  expect(consumed[0]!.gaugeUnits).toBeCloseTo(0.8 * (1 - 15 / 570), 10);
  expect(overload.map((event) => [event.parentDamageEventId, event.eventPriority, event.eventSequence])).toEqual([[1, 5, 17], [1, 5, 17], [1, 5, 17]]);
  expect(result.auraEndStates.find((entry) => entry.targetId === ELECTRO_RECIPIENT_ID)!.aura).toEqual([]);
  expect(JSON.stringify(result)).toBe(before);
}

const hostileBurningCases: Array<{ name: string; mutate: (result: SimulationResult) => void }> = [
  { name: "coordinated registration-order swap", mutate: (result) => {
    const attempts = currentBurningDeliveries(result)[0]!.delivery.attempts;
    [attempts[0], attempts[1]] = [attempts[1]!, attempts[0]!]; attempts[0]!.order = 0; attempts[1]!.order = 1;
  } },
  { name: "earlier recipient falsely claims pre-Reactable application", mutate: (result) => {
    currentBurningDeliveries(result)[0]!.delivery.attempts[0]!.applicationPhase = "before-reactable-tick";
  } },
  { name: "delivery queue detached from its root", mutate: (result) => { currentBurningDeliveries(result)[0]!.delivery.eventSequence += 1; } },
  { name: "dangling callback lifecycle row", mutate: (result) => { currentBurningDeliveries(result)[0]!.task.burningStateLogId = 999; } },
  { name: "recipient damage aliases owner damage", mutate: (result) => { currentBurningDeliveries(result)[0]!.delivery.attempts[0]!.damageEventId = 2; } },
  { name: "recipient ICD witness aliases owner witness", mutate: (result) => { currentBurningDeliveries(result)[0]!.delivery.attempts[0]!.elementalApplicationIcdLogId = 2; } },
  { name: "missing root timeline backlink", mutate: (result) => {
    result.targetStateTimeline.points[7]!.links = result.targetStateTimeline.points[7]!.links.filter((link) => link.kind !== "reaction-damage-log");
  } },
  { name: "positive-delay Overload collapses to callback frame", mutate: (result) => { result.reactionDamageLog[1]!.damageFrame = 15; } },
  { name: "Overload trigger aliases the owner instead of Electro recipient", mutate: (result) => { result.reactionDamageLog[1]!.triggerDamageEventId = 2; } },
  { name: "unresolved recipient forges a hit witness", mutate: (result) => { currentBurningDeliveries(result)[0]!.delivery.attempts[4]!.hitResolutionLogId = 4; } },
  { name: "outside-radius geometry falsely claims contact", mutate: (result) => { result.hitResolutionLog[4]!.geometryDistance = 0; } },
  { name: "recipient phase claims a callback-owned hit", mutate: (result) => {
    const phase = result.targetPhaseLog.find((entry) => entry.globalFrame === 15 && entry.targetId === ELECTRO_RECIPIENT_ID)!;
    phase.hitResolutionLogIds = [1];
  } },
];

describe("Burning callback delivery 1.44 Golden", () => {
  it("authentically freezes callback provenance, registration-order attempts, backlinks, F+1 Overload, and historical identity", expectHistoricalBurningGolden);
  it("pins original Golden bytes and genuine pre-marker source provenance", () => {
    expect(byteSha256(historicalBurningBytes)).toBe("1af808be55007b574469be930f10fe3e1208a4fb1d84e2bf8d79149b72cffb27");
    expect(historicalBurningArchive).toMatchObject({ fixtureVersion: "historical-burning-callback-v153-84ff5cd-v1",
      source: { commit: "84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5", tree: "72bd69a8c54a3e115685c7ee52f5862064c70f55" } });
    expect(byteSha256(readFileSync(FIXTURE_URL))).toBe(FROZEN_FIXTURE_SHA256);
  });
  it("refuses opt-in replacement of the existing frozen Golden", () => {
    const before = readFileSync(FIXTURE_URL);
    const previous = process.env[UPDATE_FLAG]; process.env[UPDATE_FLAG] = "1";
    try { expect(expectHistoricalBurningGolden).toThrow(/Refusing to overwrite frozen fixture/); }
    finally { if (previous === undefined) delete process.env[UPDATE_FLAG]; else process.env[UPDATE_FLAG] = previous; }
    expect(readFileSync(FIXTURE_URL)).toEqual(before);
  });
});

describe("current Burning callback contract", () => {
  it("preserves the full live wire, independent damage and Aura, callback ownership, and positive-delay child", () => {
    const config = makeBurningCallbackGoldenConfig();
    const result = simulate(config, { critMode: "noCrit" });
    expect(simulate(config, { critMode: "noCrit" })).toStrictEqual(result);
    expectCurrentBurningContract(result);
    // The frozen projector must continue rejecting the new identity marker.
    expect(() => projectSimulationResultV153ToV152(result)).toThrow(/flatStatBuffSemantics/);
  });
  it.each(hostileBurningCases)("rejects $name at public parsing and real capture import", ({ mutate }) => {
    const result = simulate(makeBurningCallbackGoldenConfig(), { critMode: "noCrit" });
    const before = JSON.stringify(result);
    expect(simulationResultSchema.parse(result)).toEqual(result);
    expect(assertTrustedSimulationResult(result)).toBe(result);
    const capture = { schemaVersion: "calculator-event-v1", eventId: 0, sourceResult: result };
    expect(parseSimulationHit(JSON.stringify(capture)).sourceResult).toEqual(result);
    const forged = structuredClone(result); mutate(forged);
    expect(JSON.stringify(forged)).not.toBe(before);
    const parsed = simulationResultSchema.safeParse(forged);
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Forged Burning callback result unexpectedly parsed");
    expect(() => parseSimulationHit(JSON.stringify({ ...capture, sourceResult: forged }))).toThrow(parsed.error.message);
    // The public ingress, not a trusted-only helper with internal preconditions,
    // owns validation of arbitrary JSON and all version-specific facets.
    expect(JSON.stringify(result)).toBe(before);
  });
});
