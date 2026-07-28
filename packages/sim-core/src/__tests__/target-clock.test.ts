import { describe, expect, it } from "vitest";
import {
  calculateEnemyHitlagExtension,
  TargetLocalClock,
  type TargetHitlagInput
} from "../target-clock";

describe("calculateEnemyHitlagExtension", () => {
  it("uses the fixed-reference nested-ceil hierarchy", () => {
    expect(calculateEnemyHitlagExtension(3.2, 0.25)).toBe(
      3
    );
    expect(calculateEnemyHitlagExtension(3.1, 0.01)).toBe(
      4
    );
    expect(calculateEnemyHitlagExtension(6, 0.5)).toBe(3);
    expect(calculateEnemyHitlagExtension(6, 1)).toBe(0);
  });

  it("adds the defense-halt layer before the inner ceil", () => {
    expect(calculateEnemyHitlagExtension(2.1, 0, 3.6)).toBe(
      6
    );
    expect(calculateEnemyHitlagExtension(2.1, 0.5, 3.6)).toBe(
      3
    );
    expect(calculateEnemyHitlagExtension(2.1, 0, 0)).toBe(
      3
    );
  });

  it("strictly rejects invalid halt, bonus, and factor values", () => {
    for (const haltFrames of [
      Number.NaN,
      Number.POSITIVE_INFINITY
    ]) {
      expect(() =>
        calculateEnemyHitlagExtension(haltFrames, 0)
      ).toThrow(/finite number/);
    }
    expect(() =>
      calculateEnemyHitlagExtension(-0.1, 0)
    ).toThrow(/non-negative/);
    expect(() =>
      calculateEnemyHitlagExtension(1, 0, -0.1)
    ).toThrow(/non-negative/);
    expect(() =>
      calculateEnemyHitlagExtension(
        1,
        0,
        Number.POSITIVE_INFINITY
      )
    ).toThrow(/finite number/);
    for (const factor of [
      Number.NaN,
      Number.NEGATIVE_INFINITY
    ]) {
      expect(() =>
        calculateEnemyHitlagExtension(1, factor)
      ).toThrow(/finite number/);
    }
    expect(() =>
      calculateEnemyHitlagExtension(1, -0.01)
    ).toThrow(/\[0, 1\]/);
    expect(() =>
      calculateEnemyHitlagExtension(1, 1.01)
    ).toThrow(/\[0, 1\]/);
    expect(() =>
      calculateEnemyHitlagExtension(
        Number.MAX_SAFE_INTEGER,
        0,
        1
      )
    ).toThrow(/safe integer/);
  });
});

describe("TargetLocalClock", () => {
  it("starts aligned and advances global and local clocks together", () => {
    const clock = new TargetLocalClock();

    expect(clock.getState()).toEqual({
      globalFrame: 0,
      localFrame: 0,
      frozenFrames: 0,
      isFrozen: false,
      nextLocalAdvanceGlobalFrame: 1
    });
    expect(clock.advanceTo(12)).toEqual({
      globalFrame: 12,
      localFrame: 12,
      frozenFrames: 0,
      isFrozen: false,
      nextLocalAdvanceGlobalFrame: 13
    });
  });

  it("pauses exactly H target ticks and resumes on H+1", () => {
    const clock = new TargetLocalClock();
    const audit = clock.applyHitlag({
      globalFrame: 10,
      haltFrames: 3,
      factor: 0
    });

    expect(audit).toEqual({
      globalFrame: 10,
      localFrameAtHit: 10,
      haltFrames: 3,
      preRoundBonusFrames: 0,
      effectiveHaltFrames: 3,
      roundedHaltFrames: 3,
      factor: 0,
      extensionFrames: 3,
      addedFrozenFrames: 3,
      frozenFramesBefore: 0,
      frozenFramesAfter: 3,
      pausedGlobalFrameStart: 11,
      projectedResumeGlobalFrame: 14
    });

    expect(clock.advanceTo(11)).toMatchObject({
      localFrame: 10,
      frozenFrames: 2,
      isFrozen: true
    });
    expect(clock.advanceTo(12)).toMatchObject({
      localFrame: 10,
      frozenFrames: 1,
      isFrozen: true
    });
    expect(clock.advanceTo(13)).toMatchObject({
      localFrame: 10,
      frozenFrames: 0,
      isFrozen: false,
      nextLocalAdvanceGlobalFrame: 14
    });
    expect(clock.advanceTo(14)).toMatchObject({
      localFrame: 11,
      frozenFrames: 0,
      isFrozen: false
    });
  });

  it("stacks same-frame hitlag without advancing either clock twice", () => {
    const clock = new TargetLocalClock();
    const first = clock.applyHitlag({
      globalFrame: 5,
      haltFrames: 2,
      factor: 0
    });
    const second = clock.applyHitlag({
      globalFrame: 5,
      haltFrames: 1,
      factor: 0
    });

    expect(first).toMatchObject({
      localFrameAtHit: 5,
      frozenFramesBefore: 0,
      frozenFramesAfter: 2,
      projectedResumeGlobalFrame: 8
    });
    expect(second).toMatchObject({
      localFrameAtHit: 5,
      frozenFramesBefore: 2,
      frozenFramesAfter: 3,
      pausedGlobalFrameStart: 6,
      projectedResumeGlobalFrame: 9
    });
    expect(clock.getState()).toMatchObject({
      globalFrame: 5,
      localFrame: 5,
      frozenFrames: 3
    });
  });

  it("consumes existing freeze before stacking a later hit", () => {
    const clock = new TargetLocalClock();
    clock.applyHitlag({
      globalFrame: 5,
      haltFrames: 3,
      factor: 0
    });
    const later = clock.applyHitlag({
      globalFrame: 7,
      haltFrames: 2,
      factor: 0
    });

    expect(later).toMatchObject({
      globalFrame: 7,
      localFrameAtHit: 5,
      frozenFramesBefore: 1,
      addedFrozenFrames: 2,
      frozenFramesAfter: 3,
      pausedGlobalFrameStart: 8,
      projectedResumeGlobalFrame: 11
    });
    expect(clock.advanceTo(11)).toMatchObject({
      globalFrame: 11,
      localFrame: 6,
      frozenFrames: 0
    });
  });

  it("projects local deadlines through freeze while global deadlines remain unchanged", () => {
    const clock = new TargetLocalClock();
    clock.applyHitlag({
      globalFrame: 10,
      haltFrames: 3,
      factor: 0
    });

    expect(
      clock.projectGlobalFrameForLocalDeadline(10)
    ).toBe(10);
    expect(
      clock.projectGlobalFrameForLocalDeadline(11)
    ).toBe(14);
    expect(
      clock.projectGlobalFrameForLocalDeadline(15)
    ).toBe(18);
    expect(clock.projectLocalFrameAtGlobalFrame(10)).toBe(10);
    expect(clock.projectLocalFrameAtGlobalFrame(13)).toBe(10);
    expect(clock.projectLocalFrameAtGlobalFrame(14)).toBe(11);
    expect(clock.projectLocalFrameAtGlobalFrame(18)).toBe(15);
    expect(clock.getState()).toMatchObject({
      globalFrame: 10,
      localFrame: 10,
      frozenFrames: 3
    });

    expect(clock.projectGlobalTaskDeadline(10)).toBe(10);
    expect(clock.projectGlobalTaskDeadline(11)).toBe(11);
    expect(clock.projectGlobalTaskDeadline(18)).toBe(18);
  });

  it("reports a zero extension without inventing pause frames", () => {
    const clock = new TargetLocalClock();
    const audit = clock.applyHitlag({
      globalFrame: 8,
      haltFrames: 4,
      factor: 1
    });

    expect(audit).toMatchObject({
      extensionFrames: 0,
      addedFrozenFrames: 0,
      frozenFramesBefore: 0,
      frozenFramesAfter: 0,
      pausedGlobalFrameStart: null,
      projectedResumeGlobalFrame: null
    });
    expect(clock.getState()).toEqual({
      globalFrame: 8,
      localFrame: 8,
      frozenFrames: 0,
      isFrozen: false,
      nextLocalAdvanceGlobalFrame: 9
    });
  });

  it("uses O(1) advancement for long global intervals", () => {
    const clock = new TargetLocalClock();
    clock.applyHitlag({
      globalFrame: 1,
      haltFrames: 10,
      factor: 0
    });

    expect(clock.advanceTo(1_000_000)).toEqual({
      globalFrame: 1_000_000,
      localFrame: 999_990,
      frozenFrames: 0,
      isFrozen: false,
      nextLocalAdvanceGlobalFrame: 1_000_001
    });
  });

  it("returns immutable snapshots and deterministic audits", () => {
    const run = () => {
      const clock = new TargetLocalClock();
      const audit = clock.applyHitlag({
        globalFrame: 20,
        haltFrames: 2.25,
        factor: 0.25,
        preRoundBonusFrames: 3.6
      });
      const state = clock.advanceTo(23);
      return { audit, state };
    };
    const first = run();
    const second = run();

    expect(second).toEqual(first);
    expect(Object.isFrozen(first.audit)).toBe(true);
    expect(Object.isFrozen(first.state)).toBe(true);
  });

  it("rejects backward, fractional, negative, and stale deadlines", () => {
    const clock = new TargetLocalClock();
    clock.advanceTo(5);

    expect(() => clock.advanceTo(4)).toThrow(
      /non-decreasing/
    );
    expect(() => clock.advanceTo(5.5)).toThrow(
      /non-negative safe integer/
    );
    expect(() =>
      clock.projectGlobalFrameForLocalDeadline(-1)
    ).toThrow(/non-negative safe integer/);
    expect(() =>
      clock.projectGlobalTaskDeadline(4)
    ).toThrow(/cannot be before/);
  });

  it("leaves state unchanged when hitlag validation fails", () => {
    const invalidInputs: TargetHitlagInput[] = [
      {
        globalFrame: 12,
        haltFrames: Number.NaN,
        factor: 0
      },
      {
        globalFrame: 12,
        haltFrames: 2,
        factor: -0.1
      },
      {
        globalFrame: 2,
        haltFrames: 2,
        factor: 0
      }
    ];

    for (const invalid of invalidInputs) {
      const clock = new TargetLocalClock();
      clock.advanceTo(5);
      const before = clock.getState();
      expect(() => clock.applyHitlag(invalid)).toThrow();
      expect(clock.getState()).toEqual(before);
    }
  });

  it("rejects derived frame overflow without mutating existing state", () => {
    const clock = new TargetLocalClock();
    clock.advanceTo(5);
    const before = clock.getState();

    expect(() =>
      clock.applyHitlag({
        globalFrame: Number.MAX_SAFE_INTEGER - 1,
        haltFrames: 2,
        factor: 0
      })
    ).toThrow(/safe integer frame range/);
    expect(clock.getState()).toEqual(before);
  });
});
