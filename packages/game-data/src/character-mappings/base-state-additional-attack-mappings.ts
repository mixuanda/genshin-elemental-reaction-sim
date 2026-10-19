import type { SourceHitMapping } from "./types";
import evidence from "../../sources/additional-base-state-attacks/manifest.json";

/** Explicit reviewed source branches, not inference from talent labels.
 * Includes Zhongli A4 once per emitted hit with a real ascension condition.
 * Zero mirrors/jades/stacks and Eoff/Qoff scopes describe this one input;
 * creating resources after an input does not certify a subsequent sequence.
 */
export const additionalBaseStateAttackMappings: SourceHitMapping[] = [
  {
    "id": "xiao-normal-1-base-c0-hit-1",
    "characterSlug": "xiao",
    "talentSetId": "talent-set:xiao",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "xiao-normal-1-base-c0",
    "skillLabel": "普通攻击第 1 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.27544, 0.29422, 0.313, 0.33804, 0.35682, 0.37873, 0.4069, 0.43507, 0.46324, 0.49141, 0.51958, 0.54775, 0.57592, 0.60409, 0.63226],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/xiao/attack.go",
      "internal/characters/xiao/zz_xiao.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/xiao/xiao.go",
      "internal/characters/xiao/burst.go",
      "internal/characters/xiao/asc.go"
    ],
    "assumptions": [
      "C0；Qoff且爆发附魔与增伤均未生效；无其他元素附魔。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "xiao-normal-1-base-c0-hit-2",
    "characterSlug": "xiao",
    "talentSetId": "talent-set:xiao",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "xiao-normal-1-base-c0",
    "skillLabel": "普通攻击第 1 段（C0·来源条件）",
    "hitLabel": "第 2 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.27544, 0.29422, 0.313, 0.33804, 0.35682, 0.37873, 0.4069, 0.43507, 0.46324, 0.49141, 0.51958, 0.54775, 0.57592, 0.60409, 0.63226],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/xiao/attack.go",
      "internal/characters/xiao/zz_xiao.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/xiao/xiao.go",
      "internal/characters/xiao/burst.go",
      "internal/characters/xiao/asc.go"
    ],
    "assumptions": [
      "C0；Qoff且爆发附魔与增伤均未生效；无其他元素附魔。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "xiao-normal-2-base-c0-hit-1",
    "characterSlug": "xiao",
    "talentSetId": "talent-set:xiao",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "xiao-normal-2-base-c0",
    "skillLabel": "普通攻击第 2 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.56936, 0.60818, 0.647, 0.69876, 0.73758, 0.78287, 0.8411, 0.89933, 0.95756, 1.01579, 1.07402, 1.13225, 1.19048, 1.24871, 1.30694],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/xiao/attack.go",
      "internal/characters/xiao/zz_xiao.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/xiao/xiao.go",
      "internal/characters/xiao/burst.go",
      "internal/characters/xiao/asc.go"
    ],
    "assumptions": [
      "C0；Qoff且爆发附魔与增伤均未生效；无其他元素附魔。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "xiao-normal-3-base-c0-hit-1",
    "characterSlug": "xiao",
    "talentSetId": "talent-set:xiao",
    "abilityKey": "combat1",
    "parameterKey": "param4",
    "skillId": "xiao-normal-3-base-c0",
    "skillLabel": "普通攻击第 3 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.68552, 0.73226, 0.779, 0.84132, 0.88806, 0.94259, 1.0127, 1.08281, 1.15292, 1.22303, 1.29314, 1.36325, 1.43336, 1.50347, 1.57358],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/xiao/attack.go",
      "internal/characters/xiao/zz_xiao.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/xiao/xiao.go",
      "internal/characters/xiao/burst.go",
      "internal/characters/xiao/asc.go"
    ],
    "assumptions": [
      "C0；Qoff且爆发附魔与增伤均未生效；无其他元素附魔。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "xiao-normal-4-base-c0-hit-1",
    "characterSlug": "xiao",
    "talentSetId": "talent-set:xiao",
    "abilityKey": "combat1",
    "parameterKey": "param5",
    "skillId": "xiao-normal-4-base-c0",
    "skillLabel": "普通攻击第 4 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.37664, 0.40232, 0.428, 0.46224, 0.48792, 0.51788, 0.5564, 0.59492, 0.63344, 0.67196, 0.71048, 0.749, 0.78752, 0.82604, 0.86456],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/xiao/attack.go",
      "internal/characters/xiao/zz_xiao.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/xiao/xiao.go",
      "internal/characters/xiao/burst.go",
      "internal/characters/xiao/asc.go"
    ],
    "assumptions": [
      "C0；Qoff且爆发附魔与增伤均未生效；无其他元素附魔。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "xiao-normal-4-base-c0-hit-2",
    "characterSlug": "xiao",
    "talentSetId": "talent-set:xiao",
    "abilityKey": "combat1",
    "parameterKey": "param6",
    "skillId": "xiao-normal-4-base-c0",
    "skillLabel": "普通攻击第 4 段（C0·来源条件）",
    "hitLabel": "第 2 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.37664, 0.40232, 0.428, 0.46224, 0.48792, 0.51788, 0.5564, 0.59492, 0.63344, 0.67196, 0.71048, 0.749, 0.78752, 0.82604, 0.86456],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/xiao/attack.go",
      "internal/characters/xiao/zz_xiao.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/xiao/xiao.go",
      "internal/characters/xiao/burst.go",
      "internal/characters/xiao/asc.go"
    ],
    "assumptions": [
      "C0；Qoff且爆发附魔与增伤均未生效；无其他元素附魔。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "xiao-normal-5-base-c0-hit-1",
    "characterSlug": "xiao",
    "talentSetId": "talent-set:xiao",
    "abilityKey": "combat1",
    "parameterKey": "param7",
    "skillId": "xiao-normal-5-base-c0",
    "skillLabel": "普通攻击第 5 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.71544, 0.76422, 0.813, 0.87804, 0.92682, 0.98373, 1.0569, 1.13007, 1.20324, 1.27641, 1.34958, 1.42275, 1.49592, 1.56909, 1.64226],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/xiao/attack.go",
      "internal/characters/xiao/zz_xiao.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/xiao/xiao.go",
      "internal/characters/xiao/burst.go",
      "internal/characters/xiao/asc.go"
    ],
    "assumptions": [
      "C0；Qoff且爆发附魔与增伤均未生效；无其他元素附魔。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "xiao-normal-6-base-c0-hit-1",
    "characterSlug": "xiao",
    "talentSetId": "talent-set:xiao",
    "abilityKey": "combat1",
    "parameterKey": "param8",
    "skillId": "xiao-normal-6-base-c0",
    "skillLabel": "普通攻击第 6 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.95832, 1.02366, 1.089, 1.17612, 1.24146, 1.31769, 1.4157, 1.51371, 1.61172, 1.70973, 1.80774, 1.90575, 2.00376, 2.10177, 2.19978],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/xiao/attack.go",
      "internal/characters/xiao/zz_xiao.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/xiao/xiao.go",
      "internal/characters/xiao/burst.go",
      "internal/characters/xiao/asc.go"
    ],
    "assumptions": [
      "C0；Qoff且爆发附魔与增伤均未生效；无其他元素附魔。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "alhaitham-normal-1-base-c0-hit-1",
    "characterSlug": "alhaitham",
    "talentSetId": "talent-set:alhaitham",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "alhaitham-normal-1-base-c0",
    "skillLabel": "普通攻击第 1 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.495257, 0.535568, 0.57588, 0.633468, 0.67378, 0.71985, 0.783197, 0.846544, 0.90989, 0.978996, 1.048102, 1.117207, 1.186313, 1.255418, 1.324524],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/alhaitham/attack.go",
      "internal/characters/alhaitham/zz_alhaitham.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/alhaitham/alhaitham.go",
      "internal/characters/alhaitham/skill.go",
      "internal/characters/alhaitham/asc.go"
    ],
    "assumptions": [
      "C0；本输入全过程琢光镜数量为0，且无待结算的镜子生成或外部附魔；普通攻击本身不生成镜，零镜投影回调退出。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "alhaitham-normal-2-base-c0-hit-1",
    "characterSlug": "alhaitham",
    "talentSetId": "talent-set:alhaitham",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "alhaitham-normal-2-base-c0",
    "skillLabel": "普通攻击第 2 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.507495, 0.548802, 0.59011, 0.649121, 0.690429, 0.737638, 0.80255, 0.867462, 0.932374, 1.003187, 1.074, 1.144813, 1.215627, 1.28644, 1.357253],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/alhaitham/attack.go",
      "internal/characters/alhaitham/zz_alhaitham.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/alhaitham/alhaitham.go",
      "internal/characters/alhaitham/skill.go",
      "internal/characters/alhaitham/asc.go"
    ],
    "assumptions": [
      "C0；本输入全过程琢光镜数量为0，且无待结算的镜子生成或外部附魔；普通攻击本身不生成镜，零镜投影回调退出。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "alhaitham-normal-3-base-c0-hit-1",
    "characterSlug": "alhaitham",
    "talentSetId": "talent-set:alhaitham",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "alhaitham-normal-3-base-c0",
    "skillLabel": "普通攻击第 3 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.341785, 0.369605, 0.397425, 0.437167, 0.464987, 0.496781, 0.540498, 0.584215, 0.627931, 0.675622, 0.723313, 0.771004, 0.818696, 0.866387, 0.914077],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/alhaitham/attack.go",
      "internal/characters/alhaitham/zz_alhaitham.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/alhaitham/alhaitham.go",
      "internal/characters/alhaitham/skill.go",
      "internal/characters/alhaitham/asc.go"
    ],
    "assumptions": [
      "C0；本输入全过程琢光镜数量为0，且无待结算的镜子生成或外部附魔；普通攻击本身不生成镜，零镜投影回调退出。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "alhaitham-normal-3-base-c0-hit-2",
    "characterSlug": "alhaitham",
    "talentSetId": "talent-set:alhaitham",
    "abilityKey": "combat1",
    "parameterKey": "param4",
    "skillId": "alhaitham-normal-3-base-c0",
    "skillLabel": "普通攻击第 3 段（C0·来源条件）",
    "hitLabel": "第 2 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.341785, 0.369605, 0.397425, 0.437167, 0.464987, 0.496781, 0.540498, 0.584215, 0.627931, 0.675622, 0.723313, 0.771004, 0.818696, 0.866387, 0.914077],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/alhaitham/attack.go",
      "internal/characters/alhaitham/zz_alhaitham.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/alhaitham/alhaitham.go",
      "internal/characters/alhaitham/skill.go",
      "internal/characters/alhaitham/asc.go"
    ],
    "assumptions": [
      "C0；本输入全过程琢光镜数量为0，且无待结算的镜子生成或外部附魔；普通攻击本身不生成镜，零镜投影回调退出。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "alhaitham-normal-4-base-c0-hit-1",
    "characterSlug": "alhaitham",
    "talentSetId": "talent-set:alhaitham",
    "abilityKey": "combat1",
    "parameterKey": "param5",
    "skillId": "alhaitham-normal-4-base-c0",
    "skillLabel": "普通攻击第 4 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.667678, 0.722024, 0.77637, 0.854007, 0.908353, 0.970463, 1.055863, 1.141264, 1.226665, 1.319829, 1.412993, 1.506158, 1.599322, 1.692487, 1.785651],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/alhaitham/attack.go",
      "internal/characters/alhaitham/zz_alhaitham.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/alhaitham/alhaitham.go",
      "internal/characters/alhaitham/skill.go",
      "internal/characters/alhaitham/asc.go"
    ],
    "assumptions": [
      "C0；本输入全过程琢光镜数量为0，且无待结算的镜子生成或外部附魔；普通攻击本身不生成镜，零镜投影回调退出。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "alhaitham-normal-5-base-c0-hit-1",
    "characterSlug": "alhaitham",
    "talentSetId": "talent-set:alhaitham",
    "abilityKey": "combat1",
    "parameterKey": "param6",
    "skillId": "alhaitham-normal-5-base-c0",
    "skillLabel": "普通攻击第 5 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.838509, 0.906759, 0.97501, 1.072511, 1.140762, 1.218762, 1.326014, 1.433265, 1.540516, 1.657517, 1.774518, 1.891519, 2.008521, 2.125522, 2.242523],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/alhaitham/attack.go",
      "internal/characters/alhaitham/zz_alhaitham.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/alhaitham/alhaitham.go",
      "internal/characters/alhaitham/skill.go",
      "internal/characters/alhaitham/asc.go"
    ],
    "assumptions": [
      "C0；本输入全过程琢光镜数量为0，且无待结算的镜子生成或外部附魔；普通攻击本身不生成镜，零镜投影回调退出。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "xiao-charged-base-c0-hit-1",
    "characterSlug": "xiao",
    "talentSetId": "talent-set:xiao",
    "abilityKey": "combat1",
    "parameterKey": "param9",
    "skillId": "xiao-charged-base-c0",
    "skillLabel": "重击（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "charged",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.21088, 1.29344, 1.376, 1.48608, 1.56864, 1.66496, 1.7888, 1.91264, 2.03648, 2.16032, 2.28416, 2.408, 2.53184, 2.65568, 2.77952],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/xiao/charge.go",
      "internal/characters/xiao/zz_xiao.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/xiao/xiao.go",
      "internal/characters/xiao/burst.go",
      "internal/characters/xiao/asc.go"
    ],
    "assumptions": [
      "C0；Qoff且爆发附魔与增伤均未生效；无其他元素附魔。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "zhongli-normal-1-base-c0-hit-1",
    "characterSlug": "zhongli",
    "talentSetId": "talent-set:zhongli",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "zhongli-normal-1-base-c0",
    "skillLabel": "普通攻击第 1 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.307691, 0.332735, 0.35778, 0.393558, 0.418603, 0.447225, 0.486581, 0.525937, 0.565292, 0.608226, 0.657421, 0.715274, 0.773127, 0.83098, 0.894092],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/zhongli/attack.go",
      "internal/characters/zhongli/zz_zhongli.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/zhongli/asc.go",
      "internal/characters/zhongli/shield.go",
      "internal/characters/zhongli/zhongli.go"
    ],
    "assumptions": [
      "C0；玉璋护盾减抗未生效且无外部附魔；本动作不包含独立岩脊共鸣。",
      "炊金馔玉按显式突破等级判断；突破4及以上每个命中加入1.39%最大生命值，不按当前生命、不重复填作外部固定伤害。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true,
    "fixedTerms": [
      {
        "scalingStat": "hp",
        "coefficient": 0.0139,
        "sourceField": "internal/characters/zhongli/asc.go:a4Attacks",
        "minimumAscension": 4
      }
    ]
  },
  {
    "id": "zhongli-normal-2-base-c0-hit-1",
    "characterSlug": "zhongli",
    "talentSetId": "talent-set:zhongli",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "zhongli-normal-2-base-c0",
    "skillLabel": "普通攻击第 2 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.311518, 0.336874, 0.36223, 0.398453, 0.423809, 0.452788, 0.492633, 0.532478, 0.572323, 0.615791, 0.665598, 0.72417, 0.782743, 0.841315, 0.905213],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/zhongli/attack.go",
      "internal/characters/zhongli/zz_zhongli.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/zhongli/asc.go",
      "internal/characters/zhongli/shield.go",
      "internal/characters/zhongli/zhongli.go"
    ],
    "assumptions": [
      "C0；玉璋护盾减抗未生效且无外部附魔；本动作不包含独立岩脊共鸣。",
      "炊金馔玉按显式突破等级判断；突破4及以上每个命中加入1.39%最大生命值，不按当前生命、不重复填作外部固定伤害。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true,
    "fixedTerms": [
      {
        "scalingStat": "hp",
        "coefficient": 0.0139,
        "sourceField": "internal/characters/zhongli/asc.go:a4Attacks",
        "minimumAscension": 4
      }
    ]
  },
  {
    "id": "zhongli-normal-3-base-c0-hit-1",
    "characterSlug": "zhongli",
    "talentSetId": "talent-set:zhongli",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "zhongli-normal-3-base-c0",
    "skillLabel": "普通攻击第 3 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.385762, 0.417161, 0.44856, 0.493416, 0.524815, 0.5607, 0.610042, 0.659383, 0.708725, 0.762552, 0.824229, 0.896761, 0.969293, 1.041825, 1.120951],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/zhongli/attack.go",
      "internal/characters/zhongli/zz_zhongli.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/zhongli/asc.go",
      "internal/characters/zhongli/shield.go",
      "internal/characters/zhongli/zhongli.go"
    ],
    "assumptions": [
      "C0；玉璋护盾减抗未生效且无外部附魔；本动作不包含独立岩脊共鸣。",
      "炊金馔玉按显式突破等级判断；突破4及以上每个命中加入1.39%最大生命值，不按当前生命、不重复填作外部固定伤害。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true,
    "fixedTerms": [
      {
        "scalingStat": "hp",
        "coefficient": 0.0139,
        "sourceField": "internal/characters/zhongli/asc.go:a4Attacks",
        "minimumAscension": 4
      }
    ]
  },
  {
    "id": "zhongli-normal-4-base-c0-hit-1",
    "characterSlug": "zhongli",
    "talentSetId": "talent-set:zhongli",
    "abilityKey": "combat1",
    "parameterKey": "param4",
    "skillId": "zhongli-normal-4-base-c0",
    "skillLabel": "普通攻击第 4 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.429389, 0.46434, 0.49929, 0.549219, 0.584169, 0.624113, 0.679034, 0.733956, 0.788878, 0.848793, 0.917445, 0.998181, 1.078916, 1.159651, 1.247726],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/zhongli/attack.go",
      "internal/characters/zhongli/zz_zhongli.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/zhongli/asc.go",
      "internal/characters/zhongli/shield.go",
      "internal/characters/zhongli/zhongli.go"
    ],
    "assumptions": [
      "C0；玉璋护盾减抗未生效且无外部附魔；本动作不包含独立岩脊共鸣。",
      "炊金馔玉按显式突破等级判断；突破4及以上每个命中加入1.39%最大生命值，不按当前生命、不重复填作外部固定伤害。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true,
    "fixedTerms": [
      {
        "scalingStat": "hp",
        "coefficient": 0.0139,
        "sourceField": "internal/characters/zhongli/asc.go:a4Attacks",
        "minimumAscension": 4
      }
    ]
  },
  {
    "id": "zhongli-normal-5-base-c0-hit-1",
    "characterSlug": "zhongli",
    "talentSetId": "talent-set:zhongli",
    "abilityKey": "combat1",
    "parameterKey": "param5",
    "skillId": "zhongli-normal-5-base-c0",
    "skillLabel": "普通攻击第 5 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 4,
    "sourceCoefficientValues": [0.1075, 0.11625, 0.125, 0.1375, 0.14625, 0.15625, 0.17, 0.18375, 0.1975, 0.2125, 0.229687, 0.2499, 0.270112, 0.290325, 0.312375],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/zhongli/attack.go",
      "internal/characters/zhongli/zz_zhongli.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/zhongli/asc.go",
      "internal/characters/zhongli/shield.go",
      "internal/characters/zhongli/zhongli.go"
    ],
    "assumptions": [
      "C0；玉璋护盾减抗未生效且无外部附魔；本动作不包含独立岩脊共鸣。",
      "炊金馔玉按显式突破等级判断；突破4及以上每个命中加入1.39%最大生命值，不按当前生命、不重复填作外部固定伤害。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true,
    "fixedTerms": [
      {
        "scalingStat": "hp",
        "coefficient": 0.0139,
        "sourceField": "internal/characters/zhongli/asc.go:a4Attacks",
        "minimumAscension": 4
      }
    ]
  },
  {
    "id": "zhongli-normal-6-base-c0-hit-1",
    "characterSlug": "zhongli",
    "talentSetId": "talent-set:zhongli",
    "abilityKey": "combat1",
    "parameterKey": "param6",
    "skillId": "zhongli-normal-6-base-c0",
    "skillLabel": "普通攻击第 6 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.544965, 0.589322, 0.63368, 0.697048, 0.741406, 0.7921, 0.861805, 0.93151, 1.001214, 1.077256, 1.164387, 1.266853, 1.369319, 1.471785, 1.583566],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/zhongli/attack.go",
      "internal/characters/zhongli/zz_zhongli.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/zhongli/asc.go",
      "internal/characters/zhongli/shield.go",
      "internal/characters/zhongli/zhongli.go"
    ],
    "assumptions": [
      "C0；玉璋护盾减抗未生效且无外部附魔；本动作不包含独立岩脊共鸣。",
      "炊金馔玉按显式突破等级判断；突破4及以上每个命中加入1.39%最大生命值，不按当前生命、不重复填作外部固定伤害。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true,
    "fixedTerms": [
      {
        "scalingStat": "hp",
        "coefficient": 0.0139,
        "sourceField": "internal/characters/zhongli/asc.go:a4Attacks",
        "minimumAscension": 4
      }
    ]
  },
  {
    "id": "zhongli-charged-base-c0-hit-1",
    "characterSlug": "zhongli",
    "talentSetId": "talent-set:zhongli",
    "abilityKey": "combat1",
    "parameterKey": "param7",
    "skillId": "zhongli-charged-base-c0",
    "skillLabel": "重击（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "charged",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.11026, 1.20063, 1.291, 1.4201, 1.51047, 1.61375, 1.75576, 1.89777, 2.03978, 2.1947, 2.372212, 2.580967, 2.789722, 2.998477, 3.226209],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/zhongli/charge.go",
      "internal/characters/zhongli/zz_zhongli.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/zhongli/asc.go",
      "internal/characters/zhongli/shield.go",
      "internal/characters/zhongli/zhongli.go"
    ],
    "assumptions": [
      "C0；玉璋护盾减抗未生效且无外部附魔；本动作不包含独立岩脊共鸣。",
      "炊金馔玉按显式突破等级判断；突破4及以上每个命中加入1.39%最大生命值，不按当前生命、不重复填作外部固定伤害。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true,
    "fixedTerms": [
      {
        "scalingStat": "hp",
        "coefficient": 0.0139,
        "sourceField": "internal/characters/zhongli/asc.go:a4Attacks",
        "minimumAscension": 4
      }
    ]
  },
  {
    "id": "kamisatoayato-normal-1-base-c0-hit-1",
    "characterSlug": "kamisatoayato",
    "talentSetId": "talent-set:kamisatoayato",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "kamisatoayato-normal-1-base-c0",
    "skillLabel": "普通攻击第 1 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.449617, 0.486213, 0.52281, 0.575091, 0.611688, 0.653512, 0.711022, 0.768531, 0.82604, 0.888777, 0.951514, 1.014251, 1.076989, 1.139726, 1.202463],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/ayato/attack.go",
      "internal/characters/ayato/zz_kamisatoayato.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/ayato/ayato.go",
      "internal/characters/ayato/skill.go",
      "internal/characters/ayato/burst.go"
    ],
    "assumptions": [
      "C0；Eoff，不处于泷廻鉴花；Q领域及其普攻增伤未生效（Qoff），无外部附魔。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "kamisatoayato-normal-2-base-c0-hit-1",
    "characterSlug": "kamisatoayato",
    "talentSetId": "talent-set:kamisatoayato",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "kamisatoayato-normal-2-base-c0",
    "skillLabel": "普通攻击第 2 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.471572, 0.509956, 0.54834, 0.603174, 0.641558, 0.685425, 0.745742, 0.80606, 0.866377, 0.932178, 0.997979, 1.06378, 1.12958, 1.195381, 1.261182],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/ayato/attack.go",
      "internal/characters/ayato/zz_kamisatoayato.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/ayato/ayato.go",
      "internal/characters/ayato/skill.go",
      "internal/characters/ayato/burst.go"
    ],
    "assumptions": [
      "C0；Eoff，不处于泷廻鉴花；Q领域及其普攻增伤未生效（Qoff），无外部附魔。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "kamisatoayato-normal-3-base-c0-hit-1",
    "characterSlug": "kamisatoayato",
    "talentSetId": "talent-set:kamisatoayato",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "kamisatoayato-normal-3-base-c0",
    "skillLabel": "普通攻击第 3 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.586124, 0.633832, 0.68154, 0.749694, 0.797402, 0.851925, 0.926894, 1.001864, 1.076833, 1.158618, 1.240403, 1.322188, 1.403972, 1.485757, 1.567542],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/ayato/attack.go",
      "internal/characters/ayato/zz_kamisatoayato.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/ayato/ayato.go",
      "internal/characters/ayato/skill.go",
      "internal/characters/ayato/burst.go"
    ],
    "assumptions": [
      "C0；Eoff，不处于泷廻鉴花；Q领域及其普攻增伤未生效（Qoff），无外部附魔。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "kamisatoayato-normal-4-base-c0-hit-1",
    "characterSlug": "kamisatoayato",
    "talentSetId": "talent-set:kamisatoayato",
    "abilityKey": "combat1",
    "parameterKey": "param4",
    "skillId": "kamisatoayato-normal-4-base-c0",
    "skillLabel": "普通攻击第 4 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 2,
    "sourceCoefficientValues": [0.294485, 0.318455, 0.342425, 0.376667, 0.400637, 0.428031, 0.465698, 0.503365, 0.541031, 0.582122, 0.623213, 0.664304, 0.705395, 0.746487, 0.787577],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/ayato/attack.go",
      "internal/characters/ayato/zz_kamisatoayato.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/ayato/ayato.go",
      "internal/characters/ayato/skill.go",
      "internal/characters/ayato/burst.go"
    ],
    "assumptions": [
      "C0；Eoff，不处于泷廻鉴花；Q领域及其普攻增伤未生效（Qoff），无外部附魔。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "kamisatoayato-normal-5-base-c0-hit-1",
    "characterSlug": "kamisatoayato",
    "talentSetId": "talent-set:kamisatoayato",
    "abilityKey": "combat1",
    "parameterKey": "param5",
    "skillId": "kamisatoayato-normal-5-base-c0",
    "skillLabel": "普通攻击第 5 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.756043, 0.817582, 0.87912, 0.967032, 1.02857, 1.0989, 1.195603, 1.292306, 1.38901, 1.494504, 1.599998, 1.705493, 1.810987, 1.916482, 2.021976],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/ayato/attack.go",
      "internal/characters/ayato/zz_kamisatoayato.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/ayato/ayato.go",
      "internal/characters/ayato/skill.go",
      "internal/characters/ayato/burst.go"
    ],
    "assumptions": [
      "C0；Eoff，不处于泷廻鉴花；Q领域及其普攻增伤未生效（Qoff），无外部附魔。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "kamisatoayato-charged-base-c0-hit-1",
    "characterSlug": "kamisatoayato",
    "talentSetId": "talent-set:kamisatoayato",
    "abilityKey": "combat1",
    "parameterKey": "param6",
    "skillId": "kamisatoayato-charged-base-c0",
    "skillLabel": "重击（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "charged",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.295297, 1.400728, 1.506159, 1.656775, 1.762206, 1.882699, 2.048376, 2.214054, 2.379731, 2.56047, 2.741209, 2.921948, 3.102688, 3.283427, 3.464166],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/ayato/charge.go",
      "internal/characters/ayato/zz_kamisatoayato.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/ayato/ayato.go",
      "internal/characters/ayato/skill.go",
      "internal/characters/ayato/burst.go"
    ],
    "assumptions": [
      "C0；Eoff，不处于泷廻鉴花；Q领域及其普攻增伤未生效（Qoff），无外部附魔。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "kamisatoayaka-normal-1-base-c0-hit-1",
    "characterSlug": "kamisatoayaka",
    "talentSetId": "talent-set:kamisatoayaka",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "kamisatoayaka-normal-1-base-c0",
    "skillLabel": "普通攻击第 1 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.457253, 0.494472, 0.53169, 0.584859, 0.622077, 0.664613, 0.723098, 0.781584, 0.84007, 0.903873, 0.967676, 1.031479, 1.095281, 1.159084, 1.222887],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/ayaka/attack.go",
      "internal/characters/ayaka/zz_kamisatoayaka.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/ayaka/ayaka.go",
      "internal/characters/ayaka/dash.go",
      "internal/characters/ayaka/asc.go",
      "internal/characters/ayaka/cons.go"
    ],
    "assumptions": [
      "C0；冲刺冰附魔已经失效，施放E后的A1普攻/重击增伤未生效，无外部附魔。",
      "单个目标且范围内没有其他敌人或装置造成重叠伤害；重击的五目标搜索上限不等于单目标五次命中。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "kamisatoayaka-normal-2-base-c0-hit-1",
    "characterSlug": "kamisatoayaka",
    "talentSetId": "talent-set:kamisatoayaka",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "kamisatoayaka-normal-2-base-c0",
    "skillLabel": "普通攻击第 2 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.486846, 0.526473, 0.5661, 0.62271, 0.662337, 0.707625, 0.769896, 0.832167, 0.894438, 0.96237, 1.030302, 1.098234, 1.166166, 1.234098, 1.30203],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/ayaka/attack.go",
      "internal/characters/ayaka/zz_kamisatoayaka.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/ayaka/ayaka.go",
      "internal/characters/ayaka/dash.go",
      "internal/characters/ayaka/asc.go",
      "internal/characters/ayaka/cons.go"
    ],
    "assumptions": [
      "C0；冲刺冰附魔已经失效，施放E后的A1普攻/重击增伤未生效，无外部附魔。",
      "单个目标且范围内没有其他敌人或装置造成重叠伤害；重击的五目标搜索上限不等于单目标五次命中。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "kamisatoayaka-normal-3-base-c0-hit-1",
    "characterSlug": "kamisatoayaka",
    "talentSetId": "talent-set:kamisatoayaka",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "kamisatoayaka-normal-3-base-c0",
    "skillLabel": "普通攻击第 3 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.626218, 0.677189, 0.72816, 0.800976, 0.851947, 0.9102, 0.990298, 1.070395, 1.150493, 1.237872, 1.325251, 1.41263, 1.50001, 1.587389, 1.674768],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/ayaka/attack.go",
      "internal/characters/ayaka/zz_kamisatoayaka.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/ayaka/ayaka.go",
      "internal/characters/ayaka/dash.go",
      "internal/characters/ayaka/asc.go",
      "internal/characters/ayaka/cons.go"
    ],
    "assumptions": [
      "C0；冲刺冰附魔已经失效，施放E后的A1普攻/重击增伤未生效，无外部附魔。",
      "单个目标且范围内没有其他敌人或装置造成重叠伤害；重击的五目标搜索上限不等于单目标五次命中。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "kamisatoayaka-normal-4-base-c0-hit-1",
    "characterSlug": "kamisatoayaka",
    "talentSetId": "talent-set:kamisatoayaka",
    "abilityKey": "combat1",
    "parameterKey": "param4",
    "skillId": "kamisatoayaka-normal-4-base-c0",
    "skillLabel": "普通攻击第 4 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 3,
    "sourceCoefficientValues": [0.226464, 0.244897, 0.26333, 0.289663, 0.308096, 0.329163, 0.358129, 0.387095, 0.416061, 0.447661, 0.479261, 0.51086, 0.54246, 0.574059, 0.605659],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/ayaka/attack.go",
      "internal/characters/ayaka/zz_kamisatoayaka.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/ayaka/ayaka.go",
      "internal/characters/ayaka/dash.go",
      "internal/characters/ayaka/asc.go",
      "internal/characters/ayaka/cons.go"
    ],
    "assumptions": [
      "C0；冲刺冰附魔已经失效，施放E后的A1普攻/重击增伤未生效，无外部附魔。",
      "单个目标且范围内没有其他敌人或装置造成重叠伤害；重击的五目标搜索上限不等于单目标五次命中。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "kamisatoayaka-normal-5-base-c0-hit-1",
    "characterSlug": "kamisatoayaka",
    "talentSetId": "talent-set:kamisatoayaka",
    "abilityKey": "combat1",
    "parameterKey": "param7",
    "skillId": "kamisatoayaka-normal-5-base-c0",
    "skillLabel": "普通攻击第 5 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.781817, 0.845454, 0.90909, 0.999999, 1.063635, 1.136363, 1.236362, 1.336362, 1.436362, 1.545453, 1.654544, 1.763635, 1.872725, 1.981816, 2.090907],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/ayaka/attack.go",
      "internal/characters/ayaka/zz_kamisatoayaka.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/ayaka/ayaka.go",
      "internal/characters/ayaka/dash.go",
      "internal/characters/ayaka/asc.go",
      "internal/characters/ayaka/cons.go"
    ],
    "assumptions": [
      "C0；冲刺冰附魔已经失效，施放E后的A1普攻/重击增伤未生效，无外部附魔。",
      "单个目标且范围内没有其他敌人或装置造成重叠伤害；重击的五目标搜索上限不等于单目标五次命中。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "kamisatoayaka-charged-base-c0-hit-1",
    "characterSlug": "kamisatoayaka",
    "talentSetId": "talent-set:kamisatoayaka",
    "abilityKey": "combat1",
    "parameterKey": "param8",
    "skillId": "kamisatoayaka-charged-base-c0",
    "skillLabel": "重击（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "charged",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 3,
    "sourceCoefficientValues": [0.55126, 0.59613, 0.641, 0.7051, 0.74997, 0.80125, 0.87176, 0.94227, 1.01278, 1.0897, 1.16662, 1.24354, 1.32046, 1.39738, 1.4743],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/ayaka/charge.go",
      "internal/characters/ayaka/zz_kamisatoayaka.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/ayaka/ayaka.go",
      "internal/characters/ayaka/dash.go",
      "internal/characters/ayaka/asc.go",
      "internal/characters/ayaka/cons.go"
    ],
    "assumptions": [
      "C0；冲刺冰附魔已经失效，施放E后的A1普攻/重击增伤未生效，无外部附魔。",
      "单个目标且范围内没有其他敌人或装置造成重叠伤害；重击的五目标搜索上限不等于单目标五次命中。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "ningguang-normal-1-base-c0-hit-1",
    "characterSlug": "ningguang",
    "talentSetId": "talent-set:ningguang",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "ningguang-normal-1-base-c0",
    "skillLabel": "普通攻击·两枚宝石（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "geo",
    "scalingStat": "atk",
    "instanceCount": 2,
    "sourceCoefficientValues": [0.28, 0.301, 0.322, 0.35, 0.371, 0.392, 0.42, 0.448, 0.476, 0.504, 0.53312, 0.5712, 0.60928, 0.64736, 0.68544],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/ningguang/attack.go",
      "internal/characters/ningguang/zz_ningguang.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/ningguang/ningguang.go",
      "internal/characters/ningguang/asc.go"
    ],
    "assumptions": [
      "C0；穿过璇玑屏的A4岩伤若已生效，必须已包含在该命中最终伤害加成输入，不再自动添加。",
      "该输入两枚宝石均命中；命中后新增星璇不作为本次额外伤害，也不假定后续重击仍为零星璇。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "ningguang-charged-zero-jades-base-c0-hit-1",
    "characterSlug": "ningguang",
    "talentSetId": "talent-set:ningguang",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "ningguang-charged-zero-jades-base-c0",
    "skillLabel": "重击·零星璇（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "charged",
    "element": "geo",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.7408, 1.87136, 2.00192, 2.176, 2.30656, 2.43712, 2.6112, 2.78528, 2.95936, 3.13344, 3.314483, 3.551232, 3.787981, 4.02473, 4.261478],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/ningguang/charge.go",
      "internal/characters/ningguang/zz_ningguang.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/ningguang/ningguang.go",
      "internal/characters/ningguang/asc.go"
    ],
    "assumptions": [
      "C0；穿过璇玑屏的A4岩伤若已生效，必须已包含在该命中最终伤害加成输入，不再自动添加。",
      "起始星璇数量明确为0，因此没有星璇追加弹；不是普攻后默认的重击状态。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "yanfei-normal-1-base-c0-hit-1",
    "characterSlug": "yanfei",
    "talentSetId": "talent-set:yanfei",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "yanfei-normal-1-base-c0",
    "skillLabel": "普通攻击第 1 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "pyro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.583416, 0.627172, 0.670928, 0.72927, 0.773026, 0.816782, 0.875124, 0.933466, 0.991807, 1.050149, 1.10849, 1.166832, 1.239759, 1.312686, 1.385613],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/yanfei/attack.go",
      "internal/characters/yanfei/zz_yanfei.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/yanfei/yanfei.go",
      "internal/characters/yanfei/asc.go",
      "internal/characters/yanfei/charge.go",
      "internal/characters/yanfei/cons.go"
    ],
    "assumptions": [
      "C0；输入实际采用的最终火伤加成（含若已生效的A1），不自动重建先前重击消耗丹火印的历史。",
      "普攻命中生成丹火印只影响后续动作；本次不含重击、A4暴击重击追击。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "yanfei-normal-2-base-c0-hit-1",
    "characterSlug": "yanfei",
    "talentSetId": "talent-set:yanfei",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "yanfei-normal-2-base-c0",
    "skillLabel": "普通攻击第 2 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "pyro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.521256, 0.56035, 0.599444, 0.65157, 0.690664, 0.729758, 0.781884, 0.83401, 0.886135, 0.938261, 0.990386, 1.042512, 1.107669, 1.172826, 1.237983],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/yanfei/attack.go",
      "internal/characters/yanfei/zz_yanfei.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/yanfei/yanfei.go",
      "internal/characters/yanfei/asc.go",
      "internal/characters/yanfei/charge.go",
      "internal/characters/yanfei/cons.go"
    ],
    "assumptions": [
      "C0；输入实际采用的最终火伤加成（含若已生效的A1），不自动重建先前重击消耗丹火印的历史。",
      "普攻命中生成丹火印只影响后续动作；本次不含重击、A4暴击重击追击。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "yanfei-normal-3-base-c0-hit-1",
    "characterSlug": "yanfei",
    "talentSetId": "talent-set:yanfei",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "yanfei-normal-3-base-c0",
    "skillLabel": "普通攻击第 3 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "pyro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.760128, 0.817138, 0.874147, 0.95016, 1.00717, 1.064179, 1.140192, 1.216205, 1.292218, 1.36823, 1.444243, 1.520256, 1.615272, 1.710288, 1.805304],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/yanfei/attack.go",
      "internal/characters/yanfei/zz_yanfei.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/yanfei/yanfei.go",
      "internal/characters/yanfei/asc.go",
      "internal/characters/yanfei/charge.go",
      "internal/characters/yanfei/cons.go"
    ],
    "assumptions": [
      "C0；输入实际采用的最终火伤加成（含若已生效的A1），不自动重建先前重击消耗丹火印的历史。",
      "普攻命中生成丹火印只影响后续动作；本次不含重击、A4暴击重击追击。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "gaming-normal-1-base-c0-hit-1",
    "characterSlug": "gaming",
    "talentSetId": "talent-set:gaming",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "gaming-normal-1-base-c0",
    "skillLabel": "普通攻击第 1 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.83856, 0.906815, 0.97507, 1.072577, 1.140832, 1.218838, 1.326095, 1.433353, 1.540611, 1.657619, 1.774627, 1.891636, 2.008644, 2.125653, 2.242661],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/gaming/attack.go",
      "internal/characters/gaming/zz_gaming.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/gaming/gaming.go",
      "internal/characters/gaming/asc.go"
    ],
    "assumptions": [
      "C0；无外部附魔，且不将踏云献瑞或独立猊兽事件计入普通攻击。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "gaming-normal-2-base-c0-hit-1",
    "characterSlug": "gaming",
    "talentSetId": "talent-set:gaming",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "gaming-normal-2-base-c0",
    "skillLabel": "普通攻击第 2 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.790443, 0.854782, 0.91912, 1.011032, 1.07537, 1.1489, 1.250003, 1.351106, 1.45221, 1.562504, 1.672798, 1.783093, 1.893387, 2.003682, 2.113976],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/gaming/attack.go",
      "internal/characters/gaming/zz_gaming.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/gaming/gaming.go",
      "internal/characters/gaming/asc.go"
    ],
    "assumptions": [
      "C0；无外部附魔，且不将踏云献瑞或独立猊兽事件计入普通攻击。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "gaming-normal-3-base-c0-hit-1",
    "characterSlug": "gaming",
    "talentSetId": "talent-set:gaming",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "gaming-normal-3-base-c0",
    "skillLabel": "普通攻击第 3 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.06646, 1.153265, 1.24007, 1.364077, 1.450882, 1.550088, 1.686495, 1.822903, 1.959311, 2.108119, 2.256927, 2.405736, 2.554544, 2.703353, 2.852161],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/gaming/attack.go",
      "internal/characters/gaming/zz_gaming.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/gaming/gaming.go",
      "internal/characters/gaming/asc.go"
    ],
    "assumptions": [
      "C0；无外部附魔，且不将踏云献瑞或独立猊兽事件计入普通攻击。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "gaming-normal-4-base-c0-hit-1",
    "characterSlug": "gaming",
    "talentSetId": "talent-set:gaming",
    "abilityKey": "combat1",
    "parameterKey": "param4",
    "skillId": "gaming-normal-4-base-c0",
    "skillLabel": "普通攻击第 4 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.279491, 1.383635, 1.48778, 1.636558, 1.740703, 1.859725, 2.023381, 2.187037, 2.350692, 2.529226, 2.70776, 2.886293, 3.064827, 3.24336, 3.421894],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/gaming/attack.go",
      "internal/characters/gaming/zz_gaming.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/gaming/gaming.go",
      "internal/characters/gaming/asc.go"
    ],
    "assumptions": [
      "C0；无外部附魔，且不将踏云献瑞或独立猊兽事件计入普通攻击。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "aratakiitto-normal-1-base-c0-hit-1",
    "characterSlug": "aratakiitto",
    "talentSetId": "talent-set:aratakiitto",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "aratakiitto-normal-1-base-c0",
    "skillLabel": "普通攻击第 1 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.792318, 0.856809, 0.9213, 1.01343, 1.077921, 1.151625, 1.252968, 1.354311, 1.455654, 1.56621, 1.692889, 1.841863, 1.990837, 2.139811, 2.302329],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/itto/attack.go",
      "internal/characters/itto/zz_aratakiitto.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/itto/itto.go",
      "internal/characters/itto/asc.go",
      "internal/characters/itto/burst.go",
      "internal/characters/itto/cons.go"
    ],
    "assumptions": [
      "C0；Q状态、附魔与属性转换均未生效（Qoff），无外部附魔；输入为本命中实际采用的最终面板。",
      "本次动作起手至命中期间面板、增伤与目标条件保持不变；不声称固定源中仍有TODO的动态快照时点已验证。",
      "第2/4段会生成乱神怪力层数；该副作用不在此伤害映射中结算，后续重击必须重新声明层数。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "aratakiitto-normal-2-base-c0-hit-1",
    "characterSlug": "aratakiitto",
    "talentSetId": "talent-set:aratakiitto",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "aratakiitto-normal-2-base-c0",
    "skillLabel": "普通攻击第 2 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.76368, 0.82584, 0.888, 0.9768, 1.03896, 1.11, 1.20768, 1.30536, 1.40304, 1.5096, 1.6317, 1.77529, 1.918879, 2.062469, 2.219112],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/itto/attack.go",
      "internal/characters/itto/zz_aratakiitto.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/itto/itto.go",
      "internal/characters/itto/asc.go",
      "internal/characters/itto/burst.go",
      "internal/characters/itto/cons.go"
    ],
    "assumptions": [
      "C0；Q状态、附魔与属性转换均未生效（Qoff），无外部附魔；输入为本命中实际采用的最终面板。",
      "本次动作起手至命中期间面板、增伤与目标条件保持不变；不声称固定源中仍有TODO的动态快照时点已验证。",
      "第2/4段会生成乱神怪力层数；该副作用不在此伤害映射中结算，后续重击必须重新声明层数。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "aratakiitto-normal-3-base-c0-hit-1",
    "characterSlug": "aratakiitto",
    "talentSetId": "talent-set:aratakiitto",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "aratakiitto-normal-3-base-c0",
    "skillLabel": "普通攻击第 3 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.916416, 0.991008, 1.0656, 1.17216, 1.246752, 1.332, 1.449216, 1.566432, 1.683648, 1.81152, 1.95804, 2.130348, 2.302655, 2.474963, 2.662934],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/itto/attack.go",
      "internal/characters/itto/zz_aratakiitto.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/itto/itto.go",
      "internal/characters/itto/asc.go",
      "internal/characters/itto/burst.go",
      "internal/characters/itto/cons.go"
    ],
    "assumptions": [
      "C0；Q状态、附魔与属性转换均未生效（Qoff），无外部附魔；输入为本命中实际采用的最终面板。",
      "本次动作起手至命中期间面板、增伤与目标条件保持不变；不声称固定源中仍有TODO的动态快照时点已验证。",
      "第2/4段会生成乱神怪力层数；该副作用不在此伤害映射中结算，后续重击必须重新声明层数。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "aratakiitto-normal-4-base-c0-hit-1",
    "characterSlug": "aratakiitto",
    "talentSetId": "talent-set:aratakiitto",
    "abilityKey": "combat1",
    "parameterKey": "param4",
    "skillId": "aratakiitto-normal-4-base-c0",
    "skillLabel": "普通攻击第 4 段（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.172249, 1.267664, 1.36308, 1.499388, 1.594804, 1.70385, 1.853789, 2.003728, 2.153666, 2.317236, 2.504659, 2.72507, 2.94548, 3.16589, 3.406337],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/itto/attack.go",
      "internal/characters/itto/zz_aratakiitto.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/itto/itto.go",
      "internal/characters/itto/asc.go",
      "internal/characters/itto/burst.go",
      "internal/characters/itto/cons.go"
    ],
    "assumptions": [
      "C0；Q状态、附魔与属性转换均未生效（Qoff），无外部附魔；输入为本命中实际采用的最终面板。",
      "本次动作起手至命中期间面板、增伤与目标条件保持不变；不声称固定源中仍有TODO的动态快照时点已验证。",
      "第2/4段会生成乱神怪力层数；该副作用不在此伤害映射中结算，后续重击必须重新声明层数。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "furina-charged-base-c0-hit-1",
    "characterSlug": "furina",
    "talentSetId": "talent-set:furina",
    "abilityKey": "combat1",
    "parameterKey": "param5",
    "skillId": "furina-charged-base-c0",
    "skillLabel": "重击·始基力切换（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "charged",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.74218, 0.80259, 0.863, 0.9493, 1.00971, 1.07875, 1.17368, 1.26861, 1.36354, 1.4671, 1.57066, 1.67422, 1.77778, 1.88134, 1.9849],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/furina/charge.go",
      "internal/characters/furina/zz_furina.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/furina/furina.go",
      "internal/characters/furina/skill.go",
      "internal/characters/furina/cons.go",
      "internal/characters/furina/asc.go"
    ],
    "assumptions": [
      "C0；E召唤物未生效且Qoff，无外部附魔；只含物理重击，不触发普攻的始基力协同。",
      "重击后的始基力切换是状态变化，未由该条件伤害映射自动执行。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "aratakiitto-charged-zero-stacks-base-c0-hit-1",
    "characterSlug": "aratakiitto",
    "talentSetId": "talent-set:aratakiitto",
    "abilityKey": "combat1",
    "parameterKey": "param5",
    "skillId": "aratakiitto-charged-zero-stacks-base-c0",
    "skillLabel": "重击·零层左一文字（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "charged",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.90472, 0.97836, 1.052, 1.1572, 1.23084, 1.315, 1.43072, 1.54644, 1.66216, 1.7884, 1.93305, 2.103158, 2.273267, 2.443375, 2.628948],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/itto/charge.go",
      "internal/characters/itto/zz_aratakiitto.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/itto/itto.go",
      "internal/characters/itto/asc.go",
      "internal/characters/itto/burst.go",
      "internal/characters/itto/cons.go"
    ],
    "assumptions": [
      "C0；Q状态、附魔与属性转换均未生效（Qoff），无外部附魔；输入为本命中实际采用的最终面板。",
      "本次动作起手至命中期间面板、增伤与目标条件保持不变；不声称固定源中仍有TODO的动态快照时点已验证。",
      "乱神怪力起始为0，且当前不在逆袈裟左/右连斩中；从默认、左一文字或终结之后的基础起始分支执行。",
      "本分支为左一文字而非逆袈裟，不加入A4的35%防御值；有层数连斩和终结需另用对应定义。",
      "本输入的全部列出命中均击中同一目标；输入为对应命中实际使用的最终面板，不另加入装备/队友触发的其他伤害事件。"
    ],
    "exclusions": [
      "完整动作仅指已声明状态下的自身伤害；不认证附着、ICD、帧、取消、能量、资源变化或整套角色循环。"
    ],
    "completeAction": true
  }
];

export const additionalBaseStateAttackSourceEvidence = evidence;
