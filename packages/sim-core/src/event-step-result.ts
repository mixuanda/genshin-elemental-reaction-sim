import {z} from 'zod';
import {CURRENT_SCHEMA_VERSION,CURRENT_ENGINE_VERSION,type SimulationResult} from '@genshin-dps-lab/schemas';
import {rejectNonPlainJsonWire} from '../../schemas/src/schema';
import {simulationResultEventStepLeaves,resultValueSchemaWithSteps} from '../../schemas/src/result-schema';
import {verifiedStepPositions,type DirectHitStepObservation} from './direct-hit-step-witness';

const int=z.number().int().nonnegative();
const site=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('hit-resolution'),id:int}).strict(),
 z.object({kind:z.literal('artifact-buff'),id:int}).strict(),
 z.object({kind:z.literal('aura-application'),damageEventId:int}).strict(),
 z.object({kind:z.literal('hitlag'),hitResolutionLogId:int}).strict(),
 z.object({kind:z.literal('propagation-candidate'),reactionDamageLogId:int,targetId:z.string().min(1)}).strict(),
 z.object({kind:z.literal('propagation-application'),reactionDamageLogId:int,targetId:z.string().min(1),damageEventId:int}).strict(),
]);
const event={frame:int,eventPriority:int,eventSequence:int,allocationCount:int};
const evidenceSchema=z.object({
 events:z.array(z.object({...event,hitResolutionLogId:int,steps:z.array(z.object({sequence:int,site}).strict())}).strict()),
 propagationEvents:z.array(z.object({...event,reactionDamageLogId:int,sourceActorId:z.string().min(1),sourceTargetId:z.string().min(1),triggerDamageEventId:int.nullable(),operations:z.array(z.discriminatedUnion('operation',[
  z.object({operation:z.literal('allocate'),sequence:int,site}).strict(),
  z.object({operation:z.literal('observe-hit'),sequence:int,hitResolutionLogId:int,targetId:z.string().min(1)}).strict()
 ]))}).strict())
}).strict();
export const EVENT_STEP_RESULT_FORMAT='gidps-event-step-result-v1';
export interface EventStepResult {
 format:typeof EVENT_STEP_RESULT_FORMAT;
 result:Omit<SimulationResult,'schemaVersion'|'engineVersion'> & {schemaVersion:'1.54.0-event-steps';engineVersion:'1.54.0-event-steps'};
 evidence:Omit<DirectHitStepObservation,'result'>;
}
const wireSchema=z.preprocess(rejectNonPlainJsonWire('EventStepResult'),z.object({format:z.literal(EVENT_STEP_RESULT_FORMAT),result:z.record(z.string(),z.unknown()),evidence:evidenceSchema}).strict());
/** New identity only. Historical 1.53 parsers and their frozen rules are unchanged. */
export function parseEventStepResult(raw:unknown):{wire:EventStepResult;result:SimulationResult} {
 const clean=wireSchema.parse(raw);
 if(clean.result.schemaVersion!=='1.54.0-event-steps'||clean.result.engineVersion!=='1.54.0-event-steps')throw Error('Event-step result identity mismatch');
 // An explicit projection shares leaf definitions, not the historical substep contract.
 const projected={...clean.result,schemaVersion:CURRENT_SCHEMA_VERSION,engineVersion:CURRENT_ENGINE_VERSION};
 const leaves=simulationResultEventStepLeaves.parse(projected) as unknown as SimulationResult;
 const positions=verifiedStepPositions({...clean.evidence,result:leaves} as DirectHitStepObservation);
 const result=resultValueSchemaWithSteps(positions).parse(projected) as unknown as SimulationResult;
 return {wire:clean as unknown as EventStepResult,result};
}
export function createEventStepResult(observation:DirectHitStepObservation):EventStepResult {
 const wire:EventStepResult={format:EVENT_STEP_RESULT_FORMAT,result:{...observation.result,schemaVersion:'1.54.0-event-steps',engineVersion:'1.54.0-event-steps'},evidence:{events:observation.events,propagationEvents:observation.propagationEvents}};
 return parseEventStepResult(wire).wire;
}

import {simulate,type SimulationRuntimeOptions} from './simulator';
import {directHitStepWitnessSink,eventStepProtocol} from './direct-hit-step-witness';
/** Bounded public path: unknown allocation sites fail instead of manufacturing evidence. */
export function simulateEventStepResult(config:unknown,options:SimulationRuntimeOptions={}):{result:SimulationResult;wire:EventStepResult} {
 let observation:DirectHitStepObservation|undefined;
 const result=simulate(config,{...options,[eventStepProtocol]:true,[directHitStepWitnessSink]:value=>{observation=value;}});
 if(!observation)throw Error('Missing event-step capture');
 const wire=createEventStepResult({...observation,result});
 return {result,wire};
}

import {applyExecutionProfile,type ExecutionProfile} from './execution-profiles';
import type {SimConfig} from '@genshin-dps-lab/schemas';
/** Explicit new-protocol baseline; frozen/default profile interpretation stays intact. */
export function applyEventStepExecutionProfile(config:SimConfig,profile:ExecutionProfile,options:SimulationRuntimeOptions={}) {
 return applyExecutionProfile(config,profile,{...options,[eventStepProtocol]:true});
}
