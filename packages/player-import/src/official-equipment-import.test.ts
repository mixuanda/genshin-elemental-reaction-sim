import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createOfficialEquipmentObserver } from "./official-browser-observer.mjs";
import { importOfficialEquipmentObservation } from "./official-equipment-import";
import { importPlayerInput } from "./import";
import { importPlayerJson } from "./normalize";
import { applyPreview } from "./adapters";
import { createCoreHandoff } from "./core-handoff";

const role = { uid: "123456789", server: "cn_gf01" };
function source(level = 100) {
  return { retcode: 0, data: { property_map: {
    "1": { property_type: 1, name: "生命值", filter_name: "unused" },
    "2": { property_type: 2, name: "暴击率", filter_name: "unused" },
    "3": { property_type: 3, name: "元素精通", filter_name: "unused" },
    "4": { property_type: 4, name: "基础攻击力", filter_name: "unused" },
  }, list: [{ base: { id: 10000002, level, actived_constellation_num: 6 },
    weapon: { id: 11301, level: 20, promote_level: 0, affix_level: 1,
      main_property: { property_type: 4, base: "39", add: "70", final: "109" }, sub_property: { property_type: 2, base: "0%", add: "0%", final: "0%" } },
    relics: [{ id: 71544, pos: 1, pos_name: "生之花", rarity: 5, level: 0,
      set: { id: 2140011 }, main_property: { property_type: 1, value: "717" }, sub_property_list: [{ property_type: 2, value: "10.5%" }, { property_type: 3, value: "0" }] }],
    skills: [{ skill_id: 10024, skill_type: 1, level: 10, is_unlock: true }, { skill_id: 10018, skill_type: 2, level: 13, is_unlock: true }, { skill_id: 10019, skill_type: 3, level: 13, is_unlock: true }] }] } };
}
function observed(payload = source()) {
  const observer = createOfficialEquipmentObserver({ provider: "miyoushe", evidence: "synthetic-test" });
  observer.observe({ url: "https://api-takumi.mihoyo.com/binding/api/getUserGameRolesByCookie", method: "GET", status: 200,
    responseBody: JSON.stringify({ retcode: 0, data: { list: [{ game_biz: "hk4e_cn", game_uid: role.uid, region: role.server }] } }) });
  observer.selectRole(role);
  const endpoint = "https://api-takumi-record.mihoyo.com/game_record/app/genshin/api/character/";
  observer.observe({ url: `${endpoint}list`, method: "POST", status: 200, requestBody: JSON.stringify({ role_id: role.uid, server: role.server }), responseBody: JSON.stringify({ retcode: 0, data: { list: [{ id: 10000002 }] } }) });
  expect(observer.observe({ url: `${endpoint}detail`, method: "POST", status: 200, requestBody: JSON.stringify({ role_id: role.uid, server: role.server, character_ids: [10000002] }), responseBody: JSON.stringify(payload) })).toEqual({ ok: true });
  const finished = observer.finish();
  if (!finished.ok) throw new Error("fixture-observation-failed");
  return finished.goodJson;
}
function build(text = observed()) {
  const result = importPlayerInput(text);
  if (!result.ok) throw new Error("fixture-import-failed");
  return { result, build: result.snapshot.builds[0]! };
}

describe("source-backed official equipment import adapter", () => {
  it.each([95, 100])("preserves level %s and known zero progress/stats through the existing normalizer", level => {
    const { result, build: imported } = build(observed(source(level)));
    expect(result.snapshot.source).toMatchObject({ kind: "official-ui-observation", scope: "file-equipped-subset", fixture: true, uid: role.uid });
    expect(imported.level.value).toBe(level);
    expect(imported.weapon.ascension).toMatchObject({ value: 0, state: "known" });
    expect(imported.weapon.stats).toMatchObject([{ key: { value: "baseAtk" }, amount: { value: 109 } }, { key: { value: "critRate_" }, amount: { value: 0, state: "known" } }]);
    const flower = imported.artifacts[0]!;
    expect(flower).toMatchObject({ item: { state: "known", value: { id: "relic:71544" } }, identity: { value: { id: "artifact-set:14001" } }, level: { value: 0, state: "known" }, main: { key: { value: "hp" }, amount: { value: 717 } } });
    expect(flower.substats).toMatchObject([{ key: { value: "critRate_" }, amount: { value: 0.105 } }, { key: { value: "eleMas" }, amount: { value: 0, state: "known" } }]);
    expect(flower.main.amount.path).toBe("observations.characters[0].relics[0].main.value");
  });

  it("maps observed combat skill IDs to displayed levels once, without deriving base or constellation bonus", () => {
    const { build: imported, result } = build();
    expect(imported.talents.auto.effective.value).toBe(10);
    expect(imported.talents.skill).toMatchObject({ accounting: "effective-only", base: { value: null, state: "missing" }, bonus: { value: null, state: "missing" }, effective: { value: 13, state: "known" } });
    expect(imported.talents.burst.effective.value).toBe(13);
    expect(imported.ascension).toMatchObject({ value: null, state: "missing" });
    const handoff = createCoreHandoff(imported, result.snapshot.source, "cryo");
    expect(handoff.equipment.status).toBe("blocked");
    expect(handoff.equipment.baseTalentLevels.skill).toBeNull();
  });

  it("maps all five explicitly named equipped slots and ignores unequipped/inventory objects", () => {
    const payload = source();
    const first = payload.data.list[0]!.relics[0]!;
    const additions = [
      { id: 71554, pos: 2, pos_name: "死之羽", property: 10, name: "ATK", value: "47" },
      { id: 71524, pos: 4, pos_name: "时之沙", property: 11, name: "生命值", value: "7.0%" },
      { id: 71514, pos: 3, pos_name: "空之杯", property: 12, name: "冰元素伤害加成", value: "7.0%" },
      { id: 71534, pos: 5, pos_name: "理之冠", property: 13, name: "暴击伤害", value: "9.3%" },
    ];
    for (const addition of additions) {
      (payload.data.property_map as Record<string, unknown>)[String(addition.property)] = { property_type: addition.property, name: addition.name, filter_name: "unused" };
      payload.data.list[0]!.relics.push({ ...first, id: addition.id, pos: addition.pos, pos_name: addition.pos_name, main_property: { property_type: addition.property, value: addition.value }, sub_property_list: [] });
    }
    Object.assign(payload.data, { inventory: [{ id: 99999999 }] });
    const { build: imported, result } = build(observed(payload));
    expect(imported.artifacts.map(artifact => artifact.main.key.value)).toEqual(["hp", "atk", "hp_", "cryo_dmg_", "critDMG_"]);
    for (const [i, expected] of [717, 47, 0.07, 0.07, 0.093].entries()) expect(imported.artifacts[i]!.main.amount.value).toBeCloseTo(expected, 12);
    expect(imported.artifacts.every(artifact => artifact.item.state === "known")).toBe(true);
    expect(result.snapshot.source.inventory).toBe("not-imported");
    expect(imported.completeness.issues.every(issue => !issue.path.includes("relics"))).toBe(true);
    expect(imported.completeness.state).toBe("partial"); // Missing proven character progress/base talents still blocks.
  });

  it("rejects contradictory metadata and does not assume percentage units", () => {
    const payload = source(); payload.data.property_map["2"].property_type = 999;
    const imported = build(observed(payload)).build;
    expect(imported.artifacts[0]!.substats[0]!.key.state).toBe("invalid");
    const missingUnit = source(); missingUnit.data.list[0]!.relics[0]!.sub_property_list[0]!.value = "10.5";
    expect(build(observed(missingUnit)).build.artifacts[0]!.substats[0]!.amount.state).toBe("invalid");
  });

  it("does not turn unknown property/item/skill IDs or numeric positions into known data", () => {
    const payload = source();
    payload.data.list[0]!.relics[0]!.id = 99999999;
    payload.data.list[0]!.skills[1]!.skill_id = 99999999;
    payload.data.property_map["2"].name = "Unverified property";
    const { build: imported } = build(observed(payload));
    expect(imported.artifacts[0]!.item.state).toBe("unknown-id");
    expect(imported.artifacts[0]!.substats[0]!.key.state).toBe("unknown-id");
    expect(imported.talents.skill.effective.value).toBeNull();
    expect(imported.completeness.state).toBe("partial");
    const missingName = JSON.parse(observed()); delete missingName.observations.characters[0].relics[0].posName;
    const noPosition = build(JSON.stringify(missingName)).build;
    expect(noPosition.artifacts.every(artifact => artifact.main.amount.value === null)).toBe(true);
    expect(noPosition.completeness.issues.some(issue => issue.note.includes("未知圣遗物位置"))).toBe(true);
  });

  it("keeps absent stat values/substat lists and unknown display formats unresolved", () => {
    const json = JSON.parse(observed());
    delete json.observations.characters[0].relics[0].substats;
    json.observations.characters[0].relics[0].main.value = "1,234";
    const imported = build(JSON.stringify(json)).build;
    expect(imported.artifacts[0]!.substatsState.state).toBe("missing");
    expect(imported.artifacts[0]!.main.amount).toMatchObject({ state: "invalid", value: null });
    delete json.observations.characters[0].relics[0].main.value;
    expect(build(JSON.stringify(json)).build.artifacts[0]!.main.amount.state).toBe("missing");
  });

  it("rejects mismatched roster/detail scope and never replaces the last complete snapshot on partial/failure", () => {
    const old = importPlayerJson(readFileSync(new URL("../fixtures/synthetic-good.json", import.meta.url), "utf8"));
    if (!old.ok) throw new Error("old-fixture-invalid");
    expect(old.snapshot.builds[0]!.completeness.state).toBe("complete");
    const partial = importPlayerInput(observed());
    expect(applyPreview(old.snapshot, partial)).toMatchObject({ applied: false, current: old.snapshot });
    const json = JSON.parse(observed()); json.observations.rosterIds.push(10000042);
    const failed = importPlayerInput(JSON.stringify(json));
    expect(failed).toMatchObject({ ok: false, code: "invalid-input" });
    expect(applyPreview(old.snapshot, failed)).toMatchObject({ applied: false, current: old.snapshot });
  });

  it("rejects unsupported observation versions and secret input, and ignores invented progression fields", () => {
    const json = JSON.parse(observed()); json.observations.format = "gidps-official-ui-observation/2";
    expect(importPlayerInput(JSON.stringify(json))).toMatchObject({ ok: false, code: "unsupported-format" });
    json.observations.format = "gidps-official-ui-observation/1"; json.observations.characters[0].ascension = 6;
    json.observations.characters[0].skills[1].base = 10; json.observations.characters[0].skills[1].bonus = 3;
    expect(build(JSON.stringify(json)).build.ascension.state).toBe("missing");
    expect(build(JSON.stringify(json)).build.talents.skill.base.state).toBe("missing");
    json.observations.password = "synthetic-not-real";
    expect(importOfficialEquipmentObservation(JSON.stringify(json))).toMatchObject({ ok: false, code: "secret-input" });
  });
});
