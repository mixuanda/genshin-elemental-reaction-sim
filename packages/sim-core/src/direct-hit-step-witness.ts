import type { HitDefinition, SimulationResult } from '@genshin-dps-lab/schemas';
import { replayArtifactBuffs } from '../../schemas/src/artifact-buff-integrity';

/** Internal diagnostic only. No wire identity or import/export contract is assigned. */
export const directHitStepWitnessSink = Symbol('internal-direct-hit-step-witness');
export type DirectHitStepSite =
 | {kind:'hit-resolution'; id:number}
 | {kind:'artifact-buff'; id:number}
 | {kind:'aura-application'; damageEventId:number}
 | {kind:'hitlag'; hitResolutionLogId:number}
 | {kind:'unclassified'};
export interface DirectHitStepEvent {
 frame:number; eventPriority:number; eventSequence:number;
 allocationCount:number; hitResolutionLogId?:number;
 steps:Array<{sequence:number; site:DirectHitStepSite}>;
}
export interface DirectHitStepObservation { events:DirectHitStepEvent[]; result:SimulationResult; }
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
