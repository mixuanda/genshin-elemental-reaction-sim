import type { ArtifactDamageLogEntry, ArtifactDamageState, SimulationResult } from "@genshin-dps-lab/schemas";
import type { CalculationTraceNode } from "@genshin-dps-lab/sim-core";
import { ARTIFACT_DAMAGE_PROFILE, artifactDamageTrace, artifactDamageTransitionTrace } from "../../../packages/sim-core/src/artifact-damage-runtime";
import { artifactDamageLabels } from "./artifact-damage-controls";
import { renderTraceHtml } from "./calculator-trace-view";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
const PAGE_SIZE = 25;
const outcomes: Record<ArtifactDamageLogEntry["outcome"], string> = {
  "off-field": "要求在场的角色未在场", "wrong-owner": "伤害来源不是持有者", "ineligible-tag": "命中标签不适用",
  "rite-active": "沿用来歆窗口", "cooldown-blocked": "仍在触发冷却", "roll-failed": "本次抽样失败",
  "rite-triggered": "本次触发来歆", "recorded-healing": "已记录请求治疗", "waves-created": "已封存治疗并建立浪潮",
  "waves-inactive": "没有可用浪潮", "waves-consumed": "消费一次浪潮",
};
const kinds: Record<ArtifactDamageLogEntry["kind"], string> = { "enemy-hit": "实际目标命中回调", heal: "实际治疗回调", "song-convert": "六秒记录期转换" };
const tags: Record<string, string> = { normal: "普通攻击", charged: "重击", plunge: "下落攻击", skill: "元素战技", burst: "元素爆发" };
const sourceLink = (source: string): string => /^https?:\/\//.test(source)
  ? `<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">${esc(source)}</a>` : `<code>${esc(source)}</code>`;

function stateHtml(state: ArtifactDamageState): string {
  return `${state.echoes.length ? `<div class="table-wrap"><table><thead><tr><th>余响持有者</th><th>下一抽样阈值</th><th>冷却到期帧</th><th>来歆到期帧</th></tr></thead><tbody>${state.echoes.map(owner => `<tr><td>${esc(owner.actorId)}</td><td>${esc(owner.probability)}</td><td>${owner.cooldownExpiresFrame}</td><td>${owner.riteExpiresFrame}</td></tr>`).join("")}</tbody></table></div>` : ""}<dl><dt>昔时共享待封存治疗量</dt><dd>${num(state.song.healingPool)}</dd><dt>记录期到期帧</dt><dd>${state.song.yearningExpiresFrame}</dd><dt>已封存治疗量</dt><dd>${num(state.song.waveHealing)}</dd><dt>浪潮到期帧／剩余次数</dt><dd>${state.song.wavesExpiresFrame}f ／ ${state.song.charges}</dd></dl>`;
}

/** The same core AST computes the runtime transition and its displayed substitution. */
function transitionHtml(entry: ArtifactDamageLogEntry): string {
  const trace = artifactDamageTransitionTrace(entry);
  return trace.length
    ? `<section data-artifact-damage-transitions><h4>来源状态规则与本次代入</h4>${renderTraceHtml(trace)}</section>`
    : "<p>本次没有新增数值状态转换；前置条件与实际状态见下方记录。</p>";
}

/** Normal result ledger, shared by the full run, selected windows and startup views. */
export function renderArtifactDamageLedger(root: HTMLElement, result: SimulationResult, window?: { startTick: number; endTick: number }): void {
  const allEntries = result.artifactDamageLog ?? [];
  root.onclick = null;
  root.hidden = !result.config.artifactDamageModel && !allEntries.length;
  if (root.hidden) { root.replaceChildren(); return; }
  const start = window?.startTick ?? 0, end = window?.endTick ?? Infinity;
  const entries = allEntries.filter(entry => entry.frame >= start && entry.frame < end);
  const placement = (frame: number): string => window === undefined ? "本次模拟内" : frame < start ? "窗口之前，仅作来源引用" : frame >= end ? "窗口之后，仅作来源引用" : "窗口内";
  const actorName = (id: string | null): string => id === null ? "无" : esc(result.config.characters.find(actor => actor.id === id)?.name ?? id);
  const damageById = new Map(result.damageEvents.map(event => [event.id, event]));
  const healthById = new Map((result.playerHealthEvents ?? []).map(event => [event.id, event]));
  const hitById = new Map(result.hitResolutionLog.map(event => [event.id, event]));
  const logsById = new Map(allEntries.map(entry => [entry.id, entry]));
  const multipleSong = (result.config.artifactDamageModel?.actors.filter(actor => actor.effectId === "song-of-days-past-4pc").length ?? 0) > 1;
  root.innerHTML = `<h3>余响与昔时：实际伤害附加记录</h3><p>${window ? `仅列观察窗口 [${start}, ${end})f 内记录，结束帧不计入。` : "显示本次模拟实际发生的回调与转换。"}关联事件可能位于窗口之外，并明确标注来源区间；不补造未来触发。</p><p>加值进入宿主命中的基础伤害，继续使用该命中的增伤、反应、防御、抗性和暴击。它不是独立追击，也不另掷暴击；下表数值不能再加到已包含它的总伤害上。</p>${multipleSong ? '<p class="notice">多个昔时持有者共享记录池与次数，同一命中会按固定源码的持有者顺序重复消费并加值。这一来源行为未经实机确认。</p>' : ""}<div data-artifact-damage-table></div>${window === undefined && result.artifactDamageState ? `<details><summary>实际模拟结束时保存的状态与随机流</summary>${stateHtml(result.artifactDamageState.state)}<p>这些到期帧与次数是保存的状态字段，不表示模拟结束后仍可触发；是否有效须在实际事件帧判断。</p>${result.artifactDamageState.random ? `<p>独立随机算法 ${esc(result.artifactDamageState.random.algorithm)}；累计抽样 ${result.artifactDamageState.random.drawCount} 次。完整内部状态随结果 JSON 保存，不宣称与游戏或 gcsim 同种子同序列。</p>` : "<p>未启用余响随机流。</p>"}</details>` : ""}<details><summary>来源与明确假设</summary><p>${ARTIFACT_DAMAGE_PROFILE.id} · ${ARTIFACT_DAMAGE_PROFILE.evidence}</p><ul>${ARTIFACT_DAMAGE_PROFILE.assumptions.map(note => `<li>${esc(note)}</li>`).join("")}</ul><p>${Object.values(ARTIFACT_DAMAGE_PROFILE.sourceRefs).map(sourceLink).join("；")}</p><p>完整配置、逐条状态、父命中／治疗关联与随机流均随「导出运行记录」保存；导入运行记录会按保存的输入与随机种子重新执行，核对原结果；实际宿主命中也可送入单击计算器。</p></details>`;
  let page = 0;
  const detailsHtml = (entry: ArtifactDamageLogEntry): string => {
    const parent = entry.parentDamageEventId === null ? undefined : damageById.get(entry.parentDamageEventId);
    const healing = entry.playerHealthEventId === null ? undefined : healthById.get(entry.playerHealthEventId);
    const hit = entry.hitResolutionLogId === null ? undefined : hitById.get(entry.hitResolutionLogId);
    const previous = entry.parentLogId === null ? undefined : logsById.get(entry.parentLogId);
    const trace = artifactDamageTrace([entry]);
    return `<p>事件 #${entry.id}：${kinds[entry.kind]}，${entry.frame}f / ${num(entry.timeSeconds)}s；队列优先级 ${entry.eventPriority}，序号 ${entry.eventSequence}，事件内序号 ${entry.intraEventSequence}。同帧先后顺序来自这条实际执行记录。</p><p>条款持有者 ${actorName(entry.actorId)}；实际来源 ${actorName(entry.sourceActorId)}；前台 ${actorName(entry.activeCharacterId)}；目标 ${esc(entry.targetId ?? "不适用")}；标签 ${esc(tags[entry.attackTag ?? ""] ?? entry.attackTag ?? "不适用")}。</p>${entry.random ? `<section data-artifact-damage-random><h4>实际随机判定</h4><p>抽样索引 ${entry.random.drawIndex}；<code>roll = ${esc(entry.random.roll)}</code>，本次阈值 <code>p = ${esc(entry.random.probability)}</code>。来源成功条件是 <code>roll ≤ p</code>，本次结果：${outcomes[entry.outcome]}。失败阈值递增；抽样概率不作为本次已触发加值的乘数。</p></section>` : "<p>本次没有随机抽样；沿用窗口或被前置条件返回均不补抽样。</p>"}<section data-artifact-damage-formula>${trace.length ? renderTraceHtml(trace) : `<p>本次记录的加算基伤为 ${num(entry.flatDamage)}。${entry.kind === "enemy-hit" ? `实际判定：${outcomes[entry.outcome]}；未执行附加基伤公式。` : "此记录是治疗或窗口转换，不是伤害命中。"}</p>`}</section>${transitionHtml(entry)}${parent ? `<p>宿主伤害 #${parent.id} · ${parent.frame}f · ${placement(parent.frame)} · 已包含本次附加的实际伤害 ${num(parent.finalDamage)}。</p><details data-artifact-damage-hit-detail="${parent.id}"><summary>还原完整宿主命中的公式、变量与代入</summary><div data-artifact-damage-hit-trace></div></details>` : ""}${hit ? `<p>实际命中判定 #${hit.id} · ${hit.frame}f · ${placement(hit.frame)} · ${esc(hit.outcome)}；实际伤害 ${num(hit.finalDamage)}。</p>` : ""}${healing ? `<section><h4>关联的实际治疗 #${healing.id}</h4><p>${healing.frame}f · ${placement(healing.frame)}；请求量 ${num(healing.requestedAmount)}，实际生命增加 ${num(healing.actualChange)}，溢出 ${num(healing.overheal)}；生命 ${num(healing.hpBefore)} → ${num(healing.hpAfter)}。昔时记录请求量，不改用实际回血或溢出量。</p>${renderTraceHtml(healing.trace as CalculationTraceNode[])}</section>` : ""}${previous ? `<p>启动本次转换的治疗记录 #${previous.id} · ${previous.frame}f · ${placement(previous.frame)}；本轮封存量仍以转换时记录池为准。</p>` : ""}<details><summary>回调前的完整状态</summary>${stateHtml(entry.stateBefore)}</details><details><summary>回调后的完整状态</summary>${stateHtml(entry.stateAfter)}</details><p>本条来源 ${sourceLink(entry.sourceRef)}。</p><details><summary>完整原始账本与关联记录</summary><pre>${esc(JSON.stringify({ artifact: entry, damage: parent ?? null, hit: hit ?? null, healing: healing ?? null, parentArtifact: previous ?? null }, null, 2))}</pre></details>`;
  };
  const draw = (): void => {
    const first = page * PAGE_SIZE, last = Math.min(first + PAGE_SIZE, entries.length);
    root.querySelector<HTMLElement>("[data-artifact-damage-table]")!.innerHTML = entries.length ? `<div class="table-wrap"><table><thead><tr><th>帧／秒</th><th>条款／持有者</th><th>实际结果</th><th>加算基伤</th><th>次数／详情</th></tr></thead><tbody>${entries.slice(first, last).map(entry => `<tr data-artifact-damage-log-id="${entry.id}"><td>${entry.frame}f / ${num(entry.timeSeconds)}s</td><td>${artifactDamageLabels[entry.effectId]}<small>${actorName(entry.actorId)}</small></td><td>${outcomes[entry.outcome]}<small>${kinds[entry.kind]}</small></td><td>${num(entry.flatDamage)}</td><td>${entry.effectId === "song-of-days-past-4pc" ? `浪潮 ${entry.stateBefore.song.charges} → ${entry.stateAfter.song.charges}` : entry.random ? `抽样 #${entry.random.drawIndex}` : "未抽样"}<details data-artifact-damage-detail="${entry.id}"><summary>实际公式、状态与来源</summary><div data-artifact-damage-detail-body></div></details></td></tr>`).join("")}</tbody></table></div><div class="editor-actions"><button type="button" data-artifact-damage-page="-1"${first === 0 ? " disabled" : ""}>上一页</button><span role="status">${first + 1}–${last} / ${entries.length} 条</span><button type="button" data-artifact-damage-page="1"${last >= entries.length ? " disabled" : ""}>下一页</button></div>` : "<p>此区间没有实际回调或转换；未把空记录解释为未来不会触发。</p>";
    for (const details of root.querySelectorAll<HTMLDetailsElement>("[data-artifact-damage-detail]")) details.ontoggle = () => {
      const host = details.querySelector<HTMLElement>("[data-artifact-damage-detail-body]")!;
      if (!details.open || host.dataset.mounted) return;
      host.dataset.mounted = "true";
      host.innerHTML = detailsHtml(logsById.get(Number(details.dataset.artifactDamageDetail))!);
      for (const hitDetails of host.querySelectorAll<HTMLDetailsElement>("[data-artifact-damage-hit-detail]")) hitDetails.ontoggle = async () => {
        const traceHost = hitDetails.querySelector<HTMLElement>("[data-artifact-damage-hit-trace]")!;
        if (!hitDetails.open || traceHost.dataset.mounted) return;
        traceHost.dataset.mounted = "true"; traceHost.textContent = "正在还原共享计算上下文……";
        try {
          const { replaySimulationHit } = await import("@genshin-dps-lab/sim-core");
          const replay = replaySimulationHit({ schemaVersion: "calculator-event-v1", eventId: Number(hitDetails.dataset.artifactDamageHitDetail), sourceResult: result });
          traceHost.innerHTML = `<p>原始伤害 ${num(replay.originalDamage)} · 共享核心还原 ${num(replay.reproducedDamage)} · 差值 ${esc(replay.difference)}</p>${renderTraceHtml(replay.trace)}`;
        } catch (error) { traceHost.innerHTML = `<p class="calculator-error">本次命中还原阻塞：${esc(error instanceof Error ? error.message : error)}</p>`; }
      };
    };
  };
  root.onclick = event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-artifact-damage-page]");
    if (!button || button.disabled) return;
    page += Number(button.dataset.artifactDamagePage); draw();
    root.querySelector<HTMLButtonElement>(`[data-artifact-damage-page="${button.dataset.artifactDamagePage}"]:not(:disabled)`)?.focus();
  };
  draw();
}
