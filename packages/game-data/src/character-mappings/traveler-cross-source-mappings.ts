import type { SourceHitMapping } from "./types";
import manifest from "../../sources/traveler-cross-source-casts/manifest.json";
import definitions from "../../sources/traveler-cross-source-casts/definitions.json";

export const travelerCrossSourceEvidence = manifest;

export interface TravelerCrossSourceRole {
  mappingId: string;
  label: string;
  abilityKey: "combat3";
  parameterKey: "param1";
  /** Active catalog values; both gender-specific Optimizer vectors match exactly. */
  values: number[];
  /** Pinned Optimizer values, never the conflicting gcsim coefficient vector. */
  sourceValues: number[];
  /** Historical gcsim values retained as conflict evidence, not numerical authority. */
  gcsimValues: number[];
  sourceRefs: string[];
}

export interface TravelerCrossSourceTemplate {
  skillId: string;
  characterSlug: "aether" | "lumine";
  talentSetId: string;
  variantId: string;
  variantName: string;
  label: string;
  element: "anemo" | "dendro";
  abilityKey: "combat3";
  protocol: "explicit-traveler-cross-source-v1";
  sourceRepository: "frzyc/genshin-optimizer";
  sourceCommit: string;
  behaviorSourceCommit: string;
  roles: { tick: TravelerCrossSourceRole };
  assumptions: string[];
}

/** Coefficient templates only; full-cast evaluation requires the lifecycle compiler. */
export const travelerCrossSourceTemplates = definitions.templates as TravelerCrossSourceTemplate[];

const assumptions = [
  "C0；显式新鲜施放，true_moon_story_buff关闭；无卡肉、中断、重复施放或实体替换。",
  "使用explicit-traveler-cross-source-v1完整生命周期协议；instanceCount=1只是倍率模板，不是命中总数或命中保证。",
  "每次候选伤害的实际接触或未接触、目标身份、快照和完整观察终点均明确输入；由核心展开并验证全部来源候选。",
  "数值权威为固定Optimizer 180a0a1，两性专属burst[0]的全部15级与激活目录精确相等，容差为0；行为权威为固定gcsim a7dc4bf。",
  "原gcsim倍率冲突单独保存在definitions.roles.tick.gcsimValues和来源归档，不用冲突向量验证或覆盖目录，也不扩大舍入容差。",
  "装备、队友、环境与实际被动产生的属性必须归入对应取样状态；已计入的增益不得重复添加。",
];
const exclusions = [
  "风Q仅全程无元素吸收；草Q仅全程无元素转化。其他分支与历史冲突保持独立证据，不据此宣称所有旅行者动作均已解除限制。",
  "仅计算该完整自身直接伤害日程；不自动保证命中、生成扩散等额外反应、模拟附着/ICD、移动、治疗、能量或团队轮转。",
  "固定来源的跨来源核准属于provisional实现证据，不代表当前游戏版本实测认证。",
];

export const travelerCrossSourceMappings: SourceHitMapping[] = travelerCrossSourceTemplates.map((cast): SourceHitMapping => {
  const role = cast.roles.tick;
  const optimizerRoot = `https://github.com/frzyc/genshin-optimizer/blob/${cast.sourceCommit}/`;
  return {
    id: role.mappingId,
    characterSlug: cast.characterSlug,
    talentSetId: cast.talentSetId,
    variantId: cast.variantId,
    variantName: cast.variantName,
    abilityKey: role.abilityKey,
    parameterKey: role.parameterKey,
    skillId: cast.skillId,
    skillLabel: cast.label,
    hitLabel: role.label,
    element: cast.element,
    attackTag: "burst",
    scalingStat: "atk",
    sourceCoefficientValues: role.sourceValues,
    coefficientTolerance: 0,
    instanceCount: 1,
    sourceRepository: cast.sourceRepository,
    sourceCommit: cast.sourceCommit,
    // Mixed-repository behavior URLs stay in role.sourceRefs and the archive.
    sourcePaths: role.sourceRefs.filter(ref => ref.startsWith(optimizerRoot)).map(ref => ref.slice(optimizerRoot.length)),
    assumptions: [...assumptions, ...cast.assumptions],
    exclusions,
    completeAction: true,
  };
});

/** Only the named no-absorption/no-transfiguration branches replace these blockers. */
export const replacedTravelerCrossSourceBlockedMappingIds = new Set([
  "aether-anemo-burst-blocked",
  "lumine-anemo-burst-blocked",
  "aether-dendro-burst-lamp-tick-blocked",
  "lumine-dendro-burst-lamp-tick-blocked",
]);
