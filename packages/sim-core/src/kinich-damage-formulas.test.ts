import { describe, expect, it } from "vitest";
import { getCharacterDocuments } from "../../../apps/web/src/character-calculations";
import { extendKinichDocuments, kinichCatalogVectorIssues } from "../../../apps/web/src/kinich-calculation-context";
import { renderKinichControls, kinichRequirementAdapter } from "../../../apps/web/src/calculator-kinich-controls";
import { releasedRuntimeWorkspace } from "@genshin-dps-lab/game-data";
import { calculateDocument, convertCalculatorToFinalPanel } from "./calculator";
import { calculatorFormulaSchema, type CalculatorDocument } from "./calculator-model";
import { evaluateFormulaExpression } from "./calculation-trace";
import { kinichDamageContextSchema } from "./kinich-damage-context";
import {
  createKinichA4BaseFormula, finalizeKinichPanelAccounting, isKinichDamageAction, kinichContext, kinichHitCoefficient,
  prepareKinichDamageDocument, resetKinichPanelAccounting, type KinichCalculatorDocument,
} from "./kinich-damage-formulas";

const baseDocuments = getCharacterDocuments("character:10000101", 10);
function fixture(constellation = 1, skill = "kinich-scalespiker-cannon"): KinichCalculatorDocument {
  const document = extendKinichDocuments(baseDocuments).find(row => row.gameContext?.skillId === skill) as KinichCalculatorDocument;
  if (!document) throw new Error("Missing source Kinich E entry " + skill);
  const doc = structuredClone(document);
  doc.gameContext.constellation = constellation;
  doc.build = { mode: "manual-final", ascension: 6, source: "Explicit independent numeric fixture; not a player build", stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 } };
  Object.assign(doc.gameContext.kinichDamage!, { nightsoulBlessingActive: true, cannonPointsBeforeUse: 20, a4Stacks: 0 });
  return doc;
}
/** Public schema wiring belongs to the parent. Only the extra context is
 * removed in this test adapter, after its real prepare step. Formulas and
 * missing dependencies are executed by the unchanged public calculator. */
function withoutExtension(document: CalculatorDocument): CalculatorDocument {
  const doc = structuredClone(document) as KinichCalculatorDocument;
  delete doc.gameContext.kinichDamage;
  return doc;
}
const result = (document: CalculatorDocument) => calculateDocument(withoutExtension(prepareKinichDamageDocument(document)));
const denominator = .5 * .9;

describe("Kinich fixed-source C0/C1 selected E hits (independent wiring)", () => {
  it("adds three E entries with separate E talent identity and exact full vectors", () => {
    expect(kinichCatalogVectorIssues(releasedRuntimeWorkspace)).toEqual([]);
    const documents = extendKinichDocuments(baseDocuments);
    expect(documents.filter(isKinichDamageAction).map(doc => doc.gameContext!.skillId)).toEqual(["kinich-loop-shot-single", "kinich-loop-shot-pair", "kinich-scalespiker-cannon"]);
    expect(documents.filter(isKinichDamageAction).every(doc => doc.gameContext!.abilityId === "talent:kinich:combat2")).toBe(true);
    expect(extendKinichDocuments(documents)).toHaveLength(documents.length);
    expect(kinichContext(documents.find(isKinichDamageAction)!)?.nightsoulBlessingActive).toBeUndefined();
  });
  it("blocks if another level of either full E vector changes", () => {
    const workspace = structuredClone(releasedRuntimeWorkspace);
    const ability = workspace.catalog.talentSets.find(set => set.id === "talent-set:kinich")!.abilities.find(row => row.key === "combat2")!;
    ability.parameters.param1![0] = 999;
    const doc = extendKinichDocuments(baseDocuments, workspace).find(isKinichDamageAction)!;
    expect(doc.dependencies.find(dep => dep.id === "kinich-source-vectors")?.status).toBe("missing");
    expect(kinichCatalogVectorIssues(workspace)).toHaveLength(1);
  });
  it.each([[0, 11136.528, 16704.792], [1, 11136.528, 22273.056]])("C%i cannon applies only its sourced cannon crit", (cons, nonCritical, expected) => {
    const output = result(fixture(cons));
    expect(output.status).toBe("calculated");
    expect(output.totals!.nonCritical).toBeCloseTo(nonCritical, 8);
    expect(output.totals!.expected).toBeCloseTo(expected, 8);
    expect(output.totals!.nonCritical).toBeCloseTo(2000 * 12.37392 * denominator, 9);
  });
  it("does not give loop shot C1 cannon crit or A4 cannon base damage", () => {
    const c0 = fixture(0, "kinich-loop-shot-single"), c1 = fixture(1, "kinich-loop-shot-single");
    Object.assign(c1.gameContext.kinichDamage!, { a4Stacks: 2, a4CreationAttack: 99999 });
    expect(result(c0).totals).toEqual(result(c1).totals);
    expect(result(c1).totals!.expected).toBeCloseTo(2000 * 1.03104 * denominator * 1.5, 9);
  });
  it.each([0, 19])("rejects an actual %i points before cannon", points => {
    const doc = fixture(); doc.gameContext.kinichDamage!.cannonPointsBeforeUse = points;
    expect(result(doc).status).toBe("blocked");
    expect(kinichRequirementAdapter.collect(doc).find(field => field.fieldPath.endsWith("cannonPointsBeforeUse"))?.status).toBe("condition-not-satisfied");
  });
  it("does not replace missing/false blessing or unknown points by full nightsoul", () => {
    const doc = fixture(); delete doc.gameContext.kinichDamage!.cannonPointsBeforeUse;
    expect(result(doc).status).toBe("blocked");
    doc.gameContext.kinichDamage!.cannonPointsBeforeUse = 20;
    doc.gameContext.kinichDamage!.nightsoulBlessingActive = false;
    expect(result(doc).status).toBe("blocked");
    delete doc.gameContext.kinichDamage!.nightsoulBlessingActive;
    expect(result(doc).status).toBe("blocked");
  });
  it.each([0, 1, 2])("uses actual %i A4 stacks and creation ATK, separate from later 2000 ATK", stacks => {
    const doc = fixture(); Object.assign(doc.gameContext.kinichDamage!, { a4Stacks: stacks, a4CreationAttack: 1800 });
    expect(result(doc).totals!.nonCritical).toBeCloseTo((2000 * 12.37392 + 3.2 * stacks * 1800) * denominator, 9);
  });
  it("requires A4 creation ATK only when stacks are nonzero, preserving genuine zero", () => {
    const doc = fixture(); expect(result(doc).status).toBe("calculated");
    doc.gameContext.kinichDamage!.a4Stacks = 1; expect(result(doc).status).toBe("blocked");
    doc.gameContext.kinichDamage!.a4CreationAttack = 0;
    expect(result(doc).totals).toEqual(result(fixture()).totals);
    expect(renderKinichControls(doc)).toContain('value="0"');
  });
  it("does not infer unknown A4 or ascension from level", () => {
    const doc = fixture(); delete doc.gameContext.kinichDamage!.a4Stacks;
    expect(result(doc).status).toBe("blocked");
    delete doc.gameContext.ascension;
    if (doc.build.mode !== "manual-final") throw new Error(); delete doc.build.ascension;
    expect(result(doc).status).toBe("blocked");
  });
  it("keeps locked A4 off before ascension4 and rejects locked stack claims", () => {
    const doc = fixture(); doc.gameContext.ascension = 3;
    if (doc.build.mode !== "manual-final") throw new Error(); doc.build.ascension = 3;
    delete doc.gameContext.kinichDamage!.a4Stacks;
    expect(result(doc).totals).toEqual(result(fixture()).totals);
    doc.gameContext.kinichDamage!.a4Stacks = 1;
    expect(result(doc).status).toBe("blocked");
  });
  it("never adds included C1 or A4 shares a second time", () => {
    const a = fixture(), b = fixture();
    Object.assign(a.gameContext.kinichDamage!, { a4Stacks: 2, a4CreationAttack: 1800 });
    Object.assign(b.gameContext.kinichDamage!, { a4Stacks: 2, a4CreationAttack: 1800, includedA4BaseDamage: 11520, c1CritDamageIncluded: true });
    if (b.build.mode !== "manual-final" || b.hits[0]!.kind !== "ordinary") throw new Error();
    b.build.stats.critDamage = 2; b.hits[0]!.additiveBaseDamage = 11520;
    expect(result(a).totals).toEqual(result(b).totals);
    const prepared = prepareKinichDamageDocument(a);
    expect(result(prepared).totals).toEqual(result(a).totals);
  });
  it("removes explicitly included stale cannon CD for C0 or loop without spillover", () => {
    for (const skill of ["kinich-scalespiker-cannon", "kinich-loop-shot-single"]) {
      const doc = fixture(0, skill); if (doc.build.mode !== "manual-final") throw new Error();
      doc.build.stats.critDamage = 2; doc.gameContext.kinichDamage!.c1CritDamageIncluded = true;
      expect(result(doc).totals).toEqual(result(fixture(0, skill)).totals);
    }
  });
  it("requires real two contacts and stable panel for the same-input loop pair", () => {
    const doc = fixture(1, "kinich-loop-shot-pair");
    expect(result(doc).status).toBe("blocked");
    Object.assign(doc.gameContext.kinichDamage!, { bothLoopHitsConnected: true, statsStableAcrossHits: true });
    const output = result(doc); expect(output.status).toBe("calculated");
    expect(output.totals!.expected).toBeCloseTo(2 * 2000 * 1.03104 * denominator * 1.5, 9);
    doc.gameContext.kinichDamage!.statsStableAcrossHits = false;
    expect(result(doc).status).toBe("blocked");
    doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[0]!.id];
    expect(result(doc).totals!.expected).toBeCloseTo(2000 * 1.03104 * denominator * 1.5, 9);
  });
  it.each([2, 3, 4, 5, 6])("explicitly blocks uncovered C%i mechanics", cons => expect(result(fixture(cons)).status).toBe("blocked"));
  it("uses effective E levels once and never borrows NA, foreign identity or extra hits", () => {
    const doc = fixture(); doc.gameContext.effectiveTalentLevel = 13;
    expect(result(doc).totals!.nonCritical).toBeCloseTo(2000 * 14.6081 * denominator, 9);
    doc.gameContext.abilityId = "talent:kinich:combat1";
    expect(result(doc).status).toBe("blocked");
    const extra = fixture(); extra.hits.push({ ...extra.hits[0]!, id: "invented-extra-cannon" }); extra.selectedHitIds.push("invented-extra-cannon"); extra.scope = "one-cast";
    expect(result(extra).status).toBe("blocked");
    expect(kinichHitCoefficient("kinich-scalespiker-cannon", 16)).toBeUndefined();
  });
  it("does not multiply or duplicate a real source contact through a group value", () => {
    const doc = fixture(); if (doc.hits[0]!.kind !== "ordinary") throw new Error(); doc.hits[0]!.groupMultiplier = 2;
    expect(result(doc).status).toBe("blocked");
  });
  it("rejects a foreign base formula that would replace the fixed E coefficient", () => {
    const doc = fixture(); if (doc.hits[0]!.kind !== "ordinary") throw new Error();
    doc.hits[0]!.baseDamageFormula = { ruleId: "foreign-base", label: "Foreign base formula", expression: { kind: "constant", value: 999999 }, inputs: [], sourceRefs: ["https://example.test/foreign-base"] };
    expect(result(doc).status).toBe("blocked");
  });
  it("clears unknown showcase combat state and accounting; fresh equipment resets shares only", () => {
    const doc = fixture(); resetKinichPanelAccounting(doc, "imported-final");
    expect(kinichContext(doc)).toEqual({ includedA4BaseDamage: 0 }); expect(result(doc).status).toBe("blocked");
    expect(kinichRequirementAdapter.collect(doc).map(field => field.fieldPath)).toEqual(expect.arrayContaining(["gameContext.kinichDamage.nightsoulBlessingActive", "gameContext.kinichDamage.cannonPointsBeforeUse", "gameContext.kinichDamage.a4Stacks", "gameContext.kinichDamage.c1CritDamageIncluded"]));
    expect(kinichRequirementAdapter.collect(doc).some(field => field.fieldPath.endsWith("includedA4BaseDamage"))).toBe(false);
    expect(renderKinichControls(doc)).toContain("<details><summary>面板已含增益");
    resetKinichPanelAccounting(doc, "fresh-equipment"); Object.assign(doc.gameContext.kinichDamage!, { nightsoulBlessingActive: true, cannonPointsBeforeUse: 20, a4Stacks: 0 });
    expect(result(doc).status).toBe("calculated");
  });
  it("preserves unknown A4 shares in custom nonzero or historical additive input", () => {
    const custom = fixture(); if (custom.hits[0]!.kind !== "ordinary") throw new Error(); custom.hits[0]!.additiveBaseDamage = 100;
    resetKinichPanelAccounting(custom, "imported-final");
    expect(kinichContext(custom)?.includedA4BaseDamage).toBeUndefined();
    expect(kinichRequirementAdapter.collect(custom).some(field => field.fieldPath.endsWith("includedA4BaseDamage"))).toBe(true);
    const historical = fixture(); if (historical.hits[0]!.kind !== "ordinary") throw new Error(); historical.hits[0]!.finalizedEquipmentBaseInput = 0;
    resetKinichPanelAccounting(historical, "imported-final");
    expect(kinichContext(historical)?.includedA4BaseDamage).toBeUndefined();
  });
  it("retains converted/reopened values and rejects changing any frozen source conditions", () => {
    const original = fixture(); original.build = { mode: "equipment-derived", characterBaseAtk: 600, weaponBaseAtk: 200, atkPercent: 1.5, flatAtk: 0, baseHp: 20000, hpPercent: 0, flatHp: 0, baseDef: 800, defPercent: 0, flatDef: 0, em: 0, critRate: .5, critDamage: 1 };
    Object.assign(original.gameContext.kinichDamage!, { a4Stacks: 1, a4CreationAttack: 1800 });
    const prepared = prepareKinichDamageDocument(original), before = result(original);
    const converted = convertCalculatorToFinalPanel(withoutExtension(prepared)) as KinichCalculatorDocument;
    converted.gameContext.kinichDamage = structuredClone(kinichContext(prepared)!); finalizeKinichPanelAccounting(converted);
    expect(result(converted).totals).toEqual(before.totals);
    const reopened = JSON.parse(JSON.stringify(converted)) as KinichCalculatorDocument;
    expect(result(reopened).totals).toEqual(before.totals);
    reopened.gameContext.kinichDamage!.a4Stacks = 2;
    expect(result(reopened).status).toBe("blocked");
    const changedLevel = structuredClone(converted); changedLevel.characterLevel = 100;
    expect(result(changedLevel).status).toBe("blocked");
    converted.gameContext.constellation = 0;
    expect(result(converted).status).toBe("blocked");
  });
  it("schema rejects invalid counts, nonfinite attack and accidental context keys", () => {
    for (const value of [{ cannonPointsBeforeUse: 20.1 }, { a4Stacks: 3 }, { a4CreationAttack: Infinity }, { includedA4BaseDamage: -1 }, { fullStacksByDefault: true }]) expect(kinichDamageContextSchema.safeParse(value).success).toBe(false);
    expect(calculatorFormulaSchema.safeParse(createKinichA4BaseFormula(3, 2000, 0)).success).toBe(false);
    const formula = createKinichA4BaseFormula(2, 1800, 11520);
    expect(evaluateFormulaExpression(formula.expression, Object.fromEntries(formula.inputs.map(row => [row.key, row.value])))).toBe(0);
  });
});
