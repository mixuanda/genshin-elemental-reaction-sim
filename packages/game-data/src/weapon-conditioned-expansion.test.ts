import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { evaluateFormulaExpression } from "../../sim-core/src/calculation-trace";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, resolveCalculatorStats, serializeCalculatorDocument } from "../../sim-core/src/calculator";
import { loadWorkedExample } from "../../sim-core/src/worked-examples";
import { resolveEquipmentBuild } from "./equipment-build";
import type { EquipmentFormulaContext, EquipmentDynamicHitBonus, EquipmentStatModifier } from "./equipment-formulas";
import { resolveWeaponConditionedExpansionEffects as resolve, SUPPORTED_WEAPON_CONDITIONED_EXPANSION_IDS } from "./weapon-conditioned-expansion";
import manifest from "../sources/weapon-conditioned-expansion/manifest.json";

const value = (term: Pick<EquipmentDynamicHitBonus, "expression" | "inputs">, bindings: Record<string, number> = {}) => evaluateFormulaExpression(term.expression, { ...bindings, ...Object.fromEntries(term.inputs.map(input => [input.key, input.value])) });
const result = (weaponId: string, context: EquipmentFormulaContext, refinement = 1) => resolve({ weaponId, refinement, enabled: true, context });
const stat = (actual: ReturnType<typeof result>, target: EquipmentStatModifier["target"]) => actual.statModifiers.filter(term => term.target === target).reduce((sum, term) => sum + value(term), 0);
const applies = (term: EquipmentDynamicHitBonus, element: string, tag: string) => (!term.elements || (term.elements as string[]).includes(element)) && (!term.attackTags || (term.attackTags as string[]).includes(tag));
const damage = (actual: ReturnType<typeof result>, element: string, tag: string) => actual.dynamicHitBonuses.filter(term => applies(term, element, tag)).reduce((sum, term) => sum + value(term), 0);
const additive = (actual: ReturnType<typeof result>, tag: string) => actual.additiveBaseBonuses.filter(term => applies(term, "physical", tag)).reduce((sum, term) => sum + value(term, { atk: 2000 }), 0);

it("executes all 30 fixed-catalog refinements against independent Optimizer vectors and preserves source bytes", () => {
  // Transcribed from the archived production arrays, not calculated from our resolver or catalog values.
  const common = [.16, .20, .24, .28, .32], elemental = [.12, .15, .18, .21, .24], prototype = [.08, .10, .12, .14, .16];
  const clashAtk = [.20, .25, .30, .35, .40], clashEm = [100, 125, 150, 175, 200], echoes = [60, 75, 90, 105, 120];
  const forgedAtk = [.18, .225, .27, .315, .36], forgedEm = [120, 150, 180, 210, 240];
  const cases: Array<[string, EquipmentFormulaContext]> = [
    ["weapon:11430", { weaponEffectActive: true, weaponStacks: 18, offField: false }], ["weapon:12424", { weaponEffectActive: true, weaponExtraEffectActive: true }],
    ["weapon:13402", { weaponStacks: 2 }], ["weapon:14435", { weaponEffectActive: true }], ["weapon:14436", { weaponEffectActive: true }], ["weapon:12435", { weaponStacks: 1, secondaryWeaponStacks: 2 }]
  ];
  expect(new Set(cases.map(([id]) => id))).toEqual(new Set(SUPPORTED_WEAPON_CONDITIONED_EXPANSION_IDS));
  for (let rank = 1; rank <= 5; rank++) {
    const [sturdy, talking, spear, clash, echo, forged] = cases.map(([id, context]) => result(id, context, rank));
    for (const actual of [sturdy!, talking!, spear!, clash!, echo!, forged!]) {
      expect(actual.verification).toBe("provisional"); expect(actual.missingConditions).toEqual([]); expect(actual.pendingHitEffects).toEqual([]);
      expect(actual.sourceRefs.some(ref => ref.includes(manifest.optimizerCommit))).toBe(true);
    }
    const i = rank - 1;
    expect(additive(sturdy!, "normal")).toBeCloseTo(2000 * common[i]!, 10); expect(additive(sturdy!, "charged")).toBe(0);
    expect(stat(talking!, "atkPercent")).toBe(common[i]); expect(damage(talking!, "electro", "skill")).toBe(elemental[i]); expect(damage(talking!, "physical", "normal")).toBe(0);
    expect(damage(spear!, "physical", "normal")).toBeCloseTo(2 * prototype[i]!, 12); expect(damage(spear!, "pyro", "charged")).toBeCloseTo(2 * prototype[i]!, 12); expect(stat(spear!, "atkPercent")).toBe(0);
    expect(stat(clash!, "atkPercent")).toBe(clashAtk[i]); expect(stat(clash!, "em")).toBe(clashEm[i]);
    expect(stat(echo!, "em")).toBe(echoes[i]); expect(echo!.dynamicHitBonuses).toEqual([]);
    expect(stat(forged!, "atkPercent")).toBe(forgedAtk[i]); expect(stat(forged!, "em")).toBe(forgedEm[i]);
  }
  for (const file of manifest.files) {
    const bytes = readFileSync(new URL(`../sources/weapon-conditioned-expansion/${file.file}`, import.meta.url));
    expect(bytes.byteLength).toBe(file.bytes); expect(createHash("sha256").update(bytes).digest("hex")).toBe(file.sha256);
  }
});

const basic = { level: 1, ascension: 0, weaponLevel: 1, weaponAscension: 0, refinement: 1, effectsDisabled: true, weaponEffectsEnabled: true };
it("keeps unknown hit-only states local, independent windows separate, and unsupported stellar clauses explicit", () => {
  const doc = loadWorkedExample("fixture-a"), hit = doc.hits[0]!;
  if (hit.kind !== "ordinary") throw Error("Expected ordinary fixture");
  doc.build = resolveEquipmentBuild({ ...basic, characterId: "character:10000015", weaponId: "weapon:11430" }).build;
  hit.attackTag = "skill"; expect(calculateDocument(doc).status).toBe("calculated");
  hit.attackTag = "normal"; expect(calculateDocument(doc).status).toBe("blocked");
  expect(result("weapon:11430", { weaponEffectActive: true, weaponStacks: 0 }).pendingHitEffects).toEqual([]);
  expect(additive(result("weapon:11430", { weaponEffectActive: true, weaponStacks: 1, offField: true }), "normal")).toBe(0);
  doc.build = resolveEquipmentBuild({ ...basic, characterId: "character:10000023", weaponId: "weapon:13402" }).build;
  hit.attackTag = "skill";
  doc.hits.push({ ...structuredClone(hit), id: "pending-charged", attackTag: "charged" });
  const restored = parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(doc)));
  expect(calculateDocument(restored).status).toBe("calculated");
  restored.selectedHitIds = ["pending-charged"]; expect(calculateDocument(restored).status).toBe("blocked");
  const talking = result("weapon:12424", { weaponEffectActive: false, weaponExtraEffectActive: true });
  expect(stat(talking, "atkPercent")).toBe(0); expect(damage(talking, "cryo", "burst")).toBe(.12);
  expect(result("weapon:12424", { weaponExtraEffectActive: false }).missingConditions.join()).toContain("weaponEffectActive");
  expect(result("weapon:12424", { weaponEffectActive: false }).pendingHitEffects[0]?.elements).not.toContain("physical");
  expect(stat(result("weapon:12435", { weaponStacks: 1, secondaryWeaponStacks: 1 }), "atkPercent")).toBe(.36);
  expect(stat(result("weapon:12435", { weaponStacks: 2, secondaryWeaponStacks: 2 }), "em")).toBe(240);
  const stellar = result("weapon:12435", { weaponStacks: 3, secondaryWeaponStacks: 0 });
  expect(stat(stellar, "atkPercent")).toBe(0); expect(stat(stellar, "em")).toBe(0); expect(stellar.dynamicHitBonuses).toEqual([]); expect(stellar.effectBlockers.join()).toContain("星烁乐章增伤未接入");
  expect(() => result("weapon:13402", { weaponStacks: 3 })).toThrow(/0–2/);
});

it("shares real equipment AST with independent ordinary damage math, JSON and final-panel replay without double counting", () => {
  const scenarios: Array<{ characterId: string; weaponId: string; context: EquipmentFormulaContext; baseCoefficient: number; bonus: number }> = [
    { characterId: "character:10000015", weaponId: "weapon:11430", context: { weaponEffectActive: true, weaponStacks: 1, offField: false }, baseCoefficient: .16, bonus: 0 },
    { characterId: "character:10000023", weaponId: "weapon:13402", context: { weaponStacks: 2 }, baseCoefficient: 0, bonus: .16 },
    { characterId: "character:10000034", weaponId: "weapon:12435", context: { weaponStacks: 1, secondaryWeaponStacks: 2 }, baseCoefficient: 0, bonus: 0 }
  ];
  for (const row of scenarios) {
    const resolution = resolveEquipmentBuild({ ...basic, characterId: row.characterId, weaponId: row.weaponId, effectContext: row.context });
    const doc = loadWorkedExample("fixture-a"), hit = doc.hits[0]!;
    if (hit.kind !== "ordinary") throw Error();
    doc.build = resolution.build; doc.characterLevel = 1; doc.enemy.level = 1;
    hit.attackTag = "normal"; hit.damageBonus = 0; hit.additiveBaseDamage = 7;
    const panel = resolveCalculatorStats(doc.build);
    const sourceAtk = (doc.build.characterBaseAtk + doc.build.weaponBaseAtk) * (1 + doc.build.atkPercent + (row.weaponId === "weapon:12435" ? .18 : 0)) + doc.build.flatAtk;
    expect(panel.atk).toBeCloseTo(sourceAtk, 10);
    if (row.weaponId === "weapon:12435") expect(panel.em).toBe(doc.build.em + 120);
    const restored = parseCalculatorDocument(serializeCalculatorDocument(doc)), output = calculateDocument(restored);
    expect(output.status).toBe("calculated");
    const handNonCrit = (sourceAtk * (2 + row.baseCoefficient) + 7) * (1 + row.bonus) * .5 * .9;
    expect(output.hits[0]!.nonCritical).toBeCloseTo(handNonCrit, 10);
    expect(output.hits[0]!.expected).toBeCloseTo(handNonCrit * (1 + panel.critRate * panel.critDamage), 10);
    if (row.baseCoefficient) {
      const trace = output.hits[0]!.trace.find(node => node.id === "equipmentBaseAddition.0")!;
      expect(trace.expression).toBeDefined(); expect(trace.inputs.find(input => input.key === "atk")?.value).toBeCloseTo(sourceAtk, 10); expect(trace.result?.value).toBeCloseTo(sourceAtk * .16, 10);
    }
    expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(restored)))).totals).toEqual(output.totals);
    const disabled = resolveEquipmentBuild({ ...basic, characterId: row.characterId, weaponId: row.weaponId, weaponEffectsEnabled: false });
    expect(disabled.build.equipment.statModifiers).toEqual([]); expect(disabled.build.equipment.dynamicHitBonuses).toEqual([]); expect(disabled.build.equipment.additiveBaseBonuses).toEqual([]);
  }
});
