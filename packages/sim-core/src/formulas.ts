import type {
  AdditiveReaction,
  AmplifyingReaction,
  CharacterStats,
  CritMode,
  DamageFactors,
  ScalingStat
} from "@genshin-dps-lab/schemas";
import {
  CLASSIC_REACTION_FORMULA_PROFILE,
  calcAdditiveEmBonus,
  calcAmplifyingEmBonus,
  calcReactionResistanceMultiplier,
  calcTransformativeEmBonus,
  resolveAdditiveBaseMultiplier,
  resolveAmplifyingBaseMultiplier
} from "@genshin-dps-lab/reaction-formulas";

/**
 * gcsim commit b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541,
 * pkg/core/combat/reaction.dm.go, levels 1–100. This fixed reference is
 * provisional mechanics data, not official live-server truth.
 */
export const TRANSFORMATIVE_REACTION_LEVEL_BASE =
  CLASSIC_REACTION_FORMULA_PROFILE.levelBaseDamageByLevel;

export interface DefenseMultiplierInput {
  characterLevel: number;
  enemyLevel: number;
  defenseReduction?: number;
  defenseIgnore?: number;
}

export interface CritMultiplierInput {
  critRate: number;
  critDamage: number;
  critMode: CritMode;
}

export interface AmplifyingReactionMultiplierInput {
  reaction: AmplifyingReaction;
  elementalMastery: number;
  reactionBonus?: number;
  explicitBase?: number;
}

export interface DamageCalculationInput {
  scaling: number;
  scalingStat: ScalingStat;
  scalingValue: number;
  flatDamage: number;
  damageBonus: number;
  characterLevel: number;
  enemyLevel: number;
  defenseReduction: number;
  defenseIgnore: number;
  effectiveResistance: number;
  critRate: number;
  critDamage: number;
  critMode: CritMode;
  reaction: AmplifyingReaction;
  elementalMastery: number;
  reactionBonus: number;
  explicitReactionBase?: number;
  groupMultiplier: number;
}

export interface DamageCalculationResult {
  finalDamage: number;
  factors: DamageFactors;
}

export interface TransformativeReactionDamageInput {
  characterLevel: number;
  elementalMastery: number;
  reactionBonus: number;
  baseMultiplier: number;
  effectiveResistance: number;
}

export interface TransformativeReactionDamageResult {
  finalDamage: number;
  levelBaseDamage: number;
  elementalMasteryBonus: number;
  reactionBonus: number;
  preResistanceDamage: number;
  resistanceMultiplier: number;
}

export interface AdditiveReactionDamageInput {
  reaction: AdditiveReaction;
  characterLevel: number;
  elementalMastery: number;
  reactionBonus: number;
}

export interface AdditiveReactionDamageResult {
  reaction: AdditiveReaction;
  levelBaseDamage: number;
  baseMultiplier: number;
  elementalMasteryBonus: number;
  reactionBonus: number;
  flatDamage: number;
}

function resolveReactionLevelBase(characterLevel: number): number {
  if (
    !Number.isInteger(characterLevel) ||
    characterLevel < 1 ||
    characterLevel > TRANSFORMATIVE_REACTION_LEVEL_BASE.length
  ) {
    throw new RangeError(
      `characterLevel must be an integer from 1 to ${TRANSFORMATIVE_REACTION_LEVEL_BASE.length}`
    );
  }
  const levelBaseDamage =
    TRANSFORMATIVE_REACTION_LEVEL_BASE[characterLevel - 1];
  if (
    levelBaseDamage === undefined ||
    !Number.isFinite(levelBaseDamage) ||
    levelBaseDamage <= 0
  ) {
    throw new RangeError(
      "characterLevel must resolve to a finite positive reaction level base"
    );
  }
  return levelBaseDamage;
}

function requireFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${field} must be finite`);
  }
}

function requireFiniteResult(
  value: number,
  calculation: string
): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(
      `${calculation} produced a non-finite result`
    );
  }
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function calcTotalStat(stats: CharacterStats, stat: ScalingStat): number {
  switch (stat) {
    case "atk":
      return stats.baseAtk * (1 + stats.atkPct) + stats.flatAtk;
    case "hp":
      return stats.baseHp * (1 + stats.hpPct) + stats.flatHp;
    case "def":
      return stats.baseDef * (1 + stats.defPct) + stats.flatDef;
    case "em":
      return stats.em;
  }
}

export function calcDefenseMultiplier(input: DefenseMultiplierInput): number {
  const defenseIgnore = clamp(input.defenseIgnore ?? 0, 0, 1);
  const defenseReduction = clamp(input.defenseReduction ?? 0, -1, 0.9);
  const characterTerm = input.characterLevel + 100;
  const enemyTerm =
    (input.enemyLevel + 100) *
    (1 + defenseReduction) *
    (1 - defenseIgnore);
  return characterTerm / (characterTerm + enemyTerm);
}

export function calcResistanceMultiplier(resistance: number): number {
  return calcReactionResistanceMultiplier(resistance);
}

export function calcCritMultiplier(input: CritMultiplierInput): number {
  const critRate = clamp(input.critRate, 0, 1);
  const critDamage = Math.max(0, input.critDamage);
  if (input.critMode === "allCrit") return 1 + critDamage;
  if (input.critMode === "noCrit") return 1;
  return 1 + critRate * critDamage;
}

export function calcTransformativeReactionDamage(
  input: TransformativeReactionDamageInput
): TransformativeReactionDamageResult {
  const levelBaseDamage = resolveReactionLevelBase(
    input.characterLevel
  );
  requireFinite(input.elementalMastery, "elementalMastery");
  requireFinite(input.reactionBonus, "reactionBonus");
  requireFinite(input.effectiveResistance, "effectiveResistance");
  if (
    !Number.isFinite(input.baseMultiplier) ||
    input.baseMultiplier < 0
  ) {
    throw new RangeError(
      "baseMultiplier must be a finite non-negative number"
    );
  }
  const elementalMastery = Math.max(0, input.elementalMastery);
  const elementalMasteryBonus =
    calcTransformativeEmBonus(elementalMastery);
  const reactionBonus = Math.max(0, input.reactionBonus);
  const preResistanceDamage =
    levelBaseDamage *
    input.baseMultiplier *
    (1 + elementalMasteryBonus + reactionBonus);
  const resistanceMultiplier = calcResistanceMultiplier(
    input.effectiveResistance
  );
  const finalDamage =
    preResistanceDamage * resistanceMultiplier;
  requireFiniteResult(
    preResistanceDamage,
    "transformative reaction damage"
  );
  requireFiniteResult(
    resistanceMultiplier,
    "transformative reaction resistance multiplier"
  );
  requireFiniteResult(
    finalDamage,
    "transformative reaction damage"
  );
  return {
    finalDamage,
    levelBaseDamage,
    elementalMasteryBonus,
    reactionBonus,
    preResistanceDamage,
    resistanceMultiplier
  };
}

export function calcAdditiveReactionDamage(
  input: AdditiveReactionDamageInput
): AdditiveReactionDamageResult {
  if (
    input.reaction !== "aggravate" &&
    input.reaction !== "spread"
  ) {
    throw new TypeError(
      'reaction must be either "aggravate" or "spread"'
    );
  }
  const levelBaseDamage = resolveReactionLevelBase(
    input.characterLevel
  );
  requireFinite(input.elementalMastery, "elementalMastery");
  requireFinite(input.reactionBonus, "reactionBonus");
  const elementalMastery = Math.max(0, input.elementalMastery);
  const elementalMasteryBonus =
    calcAdditiveEmBonus(elementalMastery);
  const reactionBonus = Math.max(0, input.reactionBonus);
  const baseMultiplier = resolveAdditiveBaseMultiplier(
    input.reaction
  );
  const flatDamage =
    levelBaseDamage *
    baseMultiplier *
    (1 + elementalMasteryBonus + reactionBonus);
  requireFiniteResult(flatDamage, "additive reaction damage");
  return {
    reaction: input.reaction,
    levelBaseDamage,
    baseMultiplier,
    elementalMasteryBonus,
    reactionBonus,
    flatDamage
  };
}

export function calcAmplifyingReactionMultiplier(
  input: AmplifyingReactionMultiplierInput
): {
  base: number;
  elementalMasteryBonus: number;
  reactionBonus: number;
  total: number;
} {
  if (
    input.reaction !== "none" &&
    input.reaction !== "melt" &&
    input.reaction !== "reverseMelt" &&
    input.reaction !== "vaporize" &&
    input.reaction !== "reverseVaporize"
  ) {
    throw new TypeError(
      "reaction must be a supported amplifying reaction"
    );
  }
  requireFinite(input.elementalMastery, "elementalMastery");
  if (input.reactionBonus !== undefined) {
    requireFinite(input.reactionBonus, "reactionBonus");
  }
  if (input.explicitBase !== undefined) {
    if (
      !Number.isFinite(input.explicitBase) ||
      input.explicitBase <= 0
    ) {
      throw new RangeError(
        "explicitBase must be a finite positive number"
      );
    }
  }
  const base =
    input.explicitBase ??
    resolveAmplifyingBaseMultiplier(input.reaction);
  if (base === 1) {
    return {
      base: 1,
      elementalMasteryBonus: 0,
      reactionBonus: 0,
      total: 1
    };
  }
  const elementalMastery = Math.max(0, input.elementalMastery);
  const elementalMasteryBonus =
    calcAmplifyingEmBonus(elementalMastery);
  const reactionBonus = Math.max(0, input.reactionBonus ?? 0);
  const total =
    base * (1 + elementalMasteryBonus + reactionBonus);
  requireFiniteResult(total, "amplifying reaction multiplier");
  return {
    base,
    elementalMasteryBonus,
    reactionBonus,
    total
  };
}

export function calcDamage(input: DamageCalculationInput): DamageCalculationResult {
  const baseDamage = input.scaling * input.scalingValue + input.flatDamage;
  const damageBonusMultiplier = 1 + input.damageBonus;
  const defenseIgnore = clamp(input.defenseIgnore, 0, 1);
  const defenseReduction = clamp(input.defenseReduction, -1, 0.9);
  const defenseMultiplier = calcDefenseMultiplier({
    characterLevel: input.characterLevel,
    enemyLevel: input.enemyLevel,
    defenseReduction,
    defenseIgnore
  });
  const resistanceMultiplier = calcResistanceMultiplier(
    input.effectiveResistance
  );
  const critRate = clamp(input.critRate, 0, 1);
  const critDamage = Math.max(0, input.critDamage);
  const critMultiplier = calcCritMultiplier({
    critRate,
    critDamage,
    critMode: input.critMode
  });
  const reaction = calcAmplifyingReactionMultiplier({
    reaction: input.reaction,
    elementalMastery: input.elementalMastery,
    reactionBonus: input.reactionBonus,
    ...(input.explicitReactionBase === undefined
      ? {}
      : { explicitBase: input.explicitReactionBase })
  });
  const finalDamage =
    baseDamage *
    damageBonusMultiplier *
    defenseMultiplier *
    resistanceMultiplier *
    critMultiplier *
    reaction.total *
    input.groupMultiplier;

  return {
    finalDamage,
    factors: {
      scaling: input.scaling,
      scalingStat: input.scalingStat,
      scalingValue: input.scalingValue,
      flatDamage: input.flatDamage,
      baseDamage,
      damageBonus: input.damageBonus,
      damageBonusMultiplier,
      defenseIgnore,
      defenseReduction,
      defenseMultiplier,
      effectiveResistance: input.effectiveResistance,
      resistanceMultiplier,
      critRate,
      critDamage,
      critMultiplier,
      reactionBase: reaction.base,
      elementalMasteryBonus: reaction.elementalMasteryBonus,
      reactionBonus: reaction.reactionBonus,
      amplifyingReactionMultiplier: reaction.total,
      groupMultiplier: input.groupMultiplier
    }
  };
}
