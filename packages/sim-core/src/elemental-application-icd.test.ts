import { describe, expect, it } from "vitest";
import type {
  AnyElementalApplication,
  ElementalApplication
} from "@genshin-dps-lab/schemas";
import { ElementalApplicationIcdEngine } from "./elemental-application-icd";

function fixed(
  groupId: "default" | "nahida-skill" | "chasca-tap",
  icdTag = "shared",
  gaugeUnits = 1
): ElementalApplication {
  return {
    gaugeUnits,
    icd: {
      mode: "fixed-gcsim-application-v1",
      icdTag,
      groupId
    }
  };
}

function legacy(
  profileId: string,
  icdTag = "legacy",
  gaugeUnits = 1
): ElementalApplication {
  return {
    gaugeUnits,
    icd: {
      mode: "legacy-boolean-profile-v1",
      icdTag,
      profileId
    }
  };
}

describe("ElementalApplicationIcdEngine", () => {
  it("bypasses no-ICD without creating or consuming a window", () => {
    const engine = new ElementalApplicationIcdEngine();
    const first = engine.consumeAttempt({
      frame: 0,
      sourceActorId: "actor",
      application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" } }
    });
    const second = engine.consumeAttempt({
      frame: 1,
      sourceActorId: "actor",
      application: fixed("default")
    });

    expect(first).toMatchObject({
      kind: "no-icd",
      consumed: false,
      applicationMultiplier: 1,
      resetSchedulePolicy: "bypass"
    });
    expect(second).toMatchObject({
      kind: "fixed-gcsim",
      hitIndex: 0,
      applicationMultiplier: 1
    });
  });

  it("shares one fixed counter across group switches and resets before the reset frame hit", () => {
    const engine = new ElementalApplicationIcdEngine();
    const attempts = [
      [0, fixed("default")],
      [1, fixed("nahida-skill")],
      [2, fixed("chasca-tap")],
      [148, fixed("nahida-skill")],
      [149, fixed("nahida-skill")]
    ] as const;
    const decisions = attempts.map(([frame, application]) =>
      engine.consumeAttempt({ frame, sourceActorId: "actor", application })
    );

    expect(decisions.map((decision) => decision.applicationMultiplier)).toEqual([
      1,
      0,
      0,
      0,
      1.5
    ]);
    expect(decisions[0]).toMatchObject({
      windowStartGroupId: "default",
      resetFrames: 150,
      windowStartFrame: 0,
      resetAtFrame: 149,
      hitIndex: 0,
      sequenceIndex: 0
    });
    expect(decisions[2]).toMatchObject({
      groupId: "chasca-tap",
      windowStartGroupId: "default",
      hitIndex: 2,
      sequenceIndex: 1,
      tailPolicy: "clamp"
    });
    expect(decisions[4]).toMatchObject({
      groupId: "nahida-skill",
      windowStartGroupId: "nahida-skill",
      resetFrames: 60,
      windowStartFrame: 149,
      resetAtFrame: 208,
      hitIndex: 0,
      sequenceIndex: 0,
      applicationMultiplier: 1.5
    });
  });

  it("keeps actor and tag windows isolated without delimiter-key collisions", () => {
    const engine = new ElementalApplicationIcdEngine();
    const consume = (sourceActorId: string, icdTag: string) => {
      const decision = engine.consumeAttempt({
        frame: 0,
        sourceActorId,
        application: fixed("default", icdTag)
      });
      if (decision.kind !== "fixed-gcsim") {
        throw new Error("expected a fixed-gcsim decision");
      }
      return decision.hitIndex;
    };

    expect(consume("a\u0000b", "c")).toBe(0);
    expect(consume("a", "b\u0000c")).toBe(0);
    expect(consume("a\u0000b", "c")).toBe(1);
    expect(consume("other", "c")).toBe(0);
  });

  it("retains legacy repeat and explicit clamp tail policies", () => {
    const createEngine = () =>
      new ElementalApplicationIcdEngine({
        legacyProfiles: {
          repeat: {
            resetFrames: 60,
            applicationSequence: [true, false]
          },
          clamp: {
            resetFrames: 60,
            applicationSequence: [true, false],
            tailPolicy: "clamp"
          }
        }
      });
    const multipliers = (profileId: string) => {
      const engine = createEngine();
      return [0, 1, 2].map(
        (frame) =>
          engine.consumeAttempt({
            frame,
            sourceActorId: profileId,
            application: legacy(profileId)
          }).applicationMultiplier
      );
    };

    expect(multipliers("repeat")).toEqual([1, 0, 1]);
    expect(multipliers("clamp")).toEqual([1, 0, 0]);
  });

  it("keeps the migrated Burning profile target-global across actor and tag changes", () => {
    const engine = new ElementalApplicationIcdEngine();
    const first = engine.consumeAttempt({
      frame: 0,
      sourceActorId: "actor-a",
      application: legacy("burning", "tag-a")
    });
    const second = engine.consumeAttempt({
      frame: 1,
      sourceActorId: "actor-b",
      application: legacy("burning", "tag-b")
    });

    expect(first).toMatchObject({
      scope: "target-global-burning",
      hitIndex: 0,
      applicationMultiplier: 1
    });
    expect(second).toMatchObject({
      scope: "target-global-burning",
      hitIndex: 1,
      applicationMultiplier: 0
    });
  });

  it("normalizes the frozen 1.46 application wire explicitly", () => {
    const engine = new ElementalApplicationIcdEngine();
    const application: AnyElementalApplication = {
      gaugeUnits: 1,
      icdTag: "old-tag",
      icdGroup: "default"
    };

    expect(
      engine.consumeAttempt({ frame: 0, sourceActorId: "actor", application })
    ).toMatchObject({
      kind: "legacy-profile",
      profileId: "default",
      icdTag: "old-tag",
      resetAtFrame: 150
    });
  });

  it("fails closed before mutation for unknown profiles and groups", () => {
    const engine = new ElementalApplicationIcdEngine();
    expect(() =>
      engine.consumeAttempt({
        frame: 5,
        sourceActorId: "actor",
        application: legacy("missing")
      })
    ).toThrow(/Unknown ICD profile/);
    expect(() =>
      engine.consumeAttempt({
        frame: 5,
        sourceActorId: "actor",
        application: {
          gaugeUnits: 1,
          icd: {
            mode: "fixed-gcsim-application-v1",
            icdTag: "tag",
            groupId: "burning"
          }
        } as unknown as ElementalApplication
      })
    ).toThrow(/reaction-owned/);

    expect(
      engine.consumeAttempt({
        frame: 0,
        sourceActorId: "actor",
        application: fixed("default")
      })
    ).toMatchObject({ hitIndex: 0, applicationMultiplier: 1 });
  });

  it("rejects invalid Gauge and decreasing target-local delivery order", () => {
    const engine = new ElementalApplicationIcdEngine();
    expect(() =>
      engine.consumeAttempt({
        frame: 0,
        sourceActorId: "actor",
        application: fixed("default", "tag", 0)
      })
    ).toThrow(/gaugeUnits must be positive/);
    expect(() =>
      engine.consumeAttempt({
        frame: 0,
        sourceActorId: "actor",
        application: fixed("default", "tag", 21)
      })
    ).toThrow(/must not exceed 20/);
    expect(() =>
      engine.consumeAttempt({
        frame: 0,
        sourceActorId: "   ",
        application: fixed("default")
      })
    ).toThrow(/must not be empty/);
    engine.consumeAttempt({
      frame: 3,
      sourceActorId: "actor",
      application: fixed("default")
    });
    expect(() =>
      engine.consumeAttempt({
        frame: 2,
        sourceActorId: "actor",
        application: fixed("default")
      })
    ).toThrow(/non-decreasing/);
  });

  it("uses one target-local delivery order even when a no-ICD attempt bypasses state", () => {
    const engine = new ElementalApplicationIcdEngine();
    engine.consumeAttempt({
      frame: 3,
      sourceActorId: "actor",
      application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" } }
    });

    expect(() =>
      engine.consumeAttempt({
        frame: 2,
        sourceActorId: "actor",
        application: fixed("default")
      })
    ).toThrow(/non-decreasing/);
  });

  it("keeps fixed and explicit legacy compatibility windows independent", () => {
    const engine = new ElementalApplicationIcdEngine();
    const decisions = [
      engine.consumeAttempt({
        frame: 0,
        sourceActorId: "actor",
        application: fixed("default", "same-tag")
      }),
      engine.consumeAttempt({
        frame: 1,
        sourceActorId: "actor",
        application: legacy("default", "same-tag")
      }),
      engine.consumeAttempt({
        frame: 2,
        sourceActorId: "actor",
        application: fixed("default", "same-tag")
      }),
      engine.consumeAttempt({
        frame: 3,
        sourceActorId: "actor",
        application: legacy("default", "same-tag")
      })
    ];

    expect(decisions.map((decision) => decision.kind)).toEqual([
      "fixed-gcsim",
      "legacy-profile",
      "fixed-gcsim",
      "legacy-profile"
    ]);
    expect(decisions.map((decision) => decision.hitIndex)).toEqual([
      0, 0, 1, 1
    ]);
    expect(
      decisions.map((decision) => decision.applicationMultiplier)
    ).toEqual([1, 1, 0, 0]);
  });

  it("retains the legacy reset boundary at start plus resetFrames", () => {
    const engine = new ElementalApplicationIcdEngine();
    const decisions = [0, 149, 150].map((frame) =>
      engine.consumeAttempt({
        frame,
        sourceActorId: "actor",
        application: legacy("default", "reset-boundary")
      })
    );

    expect(decisions.map((decision) => decision.hitIndex)).toEqual([
      0, 1, 0
    ]);
    expect(decisions.map((decision) => decision.resetAtFrame)).toEqual([
      150, 150, 300
    ]);
    expect(
      decisions.map((decision) => decision.applicationMultiplier)
    ).toEqual([1, 0, 1]);
  });

  it("produces the same legacy decision for the frozen 1.46 and explicit 1.47 wires", () => {
    const frozenEngine = new ElementalApplicationIcdEngine();
    const currentEngine = new ElementalApplicationIcdEngine();
    const frozenApplication: AnyElementalApplication = {
      gaugeUnits: 1,
      icdTag: "equivalent-tag",
      icdGroup: "default"
    };

    const frozenDecision = frozenEngine.consumeAttempt({
      frame: 7,
      sourceActorId: "actor",
      application: frozenApplication
    });
    const currentDecision = currentEngine.consumeAttempt({
      frame: 7,
      sourceActorId: "actor",
      application: legacy("default", "equivalent-tag")
    });

    expect(frozenDecision).toEqual(currentDecision);
  });

  it("freezes decisions and isolates state between target-local engine instances", () => {
    const firstTarget = new ElementalApplicationIcdEngine();
    const secondTarget = new ElementalApplicationIcdEngine();
    const firstDecision = firstTarget.consumeAttempt({
      frame: 0,
      sourceActorId: "actor",
      application: fixed("default")
    });
    const repeatedFirstTarget = firstTarget.consumeAttempt({
      frame: 1,
      sourceActorId: "actor",
      application: fixed("default")
    });
    const firstSecondTarget = secondTarget.consumeAttempt({
      frame: 1,
      sourceActorId: "actor",
      application: fixed("default")
    });

    expect(Object.isFrozen(firstDecision)).toBe(true);
    expect(repeatedFirstTarget.hitIndex).toBe(1);
    expect(firstSecondTarget.hitIndex).toBe(0);
  });

  it("rejects legacy profile bounds that the configuration schema cannot represent", () => {
    expect(() =>
      new ElementalApplicationIcdEngine({
        legacyProfiles: {
          oversizedReset: {
            resetFrames: 36_001,
            applicationSequence: [true]
          }
        }
      })
    ).toThrow(/no greater than 36000/);
    expect(() =>
      new ElementalApplicationIcdEngine({
        legacyProfiles: {
          oversizedSequence: {
            resetFrames: 60,
            applicationSequence: Array.from(
              { length: 129 },
              () => true
            )
          }
        }
      })
    ).toThrow(/1 to 128 boolean/);
  });
});
