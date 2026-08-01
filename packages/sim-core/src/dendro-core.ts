import {
  CLASSIC_REACTION_FORMULA_PROFILE
} from "@genshin-dps-lab/reaction-formulas";

/**
 * Pure Dendro-core entity state.
 *
 * Timings and geometry constants are cross-checked against the fixed gcsim
 * revision used by this project. In particular, the 300-frame lifetime is
 * explicitly provisional in that source (`Duration = 300 // ??`) and must not
 * be presented as official live-server truth.
 */
export const DENDRO_CORE_CONSTANTS = Object.freeze({
  spawnDelayFrames: 30,
  durationFrames: 300,
  hitboxRadius: 2,
  maxActiveCores: 5,
  spawnRadiusOffset: 0.5,
  bloomDamageDelayFrames: 1,
  burgeonDamageDelayFrames: 1,
  hyperbloomDamageDelayFrames: 60,
  bloomRadius: 5,
  burgeonRadius: 5,
  hyperbloomSelectionRadius: 15,
  hyperbloomDamageRadius: 1,
  bloomMultiplier:
    CLASSIC_REACTION_FORMULA_PROFILE.transformativeBaseMultipliers
      .bloom,
  burgeonMultiplier:
    CLASSIC_REACTION_FORMULA_PROFILE.transformativeBaseMultipliers
      .burgeon,
  hyperbloomMultiplier:
    CLASSIC_REACTION_FORMULA_PROFILE.transformativeBaseMultipliers
      .hyperbloom,
  mechanicsDataStatus: "fixed-gcsim-provisional",
  // Raw entity-layer default. simulate() projects the configured player
  // damage capability into public audits and Dendro-core logs.
  selfDamageStatus: "unsupported-player-damage-model"
} as const);

export type DendroCoreReaction =
  | "bloom"
  | "burgeon"
  | "hyperbloom";

export interface DendroCoreRandomSource {
  next(): number;
}

export interface DendroCoreReservationInput {
  sourceActorId: string;
  sourceTargetId: string;
  originDamageEventId: number;
  triggerFrame: number;
  bloomReactionIndex: number;
}

export interface DendroCoreReservation
  extends DendroCoreReservationInput {
  coreId: number;
  spawnFrame: number;
}

export interface DendroCoreEntity {
  coreId: number;
  sourceActorId: string;
  sourceTargetId: string;
  originDamageEventId: number;
  triggerFrame: number;
  bloomReactionIndex: number;
  spawnedAtFrame: number;
  expiresAtFrame: number;
  position: { x: number; y: number };
  hitboxRadius: 2;
  spawnRadius: number;
  spawnAngleDegrees: number;
  positionRandomRoll: number;
}

export interface DendroCoreSpawnInput {
  reservation: DendroCoreReservation;
  frame: number;
  targetPosition: { x: number; y: number };
  targetHitboxRadius: number;
}

export interface DendroCoreSpawnDecision {
  spawned: Readonly<DendroCoreEntity>;
  evicted: readonly Readonly<DendroCoreEntity>[];
}

export interface DendroCoreRemovalDecision {
  core: Readonly<DendroCoreEntity>;
  operation: "expire" | "evict" | "consume";
  reason:
    | "NATURAL_EXPIRY"
    | "ACTIVE_CORE_LIMIT"
    | "BURGEON_CONTACT"
    | "HYPERBLOOM_CONTACT";
  reaction: DendroCoreReaction;
  damageFrame: number;
}

export interface DendroCoreTargetCandidate {
  targetId: string;
  position: { x: number; y: number } | null;
  hitboxRadius: number;
}

export interface DendroCoreTargetSelection {
  selectedTargetId: string | null;
  selectedPosition: { x: number; y: number } | null;
  distance: number | null;
  reason: "SELECTED_NEAREST_TARGET" | "NO_TARGET_IN_RANGE";
}

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string.`);
  }
}

function assertFrame(frame: number, field: string): void {
  if (!Number.isSafeInteger(frame) || frame < 0) {
    throw new RangeError(
      `${field} must be a non-negative safe integer.`
    );
  }
}

function assertNonNegativeNumber(
  value: number,
  field: string
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(
      `${field} must be a finite non-negative number.`
    );
  }
}

function cloneEntity(
  entity: DendroCoreEntity
): Readonly<DendroCoreEntity> {
  return Object.freeze({
    ...entity,
    position: Object.freeze({ ...entity.position })
  });
}

/**
 * Owns only active entity state. Scheduling, damage, logs, and UI projection
 * remain simulator responsibilities.
 */
export class DendroCoreManager {
  private readonly active = new Map<number, DendroCoreEntity>();
  private readonly usedReservationIds = new Set<number>();
  private nextCoreId = 0;

  constructor(private readonly random: DendroCoreRandomSource) {}

  reserve(
    input: Readonly<DendroCoreReservationInput>
  ): Readonly<DendroCoreReservation> {
    assertNonEmpty(input.sourceActorId, "sourceActorId");
    assertNonEmpty(input.sourceTargetId, "sourceTargetId");
    assertFrame(input.originDamageEventId, "originDamageEventId");
    assertFrame(input.triggerFrame, "triggerFrame");
    assertFrame(input.bloomReactionIndex, "bloomReactionIndex");
    return Object.freeze({
      ...input,
      coreId: this.nextCoreId++,
      spawnFrame:
        input.triggerFrame +
        DENDRO_CORE_CONSTANTS.spawnDelayFrames
    });
  }

  spawn(
    input: Readonly<DendroCoreSpawnInput>
  ): Readonly<DendroCoreSpawnDecision> {
    assertFrame(input.frame, "frame");
    assertFrame(input.reservation.coreId, "reservation.coreId");
    assertNonEmpty(
      input.reservation.sourceActorId,
      "reservation.sourceActorId"
    );
    assertNonEmpty(
      input.reservation.sourceTargetId,
      "reservation.sourceTargetId"
    );
    assertFrame(
      input.reservation.originDamageEventId,
      "reservation.originDamageEventId"
    );
    assertFrame(
      input.reservation.triggerFrame,
      "reservation.triggerFrame"
    );
    assertFrame(
      input.reservation.bloomReactionIndex,
      "reservation.bloomReactionIndex"
    );
    assertFrame(
      input.reservation.spawnFrame,
      "reservation.spawnFrame"
    );
    assertNonNegativeNumber(
      input.targetHitboxRadius,
      "targetHitboxRadius"
    );
    if (input.frame !== input.reservation.spawnFrame) {
      throw new RangeError(
        `Dendro core ${input.reservation.coreId} must spawn at frame ${input.reservation.spawnFrame}; got ${input.frame}.`
      );
    }
    if (
      !Number.isFinite(input.targetPosition.x) ||
      !Number.isFinite(input.targetPosition.y)
    ) {
      throw new TypeError(
        "targetPosition must contain finite coordinates."
      );
    }
    if (this.usedReservationIds.has(input.reservation.coreId)) {
      throw new Error(
        `Dendro core reservation ${input.reservation.coreId} has already been spawned.`
      );
    }

    const positionRandomRoll = this.random.next();
    if (
      !Number.isFinite(positionRandomRoll) ||
      positionRandomRoll < 0 ||
      positionRandomRoll >= 1
    ) {
      throw new RangeError(
        `Dendro core random source must return a value in [0, 1); got ${positionRandomRoll}.`
      );
    }
    const spawnRadius =
      input.targetHitboxRadius +
      DENDRO_CORE_CONSTANTS.spawnRadiusOffset;
    const spawnAngleDegrees = positionRandomRoll * 360;
    const radians = (spawnAngleDegrees * Math.PI) / 180;
    const entity: DendroCoreEntity = {
      coreId: input.reservation.coreId,
      sourceActorId: input.reservation.sourceActorId,
      sourceTargetId: input.reservation.sourceTargetId,
      originDamageEventId:
        input.reservation.originDamageEventId,
      triggerFrame: input.reservation.triggerFrame,
      bloomReactionIndex:
        input.reservation.bloomReactionIndex,
      spawnedAtFrame: input.frame,
      expiresAtFrame:
        input.frame + DENDRO_CORE_CONSTANTS.durationFrames,
      position: {
        x:
          input.targetPosition.x +
          Math.cos(radians) * spawnRadius,
        y:
          input.targetPosition.y +
          Math.sin(radians) * spawnRadius
      },
      hitboxRadius: DENDRO_CORE_CONSTANTS.hitboxRadius,
      spawnRadius,
      spawnAngleDegrees,
      positionRandomRoll
    };

    const evicted: DendroCoreEntity[] = [];
    while (
      this.active.size - evicted.length >=
      DENDRO_CORE_CONSTANTS.maxActiveCores
    ) {
      const excludedCoreIds = new Set(
        evicted.map((core) => core.coreId)
      );
      const oldest = this.oldestActive(excludedCoreIds);
      if (oldest === null) break;
      evicted.push(oldest);
    }

    for (const core of evicted) {
      this.active.delete(core.coreId);
    }
    this.active.set(entity.coreId, entity);
    this.usedReservationIds.add(entity.coreId);
    return Object.freeze({
      spawned: cloneEntity(entity),
      evicted: Object.freeze(evicted.map(cloneEntity))
    });
  }

  expire(
    coreId: number,
    frame: number
  ): Readonly<DendroCoreRemovalDecision> | null {
    assertFrame(coreId, "coreId");
    assertFrame(frame, "frame");
    const core = this.active.get(coreId);
    if (core === undefined) return null;
    if (frame < core.expiresAtFrame) {
      throw new RangeError(
        `Dendro core ${coreId} cannot expire before frame ${core.expiresAtFrame}.`
      );
    }
    this.active.delete(coreId);
    return Object.freeze({
      core: cloneEntity(core),
      operation: "expire",
      reason: "NATURAL_EXPIRY",
      reaction: "bloom",
      damageFrame:
        frame + DENDRO_CORE_CONSTANTS.bloomDamageDelayFrames
    });
  }

  consume(
    coreId: number,
    frame: number,
    element: "pyro" | "electro"
  ): Readonly<DendroCoreRemovalDecision> | null {
    assertFrame(coreId, "coreId");
    assertFrame(frame, "frame");
    const core = this.active.get(coreId);
    if (core === undefined) return null;
    if (frame >= core.expiresAtFrame) return null;
    this.active.delete(coreId);
    const pyro = element === "pyro";
    return Object.freeze({
      core: cloneEntity(core),
      operation: "consume",
      reason: pyro
        ? "BURGEON_CONTACT"
        : "HYPERBLOOM_CONTACT",
      reaction: pyro ? "burgeon" : "hyperbloom",
      damageFrame:
        frame +
        (pyro
          ? DENDRO_CORE_CONSTANTS.burgeonDamageDelayFrames
          : DENDRO_CORE_CONSTANTS.hyperbloomDamageDelayFrames)
    });
  }

  makeEvictionDecision(
    core: Readonly<DendroCoreEntity>,
    frame: number
  ): Readonly<DendroCoreRemovalDecision> {
    assertFrame(frame, "frame");
    return Object.freeze({
      core: cloneEntity(core),
      operation: "evict",
      reason: "ACTIVE_CORE_LIMIT",
      reaction: "bloom",
      damageFrame:
        frame + DENDRO_CORE_CONSTANTS.bloomDamageDelayFrames
    });
  }

  get(coreId: number): Readonly<DendroCoreEntity> | null {
    const core = this.active.get(coreId);
    return core === undefined ? null : cloneEntity(core);
  }

  snapshots(): readonly Readonly<DendroCoreEntity>[] {
    return Object.freeze(
      [...this.active.values()]
        .sort(
          (left, right) =>
            left.spawnedAtFrame - right.spawnedAtFrame ||
            left.coreId - right.coreId
        )
        .map(cloneEntity)
    );
  }

  private oldestActive(
    excludedCoreIds: ReadonlySet<number> = new Set()
  ): DendroCoreEntity | null {
    let oldest: DendroCoreEntity | null = null;
    for (const core of this.active.values()) {
      if (excludedCoreIds.has(core.coreId)) continue;
      if (
        oldest === null ||
        core.spawnedAtFrame < oldest.spawnedAtFrame ||
        (core.spawnedAtFrame === oldest.spawnedAtFrame &&
          core.coreId < oldest.coreId)
      ) {
        oldest = core;
      }
    }
    return oldest;
  }
}

/**
 * Hyperbloom chooses by enemy-center distance at the actual impact frame.
 * The selection circle intersects the enemy hurtbox, so a target is eligible
 * when its center distance is within selectionRadius + hitboxRadius.
 * Candidate array order is the deterministic equal-distance tie-break.
 */
export function selectNearestDendroCoreTarget(
  corePosition: Readonly<{ x: number; y: number }>,
  candidates: readonly Readonly<DendroCoreTargetCandidate>[],
  selectionRadius = DENDRO_CORE_CONSTANTS.hyperbloomSelectionRadius
): Readonly<DendroCoreTargetSelection> {
  assertNonNegativeNumber(selectionRadius, "selectionRadius");
  let selected: DendroCoreTargetCandidate | null = null;
  let selectedDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    assertNonNegativeNumber(
      candidate.hitboxRadius,
      "candidate.hitboxRadius"
    );
    if (candidate.position === null) continue;
    assertNonEmpty(candidate.targetId, "targetId");
    const distance = Math.hypot(
      candidate.position.x - corePosition.x,
      candidate.position.y - corePosition.y
    );
    if (
      distance <=
        selectionRadius + candidate.hitboxRadius + 1e-9 &&
      distance < selectedDistance - 1e-9
    ) {
      selected = candidate;
      selectedDistance = distance;
    }
  }
  if (selected === null || selected.position === null) {
    return Object.freeze({
      selectedTargetId: null,
      selectedPosition: null,
      distance: null,
      reason: "NO_TARGET_IN_RANGE"
    });
  }
  return Object.freeze({
    selectedTargetId: selected.targetId,
    selectedPosition: Object.freeze({ ...selected.position }),
    distance: selectedDistance,
    reason: "SELECTED_NEAREST_TARGET"
  });
}
