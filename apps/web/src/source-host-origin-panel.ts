import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";
import { captureSourceHostActionCollection, captureSourceHostFiniteSkillCollection, sourceHostActionHasEvidence, summarizeSourceHostActionOrigins, type SourceHostActionCollection } from "../../../packages/sim-core/src/source-host-action-collection";
import { getSourceHostFiniteCastContract } from "../../../packages/sim-core/src/source-host-finite-cast";
import { captureSourceHostEventCollection, type SourceHostEventCollection } from "../../../packages/sim-core/src/source-host-event-collection";
import { getSourceHostEventComponentForSite, getSourceHostEventComponentRule, type SourceHostEventComponentId } from "../../../packages/sim-core/src/source-host-event-rules";
import { sourceActionLabels } from "./source-action-capabilities";
import { renderSourceHostLifecycleView } from "./source-host-lifecycle-view";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const amount = (value: number): string => Number.isFinite(value) ? value.toLocaleString() : "未知";
const actionLabel = (action: string): string => sourceActionLabels[action as keyof typeof sourceActionLabels]
  ?? ({ switch: "切人", swap: "切人", "character-switch": "切人", auto_switch: "自动切人" } as Record<string, string>)[action]
  ?? action;
const observationStageLabel: Record<string, string> = {
  queued: "已排队（快照延迟前）", dispatched: "已派发（开始应用攻击）",
  resolved: "已结算（目标处理返回后）", missed: "未命中（目标检查失败）",
};
function renderAttackObservations(result: SourceHostResult): string {
  const rows = result.attackObservations;
  if (!rows?.length) return "";
  const cells = rows.slice(0, 200).map((row, index) => {
    const origin = row.origin;
    const owner = origin?.statusOwner;
    return `<tr><td>${index + 1}</td><td>${row.attackId ?? "尚未分配"}</td><td>${esc(observationStageLabel[row.stage] ?? row.stage)}</td><td>${row.frame}</td><td>${row.targetKey === undefined ? "—" : row.targetKey}</td><td>${row.reason ? esc(row.reason) : "—"}</td><td>${origin?.creationActionSequence ?? "—"}</td><td>${origin?.triggerActionSequence ?? "—"}</td><td>${origin?.parentAttackId ?? "—"}</td><td>${owner ? `角色索引 ${owner.actorIndex} · ${esc(owner.statusKey)} · 实例 ${owner.instanceId} · 创建帧 ${owner.createdFrame}${owner.creationActionSequence === undefined ? "" : ` · 创建动作 ${owner.creationActionSequence}`}` : "—"}</td></tr>`;
  }).join("");
  return `<details data-source-host-attack-observations><summary>原生攻击观察账本（${rows.length} 条，显示前 ${Math.min(rows.length, 200)} 条）</summary>
    <p>按结果记录顺序展示，每行是一条阶段观察；同一攻击编号可重复出现（例如不同目标）。这些记录不构成完整施放、结算完整性或待处理数量的判断。</p>
    <div class="table-wrap"><table><thead><tr><th>记录序号</th><th>攻击编号</th><th>阶段</th><th>帧</th><th>目标键</th><th>原因</th><th>创建动作序号</th><th>触发动作序号</th><th>父攻击编号</th><th>主动状态关联</th></tr></thead><tbody>${cells}</tbody></table></div></details>`;
}

export function renderSourceHostOriginPanel(
  root: HTMLElement,
  result: SourceHostResult,
  openCalculator: (capture: SourceHostActionCollection | SourceHostEventCollection) => void,
): void {
  const origins = summarizeSourceHostActionOrigins(result);
  const attackObservations = renderAttackObservations(result);
  const eventProducersByCall = new Map<number, NonNullable<SourceHostResult["eventProducers"]>>();
  for (const producer of result.eventProducers ?? []) {
    const rows = eventProducersByCall.get(producer.listenerCallId) ?? [];
    rows.push(producer);
    eventProducersByCall.set(producer.listenerCallId, rows);
  }
  const eventCalls = (result.eventListenerCalls ?? []).flatMap(call => {
    const componentId = getSourceHostEventComponentForSite(call.siteId);
    if (!componentId) return [];
    const rule = getSourceHostEventComponentRule(componentId);
    if (!rule.sourceCommits.includes(result.sourceCommit)) return [];
    return [{ call, rule, componentId, producers: eventProducersByCall.get(call.id) ?? [] }];
  });
  const eventComponentCounts = new Map<SourceHostEventComponentId, number>();
  for (const row of eventCalls) eventComponentCounts.set(row.componentId, (eventComponentCounts.get(row.componentId) ?? 0) + 1);
  const eventCallsWithAttackOrTask = eventCalls.filter(({ call, producers }) => call.queuedAttacks.length > 0 || producers.length > 0).length;
  const eventEmissions = new Map((result.eventEmissions ?? []).map(row => [row.id, row]));
  const finiteContracts = new Map<number, NonNullable<ReturnType<typeof getSourceHostFiniteCastContract>>>();
  for (const group of origins.groups) {
    if (group.action.acceptedFrame == null || !["skill", "burst"].includes(group.action.action)) continue;
    const contract = getSourceHostFiniteCastContract(result.sourceCommit, group.action.characterKey, group.action.action);
    if (contract) finiteContracts.set(group.action.sequence, contract);
  }
  const pageSizeDefault = 20;
  let page = 0;
  root.innerHTML = `<section data-source-host-origin><h4>原生动作来源归属</h4>
    ${attackObservations}
    <div data-source-host-lifecycle-mount></div>
    <p>「创建链」表示原生回执记录的攻击创建回调链，不代表技能所有权；「触发链」包含协同攻击与装备效果；「主动状态关联」仅记录明确的状态激活来源，不能代表普遍技能所有权。三种关联可能重叠，不能相加作为总伤。未绑定实体、漏记及待处理命中会阻止完整施放结论；本面板不计算 DPS。</p>
    <p>「技能固有伤害」是固定来源方法契约限定的独立范围，并按实际原生施放及攻击派发回执检查；它不替代上述来源关联，也不代表完整施放已完成。</p>
    ${origins.legacy ? `<p>本记录没有可用的原生命中来源，不能按名称或帧推断动作归属；下方已接受动作仅在原生观察证据存在时提供动作观察集合。</p>` : ""}
    <section data-source-host-event-components><h5>已审阅的事件监听调用</h5>
      <p>这里按实际监听调用展示由当前来源提交规则覆盖的事件。默认筛出监听器排入攻击或登记任务的调用；“全部调用”也可查看没有攻击或任务的监听器。全局注册监听可能由其他角色的命中触发；事件攻击作为独立组件计算，不归入某次 E/Q 技能所有权。</p>
      <p>下表“监听／任务排队”只计监听器及其登记任务直接排队的攻击；攻击回调继续排入的子攻击在打开组件后查看。</p>
      ${result.eventListenerCalls === undefined ? "<p>旧来源结果未保存事件监听回执，不能推断事件是否发生。</p>"
        : eventCalls.length === 0 ? "<p>本次没有已审阅源码规则覆盖的事件监听调用。</p>"
        : `<div data-origin-event-call-list>
          <div data-origin-event-controls>
            <label>调用筛选<select data-origin-event-activity><option value="productive" selected>有攻击或任务（${eventCallsWithAttackOrTask}）</option><option value="all">全部调用（${eventCalls.length}）</option></select></label>
            <label>事件组件<select data-origin-event-component><option value="all">全部组件（${eventCalls.length}）</option>${[...eventComponentCounts].map(([componentId, count]) => {
              const rule = getSourceHostEventComponentRule(componentId);
              return `<option value="${esc(componentId)}">${esc(rule.label)}（${count}）</option>`;
            }).join("")}</select></label>
            <span data-origin-event-count aria-live="polite"></span>
            <label>每页事件<select data-origin-event-page-size><option value="20" selected>20</option><option value="50">50</option></select></label>
            <button type="button" data-origin-event-prev>上一页</button><span data-origin-event-page aria-live="polite"></span><button type="button" data-origin-event-next>下一页</button>
          </div>
          <div class="table-wrap" data-origin-event-table></div>
        </div>`}
    </section>
    <p>记录 ${origins.groups.length} 个动作；创建来源未关联命中 ${origins.unassignedApplicationIds.length} 个。</p>
    <label>每页动作<select data-origin-page-size><option value="20">20</option><option value="50">50</option></select></label>
    <button type="button" data-origin-prev>上一页</button><span data-origin-page aria-live="polite"></span><button type="button" data-origin-next>下一页</button>
    <div data-origin-groups></div></section>`;
  renderSourceHostLifecycleView(root.querySelector<HTMLElement>("[data-source-host-lifecycle-mount]")!, result);
  const eventTable = root.querySelector<HTMLElement>("[data-origin-event-table]");
  if (eventTable) {
    const activity = root.querySelector<HTMLSelectElement>("[data-origin-event-activity]")!;
    const component = root.querySelector<HTMLSelectElement>("[data-origin-event-component]")!;
    const eventSize = root.querySelector<HTMLSelectElement>("[data-origin-event-page-size]")!;
    const eventPageLabel = root.querySelector<HTMLElement>("[data-origin-event-page]")!;
    const eventCountLabel = root.querySelector<HTMLElement>("[data-origin-event-count]")!;
    const eventPrevious = root.querySelector<HTMLButtonElement>("[data-origin-event-prev]")!;
    const eventNext = root.querySelector<HTMLButtonElement>("[data-origin-event-next]")!;
    let eventPage = 0;
    const filteredEventCalls = () => eventCalls.filter(({ call, componentId, producers }) =>
      (activity.value === "all" || call.queuedAttacks.length > 0 || producers.length > 0)
      && (component.value === "all" || componentId === component.value));
    const drawEventCalls = () => {
      const rows = filteredEventCalls();
      const pageSize = Number(eventSize.value) || 20;
      const pages = Math.max(1, Math.ceil(rows.length / pageSize));
      eventPage = Math.min(eventPage, pages - 1);
      const start = eventPage * pageSize;
      eventCountLabel.textContent = `显示 ${rows.length} 次符合筛选的调用（当前来源提交共 ${eventCalls.length} 次已审阅调用）`;
      eventPageLabel.textContent = `第 ${eventPage + 1} / ${pages} 页`;
      eventPrevious.disabled = eventPage === 0;
      eventNext.disabled = eventPage >= pages - 1;
      const visible = rows.slice(start, start + pageSize);
      eventTable.innerHTML = visible.length
        ? `<table><thead><tr><th>调用</th><th>来源站点</th><th>帧</th><th>实际目标</th><th>事件触发攻击</th><th>监听／任务排队</th><th>待执行任务</th><th>独立组件</th></tr></thead><tbody>${visible.map(({ call, rule, producers }) => {
          const emission = eventEmissions.get(call.emissionId);
          const emittedAttacks = call.queuedAttacks.length + producers.reduce((sum, row) => sum + row.queuedAttacks.length, 0);
          const pendingTasks = producers.filter(row => row.state === "pending").length;
          return `<tr><td>${call.id}</td><td>${esc(rule.label)}<br><code>${esc(rule.siteId)}</code></td><td>${call.startedFrame}</td><td>${emission?.targetKey ?? "未知"}</td><td>${emission?.parentAttackId ?? "未知"}</td><td>${emittedAttacks}</td><td>${pendingTasks}</td><td><button type="button" data-origin-open-event="${call.id}">打开事件攻击组件</button><span data-origin-event-message="${call.id}" role="status"></span></td></tr>`;
        }).join("")}</tbody></table>`
        : `<p>当前筛选条件下没有事件监听调用。</p>`;
    };
    activity.onchange = () => { eventPage = 0; drawEventCalls(); };
    component.onchange = () => { eventPage = 0; drawEventCalls(); };
    eventSize.onchange = () => { eventPage = 0; drawEventCalls(); };
    eventPrevious.onclick = () => { eventPage = Math.max(0, eventPage - 1); drawEventCalls(); };
    eventNext.onclick = () => { eventPage += 1; drawEventCalls(); };
    eventTable.addEventListener("click", event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-origin-open-event]");
      if (!button) return;
      const listenerCallId = Number(button.dataset.originOpenEvent);
      const message = root.querySelector<HTMLElement>(`[data-origin-event-message="${listenerCallId}"]`);
      try {
        const capture = captureSourceHostEventCollection(result, listenerCallId);
        if (!capture) {
          if (message) message.textContent = " 当前回执不足以建立此事件组件。";
          return;
        }
        if (message) message.textContent = " 已打开本次监听调用；攻击交付状态以组件中的实际回执为准。";
        openCalculator(capture);
      } catch (error) {
        if (message) message.textContent = ` 无法打开事件组件：${error instanceof Error ? error.message : String(error)}`;
      }
    });
    drawEventCalls();
  }
  const size = root.querySelector<HTMLSelectElement>("[data-origin-page-size]")!;
  const body = root.querySelector<HTMLElement>("[data-origin-groups]")!;
  const label = root.querySelector<HTMLElement>("[data-origin-page]")!;
  const previous = root.querySelector<HTMLButtonElement>("[data-origin-prev]")!;
  const next = root.querySelector<HTMLButtonElement>("[data-origin-next]")!;
  const draw = () => {
    const pageSize = Number(size.value) || pageSizeDefault;
    const pages = Math.max(1, Math.ceil(origins.groups.length / pageSize));
    page = Math.min(page, pages - 1);
    label.textContent = `第 ${page + 1} / ${pages} 页`;
    previous.disabled = page === 0; next.disabled = page >= pages - 1;
    const start = page * pageSize;
    body.innerHTML = origins.groups.slice(start, start + pageSize).map((group, offset) => {
      const creationIds = group.creationApplicationIds;
      const triggerIds = group.triggerApplicationIds;
      const statusOwnerIds = group.statusOwnerApplicationIds;
      const accepted = group.action.acceptedFrame == null ? "未记录" : String(group.action.acceptedFrame);
      const summary = (ids: number[], damage: number) => ids.length
        ? `${ids.length} 次关联命中，已记账 ${amount(damage)}`
        : "没有可编辑的已记账命中；不能据此断言完整动作伤害为零";
      const finiteContract = finiteContracts.get(group.action.sequence);
      const finiteButton = finiteContract
        ? `<button type="button" data-origin-open-finite="${group.action.sequence}">检查技能固有伤害 · ${esc(finiteContract.label)}</button><span data-origin-finite-message="${group.action.sequence}" role="status"></span>`
        : "";
      const makeButton = (kind: "creation" | "trigger" | "status-owner", ids: number[]) => {
        if (!sourceHostActionHasEvidence(result, group.action.sequence, kind)) return "";
        const label = kind === "creation" ? "创建链" : kind === "trigger" ? "触发链" : "主动状态关联";
        return `<button type="button" data-origin-open="${start + offset}" data-origin-kind="${kind}">${ids.length ? `打开${label}命中集合（${ids.length}）` : `打开${label}动作观察集合（无已记账命中）`}</button>`;
      };
      return `<article class="card" data-origin-action="${group.action.sequence}"><h5>动作序号 ${group.action.sequence} · ${esc(group.action.characterKey)} · ${esc(actionLabel(group.action.action))}</h5>
        <p>排队帧 ${group.action.queuedFrame}；接受帧 ${accepted}</p>
        <p>创建链（原生攻击创建回调）：${summary(creationIds, group.creationDamage)}；触发链（含协同与装备效果）：${summary(triggerIds, group.triggerDamage)}；主动状态关联：${summary(statusOwnerIds, group.statusOwnerDamage)}。</p>
        ${makeButton("creation", creationIds)} ${makeButton("trigger", triggerIds)} ${makeButton("status-owner", statusOwnerIds)} ${finiteButton}</article>`;
    }).join("") || "<p>没有可展示的动作来源分组。</p>";
    body.querySelectorAll<HTMLButtonElement>("[data-origin-open]").forEach(button => {
      button.onclick = () => {
        const group = origins.groups[Number(button.dataset.originOpen)];
        if (group) openCalculator(captureSourceHostActionCollection(result, group.action.sequence, button.dataset.originKind as "creation" | "trigger" | "status-owner"));
      };
    });
    body.querySelectorAll<HTMLButtonElement>("[data-origin-open-finite]").forEach(button => {
      button.onclick = () => {
        const sequence = Number(button.dataset.originOpenFinite);
        const message = body.querySelector<HTMLElement>(`[data-origin-finite-message="${sequence}"]`);
        try {
          const capture = captureSourceHostFiniteSkillCollection(result, sequence);
          if (!capture) {
            if (message) message.textContent = " 原生回执不足以建立技能固有范围；现有来源关联保持不变。";
            return;
          }
          if (message) message.textContent = " 已打开来源契约范围；完整性以集合中的实际派发与命中回执为准。";
          openCalculator(capture);
        } catch (error) {
          if (message) message.textContent = ` 无法建立该有限技能范围：${error instanceof Error ? error.message : String(error)}`;
        }
      };
    });
  };
  size.onchange = () => { page = 0; draw(); };
  previous.onclick = () => { page--; draw(); };
  next.onclick = () => { page++; draw(); };
    draw();
}
