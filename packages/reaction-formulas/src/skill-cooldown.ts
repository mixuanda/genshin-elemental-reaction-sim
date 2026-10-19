/** One actor's shared E slot. All variants must use this same state and charge count. */
export interface SerialSkillCooldownEntry {
  castId: string;
  abilityId: string;
  /** Actual duration after cooldown modifiers, sampled when SetCD really runs. */
  recoveryFrames: number;
}
export interface SerialSkillCooldownState {
  maxCharges: number;
  availableCharges: number;
  queue: SerialSkillCooldownEntry[];
  /** Start of the currently active queue worker; null when no worker is active. */
  workerStartedFrame: number | null;
  /** Models worker pointer identity, including replacements in the same frame. */
  workerGeneration: number;
}
export interface SerialSkillCooldownWorker { frame: number; generation: number }

export function createSerialSkillCooldown(maxCharges: number): SerialSkillCooldownState {
  return {maxCharges, availableCharges: maxCharges, queue: [], workerStartedFrame: null, workerGeneration: 0};
}
export function serialSkillCooldownWorker(state: SerialSkillCooldownState): SerialSkillCooldownWorker | null {
  const head = state.queue[0];
  return head === undefined || state.workerStartedFrame === null ? null : {frame: state.workerStartedFrame + head.recoveryFrames, generation: state.workerGeneration};
}
export function serialSkillCooldownRemaining(state: SerialSkillCooldownState, frame: number): number {
  if (state.availableCharges > 0) return 0;
  const worker = serialSkillCooldownWorker(state);
  return worker === null ? 0 : worker.frame - frame;
}

/** Call only at actual SetCD, not when its delayed callback is scheduled. */
export function startSerialSkillCooldown(state: SerialSkillCooldownState, frame: number, entry: SerialSkillCooldownEntry): SerialSkillCooldownState {
  if (state.availableCharges <= 0) throw new Error("实际技能冷却启动时没有可扣除的充能。");
  const first = state.queue.length === 0;
  return {...state, availableCharges: state.availableCharges - 1, queue: [...state.queue, {...entry}], workerStartedFrame: first ? frame : state.workerStartedFrame, workerGeneration: state.workerGeneration + Number(first)};
}

function restoreOne(state: SerialSkillCooldownState, frame: number): SerialSkillCooldownState {
  const queue = state.queue.slice(1);
  return {...state, availableCharges: state.availableCharges + 1, queue, workerStartedFrame: queue.length === 0 ? null : frame, workerGeneration: state.workerGeneration + 1};
}

/** Restore only the head charge; the next saved duration starts in full from this frame. */
export function resetSerialSkillCooldown(state: SerialSkillCooldownState, frame: number): SerialSkillCooldownState {
  return state.availableCharges === state.maxCharges ? state : restoreOne(state, frame);
}

/** The host invokes its scheduled worker in event order; stale workers have no effect. */
export function recoverSerialSkillCooldown(state: SerialSkillCooldownState, frame: number, workerGeneration: number): SerialSkillCooldownState {
  const worker = serialSkillCooldownWorker(state);
  if (worker === null || worker.generation !== workerGeneration || frame < worker.frame) return state;
  return restoreOne(state, frame);
}
