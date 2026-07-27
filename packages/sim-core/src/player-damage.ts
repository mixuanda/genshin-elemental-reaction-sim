/**
 * Pure player-damage building blocks.
 *
 * Reference behavior was cross-checked against gcsim commit
 * b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541:
 * - `pkg/reactable/burning.go`
 * - `internal/template/dendrocore/dendrocore.go`
 * - `pkg/avatar/avatar.go`
 * - `pkg/core/player/shield/template.go`
 * - `internal/template/character/hp.go`
 *
 * These constants are a fixed compatibility reference, not verified
 * live-server data. TODO: replace every provisional value only after a
 * source-backed mechanics audit and a versioned migration.
 */
import { calcResistanceMultiplier } from "./formulas";

export const PLAYER_DAMAGE_REFERENCE = Object.freeze({
  project: "genshinsim/gcsim",
  revision: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
  mechanicsDataStatus: "fixed-gcsim-provisional",
  defenseIgnore: 1
} as const);

export const PLAYER_REACTION_SELF_DAMAGE_MULTIPLIERS =
  Object.freeze({
    burning: 1,
    bloom: 0.02,
    burgeon: 0.02,
    hyperbloom: 0.02
  } as const);

/**
 * Circular self-damage areas in world units. These inherit the same
 * provisional status as the fixed reference above.
 */
export const PLAYER_REACTION_SELF_DAMAGE_RADII = Object.freeze({
  burning: 1,
  bloom: 5,
  burgeon: 5,
  hyperbloom: 1
} as const);

export type PlayerReactionSelfDamageKind =
  keyof typeof PLAYER_REACTION_SELF_DAMAGE_MULTIPLIERS;

export const PLAYER_DAMAGE_ELEMENTS = [
  "physical",
  "anemo",
  "geo",
  "electro",
  "hydro",
  "pyro",
  "cryo",
  "dendro"
] as const;

export type PlayerDamageElement =
  (typeof PLAYER_DAMAGE_ELEMENTS)[number];

export interface Point2D {
  x: number;
  y: number;
}

export interface PlayerMaxHpInput {
  baseHp: number;
  hpPct: number;
  flatHp: number;
}

export interface PlayerMaxHpCalculation extends PlayerMaxHpInput {
  unclampedMaxHp: number;
  maxHp: number;
}

export interface PlayerReactionSelfDamageInput {
  reaction: PlayerReactionSelfDamageKind;
  /**
   * Damage after reaction scaling and damage bonuses, but before target
   * resistance. The self-damage multiplier is applied to this amount.
   */
  sourcePreResistanceDamage: number;
  effectiveResistance: number;
}

export interface PlayerReactionSelfDamageCalculation
  extends PlayerReactionSelfDamageInput {
  selfDamageMultiplier: number;
  preResistanceDamage: number;
  resistanceMultiplier: number;
  ignoreDefense: 1;
  defenseMultiplier: 1;
  finalDamage: number;
}

export interface CircularPlayerHitInput {
  damageCenter: Point2D;
  damageRadius: number;
  playerCenter: Point2D;
  playerRadius: number;
}

export interface CircularPlayerHitResolution {
  hit: boolean;
  distance: number;
  distanceSquared: number;
  combinedRadius: number;
  combinedRadiusSquared: number;
}

export interface CrystallizeShieldAbsorptionInput {
  incomingDamage: number;
  incomingElement: PlayerDamageElement;
  shieldElement: PlayerDamageElement;
  /**
   * The shield's remaining unscaled HP. Elemental and shield-strength
   * multipliers affect absorption, never the amount stored here.
   */
  currentBaseHp: number;
  elementalMasteryBonus?: number;
  shieldStrengthBonus?: number;
}

export interface CrystallizeShieldAbsorptionResolution {
  incomingDamage: number;
  incomingElement: PlayerDamageElement;
  shieldElement: PlayerDamageElement;
  elementalMasteryBonus: number;
  shieldStrengthBonus: number;
  absorptionMultiplier: 1 | 1.5 | 2.5;
  effectiveAbsorptionMultiplier: number;
  baseHpBefore: number;
  baseHpConsumed: number;
  baseHpAfter: number;
  absorptionCapacity: number;
  absorbedDamage: number;
  damageAfterShield: number;
  shieldBroken: boolean;
}

export interface PlayerHpDamageInput {
  currentHp: number;
  maxHp: number;
  incomingDamage: number;
}

export interface PlayerHpDamageResolution {
  inputCurrentHp: number;
  currentHpBefore: number;
  currentHpAfter: number;
  maxHp: number;
  attemptedLoss: number;
  actualLoss: number;
  overkill: number;
  hpRatioBefore: number;
  hpRatioAfter: number;
}

function assertFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${field} must be finite.`);
  }
}

function assertNonNegative(value: number, field: string): void {
  assertFinite(value, field);
  if (value < 0) {
    throw new RangeError(`${field} must be non-negative.`);
  }
}

function assertElement(
  value: string,
  field: "incomingElement" | "shieldElement"
): asserts value is PlayerDamageElement {
  if (!(PLAYER_DAMAGE_ELEMENTS as readonly string[]).includes(value)) {
    throw new TypeError(
      `${field} must be one of: ${PLAYER_DAMAGE_ELEMENTS.join(", ")}.`
    );
  }
}

function assertPoint(point: Point2D, field: string): void {
  assertFinite(point.x, `${field}.x`);
  assertFinite(point.y, `${field}.y`);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Max HP follows `BaseHP * (1 + HP%) + flat HP`. A zero floor makes malformed
 * negative modifier combinations auditable without allowing negative health.
 */
export function calcPlayerMaxHp(
  input: Readonly<PlayerMaxHpInput>
): Readonly<PlayerMaxHpCalculation> {
  assertNonNegative(input.baseHp, "baseHp");
  assertFinite(input.hpPct, "hpPct");
  assertFinite(input.flatHp, "flatHp");

  const unclampedMaxHp =
    input.baseHp * (1 + input.hpPct) + input.flatHp;
  const maxHp = Math.max(0, unclampedMaxHp);
  return Object.freeze({
    ...input,
    unclampedMaxHp,
    maxHp
  });
}

/**
 * Three-segment resistance formula. The high-resistance branch starts at
 * exactly 75%, matching the canonical formula used by this simulator.
 */
export function calcPlayerResistanceMultiplier(
  resistance: number
): number {
  assertFinite(resistance, "resistance");
  return calcResistanceMultiplier(resistance);
}

/**
 * Computes reaction self-damage before shields and HP clamping.
 *
 * Transformative reaction attacks in the fixed reference set
 * `IgnoreDefPercent = 1`, so their player-facing defense multiplier is
 * exactly one.
 */
export function calcPlayerReactionSelfDamage(
  input: Readonly<PlayerReactionSelfDamageInput>
): Readonly<PlayerReactionSelfDamageCalculation> {
  assertNonNegative(
    input.sourcePreResistanceDamage,
    "sourcePreResistanceDamage"
  );
  assertFinite(input.effectiveResistance, "effectiveResistance");
  const selfDamageMultiplier =
    PLAYER_REACTION_SELF_DAMAGE_MULTIPLIERS[input.reaction];
  if (selfDamageMultiplier === undefined) {
    throw new TypeError(
      `reaction must be one of: ${Object.keys(
        PLAYER_REACTION_SELF_DAMAGE_MULTIPLIERS
      ).join(", ")}.`
    );
  }

  const preResistanceDamage =
    input.sourcePreResistanceDamage * selfDamageMultiplier;
  const resistanceMultiplier = calcPlayerResistanceMultiplier(
    input.effectiveResistance
  );
  return Object.freeze({
    ...input,
    selfDamageMultiplier,
    preResistanceDamage,
    resistanceMultiplier,
    ignoreDefense: PLAYER_DAMAGE_REFERENCE.defenseIgnore,
    defenseMultiplier: 1,
    finalDamage:
      preResistanceDamage * resistanceMultiplier
  });
}

/**
 * Circle-circle collision used for reaction self-damage. Tangency counts as
 * a hit, consistent with the fixed reference's hurtbox intersection test.
 */
export function resolveCircularPlayerHit(
  input: Readonly<CircularPlayerHitInput>
): Readonly<CircularPlayerHitResolution> {
  assertPoint(input.damageCenter, "damageCenter");
  assertPoint(input.playerCenter, "playerCenter");
  assertNonNegative(input.damageRadius, "damageRadius");
  assertNonNegative(input.playerRadius, "playerRadius");

  const deltaX = input.damageCenter.x - input.playerCenter.x;
  const deltaY = input.damageCenter.y - input.playerCenter.y;
  const distanceSquared = deltaX * deltaX + deltaY * deltaY;
  const combinedRadius = input.damageRadius + input.playerRadius;
  const combinedRadiusSquared = combinedRadius * combinedRadius;
  return Object.freeze({
    hit: distanceSquared <= combinedRadiusSquared,
    distance: Math.sqrt(distanceSquared),
    distanceSquared,
    combinedRadius,
    combinedRadiusSquared
  });
}

function crystallizeElementMultiplier(
  incomingElement: PlayerDamageElement,
  shieldElement: PlayerDamageElement
): 1 | 1.5 | 2.5 {
  if (incomingElement === shieldElement) return 2.5;
  // The fixed reference grants Crystallize shields 1.5x absorption against
  // incoming Geo damage. Crystallize itself never creates a Geo-element shard.
  if (incomingElement === "geo") return 1.5;
  return 1;
}

/**
 * Resolves one hit against a Crystallize-style shield.
 *
 * `baseHpConsumed * effectiveAbsorptionMultiplier === absorbedDamage`
 * (within floating-point precision), so the remaining stored base HP is
 * conserved across ordinary, matching-element, and Geo absorption.
 */
export function absorbPlayerDamageWithCrystallizeShield(
  input: Readonly<CrystallizeShieldAbsorptionInput>
): Readonly<CrystallizeShieldAbsorptionResolution> {
  assertNonNegative(input.incomingDamage, "incomingDamage");
  assertNonNegative(input.currentBaseHp, "currentBaseHp");
  assertElement(input.incomingElement, "incomingElement");
  assertElement(input.shieldElement, "shieldElement");

  const elementalMasteryBonus =
    input.elementalMasteryBonus ?? 0;
  const shieldStrengthBonus = input.shieldStrengthBonus ?? 0;
  assertFinite(elementalMasteryBonus, "elementalMasteryBonus");
  assertFinite(shieldStrengthBonus, "shieldStrengthBonus");
  const totalBonus =
    1 + elementalMasteryBonus + shieldStrengthBonus;
  if (totalBonus <= 0) {
    throw new RangeError(
      "1 + elementalMasteryBonus + shieldStrengthBonus must be positive."
    );
  }

  const absorptionMultiplier = crystallizeElementMultiplier(
    input.incomingElement,
    input.shieldElement
  );
  const effectiveAbsorptionMultiplier =
    absorptionMultiplier * totalBonus;
  const baseHpBefore = input.currentBaseHp;
  const absorptionCapacity =
    baseHpBefore * effectiveAbsorptionMultiplier;
  const absorbedDamage = Math.min(
    input.incomingDamage,
    absorptionCapacity
  );
  const shieldBroken =
    input.incomingDamage >= absorptionCapacity;
  const baseHpConsumed = shieldBroken
    ? baseHpBefore
    : absorbedDamage / effectiveAbsorptionMultiplier;
  const baseHpAfter = shieldBroken
    ? 0
    : baseHpBefore - baseHpConsumed;
  const damageAfterShield = Math.max(
    0,
    input.incomingDamage - absorbedDamage
  );

  return Object.freeze({
    incomingDamage: input.incomingDamage,
    incomingElement: input.incomingElement,
    shieldElement: input.shieldElement,
    elementalMasteryBonus,
    shieldStrengthBonus,
    absorptionMultiplier,
    effectiveAbsorptionMultiplier,
    baseHpBefore,
    baseHpConsumed,
    baseHpAfter,
    absorptionCapacity,
    absorbedDamage,
    damageAfterShield,
    shieldBroken
  });
}

/**
 * Applies post-shield damage to HP and records both actual loss and overkill.
 * Input HP is clamped first, preserving the invariant `0 <= HP <= max HP`.
 */
export function applyPlayerHpDamage(
  input: Readonly<PlayerHpDamageInput>
): Readonly<PlayerHpDamageResolution> {
  assertFinite(input.currentHp, "currentHp");
  assertNonNegative(input.maxHp, "maxHp");
  assertNonNegative(input.incomingDamage, "incomingDamage");

  const currentHpBefore = clamp(
    input.currentHp,
    0,
    input.maxHp
  );
  const attemptedLoss = input.incomingDamage;
  const actualLoss = Math.min(currentHpBefore, attemptedLoss);
  const currentHpAfter = currentHpBefore - actualLoss;
  const overkill = attemptedLoss - actualLoss;
  const hpRatioBefore =
    input.maxHp === 0 ? 0 : currentHpBefore / input.maxHp;
  const hpRatioAfter =
    input.maxHp === 0 ? 0 : currentHpAfter / input.maxHp;

  return Object.freeze({
    inputCurrentHp: input.currentHp,
    currentHpBefore,
    currentHpAfter,
    maxHp: input.maxHp,
    attemptedLoss,
    actualLoss,
    overkill,
    hpRatioBefore,
    hpRatioAfter
  });
}
