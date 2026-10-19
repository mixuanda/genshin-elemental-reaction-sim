import mainStats from "../sources/artifacts/artifact_main.json";
import subStats from "../sources/artifacts/artifact_sub.json";
import source from "../sources/artifacts/manifest.json";
import { artifactSetCatalog } from "./supplemental";
import { requireEquipmentArtifactSet, type EquipmentDataset } from "./equipment-dataset";

export const ARTIFACT_SLOTS = ["flower", "plume", "sands", "goblet", "circlet"] as const;
export type ArtifactSlot = typeof ARTIFACT_SLOTS[number];
export type ArtifactRarity = 1 | 2 | 3 | 4 | 5;
export const ARTIFACT_STAT_PROPERTIES = {
  hp: "FIGHT_PROP_HP", hp_: "FIGHT_PROP_HP_PERCENT", atk: "FIGHT_PROP_ATTACK", atk_: "FIGHT_PROP_ATTACK_PERCENT",
  def: "FIGHT_PROP_DEFENSE", def_: "FIGHT_PROP_DEFENSE_PERCENT", eleMas: "FIGHT_PROP_ELEMENT_MASTERY", enerRech_: "FIGHT_PROP_CHARGE_EFFICIENCY",
  critRate_: "FIGHT_PROP_CRITICAL", critDMG_: "FIGHT_PROP_CRITICAL_HURT", heal_: "FIGHT_PROP_HEAL_ADD",
  physical_dmg_: "FIGHT_PROP_PHYSICAL_ADD_HURT", pyro_dmg_: "FIGHT_PROP_FIRE_ADD_HURT", hydro_dmg_: "FIGHT_PROP_WATER_ADD_HURT",
  cryo_dmg_: "FIGHT_PROP_ICE_ADD_HURT", electro_dmg_: "FIGHT_PROP_ELEC_ADD_HURT", anemo_dmg_: "FIGHT_PROP_WIND_ADD_HURT",
  geo_dmg_: "FIGHT_PROP_ROCK_ADD_HURT", dendro_dmg_: "FIGHT_PROP_GRASS_ADD_HURT"
} as const;
export type ArtifactStatKey = keyof typeof ARTIFACT_STAT_PROPERTIES;
export const ARTIFACT_STAT_LABELS: Record<ArtifactStatKey, string> = {
  hp: "固定生命", hp_: "生命百分比", atk: "固定攻击", atk_: "攻击百分比", def: "固定防御", def_: "防御百分比",
  eleMas: "元素精通", enerRech_: "元素充能", critRate_: "暴击率", critDMG_: "暴击伤害", heal_: "治疗加成",
  physical_dmg_: "物理增伤", pyro_dmg_: "火元素增伤", hydro_dmg_: "水元素增伤", cryo_dmg_: "冰元素增伤",
  electro_dmg_: "雷元素增伤", anemo_dmg_: "风元素增伤", geo_dmg_: "岩元素增伤", dendro_dmg_: "草元素增伤"
};
export const ARTIFACT_SLOT_LABELS: Record<ArtifactSlot, string> = { flower: "生之花", plume: "死之羽", sands: "时之沙", goblet: "空之杯", circlet: "理之冠" };
export const ARTIFACT_MAX_LEVEL: Record<ArtifactRarity, number> = { 1: 4, 2: 4, 3: 12, 4: 16, 5: 20 };
export const ARTIFACT_INITIAL_SUBSTATS: Record<ArtifactRarity, readonly number[]> = { 1: [0], 2: [0, 1], 3: [1, 2], 4: [2, 3], 5: [3, 4] };
export const ARTIFACT_MAIN_STATS: Record<ArtifactSlot, readonly ArtifactStatKey[]> = {
  flower: ["hp"], plume: ["atk"], sands: ["hp_", "def_", "atk_", "eleMas", "enerRech_"],
  goblet: ["hp_", "def_", "atk_", "eleMas", "physical_dmg_", "pyro_dmg_", "hydro_dmg_", "cryo_dmg_", "electro_dmg_", "anemo_dmg_", "geo_dmg_", "dendro_dmg_"],
  circlet: ["hp_", "def_", "atk_", "eleMas", "critRate_", "critDMG_", "heal_"]
};
export const ARTIFACT_SUB_STATS = ["hp", "hp_", "atk", "atk_", "def", "def_", "eleMas", "enerRech_", "critRate_", "critDMG_"] as const;
export type ArtifactSubstatKey = typeof ARTIFACT_SUB_STATS[number];

export interface ArtifactPieceInput {
  slot: ArtifactSlot;
  setId: string;
  rarity: ArtifactRarity;
  level: number;
  mainStat: ArtifactStatKey;
  initialSubstats: number;
  /** Exact tier indices, starting at zero; one entry per initial or upgrade roll. */
  substats: { stat: ArtifactSubstatKey; rolls: number[] }[];
  /** Imported/displayed aggregate values; never reverse-engineered into roll histories.
   * Percent values use fractions (0.1 = 10%). Omitted main value uses the exact level table. */
  observed?: {
    source: string;
    mainStatValue?: number;
    substats: { stat: ArtifactSubstatKey; value: number }[];
  };
}
export interface ArtifactStatTerm { property: string; value: number; sourceRef: string }
export interface ArtifactBuildResolution {
  pieces: ArtifactPieceInput[];
  statContributions: ArtifactStatTerm[];
  setCounts: Record<string, number>;
  sourceRefs: string[];
  sourceVersion: string;
}
export const artifactStatSource = source;
export { artifactSetCatalog };
const mainTable = mainStats as Record<string, Partial<Record<ArtifactStatKey, number[]>>>;
const subTable = subStats as Record<string, Partial<Record<ArtifactSubstatKey, number[]>>>;
const mainSource = source.files.find(file => file.file === "artifact_main.json")!.url;
const subSource = source.files.find(file => file.file === "artifact_sub.json")!.url;

export function artifactMainStatValue(rarity: ArtifactRarity, level: number, stat: ArtifactStatKey): number {
  if (!Number.isInteger(level) || level < 0 || level > ARTIFACT_MAX_LEVEL[rarity]) throw new Error(`${rarity} 星圣遗物等级须为 0–${ARTIFACT_MAX_LEVEL[rarity]} 的整数。`);
  const value = mainTable[String(rarity)]?.[stat]?.[level];
  if (value === undefined) throw new Error(`缺少 ${rarity} 星 ${stat} +${level} 的精确主词条数据。`);
  return value;
}

export function artifactSubstatTiers(rarity: ArtifactRarity, stat: ArtifactSubstatKey): readonly number[] {
  const values = subTable[String(rarity)]?.[stat];
  if (!values) throw new Error(`缺少 ${rarity} 星 ${stat} 的副词条档位。`);
  return values;
}

/** Resolve actual pieces and legal roll histories; aggregate values never become a guessed history. */
export function resolveArtifactBuild(pieces: readonly ArtifactPieceInput[], dataset?: EquipmentDataset): ArtifactBuildResolution {
  const occupied = new Set<ArtifactSlot>();
  const statContributions: ArtifactStatTerm[] = [];
  const setCounts: Record<string, number> = {};
  for (const piece of pieces) {
    if (occupied.has(piece.slot)) throw new Error(`${ARTIFACT_SLOT_LABELS[piece.slot]}不能重复装备。`);
    occupied.add(piece.slot);
    const set = requireEquipmentArtifactSet(piece.setId, dataset);
    if (!set) throw new Error(`未收录圣遗物套装 ${piece.setId}。`);
    if (!set.slots.some(slot => slot.slot === piece.slot)) throw new Error(`${set.name}没有${ARTIFACT_SLOT_LABELS[piece.slot]}。`);
    if (!set.rarityList.includes(piece.rarity)) throw new Error(`${set.name}不存在 ${piece.rarity} 星版本。`);
    if (!ARTIFACT_MAIN_STATS[piece.slot]?.includes(piece.mainStat)) throw new Error(`${ARTIFACT_SLOT_LABELS[piece.slot]}不允许主词条 ${piece.mainStat}。`);
    const tableMainValue = artifactMainStatValue(piece.rarity, piece.level, piece.mainStat);
    const mainValue = piece.observed?.mainStatValue ?? tableMainValue;
    if (!Number.isFinite(mainValue) || mainValue < 0) throw new Error("导入主词条必须为非负有限数值。");
    statContributions.push({ property: ARTIFACT_STAT_PROPERTIES[piece.mainStat], value: mainValue, sourceRef: piece.observed?.mainStatValue !== undefined ? `${piece.observed.source};observed-main;slot=${piece.slot}` : `${mainSource}#/${piece.rarity}/${piece.mainStat}/${piece.level};slot=${piece.slot};set=${piece.setId}` });

    if (piece.observed) {
      if (!piece.observed.source || piece.observed.substats.length > 4) throw new Error("导入词条需要来源，且每件至多四条副词条。");
      const keys = new Set<string>();
      for (const sub of piece.observed.substats) {
        if (!ARTIFACT_SUB_STATS.includes(sub.stat) || sub.stat === piece.mainStat || keys.has(sub.stat)) throw new Error("导入主副词条不能同名，副词条也不能重复。");
        if (!Number.isFinite(sub.value) || sub.value < 0) throw new Error("导入副词条必须为非负有限数值。");
        keys.add(sub.stat);
        statContributions.push({ property: ARTIFACT_STAT_PROPERTIES[sub.stat], value: sub.value, sourceRef: `${piece.observed.source};observed-substat=${sub.stat};slot=${piece.slot}` });
      }
      setCounts[piece.setId] = (setCounts[piece.setId] ?? 0) + 1;
      continue;
    }

    if (!ARTIFACT_INITIAL_SUBSTATS[piece.rarity].includes(piece.initialSubstats)) throw new Error(`${piece.rarity} 星圣遗物初始副词条数量应为 ${ARTIFACT_INITIAL_SUBSTATS[piece.rarity].join(" 或 ")}。`);
    const expectedRolls = piece.initialSubstats + Math.floor(piece.level / 4);
    if (piece.substats.length !== Math.min(4, expectedRolls)) throw new Error(`${set.name} +${piece.level} 应有 ${Math.min(4, expectedRolls)} 条已解锁副词条。`);
    const subKeys = new Set<string>();
    let totalRolls = 0;
    for (const sub of piece.substats) {
      if (sub.stat === piece.mainStat || subKeys.has(sub.stat)) throw new Error("主副词条不能同名，副词条也不能重复。");
      subKeys.add(sub.stat);
      if (!ARTIFACT_SUB_STATS.includes(sub.stat)) throw new Error(`不合法的副词条 ${sub.stat}。`);
      if (!sub.rolls.length || (piece.substats.length < 4 && sub.rolls.length > 1)) throw new Error("未解锁四条副词条前，强化必须新增词条；每个词条至少包含一次初始档位。");
      const tiers = artifactSubstatTiers(piece.rarity, sub.stat);
      for (const [index, tier] of sub.rolls.entries()) {
        if (!Number.isInteger(tier) || tiers[tier] === undefined) throw new Error(`${ARTIFACT_STAT_LABELS[sub.stat]}没有档位 ${tier}。`);
        statContributions.push({ property: ARTIFACT_STAT_PROPERTIES[sub.stat], value: tiers[tier]!, sourceRef: `${subSource}#/${piece.rarity}/${sub.stat}/${tier};slot=${piece.slot};roll=${index}` });
      }
      totalRolls += sub.rolls.length;
    }
    if (totalRolls !== expectedRolls) throw new Error(`${set.name} +${piece.level} 需要 ${expectedRolls} 次初始／强化档位，实际为 ${totalRolls}。`);
    setCounts[piece.setId] = (setCounts[piece.setId] ?? 0) + 1;
  }
  return { pieces: structuredClone([...pieces]), statContributions, setCounts, sourceRefs: [...source.files.filter(file => file.file !== "LICENSE").map(file => file.url), ...pieces.flatMap(piece => piece.observed ? [piece.observed.source] : [])], sourceVersion: source.id };
}
