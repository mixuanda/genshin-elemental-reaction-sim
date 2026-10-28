import beforeWitness from './fixtures/direct-hit-witness-before.json';
import type {
  EnemyTargetProfile,
  FrameHitDefinition,
  SimConfig
} from "@genshin-dps-lab/schemas";
import { beforeAll, describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const SOURCE_ID = "enemy-0";

function electroApplication(_id: string) {
  return {
    gaugeUnits: 1,
    icd: { mode: "no-icd-v1" as const }
  };
}

function makePropagationConfig({
  targets,
  hits,
  radius = 3,
  durationFrames = 30,
  actorId = "ec-owner"
}: {
  targets: EnemyTargetProfile[];
  hits?: FrameHitDefinition[];
  radius?: number;
  durationFrames?: number;
  actorId?: string;
}): SimConfig {
  const base = makeConfig();
  const template = base.characters[0]!;
  const resolvedDurationFrames = Math.max(
    60,
    durationFrames
  );
  return makeConfig({
    duration: resolvedDurationFrames / 60,
    cycleLength: resolvedDurationFrames / 60,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets
    },
    characters: [
      {
        ...template,
        id: actorId,
        name: "EC Owner",
        element: "electro",
        level: 90,
        stats: {
          ...neutralStats,
          em: 120,
          reactionBonus: 0.2
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v8" },
    targetTaskModel: { mode: "target-phase-v2" },
    electroChargedPropagationModel: {
      mode: "nearby-wet-radius-v1",
      radius,
      verificationStatus: "provisional"
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: actorId,
      swapFrames: 1,
      abilities: [
        {
          id: "start-ec",
          actorId,
          name: "Start EC",
          kind: "skill",
          cancelFrame: 11,
          animationEndFrame: 11,
          cooldownFrames: 0,
          hits:
            hits ??
            [
              {
                id: "start-ec-hit",
                label: "Start EC",
                frame: 0,
                scaling: 1,
                element: "electro",
                geometry: {
                  kind: "circle",
                  coordinateSpace: "world",
                  origin: { x: 0, y: 0 },
                  radius: 0.01
                },
                application: electroApplication(
                  "start-ec-hit"
                )
              }
            ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId,
          abilityId: "start-ec"
        }
      ]
    }
  });
}


import { ARTIFACT_BUFF_SOURCE } from '@genshin-dps-lab/reaction-formulas';
import { directHitStepWitnessSink, verifyDirectHitStepWitness, verifyPropagationStepWitness, type DirectHitStepObservation } from '../direct-hit-step-witness';
const observations:DirectHitStepObservation[]=[];
beforeAll(()=>{
 for(const [artifact,hitlag] of [[false,false],[true,false],[false,true],[true,true]]){
  const config=makePropagationConfig({targets:[{id:SOURCE_ID,name:'Source',position:{x:0,y:0},resistance:.1,initialAura:[{element:'hydro',gaugeUnits:1}]},{id:'wet',name:'Wet',position:{x:1,y:0},resistance:.1,initialAura:[{element:'hydro',gaugeUnits:1}]}]});
  if(artifact)config.artifactBuffModel={mode:ARTIFACT_BUFF_SOURCE.mode,actors:[{actorId:'ec-owner',effectId:'instructor-4pc'}]};
  if(hitlag){config.targetClockModel={mode:'target-local-hitlag-v1'};config.timeline!.abilities[0]!.hits![0]!.targetHitlag={haltFrames:5,factor:.25};}
  expect(()=>simulate(config,{critMode:'noCrit',[directHitStepWitnessSink]:o=>observations.push(o)})).toThrow('Trusted reaction-delivery');
 }
 expect(observations).toHaveLength(4);
});
it.each([0,1,2,3])('captures and validates actual allocation sites for diagnostic scenario %i',i=>{
 verifyDirectHitStepWitness(observations[i]!);
 expect(observations[i]!.result.damageEvents.map(d=>Object.fromEntries(beforeWitness.fields.map(key=>[key,(d as unknown as Record<string,unknown>)[key]])))).toEqual(beforeWitness.cases[i]);
 const e=observations[i]!.events[0]!;
 expect(e.steps.map(s=>s.site.kind)).toEqual(['hit-resolution',...(i%2?['artifact-buff']:[]),'aura-application',...(i>=2?['hitlag']:[])]);
 // The existing public gate is still failing; this is not a successful EC run.
 expect(Object.keys(observations[i]!.result)).not.toContain('directHitStepEvents');
});
it.each([
 ['reordered hit executions',(o:DirectHitStepObservation)=>{o.events.reverse();}],
 ['missing allocation',(o:DirectHitStepObservation)=>{o.events[0]!.steps.splice(1,1);}],
 ['reordered allocations',(o:DirectHitStepObservation)=>{o.events[0]!.steps.reverse();}],
 ['coherent callback/application reorder',(o:DirectHitStepObservation)=>{
   const e=o.events[0]!;[e.steps[1],e.steps[2]]=[e.steps[2]!,e.steps[1]!];e.steps.forEach((s,i)=>s.sequence=i);
   o.result.artifactBuffLog![0]!.intraEventSequence=2;
   o.result.targetStateTimeline.points.find(p=>p.cause==='direct-hit-application')!.intraEventSequence=1;
 }],
 ['unknown allocation site',(o:DirectHitStepObservation)=>{o.events[0]!.steps[1]!.site={kind:'unclassified'};}],
 ['wrong queue owner',(o:DirectHitStepObservation)=>{o.events[0]!.eventSequence+=100;}],
 ['wrong frame',(o:DirectHitStepObservation)=>{o.events[0]!.frame++;}],
 ['wrong priority',(o:DirectHitStepObservation)=>{o.events[0]!.eventPriority++;}],
 ['cross-hit root',(o:DirectHitStepObservation)=>{o.events[0]!.steps[0]!.site={kind:'hit-resolution',id:o.result.hitResolutionLog[1]!.id};}],
 ['missing artifact row',(o:DirectHitStepObservation)=>{o.result.artifactBuffLog=[];}],
 ['wrong artifact parent',(o:DirectHitStepObservation)=>{o.result.artifactBuffLog![0]!.parentDamageEventId=1;}],
 ['wrong artifact actor',(o:DirectHitStepObservation)=>{const e=o.result.artifactBuffLog![0]!.event;if(e.kind==='reaction')e.sourceActorId='other';}],
 ['missing configured Hitlag',(o:DirectHitStepObservation)=>{o.result.targetHitlagLog=[];}],
 ['cross-hit Hitlag',(o:DirectHitStepObservation)=>{o.result.targetHitlagLog[0]!.hitResolutionLogId=o.result.hitResolutionLog[1]!.id;}],
 ['renumbered artifact omission',(o:DirectHitStepObservation)=>{const e=o.events[0]!;e.steps.splice(1,1);e.allocationCount--;e.steps.forEach((s,i)=>s.sequence=i);}],
] as const)('rejects %s',(_,mutate)=>{const o=structuredClone(observations[3]!);mutate(o);expect(()=>verifyDirectHitStepWitness(o)).toThrow('Direct-hit step witness');});

it('keeps diagnostic observers detached from production numbers and JSON',()=>{
 const config=makeConfig();
 const baseline=simulate(config,{critMode:'noCrit'});
 let called=false;
 const observed=simulate(config,{critMode:'noCrit',[directHitStepWitnessSink]:o=>{
  called=true;o.events.length=0;o.result.damageEvents.length=0;
 }});
 expect(called).toBe(true);expect(observed).toEqual(baseline);
 expect(JSON.stringify(observed)).toBe(JSON.stringify(baseline));
});

it.each([0,1,2,3])('validates actual P5 candidate, application and non-allocating hit operations %i',i=>{
 const o=observations[i]!;
 expect(o.propagationEvents.length).toBeGreaterThan(0);
 verifyPropagationStepWitness(o);
 const operations=o.propagationEvents[0]!.operations;
 expect(operations.some((op,index)=>op.operation==='observe-hit'&&operations[index+1]?.sequence===op.sequence)).toBe(true);
});
it.each([
 ['missing event',(o:DirectHitStepObservation)=>{o.propagationEvents.pop();}],
 ['duplicate event',(o:DirectHitStepObservation)=>{o.propagationEvents.push(o.propagationEvents[0]!);}],
 ['wrong source actor',(o:DirectHitStepObservation)=>{o.propagationEvents[0]!.sourceActorId='other';}],
 ['wrong source target',(o:DirectHitStepObservation)=>{o.propagationEvents[0]!.sourceTargetId='other';}],
 ['wrong trigger',(o:DirectHitStepObservation)=>{o.propagationEvents[0]!.triggerDamageEventId=9999;}],
 ['wrong event queue',(o:DirectHitStepObservation)=>{o.propagationEvents[0]!.eventSequence++;}],
 ['missing candidate',(o:DirectHitStepObservation)=>{o.propagationEvents[0]!.operations.shift();}],
 ['reordered operations',(o:DirectHitStepObservation)=>{o.propagationEvents[0]!.operations.reverse();}],
 ['invented cursor offset',(o:DirectHitStepObservation)=>{o.propagationEvents[0]!.operations.find(op=>op.operation==='observe-hit')!.sequence++;}],
 ['cross-target hit',(o:DirectHitStepObservation)=>{const op=o.propagationEvents[0]!.operations.find(op=>op.operation==='observe-hit')!;if(op.operation==='observe-hit')op.targetId='other';}],
 ['unknown allocation',(o:DirectHitStepObservation)=>{const op=o.propagationEvents[0]!.operations[0]!;if(op.operation==='allocate')op.site={kind:'unclassified'};}],
 ['missing hit observation',(o:DirectHitStepObservation)=>{const e=o.propagationEvents[0]!;e.operations=e.operations.filter(op=>op.operation!=='observe-hit');}],
 ['wrong allocation count',(o:DirectHitStepObservation)=>{o.propagationEvents[0]!.allocationCount++;}],
] as const)('rejects P5 %s',(_,mutate)=>{
 const o=structuredClone(observations[3]!);mutate(o);
 expect(()=>verifyPropagationStepWitness(o)).toThrow('Propagation step witness');
});

it.each([6,32])('witnesses every candidate and selected delivery for %i registered targets',count=>{
 const targets:EnemyTargetProfile[]=Array.from({length:count},(_,i)=>({id:i===0?SOURCE_ID:`target-${i}`,name:`Target ${i}`,position:{x:i===0?0:i===2?10:1,y:0},resistance:.1,...(i===1?{}:{initialAura:[{element:'hydro' as const,gaugeUnits:1}]})}));
 const config=makePropagationConfig({targets});
 let observation:DirectHitStepObservation|undefined;
 expect(()=>simulate(config,{critMode:'noCrit',[directHitStepWitnessSink]:o=>{observation=o;}})).toThrow('Trusted reaction-delivery');
 const o=observation!;
 verifyPropagationStepWitness(o);
 const parent=o.result.reactionDamageLog.find(r=>r.electroChargedPropagation)!;
 expect(parent.electroChargedPropagation!.candidates).toHaveLength(count);
 expect(parent.electroChargedPropagation!.candidates[1]!.reason).toBe('NO_HYDRO_AURA');
 expect(parent.electroChargedPropagation!.candidates[2]!.reason).toBe('OUT_OF_RANGE');
 expect(parent.electroChargedPropagation!.candidates.filter(c=>c.selected)).toHaveLength(count-2);
 const changed=structuredClone(o);changed.propagationEvents[0]!.operations.splice(2,1);
 expect(()=>verifyPropagationStepWitness(changed)).toThrow('Propagation step witness');
});

import {createEventStepResult,parseEventStepResult} from '../event-step-result';
import {eventStepProtocol} from '../direct-hit-step-witness';
it.each([0,1,2,3])('new public envelope strictly parses and preserves each damage value %i',i=>{
 const wire=createEventStepResult(observations[i]!);
 const reopened=parseEventStepResult(JSON.parse(JSON.stringify(wire)));
 expect(reopened.result).toEqual(observations[i]!.result);
 expect(reopened.wire.result.schemaVersion).toBe('1.54.0-event-steps');
 const forged=structuredClone(wire);forged.evidence.events[0]!.steps.splice(1,1);
 expect(()=>parseEventStepResult(forged)).toThrow();
 const wrongDamage=structuredClone(wire);wrongDamage.result.damageEvents[0]!.finalDamage+=1;
 expect(()=>parseEventStepResult(wrongDamage)).toThrow();
});
it('runs the new event contract through production gates without changing historical gates',()=>{
 const config=observations[3]!.result.config;
 const result=simulate(config,{critMode:'noCrit',[eventStepProtocol]:true});
 expect(result.damageEvents).toEqual(observations[3]!.result.damageEvents);
 expect(()=>simulate(config,{critMode:'noCrit'})).toThrow('Trusted reaction-delivery');
});

import {captureSimulationHit,serializeSimulationHit,parseSimulationHit,replaySimulationHit} from '../calculator-bridge';
it('replays every witnessed hit through independent calculation and a serialized v2 capture',()=>{
 const wire=createEventStepResult(observations[3]!);
 for(const event of wire.result.damageEvents){
  const capture=captureSimulationHit(wire,event.id);
  expect(capture.schemaVersion).toBe('calculator-event-v2');
  const imported=parseSimulationHit(serializeSimulationHit(capture));
  const replay=replaySimulationHit(imported);
  expect(replay.originalDamage).toBe(event.finalDamage);
  expect(replay.difference).toBeCloseTo(0,10);
 }
 const crossed=captureSimulationHit(wire,wire.result.damageEvents[0]!.id);
 crossed.sourceResult.damageEvents[0]!.finalDamage+=1;
 expect(()=>replaySimulationHit(crossed)).toThrow();
});
