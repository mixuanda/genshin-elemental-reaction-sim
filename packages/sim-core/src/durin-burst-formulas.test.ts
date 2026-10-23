import { describe, expect, it } from "vitest";
import { expr } from "./calculation-trace";
import { equipmentCatalog, resolveEquipmentBuild } from "../../game-data/src/equipment-build";
import { resolveCalculatorStats } from "./calculator";
import { durinBurstContextSchema } from "./durin-burst-context";
import { prepareDurinBurstDocument, resetDurinBurstPanelAccounting, type DurinBurstDocument } from "./durin-burst-formulas";
import { durinEntryFixture, evaluatePreparedRoleFormulas, convertPreparedRoleFormulas } from "./wanderer-durin-entry-test-support";

const prepare = (doc: DurinBurstDocument) => prepareDurinBurstDocument(doc) as DurinBurstDocument;
const foreign = {ruleId: "external-evidence", label: "不同来源", expression: expr.value(10), inputs: [], sourceRefs: ["test:external"]};
describe("Durin selected White Q tick: source preparation and isolated shared formulas", () => {
  it.each([0, 1, 2])("calculates C%i without giving Durin his C1 teammate flat bonus", cons => {
    const doc = durinEntryFixture(); doc.gameContext.constellation = cons;
    if (cons < 2) doc.gameContext.durinBurst = {tickIndex: 1};
    const result = evaluatePreparedRoleFormulas(prepare(doc));
    // WhiteDoT[9]=1.70352; A4 at2000ATK multiplies its coefficient by1.6.
    const nonCritical = 2000 * 1.70352 * 1.6 * (cons === 2 ? 1.5 : 1) * .5 * .9;
    expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(1);
    expect(result.totals!.nonCritical).toBeCloseTo(nonCritical, 9);
    expect(result.totals!.expected).toBeCloseTo(nonCritical * 1.5, 9);
    expect(result.totals!.critical).toBeCloseTo(nonCritical * 2, 9);
  });
  it.each([[1, 1.6], [10, 1.6], [11, 1], [20, 1]] as const)("derives A4 from actual current-Q tick%i, never a blanket damage-bonus add", (tick, multiplier) => {
    const doc = durinEntryFixture(); doc.gameContext.durinBurst!.tickIndex = tick;
    const result = evaluatePreparedRoleFormulas(prepare(doc));
    expect(result.totals!.nonCritical).toBeCloseTo(2000 * 1.70352 * multiplier * 1.5 * .5 * .9, 9);
    expect(prepare(doc).gameContext.scopeCoverage).toBe("single-hit");
    const hit = prepare(doc).hits[0]!; expect(hit).toMatchObject({terms: [{stat: "atk", coefficient: 1.70352}], groupMultiplier: 1});
  });
  it("honors the A4 cap, effective Q13 once and the ascension gate", () => {
    const doc = durinEntryFixture(); if (doc.build.mode === "equipment-derived") throw Error();
    doc.build.stats.atk = 3000; doc.gameContext.effectiveTalentLevel = 13;
    expect(evaluatePreparedRoleFormulas(prepare(doc)).totals!.nonCritical).toBeCloseTo(3000 * 2.0111 * 1.75 * 1.5 * .5 * .9, 9);
    doc.gameContext.ascension = 3; doc.build.ascension = 3; delete doc.gameContext.durinBurst!.tickIndex;
    expect(evaluatePreparedRoleFormulas(prepare(doc)).totals!.nonCritical).toBeCloseTo(3000 * 2.0111 * 1.5 * .5 * .9, 9);
  });
  it("deduplicates an included C2 share and removes an old inactive share", () => {
    const doc = durinEntryFixture(), hit = doc.hits[0]!; if (hit.kind !== "ordinary") throw Error();
    const original = evaluatePreparedRoleFormulas(prepare(doc)).totals;
    hit.damageBonus = .5; doc.gameContext.durinBurst!.c2PyroBonusIncluded = true;
    expect(evaluatePreparedRoleFormulas(prepare(doc)).totals).toEqual(original);
    doc.gameContext.durinBurst!.c2PyroBonusActive = false;
    expect(evaluatePreparedRoleFormulas(prepare(doc)).totals!.expected).toBeCloseTo(original!.expected / 1.5, 9);
  });
  it.each(["tickIndex", "c2PyroBonusActive", "c2PyroBonusIncluded"] as const)("blocks unknown%s instead of inferring a trigger from the selected reaction", key => {
    const doc = durinEntryFixture(); delete doc.gameContext.durinBurst![key];
    expect(evaluatePreparedRoleFormulas(prepare(doc)).status).toBe("blocked");
  });
  it.each([0, 21, 1.5])("rejects out-of-contract tick index%i", tickIndex => {
    expect(() => durinBurstContextSchema.parse({tickIndex})).toThrow();
  });
  it.each(["base", "bonus", "group", "extra-hit", "wrong-id", "wrong-ability", "wrong-scope", "C3"])("rejects%s rather than replacing the source or widening the whole burst", change => {
    const doc = durinEntryFixture(), hit = doc.hits[0]!; if (hit.kind !== "ordinary") throw Error();
    if (change === "base") hit.baseDamageFormula = foreign;
    if (change === "bonus") hit.damageBonusFormula = foreign;
    if (change === "group") hit.groupMultiplier = 20;
    if (change === "extra-hit") doc.hits.push({...structuredClone(hit), id: "copied-unmapped-extra-hit"});
    if (change === "wrong-id") hit.id = doc.selectedHitIds[0] = "forged-hit";
    if (change === "wrong-ability") doc.gameContext.abilityId = "talent:durin:combat2";
    if (change === "wrong-scope") doc.scope = "one-cast";
    if (change === "C3") doc.gameContext.constellation = 3;
    expect(evaluatePreparedRoleFormulas(prepare(doc)).status).toBe("blocked");
    const valid = durinEntryFixture(); if (valid.hits[0]!.kind !== "ordinary") throw Error();
    valid.hits[0]!.attackAdjustment = {accounting: "add-to-panel", formula: foreign};
    valid.hits[0]!.critDamageFormula = foreign;
    expect(prepare(valid).hits[0]).toMatchObject({attackAdjustment: {formula: foreign}, critDamageFormula: foreign});
  });
  it("preserves conversion/JSON context and rejects historical state, Q level or character-level changes", () => {
    const prepared = prepare(durinEntryFixture()), expected = evaluatePreparedRoleFormulas(prepared).totals;
    const converted = convertPreparedRoleFormulas(prepared) as DurinBurstDocument;
    converted.gameContext.durinBurst = durinBurstContextSchema.parse(JSON.parse(JSON.stringify(converted.gameContext.durinBurst)));
    expect(evaluatePreparedRoleFormulas(prepare(converted)).totals).toEqual(expected);
    for (const change of [(d: DurinBurstDocument) => {d.characterLevel = 100;}, (d: DurinBurstDocument) => {d.gameContext.effectiveTalentLevel = 9;},
      (d: DurinBurstDocument) => {d.gameContext.durinBurst!.tickIndex = 11;}, (d: DurinBurstDocument) => {d.gameContext.durinBurst!.c2PyroBonusActive = false;}]) {
      const changed = structuredClone(converted); change(changed); expect(evaluatePreparedRoleFormulas(prepare(changed)).status).toBe("blocked");
    }
  });
  it("executes Durin C2 AthameR1 burst-only16%CD independently of its actual attack window", () => {
    const doc = durinEntryFixture(), weapon = equipmentCatalog().weapons.find(row => row.slug === "athameartis")!;
    doc.build = resolveEquipmentBuild({characterId: "character:10000123", weaponId: weapon.id, level: 90, ascension: 6, weaponLevel: 90, weaponAscension: 6, refinement: 1,
      effectsDisabled: true, weaponEffectsEnabled: true, effectContext: {weaponEffectActive: false}}).build;
    resetDurinBurstPanelAccounting(doc, "fresh-equipment");
    const panel = resolveCalculatorStats(doc.build), result = evaluatePreparedRoleFormulas(prepare(doc));
    const nonCritical = panel.atk * 1.70352 * (1 + Math.min(panel.atk * .0003, .75)) * 1.5 * .5 * .9;
    expect(result.blockers).toEqual([]);
    expect(result.totals!.nonCritical).toBeCloseTo(nonCritical, 8);
    expect(result.totals!.critical).toBeCloseTo(nonCritical * (1 + panel.critDamage + .16), 8);
    expect(result.totals!.expected).toBeCloseTo(nonCritical * (1 + panel.critRate * (panel.critDamage + .16)), 8);
    const prepared = prepare(doc), converted = convertPreparedRoleFormulas(prepared) as DurinBurstDocument;
    expect(evaluatePreparedRoleFormulas(prepare(converted)).totals).toEqual(result.totals);
    resetDurinBurstPanelAccounting(doc, "imported-final"); expect(doc.gameContext.durinBurst!.c2PyroBonusActive).toBeUndefined();
    expect(doc.gameContext.durinBurst!.c2PyroBonusIncluded).toBeUndefined();
  });
});
