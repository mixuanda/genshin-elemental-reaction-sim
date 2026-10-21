import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createSourceHostResult,captureSourceHostHit,replaySourceHostHit} from '../packages/sim-core/src/source-host-capture';
import type {SourceHostResult} from '../packages/sim-core/src/source-host-wire';
const data=JSON.parse(readFileSync(process.argv[2]!,'utf8'));const summaries=[];
for(const run of data.runs){
 const r=run.result as SourceHostResult;
 const replay=createSourceHostResult(r);assert.deepEqual(replay.applications,r.applications);
 const byId=new Map(r.calculations.map(c=>[c.request.id,c.request]));
 const a=r.applications.find(a=>{const q=byId.get(a.calculationId)!;return q.kind==='damage'&&q.input.effectiveResistance<0;});assert.ok(a);
 const original=captureSourceHostHit(r,a.id);assert.equal(replaySourceHostHit(original).difference,0);
 for(const mutation of ['at-expiry','past-expiry','wrong-element']){
  const c=structuredClone(original);const q=c.calculation.request;
  const step=q.scalarProvenance!.reads.find(rd=>rd.kind==='resistance')!.steps.find(s=>s.outcome==='applied')!;
  if(mutation==='wrong-element')step.element=q.element==='pyro'?'cryo':'pyro';
  else step.expiryBefore=step.expiryAfter=q.frame-(mutation==='past-expiry'?1:0);
  assert.throws(()=>replaySourceHostHit(c),undefined,mutation);
 }
 summaries.push({scenario:run.scenario,seed:r.seed,allCalculations:r.calculations.length,allApplications:r.applications.length,numericApplicationsUnchanged:true,negativeCases:3});
}
writeFileSync(process.argv[3]!,JSON.stringify(summaries,null,2));console.log(JSON.stringify(summaries,null,2));
