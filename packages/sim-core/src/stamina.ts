import type { StaminaCost, StaminaModel, StaminaResult } from "@genshin-dps-lab/schemas";

/** Pinned gcsim reference semantics; these constants are not a server-verified claim. */
export const STAMINA_PROFILE = {
  id: "gcsim-b4ae769-stamina-v1",
  maximum: 240,
  recoveryPerSecond: 25,
  recoveryDelayFrames: 90,
  sourceRevision: "b4ae769",
  evidenceStatus: "fixed-source-assumed",
  order: "player-recovery-before-delayed-tasks-before-action-input",
} as const;

const recoveredStamina = (before: number, frames: number): number => Math.min(240, before + frames * 25 / 60);

function recoveryLog(sequence: number, startFrame: number, frame: number, before: number, after: number): StaminaResult["logs"][number] {
  const frames = frame - startFrame + 1;
  return { sequence, operation: "recover", frame, startFrame, actorId: null, commandIndex: null,
    amount: after - before, before, after,
    formula: "S_after = min(240, S_before + N × 25 / 60)",
    substitution: `min(240, ${before} + ${frames} × 25 / 60) = ${after}`,
    explanation: `S_before/S_after 为恢复前后的共享体力；N = ${frames} 个符合 F − LastStamUse > 90 的玩家恢复帧；恢复先于同帧延迟扣除和行动输入。`,
  };
}

/** Read-only half-open observation: retain events strictly before endFrame. */
export function staminaTraceBefore(result: StaminaResult, endFrame: number): StaminaResult {
  const logs: StaminaResult["logs"] = [];
  for (const row of result.logs) {
    if (row.frame < endFrame) logs.push({ ...row });
    else if (row.operation === "recover" && row.startFrame < endFrame) {
      const frame = endFrame - 1;
      logs.push(recoveryLog(row.sequence, row.startFrame, frame, row.before,
        recoveredStamina(row.before, frame - row.startFrame + 1)));
      break;
    } else break;
  }
  return { ...result, logs, finalStamina: logs.at(-1)?.after ?? result.initialStamina };
}

export interface PendingStaminaSpend {
  frame: number;
  amount: number;
  actorId: string;
  commandIndex: number | null;
  order: number;
  inputFrame: number;
  sourceActionId?: string;
  source: StaminaCost["source"];
  consumeWhenZero: boolean;
}

/** Detached, actual state before the player tick and every event at tick. */
export interface StaminaCheckpointSnapshot {
  version: "shared-stamina-state-v1";
  profileId: StaminaModel["profileId"];
  maximum: 240;
  tick: number;
  current: number;
  recovery: { nextRecoveryInTicks: number; anchorStamina: number; elapsedRecoveryTicks: number };
  pendingSpends: PendingStaminaSpend[];
}

/** Shared party pool. Recovery is advanced analytically over integer player ticks. */
export class StaminaRuntime {
  private currentFrame = -1;
  private lastUseFrame = 0;
  private afterLastUse: number;
  private stamina: number;
  private pending: PendingStaminaSpend[] = [];
  private nextSpendOrder = 0;
  private readonly logs: StaminaResult["logs"] = [];

  constructor(private readonly model: StaminaModel, private readonly recordLogs = true) {
    this.stamina = model.initialStamina;
    this.afterLastUse = model.initialStamina;
  }

  get available(): number { return this.stamina; }

  private recoverThrough(frame: number): void {
    if (frame <= this.currentFrame) return;
    const startFrame = Math.max(this.currentFrame + 1, this.lastUseFrame + 91);
    const before = this.stamina;
    const eligibleFrames = Math.max(0, frame - this.lastUseFrame - 90);
    this.stamina = recoveredStamina(this.afterLastUse, eligibleFrames);
    this.currentFrame = frame;
    if (!this.recordLogs || this.stamina === before) return;
    const previous = this.logs.at(-1);
    const combined = previous?.operation === "recover" && previous.frame + 1 === startFrame;
    const firstFrame = combined ? previous.startFrame : startFrame;
    const initial = combined ? previous.before : before;
    const row = recoveryLog(combined ? previous.sequence : this.logs.length,
      firstFrame, frame, initial, this.stamina);
    if (combined) this.logs[this.logs.length - 1] = row;
    else this.logs.push(row);
  }

  private spend(entry: PendingStaminaSpend): void {
    const before = this.stamina;
    this.stamina = Math.max(0, before - entry.amount);
    this.lastUseFrame = entry.frame;
    this.afterLastUse = this.stamina;
    if (this.recordLogs) this.logs.push({
      sequence: this.logs.length, operation: "spend", frame: entry.frame, startFrame: entry.frame,
      actorId: entry.actorId, commandIndex: entry.commandIndex,
      amount: before - this.stamina, before, after: this.stamina,
      formula: "S_after = max(0, S_before − declaredCost)",
      substitution: `max(0, ${before} − ${entry.amount}) = ${this.stamina}`,
      explanation: "S 为全队共享体力，declaredCost 为动作声明的实际费用；输入时检查声明费用，实际扣除时不预留体力且下限为零，每次实际 UseStam（含显式 consumeWhenZero 零费用）重置恢复延迟。",
    });
  }

  advanceThrough(frame: number): void {
    while (this.pending[0] !== undefined && this.pending[0].frame <= frame) {
      const next = this.pending.shift()!;
      this.recoverThrough(next.frame);
      this.spend(next);
    }
    this.recoverThrough(frame);
  }

  /** Caller has performed action readiness checks; positive delays do not reserve stamina. */
  accept(cost: StaminaCost, frame: number, actorId: string, commandIndex: number | null, sourceActionId?: string): void {
    this.advanceThrough(frame);
    if (cost.amount === 0 && cost.consumeWhenZero !== true) return;
    const entry: PendingStaminaSpend = { frame: frame + cost.consumeFrame, amount: cost.amount,
      actorId, commandIndex, order: this.nextSpendOrder++, inputFrame: frame,
      ...(sourceActionId === undefined ? {} : { sourceActionId }),
      source: structuredClone(cost.source), consumeWhenZero: cost.consumeWhenZero === true };
    if (cost.consumeFrame === 0) this.spend(entry);
    else {
      this.pending.push(entry);
      this.pending.sort((left, right) => left.frame - right.frame || left.order - right.order);
    }
  }

  /** Advance the real pending-debit/recovery state until a waiting input can execute. */
  waitUntilAffordable(amount: number, startFrame: number, endFrame: number): number | null {
    this.advanceThrough(startFrame);
    if (amount > 240) return null;
    const trial = new StaminaRuntime(this.model, false);
    trial.currentFrame = this.currentFrame;
    trial.lastUseFrame = this.lastUseFrame;
    trial.afterLastUse = this.afterLastUse;
    trial.stamina = this.stamina;
    trial.pending = [...this.pending];
    let frame = startFrame;
    while (trial.stamina < amount && frame < endFrame) {
      const recoveryFrame = trial.lastUseFrame + 90 + Math.ceil((amount - trial.afterLastUse) * 60 / 25);
      const pendingFrame = trial.pending[0]?.frame ?? Number.POSITIVE_INFINITY;
      frame = Math.min(endFrame, Math.max(frame + 1, Math.min(recoveryFrame, pendingFrame)));
      trial.advanceThrough(frame);
    }
    if (trial.stamina < amount) return null;
    this.advanceThrough(frame);
    return frame;
  }

  /** Materialize every earlier player tick/task without consuming boundary-time work. */
  captureBefore(tick: number): StaminaCheckpointSnapshot {
    if (this.currentFrame >= tick) throw new Error("体力检查点必须在该帧玩家恢复和扣除任务之前取得。");
    this.advanceThrough(tick - 1);
    return {
      version: "shared-stamina-state-v1", profileId: this.model.profileId, maximum: 240, tick,
      current: this.stamina,
      recovery: {
        nextRecoveryInTicks: Math.max(0, this.lastUseFrame + 91 - tick),
        // At the cap, the old anchor has no remaining influence on future values.
        anchorStamina: this.stamina === 240 ? 240 : this.afterLastUse,
        elapsedRecoveryTicks: this.stamina === 240 ? 0 : Math.max(0, tick - 1 - this.lastUseFrame - 90),
      },
      pendingSpends: structuredClone(this.pending),
    };
  }

  finish(frame: number): StaminaResult {
    this.advanceThrough(frame);
    return { mode: this.model.mode, profileId: this.model.profileId, maximum: 240,
      initialStamina: this.model.initialStamina, finalStamina: this.stamina, logs: this.logs };
  }
}
