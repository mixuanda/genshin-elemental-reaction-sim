import type { SimulationResult } from "@genshin-dps-lab/schemas";
import type { EnemyShieldModel } from "../../../packages/sim-core/src/enemy-shield-context";
import { ENEMY_SHIELD_HOST_PROFILE, type EnemyShieldHostLogEntry, type EnemyShieldHostState } from "../../../packages/sim-core/src/enemy-shield-host";
import { ENEMY_SHIELD_PROFILE, type EnemyShieldHpDisposition, type EnemyShieldState } from "../../../packages/sim-core/src/enemy-shield-runtime";
import { renderTraceHtml } from "./calculator-trace-view";

/** Local view until these optional host fields are part of the public result contract. */
type EnemyShieldResultView = Omit<SimulationResult, "config" | "enemyShieldLog" | "enemyShieldState"> & {
  config: Omit<SimulationResult["config"], "enemyShieldModel"> & { enemyShieldModel?: EnemyShieldModel };
  enemyShieldLog?: readonly EnemyShieldHostLogEntry[];
  enemyShieldState?: EnemyShieldHostState;
};

const PAGE_SIZE = 25;
const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number | null | undefined): string => value == null ? "不适用" : value.toLocaleString("zh-CN", { maximumFractionDigits: 8 });
const ref = (id: number | null): string => id === null ? "无关联记录" : `#${id}`;
const elements: Record<string, string> = { physical: "物理", pyro: "火", hydro: "水", cryo: "冰", frozen: "Frozen 冻结盾", electro: "雷", anemo: "风", geo: "岩", dendro: "草" };
const outcomes: Record<EnemyShieldHostLogEntry["outcome"], string> = {
  created: "实际生成", replaced: "实际替换", removed: "阶段移除", "already-inactive": "盾已不在场，未重复移除",
  "different-definition-active": "在场盾定义不同，未移除", "shield-damaged": "实际削盾", "shield-broken": "本击破盾",
};
const hpKinds: Record<EnemyShieldHpDisposition["kind"], string> = {
  unshielded: "无盾，生命伤害直通", "shield-blocked": "护盾阻挡", "armor-passthrough": "护甲生命伤害穿透",
  "breaking-hit-resolved": "击破一击生命转移已解析", "breaking-hit-unresolved": "击破一击生命转移未解析",
};
const noReactionReasons = { "icd-blocked": "真实 ICD 未放行", "no-elemental-application": "本击没有元素附着", "no-shield-reaction": "没有适用的盾反应" };
const sourceLinks = (sources: readonly string[]): string => `<ul>${[...new Set(sources)].map(source => `<li>${/^https?:\/\//.test(source) ? `<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">${esc(source)}</a>` : `<code>${esc(source)}</code>`}</li>`).join("")}</ul>`;
const hpHtml = (hp: EnemyShieldHpDisposition | null | undefined): string => hp == null ? "不适用：此次没有生命伤害结算" : `${hpKinds[hp.kind]}：${hp.damage === null ? '<strong class="calculator-error">未解析（null），不是 0</strong>' : `${num(hp.damage)} 生命伤害`}`;

/** Displays saved core traces and actual host decisions, without recomputing damage or shield costs. */
export function renderEnemyShieldLedger(root: HTMLElement, result: SimulationResult, window?: { startTick: number; endTick: number }): void {
  const view = result as EnemyShieldResultView;
  const model = view.config.enemyShieldModel, all = view.enemyShieldLog ?? [];
  root.onclick = null;
  root.hidden = !model && all.length === 0 && !view.enemyShieldState;
  if (root.hidden) { root.replaceChildren(); return; }
  const start = window?.startTick ?? 0, end = window?.endTick ?? Infinity;
  const entries = all.filter(entry => entry.frame >= start && entry.frame < end);
  const byId = new Map(all.map(entry => [entry.id, entry]));
  const damageById = new Map(result.damageEvents.map(entry => [entry.id, entry]));
  const hitById = new Map(result.hitResolutionLog.map(entry => [entry.id, entry]));
  const icdById = new Map(result.elementalApplicationIcdLog.map(entry => [entry.id, entry]));
  const actor = (id: string | null): string => id === null ? "不适用" : esc(result.config.characters.find(row => row.id === id)?.name ?? id);
  const target = (id: string): string => esc(result.enemyTargets.find(row => row.id === id)?.name ?? id);
  const placement = (frame: number): string => window === undefined ? "本次模拟内" : frame < start ? "窗口之前，仅作来源引用" : frame >= end ? "窗口之后，仅作来源引用" : "窗口内";
  const stateHtml = (state: EnemyShieldState | null): string => state === null ? "<p>此事件之前没有保存的盾实例。</p>" : `<dl><dt>目标／盾定义</dt><dd>${target(state.targetId)} · <code>${esc(state.definitionId)}</code></dd><dt>代次／实际阶段</dt><dd>${state.generation} ／ <code>${esc(state.phaseId)}</code></dd><dt>是否在场／保存盾量</dt><dd>${state.active ? "在场" : "已移除"} ／ ${num(state.gaugeUnits)} GU</dd><dt>生成／移除帧</dt><dd>${state.createdFrame}f ／ ${state.removedFrame === null ? "尚无移除记录" : `${state.removedFrame}f`}</dd></dl>`;
  const phaseInput = (entry: EnemyShieldHostLogEntry) => model?.events.find(event => event.id === entry.inputEventId);
  const targetId = (entry: EnemyShieldHostLogEntry): string | undefined => entry.shield?.targetId ?? model?.definitions.find(definition => definition.id === phaseInput(entry)?.definitionId)?.targetId;

  root.innerHTML = `<h3>敌方护盾：实际阶段、削盾与生命转移账本</h3>
    <p>${window === undefined ? "显示本次模拟实际执行的敌盾事件。" : `仅显示观察窗口 [${start}, ${end})f 内事件，结束帧不计入。`}盾量使用 GU；反应、伤害和削韧扣量均取真实记录，不从伤害数字推测元素附着。</p>
    <p>超额 GU 不等于敌人生命伤害；生命转移为 <code>null</code> 时表示未解析，明确的 <code>0</code> 才是零伤害。单条事件前后状态属于该事件，不代表窗口边界状态。</p>
    <div data-enemy-shield-table></div>
    ${window === undefined && view.enemyShieldState ? `<details data-enemy-shield-final-state><summary>实际模拟结束保存的完整敌盾状态</summary>${view.enemyShieldState.states.length ? view.enemyShieldState.states.map(stateHtml).join("") : "<p>没有保存的敌盾实例。</p>"}<p>已消费的阶段输入：${view.enemyShieldState.consumedPhaseInputIds.length ? view.enemyShieldState.consumedPhaseInputIds.map(id => `<code>${esc(id)}</code>`).join("、") : "无"}。</p><pre>${esc(JSON.stringify(view.enemyShieldState, null, 2))}</pre></details>` : ""}
    <details data-enemy-shield-scope><summary>暂定支持范围、来源与尚未接入的机制</summary><p><code>${esc(ENEMY_SHIELD_HOST_PROFILE.id)}</code> · 暂定（${esc(ENEMY_SHIELD_HOST_PROFILE.status)}）。此宿主范围不等于所有敌盾机制已完成或经过游戏实测认证。</p><h4>当前宿主支持</h4><ul>${ENEMY_SHIELD_HOST_PROFILE.supported.map(note => `<li>${esc(note)}</li>`).join("")}</ul><h4>当前阻塞项</h4><ul>${ENEMY_SHIELD_HOST_PROFILE.blockers.map(note => `<li>${esc(note)}</li>`).join("")}</ul><h4>共享基础公式的明确假设</h4><p><code>${esc(ENEMY_SHIELD_PROFILE.id)}</code> · 暂定（${esc(ENEMY_SHIELD_PROFILE.status)}）；基础公式具备的分支不表示当前宿主已接入该分支。</p><ul>${ENEMY_SHIELD_PROFILE.assumptions.map(note => `<li>${esc(note)}</li>`).join("")}</ul>${sourceLinks(ENEMY_SHIELD_HOST_PROFILE.sourceRefs)}<p>阶段生成／移除是显式全局帧事件，不随轮转自动重复。完整配置、核心公式追踪及来源关系随运行记录 JSON 保存。</p></details>`;

  const detailsHtml = (entry: EnemyShieldHostLogEntry): string => {
    const shield = entry.shield, input = shield?.input, phase = phaseInput(entry);
    const definition = model?.definitions.find(row => row.id === (shield?.definitionId ?? phase?.definitionId));
    const damage = entry.damageEventId === null ? undefined : damageById.get(entry.damageEventId);
    const hit = entry.hitResolutionLogId === null ? undefined : hitById.get(entry.hitResolutionLogId);
    const icd = entry.elementalApplicationIcdLogId === null ? undefined : icdById.get(entry.elementalApplicationIcdLogId);
    const decision = entry.applicationDecision;
    const reaction = input?.reaction;
    const reactionHtml = !reaction ? "本次没有盾反应输入" : reaction.kind === "none" ? noReactionReasons[reaction.reason] : reaction.kind === "standard-force-application" ? `${esc(elements[reaction.element])}实际到达盾的元素量 ${num(reaction.gaugeUnitsReachingShield)} GU；附着来源 <code>${esc(reaction.applicationEventId)}</code>` : reaction.kind === "electro-charged-tick" ? `实际感电 tick；反应来源 <code>${esc(reaction.reactionEventId)}</code>` : `已解析反应 ${esc(reaction.reaction)}；到达盾的元素量 ${num(reaction.gaugeUnitsReachingShield)} GU，实际系数 ${num(reaction.coefficient)}；反应来源 <code>${esc(reaction.reactionEventId)}</code>`;
    return `<p>宿主记录 #${entry.id} · ${entry.operation === "phase" ? "实际阶段事件" : "实际直接命中"} · ${outcomes[entry.outcome]} · ${entry.frame}f；真实优先级 ${entry.eventPriority}、队列序号 ${entry.eventSequence}、事件内序号 ${entry.intraEventSequence}。</p>
      <p>来源事件 <code>${esc(entry.sourceEventId)}</code>；角色 ${actor(entry.sourceActorId)}；动作 <code>${esc(entry.sourceActionId ?? "不适用")}</code>；命中 <code>${esc(entry.hitId ?? "不适用")}</code>；阶段输入 <code>${esc(entry.inputEventId ?? "不适用")}</code>。</p>
      ${definition ? `<p>盾定义 <code>${esc(definition.id)}</code> · ${target(definition.targetId)} · ${esc(elements[definition.element])}；场景明确的最大生命 ${num(definition.targetMaxHp)}、盾量倍率 ${num(definition.shieldGaugeMultiplier)}。场景来源：<code>${esc(definition.scenarioSourceRef)}</code>。</p>` : ""}
      ${shield ? `<section data-enemy-shield-costs><h4>真实盾量变化</h4><p>核心盾记录 #${shield.id}；${shield.before === null ? "尚无盾实例" : `${num(shield.before.gaugeUnits)} GU`} → ${num(shield.after.gaugeUnits)} GU；本击破盾：${shield.broken ? "是" : "否"}。</p><div class="table-wrap"><table><thead><tr><th>反应消耗</th><th>伤害转换</th><th>削韧转换</th><th>总量</th><th>实际扣除</th><th>超额</th></tr></thead><tbody><tr><td>${num(shield.reactionCost)} GU</td><td>${num(shield.damageCost)} GU</td><td>${num(shield.poiseCost)} GU</td><td>${num(shield.totalGaugeCost)} GU</td><td>${num(shield.effectiveGaugeCost)} GU</td><td>${num(shield.excessGaugeCost)} GU</td></tr></tbody></table></div><p data-enemy-shield-hp>${hpHtml(shield.hpDisposition)}</p></section>` : "<p>此次没有修改盾状态，也没有执行削盾或生命转移公式；不能将缺少记录解释为扣量为 0。</p>"}
      ${input ? `<h4>实际结算输入</h4><p>${esc(elements[input.damageElement])}伤害；护盾结算前已计算伤害 ${num(input.finalDamage)}，只移除增幅后的伤害 ${num(input.damageWithoutAmplifyingReaction)}。${reactionHtml}。</p><p>实际削韧元数据：攻击类型 <code>${esc(input.poise.attackType)}</code>，打击类型 <code>${esc(input.poise.strikeType)}</code>，初始削韧 ${num(input.poise.initialDamage)}；来源 <code>${esc(input.poise.sourceRef)}</code>。</p>${input.breakingHitTransfer ? `<p>本击独立解析的生命转移量 ${num(input.breakingHitTransfer.hpDamage)}；来源 <code>${esc(input.breakingHitTransfer.sourceRef)}</code>。</p>` : ""}` : ""}
      <section data-enemy-shield-trace><h4>共享核心：削盾公式、变量与实际代入</h4>${shield?.trace.length ? renderTraceHtml(shield.trace) : "<p>本条没有保存的削盾数值公式。</p>"}</section>
      <section data-enemy-shield-unamplified-trace><h4>共享核心：排除蒸发／融化增幅的实际伤害</h4><p>直接展示本次核心保存的追踪，保留真实暴击、面板、DEF、RES 等上下文；页面不重算。此值用于伤害削盾，不作为额外生命伤害累加。</p>${entry.unamplifiedDamageTrace.length ? renderTraceHtml(entry.unamplifiedDamageTrace) : "<p>本条没有执行此伤害计算。</p>"}</section>
      <section data-enemy-shield-icd><h4>真实共享 ICD 判定</h4>${decision === null ? "<p>本条没有元素附着 ICD 判定。</p>" : `<dl><dt>判定种类</dt><dd><code>${esc(decision.kind)}</code></dd><dt>实际求值／消费计数或窗口</dt><dd>${decision.evaluated ? "已求值" : "未求值"} ／ ${decision.consumed ? "已消费" : "未消费"}</dd><dt>放行／实际元素量倍率</dt><dd>${decision.allowed ? "放行" : "未放行"} ／ ${num(decision.applicationMultiplier)}</dd>${decision.kind === "skipped" ? `<dt>跳过原因</dt><dd>${esc(decision.reason)}</dd>` : `<dt>作用域／ICD 标签／配置</dt><dd>${esc(decision.scope ?? "不适用")} ／ ${esc(decision.icdTag ?? "不适用")} ／ ${esc(decision.profileId ?? "不适用")}</dd><dt>当前组／起始组</dt><dd>${esc(decision.groupId ?? "不适用")} ／ ${esc(decision.windowStartGroupId ?? "不适用")}</dd><dt>窗口起点／重置帧／周期</dt><dd>${num(decision.windowStartFrame)} ／ ${num(decision.resetAtFrame)} ／ ${num(decision.resetFrames)}（帧）</dd><dt>实际 hitIndex／sequenceIndex</dt><dd>${num(decision.hitIndex)} ／ ${num(decision.sequenceIndex)}</dd><dt>尾段策略／重置策略</dt><dd>${esc(decision.tailPolicy ?? "不适用")} ／ ${esc(decision.resetSchedulePolicy)}</dd>`}</dl>`}
      <p>ICD 记录 ${ref(entry.elementalApplicationIcdLogId)}${icd ? ` · ${icd.frame}f · ${placement(icd.frame)}；名义 ${num(icd.nominalGaugeUnits)} GU，实际 ${num(icd.effectiveGaugeUnits)} GU` : entry.elementalApplicationIcdLogId === null ? "" : "（本结果内未找到关联行）"}。</p></section>
      <h4>实际命中与伤害引用</h4><p>命中解析 ${ref(entry.hitResolutionLogId)}${hit ? ` · ${hit.frame}f · ${placement(hit.frame)} · ${target(hit.targetId)} · ${esc(hit.outcome)}` : entry.hitResolutionLogId === null ? "" : "（本结果内未找到关联行）"}。</p><p>伤害事件 ${ref(entry.damageEventId)}${damage ? ` · ${damage.frame}f · ${placement(damage.frame)} · ${actor(damage.sourceActorId)} · 实际反应 <code>${esc(damage.reaction)}</code> · 记录最终伤害 ${num(damage.finalDamage)}` : entry.damageEventId === null ? "" : "（本结果内未找到关联行）"}。引用来自保存的身份关系，不通过扣量反推。</p>
      ${shield ? `<details><summary>此事件之前的实际盾状态</summary>${stateHtml(shield.before)}</details><details><summary>此事件之后的实际盾状态</summary>${stateHtml(shield.after)}</details>` : ""}
      <details><summary>本条来源</summary>${sourceLinks([...entry.sourceRefs, ...(shield?.sourceRefs ?? [])])}</details><details><summary>完整精度、原始事件与实际引用</summary><pre>${esc(JSON.stringify({ host: entry, phaseInput: phase ?? null, definition: definition ?? null, hitResolution: hit ?? null, damage: damage ?? null, elementalApplicationIcd: icd ?? null }, null, 2))}</pre></details>`;
  };

  let page = 0;
  const draw = (): void => {
    const first = page * PAGE_SIZE, last = Math.min(first + PAGE_SIZE, entries.length);
    root.querySelector<HTMLElement>("[data-enemy-shield-table]")!.innerHTML = entries.length ? `<div class="table-wrap"><table><thead><tr><th>帧／实际结果</th><th>目标／来源</th><th>盾量前 → 后</th><th>生命伤害结算</th><th>公式与来源</th></tr></thead><tbody>${entries.slice(first, last).map(entry => {
      const id = targetId(entry), shield = entry.shield;
      return `<tr data-enemy-shield-log-id="${entry.id}"><td>${entry.frame}f<small>${outcomes[entry.outcome]}</small></td><td>${id === undefined ? "见来源记录" : target(id)}<small>${actor(entry.sourceActorId)}</small></td><td>${shield === null ? "没有盾状态变更" : `${shield.before === null ? "无实例" : `${num(shield.before.gaugeUnits)} GU`} → ${num(shield.after.gaugeUnits)} GU`}</td><td>${hpHtml(shield?.hpDisposition)}</td><td><details data-enemy-shield-detail="${entry.id}"><summary>实际公式、状态与引用</summary><div data-enemy-shield-detail-body></div></details></td></tr>`;
    }).join("")}</tbody></table></div><div class="editor-actions"><button type="button" data-enemy-shield-page="-1"${first === 0 ? " disabled" : ""}>上一页</button><span role="status">${first + 1}–${last} / ${entries.length} 条</span><button type="button" data-enemy-shield-page="1"${last >= entries.length ? " disabled" : ""}>下一页</button></div>` : "<p>此区间没有敌盾实际记录。空账本不代表盾量为零，也不补造生成、受击或反应。</p>";
    for (const detail of root.querySelectorAll<HTMLDetailsElement>("[data-enemy-shield-detail]")) detail.ontoggle = () => {
      const body = detail.querySelector<HTMLElement>("[data-enemy-shield-detail-body]")!;
      if (!detail.open || body.dataset.mounted) return;
      body.innerHTML = detailsHtml(byId.get(Number(detail.dataset.enemyShieldDetail))!);
      body.dataset.mounted = "true";
    };
  };
  root.onclick = event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-enemy-shield-page]");
    if (!button || button.disabled) return;
    page += Number(button.dataset.enemyShieldPage);
    draw();
    root.querySelector<HTMLButtonElement>(`[data-enemy-shield-page="${button.dataset.enemyShieldPage}"]:not(:disabled)`)?.focus();
  };
  draw();
}
