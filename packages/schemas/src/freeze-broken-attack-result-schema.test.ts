import { describe, expect, it } from "vitest";

import { freezeBrokenAttackLogEntrySchema } from "./result-schema";

function validExpiryEntry() {
  return {
    id: 0,
    frame: 60,
    targetFrame: 58,
    timeSeconds: 1,
    targetId: "enemy-0",
    targetName: "Enemy",
    generation: 2,
    sourceFrozenStateLogId: 3,
    depletionOperation: "expire" as const,
    reaction: "freeze" as const,
    reason: "frozen-duration-expired",
    depletionDamageEventId: null,
    sourceFreezeDamageEventId: 4,
    triggerEventType: "frozenExpiry" as const,
    triggerEventPriority: 2,
    triggerEventSequence: 9,
    intraEventSequence: 6,
    frozenGaugeBefore: 0.25,
    frozenGaugeAfter: 0 as const,
    attack: {
      actorIndex: 0 as const,
      resolvedActorId: "actor-0",
      damageSource: "receiving-target" as const,
      damageSourceTargetId: "enemy-0",
      ability: "Freeze Broken" as const,
      attackTag: "AttackTagNone" as const,
      icdTag: "ICDTagNone" as const,
      icdGroup: "ICDGroupDefault" as const,
      strikeType: "StrikeTypeDefault" as const,
      element: "NoElement" as const,
      noImpulse: false as const,
      durability: 0 as const,
      multiplier: 0 as const,
      flatDamage: 0 as const,
      snapshotDelayFrames: -1 as const,
      damageDelayFrames: 0 as const,
      targeting: "single-target" as const,
      sourceIsSim: true as const,
      doNotLog: true as const
    },
    syncPhase: {
      disposition:
        "reference-audit-only-not-dispatched" as const,
      referencePhase: "same-call-stack-immediate" as const,
      order: [
        "on-aura-durability-depleted-frozen",
        "on-apply-attack-freeze-broken",
        "on-enemy-hit-freeze-broken",
        "damage-log-freeze-broken"
      ] as const
    },
    endOfFramePhase: {
      disposition:
        "reference-audit-only-not-dispatched" as const,
      referencePhase: "zero-delay-core-task" as const,
      order: [
        "apply-zero-damage",
        "on-enemy-damage-freeze-broken-zero",
        "attack-callbacks-none-supplied"
      ] as const,
      damage: 0 as const,
      relativeToTriggerEnemyDamage:
        "not-applicable" as const
    },
    executionStatus:
      "reference-audit-only-not-dispatched" as const,
    damageEventId: null,
    hitResolutionLogId: null
  };
}

describe("Freeze Broken attack result leaf schema", () => {
  it("accepts the exact single-row, two-phase natural-expiry audit", () => {
    expect(
      freezeBrokenAttackLogEntrySchema.parse(
        validExpiryEntry()
      )
    ).toEqual(validExpiryEntry());
  });

  it("accepts a damage-triggered supported source with the before relation", () => {
    const entry = validExpiryEntry();
    expect(
      freezeBrokenAttackLogEntrySchema.safeParse({
        ...entry,
        depletionOperation: "shatter-consume",
        reaction: "shatter",
        depletionDamageEventId: 12,
        triggerEventType: "hit",
        endOfFramePhase: {
          ...entry.endOfFramePhase,
          relativeToTriggerEnemyDamage: "before"
        }
      }).success
    ).toBe(true);
  });

  it.each([
    ["melt", "consume"],
    ["superconduct", "consume"],
    ["freeze", "consume"],
    ["swirlCryo", "expire"],
    ["crystallizeCryo", "poise-consume"]
  ])(
    "rejects ineligible %s/%s terminal sources",
    (reaction, operation) => {
      expect(
        freezeBrokenAttackLogEntrySchema.safeParse({
          ...validExpiryEntry(),
          reaction,
          depletionOperation: operation
        }).success
      ).toBe(false);
    }
  );

  it("rejects any drift in fixed attack literals, phase order, or audit-only IDs", () => {
    const entry = validExpiryEntry();
    for (const candidate of [
      {
        ...entry,
        attack: { ...entry.attack, noImpulse: true }
      },
      {
        ...entry,
        syncPhase: {
          ...entry.syncPhase,
          order: [...entry.syncPhase.order].reverse()
        }
      },
      { ...entry, damageEventId: 1 },
      { ...entry, hitResolutionLogId: 1 },
      { ...entry, unexpectedCallback: true }
    ]) {
      expect(
        freezeBrokenAttackLogEntrySchema.safeParse(
          candidate
        ).success
      ).toBe(false);
    }
  });

  it("rejects expiry/damage backlink drift, non-finite gauges, and wrong time", () => {
    const entry = validExpiryEntry();
    for (const candidate of [
      { ...entry, depletionDamageEventId: 1 },
      {
        ...entry,
        depletionOperation: "shatter-consume",
        reaction: "shatter",
        depletionDamageEventId: 1,
        endOfFramePhase: {
          ...entry.endOfFramePhase,
          relativeToTriggerEnemyDamage: "not-applicable"
        }
      },
      {
        ...entry,
        frozenGaugeBefore: Number.POSITIVE_INFINITY
      },
      { ...entry, timeSeconds: 1.01 },
      {
        ...entry,
        sourceFrozenStateLogId: Number.MAX_SAFE_INTEGER + 1
      }
    ]) {
      expect(
        freezeBrokenAttackLogEntrySchema.safeParse(
          candidate
        ).success
      ).toBe(false);
    }
  });
});
