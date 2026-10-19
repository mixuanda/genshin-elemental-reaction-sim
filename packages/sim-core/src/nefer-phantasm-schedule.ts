import { neferPhantasmCastBaseSchema,type NeferPhantasmEvent,type NeferPhantasmScheduleContext } from "./nefer-phantasm-context";
import { neferPhantasmTemplates,neferPhantasmConstants as K } from "../../game-data/src/character-mappings/nefer-phantasm-mappings";
import { expr,TraceBuilder,traceInput,type CalculationTraceNode } from "./calculation-trace";
export const NEFER_PHANTASM_CAST_KINDS=["nefer-phantasm-observed-c0"] as const;
export type NeferPhantasmCastKind=typeof NEFER_PHANTASM_CAST_KINDS[number];
export interface NeferPhantasmCandidate extends Omit<NeferPhantasmEvent,"candidateId">{id:string;contact?:boolean;}
export interface NeferPhantasmSchedule{candidates:NeferPhantasmCandidate[];instances:NeferPhantasmCandidate[];issues:string[];decisions:Array<{frame:number;reason:string}>;lifecycleEndFrame:number;requiredObservedThroughFrame:number;complete:boolean;resourceTrace:CalculationTraceNode[];}
export const neferPhantasmEventIssues=(e:NeferPhantasmEvent,target?:string):string[]=>[...(e.snapshotFrame>e.frame?["取样时刻不能晚于实际命中。"]:[]),...(target&&target!==e.targetId?["实际命中与选定目标不一致。"]:[])];
/** Only the two per-performer chains are source ordered. Their interleaving is an observation. */
export function compileNeferPhantasmSchedule(_kind:NeferPhantasmCastKind,raw:NeferPhantasmScheduleContext):NeferPhantasmSchedule{
 const c=neferPhantasmCastBaseSchema.parse(Object.fromEntries(Object.entries(raw).filter(([key])=>key!=="snapshots"))),t=neferPhantasmTemplates[0]!,issues:string[]=[],rows=c.observations??[],b=new TraceBuilder(t.roles.nefer1.sourceRefs);
 if(!c.casterId||!c.targetId)issues.push("需明确本次施放者与单目标身份。");
 if(c.phantasmOccurred!==true||c.shadowDanceActiveAtAction!==true)issues.push("需确认本次幻戏实际发生且起手处于影舞；不会用普通重击自动代替。");
 if(c.verdantDewBefore===undefined||c.verdantDewBefore<K.minimumVerdantDew)issues.push("本次起手需真实草露至少1枚。");
 if(c.phantasmsUsedBefore===undefined||c.phantasmsUsedBefore>=K.phantasmLimitPerShadowDance)issues.push("需明确本次影舞此前幻戏次数0至2，第三次后不能再生成。");
 const roles=Object.keys(t.roles);if(rows.length!==5||roles.some(role=>rows.filter(e=>e.templateRole===role).length!==1)||new Set(rows.map(e=>e.candidateId)).size!==rows.length)issues.push("完整幻戏必须包含两个本人段与三个影子段，各一条独立事件。");
 for(const chain of t.orderedChains)for(let i=1;i<chain.length;i++){const before=rows.find(e=>e.templateRole===chain[i-1]),after=rows.find(e=>e.templateRole===chain[i]);if(before&&after&&before.frame>after.frame)issues.push("同一攻击者的段序必须符合来源；本人和影子之间不强加未经证实的交错帧序。");}
 const shade=rows.find(e=>e.templateRole==="shade1");if(c.firstShadeSummonFrame===undefined||shade&&c.firstShadeSummonFrame>shade.frame)issues.push("需记录首次召影时刻且不晚于影子第1次命中；草露在召影时消费，不在命中时猜测。");
 const candidates=rows.map(e=>{issues.push(...neferPhantasmEventIssues(e,c.targetId));const{candidateId:id,...rest}=e,contact=c.targetContacts?.[id];if(contact===undefined)issues.push(`需要明确 ${id} 实际命中或落空。`);return{id,...rest,...(contact===undefined?{}:{contact})};});
 const end=Math.max(0,...rows.map(e=>e.frame));if(c.fullObservedLifetime!==true||c.observedThroughFrame===undefined||c.observedThroughFrame<end)issues.push("需确认完整观察这次五段结束；不是完整九秒影舞姿态。");
 if(c.verdantDewBefore!==undefined)b.add("nefer.resource.dewAfter","stage.nefer.dewAfter",expr.sub(expr.input("dewBefore"),expr.input("dewCost")),[traceInput("dewBefore",c.verdantDewBefore,"count","actual-resource","input.nefer.dewBefore"),traceInput("dewCost",K.verdantDewPerFirstShadeSummon,"count","fixed-source","input.nefer.dewCost")],{unit:"count",explanationKey:"explain.nefer.dewAfter"});
 if(c.phantasmsUsedBefore!==undefined)b.add("nefer.resource.usesAfter","stage.nefer.usesAfter",expr.add(expr.input("usesBefore"),expr.value(1)),[traceInput("usesBefore",c.phantasmsUsedBefore,"count","actual-resource","input.nefer.usesBefore")],{unit:"count",explanationKey:"explain.nefer.usesAfter"});
 return{candidates,instances:candidates.filter(e=>e.contact===true),issues,decisions:[{frame:c.firstShadeSummonFrame??0,reason:"首次召影消费1草露；实际帷幕层数和独立8秒精通窗口逐击恢复，不从消费反推。"}],lifecycleEndFrame:end,requiredObservedThroughFrame:end,complete:issues.length===0,resourceTrace:b.nodes};
}
