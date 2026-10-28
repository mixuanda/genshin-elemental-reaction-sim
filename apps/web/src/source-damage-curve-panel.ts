import type {SourceHostResult} from '../../../packages/sim-core/src/source-host-wire';
import {buildSourceDamageCurve,curveSeries,type DamageDimension,SOURCE_CURVE_FPS,cumulativeFrameSteps} from './source-damage-curve';
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const fmt=(v:number)=>v.toLocaleString('zh-CN',{maximumFractionDigits:2});
const dimensions:DamageDimension[]=['actor','source','element','reaction'];
const names={actor:'角色',source:'伤害来源',element:'元素',reaction:'反应'};
const fallback:Record<string,string>={bennett:'班尼特',kaeya:'凯亚',xiangling:'香菱',sucrose:'砂糖',unknown:'未分类 / unknown'};
export function renderSourceDamageCurve(root:HTMLElement,result:SourceHostResult,actorName:(key:string)=>string|undefined=()=>undefined){
 const model=buildSourceDamageCurve(result),label=(d:DamageDimension,k:string)=>k==='unknown'?fallback.unknown!:d==='actor'?(actorName(k)??fallback[k]??k):k;
 const full=curveSeries(model);let mode='damage',startFrame=0,endFrame=model.endFrame,eventPage=0;const filters:Partial<Record<DamageDimension,string>>={};
 root.innerHTML=`<style>[data-curve-breakdowns] section{min-width:0}[data-curve-table]{min-width:0!important;width:100%;table-layout:fixed}[data-curve-table] th,[data-curve-table] td{white-space:normal;overflow-wrap:anywhere;padding:8px 5px;font-size:12px}[data-curve-table] th:first-child{width:40%}[data-curve-range]{display:flex;flex-wrap:wrap;align-items:end;gap:12px}[data-curve-range] input{width:9rem;max-width:100%}[data-curve-methodology]{margin-top:16px}[data-curve-methodology] summary{cursor:pointer}</style><p data-curve-guidance>单次模拟 · 默认1秒汇总。切换曲线或筛选角色，悬浮查看伤害，下方查看角色贡献。</p>
 <div style="display:flex;flex-wrap:wrap;gap:12px"><label>曲线 <select data-curve-mode><option value="damage">1秒汇总</option><option value="events">逐击伤害（帧）</option><option value="cumulative">逐击累计阶梯</option></select></label>${dimensions.map(d=>`<label>${names[d]} <select data-curve-filter="${d}"><option value="">全部</option>${full.breakdown[d].map(g=>`<option value="${esc(g.key)}">${esc(label(d,g.key))}</option>`).join('')}</select></label>`).join('')}</div>
 <p data-curve-range><label>起始帧 <input data-curve-start type="number" min="0" step="1" value="0"></label> <label>截止帧（不含） <input data-curve-end type="number" min="1" step="1" value="${model.endFrame}"></label> <button type="button" data-curve-zoom>应用帧范围</button><span data-curve-range-status></span></p>
 <p data-curve-total></p><div data-curve-graph style="overflow:auto"></div><label data-curve-bin-label>查看1秒汇总箱 <input data-curve-bin type="range" min="0" max="${full.points.length-1}" value="0" style="width:100%"></label><output data-curve-tooltip aria-live="polite"></output>
 <p data-curve-legend>蓝色：所选伤害 · 橙点 E / 紫色方块 Q：技能调用 · 绿色带：已记录增益区间。</p>
 <div data-curve-breakdowns style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px"></div>
 <details data-curve-events><summary>逐击原始事件明细（同帧多击分别保留）</summary><div data-curve-event-table></div><button type="button" data-curve-prev>上一页</button> <button type="button" data-curve-next>下一页</button><span data-curve-event-page></span></details>
 <details data-curve-methodology><summary>数据口径与来源</summary>
 <p>单次真实模拟曲线 · 默认为1秒汇总 [s,s+1)，不是计算精度。来源引擎按60 FPS模拟，保留每笔事件的原始帧号；不代表游戏显示帧率或服务端精度，也不代表每帧都有伤害。截止帧不计入，空档为零，持续伤害按实际 tick。不是多次模拟平均曲线；现有批量摘要未保存每秒时序。</p>
 <p>蓝线／点：所选伤害，累计采用事件阶梯而非平滑插值；橙点 E / 紫色方块 Q：实际成功调用；绿色带：已记录班尼特攻击加成／翠绿之影减抗区间。标记保留全队原事件。增益到期后，已保存旧快照仍可能影响后续伤害，阴影不是重新计算的增伤量。</p>
 <p>四个表是同一份伤害的不同切面，不能相加。增幅反应归类整次放大命中，不再另加“反应伤害”。角色归属来自该实际命中的计算回执，保留后台伤害；缺归属显示 unknown，绝不按站场角色猜。</p>
 <p>区间只标注有明确日志和期限的上述效果；其他增益未完整标注。${model.unclassifiedBuffLogs?`${model.unclassifiedBuffLogs} 条缺少目标/期限/前序状态的区间日志未绘制。`:''}</p></details>`;
 const graph=root.querySelector<HTMLElement>('[data-curve-graph]')!,tooltip=root.querySelector<HTMLOutputElement>('[data-curve-tooltip]')!,slider=root.querySelector<HTMLInputElement>('[data-curve-bin]')!;
 let series=full;
 const show=(index:number)=>{
  const p=series.points[Math.max(0,Math.min(series.points.length-1,index))]!;
  const events=model.markers.filter(m=>m.frame>=p.startSeconds*60&&m.frame<p.endSeconds*60).map(m=>`${actorName(m.actor)??fallback[m.actor]??m.actor} ${m.action} @${(m.frame/60).toFixed(2)}s`);
  const buffs=[...new Set(model.buffs.filter(b=>b.startFrame<p.endSeconds*60&&b.endFrame>p.startSeconds*60).map(b=>b.label))];
  tooltip.textContent=`[${p.startSeconds}, ${p.endSeconds}) 秒：伤害 ${fmt(p.damage)}，累计 ${fmt(p.cumulative)}。${events.length?'技能：'+events.join('；')+'。':''}${buffs.length?'该箱内有记录区间：'+buffs.join('；'):''}`;
 };
 const eventTable=()=>{
  const hits=series.events.filter(h=>h.frame>=startFrame&&h.frame<endFrame),pages=Math.max(1,Math.ceil(hits.length/50));eventPage=Math.min(eventPage,pages-1);
  root.querySelector<HTMLElement>('[data-curve-event-table]')!.innerHTML=`<div style="overflow:auto"><table><thead><tr><th>事件</th><th>秒 / 原始帧</th><th>角色</th><th>来源</th><th>元素 / 反应</th><th>伤害</th></tr></thead><tbody>${hits.slice(eventPage*50,eventPage*50+50).map(h=>`<tr data-event-id="${h.id}" data-event-frame="${h.frame}"><td>${h.id}</td><td>${(h.frame/SOURCE_CURVE_FPS).toFixed(6)}s / ${h.frame}f</td><td>${esc(label('actor',h.actor))}</td><td>${esc(h.source)} · ${esc(h.ability)}</td><td>${esc(h.element)} / ${esc(h.reaction)}</td><td>${fmt(h.damage)}</td></tr>`).join('')}</tbody></table></div>`;
  root.querySelector<HTMLElement>('[data-curve-event-page]')!.textContent=` ${eventPage+1}/${pages} 页 · ${hits.length} 笔 · 每页至多50笔，数值显示四舍五入，原始精度保留在导出。`;
  root.querySelector<HTMLButtonElement>('[data-curve-prev]')!.disabled=eventPage===0;root.querySelector<HTMLButtonElement>('[data-curve-next]')!.disabled=eventPage===pages-1;
 };
 const draw=()=>{
  series=curveSeries(model,filters);const duration=model.endFrame/60,W=960,left=76,right=22,top=30,height=220,bottom=top+height;
  const viewStart=startFrame/SOURCE_CURVE_FPS,viewEnd=endFrame/SOURCE_CURVE_FPS;
  const x=(seconds:number)=>left+(W-left-right)*(seconds-viewStart)/(viewEnd-viewStart);
  const visibleEvents=series.events.filter(h=>h.frame>=startFrame&&h.frame<endFrame);
  const viewBins=series.points.filter(p=>p.startSeconds<viewEnd&&p.endSeconds>viewStart);
  const max=Math.max(1,...(mode==='events'?visibleEvents.map(h=>h.damage):mode==='damage'?viewBins.map(p=>p.damage):[series.events.filter(h=>h.frame<endFrame).reduce((sum,h)=>sum+h.damage,0)])),y=(v:number)=>bottom-v/max*height;
  const steps=cumulativeFrameSteps(series.events,startFrame,endFrame).map(p=>[x(p.frame/SOURCE_CURVE_FPS),y(p.value)]);
  const points=mode==='damage'?viewBins.flatMap(p=>[[x(Math.max(viewStart,p.startSeconds)),y(p.damage)],[x(Math.min(viewEnd,p.endSeconds)),y(p.damage)]]):steps;
  const buffRows=[...new Set(model.buffs.map(b=>b.label))];const bandStart=bottom+75,H=bandStart+buffRows.length*24+30;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="单次${mode==='damage'?'1秒汇总':mode==='events'?'逐击':'逐击累计阶梯'}伤害曲线" style="width:100%;min-width:620px;background:#101b2d;border-radius:8px;color:#e2e8f0" data-curve-svg>
   ${[0,.25,.5,.75,1].map(t=>`<line x1="${left}" x2="${W-right}" y1="${y(t*max)}" y2="${y(t*max)}" stroke="#344155"/><text x="${left-8}" y="${y(t*max)+4}" fill="#cbd5e1" text-anchor="end" font-size="12">${fmt(t*max)}</text>`).join('')}
   <text x="${left}" y="18" fill="#e2e8f0" font-size="13">${mode==='damage'?'伤害 / 1秒汇总':mode==='events'?'每次实际命中伤害（60 FPS 模拟）':'累计伤害（实际事件阶梯）'}</text>
   ${mode==='events'?visibleEvents.map(h=>`<line x1="${x(h.frame/60)}" x2="${x(h.frame/60)}" y1="${bottom}" y2="${y(h.damage)}" stroke="#5bbaff"/><circle data-curve-event-point="${h.id}" cx="${x(h.frame/60)}" cy="${y(h.damage)}" r="3" fill="#5bbaff"><title>${h.frame}f / ${(h.frame/60).toFixed(6)}s · ${esc(label('actor',h.actor))} · ${esc(h.ability)} · ${fmt(h.damage)}</title></circle>`).join(''):`<polyline data-curve-step fill="none" stroke="#5bbaff" stroke-width="2" points="${points.map(p=>p.join(',')).join(' ')}"/>`}
   ${Array.from({length:7},(_,i)=>viewStart+i*(viewEnd-viewStart)/6).map(t=>`<text x="${x(t)}" y="${bottom+21}" fill="#cbd5e1" text-anchor="middle" font-size="12">${fmt(t)}s</text>`).join('')}
   <text x="${left}" y="${bottom+44}" fill="#cbd5e1" font-size="12">E / Q 实际调用</text>
   ${model.markers.filter(m=>m.frame>=startFrame&&m.frame<endFrame).map(m=>`${m.action==='E'?`<circle cx="${x(m.frame/60)}" cy="${bottom+55}" r="3" fill="#f6ad55">`:`<rect x="${x(m.frame/60)-3}" y="${bottom+52}" width="6" height="6" fill="#c4a0ff">`}<title>${esc(actorName(m.actor)??fallback[m.actor]??m.actor)} ${m.action} ${(m.frame/60).toFixed(2)}s · invocation ${m.id}</title>${m.action==='E'?'</circle>':'</rect>'}`).join('')}
   ${buffRows.map((row,i)=>`<text x="${left}" y="${bandStart+i*24}" fill="#d1fae5" font-size="10">${esc(row)}</text>${model.buffs.filter(b=>b.label===row&&b.startFrame<endFrame&&b.endFrame>startFrame).map(b=>`<rect x="${x(Math.max(startFrame,b.startFrame)/60)}" y="${bandStart+i*24+3}" width="${Math.max(.3,x(Math.min(endFrame,b.endFrame)/60)-x(Math.max(startFrame,b.startFrame)/60))}" height="8" fill="#48bd94"><title>${esc(b.label)} [${(b.startFrame/60).toFixed(3)}, ${(b.endFrame/60).toFixed(3)})s；日志 ${b.logIndices.join(',')}</title></rect>`).join('')}`).join('')}
   </svg>`;
  graph.innerHTML=svg;
  root.querySelector<HTMLElement>('[data-curve-total]')!.textContent=`窗口内团队总伤害 ${fmt(full.total)}；筛选后 ${fmt(series.total)}（${series.selectedHits} 击），累计终值 ${fmt(series.points.at(-1)?.cumulative??0)}。占比以筛选后总伤害为分母。`;
  root.querySelector<HTMLElement>('[data-curve-breakdowns]')!.innerHTML=dimensions.map(d=>`<section><h4>${names[d]}贡献</h4><table data-curve-table="${d}"><thead><tr><th>分类</th><th>伤害</th><th>占比</th></tr></thead><tbody>${series.breakdown[d].map(g=>`<tr data-group="${esc(g.key)}" data-damage="${g.damage}"><td>${esc(label(d,g.key))}</td><td>${fmt(g.damage)}</td><td>${fmt(g.share*100)}%</td></tr>`).join('')}</tbody></table></section>`).join('');
  graph.querySelector<SVGElement>('svg')!.onpointermove=e=>{
   const bounds=graph.querySelector('svg')!.getBoundingClientRect(),seconds=viewStart+((e.clientX-bounds.left)/bounds.width*W-left)/(W-left-right)*(viewEnd-viewStart);
   if(mode==='damage'){const index=Math.max(0,Math.min(series.points.length-1,Math.floor(seconds)));slider.value=String(index);show(index);return;}
   const frame=Math.max(startFrame,Math.min(endFrame-1,Math.floor(seconds*SOURCE_CURVE_FPS))),hits=visibleEvents.filter(h=>h.frame===frame);
   tooltip.textContent=`${frame}f / ${(frame/SOURCE_CURVE_FPS).toFixed(6)}s：${hits.length?hits.map(h=>`#${h.id} ${label('actor',h.actor)} ${h.source} ${h.ability} ${fmt(h.damage)}`).join('；'):'此帧无伤害事件（0），不是遗漏。'}`;
  };
  root.querySelector<HTMLElement>('[data-curve-bin-label]')!.hidden=mode!=='damage';
  if(mode==='damage')show(Number(slider.value));else tooltip.textContent=`当前 [${startFrame}, ${endFrame}) 帧，悬浮查看对应帧；下方明细保留同帧的每笔事件。`;if(root.querySelector<HTMLDetailsElement>('[data-curve-events]')!.open)eventTable();
 };
 slider.oninput=()=>show(Number(slider.value));root.querySelector<HTMLSelectElement>('[data-curve-mode]')!.onchange=e=>{mode=(e.target as HTMLSelectElement).value;draw();};
 for(const select of root.querySelectorAll<HTMLSelectElement>('[data-curve-filter]'))select.onchange=()=>{filters[select.dataset.curveFilter as DamageDimension]=select.value;draw();};
 root.querySelector<HTMLButtonElement>('[data-curve-zoom]')!.onclick=()=>{
  const a=root.querySelector<HTMLInputElement>('[data-curve-start]')!.valueAsNumber,b=root.querySelector<HTMLInputElement>('[data-curve-end]')!.valueAsNumber;
  const status=root.querySelector<HTMLElement>('[data-curve-range-status]')!;
  if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b>model.endFrame||a>=b){status.textContent=`请输入0至${model.endFrame}内、起始小于截止的整数帧。`;return;}
  startFrame=a;endFrame=b;eventPage=0;status.textContent=` [${a}, ${b})帧；贡献表仍统计完整窗口筛选结果。`;draw();
 };
 root.querySelector<HTMLDetailsElement>('[data-curve-events]')!.ontoggle=()=>{if(root.querySelector<HTMLDetailsElement>('[data-curve-events]')!.open)eventTable();};
 root.querySelector<HTMLButtonElement>('[data-curve-prev]')!.onclick=()=>{eventPage--;eventTable();};root.querySelector<HTMLButtonElement>('[data-curve-next]')!.onclick=()=>{eventPage++;eventTable();};
 draw();
}
