import { describe, expect, it } from "vitest";
import { gameDataCatalog } from "../catalog";
import { gameDataRuntimeIndex } from "../catalog-runtime";
import { parseEnkaShowcase, resolveShowcaseCatalog } from "../showcase";
import { applyCharacterConstellationScope, getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { applyImportedCalculatorPanel } from "../../../../apps/web/src/calculator-import";
import { calculateDocument, convertCalculatorToFinalPanel } from "../../../sim-core/src/calculator";
import { parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument, type CalculatorHit } from "../../../sim-core/src/calculator-model";
import { neferOrdinarySourceEvidence } from "./nefer-ordinary-source";

type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;
function action(skillId: string, constellation: number, level = 10): CalculatorDocument {
  const character = gameDataCatalog.characters.find((entry) => entry.slug === "nefer");
  if (!character) throw new Error("Missing Nefer source identity");
  const doc = getCharacterDocuments(character.id, level).find((entry) => entry.gameContext?.skillId === skillId);
  if (!doc?.gameContext || doc.build.mode !== "manual-final") throw new Error("Missing Nefer source action");
  doc.build.stats.em = 100;
  doc.gameContext.constellation = constellation;
  return applyCharacterConstellationScope(doc);
}
function ordinary(doc: CalculatorDocument): OrdinaryHit[] {
  return doc.hits.map((hit) => { if (hit.kind !== "ordinary") throw new Error("Unexpected special entity"); return hit; });
}
function input(hit: OrdinaryHit, key: string, value: number): void {
  let updated = false;
  for (const formula of [hit.damageBonusFormula, hit.resistanceReductionFormula, hit.elementalMasteryAdjustment?.formula]) {
    const found = formula?.inputs.find((entry) => entry.key === key);
    if (found) { found.value = value; updated = true; }
  }
  if (!updated) throw new Error(`Missing source input ${key}`);
}
function activeBuff(doc: CalculatorDocument, consumed: number, c4 = false): void {
  for (const hit of ordinary(doc)) {
    if (!hit.elementalMasteryAdjustment) throw new Error("Missing source EM state");
    hit.elementalMasteryAdjustment.accounting = "add-to-panel";
    input(hit, "moonsignCount", 2);
    input(hit, "neferFullVeilEmBuffActive", 1);
    if (hit.attackTag === "burst") input(hit, "neferVeilStacks", consumed);
    if (c4) input(hit, "neferC4TargetDebuffActive", 1);
  }
}

describe("Nefer ordinary source contexts C0–C6", () => {
  it("corrects the initial E scope conflict instead of preserving the erroneous Phantasm multiplier", () => {
    const doc = action("nefer-skill-rush", 0);
    const hit = ordinary(doc)[0]!;
    hit.additiveBaseDamage = 500;
    expect(hit.additiveBaseFormula).toBeUndefined();
    expect(doc.gameContext?.scopeCoverage).toBe("selected-components");
    expect(doc.assumptions.join("；")).toContain("来源内部冲突");
    expect(hit.sourceRefs.some((ref) => ref.endsWith("/tooltips_gen.json"))).toBe(true);
    expect(calculateDocument(doc).totals?.nonCritical).toBeCloseTo(1586.16288, 8);
    const oldThreeVeilTotal = ((1.374912 * 2000 + 2.749824 * 100) * 1.24 + 500) * 0.5 * 0.9;
    expect(oldThreeVeilTotal).toBeCloseTo(1912.8419712, 8);
    expect(calculateDocument(doc).totals?.nonCritical).toBeLessThan(oldThreeVeilTotal);
    expect(neferOrdinarySourceEvidence.independentSourceCount).toBe(1);
  });

  it("keeps C2 consumed Veils and the independent eight-second 200 EM state separate", () => {
    const doc = action("nefer-burst", 2);
    activeBuff(doc, 5);
    expect(calculateDocument(doc).totals?.nonCritical).toBeCloseTo(35481.888, 7);
    for (const hit of ordinary(doc)) input(hit, "neferFullVeilEmBuffActive", 0);
    expect(calculateDocument(doc).totals?.nonCritical).toBeCloseTo(30023.136, 7);
    activeBuff(doc, 0);
    expect(calculateDocument(doc).totals?.nonCritical).toBeCloseTo(11827.296, 7);
    doc.gameContext!.ascension = 0;
    expect(calculateDocument(doc).totals?.nonCritical).toBeCloseTo(10007.712, 7);
    delete doc.gameContext!.ascension;
    expect(calculateDocument(doc).status).toBe("blocked");
    doc.gameContext!.ascension = 6;
    doc.gameContext!.constellation = 1;
    expect(calculateDocument(doc).blockers.join("；")).toContain("C2");

    const lower = action("nefer-burst", 1);
    activeBuff(lower, 3);
    for (const hit of ordinary(lower)) input(hit, "neferVeilStacks", 5);
    expect(() => parseCalculatorDocument(JSON.stringify(lower))).toThrow();
  });

  it("applies the C4 target debuff and per-hit EM once, including final-panel JSON replay", () => {
    const doc = action("nefer-burst", 4);
    activeBuff(doc, 5, true);
    const active = calculateDocument(doc);
    expect(active.totals?.nonCritical).toBeCloseTo(41395.536, 7);
    const restored = parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(doc, "imported-final")));
    expect(calculateDocument(restored).totals).toEqual(active.totals);
    for (const hit of ordinary(restored)) expect(hit.elementalMasteryAdjustment?.accounting).toBe("add-to-panel");
    restored.gameContext!.constellation = 0;
    expect(calculateDocument(restored).status).toBe("blocked");

    if (doc.build.mode !== "manual-final") throw new Error("Expected editable source panel");
    doc.build.stats.em = 300;
    for (const hit of ordinary(doc)) hit.elementalMasteryAdjustment!.accounting = "already-in-final-panel";
    expect(calculateDocument(doc).totals).toEqual(active.totals);
    doc.build.stats.em = 100;
    for (const hit of ordinary(doc)) hit.elementalMasteryAdjustment!.accounting = "add-to-panel";
    input(ordinary(doc)[0]!, "neferFullVeilEmBuffActive", 0);
    const separate = calculateDocument(doc);
    expect(separate.hits.map((hit) => hit.trace.find((node) => node.id === "hitElementalMastery")?.result?.value)).toEqual([100, 300]);
    expect(separate.totals?.nonCritical).toBeCloseTo(((4.04352 * 2000 + 8.08704 * 100) + (6.06528 * 2000 + 12.13056 * 300)) * 3 * 0.5 * 1.05, 7);
  });

  it("uses C3/C5 effective talent levels exactly once and adds no C6 Phantasm entities to ordinary E/Q", () => {
    const burst = action("nefer-burst", 6, 13);
    activeBuff(burst, 5, true);
    expect(burst.gameContext?.effectiveTalentLevel).toBe(13);
    expect(ordinary(burst)).toHaveLength(2);
    expect(ordinary(burst)[0]!.terms[0]?.coefficient).toBe(4.7736);
    expect(calculateDocument(burst).totals?.nonCritical).toBeCloseTo(56200.1895, 7);
    const skill = action("nefer-skill-rush", 6, 13);
    activeBuff(skill, 0, true);
    expect(ordinary(skill)).toHaveLength(1);
    expect(ordinary(skill)[0]!.terms[0]?.coefficient).toBe(1.62316);
    expect(ordinary(skill)[0]!.additiveBaseFormula).toBeUndefined();
    expect(calculateDocument(skill).status).toBe("calculated");
  });

  it("resets old extra EM accounting when an imported final panel replaces the draft", () => {
    const doc = action("nefer-burst", 4);
    activeBuff(doc, 5, true);
    const avatarId = Number(doc.gameContext!.characterId.split(":")[1]);
    const mapping = gameDataRuntimeIndex.enkaCharacterMappings.find((entry) => entry.avatarId === avatarId);
    if (!mapping) throw new Error("Missing real Nefer showcase mapping");
    const response = { playerInfo: { level: 60 }, avatarInfoList: [{
      avatarId, propMap: { "4001": { type: 4001, val: "90" }, "1002": { type: 1002, val: "6" } },
      talentIdList: [1001, 1002, 1003, 1004],
      // This accounting test keeps effective Q10: base7 + the explicit C3 bonus.
      skillLevelMap: Object.fromEntries(mapping.skillOrder.map((id, index) => [String(id), index === 2 ? 7 : 10])),
      proudSkillExtraLevelMap: { [String(mapping.proudMap[String(mapping.skillOrder[2])])]: 3 },
      fightPropMap: { "20": 0.7, "22": 1.2, "23": 1.5, "28": 300, "43": 0, "2000": 20000, "2001": 2000, "2002": 800 }, equipList: []
    }] };
    const character = resolveShowcaseCatalog(parseEnkaShowcase(response, { uid: "synthetic-nefer-import", fetchedAt: "2026-09-23T00:00:00.000Z" })).characters[0];
    if (!character) throw new Error("Missing parsed source identity");
    const imported = applyImportedCalculatorPanel(doc, character, "synthetic public response with explicit final EM");
    expect(ordinary(imported).every((hit) => hit.elementalMasteryAdjustment?.accounting === "already-in-final-panel")).toBe(true);
    expect(calculateDocument(imported).totals).toEqual(calculateDocument(doc).totals);
    expect(ordinary(doc).every((hit) => hit.elementalMasteryAdjustment?.accounting === "add-to-panel")).toBe(true);
  });
});
