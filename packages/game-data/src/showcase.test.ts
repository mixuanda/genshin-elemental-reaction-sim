import { describe, expect, it } from "vitest";
import {
  createGraduationBuildPlaceholder,
  parseEnkaShowcase
} from "./showcase";

const rawShowcase = {
  ttl: 60,
  playerInfo: {
    level: 60,
    worldLevel: 9,
    showAvatarInfoList: [{ avatarId: 10000075, level: 100 }]
  },
  avatarInfoList: [
    {
      avatarId: 10000075,
      propMap: {
        "4001": { type: 4001, ival: "100" }
      },
      talentIdList: [751, 752],
      skillLevelMap: { "10751": 10 },
      fightPropMap: {
        "20": 0.7863,
        "22": 1.8114,
        "23": 1,
        "28": 100,
        "40": 0.466,
        "2000": 17589.7,
        "2001": 2551.7,
        "2002": 752.9
      },
      equipList: [
        {
          itemId: 11501,
          weapon: {
            level: 90,
            promoteLevel: 6,
            affixMap: { "111501": 4 }
          },
          flat: {
            itemType: "ITEM_WEAPON",
            rankLevel: 5,
            weaponStats: [
              { appendPropId: "FIGHT_PROP_BASE_ATTACK", statValue: 674 }
            ]
          }
        },
        {
          itemId: 98544,
          reliquary: { level: 21, mainPropId: 14001 },
          flat: {
            itemType: "ITEM_RELIQUARY",
            equipType: "EQUIP_BRACER",
            rankLevel: 5,
            setId: 15024,
            reliquaryMainstat: {
              mainPropId: "FIGHT_PROP_HP",
              statValue: 4780
            },
            reliquarySubstats: [
              {
                appendPropId: "FIGHT_PROP_CRITICAL_HURT",
                statValue: 18.7
              }
            ]
          }
        }
      ]
    }
  ]
};

describe("Enka showcase adapter", () => {
  it("validates and normalizes account data without turning it into a sim config", () => {
    const result = parseEnkaShowcase(rawShowcase, {
      uid: "283733593",
      fetchedAt: "2026-07-26T00:00:00.000Z"
    });
    expect(result.visibility).toBe("public");
    expect(result.characters).toHaveLength(1);
    expect(result.characters[0]).toMatchObject({
      avatarId: 10000075,
      level: 100,
      constellation: 2,
      weapon: {
        itemId: 11501,
        level: 90,
        refinement: 5
      },
      artifacts: [
        {
          itemId: 98544,
          level: 20,
          slot: "EQUIP_BRACER"
        }
      ]
    });
    expect(result.characters[0]?.stats.damageBonuses.pyro).toBeCloseTo(
      0.466
    );
  });

  it("keeps graduation state explicitly non-simulatable", () => {
    const result = parseEnkaShowcase(rawShowcase, {
      uid: "283733593"
    });
    const placeholder = createGraduationBuildPlaceholder(
      result.characters[0]!
    );
    expect(placeholder.status).toBe("graduation-target-placeholder");
    expect(placeholder.artifactTarget).toBeNull();
    expect(placeholder.note).toContain("不进入伤害模拟");
  });

  it("marks a closed or empty showcase without inventing characters", () => {
    const result = parseEnkaShowcase(
      {
        playerInfo: {
          level: 60
        }
      },
      { uid: "283733593" }
    );
    expect(result.visibility).toBe("closed-or-empty");
    expect(result.characters).toEqual([]);
  });
});
