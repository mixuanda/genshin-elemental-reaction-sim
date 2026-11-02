import { describe, expect, it } from "vitest";
import { expr } from "./calculation-trace";
import { resolveEquipmentBuild, equipmentCatalog } from "../../game-data/src/equipment-build";
import { resolveCalculatorStats } from "./calculator";
import { wandererPrimaryContextSchema } from "./wanderer-primary-context";
import { finalizeWandererPrimaryPanelAccounting, prepareWandererPrimaryDocument, resetWandererPrimaryPanelAccounting, type WandererPrimaryDocument } from "./wanderer-primary-formulas";
import { wandererEntryFixture, evaluatePreparedRoleFormulas, convertPreparedRoleFormulas } from "./wanderer-durin-entry-test-support";

const prepare = (doc: WandererPrimaryDocument) => prepareWandererPrimaryDocument(doc) as WandererPrimaryDocument;
const foreign = {ruleId: "external-evidence", label: "不同来源", expression: expr.value(7), inputs: [], sourceRefs: ["test:external"]};
describe("Wanderer actual primary hits: source preparation and isolated shared formulas", () => {
  it.each([["1", 1.3583], ["2", 1.2852], ["3-1", .9418], ["3-2", .9418]] as const)("uses independent NA10 × effectiveE13 for segment%s and its separate C6 child", (suffix, na) => {
    const parent = prepare(wandererEntryFixture(`wanderer-windfavored-normal-${suffix}`));
    const result = evaluatePreparedRoleFormulas(parent), nonCritical = 2000 * na * 1.614225 * (200 / 390) * .9;
    expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(1);
    expect(result.totals!.nonCritical).toBeCloseTo(nonCritical, 9);
    expect(result.totals!.expected).toBeCloseTo(nonCritical * 1.5, 9);
    expect(result.totals!.critical).toBeCloseTo(nonCritical * 2, 9);
    const extra = prepare(wandererEntryFixture(`wanderer-windfavored-c6-normal-${suffix}`));
    expect(evaluatePreparedRoleFormulas(extra).totals!.expected).toBeCloseTo(nonCritical * .4 * 1.5, 9);
    expect(parent.gameContext.effectiveTalentLevel).toBe(10); expect(parent.gameContext.wandererPrimary!.skillTalentLevel).toBe(13);
  });
  it("accounts actual Pyro/Cryo shares, partial inclusion, stale shares and critical probability cap", () => {
    const doc = wandererEntryFixture();
    Object.assign(doc.gameContext.wandererPrimary!, {absorptionBonuses: "pyro-cryo", baseAttack: 1000});
    const original = evaluatePreparedRoleFormulas(prepare(doc)).totals!;
    const expectedNonCrit = 2300 * 1.3583 * 1.614225 * (200 / 390) * .9;
    expect(original.nonCritical).toBeCloseTo(expectedNonCrit, 9);
    expect(original.expected).toBeCloseTo(expectedNonCrit * 1.7, 9);
    if (doc.build.mode === "equipment-derived") throw Error();
    doc.build.stats.atk += 150; doc.build.stats.critRate += .1;
    Object.assign(doc.gameContext.wandererPrimary!, {pyroAttackIncludedPercent: 15, cryoCritRateIncludedPercent: 10});
    expect(evaluatePreparedRoleFormulas(prepare(doc)).totals).toEqual(original);
    doc.gameContext.wandererPrimary!.absorptionBonuses = "neither";
    expect(evaluatePreparedRoleFormulas(prepare(doc)).totals!.expected).toBeCloseTo(expectedNonCrit / 2300 * 2000 * 1.5, 9);
    doc.build.stats.critRate = .95; doc.gameContext.wandererPrimary!.absorptionBonuses = "cryo";
    doc.gameContext.wandererPrimary!.cryoCritRateIncludedPercent = 0;
    const capped = evaluatePreparedRoleFormulas(prepare(doc)).totals!;
    expect(capped.expected).toBeCloseTo(capped.critical, 9);
  });
  it.each([0, 25, 50])("uses actual Q-at-cast spentKuugoryoku=%i and exactly five fixed contacts", spent => {
    const doc = wandererEntryFixture("wanderer-kyougen-five-hits", 13);
    doc.gameContext.wandererPrimary!.burstC2ConsumedPointsUpTo50 = spent;
    const prepared = prepare(doc), result = evaluatePreparedRoleFormulas(prepared);
    // Fixed burst[12]=3.128, never add C3 again. All5 share the same55f source snapshot.
    const nonCritical = 2000 * 3.128 * (1 + spent * .04) * (200 / 390) * .9;
    expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(5);
    expect(result.hits[0]!.nonCritical).toBeCloseTo(nonCritical, 9);
    expect(result.totals!.expected).toBeCloseTo(nonCritical * 5 * 1.5, 9);
    expect(prepared.gameContext.scopeCoverage).toBe("complete-cast");
    doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[4]!.id];
    delete doc.gameContext.wandererPrimary!.burstAllHitsConnected; delete doc.gameContext.wandererPrimary!.burstConditionsStable;
    expect(evaluatePreparedRoleFormulas(prepare(doc)).totals!.expected).toBeCloseTo(nonCritical * 1.5, 9);
  });
  it("ordinary Q has no C2; already-included C2 is deducted and unknown is never full bonus", () => {
    const doc = wandererEntryFixture("wanderer-kyougen-five-hits", 13);
    doc.gameContext.wandererPrimary!.burstC2IncludedPercent = 200;
    for (const hit of doc.hits) if (hit.kind === "ordinary") hit.damageBonus = 2;
    const active = evaluatePreparedRoleFormulas(prepare(doc)).totals!.expected;
    doc.gameContext.wandererPrimary!.burstWindfavoredAtCast = false;
    expect(evaluatePreparedRoleFormulas(prepare(doc)).totals!.expected).toBeCloseTo(active / 3, 9);
    delete doc.gameContext.wandererPrimary!.burstWindfavoredAtCast;
    expect(evaluatePreparedRoleFormulas(prepare(doc)).status).toBe("blocked");
  });
  it.each(["skillTalentLevel", "absorptionBonuses", "pyroAttackIncludedPercent", "cryoCritRateIncludedPercent"] as const)("blocks missing%s without guessing levels or absorption", key => {
    const doc = wandererEntryFixture(); delete doc.gameContext.wandererPrimary![key];
    expect(evaluatePreparedRoleFormulas(prepare(doc)).status).toBe("blocked");
  });
  it.each([undefined, false])("does not invent a C6 extra when its parent qualification is%s", actual => {
    const doc = wandererEntryFixture("wanderer-windfavored-c6-normal-1");
    if (actual === undefined) delete doc.gameContext.wandererPrimary!.c6ParentQualified; else doc.gameContext.wandererPrimary!.c6ParentQualified = actual;
    expect(evaluatePreparedRoleFormulas(prepare(doc)).status).toBe("blocked");
    doc.gameContext.constellation = 5; doc.gameContext.wandererPrimary!.c6ParentQualified = true;
    expect(evaluatePreparedRoleFormulas(prepare(doc)).status).toBe("blocked");
  });
  it.each(["foreign-base", "foreign-crit", "group", "extra-hit", "wrong-id", "wrong-ability"])("rejects%s while preserving independent external slots", change => {
    const doc = wandererEntryFixture(), hit = doc.hits[0]!; if (hit.kind !== "ordinary") throw Error();
    if (change === "foreign-base") hit.baseDamageFormula = foreign;
    if (change === "foreign-crit") hit.critRateFormula = foreign;
    if (change === "group") hit.groupMultiplier = 2;
    if (change === "extra-hit") doc.hits.push({...structuredClone(hit), id: "copied-unmapped-extra-hit"});
    if (change === "wrong-id") hit.id = doc.selectedHitIds[0] = "forged-hit";
    if (change === "wrong-ability") doc.gameContext.abilityId = "talent:wanderer:combat2";
    expect(evaluatePreparedRoleFormulas(prepare(doc)).status).toBe("blocked");
    const valid = wandererEntryFixture(); if (valid.hits[0]!.kind !== "ordinary") throw Error();
    valid.hits[0]!.elementalMasteryAdjustment = {accounting: "add-to-panel", formula: foreign};
    valid.hits[0]!.critDamageFormula = foreign;
    const preserved = prepare(valid).hits[0]!; expect(preserved).toMatchObject({elementalMasteryAdjustment: {formula: foreign}, critDamageFormula: foreign});
  });
  it("blocks same-slot Pyro attack/Q C2 overrides instead of deleting external evidence", () => {
    const na = wandererEntryFixture(); Object.assign(na.gameContext.wandererPrimary!, {absorptionBonuses: "pyro", baseAttack: 1000});
    if (na.hits[0]!.kind !== "ordinary") throw Error(); na.hits[0]!.attackAdjustment = {accounting: "add-to-panel", formula: foreign};
    expect(evaluatePreparedRoleFormulas(prepare(na)).status).toBe("blocked");
    const q = wandererEntryFixture("wanderer-kyougen-five-hits"); if (q.hits[0]!.kind !== "ordinary") throw Error(); q.hits[0]!.damageBonusFormula = foreign;
    expect(evaluatePreparedRoleFormulas(prepare(q)).status).toBe("blocked");
  });
  it("retains source numbers through conversion and rejects changed level/state/talent on a frozen snapshot", () => {
    const prepared = prepare(wandererEntryFixture()), expected = evaluatePreparedRoleFormulas(prepared).totals;
    const converted = convertPreparedRoleFormulas(prepared) as WandererPrimaryDocument;
    expect(evaluatePreparedRoleFormulas(prepare(converted)).totals).toEqual(expected);
    const contextJSON = JSON.stringify(converted.gameContext.wandererPrimary);
    converted.gameContext.wandererPrimary = wandererPrimaryContextSchema.parse(JSON.parse(contextJSON));
    expect(evaluatePreparedRoleFormulas(prepare(converted)).totals).toEqual(expected);
    for (const change of [(d: WandererPrimaryDocument) => {d.characterLevel = 90;}, (d: WandererPrimaryDocument) => {d.gameContext.effectiveTalentLevel = 9;},
      (d: WandererPrimaryDocument) => {d.gameContext.wandererPrimary!.absorptionBonuses = "cryo";}]) {
      const changed = structuredClone(converted); change(changed); expect(evaluatePreparedRoleFormulas(prepare(changed)).status).toBe("blocked");
    }
    const manual = prepare(wandererEntryFixture()); if (manual.hits[0]!.kind !== "ordinary") throw Error();
    manual.hits[0]!.finalSnapshot = {stats: {atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1}, characterLevel: 100, ascension: 6, damageBonus: 0, additiveBaseDamage: 0, reactionBonus: 0, source: "unverified old snapshot", sourceRefs: ["test:unverified-snapshot"]};
    expect(evaluatePreparedRoleFormulas(prepare(manual)).status).toBe("blocked");
  });
  it("executes the requested level100 C6 TulayR5 source equipment with explicit current units and deduplicates conversion", () => {
    const doc = wandererEntryFixture(), weapon = equipmentCatalog().weapons.find(row => row.slug === "tulaytullahsremembrance")!;
    doc.build = resolveEquipmentBuild({characterId: "character:10000075", weaponId: weapon.id, level: 100, characterLevelCap: 100, ascension: 6, weaponLevel: 90, weaponAscension: 6, refinement: 5, effectsDisabled: true, weaponEffectsEnabled: true,
      effectContext: {weaponEffectActive: true, offField: false, weaponStacks: 10}}).build;
    resetWandererPrimaryPanelAccounting(doc, "fresh-equipment");
    const prepared = prepare(doc), panel = resolveCalculatorStats(doc.build), result = evaluatePreparedRoleFormulas(prepared);
    const nonCritical = panel.atk * 1.3583 * 1.614225 * 1.96 * (200 / 390) * .9;
    expect(result.blockers).toEqual([]); expect(result.totals!.nonCritical).toBeCloseTo(nonCritical, 8);
    expect(result.totals!.expected).toBeCloseTo(nonCritical * (1 + panel.critRate * panel.critDamage), 8);
    expect(prepared.gameContext.wandererPrimary!.baseAttack).toBeCloseTo(doc.build.characterBaseAtk + doc.build.weaponBaseAtk, 10);
    const reopened = evaluatePreparedRoleFormulas(prepare(convertPreparedRoleFormulas(prepared) as WandererPrimaryDocument));
    expect(reopened.blockers).toEqual([]);
    expect(reopened.totals).toEqual(result.totals);
    resetWandererPrimaryPanelAccounting(doc, "imported-final");
    expect(doc.gameContext.wandererPrimary!.absorptionBonuses).toBeUndefined();
    expect(doc.gameContext.wandererPrimary!.pyroAttackIncludedPercent).toBeUndefined();
  });
});
