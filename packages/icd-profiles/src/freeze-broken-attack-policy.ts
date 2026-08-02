export const LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_VERSION =
  "1.0.0" as const;
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_VERSION = "2.0.0" as const;
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_VERSION = "3.0.0" as const;

export const LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID =
  "legacy-no-freeze-broken-attack-callback-v1" as const;
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID =
  "gcsim-b4ae769-freeze-broken-attack-normalized-provisional-v2" as const;
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID =
  "gcsim-b4ae769-freeze-broken-callback-dispatch-provisional-v3" as const;

export const LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE =
  "legacy-no-freeze-broken-attack-callback" as const;
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE =
  "fixed-gcsim-freeze-broken-attack-normalized-v2" as const;
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE =
  "fixed-gcsim-freeze-broken-callback-dispatch-v3" as const;

export const LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_SOURCE_REVISION =
  "genshin-dps-lab-1.51.0-local-baseline" as const;
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_SOURCE_REVISION =
  "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541" as const;
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_SOURCE_REVISION =
  "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541" as const;

export const LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_COVERAGE =
  "legacy-no-freeze-broken-callback-only" as const;
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_COVERAGE =
  "freeze-depletion-callback-trigger-sources-and-local-normalization-only" as const;
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_COVERAGE =
  "freeze-depletion-callback-bus-dispatch-and-local-normalization-only" as const;

export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_REQUIRED_CALLBACK_BUS_POLICY_ID =
  "gcsim-b4ae769-versioned-callback-bus-normalized-provisional-v2" as const;

export const GCSIM_FREEZE_BROKEN_ATTACK_TRIGGER_SOURCES = [
  "natural-decay",
  "poise",
  "shatter",
  "swirl-frozen",
  "crystallize-frozen",
] as const;

export const GCSIM_FREEZE_BROKEN_ATTACK_EXCLUDED_REACTION_SOURCES = [
  "melt",
  "superconduct",
] as const;

const LEGACY_MECHANICS_DATA_STATUS = "legacy-project-absent" as const;
const GCSIM_MECHANICS_DATA_STATUS = "fixed-gcsim-normalized-provisional" as const;
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

/** Frozen V1.51 compatibility behavior: no Freeze Broken callback exists. */
export const LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_PROFILE = deepFreeze({
  version: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_VERSION,
  policyId: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
  mode: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
  callbackDisposition: "none",
  triggerSources: [],
  observableEvents: [],
  damageEventDisposition: "none",
  scope: {
    includedMechanics: ["legacy-absence-of-freeze-broken-callback"],
    excludedMechanics: [
      "pinned-gcsim-freeze-broken-provenance",
      "freeze-depletion-callback",
      "mona-bubble-impulse-proxy",
      "official-live-server-freeze-break-semantics",
      "complete-gcsim-freeze-and-task-parity",
    ],
  },
  provisional: true,
  provenance: {
    mechanicsDataStatus: LEGACY_MECHANICS_DATA_STATUS,
    sourceProject: LEGACY_SOURCE_PROJECT,
    sourceRevision: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_SOURCE_REVISION,
    pinnedGcsimReference: false,
    officialServerTruth: false,
    completeGcsimParity: false,
    coverage: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_COVERAGE,
    provisional: true,
  },
} as const);

/**
 * Narrow provenance root for the synthetic `Freeze Broken` attack in gcsim
 * b4ae769, followed by explicit local normalization.
 *
 * The reference behavior is retained as audit evidence. `localNormalization`
 * records the planned exactly-once, non-damage callback contract; its explicit
 * execution status prevents consumers from treating that callback as shipped.
 */
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE = deepFreeze({
  version: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_VERSION,
  policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
  mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  mechanicsStatus: "partial",
  callbackSurface:
    "audit-only-until-callback-bus-bubble-and-impulse-implementation",
  callbackDisposition: "reference-audit-only-not-dispatched",
  triggerSources: GCSIM_FREEZE_BROKEN_ATTACK_TRIGGER_SOURCES,
  excludedReactionSources:
    GCSIM_FREEZE_BROKEN_ATTACK_EXCLUDED_REACTION_SOURCES,
  referenceBehavior: {
    depletionThreshold: 0.00000000001,
    depletionComparator: "less-than-or-equal",
    auraDepletedEvent: {
      element: "frozen",
      phase: "before-synthetic-apply-attack",
    },
    syntheticAttack: {
      actorIndex: 0,
      damageSource: "receiving-target",
      ability: "Freeze Broken",
      attackTag: "AttackTagNone",
      icdTag: "ICDTagNone",
      icdGroup: "ICDGroupDefault",
      strikeType: "StrikeTypeDefault",
      element: "NoElement",
      durability: 0,
      noImpulse: false,
      multiplier: 0,
      flatDamage: 0,
      sourceIsSim: true,
      doNotLog: true,
      snapshotDelayFrames: -1,
      damageDelayFrames: 0,
      targeting: "single-target",
      snapshotDisposition: "none",
      applyAttackPhase: "same-call-stack-immediate",
      enemyDamagePhase: "zero-delay-core-task",
      computedDamage: 0,
    },
    observableSequence: [
      "on-aura-durability-depleted-frozen",
      "on-apply-attack-freeze-broken",
      "on-enemy-hit-freeze-broken",
      "damage-log-freeze-broken",
      "on-enemy-damage-freeze-broken-zero",
    ],
    fieldConsumption: {
      sourceIsSim:
        "bypass-damage-group-multiplier-and-character-attack-mods-only",
      doNotLog: "assigned-true-but-never-read-dead-field",
      noImpulse:
        "false-on-synthetic-and-consumed-only-as-mona-bubble-impulse-proxy",
    },
    sideEffects: {
      critRngDraws: 1,
      globalEventSubscribersRun: true,
      attackCallbacks: "none-supplied",
      totalDamageDelta: 0,
    },
    zeroDurabilityBoundary: {
      exactThresholdBluntSyntheticAttackCount: 2,
      cause:
        "poise-and-shatter-entry-use-strict-less-than-while-check-uses-less-than-or-equal",
      transitionGuard: "absent",
      verificationStatus: "reproduced-at-pinned-revision",
    },
  },
  localNormalization: {
    executionStatus: "reference-audit-only-not-dispatched",
    auditDisposition: "reference-audit-only-not-dispatched",
    depletionThreshold: 0.0000000001,
    depletionComparator: "positive-to-less-than-or-equal",
    callbackSurface:
      "audit-only-until-callback-bus-bubble-and-impulse-implementation",
    plannedCallbackCardinality:
      "exactly-once-per-positive-to-depleted-transition",
    exactThresholdDuplicateDisposition: "collapse-to-one",
    plannedCallbackPhase: "same-frame-after-frozen-aura-depleted",
    plannedOutputKind: "freeze-broken-audit-callback",
    rngDisposition: "consume-none",
    damageEventDisposition: "emit-none",
    damageLogDisposition: "emit-none",
    syntheticAttackDisposition: "do-not-materialize-as-damage-attack",
    impulseDisposition:
      "record-normalized-freeze-break-cause-without-general-physics-claim",
  },
  scope: {
    includedMechanics: [
      "natural-frozen-decay-depletion-trigger",
      "poise-depletion-trigger",
      "shatter-depletion-trigger",
      "swirl-frozen-depletion-trigger",
      "crystallize-frozen-depletion-trigger",
      "pinned-synthetic-attack-observability",
      "pinned-zero-durability-duplicate-boundary",
      "planned-local-exactly-once-no-rng-no-damage-event-normalization",
    ],
    excludedMechanics: [
      "melt-as-freeze-broken-trigger",
      "superconduct-as-freeze-broken-trigger",
      "official-live-server-freeze-break-semantics",
      "complete-gcsim-freeze-aura-task-and-impulse-parity",
      "general-enemy-physics-and-impulse-system",
      "mona-bubble-electro-charged-live-server-parity",
      "callback-subscriber-side-effects",
      "mona-bubble-and-impulse-bus",
      "damage-formulas-and-character-attack-modifiers",
      "ui-and-damage-event-rendering",
    ],
  },
  provisional: true,
  provenance: {
    mechanicsDataStatus: GCSIM_MECHANICS_DATA_STATUS,
    sourceProject: GCSIM_SOURCE_PROJECT,
    sourceRevision: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_SOURCE_REVISION,
    sourceFiles: [
      "pkg/reactable/freeze.go",
      "pkg/reactable/reactable.go",
      "pkg/reactable/swirl.go",
      "pkg/reactable/crystallize.go",
      "pkg/core/attack.go",
      "pkg/core/combat/attack.go",
      "pkg/core/task/task.go",
      "pkg/enemy/attack.go",
      "pkg/enemy/damage.go",
      "internal/characters/mona/burst.go",
    ],
    normalization:
      "planned-local-exactly-once-non-damage-callback-without-rng-consumption",
    mechanicsImplementationStatus: "partial",
    officialServerTruth: false,
    completeGcsimParity: false,
    coverage: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_COVERAGE,
    provisional: true,
  },
} as const);

/**
 * V3 executes the locally normalized Freeze Broken observability sequence
 * through the versioned callback bus. It deliberately remains narrower than
 * gcsim: the bus phases are auditable, but there is no synthetic damage hit,
 * RNG draw, enemy physics, or Mona bubble/impulse side effect.
 */
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_PROFILE = deepFreeze({
  ...GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE,
  version: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_VERSION,
  policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID,
  mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE,
  mechanicsStatus: "partial",
  callbackSurface: "versioned-callback-bus-dispatch-audit",
  callbackDisposition: "callback-bus-dispatched-normalized",
  requiredCallbackBusPolicyId:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_REQUIRED_CALLBACK_BUS_POLICY_ID,
  localNormalization: {
    executionStatus: "callback-bus-dispatched-normalized",
    auditDisposition: "structured-callback-bus-dispatch-log",
    depletionThreshold: 0.0000000001,
    depletionComparator: "positive-to-less-than-or-equal",
    positiveTransitionGuard: "required",
    callbackSurface: "versioned-callback-bus-dispatch-audit",
    terminalSources: GCSIM_FREEZE_BROKEN_ATTACK_TRIGGER_SOURCES,
    terminalSourceCount: 5,
    callbackCardinality:
      "exactly-once-per-positive-to-depleted-transition",
    exactThresholdDuplicateDisposition: "collapse-to-one",
    dispatchSequence: [
      "on-aura-durability-depleted-frozen",
      "on-apply-attack-freeze-broken",
      "on-enemy-hit-freeze-broken",
      "on-enemy-damage-freeze-broken-zero",
      "attack-callback-freeze-broken",
    ],
    dispatchPhases: {
      auraDurabilityDepleted: "same-call-stack-synchronous",
      applyAttack:
        "same-call-stack-synchronous-after-aura-durability-depleted",
      enemyHit: "same-call-stack-synchronous-after-apply-attack",
      enemyDamage: "zero-delay-end-of-frame",
      attackCallback: "zero-delay-end-of-frame-after-enemy-damage",
    },
    attackCallbackDisposition:
      "audit-dispatch-phase-without-local-attack-callback-side-effects",
    rngDisposition: "consume-none",
    damageEventDisposition: "emit-none",
    damageLogDisposition: "emit-none",
    hitResolutionDisposition: "emit-none",
    syntheticAttackDisposition: "do-not-materialize-as-damage-attack",
    physicsDisposition: "not-modeled",
    impulseDisposition: "not-modeled",
    monaBubbleDisposition: "excluded",
  },
  scope: {
    includedMechanics: [
      "natural-frozen-decay-depletion-trigger",
      "poise-depletion-trigger",
      "shatter-depletion-trigger",
      "swirl-frozen-depletion-trigger",
      "crystallize-frozen-depletion-trigger",
      "positive-to-depleted-transition-guard",
      "exactly-once-freeze-broken-callback-dispatch",
      "synchronous-aura-depleted-apply-attack-enemy-hit-dispatch",
      "zero-delay-end-of-frame-enemy-damage-attack-callback-audit-dispatch",
      "structured-callback-bus-dispatch-audit",
      "local-no-rng-no-damage-event-no-hit-resolution-normalization",
    ],
    excludedMechanics: [
      "melt-as-freeze-broken-trigger",
      "superconduct-as-freeze-broken-trigger",
      "official-live-server-freeze-break-semantics",
      "complete-gcsim-freeze-aura-task-and-impulse-parity",
      "general-enemy-physics-and-impulse-system",
      "mona-bubble-electro-charged-live-server-parity",
      "callback-subscriber-side-effects",
      "mona-bubble-and-impulse-bus",
      "synthetic-freeze-broken-damage-event",
      "synthetic-freeze-broken-hit-resolution",
      "synthetic-freeze-broken-crit-rng-draw",
      "damage-formulas-and-character-attack-modifiers",
      "ui-and-damage-event-rendering",
    ],
  },
  provisional: true,
  provenance: {
    mechanicsDataStatus: GCSIM_MECHANICS_DATA_STATUS,
    sourceProject: GCSIM_SOURCE_PROJECT,
    sourceRevision: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_SOURCE_REVISION,
    sourceFiles:
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE.provenance.sourceFiles,
    normalization:
      "callback-bus-dispatched-exactly-once-non-damage-without-rng-or-physics",
    mechanicsImplementationStatus: "partial",
    officialServerTruth: false,
    completeGcsimParity: false,
    coverage: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_COVERAGE,
    provisional: true,
  },
} as const);

export type LegacyFreezeBrokenAttackPolicyV1Profile =
  typeof LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_PROFILE;
export type GcsimFreezeBrokenAttackPolicyV2Profile =
  typeof GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE;
export type GcsimFreezeBrokenAttackPolicyV3Profile =
  typeof GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_PROFILE;
export type GcsimFreezeBrokenAttackTriggerSource =
  (typeof GCSIM_FREEZE_BROKEN_ATTACK_TRIGGER_SOURCES)[number];
export type GcsimFreezeBrokenAttackExcludedReactionSource =
  (typeof GCSIM_FREEZE_BROKEN_ATTACK_EXCLUDED_REACTION_SOURCES)[number];

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

export function canonicalLegacyFreezeBrokenAttackPolicyV1PayloadJson(): string {
  return canonicalJson(
    LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_PROFILE,
    new Set(),
  );
}

export function canonicalGcsimFreezeBrokenAttackPolicyV2PayloadJson(): string {
  return canonicalJson(
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE,
    new Set(),
  );
}

export function canonicalGcsimFreezeBrokenAttackPolicyV3PayloadJson(): string {
  return canonicalJson(
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_PROFILE,
    new Set(),
  );
}

// Literals are independently derived from the canonical policy payload bytes.
export const LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_CONTENT_SHA256 =
  "sha256:2831fac7a15189b772db58c245ffd8091b1128b5fd5ea516885f03a99961c838" as const;
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_CONTENT_SHA256 =
  "sha256:71646812a4061c9ef2d4ae8ca7cef1abaa79d718c8831ffaf5e3f27832955e14" as const;
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_CONTENT_SHA256 =
  "sha256:7c6b09c56e2e70fcdee5907045cdd29e1c81474c700c0685c6b3684a34eb298b" as const;

export const LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT = deepFreeze({
  version: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_VERSION,
  policyId: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
  mode: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
  contentHash: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_CONTENT_SHA256,
  mechanicsDataStatus: LEGACY_MECHANICS_DATA_STATUS,
  sourceProject: LEGACY_SOURCE_PROJECT,
  sourceRevision: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_SOURCE_REVISION,
  pinnedGcsimReference: false,
  callbackDisposition: "none",
  triggerSources: [],
  damageEventDisposition: "none",
  officialServerTruth: false,
  completeGcsimParity: false,
  coverage: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_COVERAGE,
  provisional: true,
} as const);

export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT = deepFreeze({
  version: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_VERSION,
  policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
  mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  contentHash: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_CONTENT_SHA256,
  mechanicsDataStatus: GCSIM_MECHANICS_DATA_STATUS,
  sourceProject: GCSIM_SOURCE_PROJECT,
  sourceRevision: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_SOURCE_REVISION,
  pinnedGcsimReference: true,
  mechanicsStatus: "partial",
  callbackSurface:
    "audit-only-until-callback-bus-bubble-and-impulse-implementation",
  callbackDisposition: "reference-audit-only-not-dispatched",
  triggerSources: GCSIM_FREEZE_BROKEN_ATTACK_TRIGGER_SOURCES,
  excludedReactionSources:
    GCSIM_FREEZE_BROKEN_ATTACK_EXCLUDED_REACTION_SOURCES,
  executionStatus:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE.localNormalization
      .executionStatus,
  auditDisposition:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE.localNormalization
      .auditDisposition,
  plannedCallbackCardinality:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE.localNormalization
      .plannedCallbackCardinality,
  normalizedDepletionThreshold:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE.localNormalization
      .depletionThreshold,
  normalizedDepletionComparator:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE.localNormalization
      .depletionComparator,
  rngDisposition:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE.localNormalization
      .rngDisposition,
  damageEventDisposition:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE.localNormalization
      .damageEventDisposition,
  intentionalDeviations: [
    "collapse-zero-durability-duplicate-to-exactly-once",
    "consume-no-crit-rng",
    "emit-no-synthetic-damage-event",
    "normalize-depletion-threshold-from-1e-11-to-1e-10",
    "callback-subscriber-side-effects-unimplemented",
    "mona-bubble-and-impulse-bus-unimplemented",
  ],
  officialServerTruth: false,
  completeGcsimParity: false,
  coverage: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_COVERAGE,
  provisional: true,
} as const);

export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ROOT = deepFreeze({
  version: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_VERSION,
  policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID,
  mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE,
  contentHash: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_CONTENT_SHA256,
  mechanicsDataStatus: GCSIM_MECHANICS_DATA_STATUS,
  sourceProject: GCSIM_SOURCE_PROJECT,
  sourceRevision: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_SOURCE_REVISION,
  pinnedGcsimReference: true,
  mechanicsStatus: "partial",
  callbackSurface: "versioned-callback-bus-dispatch-audit",
  callbackDisposition: "callback-bus-dispatched-normalized",
  requiredCallbackBusPolicyId:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_REQUIRED_CALLBACK_BUS_POLICY_ID,
  triggerSources: GCSIM_FREEZE_BROKEN_ATTACK_TRIGGER_SOURCES,
  excludedReactionSources:
    GCSIM_FREEZE_BROKEN_ATTACK_EXCLUDED_REACTION_SOURCES,
  executionStatus:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_PROFILE.localNormalization
      .executionStatus,
  auditDisposition:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_PROFILE.localNormalization
      .auditDisposition,
  callbackCardinality:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_PROFILE.localNormalization
      .callbackCardinality,
  dispatchSequence:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_PROFILE.localNormalization
      .dispatchSequence,
  dispatchPhases:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_PROFILE.localNormalization
      .dispatchPhases,
  normalizedDepletionThreshold:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_PROFILE.localNormalization
      .depletionThreshold,
  normalizedDepletionComparator:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_PROFILE.localNormalization
      .depletionComparator,
  rngDisposition:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_PROFILE.localNormalization
      .rngDisposition,
  damageEventDisposition:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_PROFILE.localNormalization
      .damageEventDisposition,
  hitResolutionDisposition:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_PROFILE.localNormalization
      .hitResolutionDisposition,
  physicsDisposition:
    GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_PROFILE.localNormalization
      .physicsDisposition,
  intentionalDeviations: [
    "collapse-zero-durability-duplicate-to-exactly-once",
    "consume-no-crit-rng",
    "emit-no-synthetic-damage-event",
    "emit-no-synthetic-hit-resolution",
    "normalize-depletion-threshold-from-1e-11-to-1e-10",
    "model-no-general-enemy-physics-or-impulse",
    "callback-subscriber-side-effects-unimplemented",
    "mona-bubble-and-impulse-side-effects-unimplemented",
  ],
  officialServerTruth: false,
  completeGcsimParity: false,
  coverage: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_COVERAGE,
  provisional: true,
} as const);

export type LegacyFreezeBrokenAttackPolicyV1Root =
  typeof LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT;
export type GcsimFreezeBrokenAttackPolicyV2Root =
  typeof GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT;
export type GcsimFreezeBrokenAttackPolicyV3Root =
  typeof GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ROOT;
export type FreezeBrokenAttackPolicyRoot =
  | LegacyFreezeBrokenAttackPolicyV1Root
  | GcsimFreezeBrokenAttackPolicyV2Root
  | GcsimFreezeBrokenAttackPolicyV3Root;
export type FreezeBrokenAttackPolicyId =
  | typeof LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID
  | typeof GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID
  | typeof GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID;

export function resolveFreezeBrokenAttackPolicyRoot(
  policyId: typeof LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
): LegacyFreezeBrokenAttackPolicyV1Root;
export function resolveFreezeBrokenAttackPolicyRoot(
  policyId: typeof GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
): GcsimFreezeBrokenAttackPolicyV2Root;
export function resolveFreezeBrokenAttackPolicyRoot(
  policyId: typeof GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID,
): GcsimFreezeBrokenAttackPolicyV3Root;
export function resolveFreezeBrokenAttackPolicyRoot(
  policyId: FreezeBrokenAttackPolicyId,
): FreezeBrokenAttackPolicyRoot;
export function resolveFreezeBrokenAttackPolicyRoot(
  policyId: string,
): FreezeBrokenAttackPolicyRoot;
export function resolveFreezeBrokenAttackPolicyRoot(
  policyId: string,
): FreezeBrokenAttackPolicyRoot {
  if (policyId === LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID) {
    return LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT;
  }
  if (policyId === GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID) {
    return GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT;
  }
  if (policyId === GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID) {
    return GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ROOT;
  }
  throw new RangeError(`unknown Freeze Broken attack policy: ${policyId}`);
}

export const FREEZE_BROKEN_ATTACK_POLICY_VERSION =
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_VERSION;
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_ID =
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID;
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_MODE =
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE;
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_SOURCE_REVISION =
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_SOURCE_REVISION;
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_COVERAGE =
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_COVERAGE;
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_PROFILE =
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_PROFILE;
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_CONTENT_SHA256 =
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_CONTENT_SHA256;
export const GCSIM_FREEZE_BROKEN_ATTACK_POLICY_ROOT =
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ROOT;

export type GcsimFreezeBrokenAttackPolicyProfile =
  GcsimFreezeBrokenAttackPolicyV3Profile;
export type GcsimFreezeBrokenAttackPolicyRoot =
  GcsimFreezeBrokenAttackPolicyV3Root;

export function canonicalFreezeBrokenAttackPolicyPayloadJson(): string {
  return canonicalGcsimFreezeBrokenAttackPolicyV3PayloadJson();
}
