import type { SourceHitMapping } from "./types";
import definitions from "../../sources/periodic-ordinary-casts/definitions.json";
import manifest from "../../sources/periodic-ordinary-casts/manifest.json";

export interface PeriodicOrdinaryRole {
  mappingId: string; label: string; element: SourceHitMapping["element"]; attackTag: NonNullable<SourceHitMapping["attackTag"]>;
  abilityKey: "combat2" | "combat3"; parameterKey: string;
  terms: Array<{ stat: SourceHitMapping["scalingStat"]; values: number[]; parameterKey: string; sourceField: string }>;
  sourceRefs: string[];
}
export interface PeriodicOrdinaryTemplate {
  skillId: string; characterSlug: string; talentSetId: string; abilityKey: "combat2" | "combat3"; label: string;
  roles: Record<string, PeriodicOrdinaryRole>; assumptions: string[];
}
export const periodicOrdinaryTemplates = definitions.templates as PeriodicOrdinaryTemplate[];
export const periodicOrdinarySourceEvidence = manifest;
export const periodicOrdinaryMappings: SourceHitMapping[] = periodicOrdinaryTemplates.flatMap(cast => Object.values(cast.roles).map(role => ({
  id: role.mappingId, characterSlug: cast.characterSlug, talentSetId: cast.talentSetId, abilityKey: role.abilityKey,
  parameterKey: role.parameterKey, skillId: cast.skillId, skillLabel: cast.label, hitLabel: role.label,
  element: role.element, attackTag: role.attackTag, scalingStat: role.terms[0]!.stat,
  sourceCoefficientValues: role.terms[0]!.values, coefficientTolerance: 0, instanceCount: 1,
  additionalTerms: role.terms.slice(1).map(term => ({ scalingStat: term.stat, parameterKey: term.parameterKey, sourceCoefficientValues: term.values, coefficientTolerance: 0 })),
  ...(cast.characterSlug === "lauma" ? { formulaParameters: [{ key: "laumaSkillShred", parameterKey: "param8", sourceCoefficientValues: definitions.laumaShredValues, coefficientTolerance: 0 }] } : {}),
  sourceRepository: "genshinsim/gcsim" as const, sourceCommit: manifest.revision, sourcePaths: role.sourceRefs,
  assumptions: cast.assumptions,
  exclusions: ["角色专属条件与逐候选接触必须由共享生命周期协议核准；未填不视为满足。", "伊涅芙月感电追击、哥伦比娅引力及菈乌玛长按直接月伤不由这四个普通分支覆盖。", "本次来源仍为provisional；未验证全角色、自动团队或当前官服机制。"],
  completeAction: true,
})));
export const replacedPeriodicOrdinaryPartialMappingIds = new Set([
  "ineffa-skill-skillinitial-hit", "ineffa-skill-skilldot-hit", "columbina-skill-hit", "columbina-skill-skilldot-hit",
  "lauma-skill-skillpress-hit", "lauma-skill-frostgrovesanctuaryatk-hit", "chasca-burst-burstgalesplitting-hit",
]);
