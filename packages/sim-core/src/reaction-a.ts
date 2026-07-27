/**
 * ReactionA is the target-local damage limiter used by Bloom-family
 * transformative reactions. It is intentionally independent from the event
 * queue and schemas so the simulator can record every allowed or blocked
 * attempt without delegating state ownership to the UI.
 */
export const REACTION_A_TAGS = [
  "bloom",
  "burgeon",
  "hyperbloom"
] as const;

export type ReactionATag = (typeof REACTION_A_TAGS)[number];

export const REACTION_A_POLICY = Object.freeze({
  windowFrames: 30,
  allowedDamageInstances: 2,
  blockedReason: "REACTION_A_DAMAGE_ICD"
} as const);

export type ReactionABlockedReason =
  | typeof REACTION_A_POLICY.blockedReason
  | null;

export interface ReactionAAttempt {
  targetId: string;
  actorId: string;
  reactionTag: ReactionATag;
  frame: number;
}

/**
 * A complete audit record for one ReactionA damage attempt.
 *
 * `hitIndex` is zero-based and counts blocked attempts as well as allowed
 * attempts. The window is half-open: `[windowStartFrame,
 * windowEndFrameExclusive)`.
 */
export interface ReactionADecision extends ReactionAAttempt {
  policy: "reaction-a";
  scopeKey: string;
  windowStartFrame: number;
  windowEndFrameExclusive: number;
  hitIndex: number;
  attemptCountAfterDecision: number;
  resetFrames: typeof REACTION_A_POLICY.windowFrames;
  allowedDamageInstances: typeof REACTION_A_POLICY.allowedDamageInstances;
  damageAllowed: boolean;
  blockedReason: ReactionABlockedReason;
}

interface ReactionAWindowState {
  windowStartFrame: number;
  attemptCount: number;
  lastAttemptFrame: number;
}

function assertNonEmptyId(value: string, field: "targetId" | "actorId") {
  if (value.trim().length === 0) {
    throw new TypeError(`ReactionA ${field} must be a non-empty string.`);
  }
}

function assertReactionTag(value: string): asserts value is ReactionATag {
  if (!(REACTION_A_TAGS as readonly string[]).includes(value)) {
    throw new TypeError(
      `ReactionA reactionTag must be one of: ${REACTION_A_TAGS.join(", ")}.`
    );
  }
}

function assertFrame(frame: number) {
  if (!Number.isSafeInteger(frame) || frame < 0) {
    throw new RangeError(
      "ReactionA frame must be a non-negative safe integer."
    );
  }
}

/**
 * JSON tuple encoding avoids delimiter collisions while keeping the exact
 * target/actor/reaction isolation key visible in audit output.
 */
export function makeReactionAScopeKey({
  targetId,
  actorId,
  reactionTag
}: Pick<
  ReactionAAttempt,
  "targetId" | "actorId" | "reactionTag"
>): string {
  return JSON.stringify([targetId, actorId, reactionTag]);
}

export class ReactionALimiter {
  private readonly windows = new Map<string, ReactionAWindowState>();

  decide(input: ReactionAAttempt): Readonly<ReactionADecision> {
    assertNonEmptyId(input.targetId, "targetId");
    assertNonEmptyId(input.actorId, "actorId");
    assertReactionTag(input.reactionTag);
    assertFrame(input.frame);

    const scopeKey = makeReactionAScopeKey(input);
    const previous = this.windows.get(scopeKey);
    if (
      previous !== undefined &&
      input.frame < previous.lastAttemptFrame
    ) {
      throw new RangeError(
        `ReactionA attempts for ${scopeKey} must be processed in non-decreasing frame order.`
      );
    }

    const shouldStartWindow =
      previous === undefined ||
      input.frame - previous.windowStartFrame >=
        REACTION_A_POLICY.windowFrames;
    const windowStartFrame = shouldStartWindow
      ? input.frame
      : previous.windowStartFrame;
    const hitIndex = shouldStartWindow
      ? 0
      : previous.attemptCount;
    const attemptCountAfterDecision = hitIndex + 1;
    const damageAllowed =
      hitIndex < REACTION_A_POLICY.allowedDamageInstances;

    this.windows.set(scopeKey, {
      windowStartFrame,
      attemptCount: attemptCountAfterDecision,
      lastAttemptFrame: input.frame
    });

    return Object.freeze({
      policy: "reaction-a",
      scopeKey,
      targetId: input.targetId,
      actorId: input.actorId,
      reactionTag: input.reactionTag,
      frame: input.frame,
      windowStartFrame,
      windowEndFrameExclusive:
        windowStartFrame + REACTION_A_POLICY.windowFrames,
      hitIndex,
      attemptCountAfterDecision,
      resetFrames: REACTION_A_POLICY.windowFrames,
      allowedDamageInstances:
        REACTION_A_POLICY.allowedDamageInstances,
      damageAllowed,
      blockedReason: damageAllowed
        ? null
        : REACTION_A_POLICY.blockedReason
    });
  }

  clear(): void {
    this.windows.clear();
  }
}
