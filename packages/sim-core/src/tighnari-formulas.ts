import {expr} from './calculation-trace';
import type {CalculatorFormula} from './calculator-model';
export const TIGHNARI_DAMAGE_SOURCE_REFS=['aimed.go','asc.go','cons.go','burst.go','tighnari.go','zz_tighnari.dm.go'].map(file=>`https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/tighnari/${file}`);
const constant=(id:string,label:string,value:number):CalculatorFormula=>({ruleId:`tighnari-${id}-b4ae769`,label,expression:expr.value(value),inputs:[],sourceRefs:TIGHNARI_DAMAGE_SOURCE_REFS});
export const createTighnariEmAdjustment=(actual:number,included:number)=>constant('snapshot-em','本击快照：角色精通增益实际份额 − 原面板已含份额',actual-included);
export const createTighnariC1Crit=(included:number,unlocked=true)=>constant('c1-charged-crit','C1重击暴击率15% − 输入已含份额',(unlocked?.15:0)-included);
/** A4 is a live AttackMod, unlike Spread's snapshot EM. */
export function createTighnariDamageBonus(liveMinusSnapshotEm:number,c2:number,included:number,a4Unlocked:boolean):CalculatorFormula{
 return {ruleId:'tighnari-live-a4-and-c2-b4ae769',label:'A4命中时精通增伤＋C2草伤 − 输入已含份额',
 expression:expr.sub(expr.add(a4Unlocked?expr.min(expr.mul(expr.max(expr.add(expr.input('em'),expr.value(liveMinusSnapshotEm)),expr.value(0)),expr.value(.0006)),expr.value(.6)):expr.value(0),expr.value(c2)),expr.value(included)),inputs:[],sourceRefs:TIGHNARI_DAMAGE_SOURCE_REFS};
}
