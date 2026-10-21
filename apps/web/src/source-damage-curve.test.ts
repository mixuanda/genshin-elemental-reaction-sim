import {describe,it,expect} from 'vitest';
import type {SourceHostResult} from '../../../packages/sim-core/src/source-host-wire';
import {buildSourceDamageCurve,curveSeries} from './source-damage-curve';
const fixture=(extra:Record<string,unknown>={})=>({observationWindow:{endReason:'duration',actualEndFrame:7200,configuredEndFrame:7200},targetScene:{targets:[{}]},applications:[0,59,60,7199,7200].map((frame,i)=>({id:i,calculationId:i,frame,appliedDamage:(i+1)*10})),calculations:[0,1,2,3,4].map(i=>({request:{id:i,kind:'damage',actorKey:i===3?'xiangling':'kaeya',ability:'actual',element:'cryo',attackTagName:i===1?'AttackTagElementalArtHold':'AttackTagNormal',damageCategory:'ordinary',rawAttack:{Catalyzed:false},input:{amped:i===2,amplifyingReaction:'melt'}}})),logs:[],abilityInvocations:[],...extra}) as unknown as SourceHostResult;
describe('actual-event damage curves',()=>{
 it('conserves each dimension and cumulative total with half-open 120s endpoint and zero idle bins',()=>{
  const s=curveSeries(buildSourceDamageCurve(fixture()));
  expect(s.total).toBe(100);expect(s.points).toHaveLength(120);
  expect(s.points[0]!.damage).toBe(30);expect(s.points[1]!.damage).toBe(30);expect(s.points[2]!.damage).toBe(0);expect(s.points[119]!.damage).toBe(40);expect(s.points[119]!.cumulative).toBe(100);
  for(const groups of Object.values(s.breakdown)){expect(groups.reduce((a,g)=>a+g.damage,0)).toBe(100);expect(groups.reduce((a,g)=>a+g.share,0)).toBeCloseTo(1,12);}
  expect(s.breakdown.reaction.find(g=>g.key.startsWith('融化'))?.damage).toBe(30);
  expect(s.breakdown.source.find(g=>g.key==='E')?.damage).toBe(20);
 });
 it('filters independent dimensions without losing off-field ownership or guessing absent owner',()=>{
  const r=fixture();r.calculations=r.calculations.slice(1);
  const m=buildSourceDamageCurve(r);
  expect(m.hits[0]!.actor).toBe('unknown');
  expect(curveSeries(m,{actor:'xiangling',source:'普攻'}).total).toBe(40);
  expect(curveSeries(m,{actor:'xiangling',source:'E'}).total).toBe(0);
 });
 it('uses native transformative names and never adds amplification extra damage twice',()=>{
  const r=fixture();const q=r.calculations[0]!.request as any;q.attackTagName='AttackTagECDamage';q.damageCategory='transformative';
  const s=curveSeries(buildSourceDamageCurve(r));expect(s.breakdown.reaction.find(g=>g.key==='感电')?.damage).toBe(10);expect(s.total).toBe(100);
 });
 it('refuses an incomplete observation window',()=>{expect(()=>buildSourceDamageCurve(fixture({observationWindow:{endReason:'targets-dead',actualEndFrame:600,configuredEndFrame:7200}}))).toThrow('完整定时观察窗');});
 it('uses successful action times and recorded buff refresh/extension, rejects unidentifiable multi-target VV',()=>{
  const r=fixture({abilityInvocations:[{id:1,success:true,action:'skill',startedFrame:59,characterKey:'sucrose'},{id:2,success:false,action:'burst',startedFrame:61,characterKey:'kaeya'}],logs:[
   {event:'status',msg:'enemy mod added',frame:10,ended:150,char_index:-1,logs:{key:'vvcryo',expiry:100}},
   {event:'status',msg:'enemy mod refreshed',frame:50,char_index:-1,logs:{key:'vvcryo',expiry:120}},
   {event:'status',msg:'mod extended',frame:60,char_index:-1,logs:{key:'vvcryo',expiry:150}}
  ]});
  const m=buildSourceDamageCurve(r);expect(m.markers).toEqual([{id:1,frame:59,actor:'sucrose',action:'E'}]);expect(m.buffs.map(b=>[b.startFrame,b.endFrame])).toEqual([[10,50],[50,150]]);
  (r.targetScene as any).targets.push({});expect(buildSourceDamageCurve(r).buffs).toEqual([]);
 });
});

it('honors early deletion recorded on the original native modifier event',()=>{
 const r=fixture({logs:[{event:'status',msg:'stat mod added',frame:10,ended:80,char_index:0,logs:{key:'bennett-field',expiry:100}},{event:'status',msg:'stat mod refreshed',frame:40,ended:40,char_index:0,logs:{key:'bennett-field',expiry:130}}]});
 expect(buildSourceDamageCurve(r).buffs.map(b=>[b.startFrame,b.endFrame])).toEqual([[10,40],[40,80]]);
});
