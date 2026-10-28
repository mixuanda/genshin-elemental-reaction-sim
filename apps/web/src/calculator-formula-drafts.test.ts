import { describe, expect, it } from "vitest";
import { gameDataCatalog } from "../../../packages/game-data/src/catalog";
import { calculateDocument } from "../../../packages/sim-core/src/calculator";
import type { CalculatorDocument, CalculatorFormula } from "../../../packages/sim-core/src/calculator-model";
import { applyCharacterConstellationScope, getCharacterDocuments } from "./character-calculations";
import { isSourceOwnedFormulaInput, isReadonlySourceFormulaInput, restoreCalculatorFormulaAnswers } from "./calculator-formula-drafts";

function nefer(level: number): CalculatorDocument {
  const id = gameDataCatalog.characters.find(character => character.slug === "nefer")!.id;
  const doc = getCharacterDocuments(id, level).find(document => document.gameContext?.skillId === "nefer-burst")!;
  if (doc.build.mode !== "manual-final") throw new Error("Expected manual source example");
  doc.build.stats.em = 100;
  doc.gameContext!.constellation = 2;
  return applyCharacterConstellationScope(doc);
}
function restore(next: CalculatorDocument, previous: CalculatorDocument, legacy = false): void {
  for (const hit of next.hits) {
    const old = previous.hits.find(candidate => candidate.id === hit.id);
    if (hit.kind !== "ordinary" || old?.kind !== "ordinary") throw new Error("Expected exact ordinary pair");
    for (const key of ["damageBonusFormula", "resistanceReductionFormula"] as const) {
      if (!hit[key] || !old[key]) continue;
      if (legacy) {
        for (const input of hit[key]!.inputs) {
          const answer = old[key]!.inputs.find(candidate => candidate.key === input.key && candidate.ownerId === input.ownerId);
          if (answer && input.origin !== "source-table") input.value = answer.value;
        }
      } else restoreCalculatorFormulaAnswers(hit[key]!, old[key]!);
    }
    hit.elementalMasteryAdjustment!.accounting = old.elementalMasteryAdjustment!.accounting;
    restoreCalculatorFormulaAnswers(hit.elementalMasteryAdjustment!.formula, old.elementalMasteryAdjustment!.formula);
  }
}
function setAnswers(doc: CalculatorDocument): void {
  for (const hit of doc.hits) {
    if (hit.kind !== "ordinary") throw new Error("Expected ordinary source action");
    hit.elementalMasteryAdjustment!.accounting = "add-to-panel";
    for (const formula of [hit.damageBonusFormula!, hit.elementalMasteryAdjustment!.formula]) {
      for (const input of formula.inputs) {
        if (input.key === "moonsignCount") input.value = 2;
        if (input.key === "neferVeilStacks") input.value = 5;
        if (input.key === "neferFullVeilEmBuffActive") input.value = 1;
      }
    }
  }
}

describe("source-owned formula coefficients versus restored battle answers", () => {
  it("reproduces the old 9→10 stale coefficient error without blessing it", () => {
    const previous = nefer(9); setAnswers(previous);
    const next = nefer(10); restore(next, previous, true);
    expect(next.gameContext!.effectiveTalentLevel).toBe(10);
    expect(calculateDocument(next).totals!.nonCritical).toBeCloseTo(33707.7936, 7);
    // T10 ATK/EM terms, but stale T9 per-veil .37 yields 2.85 instead of3.
    expect((4.04352 * 2000 + 8.08704 * 300 + 6.06528 * 2000 + 12.13056 * 300) * (1 + 5 * .37) * .5 * .9).toBeCloseTo(33707.7936, 7);
  });
  it.each([[9, 10, .4, 35481.888], [10, 9, .37, 31835.1384]])("keeps fresh level %i→%i source fields while preserving answers", (from, to, coefficient, total) => {
    const previous = nefer(from); setAnswers(previous);
    const before = structuredClone(previous);
    const next = nefer(to); restore(next, previous);
    expect(previous).toStrictEqual(before);
    for (const hit of next.hits) {
      if (hit.kind !== "ordinary") throw new Error("Expected ordinary hit");
      expect(hit.damageBonusFormula!.inputs.find(input => input.key === "neferBurstBonusPerVeil")).toMatchObject({ value: coefficient, origin: "source-talent-field" });
      expect(hit.damageBonusFormula!.inputs.find(input => input.key === "neferVeilStacks")!.value).toBe(5);
      expect(hit.elementalMasteryAdjustment!.accounting).toBe("add-to-panel");
    }
    const result = calculateDocument(next);
    expect(result.status).toBe("calculated");
    expect(result.totals!.nonCritical).toBeCloseTo(total, 7);
    expect(result.hits.map(hit => hit.trace.find(node => node.id === "hitElementalMastery")!.result!.value)).toEqual([300, 300]);
  });
  it("roundtrips 9→10→9 without carrying either level's source coefficient", () => {
    const first = nefer(9); setAnswers(first);
    const ten = nefer(10); restore(ten, first);
    const nine = nefer(9); restore(nine, ten);
    expect(calculateDocument(ten).totals!.nonCritical).toBeCloseTo(35481.888, 7);
    expect(calculateDocument(nine)).toStrictEqual(calculateDocument(first));
  });
  it("also refreshes Lohen's talent base without erasing actual Will", () => {
    const id = gameDataCatalog.characters.find(character => character.slug === "lohen")!.id;
    const action = (level: number) => getCharacterDocuments(id, level).find(document => document.gameContext?.skillId === "lohen-skill-etch-resource")!;
    const old = action(9), next = action(10);
    const beforeHit = old.hits[0], hit = next.hits[0];
    if (beforeHit?.kind !== "ordinary" || hit?.kind !== "ordinary") throw new Error("Expected Lohen ordinary skill");
    beforeHit.additiveBaseFormula!.inputs.find(input => input.key === "lohenWillConsumed")!.value = 100;
    restoreCalculatorFormulaAnswers(hit.additiveBaseFormula!, beforeHit.additiveBaseFormula!);
    hit.additiveBaseDamage = 500;
    expect(hit.additiveBaseFormula!.inputs.find(input => input.key === "lohenTalent_atk")!.value).toBe(1.08);
    expect(hit.additiveBaseFormula!.inputs.find(input => input.key === "lohenWillConsumed")!.value).toBe(100);
    expect(calculateDocument(next).totals!.nonCritical).toBeCloseTo((2000 * 1.08 * (1 + .004 * 100) + 500) * .5 * .9, 8);
  });
  it.each(["source-table", "source-talent-field"])("does not relabel a previous %s coefficient as an authored answer", origin => {
    const hit = nefer(10).hits[0];
    if (hit?.kind !== "ordinary") throw new Error("Expected ordinary hit");
    const next = structuredClone(hit.damageBonusFormula!);
    next.inputs = [{ ...next.inputs[1]!, key: "same-key", ownerId: "same-owner", value: 0 }];
    const previous = structuredClone(next);
    previous.inputs[0]!.origin = origin;
    previous.inputs[0]!.value = 2;
    restoreCalculatorFormulaAnswers(next, previous);
    expect(next.inputs[0]).toMatchObject({ origin: "conditioned-user-input", value: 0 });
  });
  it("retains explicit answers by owner while source fields stay fresh", () => {
    const formula = nefer(10).hits[0];
    if (formula.kind !== "ordinary") throw new Error("Expected ordinary hit");
    const next: CalculatorFormula = structuredClone(formula.damageBonusFormula!);
    const old = structuredClone(next);
    next.inputs = [
      { ...next.inputs[0]!, key: "table", origin: "source-table", value: 10 },
      { ...next.inputs[0]!, key: "talent", origin: "source-talent-field", value: 10 },
      { ...next.inputs[1]!, key: "answer", ownerId: "a", value: 0 },
      { ...next.inputs[1]!, key: "other-answer", ownerId: "b", value: 0 },
    ];
    old.inputs = next.inputs.map(input => ({ ...input, value: 2 }));
    old.inputs[3]!.ownerId = "other";
    restoreCalculatorFormulaAnswers(next, old);
    expect(next.inputs.map(input => input.value)).toEqual([10, 10, 2, 0]);
    expect(next.inputs.map(isSourceOwnedFormulaInput)).toEqual([true, true, false, false]);
    expect(next.inputs.map(input => isReadonlySourceFormulaInput(input, false))).toEqual([true, true, false, false]);
    expect(next.inputs.map(input => isReadonlySourceFormulaInput(input, true))).toEqual([false, false, false, false]);
  });
});
