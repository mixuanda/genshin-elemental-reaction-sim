import { describe, expect, it } from "vitest";
import { findTalentSetById } from "../../game-data/src/catalog";
import { arlecchinoPrimaryMappings, arlecchinoPrimarySourceEvidence } from "../../game-data/src/character-mappings/arlecchino-primary-mappings";
import { applyArlecchinoDamageContext, initializeArlecchinoDamageDocument } from "../../../apps/web/src/arlecchino-calculation-context";
import { arlecchinoRequirementAdapter, renderArlecchinoControls, updateArlecchinoDamageControl } from "../../../apps/web/src/calculator-arlecchino-controls";
import { calculateDocument, convertCalculatorToFinalPanel } from "./calculator";
import { calculatorFormulaSchema, parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument, type CalculatorFormula } from "./calculator-model";
import { evaluateFormulaExpression, expr } from "./calculation-trace";
import { arlecchinoDamageContextSchema } from "./arlecchino-damage-context";
import {
  ARLECCHINO_DAMAGE_SOURCE_REFS, ARLECCHINO_MAX_IMPLEMENTED_CONSTELLATION, arlecchinoContext, canInferArlecchinoBondBaseZero,
  createArlecchinoBondBaseFormula, createArlecchinoC6CriticalFormula, createArlecchinoPassiveDamageBonusFormula, finalizeArlecchinoPanelAccounting,
  isArlecchinoDamageAction, prepareArlecchinoDamageDocument, resetArlecchinoPanelAccounting, type ArlecchinoCalculatorDocument,
} from "./arlecchino-damage-formulas";

function fixture(suffix = "1", talent = 10, constellation = 0): ArlecchinoCalculatorDocument {
  const mapping = arlecchinoPrimaryMappings.find(row => row.skillId === `arlecchino-red-death-normal-${suffix}`)!;
  return {
    schemaVersion: "1.0.0", ruleVersion: "ordinary-trace-v1", id: "arlecchino-explicit-unit-panel", label: "Explicit source fixture; not a real player build",
    gameContext: {characterId: "character:10000096", characterName: "阿蕾奇诺", abilityId: "talent:arlecchino:combat1", skillId: mapping.skillId,
      skillName: mapping.skillLabel!, effectiveTalentLevel: talent, constellation, ascension: 6, scopeCoverage: "single-hit", attributionPolicy: "One actual selected normal hit",
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

/** Exercise the registered public calculation path with the context intact. */
const calculate = (document: CalculatorDocument) => calculateDocument(document);
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

function equipmentFixture(constellation = 0, talent = 10): ArlecchinoCalculatorDocument {
  const document = fixture("1", talent, constellation);
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
function convertedFixture(constellation = 0, talent = 10): ArlecchinoCalculatorDocument {
  return convertCalculatorToFinalPanel(equipmentFixture(constellation, talent)) as ArlecchinoCalculatorDocument;
}
function c6Fixture(active = true, talent = 13): ArlecchinoCalculatorDocument {
  const document = fixture("1", talent, 6);
  Object.assign(arlecchinoContext(document)!, {c6Active: active, c6CritRateIncludedPercent: 0, c6CritDamageIncludedPercent: 0});
  return document;
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
  it.each([6])("rejects C%i with missing actual critical state instead of replacing it by a lower constellation", constellation => {
    const document = fixture(); document.gameContext.constellation = constellation;
    expect(calculate(document).status).toBe("blocked");
    expect(calculate(document).totals).toBeUndefined();
    expect(reasons(document)).toContain("本击结算时C6双暴增益是否实际生效");
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

describe("Arlecchino C1–C5 actual selected normals", () => {
  it("publishes C0–C6 support with the same seven skill IDs and backward-compatible optional state", () => {
    expect(ARLECCHINO_MAX_IMPLEMENTED_CONSTELLATION).toBe(6);
    expect(arlecchinoPrimarySourceEvidence.contract.supportedConstellations).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(Object.keys(arlecchinoDamageContextSchema.shape)).toEqual(["bondOfLifePercent", "passivePyroBonusIncluded", "includedBondBase", "c6Active", "c6CritRateIncludedPercent", "c6CritDamageIncludedPercent", "finalizedHitStates"]);
    expect(arlecchinoPrimaryMappings.every(row => row.skillLabel?.includes("C0–C6") && !row.completeAction)).toBe(true);
    expect(arlecchinoPrimarySourceEvidence.files.some(row => row.path === "pkg/core/player/character/character.go")).toBe(true);
  });

  it.each([
    [1, 10, .938961, 2.38, 10140, 7571.29086, 15142.58172, 11356.93629],
    [2, 10, .938961, 2.38, 10140, 7571.29086, 15142.58172, 11356.93629],
    [3, 13, 1.1378, 2.884, 11652, 8774.388, 17548.776, 13161.582],
    [4, 13, 1.1378, 2.884, 11652, 8774.388, 17548.776, 13161.582],
    [5, 13, 1.1378, 2.884, 11652, 8774.388, 17548.776, 13161.582],
  ])("C%i effective NA%i uses additive C1 coefficient and exact independent damage", (constellation, talent, normal, masque, flat, nonCritical, critical, expected) => {
    const document = fixture("1", talent, constellation), prepared = prepareArlecchinoDamageDocument(document), hit = ordinary(prepared);
    expect(hit.terms).toEqual([{stat: "atk", coefficient: normal}]);
    expect(hit.additiveBaseFormula!.inputs.find(input => input.key === "arlecchinoMasqueCoefficient")!.value).toBe(masque);
    expect(hit.additiveBaseFormula!.inputs.find(input => input.key === "arlecchinoC1BondCoefficient")!.value).toBe(1);
    expect(evaluate(hit.additiveBaseFormula!)).toBe(flat);
    const output = calculate(document);
    expect(output.blockers).toEqual([]);
    expect(output.aggregation.scope).toBe("single-hit");
    expect(output.totals!.nonCritical).toBeCloseTo(nonCritical, 8);
    expect(output.totals!.critical).toBeCloseTo(critical, 8);
    expect(output.totals!.expected).toBeCloseTo(expected, 8);
    expect(document.gameContext.effectiveTalentLevel).toBe(talent);
  });

  it.each([
    ["1", 7571.29086], ["2", 7685.99496], ["3", 8016.7626], ["4-hit-1", 7313.37264],
    ["4-hit-2", 7313.37264], ["5", 8131.23108], ["6", 8514.71334],
  ] as const)("applies C1 to exactly the bond addition of source hit %s", (suffix, expected) => {
    const document = fixture(suffix, 10, 1), output = calculate(document);
    expect(output.totals!.nonCritical).toBeCloseTo(expected, 8);
    expect(prepareArlecchinoDamageDocument(document).hits).toHaveLength(1);
  });

  it("does not multiply the entire C0 bond addition by two or auto-add another three talent levels", () => {
    expect(evaluate(createArlecchinoBondBaseFormula(10, 150, 0, 1))).toBe(10140);
    expect(evaluate(createArlecchinoBondBaseFormula(10, 150, 0, 1))).not.toBe(7140 * 2);
    expect(evaluate(createArlecchinoBondBaseFormula(13, 150, 0, 3))).toBe(11652);
    expect(calculate(fixture("1", 10, 3)).totals).toEqual(calculate(fixture("1", 10, 1)).totals);
    expect(calculate(fixture("1", 13, 5)).totals).toEqual(calculate(fixture("1", 13, 3)).totals);
    expect(evaluate(createArlecchinoBondBaseFormula(13, 150, 0, 6))).toBe(11652);
    expect(() => createArlecchinoBondBaseFormula(13, 150, 0, 7)).toThrow("C0–C6");
  });

  it.each([[1, 10, 10140], [2, 10, 10140], [3, 13, 11652], [4, 13, 11652], [5, 13, 11652]])("C%i deducts already-included own bond and 40 percent shares once", (constellation, talent, flat) => {
    const fresh = fixture("1", talent, constellation), included = fixture("1", talent, constellation);
    ordinary(included).damageBonus = .4;
    ordinary(included).additiveBaseDamage = flat;
    Object.assign(arlecchinoContext(included)!, {passivePyroBonusIncluded: true, includedBondBase: flat});
    expect(calculate(included).blockers).toEqual([]);
    expect(calculate(included).totals).toEqual(calculate(fresh).totals);
    expect(evaluate(ordinary(prepareArlecchinoDamageDocument(included)).additiveBaseFormula!)).toBe(0);
  });

  it.each([[1, 10, 2460.73086], [5, 13, 2901.78]])("C%i preserves the exact 30 percent boundary", (constellation, talent, expected) => {
    const document = fixture("1", talent, constellation);
    arlecchinoContext(document)!.bondOfLifePercent = 30;
    expect(calculate(document).totals!.nonCritical).toBeCloseTo(expected, 8);
    arlecchinoContext(document)!.bondOfLifePercent = 29.999999;
    expect(calculate(document).status).toBe("blocked");
    expect(calculate(document).totals).toBeUndefined();
  });

  it("excludes C2 absorption damage, C4 resources and C5 Q instead of rejecting the selected NA", () => {
    const c1 = fixture("1", 10, 1), c2 = fixture("1", 10, 2), c3 = fixture("1", 13, 3), c4 = fixture("1", 13, 4), c5 = fixture("1", 13, 5);
    expect(calculate(c2).totals).toEqual(calculate(c1).totals);
    expect(calculate(c4).totals).toEqual(calculate(c3).totals);
    expect(calculate(c5).totals).toEqual(calculate(c3).totals);
    expect(prepareArlecchinoDamageDocument(c5).gameContext!.attributionPolicy).toContain("不含C2回收爆发、C4回能/Q冷却、C5的Q等级");
  });

  it.each(["baseDamageFormula", "additiveBaseFormula", "damageBonusFormula"] as const)("C5 still retains and blocks a foreign %s", slot => {
    const document = fixture("1", 13, 5), foreign = foreignFormula(); ordinary(document)[slot] = foreign;
    expect(ordinary(prepareArlecchinoDamageDocument(document))[slot]).toEqual(foreign);
    expect(calculate(document).status).toBe("blocked");
  });

  it("preserves old C0 saved formulas and reads C1–C5 JSON without a schema migration", () => {
    const legacy = prepareArlecchinoDamageDocument(fixture());
    const oldFormula = ordinary(legacy).additiveBaseFormula!;
    oldFormula.inputs = oldFormula.inputs.filter(input => input.key !== "arlecchinoC1BondCoefficient");
    oldFormula.expression = expr.sub(expr.mul(expr.input("atk"), expr.input("arlecchinoPreConsumptionBondPercent"), expr.value(.01), expr.input("arlecchinoMasqueCoefficient")), expr.input("arlecchinoIncludedBondBase"));
    oldFormula.requirements!.maximumConstellation = 0;
    const restored = parseCalculatorDocument(serializeCalculatorDocument(legacy));
    expect(calculate(restored).totals!.nonCritical).toBeCloseTo(5681.29086, 8);
    const c3 = parseCalculatorDocument(serializeCalculatorDocument(fixture("1", 13, 3)));
    expect(calculate(c3).totals!.nonCritical).toBeCloseTo(8774.388, 8);
  });

  it.each([[1, 10, .938961, 3.38], [3, 13, 1.1378, 3.884]])("C%i keeps real equipment conversion and historical constellation identity", (constellation, talent, normal, coefficient) => {
    const live = equipmentFixture(constellation, talent), converted = convertedFixture(constellation, talent);
    expect(calculate(live).totals!.nonCritical).toBeCloseTo(2010 * (normal + coefficient * 1.5) * 1.866 * .5 * .9, 9);
    expect(calculate(converted).totals).toEqual(calculate(live).totals);
    expect(ordinary(converted).finalSnapshot!.stats.atk).toBe(2010);
    // C1 -> C2 / C3 -> C4 are supported and numerically identical here, but
    // cannot relabel a previously captured constellation's historical hit.
    converted.gameContext.constellation = constellation + 1;
    expect(reasons(converted)).toContain("历史快照");
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

describe("Arlecchino C6 actual selected normal critical modifier", () => {
  it("pins the actual 20-second hitlag-aware source lifecycle and separately excludes Q", () => {
    expect(arlecchinoPrimarySourceEvidence.contract.c6Critical).toMatchObject({critRateBonus: .1, critDamageBonus: .7,
      triggerSkillTaskFrame: 38, triggerIcdFrames: 900, baseDurationFrames: 1200, affectedByHitlag: true});
    expect(arlecchinoPrimarySourceEvidence.files.find(file => file.path.endsWith("/burst.go"))!.sha256)
      .toBe("6bf3e4030fbd50aaa7ad76d31161789ed458d67c0aa2759d14a50bc3668dafa6");
    const lifecycle = arlecchinoPrimarySourceEvidence.c6LifecycleSources;
    expect(lifecycle.allFilesByteIdentical).toBe(false);
    expect(lifecycle.files.find(file => file.path.endsWith("/mods.go"))!.sha256)
      .toBe("4375291dc9a203a6e87002653a862a708333bcd37cd506574080853ac978f4b1");
    expect(lifecycle.crossVariantFiles.find(file => file.path.endsWith("/mods.go"))!.sha256)
      .toBe("1a9f7efce7e50cbab51a89cb44b63dd5e3541ecfad065448807a426bfd5f14a4");
    const normal = prepareArlecchinoDamageDocument(c6Fixture());
    expect(normal.gameContext!.attributionPolicy).toContain("C6的Q附伤");
    const burst = c6Fixture(); burst.gameContext.skillId = "arlecchino-burst-burst"; burst.gameContext.abilityId = "talent:arlecchino:combat3";
    expect(isArlecchinoDamageAction(burst)).toBe(false);
    expect(prepareArlecchinoDamageDocument(burst)).toBe(burst);
  });

  it("keeps inactive or expired C6 at the exact C5 numerical result, without removing C1 or C3", () => {
    const document = c6Fixture(false), output = calculate(document);
    expect(output.blockers).toEqual([]);
    expect(output.totals!.nonCritical).toBeCloseTo(8774.388, 8);
    expect(output.totals!.critical).toBeCloseTo(17548.776, 8);
    expect(output.totals!.expected).toBeCloseTo(13161.582, 8);
    expect(output.totals).toEqual(calculate(fixture("1", 13, 5)).totals);
    expect(evaluate(ordinary(prepareArlecchinoDamageDocument(document)).critRateFormula!)).toBe(0);
    expect(evaluate(ordinary(prepareArlecchinoDamageDocument(document)).critDamageFormula!)).toBe(0);
  });

  it.each([
    [10, 10140, 7571.29086, 20442.485322, 15294.0075372],
    [13, 11652, 8774.388, 23690.8476, 17724.26376],
  ])("C6 effective NA%i retains independent ATK/bond terms and exact three-column damage", (talent, flat, nonCritical, critical, expected) => {
    const document = c6Fixture(true, talent), prepared = prepareArlecchinoDamageDocument(document), output = calculate(document);
    expect(evaluate(ordinary(prepared).additiveBaseFormula!)).toBe(flat);
    expect(evaluate(ordinary(prepared).critRateFormula!)).toBeCloseTo(.1, 12);
    expect(evaluate(ordinary(prepared).critDamageFormula!)).toBeCloseTo(.7, 12);
    expect(output.blockers).toEqual([]);
    expect(output.totals!.nonCritical).toBeCloseTo(nonCritical, 8);
    expect(output.totals!.critical).toBeCloseTo(critical, 8);
    expect(output.totals!.expected).toBeCloseTo(expected, 8);
    expect(document.gameContext.effectiveTalentLevel).toBe(talent);
  });

  it.each([[0, 0], [10, 70], [4, 20], [10, 0], [0, 70]])("deducts independently included CR %s and CD %s percentage points once", (rate, damage) => {
    const document = c6Fixture();
    if (document.build.mode === "equipment-derived") throw new Error("manual");
    document.build.stats.critRate = .5 + rate / 100; document.build.stats.critDamage = 1 + damage / 100;
    ordinary(document).damageBonus = .4; ordinary(document).additiveBaseDamage = 11652;
    Object.assign(arlecchinoContext(document)!, {passivePyroBonusIncluded: true, includedBondBase: 11652,
      c6CritRateIncludedPercent: rate, c6CritDamageIncludedPercent: damage});
    const output = calculate(document);
    expect(output.blockers).toEqual([]);
    expect(output.totals!.nonCritical).toBeCloseTo(8774.388, 8);
    expect(output.totals!.critical).toBeCloseTo(23690.8476, 8);
    expect(output.totals!.expected).toBeCloseTo(17724.26376, 8);
  });

  it.each([[10, 70], [4, 20]])("removes old included CR %s and CD %s shares when the actual buff is inactive", (rate, damage) => {
    const document = c6Fixture(false);
    if (document.build.mode === "equipment-derived") throw new Error("manual");
    document.build.stats.critRate = .5 + rate / 100; document.build.stats.critDamage = 1 + damage / 100;
    Object.assign(arlecchinoContext(document)!, {c6CritRateIncludedPercent: rate, c6CritDamageIncludedPercent: damage});
    const output = calculate(document);
    expect(output.blockers).toEqual([]);
    expect(output.totals!.critical).toBeCloseTo(17548.776, 8);
    expect(output.totals!.expected).toBeCloseTo(13161.582, 8);
  });

  it.each([[.95, 1, 23690.8476], [-.2, 0, 8774.388]])("lets the shared probability clamp handle input CR %s after the real addition", (rate, expectedRate, expected) => {
    const document = c6Fixture();
    if (document.build.mode === "equipment-derived") throw new Error("manual");
    document.build.stats.critRate = rate;
    const output = calculate(document);
    expect(output.blockers).toEqual([]);
    expect(output.hits[0]!.effectiveCritRate).toBe(expectedRate);
    expect(output.totals!.expected).toBeCloseTo(expected, 8);
    expect(evaluate(ordinary(prepareArlecchinoDamageDocument(document)).critRateFormula!)).toBeCloseTo(.1, 12);
  });

  it.each(["c6Active", "c6CritRateIncludedPercent", "c6CritDamageIncludedPercent"] as const)("blocks missing %s without substituting C5", key => {
    const document = c6Fixture(); delete arlecchinoContext(document)![key];
    expect(calculate(document).status).toBe("blocked");
    expect(calculate(document).totals).toBeUndefined();
    expect(ordinary(prepareArlecchinoDamageDocument(document)).critRateFormula).toBeUndefined();
    expect(arlecchinoRequirementAdapter.collect(document).some(field => field.fieldPath.endsWith(key))).toBe(true);
  });

  it.each([{c6Active: "yes"}, {c6CritRateIncludedPercent: -.1}, {c6CritRateIncludedPercent: 10.0001},
    {c6CritDamageIncludedPercent: 70.0001}, {c6CritDamageIncludedPercent: Number.NaN}])("rejects invalid critical state/accounting %o", context => {
    expect(arlecchinoDamageContextSchema.safeParse(context).success).toBe(false);
  });

  it("never gives an untriggered lower constellation a C6 state or C6 included share", () => {
    const document = c6Fixture(); document.gameContext.constellation = 5;
    expect(calculate(document).status).toBe("blocked");
    expect(reasons(document)).toContain("当前命座未解锁C6");
    arlecchinoContext(document)!.c6Active = false;
    arlecchinoContext(document)!.c6CritDamageIncludedPercent = 20;
    expect(calculate(document).status).toBe("blocked");
  });

  it.each(["baseDamageFormula", "additiveBaseFormula", "damageBonusFormula", "critRateFormula", "critDamageFormula"] as const)("C6 retains and blocks unmerged external %s", slot => {
    const document = c6Fixture(), foreign = foreignFormula(); ordinary(document)[slot] = foreign;
    const prepared = prepareArlecchinoDamageDocument(document);
    expect(ordinary(prepared)[slot]).toEqual(foreign);
    expect(calculate(prepared).status).toBe("blocked");
    expect(calculate(prepared).totals).toBeUndefined();
  });

  it("preserves independent legal ATK/EM adjustments and rejects a copied C6 hit", () => {
    const document = c6Fixture();
    ordinary(document).attackAdjustment = {accounting: "add-to-panel", formula: {ruleId: "legal-external-atk", label: "External ATK +250", expression: expr.value(250), inputs: [], sourceRefs: ARLECCHINO_DAMAGE_SOURCE_REFS}};
    ordinary(document).elementalMasteryAdjustment = {accounting: "add-to-panel", formula: {ruleId: "legal-external-em", label: "External EM +300", expression: expr.value(300), inputs: [], sourceRefs: ARLECCHINO_DAMAGE_SOURCE_REFS}};
    const prepared = prepareArlecchinoDamageDocument(document);
    expect(ordinary(prepared).attackAdjustment).toEqual(ordinary(document).attackAdjustment);
    expect(ordinary(prepared).elementalMasteryAdjustment).toEqual(ordinary(document).elementalMasteryAdjustment);
    expect(calculate(prepared).totals!.expected).toBeCloseTo(2250 * (1.1378 + 3.884 * 1.5) * .63 * 2.02, 8);
    ordinary(document).groupMultiplier = 2;
    expect(calculate(document).status).toBe("blocked");
    expect(calculate(document).totals).toBeUndefined();
  });

  it("keeps the exact 30 percent boundary and separately rejects disabled critical eligibility", () => {
    const document = c6Fixture(); arlecchinoContext(document)!.bondOfLifePercent = 30;
    expect(calculate(document).totals!.nonCritical).toBeCloseTo(2901.78, 8);
    expect(calculate(document).totals!.expected).toBeCloseTo(5861.5956, 8);
    arlecchinoContext(document)!.bondOfLifePercent = 29.999999;
    expect(calculate(document).status).toBe("blocked");
    const noCrit = c6Fixture(); ordinary(noCrit).critEligible = false;
    expect(calculate(noCrit).status).toBe("blocked");
  });

  it.each([false, true])("preserves real equipment conversion and JSON with actual C6 active=%s", active => {
    const document = equipmentFixture(6, 13); arlecchinoContext(document)!.c6Active = active;
    const before = calculate(document), converted = convertCalculatorToFinalPanel(document);
    expect(before.blockers).toEqual([]);
    expect(before.totals!.nonCritical).toBeCloseTo(2010 * (1.1378 + 3.884 * 1.5) * 1.866 * .5 * .9, 8);
    expect(before.totals!.expected).toBeCloseTo(before.totals!.nonCritical * (active ? 2.02 : 1.5), 8);
    expect(ordinary(converted).effectiveCritRate).toBeCloseTo(active ? .6 : .5, 12);
    expect(ordinary(converted).effectiveCritDamage).toBeCloseTo(active ? 1.7 : 1, 12);
    expect(calculate(converted).totals).toEqual(before.totals);
    expect(calculate(parseCalculatorDocument(serializeCalculatorDocument(converted))).totals).toEqual(before.totals);
  });

  it.each(["c6Active", "c6CritRateIncludedPercent", "c6CritDamageIncludedPercent", "character-level", "final-crit-rate", "final-crit-damage"] as const)("rejects changed converted C6 %s rather than replaying an old crit panel", change => {
    const document = equipmentFixture(6, 13); arlecchinoContext(document)!.c6Active = true;
    const converted = convertCalculatorToFinalPanel(document);
    if (change === "c6Active") arlecchinoContext(converted)!.c6Active = false;
    else if (change === "character-level") converted.characterLevel = 100;
    else if (change === "final-crit-rate") ordinary(converted).effectiveCritRate = .7;
    else if (change === "final-crit-damage") ordinary(converted).effectiveCritDamage = 2;
    else arlecchinoContext(converted)![change] = 1;
    expect(reasons(converted)).toContain("历史快照");
    expect(calculate(converted).status).toBe("blocked");
    expect(calculate(converted).totals).toBeUndefined();
  });

  it("keeps the pre-C6 converted identity and reads old C6 JSON as missing actual state", () => {
    const old = convertedFixture(5, 13), expected = calculate(old).totals;
    delete arlecchinoContext(old)!.c6Active; delete arlecchinoContext(old)!.c6CritRateIncludedPercent; delete arlecchinoContext(old)!.c6CritDamageIncludedPercent;
    const context = arlecchinoContext(old)!, game = old.gameContext;
    expect(context.finalizedHitStates![ordinary(old).id]).toBe(JSON.stringify([game.characterId, old.characterLevel, game.abilityId, game.skillId,
      game.effectiveTalentLevel, game.constellation, 6, ordinary(old).id, context.bondOfLifePercent, context.passivePyroBonusIncluded, context.includedBondBase]));
    expect(calculate(parseCalculatorDocument(serializeCalculatorDocument(old))).totals).toEqual(expected);
    const unknown = fixture("1", 13, 6), restored = parseCalculatorDocument(serializeCalculatorDocument(unknown));
    expect(calculate(restored).status).toBe("blocked");
    expect(calculate(restored).totals).toBeUndefined();
  });

  it("rebuilds owned crit formulas idempotently and never treats a familiar prefix as ownership", () => {
    const document = prepareArlecchinoDamageDocument(c6Fixture());
    ordinary(document).critRateFormula!.inputs[0]!.value = 0;
    ordinary(document).critDamageFormula!.inputs[1]!.value = 70;
    const prepared = prepareArlecchinoDamageDocument(document);
    expect(evaluate(ordinary(prepared).critRateFormula!)).toBeCloseTo(.1, 12);
    expect(evaluate(ordinary(prepared).critDamageFormula!)).toBeCloseTo(.7, 12);
    expect(prepareArlecchinoDamageDocument(prepared)).toEqual(prepared);
    ordinary(document).critDamageFormula = foreignFormula("arlecchino-damage-c6-foreign");
    expect(calculate(document).status).toBe("blocked");
  });

  it("renders and updates all C6 actual conditions with generic controls and no invented trigger", () => {
    const document = initializeArlecchinoDamageDocument(fixture("1", 13, 6));
    expect(arlecchinoContext(document)!.c6Active).toBeUndefined();
    expect(arlecchinoContext(document)!.c6CritRateIncludedPercent).toBe(0);
    expect(calculate(document).status).toBe("blocked");
    const html = renderArlecchinoControls(document);
    expect(html).toContain('data-source-cast-state-field="gameContext.arlecchinoDamage.c6Active"');
    expect(html).toContain('data-field="gameContext.arlecchinoDamage.c6CritRateIncludedPercent"');
    expect(html).toContain('data-field="gameContext.arlecchinoDamage.c6CritDamageIncludedPercent"');
    expect(html).toContain("20秒");
    expect(updateArlecchinoDamageControl(document, "gameContext.arlecchinoDamage.c6Active", "1")).toBe(true);
    updateArlecchinoDamageControl(document, "gameContext.arlecchinoDamage.c6CritRateIncludedPercent", "3.5");
    updateArlecchinoDamageControl(document, "gameContext.arlecchinoDamage.c6CritDamageIncludedPercent", "20");
    expect(arlecchinoContext(document)!).toMatchObject({c6Active: true, c6CritRateIncludedPercent: 3.5, c6CritDamageIncludedPercent: 20});
    expect(() => updateArlecchinoDamageControl(document, "gameContext.arlecchinoDamage.c6CritRateIncludedPercent", "11")).toThrow();
    updateArlecchinoDamageControl(document, "gameContext.arlecchinoDamage.c6Active", "unknown");
    expect(arlecchinoContext(document)!.c6Active).toBeUndefined();
  });

  it("clears unknown imported C6 accounting but derives fresh-equipment shares without triggering C6", () => {
    const document = c6Fixture(); resetArlecchinoPanelAccounting(document, "imported-final");
    expect(arlecchinoContext(document)!.c6Active).toBeUndefined();
    expect(arlecchinoContext(document)!.c6CritRateIncludedPercent).toBeUndefined();
    expect(arlecchinoContext(document)!.c6CritDamageIncludedPercent).toBeUndefined();
    const html = renderArlecchinoControls(document), fields = arlecchinoRequirementAdapter.collect(document);
    for (const key of ["c6Active", "c6CritRateIncludedPercent", "c6CritDamageIncludedPercent"]) {
      expect(fields.some(field => field.fieldPath.endsWith(key))).toBe(true);
      expect(html).toContain(`="gameContext.arlecchinoDamage.${key}"`);
    }
    resetArlecchinoPanelAccounting(document, "fresh-equipment");
    expect(arlecchinoContext(document)!.c6CritRateIncludedPercent).toBe(0);
    expect(arlecchinoContext(document)!.c6CritDamageIncludedPercent).toBe(0);
    expect(arlecchinoContext(document)!.c6Active).toBeUndefined();
  });

  it("rejects out-of-source factory accounting", () => {
    expect(() => createArlecchinoC6CriticalFormula("critRate", true, 10.1)).toThrow();
    expect(() => createArlecchinoC6CriticalFormula("critDamage", false, -1)).toThrow();
    expect(() => createArlecchinoC6CriticalFormula("critDamage", true, Number.NaN)).toThrow();
  });
});
