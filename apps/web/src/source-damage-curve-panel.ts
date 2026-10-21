import type {SourceHostResult} from '../../../packages/sim-core/src/source-host-wire';
import {buildSourceDamageCurve,curveSeries,type DamageDimension} from './source-damage-curve';
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const fmt=(v:number)=>v.toLocaleString('zh-CN',{maximumFractionDigits:2});
const dimensions:DamageDimension[]=['actor','source','element','reaction'];
const names={actor:'角色',source:'伤害来源',element:'元素',reaction:'反应'};
const fallback:Record<string,string>={bennett:'班尼特',kaeya:'凯亚',xiangling:'香菱',sucrose:'砂糖',unknown:'未分类 / unknown'};
export function renderSourceDamageCurve(root:HTMLElement,result:SourceHostResult,actorName:(key:string)=>string|undefined=()=>undefined){
 const model=buildSourceDamageCurve(result),label=(d:DamageDimension,k:string)=>k==='unknown'?fallback.unknown!:d==='actor'?(actorName(k)??fallback[k]??k):k;
 const full=curveSeries(model);let mode='damage';const filters:Partial<Record<DamageDimension,string>>={};
 root.innerHTML=`<style>[data-curve-breakdowns] section{min-width:0}[data-curve-table]{min-width:0!important;width:100%;table-layout:fixed}[data-curve-table] th,[data-curve-table] td{white-space:normal;overflow-wrap:anywhere;padding:8px 5px;font-size:12px}[data-curve-table] th:first-child{width:40%}</style><p>单次真实模拟曲线 · 1秒半开分箱 [s,s+1)，截止帧不计入。所有目标合计，空档为零。不是多次模拟平均曲线；现有批量摘要未保存每秒时序。</p>
 <div style="display:flex;flex-wrap:wrap;gap:12px"><label>曲线 <select data-curve-mode><option value="damage">每秒分箱伤害</option><option value="cumulative">累计伤害</option></select></label>${dimensions.map(d=>`<label>${names[d]} <select data-curve-filter="${d}"><option value="">全部</option>${full.breakdown[d].map(g=>`<option value="${esc(g.key)}">${esc(label(d,g.key))}</option>`).join('')}</select></label>`).join('')}</div>
 <p data-curve-total></p><div data-curve-graph style="overflow:auto"></div><label>查看时间箱 <input data-curve-bin type="range" min="0" max="${full.points.length-1}" value="0" style="width:100%"></label><output data-curve-tooltip aria-live="polite"></output>
 <p>蓝线：所选伤害；橙点 E / 紫色方块 Q：实际成功调用；绿色带：已记录班尼特攻击加成／翠绿之影减抗区间。标记保留全队原事件。增益到期后，已保存旧快照仍可能影响后续伤害，阴影不是重新计算的增伤量。</p>
 <div data-curve-breakdowns style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px"></div>
 <p>四个表是同一份伤害的不同切面，不能相加。增幅反应归类整次放大命中，不再另加“反应伤害”。角色归属来自该实际命中的计算回执，保留后台伤害；缺归属显示 unknown，绝不按站场角色猜。</p>
 <p>区间只标注有明确日志和期限的上述效果；其他增益未完整标注。${model.unclassifiedBuffLogs?`${model.unclassifiedBuffLogs} 条缺少目标/期限/前序状态的区间日志未绘制。`:''}</p>`;
 const graph=root.querySelector<HTMLElement>('[data-curve-graph]')!,tooltip=root.querySelector<HTMLOutputElement>('[data-curve-tooltip]')!,slider=root.querySelector<HTMLInputElement>('[data-curve-bin]')!;
 let series=full;
 const show=(index:number)=>{
  const p=series.points[Math.max(0,Math.min(series.points.length-1,index))]!;
  const events=model.markers.filter(m=>m.frame>=p.startSeconds*60&&m.frame<p.endSeconds*60).map(m=>`${actorName(m.actor)??fallback[m.actor]??m.actor} ${m.action} @${(m.frame/60).toFixed(2)}s`);
  const buffs=[...new Set(model.buffs.filter(b=>b.startFrame<p.endSeconds*60&&b.endFrame>p.startSeconds*60).map(b=>b.label))];
  tooltip.textContent=`[${p.startSeconds}, ${p.endSeconds}) 秒：伤害 ${fmt(p.damage)}，累计 ${fmt(p.cumulative)}。${events.length?'技能：'+events.join('；')+'。':''}${buffs.length?'该箱内有记录区间：'+buffs.join('；'):''}`;
 };
 const draw=()=>{
  series=curveSeries(model,filters);const duration=model.endFrame/60,W=960,left=76,right=22,top=30,height=220,bottom=top+height;
  const x=(seconds:number)=>left+(W-left-right)*seconds/duration;
  const max=Math.max(1,...series.points.map(p=>mode==='damage'?p.damage:p.cumulative)),y=(v:number)=>bottom-v/max*height;
  const points=mode==='damage'?series.points.flatMap(p=>[[x(p.startSeconds),y(p.damage)],[x(p.endSeconds),y(p.damage)]]):[[left,bottom],...series.points.map(p=>[x(p.endSeconds),y(p.cumulative)])];
  const buffRows=[...new Set(model.buffs.map(b=>b.label))];const bandStart=bottom+75,H=bandStart+buffRows.length*24+30;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="单次${mode==='damage'?'每秒分箱':'累计'}伤害曲线" style="width:100%;min-width:620px;background:#101b2d;border-radius:8px;color:#e2e8f0" data-curve-svg>
   ${[0,.25,.5,.75,1].map(t=>`<line x1="${left}" x2="${W-right}" y1="${y(t*max)}" y2="${y(t*max)}" stroke="#344155"/><text x="${left-8}" y="${y(t*max)+4}" fill="#cbd5e1" text-anchor="end" font-size="12">${fmt(t*max)}</text>`).join('')}
   <text x="${left}" y="18" fill="#e2e8f0" font-size="13">${mode==='damage'?'伤害 / 1秒箱（末箱可不足1秒）':'累计伤害'}</text>
   <polyline fill="none" stroke="#5bbaff" stroke-width="2" points="${points.map(p=>p.join(',')).join(' ')}"/>
   ${Array.from({length:7},(_,i)=>i*duration/6).map(t=>`<text x="${x(t)}" y="${bottom+21}" fill="#cbd5e1" text-anchor="middle" font-size="12">${fmt(t)}s</text>`).join('')}
   <text x="${left}" y="${bottom+44}" fill="#cbd5e1" font-size="12">E / Q 实际调用</text>
   ${model.markers.map(m=>`${m.action==='E'?`<circle cx="${x(m.frame/60)}" cy="${bottom+55}" r="3" fill="#f6ad55">`:`<rect x="${x(m.frame/60)-3}" y="${bottom+52}" width="6" height="6" fill="#c4a0ff">`}<title>${esc(actorName(m.actor)??fallback[m.actor]??m.actor)} ${m.action} ${(m.frame/60).toFixed(2)}s · invocation ${m.id}</title>${m.action==='E'?'</circle>':'</rect>'}`).join('')}
   ${buffRows.map((row,i)=>`<text x="${left}" y="${bandStart+i*24}" fill="#d1fae5" font-size="10">${esc(row)}</text>${model.buffs.filter(b=>b.label===row).map(b=>`<rect x="${x(b.startFrame/60)}" y="${bandStart+i*24+3}" width="${Math.max(.3,x(b.endFrame/60)-x(b.startFrame/60))}" height="8" fill="#48bd94"><title>${esc(b.label)} [${(b.startFrame/60).toFixed(3)}, ${(b.endFrame/60).toFixed(3)})s；日志 ${b.logIndices.join(',')}</title></rect>`).join('')}`).join('')}
   </svg>`;
  graph.innerHTML=svg;
  root.querySelector<HTMLElement>('[data-curve-total]')!.textContent=`窗口内团队总伤害 ${fmt(full.total)}；筛选后 ${fmt(series.total)}（${series.selectedHits} 击），累计终值 ${fmt(series.points.at(-1)?.cumulative??0)}。占比以筛选后总伤害为分母。`;
  root.querySelector<HTMLElement>('[data-curve-breakdowns]')!.innerHTML=dimensions.map(d=>`<section><h4>${names[d]}贡献</h4><table data-curve-table="${d}"><thead><tr><th>分类</th><th>伤害</th><th>占比</th></tr></thead><tbody>${series.breakdown[d].map(g=>`<tr data-group="${esc(g.key)}" data-damage="${g.damage}"><td>${esc(label(d,g.key))}</td><td>${fmt(g.damage)}</td><td>${fmt(g.share*100)}%</td></tr>`).join('')}</tbody></table></section>`).join('');
  graph.querySelector<SVGElement>('svg')!.onpointermove=e=>{const bounds=graph.querySelector('svg')!.getBoundingClientRect();const seconds=((e.clientX-bounds.left)/bounds.width*W-left)/(W-left-right)*duration;const index=Math.max(0,Math.min(series.points.length-1,Math.floor(seconds)));slider.value=String(index);show(index);};
  show(Number(slider.value));
 };
 slider.oninput=()=>show(Number(slider.value));root.querySelector<HTMLSelectElement>('[data-curve-mode]')!.onchange=e=>{mode=(e.target as HTMLSelectElement).value;draw();};
 for(const select of root.querySelectorAll<HTMLSelectElement>('[data-curve-filter]'))select.onchange=()=>{filters[select.dataset.curveFilter as DamageDimension]=select.value;draw();};
 draw();
}
