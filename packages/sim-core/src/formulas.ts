import type {
  AmplifyingReaction,
  CharacterStats,
  CritMode,
  DamageFactors,
  ScalingStat
} from "@genshin-dps-lab/schemas";

const AMPLIFYING_REACTION_BASE: Record<AmplifyingReaction, number> = {
  none: 1,
  melt: 2,
  reverseMelt: 1.5,
  vaporize: 2,
  reverseVaporize: 1.5
};

/**
 * gcsim commit b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541,
 * pkg/core/combat/reaction.dm.go, levels 1–100.
 */
export const TRANSFORMATIVE_REACTION_LEVEL_BASE = [
  17.165606,
  18.535048,
  19.904854,
  21.274902,
  22.6454,
  24.649612,
  26.640642,
  28.868587,
  31.36768,
  34.143345,
  37.201,
  40.66,
  44.446667,
  48.56352,
  53.74848,
  59.081898,
  64.420044,
  69.72446,
  75.12314,
  80.58478,
  86.11203,
  91.70374,
  97.24463,
  102.812645,
  108.40956,
  113.20169,
  118.102905,
  122.97932,
  129.72733,
  136.29291,
  142.67085,
  149.02902,
  155.41699,
  161.8255,
  169.10631,
  176.51808,
  184.07274,
  191.70952,
  199.55692,
  207.38205,
  215.3989,
  224.16566,
  233.50217,
  243.35057,
  256.06308,
  268.5435,
  281.52606,
  295.01364,
  309.0672,
  323.6016,
  336.75754,
  350.5303,
  364.4827,
  378.61917,
  398.6004,
  416.39825,
  434.387,
  452.95105,
  472.60623,
  492.8849,
  513.56854,
  539.1032,
  565.51056,
  592.53876,
  624.4434,
  651.47015,
  679.4968,
  707.79407,
  736.67145,
  765.64026,
  794.7734,
  824.67737,
  851.1578,
  877.74207,
  914.2291,
  946.74677,
  979.4114,
  1011.223,
  1044.7917,
  1077.4437,
  1109.9976,
  1142.9766,
  1176.3695,
  1210.1844,
  1253.8357,
  1288.9528,
  1325.4841,
  1363.4569,
  1405.0974,
  1446.8535,
  1462.788,
  1475.6956,
  1497.9644,
  1516.9423,
  1561.468,
  1593.5062,
  1621.0258,
  1643.8679,
  1662.1382,
  1674.8092
] as const;

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
  if (resistance < 0) return 1 - resistance / 2;
  if (resistance < 0.75) return 1 - resistance;
  return 1 / (4 * resistance + 1);
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
  const levelIndex = clamp(Math.trunc(input.characterLevel), 1, 100) - 1;
  const levelBaseDamage =
    TRANSFORMATIVE_REACTION_LEVEL_BASE[levelIndex] ??
    TRANSFORMATIVE_REACTION_LEVEL_BASE[0];
  const elementalMastery = Math.max(0, input.elementalMastery);
  const elementalMasteryBonus =
    (16 * elementalMastery) / (2000 + elementalMastery);
  const reactionBonus = Math.max(0, input.reactionBonus);
  const preResistanceDamage =
    levelBaseDamage *
    input.baseMultiplier *
    (1 + elementalMasteryBonus + reactionBonus);
  const resistanceMultiplier = calcResistanceMultiplier(
    input.effectiveResistance
  );
  return {
    finalDamage: preResistanceDamage * resistanceMultiplier,
    levelBaseDamage,
    elementalMasteryBonus,
    reactionBonus,
    preResistanceDamage,
    resistanceMultiplier
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
  const base =
    input.explicitBase ?? AMPLIFYING_REACTION_BASE[input.reaction] ?? 1;
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
    (2.78 * elementalMastery) / (1400 + elementalMastery);
  const reactionBonus = Math.max(0, input.reactionBonus ?? 0);
  return {
    base,
    elementalMasteryBonus,
    reactionBonus,
    total: base * (1 + elementalMasteryBonus + reactionBonus)
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
