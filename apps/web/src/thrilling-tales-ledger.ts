import { THRILLING_TALES_SOURCE_PROFILE, type SimulationResult, type ThrillingTalesLogEntry } from "@genshin-dps-lab/schemas";
import { renderTraceHtml } from "./calculator-trace-view";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
const frameText = (frame: number | null): string => frame === null ? "无记录" : `${frame}f`;
const PAGE_SIZE = 25;
const outcomes: Record<ThrillingTalesLogEntry["outcome"], string> = {
  applied: "已给予接收者增益", "owner-cooldown": "持有者冷却阻塞",
  "recipient-already-buffed": "接收者已有增益，未刷新"
};

function sourceLink(ref: string): string {
  return /^https?:\/\//.test(ref)
    ? `<a href="${esc(ref)}" target="_blank" rel="noopener noreferrer">${esc(ref)}</a>`
    : `<code>${esc(ref)}</code>`;
}

/** Actual swap decisions and recorded buff intervals; the shared core verifies hit snapshots. */
export function renderThrillingTalesLedger(root: HTMLElement, result: SimulationResult,
  window?: { startTick: number; endTick: number }): void {
  const allEntries = result.thrillingTalesLog ?? [];
  root.onclick = null;
  root.hidden = result.config.thrillingTalesModel === undefined && allEntries.length === 0;
  if (root.hidden) { root.replaceChildren(); return; }
  const startTick = window?.startTick ?? 0;
  const endTick = window?.endTick ?? Infinity;
  const inWindow = (frame: number): boolean => frame >= startTick && frame < endTick;
  const entries = allEntries.filter(entry => inWindow(entry.frame) ||
    (entry.outcome === "applied" && entry.frame < startTick &&
      entry.recipientExpiresFrameAfter !== null && entry.recipientExpiresFrameAfter > startTick));
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const appliedByExpiry = new Map<string, ThrillingTalesLogEntry>();
  const existingByDecision = new Map<number, ThrillingTalesLogEntry>();
  for (const entry of allEntries) {
    const key = `${entry.recipientId}:${entry.recipientExpiresFrameAfter}`;
    if (entry.outcome === "applied") appliedByExpiry.set(key, entry);
    else if (entry.outcome === "recipient-already-buffed") {
      const existing = appliedByExpiry.get(key);
      if (existing) existingByDecision.set(entry.id, existing);
    }
  }
  const candidatesByRecipient = new Map<string, SimulationResult["damageEvents"]>();
  for (const event of result.damageEvents) {
    if (!inWindow(event.frame)) continue;
    const candidates = candidatesByRecipient.get(event.scalingOwnerId) ?? [];
    candidates.push(event);
    candidatesByRecipient.set(event.scalingOwnerId, candidates);
  }
  const actorName = (id: string): string => esc(result.config.characters.find(actor => actor.id === id)?.name ?? id);
  const profile = THRILLING_TALES_SOURCE_PROFILE;
  const windowText = window === undefined ? "显示本次模拟的全部实际切换判定。"
    : `观察窗口为 [${startTick}, ${endTick})，起始帧计入、结束帧不计入。窗口前已施加、记录的增益区间覆盖窗口起点的行作为承接记录，不计作窗内触发。`;
  root.innerHTML = `<h3>讨龙英杰谭切换与增益记录</h3><p>${windowText}</p><p>本固定来源的持有者冷却为 ${profile.cooldownFrames}f，增益名义持续 ${profile.durationFrames}f；增益给予实际切入的接收者。持有者冷却到期帧仍阻塞；接收者已有增益时，本次仍消耗持有者冷却，且不刷新原增益。</p><p>此表按切换与已记录的增益区间展示；增益结束后仍可能被先前的行动快照保留，具体贡献以命中还原为准。接收者状态在到期帧的存在性检查与实际属性取样不同，取决于已发生的事件顺序。此来源假设没有角色卡肉，未经当前游戏实测。</p><div data-thrilling-tales-table></div>`;
  let page = 0;

  const mountDetails = (details: HTMLDetailsElement, entry: ThrillingTalesLogEntry): void => {
    const host = details.querySelector<HTMLElement>("[data-thrilling-tales-detail-body]")!;
    if (host.dataset.mounted) return;
    host.dataset.mounted = "true";
    const applied = entry.outcome === "applied" ? entry : existingByDecision.get(entry.id);
    const explanation = entry.outcome === "applied"
      ? `持有者 ${actorName(entry.ownerId)} 实际切出后，接收者 ${actorName(entry.recipientId)} 获得本次增益。`
      : entry.outcome === "owner-cooldown"
      ? "本次在持有者冷却检查处返回，未查询接收者状态；日志中的空值不表示接收者没有增益。"
      : "接收者已有共享讨龙增益，本次不添加、不叠加，也不刷新；持有者已开始新的冷却。";
    const recipientState = entry.outcome === "owner-cooldown" ? "未查询接收者状态。"
      : `接收者记录的到期帧：${frameText(entry.recipientExpiresFrameBefore)} → ${frameText(entry.recipientExpiresFrameAfter)}。`;
    const existing = entry.outcome !== "recipient-already-buffed" ? ""
      : applied ? `<p>实际已有增益来自记录 #${applied.id}：${actorName(applied.ownerId)} → ${actorName(applied.recipientId)}，${applied.frame}f 施加，R${applied.refinement}，记录系数 ${num(applied.coefficient)}，记录到期帧 ${frameText(applied.recipientExpiresFrameAfter)}。本次受阻持有者的预期系数 ${num(entry.coefficient)} 不替代已有增益。</p>`
      : "<p>此结果中未找到对应接收者与到期帧的实际施加记录，无法由本次受阻记录确定已有增益系数。</p>";
    const command = entry.timelineCommandIndex === null ? "无时间轴命令索引" : `时间轴命令 #${entry.timelineCommandIndex}`;
    const action = entry.actionLogIndex === null ? "无成功动作记录索引" : `动作记录 #${entry.actionLogIndex}`;
    const skipped = entry.skippedActionIndex === null ? "" : `；跳过动作记录 #${entry.skippedActionIndex}`;
    host.innerHTML = `${inWindow(entry.frame) ? "" : '<p class="calculator-hint">窗口前已施加，记录的增益区间延续到窗口内；不计作窗内触发。</p>'}<p>${explanation}</p><p>持有者冷却到期帧：${frameText(entry.cooldownExpiresFrameBefore)} → ${frameText(entry.cooldownExpiresFrameAfter)}。${recipientState}</p>${existing}<p>实际切换 ${entry.frame}f / ${num(entry.timeSeconds)}s；${entry.swapKind === "legal-completed" ? "合法动作模型完成的切换" : "旧版轮转隐式切换"}。动作 ${esc(entry.actionId)}，循环 ${entry.cycle}，${command}；${action}${skipped}。事件优先级 ${entry.eventPriority}，队列序号 ${entry.eventSequence}。</p><p>固定规则 ${esc(entry.sourceProfileId)}；来源：${sourceLink(entry.sourceRef)}。</p>${applied ? `<section data-thrilling-tales-hit-candidates><h4>接收者实际命中：展开核验是否包含记录 #${applied.id} 的增益</h4><p>候选仅按伤害事件的实际倍率归属者筛选，不根据交付帧或当前状态推断快照。只有共享核心还原确认后，才标明该命中快照包含本次讨龙增益；实际伤害是否使用攻击力由公式解释。</p><div data-thrilling-tales-hit-list></div></section>` : ""}<details><summary>完整切换记录</summary><pre>${esc(JSON.stringify({ decision: entry, existingApplied: entry.outcome === "recipient-already-buffed" ? applied ?? null : null }, null, 2))}</pre></details>`;
    if (!applied) return;
    const candidates = candidatesByRecipient.get(applied.recipientId) ?? [];
    let hitPage = 0;
    const drawHits = (): void => {
      const start = hitPage * PAGE_SIZE, end = Math.min(start + PAGE_SIZE, candidates.length);
      const list = host.querySelector<HTMLElement>("[data-thrilling-tales-hit-list]")!;
      list.innerHTML = candidates.length ? candidates.slice(start, end).map(event =>
        `<details data-thrilling-tales-hit-detail="${event.id}"><summary>命中 #${event.id} · ${event.frame}f / ${num(event.timeSeconds)}s · ${esc(event.actionName)} / ${esc(event.hitLabel)} · ${esc(event.targetName)} · 伤害 ${num(event.finalDamage)}</summary><div data-thrilling-tales-hit-trace="${event.id}"></div></details>`).join("") +
        `<div class="editor-actions"><button type="button" data-thrilling-tales-hit-page="-1"${start === 0 ? " disabled" : ""}>上一页命中</button><span role="status">${start + 1}–${end} / ${candidates.length} 个候选命中</span><button type="button" data-thrilling-tales-hit-page="1"${end === candidates.length ? " disabled" : ""}>下一页命中</button></div>`
        : '<p data-thrilling-tales-no-hits>当前区间没有以该接收者为倍率归属者的实际伤害事件。</p>';
      for (const hitDetails of list.querySelectorAll<HTMLDetailsElement>("[data-thrilling-tales-hit-detail]")) {
        hitDetails.ontoggle = async () => {
          if (!hitDetails.open) return;
          const traceHost = hitDetails.querySelector<HTMLElement>("[data-thrilling-tales-hit-trace]")!;
          if (traceHost.dataset.mounted) return;
          traceHost.dataset.mounted = "true";
          traceHost.textContent = "正在还原该命中的真实快照与共享公式……";
          const eventId = Number(hitDetails.dataset.thrillingTalesHitDetail);
          try {
            const { replaySimulationHit } = await import("@genshin-dps-lab/sim-core");
            const replay = replaySimulationHit({ schemaVersion: "calculator-event-v1", eventId, sourceResult: result });
            const includesApplied = replay.thrillingTales?.some(row => row.id === applied.id) ?? false;
            traceHost.innerHTML = `<p data-thrilling-tales-replay="${eventId}" data-thrilling-tales-snapshot-includes="${includesApplied}">${includesApplied ? `该命中快照包含本次讨龙增益（实际施加记录 #${applied.id}）。` : `该命中快照不含本次讨龙增益（实际施加记录 #${applied.id}），不将其他施加记录或属性来源归于本次。`}</p><p>原始伤害 ${num(replay.originalDamage)} · 共享核心还原 ${num(replay.reproducedDamage)} · 差值 ${esc(replay.difference)}</p>${includesApplied ? renderTraceHtml(replay.trace) : ""}`;
          } catch (error) {
            traceHost.innerHTML = `<p class="calculator-error">本次命中还原阻塞：${esc(error instanceof Error ? error.message : error)}</p>`;
          }
        };
      }
      for (const button of list.querySelectorAll<HTMLButtonElement>("[data-thrilling-tales-hit-page]")) {
        button.onclick = () => {
          const direction = button.dataset.thrillingTalesHitPage!;
          hitPage += Number(direction); drawHits();
          (list.querySelector<HTMLButtonElement>(`[data-thrilling-tales-hit-page="${direction}"]:not(:disabled)`) ?? list.querySelector<HTMLButtonElement>("[data-thrilling-tales-hit-page]:not(:disabled)"))?.focus();
        };
      }
    };
    drawHits();
  };

  const draw = (): void => {
    const start = page * PAGE_SIZE, end = Math.min(start + PAGE_SIZE, entries.length);
    const rows = entries.slice(start, end).map(entry => `<tr data-thrilling-tales-id="${entry.id}" data-thrilling-tales-outcome="${entry.outcome}" data-thrilling-tales-frame="${entry.frame}" data-thrilling-tales-decision-in-window="${inWindow(entry.frame)}"><td>${entry.frame}f / ${num(entry.timeSeconds)}s${inWindow(entry.frame) ? "" : '<small data-thrilling-tales-carry-in>窗口前施加，增益区间承接</small>'}</td><td>${actorName(entry.ownerId)} → ${actorName(entry.recipientId)}<small>持有者 R${entry.refinement} · ${entry.outcome === "applied" ? "实际施加" : "本持有者预期"}系数 ${num(entry.coefficient)}</small></td><td>${outcomes[entry.outcome]}${entry.outcome === "recipient-already-buffed" ? "<small>本次仍消耗持有者冷却</small>" : ""}</td><td>${frameText(entry.cooldownExpiresFrameBefore)} → ${frameText(entry.cooldownExpiresFrameAfter)}<small>到期帧仍阻塞</small></td><td>${entry.outcome === "owner-cooldown" ? "未查询接收者状态" : `${frameText(entry.recipientExpiresFrameBefore)} → ${frameText(entry.recipientExpiresFrameAfter)}`}</td><td><details data-thrilling-tales-detail="${entry.id}"><summary>判定原因、真实快照与公式</summary><div data-thrilling-tales-detail-body></div></details></td></tr>`).join("");
    root.querySelector<HTMLElement>("[data-thrilling-tales-table]")!.innerHTML = entries.length
      ? `<div class="table-wrap"><table><thead><tr><th scope="col">实际切换帧 / 秒</th><th scope="col">持有者 → 接收者</th><th scope="col">实际判定</th><th scope="col">持有者冷却到期帧</th><th scope="col">接收者记录到期帧</th><th scope="col">记录与公式</th></tr></thead><tbody>${rows}</tbody></table></div><div class="editor-actions"><button type="button" data-thrilling-tales-page="-1"${start === 0 ? " disabled" : ""}>上一页</button><span role="status" data-thrilling-tales-page-status>${start + 1}–${end} / ${entries.length} 条</span><button type="button" data-thrilling-tales-page="1"${end === entries.length ? " disabled" : ""}>下一页</button></div>`
      : '<p data-thrilling-tales-empty>此区间没有讨龙切换判定，也没有记录的增益区间从窗口前延续到窗口内。</p>';
    for (const details of root.querySelectorAll<HTMLDetailsElement>("[data-thrilling-tales-detail]")) {
      details.ontoggle = () => { if (details.open) mountDetails(details, byId.get(Number(details.dataset.thrillingTalesDetail))!); };
    }
  };
  root.onclick = event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-thrilling-tales-page]");
    if (!button || button.disabled) return;
    const direction = button.dataset.thrillingTalesPage!;
    page += Number(direction); draw();
    (root.querySelector<HTMLButtonElement>(`[data-thrilling-tales-page="${direction}"]:not(:disabled)`) ?? root.querySelector<HTMLButtonElement>("[data-thrilling-tales-page]:not(:disabled)"))?.focus();
  };
  draw();
}
