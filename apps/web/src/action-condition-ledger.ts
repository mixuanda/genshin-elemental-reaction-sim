import type { SimulationResult } from "@genshin-dps-lab/schemas";
import type { CalculationTraceNode } from "@genshin-dps-lab/sim-core";
import { renderTraceHtml } from "./calculator-trace-view";

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });

/** Accepted-cast decisions are recorded by the core; the view never selects hits. */
export function renderActionConditionLedger(root: HTMLElement, result: SimulationResult, endFrame = Infinity): void {
  const entries = (result.actionConditionLog ?? []).filter(entry => entry.frame < endFrame);
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  root.innerHTML = `<h3>真实起手条件与命中分支</h3><p>以下条件在动作通过资格检查后，用当时实际生命状态求值并锁定。后续治疗不会重选这次施放的分支；能量不足而未施放的动作没有分支记录。这里显示条件命中组，未绑定该条件的基础命中继续由原行动定义执行。</p><div data-action-condition-table></div>`;
  let page = 0;
  const draw = (): void => {
    const start = page * 25, end = Math.min(start + 25, entries.length);
    const rows = entries.slice(start, end).map(entry => {
      const action = result.actionLog[entry.actionLogIndex]!;
      const actor = result.config.characters.find(candidate => candidate.id === entry.actorId)!;
      return `<tr data-action-condition-id="${entry.id}" data-action-condition-selected="${entry.selected}"><td>${entry.frame}f / ${num(entry.timeSeconds)}s</td><td>${esc(actor.name)} · ${esc(action.action)}<small>${esc(entry.groupId)}</small></td><td>${num(entry.ownerCurrentHp)} / ${num(entry.ownerMaxHp)}<small>声明阈值 ${num(entry.thresholdRatio * 100)}%</small></td><td>${entry.selected ? "纳入" : "排除"} ${entry.hitIds.length} 个条件命中<small>${entry.hitIds.map(esc).join("、")}</small></td><td><details data-action-condition-detail="${entry.id}"><summary>起手公式、代入与完整状态</summary><div data-action-condition-trace="${entry.id}"></div><p>实际事件顺序：${entry.frame} / ${entry.eventPriority} / ${entry.eventSequence}。</p><pre>${esc(JSON.stringify(entry, null, 2))}</pre></details></td></tr>`;
    }).join("");
    root.querySelector("[data-action-condition-table]")!.innerHTML = `<div class="table-wrap"><table><thead><tr><th>起手帧 / 秒</th><th>角色 / 行动 / 条件组</th><th>实际生命 / 上限</th><th>锁定结果</th><th>执行解释</th></tr></thead><tbody>${rows}</tbody></table></div><div class="editor-actions"><button type="button" data-action-condition-page="-1"${start === 0 ? " disabled" : ""}>上一页</button><span role="status">${entries.length ? start + 1 : 0}–${end} / ${entries.length} 条</span><button type="button" data-action-condition-page="1"${end === entries.length ? " disabled" : ""}>下一页</button></div>`;
  };
  root.onclick = event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-action-condition-page]");
    if (!button || button.disabled) return;
    page += Number(button.dataset.actionConditionPage); draw();
    (root.querySelector<HTMLButtonElement>(`[data-action-condition-page="${button.dataset.actionConditionPage}"]:not(:disabled)`) ?? root.querySelector<HTMLButtonElement>("[data-action-condition-page]:not(:disabled)"))?.focus();
  };
  root.addEventListener("toggle", event => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.open || !details.hasAttribute("data-action-condition-detail")) return;
    const host = details.querySelector<HTMLElement>("[data-action-condition-trace]")!;
    if (host.dataset.mounted) return;
    host.innerHTML = renderTraceHtml(byId.get(Number(details.dataset.actionConditionDetail))!.trace as CalculationTraceNode[]);
    host.dataset.mounted = "true";
  }, true);
  draw();
}
