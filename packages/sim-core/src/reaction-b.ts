/**
 * ReactionB is the target-local damage limiter used by Overload and
 * Electro-Charged. It mirrors the fixed gcsim damage-ICD policy: only the
 * first damage attempt in each half-open 30-frame window is allowed. This is
 * a compatibility reference, not a claim of official server validation.
 */
export const REACTION_B_TAGS = [
  "overload",
  "electroCharged"
] as const;

export type ReactionBTag = (typeof REACTION_B_TAGS)[number];

export const REACTION_B_POLICY = Object.freeze({
  windowFrames: 30,
  allowedDamageInstances: 1,
  blockedReason: "REACTION_B_DAMAGE_ICD"
} as const);

export type ReactionBBlockedReason =
  | typeof REACTION_B_POLICY.blockedReason
  | null;

export interface ReactionBAttempt {
  targetId: string;
  actorId: string;
  reactionTag: ReactionBTag;
  frame: number;
}

export interface ReactionBDecision extends ReactionBAttempt {
  policy: "reaction-b";
  scopeKey: string;
  windowStartFrame: number;
  windowEndFrameExclusive: number;
  hitIndex: number;
  attemptCountAfterDecision: number;
  resetFrames: typeof REACTION_B_POLICY.windowFrames;
  allowedDamageInstances:
    typeof REACTION_B_POLICY.allowedDamageInstances;
  damageAllowed: boolean;
  blockedReason: ReactionBBlockedReason;
}

interface ReactionBWindowState {
  windowStartFrame: number;
  attemptCount: number;
  lastAttemptFrame: number;
}

function assertNonEmptyId(
  value: string,
  field: "targetId" | "actorId"
) {
  if (value.trim().length === 0) {
    throw new TypeError(
      `ReactionB ${field} must be a non-empty string.`
    );
  }
}

function assertReactionTag(
  value: string
): asserts value is ReactionBTag {
  if (!(REACTION_B_TAGS as readonly string[]).includes(value)) {
    throw new TypeError(
      `ReactionB reactionTag must be one of: ${REACTION_B_TAGS.join(", ")}.`
    );
  }
}

function assertFrame(frame: number) {
  if (!Number.isSafeInteger(frame) || frame < 0) {
    throw new RangeError(
      "ReactionB frame must be a non-negative safe integer."
    );
  }
}

export function makeReactionBScopeKey({
  targetId,
  actorId,
  reactionTag
}: Pick<
  ReactionBAttempt,
  "targetId" | "actorId" | "reactionTag"
>): string {
  return JSON.stringify([targetId, actorId, reactionTag]);
}

export class ReactionBLimiter {
  private readonly windows = new Map<string, ReactionBWindowState>();

  decide(input: ReactionBAttempt): Readonly<ReactionBDecision> {
    assertNonEmptyId(input.targetId, "targetId");
    assertNonEmptyId(input.actorId, "actorId");
    assertReactionTag(input.reactionTag);
    assertFrame(input.frame);

    const scopeKey = makeReactionBScopeKey(input);
    const previous = this.windows.get(scopeKey);
    if (
      previous !== undefined &&
      input.frame < previous.lastAttemptFrame
    ) {
      throw new RangeError(
        `ReactionB attempts for ${scopeKey} must be processed in non-decreasing frame order.`
      );
    }

    const shouldStartWindow =
      previous === undefined ||
      input.frame - previous.windowStartFrame >=
        REACTION_B_POLICY.windowFrames;
    const windowStartFrame = shouldStartWindow
      ? input.frame
      : previous.windowStartFrame;
    const hitIndex = shouldStartWindow
      ? 0
      : previous.attemptCount;
    const attemptCountAfterDecision = hitIndex + 1;
    const damageAllowed =
      hitIndex < REACTION_B_POLICY.allowedDamageInstances;

    this.windows.set(scopeKey, {
      windowStartFrame,
      attemptCount: attemptCountAfterDecision,
      lastAttemptFrame: input.frame
    });

    return Object.freeze({
      policy: "reaction-b",
      scopeKey,
      targetId: input.targetId,
      actorId: input.actorId,
      reactionTag: input.reactionTag,
      frame: input.frame,
      windowStartFrame,
      windowEndFrameExclusive:
        windowStartFrame + REACTION_B_POLICY.windowFrames,
      hitIndex,
      attemptCountAfterDecision,
      resetFrames: REACTION_B_POLICY.windowFrames,
      allowedDamageInstances:
        REACTION_B_POLICY.allowedDamageInstances,
      damageAllowed,
      blockedReason: damageAllowed
        ? null
        : REACTION_B_POLICY.blockedReason
    });
  }

  clear(): void {
    this.windows.clear();
  }
}
