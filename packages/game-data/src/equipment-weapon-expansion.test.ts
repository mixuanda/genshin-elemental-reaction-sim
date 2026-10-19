import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { evaluateFormulaExpression } from "../../sim-core/src/calculation-trace";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument } from "../../sim-core/src/calculator";
import { loadWorkedExample } from "../../sim-core/src/worked-examples";
import { gameDataCatalog } from "./catalog";
import { getConditionalEquipmentCoverage, resolveEquipmentBuild } from "./equipment-build";
import type { EquipmentFormulaContext, EquipmentFormulaResolution } from "./equipment-formulas";
import { resolveWeaponPolearmEffects, SUPPORTED_WEAPON_POLEARM_IDS } from "./weapon-polearm-effects";
import { resolveWeaponBowEffects, SUPPORTED_WEAPON_BOW_IDS } from "./weapon-bow-effects";
import { resolveWeaponCatalystEffects, SUPPORTED_WEAPON_CATALYST_IDS } from "./weapon-catalyst-effects";
import { resolveWeaponExtendedEffects, SUPPORTED_WEAPON_EXTENDED_IDS } from "./weapon-extended-effects";
import polearmExpectations from "../sources/weapon-polearm-effects/reviewed-expectations.json";
import polearmManifest from "../sources/weapon-polearm-effects/manifest.json";
import bowExpectations from "../sources/weapon-bow-effects/reviewed-expectations.json";
import bowManifest from "../sources/weapon-bow-effects/manifest.json";
import catalystExpectations from "../sources/weapon-catalyst-effects/expected-fixtures.json";
import catalystManifest from "../sources/weapon-catalyst-effects/manifest.json";
import extendedExpectations from "../sources/weapon-extended-effects/reviewed-expectations.json";
import extendedManifest from "../sources/weapon-extended-effects/manifest.json";

interface PassiveExpectation { stats: Record<string, number>; hits: { element: string; attackTag: string; bonus: number }[]; reactionBonus?: number | null; reactions?: { reaction: string; bonus: number }[] }
interface Case { weaponId: string; slug: string; characterId?: string; context: EquipmentFormulaContext; bindings?: Record<string, number>; expectedR1: PassiveExpectation; expectedR5?: PassiveExpectation }
type Resolution = EquipmentFormulaResolution & { reactionBonuses?: { reactions: string[]; value: number }[] };
type Resolver = (args: { weaponId: string; characterId?: string; refinement: number; enabled: boolean; context?: EquipmentFormulaContext }) => Resolution;
const batches: { name: string; ids: readonly string[]; cases: Case[]; resolve: Resolver }[] = [
  { name: "polearm", ids: SUPPORTED_WEAPON_POLEARM_IDS, cases: polearmExpectations.cases as Case[], resolve: resolveWeaponPolearmEffects },
  { name: "bow", ids: SUPPORTED_WEAPON_BOW_IDS, cases: bowExpectations.cases as Case[], resolve: resolveWeaponBowEffects },
  { name: "catalyst", ids: SUPPORTED_WEAPON_CATALYST_IDS, cases: catalystExpectations.cases as Case[], resolve: resolveWeaponCatalystEffects },
  { name: "sword-claymore", ids: SUPPORTED_WEAPON_EXTENDED_IDS, cases: extendedExpectations.cases as Case[], resolve: resolveWeaponExtendedEffects }
];
function totals(result: Resolution, bindings: Record<string, number> = {}) {
  const vars = (inputs: { key: string; value: number }[]) => ({ ...bindings, ...Object.fromEntries(inputs.map(term => [term.key, term.value])) });
  const stats: Record<string, number> = {};
  for (const modifier of result.statModifiers) stats[modifier.target] = (stats[modifier.target] ?? 0) + evaluateFormulaExpression(modifier.expression, vars(modifier.inputs));
  const hit = (element: string, attackTag: string) => result.dynamicHitBonuses.filter(bonus => (!bonus.elements || bonus.elements.some(value => value === element)) && (!bonus.attackTags || bonus.attackTags.some(value => value === attackTag))).reduce((sum, bonus) => sum + evaluateFormulaExpression(bonus.expression, vars(bonus.inputs)), 0);
  const reaction = (name: string) => (result.reactionBonuses ?? []).filter(bonus => bonus.reactions.includes(name)).reduce((sum, bonus) => sum + bonus.value, 0);
  return { result, stats, hit, reaction };
}
for (const batch of batches) it.each(batch.cases)(`executes ${batch.name} $slug from fixed sources at legal refinements`, row => {
  const weapon = gameDataCatalog.weapons.find(entry => entry.id === row.weaponId)!;
  for (const rank of weapon.refinements) {
    const actual = totals(batch.resolve({ weaponId: row.weaponId, ...(row.characterId ? { characterId: row.characterId } : {}), refinement: rank.rank, enabled: true, context: row.context }), row.bindings);
    expect(actual.result.missingConditions).toEqual([]);
    expect(actual.result.sourceRefs.some(ref => ref.includes("b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541") || ref.includes("180a0a1015cb725c7570cd828eb086749960df98"))).toBe(true);
    const expected = rank.rank === 1 ? row.expectedR1 : rank.rank === 5 ? row.expectedR5 : undefined;
    if (!expected) continue;
    expect(Object.keys(actual.stats).sort()).toEqual(Object.keys(expected.stats).sort());
    for (const [key, value] of Object.entries(expected.stats)) expect(actual.stats[key], `${row.slug} R${rank.rank} ${key}`).toBeCloseTo(value, 12);
    for (const hit of expected.hits) expect(actual.hit(hit.element, hit.attackTag), `${row.slug} R${rank.rank} ${hit.attackTag}`).toBeCloseTo(hit.bonus, 12);
    if (expected.reactionBonus != null) expect(actual.reaction("electroCharged")).toBeCloseTo(expected.reactionBonus, 12);
    for (const reaction of expected.reactions ?? []) expect(actual.reaction(reaction.reaction)).toBeCloseTo(reaction.bonus, 12);
  }
});
it("keeps archived evidence hashes and newly supported identities consistent", () => {
  for (const batch of batches) expect(new Set(batch.cases.map(row => row.weaponId))).toEqual(new Set(batch.ids));
  for (const [archive, files] of [["weapon-polearm-effects", polearmManifest.files], ["weapon-bow-effects", bowManifest.files], ["weapon-catalyst-effects", catalystManifest.files], ["weapon-extended-effects", extendedManifest.files]] as const) {
    for (const file of files) {
      const path = "path" in file ? file.path : file.file;
      const bytes = readFileSync(new URL(`../sources/${archive}/${path}`, import.meta.url));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(file.sha256);
    }
  }
  const coverage = getConditionalEquipmentCoverage();
  expect(coverage.weaponDefinitions).toBeGreaterThanOrEqual(99);
  expect(coverage.independentlyVerifiedDefinitions).toBe(0);
});
const pole = (weaponId: string, context: EquipmentFormulaContext) => totals(resolveWeaponPolearmEffects({ weaponId, refinement: 1, enabled: true, context }));
it("keeps Heretic's Molten Blade inactive, unresolved, and confirmed tiers distinct", () => {
  const resolve = (context: EquipmentFormulaContext) => totals(resolveWeaponExtendedEffects({ weaponId: "weapon:11435", refinement: 1, enabled: true, context }));
  expect(resolve({ weaponEffectActive: false }).stats.atkPercent).toBe(0);
  expect(resolve({ weaponEffectActive: true }).result.missingConditions.join()).toContain("weaponStacks");
  expect(resolve({ weaponEffectActive: true, weaponStacks: 0 }).stats.atkPercent).toBeCloseTo(0.18, 12);
  expect(resolve({ weaponEffectActive: true, weaponStacks: 9 }).stats.atkPercent).toBeCloseTo(0.27, 12);
  expect(resolve({ weaponEffectActive: true, weaponStacks: 18 }).stats.atkPercent).toBeCloseTo(0.36, 12);
  expect(() => resolve({ weaponEffectActive: true, weaponStacks: 19 })).toThrow(/0–18/);
});
it("distinguishes exact threshold, tag and target conditions without inferring missing states", () => {
  expect(pole("weapon:13512", { bondOfLifeRatio: 0 }).hit("pyro", "normal")).toBe(0);
  expect(pole("weapon:13512", { bondOfLifeRatio: .299 }).hit("pyro", "normal")).toBe(.12);
  expect(pole("weapon:13512", { bondOfLifeRatio: .3 }).hit("pyro", "normal")).toBe(.36);
  expect(pole("weapon:13424", { teamDistinctElementCount: 2 }).stats.em).toBe(0);
  expect(pole("weapon:13424", {}).result.missingConditions.join()).toContain("teamDistinctElementCount");
  expect(pole("weapon:13303", { targetIsSlime: false }).hit("physical", "normal")).toBe(0);
  expect(pole("weapon:13434", { weaponStacks: 3 }).result.effectBlockers.join()).toContain("300帧");
  expect(pole("weapon:13415", {}).stats.critRate).toBeUndefined();
  expect(pole("weapon:13415", {}).result.assumptions.join()).toContain("逐命中");
  expect(pole("weapon:13433", {}).reaction("overload")).toBe(0);
});

it("keeps R1-only platform passives tied to the real owner and keeps unmodeled terms scoped", () => {
  const predator = { weaponId: "weapon:15415", refinement: 1, enabled: true, context: { platformPassiveActive: true, weaponStacks: 2 } };
  expect(totals(resolveWeaponBowEffects({ ...predator, characterId: "character:10000062" })).stats.flatAtk).toBe(66);
  expect(totals(resolveWeaponBowEffects({ ...predator, characterId: "character:10000021" })).stats.flatAtk).toBe(0);
  expect(() => resolveWeaponBowEffects({ ...predator, characterId: "character:10000062", refinement: 2 })).toThrow(/精炼/);
  const descension = { weaponId: "weapon:11412", refinement: 1, enabled: true, context: { platformPassiveActive: true } };
  expect(totals(resolveWeaponExtendedEffects({ ...descension, characterId: "character:10000005" })).stats.flatAtk).toBe(66);
  expect(totals(resolveWeaponExtendedEffects({ ...descension, characterId: "character:10000015" })).stats.flatAtk).toBe(0);
  expect(() => resolveWeaponExtendedEffects({ ...descension, characterId: "character:10000005", refinement: 2 })).toThrow(/精炼/);
  const kagura = totals(resolveWeaponCatalystEffects({ weaponId: "weapon:14509", refinement: 1, enabled: true, context: { weaponStacks: 3 } }));
  expect(kagura.hit("electro", "skill")).toBeCloseTo(.48, 12);
  expect(kagura.hit("physical", "normal")).toBe(0);
  expect(kagura.result.effectBlockers.join()).toMatch(/16秒.*24秒/);
});

const baseBuild = { characterId: "character:10000023", level: 1, ascension: 0, weaponLevel: 1, weaponAscension: 0, refinement: 1, effectsDisabled: true, weaponEffectsEnabled: true };
it("executes new ordinary and reaction terms in the actual shared build and preserves JSON/final-panel replay", () => {
  const doc = loadWorkedExample("fixture-a"), base = doc.hits[0]!;
  if (base.kind !== "ordinary") throw new Error("Expected ordinary fixture");
  base.damageBonus = 0;
  doc.scope = "one-cast";
  doc.hits = [{ ...base, id: "normal", attackTag: "normal" }, { ...base, id: "skill", attackTag: "skill" }];
  doc.selectedHitIds = ["normal", "skill"];
  doc.build = resolveEquipmentBuild({ ...baseBuild, weaponId: "weapon:13517", effectContext: { normalHitEffectActive: true, skillBurstHitEffectActive: false, witchLessonsCompleted: true } }).build;
  const restored = parseCalculatorDocument(serializeCalculatorDocument(doc)), actual = calculateDocument(restored);
  expect(actual.hits[0]?.trace.find(node => node.id === "applicableDamageBonus")?.result?.value).toBeCloseTo(.7, 12);
  expect(actual.hits[1]?.trace.find(node => node.id === "applicableDamageBonus")?.result?.value).toBe(0);
  expect(calculateDocument(convertCalculatorToFinalPanel(restored)).totals).toEqual(actual.totals);
  const reactionDoc = loadWorkedExample("transformative"), reactionHit = reactionDoc.hits[0]!;
  if (reactionHit.kind !== "transformative") throw new Error("Expected transformative fixture");
  reactionHit.reaction = "electroCharged"; reactionHit.reactionBonus = 0;
  reactionDoc.build = resolveEquipmentBuild({ ...baseBuild, weaponId: "weapon:13433" }).build;
  expect(calculateDocument(reactionDoc).hits[0]?.trace.find(node => node.id === "applicableReactionBonus")?.result?.value).toBe(.48);
  expect(() => resolveEquipmentBuild({ ...baseBuild, weaponId: "weapon:13512" })).toThrow(/bondOfLifeRatio/);
});
