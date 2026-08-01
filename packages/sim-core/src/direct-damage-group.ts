import {
  GCSIM_DAMAGE_GROUP_PROFILE_ID,
  resolveDamageGroup,
  resolveDamageGroupResetAtFrame,
  type GcsimDamageGroupId
} from "@genshin-dps-lab/icd-profiles";

/**
 * One landed ordinary direct-damage hit evaluated for a single target.
 *
 * Miss filtering is intentionally owned by the caller: invoking
 * `consumeLandedHit` always consumes exactly one damage-group sequence slot.
 */
export interface DirectDamageGroupHitInput {
  frame: number;
  sourceActorId: string;
  icdTag: string;
  icdGroup: string;
}

/**
 * Auditable result of consuming one direct-damage group sequence slot.
 *
 * `resetFrames` and `windowStartGroup` belong to the group that opened the
 * active window. `icdGroup` and `sequenceIndex` belong to the current hit.
 * This distinction matters when a source reuses one tag with multiple groups.
 */
export interface DirectDamageGroupDecision {
  profileId: typeof GCSIM_DAMAGE_GROUP_PROFILE_ID;
  sourceActorId: string;
  icdTag: string;
  icdGroup: GcsimDamageGroupId;
  windowStartGroup: GcsimDamageGroupId;
  resetFrames: number;
  windowStartFrame: number;
  resetAtFrame: number;
  hitIndex: number;
  sequenceIndex: number;
  sequenceMultiplier: 0 | 1;
}

interface DirectDamageGroupWindowState {
  windowStartGroup: GcsimDamageGroupId;
  resetFrames: number;
  windowStartFrame: number;
  resetAtFrame: number;
  nextHitIndex: number;
}

function assertNonEmptyString(
  value: unknown,
  field: string
): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(
      `Direct damage group ${field} must be a string.`
    );
  }
  if (value.length === 0) {
    throw new RangeError(
      `Direct damage group ${field} must not be empty.`
    );
  }
}

function assertFrame(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(
      "Direct damage group frame must be a finite number."
    );
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      "Direct damage group frame must be a non-negative safe integer."
    );
  }
}

function checkedNextHitIndex(hitIndex: number): number {
  const nextHitIndex = hitIndex + 1;
  if (!Number.isSafeInteger(nextHitIndex)) {
    throw new RangeError(
      "Direct damage group hitIndex exceeds the safe integer range."
    );
  }
  return nextHitIndex;
}

/**
 * Target-local state machine for ordinary direct-damage attenuation groups.
 *
 * Create one engine per enemy target. State is isolated by the structured
 * tuple `(sourceActorId, icdTag)` through nested maps; the group intentionally
 * is not part of the state key. Calls must be delivered in non-decreasing
 * global-frame order.
 */
export class DirectDamageGroupEngine {
  private readonly statesByActor = new Map<
    string,
    Map<string, DirectDamageGroupWindowState>
  >();

  private lastConsumedFrame: number | null = null;

  consumeLandedHit(
    input: DirectDamageGroupHitInput
  ): Readonly<DirectDamageGroupDecision> {
    if (
      input === null ||
      typeof input !== "object" ||
      Array.isArray(input)
    ) {
      throw new TypeError(
        "Direct damage group hit input must be an object."
      );
    }

    const { frame, sourceActorId, icdTag, icdGroup } =
      input;
    assertFrame(frame);
    assertNonEmptyString(sourceActorId, "sourceActorId");
    assertNonEmptyString(icdTag, "icdTag");
    assertNonEmptyString(icdGroup, "icdGroup");

    // Resolve before any state mutation so unknown group identifiers fail
    // closed and cannot consume a counter slot.
    const currentGroup = resolveDamageGroup(icdGroup);

    if (
      this.lastConsumedFrame !== null &&
      frame < this.lastConsumedFrame
    ) {
      throw new RangeError(
        "Direct damage group frame must be non-decreasing within one target engine."
      );
    }

    const existingActorStates =
      this.statesByActor.get(sourceActorId);
    const existingWindow = existingActorStates?.get(icdTag);
    const opensNewWindow =
      existingWindow === undefined ||
      frame >= existingWindow.resetAtFrame;

    let window: DirectDamageGroupWindowState;
    let hitIndex: number;

    if (opensNewWindow) {
      const resetAtFrame = resolveDamageGroupResetAtFrame(
        currentGroup.id,
        frame
      );
      hitIndex = 0;
      window = {
        windowStartGroup: currentGroup.id,
        resetFrames: currentGroup.resetFrames,
        windowStartFrame: frame,
        resetAtFrame,
        nextHitIndex: 1
      };
    } else {
      window = existingWindow;
      hitIndex = window.nextHitIndex;
      window = {
        ...window,
        nextHitIndex: checkedNextHitIndex(hitIndex)
      };
    }

    const sequenceIndex = Math.min(
      hitIndex,
      currentGroup.damageSequence.length - 1
    );
    const sequenceMultiplier =
      currentGroup.damageSequence[sequenceIndex]!;

    let actorStates = existingActorStates;
    if (actorStates === undefined) {
      actorStates = new Map();
      this.statesByActor.set(sourceActorId, actorStates);
    }
    actorStates.set(icdTag, window);
    this.lastConsumedFrame = frame;

    return Object.freeze({
      profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID,
      sourceActorId,
      icdTag,
      icdGroup: currentGroup.id,
      windowStartGroup: window.windowStartGroup,
      resetFrames: window.resetFrames,
      windowStartFrame: window.windowStartFrame,
      resetAtFrame: window.resetAtFrame,
      hitIndex,
      sequenceIndex,
      sequenceMultiplier
    });
  }
}
