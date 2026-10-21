import type { EquipmentBuildInput } from "../../game-data/src/equipment-build";
import type { ArtifactPieceInput, ArtifactRarity, ArtifactStatKey, ArtifactSubstatKey } from "../../game-data/src/artifact-build";
import type { Field, ImportSnapshot, PlayerBuild, Stat } from "./model";

export type DamageElement = "physical" | "pyro" | "hydro" | "cryo" | "electro" | "anemo" | "geo" | "dendro";
const elements: DamageElement[] = ["physical", "pyro", "hydro", "cryo", "electro", "anemo", "geo", "dendro"];
export interface NullableCorePanel {
  avatarId: number | null;
  level: number | null;
  ascension: number | null;
  constellation: number | null;
  stats: {
    maxHp: number | null; attack: number | null; defense: number | null; elementalMastery: number | null;
    critRate: number | null; critDamage: number | null; energyRecharge: number | null;
    damageBonuses: Record<DamageElement, number | null>;
  };
}
export interface CoreImportHandoff {
  contract: "gidps-269c47a-import-v1";
  source: ImportSnapshot["source"];
  graduation: { sourceLevel: number | null };
  panel: { status: "ready" | "blocked"; data: NullableCorePanel; reasons: string[]; equipmentAccounting: "already-in-panel" | "unverified" };
  equipment: {
    status: "ready" | "blocked";
    baseTalentLevels: { auto: number | null; skill: number | null; burst: number | null };
    constellation: number | null;
    equipmentInput: EquipmentBuildInput | null;
    reasons: string[];
  };
}
const value = (f: Field<number>): number | null => f.state === "known" && typeof f.value === "number" && Number.isFinite(f.value) ? f.value : null;
function observed(stats: Stat[], key: string): number | null {
  const matches = stats.filter(s => s.key.state === "known" && s.key.value === key);
  return matches.length === 1 ? value(matches[0]!.amount) : null;
}
const idNumber = (b: PlayerBuild): number | null => {
  const match = b.identity.state === "known" ? b.identity.value?.id.match(/^character:([1-9]\d*)$/u) : null;
  const id = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(id) ? id : null;
};
const subKeys = new Set<string>(["hp", "hp_", "atk", "atk_", "def", "def_", "eleMas", "enerRech_", "critRate_", "critDMG_"]);
const mainKeys = new Set<string>([...subKeys, "heal_", ...elements.map(e => `${e}_dmg_`)]);

/** Additive boundary for the parent-reported 269c47a nullable-panel contract.
 * No formula calls, legacy parser calls, shared-file changes, fallback values or persistence.
 * Panel and equipment-derived paths are separate alternatives; never add them together.
 */
export function createCoreHandoff(build: PlayerBuild, source: ImportSnapshot["source"], element: DamageElement): CoreImportHandoff {
  const level = value(build.level), constellation = value(build.constellation);
  const baseTalentLevels = Object.fromEntries((["auto", "skill", "burst"] as const).map(name => {
    const base = value(build.talents[name].base);
    return [name, base !== null && Number.isInteger(base) && base >= 1 && base <= 10 ? base : null];
  })) as CoreImportHandoff["equipment"]["baseTalentLevels"];
  const data: NullableCorePanel = {
    avatarId: idNumber(build), level, ascension: value(build.ascension), constellation,
    stats: {
      maxHp: observed(build.panel.stats, "hp"), attack: observed(build.panel.stats, "atk"), defense: observed(build.panel.stats, "def"),
      elementalMastery: observed(build.panel.stats, "eleMas"), critRate: observed(build.panel.stats, "critRate_"), critDamage: observed(build.panel.stats, "critDMG_"), energyRecharge: observed(build.panel.stats, "enerRech_"),
      damageBonuses: Object.fromEntries(elements.map(e => [e, observed(build.panel.stats, `${e}_dmg_`)])) as Record<DamageElement, number | null>
    }
  };
  const panelReasons: string[] = [];
  if (build.panel.state !== "observed") panelReasons.push("来源未提供可观测面板。");
  if (source.kind === "hutao-text" || build.panel.accounting === "unverified-text-observation") panelReasons.push("文本面板记账语义未核验，不能自动当作最终面板。");
  if (data.avatarId === null) panelReasons.push("角色身份未知。");
  if (level === null) panelReasons.push("角色等级未知。");
  if (constellation === null) panelReasons.push("命座未知。");
  for (const [key, amount] of Object.entries(data.stats)) if (key !== "damageBonuses" && amount === null) panelReasons.push(`必需面板属性 ${key} 未知。`);
  if (!elements.includes(element) || data.stats.damageBonuses[element] === null) panelReasons.push("所选命中元素加成未知；不会默认零。");

  const equipmentReasons: string[] = [];
  if (build.completeness.state !== "complete") equipmentReasons.push("配装源字段尚不完整。");
  if (Object.values(baseTalentLevels).some(base => base === null)) equipmentReasons.push("基础天赋缺失或无效；不能把显示/有效等级传作基础等级。");
  if (constellation === null) equipmentReasons.push("独立命座未知。");
  const weaponLevel = value(build.weapon.level), ascension = value(build.ascension), weaponAscension = value(build.weapon.ascension), refinement = value(build.weapon.refinement);
  if (level === null || ascension === null || weaponLevel === null || weaponAscension === null || refinement === null) equipmentReasons.push("角色或武器进度未知。");
  if (build.identity.state !== "known" || build.weapon.identity.state !== "known") equipmentReasons.push("角色或武器身份未知。");
  const artifacts: ArtifactPieceInput[] = [];
  for (const a of build.artifacts) {
    const rarity = value(a.rarity), artifactLevel = value(a.level), main = a.main.key.value;
    if (a.identity.state !== "known" || !a.identity.value || rarity === null || artifactLevel === null || a.main.key.state !== "known" || !main || !mainKeys.has(main) || a.substatsState.state !== "known") { equipmentReasons.push("圣遗物身份、强化或词条不完整。"); continue; }
    const subs: { stat: ArtifactSubstatKey; value: number }[] = [];
    for (const sub of a.substats) {
      const amount = value(sub.amount), key = sub.key.value;
      if (sub.key.state !== "known" || !key || !subKeys.has(key) || amount === null) equipmentReasons.push("圣遗物副词条未知。");
      else subs.push({ stat: key as ArtifactSubstatKey, value: amount });
    }
    const mainValue = value(a.main.amount);
    if (mainValue === null && a.main.amount.state !== "not-exported") equipmentReasons.push("圣遗物主词条数值无效或缺失。");
    artifacts.push({ slot: a.slot, setId: a.identity.value.id, rarity: rarity as ArtifactRarity, level: artifactLevel, mainStat: main as ArtifactStatKey,
      // Required legacy aggregate-input shape. No roll history is inferred; observed owns values.
      initialSubstats: 0, substats: [], observed: { source: `${source.kind};${source.importedAt};${a.identity.path}`, ...(mainValue === null ? {} : { mainStatValue: mainValue }), substats: subs }
    });
  }
  const equipmentInput: EquipmentBuildInput | null = equipmentReasons.length || !build.identity.value || !build.weapon.identity.value || level === null || ascension === null || weaponLevel === null || weaponAscension === null || refinement === null ? null : {
    characterId: build.identity.value.id, weaponId: build.weapon.identity.value.id, level, ascension, weaponLevel, weaponAscension, refinement,
    effectsDisabled: true, weaponEffectsEnabled: false, setEffectsEnabled: false, artifacts
  };
  return {
    contract: "gidps-269c47a-import-v1", source: structuredClone(source), graduation: { sourceLevel: level },
    panel: { status: panelReasons.length ? "blocked" : "ready", data, reasons: panelReasons, equipmentAccounting: panelReasons.length ? "unverified" : "already-in-panel" },
    equipment: { status: equipmentInput === null ? "blocked" : "ready", baseTalentLevels, constellation, equipmentInput, reasons: equipmentReasons }
  };
}
