import {sourceHostSeedIdentity,assertDistinctSourceHostStreams} from '../../../packages/sim-core/src/source-host-randomness';
import type {SourceHostResult} from '../../../packages/sim-core/src/source-host-wire';
import {batchStatistics} from './batch-statistics';
export interface SourceMonteJob {index:number;seed:string}
export interface SourceMonteTrial {index:number;seed:string;damage:number;dps:number;durationSeconds:number;hits:number;ordinaryHits:number;crits:number;conditionalHitExpectation:number|null;elapsedMs:number;eventSha256:string;sourceCommit:string;wasmSha256:string}
export function sourceMonteJobs(baseSeed:string,count:number):SourceMonteJob[]{
 if(!Number.isInteger(count)||count<1||count>10000)throw Error('真实批量次数须为 1–10000。');
 const base=BigInt(sourceHostSeedIdentity(baseSeed).effectiveSeed);
 const jobs=Array.from({length:count},(_,index)=>({index,seed:(((base-1n+BigInt(index))%2147483646n)+1n).toString()}));
 assertDistinctSourceHostStreams(jobs.map(j=>j.seed));return jobs;
}
export function summarizeSourceMonteTrial(r:SourceHostResult,job:SourceMonteJob,elapsedMs:number):Omit<SourceMonteTrial,'eventSha256'>{
 const w=r.observationWindow;
 if(!w||w.endReason!=='duration'||w.actualEndFrame!==w.configuredEndFrame||w.configuredEndFrame<=0)throw Error('批量样本未完成完整配置时长，不能作为固定窗口 DPS 样本。');
 if(r.seed!==job.seed||r.randomness?.critPolicy!=='native-seeded'||!r.executionArtifact)throw Error('批量样本缺少匹配的原生种子、暴击政策或执行器身份。');
 const rows=new Map(r.calculations.map(c=>[c.request.id,c.request]));let damage=0,expectation=0,known=true,hits=0,ordinaryHits=0,crits=0;
 for(const a of r.applications){if(a.frame<0||a.frame>=w.configuredEndFrame)continue;damage+=a.appliedDamage;hits++;const q=rows.get(a.calculationId);
  if(q?.kind!=='damage'||a.appliedDamage!==a.rawDamage){known=false;continue;}
  if(q.damageCategory!=='ordinary'){expectation+=a.rawDamage;continue;}
  ordinaryHits++;if(q.input.isCrit)crits++;
  const p=q.input.hitWeakPoint?1:Math.min(1,Math.max(0,q.input.critRate));
  const observedCritMultiplier=q.input.isCrit?1+q.input.critDamage:1;
  if(observedCritMultiplier<=0){known=false;continue;}
  expectation+=a.rawDamage/observedCritMultiplier*(1+p*q.input.critDamage);
 }
 if(!Number.isFinite(damage))throw Error('批量伤害不是有限数值。');
 return {...job,damage,dps:damage/(w.configuredEndFrame/60),durationSeconds:w.configuredEndFrame/60,hits,ordinaryHits,crits,conditionalHitExpectation:known&&Number.isFinite(expectation)?expectation:null,elapsedMs,sourceCommit:r.sourceCommit,wasmSha256:r.executionArtifact.wasmSha256};
}
export function sourceMonteStatistics(trials:readonly SourceMonteTrial[]){
 if(!trials.length)return null;
 const ordered=[...trials].sort((a,b)=>a.index-b.index);
 const statistics=(values:number[])=>{const s=batchStatistics(values);return {...s,standardError:values.length>1?s.sampleStandardDeviation/Math.sqrt(values.length):null};};
 return {damage:statistics(ordered.map(t=>t.damage)),dps:statistics(ordered.map(t=>t.dps)),sampleCount:ordered.length,
  conditionalCritResidualDps:ordered.every(t=>t.conditionalHitExpectation!==null)?statistics(ordered.map(t=>(t.damage-t.conditionalHitExpectation!)/t.durationSeconds)):null};
}
