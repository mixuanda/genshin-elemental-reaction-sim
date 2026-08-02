import {
  GCSIM_DAMAGE_GROUP_PROFILE_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID
} from "@genshin-dps-lab/icd-profiles";
import { describe, expect, it } from "vitest";

import {
  reactionDamageGroupDecisionAuditV150Schema,
  reactionDamageGroupResetLogEntryV150Schema
} from "./result-schema";

const v2Opener = {
  policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
  profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID,
  reaction: "superconduct",
  icdTag: "ICDTagSuperconductDamage",
  icdGroup: "reaction-a",
  sourceActorId: "actor-a",
  targetId: "enemy-0",
  scopeKey: JSON.stringify([
    "enemy-0",
    "actor-a",
    "ICDTagSuperconductDamage"
  ]),
  frame: 0,
  damageGroupTaskSequence: 5,
  windowGeneration: 0,
  windowStartFrame: 0,
  resetAtFrame: 29,
  resetTaskLogId: 0,
  resetTaskSequence: 10,
  hitIndex: 0,
  sequenceIndex: 0,
  sequenceMultiplier: 1,
  damageAllowed: true,
  blockedReason: null
} as const;

describe("1.50 reaction damage-group result leaf schemas", () => {
  it("accepts v1 lazy decisions and v2 opener reset backlinks", () => {
    expect(
      reactionDamageGroupDecisionAuditV150Schema.parse({
        ...v2Opener,
        policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
        resetAtFrame: 30,
        resetTaskLogId: null,
        resetTaskSequence: null
      })
    ).toMatchObject({ policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID });
    expect(
      reactionDamageGroupDecisionAuditV150Schema.parse(v2Opener)
    ).toEqual(v2Opener);
  });

  it("allows later attempts to follow the already allocated reset sequence", () => {
    const laterAttempt = {
      ...v2Opener,
      frame: 12,
      damageGroupTaskSequence: 20,
      hitIndex: 1,
      sequenceIndex: 1
    };
    expect(
      reactionDamageGroupDecisionAuditV150Schema.parse(laterAttempt)
    ).toEqual(laterAttempt);
  });

  it("rejects forged binding, scope, tail, and opener ordering fields", () => {
    for (const forged of [
      { ...v2Opener, icdTag: "ICDTagSwirlPyro" },
      { ...v2Opener, scopeKey: "enemy-0:actor-a" },
      {
        ...v2Opener,
        hitIndex: 2,
        sequenceIndex: 2,
        sequenceMultiplier: 1
      },
      { ...v2Opener, resetTaskSequence: 5 }
    ]) {
      expect(
        reactionDamageGroupDecisionAuditV150Schema.safeParse(forged)
          .success
      ).toBe(false);
    }
  });

  it("accepts the exact in-range reset outcome and rejects stale laundering", () => {
    const reset = {
      id: 0,
      policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
      sourceActorId: "actor-a",
      targetId: "enemy-0",
      scopeKey: v2Opener.scopeKey,
      reaction: "superconduct",
      icdTag: "ICDTagSuperconductDamage",
      icdGroup: "reaction-a",
      windowGeneration: 0,
      windowStartFrame: 0,
      resetAtFrame: 29,
      taskSequence: 10,
      withinSimulation: true,
      executed: true,
      executedBeforeAttemptTaskSequence: 20,
      executionFrame: 29,
      stale: false,
      invalidatedReason: null
    } as const;
    expect(
      reactionDamageGroupResetLogEntryV150Schema.parse(reset)
    ).toEqual(reset);
    expect(
      reactionDamageGroupResetLogEntryV150Schema.safeParse({
        ...reset,
        stale: true
      }).success
    ).toBe(false);
  });
});
