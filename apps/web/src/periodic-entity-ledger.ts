import type { SimulationResult } from "@genshin-dps-lab/schemas";
import type { CalculationTraceNode } from "@genshin-dps-lab/sim-core";
import { renderTraceHtml } from "./calculator-trace-view";

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
const operations = { spawn: "生成", replace: "替换旧实体", tick: "实际周期执行", expire: "结束", "cancelled-tick": "旧实体后续事件已取消" };

/** Displays executed entity and HP records; never reconstructs a second tick schedule. */
export function renderPeriodicEntityLedger(root: HTMLElement, result: SimulationResult, endFrame = Infinity): void {
  const entries = (result.periodicEntityLog ?? []).filter(entry => entry.frame < endFrame);
  const healthEvents = new Map((result.playerHealthEvents ?? []).map(event => [event.id, event]));
  const actorName = (id: string): string => esc(result.config.characters.find(actor => actor.id === id)?.name ?? id);
  root.innerHTML = `<h3>周期实体与执行时治疗</h3><p>记录真实生成、替换、周期执行及结束事件。治疗读取该次执行的持有者属性、生命与前台角色；下表中的到期帧是实体定义的边界，实际终止顺序见记录。伤害是否命中及产球结果分别见伤害与能量记录。</p><div data-periodic-entity-table></div>`;
  let page = 0;
  const draw = (): void => {
    const start = page * 25, end = Math.min(start + 25, entries.length);
    const rows = entries.slice(start, end).map(entry => {
      const health = entry.healthEventId === undefined ? undefined : healthEvents.get(entry.healthEventId);
      const action = result.actionLog[entry.actionLogIndex]!;
      const healing = entry.healing;
      return `<tr data-periodic-operation="${entry.operation}" data-periodic-frame="${entry.frame}"><td>${entry.frame}f / ${num(entry.timeSeconds)}s</td><td>${actorName(entry.actorId)}<small>${esc(entry.definitionId)} · 第 ${entry.generation} 代</small></td><td>${operations[entry.operation]}${entry.tickIndex === undefined ? "" : `<small>周期序号 ${entry.tickIndex}</small>`}</td><td>${entry.spawnFrame}f → ${entry.expiresAtFrame}f<small>${esc(action.action)} · 行动 #${entry.actionLogIndex}</small></td><td>${health ? `${actorName(health.targetActorId)}：${num(health.hpBefore)} → ${num(health.hpAfter)}<small>实际恢复 ${num(health.actualChange)}；溢出 ${num(health.overheal)}</small>` : "—"}</td><td><details${health ? ` data-periodic-health-id="${health.id}"` : ""}><summary>${health ? "治疗公式、代入与实际状态" : "查看实际实体记录"}</summary>${healing ? `<p>持有者当前生命 ${num(healing.ownerCurrentHp)} / ${num(healing.ownerMaxHp)}，精通 ${num(healing.ownerEm)}；基础治疗 ${num(healing.baseHealing)}，治疗加成 ${num(healing.healingBonus * 100)}%，受治疗加成 ${num(healing.incomingHealingBonus * 100)}%。</p>` : ""}${health ? `<div data-periodic-health-trace="${health.id}"></div>` : ""}<p>事件顺序：${entry.frame} / ${entry.eventPriority} / ${entry.eventSequence}。</p><pre>${esc(JSON.stringify({ entity: entry, health: health ?? null }, null, 2))}</pre></details></td></tr>`;
    }).join("");
    root.querySelector("[data-periodic-entity-table]")!.innerHTML = `<div class="table-wrap"><table><thead><tr><th>帧 / 秒</th><th>持有者 / 实体</th><th>已执行操作</th><th>生成 → 到期 / 行动</th><th>实际治疗</th><th>执行解释</th></tr></thead><tbody>${rows}</tbody></table></div><div class="editor-actions"><button type="button" data-periodic-page="-1"${start === 0 ? " disabled" : ""}>上一页</button><span role="status">${entries.length ? start + 1 : 0}–${end} / ${entries.length} 条</span><button type="button" data-periodic-page="1"${end === entries.length ? " disabled" : ""}>下一页</button></div>`;
  };
  root.onclick = event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-periodic-page]");
    if (!button || button.disabled) return;
    page += Number(button.dataset.periodicPage); draw();
    (root.querySelector<HTMLButtonElement>(`[data-periodic-page="${button.dataset.periodicPage}"]:not(:disabled)`) ?? root.querySelector<HTMLButtonElement>("[data-periodic-page]:not(:disabled)"))?.focus();
  };
  root.addEventListener("toggle", event => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.open || !details.hasAttribute("data-periodic-health-id")) return;
    const host = details.querySelector<HTMLElement>("[data-periodic-health-trace]")!;
    if (host.dataset.mounted) return;
    host.innerHTML = renderTraceHtml(healthEvents.get(Number(details.dataset.periodicHealthId))!.trace as CalculationTraceNode[]);
    host.dataset.mounted = "true";
  }, true);
  draw();
}
