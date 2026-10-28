import type { SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";
import { analyzeSourceHostEnergy } from "./source-host-energy-analysis";
import { captureSourceHostEnergy, replaySourceHostEnergy, type SourceHostEnergyCapture } from "../../../packages/sim-core/src/source-host-energy-capture";
import { renderTraceHtml } from "./calculator-trace-view";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number | null): string => value === null ? "无回执" : value.toLocaleString("zh-CN", { maximumFractionDigits: 4 });
const count = (value: number | null): string => value === null ? "旧记录缺逐次拒绝日志" : String(value);
const operationLabels: Record<string, string> = { "flat-change": "直接变化", consume: "消耗", "particle-apply": "粒子入账" };

/** Render one continuous native run. Adjacent windows are diagnostics, not separate simulations. */
export function renderSourceHostEnergyPanel(root: HTMLElement, result: SourceHostResult, openCalculator?: (capture: SourceHostEnergyCapture) => void): void {
  const analysis = analyzeSourceHostEnergy(result);
  const first = analysis.windows[0]!, second = analysis.windows[1];
  const rows = analysis.windows.flatMap((window, index) => window.actors.map(actor => `<tr>
    <td>${index === 0 ? "前半窗" : "后半窗"} [${window.startFrame}, ${window.endFrame})</td><td>${esc(actor.actor)}</td><td>${actor.recharge === null ? "无回执" : `${num(actor.recharge * 100)}%`}</td>
    <td>${num(actor.startEnergy)} → ${num(actor.endEnergy)}${actor.energyBoundarySource === "native-tick-samples" ? "（帧采样）" : ""}</td><td>${num(actor.gained)}</td><td>${num(actor.wasted)}</td><td>${num(actor.spent)}</td>
    <td>${actor.particleEvents}</td><td>${actor.burstAccepted}</td><td>${count(actor.burstRejected)}</td><td>${count(actor.burstInsufficientEnergy)}</td></tr>`)).join("");
  const selected = analysis.energyEvents.slice(0, 120);
  const applications = result.energyApplications ?? [];
  const applicationRows = applications.map((event, index) => `<tr data-source-host-energy-row="${index}"><td>${index}</td><td>${event.frame}</td><td>${esc(event.actorKey)}</td><td>${esc(operationLabels[event.operation] ?? event.operation)}</td><td>${esc(event.source)}</td><td>${num(event.energyBefore)} → ${num(event.energyAfter)}</td><td>${num(event.requestedAmount)}</td><td><button type="button" data-source-host-energy-select="${index}">查看公式</button></td></tr>`).join("");
  root.innerHTML = `<section class="card" data-source-host-energy-analysis><h3>连续来源运行：能量与起步诊断</h3>
    <p>源码 <code>${esc(analysis.sourceCommit.slice(0, 7))}</code>；种子 <code>${esc(analysis.seed)}</code>；执行器 <code>${esc(analysis.wasmSha256 ?? "旧记录未保存哈希")}</code>。本次执行 ${analysis.durationFrames} 帧，统计范围见下表；分窗时没有重置角色、能量、冷却或随机流。</p>
    <p>${second ? `前半窗 ${num(first.damage)} 伤害、${num(first.dps)} DPS；后半窗 ${num(second.damage)} 伤害、${num(second.dps)} DPS。两窗 DPS 差 ${num(second.dps - first.dps)}。` : `本次仅一帧，完整窗 ${num(first.damage)} 伤害、${num(first.dps)} DPS，不能分窗比较。`}这是本次起步敏感性诊断，不能单凭伤害相近判定能量或随机稳态。</p>
    <p>面板充能是来源初始属性日志的舍入值；临时充能变化以各次粒子回执中的实际 ER 为准。</p>
    ${analysis.windows.some(window => window.actors.some(actor => actor.energyBoundarySource === "native-tick-samples")) ? "<p>标注帧采样的余额可能早于同帧动作回能；缺少逐笔回执时，不将它当作精确帧末余额。</p>" : ""}
    <div class="table-wrap"><table><thead><tr><th>实际观察窗</th><th>角色</th><th>初始面板充能</th><th>窗边界能量</th><th>实际获得</th><th>溢出</th><th>消耗</th><th>粒子回执</th><th>成功 Q</th><th>拒绝 Q</th><th>能量不足 Q</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${analysis.perAttemptFailuresComplete ? "" : "<p>导入的旧执行器结果存在失败区间，却没有逐次拒绝事件；该窗的拒绝次数无法还原。</p>"}
    <details><summary>实际能量回执（前 ${selected.length} / ${analysis.energyEvents.length} 条）</summary><p>获得为来源记录的能量前后差；溢出是来源记录的原始回能量减实际入账量。完整事件仍保存在导出的原始日志中。</p><div class="table-wrap"><table><thead><tr><th>帧</th><th>角色</th><th>事件</th><th>来源</th><th>能量前 → 后</th><th>实际获得</th><th>溢出</th></tr></thead><tbody>${selected.map(event => `<tr><td>${event.frame}</td><td>${esc(analysis.windows[0]!.actors[event.actorIndex]?.actor ?? event.actorIndex)}</td><td>${event.kind === "particle" ? "粒子" : event.kind === "drain" ? "消耗" : "直接回复"}</td><td>${esc(event.source)}</td><td>${num(event.before)} → ${num(event.after)}</td><td>${num(event.gained)}</td><td>${num(event.wasted)}</td></tr>`).join("")}</tbody></table></div></details>
    <details><summary>实际 Q 请求（${analysis.actionAttempts.filter(attempt => attempt.action === "burst").length} 次）</summary><div class="table-wrap"><table><thead><tr><th>帧</th><th>角色</th><th>结果</th><th>来源原因</th></tr></thead><tbody>${analysis.actionAttempts.filter(attempt => attempt.action === "burst").slice(0, 120).map(attempt => `<tr><td>${attempt.frame}</td><td>${esc(analysis.windows[0]!.actors[attempt.actorIndex]?.actor ?? attempt.actorIndex)}</td><td>${attempt.accepted ? "执行" : "拒绝"}</td><td>${esc(attempt.reason ?? "—")}</td></tr>`).join("")}</tbody></table></div></details>
    <section data-source-host-energy-applications><h4>实际能量操作与共享公式</h4><p>${applications.length ? `共 ${applications.length} 条带公式身份的能量应用。选择一条查看原始公式与代入；独立实验只重算已捕获数值，不重跑触发、冷却或粒子生成。` : "此旧运行没有逐次能量应用回执，无法恢复独立能量公式。"}</p>
      ${applications.length ? `<label>选择实际能量事件<input type="number" id="source-host-energy-index" min="0" max="${applications.length - 1}" step="1" value="0"></label><button type="button" id="source-host-open-energy-calculator" ${openCalculator ? "" : "disabled"}>送到独立能量计算器</button><div id="source-host-energy-hit" role="status"></div><div class="table-wrap"><table><thead><tr><th>编号</th><th>帧</th><th>角色</th><th>操作</th><th>来源</th><th>能量前 → 后</th><th>请求量</th><th>查看</th></tr></thead><tbody>${applicationRows}</tbody></table></div>` : ""}
    </section>
  </section>`;
  if (applications.length) {
    const index = root.querySelector<HTMLInputElement>("#source-host-energy-index")!;
    const detail = root.querySelector<HTMLElement>("#source-host-energy-hit")!;
    const selectedApplication = () => applications[index.valueAsNumber];
    const showApplication = () => {
      try {
        const application = selectedApplication();
        if (!application) { detail.textContent = "当前没有该能量事件。"; return; }
        const replay = replaySourceHostEnergy(captureSourceHostEnergy(result, application.id));
        detail.innerHTML = `<h5>${esc(application.actorKey)} · ${esc(application.source)} · 第 ${application.frame} 帧</h5><p>实际能量 ${num(application.energyBefore)} → ${num(application.energyAfter)}；公式重放 ${num(replay.reproducedEnergy)}；请求量 ${num(application.requestedAmount)}；实际变化 ${num(replay.actualChange)}；溢出 ${num(replay.overflow)}。</p>${renderTraceHtml(replay.trace)}`;
      } catch (error) { detail.textContent = error instanceof Error ? error.message : String(error); }
    };
    index.oninput = showApplication;
    root.querySelectorAll<HTMLButtonElement>("[data-source-host-energy-select]").forEach(button => {
      button.onclick = () => { index.value = button.dataset.sourceHostEnergySelect ?? "0"; showApplication(); };
    });
    root.querySelector<HTMLButtonElement>("#source-host-open-energy-calculator")!.onclick = () => {
      const application = selectedApplication();
      if (application && openCalculator) openCalculator(captureSourceHostEnergy(result, application.id));
    };
    showApplication();
  }
}
