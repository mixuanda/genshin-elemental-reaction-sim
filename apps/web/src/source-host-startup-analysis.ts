import { assertDistinctSourceHostStreams } from "../../../packages/sim-core/src/source-host-randomness";
import { assertSourceHostTargetPhases, sourceHostTargetPhaseIdentity } from "../../../packages/sim-core/src/source-host-target-phase";
import { summarizeStochasticValues, type StochasticDistribution } from "../../../packages/sim-core/src/stochastic-startup";
import {
  SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT, assertSourceHostStartupState, sourceHostInitialEnergyIdentity, sourceHostInitialEnergySchema,
  type SourceHostInitialEnergy, type SourceHostResult, type SourceHostRunRequest,
} from "../../../packages/sim-core/src/source-host-wire";
import {
  summarizeSourceHostEnergyRuns,
  type SourceEnergyDistribution, type SourceEnergyPairedActorSample, type SourceEnergyPairedSample,
  type SourceHostEnergyBatch, type SourceHostObservationPolicy,
} from "./source-host-energy-analysis";
export type { SourceHostObservationPolicy } from "./source-host-energy-analysis";

export type SourceHostStartupScenario = "zero" | "full" | "custom";
export interface SourceHostStartupJob {
  id: string;
  scenario: SourceHostStartupScenario;
  baseConfig: string;
  request: SourceHostRunRequest;
}
export interface SourceHostStartupRun extends SourceHostStartupJob { result: SourceHostResult; elapsedMs: number }

export interface SourceHostStartupActorDifference extends SourceEnergyPairedActorSample {
  recharge: number | null;
  particleEvents: number;
  failureIntervalsWithoutAttemptLogs: number;
}
export interface SourceHostStartupPairedSample extends Omit<SourceEnergyPairedSample, "actors"> {
  actors: SourceHostStartupActorDifference[];
}
export interface SourceHostStartupActorDistribution extends SourceEnergyDistribution {
  recharge: StochasticDistribution | null;
  particleEvents: StochasticDistribution;
  failureIntervalsWithoutAttemptLogs: StochasticDistribution;
}

export interface SourceHostStartupContrast {
  id: "full-minus-zero" | "custom-minus-zero";
  direction: "full-minus-zero" | "custom-minus-zero";
  windowIndex: 0 | 1;
  startFrame: number;
  endFrame: number;
  pairedSamples: SourceHostStartupPairedSample[];
  damage: StochasticDistribution;
  dps: StochasticDistribution;
  actors: SourceHostStartupActorDistribution[];
}
export interface SourceHostStartupSummary {
  schemaVersion: "source-host-startup-v1";
  sourceCommit: string;
  wasmSha256: string;
  config: string;
  executionMode: string;
  party: string[];
  durationFrames: number;
  observationPolicy: SourceHostObservationPolicy | null;
  seeds: string[];
  scenarios: Array<{ scenario: SourceHostStartupScenario; runs: SourceHostStartupRun[]; summary: SourceHostEnergyBatch }>;
  pairedContrasts: SourceHostStartupContrast[];
}

/** Each cell is a fresh native run of the same source script and same numeric seed. */
export function createSourceHostStartupJobs(baseRequest: SourceHostRunRequest, seedsText: string, customByActor?: Record<string, number>): SourceHostStartupJob[] {
  const seeds = seedsText.split(/[，,\s]+/).filter(Boolean);
  if (seeds.length < 2 || seeds.length > 32 || seeds.some(seed => !/^\d+$/.test(seed) || BigInt(seed) > 18446744073709551615n)
    || new Set(seeds.map(seed => BigInt(seed).toString())).size !== seeds.length) throw new Error("起步敏感度须有2–32个不重复的uint64十进制种子。");
  assertDistinctSourceHostStreams(seeds);
  const scenarios: SourceHostInitialEnergy[] = [{ mode: "zero" }, { mode: "full" }];
  if (customByActor !== undefined) {
    if (!Object.keys(customByActor).length) throw new Error("自定义起步须明确至少一名角色的初始能量。");
    scenarios.push(sourceHostInitialEnergySchema.parse({ mode: "custom", byActor: customByActor }));
  }
  return seeds.flatMap(seed => scenarios.map(initialEnergy => ({
    id: `${initialEnergy.mode}:${seed}`, scenario: initialEnergy.mode, baseConfig: baseRequest.config,
    request: { ...baseRequest, config: baseRequest.config, seed, initialEnergy },
  })));
}

const identity = (value: unknown): string => JSON.stringify(value);
const difference = (minuend: number | null, subtrahend: number | null): number | null =>
  minuend === null || subtrahend === null ? null : minuend - subtrahend;
const metric = (samples: Array<number | null>): StochasticDistribution | null =>
  samples.some(value => value === null) ? null : summarizeStochasticValues(samples as number[]);

function verifyRun(run: SourceHostStartupRun): void {
  assertSourceHostTargetPhases(run.request.targetPhases, run.result.targetPhases, run.result.targetScene);
  if (run.id !== `${run.scenario}:${run.request.seed}`) throw new Error("起步对照工作项与场景或种子标签不一致。");
  if (run.baseConfig !== run.request.config || run.result.config !== run.request.config || run.result.seed !== run.request.seed)
    throw new Error("起步对照的原脚本、执行输入与来源回执不一致。");
  const initial = run.request.initialEnergy;
  if (!initial || initial.mode !== run.scenario || sourceHostInitialEnergyIdentity(run.result.initialEnergy) !== sourceHostInitialEnergyIdentity(initial))
    throw new Error("起步场景标签与原生执行器采用的初能覆盖不一致。");
  assertSourceHostStartupState(run.result.initialEnergy, run.result.startupState);
  const state = run.result.startupState;
  const characters = (run.result.result as { characters?: Array<{ name?: string }> }).characters ?? [];
  if (!state || state.mode !== run.scenario || state.actors.length !== characters.length)
    throw new Error("来源运行未返回与起步覆盖匹配的原生初能状态。");
  const byActor = initial.mode === "custom" ? initial.byActor : {};
  const named = new Set<string>();
  for (const [index, actor] of state.actors.entries()) {
    if (actor.actorIndex !== index || actor.actorKey !== characters[index]?.name || named.has(actor.actorKey))
      throw new Error("来源起步状态与实际队伍索引或角色键不一致。");
    named.add(actor.actorKey);
    const requested = initial.mode === "zero" ? 0 : initial.mode === "custom" ? (byActor[actor.actorKey] ?? null) : null;
    if (actor.requestedEnergy !== requested || actor.energy < 0 || actor.energy > actor.maxEnergy)
      throw new Error("来源起步状态与请求能量或角色能量上限不一致。");
  }
  if (initial.mode === "custom" && (Object.keys(byActor).length !== named.size || Object.keys(byActor).some(actor => !named.has(actor))))
    throw new Error("自定义初能必须恰好覆盖实际来源队伍的全部角色键。");
  const expectedCommit = (run.request.hostVariant ?? "classic") === "stellar" ? SOURCE_HOST_STELLAR_COMMIT : SOURCE_HOST_COMMIT;
  if (run.result.sourceCommit !== expectedCommit || (run.result.executionMode ?? "auto-wait") !== (run.request.executionMode ?? "auto-wait"))
    throw new Error("起步对照的来源版本或动作执行模式与请求不一致。");
  if ((run.request.stopAtDuration === true) !== (run.result.observationWindow?.policy === "duration-or-native"))
    throw new Error("起步对照的原生观察停止策略与请求不一致。");
  if ((run.request.primaryTargetIndex ?? 0) !== (run.result.targetScene?.primaryTargetIndex ?? 0))
    throw new Error("起步对照的统计目标索引与原生回执不一致。");
}

/** Compare matching windows across independently restarted native executions.
 * Pairing is by seed identity, not by an assumption that diverged rotations
 * consume the same random draw at corresponding events. */
export function summarizeSourceHostStartupRuns(runs: readonly SourceHostStartupRun[], policy?: SourceHostObservationPolicy): SourceHostStartupSummary {
  if (!runs.length) throw new Error("起步对照没有完整来源运行。");
  runs.forEach(verifyRun);
  const baseline = runs[0]!;
  const scenarioOrder: SourceHostStartupScenario[] = ["zero", "full", "custom"];
  const present = scenarioOrder.filter(scenario => runs.some(run => run.scenario === scenario));
  if (!present.includes("zero") || !present.includes("full")) throw new Error("起步对照至少需要零能与满能两种完整场景。");
  if (runs.some(run => run.baseConfig !== baseline.baseConfig || run.request.config !== baseline.request.config
    || run.result.sourceCommit !== baseline.result.sourceCommit
    || run.result.executionArtifact?.wasmSha256 !== baseline.result.executionArtifact?.wasmSha256
    || (run.request.executionMode ?? "auto-wait") !== (baseline.request.executionMode ?? "auto-wait")
    || (run.request.stopAtDuration === true) !== (baseline.request.stopAtDuration === true)
    || run.result.observationWindow?.policy !== baseline.result.observationWindow?.policy
    || (run.request.primaryTargetIndex ?? 0) !== (baseline.request.primaryTargetIndex ?? 0)
    || JSON.stringify(run.result.targetScene) !== JSON.stringify(baseline.result.targetScene)
    || sourceHostTargetPhaseIdentity(run.result.targetPhases) !== sourceHostTargetPhaseIdentity(baseline.result.targetPhases)))
    throw new Error("起步对照必须共享精确脚本、固定源码、WASM与动作执行模式。");
  const wasmSha256 = baseline.result.executionArtifact?.wasmSha256;
  if (!wasmSha256) throw new Error("起步对照缺少实际WASM产物身份。");
  const scenarios = present.map(scenario => {
    const selected = runs.filter(run => run.scenario === scenario);
    const override = selected[0]!.request.initialEnergy;
    if (selected.some(run => sourceHostInitialEnergyIdentity(run.request.initialEnergy) !== sourceHostInitialEnergyIdentity(override)))
      throw new Error("同一起步场景的自定义初能映射必须一致。");
    const summary = summarizeSourceHostEnergyRuns(selected.map(run => run.result), policy);
    return { scenario, runs: selected, summary };
  });
  const zero = scenarios.find(row => row.scenario === "zero")!;
  const seeds = zero.summary.seeds;
  if (seeds.length < 2 || seeds.length > 32 || zero.summary.windows.length !== 2
    || seeds.some(seed => !/^\d+$/.test(seed) || BigInt(seed) > 18446744073709551615n)
    || new Set(seeds.map(seed => BigInt(seed).toString())).size !== seeds.length
    || scenarios.some(row => row.summary.seeds.length !== seeds.length
    || row.summary.sourceCommit !== zero.summary.sourceCommit || row.summary.wasmSha256 !== zero.summary.wasmSha256
    || row.summary.executionMode !== zero.summary.executionMode
    || row.summary.runs.some(run => run.durationFrames !== zero.summary.runs[0]!.durationFrames)
    || identity(row.summary.party) !== identity(zero.summary.party)
    || identity(row.summary.observationPolicy) !== identity(zero.summary.observationPolicy)
    || identity(row.summary.windows.map(window => [window.startFrame, window.endFrame])) !== identity(zero.summary.windows.map(window => [window.startFrame, window.endFrame]))
    || row.summary.seeds.some(seed => !seeds.includes(seed))))
    throw new Error("起步对照须在每个场景使用同一批种子、队伍、实际时长和观察窗口。");
  const pairedContrasts: SourceHostStartupContrast[] = [];
  for (const scenario of present.filter(value => value !== "zero")) {
    const group = scenarios.find(row => row.scenario === scenario)!;
    const bySeed = new Map(group.summary.runs.map(run => [run.seed, run]));
    for (const windowIndex of [0, 1] as const) {
      const bounds = zero.summary.windows[windowIndex];
      if (!bounds || !group.summary.windows[windowIndex]) continue;
      const pairedSamples: SourceHostStartupPairedSample[] = zero.summary.runs.map(zeroRun => {
        const candidate = bySeed.get(zeroRun.seed)!;
        const before = zeroRun.windows[windowIndex]!, after = candidate.windows[windowIndex]!;
        return { seed: zeroRun.seed, damage: after.damage - before.damage, dps: after.dps - before.dps,
          actors: before.actors.map((actor, actorIndex) => {
            const next = after.actors[actorIndex]!;
            return { actorIndex, actor: actor.actor,
              recharge: difference(next.recharge, actor.recharge),
              startEnergy: difference(next.startEnergy, actor.startEnergy), endEnergy: difference(next.endEnergy, actor.endEnergy),
              gained: next.gained - actor.gained, wasted: next.wasted - actor.wasted, spent: next.spent - actor.spent,
              particleEvents: next.particleEvents - actor.particleEvents,
              burstAccepted: next.burstAccepted - actor.burstAccepted,
              burstRejected: difference(next.burstRejected, actor.burstRejected),
              burstInsufficientEnergy: difference(next.burstInsufficientEnergy, actor.burstInsufficientEnergy),
              failureIntervalsWithoutAttemptLogs: next.failureIntervalsWithoutAttemptLogs - actor.failureIntervalsWithoutAttemptLogs };
          }) };
      });
      const actorSummaries: SourceHostStartupActorDistribution[] = pairedSamples[0]!.actors.map((actor, actorIndex) => {
        const samples = pairedSamples.map(sample => sample.actors[actorIndex]!);
        return { actorIndex, actor: actor.actor,
          recharge: metric(samples.map(sample => sample.recharge)),
          startEnergy: metric(samples.map(sample => sample.startEnergy)), endEnergy: metric(samples.map(sample => sample.endEnergy)),
          gained: metric(samples.map(sample => sample.gained))!, wasted: metric(samples.map(sample => sample.wasted))!,
          particleEvents: metric(samples.map(sample => sample.particleEvents))!,
          spent: metric(samples.map(sample => sample.spent))!, burstAccepted: metric(samples.map(sample => sample.burstAccepted))!,
          burstRejected: metric(samples.map(sample => sample.burstRejected)),
          burstInsufficientEnergy: metric(samples.map(sample => sample.burstInsufficientEnergy)),
          failureIntervalsWithoutAttemptLogs: metric(samples.map(sample => sample.failureIntervalsWithoutAttemptLogs))! };
      });
      const direction = `${scenario}-minus-zero` as SourceHostStartupContrast["direction"];
      pairedContrasts.push({ id: direction, direction, windowIndex,
        startFrame: bounds.startFrame, endFrame: bounds.endFrame, pairedSamples,
        damage: summarizeStochasticValues(pairedSamples.map(sample => sample.damage))!,
        dps: summarizeStochasticValues(pairedSamples.map(sample => sample.dps))!, actors: actorSummaries });
    }
  }
  return { schemaVersion: "source-host-startup-v1", sourceCommit: zero.summary.sourceCommit, wasmSha256,
    config: zero.summary.config, executionMode: zero.summary.executionMode, party: zero.summary.party,
    durationFrames: zero.summary.runs[0]!.durationFrames, observationPolicy: zero.summary.observationPolicy,
    seeds, scenarios, pairedContrasts };
}
