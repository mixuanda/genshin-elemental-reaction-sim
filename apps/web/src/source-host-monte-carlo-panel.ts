import {startSourceMonteCarlo,type SourceMonteReport} from './source-host-monte-carlo-client';
import type {SourceHostWorkerRequest} from './source-host-batch';
import {downloadSourceHostJson} from './source-host-calculator';
export function renderSourceMonteCarloPanel(root:HTMLElement,options:{getRequest():SourceHostWorkerRequest;onBusy(busy:boolean):void}) {
 root.innerHTML=`<details class="card"><summary>真实队伍多次模拟</summary>
 <p>每次重新运行当前队伍的完整时长、冷却和能量。使用原生随机暴击，不是期望暴击模式；DPS 分母为完整配置时长（左闭右开），伤害汇总所有目标，主目标选项不筛选本批量总伤害。不同种子初始化流不等于数学独立性的证明。保留固定来源的机制近似。</p>
 <label>次数 <input id="source-monte-count" type="number" min="1" max="10000" value="1000"></label>
 <label>线程 <select id="source-monte-workers"><option>1</option><option selected>2</option></select></label>
 <label>起始种子 <input id="source-monte-seed" value="12021"></label>
 <label>初始能量 <select id="source-monte-energy"><option value="zero">零能</option><option value="full">满能</option></select></label>
 <label>时间预算（秒） <input id="source-monte-budget" type="number" min="1" max="3600" value="900"></label>
 <p>建议先试 2–4 次测量耗时。达到预算会停止并保留已完成样本，未完成批次不标为完整估计。大批量可能耗时数小时。</p>
 <button id="source-monte-run">运行真实批量</button> <button id="source-monte-cancel" disabled>取消批量</button> <button id="source-monte-export" disabled>导出批量证据</button>
 <p id="source-monte-status" role="status"></p><pre id="source-monte-statistics"></pre></details>`;
 const q=<T extends HTMLElement>(id:string)=>root.querySelector<T>(id)!;
 const run=q<HTMLButtonElement>('#source-monte-run'),cancel=q<HTMLButtonElement>('#source-monte-cancel'),exp=q<HTMLButtonElement>('#source-monte-export');
 let handle:ReturnType<typeof startSourceMonteCarlo>|undefined,last:SourceMonteReport|undefined,ownBusy=false;
 const status=q('#source-monte-status'),stats=q('#source-monte-statistics');
 const show=(r:SourceMonteReport)=>{
  last=r;exp.disabled=false;const c=r.counts;
  status.textContent=`${r.status}：完成 ${c.succeeded}/${c.requested}，失败 ${c.failed}，取消 ${c.cancelled}，未开始 ${c.notStarted}，运行 ${c.running}；${(r.elapsedMs/1000).toFixed(1)} 秒。${r.errors.join('；')}${c.succeeded>=2?` 按当前吞吐估计完整批次 ${(r.elapsedMs/c.succeeded*c.requested/3600000).toFixed(2)} 小时（含启动开销，非保证）。`:''}`;
  stats.textContent=JSON.stringify({范围:r.statisticsScope==='complete-batch'?'完整批次':'仅已完成样本，非完整批次估计',DPS:r.statistics?.dps??null,总伤害:r.statistics?.damage??null,暴击条件残差DPS:r.statistics?.conditionalCritResidualDps??null,说明:"条件残差只在已实现命中轨迹上比较暴击期望，不是整队期望模式；暴击触发效果可能改变轨迹。置信区间为样本量至少30时的正态近似，不含机制模型误差。"},null,2);
  if(r.status!=='running'){ownBusy=false;options.onBusy(false);cancel.disabled=true;}
 };
 run.onclick=()=>{
  if(ownBusy)return;
  try{
   const request={...options.getRequest(),stopAtDuration:true,initialEnergy:{mode:q<HTMLSelectElement>('#source-monte-energy').value as 'zero'|'full'}};
   const config={count:q<HTMLInputElement>('#source-monte-count').valueAsNumber,workers:Number(q<HTMLSelectElement>('#source-monte-workers').value),baseSeed:q<HTMLInputElement>('#source-monte-seed').value,budgetMs:q<HTMLInputElement>('#source-monte-budget').valueAsNumber*1000};
   ownBusy=true;options.onBusy(true);cancel.disabled=false;handle=startSourceMonteCarlo(request,config,show);
  }catch(e){ownBusy=false;options.onBusy(false);cancel.disabled=true;status.textContent=String(e);}
 };
 cancel.onclick=()=>handle?.cancel();exp.onclick=()=>{if(last)downloadSourceHostJson(last,'gidps-real-monte-carlo.json');};
 return {cancel:()=>handle?.cancel(),setBusy(busy:boolean){run.disabled=busy;for(const el of root.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input,select'))el.disabled=busy;}};
}
