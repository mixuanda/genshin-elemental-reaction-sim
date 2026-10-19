import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { evaluateFormulaExpression } from "../../sim-core/src/calculation-trace";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, resolveCalculatorStats, serializeCalculatorDocument } from "../../sim-core/src/calculator";
import { loadWorkedExample } from "../../sim-core/src/worked-examples";
import { gameDataCatalog } from "./catalog";
import { resolveEquipmentBuild } from "./equipment-build";
import type { EquipmentFormulaContext } from "./equipment-formulas";
import type { EquipmentHitEffectResolution } from "./weapon-hit-effect-types";
import { resolveWeaponMeleeHitEffects, SUPPORTED_WEAPON_MELEE_HIT_IDS } from "./weapon-melee-hit-effects";
import { resolveWeaponRangedHitEffects, SUPPORTED_WEAPON_RANGED_HIT_IDS } from "./weapon-ranged-hit-effects";
import { resolveWeaponPolearmHitEffects, SUPPORTED_WEAPON_POLEARM_HIT_IDS } from "./weapon-polearm-hit-effects";
import meleeFixtures from "../sources/weapon-melee-hit-effects/reviewed-expectations.json";
import rangedFixtures from "../sources/weapon-ranged-hit-effects/reviewed-expectations.json";
import polearmFixtures from "../sources/weapon-polearm-hit-effects/reviewed-expectations.json";
import meleeManifest from "../sources/weapon-melee-hit-effects/manifest.json";
import rangedManifest from "../sources/weapon-ranged-hit-effects/manifest.json";
import polearmManifest from "../sources/weapon-polearm-hit-effects/manifest.json";

interface Expectation {
  additiveBase: { element: string; attackTag: string; bonus: number }[];
  critical: { element: string; attackTag: string; critRate: number; critDamage: number }[];
}
interface Case { weaponId: string; slug: string; context: EquipmentFormulaContext; bindings?: Record<string, number>; expectedR1: Expectation; expectedR5: Expectation }
type Resolver = (args: { weaponId: string; refinement: number; enabled: boolean; context?: EquipmentFormulaContext }) => EquipmentHitEffectResolution;
const batches: { name: string; ids: readonly string[]; cases: Case[]; resolve: Resolver }[] = [
  { name: "melee", ids: SUPPORTED_WEAPON_MELEE_HIT_IDS, cases: meleeFixtures.cases as Case[], resolve: resolveWeaponMeleeHitEffects },
  { name: "ranged", ids: SUPPORTED_WEAPON_RANGED_HIT_IDS, cases: rangedFixtures.cases as Case[], resolve: resolveWeaponRangedHitEffects },
  { name: "polearm", ids: SUPPORTED_WEAPON_POLEARM_HIT_IDS, cases: polearmFixtures.cases as Case[], resolve: resolveWeaponPolearmHitEffects }
];
function totals(result: EquipmentHitEffectResolution, bindings: Record<string, number> = {}) {
  const applies = (rule: { elements?: readonly string[]; attackTags?: readonly string[] }, element: string, attackTag: string) => (!rule.elements || rule.elements.includes(element)) && (!rule.attackTags || rule.attackTags.includes(attackTag));
  const evaluate = (rule: EquipmentHitEffectResolution["additiveBaseBonuses"][number]) => evaluateFormulaExpression(rule.expression, { ...bindings, ...Object.fromEntries(rule.inputs.map(input => [input.key, input.value])) });
  const base = (element: string, tag: string) => result.additiveBaseBonuses.filter(rule => applies(rule, element, tag)).reduce((sum, rule) => sum + evaluate(rule), 0);
  const crit = (element: string, tag: string, target: "critRate" | "critDamage") => result.criticalBonuses.filter(rule => rule.target === target && applies(rule, element, tag)).reduce((sum, rule) => sum + evaluate(rule), 0);
  return { result, base, crit };
}
for (const batch of batches) it.each(batch.cases)(`executes source-backed ${batch.name} $slug hit-specific terms at every legal refinement`, row => {
  const weapon = gameDataCatalog.weapons.find(entry => entry.id === row.weaponId)!;
  for (const rank of weapon.refinements) {
    const actual = totals(batch.resolve({ weaponId: row.weaponId, refinement: rank.rank, enabled: true, context: row.context }), row.bindings);
    expect(actual.result.missingConditions).toEqual([]);
    expect(actual.result.sourceRefs.some(ref => ref.includes("b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541"))).toBe(true);
    for (const term of actual.result.additiveBaseBonuses) expect(term.inputPolicy).toBe("final-panel");
    const expected = rank.rank === 1 ? row.expectedR1 : rank.rank === 5 ? row.expectedR5 : undefined;
    if (!expected) continue;
    for (const item of expected.additiveBase) expect(actual.base(item.element, item.attackTag), `${row.slug} R${rank.rank} base ${item.attackTag}`).toBeCloseTo(item.bonus, 12);
    for (const item of expected.critical) {
      expect(actual.crit(item.element, item.attackTag, "critRate"), `${row.slug} R${rank.rank} CR ${item.attackTag}`).toBeCloseTo(item.critRate, 12);
      expect(actual.crit(item.element, item.attackTag, "critDamage"), `${row.slug} R${rank.rank} CD ${item.attackTag}`).toBeCloseTo(item.critDamage, 12);
    }
  }
});

it("preserves the exact reused source bytes and covers every new hit-specific definition", () => {
  for (const batch of batches) expect(new Set(batch.cases.map(row => row.weaponId))).toEqual(new Set(batch.ids));
  for (const [archive, files] of [["weapon-melee-hit-effects", meleeManifest.files], ["weapon-ranged-hit-effects", rangedManifest.files], ["weapon-polearm-hit-effects", polearmManifest.files]] as const) {
    for (const file of files) {
      const bytes = readFileSync(new URL(`../sources/${archive}/${file.file}`, import.meta.url));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(file.sha256);
    }
  }
});

it("requires explicit remaining counts and keeps independent Wolf-Fang and lingering Silvershower conditions", () => {
  const foliar = (context: EquipmentFormulaContext) => totals(resolveWeaponMeleeHitEffects({ weaponId: "weapon:11512", refinement: 1, enabled: true, context }), { em: 500 });
  expect(foliar({ weaponEffectActive: true }).result.pendingHitEffects.map(effect => effect.reason).join()).toContain("weaponStacks");
  expect(foliar({ weaponEffectActive: false }).result.pendingHitEffects).toEqual([]);
  expect(foliar({ weaponEffectActive: true, weaponStacks: 0 }).base("dendro", "normal")).toBe(0);
  expect(foliar({ weaponEffectActive: true, weaponStacks: 1, offField: true }).base("dendro", "normal")).toBe(0);
  expect(foliar({ weaponEffectActive: true, weaponStacks: 1, offField: false }).base("physical", "normal")).toBe(600);
  const hunter = (context: EquipmentFormulaContext) => totals(resolveWeaponRangedHitEffects({ weaponId: "weapon:15511", refinement: 1, enabled: true, context }), { em: 500 });
  expect(hunter({ weaponEffectActive: true }).result.pendingHitEffects.map(effect => effect.reason).join()).toContain("weaponStacks");
  expect(hunter({ weaponEffectActive: true, weaponStacks: 0 }).base("dendro", "charged")).toBe(0);
  const wolf = totals(resolveWeaponMeleeHitEffects({ weaponId: "weapon:11424", refinement: 1, enabled: true, context: { weaponSkillStacks: 4, weaponBurstStacks: 1 } }));
  expect(wolf.crit("cryo", "skill", "critRate")).toBe(.08);
  expect(wolf.crit("cryo", "burst", "critRate")).toBe(.02);
  expect(wolf.crit("cryo", "normal", "critRate")).toBe(0);
  const whiteRain = (context: EquipmentFormulaContext) => totals(resolveWeaponRangedHitEffects({ weaponId: "weapon:15513", refinement: 1, enabled: true, context }));
  expect(whiteRain({ weaponStacks: 3, burstEffectActive: false }).crit("hydro", "burst", "critRate")).toBe(.28);
  expect(whiteRain({ weaponStacks: 2, burstEffectActive: true }).crit("hydro", "burst", "critRate")).toBe(.28);
  expect(whiteRain({ weaponStacks: 2, burstEffectActive: false }).crit("hydro", "burst", "critRate")).toBe(0);
});

const basic = { level: 1, ascension: 0, weaponLevel: 1, weaponAscension: 0, refinement: 1, effectsDisabled: true, weaponEffectsEnabled: true };
it("routes Redhorn DEF base and Catch burst CR through real builds, source traces and final-panel replay", () => {
  const doc = loadWorkedExample("fixture-a"), original = doc.hits[0]!;
  if (original.kind !== "ordinary") throw new Error("Expected ordinary fixture");
  doc.scope = "one-cast";
  doc.hits = [{ ...original, id: "normal", attackTag: "normal", element: "physical", additiveBaseDamage: 7, damageBonus: 0 }, { ...original, id: "skill", attackTag: "skill", element: "geo", additiveBaseDamage: 7, damageBonus: 0 }];
  doc.selectedHitIds = ["normal", "skill"];
  doc.build = resolveEquipmentBuild({ ...basic, characterId: "character:10000034", weaponId: "weapon:12510" }).build;
  expect(doc.build.flatAtk).toBe(0);
  const panel = resolveCalculatorStats(doc.build);
  const restored = parseCalculatorDocument(serializeCalculatorDocument(doc)), actual = calculateDocument(restored);
  expect(actual.hits[0]?.trace.find(node => node.id === "equipmentBaseAddition.0")?.result?.value).toBeCloseTo(panel.def * .4, 10);
  expect(actual.hits[0]?.trace.find(node => node.id === "equipmentAndManualBaseAddition")?.result?.value).toBeCloseTo(7 + panel.def * .4, 10);
  expect(actual.hits[1]?.trace.find(node => node.id === "equipmentBaseAddition.0")?.status).toBe("not-applicable");
  expect(calculateDocument(convertCalculatorToFinalPanel(restored)).totals).toEqual(actual.totals);
  doc.build = resolveEquipmentBuild({ ...basic, characterId: "character:10000023", weaponId: "weapon:13415" }).build;
  const second = doc.hits[1]!;
  if (second.kind !== "ordinary") throw new Error("Expected ordinary second hit");
  doc.hits[1] = { ...second, attackTag: "burst" };
  const catchOutput = calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(doc))), catchPanel = resolveCalculatorStats(doc.build);
  expect(catchOutput.hits[0]?.trace.find(node => node.id === "applicableCritRate")?.result?.value).toBeCloseTo(catchPanel.critRate, 12);
  expect(catchOutput.hits[1]?.trace.find(node => node.id === "applicableCritRate")?.result?.value).toBeCloseTo(catchPanel.critRate + .06, 12);
  expect(doc.build.equipment?.criticalBonuses?.[0]?.sourceRefs.some(ref => ref.endsWith("/catch/catch.go"))).toBe(true);
});

it("registers Moonglow and Cinnabar as executable hit clauses without keeping obsolete all-unimplemented blockers", () => {
  const moon = resolveEquipmentBuild({ ...basic, characterId: "character:10000006", weaponId: "weapon:14506" });
  expect(moon.build.equipment.additiveBaseBonuses).toHaveLength(1);
  expect(moon.effectBlockers.join()).not.toMatch(/普通攻击.*追加.*超出当前公式槽位/);
  const cinnabar = resolveEquipmentBuild({ ...basic, characterId: "character:10000015", weaponId: "weapon:11415", effectContext: { weaponEffectActive: true } });
  expect(cinnabar.build.equipment.additiveBaseBonuses).toHaveLength(1);
  expect(cinnabar.effectBlockers.join()).toMatch(/冷却|TODO/);
});
