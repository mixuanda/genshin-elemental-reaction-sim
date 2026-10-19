import { expect, it } from "vitest";
import { gameDataCatalog } from "../../../game-data/src/catalog";
import { getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { batchCompleteProjectileMappings } from "../../../game-data/src/character-mappings/batch-complete-projectile-mappings";
import { batchCompletePeriodicMappings } from "../../../game-data/src/character-mappings/batch-complete-periodic-mappings";
import { batchCompleteFiniteMappings } from "../../../game-data/src/character-mappings/batch-complete-finite-mappings";
import { travelerCryoCompleteMappings } from "../../../game-data/src/character-mappings/traveler-cryo-complete-mappings";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument } from "../calculator";

it("connects all four source groups to normal documents, shared calculation and final-panel JSON", () => {
  const mappings = [...batchCompleteProjectileMappings, ...batchCompletePeriodicMappings, ...batchCompleteFiniteMappings, ...travelerCryoCompleteMappings];
  const casts = [...new Map(mappings.map(mapping => [mapping.skillId, mapping])).values()];
  expect(casts).toHaveLength(28);
  let hitCount = 0;
  for (const mapping of casts) {
    const character = gameDataCatalog.characters.find(row => row.slug === mapping.characterSlug)!;
    const doc = getCharacterDocuments(character.id, 10).find(row => row.gameContext?.skillId === mapping.skillId)!;
    expect(doc, mapping.skillId).toBeDefined();
    doc.characterLevel = 90;
    const ascension = mapping.skillId.includes("chongyun-skill-with-a4") ? 4 : 0;
    doc.build = { mode: "manual-final", ascension, source: "明确的批量来源条件夹具面板", stats: { atk: 2000, hp: 20000, def: 800, em: 100, critRate: .5, critDamage: 1, energyRecharge: 1 } };
    doc.gameContext!.ascension = ascension;
    doc.scope = "one-cast";
    doc.selectedHitIds = doc.hits.map(hit => hit.id);
    doc.gameContext!.travelerCryo = { radiance: "none", trueMoonStoryBuff: false, statsStableAcrossHits: true, skillUninterrupted: true, frostglowStacksAtBurst: mapping.skillId.includes("frostglow-full") ? 8 : 0, a4IncludedEm: 0 };
    doc.gameContext!.batchProjectileCast = { statsStableAcrossHits: true, sharedState: { actualHpRatio: 1, includedHydroBonus: 0, chevreuseA4Active: false, includedA4AtkPercent: 0, a1Active: false, a1PartyEligible: false, includedA1Shred: 0 } };
    doc.gameContext!.batchPeriodicCast = { completeCastConfirmed: true, statsStableAcrossHits: true, kaeyaFrontContactModelConfirmed: true, qiqiRevelationInactive: true, kokomiNoBurstOrRefresh: true, kokomiPassiveIncludedInPanel: false, ventiNoAbsorption: true, ventiHexereiInactive: true, shenheFreshBurstNoSkillEffects: true, shenheA1IncludedInPanel: false, shenheQReductionIncludedInResistance: false, escoffierArkheAvailable: true };
    doc.gameContext!.batchFiniteCast = { completeCastConfirmed: true, statsStableAcrossHits: true, hitStates: Object.fromEntries(doc.hits.map(hit => [hit.id, { includedDamageBonus: 0 }])) };
    const result = calculateDocument(doc);
    hitCount += doc.hits.length;
    expect.soft(result.blockers, mapping.skillId).toEqual([]);
    if (!result.totals) continue;
    expect(result.totals!.expected, mapping.skillId).toBeGreaterThan(0);
    expect(result.totals!.expected).toBeCloseTo(result.hits.reduce((sum, hit) => sum + hit.expected!, 0), 8);
    const restored = parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(doc)));
    expect.soft(calculateDocument(restored).totals, mapping.skillId).toEqual(result.totals);
  }
  expect(hitCount).toBe(201);
});
