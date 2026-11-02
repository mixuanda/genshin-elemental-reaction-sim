import {
  calcReactionResistanceMultiplier, calcTransformativeEmBonus,
  resolveReactionLevelBase, resolveTransformativeBaseMultiplier,
} from "@genshin-dps-lab/reaction-formulas";
import { findCanonicalTalentSet, gameDataCatalog } from "./catalog";
import { resolveEquipmentBuild, type EquipmentBuildInput } from "./equipment-build";
import type { ArtifactStatTotals } from "./artifact-budget-balance";

/** Explicit conditions for one effect. None of these inputs proves a legal rotation. */
export type RepresentativeArtifactBudgetScenario =
  | { kind: "neuvillette-equitable-judgment-hit"; normalTalentLevel: number;
      currentHpRatio: number; pastDraconicGloriesStacks: 0 | 1 | 2 | 3 }
  | { kind: "noelle-burst-active-normal-hit"; normalTalentLevel: number;
      baseBurstTalentLevel: number; constellation: number; burstActive: true;
      defenseAtCast: "same-as-current-non-extra"; attackIncludesBurstConversion: false }
  | { kind: "kuki-owned-hyperbloom-hit"; triggerOwner: "kukishinobu";
      targetDendroResistance: number; reactionBonus: number };

export interface RepresentativeArtifactBudgetObjective {
  objective: "hp-charged-hit-pre-mitigation-damage" | "def-converted-normal-hit-pre-mitigation-damage" | "owned-hyperbloom-single-hit-damage";
  scope: "single-effect-not-rotation-dps";
  scenario: RepresentativeArtifactBudgetScenario;
  description: string;
  sourceRefs: string[];
  score: (stats: ArtifactStatTotals) => number;
}

const GCSIM = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/";

/** Source-table coefficients and actual single-hit formulas; never an ATK stand-in for HP/DEF/EM. */
export function createRepresentativeArtifactBudgetObjective(
  build: EquipmentBuildInput, scenario: RepresentativeArtifactBudgetScenario,
): RepresentativeArtifactBudgetObjective {
  if (!build.effectsDisabled || build.weaponEffectsEnabled || build.setEffectsEnabled)
    throw new Error("限定预算样例要求装备与套装被动关闭，不能忽略已启用的效果。");
  const character = gameDataCatalog.characters.find(row => row.id === build.characterId);
  const expectedSlug = scenario.kind === "neuvillette-equitable-judgment-hit" ? "neuvillette"
    : scenario.kind === "noelle-burst-active-normal-hit" ? "noelle" : "kukishinobu";
  if (character?.slug !== expectedSlug) throw new Error("预算目标与角色身份不匹配。");
  const talents = findCanonicalTalentSet(character)!;
  const coefficient = (abilityKey: string, parameterKey: string, level: number) => {
    if (!Number.isInteger(level) || level < 1 || level > 15) throw new Error("有效天赋等级须为 1–15 的整数。");
    const value = talents.abilities.find(row => row.key === abilityKey)?.parameters[parameterKey]?.[level - 1];
    if (value === undefined || !Number.isFinite(value)) throw new Error("本地固定目录缺少该天赋系数。");
    return value;
  };
  // With effects disabled these are ordinary stats; no Q conversion is already included.
  const resolved = resolveEquipmentBuild({ ...build, artifacts: [] });
  const base = resolved.build;
  const crit = (stats: ArtifactStatTotals) => 1
    + Math.max(0, Math.min(1, base.critRate + (stats.critRate_ ?? 0)))
    * Math.max(0, base.critDamage + (stats.critDMG_ ?? 0));
  const common = { scope: "single-effect-not-rotation-dps" as const, scenario: structuredClone(scenario) };

  if (scenario.kind === "neuvillette-equitable-judgment-hit") {
    if (!Number.isFinite(scenario.currentHpRatio) || scenario.currentHpRatio < 0 || scenario.currentHpRatio > 1
      || ![0, 1, 2, 3].includes(scenario.pastDraconicGloriesStacks)) throw new Error("生命比例或遗龙之荣层数不合法。");
    const scaling = coefficient("combat1", "param5", scenario.normalTalentLevel);
    const a1 = [1, 1.1, 1.25, 1.6][scenario.pastDraconicGloriesStacks]!;
    const a4 = build.ascension >= 4 ? Math.min(0.3, Math.max(0, (scenario.currentHpRatio - 0.3) * 0.6)) : 0;
    if (build.ascension < 1 && scenario.pastDraconicGloriesStacks !== 0) throw new Error("未解锁突破天赋时不能获得遗龙之荣。");
    return { ...common, objective: "hp-charged-hit-pre-mitigation-damage",
      description: "固定当前生命比例与遗龙之荣层数的一次衡平推裁命中期望，含天赋倍率与水伤；未乘敌人防御/抗性，不是整段重击或循环 DPS。",
      sourceRefs: [`${GCSIM}internal/characters/neuvillette/charge.go`, "https://keqingmains.com/q/neuvillette-quickguide/", `catalog:${talents.id}:combat1:param5`],
      score: stats => scaling * (base.baseHp * (1 + base.hpPercent + (stats.hp_ ?? 0)) + base.flatHp + (stats.hp ?? 0))
        * crit(stats) * (1 + (resolved.damageBonuses.hydro ?? 0) + (stats.hydro_dmg_ ?? 0) + a4) * a1,
    };
  }
  if (scenario.kind === "noelle-burst-active-normal-hit") {
    if (scenario.burstActive !== true || scenario.defenseAtCast !== "same-as-current-non-extra" || scenario.attackIncludesBurstConversion !== false)
      throw new Error("诺艾尔目标须明确 Q 已激活、起手非 Extra DEF 与当前相同，且攻击未含 Q 转换。");
    if (!Number.isInteger(scenario.constellation) || scenario.constellation < 0 || scenario.constellation > 6
      || !Number.isInteger(scenario.baseBurstTalentLevel) || scenario.baseBurstTalentLevel < 1 || scenario.baseBurstTalentLevel > 10)
      throw new Error("诺艾尔基础 Q 等级或命座不合法。");
    // The preset stores base talent levels. C5 adds three effective Q levels; C6 adds 50% DEF.
    const effectiveBurstLevel = scenario.baseBurstTalentLevel + (scenario.constellation >= 5 ? 3 : 0);
    const conversion = coefficient("combat3", "param3", effectiveBurstLevel) + (scenario.constellation >= 6 ? 0.5 : 0);
    const scaling = coefficient("combat1", "param1", scenario.normalTalentLevel);
    return { ...common, objective: "def-converted-normal-hit-pre-mitigation-damage",
      description: "Q 已生效且起手非 Extra DEF 等于当前 DEF 时，一次 N1 岩伤期望；DEF 转换作为固定攻击只加一次，含 C5/C6，不证明 Q 能量或持续时间。未乘敌人防御/抗性，不是循环 DPS。",
      sourceRefs: [`${GCSIM}internal/characters/noelle/burst.go`, "https://keqingmains.com/q/noelle-quickguide/", `catalog:${talents.id}:combat3:param3`],
      score: stats => {
        const attack = (base.characterBaseAtk + base.weaponBaseAtk) * (1 + base.atkPercent + (stats.atk_ ?? 0)) + base.flatAtk + (stats.atk ?? 0);
        const defense = base.baseDef * (1 + base.defPercent + (stats.def_ ?? 0)) + base.flatDef + (stats.def ?? 0);
        return scaling * (attack + conversion * defense) * crit(stats)
          * (1 + (resolved.damageBonuses.geo ?? 0) + (stats.geo_dmg_ ?? 0));
      },
    };
  }
  if (scenario.triggerOwner !== "kukishinobu" || !Number.isFinite(scenario.targetDendroResistance)
    || !Number.isFinite(scenario.reactionBonus) || scenario.reactionBonus < 0)
    throw new Error("超绽放须明确久岐忍归属、有限草抗与非负反应加成。");
  const fixed = resolveReactionLevelBase(build.level) * resolveTransformativeBaseMultiplier("hyperbloom")
    * calcReactionResistanceMultiplier(scenario.targetDendroResistance);
  return { ...common, objective: "owned-hyperbloom-single-hit-damage",
    description: "明确由久岐忍触发的一次普通超绽放伤害，固定等级、草抗和反应加成；不计特殊反应暴击，不推断草原核数量、命中、归属或循环 DPS。",
    sourceRefs: ["https://keqingmains.com/q/shinobu-quickguide/", "https://library.keqingmains.com/combat-mechanics/elemental-effects/transformative-reactions"],
    score: stats => fixed * (1 + calcTransformativeEmBonus(base.em + (stats.eleMas ?? 0)) + scenario.reactionBonus),
  };
}
