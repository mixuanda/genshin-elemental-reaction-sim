import type { SimulationResult } from "@genshin-dps-lab/schemas";
import type { CalculationTraceNode } from "@genshin-dps-lab/sim-core";
import { renderTraceHtml } from "./calculator-trace-view";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
const operations = { initial: "初始生命", damage: "反应自伤", "shield-hit": "护盾与生命受击", heal: "治疗", consume: "生命消耗", "bond-add": "授予生命之契", "bond-remove": "移除生命之契", "max-hp-change": "最大生命变化", "simulation-end": "模拟结束" };

/** Values and ordering come from the actual shared HP timeline, including preheat boundaries. */
export function renderPlayerHealthLedger(root: HTMLElement, result: SimulationResult, endFrame = Infinity): void {
  const points = result.playerHpTimeline.points.filter(point => point.operation === "initial" || point.frame < endFrame);
  const changes = new Map((result.playerHealthEvents ?? []).map(event => [event.id, event]));
  const damages = new Map(result.playerDamageEvents.map(event => [event.id, event]));
  const maxima = new Map((result.playerMaxHpEvents ?? []).map(event => [event.id, event]));
  const dynamicMaxHp = result.config.playerMaxHpModel !== undefined;
  const actorName = (id: string): string => esc(result.config.characters.find(actor => actor.id === id)?.name ?? id);
  const bondEnabled = result.config.bondOfLifeModel !== undefined;
  const summaries = result.playerHpSummaries.map(summary => {
    const last = points.filter(point => point.actorId === summary.actorId).at(-1);
    const lastDebt = (result.playerHealthEvents ?? []).filter(event => event.targetActorId === summary.actorId && event.frame < endFrame).at(-1)?.bondOfLife?.debtAfter ?? summary.initialBondOfLife;
    return `<tr data-player-health-summary="${esc(summary.actorId)}"><td>${actorName(summary.actorId)}</td><td>${num(summary.maxHp)}${dynamicMaxHp ? ` → ${num(last?.maxHp ?? summary.maxHp)}` : ""}</td><td>${num(summary.initialHp)}</td><td>${num(last?.hpAfter ?? summary.initialHp)}</td>${bondEnabled ? `<td>${num(summary.initialBondOfLife!)} → ${num(lastDebt!)}</td>` : ""}</tr>`;
  }).join("");
  root.innerHTML = `<h3>实际生命、治疗与生命消耗</h3><p>以下记录共用同一生命池，按模拟实际事件顺序展示。治疗溢出不计为恢复，生命消耗不是伤害，不消耗护盾。${dynamicMaxHp ? "已启用固定来源动态上限：增益变化保留生命比例，造成的绝对生命变化单独记账；不自动触发治疗、扣血或人物被动。" : "上限固定为初始面板。"}零生命继续执行，不代表已模拟死亡或复活。</p>${bondEnabled ? "<p>已启用默认来源生命之契：治疗加成结算后先抵债，清债同一口余量按所选来源假设立即回血；源码对此仍有 TODO，未经实机确认。人物治疗覆写与契约被动未自动映射。</p>" : "<p>未启用生命之契资源，本次生命计算明确以债务为零。</p>"}<div class="table-wrap"><table><thead><tr><th>角色</th><th>${dynamicMaxHp ? "初始 → 观察结束上限" : "生命上限"}</th><th>初始生命</th><th>观察结束生命</th>${bondEnabled ? "<th>初始 → 观察结束生命之契</th>" : ""}</tr></thead><tbody>${summaries}</tbody></table></div><div data-player-health-table></div>`;
  let page = 0;
  const draw = (): void => {
    const start = page * 25, end = Math.min(start + 25, points.length);
    const rows = points.slice(start, end).map(point => {
      const change = point.playerHealthEventId === undefined ? undefined : changes.get(point.playerHealthEventId);
      const damage = point.playerDamageEventId === null ? undefined : damages.get(point.playerDamageEventId);
      const maximum = point.playerMaxHpEventId === undefined ? undefined : maxima.get(point.playerMaxHpEventId);
      const detail = change ? `<details data-player-health-detail="${change.id}"><summary>公式、变量、代入与解释</summary><p>请求 ${num(change.requestedAmount)}；实际${change.operation === "heal" ? "恢复" : change.operation === "consume" ? "消耗" : "生命变化"} ${num(change.actualChange)}；溢出 ${num(change.overheal)}；消耗下限 ${num(change.minimumHp)}。</p>${change.bondOfLife === undefined ? "" : `<p>生命之契 ${num(change.bondOfLife.debtBefore)} → ${num(change.bondOfLife.debtAfter)}；治疗抵债 ${num(change.bondOfLife.absorbedHealing)}，抵债后可用治疗 ${num(change.bondOfLife.healingAfterDebt)}。来源 OnHPDebt ${change.bondOfLife.sourceEventEmitted ? `产生数值 ${num(change.bondOfLife.sourceCallbackAmount)}` : "不产生事件（零请求或生命消耗）"}；该事实不自动触发未映射人物／装备。</p>`}<div data-player-health-trace="${change.id}"></div><pre>${esc(JSON.stringify(change, null, 2))}</pre></details>`
        : maximum ? `<details data-player-max-hp-detail="${maximum.id}"><summary>最大生命变化公式与状态</summary><p>最大生命 ${num(maximum.maxHpBefore)} → ${num(maximum.maxHpAfter)}；保留生命比例 ${num(maximum.hpRatioAfter)}；上限导致的生命调整 ${num(maximum.hpAdjustment)}。${maximum.bondOfLifeAfter === undefined ? "" : `生命之契保持 ${num(maximum.bondOfLifeAfter)}，不会因上限变化提前钳制。`}此项不是治疗、生命消耗或伤害。</p><div data-player-max-hp-trace="${maximum.id}"></div><pre>${esc(JSON.stringify(maximum, null, 2))}</pre></details>`
        : damage ? `<details><summary>反应自伤与护盾结算记录</summary><pre>${esc(JSON.stringify(damage, null, 2))}</pre></details>` : "—";
      return `<tr data-player-health-operation="${point.operation}"${change ? ` data-player-health-event="${change.id}"` : ""}${maximum ? ` data-player-max-hp-event="${maximum.id}"` : ""}><td>${point.frame}f / ${num(point.timeSeconds)}s</td><td>${actorName(point.actorId)}</td><td>${operations[point.operation]}${change ? `<small>来源 ${actorName(change.sourceActorId)} · ${esc(change.changeId)}</small>` : ""}</td><td>${num(point.hpBefore)} → ${num(point.hpAfter)}</td><td>${detail}</td></tr>`;
    }).join("");
    root.querySelector("[data-player-health-table]")!.innerHTML = `<div class="table-wrap"><table><thead><tr><th>帧 / 秒</th><th>接收角色</th><th>操作 / 来源</th><th>实际生命前 → 后</th><th>执行计算</th></tr></thead><tbody>${rows}</tbody></table></div><div class="editor-actions"><button type="button" data-player-health-page="-1"${start === 0 ? " disabled" : ""}>上一页</button><span role="status">${points.length ? start + 1 : 0}–${end} / ${points.length} 条</span><button type="button" data-player-health-page="1"${end === points.length ? " disabled" : ""}>下一页</button></div>`;
  };
  root.onclick = event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-player-health-page]");
    if (!button || button.disabled) return;
    page += Number(button.dataset.playerHealthPage); draw();
    (root.querySelector<HTMLButtonElement>(`[data-player-health-page="${button.dataset.playerHealthPage}"]:not(:disabled)`) ?? root.querySelector<HTMLButtonElement>("[data-player-health-page]:not(:disabled)"))?.focus();
  };
  root.addEventListener("toggle", event => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.open || !(details.hasAttribute("data-player-health-detail") || details.hasAttribute("data-player-max-hp-detail"))) return;
    const isMaximum = details.hasAttribute("data-player-max-hp-detail");
    const host = details.querySelector<HTMLElement>(isMaximum ? "[data-player-max-hp-trace]" : "[data-player-health-trace]")!;
    if (host.dataset.mounted) return;
    host.innerHTML = renderTraceHtml((isMaximum ? maxima.get(Number(details.dataset.playerMaxHpDetail))! : changes.get(Number(details.dataset.playerHealthDetail))!).trace as CalculationTraceNode[]);
    host.dataset.mounted = "true";
  }, true);
  draw();
}
