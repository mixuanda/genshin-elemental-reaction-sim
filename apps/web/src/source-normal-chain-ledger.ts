import type { SimulationResult } from "@genshin-dps-lab/schemas";
import type { SourceNormalChainState } from "../../../packages/schemas/src/source-normal-chain";
import { SOURCE_NORMAL_CHAIN_PROFILE } from "../../../packages/sim-core/src/source-normal-chain";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const PAGE_SIZE = 25;

/** Display actual accepted-input decisions; no reconstructed counters or hit-based guesses. */
export function renderSourceNormalChainLedger(root: HTMLElement, result: SimulationResult, endFrame = Infinity): void {
  const entries = (result.sourceNormalChainLog ?? []).filter(entry => entry.frame < endFrame);
  root.hidden = entries.length === 0;
  if (root.hidden) { root.replaceChildren(); return; }
  const actorName = (id: string): string => result.config.characters.find(actor => actor.id === id)?.name ?? id;
  const stateText = (state: SourceNormalChainState): string => state.actors.map(actor => `${actorName(actor.actorId)}：下次 N${actor.nextIndex} / ${actor.length}`).join("；");
  const labels = { "normal-accepted": "普攻已接受并推进", "non-normal-reset": "成功非普攻：全队重置", "swap-start-reset": "真实切人起手：全队重置", "swap-complete-reset": "真实切人完成：全队重置" };
  let page = 0;
  root.innerHTML = `<h3>来源普攻连段实际状态</h3><p>只展示同一次模拟实际接受输入后的状态。N3 后接 N2 会继续连段；等待、动画自然结束和拒绝输入不重置，也没有连段超时。命中、落空及箭的飞行尾段不改变下次段号。拒绝原因请查看对应行动执行记录。</p><p>固定源码参考假定 · <code>${esc(SOURCE_NORMAL_CHAIN_PROFILE.id)}</code>，不代表游戏实测认证。</p><details><summary>来源与适用范围</summary><ul>${SOURCE_NORMAL_CHAIN_PROFILE.assumptions.map(note => `<li>${esc(note)}</li>`).join("")}</ul>${SOURCE_NORMAL_CHAIN_PROFILE.sourceRefs.map(ref => `<a href="${esc(ref)}" target="_blank" rel="noopener noreferrer">${esc(ref)}</a>`).join("<br>")}</details><div data-source-normal-chain-table></div>`;
  const draw = (): void => {
    const start = page * PAGE_SIZE, end = Math.min(start + PAGE_SIZE, entries.length);
    root.querySelector<HTMLElement>("[data-source-normal-chain-table]")!.innerHTML = `<div class="table-wrap"><table><thead><tr><th>实际帧／顺序</th><th>输入与执行结果</th><th>全队下次段号：前 → 后</th><th>实际行动与来源</th></tr></thead><tbody>${entries.slice(start, end).map(entry => {
      const action = entry.actionLogIndex === null ? null : result.actionLog[entry.actionLogIndex] ?? null;
      return `<tr data-source-normal-chain-log="${entry.id}" data-source-normal-chain-kind="${entry.kind}" data-source-normal-chain-frame="${entry.frame}"><td>${entry.frame}f / ${entry.timeSeconds}s<small>${entry.eventPriority} / ${entry.eventSequence} / ${entry.intraEventSequence}</small></td><td>${esc(actorName(entry.actorId))} · ${labels[entry.kind]}${entry.normalIndex === null ? "" : `<br>本次 N${entry.normalIndex}`}</td><td>${esc(stateText(entry.stateBefore))}<br>→ ${esc(stateText(entry.stateAfter))}</td><td><details data-source-normal-chain-detail="${entry.id}"><summary>查看行动链接与完整状态</summary><p>指令 ${entry.timelineCommandIndex === null ? "无" : entry.timelineCommandIndex + 1}；行动记录 ${entry.actionLogIndex === null ? "无" : `#${entry.actionLogIndex}`}；来源能力 <code>${esc(entry.sourceAbilityId ?? "无")}</code>；实际行动 <code>${esc(entry.actionId ?? "无")}</code>。</p><pre>${esc(JSON.stringify({ decision: entry, action }, null, 2))}</pre></details></td></tr>`;
    }).join("")}</tbody></table></div><div class="editor-actions"><button type="button" data-source-normal-chain-page="-1"${page === 0 ? " disabled" : ""}>上一页</button><span role="status">${start + 1}–${end} / ${entries.length} 条</span><button type="button" data-source-normal-chain-page="1"${end === entries.length ? " disabled" : ""}>下一页</button></div>`;
  };
  root.onclick = event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-source-normal-chain-page]");
    if (!button || button.disabled) return;
    page += Number(button.dataset.sourceNormalChainPage);
    draw();
  };
  draw();
}
