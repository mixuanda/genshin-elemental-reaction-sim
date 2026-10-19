import { canonicalStringify, getRuntimeSkillCooldownActors, migrateConfig, type SimConfig, type SimulationOptions, type SimulationResult } from "@genshin-dps-lab/schemas";
import { simulate } from "./simulator";
import { compileLegalTimeline, TimelineLegalityError } from "./legal-timeline";
import { proveEnergyCapacityFailure, proveAllSuccessTimelineFailure, type ErIndependentFailureProof } from "./er-independent-failure";
export type { ErIndependentFailureProof } from "./er-independent-failure";
import { actionPendingHorizonTicks, abilityPendingHorizonTicks } from "./action-pending-horizon";
import { hasRandomWeaponProc } from "./weapon-proc";

export interface DamageWindow {
  startTick: number;
  endTick: number;
  durationSeconds: number;
  totalDamage: number;
  dps: number;
  primaryTargetDamage: number;
  primaryTargetDps: number;
  includedDamageEventIds: number[];
  policy: "half-open-[startTick,endTick)";
}

/** Actual event arithmetic, no reset or extrapolation of ongoing effects. */
export function measureDamageWindow(result: SimulationResult, startTick: number, endTick: number, primaryTargetId = result.enemyTargets[0]?.id): DamageWindow {
  if (!Number.isInteger(startTick) || !Number.isInteger(endTick) || startTick < 0 || endTick <= startTick || endTick > Math.round(result.config.duration * 60)) {
    throw new Error("测量区间必须为已模拟时段内的非空整帧半开区间。");
  }
  if (!primaryTargetId || !result.enemyTargets.some((target) => target.id === primaryTargetId)) throw new Error("主目标不在本次模拟目标表中。");
  const included = result.damageEvents.filter((event) => event.frame >= startTick && event.frame < endTick);
  const totalDamage = included.reduce((sum, event) => sum + event.finalDamage, 0);
  const primaryTargetDamage = included.filter((event) => event.targetId === primaryTargetId).reduce((sum, event) => sum + event.finalDamage, 0);
  const durationSeconds = (endTick - startTick) / 60;
  return { startTick, endTick, durationSeconds, totalDamage, dps: totalDamage / durationSeconds,
    primaryTargetDamage, primaryTargetDps: primaryTargetDamage / durationSeconds,
    includedDamageEventIds: included.map((event) => event.id), policy: "half-open-[startTick,endTick)" };
}

export interface RotationExecutionSummary {
  version: "actual-input-and-source-tail-v1";
  requestedCycle: { ticks: number; seconds: number };
  observation: DamageWindow;
  inputExecution: {
    scope: "declared-legal-command-sequence" | "legacy-script";
    status: "complete" | "partial" | "unavailable";
    occupiedEndTick: number | null;
    executableSeconds: number | null;
    commandCount: number;
    failedOrUnobservedCommandIndices: number[];
    measurement: DamageWindow | null;
    reasons: string[];
  };
  tailAttribution: {
    status: "complete" | "partial" | "unknown";
    declaredHorizonTick: number;
    unassignedDamageEventIds: number[];
    reasons: string[];
    sources: Array<{
      actorId: string; actionId: string; engineCycle: number; timelineCommandIndex: number | null;
      startTick: number; declaredTailEndTick: number | null;
      damageEventIds: number[]; observedDamage: number; primaryTargetDamage: number; damageAfterInputEnd: number;
    }>;
  };
  /** Only available after both the declared input and its attributable tail close. */
  completeRotation: (DamageWindow & { inputDurationSeconds: number }) | null;
  limitations: string[];
}

/** Report input occupation separately; rotation DPS includes its verified tail window. */
export function summarizeRotationExecution(result: SimulationResult, primaryTargetId = result.enemyTargets[0]?.id): RotationExecutionSummary {
  const endTick = Math.round(result.config.duration * 60);
  const observation = measureDamageWindow(result, 0, endTick, primaryTargetId);
  const execution = result.timelineExecution;
  const timeline = result.config.timeline;
  const rows = execution?.commandResults ?? [];
  const accepted = rows.filter(row => row.status !== "rejected" && row.startFrame !== null);
  const actionCommands = new Set(result.actionLog.filter(action => action.frame < endTick).map(action => action.timelineCommandIndex));
  const missing = timeline?.commands.flatMap((command, index) => {
    const row = rows.find(candidate => candidate.commandIndex === index);
    return !row || row.status === "rejected" || row.startFrame === null || row.startFrame >= endTick ||
      (row.endFrame ?? row.startFrame) > endTick || ("abilityId" in command && !actionCommands.has(index)) ? [index] : [];
  }) ?? [];
  // Wait/pickup does not itself cancel an animation. A later accepted action can;
  // the final action otherwise occupies its declared animation to completion.
  const occupiedEndTick = execution ? Math.max(0, ...accepted.map((row, index) => {
    const nextAction = accepted.slice(index + 1).find(next => next.commandType !== "wait" && next.commandType !== "pickUpCrystallize");
    const animationEnd = row.animationEndFrame ?? row.endFrame ?? row.startFrame!;
    return row.abilityId === null ? row.endFrame ?? row.startFrame! : Math.max(row.endFrame ?? 0,
      nextAction?.startFrame === undefined || nextAction.startFrame === null ? animationEnd : Math.min(animationEnd, nextAction.startFrame));
  })) : null;
  const inputReasons: string[] = [];
  if (!execution || !timeline) inputReasons.push("旧式脚本没有逐指令占用与取消边界，不能由命中时刻推定可执行输入周期。");
  if (missing.length) inputReasons.push(`有 ${missing.length} 条指令被拒绝、未实际执行或超出观察窗口。`);
  if (occupiedEndTick !== null && occupiedEndTick > endTick) inputReasons.push("最后的实际动作占用尚未在观察窗口内完成。");
  if (timeline?.commands.length === 0) inputReasons.push("没有可核对的轮转输入指令。");
  const inputStatus = !execution || !timeline ? "unavailable" : inputReasons.length ? "partial" : "complete";

  const sourceKey = (actorId: string, actionId: string, cycle: number) => JSON.stringify([actorId, actionId, cycle]);
  const sources: RotationExecutionSummary["tailAttribution"]["sources"] = result.actionLog.filter(action => action.frame < endTick).map(action => {
    const ability = timeline?.abilities.find(candidate => candidate.id === action.sourceAbilityId);
    const legacy = result.config.rotation.find(candidate => candidate.id === action.actionId);
    const command = action.timelineCommandIndex === undefined ? undefined : timeline?.commands[action.timelineCommandIndex];
    const horizon = ability ? abilityPendingHorizonTicks(ability, result.config.weaponProcModel)
      : legacy ? actionPendingHorizonTicks(legacy, result.config.weaponProcModel)
        : command && (command.type === "dash" || command.type === "walk" || command.type === "jump") ? command.staminaCost?.consumeFrame ?? 0
          : command?.type === "swap" ? 0 : null;
    return { actorId: action.actorId, actionId: action.actionId, engineCycle: action.cycle, timelineCommandIndex: action.timelineCommandIndex ?? null,
      startTick: action.frame, declaredTailEndTick: horizon === null ? null : action.frame + horizon,
      damageEventIds: [], observedDamage: 0, primaryTargetDamage: 0, damageAfterInputEnd: 0 };
  });
  const bySource = new Map(sources.map(source => [sourceKey(source.actorId, source.actionId, source.engineCycle), source]));
  const byCommand = new Map(sources.filter(source => source.timelineCommandIndex !== null).map(source => [source.timelineCommandIndex!, source]));
  const events = new Map(result.damageEvents.map(event => [event.id, event]));
  const sourceFor = (event: SimulationResult["damageEvents"][number]): typeof sources[number] | undefined => {
    const own = (event.timelineCommandIndex === undefined ? undefined : byCommand.get(event.timelineCommandIndex)) ??
      bySource.get(sourceKey(event.sourceActorId, event.actionId, event.cycle));
    if (own) return own;
    const parent = event.parentDamageEventId === null ? undefined : events.get(event.parentDamageEventId);
    return parent ? sourceFor(parent) : undefined;
  };
  const unassignedDamageEventIds: number[] = [];
  for (const event of result.damageEvents) {
    if (event.frame >= endTick) continue;
    const source = sourceFor(event);
    if (!source) { unassignedDamageEventIds.push(event.id); continue; }
    source.damageEventIds.push(event.id);
    source.observedDamage += event.finalDamage;
    if (event.targetId === primaryTargetId) source.primaryTargetDamage += event.finalDamage;
    if (occupiedEndTick !== null && event.frame >= occupiedEndTick) source.damageAfterInputEnd += event.finalDamage;
  }
  const declaredHorizonTick = Math.max(0, ...sources.map(source => source.declaredTailEndTick ?? source.startTick),
    ...result.particleEvents.map(event => event.receiveFrame),
    ...(result.weaponProcLog ?? []).flatMap(row => row.outcome === "triggered" && row.damageFrame !== null ? [row.damageFrame] : []));
  const tailReasons: string[] = [];
  const truncatedTail = declaredHorizonTick >= endTick;
  if (truncatedTail) tailReasons.push(`已接受来源的保守尾段边界为 ${declaredHorizonTick}f，达到或超出半开观察窗口；未补算未来伤害。`);
  const dynamicReactionTail = result.reactionDamageLog.length > 0 || result.periodicReactionLog.length > 0 || result.burningStateLog.length > 0 || result.dendroCoreLog.length > 0 || result.reactionTaskLog.length > 0;
  if (dynamicReactionTail) tailReasons.push("存在动态反应或反应实体；目前没有这些来源的完整队列闭合证明，不能仅凭静态技能尾段标完整。");
  if (result.pluginManifest.length > 0) tailReasons.push("插件执行未提供可用于轮转尾段的闭合声明。");
  if (result.resolvedRuntimeOptions.execution && Object.keys(result.resolvedRuntimeOptions.execution).some(key => key.startsWith("lunar") || key.startsWith("stellar"))) tailReasons.push("专属反应执行配置的私有任务未由通用动作尾段覆盖。");
  if (sources.some(source => source.declaredTailEndTick === null)) tailReasons.push("部分已执行来源没有可核对的尾段定义。");
  if (unassignedDamageEventIds.length) tailReasons.push("部分已观察伤害无法由行动身份或父事件回溯到已接受来源。");
  if (result.mechanicsStatus !== "complete") tailReasons.push("模拟实际触及未支持机制，尾段不能标为完整。");
  const tailStatus = truncatedTail || result.mechanicsStatus !== "complete" ? "partial" : tailReasons.length ? "unknown" : "complete";
  const inputSeconds = inputStatus === "complete" && occupiedEndTick !== null && occupiedEndTick > 0 ? occupiedEndTick / 60 : null;
  // A task at the tail boundary belongs to the closed source sequence, so the
  // half-open damage window must extend through the next frame. Include all idle
  // time between accepted input and that verified closure, not only input time.
  const closureEndTick = Math.max(occupiedEndTick ?? 0, declaredHorizonTick + 1);
  return { version: "actual-input-and-source-tail-v1", requestedCycle: { ticks: result.config.cycleLength * 60, seconds: result.config.cycleLength }, observation,
    inputExecution: { scope: timeline ? "declared-legal-command-sequence" : "legacy-script", status: inputStatus,
      occupiedEndTick, executableSeconds: inputSeconds, commandCount: timeline?.commands.length ?? 0, failedOrUnobservedCommandIndices: missing,
      measurement: occupiedEndTick !== null && occupiedEndTick > 0 && occupiedEndTick <= endTick ? measureDamageWindow(result, 0, occupiedEndTick, primaryTargetId) : null,
      reasons: inputReasons },
    tailAttribution: { status: tailStatus, declaredHorizonTick, unassignedDamageEventIds, reasons: tailReasons, sources },
    completeRotation: inputSeconds !== null && tailStatus === "complete" && closureEndTick <= endTick
      ? { ...measureDamageWindow(result, 0, closureEndTick, primaryTargetId), inputDurationSeconds: inputSeconds } : null,
    limitations: ["实际输入时长按整段声明命令的占用、合法取消与最终动画完成边界计算，包含起手和中途空闲；不使用末次伤害时刻作分母。",
      "合法时间线的 engineCycle 通常均为0；展开后的全局命令索引才是来源身份，不把伤害落点所在时间段当成来源轮次。",
      "完整轮转DPS使用覆盖实际输入及已证来源尾段的半开时间窗口，包含尾段等待；不把归属总伤除以较短输入时长当作DPS。",
      "归属完整只表示这组已声明输入与已建模尾段完成，不证明冷却、能量和状态允许无限重复；开场窗口与已证稳态指标另行报告。"] };
}

export interface ErSearchOptions {
  actorId: string;
  /** Ratios: 1 = 100% ER. Only this actor's base panel ER changes. */
  minimumEr: number;
  maximumEr: number;
  step: number;
  maximumEvaluations?: number;
  safetyMargin?: number;
  runtimeOptions?: SimulationOptions;
}

export interface ErCandidate {
  energyRecharge: number;
  feasible: boolean;
  failedCommandIndices: number[];
  failureCodes: string[];
  totalDamage: number;
  reproducibilityKey: string;
  /** Actual execution evidence; no inference from static particle declarations. */
  energyEvidence: {
    requestedCostCommandIndices: number[];
    executedCostCommandIndices: number[];
    spawnedParticleEvents: number;
    receivedParticleRawEnergy: number;
    fixedEnergyRequested: number;
  };
}

export interface ErSearchResult {
  status: "feasible-on-grid" | "infeasible-within-bounds" | "er-independent-failure" | "blocked";
  method: "exhaustive-finite-grid-no-monotonicity-assumption";
  minimumFeasibleEr: number | null;
  recommendedEr: number | null;
  safetyMargin: number;
  evaluated: ErCandidate[];
  observedGridMonotonicity: "monotone" | "non-monotone" | "not-evaluated";
  scenario: { actorId: string; minimumEr: number; maximumEr: number; step: number; seed: string; durationSeconds: number; startupEnergy: string };
  limitations: string[];
  reasons: string[];
  independentFailureProof?: ErIndependentFailureProof;
}

export interface ErSearchProgress {
  completed: number;
  total: number;
  phase: "grid" | "safety-margin";
  candidate?: ErCandidate;
}
export interface ErSearchControls { onProgress?: (progress: ErSearchProgress) => void }

/**
 * Bounded exact enumeration of the supplied ER grid. Never uses binary search:
 * successful Bursts may change later gains/timing, so feasibility need not be monotone.
 * The fixed seed describes ONE stochastic scenario, not a reliability guarantee.
 */
export function solveEnergyRecharge(config: SimConfig, options: ErSearchOptions, controls: ErSearchControls = {}): ErSearchResult {
  const runtimeOptions = structuredClone(options.runtimeOptions ?? {});
  const margin = options.safetyMargin ?? 0;
  const maximumEvaluations = options.maximumEvaluations ?? 201;
  const response: ErSearchResult = {
    status: "blocked", method: "exhaustive-finite-grid-no-monotonicity-assumption",
    minimumFeasibleEr: null, recommendedEr: null, safetyMargin: margin, evaluated: [], observedGridMonotonicity: "not-evaluated",
    scenario: { actorId: options.actorId, minimumEr: options.minimumEr, maximumEr: options.maximumEr, step: options.step,
      seed: runtimeOptions.randomSeed ?? config.randomSeed, durationSeconds: config.duration, startupEnergy: runtimeOptions.energyMode ?? "configured" },
    limitations: ["只证明给定观察窗口、种子、固定配装及离散ER网格；不证明无限循环、随机失败概率或连续实数最小值。", "不会同时优化其他词条、动作或充能来源；安全裕量目标必须经实际模拟验证。"], reasons: [],
  };
  if (![options.minimumEr, options.maximumEr, options.step, margin].every(Number.isFinite) || options.minimumEr < 0 || options.maximumEr < options.minimumEr || options.step <= 0 || margin < 0 || !Number.isInteger(maximumEvaluations) || maximumEvaluations < 1 || maximumEvaluations > 1001) {
    response.reasons.push("ER边界、步长、裕量或评估上限无效（评估上限1–1001）。"); return response;
  }
  const gridCount = Math.floor((options.maximumEr - options.minimumEr) / options.step + 1e-9) + 1;
  if (gridCount > maximumEvaluations) { response.reasons.push("搜索超过有限评估上限；请缩小范围或增大步长。"); return response; }
  if (!config.characters.some((actor) => actor.id === options.actorId)) { response.reasons.push("指定角色不存在。"); return response; }
  if (!config.timeline || config.timeline.legalityMode !== "strict") { response.reasons.push("需要严格合法时间线以核对每个动作；旧脚本或自动等待不能在此宣称原轮转可行。"); return response; }
  const costAbilities = new Set(config.timeline.abilities.filter((ability) => ability.actorId === options.actorId && (ability.energyCost ?? 0) > 0).map((ability) => ability.id));
  const requestedCostCommandIndices = config.timeline.commands.flatMap((command, index) => "abilityId" in command && costAbilities.has(command.abilityId) ? [index] : []);
  if (requestedCostCommandIndices.length === 0) { response.reasons.push("该角色没有待执行的耗能动作；最小ER问题未定义。"); return response; }
  const baseline = structuredClone(config);
  let independentProof: ErIndependentFailureProof | undefined;
  let lastRun: SimulationResult | undefined;
  const applyProof = (): ErSearchResult => {
    response.status = "er-independent-failure";
    response.independentFailureProof = independentProof!;
    response.reasons.push(independentProof!.explanation);
    response.limitations[0] = "无解结论依据附带的不变量证明；实际候选仍只覆盖给定窗口、种子和离散网格，不证明无限循环或随机失败概率。";
    return response;
  };

  const evaluate = (er: number): ErCandidate => {
    const input = structuredClone(baseline);
    input.characters.find((actor) => actor.id === options.actorId)!.stats.energyRecharge = er;
    let result: SimulationResult;
    try { result = simulate(input, runtimeOptions); }
    catch (error) {
      if (error instanceof TimelineLegalityError) independentProof ??= proveAllSuccessTimelineFailure(migrateConfig(input), runtimeOptions, {
        kind: "simulation-error", energyRecharge: er, failure: structuredClone(error.failure),
      });
      throw error;
    }
    lastRun = result;
    independentProof ??= proveEnergyCapacityFailure(result, options.actorId, requestedCostCommandIndices, er, runtimeOptions);
    const failures = result.timelineExecution?.failures ?? [];
    const executedCostCommandIndices = [...new Set(result.actionLog.flatMap(action =>
      action.actorId === options.actorId && action.timelineCommandIndex !== undefined && requestedCostCommandIndices.includes(action.timelineCommandIndex)
        ? [action.timelineCommandIndex] : []))];
    const missingCostCommands = requestedCostCommandIndices.filter(index => !executedCostCommandIndices.includes(index));
    const gains = result.energyLog.filter(entry => entry.receiverId === options.actorId && entry.applied);
    return { energyRecharge: er, feasible: failures.length === 0 && result.skippedActions.length === 0 && missingCostCommands.length === 0 && result.mechanicsStatus === "complete",
      failedCommandIndices: [...new Set([...failures.map((failure) => failure.commandIndex), ...missingCostCommands])],
      failureCodes: [...new Set([...failures.map((failure) => failure.code), ...result.skippedActions.map((skip) => skip.reasonCode),
        ...(missingCostCommands.some(index => !failures.some(failure => failure.commandIndex === index)) ? ["ENERGY_REQUEST_NOT_EXECUTED"] : []),
        ...(result.mechanicsStatus === "complete" ? [] : ["MECHANICS_INCOMPLETE"])])],
      totalDamage: result.totalDamage, reproducibilityKey: result.reproducibilityKey,
      energyEvidence: { requestedCostCommandIndices: [...requestedCostCommandIndices], executedCostCommandIndices,
        spawnedParticleEvents: result.particleEvents.length,
        receivedParticleRawEnergy: gains.filter(entry => entry.kind === "particle").reduce((sum, entry) => sum + entry.rawEnergy, 0),
        fixedEnergyRequested: gains.filter(entry => entry.kind === "fixed").reduce((sum, entry) => sum + entry.finalEnergy, 0) } };
  };
  const progress = (total: number, phase: ErSearchProgress["phase"], candidate?: ErCandidate): void => {
    try {
      controls.onProgress?.({ completed: response.evaluated.length, total, phase,
        ...(candidate ? { candidate: structuredClone(candidate) } : {}) });
    } catch {
      // A renderer/progress observer is not part of the numerical scenario.
      if (!response.limitations.includes("进度接收器抛出异常；数值求解继续，不改变场景或候选值。")) response.limitations.push("进度接收器抛出异常；数值求解继续，不改变场景或候选值。");
    }
  };
  progress(gridCount, "grid");
  try {
    for (let index = 0; index < gridCount; index += 1) {
      const candidate = evaluate(Number((options.minimumEr + index * options.step).toFixed(12)));
      response.evaluated.push(candidate);
      progress(gridCount, "grid", candidate);
    }
  } catch (error) {
    if (independentProof) return applyProof();
    response.reasons.push(`模拟拒绝该场景：${error instanceof Error ? error.message : String(error)}`); return response;
  }
  let passed = false;
  let monotone = true;
  for (const candidate of response.evaluated) { if (passed && !candidate.feasible) monotone = false; passed ||= candidate.feasible; }
  response.observedGridMonotonicity = monotone ? "monotone" : "non-monotone";
  const feasible = response.evaluated.find((candidate) => candidate.feasible);
  if (!feasible) {
    if (!independentProof && lastRun) independentProof = proveAllSuccessTimelineFailure(lastRun.config, runtimeOptions, {
      kind: "candidate-result", energyRecharge: response.evaluated.at(-1)!.energyRecharge, reproducibilityKey: lastRun.reproducibilityKey,
    });
    if (independentProof) return applyProof();
    response.status = "infeasible-within-bounds";
    response.reasons.push("实际运行的网格内无可行值；这不证明更高ER也不可行，请检查失败动作和到球时序。");
    if (response.evaluated.every(candidate => candidate.energyEvidence.spawnedParticleEvents === 0)) {
      response.reasons.push("这些候选的真实执行均未产出粒子或晶球；固定回能不乘ER。此观察只限于本次种子、动作路径与观察窗口，不据静态定义断言任何ER均无解。");
    } else if (response.evaluated.every(candidate => candidate.energyEvidence.receivedParticleRawEnergy === 0)) {
      response.reasons.push("已实际产球，但待求角色在观察窗口内未收到可由ER放大的粒子能量；请检查到球时序与接收对象。");
    }
    return response;
  }
  response.status = "feasible-on-grid";
  response.minimumFeasibleEr = feasible.energyRecharge;
  response.recommendedEr = feasible.energyRecharge;
  if (margin > 0) {
    const safetyEr = Number((feasible.energyRecharge + margin).toFixed(12));
    if (safetyEr > options.maximumEr + 1e-9) {
      response.recommendedEr = null;
      response.reasons.push("加上裕量后超出搜索边界，未将其宣称为已验证推荐值。");
    } else {
      response.recommendedEr = null;
      let safety = response.evaluated.find((candidate) => Math.abs(candidate.energyRecharge - safetyEr) < 1e-12);
      if (!safety && response.evaluated.length >= maximumEvaluations) {
        response.reasons.push("网格已用完评估上限，未验证网格外的安全裕量；保留网格最小值，不给出推荐值。");
      } else {
        try {
          if (!safety) { safety = evaluate(safetyEr); response.evaluated.push(safety); progress(response.evaluated.length, "safety-margin", safety); }
          response.recommendedEr = safety.feasible ? safetyEr : null;
          if (!safety.feasible) response.reasons.push("加上安全裕量的实际重跑失败；该场景不能用单调性推断。");
        } catch (error) {
          response.reasons.push(`安全裕量模拟被拒绝，未给出推荐值；已验证的网格最小值保留：${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }
  return response;
}

export const STEADY_STATE_DIMENSIONS = ["energy", "cooldownsAndCharges", "buffsAndDebuffs", "entities", "auras", "resourcesAndHp", "icdAndTriggerHistory", "pendingEvents", "activeCharacterAndActionPhase"] as const;
export type SteadyStateDimension = typeof STEADY_STATE_DIMENSIONS[number];
export type PhaseAlignedState = Record<SteadyStateDimension, unknown>;
export interface PhaseCheckpoint { tick: number; cumulativeDamage: number; state: PhaseAlignedState }
export interface SteadyStateEvaluation {
  status: "established-for-supplied-checkpoints" | "established-from-simulation" | "not-established";
  periodCycles: number | null;
  steadyStateDps: number | null;
  reasons: string[];
  policy: { cycleTicks: number; absoluteTolerance: number; confirmationPeriods: number; maximumPeriodCycles: number; maximumWarmupCycles: number };
}

function closeJson(left: unknown, right: unknown, tolerance: number): boolean {
  if (typeof left === "number" && typeof right === "number") return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => closeJson(value, right[index], tolerance));
  if (left !== null && right !== null && typeof left === "object" && typeof right === "object") {
    const a = left as Record<string, unknown>; const b = right as Record<string, unknown>;
    const keys = Object.keys(a).sort();
    return canonicalStringify(keys) === canonicalStringify(Object.keys(b).sort()) && keys.every((key) => closeJson(a[key], b[key], tolerance));
  }
  return left === right;
}

/** Caller must supply complete boundary state with timers relative to each tick. */
export function evaluatePhaseAlignedSteadyState(input: {
  checkpoints: readonly PhaseCheckpoint[];
  cycleTicks: number;
  deterministic: boolean;
  checkpointProducer: string;
  absoluteTolerance?: number;
  confirmationPeriods?: number;
  maximumPeriodCycles?: number;
  maximumWarmupCycles?: number;
}): SteadyStateEvaluation {
  const policy = { cycleTicks: input.cycleTicks, absoluteTolerance: input.absoluteTolerance ?? 1e-8,
    confirmationPeriods: input.confirmationPeriods ?? 3, maximumPeriodCycles: input.maximumPeriodCycles ?? 4,
    maximumWarmupCycles: input.maximumWarmupCycles ?? 100 };
  const failed = (reason: string): SteadyStateEvaluation => ({ status: "not-established", periodCycles: null, steadyStateDps: null, reasons: [reason], policy });
  if (![policy.cycleTicks, policy.confirmationPeriods, policy.maximumPeriodCycles, policy.maximumWarmupCycles].every((n) => Number.isSafeInteger(n) && n > 0) || policy.confirmationPeriods < 2 || policy.confirmationPeriods > 100 || policy.maximumPeriodCycles > 1000 || policy.maximumWarmupCycles > 10_000 || !Number.isFinite(policy.absoluteTolerance) || policy.absoluteTolerance < 0) return failed("稳态比较参数无效；确认次数2–100、周期搜索上限1000、预热上限10000。");
  if (!input.deterministic) return failed("随机状态已捕获不等于分布收敛；请使用随机起步诊断，不能用确定性逐周期相等认定随机稳态。");
  if (!input.checkpointProducer.trim()) return failed("缺少检查点生产者版本，不能审核状态完整性。");
  const checkpoints = input.checkpoints.slice(0, policy.maximumWarmupCycles + 1);
  if (checkpoints.length < policy.confirmationPeriods + 2) return failed("在有限预热上限内没有足够的相位对齐检查点。");
  for (const [index, checkpoint] of checkpoints.entries()) {
    if (!Number.isInteger(checkpoint.tick) || checkpoint.tick < 0 || !Number.isFinite(checkpoint.cumulativeDamage) || checkpoint.cumulativeDamage < 0 || (index > 0 && checkpoint.tick !== checkpoints[index - 1]!.tick + policy.cycleTicks)) return failed("检查点不在连续同相位周期边界，或累计伤害无效。");
    if (index > 0 && checkpoint.cumulativeDamage < checkpoints[index - 1]!.cumulativeDamage) return failed("累计伤害不能在检查点间下降。");
    if (!checkpoint.state || STEADY_STATE_DIMENSIONS.some((dimension) => !Object.hasOwn(checkpoint.state, dimension) || checkpoint.state[dimension] === undefined || checkpoint.state[dimension] === null)) return failed("缺少完整状态维度；不得用缺失的冷却、实体、附着、资源、ICD或待执行事件推断收敛。");
    try { canonicalStringify(checkpoint.state); } catch { return failed("检查点包含非有限数、循环引用或非JSON状态。"); }
  }
  const end = checkpoints.length - 1;
  for (let period = 1; period <= policy.maximumPeriodCycles; period += 1) {
    const start = end - (policy.confirmationPeriods + 1) * period;
    if (start < 0) continue;
    let matches = true;
    for (let index = start + period; index <= end; index += 1) {
      if (!closeJson(checkpoints[index]!.state, checkpoints[index - period]!.state, policy.absoluteTolerance)) { matches = false; break; }
    }
    const lastDamage = checkpoints[end]!.cumulativeDamage - checkpoints[end - period]!.cumulativeDamage;
    for (let repeat = 1; matches && repeat <= policy.confirmationPeriods; repeat += 1) {
      const right = end - repeat * period;
      const damage = checkpoints[right]!.cumulativeDamage - checkpoints[right - period]!.cumulativeDamage;
      if (Math.abs(damage - lastDamage) > policy.absoluteTolerance) matches = false;
    }
    if (matches) return { status: "established-for-supplied-checkpoints", periodCycles: period,
      steadyStateDps: lastDamage / (period * policy.cycleTicks / 60), reasons: ["仅对调用方提供的完整相位相对状态成立；不补造引擎未导出的检查点。"], policy };
  }
  return failed("有限预热和多周期搜索范围内，完整状态或周期伤害尚未收敛。");
}

export interface SteadyStatePolicy {
  absoluteTolerance?: number;
  confirmationPeriods?: number;
  maximumPeriodCycles?: number;
  maximumWarmupCycles?: number;
}

/** Consumes the engine's actual pre-event checkpoints; no log-only reconstruction. */
export function evaluateSimulationSteadyState(result: SimulationResult, requestedPolicy: SteadyStatePolicy = {}): SteadyStateEvaluation {
  const policy = { cycleTicks: Math.round(result.config.cycleLength * 60), absoluteTolerance: requestedPolicy.absoluteTolerance ?? 1e-8,
    confirmationPeriods: requestedPolicy.confirmationPeriods ?? 3, maximumPeriodCycles: requestedPolicy.maximumPeriodCycles ?? 4,
    maximumWarmupCycles: requestedPolicy.maximumWarmupCycles ?? 100 };
  const audit = result.executionAudit;
  const unavailable: SteadyStateEvaluation = {
    status: "not-established", periodCycles: null, steadyStateDps: null,
    reasons: [
      "本次结果未请求或未导出完整同相位执行检查点。",
      "energyCurve、auraEndStates、循环计数及相近DPS均不能单独建立稳态；未重置或伪造这些状态。",
    ], policy,
  };
  if (!audit) return unavailable;
  if (!audit.checkpointCoverage.complete || audit.checkpointCoverage.missingDimensions.length > 0) {
    return { ...unavailable, reasons: [...audit.checkpointCoverage.reasons,
      `检查点未覆盖的状态：${audit.checkpointCoverage.missingDimensions.join("、") || "引擎标记不完整"}。`] };
  }
  if (audit.phaseCheckpoints.length === 0) return unavailable;
  if (result.mechanicsStatus !== "complete") return { ...unavailable, reasons: ["本次模拟存在机制截断；不据此建立稳态。"] };
  const stochasticParticles = [...result.config.rotation.flatMap((action) => action.particles ?? []), ...(result.config.timeline?.abilities ?? []).flatMap((ability) => ability.particles ?? [])]
    .some((particle) => typeof particle.count !== "number" || particle.trigger?.probability !== undefined);
  const deterministic = audit.criticalSampling === null && !stochasticParticles && !hasRandomWeaponProc(result.config.weaponProcModel) && !result.config.artifactDamageModel?.actors.some(actor => actor.effectId === "echoes-4pc") && result.config.normalHitEnergyModel === undefined && result.config.favoniusModel === undefined && result.config.sacrificialModel === undefined && result.crystallizeShardLog.length === 0 && result.dendroCoreLog.length === 0;
  const evaluated = evaluatePhaseAlignedSteadyState({ checkpoints: audit.phaseCheckpoints, ...policy, deterministic,
    checkpointProducer: `${result.engineVersion}/${audit.version}` });
  if (evaluated.status === "not-established") return evaluated;
  return { ...evaluated, status: "established-from-simulation", reasons: [
    "已比较同一次连续模拟导出的完整相位边界状态及周期伤害；未在循环边界重置能量、冷却、增益或待执行事件。",
    ...audit.checkpointCoverage.reasons,
  ] };
}

export type SimulationStartupPolicy =
  | { mode: "full" | "zero" | "configured" }
  | { mode: "custom"; energyByCharacter: Record<string, number> }
  | ({ mode: "steady-state"; warmupEnergyMode?: "full" | "zero" | "configured" } & SteadyStatePolicy);

export interface SimulationStartupResult {
  status: "completed" | "steady-state-established" | "steady-state-not-established" | "blocked";
  result: SimulationResult | null;
  measurement: DamageWindow | null;
  steadyState: SteadyStateEvaluation | null;
  startup: {
    policy: SimulationStartupPolicy;
    warmupTicks: number;
    observationTicks: number;
    measurementStartTick: number;
    measurementEndTick: number;
    simulationTicks: number;
    energyAtMeasurementStart: Record<string, number> | null;
    /** Export these as startup actions, never hide them under the measured window. */
    startupActionCount: number;
  };
  reasons: string[];
}

/** Repeat one reference request template; later runs retain their own live state. */
export function repeatLegalTimelineForDuration(input: SimConfig, durationSeconds: number, runtimeOptions: SimulationOptions = {}): SimConfig {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 600 || Math.abs(durationSeconds * 60 - Math.round(durationSeconds * 60)) > 1e-8 || !Number.isFinite(input.cycleLength) || input.cycleLength <= 0) throw new Error("重复观察时长需为1–600秒内的整帧时间，周期必须为正数。");
  if (!input.timeline) return { ...structuredClone(input), duration: durationSeconds };
  // Delayed SetCD and shared serial charges require actual accepted actions;
  // weapon resets also depend on prior hits. Resolve this reference only once.
  const execution = getRuntimeSkillCooldownActors(input).size > 0 ? simulate(input, runtimeOptions).timelineExecution! : compileLegalTimeline(input).execution;
  const cycleTicks = Math.round(input.cycleLength * 60);
  const totalTicks = Math.round(durationSeconds * 60);
  if (execution.failures.some(failure => failure.code !== "INSUFFICIENT_ENERGY")) throw new Error("原循环存在失败指令，不能把它声明为合法重复模板。");
  if (execution.totalFrames > cycleTicks) throw new Error("实际动作序列长于声明的轮转周期；请先修改周期或序列。");
  if (execution.finalActiveCharacterId !== input.timeline.initialActiveCharacterId) throw new Error("循环末前台角色与下一循环开头不一致；需要显式换人动作，不能在边界偷偷重置。");
  const commandResults = new Map(execution.commandResults.map((command) => [command.commandIndex, command]));
  const config = structuredClone(input);
  config.duration = durationSeconds;
  const commands: NonNullable<SimConfig["timeline"]>["commands"] = [];
  const cycles = Math.ceil(totalTicks / cycleTicks);
  if (cycles * (input.timeline.commands.length + 1) > 10_000) throw new Error("重复指令超过10000项有限上限。");
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    const offset = cycle * cycleTicks;
    for (const [index, command] of input.timeline.commands.entries()) {
      const original = commandResults.get(index);
      if (original?.startFrame === null || original?.startFrame === undefined) throw new Error(`指令${index}没有可重复的合法起点。`);
      const atFrame = offset + original.startFrame;
      if (atFrame >= totalTicks) break;
      commands.push(command.type === "wait"
        ? { type: "wait", frames: Math.min(command.frames, totalTicks - atFrame) }
        : { ...structuredClone(command), atFrame });
    }
    const idleFrames = Math.min(cycleTicks - execution.totalFrames, totalTicks - offset - execution.totalFrames);
    if (idleFrames > 0) commands.push({ type: "wait", frames: idleFrames });
  }
  config.timeline!.commands = commands;
  return config;
}

/**
 * Steady startup is a measurement after bounded warmup within ONE continuous run.
 * It never restores only energy into a fresh simulator or fabricates other state.
 */
export function simulateWithStartup(config: SimConfig, startupPolicy: SimulationStartupPolicy, runtimeOptions: SimulationOptions = {}): SimulationStartupResult {
  const observationTicks = Math.round(config.duration * 60);
  const answer: SimulationStartupResult = { status: "blocked", result: null, measurement: null, steadyState: null,
    startup: { policy: structuredClone(startupPolicy), warmupTicks: 0, observationTicks, measurementStartTick: 0,
      measurementEndTick: observationTicks, simulationTicks: observationTicks, energyAtMeasurementStart: null, startupActionCount: 0 }, reasons: [] };
  try {
    if (Math.abs(config.duration * 60 - observationTicks) > 1e-8) throw new Error("观察窗口必须落在60 FPS整帧边界。");
    let input = structuredClone(config);
    let options = { ...runtimeOptions };
    if (startupPolicy.mode === "custom") {
      const ids = new Set(config.characters.map((character) => character.id));
      if (Object.keys(startupPolicy.energyByCharacter).length !== ids.size || Object.keys(startupPolicy.energyByCharacter).some((id) => !ids.has(id))) throw new Error("自定义起始能量必须精确列出每名角色，不能缺省或加入未知角色。");
      for (const character of input.characters) {
        const energy = startupPolicy.energyByCharacter[character.id];
        if (energy === undefined || !Number.isFinite(energy) || energy < 0 || energy > character.energyMax) throw new Error(`${character.id}的自定义能量必须在0至角色上限内。`);
        character.initialEnergy = energy;
      }
      options.energyMode = "configured";
    } else if (startupPolicy.mode === "steady-state") {
      const cycleTicks = Math.round(config.cycleLength * 60);
      if (Math.abs(config.cycleLength * 60 - cycleTicks) > 1e-8 || cycleTicks <= 0) throw new Error("稳态周期必须落在60 FPS整帧边界。");
      if (!Number.isInteger(startupPolicy.confirmationPeriods ?? 3) || (startupPolicy.confirmationPeriods ?? 3) < 2 || (startupPolicy.confirmationPeriods ?? 3) > 100 ||
          !Number.isInteger(startupPolicy.maximumPeriodCycles ?? 4) || (startupPolicy.maximumPeriodCycles ?? 4) < 1 || (startupPolicy.maximumPeriodCycles ?? 4) > 1000 ||
          !Number.isFinite(startupPolicy.absoluteTolerance ?? 1e-8) || (startupPolicy.absoluteTolerance ?? 1e-8) < 0) throw new Error("稳态确认次数、周期搜索上限或数值容差无效。");
      // The last warmup checkpoint needs two full future cycles for auditing the
      // repeated driver. Extra tail is outside the requested observation window.
      const rotationDelayTicks = Math.max(0, ...config.rotation.map(action => actionPendingHorizonTicks(action, config.weaponProcModel)));
      const runtimeCooldownActors = getRuntimeSkillCooldownActors(config);
      const abilityDelayTicks = Math.max(0, ...(config.timeline?.abilities ?? []).map(ability => Math.max(
        abilityPendingHorizonTicks(ability, config.weaponProcModel),
        ability.kind === "skill" && runtimeCooldownActors.has(ability.actorId) ? ability.cooldownStartFrame ?? 0 : 0)));
      const movementStaminaDelayTicks = Math.max(0, ...(config.timeline?.commands ?? []).map(command =>
        command.type === "walk" || command.type === "dash" || command.type === "jump" ? command.staminaCost?.consumeFrame ?? 0 : 0));
      const tailTicks = Math.max(observationTicks, 2 * cycleTicks, rotationDelayTicks, abilityDelayTicks, movementStaminaDelayTicks);
      const maxAllowedCycles = Math.floor((600 * 60 - tailTicks) / cycleTicks);
      const warmupCycles = startupPolicy.maximumWarmupCycles ?? Math.min(20, maxAllowedCycles);
      if (!Number.isInteger(warmupCycles) || warmupCycles < 1 || warmupCycles > maxAllowedCycles) throw new Error("预热周期需为正整数，且预热加完整观察尾段不能超过现有600秒模拟上限。");
      const warmupTicks = warmupCycles * cycleTicks;
      const simulationTicks = warmupTicks + tailTicks;
      answer.startup = { ...answer.startup, warmupTicks, measurementStartTick: warmupTicks,
        measurementEndTick: warmupTicks + observationTicks, simulationTicks };
      options.energyMode = startupPolicy.warmupEnergyMode ?? "zero";
      input = repeatLegalTimelineForDuration(input, simulationTicks / 60, options);
      // Only the final convergence interval is sampled. Earlier warmup is real
      // executed state, but a transient/nonperiodic startup queue must not poison
      // complete later checkpoints. Select the largest period that can actually
      // be confirmed within the requested finite warmup.
      const confirmations = startupPolicy.confirmationPeriods ?? 3;
      const requestedPeriods = startupPolicy.maximumPeriodCycles ?? 4;
      const testablePeriod = Math.max(1, Math.min(requestedPeriods, Math.floor((warmupCycles - 1) / (confirmations + 1))));
      const checkpointCount = Math.min(warmupCycles, (confirmations + 1) * testablePeriod + 1);
      const firstCheckpointCycle = warmupCycles - checkpointCount + 1;
      options = { ...options,
        execution: { ...options.execution, checkpointFrames: Array.from({ length: checkpointCount }, (_, index) => (firstCheckpointCycle + index) * cycleTicks) } };
    } else {
      options.energyMode = startupPolicy.mode;
    }
    const result = simulate(input, options);
    answer.result = result;
    answer.measurement = measureDamageWindow(result, answer.startup.measurementStartTick, answer.startup.measurementEndTick);
    answer.startup.startupActionCount = result.actionLog.filter((action) => action.frame < answer.startup.measurementStartTick).length;
    const energyPoint = result.energyCurve.filter((point) => point.frame < answer.startup.measurementStartTick ||
      (answer.startup.measurementStartTick === 0 && point.kind === "initial")).at(-1);
    answer.startup.energyAtMeasurementStart = energyPoint ? { ...energyPoint.energyByCharacter } : Object.fromEntries(Object.entries(result.energyStats).map(([id, stats]) => [id, stats.initial]));
    if (startupPolicy.mode === "steady-state") {
      answer.steadyState = evaluateSimulationSteadyState(result, { ...startupPolicy,
        maximumWarmupCycles: answer.startup.warmupTicks / Math.round(config.cycleLength * 60) });
      answer.status = answer.steadyState.status === "established-from-simulation" ? "steady-state-established" : "steady-state-not-established";
      answer.reasons = [...answer.steadyState.reasons];
      if (answer.status === "steady-state-not-established") answer.reasons.push("仍可检查这段明确预热后的窗口伤害；该值不能标成稳态DPS。");
    } else answer.status = "completed";
    const observedFailures = result.skippedActions.filter((action) => action.frame >= answer.startup.measurementStartTick && action.frame < answer.startup.measurementEndTick).length;
    if (observedFailures > 0) answer.reasons.push(`观测窗口仍有${observedFailures}次耗能动作失败；周期状态相等不代表请求的轮转全部可执行。`);
    return answer;
  } catch (error) {
    answer.reasons.push(error instanceof Error ? error.message : String(error));
    return answer;
  }
}
