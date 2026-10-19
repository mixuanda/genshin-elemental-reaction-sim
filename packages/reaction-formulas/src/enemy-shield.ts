/** Source-backed arithmetic for the explicitly supported standard force-shield host. */
export const ENEMY_SHIELD_FORMULA_PROFILE = {
  id: "kqm-enemy-shield-gauge-20260925-v1",
  status: "provisional",
  sourceRefs: [
    "https://library.keqingmains.com/combat-mechanics/enemy-mechanics/enemy-shields-armor",
    "https://library.keqingmains.com/evidence/combat-mechanics/enemy-mechanics/enemy-shields",
    "https://docs.google.com/document/d/1SUc9A7O5C7CX0qYHmCqB44uhpHYY-Txgv6rdibM8Jw4/edit",
  ],
  standardAbyssMage: { baseGaugeUnits: 12, damageConversionRatio: 0.2, shieldHpRatio: 1 },
} as const;

export type StandardForceShieldElement = "pyro" | "frozen";
export type StandardForceShieldDamageElement = "physical" | "pyro" | "hydro" | "electro" | "cryo" | "dendro" | "anemo" | "geo";

/** Missing entries remain unsupported; they must not silently become zero. */
export const STANDARD_HOST_FORCE_SHIELD_REACTION_COEFFICIENTS: Readonly<Record<StandardForceShieldElement, Partial<Record<StandardForceShieldDamageElement, number>>>> = {
  pyro: { physical: 0, pyro: 0, hydro: 2, electro: 1, cryo: 0.5, anemo: 0.5, geo: 0.5 },
  frozen: { physical: 0, pyro: 2, hydro: 0, electro: 1, cryo: 0, anemo: 0.5, geo: 0.5 },
};

export interface StandardForceShieldSettlementInput {
  shieldElement: StandardForceShieldElement;
  maxGaugeUnits: number;
  targetMaxHp: number;
  gaugeBefore: number;
  damageElement: StandardForceShieldDamageElement;
  unamplifiedDamage: number;
  applicationGauge: number;
  applicationAllowed: boolean;
}

/** No target state, damage formula, ICD decision or input provenance is inferred here. */
export function settleStandardForceShield(input: StandardForceShieldSettlementInput) {
  const profile = ENEMY_SHIELD_FORMULA_PROFILE.standardAbyssMage;
  const reactionCoefficient = input.applicationAllowed
    ? STANDARD_HOST_FORCE_SHIELD_REACTION_COEFFICIENTS[input.shieldElement][input.damageElement]
    : 0;
  if (reactionCoefficient === undefined) throw new Error(`Unsupported shield reaction ${input.damageElement}/${input.shieldElement}`);
  const gaugeReachingShield = input.applicationAllowed ? input.applicationGauge : 0;
  const immuneSameElement = input.damageElement === (input.shieldElement === "frozen" ? "cryo" : input.shieldElement);
  const damageBasis = immuneSameElement ? 0 : input.unamplifiedDamage;
  const reactionCost = reactionCoefficient * gaugeReachingShield;
  const damageCost = profile.damageConversionRatio * damageBasis * input.maxGaugeUnits / (profile.shieldHpRatio * input.targetMaxHp);
  const poiseCost = 0;
  const totalGaugeCost = reactionCost + damageCost + poiseCost;
  const effectiveGaugeCost = Math.min(input.gaugeBefore, totalGaugeCost);
  const gaugeAfter = input.gaugeBefore - effectiveGaugeCost;
  const excessGaugeCost = totalGaugeCost - effectiveGaugeCost;
  return { reactionCoefficient, gaugeReachingShield, immuneSameElement, damageBasis, reactionCost, damageCost, poiseCost, totalGaugeCost, effectiveGaugeCost, excessGaugeCost, gaugeAfter, broken: gaugeAfter === 0 };
}
