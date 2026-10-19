import type { SimulationResult } from "@genshin-dps-lab/schemas";
import { evaluateSimulationSteadyState, measureDamageWindow, summarizeRotationExecution, type DamageWindow, type ErSearchResult, type SimulationStartupResult } from "../../../packages/sim-core/src/simulation-analysis";
import { renderStartupLedger } from "./startup-ledger";
import type { StochasticStartupResult } from "../../../packages/sim-core/src/stochastic-startup";
import { renderStochasticStartup } from "./stochastic-startup-view";
import { renderWeaponProcLedger } from "./weapon-proc-ledger";
import { renderThrillingTalesLedger } from "./thrilling-tales-ledger";
import { renderSacrificialLedger } from "./sacrificial-ledger";
import { renderArtifactEventLedger } from "./artifact-event-ledger";
import { renderArtifactDamageLedger } from "./artifact-damage-panel";
import { renderArtifactBuffLedger } from "./artifact-buff-panel";
import { renderPlayerShieldLedger } from "./player-shield-panel";

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const num = (value: number): string => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 3 }).format(value);
let pendingSearch: Worker | null = null;

const randomStreamLabels = {
  particleCount: "粒子数量",
  particleTrigger: "命中产球判定",
  critical: "伤害暴击",
  normalHitEnergy: "普通攻击回能",
  favonius: "西风触发",
  sacrificial: "祭礼触发",
  weaponProc: "独立武器追击",
} as const;
const objectRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

/** Read the captured boundary values; viewing a checkpoint never advances a stream. */
export function renderRandomCheckpointOverview(root: HTMLElement, result: SimulationResult): void {
  const checkpoints = result.executionAudit?.phaseCheckpoints ?? [];
  root.innerHTML = `<p>检查点保存该帧所有事件执行前的状态。抽样次数为本次运行截至该边界的累计次数，不随测量窗口重置。状态捕获不等于随机稳态证明。</p>${checkpoints.length
    ? `<label>检查点边界<select data-random-checkpoint-select>${checkpoints.map((checkpoint, index) => `<option value="${index}">${esc(checkpoint.tick)} 帧</option>`).join("")}</select></label><div data-random-checkpoint-output></div>`
    : '<p data-random-checkpoint-empty>本次结果没有记录检查点边界。</p>'}`;
  if (checkpoints.length === 0) return;
  const select = root.querySelector<HTMLSelectElement>("[data-random-checkpoint-select]")!;
  const output = root.querySelector<HTMLElement>("[data-random-checkpoint-output]")!;
  const draw = (): void => {
    const checkpoint = checkpoints[Number(select.value)]!;
    const history = objectRecord(checkpoint.state.icdAndTriggerHistory);
    const randomExecution = objectRecord(history?.randomExecution);
    const streams = randomExecution?.version === "named-rng-state-v1" ? objectRecord(randomExecution.streams) : undefined;
    if (!streams) {
      output.innerHTML = `<p data-random-checkpoint-empty>${esc(checkpoint.tick)} 帧边界未记录可展示的随机流状态；缺少记录不表示抽样次数为零。</p>`;
      return;
    }
    const rows = Object.entries(randomStreamLabels).filter(([name]) => streams[name] !== undefined).map(([name, label]) => {
      const state = objectRecord(streams[name]);
      const count = state?.drawCount;
      const countText = typeof count === "number" && Number.isSafeInteger(count) && count >= 0 ? num(count) : "未记录有效次数";
      return `<tr data-random-stream="${name}"><td>${label}</td><td data-random-draw-count>${countText}</td></tr>`;
    }).join("");
    output.innerHTML = rows
      ? `<div class="table-wrap"><table><caption>${esc(checkpoint.tick)} 帧事件执行前</caption><thead><tr><th scope="col">随机流</th><th scope="col">累计抽样次数</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : '<p data-random-checkpoint-empty>此边界没有记录命名随机流。</p>';
  };
  select.addEventListener("change", draw);
  draw();
}

/** The analysis always refers to one saved result, including its runtime options. */
export function renderAnalysisPanel(root: HTMLElement, result: SimulationResult): void {
  pendingSearch?.terminate();
  pendingSearch = null;
  let window: DamageWindow | null = null;
  let erResult: ErSearchResult | null = null;
  let startupResult: SimulationStartupResult | null = null;
  let stochasticResult: StochasticStartupResult | null = null;
  let rotationSummary = summarizeRotationExecution(result);
  const maximumStochasticWarmup = Math.floor((600 - result.config.duration) / (2 * result.config.cycleLength));
  const steady = evaluateSimulationSteadyState(result);
  const durationTicks = Math.round(result.config.duration * 60);
  root.innerHTML = `<div class="workspace-stack">
    <article class="card"><h2>测量窗口</h2><p>按已完成的模拟结果取半开区间 [开始帧, 结束帧)。保留区间内空闲时间；终点帧伤害不计入。改变窗口不会重置能量、冷却或实体。</p>
      <div class="workspace-fields"><label>窗口类型<select id="analysis-window-preset"><option value="full">完整观察窗口</option><option value="cycle">首个配置周期</option><option value="15">开场 15 秒</option><option value="18">开场 18 秒</option><option value="20">开场 20 秒</option><option value="custom">自定义整帧窗口</option></select></label>
      <label>开始帧<input id="analysis-start" type="number" min="0" max="${durationTicks - 1}" step="1" value="0"></label>
      <label>结束帧（不含）<input id="analysis-end" type="number" min="1" max="${durationTicks}" step="1" value="${durationTicks}"></label>
      <label>主目标<select id="analysis-target">${result.enemyTargets.map((target) => `<option value="${esc(target.id)}">${esc(target.name)}</option>`).join("")}</select></label></div>
      <div id="analysis-window-output" role="status"></div><p class="muted">首个配置周期采用 cycleLength，并不把失败、延迟或尚未完成的指令称为完整可执行轮转。</p><div id="analysis-rotation-output"></div><section id="analysis-weapon-proc-ledger"></section><section id="analysis-thrilling-tales-ledger"></section><section id="analysis-sacrificial-ledger"></section><section id="analysis-artifact-event-ledger"></section><section id="analysis-artifact-damage-ledger"></section><section id="analysis-player-shield-ledger"></section><section id="analysis-artifact-buff-ledger"></section>
    </article>
    <article class="card"><h2>稳态检查与预热</h2><div id="analysis-steady-output" role="status"><p>${steady.status === "not-established" ? "未建立稳态" : `已建立 ${steady.periodCycles} 周期重复，稳态 DPS ${num(steady.steadyStateDps!)}`}</p><p>${steady.reasons.map(esc).join("；")}</p></div><p>可以在一次连续运行中先执行预热，再测量当前时长的观察窗口。预热行动和所有状态会延续进入窗口，不会只补满能量。总模拟上限 600 秒。</p><div class="workspace-fields"><label>预热周期数<input id="analysis-warmup-cycles" type="number" min="1" step="1" value="${Math.max(1, Math.min(20, Math.floor((600 - result.config.duration) / result.config.cycleLength)))}"></label><label>预热起始能量<select id="analysis-warmup-energy"><option value="zero">零能量</option><option value="full">满能量</option><option value="configured">按角色配置</option></select></label></div><button id="analysis-steady-run">连续预热并检查稳态</button><button id="analysis-steady-cancel" hidden>取消预热</button><div id="analysis-startup-output" role="status" aria-live="polite"></div></article>
    <article class="card"><h2>随机检查点</h2><section id="analysis-random-checkpoints"></section></article>
    <article class="card"><h2>随机预热与起步敏感性</h2><p>对每组种子分别从零能量与满能量连续运行，在 W 和 2W 预热后取相同时长窗口。保留所有实际状态，不把随机状态要求为逐周期相同；比较伤害、能量和行动拒绝的配对差值。</p><div class="workspace-fields"><label>独立种子组数<input id="analysis-stochastic-samples" type="number" min="2" max="32" step="1" value="8" required></label><label>W 预热周期数<input id="analysis-stochastic-cycles" type="number" min="1" max="${Math.max(1, maximumStochasticWarmup)}" step="1" value="${Math.max(1, Math.min(5, maximumStochasticWarmup))}" required></label></div><p>默认8组，共16次连续运行；每次 2W 加当前 ${num(result.config.duration)} 秒观察窗口不得超过600秒。沿用本次运行的种子基础、暴击与回能政策；结果为有限样本诊断，不自动认证随机稳态。</p>${maximumStochasticWarmup < 1 ? '<p class="calculator-error">当前观察时长与周期无法容纳至少一个W预热；请缩短原情景的观察时长后重新模拟。</p>' : ""}<button id="analysis-stochastic-run"${maximumStochasticWarmup < 1 ? " disabled" : ""}>运行随机预热诊断</button><button id="analysis-stochastic-cancel" hidden>取消诊断</button><div id="analysis-stochastic-output" role="status" aria-live="polite"></div></article>
    <article class="card"><h2>充能需求求解</h2><p>固定本次配装、动作、${esc(result.resolvedRuntimeOptions.energyMode)} 起步方式与种子；逐个检查有限充能网格，返回每个失败原因。不会用更高充能必然更好的假设跳过候选。</p>
      <div class="workspace-fields"><label>角色<select id="analysis-er-actor">${result.config.characters.map((actor) => `<option value="${esc(actor.id)}">${esc(actor.name)}</option>`).join("")}</select></label>
      <label>最低充能（%）<input id="analysis-er-min" type="number" min="0" step="1" value="100"></label><label>最高充能（%）<input id="analysis-er-max" type="number" min="0" step="1" value="300"></label>
      <label>步长（百分点）<input id="analysis-er-step" type="number" min="0.1" step="0.1" value="10"></label><label>安全裕量（百分点）<input id="analysis-er-margin" type="number" min="0" step="1" value="0"></label></div>
      <div class="editor-actions"><button id="analysis-er-run">计算充能需求</button><button id="analysis-er-cancel" hidden>取消求解</button></div><div id="analysis-er-output" role="status" aria-live="polite"></div>
    </article><div><button id="analysis-export">导出本次分析</button></div>
  </div>`;
  renderRandomCheckpointOverview(root.querySelector<HTMLElement>("#analysis-random-checkpoints")!, result);
  const input = (id: string): HTMLInputElement => root.querySelector<HTMLInputElement>(`#${id}`)!;
  const select = (id: string): HTMLSelectElement => root.querySelector<HTMLSelectElement>(`#${id}`)!;
  const drawWindow = (): void => {
    const output = root.querySelector<HTMLElement>("#analysis-window-output")!;
    try {
      window = measureDamageWindow(result, Number(input("analysis-start").value), Number(input("analysis-end").value), select("analysis-target").value);
      output.innerHTML = `<div class="table-wrap"><table><thead><tr><th>区间</th><th>时长</th><th>全部目标伤害</th><th>窗口 DPS</th><th>主目标伤害</th><th>主目标 DPS</th></tr></thead><tbody><tr><td>[${window.startTick}, ${window.endTick})f</td><td>${num(window.durationSeconds)} 秒</td><td>${num(window.totalDamage)}</td><td>${num(window.dps)}</td><td>${num(window.primaryTargetDamage)}</td><td>${num(window.primaryTargetDps)}</td></tr></tbody></table></div>`;
      rotationSummary = summarizeRotationExecution(result, select("analysis-target").value);
      const inputExecution = rotationSummary.inputExecution, tail = rotationSummary.tailAttribution, complete = rotationSummary.completeRotation;
      const actualWindow = inputExecution.measurement;
      root.querySelector<HTMLElement>("#analysis-rotation-output")!.innerHTML = `<h3>输入执行与尾段归属</h3><p>配置周期 ${num(rotationSummary.requestedCycle.seconds)} 秒；完整观察 ${num(rotationSummary.observation.durationSeconds)} 秒。实际声明输入${inputExecution.executableSeconds === null ? "尚无完整可执行时长" : `为 ${num(inputExecution.executableSeconds)} 秒`}，${inputExecution.occupiedEndTick === null ? "缺少占用边界" : `占用完成边界 ${inputExecution.occupiedEndTick}f`}。</p><p>输入：${inputExecution.status === "complete" ? "已完整执行" : inputExecution.status === "partial" ? "执行不完整" : "未提供合法执行边界"}；尾段：${tail.status === "complete" ? "已核对闭合" : tail.status === "partial" ? "被观察窗口或机制边界截断" : "完整性未证实"}。</p><p>${[...inputExecution.reasons, ...tail.reasons].map(esc).join("；")}</p>${actualWindow ? `<p>实际输入窗口 [0, ${actualWindow.endTick})f（含空闲）：全目标 ${num(actualWindow.totalDamage)}，DPS ${num(actualWindow.dps)}；主目标 ${num(actualWindow.primaryTargetDamage)}，DPS ${num(actualWindow.primaryTargetDps)}。</p>` : ""}${complete ? `<p>输入与来源尾段均完整：闭合窗口 [${complete.startTick}, ${complete.endTick})f，共 ${num(complete.durationSeconds)} 秒（输入占用 ${num(complete.inputDurationSeconds)} 秒，其后等待也计入分母）。全目标总伤 ${num(complete.totalDamage)}，完整窗口 DPS ${num(complete.dps)}；主目标总伤 ${num(complete.primaryTargetDamage)}，完整窗口 DPS ${num(complete.primaryTargetDps)}。此窗口未认证为可重复稳态。</p>` : '<p>未给出“完整轮转伤害 / DPS”；仍可使用上方明确时间区间内的实测窗口值。</p>'}<details><summary>来源归属与计算边界</summary><ul>${rotationSummary.limitations.map(reason => `<li>${esc(reason)}</li>`).join("")}</ul><div class="table-wrap"><table><thead><tr><th>来源行动</th><th>来源身份</th><th>实际起手</th><th>声明尾段上界</th><th>已观察总伤</th><th>主目标</th><th>输入结束后伤害</th></tr></thead><tbody>${tail.sources.map(source => `<tr><td>${esc(source.actorId)} · ${esc(source.actionId)}</td><td>${source.timelineCommandIndex === null ? `引擎轮次 ${source.engineCycle}` : `指令 ${source.timelineCommandIndex}；引擎轮次 ${source.engineCycle}`}</td><td>${source.startTick}f</td><td>${source.declaredTailEndTick === null ? "未知" : `${source.declaredTailEndTick}f`}</td><td>${num(source.observedDamage)}</td><td>${num(source.primaryTargetDamage)}</td><td>${num(source.damageAfterInputEnd)}</td></tr>`).join("")}</tbody></table></div></details>`;
      renderWeaponProcLedger(root.querySelector<HTMLElement>("#analysis-weapon-proc-ledger")!, result, window);
      renderThrillingTalesLedger(root.querySelector<HTMLElement>("#analysis-thrilling-tales-ledger")!, result, window);
      renderSacrificialLedger(root.querySelector<HTMLElement>("#analysis-sacrificial-ledger")!, result, window);
      renderArtifactEventLedger(root.querySelector<HTMLElement>("#analysis-artifact-event-ledger")!, result, window);
      renderArtifactDamageLedger(root.querySelector<HTMLElement>("#analysis-artifact-damage-ledger")!, result, window);
      renderPlayerShieldLedger(root.querySelector<HTMLElement>("#analysis-player-shield-ledger")!, result, window);
      renderArtifactBuffLedger(root.querySelector<HTMLElement>("#analysis-artifact-buff-ledger")!, result, window);
    } catch (error) { window = null; output.textContent = error instanceof Error ? error.message : String(error); root.querySelector("#analysis-weapon-proc-ledger")!.replaceChildren(); root.querySelector("#analysis-thrilling-tales-ledger")!.replaceChildren(); root.querySelector("#analysis-sacrificial-ledger")!.replaceChildren(); root.querySelector("#analysis-artifact-event-ledger")!.replaceChildren(); root.querySelector("#analysis-artifact-damage-ledger")!.replaceChildren(); root.querySelector("#analysis-player-shield-ledger")!.replaceChildren(); }
  };
  select("analysis-window-preset").addEventListener("change", () => {
    const preset = select("analysis-window-preset").value;
    if (preset === "custom") return;
    input("analysis-start").value = "0";
    const ticks = preset === "full" ? durationTicks : Math.round((preset === "cycle" ? result.config.cycleLength : Number(preset)) * 60);
    input("analysis-end").value = String(ticks);
    drawWindow();
  });
  for (const id of ["analysis-start", "analysis-end"]) input(id).addEventListener("input", () => { select("analysis-window-preset").value = "custom"; drawWindow(); });
  select("analysis-target").addEventListener("change", drawWindow);
  const run = root.querySelector<HTMLButtonElement>("#analysis-er-run")!;
  const cancel = root.querySelector<HTMLButtonElement>("#analysis-er-cancel")!;
  const steadyRun = root.querySelector<HTMLButtonElement>("#analysis-steady-run")!;
  const steadyCancel = root.querySelector<HTMLButtonElement>("#analysis-steady-cancel")!;
  const stochasticRun = root.querySelector<HTMLButtonElement>("#analysis-stochastic-run")!;
  const stochasticCancel = root.querySelector<HTMLButtonElement>("#analysis-stochastic-cancel")!;
  const stochasticOutput = root.querySelector<HTMLElement>("#analysis-stochastic-output")!;
  const startupOutput = root.querySelector<HTMLElement>("#analysis-startup-output")!;
  const output = root.querySelector<HTMLElement>("#analysis-er-output")!;
  const finish = (): void => { pendingSearch?.terminate(); pendingSearch = null; run.disabled = false; steadyRun.disabled = false; stochasticRun.disabled = maximumStochasticWarmup < 1; cancel.hidden = true; steadyCancel.hidden = true; stochasticCancel.hidden = true; };
  cancel.addEventListener("click", () => { finish(); output.textContent = "已取消求解；未把部分候选声明为最小充能。"; });
  run.addEventListener("click", () => {
    erResult = null;
    const values = ["analysis-er-min", "analysis-er-max", "analysis-er-step", "analysis-er-margin"].map((id) => Number(input(id).value) / 100);
    pendingSearch = new Worker(new URL("./analysis-worker.ts", import.meta.url), { type: "module" });
    run.disabled = true; steadyRun.disabled = true; stochasticRun.disabled = true; cancel.hidden = false;
    output.textContent = "正在独立工作线程中求解，可随时取消…";
    pendingSearch.onmessage = (event: MessageEvent<{ type: "error"; message: string } | { type: "result"; result: ErSearchResult } | { type: "progress"; completed: number; total: number }>) => {
      if (event.data.type === "progress") { output.textContent = `已验证 ${event.data.completed} / ${event.data.total} 个充能候选…`; return; }
      finish();
      if (event.data.type === "error") { output.textContent = event.data.message; return; }
      erResult = event.data.result;
      const labels: Record<ErSearchResult["status"], string> = { "feasible-on-grid": "找到网格内可行充能", "infeasible-within-bounds": "搜索范围内无解", "er-independent-failure": "充能无法解决当前失败", blocked: "情景不满足求解条件" };
      const proof = erResult.independentFailureProof;
      const proofMarkup = proof ? `<section data-er-independent-proof><h3>充能无法解决的依据</h3><p>指令 ${proof.commandIndex + 1} · 角色 ${esc(proof.actorId)}</p><p>公式：<code>${esc(proof.formula)}</code></p><dl>${Object.entries(proof.variables).map(([name, meaning]) => `<dt><code>${esc(name)}</code></dt><dd>${esc(meaning)}</dd>`).join("")}</dl><p>代入：<code>${esc(proof.substitution)}</code></p><p>${esc(proof.explanation)}</p>${proof.assumptions.length ? `<p>前提：${proof.assumptions.map(esc).join("；")}</p>` : ""}</section>` : "";
      output.innerHTML = `<p>${labels[erResult.status]}${erResult.minimumFeasibleEr === null ? "" : `：${num(erResult.minimumFeasibleEr * 100)}%`}${erResult.recommendedEr === null ? "" : `；含裕量并验证的值 ${num(erResult.recommendedEr * 100)}%`}。</p><p>${erResult.reasons.map(esc).join("；")}</p><p>${erResult.limitations.map(esc).join("；")}</p>${proofMarkup}<details><summary>查看 ${erResult.evaluated.length} 个实际候选</summary><div class="table-wrap"><table><thead><tr><th>充能</th><th>可行</th><th>失败指令</th><th>原因</th></tr></thead><tbody>${erResult.evaluated.map((candidate) => `<tr><td>${num(candidate.energyRecharge * 100)}%</td><td>${candidate.feasible ? "是" : "否"}</td><td>${candidate.failedCommandIndices.join(", ") || "—"}</td><td>${candidate.failureCodes.map(esc).join("；") || "—"}</td></tr>`).join("")}</tbody></table></div></details>`;
    };
    pendingSearch.onerror = (event) => { finish(); output.textContent = `求解未完成：${event.message}`; };
    pendingSearch.postMessage({ kind: "energy", config: result.config, options: { actorId: select("analysis-er-actor").value, minimumEr: values[0], maximumEr: values[1], step: values[2], safetyMargin: values[3], runtimeOptions: result.resolvedRuntimeOptions } });
  });
  steadyCancel.addEventListener("click", () => { finish(); startupOutput.textContent = "已取消预热；未宣称建立稳态。"; });
  steadyRun.addEventListener("click", () => {
    startupResult = null;
    pendingSearch = new Worker(new URL("./analysis-worker.ts", import.meta.url), { type: "module" });
    steadyRun.disabled = true; run.disabled = true; stochasticRun.disabled = true; steadyCancel.hidden = false;
    startupOutput.textContent = "正在连续执行预热与观察窗口…";
    pendingSearch.onmessage = (event: MessageEvent<{ type: "startup"; result: SimulationStartupResult } | { type: "error"; message: string }>) => {
      finish();
      if (event.data.type === "error") { startupOutput.textContent = event.data.message; return; }
      startupResult = event.data.result;
      const measured = startupResult.measurement;
      const established = startupResult.status === "steady-state-established";
      startupOutput.innerHTML = `<p>${established ? "已从完整模拟检查点建立稳态" : startupResult.status === "blocked" ? "当前情景不能执行此次预热" : "预热完成，未建立稳态"}。</p><p>${startupResult.reasons.map(esc).join("；")}</p>${measured ? `<p>观察区间 [${measured.startTick}, ${measured.endTick})f，${num(measured.durationSeconds)} 秒；伤害 ${num(measured.totalDamage)}，${established ? "稳态窗口" : "预热后窗口"} DPS ${num(measured.dps)}。</p>` : ""}<p>预热 ${num(startupResult.startup.warmupTicks / 60)} 秒，实际启动行动 ${startupResult.startup.startupActionCount} 次。</p><div data-startup-ledger aria-live="off"></div>`;
      renderStartupLedger(startupOutput.querySelector<HTMLElement>("[data-startup-ledger]")!, startupResult);
      if (startupResult.result) {
        const randomHeading = document.createElement("h3");
        randomHeading.textContent = "预热运行的随机检查点";
        const randomHost = document.createElement("section");
        randomHost.dataset.startupRandomCheckpoints = "";
        startupOutput.append(randomHeading, randomHost);
        renderRandomCheckpointOverview(randomHost, startupResult.result);
        const procHost = document.createElement("section");
        procHost.dataset.startupWeaponProcLedger = "";
        startupOutput.append(procHost);
        renderWeaponProcLedger(procHost, startupResult.result, { startTick: 0, endTick: startupResult.startup.measurementStartTick });
        const talesHost = document.createElement("section");
        talesHost.dataset.startupThrillingTalesLedger = "";
        startupOutput.append(talesHost);
        renderThrillingTalesLedger(talesHost, startupResult.result, { startTick: 0, endTick: startupResult.startup.measurementStartTick });
        const sacrificialHost = document.createElement("section");
        sacrificialHost.dataset.startupSacrificialLedger = "";
        startupOutput.append(sacrificialHost);
        renderSacrificialLedger(sacrificialHost, startupResult.result, { startTick: 0, endTick: startupResult.startup.measurementStartTick });
        const artifactHost = document.createElement("section");
        artifactHost.dataset.startupArtifactEventLedger = "";
        startupOutput.append(artifactHost);
        renderArtifactEventLedger(artifactHost, startupResult.result, { startTick: 0, endTick: startupResult.startup.measurementStartTick });
        const artifactDamageHost = document.createElement("section");
        artifactDamageHost.dataset.startupArtifactDamageLedger = "";
        startupOutput.append(artifactDamageHost);
        renderArtifactDamageLedger(artifactDamageHost, startupResult.result, { startTick: 0, endTick: startupResult.startup.measurementStartTick });
        const playerShieldHost = document.createElement("section");
        playerShieldHost.dataset.startupPlayerShieldLedger = "";
        startupOutput.append(playerShieldHost);
        renderPlayerShieldLedger(playerShieldHost, startupResult.result, { startTick: 0, endTick: startupResult.startup.measurementStartTick });
        const artifactBuffHost = document.createElement("section");
        artifactBuffHost.dataset.startupArtifactBuffLedger = "";
        startupOutput.append(artifactBuffHost);
        renderArtifactBuffLedger(artifactBuffHost, startupResult.result, { startTick: 0, endTick: startupResult.startup.measurementStartTick });
        if (measured) {
          const measuredProcHost = document.createElement("section");
          measuredProcHost.dataset.measurementWeaponProcLedger = "";
          startupOutput.append(measuredProcHost);
          renderWeaponProcLedger(measuredProcHost, startupResult.result, measured);
          const measuredTalesHost = document.createElement("section");
          measuredTalesHost.dataset.measurementThrillingTalesLedger = "";
          startupOutput.append(measuredTalesHost);
          renderThrillingTalesLedger(measuredTalesHost, startupResult.result, measured);
          const measuredSacrificialHost = document.createElement("section");
          measuredSacrificialHost.dataset.measurementSacrificialLedger = "";
          startupOutput.append(measuredSacrificialHost);
          renderSacrificialLedger(measuredSacrificialHost, startupResult.result, measured);
          const measuredArtifactHost = document.createElement("section");
          measuredArtifactHost.dataset.measurementArtifactEventLedger = "";
          startupOutput.append(measuredArtifactHost);
          renderArtifactEventLedger(measuredArtifactHost, startupResult.result, measured);
          const measuredArtifactDamageHost = document.createElement("section");
          measuredArtifactDamageHost.dataset.measurementArtifactDamageLedger = "";
          startupOutput.append(measuredArtifactDamageHost);
          renderArtifactDamageLedger(measuredArtifactDamageHost, startupResult.result, measured);
          const measuredPlayerShieldHost = document.createElement("section");
          measuredPlayerShieldHost.dataset.measurementPlayerShieldLedger = "";
          startupOutput.append(measuredPlayerShieldHost);
          renderPlayerShieldLedger(measuredPlayerShieldHost, startupResult.result, measured);
          const measuredArtifactBuffHost = document.createElement("section");
          measuredArtifactBuffHost.dataset.measurementArtifactBuffLedger = "";
          startupOutput.append(measuredArtifactBuffHost);
          renderArtifactBuffLedger(measuredArtifactBuffHost, startupResult.result, measured);
        }
      }
    };
    pendingSearch.onerror = (event) => { finish(); startupOutput.textContent = `预热未完成：${event.message}`; };
    pendingSearch.postMessage({ kind: "steady", config: result.config, options: result.resolvedRuntimeOptions, warmupCycles: Number(input("analysis-warmup-cycles").value), warmupEnergyMode: select("analysis-warmup-energy").value });
  });
  root.querySelector("#analysis-export")!.addEventListener("click", () => {
    const report = { kind: "simulation-analysis-v1", reproducibilityKey: result.reproducibilityKey, dataVersion: result.dataVersion, engineVersion: result.engineVersion, config: result.config, runtimeOptions: result.resolvedRuntimeOptions, window, rotationSummary, steady, startup: startupResult, energyRecharge: erResult, stochasticStartup: stochasticResult };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "simulation-analysis.json"; link.click(); URL.revokeObjectURL(url);
  });
  stochasticCancel.addEventListener("click", () => {
    finish(); stochasticResult = null;
    stochasticOutput.textContent = "已取消随机预热诊断；部分运行不会作为完整统计结果导出。";
  });
  stochasticRun.addEventListener("click", () => {
    const sampleInput = input("analysis-stochastic-samples"), warmupInput = input("analysis-stochastic-cycles");
    if (!sampleInput.reportValidity() || !warmupInput.reportValidity()) return;
    stochasticResult = null;
    pendingSearch = new Worker(new URL("./analysis-worker.ts", import.meta.url), { type: "module" });
    run.disabled = true; steadyRun.disabled = true; stochasticRun.disabled = true; stochasticCancel.hidden = false;
    stochasticOutput.textContent = "正在连续执行零／满能量起步的配对样本…";
    pendingSearch.onmessage = (event: MessageEvent<{ type: "stochastic"; result: StochasticStartupResult } | { type: "progress"; completed: number; total: number } | { type: "error"; message: string }>) => {
      if (event.data.type === "progress") { stochasticOutput.textContent = `已完成 ${event.data.completed} / ${event.data.total} 次连续运行…`; return; }
      finish();
      if (event.data.type === "error") { stochasticOutput.textContent = `诊断未完成：${event.data.message}`; return; }
      stochasticResult = event.data.result;
      renderStochasticStartup(stochasticOutput, stochasticResult);
    };
    pendingSearch.onerror = event => { finish(); stochasticOutput.textContent = `诊断未完成：${event.message}`; };
    pendingSearch.postMessage({ kind: "stochastic", config: result.config, options: result.resolvedRuntimeOptions,
      policy: { sampleCount: sampleInput.valueAsNumber, warmupCycles: warmupInput.valueAsNumber } });
  });
  drawWindow();
}
