import {
  GCSIM_DAMAGE_GROUP_ROOT,
  GCSIM_DAMAGE_GROUP_SOURCE_REVISION,
  resolveDamageGroup,
  type GcsimDamageGroupId,
} from "./profile";

export const REACTION_DAMAGE_GROUP_POLICY_V1_VERSION = "1.0.0" as const;
export const REACTION_DAMAGE_GROUP_POLICY_V2_VERSION = "2.0.0" as const;

export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID =
  "gcsim-b4ae769-reaction-damage-group-legacy-window-provisional-v1" as const;
export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID =
  "gcsim-b4ae769-reaction-damage-group-task-order-provisional-v2" as const;

export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_SOURCE_REVISION =
  "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541" as const;

export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_COVERAGE =
  "reaction-a-and-reaction-b-transformative-damage-reset-boundary-only" as const;

export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_MODE =
  "legacy-reaction-damage-group-window-v1" as const;
export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_MODE =
  "fixed-gcsim-reaction-damage-task-order-v2" as const;

export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_RESET_SCHEDULE_POLICY =
  "legacy-lazy-reset-before-attempt-at-window-start-plus-reset-frames" as const;
export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_RESET_SCHEDULE_POLICY =
  "scheduled-reset-task-at-window-start-plus-reset-frames-minus-one" as const;

export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_SAME_FRAME_ORDERING =
  "provisional-lazy-attempt-boundary-without-scheduler-provenance" as const;
export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_SAME_FRAME_ORDERING =
  "provisional-insertion-and-event-sequence-dependent" as const;

const MECHANICS_DATA_STATUS = "fixed-gcsim-provisional" as const;
const SOURCE_PROJECT = "genshinsim/gcsim" as const;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze((value as Record<PropertyKey, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

const DAMAGE_GROUP_ROOT_REF = {
  version: GCSIM_DAMAGE_GROUP_ROOT.version,
  profileId: GCSIM_DAMAGE_GROUP_ROOT.profileId,
  contentHash: GCSIM_DAMAGE_GROUP_ROOT.contentHash,
  sourceRevision: GCSIM_DAMAGE_GROUP_ROOT.sourceRevision,
  tailPolicy: GCSIM_DAMAGE_GROUP_ROOT.tailPolicy,
  resetSchedulePolicy: GCSIM_DAMAGE_GROUP_ROOT.resetSchedulePolicy,
} as const;

const REACTION_DAMAGE_GROUP_BINDINGS = [
  {
    reaction: "swirlPyro",
    damageElement: "pyro",
    attackTag: "AttackTagSwirlPyro",
    icdTag: "ICDTagSwirlPyro",
    groupId: "reaction-a",
    durability: 0,
    applicationDisposition: "none",
    damageSourceInScopeKey: false,
  },
  {
    reaction: "swirlHydro",
    damageElement: "hydro",
    attackTag: "AttackTagSwirlHydro",
    icdTag: "ICDTagSwirlHydro",
    groupId: "reaction-a",
    durability: 0,
    applicationDisposition: "none",
    damageSourceInScopeKey: false,
  },
  {
    reaction: "swirlCryo",
    damageElement: "cryo",
    attackTag: "AttackTagSwirlCryo",
    icdTag: "ICDTagSwirlCryo",
    groupId: "reaction-a",
    durability: 0,
    applicationDisposition: "none",
    damageSourceInScopeKey: false,
  },
  {
    reaction: "swirlElectro",
    damageElement: "electro",
    attackTag: "AttackTagSwirlElectro",
    icdTag: "ICDTagSwirlElectro",
    groupId: "reaction-a",
    durability: 0,
    applicationDisposition: "none",
    damageSourceInScopeKey: false,
  },
  {
    reaction: "shatter",
    damageElement: "physical",
    attackTag: "AttackTagShatter",
    icdTag: "ICDTagShatter",
    groupId: "reaction-a",
    durability: 0,
    applicationDisposition: "none",
    damageSourceInScopeKey: false,
  },
  {
    reaction: "superconduct",
    damageElement: "cryo",
    attackTag: "AttackTagSuperconductDamage",
    icdTag: "ICDTagSuperconductDamage",
    groupId: "reaction-a",
    durability: 0,
    applicationDisposition: "none",
    damageSourceInScopeKey: false,
  },
  {
    reaction: "bloom",
    damageElement: "dendro",
    attackTag: "AttackTagBloom",
    icdTag: "ICDTagBloomDamage",
    groupId: "reaction-a",
    durability: 0,
    applicationDisposition: "none",
    damageSourceInScopeKey: false,
  },
  {
    reaction: "burgeon",
    damageElement: "dendro",
    attackTag: "AttackTagBurgeon",
    icdTag: "ICDTagBurgeonDamage",
    groupId: "reaction-a",
    durability: 0,
    applicationDisposition: "none",
    damageSourceInScopeKey: false,
  },
  {
    reaction: "hyperbloom",
    damageElement: "dendro",
    attackTag: "AttackTagHyperbloom",
    icdTag: "ICDTagHyperbloomDamage",
    groupId: "reaction-a",
    durability: 0,
    applicationDisposition: "none",
    damageSourceInScopeKey: false,
  },
  {
    reaction: "overload",
    damageElement: "pyro",
    attackTag: "AttackTagOverloadDamage",
    icdTag: "ICDTagOverloadDamage",
    groupId: "reaction-b",
    durability: 0,
    applicationDisposition: "none",
    damageSourceInScopeKey: false,
  },
  {
    reaction: "electroCharged",
    damageElement: "electro",
    attackTag: "AttackTagECDamage",
    icdTag: "ICDTagECDamage",
    groupId: "reaction-b",
    durability: 0,
    applicationDisposition: "none",
    damageSourceInScopeKey: false,
  },
] as const satisfies readonly {
  reaction: string;
  damageElement: string;
  attackTag: string;
  icdTag: string;
  groupId: GcsimDamageGroupId;
  durability: 0;
  applicationDisposition: "none";
  damageSourceInScopeKey: false;
}[];

const COMMON_PROVENANCE = {
  mechanicsDataStatus: MECHANICS_DATA_STATUS,
  sourceProject: SOURCE_PROJECT,
  sourceRevision: GCSIM_REACTION_DAMAGE_GROUP_POLICY_SOURCE_REVISION,
  officialServerTruth: false,
  completeGcsimParity: false,
  coverage: GCSIM_REACTION_DAMAGE_GROUP_POLICY_COVERAGE,
  schedulerProvenance: "provisional-not-complete",
  provisional: true,
} as const;

/**
 * Frozen 1.49-and-earlier compatibility behavior.
 *
 * A 30-frame ReactionA/B window opened at F0 remains active through F29. The
 * first attempt at F30 lazily opens the next half-open window. No independent
 * reset task or scheduler ordering is represented by this policy.
 */
export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_PROFILE = deepFreeze({
  version: REACTION_DAMAGE_GROUP_POLICY_V1_VERSION,
  policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
  mode: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_MODE,
  damageGroupRootRef: DAMAGE_GROUP_ROOT_REF,
  scopeKeyFields: ["receivingTargetId", "sourceActorId", "icdTag"],
  damageSourceInScopeKey: false,
  resetBoundary: "lazy-attempt-window-check",
  resetSchedulePolicy:
    GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_RESET_SCHEDULE_POLICY,
  resetFrameOffsetAdjustment: 0,
  sameFrameOrdering: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_SAME_FRAME_ORDERING,
  boundaryExample: {
    windowStartFrame: 0,
    resetFrames: 30,
    resetFrame: 30,
    firstAttemptEligibleForNewWindowFrame: 30,
  },
  provisional: true,
  provenance: {
    ...COMMON_PROVENANCE,
    timingSource: "legacy-genshin-dps-lab-half-open-window",
  },
  bindings: REACTION_DAMAGE_GROUP_BINDINGS,
} as const);

/**
 * Pinned gcsim task-scheduling behavior at b4ae769.
 *
 * A 30-frame ReactionA/B window opened at F0 schedules its reset task for
 * F29 (`resetFrames - 1`). An attempt also scheduled for F29 is not
 * unconditionally before or after that reset: insertion order/eventSequence
 * decides which task executes first. This root therefore does not claim an
 * official same-frame ordering rule or complete gcsim scheduler parity.
 */
export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_PROFILE = deepFreeze({
  version: REACTION_DAMAGE_GROUP_POLICY_V2_VERSION,
  policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
  mode: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_MODE,
  damageGroupRootRef: DAMAGE_GROUP_ROOT_REF,
  scopeKeyFields: ["receivingTargetId", "sourceActorId", "icdTag"],
  damageSourceInScopeKey: false,
  resetBoundary: "scheduled-reset-task",
  resetSchedulePolicy:
    GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_RESET_SCHEDULE_POLICY,
  resetFrameOffsetAdjustment: -1,
  sameFrameOrdering: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_SAME_FRAME_ORDERING,
  boundaryExample: {
    windowStartFrame: 0,
    resetFrames: 30,
    resetTaskFrame: 29,
    sameFrameOutcome: "insertion-and-event-sequence-dependent",
  },
  provisional: true,
  provenance: {
    ...COMMON_PROVENANCE,
    timingSource: "pinned-gcsim-damage-group-reset-task",
  },
  bindings: REACTION_DAMAGE_GROUP_BINDINGS,
} as const);

export type GcsimReactionDamageGroupPolicyV1Profile =
  typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_PROFILE;
export type GcsimReactionDamageGroupPolicyV2Profile =
  typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_PROFILE;
export type GcsimReactionDamageGroupV1Binding =
  GcsimReactionDamageGroupPolicyV1Profile["bindings"][number];
export type GcsimReactionDamageGroupV2Binding =
  GcsimReactionDamageGroupPolicyV2Profile["bindings"][number];
export type GcsimReactionDamageGroupBinding = GcsimReactionDamageGroupV2Binding;
export type GcsimReactionDamageGroupReaction =
  GcsimReactionDamageGroupBinding["reaction"];
export type GcsimReactionDamageGroupPolicyId =
  | typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID
  | typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID;
export type GcsimReactionDamageGroupPolicyMode =
  | typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_MODE
  | typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_MODE;

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
      `canonical JSON does not allow values of type ${typeof value}`,
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
              "canonical JSON does not allow undefined array entries",
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

export function canonicalReactionDamageGroupPolicyV1PayloadJson(): string {
  return canonicalJson(
    GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_PROFILE,
    new Set(),
  );
}

export function canonicalReactionDamageGroupPolicyV2PayloadJson(): string {
  return canonicalJson(
    GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_PROFILE,
    new Set(),
  );
}

// Literals are independently derived from the canonical payload bytes.
export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_CONTENT_SHA256 =
  "sha256:db377845d06edaac61e92de5a9478117f2fdc79e55e920ad445a102cf9b9a3bd" as const;
export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_CONTENT_SHA256 =
  "sha256:026b9728156ddd124a2d85793b80d71a1d3f3baacec8376c8ac120bf68c17346" as const;

export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT = deepFreeze({
  version: REACTION_DAMAGE_GROUP_POLICY_V1_VERSION,
  policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
  mode: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_MODE,
  contentHash: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_CONTENT_SHA256,
  mechanicsDataStatus: MECHANICS_DATA_STATUS,
  sourceProject: SOURCE_PROJECT,
  sourceRevision: GCSIM_REACTION_DAMAGE_GROUP_POLICY_SOURCE_REVISION,
  damageGroupRootRef: DAMAGE_GROUP_ROOT_REF,
  officialServerTruth: false,
  completeGcsimParity: false,
  coverage: GCSIM_REACTION_DAMAGE_GROUP_POLICY_COVERAGE,
  scopeKeyFields: ["receivingTargetId", "sourceActorId", "icdTag"],
  damageSourceInScopeKey: false,
  resetBoundary: "lazy-attempt-window-check",
  resetSchedulePolicy:
    GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_RESET_SCHEDULE_POLICY,
  resetFrameOffsetAdjustment: 0,
  sameFrameOrdering: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_SAME_FRAME_ORDERING,
  schedulerProvenance: "provisional-not-complete",
  provisional: true,
} as const);

export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ROOT = deepFreeze({
  version: REACTION_DAMAGE_GROUP_POLICY_V2_VERSION,
  policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
  mode: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_MODE,
  contentHash: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_CONTENT_SHA256,
  mechanicsDataStatus: MECHANICS_DATA_STATUS,
  sourceProject: SOURCE_PROJECT,
  sourceRevision: GCSIM_REACTION_DAMAGE_GROUP_POLICY_SOURCE_REVISION,
  damageGroupRootRef: DAMAGE_GROUP_ROOT_REF,
  officialServerTruth: false,
  completeGcsimParity: false,
  coverage: GCSIM_REACTION_DAMAGE_GROUP_POLICY_COVERAGE,
  scopeKeyFields: ["receivingTargetId", "sourceActorId", "icdTag"],
  damageSourceInScopeKey: false,
  resetBoundary: "scheduled-reset-task",
  resetSchedulePolicy:
    GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_RESET_SCHEDULE_POLICY,
  resetFrameOffsetAdjustment: -1,
  sameFrameOrdering: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_SAME_FRAME_ORDERING,
  schedulerProvenance: "provisional-not-complete",
  provisional: true,
} as const);

export type GcsimReactionDamageGroupPolicyV1Root =
  typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT;
export type GcsimReactionDamageGroupPolicyV2Root =
  typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ROOT;

const BINDING_BY_REACTION: ReadonlyMap<
  string,
  GcsimReactionDamageGroupBinding
> = new Map(
  REACTION_DAMAGE_GROUP_BINDINGS.map((binding) => [binding.reaction, binding]),
);

function assertPolicyId(
  policyId: string,
): asserts policyId is GcsimReactionDamageGroupPolicyId {
  if (
    policyId !== GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID &&
    policyId !== GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID
  ) {
    throw new RangeError(`unknown reaction damage-group policy: ${policyId}`);
  }
}

function assertWindowStartFrame(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("windowStartFrame must be a finite number");
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      "windowStartFrame must be a non-negative safe integer",
    );
  }
}

export function resolveReactionDamageGroupPolicyRoot(
  policyId: typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
): GcsimReactionDamageGroupPolicyV1Root;
export function resolveReactionDamageGroupPolicyRoot(
  policyId: typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
): GcsimReactionDamageGroupPolicyV2Root;
export function resolveReactionDamageGroupPolicyRoot(
  policyId: GcsimReactionDamageGroupPolicyId,
): GcsimReactionDamageGroupPolicyV1Root | GcsimReactionDamageGroupPolicyV2Root;
export function resolveReactionDamageGroupPolicyRoot(
  policyId: string,
): GcsimReactionDamageGroupPolicyV1Root | GcsimReactionDamageGroupPolicyV2Root;
export function resolveReactionDamageGroupPolicyRoot(
  policyId: string,
): GcsimReactionDamageGroupPolicyV1Root | GcsimReactionDamageGroupPolicyV2Root {
  assertPolicyId(policyId);
  return policyId === GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID
    ? GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT
    : GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ROOT;
}

export function resolveReactionDamageGroupPolicyRootForMode(
  mode: typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_MODE,
): GcsimReactionDamageGroupPolicyV1Root;
export function resolveReactionDamageGroupPolicyRootForMode(
  mode: typeof GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_MODE,
): GcsimReactionDamageGroupPolicyV2Root;
export function resolveReactionDamageGroupPolicyRootForMode(
  mode: GcsimReactionDamageGroupPolicyMode,
): GcsimReactionDamageGroupPolicyV1Root | GcsimReactionDamageGroupPolicyV2Root;
export function resolveReactionDamageGroupPolicyRootForMode(
  mode: string,
): GcsimReactionDamageGroupPolicyV1Root | GcsimReactionDamageGroupPolicyV2Root;
export function resolveReactionDamageGroupPolicyRootForMode(
  mode: string,
): GcsimReactionDamageGroupPolicyV1Root | GcsimReactionDamageGroupPolicyV2Root {
  if (mode === GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_MODE) {
    return GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT;
  }
  if (mode === GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_MODE) {
    return GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ROOT;
  }
  throw new RangeError(`unknown reaction damage-group policy mode: ${mode}`);
}

export function resolveReactionDamageGroupBindingForPolicy(
  policyId: GcsimReactionDamageGroupPolicyId,
  reaction: GcsimReactionDamageGroupReaction,
): GcsimReactionDamageGroupBinding;
export function resolveReactionDamageGroupBindingForPolicy(
  policyId: string,
  reaction: string,
): GcsimReactionDamageGroupBinding;
export function resolveReactionDamageGroupBindingForPolicy(
  policyId: string,
  reaction: string,
): GcsimReactionDamageGroupBinding {
  assertPolicyId(policyId);
  const binding = BINDING_BY_REACTION.get(reaction);
  if (binding === undefined) {
    throw new RangeError(`unknown reaction damage-group binding: ${reaction}`);
  }
  return binding;
}

/**
 * Resolves the lazy boundary (V1) or scheduled reset-task frame (V2).
 *
 * For V2 this number alone does not determine a same-frame attempt result;
 * the reset task and attempt must still be ordered by insertion/eventSequence.
 */
export function resolveReactionDamageGroupResetFrame(
  policyId: GcsimReactionDamageGroupPolicyId,
  reaction: GcsimReactionDamageGroupReaction,
  windowStartFrame: number,
): number;
export function resolveReactionDamageGroupResetFrame(
  policyId: string,
  reaction: string,
  windowStartFrame: unknown,
): number;
export function resolveReactionDamageGroupResetFrame(
  policyId: string,
  reaction: string,
  windowStartFrame: unknown,
): number {
  const binding = resolveReactionDamageGroupBindingForPolicy(
    policyId,
    reaction,
  );
  assertWindowStartFrame(windowStartFrame);
  const root = resolveReactionDamageGroupPolicyRoot(policyId);
  const resetFrames = resolveDamageGroup(binding.groupId).resetFrames;
  const resetFrame =
    windowStartFrame + resetFrames + root.resetFrameOffsetAdjustment;
  if (!Number.isSafeInteger(resetFrame)) {
    throw new RangeError(
      "reaction damage-group reset frame exceeds safe range",
    );
  }
  return resetFrame;
}

export const REACTION_DAMAGE_GROUP_POLICY_VERSION =
  REACTION_DAMAGE_GROUP_POLICY_V2_VERSION;
export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID =
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID;
export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_MODE =
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_MODE;
export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_PROFILE =
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_PROFILE;
export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_CONTENT_SHA256 =
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_CONTENT_SHA256;
export const GCSIM_REACTION_DAMAGE_GROUP_POLICY_ROOT =
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ROOT;

export type GcsimReactionDamageGroupPolicyProfile =
  GcsimReactionDamageGroupPolicyV2Profile;
export type GcsimReactionDamageGroupPolicyRoot =
  GcsimReactionDamageGroupPolicyV2Root;

export function canonicalReactionDamageGroupPolicyPayloadJson(): string {
  return canonicalReactionDamageGroupPolicyV2PayloadJson();
}

export function resolveReactionDamageGroupBinding(
  reaction: GcsimReactionDamageGroupReaction,
): GcsimReactionDamageGroupBinding;
export function resolveReactionDamageGroupBinding(
  reaction: string,
): GcsimReactionDamageGroupBinding;
export function resolveReactionDamageGroupBinding(
  reaction: string,
): GcsimReactionDamageGroupBinding {
  return resolveReactionDamageGroupBindingForPolicy(
    GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID,
    reaction,
  );
}

if (
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_SOURCE_REVISION !==
    GCSIM_DAMAGE_GROUP_SOURCE_REVISION ||
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_SOURCE_REVISION !==
    GCSIM_DAMAGE_GROUP_ROOT.sourceRevision
) {
  throw new Error(
    "reaction damage-group policy and damage-group root revisions must match",
  );
}

for (const binding of REACTION_DAMAGE_GROUP_BINDINGS) {
  const group = resolveDamageGroup(binding.groupId);
  if (group.resetFrames !== 30) {
    throw new Error(
      `reaction damage-group binding ${binding.reaction} must resolve to a 30-frame group`,
    );
  }
}
