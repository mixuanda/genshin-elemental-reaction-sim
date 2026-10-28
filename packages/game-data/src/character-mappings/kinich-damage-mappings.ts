import type { SourceHitMapping } from "./types";
import manifest from "../../sources/kinich-damage/manifest.json";

export const kinichDamageSourceEvidence = manifest;
export const KINICH_LOOP_VALUES = manifest.coefficients.find(row => row.sourceTable === "loopShot")!.values;
export const KINICH_CANNON_VALUES = manifest.coefficients.find(row => row.sourceTable === "scalespikerCannon")!.values;
const shared = {
  characterSlug: "kinich", talentSetId: "talent-set:kinich", abilityKey: "combat2" as const,
  element: "dendro" as const, attackTag: "skill" as const, scalingStat: "atk" as const,
  sourceRepository: "genshinsim/gcsim" as const, sourceCommit: manifest.revision,
  sourcePaths: ["kinich.go", "attack.go", "skill.go", "asc.go", "cons.go", "zz_kinich.dm.go"].map(file => `internal/characters/kinich/${file}`),
  coefficientTolerance: 0,
  assumptions: ["只覆盖C0/C1的明确E伤害；有效天赋来自E，已含外部加级时不再加命座等级。", "实际夜魂状态、炮前20点与A4层数就地填写；展示柜不证明这些战斗条件。"],
  exclusions: ["未覆盖C2+、Q、燃烧/烈绽放产点、夜魂生命周期、冷却或整轮伤害。", "C1仅给贯鳞炮100%暴伤；A4为动作创建时的攻击力基数附加，不是通用增伤。"],
};
export const kinichDamageMappings: SourceHitMapping[] = [
  { ...shared, id: "kinich-loop-shot-hit", skillId: "kinich-loop-shot-single", skillLabel: "环绕射击·一击（E状态）", hitLabel: "环绕射击·所选一击", parameterKey: "param1", sourceCoefficientValues: KINICH_LOOP_VALUES, completeAction: false },
  { ...shared, id: "kinich-loop-shot-pair-hit", skillId: "kinich-loop-shot-pair", skillLabel: "环绕射击·同次输入双击（E状态）", hitLabel: "环绕射击", parameterKey: "param1", sourceCoefficientValues: KINICH_LOOP_VALUES, instanceCount: 2, completeAction: true },
  { ...shared, id: "kinich-scalespiker-cannon-hit", skillId: "kinich-scalespiker-cannon", skillLabel: "迴猎贯鳞炮·一击（E状态）", hitLabel: "迴猎贯鳞炮", parameterKey: "param2", sourceCoefficientValues: KINICH_CANNON_VALUES, completeAction: true },
];
