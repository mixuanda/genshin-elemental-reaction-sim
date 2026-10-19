import { describe, expect, it } from "vitest";
import { resolveSourceHostArtifactDynamicInput, sourceHostArtifactDynamicInputSchema,
  sourceHostArtifactDynamicRuleDescriptor } from "../source-host-artifact-dynamic-formula";
import { SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT } from "../source-host-wire";

describe("source-host dynamic artifact Amount formulas", () => {
  it("uses observed state values for ER cap, negative Husk stacks, Gilded's two slots, and a two-key reaction stack", () => {
    const emblem = { ruleId: "dynamic-emblem-4pc-dmgp", state: { er: 2.4 } };
    const ordinaryER = resolveSourceHostArtifactDynamicInput(emblem, SOURCE_HOST_COMMIT);
    const cappedER = resolveSourceHostArtifactDynamicInput(
      { ruleId: emblem.ruleId, state: { er: 4 } }, SOURCE_HOST_COMMIT);
    expect(ordinaryER.value).toBeCloseTo(.6, 12);
    expect(cappedER.value).toBe(.75);
    expect(ordinaryER.trace[0]?.inputs).toMatchObject([
      { key: "er", value: 2.4, unit: "ratio", origin: "source-host-native-state" },
    ]);
    expect(ordinaryER.trace[0]?.result?.value).toBe(ordinaryER.value);
    expect(ordinaryER.trace[0]?.substitution).not.toContain("er");

    const husk = resolveSourceHostArtifactDynamicInput(
      { ruleId: "dynamic-huskofopulentdreams-4pc-defp", state: { stacks: -1 } }, SOURCE_HOST_COMMIT);
    expect(husk.value).toBeCloseTo(-.06, 12);
    expect(husk.trace[0]?.inputs).toMatchObject([
      { key: "stacks", value: -1, unit: "count", origin: "source-host-native-state" },
    ]);

    const gildedAttack = resolveSourceHostArtifactDynamicInput(
      { ruleId: "dynamic-gildeddreams-4pc-atkp", state: { atkCount: 2 } }, SOURCE_HOST_COMMIT);
    const gildedMastery = resolveSourceHostArtifactDynamicInput(
      { ruleId: "dynamic-gildeddreams-4pc-em", state: { emCount: 1 } }, SOURCE_HOST_COMMIT);
    expect(sourceHostArtifactDynamicRuleDescriptor("dynamic-gildeddreams-4pc-atkp").modifierKeys)
      .toEqual(["gd-4pc"]);
    expect(sourceHostArtifactDynamicRuleDescriptor("dynamic-gildeddreams-4pc-em").modifierKeys)
      .toEqual(["gd-4pc"]);
    expect([gildedAttack.value, gildedMastery.value]).toEqual([.28, 50]);
    expect([gildedAttack.trace[0]?.result?.unit, gildedMastery.trace[0]?.result?.unit])
      .toEqual(["ratio", "EM"]);
    expect(gildedAttack.trace[0]?.inputs.map(input => [input.key, input.value]))
      .toEqual([["atkCount", 2]]);
    expect(gildedMastery.trace[0]?.inputs.map(input => [input.key, input.value]))
      .toEqual([["emCount", 1]]);

    const flowerInput = { ruleId: "dynamic-flowerofparadiselost-4pc-stack",
      state: { branch: 1, stacks: 3 } };
    expect(sourceHostArtifactDynamicInputSchema.parse(flowerInput).state).toEqual({ branch: 1, stacks: 3 });
    const flower = resolveSourceHostArtifactDynamicInput(flowerInput, SOURCE_HOST_COMMIT);
    expect(flower.value).toBeCloseTo(.075, 12);
    const ordinaryFlower = resolveSourceHostArtifactDynamicInput(
      { ruleId: flowerInput.ruleId, state: { branch: 0, stacks: 3 } }, SOURCE_HOST_COMMIT);
    expect(ordinaryFlower.value).toBeCloseTo(.3, 12);
    expect(flower.trace[0]?.inputs.map(input => [input.key, input.value, input.origin]))
      .toEqual([["branch", 1, "source-host-native-state"], ["stacks", 3, "source-host-native-state"]]);
    expect(flower.trace[0]?.substitution).not.toContain("branch");
    expect(flower.trace[0]?.substitution).not.toContain("stacks");
    expect(() => sourceHostArtifactDynamicInputSchema.parse(
      { ruleId: flowerInput.ruleId, state: { branch: 1 } })).toThrow();

    const recipientHydro = resolveSourceHostArtifactDynamicInput(
      { ruleId: "dynamic-celestialgift-4pc-holder-hydro", state: { hexerei: 1 } }, SOURCE_HOST_STELLAR_COMMIT);
    expect(recipientHydro.value).toBeCloseTo(.4, 12);
    expect(recipientHydro.trace[0]?.result?.unit).toBe("ratio");
    expect(recipientHydro.trace[0]?.inputs[0]).toMatchObject({ key: "hexerei", value: 1,
      origin: "source-host-native-state" });
  });

  it("keeps b4 and a7 reaction branches tied to their own pinned source commit", () => {
    const cases = [
      { b4: { ruleId: "dynamic-thunderingfury-4pc-b4", state: { branch: 1 } }, b4Value: .4,
        a7: { ruleId: "dynamic-thunderingfury-4pc-a7", state: { branch: 3 } }, a7Value: .2 },
      { b4: { ruleId: "dynamic-viridescent-4pc-b4", state: {} }, b4Value: .6,
        a7: { ruleId: "dynamic-viridescent-4pc-a7", state: { branch: 1 } }, a7Value: .2 },
      { b4: { ruleId: "dynamic-disenchantmentindeepshadow-4pc-react-b4", state: {} }, b4Value: .8,
        a7: { ruleId: "dynamic-disenchantmentindeepshadow-4pc-react-a7", state: { branch: 1 } }, a7Value: .4 },
    ] as const;
    for (const { b4, b4Value, a7, a7Value } of cases) {
      const classic = resolveSourceHostArtifactDynamicInput(b4, SOURCE_HOST_COMMIT);
      const stellar = resolveSourceHostArtifactDynamicInput(a7, SOURCE_HOST_STELLAR_COMMIT);
      expect(classic.value).toBeCloseTo(b4Value, 12);
      expect(stellar.value).toBeCloseTo(a7Value, 12);
      expect(classic.trace[0]?.sourceRefs[0]).toContain(`/blob/${SOURCE_HOST_COMMIT}/`);
      expect(stellar.trace[0]?.sourceRefs[0]).toContain(`/blob/${SOURCE_HOST_STELLAR_COMMIT}/`);
      expect(() => resolveSourceHostArtifactDynamicInput(b4, SOURCE_HOST_STELLAR_COMMIT))
        .toThrow(/不适用于固定源码/);
      expect(() => resolveSourceHostArtifactDynamicInput(a7, SOURCE_HOST_COMMIT))
        .toThrow(/不适用于固定源码/);
    }
  });
});
