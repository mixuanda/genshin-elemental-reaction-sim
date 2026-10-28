// Audit saved engine evidence without rerunning the simulation.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {captureSourceHostHit,replaySourceHostHit} from '../packages/sim-core/src/source-host-capture';
import {captureSourceHostEnergy,replaySourceHostEnergy} from '../packages/sim-core/src/source-host-energy-capture';
import {captureSourceHostCooldown,replaySourceHostCooldown} from '../packages/sim-core/src/source-host-cooldown-capture';
import type {SourceHostResult} from '../packages/sim-core/src/source-host-wire';
const data=JSON.parse(readFileSync(process.argv[2]!,'utf8'));
const runs:Array<{scenario:string,result:SourceHostResult}>=data.runs??[{scenario:'native-default-full',result:data}];
const summaries=[];
for(const {scenario,result:r} of runs){
 const records=new Map(r.calculations.map(c=>[c.request.id,c]));
 const hitKinds=new Set<string>();let damage=0,energy=0,cooldown=0;
 let buffed:ReturnType<typeof captureSourceHostHit>|undefined;
 for(const a of r.applications){
  const q=records.get(a.calculationId)!.request;
  const kind=`${q.actorKey}/${q.ability}`;
  if(hitKinds.has(kind))continue;hitKinds.add(kind);
  const c=captureSourceHostHit(r,a.id);assert.equal(replaySourceHostHit(c).difference,0);damage++;
  if(q.ability==='Pyronado' && q.kind==='damage' && q.snapshot.flatAtk>0)buffed=c;
 }
 const energyActors=new Set<string>();
 for(const e of r.energyApplications??[]){
  if(e.operation!=='consume'||energyActors.has(e.actorKey))continue;
  energyActors.add(e.actorKey);
  assert.equal(replaySourceHostEnergy(captureSourceHostEnergy(r,e.id)).difference,0);energy++;
 }
 const cdKinds=new Set<string>();
 for(const c of r.calculations){
  if(c.request.kind!=='character-cooldown'||c.request.input.operation!=='duration')continue;
  const key=`${c.request.actorKey}/${c.request.input.action}`;if(cdKinds.has(key))continue;cdKinds.add(key);
  assert.equal(replaySourceHostCooldown(captureSourceHostCooldown(r,c.request.id)).difference,0);cooldown++;
 }
 if(!buffed){
  const a=r.applications.find(a=>{const q=records.get(a.calculationId)!.request;return q.kind==='damage'&&q.ability==='Pyronado'&&q.snapshot.flatAtk>0;});
  assert.ok(a,'real Bennett-buffed Xiangling snapshot required');buffed=captureSourceHostHit(r,a.id);
 }
 const negative=(name:string,edit:(v:any)=>void)=>{const c=structuredClone(buffed!);edit(c);assert.throws(()=>replaySourceHostHit(c),undefined,name);};
 negative('application frame changed',c=>c.application.frame+=1);
 negative('damage changed',c=>c.application.rawDamage+=1);
 negative('hit ownership changed',c=>c.calculation.request.actorIndex=0);
 negative('snapshot ATK changed',c=>c.calculation.request.snapshot.flatAtk+=1);
 negative('talent coefficient changed',c=>c.calculation.request.input.scaling+=.01);
 negative('missing modifier formula',c=>{assert.ok(c.supportingCalculations.length);c.supportingCalculations=[];});
 negative('snapshot read after creation',c=>c.calculation.request.snapshot.statProvenance.snapshotRead.frame+=1);
 summaries.push({scenario,seed:r.seed,damageAbilitySamples:damage,energyActors:energy,cooldownActorActions:cooldown,negativeCases:7});
}
writeFileSync(process.argv[3]!,JSON.stringify(summaries,null,2));console.log(JSON.stringify(summaries,null,2));
