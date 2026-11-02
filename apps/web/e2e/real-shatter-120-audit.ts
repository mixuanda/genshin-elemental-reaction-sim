import {expect} from '@playwright/test';
import {captureSourceHostHit,replaySourceHostHit} from '../../../packages/sim-core/src/source-host-capture';
import type {SourceHostResult} from '../../../packages/sim-core/src/source-host-wire';

interface NativeLog {frame:number;event:string;msg:string;char_index?:number;logs:Record<string,unknown>}
/** Independent arithmetic on captured real states; no production formula supplies expected damage. */
export function auditRealShatter120(r:SourceHostResult,scenario:'zero'|'full'){
 expect(r.observationWindow).toMatchObject({actualEndFrame:7200,configuredEndFrame:7200,endReason:'duration'});
 expect(r.initialEnergy?.mode).toBe(scenario);expect(r.startupState?.mode).toBe(scenario);
 expect(r.startupState!.actors.map(a=>a.actorKey).sort()).toEqual(['barbara','kaeya','noelle']);
 for(const a of r.startupState!.actors)expect(a.energy).toBe(scenario==='zero'?0:a.maxEnergy);
 const logs=r.logs as NativeLog[],requests=new Map(r.calculations.map(c=>[c.request.id,c.request]));
 const qs=r.abilityInvocations!.filter(a=>a.characterKey==='kaeya'&&a.action==='burst');
 const es=r.abilityInvocations!.filter(a=>a.characterKey==='kaeya'&&a.action==='skill');
 expect(es.length).toBeGreaterThanOrEqual(12);expect(qs.length).toBeGreaterThan(0);
 expect(r.abilityInvocations!.every(a=>a.success)).toBe(true);
 for(let i=1;i<es.length;i++)expect(es[i]!.startedFrame-es[i-1]!.startedFrame).toBeGreaterThanOrEqual(385);
 for(let i=1;i<qs.length;i++)expect(qs[i]!.startedFrame-qs[i-1]!.startedFrame).toBeGreaterThanOrEqual(948);
 const energy:Record<string,number>=Object.fromEntries(r.startupState!.actors.map(a=>[a.actorKey,a.energy]));
 const consumes=(r.energyApplications??[]).filter(a=>a.operation==='consume');
 expect(consumes).toHaveLength(qs.length);
 for(const row of r.energyApplications??[]){
  expect(row.energyBefore).toBeCloseTo(energy[row.actorKey]!,10);
  const expected=row.operation==='consume'?Math.max(0,row.energyBefore-row.requestedAmount):Math.min(row.energyMax,row.energyBefore+row.requestedAmount);
  expect(row.energyAfter).toBeCloseTo(expected,10);expect(row.energyAfter).toBeGreaterThanOrEqual(0);expect(row.energyAfter).toBeLessThanOrEqual(row.energyMax);
  if(row.operation==='consume'){
   expect(row.actorKey).toBe('kaeya');expect(row.requestedAmount).toBe(60);expect(row.energyBefore).toBeGreaterThanOrEqual(60);
   expect(qs.some(q=>q.startedFrame+51===row.frame)).toBe(true);
  }else expect(row.operation).toBe('particle-apply');
  energy[row.actorKey]=row.energyAfter;
 }
 let maxParticleError=0;
 for(const c of r.calculations){const q=c.request;
  if(q.kind!=='character-energy'||q.input.operation!=='particle-amount')continue;
  const p=q.input;expect(p.partyCount).toBe(3);
  const base=p.particleElement===p.actorElement?3:p.particleElement===''?2:1;
  const expected=base*(p.isActive?1:1-0.1*p.partyCount)*p.energyRecharge*p.particleCount;
  maxParticleError=Math.max(maxParticleError,Math.abs(c.value-expected));expect(c.value).toBeCloseTo(expected,10);
 }
 const skips=logs.filter(l=>l.msg.startsWith('Q_SKIP ')).map(l=>({frame:l.frame,energy:Number(l.msg.split('=')[1])}));
 expect(skips.length).toBeGreaterThan(0);
 // Under this configuration the observed skips are energy-limited. No failed attempt is silently counted as a zero-damage burst.
 for(const skip of skips)expect(skip.energy).toBeLessThan(60);
 const contribution:Record<string,number>={},rows=[];let maxError=0;
 const shatter=1446.8535*3*(1+16*28/(28+2000))*0.9;
 const shatters=r.applications.filter(a=>requests.get(a.calculationId)?.ability==='shatter');
 expect(shatters.length).toBeGreaterThanOrEqual(12);
 expect(r.applications.at(-1)!.frame).toBeGreaterThan(6900);
 for(const app of r.applications){
  const q=requests.get(app.calculationId)!;if(q.kind!=='damage')throw Error('Non-damage application');
  expect(Number.isInteger(app.frame)).toBe(true);expect(app.frame).toBeLessThan(7200);expect(app.frame).toBe(q.frame);
  let expected=0;
  if(q.ability==='shatter'){
   expected=shatter;expect(q.actorKey).toBe('noelle');expect(q.input.elementalMastery).toBe(28);expect(q.input.defenseIgnore).toBe(1);expect(app.isCrit).toBe(false);
   const parent=r.applications.find(a=>a.attackId===q.origin?.parentAttackId&&a.targetKey===app.targetKey)!;
   expect(parent).toBeDefined();expect(parent.frame).toBe(app.frame);expect(parent.id).toBeGreaterThan(app.id);
   expect(requests.get(parent.calculationId)?.actorKey).toBe('noelle');expect(requests.get(parent.calculationId)?.ability).toBe('Normal 0');
   const action=r.abilityInvocations!.find(a=>a.actionSequence===q.origin?.creationActionSequence)!;
   expect(action.characterKey).toBe('noelle');expect(app.frame-action.startedFrame).toBe(27);
   const frozen=logs.filter(l=>l.frame<app.frame&&l.event==='element'&&String(l.logs.after).includes('frozen:')).at(-1);
   expect(frozen).toBeDefined();
  }else if(q.ability==='Freeze Broken'){expect(app.rawDamage).toBe(0);}
  else {
   const mult=q.ability==='Frostgnaw'?1.912:q.ability==='Glacial Waltz'?0.776:q.actorKey==='barbara'?0.3784:0.7912;
   expect(q.input.scaling).toBe(mult);expect(q.input.flatDamage).toBe(0);expect(q.input.baseDamageBonus).toBe(0);expect(q.input.amped).toBe(false);
   expect(q.input.damageBonus).toBe(q.actorKey==='noelle'?0.087:0);expect(q.input.defenseIgnore).toBe(0);expect(q.input.defenseAdjustment).toBe(0);
   expect(q.input.characterLevel).toBe(90);expect(q.input.enemyLevel).toBe(90);expect(q.input.effectiveResistance).toBe(0.1);
   const attack=q.snapshot.baseAtk*(1+q.snapshot.atkPct)+q.snapshot.flatAtk;
   expect(q.input.scalingValue).toBeCloseTo(attack,10);
   expected=attack*mult*(1+q.input.damageBonus)*0.5*0.9*(app.isCrit?1+q.snapshot.critDamage:1);
   if(q.actorKey==='kaeya'){
    const modifier=q.snapshot.statProvenance?.snapshotRead?.steps.find(step=>step.key==='skyrider'&&step.outcome==='applied');
    expect(q.snapshot.atkPct).toBeCloseTo(0.07+(modifier?0.12:0),10);
   }
  }
  const error=app.rawDamage-expected;maxError=Math.max(maxError,Math.abs(error));expect(app.rawDamage).toBeCloseTo(expected,8);
  contribution[q.actorKey]=(contribution[q.actorKey]??0)+app.rawDamage;
  rows.push({id:app.id,frame:app.frame,actor:q.actorKey,ability:q.ability,expected,actual:app.rawDamage,error});
 }
 for(const q of qs){
  const hits=r.applications.filter(a=>{const req=requests.get(a.calculationId);return req?.ability==='Glacial Waltz'&&req.origin?.creationActionSequence===q.actionSequence;});
  const expected=Array.from({length:13},(_,i)=>q.startedFrame+53+40*i).filter(f=>f<7200);
  expect(hits.map(a=>a.frame)).toEqual(expected);
  for(const h of hits)expect(requests.get(h.calculationId)?.snapshotFrame).toBe(q.startedFrame);
 }
 expect(new Set(r.applications.map(a=>a.id)).size).toBe(r.applications.length);
 expect(new Set(r.applications.map(a=>`${a.attackId}:${a.targetKey}`)).size).toBe(r.applications.length);
 const native=r.result as {total_damage:number;characters:{name:string;damage_events:{damage:number}[]}[]};
 const total=r.applications.reduce((sum,a)=>sum+a.rawDamage,0);expect(native.total_damage).toBeCloseTo(total,8);
 expect(Object.values(contribution).reduce((a,b)=>a+b,0)).toBeCloseTo(total,8);
 for(const c of native.characters)expect(c.damage_events.reduce((a,e)=>a+e.damage,0)).toBeCloseTo(contribution[c.name]??0,8);
 const representativeIds=new Set<number>();
 for(const ability of ['Frostgnaw','Glacial Waltz','shatter'])representativeIds.add(r.applications.find(a=>requests.get(a.calculationId)?.ability===ability)!.id);
 for(const actor of ['barbara','noelle'])representativeIds.add(r.applications.find(a=>requests.get(a.calculationId)?.actorKey===actor&&requests.get(a.calculationId)?.ability==='Normal 0')!.id);
 representativeIds.add(r.applications.at(-1)!.id);
 for(const id of representativeIds)expect(replaySourceHostHit(captureSourceHostHit(r,id)).difference).toBe(0);
 return {scenario,seed:r.seed,durationFrames:7200,source:r.sourceCommit,artifact:r.executionArtifact,total,dps:total/120,contribution,hitCount:r.applications.length,shatterCount:shatters.length,shatterFrames:shatters.map(a=>a.frame),eFrames:es.map(a=>a.startedFrame),qFrames:qs.map(a=>a.startedFrame),consumes,skips,finalEnergy:energy,maxError,maxParticleError,replayedIds:[...representativeIds],rows};
}
