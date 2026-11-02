import {sourceHostRunRequestSchema} from '../../../packages/sim-core/src/source-host-wire';
import {sourceMonteJobs,sourceMonteStatistics,type SourceMonteTrial} from './source-host-monte-carlo';
import type {SourceMonteReport,SourceMonteOptions} from './source-host-monte-carlo-client';
export function canonicalMonteJson(value:unknown):string {
 const normalize=(x:any):any=>Array.isArray(x)?x.map(normalize):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,normalize(x[k])])):x;
 return JSON.stringify(normalize(value));
}
export function validateMonteTrial(t:SourceMonteTrial):void {
 if(!t||!Number.isInteger(t.index)||t.index<0||typeof t.seed!=='string'||![t.damage,t.dps,t.durationSeconds,t.elapsedMs].every(Number.isFinite)||t.durationSeconds<=0||t.elapsedMs<0||t.dps!==t.damage/t.durationSeconds||(t.conditionalHitExpectation!==null&&!Number.isFinite(t.conditionalHitExpectation))||![t.hits,t.ordinaryHits,t.crits].every(x=>Number.isInteger(x)&&x>=0)||t.crits>t.ordinaryHits||t.ordinaryHits>t.hits||!(/^[a-f0-9]{64}$/).test(t.eventSha256)||typeof t.sourceCommit!=='string'||!(/^[a-f0-9]{64}$/).test(t.wasmSha256))throw Error('样本统计、身份或事件摘要无效。');
}
/** Validates consistency, not authenticity: compact imported receipts are never newly simulated evidence. */
export function parseSourceMonteResume(raw:unknown):SourceMonteReport {
 const r=structuredClone(raw) as SourceMonteReport;
 if(!r||r.schemaVersion!=='source-host-monte-carlo-v1'||r.seedPolicy!=='canonical-effective-seed-sequence-v1'||r.windowPolicy!=='[0,configuredEndFrame)'||r.randomness!=='native-sampled'||!['running','complete','cancelled','budget','failed'].includes(r.status)||!Array.isArray(r.trials)||!Array.isArray(r.errors)||r.errors.some(e=>typeof e!=='string')||!Number.isFinite(r.elapsedMs)||r.elapsedMs<0)throw Error('无法读取批量续算文件。');
 sourceHostRunRequestSchema.parse(r.request);
 const jobs=sourceMonteJobs(r.options.baseSeed,r.options.count),seen=new Set<number>();
 for(const t of r.trials){validateMonteTrial(t);if(seen.has(t.index)||jobs[t.index]?.seed!==t.seed)throw Error('续算含重复编号或种子不匹配。');seen.add(t.index);const first=r.trials[0]!;if(t.sourceCommit!==first.sourceCommit||t.wasmSha256!==first.wasmSha256||t.durationSeconds!==first.durationSeconds)throw Error('续算混用执行器或时长。');}
 const c=r.counts;if(!c||c.requested!==jobs.length||c.succeeded!==r.trials.length||!Object.values(c).every(x=>Number.isInteger(x)&&x>=0)||c.succeeded+c.failed+c.cancelled+c.notStarted+c.running!==c.requested)throw Error('续算样本计数不一致。');
 if(r.status==='complete'&&r.trials.length!==jobs.length)throw Error('完整标记与样本数不符。');
 const computed=sourceMonteStatistics(r.trials);
 if(canonicalMonteJson(r.statistics?.damage??null)!==canonicalMonteJson(computed?.damage??null)||canonicalMonteJson(r.statistics?.dps??null)!==canonicalMonteJson(computed?.dps??null))throw Error('续算统计与保存样本不一致。');
 r.statistics=computed;return r;
}
export function assertMonteResumeIdentity(r:SourceMonteReport,request:unknown,options:SourceMonteOptions):void {
 if(canonicalMonteJson(r.request)!==canonicalMonteJson(request)||r.options.baseSeed!==options.baseSeed||r.options.count!==options.count)throw Error('续算必须保留原始配置、种子序列和总次数；只有线程数和本段预算可调整。');
}
