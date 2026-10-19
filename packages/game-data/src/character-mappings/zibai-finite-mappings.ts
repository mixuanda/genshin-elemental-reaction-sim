import type { SourceHitMapping } from "./types";
import definitions from "../../sources/zibai-finite-casts/definitions.json";
import manifest from "../../sources/zibai-finite-casts/manifest.json";

export interface ZibaiFiniteRole {
  mappingId: string; label: string; kind: "ordinary" | "lunar-crystallize-direct";
  element: "geo"; attackTag: "skill" | "burst"; abilityKey: "combat2" | "combat3";
  parameterKey: string; values: number[]; sourceField: string; sourceRefs: string[];
}
export interface ZibaiFiniteTemplate {
  skillId: string; characterSlug: string; talentSetId: string; abilityKey: "combat2" | "combat3";
  label: string; sourceCommit: string; roles: Record<"ordinary" | "lunar", ZibaiFiniteRole>; assumptions: string[];
}
export const zibaiFiniteTemplates = definitions.templates as ZibaiFiniteTemplate[];
export const zibaiFiniteSourceEvidence = manifest;
export const zibaiFiniteMappings: SourceHitMapping[] = zibaiFiniteTemplates.map(cast => {
  const role = cast.roles.ordinary;
  return { id: role.mappingId, characterSlug: cast.characterSlug, talentSetId: cast.talentSetId,
    abilityKey: cast.abilityKey, parameterKey: role.parameterKey, skillId: cast.skillId, skillLabel: cast.label,
    hitLabel: role.label, element: "geo", attackTag: role.attackTag, scalingStat: "def",
    sourceCoefficientValues: role.values, coefficientTolerance: 0, instanceCount: 1,
    formulaParameters: [{ key: "zibaiLunarCoefficient", parameterKey: "param2", sourceCoefficientValues: cast.roles.lunar.values, coefficientTolerance: 0 }],
    sourceRepository: "frzyc/genshin-optimizer", sourceCommit: cast.sourceCommit,
    sourcePaths: manifest.files.map(file => file.path), assumptions: cast.assumptions,
    exclusions: ["完整性由有限日程编译器生成普通及月结晶两段；代表行本身不等于完整伤害。", "未实现姿态资源、自动动作帧、ICD、粒子、取消窗或自动队伍能力。"], completeAction: true };
});
export const replacedZibaiFinitePartialMappingIds = new Set(["zibai-spirit-steed-first-hit", "zibai-burst-first-hit"]);
