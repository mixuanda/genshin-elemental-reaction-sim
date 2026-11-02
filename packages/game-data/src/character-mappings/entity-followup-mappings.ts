import type { SourceHitMapping } from "./types";
import definitions from "../../sources/entity-followup-casts/definitions.json";
import manifest from "../../sources/entity-followup-casts/manifest.json";

export interface EntityFollowupRole {
  mappingId: string; label: string; element: SourceHitMapping["element"]; attackTag: "skill" | "burst" | "proc";
  abilityKey: "combat2" | "combat3"; parameterKey: string; coefficientTolerance: number;
  terms: Array<{ stat: "atk"; values: number[]; sourceValues: number[]; parameterKey: string; sourceField: string; sourcePath: string; coefficientTolerance: number }>;
  sourceRefs: string[];
}
export interface EntityFollowupTemplate {
  skillId: string; characterSlug: string; sourceSlug: string; talentSetId: string; abilityKey: "combat2" | "combat3";
  label: string; protocol: "explicit-entity-followup-v1"; sourceCommit: string;
  roles: Record<string, EntityFollowupRole>; assumptions: string[];
}
export const entityFollowupTemplates = definitions.templates as EntityFollowupTemplate[];
export const entityFollowupSourceEvidence = manifest;
export const entityFollowupMappings: SourceHitMapping[] = entityFollowupTemplates.flatMap(cast => Object.values(cast.roles).map(role => ({
  id: role.mappingId, characterSlug: cast.characterSlug, talentSetId: cast.talentSetId, abilityKey: role.abilityKey,
  parameterKey: role.parameterKey, skillId: cast.skillId, skillLabel: cast.label, hitLabel: role.label,
  element: role.element, attackTag: role.attackTag, scalingStat: "atk", sourceCoefficientValues: role.terms[0]!.sourceValues,
  coefficientTolerance: 0, instanceCount: 1, sourceRepository: "genshinsim/gcsim", sourceCommit: cast.sourceCommit,
  sourcePaths: role.sourceRefs.map(ref => ref.replace(`https://github.com/genshinsim/gcsim/blob/${cast.sourceCommit}/`, "")), assumptions: ["每行仅是单次伤害角色模板；完整施放由核心按实际实体生命期编译。", ...cast.assumptions],
  exclusions: ["不自动补造随机吸收、目标接触、跨角色面板、附着反应、治疗或队伍轮转。", "完整性仅指此明确新生实体协议；未覆盖的替换、升级、重施及来源冲突继续阻止完整声明。"],
  completeAction: true,
})));
export const replacedEntityFollowupPartialMappingIds = new Set([
  "jahoda-burst-burst-hit", "nicole-burst-burstinitial-hit", "odette-skill-skill-hit",
  // Retain the four direct C0 Cryo contacts independently of the dance-double lifecycle.
]);
