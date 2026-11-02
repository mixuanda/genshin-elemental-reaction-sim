import { describe, expect, it } from "vitest";
import type { CalculatorDocument, CalculatorFormula } from "./calculator-model";
import { executeOrdinaryDamage } from "./calculator-formula";
import { evaluateFormulaExpression, expr } from "./calculation-trace";
import { nicoleSkillInitialContextSchema } from "./nicole-skill-initial-context";
import { resolveEquipmentBuild } from "../../game-data/src/equipment-build";
import { resolveCalculatorHitDamageBonus, resolveCalculatorStats } from "./calculator";
import { deriveNicoleSkillInitialWeaponContext, evaluateNicoleSkillAttackGrant, evaluateNicoleSkillInitialC2Resistance,
  finalizeNicoleSkillInitialPanelAccounting, initializeNicoleSkillInitialDocument, isNicoleSkillInitialHit,
  prepareNicoleSkillInitialDocument, resetNicoleSkillInitialPanelAccounting, resolveNicoleSkillInitialGrantAttack,
  type NicoleSkillInitialDocument } from "./nicole-skill-initial-formulas";

const fixture = (): NicoleSkillInitialDocument => ({ dataIdentity: { releaseStatus: "released" }, id: "fixture:nicole-e",
  label: "Synthetic E9, not a UID/native capture", characterLevel: 90, scope: "single-hit",
  build: { mode: "manual-final", stats: { atk: 2000, hp: 10000, def: 700, em: 0, critRate: .5, critDamage: 1 }, source: "unit fixture" },
  enemy: { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 },
  gameContext: { characterId: "character:10000131", abilityId: "talent:nicole:combat2", skillId: "nicole-skill",
    effectiveTalentLevel: 10, constellation: 2, ascension: 6, nicoleSkillInitial: { noOtherEventsBeforeInitial: true,
      noDisplacementBeforeInitial: true, skillGrantNonExtraAttack: 2000, grantAttackSource: "observed", includedSkillAttack: 0,
      c2AttackIncludedInPanel: false, a1AttackIncludedInPanel: false, includedC2ResistanceReduction: 0 } },
  hits: [{ id: "nicole-skill-hit", label: "E initial", kind: "ordinary", element: "pyro", attackTag: "skill", terms: [{ stat: "atk", coefficient: 2.4912 }],
    additiveBaseDamage: 0, damageBonus: 0, critEligible: true, reaction: "none", reactionBonus: 0, groupMultiplier: 1, sourceRefs: [], dependencies: [] }],
  selectedHitIds: ["nicole-skill-hit"], dependencies: [], assumptions: [] } as unknown as NicoleSkillInitialDocument);
const amount = (f: CalculatorFormula | undefined) => f ? evaluateFormulaExpression(f.expression, Object.fromEntries(f.inputs.map(x => [x.key, x.value]))) : 0;
const blocked = (doc: CalculatorDocument) => doc.dependencies.some(x => x.id.startsWith("nicole-skill-initial:") && x.status === "missing");
const equipment = (doc: NicoleSkillInitialDocument) => {
  doc.build = { mode: "equipment-derived", characterBaseAtk: 300, weaponBaseAtk: 500, atkPercent: 1, flatAtk: 400,
    baseHp: 10000, hpPercent: 0, flatHp: 0, baseDef: 700, defPercent: 0, flatDef: 0, em: 0, critRate: .5, critDamage: 1,
    equipment: { bonusAccounting: "core-sourced-v1", characterId: "character:10000131", weaponId: "weapon:14523", level: 90,
      ascension: 6, refinement: 1, weaponLevel: 90, weaponAscension: 6, sourceVersion: "fixture", sourceRefs: ["fixture:gear"],
      derivedStats: [], secondaryContributions: [], assumptions: [], effectBlockers: [], weaponEffectsEnabled: true,
      statModifiers: [] } };
};
describe("Nicole C0–C2 initial E accounting", () => {
  it("gives E and C2 ATK before snapshot, excludes new A1 ATK, and reads C2 resistance before this hit", () => {
    const doc = prepareNicoleSkillInitialDocument(fixture()), hit = doc.hits[0]!;
    expect(blocked(doc)).toBe(false); if (hit.kind !== "ordinary") throw new Error("ordinary");
    expect(hit.terms).toEqual([{ stat: "atk", coefficient: 2.4912 }]);
    expect(amount(hit.attackAdjustment?.formula)).toBe(600); expect(amount(hit.resistanceReductionFormula)).toBe(.25);
    expect(hit.damageBonusFormula).toBeUndefined(); // signature is owned by the existing equipment formula
    const result = executeOrdinaryDamage({ scalingStat: "atk", scaling: 2.4912, scalingValue: 2000 + amount(hit.attackAdjustment?.formula),
      flatDamage: 0, damageBonus: 0, characterLevel: 90, enemyLevel: 90, defenseReduction: 0, defenseIgnore: 0,
      effectiveResistance: .1 - amount(hit.resistanceReductionFormula), critMode: "average", critRate: .5, critDamage: 1,
      elementalMastery: 0, reaction: "none", reactionBonus: 0, groupMultiplier: 1 }, false);
    // Independent: (2000+min(2000*.15,600)+300)*2.4912*.5*(1-(-.15)/2)*1.5
    expect(result.finalDamage).toBeCloseTo(5222.178, 9);
    expect(result.factors.resistanceMultiplier).toBeCloseTo(1.075, 12);
  });
  it("respects the E cap and legal zero; rejects unknown samples and re-adding constellation levels", () => {
    expect(evaluateNicoleSkillAttackGrant({ effectiveSkillTalentLevel: 10, constellation: 2, nonExtraAttackAtGrant: 5000 }))
      .toMatchObject({ ratio: .15, cap: 600, skillAttack: 600, c2Attack: 300, newA1AttackInThisSnapshot: 0 });
    expect(evaluateNicoleSkillAttackGrant({ effectiveSkillTalentLevel: 10, constellation: 2, nonExtraAttackAtGrant: 0 }).totalAttack).toBe(300);
    expect(evaluateNicoleSkillAttackGrant({ effectiveSkillTalentLevel: 13, constellation: 1, nonExtraAttackAtGrant: 2000 }))
      .toMatchObject({ coefficient: 2.941, skillAttack: 354, c2Attack: 0 });
    expect(() => evaluateNicoleSkillAttackGrant({ effectiveSkillTalentLevel: 10, constellation: 2, nonExtraAttackAtGrant: undefined as unknown as number })).toThrow(/8帧/);
    expect(() => evaluateNicoleSkillAttackGrant({ effectiveSkillTalentLevel: 16, constellation: 2, nonExtraAttackAtGrant: 2000 })).toThrow(/1–15/);
  });
  it("does not double count included E/C2 and removes an explicitly stale A1 input", () => {
    const doc = fixture(), context = doc.gameContext.nicoleSkillInitial!;
    Object.assign(context, { includedSkillAttack: 300, c2AttackIncludedInPanel: true, a1AttackIncludedInPanel: true,
      includedC2ResistanceReduction: .25 });
    const out = prepareNicoleSkillInitialDocument(doc), hit = out.hits[0]!;
    expect(blocked(out)).toBe(false); if (hit.kind !== "ordinary") throw new Error("ordinary");
    expect(amount(hit.attackAdjustment?.formula)).toBe(-300); expect(amount(hit.resistanceReductionFormula)).toBe(0);
  });
  it("requires real A4/range/actor conditions and refuses contradicted range or displacement instead of guessing zero", () => {
    expect(evaluateNicoleSkillInitialC2Resistance({ constellation: 2, ascension: 6, ownerOnFieldAtInitial: true, targetInC2AreaAtInitial: false })).toBe(0);
    expect(evaluateNicoleSkillInitialC2Resistance({ constellation: 2, ascension: 6, ownerOnFieldAtInitial: false, targetInC2AreaAtInitial: true })).toBe(0);
    const low = fixture(); low.gameContext.ascension = 3; expect(blocked(prepareNicoleSkillInitialDocument(low))).toBe(true);
    const range = fixture(); range.gameContext.nicoleSkillInitial!.targetInC2AreaAtInitial = false;
    expect(blocked(prepareNicoleSkillInitialDocument(range))).toBe(true);
    const moved = fixture(); moved.gameContext.nicoleSkillInitial!.noDisplacementBeforeInitial = false;
    expect(blocked(prepareNicoleSkillInitialDocument(moved))).toBe(true);
    const unknown = fixture(); delete unknown.gameContext.nicoleSkillInitial!.noDisplacementBeforeInitial;
    expect(blocked(prepareNicoleSkillInitialDocument(unknown))).toBe(true);
  });
  it("derives plain equipment through the shared panel and binds only existing signature context", () => {
    const doc = fixture(); equipment(doc);
    delete doc.gameContext.nicoleSkillInitial!.skillGrantNonExtraAttack; delete doc.gameContext.nicoleSkillInitial!.grantAttackSource;
    expect(resolveNicoleSkillInitialGrantAttack(doc)).toEqual({ value: 2000, source: "equipment-current" });
    const external = { catalystHexerei: true, weaponEffectActive: false, catalystSnapshotAtk: 9999 };
    const result = deriveNicoleSkillInitialWeaponContext(doc, external);
    expect(result).toEqual({ derived: true, effectContext: { catalystHexerei: true, weaponEffectActive: true, offField: false, catalystSnapshotAtk: 2000 } });
    expect(external.catalystSnapshotAtk).toBe(9999);
    expect(doc.hits[0]!.kind === "ordinary" && doc.hits[0]!.damageBonusFormula).toBeUndefined();
    const out = prepareNicoleSkillInitialDocument(doc) as NicoleSkillInitialDocument;
    expect(out.gameContext.nicoleSkillInitial).toMatchObject({ skillGrantNonExtraAttack: 2000, grantAttackSource: "equipment-current" });
    if (doc.build.mode !== "equipment-derived") throw new Error("equipment");
    doc.build.equipment!.statModifiers = [{ id: "fixture:extra", label: "extra ATK conversion", phase: "conversion", target: "flatAtk",
      expression: expr.value(500), inputs: [], sourceRefs: ["fixture:extra"] }];
    expect(resolveNicoleSkillInitialGrantAttack(doc)).toBeUndefined();
    expect(deriveNicoleSkillInitialWeaponContext(doc, external).derived).toBe(false);
  });
  it("preserves foreign attack evidence, old context-free documents and strict hit identity", () => {
    const old = fixture(); delete old.gameContext.nicoleSkillInitial;
    expect(prepareNicoleSkillInitialDocument(old)).toBe(old);
    expect((initializeNicoleSkillInitialDocument(old) as NicoleSkillInitialDocument).gameContext.nicoleSkillInitial).toEqual({});
    const doc = fixture(); expect(isNicoleSkillInitialHit(doc, doc.hits[0]!)).toBe(true);
    const foreign = { accounting: "add-to-panel" as const, formula: { ruleId: "fixture:foreign-atk", label: "foreign", expression: expr.value(100), inputs: [], sourceRefs: ["fixture:foreign"] } };
    if (doc.hits[0]!.kind !== "ordinary") throw new Error("ordinary"); doc.hits[0]!.attackAdjustment = foreign;
    const out = prepareNicoleSkillInitialDocument(doc);
    expect(blocked(out)).toBe(true); expect(out.hits[0]!.kind === "ordinary" && out.hits[0]!.attackAdjustment).toEqual(foreign);
    doc.gameContext.abilityId = "talent:nicole:combat3"; expect(isNicoleSkillInitialHit(doc, doc.hits[0]!)).toBe(false);
  });
  it("reuses the actual R1 equipment formula with the first shield sample exactly once", () => {
    const input = { characterId: "character:10000131", weaponId: "weapon:14523", level: 90, ascension: 6,
      weaponLevel: 90, weaponAscension: 6, refinement: 1, effectsDisabled: true, weaponEffectsEnabled: true,
      setEffectsEnabled: false, artifacts: [], effectContext: { weaponEffectActive: false } };
    const doc = fixture(); doc.build = resolveEquipmentBuild(input).build;
    delete doc.gameContext.nicoleSkillInitial!.skillGrantNonExtraAttack; delete doc.gameContext.nicoleSkillInitial!.grantAttackSource;
    const before = resolveCalculatorStats(doc.build).atk;
    const bound = deriveNicoleSkillInitialWeaponContext(doc, input.effectContext);
    expect(bound.derived).toBe(true); expect(bound.effectContext.catalystSnapshotAtk).toBe(before);
    doc.build = resolveEquipmentBuild({ ...input, effectContext: bound.effectContext }).build;
    const prepared = prepareNicoleSkillInitialDocument(doc), hit = prepared.hits[0]!;
    expect(blocked(prepared)).toBe(false); if (hit.kind !== "ordinary") throw new Error("ordinary");
    expect(hit.damageBonusFormula).toBeUndefined();
    expect(resolveCalculatorHitDamageBonus(prepared.build, hit, prepared)).toBeCloseTo(Math.min(before * .0001, .26), 12);
    expect((prepared as NicoleSkillInitialDocument).gameContext.nicoleSkillInitial!.skillGrantNonExtraAttack).toBe(before);
  });
  it("keeps explicit false/zero after JSON reopen, blocks changed effective E and does not stamp a new history", () => {
    const doc = prepareNicoleSkillInitialDocument(fixture()) as NicoleSkillInitialDocument;
    if (doc.hits[0]!.kind !== "ordinary") throw new Error("ordinary");
    doc.hits[0]!.finalSnapshot = { origin: "equipment-conversion", stats: { atk: 2600, hp: 10000, def: 700, em: 0, critRate: .5, critDamage: 1 },
      characterLevel: 90, ascension: 6, damageBonus: 0, additiveBaseDamage: 0, reactionBonus: 0, source: "actual conversion fixture", sourceRefs: ["fixture:snapshot"] };
    finalizeNicoleSkillInitialPanelAccounting(doc);
    const reopened = JSON.parse(JSON.stringify(doc)) as NicoleSkillInitialDocument;
    reopened.gameContext.nicoleSkillInitial = nicoleSkillInitialContextSchema.parse(reopened.gameContext.nicoleSkillInitial);
    expect(blocked(prepareNicoleSkillInitialDocument(reopened))).toBe(false);
    expect(reopened.gameContext.nicoleSkillInitial).toMatchObject({ includedSkillAttack: 0, c2AttackIncludedInPanel: false, a1AttackIncludedInPanel: false });
    reopened.gameContext.effectiveTalentLevel = 13;
    expect(blocked(prepareNicoleSkillInitialDocument(reopened))).toBe(true);
    expect(() => finalizeNicoleSkillInitialPanelAccounting(reopened)).toThrow(/不能重写/);
    resetNicoleSkillInitialPanelAccounting(reopened, "imported-final");
    expect(reopened.gameContext.nicoleSkillInitial.skillGrantNonExtraAttack).toBeUndefined();
    expect(reopened.gameContext.nicoleSkillInitial.c2AttackIncludedInPanel).toBeUndefined();
  });
});
