import type { ReactionDamageGroupTaskEngine, ReactionDamageGroupResetTask } from "./reaction-damage-group";
import type { OrdinaryAuraCapturedState } from "./ordinary-aura-checkpoint";

interface LifecycleSource { generation: number; actorId: string; triggerDamageEventId: number }
export interface NonPeriodicReactionHostState {
  frozenSources: ReadonlyMap<string, LifecycleSource>;
  quickenSources: ReadonlyMap<string, LifecycleSource>;
  frozenExpiryScheduleKeys: ReadonlySet<string>;
  quickenExpiryScheduleKeys: ReadonlySet<string>;
  damageGroups: ReturnType<ReactionDamageGroupTaskEngine["captureState"]>;
  pendingFreezeBrokenCallbacks: number;
}

export function reactionLifecycleGeneration(
  aura: ReadonlyMap<string, OrdinaryAuraCapturedState> | undefined,
  targetId: string, kind: "frozen" | "quicken", generation: number,
) {
  const state = aura?.get(targetId)?.nonPeriodicReactions;
  if (state === undefined) throw new Error("反应生命周期任务缺少实际目标代次。");
  return generation - (kind === "frozen" ? state.frozenGeneration : state.quickenGeneration);
}

export function normalizeReactionResetTask(task: Readonly<ReactionDamageGroupResetTask>, state: NonPeriodicReactionHostState, tick: number) {
  const currentGeneration = new Map(state.damageGroups.lastGeneration).get(task.scopeKey);
  if (currentGeneration === undefined) throw new Error("反应伤害组任务缺少实际窗口代次。");
  return { policyId: task.policyId, scopeKey: task.scopeKey, targetId: task.targetId, actorId: task.actorId,
    reactionTag: task.reactionTag, icdTag: task.icdTag, icdGroup: task.icdGroup,
    relativeGeneration: task.windowGeneration - currentGeneration,
    windowAgeTicks: tick - task.windowStartFrame, resetRemainingTicks: task.resetAtFrame - tick,
    ...(task.withinSimulation ? {} : { withinSimulation: false }) };
}

/** Only mechanics are canonicalized; actual queue ordering remains with the host. */
export function normalizeNonPeriodicReactionHost(input: {
  state: NonPeriodicReactionHostState;
  aura: ReadonlyMap<string, OrdinaryAuraCapturedState> | undefined;
  tick: number;
  pendingEvents: readonly { type: string; frame: number; payload: unknown }[];
}) {
  const { state, aura, tick, pendingEvents } = input;
  if (state.pendingFreezeBrokenCallbacks !== 0) throw new Error("冻结破裂回调仍在执行，不能捕获为完整帧前状态。");
  if (state.damageGroups.lastOperation.some(([, operation]) => operation.frame >= tick)) throw new Error("反应伤害组已执行检查点帧，不能标为事件前状态。");
  const lifecycle = (kind: "frozen" | "quicken", sources: ReadonlyMap<string, LifecycleSource>, keys: ReadonlySet<string>) => {
    const tasks = [...keys].map(key => {
      const [targetId, generationText, frameText] = key.split("\u0000");
      const generation = Number(generationText), frame = Number(frameText);
      if (targetId === undefined || !Number.isSafeInteger(generation) || !Number.isSafeInteger(frame) || frame < tick) throw new Error("反应到期去重状态不属于完整事件前边界。");
      if (!pendingEvents.some(event => {
        const task = event.payload as { targetId?: string; generation?: number; expectedExpiryFrame?: number };
        return event.type === `${kind}Expiry` && event.frame === frame && task.targetId === targetId && task.generation === generation && task.expectedExpiryFrame === frame;
      })) throw new Error("反应到期状态缺少真实待执行任务，观察尾段被截断。");
      return { targetId, relativeGeneration: reactionLifecycleGeneration(aura, targetId, kind, generation), remainingTicks: frame - tick };
    }).sort((a, b) => a.remainingTicks - b.remainingTicks || a.targetId.localeCompare(b.targetId) || a.relativeGeneration - b.relativeGeneration);
    return { sources: [...sources].map(([targetId, source]) => ({ targetId, actorId: source.actorId,
      relativeGeneration: reactionLifecycleGeneration(aura, targetId, kind, source.generation) })).sort((a, b) => a.targetId.localeCompare(b.targetId)), tasks };
  };
  const group = state.damageGroups;
  const generations = new Map(group.lastGeneration);
  const resets = group.pendingResets.map(task => {
    if (task.resetAtFrame < tick || !pendingEvents.some(event => {
      const queued = (event.payload as { task?: ReactionDamageGroupResetTask }).task;
      return event.type === "reactionDamageGroupReset" && event.frame === task.resetAtFrame && queued?.scopeKey === task.scopeKey && queued.windowGeneration === task.windowGeneration && queued.taskSequence === task.taskSequence;
    })) throw new Error("反应伤害组缺少完整待执行重置队列。");
    return normalizeReactionResetTask(task, state, tick);
  });
  return {
    frozen: lifecycle("frozen", state.frozenSources, state.frozenExpiryScheduleKeys),
    quicken: lifecycle("quicken", state.quickenSources, state.quickenExpiryScheduleKeys),
    damageGroups: { model: group.model,
      windows: group.windows.filter(window => window.resetTask !== null || window.resetAtFrame > tick).map(window => ({
        scopeKey: window.scopeKey, reactionTag: window.reactionTag, icdTag: window.icdTag, icdGroup: window.icdGroup,
        relativeGeneration: window.generation - generations.get(window.scopeKey)!,
        windowAgeTicks: tick - window.windowStartFrame, resetRemainingTicks: window.resetAtFrame - tick, nextHitIndex: window.nextHitIndex,
        resetTask: window.resetTask === null ? null : normalizeReactionResetTask(window.resetTask, state, tick),
      })).sort((a, b) => a.scopeKey.localeCompare(b.scopeKey)),
      pendingResets: resets,
    },
  };
}
