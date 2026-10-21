import {describe,it,expect} from 'vitest';
import {sourceMonteJobs,sourceMonteStatistics,summarizeSourceMonteTrial,type SourceMonteTrial} from './source-host-monte-carlo';
import {startSourceMonteCarlo,type MonteWorker} from './source-host-monte-carlo-client';
import {SOURCE_HOST_PROTOCOL} from '../../../packages/sim-core/src/source-host-wire';
const request={protocol:SOURCE_HOST_PROTOCOL,config:'options duration=120;',seed:'1'};
const trial=(index:number,seed:string,damage=120):SourceMonteTrial=>({index,seed,damage,dps:damage/120,durationSeconds:120,hits:1,ordinaryHits:1,crits:0,conditionalHitExpectation:damage,elapsedMs:1,eventSha256:'a'.repeat(64),sourceCommit:'fixed',wasmSha256:'b'.repeat(64)});
class FakeWorker {
 onmessage:MonteWorker['onmessage']=null;onerror:MonteWorker['onerror']=null;onmessageerror:MonteWorker['onmessageerror']=null;
 terminated=false;jobs:Array<{index:number;seed:string}>=[];
 postMessage(r:any){this.jobs=r.monteCarloJobs;}
 terminate(){this.terminated=true;}
 send(data:any){this.onmessage?.call(this as unknown as Worker,{data} as MessageEvent);}
 finish(){for(const j of this.jobs){this.send({type:'monte-start',...j});this.send({type:'monte-trial',trial:trial(j.index,j.seed,120+j.index)});}this.send({type:'monte-done'});}
}
describe('real source batch accounting',()=>{
 it('uses canonical, unique effective seeds and preserves prefixes at 1000/10000',()=>{
  expect(sourceMonteJobs('2147483646',3).map(j=>j.seed)).toEqual(['2147483646','1','2']);
  const a=sourceMonteJobs('0',10000);expect(new Set(a.map(j=>j.seed)).size).toBe(10000);expect(a.slice(0,1000)).toEqual(sourceMonteJobs('89482311',1000));
 });
 it('keeps index-order statistics independent of arrival order; computes SEM and sample SD',()=>{
  const a=[trial(0,'1',100),trial(1,'2',200),trial(2,'3',300)];
  expect(sourceMonteStatistics(a)).toEqual(sourceMonteStatistics([...a].reverse()));
  expect(sourceMonteStatistics(a)?.damage.sampleStandardDeviation).toBe(100);
  expect(sourceMonteStatistics(a)?.damage.standardError).toBe(100/Math.sqrt(3));
  expect(sourceMonteStatistics([])).toBeNull();expect(sourceMonteStatistics(a.slice(0,1))?.damage.standardError).toBeNull();
 });
 it('returns the same per-trial outputs with 1 and 2 workers and terminates all lanes',async()=>{
  const reports=[];
  for(const workers of [1,2]){const ws:FakeWorker[]=[];const h=startSourceMonteCarlo(request,{count:4,workers,baseSeed:'10',budgetMs:5000},()=>{},()=>{const w=new FakeWorker;ws.push(w);return w;});for(const w of [...ws].reverse())w.finish();const r=await h.done;expect(r.status).toBe('complete');expect(r.counts.succeeded).toBe(4);expect(ws.every(w=>w.terminated)).toBe(true);reports.push(r);}
  expect(reports[0]!.trials).toEqual(reports[1]!.trials);
 });
 it('cancels in-flight workers, distinguishes unstarted trials, ignores late messages',async()=>{
  const ws:FakeWorker[]=[];let updates=0;
  const h=startSourceMonteCarlo(request,{count:10,workers:2,baseSeed:'1',budgetMs:5000},()=>updates++,()=>{const w=new FakeWorker;ws.push(w);return w;});
  for(const w of ws)w.send({type:'monte-start',...w.jobs[0]});h.cancel();const r=await h.done;
  expect(r.counts).toEqual({requested:10,succeeded:0,failed:0,cancelled:2,notStarted:8,running:0});expect(r.statistics).toBeNull();const n=updates;ws[0]!.finish();expect(updates).toBe(n);expect(ws.every(w=>w.terminated)).toBe(true);
 });
 it('does not turn a failed sample into zero or label survivor statistics complete',async()=>{
  const w=new FakeWorker;const h=startSourceMonteCarlo(request,{count:3,workers:1,baseSeed:'1',budgetMs:5000},()=>{},()=>w);
  w.send({type:'monte-start',...w.jobs[0]});w.send({type:'monte-trial',trial:trial(0,'1',120)});w.send({type:'monte-start',...w.jobs[1]});w.send({type:'error',message:'real failure'});
  const r=await h.done;expect(r.counts).toEqual({requested:3,succeeded:1,failed:1,cancelled:0,notStarted:1,running:0});expect(r.statistics?.damage.meanDamage).toBe(120);expect(r.statisticsScope).toBe('completed-samples-only');expect(r.errors).toEqual(['real failure']);
 });
 it('rejects mismatched identity and stops a stalled batch at its budget',async()=>{
  const w=new FakeWorker;const h=startSourceMonteCarlo(request,{count:1,workers:1,baseSeed:'1',budgetMs:5000},()=>{},()=>w);
  w.send({type:'monte-start',index:0,seed:'2'});expect((await h.done).status).toBe('failed');
  const w2=new FakeWorker;const h2=startSourceMonteCarlo(request,{count:1,workers:1,baseSeed:'1',budgetMs:100},()=>{},()=>w2);expect((await h2.done).status).toBe('budget');expect(w2.terminated).toBe(true);
 });
});

// Contract fixtures exercise aggregation only; real four-team execution is in Playwright.
function summaryFixture() {
 return {seed:'1',sourceCommit:'fixed',executionArtifact:{wasmSha256:'b'.repeat(64)},randomness:{critPolicy:'native-seeded'},
 observationWindow:{endReason:'duration',actualEndFrame:7200,configuredEndFrame:7200},
 calculations:[{request:{id:1,kind:'damage',damageCategory:'ordinary',input:{critRate:.5,critDamage:.5,isCrit:true,hitWeakPoint:false}}},
 {request:{id:2,kind:'damage',damageCategory:'transformative',input:{critRate:0,critDamage:0,isCrit:false,hitWeakPoint:false}}}],
 applications:[{calculationId:1,frame:10,appliedDamage:150,rawDamage:150},{calculationId:2,frame:11,appliedDamage:30,rawDamage:30},{calculationId:1,frame:7200,appliedDamage:150,rawDamage:150}]};
}
it('counts a full 120s half-open window and never reapplies crit to transformative damage',()=>{
 const r=summarizeSourceMonteTrial(summaryFixture() as any,{index:0,seed:'1'},1);
 expect(r.damage).toBe(180);expect(r.dps).toBe(1.5);expect(r.hits).toBe(2);expect(r.ordinaryHits).toBe(1);expect(r.conditionalHitExpectation).toBe(155);
});
it('refuses early-ended, mismatched seed and missing-native-policy results',()=>{
 for(const change of [(r:any)=>{r.observationWindow.actualEndFrame=7199;},(r:any)=>{r.seed='2';},(r:any)=>{delete r.randomness;}]){
  const r=summaryFixture();change(r);expect(()=>summarizeSourceMonteTrial(r as any,{index:0,seed:'1'},1)).toThrow();
 }
});
it('does not fabricate a conditional expectation for clipped or noninvertible hits',()=>{
 const r=summaryFixture();r.applications[0]!.appliedDamage=120;
 expect(summarizeSourceMonteTrial(r as any,{index:0,seed:'1'},1).conditionalHitExpectation).toBeNull();
 const zero=summaryFixture();zero.calculations[0]!.request.input.critDamage=-1;zero.applications[0]!.appliedDamage=zero.applications[0]!.rawDamage=0;
 expect(summarizeSourceMonteTrial(zero as any,{index:0,seed:'1'},1).conditionalHitExpectation).toBeNull();
});
