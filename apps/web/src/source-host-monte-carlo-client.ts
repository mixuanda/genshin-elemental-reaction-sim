import type { SourceHostWorkerRequest } from './source-host-batch';
import type { SourceHostWorkerMessage } from './source-host-worker-client';
import { sourceMonteJobs, sourceMonteStatistics, type SourceMonteTrial } from './source-host-monte-carlo';

export interface SourceMonteOptions { count:number; workers:number; baseSeed:string; budgetMs:number }
export interface SourceMonteReport {
 schemaVersion:'source-host-monte-carlo-v1'; request:SourceHostWorkerRequest; options:SourceMonteOptions;
 status:'running'|'complete'|'cancelled'|'budget'|'failed'; elapsedMs:number;
 counts:{requested:number;succeeded:number;failed:number;cancelled:number;notStarted:number;running:number};
 errors:string[]; trials:SourceMonteTrial[]; statistics:ReturnType<typeof sourceMonteStatistics>;
 statisticsScope:'complete-batch'|'completed-samples-only';
 seedPolicy:'canonical-effective-seed-sequence-v1'; windowPolicy:'[0,configuredEndFrame)';
 randomness:'native-sampled';
}
export type MonteWorker = Pick<Worker,'postMessage'|'terminate'|'onmessage'|'onerror'|'onmessageerror'>;
/** Each lane loads one fixed WASM; every trial starts a fresh native core and formula resolver. */
export function startSourceMonteCarlo(request:SourceHostWorkerRequest, options:SourceMonteOptions,
 onUpdate:(report:SourceMonteReport)=>void,
 factory:()=>MonteWorker=()=>new Worker(new URL('./source-host-worker.ts',import.meta.url),{type:'module'})) {
 const jobs=sourceMonteJobs(options.baseSeed,options.count);
 if(!Number.isInteger(options.workers)||options.workers<1||options.workers>2)throw Error('真实来源并行数须为 1 或 2，避免过量占用内存。');
 if(!Number.isFinite(options.budgetMs)||options.budgetMs<100||options.budgetMs>3600000)throw Error('批量时间预算须为 0.1 秒至 1 小时。');
 if(request.jobs||request.startupJobs||request.reexecutionTarget||request.monteCarloJobs)throw Error('批量输入不能包含嵌套任务。');
 request=structuredClone(request);options={...options};
 const states:Array<'pending'|'running'|'success'|'failed'|'cancelled'>=jobs.map(()=> 'pending');
 const trials:SourceMonteTrial[]=[],errors:string[]=[],lanes:Array<{worker:MonteWorker; indices:number[]; next:number; active:number|null; done:boolean}>=[];
 let status:SourceMonteReport['status']='running',timer:ReturnType<typeof setTimeout>,started=performance.now();
 let resolveDone!:(report:SourceMonteReport)=>void;
 const done=new Promise<SourceMonteReport>(resolve=>{resolveDone=resolve;});
 const report=():SourceMonteReport=>({schemaVersion:'source-host-monte-carlo-v1',request,options,status,elapsedMs:performance.now()-started,
 counts:{requested:jobs.length,succeeded:trials.length,failed:states.filter(s=>s==='failed').length,cancelled:states.filter(s=>s==='cancelled').length,notStarted:states.filter(s=>s==='pending').length,running:states.filter(s=>s==='running').length},
 errors:[...errors],trials:[...trials].sort((a,b)=>a.index-b.index),statistics:sourceMonteStatistics(trials),statisticsScope:status==='complete'?'complete-batch':'completed-samples-only',seedPolicy:'canonical-effective-seed-sequence-v1',windowPolicy:'[0,configuredEndFrame)',randomness:'native-sampled'});
 const publish=()=>onUpdate(report());
 const finish=(reason:SourceMonteReport['status'])=>{
  if(status!=='running')return;status=reason;clearTimeout(timer);
  for(let i=0;i<states.length;i++)if(states[i]==='running')states[i]='cancelled';
  for(const lane of lanes){lane.worker.onmessage=null;lane.worker.onerror=null;lane.worker.onmessageerror=null;lane.worker.terminate();}
  const final=report();onUpdate(final);resolveDone(final);
 };
 const fail=(message:string,active:number|null=null)=>{
  if(status!=='running')return;errors.push(message);if(active!==null)states[active]='failed';finish('failed');
 };
 timer=setTimeout(()=>finish('budget'),options.budgetMs);
 try {
  const n=Math.min(options.workers,jobs.length);
  for(let i=0;i<n;i++){
   const lane={worker:factory(),indices:jobs.filter(j=>j.index%n===i).map(j=>j.index),next:0,active:null as number|null,done:false};lanes.push(lane);
   lane.worker.onmessage=event=>{
    if(status!=='running')return;
    try {
     const m=event.data as SourceHostWorkerMessage;
     if(m.type==='progress')return;
     if(m.type==='error'){fail(m.message,lane.active);return;}
     if(m.type==='monte-start'){
      if(lane.active!==null||lane.indices[lane.next]!==m.index||jobs[m.index]?.seed!==m.seed)throw Error('Worker 起始样本顺序或种子不一致。');
      lane.active=m.index;states[m.index]='running';publish();return;
     }
     if(m.type==='monte-trial'){
      const t=m.trial;
      if(t.index!==lane.active||jobs[t.index]?.seed!==t.seed||states[t.index]!=='running')throw Error('Worker 返回重复、越界或不匹配样本。');
      if(![t.damage,t.dps,t.durationSeconds,t.elapsedMs].every(Number.isFinite)||t.durationSeconds<=0||t.dps!==t.damage/t.durationSeconds||(t.conditionalHitExpectation!==null&&!Number.isFinite(t.conditionalHitExpectation))||!(/^[a-f0-9]{64}$/).test(t.eventSha256))throw Error('样本统计或事件摘要无效。');
      const first=trials[0];if(first&&(first.wasmSha256!==t.wasmSha256||first.sourceCommit!==t.sourceCommit||first.durationSeconds!==t.durationSeconds))throw Error('批量混用了不同执行器或时长。');
      trials.push(t);states[t.index]='success';lane.active=null;lane.next++;publish();return;
     }
     if(m.type==='monte-done'){
      if(lane.active!==null||lane.next!==lane.indices.length||lane.done)throw Error('Worker 提前或重复结束。');
      lane.done=true;lane.worker.terminate();if(lanes.length===n&&lanes.every(l=>l.done))finish('complete');return;
     }
     throw Error('批量 Worker 返回非批量消息。');
    }catch(e){fail(String(e),lane.active);}
   };
   lane.worker.onerror=e=>{e.preventDefault();fail(e.message||'Worker 异常',lane.active);};
   lane.worker.onmessageerror=()=>fail('Worker 消息无法读取。',lane.active);
   lane.worker.postMessage({...request,monteCarloJobs:lane.indices.map(index=>jobs[index]!)});
  }
 } catch(e){fail(String(e));}
 publish();return {done,cancel:()=>finish('cancelled')};
}
