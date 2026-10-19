import { createSourceHostResult } from "../../../packages/sim-core/src/source-host-capture";
import type { StochasticDistribution } from "../../../packages/sim-core/src/stochastic-startup";
import type { SourceHostResult, SourceHostRunRequest } from "../../../packages/sim-core/src/source-host-wire";
import { createSourceHostStartupJobs, summarizeSourceHostStartupRuns, type SourceHostStartupJob, type SourceHostStartupRun, type SourceHostStartupScenario, type SourceHostObservationPolicy } from "./source-host-startup-analysis";
import { downloadSourceHostJson } from "./source-host-calculator";

export type { SourceHostStartupJob, SourceHostStartupRun } from "./source-host-startup-analysis";
const esc = (value: unknown) => String(value ?? "").replace(/[&<>\"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]!);
const fmt = (value: number | null | undefined) => value == null ? "未知" : value.toLocaleString("zh-CN", { maximumFractionDigits: 3 });

function parseCustom(text: string): Record<string, number> {
  const lines = text.split(/[\n,，]+/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error("启用自定义起步时，请填写来源角色键=整数初始能量。");
  const byActor: Record<string, number> = {};
  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9_]+)\s*=\s*(\d+)$/);
    if (!match) throw new Error(`无法读取“${line}”；请按 actor_key=整数填写。`);
    const key = match[1]!, raw = match[2]!;
    if (key in byActor || !Number.isSafeInteger(Number(raw))) throw new Error(`角色键重复或能量数值无效：${key}`);
    byActor[key] = Number(raw);
  }
  return byActor;
}

/** Startup sensitivity is a finite native-run diagnostic, not a steady-state claim. */
export function renderSourceHostStartupControls(root: HTMLElement, options: {
  getRequest(): SourceHostRunRequest;
  onRun(jobs: SourceHostStartupJob[]): void;
  onOpenResult(result: SourceHostResult): void;
}): { show(runs: SourceHostStartupRun[]): void; setBusy(busy: boolean): void } {
  let saved: SourceHostStartupRun[] = [];
  let pendingPolicy: SourceHostObservationPolicy = { warmupFrames: 15 * 60, windowFrames: 15 * 60 };
  let savedPolicy = pendingPolicy;
  root.innerHTML = `<details class="card" open data-source-host-startup>
    <summary>起步敏感度：零能 / 满能对照</summary>
    <p>对同一脚本、来源版本和每个种子，分别从零能与满能启动；每次都是独立的完整来源运行。自定义起步须填写所有队员的来源角色键和整数初始能量，实际上限由来源执行器校验。</p>
    <div class="calculator-fields"><label>种子（逗号分隔）<input id="source-startup-seeds" value="1,2"></label><label><input type="checkbox" id="source-startup-include-custom"> 同时加入自定义起步</label></div><p>种子须映射到不同的 Go 随机初始化流；数值不同也可能等价而被拒绝。不同初始化流不等于数学独立。</p>
    <label>自定义初始能量（每行 actor_key=整数）<textarea id="source-startup-custom" rows="3" placeholder="例如 xiangling=0&#10;例如 bennett=40" disabled></textarea></label>
    <div class="calculator-fields"><label>预热秒数<input id="source-startup-warmup" type="number" min="0" step="any" value="15"></label><label>每个窗口秒数<input id="source-startup-window" type="number" min="0" step="any" value="15"></label></div>
    <p id="source-startup-hint" data-source-startup-policy-hint></p>
    <div class="editor-actions"><button type="button" id="source-startup-run">运行起步对照</button><button type="button" id="source-startup-reanalyze" disabled>重新分析保存轨迹</button><button type="button" id="source-startup-export" disabled>导出完整 JSON</button><label class="file-button">导入 JSON<input type="file" id="source-startup-import" accept="application/json"></label></div>
    <p id="source-startup-status" role="status" aria-live="polite"></p><div id="source-startup-result"></div>
    <p>这是有限样本的起步敏感度诊断，不证明随机稳态。零能与满能使用相同初始化种子，但起始状态不同会改变后续随机数消耗顺序，因此逐事件随机行为不保证对应。能量、冷却、姿态和动画仍以各次实际执行为准。</p>
  </details>`;
  const status = root.querySelector<HTMLElement>("#source-startup-status")!;
  const output = root.querySelector<HTMLElement>("#source-startup-result")!;
  const runButton = root.querySelector<HTMLButtonElement>("#source-startup-run")!;
  const reanalyzeButton = root.querySelector<HTMLButtonElement>("#source-startup-reanalyze")!;
  const exportButton = root.querySelector<HTMLButtonElement>("#source-startup-export")!;
  const customCheck = root.querySelector<HTMLInputElement>("#source-startup-include-custom")!;
  const customField = root.querySelector<HTMLTextAreaElement>("#source-startup-custom")!;
  customCheck.onchange = () => { customField.disabled = !customCheck.checked; };
  const readPolicy = (): SourceHostObservationPolicy => {
    const warmupFrames = root.querySelector<HTMLInputElement>("#source-startup-warmup")!.valueAsNumber * 60;
    const windowFrames = root.querySelector<HTMLInputElement>("#source-startup-window")!.valueAsNumber * 60;
    if (![warmupFrames, windowFrames].every(value => Number.isFinite(value) && Math.abs(value - Math.round(value)) < 1e-8) || warmupFrames < 0 || windowFrames < 1) {
      throw new Error("按60帧/秒输入：预热须为非负整数帧，每个窗口至少1帧。");
    }
    return { warmupFrames: Math.round(warmupFrames), windowFrames: Math.round(windowFrames) };
  };
  const updatePolicyHint = () => {
    const hint = root.querySelector<HTMLElement>("#source-startup-hint")!;
    try {
      const policy = readPolicy();
      const warmupSeconds = policy.warmupFrames / 60, windowSeconds = policy.windowFrames / 60;
      hint.textContent = `每条轨迹至少运行 ${warmupSeconds + 2 * windowSeconds} 秒：预热 ${warmupSeconds} 秒，随后统计两个相邻 ${windowSeconds} 秒半开窗口 [起点, 终点)。预热不重置能量、冷却、角色状态或随机流。`;
    } catch (error) { hint.textContent = error instanceof Error ? error.message : String(error); }
  };
  root.querySelector<HTMLInputElement>("#source-startup-warmup")!.oninput = updatePolicyHint;
  root.querySelector<HTMLInputElement>("#source-startup-window")!.oninput = updatePolicyHint;
  updatePolicyHint();
  const scenarioLabel: Record<SourceHostStartupScenario, string> = { zero: "零能", full: "满能", custom: "自定义" };
  const show = (runs: SourceHostStartupRun[], policy: SourceHostObservationPolicy) => {
    if (!runs.length) throw new Error("没有可分析的来源运行记录。");
    const summary = summarizeSourceHostStartupRuns(runs, policy);
    const scenarios = summary.scenarios;
    const statisticsProjection = {
      sourceCommit: summary.sourceCommit,
      wasmSha256: summary.wasmSha256,
      config: summary.config,
      executionMode: summary.executionMode,
      party: summary.party,
      durationFrames: summary.durationFrames,
      observationPolicy: summary.observationPolicy,
      seeds: summary.seeds,
      scenarios: scenarios.map(row => ({ scenario: row.scenario, summary: { randomness: row.summary.randomness, windows: row.summary.windows, pairedContrast: row.summary.pairedContrast } })),
      pairedContrasts: summary.pairedContrasts,
    };
    const pairedByWindow = [0, 1].map(windowIndex => {
      const contrast = summary.pairedContrasts.find(row => row.id === "full-minus-zero" && row.windowIndex === windowIndex);
      return { window: windowIndex + 1, count: contrast?.dps.count ?? 0, dps: contrast?.dps ?? null };
    });
    const distributionCell = (distribution: StochasticDistribution | null | undefined) => {
      if (!distribution) return "未知（无可用样本）";
      const interval = distribution.meanConfidenceInterval
        ? `[${fmt(distribution.meanConfidenceInterval.low)}, ${fmt(distribution.meanConfidenceInterval.high)}]`
        : "未估计（至少需两组）";
      return `${distribution.count}组；均值 ${fmt(distribution.mean)}；P05／P50／P95 ${fmt(distribution.spreadPercentiles.p05)}／${fmt(distribution.spreadPercentiles.p50)}／${fmt(distribution.spreadPercentiles.p95)}；均值95%区间 ${interval}`;
    };
    const windowDrift = scenarios.map(row => {
      const contrast = row.summary.pairedContrast;
      const first = row.summary.windows[0], second = row.summary.windows[1];
      const rows = contrast ? [
        `<tr><th scope="row">全队 DPS</th><td>${distributionCell(contrast.dps)}</td></tr>`,
        ...contrast.actors.flatMap(actor => [
          `<tr><th scope="row">${esc(actor.actor)} · 结束能量</th><td>${distributionCell(actor.endEnergy)}</td></tr>`,
          `<tr><th scope="row">${esc(actor.actor)} · 获得能量</th><td>${distributionCell(actor.gained)}</td></tr>`,
          `<tr><th scope="row">${esc(actor.actor)} · 消耗能量</th><td>${distributionCell(actor.spent)}</td></tr>`,
          `<tr><th scope="row">${esc(actor.actor)} · 成功 Q</th><td>${distributionCell(actor.burstAccepted)}</td></tr>`,
          `<tr><th scope="row">${esc(actor.actor)} · 拒绝 Q</th><td>${distributionCell(actor.burstRejected)}</td></tr>`,
        ]),
      ].join("") : `<tr><td colspan="2">未知（本场景没有可配对的两个窗口统计）</td></tr>`;
      return `<section data-source-startup-window-drift="${row.scenario}"><h4>${scenarioLabel[row.scenario]}：第二窗 − 第一窗</h4>
        <p>按相同种子配对；窗口为来源帧 [${first?.startFrame ?? "未知"}, ${first?.endFrame ?? "未知"}) 与 [${second?.startFrame ?? "未知"}, ${second?.endFrame ?? "未知"})。这是有限窗口间漂移诊断，不证明稳态或随机分布收敛。</p>
        <div class="table-wrap"><table><thead><tr><th scope="col">指标</th><th scope="col">配对差值分布</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
    }).join("");
    saved = runs; savedPolicy = policy; exportButton.disabled = reanalyzeButton.disabled = false;
    const randomnessText = scenarios.map(row => {
      const rng = row.summary.randomness;
      return `${scenarioLabel[row.scenario]}：${rng.sampleCount} 个不同初始化流；${esc(rng.algorithm)}（${esc(rng.seedNormalization)}）；原生回执 ${rng.nativeReceiptCount}/${rng.sampleCount}，旧记录推定 ${rng.sampleCount - rng.nativeReceiptCount} 次。`;
    }).join(" ");
    output.innerHTML = `<p data-source-startup-summary>${runs.length}次实际运行；${scenarios.map(row => `${scenarioLabel[row.scenario]}${row.runs.length}次`).join("、")}。窗口按来源帧 [起点, 终点) 统计；边界能量与Q请求来自实际来源日志。</p>
      <p data-source-startup-randomness>${randomnessText}不同初始化流只表示种子映射不同，不构成输出数学独立性的证明。</p>
      <p>失败次数按执行器实际就绪检查计数；自动等待会重复检查同一个 Q，因此它不是轮转中 Q 输入的条数。</p>
      <div class="table-wrap"><table><thead><tr><th>起步</th><th>种子</th><th>窗口</th><th>DPS</th><th>起始能量</th><th>结束能量</th><th>成功Q</th><th>Q就绪拒绝</th><th>不足能量拒绝</th></tr></thead><tbody>${scenarios.map(row => row.summary.runs.map((analysis, index) => {
        const run = row.runs[index]!;
        return analysis.windows.map((window, windowIndex) => `<tr><td>${scenarioLabel[row.scenario]}</td><td>${esc(run.result.seed)}</td><td>${windowIndex + 1}</td><td>${fmt(window.dps)}</td><td>${window.actors.map(actor => `${esc(actor.actor)} ${fmt(actor.startEnergy)}`).join("；")}</td><td>${window.actors.map(actor => `${esc(actor.actor)} ${fmt(actor.endEnergy)}`).join("；")}</td><td>${window.actors.map(actor => `${esc(actor.actor)} ${actor.burstAccepted}`).join("；")}</td><td>${window.actors.map(actor => `${esc(actor.actor)} ${fmt(actor.burstRejected)}`).join("；")}</td><td>${window.actors.map(actor => `${esc(actor.actor)} ${fmt(actor.burstInsufficientEnergy)}`).join("；")}</td></tr>`).join("");
      }).join("")).join("")}</tbody></table></div>
      <section data-source-startup-window-drift-summary><h3>各起步场景的窗间漂移</h3><p>下表直接汇总本场景每个种子的第二窗减第一窗；均值95%区间估计配对差的均值，P05／P50／P95描述有限样本分布。它不能单独证明稳态。</p>${windowDrift}</section>
      <section data-source-startup-contrast><h3>满能减零能：按相同种子配对</h3><p>差值先在每个种子内计算，再汇总；相同种子不保证随机事件逐项对应。</p>${pairedByWindow.map(item => { const d = item.dps; const ci = d?.meanConfidenceInterval; return `<p>窗口${item.window}：${item.count}组；DPS平均差 ${fmt(d?.mean ?? null)}，单次差值P05／P50／P95 ${fmt(d?.spreadPercentiles.p05)}／${fmt(d?.spreadPercentiles.p50)}／${fmt(d?.spreadPercentiles.p95)}；均值95%区间${ci ? ` [${fmt(ci.low)}, ${fmt(ci.high)}]` : "未知（至少需两组）"}。</p>`; }).join("")}${summary.pairedContrasts.map(contrast => `<details><summary>${contrast.id === "full-minus-zero" ? "满能减零能" : "自定义减零能"} · 窗口 ${contrast.windowIndex + 1} · 角色级差值</summary><div class="table-wrap"><table><thead><tr><th>角色</th><th>起始能量差均值（P05 / P50 / P95）</th><th>结束能量差均值（P05 / P50 / P95）</th><th>成功Q差均值（P05 / P50 / P95）</th><th>失败Q差均值（P05 / P50 / P95）</th></tr></thead><tbody>${contrast.actors.map(actor => {
        const cell = (distribution: typeof actor.startEnergy) => distribution ? `${fmt(distribution.mean)}（${fmt(distribution.spreadPercentiles.p05)} / ${fmt(distribution.spreadPercentiles.p50)} / ${fmt(distribution.spreadPercentiles.p95)}；均值区间${distribution.meanConfidenceInterval ? `${fmt(distribution.meanConfidenceInterval.low)} 至 ${fmt(distribution.meanConfidenceInterval.high)}` : "未估计"}）` : "未知";
        return `<tr><td>${esc(actor.actor)}</td><td>${cell(actor.startEnergy)}</td><td>${cell(actor.endEnergy)}</td><td>${cell(actor.burstAccepted)}</td><td>${cell(actor.burstRejected)}</td></tr>`;
      }).join("")}</tbody></table></div></details>`).join("")}</section>
      <details><summary>完整分窗统计</summary><pre>${esc(JSON.stringify(statisticsProjection, null, 2))}</pre></details>
      <div class="editor-actions">${runs.map((run, index) => `<button type="button" data-source-startup-open="${index}">打开${scenarioLabel[run.scenario]} · 种子 ${esc(run.result.seed)}</button>`).join("")}</div>`;
    output.querySelectorAll<HTMLButtonElement>("[data-source-startup-open]").forEach(button => { button.onclick = () => options.onOpenResult(runs[Number(button.dataset.sourceStartupOpen)]!.result); });
    status.textContent = "分析完成；每个场景的实际运行回执均可单独打开。";
  };
  runButton.onclick = () => {
    try {
      pendingPolicy = readPolicy();
      const custom = customCheck.checked ? parseCustom(customField.value) : undefined;
      const jobs = createSourceHostStartupJobs(options.getRequest(), root.querySelector<HTMLInputElement>("#source-startup-seeds")!.value, custom);
      if (jobs.some(job => job.request.initialEnergy?.mode === "custom")) status.textContent = `正在运行${jobs.length}次来源对照；自定义初始能量将由来源按实际队伍校验。`;
      else status.textContent = `正在运行${jobs.length}次来源对照…`;
      options.onRun(jobs);
    } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
  };
  reanalyzeButton.onclick = () => { try { show(saved, readPolicy()); status.textContent = "已用新窗口重新分析保存的轨迹，没有再次运行来源。"; } catch (error) { status.textContent = String(error); } };
  exportButton.onclick = () => downloadSourceHostJson({ schemaVersion: "source-host-startup-v1", observationPolicy: savedPolicy, runs: saved }, "source-host-startup.json");
  root.querySelector<HTMLInputElement>("#source-startup-import")!.onchange = event => {
    const input = event.target as HTMLInputElement, file = input.files?.[0]; if (!file) return;
    void file.text().then(text => {
      const value = JSON.parse(text) as { schemaVersion: string; observationPolicy?: SourceHostObservationPolicy; runs?: Array<SourceHostStartupRun & { result: unknown }> };
      if (value.schemaVersion !== "source-host-startup-v1" || !value.observationPolicy || !Array.isArray(value.runs) || !value.runs.length) throw new Error("不是完整的起步敏感度记录。");
      const restored = value.runs.map(run => ({ ...run, result: createSourceHostResult(run.result) }));
      show(restored, value.observationPolicy!);
      root.querySelector<HTMLInputElement>("#source-startup-seeds")!.value = [...new Set(restored.map(run => run.result.seed))].join(",");
      const custom = restored.find(run => run.scenario === "custom")?.request.initialEnergy;
      customCheck.checked = custom?.mode === "custom";
      customField.disabled = !customCheck.checked;
      customField.value = custom?.mode === "custom" ? Object.entries(custom.byActor).map(([key, energy]) => `${key}=${energy}`).join("\n") : "";
      root.querySelector<HTMLInputElement>("#source-startup-warmup")!.value = String(value.observationPolicy!.warmupFrames / 60);
      root.querySelector<HTMLInputElement>("#source-startup-window")!.value = String(value.observationPolicy!.windowFrames / 60);
      updatePolicyHint();
    }).catch(error => { status.textContent = error instanceof Error ? error.message : String(error); });
    input.value = "";
  };
  return { show: runs => show(runs, pendingPolicy), setBusy: busy => {
    runButton.disabled = busy; reanalyzeButton.disabled = busy || !saved.length;
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("#source-startup-seeds, #source-startup-include-custom, #source-startup-custom, #source-startup-warmup, #source-startup-window, #source-startup-import").forEach(field => { field.disabled = busy || field === customField && !customCheck.checked; });
    output.querySelectorAll<HTMLButtonElement>("[data-source-startup-open]").forEach(button => { button.disabled = busy; });
  } };
}
