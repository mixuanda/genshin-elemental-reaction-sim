import type { SourceHitMapping } from "./types";
import definitions from "../../sources/finite-followup-casts/definitions.json";
import manifest from "../../sources/finite-followup-casts/manifest.json";

export interface FiniteFollowupHitDefinition {
  id: string; role: string; label: string;
  abilityKey: "combat1" | "combat2" | "combat3";
  parameterKey: string; values: number[];
  scalingStat: SourceHitMapping["scalingStat"];
  element: SourceHitMapping["element"];
  attackTag: NonNullable<SourceHitMapping["attackTag"]>;
  sourceField: string; sourceRefs: string[]; talent: "normal" | "selected";
  coefficientMultiplier?: number;
  fixedTerms?: NonNullable<SourceHitMapping["fixedTerms"]>;
}
export interface FiniteFollowupTemplate {
  skillId: string; characterSlug: string; talentSetId: string;
  abilityKey: "combat2" | "combat3"; label: string;
  assumptions: string[]; hits: FiniteFollowupHitDefinition[];
}
export const finiteFollowupTemplates = definitions.templates as FiniteFollowupTemplate[];
export const finiteFollowupSourceEvidence = manifest;
export const finiteFollowupMappings: SourceHitMapping[] = finiteFollowupTemplates.flatMap(cast => cast.hits.map(hit => ({
  id: hit.id, characterSlug: cast.characterSlug, talentSetId: cast.talentSetId,
  abilityKey: hit.abilityKey, parameterKey: hit.parameterKey,
  skillId: cast.skillId, skillLabel: cast.label, hitLabel: hit.label,
  element: hit.element, attackTag: hit.attackTag, scalingStat: hit.scalingStat,
  sourceCoefficientValues: hit.values, coefficientTolerance: 0, instanceCount: 1,
  ...(hit.coefficientMultiplier === undefined ? {} : { coefficientMultiplier: hit.coefficientMultiplier }),
  ...(hit.fixedTerms ? { fixedTerms: hit.fixedTerms } : {}),
  sourceCommit: manifest.revision, sourceRepository: "genshinsim/gcsim" as const,
  sourcePaths: hit.sourceRefs,
  assumptions: ["C0；本次实际输入、所有命中、实体存续及各时点面板已明确。每次命中独立计算，不能用总倍率代替逐击反应与被动。", ...cast.assumptions],
  exclusions: ["只认证所命名动作的自身伤害归属；不自动生成团队轮转、附着/ICD、碰撞、卡肉、产球或治疗。", "固有增伤与加算基伤必须通过共享上下文恢复已含份额；固定来源不等于当前游戏实测。高命座不在本组范围。"],
  completeAction: true,
})));
export const replacedFiniteFollowupPartialMappingIds = new Set([
  "keqing-skill-hit", "faruzan-skill-hit", "faruzan-burst-burst-hit", "xinyan-skill-hit", "cyno-skill-skillb-hit",
]);
