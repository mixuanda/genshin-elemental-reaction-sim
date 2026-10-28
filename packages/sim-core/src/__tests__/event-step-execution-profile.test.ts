import {expect,it} from 'vitest';
import fixture from '../../../../docs/fixtures/ec-event-steps.synthetic.json';
import {migrateConfig} from '@genshin-dps-lab/schemas';
import {applyExecutionProfile,PRACTICAL_EXECUTION_PROFILE,IDEALIZED_EXECUTION_PROFILE} from '../execution-profiles';
import {simulateEventStepResult,parseEventStepResult,applyEventStepExecutionProfile} from '../event-step-result';
import {eventStepProtocol} from '../direct-hit-step-witness';
import {captureSimulationHit,replaySimulationHit} from '../calculator-bridge';

it('reproduces the historical default baseline rejection for EC plus delay',()=>{
 expect(()=>applyExecutionProfile(migrateConfig(fixture),PRACTICAL_EXECUTION_PROFILE)).toThrow('Trusted reaction-delivery');
});
it.each(['delay-12021','delay-12022'])('uses the witnessed runtime baseline and retains exact delays and replay for seed %s',randomSeed=>{
 const input=migrateConfig({...fixture,duration:2,cycleLength:2});
 const original=structuredClone(input);
 const options={randomSeed,critMode:'noCrit' as const,[eventStepProtocol]:true as const};
 const direct=simulateEventStepResult(input,options);
 const ideal=applyEventStepExecutionProfile(input,IDEALIZED_EXECUTION_PROFILE,{randomSeed,critMode:'noCrit'});
 expect(simulateEventStepResult(ideal.config,options).result.damageEvents).toEqual(direct.result.damageEvents);
 const delayed=applyEventStepExecutionProfile(input,PRACTICAL_EXECUTION_PROFILE,{randomSeed,critMode:'noCrit'});
 expect(delayed.changes[0]).toMatchObject({originalStartTick:0,requestedTick:2,addedDelayFrames:2});
 expect(delayed.config.timeline!.abilities).toEqual(input.timeline!.abilities);
 expect(delayed.baselineRuntimeOptions!.randomSeed).toBe(randomSeed);
 expect(input).toEqual(original);
 const actual=simulateEventStepResult(delayed.config,options);
 expect(actual.result.timelineExecution!.commandResults[0]!.startFrame).toBe(2);
 expect(actual.result.damageEvents[0]!.frame).toBe(direct.result.damageEvents[0]!.frame+2);
 expect(simulateEventStepResult(delayed.config,options).wire).toEqual(actual.wire);
 const reopened=parseEventStepResult(JSON.parse(JSON.stringify(actual.wire)));
 for(const event of reopened.result.damageEvents){
  expect(replaySimulationHit(captureSimulationHit(reopened.wire,event.id)).difference).toBeCloseTo(0,10);
 }
 const forged=structuredClone(actual.wire);forged.evidence.events[0]!.frame--;
 expect(()=>parseEventStepResult(forged)).toThrow();
});
