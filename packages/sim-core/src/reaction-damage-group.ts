import {
  GCSIM_DAMAGE_GROUP_PROFILE_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_MODE,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_MODE,
  resolveDamageGroup,
  resolveReactionDamageGroupBindingForPolicy,
  resolveReactionDamageGroupPolicyRoot,
  resolveReactionDamageGroupResetFrame,
  type GcsimReactionDamageGroupBinding,
  type GcsimReactionDamageGroupPolicyId,
  type GcsimReactionDamageGroupPolicyMode,
  type GcsimReactionDamageGroupReaction,
} from "@genshin-dps-lab/icd-profiles";

export interface ReactionDamageGroupModelSelection {
  mode: GcsimReactionDamageGroupPolicyMode;
  policyId: GcsimReactionDamageGroupPolicyId;
}

export interface ReactionDamageGroupAttempt {
  targetId: string;
  actorId: string;
  reactionTag: GcsimReactionDamageGroupReaction;
  damageSourceId: string | null;
  frame: number;
  taskSequence: number;
}

export interface ReactionDamageGroupResetTaskDraft {
  policyId: typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID;
  scopeKey: string;
  targetId: string;
  actorId: string;
  reactionTag: GcsimReactionDamageGroupReaction;
  icdTag: GcsimReactionDamageGroupBinding["icdTag"];
  icdGroup: "reaction-a" | "reaction-b";
  windowGeneration: number;
  windowStartFrame: number;
  resetAtFrame: number;
}

export interface ReactionDamageGroupResetSchedule {
  taskSequence: number;
  withinSimulation: boolean;
}

export interface ReactionDamageGroupResetTask
  extends ReactionDamageGroupResetTaskDraft, ReactionDamageGroupResetSchedule {}

export type ScheduleReactionDamageGroupReset = (
  draft: Readonly<ReactionDamageGroupResetTaskDraft>,
) => ReactionDamageGroupResetSchedule;

export interface ReactionDamageGroupDecision {
  policyId: GcsimReactionDamageGroupPolicyId;
  policyMode: GcsimReactionDamageGroupPolicyMode;
  profileId: typeof GCSIM_DAMAGE_GROUP_PROFILE_ID;
  reactionTag: GcsimReactionDamageGroupReaction;
  damageElement: GcsimReactionDamageGroupBinding["damageElement"];
  attackTag: GcsimReactionDamageGroupBinding["attackTag"];
  icdTag: GcsimReactionDamageGroupBinding["icdTag"];
  icdGroup: "reaction-a" | "reaction-b";
  targetId: string;
  actorId: string;
  damageSourceId: string | null;
  scopeKey: string;
  frame: number;
  taskSequence: number;
  windowGeneration: number;
  windowStartFrame: number;
  resetAtFrame: number;
  resetTask: Readonly<ReactionDamageGroupResetTask> | null;
  hitIndex: number;
  attemptCountAfterDecision: number;
  sequenceIndex: number;
  sequenceMultiplier: 0 | 1;
  damageAllowed: boolean;
  blockedReason: "REACTION_A_DAMAGE_ICD" | "REACTION_B_DAMAGE_ICD" | null;
}

export interface ReactionDamageGroupAttemptResult {
  decision: Readonly<ReactionDamageGroupDecision>;
  scheduledResetTask: Readonly<ReactionDamageGroupResetTask> | null;
}

export interface ReactionDamageGroupResetExecution {
  task: Readonly<ReactionDamageGroupResetTask>;
  executionFrame: number;
  executionTaskSequence: number;
  applied: boolean;
  stale: boolean;
  invalidatedReason: "WINDOW_GENERATION_MISMATCH" | "ALREADY_EXECUTED" | null;
}

interface WindowState {
  reactionTag: GcsimReactionDamageGroupReaction;
  icdTag: GcsimReactionDamageGroupBinding["icdTag"];
  icdGroup: "reaction-a" | "reaction-b";
  generation: number;
  windowStartFrame: number;
  resetAtFrame: number;
  nextHitIndex: number;
  resetTask: Readonly<ReactionDamageGroupResetTask> | null;
}

interface OperationTuple {
  frame: number;
  taskSequence: number;
}

export interface ReactionDamageGroupOperationBoundary {
  frame: number;
  taskSequence: number;
}

const ATTEMPT_KEYS = new Set([
  "targetId",
  "actorId",
  "reactionTag",
  "damageSourceId",
  "frame",
  "taskSequence",
]);

function assertPlainAttempt(
  input: unknown,
): asserts input is ReactionDamageGroupAttempt {
  if (
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Object.prototype
  ) {
    throw new TypeError(
      "Reaction damage-group attempt must be a plain object.",
    );
  }
  for (const key of Object.keys(input)) {
    if (!ATTEMPT_KEYS.has(key)) {
      throw new TypeError(
        `Reaction damage-group attempt has unexpected field ${key}.`,
      );
    }
  }
  for (const key of ATTEMPT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) {
      throw new TypeError(
        `Reaction damage-group attempt requires own field ${key}.`,
      );
    }
  }
}

function assertNonEmptyString(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(`Reaction damage-group ${field} must be a string.`);
  }
  if (value.length === 0 || value.trim().length === 0) {
    throw new RangeError(`Reaction damage-group ${field} must not be blank.`);
  }
}

function assertSafeOrdinal(
  value: unknown,
  field: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(
      `Reaction damage-group ${field} must be a finite number.`,
    );
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      `Reaction damage-group ${field} must be a non-negative safe integer.`,
    );
  }
}

function compareTuple(left: OperationTuple, right: OperationTuple): number {
  return left.frame - right.frame || left.taskSequence - right.taskSequence;
}

function checkedIncrement(value: number, field: string): number {
  const next = value + 1;
  if (!Number.isSafeInteger(next)) {
    throw new RangeError(
      `Reaction damage-group ${field} exceeds the safe integer range.`,
    );
  }
  return next;
}

function taskIdentity(task: ReactionDamageGroupResetTask): string {
  return JSON.stringify([
    task.scopeKey,
    task.windowGeneration,
    task.resetAtFrame,
    task.taskSequence,
  ]);
}

export function makeReactionDamageGroupScopeKey(input: {
  targetId: string;
  actorId: string;
  icdTag: string;
}): string {
  return JSON.stringify([input.targetId, input.actorId, input.icdTag]);
}

/**
 * Pure ReactionA/B target damage-counter engine.
 *
 * V1 preserves the historical lazy F30 window. V2 owns explicit reset tasks
 * at F29; the caller must enqueue and execute them in the same FIFO task
 * sequence as reaction-damage attempts. No DOM, UI, or global singleton state
 * participates in the decision.
 */
export class ReactionDamageGroupTaskEngine {
  private readonly windows = new Map<string, WindowState>();
  private readonly lastGeneration = new Map<string, number>();
  private readonly lastOperation = new Map<string, OperationTuple>();
  private readonly scheduledTasks = new Map<
    string,
    Readonly<ReactionDamageGroupResetTask>
  >();
  private readonly executedTaskIdentities = new Set<string>();

  constructor(
    private readonly model: Readonly<ReactionDamageGroupModelSelection>,
  ) {
    const root = resolveReactionDamageGroupPolicyRoot(model.policyId);
    if (root.mode !== model.mode) {
      throw new RangeError(
        "Reaction damage-group mode and policyId must select the same root.",
      );
    }
  }

  consumeAttempt(
    input: ReactionDamageGroupAttempt,
    scheduleReset?: ScheduleReactionDamageGroupReset,
  ): Readonly<ReactionDamageGroupAttemptResult> {
    assertPlainAttempt(input);
    assertNonEmptyString(input.targetId, "targetId");
    assertNonEmptyString(input.actorId, "actorId");
    if (input.damageSourceId !== null) {
      assertNonEmptyString(input.damageSourceId, "damageSourceId");
    }
    assertSafeOrdinal(input.frame, "frame");
    assertSafeOrdinal(input.taskSequence, "taskSequence");

    const binding = resolveReactionDamageGroupBindingForPolicy(
      this.model.policyId,
      input.reactionTag,
    );
    const group = resolveDamageGroup(binding.groupId);
    if (group.id !== "reaction-a" && group.id !== "reaction-b") {
      throw new RangeError(
        `Reaction damage-group binding ${input.reactionTag} resolved to unsupported group ${group.id}.`,
      );
    }
    const scopeKey = makeReactionDamageGroupScopeKey({
      targetId: input.targetId,
      actorId: input.actorId,
      icdTag: binding.icdTag,
    });
    const operation = {
      frame: input.frame,
      taskSequence: input.taskSequence,
    };
    const previousOperation = this.lastOperation.get(scopeKey);
    if (
      previousOperation !== undefined &&
      compareTuple(operation, previousOperation) <= 0
    ) {
      throw new RangeError(
        `Reaction damage-group operations for ${scopeKey} must have strictly increasing (frame, taskSequence).`,
      );
    }

    const existing = this.windows.get(scopeKey);
    const isV1 =
      this.model.policyId === GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID;
    const opensNewWindow =
      existing === undefined || (isV1 && input.frame >= existing.resetAtFrame);

    if (
      !isV1 &&
      existing !== undefined &&
      (input.frame > existing.resetAtFrame ||
        (input.frame === existing.resetAtFrame &&
          existing.resetTask !== null &&
          input.taskSequence >= existing.resetTask.taskSequence))
    ) {
      throw new Error(
        `Reaction damage-group reset task for ${scopeKey} must execute before attempt (${input.frame}, ${input.taskSequence}).`,
      );
    }

    let window = existing;
    let scheduledResetTask: Readonly<ReactionDamageGroupResetTask> | null =
      null;
    let hitIndex: number;

    if (opensNewWindow) {
      const previousGeneration = this.lastGeneration.get(scopeKey);
      const generation =
        previousGeneration === undefined
          ? 0
          : checkedIncrement(previousGeneration, "windowGeneration");
      const resetAtFrame = resolveReactionDamageGroupResetFrame(
        this.model.policyId,
        input.reactionTag,
        input.frame,
      );
      if (isV1) {
        window = {
          reactionTag: input.reactionTag,
          icdTag: binding.icdTag,
          icdGroup: group.id,
          generation,
          windowStartFrame: input.frame,
          resetAtFrame,
          nextHitIndex: 1,
          resetTask: null,
        };
      } else {
        if (scheduleReset === undefined) {
          throw new TypeError(
            "V2 reaction damage-group windows require a reset-task scheduler.",
          );
        }
        const draft = Object.freeze({
          policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
          scopeKey,
          targetId: input.targetId,
          actorId: input.actorId,
          reactionTag: input.reactionTag,
          icdTag: binding.icdTag,
          icdGroup: group.id,
          windowGeneration: generation,
          windowStartFrame: input.frame,
          resetAtFrame,
        } satisfies ReactionDamageGroupResetTaskDraft);
        const schedule = scheduleReset(draft);
        if (
          schedule === null ||
          typeof schedule !== "object" ||
          Array.isArray(schedule)
        ) {
          throw new TypeError(
            "Reaction damage-group reset scheduler must return a schedule object.",
          );
        }
        assertSafeOrdinal(schedule.taskSequence, "reset taskSequence");
        if (schedule.taskSequence <= input.taskSequence) {
          throw new RangeError(
            "Reaction damage-group reset taskSequence must be allocated after its opening attempt.",
          );
        }
        if (typeof schedule.withinSimulation !== "boolean") {
          throw new TypeError(
            "Reaction damage-group reset withinSimulation must be boolean.",
          );
        }
        scheduledResetTask = Object.freeze({
          ...draft,
          taskSequence: schedule.taskSequence,
          withinSimulation: schedule.withinSimulation,
        });
        window = {
          reactionTag: input.reactionTag,
          icdTag: binding.icdTag,
          icdGroup: group.id,
          generation,
          windowStartFrame: input.frame,
          resetAtFrame,
          nextHitIndex: 1,
          resetTask: scheduledResetTask,
        };
      }
      hitIndex = 0;
    } else {
      if (window === undefined) {
        throw new Error("Reaction damage-group window resolution failed.");
      }
      hitIndex = window.nextHitIndex;
      window = {
        ...window,
        nextHitIndex: checkedIncrement(hitIndex, "hitIndex"),
      };
    }

    const sequenceIndex = Math.min(hitIndex, group.damageSequence.length - 1);
    const sequenceMultiplier = group.damageSequence[sequenceIndex];
    if (sequenceMultiplier !== 0 && sequenceMultiplier !== 1) {
      throw new Error(
        `Reaction damage-group ${group.id} returned unsupported multiplier ${String(sequenceMultiplier)}.`,
      );
    }
    const damageAllowed = sequenceMultiplier === 1;
    const blockedReason = damageAllowed
      ? null
      : group.id === "reaction-a"
        ? "REACTION_A_DAMAGE_ICD"
        : "REACTION_B_DAMAGE_ICD";

    this.windows.set(scopeKey, window);
    this.lastGeneration.set(scopeKey, window.generation);
    this.lastOperation.set(scopeKey, operation);
    if (scheduledResetTask !== null) {
      this.scheduledTasks.set(
        taskIdentity(scheduledResetTask),
        scheduledResetTask,
      );
    }

    const decision = Object.freeze({
      policyId: this.model.policyId,
      policyMode: this.model.mode,
      profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID,
      reactionTag: input.reactionTag,
      damageElement: binding.damageElement,
      attackTag: binding.attackTag,
      icdTag: binding.icdTag,
      icdGroup: group.id,
      targetId: input.targetId,
      actorId: input.actorId,
      damageSourceId: input.damageSourceId,
      scopeKey,
      frame: input.frame,
      taskSequence: input.taskSequence,
      windowGeneration: window.generation,
      windowStartFrame: window.windowStartFrame,
      resetAtFrame: window.resetAtFrame,
      resetTask: window.resetTask,
      hitIndex,
      attemptCountAfterDecision: hitIndex + 1,
      sequenceIndex,
      sequenceMultiplier,
      damageAllowed,
      blockedReason,
    } satisfies ReactionDamageGroupDecision);

    return Object.freeze({
      decision,
      scheduledResetTask,
    });
  }

  executeReset(
    task: Readonly<ReactionDamageGroupResetTask>,
  ): Readonly<ReactionDamageGroupResetExecution> {
    const identity = taskIdentity(task);
    const scheduled = this.scheduledTasks.get(identity);
    if (scheduled === undefined || scheduled !== task) {
      throw new TypeError(
        "Reaction damage-group reset task was not scheduled by this engine.",
      );
    }
    if (!task.withinSimulation) {
      throw new RangeError(
        "Reaction damage-group reset task outside the simulation cannot execute.",
      );
    }
    if (this.executedTaskIdentities.has(identity)) {
      return Object.freeze({
        task,
        executionFrame: task.resetAtFrame,
        executionTaskSequence: task.taskSequence,
        applied: false,
        stale: true,
        invalidatedReason: "ALREADY_EXECUTED",
      });
    }

    const operation = {
      frame: task.resetAtFrame,
      taskSequence: task.taskSequence,
    };
    const previousOperation = this.lastOperation.get(task.scopeKey);
    if (
      previousOperation !== undefined &&
      compareTuple(operation, previousOperation) <= 0
    ) {
      throw new RangeError(
        `Reaction damage-group reset for ${task.scopeKey} is out of FIFO order.`,
      );
    }
    const window = this.windows.get(task.scopeKey);
    const applied =
      window !== undefined &&
      window.generation === task.windowGeneration &&
      window.resetAtFrame === task.resetAtFrame &&
      window.resetTask === task;
    if (applied) {
      this.windows.delete(task.scopeKey);
    }
    this.lastOperation.set(task.scopeKey, operation);
    this.executedTaskIdentities.add(identity);

    return Object.freeze({
      task,
      executionFrame: task.resetAtFrame,
      executionTaskSequence: task.taskSequence,
      applied,
      stale: !applied,
      invalidatedReason: applied ? null : "WINDOW_GENERATION_MISMATCH",
    });
  }

  /**
   * Executes every scheduled reset whose core-task tuple is strictly earlier
   * than `boundary`.
   *
   * This is intentionally tuple-based rather than frame-based. It lets a
   * zero-delay reaction such as Shatter remain inside its parent core task:
   * a same-frame parent inserted before the reset consumes the old window,
   * while a parent inserted after the reset observes a fresh window. The
   * method never lazily resets merely because a frame boundary was reached.
   */
  executeResetsBefore(
    boundary: ReactionDamageGroupOperationBoundary,
  ): readonly Readonly<ReactionDamageGroupResetExecution>[] {
    if (
      boundary === null ||
      typeof boundary !== "object" ||
      Array.isArray(boundary)
    ) {
      throw new TypeError(
        "Reaction damage-group reset boundary must be an object.",
      );
    }
    assertSafeOrdinal(boundary.frame, "reset boundary frame");
    assertSafeOrdinal(boundary.taskSequence, "reset boundary taskSequence");

    const pending = [...this.scheduledTasks.values()]
      .filter(
        (task) =>
          task.withinSimulation &&
          !this.executedTaskIdentities.has(taskIdentity(task)) &&
          compareTuple(
            {
              frame: task.resetAtFrame,
              taskSequence: task.taskSequence,
            },
            boundary,
          ) < 0,
      )
      .sort((left, right) =>
        compareTuple(
          {
            frame: left.resetAtFrame,
            taskSequence: left.taskSequence,
          },
          {
            frame: right.resetAtFrame,
            taskSequence: right.taskSequence,
          },
        ),
      );

    return Object.freeze(pending.map((task) => this.executeReset(task)));
  }

  clear(): void {
    this.windows.clear();
    this.lastGeneration.clear();
    this.lastOperation.clear();
    this.scheduledTasks.clear();
    this.executedTaskIdentities.clear();
  }
}

export const LEGACY_REACTION_DAMAGE_GROUP_MODEL = Object.freeze({
  mode: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_MODE,
  policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
} as const);

export const FIXED_REACTION_DAMAGE_GROUP_TASK_MODEL = Object.freeze({
  mode: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_MODE,
  policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
} as const);
