import { describe, expect, it } from "vitest";
import {
  DENDRO_CORE_CONSTANTS,
  DendroCoreManager,
  selectNearestDendroCoreTarget
} from "../dendro-core";

class SequenceRandom {
  private index = 0;

  constructor(private readonly values: readonly number[]) {}

  next(): number {
    const value = this.values[this.index % this.values.length];
    this.index += 1;
    return value ?? 0;
  }
}

function reserveAt(
  manager: DendroCoreManager,
  triggerFrame: number,
  bloomReactionIndex = 0
) {
  return manager.reserve({
    sourceActorId: "dendro",
    sourceTargetId: "enemy-0",
    originDamageEventId: triggerFrame,
    triggerFrame,
    bloomReactionIndex
  });
}

function spawnAt(
  manager: DendroCoreManager,
  triggerFrame: number,
  bloomReactionIndex = 0
) {
  const reservation = reserveAt(
    manager,
    triggerFrame,
    bloomReactionIndex
  );
  return manager.spawn({
    reservation,
    frame: reservation.spawnFrame,
    targetPosition: { x: 10, y: 5 },
    targetHitboxRadius: 1
  });
}

describe("DendroCoreManager", () => {
  it("reserves +30f, spawns deterministically, and expires after the provisional 300f lifetime", () => {
    const manager = new DendroCoreManager(
      new SequenceRandom([0.25])
    );
    const reservation = reserveAt(manager, 100);
    expect(reservation).toMatchObject({
      coreId: 0,
      triggerFrame: 100,
      spawnFrame: 130
    });

    const { spawned, evicted } = manager.spawn({
      reservation,
      frame: 130,
      targetPosition: { x: 10, y: 5 },
      targetHitboxRadius: 1
    });
    expect(evicted).toEqual([]);
    expect(spawned).toMatchObject({
      coreId: 0,
      spawnedAtFrame: 130,
      expiresAtFrame: 430,
      hitboxRadius: 2,
      spawnRadius: 1.5,
      spawnAngleDegrees: 90,
      positionRandomRoll: 0.25
    });
    expect(spawned.position.x).toBeCloseTo(10, 12);
    expect(spawned.position.y).toBeCloseTo(6.5, 12);

    expect(() => manager.expire(0, 429)).toThrow(
      /cannot expire before/
    );
  });

  it("expires at the half-open boundary and schedules natural Bloom one frame later", () => {
    const manager = new DendroCoreManager(
      new SequenceRandom([0])
    );
    const { spawned } = spawnAt(manager, 0);
    expect(() =>
      manager.expire(spawned.coreId, 329)
    ).toThrow(/cannot expire before/);
    expect(
      manager.expire(spawned.coreId, 330)
    ).toMatchObject({
      operation: "expire",
      reason: "NATURAL_EXPIRY",
      reaction: "bloom",
      damageFrame: 331
    });
    expect(manager.snapshots()).toEqual([]);
    expect(manager.expire(spawned.coreId, 330)).toBeNull();
  });

  it("evicts the oldest of six global cores and keeps stable insertion order for same-frame spawns", () => {
    const manager = new DendroCoreManager(
      new SequenceRandom([0])
    );
    const spawnedIds: number[] = [];
    for (let frame = 0; frame < 6; frame += 1) {
      const result = spawnAt(manager, frame);
      spawnedIds.push(result.spawned.coreId);
      if (frame < 5) {
        expect(result.evicted).toEqual([]);
      } else {
        expect(result.evicted.map((core) => core.coreId)).toEqual([
          0
        ]);
        expect(
          manager.makeEvictionDecision(
            result.evicted[0]!,
            result.spawned.spawnedAtFrame
          )
        ).toMatchObject({
          operation: "evict",
          reason: "ACTIVE_CORE_LIMIT",
          reaction: "bloom",
          damageFrame: 36
        });
      }
    }
    expect(spawnedIds).toEqual([0, 1, 2, 3, 4, 5]);
    expect(manager.snapshots().map((core) => core.coreId)).toEqual([
      1, 2, 3, 4, 5
    ]);
  });

  it("consumes active cores for Burgeon and Hyperbloom with fixed delays", () => {
    const manager = new DendroCoreManager(
      new SequenceRandom([0, 0.5])
    );
    const pyroCore = spawnAt(manager, 0).spawned;
    const electroCore = spawnAt(manager, 1).spawned;

    expect(
      manager.consume(pyroCore.coreId, 100, "pyro")
    ).toMatchObject({
      operation: "consume",
      reason: "BURGEON_CONTACT",
      reaction: "burgeon",
      damageFrame: 101
    });
    expect(
      manager.consume(electroCore.coreId, 100, "electro")
    ).toMatchObject({
      operation: "consume",
      reason: "HYPERBLOOM_CONTACT",
      reaction: "hyperbloom",
      damageFrame: 160
    });
    expect(manager.snapshots()).toEqual([]);
  });

  it("does not let a contact revive or consume an expired core", () => {
    const manager = new DendroCoreManager(
      new SequenceRandom([0])
    );
    const core = spawnAt(manager, 0).spawned;
    expect(
      manager.consume(core.coreId, core.expiresAtFrame, "pyro")
    ).toBeNull();
    expect(manager.get(core.coreId)).not.toBeNull();
    expect(
      manager.expire(core.coreId, core.expiresAtFrame)
    ).not.toBeNull();
  });

  it("uses target registry order as the stable equal-distance tie-break", () => {
    const selection = selectNearestDendroCoreTarget(
      { x: 0, y: 0 },
      [
        { targetId: "enemy-b", position: { x: 3, y: 4 } },
        { targetId: "enemy-a", position: { x: -3, y: -4 } },
        { targetId: "outside", position: { x: 15.000001, y: 0 } }
      ]
    );
    expect(selection).toEqual({
      selectedTargetId: "enemy-b",
      selectedPosition: { x: 3, y: 4 },
      distance: 5,
      reason: "SELECTED_NEAREST_TARGET"
    });
    expect(
      selectNearestDendroCoreTarget(
        { x: 0, y: 0 },
        [
          {
            targetId: "boundary",
            position: { x: 15, y: 0 }
          }
        ]
      )
    ).toMatchObject({
      selectedTargetId: "boundary",
      distance: 15
    });
  });

  it("returns an explicit no-target decision and validates malformed inputs", () => {
    expect(
      selectNearestDendroCoreTarget(
        { x: 0, y: 0 },
        [
          { targetId: "unknown", position: null },
          {
            targetId: "outside",
            position: { x: 15.000001, y: 0 }
          }
        ]
      )
    ).toEqual({
      selectedTargetId: null,
      selectedPosition: null,
      distance: null,
      reason: "NO_TARGET_IN_RANGE"
    });

    const manager = new DendroCoreManager(
      new SequenceRandom([1])
    );
    const reservation = reserveAt(manager, 0);
    expect(() =>
      manager.spawn({
        reservation,
        frame: reservation.spawnFrame,
        targetPosition: { x: 0, y: 0 },
        targetHitboxRadius: 1
      })
    ).toThrow(/random source/);
    expect(DENDRO_CORE_CONSTANTS).toMatchObject({
      durationFrames: 300,
      maxActiveCores: 5,
      mechanicsDataStatus: "fixed-gcsim-provisional",
      selfDamageStatus: "unsupported-player-damage-model"
    });
  });
});
