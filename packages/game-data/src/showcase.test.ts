import { describe, expect, it } from "vitest";
import {
  createGraduationBuildPlaceholder,
  parseEnkaShowcase,
  resolveShowcaseCatalog
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

  it("resolves UID identities, weapon names and skill names against the pinned catalog", () => {
    const imported = parseEnkaShowcase(
      {
        ...rawShowcase,
        avatarInfoList: [
          {
            ...rawShowcase.avatarInfoList[0],
            skillLevelMap: {
              "10751": 10,
              "10752": 9,
              "10755": 8
            },
            proudSkillExtraLevelMap: {
              "7532": 3
            }
          }
        ]
      },
      {
        uid: "283733593",
        fetchedAt: "2026-07-26T00:00:00.000Z"
      }
    );
    const resolved = resolveShowcaseCatalog(imported);
    expect(resolved).toMatchObject({
      catalogSchemaVersion: "1.0.0",
      catalogPatch: "6.7",
      catalogVerificationStatus: "provisional",
      diagnostics: {
        unmatchedAvatarIds: [],
        unmatchedWeaponIds: [],
        unmatchedSkillIds: []
      }
    });
    expect(resolved.characters[0]).toMatchObject({
      avatarId: 10000075,
      catalog: {
        matchStatus: "matched",
        name: "流浪者",
        element: "anemo",
        simulationStatus: "metadata-only"
      },
      weaponCatalog: {
        matchStatus: "matched",
        name: "风鹰剑",
        simulationStatus: "metadata-only"
      },
      resolvedSkills: [
        {
          skillId: "10751",
          name: "行幡鸣弦",
          effectiveLevel: 10
        },
        {
          skillId: "10752",
          name: "羽画·风姿华歌",
          baseLevel: 9,
          bonusLevel: 3,
          effectiveLevel: 12
        },
        {
          skillId: "10755",
          name: "狂言·式乐五番",
          effectiveLevel: 8
        }
      ]
    });
  });

  it("reports every unmapped catalog identifier without inventing a match", () => {
    const imported = parseEnkaShowcase(
      {
        ...rawShowcase,
        avatarInfoList: [
          {
            ...rawShowcase.avatarInfoList[0],
            avatarId: 19999999,
            skillLevelMap: { "999999": 6 },
            equipList: [
              {
                ...rawShowcase.avatarInfoList[0]!.equipList[0],
                itemId: 19999
              }
            ]
          }
        ]
      },
      { uid: "283733593" }
    );
    const resolved = resolveShowcaseCatalog(imported);
    expect(resolved.diagnostics).toEqual({
      unmatchedAvatarIds: [19999999],
      unmatchedWeaponIds: [19999],
      unmatchedSkillIds: ["19999999:999999"]
    });
    expect(resolved.characters[0]?.catalog.name).toBeNull();
  });

  it("selects the traveler element variant from the imported skill identifiers", () => {
    const imported = parseEnkaShowcase(
      {
        playerInfo: {
          level: 60,
          showAvatarInfoList: [{ avatarId: 10000005, level: 90 }]
        },
        avatarInfoList: [
          {
            avatarId: 10000005,
            skillLevelMap: {
              "10097": 6,
              "10098": 1,
              "100541": 1
            },
            fightPropMap: {}
          }
        ]
      },
      { uid: "283733593" }
    );
    const resolved = resolveShowcaseCatalog(imported);
    expect(resolved.diagnostics.unmatchedSkillIds).toEqual([]);
    expect(resolved.characters[0]?.resolvedSkills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ skillId: "100541", name: "异邦烈焰" }),
        expect.objectContaining({ skillId: "10097", name: "流火剑" }),
        expect.objectContaining({ skillId: "10098", name: "灼火燎原" })
      ])
    );
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
