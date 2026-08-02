export const ELEMENTAL_APPLICATION_PROFILE_VERSION = "1.0.0" as const;

export const GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID =
  "gcsim-b4ae769-elemental-application-provisional-v1" as const;

export const GCSIM_ELEMENTAL_APPLICATION_SOURCE_REVISION =
  "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541" as const;

export const GCSIM_ELEMENTAL_APPLICATION_COVERAGE =
  "elemental-application-reset-and-numeric-sequences-only" as const;

export const GCSIM_ELEMENTAL_APPLICATION_TAIL_POLICY = "clamp-last" as const;

export const GCSIM_ELEMENTAL_APPLICATION_RESET_SCHEDULE_POLICY =
  "window-start-plus-reset-frames-minus-one" as const;

export const GCSIM_ELEMENTAL_APPLICATION_STATE_SCOPE =
  "per-target-source-character-and-icd-tag;group-selects-sequence-first-group-owns-reset-window" as const;

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
 * Fixed reset timers and numeric elemental-application multipliers.
 *
 * Source: genshinsim/gcsim at GCSIM_ELEMENTAL_APPLICATION_SOURCE_REVISION,
 * pkg/core/attacks/icd_groups.dm.go. The payload is an auditable pinned
 * reference, not a claim of official live-server truth or complete gcsim
 * parity. Numeric multipliers intentionally preserve Nahida Skill's 1.5
 * application value instead of reducing the table to booleans.
 */
const ELEMENTAL_APPLICATION_GROUPS = [
  {
    id: "default",
    sourceName: "ICDGroupDefault",
    resetFrames: 150,
    applicationSequence: [
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      0
    ]
  },
  {
    id: "pole-extra-attack",
    sourceName: "ICDGroupPoleExtraAttack",
    resetFrames: 30,
    applicationSequence: [
      1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0
    ]
  },
  {
    id: "reaction-a",
    sourceName: "ICDGroupReactionA",
    resetFrames: 30,
    applicationSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "reaction-b",
    sourceName: "ICDGroupReactionB",
    resetFrames: 30,
    applicationSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  {
    id: "burning",
    sourceName: "ICDGroupBurning",
    resetFrames: 120,
    applicationSequence: [1, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "aino-burst-moon-hit",
    sourceName: "ICDGroupAinoBurstMoonHit",
    resetFrames: 108,
    applicationSequence: [1, 0, 0, 0]
  },
  {
    id: "alhaitham-extra-attack",
    sourceName: "ICDGroupAlhaithamExtraAttack",
    resetFrames: 120,
    applicationSequence: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "alhaitham-projection-attack",
    sourceName: "ICDGroupAlhaithamProjectionAttack",
    resetFrames: 720,
    applicationSequence: [
      1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1,
      0
    ]
  },
  {
    id: "amber",
    sourceName: "ICDGroupAmber",
    resetFrames: 60,
    applicationSequence: [
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      0
    ]
  },
  {
    id: "arlecchino-elemental-art",
    sourceName: "ICDGroupArlecchinoElementalArt",
    resetFrames: 600,
    applicationSequence: [
      1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ]
  },
  {
    id: "ayaka-extra-attack",
    sourceName: "ICDGroupAyakaExtraAttack",
    resetFrames: 30,
    applicationSequence: [
      1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0
    ]
  },
  {
    id: "baizhu-c2",
    sourceName: "ICDGroupBaizhuC2",
    resetFrames: 240,
    applicationSequence: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "charlotte-kamera",
    sourceName: "ICDGroupCharlotteKamera",
    resetFrames: 240,
    applicationSequence: [1, 0, 0, 0, 1, 0, 0, 0]
  },
  {
    id: "charlotte-mark",
    sourceName: "ICDGroupCharlotteMark",
    resetFrames: 720,
    applicationSequence: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
  },
  {
    id: "chasca-burst",
    sourceName: "ICDGroupChascaBurst",
    resetFrames: 90,
    applicationSequence: [1, 0, 1, 0, 1, 0]
  },
  {
    id: "chasca-shadowhunt",
    sourceName: "ICDGroupChascaShadowhunt",
    resetFrames: 90,
    applicationSequence: [1, 0]
  },
  {
    id: "chasca-shining",
    sourceName: "ICDGroupChascaShining",
    resetFrames: 90,
    applicationSequence: [1, 0, 1, 0, 1, 0]
  },
  {
    id: "chasca-tap",
    sourceName: "ICDGroupChascaTap",
    resetFrames: 90,
    applicationSequence: [1, 0]
  },
  {
    id: "chevreuse-burst-mines",
    sourceName: "ICDGroupChevreuseBurstMines",
    resetFrames: 180,
    applicationSequence: [1, 0, 0, 1, 0, 0, 0, 0]
  },
  {
    id: "chiori-skill",
    sourceName: "ICDGroupChioriSkill",
    resetFrames: 114,
    applicationSequence: [1, 0, 0, 0, 0]
  },
  {
    id: "citlali-frostfall-storm",
    sourceName: "ICDGroupCitlaliFrostfallStorm",
    resetFrames: 90,
    applicationSequence: [1, 0]
  },
  {
    id: "clorinde-elemental-art",
    sourceName: "ICDGroupClorindeElementalArt",
    resetFrames: 60,
    applicationSequence: [
      1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0
    ]
  },
  {
    id: "collei-burst",
    sourceName: "ICDGroupColleiBurst",
    resetFrames: 180,
    applicationSequence: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "cyno-bolt",
    sourceName: "ICDGroupCynoBolt",
    resetFrames: 150,
    applicationSequence: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "diluc",
    sourceName: "ICDGroupDiluc",
    resetFrames: 300,
    applicationSequence: [
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0,
      0, 0, 1, 0, 0, 0, 0
    ]
  },
  {
    id: "dori-burst",
    sourceName: "ICDGroupDoriBurst",
    resetFrames: 180,
    applicationSequence: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "durin-burst-black",
    sourceName: "ICDGroupDurinBurstBlack",
    resetFrames: 120,
    applicationSequence: [1, 0]
  },
  {
    id: "durin-burst-white",
    sourceName: "ICDGroupDurinBurstWhite",
    resetFrames: 90,
    applicationSequence: [1, 0]
  },
  {
    id: "durin-skill",
    sourceName: "ICDGroupDurinSkill",
    resetFrames: 18,
    applicationSequence: [1, 0, 0]
  },
  {
    id: "emilie-lumidouce",
    sourceName: "ICDGroupEmilieLumidouce",
    resetFrames: 120,
    applicationSequence: [1, 0]
  },
  {
    id: "escoffier-skill",
    sourceName: "ICDGroupEscoffierSkill",
    resetFrames: 90,
    applicationSequence: [1, 0, 0, 0, 0, 0]
  },
  {
    id: "fischl",
    sourceName: "ICDGroupFischl",
    resetFrames: 300,
    applicationSequence: [
      1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0,
      0, 1, 0, 0, 0, 1, 0, 0, 0
    ]
  },
  {
    id: "furina-salon-solitaire",
    sourceName: "ICDGroupFurinaSalonSolitaire",
    resetFrames: 1800,
    applicationSequence: [
      1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1,
      0
    ]
  },
  {
    id: "kinich-loop-shot",
    sourceName: "ICDGroupKinichLoopShot",
    resetFrames: 120,
    applicationSequence: [1, 0, 0, 0]
  },
  {
    id: "kinich-scalespiker-cannon",
    sourceName: "ICDGroupKinichScalespikerCannon",
    resetFrames: 72,
    applicationSequence: [1, 0, 0, 0]
  },
  {
    id: "lanyan-ring-attack",
    sourceName: "ICDGroupLanyanRingAttack",
    resetFrames: 150,
    applicationSequence: [
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      0
    ]
  },
  {
    id: "lanyan-ring-attack-mix",
    sourceName: "ICDGroupLanyanRingAttackMix",
    resetFrames: 150,
    applicationSequence: [
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      0
    ]
  },
  {
    id: "layla",
    sourceName: "ICDGroupLayla",
    resetFrames: 180,
    applicationSequence: [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]
  },
  {
    id: "lyney-extra",
    sourceName: "ICDGroupLyneyExtra",
    resetFrames: 60,
    applicationSequence: [1, 0, 0, 0, 0, 0]
  },
  {
    id: "mizuki-skill",
    sourceName: "ICDGroupMizukiSkill",
    resetFrames: 72,
    applicationSequence: [1, 0, 0, 0]
  },
  {
    id: "nahida-skill",
    sourceName: "ICDGroupNahidaSkill",
    resetFrames: 60,
    applicationSequence: [1.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "navia-burst",
    sourceName: "ICDGroupNaviaBurst",
    resetFrames: 720,
    applicationSequence: [
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      0
    ]
  },
  {
    id: "nilou",
    sourceName: "ICDGroupNilou",
    resetFrames: 114,
    applicationSequence: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]
  },
  {
    id: "ororon-elemental-burst",
    sourceName: "ICDGroupOroronElementalBurst",
    resetFrames: 180,
    applicationSequence: [1, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "sigewinne",
    sourceName: "ICDGroupSigewinne",
    resetFrames: 120,
    applicationSequence: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "sigewinne-burst",
    sourceName: "ICDGroupSigewinneBurst",
    resetFrames: 114,
    applicationSequence: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "tighnari",
    sourceName: "ICDGroupTighnari",
    resetFrames: 150,
    applicationSequence: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]
  },
  {
    id: "traveler-burst",
    sourceName: "ICDGroupTravelerBurst",
    resetFrames: 480,
    applicationSequence: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]
  },
  {
    id: "traveler-dewdrop",
    sourceName: "ICDGroupTravelerDewdrop",
    resetFrames: 90,
    applicationSequence: [1, 0, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "venti",
    sourceName: "ICDGroupVenti",
    resetFrames: 60,
    applicationSequence: [
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      0
    ]
  },
  {
    id: "wanderer-a4",
    sourceName: "ICDGroupWandererA4",
    resetFrames: 60,
    applicationSequence: [
      1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ]
  },
  {
    id: "wanderer-c6",
    sourceName: "ICDGroupWandererC6",
    resetFrames: 120,
    applicationSequence: [
      1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ]
  },
  {
    id: "xiao-dash",
    sourceName: "ICDGroupXiaoDash",
    resetFrames: 6,
    applicationSequence: [1, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "yae-charged",
    sourceName: "ICDGroupYaeCharged",
    resetFrames: 30,
    applicationSequence: [1, 0, 0, 0, 0, 0, 0]
  },
  {
    id: "yaoyao-radish-burst",
    sourceName: "ICDGroupYaoyaoRadishBurst",
    resetFrames: 90,
    applicationSequence: [1, 0, 0, 0, 0, 0]
  },
  {
    id: "yaoyao-radish-skill",
    sourceName: "ICDGroupYaoyaoRadishSkill",
    resetFrames: 150,
    applicationSequence: [1, 0, 0, 0, 0, 0]
  },
  {
    id: "yelan-breakthrough",
    sourceName: "ICDGroupYelanBreakthrough",
    resetFrames: 18,
    applicationSequence: [1, 0, 0, 0]
  },
  {
    id: "yelan-burst",
    sourceName: "ICDGroupYelanBurst",
    resetFrames: 120,
    applicationSequence: [
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      0
    ]
  }
] as const;

/**
 * Canonical immutable payload for the fixed numeric elemental-application
 * sequence table. All 58 source groups remain present for auditability.
 */
export const GCSIM_ELEMENTAL_APPLICATION_PROFILE = deepFreeze({
  version: ELEMENTAL_APPLICATION_PROFILE_VERSION,
  profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  tailPolicy: GCSIM_ELEMENTAL_APPLICATION_TAIL_POLICY,
  resetSchedulePolicy: GCSIM_ELEMENTAL_APPLICATION_RESET_SCHEDULE_POLICY,
  stateScope: GCSIM_ELEMENTAL_APPLICATION_STATE_SCOPE,
  provisional: true,
  provenance: {
    mechanicsDataStatus: MECHANICS_DATA_STATUS,
    sourceProject: SOURCE_PROJECT,
    sourceRevision: GCSIM_ELEMENTAL_APPLICATION_SOURCE_REVISION,
    officialServerTruth: false,
    completeGcsimParity: false,
    coverage: GCSIM_ELEMENTAL_APPLICATION_COVERAGE,
    provisional: true
  },
  groups: ELEMENTAL_APPLICATION_GROUPS
} as const);

export type GcsimElementalApplicationProfile =
  typeof GCSIM_ELEMENTAL_APPLICATION_PROFILE;
export type GcsimElementalApplicationGroup =
  GcsimElementalApplicationProfile["groups"][number];
export type GcsimElementalApplicationGroupId =
  GcsimElementalApplicationGroup["id"];
export type GcsimElementalApplicationGroupSourceName =
  GcsimElementalApplicationGroup["sourceName"];

export const GCSIM_RESERVED_ELEMENTAL_APPLICATION_GROUP_IDS = deepFreeze([
  "reaction-a",
  "reaction-b",
  "burning"
] as const);

export type GcsimReservedElementalApplicationGroupId =
  (typeof GCSIM_RESERVED_ELEMENTAL_APPLICATION_GROUP_IDS)[number];

/**
 * Groups safe for public user configuration. Reaction A/B and Burning are
 * engine-owned delivery channels and therefore stay in the hashed reference
 * payload while being excluded from the configurable type surface.
 */
export type GcsimConfigurableElementalApplicationGroupId = Exclude<
  GcsimElementalApplicationGroupId,
  GcsimReservedElementalApplicationGroupId
>;

export type PublicGcsimElementalApplicationGroupId =
  GcsimConfigurableElementalApplicationGroupId;

export const GCSIM_CONFIGURABLE_ELEMENTAL_APPLICATION_GROUP_IDS: ReadonlyArray<GcsimConfigurableElementalApplicationGroupId> =
  deepFreeze(
    GCSIM_ELEMENTAL_APPLICATION_PROFILE.groups
      .map((group) => group.id)
      .filter(
        (groupId): groupId is GcsimConfigurableElementalApplicationGroupId =>
          !GCSIM_RESERVED_ELEMENTAL_APPLICATION_GROUP_IDS.includes(
            groupId as GcsimReservedElementalApplicationGroupId
          )
      )
  );

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

export function canonicalElementalApplicationPayloadJson(): string {
  return canonicalJson(GCSIM_ELEMENTAL_APPLICATION_PROFILE, new Set());
}

// Literal is independently derived from canonicalElementalApplicationPayloadJson().
export const GCSIM_ELEMENTAL_APPLICATION_CONTENT_SHA256 =
  "sha256:df461cf8aefee33ec57b8a8f83e2ec26497f17be8bc3ee1e6d667bf91d4015c1" as const;

export const GCSIM_ELEMENTAL_APPLICATION_ROOT = deepFreeze({
  version: ELEMENTAL_APPLICATION_PROFILE_VERSION,
  profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  contentHash: GCSIM_ELEMENTAL_APPLICATION_CONTENT_SHA256,
  mechanicsDataStatus: MECHANICS_DATA_STATUS,
  sourceProject: SOURCE_PROJECT,
  sourceRevision: GCSIM_ELEMENTAL_APPLICATION_SOURCE_REVISION,
  officialServerTruth: false,
  completeGcsimParity: false,
  coverage: GCSIM_ELEMENTAL_APPLICATION_COVERAGE,
  tailPolicy: GCSIM_ELEMENTAL_APPLICATION_TAIL_POLICY,
  resetSchedulePolicy: GCSIM_ELEMENTAL_APPLICATION_RESET_SCHEDULE_POLICY,
  stateScope: GCSIM_ELEMENTAL_APPLICATION_STATE_SCOPE,
  provisional: true
} as const);

export type GcsimElementalApplicationRoot =
  typeof GCSIM_ELEMENTAL_APPLICATION_ROOT;

const ELEMENTAL_APPLICATION_GROUP_BY_ID: ReadonlyMap<
  string,
  GcsimElementalApplicationGroup
> = new Map(
  GCSIM_ELEMENTAL_APPLICATION_PROFILE.groups.map((group) => [group.id, group])
);

export function resolveElementalApplicationGroup(
  groupId: string
): GcsimElementalApplicationGroup {
  const group = ELEMENTAL_APPLICATION_GROUP_BY_ID.get(groupId);
  if (group === undefined) {
    throw new RangeError(`unknown elemental-application group: ${groupId}`);
  }
  return group;
}

export function resolveElementalApplicationResetFrames(
  groupId: string
): number {
  return resolveElementalApplicationGroup(groupId).resetFrames;
}

/**
 * Resolves a zero-based application-attempt counter using the source table's
 * tail-clamp behavior. A zero multiplier blocks application; positive values
 * scale nominal gauge units.
 */
export function resolveElementalApplicationMultiplier(
  groupId: string,
  hitCounter: number
): number {
  if (!Number.isSafeInteger(hitCounter) || hitCounter < 0) {
    throw new RangeError("hitCounter must be a non-negative safe integer");
  }
  const sequence = resolveElementalApplicationGroup(
    groupId
  ).applicationSequence;
  const index = Math.min(hitCounter, sequence.length - 1);
  return sequence[index]!;
}

/** Computes the inclusive reset-frame bound used by the pinned source. */
export function resolveElementalApplicationResetAtFrame(
  groupId: string,
  windowStartFrame: number
): number {
  if (!Number.isSafeInteger(windowStartFrame) || windowStartFrame < 0) {
    throw new RangeError(
      "windowStartFrame must be a non-negative safe integer"
    );
  }
  const resetAtFrame =
    windowStartFrame + resolveElementalApplicationResetFrames(groupId) - 1;
  if (!Number.isSafeInteger(resetAtFrame)) {
    throw new RangeError("resetAtFrame exceeds the safe integer range");
  }
  return resetAtFrame;
}
