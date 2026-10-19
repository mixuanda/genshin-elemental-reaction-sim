import { describe, expect, it } from "vitest";
import {
  calculateConditionedSpecial, conditionedSpecialCalculationSchema,
  SPECIAL_FORMULA_RULES, STELLAR_CONDUCT_APPLICATION_MULTIPLIERS,
  type ConditionedSpecialCalculation, type SpecialContributor,
} from "./special";

const refs = ["synthetic-teaching-fixture:no-character-claim"];
function contributor(id: string, value: number, critRate = 0, critDamage = 0): SpecialContributor {
  return { id, base: { kind: "level-base", characterLevel: 90, value, evidence: "synthetic", sourceRefs: refs }, elementalMastery: 0, specialBaseBonus: 0, reactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1, critRate, critDamage, modifierSourceRefs: refs };
}
function fixture(contributors: SpecialContributor[] = [contributor("A", 100 / 3, 0.5, 1), contributor("B", 50)]): ConditionedSpecialCalculation {
  return { branch: "lunar-charged-reaction", ruleVersion: SPECIAL_FORMULA_RULES.lunar.id, context: { mode: "conditioned", enablement: "assumed-enabled", contributorEligibility: "assumed", assumptions: ["Synthetic exact expectation vector; eligibility supplied, no critical-triggered feedback."] }, contributors, effectiveResistance: 0 };
}

describe("conditioned special formulas pinned to KQM source versions", () => {
  it("applies individual critical outcomes before ranking: exact142.5 differs from rank-of-means135", () => {
    const result = calculateConditionedSpecial(fixture());
    expect(result.nonCritical).toBeCloseTo(120, 10);
    expect(result.critical).toBeCloseTo(165, 10);
    expect(result.expected).toBeCloseTo(142.5, 10);
    expect(result.outcomes.map(o => o.damage)).toEqual([120, 165]);
    expect(result.outcomes.map(o => o.rankedContributions[0]!.contributorId)).toEqual(["B", "A"]);
    expect(result.expected).not.toBe(135);
    expect(result.readiness).toBe("conditioned-formula-only");
  });
  it("is invariant to contributor collection order", () => {
    const input = fixture();
    expect(calculateConditionedSpecial({ ...input, contributors: [...input.contributors].reverse() }).expected).toBe(calculateConditionedSpecial(input).expected);
  });
  it("ties have stable numerical totals and no invented critical label or game attribution", () => {
    const result = calculateConditionedSpecial(fixture([contributor("B", 50), contributor("A", 25, 1, 1)]));
    expect(result.expected).toBe(135);
    expect(result.outcomes[0]!.displayedCritical).toBe("ambiguous-tie");
    expect(result.outcomes[0]!.rankedContributions.map(c => c.contributorId)).toEqual(["A", "B"]);
  });
  it("uses fixed rank weights without renormalizing missing contributors", () => {
    expect(calculateConditionedSpecial(fixture([contributor("A", 100)])).expected).toBe(180);
    expect(calculateConditionedSpecial(fixture([contributor("A", 100), contributor("B", 50), contributor("C", 25), contributor("D", 10)])).expected).toBeCloseTo(230.25, 10);
  });
  it("enumerates all16 independent outcomes for four contributors", () => {
    const result = calculateConditionedSpecial(fixture([1, 2, 3, 4].map(i => contributor(String(i), i * 100, 0.5, 1))));
    expect(result.outcomes).toHaveLength(16);
    expect(result.outcomes.reduce((sum, o) => sum + o.probability, 0)).toBe(1);
    expect(result.outcomes.reduce((sum, o) => sum + o.damage * o.probability, 0)).toBe(result.expected);
  });
  it("distinguishes direct stat-times-talent from level-based reaction damage", () => {
    const input = fixture([{ ...contributor("A", 1, 0.5, 1), base: { kind: "direct-stat-talent", scalingStat: "hp", statValue: 1000, talentCoefficient: 0.2, sourceRefs: refs }, elementalMastery: 2000, specialBaseBonus: 0.1, reactionBonus: 0.5, specialAdditive: 30, elevationMultiplier: 1.2 }]);
    input.branch = "lunar-charged-direct";
    input.effectiveResistance = 0.1;
    // (3 * 1000 * .2 * 1.1 * (1 + 3 + .5) + 30) * .9 * 1.2.
    const result = calculateConditionedSpecial(input);
    expect(result.nonCritical).toBeCloseTo(3240, 10);
    expect(result.critical).toBeCloseTo(6480, 10);
    expect(result.expected).toBeCloseTo(4860, 10);
    expect(result.outcomes[0]!.rankedContributions[0]!.weight).toBe(1);
  });
  it.each([
    ["lunar-crystallize-reaction", "lunar", 1.6],
    ["stellar-swirl-anemo-reaction", "stellar", 0.75],
    ["stellar-swirl-vortex-1", "stellar", 2],
    ["stellar-swirl-vortex-2", "stellar", 3],
  ] as const)("pins distinct source coefficient for %s", (branch, family, coefficient) => {
    const input = fixture([contributor("A", 100)]);
    input.branch = branch; input.ruleVersion = SPECIAL_FORMULA_RULES[family].id;
    expect(calculateConditionedSpecial(input).expected).toBeCloseTo(100 * coefficient * 0.6, 10);
  });
  it("uses the complete count table for conditioned direct Stellar-Conduct", () => {
    for (let count = 0; count <= 12; count++) {
      const input = fixture([{ ...contributor("A", 1), base: { kind: "direct-stat-talent", scalingStat: "atk", statValue: 100, talentCoefficient: 1, sourceRefs: refs } }]);
      input.branch = "stellar-conduct-direct"; input.ruleVersion = SPECIAL_FORMULA_RULES.stellar.id; input.polestarApplicationCount = count;
      expect(calculateConditionedSpecial(input).expected).toBeCloseTo(100 * STELLAR_CONDUCT_APPLICATION_MULTIPLIERS[count]!, 10);
    }
  });
  it.each([["lunar-bloom-direct", "lunar", 1], ["lunar-crystallize-direct", "lunar", 1.6], ["stellar-swirl-direct", "stellar", 1]] as const)("uses direct %s stat coefficient without reaction rank weights", (branch, family, coefficient) => {
    const input = fixture([{ ...contributor("A", 1), base: { kind: "direct-stat-talent", scalingStat: "em", statValue: 100, talentCoefficient: 2, sourceRefs: refs } }]);
    input.branch = branch; input.ruleVersion = SPECIAL_FORMULA_RULES[family].id;
    expect(calculateConditionedSpecial(input).expected).toBe(200 * coefficient);
  });
  it.each([["lunar-bloom-event", "lunar"], ["stellar-conduct-event", "stellar"]] as const)("does not fabricate immediate damage for %s", (branch, family) => {
    const input = fixture([]); input.branch = branch; input.ruleVersion = SPECIAL_FORMULA_RULES[family].id;
    const result = calculateConditionedSpecial(input);
    expect(result.status).toBe("non-damaging");
    expect(result.expected).toBeUndefined();
    expect(result.stages).toEqual([]);
    expect(result.nonDamageReason).toBeTruthy();
  });
  it.each([[-0.2, 1.1], [0, 1], [0.1, 0.9], [0.7499, 0.2501], [0.75, 0.25], [1, 0.2]])("applies resistance %s via the correct branch", (res, multiplier) => {
    const input = fixture([contributor("A", 100)]); input.effectiveResistance = res!;
    expect(calculateConditionedSpecial(input).expected).toBeCloseTo(180 * multiplier!, 10);
  });
  it.each(["disabled", "unknown"] as const)("blocks %s enablement and does not auto-certify an ordinary fallback", enablement => {
    const input = fixture(); input.context.enablement = enablement;
    const result = calculateConditionedSpecial(input);
    expect(result.status).toBe("blocked"); expect(result.expected).toBeUndefined(); expect(result.blockers).toHaveLength(1);
  });
  it("rejects duplicate identities, absent bases, wrong modes, unsupported fields and versions", () => {
    const input = fixture();
    expect(() => calculateConditionedSpecial({ ...input, contributors: [input.contributors[0]!, input.contributors[0]!] })).toThrow(/unique/);
    expect(conditionedSpecialCalculationSchema.safeParse({ ...input, contributors: [{ ...input.contributors[0], base: undefined }] }).success).toBe(false);
    expect(conditionedSpecialCalculationSchema.safeParse({ ...input, branch: "lunar-charged-direct" }).success).toBe(false);
    expect(conditionedSpecialCalculationSchema.safeParse({ ...input, damageBonus: 100, defenseReduction: 1 }).success).toBe(false);
    expect(conditionedSpecialCalculationSchema.safeParse({ ...input, ruleVersion: SPECIAL_FORMULA_RULES.stellar.id }).success).toBe(false);
    expect(conditionedSpecialCalculationSchema.safeParse({ ...input, polestarApplicationCount: 0 }).success).toBe(false);
    expect(conditionedSpecialCalculationSchema.safeParse({ ...input, contributors: Array(5).fill(input.contributors[0]) }).success).toBe(false);
    expect(conditionedSpecialCalculationSchema.safeParse({ ...input, effectiveResistance: Infinity }).success).toBe(false);
  });
  it("records raw machine-valued intermediates and rejects overflow", () => {
    const result = calculateConditionedSpecial(fixture());
    expect(result.stages.find(s => s.id === "expected.total")!.result).toBe(result.expected);
    expect(result.stages.every(s => s.sourceRefs.length && Number.isFinite(s.result))).toBe(true);
    const input = fixture([contributor("A", Number.MAX_VALUE)]);
    expect(() => calculateConditionedSpecial(input)).toThrow(/non-finite/);
    expect(() => calculateConditionedSpecial({ ...fixture(), effectiveResistance: Number.MAX_VALUE })).toThrow(/non-finite/);
  });
});
