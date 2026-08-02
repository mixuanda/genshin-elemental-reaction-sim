import type {
  FreezeBrokenAttackLogEntry,
  FreezeBrokenAttackModel,
  FrozenStateLogEntry,
  SimulationEventType,
} from "@genshin-dps-lab/schemas";
import { AURA_EPSILON } from "./aura";

/** Local Aura depletion epsilon; the pinned gcsim 1e-11 value is reference-only. */
export const FREEZE_BROKEN_DEPLETION_EPSILON = AURA_EPSILON;

export type FreezeBrokenAttackRuntimeMode = FreezeBrokenAttackModel["mode"];

export type FreezeBrokenAttackTriggerSource =
  | "natural-decay"
  | "poise"
  | "shatter"
  | "swirl-frozen"
  | "crystallize-frozen";

export interface FreezeBrokenAttackClassification {
  terminalFrozenStateLogId: number;
  triggerSource: FreezeBrokenAttackTriggerSource;
  depletionOperation: FreezeBrokenAttackLogEntry["depletionOperation"];
  reaction: FreezeBrokenAttackLogEntry["reaction"];
  frozenGaugeBefore: number;
  frozenGaugeAfter: number;
}

export interface FreezeBrokenAttackAuditInput {
  id: number;
  mode: FreezeBrokenAttackRuntimeMode;
  frozenStateEntry: FrozenStateLogEntry;
  resolvedActorId: string;
  depletionDamageEventId: number | null;
  sourceFreezeDamageEventId: number | null;
  triggerEventType: SimulationEventType;
  triggerEventPriority: number;
  triggerEventSequence: number;
  intraEventSequence: number;
  callbackDeliveryLogIds?: Readonly<{
    sync: [number, number, number];
    endOfFrame: [number, number];
  }>;
}

function frozenGauge(
  aura: Readonly<FrozenStateLogEntry["auraBefore"]>,
): number {
  return aura.reduce(
    (total, entry) =>
      entry.element === "frozen" ? total + entry.gaugeUnits : total,
    0,
  );
}

function triggerSourceFor(
  entry: FrozenStateLogEntry,
): Pick<
  FreezeBrokenAttackClassification,
  "triggerSource" | "depletionOperation" | "reaction"
> | null {
  if (entry.reaction === "freeze" && entry.operation === "expire") {
    return {
      triggerSource: "natural-decay",
      depletionOperation: "expire",
      reaction: "freeze",
    };
  }
  if (entry.reaction === "shatter" && entry.operation === "poise-consume") {
    return {
      triggerSource: "poise",
      depletionOperation: "poise-consume",
      reaction: "shatter",
    };
  }
  if (entry.reaction === "shatter" && entry.operation === "shatter-consume") {
    return {
      triggerSource: "shatter",
      depletionOperation: "shatter-consume",
      reaction: "shatter",
    };
  }
  if (entry.reaction === "swirlCryo" && entry.operation === "consume") {
    return {
      triggerSource: "swirl-frozen",
      depletionOperation: "consume",
      reaction: "swirlCryo",
    };
  }
  if (
    entry.reaction === "crystallizeCryo" &&
    entry.operation === "consume"
  ) {
    return {
      triggerSource: "crystallize-frozen",
      depletionOperation: "consume",
      reaction: "crystallizeCryo",
    };
  }
  return null;
}

/**
 * Classifies the narrow, normalized Freeze Broken boundary. The function is
 * intentionally side-effect free: it does not dispatch callbacks, consume
 * RNG, or manufacture a DamageEvent. Runtime exactly-once bookkeeping is
 * owned by the caller because it is scoped to one simulation run.
 */
export function classifyFreezeBrokenAttackTransition(
  mode: FreezeBrokenAttackRuntimeMode,
  entry: FrozenStateLogEntry,
): FreezeBrokenAttackClassification | null {
  if (mode === "legacy-no-freeze-broken-attack-callback") return null;
  if (
    mode !== "fixed-gcsim-freeze-broken-attack-normalized-v2" &&
    mode !== "fixed-gcsim-freeze-broken-callback-dispatch-v3"
  ) {
    throw new RangeError(`unknown Freeze Broken attack mode: ${String(mode)}`);
  }

  const trigger = triggerSourceFor(entry);
  if (trigger === null) return null;

  const frozenGaugeBefore = frozenGauge(entry.auraBefore);
  const frozenGaugeAfter = frozenGauge(entry.auraAfter);
  if (
    frozenGaugeBefore <= FREEZE_BROKEN_DEPLETION_EPSILON ||
    entry.auraAfter.some((aura) => aura.element === "frozen")
  ) {
    return null;
  }

  return {
    terminalFrozenStateLogId: entry.id,
    ...trigger,
    frozenGaugeBefore,
    frozenGaugeAfter,
  };
}

/** Builds the single audit row without dispatching either reference phase. */
export function buildFreezeBrokenAttackLogEntry(
  input: FreezeBrokenAttackAuditInput,
): FreezeBrokenAttackLogEntry | null {
  const classification = classifyFreezeBrokenAttackTransition(
    input.mode,
    input.frozenStateEntry,
  );
  if (classification === null) return null;

  const entry = input.frozenStateEntry;
  const common = {
    id: input.id,
    frame: entry.frame,
    ...(entry.targetFrame === undefined
      ? {}
      : { targetFrame: entry.targetFrame }),
    timeSeconds: entry.timeSeconds,
    targetId: entry.targetId,
    targetName: entry.targetName,
    generation: entry.generation,
    sourceFrozenStateLogId: entry.id,
    depletionOperation: classification.depletionOperation,
    reaction: classification.reaction,
    reason: entry.reason,
    depletionDamageEventId: input.depletionDamageEventId,
    sourceFreezeDamageEventId: input.sourceFreezeDamageEventId,
    triggerEventType: input.triggerEventType,
    triggerEventPriority: input.triggerEventPriority,
    triggerEventSequence: input.triggerEventSequence,
    intraEventSequence: input.intraEventSequence,
    frozenGaugeBefore: classification.frozenGaugeBefore,
    frozenGaugeAfter: 0,
    attack: {
      actorIndex: 0,
      resolvedActorId: input.resolvedActorId,
      damageSource: "receiving-target",
      damageSourceTargetId: entry.targetId,
      ability: "Freeze Broken",
      attackTag: "AttackTagNone",
      icdTag: "ICDTagNone",
      icdGroup: "ICDGroupDefault",
      strikeType: "StrikeTypeDefault",
      element: "NoElement",
      noImpulse: false,
      durability: 0,
      multiplier: 0,
      flatDamage: 0,
      snapshotDelayFrames: -1,
      damageDelayFrames: 0,
      targeting: "single-target",
      sourceIsSim: true,
      doNotLog: true,
    },
    damageEventId: null,
    hitResolutionLogId: null,
  } as const;

  if (input.mode === "fixed-gcsim-freeze-broken-callback-dispatch-v3") {
    if (input.callbackDeliveryLogIds === undefined) {
      throw new Error(
        "Freeze Broken V3 audit construction requires all five callback delivery log IDs.",
      );
    }
    return {
      ...common,
      syncPhase: {
        disposition: "callback-bus-dispatched-normalized",
        referencePhase: "same-call-stack-immediate",
        order: [
          "on-aura-durability-depleted-frozen",
          "on-apply-attack-freeze-broken",
          "on-enemy-hit-freeze-broken",
          "damage-log-freeze-broken",
        ],
        callbackDeliveryLogIds: input.callbackDeliveryLogIds.sync,
      },
      endOfFramePhase: {
        disposition: "callback-bus-dispatched-normalized",
        referencePhase: "zero-delay-core-task",
        order: [
          "apply-zero-damage",
          "on-enemy-damage-freeze-broken-zero",
          "attack-callbacks-none-supplied",
        ],
        callbackDeliveryLogIds: input.callbackDeliveryLogIds.endOfFrame,
        damage: 0,
        relativeToTriggerEnemyDamage:
          input.depletionDamageEventId === null ? "not-applicable" : "before",
      },
      executionStatus: "callback-bus-dispatched-normalized",
    };
  }

  return {
    ...common,
    syncPhase: {
      disposition: "reference-audit-only-not-dispatched",
      referencePhase: "same-call-stack-immediate",
      order: [
        "on-aura-durability-depleted-frozen",
        "on-apply-attack-freeze-broken",
        "on-enemy-hit-freeze-broken",
        "damage-log-freeze-broken",
      ],
    },
    endOfFramePhase: {
      disposition: "reference-audit-only-not-dispatched",
      referencePhase: "zero-delay-core-task",
      order: [
        "apply-zero-damage",
        "on-enemy-damage-freeze-broken-zero",
        "attack-callbacks-none-supplied",
      ],
      damage: 0,
      relativeToTriggerEnemyDamage:
        input.depletionDamageEventId === null ? "not-applicable" : "before",
    },
    executionStatus: "reference-audit-only-not-dispatched",
  };
}

/** Pure batch projection used by tests and offline audits. */
export function collectFreezeBrokenAttackTransitions(
  mode: FreezeBrokenAttackRuntimeMode,
  entries: readonly FrozenStateLogEntry[],
): FreezeBrokenAttackClassification[] {
  const emittedTerminalRows = new Set<number>();
  const result: FreezeBrokenAttackClassification[] = [];
  for (const entry of entries) {
    const classification = classifyFreezeBrokenAttackTransition(mode, entry);
    if (
      classification === null ||
      emittedTerminalRows.has(classification.terminalFrozenStateLogId)
    ) {
      continue;
    }
    emittedTerminalRows.add(classification.terminalFrozenStateLogId);
    result.push(classification);
  }
  return result;
}
