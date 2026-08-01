export const REACTION_FORMULA_PROFILE_VERSION = "1.0.0" as const;

export const CLASSIC_REACTION_FORMULA_PROFILE_ID =
  "gcsim-b4ae769-classic-provisional-v1" as const;

export const CLASSIC_REACTION_FORMULA_SOURCE_REVISION =
  "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541" as const;

const MECHANICS_DATA_STATUS = "fixed-gcsim-provisional" as const;
const SOURCE_PROJECT = "genshinsim/gcsim" as const;

function deepFreeze<T>(value: T): T {
  if (
    value !== null &&
    typeof value === "object" &&
    !Object.isFrozen(value)
  ) {
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze((value as Record<PropertyKey, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

/**
 * Fixed gcsim reaction level bases for character levels 1–100.
 *
 * Source: genshinsim/gcsim at CLASSIC_REACTION_FORMULA_SOURCE_REVISION,
 * pkg/core/combat/reaction.dm.go. Index zero is level 1; there is no level-zero
 * sentinel.
 */
const LEVEL_BASE_DAMAGE_BY_LEVEL = [
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

const AMPLIFYING_BASE_MULTIPLIERS = {
  none: 1,
  melt: 2,
  reverseMelt: 1.5,
  vaporize: 2,
  reverseVaporize: 1.5
} as const;

const TRANSFORMATIVE_BASE_MULTIPLIERS = {
  overload: 2.75,
  superconduct: 1.5,
  electroCharged: 2,
  burning: 0.25,
  shatter: 3,
  swirlPyro: 0.6,
  swirlHydro: 0.6,
  swirlCryo: 0.6,
  swirlElectro: 0.6,
  bloom: 2,
  burgeon: 3,
  hyperbloom: 3
} as const;

const SWIRL_PROPAGATION_BASE_MULTIPLIERS = {
  swirlPyro: 0.6,
  swirlHydro: 0,
  swirlCryo: 0.6,
  swirlElectro: 0.6
} as const;

const ADDITIVE_BASE_MULTIPLIERS = {
  aggravate: 1.15,
  spread: 1.25
} as const;

const FORMULA_SEMANTIC_IDS = {
  amplifyingElementalMasteryBonus:
    "genshin-amplifying-em-max0-2p78-em-over-1400-plus-em-v1",
  transformativeElementalMasteryBonus:
    "genshin-transformative-em-max0-16-em-over-2000-plus-em-v1",
  additiveElementalMasteryBonus:
    "genshin-additive-em-max0-5-em-over-1200-plus-em-v1",
  resistanceMultiplier:
    "genshin-resistance-three-branch-lt0-half-lt0p75-linear-gte0p75-reciprocal-v1"
} as const;

/**
 * Canonical, immutable payload whose bytes define this reaction-formula root.
 * The data is deliberately marked provisional: it is fixed to one gcsim
 * revision and is not represented as official live-server truth.
 */
export const CLASSIC_REACTION_FORMULA_PROFILE = deepFreeze({
  version: REACTION_FORMULA_PROFILE_VERSION,
  profileId: CLASSIC_REACTION_FORMULA_PROFILE_ID,
  provenance: {
    mechanicsDataStatus: MECHANICS_DATA_STATUS,
    sourceProject: SOURCE_PROJECT,
    sourceRevision: CLASSIC_REACTION_FORMULA_SOURCE_REVISION,
    officialServerTruth: false,
    completeGcsimParity: false
  },
  levelBaseDamageByLevel: LEVEL_BASE_DAMAGE_BY_LEVEL,
  amplifyingBaseMultipliers: AMPLIFYING_BASE_MULTIPLIERS,
  transformativeBaseMultipliers: TRANSFORMATIVE_BASE_MULTIPLIERS,
  swirlPropagationBaseMultipliers:
    SWIRL_PROPAGATION_BASE_MULTIPLIERS,
  additiveBaseMultipliers: ADDITIVE_BASE_MULTIPLIERS,
  semanticIds: FORMULA_SEMANTIC_IDS
} as const);

export type ClassicReactionFormulaProfile =
  typeof CLASSIC_REACTION_FORMULA_PROFILE;
export type ClassicAmplifyingReaction =
  keyof ClassicReactionFormulaProfile["amplifyingBaseMultipliers"];
export type ClassicTransformativeReaction =
  keyof ClassicReactionFormulaProfile["transformativeBaseMultipliers"];
export type ClassicSwirlReaction =
  keyof ClassicReactionFormulaProfile["swirlPropagationBaseMultipliers"];
export type ClassicAdditiveReaction =
  keyof ClassicReactionFormulaProfile["additiveBaseMultipliers"];
export type TransformativeDamageChannel = "self" | "propagation";

function canonicalJson(value: unknown, ancestors: Set<object>): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("canonical JSON does not allow non-finite numbers");
    }
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new TypeError(
      `canonical JSON does not allow values of type ${typeof value}`
    );
  }
  if (ancestors.has(value)) {
    throw new TypeError("canonical JSON does not allow cyclic values");
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value
        .map((item) => {
          if (item === undefined) {
            throw new TypeError(
              "canonical JSON does not allow undefined array entries"
            );
          }
          return canonicalJson(item, ancestors);
        })
        .join(",")}]`;
    }

    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .flatMap((key) => {
        const item = object[key];
        return item === undefined
          ? []
          : [`${JSON.stringify(key)}:${canonicalJson(item, ancestors)}`];
      })
      .join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalReactionFormulaPayloadJson(): string {
  return canonicalJson(CLASSIC_REACTION_FORMULA_PROFILE, new Set());
}

export const CLASSIC_REACTION_FORMULA_CONTENT_SHA256 =
  "sha256:7ae4ee955e0c7986c47931cff596694c8cd4754b48df90e0ad1cf092738ccafd" as const;

export const CLASSIC_REACTION_FORMULA_ROOT = deepFreeze({
  version: REACTION_FORMULA_PROFILE_VERSION,
  profileId: CLASSIC_REACTION_FORMULA_PROFILE_ID,
  contentHash: CLASSIC_REACTION_FORMULA_CONTENT_SHA256,
  mechanicsDataStatus: MECHANICS_DATA_STATUS,
  sourceProject: SOURCE_PROJECT,
  sourceRevision: CLASSIC_REACTION_FORMULA_SOURCE_REVISION,
  officialServerTruth: false,
  completeGcsimParity: false
} as const);

export type ClassicReactionFormulaRoot =
  typeof CLASSIC_REACTION_FORMULA_ROOT;

function requireFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${field} must be finite`);
  }
}

export function resolveReactionLevelBase(characterLevel: number): number {
  if (
    !Number.isInteger(characterLevel) ||
    characterLevel < 1 ||
    characterLevel >
      CLASSIC_REACTION_FORMULA_PROFILE.levelBaseDamageByLevel.length
  ) {
    throw new RangeError(
      `characterLevel must be an integer from 1 to ${CLASSIC_REACTION_FORMULA_PROFILE.levelBaseDamageByLevel.length}`
    );
  }
  return CLASSIC_REACTION_FORMULA_PROFILE.levelBaseDamageByLevel[
    characterLevel - 1
  ]!;
}

export function resolveAmplifyingBaseMultiplier(
  reaction: ClassicAmplifyingReaction
): number {
  const value =
    CLASSIC_REACTION_FORMULA_PROFILE.amplifyingBaseMultipliers[
      reaction
    ];
  if (value === undefined) {
    throw new TypeError(`unsupported amplifying reaction: ${reaction}`);
  }
  return value;
}

export function resolveTransformativeBaseMultiplier(
  reaction: ClassicTransformativeReaction,
  channel: TransformativeDamageChannel = "self"
): number {
  if (channel === "propagation") {
    const value = (
      CLASSIC_REACTION_FORMULA_PROFILE.swirlPropagationBaseMultipliers as
        Partial<Record<ClassicTransformativeReaction, number>>
    )[reaction];
    if (value === undefined) {
      throw new RangeError(
        `propagation damage is only defined for classic Swirl reactions: ${reaction}`
      );
    }
    return value;
  }
  const value =
    CLASSIC_REACTION_FORMULA_PROFILE.transformativeBaseMultipliers[
      reaction
    ];
  if (value === undefined) {
    throw new TypeError(`unsupported transformative reaction: ${reaction}`);
  }
  return value;
}

export function resolveAdditiveBaseMultiplier(
  reaction: ClassicAdditiveReaction
): number {
  const value =
    CLASSIC_REACTION_FORMULA_PROFILE.additiveBaseMultipliers[reaction];
  if (value === undefined) {
    throw new TypeError(`unsupported additive reaction: ${reaction}`);
  }
  return value;
}

export function calcAmplifyingEmBonus(elementalMastery: number): number {
  requireFinite(elementalMastery, "elementalMastery");
  const em = Math.max(0, elementalMastery);
  return (2.78 * em) / (1400 + em);
}

export function calcTransformativeEmBonus(
  elementalMastery: number
): number {
  requireFinite(elementalMastery, "elementalMastery");
  const em = Math.max(0, elementalMastery);
  return (16 * em) / (2000 + em);
}

export function calcAdditiveEmBonus(elementalMastery: number): number {
  requireFinite(elementalMastery, "elementalMastery");
  const em = Math.max(0, elementalMastery);
  return (5 * em) / (1200 + em);
}

export function calcReactionResistanceMultiplier(
  resistance: number
): number {
  requireFinite(resistance, "resistance");
  if (resistance < 0) return 1 - resistance / 2;
  if (resistance < 0.75) return 1 - resistance;
  return 1 / (4 * resistance + 1);
}

// Long-form aliases keep the source/profile identity explicit for consumers
// that store more than one formula family.
export const GCSIM_CLASSIC_REACTION_FORMULA_PROFILE_ID =
  CLASSIC_REACTION_FORMULA_PROFILE_ID;
export const GCSIM_CLASSIC_REACTION_FORMULA_SOURCE_REVISION =
  CLASSIC_REACTION_FORMULA_SOURCE_REVISION;
export const GCSIM_CLASSIC_REACTION_FORMULA_PROFILE =
  CLASSIC_REACTION_FORMULA_PROFILE;
export const GCSIM_CLASSIC_REACTION_FORMULA_PAYLOAD =
  CLASSIC_REACTION_FORMULA_PROFILE;
export const GCSIM_CLASSIC_REACTION_FORMULA_CONTENT_SHA256 =
  CLASSIC_REACTION_FORMULA_CONTENT_SHA256;
export const GCSIM_CLASSIC_REACTION_FORMULA_ROOT =
  CLASSIC_REACTION_FORMULA_ROOT;
export type GcsimClassicReactionFormulaPayload =
  ClassicReactionFormulaProfile;
export type GcsimClassicReactionFormulaRoot = ClassicReactionFormulaRoot;
