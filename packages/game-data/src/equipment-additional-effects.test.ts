import { expect, it } from "vitest";
import { evaluateFormulaExpression } from "../../sim-core/src/calculation-trace";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, resolveCalculatorStats, serializeCalculatorDocument } from "../../sim-core/src/calculator";
import { loadWorkedExample } from "../../sim-core/src/worked-examples";
import { resolveArtifactAdditionalEffects } from "./artifact-additional-effects";
import { getArtifactConditionalControls, type ArtifactConditionalContext } from "./artifact-conditional-effects";
import { getConditionalEquipmentCoverage, resolveEquipmentBuild } from "./equipment-build";
import type { ArtifactPieceInput } from "./artifact-build";
import { resolveWeaponAdditionalEffects, SUPPORTED_WEAPON_ADDITIONAL_IDS, type EquipmentAdditionalWeaponContext } from "./weapon-additional-effects";
import weaponExpectations from "../sources/weapon-additional-effects/reviewed-expectations.json";

const context: ArtifactConditionalContext = { hpFraction: 0.6, enemyHpFraction: 0.8, enemyAuras: ["pyro", "electro"], setEffectActive: true, setExtraEffectActive: true, setNormalEffectActive: true, setBurstEffectActive: false, shielded: true, setStacks: 3, sameElementTeammates: 1, differentElementTeammates: 2, witchLessonsCompleted: true, moonsignLevel: 2, setBuffElements: ["pyro"], setExtraBuffElements: ["pyro"] };
const artifactCases = [
  [10005, "physical", "normal", { critRate: .24 }], [10002, "physical", "normal", { hitBonus: .3 }],
  [15008, "pyro", "charged", { hitBonus: .5 }], [10006, "physical", "normal", { hitBonus: .25 }],
  [15007, "physical", "normal", { atkPercent: .2 }], [10007, "physical", "normal", { em: 120 }],
  [14003, "physical", "normal", { hitBonus: .35 }], [14002, "pyro", "normal", { hitBonus: .35 }],
  [15015, "physical", "charged", { hitBonus: .4 }], [15027, "anemo", "plunge", { hitBonus: .4 }],
  [15035, "physical", "normal", { hitBonus: .54 }], [15039, "physical", "plunge", { hitBonus: .45 }],
  [15036, "physical", "normal", { hitBonus: .3 }], [15034, "geo", "skill", { hitBonus: .5 }],
  [15026, "physical", "normal", { atkPercent: .14, em: 100 }], [15038, "physical", "normal", { critRate: .4 }],
  [15040, "cryo", "normal", { hitBonus: .6 }], [15014, "pyro", "skill", { hitBonus: .35 }],
  [15037, "pyro", "skill", { hitBonus: .4 }], [15044, "physical", "normal", { atkPercent: .25, critRate: .2 }],
  [15045, "pyro", "skill", { hitBonus: .4 }], [15041, "physical", "normal", { critRate: .3 }],
  [15042, "physical", "normal", { em: 120 }], [15047, "physical", "normal", { critRate: .16 }],
  [15048, "physical", "normal", { atkPercent: .12 }], [15017, "physical", "normal", { atkPercent: .2 }],
  [15046, "cryo", "skill", { reactionBonus: .8 }]
] as const;

function artifactTotals(id: number, state: ArtifactConditionalContext = context, element = "physical", tag = "normal") {
  const result = resolveArtifactAdditionalEffects({ setId: `artifact-set:${id}`, pieces: 4, enabled: true, context: state });
  const values: Record<string, number> = {};
  for (const modifier of result.statModifiers) values[modifier.target] = (values[modifier.target] ?? 0) + evaluateFormulaExpression(modifier.expression, Object.fromEntries(modifier.inputs.map(term => [term.key, term.value])));
  for (const bonus of result.dynamicHitBonuses) {
    if (bonus.elements && !bonus.elements.some(value => value === element)) continue;
    if (bonus.attackTags && !bonus.attackTags.some(value => value === tag)) continue;
    values.hitBonus = (values.hitBonus ?? 0) + evaluateFormulaExpression(bonus.expression, Object.fromEntries(bonus.inputs.map(term => [term.key, term.value])));
  }
  values.reactionBonus = result.reactionBonuses.filter(bonus => bonus.reactions.includes("superconduct")).reduce((sum, bonus) => sum + bonus.value, 0);
  return { result, values };
}

it.each(artifactCases)("executes the fixed-source four-piece contribution for artifact %i", (id, element, tag, expected) => {
  const { result, values } = artifactTotals(id, context, element, tag);
  expect(result.missingConditions).toEqual([]);
  expect(result.sourceRefs.some(ref => ref.includes("b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541") || ref.includes("180a0a1015cb725c7570cd828eb086749960df98"))).toBe(true);
  for (const [key, value] of Object.entries(expected)) expect(values[key]).toBeCloseTo(value, 12);
});

it("preserves boundary conflicts, attack filters, independent windows and explicit counts", () => {
  expect(artifactTotals(10005, { hpFraction: .7 }).result.missingConditions.join()).toMatch(/边界|70%/);
  expect(artifactTotals(10005, { hpFraction: .71 }).values.critRate).toBe(0);
  expect(artifactTotals(10002, { enemyHpFraction: .5 }).values.hitBonus).toBe(0);
  expect(artifactTotals(15008, context, "pyro", "normal").values.hitBonus).toBeUndefined();
  expect(artifactTotals(15040, context, "cryo", "burst").values.hitBonus).toBe(0);
  expect(artifactTotals(15040, context, "cryo", "skill").values.hitBonus).toBeUndefined();
  expect(artifactTotals(15037, { setBuffElements: [], setExtraBuffElements: ["hydro"] }, "hydro", "skill").values.hitBonus).toBe(.28);
  expect(artifactTotals(15037, { setBuffElements: ["pyro"], setExtraBuffElements: [] }, "hydro", "skill").values.hitBonus).toBeUndefined();
  expect(() => artifactTotals(15014, { setBuffElements: ["pyro", "hydro"] })).toThrow(/最多1/);
  expect(() => artifactTotals(15026, { setEffectActive: true, sameElementTeammates: 2, differentElementTeammates: 2 })).toThrow(/不能超过3/);
  expect(artifactTotals(15034, { setEffectActive: false }).result.missingConditions).toEqual([]);
  expect(artifactTotals(15034, { setEffectActive: true, setExtraEffectActive: false }, "geo").values.hitBonus).toBe(.2);
  expect(artifactTotals(15041, { setEffectActive: true, moonsignLevel: 1 }).values.critRate).toBe(.15);
  expect(artifactTotals(15042, { setEffectActive: true, moonsignLevel: 0 }).values.em).toBe(0);
  expect(artifactTotals(15044, { setEffectActive: true, witchLessonsCompleted: false }).values.critRate).toBe(0);
  expect(getArtifactConditionalControls({ "artifact-set:15037": 4 }).map(control => control.kind)).toEqual(["elements", "elements"]);
  // Includes the reviewed remaining-set expansion, not only the original batch.
  expect(getConditionalEquipmentCoverage()).toMatchObject({ twoPieceArtifactDefinitions: 53, fourPieceArtifactDefinitions: 48, formulaArtifactDefinitions: 46, reactionArtifactDefinitions: 6, independentlyVerifiedDefinitions: 0 });
});

const fourPieces = (setId: string): ArtifactPieceInput[] => (["flower", "plume", "sands", "goblet"] as const).map(slot => ({ slot, setId, rarity: 5, level: 0, mainStat: slot === "flower" ? "hp" : slot === "plume" ? "atk" : "hp_", initialSubstats: 3, substats: [{ stat: "critRate_", rolls: [0] }, { stat: "critDMG_", rolls: [0] }, { stat: "atk_", rolls: [0] }] }));
const basicBuild = { characterId: "character:10000015", weaponId: "weapon:11101", level: 1, ascension: 0, weaponLevel: 1, weaponAscension: 0, refinement: 1, effectsDisabled: true, setEffectsEnabled: true };

it("restores Cinder independent element windows and Obsidian two/four independence in the actual shared build", () => {
  const doc = loadWorkedExample("fixture-a");
  const base = doc.hits[0]!;
  if (base.kind !== "ordinary") throw new Error("Expected ordinary fixture");
  base.damageBonus = 0;
  doc.scope = "one-cast";
  doc.hits = [{ ...base, id: "pyro", element: "pyro", attackTag: "skill" }, { ...base, id: "hydro", element: "hydro", attackTag: "skill" }];
  doc.selectedHitIds = ["pyro", "hydro"];
  doc.build = resolveEquipmentBuild({ ...basicBuild, artifacts: fourPieces("artifact-set:15037"), effectContext: { setBuffElements: ["pyro"], setExtraBuffElements: ["hydro"] } }).build;
  const restored = parseCalculatorDocument(serializeCalculatorDocument(doc));
  const actual = calculateDocument(restored);
  expect(actual.hits.map(hit => hit.trace.find(node => node.id === "applicableDamageBonus")?.result?.value)).toEqual([.12, .28]);
  expect(calculateDocument(convertCalculatorToFinalPanel(restored)).totals).toEqual(actual.totals);
  const obsidian = resolveEquipmentBuild({ ...basicBuild, artifacts: fourPieces("artifact-set:15038"), effectContext: { nightsoulFrontlineActive: false, setEffectActive: true } });
  const disabled = resolveEquipmentBuild({ ...basicBuild, artifacts: fourPieces("artifact-set:15038"), setEffectsEnabled: false });
  expect(resolveCalculatorStats(obsidian.build).critRate - resolveCalculatorStats(disabled.build).critRate).toBeCloseTo(.4, 12);
  doc.build = obsidian.build;
  expect(calculateDocument(doc).hits.every(hit => hit.trace.find(node => node.id === "applicableDamageBonus")?.result?.value === 0)).toBe(true);
  const reactionDoc = loadWorkedExample("transformative");
  reactionDoc.build = resolveEquipmentBuild({ ...basicBuild, artifacts: fourPieces("artifact-set:15046") }).build;
  const reactionHit = reactionDoc.hits[0]!;
  if (reactionHit.kind !== "transformative") throw new Error("Expected transformative fixture");
  reactionHit.reaction = "superconduct"; reactionHit.reactionBonus = 0;
  expect(calculateDocument(reactionDoc).hits[0]?.trace.find(node => node.id === "applicableReactionBonus")?.result?.value).toBe(.8);
  reactionHit.reaction = "overload";
  expect(calculateDocument(reactionDoc).hits[0]?.trace.find(node => node.id === "applicableReactionBonus")?.result?.value).toBe(0);
});

interface PassiveExpectation { stats: Record<string, number>; hits: { element: string; attackTag: string; bonus: number }[] }
const weaponCases = weaponExpectations.cases as { weaponId: string; slug: string; context: EquipmentAdditionalWeaponContext; expectedR1: PassiveExpectation; expectedR5: PassiveExpectation }[];
function weaponTotals(weaponId: string, refinement: number, state: EquipmentAdditionalWeaponContext) {
  const result = resolveWeaponAdditionalEffects({ weaponId, refinement, enabled: true, context: state });
  const stats: Record<string, number> = {};
  for (const modifier of result.statModifiers) stats[modifier.target] = (stats[modifier.target] ?? 0) + evaluateFormulaExpression(modifier.expression, Object.fromEntries(modifier.inputs.map(term => [term.key, term.value])));
  const hit = (element: string, tag: string) => result.dynamicHitBonuses.filter(bonus => (!bonus.elements || bonus.elements.some(value => value === element)) && (!bonus.attackTags || bonus.attackTags.some(value => value === tag))).reduce((sum, bonus) => sum + evaluateFormulaExpression(bonus.expression, Object.fromEntries(bonus.inputs.map(term => [term.key, term.value]))), 0);
  return { result, stats, hit };
}

it.each(weaponCases)("executes new fixed-source weapon $slug across every refinement and independent endpoint expectations", row => {
  for (const refinement of [1, 2, 3, 4, 5]) {
    const output = weaponTotals(row.weaponId, refinement, row.context);
    expect(output.result.missingConditions).toEqual([]);
    if (refinement === 1 || refinement === 5) {
      const expected = refinement === 1 ? row.expectedR1 : row.expectedR5;
      expect(Object.keys(output.stats).sort()).toEqual(Object.keys(expected.stats).sort());
      for (const [key, value] of Object.entries(expected.stats)) expect(output.stats[key]).toBeCloseTo(value, 12);
      for (const hit of expected.hits) expect(output.hit(hit.element, hit.attackTag)).toBeCloseTo(hit.bonus, 12);
    }
  }
});

it("preserves weapon caps, independent windows, nonlinear stacks and explicit source-conflict branches", () => {
  expect(new Set(weaponCases.map(row => row.weaponId))).toEqual(new Set(SUPPORTED_WEAPON_ADDITIONAL_IDS));
  for (const weaponId of ["weapon:13416", "weapon:15416", "weapon:12416"]) {
    expect(weaponTotals(weaponId, 1, { teamBurstEnergyTotal: 1000 }).hit("pyro", "burst")).toBe(.4);
    expect(weaponTotals(weaponId, 5, { teamBurstEnergyTotal: 1000 }).hit("pyro", "burst")).toBe(.8);
  }
  expect(weaponTotals("weapon:13405", 1, { nearbyEnemyCount: 1 }).stats).toEqual({ atkPercent: .24, defPercent: 0 });
  expect(weaponTotals("weapon:15507", 1, { weaponStacks: 1 }).stats.atkPercent).toBe(.1);
  expect(weaponTotals("weapon:15507", 1, { weaponStacks: 3 }).stats.atkPercent).toBe(.3);
  const solar = weaponTotals("weapon:14405", 1, { normalHitEffectActive: true, skillBurstHitEffectActive: false });
  expect(["normal", "skill", "burst", "charged"].map(tag => solar.hit("pyro", tag))).toEqual([0, .2, .2, 0]);
  expect(weaponTotals("weapon:14301", 1, { enemyAuras: [], targetFrozen: false }).hit("pyro", "normal")).toBe(0);
  expect(weaponTotals("weapon:14301", 1, { enemyAuras: ["cryo"], targetFrozen: false }).result.missingConditions.join()).toContain("来源冲突");
  expect(weaponTotals("weapon:14301", 1, { enemyAuras: [], targetFrozen: true }).result.missingConditions.join()).toContain("来源冲突");
  expect(weaponTotals("weapon:14502", 1, { offField: true }).hit("pyro", "skill")).toBe(0);
  expect(getConditionalEquipmentCoverage().weaponDefinitions).toBeGreaterThanOrEqual(80);
});

it("routes new weapon definitions into the real equipment build, shared execution trace and JSON", () => {
  const doc = loadWorkedExample("fixture-a");
  const base = doc.hits[0]!;
  if (base.kind !== "ordinary") throw new Error("Expected ordinary fixture");
  base.damageBonus = 0;
  doc.scope = "one-cast";
  doc.hits = [{ ...base, id: "normal", attackTag: "normal" }, { ...base, id: "skill", attackTag: "skill" }];
  doc.selectedHitIds = ["normal", "skill"];
  doc.build = resolveEquipmentBuild({ ...basicBuild, characterId: "character:10000006", weaponId: "weapon:14405", weaponEffectsEnabled: true, effectContext: { normalHitEffectActive: true, skillBurstHitEffectActive: false } }).build;
  const restored = parseCalculatorDocument(serializeCalculatorDocument(doc));
  const output = calculateDocument(restored);
  expect(output.hits.map(hit => hit.trace.find(node => node.id === "applicableDamageBonus")?.result?.value)).toEqual([0, .2]);
  expect(calculateDocument(convertCalculatorToFinalPanel(restored)).totals).toEqual(output.totals);
  expect(() => resolveEquipmentBuild({ ...basicBuild, characterId: "character:10000006", weaponId: "weapon:14405", weaponEffectsEnabled: true })).toThrow(/normalHitEffectActive/);
  const kagura = resolveEquipmentBuild({ ...basicBuild, characterId: "character:10000006", weaponId: "weapon:14509", weaponEffectsEnabled: true, effectContext: { weaponStacks: 0 } });
  expect(kagura.effectBlockers.join()).toMatch(/16|24/);
});
