import { describe, expect, it } from "vitest";
import {
  gameDataRuntimeIndex,
  parseEnkaShowcase,
  resolveShowcaseCatalog
} from "@genshin-dps-lab/game-data";
import { applyImportedCalculatorPanel } from "../../../../apps/web/src/calculator-import";
import { getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { calculateDocument, resolveCalculatorStats } from "../calculator";

/** Local synthetic public-response shape; no real account response or UID. */
function importedCharacter(avatarId: number, constellation: number, ascensionProperty: "val" | "ival") {
  const mapping = gameDataRuntimeIndex.enkaCharacterMappings.find(entry => entry.avatarId === avatarId);
  if (!mapping) throw new Error(`Missing real catalog skill mapping for ${avatarId}`);
  const talentLevels = [5, 8, 9];
  const response = {
    playerInfo: { level: 60, showAvatarInfoList: [{ avatarId, level: 90 }] },
    avatarInfoList: [{
      avatarId,
      propMap: {
        "4001": { type: 4001, val: "90", ival: "90" },
        "1002": { type: 1002, [ascensionProperty]: "6" }
      },
      talentIdList: Array.from({ length: constellation }, (_, index) => 1000 + index),
      skillLevelMap: Object.fromEntries(mapping.skillOrder.map((id, index) => [String(id), talentLevels[index]!])),
      proudSkillExtraLevelMap: {},
      fightPropMap: {
        "20": 0.7, "22": 1.2, "23": 1.5, "28": 100,
        "30": 0, "41": 0.466, "46": 0.466,
        "2000": 20000, "2001": 2000, "2002": 800
      },
      equipList: [{
        itemId: 11501,
        weapon: { level: 90, promoteLevel: 6, affixMap: { "111501": 4 } },
        flat: {
          itemType: "ITEM_WEAPON", rankLevel: 5,
          weaponStats: [{ appendPropId: "FIGHT_PROP_BASE_ATTACK", statValue: 674 }]
        }
      }]
    }]
  };
  const resolved = resolveShowcaseCatalog(parseEnkaShowcase(response, { uid: "synthetic-local-fixture", fetchedAt: "2026-09-23T00:00:00.000Z" }));
  const character = resolved.characters[0];
  if (!character) throw new Error("Mock showcase character was not parsed");
  return character;
}

describe("showcase calculator import uses per-hit constellation and ascension dependencies", () => {
  it("calculates Kaeya C1 Skill with the imported effective talent and final panel exactly once", () => {
    const character = importedCharacter(10000015, 1, "val");
    const document = getCharacterDocuments(character.catalog.characterId!, 8)
      .find(candidate => candidate.gameContext?.skillId === "kaeya-skill");
    if (!document?.gameContext) throw new Error("Missing reviewed Kaeya Skill document");
    expect(character.resolvedSkills.find(skill => skill.abilityId === document.gameContext!.abilityId)?.effectiveLevel).toBe(8);
    expect(character.weapon?.stats).toContainEqual({ id: "FIGHT_PROP_BASE_ATTACK", value: 674 });

    const imported = applyImportedCalculatorPanel(document, character, "synthetic public showcase fixture");
    expect(imported.gameContext).toMatchObject({ characterId: "character:10000015", constellation: 1, ascension: 6, effectiveTalentLevel: 8 });
    expect(imported.characterLevel).toBe(90);
    expect(imported.build).toMatchObject({
      mode: "imported-final", ascension: 6,
      stats: { atk: 2000, hp: 20000, def: 800, em: 100, critRate: 0.7, critDamage: 1.2, energyRecharge: 1.5 }
    });
    expect(imported.build).not.toHaveProperty("equipment");
    expect(resolveCalculatorStats(imported.build).atk).toBe(2000);
    const hit = imported.hits[0];
    if (hit?.kind !== "ordinary") throw new Error("Kaeya Skill must be a reviewed ordinary hit");
    expect(hit.damageBonus).toBe(0.466);
    const result = calculateDocument(imported);
    expect(result.status).toBe("calculated");
    expect(result.blockers).toEqual([]);
    expect(result.totals?.expected).toBeCloseTo(2000 * hit.terms[0]!.coefficient * 1.466 * 0.5 * 0.9 * 1.84, 9);
    expect(document.gameContext.constellation).toBe(0);
    expect(document.build.mode).toBe("manual-final");

    // The same imported C1 remains unsupported for N1 without its target-state CR context.
    const normal = getCharacterDocuments(character.catalog.characterId!, 5)
      .find(candidate => candidate.gameContext?.skillId === "kaeya-normal-1");
    if (!normal) throw new Error("Missing reviewed Kaeya N1 document");
    const missingPhysical = structuredClone(character);
    missingPhysical.stats.damageBonuses.physical = null;
    expect(() => applyImportedCalculatorPanel(normal, missingPhysical, "synthetic missing physical bonus"))
      .toThrow("physical 伤害加成");
    const importedNormal = applyImportedCalculatorPanel(normal, character, "same synthetic C1 showcase");
    expect(importedNormal.gameContext).toMatchObject({ constellation: 1, effectiveTalentLevel: 5 });
    const blockedNormal = calculateDocument(importedNormal);
    expect(blockedNormal.status).toBe("blocked");
    expect(blockedNormal.totals).toBeUndefined();
    expect(blockedNormal.blockers.length).toBeGreaterThan(0);
  });

  it("blocks Clorinde C2's C0/C1 A1 formula and never treats propMap[1002].ival as ascension", () => {
    const character = importedCharacter(10000098, 2, "val");
    const document = getCharacterDocuments(character.catalog.characterId!, 9)
      .find(candidate => candidate.hits.some(hit => hit.kind === "ordinary" && hit.attackTag === "burst" && hit.additiveBaseFormula?.requirements?.maximumConstellation === 1));
    if (!document?.gameContext) throw new Error("Missing reviewed Clorinde Burst with the C0/C1 A1 rule");
    expect(character.resolvedSkills.find(skill => skill.abilityId === document.gameContext!.abilityId)?.effectiveLevel).toBe(9);

    const imported = applyImportedCalculatorPanel(document, character, "synthetic C2 showcase");
    expect(imported.gameContext).toMatchObject({ constellation: 2, ascension: 6 });
    const result = calculateDocument(imported);
    expect(result.status).toBe("blocked");
    expect(result.totals).toBeUndefined();
    expect(result.blockers.join("；")).toContain("不高于 C1");

    const unknownAscension = importedCharacter(10000098, 2, "ival");
    expect(unknownAscension.ascension).toBeNull();
    const missing = applyImportedCalculatorPanel(document, unknownAscension, "synthetic showcase with untrusted ival");
    expect(missing.gameContext?.ascension).toBeUndefined();
    expect(missing.build).not.toHaveProperty("ascension");
    const blockedMissing = calculateDocument(missing);
    expect(blockedMissing.status).toBe("blocked");
    expect(blockedMissing.totals).toBeUndefined();
    expect(blockedMissing.blockers.join("；")).toContain("缺少明确突破阶段");
    expect(blockedMissing.blockers.join("；")).toContain("不高于 C1");
  });
});
