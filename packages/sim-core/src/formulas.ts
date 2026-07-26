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

