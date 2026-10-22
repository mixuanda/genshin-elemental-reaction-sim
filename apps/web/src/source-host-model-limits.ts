import {SOURCE_HOST_COMMIT,SOURCE_HOST_STELLAR_COMMIT,type SourceHostResult} from '../../../packages/sim-core/src/source-host-wire';
import {fixedDamageWindow} from './source-damage-curve';
import './source-host-model-limits.css';

type RequestIdentity={kind:string;actorKey:string;ability:string};
export const isKaeyaQRequest=(request:RequestIdentity):boolean=>request.kind==='damage'&&request.actorKey==='kaeya'&&request.ability==='Glacial Waltz';
const pinned=(commit:string)=>commit===SOURCE_HOST_COMMIT||commit===SOURCE_HOST_STELLAR_COMMIT;
function notice(commit:string,observed:string):string{
 const known=pinned(commit);
 const source=known?`<a href="https://github.com/genshinsim/gcsim/blob/${commit}/internal/characters/kaeya/burst.go" target="_blank" rel="noreferrer">本次固定来源</a>`:'来源版本未核对，不能推定其固定调度';
 return `<aside class="source-host-model-limit" data-source-model-limit="kaeya-q" aria-label="凯亚Q模型范围">
  <strong>凯亚 Q：冰棱命中使用几何近似</strong>
  <p>实际命中会随走位和目标体积变化；本次 Q 伤害及团队 DPS 含此近似，不能视为官服精确碰撞结果。</p>
  <p data-kaeya-q-observed>${observed}</p>
  <details><summary>查看模型范围与来源</summary>
   <p>${source}。${known?'源码从 Q 起手后53帧开始定时检查；非C6有三组相位、C6有四组，各组每120帧调度。范围使用站场角色周围的圆形简化，没有逐个冰棱的转角、扫掠碰撞和移动接触锁。上述帧数是代码规则，不是实际碰撞保证。':''}</p>
   <p>起手接触判定尚未独立建模；“未实现”标记不等于已证明缺少一段独立伤害，因此不会自动追加起手伤害或固定总命中数。</p>
   <p>最小补充证据：按一次 Q、逐目标提供可追溯的实际接触帧与冰棱编号；自动推算还需角色与目标的逐帧位置、朝向及经核实的碰撞参数。</p>
   <p><a href="https://library.keqingmains.com/evidence/characters/cryo/kaeya#glacial-waltz-proc-frames-and-interactions" target="_blank" rel="noreferrer">社区原始碰撞测试（v2.4，非官方保证）</a>记录了走位与接触锁的影响；不能直接用它补造当前场景的额外命中。</p>
  </details>
 </aside>`;
}
/** Display-only scope derived from actual results. Never rewrites stored results or damage. */
export function renderSourceResultModelLimits(result:SourceHostResult):string{
 const ids=new Set(result.calculations.filter(c=>isKaeyaQRequest(c.request)).map(c=>c.request.id));
 const casts=result.abilityInvocations?.filter(a=>a.characterKey==='kaeya'&&a.action==='burst'&&a.success);
 if(!ids.size&&!casts?.length)return '';
 const bounded=fixedDamageWindow(result);
 const hits=(bounded?.applications??result.applications).filter(a=>ids.has(a.calculationId));
 const castLabel=casts===undefined?'释放次数未记录':`来源记录 ${casts.length} 次成功释放`;
 return notice(result.sourceCommit,`${castLabel}；当前观察窗实际结算 ${hits.length} 条 Q 伤害事件（按目标计数）。这是本次记录，不是固定应有命中数。`);
}
export function renderSourceHitModelLimits(sourceCommit:string,request:RequestIdentity):string{
 return isKaeyaQRequest(request)?notice(sourceCommit,'当前仅重算这一笔已捕获 Q 命中；单击重放一致不能验证整次 Q 的碰撞次数。'):'';
}
