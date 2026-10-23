import { describe, expect, it } from "vitest";
import { getCharacterDocuments } from "../../../apps/web/src/character-calculations";
import { extendAlhaithamDocuments, alhaithamCatalogVectorIssues } from "../../../apps/web/src/alhaitham-calculation-context";
import { renderAlhaithamControls, alhaithamRequirementAdapter } from "../../../apps/web/src/calculator-alhaitham-controls";
import { releasedRuntimeWorkspace } from "@genshin-dps-lab/game-data";
import { calculateDocument, convertCalculatorToFinalPanel } from "./calculator";
import { calculatorFormulaSchema, type CalculatorDocument } from "./calculator-model";
import { evaluateFormulaExpression } from "./calculation-trace";
import { alhaithamDamageContextSchema } from "./alhaitham-damage-context";
import { alhaithamProjectionHitIds, alhaithamProjectionSkillId } from "../../game-data/src/character-mappings/alhaitham-primary-mappings";
import {
  alhaithamContext, alhaithamProjectionCoefficients, alhaithamProjectionTiming, createAlhaithamA4Formula,
  finalizeAlhaithamPanelAccounting, isAlhaithamDamageAction, prepareAlhaithamDamageDocument,
  resetAlhaithamPanelAccounting, type AlhaithamCalculatorDocument,
} from "./alhaitham-damage-formulas";

const sourceDocuments = getCharacterDocuments("character:10000078", 10);
function fixture(mirrors = 1, stableMastery = true): AlhaithamCalculatorDocument {
  const source = extendAlhaithamDocuments(sourceDocuments).find(doc => doc.gameContext?.skillId === alhaithamProjectionSkillId(mirrors));
  if (!source) throw new Error("Missing projection fixture " + mirrors);
  const doc = structuredClone(source) as AlhaithamCalculatorDocument;
  doc.gameContext.constellation = 0;
  doc.build = { mode: "manual-final", ascension: 6, source: "Explicit independent numerical fixture, not a player build", stats: { atk: 2000, hp: 20000, def: 800, em: 300, critRate: .5, critDamage: 1 } };
  Object.assign(doc.gameContext.alhaithamDamage!, { projectionTriggerValid: true, masteryStableAcrossStages: stableMastery, statsAndTargetStableAcrossHits: true,
    ...(!stableMastery ? { triggerMastery: 300 } : {}) });
  for (const state of Object.values(doc.gameContext.alhaithamDamage!.hitStates!)) Object.assign(state, { connected: true, ...(!stableMastery ? { hitTimeMastery: 300 } : {}) });
  return doc;
}
/** Public schema and source-cast preparation are registered. */
const result = (document: CalculatorDocument) => calculateDocument(document);
const impactStates = (document: AlhaithamCalculatorDocument) => Object.values(document.gameContext.alhaithamDamage!.hitStates!);

describe("Alhaitham C0 one actual projection event", () => {
  it("adds 1/2/3 mirror E entries while leaving trigger eligibility and contacts unknown", () => {
    const documents = extendAlhaithamDocuments(sourceDocuments), projections = documents.filter(isAlhaithamDamageAction);
    expect(projections.map(doc => doc.gameContext!.skillId)).toEqual([1, 2, 3].map(alhaithamProjectionSkillId));
    for (const [index, doc] of projections.entries()) {
      expect(doc.gameContext!.abilityId).toBe("talent:alhaitham:combat2");
      expect(doc.hits.map(hit => hit.id)).toEqual(alhaithamProjectionHitIds(index + 1));
      expect(alhaithamContext(doc)?.mirrorCount).toBe(index + 1);
      expect(alhaithamContext(doc)?.projectionTriggerValid).toBeUndefined();
      expect(alhaithamContext(doc)?.masteryStableAcrossStages).toBeUndefined();
      expect(result(doc).status).toBe("blocked");
    }
    expect(extendAlhaithamDocuments(documents)).toHaveLength(documents.length);
  });
  it("checks every count-specific ATK/EM vector, including a nonselected talent position", () => {
    expect(alhaithamCatalogVectorIssues(releasedRuntimeWorkspace)).toEqual([]);
    const workspace = structuredClone(releasedRuntimeWorkspace);
    const ability = workspace.catalog.talentSets.find(set => set.id === "talent-set:alhaitham")!.abilities.find(row => row.key === "combat2")!;
    ability.parameters.param7![0] = 999;
    expect(alhaithamCatalogVectorIssues(workspace)).toHaveLength(1);
    expect(extendAlhaithamDocuments(sourceDocuments, workspace).find(isAlhaithamDamageAction)!.dependencies.find(dep => dep.id === "alhaitham-primary-vectors")?.status).toBe("missing");
  });
  it("retains source snapshot delays and both actual left/right hit schedules", () => {
    expect(alhaithamProjectionTiming(1)).toEqual({ mirrors: 1, snapshotDelay: 20, leftHitFrames: [39], rightHitFrames: [40] });
    expect(alhaithamProjectionTiming(2)).toEqual({ mirrors: 2, snapshotDelay: 22, leftHitFrames: [28, 37], rightHitFrames: [26, 35] });
    expect(alhaithamProjectionTiming(3)).toEqual({ mirrors: 3, snapshotDelay: 26, leftHitFrames: [32, 41, 51], rightHitFrames: [32, 41, 51] });
    expect(alhaithamProjectionTiming(0)).toBeUndefined();
  });
  it.each([1, 2, 3])("%i mirrors queue that many identical E mixed-scaling contacts, not one inflated coefficient", mirrors => {
    const doc = fixture(mirrors), output = result(doc), prepared = prepareAlhaithamDamageDocument(doc);
    // Hand calculation: 1.2096*2000=2419.2; 2.4192*300=725.76.
    // (2419.2+725.76)*(1+.300)*.5*.9=1839.8016 per contact.
    expect(output.status).toBe("calculated");
    expect(output.totals!.nonCritical).toBeCloseTo(1839.8016 * mirrors, 9);
    expect(output.totals!.expected).toBeCloseTo(2759.7024 * mirrors, 9);
    expect(prepared.hits).toHaveLength(mirrors);
    for (const hit of prepared.hits) {
      expect(hit).toMatchObject({ kind: "ordinary", element: "dendro", attackTag: "skill", terms: [{ stat: "atk", coefficient: 1.2096 }], groupMultiplier: 1 });
      if (hit.kind !== "ordinary") throw new Error();
      const native = hit.additiveBaseFormula!;
      expect(evaluateFormulaExpression(native.expression, { em: 300, ...Object.fromEntries(native.inputs.map(input => [input.key, input.value])) })).toBeCloseTo(725.76, 9);
    }
  });
  it("keeps trigger FlatDmg at EM300 when only impact A4 sees EM1000", () => {
    const doc = fixture(1, false); impactStates(doc)[0]!.hitTimeMastery = 1000;
    const output = result(doc);
    // EM base remains 725.76: (2419.2+725.76)*2*.5*.9.
    expect(output.totals!.nonCritical).toBeCloseTo(2830.464, 9);
    expect(output.totals!.nonCritical).not.toBeCloseTo((2419.2 + 2.4192 * 1000) * 2 * .5 * .9, 5);
    if (doc.build.mode !== "manual-final") throw new Error(); doc.build.stats.em = 1;
    expect(result(doc).totals).toEqual(output.totals);
  });
  it("allows distinct impact EM for each real hit while keeping one trigger FlatDmg", () => {
    const doc = fixture(3, false);
    impactStates(doc).forEach((state, index) => { state.hitTimeMastery = [0, 300, 1000][index]!; });
    expect(result(doc).totals!.nonCritical).toBeCloseTo((2419.2 + 725.76) * (1 + 1.3 + 2) * .5 * .9, 9);
  });
  it.each([0, 999.999, 1000, 1001])("A4 uses actual impact EM %s and caps at exactly1000", mastery => {
    const doc = fixture(1, false); impactStates(doc)[0]!.hitTimeMastery = mastery;
    expect(result(doc).totals!.nonCritical).toBeCloseTo(3144.96 * (1 + Math.min(.001 * mastery, 1)) * .5 * .9, 9);
  });
  it("shared explicit stable mastery follows actual equipment EM without adding any extra EM", () => {
    const doc = fixture(); doc.build = { mode: "equipment-derived", characterBaseAtk: 600, weaponBaseAtk: 200, atkPercent: 1.5, flatAtk: 0, baseHp: 20000, hpPercent: 0, flatHp: 0, baseDef: 800, defPercent: 0, flatDef: 0, em: 300, critRate: .5, critDamage: 1 };
    expect(result(doc).totals!.nonCritical).toBeCloseTo(1839.8016, 9);
    doc.build.em = 600;
    expect(result(doc).totals!.nonCritical).toBeCloseTo((2419.2 + 2.4192 * 600) * 1.6 * .5 * .9, 9);
    expect(prepareAlhaithamDamageDocument(doc).hits[0]).not.toHaveProperty("elementalMasteryAdjustment");
  });
  it("never guesses stable mastery or replaces missing samples with the current panel", () => {
    const doc = fixture(); delete doc.gameContext.alhaithamDamage!.masteryStableAcrossStages;
    expect(result(doc).status).toBe("blocked");
    doc.gameContext.alhaithamDamage!.masteryStableAcrossStages = false;
    expect(result(doc).status).toBe("blocked");
    doc.gameContext.alhaithamDamage!.triggerMastery = 0;
    expect(result(doc).status).toBe("blocked");
    impactStates(doc)[0]!.hitTimeMastery = 0;
    expect(result(doc).status).toBe("calculated");
    expect(result(doc).totals!.nonCritical).toBeCloseTo(2419.2 * .5 * .9, 9);
  });
  it("before ascension4 requires trigger EM but no unnecessary impact A4 sample", () => {
    const doc = fixture(1, false); doc.gameContext.ascension = 3;
    if (doc.build.mode !== "manual-final") throw new Error(); doc.build.ascension = 3;
    delete impactStates(doc)[0]!.hitTimeMastery; delete impactStates(doc)[0]!.includedA4Bonus;
    expect(result(doc).totals!.nonCritical).toBeCloseTo(3144.96 * .5 * .9, 9);
    delete doc.gameContext.alhaithamDamage!.triggerMastery;
    expect(result(doc).status).toBe("blocked");
  });
  it("links unknown ascension to an actual inline field rather than guessing from level90", () => {
    const doc = fixture(); delete doc.gameContext.ascension;
    if (doc.build.mode !== "manual-final") throw new Error(); delete doc.build.ascension;
    expect(result(doc).status).toBe("blocked");
    expect(alhaithamRequirementAdapter.collect(doc).some(field => field.fieldPath === "gameContext.ascension")).toBe(true);
    expect(renderAlhaithamControls(doc)).toContain('data-field="gameContext.ascension"');
  });
  it("adds neither native EM base nor A4 a second time when input already includes them", () => {
    const clean = fixture(), included = fixture();
    if (included.hits[0]!.kind !== "ordinary") throw new Error(); included.hits[0]!.additiveBaseDamage = 725.76; included.hits[0]!.damageBonus = .3;
    Object.assign(impactStates(included)[0]!, { includedProjectionBase: 725.76, includedA4Bonus: .3 });
    expect(result(included).totals).toEqual(result(clean).totals);
    expect(result(prepareAlhaithamDamageDocument(clean)).totals).toEqual(result(clean).totals);
  });
  it("requires trigger qualification and actual contact, even with three selected mirrors", () => {
    const doc = fixture(3); doc.gameContext.alhaithamDamage!.projectionTriggerValid = false;
    expect(result(doc).status).toBe("blocked");
    expect(alhaithamRequirementAdapter.collect(doc).find(field => field.fieldPath.endsWith("projectionTriggerValid"))?.status).toBe("condition-not-satisfied");
    doc.gameContext.alhaithamDamage!.projectionTriggerValid = true;
    impactStates(doc)[1]!.connected = false;
    expect(result(doc).status).toBe("blocked");
    doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[0]!.id];
    expect(result(doc).totals!.nonCritical).toBeCloseTo(1839.8016, 9);
  });
  it("requires common target/remaining state for a multihit sum, while a selected hit stays available", () => {
    const doc = fixture(2); delete doc.gameContext.alhaithamDamage!.statsAndTargetStableAcrossHits;
    expect(result(doc).status).toBe("blocked");
    doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[1]!.id];
    expect(result(doc).totals!.nonCritical).toBeCloseTo(1839.8016, 9);
  });
  it.each([undefined, 0, 1, 2])("rejects unknown/zero/inconsistent count %s for the3-mirror entry", mirrorCount => {
    const doc = fixture(3);
    if (mirrorCount === undefined) delete doc.gameContext.alhaithamDamage!.mirrorCount;
    else doc.gameContext.alhaithamDamage!.mirrorCount = mirrorCount;
    expect(result(doc).status).toBe("blocked");
    expect(renderAlhaithamControls(doc)).toContain('data-field="gameContext.alhaithamDamage.mirrorCount"');
  });
  it.each([1, 2, 3, 4, 5, 6])("C%i does not silently reuse the C0 projection implementation", cons => {
    const doc = fixture(); doc.gameContext.constellation = cons;
    expect(result(doc).status).toBe("blocked");
  });
  it("uses supplied effective E13 once and refuses an NA identity or E16", () => {
    const doc = fixture(); doc.gameContext.effectiveTalentLevel = 13;
    expect(result(doc).totals!.nonCritical).toBeCloseTo((1.428 * 2000 + 2.856 * 300) * 1.3 * .5 * .9, 9);
    doc.gameContext.abilityId = "talent:alhaitham:combat1"; expect(result(doc).status).toBe("blocked");
    doc.gameContext.abilityId = "talent:alhaitham:combat2"; doc.gameContext.effectiveTalentLevel = 16; expect(result(doc).status).toBe("blocked");
    expect(alhaithamProjectionCoefficients(0)).toBeUndefined();
  });
  it.each(["baseDamageFormula", "additiveBaseFormula", "damageBonusFormula"] as const)("preserves and rejects a foreign %s instead of overwriting it", key => {
    const doc = fixture(); if (doc.hits[0]!.kind !== "ordinary") throw new Error();
    const foreign = { ruleId: "foreign-source-contribution", label: "Foreign contribution", expression: { kind: "constant" as const, value: 42 }, inputs: [], sourceRefs: ["https://example.test/foreign-formula"] };
    doc.hits[0]![key] = foreign;
    const prepared = prepareAlhaithamDamageDocument(doc);
    expect(prepared.hits[0]).toHaveProperty(key, foreign); expect(result(doc).status).toBe("blocked");
  });
  it("refuses extra trigger attacks and group multiplication of already enumerated contacts", () => {
    const extra = fixture(); extra.hits.push({ ...extra.hits[0]!, id: "foreign-trigger-normal" }); extra.selectedHitIds.push("foreign-trigger-normal"); extra.scope = "one-cast";
    expect(result(extra).status).toBe("blocked");
    const repeated = fixture(); if (repeated.hits[0]!.kind !== "ordinary") throw new Error(); repeated.hits[0]!.groupMultiplier = 3;
    expect(result(repeated).status).toBe("blocked");
  });
  it("import preserves the chosen mirror scenario but clears unproved combat and A4 shares", () => {
    const doc = fixture(3, false); resetAlhaithamPanelAccounting(doc, "imported-final");
    expect(alhaithamContext(doc)?.mirrorCount).toBe(3);
    expect(alhaithamContext(doc)?.masteryStableAcrossStages).toBeUndefined();
    expect(impactStates(doc).every(state => state.includedProjectionBase === 0 && state.includedA4Bonus === undefined && state.connected === undefined)).toBe(true);
    expect(result(doc).status).toBe("blocked");
    const fields = alhaithamRequirementAdapter.collect(doc).map(field => field.fieldPath);
    expect(fields.some(field => field.endsWith("includedA4Bonus"))).toBe(true);
    expect(fields).not.toContain("gameContext.alhaithamDamage.mirrorCount");
    expect(renderAlhaithamControls(doc)).toContain("触发到命中期间精通不变");
    expect(renderAlhaithamControls(doc)).toContain("<details><summary>本段面板已含份额");
  });
  it("nonzero or historical native-base input keeps an unknown imported share", () => {
    const custom = fixture(); if (custom.hits[0]!.kind !== "ordinary") throw new Error(); custom.hits[0]!.additiveBaseDamage = 50;
    resetAlhaithamPanelAccounting(custom, "imported-final"); expect(impactStates(custom)[0]!.includedProjectionBase).toBeUndefined();
    const historical = fixture(); if (historical.hits[0]!.kind !== "ordinary") throw new Error(); historical.hits[0]!.finalizedEquipmentBaseInput = 0;
    resetAlhaithamPanelAccounting(historical, "imported-final"); expect(impactStates(historical)[0]!.includedProjectionBase).toBeUndefined();
  });
  it("fresh equipment resets owned shares and retains explicitly supplied actual conditions", () => {
    const doc = fixture(); Object.assign(impactStates(doc)[0]!, { includedProjectionBase: 100, includedA4Bonus: 1 });
    resetAlhaithamPanelAccounting(doc, "fresh-equipment");
    expect(result(doc).totals!.nonCritical).toBeCloseTo(1839.8016, 9);
    expect(alhaithamContext(doc)?.masteryStableAcrossStages).toBe(true);
  });
  it("keeps equipment conversion and JSON reopening exact, then rejects changed frozen identity/state", () => {
    const original = fixture(3, false); original.build = { mode: "equipment-derived", characterBaseAtk: 600, weaponBaseAtk: 200, atkPercent: 1.5, flatAtk: 0, baseHp: 20000, hpPercent: 0, flatHp: 0, baseDef: 800, defPercent: 0, flatDef: 0, em: 900, critRate: .5, critDamage: 1 };
    impactStates(original).forEach(state => { state.hitTimeMastery = 1000; });
    const prepared = prepareAlhaithamDamageDocument(original), before = result(original);
    const converted = convertCalculatorToFinalPanel(prepared) as AlhaithamCalculatorDocument;
    expect(result(converted).totals).toEqual(before.totals);
    const reopened = JSON.parse(JSON.stringify(converted)) as AlhaithamCalculatorDocument;
    expect(alhaithamDamageContextSchema.safeParse(reopened.gameContext.alhaithamDamage).success).toBe(true);
    expect(result(reopened).totals).toEqual(before.totals);
    for (const mutate of [
      (doc: AlhaithamCalculatorDocument) => { doc.characterLevel = 100; },
      (doc: AlhaithamCalculatorDocument) => { doc.gameContext.effectiveTalentLevel = 13; },
      (doc: AlhaithamCalculatorDocument) => { doc.gameContext.alhaithamDamage!.mirrorCount = 2; },
      (doc: AlhaithamCalculatorDocument) => { doc.gameContext.alhaithamDamage!.triggerMastery = 400; },
      (doc: AlhaithamCalculatorDocument) => { impactStates(doc)[1]!.hitTimeMastery = 300; },
    ]) { const changed = structuredClone(converted); mutate(changed); expect(result(changed).status).toBe("blocked"); }
  });
  it("strict schema preserves genuine zeros and rejects invalid mirror/EM/accounting values", () => {
    expect(alhaithamDamageContextSchema.safeParse({ mirrorCount: 0, triggerMastery: 0, hitStates: { hit: { hitTimeMastery: 0, includedA4Bonus: 0, includedProjectionBase: 0 } } }).success).toBe(true);
    for (const value of [{ mirrorCount: 4 }, { mirrorCount: 1.5 }, { triggerMastery: Infinity }, { hitStates: { h: { hitTimeMastery: -1 } } }, { hitStates: { h: { includedA4Bonus: 1.01 } } }, { autoMirrors: true }]) expect(alhaithamDamageContextSchema.safeParse(value).success).toBe(false);
    expect(calculatorFormulaSchema.safeParse(createAlhaithamA4Formula(6, false, 1000, 1.01)).success).toBe(false);
  });
});
