import { z, type RefinementCtx } from "zod";
import { canonicalStringify } from "./reproducibility";
import {
  BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
  DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
  DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
  ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION,
  ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
  REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION,
  REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
  REACTION_FORMULA_ROOT_ENGINE_VERSION,
  REACTION_FORMULA_ROOT_SCHEMA_VERSION,
  type AuraStateEntry,
  type SimulationResult,
  type TargetPhaseV3DeliveryAttempt,
  type TargetPhaseV3LogEntry
} from "./types";

type IssuePath = Array<string | number>;

const FLOAT_TOLERANCE = 1e-9;
const BURNING_DAMAGE_RADIUS = 1;
const BURNING_APPLICATION_GAUGE_UNITS = 1;

type ConfiguredTargetGeometry = {
  id: string;
  name: string;
  position: { x: number; y: number } | null;
  hitboxRadius: number;
};

function approximatelyEqual(left: number, right: number): boolean {
  return (
    Math.abs(left - right) <=
    FLOAT_TOLERANCE *
      Math.max(1, Math.abs(left), Math.abs(right))
  );
}

function semanticEqual(left: unknown, right: unknown): boolean {
  return (
    left === right ||
    canonicalStringify(left) === canonicalStringify(right)
  );
}

function expectPointEqual(
  context: RefinementCtx,
  path: IssuePath,
  actual: { x: number; y: number } | null,
  expected: { x: number; y: number } | null,
  label: string
): void {
  if (actual === null || expected === null) {
    expectEqual(context, path, actual, expected, label);
    return;
  }
  if (
    !approximatelyEqual(actual.x, expected.x) ||
    !approximatelyEqual(actual.y, expected.y)
  ) {
    addIssue(
      context,
      path,
      `${label} must match the position replayed from config`
    );
  }
}

function configuredTargetGeometry(
  result: SimulationResult
): ConfiguredTargetGeometry[] {
  return (
    result.config.enemy.targets ?? [
      { id: "enemy-0", name: "敌人 0" }
    ]
  ).map((target) => ({
    id: target.id,
    name: target.name,
    position:
      target.position === undefined
        ? null
        : { ...target.position },
    hitboxRadius: target.hitboxRadius ?? 0
  }));
}

function createConfiguredTargetPositionResolver(
  result: SimulationResult,
  targets: readonly ConfiguredTargetGeometry[]
): (
  targetId: string,
  frame: number
) => { x: number; y: number } | null {
  const initialPositionByTarget = new Map(
    targets.map((target) => [target.id, target.position])
  );
  const lastPositionByTarget = new Map(initialPositionByTarget);
  const motionsByTarget = new Map<
    string,
    Array<{
      startFrame: number;
      endFrame: number;
      startPosition: { x: number; y: number };
      endPosition: { x: number; y: number };
    }>
  >();

  for (const motion of result.config.enemy.targetMotions ?? []) {
    const startPosition = lastPositionByTarget.get(motion.targetId);
    if (startPosition === null || startPosition === undefined) {
      continue;
    }
    const resolved = {
      startFrame: motion.startFrame,
      endFrame: motion.endFrame,
      startPosition: { ...startPosition },
      endPosition: { ...motion.endPosition }
    };
    const motions = motionsByTarget.get(motion.targetId) ?? [];
    motions.push(resolved);
    motionsByTarget.set(motion.targetId, motions);
    lastPositionByTarget.set(motion.targetId, {
      ...motion.endPosition
    });
  }

  return (targetId, frame) => {
    const initialPosition = initialPositionByTarget.get(targetId);
    if (initialPosition === null || initialPosition === undefined) {
      return null;
    }
    let position = initialPosition;
    for (const motion of motionsByTarget.get(targetId) ?? []) {
      if (frame < motion.startFrame) break;
      if (frame >= motion.endFrame) {
        position = motion.endPosition;
        continue;
      }
      const progress =
        (frame - motion.startFrame) /
        (motion.endFrame - motion.startFrame);
      return {
        x:
          motion.startPosition.x +
          (motion.endPosition.x - motion.startPosition.x) *
            progress,
        y:
          motion.startPosition.y +
          (motion.endPosition.y - motion.startPosition.y) *
            progress
      };
    }
    return { ...position };
  };
}

function validateConfiguredTargetMotionTimeline(
  result: SimulationResult,
  context: RefinementCtx,
  targets: readonly ConfiguredTargetGeometry[]
): void {
  const configuredMotions = result.config.enemy.targetMotions ?? [];
  if (result.targetMotionTimeline.length !== configuredMotions.length) {
    addIssue(
      context,
      ["targetMotionTimeline"],
      "target motion timeline length must match config.enemy.targetMotions"
    );
  }

  const lastPositionByTarget = new Map(
    targets.map((target) => [
      target.id,
      target.position === null ? null : { ...target.position }
    ])
  );
  for (const [motionIndex, configured] of configuredMotions.entries()) {
    const projected = result.targetMotionTimeline[motionIndex];
    const path = ["targetMotionTimeline", motionIndex] satisfies IssuePath;
    const startPosition = lastPositionByTarget.get(configured.targetId);
    if (startPosition === null || startPosition === undefined) {
      addIssue(
        context,
        [...path, "startPosition"],
        "configured target motion requires a registered initial position"
      );
      continue;
    }
    if (projected === undefined) {
      addIssue(
        context,
        path,
        `missing projection for configured target motion ${configured.id}`
      );
    } else {
      for (const [field, expected] of [
        ["id", configured.id],
        ["label", configured.label],
        ["targetId", configured.targetId],
        ["startFrame", configured.startFrame],
        ["endFrame", configured.endFrame]
      ] as const) {
        expectEqual(
          context,
          [...path, field],
          projected[field],
          expected,
          `target motion ${field}`
        );
      }
      expectPointEqual(
        context,
        [...path, "startPosition"],
        projected.startPosition,
        startPosition,
        "target motion startPosition"
      );
      expectPointEqual(
        context,
        [...path, "endPosition"],
        projected.endPosition,
        configured.endPosition,
        "target motion endPosition"
      );
      if (
        !approximatelyEqual(
          projected.startTimeSeconds,
          configured.startFrame / 60
        )
      ) {
        addIssue(
          context,
          [...path, "startTimeSeconds"],
          "target motion startTimeSeconds must equal config startFrame / 60"
        );
      }
      if (
        !approximatelyEqual(
          projected.endTimeSeconds,
          configured.endFrame / 60
        )
      ) {
        addIssue(
          context,
          [...path, "endTimeSeconds"],
          "target motion endTimeSeconds must equal config endFrame / 60"
        );
      }
    }
    lastPositionByTarget.set(configured.targetId, {
      ...configured.endPosition
    });
  }
}

/**
 * Reactable.Tick may decay gauges and source slots, but any added element,
 * owner, durability, or deadline extension needs an explicit mutation point.
 * Element removal is owned by the typed lifecycle transitions that follow.
 */
function ordinaryAuraDecayIssue(
  before: readonly AuraStateEntry[],
  after: readonly AuraStateEntry[],
  expiredRemovalFrame?: number
): string | null {
  const beforeByElement = new Map(
    before.map((entry) => [entry.element, entry])
  );
  const afterByElement = new Map(
    after.map((entry) => [entry.element, entry])
  );
  if (
    beforeByElement.size !== before.length ||
    afterByElement.size !== after.length
  ) {
    return "Aura snapshots cannot contain duplicate elements";
  }
  for (const [element, beforeEntry] of beforeByElement) {
    if (afterByElement.has(element)) continue;
    const deadline =
      beforeEntry.expiresAtTargetFrame ??
      beforeEntry.expiresAtFrame;
    if (
      expiredRemovalFrame === undefined ||
      deadline === null ||
      deadline > expiredRemovalFrame
    ) {
      return expiredRemovalFrame === undefined
        ? "ordinary Aura decay must preserve the element set until a typed lifecycle transition"
        : `Aura clock advance cannot remove unexpired ${element}`;
    }
  }

  for (const [element, afterEntry] of afterByElement) {
    const beforeEntry = beforeByElement.get(element);
    if (beforeEntry === undefined) {
      return `Aura clock advance cannot add ${element}`;
    }
    if (
      afterEntry.gaugeUnits > beforeEntry.gaugeUnits +
        FLOAT_TOLERANCE
    ) {
      return `ordinary Aura decay cannot increase ${element} durability`;
    }
    const beforeDeadline =
      beforeEntry.expiresAtTargetFrame ??
      beforeEntry.expiresAtFrame;
    const afterDeadline =
      afterEntry.expiresAtTargetFrame ?? afterEntry.expiresAtFrame;
    if (
      beforeDeadline !== null &&
      (afterDeadline === null || afterDeadline > beforeDeadline)
    ) {
      return `ordinary Aura decay cannot extend ${element} expiry`;
    }
    const beforeSlots = new Map(
      (beforeEntry.sourceSlots ?? []).map((slot) => [
        slot.sourceActorId,
        slot.gaugeUnits
      ])
    );
    if (
      beforeSlots.size !== (beforeEntry.sourceSlots ?? []).length
    ) {
      return `${element} source slots must be unique by actor`;
    }
    const afterSlots = afterEntry.sourceSlots ?? [];
    if (
      new Set(afterSlots.map((slot) => slot.sourceActorId)).size !==
      afterSlots.length
    ) {
      return `${element} source slots must be unique by actor`;
    }
    for (const slot of afterSlots) {
      const beforeGauge = beforeSlots.get(slot.sourceActorId);
      if (beforeGauge === undefined) {
        return `ordinary Aura decay cannot add ${element} source owner ${slot.sourceActorId}`;
      }
      if (slot.gaugeUnits > beforeGauge + FLOAT_TOLERANCE) {
        return `ordinary Aura decay cannot increase ${element} source owner ${slot.sourceActorId}`;
      }
    }
  }
  return null;
}

function addIssue(
  context: RefinementCtx,
  path: IssuePath,
  message: string
): void {
  context.addIssue({ code: "custom", path, message });
}

function expectEqual(
  context: RefinementCtx,
  path: IssuePath,
  actual: unknown,
  expected: unknown,
  label: string
): void {
  if (actual !== expected) {
    addIssue(
      context,
      path,
      `${label} must equal ${String(expected)}; received ${String(actual)}`
    );
  }
}

function expectSemanticEqual(
  context: RefinementCtx,
  path: IssuePath,
  actual: unknown,
  expected: unknown,
  label: string
): void {
  if (!semanticEqual(actual, expected)) {
    addIssue(context, path, `${label} does not match its authoritative source`);
  }
}

function callbackOwnedStop(
  result: SimulationResult,
  burningStateLogId: number
): boolean {
  return result.targetStateTimeline.points.some(
    (point) =>
      point.cause === "burning-tick" &&
      point.eventType === "burningTick" &&
      point.links.some(
        (link) =>
          link.kind === "burning-state-log" &&
          link.id === burningStateLogId
      )
  );
}

function exactSingleLink(
  links: Array<{ kind: string; id: number }>,
  kind: string,
  id: number
): boolean {
  return links.filter((link) => link.kind === kind && link.id === id)
    .length === 1;
}

function exactLifecycleLinks(
  actual: Array<{ kind: string; id: number }>,
  expected: Array<{ kind: string; id: number }>
): boolean {
  const lifecycle = actual.filter(
    (link) => link.kind !== "target-phase-log"
  );
  return (
    lifecycle.length === expected.length &&
    lifecycle.every(
      (link, index) =>
        link.kind === expected[index]?.kind &&
        link.id === expected[index]?.id
    )
  );
}

export interface TargetPhaseV3BurningApplicationReferenceIssue {
  path: Array<string | number>;
  message: string;
}

/**
 * Focused 1.48 four-way reference replay for one callback-owned Burning
 * delivery. It is kept pure so coordinated-link mutation tests do not need to
 * import the simulator back into the schema package.
 */
export function collectTargetPhaseV3BurningApplicationReferenceIssues({
  delivery,
  reactionDamage,
  hitResolutionLog,
  damageEvents,
  elementalApplicationIcdLog
}: {
  delivery: NonNullable<
    TargetPhaseV3LogEntry["targetTasks"][number]["delivery"]
  >;
  reactionDamage: SimulationResult["reactionDamageLog"][number];
  hitResolutionLog: SimulationResult["hitResolutionLog"];
  damageEvents: SimulationResult["damageEvents"];
  elementalApplicationIcdLog:
    SimulationResult["elementalApplicationIcdLog"];
}): TargetPhaseV3BurningApplicationReferenceIssue[] {
  const issues: TargetPhaseV3BurningApplicationReferenceIssue[] = [];
  const add = (path: IssuePath, message: string): void => {
    issues.push({ path, message });
  };
  const hitById = new Map(
    hitResolutionLog.map((entry) => [entry.id, entry])
  );
  const damageById = new Map(
    damageEvents.map((entry) => [entry.id, entry])
  );
  const applicationById = new Map(
    elementalApplicationIcdLog.map((entry) => [entry.id, entry])
  );
  const resolvedAttempts = delivery.attempts.filter(
    (attempt) => attempt.outcome !== "unresolved"
  );
  const expectedHitIds: number[] = [];
  const expectedApplicationIds: number[] = [];
  const claimedApplicationIds = new Set<number>();

  let resolvedAttemptIndex = 0;
  for (const [attemptIndex, attempt] of
    delivery.attempts.entries()) {
    const attemptPath = [
      "attempts",
      attemptIndex
    ] satisfies IssuePath;
    if (attempt.outcome === "unresolved") {
      if (attempt.elementalApplicationIcdLogId !== null) {
        add(
          [...attemptPath, "elementalApplicationIcdLogId"],
          "unresolved Burning delivery attempt cannot claim an application row"
        );
      }
      continue;
    }

    expectedHitIds.push(attempt.hitResolutionLogId);
    expectedApplicationIds.push(
      attempt.elementalApplicationIcdLogId
    );
    if (
      claimedApplicationIds.has(
        attempt.elementalApplicationIcdLogId
      )
    ) {
      add(
        [...attemptPath, "elementalApplicationIcdLogId"],
        "Burning delivery application row cannot be claimed by two attempts"
      );
    }
    claimedApplicationIds.add(
      attempt.elementalApplicationIcdLogId
    );

    const hit = hitById.get(attempt.hitResolutionLogId);
    if (
      hit === undefined ||
      hit.reactionDamageLogId !== reactionDamage.id ||
      hit.elementalApplicationIcdLogId !==
        attempt.elementalApplicationIcdLogId ||
      hit.damageEventId !== attempt.damageEventId
    ) {
      add(
        [...attemptPath, "hitResolutionLogId"],
        "Burning delivery hit must reciprocally link its reaction, application, and damage rows"
      );
    }

    const application = applicationById.get(
      attempt.elementalApplicationIcdLogId
    );
    if (
      application === undefined ||
      application.sourceKind !== "burning-tick" ||
      application.reactionDamageLogId !== reactionDamage.id ||
      application.hitResolutionLogId !==
        attempt.hitResolutionLogId ||
      application.damageEventId !== attempt.damageEventId ||
      application.frame !== reactionDamage.damageFrame ||
      application.eventPriority !== delivery.eventPriority ||
      application.eventSequence !== delivery.eventSequence ||
      application.attemptIndex !== resolvedAttemptIndex ||
      application.attemptCount !== resolvedAttempts.length ||
      application.deliveryPhase !== attempt.applicationPhase ||
      application.sourceActorId !== reactionDamage.sourceActorId ||
      application.targetId !== attempt.targetId ||
      application.hitId !== hit?.hitId ||
      application.hitGroupId !== hit?.hitGroupId ||
      application.element !== "pyro" ||
      application.nominalGaugeUnits !==
        BURNING_APPLICATION_GAUGE_UNITS ||
      application.selector.channel.kind !== "burning-tick"
    ) {
      add(
        [...attemptPath, "elementalApplicationIcdLogId"],
        "Burning delivery application row must match its attempt, hit, reaction, and micro-event tuple"
      );
    }

    if (attempt.outcome === "landed") {
      const damage = damageById.get(attempt.damageEventId);
      if (
        damage === undefined ||
        damage.targetResolutionId !==
          attempt.hitResolutionLogId ||
        damage.elementalApplicationIcdLogId !==
          attempt.elementalApplicationIcdLogId
      ) {
        add(
          [...attemptPath, "damageEventId"],
          "landed Burning delivery damage must reciprocally link its hit and application rows"
        );
      }
    }
    resolvedAttemptIndex += 1;
  }

  if (
    !semanticEqual(
      reactionDamage.hitResolutionLogIds,
      expectedHitIds
    )
  ) {
    add(
      [
        "reactionDamageLog",
        reactionDamage.id,
        "hitResolutionLogIds"
      ],
      "Burning reaction parent must list every resolved delivery hit in attempt order"
    );
  }
  if (
    !semanticEqual(
      reactionDamage.elementalApplicationIcdLogIds,
      expectedApplicationIds
    )
  ) {
    add(
      [
        "reactionDamageLog",
        reactionDamage.id,
        "elementalApplicationIcdLogIds"
      ],
      "Burning reaction parent must list every resolved delivery application in attempt order"
    );
  }

  return issues;
}

/**
 * Cross-log proof for the target-phase-v3 Burning callback wire frozen by
 * 1.44 and reused by the exact 1.45-1.47 identities. Exact 1.48 adds the
 * reaction-owned application row and its reciprocal attempt references.
 *
 * The callback task is the ownership root. Its delivery is a distinct
 * zero-delay micro-event between QueueEnemyTask and Reactable.Tick. This pass
 * binds every registered target attempt to the reaction-damage parent, hit,
 * damage, and target-state rows while keeping those rows out of recipient
 * phase ownership.
 */
export function validateTargetPhaseV3Integrity(
  result: SimulationResult,
  context: RefinementCtx
): void {
  const resultSchemaVersion = result.schemaVersion as string;
  const resultEngineVersion = result.engineVersion as string;
  const configSchemaVersion = result.config.schemaVersion as string;
  const configEngineVersion = result.config.engineVersion as string;
  const exactV144Identity =
    resultSchemaVersion === BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION &&
    resultEngineVersion ===
      BURNING_CALLBACK_DELIVERY_ENGINE_VERSION &&
    configSchemaVersion ===
      BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION &&
    configEngineVersion ===
      BURNING_CALLBACK_DELIVERY_ENGINE_VERSION;
  const exactV145Identity =
    resultSchemaVersion === REACTION_FORMULA_ROOT_SCHEMA_VERSION &&
    resultEngineVersion ===
      REACTION_FORMULA_ROOT_ENGINE_VERSION &&
    configSchemaVersion ===
      REACTION_FORMULA_ROOT_SCHEMA_VERSION &&
    configEngineVersion ===
      REACTION_FORMULA_ROOT_ENGINE_VERSION;
  const exactV146Identity =
    resultSchemaVersion === DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION &&
    resultEngineVersion === DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION &&
    configSchemaVersion === DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION &&
    configEngineVersion === DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION;
  const exactV147Identity =
    resultSchemaVersion === ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION &&
    resultEngineVersion === ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION &&
    configSchemaVersion === ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION &&
    configEngineVersion === ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION;
  const exactV148Identity =
    resultSchemaVersion ===
      REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION &&
    resultEngineVersion ===
      REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION &&
    configSchemaVersion ===
      REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION &&
    configEngineVersion ===
      REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION;
  if (
    !exactV144Identity &&
    !exactV145Identity &&
    !exactV146Identity &&
    !exactV147Identity &&
    !exactV148Identity
  ) {
    addIssue(
      context,
      ["schemaVersion"],
      "target-phase-v3 integrity requires an exact 1.44, 1.45, 1.46, 1.47, or 1.48 schema and engine identity"
    );
    return;
  }
  const configuredV3 =
    result.config.targetTaskModel.mode === "target-phase-v3";
  const v3Phases = result.targetPhaseLog.filter(
    (phase): phase is TargetPhaseV3LogEntry =>
      phase.model === "target-phase-v3"
  );

  if (!configuredV3) {
    if (v3Phases.length !== 0) {
      addIssue(
        context,
        ["targetPhaseLog"],
        "target-phase-v3 rows require config.targetTaskModel.mode=target-phase-v3"
      );
    }
    return;
  }

  if (v3Phases.length !== result.targetPhaseLog.length) {
    addIssue(
      context,
      ["targetPhaseLog"],
      "target-phase-v3 configuration requires only strict target-phase-v3 rows"
    );
  }
  if (
    result.config.timeline?.mode !== "legal-frame-v1" ||
    result.config.timeline.fps !== 60
  ) {
    addIssue(
      context,
      ["config", "timeline"],
      "target-phase-v3 requires legal-frame-v1 at 60 FPS"
    );
  }
  if (
    result.config.reactionEngine?.mode !== "aura-v7" &&
    result.config.reactionEngine?.mode !== "aura-v8" &&
    result.config.reactionEngine?.mode !== "aura-v9"
  ) {
    addIssue(
      context,
      ["config", "reactionEngine", "mode"],
      "target-phase-v3 requires aura-v7, aura-v8, or aura-v9"
    );
  }
  if (result.targetTaskPhaseLog.length !== 0) {
    addIssue(
      context,
      ["targetTaskPhaseLog"],
      "target-phase-v3 requires the historical targetTaskPhaseLog projection to remain empty"
    );
  }

  const targetById = new Map(
    result.enemyTargets.map((target, targetOrder) => [
      target.id,
      { target, targetOrder }
    ])
  );
  const configuredTargets = configuredTargetGeometry(result);
  const configuredTargetById = new Map(
    configuredTargets.map((target) => [target.id, target])
  );
  const resolveConfiguredTargetPosition =
    createConfiguredTargetPositionResolver(
      result,
      configuredTargets
    );
  validateConfiguredTargetMotionTimeline(
    result,
    context,
    configuredTargets
  );
  const burningById = new Map(
    result.burningStateLog.map((entry) => [entry.id, entry])
  );
  const reactionDamageById = new Map(
    result.reactionDamageLog.map((entry) => [entry.id, entry])
  );
  const hitById = new Map(
    result.hitResolutionLog.map((entry) => [entry.id, entry])
  );
  const damageById = new Map(
    result.damageEvents.map((entry) => [entry.id, entry])
  );
  const applicationById = new Map(
    exactV148Identity
      ? (result.elementalApplicationIcdLog ?? []).map((entry) => [
          entry.id,
          entry
        ])
      : []
  );
  const reactionTaskById = new Map(
    result.reactionTaskLog.map((entry) => [entry.id, entry])
  );
  const frozenById = new Map(
    result.frozenStateLog.map((entry) => [entry.id, entry])
  );
  const quickenById = new Map(
    result.quickenStateLog.map((entry) => [entry.id, entry])
  );
  const periodicById = new Map(
    result.periodicReactionLog.map((entry) => [entry.id, entry])
  );
  const timelinePointById = new Map(
    result.targetStateTimeline.points.map((entry) => [entry.id, entry])
  );
  const earliestMechanicsTruncationTriggerByTarget = new Map<
    string,
    SimulationResult["damageEvents"][number]
  >();
  const compareDamageOrder = (
    left: SimulationResult["damageEvents"][number],
    right: SimulationResult["damageEvents"][number]
  ): number =>
    left.frame - right.frame ||
    left.eventPriority - right.eventPriority ||
    left.eventSequence - right.eventSequence ||
    left.id - right.id;
  for (const truncation of result.targetMechanicsTruncationLog) {
    const trigger = damageById.get(truncation.triggerDamageEventId);
    if (trigger === undefined) continue;
    const previous =
      earliestMechanicsTruncationTriggerByTarget.get(
        truncation.targetId
      );
    if (
      previous === undefined ||
      compareDamageOrder(trigger, previous) < 0
    ) {
      earliestMechanicsTruncationTriggerByTarget.set(
        truncation.targetId,
        trigger
      );
    }
  }
  const phaseByFrameAndTarget = new Map(
    v3Phases.map((phase) => [
      `${phase.globalFrame}\u0000${phase.targetId}`,
      phase
    ])
  );
  const deliveryAuraPointsByRecipientPhase = new Map<
    string,
    Array<{
      pointId: number;
      applicationPhase:
        | "before-reactable-tick"
        | "after-reactable-tick";
    }>
  >();
  for (const ownerPhase of v3Phases) {
    for (const task of ownerPhase.targetTasks) {
      for (const attempt of task.delivery?.attempts ?? []) {
        if (attempt.outcome !== "landed") continue;
        const key = `${ownerPhase.globalFrame}\u0000${attempt.targetId}`;
        const references =
          deliveryAuraPointsByRecipientPhase.get(key) ?? [];
        references.push({
          pointId: attempt.targetStateTimelinePointId,
          applicationPhase: attempt.applicationPhase
        });
        deliveryAuraPointsByRecipientPhase.set(key, references);
      }
    }
  }

  const phaseClaimedHitIds = new Set<number>();
  const phaseOwnedTimelinePointIds = new Set<number>();
  const burningTaskOwners = new Map<number, IssuePath>();
  const reactionDamageDeliveryOwners = new Map<number, IssuePath>();
  const callbackHitOwners = new Map<number, IssuePath>();
  const callbackDamageOwners = new Map<number, IssuePath>();
  const callbackApplicationOwners = new Map<number, IssuePath>();
  const callbackTimelineOwners = new Map<number, IssuePath>();
  const phaseHitOwners = new Map<number, IssuePath>();
  const phaseReactionTaskOwners = new Map<number, IssuePath>();
  const frozenTransitionOwners = new Map<number, IssuePath>();
  const quickenTransitionOwners = new Map<number, IssuePath>();
  const burningFuelTransitionOwners = new Map<number, IssuePath>();
  const periodicTransitionOwners = new Map<number, IssuePath>();

  const claimUnique = (
    owners: Map<number, IssuePath>,
    id: number,
    path: IssuePath,
    label: string
  ): void => {
    const previous = owners.get(id);
    if (previous !== undefined) {
      addIssue(
        context,
        path,
        `${label} ${id} is already owned at ${previous.join(".")}`
      );
      return;
    }
    owners.set(id, path);
  };

  for (const [phaseIndex, phase] of v3Phases.entries()) {
    const phasePath = ["targetPhaseLog", phaseIndex] satisfies IssuePath;
    const registeredTarget = targetById.get(phase.targetId);
    if (
      registeredTarget === undefined ||
      registeredTarget.target.name !== phase.targetName ||
      registeredTarget.targetOrder !== phase.targetOrder
    ) {
      addIssue(
        context,
        [...phasePath, "targetId"],
        "target phase identity and targetOrder must match enemyTargets registration order"
      );
    }
    for (const [referenceIndex, id] of
      phase.hitResolutionLogIds.entries()) {
      phaseClaimedHitIds.add(id);
      const path = [
        ...phasePath,
        "hitResolutionLogIds",
        referenceIndex
      ] satisfies IssuePath;
      claimUnique(
        phaseHitOwners,
        id,
        path,
        "phase-owned hit-resolution row"
      );
      const hit = hitById.get(id);
      if (
        hit === undefined ||
        hit.targetId !== phase.targetId ||
        hit.targetName !== phase.targetName ||
        hit.frame !== phase.globalFrame ||
        hit.eventPriority === undefined ||
        hit.eventSequence === undefined ||
        hit.intraEventSequence === undefined
      ) {
        addIssue(
          context,
          path,
          "phase-owned hit-resolution row must match its target, frame, and event tuple"
        );
      }
    }
    for (const [referenceIndex, id] of
      phase.reactionTaskLogIds.entries()) {
      const path = [
        ...phasePath,
        "reactionTaskLogIds",
        referenceIndex
      ] satisfies IssuePath;
      claimUnique(
        phaseReactionTaskOwners,
        id,
        path,
        "phase-owned reaction-task row"
      );
      const reactionTask = reactionTaskById.get(id);
      if (
        reactionTask === undefined ||
        reactionTask.targetId !== phase.targetId ||
        reactionTask.targetName !== phase.targetName ||
        reactionTask.frame !== phase.globalFrame
      ) {
        addIssue(
          context,
          path,
          "phase-owned reaction-task row must match its target and frame"
        );
      }
    }
    for (const task of phase.targetTasks) {
      phaseOwnedTimelinePointIds.add(task.targetStateTimelinePointId);
    }
    for (const transition of phase.reactableTick.transitions) {
      phaseOwnedTimelinePointIds.add(
        transition.targetStateTimelinePointId
      );
    }

    for (const [taskIndex, task] of phase.targetTasks.entries()) {
      const taskPath = [
        ...phasePath,
        "targetTasks",
        taskIndex
      ] satisfies IssuePath;
      const taskPoint = timelinePointById.get(
        task.targetStateTimelinePointId
      );
      expectEqual(
        context,
        [...taskPath, "deadlineTargetFrame"],
        task.deadlineTargetFrame,
        phase.targetFrame,
        "Burning callback target deadline"
      );

      if (task.status === "stale") {
        if (task.burningStateLogId !== null || task.delivery !== null) {
          addIssue(
            context,
            taskPath,
            "stale Burning callbacks cannot own a lifecycle row or delivery"
          );
        }
        if (
          taskPoint === undefined ||
          taskPoint.links.length !== 0 ||
          !semanticEqual(taskPoint.auraBefore, taskPoint.auraAfter)
        ) {
          addIssue(
            context,
            [...taskPath, "targetStateTimelinePointId"],
            "stale Burning callbacks require one link-free unchanged timeline observation"
          );
        }
        continue;
      }

      if (task.burningStateLogId === null) {
        addIssue(
          context,
          [...taskPath, "burningStateLogId"],
          "applied Burning callbacks require one lifecycle row"
        );
        continue;
      }
      claimUnique(
        burningTaskOwners,
        task.burningStateLogId,
        [...taskPath, "burningStateLogId"],
        "Burning lifecycle row"
      );
      const burning = burningById.get(task.burningStateLogId);
      if (burning === undefined) {
        addIssue(
          context,
          [...taskPath, "burningStateLogId"],
          `references missing Burning lifecycle row ${task.burningStateLogId}`
        );
        continue;
      }

      for (const [field, expected] of [
        ["targetId", phase.targetId],
        ["targetName", phase.targetName],
        ["frame", phase.globalFrame],
        ["targetFrame", phase.targetFrame],
        ["generation", task.generation],
        ["tickIndex", task.tickIndex],
        ["eventPriority", task.eventPriority],
        ["eventSequence", task.eventSequence]
      ] as const) {
        expectEqual(
          context,
          ["burningStateLog", burning.id, field],
          burning[field],
          expected,
          `callback Burning ${field}`
        );
      }
      if (
        burning.operation !== "tick" &&
        burning.operation !== "tick-skipped" &&
        burning.operation !== "stop"
      ) {
        addIssue(
          context,
          [...taskPath, "burningStateLogId"],
          "target callback may only own tick, tick-skipped, or callback stop lifecycle rows"
        );
      }
      if (
        taskPoint === undefined ||
        taskPoint.targetId !== phase.targetId ||
        taskPoint.targetName !== phase.targetName ||
        taskPoint.frame !== phase.globalFrame ||
        taskPoint.targetFrame !== phase.targetFrame ||
        taskPoint.cause !== "burning-tick" ||
        taskPoint.eventType !== "burningTick" ||
        taskPoint.eventPriority !== task.eventPriority ||
        taskPoint.eventSequence !== task.eventSequence ||
        taskPoint.intraEventSequence !== task.intraEventSequence ||
        !exactSingleLink(
          taskPoint.links,
          "burning-state-log",
          burning.id
        ) ||
        taskPoint.links.length !== 1
      ) {
        addIssue(
          context,
          [...taskPath, "targetStateTimelinePointId"],
          "applied Burning callback requires its exact lifecycle timeline point"
        );
      }
      if (
        burning.callbackAuraBefore === undefined ||
        burning.callbackAuraAfter === undefined ||
        taskPoint === undefined ||
        !semanticEqual(
          burning.callbackAuraBefore,
          taskPoint.auraBefore
        ) ||
        !semanticEqual(burning.callbackAuraAfter, taskPoint.auraAfter)
      ) {
        addIssue(
          context,
          ["burningStateLog", burning.id, "callbackAuraBefore"],
          "Burning callback Aura snapshots must exactly project its task timeline point"
        );
      }

      if (burning.operation !== "tick") {
        if (task.delivery !== null) {
          addIssue(
            context,
            [...taskPath, "delivery"],
            `${burning.operation} Burning callbacks cannot own a damage delivery`
          );
        }
        continue;
      }
      if (task.delivery === null) {
        addIssue(
          context,
          [...taskPath, "delivery"],
          "Burning tick callbacks require one inline zero-delay delivery"
        );
        continue;
      }

      const delivery = task.delivery;
      const deliveryPath = [...taskPath, "delivery"] satisfies IssuePath;
      claimUnique(
        reactionDamageDeliveryOwners,
        delivery.reactionDamageLogId,
        [...deliveryPath, "reactionDamageLogId"],
        "Burning callback delivery"
      );
      expectEqual(
        context,
        ["burningStateLog", burning.id, "reactionDamageLogId"],
        burning.reactionDamageLogId,
        delivery.reactionDamageLogId,
        "Burning callback reaction-damage owner"
      );

      const priorityStride = 0.5 / (result.enemyTargets.length + 1);
      const expectedTaskPriority = 0.5 + phase.targetOrder * priorityStride;
      const expectedDeliveryPriority =
        expectedTaskPriority + priorityStride * 0.25;
      const reactableTickPriority =
        expectedTaskPriority + priorityStride * 0.5;
      if (!approximatelyEqual(task.eventPriority, expectedTaskPriority)) {
        addIssue(
          context,
          [...taskPath, "eventPriority"],
          "Burning callback priority must encode its registered target order"
        );
      }
      if (
        !approximatelyEqual(
          delivery.eventPriority,
          expectedDeliveryPriority
        ) ||
        !(delivery.eventPriority > task.eventPriority) ||
        !(delivery.eventPriority < reactableTickPriority)
      ) {
        addIssue(
          context,
          [...deliveryPath, "eventPriority"],
          "inline delivery priority must occupy its deterministic slot after the callback and before owner Reactable.Tick"
        );
      }
      if (delivery.eventSequence <= task.eventSequence) {
        addIssue(
          context,
          [...deliveryPath, "eventSequence"],
          "inline delivery sequence must follow its callback sequence"
        );
      }

      const reactionDamage = reactionDamageById.get(
        delivery.reactionDamageLogId
      );
      if (
        reactionDamage === undefined ||
        reactionDamage.reaction !== "burning" ||
        reactionDamage.scheduleKind !== "burning-tick" ||
        reactionDamage.targetingMode !== "radius" ||
        reactionDamage.sourceTargetId !== phase.targetId ||
        reactionDamage.sourceActorId !== burning.damageSourceActorId ||
        reactionDamage.triggerDamageEventId !==
          burning.triggerDamageEventId ||
        reactionDamage.damageFrame !== phase.globalFrame ||
        !reactionDamage.scheduled ||
        !reactionDamage.withinSimulation ||
        reactionDamage.blockedReason !== null
      ) {
        addIssue(
          context,
          [...deliveryPath, "reactionDamageLogId"],
          "inline delivery must backlink its exact settled Burning reaction-damage parent"
        );
        continue;
      }

      const expectedCenterPosition =
        resolveConfiguredTargetPosition(
          phase.targetId,
          phase.globalFrame
        );
      expectPointEqual(
        context,
        [
          "reactionDamageLog",
          reactionDamage.id,
          "centerPosition"
        ],
        reactionDamage.centerPosition,
        expectedCenterPosition,
        "Burning damage center"
      );
      expectEqual(
        context,
        ["reactionDamageLog", reactionDamage.id, "radius"],
        reactionDamage.radius,
        BURNING_DAMAGE_RADIUS,
        "Burning damage radius"
      );
      expectEqual(
        context,
        [
          "reactionDamageLog",
          reactionDamage.id,
          "applicationGaugeUnits"
        ],
        reactionDamage.applicationGaugeUnits,
        BURNING_APPLICATION_GAUGE_UNITS,
        "Burning application Gauge"
      );
      for (const [field, actual] of [
        ["sourceCoreId", reactionDamage.sourceCoreId],
        ["sourceCoreLogId", reactionDamage.sourceCoreLogId],
        ["selectionRadius", reactionDamage.selectionRadius],
        ["selectedTargetId", reactionDamage.selectedTargetId],
        ["resolutionReason", reactionDamage.resolutionReason]
      ] as const) {
        expectEqual(
          context,
          ["reactionDamageLog", reactionDamage.id, field],
          actual,
          null,
          `Burning damage parent ${field}`
        );
      }

      if (delivery.attempts.length !== result.enemyTargets.length) {
        addIssue(
          context,
          [...deliveryPath, "attempts"],
          "inline Burning delivery must audit every enemy in registration order"
        );
      }

      const checkedTargetIds: string[] = [];
      const hitTargetIds: string[] = [];
      const unresolvedTargetIds: string[] = [];
      const hitResolutionLogIds: number[] = [];
      const damageEventIds: number[] = [];
      const elementalApplicationIcdLogIds: number[] = [];
      let resolvedTargetIndex = 0;
      const resolvedTargetCount = delivery.attempts.filter(
        (attempt) => attempt.outcome !== "unresolved"
      ).length;

      for (const [attemptIndex, attempt] of delivery.attempts.entries()) {
        const attemptPath = [
          ...deliveryPath,
          "attempts",
          attemptIndex
        ] satisfies IssuePath;
        const registeredAttemptTarget = result.enemyTargets[attemptIndex];
        if (
          attempt.order !== attemptIndex ||
          registeredAttemptTarget === undefined ||
          attempt.targetId !== registeredAttemptTarget.id ||
          attempt.targetOrder !== attemptIndex
        ) {
          addIssue(
            context,
            attemptPath,
            "delivery attempts must be contiguous and exactly follow enemyTargets registration order"
          );
        }
        const expectedApplicationPhase =
          attempt.targetOrder < phase.targetOrder
            ? "after-reactable-tick"
            : "before-reactable-tick";
        expectEqual(
          context,
          [...attemptPath, "applicationPhase"],
          attempt.applicationPhase,
          expectedApplicationPhase,
          "Burning application phase"
        );

        const configuredAttemptTarget = configuredTargetById.get(
          attempt.targetId
        );
        const expectedTargetPosition =
          resolveConfiguredTargetPosition(
            attempt.targetId,
            phase.globalFrame
          );
        const expectedDistance =
          expectedCenterPosition === null ||
          expectedTargetPosition === null
            ? null
            : Math.hypot(
                expectedTargetPosition.x -
                  expectedCenterPosition.x,
                expectedTargetPosition.y -
                  expectedCenterPosition.y
              );
        const expectedThreshold =
          configuredAttemptTarget === undefined
            ? null
            : BURNING_DAMAGE_RADIUS +
              configuredAttemptTarget.hitboxRadius;
        const expectedOutcome: TargetPhaseV3DeliveryAttempt["outcome"] =
          expectedCenterPosition === null
            ? attempt.targetId === phase.targetId
              ? "landed"
              : "unresolved"
            : expectedTargetPosition === null ||
                expectedThreshold === null
              ? "unresolved"
              : expectedDistance !== null &&
                  expectedDistance <=
                    expectedThreshold + FLOAT_TOLERANCE
                ? "landed"
                : "miss";
        const activeTargetPhase = (
          result.config.enemy.targetPhases ?? []
        ).find(
          (targetPhase) =>
            targetPhase.targetId === attempt.targetId &&
            phase.globalFrame >= targetPhase.startFrame &&
            phase.globalFrame < targetPhase.endFrame
        );
        const expectedReason =
          expectedOutcome === "miss"
            ? "OUTSIDE_CIRCLE_GEOMETRY"
            : activeTargetPhase?.reason ?? null;
        const expectedDamageAllowed =
          expectedOutcome === "landed" &&
          activeTargetPhase?.effects.damage !== "immune";
        const expectedAuraAllowed =
          expectedOutcome === "landed" &&
          reactionDamage.applicationGaugeUnits !== null &&
          activeTargetPhase?.effects.aura !== "blocked";
        const truncationTrigger =
          earliestMechanicsTruncationTriggerByTarget.get(
            attempt.targetId
          );
        const currentDamageId =
          attempt.outcome === "landed"
            ? attempt.damageEventId
            : null;
        const mechanicsTruncatedBefore =
          truncationTrigger !== undefined &&
          (truncationTrigger.frame < phase.globalFrame ||
            (truncationTrigger.frame === phase.globalFrame &&
              (truncationTrigger.eventPriority <
                delivery.eventPriority ||
                (truncationTrigger.eventPriority ===
                  delivery.eventPriority &&
                  (truncationTrigger.eventSequence <
                    delivery.eventSequence ||
                    (truncationTrigger.eventSequence ===
                      delivery.eventSequence &&
                      currentDamageId !== null &&
                      truncationTrigger.id < currentDamageId))))));
        const expectedMechanicsStatus = mechanicsTruncatedBefore
          ? "mechanics-truncated"
          : "authoritative";
        expectEqual(
          context,
          [...attemptPath, "outcome"],
          attempt.outcome,
          expectedOutcome,
          "Burning delivery outcome replayed from config geometry"
        );

        if (attempt.outcome === "unresolved") {
          unresolvedTargetIds.push(attempt.targetId);
          if (
            attempt.hitResolutionLogId !== null ||
            attempt.damageEventId !== null ||
            attempt.targetStateTimelinePointId !== null
          ) {
            addIssue(
              context,
              attemptPath,
              "unresolved delivery attempts cannot claim hit, damage, or timeline rows"
            );
          }
          continue;
        }

        const recipientPhase = phaseByFrameAndTarget.get(
          `${phase.globalFrame}\u0000${attempt.targetId}`
        );
        if (recipientPhase === undefined) {
          addIssue(
            context,
            attemptPath,
            "resolved callback attempt requires its recipient target phase at the same frame"
          );
        }

        checkedTargetIds.push(attempt.targetId);
        hitResolutionLogIds.push(attempt.hitResolutionLogId);
        claimUnique(
          callbackHitOwners,
          attempt.hitResolutionLogId,
          [...attemptPath, "hitResolutionLogId"],
          "callback-owned hit-resolution row"
        );
        const hit = hitById.get(attempt.hitResolutionLogId);
        if (
          hit === undefined ||
          hit.targetId !== attempt.targetId ||
          hit.targetName !== configuredAttemptTarget?.name ||
          hit.frame !== phase.globalFrame ||
          hit.resolutionKind !== "reaction-damage" ||
          hit.eventPriority !== delivery.eventPriority ||
          hit.eventSequence !== delivery.eventSequence ||
          hit.targetIndex !== resolvedTargetIndex ||
          hit.targetCount !== resolvedTargetCount ||
          hit.landed !== (attempt.outcome === "landed") ||
          hit.outcome !== attempt.outcome
        ) {
          addIssue(
            context,
            [...attemptPath, "hitResolutionLogId"],
            "delivery attempt does not match its callback-owned hit resolution and micro-event tuple"
          );
        }
        if (hit !== undefined) {
          expectPointEqual(
            context,
            ["hitResolutionLog", hit.id, "targetPosition"],
            hit.targetPosition,
            expectedTargetPosition,
            "Burning hit target position"
          );
          if (expectedCenterPosition === null) {
            expectEqual(
              context,
              ["hitResolutionLog", hit.id, "targetingSource"],
              hit.targetingSource,
              "reaction-source",
              "unresolved-center Burning source targeting"
            );
            for (const [field, actual] of [
              ["sourceActorPosition", hit.sourceActorPosition],
              ["sourceActorFacingDegrees", hit.sourceActorFacingDegrees],
              ["geometryKind", hit.geometryKind],
              ["geometryCoordinateSpace", hit.geometryCoordinateSpace],
              ["geometryOrigin", hit.geometryOrigin],
              ["geometryStart", hit.geometryStart],
              ["geometryEnd", hit.geometryEnd],
              ["geometryRadius", hit.geometryRadius],
              ["geometryHalfWidth", hit.geometryHalfWidth],
              ["geometryHalfHeight", hit.geometryHalfHeight],
              ["geometryRotationDegrees", hit.geometryRotationDegrees],
              ["geometryDirectionDegrees", hit.geometryDirectionDegrees],
              ["geometryAngleDegrees", hit.geometryAngleDegrees],
              ["geometryDistance", hit.geometryDistance],
              ["geometryThreshold", hit.geometryThreshold]
            ] as const) {
              expectEqual(
                context,
                ["hitResolutionLog", hit.id, field],
                actual,
                null,
                `unresolved-center Burning ${field}`
              );
            }
          } else {
            expectEqual(
              context,
              ["hitResolutionLog", hit.id, "targetingSource"],
              hit.targetingSource,
              "reaction-geometry",
              "Burning geometry targeting"
            );
            expectEqual(
              context,
              ["hitResolutionLog", hit.id, "geometryKind"],
              hit.geometryKind,
              "circle",
              "Burning hit geometry kind"
            );
            expectEqual(
              context,
              [
                "hitResolutionLog",
                hit.id,
                "geometryCoordinateSpace"
              ],
              hit.geometryCoordinateSpace,
              "world",
              "Burning hit geometry coordinate space"
            );
            expectPointEqual(
              context,
              ["hitResolutionLog", hit.id, "geometryOrigin"],
              hit.geometryOrigin,
              expectedCenterPosition,
              "Burning hit geometry origin"
            );
            expectEqual(
              context,
              ["hitResolutionLog", hit.id, "geometryRadius"],
              hit.geometryRadius,
              BURNING_DAMAGE_RADIUS,
              "Burning hit geometry radius"
            );
            for (const [field, actual] of [
              ["sourceActorPosition", hit.sourceActorPosition],
              ["sourceActorFacingDegrees", hit.sourceActorFacingDegrees],
              ["geometryStart", hit.geometryStart],
              ["geometryEnd", hit.geometryEnd],
              ["geometryHalfWidth", hit.geometryHalfWidth],
              ["geometryHalfHeight", hit.geometryHalfHeight],
              ["geometryRotationDegrees", hit.geometryRotationDegrees],
              ["geometryDirectionDegrees", hit.geometryDirectionDegrees],
              ["geometryAngleDegrees", hit.geometryAngleDegrees]
            ] as const) {
              expectEqual(
                context,
                ["hitResolutionLog", hit.id, field],
                actual,
                null,
                `circle Burning ${field}`
              );
            }
            if (
              expectedDistance === null ||
              expectedThreshold === null
            ) {
              addIssue(
                context,
                ["hitResolutionLog", hit.id, "geometryDistance"],
                "resolved Burning geometry requires a configured target position and hitbox"
              );
            } else {
              if (
                hit.geometryDistance === null ||
                !approximatelyEqual(
                  hit.geometryDistance,
                  expectedDistance
                )
              ) {
                addIssue(
                  context,
                  ["hitResolutionLog", hit.id, "geometryDistance"],
                  "Burning hit distance must match config geometry replay"
                );
              }
              if (
                hit.geometryThreshold === null ||
                !approximatelyEqual(
                  hit.geometryThreshold,
                  expectedThreshold
                )
              ) {
                addIssue(
                  context,
                  ["hitResolutionLog", hit.id, "geometryThreshold"],
                  "Burning hit threshold must match config hitbox replay"
                );
              }
            }
          }
          expectEqual(
            context,
            ["hitResolutionLog", hit.id, "reason"],
            hit.reason,
            expectedReason,
            "Burning hit outcome reason"
          );
          expectEqual(
            context,
            ["hitResolutionLog", hit.id, "targetEffectSource"],
            hit.targetEffectSource,
            activeTargetPhase === undefined
              ? "normal"
              : "target-phase",
            "Burning hit target effect source"
          );
          expectEqual(
            context,
            ["hitResolutionLog", hit.id, "targetPhaseId"],
            hit.targetPhaseId,
            activeTargetPhase?.id ?? null,
            "Burning hit target phase"
          );
          for (const [field, actual, expected] of [
            [
              "damageAllowed",
              hit.damageAllowed,
              expectedDamageAllowed
            ],
            ["auraAllowed", hit.auraAllowed, expectedAuraAllowed],
            ["hitConfirmAllowed", hit.hitConfirmAllowed, false],
            [
              "mechanicsStatus",
              hit.mechanicsStatus,
              expectedMechanicsStatus
            ]
          ] as const) {
            expectEqual(
              context,
              ["hitResolutionLog", hit.id, field],
              actual,
              expected,
              `Burning hit ${field}`
            );
          }
        }
        if (exactV148Identity) {
          const applicationId =
            attempt.elementalApplicationIcdLogId;
          elementalApplicationIcdLogIds.push(applicationId);
          claimUnique(
            callbackApplicationOwners,
            applicationId,
            [...attemptPath, "elementalApplicationIcdLogId"],
            "callback-owned elemental-application row"
          );
        }
        resolvedTargetIndex += 1;

        if (attempt.outcome === "miss") {
          if (
            hit !== undefined &&
            (hit.damageEventId !== null ||
              hit.potentialDamage !== 0 ||
              hit.finalDamage !== 0 ||
              hit.displayDamage !== 0)
          ) {
            addIssue(
              context,
              [...attemptPath, "hitResolutionLogId"],
              "missed Burning attempt cannot project damage"
            );
          }
          continue;
        }

        hitTargetIds.push(attempt.targetId);
        damageEventIds.push(attempt.damageEventId);
        claimUnique(
          callbackDamageOwners,
          attempt.damageEventId,
          [...attemptPath, "damageEventId"],
          "callback-owned damage event"
        );
        claimUnique(
          callbackTimelineOwners,
          attempt.targetStateTimelinePointId,
          [...attemptPath, "targetStateTimelinePointId"],
          "callback-owned target-state point"
        );
        const damage = damageById.get(attempt.damageEventId);
        if (
          damage === undefined ||
          hit?.damageEventId !== attempt.damageEventId ||
          damage.targetResolutionId !== attempt.hitResolutionLogId ||
          damage.targetId !== attempt.targetId ||
          damage.frame !== phase.globalFrame ||
          damage.eventPriority !== delivery.eventPriority ||
          damage.eventSequence !== delivery.eventSequence ||
          damage.kind !== "transformative-reaction" ||
          damage.reaction !== "burning"
        ) {
          addIssue(
            context,
            [...attemptPath, "damageEventId"],
            "landed attempt does not match its callback-owned Burning damage event"
          );
        }
        if (damage !== undefined) {
          expectEqual(
            context,
            ["damageEvents", damage.id, "mechanicsStatus"],
            damage.mechanicsStatus,
            expectedMechanicsStatus,
            "Burning damage mechanics status"
          );
          expectEqual(
            context,
            ["damageEvents", damage.id, "targetDamagePolicy"],
            damage.targetDamagePolicy,
            expectedDamageAllowed ? "normal" : "immune",
            "Burning damage target policy"
          );
          expectEqual(
            context,
            ["damageEvents", damage.id, "targetDamageMultiplier"],
            damage.targetDamageMultiplier,
            expectedDamageAllowed ? 1 : 0,
            "Burning damage target multiplier"
          );
        }
        const timelinePoint = timelinePointById.get(
          attempt.targetStateTimelinePointId
        );
        if (
          timelinePoint === undefined ||
          timelinePoint.targetId !== attempt.targetId ||
          timelinePoint.frame !== phase.globalFrame ||
          timelinePoint.eventType !== "reactionDamage" ||
          timelinePoint.eventPriority !== delivery.eventPriority ||
          timelinePoint.eventSequence !== delivery.eventSequence ||
          timelinePoint.cause !== "reaction-damage-application" ||
          timelinePoint.primaryDamageEventId !== attempt.damageEventId ||
          !exactSingleLink(
            timelinePoint.links,
            "damage-event",
            attempt.damageEventId
          ) ||
          !exactSingleLink(
            timelinePoint.links,
            "reaction-damage-log",
            reactionDamage.id
          )
        ) {
          addIssue(
            context,
            [...attemptPath, "targetStateTimelinePointId"],
            "landed attempt requires its exact callback-owned Aura timeline point and micro-event tuple"
          );
        }

        if (
          recipientPhase !== undefined &&
          recipientPhase.hitResolutionLogIds.includes(
            attempt.hitResolutionLogId
          )
        ) {
          addIssue(
            context,
            [...attemptPath, "hitResolutionLogId"],
            "callback-owned hit must not be claimed by the recipient target phase"
          );
        }
      }

      if (exactV148Identity) {
        for (const issue of
          collectTargetPhaseV3BurningApplicationReferenceIssues({
            delivery,
            reactionDamage,
            hitResolutionLog: result.hitResolutionLog,
            damageEvents: result.damageEvents,
            elementalApplicationIcdLog:
              result.elementalApplicationIcdLog ?? []
          })) {
          addIssue(
            context,
            issue.path[0] === "attempts"
              ? [...deliveryPath, ...issue.path]
              : issue.path,
            issue.message
          );
        }
      }

      expectSemanticEqual(
        context,
        ["reactionDamageLog", reactionDamage.id, "checkedTargetIds"],
        reactionDamage.checkedTargetIds,
        checkedTargetIds,
        "Burning delivery checked targets"
      );
      expectSemanticEqual(
        context,
        ["reactionDamageLog", reactionDamage.id, "hitTargetIds"],
        reactionDamage.hitTargetIds,
        hitTargetIds,
        "Burning delivery landed targets"
      );
      expectSemanticEqual(
        context,
        ["reactionDamageLog", reactionDamage.id, "unresolvedTargetIds"],
        reactionDamage.unresolvedTargetIds,
        unresolvedTargetIds,
        "Burning delivery unresolved targets"
      );
      expectSemanticEqual(
        context,
        ["reactionDamageLog", reactionDamage.id, "damageEventIds"],
        reactionDamage.damageEventIds,
        damageEventIds,
        "Burning delivery damage children"
      );
      expectSemanticEqual(
        context,
        ["burningStateLog", burning.id, "damageEventIds"],
        burning.damageEventIds,
        damageEventIds,
        "Burning callback damage children"
      );
      expectSemanticEqual(
        context,
        [...deliveryPath, "attempts"],
        hitResolutionLogIds,
        result.hitResolutionLog
          .filter(
            (hit) =>
              hit.resolutionKind === "reaction-damage" &&
              hit.frame === phase.globalFrame &&
              hit.eventPriority === delivery.eventPriority &&
              hit.eventSequence === delivery.eventSequence
          )
          .map((hit) => hit.id),
        "Burning delivery micro-event hit rows"
      );
      expectSemanticEqual(
        context,
        [...deliveryPath, "attempts"],
        damageEventIds,
        result.damageEvents
          .filter(
            (damage) =>
              damage.frame === phase.globalFrame &&
              damage.eventPriority === delivery.eventPriority &&
              damage.eventSequence === delivery.eventSequence &&
              damage.kind === "transformative-reaction" &&
              damage.reaction === "burning"
          )
          .map((damage) => damage.id),
        "Burning delivery micro-event damage rows"
      );
      expectSemanticEqual(
        context,
        [...deliveryPath, "attempts"],
        delivery.attempts
          .filter(
            (attempt): attempt is Extract<
              TargetPhaseV3DeliveryAttempt,
              { outcome: "landed" }
            > => attempt.outcome === "landed"
          )
          .map((attempt) => attempt.targetStateTimelinePointId),
        result.targetStateTimeline.points
          .filter(
            (point) =>
              point.frame === phase.globalFrame &&
              point.eventPriority === delivery.eventPriority &&
              point.eventSequence === delivery.eventSequence &&
              point.cause === "reaction-damage-application"
          )
          .map((point) => point.id),
        "Burning delivery micro-event Aura timeline rows"
      );
      if (reactionDamage.excludedTargetIds.length !== 0) {
        addIssue(
          context,
          ["reactionDamageLog", reactionDamage.id, "excludedTargetIds"],
          "target-phase-v3 Burning fanout audits every registered enemy and cannot exclude targets"
        );
      }

      // A direct equality check keeps coordinated replacement of every
      // attempt reference from using a different delivery's rows.
      const projectedAttemptTuple = delivery.attempts.map((attempt) => ({
        targetId: attempt.targetId,
        outcome: attempt.outcome,
        hitResolutionLogId: attempt.hitResolutionLogId,
        damageEventId: attempt.damageEventId,
        ...(exactV148Identity
          ? {
              elementalApplicationIcdLogId:
                attempt.elementalApplicationIcdLogId
            }
          : {}),
        targetStateTimelinePointId:
          attempt.targetStateTimelinePointId
      }));
      const authoritativeAttemptTuple = result.enemyTargets.map(
        (target) => {
          const hitId = hitResolutionLogIds.find(
            (id) => hitById.get(id)?.targetId === target.id
          );
          const damageId = damageEventIds.find(
            (id) => damageById.get(id)?.targetId === target.id
          );
          const applicationId =
            elementalApplicationIcdLogIds.find(
              (id) =>
                applicationById.get(id)?.targetId === target.id
            );
          const timelineId = [...callbackTimelineOwners.keys()].find(
            (id) =>
              timelinePointById.get(id)?.targetId === target.id &&
              timelinePointById.get(id)?.eventSequence ===
                delivery.eventSequence
          );
          const outcome: TargetPhaseV3DeliveryAttempt["outcome"] =
            unresolvedTargetIds.includes(target.id)
              ? "unresolved"
              : hitTargetIds.includes(target.id)
                ? "landed"
                : "miss";
          return {
            targetId: target.id,
            outcome,
            hitResolutionLogId: hitId ?? null,
            damageEventId: damageId ?? null,
            ...(exactV148Identity
              ? {
                  elementalApplicationIcdLogId:
                    applicationId ?? null
                }
              : {}),
            targetStateTimelinePointId: timelineId ?? null
          };
        }
      );
      expectSemanticEqual(
        context,
        [...deliveryPath, "attempts"],
        projectedAttemptTuple,
        authoritativeAttemptTuple,
        "Burning delivery attempt reference order"
      );
    }

    const recipientAuraPointReferences =
      deliveryAuraPointsByRecipientPhase.get(
        `${phase.globalFrame}\u0000${phase.targetId}`
      ) ?? [];
    const preReactablePointIds = [
      ...phase.targetTasks.map(
        (task) => task.targetStateTimelinePointId
      ),
      ...recipientAuraPointReferences
        .filter(
          (reference) =>
            reference.applicationPhase === "before-reactable-tick"
        )
        .map((reference) => reference.pointId)
    ].sort((left, right) => left - right);
    const firstPhaseBoundaryPointId = Math.min(
      ...preReactablePointIds,
      ...phase.reactableTick.transitions.map(
        (transition) => transition.targetStateTimelinePointId
      ),
      Number.POSITIVE_INFINITY
    );
    let previousAuthoritativePoint:
      | SimulationResult["targetStateTimeline"]["points"][number]
      | undefined;
    for (
      let pointIndex = result.targetStateTimeline.points.length - 1;
      pointIndex >= 0;
      pointIndex -= 1
    ) {
      const candidate = result.targetStateTimeline.points[pointIndex]!;
      if (
        candidate.targetId === phase.targetId &&
        candidate.id < firstPhaseBoundaryPointId &&
        (candidate.frame < phase.globalFrame ||
          (phase.globalFrame === 0 &&
            candidate.frame === 0 &&
            candidate.cause === "simulation-start"))
      ) {
        previousAuthoritativePoint = candidate;
        break;
      }
    }
    if (previousAuthoritativePoint === undefined) {
      addIssue(
        context,
        [...phasePath, "auraBeforeTargetTasks"],
        "target phase requires a preceding authoritative target-state point"
      );
    } else {
      const sparseDecayIssue = ordinaryAuraDecayIssue(
        previousAuthoritativePoint.auraAfter,
        phase.auraBeforeTargetTasks,
        phase.reactableTick.fromTargetFrame
      );
      if (sparseDecayIssue !== null) {
        addIssue(
          context,
          [...phasePath, "auraBeforeTargetTasks"],
          `target phase sparse clock advance is discontinuous: ${sparseDecayIssue}`
        );
      }
    }
    let preReactableAuraCursor = phase.auraBeforeTargetTasks;
    for (const pointId of preReactablePointIds) {
      const point = timelinePointById.get(pointId);
      if (
        point === undefined ||
        point.targetId !== phase.targetId ||
        point.frame !== phase.globalFrame ||
        !semanticEqual(point.auraBefore, preReactableAuraCursor)
      ) {
        addIssue(
          context,
          [...phasePath, "auraAfterTargetTasks"],
          "target tasks and before-Reactable callback deliveries must form one continuous Aura chain"
        );
        continue;
      }
      preReactableAuraCursor = point.auraAfter;
    }
    if (
      !semanticEqual(
        preReactableAuraCursor,
        phase.auraAfterTargetTasks
      )
    ) {
      addIssue(
        context,
        [...phasePath, "auraAfterTargetTasks"],
        "auraAfterTargetTasks must equal the final task or before-Reactable delivery Aura"
      );
    }

    const decayIssue = ordinaryAuraDecayIssue(
      phase.auraAfterTargetTasks,
      phase.reactableTick.auraBefore
    );
    if (decayIssue !== null) {
      addIssue(
        context,
        [...phasePath, "reactableTick", "auraBefore"],
        `unexplained pre-Reactable Aura mutation: ${decayIssue}`
      );
    }

    let reactableAuraCursor = phase.reactableTick.auraBefore;
    const visitedTransitionPointIds = new Set<number>();
    for (const [transitionIndex, transition] of
      phase.reactableTick.transitions.entries()) {
      const previousTransition =
        phase.reactableTick.transitions[transitionIndex - 1];
      const naturalExpiryCleanupCollision =
        transition.kind === "electro-charged-cleanup" &&
        transition.outcome === "natural-expiry" &&
        previousTransition?.kind === "electro-charged-expiry" &&
        previousTransition.generation === transition.generation &&
        previousTransition.deadlineTargetFrame ===
          transition.deadlineTargetFrame &&
        previousTransition.periodicReactionLogId ===
          transition.periodicReactionLogId &&
        previousTransition.targetStateTimelinePointId ===
          transition.targetStateTimelinePointId;
      const reusesTransitionPoint =
        visitedTransitionPointIds.has(
          transition.targetStateTimelinePointId
        );
      if (!reusesTransitionPoint) {
        visitedTransitionPointIds.add(
          transition.targetStateTimelinePointId
        );
      } else if (!naturalExpiryCleanupCollision) {
        addIssue(
          context,
          [
            ...phasePath,
            "reactableTick",
            "transitions",
            transitionIndex,
            "targetStateTimelinePointId"
          ],
          "only a natural Electro-Charged expiry and cleanup collision may reuse one timeline point"
        );
      }
      const point = timelinePointById.get(
        transition.targetStateTimelinePointId
      );
      const expectedCause =
        transition.kind === "aura-natural-expiry"
          ? "aura-natural-expiry"
          : transition.kind === "frozen-expiry"
            ? "frozen-expiry"
            : transition.kind === "quicken-expiry"
              ? "quicken-expiry"
              : transition.kind === "burning-fuel-expiry"
                ? "burning-fuel-expiry"
                : transition.kind === "electro-charged-expiry"
                  ? "electro-charged-expiry"
                  : naturalExpiryCleanupCollision
                    ? "electro-charged-expiry"
                    : "electro-charged-cleanup";
      if (
        point === undefined ||
        point.targetId !== phase.targetId ||
        point.frame !== phase.globalFrame ||
        point.targetFrame !== phase.targetFrame ||
        point.cause !== expectedCause ||
        (!reusesTransitionPoint &&
          !semanticEqual(point.auraBefore, reactableAuraCursor))
      ) {
        addIssue(
          context,
          [...phasePath, "reactableTick", "transitions"],
          "Reactable.Tick transitions must form one continuous Aura chain"
        );
        continue;
      }

      const transitionPath = [
        ...phasePath,
        "reactableTick",
        "transitions",
        transitionIndex
      ] satisfies IssuePath;
      if (transition.kind === "aura-natural-expiry") {
        if (!exactLifecycleLinks(point.links, [])) {
          addIssue(
            context,
            [...transitionPath, "targetStateTimelinePointId"],
            "natural Aura expiry cannot claim an unrelated typed lifecycle log"
          );
        }
      } else if (transition.kind === "frozen-expiry") {
        claimUnique(
          frozenTransitionOwners,
          transition.frozenStateLogId,
          [...transitionPath, "frozenStateLogId"],
          "Frozen expiry lifecycle row"
        );
        const log = frozenById.get(transition.frozenStateLogId);
        if (
          log === undefined ||
          log.operation !== "expire" ||
          log.reason !== "FROZEN_DECAY_EXPIRED" ||
          log.generation !== transition.generation ||
          log.targetId !== phase.targetId ||
          log.targetName !== phase.targetName ||
          log.frame !== phase.globalFrame ||
          log.targetFrame !== phase.targetFrame ||
          !semanticEqual(log.auraBefore, point.auraBefore) ||
          !semanticEqual(log.auraAfter, point.auraAfter) ||
          !exactLifecycleLinks(point.links, [
            {
              kind: "frozen-state-log",
              id: transition.frozenStateLogId
            }
          ])
        ) {
          addIssue(
            context,
            [...transitionPath, "frozenStateLogId"],
            "Frozen expiry transition must backlink its exact expire row and timeline link"
          );
        }
      } else if (transition.kind === "quicken-expiry") {
        claimUnique(
          quickenTransitionOwners,
          transition.quickenStateLogId,
          [...transitionPath, "quickenStateLogId"],
          "Quicken expiry lifecycle row"
        );
        const log = quickenById.get(transition.quickenStateLogId);
        if (
          log === undefined ||
          log.operation !== "expire" ||
          log.reason !== "QUICKEN_DECAY_EXPIRED" ||
          log.generation !== transition.generation ||
          log.targetId !== phase.targetId ||
          log.targetName !== phase.targetName ||
          log.frame !== phase.globalFrame ||
          log.targetFrame !== phase.targetFrame ||
          !semanticEqual(log.auraBefore, point.auraBefore) ||
          !semanticEqual(log.auraAfter, point.auraAfter) ||
          !exactLifecycleLinks(point.links, [
            {
              kind: "quicken-state-log",
              id: transition.quickenStateLogId
            }
          ])
        ) {
          addIssue(
            context,
            [...transitionPath, "quickenStateLogId"],
            "Quicken expiry transition must backlink its exact expire row and timeline link"
          );
        }
      } else if (transition.kind === "burning-fuel-expiry") {
        claimUnique(
          burningFuelTransitionOwners,
          transition.burningStateLogId,
          [...transitionPath, "burningStateLogId"],
          "Burning Fuel expiry lifecycle row"
        );
        const burningLog = burningById.get(
          transition.burningStateLogId
        );
        const expectedLinks: Array<{ kind: string; id: number }> = [
          {
            kind: "burning-state-log",
            id: transition.burningStateLogId
          }
        ];
        let validQuickenRows = true;
        for (const [referenceIndex, quickenId] of
          transition.quickenStateLogIds.entries()) {
          claimUnique(
            quickenTransitionOwners,
            quickenId,
            [
              ...transitionPath,
              "quickenStateLogIds",
              referenceIndex
            ],
            "Burning-dependent Quicken lifecycle row"
          );
          const quickenLog = quickenById.get(quickenId);
          if (
            quickenLog === undefined ||
            quickenLog.operation !== "remove" ||
            quickenLog.reason !== "BURNING_FUEL_EXPIRED" ||
            quickenLog.targetId !== phase.targetId ||
            quickenLog.targetName !== phase.targetName ||
            quickenLog.frame !== phase.globalFrame ||
            quickenLog.targetFrame !== phase.targetFrame ||
            !semanticEqual(quickenLog.auraBefore, point.auraBefore) ||
            !semanticEqual(quickenLog.auraAfter, point.auraAfter)
          ) {
            validQuickenRows = false;
          }
          expectedLinks.push({
            kind: "quicken-state-log",
            id: quickenId
          });
        }
        if (
          burningLog === undefined ||
          burningLog.operation !== "fuel-expire" ||
          burningLog.reason !== "FUEL_EXPIRED" ||
          burningLog.generation !== transition.generation ||
          burningLog.targetId !== phase.targetId ||
          burningLog.targetName !== phase.targetName ||
          burningLog.frame !== phase.globalFrame ||
          burningLog.targetFrame !== phase.targetFrame ||
          !semanticEqual(burningLog.auraBefore, point.auraBefore) ||
          !semanticEqual(burningLog.auraAfter, point.auraAfter) ||
          !validQuickenRows ||
          !exactLifecycleLinks(point.links, expectedLinks)
        ) {
          addIssue(
            context,
            [...transitionPath, "burningStateLogId"],
            "Burning Fuel expiry transition must backlink its exact Burning and dependent Quicken rows"
          );
        }
      } else if (transition.kind === "electro-charged-expiry") {
        claimUnique(
          periodicTransitionOwners,
          transition.periodicReactionLogId,
          [...transitionPath, "periodicReactionLogId"],
          "Electro-Charged expiry lifecycle row"
        );
        const log = periodicById.get(
          transition.periodicReactionLogId
        );
        if (
          log === undefined ||
          log.operation !== "stop" ||
          log.reason !== "AURA_DECAY_EXPIRED" ||
          log.generation !== transition.generation ||
          log.targetId !== phase.targetId ||
          log.targetName !== phase.targetName ||
          log.frame !== phase.globalFrame ||
          log.targetFrame !== phase.targetFrame ||
          !semanticEqual(log.auraBefore, point.auraBefore) ||
          !semanticEqual(log.auraAfter, point.auraAfter) ||
          !exactLifecycleLinks(point.links, [
            {
              kind: "periodic-reaction-log",
              id: transition.periodicReactionLogId
            }
          ])
        ) {
          addIssue(
            context,
            [...transitionPath, "periodicReactionLogId"],
            "Electro-Charged expiry transition must backlink its exact stop row and timeline link"
          );
        }
      } else {
        const task = reactionTaskById.get(
          transition.reactionTaskLogId
        );
        const cleanup = task?.electroChargedCleanup;
        const cleanupMatches =
          task !== undefined &&
          task.targetId === phase.targetId &&
          task.targetName === phase.targetName &&
          cleanup !== undefined &&
          cleanup !== null &&
          cleanup.outcome !== "pending-at-end" &&
          cleanup.generation === transition.generation &&
          cleanup.deadlineTargetFrame ===
            transition.deadlineTargetFrame &&
          cleanup.resolvedGlobalFrame === phase.globalFrame &&
          cleanup.resolvedTargetFrame === phase.targetFrame &&
          cleanup.targetPhaseLogId === phase.id &&
          cleanup.targetStateTimelinePointId ===
            transition.targetStateTimelinePointId &&
          cleanup.outcome === transition.outcome &&
          cleanup.periodicReactionLogId ===
            transition.periodicReactionLogId;
        const expectedLinks: Array<{ kind: string; id: number }> = [];
        if (transition.periodicReactionLogId !== null) {
          expectedLinks.push({
            kind: "periodic-reaction-log",
            id: transition.periodicReactionLogId
          });
        }
        if (
          !cleanupMatches ||
          !exactLifecycleLinks(point.links, expectedLinks)
        ) {
          addIssue(
            context,
            [...transitionPath, "reactionTaskLogId"],
            "Electro-Charged cleanup transition must backlink its exact task audit, periodic row, and timeline point"
          );
        }
      }
      if (!reusesTransitionPoint) {
        reactableAuraCursor = point.auraAfter;
      }
    }
    if (!semanticEqual(reactableAuraCursor, phase.reactableTick.auraAfter)) {
      addIssue(
        context,
        [...phasePath, "reactableTick", "auraAfter"],
        "Reactable.Tick Aura must end at its final typed transition"
      );
    }

    let postReactableAuraCursor = phase.reactableTick.auraAfter;
    const postReactablePointIds = recipientAuraPointReferences
      .filter(
        (reference) =>
          reference.applicationPhase === "after-reactable-tick"
      )
      .map((reference) => reference.pointId)
      .sort((left, right) => left - right);
    for (const pointId of postReactablePointIds) {
      const point = timelinePointById.get(pointId);
      if (
        point === undefined ||
        point.targetId !== phase.targetId ||
        point.frame !== phase.globalFrame ||
        !semanticEqual(point.auraBefore, postReactableAuraCursor)
      ) {
        addIssue(
          context,
          [...phasePath, "reactableTick", "auraAfter"],
          "after-Reactable callback deliveries must continue from the phase Aura boundary"
        );
        continue;
      }
      postReactableAuraCursor = point.auraAfter;
    }
  }

  for (const [rowIndex, burning] of result.burningStateLog.entries()) {
    const callbackOwned =
      burning.operation === "tick" ||
      burning.operation === "tick-skipped" ||
      (burning.operation === "stop" &&
        callbackOwnedStop(result, burning.id));
    const owner = burningTaskOwners.get(burning.id);
    if (callbackOwned !== (owner !== undefined)) {
      addIssue(
        context,
        ["burningStateLog", rowIndex, "id"],
        callbackOwned
          ? "callback-owned Burning lifecycle row requires exactly one v3 target task"
          : "non-callback Burning lifecycle row cannot be claimed by a v3 target task"
      );
    }
    if (
      burning.operation === "tick" &&
      burning.reactionDamageLogId !== null &&
      !reactionDamageDeliveryOwners.has(
        burning.reactionDamageLogId
      )
    ) {
      addIssue(
        context,
        ["burningStateLog", rowIndex, "reactionDamageLogId"],
        "Burning tick reaction damage requires exactly one v3 callback delivery"
      );
    }
  }

  for (const [rowIndex, reactionDamage] of
    result.reactionDamageLog.entries()) {
    const owned = reactionDamageDeliveryOwners.has(reactionDamage.id);
    if (
      (reactionDamage.scheduleKind === "burning-tick") !== owned
    ) {
      addIssue(
        context,
        ["reactionDamageLog", rowIndex, "id"],
        reactionDamage.scheduleKind === "burning-tick"
          ? "every target-phase-v3 burning-tick parent requires exactly one callback delivery"
          : "v3 callback delivery cannot claim a non-Burning reaction parent"
      );
    }
  }

  if (exactV148Identity) {
    for (const [rowIndex, application] of
      (result.elementalApplicationIcdLog ?? []).entries()) {
      if (
        application.sourceKind === "burning-tick" &&
        !callbackApplicationOwners.has(application.id)
      ) {
        addIssue(
          context,
          ["elementalApplicationIcdLog", rowIndex, "id"],
          `target-phase-v3 Burning application row ${application.id} requires exactly one callback delivery attempt`
        );
      }
    }
  }

  const targetLifecycleCauses = new Set([
    "aura-natural-expiry",
    "frozen-expiry",
    "quicken-expiry",
    "burning-fuel-expiry",
    "electro-charged-expiry",
    "electro-charged-cleanup"
  ]);
  for (const [pointIndex, point] of
    result.targetStateTimeline.points.entries()) {
    if (
      targetLifecycleCauses.has(point.cause) &&
      !phaseOwnedTimelinePointIds.has(point.id)
    ) {
      addIssue(
        context,
        ["targetStateTimeline", "points", pointIndex, "id"],
        `target lifecycle point ${point.id} (${point.cause}) requires exactly one Reactable.Tick transition`
      );
    }
  }

  for (const [hitId, ownerPath] of callbackHitOwners) {
    if (phaseClaimedHitIds.has(hitId)) {
      addIssue(
        context,
        ownerPath,
        `callback-owned hit-resolution row ${hitId} is also claimed by a recipient target phase`
      );
    }
  }
  for (const [rowIndex, hit] of result.hitResolutionLog.entries()) {
    if (
      !callbackHitOwners.has(hit.id) &&
      !phaseHitOwners.has(hit.id)
    ) {
      addIssue(
        context,
        ["hitResolutionLog", rowIndex, "id"],
        `ordinary target-phase-v3 hit-resolution row ${hit.id} requires exactly one phase reference`
      );
    }
  }
  for (const [rowIndex, task] of result.reactionTaskLog.entries()) {
    if (!phaseReactionTaskOwners.has(task.id)) {
      addIssue(
        context,
        ["reactionTaskLog", rowIndex, "id"],
        `target-phase-v3 reaction-task row ${task.id} requires exactly one phase reference`
      );
    }
  }
  for (const [pointId, ownerPath] of callbackTimelineOwners) {
    if (phaseOwnedTimelinePointIds.has(pointId)) {
      addIssue(
        context,
        ownerPath,
        `callback-owned target-state point ${pointId} cannot double as a target task or Reactable.Tick transition`
      );
    }
  }
}

/** Standalone internal/facet boundary; the full public wire stays in result-schema. */
export const targetPhaseV3ResultReferencesSchema = z
  .object({
    schemaVersion: z.string(),
    engineVersion: z.string(),
    config: z
      .object({
        schemaVersion: z.string(),
        engineVersion: z.string(),
        targetTaskModel: z
          .object({ mode: z.string() })
          .passthrough(),
        timeline: z
          .object({ mode: z.string(), fps: z.number() })
          .nullable()
          .optional(),
        reactionEngine: z
          .object({ mode: z.string() })
          .nullable()
          .optional()
      })
      .passthrough(),
    enemyTargets: z.array(z.unknown()),
    targetPhaseLog: z.array(z.unknown()),
    targetTaskPhaseLog: z.array(z.unknown()),
    burningStateLog: z.array(z.unknown()),
    reactionDamageLog: z.array(z.unknown()),
    elementalApplicationIcdLog: z.array(z.unknown()).optional(),
    hitResolutionLog: z.array(z.unknown()),
    damageEvents: z.array(z.unknown()),
    targetStateTimeline: z
      .object({ points: z.array(z.unknown()) })
      .passthrough()
  })
  .passthrough()
  .superRefine((result, context) => {
    try {
      validateTargetPhaseV3Integrity(
        result as unknown as SimulationResult,
        context
      );
    } catch {
      addIssue(
        context,
        [],
        "malformed target-phase-v3 result reference input"
      );
    }
  });
