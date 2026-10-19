import { neferPhantasmTemplates,neferPhantasmConstants as K,type NeferPhantasmRoleKey } from "../../game-data/src/character-mappings/nefer-phantasm-mappings";
import { neferPhantasmCastContextSchema,type NeferPhantasmCastContext,type CalculatorDocument,type CalculatorHit,type CalculatorFormula,type CalculatorFinalStats } from "./calculator-model";
import { compileNeferPhantasmSchedule,neferPhantasmEventIssues,type NeferPhantasmCandidate,type NeferPhantasmCastKind } from "./nefer-phantasm-schedule";
import { expr,TraceBuilder,traceInput,type CalculationTraceNode,type FormulaExpression } from "./calculation-trace";
import type { ConditionedSpecialCalculation } from "@genshin-dps-lab/reaction-formulas";
type Ordinary=Extract<CalculatorHit,{kind:"ordinary"}>;type Special=Extract<CalculatorHit,{kind:"special"}>;type Hit=Ordinary|Special;
const t=neferPhantasmTemplates[0]!,prefix="nefer-phantasm:",sourceId=prefix+"source",refs=[...new Set(Object.values(t.roles).flatMap(r=>r.sourceRefs))];
export const isNeferPhantasmCastAction=(d:CalculatorDocument)=>d.gameContext?.skillId===t.skillId;
const ascOf=(d:CalculatorDocument,h?:Hit)=>h?.finalSnapshot?.ascension??(d.build.mode==="equipment-derived"?d.build.equipment?.ascension:d.build.ascension)??d.gameContext?.ascension;
const stateOf=(c:NeferPhantasmCastContext,h:Hit)=>({...c.sharedState,...c.hitStates?.[h.id]});
function roleOf(h:Hit):NeferPhantasmRoleKey|undefined {return h.neferPhantasmEvent?.templateRole??(Object.keys(t.roles) as NeferPhantasmRoleKey[]).find(key=>t.roles[key].mappingId===h.id);}
function identity(d:CalculatorDocument,c:NeferPhantasmCastContext,h:Hit):string{return JSON.stringify({event:h.neferPhantasmEvent??h.id,snapshot:h.neferPhantasmEvent?c.snapshots?.[h.neferPhantasmEvent.snapshotId]??null:null,state:stateOf(c,h),talent:d.gameContext?.effectiveTalentLevel,constellation:d.gameContext?.constellation,ascension:ascOf(d,h)});}
const input=(key:string,value:number,unit="ratio",origin="actual-nefer-context")=>({key,value,unit,origin,meaningKey:`input.nefer.${key}`});
const unit=(key:string)=>key.includes("Frame")||key==="frame"?"frames":key.endsWith("Em")||key==="emDelta"?"stat":key==="veilStacks"?"count":key==="eligible"||key==="buffActive"?"boolean":"ratio";
const add=(b:TraceBuilder,id:string,e:FormulaExpression,values:Record<string,number>,resultUnit="ratio",reason?:string)=>b.add(`nefer.${id}`,`stage.nefer.${id}`,e,Object.entries(values).map(([key,value])=>traceInput(key,value,unit(key),"actual-nefer-context",`input.nefer.${key}`)),{unit:resultUnit,explanationKey:`explain.nefer.${id}`,...(reason?{applicabilityReason:reason}:{})});
function passive(d:CalculatorDocument,c:NeferPhantasmCastContext,h:Hit){const s=stateOf(c,h);return{state:s,eligible:(ascOf(d,h)??0)>=K.a1MinimumAscension&&(s.moonsignLevel??0)>=K.a1MoonsignThreshold};}
function emFormula(d:CalculatorDocument,c:NeferPhantasmCastContext,h:Hit):CalculatorFormula{
 const{state:s,eligible}=passive(d,c,h);return{ruleId:"nefer-phantasm-full-veil-em",label:"本击独立8秒满层帷幕精通窗口，减输入面板已含份额",expression:expr.sub(expr.mul(expr.input("eligible"),expr.input("buffActive"),expr.input("buffEm")),expr.input("includedEm")),inputs:[input("eligible",Number(eligible),"boolean"),input("buffActive",Number(eligible&&s.fullVeilEmBuffActive===true),"boolean"),input("buffEm",K.fullVeilEm,"stat","fixed-optimizer-source"),input("includedEm",s.includedFullVeilEm??0,"stat")],sourceRefs:refs,requirements:{maximumConstellation:0}};
}
function ordinaryBase(d:CalculatorDocument,c:NeferPhantasmCastContext,h:Ordinary,role:NeferPhantasmRoleKey):CalculatorFormula{
 const{state:s,eligible}=passive(d,c,h),r=t.roles[role],level=d.gameContext!.effectiveTalentLevel,terms=r.terms.map((term,i)=>expr.mul(expr.input(term.stat),expr.input(`coefficient${i}`)));
 return{ruleId:`nefer-phantasm-${role}-base`,label:"本人实际ATK与EM天赋基数 × (1 + 0.08 × 本击有效帷幕层数)",expression:expr.mul(expr.add(...terms),expr.add(expr.value(1),expr.mul(expr.input("veilStacks"),expr.input("veilBonus")))),inputs:[...r.terms.map((term,i)=>input(`coefficient${i}`,term.values[level-1]!,"ratio","fixed-optimizer-talent-table")),input("veilStacks",eligible?s.veilStacks??0:0,"count"),input("veilBonus",K.phantasmBonusPerVeil,"ratio","fixed-optimizer-source")],sourceRefs:r.sourceRefs,requirements:{maximumConstellation:0,elements:["dendro"],attackTags:["charged"]}};
}
function canonical(d:CalculatorDocument,c:NeferPhantasmCastContext,role:NeferPhantasmRoleKey,previous?:Hit,event?:NeferPhantasmCandidate):Hit{
 const r=t.roles[role],level=d.gameContext!.effectiveTalentLevel,id=event?`${t.skillId}:${event.id}`:previous?.id??r.mappingId,common={id,label:`${r.label}${event?` · 第${event.frame}帧`:" · 实际单击"}`,sourceRefs:r.sourceRefs,dependencies:[sourceId]};let h:Hit;
 if(r.kind==="ordinary"){
  const old=previous?.kind==="ordinary"?structuredClone(previous):undefined;
  h={...old,...common,kind:"ordinary",element:"dendro",attackTag:"charged",terms:r.terms.map(term=>({stat:term.stat,coefficient:term.values[level-1]!})),additiveBaseDamage:old?.additiveBaseDamage??0,damageBonus:old?.damageBonus??0,critEligible:true,reaction:old?.reaction??"none",reactionBonus:old?.reactionBonus??0,groupMultiplier:old?.groupMultiplier??1};
  delete h.additiveBaseFormula;delete h.damageBonusFormula;delete h.attackAdjustment;delete h.resistanceReductionFormula;delete h.critRateFormula;delete h.critDamageFormula;
 }else h={...common,kind:"special",context:{branch:"lunar-bloom-direct",ruleVersion:"kqm-lunar-luna-vi-20260922-v1",context:{mode:"conditioned",enablement:"assumed-enabled",contributorEligibility:"assumed",assumptions:t.assumptions},contributors:[{id:c.casterId??"nefer",base:{kind:"direct-stat-talent",scalingStat:"em",statValue:0,talentCoefficient:r.terms[0]!.values[level-1]!,sourceRefs:r.sourceRefs},elementalMastery:0,critRate:0,critDamage:0,specialBaseBonus:0,reactionBonus:0,specialAdditive:0,elevationMultiplier:1,modifierSourceRefs:r.sourceRefs}],effectiveResistance:d.enemy.resistance}};
 if(event){const{id:candidateId,contact:_contact,...rest}=event;h.neferPhantasmEvent={candidateId,...rest};}else if(previous?.neferPhantasmEvent)h.neferPhantasmEvent=structuredClone(previous.neferPhantasmEvent);
 const snapshot=h.neferPhantasmEvent?c.snapshots?.[h.neferPhantasmEvent.snapshotId]:undefined,unchanged=previous&&c.finalizedHitEvents?.[id]===identity(d,c,h);
 if(snapshot)h.finalSnapshot=structuredClone(snapshot);else if(unchanged&&previous?.finalSnapshot)h.finalSnapshot=structuredClone(previous.finalSnapshot);else delete h.finalSnapshot;
 if(h.kind==="ordinary"){
  h.baseDamageFormula=ordinaryBase(d,c,h,role);h.elementalMasteryAdjustment={accounting:h.finalSnapshot?"already-in-final-panel":"add-to-panel",formula:emFormula(d,c,h)};
  if(!unchanged||snapshot&&JSON.stringify(snapshot)!==JSON.stringify(previous?.finalSnapshot)){delete h.effectiveResistance;delete h.effectiveCritRate;delete h.effectiveCritDamage;}
 }
 return h;
}
export function prepareNeferPhantasmCastDocument(document:CalculatorDocument):CalculatorDocument{
 if(!isNeferPhantasmCastAction(document))return document;
 const d=structuredClone(document),g=d.gameContext!,c=neferPhantasmCastContextSchema.parse(g.neferPhantasmCast??{});g.neferPhantasmCast=c;
 if(d.dataIdentity.releaseStatus==="preview"||d.dataIdentity.releaseStatus==="official-next"){
  d.hits=[{id:`${t.skillId}:dataset-blocked`,kind:"blocked",label:t.label,reasons:["固定已发布来源幻戏不能填入预览或下版本数据；需要该数据集独立的系数与机制证据。"],sourceRefs:refs,dependencies:[sourceId]}];d.selectedHitIds=[d.hits[0]!.id];d.dependencies=[{id:sourceId,status:"missing",reason:"已发布固定来源与当前预览数据身份不同。",sourceRefs:refs}];return d;
 }
 const prior=d.hits,selected=new Set(d.selectedHitIds),all=prior.every(h=>selected.has(h.id)),old=new Map(prior.filter((h):h is Hit=>h.kind==="ordinary"||h.kind==="special").map(h=>[h.id,h])),issues:string[]=[];
 d.dependencies=d.dependencies.filter(row=>!row.id.startsWith(prefix));
 if(g.constellation!==0)issues.push("本次有限幻戏仅核对C0；C2精通和C6额外组成不能套用C0。");if(g.effectiveTalentLevel>15)issues.push("有效战技天赋需为固定来源1至15级。");
 if(g.abilityId!=="talent:nefer:combat2")issues.push("幻戏系数来自奈芙尔战技天赋，不使用普攻等级。");
 const reps=()=>[canonical(d,c,"nefer1",[...old.values()].find(h=>roleOf(h)==="nefer1"&&!h.neferPhantasmEvent))];let independentId:string|undefined;
 if(g.effectiveTalentLevel>15)d.hits=prior;
 else if(d.scope==="single-hit"){
  if(c.independentEvent){const{candidateId:id,...rest}=c.independentEvent,key=`${t.skillId}:${id}`;d.hits=[...old.values()].filter(h=>h.id!==key);d.hits.push(canonical(d,c,rest.templateRole,old.get(key),{id,...rest}));independentId=key;}
  else d.hits=old.size?[...old.values()].map(h=>{const role=roleOf(h);if(!role)return h;const e=h.neferPhantasmEvent;if(!e)return canonical(d,c,role,h);const{candidateId:id,...rest}=e;return canonical(d,c,role,h,{id,...rest});}):reps();
 }else{const schedule=compileNeferPhantasmSchedule(t.skillId,c);issues.push(...schedule.issues);d.hits=schedule.complete?schedule.instances.map(e=>canonical(d,c,e.templateRole,old.get(`${t.skillId}:${e.id}`),e)):reps();if(!d.hits.length)d.hits=[{id:`${t.skillId}:no-contact`,kind:"non-damaging",label:"完整幻戏五段均落空",reason:"实际五段接触均已明确，归属本目标伤害为零。",sourceRefs:refs,dependencies:[sourceId]}];}
 const retained=d.hits.filter(h=>selected.has(h.id)).map(h=>h.id);d.selectedHitIds=d.scope==="single-hit"?[independentId??retained[0]??d.hits[0]!.id]:all||!retained.length?d.hits.map(h=>h.id):retained;
 d.dependencies.push({id:sourceId,status:"provisional",reason:"固定Optimizer五段来源＋实际已发生事件，未认证完整九秒影舞与自动草露生成。",sourceRefs:refs});
 const dependency=(id:string,reasons:string[],hits:CalculatorHit[])=>{d.dependencies.push({id,status:reasons.length?"missing":"provisional",reason:reasons.join("；")||"本击实际状态与已含份额已明确。",sourceRefs:refs});hits.forEach(h=>h.dependencies=[...new Set([...h.dependencies,id])]);};dependency(prefix+"schedule",issues,d.hits);
 for(const h of d.hits)if(h.kind==="ordinary"||h.kind==="special"){
  const reasons:string[]=[],e=h.neferPhantasmEvent,s=stateOf(c,h),a=ascOf(d,h);
  if(c.phantasmOccurred!==true||c.shadowDanceActiveAtAction!==true)reasons.push("须明确本击确实来自影舞内已发生的幻戏；单击不需要未选未来四段或起手资源账本。");
  if(!e)reasons.push("请恢复本击实际事件，不执行无实际面板身份的代表行。");else reasons.push(...neferPhantasmEventIssues(e,c.targetId));
  if(a===undefined)reasons.push("需明确本击实际突破阶段。");else if((h.finalSnapshot?.characterLevel??d.characterLevel)<[1,20,40,50,60,70,80][a]!)reasons.push("角色等级不符合实际突破阶段。");
  if((a??1)>=1){if(s.moonsignLevel===undefined)reasons.push("A1需实际月兆；未知不能当未激活。");if((s.moonsignLevel??2)>=2&&(s.veilStacks===undefined||s.fullVeilEmBuffActive===undefined||s.includedFullVeilEm===undefined))reasons.push("A1需本击帷幕层数、独立8秒精通窗口和输入面板已含份额；满层不能自动推断窗口仍有效。");}
  if(e&&d.scope!=="single-hit"&&c.statsStableAcrossHits!==true&&!h.finalSnapshot)reasons.push(`缺本击真实快照 ${e.snapshotId}；不默认五段面板相同。`);
  if(old.get(h.id)?.finalSnapshot&&!h.finalSnapshot)reasons.push("旧历史面板已删除或身份变化，需恢复真实面板。");
  if(h.finalSnapshot){const f=emFormula(d,c,h),b=new TraceBuilder(refs),delta=b.add("nefer.checkEm","stage.nefer.emDelta",f.expression,f.inputs.map(v=>traceInput(v.key,v.value,v.unit,v.origin,v.meaningKey)));if(delta!==0)reasons.push("历史完整面板必须已含实际100精通窗口及装备派生；不能在旧快照补算未保存的转换。");}
  if(h.kind==="special"){
   for(const key of ["specialBaseBonus","includedIntrinsicBaseBonus","reactionBonus","specialAdditive","elevationMultiplier"] as const)if(s[key]===undefined)reasons.push(`需要明确影子月绽放输入 ${key}。`);
   if(s.intrinsicEmMatchesSnapshot!==true&&s.actualIntrinsicEm===undefined)reasons.push("固有月绽放基础提升需命中实际EM，或明确与本击取样EM相同。");
  }
  if(c.finalizedHitEvents&&c.finalizedHitEvents[h.id]!==identity(d,c,h))reasons.push("本击来源状态已变，旧物化面板不能继续沿用。");dependency(prefix+h.id,reasons,[h]);
 }
 const chosen=d.hits.filter(h=>d.selectedHitIds.includes(h.id));g.scopeCoverage=d.scope==="single-hit"?"single-hit":chosen.length===d.hits.length&&!chosen.some(h=>h.dependencies.some(id=>d.dependencies.find(row=>row.id===id)?.status==="missing"))?"complete-cast":"selected-components";
 g.attributionPolicy="一次实际幻戏：本人两段普通草伤＋三个影子直接月绽放。仅对实际命中本目标的段求和；独立单击不索未来日程。不是完整影舞、草露自动生成或第三次后续技能。";
 d.assumptions=[...d.assumptions.filter(row=>!row.startsWith("奈芙尔有限幻戏：")),...t.assumptions.map(row=>`奈芙尔有限幻戏：${row}`)];return d;
}
export function neferPhantasmSpecialPanelProxy(d:CalculatorDocument,h:Special):Ordinary|undefined{
 const c=d.gameContext?.neferPhantasmCast;if(!isNeferPhantasmCastAction(d)||!c||h.finalSnapshot)return undefined;
 return{id:h.id,label:h.label,kind:"ordinary",element:"dendro",terms:[{stat:"em",coefficient:1}],additiveBaseDamage:0,damageBonus:0,critEligible:true,reaction:"none",reactionBonus:0,groupMultiplier:1,sourceRefs:h.sourceRefs,dependencies:[],elementalMasteryAdjustment:{accounting:"add-to-panel",formula:emFormula(d,c,h)}};
}
export function resolveNeferPhantasmSpecialContext(d:CalculatorDocument,h:Special,panel:CalculatorFinalStats,panelAdjusted=false):{context:ConditionedSpecialCalculation;trace:CalculationTraceNode[];blockers:string[]}{
 const c=d.gameContext?.neferPhantasmCast;if(!isNeferPhantasmCastAction(d)||!c)return{context:h.context,trace:[],blockers:[]};const role=roleOf(h);if(!role||!h.neferPhantasmEvent)return{context:h.context,trace:[],blockers:["本击实际影子事件缺失，不执行代表值。"]};
 const{state:s,eligible}=passive(d,c,h),stats=h.finalSnapshot?.stats??panel,b=new TraceBuilder(refs),f=emFormula(d,c,h),delta=b.add("nefer.emDelta","stage.nefer.emDelta",f.expression,f.inputs.map(v=>traceInput(v.key,v.value,v.unit,v.origin,v.meaningKey)),{unit:"stat",ruleId:f.ruleId,explanationKey:"explain.nefer.emDelta"}),em=panelAdjusted?stats.em:add(b,"effectiveEm",expr.add(expr.input("panelEm"),expr.input("emDelta")),{panelEm:stats.em,emDelta:delta},"stat"),context=structuredClone(h.context),owner=context.contributors[0]!;
 const factor=add(b,"veilFactor",expr.add(expr.value(1),expr.mul(expr.input("veilStacks"),expr.input("veilBonus"))),{veilStacks:eligible?s.veilStacks??0:0,veilBonus:K.phantasmBonusPerVeil});
 const coefficient=add(b,"shadeCoefficient",expr.mul(expr.input("sourceCoefficient"),expr.input("veilFactor")),{sourceCoefficient:t.roles[role].terms[0]!.values[d.gameContext!.effectiveTalentLevel-1]!,veilFactor:factor});
 const actualEm=s.intrinsicEmMatchesSnapshot===true?em:s.actualIntrinsicEm??0,ownBase=add(b,"intrinsicBase",expr.min(expr.mul(expr.input("actualEm"),expr.input("intrinsicRate")),expr.input("intrinsicCap")),{actualEm,intrinsicRate:K.intrinsicLunarBloomEmRate,intrinsicCap:K.intrinsicLunarBloomBaseBonusCap});
 owner.specialBaseBonus=add(b,"baseBonusTotal",expr.add(expr.input("inputBaseBonus"),expr.sub(expr.input("ownBaseBonus"),expr.input("includedBaseBonus"))),{inputBaseBonus:s.specialBaseBonus??0,ownBaseBonus:ownBase,includedBaseBonus:s.includedIntrinsicBaseBonus??0});
 owner.base={kind:"direct-stat-talent",scalingStat:"em",statValue:em,talentCoefficient:coefficient,sourceRefs:h.sourceRefs};owner.elementalMastery=em;owner.critRate=stats.critRate;owner.critDamage=stats.critDamage;owner.reactionBonus=s.reactionBonus??0;owner.specialAdditive=s.specialAdditive??0;owner.elevationMultiplier=s.elevationMultiplier??1;context.effectiveResistance=d.enemy.resistance;
 return{context,trace:b.nodes,blockers:em<0||owner.specialBaseBonus<0?["实际EM／专属基础提升与已含份额冲突。"]:[]};
}
export function resetNeferPhantasmPanelAccounting(d:CalculatorDocument,mode:"fresh-equipment"|"imported-final"):void{
 if(!isNeferPhantasmCastAction(d))return;const c=d.gameContext!.neferPhantasmCast??={};delete c.finalizedHitEvents;c.hitStates??={};
 const reset=(s:NonNullable<NeferPhantasmCastContext["sharedState"]>)=>{if(mode==="fresh-equipment")s.includedFullVeilEm=0;else delete s.includedFullVeilEm;};
 for(const h of d.hits)if((h.kind==="ordinary"||h.kind==="special")&&h.finalSnapshot&&h.finalSnapshot.origin!=="equipment-conversion")c.hitStates[h.id]=stateOf(c,h);
 reset(c.sharedState??={});for(const h of d.hits)if((h.kind==="ordinary"||h.kind==="special")&&(!h.finalSnapshot||h.finalSnapshot.origin==="equipment-conversion")){reset(c.hitStates[h.id]??={});delete h.finalSnapshot;}
}
export function finalizeNeferPhantasmPanelAccounting(d:CalculatorDocument):void{
 if(!isNeferPhantasmCastAction(d))return;const c=d.gameContext!.neferPhantasmCast??={};c.hitStates??={};
 for(const h of d.hits)if((h.kind==="ordinary"||h.kind==="special")&&h.finalSnapshot?.origin==="equipment-conversion"){const{state:s,eligible}=passive(d,c,h);(c.hitStates[h.id]??={}).includedFullVeilEm=eligible&&s.fullVeilEmBuffActive===true?K.fullVeilEm:0;}
 c.finalizedHitEvents=Object.fromEntries(d.hits.filter((h):h is Hit=>h.kind==="ordinary"||h.kind==="special").map(h=>[h.id,identity(d,c,h)]));
}
export function neferPhantasmEventTrace(h:CalculatorHit):CalculationTraceNode[]{if((h.kind!=="ordinary"&&h.kind!=="special")||!h.neferPhantasmEvent)return[];const e=h.neferPhantasmEvent,b=new TraceBuilder(h.sourceRefs);add(b,"frame",expr.input("frame"),{frame:e.frame},"frames",`本次实际${e.templateRole}，目标${e.targetId}`);add(b,"snapshotFrame",expr.input("snapshotFrame"),{snapshotFrame:e.snapshotFrame},"frames",`历史身份${e.snapshotId}`);return b.nodes;}
export function neferPhantasmResourceTrace(d:CalculatorDocument):CalculationTraceNode[]{if(!isNeferPhantasmCastAction(d)||d.scope==="single-hit"||!d.gameContext?.neferPhantasmCast)return[];return compileNeferPhantasmSchedule(d.gameContext.skillId as NeferPhantasmCastKind,d.gameContext.neferPhantasmCast).resourceTrace;}
