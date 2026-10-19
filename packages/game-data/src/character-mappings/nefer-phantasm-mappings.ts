import type { SourceHitMapping } from "./types";
import definitions from "../../sources/nefer-phantasm-cast/definitions.json";
import manifest from "../../sources/nefer-phantasm-cast/manifest.json";

export type NeferPhantasmRoleKey = "nefer1" | "nefer2" | "shade1" | "shade2" | "shade3";
export interface NeferPhantasmTerm {
  stat: "atk" | "em";
  values: number[];
  sourceValues: number[];
  parameterKey: string;
  sourceField: string;
  sourcePath: string;
  sheetField: string;
  coefficientTolerance: number;
}
export interface NeferPhantasmRole {
  mappingId: string;
  label: string;
  kind: "ordinary" | "lunar-bloom-direct";
  element: "dendro";
  attackTag: "charged";
  abilityKey: "combat2";
  parameterKey: string;
  terms: NeferPhantasmTerm[];
  sourceRefs: string[];
}
export interface NeferPhantasmTemplate {
  skillId: "nefer-phantasm-observed-c0";
  characterSlug: "nefer";
  talentSetId: "talent-set:nefer";
  abilityKey: "combat2";
  label: string;
  sourceCommit: string;
  roles: Record<NeferPhantasmRoleKey, NeferPhantasmRole>;
  /** Source establishes each performer's stages, not a global five-hit interleaving. */
  orderedChains: NeferPhantasmRoleKey[][];
  assumptions: string[];
  exclusions: string[];
}

export const neferPhantasmTemplates = definitions.templates as NeferPhantasmTemplate[];
export const neferPhantasmConstants = definitions.constants;
export const neferPhantasmSourceEvidence = manifest;

/** Two ordinary entry rows; the finite adapter must generate all three genuine lunar rows. */
export const neferPhantasmMappings: SourceHitMapping[] = neferPhantasmTemplates.flatMap(cast => {
  const formulaParameters = (["shade1", "shade2", "shade3"] as const).map((key, index) => {
    const term = cast.roles[key].terms[0]!;
    return { key: `neferShade${index + 1}Coefficient`, parameterKey: term.parameterKey,
      sourceCoefficientValues: term.sourceValues, coefficientTolerance: term.coefficientTolerance };
  });
  return (["nefer1", "nefer2"] as const).map(key => {
    const role = cast.roles[key], first = role.terms[0]!;
    return {
      id: role.mappingId, characterSlug: cast.characterSlug, talentSetId: cast.talentSetId,
      abilityKey: cast.abilityKey, parameterKey: role.parameterKey, skillId: cast.skillId,
      skillLabel: cast.label, hitLabel: role.label, element: role.element, attackTag: role.attackTag,
      scalingStat: first.stat, sourceCoefficientValues: first.sourceValues,
      coefficientTolerance: first.coefficientTolerance, instanceCount: 1,
      additionalTerms: role.terms.slice(1).map(term => ({ scalingStat: term.stat,
        parameterKey: term.parameterKey, sourceCoefficientValues: term.sourceValues,
        coefficientTolerance: term.coefficientTolerance })),
      formulaParameters,
      sourceRepository: "frzyc/genshin-optimizer", sourceCommit: cast.sourceCommit,
      sourcePaths: role.sourceRefs.map(ref => ref.replace(`https://github.com/frzyc/genshin-optimizer/blob/${cast.sourceCommit}/`, "")),
      assumptions: cast.assumptions,
      exclusions: [...cast.exclusions, "这两行只提供普通段的目录入口。有限日程适配器必须接入全部五段、逐击真实状态与公式轨迹后，才能报告完整幻戏；不能只将两行相加当作总伤害。"],
      completeAction: true,
    };
  });
});
