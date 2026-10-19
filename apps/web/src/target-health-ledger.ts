import type { SimulationResult } from "@genshin-dps-lab/schemas";
import type { CalculationTraceNode } from "@genshin-dps-lab/sim-core";
import { renderTraceHtml } from "./calculator-trace-view";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number): string => value.toLocaleString("zh-CN", { maximumFractionDigits: 6 });
const elements = { neutral: "无元素", pyro: "火", hydro: "水", electro: "雷", cryo: "冰", anemo: "风", geo: "岩", dendro: "草" };
const origins = { "enemy-hp-threshold": "目标生命阈值", "enemy-defeat": "目标被击败", external: "外部声明掉落" };

/** Displays recorded HP transitions and spawned particles without running another health model. */
export function renderTargetHealthLedger(root: HTMLElement, result: SimulationResult, endFrame = Infinity): void {
  root.hidden = result.config.targetHealthModel === undefined;
  if (root.hidden) { root.replaceChildren(); return; }
  const rows = (result.targetHealthLog ?? []).filter(entry => entry.frame < endFrame);
  const particles = result.particleEvents.filter(entry => entry.origin !== undefined && entry.spawnFrame < endFrame);
  const targetName = (id: string): string => esc(result.enemyTargets.find(target => target.id === id)?.name ?? id);
  const summaries = (result.targetHealthSummaries ?? []).map(summary => {
    const events = rows.filter(entry => entry.targetId === summary.targetId);
    const last = events.at(-1);
    const defeatedFrame = summary.defeatedFrame !== null && summary.defeatedFrame < endFrame ? summary.defeatedFrame : null;
    return `<tr data-target-health-summary="${esc(summary.targetId)}"><td>${targetName(summary.targetId)}</td><td>${num(summary.maxHp)}</td><td>${num(summary.initialHp)} → ${num(last?.hpAfter ?? summary.initialHp)}</td><td>${num(events.reduce((sum, entry) => sum + entry.rawDamage, 0))}</td><td>${num(events.reduce((sum, entry) => sum + entry.effectiveHpDamage, 0))}</td><td>${num(events.reduce((sum, entry) => sum + entry.overkill, 0))}</td><td>${defeatedFrame === null ? "观察范围内未击败" : `${defeatedFrame}f 已击败`}</td></tr>`;
  }).join("");
  root.innerHTML = `<h3>目标实际生命与声明掉落</h3><p>按真实伤害事件立即扣血，跨阈值与击杀掉落各执行一次。原始伤害仍计入伤害和 DPS；有效扣血与过量伤害单独列出。目标死亡后，后续攻击按实际未命中记录处理。这里是用户声明的场景规则，未模拟敌方元素护盾或复现固定来源程序的旧生命掉球顺序。</p><p>以下展示${Number.isFinite(endFrame) ? `绝对帧 [0, ${endFrame})` : "本次完整模拟"}内已经发生的记录；不会补入窗口外的扣血或拾取。</p><div class="table-wrap"><table><thead><tr><th>目标</th><th>生命上限</th><th>初始 → 观察结束生命</th><th>原始伤害</th><th>有效扣血</th><th>过量伤害</th><th>状态</th></tr></thead><tbody>${summaries}</tbody></table></div><div data-target-health-table></div><h4>真实掉落与能量入账</h4><div data-target-health-particles></div>`;
  let page = 0, particlePage = 0;
  const pagination = (kind: "health" | "particles", start: number, end: number, count: number): string => `<div class="editor-actions"><button type="button" data-target-health-page="${kind}" data-direction="-1"${start === 0 ? " disabled" : ""}>上一页</button><span role="status">${count ? start + 1 : 0}–${end} / ${count} 条</span><button type="button" data-target-health-page="${kind}" data-direction="1"${end === count ? " disabled" : ""}>下一页</button></div>`;
  const drawHealth = (): void => {
    const start = page * 25, end = Math.min(start + 25, rows.length);
    root.querySelector<HTMLElement>("[data-target-health-table]")!.innerHTML = `<div class="table-wrap"><table><thead><tr><th>帧 / 秒</th><th>目标 / 伤害记录</th><th>生命前 → 后</th><th>原始 / 有效 / 过量</th><th>实际掉落规则</th><th>公式与依据</th></tr></thead><tbody>${rows.slice(start, end).map(entry => `<tr data-target-health-event="${entry.id}"><td>${entry.frame}f / ${num(entry.timeSeconds)}s</td><td>${targetName(entry.targetId)}<small>伤害 #${entry.damageEventId}${entry.defeated ? " · 本帧击败" : ""}</small></td><td>${num(entry.hpBefore)} → ${num(entry.hpAfter)}</td><td>${num(entry.rawDamage)} / ${num(entry.effectiveHpDamage)} / ${num(entry.overkill)}</td><td>${entry.triggeredDropIds.length ? entry.triggeredDropIds.map(esc).join("、") : "无"}</td><td><details data-target-health-detail="${entry.id}"><summary>公式、变量、数值代入与解释</summary><p>生命依据：${esc(entry.sourceRef)}。实际事件顺序 ${entry.frame} / ${entry.eventPriority} / ${entry.eventSequence}。</p><div data-target-health-trace="${entry.id}"></div><pre>${esc(JSON.stringify(entry, null, 2))}</pre></details></td></tr>`).join("")}</tbody></table></div>${rows.length ? "" : "<p>此观察范围内没有目标生命变化。</p>"}${pagination("health", start, end, rows.length)}`;
    root.querySelectorAll<HTMLDetailsElement>("[data-target-health-detail]").forEach(details => {
      const entry = rows.find(row => row.id === Number(details.dataset.targetHealthDetail))!;
      details.addEventListener("toggle", () => {
        if (!details.open) return;
        const host = details.querySelector<HTMLElement>("[data-target-health-trace]")!;
        if (host.dataset.mounted) return;
        host.innerHTML = renderTraceHtml(entry.trace as CalculationTraceNode[]);
        host.dataset.mounted = "true";
      });
    });
  };
  const drawParticles = (): void => {
    const start = particlePage * 25, end = Math.min(start + 25, particles.length);
    root.querySelector<HTMLElement>("[data-target-health-particles]")!.innerHTML = `<div class="table-wrap"><table><thead><tr><th>真实来源 / 规则</th><th>微粒或晶球</th><th>生成 / 接收帧</th><th>实际能量及完整来源</th></tr></thead><tbody>${particles.slice(start, end).map(particle => {
      const origin = particle.origin!;
      const energy = result.energyLog.filter(entry => entry.kind === "particle" && entry.frame < endFrame && entry.sourceActorId === particle.sourceActorId && entry.sourceActionId === particle.sourceActionId && entry.source === particle.source && entry.spawnFrame === particle.spawnFrame && entry.receiveFrame === particle.receiveFrame);
      return `<tr data-target-health-particle="${particle.id}"><td>${origins[origin.kind]}<small>${esc(origin.dropId)}${origin.targetId === null ? "" : ` · ${targetName(origin.targetId)}`}${origin.targetHealthLogId === null ? "" : ` · 生命记录 #${origin.targetHealthLogId}`}${origin.damageEventId === null ? "" : ` · 伤害 #${origin.damageEventId}`}</small></td><td>${elements[particle.particleElement]}${particle.particleKind === "orb" ? "晶球" : "微粒"} × ${particle.particleCount}</td><td>${particle.spawnFrame}f → ${particle.receiveFrame}f<small>${particle.receivedWithinSimulation && particle.receiveFrame < endFrame ? "已在观察范围内接收" : "观察范围内尚未接收"}</small></td><td><details><summary>查看实际接收与来源</summary><p>${esc(origin.sourceRef)}</p>${energy.length ? `<ul>${energy.map(entry => `<li>${esc(result.config.characters.find(actor => actor.id === entry.receiverId)?.name ?? entry.receiverId)}：${num(entry.energyBefore)} → ${num(entry.energyAfter)}；实际获得 ${num(entry.gainedEnergy)}，溢出 ${num(entry.wastedEnergy)}。</li>`).join("")}</ul>` : "<p>观察范围内没有对应能量入账。</p>"}<pre>${esc(JSON.stringify({ particle, energy }, null, 2))}</pre></details></td></tr>`;
    }).join("")}</tbody></table></div>${particles.length ? "" : "<p>此观察范围内没有已生成的声明掉落。</p>"}${pagination("particles", start, end, particles.length)}`;
  };
  root.onclick = event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-target-health-page]");
    if (!button || button.disabled) return;
    if (button.dataset.targetHealthPage === "health") { page += Number(button.dataset.direction); drawHealth(); }
    else { particlePage += Number(button.dataset.direction); drawParticles(); }
    (root.querySelector<HTMLButtonElement>(`[data-target-health-page="${button.dataset.targetHealthPage}"][data-direction="${button.dataset.direction}"]:not(:disabled)`) ?? root.querySelector<HTMLButtonElement>(`[data-target-health-page="${button.dataset.targetHealthPage}"]:not(:disabled)`))?.focus();
  };
  drawHealth(); drawParticles();
}
