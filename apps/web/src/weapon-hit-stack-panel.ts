import type { SimulationResult } from "@genshin-dps-lab/schemas";
import type { CalculationTraceNode } from "@genshin-dps-lab/sim-core";
import { WEAPON_HIT_STACK_SOURCE, type WeaponHitStackState } from "../../../packages/sim-core/src/weapon-hit-stack-model";
import { weaponHitStackDecisionTrace } from "../../../packages/sim-core/src/weapon-hit-stack-runtime";
import { weaponHitStackLabels } from "./weapon-hit-stack-controls";
import { renderTraceHtml } from "./calculator-trace-view";

type Entry = NonNullable<SimulationResult["weaponHitStackLog"]>[number];
const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 8 });
const outcomes: Record<Entry["outcome"], string> = {
  "stack-gained": "实际获得层数", "cap-refreshed": "已满层，按来源刷新状态", "critical-reset": "实际暴击清层",
  "cooldown-blocked": "命中间隔冷却阻止增层", "off-field": "要求在场的持有者未在场", "wrong-owner": "伤害来源不是持有者",
  "zero-damage": "零伤害不满足来源条件", "ineligible-tag": "攻击标签不适用", "physical-damage": "物理伤害不满足来源条件",
  "actual-critical-required": "缺少实际暴击结果", "stats-read": "实际完整属性读取", "expired-on-read": "属性读取移除到期效果",
};
const tags: Record<string, string> = { normal: "普通攻击", charged: "重击", plunge: "下落攻击", skill: "元素战技", burst: "元素爆发", proc: "独立追击" };
const statNames = { atkPct: "攻击力百分比", defPct: "防御力百分比", critRate: "暴击率", dmgBonus: "通用伤害加成" };
const PAGE_SIZE = 25;

function stateHtml(state: WeaponHitStackState): string {
  return `<dl><dt>来源保存的私有层数</dt><dd>${state.stacks}</dd><dt>属性效果到期帧</dt><dd>${state.effectExpiresFrame === null ? "无已保存窗口" : `${state.effectExpiresFrame}f`}</dd><dt>命中间隔冷却到期帧</dt><dd>${state.cooldownExpiresFrame === null ? "尚无冷却" : `${state.cooldownExpiresFrame}f`}</dd></dl>`;
}

/** Display actual source decisions and the same AST used by the calculation core. */
export function renderWeaponHitStackLedger(root: HTMLElement, result: SimulationResult, window?: { startTick: number; endTick: number }): void {
  const all = result.weaponHitStackLog ?? [];
  root.onclick = null;
  root.hidden = !result.config.weaponHitStackModel && all.length === 0;
  if (root.hidden) { root.replaceChildren(); return; }
  const start = window?.startTick ?? 0, end = window?.endTick ?? Infinity;
  const entries = all.filter(entry => entry.frame >= start && entry.frame < end);
  const byId = new Map(all.map(entry => [entry.id, entry]));
  const damageById = new Map(result.damageEvents.map(entry => [entry.id, entry]));
  const actorName = (actorId: string | null): string => actorId === null ? "无" : esc(result.config.characters.find(actor => actor.id === actorId)?.name ?? actorId);
  const placement = (frame: number): string => !window ? "本次模拟内" : frame < start ? "窗口之前，仅作来源引用" : frame >= end ? "窗口之后，仅作来源引用" : "窗口内";
  root.innerHTML = `<h3>武器：实际命中叠层与属性取样记录</h3>
    <p>${window ? `仅列观察窗口 [${start}, ${end})f 内的真实记录，结束帧不计入。` : "显示本次模拟实际伤害回调与完整属性取样。"}每条记录保留事件先后、真实层数与完整数值代入；关联命中可能位于观察窗口之外。</p>
    <p>命中后的增层只影响后续实际取样；它不会追溯修改触发它的命中或已有进攻快照。这里的属性贡献已经进入对应取样面板，不能再加一次到命中伤害上。</p>
    <p>来源状态存在性判断在到期帧包含等号，实际属性读取则会移除到期效果。私有层数与保存的到期帧本身不证明当前仍有数值增益；实际贡献以下方取样记录及共享公式为准。</p>
    <div data-weapon-hit-stack-table></div>
    ${!window && result.weaponHitStackState ? `<details><summary>实际模拟结束时保存的私有状态</summary>${result.weaponHitStackState.actors.map(row => `<h4>${actorName(row.actorId)} · ${weaponHitStackLabels[row.weaponId]} R${row.refinement}</h4>${stateHtml(row.state)}`).join("")}<p>这是模拟结束时保存的状态，不是对结束后任意时刻是否生效的判断。</p></details>` : ""}
    <details><summary>固定来源与已声明边界</summary><p>${esc(WEAPON_HIT_STACK_SOURCE.profileId)} · 固定源码参考，未经当前游戏实测确认。</p><ul>${WEAPON_HIT_STACK_SOURCE.assumptions.map(note => `<li>${esc(note)}</li>`).join("")}</ul><p>完整配置、原始回调、状态与计算追踪随运行记录 JSON 保存。关联命中可在下方还原完整计算上下文；<a href="/calculator">独立单技能计算器</a>无需配置队伍或轮转即可使用。</p></details>`;

  const detailsHtml = (entry: Entry): string => {
    const event = entry.event;
    const parent = event.kind === "enemy-damage" ? damageById.get(Number(event.parentDamageEventId)) : undefined;
    const trace = weaponHitStackDecisionTrace({ ...entry, trace: entry.trace as CalculationTraceNode[] });
    return `<p>记录 #${entry.id} · ${entry.frame}f / ${num(entry.timeSeconds)}s；实际优先级 ${entry.eventPriority}，队列序号 ${entry.eventSequence}，事件内序号 ${entry.intraEventSequence}。</p>
      <p>持有者 ${actorName(entry.actor.actorId)} · ${weaponHitStackLabels[entry.actor.weaponId]} R${entry.actor.refinement}；实际结果：${outcomes[entry.outcome]}。</p>
      ${event.kind === "enemy-damage" ? `<p>实际伤害来源 ${actorName(event.sourceActorId)}；前台 ${actorName(event.activeCharacterId)}；目标 ${esc(event.targetId)}；攻击标签 ${esc(tags[event.attackTag] ?? event.attackTag)}；元素 ${esc(event.element)}；实际伤害 ${num(event.damage)}；该次暴击反馈 ${event.critical === null ? "未提供实际布尔结果" : event.critical ? "实际暴击" : "实际未暴击"}。</p>` : `<p>本次完整属性读取者 ${actorName(event.actorId)}；取样时真实护盾庇护：${event.shielded ? "有" : "无"}。此记录不是新增伤害回调，不凭取样补算一次命中。</p>`}
      ${trace.length ? `<section data-weapon-hit-stack-trace>${renderTraceHtml(trace)}</section>` : `<p>此次 ${outcomes[entry.outcome]}；没有执行数值状态公式，未补造触发或增益。</p>`}
      ${entry.values ? `<h4>本次实际取样的武器属性贡献</h4><dl>${Object.entries(statNames).map(([key, label]) => `<dt>${label}（小数）</dt><dd>${num(entry.values![key as keyof typeof statNames])}</dd>`).join("")}</dl><p>贡献在实际取样中合入角色面板；已有快照沿用其原取样结果。</p>` : "<p>本条为回调状态决策，没有执行完整属性取样；不将未知取样贡献显示为零。</p>"}
      ${parent ? `<p>关联实际伤害 #${parent.id} · ${parent.frame}f · ${placement(parent.frame)} · ${actorName(parent.sourceActorId)} · ${num(parent.finalDamage)} 伤害。新增层数发生在该伤害回调之后。</p><details data-weapon-hit-stack-hit="${parent.id}"><summary>还原关联命中的公式、变量、代入与结果</summary><div data-weapon-hit-stack-hit-trace></div></details>` : ""}
      <details><summary>事件前状态</summary>${stateHtml(entry.stateBefore)}</details><details><summary>事件后状态</summary>${stateHtml(entry.stateAfter)}</details>
      <p><a href="${esc(entry.sourceRef)}" target="_blank" rel="noopener noreferrer">本条款的固定来源</a>。</p>
      <details><summary>完整原始事件与关联命中</summary><pre>${esc(JSON.stringify({ weaponHitStack: entry, damage: parent ?? null }, null, 2))}</pre></details>`;
  };
  let page = 0;
  const draw = (): void => {
    const first = page * PAGE_SIZE, last = Math.min(first + PAGE_SIZE, entries.length);
    root.querySelector<HTMLElement>("[data-weapon-hit-stack-table]")!.innerHTML = entries.length ? `<div class="table-wrap"><table><thead><tr><th>帧／事件</th><th>持有者／武器</th><th>实际结果</th><th>私有层数／详情</th></tr></thead><tbody>${entries.slice(first, last).map(entry => `<tr data-weapon-hit-stack-log="${entry.id}"><td>${entry.frame}f<small>${entry.event.kind === "enemy-damage" ? "实际伤害回调" : "实际完整属性读取"}</small></td><td>${actorName(entry.actor.actorId)}<small>${weaponHitStackLabels[entry.actor.weaponId]} R${entry.actor.refinement}</small></td><td>${outcomes[entry.outcome]}</td><td>${entry.stateBefore.stacks} → ${entry.stateAfter.stacks}<details data-weapon-hit-stack-details="${entry.id}"><summary>实际公式、状态与来源</summary><div data-weapon-hit-stack-detail-body></div></details></td></tr>`).join("")}</tbody></table></div><div class="editor-actions"><button type="button" data-weapon-hit-stack-page="-1"${first === 0 ? " disabled" : ""}>上一页</button><span role="status">${first + 1}–${last} / ${entries.length} 条</span><button type="button" data-weapon-hit-stack-page="1"${last >= entries.length ? " disabled" : ""}>下一页</button></div>` : "<p>此观察区间没有实际武器回调或属性读取记录；未按预期层数补造触发。</p>";
    for (const details of root.querySelectorAll<HTMLDetailsElement>("[data-weapon-hit-stack-details]")) details.ontoggle = () => {
      const body = details.querySelector<HTMLElement>("[data-weapon-hit-stack-detail-body]")!;
      if (!details.open || body.dataset.mounted) return;
      body.dataset.mounted = "true";
      body.innerHTML = detailsHtml(byId.get(Number(details.dataset.weaponHitStackDetails))!);
      for (const hitDetails of body.querySelectorAll<HTMLDetailsElement>("[data-weapon-hit-stack-hit]")) hitDetails.ontoggle = async () => {
        const traceHost = hitDetails.querySelector<HTMLElement>("[data-weapon-hit-stack-hit-trace]")!;
        if (!hitDetails.open || traceHost.dataset.mounted) return;
        traceHost.dataset.mounted = "true"; traceHost.textContent = "正在还原共享计算上下文……";
        try {
          const { replaySimulationHit } = await import("@genshin-dps-lab/sim-core");
          const replay = replaySimulationHit({ schemaVersion: "calculator-event-v1", eventId: Number(hitDetails.dataset.weaponHitStackHit), sourceResult: result });
          traceHost.innerHTML = `<p>原始伤害 ${num(replay.originalDamage)} · 共享核心还原 ${num(replay.reproducedDamage)} · 差值 ${esc(replay.difference)}</p>${renderTraceHtml(replay.trace)}`;
        } catch (error) { traceHost.innerHTML = `<p class="calculator-error">本次命中还原阻塞：${esc(error instanceof Error ? error.message : error)}</p>`; }
      };
    };
  };
  root.onclick = event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-weapon-hit-stack-page]");
    if (!button || button.disabled) return;
    page += Number(button.dataset.weaponHitStackPage); draw();
    root.querySelector<HTMLButtonElement>(`[data-weapon-hit-stack-page="${button.dataset.weaponHitStackPage}"]:not(:disabled)`)?.focus();
  };
  draw();
}
