import type { SourceHitMapping } from "./types";
import definitions from "../../sources/extended-stance-casts/definitions.json";
import manifest from "../../sources/extended-stance-casts/manifest.json";

export interface ExtendedStanceTerm {
  stat: SourceHitMapping["scalingStat"]; values: number[]; sourceValues: number[]; parameterKey: string;
  sourceField: string; sourcePath: string; coefficientTolerance: number;
}
export interface ExtendedStanceRole {
  mappingId: string; label: string; element: SourceHitMapping["element"];
  attackTag: "normal" | "charged" | "skill" | "burst";
  abilityKey: "combat1" | "combat2" | "combat3"; parameterKey: string;
  dynamicElement: boolean; coefficientTolerance: number; terms: ExtendedStanceTerm[]; sourceRefs: string[];
}
export interface ExtendedStanceTemplate {
  skillId: string; characterSlug: string; sourceSlug: string; talentSetId: string;
  abilityKey: "combat2" | "combat3"; label: string; protocol: "explicit-extended-stance-v1";
  scheduleKind: "ifa-skill" | "dahlia-burst" | "varka-skill" | "prune-skill";
  sourceCommit: string; roles: Record<string, ExtendedStanceRole>; assumptions: string[];
}
export const extendedStanceSourceEvidence = manifest;
export const extendedStanceTemplates = definitions.templates as ExtendedStanceTemplate[];
export const extendedStanceMappings: SourceHitMapping[] = extendedStanceTemplates.flatMap(cast => Object.values(cast.roles).map((role): SourceHitMapping => ({
  id: role.mappingId, characterSlug: cast.characterSlug, talentSetId: cast.talentSetId,
  abilityKey: role.abilityKey, parameterKey: role.parameterKey, skillId: cast.skillId, skillLabel: cast.label,
  hitLabel: role.label, element: role.element, attackTag: role.attackTag, scalingStat: role.terms[0]!.stat,
  sourceCoefficientValues: role.terms[0]!.sourceValues, coefficientTolerance: 0, instanceCount: 1,
  sourceRepository: "genshinsim/gcsim", sourceCommit: cast.sourceCommit,
  sourcePaths: role.sourceRefs.map(ref => ref.replace(`https://github.com/genshinsim/gcsim/blob/${cast.sourceCommit}/`, "")),
  assumptions: ["C0完整来源协议；每行只是一种倍率模板，核心依实际动作、资格、资源与尾段生成逐击实例。", ...cast.assumptions],
  exclusions: ["只覆盖所声明分支的自身直接伤害。不会自动推测动作、目标接触、反应、体力、附着、卡肉或队伍轮转。",
    "缺失资格或实际取样时阻断；固定来源一致不等于当前游戏实测认证，源码已知缺口未静默修复。"],
  completeAction: true,
})));
export const replacedExtendedStancePartialMappingIds = new Set([
  "ifa-skill-skilldmg-hit", "dahlia-burst-burst-hit", "varka-skill-skillinitial-hit", "prune-skill-skill-hit",
]);
