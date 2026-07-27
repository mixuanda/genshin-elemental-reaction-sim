import { describe, expect, it } from "vitest";
import {
  makeReactionAScopeKey,
  REACTION_A_POLICY,
  ReactionALimiter,
  type ReactionAAttempt
} from "../reaction-a";

function attempt(
  overrides: Partial<ReactionAAttempt> = {}
): ReactionAAttempt {
  return {
    targetId: "enemy-0",
    actorId: "actor-0",
    reactionTag: "bloom",
    frame: 0,
    ...overrides
  };
}

describe("ReactionALimiter", () => {
  it("allows the first two attempts and audits every later block in one window", () => {
    const limiter = new ReactionALimiter();
    const decisions = [0, 0, 29, 29].map((frame) =>
      limiter.decide(attempt({ frame }))
    );

    expect(decisions).toEqual([
      {
        policy: "reaction-a",
        scopeKey: "[\"enemy-0\",\"actor-0\",\"bloom\"]",
        targetId: "enemy-0",
        actorId: "actor-0",
        reactionTag: "bloom",
        frame: 0,
        windowStartFrame: 0,
        windowEndFrameExclusive: 30,
        hitIndex: 0,
        attemptCountAfterDecision: 1,
        resetFrames: 30,
        allowedDamageInstances: 2,
        damageAllowed: true,
        blockedReason: null
      },
      expect.objectContaining({
        frame: 0,
        hitIndex: 1,
        attemptCountAfterDecision: 2,
        damageAllowed: true,
        blockedReason: null
      }),
      expect.objectContaining({
        frame: 29,
        hitIndex: 2,
        attemptCountAfterDecision: 3,
        damageAllowed: false,
        blockedReason: "REACTION_A_DAMAGE_ICD"
      }),
      expect.objectContaining({
        frame: 29,
        hitIndex: 3,
        attemptCountAfterDecision: 4,
        damageAllowed: false,
        blockedReason: "REACTION_A_DAMAGE_ICD"
      })
    ]);
  });

  it("uses a half-open 30-frame window and resets exactly at the boundary", () => {
    const limiter = new ReactionALimiter();
    const decisions = [0, 1, 29, 30, 59, 60].map((frame) =>
      limiter.decide(attempt({ frame }))
    );

    expect(
      decisions.map(
        ({
          frame,
          windowStartFrame,
          windowEndFrameExclusive,
          hitIndex,
          damageAllowed
        }) => ({
          frame,
          windowStartFrame,
          windowEndFrameExclusive,
          hitIndex,
          damageAllowed
        })
      )
    ).toEqual([
      {
        frame: 0,
        windowStartFrame: 0,
        windowEndFrameExclusive: 30,
        hitIndex: 0,
        damageAllowed: true
      },
      {
        frame: 1,
        windowStartFrame: 0,
        windowEndFrameExclusive: 30,
        hitIndex: 1,
        damageAllowed: true
      },
      {
        frame: 29,
        windowStartFrame: 0,
        windowEndFrameExclusive: 30,
        hitIndex: 2,
        damageAllowed: false
      },
      {
        frame: 30,
        windowStartFrame: 30,
        windowEndFrameExclusive: 60,
        hitIndex: 0,
        damageAllowed: true
      },
      {
        frame: 59,
        windowStartFrame: 30,
        windowEndFrameExclusive: 60,
        hitIndex: 1,
        damageAllowed: true
      },
      {
        frame: 60,
        windowStartFrame: 60,
        windowEndFrameExclusive: 90,
        hitIndex: 0,
        damageAllowed: true
      }
    ]);
  });

  it("isolates windows by target, actor, and Bloom-family reaction tag", () => {
    const limiter = new ReactionALimiter();
    const scopes: ReactionAAttempt[] = [
      attempt(),
      attempt({ targetId: "enemy-1" }),
      attempt({ actorId: "actor-1" }),
      attempt({ reactionTag: "burgeon" }),
      attempt({ reactionTag: "hyperbloom" })
    ];

    for (const scope of scopes) {
      expect(limiter.decide(scope)).toMatchObject({
        hitIndex: 0,
        damageAllowed: true
      });
      expect(limiter.decide({ ...scope, frame: 1 })).toMatchObject({
        hitIndex: 1,
        damageAllowed: true
      });
      expect(limiter.decide({ ...scope, frame: 2 })).toMatchObject({
        hitIndex: 2,
        damageAllowed: false
      });
    }
  });

  it("returns identical decisions for identical ordered input streams", () => {
    const stream: ReactionAAttempt[] = [
      attempt({ frame: 3 }),
      attempt({ frame: 8 }),
      attempt({ frame: 9 }),
      attempt({
        targetId: "enemy-1",
        actorId: "actor-1",
        reactionTag: "hyperbloom",
        frame: 9
      }),
      attempt({ frame: 33 }),
      attempt({ frame: 33 })
    ];
    const run = () => {
      const limiter = new ReactionALimiter();
      return stream.map((input) => limiter.decide(input));
    };

    expect(run()).toEqual(run());
  });

  it("clears all windows without retaining mutable decision state", () => {
    const limiter = new ReactionALimiter();
    const first = limiter.decide(attempt());
    limiter.decide(attempt({ frame: 1 }));
    limiter.clear();
    const afterClear = limiter.decide(attempt({ frame: 1 }));

    expect(first).toMatchObject({ hitIndex: 0 });
    expect(Object.isFrozen(first)).toBe(true);
    expect(afterClear).toMatchObject({
      windowStartFrame: 1,
      hitIndex: 0,
      damageAllowed: true
    });
  });

  it("rejects invalid or out-of-order attempts instead of corrupting a window", () => {
    const limiter = new ReactionALimiter();

    expect(() =>
      limiter.decide(attempt({ targetId: " " }))
    ).toThrow(/targetId/);
    expect(() =>
      limiter.decide(attempt({ actorId: "" }))
    ).toThrow(/actorId/);
    expect(() =>
      limiter.decide(attempt({ frame: -1 }))
    ).toThrow(/non-negative safe integer/);
    expect(() =>
      limiter.decide(attempt({ frame: 0.5 }))
    ).toThrow(/non-negative safe integer/);
    expect(() =>
      limiter.decide(
        attempt({
          reactionTag: "burning" as ReactionAAttempt["reactionTag"]
        })
      )
    ).toThrow(/reactionTag must be one of/);

    limiter.decide(attempt({ frame: 10 }));
    expect(() =>
      limiter.decide(attempt({ frame: 9 }))
    ).toThrow(/non-decreasing frame order/);
  });
});

describe("ReactionA policy", () => {
  it("uses a collision-safe deterministic scope key and fixed policy", () => {
    expect(
      makeReactionAScopeKey({
        targetId: "enemy|actor",
        actorId: "source|bloom",
        reactionTag: "burgeon"
      })
    ).toBe("[\"enemy|actor\",\"source|bloom\",\"burgeon\"]");
    expect(REACTION_A_POLICY).toEqual({
      windowFrames: 30,
      allowedDamageInstances: 2,
      blockedReason: "REACTION_A_DAMAGE_ICD"
    });
    expect(Object.isFrozen(REACTION_A_POLICY)).toBe(true);
  });
});
