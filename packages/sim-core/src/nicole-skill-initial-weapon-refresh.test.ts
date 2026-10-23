import { describe, expect, it } from "vitest";
import { resolveEquipmentBuild, type EquipmentBuildInput } from "../../game-data/src/equipment-build";
import { resolveCalculatorHitDamageBonus, resolveCalculatorStats } from "./calculator";
import { deriveNicoleSkillInitialWeaponContext, prepareNicoleSkillInitialDocument,
  type NicoleSkillInitialDocument } from "./nicole-skill-initial-formulas";
import { refreshNicoleSkillInitialWeaponEffects } from "./nicole-skill-initial-weapon-refresh";
import { executeOrdinaryDamage } from "./calculator-formula";
import { evaluateFormulaExpression } from "./calculation-trace";

const equipmentInput = (): EquipmentBuildInput => ({ characterId: "character:10000131", weaponId: "weapon:14523",
  level: 90, ascension: 6, weaponLevel: 90, weaponAscension: 6, refinement: 1, effectsDisabled: true,
  weaponEffectsEnabled: true, setEffectsEnabled: true,
  artifacts: ["flower", "plume"].map(slot => ({ slot: slot as "flower" | "plume", setId: "artifact-set:15001",
    rarity: 5, level: 0, mainStat: slot === "flower" ? "hp" : "atk", initialSubstats: 3,
    substats: [{ stat: "critRate_", rolls: [3] }, { stat: "critDMG_", rolls: [3] }, { stat: "enerRech_", rolls: [3] }] })),
  effectContext: { weaponEffectActive: false, catalystHexerei: true, hpFraction: .75 } });
const fixture = (): NicoleSkillInitialDocument => {
  const build = resolveEquipmentBuild(equipmentInput()).build;
  // A real, legal equipment resolution plus an explicit editable panel delta.
  build.flatAtk += 2000 - resolveCalculatorStats(build).atk;
  return { dataIdentity: { releaseStatus: "released" }, id: "fixture:nicole-signature-refresh",
    label: "Legal equipment fixture, not a UID or a native capture", characterLevel: 90, scope: "single-hit", build,
    enemy: { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 },
    gameContext: { characterId: "character:10000131", abilityId: "talent:nicole:combat2", skillId: "nicole-skill",
      effectiveTalentLevel: 10, constellation: 2, ascension: 6, nicoleSkillInitial: { noOtherEventsBeforeInitial: true,
        noDisplacementBeforeInitial: true, includedSkillAttack: 0, c2AttackIncludedInPanel: false,
        a1AttackIncludedInPanel: false, includedC2ResistanceReduction: 0 } },
    hits: [{ id: "nicole-skill-hit", label: "E initial", kind: "ordinary", element: "pyro", attackTag: "skill",
      terms: [{ stat: "atk", coefficient: 2.4912 }], additiveBaseDamage: 0, damageBonus: 0, critEligible: true,
      reaction: "none", reactionBonus: 0, groupMultiplier: 1, sourceRefs: [], dependencies: [] }],
    selectedHitIds: ["nicole-skill-hit"], dependencies: [], assumptions: [] } as unknown as NicoleSkillInitialDocument;
};
const bonus = (doc: NicoleSkillInitialDocument) => {
  const hit = doc.hits[0]!; if (hit.kind !== "ordinary") throw new Error("ordinary fixture");
  return resolveCalculatorHitDamageBonus(doc.build, hit, doc);
};

describe("Nicole first-shield signature refresh", () => {
  it("refreshes the generated clause rather than only changing its context", () => {
    const doc = fixture(); if (doc.build.mode !== "equipment-derived") throw new Error("equipment fixture");
    const original = structuredClone(doc);
    const bound = deriveNicoleSkillInitialWeaponContext(doc, doc.build.equipment!.effectContext!);
    expect(bound.derived).toBe(true);
    doc.build.equipment!.effectContext = bound.effectContext;
    expect(bonus(doc)).toBe(0); // retained reproducer: context alone leaves an inactive generated clause
    const refreshed = refreshNicoleSkillInitialWeaponEffects(original);
    expect(refreshed).toMatchObject({ status: "refreshed", blocked: false, refreshed: true });
    const out = refreshed.document as NicoleSkillInitialDocument;
    expect(bonus(out)).toBeCloseTo(.2, 12);
    expect(bonus(original)).toBe(0);
    expect(resolveCalculatorStats(out.build).atk).toBe(2000);
    const expected = structuredClone(original);
    if (out.build.mode !== "equipment-derived" || expected.build.mode !== "equipment-derived") throw new Error("equipment");
    expected.build.equipment!.effectContext = out.build.equipment!.effectContext;
    expected.build.equipment!.dynamicHitBonuses = out.build.equipment!.dynamicHitBonuses;
    expect(out).toEqual(expected); // no field, manual delta, artifact or constant ATK is rebuilt
    expect(out.build.equipment!.statModifiers).toEqual(original.build.equipment!.statModifiers);
    expect(out.build.equipment!.effectContext).toMatchObject({ hpFraction: .75, catalystHexerei: true,
      weaponEffectActive: true, offField: false, catalystSnapshotAtk: 2000 });
    const prepared = prepareNicoleSkillInitialDocument(out), hit = prepared.hits[0]!;
    if (hit.kind !== "ordinary" || !hit.attackAdjustment || !hit.resistanceReductionFormula) throw new Error("prepared E");
    const amount = (f: typeof hit.attackAdjustment.formula) => evaluateFormulaExpression(f.expression,
      Object.fromEntries(f.inputs.map(input => [input.key, input.value])));
    const damage = executeOrdinaryDamage({ scalingStat: "atk", scaling: 2.4912,
      scalingValue: resolveCalculatorStats(prepared.build).atk + amount(hit.attackAdjustment.formula),
      flatDamage: 0, damageBonus: bonus(out), characterLevel: 90, enemyLevel: 90, defenseReduction: 0,
      defenseIgnore: 0, effectiveResistance: .1 - amount(hit.resistanceReductionFormula), critMode: "average",
      critRate: .5, critDamage: 1, elementalMastery: 0, reaction: "none", reactionBonus: 0, groupMultiplier: 1 }, false);
    // Independent: 2600*2.4912*.5*1.075*1.2*1.5. New A1 never enters the frozen attack.
    expect(damage.finalDamage).toBeCloseTo(6266.6136, 9);
  });
  it("updates an automatic sample on panel edits once, caps it, and survives JSON reopen", () => {
    let doc = refreshNicoleSkillInitialWeaponEffects(fixture()).document as NicoleSkillInitialDocument;
    doc = prepareNicoleSkillInitialDocument(doc) as NicoleSkillInitialDocument;
    if (doc.build.mode !== "equipment-derived") throw new Error("equipment");
    doc.build.flatAtk += 500;
    const refreshed = refreshNicoleSkillInitialWeaponEffects(doc);
    expect(refreshed.status).toBe("refreshed");
    const next = refreshed.document as NicoleSkillInitialDocument;
    expect(bonus(next)).toBeCloseTo(.25, 12);
    expect(next.build).toMatchObject({ flatAtk: doc.build.flatAtk });
    const reopened = JSON.parse(JSON.stringify(next)) as NicoleSkillInitialDocument;
    const same = refreshNicoleSkillInitialWeaponEffects(reopened);
    expect(same.status).toBe("unchanged"); expect(same.document).toBe(reopened);
    if (reopened.build.mode !== "equipment-derived") throw new Error("equipment");
    reopened.build.flatAtk += 1000;
    expect(bonus(refreshNicoleSkillInitialWeaponEffects(reopened).document as NicoleSkillInitialDocument)).toBe(.26);
  });
  it("keeps unrelated formulas, artifact records, limitations and editable panel differences", () => {
    const doc = fixture(); if (doc.build.mode !== "equipment-derived") throw new Error("equipment");
    const metadata = doc.build.equipment!;
    const foreign = { id: "fixture:external-skill-bonus", label: "external recorded bonus", expression: { kind: "constant" as const, value: .05 },
      inputs: [], attackTags: ["skill" as const], sourceRefs: ["fixture:independent-source"] };
    metadata.dynamicHitBonuses!.unshift(foreign);
    metadata.effectBlockers.push("fixture:unknown unrelated mechanic remains unknown");
    metadata.assumptions.push("fixture:manual panel delta remains explicit");
    const out = refreshNicoleSkillInitialWeaponEffects(doc).document as NicoleSkillInitialDocument;
    expect(bonus(out)).toBeCloseTo(.25, 12);
    if (out.build.mode !== "equipment-derived") throw new Error("equipment");
    expect(out.build.equipment!.dynamicHitBonuses![0]).toBe(foreign);
    expect(out.build.equipment!.artifacts).toEqual(metadata.artifacts);
    expect(out.build.equipment!.assumptions).toEqual(metadata.assumptions);
    expect(out.build.equipment!.effectBlockers).toEqual(metadata.effectBlockers);
    expect(out.build.equipment!.sourceRefs).toEqual(metadata.sourceRefs);
    // A shared explicit background state cannot be overwritten while leaving
    // another source's generated effects potentially stale.
    metadata.effectContext!.offField = true;
    expect(refreshNicoleSkillInitialWeaponEffects(doc)).toMatchObject({ status: "blocked", document: doc, blocked: true });
  });
  it("distinguishes unknown/false from a valid observed zero without inventing new evidence", () => {
    for (const state of [undefined, false]) {
      const doc = fixture(); doc.gameContext.nicoleSkillInitial!.noOtherEventsBeforeInitial = state;
      const before = structuredClone(doc), out = refreshNicoleSkillInitialWeaponEffects(doc);
      expect(out).toMatchObject({ status: "blocked", blocked: true, refreshed: false });
      expect(out.document).toBe(doc); expect(doc).toEqual(before); expect(bonus(doc)).toBe(0);
    }
    const zero = fixture(); Object.assign(zero.gameContext.nicoleSkillInitial!, {
      skillGrantNonExtraAttack: 0, grantAttackSource: "observed", includedSkillAttack: 120.5 });
    const out = refreshNicoleSkillInitialWeaponEffects(zero);
    expect(out.status).toBe("refreshed"); expect(bonus(out.document as NicoleSkillInitialDocument)).toBe(0);
    const explicit = fixture(); Object.assign(explicit.gameContext.nicoleSkillInitial!, {
      skillGrantNonExtraAttack: 1200, grantAttackSource: "observed", includedSkillAttack: 120.5 });
    expect(bonus(refreshNicoleSkillInitialWeaponEffects(explicit).document as NicoleSkillInitialDocument)).toBeCloseTo(.12, 12);
  });
  it("blocks mismatched, missing, duplicated or foreign-slot signature evidence without erasing it", () => {
    const mutations = [
      (doc: NicoleSkillInitialDocument) => { if (doc.build.mode === "equipment-derived") doc.build.equipment!.dynamicHitBonuses![0]!.sourceRefs = ["fixture:forged-source"]; },
      (doc: NicoleSkillInitialDocument) => { if (doc.build.mode === "equipment-derived") doc.build.equipment!.statModifiers = []; },
      (doc: NicoleSkillInitialDocument) => { if (doc.build.mode === "equipment-derived") doc.build.equipment!.dynamicHitBonuses!.push(structuredClone(doc.build.equipment!.dynamicHitBonuses![0]!)); },
      (doc: NicoleSkillInitialDocument) => { if (doc.build.mode === "equipment-derived") doc.build.equipment!.effectContext!.weaponEffectActive = true; },
      (doc: NicoleSkillInitialDocument) => { if (doc.build.mode === "equipment-derived") doc.build.equipment!.hitBonuses = [{ id: "weapon:14523:r1:unreviewed", label: "do not remove", value: .5, sourceRef: "fixture:foreign-slot" }]; }
    ];
    for (const mutate of mutations) {
      const doc = fixture(); mutate(doc); const before = structuredClone(doc), out = refreshNicoleSkillInitialWeaponEffects(doc);
      expect(out).toMatchObject({ status: "blocked", blocked: true, refreshed: false });
      expect(out.document).toBe(doc); expect(doc).toEqual(before);
    }
  });
  it("leaves historical snapshots and other equipment outside automatic refresh", () => {
    const historical = fixture(), hit = historical.hits[0]!;
    if (hit.kind !== "ordinary") throw new Error("ordinary");
    hit.finalSnapshot = { origin: "equipment-conversion", stats: resolveCalculatorStats(historical.build), characterLevel: 90,
      ascension: 6, damageBonus: .123, additiveBaseDamage: 0, reactionBonus: 0, source: "historical observation", sourceRefs: ["fixture:old"] };
    historical.gameContext.nicoleSkillInitial!.finalizedHitState = "fixture:original-identity";
    const before = JSON.stringify(historical), out = refreshNicoleSkillInitialWeaponEffects(historical);
    expect(out).toMatchObject({ status: "not-applicable", blocked: false, refreshed: false });
    expect(out.document).toBe(historical); expect(JSON.stringify(historical)).toBe(before);
    const other = fixture(); if (other.build.mode !== "equipment-derived") throw new Error("equipment");
    other.build.equipment!.weaponEffectsEnabled = false;
    expect(refreshNicoleSkillInitialWeaponEffects(other).status).toBe("not-applicable");
  });
});
