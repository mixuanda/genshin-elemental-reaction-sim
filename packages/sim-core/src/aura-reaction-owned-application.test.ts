import { describe, expect, it } from "vitest";
import type { TrustedReactionElementalApplicationInput } from "@genshin-dps-lab/schemas";
import { AuraEngine } from "./aura";

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

describe("AuraEngine trusted reaction-owned application entries", () => {
  it("routes Burning through its isolated target-global projection", () => {
    const target = new AuraEngine({ mode: "aura-v4" });

    const first = target.processReactionOwnedHit(burning(0, "actor-a"));
    const firstDecision =
      target.getLastReactionOwnedElementalApplicationIcdDecision();
    const second = target.processReactionOwnedHit(burning(1, "actor-b"));
    const secondDecision =
      target.getLastReactionOwnedElementalApplicationIcdDecision();

    expect(first).toMatchObject({
      icdAllowed: true,
      icdTag: "ICDTagBurningDamage",
      icdGroup: "burning",
      applicationGaugeUnits: 1
    });
    expect(firstDecision).toMatchObject({
      scope: "trusted-target-global-burning-projection",
      windowStartFrame: 0,
      resetAtFrame: 119,
      hitIndex: 0,
      applicationMultiplier: 1
    });
    expect(second).toMatchObject({
      icdAllowed: false,
      icdTag: "ICDTagBurningDamage",
      icdGroup: "burning",
      applicationGaugeUnits: 0
    });
    expect(secondDecision).toMatchObject({
      scope: "trusted-target-global-burning-projection",
      windowStartFrame: 0,
      hitIndex: 1,
      applicationMultiplier: 0
    });
  });

  it("isolates Burning projection by AuraEngine target and resets before F119", () => {
    const targetA = new AuraEngine({ mode: "aura-v4" });
    const targetB = new AuraEngine({ mode: "aura-v4" });

    targetA.processReactionOwnedHit(burning(0, "actor-a"));
    targetA.processReactionOwnedHit(burning(118, "actor-b"));
    expect(
      targetA.getLastReactionOwnedElementalApplicationIcdDecision()
    ).toMatchObject({ hitIndex: 1, applicationMultiplier: 0 });

    targetA.processReactionOwnedHit(burning(119, "actor-c"));
    expect(
      targetA.getLastReactionOwnedElementalApplicationIcdDecision()
    ).toMatchObject({
      windowStartFrame: 119,
      resetAtFrame: 238,
      hitIndex: 0,
      applicationMultiplier: 1
    });

    targetB.processReactionOwnedHit(burning(118, "actor-b"));
    expect(
      targetB.getLastReactionOwnedElementalApplicationIcdDecision()
    ).toMatchObject({
      windowStartFrame: 118,
      hitIndex: 0,
      applicationMultiplier: 1
    });
  });

  it("derives all four Swirl elements, tags, and ReactionA group", () => {
    const expectedTags = {
      pyro: "ICDTagSwirlPyro",
      hydro: "ICDTagSwirlHydro",
      cryo: "ICDTagSwirlCryo",
      electro: "ICDTagSwirlElectro"
    } as const;

    for (const element of ["pyro", "hydro", "cryo", "electro"] as const) {
      const target = new AuraEngine({ mode: "aura-v4" });
      const audit = target.processReactionOwnedHit(
        swirl(5, "anemo-owner", element, 0.5)
      );
      expect(audit).toMatchObject({
        icdAllowed: true,
        icdTag: expectedTags[element],
        icdGroup: "reaction-a",
        applicationGaugeUnits: 0.5
      });
      expect(
        target.getLastReactionOwnedElementalApplicationIcdDecision()
      ).toMatchObject({
        kind: "reaction-fixed-gcsim",
        scope: "actor-tag",
        icdTag: expectedTags[element],
        groupId: "reaction-a",
        windowStartGroupId: "reaction-a",
        resetFrames: 30,
        resetAtFrame: 34,
        applicationMultiplier: 1
      });
    }
  });

  it("keeps trusted reaction and legacy direct Burning namespaces independent", () => {
    const target = new AuraEngine({ mode: "aura-v4" });
    target.processReactionOwnedHit(burning(0, "reaction-owner"));
    const reactionDecision =
      target.getLastReactionOwnedElementalApplicationIcdDecision();

    target.processConfiguredHit({
      frame: 0,
      sourceActorId: "configured-owner",
      element: "pyro",
      application: {
        gaugeUnits: 1,
        icd: {
          mode: "legacy-boolean-profile-v1",
          icdTag: "legacy-burning-tag",
          profileId: "burning"
        }
      }
    });
    const configuredDecision =
      target.getLastConfiguredElementalApplicationIcdDecision();

    expect(reactionDecision).toMatchObject({
      kind: "reaction-fixed-gcsim",
      hitIndex: 0,
      applicationMultiplier: 1
    });
    expect(configuredDecision).toMatchObject({
      kind: "legacy-profile",
      hitIndex: 0,
      applicationMultiplier: 1
    });
    expect(
      target.getLastReactionOwnedElementalApplicationIcdDecision()
    ).toBeNull();
  });

  it("supports the current-state entry without exposing stale decisions", () => {
    const target = new AuraEngine({ mode: "aura-v4" });
    target.processReactionOwnedHitAtCurrentTargetState(
      swirl(5, "anemo-owner", "pyro")
    );
    expect(
      target.getLastReactionOwnedElementalApplicationIcdDecision()
    ).toMatchObject({ kind: "reaction-fixed-gcsim", hitIndex: 0 });

    target.processConfiguredHitAtCurrentTargetState({
      frame: 6,
      sourceActorId: "physical-owner",
      element: "physical"
    });
    expect(target.getLastElementalApplicationIcdDecision()).toBeNull();
    expect(
      target.getLastConfiguredElementalApplicationIcdDecision()
    ).toBeNull();
    expect(
      target.getLastReactionOwnedElementalApplicationIcdDecision()
    ).toBeNull();
    expect(target.getLastBurningApplicationIcdDecision()).toBeNull();
  });

  it("rejects forged inputs before advancing Aura time or retaining a prior getter", () => {
    const target = new AuraEngine({
      mode: "aura-v4",
      initialAura: [{ element: "hydro", gaugeUnits: 1 }]
    });
    target.processReactionOwnedHit(swirl(0, "owner", "pyro"));
    const frameBefore = target.getCurrentFrame();
    const stateBefore = target.getAuraStateAt(frameBefore);
    const unsafeProcess = target.processReactionOwnedHit.bind(target) as (
      input: unknown
    ) => unknown;

    expect(() =>
      unsafeProcess({
        frame: 100,
        sourceActorId: "forger",
        channel: {
          kind: "swirl-propagation",
          element: "pyro",
          icdTag: "forged"
        },
        nominalGaugeUnits: 1
      })
    ).toThrow(/forbidden field/);

    expect(target.getCurrentFrame()).toBe(frameBefore);
    expect(target.getAuraStateAt(frameBefore)).toEqual(stateBefore);
    expect(target.getLastElementalApplicationIcdDecision()).toBeNull();
    expect(
      target.getLastReactionOwnedElementalApplicationIcdDecision()
    ).toBeNull();
  });

  it("rejects an invalid configured application before normal or current-state time advancement", () => {
    for (const currentState of [false, true]) {
      const target = new AuraEngine({
        mode: "aura-v4",
        initialAura: [{ element: "hydro", gaugeUnits: 1 }]
      });
      const stateBefore = target.getAuraStateAt(0);
      const invalid = {
        frame: 100,
        sourceActorId: "configured",
        element: "pyro" as const,
        application: {
          gaugeUnits: 0,
          icd: { mode: "no-icd-v1" as const }
        }
      };

      expect(() =>
        currentState
          ? target.processConfiguredHitAtCurrentTargetState(invalid)
          : target.processConfiguredHit(invalid)
      ).toThrow(/gaugeUnits must be positive/);
      expect(target.getCurrentFrame()).toBe(0);
      expect(target.getAuraStateAt(0)).toEqual(stateBefore);
      expect(target.getLastElementalApplicationIcdDecision()).toBeNull();
    }
  });

  it("retains configured accessor capture while rejecting trusted reaction accessors recursively", () => {
    const configuredTarget = new AuraEngine({ mode: "aura-v4" });
    let tagReads = 0;
    const selector = {
      mode: "fixed-gcsim-application-v1" as const,
      groupId: "default" as const,
      get icdTag() {
        tagReads += 1;
        if (tagReads > 1) throw new Error("configured tag reread");
        return "captured-tag";
      }
    };
    expect(() =>
      configuredTarget.processConfiguredHit({
        frame: 100,
        sourceActorId: "configured",
        element: "pyro",
        application: { gaugeUnits: 1, icd: selector }
      })
    ).not.toThrow();
    expect(tagReads).toBe(1);
    expect(
      configuredTarget.getLastConfiguredElementalApplicationIcdDecision()
    ).toMatchObject({ icdTag: "captured-tag", hitIndex: 0 });

    for (const currentState of [false, true]) {
      const reactionTarget = new AuraEngine({
        mode: "aura-v4",
        initialAura: [{ element: "hydro", gaugeUnits: 1 }]
      });
      const auraBefore = reactionTarget.getAuraStateAt(0);
      let topLevelAccessorReads = 0;
      let nestedAccessorReads = 0;
      const unsafeProcess = (
        currentState
          ? reactionTarget.processReactionOwnedHitAtCurrentTargetState
          : reactionTarget.processReactionOwnedHit
      ).bind(reactionTarget) as (input: unknown) => unknown;

      expect(() =>
        unsafeProcess({
          frame: 100,
          sourceActorId: "reaction",
          get channel() {
            topLevelAccessorReads += 1;
            reactionTarget.processReactionOwnedHit(
              burning(50, "nested-reaction")
            );
            return { kind: "burning-tick" };
          }
        })
      ).toThrow(/accessor properties are forbidden/);
      expect(() =>
        unsafeProcess({
          frame: 100,
          sourceActorId: "reaction",
          channel: {
            get kind() {
              nestedAccessorReads += 1;
              reactionTarget.processReactionOwnedHit(
                burning(50, "nested-reaction")
              );
              return "burning-tick";
            }
          }
        })
      ).toThrow(/accessor properties are forbidden/);

      expect(topLevelAccessorReads).toBe(0);
      expect(nestedAccessorReads).toBe(0);
      expect(reactionTarget.getCurrentFrame()).toBe(0);
      expect(reactionTarget.getAuraStateAt(0)).toEqual(auraBefore);
      expect(reactionTarget.getLastElementalApplicationIcdDecision()).toBeNull();
      expect(
        reactionTarget.getLastReactionOwnedElementalApplicationIcdDecision()
      ).toBeNull();
      const valid = currentState
        ? reactionTarget.processReactionOwnedHitAtCurrentTargetState(
            burning(0, "valid")
          )
        : reactionTarget.processReactionOwnedHit(burning(0, "valid"));
      expect(valid.icdAllowed).toBe(true);
      expect(
        reactionTarget.getLastReactionOwnedElementalApplicationIcdDecision()
      ).toMatchObject({ hitIndex: 0, applicationMultiplier: 1 });
    }
  });

  it("poisons caught Proxy-trap reentry before advancing Aura or ICD state", () => {
    const target = new AuraEngine({
      mode: "aura-v4",
      initialAura: [{ element: "hydro", gaugeUnits: 1 }]
    });
    const auraBefore = target.getAuraStateAt(0);
    let nestedError: unknown = null;
    const proxied = new Proxy(burning(100, "proxy-forger"), {
      ownKeys(input) {
        try {
          target.processConfiguredHit({
            frame: 50,
            sourceActorId: "nested-configured",
            element: "pyro",
            application: {
              gaugeUnits: 1,
              icd: { mode: "no-icd-v1" }
            }
          });
        } catch (error) {
          nestedError = error;
        }
        return Reflect.ownKeys(input);
      }
    });

    expect(() => target.processReactionOwnedHit(proxied)).toThrow(
      /attempted reentrant processing/
    );
    expect(nestedError).toBeInstanceOf(Error);
    expect(String(nestedError)).toMatch(
      /reentrant configured processing is forbidden/
    );
    expect(target.getCurrentFrame()).toBe(0);
    expect(target.getAuraStateAt(0)).toEqual(auraBefore);
    expect(target.getLastElementalApplicationIcdDecision()).toBeNull();
    expect(
      target.getLastReactionOwnedElementalApplicationIcdDecision()
    ).toBeNull();

    target.processReactionOwnedHit(burning(0, "valid"));
    expect(
      target.getLastReactionOwnedElementalApplicationIcdDecision()
    ).toMatchObject({ hitIndex: 0, applicationMultiplier: 1 });
  });
});
