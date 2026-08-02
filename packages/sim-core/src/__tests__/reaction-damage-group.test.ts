import {
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
} from "@genshin-dps-lab/icd-profiles";
import { describe, expect, it } from "vitest";
import {
  FIXED_REACTION_DAMAGE_GROUP_TASK_MODEL,
  LEGACY_REACTION_DAMAGE_GROUP_MODEL,
  ReactionDamageGroupTaskEngine,
  type ReactionDamageGroupAttempt,
  type ReactionDamageGroupResetTask,
} from "../reaction-damage-group";

function attempt(
  reactionTag: ReactionDamageGroupAttempt["reactionTag"],
  frame: number,
  taskSequence: number,
  overrides: Partial<ReactionDamageGroupAttempt> = {},
): ReactionDamageGroupAttempt {
  return {
    targetId: "target-a",
    actorId: "actor-a",
    reactionTag,
    damageSourceId: "source-a",
    frame,
    taskSequence,
    ...overrides,
  };
}

function scheduler(...sequences: number[]) {
  const pending = [...sequences];
  return () => {
    const taskSequence = pending.shift();
    if (taskSequence === undefined) {
      throw new Error("test scheduler exhausted");
    }
    return { taskSequence, withinSimulation: true };
  };
}

describe("ReactionDamageGroupTaskEngine", () => {
  it("preserves the frozen V1 F30 ReactionA window", () => {
    const engine = new ReactionDamageGroupTaskEngine(
      LEGACY_REACTION_DAMAGE_GROUP_MODEL,
    );
    const decisions = [
      attempt("shatter", 0, 0),
      attempt("shatter", 0, 1),
      attempt("shatter", 0, 2),
      attempt("shatter", 29, 3),
      attempt("shatter", 30, 4),
    ].map((input) => engine.consumeAttempt(input).decision);

    expect(decisions.map((entry) => entry.damageAllowed)).toEqual([
      true,
      true,
      false,
      false,
      true,
    ]);
    expect(decisions.map((entry) => entry.windowStartFrame)).toEqual([
      0, 0, 0, 0, 30,
    ]);
    expect(decisions[0]).toMatchObject({
      policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
      resetAtFrame: 30,
      resetTask: null,
    });
  });

  it("models ReactionA attempt-before-reset and reset-before-attempt at F29", () => {
    const engine = new ReactionDamageGroupTaskEngine(
      FIXED_REACTION_DAMAGE_GROUP_TASK_MODEL,
    );
    const schedule = scheduler(10, 20);
    const first = engine.consumeAttempt(
      attempt("superconduct", 0, 0),
      schedule,
    );
    engine.consumeAttempt(attempt("superconduct", 0, 1), schedule);
    const blockedBeforeReset = engine.consumeAttempt(
      attempt("superconduct", 29, 9),
      schedule,
    ).decision;
    const reset = engine.executeReset(
      first.scheduledResetTask as ReactionDamageGroupResetTask,
    );
    const allowedAfterReset = engine.consumeAttempt(
      attempt("superconduct", 29, 11),
      schedule,
    ).decision;

    expect(blockedBeforeReset).toMatchObject({
      hitIndex: 2,
      sequenceMultiplier: 0,
      damageAllowed: false,
      resetAtFrame: 29,
    });
    expect(reset).toMatchObject({ applied: true, stale: false });
    expect(allowedAfterReset).toMatchObject({
      windowGeneration: 1,
      windowStartFrame: 29,
      hitIndex: 0,
      sequenceMultiplier: 1,
      damageAllowed: true,
      resetAtFrame: 58,
    });
  });

  it("drains only reset tasks strictly earlier than the parent core-task tuple", () => {
    const engine = new ReactionDamageGroupTaskEngine(
      FIXED_REACTION_DAMAGE_GROUP_TASK_MODEL,
    );
    const schedule = scheduler(10, 20);
    const first = engine.consumeAttempt(attempt("shatter", 0, 0), schedule);
    engine.consumeAttempt(attempt("shatter", 0, 1), schedule);

    expect(engine.executeResetsBefore({ frame: 29, taskSequence: 9 })).toEqual(
      [],
    );
    const blockedBeforeReset = engine.consumeAttempt(
      attempt("shatter", 29, 9),
      schedule,
    ).decision;
    const drained = engine.executeResetsBefore({
      frame: 29,
      taskSequence: 11,
    });
    const resetTask = first.scheduledResetTask as ReactionDamageGroupResetTask;
    const duplicate = engine.executeReset(resetTask);
    const allowedAfterReset = engine.consumeAttempt(
      attempt("shatter", 29, 11),
      schedule,
    ).decision;

    expect(blockedBeforeReset).toMatchObject({
      windowGeneration: 0,
      hitIndex: 2,
      damageAllowed: false,
    });
    expect(drained).toHaveLength(1);
    expect(drained[0]).toMatchObject({
      task: resetTask,
      applied: true,
      stale: false,
      invalidatedReason: null,
    });
    expect(duplicate).toMatchObject({
      applied: false,
      stale: true,
      invalidatedReason: "ALREADY_EXECUTED",
    });
    expect(allowedAfterReset).toMatchObject({
      windowGeneration: 1,
      windowStartFrame: 29,
      hitIndex: 0,
      damageAllowed: true,
    });
  });

  it("rejects a reset-equal attempt without mutating the active window", () => {
    const engine = new ReactionDamageGroupTaskEngine(
      FIXED_REACTION_DAMAGE_GROUP_TASK_MODEL,
    );
    const schedule = scheduler(10, 20);
    const first = engine.consumeAttempt(attempt("shatter", 0, 0), schedule);
    engine.consumeAttempt(attempt("shatter", 0, 1), schedule);

    expect(() =>
      engine.consumeAttempt(attempt("shatter", 29, 10), schedule),
    ).toThrow(/must execute before attempt/);

    const legalBeforeReset = engine.consumeAttempt(
      attempt("shatter", 29, 9),
      schedule,
    ).decision;
    const reset = engine.executeReset(
      first.scheduledResetTask as ReactionDamageGroupResetTask,
    );
    const legalAfterReset = engine.consumeAttempt(
      attempt("shatter", 29, 11),
      schedule,
    ).decision;

    expect(legalBeforeReset).toMatchObject({
      windowGeneration: 0,
      windowStartFrame: 0,
      hitIndex: 2,
      damageAllowed: false,
    });
    expect(reset).toMatchObject({
      applied: true,
      stale: false,
      invalidatedReason: null,
    });
    expect(legalAfterReset).toMatchObject({
      windowGeneration: 1,
      windowStartFrame: 29,
      hitIndex: 0,
      damageAllowed: true,
    });
  });

  it("models ReactionB reset-first FIFO at F29", () => {
    const engine = new ReactionDamageGroupTaskEngine(
      FIXED_REACTION_DAMAGE_GROUP_TASK_MODEL,
    );
    const schedule = scheduler(5, 8);
    const first = engine.consumeAttempt(attempt("overload", 0, 0), schedule);
    expect(
      engine.consumeAttempt(attempt("overload", 0, 1), schedule).decision
        .damageAllowed,
    ).toBe(false);
    engine.executeReset(
      first.scheduledResetTask as ReactionDamageGroupResetTask,
    );
    const after = [
      engine.consumeAttempt(attempt("overload", 29, 6), schedule).decision,
      engine.consumeAttempt(attempt("overload", 29, 7), schedule).decision,
    ];
    expect(after.map((entry) => entry.damageAllowed)).toEqual([true, false]);
  });

  it("isolates target, actor, and ICD tag while excluding DamageSrc from the key", () => {
    const engine = new ReactionDamageGroupTaskEngine(
      LEGACY_REACTION_DAMAGE_GROUP_MODEL,
    );
    const shared = [
      engine.consumeAttempt(
        attempt("bloom", 0, 0, { damageSourceId: "core-a" }),
      ).decision,
      engine.consumeAttempt(
        attempt("bloom", 0, 1, { damageSourceId: "core-b" }),
      ).decision,
      engine.consumeAttempt(
        attempt("bloom", 0, 2, { damageSourceId: "core-c" }),
      ).decision,
    ];
    expect(shared.map((entry) => entry.hitIndex)).toEqual([0, 1, 2]);
    expect(new Set(shared.map((entry) => entry.scopeKey)).size).toBe(1);

    const isolated = [
      engine.consumeAttempt(attempt("bloom", 0, 3, { targetId: "target-b" }))
        .decision,
      engine.consumeAttempt(attempt("bloom", 0, 4, { actorId: "actor-b" }))
        .decision,
      engine.consumeAttempt(attempt("burgeon", 0, 5)).decision,
    ];
    expect(isolated.map((entry) => entry.hitIndex)).toEqual([0, 0, 0]);
  });

  it("keeps all four Swirl tags on independent ReactionA counters", () => {
    const engine = new ReactionDamageGroupTaskEngine(
      LEGACY_REACTION_DAMAGE_GROUP_MODEL,
    );
    const reactions = [
      "swirlPyro",
      "swirlHydro",
      "swirlCryo",
      "swirlElectro",
    ] as const;
    const decisions = reactions.map(
      (reactionTag, taskSequence) =>
        engine.consumeAttempt(attempt(reactionTag, 0, taskSequence)).decision,
    );
    expect(decisions.map((entry) => entry.hitIndex)).toEqual([0, 0, 0, 0]);
    expect(decisions.map((entry) => entry.icdGroup)).toEqual([
      "reaction-a",
      "reaction-a",
      "reaction-a",
      "reaction-a",
    ]);
  });

  it("returns frozen decisions and idempotent stale reset audits", () => {
    const engine = new ReactionDamageGroupTaskEngine(
      FIXED_REACTION_DAMAGE_GROUP_TASK_MODEL,
    );
    const result = engine.consumeAttempt(
      attempt("electroCharged", 0, 0),
      scheduler(3),
    );
    const task = result.scheduledResetTask as ReactionDamageGroupResetTask;
    const applied = engine.executeReset(task);
    const duplicate = engine.executeReset(task);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.decision)).toBe(true);
    expect(Object.isFrozen(task)).toBe(true);
    expect(applied.applied).toBe(true);
    expect(duplicate).toMatchObject({
      applied: false,
      stale: true,
      invalidatedReason: "ALREADY_EXECUTED",
    });
  });

  it("fails closed on policy mismatch, missing schedulers, and FIFO violations", () => {
    expect(
      () =>
        new ReactionDamageGroupTaskEngine({
          mode: "legacy-reaction-damage-group-window-v1",
          policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
        }),
    ).toThrow(/same root/);

    const engine = new ReactionDamageGroupTaskEngine(
      FIXED_REACTION_DAMAGE_GROUP_TASK_MODEL,
    );
    expect(() => engine.consumeAttempt(attempt("bloom", 0, 0))).toThrow(
      /require a reset-task scheduler/,
    );
    engine.consumeAttempt(attempt("bloom", 0, 0), scheduler(3));
    expect(() =>
      engine.consumeAttempt(attempt("bloom", 0, 0), scheduler(4)),
    ).toThrow(/strictly increasing/);
    expect(() =>
      engine.consumeAttempt(attempt("bloom", 29, 4), scheduler(5)),
    ).toThrow(/must execute before attempt/);
  });
});
