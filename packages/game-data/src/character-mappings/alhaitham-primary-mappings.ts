import type { SourceHitMapping } from "./types";
import manifest from "../../sources/alhaitham-primary/manifest.json";

export const alhaithamPrimarySourceEvidence = manifest;
export const ALHAITHAM_MIRROR_ATK_VALUES = manifest.coefficients.find(row => row.sourceTable === "mirrorAtk")!.values;
export const ALHAITHAM_MIRROR_EM_VALUES = manifest.coefficients.find(row => row.sourceTable === "mirrorEm")!.values;
export const ALHAITHAM_PROJECTION_TIMING = manifest.timing;
export const alhaithamProjectionSkillId = (mirrors: number): string => `alhaitham-projection-${mirrors}-${mirrors === 1 ? "mirror" : "mirrors"}`;
export const alhaithamProjectionHitIds = (mirrors: number): string[] => Array.from({ length: mirrors }, (_, index) => `${alhaithamProjectionSkillId(mirrors)}-hit${mirrors === 1 ? "" : `-instance-${index + 1}`}`);
const shared = {
  characterSlug: "alhaitham", talentSetId: "talent-set:alhaitham", abilityKey: "combat2" as const,
  element: "dendro" as const, attackTag: "skill" as const, scalingStat: "atk" as const,
  sourceRepository: "genshinsim/gcsim" as const, sourceCommit: manifest.revision,
  sourcePaths: ["alhaitham.go", "skill.go", "attack.go", "asc.go", "cons.go", "burst.go", "zz_alhaitham.dm.go"].map(file => `internal/characters/alhaitham/${file}`),
  coefficientTolerance: 0, completeAction: true,
  assumptions: ["C0–C6单次实际镜投射；镜数为所选计算情景，触发资格与实际接触仍须明确。", "使用独立有效E天赋，不借普攻等级；投射不包含触发它的普攻/重击/下落伤害。", "ATK及C4/C6在延后快照取样，精通基数在触发时取样，A4在各命中时取样；仅明确精通不变时共用面板。"],
  exclusions: ["不推演整轮、E突进、Q伤害、镜生成/消失/溢出、产球或投射冷却。", "C2/C4/C6只按实际阶段及面板已含量补差，不自动推断层数、有效期、反应或队友反馈；C4消耗镜的精通不加给自身，C5不增加E等级。"],
};
export const alhaithamPrimaryMappings: SourceHitMapping[] = [1, 2, 3].map(mirrors => ({
  ...shared, id: `${alhaithamProjectionSkillId(mirrors)}-hit`, skillId: alhaithamProjectionSkillId(mirrors),
  skillLabel: `琢光镜·${mirrors}镜投射（一次投射）`, hitLabel: `琢光镜·${mirrors}镜投射`,
  parameterKey: `param${mirrors * 2 + 2}`, sourceCoefficientValues: ALHAITHAM_MIRROR_ATK_VALUES,
  additionalTerms: [{ scalingStat: "em", parameterKey: `param${mirrors * 2 + 3}`, sourceCoefficientValues: ALHAITHAM_MIRROR_EM_VALUES, coefficientTolerance: 0 }],
  ...(mirrors === 1 ? {} : { instanceCount: mirrors }),
}));
