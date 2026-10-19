import { renderSourceHostTargetSummaryPanel } from "./source-host-target-summary-panel";
import { renderSourceHostResultOverview } from "./source-host-result-overview";
import { renderSourceHostTargetPhasePanel } from "./source-host-target-phase-panel";
import { normalizeSourceHostTargetPhases, sourceHostTargetPhaseRequestSchema } from "../../../packages/sim-core/src/source-host-target-phase";
import phaseDeterministicExampleConfig from "../../../packages/source-host/phase-deterministic-example.gcsl?raw";
import phaseExampleConfig from "../../../packages/source-host/phase-example.gcsl?raw";
import { renderSourceHostPhasePanel } from "./source-host-phase-panel";
import { sourceHostPhaseObservationRequestSchema, type SourceHostPhaseObservationRequest } from "../../../packages/sim-core/src/source-host-phase-analysis";
import type { SourceHostVariant, SourceTeamDraft, SourceTeamMember, SourceTeamInventory } from "./source-team-builder";
import exampleConfig from "../../../packages/source-host/example.gcsl?raw";
import stellarExampleConfig from "../../../packages/source-host/stellar-overlay/example.gcsl?raw";
import stellarConductExampleConfig from "../../../packages/source-host/stellar-overlay/conduct-example.gcsl?raw";
import lunarExampleConfig from "../../../packages/source-host/lunar-example.gcsl?raw";
import { SOURCE_HOST_PROTOCOL, type SourceHostResult, type SourceHostExecutionMode } from "../../../packages/sim-core/src/source-host-wire";
import { SOURCE_HOST_RNG_ALGORITHM, SOURCE_HOST_SEED_NORMALIZATION } from "../../../packages/sim-core/src/source-host-randomness";
import { captureSourceHostHit, createSourceHostResult, replaySourceHostHit, type SourceHostHitCapture } from "../../../packages/sim-core/src/source-host-capture";
import { sourceHostReexecutionRequest, type SourceHostReexecutionReceipt } from "../../../packages/sim-core/src/source-host-reexecution";
import { captureSourceHostPlayerIncoming, replaySourceHostPlayerIncoming, type SourceHostPlayerIncomingCapture } from "../../../packages/sim-core/src/source-host-incoming-capture";
import type { SourceHostEnergyCapture } from "../../../packages/sim-core/src/source-host-energy-capture";
import { downloadSourceHostJson } from "./source-host-calculator";
import { renderTraceHtml } from "./calculator-trace-view";
import { renderSourceHostInventory } from "./source-host-inventory";
import { renderSourceHostEnergyPanel } from "./source-host-energy-panel";
import { renderSourceHostHelperFormulaPanel } from "./source-host-helper-formula-panel";
import type { SourceHostCooldownCapture } from "../../../packages/sim-core/src/source-host-cooldown-capture";
import type { SourceHostHealingCapture } from "../../../packages/sim-core/src/source-host-healing-capture";
import type { SourceHostCharacterShieldCapture } from "../../../packages/sim-core/src/source-host-character-shield-capture";
import { captureSourceHostDrain, replaySourceHostDrain, type SourceHostDrainCapture } from "../../../packages/sim-core/src/source-host-drain-capture";
import { renderSourceHostBatchControls, type SourceHostBatchRun, type SourceHostWorkerRequest } from "./source-host-batch";
import { renderSourceHostStartupControls } from "./source-host-startup-panel";
import type { SourceHostStartupRun } from "./source-host-startup-analysis";
import { renderSourceHostOriginPanel } from "./source-host-origin-panel";
import type { SourceHostActionCollection } from "../../../packages/sim-core/src/source-host-action-collection";
import type { SourceHostEventCollection } from "../../../packages/sim-core/src/source-host-event-collection";
import { renderSourceHostBasePanelProvenance } from "./source-host-base-panel-provenance";
import { SOURCE_DELAY_KEYS, SOURCE_EXECUTION_PROFILE_DEFAULTS, SOURCE_EXECUTION_PROFILE_VERSION, sourceExecutionProfileComment, type SourceExecutionProfile } from "./source-execution-profiles";
import { startSourceHostWorker, sourceHostDiagnosticMessage, type SourceHostDiagnosticReceipt, type SourceHostWorkerRunHandle } from "./source-host-worker-client";

const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const incomingExampleConfig = `${exampleConfig.trimEnd()}\n\n# 第 60 帧的一次假设物理受击；完整受击与护盾由固定来源运行时处理。\nhurt once interval=60 amount=1000,1000 element=physical;\n`;
const practicalExecutionProfile = (): SourceExecutionProfile => ({ version: SOURCE_EXECUTION_PROFILE_VERSION, mode: "practical", delays: { ...SOURCE_EXECUTION_PROFILE_DEFAULTS.practical } });
const sourceDelayOptionName = (key: typeof SOURCE_DELAY_KEYS[number]): string => key === "aim_delay" ? key : `${key}_delay`;
function sourceScriptNeedsPracticalSwap(script: string): boolean {
  const optionsLine = script.match(/^\s*options\b[^\r\n]*/im)?.[0];
  const profileLine = script.match(/^\s*#\s*Execution profile:[^\r\n]*/im)?.[0] ?? "";
  const explicitSwapDelay = optionsLine?.match(/\bswap_delay=(\d+)\b/)?.[1];
  const zeroFrameSwap = explicitSwapDelay === undefined
    ? /\bmode=ideal\b/.test(profileLine)
    : Number(explicitSwapDelay) === 0;
  if (!zeroFrameSwap) return false;
  let active = script.match(/^\s*active\s+([a-z][a-z0-9_]*)\s*;/im)?.[1]
    ?? script.match(/^\s*([a-z][a-z0-9_]*)\s+char\b/im)?.[1];
  if (!active) return false;
  const actionPattern = /^\s*([a-z][a-z0-9_]*)\s+(swap|skill|burst|attack|charge|aim|dash|jump|low_plunge|high_plunge)\b[^;\r\n]*;/gim;
  for (const match of script.matchAll(actionPattern)) {
    const actor = match[1]!;
    const action = match[2]!;
    if (actor !== active) return true;
    if (action === "swap") active = actor;
  }
  return false;
}
function sourceScriptWithPracticalSwap(script: string): string {
  const profile = practicalExecutionProfile();
  const updateDelays = (line: string): string => {
    const missing: string[] = [];
    for (const key of SOURCE_DELAY_KEYS) {
      const name = sourceDelayOptionName(key);
      const pattern = new RegExp(`\\b${name}=\\d+\\b`);
      const replacement = `${name}=${profile.delays[key]}`;
      if (pattern.test(line)) line = line.replace(pattern, replacement);
      else missing.push(replacement);
    }
    if (!missing.length) return line;
    const semicolon = line.lastIndexOf(";");
    return semicolon < 0
      ? `${line} ${missing.join(" ")}`
      : `${line.slice(0, semicolon).trimEnd()} ${missing.join(" ")}${line.slice(semicolon)}`;
  };
  const lines = script.split(/\r?\n/);
  let hasProfile = false, hasOptions = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (/^\s*#\s*Execution profile:/i.test(line)) {
      hasProfile = true;
      lines[index] = updateDelays(line.replace(/\bmode=[^\s]+/, "mode=practical"));
    } else if (/^\s*options\b/i.test(line)) {
      hasOptions = true;
      lines[index] = updateDelays(line);
    }
  }
  const comment = sourceExecutionProfileComment(profile);
  if (!hasProfile) {
    const optionsIndex = lines.findIndex(line => /^\s*options\b/i.test(line));
    lines.splice(optionsIndex < 0 ? 0 : optionsIndex, 0, comment);
  }
  if (!hasOptions) {
    const profileIndex = lines.findIndex(line => /^\s*#\s*Execution profile:/i.test(line));
    lines.splice(profileIndex + 1, 0, `options ${SOURCE_DELAY_KEYS.map(key => `${sourceDelayOptionName(key)}=${profile.delays[key]}`).join(" ")};`);
  }
  return lines.join("\n");
}
let savedConfig = exampleConfig, savedSeed = "1", savedResult: SourceHostResult | null = null;
let savedHostVariant: SourceHostVariant = "classic";
let savedPhaseObservation: SourceHostPhaseObservationRequest | undefined;
let savedExecutionMode: SourceHostExecutionMode = "auto-wait";
let savedStopAtDuration = false;
let savedPrimaryTargetIndex = 0;
let savedTargetPhasesText = "";
let activeWorkerRun: SourceHostWorkerRunHandle | null = null;
let disposeInventory: (() => void) | undefined;
const teamDrafts: Partial<Record<SourceHostVariant, SourceTeamDraft>> = {};
let teamBuilder: ReturnType<typeof import("./source-team-builder").renderSourceTeamBuilder> | undefined;
let builderGeneration = 0;
export async function addSourceTeamRoster(members: SourceTeamMember[], inventory: SourceTeamInventory, mode: "merge" | "replace"): Promise<void> {
  const { prepareSourceTeamHandoff } = await import("./source-team-handoff");
  const variant = inventory.hostVariant;
  const draft = prepareSourceTeamHandoff(teamDrafts[variant], members, inventory, mode);
  if (savedHostVariant === variant) teamBuilder?.setDraft(draft);
  teamDrafts[variant] = draft;
  savedHostVariant = variant;
}

export function stopSourceHostRun(): void { activeWorkerRun?.cancel(); activeWorkerRun = null; }
export function disposeSourceHostPanel(): void { stopSourceHostRun(); disposeInventory?.(); disposeInventory = undefined; builderGeneration++; teamBuilder?.dispose(); teamBuilder = undefined; }

export function renderSourceHostPanel(root: HTMLElement, openCalculator: (capture: SourceHostHitCapture | SourceHostPlayerIncomingCapture | SourceHostEnergyCapture | SourceHostCooldownCapture | SourceHostHealingCapture | SourceHostCharacterShieldCapture | SourceHostDrainCapture | SourceHostActionCollection | SourceHostEventCollection) => void): void {
  disposeInventory?.();
  teamBuilder?.dispose(); teamBuilder = undefined;
  const mountedGeneration = ++builderGeneration;
  root.innerHTML = `<article class="card"><h2>来源队伍模拟</h2><p>固定版本的来源执行器运行角色、装备、快照、粒子、附着与回调，共享公式核心返回实际使用的出伤结果。原有队伍编辑与独立技能计算继续可用。</p>
    <p class="notice">来源机制为暂定。共用出伤核心支持普通、增幅、激化、经典剧变，以及直接月伤害、多人月感电／月结晶；月绽放资源事件另列。星辉另由 a7dc4bf 执行器运行；其源码与指南的分歧保留，尚未游戏验证。任意属性转换的前置解释仍不完整，不支持任意帧断点恢复或据此宣称稳态。</p>
    <label>来源规则版本<select id="source-host-variant"><option value="classic">b4ae769 · 普通/月曜、逐项属性、共享玩家受击</option><option value="stellar">a7dc4bf · 星辉来源规则（暂定、AGPL）</option></select></label><p>配队卡、装备名册与生成脚本使用所选来源；两个来源分别保留队伍草稿。星辉来源的新增角色也可自由配队。切换不会改动正式或预览数据集。</p>
    <div id="source-team-builder"></div>
    <details><summary>高级：示例脚本与来源运行参数</summary>
    <div class="editor-actions"><button type="button" data-source-host-example="ordinary">载入单角色动作示例</button><button type="button" data-source-host-example="lunar">载入月曜机制示例</button><button type="button" data-source-host-example="incoming">载入玩家受击示例</button><button type="button" data-source-host-example="stellar">载入星扩散示例</button><button type="button" data-source-host-example="conduct">载入星导示例</button></div>
    <details><summary>高级：完整 GCSL 脚本（可选）</summary><label>完整 GCSL 队伍与行动脚本<textarea id="source-host-config" rows="18" spellcheck="false">${esc(savedConfig)}</textarea></label></details>
    <div id="source-host-swap-warning" class="notice" role="alert" hidden><p>当前脚本在 0 帧切人延迟下执行了跨角色动作。此来源执行器无法可靠完成这种切换，运行已禁用。</p><button type="button" id="source-host-switch-practical">一键切换当前脚本到实用档（切人 8 帧，其他动作 5 帧）</button><p>切换会更新当前脚本；若当前配队卡仍为理想档，也会同步切换。不会自动运行；确认后再点击“运行来源队伍”。</p></div>
    <p>示例数值为明确的假设构筑。属性增量与最终面板不同，请勿将导入的最终面板再作为构筑增量填写。观察时间使用脚本中的 <code>options duration=…</code>（秒）；输入采用来源 GCSL 语法。<strong>显式目标 hp 会切换到击杀模式，脚本结束即可停止，末击尾段可能不发生；固定时间窗请保留来源的无 hp 模式。</strong></p>
    <label><input type="checkbox" id="source-host-stop-at-duration"${savedStopAtDuration ? " checked" : ""}>同时以脚本 duration 作为时间上限</label><p>配队编辑器生成脚本时自动启用。即使目标设置 HP 或动作正在等待能量，也最迟在配置时长停止；目标死亡或击杀模式的动作流结束仍可提前停止。取消后完全沿用来源原生终止条件，HP 模式不受 duration 限制。</p>
    <label>统计主目标（按 target 声明顺序，编号从 1 开始）<input type="number" id="source-host-primary-target" min="1" step="1" required value="${savedPrimaryTargetIndex + 1}"></label><p>只指定分目标统计，不改变原生锁定或朝向；结果保留运行时的目标选择。</p>
    <details><summary>目标阶段情景 · 高级 JSON</summary><p>上方目标编辑器会同步填写。留空表示没有声明阶段；窗口采用 60 FPS 的 [起始帧, 结束帧)，targetIndex 按脚本目标顺序从 0 开始。修改脚本中的目标顺序后，请核对这里的对应关系。这些是用户声明的情景，不是已验证的敌人资料。</p><label>目标阶段配置<textarea id="source-host-target-phases" rows="8" spellcheck="false">${esc(savedTargetPhasesText)}</textarea></label></details>
    <label>随机种子（uint64 十进制）<input id="source-host-seed" inputmode="numeric" pattern="[0-9]+" required value="${esc(savedSeed)}"></label>
    <label>动作执行模式<select id="source-host-execution-mode"><option value="auto-wait">自动等待 · 未就绪时按帧重试</option><option value="strict">严格 · 首次未就绪即停止</option></select></label>
    <p>两种模式都沿用来源的动画排队、隐式切人和显式等待。严格模式在实际排队后首次遇到动画、切人、冷却、能量或体力未就绪时停止，不补时间也不跳过动作；允许排队不代表此时已能施放。可先用自动等待查看实际排队与执行差，再编辑等待或动作。它们是本工具的执行政策，不能代替游戏机制验证。</p>
    <fieldset id="source-host-phase-controls"><legend>观察轮转相位</legend><button type="button" id="source-host-phase-example">载入随机循环示例</button><button type="button" id="source-host-phase-deterministic-example">载入确定性伤害循环示例</button><label><input id="source-host-phase-enabled" type="checkbox"${savedPhaseObservation ? " checked" : ""}>记录原生相位并检查周期状态</label><p>在同一轮转的开头写入 <code>phase("rotation");</code>，并在重复循环中保留这个位置。观察标记不推进时间。系统同时比较实际脚本位置、完整状态与周期伤害；有未知回调或私有状态时会列出缺口，不给稳态 DPS。</p><div class="form-grid"><label>预热帧数<input id="source-host-phase-warmup" type="number" min="0" step="1" value="${savedPhaseObservation?.warmupFrames ?? 0}"></label><label>允许的最长周期（轮）<input id="source-host-phase-period" type="number" min="1" max="8" step="1" value="${savedPhaseObservation?.maxPeriod ?? 4}"></label><label>连续比较周期数<input id="source-host-phase-repeats" type="number" min="2" max="8" step="1" value="${savedPhaseObservation?.requiredConsecutivePeriods ?? 3}"></label><label>最多记录边界<input id="source-host-phase-limit" type="number" min="2" max="256" step="1" value="${savedPhaseObservation?.maxObservations ?? 64}"></label></div></fieldset>
    <div class="editor-actions"><button class="primary" id="source-host-run">运行来源队伍</button><button id="source-host-cancel" disabled>取消</button><button id="source-host-export" ${savedResult ? "" : "disabled"}>导出完整结果</button><label class="file-button">导入来源结果<input type="file" id="source-host-import" accept="application/json"></label></div>
    </details>
    <p id="source-host-status" role="status" aria-live="polite"></p>
    <section id="source-host-worker-diagnostic" class="card" role="alert" hidden><p data-diagnostic-message></p><div class="editor-actions"><button type="button" id="source-host-diagnostic-retry">按原输入安全重试</button><button type="button" id="source-host-diagnostic-export">导出安全诊断回执</button></div><details><summary>错误阶段与技术信息</summary><pre data-diagnostic-json></pre></details></section>
    <details><summary>高级：复跑核对与结果导出</summary>
    <div class="editor-actions"><button id="source-host-reexecute" ${savedResult ? "" : "disabled"}>从头复跑核对当前结果</button><button id="source-host-export-reexecution" disabled>导出复跑核对记录</button></div>
    <p>导入会恢复共享公式与数值；「从头复跑核对」使用该结果保存的完整脚本、种子、动作政策和同一WASM，从初态重新运行机制，包含实际动作、能量、伤害和日志。它不使用上方尚未运行的编辑内容，也不是任意帧断点恢复或游戏验证。</p>
    <p id="source-host-reexecution-status" role="status">当前结果尚未在本页面完成从头复跑核对。</p>
    </details>
    <details><summary>来源与能力边界</summary><p>源码注册不等于通过游戏验证。源内 TODO、缺失人物及各机制限制仍保留。共享公式返回玩家受击、护盾消耗、穿透最小值与生命比例；来源运行时保留事件、护盾顺序与生命上下限处理。</p><a href="/source-host/manifest.json" target="_blank" rel="noopener">b4ae769 源码、构建哈希、名册及许可</a> · <a href="/source-host-stellar/manifest.json" target="_blank" rel="noopener">a7dc4bf 独立源码、哈希及许可</a></details></article>
    <div id="source-host-batch"></div><div id="source-host-startup"></div><div id="source-host-result"></div><div id="source-host-inventory"></div>`;
  const config = root.querySelector<HTMLTextAreaElement>("#source-host-config")!, seed = root.querySelector<HTMLInputElement>("#source-host-seed")!;
  const hostVariant = root.querySelector<HTMLSelectElement>("#source-host-variant")!;
  const executionMode = root.querySelector<HTMLSelectElement>("#source-host-execution-mode")!;
  const stopAtDuration = root.querySelector<HTMLInputElement>("#source-host-stop-at-duration")!;
  stopAtDuration.onchange = () => { savedStopAtDuration = stopAtDuration.checked; };
  const primaryTarget = root.querySelector<HTMLInputElement>("#source-host-primary-target")!;
  primaryTarget.onchange = () => { if (primaryTarget.checkValidity()) savedPrimaryTargetIndex = primaryTarget.valueAsNumber - 1; };
  const targetPhasesInput = root.querySelector<HTMLTextAreaElement>("#source-host-target-phases")!;
  targetPhasesInput.oninput = () => { savedTargetPhasesText = targetPhasesInput.value; };
  const clearTargetPhases = () => { savedTargetPhasesText = ""; targetPhasesInput.value = ""; };
  executionMode.value = savedExecutionMode;
  executionMode.onchange = () => { savedExecutionMode = executionMode.value as SourceHostExecutionMode; };
  hostVariant.value = savedHostVariant;
  hostVariant.onchange = () => selectHostVariant(hostVariant.value as SourceHostVariant);
  const run = root.querySelector<HTMLButtonElement>("#source-host-run")!, cancel = root.querySelector<HTMLButtonElement>("#source-host-cancel")!;
  const status = root.querySelector<HTMLElement>("#source-host-status")!, resultHost = root.querySelector<HTMLElement>("#source-host-result")!;
  const swapWarning = root.querySelector<HTMLElement>("#source-host-swap-warning")!;
  const switchPracticalButton = root.querySelector<HTMLButtonElement>("#source-host-switch-practical")!;
  let swapBlocked = false, sourceRunBusy = false;
  const updateSwapGuard = (script = config.value) => {
    swapBlocked = sourceScriptNeedsPracticalSwap(script);
    swapWarning.hidden = !swapBlocked;
    run.disabled = sourceRunBusy || swapBlocked;
  };
  switchPracticalButton.onclick = () => {
    config.value = sourceScriptWithPracticalSwap(config.value);
    savedConfig = config.value;
    const draft = teamBuilder?.getDraft();
    if (draft?.members.length && draft.executionProfile?.mode === "ideal") {
      draft.executionProfile = practicalExecutionProfile();
      teamBuilder?.setDraft(draft);
    }
    updateSwapGuard();
    status.textContent = "当前脚本已切换到实用档；请确认输入后再运行。";
  };
  const exportButton = root.querySelector<HTMLButtonElement>("#source-host-export")!;
  const reexecuteButton = root.querySelector<HTMLButtonElement>("#source-host-reexecute")!;
  const exportReexecution = root.querySelector<HTMLButtonElement>("#source-host-export-reexecution")!;
  const reexecutionStatus = root.querySelector<HTMLElement>("#source-host-reexecution-status")!;
  const diagnosticHost = root.querySelector<HTMLElement>("#source-host-worker-diagnostic")!;
  const diagnosticMessage = diagnosticHost.querySelector<HTMLElement>("[data-diagnostic-message]")!;
  const diagnosticJson = diagnosticHost.querySelector<HTMLElement>("[data-diagnostic-json]")!;
  const retryDiagnosticButton = root.querySelector<HTMLButtonElement>("#source-host-diagnostic-retry")!;
  const exportDiagnosticButton = root.querySelector<HTMLButtonElement>("#source-host-diagnostic-export")!;
  const importInput = root.querySelector<HTMLInputElement>("#source-host-import")!;
  let lastFailedRequest: SourceHostWorkerRequest | null = null;
  let lastDiagnostic: SourceHostDiagnosticReceipt | null = null;
  let reexecutionReceipt: SourceHostReexecutionReceipt | null = null;
  let importGeneration = 0;
  const resetReexecution = () => {
    reexecutionReceipt = null; exportReexecution.disabled = true;
    reexecutionStatus.textContent = "当前结果尚未在本页面完成从头复跑核对。";
  };
  retryDiagnosticButton.onclick = () => { if (lastFailedRequest) startRun(structuredClone(lastFailedRequest)); };
  exportDiagnosticButton.onclick = () => { if (lastDiagnostic) downloadSourceHostJson(lastDiagnostic, "source-host-worker-diagnostic.json"); };
  root.querySelector<HTMLButtonElement>("#source-host-phase-example")!.onclick = () => { clearTargetPhases(); config.value = phaseExampleConfig; updateSwapGuard(); savedPrimaryTargetIndex = 0; primaryTarget.value = "1"; savedConfig = phaseExampleConfig; root.querySelector<HTMLInputElement>("#source-host-phase-enabled")!.checked = true; };
  root.querySelector<HTMLButtonElement>("#source-host-phase-deterministic-example")!.onclick = () => { clearTargetPhases(); config.value = phaseDeterministicExampleConfig; updateSwapGuard(); savedPrimaryTargetIndex = 0; primaryTarget.value = "1"; savedConfig = phaseDeterministicExampleConfig; root.querySelector<HTMLInputElement>("#source-host-phase-enabled")!.checked = true; };
  const getRequest = (): SourceHostWorkerRequest => {
    const number = (id: string) => root.querySelector<HTMLInputElement>(id)!.valueAsNumber;
    if (!primaryTarget.checkValidity()) throw new Error("统计主目标须为从 1 开始的整数编号。");
    savedPrimaryTargetIndex = primaryTarget.valueAsNumber - 1;
    savedTargetPhasesText = targetPhasesInput.value;
    const targetPhases = savedTargetPhasesText.trim() ? sourceHostTargetPhaseRequestSchema.parse(JSON.parse(savedTargetPhasesText)) : undefined;
    savedPhaseObservation = root.querySelector<HTMLInputElement>("#source-host-phase-enabled")!.checked
      ? sourceHostPhaseObservationRequestSchema.parse({ warmupFrames: number("#source-host-phase-warmup"), maxPeriod: number("#source-host-phase-period"), requiredConsecutivePeriods: number("#source-host-phase-repeats"), maxObservations: number("#source-host-phase-limit") }) : undefined;
    return { protocol: SOURCE_HOST_PROTOCOL, config: config.value, seed: seed.value, hostVariant: savedHostVariant, executionMode: savedExecutionMode, primaryTargetIndex: savedPrimaryTargetIndex, ...(savedStopAtDuration ? { stopAtDuration: true } : {}),
      ...(targetPhases === undefined ? {} : { targetPhases }),
      ...(savedPhaseObservation ? { phaseObservation: savedPhaseObservation } : {}) };
  };
  const batch = renderSourceHostBatchControls(root.querySelector<HTMLElement>("#source-host-batch")!, {
    getRequest,
    onRun: jobs => startRun({ ...getRequest(), jobs }),
    onOpenResult: result => { savedResult = result; resetReexecution(); exportButton.disabled = reexecuteButton.disabled = false; renderResult(result); status.textContent = `已打开对照结果：种子 ${result.seed}；结果中的脚本与源码身份单独保留。`; },
  });
  const startup = renderSourceHostStartupControls(root.querySelector<HTMLElement>("#source-host-startup")!, {
    getRequest,
    onRun: startupJobs => startRun({ ...getRequest(), startupJobs }),
    onOpenResult: result => { savedResult = result; resetReexecution(); exportButton.disabled = reexecuteButton.disabled = false; renderResult(result); status.textContent = `已打开起步对照结果：种子 ${result.seed}；实际起步能量保存在本条结果中。`; },
  });
  let builderMount = 0;
  function mountBuilder(): void {
    const attempt = ++builderMount, variant = savedHostVariant;
    teamBuilder?.dispose(); teamBuilder = undefined;
    const host = root.querySelector<HTMLElement>("#source-team-builder")!;
    host.textContent = "读取所选来源的配队名册…";
    void import("./source-team-builder").then(({ renderSourceTeamBuilder }) => {
      if (mountedGeneration !== builderGeneration || attempt !== builderMount) return;
      teamBuilder = renderSourceTeamBuilder(host, {
        hostVariant: variant,
        ...(teamDrafts[variant] ? { initialDraft: teamDrafts[variant] } : {}),
        onDraftChange: draft => { teamDrafts[variant] = structuredClone(draft); },
        onApplyScript: (script, primaryTargetIndex, targetPhases) => {
          savedConfig = script; config.value = script; updateSwapGuard(); savedPrimaryTargetIndex = primaryTargetIndex; primaryTarget.value = String(primaryTargetIndex + 1); savedStopAtDuration = true; stopAtDuration.checked = true;
          savedTargetPhasesText = targetPhases === undefined ? "" : JSON.stringify(targetPhases, null, 2); targetPhasesInput.value = savedTargetPhasesText;
          status.textContent = `已从${variant === "stellar" ? "星辉" : "普通／月曜"}来源配队卡生成脚本。点击「运行来源队伍」，由实际机制检查动画、冷却与能量。`;
        },
        onRunScript: (script, primaryTargetIndex, targetPhases) => {
          savedConfig = script; config.value = script; updateSwapGuard(); savedPrimaryTargetIndex = primaryTargetIndex; primaryTarget.value = String(primaryTargetIndex + 1); savedStopAtDuration = true; stopAtDuration.checked = true;
          savedTargetPhasesText = targetPhases === undefined ? "" : JSON.stringify(targetPhases, null, 2); targetPhasesInput.value = savedTargetPhasesText;
          if (run.disabled) {
            status.textContent = "当前队伍的动作延迟不允许切人；请在高级执行设置中改用实用档后再运行。";
            return;
          }
          status.textContent = "正在运行可视化队伍，等待来源动作、动画、冷却与能量回执…";
          run.click();
        },
      });
      if (savedResult && (savedResult.sourceCommit.startsWith("a7dc4bf") ? "stellar" : "classic") === variant) teamBuilder.renderExecutionLogs(savedResult.logs, savedResult.statusInstances, savedResult.observationWindow?.actualEndFrame ?? savedResult.lifecycleObservationFrame);
    }).catch(error => { if (mountedGeneration === builderGeneration && attempt === builderMount) host.textContent = `配队编辑器加载失败：${error}`; });
  }
  function selectHostVariant(variant: SourceHostVariant): void {
    const changed = savedHostVariant !== variant;
    savedHostVariant = variant; hostVariant.value = variant;
    mountInventory();
    if (changed) mountBuilder();
  }
  mountBuilder();

  root.querySelectorAll<HTMLButtonElement>("[data-source-host-example]").forEach(button => {
    button.onclick = () => { clearTargetPhases(); savedPrimaryTargetIndex = 0; primaryTarget.value = "1"; const key = button.dataset.sourceHostExample; selectHostVariant(key === "stellar" || key === "conduct" ? "stellar" : "classic"); savedConfig = key === "stellar" ? stellarExampleConfig : key === "conduct" ? stellarConductExampleConfig : key === "lunar" ? lunarExampleConfig : key === "incoming" ? incomingExampleConfig : exampleConfig; config.value = savedConfig; updateSwapGuard(); status.textContent = "已载入可编辑示例。构筑为假设值，反应由实际执行状态决定。"; };
  });
  function mountInventory(): void {
    disposeInventory?.();
    disposeInventory = renderSourceHostInventory(root.querySelector<HTMLElement>("#source-host-inventory")!, {
    hostVariant: savedHostVariant,
    onInsertSnippet: snippet => {
      const start = config.selectionStart, end = config.selectionEnd;
      const before = config.value.slice(0, start), after = config.value.slice(end);
      const inserted = `${before && !before.endsWith("\n") ? "\n" : ""}${snippet}\n`;
      config.value = before + inserted + after; savedConfig = config.value; updateSwapGuard();
      config.focus(); config.setSelectionRange(start + inserted.length, start + inserted.length);
      status.textContent = "已在脚本光标处插入所选配置片段，尚未运行。";
    },
  });
  }
  mountInventory();
  const setBusy = (busy: boolean) => { sourceRunBusy = busy; run.disabled = busy || swapBlocked; cancel.disabled = !busy; batch.setBusy(busy); startup.setBusy(busy); reexecuteButton.disabled = busy || !savedResult; importInput.disabled = busy; };
  const renderResult = (result: SourceHostResult): void => {
    teamBuilder?.renderExecutionLogs((result.sourceCommit.startsWith("a7dc4bf") ? "stellar" : "classic") === savedHostVariant ? result.logs : undefined,
      (result.sourceCommit.startsWith("a7dc4bf") ? "stellar" : "classic") === savedHostVariant ? result.statusInstances : undefined,
      (result.sourceCommit.startsWith("a7dc4bf") ? "stellar" : "classic") === savedHostVariant ? result.observationWindow?.actualEndFrame ?? result.lifecycleObservationFrame : undefined);
    const overview = renderSourceHostResultOverview(result, key => teamBuilder?.getCharacterName(key));
    const incoming = result.playerApplications ?? [];
    const drains = result.drainApplications ?? [];
    const rng = result.randomness;
    const randomnessDetails = rng
      ? `<p data-source-host-randomness>随机性回执：${esc(rng.algorithm)}；原始种子 ${esc(rng.seed)} → int64 ${esc(rng.signedSeed)} → 实际初始化种子 ${esc(rng.effectiveSeed)}；Go ${esc(rng.goVersion)}。暴击按该原生随机流抽样；由暴击触发的效果及其他随机事件均由来源运行抽样。</p>`
      : `<p data-source-host-randomness>随机性回执：旧记录未提供原生 RNG 回执；种子 ${esc(result.seed)} 的初始化映射采用 ${SOURCE_HOST_SEED_NORMALIZATION}，算法为 ${SOURCE_HOST_RNG_ALGORITHM}。实际暴击触发效果及其他随机事件来源采样情况未知。</p>`;
    const window = result.observationWindow;
    const windowDetails = window ? `<p data-source-host-observation-window>终止政策：${window.policy === "duration-or-native" ? "配置时长上限与来源原生条件共同生效" : "来源原生条件"}；配置截止帧 ${window.configuredEndFrame}，实际结束帧 ${window.actualEndFrame}；结束原因：${{ duration: "达到配置时长", "targets-dead": "目标已全部死亡", "actions-exhausted": "击杀模式动作流已结束" }[window.endReason]}。${window.endReason === "duration" ? "" : "本次提前结束，伤害率使用实际时间，不称为完整固定窗口 DPS。"}</p>` : "<p>此旧结果没有终止条件回执，不从伤害或脚本推断结束原因。</p>";
    resultHost.innerHTML = `<article class="card"><h3>本次来源队伍模拟</h3>${overview}<details data-source-host-run-info><summary>高级：来源与运行信息</summary><p>固定源码：<code>${esc(result.sourceCommit)}</code>；本次执行政策：${result.executionMode === "strict" ? "严格" : "自动等待"}${result.executionMode === undefined ? "（旧版本默认）" : ""}。</p>${randomnessDetails}${windowDetails}<p>记录 ${result.applications.length} 次已结算命中、${incoming.length} 次玩家受击、${result.calculations.length} 次共享核心计算。固定时长与击杀模式的统计、目标剩余生命截断分别保留。</p><p>执行器 SHA-256：<code>${esc(result.executionArtifact?.wasmSha256 ?? "旧记录未保存产物身份")}</code></p><p>数值状态 provisional；前置解释 partial。保存脚本与种子可从头再运行，逐击恢复无需 WASM。</p>
      ${result.startupState ? `<p data-source-host-startup-state>本次初能政策：${{ zero: "零能", full: "满能", custom: "逐角色自定义" }[result.startupState.mode]}；原生初始化后实际能量：${result.startupState.actors.map(actor => `${esc(actor.actorKey)} ${actor.energy}/${actor.maxEnergy}`).join("；")}。此政策只作用于初始化。</p>` : ""}</details>
      <label>选择实际命中<input type="number" id="source-host-hit-index" min="0" max="${Math.max(0, result.applications.length - 1)}" step="1" value="0"></label><button id="source-host-open-calculator" ${result.applications.length ? "" : "disabled"}>在独立计算器中恢复并编辑</button><div id="source-host-hit"></div>
      <div id="source-host-target-summary"></div><div id="source-host-target-phase-result"></div><div id="source-host-action-origins"></div>
      <section data-source-host-incoming-ledger><h4>玩家实际受击账本</h4><p>${incoming.length ? `共 ${incoming.length} 次。原始伤害、护盾吸收与 Drain 返回量分别来自来源运行回执。` : "本次没有玩家受击记录；旧版结果也可能未提供此账本。"}</p>${incoming.length ? `<label>选择玩家受击<input type="number" id="source-host-incoming-index" min="0" max="${incoming.length - 1}" step="1" value="0"></label><button type="button" id="source-host-open-incoming-calculator">在独立计算器中恢复玩家受击</button><div id="source-host-incoming-hit"></div>` : ""}</section>
      <section data-source-host-drain-ledger><h4>角色生命扣除账本</h4><p>${drains.length ? `共 ${drains.length} 次原生 Drain 调用，含技能自耗、受击与可能的零值事件。每次记录本次要求扣除的 HP、扣除前生命和写回比例；生命门槛与上限由来源角色和模板执行。` : "本次没有 Drain 应用记录；旧版结果也可能未保存这条账本，不能据此断定没有扣血。"}</p>${drains.length ? `<label>选择扣血事件<input type="number" id="source-host-drain-index" min="0" max="${drains.length - 1}" step="1" value="0"></label><button type="button" id="source-host-open-drain-calculator">送到独立扣血计算器</button><div id="source-host-drain-hit" role="status"></div><div class="table-wrap"><table><thead><tr><th>编号</th><th>帧</th><th>角色</th><th>来源动作</th><th>请求扣血</th><th>写回生命比例</th></tr></thead><tbody>${drains.slice(0, 120).map((row, index) => `<tr data-source-host-drain-row="${index}"><td>${index}</td><td>${row.frame}</td><td>${esc(row.actorKey)}</td><td>${esc(row.ability)}</td><td>${row.amount}</td><td>${row.resultRatio}</td></tr>`).join("")}</tbody></table></div>` : ""}</section>
      <div id="source-host-phase-result"></div><div id="source-host-energy"></div><div id="source-host-helper-formulas"></div><details><summary>完整来源事件日志</summary><p>包括动作、能量、装备、反应和其他来源消息；日志保持原始字段，不能把调试文本当作已解释公式。</p><label>日志起始行<input type="number" id="source-host-log-offset" min="0" step="50" value="0"></label><pre id="source-host-log"></pre></details></article>`;
    renderSourceHostTargetSummaryPanel(resultHost.querySelector<HTMLElement>("#source-host-target-summary")!, result, { showRates: true });
    renderSourceHostTargetPhasePanel(resultHost.querySelector<HTMLElement>("#source-host-target-phase-result")!, result);
    renderSourceHostPhasePanel(resultHost.querySelector<HTMLElement>("#source-host-phase-result")!, result);
    renderSourceHostOriginPanel(resultHost.querySelector<HTMLElement>("#source-host-action-origins")!, result, openCalculator);
    renderSourceHostEnergyPanel(resultHost.querySelector<HTMLElement>("#source-host-energy")!, result, openCalculator);
    renderSourceHostHelperFormulaPanel(resultHost.querySelector<HTMLElement>("#source-host-helper-formulas")!, result, { openCooldown: openCalculator, openHealing: openCalculator, openShield: openCalculator });
    resultHost.querySelector<HTMLElement>("[data-source-host-result-overview]")?.scrollIntoView({ block: "start", behavior: "smooth" });
    const select = resultHost.querySelector<HTMLInputElement>("#source-host-hit-index")!, hitHost = resultHost.querySelector<HTMLElement>("#source-host-hit")!;
    const chosen = () => result.applications[select.valueAsNumber];
    const showHit = () => {
      try {
        const application = chosen(); if (!application) { hitHost.textContent = "当前没有该命中。"; return; }
        const replay = replaySourceHostHit(captureSourceHostHit(result, application.id));
        hitHost.innerHTML = `<h4>${esc(replay.request.actorKey)} · ${esc(replay.request.ability)} · 第 ${replay.request.frame} 帧</h4><p>原始公式伤害 ${replay.originalRawDamage}；公式重放 ${replay.reproducedRawDamage}。来源实际记账 ${replay.originalDamage}；应用重放 ${replay.reproducedDamage}；记账差值 ${replay.difference}。目标 HP 损失 ${application.hpBefore - application.hpAfter}。</p><p>共享公式按此条保存输入重放；来源机制仍属暂定。本视图恢复单次命中，不支持任意帧状态断点。</p>${renderSourceHostBasePanelProvenance(replay.request.snapshot?.statProvenance?.snapshotRead)}${replay.warnings.map(warning => `<p class="calculator-hint">${esc(warning)}</p>`).join("")}${renderTraceHtml(replay.trace)}`;
      } catch (error) { hitHost.textContent = String(error); }
    };
    select.oninput = showHit; showHit();
    resultHost.querySelector<HTMLButtonElement>("#source-host-open-calculator")!.onclick = () => { const row = chosen(); if (row) openCalculator(captureSourceHostHit(result, row.id)); };
    if (incoming.length) {
      const incomingSelect = resultHost.querySelector<HTMLInputElement>("#source-host-incoming-index")!;
      const incomingHost = resultHost.querySelector<HTMLElement>("#source-host-incoming-hit")!;
      const incomingOpen = resultHost.querySelector<HTMLButtonElement>("#source-host-open-incoming-calculator")!;
      const chosenIncoming = () => incoming[incomingSelect.valueAsNumber];
      const showIncoming = () => {
        try {
          const row = chosenIncoming();
          if (!row) { incomingHost.textContent = "当前没有该玩家受击。"; return; }
          const replay = replaySourceHostPlayerIncoming(captureSourceHostPlayerIncoming(result, row.id));
          const manual = replay.calculation.request.kind === "player-manual-incoming";
          incomingOpen.textContent = manual ? "查看并导出手工受击只读回执" : "在独立计算器中恢复玩家受击";
          const linkedDrain = row.drainCalculationId == null ? undefined : drains.find(drain => drain.calculationId === row.drainCalculationId);
          incomingHost.innerHTML = `<h5>${esc(replay.calculation.request.actorKey)} · ${esc(replay.calculation.request.ability)} · 第 ${row.frame} 帧</h5><p>护盾前 ${row.rawDamage}；公式重放 ${replay.reproducedRawDamage}；护盾吸收 ${row.shieldAbsorbed}；护盾后 ${row.damageAfterShield}；Drain 返回 ${row.drainAttempted}。生命扣除前的 HP 与写回比例见对应扣血记录。</p>${manual ? `<p>这是来源手工自伤，未经过普通防御、抗性或暴击计算；受击捕获可只读保存和重放。</p>${replay.captured.components.filter(component => component.request.kind === "character-drain").map(component => `<p>实际扣血来源 #${component.request.id}：${component.value}</p>`).join("")}${linkedDrain?.sourceCalculationId != null ? `<button type="button" data-source-host-open-linked-drain>编辑对应的 Drain 金额与比例</button>` : `<p>本次没有可编辑的相连 Drain 来源金额；护盾可能已吸收全部手工伤害。</p>`}${replay.stateCalculations.map(step => renderTraceHtml(step.trace)).join("")}` : ""}${renderTraceHtml(replay.calculation.trace)}`;
          incomingHost.querySelector<HTMLButtonElement>("[data-source-host-open-linked-drain]")?.addEventListener("click", () => {
            if (linkedDrain) openCalculator(captureSourceHostDrain(result, linkedDrain.id));
          });
        } catch (error) { incomingHost.textContent = String(error); }
      };
      incomingSelect.oninput = showIncoming; showIncoming();
      incomingOpen.onclick = () => {
        const row = chosenIncoming(); if (row) openCalculator(captureSourceHostPlayerIncoming(result, row.id));
      };
    }
    if (drains.length) {
      const drainSelect = resultHost.querySelector<HTMLInputElement>("#source-host-drain-index")!;
      const drainHost = resultHost.querySelector<HTMLElement>("#source-host-drain-hit")!;
      const drainOpen = resultHost.querySelector<HTMLButtonElement>("#source-host-open-drain-calculator")!;
      const chosenDrain = () => drains[drainSelect.valueAsNumber];
      const showDrain = () => {
        const row = chosenDrain();
        if (!row) { drainHost.textContent = "当前没有该扣血事件。"; drainOpen.disabled = true; return; }
        drainOpen.disabled = row.sourceCalculationId === null;
        const identity = `<h5>${esc(row.actorKey)} · ${esc(row.ability)} · 第 ${row.frame} 帧</h5>`;
        const lifecycle = `<p>原生请求扣除 ${row.amount} HP；扣除前 ${row.hpBefore} / ${row.maxHp} HP；本次写回生命比例 ${row.resultRatio}。同一事件的门槛、上限及后续状态仍由来源执行器决定。</p>`;
        if (row.sourceCalculationId === null) {
          drainHost.innerHTML = `${identity}${lifecycle}<p>本条原生扣血没有相连的共享来源金额公式；仍显示历史应用，但无法作为可编辑独立公式打开。</p>`;
          return;
        }
        try {
          const replay = replaySourceHostDrain(captureSourceHostDrain(result, row.id));
          drainHost.innerHTML = `${identity}${lifecycle}<p>相同输入共享公式重放：来源请求 ${replay.reproducedAmount} HP；写回比例 ${replay.reproducedRatio}。</p>${replay.sourceCalculations.map(source => renderTraceHtml(source.trace)).join("")}${renderTraceHtml(replay.calculation.trace)}`;
        } catch (error) { drainHost.textContent = error instanceof Error ? error.message : String(error); drainOpen.disabled = true; }
      };
      drainSelect.oninput = showDrain; showDrain();
      drainOpen.onclick = () => { const row = chosenDrain(); if (row && row.sourceCalculationId !== null) openCalculator(captureSourceHostDrain(result, row.id)); };
    }
    const offset = resultHost.querySelector<HTMLInputElement>("#source-host-log-offset")!;
    const logs = Array.isArray(result.logs) ? result.logs : [result.logs];
    const showLog = () => { const start = Math.max(0, offset.valueAsNumber || 0); resultHost.querySelector<HTMLElement>("#source-host-log")!.textContent = `共 ${logs.length} 行；显示 ${start}–${Math.min(start + 50, logs.length)}\n${JSON.stringify(logs.slice(start, start + 50), null, 2)}`; };
    offset.oninput = showLog; showLog();
  };
  if (savedResult) renderResult(savedResult);
  config.oninput = () => { savedConfig = config.value; updateSwapGuard(); }; seed.oninput = () => { savedSeed = seed.value; };
  updateSwapGuard();
  function startRun(request: SourceHostWorkerRequest): void {
    if (sourceScriptNeedsPracticalSwap(request.config)) {
      updateSwapGuard(request.config);
      status.textContent = "运行已拦截：请先将跨角色脚本切换到实用档。";
      return;
    }
    importGeneration++;
    stopSourceHostRun(); setBusy(true); status.textContent = "准备执行…";
    const exactRequest = structuredClone(request);
    lastFailedRequest = null; lastDiagnostic = null; diagnosticHost.hidden = true;
    exportButton.disabled = reexecuteButton.disabled = true; exportReexecution.disabled = true;
    if (savedResult && !request.reexecutionTarget) {
      const note = document.createElement("p"); note.dataset.previousResult = "true"; note.className = "notice";
      note.textContent = "下方保留的是上一次成功运行结果；它不属于本次输入。";
      resultHost.prepend(note);
    }
    setBusy(true);
    try {
      activeWorkerRun = startSourceHostWorker(exactRequest, {
        onProgress: message => { status.textContent = message.message; },
        onFailure: (diagnostic, failureLogs) => {
          activeWorkerRun = null; setBusy(false); lastFailedRequest = exactRequest; lastDiagnostic = diagnostic;
          diagnosticMessage.textContent = sourceHostDiagnosticMessage(diagnostic);
          diagnosticJson.textContent = JSON.stringify(diagnostic, null, 2);
          diagnosticHost.hidden = false;
          status.textContent = sourceHostDiagnosticMessage(diagnostic);
          if (request.reexecutionTarget) {
            reexecutionStatus.textContent = `复跑核对失败（${diagnostic.failure.code}）；原结果保留。可以按原输入安全重试。`;
            exportButton.disabled = reexecuteButton.disabled = !savedResult;
          } else if (failureLogs !== undefined) {
            teamBuilder?.renderExecutionLogs(failureLogs);
            savedResult = null; resetReexecution(); exportButton.disabled = reexecuteButton.disabled = true;
            resultHost.innerHTML = '<article class="card"><h3>本次运行已中止</h3><p>上方动作账本保留中止前的实际记录；未生成完整观察窗结果，不显示本次总伤或 DPS。</p></article>';
          } else if (savedResult) {
            exportButton.disabled = reexecuteButton.disabled = true;
            if (!resultHost.querySelector("[data-previous-result]")) {
              const note = document.createElement("p"); note.dataset.previousResult = "true"; note.className = "notice";
              note.textContent = "以下数值来自之前成功的输入，不能作为本次运行结果。";
              resultHost.prepend(note);
            }
          }
        },
        onMessage: message => {
          activeWorkerRun = null; setBusy(false); diagnosticHost.hidden = true;
          if (message.type === "reexecution-result") {
            reexecutionReceipt = message.receipt; exportReexecution.disabled = false;
            reexecutionStatus.textContent = "从头复跑核对通过：保存的输入、同一WASM和完整记录一致；这不提升游戏验证等级。";
            status.textContent = `从头复跑完成，耗时 ${message.elapsedMs.toFixed(1)} ms。原始结果保持不变。`;
            return;
          }
          if (message.type === "batch-result") {
            try { batch.show(message.runs); status.textContent = `对照完成，共 ${message.runs.length} 次运行，耗时 ${message.elapsedMs.toFixed(1)} ms。`; }
            catch (error) { status.textContent = `对照分析失败：${error}`; }
            return;
          }
          if (message.type === "startup-result") {
            try { startup.show(message.startupRuns); status.textContent = `起步对照完成，共 ${message.startupRuns.length} 次运行，耗时 ${message.elapsedMs.toFixed(1)} ms。`; }
            catch (error) { status.textContent = `起步对照分析失败：${error}`; }
            return;
          }
          savedResult = message.result; resetReexecution(); exportButton.disabled = reexecuteButton.disabled = false;
          renderResult(savedResult); status.textContent = `本次运行完成，耗时 ${message.elapsedMs.toFixed(1)} ms。`;
        },
      });
    } catch (error) {
      setBusy(false);
      status.textContent = `Worker 无法启动：${error instanceof Error ? error.message : String(error)}`;
    }
  }
  run.onclick = () => {
    if (!seed.reportValidity() || !config.value.trim()) { status.textContent = "请填写队伍脚本与种子。"; return; }
    try { startRun(getRequest()); } catch (error) { status.textContent = `观察设置无效：${error instanceof Error ? error.message : String(error)}`; }
  };
  cancel.onclick = () => { stopSourceHostRun(); setBusy(false); status.textContent = "已取消本次运行。"; if (!reexecutionReceipt) reexecutionStatus.textContent = "本次未完成从头复跑核对。"; };
  reexecuteButton.onclick = () => {
    if (!savedResult) return;
    resetReexecution();
    try {
      const request = sourceHostReexecutionRequest(savedResult);
      reexecutionStatus.textContent = "正在核对当前保存结果…";
      startRun({ ...request, reexecutionTarget: savedResult });
    } catch (error) { reexecutionStatus.textContent = `不能复跑核对：${error}。原始数值仍可查看。`; }
  };
  exportReexecution.onclick = () => { if (savedResult && reexecutionReceipt) downloadSourceHostJson({ schemaVersion: "source-host-reexecution-record-v1", receipt: reexecutionReceipt, result: savedResult }, "source-host-reexecution.json"); };
  exportButton.onclick = () => { if (savedResult) downloadSourceHostJson(savedResult, "source-host-result.json"); };
  importInput.onchange = event => {
    const input = event.target as HTMLInputElement, file = input.files?.[0]; if (!file) return;
    const generation = ++importGeneration;
    void file.text().then(text => {
      if (generation !== importGeneration || mountedGeneration !== builderGeneration) return;
      const imported = JSON.parse(text);
      savedResult = createSourceHostResult(imported?.schemaVersion === "source-host-reexecution-record-v1" ? imported.result : imported);
      savedPhaseObservation = savedResult.phaseObservation;
      root.querySelector<HTMLInputElement>("#source-host-phase-enabled")!.checked = Boolean(savedPhaseObservation);
      if (savedPhaseObservation) for (const [id, value] of [["warmup", savedPhaseObservation.warmupFrames], ["period", savedPhaseObservation.maxPeriod], ["repeats", savedPhaseObservation.requiredConsecutivePeriods], ["limit", savedPhaseObservation.maxObservations]] as const) root.querySelector<HTMLInputElement>(`#source-host-phase-${id}`)!.value = String(value);
      resetReexecution(); selectHostVariant(savedResult.sourceCommit.startsWith("a7dc4bf") ? "stellar" : "classic"); savedConfig = savedResult.config; savedSeed = savedResult.seed; savedTargetPhasesText = savedResult.targetPhases ? JSON.stringify({ policy: savedResult.targetPhases.policy, phases: normalizeSourceHostTargetPhases(savedResult.targetPhases) }, null, 2) : ""; targetPhasesInput.value = savedTargetPhasesText; savedExecutionMode = savedResult.executionMode ?? "auto-wait"; savedPrimaryTargetIndex = savedResult.targetScene?.primaryTargetIndex ?? 0; primaryTarget.value = String(savedPrimaryTargetIndex + 1); savedStopAtDuration = savedResult.observationWindow?.policy === "duration-or-native"; stopAtDuration.checked = savedStopAtDuration; executionMode.value = savedExecutionMode; config.value = savedConfig; updateSwapGuard(); seed.value = savedSeed; renderResult(savedResult); exportButton.disabled = reexecuteButton.disabled = false; status.textContent = "已导入并重算来源结果的共享数值；尚未从头复跑机制。导入的历史核对记录不作为本次通过证明。";
    }).catch(error => { if (generation === importGeneration && mountedGeneration === builderGeneration) status.textContent = `导入失败：${error}`; }); input.value = "";
  };
}
