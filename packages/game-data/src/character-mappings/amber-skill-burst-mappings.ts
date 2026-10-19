import type { SourceHitMapping } from "./types";

/** Same fixed coefficient vectors and damage scope as the source action library.
 * The standalone calculator does not require a team, resource ledger, or rotation. */
export const amberSkillBurstMappings: SourceHitMapping[] = [
  {
    id: "amber-skill-tap-expiry-hit", characterSlug: "amber", talentSetId: "talent-set:amber",
    abilityKey: "combat2", parameterKey: "param2", skillId: "amber-skill-tap-expiry",
    skillLabel: "兔兔伯爵 · 自然到期爆炸", hitLabel: "兔兔伯爵自然到期爆炸",
    element: "pyro", attackTag: "skill", scalingStat: "atk",
    sourceCoefficientValues: [1.232, 1.3244, 1.4168, 1.54, 1.6324, 1.7248, 1.848, 1.9712, 2.0944, 2.2176, 2.3408, 2.464, 2.618, 2.772, 2.926], coefficientTolerance: 0,
    sourcePaths: ["internal/characters/amber/skill.go", "internal/characters/amber/bunny.go", "internal/characters/amber/zz_amber.dm.go", "internal/characters/amber/asc.go"],
    assumptions: ["C0 点按 E 的兔兔伯爵自然到期，单个静止目标在爆炸范围内；只归属这一次自然爆炸。", "输入为兔兔伯爵生成时实际快照面板（固定来源为E输入后45帧），包括当时已生效的A4攻击力；不自动推断弱点命中或增益。"],
    exclusions: ["不包括兔兔伯爵受伤/生命耗尽、冻结或位移、长按落点、C2手动或超载爆破、C4第二充能；这些缺口不阻塞明确自然到期爆炸的条件伤害。"],
    completeAction: true
  },
  {
    id: "amber-burst-fiery-rain-hit", characterSlug: "amber", talentSetId: "talent-set:amber",
    abilityKey: "combat3", parameterKey: "param1", skillId: "amber-burst-fiery-rain",
    skillLabel: "箭雨 · 18 段全部命中", hitLabel: "箭雨", instanceCount: 18,
    element: "pyro", attackTag: "burst", scalingStat: "atk", critRateFormulaId: "amber-a1-burst",
    sourceCoefficientValues: [0.2808, 0.30186, 0.32292, 0.351, 0.37206, 0.39312, 0.4212, 0.44928, 0.47736, 0.50544, 0.53352, 0.5616, 0.5967, 0.6318, 0.6669], coefficientTolerance: 0,
    sourcePaths: ["internal/characters/amber/burst.go", "internal/characters/amber/zz_amber.dm.go", "internal/characters/amber/asc.go"],
    assumptions: ["C0 箭雨三个循环5+3+10共18段全部命中同一静止目标；此为条件完整施放，不预测随机落点或实际目标碰撞。", "输入为Q起手实际快照面板，包括当时已生效的A4攻击力；A1突破1后的10%本段暴击率由独立来源公式加入，不应重复填入共用暴击率。", "每段反应条件独立输入；全段选择同一反应不能证明实战附着频率。"],
    exclusions: ["不由本独立计算推断Q能量资格、敌人移动、随机落点、A4弱点命中触发或命座额外效果。"],
    completeAction: true
  }
];
