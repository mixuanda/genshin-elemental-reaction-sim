import { describe, expect, it } from "vitest";
import { findTalentSetById } from "../../game-data/src/catalog";
import { arlecchinoPrimaryMappings, arlecchinoPrimarySourceEvidence } from "../../game-data/src/character-mappings/arlecchino-primary-mappings";
import { applyArlecchinoDamageContext, initializeArlecchinoDamageDocument } from "../../../apps/web/src/arlecchino-calculation-context";
import { arlecchinoRequirementAdapter, renderArlecchinoControls, updateArlecchinoDamageControl } from "../../../apps/web/src/calculator-arlecchino-controls";
import { calculateDocument, convertCalculatorToFinalPanel } from "./calculator";
import { calculatorFormulaSchema, type CalculatorDocument, type CalculatorFormula } from "./calculator-model";
import { evaluateFormulaExpression, expr } from "./calculation-trace";
import { arlecchinoDamageContextSchema } from "./arlecchino-damage-context";
import {
  ARLECCHINO_DAMAGE_SOURCE_REFS, arlecchinoContext, canInferArlecchinoBondBaseZero,
  createArlecchinoBondBaseFormula, createArlecchinoPassiveDamageBonusFormula, finalizeArlecchinoPanelAccounting,
  isArlecchinoDamageAction, prepareArlecchinoDamageDocument, resetArlecchinoPanelAccounting, type ArlecchinoCalculatorDocument,
} from "./arlecchino-damage-formulas";

function fixture(suffix = "1", talent = 10): ArlecchinoCalculatorDocument {
  const mapping = arlecchinoPrimaryMappings.find(row => row.skillId === `arlecchino-red-death-normal-${suffix}`)!;
  return {
    schemaVersion: "1.0.0", ruleVersion: "ordinary-trace-v1", id: "arlecchino-explicit-unit-panel", label: "Explicit source fixture; not a real player build",
    gameContext: {characterId: "character:10000096", characterName: "阿蕾奇诺", abilityId: "talent:arlecchino:combat1", skillId: mapping.skillId,
      skillName: mapping.skillLabel!, effectiveTalentLevel: talent, constellation: 0, ascension: 6, scopeCoverage: "single-hit", attributionPolicy: "One actual selected normal hit",
      arlecchinoDamage: {bondOfLifePercent: 150, passivePyroBonusIncluded: false}},
    scope: "single-hit", characterLevel: 90,
    build: {mode: "manual-final", ascension: 6, source: "Explicit unit final panel", stats: {atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1}},
    enemy: {level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0},
    hits: [{id: mapping.id, label: mapping.hitLabel, kind: "ordinary", element: "pyro", attackTag: "normal", terms: [{stat: "atk", coefficient: 999}],
      additiveBaseDamage: 0, damageBonus: 0, critEligible: true, reaction: "none", reactionBonus: 0, groupMultiplier: 1, dependencies: [], sourceRefs: ARLECCHINO_DAMAGE_SOURCE_REFS}],
    selectedHitIds: [mapping.id], assumptions: [], dependencies: [],
    dataIdentity: {datasetId: "arlecchino-independent-source-fixture", gameVersion: "fixed-source", releaseStatus: "released", evidenceStatus: "provisional"},
  };
}

/** TEMPORARY UNWIRED ADAPTER: parent owns public schema/source-cast wiring.
 * Only remove this unregistered context AFTER real preparation; retain all
 * formulas, dependencies and numerical/negative assertions. Once registered,
 * parent must replace this adapter with calculateDocument(document) using the
 * actual source-cast path. No production file is changed for isolated tests. */
function forUnwiredSharedCore(document: CalculatorDocument): CalculatorDocument {
  const result = structuredClone(document) as ArlecchinoCalculatorDocument;
  delete result.gameContext.arlecchinoDamage;
  return result;
}
const calculate = (document: CalculatorDocument) => calculateDocument(forUnwiredSharedCore(prepareArlecchinoDamageDocument(document)));
const reasons = (document: CalculatorDocument) => prepareArlecchinoDamageDocument(document).dependencies.filter(row => row.status === "missing").map(row => row.reason).join("；");
const ordinary = (document: CalculatorDocument) => {
  const hit = document.hits[0]!;
  if (hit.kind !== "ordinary") throw new Error("ordinary fixture expected");
  return hit;
};
const evaluate = (formula: CalculatorFormula, atk = 2000) => {
  expect(calculatorFormulaSchema.safeParse(formula).success).toBe(true);
  return evaluateFormulaExpression(formula.expression, {atk, ...Object.fromEntries(formula.inputs.map(row => [row.key, row.value]))});
};
const foreignFormula = (ruleId = "external-unmerged-formula"): CalculatorFormula => ({ruleId, label: "External formula", expression: expr.value(123456), inputs: [], sourceRefs: ARLECCHINO_DAMAGE_SOURCE_REFS});

function equipmentFixture(): ArlecchinoCalculatorDocument {
  const document = fixture();
  document.build = {mode: "equipment-derived", characterBaseAtk: 1000, weaponBaseAtk: 1000, atkPercent: 0, flatAtk: 0,
    baseHp: 20000, hpPercent: 0, flatHp: 0, baseDef: 800, defPercent: 0, flatDef: 0, em: 0, critRate: .5, critDamage: 1,
    equipment: {characterId: "character:10000096", weaponId: "unit-polearm", level: 90, ascension: 6, weaponLevel: 90, weaponAscension: 6,
      refinement: 1, sourceVersion: "unit", sourceRefs: ARLECCHINO_DAMAGE_SOURCE_REFS, derivedStats: [], secondaryContributions: [], assumptions: [], effectBlockers: [],
      hitBonuses: [{id: "unit-pyro", value: .466, sourceRef: ARLECCHINO_DAMAGE_SOURCE_REFS[0]!, label: "Independent equipment Pyro bonus", elements: ["pyro"]}],
      statModifiers: [{id: "unit-em-atk-conversion", label: "External EM conversion", target: "flatAtk", phase: "conversion",
        expression: expr.mul(expr.input("em"), expr.value(.1)), inputs: [], sourceRefs: ARLECCHINO_DAMAGE_SOURCE_REFS}], bonusAccounting: "core-sourced-v1"}};
  ordinary(document).elementalMasteryAdjustment = {accounting: "add-to-panel", formula: {ruleId: "external-actual-em", label: "Actual external EM+100",
    expression: expr.value(100), inputs: [], sourceRefs: ARLECCHINO_DAMAGE_SOURCE_REFS}};
  resetArlecchinoPanelAccounting(document, "fresh-equipment");
  return document;
}
function convertedFixture(): ArlecchinoCalculatorDocument {
  const prepared = prepareArlecchinoDamageDocument(equipmentFixture());
  const converted = convertCalculatorToFinalPanel(forUnwiredSharedCore(prepared)) as ArlecchinoCalculatorDocument;
  // Parent wiring must replace this manual context transfer/finalize with the
  // real convertCalculatorToFinalPanel(prepareArlecchinoDamageDocument(doc)).
  converted.gameContext.arlecchinoDamage = structuredClone(arlecchinoContext(prepared)!);
  finalizeArlecchinoPanelAccounting(converted);
  return converted;
}

describe("Arlecchino fixed C0 selected normal source vectors", () => {
  it("registers seven separate normal hits, including both independently sampled N4 hits", () => {
    expect(arlecchinoPrimaryMappings.map(row => row.skillId)).toEqual(["1", "2", "3", "4-hit-1", "4-hit-2", "5", "6"].map(suffix => `arlecchino-red-death-normal-${suffix}`));
    expect(arlecchinoPrimaryMappings.every(row => row.abilityKey === "combat1" && row.attackTag === "normal" && !row.completeAction)).toBe(true);
    const vectors = arlecchinoPrimarySourceEvidence.coefficients.filter(row => row.sourceTable === "attack");
    expect(vectors.map(row => row.hitFrame)).toEqual([11, 16, 17, 24, 35, 21, 44]);
    const ability = findTalentSetById("talent-set:arlecchino")!.abilities.find(row => row.key === "combat1")!;
    for (const mapping of arlecchinoPrimaryMappings) {
      expect(mapping.sourceCoefficientValues).toHaveLength(15);
      expect(ability.parameters[mapping.parameterKey]).toEqual(mapping.sourceCoefficientValues);
      expect(mapping.formulaParameters).toEqual([{key: "arlecchinoMasqueCoefficient", parameterKey: "param12", sourceCoefficientValues: [1.204, 1.302, 1.4, 1.54, 1.638, 1.75, 1.904, 2.058, 2.212, 2.38, 2.548, 2.716, 2.884, 3.052, 3.22], coefficientTolerance: 0}]);
      expect(ability.parameters.param12).toEqual(mapping.formulaParameters![0]!.sourceCoefficientValues);
    }
  });

  it("keeps original raw source identities distinct from instrumented native trees", () => {
    expect(arlecchinoPrimarySourceEvidence.crossVariant.allReviewedFilesIdentical).toBe(true);
    expect(arlecchinoPrimarySourceEvidence.nativeOverlayAudit.files.some(row => !row.matchesOriginal)).toBe(true);
    expect(arlecchinoPrimarySourceEvidence.upstreamLicense.spdx).toBe("MIT");
    // Actual raw SHA256/Git blob checks run in the source-audit script, which
    // takes the explicit cache path. Unit tests remain portable without that
    // external cache and verify that both immutable source identities agree.
    const identity = (row: {path: string; sha256: string; gitBlob: string}) => ({path: row.path, sha256: row.sha256, gitBlob: row.gitBlob});
    expect(arlecchinoPrimarySourceEvidence.crossVariant.files.map(identity)).toEqual(arlecchinoPrimarySourceEvidence.files.map(identity));
    expect(arlecchinoPrimarySourceEvidence.files.find(row => row.path.endsWith("/attack.go"))!.sha256).toBe("08d8ca8aa4e81ad6e80ff1f00b2761a42c04c72de0a1081d231b6b49129bea21");
  });

  it.each([
    ["1", .938961, 5681.29086], ["2", 1.029996, 5795.99496], ["3", 1.29251, 6126.7626],
    ["4-hit-1", .734264, 5423.37264], ["4-hit-2", .734264, 5423.37264], ["5", 1.383358, 6241.23108], ["6", 1.687709, 6624.71334],
  ] as const)("keeps %s ATK term separate from the 7140 bond FlatDmg", (suffix, coefficient, expected) => {
    const prepared = prepareArlecchinoDamageDocument(fixture(suffix)), hit = ordinary(prepared);
    expect(hit.terms).toEqual([{stat: "atk", coefficient}]);
    expect(evaluate(hit.additiveBaseFormula!)).toBe(7140);
    expect(evaluate(hit.damageBonusFormula!)).toBe(.4);
    const output = calculate(prepared);
    expect(output.blockers).toEqual([]);
    expect(output.aggregation.scope).toBe("single-hit");
    expect(output.totals!.nonCritical).toBeCloseTo(expected, 8);
    expect(output.totals!.expected).toBeCloseTo(expected * 1.5, 8);
    expect(output.totals!.critical).toBeCloseTo(expected * 2, 8);
  });

  it.each([[1, .475004, 1.204, 2874.06504], [10, .938961, 2.38, 5681.29086], [15, 1.270359, 3.22, 7686.45234]])("uses normal talent %i for both independent terms exactly once", (level, normal, masque, expected) => {
    const prepared = prepareArlecchinoDamageDocument(fixture("1", level));
    expect(ordinary(prepared).terms).toEqual([{stat: "atk", coefficient: normal}]);
    expect(evaluate(ordinary(prepared).additiveBaseFormula!)).toBeCloseTo(2000 * 1.5 * masque, 10);
    expect(calculate(prepared).totals!.nonCritical).toBeCloseTo(expected, 8);
  });
});

describe("Arlecchino actual pre-consumption bond state and accounting", () => {
  it.each([0, 29, 29.999999])("rejects actual %s percent as an unsupported Red Death Pyro hit", percent => {
    const document = fixture(); arlecchinoContext(document)!.bondOfLifePercent = percent;
    const prepared = prepareArlecchinoDamageDocument(document);
    expect(ordinary(prepared).element).toBe("pyro");
    expect(ordinary(prepared).additiveBaseFormula).toBeUndefined();
    expect(calculate(prepared).status).toBe("blocked");
    expect(calculate(prepared).totals).toBeUndefined();
    expect(reasons(prepared)).toContain("低于最大生命的30%");
  });

  it.each([30, 200])("includes the actual %s percent boundary without consuming 7.5%% first", percent => {
    const document = fixture(); arlecchinoContext(document)!.bondOfLifePercent = percent;
    const output = calculate(document);
    expect(output.blockers).toEqual([]);
    expect(output.totals!.nonCritical).toBeCloseTo(2000 * (.938961 + 2.38 * percent / 100) * 1.4 * .5 * .9, 9);
    expect(arlecchinoContext(document)!.bondOfLifePercent).toBe(percent);
  });

  it.each([-1, 200.0001, Number.NaN, Number.POSITIVE_INFINITY])("rejects bond domain %s", percent => {
    expect(arlecchinoDamageContextSchema.safeParse({bondOfLifePercent: percent}).success).toBe(false);
  });

  it("requires an actual bond value and never substitutes a showcase/default debt", () => {
    const document = fixture(); delete arlecchinoContext(document)!.bondOfLifePercent;
    expect(calculate(document).status).toBe("blocked");
    expect(reasons(document)).toContain("公开展柜不包含");
    const initial = initializeArlecchinoDamageDocument(fixture());
    expect(arlecchinoContext(initial)!.bondOfLifePercent).toBeUndefined();
    expect(calculate(initial).status).toBe("blocked");
  });

  it("samples the two N4 contacts independently and never auto-generates their consumption", () => {
    const first = fixture("4-hit-1"), second = fixture("4-hit-2");
    arlecchinoContext(second)!.bondOfLifePercent = 138.75; // Explicit second-hit observation, not generated by the module.
    expect(calculate(first).totals!.nonCritical).toBeCloseTo(2000 * (.734264 + 2.38 * 1.5) * .63, 9);
    expect(calculate(second).totals!.nonCritical).toBeCloseTo(2000 * (.734264 + 2.38 * 1.3875) * .63, 9);
    expect(prepareArlecchinoDamageDocument(first).hits).toHaveLength(1);
    expect(prepareArlecchinoDamageDocument(second).hits).toHaveLength(1);
    expect(arlecchinoContext(first)!.bondOfLifePercent).toBe(150);
    expect(arlecchinoContext(second)!.bondOfLifePercent).toBe(138.75);
  });

  it("scales bond base by TotalAtk and actual ratio, not current HP or maximum HP", () => {
    const a = fixture(), b = fixture();
    if (b.build.mode === "equipment-derived") throw new Error("manual");
    b.build.stats.hp = 99999;
    expect(calculate(a).totals).toEqual(calculate(b).totals);
    b.build.stats.atk = 2500;
    expect(calculate(b).totals!.nonCritical).toBeCloseTo(2500 * (.938961 + 2.38 * 1.5) * .63, 9);
  });

  it("applies the unconditional 40 percent passive even without an ascension claim", () => {
    const document = fixture(); document.gameContext.ascension = 0;
    if (document.build.mode === "equipment-derived") throw new Error("manual");
    document.build.ascension = 0;
    expect(calculate(document).totals).toEqual(calculate(fixture()).totals);
    delete document.gameContext.ascension; delete document.build.ascension;
    expect(calculate(document).totals).toEqual(calculate(fixture()).totals);
  });

  it("subtracts both already-included own shares exactly once", () => {
    const fresh = fixture(), included = fixture();
    ordinary(included).damageBonus = .4; ordinary(included).additiveBaseDamage = 7140;
    Object.assign(arlecchinoContext(included)!, {passivePyroBonusIncluded: true, includedBondBase: 7140});
    expect(calculate(fresh).totals).toEqual(calculate(included).totals);
    expect(evaluate(createArlecchinoPassiveDamageBonusFormula(true))).toBe(0);
    expect(evaluate(createArlecchinoBondBaseFormula(10, 150, 7140))).toBe(0);
  });

  it("does not guess imported passive inclusion and does infer a genuinely empty FlatDmg input", () => {
    const document = fixture();
    resetArlecchinoPanelAccounting(document, "imported-final");
    expect(arlecchinoContext(document)!.bondOfLifePercent).toBeUndefined();
    expect(arlecchinoContext(document)!.passivePyroBonusIncluded).toBeUndefined();
    expect(arlecchinoContext(document)!.includedBondBase).toBe(0);
    arlecchinoContext(document)!.bondOfLifePercent = 150;
    expect(reasons(document)).toContain("是否已经包含");
    expect(calculate(document).status).toBe("blocked");
    ordinary(document).damageBonus = .4; arlecchinoContext(document)!.passivePyroBonusIncluded = true;
    expect(calculate(document).totals).toEqual(calculate(fixture()).totals);
  });

  it("requires explicit own FlatDmg accounting for nonempty or materialized additive input", () => {
    const document = fixture(); ordinary(document).additiveBaseDamage = 50;
    expect(canInferArlecchinoBondBaseZero(document)).toBe(false);
    expect(calculate(document).status).toBe("blocked");
    arlecchinoContext(document)!.includedBondBase = 0;
    expect(calculate(document).totals!.nonCritical).toBeCloseTo((2000 * .938961 + 7140 + 50) * .63, 9);
  });
});

describe("Arlecchino fixed-source contract and legal external adjustments", () => {
  it.each([1, 2, 3, 4, 5, 6])("rejects C%i without replacing its changes by C0", constellation => {
    const document = fixture(); document.gameContext.constellation = constellation;
    expect(calculate(document).status).toBe("blocked");
    expect(reasons(document)).toContain("只审阅C0");
  });

  it.each(["talent:arlecchino:combat2", "talent:arlecchino:combat3"])("rejects borrowed ability identity %s", ability => {
    const document = fixture(); document.gameContext.abilityId = ability;
    expect(calculate(document).status).toBe("blocked");
    expect(reasons(document)).toContain("独立有效普攻天赋");
  });

  it("never enables these fixed source formulas for preview data or unrelated ordinary attacks", () => {
    const document = fixture(); document.dataIdentity.releaseStatus = "preview";
    expect(calculate(document).status).toBe("blocked");
    document.gameContext.skillId = "arlecchino-physical-normal-1";
    expect(isArlecchinoDamageAction(document)).toBe(false);
    expect(prepareArlecchinoDamageDocument(document)).toBe(document);
  });

  it.each([0, 16, 10.5])("rejects unavailable effective normal talent %s", talent => {
    expect(reasons(fixture("1", talent))).toContain("1–15级");
    expect(() => createArlecchinoBondBaseFormula(talent, 150, 0)).toThrow();
  });

  it.each(["baseDamageFormula", "additiveBaseFormula", "damageBonusFormula"] as const)("retains and rejects an unmerged external %s", slot => {
    const document = fixture(), foreign = foreignFormula(); ordinary(document)[slot] = foreign;
    const prepared = prepareArlecchinoDamageDocument(document);
    expect(ordinary(prepared)[slot]).toEqual(foreign);
    expect(calculate(prepared).status).toBe("blocked");
    expect(calculate(prepared).totals).toBeUndefined();
  });

  it.each(["additiveBaseFormula", "damageBonusFormula"] as const)("does not overwrite a foreign %s merely because its rule starts with this character prefix", slot => {
    const document = fixture(), foreign = foreignFormula("arlecchino-damage-foreign-same-slot"); ordinary(document)[slot] = foreign;
    const prepared = prepareArlecchinoDamageDocument(document);
    expect(ordinary(prepared)[slot]).toEqual(foreign);
    expect(calculate(prepared).status).toBe("blocked");
  });

  it.each([0, .5, 2])("rejects undeclared group multiplier %s", groupMultiplier => {
    const document = fixture(); ordinary(document).groupMultiplier = groupMultiplier;
    expect(calculate(document).status).toBe("blocked");
    expect(reasons(document)).toContain("命中倍率必须为1");
  });

  it("rejects a copied/renamed second hit and declared cast totals", () => {
    const document = fixture(), extra = structuredClone(ordinary(document)); extra.id = "copied-normal";
    document.hits.push(extra); document.selectedHitIds.push(extra.id); document.scope = "one-cast";
    expect(calculate(document).status).toBe("blocked");
    const renamed = fixture(); ordinary(renamed).id = "unowned-normal"; renamed.selectedHitIds = ["unowned-normal"];
    expect(calculate(renamed).status).toBe("blocked");
  });

  it("retains legitimate external ATK and EM slots, and bond damage sees the same actual ATK", () => {
    const document = fixture();
    ordinary(document).attackAdjustment = {accounting: "add-to-panel", formula: {ruleId: "external-atk-250", label: "External ATK +250", expression: expr.value(250), inputs: [], sourceRefs: ARLECCHINO_DAMAGE_SOURCE_REFS}};
    ordinary(document).elementalMasteryAdjustment = {accounting: "add-to-panel", formula: {ruleId: "external-em-300", label: "External EM +300", expression: expr.value(300), inputs: [], sourceRefs: ARLECCHINO_DAMAGE_SOURCE_REFS}};
    const prepared = prepareArlecchinoDamageDocument(document);
    expect(ordinary(prepared).attackAdjustment).toEqual(ordinary(document).attackAdjustment);
    expect(ordinary(prepared).elementalMasteryAdjustment).toEqual(ordinary(document).elementalMasteryAdjustment);
    expect(calculate(prepared).totals!.nonCritical).toBeCloseTo(2250 * (.938961 + 2.38 * 1.5) * .63, 9);
  });

  it("rebuilds only owned formula inputs idempotently without deleting unrelated missing evidence", () => {
    const once = prepareArlecchinoDamageDocument(fixture());
    ordinary(once).additiveBaseFormula!.inputs[0]!.value = 199;
    const rebuilt = prepareArlecchinoDamageDocument(once);
    expect(evaluate(ordinary(rebuilt).additiveBaseFormula!)).toBe(7140);
    expect(prepareArlecchinoDamageDocument(rebuilt)).toEqual(rebuilt);
    rebuilt.dependencies.push({id: "external-missing", status: "missing", reason: "Actual external evidence is missing", sourceRefs: []});
    ordinary(rebuilt).dependencies.push("external-missing");
    expect(calculate(rebuilt).status).toBe("blocked");
  });
});

describe("Arlecchino equipment conversion and historical state identity", () => {
  it("derives equipment ATK/element bonuses and applies bond FlatDmg to that actual per-hit panel", () => {
    const document = equipmentFixture(), output = calculate(document);
    expect(arlecchinoContext(document)!.passivePyroBonusIncluded).toBe(false);
    expect(arlecchinoContext(document)!.includedBondBase).toBe(0);
    expect(output.blockers).toEqual([]);
    expect(output.totals!.nonCritical).toBeCloseTo(2010 * (.938961 + 2.38 * 1.5) * 1.866 * .5 * .9, 9);
    const converted = convertedFixture();
    expect(ordinary(converted).finalSnapshot).toMatchObject({origin: "equipment-conversion", characterLevel: 90, stats: {atk: 2010}});
    expect(calculate(converted).totals).toEqual(output.totals);
  });

  it.each(["bond", "talent", "constellation", "character-level", "passive-accounting", "base-accounting", "ascension"])("rejects changed historical %s instead of relabeling old damage", change => {
    const converted = convertedFixture();
    if (change === "bond") arlecchinoContext(converted)!.bondOfLifePercent = 145;
    if (change === "talent") converted.gameContext.effectiveTalentLevel = 11;
    if (change === "constellation") converted.gameContext.constellation = 1;
    if (change === "character-level") converted.characterLevel = 100;
    if (change === "passive-accounting") arlecchinoContext(converted)!.passivePyroBonusIncluded = true;
    if (change === "base-accounting") arlecchinoContext(converted)!.includedBondBase = 100;
    if (change === "ascension") {converted.gameContext.ascension = 5; if (converted.build.mode !== "equipment-derived") converted.build.ascension = 5;}
    expect(reasons(converted)).toContain("历史快照");
    expect(calculate(converted).status).toBe("blocked");
    expect(calculate(converted).totals).toBeUndefined();
  });

  it("does not accept a foreign final snapshot or re-sign one during imported-final reset", () => {
    const converted = convertedFixture();
    delete ordinary(converted).finalSnapshot!.origin;
    expect(calculate(converted).status).toBe("blocked");
    resetArlecchinoPanelAccounting(converted, "imported-final");
    expect(arlecchinoContext(converted)!.finalizedHitStates).toBeUndefined();
    expect(arlecchinoContext(converted)!.bondOfLifePercent).toBeUndefined();
    expect(calculate(converted).status).toBe("blocked");
  });
});

describe("Arlecchino actual condition controls and requirements", () => {
  it("exposes understandable bond and included-passive controls without inventing a debt value", () => {
    const document = initializeArlecchinoDamageDocument(fixture());
    const fields = arlecchinoRequirementAdapter.collect(document), html = renderArlecchinoControls(document);
    expect(fields.map(field => field.fieldPath)).toEqual(["gameContext.arlecchinoDamage.bondOfLifePercent"]);
    expect(html).toContain('data-field="gameContext.arlecchinoDamage.bondOfLifePercent"');
    expect(html).toContain('data-source-cast-state-field="gameContext.arlecchinoDamage.passivePyroBonusIncluded"');
    expect(html).toContain("命中扣契前");
    expect(html).not.toContain('data-field="gameContext.arlecchinoDamage.includedBondBase"');
    expect(ordinary(applyArlecchinoDamageContext(document, {bondOfLifePercent: 150, passivePyroBonusIncluded: false})).terms).toEqual([{stat: "atk", coefficient: .938961}]);
  });

  it("links imported unknown fields and nonzero additive accounting to real rendered selectors", () => {
    const document = fixture(); ordinary(document).additiveBaseDamage = 10;
    resetArlecchinoPanelAccounting(document, "imported-final");
    const prepared = prepareArlecchinoDamageDocument(document), fields = arlecchinoRequirementAdapter.collect(prepared), html = renderArlecchinoControls(prepared);
    expect(fields.map(field => field.fieldPath)).toEqual(["gameContext.arlecchinoDamage.bondOfLifePercent", "gameContext.arlecchinoDamage.passivePyroBonusIncluded", "gameContext.arlecchinoDamage.includedBondBase"]);
    for (const field of fields) {
      expect(html).toContain(`="${field.fieldPath}"`);
      expect(field.dependencyIds.every(id => prepared.dependencies.some(row => row.id === id))).toBe(true);
    }
    arlecchinoContext(prepared)!.bondOfLifePercent = 29;
    expect(arlecchinoRequirementAdapter.collect(prepared)[0]!.status).toBe("condition-not-satisfied");
  });

  it("updates actual values and unknowns without creating defaults", () => {
    const document = fixture();
    expect(updateArlecchinoDamageControl(document, "gameContext.arlecchinoDamage.bondOfLifePercent", "30")).toBe(true);
    expect(arlecchinoContext(document)!.bondOfLifePercent).toBe(30);
    expect(updateArlecchinoDamageControl(document, "gameContext.arlecchinoDamage.bondOfLifePercent", "")).toBe(true);
    expect(arlecchinoContext(document)!.bondOfLifePercent).toBeUndefined();
    updateArlecchinoDamageControl(document, "gameContext.arlecchinoDamage.passivePyroBonusIncluded", "unknown");
    expect(arlecchinoContext(document)!.passivePyroBonusIncluded).toBeUndefined();
    expect(() => updateArlecchinoDamageControl(document, "gameContext.arlecchinoDamage.bondOfLifePercent", "201")).toThrow();
    expect(updateArlecchinoDamageControl(document, "gameContext.arlecchinoDamage.unowned", "1")).toBe(false);
  });
});
