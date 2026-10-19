import type { SourceHitMapping } from "./types";
import manifest from "./itto-kesagiri-source-manifest.json";

export const ittoKesagiriSourceEvidence = manifest;

const actions = [
  { id: "aratakiitto-kesagiri-combo", coefficient: "akCombo", label: "荒泷逆袈裟·单次连斩" },
  { id: "aratakiitto-kesagiri-finisher", coefficient: "akFinal", label: "荒泷逆袈裟·单次终结" }
] as const;

/** One source ChargeAttack invocation, never an inferred held-attack sequence. */
export const ittoKesagiriMappings: SourceHitMapping[] = actions.map((action) => ({
  id: `${action.id}-hit`,
  skillId: action.id,
  skillLabel: action.label,
  hitLabel: action.label,
  characterSlug: "aratakiitto",
  talentSetId: "talent-set:aratakiitto",
  abilityKey: "combat1",
  parameterKey: manifest.coefficients[action.coefficient].parameterKey,
  sourceCoefficientValues: manifest.coefficients[action.coefficient].values,
  coefficientTolerance: 0,
  scalingStat: "atk",
  element: "physical",
  attackTag: "charged",
  instanceCount: 1,
  sourceRepository: "genshinsim/gcsim",
  sourceCommit: manifest.commit,
  sourcePaths: [
    "internal/characters/itto/zz_aratakiitto.dm.go",
    "internal/characters/itto/charge.go",
    "internal/characters/itto/asc.go",
    "internal/characters/itto/itto.go",
    "internal/characters/itto/burst.go",
    "internal/characters/itto/cons.go",
    "pkg/core/player/character/stats.go",
    "pkg/core/attributes/stats.go",
    "pkg/core/attack.go",
    "pkg/enemy/damage.go"
  ],
  completeAction: true,
  assumptions: [
    "基础倍率映射为 C0、Q 未激活且无外部附魔时的物理重击；实际元素、突破和命座由角色条件适配器处理，不能由本倍率表默认为全部完成。",
    "以合法乱神之怪力状态已经成立且本次斩击实际命中为条件。源码按上次斩击、当前层数和 C6 本次不消耗分支选择动作；C0 下连斩需至少 2 层，剩余 1 层选择终结，不从倍率推断层数。",
    action.coefficient === "akCombo"
      ? "本项只归属左或右姿态的一次逆袈裟连斩，两种姿态共用 akCombo；不是两次命中之和。"
      : "本项只归属一次逆袈裟终结，不含此前的连斩或后续新输入。",
    "completeAction 仅表示这一次源码 ChargeAttack 调用的自身伤害实例完整：一次 QueueAttack、一次命中；不表示完整持有重击、整个逆袈裟连段或整个 Q 窗口。",
    "突破 >= 4 时，适配器必须加入 A4 的 0.35 × 本次动作构建时当前完整 DEF（包含 Extra DEF）；未解锁时为零。该独立 DEF 加算不能被当成 ATK 倍率或遗漏。",
    "Q 激活时，适配器另按独立有效 Q 等级及起手非 Extra DEF 快照处理转 ATK，并改为不可覆盖岩附魔；须明确输入 ATK 是否已含转换，避免重复加入。普通攻击天赋等级不用于索引 defconv。",
    "固定源对 CA 起手快照仍是假设，且命中时点未按攻速调整；此处提供明确上下文的条件数值，不宣称当前游戏时序已实测验证。"
  ],
  exclusions: [
    "不由这两个单次映射自动求完整持有次数、资源获得、C6 随机不消耗分支、取消、卡肉、攻速时间线、实际多目标覆盖或 DPS。",
    "C1 层数、C2 能量与冷却、C4 条件 ATK%/DEF%、C5 的 Q 等级和 C6 重击暴伤须由各自显式条件处理；不能对一次伤害统一乘系数。",
    "不包含无乱神之怪力时的左一文字斩，也不把后续另一次重击归属本次技能。"
  ]
}));
