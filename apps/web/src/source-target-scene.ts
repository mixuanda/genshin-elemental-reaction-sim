import { sourceTargetProfileClause, validateSourceTargetProfile, type SourceTargetProfile } from "./source-target-profile";
import { sourceHostTargetPhasePolicy, sourceHostTargetPhaseRequestSchema, type SourceHostTargetPhaseRequest } from "../../../packages/sim-core/src/source-host-target-phase";

export interface SourceTargetSceneInput {
  target: SourceTargetProfile;
  additionalTargets?: SourceTargetProfile[];
  /** Zero-based statistics selection; native default target and facing remain source-owned. */
  primaryTargetIndex?: number;
}

export function resolveSourceTargetScene(input: SourceTargetSceneInput): {
  targets: SourceTargetProfile[];
  primaryTargetIndex: number;
} {
  if (input.additionalTargets !== undefined && !Array.isArray(input.additionalTargets))
    throw new Error("追加目标须为目标配置数组。");
  const targets = [input.target, ...(input.additionalTargets ?? [])];
  for (const target of targets) {
    if (target === null || typeof target !== "object") throw new Error("每个目标须有完整来源配置。");
    validateSourceTargetProfile(target);
  }
  const primaryTargetIndex = input.primaryTargetIndex === undefined ? 0 : input.primaryTargetIndex;
  if (!Number.isInteger(primaryTargetIndex) || primaryTargetIndex < 0 || primaryTargetIndex >= targets.length)
    throw new Error("统计目标索引须指向已声明的目标。");
  if (targets.some(target => target.hp !== undefined) && targets.some(target => target.hp === undefined))
    throw new Error("原生生命模式为全局设置；所有目标都须显式填写生命，不能混用默认时长目标。");
  return { targets, primaryTargetIndex };
}

export function sourceTargetSceneClauses(input: SourceTargetSceneInput): string[] {
  return resolveSourceTargetScene(input).targets.map(sourceTargetProfileClause);
}

/** Flattens only explicitly declared per-target phase scenarios into the native request shape. */
export function sourceTargetPhasesRequest(input: SourceTargetSceneInput): SourceHostTargetPhaseRequest | undefined {
  const phases = resolveSourceTargetScene(input).targets.flatMap((target, targetIndex) =>
    (target.phases ?? []).map(phase => ({ ...phase, targetIndex })));
  return phases.length
    ? sourceHostTargetPhaseRequestSchema.parse({ policy: sourceHostTargetPhasePolicy, phases })
    : undefined;
}
