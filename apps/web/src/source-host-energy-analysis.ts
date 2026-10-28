import { summarizeSourceHostRandomness } from "../../../packages/sim-core/src/source-host-randomness";
import { sourceHostTargetPhaseIdentity } from "../../../packages/sim-core/src/source-host-target-phase";
import { summarizeStochasticValues, type StochasticDistribution } from "../../../packages/sim-core/src/stochastic-startup";
import { sourceHostInitialEnergyIdentity, type SourceHostResult, type SourceHostEnergyApplication } from "../../../packages/sim-core/src/source-host-wire";
import { sourceHostFixedDamageWindow } from "../../../packages/sim-core/src/source-host-observation-window";

type NativeCharacter = {
  name?: string;
  energy_status?: number[] | null;
  failed_actions?: Array<{ start: number; end: number; reason: string }> | null;
};
type NativeResult = { duration?: number; characters?: NativeCharacter[] };
type LogRow = { event?: unknown; frame?: unknown; char_index?: unknown; msg?: unknown; logs?: unknown };

/** Frames elapsed before measurement, followed by two adjacent equal windows in one native run. */
export interface SourceHostObservationPolicy { warmupFrames: number; windowFrames: number }

export interface SourceEnergyEvent {
  frame: number;
  actorIndex: number;
  kind: "particle" | "recovery" | "drain";
  source: string;
  before: number;
  after: number;
  amount: number;
  gained: number;
  wasted: number;
  maxEnergy: number | null;
  recharge: number | null;
}
export interface SourceActionAttempt {
  frame: number;
  actorIndex: number;
  action: string;
  accepted: boolean;
  reason: string | null;
}
export interface SourceEnergyActorWindow {
  actorIndex: number;
  actor: string;
  recharge: number | null;
  startEnergy: number | null;
  endEnergy: number | null;
  energyBoundarySource: "energy-applications" | "native-tick-samples";
  gained: number;
  wasted: number;
  spent: number;
  particleEvents: number;
  burstAccepted: number;
  burstRejected: number | null;
  burstInsufficientEnergy: number | null;
  failureIntervalsWithoutAttemptLogs: number;
}
export interface SourceEnergyWindow {
  startFrame: number;
  endFrame: number;
  damage: number;
  dps: number;
  actors: SourceEnergyActorWindow[];
}
export interface SourceHostEnergyAnalysis {
  sourceCommit: string;
  seed: string;
  config: string;
  wasmSha256: string | null;
  durationFrames: number;
  observationPolicy: SourceHostObservationPolicy | null;
  windows: SourceEnergyWindow[];
  energyEvents: SourceEnergyEvent[];
  actionAttempts: SourceActionAttempt[];
  perAttemptFailuresComplete: boolean;
}
export interface SourceEnergyDistribution {
  actorIndex: number;
  actor: string;
  startEnergy: StochasticDistribution | null;
  endEnergy: StochasticDistribution | null;
  gained: StochasticDistribution;
  wasted: StochasticDistribution;
  spent: StochasticDistribution;
  burstAccepted: StochasticDistribution;
  burstRejected: StochasticDistribution | null;
  burstInsufficientEnergy: StochasticDistribution | null;
}
export interface SourceHostEnergyBatch {
  randomness: ReturnType<typeof summarizeSourceHostRandomness>;
  sourceCommit: string;
  wasmSha256: string | null;
  config: string;
  executionMode: string;
  party: string[];
  observationPolicy: SourceHostObservationPolicy | null;
  seeds: string[];
  runs: SourceHostEnergyAnalysis[];
  windows: Array<{ startFrame: number; endFrame: number; dps: StochasticDistribution; damage: StochasticDistribution; actors: SourceEnergyDistribution[] }>;
  pairedContrast: SourceEnergyPairedContrast | null;
}

export interface SourceEnergyPairedActorSample {
  actorIndex: number;
  actor: string;
  startEnergy: number | null;
  endEnergy: number | null;
  gained: number;
  wasted: number;
  spent: number;
  burstAccepted: number;
  burstRejected: number | null;
  burstInsufficientEnergy: number | null;
}
export interface SourceEnergyPairedSample { seed: string; damage: number; dps: number; actors: SourceEnergyPairedActorSample[] }
export interface SourceEnergyPairedContrast {
  direction: "second-minus-first";
  damage: StochasticDistribution;
  dps: StochasticDistribution;
  actors: SourceEnergyDistribution[];
  pairedSamples: SourceEnergyPairedSample[];
}

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const text = (value: unknown): string => typeof value === "string" ? value : "";

/** A new full native execution is required for each candidate; this changes only an explicit artifact stat contribution. */
export function addSourceHostRechargeContribution(config: string, actorKey: string, extraRecharge: number): string {
  if (!/^[a-z][a-z0-9_]*$/i.test(actorKey)) throw new Error("来源角色键不合法。");
  if (!Number.isFinite(extraRecharge) || extraRecharge < 0 || extraRecharge > 5) throw new Error("额外充能须在 0–500% 之间。");
  const declaration = new RegExp(`^\\s*${actorKey}\\s+char\\s+`, "i");
  const lines = config.split(/\r?\n/);
  const index = lines.findIndex(line => declaration.test(line));
  if (index < 0) throw new Error(`脚本未声明来源角色 ${actorKey}。`);
  if (!/;\s*(?:#.*)?$/.test(lines[index]!)) throw new Error("额外充能仅支持单行完整角色声明；请先完成该 GCSL 声明。");
  lines.splice(index + 1, 0, `${actorKey} add stats er=${extraRecharge};`);
  return lines.join("\n");
}

export function analyzeSourceHostEnergy(result: SourceHostResult, windowSelection?: number | SourceHostObservationPolicy): SourceHostEnergyAnalysis {
  const native = result.result as NativeResult;
  const nativeDuration = number(native.duration);
  if (nativeDuration === null || !Number.isInteger(nativeDuration) || nativeDuration <= 0) throw new Error("来源结果没有有效的实际观察帧数。");
  const fixedWindow = sourceHostFixedDamageWindow(result);
  const duration = fixedWindow?.endFrame ?? nativeDuration;
  const characters = Array.isArray(native.characters) ? native.characters : [];
  const rows = (Array.isArray(result.logs) ? result.logs : []).map(value => value as LogRow).filter(row => row && typeof row === "object");
  const events: SourceEnergyEvent[] = [];
  const attempts: SourceActionAttempt[] = [];
  const recharge = new Map<number, number>();
  for (const row of rows) {
    const frame = number(row.frame), actorIndex = number(row.char_index);
    if (frame === null || actorIndex === null || !Number.isInteger(actorIndex) || actorIndex < 0) continue;
    const data = record(row.logs), message = text(row.msg);
    if (row.event === "character" && message.endsWith(" final stats")) {
      const er = Number(data.er);
      if (Number.isFinite(er) && er > 0) recharge.set(actorIndex, er);
    }
    if (row.event === "action") {
      if (message === "source-host action rejected" && text(data.action) && text(data.reason)) {
        attempts.push({ frame, actorIndex, action: text(data.action), accepted: false, reason: text(data.reason) });
      } else if (message.startsWith("executed ") && text(data.action)) {
        attempts.push({ frame, actorIndex, action: text(data.action), accepted: true, reason: null });
      }
    }
    if (row.event !== "energy") continue;
    const kind = message === "particle" ? "particle" : message === "adding energy" ? "recovery" : message === "draining energy" ? "drain" : null;
    if (!kind) continue;
    const before = number(kind === "drain" ? data.pre_drain : data.pre_recovery);
    const after = number(kind === "drain" ? data.post_drain : data.post_recovery);
    if (before === null || after === null) continue;
    const delta = after - before;
    const amount = number(kind === "particle" ? data.amt : kind === "recovery" ? data["rec'd"] : before - after) ?? Math.abs(delta);
    events.push({ frame, actorIndex, kind, source: text(data.source), before, after, amount,
      gained: kind === "drain" ? 0 : Math.max(0, delta),
      wasted: kind === "drain" ? 0 : Math.max(0, amount - Math.max(0, delta)),
      maxEnergy: number(data.max_energy), recharge: number(data.ER) });
  }
  events.sort((a, b) => a.frame - b.frame);
  attempts.sort((a, b) => a.frame - b.frame);
  const writesByActor = new Map<number, SourceHostEnergyApplication[]>();
  if (fixedWindow) for (const write of result.energyApplications ?? []) {
    const writes = writesByActor.get(write.actorIndex) ?? [];
    const previous = writes.at(-1);
    if (!Number.isInteger(write.frame) || !Number.isFinite(write.energyBefore) || !Number.isFinite(write.energyAfter)
      || previous && (write.frame < previous.frame || write.id <= previous.id || write.energyBefore !== previous.energyAfter)) {
      throw new Error("逐次能量回执的顺序或连续余额不一致，不能恢复精确边界能量。");
    }
    writes.push(write); writesByActor.set(write.actorIndex, writes);
  }
  const observationPolicy = typeof windowSelection === "object" && windowSelection !== null
    ? { warmupFrames: windowSelection.warmupFrames, windowFrames: windowSelection.windowFrames } : null;
  const cut = typeof windowSelection === "number" ? windowSelection : Math.floor(duration / 2);
  if (observationPolicy) {
    const { warmupFrames, windowFrames } = observationPolicy;
    if (!Number.isInteger(warmupFrames) || warmupFrames < 0 || !Number.isInteger(windowFrames) || windowFrames <= 0) throw new Error("来源预热帧数须非负，测量窗帧数须为正整数。");
    if (warmupFrames + 2 * windowFrames > duration) throw new Error("实际来源观察时长不足以覆盖预热和两个完整测量窗。");
  } else {
    if (duration > 1 && (!Number.isInteger(cut) || cut <= 0 || cut >= duration)) throw new Error("观察窗分界必须位于本次实际执行内部。");
    if (duration === 1 && windowSelection !== undefined) throw new Error("单帧来源结果不能设置分窗边界。");
  }
  // Completed timed results share the damage curve's [0, duration) window.
  // Keep the original 1-based diagnostic convention for legacy/early-ended
  // records without that explicit window; never rewrite their saved receipts.
  const start = fixedWindow ? 0 : 1;
  const bounds: Array<[number, number]> = observationPolicy
    ? [[start + observationPolicy.warmupFrames, start + observationPolicy.warmupFrames + observationPolicy.windowFrames],
      [start + observationPolicy.warmupFrames + observationPolicy.windowFrames, start + observationPolicy.warmupFrames + 2 * observationPolicy.windowFrames]]
    : duration === 1 ? [[start, start + 1]] : [[start, cut + start], [cut + start, duration + start]];
  const energyAt = (actorIndex: number, boundary: number): number | null => {
    const writes = writesByActor.get(actorIndex);
    if (writes?.length) {
      // An action may add energy after OnTick at the same frame. The ordered
      // actual applications, not that frame's earlier sample, define its end.
      for (let index = writes.length - 1; index >= 0; index--) if (writes[index]!.frame < boundary) return writes[index]!.energyAfter;
      return result.startupState?.actors.find(actor => actor.actorIndex === actorIndex)?.energy ?? writes[0]!.energyBefore;
    }
    const trace = characters[actorIndex]?.energy_status;
    if (fixedWindow && boundary <= 1) {
      const preceding = events.filter(event => event.actorIndex === actorIndex && event.frame < boundary).at(-1);
      const atBoundary = events.find(event => event.actorIndex === actorIndex && event.frame === boundary);
      return preceding?.after ?? atBoundary?.before ?? result.startupState?.actors.find(actor => actor.actorIndex === actorIndex)?.energy ?? null;
    }
    if (boundary === 1) {
      const startup = result.startupState?.actors.find(actor => actor.actorIndex === actorIndex);
      if (startup) return startup.energy;
      const first = events.find(event => event.actorIndex === actorIndex && event.frame <= 1);
      return first?.before ?? (Array.isArray(trace) ? number(trace[0]) : null);
    }
    // F=B-1's OnTick sample can precede later same-frame action energy. This
    // legacy fallback is explicitly labelled sampling, never exact frame-end.
    return Array.isArray(trace) ? number(trace[boundary - 2]) : null;
  };
  const windows = bounds.map(([startFrame, endFrame]): SourceEnergyWindow => {
    const inWindow = (frame: number) => frame >= startFrame && frame < endFrame;
    const damage = result.applications.filter(application => inWindow(application.frame)).reduce((sum, application) => sum + application.appliedDamage, 0);
    return { startFrame, endFrame, damage, dps: damage * 60 / (endFrame - startFrame), actors: characters.map((character, actorIndex) => {
      const energy = events.filter(event => event.actorIndex === actorIndex && inWindow(event.frame));
      const action = attempts.filter(attempt => attempt.actorIndex === actorIndex && attempt.action === "burst" && inWindow(attempt.frame));
      // A merged interval starts at its first failed attempt and may extend
      // across a window with no attempts. The new source log must contain that
      // first rejection; an old result lacking it cannot yield attempt counts.
      const uncoveredFailures = Array.isArray(character.failed_actions) ? character.failed_actions.filter(failure =>
        !attempts.some(attempt => !attempt.accepted && attempt.actorIndex === actorIndex && attempt.frame === failure.start)
        && failure.start < endFrame && (failure.end > startFrame || inWindow(failure.start))).length : 0;
      const missingAttempts = uncoveredFailures > 0;
      return { actorIndex, actor: character.name || `队伍第 ${actorIndex + 1} 位`, recharge: recharge.get(actorIndex) ?? null,
        startEnergy: energyAt(actorIndex, startFrame), endEnergy: energyAt(actorIndex, endFrame),
        energyBoundarySource: writesByActor.has(actorIndex) ? "energy-applications" : "native-tick-samples",
        gained: energy.reduce((sum, event) => sum + event.gained, 0),
        wasted: energy.reduce((sum, event) => sum + event.wasted, 0),
        spent: energy.reduce((sum, event) => sum + (event.kind === "drain" ? Math.max(0, event.before - event.after) : 0), 0),
        particleEvents: energy.filter(event => event.kind === "particle").length,
        burstAccepted: action.filter(attempt => attempt.accepted).length,
        burstRejected: missingAttempts ? null : action.filter(attempt => !attempt.accepted).length,
        burstInsufficientEnergy: missingAttempts ? null : action.filter(attempt => !attempt.accepted && attempt.reason === "insufficient_energy").length,
        failureIntervalsWithoutAttemptLogs: uncoveredFailures };
    }) };
  });
  return { sourceCommit: result.sourceCommit, seed: result.seed, config: result.config,
    wasmSha256: result.executionArtifact?.wasmSha256 ?? null, durationFrames: duration, observationPolicy, windows,
    energyEvents: events, actionAttempts: attempts,
    perAttemptFailuresComplete: windows.every(window => window.actors.every(actor => actor.failureIntervalsWithoutAttemptLogs === 0)) };
}

/** Independent seeds share one exact script and source binary; windows stay paired within each continuous run. */
export function summarizeSourceHostEnergyRuns(results: readonly SourceHostResult[], windowSelection?: number | SourceHostObservationPolicy): SourceHostEnergyBatch {
  if (!results.length || results.length > 32) throw new Error("来源样本须为 1–32 次独立完整运行。");
  const randomness = summarizeSourceHostRandomness(results);
  const runs = results.map(result => analyzeSourceHostEnergy(result, windowSelection));
  const first = runs[0]!;
  if (new Set(runs.map(run => run.seed)).size !== runs.length) throw new Error("来源批次不能重复随机种子。");
  const executionMode = results[0]!.executionMode ?? "auto-wait";
  const party = ((results[0]!.result as NativeResult).characters ?? []).map(character => character.name ?? "");
  if (runs.some((run, index) => run.config !== first.config || run.sourceCommit !== first.sourceCommit || run.wasmSha256 !== first.wasmSha256 || run.durationFrames !== first.durationFrames
    || (results[index]!.executionMode ?? "auto-wait") !== executionMode
    || results[index]!.observationWindow?.policy !== results[0]!.observationWindow?.policy
    || JSON.stringify(results[index]!.targetScene) !== JSON.stringify(results[0]!.targetScene)
    || sourceHostTargetPhaseIdentity(results[index]!.targetPhases) !== sourceHostTargetPhaseIdentity(results[0]!.targetPhases)
    || sourceHostInitialEnergyIdentity(results[index]!.initialEnergy) !== sourceHostInitialEnergyIdentity(results[0]!.initialEnergy)
    || JSON.stringify(run.windows[0]!.actors.map(actor => actor.energyBoundarySource)) !== JSON.stringify(first.windows[0]!.actors.map(actor => actor.energyBoundarySource))
    || JSON.stringify(((results[index]!.result as NativeResult).characters ?? []).map(character => character.name ?? "")) !== JSON.stringify(party))) {
    throw new Error("来源批次脚本、初能覆盖、源码、产物、动作模式、队伍、能量边界证据或观察时长不一致。");
  }
  const metric = (values: Array<number | null>): StochasticDistribution | null => values.some(value => value === null) ? null : summarizeStochasticValues(values as number[]);
  const windows = first.windows.map((window, windowIndex) => ({ startFrame: window.startFrame, endFrame: window.endFrame,
      dps: summarizeStochasticValues(runs.map(run => run.windows[windowIndex]!.dps))!,
      damage: summarizeStochasticValues(runs.map(run => run.windows[windowIndex]!.damage))!,
      actors: window.actors.map((actor, actorIndex) => {
        const samples = runs.map(run => run.windows[windowIndex]!.actors[actorIndex]!);
        return { actorIndex, actor: actor.actor,
          startEnergy: metric(samples.map(sample => sample.startEnergy)), endEnergy: metric(samples.map(sample => sample.endEnergy)),
          gained: metric(samples.map(sample => sample.gained))!, wasted: metric(samples.map(sample => sample.wasted))!,
          spent: metric(samples.map(sample => sample.spent))!, burstAccepted: metric(samples.map(sample => sample.burstAccepted))!,
          burstRejected: metric(samples.map(sample => sample.burstRejected)),
          burstInsufficientEnergy: metric(samples.map(sample => sample.burstInsufficientEnergy)) };
      }) }));
  const subtract = (after: number | null, before: number | null): number | null => after === null || before === null ? null : after - before;
  const pairedSamples: SourceEnergyPairedSample[] = first.windows.length === 2 ? runs.map(run => {
    const before = run.windows[0]!, after = run.windows[1]!;
    return { seed: run.seed, damage: after.damage - before.damage, dps: after.dps - before.dps,
      actors: before.actors.map((actor, actorIndex) => {
        const next = after.actors[actorIndex]!;
        return { actorIndex, actor: actor.actor,
          startEnergy: subtract(next.startEnergy, actor.startEnergy), endEnergy: subtract(next.endEnergy, actor.endEnergy),
          gained: next.gained - actor.gained, wasted: next.wasted - actor.wasted, spent: next.spent - actor.spent,
          burstAccepted: next.burstAccepted - actor.burstAccepted,
          burstRejected: subtract(next.burstRejected, actor.burstRejected),
          burstInsufficientEnergy: subtract(next.burstInsufficientEnergy, actor.burstInsufficientEnergy) };
      }) };
  }) : [];
  const pairedContrast: SourceEnergyPairedContrast | null = pairedSamples.length ? {
    direction: "second-minus-first", pairedSamples,
    damage: summarizeStochasticValues(pairedSamples.map(sample => sample.damage))!,
    dps: summarizeStochasticValues(pairedSamples.map(sample => sample.dps))!,
    actors: pairedSamples[0]!.actors.map((actor, actorIndex) => {
      const samples = pairedSamples.map(sample => sample.actors[actorIndex]!);
      return { actorIndex, actor: actor.actor,
        startEnergy: metric(samples.map(sample => sample.startEnergy)), endEnergy: metric(samples.map(sample => sample.endEnergy)),
        gained: metric(samples.map(sample => sample.gained))!, wasted: metric(samples.map(sample => sample.wasted))!,
        spent: metric(samples.map(sample => sample.spent))!, burstAccepted: metric(samples.map(sample => sample.burstAccepted))!,
        burstRejected: metric(samples.map(sample => sample.burstRejected)),
        burstInsufficientEnergy: metric(samples.map(sample => sample.burstInsufficientEnergy)) };
    }),
  } : null;
  return { randomness, sourceCommit: first.sourceCommit, wasmSha256: first.wasmSha256, config: first.config, executionMode, party,
    observationPolicy: first.observationPolicy, seeds: runs.map(run => run.seed), runs, windows, pairedContrast };
}
