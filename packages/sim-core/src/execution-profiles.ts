import { createVersionedContentHash, getRuntimeSkillCooldownActors, type LegalTimelineCommand, type ResolvedSimulationRuntimeOptions, type SimConfig, type TimelineCommandResult } from "@genshin-dps-lab/schemas";
import { compileLegalTimeline } from "./legal-timeline";
import { simulate, type SimulationRuntimeOptions } from "./simulator";

interface ExecutionProfileFields {
  id: string;
  label: string;
  referenceFps: 60;
  /** Human input latency before each ability/movement/pickup request. */
  inputDelayFrames: number;
  /** Human latency before a swap request; actual swap occupancy is unchanged. */
  swapDelayFrames: number;
  /** Additional late input when walk/dash/jump/swap follows an ability cancellation. */
  cancellationDelayFrames: number;
  evidence: "explicit-assumption";
  assumptions: string[];
}
export type ExecutionBaselineMode = "structural-v1" | "runtime-energy-v1";
export type ExecutionProfile = ExecutionProfileFields & (
  | { version: "1.0.0"; baselineMode?: "structural-v1" }
  | { version: "1.1.0"; baselineMode: "runtime-energy-v1" }
);

export const IDEALIZED_EXECUTION_PROFILE: ExecutionProfile = {
  id: "idealized-input", version: "1.1.0", baselineMode: "runtime-energy-v1", label: "理想输入（零额外延迟）", referenceFps: 60,
  inputDelayFrames: 0, swapDelayFrames: 0, cancellationDelayFrames: 0, evidence: "explicit-assumption",
  assumptions: ["只使用原动作定义的合法时点；零额外人为延迟不是现实操作保证。"],
};
export const PRACTICAL_EXECUTION_PROFILE: ExecutionProfile = {
  id: "practical-assumed-input", version: "1.1.0", baselineMode: "runtime-energy-v1", label: "实用输入（声明的延迟假设）", referenceFps: 60,
  inputDelayFrames: 2, swapDelayFrames: 6, cancellationDelayFrames: 4, evidence: "explicit-assumption",
  assumptions: ["每次技能/移动/拾取请求延后2帧，换人请求延后6帧；基线中取消实际已接受能力动画的闪避/跳跃/换人另延后4帧。", "这是可编辑工程情景，不是玩家操作实测分布，也不宣称KQMS延迟合规。"],
};
export const CONSERVATIVE_EXECUTION_PROFILE: ExecutionProfile = {
  id: "conservative-assumed-input", version: "1.1.0", baselineMode: "runtime-energy-v1", label: "保守输入（声明的延迟假设）", referenceFps: 60,
  inputDelayFrames: 6, swapDelayFrames: 12, cancellationDelayFrames: 8, evidence: "explicit-assumption",
  assumptions: ["每次技能/移动/拾取请求延后6帧，换人请求延后12帧；基线中取消实际已接受能力动画的闪避/跳跃/换人另延后8帧。", "这是可编辑工程情景，不是实战伤害固定折扣。"],
};
export const EXECUTION_PROFILES: readonly ExecutionProfile[] = [IDEALIZED_EXECUTION_PROFILE, PRACTICAL_EXECUTION_PROFILE, CONSERVATIVE_EXECUTION_PROFILE];

export function createCustomExecutionProfile(input: { inputDelayFrames: number; swapDelayFrames: number; cancellationDelayFrames: number }): ExecutionProfile {
  const profile: ExecutionProfile = {
    id: "custom-input", version: "1.1.0", baselineMode: "runtime-energy-v1", label: "自定义输入延迟", referenceFps: 60, ...input,
    evidence: "explicit-assumption", assumptions: ["输入帧数由用户明确指定；没有自动推断设备、网络或玩家操作分布。"],
  };
  validateExecutionProfile(profile);
  return profile;
}

function validateExecutionProfile(profile: ExecutionProfile): void {
  const validBaseline = profile.version === "1.0.0" ? profile.baselineMode === undefined || profile.baselineMode === "structural-v1" : profile.version === "1.1.0" && profile.baselineMode === "runtime-energy-v1";
  if (profile.referenceFps !== 60 || !validBaseline || typeof profile.id !== "string" || !profile.id.trim() || typeof profile.label !== "string" || profile.evidence !== "explicit-assumption" || !Array.isArray(profile.assumptions) || !profile.assumptions.every((row) => typeof row === "string") ||
      ![profile.inputDelayFrames, profile.swapDelayFrames, profile.cancellationDelayFrames].every((frames) => Number.isInteger(frames) && frames >= 0 && frames <= 600)) {
    throw new Error("执行方案必须声明受支持版本/基线模式、60 FPS参考帧及0–600帧的明确非负输入延迟。");
  }
}

/** Restore saved semantics verbatim; matching a current preset ID never upgrades 1.0.0. */
export function parseExecutionProfile(raw: unknown): ExecutionProfile {
  if (raw === null || typeof raw !== "object") throw new Error("无法读取执行配置。");
  const profile = raw as ExecutionProfile;
  validateExecutionProfile(profile);
  return structuredClone(profile);
}

export interface ExecutionDelayEntry {
  commandIndex: number;
  commandType: LegalTimelineCommand["type"];
  originalStartTick: number;
  requestedTick: number;
  addedDelayFrames: number;
  cumulativeDelayFrames: number;
  baselineStatus: TimelineCommandResult["status"];
  baselineFailureCode?: TimelineCommandResult["failureCode"];
  reason: "explicit-wait-preserved" | "ability-input" | "swap-input" | "cancellation-input" | "movement-or-pickup-input";
}
export interface AppliedExecutionProfile {
  config: SimConfig;
  profile: ExecutionProfile;
  profileKey: string;
  baselineMode: ExecutionBaselineMode;
  /** Present only when the shared simulator resolved the actual baseline. */
  baselineRuntimeOptions?: ResolvedSimulationRuntimeOptions;
  assumptions: string[];
  changes: ExecutionDelayEntry[];
  originalCommandIndices: number[];
  baselineExecutableTicks: number;
  /** The actual simulator may reject late inputs (duration/state/energy). */
  lastRequestedTick: number;
}

/**
 * Converts human latency to actual request timestamps. Never edits attack frames,
 * cancellation windows, cooldowns, hits, particles, buffs, or entity lifetimes.
 * Current profiles use simulate()'s accepted/failed requests with the exact caller
 * options. Historical 1.0.0 profiles retain their structural-only interpretation.
 */
export function applyExecutionProfile(input: SimConfig, profile: ExecutionProfile, runtimeOptions: SimulationRuntimeOptions = {}): AppliedExecutionProfile {
  validateExecutionProfile(profile);
  if (!input.timeline) throw new Error("输入延迟方案需要含动作定义的合法帧时间线。");
  const baselineMode: ExecutionBaselineMode = profile.version === "1.0.0" ? "structural-v1" : profile.baselineMode;
  if (baselineMode === "structural-v1" && getRuntimeSkillCooldownActors(input).size > 0) throw new Error("旧1.0.0结构基线不能解析实际技能冷却队列；请明确选择1.1.0真实运行基线。");
  const runtimeBaseline = baselineMode === "runtime-energy-v1" ? simulate(input, runtimeOptions) : undefined;
  const baseline = runtimeBaseline === undefined ? compileLegalTimeline(input).execution : runtimeBaseline.timelineExecution!;
  const results = new Map(baseline.commandResults.map((result) => [result.commandIndex, result]));
  const config = structuredClone(input);
  const changes: ExecutionDelayEntry[] = [];
  let cumulativeDelayFrames = 0;
  let acceptedAbility: TimelineCommandResult | undefined;
  const commands = input.timeline.commands.map((command, index): LegalTimelineCommand => {
    const result = results.get(index);
    const energyRejected = baselineMode === "runtime-energy-v1" && result?.status === "rejected" && result.failureCode === "INSUFFICIENT_ENERGY";
    if (!result || result.startFrame === null || (result.status === "rejected" && !energyRejected)) throw new Error(`指令${index}没有合法基线起点，不能套用操作延迟。`);
    const baselineOutcome = {baselineStatus: result.status, ...(result.failureCode === undefined ? {} : {baselineFailureCode: result.failureCode})};
    if (command.type === "wait") {
      changes.push({ commandIndex: index, commandType: command.type, originalStartTick: result.startFrame,
        requestedTick: result.startFrame + cumulativeDelayFrames, addedDelayFrames: 0, cumulativeDelayFrames, ...baselineOutcome, reason: "explicit-wait-preserved" });
      return structuredClone(command);
    }
    const previous = input.timeline!.commands[index - 1];
    const cancelCandidate = command.type === "walk" || command.type === "dash" || command.type === "jump" || command.type === "swap";
    const cancelInput = cancelCandidate && (baselineMode === "structural-v1"
      ? previous !== undefined && "abilityId" in previous
      : acceptedAbility?.animationEndFrame !== null && acceptedAbility?.animationEndFrame !== undefined && result.startFrame < acceptedAbility.animationEndFrame);
    const addedDelayFrames = (command.type === "swap" ? profile.swapDelayFrames : profile.inputDelayFrames) + (cancelInput ? profile.cancellationDelayFrames : 0);
    cumulativeDelayFrames += addedDelayFrames;
    const requestedTick = result.startFrame + cumulativeDelayFrames;
    changes.push({ commandIndex: index, commandType: command.type, originalStartTick: result.startFrame, requestedTick,
      addedDelayFrames, cumulativeDelayFrames, ...baselineOutcome, reason: cancelInput ? "cancellation-input" : command.type === "swap" ? "swap-input" : "abilityId" in command ? "ability-input" : "movement-or-pickup-input" });
    if (result.status !== "rejected") {
      if ("abilityId" in command) acceptedAbility = result;
      else if (cancelCandidate) acceptedAbility = undefined;
    }
    return { ...structuredClone(command), atFrame: requestedTick };
  });
  config.timeline!.commands = commands;
  return { config, profile: structuredClone(profile), profileKey: createVersionedContentHash(profile), baselineMode,
    ...(runtimeBaseline === undefined ? {} : {baselineRuntimeOptions: structuredClone(runtimeBaseline.resolvedRuntimeOptions)}), changes,
    originalCommandIndices: commands.map((_, index) => index), baselineExecutableTicks: baseline.totalFrames,
    lastRequestedTick: Math.max(0, ...changes.map((change) => change.requestedTick)),
    assumptions: [...profile.assumptions,
      "逐次延迟实际行动请求；技能命中、产球、冷却、取消窗口及状态寿命相对技能出手的时序完全保留。",
      baselineMode === "runtime-energy-v1" ? "原轮转复用相同运行选项和种子的真实模拟基线，包括实际能量与技能冷却反馈；能量失败仍保留输入，取消延迟只依据实际接受的能力动画。" : "旧1.0.0保留结构编译基线及相邻能力输入的取消假设，不自动升级为真实能量基线。",
      ...(baselineMode === "runtime-energy-v1" ? ["基线是选定种子的单一参考轨迹；批次各次迭代重用由此生成的固定请求表，最终模拟重新判断资源，不按每个迭代种子自适应修改后续输入。"] : []),
      "显式wait保留，人工延迟沿后续请求累计，不把DPS乘固定折扣。",
      "延迟后的请求可能越过buff/资源或观察窗口；这些失败由模拟器报告，不延长效果寿命或自动补能。",
      "本方案采用确定性的预定输入时间；能量不足的失败输入不会使后续预定请求提前。"],
  };
}
