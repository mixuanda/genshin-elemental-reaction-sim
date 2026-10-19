import type { SourceHostPendingAttackStage, SourceHostStatusInstance } from "../../../packages/sim-core/src/source-host-action-origin";
import type { SourceHostTaskLifecycle } from "../../../packages/sim-core/src/source-host-task-lifecycle";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const endStateLabel: Record<SourceHostStatusInstance["endState"], string> = {
  replaced: "被替换", removed: "已移除", "expired-at-end": "观察终点时已过期",
  "active-at-end": "观察终点时仍活动", "unknown-at-end": "观察终点状态未知",
};
const originText = (origin: SourceHostPendingAttackStage["origin"]): string => {
  const owner = origin.statusOwner;
  return [
    origin.creationActionSequence === undefined ? "" : `创建动作 ${origin.creationActionSequence}`,
    origin.triggerActionSequence === undefined ? "" : `触发动作 ${origin.triggerActionSequence}`,
    origin.parentAttackId === undefined ? "" : `父攻击 ${origin.parentAttackId}`,
    owner ? `主动状态 ${owner.statusKey}（角色索引 ${owner.actorIndex}，实例 ${owner.instanceId}）` : "",
    `来源类型 ${origin.via}`,
  ].filter(Boolean).join("；");
};

function renderTaskLifecycle(ledger: SourceHostTaskLifecycle): string {
  const queues = new Map(ledger.queues.map(queue => [queue.id, queue]));
  const queueLabels: Record<SourceHostTaskLifecycle["queues"][number]["kind"], string> = {
    core: "核心队列", character: "角色队列", enemy: "敌人队列",
  };
  const clockText = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
  const rows = ledger.tasks.slice(0, 200).map(task => {
    const queue = queues.get(task.queueId)!;
    const localDelta = task.dueClock - queue.clock;
    const stateLabel = task.state === "completed" ? "执行完毕" : "仍在等待";
    const overdueNote = task.state === "pending" && localDelta < 0
      ? "（已超过到期本地时钟但仍在等待；到期不等于已执行）" : "";
    const owner = queue.kind === "character" ? " · 角色索引 " + queue.actorIndex
      : queue.kind === "enemy" ? " · 目标键 " + queue.targetKey : "";
    const origin = JSON.stringify(task.origin);
    return "<tr data-source-host-task-row=\"" + esc(task.id) + "\" data-source-host-task-state=\"" + task.state + "\">" +
      "<td>" + esc(task.id) + "</td><td>" + stateLabel + "</td><td>" +
      (task.parentTaskId === undefined ? "—" : esc(task.parentTaskId)) + "</td><td>" +
      queueLabels[queue.kind] + " · 队列 " + esc(queue.id) + owner + "</td><td>" + clockText(queue.clock) +
      "</td><td>" + clockText(task.queuedClock) + "</td><td>" + clockText(task.dueClock) +
      "</td><td>" + clockText(task.dueClock) + " − " + clockText(queue.clock) + " = " + clockText(localDelta) + overdueNote + "</td><td>" +
      (task.runFrame === undefined ? "—" : task.runFrame) +
      (task.completedFrame === undefined ? "" : " · 完成帧 " + task.completedFrame) +
      "</td><td><details><summary>" + esc(task.key ?? "查看任务键与来源") +
      "</summary><dl><dt>任务键</dt><dd>" + esc(task.key ?? "未记录") +
      "</dd><dt>来源关联</dt><dd><code>" + esc(origin) + "</code></dd></dl></details></td></tr>";
  }).join("") || "<tr><td colspan=\"10\">本记录包含 0 条任务。</td></tr>";
  const completed = ledger.tasks.filter(task => task.state === "completed").length;
  const pending = ledger.tasks.length - completed;
  return "<section data-source-host-task-lifecycle><h4>排队任务生命周期</h4>" +
    "<p>观察帧 " + ledger.observationFrame + "；本记录任务总数 <strong data-source-host-task-total>" + ledger.tasks.length +
    "</strong>，已执行 <strong data-source-host-task-completed>" + completed +
    "</strong>，仍在等待 <strong data-source-host-task-pending>" + pending + "</strong>。</p>" +
    "<p>“执行完毕”只表示这一排队任务已运行，不代表整个技能或所有后续效果已经结束。队列时钟是各队列本地时钟；时钟与差值不解释为全局秒数或帧数。</p>" +
    "<details><summary>排队任务记录（" + ledger.tasks.length + " 条，显示前 " + Math.min(ledger.tasks.length, 200) +
    " 条）</summary><div class=\"table-wrap\"><table><thead><tr><th>任务编号</th><th>状态</th><th>父任务</th><th>队列</th>" +
    "<th>队列本地时钟</th><th>入队本地时钟</th><th>到期本地时钟</th><th>到期计数 − 当前计数（本地计数）</th>" +
    "<th>执行／完成帧</th><th>任务键与来源</th></tr></thead><tbody>" + rows + "</tbody></table></div></details>" +
    (ledger.tasks.length > 200 ? "<p>本记录共有 " + ledger.tasks.length + " 条任务；界面显示前 200 条，完整结果 JSON 保留全部记录。</p>" : "") +
    "</section>";
}

export function renderSourceHostLifecycleView(
  root: HTMLElement,
  data: {
    lifecycleObservationFrame?: number | undefined;
    statusInstances?: SourceHostStatusInstance[] | undefined;
    pendingAttackStages?: SourceHostPendingAttackStage[] | undefined;
    taskLifecycle?: SourceHostTaskLifecycle | undefined;
  },
): void {
  const statuses = data.statusInstances;
  const pending = data.pendingAttackStages;
  if (statuses === undefined && pending === undefined && data.lifecycleObservationFrame === undefined && data.taskLifecycle === undefined) {
    root.innerHTML = `<section data-source-host-lifecycle><h4>状态与待处理攻击生命周期</h4><p>本记录未保存这类生命周期观察；缺少记录不能视为零状态或零待处理任务。</p></section>`;
    return;
  }
  const statusRows = statuses === undefined
    ? `<tr><td colspan="10">状态实例账本未记录</td></tr>`
    : statuses.slice(0, 200).map(row => `<tr><td>${row.actorIndex}</td><td>${esc(row.statusKey)}</td><td>${row.instanceId}</td><td>${row.createdFrame}</td><td>${row.creationActionSequence ?? "—"}</td><td>${row.initialExpiryFrame}</td><td>${row.finalExpiryFrame}</td><td>${esc(endStateLabel[row.endState])}</td><td>${row.endFrame}${row.replacedByInstanceId === undefined ? "" : ` · 后继实例 ${row.replacedByInstanceId}`}</td><td>${row.nativeOverwrite === undefined ? "—" : row.nativeOverwrite ? "是" : "否"}</td></tr>`).join("") || `<tr><td colspan="10">记录了 0 个状态实例</td></tr>`;
  const pendingRows = pending === undefined
    ? `<tr><td colspan="6">待处理攻击任务账本未记录</td></tr>`
    : pending.slice(0, 200).map(row => `<tr><td>${row.id}</td><td>${row.stage === "snapshot" ? "快照任务" : "应用任务"}</td><td>${row.queuedFrame}</td><td>${row.dueFrame}</td><td>${row.attackId ?? "—"}</td><td>${esc(originText(row.origin))}</td></tr>`).join("") || `<tr><td colspan="6">记录了 0 个待处理核心攻击任务</td></tr>`;
  const taskLifecycleHtml = data.taskLifecycle === undefined ? "" : renderTaskLifecycle(data.taskLifecycle);
  root.innerHTML = `<section data-source-host-lifecycle><h4>状态与待处理攻击生命周期</h4>
    ${taskLifecycleHtml}
    <p>生命周期观察帧：${data.lifecycleObservationFrame ?? "未记录"}。状态账本只记录已观察到的实例变化；最终到期帧可能包含命中僵直延长。「观察终点时已过期」表示终点检查时已过期，不代表精确过期时刻。</p>
    <p>下方「待处理攻击任务」只列来源核心实际追踪的攻击快照／应用任务，不盘点其他角色任务、实体、回调或攻击机会；完整排队任务见上方。记录为 0 不能证明完整施放或结算完成。</p>
    <details><summary>状态实例记录（${statuses === undefined ? "未记录" : `${statuses.length} 条，显示前 ${Math.min(statuses.length, 200)} 条`}）</summary><div class="table-wrap"><table><thead><tr><th>角色索引</th><th>状态键</th><th>实例编号</th><th>创建帧</th><th>创建动作</th><th>初始到期帧</th><th>最终到期帧</th><th>终态</th><th>结束帧／后继实例</th><th>创建时覆盖旧条目</th></tr></thead><tbody>${statusRows}</tbody></table></div></details>
    <details><summary>待处理攻击任务（${pending === undefined ? "未记录" : `${pending.length} 条，显示前 ${Math.min(pending.length, 200)} 条`}）</summary><div class="table-wrap"><table><thead><tr><th>任务编号</th><th>阶段</th><th>排队帧</th><th>到期帧</th><th>攻击编号</th><th>原生来源关联</th></tr></thead><tbody>${pendingRows}</tbody></table></div></details>
    <p>每类账本最多显示前 200 条；完整结果 JSON 导出仍保留全部记录。</p></section>`;
}
