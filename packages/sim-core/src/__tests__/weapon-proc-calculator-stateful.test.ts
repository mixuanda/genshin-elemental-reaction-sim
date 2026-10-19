import { expect, it } from "vitest";
import { getWeaponProcDefinition, getWeaponProcTriggerProbability } from "@genshin-dps-lab/reaction-formulas";
import { createWeaponProcCalculatorDocument } from "../weapon-proc-calculator";
import { calculateDocument, parseCalculatorDocument, serializeCalculatorDocument } from "../calculator";
import { evaluateFormulaExpression, formatFormulaExpression } from "../calculation-trace";

const positions = {
  flute: [1, 1.25, 1.5, 1.75, 2],
  debateclub: [.6, .75, .9, 1.05, 1.2],
  crescentpike: [.2, .25, .3, .35, .4],
  endoftheline: [.8, 1, 1.2, 1.4, 1.6]
} as const;

it("calculates one actual stateful weapon proc at all twenty refinement positions without requiring its team or lifecycle", () => {
  for (const weaponId of Object.keys(positions) as Array<keyof typeof positions>) for (let refinement = 1; refinement <= 5; refinement++) {
    const coefficient = positions[weaponId][refinement - 1]!;
    const document = createWeaponProcCalculatorDocument({weaponId, refinement, characterLevel: 90,
      build: {mode: "manual-final", stats: {atk: 1000, hp: 10000, def: 700, em: 0, critRate: .5, critDamage: 1}, source: "可编辑的本次追击面板"},
      enemy: {level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0}, damageBonus: .2});
    const result = calculateDocument(document);
    expect(result.status).toBe("calculated"); expect(result.verification).toBe("provisional");
    expect(result.totals!.nonCritical).toBeCloseTo(1000 * coefficient * 1.2 * .5 * .9, 10);
    expect(result.totals!.critical).toBeCloseTo(1080 * coefficient, 10);
    expect(result.totals!.expected).toBeCloseTo(810 * coefficient, 10);
    expect(result).not.toHaveProperty("dps"); expect(document).not.toHaveProperty("gameContext");
    expect(document.weaponProc).toEqual({weaponId, refinement});
    expect(document.dependencies.some(row => row.status === "missing")).toBe(false);
    expect(getWeaponProcTriggerProbability(getWeaponProcDefinition(weaponId)!, refinement)).toBeNull();
    const hit = document.hits[0]!; if (hit.kind !== "ordinary") throw new Error("Expected independent physical proc");
    expect(hit).toMatchObject({element: "physical", attackTag: "proc", critEligible: true, reaction: "none"});
    expect(hit.baseDamageFormula!.inputs[0]!.allowedValues).toEqual([hit.terms[0]!.coefficient]);
    expect(result.hits[0]!.trace.find(row => row.id === "weaponProcCoefficient")!.result!.value).toBeCloseTo(coefficient, 14);
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
    if (restored.build.mode === "equipment-derived") throw new Error("Expected editable final panel");
    restored.build.stats.atk = 1250;
    expect(calculateDocument(restored).totals!.expected).toBeCloseTo(810 * coefficient * 1.25, 10);
    if (weaponId === "flute") expect(document.assumptions.join(" ")).toContain("收集音符门限");
    if (weaponId === "crescentpike") expect(document.assumptions.join(" ")).toContain("无独立追击伤害冷却");
  }
});
