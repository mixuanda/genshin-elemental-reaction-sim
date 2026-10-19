import type { SourceMappingBlocker } from "./types";

export const currentSkillMappingBlockers: SourceMappingBlocker[] = [{
  id: "iansan-swift-talent-binding-blocked",
  characterSlug: "iansan", talentSetId: "talent-set:iansan", abilityKey: "combat1", parameterKey: "param5",
  skillId: "iansan-swift-talent-unresolved", skillLabel: "迅闪腾跃·天赋等级绑定待核验", hitLabel: "迅闪腾跃",
  sourceCommit: "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
  sourcePaths: ["internal/characters/iansan/charge.go", "internal/characters/iansan/zz_iansan.dm.go"],
  reason: "固定实现 charge.go 使用 swift[c.TalentLvlSkill()]，但同一固定源码的倍率表将 swift 声明为 attack 的 {4}，完整向量对应当前普通攻击 combat1.param5。普通攻击与战技等级不同时采用哪个等级存在来源冲突，不能强贴战技参数或悄用普通攻击等级。",
  evidence: { implementationLevelGetter: "TalentLvlSkill", sourceTableAbility: "attack", sourceParameterIndex: 4, catalogField: "talent-set:iansan.combat1.parameters.param5", fixedSourceLevelOneCoefficient: 0.84194 }
}];
