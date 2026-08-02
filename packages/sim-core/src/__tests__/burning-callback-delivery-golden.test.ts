import { createHash } from "node:crypto";
import { linkSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
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
  type TargetPhaseV3DeliveryAttempt,
  type TargetPhaseV3LogEntry,
  type TargetStateTimelinePoint,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID } from "@genshin-dps-lab/icd-profiles";
import { projectSimulationResultV150ToV149 } from "../../../test-vectors/src/project-v150-to-v149";
import { projectSimulationResultV151ToV150 } from "../../../test-vectors/src/project-v151-to-v150";
import { projectSimulationResultV152ToV151 } from "../../../test-vectors/src/project-v152-to-v151";
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

/**
 * The callback fixture is an exact 1.44 wire. Current simulations run under
 * 1.47 and bind all fixed mechanics profiles in config and run manifest, so
 * compare their unchanged callback semantics through an explicit frozen-1.44
 * identity projection instead of rewriting the historical fixture.
 */
function projectCurrentConfigToFrozenV144(config: SimConfig): SimConfigV144 {
  const {
    reactionFormulaModel: _reactionFormulaModel,
    directDamageGroupModel: _directDamageGroupModel,
    elementalApplicationIcdModel: _elementalApplicationIcdModel,
    reactionOwnedElementalApplicationModel:
      _reactionOwnedElementalApplicationModel,
    reactionDamageGroupModel: _reactionDamageGroupModel,
    basicReactionSchedulerModel: _basicReactionSchedulerModel,
    freezeBrokenAttackModel: _freezeBrokenAttackModel,
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

function projectCurrentManifestToFrozenV144(
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
  const frozenConfig = projectCurrentConfigToFrozenV144(result.config);
  const frozenManifest = projectCurrentManifestToFrozenV144(
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

function byteSha256(value: string): string {
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

describe("Burning callback delivery 1.44 Golden", () => {
  it("freezes callback provenance, registration-order attempts, backlinks, F+1 Overload, and deterministic identity", () => {
    const config = makeBurningCallbackGoldenConfig();
    const first = simulate(config, { critMode: "noCrit" });
    const repeated = simulate(config, {
      critMode: "noCrit",
    });
    expect(repeated).toStrictEqual(first);
    expect(simulationResultSchema.parse(first)).toEqual(first);
    expect(assertTrustedSimulationResult(first)).toBe(first);
    const frozenV149TargetPhaseFacet = projectSimulationResultV150ToV149(
      projectSimulationResultV151ToV150(
        projectSimulationResultV152ToV151(first),
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
  });
});
