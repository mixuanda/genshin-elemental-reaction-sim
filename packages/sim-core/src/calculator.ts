import { rawSourceStateTrace } from "./raw-source-state";
import { observedCharacterResourceTrace } from "./observed-character-resource";
import { alyoshaObservedTrace } from "./alyosha-observed-lifecycle";
import { neferObservedTrace } from "./nefer-observed-lifecycle";
import { linneaObservedTrace } from "./linnea-observed-lifecycle";
import { sandroneObservedTrace } from "./sandrone-observed-lifecycle";
import { observedZibaiResourceEventTrace } from "./observed-zibai-resource";
import { neferPhantasmEventTrace, neferPhantasmResourceTrace, neferPhantasmSpecialPanelProxy, resolveNeferPhantasmSpecialContext } from "./nefer-phantasm-formulas";
import { observedSpecialComponentEventTrace, observedSpecialComponentPanelProxy, resolveObservedSpecialComponentContext } from "./observed-special-component-formulas";
import { iansanSwiftResolvedEventTrace } from "./iansan-swift-resolved-formulas";
import { travelerHydroResolvedEventTrace } from "./traveler-hydro-resolved-formulas";
import { travelerCryoStateEventTrace, travelerCryoStateSpecialPanelProxy, resolveTravelerCryoStateSpecialContext } from "./traveler-cryo-state-formulas";
import { travelerCrossEntityEventTrace } from "./traveler-cross-entity-formulas";
import { zibaiFiniteEventTrace, resolveZibaiFiniteA4, resolveZibaiFinitePanel, resolveZibaiFiniteSpecialContext } from "./zibai-finite-formulas";
import { mixedSourceEventTrace, resolveMixedSourceSpecialContext, mixedSourceSpecialPanelProxy } from "./mixed-source-formulas";
import { noellePlungeEventTrace } from "./noelle-plunge-formulas";
import { extendedStanceEventTrace } from "./extended-stance-formulas";
import { entityFollowupEventTrace } from "./entity-followup-formulas";
import { prepareSourceCastDocument, finalizeSourceCastPanelAccounting } from "./source-cast-context";
import { coordinatedEventTrace } from "./coordinated-cast-formulas";
import { heldLifecycleEventTrace } from "./held-lifecycle-formulas";
import { idleStanceEventTrace } from "./idle-stance-formulas";
import { observedEntityEventTrace } from "./observed-entity-formulas";
import { periodicOrdinaryEventTrace } from "./periodic-ordinary-formulas";
import { travelerMaleChargedEventTrace } from "./traveler-male-charged-formulas";
import { prepareIncomingThrillingTales } from "./thrilling-tales-calculator";
import { prepareWeaponProcCalculatorDocument, getWeaponProcCoefficientFormula } from "./weapon-proc-calculator";
import { prepareColleiCharlotteSkillDocument } from "./collei-charlotte-formulas";
import { prepareBaizhuSkillDocument } from "./baizhu-formulas";
import { calculateSpecialCalculatorHit } from "./special-calculator";
import { CLASSIC_REACTION_FORMULA_PROFILE } from "@genshin-dps-lab/reaction-formulas";
import { calculatorDocumentSchema, type CalculatorAggregation, type CalculatorBuild, type CalculatorDocument, type CalculatorFinalStats, type CalculatorHit, type CalculatorHitResult, type CalculatorResult, type CalculatorFormula, type CalculatorPendingHitEffect, type CalculatorPendingReactionEffect, type CalculatorPendingResistanceEffect } from "./calculator-model";
import { calculateDamageTrace, calculateTransformativeDamageTrace, criticalMultiplierExpression, executeAdditiveDamage, executeOrdinaryDamage, DAMAGE_FORMULA_SOURCES } from "./calculator-formula";
import { evaluateFormulaExpression, expr, TraceBuilder, traceInput, type CalculationTraceNode, type FormulaExpression } from "./calculation-trace";
import type { DamageCalculationInput } from "./formulas";
import { evaluateCalculatorTrust, type CalculatorTrustContext } from "./calculator-trust";
export * from "./calculator-trust";
export * from "./calculator-model";
const v=expr.input, n=expr.value;
const weakPointComparisonExplanation="本击按弱点来源规则必定暴击。非暴击数值只是在移除弱点条件后的教学对照，本条件下不会发生；实际期望等于暴击伤害，真实面板暴击率仍保留。";
function criticalProbabilityTrace(builder:TraceBuilder,hitWeakPoint:boolean|undefined,critRate:number):number {
  if(hitWeakPoint===undefined)return critRate;
  return builder.add("criticalProbability","实际暴击发生概率",expr.condition("equal",v("hitWeakPoint"),n(1),n(1),v("critRate")),[
    traceInput("hitWeakPoint",Number(hitWeakPoint),"boolean","explicit-hit-context","input.hitWeakPoint"),
    traceInput("critRate",critRate,"ratio","resolved-critical-stat","input.critRate")
  ],{unit:"ratio",explanationKey:"弱点来源条件成立时，本击暴击的发生概率为1；其余情况使用限幅后的真实面板与适用增益暴击率，不改写面板。",sourceRefs:DAMAGE_FORMULA_SOURCES});
}
function panelUnit(key:string):"percent"|"ratio"|"stat" {
  if(key==="percentage")return "percent";
  return /Percent$/.test(key)||["critRate","critDamage","energyRecharge","energyRechargeBonus","erRatio"].includes(key)?"ratio":"stat";
}
function sourcePropertyUnit(property:string):"ratio"|"stat" {
  return ["FIGHT_PROP_HP","FIGHT_PROP_ATTACK","FIGHT_PROP_DEFENSE","FIGHT_PROP_ELEMENT_MASTERY","FIGHT_PROP_NONE"].includes(property)?"stat":"ratio";
}
type ContextFormula=Pick<CalculatorFormula,"label"|"expression"|"inputs"|"sourceRefs"> & {ruleId?:string};
function panelBindings(stats:CalculatorFinalStats):Record<string,number> {
  return {atk:stats.atk,hp:stats.hp,def:stats.def,em:stats.em,...(stats.energyRecharge===undefined?{}:{erRatio:stats.energyRecharge})};
}
function formulaUsesVariable(expression:FormulaExpression,key:string):boolean {
  switch(expression.kind){
    case "variable":return expression.key===key;
    case "constant":return false;
    case "lookup":return expression.indices.some(index=>formulaUsesVariable(index,key));
    case "add":case "multiply":case "min":case "max":return expression.terms.some(term=>formulaUsesVariable(term,key));
    case "subtract":case "divide":return formulaUsesVariable(expression.left,key)||formulaUsesVariable(expression.right,key);
    case "truncate":return formulaUsesVariable(expression.value,key);
    case "clamp":return [expression.value,expression.min,expression.max].some(term=>formulaUsesVariable(term,key));
    case "condition":return [expression.left,expression.right,expression.whenTrue,expression.whenFalse].some(term=>formulaUsesVariable(term,key));
  }
}
type FormulaScope={ascension?:number;constellation?:number};
function hitFormulaScope(build:CalculatorBuild,document?:Pick<CalculatorDocument,"gameContext">):FormulaScope {
  const ascension=(build.mode==="equipment-derived"?build.equipment?.ascension:build.ascension)??document?.gameContext?.ascension;
  const constellation=document?.gameContext?.constellation;
  return {...(ascension===undefined?{}:{ascension}),...(constellation===undefined?{}:{constellation})};
}
function formulaApplies(formula:CalculatorFormula,hit:CalculatorHit,scope:FormulaScope):boolean {
  const req=formula.requirements;
  return (!req?.minimumAscension||(scope.ascension!==undefined&&scope.ascension>=req.minimumAscension))&&(!req?.elements||(hit.kind==="ordinary"&&req.elements.includes(hit.element)))&&(!req?.attackTags||(hit.kind==="ordinary"&&hit.attackTag!==undefined&&req.attackTags.includes(hit.attackTag)));
}
function formulaConstellationBlockers(formula:CalculatorFormula,scope:FormulaScope):string[] {
  const blockers:string[]=[],req=formula.requirements;
  if(req?.minimumConstellation!==undefined&&(scope.constellation===undefined||scope.constellation<req.minimumConstellation))blockers.push(`${formula.label}：需要明确且不低于 C${req.minimumConstellation} 的命座；当前文档的来源参数不能用于更低命座。`);
  if(req?.maximumConstellation!==undefined&&(scope.constellation===undefined||scope.constellation>req.maximumConstellation))blockers.push(`${formula.label}：需要明确且不高于 C${req.maximumConstellation} 的命座；更高命座使用不同来源参数。`);
  return blockers;
}
function formulaBlockers(formula:CalculatorFormula,hit:CalculatorHit,stats:CalculatorFinalStats|undefined,scope:FormulaScope):string[] {
  const blockers:string[]=[],req=formula.requirements;
  if(formulaApplies(formula,hit,scope)&&formulaUsesVariable(formula.expression,"erRatio")&&stats?.energyRecharge===undefined)blockers.push(`${formula.label}：缺少明确的最终元素充能效率，不能默认100%。`);
  // A known locked passive does not depend on its higher-constellation parameters.
  if(req?.minimumAscension!==undefined&&scope.ascension!==undefined&&scope.ascension<req.minimumAscension)return blockers;
  if(req?.minimumAscension!==undefined&&scope.ascension===undefined)blockers.push(`${formula.label}：缺少明确突破阶段。`);
  blockers.push(...formulaConstellationBlockers(formula,scope));
  if(req?.attackTags&&hit.kind==="ordinary"&&hit.attackTag===undefined)blockers.push(`${formula.label}：缺少本段的已分类攻击类型。`);
  return blockers;
}
function criticalFormulaBlockers(hit:Extract<CalculatorHit,{kind:"ordinary"}>,stats:CalculatorFinalStats,scope:FormulaScope):string[] {
  if(!hit.critEligible)return [];
  return ([{formula:hit.critRateFormula,override:hit.effectiveCritRate},{formula:hit.critDamageFormula,override:hit.effectiveCritDamage}]).flatMap(({formula,override})=>{
    if(!formula)return [];
    if(override!==undefined)return formulaConstellationBlockers(formula,scope);
    if(formula.requirements?.elements&&!formula.requirements.elements.includes(hit.element))return [];
    if(formula.requirements?.attackTags&&hit.attackTag!==undefined&&!formula.requirements.attackTags.includes(hit.attackTag))return [];
    return formulaBlockers(formula,hit,stats,scope);
  });
}
function executeContextFormula(builder:TraceBuilder,id:string,titleKey:string,formula:ContextFormula,bindings:Record<string,number>,unit="stat",explanationKey="explain.contextFormula"):number {
  const panelInputs=Object.entries(bindings).map(([key,value])=>traceInput(key,value,key==="erRatio"?"ratio":"stat","resolved-context",`input.${key}`));
  const contextInputs=formula.inputs.map(input=>({...traceInput(input.key,input.value,input.unit,input.origin,input.meaningKey),...(input.ownerId?{context:{ownerId:input.ownerId}}:{})}));
  return builder.add(id,titleKey,formula.expression,[...panelInputs,...contextInputs],{unit,ruleId:formula.ruleId??id,explanationKey,sourceRefs:formula.sourceRefs,applicabilityReason:formula.label});
}
function executeHitElementalMastery(stats:CalculatorFinalStats,hit:Extract<CalculatorHit,{kind:"ordinary"}>,scope:FormulaScope,b:TraceBuilder):CalculatorFinalStats {
  const adjustment=hit.elementalMasteryAdjustment;
  if(!adjustment)return stats;
  const {formula,accounting}=adjustment,add=accounting==="add-to-panel",blockers=add?formulaBlockers(formula,hit,stats,scope):formulaConstellationBlockers(formula,scope);
  if(blockers.length)throw new Error(blockers.join("；"));
  const contribution=add&&formulaApplies(formula,hit,scope)?executeContextFormula(b,"sourceElementalMasteryAdjustment","stage.sourceElementalMasteryAdjustment",formula,panelBindings(stats),"stat","explain.sourceElementalMasteryAdjustment"):b.add("sourceElementalMasteryAdjustment","stage.sourceElementalMasteryAdjustment",n(0),[],{unit:"stat",status:"not-applicable",ruleId:formula.ruleId,sourceRefs:formula.sourceRefs,explanationKey:"explain.sourceElementalMasteryAdjustment",applicabilityReason:!add?`${formula.label}：精通已含在最终面板，来源分解不再执行，不反推未知突破或历史快照。`:`${formula.label}：当前突破或伤害类型不满足生效条件。`});
  const em=b.add("hitElementalMastery","stage.hitElementalMastery",expr.add(v("panelElementalMastery"),expr.mul(v("sourceElementalMastery"),v("addToPanel"))),[traceInput("panelElementalMastery",stats.em,"stat","resolved-panel","input.panelElementalMastery"),traceInput("sourceElementalMastery",contribution,"stat","previous-step","input.sourceElementalMastery"),traceInput("addToPanel",Number(add),"boolean","explicit-accounting","input.addToPanel")],{unit:"stat",status:add?"applied":"not-applicable",sourceRefs:formula.sourceRefs,explanationKey:"explain.hitElementalMastery",childIds:["sourceElementalMasteryAdjustment"],applicabilityReason:add?"本段来源精通尚未包含于面板，加入后同时用于基础缩放、来源被动及精通反应；不改变其他命中。":"已明确包含于最终面板：保留来源公式而不执行，不再次加入或反推未知分解。"});
  return {...stats,em};
}
/** Source flat ATK is added after the panel, never multiplied by ATK%; historical inputs stay explicit. */
function executeHitAttack(stats:CalculatorFinalStats,hit:Extract<CalculatorHit,{kind:"ordinary"}>,scope:FormulaScope,b:TraceBuilder):CalculatorFinalStats {
  const adjustment=hit.attackAdjustment;
  if(!adjustment)return stats;
  const {formula,accounting}=adjustment,add=accounting==="add-to-panel";
  const blockers=add?formulaBlockers(formula,hit,stats,scope):formulaConstellationBlockers(formula,scope);
  if(blockers.length)throw new Error(blockers.join("；"));
  const contribution=add&&formulaApplies(formula,hit,scope)?executeContextFormula(b,"sourceAttackAdjustment","stage.sourceAttackAdjustment",formula,panelBindings(stats),"stat","explain.sourceAttackAdjustment"):b.add("sourceAttackAdjustment","stage.sourceAttackAdjustment",n(0),[],{unit:"stat",status:"not-applicable",ruleId:formula.ruleId,sourceRefs:formula.sourceRefs,explanationKey:"explain.sourceAttackAdjustment",applicabilityReason:!add?`${formula.label}：攻击力已含在明确的最终面板，不执行或重采历史防御快照，不再追加。`:`${formula.label}：本段不满足来源条件。`});
  const atk=b.add("hitAttack","stage.hitAttack",expr.add(v("panelAttack"),v("sourceAttack")),[traceInput("panelAttack",stats.atk,"stat","resolved-panel","input.panelAttack"),traceInput("sourceAttack",contribution,"stat","previous-step","input.sourceAttack")],{unit:"stat",status:add?"applied":"not-applicable",sourceRefs:formula.sourceRefs,childIds:["sourceAttackAdjustment",...(hit.incomingThrillingTalesFormula?["afterIncomingThrillingTales"]:[])],explanationKey:"explain.hitAttack",applicabilityReason:add?"来源固定攻击力仅加入本段一次，不套用攻击力百分比；其他命中的状态独立。":"使用已包含转换的最终攻击力，保留原式但不重复应用。"});
  return {...stats,atk};
}
function executeIncomingThrillingTales(stats:CalculatorFinalStats,hit:Extract<CalculatorHit,{kind:"ordinary"}>,b:TraceBuilder):CalculatorFinalStats {
  const formula=hit.incomingThrillingTalesFormula;if(!formula)return stats;
  const contribution=executeContextFormula(b,"incomingThrillingTalesAdjustment","stage.sourceAttackAdjustment",formula,{},"stat","explain.sourceAttackAdjustment");
  const atk=b.add("afterIncomingThrillingTales","stage.hitAttack",expr.add(v("panelAttack"),v("incomingThrillingTalesAttack")),[traceInput("panelAttack",stats.atk,"stat","resolved-panel","input.panelAttack"),traceInput("incomingThrillingTalesAttack",contribution,"stat","previous-step","接收讨龙相对输入面板已含份额的实际ATK差")],{unit:"stat",sourceRefs:formula.sourceRefs,childIds:["incomingThrillingTalesAdjustment"],explanationKey:"explain.hitAttack",applicabilityReason:"先按接收者基础攻击换算讨龙百分比差额，再加入本击面板；角色自身来源调整独立继续计算。"});
  return {...stats,atk};
}
function sourceSpecialPanelProxy(doc:CalculatorDocument,hit:Extract<CalculatorHit,{kind:"special"}>):OrdinaryCalculatorHit|undefined {
  if(hit.neferPhantasmEvent)return neferPhantasmSpecialPanelProxy(doc,hit);
  if(hit.observedSpecialComponentEvent)return observedSpecialComponentPanelProxy(doc,hit);
  if(hit.travelerCryoStateEvent)return travelerCryoStateSpecialPanelProxy(doc,hit);
  if(hit.zibaiFiniteEvent&&!hit.finalSnapshot)return {id:hit.id,label:hit.label,kind:"ordinary",element:"geo",terms:[{stat:"def",coefficient:1}],additiveBaseDamage:0,damageBonus:0,critEligible:true,reaction:"none",reactionBonus:0,groupMultiplier:1,sourceRefs:hit.sourceRefs,dependencies:[],zibaiFiniteEvent:hit.zibaiFiniteEvent};
  return mixedSourceSpecialPanelProxy(doc,hit);
}
function sourceSpecialContext(doc:CalculatorDocument,hit:Extract<CalculatorHit,{kind:"special"}>,panel:CalculatorFinalStats,adjusted:boolean) {
  if(hit.neferPhantasmEvent)return resolveNeferPhantasmSpecialContext(doc,hit,panel,adjusted);
  if(hit.observedSpecialComponentEvent)return resolveObservedSpecialComponentContext(doc,hit,panel,adjusted);
  if(hit.travelerCryoStateEvent)return resolveTravelerCryoStateSpecialContext(doc,hit,panel,adjusted);
  if(hit.zibaiFiniteEvent)return resolveZibaiFiniteSpecialContext(doc,hit,panel,adjusted);
  return resolveMixedSourceSpecialContext(doc,hit,panel,adjusted);
}
/** Reuse the equipment phase snapshots with this hit's live EM; explicit historical inputs never change. */
function executeHitPanel(build:CalculatorBuild,stats:CalculatorFinalStats,hit:Extract<CalculatorHit,{kind:"ordinary"}>,scope:FormulaScope,b:TraceBuilder,documentContext?:Pick<CalculatorDocument,"gameContext">) {
  const sourceContext={build,gameContext:documentContext?.gameContext};
  const sourceA4=hit.zibaiFiniteEvent?resolveZibaiFiniteA4(sourceContext,hit):undefined;
  const sourcePanel=sourceA4&&build.mode!=="equipment-derived"?resolveZibaiFinitePanel(sourceContext,hit,stats):undefined;
  for(const node of sourcePanel?.trace??sourceA4?.trace??[]) b.add(node.id,node.titleKey,node.expression,node.inputs,{
    ruleId:node.ruleId,explanationKey:node.explanationKey,status:node.status,unit:node.result!.unit,
    childIds:node.childIds,sourceRefs:node.sourceRefs,warnings:node.warnings,
    ...(node.applicabilityReason===undefined?{}:{applicabilityReason:node.applicabilityReason})});
  const sourceBlockers=sourcePanel?.blockers??sourceA4?.blockers??[];
  if(sourceBlockers.length)throw new Error(sourceBlockers.join("；"));
  const incoming=executeIncomingThrillingTales(sourcePanel?.stats??stats,hit,b);
  const mastery=executeHitElementalMastery(incoming,hit,scope,b);
  const sourceBuild=build.mode==="equipment-derived"?build:undefined;
  const baseline=sourceBuild?buildStats(sourceBuild):undefined;
  const delta=mastery.em-incoming.em+(sourceBuild?sourceA4?.elementalMasteryDelta??0:0);
  const defenseDelta=sourceBuild?sourceA4?.defensePercentDelta??0:0;
  const sourceChanged=delta!==0||defenseDelta!==0;
  const panel=baseline&&sourceChanged?buildStats(sourceBuild!,delta,defenseDelta):baseline;
  let resolved=mastery;
  if(panel&&panel!==baseline){
    for(const node of [...prefixTrace(baseline!.trace,"sharedEquipment"),...prefixTrace(panel.trace,"hitEquipment")])b.add(node.id,node.titleKey,node.expression,node.inputs,{
      ruleId:node.ruleId,explanationKey:node.explanationKey,status:node.status,unit:node.result!.unit,childIds:node.childIds,sourceRefs:node.sourceRefs,warnings:node.warnings,
      ...(node.parentId===undefined?{}:{parentId:node.parentId}),...(node.applicabilityReason===undefined?{}:{applicabilityReason:node.applicabilityReason})
    });
    resolved={...incoming};
    for(const key of Object.keys(panel.stats) as Array<keyof CalculatorFinalStats>){
      const before=baseline!.stats[key],after=panel.stats[key],supplied=incoming[key];
      if(before===undefined||after===undefined||supplied===undefined)continue;
      resolved[key]=b.add(`hitEquipmentStat.${key}`,"stage.hitEquipmentStat",expr.add(v("panelValue"),expr.sub(v("hitEquipmentValue"),v("sharedEquipmentValue"))),[
        traceInput("panelValue",supplied,panelUnit(key),"resolved-panel",`input.${key}`),
        traceInput("hitEquipmentValue",after,panelUnit(key),"per-hit-equipment-phases",`input.${key}`),
        traceInput("sharedEquipmentValue",before,panelUnit(key),"shared-equipment-phases",`input.${key}`)
      ],{unit:panelUnit(key),ruleId:"per-hit-equipment-mastery-phases",sourceRefs:sourceBuild!.equipment?.sourceRefs??[],explanationKey:"按同一装备阶段重建本击精通与防御百分比对应的属性，仅把相对共同面板的差额加入一次；显式历史快照输入保持原值。",childIds:[...(hit.elementalMasteryAdjustment?["hitElementalMastery"]:[]),...(sourceA4?["zibai.a4DefenseDelta","zibai.a4ElementalMasteryDelta"]:[]),...panel.trace.filter(node=>node.id===`final${key[0]!.toUpperCase()}${key.slice(1)}`||key==="energyRecharge"&&node.id==="energyRecharge").map(node=>`hitEquipment.${node.id}`)]});
    }
  }
  const hitStats=executeHitAttack(resolved,hit,scope,b);
  const equipment=sourceBuild?.equipment;
  const changedStats=sourceChanged&&panel&&baseline&&(Object.keys(panel.stats) as Array<keyof CalculatorFinalStats>).some(key=>panel.stats[key]!==undefined&&baseline.stats[key]!==undefined&&panel.stats[key]!==baseline.stats[key]!+(key==="em"?delta:0));
  const changedBonuses=sourceChanged&&equipment&&panel&&baseline&&[...(equipment.dynamicHitBonuses??[]),...(equipment.additiveBaseBonuses??[]),...(equipment.criticalBonuses??[]).filter(rule=>hit.critEligible&&(rule.target==="critRate"?hit.effectiveCritRate:hit.effectiveCritDamage)===undefined)]
    .filter(rule=>equipmentHitExclusions(equipment,hit,rule).length===0)
    .some(rule=>{
      const inputs=Object.fromEntries(rule.inputs.map(input=>[input.key,input.value]));
      const bindings=(value:typeof panel)=>rule.inputPolicy==="final-panel"?value!.finalBindings:value!.preConversionBindings;
      return evaluateFormulaExpression(rule.expression,{...bindings(panel),...inputs})!==evaluateFormulaExpression(rule.expression,{...bindings(baseline),...inputs});
    });
  return {stats:hitStats,rebuiltEquipment:sourceChanged&&Boolean(changedStats||changedBonuses||sourceA4),preConversionBindings:panel?.preConversionBindings??panelBindings(hitStats),finalBindings:{...panel?.finalBindings,...panelBindings(hitStats)}};
}
function buildStats(build:CalculatorBuild,hitElementalMastery=0,hitDefensePercent=0) {
  const b=new TraceBuilder(DAMAGE_FORMULA_SOURCES);
  const step=(id:string,formula:FormulaExpression,values:Record<string,number>,unit="stat") => b.add(id,`stage.${id}`,formula,Object.entries(values).map(([key,value])=>traceInput(key,value,panelUnit(key),build.mode,`input.${key}`)),{explanationKey:`explain.${id}`,unit,childIds:b.nodes.filter(node=>Object.keys(values).includes(node.id)).map(node=>node.id)});
  const pct=(id:string,value:number)=>step(id,expr.div(v("percentage"),n(100)),{percentage:value*100},"ratio");
  let stats:CalculatorFinalStats;
  let preConversionBindings:Record<string,number>={};
  let finalBindings:Record<string,number>={};
  if(build.mode==="equipment-derived") {
    const bases={characterBaseAtk:build.characterBaseAtk,weaponBaseAtk:build.weaponBaseAtk,baseHp:build.baseHp,baseDef:build.baseDef};
    for(const entry of build.equipment?.derivedStats??[]) {
      const resolved=b.add(`equipment.${entry.id}`,`stage.equipment.${entry.id}`,expr.add(expr.mul(v("baseStat"),v("levelCurve")),v("ascensionBonus")),[traceInput("baseStat",entry.base,"stat","source-table","input.baseStat"),traceInput("levelCurve",entry.curve,"ratio","source-table","input.levelCurve"),traceInput("ascensionBonus",entry.promotion,"stat","source-table","input.ascensionBonus")],{unit:"stat",explanationKey:"explain.equipmentStat",sourceRefs:[entry.sourceRef]});
      if(entry.id!=="weaponSecondary") {
        if(Math.abs(resolved-build[entry.id])>1e-8)throw new Error(`装备推导 ${entry.label} 与当前基础数值不一致；请重新选择装备或改用手动最终面板。`);
        bases[entry.id]=resolved;
      }
    }
    const values={atkPercent:build.atkPercent,flatAtk:build.flatAtk,hpPercent:build.hpPercent,flatHp:build.flatHp,defPercent:build.defPercent,flatDef:build.flatDef,em:build.em,critRate:build.critRate,critDamage:build.critDamage,energyRechargeBonus:build.energyRechargeBonus??0};
    if(build.equipment) {
      const sourceSums=new Map<string,number>();
      const properties=[...new Set(build.equipment.secondaryContributions.map(entry=>entry.property))];
      for(const property of properties) {
        const entries=build.equipment.secondaryContributions.filter(entry=>entry.property===property);
        const unit=sourcePropertyUnit(property);
        const value=b.add(`source.${property}`,`stage.source.${property}`,expr.add(...entries.map((_,i)=>v(`source${i+1}`))),entries.map((entry,i)=>traceInput(`source${i+1}`,entry.value,unit,{kind:"source-table",reference:entry.sourceRef},`input.${property}`)),{unit,explanationKey:"explain.sourceContributions",sourceRefs:entries.map(entry=>entry.sourceRef)});
        sourceSums.set(property,value);
      }
      const propertyByField={atkPercent:"FIGHT_PROP_ATTACK_PERCENT",flatAtk:"FIGHT_PROP_ATTACK",hpPercent:"FIGHT_PROP_HP_PERCENT",flatHp:"FIGHT_PROP_HP",defPercent:"FIGHT_PROP_DEFENSE_PERCENT",flatDef:"FIGHT_PROP_DEFENSE",em:"FIGHT_PROP_ELEMENT_MASTERY",critRate:"FIGHT_PROP_CRITICAL",critDamage:"FIGHT_PROP_CRITICAL_HURT",energyRechargeBonus:"FIGHT_PROP_CHARGE_EFFICIENCY"} as const;
      if(build.energyRechargeBonus===undefined)values.energyRechargeBonus=sourceSums.get("FIGHT_PROP_CHARGE_EFFICIENCY")??0;
      for(const field of Object.keys(propertyByField) as Array<keyof typeof propertyByField>) {
        const property=propertyByField[field],sourceValue=sourceSums.get(property)??0,unit=panelUnit(field);
        const manual=b.add(`manual.${field}`,`stage.manual.${field}`,expr.sub(v("enteredValue"),v("sourceValue")),[traceInput("enteredValue",values[field],unit,"user-panel",`input.${field}`),traceInput("sourceValue",sourceValue,unit,"source-sum",`input.${property}`)],{unit,explanationKey:"explain.manualAdjustment",childIds:sourceSums.has(property)?[`source.${property}`]:[]});
        values[field]=b.add(`resolved.${field}`,`stage.resolved.${field}`,expr.add(v("sourceValue"),v("manualAdjustment")),[traceInput("sourceValue",sourceValue,unit,"source-sum",`input.${property}`),traceInput("manualAdjustment",manual,unit,"manual-adjustment",`input.${field}`)],{unit,explanationKey:"explain.resolvedContribution",childIds:[`manual.${field}`,...(sourceSums.has(property)?[`source.${property}`]:[])]});
      }
    }
    if(hitElementalMastery!==0)values.em=b.add("hitElementalMasteryInput","stage.hitElementalMasteryInput",expr.add(v("equipmentElementalMastery"),v("sourceElementalMastery")),[traceInput("equipmentElementalMastery",values.em,"stat","resolved-equipment-input","input.em"),traceInput("sourceElementalMastery",hitElementalMastery,"stat","per-hit-source-adjustment","input.sourceElementalMastery")],{unit:"stat",explanationKey:"本击新增精通在装备 pre-panel 与 conversion 阶段前加入；同阶段转换仍读取同一份阶段快照。"});
    if(hitDefensePercent!==0)values.defPercent=b.add("hitDefensePercentInput","本击来源防御百分比进入装备属性阶段",expr.add(v("equipmentDefensePercent"),v("sourceDefensePercent")),[traceInput("equipmentDefensePercent",values.defPercent,"ratio","resolved-equipment-input","输入防御百分比"),traceInput("sourceDefensePercent",hitDefensePercent,"ratio","per-hit-source-adjustment","实际来源防御百分比补差")],{unit:"ratio",explanationKey:"本击防御百分比在装备 pre-panel 与 conversion 前加入；所有转换读取同一阶段快照。"});
    const baseAtk=step("baseAtk",expr.add(v("characterBaseAtk"),v("weaponBaseAtk")),{characterBaseAtk:bases.characterBaseAtk,weaponBaseAtk:bases.weaponBaseAtk});
    const modifiers=build.equipment?.statModifiers??[];
    const snapshot=(prefix:string):Record<string,number>=>({
      atk:step(`${prefix}.atk`,expr.add(expr.mul(v("baseAtk"),expr.add(n(1),v("atkPercent"))),v("flatAtk")),{baseAtk,atkPercent:values.atkPercent,flatAtk:values.flatAtk}),
      hp:step(`${prefix}.hp`,expr.add(expr.mul(v("baseHp"),expr.add(n(1),v("hpPercent"))),v("flatHp")),{baseHp:bases.baseHp,hpPercent:values.hpPercent,flatHp:values.flatHp}),
      def:step(`${prefix}.def`,expr.add(expr.mul(v("baseDef"),expr.add(n(1),v("defPercent"))),v("flatDef")),{baseDef:bases.baseDef,defPercent:values.defPercent,flatDef:values.flatDef}),
      em:step(`${prefix}.em`,v("em"),{em:values.em}),
      baseAtk,
      erRatio:step(`${prefix}.erRatio`,expr.add(n(1),v("energyRechargeBonus")),{energyRechargeBonus:values.energyRechargeBonus},"ratio")
    });
    const applyModifier=(modifier:(typeof modifiers)[number],bindings:Record<string,number>)=>{
      const unit=panelUnit(modifier.target);
      const amount=executeContextFormula(b,`modifier.${modifier.id}`,"stage.equipmentStatModifier",{...modifier,ruleId:modifier.id},bindings,unit);
      values[modifier.target]=b.add(`applied.${modifier.id}`,"stage.appliedStatModifier",expr.add(v("previousValue"),v("modifierValue")),[traceInput("previousValue",values[modifier.target],unit,"previous-step",`input.${modifier.target}`),traceInput("modifierValue",amount,unit,"equipment-formula",`input.${modifier.target}`)],{unit,explanationKey:"explain.appliedStatModifier",childIds:[`modifier.${modifier.id}`],applicabilityReason:modifier.label,sourceRefs:modifier.sourceRefs});
    };
    if(modifiers.some(modifier=>modifier.phase==="pre-panel")){
      const prePanel=snapshot("prePanel");
      for(const modifier of modifiers.filter(modifier=>modifier.phase==="pre-panel"))applyModifier(modifier,prePanel);
    }
    if(modifiers.some(modifier=>modifier.phase==="conversion")||(build.equipment?.dynamicHitBonuses?.length??0)>0){
      preConversionBindings=snapshot("preConversion");
      for(const modifier of modifiers.filter(modifier=>modifier.phase==="conversion"))applyModifier(modifier,preConversionBindings);
    }
    const atkPercent=pct("atkPercent",values.atkPercent);
    const atk=step("finalAtk",expr.add(expr.mul(v("baseAtk"),expr.add(n(1),v("atkPercent"))),v("flatAtk")),{baseAtk,atkPercent,flatAtk:values.flatAtk});
    const hp=step("finalHp",expr.add(expr.mul(v("baseHp"),expr.add(n(1),v("hpPercent"))),v("flatHp")),{baseHp:bases.baseHp,hpPercent:values.hpPercent,flatHp:values.flatHp});
    const def=step("finalDef",expr.add(expr.mul(v("baseDef"),expr.add(n(1),v("defPercent"))),v("flatDef")),{baseDef:bases.baseDef,defPercent:values.defPercent,flatDef:values.flatDef});
    const erRatio=step("energyRecharge",expr.add(n(1),v("energyRechargeBonus")),{energyRechargeBonus:values.energyRechargeBonus},"ratio");
    stats={atk,hp,def,em:values.em,critRate:values.critRate,critDamage:values.critDamage,energyRecharge:erRatio};
    finalBindings={atk,hp,def,em:values.em,baseAtk,erRatio};
    if(!Object.keys(preConversionBindings).length)preConversionBindings={...finalBindings};
  } else {
    stats={...build.stats};
    finalBindings={atk:stats.atk,hp:stats.hp,def:stats.def,em:stats.em,...(stats.energyRecharge===undefined?{}:{erRatio:stats.energyRecharge})};
    preConversionBindings={...finalBindings};
    for(const [key,value] of Object.entries(stats)) if(value!==undefined)step(`supplied.${key}`,v(key),{[key]:value},panelUnit(key));
  }
  pct("critRatePercent",stats.critRate); pct("critDamagePercent",stats.critDamage);
  for(const [key,value] of Object.entries(stats)) if(value!==undefined&&(!Number.isFinite(value)||((key!=="critRate")&&value<0))) throw new RangeError(`Resolved ${key} must be finite and non-negative`);
  return {stats,trace:b.nodes,preConversionBindings,finalBindings};
}
export function resolveCalculatorStats(build:CalculatorBuild):CalculatorFinalStats { return buildStats(build).stats; }
/** Shared panel execution for equipment previews; identical AST to skill calculations. */
export function resolveCalculatorBuildTrace(build:CalculatorBuild): {stats:CalculatorFinalStats;trace:CalculationTraceNode[]} { const {stats,trace}=buildStats(build); return {stats,trace}; }
function prefixTrace(nodes:CalculationTraceNode[],prefix:string):CalculationTraceNode[] {
  return nodes.map(node=>({...node,id:`${prefix}.${node.id}`,childIds:node.childIds.map(id=>`${prefix}.${id}`),...(node.parentId===undefined?{}:{parentId:`${prefix}.${node.parentId}`})}));
}
function infoNode(id:string,reason:string,status:"not-applicable"|"blocked"="not-applicable"):CalculationTraceNode {
  return {id,ruleId:id,titleKey:`stage.${id}`,explanationKey:`explain.${id}`,status,expression:n(0),symbolicFormula:"不适用",substitution:"未执行数值公式",inputs:[],childIds:[],sourceRefs:[],warnings:[],applicabilityReason:reason};
}
const requiredElement:Record<string,string>={melt:"pyro",reverseMelt:"cryo",vaporize:"hydro",reverseVaporize:"pyro",aggravate:"electro",spread:"dendro"};
type OrdinaryCalculatorHit=Extract<CalculatorHit,{kind:"ordinary"}>;
/** Restore recorded offense without re-reading current gear or reapplying its finalized effects. */
function finalSnapshotContext(hit:OrdinaryCalculatorHit):{build:CalculatorBuild;hit:OrdinaryCalculatorHit}|undefined {
  const saved=hit.finalSnapshot;if(!saved)return undefined;
  const restored=structuredClone(hit);
  delete restored.finalSnapshot;delete restored.finalizedEquipmentEffects;delete restored.finalizedEquipmentBaseInput;delete restored.pendingEquipmentEffects;delete restored.pendingReactionEffects;
  delete restored.attackAdjustment;delete restored.elementalMasteryAdjustment;
  if(saved.origin==="equipment-conversion")delete restored.incomingThrillingTalesFormula;
  restored.damageBonus=saved.damageBonus;restored.additiveBaseDamage=saved.additiveBaseDamage;restored.reactionBonus=saved.reactionBonus;
  restored.effectiveCritRate=saved.stats.critRate;restored.effectiveCritDamage=saved.stats.critDamage;
  return {build:{mode:"manual-final",stats:saved.stats,ascension:saved.ascension,source:saved.source},hit:restored};
}
type EquipmentMetadata=NonNullable<Extract<CalculatorBuild,{mode:"equipment-derived"}>["equipment"]>;
type EquipmentHitFormula=NonNullable<EquipmentMetadata["additiveBaseBonuses"]>[number];
export function getCalculatorHitPendingEquipmentEffects(build:CalculatorBuild,hit:CalculatorHit):CalculatorPendingHitEffect[] {
  if(hit.kind!=="ordinary"||hit.finalSnapshot)return [];
  const equipment=build.mode==="equipment-derived"?build.equipment:undefined;
  const candidates=[...(hit.pendingEquipmentEffects??[]),...(equipment?.pendingHitEffects??[])];
  return [...new Map(candidates.filter(effect=>{
    if(effect.elements&&!effect.elements.includes(hit.element))return false;
    if(effect.attackTags&&hit.attackTag!==undefined&&!effect.attackTags.includes(hit.attackTag))return false;
    if(effect.weaponTypes&&equipment?.weaponType!==undefined&&!effect.weaponTypes.includes(equipment.weaponType))return false;
    if((effect.kind==="critRate"||effect.kind==="critDamage")&&(!hit.critEligible||(effect.kind==="critRate"?hit.effectiveCritRate:hit.effectiveCritDamage)!==undefined))return false;
    return true;
  }).map(effect=>[effect.id,effect])).values()];
}
function pendingEquipmentReason(effect:Pick<CalculatorPendingHitEffect,"label"|"id"|"reason">):string {return `${effect.label}（${effect.id}）：${effect.reason}`;}
function equipmentHitExclusions(equipment:EquipmentMetadata,hit:OrdinaryCalculatorHit,formula:Pick<EquipmentHitFormula,"elements"|"attackTags"|"weaponTypes">):string[] {
  const reasons:string[]=[];
  if(formula.elements&&!formula.elements.includes(hit.element))reasons.push("伤害元素不适用");
  if(formula.attackTags&&(!hit.attackTag||!formula.attackTags.includes(hit.attackTag)))reasons.push("攻击标签不适用或尚未分类");
  if(formula.weaponTypes&&(!equipment.weaponType||!formula.weaponTypes.includes(equipment.weaponType)))reasons.push("武器类型不适用");
  return reasons;
}
function executeEquipmentHitContext(build:CalculatorBuild,hit:OrdinaryCalculatorHit,stats:CalculatorFinalStats,b:TraceBuilder,scope:FormulaScope=hitFormulaScope(build),hitPanel?:ReturnType<typeof executeHitPanel>){
  const equipment=build.mode==="equipment-derived"?build.equipment:undefined;
  const panel=hitPanel??(equipment?.additiveBaseBonuses?.length||equipment?.criticalBonuses?.length?buildStats(build):undefined);
  const records:NonNullable<OrdinaryCalculatorHit["finalizedEquipmentEffects"]>=[];
  const effect=(rule:EquipmentHitFormula,id:string,kind:"additive-base"|"critRate"|"critDamage",extraReasons:string[]=[])=>{
    const reasons=[...equipmentHitExclusions(equipment!,hit,rule),...extraReasons],title=kind==="additive-base"?"stage.equipmentBaseAddition":"stage.equipmentCriticalBonus";
    const amount=reasons.length?b.add(id,title,n(0),[],{unit:kind==="additive-base"?"damage":"ratio",ruleId:rule.id,sourceRefs:rule.sourceRefs,explanationKey:kind==="additive-base"?"explain.equipmentBaseAddition":"explain.equipmentCriticalBonus",status:"not-applicable",applicabilityReason:`${rule.label}：${reasons.join("；")}`}):executeContextFormula(b,id,title,{...rule,ruleId:rule.id},rule.inputPolicy==="pre-conversion"?panel!.preConversionBindings:{...panel!.finalBindings,...panelBindings(stats)},kind==="additive-base"?"damage":"ratio",kind==="additive-base"?"explain.equipmentBaseAddition":"explain.equipmentCriticalBonus");
    const node=b.nodes.find(candidate=>candidate.id===id)!;
    records.push({ruleId:rule.id,label:rule.label,kind,amount,expression:node.expression,inputs:node.inputs.map(input=>({key:input.key,value:input.value,unit:input.unit,meaningKey:input.meaningKey,origin:typeof input.origin==="string"?input.origin:input.origin.kind})),sourceRefs:rule.sourceRefs});
    return amount;
  };
  const additions=(equipment?.additiveBaseBonuses??[]).map((rule,index)=>effect(rule,`equipmentBaseAddition.${index}`,"additive-base"));
  const additiveBaseDamage=b.add("equipmentAndManualBaseAddition","stage.equipmentAndManualBaseAddition",expr.add(v("manualAdditiveBaseDamage"),...additions.map((_,index)=>v(`baseAddition${index}`))),[traceInput("manualAdditiveBaseDamage",hit.additiveBaseDamage,"damage","user","input.manualAdditiveBaseDamage"),...additions.map((value,index)=>traceInput(`baseAddition${index}`,value,"damage","previous-step","input.equipmentBaseAddition"))],{unit:"damage",explanationKey:"explain.equipmentAndManualBaseAddition",childIds:additions.map((_,index)=>`equipmentBaseAddition.${index}`)});
  const criticalValues=(equipment?.criticalBonuses??[]).map((rule,index)=>({target:rule.target,value:effect(rule,`equipmentCriticalBonus.${index}`,rule.target,[...(!hit.critEligible?["此命中不允许暴击"]:[]),...((rule.target==="critRate"?hit.effectiveCritRate:hit.effectiveCritDamage)!==undefined?["已提供本段最终暴击属性，不重复加入"]:[])])}));
  const characterCritical:{critRate:number;critDamage:number}={critRate:0,critDamage:0};
  const characterFormulas={critRate:hit.critRateFormula,critDamage:hit.critDamageFormula};
  const criticalBlockers=criticalFormulaBlockers(hit,stats,scope);if(criticalBlockers.length)throw new Error(criticalBlockers.join("；"));
  for(const target of ["critRate","critDamage"] as const){
    const formula=characterFormulas[target];if(!formula)continue;
    const override=target==="critRate"?hit.effectiveCritRate:hit.effectiveCritDamage,id=target==="critRate"?"characterCritRate":"characterCritDamage";
    const active=hit.critEligible&&override===undefined&&formulaApplies(formula,hit,scope);
    characterCritical[target]=active?executeContextFormula(b,id,`stage.${id}`,formula,panelBindings(stats),"ratio",`explain.${id}`):b.add(id,`stage.${id}`,n(0),[],{unit:"ratio",status:"not-applicable",ruleId:formula.ruleId,sourceRefs:formula.sourceRefs,explanationKey:`explain.${id}`,applicabilityReason:`${formula.label}：${override!==undefined?"已提供本段最终暴击属性，保留来源式但不执行或重复加入，也不反推历史突破分解":!hit.critEligible?"此命中不可暴击":"当前突破或伤害元素、攻击标签不满足来源条件"}。`});
  }
  const critical=(target:"critRate"|"critDamage",override:number|undefined)=>{
    const values=criticalValues.map((entry,index)=>({...entry,index})).filter(entry=>entry.target===target);
    const raw=override??stats[target];
    const character=characterFormulas[target]!==undefined,characterId=target==="critRate"?"characterCritRate":"characterCritDamage";
    return b.add(target==="critRate"?"applicableCritRate":"applicableCritDamage",target==="critRate"?"stage.applicableCritRate":"stage.applicableCritDamage",!hit.critEligible?n(0):override!==undefined?v("suppliedValue"):expr.add(v("panelValue"),...values.map(entry=>v(`bonus${entry.index}`)),...(character?[v(characterId)]:[])),[traceInput(override!==undefined?"suppliedValue":"panelValue",raw,"ratio",override!==undefined?"explicit-final-context":"resolved-panel",`input.${target}`),...values.map(entry=>traceInput(`bonus${entry.index}`,entry.value,"ratio","previous-step","input.equipmentCriticalBonus")),...(character?[traceInput(characterId,characterCritical[target],"ratio","previous-step",`input.${characterId}`)]:[])],{unit:"ratio",explanationKey:"explain.applicableCriticalStat",status:hit.critEligible?"applied":"not-applicable",childIds:[...values.map(entry=>`equipmentCriticalBonus.${entry.index}`),...(character?[characterId]:[])],applicabilityReason:!hit.critEligible?"此命中不允许暴击，装备及角色的暴击属性不适用。":override!==undefined?"使用明确的本段最终暴击属性，来源装备和角色效果不重复加入。":"合计面板、适用装备与角色来源暴击属性后，由共享伤害公式限制暴击概率范围。"});
  };
  return {additiveBaseDamage,critRate:critical("critRate",hit.effectiveCritRate),critDamage:critical("critDamage",hit.effectiveCritDamage),finalizedEquipmentEffects:records};
}
type ConvertedEquipmentPanel={stats:CalculatorFinalStats;sourceRefs:string[];ascension:number};
type CalculatorHitEquipmentContext=ReturnType<typeof executeEquipmentHitContext>&{convertedPanel?:ConvertedEquipmentPanel|undefined};
function equipmentPanelForConversion(build:CalculatorBuild,hit:OrdinaryCalculatorHit,panel:ReturnType<typeof executeHitPanel>,resolved:ReturnType<typeof executeEquipmentHitContext>,scope:FormulaScope,b:TraceBuilder,documentContext?:Pick<CalculatorDocument,"gameContext">):ConvertedEquipmentPanel|undefined {
  // The finite Phantasm combines ordinary and lunar samples. Freeze its actual
  // per-hit EM window even when no equipped stat-conversion formula was rebuilt.
  // Kazuha's distinct 81f/82f Q snapshots also need capture without EM rebuilding.
  if((!panel.rebuiltEquipment&&!hit.neferPhantasmEvent&&!documentContext?.gameContext?.kazuhaBurst)||build.mode!=="equipment-derived"||!build.equipment||getCalculatorHitPendingReactionEffects(build,hit).length||getCalculatorHitPendingResistanceEffects(build,hit).length)return undefined;
  if(scope.ascension===undefined)throw new Error("逐击装备转换快照需要明确突破阶段。");
  return {stats:{...panel.stats,critRate:resolved.critRate,critDamage:resolved.critDamage},ascension:scope.ascension,sourceRefs:[...new Set([...hit.sourceRefs,...build.equipment.sourceRefs,...b.nodes.flatMap(node=>node.sourceRefs)])]};
}
/** The numeric hit fields have already been finalized by the same equipment resolvers. */
export function captureCalculatorHitEquipmentSnapshot(panel:ConvertedEquipmentPanel|undefined,hit:OrdinaryCalculatorHit,characterLevel:number):OrdinaryCalculatorHit["finalSnapshot"] {
  if(!panel)return undefined;
  return {origin:"equipment-conversion",stats:panel.stats,characterLevel,ascension:panel.ascension,damageBonus:hit.damageBonus,additiveBaseDamage:hit.additiveBaseDamage,reactionBonus:hit.reactionBonus,source:"由当前构筑转换的逐击快照：本击精通、装备派生属性与进攻条件已结算；后续共同面板或精通调整不重采此快照。",sourceRefs:panel.sourceRefs};
}
export function resolveCalculatorHitEquipmentContext(build:CalculatorBuild,hit:OrdinaryCalculatorHit,documentContext?:Pick<CalculatorDocument,"gameContext">):CalculatorHitEquipmentContext{
  const saved=finalSnapshotContext(hit);if(saved)return resolveCalculatorHitEquipmentContext(saved.build,saved.hit,{gameContext:documentContext?.gameContext?{...documentContext.gameContext,ascension:hit.finalSnapshot!.ascension}:undefined});
  const b=new TraceBuilder(hit.sourceRefs),scope=hitFormulaScope(build,documentContext),stats=resolveCalculatorStats(build);
  const pending=getCalculatorHitPendingEquipmentEffects(build,hit);if(pending.length)throw new Error(pending.map(pendingEquipmentReason).join("；"));
  const panel=executeHitPanel(build,stats,hit,scope,b,documentContext);
  const resolved=executeEquipmentHitContext(build,hit,panel.stats,b,scope,panel);
  return {...resolved,convertedPanel:equipmentPanelForConversion(build,hit,panel,resolved,scope,b,documentContext)};
}
export function restoreCalculatorHitEquipmentInputs(hit:OrdinaryCalculatorHit):OrdinaryCalculatorHit {
  if(hit.finalSnapshot&&hit.finalSnapshot.origin!=="equipment-conversion")return structuredClone(hit);
  const result=structuredClone(hit),amount=(result.finalizedEquipmentEffects??[]).filter(effect=>effect.kind==="additive-base").reduce((sum,effect)=>sum+effect.amount,0);
  delete result.finalSnapshot;
  const original=result.finalizedEquipmentBaseInput;
  result.additiveBaseDamage=original!==undefined&&result.additiveBaseDamage===original+amount?original:result.additiveBaseDamage-amount;
  delete result.effectiveCritRate;delete result.effectiveCritDamage;delete result.finalizedEquipmentEffects;delete result.finalizedEquipmentBaseInput;delete result.pendingEquipmentEffects;delete result.pendingResistanceEffects;
  return result;
}
function executeHitDamageBonuses(build:CalculatorBuild,hit:Extract<CalculatorHit,{kind:"ordinary"}>,b:TraceBuilder,totalId="applicableDamageBonus",hitStats?:CalculatorFinalStats,hitPanel?:ReturnType<typeof executeHitPanel>):number {
  const equipment=build.mode==="equipment-derived"?build.equipment:undefined;
  const elementByProperty:Record<string,Extract<CalculatorHit,{kind:"ordinary"}>["element"]>={FIGHT_PROP_PHYSICAL_ADD_HURT:"physical",FIGHT_PROP_FIRE_ADD_HURT:"pyro",FIGHT_PROP_WATER_ADD_HURT:"hydro",FIGHT_PROP_ICE_ADD_HURT:"cryo",FIGHT_PROP_ELEC_ADD_HURT:"electro",FIGHT_PROP_WIND_ADD_HURT:"anemo",FIGHT_PROP_ROCK_ADD_HURT:"geo",FIGHT_PROP_GRASS_ADD_HURT:"dendro"};
  const sourceBonuses:NonNullable<NonNullable<Extract<CalculatorBuild,{mode:"equipment-derived"}>["equipment"]>["hitBonuses"]>=(equipment?.bonusAccounting==="core-sourced-v1"?equipment.secondaryContributions:[]).flatMap((entry,index)=>elementByProperty[entry.property]?[{id:`source-element-bonus-${index}`,value:entry.value,sourceRef:entry.sourceRef,label:entry.property,elements:[elementByProperty[entry.property]!]}]:[]);
  const resolvedBuild=hitPanel??((equipment?.dynamicHitBonuses?.length??0)>0?buildStats(build):undefined);
  const dynamicBonuses=(equipment?.dynamicHitBonuses??[]).map((bonus,index)=>{
    const reasons:string[]=[];
    if(bonus.elements&&!bonus.elements.includes(hit.element))reasons.push("当前伤害元素不符合条件");
    if(bonus.attackTags&&(!hit.attackTag||!bonus.attackTags.includes(hit.attackTag)))reasons.push("当前攻击类型未满足已定义条件");
    if(bonus.weaponTypes&&(!equipment?.weaponType||!bonus.weaponTypes.includes(equipment.weaponType)))reasons.push("当前武器类型不符合条件");
    const applied=reasons.length===0;
    const value=applied?executeContextFormula(b,`dynamicBonus.${index}`,"stage.dynamicDamageBonus",{...bonus,ruleId:bonus.id},bonus.inputPolicy==="final-panel"?{...resolvedBuild!.finalBindings,...(hitStats?panelBindings(hitStats):{})}:resolvedBuild!.preConversionBindings,"ratio"):0;
    if(!applied)b.add(`dynamicBonus.${index}`,"stage.dynamicDamageBonus",n(0),[],{status:"not-applicable",unit:"ratio",explanationKey:"explain.dynamicDamageBonus",sourceRefs:bonus.sourceRefs,applicabilityReason:`${bonus.label}：${reasons.join("；")}`});
    return value;
  });
  const eligibleBonuses: number[]=[...(equipment?.hitBonuses??[]),...sourceBonuses].map((bonus,index)=>{
    const reasons:string[]=[];
    if(bonus.elements&&!bonus.elements.includes(hit.element))reasons.push(`仅适用于 ${bonus.elements.join(" / ")} 元素`);
    if(bonus.attackTags&&(!hit.attackTag||!bonus.attackTags.includes(hit.attackTag)))reasons.push(hit.attackTag?`仅适用于 ${bonus.attackTags.join(" / ")} 类型`:"缺少已分类攻击标签，无法确认适用性");
    if(bonus.weaponTypes&&(!equipment?.weaponType||!bonus.weaponTypes.includes(equipment.weaponType)))reasons.push("武器种类不满足已定义条件");
    const applied=reasons.length===0;
    return b.add(`equipmentBonus.${index}`,"stage.equipmentBonus",applied?v("equipmentBonus"):n(0),[traceInput("equipmentBonus",bonus.value,"ratio",{kind:"equipment-effect",reference:bonus.sourceRef},"input.equipmentBonus")],{unit:"ratio",explanationKey:"explain.equipmentBonus",sourceRefs:[bonus.sourceRef],status:applied?"applied":"not-applicable",applicabilityReason:`${bonus.label}：${applied?"元素、攻击类型与武器条件满足":reasons.join("；")}`});
  });
  const damageBonus=b.add(totalId,`stage.${totalId}`,expr.add(v("manualDamageBonus"),...eligibleBonuses.map((_,i)=>v(`equipmentBonus${i}`)),...dynamicBonuses.map((_,i)=>v(`dynamicBonus${i}`))),[traceInput("manualDamageBonus",hit.damageBonus,"ratio","user","input.damageBonus"),...eligibleBonuses.map((value,i)=>traceInput(`equipmentBonus${i}`,value,"ratio","equipment-effect","input.equipmentBonus")),...dynamicBonuses.map((value,i)=>traceInput(`dynamicBonus${i}`,value,"ratio","equipment-formula","input.equipmentBonus"))],{unit:"ratio",explanationKey:"explain.applicableDamageBonus",childIds:[...eligibleBonuses.map((_,i)=>`equipmentBonus.${i}`),...dynamicBonuses.map((_,i)=>`dynamicBonus.${i}`)]});
  return damageBonus;
}
export function resolveCalculatorHitDamageBonus(build:CalculatorBuild,hit:Extract<CalculatorHit,{kind:"ordinary"}>,documentContext?:Pick<CalculatorDocument,"gameContext">):number {
  const saved=finalSnapshotContext(hit);if(saved)return resolveCalculatorHitDamageBonus(saved.build,saved.hit,documentContext);
  const b=new TraceBuilder(hit.sourceRefs);
  const panel=executeHitPanel(build,resolveCalculatorStats(build),hit,hitFormulaScope(build,documentContext),b,documentContext);
  return executeHitDamageBonuses(build,hit,b,"applicableDamageBonus",panel.stats,panel);
}
export type CalculatorClassicDamageHit=Extract<CalculatorHit,{kind:"ordinary"|"transformative"}>;
const transformativeElements:Record<Extract<CalculatorHit,{kind:"transformative"}>["reaction"],Extract<CalculatorHit,{kind:"ordinary"}>["element"]>={overload:"pyro",superconduct:"cryo",electroCharged:"electro",burning:"pyro",shatter:"physical",swirlPyro:"pyro",swirlHydro:"hydro",swirlCryo:"cryo",swirlElectro:"electro",bloom:"dendro",burgeon:"dendro",hyperbloom:"dendro"};
export function getCalculatorHitPendingResistanceEffects(build:CalculatorBuild,hit:CalculatorHit):CalculatorPendingResistanceEffect[] {
  if((hit.kind!=="ordinary"&&hit.kind!=="transformative")||hit.effectiveResistance!==undefined)return [];
  const element=hit.kind==="ordinary"?hit.element:transformativeElements[hit.reaction];
  const candidates=[...(hit.pendingResistanceEffects??[]),...(build.mode==="equipment-derived"?build.equipment?.pendingResistanceEffects??[]:[])];
  return [...new Map(candidates.filter(effect=>effect.elements.includes(element)).map(effect=>[effect.id,effect])).values()];
}
export function getCalculatorHitPendingReactionEffects(build:CalculatorBuild,hit:CalculatorHit):CalculatorPendingReactionEffect[] {
  if((hit.kind!=="ordinary"&&hit.kind!=="transformative")||(hit.kind==="ordinary"&&hit.finalSnapshot))return [];
  const reaction=hit.kind==="ordinary"?(hit.additiveReaction??hit.reaction):hit.reaction;
  if(reaction==="none")return [];
  const candidates=[...(hit.pendingReactionEffects??[]),...(build.mode==="equipment-derived"?build.equipment?.pendingReactionEffects??[]:[])];
  return [...new Map(candidates.filter(effect=>effect.reactions.includes(reaction)).map(effect=>[effect.id,effect])).values()];
}
/** Each intermediate is the original executable AST subtree, never a UI formula. */
function executeEquipmentReactionFormula(b:TraceBuilder,id:string,bonus:NonNullable<EquipmentMetadata["reactionBonuses"]>[number]):number {
  const formula=bonus.formula!,values=Object.fromEntries(formula.inputs.map(input=>[input.key,input.value]));
  const labels:Record<FormulaExpression["kind"],string>={constant:"来源常量",variable:"来源条件",lookup:"查表",add:"加算",multiply:"乘算",min:"取最小值",max:"取最大值",subtract:"相减",divide:"相除",clamp:"范围限制",truncate:"向零截断",condition:"条件分支"};
  let step=0;
  const execute=(expression:FormulaExpression,root=false):{id:string;value:number}=>{
    let parts:FormulaExpression[]=[];
    switch(expression.kind){
      case "lookup":parts=expression.indices;break;
      case "add":case "multiply":case "min":case "max":parts=expression.terms;break;
      case "subtract":case "divide":parts=[expression.left,expression.right];break;
      case "truncate":parts=[expression.value];break;
      case "clamp":parts=[expression.value,expression.min,expression.max];break;
      case "condition":{
        const left=evaluateFormulaExpression(expression.left,values),right=evaluateFormulaExpression(expression.right,values);
        const selected=expression.operator==="lt"?left<right:expression.operator==="lte"?left<=right:left===right;
        parts=[expression.left,expression.right,selected?expression.whenTrue:expression.whenFalse];break;
      }
    }
    const children=parts.filter(part=>part.kind!=="constant"&&part.kind!=="variable").map(part=>execute(part));
    const nodeId=root?id:`${id}.step${step++}`;
    return {id:nodeId,value:b.add(nodeId,`${bonus.label} · ${root?"来源反应奖励":labels[expression.kind]}`,expression,
      formula.inputs.filter(input=>formulaUsesVariable(expression,input.key)).map(input=>({...traceInput(input.key,input.value,input.unit,input.origin,input.meaningKey),...(input.ownerId?{context:{ownerId:input.ownerId}}:{})})),
      {unit:"ratio",ruleId:bonus.id,explanationKey:formula.explanation,sourceRefs:bonus.sourceRefs,childIds:children.map(child=>child.id)})};
  };
  return execute(formula.expression,true).value;
}
function executeHitReactionBonus(build:CalculatorBuild,hit:CalculatorClassicDamageHit,b:TraceBuilder):number {
  const pending=getCalculatorHitPendingReactionEffects(build,hit);if(pending.length)throw new Error(pending.map(pendingEquipmentReason).join("；"));
  const reaction=hit.kind==="ordinary"?(hit.additiveReaction??hit.reaction):hit.reaction;
  const bonuses=build.mode==="equipment-derived"?build.equipment?.reactionBonuses??[]:[];
  const values=bonuses.map((bonus,index)=>{
    const eligible=reaction!=="none"&&bonus.reactions.includes(reaction);
    const formulaId=`equipmentReactionFormula.${index}`,value=eligible&&bonus.formula?executeEquipmentReactionFormula(b,formulaId,bonus):bonus.value;
    return b.add(`equipmentReactionBonus.${index}`,"stage.equipmentReactionBonus",expr.mul(v("equipmentReactionBonus"),v("reactionEligible")),[traceInput("equipmentReactionBonus",value,"ratio",eligible&&bonus.formula?"previous-step":"equipment-source","input.equipmentReactionBonus"),traceInput("reactionEligible",Number(eligible),"boolean","reaction-selection","input.reactionEligible")],{unit:"ratio",sourceRefs:bonus.sourceRefs,ruleId:bonus.id,explanationKey:"explain.equipmentReactionBonus",status:eligible?"applied":"not-applicable",childIds:eligible&&bonus.formula?[formulaId]:[],applicabilityReason:`${bonus.label}：当前 ${reaction}；适用 ${bonus.reactions.join(" / ")}。`});
  });
  return b.add("applicableReactionBonus","stage.applicableReactionBonus",expr.add(v("manualReactionBonus"),...values.map((_,index)=>v(`equipmentReactionBonus${index}`))),[traceInput("manualReactionBonus",hit.reactionBonus,"ratio","user","input.manualReactionBonus"),...values.map((value,index)=>traceInput(`equipmentReactionBonus${index}`,value,"ratio","previous-step","input.equipmentReactionBonus"))],{unit:"ratio",explanationKey:"explain.applicableReactionBonus",childIds:values.map((_,index)=>`equipmentReactionBonus.${index}`)});
}
function executeHitResistance(build:CalculatorBuild,hit:CalculatorClassicDamageHit,enemyResistance:number,b:TraceBuilder,scope:FormulaScope=hitFormulaScope(build),stats?:CalculatorFinalStats):number {
  const pending=getCalculatorHitPendingResistanceEffects(build,hit);if(pending.length)throw new Error(pending.map(pendingEquipmentReason).join("；"));
  const formula=hit.kind==="ordinary"?hit.resistanceReductionFormula:undefined;
  if(hit.effectiveResistance!==undefined){
    if(formula){const blockers=formulaConstellationBlockers(formula,scope);if(blockers.length)throw new Error(blockers.join("；"));}
    if(formula)b.add("characterResistanceReduction","stage.characterResistanceReduction",n(0),[],{status:"not-applicable",unit:"ratio",ruleId:formula.ruleId,sourceRefs:formula.sourceRefs,explanationKey:"explain.characterResistanceReduction",applicabilityReason:`${formula.label}：已提供本段最终抗性，保留来源公式但不重复减抗；清除最终抗性覆写后才重新计算。`});
    return b.add("effectiveResistance","stage.effectiveResistance",v("suppliedEffectiveResistance"),[traceInput("suppliedEffectiveResistance",hit.effectiveResistance,"ratio","explicit-final-context","input.suppliedEffectiveResistance")],{unit:"ratio",explanationKey:"explain.suppliedEffectiveResistance",applicabilityReason:"本段提供已结算的最终抗性；装备和角色来源减抗不再应用。"});
  }
  const element=hit.kind==="ordinary"?hit.element:transformativeElements[hit.reaction];
  const reductions=build.mode==="equipment-derived"?build.equipment?.resistanceReductions??[]:[];
  const values=reductions.map((reduction,index)=>{
    const eligible=reduction.elements.includes(element),active=reduction.active??true;
    return b.add(`equipmentResistanceReduction.${index}`,"stage.equipmentResistanceReduction",expr.mul(v("resistanceReduction"),v("conditionActive"),v("elementEligible")),[traceInput("resistanceReduction",reduction.value,"ratio","equipment-source","input.resistanceReduction"),traceInput("conditionActive",Number(active),"boolean","explicit-condition",reduction.conditionLabel??"input.conditionActive"),traceInput("elementEligible",Number(eligible),"boolean","hit-element","input.elementEligible")],{unit:"ratio",sourceRefs:reduction.sourceRefs,ruleId:reduction.id,explanationKey:"explain.equipmentResistanceReduction",status:eligible&&active?"applied":"not-applicable",applicabilityReason:`${reduction.label}：当前 ${element}；适用 ${reduction.elements.join(" / ")}；条件${active?"有效":"未生效"}。`});
  });
  const childIds=values.map((_,index)=>`equipmentResistanceReduction.${index}`);
  if(formula){
    const panel=stats??(hit.kind==="ordinary"?executeHitPanel(build,resolveCalculatorStats(build),hit,scope,b).stats:resolveCalculatorStats(build)),blockers=formulaBlockers(formula,hit,panel,scope);
    if(blockers.length)throw new Error(blockers.join("；"));
    values.push(formulaApplies(formula,hit,scope)?executeContextFormula(b,"characterResistanceReduction","stage.characterResistanceReduction",formula,panelBindings(panel),"ratio","explain.characterResistanceReduction"):b.add("characterResistanceReduction","stage.characterResistanceReduction",n(0),[],{status:"not-applicable",unit:"ratio",ruleId:formula.ruleId,sourceRefs:formula.sourceRefs,explanationKey:"explain.characterResistanceReduction",applicabilityReason:`${formula.label}：当前突破或伤害类型不满足生效条件。`}));
    childIds.push("characterResistanceReduction");
  }
  const total=b.add("totalResistanceReduction","stage.totalResistanceReduction",expr.add(n(0),...values.map((_,index)=>v(`reduction${index}`))),values.map((value,index)=>traceInput(`reduction${index}`,value,"ratio","previous-step","input.resistanceReduction")),{unit:"ratio",explanationKey:"explain.totalResistanceReduction",childIds});
  return b.add("effectiveResistance","stage.effectiveResistance",expr.sub(v("enemyResistance"),v("totalResistanceReduction")),[traceInput("enemyResistance",enemyResistance,"ratio","user","input.enemyResistance"),traceInput("totalResistanceReduction",total,"ratio","previous-step","input.totalResistanceReduction")],{unit:"ratio",explanationKey:"explain.effectiveResistance",childIds:["totalResistanceReduction"]});
}
export function resolveCalculatorHitReactionBonus(build:CalculatorBuild,hit:CalculatorClassicDamageHit):number {
  const saved=hit.kind==="ordinary"?finalSnapshotContext(hit):undefined;if(saved)return resolveCalculatorHitReactionBonus(saved.build,saved.hit);
  return executeHitReactionBonus(build,hit,new TraceBuilder(hit.sourceRefs));
}
export function resolveCalculatorHitResistance(build:CalculatorBuild,hit:CalculatorClassicDamageHit,enemyResistance:number,documentContext?:Pick<CalculatorDocument,"gameContext">):number {
  const saved=hit.kind==="ordinary"?finalSnapshotContext(hit):undefined;if(saved)return resolveCalculatorHitResistance(saved.build,saved.hit,enemyResistance,documentContext);
  return executeHitResistance(build,hit,enemyResistance,new TraceBuilder(hit.sourceRefs),hitFormulaScope(build,documentContext));
}
export function convertCalculatorToFinalPanel(document:CalculatorDocument,mode:"manual-final"|"imported-final"="manual-final"):CalculatorDocument {
  const result=prepareSourceCastDocument(prepareIncomingThrillingTales(prepareColleiCharlotteSkillDocument(prepareBaizhuSkillDocument(prepareWeaponProcCalculatorDocument(calculatorDocumentSchema.parse(document))))));
  const selectedMissing=result.hits.filter(hit=>result.selectedHitIds.includes(hit.id)).flatMap(hit=>hit.dependencies.flatMap(id=>{const dependency=result.dependencies.find(entry=>entry.id===id);return dependency?.status==="missing"?[`${id}：${dependency.reason}`]:[];}));
  if(selectedMissing.length)throw new Error(selectedMissing.join("；"));
  const build=result.build,resolvedStats=resolveCalculatorStats(build);
  const convertedPanels=new Map<string,ConvertedEquipmentPanel>();
  for(const hit of result.hits){
    if(hit.kind==="special"&&(hit.mixedSourceEvent||hit.travelerCryoStateEvent||hit.zibaiFiniteEvent||hit.observedSpecialComponentEvent||hit.neferPhantasmEvent)&&!hit.finalSnapshot){
      const audit=new TraceBuilder(hit.sourceRefs),proxy=sourceSpecialPanelProxy(result,hit);
      const panel=proxy?executeHitPanel(build,resolvedStats,proxy,hitFormulaScope(build,result),audit,result).stats:resolvedStats;
      const ascension=hitFormulaScope(build,result).ascension;
      if(ascension!==undefined)hit.finalSnapshot={origin:"equipment-conversion",stats:panel,characterLevel:result.characterLevel,ascension,damageBonus:0,additiveBaseDamage:0,reactionBonus:0,source:"本次直接特殊伤害的实际属性阶段已物化；普通标签增伤和普通附加基伤不进入本快照。",sourceRefs:hit.sourceRefs};
    }
    if(hit.kind==="ordinary"&&hit.finalSnapshot)continue;
    if(hit.kind==="ordinary"){
      hit.damageBonus=resolveCalculatorHitDamageBonus(build,hit,result);
      const pending=getCalculatorHitPendingEquipmentEffects(build,hit);
      if(pending.length&&result.selectedHitIds.includes(hit.id))throw new Error(pending.map(pendingEquipmentReason).join("；"));
      const audit=new TraceBuilder(hit.sourceRefs),scope=hitFormulaScope(build,result);
      const panel=executeHitPanel(build,resolvedStats,hit,scope,audit,result);
      const resolved=executeEquipmentHitContext(build,hit,panel.stats,audit,scope,panel);
      const converted=pending.length?undefined:equipmentPanelForConversion(build,hit,panel,resolved,scope,audit,result);
      if(converted)convertedPanels.set(hit.id,converted);
      if(pending.length)hit.pendingEquipmentEffects=pending;
      if(resolved.finalizedEquipmentEffects.length){
        hit.finalizedEquipmentBaseInput=hit.additiveBaseDamage;
        hit.additiveBaseDamage=resolved.additiveBaseDamage;
        hit.finalizedEquipmentEffects=resolved.finalizedEquipmentEffects;
      }
      if(resolved.finalizedEquipmentEffects.length||hit.critRateFormula||hit.critDamageFormula){
        if(!pending.some(effect=>effect.kind===undefined||effect.kind==="critRate"))hit.effectiveCritRate=resolved.critRate;
        if(!pending.some(effect=>effect.kind===undefined||effect.kind==="critDamage"))hit.effectiveCritDamage=resolved.critDamage;
      }
    }
    if(hit.kind==="ordinary"||hit.kind==="transformative"){
      const pending=getCalculatorHitPendingReactionEffects(build,hit);
      if(pending.length&&result.selectedHitIds.includes(hit.id))throw new Error(pending.map(pendingEquipmentReason).join("；"));
      if(pending.length)hit.pendingReactionEffects=pending;
      else hit.reactionBonus=resolveCalculatorHitReactionBonus(build,hit);
      const pendingResistance=getCalculatorHitPendingResistanceEffects(build,hit);
      if(pendingResistance.length&&result.selectedHitIds.includes(hit.id))throw new Error(pendingResistance.map(pendingEquipmentReason).join("；"));
      if(pendingResistance.length)hit.pendingResistanceEffects=pendingResistance;
      else hit.effectiveResistance=resolveCalculatorHitResistance(build,hit,result.enemy.resistance,result);
      const converted=convertedPanels.get(hit.id);
      if(hit.kind==="ordinary"&&converted&&!pending.length&&!pendingResistance.length){
        hit.finalSnapshot=captureCalculatorHitEquipmentSnapshot(converted,hit,result.characterLevel);
      }
    }
  }
  finalizeSourceCastPanelAccounting(result);
  const ascension=build.mode==="equipment-derived"?build.equipment?.ascension:build.ascension;
  result.build={mode,stats:resolvedStats,source:"当前构筑的装备属性已结算，不重复应用；逐命中角色来源调整仍按各段记账方式独立执行。",...(ascension===undefined?{}:{ascension})};
  return result;
}
function appendFinalizedEquipmentTrace(hit:OrdinaryCalculatorHit,b:TraceBuilder):void {
  for(const [index,record] of (hit.finalizedEquipmentEffects??[]).entries())b.add(`finalizedEquipmentEffect.${index}`,"stage.finalizedEquipmentEffect",record.expression,record.inputs.map(input=>traceInput(input.key,input.value,input.unit,input.origin,input.meaningKey)),{unit:record.kind==="additive-base"?"damage":"ratio",status:"not-applicable",ruleId:record.ruleId,sourceRefs:record.sourceRefs,explanationKey:"explain.finalizedEquipmentEffect",applicabilityReason:`${record.label}：转换时记录的贡献 ${record.amount} 已含于本段${record.kind==="additive-base"?"附加基数":"最终暴击属性"}，只复现来源代入，不再次应用。`});
}
function calculateHit(doc:CalculatorDocument,hit:CalculatorHit,stats:CalculatorFinalStats|undefined):CalculatorHitResult {
  if(hit.kind==="ordinary"&&hit.finalSnapshot){
    const saved=hit.finalSnapshot,restored=finalSnapshotContext(hit)!;
    const historicalDoc={...doc,characterLevel:saved.characterLevel,build:restored.build,...(doc.gameContext?{gameContext:{...doc.gameContext,ascension:saved.ascension}}:{})};
    const output=calculateHit(historicalDoc,restored.hit,saved.stats);
    const audit=new TraceBuilder(saved.sourceRefs);
    for(const [key,value] of Object.entries({...saved.stats,characterLevel:saved.characterLevel,ascension:saved.ascension,damageBonus:saved.damageBonus,additiveBaseDamage:saved.additiveBaseDamage,reactionBonus:saved.reactionBonus})){
      if(value===undefined)continue;
      const unit=key==="characterLevel"||key==="ascension"?"level":key==="additiveBaseDamage"?"damage":key==="damageBonus"||key==="reactionBonus"?"ratio":panelUnit(key);
      audit.add(`snapshot.${key}`,"stage.capturedFinalSnapshot",v(key),[traceInput(key,value,unit,"captured-final-snapshot",`input.${key}`)],{unit,explanationKey:"explain.capturedFinalSnapshot",applicabilityReason:`${saved.source}；${saved.origin==="equipment-conversion"?"已转换的逐击":"历史"}进攻上下文，不读取当前构筑的装备数值或条件。目标防御和抗性仍按本次命中输入。`});
    }
    appendFinalizedEquipmentTrace(hit,audit);
    return {...output,trace:[...audit.nodes,...output.trace]};
  }
  const blockers:string[]=[];
  const formulaScope=hitFormulaScope(doc.build,doc),ascension=formulaScope.ascension;
  const formulaActive=(formula:CalculatorFormula):boolean=>formulaApplies(formula,hit,formulaScope);
  for(const id of hit.dependencies) {
    const dep=doc.dependencies.find(d=>d.id===id);
    if(!dep||dep.status==="missing") blockers.push(dep?`${id}：${dep.reason}`:`缺少所需依赖记录：${id}`);
  }
  if(hit.kind==="blocked") blockers.push(...hit.reasons);
  const pendingReactions=getCalculatorHitPendingReactionEffects(doc.build,hit);
  const pendingResistance=getCalculatorHitPendingResistanceEffects(doc.build,hit);
  blockers.push(...pendingReactions.map(pendingEquipmentReason),...pendingResistance.map(pendingEquipmentReason));
  if(hit.kind==="ordinary") {
    blockers.push(...getCalculatorHitPendingEquipmentEffects(doc.build,hit).map(pendingEquipmentReason));
    if(stats)blockers.push(...criticalFormulaBlockers(hit,stats,formulaScope));
    for(const formula of [hit.baseDamageFormula,hit.additiveBaseFormula,hit.damageBonusFormula,hit.incomingThrillingTalesFormula,hit.attackAdjustment?.accounting==="add-to-panel"?hit.attackAdjustment.formula:undefined,hit.elementalMasteryAdjustment?.accounting==="add-to-panel"?hit.elementalMasteryAdjustment.formula:undefined,hit.effectiveResistance===undefined?hit.resistanceReductionFormula:undefined])if(formula)blockers.push(...formulaBlockers(formula,hit,stats,formulaScope));
    if(hit.attackAdjustment?.accounting==="already-in-final-panel")blockers.push(...formulaConstellationBlockers(hit.attackAdjustment.formula,formulaScope));
    if(hit.elementalMasteryAdjustment?.accounting==="already-in-final-panel")blockers.push(...formulaConstellationBlockers(hit.elementalMasteryAdjustment.formula,formulaScope));
    if(hit.effectiveResistance!==undefined&&hit.resistanceReductionFormula)blockers.push(...formulaConstellationBlockers(hit.resistanceReductionFormula,formulaScope));
    if(ascension!==undefined&&doc.characterLevel<[1,20,40,50,60,70,80][ascension]!)blockers.push(`角色等级 ${doc.characterLevel} 低于突破 ${ascension} 的最低等级，不能套用当前被动与属性条件。`);
    if(hit.terms.some(term=>term.minimumAscension!==undefined)&&ascension===undefined)blockers.push("本段包含突破被动，但缺少明确突破阶段。");
    for(const reaction of [hit.reaction,hit.additiveReaction]) if(reaction&&reaction!=="none"&&requiredElement[reaction]!==hit.element) blockers.push(`反应 ${reaction} 需要 ${requiredElement[reaction]} 触发伤害；当前为 ${hit.element}。`);
    if(hit.reaction!=="none"&&hit.additiveReaction) blockers.push("同一普通伤害实例不能同时指定增幅与激化附加反应。");
    if(hit.explicitReactionBase!==undefined&&doc.dataIdentity.releaseStatus!=="synthetic") blockers.push("自定义增幅基础倍率仅供明确标示的合成教学输入。");
  }
  if(blockers.length) return {id:hit.id,label:hit.label,status:"blocked",trace:blockers.map((reason,i)=>({...infoNode(`blocked.${i}`,reason,"blocked"),sourceRefs:[...getCalculatorHitPendingEquipmentEffects(doc.build,hit),...pendingReactions,...pendingResistance].find(effect=>pendingEquipmentReason(effect)===reason)?.sourceRefs??[]})),blockers};
  if(hit.kind==="non-damaging") return {id:hit.id,label:hit.label,status:"non-damaging",trace:[infoNode("nonDamaging",hit.reason)],blockers:[]};
  if(hit.kind==="blocked") throw new Error("Blocked hit escaped its dependency gate");
  if(hit.kind==="special"){ const rawPanel=hit.finalSnapshot?.stats??stats??resolveCalculatorStats(doc.build),proxy=sourceSpecialPanelProxy(doc,hit),audit=new TraceBuilder(hit.sourceRefs);
    const panel=proxy?executeHitPanel(doc.build,rawPanel,proxy,formulaScope,audit,doc).stats:rawPanel;
    const resolved=sourceSpecialContext(doc,hit,panel,proxy!==undefined); if(resolved.blockers?.length)return {id:hit.id,label:hit.label,status:"blocked",trace:resolved.trace,blockers:resolved.blockers}; const output=calculateSpecialCalculatorHit(resolved.context,hit.id,hit.label); return {...output,trace:[...audit.nodes,...resolved.trace.filter(node=>!audit.nodes.some(existing=>existing.id===node.id)),...output.trace]}; }
  if(!stats)throw new Error("Selected damage requires its panel inputs");
  if(hit.kind==="transformative") {
    const b=new TraceBuilder(hit.sourceRefs);
    const reactionBonus=executeHitReactionBonus(doc.build,hit,b),effectiveResistance=executeHitResistance(doc.build,hit,doc.enemy.resistance,b);
    const output=calculateTransformativeDamageTrace({characterLevel:doc.characterLevel,elementalMastery:stats.em,reactionBonus,baseMultiplier:CLASSIC_REACTION_FORMULA_PROFILE.transformativeBaseMultipliers[hit.reaction],effectiveResistance});
    return {id:hit.id,label:hit.label,status:"calculated",nonCritical:output.finalDamage,critical:output.finalDamage,expected:output.finalDamage,trace:[...b.nodes,...output.trace,infoNode("transformativeExclusions","普通剧变伤害不使用天赋倍率、攻击面板、普通伤害加成、防御或暴击。特定角色的特殊允许效果须独立提供已验证规则；本模式未启用。")],blockers:[]};
  }
  if(hit.kind==="resolved") {
    const b=new TraceBuilder(hit.sourceRefs);
    b.add("entryPoint","stage.entryPoint",v("preReactionDamage"),[traceInput("preReactionDamage",hit.preReactionDamage,"damage","synthetic-entry-point","input.preReactionDamage")],{explanationKey:"explain.entryPoint",unit:"damage",applicabilityReason:hit.entryPoint});
    const afterReaction=b.add("afterReaction","stage.afterReaction",expr.mul(v("preReactionDamage"),v("amplificationMultiplier")),[traceInput("preReactionDamage",hit.preReactionDamage,"damage"),traceInput("amplificationMultiplier",hit.amplificationMultiplier)],{unit:"damage",status:hit.amplificationMultiplier===1?"not-applicable":"assumed",explanationKey:"explain.conditionedReaction"});
    const rate=Math.max(0,Math.min(1,stats.critRate)); const damage=Math.max(0,stats.critDamage);
    const weakPointContext=hit.hitWeakPoint!==undefined;
    if(weakPointContext)b.add("weakPointGuaranteedCritical","stage.weakPointGuaranteedCritical",v("hitWeakPoint"),[traceInput("hitWeakPoint",Number(hit.hitWeakPoint),"boolean","explicit-hit-context","input.hitWeakPoint")],{unit:"boolean",explanationKey:"explain.weakPointGuaranteedCritical",sourceRefs:DAMAGE_FORMULA_SOURCES});
    const weakPointInputs=weakPointContext?[traceInput("hitWeakPoint",Number(hit.hitWeakPoint),"boolean","explicit-hit-context","input.hitWeakPoint")]:[];
    const criticalMultiplier=b.add("criticalMultiplier","stage.criticalMultiplier",hit.critEligible?criticalMultiplierExpression("allCrit",weakPointContext):n(1),[traceInput("critDamage",damage),...weakPointInputs],{explanationKey:"explain.criticalMultiplier",...(weakPointContext?{childIds:["weakPointGuaranteedCritical"]}:{})});
    const expectedMultiplier=b.add("expectedMultiplier","stage.expectedMultiplier",hit.critEligible?criticalMultiplierExpression("average",weakPointContext):n(1),[traceInput("critRate",rate),traceInput("critDamage",damage),...weakPointInputs],{explanationKey:"explain.expectedMultiplier",...(weakPointContext?{childIds:["weakPointGuaranteedCritical"]}:{})});
    const critical=b.add("criticalDamage","stage.criticalDamage",expr.mul(v("afterReaction"),v("criticalMultiplier")),[traceInput("afterReaction",afterReaction,"damage"),traceInput("criticalMultiplier",criticalMultiplier)],{unit:"damage",explanationKey:"explain.criticalDamage"});
    const expected=b.add("expectedDamage","stage.expectedDamage",expr.mul(v("afterReaction"),v("expectedMultiplier")),[traceInput("afterReaction",afterReaction,"damage"),traceInput("expectedMultiplier",expectedMultiplier)],{unit:"damage",explanationKey:"explain.expectedDamage"});
    const probability=criticalProbabilityTrace(b,hit.hitWeakPoint,hit.critEligible?rate:0);
    return {id:hit.id,label:hit.label,status:"calculated",nonCritical:afterReaction,critical,expected,
      ...(weakPointContext?{effectiveCritRate:hit.critEligible?rate:0,criticalProbability:probability}:{}),
      ...(hit.hitWeakPoint?{nonCriticalComparisonOnly:true as const,warnings:[weakPointComparisonExplanation]}:{}),
      trace:hit.hitWeakPoint?[...b.nodes,infoNode("nonCriticalCounterfactual",weakPointComparisonExplanation)]:b.nodes,blockers:[]};
  }
  const b=new TraceBuilder(hit.sourceRefs);
  const weaponProcCoefficientFormula=getWeaponProcCoefficientFormula(doc);
  if(weaponProcCoefficientFormula)executeContextFormula(b,"weaponProcCoefficient","来源武器追击倍率选择",weaponProcCoefficientFormula,{},"ratio","explain.contextFormula");
  const hitPanel=executeHitPanel(doc.build,stats,hit,formulaScope,b,doc),hitStats=hitPanel.stats;
  const equipmentContext=executeEquipmentHitContext(doc.build,hit,hitStats,b,formulaScope,hitPanel);
  appendFinalizedEquipmentTrace(hit,b);
  const reactionBonus=executeHitReactionBonus(doc.build,hit,b),effectiveResistance=executeHitResistance(doc.build,hit,doc.enemy.resistance,b,formulaScope,hitStats);
  let damageBonus=executeHitDamageBonuses(doc.build,hit,b,hit.damageBonusFormula?"equipmentAndManualDamageBonus":"applicableDamageBonus",hitStats,hitPanel);
  if(hit.damageBonusFormula){
    const formula=hit.damageBonusFormula;
    const contribution=formulaActive(formula)?executeContextFormula(b,"customDamageBonus","stage.customDamageBonus",formula,panelBindings(hitStats),"ratio","explain.characterDamageBonus"):b.add("customDamageBonus","stage.customDamageBonus",n(0),[],{status:"not-applicable",unit:"ratio",explanationKey:"explain.characterDamageBonus",sourceRefs:formula.sourceRefs,applicabilityReason:`${formula.label}：当前突破或伤害类型不满足生效条件。`});
    damageBonus=b.add("applicableDamageBonus","stage.applicableDamageBonus",expr.add(v("equipmentAndManualDamageBonus"),v("formulaDamageBonus")),[traceInput("equipmentAndManualDamageBonus",damageBonus,"ratio","previous-step","input.equipmentAndManualDamageBonus"),traceInput("formulaDamageBonus",contribution,"ratio","source-formula","input.formulaDamageBonus")],{unit:"ratio",explanationKey:"explain.combinedDamageBonus",childIds:["equipmentAndManualDamageBonus","customDamageBonus"]});
  }
  b.add("damageBonusPercent","stage.damageBonusPercent",expr.div(v("percentage"),n(100)),[traceInput("percentage",damageBonus*100,"percent","calculated-percentage-equivalent","input.percentage")],{unit:"ratio",explanationKey:"explain.damageBonusPercent",childIds:["applicableDamageBonus"]});
  let sum:number;
  if(hit.baseDamageFormula) {
    const formula=hit.baseDamageFormula;
    const panelInputs=Object.entries(panelBindings(hitStats)).map(([key,value])=>traceInput(key,value,key==="erRatio"?"ratio":"stat",doc.build.mode,`input.${key}`));
    const resourceInputs=formula.inputs.map(input=>({...traceInput(input.key,input.value,input.unit,input.origin,input.meaningKey),...(input.ownerId?{context:{ownerId:input.ownerId}}:{})}));
    sum=b.add("customBaseDamage","stage.customBaseDamage",formulaActive(formula)?formula.expression:n(0),[...panelInputs,...resourceInputs],{unit:"damage",ruleId:formula.ruleId,explanationKey:"explain.customBaseDamage",sourceRefs:formula.sourceRefs,...(weaponProcCoefficientFormula?{childIds:["weaponProcCoefficient"]}:{}),applicabilityReason:formulaActive(formula)?formula.label:`${formula.label}：当前突破或伤害类型不满足生效条件。`,status:formulaActive(formula)?"applied":"not-applicable"});
  } else {
    for(const [index,term] of hit.terms.entries())b.add(`coefficientPercent.${index}`,"stage.coefficientPercent",expr.div(v("percentage"),n(100)),[traceInput("percentage",term.coefficient*100,"percent","talent-percentage-equivalent","input.percentage")],{unit:"ratio",explanationKey:"explain.coefficientPercent"});
    const termValues=hit.terms.map((term,index)=>{const active=term.minimumAscension===undefined||ascension!>=term.minimumAscension;return b.add(`scaling.${index}`,"stage.scaling",active?expr.mul(v(term.stat),v("coefficient"),v("baseMultiplier")):n(0),[traceInput(term.stat,hitStats[term.stat],"stat",doc.build.mode,`input.${term.stat}`),traceInput("coefficient",term.coefficient,"ratio","talent","input.coefficient"),traceInput("baseMultiplier",term.baseMultiplier??1,"ratio","conditioned-rule","input.baseMultiplier")],{unit:"damage",explanationKey:"explain.scaling",childIds:[`coefficientPercent.${index}`,...(term.stat==="atk"?(hit.attackAdjustment?["hitAttack"]:hit.incomingThrillingTalesFormula?["afterIncomingThrillingTales"]:[]):[])],status:active?"applied":"not-applicable",...(active?{}:{applicabilityReason:`此属性附加项需要突破 ${term.minimumAscension}；当前尚未解锁。`})});});
    sum=b.add("scalingSum","stage.scalingSum",expr.add(...termValues.map((_,i)=>v(`term${i+1}`))),termValues.map((value,i)=>traceInput(`term${i+1}`,value,"damage","previous-step","input.scalingTerm")),{unit:"damage",explanationKey:"explain.scalingSum",childIds:termValues.map((_,i)=>`scaling.${i}`)});
  }
  let additiveBaseDamage=equipmentContext.additiveBaseDamage;
  if(hit.additiveBaseFormula){
    const formula=hit.additiveBaseFormula;
    const contribution=formulaActive(formula)?executeContextFormula(b,"customAdditiveBase","stage.customAdditiveBase",formula,panelBindings(hitStats),"damage"):b.add("customAdditiveBase","stage.customAdditiveBase",n(0),[],{status:"not-applicable",unit:"damage",explanationKey:"explain.contextFormula",sourceRefs:formula.sourceRefs,applicabilityReason:`${formula.label}：当前突破或伤害类型不满足生效条件。`});
    additiveBaseDamage=b.add("combinedCustomAdditive","stage.combinedAdditive",expr.add(v("additiveBaseDamage"),v("formulaContribution")),[traceInput("additiveBaseDamage",additiveBaseDamage,"damage","user","input.additiveBaseDamage"),traceInput("formulaContribution",contribution,"damage","formula","input.formulaContribution")],{unit:"damage",explanationKey:"explain.combinedAdditive",childIds:["customAdditiveBase"]});
  }
  let additiveTrace:CalculationTraceNode[]=[];
  if(hit.additiveReaction) {
    const additive=executeAdditiveDamage({reaction:hit.additiveReaction,characterLevel:doc.characterLevel,elementalMastery:hitStats.em,reactionBonus},true);
    additiveTrace=additive.trace;
    additiveBaseDamage=b.add("combinedAdditive","stage.combinedAdditive",expr.add(v("additiveBaseDamage"),v("additiveReactionDamage")),[traceInput("additiveBaseDamage",additiveBaseDamage,"damage"),traceInput("additiveReactionDamage",additive.flatDamage,"damage")],{unit:"damage",explanationKey:"explain.combinedAdditive"});
  }
  const single=!hit.baseDamageFormula&&hit.terms.length===1&&hit.terms[0]?.minimumAscension===undefined?hit.terms[0]:undefined;
  const input:DamageCalculationInput={scaling:single&&single.baseMultiplier===undefined?single.coefficient:1,scalingStat:single?.stat??"atk",scalingValue:single&&single.baseMultiplier===undefined?hitStats[single.stat]:sum,flatDamage:additiveBaseDamage,damageBonus,characterLevel:doc.characterLevel,enemyLevel:doc.enemy.level,defenseReduction:doc.enemy.defenseAdjustment,defenseIgnore:doc.enemy.defenseIgnore,effectiveResistance,critRate:equipmentContext.critRate,critDamage:equipmentContext.critDamage,critMode:"noCrit",reaction:hit.reaction,elementalMastery:hitStats.em,reactionBonus:hit.additiveReaction?0:reactionBonus,groupMultiplier:hit.groupMultiplier,...(hit.explicitReactionBase===undefined?{}:{explicitReactionBase:hit.explicitReactionBase})};
  const nonCritical=calculateDamageTrace(input);
  const weakPointContext=hit.hitWeakPoint===undefined?{}:{hitWeakPoint:hit.hitWeakPoint};
  const critical=calculateDamageTrace({...input,...weakPointContext,critMode:"allCrit"});
  const expected=calculateDamageTrace({...input,...weakPointContext,critMode:"average"});
  const critBranch=(trace:CalculationTraceNode[],prefix:string)=>{
    const ids=new Set(["weakPointGuaranteedCritical","criticalMultiplier","expectedMultiplier","afterCritical","afterReaction","finalDamage"]);
    return trace.filter(node=>ids.has(node.id)).map(node=>({...node,id:`${prefix}.${node.id}`,childIds:node.childIds.map(id=>ids.has(id)?`${prefix}.${id}`:id)}));
  };
  const rate=Math.max(0,Math.min(1,equipmentContext.critRate));
  const weighted=new TraceBuilder(DAMAGE_FORMULA_SOURCES);
  const probability=criticalProbabilityTrace(weighted,hit.hitWeakPoint,rate),probabilityKey=hit.hitWeakPoint===undefined?"critRate":"criticalProbability";
  const probabilityInput=hit.hitWeakPoint===undefined?traceInput(probabilityKey,probability):traceInput(probabilityKey,probability,"ratio","previous-step","本击实际暴击发生概率；真实面板暴击率另行保留");
  weighted.add("weightedVerification","stage.weightedVerification",expr.add(expr.mul(expr.sub(n(1),v(probabilityKey)),v("nonCriticalDamage")),expr.mul(v(probabilityKey),v("criticalDamage"))),[probabilityInput,traceInput("nonCriticalDamage",nonCritical.finalDamage,"damage"),traceInput("criticalDamage",critical.finalDamage,"damage")],{unit:"damage",explanationKey:hit.hitWeakPoint?"以本击实际暴击发生概率1作加权；非暴击教学对照的权重为0，不以真实面板暴击率削减来源必暴伤害。":"explain.weightedVerification",...(hit.hitWeakPoint===undefined?{}:{childIds:["criticalProbability"]})});
  const trace=[...b.nodes,...prefixTrace(additiveTrace,"additive"),...nonCritical.trace,...critBranch(critical.trace,"critical"),...critBranch(expected.trace,"expected"),...weighted.nodes];
  if(!hit.critEligible) trace.push(infoNode("critIneligible","此伤害定义不允许暴击，因此暴击分支与期望分支均等于非暴击伤害。"));
  if(hit.hitWeakPoint)trace.push(infoNode("nonCriticalCounterfactual",weakPointComparisonExplanation));
  for(const [i,mod] of (hit.excludedModifiers??[]).entries()) trace.push(infoNode(`excludedModifier.${i}`,`${mod.label}：${mod.reason}`));
  return {id:hit.id,label:hit.label,status:"calculated",nonCritical:nonCritical.finalDamage,critical:critical.finalDamage,expected:expected.finalDamage,effectiveCritRate:hit.critEligible?rate:0,
    ...(hit.hitWeakPoint===undefined?{}:{criticalProbability:probability}),...(hit.hitWeakPoint?{nonCriticalComparisonOnly:true as const,warnings:[weakPointComparisonExplanation]}:{}),trace,blockers:[]};
}
function aggregateCalculatedHits(doc:CalculatorDocument,hits:CalculatorHitResult[],blockers:string[]):{
  aggregation:CalculatorAggregation; totalTrace:CalculationTraceNode[]; totals?:{nonCritical:number;critical:number;expected:number};
} {
  const selectedIds=new Set(doc.selectedHitIds),byId=new Map(hits.map(hit=>[hit.id,hit]));
  const components:CalculatorAggregation["components"]=doc.hits.map(hit=>{
    const selected=selectedIds.has(hit.id),result=selected?byId.get(hit.id):undefined;
    const status=selected?result!.status:"excluded";
    const sourceRefs=[...new Set([...hit.sourceRefs,...hit.dependencies.flatMap(id=>doc.dependencies.find(dependency=>dependency.id===id)?.sourceRefs??[])])];
    const amount=result?.status==="calculated"?result.castContribution??result:undefined;
    return {id:hit.id,label:hit.label,selected,kind:hit.kind,status,sourceRefs,blockers:result?.blockers??[],
      ...(result?.castContribution?{triggerProbability:result.castContribution.triggerProbability}:{}),
      ...(amount?{damage:{nonCritical:amount.nonCritical!,critical:amount.critical!,expected:amount.expected!}}:{})};
  });
  const omittedHitIds=components.filter(component=>component.status==="excluded"||component.status==="blocked").map(component=>component.id);
  const blocked=blockers.length>0||components.some(component=>component.status==="blocked");
  const allSelected=components.every(component=>component.selected);
  const synthetic=doc.dataIdentity.evidenceStatus==="synthetic"||doc.dataIdentity.releaseStatus==="synthetic";
  const scope:CalculatorAggregation["scope"]=doc.scope==="single-hit"?"single-hit"
    :synthetic||!doc.gameContext?"declared-hit-set"
    :doc.gameContext.scopeCoverage==="complete-cast"&&allSelected&&!blocked?"complete-cast":"selected-components";
  const completenessReasons:string[]=[];
  if(doc.scope==="single-hit")completenessReasons.push("当前入口只声明单个命中，不能据此推断整次施放。");
  else if(synthetic||!doc.gameContext)completenessReasons.push("缺少可证明完整施放的角色来源上下文；结果仅覆盖文档声明的命中集合。");
  else if(doc.gameContext.scopeCoverage!=="complete-cast")completenessReasons.push(`角色来源上下文声明的覆盖范围为 ${doc.gameContext.scopeCoverage}，并非完整施放。`);
  if(!allSelected)completenessReasons.push(`有 ${components.filter(component=>!component.selected).length} 个已准备命中未被选择，未计入当前聚合。`);
  if(blocked)completenessReasons.push("有已选命中仍被阻塞；已算段小计不代表完整结果。");
  const damaging=components.filter(component=>component.status==="calculated"&&component.damage!==undefined);
  const totalTrace:CalculationTraceNode[]=[];
  let knownSubtotal:{nonCritical:number;critical:number;expected:number}|undefined;
  if(damaging.length){
    const builder=new TraceBuilder(DAMAGE_FORMULA_SOURCES);
    const prefix=blocked?"subtotal":"total";
    const sourceRefs=[...new Set([...DAMAGE_FORMULA_SOURCES,...damaging.flatMap(component=>component.sourceRefs)])];
    const subtotalName={nonCritical:"非暴击",critical:"暴击",expected:"期望"};
    const sum=(field:"nonCritical"|"critical"|"expected")=>builder.add(`${prefix}.${field}`,blocked?`已计算命中${subtotalName[field]}小计`:`stage.total.${field}`,
      expr.add(...damaging.map((_,index)=>v(`hit${index+1}`))),
      damaging.map((component,index)=>traceInput(`hit${index+1}`,component.damage![field],"damage",
        {kind:component.triggerProbability===undefined?"selected-hit-result":"cast-occurrence-contribution",reference:component.id},
        `${component.label}（命中计算结果 ${component.id}）：${component.triggerProbability===undefined?"本段已算伤害":"按触发概率及整次归因计算的贡献"}；${subtotalName[field]}`)),
      {unit:"damage",sourceRefs,explanationKey:blocked?"只对当前确实算出的已选命中逐段求和；阻塞与未选命中均未当作零伤害。":"explain.skillTotal"});
    knownSubtotal={nonCritical:sum("nonCritical"),critical:sum("critical"),expected:sum("expected")};
    totalTrace.push(...builder.nodes);
  }
  const aggregation:CalculatorAggregation={version:"calculator-aggregation-v1",scope,status:blocked?"blocked":"calculated",
    attributionPolicy:doc.gameContext?.attributionPolicy??"只合计文档声明且已选择的命中；条件追击在整次施放中按实际触发概率归因。",
    components,...(knownSubtotal?{knownSubtotal}:{}),omittedHitIds,completenessReasons};
  return {aggregation,totalTrace,...(!blocked&&knownSubtotal?{totals:knownSubtotal}:{})};
}

export function calculateDocument(document:CalculatorDocument,trust:CalculatorTrustContext={}):CalculatorResult {
  const supplied=calculatorDocumentSchema.parse(document);
  const doc=prepareSourceCastDocument(prepareIncomingThrillingTales(prepareColleiCharlotteSkillDocument(prepareBaizhuSkillDocument(prepareWeaponProcCalculatorDocument(supplied)))));
  const selected=doc.hits.filter(hit=>doc.selectedHitIds.includes(hit.id));
  const usesOrdinaryBuild=selected.some(hit=>hit.kind==="ordinary"&&!hit.finalSnapshot);
  const usesCritPanel=selected.some(hit=>hit.kind==="resolved");
  const usesSourceSpecialBuild=selected.some(hit=>hit.kind==="special"&&(hit.mixedSourceEvent||hit.travelerCryoStateEvent||hit.zibaiFiniteEvent||hit.observedSpecialComponentEvent||hit.neferPhantasmEvent)&&!hit.finalSnapshot);
  const usesPanel=usesOrdinaryBuild||usesSourceSpecialBuild||usesCritPanel||selected.some(hit=>hit.kind==="transformative");
  const {stats,trace:allBuildTrace}=usesPanel?buildStats(doc.build):{stats:undefined,trace:[]};
  const buildTrace=usesOrdinaryBuild||usesSourceSpecialBuild?allBuildTrace:usesCritPanel?allBuildTrace.filter(node=>["critRatePercent","critDamagePercent","supplied.critRate","supplied.critDamage"].includes(node.id)):[];
  const calculated=new Map<string,CalculatorHitResult>();
  const evaluate=(hit:CalculatorHit)=>{let value=calculated.get(hit.id);if(!value){value=calculateHit(doc,hit,stats);calculated.set(hit.id,value);}return value;};
  const hits=selected.map(hit=>{
    if(hit.kind!=="ordinary"||!hit.occurrence)return evaluate(hit);
    const occurrence=hit.occurrence;
    if(!occurrence.enabled)return {id:hit.id,label:hit.label,status:"non-damaging" as const,trace:[infoNode("inactiveOccurrence","本段来源触发条件未成立（未解锁或主击时不在场），本次没有此伤害实例。")],blockers:[]};
    const result=evaluate(hit);
    if(result.status!=="calculated")return result;
    const occurrenceTrace=new TraceBuilder(occurrence.sourceRefs);
    if(doc.scope==="single-hit"){
      occurrenceTrace.add("conditionedOccurrence","stage.conditionedOccurrence",n(1),[],{unit:"boolean",status:"assumed",explanationKey:"explain.conditionedOccurrence",applicabilityReason:"单击入口明确以此追击已经触发为条件；不乘主击暴击概率，显示实际追击本身的伤害分支。"});
      return {...result,trace:[...result.trace,...occurrenceTrace.nodes]};
    }
    const parent=doc.hits.find(candidate=>candidate.id===occurrence.sourceHitId)!;
    const source=evaluate(parent);
    if(source.status!=="calculated"||source.effectiveCritRate===undefined)return {...result,status:"blocked" as const,blockers:[`无法解析触发主击 ${parent.id} 的实际暴击概率：${source.blockers.join("；")}`]};
    const sourceProbabilityKey=source.criticalProbability===undefined?"sourceCritRate":"sourceCriticalProbability";
    const probability=occurrenceTrace.add("occurrenceProbability","stage.occurrenceProbability",v(sourceProbabilityKey),[traceInput(sourceProbabilityKey,source.criticalProbability??source.effectiveCritRate,"ratio","resolved-source-hit",source.criticalProbability===undefined?"input.sourceCritRate":"触发主击的实际暴击发生概率；不是被改写后的面板暴击率")],{unit:"ratio",explanationKey:"explain.occurrenceProbability",applicabilityReason:`触发来源：${parent.label}；${source.nonCriticalComparisonOnly?"本击弱点来源必暴，使用实际发生概率1，保留其真实面板暴击率。":"使用该段独立条件暴击和装备加成结算后的限幅概率。"}`});
    const contribution={
      nonCritical:occurrenceTrace.add("occurrence.nonCritical","stage.occurrenceNonCritical",n(0),[],{unit:"damage",explanationKey:"explain.occurrenceNonCritical"}),
      critical:occurrenceTrace.add("occurrence.critical","stage.occurrenceCritical",v("criticalDamage"),[traceInput("criticalDamage",result.critical!,"damage","conditional-hit","input.criticalDamage")],{unit:"damage",explanationKey:"explain.occurrenceCritical"}),
      expected:occurrenceTrace.add("occurrence.expected","stage.occurrenceExpected",expr.mul(v("triggerProbability"),v("conditionalExpectedDamage")),[traceInput("triggerProbability",probability,"ratio","source-hit-critical-probability","input.triggerProbability"),traceInput("conditionalExpectedDamage",result.expected!,"damage","conditional-hit","input.conditionalExpectedDamage")],{unit:"damage",explanationKey:"explain.occurrenceExpected",childIds:["occurrenceProbability"]}),
      triggerProbability:probability
    };
    return {...result,castContribution:contribution,trace:[...result.trace,...(!doc.selectedHitIds.includes(parent.id)?prefixTrace(source.trace,"triggerSource"):[]),...occurrenceTrace.nodes]};
  });
  hits.forEach((result,index)=>{result.trace.push(...rawSourceStateTrace(doc,selected[index]!),...observedCharacterResourceTrace(doc,selected[index]!),...neferPhantasmEventTrace(selected[index]!),...iansanSwiftResolvedEventTrace(selected[index]!),...observedSpecialComponentEventTrace(selected[index]!),...travelerHydroResolvedEventTrace(selected[index]!),...travelerCryoStateEventTrace(selected[index]!),...travelerCrossEntityEventTrace(selected[index]!),...zibaiFiniteEventTrace(selected[index]!),...entityFollowupEventTrace(selected[index]!),...extendedStanceEventTrace(selected[index]!),...noellePlungeEventTrace(selected[index]!),...mixedSourceEventTrace(selected[index]!),...coordinatedEventTrace(selected[index]!),...heldLifecycleEventTrace(selected[index]!),...idleStanceEventTrace(selected[index]!),...observedEntityEventTrace(selected[index]!,doc),...periodicOrdinaryEventTrace(selected[index]!),...travelerMaleChargedEventTrace(selected[index]!));});
  const blockers=hits.flatMap(hit=>hit.blockers);
  const equipment=usesOrdinaryBuild&&doc.build.mode==="equipment-derived"?doc.build.equipment:undefined;
  const excludedEquipment=doc.build.mode==="equipment-derived"?doc.build.equipment:undefined;
  if(excludedEquipment?.additiveBaseBonuses?.length||excludedEquipment?.criticalBonuses?.length)hits.forEach((result,index)=>{if(selected[index]!.kind!=="ordinary")result.trace.push(infoNode("ordinaryEquipmentEffectsExcluded","普通命中的装备基数附加与标签暴击属性不适用于本段；未转成剧变、特殊反应或非伤害事件的效果。"));});
  const warnings=[...doc.assumptions,...hits.flatMap(hit=>hit.warnings??[]),...(equipment?.assumptions??[]),...(equipment?.effectBlockers??[])];
  if(usesOrdinaryBuild&&equipment&&equipment.bonusAccounting!=="core-sourced-v1")warnings.push("旧版装备文档兼容模式：元素／物理面板增伤已包含于各段输入，不再次从装备来源加算；重新应用装备会迁移到来源逐项结算。");
  if(usesOrdinaryBuild&&doc.build.mode!=="equipment-derived") warnings.push("最终面板作为入口；其之前的装备与增益分解不可用，不重复加入装备数值。");
  if(doc.dataIdentity.releaseStatus!=="released"&&doc.dataIdentity.releaseStatus!=="synthetic") warnings.push(`数据渠道 ${doc.dataIdentity.releaseStatus}：不能进入已发布验证排名。`);
  if(doc.enemy.defenseAdjustment < -0.9) warnings.push("历史有符号防御调整低于 -90%；超出本次来源确认的减防上限，结果仅作兼容条件计算。");
  const trustResult=evaluateCalculatorTrust(supplied,trust);
  if(doc.dataIdentity.evidenceStatus==="verified"&&!trustResult.verified) warnings.push("文件内自称 verified 的证据未由当前已晋升来源及本击依赖确认；保留原始声明，但结果降为 provisional。");
  const provisional=!trustResult.verified||doc.enemy.defenseAdjustment < -0.9;
  if(doc.dataIdentity.evidenceStatus!=="synthetic")warnings.push(...trustResult.reasons);
  if(provisional&&doc.dataIdentity.evidenceStatus!=="synthetic") warnings.push("相关数值或机制证据仍为 provisional；计算可复现不等于已验证的完整游戏机制。");
  const aggregate=aggregateCalculatedHits(doc,hits,blockers);
  const result:CalculatorResult={status:aggregate.aggregation.status,verification:aggregate.aggregation.status==="blocked"?"blocked":doc.dataIdentity.evidenceStatus==="synthetic"?"synthetic":provisional||doc.dataIdentity.releaseStatus!=="released"?"provisional":"verified",hits,aggregation:aggregate.aggregation,trace:[...prefixTrace(buildTrace,"build"),...prefixTrace(neferPhantasmResourceTrace(doc),"neferResources"),...prefixTrace(alyoshaObservedTrace(doc),"alyoshaObserved"),...prefixTrace(neferObservedTrace(doc),"neferObserved"),...prefixTrace(linneaObservedTrace(doc),"linneaObserved"),...prefixTrace(sandroneObservedTrace(doc),"sandroneObserved"),...prefixTrace(observedZibaiResourceEventTrace(doc),"zibaiResources"),...hits.flatMap(hit=>prefixTrace(hit.trace,hit.id)),...aggregate.totalTrace],includedHitIds:selected.map(hit=>hit.id),excludedHitIds:doc.hits.filter(hit=>!doc.selectedHitIds.includes(hit.id)).map(hit=>hit.id),warnings,blockers,
    ...(aggregate.totals?{totals:aggregate.totals}:{})};
  if(result.totals) {
    if(doc.counterexample==="shared-amplification-shortcut"&&selected.every(hit=>hit.kind==="resolved")) {
      const b=new TraceBuilder([]); const rate=Math.max(0,Math.min(1,stats!.critRate));
      const crit=b.add("counterexample.expectedMultiplier","stage.expectedMultiplier",expr.add(n(1),expr.mul(v("critRate"),v("critDamage"))),[traceInput("critRate",rate),traceInput("critDamage",stats!.critDamage)],{explanationKey:"explain.expectedMultiplier"});
      const multiplier=selected[0]!.amplificationMultiplier;
      const inputs=selected.map((hit,i)=>traceInput(`hit${i+1}`,hit.preReactionDamage,"damage"));
      const incorrect=b.add("counterexample.incorrect","stage.counterexample",expr.mul(expr.add(...inputs.map(input=>v(input.key))),v("amplificationMultiplier"),v("expectedMultiplier")),[...inputs,traceInput("amplificationMultiplier",multiplier),traceInput("expectedMultiplier",crit)],{unit:"damage",status:"assumed",explanationKey:"explain.counterexample"});
      const overstatement=b.add("counterexample.overstatement","stage.overstatement",expr.sub(v("incorrectDamage"),v("correctDamage")),[traceInput("incorrectDamage",incorrect,"damage"),traceInput("correctDamage",result.totals.expected,"damage")],{unit:"damage",explanationKey:"explain.overstatement"});
      result.counterexample={incorrect,overstatement,trace:b.nodes,explanation:"错误示范：把第一段的增幅覆盖到所有段数；仅供教学，绝不计入正式总伤害。"};
    }
  }
  return result;
}
export const calculateSkill=calculateDocument;
