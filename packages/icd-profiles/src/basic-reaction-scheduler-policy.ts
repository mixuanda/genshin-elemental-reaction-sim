export const LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_VERSION =
  "1.0.0" as const;
export const GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_VERSION =
  "2.0.0" as const;

export const LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID =
  "legacy-partial-basic-reaction-scheduler-immediate-attachment-v1" as const;
export const GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID =
  "gcsim-b4ae769-basic-reaction-scheduler-provenance-provisional-v2" as const;

export const LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_MODE =
  "legacy-1.50-partial-immediate-reaction-owned-attachment" as const;
export const GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_MODE =
  "fixed-gcsim-normalized-provisional-scheduler-v2" as const;

export const LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_SOURCE_REVISION =
  "genshin-dps-lab-1.50.0-local-baseline" as const;
export const GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_SOURCE_REVISION =
  "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541" as const;

export const LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_COVERAGE =
  "legacy-1.50-partial-reaction-owned-attachment-scheduling-only" as const;
export const GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_COVERAGE =
  "burning-target-tick-cascade-and-swirl-follow-up-scheduling-only" as const;

export const LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_SAME_FRAME_ORDERING =
  "legacy-partial-immediate-attachment-without-complete-provenance" as const;
export const GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_SAME_FRAME_ORDERING =
  "same-priority-frame-and-global-insertion-event-sequence-fifo" as const;

const LEGACY_MECHANICS_DATA_STATUS = "legacy-project-partial" as const;
const GCSIM_MECHANICS_DATA_STATUS = "fixed-gcsim-provisional" as const;
const LEGACY_SOURCE_PROJECT = "genshin-dps-lab" as const;
const GCSIM_SOURCE_PROJECT = "genshinsim/gcsim" as const;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze((value as Record<PropertyKey, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

/**
 * Frozen local 1.50 compatibility policy.
 *
 * This root records the historical immediate reaction-owned attachment phase.
 * It deliberately has no pinned-gcsim provenance claim and does not specify a
 * complete cross-queue same-frame ordering model.
 */
export const LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_PROFILE = deepFreeze({
  version: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_VERSION,
  policyId: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
  scheduler: {
    mode: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_MODE,
    attackResolutionPhase: "legacy-immediate-reaction-damage-task",
    nonReactedAttachmentPhase: "immediate-within-attack-resolution",
    sameFrameOrdering:
      LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_SAME_FRAME_ORDERING,
    provenanceCompleteness: "partial",
  },
  scope: {
    includedReactions: ["burning", "swirl"],
    includedMechanics: [
      "legacy-reaction-owned-attachment-phase",
      "legacy-partial-same-frame-ordering",
    ],
    excludedMechanics: [
      "pinned-gcsim-scheduler-provenance",
      "deferred-zero-delay-non-reacted-attachment",
      "complete-cross-queue-task-ordering",
      "official-live-server-ordering",
      "reaction-damage-and-aura-formulas",
      "elemental-application-and-damage-group-sequences",
      "character-skill-tag-and-group-bindings",
      "lunar-reactions",
    ],
  },
  relationToReactionOwnedApplicationPolicy:
    "orthogonal-scheduler-selector-does-not-select-or-replace-application-icd-policy",
  provisional: true,
  provenance: {
    mechanicsDataStatus: LEGACY_MECHANICS_DATA_STATUS,
    sourceProject: LEGACY_SOURCE_PROJECT,
    sourceRevision:
      LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_SOURCE_REVISION,
    pinnedGcsimReference: false,
    officialServerTruth: false,
    completeGcsimParity: false,
    coverage: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_COVERAGE,
    provisional: true,
  },
} as const);

/**
 * Narrow normalized scheduler provenance pinned to gcsim b4ae769.
 *
 * Only the Burning and Swirl task facts listed below are in scope. The local
 * event heap normalizes same-priority tasks to `(frame, eventSequence)` FIFO;
 * that normalization and the monotonic Burning generation guard are explicit
 * project behavior, not claims of complete gcsim or live-server parity.
 */
export const GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_PROFILE = deepFreeze({
  version: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_VERSION,
  policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
  scheduler: {
    mode: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_MODE,
    orderingAuthority: "genshin-dps-lab-global-event-heap",
    taskPriorityPolicy: "preserve-existing-event-priority",
    samePriorityOrderingKey: ["frame", "globalInsertionEventSequence"],
    samePriorityOrdering: "fifo",
    sameFrameOrdering:
      GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_SAME_FRAME_ORDERING,
  },
  burning: {
    streamOwner: "receiving-enemy-target",
    tickIntervalFrames: 15,
    skippedTickSlot: 9,
    skippedTickSlotIndexing: "one-based",
    skippedTickDisposition: "advance-stream-without-enemy-aoe",
    tickAoe: {
      delayFrames: 0,
      radius: 1,
      targetSet: "registered-enemies-in-radius",
      fanoutOrder: "enemy-registration-order",
    },
    cascadeStream: {
      owner: "newly-burning-receiving-enemy-target",
      firstTickDelayFrames: 15,
      timingAnchor: "cascade-creating-aoe-application-frame",
    },
    generationGuard: {
      key: "monotonic-stream-generation",
      staleTaskDisposition: "drop-before-state-mutation",
      referenceDifference:
        "local-hardening-replaces-pinned-source-frame-identity-guard",
      verificationStatus: "intentional-provisional-deviation",
    },
  },
  swirl: {
    dispatchOrder: [
      "electro",
      "recursive-hydro-from-electro",
      "pyro",
      "hydro",
      "cryo",
      "frozen",
    ],
    attackResolutionPhase: "immediate-core-task",
    nonReactedAttachmentPhase: "deferred-zero-delay-core-task",
    sourceTargetHit: {
      delayFrames: 1,
    },
    propagationAoe: {
      delayFrames: 5,
      radius: 5,
      excludeSourceTarget: true,
    },
    queueGcd: {
      frames: 6,
      scopeKeyFields: ["receivingTargetId", "swirledElement"],
      disposition: "suppress-additional-queue-during-open-window",
    },
    hydroPropagation: {
      damageDisposition: "zero-damage",
      gaugeDisposition: "propagate-derived-gauge",
    },
  },
  scope: {
    includedReactions: ["burning", "swirl"],
    includedMechanics: [
      "burning-target-owned-tick-cadence-and-slot-nine-skip",
      "burning-zero-delay-radius-one-registration-order-fanout",
      "burning-cascade-stream-first-tick-delay",
      "burning-generation-safe-local-deviation",
      "swirl-dispatch-and-recursive-hydro-order",
      "swirl-source-and-propagation-task-delays",
      "swirl-per-target-per-element-queue-gcd",
      "swirl-radius-source-exclusion-and-hydro-zero-damage-propagation",
      "swirl-immediate-resolution-deferred-non-reacted-attachment",
      "same-priority-frame-global-insertion-event-sequence-fifo",
    ],
    excludedMechanics: [
      "official-live-server-ordering",
      "complete-gcsim-enemy-character-core-task-tier-parity",
      "non-burning-and-non-swirl-reactions",
      "aura-consumption-and-decay-formulas",
      "reaction-damage-formulas",
      "elemental-application-and-damage-group-reset-sequences",
      "spatial-geometry-beyond-pinned-radii-and-source-exclusion",
      "character-skill-tag-and-group-bindings",
      "lunar-reactions",
    ],
  },
  relationToReactionOwnedApplicationPolicy:
    "orthogonal-scheduler-selector-does-not-select-or-replace-application-icd-policy",
  provisional: true,
  provenance: {
    mechanicsDataStatus: GCSIM_MECHANICS_DATA_STATUS,
    sourceProject: GCSIM_SOURCE_PROJECT,
    sourceRevision: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_SOURCE_REVISION,
    sourceFiles: [
      "pkg/reactable/burning.go",
      "pkg/reactable/swirl.go",
      "pkg/enemy/hitlag.go",
      "pkg/enemy/attack.go",
      "pkg/core/attack.go",
      "pkg/core/combat/attack.go",
      "pkg/core/task/task.go",
      "pkg/target/target.go",
    ],
    normalization:
      "local-versioned-event-heap-projection-with-explicit-deviations",
    officialServerTruth: false,
    completeGcsimParity: false,
    coverage: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_COVERAGE,
    provisional: true,
  },
} as const);

export type LegacyBasicReactionSchedulerPolicyV1Profile =
  typeof LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_PROFILE;
export type GcsimBasicReactionSchedulerPolicyV2Profile =
  typeof GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_PROFILE;

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

export function canonicalLegacyBasicReactionSchedulerPolicyV1PayloadJson(): string {
  return canonicalJson(
    LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_PROFILE,
    new Set(),
  );
}

export function canonicalGcsimBasicReactionSchedulerPolicyV2PayloadJson(): string {
  return canonicalJson(
    GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_PROFILE,
    new Set(),
  );
}

// Literals are independently derived from the canonical policy payload bytes.
export const LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_CONTENT_SHA256 =
  "sha256:2acb593bd32d61e908558d3d8fe8ffa0c36facff0c9f414c411af6cdf0c00ec8" as const;
export const GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_CONTENT_SHA256 =
  "sha256:59b8f34401ceaf16ea65482c80e7f481629fceb5857900ed594c950db6954534" as const;

export const LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT = deepFreeze({
  version: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_VERSION,
  policyId: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
  mode: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_MODE,
  contentHash: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_CONTENT_SHA256,
  mechanicsDataStatus: LEGACY_MECHANICS_DATA_STATUS,
  sourceProject: LEGACY_SOURCE_PROJECT,
  sourceRevision: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_SOURCE_REVISION,
  pinnedGcsimReference: false,
  officialServerTruth: false,
  completeGcsimParity: false,
  coverage: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_COVERAGE,
  sameFrameOrdering:
    LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_SAME_FRAME_ORDERING,
  nonReactedAttachmentPhase:
    LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_PROFILE.scheduler
      .nonReactedAttachmentPhase,
  includedReactions:
    LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_PROFILE.scope.includedReactions,
  provisional: true,
} as const);

export const GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ROOT = deepFreeze({
  version: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_VERSION,
  policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
  mode: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_MODE,
  contentHash: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_CONTENT_SHA256,
  mechanicsDataStatus: GCSIM_MECHANICS_DATA_STATUS,
  sourceProject: GCSIM_SOURCE_PROJECT,
  sourceRevision: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_SOURCE_REVISION,
  pinnedGcsimReference: true,
  officialServerTruth: false,
  completeGcsimParity: false,
  coverage: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_COVERAGE,
  sameFrameOrdering:
    GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_SAME_FRAME_ORDERING,
  attackResolutionPhase:
    GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_PROFILE.swirl
      .attackResolutionPhase,
  nonReactedAttachmentPhase:
    GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_PROFILE.swirl
      .nonReactedAttachmentPhase,
  includedReactions:
    GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_PROFILE.scope.includedReactions,
  intentionalDeviations: ["burning-monotonic-generation-guard"],
  provisional: true,
} as const);

export type LegacyBasicReactionSchedulerPolicyV1Root =
  typeof LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT;
export type GcsimBasicReactionSchedulerPolicyV2Root =
  typeof GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ROOT;
export type BasicReactionSchedulerPolicyRoot =
  | LegacyBasicReactionSchedulerPolicyV1Root
  | GcsimBasicReactionSchedulerPolicyV2Root;
export type BasicReactionSchedulerPolicyId =
  | typeof LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID
  | typeof GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID;

export function resolveBasicReactionSchedulerPolicyRoot(
  policyId: typeof LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
): LegacyBasicReactionSchedulerPolicyV1Root;
export function resolveBasicReactionSchedulerPolicyRoot(
  policyId: typeof GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
): GcsimBasicReactionSchedulerPolicyV2Root;
export function resolveBasicReactionSchedulerPolicyRoot(
  policyId: BasicReactionSchedulerPolicyId,
): BasicReactionSchedulerPolicyRoot;
export function resolveBasicReactionSchedulerPolicyRoot(
  policyId: string,
): BasicReactionSchedulerPolicyRoot;
export function resolveBasicReactionSchedulerPolicyRoot(
  policyId: string,
): BasicReactionSchedulerPolicyRoot {
  if (policyId === LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID) {
    return LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT;
  }
  if (policyId === GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID) {
    return GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ROOT;
  }
  throw new RangeError(`unknown basic reaction scheduler policy: ${policyId}`);
}

export const BASIC_REACTION_SCHEDULER_POLICY_VERSION =
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_VERSION;
export const GCSIM_BASIC_REACTION_SCHEDULER_POLICY_ID =
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID;
export const GCSIM_BASIC_REACTION_SCHEDULER_POLICY_MODE =
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_MODE;
export const GCSIM_BASIC_REACTION_SCHEDULER_POLICY_SOURCE_REVISION =
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_SOURCE_REVISION;
export const GCSIM_BASIC_REACTION_SCHEDULER_POLICY_COVERAGE =
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_COVERAGE;
export const GCSIM_BASIC_REACTION_SCHEDULER_POLICY_SAME_FRAME_ORDERING =
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_SAME_FRAME_ORDERING;
export const GCSIM_BASIC_REACTION_SCHEDULER_POLICY_PROFILE =
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_PROFILE;
export const GCSIM_BASIC_REACTION_SCHEDULER_POLICY_CONTENT_SHA256 =
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_CONTENT_SHA256;
export const GCSIM_BASIC_REACTION_SCHEDULER_POLICY_ROOT =
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ROOT;

export type GcsimBasicReactionSchedulerPolicyProfile =
  GcsimBasicReactionSchedulerPolicyV2Profile;
export type GcsimBasicReactionSchedulerPolicyRoot =
  GcsimBasicReactionSchedulerPolicyV2Root;

export function canonicalBasicReactionSchedulerPolicyPayloadJson(): string {
  return canonicalGcsimBasicReactionSchedulerPolicyV2PayloadJson();
}
