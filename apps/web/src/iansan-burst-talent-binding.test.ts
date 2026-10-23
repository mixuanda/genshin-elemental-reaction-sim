import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEnkaShowcase, resolveShowcaseCatalog } from "@genshin-dps-lab/game-data";
import { calculateDocument } from "../../../packages/sim-core/src/calculator";
import { parseCalculatorDocument, serializeCalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { getCharacterDocuments } from "./character-calculations";
import { applyImportedCalculatorPanel } from "./calculator-import";

// Contract fixture only: reuses the public import shape, never a player account.
function source() {
  const raw = JSON.parse(readFileSync(new URL("../e2e/fixtures/player-import/kaeya-enka-panel.json", import.meta.url), "utf8"));
  const character = resolveShowcaseCatalog(parseEnkaShowcase(raw, { uid: "synthetic-local-only" })).characters[0]!;
  character.catalog.characterId = "character:10000110";
  character.constellation = 0;
  character.ascension = 6;
  character.level = 90;
  Object.assign(character.stats, { attack: 2000, elementalMastery: 0, critRate: 0, critDamage: 1 });
  character.stats.damageBonuses.electro = 0;
  const base = character.resolvedSkills[0]!;
  character.resolvedSkills = [
    { ...base, abilityId: "talent:iansan:combat1", matchStatus: "matched", baseLevel: 10, bonusLevel: 0, effectiveLevel: 10 },
    { ...base, abilityId: "talent:iansan:combat3", matchStatus: "matched", baseLevel: 1, bonusLevel: 0, effectiveLevel: 1 },
  ];
  return character;
}
const template = () => getCharacterDocuments("character:10000110", 10).find(document => document.gameContext?.skillId === "iansan-swift-resolved-c0")!;
function declareActualHit(document: ReturnType<typeof template>) {
  document.scope = "single-hit";
  document.gameContext!.iansanSwiftResolvedCast!.sharedState = {
    swiftQualifiedAtCast: true, a1ActiveAtSnapshot: false, includedA1Attack: 0,
    burstInactiveAtSnapshot: false, ownerOnFieldAtSnapshot: true,
    burstUpdateNonExtraAttack: 5000, burstUpdateNightsoulPoints: 42, includedBurstAttack: 0,
  };
  return document;
}

describe("Iansan import binds Q independently from Swift's normal talent", () => {
  it("uses imported Q1 cap, normal T10 coefficient, and keeps the result across actual JSON reopening", () => {
    const character = source(), before = JSON.stringify(character);
    const document = declareActualHit(applyImportedCalculatorPanel(template(), character, "Synthetic Iansan final panel"));
    expect(document.gameContext!.effectiveTalentLevel).toBe(10);
    expect(document.gameContext!.iansanSwiftResolvedCast!.burstTalentLevel).toBe(1);
    const result = calculateDocument(document);
    expect(result.status).toBe("calculated");
    // min(5000 * 27%, Q1 cap 330) adds flat ATK once. Swift uses normal T10.
    expect(result.totals!.nonCritical).toBeCloseTo((2000 + 330) * 1.6643 * .5 * .9, 9);
    expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(document))).totals).toEqual(result.totals);
    expect(JSON.stringify(character)).toBe(before);
  });

  it("clears missing or inconsistent Q evidence instead of borrowing NA10 or the old Q level", () => {
    for (const missing of [true, false]) {
      const character = source(), old = template();
      old.gameContext!.iansanSwiftResolvedCast = { burstTalentLevel: 10 };
      if (missing) character.resolvedSkills.pop();
      else character.resolvedSkills[1]!.bonusLevel = null;
      const document = declareActualHit(applyImportedCalculatorPanel(old, character, "Unknown independent Q"));
      expect(document.gameContext!.iansanSwiftResolvedCast!.burstTalentLevel).toBeUndefined();
      expect(calculateDocument(document).status).toBe("blocked");
      document.gameContext!.iansanSwiftResolvedCast!.sharedState!.burstInactiveAtSnapshot = true;
      expect(calculateDocument(document).status).toBe("calculated");
    }
  });

  it("retains effective Q evidence once while keeping unsupported high-constellation mechanics blocked", () => {
    const character = source();
    character.constellation = 3;
    Object.assign(character.resolvedSkills[1]!, { baseLevel: 7, bonusLevel: 3, effectiveLevel: 10 });
    const document = declareActualHit(applyImportedCalculatorPanel(template(), character, "Synthetic C3 evidence, not C3 mechanic support"));
    expect(document.gameContext!.effectiveTalentLevel).toBe(10);
    expect(document.gameContext!.iansanSwiftResolvedCast!.burstTalentLevel).toBe(10);
    expect(calculateDocument(document).status).toBe("blocked");
  });
});
