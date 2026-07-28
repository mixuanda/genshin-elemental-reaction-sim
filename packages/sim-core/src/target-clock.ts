/**
 * A target-local clock for enemy hitlag.
 *
 * The rounding hierarchy and tick order are cross-checked against the fixed
 * gcsim source revision used by this project. This is an implementation
 * reference, not a claim of official live-server timing truth.
 */

export interface EnemyHitlagCalculation {
  haltFrames: number;
  preRoundBonusFrames: number;
  effectiveHaltFrames: number;
  roundedHaltFrames: number;
  factor: number;
  extensionFrames: number;
}

export interface TargetHitlagInput {
  globalFrame: number;
  haltFrames: number;
  factor: number;
  /**
   * Added before the inner ceil. The fixed reference uses this layer for the
   * defense-halt bonus; whether that bonus applies belongs to the caller.
   */
  preRoundBonusFrames?: number;
}

export interface TargetLocalClockState {
  globalFrame: number;
  localFrame: number;
  frozenFrames: number;
  isFrozen: boolean;
  nextLocalAdvanceGlobalFrame: number;
}

export interface TargetHitlagAudit
  extends EnemyHitlagCalculation {
  globalFrame: number;
  localFrameAtHit: number;
  frozenFramesBefore: number;
  frozenFramesAfter: number;
  addedFrozenFrames: number;
  pausedGlobalFrameStart: number | null;
  projectedResumeGlobalFrame: number | null;
}

interface ClockFrames {
  globalFrame: number;
  localFrame: number;
  frozenFrames: number;
}

function assertNonNegativeSafeFrame(
  value: number,
  field: string
): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      `Target local clock ${field} must be a non-negative safe integer.`
    );
  }
}

function assertFiniteNonNegative(
  value: number,
  field: string
): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(
      `Target local clock ${field} must be a finite number.`
    );
  }
  if (value < 0) {
    throw new RangeError(
      `Target local clock ${field} must be non-negative.`
    );
  }
}

function assertFactor(factor: number): void {
  if (!Number.isFinite(factor)) {
    throw new TypeError(
      "Target local clock factor must be a finite number."
    );
  }
  if (factor < 0 || factor > 1) {
    throw new RangeError(
      "Target local clock factor must be within [0, 1]."
    );
  }
}

function checkedFrameSum(
  field: string,
  ...values: readonly number[]
): number {
  const sum = values.reduce(
    (total, value) => total + value,
    0
  );
  if (!Number.isSafeInteger(sum) || sum < 0) {
    throw new RangeError(
      `Target local clock ${field} exceeds the safe integer frame range.`
    );
  }
  return sum;
}

function calculateEnemyHitlagDetails(
  haltFrames: number,
  factor: number,
  preRoundBonusFrames = 0
): Readonly<EnemyHitlagCalculation> {
  assertFiniteNonNegative(haltFrames, "haltFrames");
  assertFiniteNonNegative(
    preRoundBonusFrames,
    "preRoundBonusFrames"
  );
  assertFactor(factor);

  const effectiveHaltFrames =
    haltFrames + preRoundBonusFrames;
  if (!Number.isFinite(effectiveHaltFrames)) {
    throw new RangeError(
      "Target local clock effectiveHaltFrames must remain finite."
    );
  }
  const roundedHaltFrames = Math.ceil(
    effectiveHaltFrames
  );
  assertNonNegativeSafeFrame(
    roundedHaltFrames,
    "roundedHaltFrames"
  );
  const extensionFrames = Math.ceil(
    roundedHaltFrames * (1 - factor)
  );
  assertNonNegativeSafeFrame(
    extensionFrames,
    "extensionFrames"
  );

  return Object.freeze({
    haltFrames,
    preRoundBonusFrames,
    effectiveHaltFrames,
    roundedHaltFrames,
    factor,
    extensionFrames
  });
}

/**
 * Fixed-reference enemy hitlag extension:
 *
 * `ceil(ceil(haltFrames + preRoundBonusFrames) * (1 - factor))`
 */
export function calculateEnemyHitlagExtension(
  haltFrames: number,
  factor: number,
  preRoundBonusFrames = 0
): number {
  return calculateEnemyHitlagDetails(
    haltFrames,
    factor,
    preRoundBonusFrames
  ).extensionFrames;
}

/**
 * Owns one enemy target's local clock while global simulation time continues.
 *
 * A hit at global frame G is assumed to occur after that frame's enemy Tick,
 * matching the usual fixed-reference task ordering. Therefore newly applied
 * hitlag first pauses the target-local clock at G + 1.
 */
export class TargetLocalClock {
  private globalFrame = 0;
  private localFrame = 0;
  private frozenFrames = 0;

  private projectAdvance(globalFrame: number): ClockFrames {
    assertNonNegativeSafeFrame(globalFrame, "globalFrame");
    if (globalFrame < this.globalFrame) {
      throw new RangeError(
        "Target local clock globalFrame must be non-decreasing."
      );
    }

    const elapsedGlobalFrames =
      globalFrame - this.globalFrame;
    const consumedFrozenFrames = Math.min(
      elapsedGlobalFrames,
      this.frozenFrames
    );
    const advancedLocalFrames =
      elapsedGlobalFrames - consumedFrozenFrames;
    const nextLocalFrame = checkedFrameSum(
      "localFrame",
      this.localFrame,
      advancedLocalFrames
    );
    const nextFrozenFrames =
      this.frozenFrames - consumedFrozenFrames;
    checkedFrameSum(
      "nextLocalAdvanceGlobalFrame",
      globalFrame,
      nextFrozenFrames,
      1
    );

    return {
      globalFrame,
      localFrame: nextLocalFrame,
      frozenFrames: nextFrozenFrames
    };
  }

  private commit(frames: ClockFrames): void {
    this.globalFrame = frames.globalFrame;
    this.localFrame = frames.localFrame;
    this.frozenFrames = frames.frozenFrames;
  }

  getState(): Readonly<TargetLocalClockState> {
    return Object.freeze({
      globalFrame: this.globalFrame,
      localFrame: this.localFrame,
      frozenFrames: this.frozenFrames,
      isFrozen: this.frozenFrames > 0,
      nextLocalAdvanceGlobalFrame: checkedFrameSum(
        "nextLocalAdvanceGlobalFrame",
        this.globalFrame,
        this.frozenFrames,
        1
      )
    });
  }

  /**
   * Advance global time without iterating individual ticks.
   *
   * The first `frozenFrames` target ticks consume hitlag and do not advance
   * local time. Any remaining global ticks advance local time one-for-one.
   */
  advanceTo(
    globalFrame: number
  ): Readonly<TargetLocalClockState> {
    const next = this.projectAdvance(globalFrame);
    this.commit(next);
    return this.getState();
  }

  /**
   * Predict the target-local frame at a future global frame without mutating
   * the clock. This is the inverse used to freeze a local task deadline while
   * its current global wake-up projection may later move after more hitlag.
   */
  projectLocalFrameAtGlobalFrame(
    globalFrame: number
  ): number {
    return this.projectAdvance(globalFrame).localFrame;
  }

  /**
   * Advance to the hit frame, then stack the calculated freeze duration.
   * Invalid input or arithmetic overflow leaves the clock unchanged.
   */
  applyHitlag(
    input: Readonly<TargetHitlagInput>
  ): Readonly<TargetHitlagAudit> {
    const calculation = calculateEnemyHitlagDetails(
      input.haltFrames,
      input.factor,
      input.preRoundBonusFrames ?? 0
    );
    const advanced = this.projectAdvance(input.globalFrame);
    const frozenFramesAfter = checkedFrameSum(
      "frozenFrames",
      advanced.frozenFrames,
      calculation.extensionFrames
    );

    const hasNewPause = calculation.extensionFrames > 0;
    const pausedGlobalFrameStart = hasNewPause
      ? checkedFrameSum(
          "pausedGlobalFrameStart",
          input.globalFrame,
          1
        )
      : null;
    const projectedResumeGlobalFrame = hasNewPause
      ? checkedFrameSum(
          "projectedResumeGlobalFrame",
          input.globalFrame,
          frozenFramesAfter,
          1
        )
      : null;

    this.commit({
      ...advanced,
      frozenFrames: frozenFramesAfter
    });

    return Object.freeze({
      ...calculation,
      globalFrame: input.globalFrame,
      localFrameAtHit: advanced.localFrame,
      frozenFramesBefore: advanced.frozenFrames,
      frozenFramesAfter,
      addedFrozenFrames: calculation.extensionFrames,
      pausedGlobalFrameStart,
      projectedResumeGlobalFrame
    });
  }

  /**
   * Earliest global frame at which the requested target-local deadline is
   * reached, assuming no future hitlag is added.
   */
  projectGlobalFrameForLocalDeadline(
    localDeadline: number
  ): number {
    assertNonNegativeSafeFrame(
      localDeadline,
      "localDeadline"
    );
    if (localDeadline <= this.localFrame) {
      return this.globalFrame;
    }
    return checkedFrameSum(
      "projected local deadline",
      this.globalFrame,
      this.frozenFrames,
      localDeadline - this.localFrame
    );
  }

  /**
   * Global tasks do not use the target-local clock and are not shifted by its
   * hitlag. This validator intentionally returns their deadline unchanged.
   */
  projectGlobalTaskDeadline(
    globalDeadline: number
  ): number {
    assertNonNegativeSafeFrame(
      globalDeadline,
      "globalDeadline"
    );
    if (globalDeadline < this.globalFrame) {
      throw new RangeError(
        "Target local clock global task deadline cannot be before the current global frame."
      );
    }
    return globalDeadline;
  }
}
