import {expect,it} from 'vitest';
import type {SimConfig} from '@genshin-dps-lab/schemas';
import configs from './fixtures/shatter-correctness-configs.json';
import {simulate} from '../simulator';
// Synthetic mechanics configurations copied from the existing recursive-delivery
// scenarios. These are not verified real characters or official-server parity.
// Independent arithmetic: pinned level-90 base 1446.8535, Shatter multiplier 3,
// EM term 16*EM/(EM+2000); transformative damage has no DEF or ordinary crit factor.
const shatter=(bonus:number,res:number)=>1446.8535*3*(1+16*100/2100+bonus)*(1-res);
for(const name of Object.keys(configs) as (keyof typeof configs)[]){
 it(`independent numerical/frame/ownership conservation: ${name}`,()=>{
  const r=simulate(configs[name] as SimConfig,{critMode:'noCrit'});
  const children=r.damageEvents.filter(e=>e.reaction==='shatter');
  expect(children).toHaveLength(name==='poiseDepleted'?0:1);
  expect(new Set(r.damageEvents.map(e=>e.id)).size).toBe(r.damageEvents.length);
  for(const e of r.damageEvents)expect(Number.isInteger(e.frame)).toBe(true);
  const nested=name==='nestedOverload';
  if(children.length){const e=children[0]!,parent=r.damageEvents.find(p=>p.id===e.parentDamageEventId)!;
   expect(e.finalDamage).toBeCloseTo(shatter(nested?0:0.2,nested?0.1:0.25),9);
   expect(e.frame).toBe(nested?3:2);expect(parent.frame).toBe(e.frame);
   expect(e.sourceActorId).toBe(nested?'pyro':'crusher');expect(e.targetId).toBe(nested?'enemy-1':'enemy-0');
   expect(e.id).toBeLessThan(parent.id);
   expect(r.reactionDamageLog.filter(log=>log.reaction==='shatter').flatMap(log=>log.damageEventIds)).toEqual([e.id]);
   if(nested){expect(parent.reaction).toBe('overload');expect(r.damageEvents.find(p=>p.id===parent.parentDamageEventId)?.sourceActorId).toBe('pyro');}
  }
  const expected=nested?900+2*(1446.8535*2.75*(1+1600/2100)*0.9)+shatter(0,0.1):name==='poiseDepleted'?750:(name==='gcdBlocked'?1875:750)+shatter(0.2,0.25);
  expect(r.totalDamage).toBeCloseTo(expected,9);
  expect(r.damageEvents.reduce((s,e)=>s+e.finalDamage,0)).toBeCloseTo(expected,9);
  for(const [actor,total] of Object.entries(r.byCharacter))expect(total).toBeCloseTo(r.damageEvents.filter(e=>e.sourceActorId===actor).reduce((s,e)=>s+e.finalDamage,0),9);
 });
}
it('one-frame trigger shift preserves damage and does not round to seconds',()=>{
 const config=structuredClone(configs.directPhysical) as SimConfig;
 const base=simulate(config,{critMode:'noCrit'});
 const ability=config.timeline!.abilities.find(a=>a.id==='crusher-skill')!;
 ability.hits![0]!.frame=1;ability.cancelFrame=2;ability.animationEndFrame=2;
 const shifted=simulate(config,{critMode:'noCrit'});
 expect(shifted.totalDamage).toBe(base.totalDamage);
 expect(shifted.damageEvents.filter(e=>e.sourceActorId==='crusher').map(e=>e.frame)).toEqual([3,3]);
 expect(base.damageEvents.filter(e=>e.sourceActorId==='crusher').map(e=>e.frame)).toEqual([2,2]);
});
it.each([11,12])('Shatter GCD integer-frame boundary %i',frame=>{
 const config=structuredClone(configs.gcdBlocked) as SimConfig;
 const ability=config.timeline!.abilities.find(a=>a.id==='crusher-skill')!;
 ability.hits!.find(h=>h.id==='crusher-hit-gcd')!.frame=frame;
 ability.cancelFrame=frame+1;ability.animationEndFrame=frame+1;
 const r=simulate(config,{critMode:'noCrit'});
 const children=r.damageEvents.filter(e=>e.reaction==='shatter');
 expect(children.map(e=>e.frame)).toEqual(frame===11?[2]:[2,14]);
 for(const child of children)expect(child.finalDamage).toBeCloseTo(shatter(0.2,0.25),9);
 expect(r.totalDamage).toBeCloseTo(1875+children.length*shatter(0.2,0.25),9);
});
