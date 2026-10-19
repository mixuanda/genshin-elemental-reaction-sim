import type { SourceHitMapping } from "./types";
import definitions from "../../sources/noelle-plunge-casts/definitions.json";
import manifest from "../../sources/noelle-plunge-casts/manifest.json";
export const noellePlungeSourceEvidence = manifest;
export interface NoellePlungeRole { mappingId: string; label: string; parameterKey: string; values: number[]; sourceValues: number[]; sourceField: string; coefficientTolerance: number; sourceRefs: string[]; }
export interface NoellePlungeTemplate { skillId: string; label: string; roles: Record<"collision" | "landing", NoellePlungeRole>; }
export const noellePlungeTemplates = definitions.templates as NoellePlungeTemplate[];
export const noellePlungeMappings: SourceHitMapping[] = noellePlungeTemplates.flatMap(cast => Object.values(cast.roles).map(role => ({
  id: role.mappingId, skillId: cast.skillId, skillLabel: cast.label, hitLabel: role.label,
  characterSlug: "noelle", talentSetId: "talent-set:noelle", abilityKey: "combat1", variantId: "noelle-burst-inactive", variantName: "Q未激活·无附魔",
  parameterKey: role.parameterKey, sourceCoefficientValues: role.sourceValues, coefficientTolerance: 0,
  scalingStat: "atk", element: "physical", attackTag: "plunge", instanceCount: 1,
  sourceRepository: "genshinsim/gcsim", sourceCommit: manifest.revision,
  sourcePaths: manifest.files.filter(file => file.path !== "LICENSE").map(file => file.path), completeAction: true,
  assumptions: ["C0、Q大扫除未激活、无外部附魔；每行只是单次来源角色模板，完整下落由核心展开碰撞与落地。", "实际起手资格必须是固定来源AirborneXianyun，不能以通用跳跃或星扩散腾空代替；确认执行后返回Grounded。", "明确有无路径碰撞、每击接触或落空、完整80/82帧观察；33f碰撞及39/42f落地分别取样，无卡肉或中断。"],
  exclusions: ["不推导Q的DEF转ATK、岩附魔、其他腾空来源或多次路径碰撞；既有低／高零碰撞动作保持独立。", "单击只计算已发生的本击，不要求未来碰撞或落地日程。"],
})));
export const replacedNoellePlungePartialMappingIds = new Set(["noelle-plunge-collision-hit"]);
