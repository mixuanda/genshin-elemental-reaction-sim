import type { SimulationStartupResult } from "../../../packages/sim-core/src/simulation-analysis";
import { renderActionStateLedger } from "./action-state-ledger";

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number): string => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 6 }).format(value);
const PAGE_SIZE = 25;

/** Read the actual continuous run. No energy, action order or startup is simulated here. */
export function renderStartupLedger(root: HTMLElement, startup: SimulationStartupResult): void {
  const result = startup.result;
  if (!result) { root.replaceChildren(); return; }
  const endFrame = startup.startup.measurementStartTick;
  const actions = result.actionLog.filter(row => row.frame < endFrame);
  const failures = result.skippedActions.filter(row => row.frame < endFrame);
  const gains = result.energyLog.filter(row => row.frame < endFrame);
  const names = new Map(result.config.characters.map(actor => [actor.id, actor.name]));
  const name = (id: string): string => esc(names.get(id) ?? id);
  const sections = {
    actions: { title: "实际启动行动", count: actions.length, heads: ["帧 / 秒", "角色", "行动", "周期 / 指令", "消耗前能量", "消耗后能量"], row: (index: number) => {
      const row = actions[index]!;
      return `<tr data-startup-action-index="${index}"><td>${row.frame}f / ${num(row.time)}s</td><td>${name(row.actorId)}</td><td>${esc(row.action)}</td><td>${row.cycle} / ${row.timelineCommandIndex ?? "—"}</td><td>${num(row.energyBefore)}</td><td>${num(row.energyAfter)}</td></tr>`;
    } },
    failures: { title: "启动期间未执行的耗能请求", count: failures.length, heads: ["帧 / 秒", "角色", "请求行动", "当时能量", "所需能量", "原因"], row: (index: number) => {
      const row = failures[index]!;
      return `<tr data-startup-failure-index="${index}"><td>${row.frame}f / ${num(row.time)}s</td><td>${name(row.actorId)}</td><td>${esc(row.action)}</td><td>${num(row.energyBefore)}</td><td>${num(row.energyCost)}</td><td>${esc(row.reason)} <small>${esc(row.reasonCode)}</small></td></tr>`;
    } },
    energy: { title: "启动期间粒子与定值能量变化", count: gains.length, heads: ["收到帧 / 秒", "接收角色 / 前后台", "来源", "变化前 → 后", "实际变化 / 溢出", "结算说明"], row: (index: number) => {
      const row = gains[index]!;
      const actor = result.config.characters.find(candidate => candidate.id === row.receiverId)!;
      const sourceFormula = row.kind === "particle"
        ? `${row.particleKind === "orb" ? "元素晶球" : "元素微粒"}数量 ${num(row.particleCount!)}，${row.isSameElement ? "同元素" : row.particleElement === "neutral" ? "无元素" : "异元素"}，前后台系数 ${num(row.fieldMultiplier)}。核心记录的充能前能量（已计种类、数量和分配）为 ${num(row.rawEnergy)}；乘充能：${num(row.rawEnergy)} × ${num(row.energyRecharge)} = ${num(row.finalEnergy)}`
        : `定值能量 ${num(row.finalEnergy)}，不乘充能效率`;
      const resolution = row.applied
        ? `限制到 [0, ${num(actor.energyMax)}]：clamp(${num(row.energyBefore)} + ${num(row.finalEnergy)}, 0, ${num(actor.energyMax)}) = ${num(row.energyAfter)}；实际变化 ${num(row.gainedEnergy)}，溢出 ${num(row.wastedEnergy)}`
        : `来源内置间隔尚未结束；本次不应用。可再次触发帧 ${row.internalCooldownReadyFrame ?? "未知"}，能量保持 ${num(row.energyAfter)}`;
      return `<tr data-startup-energy-index="${index}"><td>${row.receiveFrame}f / ${num(row.timeSeconds)}s</td><td>${name(row.receiverId)} / ${row.isOnField ? "前台" : "后台"}</td><td>${esc(row.source)}${row.spawnFrame === null ? "" : `<small>产生于 ${row.spawnFrame}f</small>`}</td><td>${num(row.energyBefore)} → ${num(row.energyAfter)}</td><td>${num(row.gainedEnergy)} / ${num(row.wastedEnergy)}</td><td><details><summary>${row.applied ? "查看结算" : "本次被内置间隔阻止"}</summary><p>${esc(sourceFormula)}</p><p>${esc(resolution)}</p><p>完整日志 #${row.id}；显示舍入不改变模拟数值。</p></details></td></tr>`;
    } }
  };
  type Section = keyof typeof sections;
  const pages: Record<Section, number> = { actions: 0, failures: 0, energy: 0 };
  root.innerHTML = `<p>以下记录来自同一次连续运行的 [0, ${endFrame})f，包含真实成功行动、失败请求和能量变化。观察窗口不会在边界补满能量。各表保留自身日志顺序，不把不同表的同帧记录拼成推测的执行顺序。</p>
    <div class="table-wrap"><table data-startup-energy-boundary><thead><tr><th>角色</th><th>实际起始能量</th><th>观察窗口开始前能量</th></tr></thead><tbody>${result.config.characters.map(actor => `<tr><td>${name(actor.id)}</td><td>${num(result.energyStats[actor.id]!.initial)}</td><td>${startup.startup.energyAtMeasurementStart?.[actor.id] === undefined ? "未知" : num(startup.startup.energyAtMeasurementStart[actor.id]!)}</td></tr>`).join("")}</tbody></table></div>
    ${(Object.keys(sections) as Section[]).map(key => `<details data-startup-section="${key}"><summary>${sections[key].title}（${sections[key].count} 条）</summary><div data-startup-table="${key}"></div></details>`).join("")}`;
  const draw = (key: Section): void => {
    const section = sections[key];
    const start = pages[key] * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, section.count);
    root.querySelector<HTMLElement>(`[data-startup-table="${key}"]`)!.innerHTML = section.count === 0
      ? '<p>此启动区间没有该类记录。</p>'
      : `<div class="table-wrap"><table><thead><tr>${section.heads.map(head => `<th>${head}</th>`).join("")}</tr></thead><tbody>${Array.from({ length: end - start }, (_, i) => section.row(start + i)).join("")}</tbody></table></div><div class="editor-actions"><button type="button" data-startup-page="${key}" data-direction="-1"${start === 0 ? " disabled" : ""}>上一页</button><span role="status" data-startup-page-status="${key}">${start + 1}–${end} / ${section.count} 条</span><button type="button" data-startup-page="${key}" data-direction="1"${end === section.count ? " disabled" : ""}>下一页</button></div>`;
  };
  for (const key of Object.keys(sections) as Section[]) draw(key);
  const actionStateHost = document.createElement("section");
  actionStateHost.dataset.startupActionState = "";
  root.append(actionStateHost);
  renderActionStateLedger(actionStateHost, result, endFrame);
  root.onclick = event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-startup-page]");
    if (!button || button.disabled) return;
    const key = button.dataset.startupPage as Section;
    pages[key] += Number(button.dataset.direction);
    draw(key);
    const nextFocus = root.querySelector<HTMLButtonElement>(`button[data-startup-page="${key}"][data-direction="${button.dataset.direction}"]:not([disabled])`)
      ?? root.querySelector<HTMLButtonElement>(`button[data-startup-page="${key}"]:not([disabled])`);
    nextFocus?.focus();
  };
}
