import type { PlayerShieldInstance, PlayerShieldLogEntry, PlayerShieldState, PlayerShieldTarget, SimulationResult } from "@genshin-dps-lab/schemas";
import { PLAYER_SHIELD_PROFILE, playerShieldTrace } from "../../../packages/sim-core/src/player-shield-runtime";
import { renderTraceHtml } from "./calculator-trace-view";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number | null | undefined): string => value == null ? "不适用" : value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
const elements: Record<string, string> = { physical: "物理", pyro: "火", hydro: "水", cryo: "冰", electro: "雷", anemo: "风", geo: "岩", dendro: "草" };
const operations: Record<PlayerShieldLogEntry["operation"], string> = { grant: "生成／同身份覆盖", bonus: "设置护盾强效", "incoming-hit": "显式玩家受击", "reaction-hit": "实际反应自伤", expire: "自然到期" };
const callbacks: Record<PlayerShieldLogEntry["callbacks"][number]["kind"], string> = { OnOverwrite: "覆盖旧盾", OnShielded: "新盾生效", OnExpire: "盾自然到期", OnShieldBreak: "移除后的破盾事件" };
const callbackReasons: Record<PlayerShieldLogEntry["callbacks"][number]["reason"], string> = { grant: "生成", overwrite: "覆盖", expire: "自然到期", damage: "伤害击破" };
const PAGE_SIZE = 25;

/** Displays actual resource transitions; every formula is supplied by the shared core AST. */
export function renderPlayerShieldLedger(root: HTMLElement, result: SimulationResult, window?: { startTick: number; endTick: number }): void {
  const allEntries = result.playerShieldLog ?? [];
  root.onclick = null;
  root.hidden = !result.config.playerShieldModel && !allEntries.length;
  if (root.hidden) { root.replaceChildren(); return; }
  const start = window?.startTick ?? 0, end = window?.endTick ?? Infinity;
  const entries = allEntries.filter(entry => entry.frame >= start && entry.frame < end);
  const actorName = (id: string | null): string => id === null ? "不适用" : esc(result.config.characters.find(actor => actor.id === id)?.name ?? id);
  const targetName = (target: PlayerShieldTarget): string => target.kind === "active" ? "受击时的前台角色" : `指定角色：${actorName(target.actorId)}`;
  const logsById = new Map(allEntries.map(entry => [entry.id, entry]));
  const damageById = new Map(result.playerDamageEvents.map(event => [event.id, event]));
  const placement = (frame: number): string => window === undefined ? "本次模拟内" : frame < start ? "窗口之前，仅作来源引用" : frame >= end ? "窗口之后，仅作来源引用" : "窗口内";
  const shieldName = (instanceId: number, entry: PlayerShieldLogEntry): string => {
    const shield = entry.stateAfter.shields.find(shield => shield.instanceId === instanceId) ?? entry.stateBefore.shields.find(shield => shield.instanceId === instanceId);
    return shield ? `#${instanceId} ${esc(shield.label)}` : `#${instanceId}`;
  };
  const shieldsHtml = (shields: readonly PlayerShieldInstance[]): string => shields.length
    ? `<div class="table-wrap"><table><thead><tr><th>实例／类型</th><th>生成者／保护目标</th><th>元素</th><th>剩余原始盾量</th><th>绝对到期帧</th></tr></thead><tbody>${shields.map(shield => `<tr data-player-shield-instance="${shield.instanceId}"><td>#${shield.instanceId} ${esc(shield.label)}<small>${esc(shield.typeKey)} · 定义 ${esc(shield.definitionId)}</small></td><td>${actorName(shield.ownerId)}<small>${targetName(shield.target)}</small></td><td>${esc(elements[shield.element] ?? shield.element)}</td><td>${num(shield.hp)}</td><td>${shield.expiresAtFrame}f</td></tr>`).join("")}</tbody></table></div>`
    : "<p>此状态中没有通用玩家盾实例。</p>";
  const stateHtml = (state: PlayerShieldState): string => `${shieldsHtml(state.shields)}${state.bonuses.length ? `<h5>全局护盾强效修饰</h5><div class="table-wrap"><table><thead><tr><th>修饰键</th><th>加成</th><th>到期帧</th><th>读取后移除</th></tr></thead><tbody>${state.bonuses.map(bonus => `<tr><td>${esc(bonus.key)}</td><td>${num(bonus.value)}</td><td>${bonus.expiresAtFrame === null ? "永久，除非被替换或读取移除" : `${bonus.expiresAtFrame}f`}</td><td>${bonus.consumeOnRead ? "是；本次读取仍计入" : "否"}</td></tr>`).join("")}</tbody></table></div>` : "<p>此状态中没有通用护盾强效修饰。</p>"}<p>下一实例编号 ${state.nextInstanceId}。到期字段只是已保存的状态，是否仍有效须结合本条事件顺序判断。</p>`;
  root.innerHTML = `<h3>玩家护盾：实际生成、受击与到期账本</h3><p>${window ? `仅列观察窗口 [${start}, ${end})f 内记录，结束帧不计入。` : "显示本次模拟实际执行的通用玩家护盾事件。"}这是保护角色的资源，不是敌人护盾。没有事件的区间不补造受击或角色专属回调。</p><p>多面适用护盾分别承受同一完整来袭量，穿透伤害取最小值；不把原始盾量相加，也不按剩余伤害串联消耗。实际角色生命变化列在关联生命记录中，生命消耗不会进入此护盾扣损公式。</p><div data-player-shield-table></div>${window === undefined && result.playerShieldState ? `<details data-player-shield-final-state><summary>模拟结束时实际保存的通用盾状态</summary>${stateHtml(result.playerShieldState)}</details>` : ""}<details><summary>来源、明确假设与保存范围</summary><p><code>${esc(PLAYER_SHIELD_PROFILE.id)}</code> · ${esc(PLAYER_SHIELD_PROFILE.evidenceStatus)}。通用模板的来源假设不代表整名角色、敌人攻击或游戏实测认证。</p><ul>${PLAYER_SHIELD_PROFILE.assumptions.map(note => `<li>${esc(note)}</li>`).join("")}</ul><p>同类型与同目标直接覆盖；自然到期、覆盖、伤害破盾的实际回调原因分别列出。自然到期发出的破盾事件不能当作伤害击破。来袭伤害是显式交盾前已结算量，或引擎已实现的实际反应自伤；没有从角色名称推导敌方倍率或减伤。</p><p>配置事件使用全局绝对帧，只执行一次，不随轮转自动重复。完整输入、状态、回调顺序、生命关联和追踪随运行记录 JSON 保存。下方原始账本可查看完整精度。</p><p>${PLAYER_SHIELD_PROFILE.sourceRefs.map(source => `<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">${esc(source)}</a>`).join("<br>")}</p></details>`;
  const detailsHtml = (entry: PlayerShieldLogEntry): string => {
    const input = entry.inputEvent;
    const damage = entry.playerDamageEventId === null ? undefined : damageById.get(entry.playerDamageEventId);
    const hp = entry.hpResolution ?? damage?.hpResolution;
    const trace = playerShieldTrace(entry);
    const grant = input?.kind === "grant" ? input : undefined;
    return `<p>记录 #${entry.id} · ${operations[entry.operation]} · ${entry.frame}f / ${num(entry.timeSeconds)}s；实际队列优先级 ${entry.eventPriority}，序号 ${entry.eventSequence}，事件内序号 ${entry.intraEventSequence}。同帧先后来自实际执行队列。</p>${input ? `<p>输入条件 <code>${esc(input.id)}</code> · 显式全局帧 ${input.frame}f；来源为用户条件：${esc(input.source.note)}。${grant ? `生成者 ${actorName(grant.ownerId)}；类型 ${esc(grant.typeKey)}；保护目标 ${targetName(grant.target)}。属性项在实际生成帧取样，不沿用角色名称推断的面板。` : ""}</p>` : "<p>此条由实际生命周期或反应受击触发，没有补造独立用户输入事件。</p>"}<p>实际前台 ${actorName(entry.activeCharacterId)}；本次受击对象 ${actorName(entry.targetActorId)}；来袭元素 ${entry.incomingElement === null ? "不适用" : esc(elements[entry.incomingElement] ?? entry.incomingElement)}。</p>${entry.incomingDamage !== null ? `<dl><dt>交给护盾的完整来袭量</dt><dd>${num(entry.incomingDamage)}</dd><dt>本次实际读取的护盾强效合计</dt><dd>${num(entry.strengthBonus)}</dd><dt>结晶盾计算后的已记录伤害</dt><dd>${num(entry.crystallizeDamageAfter)}</dd><dt>本次已记录吸收量／最终穿透量</dt><dd>${num(entry.absorbedDamage)} ／ ${num(entry.damageAfterShield)}</dd></dl>` : ""}<section data-player-shield-formula><h4>共享核心的公式、变量与实际代入</h4>${trace.length ? renderTraceHtml(trace) : "<p>本条没有数值伤害公式；下方显示实际状态与事件顺序。</p>"}</section>${entry.shieldDetails.length ? `<h4>每面适用盾的实际扣损</h4><p>每一行都使用同一完整来袭量；这些吸收量不能相加解释为对角色的总吸收。</p><div class="table-wrap"><table><thead><tr><th>盾实例</th><th>原始盾量前 → 后</th><th>元素／含强效倍率</th><th>本盾容量</th><th>本盾吸收／穿透</th><th>伤害破盾</th></tr></thead><tbody>${entry.shieldDetails.map(detail => `<tr data-player-shield-absorption="${detail.instanceId}"><td>${shieldName(detail.instanceId, entry)}</td><td>${num(detail.hpBefore)} → ${num(detail.hpAfter)}</td><td>${num(detail.absorptionMultiplier)} ／ ${num(detail.effectiveAbsorptionMultiplier)}</td><td>${num(detail.capacity)}</td><td>${num(detail.absorbedDamage)} ／ ${num(detail.damageAfterShield)}</td><td>${detail.broken ? "是" : "否"}</td></tr>`).join("")}</tbody></table></div>` : ""}<section data-player-shield-callbacks><h4>实际管理器事件顺序</h4>${entry.callbacks.length ? `<ol>${entry.callbacks.map(callback => `<li>${callbacks[callback.kind]} · ${shieldName(callback.instanceId, entry)} · 原因：${callbackReasons[callback.reason]} <code>${callback.kind}</code></li>`).join("")}</ol>` : "<p>本条没有新增护盾回调。</p>"}<p>这里只记录通用模板与管理器事件，不表示角色专属爆炸、治疗、降抗或强效副作用已经执行。</p></section>${hp ? `<section data-player-shield-hp><h4>关联的实际玩家生命变化</h4><dl><dt>最大生命</dt><dd>${num(hp.maxHp)}</dd><dt>受击前／后的生命</dt><dd>${num(hp.currentHpBefore)} ／ ${num(hp.currentHpAfter)}</dd><dt>请求扣血／实际扣血</dt><dd>${num(hp.attemptedLoss)} ／ ${num(hp.actualLoss)}</dd><dt>超出剩余生命的伤害</dt><dd>${num(hp.overkill)}</dd></dl><p>零生命按当前模式钳制并继续行动；此处不模拟死亡与复活。</p></section>` : ""}${damage ? `<p>关联反应受击 #${damage.id} · ${damage.frame}f · ${placement(damage.frame)} · 实际生命伤害 ${num(damage.finalDamage)}；关系取已保存事件，不用护盾前后数值自行反推。</p>` : ""}${entry.ownerStats ? `<details><summary>生成事件实际读取的完整基础面板</summary><dl>${Object.entries(entry.ownerStats).map(([key, value]) => `<dt>${esc(key)}</dt><dd>${num(value)}</dd>`).join("")}</dl></details>` : ""}<details><summary>事件前的完整通用护盾状态</summary>${stateHtml(entry.stateBefore)}</details><details><summary>事件后的完整通用护盾状态</summary>${stateHtml(entry.stateAfter)}</details><details><summary>完整原始记录与输入</summary><pre>${esc(JSON.stringify({ shield: entry, input: input ?? null, playerDamage: damage ?? null }, null, 2))}</pre></details>`;
  };
  let page = 0;
  const draw = (): void => {
    const first = page * PAGE_SIZE, last = Math.min(first + PAGE_SIZE, entries.length);
    root.querySelector<HTMLElement>("[data-player-shield-table]")!.innerHTML = entries.length ? `<div class="table-wrap"><table><thead><tr><th>帧／秒</th><th>实际操作</th><th>受击对象</th><th>来袭／穿透伤害</th><th>状态与公式</th></tr></thead><tbody>${entries.slice(first, last).map(entry => `<tr data-player-shield-log-id="${entry.id}"><td>${entry.frame}f / ${num(entry.timeSeconds)}s</td><td>${operations[entry.operation]}</td><td>${actorName(entry.targetActorId)}</td><td>${num(entry.incomingDamage)} ／ ${num(entry.damageAfterShield)}</td><td>${entry.stateBefore.shields.length} → ${entry.stateAfter.shields.length} 面通用盾<details data-player-shield-detail="${entry.id}"><summary>实际公式、状态与来源</summary><div data-player-shield-detail-body></div></details></td></tr>`).join("")}</tbody></table></div><div class="editor-actions"><button type="button" data-player-shield-page="-1"${first === 0 ? " disabled" : ""}>上一页</button><span role="status">${first + 1}–${last} / ${entries.length} 条</span><button type="button" data-player-shield-page="1"${last >= entries.length ? " disabled" : ""}>下一页</button></div>` : "<p>此区间没有通用护盾实际记录。条件仍可在队伍页编辑；空账本不等于护盾强度为零，也不证明未来不会受击。</p>";
    for (const detail of root.querySelectorAll<HTMLDetailsElement>("[data-player-shield-detail]")) detail.ontoggle = () => {
      const host = detail.querySelector<HTMLElement>("[data-player-shield-detail-body]")!;
      if (!detail.open || host.dataset.mounted) return;
      host.dataset.mounted = "true";
      try { host.innerHTML = detailsHtml(logsById.get(Number(detail.dataset.playerShieldDetail))!); }
      catch (error) { host.innerHTML = `<p class="calculator-error">护盾追踪暂时无法还原：${esc(error instanceof Error ? error.message : error)}</p>`; }
    };
  };
  root.onclick = event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-player-shield-page]");
    if (!button || button.disabled) return;
    page += Number(button.dataset.playerShieldPage); draw();
    root.querySelector<HTMLButtonElement>(`[data-player-shield-page="${button.dataset.playerShieldPage}"]:not(:disabled)`)?.focus();
  };
  draw();
}
