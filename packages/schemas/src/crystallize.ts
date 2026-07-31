/**
 * Crystallize shield base HP from fixed gcsim commit
 * b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541.
 *
 * The referenced implementation clamps character levels to 1–100 even though
 * its generated table currently contains additional future-level entries.
 * This module is shared by sim-core and the versioned result-integrity proof
 * so the authoritative formula and its validator cannot drift apart.
 */
const CRYSTALLIZE_SHIELD_BASE_HP = [
  91.1791, 98.707664, 106.23622, 113.76477, 121.29332, 128.82188,
  136.35042, 143.87898, 151.40752, 158.93608, 169.99149, 181.07625,
  192.19037, 204.0482, 215.939, 227.86275, 247.68594, 267.5421,
  287.4312, 303.82642, 320.22522, 336.62762, 352.31927, 368.01093,
  383.70255, 394.43237, 405.18146, 415.94992, 426.73764, 437.5447,
  450.6, 463.7003, 476.84558, 491.1275, 502.55457, 514.0121,
  531.4096, 549.9796, 568.5849, 584.9965, 605.67035, 626.3862,
  646.0523, 665.7556, 685.4961, 700.8394, 723.3331, 745.8653,
  768.4357, 786.79193, 809.5388, 832.32904, 855.16266, 878.0396,
  899.4848, 919.362, 946.0396, 974.7642, 1003.5786, 1030.077,
  1056.635, 1085.2463, 1113.9244, 1149.2587, 1178.0648, 1200.2238,
  1227.6603, 1257.243, 1284.9174, 1314.7529, 1342.6652, 1372.7524,
  1396.321, 1427.3124, 1458.3745, 1482.3358, 1511.9109, 1541.5493,
  1569.1537, 1596.8143, 1622.4197, 1648.074, 1666.3761, 1684.6782,
  1702.9803, 1726.1047, 1754.6715, 1785.8666, 1817.1375, 1851.0603,
  1885.0671, 1921.7493, 1958.5233, 2006.1941, 2041.569, 2054.4722,
  2065.975, 2174.7227, 2186.7683, 2198.814
] as const;

export interface CrystallizeShieldCalculation {
  characterLevel: number;
  elementalMastery: number;
  baseHp: number;
  elementalMasteryBonus: number;
  generalAbsorption: number;
  matchingElementAbsorption: number;
  geoDamageAbsorption: number;
}

export function calcCrystallizeShield(
  characterLevel: number,
  elementalMastery: number
): CrystallizeShieldCalculation {
  const clampedLevel = Math.max(
    1,
    Math.min(100, Math.trunc(characterLevel))
  );
  const em = Math.max(0, elementalMastery);
  const baseHp =
    CRYSTALLIZE_SHIELD_BASE_HP[clampedLevel - 1] ??
    CRYSTALLIZE_SHIELD_BASE_HP[0];
  const elementalMasteryBonus =
    (40 / 9) * (em / (1400 + em));
  const generalAbsorption = baseHp * (1 + elementalMasteryBonus);
  return {
    characterLevel: clampedLevel,
    elementalMastery: em,
    baseHp,
    elementalMasteryBonus,
    generalAbsorption,
    matchingElementAbsorption: generalAbsorption * 2.5,
    geoDamageAbsorption: generalAbsorption * 1.5
  };
}

export const CRYSTALLIZE_CONSTANTS = {
  queueGcdFrames: 60,
  shardSpawnDelayFrames: 23,
  earliestPickupDelayFrames: 54,
  shardDurationFrames: 15 * 60,
  shieldDurationFrames: Math.round(15.1 * 60),
  maxActiveShards: 3,
  shardHitboxRadius: 2,
  shieldBaseHp: CRYSTALLIZE_SHIELD_BASE_HP
} as const;
