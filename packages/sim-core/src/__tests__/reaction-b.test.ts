import { describe, expect, it } from "vitest";
import {
  makeReactionBScopeKey,
  REACTION_B_POLICY,
  ReactionBLimiter,
  type ReactionBAttempt
} from "../reaction-b";

function attempt(
  overrides: Partial<ReactionBAttempt> = {}
): ReactionBAttempt {
  return {
    targetId: "enemy-0",
    actorId: "actor-0",
    reactionTag: "overload",
    frame: 0,
    ...overrides
  };
}

describe("ReactionBLimiter", () => {
  it("allows only the first attempt and audits later blocks in one window", () => {
    const limiter = new ReactionBLimiter();
    const decisions = [0, 0, 29].map((frame) =>
      limiter.decide(attempt({ frame }))
    );

    expect(decisions).toEqual([
      {
        policy: "reaction-b",
        scopeKey: "[\"enemy-0\",\"actor-0\",\"overload\"]",
        targetId: "enemy-0",
        actorId: "actor-0",
        reactionTag: "overload",
        frame: 0,
        windowStartFrame: 0,
        windowEndFrameExclusive: 30,
        hitIndex: 0,
        attemptCountAfterDecision: 1,
        resetFrames: 30,
        allowedDamageInstances: 1,
        damageAllowed: true,
        blockedReason: null
      },
      expect.objectContaining({
        frame: 0,
        hitIndex: 1,
        attemptCountAfterDecision: 2,
        damageAllowed: false,
        blockedReason: "REACTION_B_DAMAGE_ICD"
      }),
      expect.objectContaining({
        frame: 29,
        hitIndex: 2,
        attemptCountAfterDecision: 3,
        damageAllowed: false,
        blockedReason: "REACTION_B_DAMAGE_ICD"
      })
    ]);
  });

  it("uses a half-open 30-frame window and resets at frame 30", () => {
    const limiter = new ReactionBLimiter();
    const decisions = [0, 29, 30, 59, 60].map((frame) =>
      limiter.decide(attempt({ frame }))
    );

    expect(
      decisions.map(
        ({ frame, windowStartFrame, hitIndex, damageAllowed }) => ({
          frame,
          windowStartFrame,
          hitIndex,
          damageAllowed
        })
      )
    ).toEqual([
      {
        frame: 0,
        windowStartFrame: 0,
        hitIndex: 0,
        damageAllowed: true
      },
      {
        frame: 29,
        windowStartFrame: 0,
        hitIndex: 1,
        damageAllowed: false
      },
      {
        frame: 30,
        windowStartFrame: 30,
        hitIndex: 0,
        damageAllowed: true
      },
      {
        frame: 59,
        windowStartFrame: 30,
        hitIndex: 1,
        damageAllowed: false
      },
      {
        frame: 60,
        windowStartFrame: 60,
        hitIndex: 0,
        damageAllowed: true
      }
    ]);
  });

  it("isolates target, actor, and reaction scopes", () => {
    const limiter = new ReactionBLimiter();
    const scopes: ReactionBAttempt[] = [
      attempt(),
      attempt({ targetId: "enemy-1" }),
      attempt({ actorId: "actor-1" }),
      attempt({ reactionTag: "electroCharged" })
    ];

    for (const scope of scopes) {
      expect(limiter.decide(scope)).toMatchObject({
        hitIndex: 0,
        damageAllowed: true
      });
      expect(
        limiter.decide({ ...scope, frame: 1 })
      ).toMatchObject({
        hitIndex: 1,
        damageAllowed: false
      });
    }
  });

  it("clears state and rejects malformed or out-of-order attempts", () => {
    const limiter = new ReactionBLimiter();
    limiter.decide(attempt({ frame: 10 }));

    expect(() =>
      limiter.decide(attempt({ frame: 9 }))
    ).toThrow(/non-decreasing frame order/);
    expect(() =>
      new ReactionBLimiter().decide(
        attempt({ reactionTag: "bloom" as ReactionBAttempt["reactionTag"] })
      )
    ).toThrow(/reactionTag must be one of/);
    expect(() =>
      new ReactionBLimiter().decide(attempt({ frame: -1 }))
    ).toThrow(/non-negative safe integer/);

    limiter.clear();
    expect(limiter.decide(attempt({ frame: 9 }))).toMatchObject({
      windowStartFrame: 9,
      hitIndex: 0,
      damageAllowed: true
    });
  });
});

describe("ReactionB policy", () => {
  it("uses a collision-safe deterministic scope key and fixed policy", () => {
    expect(
      makeReactionBScopeKey({
        targetId: "enemy|actor",
        actorId: "source|electro",
        reactionTag: "electroCharged"
      })
    ).toBe(
      "[\"enemy|actor\",\"source|electro\",\"electroCharged\"]"
    );
    expect(REACTION_B_POLICY).toEqual({
      windowFrames: 30,
      allowedDamageInstances: 1,
      blockedReason: "REACTION_B_DAMAGE_ICD"
    });
    expect(Object.isFrozen(REACTION_B_POLICY)).toBe(true);
  });
});
