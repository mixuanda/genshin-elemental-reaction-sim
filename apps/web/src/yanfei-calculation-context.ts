import { findTalentSetById } from "@genshin-dps-lab/game-data/catalog";
import { yanfeiChargedContextSchema, type CalculatorDocument, type YanfeiChargedContext } from "../../../packages/sim-core/src/calculator-model";
import { createYanfeiChargedBaseFormula, createYanfeiDamageBonusFormula, createYanfeiC2CritRateFormula, YANFEI_CHARGED_SOURCE_REFS } from "../../../packages/sim-core/src/yanfei-formulas";
import evidence from "../../../packages/game-data/src/character-mappings/yanfei-charged-source-manifest.json";

const prefix="yanfei-charged-context:",assumptionPrefix="烟绯重击来源上下文：";
export const YANFEI_MAIN_HIT_ID="yanfei-charged-cast-main",YANFEI_A4_HIT_ID="yanfei-charged-cast-a4";
export function isYanfeiChargedAction(document:CalculatorDocument):boolean{return document.gameContext?.skillId==="yanfei-charged-cast";}
/** A single target and one charged input; A4 has its own crit/reaction and conditional occurrence. */
export function applyYanfeiChargedContext(document:CalculatorDocument,supplied:YanfeiChargedContext):CalculatorDocument {
  if(!isYanfeiChargedAction(document))return document;
  const context=yanfeiChargedContextSchema.parse(supplied),result=structuredClone(document),game=result.gameContext!;
  game.yanfeiCharged=context;game.variantName=`单次重击 · ${context.scarletSeals} 印 · 条件 A4`;
  result.dependencies=result.dependencies.filter(dep=>!dep.id.startsWith(prefix));
  result.assumptions=result.assumptions.filter(assumption=>!assumption.startsWith(assumptionPrefix));
  const ascension=(result.build.mode==="equipment-derived"?result.build.equipment?.ascension:result.build.ascension)??game.ascension;
  const reasons:string[]=[];
  if(ascension===undefined)reasons.push("必须明确突破阶段，才能确定 A1 与 A4 是否解锁。");
  if(context.scarletSeals>3&&game.constellation<6)reasons.push("C6 以下最多消耗 3 枚丹火印，不能使用 4 印倍率。");
  if(ascension!==undefined&&ascension<1&&context.priorA1BonusIncluded!==0)reasons.push("A1 尚未解锁，所填已含旧 A1 增伤必须为零。");
  const talents=findTalentSetById("talent-set:yanfei");
  const read=(abilityKey:string,parameterKey:string,values:readonly number[],level:number)=>{
    const current=talents?.abilities.find(ability=>ability.key===abilityKey)?.parameters[parameterKey];
    return current&&values.length===current.length&&values.every((value,index)=>value===current[index])?current[level-1]:undefined;
  };
  const coefficients=evidence.coefficients.charge.map(source=>read(source.abilityKey,source.parameterKey,source.values,game.effectiveTalentLevel));
  const qSource=evidence.coefficients.burstBonus;
  const q=read(qSource.abilityKey,qSource.parameterKey,qSource.values,context.brilliance.effectiveTalentLevel);
  if(coefficients.some(value=>value===undefined)||q===undefined)reasons.push("所选有效天赋对应的重击或灼灼完整向量与固定来源不符/缺失，不能补造倍率。");
  const depId=`${prefix}values`,a4DepId=`${prefix}a4-snapshot`;
  result.dependencies.push({id:depId,status:reasons.length?"missing":"provisional",reason:reasons.join("；")||"单目标、一次重击输入，印数和每段灼灼/目标生命条件由用户明确；只计算条件数值。",sourceRefs:YANFEI_CHARGED_SOURCE_REFS});
  result.dependencies.push({id:a4DepId,status:context.statsStableToA4?"provisional":"missing",reason:context.statsStableToA4?"明确假定主击和 +10 帧 A4 各自快照的共享面板、装备状态保持相同；反应、目标生命和灼灼状态逐段独立。":"A4 在主击回调后 +10 帧重新快照；当前未提供另一套面板，且未声明面板和装备状态稳定，不能拿主击旧快照代替。",sourceRefs:YANFEI_CHARGED_SOURCE_REFS});
  for(const hit of result.hits){
    hit.dependencies=hit.dependencies.filter(id=>!id.startsWith(prefix));hit.dependencies.push(depId);
    if(hit.kind!=="ordinary")continue;
    const a4=hit.id===YANFEI_A4_HIT_ID;
    hit.sourceRefs=[...new Set([...hit.sourceRefs,...YANFEI_CHARGED_SOURCE_REFS])];
    if(!a4&&coefficients.every((value):value is number=>value!==undefined))hit.baseDamageFormula=createYanfeiChargedBaseFormula(context.scarletSeals,coefficients);
    if(a4){
      hit.dependencies.push(a4DepId);
      hit.terms=[{stat:"atk",coefficient:.8,minimumAscension:4}];
      hit.occurrence={kind:"critical-hit",sourceHitId:YANFEI_MAIN_HIT_ID,enabled:(ascension===undefined||ascension>=4)&&context.onFieldAtMainHit,sourceRefs:YANFEI_CHARGED_SOURCE_REFS};
    }
    if(ascension!==undefined&&q!==undefined)hit.damageBonusFormula=createYanfeiDamageBonusFormula({seals:context.scarletSeals,ascension,priorA1BonusIncluded:context.priorA1BonusIncluded,brillianceActive:a4?context.brilliance.a4Active:context.brilliance.mainActive,brillianceCoefficient:q,includedBrillianceBonus:context.includedBrillianceBonus});
    if(game.constellation>=2)hit.critRateFormula=createYanfeiC2CritRateFormula(a4?context.a4EnemyHpFraction:context.mainEnemyHpFraction);
    else if(hit.critRateFormula?.ruleId.startsWith("yanfei-c2-"))delete hit.critRateFormula;
  }
  result.assumptions.push(
    `${assumptionPrefix}单目标、主击实际命中敌人；有效丹火印在重击起手已存在且本次消耗 ${context.scarletSeals} 枚，C6 以下上限 3、C6 上限 4。未模拟产印、失效、体力或完整轮转。`,
    `${assumptionPrefix}A1 在本次重击排队前替换旧效果：从已填每段增伤移除旧 A1 ${context.priorA1BonusIncluded}，再加入已解锁时每印 5%；该数值必须确实已包含于每段手动增伤，默认零表示未含。`,
    `${assumptionPrefix}灼灼采用独立有效 Q 等级 ${context.brilliance.effectiveTalentLevel}，不再次加命座等级。每段先移除已含灼灼 ${context.includedBrillianceBonus}，再按各自有效状态加入来源倍率；主击${context.brilliance.mainActive?"有效":"无效"}，A4${context.brilliance.a4Active?"有效":"无效"}。`,
    `${assumptionPrefix}A4 已解锁且主击暴击时，只在主击回调仍在场才触发一次 80% ATK 重击标签火伤；追击有自己独立的暴击和反应。整次期望贡献 = 主击实际暴击概率 × 追击条件期望，非暴击整次无追击、全暴击整次有一次追击；单选 A4 表示已经触发的实际一击。`,
    `${assumptionPrefix}C2 分别读取主击前与 A4 前目标生命比例 ${context.mainEnemyHpFraction}/${context.a4EnemyHpFraction}，严格低于 0.5 才加 20% 暴击；不从主击伤害自动推算目标剩余血量。共享面板${context.statsStableToA4?"明确保持稳定":"未声明稳定"}；各段暴击独立且不把两段都蒸发作为默认。`,
    `${assumptionPrefix}固定源码仍有重击快照时机、Q 结束产印 TODO；A4 +10 帧独立快照不等于已完成实战时序验证。C1 体力、C4 护盾与 Q 产印/离场状态时间线不由本条件输入自动执行。`
  );
  return result;
}
