import type { RefinementCtx } from "zod";

import {
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE
} from "@genshin-dps-lab/icd-profiles";

import type {
  AuraStateEntry,
  FreezeBrokenAttackLogEntry,
  FrozenStateLogEntry,
  SimulationResultForV152,
  TargetStateTimelinePoint
} from "./types";

type IssuePath = Array<string | number>;

const AURA_GAUGE_EPSILON = 1e-10;

const SYNC_PHASE = {
  disposition: "reference-audit-only-not-dispatched",
  referencePhase: "same-call-stack-immediate",
  order: [
    "on-aura-durability-depleted-frozen",
    "on-apply-attack-freeze-broken",
    "on-enemy-hit-freeze-broken",
    "damage-log-freeze-broken"
  ]
} as const;

const END_OF_FRAME_PHASE_COMMON = {
  disposition: "reference-audit-only-not-dispatched",
  referencePhase: "zero-delay-core-task",
  order: [
    "apply-zero-damage",
    "on-enemy-damage-freeze-broken-zero",
    "attack-callbacks-none-supplied"
  ],
  damage: 0
} as const;

function addIssue(
  context: RefinementCtx,
  path: IssuePath,
  message: string
): void {
  context.addIssue({ code: "custom", path, message });
}

function wireEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) =>
        wireEqual(value, right[index])
      )
    );
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        wireEqual(leftRecord[key], rightRecord[key])
    )
  );
}

function frozenGauge(
  aura: readonly AuraStateEntry[]
): number {
  return aura.reduce(
    (total, entry) =>
      entry.element === "frozen"
        ? total + entry.gaugeUnits
        : total,
    0
  );
}

function hasFrozenEntry(
  aura: readonly AuraStateEntry[]
): boolean {
  return aura.some((entry) => entry.element === "frozen");
}

function isEligibleTerminalFrozenRow(
  row: FrozenStateLogEntry
): boolean {
  const eligibleSource =
    (row.reaction === "freeze" &&
      row.operation === "expire") ||
    (row.reaction === "shatter" &&
      (row.operation === "poise-consume" ||
        row.operation === "shatter-consume")) ||
    (row.reaction === "swirlCryo" &&
      row.operation === "consume") ||
    (row.reaction === "crystallizeCryo" &&
      row.operation === "consume");
  return (
    eligibleSource &&
    frozenGauge(row.auraBefore) > AURA_GAUGE_EPSILON &&
    !hasFrozenEntry(row.auraAfter)
  );
}

function terminalOwnerPoints(
  result: SimulationResultForV152,
  source: FrozenStateLogEntry,
  depletionDamageEventId: number | null
): TargetStateTimelinePoint[] {
  return result.targetStateTimeline.points.filter(
    (point) => {
      if (
        point.targetId !== source.targetId ||
        point.targetName !== source.targetName ||
        point.frame !== source.frame ||
        !wireEqual(point.auraBefore, source.auraBefore) ||
        !wireEqual(point.auraAfter, source.auraAfter)
      ) {
        return false;
      }
      if (source.operation === "expire") {
        return point.links.some(
          (link) =>
            link.kind === "frozen-state-log" &&
            link.id === source.id
        );
      }
      return (
        point.primaryDamageEventId ===
        depletionDamageEventId
      );
    }
  );
}

/**
 * Strict cross-log proof for the normalized V1.52 Freeze Broken audit.
 *
 * The fixed reference callback is represented by exactly one audit row for
 * each supported Frozen positive-to-depleted transition. It deliberately
 * creates neither a DamageEvent nor a HitResolution row and does not claim
 * that callback subscribers, Mona's bubble, or impulse physics ran locally.
 */
export function validateFreezeBrokenAttackIntegrity(
  result: SimulationResultForV152,
  context: RefinementCtx
): void {
  const model = result.config.freezeBrokenAttackModel;
  if (
    model.mode ===
    LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE
  ) {
    if (result.freezeBrokenAttackLog.length !== 0) {
      addIssue(
        context,
        ["freezeBrokenAttackLog"],
        "the legacy V1 Freeze Broken policy requires an empty audit log"
      );
    }
    return;
  }
  if (
    model.mode !== GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE
  ) {
    addIssue(
      context,
      ["config", "freezeBrokenAttackModel", "mode"],
      "V1.52 requires a recognized Freeze Broken attack policy mode"
    );
    return;
  }

  const frozenRowById = new Map(
    result.frozenStateLog.map((row) => [row.id, row])
  );
  const eligibleRows = result.frozenStateLog.filter(
    isEligibleTerminalFrozenRow
  );
  const eligibleIds = new Set(
    eligibleRows.map((row) => row.id)
  );
  const callbackCountByFrozenRowId = new Map<
    number,
    number
  >();
  const activationSourceByTerminalRowId = new Map<
    number,
    number | null
  >();
  const activeFreezeSourceByTarget = new Map<
    string,
    { damageEventId: number | null }
  >();

  for (const frozenRow of result.frozenStateLog) {
    const active = activeFreezeSourceByTarget.get(
      frozenRow.targetId
    );
    if (
      frozenRow.operation === "start" ||
      frozenRow.operation === "refresh"
    ) {
      activeFreezeSourceByTarget.set(frozenRow.targetId, {
        damageEventId: frozenRow.triggerDamageEventId
      });
      continue;
    }
    if (isEligibleTerminalFrozenRow(frozenRow)) {
      activationSourceByTerminalRowId.set(
        frozenRow.id,
        active?.damageEventId ?? null
      );
    }
    if (!hasFrozenEntry(frozenRow.auraAfter)) {
      activeFreezeSourceByTarget.delete(frozenRow.targetId);
    }
  }

  let previousSourceFrozenStateLogId = -1;
  const lastIntraEventSequenceByParent = new Map<
    string,
    number
  >();
  const resolvedActorId = result.config.characters[0]?.id;

  result.freezeBrokenAttackLog.forEach((entry, index) => {
    const path = [
      "freezeBrokenAttackLog",
      index
    ] satisfies IssuePath;
    if (entry.id !== index) {
      addIssue(
        context,
        [...path, "id"],
        "Freeze Broken audit IDs must be contiguous and index-addressable"
      );
    }
    if (
      entry.sourceFrozenStateLogId <=
      previousSourceFrozenStateLogId
    ) {
      addIssue(
        context,
        [...path, "sourceFrozenStateLogId"],
        "Freeze Broken rows must preserve terminal Frozen-state log order"
      );
    }
    previousSourceFrozenStateLogId =
      entry.sourceFrozenStateLogId;

    const source = frozenRowById.get(
      entry.sourceFrozenStateLogId
    );
    if (source === undefined) {
      addIssue(
        context,
        [...path, "sourceFrozenStateLogId"],
        `references missing Frozen-state row ${entry.sourceFrozenStateLogId}`
      );
      return;
    }
    callbackCountByFrozenRowId.set(
      source.id,
      (callbackCountByFrozenRowId.get(source.id) ?? 0) + 1
    );
    if (!eligibleIds.has(source.id)) {
      addIssue(
        context,
        [...path, "sourceFrozenStateLogId"],
        "must reference an eligible expiry, poise, shatter, Swirl-Cryo, or Crystallize-Cryo terminal transition"
      );
    }

    const expectedDepletionDamageEventId =
      source.operation === "expire"
        ? null
        : source.triggerDamageEventId;
    const expectedSourceFreezeDamageEventId =
      activationSourceByTerminalRowId.get(source.id) ??
      null;
    const expectedAttack = {
      actorIndex: 0,
      resolvedActorId,
      damageSource: "receiving-target",
      damageSourceTargetId: source.targetId,
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
      doNotLog: true
    } as const;

    const copiedFields: Array<
      [keyof FreezeBrokenAttackLogEntry, unknown]
    > = [
      ["frame", source.frame],
      ["targetFrame", source.targetFrame],
      ["timeSeconds", source.timeSeconds],
      ["targetId", source.targetId],
      ["targetName", source.targetName],
      ["generation", source.generation],
      ["depletionOperation", source.operation],
      ["reaction", source.reaction],
      ["reason", source.reason],
      [
        "depletionDamageEventId",
        expectedDepletionDamageEventId
      ],
      [
        "sourceFreezeDamageEventId",
        expectedSourceFreezeDamageEventId
      ],
      ["frozenGaugeBefore", frozenGauge(source.auraBefore)],
      ["frozenGaugeAfter", 0],
      ["damageEventId", null],
      ["hitResolutionLogId", null]
    ];
    for (const [field, expected] of copiedFields) {
      if (!Object.is(entry[field], expected)) {
        addIssue(
          context,
          [...path, field],
          `must equal the authoritative terminal Frozen-state ${String(field)}`
        );
      }
    }
    if (!wireEqual(entry.attack, expectedAttack)) {
      addIssue(
        context,
        [...path, "attack"],
        "must equal the fixed reference-only Freeze Broken AttackInfo projection"
      );
    }
    if (!wireEqual(entry.syncPhase, SYNC_PHASE)) {
      addIssue(
        context,
        [...path, "syncPhase"],
        "must preserve the fixed synchronous reference phase order"
      );
    }
    const expectedEndOfFramePhase = {
      ...END_OF_FRAME_PHASE_COMMON,
      relativeToTriggerEnemyDamage:
        source.operation === "expire"
          ? "not-applicable"
          : "before"
    } as const;
    if (
      !wireEqual(
        entry.endOfFramePhase,
        expectedEndOfFramePhase
      )
    ) {
      addIssue(
        context,
        [...path, "endOfFramePhase"],
        "must preserve the fixed end-of-frame reference phase order"
      );
    }
    if (
      entry.executionStatus !==
      "reference-audit-only-not-dispatched"
    ) {
      addIssue(
        context,
        [...path, "executionStatus"],
        "must remain audit-only until callback subscribers and impulse physics are implemented"
      );
    }

    const ownerPoints = terminalOwnerPoints(
      result,
      source,
      expectedDepletionDamageEventId
    );
    if (ownerPoints.length !== 1) {
      addIssue(
        context,
        [...path, "triggerEventSequence"],
        "must resolve exactly one terminal target-state owner point"
      );
      return;
    }
    const owner = ownerPoints[0]!;
    for (const [field, expected] of [
      ["triggerEventType", owner.eventType],
      ["triggerEventPriority", owner.eventPriority],
      ["triggerEventSequence", owner.eventSequence]
    ] as const) {
      if (entry[field] !== expected) {
        addIssue(
          context,
          [...path, field],
          `must equal the terminal target-state owner ${field}`
        );
      }
    }
    if (
      owner.intraEventSequence === null ||
      entry.intraEventSequence <= owner.intraEventSequence
    ) {
      addIssue(
        context,
        [...path, "intraEventSequence"],
        "must follow the terminal Frozen mutation within the same parent event"
      );
    }
    const parentKey = `${entry.frame}\u0000${entry.triggerEventType}\u0000${entry.triggerEventPriority}\u0000${entry.triggerEventSequence}`;
    const previousIntra =
      lastIntraEventSequenceByParent.get(parentKey);
    if (
      previousIntra !== undefined &&
      entry.intraEventSequence <= previousIntra
    ) {
      addIssue(
        context,
        [...path, "intraEventSequence"],
        "Freeze Broken rows under one parent event require unique, strictly increasing intra-event sequence values"
      );
    }
    lastIntraEventSequenceByParent.set(
      parentKey,
      entry.intraEventSequence
    );
  });

  for (const eligible of eligibleRows) {
    const count =
      callbackCountByFrozenRowId.get(eligible.id) ?? 0;
    if (count !== 1) {
      addIssue(
        context,
        ["frozenStateLog", eligible.id],
        `eligible terminal Frozen transition requires exactly one Freeze Broken audit row; received ${count}`
      );
    }
  }
}
