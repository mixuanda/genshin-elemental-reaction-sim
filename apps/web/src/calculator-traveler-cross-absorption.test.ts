import { describe, expect, it } from "vitest";
import { getCharacterDocuments } from "./character-calculations";
import { applySourceCastControl } from "./calculator-source-cast-controls";
import { renderTravelerCrossEntityControls } from "./calculator-traveler-cross-entity-controls";
import { collectCalculatorRequirements } from "./calculator-requirements";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { prepareTravelerCrossEntityCastDocument } from "../../../packages/sim-core/src/traveler-cross-entity-formulas";

const root = "gameContext.travelerCrossEntityCast.";
function fixture(gender = "aether"): CalculatorDocument {
  const document = getCharacterDocuments(gender === "aether" ? "character:10000005" : "character:10000007", 10)
    .find(row => row.gameContext?.skillId === `traveler-cross-${gender}-anemo-burst-c0`)!;
  document.scope = "single-hit";
  document.build = {mode: "manual-final", ascension: 6, source: "Explicit Q-start input", stats: {atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1}};
  document.gameContext!.travelerCrossEntityCast = {trueMoonStoryBuffInactive: true};
  return prepareTravelerCrossEntityCastDocument(document);
}
function answer(document: CalculatorDocument, key: string, value: string, type: "state" | "enum" | "number" = "state") {
  const dataset = type === "number" ? {field: `${root}${key}`} : type === "enum" ? {sourceCastEnumField: `${root}${key}`} : {sourceCastStateField: `${root}${key}`};
  applySourceCastControl(document, {dataset, value} as unknown as HTMLInputElement);
  return prepareTravelerCrossEntityCastDocument(document);
}

describe("actual Anemo absorption controls through the existing source-cast handler", () => {
  it.each(["aether", "lumine"])("chooses a real %s absorbed single without a full future schedule", gender => {
    let document = fixture(gender);
    document = answer(document, "anemo.singleHitRole", "absorbed-tick", "enum");
    expect(calculateDocument(document).status).toBe("blocked");
    document = answer(document, "anemo.noAbsorption", "0");
    expect(collectCalculatorRequirements(document).fields.some(row => row.fieldPath === `${root}anemo.absorptionElement`)).toBe(true);
    document = answer(document, "anemo.absorptionElement", "pyro", "enum");
    const bonus = collectCalculatorRequirements(document).fields.find(row => row.fieldPath === `${root}anemo.elementDamageBonuses.pyro`)!;
    expect(bonus.status).toBe("input-required");
    expect(renderTravelerCrossEntityControls(document)).toContain(`data-field="${root}anemo.elementDamageBonuses.pyro"`);
    document = answer(document, "anemo.elementDamageBonuses.pyro", "0.5", "number");
    expect(calculateDocument(document).status).toBe("calculated");
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(602.64, 8);
    expect(collectCalculatorRequirements(document).fields).toEqual([]);
    expect(document.gameContext!.travelerCrossEntityCast!.targetContacts).toBeUndefined();
    expect(document.gameContext!.travelerCrossEntityCast!.observedThroughFrame).toBeUndefined();
    const restored = parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(document)));
    expect(calculateDocument(restored).totals).toEqual(calculateDocument(document).totals);
  });
  it("links C6 unknown state to real controls, allowing explicit inactive and active cases", () => {
    let document = fixture(); document.gameContext!.constellation = 6;
    document = prepareTravelerCrossEntityCastDocument(document);
    const fields = collectCalculatorRequirements(document).fields;
    expect(fields.map(row => row.fieldPath)).toEqual([`${root}sharedState.c6ActiveBeforeHit`, `${root}sharedState.includedC6ResistanceReduction`]);
    expect(renderTravelerCrossEntityControls(document)).toContain(`data-source-cast-state-field="${root}sharedState.c6ActiveBeforeHit"`);
    document = answer(document, "sharedState.c6ActiveBeforeHit", "0");
    document = answer(document, "sharedState.includedC6ResistanceReduction", "0", "number");
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(1308.96, 8);
    document = answer(document, "sharedState.c6ActiveBeforeHit", "1");
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(1527.12, 8);
    expect(collectCalculatorRequirements(document).fields).toEqual([]);
  });
  it("exposes real contact inputs for absorbed candidates and removes them after a too-late absorption", () => {
    let document = fixture(); document.scope = "one-cast";
    document = answer(document, "anemo.noAbsorption", "0");
    document = answer(document, "anemo.absorptionElement", "pyro", "enum");
    document = answer(document, "anemo.absorptionStartFrame", "93", "number");
    const html = renderTravelerCrossEntityControls(document), report = collectCalculatorRequirements(document);
    expect(html).toContain(`data-source-cast-state-field="${root}targetContacts.absorb-1"`);
    expect(report.fields.some(row => row.fieldPath === `${root}targetContacts.absorb-1`)).toBe(true);
    expect(new Set(report.fields.map(row => row.fieldPath)).size).toBe(report.fields.length);
    document = answer(document, "anemo.absorptionStartFrame", "345", "number");
    expect(renderTravelerCrossEntityControls(document)).not.toContain(`data-source-cast-state-field="${root}targetContacts.absorb-1"`);
    expect(collectCalculatorRequirements(document).fields.some(row => row.fieldPath.includes("targetContacts.absorb"))).toBe(false);
    expect(collectCalculatorRequirements(document).fields.some(row => row.fieldPath.includes("elementDamageBonuses"))).toBe(false);
  });
  it("replaces only known old Anemo range text without changing saved names or unrelated warnings", () => {
    const document = fixture(), name = document.gameContext!.skillName, label = document.label;
    document.assumptions.push("自定义未知条件仍未核实。", "风Q仅全程无元素吸收；草Q仅全程无元素转化。其他分支与历史冲突保持独立证据，不据此宣称所有旅行者动作均已解除限制。");
    const prepared = prepareTravelerCrossEntityCastDocument(document);
    expect(prepared.assumptions).toContain("自定义未知条件仍未核实。");
    expect(prepared.assumptions.some(row => row.startsWith("风Q仅全程无元素吸收"))).toBe(false);
    expect(prepared.assumptions.some(row => row.startsWith("C0；显式新鲜施放"))).toBe(false);
    expect(prepared.gameContext!.skillName).toBe(name); expect(prepared.label).toBe(label);
    expect(renderTravelerCrossEntityControls(prepared)).toContain("风旅行者 Q · C0 · 已发生单击");
    expect(renderTravelerCrossEntityControls(prepared)).toContain("按对应元素单击分别填写");
  });
});
