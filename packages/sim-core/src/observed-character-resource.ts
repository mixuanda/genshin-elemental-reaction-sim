import { observedCharacterResourceContextSchema, type ObservedCharacterResourceContext, type ObservedCharacterResourceEvent } from "./observed-character-resource-context";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode, type FormulaExpression } from "./calculation-trace";
import type { CalculatorDocument, CalculatorHit } from "./calculator-model";
import source from "../../game-data/sources/observed-character-resources/definitions.json";
export const OBSERVED_LOHEN_RESOURCE_SOURCE_REFS: string[] = source.sourceRefs;
export interface ObservedLohenResourceState { stanceActive: boolean; stanceId?: string; expiresAtFrame?: number; joy: number; will: number; etchUses: number; joyGainReadyAtFrame?: number; willGainReadyAtByActor: Record<string,number> }
export interface ObservedLohenConsumption { eventId: string; actionId: string; kind: "etch" | "burst"; frame: number; order: number; willConsumed: number; joyConsumed: number; stanceId?: string }
export interface ObservedLohenResourceResolution {
  state: ObservedLohenResourceState | undefined; consumptions: ObservedLohenConsumption[];
  records: Array<{ eventId: string; frame: number; order: number; kind: string; joyBefore: number; joyAfter: number; willBefore: number; willAfter: number; reason: string }>;
  trace: CalculationTraceNode[]; issues: string[]; complete: boolean;
}
const before = (a: { frame: number; order: number }, b: { frame: number; order: number }) => a.frame < b.frame || a.frame === b.frame && a.order < b.order;
/** A source-backed observed resource reducer. It never schedules attacks or assumes a teammate dealt damage. */
export function resolveObservedCharacterResources(raw: ObservedCharacterResourceContext, options: { throughEventId?: string; requireCompleteStance?: boolean } = {}): ObservedLohenResourceResolution {
  const context = observedCharacterResourceContextSchema.parse(raw), issues: string[] = [], trace = new TraceBuilder(OBSERVED_LOHEN_RESOURCE_SOURCE_REFS);
  const records: ObservedLohenResourceResolution["records"] = [], consumptions: ObservedLohenConsumption[] = [];
  for (const [key,label] of [["initialStateObserved","起点资源状态已经实际观察"],["eventsObservedThroughCutoff","截至本击的所有相关资源事件已经记录"],["observedOrderConfirmed","同帧先后顺序已经明确"],["noHitlag","当前秒数／帧对应没有卡肉延时"]] as const) if (context[key] !== true) issues.push(`请明确${label}。`);
  if (!context.casterId) issues.push("需要资源拥有者洛恩的实际身份。");
  if (context.constellation !== 0) issues.push("本资源协议仅覆盖C0，不能忽略C1容量／获得倍率或C6免消费。");
  if (context.ascension === undefined) issues.push("需要实际突破阶段，决定是否加入A1额外60争胜。");
  if (!context.initial) return { state: undefined,consumptions,records,trace:[],issues:[...issues,"缺少资源账本起点，不能默认欢悦／争胜为零。"],complete:false };
  const initial = context.initial;
  if (!initial.noPendingEtchConfirmed) issues.push("起点不能遗漏已施放而尚未命中的镂骨彻心；本分支需明确没有未决Etch。");
  if (!initial.stanceActive && (initial.joy !== 0 || initial.will !== 0)) issues.push("奇谋结束会清空双资源，非姿态起点不能保留欢悦／争胜。");
  if (initial.stanceActive && (!initial.stanceId || initial.expiresAtFrame === undefined)) issues.push("恢复正在进行的奇谋需要该次状态身份与实际到期帧。");
  if (initial.stanceActive && initial.expiresAtFrame !== undefined && initial.expiresAtFrame < initial.frame) issues.push("初态有效奇谋的实际到期帧不能早于该次初态观察。");
  let state: ObservedLohenResourceState = { stanceActive: initial.stanceActive, joy:initial.joy,will:initial.will,etchUses:initial.etchUses,
    willGainReadyAtByActor:{...initial.willGainReadyAtByActor}, ...(initial.stanceId ? {stanceId:initial.stanceId}:{}),
    ...(initial.expiresAtFrame === undefined ? {} : {expiresAtFrame:initial.expiresAtFrame}),
    ...(initial.joyGainReadyAtFrame === undefined ? {} : {joyGainReadyAtFrame:initial.joyGainReadyAtFrame}) };
  const pending = new Map<string, {stanceId:string}>(), resolved = new Set<string>(), ids = new Set<string>(), slots = new Set<string>(), sourceEvents = new Set<string>();
  const events = [...context.events ?? []].sort((a,b) => a.frame-b.frame || a.order-b.order);
  if (context.events === undefined) issues.push("缺少实际资源事件列表；空数组才表示明确没有事件。");
  const cutoffIndex = options.throughEventId === undefined ? events.length-1 : events.findIndex(event => event.id === options.throughEventId);
  if (options.throughEventId !== undefined && cutoffIndex < 0) issues.push(`缺少本击绑定的消费事件${options.throughEventId}。`);
  const reset = () => { state.stanceActive=false;state.joy=0;state.will=0;delete state.stanceId;delete state.expiresAtFrame;pending.clear(); };
  const calculate = (event: ObservedCharacterResourceEvent, suffix: string, title: string, expression: FormulaExpression, values: Record<string,number>, unit="points") => trace.add(`observed-lohen:${event.id}:${suffix}`,title,expression,Object.entries(values).map(([key,value]) => traceInput(key,value,unit,"observed-resource-event",`${event.id}：实际帧${event.frame}，顺序${event.order}`)),{unit,status:"assumed"});
  const cooldownReady = (event: ObservedCharacterResourceEvent, ready: number | undefined, label:string): boolean => {
    if (ready === undefined && context.cooldownsClearAtStart !== true) { issues.push(`${event.id}缺少${label}的初始实际冷却状态。`);return false; }
    if (ready === undefined || event.frame > ready) return true;
    if (event.frame < ready) return false;
    if (event.cooldownBoundaryReadyConfirmed === undefined) { issues.push(`${event.id}恰在${label}冷却边界，须明确同帧状态先后，不能猜inclusive端点。`);return false; }
    return event.cooldownBoundaryReadyConfirmed;
  };
  for (const event of cutoffIndex < 0 ? [] : events.slice(0,cutoffIndex+1)) {
    const eventIssuesStart = issues.length, slot = `${event.frame}:${event.order}`;
    if (!before(initial,event)) issues.push(`${event.id}不晚于明确起点，不能重复重放初态之前事件。`);
    if (ids.has(event.id) || slots.has(slot)) issues.push(`${event.id}身份或同帧顺序重复。`);
    ids.add(event.id);slots.add(slot);
    if (state.stanceActive && state.expiresAtFrame !== undefined) {
      if (event.frame > state.expiresAtFrame) reset();
      else if (event.frame === state.expiresAtFrame && event.kind !== "exit") {
        if (event.stanceActiveAtBoundaryConfirmed === undefined) issues.push(`${event.id}位于奇谋到期边界，需要本事件发生时状态是否仍有效的实际观察。`);
        else if (!event.stanceActiveAtBoundaryConfirmed) reset();
      }
    }
    const joyBefore=state.joy,willBefore=state.will; let reason="";
    if (event.kind === "enter") {
      if (state.stanceActive) issues.push(`${event.id}不能在未结束的奇谋上假定一次全新进入。`);
      if (!event.actionReadyConfirmed) issues.push(`${event.id}未确认实际可施放元素战技。`);
      if (issues.length === eventIssuesStart) {
        state={...state,stanceActive:true,stanceId:event.stanceId,expiresAtFrame:event.frame+780,joy:0,will:0,etchUses:0};
        reason="进入奇谋，双资源0、13秒来源持续期；获得冷却不擅自重置。";
      }
    } else if (event.kind === "normal-hit") {
      if (event.actorId !== context.casterId) issues.push(`${event.id}的普攻／重击不是洛恩自己。`);
      const key=`hit:${event.hitId}`;
      if(sourceEvents.has(key))issues.push(`${event.id}重复使用同一次自身命中。`);sourceEvents.add(key);
      if (state.stanceActive && state.etchUses < 3 && event.enemyHitConfirmed && issues.length === eventIssuesStart && cooldownReady(event,state.joyGainReadyAtFrame,"欢悦获得")) {
        state.joy=calculate(event,"joy","自身普攻／重击实际命中：欢悦+17并限制100",expr.min(expr.value(100),expr.add(expr.input("before"),expr.value(17))),{before:state.joy});
        state.joyGainReadyAtFrame=event.frame+6;reason="合法命中获得欢悦；6帧共享获得冷却。";
      } else reason="本次没有新增欢悦：非有效姿态、落空、已施放3次Etch或获得冷却未就绪。";
    } else if (event.kind === "party-damage") {
      if (event.actorId === context.casterId) issues.push(`${event.id}不能用洛恩自身伤害获得争胜。`);
      const key=`damage:${event.damageId}`;if(sourceEvents.has(key))issues.push(`${event.id}重复使用同一伤害记录。`);sourceEvents.add(key);
      if (state.stanceActive && event.nearbyPartyMemberConfirmed && issues.length === eventIssuesStart && cooldownReady(event,state.willGainReadyAtByActor[event.actorId],`队员${event.actorId}争胜获得`)) {
        const base=expr.condition("lt",expr.input("damage"),expr.mul(expr.input("baseAttack"),expr.value(10)),expr.value(1),expr.value(20));
        const a1=context.ascension !== undefined && context.ascension >= 1 ? expr.condition("lt",expr.input("damage"),expr.mul(expr.input("baseAttack"),expr.value(30)),expr.value(0),expr.value(60)) : expr.value(0);
        state.will=calculate(event,"will","其他附近队员伤害：白字阈值1／20，加A1额外60，封顶100",expr.min(expr.value(100),expr.add(expr.input("before"),base,a1)),{before:state.will,damage:event.damage,baseAttack:event.lohenBaseAttack});
        state.willGainReadyAtByActor[event.actorId]=event.frame+6;reason="该队员独立6帧冷却；比较实际单次伤害与洛恩当时白字。";
      } else reason="本次没有新增争胜：不在奇谋、不属于附近队员或该队员独立冷却未就绪。";
    } else if (event.kind === "etch-cast") {
      if (!state.stanceActive || !state.stanceId || state.joy !== 100 || state.etchUses >= 3 || !event.actionReadyConfirmed) issues.push(`${event.id}不满足奇谋中欢悦100、已用少于3次且实际动作就绪的Etch施放资格。`);
      if (pending.has(event.actionId) || resolved.has(event.actionId)) issues.push(`${event.id}的Etch动作身份已使用。`);
      if (issues.length === eventIssuesStart) { state.etchUses++;pending.set(event.actionId,{stanceId:state.stanceId!});reason="记录一次实际施放次数；尚未命中，不提前扣欢悦或争胜。"; }
    } else if (event.kind === "etch-resolve") {
      const cast=pending.get(event.actionId);
      if(!cast || !state.stanceActive || cast.stanceId!==state.stanceId)issues.push(`${event.id}缺少同一仍有效奇谋内已合法施放的Etch。`);
      if(issues.length === eventIssuesStart){pending.delete(event.actionId);resolved.add(event.actionId);
        if(event.hitOpponent){consumptions.push({eventId:event.id,actionId:event.actionId,kind:"etch",frame:event.frame,order:event.order,willConsumed:state.will,joyConsumed:state.joy,stanceId:state.stanceId!});
          state.will=calculate(event,"will-consume","Etch命中后消费全部本次争胜",expr.sub(expr.input("before"),expr.input("consumed")),{before:state.will,consumed:state.will});
          state.joy=calculate(event,"joy-consume","Etch命中后消费全部欢悦",expr.sub(expr.input("before"),expr.input("consumed")),{before:state.joy,consumed:state.joy});reason="命中后消费两种资源；第三次施放后仅停止新增欢悦，并不假定退出姿态。";
        }else reason="Etch明确没有命中敌人，不消费资源；该次施放仍占3次上限。";
      }
    } else if(event.kind === "burst-cast") {
      if(!event.actionReadyConfirmed)issues.push(`${event.id}未确认Q真实动作／能量已就绪。`);
      if(resolved.has(event.actionId) || pending.has(event.actionId))issues.push(`${event.id}动作身份已经被使用。`);
      if(issues.length === eventIssuesStart){resolved.add(event.actionId);consumptions.push({eventId:event.id,actionId:event.actionId,kind:"burst",frame:event.frame,order:event.order,willConsumed:state.will,joyConsumed:0,...(state.stanceId?{stanceId:state.stanceId}:{})});
        state.will=calculate(event,"burst-consume","Q施放消费全部争胜，六斩共享该次消耗",expr.sub(expr.input("before"),expr.input("consumed")),{before:state.will,consumed:state.will});
        if(state.stanceActive && state.expiresAtFrame!==undefined)state.expiresAtFrame=calculate(event,"extension","奇谋中Q延长1.65秒（99帧）",expr.add(expr.input("previousExpiry"),expr.value(99)),{previousExpiry:state.expiresAtFrame},"frames");
        reason="Q在本次施放消费争胜，不消费欢悦；不把六次伤害重复扣资源。";
      }
    } else {if(event.reason === "duration" && state.expiresAtFrame!==undefined && event.frame<state.expiresAtFrame)issues.push(`${event.id}早于实际到期帧，不能标为自然到期。`);reset();reason="奇谋结束，欢悦和争胜重置为零；历史已消费证明保留。";}
    records.push({eventId:event.id,frame:event.frame,order:event.order,kind:event.kind,joyBefore,joyAfter:state.joy,willBefore,willAfter:state.will,reason});
  }
  if(options.requireCompleteStance && (state.stanceActive || !records.some(row=>row.kind==="exit")))issues.push("要求完整姿态观察时，必须记录实际退出或到期，不能仅凭最后一击推断结束。");
  return {state,consumptions,records,trace:trace.nodes,issues:[...new Set(issues)],complete:issues.length===0};
}

type ResourceGame = NonNullable<CalculatorDocument["gameContext"]> & {observedCharacterResources?:ObservedCharacterResourceContext};
const getContext=(doc:CalculatorDocument)=>(doc.gameContext as ResourceGame|undefined)?.observedCharacterResources;
const prefix="observed-lohen-resource:";
const boundEvent=(context:ObservedCharacterResourceContext,hitId:string)=>context.hitBindings?.[hitId]??context.consumptionEventId;
const stable=(value:unknown)=>JSON.stringify(value,(_key,item:unknown)=>item&&typeof item==="object"&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const consumptionIdentity=(doc:CalculatorDocument,hit:CalculatorHit,proof:ObservedLohenConsumption)=>stable({proof,talent:doc.gameContext?.effectiveTalentLevel,sourceAction:doc.gameContext?.skillId,snapshot:hit.kind==="ordinary"?hit.finalSnapshot?.source??null:null});
export const isObservedCharacterResourceAction=(doc:CalculatorDocument)=>["lohen-skill-etch-resource","lohen-burst-six-cuts-resource"].includes(doc.gameContext?.skillId??"");
/** Optional ledger mode replaces the old source-sheet UI preset with a computed exact integer. */
export function prepareObservedCharacterResourceDocument(document:CalculatorDocument):CalculatorDocument{
  const raw=getContext(document);if(!raw || !isObservedCharacterResourceAction(document))return document;
  const result=structuredClone(document),game=result.gameContext as ResourceGame,context=observedCharacterResourceContextSchema.parse(raw);
  game.observedCharacterResources=context;result.dependencies=result.dependencies.filter(row=>!row.id.startsWith(prefix));
  for(const hit of result.hits){if(hit.kind!=="ordinary")continue;
    const id=`${prefix}${hit.id}`,eventId=boundEvent(context,hit.id),issues:string[]=[];
    let resolution:ObservedLohenResourceResolution|undefined,proof:ObservedLohenConsumption|undefined;
    if(!eventId)issues.push("此本击未绑定实际资源消费事件；不能继续沿用旧手工争胜档位。");
    else {resolution=resolveObservedCharacterResources(context,{throughEventId:eventId});issues.push(...resolution.issues);proof=resolution.consumptions.find(row=>row.eventId===eventId);if(!proof)issues.push("绑定事件不是一次真实成功的Etch命中或Q消费。");}
    const actualAscension=hit.finalSnapshot?.ascension ?? (result.build.mode==="equipment-derived"?result.build.equipment?.ascension:result.build.ascension) ?? game.ascension;
    if(actualAscension===undefined || actualAscension!==context.ascension)issues.push("伤害文档与资源账本需要同一实际突破阶段，以免漏算或虚增A1争胜。");
    if(game.constellation!==0 || context.constellation!==game.constellation)issues.push("文档和资源账本必须明确同一C0角色分支。");
    if(proof && proof.kind!==(game.skillId==="lohen-skill-etch-resource"?"etch":"burst"))issues.push("本击绑定的消费类型与E／Q动作不一致。");
    if(proof && context.finalizedBindings?.[hit.id]!==undefined && context.finalizedBindings[hit.id]!==consumptionIdentity(result,hit,proof))issues.push("绑定的实际动作或资源消耗已改变，旧转换面板不能静默代表新时点；请重新应用实际构筑。");
    if(proof && !issues.length){
      const old=hit.additiveBaseFormula;
      if(!old || !old.inputs.some(input=>input.key==="lohenWillConsumed"))issues.push("本击缺少已有来源争胜伤害公式，不能绑定到普通普攻或任意外部公式。");
      else {hit.additiveBaseFormula={...old,ruleId:`${prefix}will`,label:"洛恩：真实资源账本得出的本次消耗争胜",inputs:old.inputs.map(input=>input.key!=="lohenWillConsumed"?input:{key:input.key,value:proof!.willConsumed,minimum:0,maximum:100,integer:true,unit:"count",origin:"observed-resource-ledger",meaningKey:`消费事件${proof!.eventId}；可为非20倍数，不由Optimizer UI档位限制`}),sourceRefs:[...new Set([...old.sourceRefs,...OBSERVED_LOHEN_RESOURCE_SOURCE_REFS])]};}
    }
    result.dependencies.push({id,status:issues.length?"missing":"provisional",reason:issues.join("；")||"实际观察资源账本已驱动本击争胜倍率；未自动生成角色动作／团队伤害。",sourceRefs:OBSERVED_LOHEN_RESOURCE_SOURCE_REFS});
    hit.dependencies=[...new Set([...hit.dependencies.filter(dep=>!dep.startsWith(prefix)),id])];
  }
  result.assumptions=[...result.assumptions.filter(row=>!row.startsWith("洛恩观察资源：")),"洛恩观察资源：已记录来源事件自动累计／消费真实争胜与欢悦；角色动作帧、队友伤害与全部面板仍为实际观察，不代表自动团队形态。"];
  return result;
}
export function resetObservedCharacterResourcePanelAccounting(document:CalculatorDocument):void{const context=getContext(document);if(context)delete context.finalizedBindings;}
export function finalizeObservedCharacterResourcePanelAccounting(document:CalculatorDocument):void{
  const context=getContext(document);if(!context || !isObservedCharacterResourceAction(document))return;
  context.finalizedBindings={};
  for(const hit of document.hits){const eventId=boundEvent(context,hit.id);if(!eventId)continue;const result=resolveObservedCharacterResources(context,{throughEventId:eventId}),proof=result.consumptions.find(row=>row.eventId===eventId);if(result.complete&&proof)context.finalizedBindings[hit.id]=consumptionIdentity(document,hit,proof);}
}
export function observedCharacterResourceTrace(document:CalculatorDocument,hit:CalculatorHit):CalculationTraceNode[]{
  const context=getContext(document),eventId=context?boundEvent(context,hit.id):undefined;
  return context&&eventId&&isObservedCharacterResourceAction(document)?resolveObservedCharacterResources(context,{throughEventId:eventId}).trace:[];
}
