import type { SacrificialLogEntry, SimulationResult, SkillCooldownLogEntry } from "@genshin-dps-lab/schemas";
import { SACRIFICIAL_PROFILE } from "@genshin-dps-lab/sim-core";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
const frameText = (frame: number | null): string => frame === null ? "无记录" : `${frame}f`;
const PAGE_SIZE = 25;
const weapons: Record<SacrificialLogEntry["weaponId"], string> = {
  sacrificialsword: "祭礼剑", sacrificialgreatsword: "祭礼大剑", sacrificialbow: "祭礼弓", sacrificialfragments: "祭礼残章"
};
const outcomes: Record<SacrificialLogEntry["outcome"], string> = {
  "off-field": "持有者不在场", "attack-tag-blocked": "攻击标签不是元素战技",
  "cooldown-blocked": "祭礼冷却阻塞（含到期帧）", "skill-ready": "战技已就绪",
  "zero-damage": "实际伤害为零", "failed-roll": "本次抽样未触发", triggered: "已触发充能恢复"
};
const operations: Record<SkillCooldownLogEntry["operation"], string> = {
  start: "施放后开始冷却", recover: "实际恢复任务", reset: "来源效果恢复一次充能", "stale-worker": "旧代任务失效"
};

function sourceLink(ref: string): string {
  return /^https?:\/\//.test(ref)
    ? `<a href="${esc(ref)}" target="_blank" rel="noopener noreferrer">${esc(ref)}</a>`
    : `<code>${esc(ref)}</code>`;
}

function stateHtml(state: SkillCooldownLogEntry["stateAfter"]): string {
  return `<p>可用充能 ${state.availableCharges} / ${state.maxCharges}；实际恢复任务起始帧 ${frameText(state.workerStartedFrame)}；当前任务代号 ${state.workerGeneration}。</p>${state.queue.length
    ? `<ol>${state.queue.map(item => `<li>施放 ${esc(item.castId)} · 技能 ${esc(item.abilityId)} · 记录恢复时长 ${item.recoveryFrames}f</li>`).join("")}</ol>`
    : "<p>实际串行冷却队列为空。</p>"}`;
}

/** Show recorded decisions and queue transitions without scheduling or recomputing cooldowns. */
export function renderSacrificialLedger(root: HTMLElement, result: SimulationResult,
  window?: { startTick: number; endTick: number }): void {
  const allDecisions = result.sacrificialLog ?? [];
  const allTasks = result.skillCooldownLog ?? [];
  const hasSacrificial = result.config.sacrificialModel !== undefined || allDecisions.length > 0;
  root.onclick = null;
  root.hidden = result.config.sacrificialModel === undefined && allDecisions.length === 0 && allTasks.length === 0;
  if (root.hidden) { root.replaceChildren(); return; }
  const startTick = window?.startTick ?? 0, endTick = window?.endTick ?? Infinity;
  const inWindow = (frame: number): boolean => frame >= startTick && frame < endTick;
  const placement = (frame: number): string => window === undefined ? "本次模拟内"
    : frame < startTick ? "窗口之前，仅作关联引用" : frame >= endTick ? "窗口之后，仅作关联引用" : "窗口内";
  const decisions = allDecisions.filter(entry => inWindow(entry.frame));
  const beforeWindowByActor = new Map<string, SkillCooldownLogEntry>();
  if (window !== undefined) for (const task of allTasks) {
    if (task.frame < startTick) beforeWindowByActor.set(task.actorId, task);
  }
  const tasks = allTasks.filter(entry => inWindow(entry.frame) || beforeWindowByActor.get(entry.actorId)?.id === entry.id);
  const decisionsById = new Map(allDecisions.map(entry => [entry.id, entry]));
  const tasksById = new Map(allTasks.map(entry => [entry.id, entry]));
  const artifactsById = new Map((result.artifactEventLog ?? []).map(entry => [entry.id, entry]));
  const damageById = new Map(result.damageEvents.map(event => [event.id, event]));
  const actorName = (id: string): string => esc(result.config.characters.find(actor => actor.id === id)?.name ?? id);
  const skillAbilities = new Set(result.config.timeline?.abilities.filter(ability => ability.kind === "skill").map(ability => ability.id) ?? []);
  const profile = SACRIFICIAL_PROFILE;
  const windowText = window === undefined ? "显示本次模拟实际发生的来源判定和战技冷却任务。"
    : `观察窗口为 [${startTick}, ${endTick})，起始帧计入、结束帧不计入。判定表只含窗内事件；冷却表另保留每名角色窗口前最后一条实际状态快照，作为历史引用，不计作窗内变化。`;
  root.innerHTML = `<h3>${hasSacrificial ? "祭礼触发与战技冷却记录" : "实际战技冷却记录"}</h3><p>${windowText}</p>${hasSacrificial ? `<p>只有在场、明确的战技攻击标签、祭礼冷却可用、战技未就绪且实际伤害非零时才抽样；严格满足 roll &lt; probability 才触发。祭礼冷却到期帧仍阻塞；抽样失败不开始祭礼冷却。</p><p>成功恢复一次充能，剩余串行冷却队列及恢复任务以实际前后状态为准。页面不推算后续就绪帧，也不把下一次战技的全部粒子或能量自动归因于祭礼。本固定来源假设没有角色卡肉，独立种子流保证本地复现，不宣称与 gcsim 共享随机序列相同。</p>` : ""}<div data-sacrificial-table></div><h4>实际战技冷却任务与队列</h4><p>历史快照只表示该条日志发生后的状态。失效任务保留原始执行顺序；队列按记录顺序显示，不在页面重新排程。</p><div data-skill-cooldown-table></div>${hasSacrificial ? `<p>固定规则 ${esc(profile.id)}；${profile.sourceRefs.map(sourceLink).join("；")}。</p>` : ""}`;
  let decisionPage = 0, taskPage = 0;

  const actionReferences = (actorId: string, actionId: string): string => {
    const actions = result.actionLog.map((action, index) => ({ action, index })).filter(({ action }) => action.actorId === actorId && action.actionId === actionId);
    const particles = result.particleEvents.filter(event => event.sourceActorId === actorId && event.sourceActionId === actionId);
    const triggers = result.particleTriggerLog.filter(event => event.sourceActorId === actorId && event.sourceActionId === actionId);
    const energies = result.energyLog.filter(event => event.sourceActorId === actorId && event.sourceActionId === actionId);
    return `<section data-sacrificial-action-reference="${esc(actionId)}"><h5>动作 ${esc(actionId)} 的实际记录</h5><p>以下记录按 sourceActionId / actionId 关联，不表示祭礼直接生成这些粒子或能量；跨窗记录只作引用。</p>${actions.length ? actions.map(({ action, index }) => `<p>实际施放记录 #${index} · ${esc(action.action)} · ${action.frame}f / ${num(action.time)}s · ${placement(action.frame)} · 当次动作记录能量 ${num(action.energyBefore)} → ${num(action.energyAfter)}。</p>`).join("") : "<p>没有对应的成功施放记录。</p>"}<p>粒子事件 ${particles.length} 条；粒子判定 ${triggers.length} 条；能量记录 ${energies.length} 条。</p>${particles.map(event => `<p>粒子 #${event.id} · ${esc(event.source)} · ${num(event.particleCount)} 个 ${esc(event.particleElement)} ${esc(event.particleKind)} · 生成 ${event.spawnFrame}f（${placement(event.spawnFrame)}）→ 接收帧 ${event.receiveFrame}f（${placement(event.receiveFrame)}）· ${event.receivedWithinSimulation ? "已在模拟内接收" : "模拟内未接收"}。</p>`).join("")}${energies.map(event => `<p>能量 #${event.id} · 接收者 ${actorName(event.receiverId)} · ${event.frame}f（${placement(event.frame)}）· 实际获得 ${num(event.gainedEnergy)}，溢出 ${num(event.wastedEnergy)} · ${num(event.energyBefore)} → ${num(event.energyAfter)}${event.applied ? "" : ` · 未应用：${esc(event.blockedReason)}`}。</p>`).join("")}<details><summary>动作、粒子判定与能量完整记录</summary><pre>${esc(JSON.stringify({ actions, particles, particleTriggers: triggers, energy: energies }, null, 2))}</pre></details></section>`;
  };

  const taskDetails = (task: SkillCooldownLogEntry): string => {
    const reset = task.sacrificialLogId === null ? undefined : decisionsById.get(task.sacrificialLogId);
    const artifactReset = task.artifactEventLogId === undefined ? undefined : artifactsById.get(task.artifactEventLogId);
    const explanation = task.operation === "reset" ? `${artifactReset?.effectId === "gambler-4pc" ? "赌徒" : reset ? "祭礼" : "来源效果"}重置操作只恢复一次充能；其余排队项和重启的恢复任务见实际状态。`
      : task.operation === "stale-worker" ? "此任务属于已失效的旧代恢复任务，实际前后状态未因此恢复充能。"
      : task.operation === "start" ? "本条是实际执行的战技冷却开始任务；任务帧可能晚于施放帧。"
      : "本条是实际执行并恢复充能的任务，后续队列仍以记录为准。";
    return `<p>${explanation}</p><p>冷却日志 #${task.id} · ${actorName(task.actorId)} · ${task.frame}f / ${num(task.timeSeconds)}s · ${placement(task.frame)}；优先级 ${task.eventPriority}，队列序号 ${task.eventSequence}；执行任务代号 ${task.workerGeneration === null ? "不适用" : task.workerGeneration}。</p>${reset ? `<p>关联实际祭礼判定 #${reset.id} · ${reset.frame}f（${placement(reset.frame)}）· 宿主伤害 #${reset.damageEventId}；判定反向关联冷却日志 #${reset.skillCooldownLogId}。</p>` : ""}${artifactReset ? `<p>关联实际圣遗物事件 #${artifactReset.id} · ${esc(artifactReset.effectId)} · ${artifactReset.frame}f（${placement(artifactReset.frame)}）· 目标生命记录 #${artifactReset.targetHealthLogId}；来源 ${sourceLink(artifactReset.sourceRef)}。</p>` : ""}<section data-skill-cooldown-before><h5>任务前</h5>${stateHtml(task.stateBefore)}</section><section data-skill-cooldown-after><h5>任务后</h5>${stateHtml(task.stateAfter)}</section>${task.actionId === null ? "" : actionReferences(task.actorId, task.actionId)}<details><summary>完整冷却任务记录</summary><pre>${esc(JSON.stringify(task, null, 2))}</pre></details>`;
  };

  const mountDecision = (details: HTMLDetailsElement, entry: SacrificialLogEntry): void => {
    const host = details.querySelector<HTMLElement>("[data-sacrificial-detail-body]")!;
    if (host.dataset.mounted) return;
    host.dataset.mounted = "true";
    const damage = damageById.get(entry.damageEventId)!;
    const reset = entry.skillCooldownLogId === null ? undefined : tasksById.get(entry.skillCooldownLogId);
    const nextAction = reset === undefined ? undefined : result.actionLog.find(action => action.actorId === entry.actorId && action.frame > entry.frame && action.sourceAbilityId !== undefined && skillAbilities.has(action.sourceAbilityId));
    const cooldownQuery = entry.skillCooldownBefore === null ? "前置条件已返回，未查询战技冷却；空值不表示战技已就绪。" : `实际查询的战技剩余冷却为 ${esc(entry.skillCooldownBefore)}f。`;
    const roll = entry.roll === null ? "本次没有消耗随机抽样。" : `实际比较：<code>${esc(entry.roll)} &lt; ${esc(entry.probability)}</code>；来源记录的结果为“${outcomes[entry.outcome]}”。`;
    host.innerHTML = `<p>${outcomes[entry.outcome]}。${cooldownQuery}</p><p>${roll} 独立流 ${esc(entry.rngStream)}，抽样索引 ${entry.drawIndex === null ? "无" : entry.drawIndex}，累计抽样次数 ${entry.drawCountBefore} → ${entry.drawCountAfter}。</p><p>祭礼冷却 ${entry.cooldownFrames}f；记录的到期帧 ${frameText(entry.cooldownExpiresFrameBefore)} → ${frameText(entry.cooldownExpiresFrameAfter)}，到期帧仍受阻。</p><p>实际前台 ${entry.activeCharacterId === null ? "无" : actorName(entry.activeCharacterId)}；伤害标签 ${esc(entry.attackTag ?? "未记录")}；宿主伤害事件 #${entry.damageEventId} · ${damage.frame}f（${placement(damage.frame)}）· ${esc(damage.actionName)} / ${esc(damage.hitLabel)} · 目标 ${esc(damage.targetName)} · 实际伤害 ${num(entry.damage)}。</p><p>判定优先级 ${entry.eventPriority}，队列序号 ${entry.eventSequence}；固定来源 ${esc(entry.sourceProfileId)} · ${sourceLink(entry.sourceRef)}。</p>${reset ? `<section data-sacrificial-reset="${reset.id}"><h4>真实充能恢复与串行队列</h4>${taskDetails(reset)}</section>` : "<p>本次没有关联的祭礼冷却重置任务。</p>"}${actionReferences(entry.actorId, damage.actionId)}${reset ? nextAction ? `<section data-sacrificial-next-action="${esc(nextAction.actionId)}"><h4>较晚帧的首次实际战技施放</h4><p>这是此判定帧之后的首次成功战技施放；不包含同帧行为，也不将时间先后当作额外产能因果。</p>${nextAction.actionId === damage.actionId ? "<p>其动作标识与上方宿主动作相同，关联记录已在上方列出。</p>" : actionReferences(entry.actorId, nextAction.actionId)}</section>` : "<p>本次模拟较晚帧没有记录该角色的成功战技施放。</p>" : ""}<details><summary>完整祭礼判定</summary><pre>${esc(JSON.stringify(entry, null, 2))}</pre></details>`;
  };

  const drawDecisions = (): void => {
    const start = decisionPage * PAGE_SIZE, end = Math.min(start + PAGE_SIZE, decisions.length);
    const rows = decisions.slice(start, end).map(entry => `<tr data-sacrificial-id="${entry.id}" data-sacrificial-outcome="${entry.outcome}" data-sacrificial-frame="${entry.frame}"><td>${entry.frame}f / ${num(entry.timeSeconds)}s</td><td>${actorName(entry.actorId)}<small>${weapons[entry.weaponId]} R${entry.refinement}</small></td><td>伤害 #${entry.damageEventId}<small>实际伤害 ${num(entry.damage)}</small></td><td>${outcomes[entry.outcome]}<small>${entry.skillCooldownBefore === null ? "未查询战技冷却" : `战技剩余 ${esc(entry.skillCooldownBefore)}f`}</small></td><td>概率 ${esc(entry.probability)}<small>roll ${entry.roll === null ? "未抽样" : esc(entry.roll)} · 索引 ${entry.drawIndex ?? "无"}</small></td><td>${frameText(entry.cooldownExpiresFrameBefore)} → ${frameText(entry.cooldownExpiresFrameAfter)}<small>${entry.skillCooldownLogId === null ? "无重置任务" : `冷却重置日志 #${entry.skillCooldownLogId}`}</small><details data-sacrificial-detail="${entry.id}"><summary>条件、抽样、真实队列与产能引用</summary><div data-sacrificial-detail-body></div></details></td></tr>`).join("");
    root.querySelector<HTMLElement>("[data-sacrificial-table]")!.innerHTML = decisions.length
      ? `<div class="table-wrap"><table><thead><tr><th scope="col">判定帧 / 秒</th><th scope="col">持有者 / 武器</th><th scope="col">宿主伤害</th><th scope="col">实际结果</th><th scope="col">实际概率 / 抽样</th><th scope="col">祭礼到期帧 / 关联任务</th></tr></thead><tbody>${rows}</tbody></table></div><div class="editor-actions"><button type="button" data-sacrificial-page="-1"${start === 0 ? " disabled" : ""}>上一页</button><span role="status" data-sacrificial-page-status>${start + 1}–${end} / ${decisions.length} 条</span><button type="button" data-sacrificial-page="1"${end === decisions.length ? " disabled" : ""}>下一页</button></div>`
      : hasSacrificial ? '<p data-sacrificial-empty>此区间没有实际祭礼触发判定。</p>' : "";
    for (const details of root.querySelectorAll<HTMLDetailsElement>("[data-sacrificial-detail]")) {
      details.ontoggle = () => { if (details.open) mountDecision(details, decisionsById.get(Number(details.dataset.sacrificialDetail))!); };
    }
  };
  const drawTasks = (): void => {
    const start = taskPage * PAGE_SIZE, end = Math.min(start + PAGE_SIZE, tasks.length);
    const rows = tasks.slice(start, end).map(task => `<tr data-skill-cooldown-id="${task.id}" data-skill-cooldown-operation="${task.operation}" data-skill-cooldown-frame="${task.frame}" data-skill-cooldown-in-window="${inWindow(task.frame)}"><td>${task.frame}f / ${num(task.timeSeconds)}s${inWindow(task.frame) ? "" : '<small data-skill-cooldown-carry-in>窗口前最后一条历史状态快照</small>'}</td><td>${actorName(task.actorId)}<small>日志 #${task.id}</small></td><td>${operations[task.operation]}<small>${task.actionId === null ? "无施放任务标识" : `施放 ${esc(task.actionId)}`}${task.sacrificialLogId === null ? "" : ` · 祭礼 #${task.sacrificialLogId}`}${task.artifactEventLogId === undefined ? "" : ` · 圣遗物事件 #${task.artifactEventLogId}`}</small></td><td>${task.stateBefore.availableCharges} → ${task.stateAfter.availableCharges} / ${task.stateAfter.maxCharges}<small>队列 ${task.stateBefore.queue.length} → ${task.stateAfter.queue.length} 项</small></td><td>${frameText(task.stateBefore.workerStartedFrame)} → ${frameText(task.stateAfter.workerStartedFrame)}<small>任务代号 ${task.stateBefore.workerGeneration} → ${task.stateAfter.workerGeneration}</small></td><td><details data-skill-cooldown-detail="${task.id}"><summary>实际前后队列与动作引用</summary><div data-skill-cooldown-detail-body></div></details></td></tr>`).join("");
    root.querySelector<HTMLElement>("[data-skill-cooldown-table]")!.innerHTML = tasks.length
      ? `<div class="table-wrap"><table><thead><tr><th scope="col">实际任务帧 / 秒</th><th scope="col">角色 / 记录</th><th scope="col">任务</th><th scope="col">可用充能 / 队列项数</th><th scope="col">恢复任务起始帧 / 代号</th><th scope="col">实际队列</th></tr></thead><tbody>${rows}</tbody></table></div><div class="editor-actions"><button type="button" data-skill-cooldown-page="-1"${start === 0 ? " disabled" : ""}>上一页任务</button><span role="status" data-skill-cooldown-page-status>${start + 1}–${end} / ${tasks.length} 条</span><button type="button" data-skill-cooldown-page="1"${end === tasks.length ? " disabled" : ""}>下一页任务</button></div>`
      : '<p data-skill-cooldown-empty>此区间没有实际战技冷却任务或窗口前历史状态记录。</p>';
    for (const details of root.querySelectorAll<HTMLDetailsElement>("[data-skill-cooldown-detail]")) {
      details.ontoggle = () => {
        if (!details.open) return;
        const host = details.querySelector<HTMLElement>("[data-skill-cooldown-detail-body]")!;
        if (host.dataset.mounted) return;
        host.dataset.mounted = "true";
        host.innerHTML = taskDetails(tasksById.get(Number(details.dataset.skillCooldownDetail))!);
      };
    }
  };
  root.onclick = event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-sacrificial-page], [data-skill-cooldown-page]");
    if (!button || button.disabled) return;
    const isDecision = button.dataset.sacrificialPage !== undefined;
    const attribute = isDecision ? "data-sacrificial-page" : "data-skill-cooldown-page";
    const direction = button.getAttribute(attribute)!;
    if (isDecision) { decisionPage += Number(direction); drawDecisions(); }
    else { taskPage += Number(direction); drawTasks(); }
    (root.querySelector<HTMLButtonElement>(`[${attribute}="${direction}"]:not(:disabled)`) ?? root.querySelector<HTMLButtonElement>(`[${attribute}]:not(:disabled)`))?.focus();
  };
  drawDecisions();
  drawTasks();
}
