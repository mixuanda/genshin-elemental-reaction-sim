import { describe, expect, it } from "vitest";
import { resolveSourceHostCharacterScalarInput } from "../source-host-character-scalar-formula";
import { resolveSourceHostCooldownInput, sourceHostCooldownRouteTargets } from "../source-host-cooldown-formula";
import { resolveSourceHostHealingInput } from "../source-host-healing-formula";
import { SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT } from "../source-host-wire";

describe("source character auxiliary overrides", () => {
  it("derives the native branch leaves and preserves override routing separately from an effective state change", () => {
    const scalar = (ruleId: string, modifierKey: string, state: Record<string, number>) =>
      resolveSourceHostCharacterScalarInput({ ruleId, modifierKey, sourceHolderIndex: 0, phase: "read", state }, SOURCE_HOST_STELLAR_COMMIT);

    const durinRule = "char-scalar-durin-a1-black-derived";
    expect(scalar(durinRule, "durin-a1-black", { isHexerei: 0, hexereiCount: 0 }).value).toBe(.4);
    // This is a pure counterfactual: the native non-Hexerei branch does not read the count.
    expect(scalar(durinRule, "durin-a1-black", { isHexerei: 0, hexereiCount: 2 }).value).toBe(.4);
    expect(scalar(durinRule, "durin-a1-black", { isHexerei: 1, hexereiCount: 2 }).value).toBeCloseTo(.7, 12);

    const mixedIfa = {
      teamCount: 4, member0Kind: 3, member0Points: 90,
      member1Kind: 1, member1Points: 0, // Condition returned an error.
      member2Kind: 2, member2Points: 0, // Condition returned a non-float64 value.
      member3Kind: 3, member3Points: 80,
    };
    // Valid slots total 170. C2 adds 3*(170-60)=330, then ascension raises the cap from 150 to 200.
    const ifaRule = "char-scalar-ifa-a1-swirl-ec-derived";
    const ifaNoC2 = scalar(ifaRule, "ifa-a1", { ...mixedIfa, cons: 1, ascension: 1 });
    const ifaC2BeforeAsc = scalar(ifaRule, "ifa-a1", { ...mixedIfa, cons: 2, ascension: 0 });
    const ifaC2AfterAsc = scalar(ifaRule, "ifa-a1", { ...mixedIfa, cons: 2, ascension: 1 });
    expect(ifaNoC2.value).toBeCloseTo(150 * .015, 12);
    expect(ifaC2BeforeAsc.value).toBeCloseTo(150 * .015, 12);
    expect(ifaC2AfterAsc.value).toBeCloseTo(200 * .015, 12);
    expect(ifaC2AfterAsc.trace[0]!.inputs.map(input => [input.key, input.value])).toEqual([
      ["cons", 2], ["ascension", 1], ["teamCount", 4],
      ["member0Kind", 3], ["member0Points", 90], ["member1Kind", 1], ["member1Points", 0],
      ["member2Kind", 2], ["member2Points", 0], ["member3Kind", 3], ["member3Points", 80],
    ]);
    expect(scalar("char-scalar-ifa-a1-lunar-stellar-derived", "ifa-a1", { ...mixedIfa, cons: 2, ascension: 1 }).value)
      .toBeCloseTo(200 * .002, 12);

    expect(resolveSourceHostHealingInput({ operation: "receive-override", branch: "arlecchino-rejected", finalAmount: 3000 }, SOURCE_HOST_COMMIT).value).toBe(0);
    expect(resolveSourceHostHealingInput({ operation: "receive-conversion", finalAmount: 1000, ascension: 3 }, SOURCE_HOST_COMMIT).value).toBe(800);
    expect(resolveSourceHostHealingInput({ operation: "receive-conversion", finalAmount: 1000, ascension: 4 }, SOURCE_HOST_COMMIT).value).toBe(1000);
    expect(resolveSourceHostHealingInput({ operation: "receive-override", branch: "clorinde-converted", finalAmount: 1000, convertedAmount: 800 }, SOURCE_HOST_COMMIT).value).toBe(0);

    const varka = resolveSourceHostCooldownInput({ operation: "special-reduce", action: "skill", actionType: 1,
      rule: "varka-classic", expiry: 110, reduction: 50, currentFrame: 80 }, SOURCE_HOST_COMMIT);
    expect(varka.value).toBe(80); // max(110-50, current frame 80)
    expect(varka.trace.map(node => node.result?.value)).toEqual([60, 80]);
    const thunderingFury = resolveSourceHostCooldownInput({ operation: "source", action: "skill",
      actionType: 1, rule: "thundering-fury", reduction: 60 }, SOURCE_HOST_COMMIT);
    expect(thunderingFury.value).toBe(60); // Source request only; it does not prove an effective 60-frame decrease.

    const odette = { operation: "route" as const, action: "skill", actionType: 1,
      rule: "odette" as const, reduction: 42, specialActive: true };
    const cyno = { operation: "route" as const, action: "skill", actionType: 1,
      rule: "cyno" as const, reduction: 42, specialActive: false };
    expect(sourceHostCooldownRouteTargets(odette)).toEqual([14]);
    expect(sourceHostCooldownRouteTargets(cyno)).toEqual([1, 6]);
    const odetteResult = resolveSourceHostCooldownInput(odette, SOURCE_HOST_STELLAR_COMMIT);
    const cynoResult = resolveSourceHostCooldownInput(cyno, SOURCE_HOST_COMMIT);
    expect(odetteResult.trace.find(node => node.id.endsWith(".targetCount"))?.result?.value).toBe(1);
    expect(cynoResult.trace.find(node => node.id.endsWith(".targetCount"))?.result?.value).toBe(2);
    expect([odetteResult.value, cynoResult.value]).toEqual([42, 42]);
  });
});
