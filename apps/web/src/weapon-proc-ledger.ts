import type { SimulationResult, WeaponProcLifecycleLogEntry, WeaponProcLogEntry } from "@genshin-dps-lab/schemas";
import { weaponProcDefinitions } from "@genshin-dps-lab/reaction-formulas";
import { renderTraceHtml } from "./calculator-trace-view";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
const frameText = (frame: number | null): string => frame === null ? "无记录" : `${frame}f`;
const PAGE_SIZE = 25;
const weaponDefinitions = new Map(weaponProcDefinitions.map(definition => [definition.weaponId, definition]));
const weaponNames = new Map(weaponProcDefinitions.map(definition => [definition.weaponId, definition.weaponName]));
const outcomes: Record<WeaponProcLogEntry["outcome"], string> = {
  triggered: "已触发独立追击", "wrong-attack-tag": "攻击标签不满足条件",
  "off-field": "持有者不在场", "cooldown-blocked": "仍在冷却（含到期帧）",
  "failed-roll": "本次抽样未通过", "zero-damage": "宿主伤害为零",
  "note-gained": "已获得音符", "window-inactive": "追击效果期未生效",
  "not-weak-point": "宿主明确未命中弱点"
};
const lifecycleOutcomes: Record<WeaponProcLifecycleLogEntry["outcome"], string> = {
  "window-activated": "效果期已激活", "off-field": "持有者不在场，未激活",
  "activation-cooldown-blocked": "激活冷却阻塞"
};

function sourceLink(ref: string): string {
  return /^https?:\/\//.test(ref)
    ? `<a href="${esc(ref)}" target="_blank" rel="noopener noreferrer">${esc(ref)}</a>`
    : `<code>${esc(ref)}</code>`;
}

function randomHtml(entry: WeaponProcLogEntry): string {
  const random = entry.random;
  if (random === undefined) return "";
  const comparison = random.roll === null ? "前置条件已返回，本次未抽样。"
    : `实际抽样比较：<code>${esc(random.roll)} ${esc(random.successComparison)} ${esc(random.probability)}</code>；最终判定为“${outcomes[entry.outcome]}”。`;
  const zeroDamageGate = weaponDefinitions.get(entry.weaponId)!.randomTrigger!.zeroDamageGate;
  const weaponName = esc(weaponNames.get(entry.weaponId));
  const guard = zeroDamageGate === "after-roll" ? `${weaponName}在抽样通过后才检查宿主实际伤害是否为零；抽样通过不一定排程追击。`
    : `${weaponName}的固定来源不添加零伤害过滤，实际触发仍取决于本条判定。`;
  return `<section data-weapon-proc-random="${entry.id}"><h4>实际随机判定</h4><p>${comparison}</p><p>命名随机流 ${esc(random.rngStream)}；抽样索引 ${random.drawIndex === null ? "无" : random.drawIndex}；累计抽样次数 ${random.drawCountBefore} → ${random.drawCountAfter}。概率与抽样值保留日志完整精度，触发概率不作为追击伤害的乘数。</p>${guard ? `<p>${guard}</p>` : ""}</section>`;
}

function auraHtml(entry: WeaponProcLogEntry): string {
  if (entry.triggerAura === undefined) return "";
  if (entry.triggerAura === null) return `<p data-weapon-proc-aura="${entry.id}">本次未读取原目标的冰／冻结状态；不能由本条倍率字段认定已选择状态分支。</p>`;
  return `<section data-weapon-proc-aura="${entry.id}"><h4>实际回调取样时的原目标状态</h4><p>原目标 ${esc(entry.targetId)}：冰附着 Cryo ${entry.triggerAura.cryo ? "有" : "无"}；冻结 Frozen ${entry.triggerAura.frozen ? "有" : "无"}。记录选择${entry.triggerAura.cryo || entry.triggerAura.frozen ? "冰／冻结强化" : "基础"}分支，实际选中倍率 ${num(entry.coefficient)}。</p><p>此分支来自原目标在实际回调取样时的状态，范围内其他目标不会分别重选倍率；完整伤害公式仍由下方独立命中还原。</p></section>`;
}

function stateHtml(state: WeaponProcLifecycleLogEntry["stateAfter"]): string {
  return `<dl><dt>记录效果到期帧</dt><dd>${frameText(state.effectExpiresFrame)}</dd><dt>记录命中间隔到期帧</dt><dd>${frameText(state.hitCooldownExpiresFrame)}</dd><dt>记录激活冷却到期帧</dt><dd>${frameText(state.activationCooldownExpiresFrame)}</dd><dt>音符数</dt><dd>${state.notes}</dd><dt>追击计数</dt><dd>${state.procCount}</dd></dl>`;
}

function stateChangeHtml(before: WeaponProcLogEntry["stateBefore"], after: WeaponProcLogEntry["stateAfter"]): string {
  if (before === undefined || after === undefined) return "";
  return `<p>以下是本次实际事件前后的状态，不代表观察窗口末尾的状态；页面不补写过期事件。</p><section data-weapon-proc-state-before><h4>事件前状态</h4>${stateHtml(before)}</section><section data-weapon-proc-state-after><h4>事件后状态</h4>${stateHtml(after)}</section>`;
}

function stateSummaryHtml(entry: WeaponProcLogEntry): string {
  if (entry.stateBefore === undefined || entry.stateAfter === undefined) return "";
  return `<small data-weapon-proc-state-summary>音符 ${entry.stateBefore.notes} → ${entry.stateAfter.notes} · 追击计数 ${entry.stateBefore.procCount} → ${entry.stateAfter.procCount} · 效果到期 ${frameText(entry.stateBefore.effectExpiresFrame)} → ${frameText(entry.stateAfter.effectExpiresFrame)}</small>`;
}

/** Render actual callback decisions; formula restoration remains in the shared core. */
export function renderWeaponProcLedger(root: HTMLElement, result: SimulationResult,
  window?: { startTick: number; endTick: number }): void {
  const allEntries = result.weaponProcLog ?? [];
  const allLifecycleEntries = result.weaponProcLifecycleLog ?? [];
  root.onclick = null;
  root.hidden = result.config.weaponProcModel === undefined && allEntries.length === 0 && allLifecycleEntries.length === 0;
  if (root.hidden) { root.replaceChildren(); return; }
  const startTick = window?.startTick ?? 0;
  const endTick = window?.endTick ?? Infinity;
  const inWindow = (frame: number): boolean => frame >= startTick && frame < endTick;
  const damageById = new Map(result.damageEvents.map(event => [event.id, event]));
  const entries = allEntries.filter(entry => inWindow(entry.frame) ||
    entry.damageEventIds.some(id => inWindow(damageById.get(id)!.frame)));
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const lifecycleEntries = allLifecycleEntries.filter(entry => inWindow(entry.frame));
  const lifecycleById = new Map(lifecycleEntries.map(entry => [entry.id, entry]));
  const particleById = new Map(result.particleEvents.map(event => [event.id, event]));
  const resolutionById = new Map(result.hitResolutionLog.map(event => [event.id, event]));
  const actorName = (id: string): string => esc(result.config.characters.find(actor => actor.id === id)?.name ?? id);
  const placement = (frame: number): string => window === undefined ? "本次模拟内"
    : frame < startTick ? "窗口之前" : frame >= endTick ? "窗口之后，结束帧不计入" : "窗口内";
  const windowText = window === undefined ? "显示本次模拟的全部实际触发判定。"
    : `观察窗口为 [${startTick}, ${endTick})，起始帧计入、结束帧不计入。显示区间内判定，以及窗口前已触发、区间内实际交付的追击；后者不计作窗内触发。窗外命中单独标注。`;
  root.innerHTML = `<h3>武器独立追击与触发记录</h3><p>${windowText}</p><p>追击使用触发时的独立人物快照，在排程交付帧单独结算暴击、防御与物理抗性。冷却到期帧仍会阻塞；本来源参考假设没有角色卡肉；伤害触发只覆盖已接入的普通伤害回调，激活另读取下方实际战技或粒子事件。</p>${allEntries.some(entry => entry.random !== undefined) ? '<p>随机追击展示实际回调顺序、抽样与分支记录。概率只决定本次是否触发，不折算为伤害倍率；未抽样与未读取原目标状态会单独标注。</p>' : ""}<div data-weapon-proc-table></div>${result.weaponProcLifecycleLog === undefined && allLifecycleEntries.length === 0 ? "" : '<h3>武器效果激活与粒子接收记录</h3><p>此表只显示观察区间内实际发生的激活判定。前后状态直接读取日志，不由时间推断是否仍有效，也不补写过期事件。跨窗动作或粒子记录仅作为明确关联引用；音符变化见上方实际伤害判定。</p><div data-weapon-proc-lifecycle-table></div>'}`;
  let page = 0, lifecyclePage = 0;

  const mountDetails = (details: HTMLDetailsElement, entry: WeaponProcLogEntry): void => {
    const host = details.querySelector<HTMLElement>("[data-weapon-proc-detail-body]")!;
    if (host.dataset.mounted) return;
    host.dataset.mounted = "true";
    const parent = damageById.get(entry.parentDamageEventId);
    const childEvents = entry.damageEventIds.map(id => damageById.get(id)!);
    const resolutions = entry.hitResolutionIds.map(id => resolutionById.get(id)!);
    const cooldown = entry.cooldownExpiresFrameBefore === null ? "此前没有记录冷却。"
      : `判定前冷却到期帧为 ${entry.cooldownExpiresFrameBefore}f；该帧仍受阻，只有之后的帧才满足冷却条件。`;
    const explanation = entry.outcome === "triggered" ? "本次已触发并排程，实际伤害和命中判定见下方关联事件。"
      : entry.outcome === "wrong-attack-tag" ? "本次宿主攻击标签不符合武器触发要求，未排程追击。"
      : entry.outcome === "off-field" ? "判定时武器持有者不在前台，未排程追击。"
      : entry.outcome === "not-weak-point" ? "实际宿主命中的弱点声明为 false，未满足信使弱点条件，未排程追击；不从宿主暴击结果推断弱点。"
      : entry.outcome === "failed-roll" ? "本次已执行随机抽样，但未通过来源的比较条件，未排程追击。"
      : entry.outcome === "zero-damage" ? entry.random === undefined
        ? "本次被来源的实际零伤害条件拒绝，未排程追击；本次没有随机抽样。"
        : "本次抽样通过后，因宿主实际伤害为零而拒绝，未排程追击。"
      : entry.outcome === "note-gained" ? "本次实际命中已获得音符，尚未排程独立追击；音符及效果到期帧见状态记录。"
      : entry.outcome === "window-inactive" ? "实际回调判定时追击效果期未生效，未排程独立追击；不根据当前时间另行改写状态。"
      : "实际判定帧仍处于冷却区间，未排程追击。";
    const childCards = childEvents.map(event => `<section data-weapon-proc-child="${event.id}"><p>独立伤害事件 #${event.id} · ${esc(event.targetName)} · ${event.frame}f / ${num(event.timeSeconds)}s · 实际伤害 ${num(event.finalDamage)}<small>${placement(event.frame)}</small></p>${inWindow(event.frame)
      ? `<details data-weapon-proc-hit-detail="${event.id}"><summary>还原此命中的共享公式、变量与代入</summary><div data-weapon-proc-hit-trace="${event.id}"></div></details>`
      : '<p class="calculator-hint">该命中在当前窗口之外；此处保留跨界关联，不补入窗口内的公式视图。</p>'}</section>`).join("");
    const noDamage = entry.damageEventIds.length ? "" : `<p>${entry.outcome !== "triggered" ? "本次未排程独立追击。"
      : resolutions.length ? "本次已有命中判定，但没有交付独立伤害事件；原因见实际判定记录。"
      : "本次已排程，但该模拟结果尚无独立命中或伤害交付记录。"}</p>`;
    host.innerHTML = `${inWindow(entry.frame) ? "" : '<p class="calculator-hint">窗口前已触发，区间内交付；此记录不计作窗内触发。</p>'}<p>${explanation}</p><p>实际回调判定 ${entry.frame}f / ${num(entry.timeSeconds)}s；优先级 ${entry.eventPriority}，队列序号 ${entry.eventSequence}。</p><p>${cooldown} 判定后冷却到期帧：${entry.cooldownExpiresFrameAfter === null ? "无" : `${entry.cooldownExpiresFrameAfter}f`}；名义冷却 ${entry.cooldownFrames}f。</p>${randomHtml(entry)}${auraHtml(entry)}${stateChangeHtml(entry.stateBefore, entry.stateAfter)}${entry.hitWeakPoint === undefined ? "" : `<p>实际宿主弱点声明 hitWeakPoint=${entry.hitWeakPoint}。来源依次检查前台、弱点声明与冷却，不另筛攻击标签或零伤害；此值不由宿主暴击结果推断。独立追击自身的暴击处理请展开实际交付命中的共享公式核验。</p>`}<p>宿主伤害事件 #${entry.parentDamageEventId}${parent ? ` · ${parent.frame}f · 最终伤害 ${num(parent.finalDamage)} · ${placement(parent.frame)}` : ""}。实际前台：${entry.activeCharacterId === null ? "无" : actorName(entry.activeCharacterId)}；宿主攻击标签：${esc(entry.attackTag ?? "未记录")}。</p><p>追击属性：${entry.scalingStat === "atk" ? "攻击力" : "最大生命值"}；记录的倍率 ${num(entry.coefficient)}。${entry.triggerSnapshot === null ? "本次尚无已执行的属性快照。" : `人物快照取于 ${entry.snapshotFrame ?? entry.frame}f。`}${entry.damageFrame === null ? "没有排程交付帧。" : `首段排程交付帧 ${entry.damageFrame}f（${placement(entry.damageFrame)}）。`}</p><p>${entry.radius === null ? "原目标单体追击。" : `范围追击，记录半径 ${entry.radius}；中心见完整记录。`}</p>${noDamage}${childCards}<p>固定规则 ${esc(entry.sourceProfileId)}；来源：${sourceLink(entry.sourceRef)}。</p><details><summary>触发快照、状态、命中判定与完整日志</summary><pre>${esc(JSON.stringify({ decision: entry, parentDamageEvent: parent ?? null, independentDamageEvents: childEvents, hitResolutions: resolutions }, null, 2))}</pre></details>`;
    for (const hitDetails of host.querySelectorAll<HTMLDetailsElement>("[data-weapon-proc-hit-detail]")) {
      hitDetails.ontoggle = async () => {
        if (!hitDetails.open) return;
        const traceHost = hitDetails.querySelector<HTMLElement>("[data-weapon-proc-hit-trace]")!;
        if (traceHost.dataset.mounted) return;
        traceHost.dataset.mounted = "true";
        traceHost.textContent = "正在还原共享计算上下文……";
        const eventId = Number(hitDetails.dataset.weaponProcHitDetail);
        try {
          const { replaySimulationHit } = await import("@genshin-dps-lab/sim-core");
          const replay = replaySimulationHit({ schemaVersion: "calculator-event-v1", eventId, sourceResult: result });
          const messengerCrit = replay.weaponProc?.sourceProfileId === "gcsim-messenger-weapon-proc-v1" && replay.event.hitWeakPoint === true
            ? "<p>还原确认：此信使独立追击自身记录命中弱点，按固定来源使用暴击伤害保证暴击；不改写角色面板暴率，也不消耗本击暴击随机抽样。实际代入见共享公式。</p>" : "";
          traceHost.innerHTML = `<p data-weapon-proc-replay="${eventId}">原始伤害 ${num(replay.originalDamage)} · 共享核心还原 ${num(replay.reproducedDamage)} · 差值 ${esc(replay.difference)}</p>${messengerCrit}${renderTraceHtml(replay.trace)}`;
        } catch (error) {
          traceHost.innerHTML = `<p class="calculator-error">本次命中还原阻塞：${esc(error instanceof Error ? error.message : error)}</p>`;
        }
      };
    }
  };

  const mountLifecycleDetails = (details: HTMLDetailsElement, entry: WeaponProcLifecycleLogEntry): void => {
    const host = details.querySelector<HTMLElement>("[data-weapon-proc-lifecycle-detail-body]")!;
    if (host.dataset.mounted) return;
    host.dataset.mounted = "true";
    const action = entry.actionLogIndex === null ? undefined : result.actionLog[entry.actionLogIndex]!;
    const particle = entry.particleEventId === null ? undefined : particleById.get(entry.particleEventId)!;
    const explanation = entry.outcome === "window-activated" ? "本次实际事件已激活效果期，具体到期帧与计数见记录中的前后状态。"
      : entry.outcome === "off-field" ? "本次实际激活判定时持有者不在场，未激活效果期。"
      : "本次被实际激活冷却条件拒绝，未重新激活效果期。";
    const actionText = action === undefined ? "" : `<section data-weapon-proc-lifecycle-action="${entry.actionLogIndex}"><h4>关联的实际已接受战技</h4><p>动作记录 #${entry.actionLogIndex} · ${actorName(action.actorId)} · ${esc(action.action)} · 动作 ${esc(action.actionId)} · ${action.frame}f / ${num(action.time)}s（${placement(action.frame)}）；技能 ${esc(action.sourceAbilityId ?? "未记录")}；时间轴命令 ${action.timelineCommandIndex ?? "未记录"}。</p></section>`;
    const particleText = particle === undefined ? "" : `<section data-weapon-proc-lifecycle-particle="${particle.id}"><h4>关联的实际粒子接收事件</h4><p>粒子事件 #${particle.id} · 来源 ${actorName(particle.sourceActorId)} / ${esc(particle.sourceActionId)} · ${esc(particle.source)}；记录数量 ${num(particle.particleCount)}，元素 ${esc(particle.particleElement)}，类型 ${esc(particle.particleKind)}。</p><p>生成 ${particle.spawnFrame}f / ${num(particle.spawnTimeSeconds)}s（${placement(particle.spawnFrame)}）；接收 ${particle.receiveFrame}f / ${num(particle.receiveTimeSeconds)}s（${placement(particle.receiveFrame)}）；${particle.receivedWithinSimulation ? "已在本次模拟内接收" : "本次模拟内未接收"}。本次状态激活以接收事件记录为准，不由获得的能量数值推断。</p></section>`;
    host.innerHTML = `<p>${explanation}</p><p>生命周期记录 #${entry.id} · ${entry.frame}f / ${num(entry.timeSeconds)}s；实际优先级 ${entry.eventPriority}，队列序号 ${entry.eventSequence}。判定时前台：${entry.activeCharacterId === null ? "无" : actorName(entry.activeCharacterId)}。</p>${stateChangeHtml(entry.stateBefore, entry.stateAfter)}${actionText}${particleText}<p>关联动作或粒子若跨越观察窗口，只在此作为引用，不计作额外窗内事件；本表不据此自动安排伤害。实际独立命中见上方伤害判定及其交付记录。</p><p>固定规则 ${esc(entry.sourceProfileId)}；来源：${sourceLink(entry.sourceRef)}。</p><details><summary>完整生命周期与来源事件记录</summary><pre>${esc(JSON.stringify({ lifecycle: entry, action: action ?? null, particle: particle ?? null }, null, 2))}</pre></details>`;
  };

  const draw = (): void => {
    const start = page * PAGE_SIZE, end = Math.min(start + PAGE_SIZE, entries.length);
    const rows = entries.slice(start, end).map(entry => `<tr data-weapon-proc-id="${entry.id}" data-weapon-proc-outcome="${entry.outcome}" data-weapon-proc-frame="${entry.frame}" data-weapon-proc-decision-in-window="${inWindow(entry.frame)}"><td>${entry.frame}f / ${num(entry.timeSeconds)}s<small>优先级 ${entry.eventPriority} · 队列 ${entry.eventSequence}</small>${inWindow(entry.frame) ? "" : '<small data-weapon-proc-carry-in>窗口前已触发，区间内交付</small>'}</td><td>${actorName(entry.actorId)}<small>${esc(weaponNames.get(entry.weaponId))} R${entry.refinement}</small></td><td>宿主 #${entry.parentDamageEventId}<small>目标 ${esc(entry.targetId)} · 宿主伤害 ${num(entry.damage)}</small></td><td>${outcomes[entry.outcome]}${stateSummaryHtml(entry)}${entry.hitWeakPoint === undefined ? "" : `<small data-weapon-proc-weak-point="${entry.hitWeakPoint}">宿主弱点声明 ${entry.hitWeakPoint ? "true" : "false"}</small>`}${entry.random === undefined ? "" : `<small data-weapon-proc-random-summary>概率 ${esc(entry.random.probability)} · roll ${entry.random.roll === null ? "未抽样" : esc(entry.random.roll)} · 比较 ${esc(entry.random.successComparison)}</small>`}<small>冷却到期 ${entry.cooldownExpiresFrameBefore === null ? "无" : `${entry.cooldownExpiresFrameBefore}f`} → ${entry.cooldownExpiresFrameAfter === null ? "无" : `${entry.cooldownExpiresFrameAfter}f`}</small></td><td>${entry.triggerSnapshot === null ? "无快照" : `快照 ${entry.frame}f`}${entry.triggerAura === undefined ? "" : `<small data-weapon-proc-aura-summary>${entry.triggerAura === null ? "未读取冰／冻结状态" : `Cryo ${entry.triggerAura.cryo ? "有" : "无"} · Frozen ${entry.triggerAura.frozen ? "有" : "无"} · 选中倍率 ${num(entry.coefficient)}`}</small>`}${entry.damageFrame === null ? "" : `<small>排程交付 ${entry.damageFrame}f · ${placement(entry.damageFrame)}</small>`}</td><td>${entry.damageEventIds.length ? entry.damageEventIds.map(id => {
      const event = damageById.get(id)!;
      return `#${id} · ${event.frame}f · ${placement(event.frame)}`;
    }).join("<br>") : "无已交付伤害事件"}<small>${entry.hitResolutionIds.length} 条命中判定</small><details data-weapon-proc-detail="${entry.id}"><summary>判定原因、独立命中与公式</summary><div data-weapon-proc-detail-body></div></details></td></tr>`).join("");
    root.querySelector<HTMLElement>("[data-weapon-proc-table]")!.innerHTML = entries.length
      ? `<div class="table-wrap"><table><thead><tr><th scope="col">判定帧 / 秒</th><th scope="col">持有者 / 武器</th><th scope="col">宿主事件</th><th scope="col">实际判定 / 冷却</th><th scope="col">取样 / 排程交付</th><th scope="col">独立伤害 / 记录</th></tr></thead><tbody>${rows}</tbody></table></div><div class="editor-actions"><button type="button" data-weapon-proc-page="-1"${start === 0 ? " disabled" : ""}>上一页</button><span role="status" data-weapon-proc-page-status>${start + 1}–${end} / ${entries.length} 条</span><button type="button" data-weapon-proc-page="1"${end === entries.length ? " disabled" : ""}>下一页</button></div>`
      : '<p data-weapon-proc-empty>此区间没有武器独立追击的触发判定记录。</p>';
    for (const details of root.querySelectorAll<HTMLDetailsElement>("[data-weapon-proc-detail]")) {
      details.ontoggle = () => { if (details.open) mountDetails(details, byId.get(Number(details.dataset.weaponProcDetail))!); };
    }
  };
  const drawLifecycle = (): void => {
    const table = root.querySelector<HTMLElement>("[data-weapon-proc-lifecycle-table]");
    if (!table) return;
    const start = lifecyclePage * PAGE_SIZE, end = Math.min(start + PAGE_SIZE, lifecycleEntries.length);
    const rows = lifecycleEntries.slice(start, end).map(entry => `<tr data-weapon-proc-lifecycle-id="${entry.id}" data-weapon-proc-lifecycle-kind="${entry.kind}" data-weapon-proc-lifecycle-outcome="${entry.outcome}" data-weapon-proc-lifecycle-frame="${entry.frame}"><td>${entry.frame}f / ${num(entry.timeSeconds)}s<small>优先级 ${entry.eventPriority} · 队列 ${entry.eventSequence}</small></td><td>${actorName(entry.actorId)}<small>${esc(weaponNames.get(entry.weaponId))} R${entry.refinement}</small></td><td>${entry.kind === "skill" ? "已接受战技" : "实际粒子接收"}<small>${entry.actionLogIndex === null ? "" : `动作记录 #${entry.actionLogIndex}`}${entry.particleEventId === null ? "" : `粒子事件 #${entry.particleEventId}`}</small></td><td>${lifecycleOutcomes[entry.outcome]}<small>判定前台 ${entry.activeCharacterId === null ? "无" : actorName(entry.activeCharacterId)}</small></td><td>记录效果到期 ${frameText(entry.stateBefore.effectExpiresFrame)} → ${frameText(entry.stateAfter.effectExpiresFrame)}<small>音符 ${entry.stateBefore.notes} → ${entry.stateAfter.notes} · 追击计数 ${entry.stateBefore.procCount} → ${entry.stateAfter.procCount}</small></td><td><details data-weapon-proc-lifecycle-detail="${entry.id}"><summary>实际状态前后、动作与粒子引用</summary><div data-weapon-proc-lifecycle-detail-body></div></details></td></tr>`).join("");
    table.innerHTML = lifecycleEntries.length
      ? `<div class="table-wrap"><table><thead><tr><th scope="col">实际事件帧 / 秒</th><th scope="col">持有者 / 武器</th><th scope="col">实际来源事件</th><th scope="col">激活判定</th><th scope="col">记录状态变化</th><th scope="col">状态与来源</th></tr></thead><tbody>${rows}</tbody></table></div><div class="editor-actions"><button type="button" data-weapon-proc-lifecycle-page="-1"${start === 0 ? " disabled" : ""}>上一页激活</button><span role="status" data-weapon-proc-lifecycle-page-status>${start + 1}–${end} / ${lifecycleEntries.length} 条</span><button type="button" data-weapon-proc-lifecycle-page="1"${end === lifecycleEntries.length ? " disabled" : ""}>下一页激活</button></div>`
      : '<p data-weapon-proc-lifecycle-empty>此区间没有战技激活或粒子接收的实际状态记录；音符变化见对应伤害判定。</p>';
    for (const details of table.querySelectorAll<HTMLDetailsElement>("[data-weapon-proc-lifecycle-detail]")) {
      details.ontoggle = () => { if (details.open) mountLifecycleDetails(details, lifecycleById.get(Number(details.dataset.weaponProcLifecycleDetail))!); };
    }
  };
  root.onclick = event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-weapon-proc-page], [data-weapon-proc-lifecycle-page]");
    if (!button || button.disabled) return;
    const isLifecycle = button.dataset.weaponProcLifecyclePage !== undefined;
    const attribute = isLifecycle ? "data-weapon-proc-lifecycle-page" : "data-weapon-proc-page";
    const direction = button.getAttribute(attribute)!;
    if (isLifecycle) { lifecyclePage += Number(direction); drawLifecycle(); }
    else { page += Number(direction); draw(); }
    (root.querySelector<HTMLButtonElement>(`[${attribute}="${direction}"]:not(:disabled)`) ?? root.querySelector<HTMLButtonElement>(`[${attribute}]:not(:disabled)`))?.focus();
  };
  draw();
  drawLifecycle();
}
