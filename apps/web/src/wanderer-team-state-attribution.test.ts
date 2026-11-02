import {describe,it,expect} from 'vitest';
import type {SourceHostResult,SourceHostDamageRequest} from '../../../packages/sim-core/src/source-host-wire';
import fixture from './wanderer-team-state-619.fixture.json';
import {buildSourceDamageCurve,curveSeries} from './source-damage-curve';
import {classifyWandererTeamProjection,WANDERER_TEAM_STATE_SOURCE} from './wanderer-team-state-attribution';

// This is an attribution-only projection of the real saved capture, not a
// schema-complete result or an independent damage formula fixture.
const capture=()=>structuredClone(fixture.result) as unknown as SourceHostResult;
const applications=(fixture.result as unknown as SourceHostResult).applications;
const packets=fixture.result.calculations.map(c=>c.request) as unknown as SourceHostDamageRequest[];
const byAttack=new Map(packets.map(q=>[q.attackId,q]));
const projection=()=>structuredClone(packets.find(q=>q.ability==='Arcane Projection')!);
const parent=(q:SourceHostDamageRequest)=>byAttack.get(q.origin!.parentAttackId!)!;
const classify=(q:SourceHostDamageRequest,p=parent(q),pin:string=WANDERER_TEAM_STATE_SOURCE.revision)=>classifyWandererTeamProjection(pin,q,[p],applications.find(a=>a.calculationId===q.id)!);

describe('Wanderer team actual state and damage attribution',()=>{
 it('classifies all 42 real projections in the complete 619-hit saved capture',()=>{
  const model=buildSourceDamageCurve(capture()),series=curveSeries(model);
  expect(model.hits).toHaveLength(619);
  expect(model.hits.filter(h=>h.provider==='nicole')).toHaveLength(42);
  expect(series.breakdown.source.some(g=>g.key==='unknown')).toBe(false);
  const q=series.breakdown.source.find(g=>g.key==='协同投影（妮可Q）')!,c1=series.breakdown.source.find(g=>g.key==='命座投影（妮可C1）')!;
  expect(q.hits).toBe(23);expect(c1.hits).toBe(19);
  // Independent Python 3.12 sums differ from sequential JS by <3e-10 here;
  // retain both the independent values and exact original-order conservation.
  const byId=new Map(packets.map(q=>[q.id,q]));
  const original=(ability:string)=>fixture.result.applications.filter(a=>byId.get(a.calculationId)!.ability===ability).reduce((sum,a)=>sum+a.appliedDamage,0);
  expect(q.damage).toBe(original('Arcane Projection'));expect(c1.damage).toBe(original('Arcane Projection: Unity'));
  expect(q.damage).toBeCloseTo(1081874.8385691468,8);expect(c1.damage).toBeCloseTo(2807310.516872991,8);
 });

 it('conserves all 619 IDs, amounts, actual owners, per-skill totals and 120 one-second bins',()=>{
  const raw=capture(),model=buildSourceDamageCurve(raw),series=curveSeries(model);
  const byId=new Map(packets.map(q=>[q.id,q]));
  expect(new Set(model.hits.map(h=>h.id)).size).toBe(619);
  expect(model.hits.map(h=>[h.id,h.calculationId,h.frame,h.damage])).toEqual(raw.applications.map(a=>[a.id,a.calculationId,a.frame,a.appliedDamage]));
  const skills=new Map<string,number>(),expectedSkills=new Map<string,number>();
  model.hits.forEach((h,i)=>{
   const q=byId.get(raw.applications[i]!.calculationId)!;
   expect(h.actor).toBe(q.actorKey);expect(h.ability).toBe(q.ability);
   const key=q.actorKey+'/'+q.ability;
   skills.set(key,(skills.get(key)??0)+h.damage);expectedSkills.set(key,(expectedSkills.get(key)??0)+raw.applications[i]!.appliedDamage);
  });
  expect(skills).toEqual(expectedSkills);
  expect(series.total).toBe(29547632.435022313);expect(series.points).toHaveLength(120);
  expect(series.points.at(-1)!.cumulative).toBe(series.total);
  for(let second=0;second<120;second++)expect(series.points[second]!.damage).toBe(raw.applications.filter(a=>a.frame>=second*60&&a.frame<(second+1)*60).reduce((sum,a)=>sum+a.appliedDamage,0));
  for(const groups of Object.values(series.breakdown))expect(groups.reduce((sum,g)=>sum+g.damage,0)).toBeCloseTo(series.total,6);
  expect(series.breakdown.actor.map(g=>[g.key,g.damage,g.hits])).toEqual([
   ['wanderer',21971753.00195909,362],['durin',4840322.575347667,138],['faruzan',1888537.7128709191,105],['nicole',847019.1448446361,14],
  ]);
 });

 it('preserves recursive Swirl parents and same-frame Q/C1 projections separately',()=>{
  const rows=buildSourceDamageCurve(capture()).hits,projected=rows.filter(h=>h.provider==='nicole');
  const recursive=projected.filter(h=>byAttack.get(h.parentAttackId!)!.ability==='swirl-pyro');
  expect(recursive).toHaveLength(6);expect(recursive.every(h=>h.actor==='wanderer'&&h.element==='风')).toBe(true);
  expect(rows.filter(h=>h.reaction==='扩散')).toHaveLength(93);
  const twins=rows.filter(h=>h.frame===488&&h.provider==='nicole');
  expect(twins.map(h=>[h.actor,h.source])).toEqual([['faruzan','协同投影（妮可Q）'],['faruzan','命座投影（妮可C1）']]);
  const series=curveSeries(buildSourceDamageCurve(capture()));
  expect(series.events.filter(h=>h.frame===488).map(h=>h.id)).toEqual(rows.filter(h=>h.frame===488).map(h=>h.id));
 });

 it('distinguishes provider from the real non-Nicole owner without moving damage',()=>{
  const model=buildSourceDamageCurve(capture()),projected=model.hits.filter(h=>h.provider==='nicole');
  expect(projected.filter(h=>h.actor!=='nicole')).toHaveLength(40);
  expect(curveSeries(model,{actor:'nicole'}).total).toBe(847019.1448446361);
  expect(curveSeries(model,{source:'协同投影（妮可Q）'}).total).toBe(model.hits.filter(h=>h.mechanism==='nicole-q-projection').reduce((sum,h)=>sum+h.damage,0));
  expect(curveSeries(model,{source:'协同投影（妮可Q）'}).total).toBeCloseTo(1081874.8385691468,8);
  expect(packets.filter(q=>q.ability.startsWith('Arcane Projection')).every(q=>q.attackTagName==='AttackTagNone'&&q.rawAttack.AttackTag===0)).toBe(true);
 });

 it.each(['missing-origin','wrong-producer','wrong-name','prototype-name','wrong-tag','wrong-raw-owner','old-snapshot','wrong-element','missing-parent','wrong-parent-owner','29-frame-delay','31-frame-delay'] as const)('keeps %s evidence unclassified rather than guessing from a name',change=>{
  const q=projection(),p=structuredClone(parent(q));
  if(change==='missing-origin')delete q.origin;
  if(change==='wrong-producer')q.origin!.eventKey='nicole-c1';
  if(change==='wrong-name')q.ability='Arcane Projection (alias)';
  if(change==='prototype-name')q.ability='toString';
  if(change==='wrong-tag')q.rawAttack.AttackTag=6;
  if(change==='wrong-raw-owner')q.rawAttack.ActorIndex=0;
  if(change==='old-snapshot')q.snapshotFrame-=1;
  if(change==='wrong-element')q.element='anemo';
  if(change==='missing-parent')p.attackId=-1;
  if(change==='wrong-parent-owner')p.actorKey='nicole';
  if(change==='29-frame-delay')p.frame+=1;
  if(change==='31-frame-delay')p.frame-=1;
  expect(classify(q,p)).toBeUndefined();
 });

 it('does not relabel the Q projection as C1 or unreviewed source versions as reviewed',()=>{
  const q=projection();expect(classify(q)).toMatchObject({source:'协同投影（妮可Q）',provider:'nicole',mechanism:'nicole-q-projection'});
  expect(classify(q,parent(q),'unreviewed-source')).toBeUndefined();
  const c1=structuredClone(packets.find(q=>q.ability==='Arcane Projection: Unity')!);
  expect(classify(c1)).toMatchObject({source:'命座投影（妮可C1）',provider:'nicole',mechanism:'nicole-c1-projection'});
  c1.origin!.eventKey='nicole-burst-hook';expect(classify(c1)).toBeUndefined();
 });

 it.each(['missing-origin','forged-parent-id','missing-parent-row'])('retains unknown with %s instead of trusting an unproved display name',change=>{
  const raw=capture();for(const c of raw.calculations)if(c.request.kind==='damage'&&c.request.ability.startsWith('Arcane Projection')){
   if(change==='missing-origin')delete c.request.origin;
   if(change==='forged-parent-id')c.request.origin!.parentAttackId=2147483647;
  }
  if(change==='missing-parent-row')raw.calculations=raw.calculations.filter(c=>c.request.kind!=='damage'||c.request.ability.startsWith('Arcane Projection'));
  const model=buildSourceDamageCurve(raw),unknown=curveSeries(model).breakdown.source.find(g=>g.key==='unknown');
  expect(unknown).toMatchObject(change==='missing-parent-row'?{hits:619,damage:29547632.435022313}:{hits:42,damage:3889185.3554421375});
  expect(model.hits.some(h=>h.provider==='nicole')).toBe(false);
 });
});
