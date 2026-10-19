import type { SourceHitMapping } from "./types";
import definitions from "../../sources/mixed-source-casts/definitions.json";
import manifest from "../../sources/mixed-source-casts/manifest.json";
export interface MixedSourceRole {mappingId:string;label:string;kind:"ordinary"|"lunar-bloom-direct"|"lunar-charged-direct"|"stellar-conduct-direct"|"stellar-swirl-direct";element:SourceHitMapping["element"];attackTag:"skill"|"burst";abilityKey:"combat2"|"combat3";parameterKey:string;terms:Array<{stat:"atk"|"em";values:number[];sourceValues:number[];parameterKey:string;sourceField:string;sourcePath:string;coefficientTolerance:number}>;sourceRefs:string[]}
export interface MixedSourceTemplate {skillId:string;characterSlug:string;talentSetId:string;abilityKey:"combat2"|"combat3";label:string;sourceCommit:string;roles:Record<string,MixedSourceRole>;resistanceReduction?:number[];assumptions:string[]}
export const mixedSourceTemplates=definitions.templates as MixedSourceTemplate[];
export const mixedSourceSourceEvidence=manifest;
/** The ordinary rows are cast entry points. Special roles are compiled as genuine special hits, never ordinary approximations. */
export const mixedSourceMappings:SourceHitMapping[]=mixedSourceTemplates.flatMap(cast=>Object.values(cast.roles).filter(role=>role.kind==="ordinary").map(role=>({
  id:role.mappingId,characterSlug:cast.characterSlug,talentSetId:cast.talentSetId,abilityKey:role.abilityKey,parameterKey:role.parameterKey,
  skillId:cast.skillId,skillLabel:cast.label,hitLabel:role.label,element:role.element,attackTag:role.attackTag,scalingStat:role.terms[0]!.stat,
  sourceCoefficientValues:role.terms[0]!.sourceValues,coefficientTolerance:0,instanceCount:1,
  ...(role.terms.length>1?{additionalTerms:role.terms.slice(1).map(term=>({scalingStat:term.stat,parameterKey:term.parameterKey,sourceCoefficientValues:term.sourceValues,coefficientTolerance:0}))}:{}),
  sourceRepository:"genshinsim/gcsim",sourceCommit:cast.sourceCommit,sourcePaths:role.sourceRefs.map(ref=>ref.replace(`https://github.com/genshinsim/gcsim/blob/${cast.sourceCommit}/`,"")),assumptions:cast.assumptions,
  exclusions:["完整性依赖核心生成所有普通与特殊段、完整目标接触和来源状态；代表行不是完整总倍率。","无自动队伍支持或当前游戏机制实测晋升；其他技能、命座、外部伤害和未声明状态不在此分支内。"],completeAction:true,
})));
export const replacedMixedSourcePartialMappingIds=new Set(["lauma-skill-skillhold1-hit","flins-burst-burstinit-hit","odette-skill-codadot-hit"]);
