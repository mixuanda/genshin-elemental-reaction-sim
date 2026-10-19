import { expect, it } from "vitest";
import { evaluateFormulaExpression } from "../../sim-core/src/calculation-trace";
import { resolveWeaponConditionalEffects, getWeaponConditionalControls, type WeaponConditionalContext } from "./weapon-conditional-effects";

const cases = [
  { id: "weapon:15414", max: 0, expectedR1: { hitBonus: 0.32 }, expectedR5: { hitBonus: 0.64 } },
  { id: "weapon:15304", max: 0, expectedR1: { hitBonus: 0.36 }, expectedR5: { hitBonus: 0.60 } },
  { id: "weapon:15406", max: 0, expectedR1: { atkPercent: 0.36 }, expectedR5: { atkPercent: 0.72 } },
  { id: "weapon:15407", max: 4, expectedR1: { atkPercent: 0.16 }, expectedR5: { atkPercent: 0.32 } },
  { id: "weapon:12405", max: 0, expectedR1: { hitBonus: 0.20 }, expectedR5: { hitBonus: 0.36 } },
  { id: "weapon:12302", max: 0, expectedR1: { hitBonus: 0.12 }, expectedR5: { hitBonus: 0.24 } },
  { id: "weapon:12301", max: 0, tag: "charged", expectedR1: { hitBonus: 0.30 }, expectedR5: { hitBonus: 0.50 } },
  { id: "weapon:11408", max: 3, expectedR1: { atkPercent: 0.36 }, expectedR5: { atkPercent: 0.72 } },
  { id: "weapon:12408", max: 3, expectedR1: { atkPercent: 0.36 }, expectedR5: { atkPercent: 0.72 } },
  { id: "weapon:13404", max: 3, expectedR1: { atkPercent: 0.36 }, expectedR5: { atkPercent: 0.72 } },
  { id: "weapon:14408", max: 3, expectedR1: { atkPercent: 0.36 }, expectedR5: { atkPercent: 0.72 } },
  { id: "weapon:15408", max: 3, expectedR1: { atkPercent: 0.36 }, expectedR5: { atkPercent: 0.72 } },
  { id: "weapon:11404", max: 5, expectedR1: { critRate: 0.40 }, expectedR5: { critRate: 0.80 } },
  { id: "weapon:12404", max: 5, expectedR1: { critRate: 0.40 }, expectedR5: { critRate: 0.80 } },
  { id: "weapon:13408", max: 5, expectedR1: { critRate: 0.40 }, expectedR5: { critRate: 0.80 } },
  { id: "weapon:14404", max: 5, expectedR1: { critRate: 0.40 }, expectedR5: { critRate: 0.80 } },
  { id: "weapon:15404", max: 5, expectedR1: { critRate: 0.40 }, expectedR5: { critRate: 0.80 } },
  { id: "weapon:14417", max: 5, expectedR1: { em: 120, atkPercent: -0.25 }, expectedR5: { em: 180, atkPercent: -0.25 } },
  { id: "weapon:14424", max: 0, expectedR1: { hpPercent: 0.32, em: 40 }, expectedR5: { hpPercent: 0.64, em: 80 } }
] as const;

it.each(cases)("restores source-backed conditioned clauses for $id across R1–R5", row => {
  const context: WeaponConditionalContext = { weaponStacks: row.max, weaponEffectActive: true, energyFull: true, arrowTravelSeconds: 0.3, enemyAuras: ["hydro", "pyro"], hpFraction: 0.5 };
  const resolve = (refinement = 1, state: WeaponConditionalContext = context, enabled = true) => resolveWeaponConditionalEffects({ weaponId: row.id, refinement, enabled, context: state });
  const calculate = (refinement = 1, state = context, attackTag: string = "tag" in row ? row.tag : "normal"): Record<string, number> => {
    const result = resolve(refinement, state), totals: Record<string, number> = {};
    for (const modifier of result.statModifiers) totals[modifier.target] = (totals[modifier.target] ?? 0) + evaluateFormulaExpression(modifier.expression, Object.fromEntries(modifier.inputs.map(term => [term.key, term.value])));
    for (const bonus of result.dynamicHitBonuses) {
      if (bonus.attackTags && !bonus.attackTags.some(tag => tag === attackTag)) continue;
      totals.hitBonus = (totals.hitBonus ?? 0) + evaluateFormulaExpression(bonus.expression, Object.fromEntries(bonus.inputs.map(term => [term.key, term.value])));
    }
    return totals;
  };
  // All five source descriptions and numeric fields are checked, not only the endpoints.
  for (let refinement = 1; refinement <= 5; refinement++) {
    expect(resolve(refinement).missingConditions).toEqual([]);
    expect(resolve(refinement).sourceRefs.some(ref => ref.includes("b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541"))).toBe(true);
  }
  for (const [key, expected] of Object.entries(row.expectedR1)) expect(calculate()[key]).toBeCloseTo(expected, 12);
  for (const [key, expected] of Object.entries(row.expectedR5)) expect(calculate(5)[key]).toBeCloseTo(expected, 12);
  expect(resolve(1, {}).missingConditions.length + (resolve(1, {}).pendingHitEffects?.length ?? 0)).toBeGreaterThan(0);
  expect(resolve(1, {}, false).statModifiers).toEqual([]);
  expect(resolve(1, {}, false).dynamicHitBonuses).toEqual([]);
  if (row.max) {
    expect(() => resolve(1, { ...context, weaponStacks: row.max + 1 })).toThrow(/层数/);
    expect(() => resolve(1, { ...context, weaponStacks: -1 })).toThrow(/层数/);
    expect(() => resolve(1, { ...context, weaponStacks: 0.5 })).toThrow(/层数/);
    for (const value of Object.values(calculate(1, { ...context, weaponStacks: 0 }))) expect(value).toBeCloseTo(0, 12);
  }
  if (row.id === "weapon:15414") {
    expect(calculate(1, { energyFull: false }).hitBonus).toBe(0.16);
    expect(calculate(1, context, "charged").hitBonus).toBe(0.24);
    expect(calculate(5, context, "charged").hitBonus).toBe(0.48);
    expect(calculate(1, context, "skill").hitBonus).toBeUndefined();
  }
  if (row.id === "weapon:15304") {
    expect(calculate(1, { weaponEffectActive: true, arrowTravelSeconds: 0.3 }).hitBonus).toBe(0.36);
    expect(calculate(5, { weaponEffectActive: true, arrowTravelSeconds: 0.3001 }).hitBonus).toBe(-0.1);
    expect(calculate(1, { weaponEffectActive: false }).hitBonus).toBe(0);
    expect(resolve(1, { weaponEffectActive: false }).missingConditions).toEqual([]);
    expect(resolve(1, { weaponEffectActive: true }).pendingHitEffects?.map(effect => effect.reason).join()).toMatch(/arrowTravelSeconds/);
    expect(calculate(1, context, "burst").hitBonus).toBeUndefined();
    expect(getWeaponConditionalControls({ weaponId: row.id }).find(control => control.key === "weaponEffectActive")?.label).toMatch(/排除达达利亚/);
  }
  if (row.id === "weapon:12301") {
    for (const [rank, threshold] of [[1, 0.7], [2, 0.75], [3, 0.8], [4, 0.85], [5, 0.9]] as const) {
      expect(resolve(rank, { hpFraction: threshold }).pendingHitEffects?.map(effect => effect.reason).join()).toMatch(/边界来源冲突/);
      expect(resolve(rank, { hpFraction: threshold }).dynamicHitBonuses).toEqual([]);
      expect(calculate(rank, { hpFraction: 1 }).hitBonus).toBe(0);
    }
    expect(calculate(1, context, "normal").hitBonus).toBeUndefined();
  }
  if (row.id === "weapon:12405" || row.id === "weapon:12302") {
    expect(calculate(1, { enemyAuras: [] }).hitBonus).toBe(0);
    expect(calculate(1, { enemyAuras: ["electro"] }, "burst").hitBonus).toBe(row.expectedR1.hitBonus);
    expect(calculate(1, { enemyAuras: [row.id === "weapon:12405" ? "pyro" : "hydro"] }).hitBonus).toBe(0);
  }
  if (row.id === "weapon:15406" || row.id === "weapon:14424") for (const value of Object.values(calculate(1, { weaponEffectActive: false }))) expect(value).toBe(0);
  if (row.id === "weapon:15407") expect(resolve().effectBlockers.join()).toMatch(/普通攻击速度尚未/);
});
