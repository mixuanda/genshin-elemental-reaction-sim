import { assertDistinctSourceHostStreams } from "../../../packages/sim-core/src/source-host-randomness";
import { assertSourceHostTargetPhases, sourceHostTargetPhaseIdentity } from "../../../packages/sim-core/src/source-host-target-phase";
import type { SourceHostRunRequest, SourceHostResult } from "../../../packages/sim-core/src/source-host-wire";
import { createSourceHostResult } from "../../../packages/sim-core/src/source-host-capture";
import { addSourceHostRechargeContribution, summarizeSourceHostEnergyRuns, type SourceHostObservationPolicy } from "./source-host-energy-analysis";
import { downloadSourceHostJson } from "./source-host-calculator";
import type { SourceHostStartupJob } from "./source-host-startup-analysis";

export interface SourceHostBatchJob { id: string; request: SourceHostRunRequest; baseConfig: string; addedRecharge: number; actorKey: string | null }
export interface SourceHostBatchRun extends SourceHostBatchJob { result: SourceHostResult; elapsedMs: number }
export interface SourceHostWorkerRequest extends SourceHostRunRequest { jobs?: SourceHostBatchJob[]; startupJobs?: SourceHostStartupJob[]; reexecutionTarget?: SourceHostResult }
const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const format = (value: number | null) => value === null ? "未知" : value.toLocaleString("zh-CN", { maximumFractionDigits: 3 });

/** ER is an explicit extra contribution, never an assumed total panel or monotone solver. */
export function createSourceHostBatchJobs(request: SourceHostRunRequest, seedsText: string, rechargeText: string, actorKey: string): SourceHostBatchJob[] {
  const seeds = seedsText.split(/[，,\s]+/).filter(Boolean);
  if (!seeds.length || seeds.length > 32 || seeds.some(seed => !/^\d+$/.test(seed) || BigInt(seed) > 18446744073709551615n) || new Set(seeds.map(seed => BigInt(seed).toString())).size !== seeds.length) throw new Error("请填写1–32个不重复的uint64十进制种子。");
  assertDistinctSourceHostStreams(seeds);
  const values = rechargeText.trim() ? rechargeText.split(/[，,\s]+/).filter(Boolean).map(Number) : [0];
  if (!values.length || values.length > 8 || new Set(values).size !== values.length || values.some(value => !Number.isFinite(value) || value < 0 || value > 500)) throw new Error("请输入最多8个不同的额外充能百分比（0–500）。");
  if (values.some(value => value !== 0) && !actorKey.trim()) throw new Error("比较额外充能时，请填写脚本中实际声明的角色键。");
  return values.flatMap(value => seeds.map(seed => ({
    id: `${value}:${seed}`, baseConfig: request.config, actorKey: actorKey.trim() || null, addedRecharge: value / 100,
    request: { ...request, seed, config: value === 0 ? request.config : addSourceHostRechargeContribution(request.config, actorKey.trim(), value / 100) },
  })));
}

export function renderSourceHostBatchControls(root: HTMLElement, options: {
  getRequest(): SourceHostRunRequest; onRun(jobs: SourceHostBatchJob[]): void; onOpenResult(result: SourceHostResult): void;
}): { show(runs: SourceHostBatchRun[]): void; setBusy(busy: boolean): void } {
  let saved: SourceHostBatchRun[] = [];
  let pendingPolicy: SourceHostObservationPolicy | undefined;
  let savedPolicy: SourceHostObservationPolicy | undefined;
  root.innerHTML = `<details class="card"><summary>多种子与额外充能对照</summary>
    <p>每个候选都完整运行当前脚本，由真实粒子、固定回能、耗能请求和条件被动决定结果。每个种子从脚本初态开始；前后半窗保持同一条连续轨迹，不重置能量或随机流。</p>
    <div class="calculator-fields"><label>种子（逗号分隔）<input id="source-batch-seeds" value="1,2"></label><label>增加充能的角色键（单独多种子可留空）<input id="source-batch-actor" placeholder="例如 xiangling"></label><label>额外充能百分比（0表示原配装）<input id="source-batch-er" value="0"></label></div><p>种子须映射到不同的 Go 随机初始化流；数值不同也可能等价而被拒绝。不同初始化流不等于数学独立。</p>
    <div class="calculator-fields"><label>测量方式<select id="source-batch-window-mode"><option value="halves">完整轨迹前后半窗</option><option value="warmup">预热后两个相邻等长窗口</option></select></label><label>预热秒数<input id="source-batch-warmup" type="number" min="0" step="any" value="15"></label><label>每个测量窗秒数<input id="source-batch-window" type="number" min="0" step="any" value="15"></label></div>
    <p id="source-batch-window-hint"></p>
    <p>此对照增加充能属性，保留其他词条；它不声称圣遗物预算等价或配装最优。不假定充能与成功率单调，最低值只在已评估网格内报告。没有实际Q请求时，不判定可行。</p>
    <div class="editor-actions"><button id="source-batch-run">运行对照</button><button id="source-batch-reanalyze" disabled>重新分析已有轨迹</button><button id="source-batch-export" disabled>导出全部运行JSON</button><label class="file-button">导入对照<input id="source-batch-import" type="file" accept="application/json"></label></div>
    <p id="source-batch-status" role="status"></p><div id="source-batch-result"></div></details>`;
  const status = root.querySelector<HTMLElement>("#source-batch-status")!;
  const output = root.querySelector<HTMLElement>("#source-batch-result")!;
  const runButton = root.querySelector<HTMLButtonElement>("#source-batch-run")!;
  const exportButton = root.querySelector<HTMLButtonElement>("#source-batch-export")!;
  const reanalyzeButton = root.querySelector<HTMLButtonElement>("#source-batch-reanalyze")!;
  const mode = root.querySelector<HTMLSelectElement>("#source-batch-window-mode")!;
  const warmup = root.querySelector<HTMLInputElement>("#source-batch-warmup")!;
  const windowLength = root.querySelector<HTMLInputElement>("#source-batch-window")!;
  const readPolicy = (): SourceHostObservationPolicy | undefined => {
    if (mode.value === "halves") return undefined;
    const warmupFrames = warmup.valueAsNumber * 60, windowFrames = windowLength.valueAsNumber * 60;
    if (![warmupFrames, windowFrames].every(value => Number.isFinite(value) && Math.abs(value - Math.round(value)) < 1e-8) || warmupFrames < 0 || windowFrames < 1) throw new Error("按60帧/秒输入：预热须为非负整数帧，每个测量窗至少1帧。");
    return { warmupFrames: Math.round(warmupFrames), windowFrames: Math.round(windowFrames) };
  };
  const showPolicyHint = () => {
    const hint = root.querySelector<HTMLElement>("#source-batch-window-hint")!;
    warmup.disabled = windowLength.disabled = mode.value !== "warmup";
    try {
      const policy = readPolicy();
      hint.textContent = policy
        ? `当前脚本须实际运行至少 ${(policy.warmupFrames + 2 * policy.windowFrames) / 60} 秒。前 ${policy.warmupFrames / 60} 秒只作预热；随后两个 ${policy.windowFrames / 60} 秒窗口使用同一条连续轨迹。预热只排除统计，不重置能量、冷却、实体或随机流；脚本须自行安排重复动作。此分析不证明随机稳态。`
        : "分别统计实际完整轨迹的前后半窗。可在保存结果后更改测量方式，仅重新分析已有轨迹，无需再运行。";
    } catch (error) { hint.textContent = String(error); }
  };
  mode.onchange = showPolicyHint; warmup.oninput = showPolicyHint; windowLength.oninput = showPolicyHint; showPolicyHint();
  const show = (runs: SourceHostBatchRun[], policy?: SourceHostObservationPolicy) => {
    const groups = new Map<string, SourceHostBatchRun[]>();
    const baseline = runs[0]!;
    for (const run of runs) {
      assertSourceHostTargetPhases(run.request.targetPhases, run.result.targetPhases, run.result.targetScene);
      if (run.baseConfig !== baseline.baseConfig || run.actorKey !== baseline.actorKey || run.result.sourceCommit !== baseline.result.sourceCommit || run.result.executionArtifact?.wasmSha256 !== baseline.result.executionArtifact?.wasmSha256) throw new Error("对照必须共享原始脚本、角色与执行器身份。");
      if ((run.request.executionMode ?? "auto-wait") !== (baseline.request.executionMode ?? "auto-wait") || (run.result.executionMode ?? "auto-wait") !== (run.request.executionMode ?? "auto-wait")) throw new Error("对照必须共享动作执行政策，且与实际运行回执一致。");
      if ((run.request.stopAtDuration === true) !== (baseline.request.stopAtDuration === true)
        || (run.request.stopAtDuration === true) !== (run.result.observationWindow?.policy === "duration-or-native")
        || run.result.observationWindow?.policy !== baseline.result.observationWindow?.policy)
        throw new Error("对照必须共享相同的原生观察停止策略，且与实际运行回执一致。");
      if ((run.request.primaryTargetIndex ?? 0) !== (run.result.targetScene?.primaryTargetIndex ?? 0)
        || (run.request.primaryTargetIndex ?? 0) !== (baseline.request.primaryTargetIndex ?? 0)
        || JSON.stringify(run.result.targetScene) !== JSON.stringify(baseline.result.targetScene)
        || sourceHostTargetPhaseIdentity(run.result.targetPhases) !== sourceHostTargetPhaseIdentity(baseline.result.targetPhases))
        throw new Error("对照必须共享相同的统计目标索引与原生目标场景回执。");
      const expectedConfig = run.addedRecharge === 0 ? run.baseConfig : addSourceHostRechargeContribution(run.baseConfig, run.actorKey ?? "", run.addedRecharge);
      if (run.request.config !== expectedConfig) throw new Error("实际配置与声明的额外充能修改不一致。");
      if (run.result.seed !== run.request.seed || run.result.config !== run.request.config) throw new Error("对照标签与实际运行输入不匹配。");
      const key = JSON.stringify([run.actorKey, run.addedRecharge, run.result.sourceCommit, run.result.config]);
      groups.set(key, [...(groups.get(key) ?? []), run]);
    }
    const rows = [...groups.values()].map(group => {
      const summary = summarizeSourceHostEnergyRuns(group.map(run => run.result), policy);
      const selected = summary.runs.map(analysis => analysis.windows.flatMap(window => window.actors).filter(actor => !group[0]!.actorKey || actor.actor === group[0]!.actorKey));
      const accepted = selected.reduce((sum, actors) => sum + actors.reduce((n, actor) => n + actor.burstAccepted, 0), 0);
      const known = selected.every(actors => actors.length > 0 && actors.every(actor => actor.burstInsufficientEnergy !== null));
      const failures = known ? selected.reduce((sum, actors) => sum + actors.reduce((n, actor) => n + actor.burstInsufficientEnergy!, 0), 0) : null;
      const requested = known ? selected.reduce((sum, actors) => sum + actors.reduce((n, actor) => n + actor.burstAccepted + (actor.burstRejected ?? 0), 0), 0) : null;
      return { group, summary, accepted, failures, requested, feasible: known && requested! > 0 && accepted > 0 && failures === 0 };
    });
    const feasible = rows.filter(row => row.feasible).map(row => row.group[0]!.addedRecharge * 100);
    const randomnessText = rows.map(row => {
      const rng = row.summary.randomness;
      return `${esc(row.group[0]!.actorKey ?? "全队")} +${row.group[0]!.addedRecharge * 100}%：${rng.sampleCount} 个不同初始化流；${esc(rng.algorithm)}（${esc(rng.seedNormalization)}）；原生回执 ${rng.nativeReceiptCount}/${rng.sampleCount}，旧记录推定 ${rng.sampleCount - rng.nativeReceiptCount} 次。`;
    }).join(" ");
    saved = runs; savedPolicy = policy; exportButton.disabled = reanalyzeButton.disabled = false;
    output.innerHTML = `<p data-source-batch-summary>${runs.length}次实际来源运行，${rows.length}组精确配置。${feasible.length ? `已评估网格内最小无能量不足拒绝的附加充能：${Math.min(...feasible)}%。` : "已评估网格未找到满足条件的候选；不能据此断言任意ER无解。"}</p>
      <p data-source-batch-randomness>${randomnessText}不同初始化流只表示种子映射不同，不构成输出数学独立性的证明。</p>
      <p data-source-batch-window-policy>${policy ? `预热 ${policy.warmupFrames} 帧；每窗 ${policy.windowFrames} 帧。预热及两窗外的尾段不进入本次统计，完整轨迹仍可打开。` : "本次采用实际完整轨迹前后半窗。"}${rows[0]?.summary.windows.map((window, index) => `第${index + 1}窗 [${window.startFrame}, ${window.endFrame}) 来源帧，分母 ${(window.endFrame - window.startFrame) / 60} 秒。`).join(" ")}</p>
      <p>“无能量不足拒绝”仅描述所选测量窗内的实际请求；冷却、动作锁等其他拒绝仍在账本中。统计分位数描述随机分布，均值置信区间描述有限样本的均值不确定性，均不能证明稳态。</p>
      <div class="table-wrap"><table><thead><tr><th>角色／额外ER</th><th>种子数</th><th>前窗平均DPS</th><th>后窗平均DPS</th><th>实际成功Q</th><th>能量不足拒绝</th><th>本候选</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.group[0]!.actorKey ?? "全队")} +${row.group[0]!.addedRecharge * 100}%</td><td>${row.summary.seeds.length}</td><td>${format(row.summary.windows[0]!.dps.mean)}</td><td>${format(row.summary.windows[1]?.dps.mean ?? null)}</td><td>${row.accepted}</td><td>${format(row.failures)}</td><td>${row.feasible ? "观察范围内满足" : row.requested === 0 ? "没有Q请求" : "未满足或记录不足"}</td></tr>`).join("")}</tbody></table></div>
      <section data-source-batch-contrast><h4>后窗相对前窗的变化</h4><p>先对同一种子的两个窗口作差，再跨种子汇总；不把同一轨迹的两窗当成独立样本。区间包含零或方差为零都不能证明已经稳态。</p>${rows.map(row => {
        const contrast = row.summary.pairedContrast;
        if (!contrast) return "<p>此轨迹不足两个窗口，无法作配对比较。</p>";
        const interval = contrast.dps.meanConfidenceInterval;
        return `<p>${esc(row.group[0]!.actorKey ?? "全队")} +${row.group[0]!.addedRecharge * 100}%：${contrast.dps.count}组配对；平均DPS差 ${format(contrast.dps.mean)}；单次差值P05／P50／P95为 ${format(contrast.dps.spreadPercentiles.p05)}／${format(contrast.dps.spreadPercentiles.p50)}／${format(contrast.dps.spreadPercentiles.p95)}；均值差95%区间${interval ? ` [${format(interval.low)}, ${format(interval.high)}]（Student-t近似）` : "未估计（至少两个种子）"}。</p>`;
      }).join("")}<p>小样本或偏斜分布下，均值区间只作探索参考；这也没有比较零能与满能等不同起步条件。能量边界、实际Q和失败的逐种子差值见下方完整统计。</p></section>
      <details><summary>各配置的分布、配对差与均值区间</summary><pre>${esc(JSON.stringify(rows.map(row => ({ actorKey: row.group[0]!.actorKey, addedRecharge: row.group[0]!.addedRecharge, seeds: row.summary.seeds, randomness: row.summary.randomness, observationPolicy: row.summary.observationPolicy, executionMode: row.summary.executionMode, windows: row.summary.windows, pairedContrast: row.summary.pairedContrast })), null, 2))}</pre></details>
      <div class="editor-actions">${runs.map((run, index) => `<button data-source-batch-open="${index}">${esc(run.actorKey ?? "全队")} +${run.addedRecharge * 100}% · 种子${esc(run.result.seed)}</button>`).join("")}</div>`;
    output.querySelectorAll<HTMLButtonElement>("[data-source-batch-open]").forEach(button => { button.onclick = () => options.onOpenResult(runs[Number(button.dataset.sourceBatchOpen)]!.result); });
    status.textContent = "全部运行已记录；可以打开任一结果查看实际能量与逐击公式。";
  };
  runButton.onclick = () => {
    try {
      pendingPolicy = readPolicy();
      const jobs = createSourceHostBatchJobs(options.getRequest(), root.querySelector<HTMLInputElement>("#source-batch-seeds")!.value, root.querySelector<HTMLInputElement>("#source-batch-er")!.value, root.querySelector<HTMLInputElement>("#source-batch-actor")!.value);
      status.textContent = `正在执行${jobs.length}次对照；取消按钮会终止当前来源运行。`; options.onRun(jobs);
    } catch (error) { status.textContent = String(error); }
  };
  reanalyzeButton.onclick = () => {
    try { show(saved, readPolicy()); status.textContent = "已用新窗口重新分析保存的连续轨迹，没有再次运行模拟。"; }
    catch (error) { status.textContent = String(error); }
  };
  exportButton.onclick = () => downloadSourceHostJson({ schemaVersion: savedPolicy ? "source-host-batch-v2" : "source-host-batch-v1", ...(savedPolicy ? { observationPolicy: savedPolicy } : {}), runs: saved }, "source-host-batch.json");
  root.querySelector<HTMLInputElement>("#source-batch-import")!.onchange = event => {
    const input = event.target as HTMLInputElement, file = input.files?.[0]; if (!file) return;
    void file.text().then(text => {
      const value = JSON.parse(text) as { schemaVersion: string; runs: SourceHostBatchRun[]; observationPolicy?: SourceHostObservationPolicy };
      if (!["source-host-batch-v1", "source-host-batch-v2"].includes(value.schemaVersion) || !Array.isArray(value.runs) || !value.runs.length) throw new Error("不是完整来源对照记录。");
      if (value.schemaVersion === "source-host-batch-v2" && (!value.observationPolicy || typeof value.observationPolicy !== "object")) throw new Error("预热测量记录缺少窗口政策。");
      const policy = value.schemaVersion === "source-host-batch-v2" ? value.observationPolicy : undefined;
      show(value.runs.map(run => ({ ...run, result: createSourceHostResult(run.result) })), policy);
      mode.value = policy ? "warmup" : "halves";
      if (policy) { warmup.value = String(policy.warmupFrames / 60); windowLength.value = String(policy.windowFrames / 60); }
      showPolicyHint();
    }).catch(error => { status.textContent = String(error); }); input.value = "";
  };
  return { show: runs => show(runs, pendingPolicy), setBusy: busy => {
    runButton.disabled = busy; reanalyzeButton.disabled = busy || !saved.length;
    mode.disabled = busy;
    warmup.disabled = windowLength.disabled = busy || mode.value !== "warmup";
    root.querySelector<HTMLInputElement>("#source-batch-import")!.disabled = busy;
    output.querySelectorAll<HTMLButtonElement>("[data-source-batch-open]").forEach(button => { button.disabled = busy; });
  } };
}
