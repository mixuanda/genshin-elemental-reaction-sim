import type { SourceHitMapping } from "./types";
import manifest from "../../sources/traveler-hydro-resolved-casts/manifest.json";
import definitions from "../../sources/traveler-hydro-resolved-casts/definitions.json";
export const travelerHydroResolvedSourceEvidence = manifest;
export interface TravelerHydroResolvedRole {
  mappingId: string; label: string; abilityKey: "combat2"; parameterKey: string;
  values: number[]; sourceValues: number[]; sourceRefs: string[];
}
export interface TravelerHydroResolvedTemplate {
  skillId: string; characterSlug: "aether" | "lumine"; talentSetId: string;
  variantId: string; variantName: string; label: string; protocol: "observed-hydro-suffusion-v1";
  roles: Record<"dew" | "torrent" | "thorn", TravelerHydroResolvedRole>;
  suffusionBonusValues: number[]; sourceCommit: string; assumptions: string[];
}
export const travelerHydroResolvedTemplates = definitions.templates as TravelerHydroResolvedTemplate[];
export const travelerHydroResolvedMappings: SourceHitMapping[] = travelerHydroResolvedTemplates.flatMap(cast =>
  Object.values(cast.roles).map((role): SourceHitMapping => ({
    id: role.mappingId, characterSlug: cast.characterSlug, talentSetId: cast.talentSetId,
    variantId: cast.variantId, variantName: cast.variantName, skillId: cast.skillId, skillLabel: cast.label,
    abilityKey: role.abilityKey, parameterKey: role.parameterKey, hitLabel: role.label,
    element: "hydro", attackTag: "skill", scalingStat: "atk", sourceCoefficientValues: role.sourceValues,
    coefficientTolerance: 0, instanceCount: 1, sourceRepository: "frzyc/genshin-optimizer", sourceCommit: cast.sourceCommit,
    sourcePaths: ["libs/gi/stats/src/allStat_gen.json", "libs/gi/sheets/src/Characters/TravelerHydroF/hydro.tsx"],
    ...(role.parameterKey === "param1" ? { formulaParameters: [{ key: "suffusionHpBonus", parameterKey: "param6", sourceCoefficientValues: cast.suffusionBonusValues, coefficientTolerance: 0 }] } : {}),
    assumptions: [...cast.assumptions,
      "C0；全15级E倍率与两性Optimizer独立字段精确一致，生命消耗按当时MaxHP的4%；A4仅使用本次充盈消耗×45%，上限5000。",
      "instanceCount=1仅是数值模板；完整动作须提供全部实际伤害机会、接触／落空、生命变更和结束点；未知字段阻塞。",
      "生命资格读取与同帧扣血先后采用实际观察的事件顺序，不将旧gcsim的54帧状态和默认飞行排队解释为已核游戏事实。"],
    exclusions: [
      "只计算所选目标的本次完整直接伤害；不自动生成附着、反应、粒子、源水之滴拾取、外部治疗或队伍轮转。外部生命变化需要明确观测后写入账本。",
      "这是跨源公式裁决加完整观察日程，不是自动水主生命周期或当前版本实测认证；自动耗血时点与确切同帧读取顺序仍待独立证据。",
      "旧gcsim的CurrentHP扣血、起手读取结束A4及只给扣血那一滴增加伤害的冲突原文保留，不扩大容差或倒填为已验证。"],
    completeAction: true,
  })));
export const replacedTravelerHydroResolvedBlockedMappingIds = new Set([
  "aether-hydro-skill-hold-full-blocked", "lumine-hydro-skill-hold-full-blocked",
]);
