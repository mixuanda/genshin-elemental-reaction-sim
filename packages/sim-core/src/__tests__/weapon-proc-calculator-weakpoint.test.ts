import { expect, it } from "vitest";
import { createWeaponProcCalculatorDocument } from "../weapon-proc-calculator";
import { calculateDocument, parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument } from "../calculator";
import { evaluateFormulaExpression, formatFormulaExpression } from "../calculation-trace";

const coefficients = {
  messenger: [1, 1.25, 1.5, 1.75, 2],
  swordofnarzissenkreuz: [1.6, 2, 2.4, 2.8, 3.2],
  eyeofperception: [2.4, 2.7, 3, 3.3, 3.6],
  theviridescenthunt: [.4, .5, .6, .7, .8]
} as const;

it("calculates twenty standalone proc positions and preserves real CR while Messenger and resolved weak-point hits force actual critical damage", () => {
  for (const weaponId of Object.keys(coefficients) as Array<keyof typeof coefficients>) for (let refinement = 1; refinement <= 5; refinement++) {
    const coefficient = coefficients[weaponId][refinement - 1]!;
    const document = createWeaponProcCalculatorDocument({weaponId, refinement, characterLevel: 90,
      build: {mode: "manual-final", stats: {atk: 1000, hp: 10000, def: 700, em: 0, critRate: .2, critDamage: 1.5}, source: "本次已发生追击的可编辑最终面板"},
      enemy: {level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0}, damageBonus: .2});
    const result = calculateDocument(document), guaranteed = weaponId === "messenger";
    expect(result.status).toBe("calculated"); expect(result.verification).toBe("provisional");
    expect(result.totals!.nonCritical).toBeCloseTo(540 * coefficient, 10);
    expect(result.totals!.critical).toBeCloseTo(1350 * coefficient, 10);
    expect(result.totals!.expected).toBeCloseTo((guaranteed ? 1350 : 702) * coefficient, 10);
    expect(result.hits[0]!.effectiveCritRate).toBe(.2);
    expect(document).not.toHaveProperty("gameContext"); expect(result).not.toHaveProperty("dps");
    const hit = document.hits[0]!; if (hit.kind !== "ordinary") throw new Error("Expected ordinary source proc");
    expect(hit.baseDamageFormula!.inputs[0]!.allowedValues).toEqual([hit.terms[0]!.coefficient]);
    if (guaranteed) {
      expect(hit.hitWeakPoint).toBe(true);
      expect(result.hits[0]).toMatchObject({criticalProbability: 1, nonCriticalComparisonOnly: true});
      expect(result.warnings.join(" ")).toContain("本条件下不会发生");
      expect(result.hits[0]!.trace.some(node => node.id === "expected.weakPointGuaranteedCritical")).toBe(true);
    } else {
      expect(result.hits[0]!.nonCriticalComparisonOnly).toBeUndefined();
      expect(document.assumptions.join(" ")).toContain("自动触发边界");
      expect(document.assumptions.join(" ")).not.toContain("无需随机触发抽样");
    }
    for (const node of result.trace) {
      if (!node.result) continue;
      const bindings = Object.fromEntries(node.inputs.map(input => [input.key, input.value]));
      expect(node.result.value).toBe(evaluateFormulaExpression(node.expression, bindings));
      expect(node.substitution).toBe(formatFormulaExpression(node.expression, bindings));
      expect(node.symbolicFormula && node.explanationKey).toBeTruthy();
      expect(node.inputs.every(input => input.meaningKey && input.unit && input.origin)).toBe(true);
    }
    const restored = parseCalculatorDocument(serializeCalculatorDocument(document));
    expect(calculateDocument(restored).totals).toEqual(result.totals);
    if (restored.build.mode === "equipment-derived") throw new Error("Expected manual panel");
    restored.build.stats.critRate = .9;
    const restoredHit = restored.hits[0]!; if (restoredHit.kind !== "ordinary") throw new Error();
    if (guaranteed) restoredHit.hitWeakPoint = false; // Saved override cannot remove the source's guarantee.
    const edited = calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(restored)));
    expect(edited.hits[0]!.effectiveCritRate).toBe(.9);
    expect(edited.totals!.expected).toBeCloseTo((guaranteed ? 1350 : 1269) * coefficient, 10);
    if (guaranteed) expect(edited.totals).toEqual(result.totals);
  }

  const resolved: CalculatorDocument = {schemaVersion: "1.0.0", ruleVersion: "ordinary-trace-v1", id: "resolved-weak-point-teaching", label: "明确教学弱点条件", scope: "single-hit", characterLevel: 90,
    build: {mode: "manual-final", stats: {atk: 1000, hp: 10000, def: 700, em: 0, critRate: 0, critDamage: 1.5}, source: "教学面板，真实CR为0"},
    enemy: {level: 90, resistance: 0, defenseAdjustment: 0, defenseIgnore: 0},
    hits: [{id: "resolved", label: "教学前置伤害", kind: "resolved", preReactionDamage: 200, amplificationMultiplier: 1.5, critEligible: true, hitWeakPoint: true, entryPoint: "明确已知反应前伤害", sourceRefs: ["synthetic:weak-point-teaching"], dependencies: []}],
    selectedHitIds: ["resolved"], assumptions: [], dependencies: [], dataIdentity: {datasetId: "synthetic-weak-point", gameVersion: "synthetic", releaseStatus: "synthetic", evidenceStatus: "synthetic"}};
  const result = calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(resolved)));
  expect(result.totals).toEqual({nonCritical: 300, critical: 750, expected: 750});
  expect(result.hits[0]).toMatchObject({effectiveCritRate: 0, criticalProbability: 1, nonCriticalComparisonOnly: true});
});
