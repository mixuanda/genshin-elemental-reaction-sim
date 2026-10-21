import {it,expect} from 'vitest';
import {newSimulationOptions} from './new-simulation-options';
import {simulate} from '../../../packages/sim-core/src/simulator';
import {makeConfig} from '../../../packages/sim-core/src/__tests__/fixtures';
it('new browser runs use integer frames without changing historical options or collapsing same-frame hits',()=>{
 const old={compatibilityMode:'legacy-v0.1' as const};const options=newSimulationOptions(old);
 expect(old.compatibilityMode).toBe('legacy-v0.1');expect(options.compatibilityMode).toBe('legal-frame-v1');
 const config=makeConfig({duration:2,cycleLength:2,rotation:[
  {id:'a1',actorId:'a',name:'frame1',at:1/60,once:true,hits:[{id:'hit',offset:0,scaling:1,element:'physical'}]},
  {id:'a59',actorId:'a',name:'frame59',at:59/60,once:true,hits:[{id:'hit',offset:0,scaling:1,element:'physical'},{id:'hit2',offset:0,scaling:1,element:'physical'}]},
  {id:'a60',actorId:'a',name:'frame60',at:1,once:true,hits:[{id:'hit',offset:0,scaling:1,element:'physical'}]},
 ]});
 const result=simulate(config,{...options,execution:{captureHits:true}});
 expect(result.compatibilityMode).toBe('legal-frame-v1');
 expect(result.damageEvents.map(h=>h.frame)).toEqual([1,59,59,60]);
 expect(result.damageEvents.map(h=>h.timeSeconds)).toEqual([1/60,59/60,59/60,1]);
 expect(result.totalDamage).toBe(result.damageEvents.reduce((sum,h)=>sum+h.finalDamage,0));
});
