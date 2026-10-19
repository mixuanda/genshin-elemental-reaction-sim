import type { ArtifactEventLogEntry, NightsoulBurstLogEntry, SimulationResult, SkillCooldownLogEntry } from "@genshin-dps-lab/schemas";
import { ARTIFACT_EVENT_PROFILE, NIGHTSOUL_BURST_PROFILE } from "@genshin-dps-lab/sim-core";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
const frameText = (frame: number | null): string => frame === null ? "无记录" : `${frame}f`;
const PAGE_SIZE = 25;
const effects: Record<ArtifactEventLogEntry["effectId"], string> = {
  "exile-4pc": "流放者四件套", "scholar-4pc": "学士四件套", "gambler-4pc": "赌徒四件套", "scroll-2pc": "烬城勇者绘卷两件套"
};
const kinds: Record<ArtifactEventLogEntry["kind"], string> = {
  burst: "实际元素爆发", "particle-received": "实际拾取", "target-died": "实际击杀", "nightsoul-burst": "夜魂迸发回调", "exile-tick": "流放者回能任务"
};
const outcomes: Record<ArtifactEventLogEntry["outcome"], string> = {
  activated: "效果已激活", "off-field": "持有者不在场", "cooldown-blocked": "冷却阻塞（含到期帧）",
  "party-effect-active": "队伍流放者效果仍有效", "wrong-killer": "击杀来源不是持有者", "energy-granted": "已执行回能", "skill-reset": "已恢复一次战技充能"
};
const sourceLink = (ref: string): string => /^https?:\/\//.test(ref)
  ? `<a href="${esc(ref)}" target="_blank" rel="noopener noreferrer">${esc(ref)}</a>` : `<code>${esc(ref)}</code>`;
const stateHtml = (state: SkillCooldownLogEntry["stateAfter"]): string => `<p>可用充能 ${state.availableCharges} / ${state.maxCharges}；恢复任务起始 ${frameText(state.workerStartedFrame)}，任务代号 ${state.workerGeneration}。</p>${state.queue.length
  ? `<ol>${state.queue.map(item => `<li>${esc(item.castId)} · ${esc(item.abilityId)} · 记录恢复时长 ${item.recoveryFrames}f</li>`).join("")}</ol>`
  : "<p>实际串行冷却队列为空。</p>"}`;

/** All gains, cooldown transitions and parent links below come from the saved execution. */
export function renderArtifactEventLedger(root: HTMLElement, result: SimulationResult,
  window?: { startTick: number; endTick: number }): void {
  const allArtifacts = result.artifactEventLog ?? [], allNightsoul = result.nightsoulBurstLog ?? [];
  root.onclick = null;
  root.hidden = result.config.artifactEventModel === undefined && result.config.nightsoulBurstModel === undefined && allArtifacts.length === 0 && allNightsoul.length === 0;
  if (root.hidden) { root.replaceChildren(); return; }
  const startTick = window?.startTick ?? 0, endTick = window?.endTick ?? Infinity;
  const inWindow = (frame: number): boolean => frame >= startTick && frame < endTick;
  const placement = (frame: number): string => window === undefined ? "本次模拟内"
    : frame < startTick ? "窗口之前，仅作来源引用" : frame >= endTick ? "窗口之后，仅作来源引用" : "窗口内";
  const actorName = (id: string | null): string => id === null ? "无" : esc(result.config.characters.find(actor => actor.id === id)?.name ?? id);
  const artifacts = allArtifacts.filter(entry => inWindow(entry.frame)), nightsoul = allNightsoul.filter(entry => inWindow(entry.frame));
  const artifactsById = new Map(allArtifacts.map(entry => [entry.id, entry]));
  const nightsoulById = new Map(allNightsoul.map(entry => [entry.id, entry]));
  const energyById = new Map(result.energyLog.map(entry => [entry.id, entry]));
  const cooldownById = new Map((result.skillCooldownLog ?? []).map(entry => [entry.id, entry]));
  const healthById = new Map((result.targetHealthLog ?? []).map(entry => [entry.id, entry]));
  const particleById = new Map(result.particleEvents.map(entry => [entry.id, entry]));
  const damageById = new Map(result.damageEvents.map(entry => [entry.id, entry]));
  const rangeText = window === undefined ? "本次模拟实际发生的记录" : `观察窗口 [${startTick}, ${endTick})f 内实际发生的记录，结束帧不计入`;
  root.innerHTML = `<h3>圣遗物事件与夜魂迸发记录</h3><p>显示${rangeText}。关联事件若位于窗口外，只作来源引用。回能及战技队列直接读取执行日志，不补造未来任务。</p><p>有效套装、成员武器类型和纳塔参与资格来自情景声明；它们不是已认证的角色配装数据。固定来源假设没有角色卡肉，且不重复添加两件套面板属性。固定回能不乘充能效率；满能时仍可记录实际触发和能量溢出。</p><h4>四套装备的实际事件</h4><div data-artifact-event-table></div><h4>全队共享夜魂迸发</h4><p>实际元素伤害交付后的回调决定是否触发；共享冷却到期帧可以触发。烬城两件套只使用成功的夜魂迸发记录，不以固定时间表代替触发。</p><div data-nightsoul-burst-table></div><details><summary>固定来源与适用边界</summary><p>${esc(ARTIFACT_EVENT_PROFILE.id)}；${Object.values(ARTIFACT_EVENT_PROFILE.sourceRefs).map(sourceLink).join("；")}</p><ul>${ARTIFACT_EVENT_PROFILE.assumptions.map(note => `<li>${esc(note)}</li>`).join("")}</ul><p>${esc(NIGHTSOUL_BURST_PROFILE.id)}；${sourceLink(NIGHTSOUL_BURST_PROFILE.sourceRef)}</p><ul>${NIGHTSOUL_BURST_PROFILE.assumptions.map(note => `<li>${esc(note)}</li>`).join("")}</ul></details>`;
  let artifactPage = 0, nightsoulPage = 0;
  const pagination = (kind: "artifact" | "nightsoul", start: number, end: number, count: number): string => `<div class="editor-actions"><button type="button" data-artifact-ledger-page="${kind}" data-direction="-1"${start === 0 ? " disabled" : ""}>上一页</button><span role="status">${start + 1}–${end} / ${count} 条</span><button type="button" data-artifact-ledger-page="${kind}" data-direction="1"${end === count ? " disabled" : ""}>下一页</button></div>`;

  const nightsoulDetails = (entry: NightsoulBurstLogEntry): string => {
    const damage = damageById.get(entry.parentDamageEventId);
    const linked = allArtifacts.filter(row => row.nightsoulBurstLogId === entry.id);
    return `<p>日志 #${entry.id}；${entry.frame}f / ${num(entry.timeSeconds)}s（${placement(entry.frame)}）；优先级 ${entry.eventPriority}，队列序号 ${entry.eventSequence}。实际前台 ${actorName(entry.activeCharacterId)}。</p><p>声明参与者：${entry.natlanActorIds.map(actorName).join("、")}。共享冷却 ${entry.cooldownFrames}f；记录到期帧 ${frameText(entry.cooldownExpiresFrameBefore)} → ${frameText(entry.cooldownExpiresFrameAfter)}；结果：${entry.outcome === "triggered" ? "已触发" : "仍在冷却内"}。</p>${damage
      ? `<p>父伤害 #${damage.id} · ${damage.frame}f（${placement(damage.frame)}）· ${actorName(damage.sourceActorId)} · ${esc(damage.actionName)} / ${esc(damage.hitLabel)} · ${esc(damage.targetName)} · 实际伤害 ${num(damage.finalDamage)}。</p>`
      : `<p>父伤害 #${entry.parentDamageEventId} 的详细记录缺失；未补造伤害条件。</p>`}<p>${linked.length ? `关联烬城记录：${linked.map(row => `#${row.id} · ${actorName(row.actorId)} · ${row.frame}f（${placement(row.frame)}）`).join("；")}` : "没有关联的烬城回能记录。"}</p><p>来源 ${sourceLink(entry.sourceRef)}。</p><details><summary>完整夜魂来源记录</summary><pre>${esc(JSON.stringify({ entry, parentDamage: damage, artifactEvents: linked }, null, 2))}</pre></details>`;
  };
  const artifactDetails = (entry: ArtifactEventLogEntry): string => {
    const action = entry.actionLogIndex === null ? undefined : result.actionLog[entry.actionLogIndex];
    const particle = entry.particleEventId === null ? undefined : particleById.get(entry.particleEventId);
    const health = entry.targetHealthLogId === null ? undefined : healthById.get(entry.targetHealthLogId);
    const burst = entry.nightsoulBurstLogId === null ? undefined : nightsoulById.get(entry.nightsoulBurstLogId);
    const parent = entry.parentArtifactEventLogId === null ? undefined : artifactsById.get(entry.parentArtifactEventLogId);
    const cooldown = entry.skillCooldownLogId === null ? undefined : cooldownById.get(entry.skillCooldownLogId);
    const gains = entry.energyLogIds.map(id => energyById.get(id));
    return `<p>${effects[entry.effectId]} · ${actorName(entry.actorId)} · ${kinds[entry.kind]} · ${outcomes[entry.outcome]}。</p><p>事件 #${entry.id}；${entry.frame}f / ${num(entry.timeSeconds)}s（${placement(entry.frame)}）；优先级 ${entry.eventPriority}，队列序号 ${entry.eventSequence}。实际前台 ${actorName(entry.activeCharacterId)}；来源动作 ${esc(entry.sourceActionId ?? "未记录")}。</p><p>效果到期帧 ${frameText(entry.cooldownExpiresFrameBefore)} → ${frameText(entry.cooldownExpiresFrameAfter)}。空值表示该条没有记录此冷却，不等于推导出的就绪时间。</p>${action ? `<p>真实施放 #${entry.actionLogIndex} · ${esc(action.action)} · ${action.frame}f（${placement(action.frame)}）· 动作能量 ${num(action.energyBefore)} → ${num(action.energyAfter)}。</p>` : ""}${particle ? `<p>真实拾取粒子 #${particle.id} · ${esc(particle.source)} · ${num(particle.particleCount)} 个 ${esc(particle.particleElement)} ${esc(particle.particleKind)}；生成 ${particle.spawnFrame}f → 接收 ${particle.receiveFrame}f（${placement(particle.receiveFrame)}）。</p>` : ""}${health ? `<p>实际目标生命记录 #${health.id} · ${health.frame}f（${placement(health.frame)}）· 目标 ${esc(health.targetId)} · 伤害 #${health.damageEventId}；生命 ${num(health.hpBefore)} → ${num(health.hpAfter)}；${health.defeated ? "实际击败" : "本条未击败"}。场景移除不作为击杀。</p>` : ""}${burst ? `<section><h5>关联夜魂迸发</h5>${nightsoulDetails(burst)}</section>` : ""}${parent ? `<p>流放者父事件 #${parent.id} · ${parent.frame}f（${placement(parent.frame)}）；实际第 ${entry.tickIndex} 次任务，接收者 ${actorName(entry.receiverId)}。</p>` : ""}${entry.exileRecipients.length ? `<p>激活时记录的接收者及到期帧：${entry.exileRecipients.map(receiver => `${actorName(receiver.actorId)} ${receiver.expiresFrame}f`).join("；")}。这份状态不表示全部未来回能任务已执行。</p>` : ""}<h5>实际能量入账</h5>${gains.length ? `<ul>${gains.map((gain, index) => gain
      ? `<li>能量 #${gain.id} · ${actorName(gain.receiverId)} · ${gain.frame}f（${placement(gain.frame)}）：${num(gain.energyBefore)} → ${num(gain.energyAfter)}；请求 ${num(gain.finalEnergy)}，实际获得 ${num(gain.gainedEnergy)}，溢出 ${num(gain.wastedEnergy)}。固定回能使用日志乘数 ${num(gain.energyRecharge)}。</li>`
      : `<li>能量 #${entry.energyLogIds[index]} 缺少对应记录；不补算数值。</li>`).join("")}</ul>` : "<p>本条没有能量入账记录。</p>"}${cooldown ? `<section><h5>赌徒实际战技充能恢复</h5><p>冷却任务 #${cooldown.id} · ${cooldown.frame}f（${placement(cooldown.frame)}）；恢复一次充能，其余排队项与后续任务以实际状态为准。</p><h6>操作前</h6>${stateHtml(cooldown.stateBefore)}<h6>操作后</h6>${stateHtml(cooldown.stateAfter)}</section>` : ""}<p>固定来源 ${esc(entry.sourceProfileId)} · ${sourceLink(entry.sourceRef)}。</p><details><summary>完整事件与关联记录</summary><pre>${esc(JSON.stringify({ entry, action, particle, targetHealth: health, parentArtifact: parent, energy: gains, skillCooldown: cooldown }, null, 2))}</pre></details>`;
  };
  const drawArtifacts = (): void => {
    const start = artifactPage * PAGE_SIZE, end = Math.min(start + PAGE_SIZE, artifacts.length);
    root.querySelector<HTMLElement>("[data-artifact-event-table]")!.innerHTML = artifacts.length
      ? `<div class="table-wrap"><table><thead><tr><th>帧 / 秒</th><th>持有者 / 声明套装</th><th>实际事件</th><th>结果 / 来源</th><th>入账与冷却</th></tr></thead><tbody>${artifacts.slice(start, end).map(entry => `<tr data-artifact-event-id="${entry.id}"><td>${entry.frame}f / ${num(entry.timeSeconds)}s</td><td>${actorName(entry.actorId)}<small>${effects[entry.effectId]}</small></td><td>${kinds[entry.kind]}<small>事件 #${entry.id}</small></td><td>${outcomes[entry.outcome]}<small>到期 ${frameText(entry.cooldownExpiresFrameBefore)} → ${frameText(entry.cooldownExpiresFrameAfter)}</small></td><td>能量记录 ${entry.energyLogIds.length} 条${entry.skillCooldownLogId === null ? "" : ` · 冷却 #${entry.skillCooldownLogId}`}<details data-artifact-event-detail="${entry.id}"><summary>实际来源、回能与队列</summary><div data-artifact-detail-body></div></details></td></tr>`).join("")}</tbody></table></div>${pagination("artifact", start, end, artifacts.length)}`
      : "<p>此区间没有圣遗物实际事件记录；未据此推断未来触发。</p>";
    for (const details of root.querySelectorAll<HTMLDetailsElement>("[data-artifact-event-detail]")) details.ontoggle = () => {
      const host = details.querySelector<HTMLElement>("[data-artifact-detail-body]")!;
      if (!details.open || host.dataset.mounted) return;
      host.dataset.mounted = "true";
      host.innerHTML = artifactDetails(artifactsById.get(Number(details.dataset.artifactEventDetail))!);
    };
  };
  const drawNightsoul = (): void => {
    const start = nightsoulPage * PAGE_SIZE, end = Math.min(start + PAGE_SIZE, nightsoul.length);
    root.querySelector<HTMLElement>("[data-nightsoul-burst-table]")!.innerHTML = nightsoul.length
      ? `<div class="table-wrap"><table><thead><tr><th>帧 / 秒</th><th>父伤害 / 实际来源</th><th>结果</th><th>共享到期帧</th></tr></thead><tbody>${nightsoul.slice(start, end).map(entry => `<tr data-nightsoul-burst-id="${entry.id}"><td>${entry.frame}f / ${num(entry.timeSeconds)}s</td><td>伤害 #${entry.parentDamageEventId}<small>${actorName(entry.sourceActorId)} · 目标 ${esc(entry.targetId)}</small></td><td>${entry.outcome === "triggered" ? "已触发" : "共享冷却阻塞"}<small>${entry.natlanActorIds.length} 名声明参与者 · 冷却 ${entry.cooldownFrames}f</small></td><td>${frameText(entry.cooldownExpiresFrameBefore)} → ${frameText(entry.cooldownExpiresFrameAfter)}<details data-nightsoul-burst-detail="${entry.id}"><summary>实际父事件与回能引用</summary><div data-nightsoul-detail-body></div></details></td></tr>`).join("")}</tbody></table></div>${pagination("nightsoul", start, end, nightsoul.length)}`
      : "<p>此区间没有夜魂迸发回调记录；未以默认时点补造事件。</p>";
    for (const details of root.querySelectorAll<HTMLDetailsElement>("[data-nightsoul-burst-detail]")) details.ontoggle = () => {
      const host = details.querySelector<HTMLElement>("[data-nightsoul-detail-body]")!;
      if (!details.open || host.dataset.mounted) return;
      host.dataset.mounted = "true";
      host.innerHTML = nightsoulDetails(nightsoulById.get(Number(details.dataset.nightsoulBurstDetail))!);
    };
  };
  root.onclick = event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-artifact-ledger-page]");
    if (!button || button.disabled) return;
    const kind = button.dataset.artifactLedgerPage!, direction = Number(button.dataset.direction);
    if (kind === "artifact") { artifactPage += direction; drawArtifacts(); }
    else { nightsoulPage += direction; drawNightsoul(); }
    (root.querySelector<HTMLButtonElement>(`[data-artifact-ledger-page="${kind}"][data-direction="${direction}"]:not(:disabled)`) ?? root.querySelector<HTMLButtonElement>(`[data-artifact-ledger-page="${kind}"]:not(:disabled)`))?.focus();
  };
  drawArtifacts(); drawNightsoul();
}
