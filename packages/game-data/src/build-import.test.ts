import { describe, expect, it } from "vitest";
import { parseEnkaBuilds, parseGoodBuilds } from "./build-import";
import { resolveEquipmentBuild } from "./equipment-build";

describe("real equipment imports", () => {
  it("maps GOOD identities and uses aggregate substats without inventing rolls", () => {
    const batch = parseGoodBuilds({
      format: "GOOD", version: 3, source: "fixture",
      characters: [{ key: "KamisatoAyaka", level: 90, ascension: 6, constellation: 2, talent: { auto: 8, skill: 9, burst: 10 } }],
      weapons: [{ key: "CoolSteel", location: "KamisatoAyaka", level: 90, ascension: 6, refinement: 5 }],
      artifacts: [{ setKey: "GladiatorsFinale", slotKey: "flower", location: "KamisatoAyaka", rarity: 5, level: 20, mainStatKey: "hp", substats: [{ key: "critRate_", value: 10.5 }, { key: "atk", value: 19 }, { key: "", value: 0 }] }]
    });
    const entry = batch.builds[0]!;
    expect(entry.diagnostics).toEqual([]);
    expect(entry.equipmentInput?.artifacts?.[0]?.observed?.substats).toEqual([{ stat: "critRate_", value: 0.105 }, { stat: "atk", value: 19 }]);
    expect(entry.equipmentInput?.artifacts?.[0]?.substats).toEqual([]);
    const resolved = resolveEquipmentBuild(entry.equipmentInput!);
    expect(resolved.build.equipment.secondaryContributions.some(term => term.property === "FIGHT_PROP_CRITICAL" && term.value === 0.105)).toBe(true);
  });

  it("preserves Enka display values and blocks missing weapon progression", () => {
    const avatar = {
      avatarId: 10000002, propMap: { "4001": { ival: "90" }, "1002": { val: "6" } }, skillLevelMap: {}, talentIdList: [], fightPropMap: {},
      equipList: [
        { itemId: 11301, flat: { itemType: "ITEM_WEAPON" }, weapon: { level: 90, promoteLevel: 6, affixMap: { "1": 4 } } },
        { itemId: 23414, flat: { itemType: "ITEM_RELIQUARY", equipType: "EQUIP_BRACER", rankLevel: 5, reliquaryMainstat: { mainPropId: "FIGHT_PROP_HP", statValue: 4780 }, reliquarySubstats: [{ appendPropId: "FIGHT_PROP_CRITICAL", statValue: 10.5 }] }, reliquary: { level: 21 } }
      ]
    };
    const batch = parseEnkaBuilds({ playerInfo: {}, avatarInfoList: [avatar] }, { uid: "800000001" });
    const entry = batch.builds[0]!;
    expect(entry.equipmentInput?.artifacts?.[0]?.observed).toMatchObject({ mainStatValue: 4780, substats: [{ stat: "critRate_", value: 0.105 }] });
    expect(entry.equipmentInput?.refinement).toBe(5);
    const noAscension = structuredClone(avatar);
    delete ((noAscension.equipList[0] as { weapon: { promoteLevel?: number } }).weapon).promoteLevel;
    const blocked = parseEnkaBuilds({ playerInfo: {}, avatarInfoList: [noAscension] }, { uid: "800000001" }).builds[0]!;
    expect(blocked.equipmentInput).toBeNull();
    expect(blocked.diagnostics.some(item => item.code === "weapon-progression-missing")).toBe(true);
    const emptyAscension = structuredClone(avatar);
    emptyAscension.propMap["1002"] = { val: "" };
    expect(parseEnkaBuilds({ playerInfo: {}, avatarInfoList: [emptyAscension] }, { uid: "800000001" }).builds[0]!.equipmentInput).toBeNull();
    const missingAffix = structuredClone(avatar);
    delete ((missingAffix.equipList[0] as { weapon: { affixMap?: Record<string, number> } }).weapon).affixMap;
    expect(parseEnkaBuilds({ playerInfo: {}, avatarInfoList: [missingAffix] }, { uid: "800000001" }).builds[0]!.diagnostics.some(item => item.code === "refinement-missing")).toBe(true);
  });
});

it('keeps base talents separate from proud-skill bonuses and constellation in the engine route', () => {
 const avatar={avatarId:10000075,skillLevelMap:{'10751':10,'10752':9,'10755':8},proudSkillExtraLevelMap:{'7532':3},talentIdList:[751,752,753],fightPropMap:{}};
 const entry=parseEnkaBuilds({playerInfo:{},avatarInfoList:[avatar]},{uid:'900000003'}).builds[0]!;
 expect(entry.baseTalentLevels).toEqual({auto:10,skill:9,burst:8});
 expect(entry.constellation).toBe(3);
 expect(entry.equipmentInput).toBeNull();
});
