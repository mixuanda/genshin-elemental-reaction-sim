import { FAVONIUS_PROFILE } from "./favonius";
import { createVersionedContentHash, getRuntimeSkillCooldownActors, type SimConfig, type SimulationOptions, type SimulationResult } from "@genshin-dps-lab/schemas";
import { measureDamageWindow, repeatLegalTimelineForDuration, simulateWithStartup } from "./simulation-analysis";
import { NORMAL_HIT_ENERGY_PROFILE } from "./normal-hit-energy";
import { SACRIFICIAL_PROFILE } from "./sacrificial";
import { hasRandomWeaponProc, WEAPON_PROC_RANDOM_PROFILE } from "./weapon-proc";
import { assertSimulationAnalysisSupported } from "./simulation-analysis-capability";

export interface StochasticStartupPolicy {
  /** Independent seed pairs; default 8, bounded to 2..32. */
  sampleCount?: number;
  /** W in complete configured cycles; compare W and 2W, default 5. */
  warmupCycles?: number;
}
export interface StochasticStartupProgress {
  completed: number;
  total: number;
  seedIndex: number | null;
  initialEnergy: "zero" | "full" | null;
}
export interface StochasticStartupControls {
  onProgress?: (progress: StochasticStartupProgress) => void;
  /** Checked between runs. A dedicated worker may be terminated during a run. */
  shouldCancel?: () => boolean;
}
export interface StochasticDistribution {
  count: number;
  mean: number;
  sampleStandardDeviation: number | null;
  spreadPercentiles: { p05: number; p50: number; p95: number };
  meanConfidenceInterval: {
    method: "student-t-95-approximation";
    degreesOfFreedom: number;
    criticalValue: number;
    low: number;
    high: number;
  } | null;
}
export interface StochasticActorWindow {
  startEnergy: number;
  endEnergy: number;
  energyCostAttempts: number;
  energyCostFailures: number;
  /** Subset of rejected positive-cost requests caused by insufficient energy. */
  insufficientEnergyFailures: number;
  /** Null means no positive-energy-cost request in this observation window. */
  energyCostFailureRate: number | null;
}
export type StochasticStartupCellId = "zero-w" | "zero-2w" | "full-w" | "full-2w";
export interface StochasticWindowSample {
  cellId: StochasticStartupCellId;
  startTick: number;
  endTick: number;
  damage: number;
  dps: number;
  actors: Record<string, StochasticActorWindow>;
}
export interface StochasticMetricDistributions {
  damage: StochasticDistribution;
  dps: StochasticDistribution;
  actors: Record<string, {
    startEnergy: StochasticDistribution;
    endEnergy: StochasticDistribution;
    energyCostAttempts: StochasticDistribution;
    energyCostFailures: StochasticDistribution;
    insufficientEnergyFailures: StochasticDistribution;
    energyCostFailureRate: StochasticDistribution | null;
  }>;
}
export interface StochasticStartupRun {
  seedIndex: number;
  seed: string;
  initialEnergy: "zero" | "full";
  runManifest: SimulationResult["runManifest"];
  windows: [StochasticWindowSample, StochasticWindowSample];
}
export interface StochasticStartupContrast {
  id: "zero-2w-minus-w" | "full-2w-minus-w" | "w-full-minus-zero" | "2w-full-minus-zero";
  minuend: StochasticStartupCellId;
  subtrahend: StochasticStartupCellId;
  /** One difference per independent seed, calculated before the summary. */
  pairedSamples: Array<{ seedIndex: number; seed: string; damage: number; dps: number; actors: Record<string, StochasticActorWindow> }>;
  metrics: StochasticMetricDistributions;
}
export interface StochasticStartupResult {
  schemaVersion: "stochastic-startup-v1";
  status: "completed-diagnostic";
  config: SimConfig;
  inputConfigHash: string;
  requestedRuntimeOptions: SimulationOptions;
  policy: {
    sampleCount: number;
    warmupCycles: number;
    cycleTicks: number;
    observationTicks: number;
    warmupTicks: number;
    simulationTicks: number;
    windowPolicy: "half-open-[startTick,endTick)";
    boundaryEnergyPolicy: "before-all-events-at-boundary";
  };
  randomness: {
    baseSeed: string;
    seeds: string[];
    seedPolicy: "base-seed:stochastic-startup-v1:index";
    rngAlgorithm: "fnv1a32-mulberry32-v1";
    criticalPolicy: string;
    normalHitEnergyPolicy: typeof NORMAL_HIT_ENERGY_PROFILE | null;
    favoniusPolicy: typeof FAVONIUS_PROFILE | null;
    sacrificialPolicy: typeof SACRIFICIAL_PROFILE | null;
    /** Present only when the configured weapon callbacks consume this stream. */
    weaponProcPolicy?: typeof WEAPON_PROC_RANDOM_PROFILE;
    requestTemplate: {
      mode: "structural-v1" | "runtime-cooldown-v1";
      referenceSeed: string | null;
      requestedRuntimeOptions: SimulationOptions | null;
      repeatedConfigHash: string;
    };
    criticalTriggeredEffects: "only-explicitly-implemented-effects";
  };
  cells: Array<{ id: StochasticStartupCellId; metrics: StochasticMetricDistributions }>;
  contrasts: StochasticStartupContrast[];
  runs: StochasticStartupRun[];
  /** First seed, zero start, complete long run; other runs retain numeric samples and identities. */
  representativeResult: SimulationResult;
  limitations: string[];
}

// Two-sided 95% t critical values, df 1..31, at the source's three-decimal precision.
// https://www.itl.nist.gov/div898/handbook/eda/section3/eda3672.htm
// This interval estimates a mean; it is not a sample-spread or stationarity test.
const T975 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306,
  2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101,
  2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048,
  2.045, 2.042, 2.040] as const;

/** Linear-interpolated empirical percentiles; t interval uses between-seed variance. */
export function summarizeStochasticValues(values: readonly number[]): StochasticDistribution | null {
  if (!values.length) return null;
  if (values.length > 32 || values.some((value) => !Number.isFinite(value))) throw new Error("统计样本必须为最多32个有限数。");
  const count = values.length;
  const mean = values.reduce((sum, value) => sum + value, 0) / count;
  const sampleStandardDeviation = count > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (count - 1)) : null;
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p: number) => {
    const index = (count - 1) * p;
    return sorted[Math.floor(index)]! + (sorted[Math.ceil(index)]! - sorted[Math.floor(index)]!) * (index - Math.floor(index));
  };
  const criticalValue = count > 1 ? T975[count - 2]! : null;
  const halfWidth = criticalValue === null ? null : criticalValue * sampleStandardDeviation! / Math.sqrt(count);
  return { count, mean, sampleStandardDeviation,
    spreadPercentiles: { p05: percentile(0.05), p50: percentile(0.5), p95: percentile(0.95) },
    meanConfidenceInterval: halfWidth === null ? null : { method: "student-t-95-approximation", degreesOfFreedom: count - 1,
      criticalValue: criticalValue!, low: mean - halfWidth, high: mean + halfWidth } };
}

function metricDistributions(samples: readonly Pick<StochasticWindowSample, "damage" | "dps" | "actors">[], actorIds: readonly string[]): StochasticMetricDistributions {
  return { damage: summarizeStochasticValues(samples.map((sample) => sample.damage))!,
    dps: summarizeStochasticValues(samples.map((sample) => sample.dps))!,
    actors: Object.fromEntries(actorIds.map((actorId) => {
      const actors = samples.map((sample) => sample.actors[actorId]!);
      return [actorId, {
        startEnergy: summarizeStochasticValues(actors.map((actor) => actor.startEnergy))!,
        endEnergy: summarizeStochasticValues(actors.map((actor) => actor.endEnergy))!,
        energyCostAttempts: summarizeStochasticValues(actors.map((actor) => actor.energyCostAttempts))!,
        energyCostFailures: summarizeStochasticValues(actors.map((actor) => actor.energyCostFailures))!,
        insufficientEnergyFailures: summarizeStochasticValues(actors.map((actor) => actor.insufficientEnergyFailures))!,
        energyCostFailureRate: summarizeStochasticValues(actors.flatMap((actor) => actor.energyCostFailureRate === null ? [] : [actor.energyCostFailureRate])),
      }];
    })) };
}

function sampleWindow(result: SimulationResult, initialEnergy: "zero" | "full", multiplier: 1 | 2, warmupTicks: number, observationTicks: number): StochasticWindowSample {
  const startTick = multiplier * warmupTicks;
  const endTick = startTick + observationTicks;
  const damage = measureDamageWindow(result, startTick, endTick);
  const energyAt = (tick: number): Record<string, number> => result.energyCurve.filter((entry) => entry.frame < tick).at(-1)?.energyByCharacter
    ?? Object.fromEntries(Object.entries(result.energyStats).map(([actorId, summary]) => [actorId, summary.initial]));
  const startEnergy = energyAt(startTick);
  const endEnergy = energyAt(endTick);
  const costActionIds = new Set(result.config.rotation.filter((action) => (action.energyCost ?? 0) > 0).map((action) => action.id));
  const costAbilityIds = new Set((result.config.timeline?.abilities ?? []).filter((ability) => (ability.energyCost ?? 0) > 0).map((ability) => ability.id));
  const inWindow = (frame: number) => frame >= startTick && frame < endTick;
  return { cellId: `${initialEnergy}-${multiplier === 1 ? "w" : "2w"}`, startTick, endTick, damage: damage.totalDamage, dps: damage.dps,
    actors: Object.fromEntries(result.config.characters.map((actor) => {
      const accepted = result.actionLog.filter((entry) => entry.actorId === actor.id && inWindow(entry.frame) &&
        (costActionIds.has(entry.actionId) || entry.sourceAbilityId !== undefined && costAbilityIds.has(entry.sourceAbilityId))).length;
      const energyFailures = result.skippedActions.filter((entry) => entry.actorId === actor.id && inWindow(entry.frame) && entry.energyCost > 0);
      const commandResults = result.timelineExecution?.commandResults ?? [];
      // Runtime energy rejections occur in both ledgers; count each request once.
      // Non-energy legality rejections still make a positive-cost request fail.
      const otherFailures = (result.timelineExecution?.failures ?? []).filter((failure) => {
        if (failure.code === "INSUFFICIENT_ENERGY" || !inWindow(failure.frame)) return false;
        const command = commandResults.find((entry) => entry.commandIndex === failure.commandIndex);
        return command?.actorId === actor.id && command.abilityId !== null && costAbilityIds.has(command.abilityId);
      });
      const failed = energyFailures.length + otherFailures.length;
      const attempts = accepted + failed;
      return [actor.id, { startEnergy: startEnergy[actor.id]!, endEnergy: endEnergy[actor.id]!, energyCostAttempts: attempts,
        energyCostFailures: failed, insufficientEnergyFailures: energyFailures.length,
        energyCostFailureRate: attempts === 0 ? null : failed / attempts }];
    })) };
}

/**
 * Finite startup-sensitivity diagnostic. Each seed/start owns ONE continuous
 * simulation; both windows are measured on that trajectory without state resets.
 */
export function analyzeStochasticStartup(config: SimConfig, policy: StochasticStartupPolicy = {}, options: SimulationOptions = {}, controls: StochasticStartupControls = {}): StochasticStartupResult {
  const sampleCount = policy.sampleCount ?? 8;
  const warmupCycles = policy.warmupCycles ?? 5;
  const cycleTicks = Math.round(config.cycleLength * 60);
  const observationTicks = Math.round(config.duration * 60);
  if (!Number.isInteger(sampleCount) || sampleCount < 2 || sampleCount > 32) throw new Error("随机起步诊断需要2至32组独立种子。");
  if (!Number.isInteger(warmupCycles) || warmupCycles < 1 || !Number.isSafeInteger(cycleTicks) || cycleTicks <= 0 ||
      Math.abs(config.cycleLength * 60 - cycleTicks) > 1e-8 || !Number.isSafeInteger(observationTicks) || observationTicks <= 0 || Math.abs(config.duration * 60 - observationTicks) > 1e-8) {
    throw new Error("预热需要正整数周期，周期和观察窗口必须位于60 FPS整帧边界。");
  }
  const warmupTicks = warmupCycles * cycleTicks;
  const simulationTicks = 2 * warmupTicks + observationTicks;
  if (simulationTicks > 600 * 60) throw new Error("2W预热加观察窗口不能超过每次连续模拟600秒上限。");
  const cancel = () => {
    if (controls.shouldCancel?.()) { const error = new Error("随机起步诊断已取消。"); error.name = "AbortError"; throw error; }
  };
  cancel();
  assertSimulationAnalysisSupported(config);
  const baseSeed = options.randomSeed ?? config.randomSeed;
  const randomWeaponProcs = hasRandomWeaponProc(config.weaponProcModel);
  const runtimeCooldownTemplate = getRuntimeSkillCooldownActors(config).size > 0;
  const input = repeatLegalTimelineForDuration(config, simulationTicks / 60, options);
  const seeds = Array.from({ length: sampleCount }, (_, index) => `${baseSeed}:stochastic-startup-v1:${index}`);
  const actorIds = config.characters.map((actor) => actor.id);
  const runs: StochasticStartupRun[] = [];
  let representativeResult: SimulationResult | undefined;
  controls.onProgress?.({ completed: 0, total: 2 * sampleCount, seedIndex: null, initialEnergy: null });
  for (const [seedIndex, seed] of seeds.entries()) {
    for (const initialEnergy of ["zero", "full"] as const) {
      cancel();
      const representative = seedIndex === 0 && initialEnergy === "zero";
      const startup = simulateWithStartup(input, { mode: initialEnergy }, { ...options, randomSeed: seed,
        execution: { ...options.execution, captureHits: representative, detailedTraces: representative } });
      if (startup.result === null || startup.status !== "completed") throw new Error(startup.reasons.join("；") || "连续模拟未完成。");
      const result = startup.result;
      if (result.mechanicsStatus !== "complete") throw new Error("连续模拟触及未支持机制，不能把部分伤害汇总为完整随机起步诊断。");
      representativeResult ??= result;
      runs.push({ seedIndex, seed, initialEnergy, runManifest: result.runManifest,
        windows: [sampleWindow(result, initialEnergy, 1, warmupTicks, observationTicks), sampleWindow(result, initialEnergy, 2, warmupTicks, observationTicks)] });
      controls.onProgress?.({ completed: runs.length, total: 2 * sampleCount, seedIndex, initialEnergy });
    }
  }
  cancel();
  const cellIds: StochasticStartupCellId[] = ["zero-w", "zero-2w", "full-w", "full-2w"];
  const cells = cellIds.map((id) => ({ id, metrics: metricDistributions(runs.flatMap((run) => run.windows.filter((sample) => sample.cellId === id)), actorIds) }));
  const definitions: Array<Pick<StochasticStartupContrast, "id" | "minuend" | "subtrahend">> = [
    { id: "zero-2w-minus-w", minuend: "zero-2w", subtrahend: "zero-w" },
    { id: "full-2w-minus-w", minuend: "full-2w", subtrahend: "full-w" },
    { id: "w-full-minus-zero", minuend: "full-w", subtrahend: "zero-w" },
    { id: "2w-full-minus-zero", minuend: "full-2w", subtrahend: "zero-2w" },
  ];
  const contrasts = definitions.map((definition): StochasticStartupContrast => {
    const pairedSamples = seeds.map((seed, seedIndex) => {
      const windows = runs.filter((run) => run.seedIndex === seedIndex).flatMap((run) => run.windows);
      const a = windows.find((window) => window.cellId === definition.minuend)!;
      const b = windows.find((window) => window.cellId === definition.subtrahend)!;
      return { seedIndex, seed, damage: a.damage - b.damage, dps: a.dps - b.dps,
        actors: Object.fromEntries(actorIds.map((actorId) => {
          const left = a.actors[actorId]!; const right = b.actors[actorId]!;
          return [actorId, { startEnergy: left.startEnergy - right.startEnergy, endEnergy: left.endEnergy - right.endEnergy,
            energyCostAttempts: left.energyCostAttempts - right.energyCostAttempts, energyCostFailures: left.energyCostFailures - right.energyCostFailures,
            insufficientEnergyFailures: left.insufficientEnergyFailures - right.insufficientEnergyFailures,
            energyCostFailureRate: left.energyCostFailureRate === null || right.energyCostFailureRate === null ? null : left.energyCostFailureRate - right.energyCostFailureRate }];
        })) };
    });
    return { ...definition, pairedSamples, metrics: metricDistributions(pairedSamples, actorIds) };
  });
  return { schemaVersion: "stochastic-startup-v1", status: "completed-diagnostic", config: structuredClone(config),
    inputConfigHash: createVersionedContentHash(config), requestedRuntimeOptions: structuredClone(options),
    policy: { sampleCount, warmupCycles, cycleTicks, observationTicks, warmupTicks, simulationTicks,
      windowPolicy: "half-open-[startTick,endTick)", boundaryEnergyPolicy: "before-all-events-at-boundary" },
    randomness: { baseSeed, seeds, seedPolicy: "base-seed:stochastic-startup-v1:index", rngAlgorithm: "fnv1a32-mulberry32-v1",
      criticalPolicy: options.execution?.criticalSampling ?? representativeResult!.resolvedRuntimeOptions.critMode,
      normalHitEnergyPolicy: config.normalHitEnergyModel === undefined ? null : NORMAL_HIT_ENERGY_PROFILE,
      favoniusPolicy: config.favoniusModel === undefined ? null : FAVONIUS_PROFILE,
      sacrificialPolicy: config.sacrificialModel === undefined ? null : SACRIFICIAL_PROFILE,
      ...(randomWeaponProcs ? {weaponProcPolicy: WEAPON_PROC_RANDOM_PROFILE} : {}),
      requestTemplate: { mode: runtimeCooldownTemplate ? "runtime-cooldown-v1" : "structural-v1",
        referenceSeed: runtimeCooldownTemplate ? baseSeed : null,
        requestedRuntimeOptions: runtimeCooldownTemplate ? structuredClone(options) : null,
        repeatedConfigHash: createVersionedContentHash(input) },
      criticalTriggeredEffects: "only-explicitly-implemented-effects" },
    cells, contrasts, runs, representativeResult: representativeResult!, limitations: [
      ...(randomWeaponProcs ? ["武器随机追击按来源顺序执行实际普通伤害回调、门禁和抽样，使用独立 independent-weapon-proc-v1 流；各轨迹连续保留真实冷却与待交付追击，暴击模式不会关闭武器触发抽样。吃虎鱼刀使用 roll ≤ 0.5，试作古华与霜葬使用严格小于概率；霜葬倍率取触发目标当时的冰／冻结判定，同次范围追击共用该倍率。", "武器追击的命名种子流仅保证本地复现，不与 gcsim 同种子随机序列等同；当前完整检查点尚未覆盖这条随机流，不据有限窗口诊断认证随机稳态。来源参考时钟假设没有角色卡肉。"] : []),
      ...(config.favoniusModel === undefined ? [] : ["西风触发沿每条连续轨迹保留角色冷却及独立随机数流；本来源配置明确假设角色无卡肉，不覆盖源码受角色卡肉延长的冷却。"]),
      ...(config.sacrificialModel === undefined ? [] : ["祭礼使用独立sacrificial-v1随机流；真实串行技能充能、延迟冷却启动和武器冷却沿连续轨迹保留，无角色卡肉假设不等于当前游戏实测。"]),
      ...(runtimeCooldownTemplate ? ["显式技能冷却时点或祭礼模型使重复请求由所选参考种子和运行选项的实际基线生成一次；所有zero/full种子共享这份请求表，每条轨迹自行判断技能资格或等待，不按各自结果重新生成请求。参考运行只用于模板，不计入统计样本；通用技能冷却本身不引入随机抽样。"] : []),
      "这是有限预热、固定窗口和有限种子数的起步敏感性诊断，不证明完整状态分布收敛或数学稳态。",
      "每组种子只运行zero/full各一条连续轨迹；W与2W窗口可重叠，其差先按种子配对，不把重叠窗口当独立样本。",
      "跨种子使用版本化种子后缀和同一伪随机算法；zero/full动作分叉后抽样位置可能不同，不保证同一抽样对应同一命中。",
      "p05/p50/p95描述模拟样本的经验离散程度；95% Student-t区间估计均值，假设跨种子独立且均值或配对差近似正态，小样本与偏斜/离散分布下仅作探索性参考。",
      "区间包含零或样本方差为零不证明无起步效应；未校正多个指标同时观察的覆盖率，不设p值通过门槛。",
      "耗能失败率为每条轨迹窗口内拒绝的正耗能请求/全部正耗能请求，包含能量不足和其他合法性拒绝；能量不足另列子集，不重复计数。无请求为null。均值是各次运行失败率的均值，不是合并请求的比例。配对任一侧无请求时该率差为null，统计count披露实际有效组数。",
      "边界能量取该帧所有事件前的实际值；窗口右端事件不计入伤害、请求或能量状态。窗口外的延迟效果不会被补入观察伤害。",
      "首个zero起步结果保存完整轨迹，其余仅保存各窗原始数值和可重现runManifest；输入配置、数值、种子和选项完整保留。",
      "只有代表轨迹请求完整公式步骤；其他运行关闭详细步骤。主模拟器仍为实际随机暴击保留必要命中审计，但这些轨迹不进入统计导出。",
      "仅统计主模拟器完整总伤路径；独立特殊反应复合入口、插件私有运行时及未实现暴击触发反馈不会被冒充已覆盖。",
    ] };
}
