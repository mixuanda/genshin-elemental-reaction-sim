import { expect, it } from "vitest";
import type { WeaponProcId } from "@genshin-dps-lab/reaction-formulas";
import { createWeaponProcCalculatorDocument, getWeaponProcDocumentSelection, prepareWeaponProcCalculatorDocument } from "../weapon-proc-calculator";
import { calculateDocument, parseCalculatorDocument, serializeCalculatorDocument } from "../calculator";
import { evaluateFormulaExpression, expr, formatFormulaExpression } from "../calculation-trace";

const input = {characterLevel: 80, build: {mode: "manual-final" as const, stats: {atk: 1000, hp: 18000, def: 700, em: 0, critRate: .25, critDamage: 1.2}, source: "明确教学输入"},
  enemy: {level: 90, resistance: .2, defenseAdjustment: 0, defenseIgnore: 0}, damageBonus: .35};
const frostIds = ["snowtombedstarsilver", "dragonspinespear", "frostbearer"] as const;
const coefficients: Partial<Record<WeaponProcId, number[]>> = {
  filletblade: [2.4, 2.8, 3.2, 3.6, 4], prototypearchaic: [2.4, 3, 3.6, 4.2, 4.8],
  snowtombedstarsilver: [.8, .95, 1.1, 1.25, 1.4], dragonspinespear: [.8, .95, 1.1, 1.25, 1.4], frostbearer: [.8, .95, 1.1, 1.25, 1.4]
};
const nonCritical = (coefficient: number) => 1000 * coefficient * 1.35 * (180 / 370) * .8;

it("calculates the five actual weapon procs at R1-R5 with separate source selection, ATK, critical, DEF and physical RES steps", () => {
  for (const weaponId of Object.keys(coefficients) as WeaponProcId[]) for (let refinement = 1; refinement <= 5; refinement++) {
    const states = (frostIds as readonly WeaponProcId[]).includes(weaponId) ? [false, true] : [undefined];
    for (const triggeringTargetCryoOrFrozen of states) {
      const document = createWeaponProcCalculatorDocument({...input, weaponId, refinement, triggeringTargetCryoOrFrozen});
      const coefficient = triggeringTargetCryoOrFrozen ? [2, 2.4, 2.8, 3.2, 3.6][refinement - 1]! : coefficients[weaponId]![refinement - 1]!;
      const result = calculateDocument(document), expectedBase = nonCritical(coefficient);
      expect(result.status).toBe("calculated"); expect(result.verification).toBe("provisional");
      expect(result.totals!.nonCritical).toBeCloseTo(expectedBase, 10);
      expect(result.totals!.critical).toBeCloseTo(expectedBase * 2.2, 10);
      expect(result.totals!.expected).toBeCloseTo(expectedBase * 1.3, 10);
      expect(document).not.toHaveProperty("gameContext"); expect(result).not.toHaveProperty("dps");
      const hit = document.hits[0]!; if (hit.kind !== "ordinary") throw new Error("Expected independent ordinary proc");
      expect(hit).toMatchObject({element: "physical", attackTag: "proc", critEligible: true, reaction: "none"});
      expect(hit.baseDamageFormula!.inputs[0]!.allowedValues).toEqual([hit.terms[0]!.coefficient]);
      const selection = result.hits[0]!.trace.find(row => row.id === "weaponProcCoefficient")!;
      expect(selection.result!.value).toBeCloseTo(coefficient, 14);
      expect(result.hits[0]!.trace.find(row => row.id === "customBaseDamage")!.childIds).toContain("weaponProcCoefficient");
      for (const node of result.trace) {
        if (!node.result) continue;
        const bindings = Object.fromEntries(node.inputs.map(value => [value.key, value.value]));
        expect(node.result.value).toBe(evaluateFormulaExpression(node.expression, bindings));
        expect(node.substitution).toBe(formatFormulaExpression(node.expression, bindings));
        expect(node.symbolicFormula && node.explanationKey).toBeTruthy();
        expect(node.inputs.every(value => value.meaningKey && value.unit && value.origin)).toBe(true);
      }
      expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(document))).totals).toEqual(result.totals);
    }
  }
});

it("keeps unknown original-target frost state blocked and rederives sealed coefficients after editable JSON/context changes", () => {
  for (const weaponId of frostIds) {
    const document = createWeaponProcCalculatorDocument({...input, weaponId, refinement: 1});
    expect(document.weaponProc!.triggeringTargetCryoOrFrozen).toBeUndefined();
    expect(calculateDocument(document).status).toBe("blocked");
    expect(calculateDocument(document).totals).toBeUndefined();
    const restored = parseCalculatorDocument(serializeCalculatorDocument(document));
    restored.weaponProc!.triggeringTargetCryoOrFrozen = false;
    const ready = prepareWeaponProcCalculatorDocument(restored);
    expect(calculateDocument(ready).totals!.nonCritical).toBeCloseTo(nonCritical(.8), 10);
    ready.weaponProc!.refinement = 5;
    ready.weaponProc!.triggeringTargetCryoOrFrozen = true;
    const hit = ready.hits[0]!; if (hit.kind !== "ordinary") throw new Error("Expected independent ordinary proc");
    // A self-consistent forged saved AST must still lose to the typed source context.
    hit.terms[0]!.coefficient = 999;
    hit.baseDamageFormula!.expression = expr.value(999);
    hit.baseDamageFormula!.inputs[0]!.value = 999;
    hit.baseDamageFormula!.inputs[0]!.allowedValues = [999];
    const reloaded = parseCalculatorDocument(serializeCalculatorDocument(ready));
    expect(getWeaponProcDocumentSelection(reloaded)).toEqual({weaponId, refinement: 5, triggeringTargetCryoOrFrozen: true});
    expect(calculateDocument(reloaded).totals!.nonCritical).toBeCloseTo(nonCritical(3.6), 10);
    const prepared = prepareWeaponProcCalculatorDocument(reloaded);
    const preparedHit = prepared.hits[0]!; if (preparedHit.kind !== "ordinary") throw new Error();
    expect(preparedHit.baseDamageFormula!.inputs[0]!.allowedValues).toEqual([3.6]);
    delete prepared.weaponProc!.triggeringTargetCryoOrFrozen;
    expect(calculateDocument(prepared).status).toBe("blocked");
  }
});
