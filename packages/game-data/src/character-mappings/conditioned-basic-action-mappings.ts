import type { SourceHitMapping } from "./types";
import evidence from "../../sources/conditioned-basic-actions/manifest.json";

/** Fixed-source complete self-damage inputs under explicit state predicates.
 * The ready Furina branch includes the Arkhe follow-up; the cooling-down branch
 * requires its current-alignment cooldown to remain active through impact.
 * Alhaitham requires zero mirrors AND A1 cooldown through every callback.
 */
export const conditionedBasicActionMappings: SourceHitMapping[] = [
  {
    "id": "kamisatoayato-low-plunge-no-collision-conditioned-c0-hit-1",
    "characterSlug": "kamisatoayato",
    "talentSetId": "talent-set:kamisatoayato",
    "abilityKey": "combat1",
    "parameterKey": "param9",
    "skillId": "kamisatoayato-low-plunge-no-collision-conditioned-c0",
    "skillLabel": "低空下落·无碰撞（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.278377, 1.382431, 1.486485, 1.635134, 1.739187, 1.858106, 2.02162, 2.185133, 2.348646, 2.527025, 2.705403, 2.883781, 3.062159, 3.240537, 3.418915],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/ayato/plunge.go",
      "internal/characters/ayato/zz_kamisatoayato.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/ayato/ayato.go",
      "internal/characters/ayato/skill.go",
      "internal/characters/ayato/burst.go",
      "internal/characters/ayato/asc.go"
    ],
    "assumptions": [
      "C0；Eoff，不处于泷廻鉴花，且无残留水影爆炸；Q领域未生效（Qoff），无外部附魔。",
      "合法腾空已满足（AirborneXianyun）；collision=0，目标未在下坠路径受到碰撞伤害，仅一次落地命中。",
      "本条件例中闲云等外部下落追加基础伤害及协同事件未生效；合法腾空不代表已计算这些加项。若实际生效，必须在完整计算上下文中另外恢复，不能仅以最终ATK代替。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "kamisatoayato-high-plunge-no-collision-conditioned-c0-hit-1",
    "characterSlug": "kamisatoayato",
    "talentSetId": "talent-set:kamisatoayato",
    "abilityKey": "combat1",
    "parameterKey": "param10",
    "skillId": "kamisatoayato-high-plunge-no-collision-conditioned-c0",
    "skillLabel": "高空下落·无碰撞（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.596762, 1.726731, 1.8567, 2.04237, 2.172339, 2.320875, 2.525112, 2.729349, 2.933586, 3.15639, 3.379194, 3.601998, 3.824802, 4.047606, 4.27041],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/ayato/plunge.go",
      "internal/characters/ayato/zz_kamisatoayato.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/ayato/ayato.go",
      "internal/characters/ayato/skill.go",
      "internal/characters/ayato/burst.go",
      "internal/characters/ayato/asc.go"
    ],
    "assumptions": [
      "C0；Eoff，不处于泷廻鉴花，且无残留水影爆炸；Q领域未生效（Qoff），无外部附魔。",
      "合法腾空已满足（AirborneXianyun）；collision=0，目标未在下坠路径受到碰撞伤害，仅一次落地命中。",
      "本条件例中闲云等外部下落追加基础伤害及协同事件未生效；合法腾空不代表已计算这些加项。若实际生效，必须在完整计算上下文中另外恢复，不能仅以最终ATK代替。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "kamisatoayaka-low-plunge-no-collision-conditioned-c0-hit-1",
    "characterSlug": "kamisatoayaka",
    "talentSetId": "talent-set:kamisatoayaka",
    "abilityKey": "combat1",
    "parameterKey": "param11",
    "skillId": "kamisatoayaka-low-plunge-no-collision-conditioned-c0",
    "skillLabel": "低空下落·无碰撞（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.278377, 1.382431, 1.486485, 1.635134, 1.739187, 1.858106, 2.02162, 2.185133, 2.348646, 2.527025, 2.705403, 2.883781, 3.062159, 3.240537, 3.418915],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/ayaka/plunge.go",
      "internal/characters/ayaka/zz_kamisatoayaka.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/ayaka/ayaka.go",
      "internal/characters/ayaka/dash.go",
      "internal/characters/ayaka/asc.go",
      "internal/characters/ayaka/cons.go"
    ],
    "assumptions": [
      "C0；冲刺冰附魔已经失效，无外部附魔；本物理下落不加A1的普攻/重击增伤，也不加仅冰伤适用的A4。",
      "合法腾空已满足（AirborneXianyun）；collision=0，目标未在下坠路径受到碰撞伤害，仅一次落地命中。",
      "本条件例中闲云等外部下落追加基础伤害及协同事件未生效；合法腾空不代表已计算这些加项。若实际生效，必须在完整计算上下文中另外恢复，不能仅以最终ATK代替。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "kamisatoayaka-high-plunge-no-collision-conditioned-c0-hit-1",
    "characterSlug": "kamisatoayaka",
    "talentSetId": "talent-set:kamisatoayaka",
    "abilityKey": "combat1",
    "parameterKey": "param12",
    "skillId": "kamisatoayaka-high-plunge-no-collision-conditioned-c0",
    "skillLabel": "高空下落·无碰撞（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.596762, 1.726731, 1.8567, 2.04237, 2.172339, 2.320875, 2.525112, 2.729349, 2.933586, 3.15639, 3.379194, 3.601998, 3.824802, 4.047606, 4.27041],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/ayaka/plunge.go",
      "internal/characters/ayaka/zz_kamisatoayaka.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/ayaka/ayaka.go",
      "internal/characters/ayaka/dash.go",
      "internal/characters/ayaka/asc.go",
      "internal/characters/ayaka/cons.go"
    ],
    "assumptions": [
      "C0；冲刺冰附魔已经失效，无外部附魔；本物理下落不加A1的普攻/重击增伤，也不加仅冰伤适用的A4。",
      "合法腾空已满足（AirborneXianyun）；collision=0，目标未在下坠路径受到碰撞伤害，仅一次落地命中。",
      "本条件例中闲云等外部下落追加基础伤害及协同事件未生效；合法腾空不代表已计算这些加项。若实际生效，必须在完整计算上下文中另外恢复，不能仅以最终ATK代替。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "yanfei-low-plunge-no-collision-conditioned-c0-hit-1",
    "characterSlug": "yanfei",
    "talentSetId": "talent-set:yanfei",
    "abilityKey": "combat1",
    "parameterKey": "param17",
    "skillId": "yanfei-low-plunge-no-collision-conditioned-c0",
    "skillLabel": "低空下落·无碰撞（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "plunge",
    "element": "pyro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.136335, 1.228828, 1.32132, 1.453452, 1.545944, 1.65165, 1.796995, 1.94234, 2.087686, 2.246244, 2.404802, 2.563361, 2.721919, 2.880478, 3.039036],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/yanfei/plunge.go",
      "internal/characters/yanfei/zz_yanfei.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/yanfei/yanfei.go",
      "internal/characters/yanfei/asc.go",
      "internal/characters/yanfei/charge.go",
      "internal/characters/yanfei/cons.go"
    ],
    "assumptions": [
      "C0；火伤加成输入为本命中实际最终值，若A1仍有效须已包含；下落不消耗丹火印、不触发重击的A4暴击追击。",
      "合法腾空已满足（AirborneXianyun）；collision=0，目标未在下坠路径受到碰撞伤害，仅一次落地命中。",
      "本条件例中闲云等外部下落追加基础伤害及协同事件未生效；合法腾空不代表已计算这些加项。若实际生效，必须在完整计算上下文中另外恢复，不能仅以最终ATK代替。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "yanfei-high-plunge-no-collision-conditioned-c0-hit-1",
    "characterSlug": "yanfei",
    "talentSetId": "talent-set:yanfei",
    "abilityKey": "combat1",
    "parameterKey": "param18",
    "skillId": "yanfei-high-plunge-no-collision-conditioned-c0",
    "skillLabel": "高空下落·无碰撞（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "plunge",
    "element": "pyro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.419344, 1.534872, 1.6504, 1.81544, 1.930968, 2.063, 2.244544, 2.426088, 2.607632, 2.80568, 3.003728, 3.201776, 3.399824, 3.597872, 3.79592],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/yanfei/plunge.go",
      "internal/characters/yanfei/zz_yanfei.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/yanfei/yanfei.go",
      "internal/characters/yanfei/asc.go",
      "internal/characters/yanfei/charge.go",
      "internal/characters/yanfei/cons.go"
    ],
    "assumptions": [
      "C0；火伤加成输入为本命中实际最终值，若A1仍有效须已包含；下落不消耗丹火印、不触发重击的A4暴击追击。",
      "合法腾空已满足（AirborneXianyun）；collision=0，目标未在下坠路径受到碰撞伤害，仅一次落地命中。",
      "本条件例中闲云等外部下落追加基础伤害及协同事件未生效；合法腾空不代表已计算这些加项。若实际生效，必须在完整计算上下文中另外恢复，不能仅以最终ATK代替。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "gaming-low-plunge-no-collision-conditioned-c0-hit-1",
    "characterSlug": "gaming",
    "talentSetId": "talent-set:gaming",
    "abilityKey": "combat1",
    "parameterKey": "param10",
    "skillId": "gaming-low-plunge-no-collision-conditioned-c0",
    "skillLabel": "低空下落·无碰撞（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.282638, 1.387039, 1.49144, 1.640584, 1.744985, 1.8643, 2.028358, 2.192417, 2.356475, 2.535448, 2.714421, 2.893394, 3.072366, 3.251339, 3.430312],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/gaming/plunge.go",
      "internal/characters/gaming/zz_gaming.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/gaming/gaming.go",
      "internal/characters/gaming/asc.go",
      "internal/characters/gaming/burst.go",
      "internal/characters/gaming/cons.go"
    ],
    "assumptions": [
      "C0、Qoff，无未结算的猊兽事件或外部附魔；上一动作不是元素战技（LastAction != Skill），因此进入普通物理落地分支而非踏云献瑞。",
      "普通下落不满足specialPlungeKey，不加入A4仅对踏云献瑞的20%增伤。",
      "合法腾空已满足（AirborneXianyun）；collision=0，目标未在下坠路径受到碰撞伤害，仅一次落地命中。",
      "本条件例中闲云等外部下落追加基础伤害及协同事件未生效；合法腾空不代表已计算这些加项。若实际生效，必须在完整计算上下文中另外恢复，不能仅以最终ATK代替。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "gaming-high-plunge-no-collision-conditioned-c0-hit-1",
    "characterSlug": "gaming",
    "talentSetId": "talent-set:gaming",
    "abilityKey": "combat1",
    "parameterKey": "param11",
    "skillId": "gaming-high-plunge-no-collision-conditioned-c0",
    "skillLabel": "高空下落·无碰撞（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.602085, 1.732488, 1.86289, 2.049179, 2.179581, 2.328612, 2.53353, 2.738448, 2.943366, 3.166913, 3.39046, 3.614007, 3.837553, 4.0611, 4.284647],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/gaming/plunge.go",
      "internal/characters/gaming/zz_gaming.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/gaming/gaming.go",
      "internal/characters/gaming/asc.go",
      "internal/characters/gaming/burst.go",
      "internal/characters/gaming/cons.go"
    ],
    "assumptions": [
      "C0、Qoff，无未结算的猊兽事件或外部附魔；上一动作不是元素战技（LastAction != Skill），因此进入普通物理落地分支而非踏云献瑞。",
      "普通下落不满足specialPlungeKey，不加入A4仅对踏云献瑞的20%增伤。",
      "合法腾空已满足（AirborneXianyun）；collision=0，目标未在下坠路径受到碰撞伤害，仅一次落地命中。",
      "本条件例中闲云等外部下落追加基础伤害及协同事件未生效；合法腾空不代表已计算这些加项。若实际生效，必须在完整计算上下文中另外恢复，不能仅以最终ATK代替。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "furina-low-plunge-no-collision-conditioned-c0-hit-1",
    "characterSlug": "furina",
    "talentSetId": "talent-set:furina",
    "abilityKey": "combat1",
    "parameterKey": "param8",
    "skillId": "furina-low-plunge-no-collision-conditioned-c0",
    "skillLabel": "低空下落·无碰撞（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.278377, 1.382431, 1.486485, 1.635134, 1.739187, 1.858106, 2.02162, 2.185133, 2.348646, 2.527025, 2.705403, 2.883781, 3.062159, 3.240537, 3.418915],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/furina/plunge.go",
      "internal/characters/furina/zz_furina.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/furina/furina.go",
      "internal/characters/furina/attack.go",
      "internal/characters/furina/asc.go",
      "internal/characters/furina/cons.go",
      "internal/characters/furina/skill.go"
    ],
    "assumptions": [
      "C0；E召唤物未生效且Qoff，无外部附魔或先前已排队的始基力伤害；本命中实际采用的最终面板与目标状态已恢复。",
      "合法腾空已满足（AirborneXianyun）；collision=0，目标未在下坠路径受到碰撞伤害，仅一次落地命中。",
      "本条件例中闲云等外部下落追加基础伤害及协同事件未生效；合法腾空不代表已计算这些加项。若实际生效，必须在完整计算上下文中另外恢复，不能仅以最终ATK代替。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "furina-high-plunge-no-collision-conditioned-c0-hit-1",
    "characterSlug": "furina",
    "talentSetId": "talent-set:furina",
    "abilityKey": "combat1",
    "parameterKey": "param9",
    "skillId": "furina-high-plunge-no-collision-conditioned-c0",
    "skillLabel": "高空下落·无碰撞（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.596762, 1.726731, 1.8567, 2.04237, 2.172339, 2.320875, 2.525112, 2.729349, 2.933586, 3.15639, 3.379194, 3.601998, 3.824802, 4.047606, 4.27041],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/furina/plunge.go",
      "internal/characters/furina/zz_furina.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/furina/furina.go",
      "internal/characters/furina/attack.go",
      "internal/characters/furina/asc.go",
      "internal/characters/furina/cons.go",
      "internal/characters/furina/skill.go"
    ],
    "assumptions": [
      "C0；E召唤物未生效且Qoff，无外部附魔或先前已排队的始基力伤害；本命中实际采用的最终面板与目标状态已恢复。",
      "合法腾空已满足（AirborneXianyun）；collision=0，目标未在下坠路径受到碰撞伤害，仅一次落地命中。",
      "本条件例中闲云等外部下落追加基础伤害及协同事件未生效；合法腾空不代表已计算这些加项。若实际生效，必须在完整计算上下文中另外恢复，不能仅以最终ATK代替。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "xiao-low-plunge-no-collision-conditioned-c0-hit-1",
    "characterSlug": "xiao",
    "talentSetId": "talent-set:xiao",
    "abilityKey": "combat1",
    "parameterKey": "param12",
    "skillId": "xiao-low-plunge-no-collision-conditioned-c0",
    "skillLabel": "低空下落·无碰撞（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.636323, 1.769512, 1.902701, 2.092971, 2.22616, 2.378376, 2.587673, 2.79697, 3.006267, 3.234591, 3.462915, 3.69124, 3.919564, 4.147888, 4.376212],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/xiao/plunge.go",
      "internal/characters/xiao/zz_xiao.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/xiao/xiao.go",
      "internal/characters/xiao/jump.go",
      "internal/characters/xiao/burst.go",
      "internal/characters/xiao/asc.go",
      "internal/characters/xiao/cons.go"
    ],
    "assumptions": [
      "C0；Qoff且爆发附魔、爆发增伤和A1残留增伤均未生效，无外部附魔。",
      "角色已跳跃并处于JumpState，XianyunAirborneBuff有效；明确采用该分支，不采用默认假定爆发开启的跳跃分支。",
      "合法腾空已满足（JumpState且XianyunAirborneBuff有效）；collision=0，目标未在下坠路径受到碰撞伤害，仅一次落地命中。",
      "本条件例中闲云等外部下落追加基础伤害及协同事件未生效；合法腾空不代表已计算这些加项。若实际生效，必须在完整计算上下文中另外恢复，不能仅以最终ATK代替。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "xiao-high-plunge-no-collision-conditioned-c0-hit-1",
    "characterSlug": "xiao",
    "talentSetId": "talent-set:xiao",
    "abilityKey": "combat1",
    "parameterKey": "param13",
    "skillId": "xiao-high-plunge-no-collision-conditioned-c0",
    "skillLabel": "高空下落·无碰撞（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [2.043855, 2.210216, 2.376576, 2.614234, 2.780594, 2.97072, 3.232143, 3.493567, 3.75499, 4.040179, 4.325368, 4.610557, 4.895747, 5.180936, 5.466125],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/xiao/plunge.go",
      "internal/characters/xiao/zz_xiao.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/xiao/xiao.go",
      "internal/characters/xiao/jump.go",
      "internal/characters/xiao/burst.go",
      "internal/characters/xiao/asc.go",
      "internal/characters/xiao/cons.go"
    ],
    "assumptions": [
      "C0；Qoff且爆发附魔、爆发增伤和A1残留增伤均未生效，无外部附魔。",
      "角色已跳跃并处于JumpState，XianyunAirborneBuff有效；明确采用该分支，不采用默认假定爆发开启的跳跃分支。",
      "合法腾空已满足（JumpState且XianyunAirborneBuff有效）；collision=0，目标未在下坠路径受到碰撞伤害，仅一次落地命中。",
      "本条件例中闲云等外部下落追加基础伤害及协同事件未生效；合法腾空不代表已计算这些加项。若实际生效，必须在完整计算上下文中另外恢复，不能仅以最终ATK代替。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "aratakiitto-low-plunge-no-collision-conditioned-c0-hit-1",
    "characterSlug": "aratakiitto",
    "talentSetId": "talent-set:aratakiitto",
    "abilityKey": "combat1",
    "parameterKey": "param10",
    "skillId": "aratakiitto-low-plunge-no-collision-conditioned-c0",
    "skillLabel": "低空下落·无碰撞（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.636323, 1.769512, 1.902701, 2.092971, 2.22616, 2.378376, 2.587673, 2.79697, 3.006267, 3.234591, 3.462915, 3.69124, 3.919564, 4.147888, 4.376212],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/itto/plunge.go",
      "internal/characters/itto/zz_aratakiitto.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/itto/itto.go",
      "internal/characters/itto/burst.go",
      "internal/characters/itto/asc.go",
      "internal/characters/itto/charge.go"
    ],
    "assumptions": [
      "C0；Q状态、附魔与防御转攻击均未生效（Qoff），无外部附魔；下落不属于荒泷逆袈裟，不加入A4的35%防御加值。",
      "合法腾空已满足（AirborneXianyun）；collision=0，目标未在下坠路径受到碰撞伤害，仅一次落地命中。",
      "本条件例中闲云等外部下落追加基础伤害及协同事件未生效；合法腾空不代表已计算这些加项。若实际生效，必须在完整计算上下文中另外恢复，不能仅以最终ATK代替。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "aratakiitto-high-plunge-no-collision-conditioned-c0-hit-1",
    "characterSlug": "aratakiitto",
    "talentSetId": "talent-set:aratakiitto",
    "abilityKey": "combat1",
    "parameterKey": "param11",
    "skillId": "aratakiitto-high-plunge-no-collision-conditioned-c0",
    "skillLabel": "高空下落·无碰撞（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [2.043855, 2.210216, 2.376576, 2.614234, 2.780594, 2.97072, 3.232143, 3.493567, 3.75499, 4.040179, 4.325368, 4.610557, 4.895747, 5.180936, 5.466125],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/itto/plunge.go",
      "internal/characters/itto/zz_aratakiitto.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/itto/itto.go",
      "internal/characters/itto/burst.go",
      "internal/characters/itto/asc.go",
      "internal/characters/itto/charge.go"
    ],
    "assumptions": [
      "C0；Q状态、附魔与防御转攻击均未生效（Qoff），无外部附魔；下落不属于荒泷逆袈裟，不加入A4的35%防御加值。",
      "合法腾空已满足（AirborneXianyun）；collision=0，目标未在下坠路径受到碰撞伤害，仅一次落地命中。",
      "本条件例中闲云等外部下落追加基础伤害及协同事件未生效；合法腾空不代表已计算这些加项。若实际生效，必须在完整计算上下文中另外恢复，不能仅以最终ATK代替。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "alhaitham-low-plunge-no-collision-conditioned-c0-hit-1",
    "characterSlug": "alhaitham",
    "talentSetId": "talent-set:alhaitham",
    "abilityKey": "combat1",
    "parameterKey": "param11",
    "skillId": "alhaitham-low-plunge-no-collision-conditioned-c0",
    "skillLabel": "低空下落·无碰撞（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.278377, 1.382431, 1.486485, 1.635134, 1.739187, 1.858106, 2.02162, 2.185133, 2.348646, 2.527025, 2.705403, 2.883781, 3.062159, 3.240537, 3.418915],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/alhaitham/plunge.go",
      "internal/characters/alhaitham/zz_alhaitham.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/alhaitham/alhaitham.go",
      "internal/characters/alhaitham/skill.go",
      "internal/characters/alhaitham/asc.go"
    ],
    "assumptions": [
      "C0；起手至最后命中全过程mirrorCount=0，且无待结算的新镜生成或外部附魔。",
      "A1的alhaitham-a1-icd在起手至最后命中持续有效，所有命中回调时Core.Status.Duration > 0；A1先返回，随后投影攻击因零镜返回。仅起始零镜不足以满足该分支。",
      "合法腾空已满足（AirborneXianyun）；collision=0，目标未在下坠路径受到碰撞伤害，仅一次落地命中。",
      "本条件例中闲云等外部下落追加基础伤害及协同事件未生效；合法腾空不代表已计算这些加项。若实际生效，必须在完整计算上下文中另外恢复，不能仅以最终ATK代替。",
      "上一动作不是长按元素战技（LastAction Skill且hold=1不成立），不进入固定草元素的技能后低空下落分支。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "alhaitham-high-plunge-no-collision-conditioned-c0-hit-1",
    "characterSlug": "alhaitham",
    "talentSetId": "talent-set:alhaitham",
    "abilityKey": "combat1",
    "parameterKey": "param12",
    "skillId": "alhaitham-high-plunge-no-collision-conditioned-c0",
    "skillLabel": "高空下落·无碰撞（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "plunge",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [1.596762, 1.726731, 1.8567, 2.04237, 2.172339, 2.320875, 2.525112, 2.729349, 2.933586, 3.15639, 3.379194, 3.601998, 3.824802, 4.047606, 4.27041],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/alhaitham/plunge.go",
      "internal/characters/alhaitham/zz_alhaitham.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/alhaitham/alhaitham.go",
      "internal/characters/alhaitham/skill.go",
      "internal/characters/alhaitham/asc.go"
    ],
    "assumptions": [
      "C0；起手至最后命中全过程mirrorCount=0，且无待结算的新镜生成或外部附魔。",
      "A1的alhaitham-a1-icd在起手至最后命中持续有效，所有命中回调时Core.Status.Duration > 0；A1先返回，随后投影攻击因零镜返回。仅起始零镜不足以满足该分支。",
      "合法腾空已满足（AirborneXianyun）；collision=0，目标未在下坠路径受到碰撞伤害，仅一次落地命中。",
      "本条件例中闲云等外部下落追加基础伤害及协同事件未生效；合法腾空不代表已计算这些加项。若实际生效，必须在完整计算上下文中另外恢复，不能仅以最终ATK代替。",
      "上一动作不是长按元素战技（LastAction Skill且hold=1不成立），不进入固定草元素的技能后低空下落分支。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "furina-normal-1-arkhe-cooldown-conditioned-c0-hit-1",
    "characterSlug": "furina",
    "talentSetId": "talent-set:furina",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "furina-normal-1-arkhe-cooldown-conditioned-c0",
    "skillLabel": "普通攻击第 1 段·始基力冷却中（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.483862, 0.523246, 0.56263, 0.618893, 0.658277, 0.703287, 0.765177, 0.827066, 0.888955, 0.956471, 1.023987, 1.091502, 1.159018, 1.226533, 1.294049],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/furina/attack.go",
      "internal/characters/furina/zz_furina.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/furina/furina.go",
      "internal/characters/furina/asc.go",
      "internal/characters/furina/cons.go",
      "internal/characters/furina/skill.go"
    ],
    "assumptions": [
      "C0；E召唤物未生效且Qoff，无外部附魔或先前已排队的始基力伤害；本命中实际采用的最终面板与目标状态已恢复。",
      "始基力从起手至最后命中保持不变，目标处于本次所有攻击的命中范围内。",
      "当前始基力对应的独立6秒冷却在起手至本次普攻命中回调时持续有效；arkheCB因此提前返回，没有本次始基力水伤。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "furina-normal-1-arkhe-ready-conditioned-c0-hit-1",
    "characterSlug": "furina",
    "talentSetId": "talent-set:furina",
    "abilityKey": "combat1",
    "parameterKey": "param1",
    "skillId": "furina-normal-1-arkhe-ready-conditioned-c0",
    "skillLabel": "普通攻击第 1 段·始基力就绪（含水伤）（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.483862, 0.523246, 0.56263, 0.618893, 0.658277, 0.703287, 0.765177, 0.827066, 0.888955, 0.956471, 1.023987, 1.091502, 1.159018, 1.226533, 1.294049],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/furina/attack.go",
      "internal/characters/furina/zz_furina.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/furina/furina.go",
      "internal/characters/furina/asc.go",
      "internal/characters/furina/cons.go",
      "internal/characters/furina/skill.go"
    ],
    "assumptions": [
      "C0；E召唤物未生效且Qoff，无外部附魔或先前已排队的始基力伤害；本命中实际采用的最终面板与目标状态已恢复。",
      "始基力从起手至最后命中保持不变，目标处于本次所有攻击的命中范围内。",
      "当前始基力对应的独立6秒冷却在普攻命中时已就绪；该次输入包括物理普攻及其30帧后生成的一次始基力水伤，不能只计物理主击。",
      "始基力水伤源为Durability=0、IgnoreInfusion=true：不造成常规水附着，不继承普通水伤的反应资格；该命中的反应必须恢复为none。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "furina-normal-1-arkhe-ready-conditioned-c0-hit-2",
    "characterSlug": "furina",
    "talentSetId": "talent-set:furina",
    "abilityKey": "combat1",
    "parameterKey": "param10",
    "skillId": "furina-normal-1-arkhe-ready-conditioned-c0",
    "skillLabel": "普通攻击第 1 段·始基力就绪（含水伤）（C0·来源条件）",
    "hitLabel": "始基力追加水伤",
    "attackTag": "normal",
    "element": "hydro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.0946, 0.1023, 0.11, 0.121, 0.1287, 0.1375, 0.1496, 0.1617, 0.1738, 0.187, 0.2002, 0.2134, 0.2266, 0.2398, 0.253],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/furina/attack.go",
      "internal/characters/furina/zz_furina.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/furina/furina.go",
      "internal/characters/furina/asc.go",
      "internal/characters/furina/cons.go",
      "internal/characters/furina/skill.go"
    ],
    "assumptions": [
      "C0；E召唤物未生效且Qoff，无外部附魔或先前已排队的始基力伤害；本命中实际采用的最终面板与目标状态已恢复。",
      "始基力从起手至最后命中保持不变，目标处于本次所有攻击的命中范围内。",
      "当前始基力对应的独立6秒冷却在普攻命中时已就绪；该次输入包括物理普攻及其30帧后生成的一次始基力水伤，不能只计物理主击。",
      "始基力水伤源为Durability=0、IgnoreInfusion=true：不造成常规水附着，不继承普通水伤的反应资格；该命中的反应必须恢复为none。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "furina-normal-2-arkhe-cooldown-conditioned-c0-hit-1",
    "characterSlug": "furina",
    "talentSetId": "talent-set:furina",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "furina-normal-2-arkhe-cooldown-conditioned-c0",
    "skillLabel": "普通攻击第 2 段·始基力冷却中（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.437293, 0.472886, 0.50848, 0.559328, 0.594922, 0.6356, 0.691533, 0.747466, 0.803398, 0.864416, 0.925434, 0.986451, 1.047469, 1.108486, 1.169504],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/furina/attack.go",
      "internal/characters/furina/zz_furina.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/furina/furina.go",
      "internal/characters/furina/asc.go",
      "internal/characters/furina/cons.go",
      "internal/characters/furina/skill.go"
    ],
    "assumptions": [
      "C0；E召唤物未生效且Qoff，无外部附魔或先前已排队的始基力伤害；本命中实际采用的最终面板与目标状态已恢复。",
      "始基力从起手至最后命中保持不变，目标处于本次所有攻击的命中范围内。",
      "当前始基力对应的独立6秒冷却在起手至本次普攻命中回调时持续有效；arkheCB因此提前返回，没有本次始基力水伤。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "furina-normal-2-arkhe-ready-conditioned-c0-hit-1",
    "characterSlug": "furina",
    "talentSetId": "talent-set:furina",
    "abilityKey": "combat1",
    "parameterKey": "param2",
    "skillId": "furina-normal-2-arkhe-ready-conditioned-c0",
    "skillLabel": "普通攻击第 2 段·始基力就绪（含水伤）（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.437293, 0.472886, 0.50848, 0.559328, 0.594922, 0.6356, 0.691533, 0.747466, 0.803398, 0.864416, 0.925434, 0.986451, 1.047469, 1.108486, 1.169504],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/furina/attack.go",
      "internal/characters/furina/zz_furina.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/furina/furina.go",
      "internal/characters/furina/asc.go",
      "internal/characters/furina/cons.go",
      "internal/characters/furina/skill.go"
    ],
    "assumptions": [
      "C0；E召唤物未生效且Qoff，无外部附魔或先前已排队的始基力伤害；本命中实际采用的最终面板与目标状态已恢复。",
      "始基力从起手至最后命中保持不变，目标处于本次所有攻击的命中范围内。",
      "当前始基力对应的独立6秒冷却在普攻命中时已就绪；该次输入包括物理普攻及其30帧后生成的一次始基力水伤，不能只计物理主击。",
      "始基力水伤源为Durability=0、IgnoreInfusion=true：不造成常规水附着，不继承普通水伤的反应资格；该命中的反应必须恢复为none。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "furina-normal-2-arkhe-ready-conditioned-c0-hit-2",
    "characterSlug": "furina",
    "talentSetId": "talent-set:furina",
    "abilityKey": "combat1",
    "parameterKey": "param10",
    "skillId": "furina-normal-2-arkhe-ready-conditioned-c0",
    "skillLabel": "普通攻击第 2 段·始基力就绪（含水伤）（C0·来源条件）",
    "hitLabel": "始基力追加水伤",
    "attackTag": "normal",
    "element": "hydro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.0946, 0.1023, 0.11, 0.121, 0.1287, 0.1375, 0.1496, 0.1617, 0.1738, 0.187, 0.2002, 0.2134, 0.2266, 0.2398, 0.253],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/furina/attack.go",
      "internal/characters/furina/zz_furina.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/furina/furina.go",
      "internal/characters/furina/asc.go",
      "internal/characters/furina/cons.go",
      "internal/characters/furina/skill.go"
    ],
    "assumptions": [
      "C0；E召唤物未生效且Qoff，无外部附魔或先前已排队的始基力伤害；本命中实际采用的最终面板与目标状态已恢复。",
      "始基力从起手至最后命中保持不变，目标处于本次所有攻击的命中范围内。",
      "当前始基力对应的独立6秒冷却在普攻命中时已就绪；该次输入包括物理普攻及其30帧后生成的一次始基力水伤，不能只计物理主击。",
      "始基力水伤源为Durability=0、IgnoreInfusion=true：不造成常规水附着，不继承普通水伤的反应资格；该命中的反应必须恢复为none。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "furina-normal-3-arkhe-cooldown-conditioned-c0-hit-1",
    "characterSlug": "furina",
    "talentSetId": "talent-set:furina",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "furina-normal-3-arkhe-cooldown-conditioned-c0",
    "skillLabel": "普通攻击第 3 段·始基力冷却中（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.5512, 0.596065, 0.64093, 0.705023, 0.749888, 0.801162, 0.871665, 0.942167, 1.012669, 1.089581, 1.166493, 1.243404, 1.320316, 1.397227, 1.474139],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/furina/attack.go",
      "internal/characters/furina/zz_furina.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/furina/furina.go",
      "internal/characters/furina/asc.go",
      "internal/characters/furina/cons.go",
      "internal/characters/furina/skill.go"
    ],
    "assumptions": [
      "C0；E召唤物未生效且Qoff，无外部附魔或先前已排队的始基力伤害；本命中实际采用的最终面板与目标状态已恢复。",
      "始基力从起手至最后命中保持不变，目标处于本次所有攻击的命中范围内。",
      "当前始基力对应的独立6秒冷却在起手至本次普攻命中回调时持续有效；arkheCB因此提前返回，没有本次始基力水伤。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "furina-normal-3-arkhe-ready-conditioned-c0-hit-1",
    "characterSlug": "furina",
    "talentSetId": "talent-set:furina",
    "abilityKey": "combat1",
    "parameterKey": "param3",
    "skillId": "furina-normal-3-arkhe-ready-conditioned-c0",
    "skillLabel": "普通攻击第 3 段·始基力就绪（含水伤）（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.5512, 0.596065, 0.64093, 0.705023, 0.749888, 0.801162, 0.871665, 0.942167, 1.012669, 1.089581, 1.166493, 1.243404, 1.320316, 1.397227, 1.474139],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/furina/attack.go",
      "internal/characters/furina/zz_furina.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/furina/furina.go",
      "internal/characters/furina/asc.go",
      "internal/characters/furina/cons.go",
      "internal/characters/furina/skill.go"
    ],
    "assumptions": [
      "C0；E召唤物未生效且Qoff，无外部附魔或先前已排队的始基力伤害；本命中实际采用的最终面板与目标状态已恢复。",
      "始基力从起手至最后命中保持不变，目标处于本次所有攻击的命中范围内。",
      "当前始基力对应的独立6秒冷却在普攻命中时已就绪；该次输入包括物理普攻及其30帧后生成的一次始基力水伤，不能只计物理主击。",
      "始基力水伤源为Durability=0、IgnoreInfusion=true：不造成常规水附着，不继承普通水伤的反应资格；该命中的反应必须恢复为none。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "furina-normal-3-arkhe-ready-conditioned-c0-hit-2",
    "characterSlug": "furina",
    "talentSetId": "talent-set:furina",
    "abilityKey": "combat1",
    "parameterKey": "param10",
    "skillId": "furina-normal-3-arkhe-ready-conditioned-c0",
    "skillLabel": "普通攻击第 3 段·始基力就绪（含水伤）（C0·来源条件）",
    "hitLabel": "始基力追加水伤",
    "attackTag": "normal",
    "element": "hydro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.0946, 0.1023, 0.11, 0.121, 0.1287, 0.1375, 0.1496, 0.1617, 0.1738, 0.187, 0.2002, 0.2134, 0.2266, 0.2398, 0.253],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/furina/attack.go",
      "internal/characters/furina/zz_furina.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/furina/furina.go",
      "internal/characters/furina/asc.go",
      "internal/characters/furina/cons.go",
      "internal/characters/furina/skill.go"
    ],
    "assumptions": [
      "C0；E召唤物未生效且Qoff，无外部附魔或先前已排队的始基力伤害；本命中实际采用的最终面板与目标状态已恢复。",
      "始基力从起手至最后命中保持不变，目标处于本次所有攻击的命中范围内。",
      "当前始基力对应的独立6秒冷却在普攻命中时已就绪；该次输入包括物理普攻及其30帧后生成的一次始基力水伤，不能只计物理主击。",
      "始基力水伤源为Durability=0、IgnoreInfusion=true：不造成常规水附着，不继承普通水伤的反应资格；该命中的反应必须恢复为none。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "furina-normal-4-arkhe-cooldown-conditioned-c0-hit-1",
    "characterSlug": "furina",
    "talentSetId": "talent-set:furina",
    "abilityKey": "combat1",
    "parameterKey": "param4",
    "skillId": "furina-normal-4-arkhe-cooldown-conditioned-c0",
    "skillLabel": "普通攻击第 4 段·始基力冷却中（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.732978, 0.792639, 0.8523, 0.93753, 0.997191, 1.065375, 1.159128, 1.252881, 1.346634, 1.44891, 1.551186, 1.653462, 1.755738, 1.858014, 1.96029],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/furina/attack.go",
      "internal/characters/furina/zz_furina.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/furina/furina.go",
      "internal/characters/furina/asc.go",
      "internal/characters/furina/cons.go",
      "internal/characters/furina/skill.go"
    ],
    "assumptions": [
      "C0；E召唤物未生效且Qoff，无外部附魔或先前已排队的始基力伤害；本命中实际采用的最终面板与目标状态已恢复。",
      "始基力从起手至最后命中保持不变，目标处于本次所有攻击的命中范围内。",
      "当前始基力对应的独立6秒冷却在起手至本次普攻命中回调时持续有效；arkheCB因此提前返回，没有本次始基力水伤。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "furina-normal-4-arkhe-ready-conditioned-c0-hit-1",
    "characterSlug": "furina",
    "talentSetId": "talent-set:furina",
    "abilityKey": "combat1",
    "parameterKey": "param4",
    "skillId": "furina-normal-4-arkhe-ready-conditioned-c0",
    "skillLabel": "普通攻击第 4 段·始基力就绪（含水伤）（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "normal",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.732978, 0.792639, 0.8523, 0.93753, 0.997191, 1.065375, 1.159128, 1.252881, 1.346634, 1.44891, 1.551186, 1.653462, 1.755738, 1.858014, 1.96029],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/furina/attack.go",
      "internal/characters/furina/zz_furina.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/furina/furina.go",
      "internal/characters/furina/asc.go",
      "internal/characters/furina/cons.go",
      "internal/characters/furina/skill.go"
    ],
    "assumptions": [
      "C0；E召唤物未生效且Qoff，无外部附魔或先前已排队的始基力伤害；本命中实际采用的最终面板与目标状态已恢复。",
      "始基力从起手至最后命中保持不变，目标处于本次所有攻击的命中范围内。",
      "当前始基力对应的独立6秒冷却在普攻命中时已就绪；该次输入包括物理普攻及其30帧后生成的一次始基力水伤，不能只计物理主击。",
      "始基力水伤源为Durability=0、IgnoreInfusion=true：不造成常规水附着，不继承普通水伤的反应资格；该命中的反应必须恢复为none。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "furina-normal-4-arkhe-ready-conditioned-c0-hit-2",
    "characterSlug": "furina",
    "talentSetId": "talent-set:furina",
    "abilityKey": "combat1",
    "parameterKey": "param10",
    "skillId": "furina-normal-4-arkhe-ready-conditioned-c0",
    "skillLabel": "普通攻击第 4 段·始基力就绪（含水伤）（C0·来源条件）",
    "hitLabel": "始基力追加水伤",
    "attackTag": "normal",
    "element": "hydro",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.0946, 0.1023, 0.11, 0.121, 0.1287, 0.1375, 0.1496, 0.1617, 0.1738, 0.187, 0.2002, 0.2134, 0.2266, 0.2398, 0.253],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/furina/attack.go",
      "internal/characters/furina/zz_furina.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/furina/furina.go",
      "internal/characters/furina/asc.go",
      "internal/characters/furina/cons.go",
      "internal/characters/furina/skill.go"
    ],
    "assumptions": [
      "C0；E召唤物未生效且Qoff，无外部附魔或先前已排队的始基力伤害；本命中实际采用的最终面板与目标状态已恢复。",
      "始基力从起手至最后命中保持不变，目标处于本次所有攻击的命中范围内。",
      "当前始基力对应的独立6秒冷却在普攻命中时已就绪；该次输入包括物理普攻及其30帧后生成的一次始基力水伤，不能只计物理主击。",
      "始基力水伤源为Durability=0、IgnoreInfusion=true：不造成常规水附着，不继承普通水伤的反应资格；该命中的反应必须恢复为none。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "alhaitham-charged-zero-mirrors-a1-cooldown-conditioned-c0-hit-1",
    "characterSlug": "alhaitham",
    "talentSetId": "talent-set:alhaitham",
    "abilityKey": "combat1",
    "parameterKey": "param7",
    "skillId": "alhaitham-charged-zero-mirrors-a1-cooldown-conditioned-c0",
    "skillLabel": "重击·零镜且A1冷却中（C0·来源条件）",
    "hitLabel": "第 1 组命中",
    "attackTag": "charged",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.55255, 0.597525, 0.6425, 0.70675, 0.751725, 0.803125, 0.8738, 0.944475, 1.01515, 1.09225, 1.16935, 1.24645, 1.32355, 1.40065, 1.47775],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/alhaitham/charge.go",
      "internal/characters/alhaitham/zz_alhaitham.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/alhaitham/alhaitham.go",
      "internal/characters/alhaitham/skill.go",
      "internal/characters/alhaitham/asc.go"
    ],
    "assumptions": [
      "C0；起手至最后命中全过程mirrorCount=0，且无待结算的新镜生成或外部附魔。",
      "A1的alhaitham-a1-icd在起手至最后命中持续有效，所有命中回调时Core.Status.Duration > 0；A1先返回，随后投影攻击因零镜返回。仅起始零镜不足以满足该分支。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  },
  {
    "id": "alhaitham-charged-zero-mirrors-a1-cooldown-conditioned-c0-hit-2",
    "characterSlug": "alhaitham",
    "talentSetId": "talent-set:alhaitham",
    "abilityKey": "combat1",
    "parameterKey": "param8",
    "skillId": "alhaitham-charged-zero-mirrors-a1-cooldown-conditioned-c0",
    "skillLabel": "重击·零镜且A1冷却中（C0·来源条件）",
    "hitLabel": "第 2 组命中",
    "attackTag": "charged",
    "element": "physical",
    "scalingStat": "atk",
    "instanceCount": 1,
    "sourceCoefficientValues": [0.55255, 0.597525, 0.6425, 0.70675, 0.751725, 0.803125, 0.8738, 0.944475, 1.01515, 1.09225, 1.16935, 1.24645, 1.32355, 1.40065, 1.47775],
    "coefficientTolerance": 0,
    "sourceRepository": "genshinsim/gcsim",
    "sourceCommit": "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    "sourcePaths": [
      "internal/characters/alhaitham/charge.go",
      "internal/characters/alhaitham/zz_alhaitham.dm.go",
      "pkg/enemy/damage.go",
      "internal/characters/alhaitham/alhaitham.go",
      "internal/characters/alhaitham/skill.go",
      "internal/characters/alhaitham/asc.go"
    ],
    "assumptions": [
      "C0；起手至最后命中全过程mirrorCount=0，且无待结算的新镜生成或外部附魔。",
      "A1的alhaitham-a1-icd在起手至最后命中持续有效，所有命中回调时Core.Status.Duration > 0；A1先返回，随后投影攻击因零镜返回。仅起始零镜不足以满足该分支。",
      "全部列出命中作用于同一目标；起手至最后命中期间最终面板、伤害加成、反应与目标状态保持所恢复的条件，不自动生成队友或装备的其他伤害事件。"
    ],
    "exclusions": [
      "完整仅指声明条件下这一次输入的全部自身伤害；不认证附着、ICD、帧、取消、资源变化或完整角色循环。"
    ],
    "completeAction": true
  }
];

export const conditionedBasicActionSourceEvidence = evidence;
