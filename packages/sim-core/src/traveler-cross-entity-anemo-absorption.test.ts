import { describe, expect, it } from "vitest";
import { travelerCrossSourceTemplates } from "../../game-data/src/character-mappings/traveler-cross-source-mappings";
import { calculateDocument, convertCalculatorToFinalPanel } from "./calculator";
import { parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument } from "./calculator-model";
import { prepareTravelerCrossEntityCastDocument, resetTravelerCrossEntityPanelAccounting, travelerAnemoConstellationScope } from "./traveler-cross-entity-formulas";
import { compileTravelerCrossEntitySchedule, type TravelerCrossEntityCastKind } from "./traveler-cross-entity-schedule";
import { expr } from "./calculation-trace";
import { TRAVELER_ANEMO_ABSORPTION_EVIDENCE, travelerAnemoAbsorbedCoefficient } from "./traveler-cross-entity-anemo-source";

function fixture(gender = "aether", constellation = 0): CalculatorDocument {
  const cast = travelerCrossSourceTemplates.find(row => row.skillId === `traveler-cross-${gender}-anemo-burst-c0`)!;
  return {
    schemaVersion: "1.0.0", ruleVersion: "ordinary-trace-v1", id: "traveler-anemo-explicit-source-unit", label: "Explicit fixed-source fixture; not a player capture",
    gameContext: {characterId: gender === "aether" ? "character:10000005" : "character:10000007", characterName: "旅行者", variantId: `${gender}-anemo`,
      abilityId: "talent:traveleranemo:combat3", skillId: cast.skillId, skillName: cast.label, effectiveTalentLevel: 10, constellation,
      ascension: 6, scopeCoverage: "single-hit", attributionPolicy: "One explicitly occurring direct hit",
      travelerCrossEntityCast: {trueMoonStoryBuffInactive: true}},
    scope: "single-hit", characterLevel: 90,
    build: {mode: "manual-final", ascension: 6, source: "Actual Q-start panel", stats: {atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1}},
    enemy: {level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0},
    hits: [{id: cast.roles.tick.mappingId, kind: "ordinary", label: cast.roles.tick.label, element: "anemo", attackTag: "burst",
      terms: [{stat: "atk", coefficient: 1.4544}], additiveBaseDamage: 0, damageBonus: 0, critEligible: true,
      reaction: "none", reactionBonus: 0, groupMultiplier: 1, dependencies: [], sourceRefs: cast.roles.tick.sourceRefs}],
    selectedHitIds: [cast.roles.tick.mappingId], assumptions: [], dependencies: [],
    dataIdentity: {datasetId: "explicit-fixed-source-unit", gameVersion: "source-pin", releaseStatus: "released", evidenceStatus: "provisional"},
  };
}
function complete(constellation = 0, absorptionStartFrame = 39): CalculatorDocument {
  const document = fixture("aether", constellation), context = document.gameContext!.travelerCrossEntityCast!;
  document.scope = "one-cast";
  Object.assign(context, {casterId: "actual-traveler", targetId: "actual-target", freshCastConfirmed: true, noHitlag: true,
    noInterruption: true, noReplacement: true, fullObservedLifetime: true, observedThroughFrame: 363, statsStableAcrossHits: true,
    anemo: {noAbsorption: false, absorptionElement: "pyro", absorptionStartFrame, elementDamageBonuses: {pyro: .5}, c6InitiallyInactive: true},
    sharedState: {includedC6ResistanceReduction: 0},
    targetContacts: Object.fromEntries(Array.from({length: 9}, (_, i) => [[`tick-${i + 1}`, true], [`absorb-${i + 1}`, true]]).flat())});
  return document;
}
const contextOf = (document: CalculatorDocument) => document.gameContext!.travelerCrossEntityCast!;
const ordinary = (document: CalculatorDocument, index = 0) => {
  const hit = document.hits[index]!; if (hit.kind !== "ordinary") throw new Error("ordinary hit required"); return hit;
};
const schedule = (document: CalculatorDocument) => compileTravelerCrossEntitySchedule(document.gameContext!.skillId as TravelerCrossEntityCastKind,
  contextOf(document), document.gameContext!.constellation);
const reasons = (document: CalculatorDocument) => { const result = calculateDocument(document); expect(result.status).toBe("blocked"); return result.blockers.join("；"); };
function absorbedSingle(constellation = 0): CalculatorDocument {
  const document = fixture("aether", constellation);
  contextOf(document).anemo = {singleHitRole: "absorbed-tick", noAbsorption: false, absorptionElement: "pyro", elementDamageBonuses: {pyro: .5}};
  if (constellation >= 6) contextOf(document).sharedState = {c6ActiveBeforeHit: false, includedC6ResistanceReduction: 0};
  return document;
}
const foreign = () => ({ruleId: "foreign-unmerged", label: "External explicit formula", expression: expr.value(12345), inputs: [], sourceRefs: ["explicit-unit-source"]});

describe("Traveler Anemo actual absorption and C6 fixed-source branches", () => {
  it("calculates actual absorbed direct hits rather than only relabeling the no-absorption branch", () => {
    const result = calculateDocument(complete());
    expect(result.status).toBe("calculated");
    expect(result.hits).toHaveLength(18);
    expect(result.totals!.nonCritical).toBeCloseTo(9 * (1308.96 + 602.64), 8);
  });
  it("does not reject a C6 already-occurring hit with explicitly inactive pre-hit shred", () => {
    const document = fixture("aether", 6);
    document.gameContext!.travelerCrossEntityCast!.sharedState = {c6ActiveBeforeHit: false, includedC6ResistanceReduction: 0};
    const result = calculateDocument(document);
    expect(result.status).toBe("calculated");
    expect(result.totals!.nonCritical).toBeCloseTo(1308.96, 8);
  });
  it.each(["aether", "lumine"])("keeps legacy unabsorbed C0 %s single-hit and full-cast arithmetic", gender => {
    const single = fixture(gender);
    expect(calculateDocument(single).totals!.nonCritical).toBeCloseTo(1308.96, 8);
    const full = complete(); full.gameContext = {...full.gameContext!, ...single.gameContext!, travelerCrossEntityCast: contextOf(full)};
    contextOf(full).anemo = {noAbsorption: true};
    const result = calculateDocument(full);
    expect(result.status).toBe("calculated"); expect(result.hits).toHaveLength(9);
    expect(result.totals!.nonCritical).toBeCloseTo(11780.64, 8);
    expect(schedule(full).requiredObservedThroughFrame).toBe(363);
  });
  it.each(["aether", "lumine"])("calculates C6 %s first pair before callbacks, later pairs with independent non-stacking shred", gender => {
    const document = complete(6);
    if (gender === "lumine") {
      const f = fixture(gender, 6); Object.assign(document.gameContext!, {characterId: f.gameContext!.characterId, variantId: f.gameContext!.variantId, skillId: f.gameContext!.skillId});
    }
    const result = calculateDocument(document);
    expect(result.status).toBe("calculated"); expect(result.hits).toHaveLength(18);
    [1308.96, 602.64, ...Array.from({length: 8}, () => [1527.12, 703.08]).flat()].forEach((expected, index) => expect(result.hits[index]!.nonCritical).toBeCloseTo(expected, 8));
    expect(result.totals!.nonCritical).toBeCloseTo(19753.2, 8);
    expect(result.totals!.critical).toBeCloseTo(39506.4, 8);
    expect(result.totals!.expected).toBeCloseTo(29629.8, 8);
    const events = schedule(document).instances;
    expect(events.slice(0, 2).map(event => [event.templateRole, event.c6ActiveBeforeHit])).toEqual([["tick", false], ["absorbed-tick", false]]);
    expect(events.slice(2).every(event => event.c6ActiveBeforeHit)).toBe(true);
    expect(events.filter(event => event.templateRole === "absorbed-tick").every(event => event.snapshotId === "snapshot-0-absorbed-pyro")).toBe(true);
  });
  it.each([[39, 9], [93, 9], [111, 8], [327, 1], [345, 0]])("generates only the %i-check's %i later absorbed opportunities", (start, count) => {
    const document = complete(0, start), result = calculateDocument(document);
    expect(result.status).toBe("calculated"); expect(result.hits).toHaveLength(9 + count);
    expect(result.totals!.nonCritical).toBeCloseTo(11780.64 + count * 602.64, 8);
    expect(schedule(document).instances.filter(event => event.templateRole === "absorbed-tick").every(event => event.frame >= start)).toBe(true);
  });
  it.each([38, 94, 346, 93.5])("rejects a non-check absorption frame %s instead of rounding", start => {
    const document = complete(0, start);
    if (Number.isInteger(start)) expect(calculateDocument(document).status).toBe("blocked");
    else expect(() => calculateDocument(document)).toThrow();
  });
  it("stops the absorption recursion observation requirement after success, retaining actual source lifecycle", () => {
    const document = complete(); contextOf(document).observedThroughFrame = 336;
    expect(schedule(document).requiredObservedThroughFrame).toBe(336);
    expect(calculateDocument(document).status).toBe("calculated");
    contextOf(document).observedThroughFrame = 335; expect(calculateDocument(document).status).toBe("blocked");
    const late = complete(0, 345); contextOf(late).observedThroughFrame = 345;
    expect(schedule(late).requiredObservedThroughFrame).toBe(345);
    expect(schedule(late).decisions.some(row => row.frame === 363)).toBe(false);
    expect(calculateDocument(late).hits).toHaveLength(9);
  });
  it.each(["tick-1", "absorb-1"])("does not let a missed %s apply its element's C6 to the next pair", missed => {
    const document = complete(6); contextOf(document).targetContacts![missed] = false;
    const plan = schedule(document), secondPair = plan.instances.filter(event => event.frame === 124);
    expect(secondPair.find(event => event.templateRole === (missed === "tick-1" ? "tick" : "absorbed-tick"))!.c6ActiveBeforeHit).toBe(false);
    expect(secondPair.find(event => event.templateRole !== (missed === "tick-1" ? "tick" : "absorbed-tick"))!.c6ActiveBeforeHit).toBe(true);
    const result = calculateDocument(document);
    expect(result.status).toBe("calculated"); expect(result.hits).toHaveLength(17);
    expect(result.hits.filter(hit => hit.id.endsWith(missed === "tick-1" ? ":tick-2" : ":absorb-2"))[0]!.nonCritical).toBeCloseTo(missed === "tick-1" ? 1308.96 : 602.64, 8);
  });
  it("late absorption cannot inherit wind C6 on its first absorbed hit", () => {
    const result = calculateDocument(complete(6, 111));
    expect(result.status).toBe("calculated");
    expect(result.hits[1]!.nonCritical).toBeCloseTo(1527.12, 8);
    expect(result.hits[2]!.nonCritical).toBeCloseTo(602.64, 8);
    expect(result.hits[4]!.nonCritical).toBeCloseTo(703.08, 8);
  });
  it.each([1, 2, 3, 4, 5])("C%i does not duplicate effective talent bonuses or add unrelated direct hits", constellation => {
    const document = complete(constellation); document.gameContext!.effectiveTalentLevel = 13;
    const result = calculateDocument(document);
    expect(result.status).toBe("calculated"); expect(result.hits).toHaveLength(18);
    expect(ordinary(prepareTravelerCrossEntityCastDocument(document)).terms[0]!.coefficient).toBe(1.717);
    expect(result.totals!.nonCritical).toBeCloseTo(9 * (2000 * 1.717 * .5 * .9 + 2000 * .527 * 1.5 * .5 * .9), 8);
  });
  it("independent absorbed single hit does not demand a future schedule", () => {
    const document = absorbedSingle();
    const result = calculateDocument(document);
    expect(result.status).toBe("calculated"); expect(result.hits).toHaveLength(1);
    expect(result.totals!.nonCritical).toBeCloseTo(602.64, 8);
    expect(contextOf(document).anemo!.absorptionStartFrame).toBeUndefined();
    expect(contextOf(document).targetContacts).toBeUndefined();
    expect(contextOf(document).fullObservedLifetime).toBeUndefined();
  });
  it.each([[false, 0, .1, 602.64], [true, 0, .1, 703.08], [true, .2, -.1, 703.08], [true, .1, 0, 703.08], [false, .2, -.1, 602.64]])(
    "accounts actual single C6 active=%s included=%s without duplicate shred", (active, included, resistance, expected) => {
      const document = absorbedSingle(6); Object.assign(contextOf(document).sharedState!, {c6ActiveBeforeHit: active, includedC6ResistanceReduction: included});
      document.enemy.resistance = resistance;
      const result = calculateDocument(document);
      expect(result.status).toBe("calculated"); expect(result.totals!.nonCritical).toBeCloseTo(expected, 8);
    });
  it("requires independent C6 state and full initial-state qualification rather than treating C6 as already triggered", () => {
    const single = absorbedSingle(6); delete contextOf(single).sharedState!.c6ActiveBeforeHit;
    expect(reasons(single)).toContain("本击结算前");
    const full = complete(6); delete contextOf(full).anemo!.c6InitiallyInactive;
    expect(reasons(full)).toContain("没有既有本命座减抗");
    contextOf(full).anemo!.c6InitiallyInactive = false; expect(calculateDocument(full).status).toBe("blocked");
    const c5 = absorbedSingle(5); contextOf(c5).sharedState = {c6ActiveBeforeHit: true, includedC6ResistanceReduction: .2};
    expect(calculateDocument(c5).status).toBe("blocked");
  });
  it("rejects missing elemental bonus, missing/contradictory element, and pre-absorption events", () => {
    const unknown = absorbedSingle(); delete contextOf(unknown).anemo!.elementDamageBonuses;
    expect(reasons(unknown)).toContain("实际最终伤害加成");
    const missing = absorbedSingle(); delete contextOf(missing).anemo!.absorptionElement;
    expect(calculateDocument(missing).status).toBe("blocked");
    const contradiction = absorbedSingle(); contextOf(contradiction).anemo!.noAbsorption = true;
    expect(calculateDocument(contradiction).status).toBe("blocked");
    const event = absorbedSingle(); contextOf(event).anemo!.absorptionStartFrame = 111;
    contextOf(event).independentEvent = {candidateId: "actual-first-pair", templateRole: "absorbed-tick", absorbedElement: "pyro", frame: 94, snapshotFrame: 0, snapshotId: "actual-q-start-pyro", targetId: "actual-target"};
    expect(reasons(event)).toContain("成功吸收之前");
  });
  it("keeps imported element numbers distinct from zero/null and manual element inputs", () => {
    const document = absorbedSingle(); document.build.mode = "imported-final";
    delete contextOf(document).anemo!.elementDamageBonuses;
    document.gameContext!.importedPanelDamageBonuses = {physical: 0, pyro: .5, hydro: .2, cryo: .3, electro: .4, anemo: .9, dendro: 0, geo: 0};
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(602.64, 8);
    document.gameContext!.importedPanelDamageBonuses.pyro = 0;
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(401.76, 8);
    document.gameContext!.importedPanelDamageBonuses.pyro = null;
    expect(calculateDocument(document).status).toBe("blocked");
    contextOf(document).anemo!.elementDamageBonuses = {pyro: .7};
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(682.992, 8);
  });
  it("uses equipment element filters and retains all results through actual conversion and JSON", () => {
    const document = complete(6);
    document.build = {mode: "equipment-derived", characterBaseAtk: 1000, weaponBaseAtk: 1000, atkPercent: 0, flatAtk: 0,
      baseHp: 20000, hpPercent: 0, flatHp: 0, baseDef: 800, defPercent: 0, flatDef: 0, em: 0, critRate: .5, critDamage: 1,
      equipment: {characterId: "character:10000005", weaponId: "explicit-unit-sword", level: 90, ascension: 6, weaponLevel: 90, weaponAscension: 6,
        refinement: 1, sourceVersion: "explicit-unit", sourceRefs: ["explicit-unit-equipment"], derivedStats: [], secondaryContributions: [], assumptions: [], effectBlockers: [], bonusAccounting: "core-sourced-v1",
        hitBonuses: [{id: "unit-pyro", value: .5, elements: ["pyro"], label: "Explicit Pyro gear", sourceRef: "explicit-unit"}, {id: "unit-anemo", value: .4, elements: ["anemo"], label: "Explicit Anemo gear", sourceRef: "explicit-unit"}]}};
    delete contextOf(document).anemo!.elementDamageBonuses;
    resetTravelerCrossEntityPanelAccounting(document, "fresh-equipment");
    const result = calculateDocument(document);
    expect(result.status).toBe("calculated");
    expect(result.hits[0]!.nonCritical).toBeCloseTo(1832.544, 8);
    expect(result.hits[1]!.nonCritical).toBeCloseTo(602.64, 8);
    const restored = parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(document)));
    expect(calculateDocument(restored).totals).toEqual(result.totals);
    const mutated = structuredClone(restored); mutated.characterLevel = 100;
    expect(calculateDocument(mutated).status).toBe("blocked");
    const element = structuredClone(restored); contextOf(element).anemo!.absorptionElement = "hydro";
    expect(calculateDocument(element).status).toBe("blocked");
    const c6 = structuredClone(restored); contextOf(c6).targetContacts!["absorb-1"] = false;
    expect(calculateDocument(c6).status).toBe("blocked");
  });
  it("rejects foreign base replacement, duplicate multipliers and C6 same-slot conflicts while keeping unrelated attack adjustment", () => {
    const base = fixture(); ordinary(base).baseDamageFormula = foreign(); expect(reasons(base)).toContain("基础伤害公式覆盖");
    const grouped = fixture(); ordinary(grouped).groupMultiplier = 2; expect(reasons(grouped)).toContain("命中倍率必须为1");
    const c6 = fixture("aether", 6); contextOf(c6).sharedState = {c6ActiveBeforeHit: true, includedC6ResistanceReduction: 0};
    ordinary(c6).resistanceReductionFormula = foreign(); expect(reasons(c6)).toContain("外来公式");
    expect(ordinary(prepareTravelerCrossEntityCastDocument(c6)).resistanceReductionFormula!.ruleId).toBe("foreign-unmerged");
    const attack = fixture(); ordinary(attack).attackAdjustment = {accounting: "add-to-panel", formula: {...foreign(), expression: expr.value(100)}};
    expect(ordinary(prepareTravelerCrossEntityCastDocument(attack)).attackAdjustment).toEqual(ordinary(attack).attackAdjustment);
    expect(calculateDocument(attack).totals!.nonCritical).toBeCloseTo(2100 * 1.4544 * .5 * .9, 8);
  });
  it("strict scope helper rejects borrowed identities, wrong form/ability and foreign ordinary hits", () => {
    const valid = prepareTravelerCrossEntityCastDocument(absorbedSingle(6));
    expect(travelerAnemoConstellationScope(valid, valid.hits[0])!.allowed).toBe(true);
    for (const field of ["characterId", "variantId", "abilityId"] as const) {
      const changed = structuredClone(valid); changed.gameContext![field] = "borrowed";
      expect(travelerAnemoConstellationScope(changed, changed.hits[0])!.allowed).toBe(false);
      expect(calculateDocument(changed).status).toBe("blocked");
    }
    const foreignHit = {...ordinary(valid), id: "outside-hit"};
    expect(travelerAnemoConstellationScope(valid, foreignHit)!.allowed).toBe(false);
    const other = fixture(); other.gameContext!.skillId = "traveler-cross-aether-dendro-burst-c0";
    expect(travelerAnemoConstellationScope(other)).toBeUndefined();
  });
  it("uses both exact Optimizer15-level vectors and preserves the independent Go coefficient conflict", () => {
    const {coefficients} = TRAVELER_ANEMO_ABSORPTION_EVIDENCE;
    expect(coefficients.optimizerM).toEqual(coefficients.optimizerF);
    expect(coefficients.optimizerM).toHaveLength(15);
    coefficients.optimizerM.forEach((coefficient, index) => expect(travelerAnemoAbsorbedCoefficient(index + 1)).toBe(coefficient));
    expect(coefficients.optimizerM[9]).toBe(.4464); expect(coefficients.gcsimConflictPreserved[9]).toBe(.3384);
    expect(travelerAnemoAbsorbedCoefficient(16)).toBeUndefined();
  });
});
