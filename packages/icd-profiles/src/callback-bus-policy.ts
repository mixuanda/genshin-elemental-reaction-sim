export const LEGACY_CALLBACK_BUS_POLICY_V1_VERSION = "1.0.0" as const;
export const GCSIM_CALLBACK_BUS_POLICY_V2_VERSION = "2.0.0" as const;

export const LEGACY_CALLBACK_BUS_POLICY_V1_ID =
  "legacy-no-versioned-callback-bus-v1" as const;
export const GCSIM_CALLBACK_BUS_POLICY_V2_ID =
  "gcsim-b4ae769-versioned-callback-bus-normalized-provisional-v2" as const;

export const LEGACY_CALLBACK_BUS_POLICY_V1_MODE =
  "legacy-no-versioned-callback-bus-v1" as const;
export const GCSIM_CALLBACK_BUS_POLICY_V2_MODE =
  "fixed-gcsim-versioned-callback-bus-v2" as const;

export const LEGACY_CALLBACK_BUS_POLICY_V1_SOURCE_REVISION =
  "genshin-dps-lab-1.52.0-local-baseline" as const;
export const GCSIM_CALLBACK_BUS_POLICY_V2_SOURCE_REVISION =
  "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541" as const;

export const LEGACY_CALLBACK_BUS_POLICY_V1_COVERAGE =
  "legacy-absence-of-versioned-callback-dispatch-only" as const;
export const GCSIM_CALLBACK_BUS_POLICY_V2_COVERAGE =
  "freeze-broken-five-phase-callback-dispatch-and-subscriber-lifecycle-only" as const;

export const GCSIM_CALLBACK_BUS_EVENT_KINDS = [
  "on-aura-durability-depleted",
  "on-apply-attack",
  "on-enemy-hit",
  "on-enemy-damage",
  "attack-callback",
] as const;

/**
 * The normalized, auditable phase order for one eligible Freeze Broken
 * transition. A phase is recorded even when it has no active subscribers.
 */
export const GCSIM_CALLBACK_BUS_PHASE_ORDER = [
  {
    ordinal: 0,
    eventKind: "on-aura-durability-depleted",
    deliveryPhase: "same-call-stack-synchronous",
    relativeOrder: "before-on-apply-attack",
  },
  {
    ordinal: 1,
    eventKind: "on-apply-attack",
    deliveryPhase: "same-call-stack-synchronous",
    relativeOrder: "after-aura-depleted-before-on-enemy-hit",
  },
  {
    ordinal: 2,
    eventKind: "on-enemy-hit",
    deliveryPhase: "same-call-stack-synchronous",
    relativeOrder: "after-on-apply-attack-before-zero-delay-task",
  },
  {
    ordinal: 3,
    eventKind: "on-enemy-damage",
    deliveryPhase: "zero-delay-end-of-frame-task",
    relativeOrder: "before-attack-callback",
  },
  {
    ordinal: 4,
    eventKind: "attack-callback",
    deliveryPhase: "same-zero-delay-end-of-frame-task",
    relativeOrder: "after-on-enemy-damage",
  },
] as const satisfies readonly {
  ordinal: number;
  eventKind: (typeof GCSIM_CALLBACK_BUS_EVENT_KINDS)[number];
  deliveryPhase: string;
  relativeOrder: string;
}[];

const LEGACY_MECHANICS_DATA_STATUS = "legacy-project-absent" as const;
const GCSIM_MECHANICS_DATA_STATUS =
  "fixed-gcsim-normalized-provisional" as const;
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

/** Frozen 1.52-and-earlier compatibility behavior: no versioned callback bus. */
export const LEGACY_CALLBACK_BUS_POLICY_V1_PROFILE = deepFreeze({
  version: LEGACY_CALLBACK_BUS_POLICY_V1_VERSION,
  policyId: LEGACY_CALLBACK_BUS_POLICY_V1_ID,
  mode: LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
  implementationStatus: "absent",
  eventKinds: [],
  phaseOrder: [],
  dispatchDisposition: "none",
  subscriberLifecycleDisposition: "none",
  rngDisposition: "consume-none",
  damageEventDisposition: "emit-none",
  scope: {
    includedMechanics: ["legacy-absence-of-versioned-callback-bus"],
    excludedMechanics: [
      "pinned-gcsim-event-handler-provenance",
      "freeze-broken-five-phase-dispatch",
      "typed-callback-subscriber-lifecycle",
      "mona-bubble-effects",
      "enemy-impulse-and-general-physics",
      "official-live-server-callback-ordering",
      "complete-gcsim-event-and-task-parity",
    ],
  },
  provisional: true,
  provenance: {
    mechanicsDataStatus: LEGACY_MECHANICS_DATA_STATUS,
    sourceProject: LEGACY_SOURCE_PROJECT,
    sourceRevision: LEGACY_CALLBACK_BUS_POLICY_V1_SOURCE_REVISION,
    pinnedGcsimReference: false,
    officialServerTruth: false,
    completeGcsimParity: false,
    coverage: LEGACY_CALLBACK_BUS_POLICY_V1_COVERAGE,
    provisional: true,
  },
} as const);

/**
 * Narrow callback-bus policy pinned to gcsim b4ae769 and normalized for the
 * local deterministic simulator.
 *
 * The pinned source establishes event-handler slot behavior and the Freeze
 * Broken call chain. The local bus deliberately rejects mutation and nested
 * dispatch while a dispatch is active, consumes no RNG, and materializes no
 * DamageEvent. Those are explicit local rules, not gcsim or live-server claims.
 */
export const GCSIM_CALLBACK_BUS_POLICY_V2_PROFILE = deepFreeze({
  version: GCSIM_CALLBACK_BUS_POLICY_V2_VERSION,
  policyId: GCSIM_CALLBACK_BUS_POLICY_V2_ID,
  mode: GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
  mechanicsStatus: "partial",
  implementationStatus: "typed-deterministic-normalized-provisional",
  dispatchSurface: "freeze-broken-attack-only",
  eventKinds: GCSIM_CALLBACK_BUS_EVENT_KINDS,
  phaseOrder: GCSIM_CALLBACK_BUS_PHASE_ORDER,
  dispatchAudit: {
    cardinality: "five-phase-records-per-eligible-freeze-broken-transition",
    zeroSubscriberDisposition: "record-phase-with-zero-deliveries",
    deliveryOrdering: "active-slot-insertion-order",
    deliveryCardinality: "at-most-once-per-active-slot-per-phase",
  },
  subscriberLifecycle: {
    scopeKeyFields: ["eventKind", "subscriberKey"],
    registrationLogDisposition: "append-operation-log",
    firstSubscriptionDisposition: "append-new-active-slot-at-tail",
    duplicateKeyDisposition:
      "replace-handler-in-original-slot-without-reordering",
    unsubscribeDisposition: "set-handler-null-and-retain-slot-tombstone",
    resubscribeAfterUnsubscribeDisposition:
      "replace-tombstone-in-original-slot-without-reordering",
    unknownUnsubscribeDisposition: "no-op",
    mutationDuringDispatchDisposition: "reject",
    reentrantDispatchDisposition: "reject",
  },
  localNormalization: {
    callbackArgumentsDisposition: "readonly-typed-freeze-broken-context",
    subscriberReturnDisposition: "structured-audit-outcome-only",
    stateMutationAuthority: "none-in-callback-bus-v2",
    rngDisposition: "consume-none",
    damageEventDisposition: "emit-none",
    syntheticDamageDisposition: "emit-none",
    impulseDisposition:
      "record-no-impulse-field-without-enemy-physics-implementation",
  },
  referenceBehavior: {
    handlerOrdering: "event-local-slice-insertion-order",
    duplicateKeyDisposition:
      "replace-hook-in-original-slice-slot-without-reordering",
    unsubscribeDisposition: "set-hook-function-nil-without-compaction",
    emitDisposition: "synchronous-loop-over-current-event-hook-slice",
    freezeBrokenSequence: [
      "on-aura-durability-depleted",
      "on-apply-attack",
      "on-enemy-hit",
      "on-enemy-damage",
      "attack-callback",
    ],
    freezeBrokenTiming: {
      firstThreePhases: "same-call-stack-synchronous",
      onEnemyDamage: "zero-delay-end-of-frame-task",
      attackCallbacks: "same-task-after-on-enemy-damage",
    },
    freezeBrokenAttackCallbacksSupplied: false,
    freezeBrokenComputedDamage: 0,
    freezeBrokenCritRngDraws: 1,
  },
  scope: {
    includedMechanics: [
      "freeze-broken-five-phase-dispatch-audit",
      "zero-subscriber-phase-audit",
      "event-local-insertion-order-delivery",
      "duplicate-key-original-slot-replacement",
      "unsubscribe-slot-tombstone",
      "resubscribe-original-slot-replacement",
      "operation-log-subscriber-lifecycle",
      "mutation-during-dispatch-rejection",
      "reentrant-dispatch-rejection",
      "no-rng-no-damage-event-local-normalization",
    ],
    excludedMechanics: [
      "mona-bubble-status-and-pop-effects",
      "mona-omen-and-bubble-explosion",
      "mona-electro-charged-bubble-live-server-parity",
      "enemy-impulse-and-general-physics",
      "general-character-and-enemy-event-surface",
      "callback-authorized-simulator-state-mutation",
      "pinned-gcsim-reentrant-and-during-emit-mutation-behavior",
      "pinned-gcsim-freeze-broken-crit-rng-consumption",
      "synthetic-freeze-broken-damage-event",
      "official-live-server-callback-ordering",
      "complete-gcsim-event-task-attack-and-rng-parity",
      "ui-and-damage-event-rendering",
    ],
  },
  intentionalDeviations: [
    "reject-subscription-mutation-during-dispatch",
    "reject-reentrant-dispatch",
    "consume-no-freeze-broken-crit-rng",
    "emit-no-freeze-broken-damage-event",
    "audit-empty-attack-callback-phase",
    "expose-readonly-context-and-structured-outcomes-only",
  ],
  provisional: true,
  provenance: {
    mechanicsDataStatus: GCSIM_MECHANICS_DATA_STATUS,
    sourceProject: GCSIM_SOURCE_PROJECT,
    sourceRevision: GCSIM_CALLBACK_BUS_POLICY_V2_SOURCE_REVISION,
    sourceFiles: [
      "pkg/core/event/event.go",
      "pkg/reactable/freeze.go",
      "pkg/core/attack.go",
      "pkg/core/combat/attack.go",
      "pkg/enemy/attack.go",
      "internal/characters/mona/burst.go",
    ],
    normalization:
      "local-typed-freeze-broken-only-bus-with-no-rng-and-no-damage-event",
    officialServerTruth: false,
    completeGcsimParity: false,
    coverage: GCSIM_CALLBACK_BUS_POLICY_V2_COVERAGE,
    provisional: true,
  },
} as const);

export type LegacyCallbackBusPolicyV1Profile =
  typeof LEGACY_CALLBACK_BUS_POLICY_V1_PROFILE;
export type GcsimCallbackBusPolicyV2Profile =
  typeof GCSIM_CALLBACK_BUS_POLICY_V2_PROFILE;
export type GcsimCallbackBusEventKind =
  (typeof GCSIM_CALLBACK_BUS_EVENT_KINDS)[number];
export type GcsimCallbackBusPhase =
  (typeof GCSIM_CALLBACK_BUS_PHASE_ORDER)[number];

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

export function canonicalLegacyCallbackBusPolicyV1PayloadJson(): string {
  return canonicalJson(LEGACY_CALLBACK_BUS_POLICY_V1_PROFILE, new Set());
}

export function canonicalGcsimCallbackBusPolicyV2PayloadJson(): string {
  return canonicalJson(GCSIM_CALLBACK_BUS_POLICY_V2_PROFILE, new Set());
}

// Literals are independently derived from the canonical policy payload bytes.
export const LEGACY_CALLBACK_BUS_POLICY_V1_CONTENT_SHA256 =
  "sha256:2b4941332f75b605e86b3fd7bf2169e3455ed88fa9cf353f8a5d9f3104e691ce" as const;
export const GCSIM_CALLBACK_BUS_POLICY_V2_CONTENT_SHA256 =
  "sha256:e9a07c467716a1b5bf63859945262a3abc3c54ae7407f124d0a68cc7ec380696" as const;

export const LEGACY_CALLBACK_BUS_POLICY_V1_ROOT = deepFreeze({
  version: LEGACY_CALLBACK_BUS_POLICY_V1_VERSION,
  policyId: LEGACY_CALLBACK_BUS_POLICY_V1_ID,
  mode: LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
  contentHash: LEGACY_CALLBACK_BUS_POLICY_V1_CONTENT_SHA256,
  mechanicsDataStatus: LEGACY_MECHANICS_DATA_STATUS,
  sourceProject: LEGACY_SOURCE_PROJECT,
  sourceRevision: LEGACY_CALLBACK_BUS_POLICY_V1_SOURCE_REVISION,
  pinnedGcsimReference: false,
  implementationStatus: "absent",
  eventKinds: [],
  dispatchDisposition: "none",
  subscriberLifecycleDisposition: "none",
  rngDisposition: "consume-none",
  damageEventDisposition: "emit-none",
  officialServerTruth: false,
  completeGcsimParity: false,
  coverage: LEGACY_CALLBACK_BUS_POLICY_V1_COVERAGE,
  provisional: true,
} as const);

export const GCSIM_CALLBACK_BUS_POLICY_V2_ROOT = deepFreeze({
  version: GCSIM_CALLBACK_BUS_POLICY_V2_VERSION,
  policyId: GCSIM_CALLBACK_BUS_POLICY_V2_ID,
  mode: GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
  contentHash: GCSIM_CALLBACK_BUS_POLICY_V2_CONTENT_SHA256,
  mechanicsDataStatus: GCSIM_MECHANICS_DATA_STATUS,
  sourceProject: GCSIM_SOURCE_PROJECT,
  sourceRevision: GCSIM_CALLBACK_BUS_POLICY_V2_SOURCE_REVISION,
  pinnedGcsimReference: true,
  mechanicsStatus: "partial",
  implementationStatus: "typed-deterministic-normalized-provisional",
  dispatchSurface: "freeze-broken-attack-only",
  eventKinds: GCSIM_CALLBACK_BUS_EVENT_KINDS,
  phaseOrder: GCSIM_CALLBACK_BUS_PHASE_ORDER,
  deliveryOrdering: "active-slot-insertion-order",
  duplicateKeyDisposition:
    "replace-handler-in-original-slot-without-reordering",
  unsubscribeDisposition: "set-handler-null-and-retain-slot-tombstone",
  mutationDuringDispatchDisposition: "reject",
  reentrantDispatchDisposition: "reject",
  rngDisposition: "consume-none",
  damageEventDisposition: "emit-none",
  intentionalDeviations:
    GCSIM_CALLBACK_BUS_POLICY_V2_PROFILE.intentionalDeviations,
  officialServerTruth: false,
  completeGcsimParity: false,
  coverage: GCSIM_CALLBACK_BUS_POLICY_V2_COVERAGE,
  provisional: true,
} as const);

export type LegacyCallbackBusPolicyV1Root =
  typeof LEGACY_CALLBACK_BUS_POLICY_V1_ROOT;
export type GcsimCallbackBusPolicyV2Root =
  typeof GCSIM_CALLBACK_BUS_POLICY_V2_ROOT;
export type CallbackBusPolicyRoot =
  | LegacyCallbackBusPolicyV1Root
  | GcsimCallbackBusPolicyV2Root;
export type CallbackBusPolicyId =
  | typeof LEGACY_CALLBACK_BUS_POLICY_V1_ID
  | typeof GCSIM_CALLBACK_BUS_POLICY_V2_ID;

export function resolveCallbackBusPolicyRoot(
  policyId: typeof LEGACY_CALLBACK_BUS_POLICY_V1_ID,
): LegacyCallbackBusPolicyV1Root;
export function resolveCallbackBusPolicyRoot(
  policyId: typeof GCSIM_CALLBACK_BUS_POLICY_V2_ID,
): GcsimCallbackBusPolicyV2Root;
export function resolveCallbackBusPolicyRoot(
  policyId: CallbackBusPolicyId,
): CallbackBusPolicyRoot;
export function resolveCallbackBusPolicyRoot(
  policyId: string,
): CallbackBusPolicyRoot;
export function resolveCallbackBusPolicyRoot(
  policyId: string,
): CallbackBusPolicyRoot {
  if (policyId === LEGACY_CALLBACK_BUS_POLICY_V1_ID) {
    return LEGACY_CALLBACK_BUS_POLICY_V1_ROOT;
  }
  if (policyId === GCSIM_CALLBACK_BUS_POLICY_V2_ID) {
    return GCSIM_CALLBACK_BUS_POLICY_V2_ROOT;
  }
  throw new RangeError(`unknown callback bus policy: ${policyId}`);
}

export const CALLBACK_BUS_POLICY_VERSION =
  GCSIM_CALLBACK_BUS_POLICY_V2_VERSION;
export const GCSIM_CALLBACK_BUS_POLICY_ID = GCSIM_CALLBACK_BUS_POLICY_V2_ID;
export const GCSIM_CALLBACK_BUS_POLICY_MODE =
  GCSIM_CALLBACK_BUS_POLICY_V2_MODE;
export const GCSIM_CALLBACK_BUS_POLICY_SOURCE_REVISION =
  GCSIM_CALLBACK_BUS_POLICY_V2_SOURCE_REVISION;
export const GCSIM_CALLBACK_BUS_POLICY_COVERAGE =
  GCSIM_CALLBACK_BUS_POLICY_V2_COVERAGE;
export const GCSIM_CALLBACK_BUS_POLICY_PROFILE =
  GCSIM_CALLBACK_BUS_POLICY_V2_PROFILE;
export const GCSIM_CALLBACK_BUS_POLICY_CONTENT_SHA256 =
  GCSIM_CALLBACK_BUS_POLICY_V2_CONTENT_SHA256;
export const GCSIM_CALLBACK_BUS_POLICY_ROOT =
  GCSIM_CALLBACK_BUS_POLICY_V2_ROOT;

export type GcsimCallbackBusPolicyProfile = GcsimCallbackBusPolicyV2Profile;
export type GcsimCallbackBusPolicyRoot = GcsimCallbackBusPolicyV2Root;

export function canonicalCallbackBusPolicyPayloadJson(): string {
  return canonicalGcsimCallbackBusPolicyV2PayloadJson();
}
