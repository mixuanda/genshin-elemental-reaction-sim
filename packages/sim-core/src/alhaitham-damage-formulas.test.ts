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
  ALHAITHAM_MAX_IMPLEMENTED_CONSTELLATION, alhaithamUnstableC2EquipmentRules, alhaithamRequiresC2SnapshotStatsConfirmation,
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
  it.each([1, 2, 3, 4, 5, 6])("C%i respects the implemented scope and missing C2 conditions", cons => {
    const doc = fixture(); doc.gameContext.constellation = cons;
    if (cons === 1) expect(result(doc).totals).toEqual(result(fixture()).totals);
    else {
      expect(result(doc).status).toBe("blocked");
      if (cons <= 3) expect(alhaithamRequirementAdapter.collect(doc).some(field => field.fieldPath.endsWith("c2SnapshotStacks"))).toBe(true);
    }
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

function c2Fixture(mirrors = 1, stable = true, constellation = 2): AlhaithamCalculatorDocument {
  const doc = fixture(mirrors, stable); doc.gameContext.constellation = constellation;
  Object.assign(doc.gameContext.alhaithamDamage!, { c2SnapshotStacks: 2, c2SnapshotIncludedStacks: 0,
    ...(!stable ? { c2TriggerMasteryFinal: true } : {}) });
  if (!stable) impactStates(doc).forEach(state => { state.c2HitMasteryFinal = true; });
  return doc;
}
function withMasteryConversion(doc: AlhaithamCalculatorDocument): void {
  doc.build = { mode: "equipment-derived", characterBaseAtk: 600, weaponBaseAtk: 200, atkPercent: 1.5, flatAtk: 0,
    baseHp: 20000, hpPercent: 0, flatHp: 0, baseDef: 800, defPercent: 0, flatDef: 0, em: 300, critRate: .5, critDamage: 1,
    equipment: { characterId: "character:10000078", weaponId: "weapon:explicit-test-only", level: 90, ascension: 6,
      weaponLevel: 90, weaponAscension: 6, refinement: 1, sourceVersion: "explicit-synthetic-phase-fixture",
      sourceRefs: ["https://example.test/equipment-phase-fixture"], derivedStats: [], secondaryContributions: [], assumptions: [], effectBlockers: [],
      statModifiers: [{ id: "test-em-to-attack", label: "独立相位测试：20%精通转攻击", target: "flatAtk", phase: "conversion",
        expression: { kind: "multiply", terms: [{ kind: "variable", key: "em" }, { kind: "constant", value: .2 }] }, inputs: [], sourceRefs: ["https://example.test/equipment-phase-fixture"] }] } };
}

describe("Alhaitham C1–C3 stage-specific C2 mastery", () => {
  it("exports maximum C6 and leaves C1's after-hit cooldown out of this damage", () => {
    expect(ALHAITHAM_MAX_IMPLEMENTED_CONSTELLATION).toBe(6);
    const doc = fixture(3); doc.gameContext.constellation = 1;
    expect(result(doc).status).toBe("calculated"); expect(result(doc).totals).toEqual(result(fixture(3)).totals);
  });
  it.each([0, 1, 2, 3, 4])("uses actual C2 %i stacks rather than mirror count", stacks => {
    const doc = c2Fixture(3); doc.gameContext.alhaithamDamage!.c2SnapshotStacks = stacks;
    const mastery = 300 + 50 * stacks;
    expect(result(doc).status).toBe("calculated");
    expect(result(doc).totals!.nonCritical).toBeCloseTo(3 * (2000 * 1.2096 + mastery * 2.4192) * (1 + mastery * .001) * .5 * .9, 9);
  });
  it("C2 stable two uncounted stacks yield EM400 and 2133.7344 per contact", () => {
    const doc = c2Fixture();
    expect(result(doc).totals!.nonCritical).toBeCloseTo(2133.7344, 9);
    expect(result(prepareAlhaithamDamageDocument(doc)).totals).toEqual(result(doc).totals);
    const prepared = prepareAlhaithamDamageDocument(doc);
    if (prepared.hits[0]!.kind !== "ordinary") throw new Error();
    const formula = prepared.hits[0]!.elementalMasteryAdjustment!.formula;
    expect(evaluateFormulaExpression(formula.expression, Object.fromEntries(formula.inputs.map(input => [input.key, input.value])))).toBe(100);
  });
  it("does not add C2 again to actual EM400 already containing the same two stacks", () => {
    const doc = c2Fixture(); if (doc.build.mode !== "manual-final") throw new Error(); doc.build.stats.em = 400;
    doc.gameContext.alhaithamDamage!.c2SnapshotIncludedStacks = 2;
    expect(result(doc).totals).toEqual(result(c2Fixture()).totals);
    expect(prepareAlhaithamDamageDocument(doc).hits[0]).not.toHaveProperty("elementalMasteryAdjustment");
  });
  it("can remove explicit expired C2 shares: four included but zero still active", () => {
    const doc = c2Fixture(); if (doc.build.mode !== "manual-final") throw new Error(); doc.build.stats.em = 500;
    Object.assign(doc.gameContext.alhaithamDamage!, { c2SnapshotStacks: 0, c2SnapshotIncludedStacks: 4 });
    expect(result(doc).totals).toEqual(result(fixture()).totals);
  });
  it("never derives C2 layers from mirrors, including unknown zero and over-cap claims", () => {
    const doc = c2Fixture(3); delete doc.gameContext.alhaithamDamage!.c2SnapshotStacks;
    expect(result(doc).status).toBe("blocked");
    doc.gameContext.alhaithamDamage!.c2SnapshotStacks = 0;
    expect(result(doc).totals).toEqual(result(fixture(3)).totals);
    delete doc.gameContext.alhaithamDamage!.c2SnapshotIncludedStacks;
    expect(result(doc).status).toBe("blocked");
    expect(alhaithamDamageContextSchema.safeParse({ c2SnapshotStacks: 5 }).success).toBe(false);
    expect(alhaithamDamageContextSchema.safeParse({ c2SnapshotIncludedStacks: 1.5 }).success).toBe(false);
    const locked = fixture(); locked.gameContext.alhaithamDamage!.c2SnapshotStacks = 1;
    expect(result(locked).status).toBe("blocked");
  });
  it("C2 varying stages lock trigger EM300 and impact EM500, not snapshot EM400", () => {
    const doc = c2Fixture(1, false); impactStates(doc)[0]!.hitTimeMastery = 500;
    // Trigger native FlatDmg stays 2.4192*300=725.76, A4 sees .5.
    expect(result(doc).totals!.nonCritical).toBeCloseTo(2122.848, 9);
    if (doc.build.mode !== "manual-final") throw new Error(); doc.build.stats.em = 900;
    expect(result(doc).totals!.nonCritical).toBeCloseTo(2122.848, 9);
  });
  it("requires explicit full-final C2 inclusion for trigger and each selected impact", () => {
    const doc = c2Fixture(2, false); delete doc.gameContext.alhaithamDamage!.c2TriggerMasteryFinal;
    expect(result(doc).status).toBe("blocked");
    doc.gameContext.alhaithamDamage!.c2TriggerMasteryFinal = true; delete impactStates(doc)[1]!.c2HitMasteryFinal;
    expect(result(doc).status).toBe("blocked");
    const fields = alhaithamRequirementAdapter.collect(doc);
    expect(fields.some(field => field.fieldPath.endsWith("c2HitMasteryFinal"))).toBe(true);
    doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[0]!.id]; expect(result(doc).status).toBe("calculated");
  });
  it("C3 consumes effective E13 once, including C2's actual mastery", () => {
    const doc = c2Fixture(1, true, 3); doc.gameContext.effectiveTalentLevel = 13;
    expect(result(doc).status).toBe("calculated");
    expect(result(doc).totals!.nonCritical).toBeCloseTo((1.428 * 2000 + 2.856 * 400) * 1.4 * .5 * .9, 9);
    const unchangedEffective = c2Fixture(1, true, 3); unchangedEffective.gameContext.effectiveTalentLevel = 10;
    expect(result(unchangedEffective).totals!.nonCritical).toBeCloseTo(2133.7344, 9);
  });
  it("puts stable snapshot C2 before equipment conversion, rederiving EM-to-ATK once", () => {
    const doc = c2Fixture(); withMasteryConversion(doc);
    // Snapshot EM400 -> conversion80 ATK, total2080; not baseline2060.
    expect(result(doc).status).toBe("calculated");
    expect(result(doc).totals!.nonCritical).toBeCloseTo((1.2096 * 2080 + 2.4192 * 400) * 1.4 * .5 * .9, 9);
    expect(result(doc).totals!.nonCritical).not.toBeCloseTo((1.2096 * 2060 + 2.4192 * 400) * 1.4 * .5 * .9, 5);
  });
  it("names and rejects EM-sensitive equipment with varying stages and links actual-panel control", () => {
    const doc = c2Fixture(1, false); withMasteryConversion(doc);
    expect(alhaithamUnstableC2EquipmentRules(doc)).toEqual(["独立相位测试：20%精通转攻击"]);
    expect(result(doc).status).toBe("blocked");
    expect(alhaithamRequirementAdapter.collect(doc).some(field => field.controlSelector === "#calc-build-mode")).toBe(true);
    expect(renderAlhaithamControls(doc)).toContain("手动最终面板");
  });
  it("imported panel plus C2 EM delta blocks until other actual snapshot attributes are confirmed", () => {
    const doc = c2Fixture(); if (doc.build.mode !== "manual-final") throw new Error(); doc.build = { ...doc.build, mode: "imported-final" };
    expect(alhaithamRequiresC2SnapshotStatsConfirmation(doc)).toBe(true); expect(result(doc).status).toBe("blocked");
    expect(alhaithamRequirementAdapter.collect(doc).some(field => field.fieldPath.endsWith("c2OtherSnapshotStatsFinal"))).toBe(true);
    expect(renderAlhaithamControls(doc)).toContain("C2生效后的实际攻击力");
    doc.gameContext.alhaithamDamage!.c2OtherSnapshotStatsFinal = true;
    expect(result(doc).totals!.nonCritical).toBeCloseTo(2133.7344, 9);
    doc.gameContext.alhaithamDamage!.c2OtherSnapshotStatsFinal = false; expect(result(doc).status).toBe("blocked");
  });
  it("an imported actual panel already containing its two stacks needs no extra snapshot confirmation", () => {
    const doc = c2Fixture(); if (doc.build.mode !== "manual-final") throw new Error(); doc.build = { ...doc.build, mode: "imported-final", stats: { ...doc.build.stats, em: 400 } };
    doc.gameContext.alhaithamDamage!.c2SnapshotIncludedStacks = 2;
    expect(alhaithamRequiresC2SnapshotStatsConfirmation(doc)).toBe(false); expect(result(doc).status).toBe("calculated");
  });
  it("preserves foreign EM slot contributions and rejects a nonzero C2 overwrite", () => {
    const doc = c2Fixture(); if (doc.hits[0]!.kind !== "ordinary") throw new Error();
    const foreign = { accounting: "add-to-panel" as const, formula: { ruleId: "foreign-em", label: "Foreign EM contribution", expression: { kind: "constant" as const, value: 42 }, inputs: [], sourceRefs: ["https://example.test/foreign-em"] } };
    doc.hits[0]!.elementalMasteryAdjustment = foreign;
    expect(prepareAlhaithamDamageDocument(doc).hits[0]).toHaveProperty("elementalMasteryAdjustment", foreign); expect(result(doc).status).toBe("blocked");
  });
  it("new showcase clears unknown C2 state; fresh equipment proves only zero included, never active layers", () => {
    const doc = c2Fixture(2, false); doc.gameContext.alhaithamDamage!.c2OtherSnapshotStatsFinal = true;
    resetAlhaithamPanelAccounting(doc, "imported-final");
    expect(alhaithamContext(doc)?.c2SnapshotStacks).toBeUndefined(); expect(alhaithamContext(doc)?.c2SnapshotIncludedStacks).toBeUndefined();
    expect(alhaithamContext(doc)?.c2TriggerMasteryFinal).toBeUndefined(); expect(alhaithamContext(doc)?.c2OtherSnapshotStatsFinal).toBeUndefined();
    expect(impactStates(doc).every(state => state.c2HitMasteryFinal === undefined)).toBe(true);
    resetAlhaithamPanelAccounting(doc, "fresh-equipment"); expect(alhaithamContext(doc)?.c2SnapshotIncludedStacks).toBe(0); expect(alhaithamContext(doc)?.c2SnapshotStacks).toBeUndefined();
  });
  it("C2 converted EM-sensitive snapshots reopen exactly, and reject changed frozen stack accounting", () => {
    const doc = c2Fixture(); withMasteryConversion(doc);
    const before = result(doc), converted = convertCalculatorToFinalPanel(doc) as AlhaithamCalculatorDocument;
    expect(result(converted).status).toBe("calculated"); expect(result(converted).totals).toEqual(before.totals);
    const reopened = JSON.parse(JSON.stringify(converted)) as AlhaithamCalculatorDocument; expect(result(reopened).totals).toEqual(before.totals);
    reopened.gameContext.alhaithamDamage!.c2SnapshotStacks = 3; expect(result(reopened).status).toBe("blocked");
    const changedIncluded = structuredClone(converted); changedIncluded.gameContext.alhaithamDamage!.c2SnapshotIncludedStacks = 2; expect(result(changedIncluded).status).toBe("blocked");
    const lowerConstellation = structuredClone(converted); lowerConstellation.gameContext.constellation = 1; expect(result(lowerConstellation).status).toBe("blocked");
  });
  it("downgrading to C1 rejects both active and included C2 shares; confirmation flags add no mastery", () => {
    for (const shares of [{ c2SnapshotStacks: 2, c2SnapshotIncludedStacks: 0 }, { c2SnapshotStacks: 0, c2SnapshotIncludedStacks: 2 }]) {
      const doc = fixture(); doc.gameContext.constellation = 1; Object.assign(doc.gameContext.alhaithamDamage!, shares);
      expect(result(doc).status).toBe("blocked");
    }
    const flagsOnly = fixture(); flagsOnly.gameContext.constellation = 1;
    Object.assign(flagsOnly.gameContext.alhaithamDamage!, { c2TriggerMasteryFinal: true, c2OtherSnapshotStatsFinal: true });
    impactStates(flagsOnly)[0]!.c2HitMasteryFinal = true;
    expect(result(flagsOnly).totals).toEqual(result(fixture()).totals);
  });
  it("does not reject an EM-sensitive normal-only equipment bonus that cannot apply to projection skill", () => {
    const doc = c2Fixture(1, false); withMasteryConversion(doc);
    if (doc.build.mode !== "equipment-derived" || !doc.build.equipment) throw new Error();
    doc.build.equipment.statModifiers = [];
    doc.build.equipment.dynamicHitBonuses = [{ id: "normal-only-em-test", label: "只限普攻的精通增伤测试", attackTags: ["normal"],
      expression: { kind: "multiply", terms: [{ kind: "variable", key: "em" }, { kind: "constant", value: .001 }] }, inputs: [], sourceRefs: ["https://example.test/normal-only-bonus"] }];
    expect(alhaithamUnstableC2EquipmentRules(doc)).toEqual([]); expect(result(doc).status).toBe("calculated");
  });
});

function c4Fixture(mirrors = 1, constellation = 4, stable = true): AlhaithamCalculatorDocument {
  const doc = c2Fixture(mirrors, stable, constellation);
  doc.gameContext.alhaithamDamage!.c4SnapshotStacks = 3;
  if (constellation >= 6) doc.gameContext.alhaithamDamage!.c6SnapshotActive = true;
  return doc;
}
describe("Alhaitham C4–C6 actual delayed-snapshot contributions", () => {
  it.each([0, 1, 2, 3])("C4 uses %i explicitly active Q-generated shares, never held mirrors or teammate EM", stacks => {
    const doc = c4Fixture(); doc.gameContext.alhaithamDamage!.c4SnapshotStacks = stacks;
    const output = result(doc);
    // E10 ATK2000, C2 actual EM400: ATK2419.2 + EM967.68 = 3386.88.
    // C4 contributes only .1*shares; its consumed-mirror EM goes to others.
    expect(output.status).toBe("calculated");
    expect(output.totals!.nonCritical).toBeCloseTo(3386.88 * (1.4 + .1 * stacks) * .45, 9);
    expect(output.totals!.nonCritical).not.toBeCloseTo((2419.2 + 2.4192 * 490) * (1.49 + .1 * stacks) * .45, 5);
  });
  it("C5 changes no projection talent; supplied effective E13 is used once", () => {
    const c4 = c4Fixture(), c5 = c4Fixture(1, 5);
    expect(result(c5).totals).toEqual(result(c4).totals);
    c5.gameContext.effectiveTalentLevel = 13;
    expect(result(c5).totals!.nonCritical).toBeCloseTo((2856 + 1142.4) * 1.7 * .45, 9);
  });
  it("unknown C4/C6 state blocks; explicit inactive0/false is a valid unbuffed scenario", () => {
    const doc = c4Fixture(3, 6); delete doc.gameContext.alhaithamDamage!.c4SnapshotStacks;
    expect(result(doc).status).toBe("blocked");
    expect(alhaithamRequirementAdapter.collect(doc).some(field => field.fieldPath.endsWith("c4SnapshotStacks"))).toBe(true);
    doc.gameContext.alhaithamDamage!.c4SnapshotStacks = 0; delete doc.gameContext.alhaithamDamage!.c6SnapshotActive;
    expect(result(doc).status).toBe("blocked");
    expect(alhaithamRequirementAdapter.collect(doc).some(field => field.fieldPath.endsWith("c6SnapshotActive"))).toBe(true);
    doc.gameContext.alhaithamDamage!.c6SnapshotActive = false;
    expect(result(doc).totals!.nonCritical).toBeCloseTo(3 * 2133.7344, 9);
    expect(result(doc).totals!.expected).toBeCloseTo(3 * 3200.6016, 9);
  });
  it.each([1, 2, 3])("C6's actual overflow snapshot contributes10CR/70CD to %i real contacts", mirrors => {
    const doc = c4Fixture(mirrors, 6), output = result(doc);
    // C4 noncritical2590.9632; CR .5+.1=.6, CD1+.7=1.7.
    expect(output.status).toBe("calculated");
    expect(output.totals!.nonCritical).toBeCloseTo(2590.9632 * mirrors, 9);
    expect(output.totals!.critical).toBeCloseTo(6995.60064 * mirrors, 9);
    expect(output.totals!.expected).toBeCloseTo(5233.745664 * mirrors, 9);
  });
  it("does not add a second C4 share already entered, and removes an explicit expired share", () => {
    const doc = c4Fixture(); if (doc.hits[0]!.kind !== "ordinary") throw new Error();
    doc.hits[0]!.damageBonus = .3; impactStates(doc)[0]!.includedC4Bonus = .3;
    expect(result(doc).totals).toEqual(result(c4Fixture()).totals);
    doc.gameContext.alhaithamDamage!.c4SnapshotStacks = 0;
    expect(result(doc).totals!.nonCritical).toBeCloseTo(2133.7344, 9);
  });
  it("accounts C6 rate and damage independently, including explicitly expired included shares", () => {
    const doc = c4Fixture(1, 6); if (doc.build.mode !== "manual-final") throw new Error();
    doc.build.stats.critRate = .6; impactStates(doc)[0]!.c6CritRateIncluded = true;
    expect(result(doc).totals).toEqual(result(c4Fixture(1, 6)).totals);
    doc.build.stats.critDamage = 1.7; impactStates(doc)[0]!.c6CritDamageIncluded = true;
    expect(result(doc).totals).toEqual(result(c4Fixture(1, 6)).totals);
    doc.gameContext.alhaithamDamage!.c6SnapshotActive = false;
    expect(result(doc).totals!.expected).toBeCloseTo(2590.9632 * 1.5, 9);
  });
  it("caps final CR probability after C6 while preserving70CD", () => {
    const doc = c4Fixture(1, 6); if (doc.build.mode !== "manual-final") throw new Error(); doc.build.stats.critRate = .95;
    const output = result(doc);
    expect(output.hits[0]!.effectiveCritRate).toBe(1);
    expect(output.totals!.expected).toBeCloseTo(2590.9632 * 2.7, 9);
  });
  it("keeps trigger FlatDmg and impact A4 independent of C4/C6 snapshot samples", () => {
    const doc = c4Fixture(1, 6, false); doc.gameContext.alhaithamDamage!.c4SnapshotStacks = 2;
    impactStates(doc)[0]!.hitTimeMastery = 500;
    // Trigger EM300 -> Flat725.76; A4 at impactEM500=.5, snapshotC4=.2.
    expect(result(doc).totals!.nonCritical).toBeCloseTo(3144.96 * 1.7 * .45, 9);
    expect(result(doc).totals!.expected).toBeCloseTo(3144.96 * 1.7 * .45 * 2.02, 9);
  });
  it("requires unknown imported C4/CR/CD included declarations separately", () => {
    const doc = c4Fixture(1, 6), state = impactStates(doc)[0]!;
    delete state.includedC4Bonus; delete state.c6CritRateIncluded; delete state.c6CritDamageIncluded;
    expect(result(doc).status).toBe("blocked");
    const fields = alhaithamRequirementAdapter.collect(doc).map(field => field.fieldPath);
    expect(fields.some(field => field.endsWith("includedC4Bonus"))).toBe(true);
    expect(fields.some(field => field.endsWith("c6CritRateIncluded"))).toBe(true);
    expect(fields.some(field => field.endsWith("c6CritDamageIncluded"))).toBe(true);
  });
  it.each(["critRateFormula", "critDamageFormula"] as const)("preserves a foreign %s and blocks the C6 slot conflict", key => {
    const doc = c4Fixture(1, 6); if (doc.hits[0]!.kind !== "ordinary") throw new Error();
    const foreign = { ruleId: "foreign-critical-contribution", label: "Foreign critical contribution", expression: { kind: "constant" as const, value: .2 }, inputs: [], sourceRefs: ["https://example.test/foreign-critical"] };
    doc.hits[0]![key] = foreign;
    expect(prepareAlhaithamDamageDocument(doc).hits[0]).toHaveProperty(key, foreign);
    expect(result(doc).status).toBe("blocked");
  });
  it("rejects explicit final critical overrides that would silently bypass a nonzero C6 difference", () => {
    const doc = c4Fixture(1, 6); if (doc.hits[0]!.kind !== "ordinary") throw new Error();
    doc.hits[0]!.effectiveCritRate = .5; doc.hits[0]!.effectiveCritDamage = 1;
    expect(result(doc).status).toBe("blocked");
    expect(alhaithamRequirementAdapter.collect(doc).some(field => field.fieldPath === "hits.0.effectiveCritRate")).toBe(true);
    doc.hits[0]!.effectiveCritRate = .6; doc.hits[0]!.effectiveCritDamage = 1.7;
    Object.assign(impactStates(doc)[0]!, { c6CritRateIncluded: true, c6CritDamageIncluded: true });
    expect(result(doc).totals).toEqual(result(c4Fixture(1, 6)).totals);
  });
  it("import clears all new combat/entry claims while fresh equipment only knows zero included", () => {
    const doc = c4Fixture(2, 6); resetAlhaithamPanelAccounting(doc, "imported-final");
    expect(alhaithamContext(doc)?.c4SnapshotStacks).toBeUndefined(); expect(alhaithamContext(doc)?.c6SnapshotActive).toBeUndefined();
    expect(impactStates(doc).every(state => state.includedC4Bonus === undefined && state.c6CritRateIncluded === undefined && state.c6CritDamageIncluded === undefined)).toBe(true);
    resetAlhaithamPanelAccounting(doc, "fresh-equipment");
    expect(alhaithamContext(doc)?.c4SnapshotStacks).toBeUndefined(); expect(alhaithamContext(doc)?.c6SnapshotActive).toBeUndefined();
    expect(impactStates(doc).every(state => state.includedC4Bonus === 0 && state.c6CritRateIncluded === false && state.c6CritDamageIncluded === false)).toBe(true);
  });
  it("reopens C0–C3 JSON without new required fields, while historical C4+ needs actual states", () => {
    for (const cons of [0, 1, 2, 3, 4, 5, 6]) {
      const doc = cons < 2 ? fixture() : c2Fixture(1, true, cons); doc.gameContext.constellation = cons;
      for (const state of impactStates(doc)) { delete state.includedC4Bonus; delete state.c6CritRateIncluded; delete state.c6CritDamageIncluded; }
      expect(result(JSON.parse(JSON.stringify(doc))).status).toBe(cons < 4 ? "calculated" : "blocked");
    }
  });
  it("C6 equipment conversion reopens exactly and rejects altered C4/C6 or lower constellation identity", () => {
    const doc = c4Fixture(3, 6); withMasteryConversion(doc);
    const before = result(doc), converted = convertCalculatorToFinalPanel(doc) as AlhaithamCalculatorDocument;
    expect(result(converted).totals).toEqual(before.totals);
    expect(result(JSON.parse(JSON.stringify(converted))).totals).toEqual(before.totals);
    for (const mutate of [
      (changed: AlhaithamCalculatorDocument) => { changed.gameContext.alhaithamDamage!.c4SnapshotStacks = 0; },
      (changed: AlhaithamCalculatorDocument) => { changed.gameContext.alhaithamDamage!.c6SnapshotActive = false; },
      (changed: AlhaithamCalculatorDocument) => { impactStates(changed)[0]!.c6CritDamageIncluded = true; },
      (changed: AlhaithamCalculatorDocument) => { changed.gameContext.constellation = 3; },
    ]) { const changed = structuredClone(converted); mutate(changed); expect(result(changed).status).toBe("blocked"); }
  });
  it("C4+ cannot bypass the actual-panel confirmation marker after serialization", () => {
    const doc = c4Fixture(1, 6); doc.gameContext.alhaithamDamage!.c2RequiresActualPanelConfirmation = true;
    for (const confirmation of [undefined, false, true]) {
      if (confirmation === undefined) delete doc.gameContext.alhaithamDamage!.c2OtherSnapshotStatsFinal;
      else doc.gameContext.alhaithamDamage!.c2OtherSnapshotStatsFinal = confirmation;
      const reopened = JSON.parse(JSON.stringify(doc));
      expect(result(reopened).status).toBe(confirmation === true ? "calculated" : "blocked");
    }
  });
  it("rejects locked positive C4/C6 declarations and invalid over-cap state", () => {
    const doc = c4Fixture(1, 6); doc.gameContext.constellation = 3;
    expect(result(doc).status).toBe("blocked");
    doc.gameContext.alhaithamDamage!.c4SnapshotStacks = 0; doc.gameContext.alhaithamDamage!.c6SnapshotActive = false;
    impactStates(doc)[0]!.includedC4Bonus = .1; expect(result(doc).status).toBe("blocked");
    impactStates(doc)[0]!.includedC4Bonus = 0; impactStates(doc)[0]!.c6CritRateIncluded = true;
    expect(result(doc).status).toBe("blocked");
    for (const state of [{ c4SnapshotStacks: 4 }, { c4SnapshotStacks: 1.1 }, { hitStates: { h: { includedC4Bonus: .31 } } }, { c6SnapshotActive: 1 }]) expect(alhaithamDamageContextSchema.safeParse(state).success).toBe(false);
  });
});
