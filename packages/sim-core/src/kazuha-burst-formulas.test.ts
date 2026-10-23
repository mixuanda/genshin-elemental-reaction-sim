import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { findTalentSetById } from "../../game-data/src/catalog";
import manifest from "../../game-data/sources/kazuha-burst/manifest.json";
import { kazuhaBurstMappings } from "../../game-data/src/character-mappings/kazuha-burst-mappings";
import type { CalculatorDocument } from "./calculator-model";
import { calculateDocument, convertCalculatorToFinalPanel } from "./calculator";
import { evaluateFormulaExpression, expr } from "./calculation-trace";
import { kazuhaBurstContextSchema, type KazuhaBurstContext } from "./kazuha-burst-context";
import {
  captureKazuhaImportedDamageBonuses, createKazuhaA4DamageBonusFormula, finalizeKazuhaBurstPanelAccounting,
  kazuhaBurstContext, kazuhaBurstHitPlan, prepareKazuhaBurstDocument, resetKazuhaBurstPanelAccounting,
  type KazuhaCalculatorDocument,
} from "./kazuha-burst-formulas";
import { KAZUHA_BURST_SOURCE_REFS } from "./kazuha-burst-source-values";
import { applyKazuhaControl, kazuhaBurstRequirementAdapter, renderKazuhaControls } from "../../../apps/web/src/calculator-kazuha-controls";
import { initializeKazuhaBurstDocument } from "../../../apps/web/src/kazuha-calculation-context";

function fixture(skillId = "kazuha-burst-complete", context: KazuhaBurstContext = {}, level = 10): KazuhaCalculatorDocument {
  const mappings = kazuhaBurstMappings.filter(row => row.skillId === skillId);
  return {
    schemaVersion: "1.0.0", ruleVersion: "ordinary-trace-v1", id: `test:${skillId}`, label: "Fixed-source Kazuha Q unit fixture",
    gameContext: {characterId: "character:10000047", characterName: "枫原万叶", abilityId: "talent:kaedeharakazuha:combat3", skillId,
      skillName: skillId, effectiveTalentLevel: level, constellation: 0, ascension: 6,
      scopeCoverage: skillId === "kazuha-burst-complete" ? "complete-cast" : "single-hit", attributionPolicy: "Explicit direct-damage fixture",
      kazuhaBurst: {absorptionElement: "none", allHitsConnected: true, statsStableAcrossSnapshots: true, includedA4DamageBonus: 0, ...context}},
    scope: skillId === "kazuha-burst-complete" ? "one-cast" : "single-hit", characterLevel: 90,
    build: {mode: "manual-final", ascension: 6, source: "Explicit unit panel, not a player build", stats: {atk: 2000, hp: 20000, def: 800, em: 9999, critRate: .5, critDamage: 1}},
    enemy: {level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0},
    hits: mappings.map(row => ({id: row.id, label: row.hitLabel, kind: "ordinary", element: "anemo", attackTag: "burst",
      terms: [{stat: "atk", coefficient: row.sourceCoefficientValues![level - 1]!}], additiveBaseDamage: 0, damageBonus: .466,
      critEligible: true, reaction: "none", reactionBonus: 0, groupMultiplier: 1, sourceRefs: KAZUHA_BURST_SOURCE_REFS, dependencies: []})),
    selectedHitIds: mappings.map(row => row.id), assumptions: [], dependencies: [],
    dataIdentity: {datasetId: "unit-fixed-source", gameVersion: "unit", releaseStatus: "released", evidenceStatus: "provisional"},
  };
}

/** Shared model wiring belongs to the parent. Remove only the unregistered
 * context after preparing, then execute the real shared formula engine. */
function forUnwiredSharedCore(document: CalculatorDocument): CalculatorDocument {
  const result = structuredClone(document) as KazuhaCalculatorDocument;
  delete result.gameContext.kazuhaBurst;
  return result;
}
const calculate = (document: CalculatorDocument) => calculateDocument(forUnwiredSharedCore(prepareKazuhaBurstDocument(document)));
const issues = (document: CalculatorDocument) => prepareKazuhaBurstDocument(document).dependencies.filter(row => row.status === "missing").map(row => row.reason).join("；");
function absorbed(context: KazuhaBurstContext = {}): KazuhaBurstContext {
  return {absorptionElement: "pyro", absorptionStartFrame: 81, priorA4Active: false, includedA4DamageBonus: 0, elementDamageBonuses: {pyro: .2}, ...context};
}

describe("Kazuha pinned direct Q source and scheduling", () => {
  it("verifies immutable originals and every talent level against the catalog", () => {
    for (const row of manifest.files) {
      const raw = readFileSync(new URL(`../../game-data/sources/kazuha-burst/source/${row.revision}/${row.path}`, import.meta.url));
      expect(createHash("sha256").update(raw).digest("hex")).toBe(row.sha256);
      expect(createHash("sha1").update(`blob ${raw.length}\0`).update(raw).digest("hex")).toBe(row.gitBlob);
    }
    const ability = findTalentSetById("talent-set:kaedeharakazuha")!.abilities.find(row => row.key === "combat3")!;
    for (const vector of manifest.coefficients) expect(ability.parameters[vector.parameterKey], vector.parameterKey).toEqual(vector.values);
    expect(manifest.coefficients.map(row => row.values[9])).toEqual([4.7232, 2.16, .648]);
  });

  it("keeps the 82f slash separate from the 81f DoT snapshots and ownership", () => {
    const document = prepareKazuhaBurstDocument(fixture()) as KazuhaCalculatorDocument;
    expect(document.hits).toHaveLength(6);
    expect(Object.values(kazuhaBurstContext(document)!.hitEvents!).map(event => [event.frame, event.snapshotFrame, event.ownerId])).toEqual([
      [82, 82, "character:10000047"], [140, 81, "character:10000047"], [257, 81, "character:10000047"],
      [374, 81, "character:10000047"], [491, 81, "character:10000047"], [608, 81, "character:10000047"],
    ]);
  });

  it.each([[81, 5], [135, 5], [153, 4], [243, 4], [261, 3], [369, 3]])("first absorption at %if generates exactly %i elemental ticks", (start, count) => {
    const events = kazuhaBurstHitPlan("kazuha-burst-complete", absorbed({absorptionStartFrame: start}));
    expect(events.filter(event => event.role === "absorbed-dot")).toHaveLength(count);
    for (const event of events.filter(event => event.role === "absorbed-dot")) {
      expect(event.frame).toBeGreaterThanOrEqual(start);
      expect(events[events.indexOf(event) + 1]).toMatchObject({frame: event.frame, role: "anemo-dot", element: "anemo", snapshotFrame: 81});
    }
  });

  it.each([80, 82, 140, 257, 370, 81.5])("rejects a fabricated/noninteger absorption check %s", frame => {
    expect(kazuhaBurstContextSchema.safeParse({absorptionStartFrame: frame}).success).toBe(false);
  });

  it("does not create absorbed hits from an unknown absorption time", () => {
    const unknown = fixture("kazuha-burst-complete", absorbed());
    delete kazuhaBurstContext(unknown)!.absorptionStartFrame;
    expect(prepareKazuhaBurstDocument(unknown).hits).toHaveLength(6);
    expect(calculate(unknown).status).toBe("blocked");
    expect(issues(unknown)).toContain("不能默认五次");
  });
});

describe("Kazuha direct Q numerical execution", () => {
  it.each([["kazuha-burst-slash", 4.7232], ["kazuha-burst-anemo-dot", 2.16]])("executes %s with its independent Q10 multiplier", (id, multiplier) => {
    const result = calculate(fixture(id));
    expect(result.blockers).toEqual([]);
    expect(result.totals!.nonCritical).toBeCloseTo(2000 * multiplier * 1.466 * .5 * .9, 9);
  });

  it("sums exactly the initial plus five wind ticks without absorption", () => {
    const result = calculate(fixture());
    expect(result.blockers).toEqual([]);
    expect(result.aggregation.scope).toBe("complete-cast");
    expect(result.totals!.nonCritical).toBeCloseTo(2000 * (4.7232 + 5 * 2.16) * 1.466 * .5 * .9, 9);
    expect(result.totals!.expected).toBeCloseTo(result.totals!.nonCritical * 1.5, 9);
  });

  it.each([["pyro", .1], ["hydro", .25], ["electro", .4], ["cryo", .55]] as const)("keeps %s %.2f separate from the wind bonus", (element, bonus) => {
    const document = fixture("kazuha-burst-complete", absorbed({absorptionElement: element, elementDamageBonuses: {[element]: bonus}}));
    const prepared = prepareKazuhaBurstDocument(document);
    expect(prepared.hits.filter(hit => hit.kind === "ordinary" && hit.element === element)).toHaveLength(5);
    const result = calculate(document);
    expect(result.blockers).toEqual([]);
    expect(result.totals!.nonCritical).toBeCloseTo(2000 * ((4.7232 + 5 * 2.16) * 1.466 + 5 * .648 * (1 + bonus)) * .5 * .9, 9);
  });

  it("uses only actual prior swirl NonExtraEM for A4 and subtracts its included share once", () => {
    const fresh = fixture("kazuha-burst-complete", absorbed({priorA4Active: true, priorSwirlNonExtraEm: 800}));
    const included = fixture("kazuha-burst-complete", absorbed({priorA4Active: true, priorSwirlNonExtraEm: 800, includedA4DamageBonus: .32, elementDamageBonuses: {pyro: .52}}));
    const formula = createKazuhaA4DamageBonusFormula(800, true, 0);
    expect(evaluateFormulaExpression(formula.expression, Object.fromEntries(formula.inputs.map(row => [row.key, row.value])))).toBeCloseTo(.32, 12);
    expect(calculate(fresh).totals).toEqual(calculate(included).totals);
    expect(calculate(fresh).totals!.nonCritical).toBeCloseTo(2000 * ((4.7232 + 5 * 2.16) * 1.466 + 5 * .648 * 1.52) * .5 * .9, 9);
  });

  it("never feeds this Q's new post-slash A4 back into the 81f snapshot", () => {
    const document = fixture("kazuha-burst-complete", absorbed({priorA4Active: false}));
    if (document.build.mode === "equipment-derived") throw new Error("fixture");
    document.build.stats.em = 50000;
    const result = calculate(document);
    expect(result.blockers).toEqual([]);
    expect(result.totals!.nonCritical).toBeCloseTo(2000 * ((4.7232 + 5 * 2.16) * 1.466 + 5 * .648 * 1.2) * .5 * .9, 9);
  });

  it("crops late absorption before summing and remains idempotent", () => {
    const document = fixture("kazuha-burst-complete", absorbed({absorptionStartFrame: 369}));
    const once = prepareKazuhaBurstDocument(document), twice = prepareKazuhaBurstDocument(once);
    expect(twice).toEqual(once);
    expect(once.hits).toHaveLength(9);
    expect(calculate(once).totals!.nonCritical).toBeCloseTo(2000 * ((4.7232 + 5 * 2.16) * 1.466 + 3 * .648 * 1.2) * .5 * .9, 9);
  });

  it.each([0, 1])("supports C%i without inventing extra Q hits", constellation => {
    const document = fixture(); document.gameContext.constellation = constellation;
    expect(calculate(document).status).toBe("calculated");
    expect(prepareKazuhaBurstDocument(document).hits).toHaveLength(6);
  });
  it.each([2, 3, 4, 5, 6])("blocks unimplemented C%i snapshots", constellation => {
    const document = fixture(); document.gameContext.constellation = constellation;
    expect(calculate(document).totals).toBeUndefined();
    expect(issues(document)).toContain("仅审阅C0/C1");
  });
});

describe("Kazuha missing input and historical snapshot integrity", () => {
  it("preserves imported elemental differences and unknowns when dynamic hits do not exist yet", () => {
    const document = fixture();
    resetKazuhaBurstPanelAccounting(document, "imported-final");
    captureKazuhaImportedDamageBonuses(document, {pyro: .123, hydro: null, electro: .456, cryo: 0});
    expect(kazuhaBurstContext(document)!.elementDamageBonuses).toEqual({pyro: .123, electro: .456, cryo: 0});
    Object.assign(kazuhaBurstContext(document)!, {absorptionElement: "hydro", absorptionStartFrame: 81, priorA4Active: false, includedA4DamageBonus: 0});
    expect(issues(document)).toContain("缺少水元素最终伤害加成");
    expect(calculate(document).status).toBe("blocked");
    kazuhaBurstContext(document)!.absorptionElement = "cryo";
    expect(calculate(document).status).toBe("calculated");
  });

  it.each(["priorA4Active", "priorSwirlNonExtraEm", "includedA4DamageBonus"] as const)("blocks unknown %s only for relevant absorbed damage", key => {
    const document = fixture("kazuha-burst-complete", absorbed({priorA4Active: true, priorSwirlNonExtraEm: 800}));
    delete kazuhaBurstContext(document)![key];
    expect(calculate(document).status).toBe("blocked");
    const selected = prepareKazuhaBurstDocument(document);
    selected.scope = "single-hit"; selected.selectedHitIds = ["kazuha-burst-complete-anemo-1"];
    expect(calculate(selected).status).toBe("calculated");
  });

  it("requires full-hit and cross-snapshot stability without burdening one wind tick", () => {
    const document = fixture();
    delete kazuhaBurstContext(document)!.allHitsConnected;
    delete kazuhaBurstContext(document)!.statsStableAcrossSnapshots;
    expect(calculate(document).status).toBe("blocked");
    document.scope = "single-hit"; document.selectedHitIds = ["kazuha-burst-complete-anemo-1"];
    expect(calculate(document).status).toBe("calculated");
    expect(calculate(document).aggregation.scope).toBe("single-hit");
  });

  it("blocks an incomplete or foreign hit set instead of silently calling it a complete Q", () => {
    const missing = fixture(); missing.hits.pop(); missing.selectedHitIds.pop();
    expect(calculate(missing).status).toBe("blocked");
    const extra = fixture(); const hit = structuredClone(extra.hits[0]!); hit.id = "unrelated-extra";
    extra.hits.push(hit); extra.selectedHitIds.push(hit.id);
    expect(calculate(extra).status).toBe("blocked");
  });

  it("honors locked A4 ascension and never guesses an unknown ascension", () => {
    const document = fixture("kazuha-burst-complete", absorbed());
    document.gameContext.ascension = 3; if (document.build.mode !== "equipment-derived") document.build.ascension = 3;
    delete kazuhaBurstContext(document)!.priorA4Active; delete kazuhaBurstContext(document)!.includedA4DamageBonus;
    expect(calculate(document).status).toBe("calculated");
    kazuhaBurstContext(document)!.priorA4Active = true;
    expect(calculate(document).status).toBe("blocked");
    delete document.gameContext.ascension; if (document.build.mode !== "equipment-derived") delete document.build.ascension;
    expect(issues(document)).toContain("请提供突破阶段");
  });

  it("uses real equipment element filters and preserves converted snapshots and state identity", () => {
    const document = fixture("kazuha-burst-complete", absorbed({priorA4Active: true, priorSwirlNonExtraEm: 800}));
    document.build = {mode: "equipment-derived", characterBaseAtk: 100, weaponBaseAtk: 100, atkPercent: 0, flatAtk: 1800,
      baseHp: 20000, hpPercent: 0, flatHp: 0, baseDef: 800, defPercent: 0, flatDef: 0, em: 9999, critRate: .5, critDamage: 1,
      equipment: {characterId: "character:10000047", weaponId: "unit-sword", level: 90, ascension: 6, weaponLevel: 90, weaponAscension: 6,
        refinement: 1, sourceVersion: "unit", sourceRefs: KAZUHA_BURST_SOURCE_REFS, derivedStats: [], secondaryContributions: [], assumptions: [], effectBlockers: [],
        hitBonuses: [{id: "unit-anemo", value: .466, sourceRef: KAZUHA_BURST_SOURCE_REFS[0]!, label: "Anemo", elements: ["anemo"]},
          {id: "unit-pyro", value: .2, sourceRef: KAZUHA_BURST_SOURCE_REFS[0]!, label: "Pyro", elements: ["pyro"]}],
        statModifiers: [{id: "unit-em-atk-conversion", label: "Explicit unit EM conversion", target: "flatAtk", phase: "conversion",
          expression: expr.mul(expr.input("em"), expr.value(.1)), inputs: [], sourceRefs: KAZUHA_BURST_SOURCE_REFS}], bonusAccounting: "core-sourced-v1"}};
    document.hits.forEach(hit => {if (hit.kind === "ordinary") {
      hit.damageBonus = 0;
      hit.elementalMasteryAdjustment = {accounting: "add-to-panel", formula: {
        ruleId: "unit-actual-prior-flat-em", label: "Explicit external flat EM phase", expression: expr.value(100), inputs: [], sourceRefs: KAZUHA_BURST_SOURCE_REFS,
      }};
    }});
    resetKazuhaBurstPanelAccounting(document, "fresh-equipment");
    const prepared = prepareKazuhaBurstDocument(document) as KazuhaCalculatorDocument;
    expect(calculate(document).blockers).toEqual([]);
    const live = calculate(document).totals;
    expect(live!.nonCritical).toBeCloseTo(3009.9 * ((4.7232 + 5 * 2.16) * 1.466 + 5 * .648 * 1.52) * .5 * .9, 9);
    const converted = convertCalculatorToFinalPanel(forUnwiredSharedCore(prepared)) as KazuhaCalculatorDocument;
    converted.gameContext.kazuhaBurst = structuredClone(kazuhaBurstContext(prepared)!);
    finalizeKazuhaBurstPanelAccounting(converted);
    expect(converted.hits.every(hit => hit.kind === "ordinary" && hit.finalSnapshot?.origin === "equipment-conversion")).toBe(true);
    expect(calculate(converted).totals).toEqual(live);
    const changedA4 = structuredClone(converted);
    kazuhaBurstContext(changedA4)!.priorSwirlNonExtraEm = 900;
    expect(issues(changedA4)).toContain("历史快照");
    expect(calculate(changedA4).status).toBe("blocked");
    const changedBranch = structuredClone(converted);
    kazuhaBurstContext(changedBranch)!.absorptionStartFrame = 369;
    expect(calculate(changedBranch).status).toBe("blocked");
    const changedTalent = structuredClone(converted); changedTalent.gameContext.effectiveTalentLevel = 13;
    expect(calculate(changedTalent).status).toBe("blocked");
  });
});

describe("Kazuha actual condition controls", () => {
  it("initializes actual Q entries without asking wind damage for irrelevant A4 fields", () => {
    const initial = initializeKazuhaBurstDocument(fixture("kazuha-burst-slash"));
    expect(initial.gameContext?.abilityId).toBe("talent:kaedeharakazuha:combat3");
    expect(calculate(initial).status).toBe("calculated");
    expect(renderKazuhaControls(initial)).not.toContain("data-field=\"gameContext.kazuhaBurst.priorSwirlNonExtraEm\"");
    expect(kazuhaBurstRequirementAdapter.collect(initial)).toEqual([]);
    const full = initializeKazuhaBurstDocument(fixture());
    expect(calculate(full).status).toBe("blocked");
    expect(kazuhaBurstRequirementAdapter.collect(full).map(field => field.fieldPath)).toEqual([
      "gameContext.kazuhaBurst.allHitsConnected", "gameContext.kazuhaBurst.statsStableAcrossSnapshots",
    ]);
  });

  it("links every missing absorbed snapshot field to a rendered standard-routed control", () => {
    const document = fixture("kazuha-burst-complete", absorbed({priorA4Active: true}));
    delete kazuhaBurstContext(document)!.elementDamageBonuses;
    delete kazuhaBurstContext(document)!.includedA4DamageBonus;
    const prepared = prepareKazuhaBurstDocument(document);
    const fields = kazuhaBurstRequirementAdapter.collect(prepared), html = renderKazuhaControls(prepared);
    expect(fields.map(field => field.fieldPath)).toEqual([
      "gameContext.kazuhaBurst.elementDamageBonuses.pyro", "gameContext.kazuhaBurst.priorSwirlNonExtraEm", "gameContext.kazuhaBurst.includedA4DamageBonus",
    ]);
    for (const field of fields) {
      expect(html).toContain(`data-field="${field.fieldPath}"`);
      expect(field.dependencyIds.every(id => prepared.dependencies.some(row => row.id === id))).toBe(true);
    }
    expect(html).toContain("data-kazuha-control data-source-cast-enum-field");
    expect(html).toContain("data-kazuha-control data-source-cast-value-field");
  });

  it("retains imported element values while changing absorption clears incompatible prior-swirl declarations", () => {
    const document = fixture("kazuha-burst-complete", absorbed({priorA4Active: true, priorSwirlNonExtraEm: 800}));
    captureKazuhaImportedDamageBonuses(document, {pyro: .1, hydro: .2, electro: null, cryo: .4});
    const input = {
      dataset: {sourceCastEnumField: "gameContext.kazuhaBurst.absorptionElement"}, value: "hydro",
      hasAttribute: (name: string) => name === "data-kazuha-control",
    } as unknown as HTMLSelectElement;
    expect(applyKazuhaControl(document, input)).toBe(true);
    expect(kazuhaBurstContext(document)).toMatchObject({absorptionElement: "hydro", elementDamageBonuses: {pyro: .1, hydro: .2, cryo: .4}});
    expect(kazuhaBurstContext(document)!.absorptionStartFrame).toBeUndefined();
    expect(kazuhaBurstContext(document)!.priorA4Active).toBeUndefined();
    expect(kazuhaBurstContext(document)!.priorSwirlNonExtraEm).toBeUndefined();
    expect(kazuhaBurstContext(document)!.includedA4DamageBonus).toBeUndefined();
    const timing = {dataset: {sourceCastValueField: "gameContext.kazuhaBurst.absorptionStartFrame"}, value: "369", hasAttribute: () => true} as unknown as HTMLSelectElement;
    expect(applyKazuhaControl(document, timing)).toBe(true);
    const prepared = prepareKazuhaBurstDocument(document);
    expect(prepared.hits.filter(hit => hit.kind === "ordinary" && hit.element === "hydro")).toHaveLength(3);
    expect(prepared.selectedHitIds).toHaveLength(9);
  });

  it("respects a partial selection and refuses to silently replace a removed elemental hit", () => {
    const document = prepareKazuhaBurstDocument(fixture("kazuha-burst-complete", absorbed()));
    document.scope = "single-hit"; document.selectedHitIds = ["kazuha-burst-complete-absorb-pyro-1"];
    kazuhaBurstContext(document)!.absorptionStartFrame = 369;
    expect(calculate(document).status).toBe("blocked");
    expect(issues(document)).toContain("重新选择实际命中");
    const repeated = prepareKazuhaBurstDocument(prepareKazuhaBurstDocument(document));
    expect(repeated.selectedHitIds).toEqual(["kazuha-burst-complete-absorb-pyro-1"]);
    expect(calculate(repeated).status).toBe("blocked");
    repeated.selectedHitIds = ["kazuha-burst-complete-anemo-1"];
    expect(calculate(repeated).status).toBe("calculated");
  });
});
