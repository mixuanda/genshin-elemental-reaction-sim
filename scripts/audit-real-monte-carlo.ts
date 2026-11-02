/** Audit exported compact real-source batches without rerunning native simulation. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import type {SourceMonteReport} from '../apps/web/src/source-host-monte-carlo-client';
import {sourceMonteJobs} from '../apps/web/src/source-host-monte-carlo';
const directory=process.argv[2];if(!directory)throw Error('Usage: audit-real-monte-carlo <evidence-directory> [prior-vv-capture]');
const read=(name:string)=>JSON.parse(readFileSync(resolve(directory,`${name}.json`),'utf8')) as SourceMonteReport;
const checks:Array<Record<string,unknown>>=[];
const near=(actual:number,expected:number,label:string)=>assert(Math.abs(actual-expected)<=Math.max(1e-9,Math.abs(expected)*1e-12),`${label}: ${actual} != ${expected}`);
for(const name of ['pilot-serial','pilot-parallel','crit-zero','crit-full','cancelled','scale-1000','invalid-config']){
 if(!existsSync(resolve(directory,`${name}.json`)))continue;
 const r=read(name),c=r.counts;
 assert.equal(c.requested,c.succeeded+c.failed+c.cancelled+c.notStarted+c.running);
 assert.equal(c.succeeded,r.trials.length);assert.equal(c.running,0);
 assert.equal(r.statisticsScope,r.status==='complete'?'complete-batch':'completed-samples-only');
 const jobs=sourceMonteJobs(r.options.baseSeed,r.options.count);const seen=new Set<number>();
 let mean=0,m2=0,n=0;
 for(const t of r.trials){
  assert(!seen.has(t.index));seen.add(t.index);assert.equal(t.seed,jobs[t.index]!.seed);
  assert.equal(t.durationSeconds,120);assert.equal(t.dps,t.damage/120);
  n++;const delta=t.dps-mean;mean+=delta/n;m2+=delta*(t.dps-mean);
 }
 if(n){near(r.statistics!.dps.meanDamage,mean,`${name} mean`);near(r.statistics!.dps.sampleStandardDeviation,n>1?Math.sqrt(m2/(n-1)):0,`${name} SD`);
  if(n>1)near(r.statistics!.dps.standardError!,Math.sqrt(m2/(n-1)/n),`${name} SEM`);
  if(n<30)assert.equal(r.statistics!.dps.meanConfidenceInterval,null);
  else {const ci=r.statistics!.dps.meanConfidenceInterval!;near(ci.low,mean-1.96*Math.sqrt(m2/(n-1)/n),'CI low');near(ci.high,mean+1.96*Math.sqrt(m2/(n-1)/n),'CI high');}
 }else assert.equal(r.statistics,null);
 if(name==='crit-zero'||name==='crit-full'){const t=r.trials[0]!;assert.equal(t.crits,name==='crit-zero'?0:t.ordinaryHits);near(t.damage,t.conditionalHitExpectation!,`${name} conditional expectation`);}
 checks.push({name,status:r.status,counts:c,elapsedMs:r.elapsedMs,dps:r.statistics?.dps??null});
}
const serial=read('pilot-serial'),parallel=read('pilot-parallel');
const stable=(r:SourceMonteReport)=>r.trials.map(({elapsedMs,...trial})=>trial);
assert.deepEqual(stable(serial),stable(parallel));assert.deepEqual(serial.statistics,parallel.statistics);
const comparisons=[];
if(process.argv[3]){
 const archived=JSON.parse(readFileSync(process.argv[3],'utf8'));
 for(const t of serial.trials.slice(0,2)){
  const r=archived.runs.find((x:any)=>x.scenario==='full'&&x.result.seed===t.seed).result;
  const damage=r.applications.filter((a:any)=>a.frame>=0&&a.frame<7200).reduce((sum:number,a:any)=>sum+a.appliedDamage,0);
  near(t.damage,damage,'prior exact trajectory damage');
  const hash=createHash('sha256').update(JSON.stringify({applications:r.applications,energy:r.energyApplications,actions:r.abilityInvocations,randomness:r.randomness})).digest('hex');
  assert.equal(t.eventSha256,hash);
  comparisons.push({seed:t.seed,damage,eventSha256:hash,unchangedFromPriorCapture:true});
 }
}
const throughput={pilotSerialSeconds:serial.elapsedMs/1000,pilotParallelSeconds:parallel.elapsedMs/1000,
 estimated1000Seconds:parallel.elapsedMs/1000/parallel.trials.length*1000,estimated10000Seconds:parallel.elapsedMs/1000/parallel.trials.length*10000,
 caveat:'Linear pilot extrapolation including startup cost; not a completion claim or guaranteed runtime.'};
const resourcePath=resolve(directory,'scale-resources.json');
const resources=existsSync(resourcePath)?JSON.parse(readFileSync(resourcePath,'utf8')) as Array<{at:string;memoryBytes:number}>:[];
const cleanupPath=resolve(directory,'navigation-cleanup.json');
if(existsSync(cleanupPath)){const c=JSON.parse(readFileSync(cleanupPath,'utf8'));assert.equal(c.created,c.terminated);assert(c.created>0);}
const report={checks,serialParallelPerTrialIdentical:true,comparisons,throughput,
 resources:{samples:resources.length,peakContainerMemoryBytes:resources.length?Math.max(...resources.map(r=>r.memoryBytes)):null}};
writeFileSync(resolve(directory,'audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
