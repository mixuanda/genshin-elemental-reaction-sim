import { describe, expect, it } from "vitest";
import { AuraEngine } from "../aura";

function applyBurningProfile(
  target: AuraEngine,
  frame: number,
  sourceActorId: string,
  icdTag: string
) {
  const audit = target.processHit({
    frame,
    sourceActorId,
    element: "pyro",
    application: {
      gaugeUnits: 1,
      icd: {
        mode: "legacy-boolean-profile-v1",
        icdTag,
        profileId: "burning"
      }
    }
  });
  const decision = target.getLastElementalApplicationIcdDecision();
  if (decision?.kind !== "legacy-profile") {
    throw new Error("expected a reaction-owned Burning ICD decision");
  }
  return { audit, decision };
}

describe("reaction-owned Burning application ICD target namespace", () => {
  it("shares one stream on the same target across actor and tag changes", () => {
    const target = new AuraEngine({ mode: "aura-v4" });

    const first = applyBurningProfile(target, 0, "actor-a", "tag-a");
    const second = applyBurningProfile(target, 1, "actor-b", "tag-b");

    expect(first.audit.icdAllowed).toBe(true);
    expect(first.decision).toMatchObject({
      scope: "target-global-burning",
      profileId: "burning",
      icdTag: "tag-a",
      windowStartFrame: 0,
      hitIndex: 0,
      applicationMultiplier: 1
    });
    expect(second.audit.icdAllowed).toBe(false);
    expect(second.decision).toMatchObject({
      scope: "target-global-burning",
      profileId: "burning",
      icdTag: "tag-b",
      windowStartFrame: 0,
      hitIndex: 1,
      applicationMultiplier: 0
    });
  });

  it("isolates the reaction-owned stream between different targets", () => {
    const targetA = new AuraEngine({ mode: "aura-v4" });
    const targetB = new AuraEngine({ mode: "aura-v4" });

    const targetAFirst = applyBurningProfile(
      targetA,
      10,
      "actor-a",
      "tag-a"
    );
    const targetASecond = applyBurningProfile(
      targetA,
      11,
      "actor-b",
      "tag-b"
    );
    const targetBFirst = applyBurningProfile(
      targetB,
      11,
      "actor-b",
      "tag-b"
    );

    expect(targetAFirst.decision).toMatchObject({
      scope: "target-global-burning",
      windowStartFrame: 10,
      hitIndex: 0,
      applicationMultiplier: 1
    });
    expect(targetASecond.decision).toMatchObject({
      scope: "target-global-burning",
      windowStartFrame: 10,
      hitIndex: 1,
      applicationMultiplier: 0
    });
    expect(targetBFirst.audit.icdAllowed).toBe(true);
    expect(targetBFirst.decision).toMatchObject({
      scope: "target-global-burning",
      windowStartFrame: 11,
      hitIndex: 0,
      applicationMultiplier: 1
    });
  });
});
