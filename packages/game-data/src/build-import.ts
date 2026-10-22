import identityMaps from "../sources/build-import/identity-maps.json";
import relicIdentityMap from "../sources/build-import/libs__gi__dm__src__dm__artifact__ReliquaryExcelConfigData_idmap_gen.json";
import { gameDataCatalog } from "./catalog";
import { equipmentArtifactSets, equipmentCatalog, type EquipmentDataset } from "./equipment-dataset";
import type { EquipmentBuildInput } from "./equipment-build";
import { ARTIFACT_MAIN_STATS, ARTIFACT_SUB_STATS, ARTIFACT_SLOTS, type ArtifactPieceInput, type ArtifactRarity, type ArtifactSlot, type ArtifactStatKey, type ArtifactSubstatKey } from "./artifact-build";

export interface BuildImportDiagnostic { code: string; path: string; message: string; severity: "warning" | "error" }
export interface ImportedEditableBuild {
  sourceKey: string;
  name: string;
  equipmentInput: EquipmentBuildInput | null;
  constellation: number | null;
  baseTalentLevels: { auto: number | null; skill: number | null; burst: number | null };
  diagnostics: BuildImportDiagnostic[];
  raw: unknown;
}
export interface BuildImportBatch { format: "GOOD" | "enka"; builds: ImportedEditableBuild[]; diagnostics: BuildImportDiagnostic[] }

type Row = Record<string, unknown>;
const row = (value: unknown): Row | null => value && typeof value === "object" && !Array.isArray(value) ? value as Row : null;
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const integer = (value: unknown, min: number, max: number): number | null => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
const enkaPropInteger = (value: unknown, min: number, max: number): number | null => {
  if (typeof value !== "number" && (typeof value !== "string" || value.trim() === "")) return null;
  return integer(Number(value), min, max);
};
const finite = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const string = (value: unknown): string | null => typeof value === "string" && value.length > 0 ? value : null;
const diagnostic = (code: string, path: string, message: string, severity: "warning" | "error" = "error"): BuildImportDiagnostic => ({ code, path, message, severity });
const percent = (stat: string, value: number) => stat.endsWith("_") ? value / 100 : value;
const allStats = new Set<string>([...ARTIFACT_SUB_STATS, ...ARTIFACT_MAIN_STATS.goblet, ...ARTIFACT_MAIN_STATS.circlet]);
const mainKey = (value: unknown): ArtifactStatKey | null => typeof value === "string" && allStats.has(value) ? value as ArtifactStatKey : null;
const subKey = (value: unknown): ArtifactSubstatKey | null => typeof value === "string" && (ARTIFACT_SUB_STATS as readonly string[]).includes(value) ? value as ArtifactSubstatKey : null;
const fightPropToStat = Object.fromEntries(Object.entries({ hp: "FIGHT_PROP_HP", hp_: "FIGHT_PROP_HP_PERCENT", atk: "FIGHT_PROP_ATTACK", atk_: "FIGHT_PROP_ATTACK_PERCENT", def: "FIGHT_PROP_DEFENSE", def_: "FIGHT_PROP_DEFENSE_PERCENT", eleMas: "FIGHT_PROP_ELEMENT_MASTERY", enerRech_: "FIGHT_PROP_CHARGE_EFFICIENCY", critRate_: "FIGHT_PROP_CRITICAL", critDMG_: "FIGHT_PROP_CRITICAL_HURT", heal_: "FIGHT_PROP_HEAL_ADD", physical_dmg_: "FIGHT_PROP_PHYSICAL_ADD_HURT", pyro_dmg_: "FIGHT_PROP_FIRE_ADD_HURT", hydro_dmg_: "FIGHT_PROP_WATER_ADD_HURT", cryo_dmg_: "FIGHT_PROP_ICE_ADD_HURT", electro_dmg_: "FIGHT_PROP_ELEC_ADD_HURT", anemo_dmg_: "FIGHT_PROP_WIND_ADD_HURT", geo_dmg_: "FIGHT_PROP_ROCK_ADD_HURT", dendro_dmg_: "FIGHT_PROP_GRASS_ADD_HURT" }).map(([key, value]) => [value, key])) as Record<string, ArtifactStatKey>;
const enkaSlots: Record<string, ArtifactSlot> = { EQUIP_BRACER: "flower", EQUIP_NECKLACE: "plume", EQUIP_SHOES: "sands", EQUIP_RING: "goblet", EQUIP_DRESS: "circlet" };
/** Pinned Optimizer DM map: Enka relic itemId -> [artifact setId, piece name]. */
const enkaRelicSets = relicIdentityMap as unknown as Record<string, [number | null, string]>;

function index(dataset?: EquipmentDataset) {
  const catalog = equipmentCatalog(dataset);
  return {
    characters: new Map(catalog.characters.map(entry => [entry.avatarId, entry])),
    weapons: new Map(catalog.weapons.map(entry => [entry.itemId, entry])),
    sets: new Map(equipmentArtifactSets(dataset).map(entry => [entry.id, entry]))
  };
}

function artifact(input: { setId: number | null; slot: ArtifactSlot | null; rarity: number | null; level: number | null; main: ArtifactStatKey | null; mainValue?: number; substats: { stat: ArtifactSubstatKey; value: number }[]; source: string }, path: string, diagnostics: BuildImportDiagnostic[], dataset?: EquipmentDataset): ArtifactPieceInput | null {
  const setId = input.setId === null ? null : `artifact-set:${input.setId}`;
  const set = setId ? index(dataset).sets.get(setId) : null;
  const rarity = integer(input.rarity, 1, 5) as ArtifactRarity | null;
  const level = integer(input.level, 0, rarity === null ? 20 : ({ 1: 4, 2: 4, 3: 12, 4: 16, 5: 20 } as const)[rarity]);
  if (!set || !input.slot || !rarity || level === null || !input.main || !ARTIFACT_MAIN_STATS[input.slot].includes(input.main) || !set.slots.some(entry => entry.slot === input.slot) || !set.rarityList.includes(rarity)) {
    diagnostics.push(diagnostic("artifact-unresolved", path, "圣遗物套装、位置、星级、等级或主词条无法由当前目录确认。")); return null;
  }
  const seen = new Set<string>();
  for (const sub of input.substats) {
    if (sub.stat === input.main || seen.has(sub.stat) || !Number.isFinite(sub.value) || sub.value < 0) {
      diagnostics.push(diagnostic("artifact-substat-invalid", path, "副词条重复、与主词条相同或数值无效。")); return null;
    }
    seen.add(sub.stat);
  }
  if (input.substats.length > 4) { diagnostics.push(diagnostic("artifact-substat-count", path, "圣遗物副词条多于四条。")); return null; }
  return { slot: input.slot, setId: set!.id, rarity, level, mainStat: input.main, initialSubstats: 0, substats: [], observed: { source: input.source, ...(input.mainValue === undefined ? {} : { mainStatValue: input.mainValue }), substats: input.substats } };
}

function equipment(characterId: string | null, weaponId: string | null, level: number | null, ascension: number | null, weaponLevel: number | null, weaponAscension: number | null, refinement: number | null, artifacts: ArtifactPieceInput[], diagnostics: BuildImportDiagnostic[]): EquipmentBuildInput | null {
  if (!characterId || !weaponId || level === null || ascension === null || weaponLevel === null || weaponAscension === null || refinement === null || diagnostics.some(entry => entry.severity === "error")) return null;
  return { characterId, weaponId, level, ascension, weaponLevel, weaponAscension, refinement, effectsDisabled: true, artifacts, weaponEffectsEnabled: false, setEffectsEnabled: false };
}

/** GOOD stores equipped gear in top-level arrays using the character key in `location`. */
export function parseGoodBuilds(raw: unknown, options: { dataset?: EquipmentDataset } = {}): BuildImportBatch {
  const root = row(raw);
  const batch: BuildImportBatch = { format: "GOOD", builds: [], diagnostics: [] };
  if (!root || root.format !== "GOOD" || ![1, 2, 3].includes(Number(root.version))) { batch.diagnostics.push(diagnostic("good-format", "$", "文件不是受支持的 GOOD v1–v3 导出。")); return batch; }
  const maps = identityMaps as unknown as { character: Record<string, number>; weapon: Record<string, number>; artifact: Record<string, number> };
  const catalog = index(options.dataset);
  for (const [i, value] of list(root.characters).entries()) {
    const c = row(value), path = `characters[${i}]`, diagnostics: BuildImportDiagnostic[] = [];
    const key = string(c?.key) ?? `unknown-${i}`;
    const avatarId = maps.character[key];
    const character = avatarId === undefined ? null : catalog.characters.get(avatarId) ?? null;
    if (!character) diagnostics.push(diagnostic("character-unmapped", `${path}.key`, `GOOD 角色 ${key} 无法匹配当前目录。`));
    const weapons = list(root.weapons).filter(item => row(item)?.location === key);
    if (weapons.length !== 1) diagnostics.push(diagnostic("weapon-ambiguous", "weapons", `角色 ${key} 的已装备武器数量为 ${weapons.length}，无法构造完整配装。`));
    const w = row(weapons[0]);
    const itemId = w ? maps.weapon[string(w.key) ?? ""] : undefined;
    const weapon = itemId === undefined ? null : catalog.weapons.get(itemId) ?? null;
    if (w && !weapon) diagnostics.push(diagnostic("weapon-unmapped", "weapons", `GOOD 武器 ${String(w.key)} 无法匹配当前目录。`));
    if (character && weapon && character.weaponType !== weapon.weaponType) diagnostics.push(diagnostic("weapon-type", "weapons", "GOOD 武器类型与角色不匹配。"));
    const artifacts: ArtifactPieceInput[] = [];
    for (const [j, value] of list(root.artifacts).entries()) {
      const a = row(value); if (a?.location !== key) continue;
      const subs: { stat: ArtifactSubstatKey; value: number }[] = [];
      let invalid = false;
      for (const [k, item] of list(a.substats).entries()) {
        const s = row(item), stat = subKey(s?.key), amount = finite(s?.value);
        if (s?.key === "" && amount === 0) continue;
        if (!stat || amount === null) { diagnostics.push(diagnostic("substat-unresolved", `artifacts[${j}].substats[${k}]`, "GOOD 副词条身份或数值无效。")); invalid = true; }
        else subs.push({ stat, value: percent(stat, amount) });
      }
      if (invalid) continue;
      const piece = artifact({ setId: maps.artifact[string(a.setKey) ?? ""] ?? null, slot: (ARTIFACT_SLOTS as readonly string[]).includes(String(a.slotKey)) ? a.slotKey as ArtifactSlot : null, rarity: integer(a.rarity, 1, 5), level: integer(a.level, 0, 20), main: mainKey(a.mainStatKey), substats: subs, source: `GOOD:${String(root.source ?? "unknown")};artifact=${j}` }, `artifacts[${j}]`, diagnostics, options.dataset);
      if (piece) artifacts.push(piece);
    }
    if (new Set(artifacts.map(piece => piece.slot)).size !== artifacts.length) diagnostics.push(diagnostic("artifact-slot-duplicate", path, "同一角色有重复圣遗物位置。"));
    const talent = row(c?.talent);
    const levels = { auto: integer(talent?.auto, 1, 15), skill: integer(talent?.skill, 1, 15), burst: integer(talent?.burst, 1, 15) };
    if (Object.values(levels).some(level => level === null)) diagnostics.push(diagnostic("talent-missing", `${path}.talent`, "基础天赋等级缺失或无效。", "warning"));
    if (integer(c?.level, 1, 100) === null || integer(c?.ascension, 0, 6) === null || integer(w?.level, 1, 90) === null || integer(w?.ascension, 0, 6) === null || integer(w?.refinement, 1, 5) === null) diagnostics.push(diagnostic("progression-missing", path, "角色或武器等级、突破、精炼信息缺失。"));
    batch.builds.push({ sourceKey: key, name: character?.name ?? key, equipmentInput: equipment(character?.id ?? null, weapon?.id ?? null, integer(c?.level, 1, 100), integer(c?.ascension, 0, 6), integer(w?.level, 1, 90), integer(w?.ascension, 0, 6), integer(w?.refinement, 1, 5), artifacts, diagnostics), constellation: integer(c?.constellation, 0, 6), baseTalentLevels: levels, diagnostics, raw: value });
  }
  return batch;
}

/** Reads Enka's raw response directly so absent levels and ascensions stay absent. */
export function parseEnkaBuilds(raw: unknown, options: { uid: string; fetchedAt?: string; dataset?: EquipmentDataset }): BuildImportBatch {
  const root = row(raw), batch: BuildImportBatch = { format: "enka", builds: [], diagnostics: [] };
  if (!root || !row(root.playerInfo) || !Array.isArray(root.avatarInfoList)) { batch.diagnostics.push(diagnostic("enka-format", "$", "展示柜响应缺少 playerInfo 或 avatarInfoList。")); return batch; }
  const catalog = index(options.dataset);
  for (const [i, value] of list(root.avatarInfoList).entries()) {
    const a = row(value), path = `avatarInfoList[${i}]`, diagnostics: BuildImportDiagnostic[] = [];
    const avatarId = integer(a?.avatarId, 1, Number.MAX_SAFE_INTEGER);
    const character = avatarId === null ? null : catalog.characters.get(avatarId);
    if (!character) diagnostics.push(diagnostic("character-unmapped", `${path}.avatarId`, `展示柜角色 ${String(a?.avatarId)} 无法匹配当前目录。`));
    const equips = list(a?.equipList).map(row).filter((item): item is Row => item !== null);
    const weaponItems = equips.filter(item => row(item.flat)?.itemType === "ITEM_WEAPON");
    if (weaponItems.length !== 1) diagnostics.push(diagnostic("weapon-ambiguous", `${path}.equipList`, "展示柜没有唯一的已装备武器。"));
    const weaponItem = weaponItems[0], weaponRaw = row(weaponItem?.weapon), weaponId = integer(weaponItem?.itemId, 1, Number.MAX_SAFE_INTEGER);
    const weapon = weaponId === null ? null : catalog.weapons.get(weaponId);
    if (!weapon) diagnostics.push(diagnostic("weapon-unmapped", `${path}.equipList`, `展示柜武器 ${String(weaponItem?.itemId)} 无法匹配当前目录。`));
    if (character && weapon && character.weaponType !== weapon.weaponType) diagnostics.push(diagnostic("weapon-type", `${path}.equipList`, "展示柜武器类型与角色不匹配。"));
    const affixes = Object.values(row(weaponRaw?.affixMap) ?? {});
    const refinement = affixes.length ? integer(affixes[0], 0, 4) : weapon?.refinements.length === 0 ? 0 : null;
    if (refinement === null) diagnostics.push(diagnostic("refinement-missing", `${path}.equipList`, "可精炼武器缺少 Enka affixMap，无法确认精炼等级。"));
    const artifacts: ArtifactPieceInput[] = [];
    for (const [j, item] of equips.entries()) {
      const flat = row(item.flat), relic = row(item.reliquary);
      if (flat?.itemType !== "ITEM_RELIQUARY") {
        if (relic) diagnostics.push(diagnostic("artifact-type-missing", `${path}.equipList[${j}]`, "装备包含圣遗物数据，但 flat.itemType 缺失或不匹配。"));
        continue;
      }
      const slot = enkaSlots[string(flat.equipType) ?? ""] ?? null;
      const main = row(flat.reliquaryMainstat), mainStat = fightPropToStat[string(main?.mainPropId) ?? ""] ?? null, mainValue = finite(main?.statValue);
      if (mainValue === null) { diagnostics.push(diagnostic("artifact-main-missing", `${path}.equipList[${j}]`, "展示柜圣遗物主词条数值缺失。")); continue; }
      const subs: { stat: ArtifactSubstatKey; value: number }[] = [];
      let invalid = false;
      for (const [k, value] of list(flat.reliquarySubstats).entries()) {
        const s = row(value), stat = subKey(fightPropToStat[string(s?.appendPropId) ?? ""]), amount = finite(s?.statValue);
        if (!stat || amount === null) { diagnostics.push(diagnostic("substat-unresolved", `${path}.equipList[${j}].flat.reliquarySubstats[${k}]`, "展示柜副词条身份或数值无效。")); invalid = true; }
        else subs.push({ stat, value: percent(stat, amount) });
      }
      if (invalid) continue;
      const relicItemId = integer(item.itemId, 1, Number.MAX_SAFE_INTEGER);
      const mappedSetId = relicItemId === null ? null : enkaRelicSets[String(relicItemId)]?.[0] ?? null;
      const flatSetId = integer(flat.setId, 1, Number.MAX_SAFE_INTEGER);
      if (mappedSetId !== null && flatSetId !== null && mappedSetId !== flatSetId) { diagnostics.push(diagnostic("artifact-set-conflict", `${path}.equipList[${j}]`, "Enka 套装 ID 与固定物品身份表冲突。")); continue; }
      const piece = artifact({ setId: mappedSetId ?? flatSetId, slot, rarity: integer(flat.rankLevel, 1, 5), level: relic ? integer(relic.level, 1, 21) === null ? null : Number(relic.level) - 1 : null, main: mainStat, mainValue: percent(mainStat ?? "", mainValue), substats: subs, source: `enka:${options.uid};${options.fetchedAt ?? "unversioned"};item=${String(item.itemId)};relic-map=180a0a1` }, `${path}.equipList[${j}]`, diagnostics, options.dataset);
      if (piece) artifacts.push(piece);
    }
    if (new Set(artifacts.map(piece => piece.slot)).size !== artifacts.length) diagnostics.push(diagnostic("artifact-slot-duplicate", path, "展示柜有重复圣遗物位置。"));
    const prop = row(a?.propMap), levelProp = row(prop?.["4001"]), ascProp = row(prop?.["1002"]);
    // Enka's propMap value is val; ival is explicitly documented as ignored.
    const level = enkaPropInteger(levelProp?.val, 1, 100);
    const ascension = enkaPropInteger(ascProp?.val, 0, 6);
    const skillMap = row(a?.skillLevelMap);
    const mapping = (options.dataset?.catalog ?? gameDataCatalog).enkaCharacterMappings.find(entry => entry.avatarId === avatarId && entry.skillOrder.some(id => skillMap?.[String(id)] !== undefined));
    const [autoId, skillId, burstId] = mapping?.skillOrder ?? [];
    const levels = { auto: autoId === undefined ? null : integer(skillMap?.[String(autoId)], 1, 15), skill: skillId === undefined ? null : integer(skillMap?.[String(skillId)], 1, 15), burst: burstId === undefined ? null : integer(skillMap?.[String(burstId)], 1, 15) };
    if (Object.values(levels).some(value => value === null)) diagnostics.push(diagnostic("talent-missing", `${path}.skillLevelMap`, "基础天赋无法完整对应到当前角色技能映射。", "warning"));
    if (level === null || ascension === null) diagnostics.push(diagnostic("character-progression-missing", `${path}.propMap`, "角色等级或突破阶段缺失。"));
    const weaponLevel = integer(weaponRaw?.level, 1, 90), weaponAscension = integer(weaponRaw?.promoteLevel, 0, 6);
    if (weaponLevel === null || weaponAscension === null) diagnostics.push(diagnostic("weapon-progression-missing", `${path}.equipList`, "武器等级或突破阶段缺失。"));
    batch.builds.push({ sourceKey: String(a?.avatarId ?? `unknown-${i}`), name: character?.name ?? `角色 ${String(a?.avatarId)}`, equipmentInput: equipment(character?.id ?? null, weapon?.id ?? null, level, ascension, weaponLevel, weaponAscension, refinement === null ? null : refinement + 1, artifacts, diagnostics), constellation: Array.isArray(a?.talentIdList) ? integer(a.talentIdList.length, 0, 6) : 0, baseTalentLevels: levels, diagnostics, raw: value });
  }
  return batch;
}
