import { expect, it } from "vitest";
import { evaluateFormulaExpression } from "../../sim-core/src/calculation-trace";
import { resolveArtifactConditionalEffects, type ArtifactConditionalContext } from "./artifact-conditional-effects";

const cases = [
  { id: "artifact-set:15006", max: 3, element: "pyro", tag: "skill", expected: { hitBonus: 0.225 } },
  { id: "artifact-set:14001", max: 0, element: "physical", tag: "normal", expected: { critRate: 0.4 } },
  { id: "artifact-set:15031", max: 3, element: "pyro", tag: "burst", expected: { critRate: 0.36 } },
  { id: "artifact-set:15032", max: 0, element: "geo", tag: "skill", expected: { hitBonus: 0.5 } },
  { id: "artifact-set:15029", max: 3, element: "hydro", tag: "charged", expected: { atkPercent: 0.25, hitBonus: 0.15 } },
  { id: "artifact-set:15016", max: 0, element: "pyro", tag: "normal", expected: { hitBonus: 0.3 } },
  { id: "artifact-set:15019", max: 0, element: "anemo", tag: "plunge", expected: { hitBonus: 0.5 } },
  { id: "artifact-set:15023", max: 4, element: "anemo", tag: "plunge", expected: { atkPercent: 0.48 } },
  { id: "artifact-set:15030", max: 5, element: "pyro", tag: "burst", expected: { hitBonus: 0.5 } },
  { id: "artifact-set:15018", max: 2, element: "physical", tag: "normal", expected: { atkPercent: 0.18, hitBonus: 0.25 } }
] as const;

it.each(cases)("restores only the four-piece conditioned contribution for $id", row => {
  const context: ArtifactConditionalContext = { setStacks: row.max, setEffectActive: true, targetFrozen: true, enemyAuras: [] };
  const resolve = (state: ArtifactConditionalContext = context, pieces = 4) => resolveArtifactConditionalEffects({ setId: row.id, pieces, enabled: true, context: state });
  const calculate = (state = context, element: string = row.element, attackTag: string = row.tag): Record<string, number> => {
    const result = resolve(state);
    const sum: Record<string, number> = {};
    for (const modifier of result.statModifiers) {
      const value = evaluateFormulaExpression(modifier.expression, Object.fromEntries(modifier.inputs.map(term => [term.key, term.value])));
      sum[modifier.target] = (sum[modifier.target] ?? 0) + value;
    }
    for (const bonus of result.dynamicHitBonuses) {
      if (bonus.elements && !bonus.elements.some(value => value === element)) continue;
      if (bonus.attackTags && !bonus.attackTags.some(value => value === attackTag)) continue;
      sum.hitBonus = (sum.hitBonus ?? 0) + evaluateFormulaExpression(bonus.expression, Object.fromEntries(bonus.inputs.map(term => [term.key, term.value])));
    }
    return sum;
  };
  expect(resolve().missingConditions).toEqual([]);
  expect(resolve().sourceRefs.some(ref => ref.includes("b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541"))).toBe(true);
  for (const [key, value] of Object.entries(row.expected)) expect(calculate()[key]).toBeCloseTo(value, 12);
  expect(resolve({}, 2).statModifiers).toEqual([]);
  expect(resolve({}, 2).dynamicHitBonuses).toEqual([]);
  expect(resolve({}).missingConditions.length + (resolve({}).pendingHitEffects?.length ?? 0)).toBeGreaterThan(0);
  if (row.max > 0) {
    expect(() => resolve({ ...context, setStacks: row.max + 1 })).toThrow(/层数/);
    expect(() => resolve({ ...context, setStacks: 0.5 })).toThrow(/层数/);
  }
  if (row.id === "artifact-set:14001") {
    expect(calculate({ targetFrozen: true, enemyAuras: [] }).critRate).toBe(0.4);
    expect(calculate({ targetFrozen: false, enemyAuras: ["cryo"] }).critRate).toBe(0.2);
    expect(calculate({ targetFrozen: false, enemyAuras: [] }).critRate).toBe(0);
    expect(resolve({ targetFrozen: false }).missingConditions.join()).toMatch(/enemyAuras/);
    expect(resolve().assumptions.join()).toMatch(/不是角色常驻面板/);
  }
  if (row.id === "artifact-set:15029") {
    for (const [n, atk, hydro] of [[0, 0, 0], [1, 0.07, 0.04], [2, 0.16, 0.09], [3, 0.25, 0.15]]) {
      const output = calculate({ setStacks: n! });
      expect(output.atkPercent).toBe(atk); expect(output.hitBonus).toBe(hydro);
    }
    expect(calculate(context, "physical").hitBonus).toBeUndefined();
  }
  if (row.id === "artifact-set:15032") {
    expect(calculate({ setEffectActive: false }).hitBonus).toBe(0.25);
    expect(calculate(context, row.element, "burst").hitBonus).toBeUndefined();
  }
  if (row.id === "artifact-set:15030") {
    expect(calculate({ setStacks: 0 }).hitBonus).toBe(0.1);
    expect(calculate(context, row.element, "normal").hitBonus).toBeUndefined();
  }
  if (row.id === "artifact-set:15023") {
    expect(calculate({ setEffectActive: false }).atkPercent).toBe(0);
    expect(resolve({ setEffectActive: false }).missingConditions).toEqual([]);
    expect(calculate({ setEffectActive: true, setStacks: 0 }).atkPercent).toBe(0.08);
  }
  if (row.id === "artifact-set:15018") {
    expect(calculate({ setStacks: 1 }).hitBonus).toBe(0);
    expect(calculate(context, "pyro").hitBonus).toBeUndefined();
  }
  if (row.id === "artifact-set:15006") {
    expect(resolve().assumptions.join()).toMatch(/反应系数由独立/);
    expect(calculate(context, "hydro").hitBonus).toBeUndefined();
  }
  if (row.id === "artifact-set:15016" || row.id === "artifact-set:15019") {
    expect(calculate({ setEffectActive: false }).hitBonus).toBe(0);
    expect(calculate(context, row.element, "skill").hitBonus).toBeUndefined();
  }
});
