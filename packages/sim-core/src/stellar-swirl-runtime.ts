import type { AuraStateEntry, CharacterStats, CritMode, ResolvedEnemyTargetProfile, SimConfig, SimulationResult } from "@genshin-dps-lab/schemas";
import { CALCULATOR_RULE_VERSION,CALCULATOR_SCHEMA_VERSION,calculatorDocumentSchema,type CalculatorDocument } from "./calculator-model";
import { calculateSpecialCalculatorHit } from "./special-calculator";
import { createSpecialReactionState,resolveSpecialConversion,SPECIAL_STATE_PROFILE_ID,transitionSpecialState,type SpecialAuraSnapshot,type SpecialDamageIntent,type SpecialPartyMember,type SpecialStateLog,type SpecialStateTransition } from "./special-reaction-state";
import { calculateStellarSwirlIntent,type StellarSwirlContributorSnapshot } from "./stellar-swirl-calculation";
import { STELLAR_ARTIFACT_SOURCE, type StellarArtifactCapturedState, type StellarArtifactLogEntry, type StellarArtifactReactionRead, type StellarArtifactRuntime } from "./stellar-artifact-runtime";

export interface StellarSwirlRuntimeOptions {profileId:"stellar-swirl-guide-reference-v1";party:SpecialPartyMember[]}
export interface StellarSwirlCryoDeliveryReceipt {
  frame:number;ownerId:string;targetId:string;applied:true;element:"cryo";gaugeUnits:1;
  auraBefore:AuraStateEntry[];auraAfter:AuraStateEntry[];
}
export interface StellarSwirlQueueTask { kind: "state-wake" | "delivery"; frame: number; intentId?: number; }
export interface StellarSwirlExecutionOrder { frame: number; priority: number; sequence: number; }
export interface StellarSwirlActionExecution { frame:number; actorId:string; sourceEventId:string; timelineCommandIndex?:number; executionOrder?:StellarSwirlExecutionOrder; }
export interface StellarSwirlDamageEvent {
  id:number;frame:number;timeSeconds:number;ownerId:string;targetId:string;intent:SpecialDamageIntent;
  context:ReturnType<typeof calculateStellarSwirlIntent>["context"];trace:ReturnType<typeof calculateStellarSwirlIntent>["trace"];damage:number;
  auraBefore:AuraStateEntry[];auraAfter:AuraStateEntry[];cryoDelivery:StellarSwirlCryoDeliveryReceipt|null;
  executionOrder?: StellarSwirlExecutionOrder;
}
export interface StellarSwirlSimulationResult {
  schemaVersion:"stellar-swirl-simulation-v1";
  profile:{id:StellarSwirlRuntimeOptions["profileId"];stateProfileId:typeof SPECIAL_STATE_PROFILE_ID;evidence:"guide-profile-source-conflict";assumptions:string[]};
  baseResult:SimulationResult;specialDamageEvents:StellarSwirlDamageEvent[];executionLog:SpecialStateLog[];
  highJump:{available:boolean;expiresAt:number|null;consumptionImplemented:true;airborne:{actorId:string;startedAt:number;sourceEventId:string}|null};
  totalDamage:number;totalDps:number;classicDamage:number;stellarSwirlDamage:number;
  stellarArtifactLog?: StellarArtifactLogEntry[];
  stellarArtifactReactionReads?: StellarArtifactReactionRead[];
  stellarArtifactState?: StellarArtifactCapturedState;
}

export function stellarSwirlAuraOwners(aura:readonly AuraStateEntry[]):SpecialAuraSnapshot {
  const cryo=aura.filter(entry=>entry.element==="cryo"&&entry.gaugeUnits>0);
  return {frozen:aura.some(entry=>entry.element==="frozen"&&entry.gaugeUnits>0),...(cryo.some(entry=>entry.sourceSlots===undefined)?{}:{cryo:[...new Set(cryo.flatMap(entry=>entry.sourceSlots!.filter(slot=>slot.gaugeUnits>0).map(slot=>slot.sourceActorId)))]})};
}
export function validateStellarSwirlProfile(config:SimConfig,options:StellarSwirlRuntimeOptions):void {
  if(options.party.length!==config.characters.length||options.party.some(member=>!config.characters.some(actor=>actor.id===member.actorId))||new Set(options.party.map(member=>member.actorId)).size!==options.party.length)throw new Error("星扩散party必须与模拟角色一一对应。");
  if(resolveSpecialConversion(options.party,"swirlCryo").normalFallback)throw new Error("星扩散需要已映射的转换角色资格。");
  if(config.reactionEngine?.mode!=="aura-v3")throw new Error("星扩散参考配置需要aura-v3个人附着所有权。");
  if(config.reactionEngine.initialAura?.length||config.enemy.targets?.some(target=>target.initialAura?.length))throw new Error("星扩散初始附着必须由真实角色命中建立；不能猜测无归属或冻结贡献者。");
  if((config.enemy.targets?.length??1)!==1||config.enemy.targetMotions?.length||config.enemy.targetPhases?.length)throw new Error("星扩散参考配置仅支持单个静止、范围内目标。");
  if(config.timeline?.mode!=="legal-frame-v1"||config.timeline.fps!==60||config.targetClockModel.mode!=="disabled"||config.targetTaskModel.mode!=="legacy-event-heap-v1"||config.playerDamageModel.mode!=="disabled")throw new Error("星扩散参考配置限legal-frame-v1、60 FPS无卡肉、legacy-event-heap-v1，不接玩家伤害反馈。");
  for(const action of config.timeline?.abilities??config.rotation)for(const hit of action.hits??[]){
    const actor=config.characters.find(entry=>entry.id===action.actorId)!;
    if(!["anemo","cryo","physical"].includes(hit.element??actor.element))throw new Error("星扩散参考配置只接受风、冰、物理；冻结及混合反应尚未支持。");
    if((hit.reaction&&hit.reaction!=="none")||(hit.reactionOverride&&hit.reactionOverride!=="none"))throw new Error("星扩散实际转换不接受手工反应覆写。");
  }
}

/** Host owns ordinary reaction replacement and Cryo delivery. No Aura mutation is fabricated here. */
export class StellarSwirlRuntime {
  readonly damageEvents:StellarSwirlDamageEvent[]=[];
  readonly log:SpecialStateLog[]=[];
  private state=createSpecialReactionState();
  private nextWakeFrame:number|undefined;
  private readonly queuedWakeFrames = new Set<number>();
  private pending:Array<{intent:SpecialDamageIntent;snapshots:StellarSwirlContributorSnapshot[]}>=[];
  private readonly context;
  constructor(private readonly inputs:{
    config:SimConfig;options:StellarSwirlRuntimeOptions;target:ResolvedEnemyTargetProfile;critMode:CritMode;
    snapshot:(actorId:string,frame:number)=>CharacterStats;
    resistance:(element:"anemo"|"cryo",frame:number)=>number;
    auraAt:(frame:number)=>AuraStateEntry[];
    beforeWake:(frame:number)=>void;
    applyCryo:(intent:SpecialDamageIntent)=>StellarSwirlCryoDeliveryReceipt;
    artifactRuntime?:StellarArtifactRuntime;
    /** Actual main-heap integration. Omit only for the isolated adapter harness. */
    scheduleTask?:(task:StellarSwirlQueueTask)=>void;
  }){
    // The public host validates the original legal timeline before compilation.
    if (inputs.scheduleTask === undefined) validateStellarSwirlProfile(inputs.config,inputs.options);
    this.context={party:inputs.options.party,profileId:SPECIAL_STATE_PROFILE_ID,spatialProfile:"single-stationary-target-in-range" as const,targetId:inputs.target.id,auraAt:(frame:number)=>stellarSwirlAuraOwners(inputs.auraAt(frame))};
  }
  get highJump():StellarSwirlSimulationResult["highJump"] {return {available:this.state.highJump?.available===true,expiresAt:this.state.highJump?.expiresAt??null,consumptionImplemented:true,airborne:structuredClone(this.state.stellarAirborne??null)};}
  /** Called only when the host actually starts an accepted jump action. */
  jump(event:StellarSwirlActionExecution):boolean {
    return this.executeAirborneAction("consume-high-jump", event);
  }
  /** Plunge lands immediately at action execution; its declared hit still uses the ordinary queue. */
  plunge(event:StellarSwirlActionExecution):boolean {
    if (this.state.stellarAirborne === undefined) return false;
    return this.executeAirborneAction("land-stellar-swirl", event);
  }
  private executeAirborneAction(kind:"consume-high-jump"|"land-stellar-swirl",event:StellarSwirlActionExecution):boolean {
    if (this.inputs.scheduleTask === undefined) this.advanceThrough(event.frame);
    const transition=transitionSpecialState(this.state,{kind,frame:event.frame,actorId:event.actorId,sourceEventId:event.sourceEventId,...(this.inputs.scheduleTask===undefined?{}:{scheduler:"host-main-heap" as const})},this.context);
    const actionLog=transition.log.find(entry=>entry.type===(kind==="consume-high-jump"?"high-jump-use":"high-jump-land"))!;
    if(event.executionOrder) Object.assign(actionLog.details,{eventPriority:event.executionOrder.priority,eventSequence:event.executionOrder.sequence});
    if(event.timelineCommandIndex!==undefined) actionLog.details.timelineCommandIndex=event.timelineCommandIndex;
    this.accept(transition);
    return actionLog.details.allowed===true;
  }
  private accept(transition:SpecialStateTransition):void {
    if(transition.blockedMechanics.length)throw new Error(transition.blockedMechanics.map(entry=>`${entry.field}: ${entry.reason}`).join("; "));
    this.state=transition.state;this.nextWakeFrame=transition.nextWakeFrame;
    for (const entry of transition.log) this.log.push({ ...entry, id: this.log.length });
    for(const intent of transition.damageIntents){
      if(!["stellar-swirl-anemo-reaction","stellar-swirl-vortex-1","stellar-swirl-vortex-2"].includes(intent.branch))throw new Error("Unexpected non-Stellar-Swirl state intent");
      const snapshots=intent.contributorIds.map(actorId=>{
        const actor=this.inputs.config.characters.find(entry=>entry.id===actorId)!;
        const stats=this.inputs.snapshot(actorId,intent.snapshotFrame);
        const artifact=this.inputs.artifactRuntime?.reactionBonus(actorId,intent.snapshotFrame,"reaction-stellar-swirl",intent.branch);
        return {actorId,level:actor.level,elementalMastery:stats.em,critRate:stats.critRate,critDamage:stats.critDmg,
          ...(artifact===undefined?{}:{reactionBonus:artifact.value,modifierSourceRefs:artifact.sourceRefs,stellarArtifactBonus:artifact.snapshot})};
      });
      this.pending.push({intent,snapshots});
      this.inputs.scheduleTask?.({ kind: "delivery", frame: intent.deliveryFrame, intentId: intent.id });
    }
    if (this.inputs.scheduleTask && this.nextWakeFrame !== undefined && !this.queuedWakeFrames.has(this.nextWakeFrame)) {
      this.queuedWakeFrames.add(this.nextWakeFrame);
      this.inputs.scheduleTask({ kind: "state-wake", frame: this.nextWakeFrame });
    }
  }
  private deliver({ intent, snapshots }: { intent: SpecialDamageIntent; snapshots: StellarSwirlContributorSnapshot[] }, executionOrder?: StellarSwirlExecutionOrder): void {
        const before=this.inputs.auraAt(intent.deliveryFrame);
        if(stellarSwirlAuraOwners(before).frozen)throw new Error("冻结贡献者与普通冰重叠的来源冲突尚未解决。");
        const resistance=this.inputs.resistance(intent.element as "anemo"|"cryo",intent.deliveryFrame);
        let cryoDelivery:StellarSwirlCryoDeliveryReceipt|null=null;
        if(intent.element==="cryo"){
          if(intent.onDelivery.length!==1||intent.onDelivery[0]?.kind!=="apply-element"||intent.onDelivery[0].element!=="cryo"||intent.onDelivery[0].gaugeUnits!==1)throw new Error("星漩涡需要明确的1U冰投递操作。");
          cryoDelivery=this.inputs.applyCryo(intent);
          if(cryoDelivery.applied!==true||cryoDelivery.element!=="cryo"||cryoDelivery.gaugeUnits!==1||cryoDelivery.frame!==intent.deliveryFrame||cryoDelivery.ownerId!==intent.ownerId||cryoDelivery.targetId!==intent.targetId)throw new Error("星漩涡缺少宿主实际执行、归属一致的1U冰投递回执。");
        }else if(intent.onDelivery.length)throw new Error("星扩散初始风伤不附着元素。");
        const calculation=calculateStellarSwirlIntent(intent,snapshots,resistance,this.inputs.critMode,{ordinaryReactionReplacementApplied:true,deliveryOperationsApplied:true});
        this.damageEvents.push({id:this.damageEvents.length,frame:intent.deliveryFrame,timeSeconds:intent.deliveryFrame/60,ownerId:intent.ownerId,targetId:intent.targetId,intent,...calculation,auraBefore:structuredClone(cryoDelivery?.auraBefore??before),auraAfter:structuredClone(cryoDelivery?.auraAfter??before),cryoDelivery:structuredClone(cryoDelivery), ...(executionOrder === undefined ? {} : { executionOrder })});
        this.inputs.artifactRuntime?.onStellarDamage(intent.deliveryFrame,intent.ownerId,"reaction-stellar-swirl");
  }
  /** Runs only the selected heap task; same-frame siblings retain their queue sequence. */
  runScheduledTask(task: StellarSwirlQueueTask, executionOrder: StellarSwirlExecutionOrder): void {
    if (!this.inputs.scheduleTask) throw new Error("Stellar-Swirl main-heap scheduling is not enabled");
    this.inputs.beforeWake(task.frame);
    if (task.kind === "state-wake") {
      if (task.frame < this.state.frame || task.frame !== this.nextWakeFrame) return;
      this.accept(transitionSpecialState(this.state, { kind: "advance", frame: task.frame }, this.context));
    } else {
      const index = this.pending.findIndex(pending => pending.intent.id === task.intentId);
      if (index < 0) throw new Error("Stellar-Swirl delivery has no pending captured intent");
      const pending = this.pending.splice(index, 1)[0]!;
      this.deliver(pending, executionOrder);
    }
  }
  advanceThrough(frame:number):void {
    if(!Number.isSafeInteger(frame)||frame<this.state.frame)throw new Error("星扩散执行帧必须单调递增。");
    while(true){
      const due=Math.min(this.nextWakeFrame??Infinity,...this.pending.map(task=>task.intent.deliveryFrame));
      if(due>frame)break;
      this.inputs.beforeWake(due);
      if(this.nextWakeFrame===due)this.accept(transitionSpecialState(this.state,{kind:"advance",frame:due},this.context));
      const deliveries=this.pending.filter(task=>task.intent.deliveryFrame===due);
      this.pending=this.pending.filter(task=>task.intent.deliveryFrame!==due);
      for(const task of deliveries) this.deliver(task);
    }
    this.accept(transitionSpecialState(this.state,{kind:"advance",frame},this.context));
  }
  application(event:{frame:number;sourceActorId:string;sourceEventId:string;attackId:string;targetId:string;element:"anemo"|"cryo";gaugeUnits:number;actualIcdAllowed:boolean;auraBefore:AuraStateEntry[];converted:boolean;ordinaryReactionReplacementApplied:boolean}):void {
    if (this.inputs.scheduleTask === undefined) this.advanceThrough(event.frame);
    if(!event.actualIcdAllowed||!event.converted)return;
    if(!event.ordinaryReactionReplacementApplied)throw new Error("普通冰扩散尚未由主Aura引擎替换，不能发布星扩散状态。");
    if(stellarSwirlAuraOwners(event.auraBefore).frozen)throw new Error("冻结贡献者来源冲突尚未解决。");
    this.inputs.artifactRuntime?.onReaction(event.frame,event.sourceActorId,"stellar-swirl");
    this.accept(transitionSpecialState(this.state,{...event,kind:"application",resolutionOrigin:"aura-engine",ordinaryReaction:"swirlCryo",auraBefore:stellarSwirlAuraOwners(event.auraBefore)},this.context));
    // Main integration enqueues zero-delay delivery after the current trigger audit.
    if (this.inputs.scheduleTask === undefined) this.advanceThrough(event.frame);
  }
  result(baseResult:SimulationResult):StellarSwirlSimulationResult {
    const stellarSwirlDamage=this.damageEvents.reduce((sum,event)=>sum+event.damage,0),totalDamage=baseResult.totalDamage+stellarSwirlDamage;
    return {schemaVersion:"stellar-swirl-simulation-v1",baseResult,specialDamageEvents:this.damageEvents,executionLog:this.log,highJump:this.highJump,totalDamage,totalDps:totalDamage/baseResult.config.duration,classicDamage:baseResult.totalDamage,stellarSwirlDamage,
      ...(this.inputs.artifactRuntime===undefined?{}:{stellarArtifactLog:this.inputs.artifactRuntime.log,stellarArtifactReactionReads:this.inputs.artifactRuntime.reactionReads,stellarArtifactState:this.inputs.artifactRuntime.stateAt(Math.ceil(baseResult.config.duration*60))}),
      profile:{id:"stellar-swirl-guide-reference-v1",stateProfileId:SPECIAL_STATE_PROFILE_ID,evidence:"guide-profile-source-conflict",assumptions:["单个静止范围内目标，60 FPS、无卡肉，只含风/冰/物理输入。","主引擎完成普通冰扩散替换；初始风伤不附着，漩涡冰伤实际投递1U冰并保留最后触发者归属。","初始人物快照与+3帧送达分开；爆炸时取人物快照并同帧送达，敌方抗性均在送达读取。","三次升级、六次引爆及180帧寿命按指南参考配置；固定源码存在计数、实体类型和181帧差异，未验证官服一致性。",this.inputs.artifactRuntime===undefined?"专属基础提升、特殊增伤、加算、擢升和额外攻击明确关闭；无特殊贡献者种子暴击或反馈。":"仅执行已声明固定a7星辉圣遗物的暴击率、攻击百分比及特殊反应加成；其余专属基础提升、特殊增伤、加算、擢升和额外攻击仍关闭；无特殊贡献者种子暴击反馈。","爆炸后300帧资格在实际jump开始时消费并授予腾空；仅已声明plunge可落地，普通下落伤害沿经典命中计算。动作占用仍使用显式frames，不推导高低下落高度；跳跃途中被爆炸抬升的源码TODO分支未支持。",...(this.inputs.artifactRuntime===undefined?[]:[`显式选择固定a7星辉圣遗物与指南星扩散混合参考配置；圣遗物回调来自 ${STELLAR_ARTIFACT_SOURCE.scarlet} 和 ${STELLAR_ARTIFACT_SOURCE.heart}，星扩散宿主的guide-profile-source-conflict仍未解除。`])]}};
  }
}

export function stellarSwirlEventToCalculatorDocument(result:StellarSwirlSimulationResult,eventId:number):CalculatorDocument {
  const event=result.specialDamageEvents.find(candidate=>candidate.id===eventId);if(!event)throw new Error(`Unknown Stellar Swirl event ${eventId}`);
  const replay=calculateSpecialCalculatorHit(event.context),mode=result.baseResult.resolvedRuntimeOptions.critMode;
  const damage=mode==="average"?replay.expected:mode==="allCrit"?replay.critical:replay.nonCritical;
  if(damage===undefined||!Number.isFinite(event.damage)||!Number.isFinite(damage)||Math.abs(damage-event.damage)>1e-10*Math.max(1,Math.abs(event.damage)))throw new Error("Stellar Swirl captured context does not reproduce its event");
  const first=event.context.contributors[0]!;
  return calculatorDocumentSchema.parse({schemaVersion:CALCULATOR_SCHEMA_VERSION,ruleVersion:CALCULATOR_RULE_VERSION,id:`stellar-swirl-event-${event.id}`,label:`星扩散 #${event.id} · 第 ${event.frame} 帧`,scope:"single-hit",characterLevel:first.base.kind==="level-base"?first.base.characterLevel:90,
    build:{mode:"imported-final",source:"星扩散使用完整贡献者快照；此面板不进入特殊公式。",stats:{atk:0,hp:0,def:0,em:first.elementalMastery,critRate:first.critRate,critDamage:first.critDamage}},enemy:{level:result.baseResult.enemyTargets[0]!.level,resistance:event.context.effectiveResistance,defenseAdjustment:0,defenseIgnore:0},
    hits:[{kind:"special",id:"captured-special",label:"参考状态驱动星扩散",context:event.context,sourceRefs:event.intent.sourceRefs,dependencies:["stellar-swirl-guide-reference"]}],selectedHitIds:["captured-special"],assumptions:[...result.profile.assumptions,`原始事件 ${event.damage}；模式 ${mode}。`],dependencies:[{id:"stellar-swirl-guide-reference",status:"provisional",reason:"指南与固定源码存在冲突；完整上下文复现不是官服机制验证。",sourceRefs:event.intent.sourceRefs}],dataIdentity:{datasetId:result.baseResult.reproducibilityKey,gameVersion:"7.0 guide reference",releaseStatus:"unknown",evidenceStatus:"provisional"}});
}
