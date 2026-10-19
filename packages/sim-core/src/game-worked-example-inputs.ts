import type { CalculatorDocument } from "./calculator-model";

/**
 * Real, narrowly scoped character builds cross-checked against fixed source data.
 * These are not synthetic teaching panels and are not promoted verified game data.
 * Keep this module free of game-data imports: the fixtures are immutable evidence
 * for the recorded source snapshot, not automatically refreshed character rules.
 */
const gcsim = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const genshinDb = "https://github.com/theBowja/genshin-db/blob/1bab2cdba4d218fd5caa46b5f54e7884ee8359a2";
const characterSource = `${gcsim}/pkg/catalog/character.dm.go#L7459-L7481`;
const weaponSource = `${gcsim}/pkg/catalog/weapon.dm.go#L3725-L3748`;
const curveSource = `${gcsim}/pkg/catalog/curve.dm.go`;
const baseStatSource = `${gcsim}/pkg/core/player/character/basestat.go#L72-L84`;
const noWeaponEffectSource = `${gcsim}/internal/weapons/sword/dullblade/dullblade.go`;
const kaeyaSource = "https://library.keqingmains.com/characters/cryo/kaeya";
const damageFormulaSource = "https://library.keqingmains.com/combat-mechanics/damage/damage-formula";

export const GAME_WORKED_EXAMPLE_SOURCE_REFS = [
  `${genshinDb}/src/min/data.min.json`,
  characterSource,
  weaponSource,
  curveSource,
  baseStatSource,
  noWeaponEffectSource,
  kaeyaSource,
  damageFormulaSource,
];

const sharedAssumptions = [
  "真实角色配装：凯亚 C0、角色 1 级/突破 0、无锋剑 1 级/突破 0，无圣遗物、队友、共鸣、食物或其他外部增益。",
  "无锋剑没有副属性与武器被动；装备元数据 refinement=1 仅为当前合法等级表示，不表示存在可升级的精炼效果。",
  "突破 0 时冷血之剑与冰渊之心尚未解锁；隐藏的实力只影响冲刺体力。这里没有人为关闭本应生效的伤害被动。",
  "自定义单目标：等级 1、所用伤害元素抗性 10%、无防御降低或无视、无护盾、无免疫、无初始元素附着，且本次攻击确实命中。目标不是具名敌人数据。",
  "当前计算范围无元素反应、无暴击触发效果；5% 暴击率与 50% 暴击伤害用于独立暴击的期望值，不代表单次命中必然出现该期望数值。",
  "6.7 是供应目录的历史标签，不代表本次核验了 6.7 或当前正式服全部机制。精确字段在两个固定来源制品之间交叉核对；它们可能共享上游游戏数据，不属于两个独立实测实验。",
  "未运行游戏客户端或外部 gcsim 二进制复现此配装；此例仍为来源交叉核对的暂定真实角色例题，不得标为已验证游戏例题。",
];

function baseDocument(): CalculatorDocument {
  return {
    schemaVersion: "1.0.0",
    ruleVersion: "ordinary-trace-v1",
    id: "source-backed-kaeya",
    label: "来源交叉核对：凯亚最小配装",
    scope: "single-hit",
    characterLevel: 1,
    build: {
      mode: "equipment-derived",
      characterBaseAtk: 18.6984,
      weaponBaseAtk: 23.245,
      atkPercent: 0,
      flatAtk: 0,
      baseHp: 975.6164,
      hpPercent: 0,
      flatHp: 0,
      baseDef: 66.381,
      defPercent: 0,
      flatDef: 0,
      em: 0,
      critRate: 0.05,
      critDamage: 0.5,
      equipment: {
        characterId: "character:10000015",
        weaponId: "weapon:11101",
        level: 1,
        ascension: 0,
        weaponLevel: 1,
        weaponAscension: 0,
        refinement: 1,
        weaponType: "sword",
        bonusAccounting: "core-sourced-v1",
        artifacts: [],
        hitBonuses: [],
        sourceVersion: "genshin-db@5.2.12+gcsim@b4ae769d7c1c",
        sourceRefs: [...GAME_WORKED_EXAMPLE_SOURCE_REFS],
        derivedStats: [
          { id: "characterBaseAtk", label: "凯亚基础攻击力", base: 18.6984, curve: 1, promotion: 0, sourceRef: characterSource },
          { id: "weaponBaseAtk", label: "无锋剑基础攻击力", base: 23.245, curve: 1, promotion: 0, sourceRef: weaponSource },
          { id: "baseHp", label: "凯亚基础生命值", base: 975.6164, curve: 1, promotion: 0, sourceRef: characterSource },
          { id: "baseDef", label: "凯亚基础防御力", base: 66.381, curve: 1, promotion: 0, sourceRef: characterSource },
          { id: "weaponSecondary", label: "无锋剑无副属性", base: 0, curve: 1, promotion: 0, sourceRef: weaponSource },
        ],
        secondaryContributions: [
          { property: "FIGHT_PROP_CRITICAL", value: 0.05, sourceRef: baseStatSource },
          { property: "FIGHT_PROP_CRITICAL_HURT", value: 0.5, sourceRef: baseStatSource },
          { property: "FIGHT_PROP_CHARGE_EFFICIENCY", value: 0, sourceRef: characterSource },
          { property: "FIGHT_PROP_NONE", value: 0, sourceRef: weaponSource },
        ],
        assumptions: [...sharedAssumptions],
        effectBlockers: [],
      },
    },
    enemy: { level: 1, resistance: 0.1, defenseAdjustment: 0, defenseIgnore: 0 },
    hits: [],
    selectedHitIds: [],
    assumptions: [...sharedAssumptions],
    dependencies: [
      { id: "kaeya-lv1-base-stats", status: "provisional", reason: "角色基础属性在 genshin-db 与固定 gcsim 制品一致；精确小数未由独立客户端实测验证。", sourceRefs: [characterSource, baseStatSource, `${genshinDb}/src/min/data.min.json`] },
      { id: "dull-blade-lv1-no-effect", status: "provisional", reason: "23.245 基础攻击力、无副属性及无被动已有固定来源交叉核对；未晋升为当前版本已验证数据。", sourceRefs: [weaponSource, noWeaponEffectSource, `${genshinDb}/src/min/data.min.json`] },
    ],
    dataIdentity: {
      datasetId: "source-backed-kaeya-genshin-db-5.2.12-gcsim-b4ae769",
      gameVersion: "6.7",
      releaseStatus: "unknown",
      evidenceStatus: "provisional",
    },
  };
}

const frostgnaw = baseDocument();
frostgnaw.id = "game-kaeya-frostgnaw-lv1";
frostgnaw.label = "真实角色·暂定：凯亚霜袭，1 级无锋剑";
frostgnaw.scope = "one-cast";
frostgnaw.gameContext = {
  characterId: "character:10000015",
  characterName: "凯亚",
  abilityId: "talent:kaeya:combat2",
  skillId: "kaeya-skill",
  skillName: "霜袭",
  effectiveTalentLevel: 1,
  constellation: 0,
  scopeCoverage: "complete-cast",
  attributionPolicy: "仅计算此次霜袭在一个目标上的唯一直接伤害实例；此配装没有其他伤害实例、反应伤害或队友伤害，粒子不计入伤害。",
};
frostgnaw.dependencies.push({
  id: "kaeya-frostgnaw-talent1",
  status: "provisional",
  reason: "技能第 1 级倍率 1.912 与两个固定制品一致；显式 gcsim 攻击定义与 KQM 机制说明支持单次冰元素攻击力缩放，仍非当前版本客户端验证。",
  sourceRefs: [`${gcsim}/internal/characters/kaeya/skill.go`, `${gcsim}/internal/characters/kaeya/zz_kaeya.dm.go#L213-L230`, kaeyaSource],
});
frostgnaw.hits = [{
  id: "kaeya-skill-hit",
  label: "霜袭·直接伤害（天赋 1）",
  kind: "ordinary",
  element: "cryo",
  attackTag: "skill",
  terms: [{ stat: "atk", coefficient: 1.912 }],
  additiveBaseDamage: 0,
  damageBonus: 0,
  critEligible: true,
  reaction: "none",
  reactionBonus: 0,
  groupMultiplier: 1,
  sourceRefs: [...GAME_WORKED_EXAMPLE_SOURCE_REFS, `${gcsim}/internal/characters/kaeya/skill.go`, `${gcsim}/internal/characters/kaeya/zz_kaeya.dm.go#L213-L230`],
  dependencies: frostgnaw.dependencies.map((dependency) => dependency.id),
  excludedModifiers: [
    { label: "突破被动", reason: "突破 0 尚未解锁冷血之剑和冰渊之心；其治疗/产球亦不是这个直接伤害数值的乘区。" },
    { label: "命座效果", reason: "C0 未解锁任何命座；没有 C3 天赋等级加成。" },
    { label: "武器及圣遗物效果", reason: "无锋剑没有副属性或武器被动；此配装没有圣遗物。" },
  ],
}];
frostgnaw.selectedHitIds = ["kaeya-skill-hit"];

const normal = baseDocument();
normal.id = "game-kaeya-normal-1-lv1";
normal.label = "真实角色·暂定：凯亚普通攻击第一段";
normal.gameContext = {
  characterId: "character:10000015",
  characterName: "凯亚",
  abilityId: "talent:kaeya:combat1",
  skillId: "kaeya-normal-1",
  skillName: "仪典剑术",
  effectiveTalentLevel: 1,
  constellation: 0,
  scopeCoverage: "single-hit",
  attributionPolicy: "仅选择普通攻击序列的第一输入所产生的第一段物理伤害；不是 N5 连段总伤害，也没有附魔。",
};
normal.dependencies.push({
  id: "kaeya-normal1-talent1",
  status: "provisional",
  reason: "普通攻击第一段天赋 1 精确倍率 0.5375 在 genshin-db 与固定 gcsim 表一致；物理/攻击力缩放来自显式攻击定义，未用四舍五入的展示倍率 53.8% 反推。",
  sourceRefs: [`${gcsim}/internal/characters/kaeya/attack.go`, `${gcsim}/internal/characters/kaeya/zz_kaeya.dm.go#L36-L53`, kaeyaSource],
});
normal.hits = [{
  id: "kaeya-normal-1-hit-1",
  label: "仪典剑术·第一段（天赋 1）",
  kind: "ordinary",
  element: "physical",
  attackTag: "normal",
  terms: [{ stat: "atk", coefficient: 0.5375 }],
  additiveBaseDamage: 0,
  damageBonus: 0,
  critEligible: true,
  reaction: "none",
  reactionBonus: 0,
  groupMultiplier: 1,
  sourceRefs: [...GAME_WORKED_EXAMPLE_SOURCE_REFS, `${gcsim}/internal/characters/kaeya/attack.go`, `${gcsim}/internal/characters/kaeya/zz_kaeya.dm.go#L36-L53`],
  dependencies: normal.dependencies.map((dependency) => dependency.id),
  excludedModifiers: [
    { label: "C1 暴击率加成", reason: "本例为 C0，没有解锁对冰附着目标的普攻/重击暴击率加成。" },
    { label: "附魔与超导", reason: "无队友、无附魔、无已有元素附着或超导减抗；按物理伤害和显式 10% 物理抗性计算。" },
    { label: "武器及圣遗物效果", reason: "无锋剑没有副属性或武器被动；此配装没有圣遗物。" },
  ],
}];
normal.selectedHitIds = ["kaeya-normal-1-hit-1"];

export const GAME_WORKED_EXAMPLE_INPUTS: CalculatorDocument[] = [frostgnaw, normal];

/** Exact decimal expectations derived independently in Python Decimal, not core outputs. */
export const GAME_WORKED_EXAMPLE_EXPECTATIONS = {
  "game-kaeya-frostgnaw-lv1": { nonCritical: 36.08810136, critical: 54.13215204, expected: 36.990303894 },
  "game-kaeya-normal-1-lv1": { nonCritical: 10.145059875, critical: 15.2175898125, expected: 10.398686371875 },
} as const;

export const GAME_WORKED_EXAMPLE_NOTES = {
  category: "source-backed-game",
  evidenceStatus: "cross-checked",
  completeCurrentVersionValidation: false,
  sourceIndependence: "Two separate source artifacts can share upstream game data; agreement is a numerical cross-check, not independent live-game validation.",
  crossValidationReport: "docs/cross-validation/real-game-fixture-candidates.json",
} as const;

export default GAME_WORKED_EXAMPLE_INPUTS;
