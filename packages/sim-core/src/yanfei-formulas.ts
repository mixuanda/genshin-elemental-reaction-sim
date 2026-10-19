import type { CalculatorFormula } from "./calculator-model";
import { expr } from "./calculation-trace";

const root="https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
export const YANFEI_CHARGED_SOURCE_REFS=["charge.go","asc.go","cons.go","burst.go","yanfei.go","zz_yanfei.dm.go"].map(file=>`${root}/internal/characters/yanfei/${file}`);
const sourceInput=(key:string,value:number,unit="ratio")=>({key,value,unit,meaningKey:`input.${key}`,origin:"source-table"});
export function createYanfeiChargedBaseFormula(seals:number,coefficients:number[]):CalculatorFormula {
  let selected=expr.input("yanfeiCharge4");
  for(let index=3;index>=0;index--)selected=expr.condition("equal",expr.input("yanfeiSeals"),expr.value(index),expr.input(`yanfeiCharge${index}`),selected);
  return {ruleId:"yanfei-charged-seal-scaling-gcsim-b4ae769",label:`烟绯重击：按实际消耗 ${seals} 枚丹火印选择本级倍率`,expression:expr.mul(expr.input("atk"),selected),inputs:[{...sourceInput("yanfeiSeals",seals,"count"),origin:"conditioned-user-input",minimum:0,maximum:4,integer:true},...coefficients.map((value,index)=>sourceInput(`yanfeiCharge${index}`,value))],sourceRefs:YANFEI_CHARGED_SOURCE_REFS,requirements:{attackTags:["charged"]}};
}
export function createYanfeiDamageBonusFormula(input:{seals:number;ascension:number;priorA1BonusIncluded:number;brillianceActive:boolean;brillianceCoefficient:number;includedBrillianceBonus:number}):CalculatorFormula {
  return {ruleId:"yanfei-a1-brilliance-replacement-gcsim-b4ae769",label:"烟绯：本次重击先替换 A1，再结算本段灼灼与已含增伤",expression:expr.add(expr.sub(expr.mul(expr.input("yanfeiA1Unlocked"),expr.input("yanfeiSeals"),expr.input("yanfeiA1PerSeal")),expr.input("yanfeiIncludedOldA1")),expr.sub(expr.mul(expr.input("yanfeiBrillianceActive"),expr.input("yanfeiBrillianceBonus")),expr.input("yanfeiIncludedBrilliance"))),inputs:[sourceInput("yanfeiA1Unlocked",Number(input.ascension>=1),"boolean"),{...sourceInput("yanfeiSeals",input.seals,"count"),origin:"conditioned-user-input"},sourceInput("yanfeiA1PerSeal",.05),{...sourceInput("yanfeiIncludedOldA1",input.priorA1BonusIncluded),origin:"explicit-accounting"},{...sourceInput("yanfeiBrillianceActive",Number(input.brillianceActive),"boolean"),origin:"conditioned-user-input"},sourceInput("yanfeiBrillianceBonus",input.brillianceCoefficient),{...sourceInput("yanfeiIncludedBrilliance",input.includedBrillianceBonus),origin:"explicit-accounting"}],sourceRefs:YANFEI_CHARGED_SOURCE_REFS,requirements:{attackTags:["charged"]}};
}
export function createYanfeiC2CritRateFormula(enemyHpFraction:number):CalculatorFormula {
  return {ruleId:"yanfei-c2-enemy-hp-critical-rate-gcsim-b4ae769",label:"烟绯 C2：本段结算前目标生命严格低于 50% 时重击暴击率 +20%",expression:expr.condition("lt",expr.input("yanfeiEnemyHpFraction"),expr.input("yanfeiC2Threshold"),expr.input("yanfeiC2Rate"),expr.value(0)),inputs:[{...sourceInput("yanfeiEnemyHpFraction",enemyHpFraction),origin:"conditioned-user-input",minimum:0,maximum:1},sourceInput("yanfeiC2Threshold",.5),sourceInput("yanfeiC2Rate",.2)],requirements:{minimumConstellation:2,maximumConstellation:6,attackTags:["charged"]},sourceRefs:YANFEI_CHARGED_SOURCE_REFS};
}
