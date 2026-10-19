import type { ArtifactBuffLogEntry, ArtifactBuffState, SimulationResult } from "@genshin-dps-lab/schemas";
import type { CalculationTraceNode } from "@genshin-dps-lab/sim-core";
import { ARTIFACT_BUFF_PROFILE } from "../../../packages/sim-core/src/artifact-buff-runtime";
import { artifactBuffLabels } from "./artifact-buff-controls";
import { renderTraceHtml } from "./calculator-trace-view";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 8 });
const outcomes: Record<ArtifactBuffLogEntry["outcome"], string> = {
  applied: "实际应用", scheduled: "队友已应用，自身延迟已排队", "stack-gained": "实际增层／刷新",
  "window-removed": "实际换人删除窗口", "expired-on-read": "实际属性读取删除到期效果",
  "off-field": "要求在场的持有者未在场", "wrong-owner": "事件来源不是持有者", "zero-change": "没有适用的非零变化",
  "cooldown-blocked": "触发冷却尚有效", "window-inactive": "所需窗口不存在", "max-stacks": "已达到来源层数上限", "target-not-enemy": "绽放目标不是敌人",
};
const eventNames: Record<ArtifactBuffLogEntry["event"]["kind"], string> = {
  burst: "实际接受爆发", reaction: "实际普通反应", "bond-of-life-change": "实际生命之契变化",
  "hp-drain": "实际掉血回调", swap: "实际完成换人", "delayed-buff": "实际延迟应用",
  "stats-sample": "实际完整属性取样", "react-bonus-read": "实际反应加成读取",
};
const statNames = { atkPct: "攻击力百分比", em: "元素精通", dmgBonus: "普通伤害加成" };
function stateHtml(state: ArtifactBuffState): string {
  return `<dl><dt>实际私有层数</dt><dd>${state.stacks}</dd><dt>modifier 存在性到期帧</dt><dd>${state.effectExpiresFrame === null ? "无已保存窗口" : `${state.effectExpiresFrame}f`}</dd><dt>触发冷却到期帧</dt><dd>${state.cooldownExpiresFrame === null ? "尚无冷却" : `${state.cooldownExpiresFrame}f`}</dd></dl>`;
}

/** Render saved callback decisions and their actual executable AST; no UI proc calculation. */
export function renderArtifactBuffLedger(root: HTMLElement, result: SimulationResult, window?: { startTick: number; endTick: number }): void {
  const all = result.artifactBuffLog ?? [];
  root.onclick = null;
  root.hidden = !result.config.artifactBuffModel && all.length === 0;
  if (root.hidden) { root.replaceChildren(); return; }
  const start = window?.startTick ?? 0, end = window?.endTick ?? Infinity;
  const entries = all.filter(entry => entry.frame >= start && entry.frame < end);
  const actor = (actorId: string): string => esc(result.config.characters.find(character => character.id === actorId)?.name ?? actorId);
  const byId = new Map(all.map(entry => [entry.id, entry]));
  const health = new Map((result.playerHealthEvents ?? []).map(entry => [entry.id, entry]));
  const damage = new Map(result.damageEvents.map(entry => [entry.id, entry]));
  root.innerHTML = `<h3>圣遗物：实际触发、增益与层数记录</h3><p>${window ? `显示观察窗口 [${start}, ${end})f 内的真实记录，结束帧不计入。` : "显示实际回调、已排队任务执行与属性读取记录。"}既存快照不会因随后获得增益被重写；下列属性值不是需要额外加总的伤害。</p><p>来源状态查询在到期帧仍可存在，完整属性与反应加成读取则会删除到期 modifier。数值增益的有效区间为 [开始帧, 到期帧)，账本不会把已保存到期帧当作当前仍生效的证明。</p><div data-artifact-buff-table></div>
    ${!window && result.artifactBuffState ? `<details><summary>实际模拟结束保存的私有状态</summary>${result.artifactBuffState.actors.map(row => `<h4>${actor(row.actorId)} · ${artifactBuffLabels[row.effectId]}</h4>${stateHtml(row.state)}${row.effectId === "gilded-4pc" ? `<p>初始化同元素队友 ${row.sameElementCount} 人，异元素队友 ${row.differentElementCount} 人。</p>` : ""}`).join("")}</details>` : ""}
    <details><summary>固定来源与限制</summary><p>${ARTIFACT_BUFF_PROFILE.id} · ${ARTIFACT_BUFF_PROFILE.evidence}</p><ul>${ARTIFACT_BUFF_PROFILE.assumptions.map(note => `<li>${esc(note)}</li>`).join("")}</ul><p>完整配置、真实状态、回调关联和公式追踪随运行记录 JSON 保存。独立单技能计算器仍可直接计算任一命中；团队实际命中的完整公式由现有命中还原入口提供。</p></details>`;
  let page = 0;
  const renderDetails = (entry: ArtifactBuffLogEntry): string => {
    const parent = entry.parentDamageEventId === null ? undefined : damage.get(entry.parentDamageEventId);
    const hp = entry.playerHealthEventId === null ? undefined : health.get(entry.playerHealthEventId);
    const cause = entry.parentArtifactBuffLogId === null ? undefined : byId.get(entry.parentArtifactBuffLogId);
    return `<p>事件 #${entry.id} · ${eventNames[entry.event.kind]} · ${entry.frame}f / ${num(entry.timeSeconds)}s；实际优先级 ${entry.eventPriority}，队列序号 ${entry.eventSequence}，同一执行事件内序号 ${entry.intraEventSequence}。</p>
      ${entry.trace.length ? `<section data-artifact-buff-trace>${renderTraceHtml(entry.trace as CalculationTraceNode[])}</section>` : `<p>此次 ${outcomes[entry.outcome]}；没有执行数值状态公式，未补造触发或增益。</p>`}
      ${entry.applications.length ? `<h4>实际属性应用</h4><div class="table-wrap"><table><thead><tr><th>接收者</th><th>属性／实际值</th><th>操作／有效窗口</th></tr></thead><tbody>${entry.applications.map(item => `<tr><td>${actor(item.receiverId)}</td><td>${statNames[item.stat]} ${num(item.value)}</td><td>${item.operation === "replace" ? `同名效果替换：[${item.startFrame}, ${item.expiresFrame})f` : `仅更新已有数值；原起点保留，到期仍为 ${item.expiresFrame}f`}<small>${esc(item.key)}</small></td></tr>`).join("")}</tbody></table></div>` : ""}
      ${entry.delayedApplications.length ? `<p>本次实际排队：${entry.delayedApplications.map(task => `${actor(task.receiverId)} 在 ${task.applyFrame}f 应用宗室（来源 ${task.sourceFrame}f）`).join("；")}。是否执行须看后续延迟应用记录，不提前计入面板。</p>` : ""}
      ${entry.removals.length ? `<p>实际移除：${entry.removals.map(item => `${actor(item.receiverId)} 的 ${esc(item.key)}`).join("；")}。</p>` : ""}
      ${entry.effectId === "paradise-4pc" ? "<p>此处记录普通绽放反应加成窗口；实际反应伤害在其生成和取样阶段读取加成，不能作为普通增伤再加一次。</p>" : ""}
      ${entry.actionLogIndex !== null ? `<p>关联实际接受动作索引 ${entry.actionLogIndex}。</p>` : ""}
      ${parent ? `<p>关联实际命中 #${parent.id} · ${parent.frame}f · ${actor(parent.sourceActorId)} · ${num(parent.finalDamage)} 伤害。此关联用于追溯事件，不意味着该命中已使用事件之后的新增益。</p>` : ""}
      ${hp ? `<p>关联实际生命记录 #${hp.id} · ${hp.frame}f · ${esc(hp.operation)}；请求量 ${num(hp.requestedAmount)}，生命实际变化 ${num(hp.actualChange)}${hp.bondOfLife ? `，生命之契来源回调量 ${num(hp.bondOfLife.sourceCallbackAmount)}` : ""}。</p>` : ""}
      ${cause ? `<p>延迟任务源自圣遗物记录 #${cause.id} · ${cause.frame}f。</p>` : ""}
      <details><summary>事件前状态</summary>${stateHtml(entry.stateBefore)}</details><details><summary>事件后状态</summary>${stateHtml(entry.stateAfter)}</details>
      <p>本条固定来源：<a href="${esc(entry.sourceRef)}" target="_blank" rel="noopener noreferrer">${artifactBuffLabels[entry.effectId]}</a>。</p><details><summary>完整原始事件与来源关系</summary><pre>${esc(JSON.stringify(entry, null, 2))}</pre></details>`;
  };
  const draw = (): void => {
    const first = page * 25, last = Math.min(first + 25, entries.length);
    root.querySelector<HTMLElement>("[data-artifact-buff-table]")!.innerHTML = entries.length ? `<div class="table-wrap"><table><thead><tr><th>帧／来源事件</th><th>持有者／四件套</th><th>实际结果</th><th>层数／详情</th></tr></thead><tbody>${entries.slice(first, last).map(entry => `<tr data-artifact-buff-log="${entry.id}"><td>${entry.frame}f<small>${eventNames[entry.event.kind]}</small></td><td>${actor(entry.actorId)}<small>${artifactBuffLabels[entry.effectId]}</small></td><td>${outcomes[entry.outcome]}</td><td>${entry.stateBefore.stacks} → ${entry.stateAfter.stacks}<details data-artifact-buff-details="${entry.id}"><summary>实际公式、窗口与来源</summary><div data-artifact-buff-body></div></details></td></tr>`).join("")}</tbody></table></div><div class="editor-actions"><button type="button" data-artifact-buff-page="-1"${first === 0 ? " disabled" : ""}>上一页</button><span role="status">${first + 1}–${last} / ${entries.length} 条</span><button type="button" data-artifact-buff-page="1"${last >= entries.length ? " disabled" : ""}>下一页</button></div>` : "<p>此观察区间没有适用的实际回调。未按计划输入或推测状态补造触发。</p>";
    root.querySelectorAll<HTMLDetailsElement>("[data-artifact-buff-details]").forEach(details => { details.ontoggle = () => {
      const body = details.querySelector<HTMLElement>("[data-artifact-buff-body]")!;
      if (!details.open || body.dataset.mounted) return;
      body.dataset.mounted = "true"; body.innerHTML = renderDetails(byId.get(Number(details.dataset.artifactBuffDetails))!);
    }; });
  };
  root.onclick = event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-artifact-buff-page]");
    if (!button || button.disabled) return;
    page += Number(button.dataset.artifactBuffPage); draw();
  };
  draw();
}
