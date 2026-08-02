import { describe, expect, it } from "vitest";
import type {
  ElementalApplication,
  TrustedReactionElementalApplicationInput
} from "@genshin-dps-lab/schemas";
import { ElementalApplicationIcdEngine } from "./elemental-application-icd";

const FIXED_DIRECT: ElementalApplication = {
  gaugeUnits: 1,
  icd: {
    mode: "fixed-gcsim-application-v1",
    icdTag: "ICDTagBurningDamage",
    groupId: "default"
  }
};

function burning(
  frame: number,
  sourceActorId: string
): TrustedReactionElementalApplicationInput {
  return {
    frame,
    sourceActorId,
    channel: { kind: "burning-tick" }
  };
}

function swirl(
  frame: number,
  sourceActorId: string,
  element: "pyro" | "hydro" | "cryo" | "electro",
  nominalGaugeUnits = 1
): TrustedReactionElementalApplicationInput {
  return {
    frame,
    sourceActorId,
    channel: { kind: "swirl-propagation", element },
    nominalGaugeUnits
  };
}

describe("reaction-owned elemental application namespace", () => {
  it("derives the four Swirl tags and ReactionA group from the trusted channel", () => {
    const engine = new ElementalApplicationIcdEngine();
    const expectedTags = {
      pyro: "ICDTagSwirlPyro",
      hydro: "ICDTagSwirlHydro",
      cryo: "ICDTagSwirlCryo",
      electro: "ICDTagSwirlElectro"
    } as const;

    for (const element of ["pyro", "hydro", "cryo", "electro"] as const) {
      expect(
        engine.consumeReactionAttempt(swirl(0, "anemo-owner", element, 0.5))
      ).toMatchObject({
        kind: "reaction-fixed-gcsim",
        scope: "actor-tag",
        icdTag: expectedTags[element],
        groupId: "reaction-a",
        windowStartGroupId: "reaction-a",
        resetFrames: 30,
        windowStartFrame: 0,
        resetAtFrame: 29,
        hitIndex: 0,
        sequenceIndex: 0,
        applicationMultiplier: 1,
        allowed: true,
        resetSchedulePolicy:
          "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one"
      });
    }

    expect(
      engine.consumeReactionAttempt(swirl(1, "anemo-owner", "pyro"))
    ).toMatchObject({ hitIndex: 1, sequenceIndex: 1 });
    expect(
      engine.consumeReactionAttempt(swirl(1, "other-anemo", "pyro"))
    ).toMatchObject({ hitIndex: 0, sequenceIndex: 0 });
  });

  it("projects Burning as one target-global fixed window across source actors", () => {
    const engine = new ElementalApplicationIcdEngine();

    expect(engine.consumeReactionAttempt(burning(0, "actor-a"))).toMatchObject({
      scope: "trusted-target-global-burning-projection",
      icdTag: "ICDTagBurningDamage",
      groupId: "burning",
      windowStartGroupId: "burning",
      resetFrames: 120,
      resetAtFrame: 119,
      hitIndex: 0,
      sequenceIndex: 0,
      applicationMultiplier: 1,
      allowed: true,
      resetSchedulePolicy:
        "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one"
    });
    expect(engine.consumeReactionAttempt(burning(1, "actor-b"))).toMatchObject({
      scope: "trusted-target-global-burning-projection",
      icdTag: "ICDTagBurningDamage",
      hitIndex: 1,
      sequenceIndex: 1,
      applicationMultiplier: 0,
      allowed: false
    });
    const clampedTail = Array.from({ length: 7 }, (_, index) => index + 2).map(
      (frame) =>
        engine.consumeReactionAttempt(burning(frame, `actor-${frame}`))
    );
    expect(clampedTail.at(-1)).toMatchObject({
      hitIndex: 8,
      sequenceIndex: 7,
      tailPolicy: "clamp",
      applicationMultiplier: 0
    });
  });

  it("uses provisional reset-before-attempt semantics exactly at F+119", () => {
    const engine = new ElementalApplicationIcdEngine();
    const decisions = [0, 118, 119].map((frame) =>
      engine.consumeReactionAttempt(burning(frame, `actor-${frame}`))
    );

    expect(decisions.map(({ hitIndex }) => hitIndex)).toEqual([0, 1, 0]);
    expect(decisions.map(({ applicationMultiplier }) => applicationMultiplier)).toEqual([
      1, 0, 1
    ]);
    expect(decisions.map(({ resetAtFrame }) => resetAtFrame)).toEqual([
      119, 119, 238
    ]);
  });

  it("keeps reaction-owned and every direct compatibility state structurally isolated", () => {
    const engine = new ElementalApplicationIcdEngine();

    const reactionFirst = engine.consumeReactionAttempt(burning(0, "reaction-a"));
    const directLegacyFirst = engine.consumeDirectAttempt({
      frame: 0,
      sourceActorId: "direct-a",
      application: {
        gaugeUnits: 1,
        icd: {
          mode: "legacy-boolean-profile-v1",
          icdTag: "untrusted-burning-tag-a",
          profileId: "burning"
        }
      }
    });
    const directFixedFirst = engine.consumeDirectAttempt({
      frame: 0,
      sourceActorId: "reaction-a",
      application: FIXED_DIRECT
    });

    expect(reactionFirst.hitIndex).toBe(0);
    expect(directLegacyFirst.hitIndex).toBe(0);
    expect(directFixedFirst.hitIndex).toBe(0);
    expect(engine.consumeReactionAttempt(burning(1, "reaction-b")).hitIndex).toBe(1);
    expect(
      engine.consumeDirectAttempt({
        frame: 1,
        sourceActorId: "direct-b",
        application: {
          gaugeUnits: 1,
          icd: {
            mode: "legacy-boolean-profile-v1",
            icdTag: "untrusted-burning-tag-b",
            profileId: "burning"
          }
        }
      }).hitIndex
    ).toBe(1);
    expect(
      engine.consumeDirectAttempt({
        frame: 1,
        sourceActorId: "reaction-a",
        application: FIXED_DIRECT
      }).hitIndex
    ).toBe(1);
  });

  it("keeps direct and reaction delivery-order cursors independent", () => {
    const engine = new ElementalApplicationIcdEngine();
    engine.consumeDirectAttempt({
      frame: 100,
      sourceActorId: "direct",
      application: FIXED_DIRECT
    });
    expect(engine.consumeReactionAttempt(burning(0, "reaction"))).toMatchObject({
      hitIndex: 0
    });

    const reverse = new ElementalApplicationIcdEngine();
    reverse.consumeReactionAttempt(burning(100, "reaction"));
    expect(
      reverse.consumeDirectAttempt({
        frame: 0,
        sourceActorId: "direct",
        application: FIXED_DIRECT
      })
    ).toMatchObject({ hitIndex: 0 });
  });

  it("keeps the deprecated consumeAttempt alias permanently direct-only", () => {
    const engine = new ElementalApplicationIcdEngine();
    const unsafeAlias = engine.consumeAttempt.bind(engine) as (
      input: unknown
    ) => unknown;

    expect(() => unsafeAlias(burning(10, "forger"))).toThrow(
      /Elemental application must be an object/
    );
    expect(engine.consumeReactionAttempt(burning(0, "trusted"))).toMatchObject({
      kind: "reaction-fixed-gcsim",
      hitIndex: 0,
      applicationMultiplier: 1
    });
  });

  it("captures direct selector accessors before committing its isolated state", () => {
    const engine = new ElementalApplicationIcdEngine();
    let tagReads = 0;
    const decision = engine.consumeDirectAttempt({
      frame: 0,
      sourceActorId: "direct",
      application: {
        gaugeUnits: 1,
        icd: {
          mode: "fixed-gcsim-application-v1",
          groupId: "default",
          get icdTag() {
            tagReads += 1;
            if (tagReads > 1) throw new Error("direct tag reread");
            return "captured-direct-tag";
          }
        }
      }
    });

    expect(tagReads).toBe(1);
    expect(decision).toMatchObject({
      kind: "fixed-gcsim",
      icdTag: "captured-direct-tag",
      hitIndex: 0,
      applicationMultiplier: 1
    });
  });

  it("rejects trusted accessors recursively without invoking or mutating either namespace", () => {
    const engine = new ElementalApplicationIcdEngine();
    const unsafeConsume = engine.consumeReactionAttempt.bind(engine) as (
      input: unknown
    ) => unknown;
    let topLevelAccessorReads = 0;
    let nestedAccessorReads = 0;

    expect(() =>
      unsafeConsume({
        frame: 100,
        sourceActorId: "accessor-forger",
        get channel() {
          topLevelAccessorReads += 1;
          engine.consumeReactionAttempt(burning(50, "nested-reaction"));
          return { kind: "burning-tick" };
        }
      })
    ).toThrow(/accessor properties are forbidden/);
    expect(() =>
      unsafeConsume({
        frame: 100,
        sourceActorId: "accessor-forger",
        channel: {
          get kind() {
            nestedAccessorReads += 1;
            engine.consumeDirectAttempt({
              frame: 50,
              sourceActorId: "nested-direct",
              application: FIXED_DIRECT
            });
            return "burning-tick";
          }
        }
      })
    ).toThrow(/accessor properties are forbidden/);

    expect(topLevelAccessorReads).toBe(0);
    expect(nestedAccessorReads).toBe(0);
    expect(engine.consumeReactionAttempt(burning(0, "valid-reaction"))).toMatchObject({
      hitIndex: 0,
      applicationMultiplier: 1
    });
    expect(
      engine.consumeDirectAttempt({
        frame: 0,
        sourceActorId: "valid-direct",
        application: FIXED_DIRECT
      })
    ).toMatchObject({ hitIndex: 0, applicationMultiplier: 1 });
  });

  it("poisons a caught Proxy-trap reentry before committing any ICD state", () => {
    const engine = new ElementalApplicationIcdEngine();
    let nestedError: unknown = null;
    const proxied = new Proxy(burning(100, "proxy-forger"), {
      ownKeys(target) {
        try {
          engine.consumeDirectAttempt({
            frame: 50,
            sourceActorId: "nested-direct",
            application: FIXED_DIRECT
          });
        } catch (error) {
          nestedError = error;
        }
        return Reflect.ownKeys(target);
      }
    });

    expect(() => engine.consumeReactionAttempt(proxied)).toThrow(
      /attempted reentrant consumption/
    );
    expect(nestedError).toBeInstanceOf(Error);
    expect(String(nestedError)).toMatch(/reentrant direct consumption is forbidden/);
    expect(engine.consumeReactionAttempt(burning(0, "valid-reaction"))).toMatchObject({
      hitIndex: 0,
      applicationMultiplier: 1
    });
    expect(
      engine.consumeDirectAttempt({
        frame: 0,
        sourceActorId: "valid-direct",
        application: FIXED_DIRECT
      })
    ).toMatchObject({ hitIndex: 0, applicationMultiplier: 1 });
  });

  it("preserves valid deeply frozen trusted wires", () => {
    const engine = new ElementalApplicationIcdEngine();
    const frozen = Object.freeze({
      frame: 0,
      sourceActorId: "frozen-owner",
      channel: Object.freeze({
        kind: "swirl-propagation" as const,
        element: "hydro" as const
      }),
      nominalGaugeUnits: 0.5
    });

    expect(engine.consumeReactionAttempt(frozen)).toMatchObject({
      icdTag: "ICDTagSwirlHydro",
      groupId: "reaction-a",
      hitIndex: 0,
      applicationMultiplier: 1
    });
  });

  it("rejects forged policy fields and failed inputs do not mutate ordering or counters", () => {
    const engine = new ElementalApplicationIcdEngine();
    const unsafeConsume = engine.consumeReactionAttempt.bind(engine) as (
      input: unknown
    ) => unknown;

    expect(() =>
      unsafeConsume({
        frame: 10,
        sourceActorId: "forger",
        channel: {
          kind: "burning-tick",
          icdTag: "forged",
          groupId: "no-icd"
        }
      })
    ).toThrow(/forbidden field/);
    expect(() =>
      unsafeConsume({
        frame: 10,
        sourceActorId: "forger",
        channel: { kind: "burning-tick" },
        nominalGaugeUnits: 20,
        profileId: "forged"
      })
    ).toThrow(/forbidden field/);
    expect(() =>
      unsafeConsume({
        frame: 10,
        sourceActorId: "forger",
        channel: { kind: "swirl-propagation", element: "anemo" },
        nominalGaugeUnits: 1
      })
    ).toThrow(/unknown swirl-propagation/);
    expect(() =>
      unsafeConsume({
        frame: 10,
        sourceActorId: "forger",
        channel: { kind: "swirl-propagation", element: "pyro" },
        nominalGaugeUnits: 0
      })
    ).toThrow(/must be positive/);
    const inheritedAttempt = Object.assign(Object.create({ forged: true }), {
      frame: 10,
      sourceActorId: "forger",
      channel: { kind: "burning-tick" }
    });
    expect(() => unsafeConsume(inheritedAttempt)).toThrow(/plain object/);
    const inheritedChannel = Object.assign(Object.create({ forged: true }), {
      kind: "burning-tick"
    });
    expect(() =>
      unsafeConsume({
        frame: 10,
        sourceActorId: "forger",
        channel: inheritedChannel
      })
    ).toThrow(/plain object/);

    const valid = engine.consumeReactionAttempt(burning(0, "valid"));
    expect(valid).toMatchObject({ hitIndex: 0, applicationMultiplier: 1 });
    expect(Object.isFrozen(valid)).toBe(true);
  });

  it("isolates reaction windows between target-local engine instances", () => {
    const targetA = new ElementalApplicationIcdEngine();
    const targetB = new ElementalApplicationIcdEngine();

    expect(targetA.consumeReactionAttempt(burning(0, "actor-a")).hitIndex).toBe(0);
    expect(targetA.consumeReactionAttempt(burning(1, "actor-b")).hitIndex).toBe(1);
    expect(targetB.consumeReactionAttempt(burning(1, "actor-b")).hitIndex).toBe(0);
  });
});
