import { optimizerSpecialComponents, type OptimizerSpecialComponent } from "../../game-data/src/character-mappings/optimizer-special-components";
import { observedSpecialComponentContextSchema, type ObservedSpecialComponentContext, type CalculatorDocument, type CalculatorHit, type CalculatorFormula, type CalculatorFinalStats } from "./calculator-model";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode, type FormulaExpression } from "./calculation-trace";
import type { ConditionedSpecialCalculation } from "@genshin-dps-lab/reaction-formulas";
type Special=Extract<CalculatorHit,{kind:"special"}>;type Ordinary=Extract<CalculatorHit,{kind:"ordinary"}>;
const prefix="observed-special-component:",sourceId=prefix+"source";
const componentOf=(d:CalculatorDocument)=>optimizerSpecialComponents.find(row=>row.id===d.gameContext?.skillId);
export const isObservedSpecialComponentAction=(d:CalculatorDocument)=>componentOf(d)!==undefined;
const ascOf=(d:CalculatorDocument,h?:Special)=>h?.finalSnapshot?.ascension??(d.build.mode==="equipment-derived"?d.build.equipment?.ascension:d.build.ascension)??d.gameContext?.ascension;
const stateOf=(c:ObservedSpecialComponentContext,h:Special)=>({...c.sharedState,...c.hitStates?.[h.id]});
const refs=(p:OptimizerSpecialComponent)=>p.sourceRefs;
function identity(d:CalculatorDocument,c:ObservedSpecialComponentContext,h:Special):string{return JSON.stringify({event:h.observedSpecialComponentEvent,snapshot:h.observedSpecialComponentEvent?c.snapshots?.[h.observedSpecialComponentEvent.snapshotId]:null,state:stateOf(c,h),talent:d.gameContext?.effectiveTalentLevel,constellation:d.gameContext?.constellation,ascension:ascOf(d,h)});}
const inputUnits:Record<string,string>={preConversionStat:"stat",includedEm:"stat",panelEm:"stat",emDelta:"stat",actualIntrinsicStat:"stat",decodingPower:"count",tacticsConsumed:"count",frame:"frames",snapshotFrame:"frames"};
const stage=(b:TraceBuilder,id:string,expression:FormulaExpression,values:Record<string,number>,unit="ratio",reason?:string)=>b.add(`component.${id}`,`stage.component.${id}`,expression,Object.entries(values).map(([key,value])=>traceInput(key,value,inputUnits[key]??"ratio","observed-source-component",`input.component.${key}`)),{unit,explanationKey:`explain.component.${id}`,...(reason?{applicabilityReason:reason}:{})});
/** Takes a real character document from its existing selected dataset; this never changes release identity. */
export function createObservedSpecialComponentDocument(base:CalculatorDocument,componentId:string):CalculatorDocument {
  const p=optimizerSpecialComponents.find(row=>row.id===componentId);if(!p)throw new Error(`Unknown source special component ${componentId}`);
  if(base.dataIdentity.releaseStatus==="preview"||base.dataIdentity.releaseStatus==="official-next")throw new Error("此固定来源特殊组成尚未审阅当前预览数据，不能将正式数据系数填入 preview 或 official-next 文档。");
  if(!base.gameContext)throw new Error("来源特殊组成需要已选择的真实角色身份。");
  if(base.gameContext.abilityId.split(":")[1]!==p.characterSlug)throw new Error("所选特殊组成不属于当前角色，请先选择对应角色的来源文档。");
  const d=structuredClone(base),g=d.gameContext!;
  g.skillId=p.id;g.skillName=p.label;g.abilityId=`talent:${p.characterSlug}:${p.abilityKey}`;g.scopeCoverage="single-hit";g.attributionPolicy="只计算一击已经实际发生的指定特殊组成，不等同于完整重击、技能或召唤物生命周期。";
  d.id=p.id;d.label=p.label;d.scope="single-hit";delete g.observedSpecialComponent;
  d.hits=[{id:`${p.id}:actual`,kind:"blocked",label:p.label,reasons:["请填写本击实际事件与专属上下文。"],sourceRefs:refs(p),dependencies:[]}];d.selectedHitIds=[d.hits[0]!.id];d.dependencies=[];
  d.assumptions=[...p.assumptions,...p.exclusions];return prepareObservedSpecialComponentDocument(d);
}
function emFormula(d:CalculatorDocument,p:OptimizerSpecialComponent,c:ObservedSpecialComponentContext,h:Special):CalculatorFormula {
  const a=ascOf(d,h)??0,s=stateOf(c,h),active=a>=4&&(p.passiveProfile!=="linnea"||s.linneaA4AppliesToSelf===true);
  const actual=!active?expr.value(0):p.passiveProfile==="linnea"?expr.mul(expr.input("preConversionStat"),expr.value(.05)):expr.min(expr.mul(expr.input("preConversionStat"),expr.value(.08)),expr.value(160));
  return {ruleId:`observed-component-${p.passiveProfile}-a4-em`,label:p.passiveProfile==="linnea"?"莉奈娅本人实际接受A4的转换前DEF×5%，减面板已含EM":"桑多涅A4：min(转换前ATK×8%,160)，减面板已含EM",expression:expr.sub(actual,expr.input("includedEm")),inputs:[...(active?[{key:"preConversionStat",value:s.a4PreConversionStat??0,unit:"stat",meaningKey:"input.component.preConversionStat",origin:"explicit-source-snapshot"}]:[]),{key:"includedEm",value:s.includedCharacterEm??0,unit:"stat",meaningKey:"input.component.includedEm",origin:"explicit-accounting"}],sourceRefs:refs(p),requirements:{maximumConstellation:0}};
}
export function observedSpecialComponentPanelProxy(d:CalculatorDocument,h:Special):Ordinary|undefined {
  const p=componentOf(d),c=d.gameContext?.observedSpecialComponent;if(!p||!c||h.finalSnapshot)return undefined;
  return {id:h.id,label:h.label,kind:"ordinary",element:p.resistanceElement,terms:[{stat:p.scalingStat,coefficient:1}],additiveBaseDamage:0,damageBonus:0,critEligible:true,reaction:"none",reactionBonus:0,groupMultiplier:1,sourceRefs:refs(p),dependencies:[],elementalMasteryAdjustment:{accounting:"add-to-panel",formula:emFormula(d,p,c,h)}};
}
export function prepareObservedSpecialComponentDocument(document:CalculatorDocument):CalculatorDocument {
  const p=componentOf(document);if(!p)return document;
  const d=structuredClone(document),g=d.gameContext!;
  if(d.dataIdentity.releaseStatus==="preview"||d.dataIdentity.releaseStatus==="official-next"){
    const id=`${p.id}:release-gate`,reason="此固定来源特殊组成尚未审阅当前预览数据；preview 与 official-next 不采用正式数据的固定系数。";
    d.hits=[{id,kind:"blocked",label:p.label,reasons:[reason],sourceRefs:refs(p),dependencies:[sourceId]}];d.selectedHitIds=[id];
    d.dependencies=[{id:sourceId,status:"missing",reason,sourceRefs:refs(p)}];d.assumptions=[reason];
    g.scopeCoverage=d.scope==="single-hit"?"single-hit":"selected-components";g.attributionPolicy="当前数据发布状态尚无匹配来源，未创建数值伤害组成。";
    return d;
  }
  const c=observedSpecialComponentContextSchema.parse(g.observedSpecialComponent??{});g.observedSpecialComponent=c;
  const old=d.hits.find((h):h is Special=>h.kind==="special"),event=c.independentEvent??old?.observedSpecialComponentEvent,id=event?`${p.id}:${event.candidateId}`:`${p.id}:actual`,level=g.effectiveTalentLevel;
  const blockers:string[]=[];if(g.abilityId!==`talent:${p.characterSlug}:${p.abilityKey}`)blockers.push("本击来源天赋与特殊组成不匹配，不能借用其他角色或其他技能的天赋身份。");if(g.constellation!==0)blockers.push("本组件只审阅C0，不省略高命座来源条件。");if(level>15)blockers.push("有效天赋须为固定来源1至15级。");if(c.actualComponentOccurred!==true)blockers.push("需要明确这次指定特殊组成已实际发生，不从持按时长或实体寿命猜次数。");
  if(!event)blockers.push("需要本击实际时刻、取样身份及目标；无需完整未来生命周期。");
  else {if(event.snapshotFrame>event.frame)blockers.push("实际快照时刻不能晚于本击交付。");if(c.targetId&&event.targetId!==c.targetId)blockers.push("保存命中的目标与当前目标不同。");}
  const h:Special={id,label:p.label,kind:"special",dependencies:[sourceId],sourceRefs:refs(p),context:{branch:p.specialBranch,ruleVersion:p.specialBranch.startsWith("lunar")?"kqm-lunar-luna-vi-20260922-v1":"kqm-stellar-7.0-20260922-v1",context:{mode:"conditioned",enablement:"assumed-enabled",contributorEligibility:"assumed",assumptions:p.assumptions},contributors:[{id:c.casterId??p.characterSlug,base:{kind:"direct-stat-talent",scalingStat:p.scalingStat,statValue:0,talentCoefficient:p.sourceCoefficientValues[level-1]??0,sourceRefs:refs(p)},elementalMastery:0,critRate:0,critDamage:0,specialBaseBonus:0,reactionBonus:0,specialAdditive:0,elevationMultiplier:1,modifierSourceRefs:refs(p)}],effectiveResistance:d.enemy.resistance,...(p.specialBranch==="stellar-conduct-direct"?{polestarApplicationCount:0}:{})},...(event?{observedSpecialComponentEvent:event}:{})};
  const snapshot=event?c.snapshots?.[event.snapshotId]:undefined;
  if(snapshot)h.finalSnapshot=structuredClone(snapshot);else if(old?.finalSnapshot&&c.finalizedHitEvents?.[id]===identity(d,c,h))h.finalSnapshot=structuredClone(old.finalSnapshot);
  if(old?.finalSnapshot&&!h.finalSnapshot)blockers.push("本击历史面板已删除或事件已变化，请重新恢复实际面板。");
  const s=stateOf(c,h),a=ascOf(d,h);if(a===undefined)blockers.push("需要实际突破阶段确定本击被动。");
  if(a!==undefined&&(h.finalSnapshot?.characterLevel??d.characterLevel)<[1,20,40,50,60,70,80][a]!)blockers.push("角色等级不符合本击突破阶段。");
  for(const key of ["specialBaseBonus","includedIntrinsicBaseBonus","reactionBonus","specialAdditive","elevationMultiplier"] as const)if(s[key]===undefined)blockers.push(`需要明确专属输入 ${key}；未知不能当作0或1。`);
  if(s.intrinsicStatMatchesSnapshot!==true&&s.actualIntrinsicStat===undefined)blockers.push("固有基础提升需命中时实际属性，或明确它与本击进攻面板相同。");
  if((a??4)>=4){if(s.includedCharacterEm===undefined)blockers.push("需明确输入面板已含的本角色A4精通份额。");if(p.passiveProfile==="linnea"&&s.linneaA4AppliesToSelf===undefined)blockers.push("需明确本击莉奈娅本人是否实际接受A4，不能只按前台月兆名称猜测。");if((p.passiveProfile==="sandrone"||s.linneaA4AppliesToSelf===true)&&s.a4PreConversionStat===undefined)blockers.push("需真实转换前属性计算A4，不能用已转换的最终面板反推。");}
  if(p.passiveProfile==="linnea"){
    if(p.id.includes("heavy-overdrive")&&(s.lumiForm!=="super-power"||s.nearbyMoondrift!==true))blockers.push("重锤需实际超强形态且附近存在月笼，不能从普通双击自动产生。");
    if(p.id.includes("million-ton")&&s.lumiForm!=="ultimate-power")blockers.push("百万吨重压需要实际究极形态；不重建喂食资源。");
    if((a??1)>=1&&(s.lumiPresent===undefined||s.targetWithinLumiA1Range===undefined||s.moonsignLevel===undefined||s.includedResistanceReduction===undefined))blockers.push("莉奈娅A1需本击露米在场、目标范围、月兆及抗性已含减抗份额。");
  }else{
    const branch=p.specialBranch==="stellar-conduct-direct"?"stellar-conduct":"stellar-swirl";
    if(s.actualRadiance!==branch)blockers.push("实际辉映必须匹配该星导／星旋分支；不与被替代的普通组成叠加。");
    if(p.attackTag==="charged"&&s.decodingMode!==true)blockers.push("凝聚光束需要实际处于解析模式。");
    if((a??1)>=1&&p.baseTalentMultiplierKind==="sandrone-skill-decoding"&&s.decodingPowerAtSkill===undefined)blockers.push("战技A1需要本次真实解析热量；恰好50不触发超过50分支。");
    if((a??1)>=1&&p.baseTalentMultiplierKind==="sandrone-burst-tactics"&&s.refinedTacticsConsumed===undefined)blockers.push("爆发A1需要本次真实消费精密战术层数0至10，与当前E热量无关。");
  }
  if(p.specialBranch==="stellar-conduct-direct"&&s.polestarApplicationCount===undefined)blockers.push("星导需要本击真实极星领域应用计数。");
  if(h.finalSnapshot){const f=emFormula(d,p,c,h),b=new TraceBuilder(refs(p));const delta=b.add("a4-history-check","stage.component.a4Em",f.expression,f.inputs.map(x=>traceInput(x.key,x.value,x.unit,x.origin,x.meaningKey)),{unit:"stat",explanationKey:"explain.component.a4Em"});if(delta!==0)blockers.push("历史完整面板必须已含实际A4及装备派生精通；请恢复正确快照，不能重采旧转换。");}
  if(c.finalizedHitEvents&&c.finalizedHitEvents[id]!==identity(d,c,h))blockers.push("本击来源状态变化，旧物化面板不能继续沿用。");
  d.hits=[h];d.selectedHitIds=[id];d.dependencies=[{id:sourceId,status:blockers.length?"missing":"provisional",reason:blockers.join("；")||p.coefficientEvidence,sourceRefs:refs(p)}];
  g.scopeCoverage=d.scope==="single-hit"?"single-hit":"selected-components";g.attributionPolicy="实际单次特殊组成；不承诺完整实体、持按或技能次数。普通被替代段不得重复计入。";d.assumptions=[...p.assumptions,...p.exclusions];return d;
}
export function resolveObservedSpecialComponentContext(d:CalculatorDocument,h:Special,panel:CalculatorFinalStats,panelAdjusted=false):{context:ConditionedSpecialCalculation;trace:CalculationTraceNode[];blockers:string[]} {
  const p=componentOf(d),c=d.gameContext?.observedSpecialComponent;if(!p||!c)return {context:h.context,trace:[],blockers:[]};
  const s=stateOf(c,h),a=ascOf(d,h)??0,stats=h.finalSnapshot?.stats??panel,b=new TraceBuilder(refs(p)),context=structuredClone(h.context),owner=context.contributors[0]!,blockers:string[]=[];
  const f=emFormula(d,p,c,h);const delta=b.add("component.a4Em","stage.component.a4Em",f.expression,f.inputs.map(x=>traceInput(x.key,x.value,x.unit,x.origin,x.meaningKey)),{unit:"stat",ruleId:f.ruleId,sourceRefs:f.sourceRefs,explanationKey:"explain.component.a4Em"});
  const em=panelAdjusted?stats.em:stage(b,"effectiveEm",expr.add(expr.input("panelEm"),expr.input("emDelta")),{panelEm:stats.em,emDelta:delta},"stat");
  const actualIntrinsic=s.intrinsicStatMatchesSnapshot===true?stats[p.intrinsicStat]:s.actualIntrinsicStat??0;
  const ownBase=stage(b,"intrinsicBase",expr.min(expr.mul(expr.input("actualIntrinsicStat"),expr.value(.00007)),expr.value(.14)),{actualIntrinsicStat:actualIntrinsic});
  owner.specialBaseBonus=stage(b,"baseBonus",expr.add(expr.input("inputBaseBonus"),expr.sub(expr.input("ownBaseBonus"),expr.input("includedBaseBonus"))),{inputBaseBonus:s.specialBaseBonus??0,ownBaseBonus:ownBase,includedBaseBonus:s.includedIntrinsicBaseBonus??0});
  let multiplier=1;if(a>=1&&p.baseTalentMultiplierKind==="sandrone-skill-decoding")multiplier=stage(b,"skillMultiplier",expr.condition("lt",expr.value(50),expr.input("decodingPower"),expr.value(4),expr.value(1)),{decodingPower:s.decodingPowerAtSkill??0});
  if(a>=1&&p.baseTalentMultiplierKind==="sandrone-burst-tactics")multiplier=stage(b,"burstMultiplier",expr.add(expr.value(1),expr.mul(expr.input("tacticsConsumed"),expr.value(.1))),{tacticsConsumed:s.refinedTacticsConsumed??0});
  const talent=stage(b,"talent",expr.mul(expr.input("sourceTalent"),expr.input("talentMultiplier")),{sourceTalent:p.sourceCoefficientValues[d.gameContext!.effectiveTalentLevel-1]!,talentMultiplier:multiplier});
  owner.base={kind:"direct-stat-talent",scalingStat:p.scalingStat,statValue:stats[p.scalingStat],talentCoefficient:talent,sourceRefs:refs(p)};owner.elementalMastery=em;owner.critRate=stats.critRate;owner.critDamage=stats.critDamage;owner.reactionBonus=s.reactionBonus??0;owner.specialAdditive=s.specialAdditive??0;owner.elevationMultiplier=s.elevationMultiplier??1;
  context.effectiveResistance=d.enemy.resistance;
  if(p.passiveProfile==="linnea"){
    const actualShred=a>=1&&s.lumiPresent===true&&s.targetWithinLumiA1Range===true?((s.moonsignLevel??0)>=2?.3:.15):0;
    context.effectiveResistance=stage(b,"resistance",expr.sub(expr.input("inputResistance"),expr.sub(expr.input("actualShred"),expr.input("includedShred"))),{inputResistance:d.enemy.resistance,actualShred,includedShred:s.includedResistanceReduction??0});
  }
  if(p.specialBranch==="stellar-conduct-direct")context.polestarApplicationCount=s.polestarApplicationCount??0;
  if(em<0||owner.specialBaseBonus<0)blockers.push("已含份额与实际属性／专属加成冲突，产生负值。");
  return {context,trace:b.nodes,blockers};
}
export function resetObservedSpecialComponentPanelAccounting(d:CalculatorDocument,mode:"fresh-equipment"|"imported-final"):void {
  if(!componentOf(d))return;const c=d.gameContext!.observedSpecialComponent??={};delete c.finalizedHitEvents;c.hitStates??={};
  const reset=(s:NonNullable<ObservedSpecialComponentContext["sharedState"]>)=>{if(mode==="fresh-equipment")s.includedCharacterEm=0;else delete s.includedCharacterEm;};
  for(const h of d.hits)if(h.kind==="special"&&h.finalSnapshot&&h.finalSnapshot.origin!=="equipment-conversion")c.hitStates[h.id]=stateOf(c,h);
  reset(c.sharedState??={});for(const h of d.hits)if(h.kind==="special"&&(!h.finalSnapshot||h.finalSnapshot.origin==="equipment-conversion")){reset(c.hitStates[h.id]??={});delete h.finalSnapshot;}
}
export function finalizeObservedSpecialComponentPanelAccounting(d:CalculatorDocument):void {
  const p=componentOf(d);if(!p)return;const c=d.gameContext!.observedSpecialComponent??={};c.hitStates??={};
  for(const h of d.hits)if(h.kind==="special"&&h.finalSnapshot?.origin==="equipment-conversion"){
    const s=stateOf(c,h),b=new TraceBuilder(refs(p)),f=emFormula(d,p,c,h);const delta=b.add("a4-finalize","stage.component.a4Em",f.expression,f.inputs.map(x=>traceInput(x.key,x.value,x.unit,x.origin,x.meaningKey)),{unit:"stat",explanationKey:"explain.component.a4Em"});
    (c.hitStates[h.id]??={}).includedCharacterEm=(s.includedCharacterEm??0)+delta;
  }
  c.finalizedHitEvents=Object.fromEntries(d.hits.filter((h):h is Special=>h.kind==="special").map(h=>[h.id,identity(d,c,h)]));
}
export function observedSpecialComponentEventTrace(h:CalculatorHit):CalculationTraceNode[]{if(h.kind!=="special"||!h.observedSpecialComponentEvent)return[];const b=new TraceBuilder(h.sourceRefs),e=h.observedSpecialComponentEvent;stage(b,"frame",expr.input("frame"),{frame:e.frame},"frames",`实际组成${e.candidateId}，目标${e.targetId}；不是自动动画帧。`);stage(b,"snapshotFrame",expr.input("snapshotFrame"),{snapshotFrame:e.snapshotFrame},"frames",`实际快照${e.snapshotId}`);return b.nodes;}
