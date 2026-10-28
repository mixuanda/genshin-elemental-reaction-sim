import type { SourceHitMapping } from './types';
import manifest from '../../sources/tighnari-damage/manifest.json';
export const tighnariDamageSourceEvidence = manifest;
const values=(table:string)=>manifest.coefficients.find(row=>row.sourceTable===table)!.values;
const shared={characterSlug:'tighnari',talentSetId:'talent-set:tighnari',element:'dendro' as const,scalingStat:'atk' as const,
 sourceRepository:"genshinsim/gcsim" as const,sourceCommit:manifest.revision,sourcePaths:manifest.files.map(row=>row.path),coefficientTolerance:0,completeAction:true,
 assumptions:['仅列本次实际命中同一目标的自身箭矢；不是反应附着/ICD或实战命中率证明。','有效天赋等级已包含命座等级加成；不再次加C3/C5。','完整合计要求面板、目标、A1/C2/C4状态在声明范围内稳定；花筥箭采用固定源默认10帧飞行、35帧追踪箭飞行的无打断分支。'],
 exclusions:['花筥箭仅C0–C5：C6额外箭与缩短蓄力未作为本动作的一部分。','重击首箭在发射时快照，藏蕴花矢在首箭命中时快照；A4读取命中时精通，不能混用。','不自动生成蔓激化次数、A1/C4触发历史、能量或移动碰撞；C4 Q有反应且精通状态变化时完整合计不支持。']};
export const tighnariDamageMappings:SourceHitMapping[]=[
 {...shared,id:'tighnari-wreath-primary',abilityKey:'combat1',parameterKey:'param7',sourceCoefficientValues:values('wreath'),skillId:'tighnari-wreath-complete-c0-c5',skillLabel:'花筥箭与4枚藏蕴花矢（C0–C5）',hitLabel:'花筥箭',attackTag:'charged'},
 {...shared,id:'tighnari-wreath-cluster',abilityKey:'combat1',parameterKey:'param8',sourceCoefficientValues:values('clusterbloom'),skillId:'tighnari-wreath-complete-c0-c5',skillLabel:'花筥箭与4枚藏蕴花矢（C0–C5）',hitLabel:'藏蕴花矢',attackTag:'charged',instanceCount:4},
 {...shared,id:'tighnari-burst-primary',abilityKey:'combat3',parameterKey:'param1',sourceCoefficientValues:values('burst'),skillId:'tighnari-burst-complete-cast',skillLabel:'造生缠藤箭（6枚初级＋6枚次级）',hitLabel:'缠藤箭',attackTag:'burst',instanceCount:6},
 {...shared,id:'tighnari-burst-secondary',abilityKey:'combat3',parameterKey:'param2',sourceCoefficientValues:values('burstSecond'),skillId:'tighnari-burst-complete-cast',skillLabel:'造生缠藤箭（6枚初级＋6枚次级）',hitLabel:'次级缠藤箭',attackTag:'burst',instanceCount:6},
];
