import type { CharacterCatalogEntry } from "@genshin-dps-lab/schemas";
import { gameDataCatalog } from "./catalog";
import { artifactSetCatalog } from "./supplemental";
import { resolveEquipmentBuild, type EquipmentBuildInput } from "./equipment-build";
import type { ArtifactPieceInput, ArtifactSlot, ArtifactStatKey, ArtifactSubstatKey } from "./artifact-build";
import { balanceFiveStarArtifactRolls, type ArtifactBudgetBalance, type ArtifactStatTotals } from "./artifact-budget-balance";
import { createRepresentativeArtifactBudgetObjective, type RepresentativeArtifactBudgetObjective, type RepresentativeArtifactBudgetScenario } from "./representative-artifact-budget";

/** Editable reference examples, not measured drops or claims of an optimal build. */
export type CharacterBuildPresetTier = "starter" | "developed";
export type CharacterBuildPresetCoverage = "role-specific" | "partial" | "generic";
export type TalentPriority = "primary" | "secondary" | "low";
export interface PresetWeaponCandidate { weaponId: string; refinement: number; note: string; }
export interface CharacterBuildPreset {
  id: string; characterId: string; characterSlug: string; characterName: string;
  tier: CharacterBuildPresetTier; label: string; status: "reference-assumption";
  coverage: CharacterBuildPresetCoverage; roleLabel?: string;
  sourceNote: string; assumptions: string[]; blocked: string[]; mainStatRationale: string;
  constellation: number; talentLevels: { normal: number; skill: number; burst: number };
  talentPriority: { normal: TalentPriority; skill: TalentPriority; burst: TalentPriority } | null;
  weaponCandidates: PresetWeaponCandidate[];
  /** Bounded, explicitly conditioned objectives; no team cycle or full DPS is inferred. */
  artifactBalance?: Omit<ArtifactBudgetBalance, "pieces"> & {
    objective: "unbuffed-direct-atk-expected-factor" | RepresentativeArtifactBudgetObjective["objective"];
    scope?: "single-effect-not-rotation-dps";
    scenario?: RepresentativeArtifactBudgetScenario;
    description?: string;
    sourceRefs?: string[];
    energyRequirement: "unknown-without-team-and-rotation";
    starterComparisonScore?: number;
    retainedStarterAllocation?: boolean;
  };
  build: EquipmentBuildInput;
}

const ELEMENT_DAMAGE: Record<CharacterCatalogEntry["element"], ArtifactStatKey> = {
  pyro: "pyro_dmg_", cryo: "cryo_dmg_", hydro: "hydro_dmg_", electro: "electro_dmg_",
  anemo: "anemo_dmg_", geo: "geo_dmg_", dendro: "dendro_dmg_", unknown: "atk_"
};
const SET_IDS = {
  gladiator: "artifact-set:15001", troupe: "artifact-set:15003", noblesse: "artifact-set:15007",
  emblem: "artifact-set:15020", tenacity: "artifact-set:15017", clam: "artifact-set:15022",
  husk: "artifact-set:15021", deepwood: "artifact-set:15025", gilded: "artifact-set:15026",
  paradise: "artifact-set:15028", goldenTroupe: "artifact-set:15032", viridescent: "artifact-set:15002",
  desertPavilion: "artifact-set:15027", marechaussee: "artifact-set:15031", offPiece: "artifact-set:15001"
} as const;
const CRAFT_WEAPON_IDS: Record<CharacterCatalogEntry["weaponType"], string> = {
  sword: "weapon:11406", claymore: "weapon:12406", polearm: "weapon:13402", catalyst: "weapon:14406", bow: "weapon:15406"
};
const FAVONIUS_WEAPON_IDS: Record<CharacterCatalogEntry["weaponType"], string> = {
  sword: "weapon:11401", claymore: "weapon:12401", polearm: "weapon:13407", catalyst: "weapon:14401", bow: "weapon:15401"
};

type PresetTalentLevels = { normal: number; skill: number; burst: number };
type PresetRoleRule = {
  coverage?: CharacterBuildPresetCoverage;
  roleLabel?: string;
  stats?: [ArtifactStatKey, ArtifactStatKey, ArtifactStatKey];
  set: string;
  substats: ArtifactSubstatKey[];
  weapons?: Partial<Record<CharacterBuildPresetTier, { weaponId: string; refinement: number }>>;
  weaponCandidates?: PresetWeaponCandidate[];
  offPieceSlot?: ArtifactSlot;
  talents?: Partial<Record<CharacterBuildPresetTier, PresetTalentLevels>>;
  talentPriority?: { normal: TalentPriority; skill: TalentPriority; burst: TalentPriority };
  mainStatRationale?: string;
  sourceNote?: string;
  assumptions?: string[];
  constellation?: number;
  budgetScenario?: RepresentativeArtifactBudgetScenario;
};

// These are explicit editable examples. Missing roles use a clearly-labelled generic input, never inferred build advice.
const roleRules: Record<string, PresetRoleRule> = {
  wanderer: {
    coverage: "role-specific", roleLabel: "C0–C1 站场输出",
    stats: ["atk_", "anemo_dmg_", "critRate_"], set: SET_IDS.desertPavilion,
    substats: ["critRate_", "critDMG_", "atk_", "atk"], offPieceSlot: "circlet",
    weapons: { starter: { weaponId: "weapon:14402", refinement: 1 }, developed: { weaponId: "weapon:14402", refinement: 1 } },
    weaponCandidates: [
      { weaponId: "weapon:14402", refinement: 1, note: "4 星可用选项；KQM 称为 solid option。" },
      { weaponId: "weapon:14425", refinement: 1, note: "4 星锻造武器；KQM 称为 best free option。" },
      { weaponId: "weapon:14501", refinement: 1, note: "5 星可用属性武器；KQM 称为 solid stat stick，按 R1。" },
    ],
    talentPriority: { normal: "primary", skill: "secondary", burst: "low" },
    talents: { starter: { normal: 10, skill: 9, burst: 1 }, developed: { normal: 10, skill: 9, burst: 1 } },
    mainStatRationale: "站场输出：攻击沙、风伤杯、暴击冠；这是固定 90 级 C0 对照样例，不声称最优。",
    sourceNote: "角色定位、天赋顺序、圣遗物和候选武器依据 KQM Wanderer Quick Guide（https://keqingmains.com/q/wanderer-quickguide/，页面标注更新至 4.6）与 KQM TCL（https://library.keqingmains.com/characters/anemo/wanderer）。指南给出 C0–C1 普攻 ≥ 战技 > 爆发；普通攻击是主要伤害，战技倍率较低但仍有价值，C2 后爆发优先级改变。",
    assumptions: [
      "两档固定为 C0、Lv.90、流浪乐章 Lv.90 R1、普攻 10 / 战技 9 / 爆发 1，只比较圣遗物投入。这里的“低”表示少投入，不代表爆发没有伤害。C0–C1 爆发不要求每轮施放；C2+ 需另作配置。",
      "天空之卷 R1 与纯水流华 R1 保留为指南支持的可编辑候选，不随档位切换。武器与套装被动保持关闭，队伍增益和反应伤害未计入此参考目标。",
      "本参考目标不要求每轮开 Q；具体队伍、粒子和轮转未指定，因此循环充能需求为未知，不能据此宣称循环能量充足。充能词条只是输入，不是通用目标。",
    ],
  },
  sangonomiyakokomi: { stats: ["hp_", "hydro_dmg_", "heal_"], set: SET_IDS.clam, substats: ["hp_", "enerRech_", "eleMas", "atk_"] },
  neuvillette: {
    coverage: "partial", roleLabel: "C0 衡平推裁单次命中条件样例",
    stats: ["hp_", "hydro_dmg_", "critRate_"], set: SET_IDS.marechaussee,
    substats: ["critRate_", "critDMG_", "hp_", "enerRech_", "hp"],
    weapons: { starter: { weaponId: "weapon:14406", refinement: 1 }, developed: { weaponId: "weapon:14406", refinement: 1 } },
    weaponCandidates: [{ weaponId: "weapon:14406", refinement: 1, note: "KQM 支持的锻造 HP 武器；本样例关闭回能与治疗被动。" }],
    talents: { starter: { normal: 10, skill: 6, burst: 6 }, developed: { normal: 10, skill: 6, burst: 6 } },
    mainStatRationale: "仅衡平推裁的 HP / 水伤 / 暴击条件样例；未完成队伍与主词条组合搜索。",
    sourceNote: "HP 倍率取固定活动目录 talent-set:neuvillette combat1 param5；定位与试作金珀依据 KQM Neuvillette Quick Guide（https://keqingmains.com/q/neuvillette-quickguide/）。来源机制保留为条件样例，不晋升完整毕业配装。",
    assumptions: ["两档固定 C0、Lv.90、试作金珀 Lv.90 R1、天赋 10/6/6。只比较一次衡平推裁命中，当前生命比例固定 100%、遗龙之荣 0 层；A4 水伤为 30%，不模拟重击耗血、源水之滴或队伍增益。猎人套装暴击与金珀回能均未启用。"],
    budgetScenario: { kind: "neuvillette-equitable-judgment-hit", normalTalentLevel: 10, currentHpRatio: 1, pastDraconicGloriesStacks: 0 },
  },
  noelle: {
    coverage: "partial", roleLabel: "C6 Q 生效后的 N1 条件样例", constellation: 6,
    stats: ["def_", "geo_dmg_", "critRate_"], set: SET_IDS.husk,
    substats: ["critRate_", "critDMG_", "def_", "enerRech_", "atk_"],
    weapons: { starter: { weaponId: "weapon:12407", refinement: 1 }, developed: { weaponId: "weapon:12407", refinement: 1 } },
    weaponCandidates: [{ weaponId: "weapon:12407", refinement: 1, note: "KQM 支持的锻造 DEF 武器；本样例关闭叠层被动。" }],
    talents: { starter: { normal: 9, skill: 6, burst: 10 }, developed: { normal: 9, skill: 6, burst: 10 } },
    mainStatRationale: "仅固定 C6 Q 状态的 DEF / 岩伤 / 暴击条件样例；不是 C0 输出建议或完整循环构筑。",
    sourceNote: "DEF 转固定 ATK 取项目已固定 gcsim b4ae769 的 noelle/burst.go 与活动目录 combat3 param3。白影剑、C5/C6 条件见 KQM Noelle Quick Guide（https://keqingmains.com/q/noelle-quickguide/）。",
    assumptions: ["两档固定 C6、Lv.90、白影剑 Lv.90 R1、基础天赋 9/6/10。C5 使有效 Q 等级为 13，转换系数为 0.85 + C6 0.50 = 1.35。Q 已激活、起手非 Extra DEF 等于当前 DEF；转换以固定 ATK 加一次，不再乘 ATK%。只计算一次 N1，不认定 Q 能量已足够。"],
    budgetScenario: { kind: "noelle-burst-active-normal-hit", normalTalentLevel: 9, baseBurstTalentLevel: 10, constellation: 6,
      burstActive: true, defenseAtCast: "same-as-current-non-extra", attackIncludesBurstConversion: false },
  },
  kukishinobu: {
    coverage: "partial", roleLabel: "C0 单次自有超绽放条件样例",
    stats: ["eleMas", "eleMas", "eleMas"], set: SET_IDS.paradise, substats: ["eleMas", "hp_", "enerRech_", "def_"],
    weapons: { starter: { weaponId: "weapon:11407", refinement: 1 }, developed: { weaponId: "weapon:11407", refinement: 1 } },
    weaponCandidates: [{ weaponId: "weapon:11407", refinement: 1, note: "KQM 支持的锻造精通武器；增伤被动不计入超绽放。" }],
    talents: { starter: { normal: 1, skill: 9, burst: 1 }, developed: { normal: 1, skill: 9, burst: 1 } },
    mainStatRationale: "只对久岐忍自有的一次普通超绽放配平精通；不推断核心供应、治疗或实际触发次数。",
    sourceNote: "三精通与铁蜂刺依据 KQM Kuki Shinobu Quick Guide（https://keqingmains.com/q/shinobu-quickguide/）；普通超绽放公式使用项目固定 classic reaction formula profile。",
    assumptions: ["两档固定 C0、Lv.90、铁蜂刺 Lv.90 R1、天赋 1/9/1。目标是一枚明确归属久岐忍且实际命中的普通超绽放，敌人草抗 10%、额外反应加成 0；无纳西妲 C2 特殊暴击。乐园套装被动关闭，不据此生成草原核或循环 DPS。三个精通主词条禁止同件精通副词条，精通强化只来自花羽。"],
    budgetScenario: { kind: "kuki-owned-hyperbloom-hit", triggerOwner: "kukishinobu", targetDendroResistance: 0.1, reactionBonus: 0 },
  },
  nilou: { stats: ["hp_", "hp_", "hp_"], set: SET_IDS.tenacity, substats: ["hp_", "enerRech_", "eleMas", "def_"] },
  kaedeharakazuha: { stats: ["eleMas", "eleMas", "eleMas"], set: SET_IDS.viridescent, substats: ["eleMas", "enerRech_", "atk_", "hp_"] },
  sucrose: { stats: ["eleMas", "eleMas", "eleMas"], set: SET_IDS.viridescent, substats: ["eleMas", "enerRech_", "atk_", "hp_"] },
  bennett: { stats: ["enerRech_", "hp_", "heal_"], set: SET_IDS.noblesse, substats: ["enerRech_", "hp_", "critRate_", "atk_"] },
  xingqiu: { stats: ["enerRech_", "hydro_dmg_", "critRate_"], set: SET_IDS.emblem, substats: ["critRate_", "critDMG_", "enerRech_", "atk_"] },
  diona: { stats: ["hp_", "hp_", "hp_"], set: SET_IDS.noblesse, substats: ["hp_", "enerRech_", "critRate_", "def_"] },
  baizhu: { stats: ["hp_", "hp_", "heal_"], set: SET_IDS.deepwood, substats: ["hp_", "enerRech_", "def_", "eleMas"] },
  yaoyao: { stats: ["hp_", "hp_", "heal_"], set: SET_IDS.deepwood, substats: ["hp_", "enerRech_", "eleMas", "def_"] },
  collei: { stats: ["enerRech_", "dendro_dmg_", "critRate_"], set: SET_IDS.deepwood, substats: ["critRate_", "critDMG_", "enerRech_", "atk_"] },
  fischl: { stats: ["atk_", "electro_dmg_", "critRate_"], set: SET_IDS.goldenTroupe, substats: ["critRate_", "critDMG_", "atk_", "enerRech_"] },
  gorou: { stats: ["enerRech_", "geo_dmg_", "critRate_"], set: SET_IDS.noblesse, substats: ["enerRech_", "critRate_", "critDMG_", "def_"] },
  faruzan: { stats: ["enerRech_", "anemo_dmg_", "critRate_"], set: SET_IDS.noblesse, substats: ["enerRech_", "critRate_", "critDMG_", "atk_"] },
  barbara: { stats: ["hp_", "hp_", "heal_"], set: SET_IDS.clam, substats: ["hp_", "enerRech_", "atk_", "eleMas"] },
  charlotte: { stats: ["enerRech_", "atk_", "heal_"], set: SET_IDS.noblesse, substats: ["enerRech_", "atk_", "critRate_", "hp_"] },
  dahlia: { stats: ["hp_", "hp_", "hp_"], set: SET_IDS.noblesse, substats: ["hp_", "enerRech_", "def_", "critRate_"] }
};
const erSupportSlugs = new Set(["bennett", "xingqiu", "diona", "baizhu", "yaoyao", "collei", "gorou", "faruzan", "charlotte", "dahlia"]);

function buildDefinition(character: CharacterCatalogEntry, tier: CharacterBuildPresetTier) {
  const rule = roleRules[character.slug];
  const evidence = { basis: rule?.mainStatRationale ?? "未维护角色专属配装规则；使用攻击沙、对应元素杯与暴击冠作为通用可编辑占位，不依据命中倍率推断角色定位。" };
  const stats = rule?.stats ?? ["atk_", ELEMENT_DAMAGE[character.element], "critRate_"] as [ArtifactStatKey, ArtifactStatKey, ArtifactStatKey];
  const setId = rule?.set ?? SET_IDS.gladiator;
  const weaponSelection = rule?.weapons?.[tier];
  const weaponId = weaponSelection?.weaponId ?? (erSupportSlugs.has(character.slug) ? FAVONIUS_WEAPON_IDS[character.weaponType] : CRAFT_WEAPON_IDS[character.weaponType]);
  const weapon = gameDataCatalog.weapons.find(entry => entry.id === weaponId);
  const set = artifactSetCatalog.find(entry => entry.id === setId && entry.rarityList.includes(5) && entry.slots.length === 5);
  const coverage = rule?.coverage ?? (rule ? "partial" : "generic");
  const weaponCandidates = (rule?.weaponCandidates ?? []).filter(candidate => {
    const catalogWeapon = gameDataCatalog.weapons.find(entry => entry.id === candidate.weaponId);
    return catalogWeapon?.refinements.some(refinement => refinement.rank === candidate.refinement) === true;
  });
  return { rule, evidence, stats, weapon, set, coverage, weaponSelection, weaponCandidates };
}
function makePieces(setId: string, stats: [ArtifactStatKey, ArtifactStatKey, ArtifactStatKey], substatPreference: ArtifactSubstatKey[], tier: CharacterBuildPresetTier, offPieceSlot?: ArtifactSlot): ArtifactPieceInput[] {
  const level = 20;
  const initialSubstats = tier === "starter" ? 3 : 4;
  const total = initialSubstats + Math.floor(level / 4);
  return (["flower", "plume", "sands", "goblet", "circlet"] as const).map((slot, index) => {
    const desired = index < 2 ? (index === 0 ? "hp" : "atk") : stats[index - 2]!;
    const mainStat = desired as ArtifactStatKey;
    const preference: ArtifactSubstatKey[] = [...substatPreference, "critRate_", "critDMG_", "atk_", "enerRech_", "hp_", "def_", "eleMas"];
    const choices = preference.filter((value, i, values) => value !== mainStat && values.indexOf(value) === i).slice(0, 4);
    const each = Math.floor(total / choices.length); const remainder = total % choices.length;
    return { slot, setId: slot === offPieceSlot ? SET_IDS.offPiece : setId, rarity: 5, level, mainStat,
      initialSubstats, substats: choices.map((stat, i) => ({ stat, rolls: Array.from({ length: each + (i < remainder ? 1 : 0) }, (_, n) => (index + i + n) % 4) })) };
  });
}
function wandererSmallGraduatePieces(): ArtifactPieceInput[] {
  const roll = (stat: ArtifactSubstatKey, count: number, tier: number) => ({ stat, rolls: Array.from({ length: count }, () => tier) });
  const desert = SET_IDS.desertPavilion;
  const offPiece = SET_IDS.offPiece;
  return [
    { slot: "flower", setId: desert, rarity: 5, level: 20, mainStat: "hp", initialSubstats: 3, substats: [roll("critRate_", 3, 1), roll("critDMG_", 2, 2), roll("atk_", 2, 2), roll("enerRech_", 1, 1)] },
    { slot: "plume", setId: desert, rarity: 5, level: 20, mainStat: "atk", initialSubstats: 3, substats: [roll("critRate_", 2, 1), roll("critDMG_", 2, 2), roll("atk_", 2, 2), roll("hp", 2, 0)] },
    { slot: "sands", setId: desert, rarity: 5, level: 20, mainStat: "atk_", initialSubstats: 3, substats: [roll("critRate_", 2, 1), roll("critDMG_", 2, 2), roll("hp", 1, 0), roll("def_", 3, 0)] },
    { slot: "goblet", setId: desert, rarity: 5, level: 20, mainStat: "anemo_dmg_", initialSubstats: 3, substats: [roll("critRate_", 1, 1), roll("critDMG_", 1, 2), roll("atk_", 1, 2), roll("hp", 5, 0)] },
    { slot: "circlet", setId: offPiece, rarity: 5, level: 20, mainStat: "critRate_", initialSubstats: 3, substats: [roll("critDMG_", 1, 2), roll("atk_", 1, 2), roll("hp", 3, 0), roll("def_", 3, 0)] },
  ];
}
function createPreset(character: CharacterCatalogEntry, tier: CharacterBuildPresetTier, starter?: CharacterBuildPreset): CharacterBuildPreset {
  const { rule, evidence, stats, weapon, set, coverage, weaponSelection, weaponCandidates } = buildDefinition(character, tier);
  const blocked = [!weapon ? `本地目录未包含示例武器 ${rule?.weapons?.[tier]?.weaponId ?? CRAFT_WEAPON_IDS[character.weaponType]}。` : "", !set ? `本地目录未包含完整五星套装 ${rule?.set ?? "角色通用套装规则"}。` : ""].filter(Boolean);
  const weaponRefinements = weapon?.refinements.map(refinement => refinement.rank) ?? [];
  const refinement = weaponSelection?.refinement ?? 1;
  if (weapon && !weaponRefinements.includes(refinement)) blocked.push(`本地目录没有武器 ${weapon.id} 的 R${refinement} 数值。`);
  const defaultTalents: Record<CharacterBuildPresetTier, PresetTalentLevels> = {
    starter: { normal: 8, skill: 8, burst: 8 }, developed: { normal: 9, skill: 9, burst: 9 }
  };
  const talentLevels = rule?.talents?.[tier] ?? defaultTalents[tier];
  const constellation = rule?.constellation ?? 0;
  const assumptions = [
    "参考假设构筑，仅供一键填入后编辑；不是游戏实测、真实掉落或最优配装。",
    `固定对照条件：C${constellation}、角色 Lv.90、武器 Lv.90；这是可复现样例条件，不代表所有角色的统一等级上限。角色、武器、套装与数值字段取自当前本地目录。`,
    "装备被动和套装效果默认关闭，因此选中的套装身份用于可编辑示例，不将未启用套装被动计入伤害。",
    `覆盖状态：${coverage === "role-specific" ? `已维护角色模板（${rule?.roleLabel ?? "角色专属构筑"}）` : coverage === "partial" ? "仅有部分角色输入，未完成角色专属小／大毕业、武器与天赋证据" : "未维护角色专属构筑；当前值是通用占位"}。`,
    `主词条依据：${coverage === "role-specific" ? evidence.basis : `${evidence.basis} 这不是角色专属推荐。`}`,
    ...(rule?.assumptions ?? []),
  ];
  if (weapon) assumptions.push(`武器输入为目录 ID ${weapon.id}（${weapon.name}）R${refinement}；${coverage === "role-specific" || rule?.budgetScenario ? "该限定样例候选有角色指南支持。" : "这是按武器类型填入的通用占位，并非角色专属推荐。"}装备被动默认关闭。`);
  if (weaponCandidates.length) assumptions.push(`角色指南支持的武器候选：${weaponCandidates.map(candidate => `${gameDataCatalog.weapons.find(row => row.id === candidate.weaponId)!.name} R${candidate.refinement}（${candidate.note}）`).join("；")}`);
  if (coverage !== "role-specific") assumptions.push(rule?.budgetScenario
    ? "此角色只维护有来源的单次伤害条件样例，仍缺主词条搜索、完整队伍与轮转验证；当前结果不应称为角色专属毕业配装。"
    : "此角色尚无足够的角色来源、武器候选与天赋优先级证据，当前生成结果不应称为角色专属毕业配装。");
  if (character.slug === "wanderer") assumptions.push(`本档使用已有的 ${tier === "starter" ? "40" : "45"} 次初始／升级档位种子，由五件合法 +20 五星圣遗物逐项汇总。高档也保留完整基础档分配作为候选；三／四词条胚不是毕业判定条件。这是项目自定参考投入，不是官方毕业标准，也不等同于 KQM 的 40 次平均词条标准。`);
  const artifacts = !set ? [] : character.slug === "wanderer" && tier === "starter"
    ? wandererSmallGraduatePieces()
    : makePieces(set.id, stats, rule?.substats ?? ["critRate_", "critDMG_", "atk_", "enerRech_"], tier, rule?.offPieceSlot);
  const build: EquipmentBuildInput = { characterId: character.id, weaponId: weapon?.id ?? "", level: 90, ascension: 6, weaponLevel: 90, weaponAscension: 6, refinement,
    effectsDisabled: true, setEffectsEnabled: false, weaponEffectsEnabled: false, artifacts };
  let artifactBalance: CharacterBuildPreset["artifactBalance"];
  if (character.slug === "wanderer" && !blocked.length) {
    const base = resolveEquipmentBuild({ ...build, artifacts: [] }).build;
    const score = (totals: ArtifactStatTotals) => {
      // KQM TCL Damage Formula: same Talent%, DMG%, DEF and RES multipliers
      // make this factor proportional to direct ATK-scaling expected damage.
      // No EM reaction, team buff, HP/DEF conversion or cycle is inferred.
      const attack = (base.characterBaseAtk + base.weaponBaseAtk) * (1 + base.atkPercent + (totals.atk_ ?? 0)) + base.flatAtk + (totals.atk ?? 0);
      const critRate = Math.max(0, Math.min(1, base.critRate + (totals.critRate_ ?? 0)));
      const critDamage = Math.max(0, base.critDamage + (totals.critDMG_ ?? 0));
      return attack * (1 + critRate * critDamage);
    };
    let balanced = balanceFiveStarArtifactRolls(artifacts, score);
    const starterCandidate = starter?.build.artifacts ? balanceFiveStarArtifactRolls(starter.build.artifacts, score) : undefined;
    const retainedStarterAllocation = starterCandidate !== undefined && starterCandidate.finalScore > balanced.finalScore;
    if (retainedStarterAllocation) balanced = starterCandidate!;
    const { pieces, ...audit } = balanced;
    build.artifacts = pieces;
    artifactBalance = { ...audit, objective: "unbuffed-direct-atk-expected-factor", energyRequirement: "unknown-without-team-and-rotation",
      ...(starterCandidate ? { starterComparisonScore: starterCandidate.finalScore, retainedStarterAllocation } : {}) };
    assumptions.push("在同件主词条、四种副词条、总次数和离散档位质量不变的预算内，按无队伍增益的攻击倍率直伤期望因子 ATK × (1 + clamp(CR,0,1) × CD) 调整强化分配。只做有限的逐件局部改善，不声称全局最优；生命／防御／混合倍率和反应角色没有套用此目标。");
    assumptions.push("配平公式来源：KQM TCL Damage Formula（https://library.keqingmains.com/combat-mechanics/damage/damage-formula）。加入班尼特攻击增益、有效暴击增益或实际反应后应重新按相应队伍目标比较，不应直接照搬此无增益分配。");
  }
  if (rule?.budgetScenario && !blocked.length) {
    const { score, ...objective } = createRepresentativeArtifactBudgetObjective(build, rule.budgetScenario);
    let balanced = balanceFiveStarArtifactRolls(artifacts, score);
    const starterCandidate = starter?.build.artifacts ? balanceFiveStarArtifactRolls(starter.build.artifacts, score) : undefined;
    const retainedStarterAllocation = starterCandidate !== undefined && starterCandidate.finalScore > balanced.finalScore;
    if (retainedStarterAllocation) balanced = starterCandidate!;
    const { pieces, ...audit } = balanced;
    build.artifacts = pieces;
    artifactBalance = { ...audit, ...objective, energyRequirement: "unknown-without-team-and-rotation",
      ...(starterCandidate ? { starterComparisonScore: starterCandidate.finalScore, retainedStarterAllocation } : {}) };
    assumptions.push("仅在同件已有的四种副词条间转移真实离散档位；主词条、每件总次数和档位索引多重集固定。进阶候选保留完整基础分配以防目标退化；没有搜索主词条/套装/队伍或全局最优。" , objective.description);
    assumptions.push("充能需求仍为未知；这里没有输入实际粒子到达、回能、扣能与轮转。不得把单次伤害改善显示为循环能量通过或完整毕业覆盖。");
  }
  return {
    id: `${character.id}:${tier}`, characterId: character.id, characterSlug: character.slug, characterName: character.name,
    tier, label: coverage === "role-specific" ? (tier === "starter" ? "小毕业（参考假设）" : "大毕业（参考假设）") : (tier === "starter" ? "基础占位（非角色推荐）" : "进阶占位（非角色推荐）"), status: "reference-assumption",
    coverage, ...(rule?.roleLabel ? { roleLabel: rule.roleLabel } : {}),
    sourceNote: rule?.sourceNote ?? `本地 game-data catalog ${gameDataCatalog.catalogVersion} 仅提供角色、装备和数值身份；当前角色没有角色专属构筑来源，通用输入不应视作推荐。`,
    assumptions, blocked,
    mainStatRationale: `${coverage === "role-specific" ? `角色模板${rule?.roleLabel ? ` · ${rule.roleLabel}` : ""}` : coverage === "partial" ? "部分角色输入（未达角色专属毕业覆盖）" : "通用可编辑占位"}；沙漏/杯/冠：${stats.join(" / ")}。`,
    constellation, talentLevels, talentPriority: coverage === "role-specific" ? rule?.talentPriority ?? null : null, weaponCandidates,
    ...(artifactBalance ? { artifactBalance } : {}), build,
  };
}

/** Two editable reference builds for every identity in the active released-character catalog. */
export const characterBuildPresets: CharacterBuildPreset[] = gameDataCatalog.characters.flatMap(character => {
  const starter = createPreset(character, "starter");
  return [starter, createPreset(character, "developed", starter)];
});
export const characterBuildPresetCoverage = {
  roleSpecific: [...new Set(characterBuildPresets.filter(preset => preset.coverage === "role-specific").map(preset => preset.characterSlug))],
  partial: [...new Set(characterBuildPresets.filter(preset => preset.coverage === "partial").map(preset => preset.characterSlug))],
  generic: [...new Set(characterBuildPresets.filter(preset => preset.coverage === "generic").map(preset => preset.characterSlug))],
};
export function getCharacterBuildPresets(characterId: string): CharacterBuildPreset[] { return characterBuildPresets.filter(preset => preset.characterId === characterId); }
export function getCharacterBuildPreset(characterId: string, tier: CharacterBuildPresetTier): CharacterBuildPreset | null {
  return characterBuildPresets.find(preset => preset.characterId === characterId && preset.tier === tier) ?? null;
}
/** Fixed, catalog-backed four-star choices for each weapon type, suitable for an editable selector. */
export const fourStarWeaponExamplesByType = Object.fromEntries(Object.entries({ ...CRAFT_WEAPON_IDS, ...FAVONIUS_WEAPON_IDS }).map(([type, id]) => [type, gameDataCatalog.weapons.filter(weapon => weapon.weaponType === type && (weapon.id === id || weapon.id === CRAFT_WEAPON_IDS[type as keyof typeof CRAFT_WEAPON_IDS])).map(weapon => ({ id: weapon.id, name: weapon.name, slug: weapon.slug }))]));
