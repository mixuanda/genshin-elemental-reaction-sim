import { describe, expect, it } from "vitest";
import { getCharacterDocuments, applyCharacterConstellationScope } from "./character-calculations";
import { calculateDocument } from "../../../packages/sim-core/src/calculator";
import { parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { applyImportedCalculatorPanel } from "./calculator-import";
import type { CatalogResolvedShowcaseCharacter } from "../../../packages/schemas/src/index";

function action(character: string, skill: string, talent: number): CalculatorDocument {
  const document = getCharacterDocuments(character, talent).find(row => row.gameContext?.skillId === skill);
  expect(document, skill).toBeDefined();
  const doc = structuredClone(document!);
  doc.build = { mode: "manual-final", stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "explicit arithmetic fixture, not a player build" };
  doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  doc.characterLevel = character === "character:10000075" ? 100 : 90;
  doc.gameContext!.constellation = character === "character:10000075" ? 6 : 2;
  if (doc.gameContext!.wandererPrimary) Object.assign(doc.gameContext!.wandererPrimary, { skillTalentLevel: 13, absorptionBonuses: "neither", c6ParentQualified: true,
    burstWindfavoredAtCast: true, burstC2ConsumedPointsUpTo50: 50, burstConditionsStable: true, burstAllHitsConnected: true });
  if (doc.gameContext!.durinBurst) Object.assign(doc.gameContext!.durinBurst, { tickIndex: 1, c2PyroBonusActive: true });
  return applyCharacterConstellationScope(doc);
}
const ready = (doc: CalculatorDocument) => {
  const reopened = parseCalculatorDocument(serializeCalculatorDocument(doc)), result = calculateDocument(reopened);
  expect(result.status, result.blockers.join("\n")).toBe("calculated");
  expect(calculateDocument(doc).totals).toEqual(result.totals);
  return result;
};

describe("registered Wanderer and Durin primary outputs", () => {
  it("exposes real distinct NA/E/Q definitions and preserves 100/C6 in the public route", () => {
    const docs = getCharacterDocuments("character:10000075", 10).filter(row => row.gameContext?.wandererPrimary);
    expect(docs.filter(row => row.gameContext?.skillId.startsWith("wanderer-windfavored-normal-"))).toHaveLength(4);
    expect(docs.filter(row => row.gameContext?.skillId.startsWith("wanderer-windfavored-c6-normal-"))).toHaveLength(4);
    expect(docs.find(row => row.gameContext?.skillId === "wanderer-kyougen-five-hits")?.hits).toHaveLength(5);
    const doc = action("character:10000075", "wanderer-windfavored-normal-1", 10), result = ready(doc);
    expect(doc.characterLevel).toBe(100); expect(doc.gameContext!.effectiveTalentLevel).toBe(10);
    expect(doc.gameContext!.wandererPrimary!.skillTalentLevel).toBe(13);
    expect(result.totals!.nonCritical).toBeCloseTo(2023.9401392307692308, 8);
    expect(result.totals!.expected).toBeCloseTo(3035.9102088461538462, 8);
  });
  it("treats C6 as its own actual 40% hit and refuses a C5 substitute", () => {
    const doc = action("character:10000075", "wanderer-windfavored-c6-normal-1", 10), result = ready(doc);
    expect(result.hits).toHaveLength(1); expect(result.totals!.expected).toBeCloseTo(1214.3640835384615385, 8);
    doc.gameContext!.constellation = 5;
    expect(calculateDocument(applyCharacterConstellationScope(doc)).status).toBe("blocked");
  });
  it("keeps Q13 once, five real contacts and Q-only C2 separate from normal attacks", () => {
    const doc = action("character:10000075", "wanderer-kyougen-five-hits", 13), result = ready(doc);
    expect(result.hits).toHaveLength(5); expect(result.totals!.expected).toBeCloseTo(64966.153846153844, 8);
    doc.gameContext!.wandererPrimary!.burstC2ConsumedPointsUpTo50 = 0;
    expect(ready(doc).totals!.expected).toBeCloseTo(21655.384615384617, 8);
    doc.gameContext!.wandererPrimary!.burstAllHitsConnected = false;
    expect(calculateDocument(doc).status).toBe("blocked");
  });
  it("derives Durin's A4 from real tick 10/11 and keeps each result one hit", () => {
    const doc = action("character:10000123", "durin-white-q-tick", 10);
    doc.gameContext!.durinBurst!.tickIndex = 10;
    expect(ready(doc).totals!.expected).toBeCloseTo(5519.4048, 8);
    doc.gameContext!.durinBurst!.tickIndex = 11;
    const after = ready(doc); expect(after.hits).toHaveLength(1); expect(after.totals!.expected).toBeCloseTo(3449.628, 8);
    doc.gameContext!.constellation = 3;
    expect(calculateDocument(applyCharacterConstellationScope(doc)).status).toBe("blocked");
  });
  it("binds an imported effective E13 separately and leaves missing E talent unknown", () => {
    const doc = action("character:10000075", "wanderer-windfavored-normal-1", 10);
    const character = { catalog: { characterId: "character:10000075" }, level: 100, ascension: 6, constellation: 6,
      stats: { attack: 2000, maxHp: 20000, defense: 800, elementalMastery: 0, critRate: .5, critDamage: 1, energyRecharge: 1,
        damageBonuses: Object.fromEntries(["physical", "anemo", "geo", "pyro", "hydro", "cryo", "electro", "dendro"].map(key => [key, 0])) },
      resolvedSkills: [{ abilityId: "talent:wanderer:combat1", baseLevel: 10, bonusLevel: 0, effectiveLevel: 10, matchStatus: "matched" },
        { abilityId: "talent:wanderer:combat2", baseLevel: 10, bonusLevel: 3, effectiveLevel: 13, matchStatus: "matched" }],
    } as unknown as CatalogResolvedShowcaseCharacter;
    const imported = applyImportedCalculatorPanel(doc, character, "synthetic import-contract fixture");
    expect(imported.gameContext!.wandererPrimary!.skillTalentLevel).toBe(13);
    expect(imported.characterLevel).toBe(100); expect(imported.gameContext!.effectiveTalentLevel).toBe(10);
    expect(imported.gameContext!.wandererPrimary!.absorptionBonuses).toBeUndefined();
    character.resolvedSkills.pop();
    const missing = applyImportedCalculatorPanel(doc, character, "same fixture without E");
    expect(missing.gameContext!.wandererPrimary!.skillTalentLevel).toBeUndefined();
    expect(calculateDocument(missing).status).toBe("blocked");
  });
});
