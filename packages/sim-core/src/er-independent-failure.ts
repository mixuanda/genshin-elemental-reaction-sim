import { getRuntimeSkillCooldownActors, type SimConfig, type SimulationResult, type TimelineFailure, type TimelineFailureCode } from "@genshin-dps-lab/schemas";
import type { SimulationRuntimeOptions } from "./simulator";
import { compileLegalTimeline, TimelineLegalityError } from "./legal-timeline";
import { ENERGY_COMPARISON_EPSILON, quantizeEnergy } from "./energy";

interface ProofExplanation {
  commandIndex: number;
  actorId: string;
  formula: string;
  variables: Record<string, string>;
  substitution: string;
  explanation: string;
  assumptions: string[];
}

type TimelineObservation =
  | { kind: "simulation-error"; energyRecharge: number; failure: TimelineFailure }
  | { kind: "candidate-result"; energyRecharge: number; reproducibilityKey: string };

export type ErIndependentFailureProof = ProofExplanation & (
  | { kind: "cost-exceeds-capacity"; abilityId: string; energyCost: number; energyMax: number; comparisonEpsilon: number;
      evidence: { energyRecharge: number; reproducibilityKey: string; failure: SimulationResult["skippedActions"][number] } }
  | { kind: "all-success-timeline-illegal"; failure: TimelineFailure; evidence: TimelineObservation }
);

/** A rejected fixed command plus the executor's hard capacity bound, not a grid extrapolation. */
export function proveEnergyCapacityFailure(result: SimulationResult, actorId: string, requested: readonly number[], er: number, options: SimulationRuntimeOptions): ErIndependentFailureProof | undefined {
  if (options.plugins?.length) return;
  const actor = result.config.characters.find(character => character.id === actorId)!;
  const energyMax = quantizeEnergy(actor.energyMax);
  for (const failure of result.skippedActions) {
    const index = failure.timelineCommandIndex;
    if (failure.actorId !== actorId || failure.reasonCode !== "INSUFFICIENT_ENERGY" || index === undefined || !requested.includes(index)) continue;
    const command = result.config.timeline!.commands[index]!;
    if (!("abilityId" in command) || (command.type === "normal" && command.sourceNormalChain === "next-v1")) continue;
    const ability = result.config.timeline!.abilities.find(item => item.id === command.abilityId)!;
    const energyCost = quantizeEnergy(ability.energyCost ?? 0);
    if (failure.energyCost !== energyCost || energyCost <= energyMax + ENERGY_COMPARISON_EPSILON) continue;
    return {
      kind: "cost-exceeds-capacity", commandIndex: index, actorId, abilityId: ability.id, energyCost, energyMax, comparisonEpsilon: ENERGY_COMPARISON_EPSILON,
      formula: "E_available ≤ E_max < C − ε ⇒ C > E_available + ε",
      variables: { E_available: "扣除已预留能量后的可用能量", E_max: "角色固定能量容量（按执行器保留 12 位小数）", C: "该动作实际耗能（同一精度）", ε: "执行器允许的能量比较误差" },
      substitution: `实际失败时 E_available = ${failure.energyBefore}；容量 E_max = ${energyMax}；C = ${energyCost} > ${energyMax} + ${ENERGY_COMPARISON_EPSILON} = ${energyMax + ENERGY_COMPARISON_EPSILON}。`,
      explanation: `第 ${index + 1} 条动作需要 ${energyCost} 能量，超过角色容量 ${energyMax}。初能和所有回能均受容量上限约束；提高充能效率无法使此动作可用。`,
      assumptions: ["仅修改该角色充能效率；角色容量、动作耗能和完整轮转保持不变。", "依据本地执行器的实际能量拒绝与容量约束；不把合成输入视为游戏数值验证。"],
      evidence: { energyRecharge: er, reproducibilityKey: result.reproducibilityKey, failure: structuredClone(failure) },
    };
  }
}

const STATIC_FAILURES = new Set<TimelineFailureCode>([
  "ACTION_OVERLAP", "ABILITY_ON_COOLDOWN", "INSUFFICIENT_STAMINA", "WRONG_ACTIVE_CHARACTER", "ALREADY_ACTIVE", "MISSING_REQUIRED_STATE", "OUT_OF_DURATION",
]);

/** Every energy rejection already fails the full-command objective. If the remaining
 * all-energy-success path is illegal too, no ER can satisfy that objective. */
export function proveAllSuccessTimelineFailure(config: SimConfig, options: SimulationRuntimeOptions, evidence: TimelineObservation): ErIndependentFailureProof | undefined {
  if (options.plugins?.length || getRuntimeSkillCooldownActors(config).size > 0 || options.execution?.stellarSwirl) return;
  let failure: TimelineFailure | undefined;
  try {
    failure = compileLegalTimeline(config).execution.failures.find(item => STATIC_FAILURES.has(item.code));
  } catch (error) {
    if (error instanceof TimelineLegalityError && STATIC_FAILURES.has(error.failure.code)) failure = error.failure;
  }
  if (!failure) return;
  const command = config.timeline!.commands[failure.commandIndex]!;
  return {
    kind: "all-success-timeline-illegal", commandIndex: failure.commandIndex, actorId: command.type === "swap" ? command.characterId : "actorId" in command ? command.actorId : config.timeline!.initialActiveCharacterId,
    failure: structuredClone(failure), evidence,
    formula: "完整轮转成功 ⇒ 全部耗能动作成功 ∧ 该路径的严格时间线合法；该路径非法 ⇒ 完整轮转无解",
    variables: { "全部耗能动作成功": "编译时不提供任何能量拒绝，保留全部成功动作对时序、冷却、状态和体力的影响", "严格时间线合法": "每个原定指令都满足动作时间、固定冷却、前台、状态、体力及观察时长约束" },
    substitution: `全部耗能动作成功的路径：第 ${failure.commandIndex + 1} 条指令，第 ${failure.frame} 帧，${failure.code}；${failure.message}`,
    explanation: "若任一耗能动作被拒绝，完整轮转已失败；若全部成功，所示固定时间线约束仍失败。因此单独提高充能效率不能使原轮转完整执行。",
    assumptions: ["仅修改充能效率，严格轮转、观察窗口和其余配置不变。", "无动态战技冷却反馈、星旋腾空反馈或可执行插件；未据有限网格失败外推。", "证明限于本地执行器声明的完整轮转目标，不代表游戏机制已验证。"],
  };
}
