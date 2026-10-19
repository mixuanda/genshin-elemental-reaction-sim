import { THRILLING_TALES, thrillingTalesCoefficient } from "@genshin-dps-lab/reaction-formulas";
import { expr } from "./calculation-trace";
import { incomingThrillingTalesSchema, type CalculatorDocument, type CalculatorFormula, type IncomingThrillingTales } from "./calculator-model";

const prefix="incoming-ttds:",assumptionPrefix="外部讨龙条件：";
function createFormula(context:IncomingThrillingTales,active:boolean,includedRefinement:number,baseAttack:number|undefined):CalculatorFormula {
  const coefficient=thrillingTalesCoefficient(context.refinement),included=includedRefinement===0?0:thrillingTalesCoefficient(includedRefinement),same=Number(active)*coefficient===included;
  const inputs:CalculatorFormula["inputs"]=[
    {key:"ttdsActive",value:Number(active),allowedValues:[0,1],unit:"boolean",meaningKey:"此命中实际取样时是否已收到此来源的讨龙增益",origin:"derived-incoming-context",ownerId:context.ownerId},
    {key:"ttdsSourceCoefficient",value:coefficient,allowedValues:[coefficient],unit:"ratio",meaningKey:`${context.ownerLabel} R${context.refinement} 的固定来源攻击百分比`,origin:"source-table",ownerId:context.ownerId},
    {key:"ttdsIncludedCoefficient",value:included,allowedValues:[included],unit:"ratio",meaningKey:includedRefinement===0?"此击输入面板明确未含讨龙":`此击输入面板已含旧R${includedRefinement}讨龙的攻击百分比`,origin:"source-table"}
  ];
  if(!same)inputs.unshift({key:"ttdsBaseAttack",value:baseAttack!,minimum:0,unit:"stat",meaningKey:"接收者的角色白值＋武器白值，不含百分比或固定攻击",origin:"derived-incoming-context"});
  return {ruleId:"incoming-thrilling-tales-atk-accounting-b4ae769",label:same?`${context.ownerLabel} R${context.refinement}：实际讨龙份额${Number(active)*coefficient}＝面板已含${included}，ATK差为0，无需未知白值`:`${context.ownerLabel} R${context.refinement}：接收者基础ATK×（实际生效×来源比例−面板已含旧比例）`,expression:same?expr.value(0):expr.mul(expr.input("ttdsBaseAttack"),expr.sub(expr.mul(expr.input("ttdsActive"),expr.input("ttdsSourceCoefficient")),expr.input("ttdsIncludedCoefficient"))),inputs,sourceRefs:[...THRILLING_TALES.sourceRefs]};
}

/** Derives one incoming contribution per ordinary hit without overwriting that character's own ATK adjustment. */
export function prepareIncomingThrillingTales(document:CalculatorDocument):CalculatorDocument {
  const result=structuredClone(document);
  result.dependencies=result.dependencies.filter(row=>!row.id.startsWith(prefix));
  result.assumptions=result.assumptions.filter(row=>!row.startsWith(assumptionPrefix));
  const context=result.incomingThrillingTales?incomingThrillingTalesSchema.parse(result.incomingThrillingTales):undefined;
  if(context)result.incomingThrillingTales=context;
  const equipmentBase=result.build.mode==="equipment-derived"?result.build.characterBaseAtk+result.build.weaponBaseAtk:undefined;
  if(context&&equipmentBase!==undefined)context.baseAttack=equipmentBase;
  for(const hit of result.hits){
    hit.dependencies=hit.dependencies.filter(id=>!id.startsWith(prefix));
    if(hit.kind!=="ordinary")continue;
    delete hit.incomingThrillingTalesFormula;
    if(hit.finalSnapshot?.origin==="equipment-conversion")continue;
    if(!context)continue;
    const state=context.hitStates[hit.id]??={};
    const baseAttack=hit.finalSnapshot?state.baseAttack:equipmentBase??context.baseAttack;
    const reasons:string[]=[];
    if(state.active===undefined)reasons.push("缺少此命中实际取样时讨龙是否生效，不能把未知状态当作未生效。");
    if(state.includedRefinement===undefined)reasons.push("缺少此击输入面板已含讨龙的精炼份额；0才表示明确未含。");
    if(state.active!==undefined&&state.includedRefinement!==undefined){
      const actual=state.active?thrillingTalesCoefficient(context.refinement):0,included=state.includedRefinement===0?0:thrillingTalesCoefficient(state.includedRefinement);
      if(actual!==included&&baseAttack===undefined)reasons.push(hit.finalSnapshot?"该历史命中需要自身明确基础攻击；不能借用当前装备或共同面板白值。":"讨龙实际与已含份额不同，需要明确接收者基础攻击，不能从最终ATK反推。");
      else hit.incomingThrillingTalesFormula=createFormula(context,state.active,state.includedRefinement,baseAttack);
    }
    const id=`${prefix}${hit.id}`;hit.dependencies.push(id);
    result.dependencies.push({id,status:reasons.length?"missing":"provisional",reason:reasons.join("；")||"此命中已收到外部讨龙的条件与面板份额明确；只计算差额，不再次触发或叠加。",sourceRefs:[...THRILLING_TALES.sourceRefs]});
  }
  if(context)result.assumptions.push(`${assumptionPrefix}来源 ${context.ownerLabel}（${context.ownerId}）R${context.refinement} 为用户明确声明的外部持有者；不从接收者自持武器、当前队伍或当前前台推断切人领取。`,`${assumptionPrefix}每击按其实际取样时的有效状态与输入面板已含份额补差；只能有一个实际讨龙份额，旧R档用于去除已含记账，不能解释成两把同时叠加。`,`${assumptionPrefix}此处不执行切人、600帧增益或1200帧持有者冷却，不验证刷新、过期或角色卡肉；完整技能的各击状态分别提供。历史快照不借用当前装备白值。`);
  return result;
}

/** A newly imported panel cannot prove which old source share or base ATK it contains. */
export function resetIncomingThrillingTalesPanelAccounting(document:CalculatorDocument,mode:"fresh-equipment"|"imported-final"):void {
  const context=document.incomingThrillingTales;if(!context)return;
  if(mode==="imported-final")delete context.baseAttack;
  for(const [hitId,state] of Object.entries(context.hitStates)){
    const hit=document.hits.find(row=>row.id===hitId);
    if(hit?.kind==="ordinary"&&hit.finalSnapshot&&hit.finalSnapshot.origin!=="equipment-conversion")continue;
    if(mode==="fresh-equipment")state.includedRefinement=0;
    else {delete state.includedRefinement;delete state.baseAttack;}
  }
}
