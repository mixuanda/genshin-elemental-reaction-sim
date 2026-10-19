import { expr,TraceBuilder,traceInput,type CalculationTraceNode,type FormulaExpression } from "./calculation-trace";
import { getWeaponHitStackRule,weaponHitStackModelSchema,weaponHitStackCapturedStateSchema,WEAPON_HIT_STACK_SOURCE,WEAPON_HIT_STACK_PROFILE_ID,type WeaponHitStackActor,type WeaponHitStackModel,type WeaponHitStackState,type WeaponHitStackCapturedState,type WeaponHitStackEvent,type WeaponHitStackDecision,type WeaponHitStackValues } from "./weapon-hit-stack-model";
export interface WeaponHitStackRuntimeDecision extends WeaponHitStackDecision{trace:CalculationTraceNode[];}
type Row=WeaponHitStackActor&{state:WeaponHitStackState};
const emptyValues=():WeaponHitStackValues=>({atkPct:0,defPct:0,critRate:0,dmgBonus:0});
const unit=(key:string)=>key.includes("Frame")?"frames":key.includes("Stack")||key==="stacks"||key==="refinement"?"count":key==="shielded"||key==="hasExpiry"||key==="windowPresent"?"boolean":"ratio";
function graph(actor:WeaponHitStackActor){const rule=getWeaponHitStackRule(actor.weaponId),b=new TraceBuilder([rule.sourceRef,...WEAPON_HIT_STACK_SOURCE.sourceRefs.slice(-3)]);
 const add=(id:string,e:FormulaExpression,v:Record<string,number>,u="ratio")=>b.add(`weapon.stack.${id}`,`stage.weaponStack.${id}`,e,Object.entries(v).map(([key,value])=>traceInput(key,value,unit(key),"actual-weapon-event",`input.weaponStack.${key}`)),{unit:u,explanationKey:`explain.weaponStack.${id}`,status:"assumed"});
 return{b,add,present:(id:string,expiry:number|null,frame:number)=>add(id,expr.condition("equal",expr.input("hasExpiry"),expr.value(1),expr.condition("lte",expr.input("eventFrame"),expr.input("expiryFrame"),expr.value(1),expr.value(0)),expr.value(0)),{hasExpiry:Number(expiry!==null),eventFrame:frame,expiryFrame:expiry??0},"boolean")===1};
}
function values(actor:WeaponHitStackActor,state:WeaponHitStackState,frame:number,shielded:boolean):{values:WeaponHitStackValues;trace:CalculationTraceNode[]}{
 const rule=getWeaponHitStackRule(actor.weaponId),g=graph(actor),v=emptyValues();
 const active=rule.family==="royal"||state.effectExpiresFrame!==null&&frame<state.effectExpiresFrame;
 const stacks=g.add("effectiveStacks",expr.mul(expr.input("stacks"),expr.input("windowPresent")),{stacks:state.stacks,windowPresent:Number(active)},"count");
 const refine=(base:number,step:number)=>g.add("perStack",expr.add(expr.input("baseCoefficient"),expr.mul(expr.input("refinement"),expr.input("refinementStep"))),{baseCoefficient:base,refinement:actor.refinement,refinementStep:step});
 if(rule.family==="royal")v.critRate=g.add("critRate",expr.mul(expr.input("stacks"),expr.input("perStack")),{stacks,perStack:refine(.06,.02)});
 else if(rule.family==="golden-majesty")v.atkPct=g.add("shieldedAttack",expr.mul(expr.input("stacks"),expr.input("perStack"),expr.add(expr.value(1),expr.input("shielded"))),{stacks,perStack:refine(.03,.01),shielded:Number(shielded)});
 else if(rule.family==="rancour"||rule.family==="whiteblind"){
  const perStack=rule.family==="rancour"?refine(.03,.01):refine(.045,.015);
  v.atkPct=g.add("attackAndDefense",expr.mul(expr.input("stacks"),expr.input("perStack")),{stacks,perStack});v.defPct=v.atkPct;
 }else if(rule.family==="primordial"){
  v.atkPct=g.add("attack",expr.mul(expr.input("stacks"),expr.input("perStack")),{stacks,perStack:refine(.025,.007)});
  v.dmgBonus=g.add("maximumStackDamage",expr.condition("equal",expr.input("stacks"),expr.input("maximumStacks"),expr.add(expr.input("baseCoefficient"),expr.mul(expr.input("refinement"),expr.input("refinementStep"))),expr.value(0)),{stacks,maximumStacks:rule.cap,baseCoefficient:.09,refinement:actor.refinement,refinementStep:.03});
 }else v.dmgBonus=g.add("damage",expr.mul(expr.input("stacks"),expr.input("perStack")),{stacks,perStack:refine(.045,.015)});
 return{values:v,trace:g.b.nodes};
}
/** Independent callback reducer. The simulator must invoke it at the real source callback and actual Stats reads. */
export class WeaponHitStackRuntime{
 private readonly actors:Row[];
 constructor(model:WeaponHitStackModel){const parsed=weaponHitStackModelSchema.parse(model);this.actors=parsed.actors.map(a=>({...a,state:{stacks:0,effectExpiresFrame:null,cooldownExpiresFrame:null}}));}
 handle(event:WeaponHitStackEvent):WeaponHitStackRuntimeDecision[]{
  const rows=event.kind==="stats-sample"?this.actors.filter(a=>a.actorId===event.actorId):this.actors;
  return rows.map(actor=>{
   let valueTrace:CalculationTraceNode[]=[];
   const rule=getWeaponHitStackRule(actor.weaponId),state=actor.state,g=graph(actor),d:WeaponHitStackRuntimeDecision={sourceProfileId:WEAPON_HIT_STACK_PROFILE_ID,sourceRef:rule.sourceRef,actor:{actorId:actor.actorId,weaponId:actor.weaponId,refinement:actor.refinement},event:structuredClone(event),outcome:"stats-read",stateBefore:{...state},stateAfter:{...state},values:null,trace:g.b.nodes};
   if(event.kind==="stats-sample"){
    if(state.effectExpiresFrame!==null&&g.add("expiresOnRead",expr.condition("lte",expr.input("expiryFrame"),expr.input("eventFrame"),expr.value(1),expr.value(0)),{expiryFrame:state.effectExpiresFrame,eventFrame:event.frame},"boolean")===1){state.effectExpiresFrame=null;d.outcome="expired-on-read";}
    const computed=values(actor,state,event.frame,event.shielded);d.values=computed.values;valueTrace=computed.trace;
   }else if(event.sourceActorId!==actor.actorId)d.outcome="wrong-owner";
   else if(rule.nonzeroDamageOnly&&event.damage===0)d.outcome="zero-damage";
   else if(rule.onFieldOnly&&event.activeCharacterId!==actor.actorId)d.outcome="off-field";
   else if(rule.normalChargedOnly&&!(["normal","charged"] as string[]).includes(event.attackTag))d.outcome="ineligible-tag";
   else if(rule.elementalOnly&&event.element==="physical")d.outcome="physical-damage";
   else if(rule.family==="royal"&&event.critical===null)d.outcome="actual-critical-required";
   else if(rule.family==="royal"&&event.critical===true){state.stacks=g.add("criticalReset",expr.value(0),{},"count");d.outcome="critical-reset";}
   else if(g.present("cooldownPresence",state.cooldownExpiresFrame,event.frame))d.outcome="cooldown-blocked";
   else{
    const existing=rule.family==="royal"||g.present("windowPresence",state.effectExpiresFrame,event.frame);
    const stackBase=g.add("stackBase",expr.condition("equal",expr.input("windowPresent"),expr.value(1),expr.input("stacks"),expr.value(0)),{windowPresent:Number(existing),stacks:state.stacks},"count");
    state.stacks=g.add("stacksAfter",expr.min(expr.input("maximumStacks"),expr.add(expr.input("previousStacks"),expr.value(1))),{maximumStacks:rule.cap,previousStacks:stackBase},"count");
    state.cooldownExpiresFrame=g.add("cooldownExpiry",expr.add(expr.input("eventFrame"),expr.input("durationFrames")),{eventFrame:event.frame,durationFrames:rule.cooldownFrames},"frames");
    if(rule.durationFrames!==null)state.effectExpiresFrame=g.add("effectExpiry",expr.add(expr.input("eventFrame"),expr.input("durationFrames")),{eventFrame:event.frame,durationFrames:rule.durationFrames},"frames");
    d.outcome=stackBase>=rule.cap?"cap-refreshed":"stack-gained";
   }
   d.trace=[...g.b.nodes,...valueTrace];d.stateAfter={...state};return d;
  });
 }
 /** Read-only preview. This cannot emulate a real Stats call or its expiry mutation. */
 peekValues(actorId:string,frame:number,shielded:boolean):{values:WeaponHitStackValues;trace:CalculationTraceNode[]}{const actor=this.actors.find(a=>a.actorId===actorId);return actor?values(actor,actor.state,frame,shielded):{values:emptyValues(),trace:[]};}
 captureState():WeaponHitStackCapturedState{return{profileId:WEAPON_HIT_STACK_PROFILE_ID,actors:structuredClone(this.actors)};}
 restoreState(raw:WeaponHitStackCapturedState):void{
  const saved=weaponHitStackCapturedStateSchema.parse(raw);
  if(JSON.stringify(saved.actors.map(({state:_state,...actor})=>actor))!==JSON.stringify(this.actors.map(({state:_state,...actor})=>actor)))throw new Error("武器叠层快照必须属于同一持有者、武器及精炼配置。");
  for(let i=0;i<this.actors.length;i++){const next=saved.actors[i]!,rule=getWeaponHitStackRule(next.weaponId);if(next.state.stacks>rule.cap||rule.family==="royal"&&next.state.effectExpiresFrame!==null)throw new Error("武器叠层快照不符合对应来源上限或永久宗室窗口。");this.actors[i]!.state=structuredClone(next.state);}
 }
}
export const weaponHitStackDecisionTrace=(d:WeaponHitStackRuntimeDecision):CalculationTraceNode[]=>d.trace;

/** Reuses the same source arithmetic for a restored snapshot without mutating lifecycle state. */
export const calculateWeaponHitStackValues=(actor:WeaponHitStackActor,state:WeaponHitStackState,frame:number,shielded:boolean):{values:WeaponHitStackValues;trace:CalculationTraceNode[]}=>values(actor,state,frame,shielded);
