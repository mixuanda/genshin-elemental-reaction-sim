export const DAMAGE_GROUP_PROFILE_VERSION = "1.0.0" as const;

export const GCSIM_DAMAGE_GROUP_PROFILE_ID =
  "gcsim-b4ae769-damage-groups-provisional-v1" as const;

export const GCSIM_DAMAGE_GROUP_SOURCE_REVISION =
  "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541" as const;

export const GCSIM_DAMAGE_GROUP_COVERAGE =
  "damage-group-reset-and-damage-sequences-only" as const;

export const GCSIM_DAMAGE_GROUP_TAIL_POLICY = "clamp-last" as const;

export const GCSIM_DAMAGE_GROUP_RESET_SCHEDULE_POLICY =
  "window-start-plus-reset-frames-minus-one" as const;

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
 * Fixed damage-group reset timers and damage multiplier sequences.
 *
 * Source: genshinsim/gcsim at GCSIM_DAMAGE_GROUP_SOURCE_REVISION,
 * pkg/core/attacks/icd_groups.dm.go. This intentionally excludes
 * ICDGroupEleApplicationSequence: even where a source group is named for a
 * reaction, the payload does not model elemental application or Aura ICD.
 */
const DAMAGE_GROUPS = [
  {
    id: "default",
    sourceName: "ICDGroupDefault",
    resetFrames: 150,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "pole-extra-attack",
    sourceName: "ICDGroupPoleExtraAttack",
    resetFrames: 30,
    damageSequence: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "reaction-a",
    sourceName: "ICDGroupReactionA",
    resetFrames: 30,
    damageSequence: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "reaction-b",
    sourceName: "ICDGroupReactionB",
    resetFrames: 30,
    damageSequence: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "burning",
    sourceName: "ICDGroupBurning",
    resetFrames: 120,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "aino-burst-moon-hit",
    sourceName: "ICDGroupAinoBurstMoonHit",
    resetFrames: 108,
    damageSequence: [1, 1, 1, 1]
  },
  {
    id: "alhaitham-extra-attack",
    sourceName: "ICDGroupAlhaithamExtraAttack",
    resetFrames: 120,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "alhaitham-projection-attack",
    sourceName: "ICDGroupAlhaithamProjectionAttack",
    resetFrames: 720,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "amber",
    sourceName: "ICDGroupAmber",
    resetFrames: 60,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "arlecchino-elemental-art",
    sourceName: "ICDGroupArlecchinoElementalArt",
    resetFrames: 600,
    damageSequence: [1, 1, 1, 1, 1]
  },
  {
    id: "ayaka-extra-attack",
    sourceName: "ICDGroupAyakaExtraAttack",
    resetFrames: 30,
    damageSequence: [
      1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0
    ]
  },
  {
    id: "baizhu-c2",
    sourceName: "ICDGroupBaizhuC2",
    resetFrames: 240,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "charlotte-kamera",
    sourceName: "ICDGroupCharlotteKamera",
    resetFrames: 240,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "charlotte-mark",
    sourceName: "ICDGroupCharlotteMark",
    resetFrames: 720,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "chasca-burst",
    sourceName: "ICDGroupChascaBurst",
    resetFrames: 90,
    damageSequence: [1, 1, 1, 1, 1, 1]
  },
  {
    id: "chasca-shadowhunt",
    sourceName: "ICDGroupChascaShadowhunt",
    resetFrames: 90,
    damageSequence: [1, 1]
  },
  {
    id: "chasca-shining",
    sourceName: "ICDGroupChascaShining",
    resetFrames: 90,
    damageSequence: [1, 1, 1, 1, 1, 1]
  },
  {
    id: "chasca-tap",
    sourceName: "ICDGroupChascaTap",
    resetFrames: 90,
    damageSequence: [1, 1]
  },
  {
    id: "chevreuse-burst-mines",
    sourceName: "ICDGroupChevreuseBurstMines",
    resetFrames: 180,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "chiori-skill",
    sourceName: "ICDGroupChioriSkill",
    resetFrames: 114,
    damageSequence: [1, 1, 1, 1, 1]
  },
  {
    id: "citlali-frostfall-storm",
    sourceName: "ICDGroupCitlaliFrostfallStorm",
    resetFrames: 90,
    damageSequence: [1, 1]
  },
  {
    id: "clorinde-elemental-art",
    sourceName: "ICDGroupClorindeElementalArt",
    resetFrames: 60,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "collei-burst",
    sourceName: "ICDGroupColleiBurst",
    resetFrames: 180,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "cyno-bolt",
    sourceName: "ICDGroupCynoBolt",
    resetFrames: 150,
    damageSequence: [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "diluc",
    sourceName: "ICDGroupDiluc",
    resetFrames: 300,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "dori-burst",
    sourceName: "ICDGroupDoriBurst",
    resetFrames: 180,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "durin-burst-black",
    sourceName: "ICDGroupDurinBurstBlack",
    resetFrames: 120,
    damageSequence: [1, 1]
  },
  {
    id: "durin-burst-white",
    sourceName: "ICDGroupDurinBurstWhite",
    resetFrames: 90,
    damageSequence: [1, 1]
  },
  {
    id: "durin-skill",
    sourceName: "ICDGroupDurinSkill",
    resetFrames: 18,
    damageSequence: [1, 1, 1]
  },
  {
    id: "emilie-lumidouce",
    sourceName: "ICDGroupEmilieLumidouce",
    resetFrames: 120,
    damageSequence: [1, 1]
  },
  {
    id: "escoffier-skill",
    sourceName: "ICDGroupEscoffierSkill",
    resetFrames: 90,
    damageSequence: [1, 1, 1, 1, 1]
  },
  {
    id: "fischl",
    sourceName: "ICDGroupFischl",
    resetFrames: 300,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "furina-salon-solitaire",
    sourceName: "ICDGroupFurinaSalonSolitaire",
    resetFrames: 1800,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "kinich-loop-shot",
    sourceName: "ICDGroupKinichLoopShot",
    resetFrames: 120,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "kinich-scalespiker-cannon",
    sourceName: "ICDGroupKinichScalespikerCannon",
    resetFrames: 72,
    damageSequence: [1, 1, 1, 1]
  },
  {
    id: "lanyan-ring-attack",
    sourceName: "ICDGroupLanyanRingAttack",
    resetFrames: 150,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "lanyan-ring-attack-mix",
    sourceName: "ICDGroupLanyanRingAttackMix",
    resetFrames: 150,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "layla",
    sourceName: "ICDGroupLayla",
    resetFrames: 180,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "lyney-extra",
    sourceName: "ICDGroupLyneyExtra",
    resetFrames: 60,
    damageSequence: [1, 1, 1, 1, 1, 1]
  },
  {
    id: "mizuki-skill",
    sourceName: "ICDGroupMizukiSkill",
    resetFrames: 72,
    damageSequence: [1, 1, 1, 1]
  },
  {
    id: "nahida-skill",
    sourceName: "ICDGroupNahidaSkill",
    resetFrames: 60,
    damageSequence: [
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1
    ]
  },
  {
    id: "navia-burst",
    sourceName: "ICDGroupNaviaBurst",
    resetFrames: 720,
    damageSequence: [
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1
    ]
  },
  {
    id: "nilou",
    sourceName: "ICDGroupNilou",
    resetFrames: 114,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "ororon-elemental-burst",
    sourceName: "ICDGroupOroronElementalBurst",
    resetFrames: 180,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "sigewinne",
    sourceName: "ICDGroupSigewinne",
    resetFrames: 120,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "sigewinne-burst",
    sourceName: "ICDGroupSigewinneBurst",
    resetFrames: 114,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "tighnari",
    sourceName: "ICDGroupTighnari",
    resetFrames: 150,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "traveler-burst",
    sourceName: "ICDGroupTravelerBurst",
    resetFrames: 480,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "traveler-dewdrop",
    sourceName: "ICDGroupTravelerDewdrop",
    resetFrames: 90,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "venti",
    sourceName: "ICDGroupVenti",
    resetFrames: 60,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "wanderer-a4",
    sourceName: "ICDGroupWandererA4",
    resetFrames: 60,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "wanderer-c6",
    sourceName: "ICDGroupWandererC6",
    resetFrames: 120,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "xiao-dash",
    sourceName: "ICDGroupXiaoDash",
    resetFrames: 6,
    damageSequence: [1, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "yae-charged",
    sourceName: "ICDGroupYaeCharged",
    resetFrames: 30,
    damageSequence: [1, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "yaoyao-radish-burst",
    sourceName: "ICDGroupYaoyaoRadishBurst",
    resetFrames: 90,
    damageSequence: [1, 1, 1, 1, 1, 1]
  },
  {
    id: "yaoyao-radish-skill",
    sourceName: "ICDGroupYaoyaoRadishSkill",
    resetFrames: 150,
    damageSequence: [1, 1, 1, 1, 1, 1]
  },
  {
    id: "yelan-breakthrough",
    sourceName: "ICDGroupYelanBreakthrough",
    resetFrames: 18,
    damageSequence: [1, 0, 0, 0]
  },
  {
    id: "yelan-burst",
    sourceName: "ICDGroupYelanBurst",
    resetFrames: 120,
    damageSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  }
] as const;

/**
 * Canonical immutable payload for damage-group reset and damage-sequence
 * behavior. It is provisional and does not claim official live-server truth
 * or complete gcsim parity.
 */
export const GCSIM_DAMAGE_GROUP_PROFILE = deepFreeze({
  version: DAMAGE_GROUP_PROFILE_VERSION,
  profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID,
  tailPolicy: GCSIM_DAMAGE_GROUP_TAIL_POLICY,
  resetSchedulePolicy: GCSIM_DAMAGE_GROUP_RESET_SCHEDULE_POLICY,
  provenance: {
    mechanicsDataStatus: MECHANICS_DATA_STATUS,
    sourceProject: SOURCE_PROJECT,
    sourceRevision: GCSIM_DAMAGE_GROUP_SOURCE_REVISION,
    officialServerTruth: false,
    completeGcsimParity: false,
    coverage: GCSIM_DAMAGE_GROUP_COVERAGE
  },
  groups: DAMAGE_GROUPS
} as const);

export type GcsimDamageGroupProfile = typeof GCSIM_DAMAGE_GROUP_PROFILE;
export type GcsimDamageGroup = GcsimDamageGroupProfile["groups"][number];
export type GcsimDamageGroupId = GcsimDamageGroup["id"];
export type GcsimDamageGroupSourceName = GcsimDamageGroup["sourceName"];

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

export function canonicalDamageGroupPayloadJson(): string {
  return canonicalJson(GCSIM_DAMAGE_GROUP_PROFILE, new Set());
}

// Literal is independently derived from canonicalDamageGroupPayloadJson().
export const GCSIM_DAMAGE_GROUP_CONTENT_SHA256 =
  "sha256:7e6d16a2a90ac7d9bb84daa80c43f09d28fb65e45319c62f67d14c50bb5e9c70" as const;

export const GCSIM_DAMAGE_GROUP_ROOT = deepFreeze({
  version: DAMAGE_GROUP_PROFILE_VERSION,
  profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID,
  contentHash: GCSIM_DAMAGE_GROUP_CONTENT_SHA256,
  mechanicsDataStatus: MECHANICS_DATA_STATUS,
  sourceProject: SOURCE_PROJECT,
  sourceRevision: GCSIM_DAMAGE_GROUP_SOURCE_REVISION,
  officialServerTruth: false,
  completeGcsimParity: false,
  coverage: GCSIM_DAMAGE_GROUP_COVERAGE,
  tailPolicy: GCSIM_DAMAGE_GROUP_TAIL_POLICY,
  resetSchedulePolicy: GCSIM_DAMAGE_GROUP_RESET_SCHEDULE_POLICY
} as const);

export type GcsimDamageGroupRoot = typeof GCSIM_DAMAGE_GROUP_ROOT;

const DAMAGE_GROUP_BY_ID: ReadonlyMap<string, GcsimDamageGroup> = new Map(
  GCSIM_DAMAGE_GROUP_PROFILE.groups.map((group) => [group.id, group])
);

export function resolveDamageGroup(groupId: string): GcsimDamageGroup {
  const group = DAMAGE_GROUP_BY_ID.get(groupId);
  if (group === undefined) {
    throw new RangeError(`unknown damage group: ${groupId}`);
  }
  return group;
}

export function resolveDamageGroupResetFrames(groupId: string): number {
  return resolveDamageGroup(groupId).resetFrames;
}

/**
 * Resolves a zero-based hit counter using gcsim's tail-clamp behavior: once
 * the counter exceeds the stored sequence, the last multiplier is reused.
 */
export function resolveDamageGroupMultiplier(
  groupId: string,
  hitCounter: number
): number {
  if (!Number.isSafeInteger(hitCounter) || hitCounter < 0) {
    throw new RangeError("hitCounter must be a non-negative safe integer");
  }
  const sequence = resolveDamageGroup(groupId).damageSequence;
  const index = Math.min(hitCounter, sequence.length - 1);
  return sequence[index]!;
}

/**
 * Computes the inclusive reset frame bound by the canonical schedule policy.
 * The current engine resets the damage-group window before evaluating an
 * ordinary direct-damage hit at resetAtFrame. This does not specify or model
 * elemental-application ICD.
 */
export function resolveDamageGroupResetAtFrame(
  groupId: string,
  windowStartFrame: number
): number {
  if (!Number.isSafeInteger(windowStartFrame) || windowStartFrame < 0) {
    throw new RangeError(
      "windowStartFrame must be a non-negative safe integer"
    );
  }
  const resetAtFrame =
    windowStartFrame + resolveDamageGroupResetFrames(groupId) - 1;
  if (!Number.isSafeInteger(resetAtFrame)) {
    throw new RangeError("resetAtFrame exceeds the safe integer range");
  }
  return resetAtFrame;
}
