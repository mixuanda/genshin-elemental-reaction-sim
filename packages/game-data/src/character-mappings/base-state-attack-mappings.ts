import type { SourceHitMapping } from "./types";
import evidence from "../../sources/base-state-attacks/manifest.json";

/** Manually reviewed fixed-source base branches. No talent-label inference:
 * AttackInfo supplies physical element/Mult, enemy.calc supplies default ATK,
 * generated Go tables supply all 15 values. Burst/infusion/proc branches are
 * explicitly excluded by the recorded C0/Eoff/Qoff input assumptions.
 * Each normal input retains its emitted hit count; plunge is collision=0.
 */
export const baseStateAttackMappings: SourceHitMapping[] = [
  {
    "id": "diluc-normal-1-physical-c0-hit-1",
    "characterSlug": "diluc",
    "talentSetId": "talent-set:diluc",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "diluc-normal-1-physical-c0",
    "skillLabel": "普通攻击第 1 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.89698, 0.96999, 1.043, 1.1473, 1.22031, 1.30375, 1.41848, 1.53321, 1.64794, 1.7731, 1.916513, 2.085166, 2.253819, 2.422472, 2.606457],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/diluc/attack.go",
      "internal/characters/diluc/zz_diluc.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/diluc/diluc.go",
      "internal/characters/diluc/burst.go",
      "internal/characters/diluc/cons.go"
    ],
    "assumptions": [
      "C0；未处于黎明的火元素附魔状态（Qoff），且无其他元素附魔。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "diluc-normal-2-physical-c0-hit-1",
    "characterSlug": "diluc",
    "talentSetId": "talent-set:diluc",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "diluc-normal-2-physical-c0",
    "skillLabel": "普通攻击第 2 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.87634, 0.94767, 1.019, 1.1209, 1.19223, 1.27375, 1.38584, 1.49793, 1.61002, 1.7323, 1.872412, 2.037185, 2.201957, 2.366729, 2.546481],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/diluc/attack.go",
      "internal/characters/diluc/zz_diluc.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/diluc/diluc.go",
      "internal/characters/diluc/burst.go",
      "internal/characters/diluc/cons.go"
    ],
    "assumptions": [
      "C0；未处于黎明的火元素附魔状态（Qoff），且无其他元素附魔。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "diluc-normal-3-physical-c0-hit-1",
    "characterSlug": "diluc",
    "talentSetId": "talent-set:diluc",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "diluc-normal-3-physical-c0",
    "skillLabel": "普通攻击第 3 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.98814, 1.06857, 1.149, 1.2639, 1.34433, 1.43625, 1.56264, 1.68903, 1.81542, 1.9533, 2.111287, 2.297081, 2.482874, 2.668667, 2.871351],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/diluc/attack.go",
      "internal/characters/diluc/zz_diluc.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/diluc/diluc.go",
      "internal/characters/diluc/burst.go",
      "internal/characters/diluc/cons.go"
    ],
    "assumptions": [
      "C0；未处于黎明的火元素附魔状态（Qoff），且无其他元素附魔。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "diluc-normal-4-physical-c0-hit-1",
    "characterSlug": "diluc",
    "talentSetId": "talent-set:diluc",
    "abilityKey": "combat1",
    "parameterKey": "param4",
    "skillId": "diluc-normal-4-physical-c0",
    "skillLabel": "普通攻击第 4 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.33988, 1.44894, 1.558, 1.7138, 1.82286, 1.9475, 2.11888, 2.29026, 2.46164, 2.6486, 2.862825, 3.114754, 3.366682, 3.618611, 3.893442],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/diluc/attack.go",
      "internal/characters/diluc/zz_diluc.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/diluc/diluc.go",
      "internal/characters/diluc/burst.go",
      "internal/characters/diluc/cons.go"
    ],
    "assumptions": [
      "C0；未处于黎明的火元素附魔状态（Qoff），且无其他元素附魔。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "diluc-low-plunge-no-collision-physical-c0-hit-1",
    "characterSlug": "diluc",
    "talentSetId": "talent-set:diluc",
    "abilityKey": "combat1",
    "parameterKey": "param10",
    "skillId": "diluc-low-plunge-no-collision-physical-c0",
    "skillLabel": "低空下落攻击（C0·基础物理）",
    "hitLabel": "落地冲击",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.789728, 1.935403, 2.081079, 2.289187, 2.434862, 2.601349, 2.830267, 3.059186, 3.288105, 3.537834, 3.787564, 4.037293, 4.287023, 4.536752, 4.786482],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/diluc/plunge.go",
      "internal/characters/diluc/zz_diluc.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/diluc/diluc.go",
      "internal/characters/diluc/burst.go",
      "internal/characters/diluc/cons.go"
    ],
    "assumptions": [
      "C0；未处于黎明的火元素附魔状态（Qoff），且无其他元素附魔。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "已满足合法腾空前置条件并成功执行下落，collision=0；仅计算一次落地冲击，外部下落增伤需另行显式提供。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "diluc-high-plunge-no-collision-physical-c0-hit-1",
    "characterSlug": "diluc",
    "talentSetId": "talent-set:diluc",
    "abilityKey": "combat1",
    "parameterKey": "param11",
    "skillId": "diluc-high-plunge-no-collision-physical-c0",
    "skillLabel": "高空下落攻击（C0·基础物理）",
    "hitLabel": "落地冲击",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [2.235467, 2.417423, 2.59938, 2.859318, 3.041275, 3.249225, 3.535157, 3.821089, 4.10702, 4.418946, 4.730872, 5.042797, 5.354723, 5.666648, 5.978574],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/diluc/plunge.go",
      "internal/characters/diluc/zz_diluc.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/diluc/diluc.go",
      "internal/characters/diluc/burst.go",
      "internal/characters/diluc/cons.go"
    ],
    "assumptions": [
      "C0；未处于黎明的火元素附魔状态（Qoff），且无其他元素附魔。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "已满足合法腾空前置条件并成功执行下落，collision=0；仅计算一次落地冲击，外部下落增伤需另行显式提供。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "razor-normal-1-physical-c0-hit-1",
    "characterSlug": "razor",
    "talentSetId": "talent-set:razor",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "razor-normal-1-physical-c0",
    "skillLabel": "普通攻击第 1 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.9592, 1.0246, 1.09, 1.1772, 1.2426, 1.3189, 1.417, 1.5151, 1.6132, 1.7113, 1.8094, 1.9075, 2.0056, 2.1037, 2.2018],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/razor/attack.go",
      "internal/characters/razor/zz_razor.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/razor/razor.go",
      "internal/characters/razor/burst.go",
      "internal/characters/razor/cons.go"
    ],
    "assumptions": [
      "C0；雷牙未生效（Qoff），因此本输入不触发狼魂协同攻击。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "razor-normal-2-physical-c0-hit-1",
    "characterSlug": "razor",
    "talentSetId": "talent-set:razor",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "razor-normal-2-physical-c0",
    "skillLabel": "普通攻击第 2 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.82632, 0.88266, 0.939, 1.01412, 1.07046, 1.13619, 1.2207, 1.30521, 1.38972, 1.47423, 1.55874, 1.64325, 1.72776, 1.81227, 1.89678],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/razor/attack.go",
      "internal/characters/razor/zz_razor.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/razor/razor.go",
      "internal/characters/razor/burst.go",
      "internal/characters/razor/cons.go"
    ],
    "assumptions": [
      "C0；雷牙未生效（Qoff），因此本输入不触发狼魂协同攻击。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "razor-normal-3-physical-c0-hit-1",
    "characterSlug": "razor",
    "talentSetId": "talent-set:razor",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "razor-normal-3-physical-c0",
    "skillLabel": "普通攻击第 3 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.03312, 1.10356, 1.174, 1.26792, 1.33836, 1.42054, 1.5262, 1.63186, 1.73752, 1.84318, 1.94884, 2.0545, 2.16016, 2.26582, 2.37148],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/razor/attack.go",
      "internal/characters/razor/zz_razor.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/razor/razor.go",
      "internal/characters/razor/burst.go",
      "internal/characters/razor/cons.go"
    ],
    "assumptions": [
      "C0；雷牙未生效（Qoff），因此本输入不触发狼魂协同攻击。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "razor-normal-4-physical-c0-hit-1",
    "characterSlug": "razor",
    "talentSetId": "talent-set:razor",
    "abilityKey": "combat1",
    "parameterKey": "param4",
    "skillId": "razor-normal-4-physical-c0",
    "skillLabel": "普通攻击第 4 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.36048, 1.45324, 1.546, 1.66968, 1.76244, 1.87066, 2.0098, 2.14894, 2.28808, 2.42722, 2.56636, 2.7055, 2.84464, 2.98378, 3.12292],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/razor/attack.go",
      "internal/characters/razor/zz_razor.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/razor/razor.go",
      "internal/characters/razor/burst.go",
      "internal/characters/razor/cons.go"
    ],
    "assumptions": [
      "C0；雷牙未生效（Qoff），因此本输入不触发狼魂协同攻击。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "razor-low-plunge-no-collision-physical-c0-hit-1",
    "characterSlug": "razor",
    "talentSetId": "talent-set:razor",
    "abilityKey": "combat1",
    "parameterKey": "param10",
    "skillId": "razor-low-plunge-no-collision-physical-c0",
    "skillLabel": "低空下落攻击（C0·基础物理）",
    "hitLabel": "落地冲击",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.640584, 1.77412, 1.907656, 2.098421, 2.231957, 2.38457, 2.594412, 2.804254, 3.014096, 3.243015, 3.471933, 3.700852, 3.929771, 4.15869, 4.387608],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/razor/plunge.go",
      "internal/characters/razor/zz_razor.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/razor/razor.go",
      "internal/characters/razor/burst.go",
      "internal/characters/razor/cons.go"
    ],
    "assumptions": [
      "C0；雷牙未生效（Qoff），因此本输入不触发狼魂协同攻击。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "已满足合法腾空前置条件并成功执行下落，collision=0；仅计算一次落地冲击，外部下落增伤需另行显式提供。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "razor-high-plunge-no-collision-physical-c0-hit-1",
    "characterSlug": "razor",
    "talentSetId": "talent-set:razor",
    "abilityKey": "combat1",
    "parameterKey": "param11",
    "skillId": "razor-high-plunge-no-collision-physical-c0",
    "skillLabel": "高空下落攻击（C0·基础物理）",
    "hitLabel": "落地冲击",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [2.049178, 2.215971, 2.382765, 2.621042, 2.787835, 2.978456, 3.24056, 3.502665, 3.764769, 4.050701, 4.336632, 4.622564, 4.908496, 5.194428, 5.48036],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/razor/plunge.go",
      "internal/characters/razor/zz_razor.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/razor/razor.go",
      "internal/characters/razor/burst.go",
      "internal/characters/razor/cons.go"
    ],
    "assumptions": [
      "C0；雷牙未生效（Qoff），因此本输入不触发狼魂协同攻击。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "已满足合法腾空前置条件并成功执行下落，collision=0；仅计算一次落地冲击，外部下落增伤需另行显式提供。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "thoma-normal-1-physical-c0-hit-1",
    "characterSlug": "thoma",
    "talentSetId": "talent-set:thoma",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "thoma-normal-1-physical-c0",
    "skillLabel": "普通攻击第 1 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.443932, 0.480066, 0.5162, 0.56782, 0.603954, 0.64525, 0.702032, 0.758814, 0.815596, 0.87754, 0.939484, 1.001428, 1.063372, 1.125316, 1.18726],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/thoma/attack.go",
      "internal/characters/thoma/zz_thoma.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/thoma/thoma.go",
      "internal/characters/thoma/burst.go"
    ],
    "assumptions": [
      "C0；真红炽火之大铠未生效（Qoff），因此本输入不触发炽火崩破。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "thoma-normal-2-physical-c0-hit-1",
    "characterSlug": "thoma",
    "talentSetId": "talent-set:thoma",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "thoma-normal-2-physical-c0",
    "skillLabel": "普通攻击第 2 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.436278, 0.471789, 0.5073, 0.55803, 0.593541, 0.634125, 0.689928, 0.745731, 0.801534, 0.86241, 0.923286, 0.984162, 1.045038, 1.105914, 1.16679],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/thoma/attack.go",
      "internal/characters/thoma/zz_thoma.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/thoma/thoma.go",
      "internal/characters/thoma/burst.go"
    ],
    "assumptions": [
      "C0；真红炽火之大铠未生效（Qoff），因此本输入不触发炽火崩破。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "thoma-normal-3-physical-c0-hit-1",
    "characterSlug": "thoma",
    "talentSetId": "talent-set:thoma",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "thoma-normal-3-physical-c0",
    "skillLabel": "普通攻击第 3 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 2,
    "sourceCoefficientValues": [0.26789, 0.289695, 0.3115, 0.34265, 0.364455, 0.389375, 0.42364, 0.457905, 0.49217, 0.52955, 0.56693, 0.60431, 0.64169, 0.67907, 0.71645],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/thoma/attack.go",
      "internal/characters/thoma/zz_thoma.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/thoma/thoma.go",
      "internal/characters/thoma/burst.go"
    ],
    "assumptions": [
      "C0；真红炽火之大铠未生效（Qoff），因此本输入不触发炽火崩破。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "thoma-normal-4-physical-c0-hit-1",
    "characterSlug": "thoma",
    "talentSetId": "talent-set:thoma",
    "abilityKey": "combat1",
    "parameterKey": "param4",
    "skillId": "thoma-normal-4-physical-c0",
    "skillLabel": "普通攻击第 4 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.673552, 0.728376, 0.7832, 0.86152, 0.916344, 0.979, 1.065152, 1.151304, 1.237456, 1.33144, 1.425424, 1.519408, 1.613392, 1.707376, 1.80136],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/thoma/attack.go",
      "internal/characters/thoma/zz_thoma.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/thoma/thoma.go",
      "internal/characters/thoma/burst.go"
    ],
    "assumptions": [
      "C0；真红炽火之大铠未生效（Qoff），因此本输入不触发炽火崩破。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "thoma-charged-physical-c0-hit-1",
    "characterSlug": "thoma",
    "talentSetId": "talent-set:thoma",
    "abilityKey": "combat1",
    "parameterKey": "param5",
    "skillId": "thoma-charged-physical-c0",
    "skillLabel": "重击（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "charged",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.12746, 1.21923, 1.311, 1.4421, 1.53387, 1.63875, 1.78296, 1.92717, 2.07138, 2.2287, 2.38602, 2.54334, 2.70066, 2.85798, 3.0153],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/thoma/charge.go",
      "internal/characters/thoma/zz_thoma.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/thoma/thoma.go",
      "internal/characters/thoma/burst.go"
    ],
    "assumptions": [
      "C0；真红炽火之大铠未生效（Qoff），因此本输入不触发炽火崩破。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "chongyun-normal-1-physical-c0-hit-1",
    "characterSlug": "chongyun",
    "talentSetId": "talent-set:chongyun",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "chongyun-normal-1-physical-c0",
    "skillLabel": "普通攻击第 1 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.70004, 0.75702, 0.814, 0.8954, 0.95238, 1.0175, 1.10704, 1.19658, 1.28612, 1.3838, 1.48148, 1.57916, 1.67684, 1.77452, 1.8722],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/chongyun/attack.go",
      "internal/characters/chongyun/zz_chongyun.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/chongyun/chongyun.go",
      "internal/characters/chongyun/skill.go",
      "internal/characters/chongyun/cons.go"
    ],
    "assumptions": [
      "C0；不处于重华叠霜领域且残留冰附魔已失效（Eoff）；不产生C1末段三道冰刃。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "chongyun-normal-2-physical-c0-hit-1",
    "characterSlug": "chongyun",
    "talentSetId": "talent-set:chongyun",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "chongyun-normal-2-physical-c0",
    "skillLabel": "普通攻击第 2 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.63124, 0.68262, 0.734, 0.8074, 0.85878, 0.9175, 0.99824, 1.07898, 1.15972, 1.2478, 1.33588, 1.42396, 1.51204, 1.60012, 1.6882],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/chongyun/attack.go",
      "internal/characters/chongyun/zz_chongyun.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/chongyun/chongyun.go",
      "internal/characters/chongyun/skill.go",
      "internal/characters/chongyun/cons.go"
    ],
    "assumptions": [
      "C0；不处于重华叠霜领域且残留冰附魔已失效（Eoff）；不产生C1末段三道冰刃。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "chongyun-normal-3-physical-c0-hit-1",
    "characterSlug": "chongyun",
    "talentSetId": "talent-set:chongyun",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "chongyun-normal-3-physical-c0",
    "skillLabel": "普通攻击第 3 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.80324, 0.86862, 0.934, 1.0274, 1.09278, 1.1675, 1.27024, 1.37298, 1.47572, 1.5878, 1.69988, 1.81196, 1.92404, 2.03612, 2.1482],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/chongyun/attack.go",
      "internal/characters/chongyun/zz_chongyun.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/chongyun/chongyun.go",
      "internal/characters/chongyun/skill.go",
      "internal/characters/chongyun/cons.go"
    ],
    "assumptions": [
      "C0；不处于重华叠霜领域且残留冰附魔已失效（Eoff）；不产生C1末段三道冰刃。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "chongyun-normal-4-physical-c0-hit-1",
    "characterSlug": "chongyun",
    "talentSetId": "talent-set:chongyun",
    "abilityKey": "combat1",
    "parameterKey": "param4",
    "skillId": "chongyun-normal-4-physical-c0",
    "skillLabel": "普通攻击第 4 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.01222, 1.09461, 1.177, 1.2947, 1.37709, 1.47125, 1.60072, 1.73019, 1.85966, 2.0009, 2.14214, 2.28338, 2.42462, 2.56586, 2.7071],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/chongyun/attack.go",
      "internal/characters/chongyun/zz_chongyun.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/chongyun/chongyun.go",
      "internal/characters/chongyun/skill.go",
      "internal/characters/chongyun/cons.go"
    ],
    "assumptions": [
      "C0；不处于重华叠霜领域且残留冰附魔已失效（Eoff）；不产生C1末段三道冰刃。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "chongyun-low-plunge-no-collision-physical-c0-hit-1",
    "characterSlug": "chongyun",
    "talentSetId": "talent-set:chongyun",
    "abilityKey": "combat1",
    "parameterKey": "param10",
    "skillId": "chongyun-low-plunge-no-collision-physical-c0",
    "skillLabel": "低空下落攻击（C0·基础物理）",
    "hitLabel": "落地冲击",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.49144, 1.612836, 1.734233, 1.907656, 2.029052, 2.167791, 2.358556, 2.549322, 2.740087, 2.948195, 3.156303, 3.364411, 3.572519, 3.780627, 3.988735],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/chongyun/plunge.go",
      "internal/characters/chongyun/zz_chongyun.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/chongyun/chongyun.go",
      "internal/characters/chongyun/skill.go",
      "internal/characters/chongyun/cons.go"
    ],
    "assumptions": [
      "C0；不处于重华叠霜领域且残留冰附魔已失效（Eoff）；不产生C1末段三道冰刃。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "已满足合法腾空前置条件并成功执行下落，collision=0；仅计算一次落地冲击，外部下落增伤需另行显式提供。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "chongyun-high-plunge-no-collision-physical-c0-hit-1",
    "characterSlug": "chongyun",
    "talentSetId": "talent-set:chongyun",
    "abilityKey": "combat1",
    "parameterKey": "param11",
    "skillId": "chongyun-high-plunge-no-collision-physical-c0",
    "skillLabel": "高空下落攻击（C0·基础物理）",
    "hitLabel": "落地冲击",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.862889, 2.01452, 2.16615, 2.382765, 2.534396, 2.707688, 2.945964, 3.184241, 3.422517, 3.682455, 3.942393, 4.202331, 4.462269, 4.722207, 4.982145],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/chongyun/plunge.go",
      "internal/characters/chongyun/zz_chongyun.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/chongyun/chongyun.go",
      "internal/characters/chongyun/skill.go",
      "internal/characters/chongyun/cons.go"
    ],
    "assumptions": [
      "C0；不处于重华叠霜领域且残留冰附魔已失效（Eoff）；不产生C1末段三道冰刃。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "已满足合法腾空前置条件并成功执行下落，collision=0；仅计算一次落地冲击，外部下落增伤需另行显式提供。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "raidenshogun-normal-1-physical-c0-hit-1",
    "characterSlug": "raidenshogun",
    "talentSetId": "talent-set:raidenshogun",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "raidenshogun-normal-1-physical-c0",
    "skillLabel": "普通攻击第 1 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.39646, 0.42873, 0.461, 0.5071, 0.53937, 0.57625, 0.62696, 0.67767, 0.72838, 0.7837, 0.847087, 0.921631, 0.996175, 1.070719, 1.152039],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/raiden/attack.go",
      "internal/characters/raiden/zz_raidenshogun.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/raiden/raiden.go",
      "internal/characters/raiden/skill.go",
      "internal/characters/raiden/burst.go"
    ],
    "assumptions": [
      "C0；未处于梦想一心（Qoff），恶曜之眼亦未生效（Eoff）；采用长柄武器物理分支，不含协同攻击。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "raidenshogun-normal-2-physical-c0-hit-1",
    "characterSlug": "raidenshogun",
    "talentSetId": "talent-set:raidenshogun",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "raidenshogun-normal-2-physical-c0",
    "skillLabel": "普通攻击第 2 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.39732, 0.42966, 0.462, 0.5082, 0.54054, 0.5775, 0.62832, 0.67914, 0.72996, 0.7854, 0.848925, 0.92363, 0.998336, 1.073041, 1.154538],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/raiden/attack.go",
      "internal/characters/raiden/zz_raidenshogun.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/raiden/raiden.go",
      "internal/characters/raiden/skill.go",
      "internal/characters/raiden/burst.go"
    ],
    "assumptions": [
      "C0；未处于梦想一心（Qoff），恶曜之眼亦未生效（Eoff）；采用长柄武器物理分支，不含协同攻击。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "raidenshogun-normal-3-physical-c0-hit-1",
    "characterSlug": "raidenshogun",
    "talentSetId": "talent-set:raidenshogun",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "raidenshogun-normal-3-physical-c0",
    "skillLabel": "普通攻击第 3 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.4988, 0.5394, 0.58, 0.638, 0.6786, 0.725, 0.7888, 0.8526, 0.9164, 0.986, 1.06575, 1.159536, 1.253322, 1.347108, 1.44942],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/raiden/attack.go",
      "internal/characters/raiden/zz_raidenshogun.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/raiden/raiden.go",
      "internal/characters/raiden/skill.go",
      "internal/characters/raiden/burst.go"
    ],
    "assumptions": [
      "C0；未处于梦想一心（Qoff），恶曜之眼亦未生效（Eoff）；采用长柄武器物理分支，不含协同攻击。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "raidenshogun-normal-4-physical-c0-hit-1",
    "characterSlug": "raidenshogun",
    "talentSetId": "talent-set:raidenshogun",
    "abilityKey": "combat1",
    "parameterKey": "param4",
    "skillId": "raidenshogun-normal-4-physical-c0",
    "skillLabel": "普通攻击第 4 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.28982, 0.31341, 0.337, 0.3707, 0.39429, 0.42125, 0.45832, 0.49539, 0.53246, 0.5729, 0.619237, 0.67373, 0.728223, 0.782716, 0.842163],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/raiden/attack.go",
      "internal/characters/raiden/zz_raidenshogun.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/raiden/raiden.go",
      "internal/characters/raiden/skill.go",
      "internal/characters/raiden/burst.go"
    ],
    "assumptions": [
      "C0；未处于梦想一心（Qoff），恶曜之眼亦未生效（Eoff）；采用长柄武器物理分支，不含协同攻击。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "raidenshogun-normal-4-physical-c0-hit-2",
    "characterSlug": "raidenshogun",
    "talentSetId": "talent-set:raidenshogun",
    "abilityKey": "combat1",
    "parameterKey": "param5",
    "skillId": "raidenshogun-normal-4-physical-c0",
    "skillLabel": "普通攻击第 4 段（C0·基础物理）",
    "hitLabel": "第 2 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.28982, 0.31341, 0.337, 0.3707, 0.39429, 0.42125, 0.45832, 0.49539, 0.53246, 0.5729, 0.619237, 0.67373, 0.728223, 0.782716, 0.842163],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/raiden/attack.go",
      "internal/characters/raiden/zz_raidenshogun.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/raiden/raiden.go",
      "internal/characters/raiden/skill.go",
      "internal/characters/raiden/burst.go"
    ],
    "assumptions": [
      "C0；未处于梦想一心（Qoff），恶曜之眼亦未生效（Eoff）；采用长柄武器物理分支，不含协同攻击。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "raidenshogun-normal-5-physical-c0-hit-1",
    "characterSlug": "raidenshogun",
    "talentSetId": "talent-set:raidenshogun",
    "abilityKey": "combat1",
    "parameterKey": "param6",
    "skillId": "raidenshogun-normal-5-physical-c0",
    "skillLabel": "普通攻击第 5 段（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.65446, 0.70773, 0.761, 0.8371, 0.89037, 0.95125, 1.03496, 1.11867, 1.20238, 1.2937, 1.398338, 1.521391, 1.644445, 1.767499, 1.901739],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/raiden/attack.go",
      "internal/characters/raiden/zz_raidenshogun.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/raiden/raiden.go",
      "internal/characters/raiden/skill.go",
      "internal/characters/raiden/burst.go"
    ],
    "assumptions": [
      "C0；未处于梦想一心（Qoff），恶曜之眼亦未生效（Eoff）；采用长柄武器物理分支，不含协同攻击。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "raidenshogun-charged-physical-c0-hit-1",
    "characterSlug": "raidenshogun",
    "talentSetId": "talent-set:raidenshogun",
    "abilityKey": "combat1",
    "parameterKey": "param7",
    "skillId": "raidenshogun-charged-physical-c0",
    "skillLabel": "重击（C0·基础物理）",
    "hitLabel": "第 1 组命中",
    "attackTag": "charged",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.99588, 1.07694, 1.158, 1.2738, 1.35486, 1.4475, 1.57488, 1.70226, 1.82964, 1.9686, 2.127825, 2.315074, 2.502322, 2.689571, 2.893842],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/raiden/charge.go",
      "internal/characters/raiden/zz_raidenshogun.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/raiden/raiden.go",
      "internal/characters/raiden/skill.go",
      "internal/characters/raiden/burst.go"
    ],
    "assumptions": [
      "C0；未处于梦想一心（Qoff），恶曜之眼亦未生效（Eoff）；采用长柄武器物理分支，不含协同攻击。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "本输入的所有列出段数均命中选定目标。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "raidenshogun-low-plunge-no-collision-physical-c0-hit-1",
    "characterSlug": "raidenshogun",
    "talentSetId": "talent-set:raidenshogun",
    "abilityKey": "combat1",
    "parameterKey": "param10",
    "skillId": "raidenshogun-low-plunge-no-collision-physical-c0",
    "skillLabel": "低空下落攻击（C0·基础物理）",
    "hitLabel": "落地冲击",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.278377, 1.382431, 1.486485, 1.635134, 1.739187, 1.858106, 2.02162, 2.185133, 2.348646, 2.527025, 2.705403, 2.883781, 3.062159, 3.240537, 3.418915],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/raiden/plunge.go",
      "internal/characters/raiden/zz_raidenshogun.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/raiden/raiden.go",
      "internal/characters/raiden/skill.go",
      "internal/characters/raiden/burst.go"
    ],
    "assumptions": [
      "C0；未处于梦想一心（Qoff），恶曜之眼亦未生效（Eoff）；采用长柄武器物理分支，不含协同攻击。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "已满足合法腾空前置条件并成功执行下落，collision=0；仅计算一次落地冲击，外部下落增伤需另行显式提供。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  },
  {
    "id": "raidenshogun-high-plunge-no-collision-physical-c0-hit-1",
    "characterSlug": "raidenshogun",
    "talentSetId": "talent-set:raidenshogun",
    "abilityKey": "combat1",
    "parameterKey": "param11",
    "skillId": "raidenshogun-high-plunge-no-collision-physical-c0",
    "skillLabel": "高空下落攻击（C0·基础物理）",
    "hitLabel": "落地冲击",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.596762, 1.726731, 1.8567, 2.04237, 2.172339, 2.320875, 2.525112, 2.729349, 2.933586, 3.15639, 3.379194, 3.601998, 3.824802, 4.047606, 4.27041],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/raiden/plunge.go",
      "internal/characters/raiden/zz_raidenshogun.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/raiden/raiden.go",
      "internal/characters/raiden/skill.go",
      "internal/characters/raiden/burst.go"
    ],
    "assumptions": [
      "C0；未处于梦想一心（Qoff），恶曜之眼亦未生效（Eoff）；采用长柄武器物理分支，不含协同攻击。",
      "输入为该次命中的最终面板；不另行加入其他角色、装备或环境的伤害事件；无外部附魔。",
      "已满足合法腾空前置条件并成功执行下落，collision=0；仅计算一次落地冲击，外部下落增伤需另行显式提供。"
    ],
    "exclusions": [
      "不由本映射推断帧、取消窗口、体力、腾空过程、能量、附着或ICD；其他状态分支和命座另需定义。"
    ],
    "completeAction": true
  }
];

export const baseStateAttackSourceEvidence = evidence;
