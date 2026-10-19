import type {
  TargetPhaseV2LogEntry,
  TargetPhaseV3LogEntry,
} from "@genshin-dps-lab/schemas";

interface TargetDecayCheckpointKey {
  frame: number;
  targetId: string;
}

interface TargetPhaseRuntimeState {
  entry: TargetPhaseV2LogEntry | TargetPhaseV3LogEntry;
  emitted: boolean;
  decayMaterialized: boolean;
  hasBeforeReactableInlineDelivery: boolean;
}

type CapturedTargetPhase = TargetPhaseRuntimeState["entry"] &
  Omit<TargetPhaseRuntimeState, "entry">;

/** Raw runtime state, including history; capture never advances Aura or clocks. */
export interface TargetPhaseV2CheckpointState {
  model: "target-phase-v2";
  lastProcessedFrame: number | null;
  scheduledDecay: TargetDecayCheckpointKey[];
  completedDecay: TargetDecayCheckpointKey[];
  phases: CapturedTargetPhase[];
}

function decodeDecayKey(key: string): TargetDecayCheckpointKey {
  const separator = key.indexOf("\u0000");
  const frame = Number(key.slice(0, separator));
  if (separator < 1 || !Number.isInteger(frame)) {
    throw new Error("目标阶段检查点含无效的衰减去重键。");
  }
  return { frame, targetId: key.slice(separator + 1) };
}

function decayKey({ frame, targetId }: TargetDecayCheckpointKey): string {
  return `${frame}\u0000${targetId}`;
}

export function captureTargetPhaseV2State(input: {
  lastProcessedFrame: number | null;
  scheduledDecayKeys: ReadonlySet<string>;
  completedDecayKeys: ReadonlySet<string>;
  states: Iterable<TargetPhaseRuntimeState>;
}): TargetPhaseV2CheckpointState {
  return {
    model: "target-phase-v2",
    lastProcessedFrame: input.lastProcessedFrame,
    scheduledDecay: [...input.scheduledDecayKeys].map(decodeDecayKey),
    completedDecay: [...input.completedDecayKeys].map(decodeDecayKey),
    phases: [...input.states].map(({ entry, ...flags }) => ({
      ...structuredClone(entry),
      ...flags,
    })),
  };
}

interface PendingTargetPhaseEvent {
  type: string;
  frame: number;
  payload: unknown;
}

/**
 * Only for target-phase-v2 with its target clock disabled. The host separately
 * verifies the complete ordinary-Aura input domain and serializes the real
 * queue's priority/FIFO order. No decay event is reconstructed here.
 */
export function normalizeTargetPhaseV2Checkpoint(input: {
  state: TargetPhaseV2CheckpointState;
  tick: number;
  durationTicks: number;
  retainedReactionTail?: boolean;
  pendingEvents: readonly PendingTargetPhaseEvent[];
}) {
  const { state, tick, durationTicks, pendingEvents } = input;
  if (state.lastProcessedFrame !== null && state.lastProcessedFrame >= tick) {
    throw new Error("目标阶段已执行当前检查点帧，不能标为事件前状态。");
  }
  if (pendingEvents.some(event => event.frame < tick)) {
    throw new Error("目标阶段检查点之前仍有未执行事件。");
  }
  if (state.phases.some(phase => phase.model !== "target-phase-v2")) {
    throw new Error("目标阶段 v3 的回调状态不属于普通附着检查点域。");
  }
  if (state.completedDecay.some(row => row.frame >= tick)) {
    throw new Error("目标阶段已完成当前或未来帧的衰减，不能捕获帧前状态。");
  }

  const phases = state.phases.filter(phase => phase.globalFrame >= tick);
  if (phases.some(phase => phase.decayMaterialized || phase.hasBeforeReactableInlineDelivery ||
      phase.targetTasks.length > 0 || phase.reactableTick.transitions.length > 0)) {
    throw new Error("目标阶段含已执行的帧内衰减、回调或生命周期转换，尚未支持完整捕获。");
  }
  if (!input.retainedReactionTail && phases.some(phase => phase.globalFrame > durationTicks)) {
    throw new Error("目标阶段检查点含模拟范围之外的待执行阶段。");
  }

  const scheduled = new Map<string, TargetDecayCheckpointKey>();
  for (const row of state.scheduledDecay) {
    const key = decayKey(row);
    if (row.frame < tick || (!input.retainedReactionTail && row.frame > durationTicks) || scheduled.has(key)) {
      throw new Error("目标阶段待执行衰减键越过检查点范围或重复。");
    }
    scheduled.set(key, row);
  }
  const queued = new Set<string>();
  for (const event of pendingEvents) {
    if (event.type !== "targetDecay") continue;
    const payload = event.payload as { targetId?: unknown } | null;
    if (payload === null || typeof payload !== "object" || typeof payload.targetId !== "string") {
      throw new Error("待执行目标衰减缺少实际目标。");
    }
    const key = decayKey({ frame: event.frame, targetId: payload.targetId });
    if (!scheduled.has(key) || queued.has(key)) {
      throw new Error("目标衰减队列与实际去重状态不一致。");
    }
    queued.add(key);
  }
  if (queued.size !== scheduled.size) {
    throw new Error("目标阶段存在未进入实际队列的待执行衰减。");
  }

  const normalizeAura = (aura: TargetPhaseV2LogEntry["auraBeforeTargetTasks"]) =>
    aura.map(({ expiresAtFrame, expiresAtTargetFrame, ...entry }) => ({
      ...structuredClone(entry),
      expiryRemainingTicks: expiresAtFrame === null ? null : expiresAtFrame - tick,
      ...(expiresAtTargetFrame === undefined ? {} : {
        targetExpiryRemainingTicks: expiresAtTargetFrame === null ? null : expiresAtTargetFrame - tick,
      }),
    }));
  const normalizeKeys = (keys: readonly TargetDecayCheckpointKey[]) => keys
    .filter(row => row.frame >= tick)
    .map(row => ({ remainingTicks: row.frame - tick, targetId: row.targetId }))
    .sort((left, right) => left.remainingTicks - right.remainingTicks || left.targetId.localeCompare(right.targetId));

  // Old phase entries may still receive late natural-expiry audit references;
  // they cannot rerun decay after the queue has drained all frames < tick.
  // The last-emitted cursor and `emitted` only write log IDs/fromTargetFrame,
  // so neither contributes to mechanical state equivalence at this boundary.
  return {
    model: state.model,
    scheduledDecay: normalizeKeys(state.scheduledDecay),
    completedDecay: normalizeKeys(state.completedDecay),
    phases: phases.map(phase => ({
      model: phase.model,
      remainingTicks: phase.globalFrame - tick,
      targetId: phase.targetId,
      targetOrder: phase.targetOrder,
      targetFrameOffset: phase.targetFrame - tick,
      decayMaterialized: phase.decayMaterialized,
      hasBeforeReactableInlineDelivery: phase.hasBeforeReactableInlineDelivery,
      auraBeforeTargetTasks: normalizeAura(phase.auraBeforeTargetTasks),
      targetTasks: structuredClone(phase.targetTasks),
      auraAfterTargetTasks: normalizeAura(phase.auraAfterTargetTasks),
      reactableTick: {
        fromTargetFrameOffset: phase.reactableTick.fromTargetFrame - tick,
        toTargetFrameOffset: phase.reactableTick.toTargetFrame - tick,
        auraBefore: normalizeAura(phase.reactableTick.auraBefore),
        transitions: structuredClone(phase.reactableTick.transitions),
        auraAfter: normalizeAura(phase.reactableTick.auraAfter),
      },
    })).sort((left, right) => left.remainingTicks - right.remainingTicks || left.targetOrder - right.targetOrder),
  };
}
