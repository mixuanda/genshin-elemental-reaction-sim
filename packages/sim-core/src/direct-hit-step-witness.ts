import type { HitDefinition, SimulationResult } from '@genshin-dps-lab/schemas';
import { replayArtifactBuffs } from '../../schemas/src/artifact-buff-integrity';

/** Internal diagnostic only. No wire identity or import/export contract is assigned. */
export const directHitStepWitnessSink = Symbol('internal-direct-hit-step-witness');
export type DirectHitStepSite =
 | {kind:'hit-resolution'; id:number}
 | {kind:'artifact-buff'; id:number}
 | {kind:'aura-application'; damageEventId:number}
 | {kind:'hitlag'; hitResolutionLogId:number}
 | {kind:'propagation-candidate'; reactionDamageLogId:number; targetId:string}
 | {kind:'propagation-application'; reactionDamageLogId:number; targetId:string; damageEventId:number}
 | {kind:'unclassified'};
export interface DirectHitStepEvent {
 frame:number; eventPriority:number; eventSequence:number;
 allocationCount:number; hitResolutionLogId?:number;
 steps:Array<{sequence:number; site:DirectHitStepSite}>;
}
export interface PropagationStepEvent {
 frame:number; eventPriority:number; eventSequence:number;
 reactionDamageLogId:number; sourceActorId:string; sourceTargetId:string;
 triggerDamageEventId:number|null; allocationCount:number;
 operations:Array<
  | {operation:'allocate'; sequence:number; site:DirectHitStepSite}
  | {operation:'observe-hit'; sequence:number; hitResolutionLogId:number; targetId:string}
 >;
}
export interface DirectHitStepObservation { events:DirectHitStepEvent[]; propagationEvents:PropagationStepEvent[]; result:SimulationResult; }
export interface DirectHitStepObserverOptions {
 [directHitStepWitnessSink]?: (observation:DirectHitStepObservation)=>void;
}

/** Deliberately narrow: unknown allocation sites reject, never infer an offset.
 * Other Aura/clock/damage integrity checks remain mandatory at the result boundary.
 * This does not authenticate a hostile rewrite of the entire result and witness.
 */
export function verifyDirectHitStepWitness(observation:DirectHitStepObservation):void {
 const {result,events}=observation;
 function fail(reason:string):never {throw Error(`Direct-hit step witness: ${reason}`);}
 const direct=result.hitResolutionLog.filter(h=>h.resolutionKind==='direct');
 const seen=new Set<number>();
 const byEvent=new Map(events.map(e=>[e.hitResolutionLogId,e]));
 if(byEvent.size!==events.length)fail('duplicate event ownership');
 if(events.length!==direct.length)fail('missing or extra direct event');
 const artifactReplay=replayArtifactBuffs(result);
 if(artifactReplay.issues.length)fail('artifact source replay disagrees: '+artifactReplay.issues[0]!.message);
 for(const [eventIndex,event] of events.entries()){
  if(event.hitResolutionLogId!==direct[eventIndex]!.id)fail('reordered direct-hit execution');
  if(!Number.isSafeInteger(event.allocationCount)||event.allocationCount<1||event.steps.length!==event.allocationCount)fail('missing allocation');
  const owners=direct.filter(h=>h.id===event.hitResolutionLogId&&h.eventSequence===event.eventSequence);
  if(owners.length!==1)fail('event must own exactly one direct hit');
  const hit=owners[0]!;
  if(hit.frame!==event.frame||hit.eventPriority!==event.eventPriority)fail('event frame/priority mismatch');
  const samePoint=(row:{frame:number;eventPriority?:number|null;eventSequence?:number|null;intraEventSequence?:number|null},sequence:number)=>
   row.frame===event.frame&&row.eventPriority===event.eventPriority&&row.eventSequence===event.eventSequence&&row.intraEventSequence===sequence;
  let hitSeen=false,applicationSeen=false,hitlagSeen=false;
  const artifactIds=new Set<number>();
  const sourceActions=hit.sourceAbilityId===undefined
    ? result.config.rotation.filter(a=>a.id===hit.sourceActionId&&a.actorId===hit.sourceActorId)
    : result.config.timeline?.abilities.filter(a=>a.id===hit.sourceAbilityId&&a.actorId===hit.sourceActorId)??[];
  const sourceHits=sourceActions.flatMap<Pick<HitDefinition,'id'|'targetHitlag'>>(a=>a.hits??[]).filter(h=>h.id===hit.hitId);
  if(sourceHits.length!==1)fail('unsupported or ambiguous configured hit source');
  const requiresHitlag=sourceHits[0]!.targetHitlag!==undefined;
  if(result.targetHitlagLog.filter(h=>h.hitResolutionLogId===hit.id).length!==(requiresHitlag?1:0))fail('missing/duplicate configured Hitlag');
  for(const [sequence,step] of event.steps.entries()){
   if(step.sequence!==sequence)fail('missing/reordered/duplicate allocation');
   const site=step.site;
   switch(site.kind){
    case 'hit-resolution':
     if(hitSeen||sequence!==0||site.id!==hit.id||!samePoint(hit,sequence))fail('invalid hit root');
     hitSeen=true;seen.add(hit.id);break;
    case 'artifact-buff': {
     const row=result.artifactBuffLog?.find(r=>r.id===site.id);
     if(!hitSeen||applicationSeen||hitlagSeen||!row||!samePoint(row,sequence)||artifactIds.has(row.id))fail('invalid artifact allocation');
     // For this first scope, accept only actual direct-reaction callbacks, not
     // unrelated stat samples, other hits or callbacks with a fabricated owner.
     if(row.event.kind!=='reaction'||row.parentDamageEventId!==hit.damageEventId||
        row.event.sourceActorId!==hit.sourceActorId||row.event.frame!==hit.frame||
        !row.event.targetIsEnemy||!result.damageEvents.find(d=>d.id===hit.damageEventId)?.reactionAudit.reactions.includes(row.event.reaction as never))fail('artifact callback belongs to another source');
     artifactIds.add(row.id);break;
    }
    case 'aura-application': {
     if(!hitSeen||!hit.landed||applicationSeen||hitlagSeen||site.damageEventId!==hit.damageEventId)fail('invalid application owner/order');
     const points=result.targetStateTimeline.points.filter(p=>p.cause==='direct-hit-application'&&p.primaryDamageEventId===hit.damageEventId);
     if(points.length!==1||!samePoint(points[0]!,sequence)||points[0]!.targetId!==hit.targetId||points[0]!.eventType!=='hit')fail('invalid application reference');
     applicationSeen=true;break;
    }
    case 'hitlag': {
     if(!hitSeen||hitlagSeen||site.hitResolutionLogId!==hit.id||hit.landed&&!applicationSeen)fail('invalid Hitlag owner/order');
     const rows=result.targetHitlagLog.filter(h=>h.hitResolutionLogId===hit.id);
     if(rows.length!==1||!samePoint({...rows[0]!,frame:rows[0]!.globalFrame},sequence)||rows[0]!.targetId!==hit.targetId||rows[0]!.sourceActorId!==hit.sourceActorId)fail('invalid Hitlag reference');
     hitlagSeen=true;break;
    }
    default:fail('unsupported allocation site');
   }
  }
  if(!hitSeen||applicationSeen!==(hit.landed&&result.config.reactionEngine!==undefined))fail('missing required hit/application');
  if(hitlagSeen!==requiresHitlag)fail('missing Hitlag allocation');
  const actualArtifacts=(result.artifactBuffLog??[]).filter(r=>hit.damageEventId!==null&&r.parentDamageEventId===hit.damageEventId&&r.eventSequence===event.eventSequence);
  if(actualArtifacts.length!==artifactIds.size||actualArtifacts.some(r=>!artifactIds.has(r.id)))fail('unwitnessed artifact record');
 }
 if(seen.size!==direct.length)fail('unwitnessed direct hit');
}

/** P5's hit record observes the cursor; it does not allocate it. An observation
 * may therefore share a sequence with the next allocation. Replay operations,
 * never infer a constant offset or require arbitrary monotonic identifiers.
 * This facet supplements, and does not replace, Aura/geometry/damage validation.
 */
export function verifyPropagationStepWitness({result,propagationEvents}:DirectHitStepObservation):void {
 const fail=(reason:string):never=>{throw Error(`Propagation step witness: ${reason}`);};
 const parents=result.reactionDamageLog.filter(r=>r.electroChargedPropagation!==undefined);
 const ids=new Set(propagationEvents.map(e=>e.reactionDamageLogId));
 if(ids.size!==propagationEvents.length||parents.length!==propagationEvents.length)fail('missing/duplicate event');
 const executionOrder=[...new Set(result.hitResolutionLog.filter(h=>parents.some(p=>p.id===h.reactionDamageLogId)).map(h=>h.reactionDamageLogId))];
 if(executionOrder.length!==parents.length||executionOrder.some((id,i)=>id!==propagationEvents[i]?.reactionDamageLogId))fail('reordered propagation execution');
 for(const event of propagationEvents){
  const parent=parents.find(p=>p.id===event.reactionDamageLogId);
  if(!parent)fail('unknown parent');
  const row=parent!;const audit=row.electroChargedPropagation!;
  if(row.reaction!=='electroCharged'||row.targetingMode!=='electro-charged-nearby-wet'||row.sourceActorId!==event.sourceActorId||row.sourceTargetId!==event.sourceTargetId||row.triggerDamageEventId!==event.triggerDamageEventId||row.damageFrame!==event.frame||audit.evaluationFrame!==event.frame||audit.eventPriority!==event.eventPriority||audit.eventSequence!==event.eventSequence)fail('parent source/frame/queue mismatch');
  const same=(r:{frame:number;eventPriority?:number|null;eventSequence?:number|null;intraEventSequence?:number|null},sequence:number)=>r.frame===event.frame&&r.eventPriority===event.eventPriority&&r.eventSequence===event.eventSequence&&r.intraEventSequence===sequence;
  const candidates=audit.candidates;const selected=candidates.filter(c=>c.selected);
  let cursor=0,candidateIndex=0,selectedIndex=0,application=false;
  for(const operation of event.operations){
   if(operation.sequence!==cursor)fail('cursor allocation/observation mismatch');
   if(operation.operation==='allocate'){
    cursor++;
    const site=operation.site;
    if(site.kind==='propagation-candidate'){
     if(selectedIndex||application||candidateIndex>=candidates.length)fail('candidate after delivery');
     const c=candidates[candidateIndex++]!;
     const point=result.targetStateTimeline.points.find(p=>p.id===c.auraObservationTimelinePointId);
     if(site.reactionDamageLogId!==row.id||site.targetId!==c.targetId||!point||!same(point,operation.sequence)||point.targetId!==c.targetId||point.cause!=='electro-charged-propagation-candidate'||point.eventType!=='reactionDamage'||point.primaryDamageEventId!==null||point.links.length!==1||point.links[0]!.kind!=='reaction-damage-log'||point.links[0]!.id!==row.id)fail('candidate ownership/reference mismatch');
    }else if(site.kind==='propagation-application'){
     const c=selected[selectedIndex];
     if(candidateIndex!==candidates.length||application||!c||site.reactionDamageLogId!==row.id||site.targetId!==c.targetId||site.damageEventId!==c.damageEventId)fail('application ownership/order mismatch');
     const points=result.targetStateTimeline.points.filter(p=>p.cause==='reaction-damage-application'&&p.primaryDamageEventId===site.damageEventId);
     if(points.length!==1)fail('missing/duplicate application');
     const p=points[0]!;
     if(!same(p,operation.sequence)||p.targetId!==c!.targetId||p.eventType!=='reactionDamage'||p.links.length!==2||!p.links.some(l=>l.kind==='reaction-damage-log'&&l.id===row.id)||!p.links.some(l=>l.kind==='damage-event'&&l.id===c!.damageEventId))fail('application reference mismatch');
     application=true;
    }else fail('unsupported propagation allocation');
   }else if(operation.operation==='observe-hit'){
    const c=selected[selectedIndex];
    const hit=result.hitResolutionLog.find(h=>h.id===operation.hitResolutionLogId);
    if(candidateIndex!==candidates.length||!c||!hit||hit.id!==c.hitResolutionLogId||hit.reactionDamageLogId!==row.id||hit.sourceActorId!==row.sourceActorId||hit.targetId!==c.targetId||operation.targetId!==c.targetId||hit.damageEventId!==c.damageEventId||!same(hit,operation.sequence)||application!==hit.landed)fail('hit observation ownership/order mismatch');
    selectedIndex++;application=false;
   }else fail('unknown operation');
  }
  if(cursor!==event.allocationCount||candidateIndex!==candidates.length||selectedIndex!==selected.length||application)fail('incomplete operation stream');
  if(row.hitResolutionLogIds.length!==selected.length||selected.some(c=>!row.hitResolutionLogIds.includes(c.hitResolutionLogId!)))fail('unwitnessed hit');
 }
}
