import type { SourceHitMapping } from "./types";
import manifest from "../../sources/collei-charlotte-skills/manifest.json";
import optimizer from "../../sources/collei-charlotte-skills/manifest-go.json";
import charlotteC2 from "../../sources/charlotte-c2/manifest.json";
export const colleiCharlotteSkillSourceEvidence={...manifest,optimizer,charlotteC2};
const values=(table:string)=>manifest.coefficients.find(row=>row.sourceTable===table)!.values;
const paths=(slug:string)=>Object.keys(manifest.sourceSha256).filter(path=>path.includes(`/characters/${slug}/`)||path==="internal/template/character/character.go"||(slug==="collei"&&path.startsWith("pkg/")));
const shared={abilityKey:"combat2" as const,scalingStat:"atk" as const,attackTag:"skill" as const,sourceRepository:"genshinsim/gcsim" as const,sourceCommit:manifest.revision,coefficientTolerance:0,completeAction:true};
export const colleiCharlotteSkillMappings:SourceHitMapping[]=[
  ...(["no-sprout","sprout","extended-sprout"] as const).flatMap(branch=>{
    const skillId=`collei-skill-${branch}-complete`,count=branch==="no-sprout"?0:branch==="sprout"?2:4;
    const common={...shared,characterSlug:"collei",talentSetId:"talent-set:collei",parameterKey:"param1",element:"dendro" as const,skillId,skillLabel:`拂花偈叶·完整往返${count?`＋${count}次新叶`: "（无新叶）"}`,sourcePaths:paths("collei"),sourceCoefficientValues:values("skill"),assumptions:["往返两击全部命中同一目标，E 释放帧取同一快照；新叶在回收时另取进攻快照，必须明确恢复该历史最终数值。","C0–1 新叶需要回收前触发草相关反应；C2–5 解锁A1即生成，飞行或新叶期间符合反应才延长一次。完整分支要求正确触发条件且新叶未被重放替换、全部实际命中。","每击反应独立；Spread的命中时实际EM与反应加成须明确等于该击所用面板。不能声明没有触发新叶却把往返击设为Spread；不额外延长状态到产生未列出的tick。"],exclusions:["C6另有200%ATK额外伤害，其攻击分类在固定Optimizer仍有注记；本次不把该命座当作完整E。","C1退场充能按实际快照最终ER恢复，不能默认加在在场面板；C4仅Q给其他角色精通，未并入本次E自身伤害。","来源保留飞叶轮位置TODO与ICD简化；不认证真实时序、位置命中率、附着、能量或队伍轮转。"]};
    return [{...common,id:`${skillId}-ring`,hitLabel:"飞叶轮·去程／返程",instanceCount:2},...(count?[{...common,id:`${skillId}-sprout`,hitLabel:"新叶伤害·回收时快照",instanceCount:count,coefficientMultiplier:0,fixedTerms:[{scalingStat:"atk" as const,coefficient:.4,sourceField:"internal/characters/collei/asc.go:a1AttackInfo:Mult",minimumAscension:1}]}]:[])];
  }),
  ...(["press","hold"] as const).flatMap(branch=>{
    const skillId=`charlotte-skill-${branch}-complete`,common={...shared,characterSlug:"charlotte",talentSetId:"talent-set:charlotte",element:"cryo" as const,skillId,skillLabel:`取景·${branch==="press"?"点按初击＋4次速照标记":"长按初击＋8次聚焦标记"}（C0–5）`,sourcePaths:paths("charlotte"),assumptions:["C0–5；初击命中同一存活目标并正常挂标记，标记没有刷新替换、提前删除或额外命中停顿延长到新增tick，全部列出标记伤害实际命中。","初击在起手快照，标记tick重新取样；明确声明除已逐击记录C2差值之外的进攻面板、装备、地区队友及目标状态保持稳定。","A4每名非枫丹其他队友提供5%冰伤；解锁后需实际人数0–3及已含增伤记账，不能缺值当零。"],exclusions:["C2须逐击恢复实际0–3层、共同面板已含层数和基础ATK，不能把长按第8tick默认当增益未过期；不自动推演刷新或到期。C6新增外部触发伤害未接入。","A1仅敌人死亡时减少E冷却，C1仅治疗追加；两者不新增本次E自身伤害。","上游长按命中框为近似；本条件计算不认证几何、精确帧、附着/ICD或实战循环。"]};
    return [{...common,id:`${skillId}-initial`,hitLabel:"取景·初始伤害",parameterKey:branch==="press"?"param1":"param2",sourceCoefficientValues:values(branch==="press"?"skillPress":"skillHold")},{...common,id:`${skillId}-mark`,hitLabel:"标记持续伤害",parameterKey:branch==="press"?"param3":"param6",sourceCoefficientValues:values(branch==="press"?"skillPressMark":"skillHoldMark"),instanceCount:branch==="press"?4:8}];
  }),
];
export const replacedColleiCharlottePartialMappingIds=new Set(["collei-skill-hit","charlotte-skill-skillpress-hit","charlotte-skill-skillhold-hit","charlotte-skill-skillpressmark-hit","charlotte-skill-skillholdmark-hit"]);
