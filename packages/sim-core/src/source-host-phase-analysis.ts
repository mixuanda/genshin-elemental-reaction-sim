import { z } from "zod";

/** Read-only native phase evidence. This does not restore a Go simulation. */
export const SOURCE_HOST_PHASE_PROVIDERS = [
  "input", "simulation", "player", "characters", "effects", "targets", "tasks", "events", "rng", "external",
] as const;

export const sourceHostPhaseObservationRequestSchema = z.object({
  warmupFrames: z.number().int().nonnegative(),
  maxPeriod: z.number().int().min(1).max(8),
  requiredConsecutivePeriods: z.number().int().min(2).max(8),
  maxObservations: z.number().int().min(2).max(256),
}).strict();
export type SourceHostPhaseObservationRequest = z.infer<typeof sourceHostPhaseObservationRequestSchema>;

export const sourceHostPhaseObservationSchema = z.object({
  boundary: z.literal("post-tick-pre-input-v1"),
  frame: z.number().int().nonnegative(),
  inputPhase: z.object({
    repeatId: z.string().min(1), iteration: z.number().int().nonnegative(), position: z.number().int().nonnegative(),
    futureInputSignature: z.string().min(1), verifiedRepeat: z.boolean(),
  }).strict(),
  determinism: z.enum(["deterministic", "stochastic"]),
  normalizedState: z.record(z.string(), z.unknown()),
  coverage: z.object({ complete: z.boolean(), providers: z.array(z.string()), gaps: z.array(z.string()) }).strict(),
  cumulativeDamage: z.number().finite().nonnegative(),
  damageSincePreviousBoundary: z.number().finite().nonnegative().optional(),
}).strict();
export type SourceHostPhaseObservation = z.infer<typeof sourceHostPhaseObservationSchema>;

export interface SourceHostPhaseDifference {
  leftFrame: number;
  rightFrame: number;
  paths: string[];
}

export interface SourceHostPhaseIntervalDifference {
  first: { startFrame: number; endFrame: number; frames: number; damage: number };
  later: { startFrame: number; endFrame: number; frames: number; damage: number };
}

export interface SourceHostPhaseAnalysis {
  status: "established-for-declared-native-state" | "not-established";
  evidence: "provisional-source-state";
  periodCycles: number | null;
  steadyStateDps: number | null;
  periodDamage: number | null;
  periodFrames: number | null;
  warmupBoundaryFrame: number | null;
  matchedBoundaryFrames: number[];
  observationCount: number;
  reasons: string[];
  stateDifferences: SourceHostPhaseDifference[];
  intervalDifferences: SourceHostPhaseIntervalDifference[];
}

function canonicalJson(value: unknown, seen = new Set<object>()): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value)!;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite number");
    return JSON.stringify(value)!;
  }
  if (typeof value !== "object") throw new Error("non-JSON value");
  if (seen.has(value)) throw new Error("cyclic value");
  seen.add(value);
  try {
    if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item, seen)).join(",")}]`;
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new Error("non-JSON object");
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object).sort();
    return `{${keys.map(key => `${JSON.stringify(key)!}:${canonicalJson(object[key], seen)}`).join(",")}}`;
  } finally {
    seen.delete(value);
  }
}

function statePaths(left: unknown, right: unknown, path = "$", output: string[] = []): string[] {
  if (output.length >= 32) return output;
  if (left === right) return output;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) {
    output.push(path); return output;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) output.push(`${path}.length`);
    for (let index = 0; index < Math.min(left.length, right.length) && output.length < 32; index += 1) {
      statePaths(left[index], right[index], `${path}[${index}]`, output);
    }
    return output;
  }
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    if (output.length >= 32) break;
    const childPath = `${path}.${key}`;
    if (!Object.hasOwn(a, key) || !Object.hasOwn(b, key)) output.push(childPath);
    else statePaths(a[key], b[key], childPath, output);
  }
  return output;
}

// Recent native receipts sum the actual applications inside each observed interval.
// This avoids cancellation when subtracting two growing floating-point totals.
// Legacy receipts remain readable and retain their original cumulative comparison.
function intervalDamage(rows: readonly SourceHostPhaseObservation[], left: number, right: number): number {
  const intervals = rows.slice(left + 1, right + 1);
  if (intervals.every(row => row.damageSincePreviousBoundary !== undefined)) {
    return intervals.reduce((sum, row) => sum + row.damageSincePreviousBoundary!, 0);
  }
  return rows[right]!.cumulativeDamage - rows[left]!.cumulativeDamage;
}

function invalid(reason: string, observationCount: number, differences: SourceHostPhaseDifference[] = [], intervalDifferences: SourceHostPhaseIntervalDifference[] = []): SourceHostPhaseAnalysis {
  return { status: "not-established", evidence: "provisional-source-state", periodCycles: null, steadyStateDps: null,
    periodDamage: null, periodFrames: null, warmupBoundaryFrame: null, matchedBoundaryFrames: [],
    observationCount, reasons: [reason], stateDifferences: differences, intervalDifferences };
}

/** Compares only actual boundaries from one continuous native run at one verified repeated input position. */
export function analyzeSourceHostPhase(
  observationsInput: readonly SourceHostPhaseObservation[],
  policyInput: SourceHostPhaseObservationRequest,
): SourceHostPhaseAnalysis {
  const policy = sourceHostPhaseObservationRequestSchema.safeParse(policyInput);
  if (!policy.success) return invalid("原生相位观察政策无效。", observationsInput.length);
  const observations: SourceHostPhaseObservation[] = [];
  if (observationsInput.length > policy.data.maxObservations) return invalid("原生相位观察数超过本次明确上限。", observationsInput.length);
  for (const [index, input] of observationsInput.entries()) {
    const row = sourceHostPhaseObservationSchema.safeParse(input);
    if (!row.success) return invalid(`第 ${index + 1} 个原生相位回执无效。`, observationsInput.length);
    observations.push(row.data);
  }
  if (!observations.length) return invalid("本次来源运行没有原生相位观察。", 0);
  const firstPhase = observations[0]!.inputPhase;
  const canonicalStates: string[] = [];
  const coverageReady: boolean[] = [];
  const phaseReady: boolean[] = [];
  for (const [index, row] of observations.entries()) {
    if (row.determinism !== "deterministic") return invalid("随机来源观察不能据逐周期相等证明确定性稳态。", observations.length);
    if (row.inputPhase.repeatId !== firstPhase.repeatId || row.inputPhase.position !== firstPhase.position) {
      return invalid("原生边界并非同一解释器重复输入位置。", observations.length);
    }
    phaseReady.push(row.inputPhase.verifiedRepeat);
    coverageReady.push(row.coverage.complete && row.coverage.gaps.length === 0);
    const providers = row.coverage.providers;
    const providerSet = new Set(providers);
    if (providers.length !== providerSet.size) return invalid("原生相位回执重复声明了状态提供者。", observations.length);
    const stateKeys = Object.keys(row.normalizedState);
    if (stateKeys.some(name => !providerSet.has(name))) return invalid("规范化原生状态含未声明的提供者。", observations.length);
    if (coverageReady[index] && (SOURCE_HOST_PHASE_PROVIDERS.some(name => !providerSet.has(name)) ||
        stateKeys.length !== providerSet.size || providers.some(name => !Object.hasOwn(row.normalizedState, name) || row.normalizedState[name] === null))) {
      coverageReady[index] = false;
    }
    try { canonicalStates.push(canonicalJson(row.normalizedState)); }
    catch { return invalid("规范化原生状态包含非 JSON 值或非有限数。", observations.length); }
    if (index > 0) {
      const prior = observations[index - 1]!;
      if (row.frame <= prior.frame || row.inputPhase.iteration !== prior.inputPhase.iteration + 1 ||
          row.cumulativeDamage < prior.cumulativeDamage) {
        return invalid("原生边界须按连续重复次数、严格递增帧和非递减累计伤害排列。", observations.length);
      }
    }
  }
  const differences: SourceHostPhaseDifference[] = [];
  const intervalDifferences: SourceHostPhaseIntervalDifference[] = [];
  let futureInputMismatch = false;
  let candidateInputGap = false;
  const end = observations.length - 1;
  for (let period = 1; period <= policy.data.maxPeriod; period += 1) {
    const start = end - policy.data.requiredConsecutivePeriods * period;
    if (start < 0 || observations[start]!.frame < policy.data.warmupFrames) continue;
    const inputReady = phaseReady.slice(start).every(Boolean);
    candidateInputGap ||= !inputReady;
    let valid = coverageReady.slice(start).every(Boolean) && inputReady;
    for (let index = start + period; index <= end; index += 1) {
      if (observations[index]!.inputPhase.futureInputSignature !== observations[index - period]!.inputPhase.futureInputSignature) {
        futureInputMismatch = true;
        valid = false;
      }
      if (canonicalStates[index] !== canonicalStates[index - period]) {
        valid = false;
        if (differences.length < 8) differences.push({ leftFrame: observations[index - period]!.frame,
          rightFrame: observations[index]!.frame,
          paths: statePaths(observations[index - period]!.normalizedState, observations[index]!.normalizedState) });
      }
    }
    const firstInterval = {
      frames: observations[start + period]!.frame - observations[start]!.frame,
      damage: intervalDamage(observations, start, start + period),
    };
    for (let cycle = 1; cycle < policy.data.requiredConsecutivePeriods; cycle += 1) {
      const left = start + cycle * period, right = left + period;
      const laterFrames = observations[right]!.frame - observations[left]!.frame;
      const laterDamage = intervalDamage(observations, left, right);
      if (laterFrames !== firstInterval.frames || laterDamage !== firstInterval.damage) {
        valid = false;
        if (intervalDifferences.length < 8) intervalDifferences.push({
          first: { startFrame: observations[start]!.frame, endFrame: observations[start + period]!.frame,
            frames: firstInterval.frames, damage: firstInterval.damage },
          later: { startFrame: observations[left]!.frame, endFrame: observations[right]!.frame,
            frames: laterFrames, damage: laterDamage },
        });
      }
    }
    if (!valid) continue;
    return { status: "established-for-declared-native-state", evidence: "provisional-source-state", periodCycles: period,
      steadyStateDps: firstInterval.damage * 60 / firstInterval.frames, periodDamage: firstInterval.damage,
      periodFrames: firstInterval.frames, warmupBoundaryFrame: observations[start]!.frame,
      matchedBoundaryFrames: observations.slice(start).map(row => row.frame), observationCount: observations.length,
      reasons: ["同一次来源运行在已声明完整的原生未来状态与重复输入相位下，连续周期的状态、时长和实际伤害一致；结论限于该来源域。"],
      stateDifferences: [], intervalDifferences: [] };
  }
  let lastCoverageGap = -1;
  for (let index = observations.length - 1; index >= 0; index -= 1) {
    if (observations[index]!.frame >= policy.data.warmupFrames && !coverageReady[index]) {
      lastCoverageGap = index;
      break;
    }
  }
  const reason = lastCoverageGap >= 0
    ? `第 ${lastCoverageGap + 1} 个边界的未来相关原生状态未闭合：${observations[lastCoverageGap]!.coverage.gaps.join("；") || "必需提供者或其规范化状态缺失"}。`
    : candidateInputGap
      ? "候选周期内有原生解释器尚未验证的重复输入相位。"
      : futureInputMismatch
        ? "候选周期的未来输入签名在同一周期位置不一致。"
        : "有限预热与周期上限内，原生相位状态、实际时长或实际伤害尚未形成连续闭合周期。";
  return invalid(reason, observations.length, differences, intervalDifferences);
}
