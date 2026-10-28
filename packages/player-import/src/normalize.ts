import { catalog } from "./catalog";
import { readInput } from "./input";
import { slots, type Artifact, type Field, type Identity, type ImportResult, type PlayerBuild, type Slot, type Stat, type Talent } from "./model";

type Row = Record<string, unknown>;
const row = (v: unknown): Row => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
const array = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const own = (r: Row, k: string) => Object.hasOwn(r, k);
const textId = (v: unknown): string => typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
const key = (v: unknown): string | null => typeof v === "string" && v.length > 0 && v.length <= 120 ? v : null;
const lookup = (map: Record<string, number>, k: unknown) => typeof k === "string" && Object.hasOwn(map, k) ? map[k] : undefined;
function field<T>(value: T | null, path: string, unit: Field<T>["unit"], state: Field<T>["state"] = value === null ? "missing" : "known", note = "源字段直接提供"): Field<T> {
  return { state, value, path, unit, note: value === null && state === "missing" ? "源字段缺失；不补默认值" : note };
}
function num(v: unknown, path: string, min: number, max: number, unit: Field<number>["unit"] = "level", numericString = false): Field<number> {
  if (v === undefined || v === null) return field<number>(null, path, unit);
  const n = numericString && typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max
    ? field(n, path, unit) : field<number>(null, path, unit, "invalid", `需要 ${min}–${max} 的整数`);
}
function identity(id: unknown, entry: { id: string; name: string } | undefined, path: string): Field<Identity> {
  if (id === undefined || id === null || id === "") return field<Identity>(null, path, "identity");
  if (typeof id !== "string" && (typeof id !== "number" || !Number.isSafeInteger(id))) return field<Identity>(null, path, "identity", "invalid", "身份字段需要字符串或安全整数 ID");
  return entry ? field({ id: entry.id, name: entry.name }, path, "identity", "known", "源 ID 由固定目录解析；规范身份和名称来自记录的目录版本")
    : field({ id: textId(id).slice(0, 120), name: "未知 ID" }, path, "identity", "unknown-id", "当前固定目录未识别；不猜测身份");
}
const propKeys: Record<string, string> = {
  FIGHT_PROP_BASE_ATTACK: "baseAtk", FIGHT_PROP_HP: "hp", FIGHT_PROP_ATTACK: "atk", FIGHT_PROP_DEFENSE: "def",
  FIGHT_PROP_HP_PERCENT: "hp_", FIGHT_PROP_ATTACK_PERCENT: "atk_", FIGHT_PROP_DEFENSE_PERCENT: "def_",
  FIGHT_PROP_ELEMENT_MASTERY: "eleMas", FIGHT_PROP_CRITICAL: "critRate_", FIGHT_PROP_CRITICAL_HURT: "critDMG_",
  FIGHT_PROP_CHARGE_EFFICIENCY: "enerRech_", FIGHT_PROP_HEAL_ADD: "heal_", FIGHT_PROP_HEALED_ADD: "incomingHeal_",
  FIGHT_PROP_PHYSICAL_ADD_HURT: "physical_dmg_", FIGHT_PROP_FIRE_ADD_HURT: "pyro_dmg_", FIGHT_PROP_WATER_ADD_HURT: "hydro_dmg_",
  FIGHT_PROP_ICE_ADD_HURT: "cryo_dmg_", FIGHT_PROP_ELEC_ADD_HURT: "electro_dmg_", FIGHT_PROP_WIND_ADD_HURT: "anemo_dmg_",
  FIGHT_PROP_ROCK_ADD_HURT: "geo_dmg_", FIGHT_PROP_GRASS_ADD_HURT: "dendro_dmg_"
};
const panelKeys: Record<string, string> = { "2000": "hp", "2001": "atk", "2002": "def", "28": "eleMas", "20": "critRate_", "22": "critDMG_", "23": "enerRech_", "26": "heal_", "27": "incomingHeal_", "30": "physical_dmg_", "40": "pyro_dmg_", "41": "electro_dmg_", "42": "hydro_dmg_", "43": "dendro_dmg_", "44": "anemo_dmg_", "45": "geo_dmg_", "46": "cryo_dmg_" };
const statKeys = new Set(Object.values(propKeys));
const subKeys = new Set(["hp", "hp_", "atk", "atk_", "def", "def_", "eleMas", "enerRech_", "critRate_", "critDMG_"]);
const mainKeys: Record<Slot, string[]> = {
  flower: ["hp"], plume: ["atk"], sands: ["hp_", "atk_", "def_", "eleMas", "enerRech_"],
  goblet: ["hp_", "atk_", "def_", "eleMas", ...Object.values(propKeys).filter(k => k.endsWith("dmg_"))],
  circlet: ["hp_", "atk_", "def_", "eleMas", "critRate_", "critDMG_", "heal_"]
};
function stat(k: unknown, v: unknown, path: string, encoding: "display" | "ratio", notExported = false, keyField = "key", valueField = "value"): Stat {
  const s = key(k), known = s !== null && statKeys.has(s), unit = !known ? "unknown" : s?.endsWith("_") ? "ratio" : "flat";
  const amount: Field<number> = notExported
    ? field<number>(null, `${path}.${valueField}`, unit, "not-exported", "GOOD 仅导出主词条类型；数值需后续使用精确等级表，预览不推导")
    : v === undefined || v === null ? field<number>(null, `${path}.${valueField}`, unit)
    : typeof v !== "number" || !Number.isFinite(v) || v < 0 ? field<number>(null, `${path}.${valueField}`, unit, "invalid", "需要非负有限数值")
    : field(unit === "ratio" && encoding === "display" ? v / 100 : v, `${path}.${valueField}`, unit, known ? "known" : "unknown-id", !known ? "单位未知，保留源数值，不能参与计算" : unit === "ratio" ? (encoding === "display" ? "源百分数除以 100：10.5% → 0.105" : "源面板已是比例值，不再除以 100") : "源平铺数值；不乘百分比");
  return { key: field(s, `${path}.${keyField}`, "identity", s === null ? "missing" : known ? "known" : "unknown-id", known ? "词条身份已识别" : "未知词条；不猜测单位或身份"), amount };
}
function talent(base: Field<number>, bonus: Field<number>, accounting: Talent["accounting"]): Talent {
  const effective = accounting === "base-only"
    ? field<number>(null, base.path, "level", "not-exported", "GOOD 为基础天赋；未提供额外等级，不从命座再加算")
    : base.state === "known" && bonus.state === "known"
      ? field(base.value! + bonus.value!, base.path, "level", "known", "基础等级加源数据明确额外等级一次；不按命座再次增加")
      : field<number>(null, base.path, "level", "missing", "基础等级或额外等级未知");
  if (effective.value !== null && effective.value > 15) return { base, bonus, effective: field<number>(null, base.path, "level", "invalid", "有效等级超出 15"), accounting };
  return { base, bonus, effective, accounting };
}
/** Small notation primitive for future plain-equipment-text adapters, not a full client-text parser. */
export function parseTalentNotation(text: string): Talent | null {
  const m = text.trim().match(/^(?:Lv\.)?(\d{1,2})(?:\s*[（(]\s*(\d{1,2})\s*\+\s*(\d)\s*[）)])?$/i);
  if (!m) return null;
  const effective = Number(m[1]), base = Number(m[2] ?? m[1]), bonus = Number(m[3] ?? 0);
  if (m[2] === undefined) return effective >= 1 && effective <= 15 ? {
    base: field<number>(null, "text.base", "level"), bonus: field<number>(null, "text.bonus", "level"),
    effective: field(effective, "text.effective", "level", "known", "文本只给显示等级；基础与额外等级未知，不再增加命座等级"), accounting: "effective-only"
  } : null;
  if (base < 1 || base > 10 || bonus > 5 || effective !== base + bonus || effective > 15) return null;
  return talent(field(base, "text.base", "level"), field(bonus, "text.bonus", "level"), "base-plus-explicit-bonus");
}
const enkaSlots: Record<string, Slot> = { EQUIP_BRACER: "flower", EQUIP_NECKLACE: "plume", EQUIP_SHOES: "sands", EQUIP_RING: "goblet", EQUIP_DRESS: "circlet" };
function artifact(raw: unknown, slot: Slot, path: string, good: boolean): Artifact {
  const a = row(raw), flat = row(a.flat), relic = row(a.reliquary);
  const itemMapping = Object.hasOwn(catalog.relics, textId(a.itemId)) ? catalog.relics[textId(a.itemId)] : undefined;
  const item = good ? field<Identity>(null, path, "identity", "not-exported", "GOOD 用套装与位置描述装备，不导出 Enka 物品 ID")
    : identity(a.itemId, itemMapping ? { id: `relic:${textId(a.itemId)}`, name: itemMapping[1] } : undefined, `${path}.itemId`);
  const setId = good ? lookup(catalog.good.artifact, a.setKey) : itemMapping?.[0] ?? (typeof flat.setId === "number" ? flat.setId : undefined);
  const set = setId === undefined || setId === null ? undefined : catalog.sets.get(setId);
  const rarity = num(good ? a.rarity : flat.rankLevel, `${path}.${good ? "rarity" : "flat.rankLevel"}`, 1, 5);
  const maxLevel = rarity.value === null ? 20 : ({ 1: 4, 2: 4, 3: 12, 4: 16, 5: 20 } as Record<number, number>)[rarity.value]!;
  const sourceLevel = good ? a.level : relic.level;
  const level = num(sourceLevel, `${path}.${good ? "level" : "reliquary.level"}`, good ? 0 : 1, good ? maxLevel : maxLevel + 1);
  if (!good && level.value !== null) { level.value -= 1; level.note = "Enka 1–21 减 1 为游戏强化 +0–+20"; }
  const main = row(flat.reliquaryMainstat);
  const mainStat = stat(good ? a.mainStatKey : propKeys[textId(main.mainPropId)] ?? main.mainPropId, good ? undefined : main.statValue, good ? path : `${path}.flat.reliquaryMainstat`, "display", good, good ? "mainStatKey" : "mainPropId", good ? "mainStatKey" : "statValue");
  if (mainStat.key.state === "known" && mainStat.key.value !== null && !mainKeys[slot].includes(mainStat.key.value)) mainStat.key = field(mainStat.key.value, mainStat.key.path, "identity", "invalid", "主词条与位置不匹配");
  const subs = good ? a.substats : flat.reliquarySubstats;
  const substats = array(subs).flatMap((v, i) => {
    const s = row(v);
    if (good && s.key === "" && s.value === 0) return [];
    return [stat(good ? s.key : propKeys[textId(s.appendPropId)] ?? s.appendPropId, good ? s.value : s.statValue, `${path}.${good ? "substats" : "flat.reliquarySubstats"}[${i}]`, "display", false, good ? "key" : "appendPropId", good ? "value" : "statValue")];
  });
  const substatsPath = `${path}.${good ? "substats" : "flat.reliquarySubstats"}`;
  const substatsState = Array.isArray(subs) ? field(substats.length, substatsPath, "count") : field<number>(null, substatsPath, "count");
  const seen = new Set<string>();
  for (const s of substats) {
    if (s.key.state === "known" && s.key.value && (!subKeys.has(s.key.value) || seen.has(s.key.value) || s.key.value === mainStat.key.value)) s.key = field(s.key.value, s.key.path, "identity", "invalid", "副词条类型、重复项或主副词条冲突");
    if (s.key.value) seen.add(s.key.value);
  }
  if (substats.length > 4) Object.assign(substatsState, { state: "invalid", note: "副词条超过四条" });
  const setIdentity = identity(good ? a.setKey : a.itemId ?? flat.setId, set, `${path}.${good ? "setKey" : a.itemId === undefined ? "flat.setId" : "itemId"}`);
  if (set && (rarity.value !== null && !set.rarityList.includes(rarity.value) || !set.slots.some(s => s.slot === slot))) Object.assign(setIdentity, { state: "invalid", note: "套装星级或位置与目录冲突" });
  if (!good && typeof flat.setId === "number" && setId !== flat.setId) Object.assign(setIdentity, { state: "invalid", note: "物品映射与源套装 ID 冲突" });
  return { slot, item, identity: setIdentity, rarity, level, main: mainStat, substats, substatsState };
}
function completeness(build: PlayerBuild, good: boolean, extra: Field<unknown>[]): PlayerBuild["completeness"] {
  const required: Field<unknown>[] = [build.identity, build.level, build.ascension, build.constellation, build.weapon.identity, build.weapon.level, build.weapon.ascension, build.weapon.refinement, ...build.weapon.stats.flatMap(s => [s.key, s.amount]), ...extra];
  for (const t of Object.values(build.talents)) required.push(t.base, ...(good ? [] : [t.bonus, t.effective]));
  for (const a of build.artifacts) required.push(a.identity, a.level, a.rarity, a.main.key, ...(good ? [] : [a.item, a.main.amount]), a.substatsState, ...a.substats.flatMap(s => [s.key, s.amount]));
  const issues = required.filter(f => f.state !== "known").map(f => ({ path: f.path, state: f.state, note: f.note }));
  return { state: issues.length ? "partial" : "complete", required: required.length, known: required.length - issues.length, issues };
}
function normalizeBuild(raw: unknown, root: Row, index: number, good: boolean): PlayerBuild {
  const c = row(raw), path = `${good ? "characters" : "avatarInfoList"}[${index}]`;
  const avatarId = good ? lookup(catalog.good.character, c.key) : typeof c.avatarId === "number" ? c.avatarId : undefined;
  const character = avatarId === undefined ? undefined : catalog.characters.get(avatarId);
  const equips = array(c.equipList);
  const weapons = good ? array(root.weapons).filter(v => row(v).location === c.key) : equips.filter(v => row(row(v).flat).itemType === "ITEM_WEAPON");
  const weapon = row(weapons[0]), w = good ? weapon : row(weapon.weapon);
  const weaponPath = good ? `weapons[${array(root.weapons).indexOf(weapons[0])}]` : `${path}.equipList[${equips.indexOf(weapons[0])}]`;
  const weaponDataPath = good ? weaponPath : `${weaponPath}.weapon`;
  const weaponId = good ? lookup(catalog.good.weapon, weapon.key) : typeof weapon.itemId === "number" ? weapon.itemId : undefined;
  const weaponEntry = weaponId === undefined ? undefined : catalog.weapons.get(weaponId);
  const checks: Field<unknown>[] = [];
  if (weapons.length !== 1) checks.push(field(null, `${path}.weapon`, "count", "invalid", "需要唯一的已装备武器"));
  if (character && weaponEntry && character.weaponType !== weaponEntry.weaponType) checks.push(field(null, `${path}.weapon`, "identity", "invalid", "武器类型与角色不匹配"));
  const affixes = Object.values(row(w.affixMap));
  const refinement = good ? num(w.refinement, `${weaponDataPath}.refinement`, 1, 5) : num(affixes.length === 1 ? affixes[0] : undefined, `${weaponDataPath}.affixMap`, 0, 4);
  if (!good && refinement.value !== null) { refinement.value++; refinement.note = "Enka affixMap 0–4 加 1 为精炼 R1–R5"; }
  if (!good && affixes.length > 1) checks.push(field(null, `${weaponDataPath}.affixMap`, "count", "invalid", "多个精炼项有歧义；不选择第一项"));
  const props = row(c.propMap), lp = row(props["4001"]), ap = row(props["1002"]);
  // Enka's propMap.ival is ignored by protocol; it cannot supply a missing val.
  const level = good ? num(c.level, `${path}.level`, 1, 100) : num(lp.val, `${path}.propMap.4001.val`, 1, 100, "level", true);
  const constellation = good ? num(c.constellation, `${path}.constellation`, 0, 6, "count")
    : Array.isArray(c.talentIdList) ? num(c.talentIdList.length, `${path}.talentIdList`, 0, 6, "count") : !own(c, "talentIdList") ? num(0, `${path}.talentIdList`, 0, 6, "count") : field<number>(null, `${path}.talentIdList`, "count", "invalid", "命座列表格式非法");
  if (!good && constellation.state === "known") constellation.note = "源命座列表的条目数；不以此重复增加天赋等级，不解释单项命座效果";
  if (!good && !own(c, "talentIdList")) constellation.note = "Enka 官方协议：省略 talentIdList 表示 C0；不推广到 GOOD 或文本缺项";
  if (!good && Array.isArray(c.talentIdList) && (new Set(c.talentIdList).size !== c.talentIdList.length || c.talentIdList.some(id => typeof id !== "number" || !Number.isInteger(id) || id <= 0))) Object.assign(constellation, { state: "invalid", value: null, note: "命座列表无效或重复" });
  const skillMap = row(c.skillLevelMap);
  const mappings = catalog.mappings.filter(m => m.avatarId === avatarId && m.skillOrder.every(id => own(skillMap, String(id))));
  const mapping = mappings.length === 1 ? mappings[0] : undefined;
  const talentObject = row(c.talent), bonuses = row(c.proudSkillExtraLevelMap);
  if (!good) {
    for (const id of Object.keys(skillMap)) if (!mapping?.skillOrder.some(known => String(known) === id)) checks.push(field(id, `${path}.skillLevelMap.${id}`, "identity", "unknown-id", "技能 ID 未匹配当前角色唯一战斗天赋变体"));
    for (const id of Object.keys(bonuses)) if (!mapping || !Object.values(mapping.proudMap).some(known => String(known) === id)) checks.push(field(id, `${path}.proudSkillExtraLevelMap.${id}`, "identity", "unknown-id", "额外等级 ID 未匹配当前战斗天赋"));
  }
  const talents = Object.fromEntries((["auto", "skill", "burst"] as const).map((name, i) => {
    const id = mapping?.skillOrder[i], proud = id === undefined ? undefined : mapping?.proudMap[String(id)];
    const base = num(good ? talentObject[name] : id === undefined ? undefined : skillMap[String(id)], `${path}.${good ? `talent.${name}` : `skillLevelMap.${id ?? name}`}`, 1, 10);
    const bonus = good ? field<number>(null, `${path}.talent.${name}.bonus`, "level", "not-exported", "GOOD 仅提供基础天赋")
      : proud === undefined || !own(c, "proudSkillExtraLevelMap") || c.proudSkillExtraLevelMap === null || typeof c.proudSkillExtraLevelMap !== "object" || Array.isArray(c.proudSkillExtraLevelMap) ? field<number>(null, `${path}.proudSkillExtraLevelMap.${proud ?? name}`, "level")
      : num(own(bonuses, String(proud)) ? bonuses[String(proud)] : 0, `${path}.proudSkillExtraLevelMap.${proud}`, 0, 5);
    if (!good && bonus.state === "known" && proud !== undefined && !own(bonuses, String(proud))) bonus.note = "明确提供的稀疏额外等级表中无此项，表示额外 0；不按命座推算";
    return [name, talent(base, bonus, good ? "base-only" : "base-plus-explicit-bonus")];
  })) as PlayerBuild["talents"];
  const artifactItems = good ? array(root.artifacts).filter(v => row(v).location === c.key) : equips.filter(v => row(row(v).flat).itemType === "ITEM_RELIQUARY");
  for (const item of artifactItems) {
    const a = row(item), s = good ? a.slotKey : enkaSlots[textId(row(a.flat).equipType)];
    if (!(slots as readonly unknown[]).includes(s)) checks.push(field(null, `${path}.artifacts`, "identity", "unknown-id", "含未知圣遗物位置；不丢弃后宣称完整"));
  }
  if (!good && equips.some(item => (own(row(item), "reliquary") || own(row(item), "weapon")) && !["ITEM_WEAPON", "ITEM_RELIQUARY"].includes(textId(row(row(item).flat).itemType)))) checks.push(field(null, `${path}.equipList`, "identity", "invalid", "装备缺少可识别类型"));
  const artifacts = slots.map(slot => {
    const candidates = artifactItems.filter(v => good ? row(v).slotKey === slot : enkaSlots[textId(row(row(v).flat).equipType)] === slot);
    if (candidates.length > 1) checks.push(field(null, `${path}.artifacts.${slot}`, "count", "invalid", "同一位置重复装备"));
    const itemPath = candidates.length === 0 ? `${good ? "artifacts" : `${path}.equipList`}[missing:${slot}]` : good ? `artifacts[${array(root.artifacts).indexOf(candidates[0])}]` : `${path}.equipList[${equips.indexOf(candidates[0])}]`;
    return artifact(candidates[0], slot, itemPath, good);
  });
  const panel = row(c.fightPropMap), weaponStats = row(weapon.flat).weaponStats;
  const build: PlayerBuild = {
    key: character?.id ?? `${good ? "good" : "enka"}:unknown:${index}`,
    identity: identity(good ? c.key : c.avatarId, character, `${path}.${good ? "key" : "avatarId"}`),
    level, ascension: num(good ? c.ascension : ap.val, `${path}.${good ? "ascension" : "propMap.1002.val"}`, 0, 6, "level", !good), constellation, talents,
    weapon: {
      identity: identity(good ? weapon.key : weapon.itemId, weaponEntry, `${weaponPath}.${good ? "key" : "itemId"}`),
      level: num(w.level, `${weaponDataPath}.level`, 1, 90), ascension: num(good ? w.ascension : w.promoteLevel, `${weaponDataPath}.${good ? "ascension" : "promoteLevel"}`, 0, 6), refinement,
      stats: good ? [] : array(weaponStats).map((v, i) => stat(propKeys[textId(row(v).appendPropId)] ?? row(v).appendPropId, row(v).statValue, `${weaponPath}.flat.weaponStats[${i}]`, "display", false, "appendPropId", "statValue")),
      statsState: good ? "not-exported" : Array.isArray(weaponStats) ? "observed" : "missing"
    }, artifacts,
    panel: { state: good ? "not-exported" : own(c, "fightPropMap") && c.fightPropMap !== null && typeof c.fightPropMap === "object" && !Array.isArray(c.fightPropMap) ? "observed" : "missing", stats: good ? [] : [
      ...Object.entries(panelKeys).map(([id, k]) => stat(k, panel[id], `${path}.fightPropMap`, "ratio", false, id, id)),
      ...Object.entries(panel).filter(([id]) => !Object.hasOwn(panelKeys, id)).map(([id, v]) => stat(`enka-fight-prop:${id}`, v, `${path}.fightPropMap`, "ratio", false, id, id))
    ] },
    completeness: { state: "partial", known: 0, required: 0, issues: [] }
  };
  build.completeness = completeness(build, good, checks);
  return build;
}

/** Pure, bounded JSON import. No raw payloads retained and no IO, logging or persistence. */
function normalizeInput(text: string, options: { now?: string; fetchedAt?: string; viaUid?: boolean; uid?: string; fixture?: boolean } = {}): ImportResult {
  const parsed = readInput(text);
  if (!parsed.ok) return parsed.secret
    ? { ok: false, code: "secret-input", message: "输入疑似包含会话秘密，已拒绝。请仅提供纯配装数据。" }
    : { ok: false, code: "invalid-input", message: "需要有效、大小不超过 2 MB 的纯配装 JSON。" };
  const root = row(parsed.value), good = root.format === "GOOD";
  if (good ? ![1, 2, 3].includes(root.version as number) : !(own(root, "playerInfo") && typeof root.playerInfo === "object" && root.playerInfo !== null && !Array.isArray(root.playerInfo) && Array.isArray(root.avatarInfoList))) return { ok: false, code: "unsupported-format", message: "仅支持 GOOD v1–v3 或原始 Enka 展示柜 JSON。" };
  const characters = good ? root.characters : root.avatarInfoList;
  if (!Array.isArray(characters) || characters.length === 0 || characters.length > 500) return { ok: false, code: "empty-import", message: "没有可预览角色，或角色数量超出限制；旧数据保持。" };
  const importedAt = options.now ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(importedAt)) || options.fetchedAt !== undefined && !Number.isFinite(Date.parse(options.fetchedAt))) return { ok: false, code: "invalid-input", message: "导入时间元数据无效。" };
  const builds = characters.map((c, i) => normalizeBuild(c, root, i, good));
  const duplicates = new Set<string>();
  for (const b of builds) {
    if (duplicates.has(b.key)) { b.completeness.state = "partial"; b.completeness.required++; b.completeness.issues.push({ path: b.identity.path, state: "invalid", note: "角色身份重复；不选择任一项覆盖" }); }
    duplicates.add(b.key);
  }
  return { ok: true, snapshot: {
    schemaVersion: "player-import/1", source: {
      kind: good ? "good-file" : options.viaUid ? "enka-uid" : "enka-json", uid: !good && /^[1-9]\d{8,9}$/.test(options.uid ?? textId(root.uid)) ? options.uid ?? textId(root.uid) : null, scope: good ? "file-equipped-subset" : "public-showcase",
      inventory: "not-imported", history: "not-imported", importedAt, fetchedAt: options.fetchedAt ?? null, snapshotAt: null,
      freshness: "upstream-snapshot-time-unknown", fixture: options.fixture === true || root.syntheticFixture === true, catalogRevision: catalog.revision
    }, builds,
    notices: [good ? "仅预览文件中角色当前装备；不代表全部账号或背包。未装备物品不进入此配装模型。" : "仅公开展示柜当前配装；不代表全部已拥有角色、背包或历史。", "完整度仅衡量配装源字段；面板字段、可计算性和数值正确性单独审计，导入不会调用计算引擎。", "导入/请求完成时间不是游戏数据快照时间。", "缺失位置无法区分未装备或未导出，保持待确认。"]
  } };
}

/** Contain malformed untrusted object shapes without exposing native exception text. */
export function importPlayerJson(text: string, options: Parameters<typeof normalizeInput>[1] = {}): ImportResult {
  try { return normalizeInput(text, options); }
  catch { return { ok: false, code: "invalid-input", message: "配装结构无效。旧数据保持。" }; }
}
