import type { SourceHitMapping } from "./types";
import evidence from "../../sources/conditional-skills/manifest.json";

/** Explicit source branches. Each complete action is conditional self-damage,
 * not a timing, energy, application, or complete character certificate. */
export const conditionalSkillMappings: SourceHitMapping[] = [
  {
    "id": "diluc-skill-stage-1-c0-斩击",
    "characterSlug": "diluc",
    "talentSetId": "talent-set:diluc",
    "abilityKey": "combat2",
    "parameterKey": "param1",
    "skillId": "diluc-skill-stage-1-c0",
    "skillLabel": "逆焰之刃·第 1 次输入（C0）",
    "hitLabel": "斩击",
    "attackTag": "skill",
    "element": "pyro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.944,
      1.0148,
      1.0856,
      1.18,
      1.2508,
      1.3216,
      1.416,
      1.5104,
      1.6048,
      1.6992,
      1.7936,
      1.888,
      2.006,
      2.124,
      2.242
    ],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/diluc/diluc.go",
      "internal/characters/diluc/skill.go",
      "internal/characters/diluc/zz_diluc.dm.go",
      "internal/characters/diluc/cons.go",
      "internal/characters/diluc/burst.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；当前为同一 E 链的所选合法段次，4 秒重置未发生；Q 状态与其 A4 火伤加成未生效。",
      "一次 E 调用仅产生所选一击；三次输入分别列出，不把一击标作完整三连。",
      "本项全部列出命中均实际击中同一稳定目标；输入为这些命中实际采用的最终面板，反应资格逐击输入，不从倍率推断附着。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下本次输入的自身伤害实例；不认证附着、ICD、能量、动作帧、取消、粒子、治疗、护盾或整个角色循环。",
      "不包含队友与装备触发的其他伤害事件；这些机制不会由基础面板或本映射自动补齐。"
    ],
    "completeAction": true
  },
  {
    "id": "diluc-skill-stage-2-c0-斩击",
    "characterSlug": "diluc",
    "talentSetId": "talent-set:diluc",
    "abilityKey": "combat2",
    "parameterKey": "param2",
    "skillId": "diluc-skill-stage-2-c0",
    "skillLabel": "逆焰之刃·第 2 次输入（C0）",
    "hitLabel": "斩击",
    "attackTag": "skill",
    "element": "pyro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.976,
      1.0492,
      1.1224,
      1.22,
      1.2932,
      1.3664,
      1.464,
      1.5616,
      1.6592,
      1.7568,
      1.8544,
      1.952,
      2.074,
      2.196,
      2.318
    ],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/diluc/diluc.go",
      "internal/characters/diluc/skill.go",
      "internal/characters/diluc/zz_diluc.dm.go",
      "internal/characters/diluc/cons.go",
      "internal/characters/diluc/burst.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；当前为同一 E 链的所选合法段次，4 秒重置未发生；Q 状态与其 A4 火伤加成未生效。",
      "一次 E 调用仅产生所选一击；三次输入分别列出，不把一击标作完整三连。",
      "本项全部列出命中均实际击中同一稳定目标；输入为这些命中实际采用的最终面板，反应资格逐击输入，不从倍率推断附着。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下本次输入的自身伤害实例；不认证附着、ICD、能量、动作帧、取消、粒子、治疗、护盾或整个角色循环。",
      "不包含队友与装备触发的其他伤害事件；这些机制不会由基础面板或本映射自动补齐。"
    ],
    "completeAction": true
  },
  {
    "id": "diluc-skill-stage-3-c0-斩击",
    "characterSlug": "diluc",
    "talentSetId": "talent-set:diluc",
    "abilityKey": "combat2",
    "parameterKey": "param3",
    "skillId": "diluc-skill-stage-3-c0",
    "skillLabel": "逆焰之刃·第 3 次输入（C0）",
    "hitLabel": "斩击",
    "attackTag": "skill",
    "element": "pyro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      1.288,
      1.3846,
      1.4812,
      1.61,
      1.7066,
      1.8032,
      1.932,
      2.0608,
      2.1896,
      2.3184,
      2.4472,
      2.576,
      2.737,
      2.898,
      3.059
    ],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/diluc/diluc.go",
      "internal/characters/diluc/skill.go",
      "internal/characters/diluc/zz_diluc.dm.go",
      "internal/characters/diluc/cons.go",
      "internal/characters/diluc/burst.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；当前为同一 E 链的所选合法段次，4 秒重置未发生；Q 状态与其 A4 火伤加成未生效。",
      "一次 E 调用仅产生所选一击；三次输入分别列出，不把一击标作完整三连。",
      "本项全部列出命中均实际击中同一稳定目标；输入为这些命中实际采用的最终面板，反应资格逐击输入，不从倍率推断附着。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下本次输入的自身伤害实例；不认证附着、ICD、能量、动作帧、取消、粒子、治疗、护盾或整个角色循环。",
      "不包含队友与装备触发的其他伤害事件；这些机制不会由基础面板或本映射自动补齐。"
    ],
    "completeAction": true
  },
  {
    "id": "lisa-skill-hold-0-stacks-c0-落雷",
    "characterSlug": "lisa",
    "talentSetId": "talent-set:lisa",
    "abilityKey": "combat2",
    "parameterKey": "param1",
    "skillId": "lisa-skill-hold-0-stacks-c0",
    "skillLabel": "苍雷·长按·目标 0 层引雷（C0）",
    "hitLabel": "落雷",
    "attackTag": "skill",
    "element": "electro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      3.2,
      3.44,
      3.68,
      4.0,
      4.24,
      4.48,
      4.8,
      5.12,
      5.44,
      5.76,
      6.08,
      6.4,
      6.8,
      7.2,
      7.6
    ],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/lisa/lisa.go",
      "internal/characters/lisa/skill.go",
      "internal/characters/lisa/zz_lisa.dm.go",
      "internal/characters/lisa/asc.go",
      "internal/characters/lisa/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；目标在本次 OnEnemyHit 取值前恰有 0 层引雷，当前面板来自本次 E 起手快照；不运行 Q 的 A4 减防。",
      "本次对一个独立目标恰好一击，未发生多个紧邻目标命中圈重叠；引雷取值后清空，不自动认证层数的获取或寿命。",
      "本项全部列出命中均实际击中同一稳定目标；输入为这些命中实际采用的最终面板，反应资格逐击输入，不从倍率推断附着。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下本次输入的自身伤害实例；不认证附着、ICD、能量、动作帧、取消、粒子、治疗、护盾或整个角色循环。",
      "不包含队友与装备触发的其他伤害事件；这些机制不会由基础面板或本映射自动补齐。"
    ],
    "completeAction": true
  },
  {
    "id": "lisa-skill-hold-1-stacks-c0-落雷",
    "characterSlug": "lisa",
    "talentSetId": "talent-set:lisa",
    "abilityKey": "combat2",
    "parameterKey": "param2",
    "skillId": "lisa-skill-hold-1-stacks-c0",
    "skillLabel": "苍雷·长按·目标 1 层引雷（C0）",
    "hitLabel": "落雷",
    "attackTag": "skill",
    "element": "electro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      3.68,
      3.956,
      4.232,
      4.6,
      4.876,
      5.152,
      5.52,
      5.888,
      6.256,
      6.624,
      6.992,
      7.36,
      7.82,
      8.28,
      8.74
    ],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/lisa/lisa.go",
      "internal/characters/lisa/skill.go",
      "internal/characters/lisa/zz_lisa.dm.go",
      "internal/characters/lisa/asc.go",
      "internal/characters/lisa/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；目标在本次 OnEnemyHit 取值前恰有 1 层引雷，当前面板来自本次 E 起手快照；不运行 Q 的 A4 减防。",
      "本次对一个独立目标恰好一击，未发生多个紧邻目标命中圈重叠；引雷取值后清空，不自动认证层数的获取或寿命。",
      "本项全部列出命中均实际击中同一稳定目标；输入为这些命中实际采用的最终面板，反应资格逐击输入，不从倍率推断附着。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下本次输入的自身伤害实例；不认证附着、ICD、能量、动作帧、取消、粒子、治疗、护盾或整个角色循环。",
      "不包含队友与装备触发的其他伤害事件；这些机制不会由基础面板或本映射自动补齐。"
    ],
    "completeAction": true
  },
  {
    "id": "lisa-skill-hold-2-stacks-c0-落雷",
    "characterSlug": "lisa",
    "talentSetId": "talent-set:lisa",
    "abilityKey": "combat2",
    "parameterKey": "param3",
    "skillId": "lisa-skill-hold-2-stacks-c0",
    "skillLabel": "苍雷·长按·目标 2 层引雷（C0）",
    "hitLabel": "落雷",
    "attackTag": "skill",
    "element": "electro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      4.24,
      4.558,
      4.876,
      5.3,
      5.618,
      5.936,
      6.36,
      6.784,
      7.208,
      7.632,
      8.056,
      8.48,
      9.01,
      9.54,
      10.07
    ],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/lisa/lisa.go",
      "internal/characters/lisa/skill.go",
      "internal/characters/lisa/zz_lisa.dm.go",
      "internal/characters/lisa/asc.go",
      "internal/characters/lisa/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；目标在本次 OnEnemyHit 取值前恰有 2 层引雷，当前面板来自本次 E 起手快照；不运行 Q 的 A4 减防。",
      "本次对一个独立目标恰好一击，未发生多个紧邻目标命中圈重叠；引雷取值后清空，不自动认证层数的获取或寿命。",
      "本项全部列出命中均实际击中同一稳定目标；输入为这些命中实际采用的最终面板，反应资格逐击输入，不从倍率推断附着。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下本次输入的自身伤害实例；不认证附着、ICD、能量、动作帧、取消、粒子、治疗、护盾或整个角色循环。",
      "不包含队友与装备触发的其他伤害事件；这些机制不会由基础面板或本映射自动补齐。"
    ],
    "completeAction": true
  },
  {
    "id": "lisa-skill-hold-3-stacks-c0-落雷",
    "characterSlug": "lisa",
    "talentSetId": "talent-set:lisa",
    "abilityKey": "combat2",
    "parameterKey": "param4",
    "skillId": "lisa-skill-hold-3-stacks-c0",
    "skillLabel": "苍雷·长按·目标 3 层引雷（C0）",
    "hitLabel": "落雷",
    "attackTag": "skill",
    "element": "electro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      4.872,
      5.2374,
      5.6028,
      6.09,
      6.4554,
      6.8208,
      7.308,
      7.7952,
      8.2824,
      8.7696,
      9.2568,
      9.744,
      10.353,
      10.962,
      11.571
    ],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/lisa/lisa.go",
      "internal/characters/lisa/skill.go",
      "internal/characters/lisa/zz_lisa.dm.go",
      "internal/characters/lisa/asc.go",
      "internal/characters/lisa/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；目标在本次 OnEnemyHit 取值前恰有 3 层引雷，当前面板来自本次 E 起手快照；不运行 Q 的 A4 减防。",
      "本次对一个独立目标恰好一击，未发生多个紧邻目标命中圈重叠；引雷取值后清空，不自动认证层数的获取或寿命。",
      "本项全部列出命中均实际击中同一稳定目标；输入为这些命中实际采用的最终面板，反应资格逐击输入，不从倍率推断附着。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下本次输入的自身伤害实例；不认证附着、ICD、能量、动作帧、取消、粒子、治疗、护盾或整个角色循环。",
      "不包含队友与装备触发的其他伤害事件；这些机制不会由基础面板或本映射自动补齐。"
    ],
    "completeAction": true
  },
  {
    "id": "bennett-skill-hold-1-c0-挥击1",
    "characterSlug": "bennett",
    "talentSetId": "talent-set:bennett",
    "abilityKey": "combat2",
    "parameterKey": "param2",
    "skillId": "bennett-skill-hold-1-c0",
    "skillLabel": "热情过载·1 段蓄力（C0）",
    "hitLabel": "挥击1",
    "attackTag": "skill",
    "element": "pyro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.84,
      0.903,
      0.966,
      1.05,
      1.113,
      1.176,
      1.26,
      1.344,
      1.428,
      1.512,
      1.596,
      1.68,
      1.785,
      1.89,
      1.995
    ],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/bennett/bennett.go",
      "internal/characters/bennett/skill.go",
      "internal/characters/bennett/zz_bennett.dm.go",
      "internal/characters/bennett/asc.go",
      "internal/characters/bennett/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；Q 领域未生效；已完成指定蓄力且未取消/中断，所有列出攻击均发生。",
      "各击使用同一稳定面板；本项不含 C4 的额外 135% 第二击。",
      "本项全部列出命中均实际击中同一稳定目标；输入为这些命中实际采用的最终面板，反应资格逐击输入，不从倍率推断附着。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下本次输入的自身伤害实例；不认证附着、ICD、能量、动作帧、取消、粒子、治疗、护盾或整个角色循环。",
      "不包含队友与装备触发的其他伤害事件；这些机制不会由基础面板或本映射自动补齐。"
    ],
    "completeAction": true
  },
  {
    "id": "bennett-skill-hold-1-c0-挥击2",
    "characterSlug": "bennett",
    "talentSetId": "talent-set:bennett",
    "abilityKey": "combat2",
    "parameterKey": "param3",
    "skillId": "bennett-skill-hold-1-c0",
    "skillLabel": "热情过载·1 段蓄力（C0）",
    "hitLabel": "挥击2",
    "attackTag": "skill",
    "element": "pyro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.92,
      0.989,
      1.058,
      1.15,
      1.219,
      1.288,
      1.38,
      1.472,
      1.564,
      1.656,
      1.748,
      1.84,
      1.955,
      2.07,
      2.185
    ],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/bennett/bennett.go",
      "internal/characters/bennett/skill.go",
      "internal/characters/bennett/zz_bennett.dm.go",
      "internal/characters/bennett/asc.go",
      "internal/characters/bennett/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；Q 领域未生效；已完成指定蓄力且未取消/中断，所有列出攻击均发生。",
      "各击使用同一稳定面板；本项不含 C4 的额外 135% 第二击。",
      "本项全部列出命中均实际击中同一稳定目标；输入为这些命中实际采用的最终面板，反应资格逐击输入，不从倍率推断附着。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下本次输入的自身伤害实例；不认证附着、ICD、能量、动作帧、取消、粒子、治疗、护盾或整个角色循环。",
      "不包含队友与装备触发的其他伤害事件；这些机制不会由基础面板或本映射自动补齐。"
    ],
    "completeAction": true
  },
  {
    "id": "bennett-skill-hold-2-c0-挥击1",
    "characterSlug": "bennett",
    "talentSetId": "talent-set:bennett",
    "abilityKey": "combat2",
    "parameterKey": "param4",
    "skillId": "bennett-skill-hold-2-c0",
    "skillLabel": "热情过载·2 段蓄力（C0）",
    "hitLabel": "挥击1",
    "attackTag": "skill",
    "element": "pyro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.88,
      0.946,
      1.012,
      1.1,
      1.166,
      1.232,
      1.32,
      1.408,
      1.496,
      1.584,
      1.672,
      1.76,
      1.87,
      1.98,
      2.09
    ],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/bennett/bennett.go",
      "internal/characters/bennett/skill.go",
      "internal/characters/bennett/zz_bennett.dm.go",
      "internal/characters/bennett/asc.go",
      "internal/characters/bennett/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；Q 领域未生效；已完成指定蓄力且未取消/中断，所有列出攻击均发生。",
      "各击使用同一稳定面板；本项不含 C4 的额外 135% 第二击。",
      "本项全部列出命中均实际击中同一稳定目标；输入为这些命中实际采用的最终面板，反应资格逐击输入，不从倍率推断附着。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下本次输入的自身伤害实例；不认证附着、ICD、能量、动作帧、取消、粒子、治疗、护盾或整个角色循环。",
      "不包含队友与装备触发的其他伤害事件；这些机制不会由基础面板或本映射自动补齐。"
    ],
    "completeAction": true
  },
  {
    "id": "bennett-skill-hold-2-c0-挥击2",
    "characterSlug": "bennett",
    "talentSetId": "talent-set:bennett",
    "abilityKey": "combat2",
    "parameterKey": "param5",
    "skillId": "bennett-skill-hold-2-c0",
    "skillLabel": "热情过载·2 段蓄力（C0）",
    "hitLabel": "挥击2",
    "attackTag": "skill",
    "element": "pyro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      0.96,
      1.032,
      1.104,
      1.2,
      1.272,
      1.344,
      1.44,
      1.536,
      1.632,
      1.728,
      1.824,
      1.92,
      2.04,
      2.16,
      2.28
    ],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/bennett/bennett.go",
      "internal/characters/bennett/skill.go",
      "internal/characters/bennett/zz_bennett.dm.go",
      "internal/characters/bennett/asc.go",
      "internal/characters/bennett/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；Q 领域未生效；已完成指定蓄力且未取消/中断，所有列出攻击均发生。",
      "各击使用同一稳定面板；本项不含 C4 的额外 135% 第二击。",
      "本项全部列出命中均实际击中同一稳定目标；输入为这些命中实际采用的最终面板，反应资格逐击输入，不从倍率推断附着。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下本次输入的自身伤害实例；不认证附着、ICD、能量、动作帧、取消、粒子、治疗、护盾或整个角色循环。",
      "不包含队友与装备触发的其他伤害事件；这些机制不会由基础面板或本映射自动补齐。"
    ],
    "completeAction": true
  },
  {
    "id": "bennett-skill-hold-2-c0-末段爆炸",
    "characterSlug": "bennett",
    "talentSetId": "talent-set:bennett",
    "abilityKey": "combat2",
    "parameterKey": "param6",
    "skillId": "bennett-skill-hold-2-c0",
    "skillLabel": "热情过载·2 段蓄力（C0）",
    "hitLabel": "末段爆炸",
    "attackTag": "skill",
    "element": "pyro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      1.32,
      1.419,
      1.518,
      1.65,
      1.749,
      1.848,
      1.98,
      2.112,
      2.244,
      2.376,
      2.508,
      2.64,
      2.805,
      2.97,
      3.135
    ],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/bennett/bennett.go",
      "internal/characters/bennett/skill.go",
      "internal/characters/bennett/zz_bennett.dm.go",
      "internal/characters/bennett/asc.go",
      "internal/characters/bennett/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；Q 领域未生效；已完成二段蓄力，末段爆炸实际命中且前两击亦命中。",
      "爆炸是第 3 个实际伤害实例；自我击飞不作为伤害，不把面板两项误认为只有两击。",
      "本项全部列出命中均实际击中同一稳定目标；输入为这些命中实际采用的最终面板，反应资格逐击输入，不从倍率推断附着。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下本次输入的自身伤害实例；不认证附着、ICD、能量、动作帧、取消、粒子、治疗、护盾或整个角色循环。",
      "不包含队友与装备触发的其他伤害事件；这些机制不会由基础面板或本映射自动补齐。"
    ],
    "completeAction": true
  },
  {
    "id": "beidou-skill-counter-0-c0-反击",
    "characterSlug": "beidou",
    "talentSetId": "talent-set:beidou",
    "abilityKey": "combat2",
    "parameterKey": "param3",
    "skillId": "beidou-skill-counter-0-c0",
    "skillLabel": "捉浪·反击 0 层（C0）",
    "hitLabel": "反击",
    "attackTag": "skill",
    "element": "electro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      1.216,
      1.3072,
      1.3984,
      1.52,
      1.6112,
      1.7024,
      1.824,
      1.9456,
      2.0672,
      2.1888,
      2.3104,
      2.432,
      2.584,
      2.736,
      2.888
    ],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/beidou/beidou.go",
      "internal/characters/beidou/skill.go",
      "internal/characters/beidou/zz_beidou.dm.go",
      "internal/characters/beidou/asc.go",
      "internal/characters/beidou/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；本次释放 counter=0 已明确成立；只计算一次反击伤害，不从受击次数自动模拟出该层数。",
      "基础伤害与每层提升均为 ATK 倍率相加，不属于伤害加成乘区；2 层就是基础项加上两份每层项。",
      "固定来源 A1 精准反击自动授予最大层数仍未实现，此处不把精准格挡与任意受击自动等同。",
      "本项全部列出命中均实际击中同一稳定目标；输入为这些命中实际采用的最终面板，反应资格逐击输入，不从倍率推断附着。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下本次输入的自身伤害实例；不认证附着、ICD、能量、动作帧、取消、粒子、治疗、护盾或整个角色循环。",
      "不包含队友与装备触发的其他伤害事件；这些机制不会由基础面板或本映射自动补齐。"
    ],
    "completeAction": true
  },
  {
    "id": "beidou-skill-counter-1-c0-反击",
    "characterSlug": "beidou",
    "talentSetId": "talent-set:beidou",
    "abilityKey": "combat2",
    "parameterKey": "param3",
    "skillId": "beidou-skill-counter-1-c0",
    "skillLabel": "捉浪·反击 1 层（C0）",
    "hitLabel": "反击",
    "attackTag": "skill",
    "element": "electro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      1.216,
      1.3072,
      1.3984,
      1.52,
      1.6112,
      1.7024,
      1.824,
      1.9456,
      2.0672,
      2.1888,
      2.3104,
      2.432,
      2.584,
      2.736,
      2.888
    ],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/beidou/beidou.go",
      "internal/characters/beidou/skill.go",
      "internal/characters/beidou/zz_beidou.dm.go",
      "internal/characters/beidou/asc.go",
      "internal/characters/beidou/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；本次释放 counter=1 已明确成立；只计算一次反击伤害，不从受击次数自动模拟出该层数。",
      "基础伤害与每层提升均为 ATK 倍率相加，不属于伤害加成乘区；2 层就是基础项加上两份每层项。",
      "固定来源 A1 精准反击自动授予最大层数仍未实现，此处不把精准格挡与任意受击自动等同。",
      "本项全部列出命中均实际击中同一稳定目标；输入为这些命中实际采用的最终面板，反应资格逐击输入，不从倍率推断附着。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下本次输入的自身伤害实例；不认证附着、ICD、能量、动作帧、取消、粒子、治疗、护盾或整个角色循环。",
      "不包含队友与装备触发的其他伤害事件；这些机制不会由基础面板或本映射自动补齐。"
    ],
    "completeAction": true,
    "additionalTerms": [
      {
        "scalingStat": "atk",
        "parameterKey": "param4",
        "sourceCoefficientValues": [
          1.6,
          1.72,
          1.84,
          2.0,
          2.12,
          2.24,
          2.4,
          2.56,
          2.72,
          2.88,
          3.04,
          3.2,
          3.4,
          3.6,
          3.8
        ],
        "coefficientTolerance": 0
      }
    ]
  },
  {
    "id": "beidou-skill-counter-2-c0-反击",
    "characterSlug": "beidou",
    "talentSetId": "talent-set:beidou",
    "abilityKey": "combat2",
    "parameterKey": "param3",
    "skillId": "beidou-skill-counter-2-c0",
    "skillLabel": "捉浪·反击 2 层（C0）",
    "hitLabel": "反击",
    "attackTag": "skill",
    "element": "electro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [
      1.216,
      1.3072,
      1.3984,
      1.52,
      1.6112,
      1.7024,
      1.824,
      1.9456,
      2.0672,
      2.1888,
      2.3104,
      2.432,
      2.584,
      2.736,
      2.888
    ],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/beidou/beidou.go",
      "internal/characters/beidou/skill.go",
      "internal/characters/beidou/zz_beidou.dm.go",
      "internal/characters/beidou/asc.go",
      "internal/characters/beidou/cons.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；本次释放 counter=2 已明确成立；只计算一次反击伤害，不从受击次数自动模拟出该层数。",
      "基础伤害与每层提升均为 ATK 倍率相加，不属于伤害加成乘区；2 层就是基础项加上两份每层项。",
      "固定来源 A1 精准反击自动授予最大层数仍未实现，此处不把精准格挡与任意受击自动等同。",
      "本项全部列出命中均实际击中同一稳定目标；输入为这些命中实际采用的最终面板，反应资格逐击输入，不从倍率推断附着。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下本次输入的自身伤害实例；不认证附着、ICD、能量、动作帧、取消、粒子、治疗、护盾或整个角色循环。",
      "不包含队友与装备触发的其他伤害事件；这些机制不会由基础面板或本映射自动补齐。"
    ],
    "completeAction": true,
    "additionalTerms": [
      {
        "scalingStat": "atk",
        "parameterKey": "param4",
        "sourceCoefficientValues": [
          1.6,
          1.72,
          1.84,
          2.0,
          2.12,
          2.24,
          2.4,
          2.56,
          2.72,
          2.88,
          3.04,
          3.2,
          3.4,
          3.6,
          3.8
        ],
        "coefficientTolerance": 0
      },
      {
        "scalingStat": "atk",
        "parameterKey": "param4",
        "sourceCoefficientValues": [
          1.6,
          1.72,
          1.84,
          2.0,
          2.12,
          2.24,
          2.4,
          2.56,
          2.72,
          2.88,
          3.04,
          3.2,
          3.4,
          3.6,
          3.8
        ],
        "coefficientTolerance": 0
      }
    ]
  },
  {
    "id": "xiangling-skill-guoba-four-breaths-c0-锅巴喷火",
    "characterSlug": "xiangling",
    "talentSetId": "talent-set:xiangling",
    "abilityKey": "combat2",
    "parameterKey": "param1",
    "skillId": "xiangling-skill-guoba-four-breaths-c0",
    "skillLabel": "锅巴出击·完整四口（C0）",
    "hitLabel": "锅巴喷火",
    "attackTag": "skill",
    "element": "pyro",
    "scalingStat": "atk",
    "instanceCount": 4,
    "sourceCoefficientValues": [
      1.1128,
      1.19626,
      1.27972,
      1.391,
      1.47446,
      1.55792,
      1.6692,
      1.78048,
      1.89176,
      2.00304,
      2.11432,
      2.2256,
      2.3647,
      2.5038,
      2.6429
    ],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/xiangling/xiangling.go",
      "internal/characters/xiangling/skill.go",
      "internal/characters/xiangling/zz_xiangling.dm.go",
      "internal/characters/xiangling/asc.go",
      "internal/characters/xiangling/cons.go",
      "internal/characters/xiangling/guoba.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；锅巴持续到正常结束，四次喷火全部命中同一目标；没有外部旋风从锅巴产生的额外反应事件。",
      "全四口使用锅巴生成时（本次 E 起手后 13 帧）Snapshot 保存的同一面板；在计算器中填写该历史快照，不把后续场上面板变化逐口重采样。",
      "目标抗性、防御和外部减益在四口期间保持不变；C1 减火抗未解锁，A4 辣椒在锅巴结束后出现，不提升此次四口。",
      "本项全部列出命中均实际击中同一稳定目标；输入为这些命中实际采用的最终面板，反应资格逐击输入，不从倍率推断附着。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下本次输入的自身伤害实例；不认证附着、ICD、能量、动作帧、取消、粒子、治疗、护盾或整个角色循环。",
      "不包含队友与装备触发的其他伤害事件；这些机制不会由基础面板或本映射自动补齐。"
    ],
    "completeAction": true
  },
  {
    "id": "ningguang-burst-no-screen-c0-本体宝石",
    "characterSlug": "ningguang",
    "talentSetId": "talent-set:ningguang",
    "abilityKey": "combat3",
    "parameterKey": "param1",
    "skillId": "ningguang-burst-no-screen-c0",
    "skillLabel": "天权崩玉·无璇玑屏六枚（C0）",
    "hitLabel": "本体宝石",
    "attackTag": "burst",
    "element": "geo",
    "scalingStat": "atk",
    "instanceCount": 6,
    "sourceCoefficientValues": [
      0.8696,
      0.93482,
      1.00004,
      1.087,
      1.15222,
      1.21744,
      1.3044,
      1.39136,
      1.47832,
      1.56528,
      1.65224,
      1.7392,
      1.8479,
      1.9566,
      2.0653
    ],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/ningguang/ningguang.go",
      "internal/characters/ningguang/burst.go",
      "internal/characters/ningguang/zz_ningguang.dm.go",
      "internal/characters/ningguang/asc.go",
      "pkg/enemy/damage.go"
    ],
    "assumptions": [
      "C0；施放时没有可销毁的璇玑屏，jade=6 且六枚本体宝石均命中同一目标；当前穿屏 A4 岩伤加成未生效。",
      "六枚本体宝石使用本次 Q 起手同一快照；完整仅指无屏分支，不包含需要独立 E 历史快照的屏宝石。",
      "本项全部列出命中均实际击中同一稳定目标；输入为这些命中实际采用的最终面板，反应资格逐击输入，不从倍率推断附着。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下本次输入的自身伤害实例；不认证附着、ICD、能量、动作帧、取消、粒子、治疗、护盾或整个角色循环。",
      "不包含队友与装备触发的其他伤害事件；这些机制不会由基础面板或本映射自动补齐。"
    ],
    "completeAction": true
  }
];

export const conditionalSkillSourceEvidence = evidence;
