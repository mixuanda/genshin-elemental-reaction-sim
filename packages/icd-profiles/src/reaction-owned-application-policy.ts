import {
  GCSIM_ELEMENTAL_APPLICATION_ROOT,
  GCSIM_ELEMENTAL_APPLICATION_SOURCE_REVISION,
} from "./application-profile";

export const REACTION_OWNED_APPLICATION_POLICY_V1_VERSION = "1.0.0" as const;

export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID =
  "gcsim-b4ae769-reaction-owned-elemental-application-policy-provisional-v1" as const;

export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_SOURCE_REVISION =
  "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541" as const;

export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_COVERAGE =
  "burning-tick-and-swirl-aoe-propagation-only" as const;

export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_RESET_TIMER_DATA_SOURCE =
  "referenced-elemental-application-root" as const;

export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_SAME_FRAME_ORDERING =
  "provisional-source-task-insertion-dependent" as const;

export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_RESET_SCHEDULE_POLICY =
  "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one" as const;

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

const ELEMENTAL_APPLICATION_ROOT_REF = {
  profileId: GCSIM_ELEMENTAL_APPLICATION_ROOT.profileId,
  contentHash: GCSIM_ELEMENTAL_APPLICATION_ROOT.contentHash,
} as const;

/**
 * Reaction-owned elemental-application delivery bindings pinned to gcsim.
 *
 * Source: genshinsim/gcsim at
 * GCSIM_REACTION_OWNED_APPLICATION_POLICY_SOURCE_REVISION, specifically
 * pkg/reactable/burning.go, pkg/reactable/swirl.go, pkg/enemy/attack.go, and
 * pkg/target/icd.go. This deliberately covers only Burning ticks and the
 * gauge-carrying Swirl AoE propagation attack. It does not cover Swirl's
 * source-target damage-only hit or any other reaction delivery.
 *
 * Reset timer values and numeric sequences are intentionally not duplicated:
 * groupId resolves against the referenced elemental-application root. Exact
 * same-frame behavior remains dependent on source task insertion order and is
 * therefore provisional rather than official live-server truth.
 */
export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_PROFILE = deepFreeze({
  version: REACTION_OWNED_APPLICATION_POLICY_V1_VERSION,
  policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
  elementalApplicationRootRef: ELEMENTAL_APPLICATION_ROOT_REF,
  resetTimerDataSource:
    GCSIM_REACTION_OWNED_APPLICATION_POLICY_RESET_TIMER_DATA_SOURCE,
  sameFrameOrdering:
    GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_SAME_FRAME_ORDERING,
  provisional: true,
  provenance: {
    mechanicsDataStatus: MECHANICS_DATA_STATUS,
    sourceProject: SOURCE_PROJECT,
    sourceRevision: GCSIM_REACTION_OWNED_APPLICATION_POLICY_SOURCE_REVISION,
    officialServerTruth: false,
    completeGcsimParity: false,
    coverage: GCSIM_REACTION_OWNED_APPLICATION_POLICY_COVERAGE,
    provisional: true,
  },
  bindings: [
    {
      sourceKind: "burning-tick",
      reaction: "burning",
      element: "pyro",
      sourceIcdTag: "ICDTagBurningDamage",
      groupId: "burning",
      gauge: {
        kind: "fixed",
        units: 1,
      },
      stateScope:
        "trusted-target-global-observable-projection-of-all-character-counters",
    },
    {
      sourceKind: "swirl-propagation",
      reaction: "swirl",
      element: "pyro",
      sourceIcdTag: "ICDTagSwirlPyro",
      groupId: "reaction-a",
      gauge: {
        kind: "propagated-gauge-derived",
      },
      stateScope: "per-target-source-character-and-icd-tag",
    },
    {
      sourceKind: "swirl-propagation",
      reaction: "swirl",
      element: "hydro",
      sourceIcdTag: "ICDTagSwirlHydro",
      groupId: "reaction-a",
      gauge: {
        kind: "propagated-gauge-derived",
      },
      stateScope: "per-target-source-character-and-icd-tag",
    },
    {
      sourceKind: "swirl-propagation",
      reaction: "swirl",
      element: "cryo",
      sourceIcdTag: "ICDTagSwirlCryo",
      groupId: "reaction-a",
      gauge: {
        kind: "propagated-gauge-derived",
      },
      stateScope: "per-target-source-character-and-icd-tag",
    },
    {
      sourceKind: "swirl-propagation",
      reaction: "swirl",
      element: "electro",
      sourceIcdTag: "ICDTagSwirlElectro",
      groupId: "reaction-a",
      gauge: {
        kind: "propagated-gauge-derived",
      },
      stateScope: "per-target-source-character-and-icd-tag",
    },
  ],
} as const);

export type GcsimReactionOwnedApplicationPolicyV1Profile =
  typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_PROFILE;
export type GcsimReactionOwnedApplicationV1Binding =
  GcsimReactionOwnedApplicationPolicyV1Profile["bindings"][number];
export type GcsimReactionOwnedApplicationV1SourceKind =
  GcsimReactionOwnedApplicationV1Binding["sourceKind"];
export type GcsimSwirlPropagationV1Element = Extract<
  GcsimReactionOwnedApplicationV1Binding,
  { sourceKind: "swirl-propagation" }
>["element"];

export type GcsimBurningTickApplicationV1Binding = Extract<
  GcsimReactionOwnedApplicationV1Binding,
  { sourceKind: "burning-tick" }
>;
export type GcsimSwirlPropagationApplicationV1Binding = Extract<
  GcsimReactionOwnedApplicationV1Binding,
  { sourceKind: "swirl-propagation" }
>;

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

export function canonicalReactionOwnedApplicationPolicyV1PayloadJson(): string {
  return canonicalJson(
    GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_PROFILE,
    new Set(),
  );
}

// Literal is independently derived from the canonical policy payload bytes.
export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_CONTENT_SHA256 =
  "sha256:50abcc04ad7bc55510e5786cbc3ace5105238e5fb2dea8e0944cd95708c80acc" as const;

export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT = deepFreeze({
  version: REACTION_OWNED_APPLICATION_POLICY_V1_VERSION,
  policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
  contentHash: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_CONTENT_SHA256,
  mechanicsDataStatus: MECHANICS_DATA_STATUS,
  sourceProject: SOURCE_PROJECT,
  sourceRevision: GCSIM_REACTION_OWNED_APPLICATION_POLICY_SOURCE_REVISION,
  elementalApplicationRootRef: ELEMENTAL_APPLICATION_ROOT_REF,
  officialServerTruth: false,
  completeGcsimParity: false,
  coverage: GCSIM_REACTION_OWNED_APPLICATION_POLICY_COVERAGE,
  resetTimerDataSource:
    GCSIM_REACTION_OWNED_APPLICATION_POLICY_RESET_TIMER_DATA_SOURCE,
  sameFrameOrdering:
    GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_SAME_FRAME_ORDERING,
  provisional: true,
} as const);

export type GcsimReactionOwnedApplicationPolicyV1Root =
  typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT;

const BURNING_TICK_V1_BINDING =
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_PROFILE.bindings[0];

const SWIRL_PROPAGATION_V1_BINDING_BY_ELEMENT: ReadonlyMap<
  string,
  GcsimSwirlPropagationApplicationV1Binding
> = new Map(
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_PROFILE.bindings
    .filter(
      (binding): binding is GcsimSwirlPropagationApplicationV1Binding =>
        binding.sourceKind === "swirl-propagation",
    )
    .map((binding) => [binding.element, binding]),
);

export function resolveReactionOwnedApplicationV1Binding(
  sourceKind: "burning-tick",
): GcsimBurningTickApplicationV1Binding;
export function resolveReactionOwnedApplicationV1Binding(
  sourceKind: "swirl-propagation",
  element: GcsimSwirlPropagationV1Element,
): GcsimSwirlPropagationApplicationV1Binding;
export function resolveReactionOwnedApplicationV1Binding(
  sourceKind: string,
  element?: string,
): GcsimReactionOwnedApplicationV1Binding {
  if (sourceKind === "burning-tick") {
    if (element !== undefined) {
      throw new RangeError(
        "burning-tick binding does not accept an element selector",
      );
    }
    return BURNING_TICK_V1_BINDING;
  }

  if (sourceKind === "swirl-propagation") {
    if (element === undefined) {
      throw new RangeError(
        "swirl-propagation binding requires an element selector",
      );
    }
    const binding = SWIRL_PROPAGATION_V1_BINDING_BY_ELEMENT.get(element);
    if (binding === undefined) {
      throw new RangeError(
        `unknown swirl-propagation application element: ${element}`,
      );
    }
    return binding;
  }

  throw new RangeError(
    `unknown reaction-owned application source kind: ${sourceKind}`,
  );
}

export const REACTION_OWNED_APPLICATION_POLICY_V2_VERSION = "2.0.0" as const;

export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID =
  "gcsim-b4ae769-reaction-owned-elemental-application-policy-provisional-v2" as const;

export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_RESET_SCHEDULE_POLICY =
  "channel-specific-core-reset-boundary-at-window-start-plus-reset-frames-minus-one" as const;

export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_SAME_FRAME_ORDERING =
  "provisional-channel-specific-reset-boundary" as const;

export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_PROFILE = deepFreeze({
  version: REACTION_OWNED_APPLICATION_POLICY_V2_VERSION,
  policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID,
  elementalApplicationRootRef: ELEMENTAL_APPLICATION_ROOT_REF,
  resetTimerDataSource:
    GCSIM_REACTION_OWNED_APPLICATION_POLICY_RESET_TIMER_DATA_SOURCE,
  resetSchedulePolicy:
    GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_RESET_SCHEDULE_POLICY,
  sameFrameOrdering:
    GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_SAME_FRAME_ORDERING,
  provisional: true,
  provenance: {
    mechanicsDataStatus: MECHANICS_DATA_STATUS,
    sourceProject: SOURCE_PROJECT,
    sourceRevision: GCSIM_REACTION_OWNED_APPLICATION_POLICY_SOURCE_REVISION,
    officialServerTruth: false,
    completeGcsimParity: false,
    coverage: GCSIM_REACTION_OWNED_APPLICATION_POLICY_COVERAGE,
    provisional: true,
  },
  bindings: [
    {
      ...GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_PROFILE.bindings[0],
      deliveryChannel: "enemy-target-task",
      resetBoundary: "attempt-before-core-reset",
      resetSchedulePolicy:
        "provisional-attempt-before-core-reset-at-window-start-plus-reset-frames-minus-one",
    },
    {
      ...GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_PROFILE.bindings[1],
      deliveryChannel: "follow-up-core-propagation",
      resetBoundary: "reset-before-attempt",
      resetSchedulePolicy:
        "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one",
    },
    {
      ...GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_PROFILE.bindings[2],
      deliveryChannel: "follow-up-core-propagation",
      resetBoundary: "reset-before-attempt",
      resetSchedulePolicy:
        "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one",
    },
    {
      ...GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_PROFILE.bindings[3],
      deliveryChannel: "follow-up-core-propagation",
      resetBoundary: "reset-before-attempt",
      resetSchedulePolicy:
        "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one",
    },
    {
      ...GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_PROFILE.bindings[4],
      deliveryChannel: "follow-up-core-propagation",
      resetBoundary: "reset-before-attempt",
      resetSchedulePolicy:
        "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one",
    },
  ],
} as const);

export type GcsimReactionOwnedApplicationPolicyV2Profile =
  typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_PROFILE;
export type GcsimReactionOwnedApplicationV2Binding =
  GcsimReactionOwnedApplicationPolicyV2Profile["bindings"][number];
export type GcsimReactionOwnedApplicationV2SourceKind =
  GcsimReactionOwnedApplicationV2Binding["sourceKind"];
export type GcsimSwirlPropagationV2Element = Extract<
  GcsimReactionOwnedApplicationV2Binding,
  { sourceKind: "swirl-propagation" }
>["element"];
export type GcsimBurningTickApplicationV2Binding = Extract<
  GcsimReactionOwnedApplicationV2Binding,
  { sourceKind: "burning-tick" }
>;
export type GcsimSwirlPropagationApplicationV2Binding = Extract<
  GcsimReactionOwnedApplicationV2Binding,
  { sourceKind: "swirl-propagation" }
>;

export function canonicalReactionOwnedApplicationPolicyV2PayloadJson(): string {
  return canonicalJson(
    GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_PROFILE,
    new Set(),
  );
}

// Literal is independently derived from the canonical policy payload bytes.
export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_CONTENT_SHA256 =
  "sha256:9b3b07731d49ebf8abb445708c3edb99b3ce8c3c7465ce5ca02b0a7c8092a660" as const;

export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ROOT = deepFreeze({
  version: REACTION_OWNED_APPLICATION_POLICY_V2_VERSION,
  policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID,
  contentHash: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_CONTENT_SHA256,
  mechanicsDataStatus: MECHANICS_DATA_STATUS,
  sourceProject: SOURCE_PROJECT,
  sourceRevision: GCSIM_REACTION_OWNED_APPLICATION_POLICY_SOURCE_REVISION,
  elementalApplicationRootRef: ELEMENTAL_APPLICATION_ROOT_REF,
  officialServerTruth: false,
  completeGcsimParity: false,
  coverage: GCSIM_REACTION_OWNED_APPLICATION_POLICY_COVERAGE,
  resetTimerDataSource:
    GCSIM_REACTION_OWNED_APPLICATION_POLICY_RESET_TIMER_DATA_SOURCE,
  resetSchedulePolicy:
    GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_RESET_SCHEDULE_POLICY,
  sameFrameOrdering:
    GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_SAME_FRAME_ORDERING,
  provisional: true,
} as const);

export type GcsimReactionOwnedApplicationPolicyV2Root =
  typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ROOT;

const BURNING_TICK_V2_BINDING =
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_PROFILE.bindings[0];

const SWIRL_PROPAGATION_V2_BINDING_BY_ELEMENT: ReadonlyMap<
  string,
  GcsimSwirlPropagationApplicationV2Binding
> = new Map(
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_PROFILE.bindings
    .filter(
      (binding): binding is GcsimSwirlPropagationApplicationV2Binding =>
        binding.sourceKind === "swirl-propagation",
    )
    .map((binding) => [binding.element, binding]),
);

export function resolveReactionOwnedApplicationV2Binding(
  sourceKind: "burning-tick",
): GcsimBurningTickApplicationV2Binding;
export function resolveReactionOwnedApplicationV2Binding(
  sourceKind: "swirl-propagation",
  element: GcsimSwirlPropagationV2Element,
): GcsimSwirlPropagationApplicationV2Binding;
export function resolveReactionOwnedApplicationV2Binding(
  sourceKind: string,
  element?: string,
): GcsimReactionOwnedApplicationV2Binding {
  if (sourceKind === "burning-tick") {
    if (element !== undefined) {
      throw new RangeError(
        "burning-tick binding does not accept an element selector",
      );
    }
    return BURNING_TICK_V2_BINDING;
  }

  if (sourceKind === "swirl-propagation") {
    if (element === undefined) {
      throw new RangeError(
        "swirl-propagation binding requires an element selector",
      );
    }
    const binding = SWIRL_PROPAGATION_V2_BINDING_BY_ELEMENT.get(element);
    if (binding === undefined) {
      throw new RangeError(
        `unknown swirl-propagation application element: ${element}`,
      );
    }
    return binding;
  }

  throw new RangeError(
    `unknown reaction-owned application source kind: ${sourceKind}`,
  );
}

export const REACTION_OWNED_APPLICATION_POLICY_VERSION =
  REACTION_OWNED_APPLICATION_POLICY_V2_VERSION;
export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID =
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID;
export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE =
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_PROFILE;
export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_CONTENT_SHA256 =
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_CONTENT_SHA256;
export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT =
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ROOT;
export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_SAME_FRAME_ORDERING =
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_SAME_FRAME_ORDERING;

export type GcsimReactionOwnedApplicationPolicyProfile =
  GcsimReactionOwnedApplicationPolicyV2Profile;
export type GcsimReactionOwnedApplicationBinding =
  GcsimReactionOwnedApplicationV2Binding;
export type GcsimReactionOwnedApplicationSourceKind =
  GcsimReactionOwnedApplicationV2SourceKind;
export type GcsimSwirlPropagationElement = GcsimSwirlPropagationV2Element;
export type GcsimBurningTickApplicationBinding =
  GcsimBurningTickApplicationV2Binding;
export type GcsimSwirlPropagationApplicationBinding =
  GcsimSwirlPropagationApplicationV2Binding;
export type GcsimReactionOwnedApplicationPolicyId =
  | typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID
  | typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID;
export type GcsimReactionOwnedApplicationPolicyRoot =
  GcsimReactionOwnedApplicationPolicyV2Root;

export function canonicalReactionOwnedApplicationPolicyPayloadJson(): string {
  return canonicalReactionOwnedApplicationPolicyV2PayloadJson();
}

export function resolveReactionOwnedApplicationBinding(
  sourceKind: "burning-tick",
): GcsimBurningTickApplicationBinding;
export function resolveReactionOwnedApplicationBinding(
  sourceKind: "swirl-propagation",
  element: GcsimSwirlPropagationElement,
): GcsimSwirlPropagationApplicationBinding;
export function resolveReactionOwnedApplicationBinding(
  sourceKind: string,
  element?: string,
): GcsimReactionOwnedApplicationBinding {
  return resolveReactionOwnedApplicationV2Binding(
    sourceKind as "swirl-propagation",
    element as GcsimSwirlPropagationV2Element,
  );
}

export function resolveReactionOwnedApplicationPolicyRoot(
  policyId: typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
): GcsimReactionOwnedApplicationPolicyV1Root;
export function resolveReactionOwnedApplicationPolicyRoot(
  policyId: typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID,
): GcsimReactionOwnedApplicationPolicyV2Root;
export function resolveReactionOwnedApplicationPolicyRoot(
  policyId: GcsimReactionOwnedApplicationPolicyId,
):
  | GcsimReactionOwnedApplicationPolicyV1Root
  | GcsimReactionOwnedApplicationPolicyV2Root;
export function resolveReactionOwnedApplicationPolicyRoot(
  policyId: string,
):
  | GcsimReactionOwnedApplicationPolicyV1Root
  | GcsimReactionOwnedApplicationPolicyV2Root {
  if (policyId === GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID) {
    return GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT;
  }
  if (policyId === GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID) {
    return GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ROOT;
  }
  throw new RangeError(`unknown reaction-owned application policy: ${policyId}`);
}

export function resolveReactionOwnedApplicationBindingForPolicy(
  policyId: typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
  sourceKind: "burning-tick",
): GcsimBurningTickApplicationV1Binding;
export function resolveReactionOwnedApplicationBindingForPolicy(
  policyId: typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
  sourceKind: "swirl-propagation",
  element: GcsimSwirlPropagationV1Element,
): GcsimSwirlPropagationApplicationV1Binding;
export function resolveReactionOwnedApplicationBindingForPolicy(
  policyId: typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID,
  sourceKind: "burning-tick",
): GcsimBurningTickApplicationV2Binding;
export function resolveReactionOwnedApplicationBindingForPolicy(
  policyId: typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID,
  sourceKind: "swirl-propagation",
  element: GcsimSwirlPropagationV2Element,
): GcsimSwirlPropagationApplicationV2Binding;
export function resolveReactionOwnedApplicationBindingForPolicy(
  policyId: GcsimReactionOwnedApplicationPolicyId,
  sourceKind: "burning-tick",
):
  | GcsimBurningTickApplicationV1Binding
  | GcsimBurningTickApplicationV2Binding;
export function resolveReactionOwnedApplicationBindingForPolicy(
  policyId: GcsimReactionOwnedApplicationPolicyId,
  sourceKind: "swirl-propagation",
  element: GcsimSwirlPropagationV1Element | GcsimSwirlPropagationV2Element,
):
  | GcsimSwirlPropagationApplicationV1Binding
  | GcsimSwirlPropagationApplicationV2Binding;
export function resolveReactionOwnedApplicationBindingForPolicy(
  policyId: string,
  sourceKind: string,
  element?: string,
):
  | GcsimReactionOwnedApplicationV1Binding
  | GcsimReactionOwnedApplicationV2Binding {
  if (policyId === GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID) {
    return resolveReactionOwnedApplicationV1Binding(
      sourceKind as "swirl-propagation",
      element as GcsimSwirlPropagationV1Element,
    );
  }
  if (policyId === GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID) {
    return resolveReactionOwnedApplicationV2Binding(
      sourceKind as "swirl-propagation",
      element as GcsimSwirlPropagationV2Element,
    );
  }
  throw new RangeError(`unknown reaction-owned application policy: ${policyId}`);
}

if (
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_SOURCE_REVISION !==
  GCSIM_ELEMENTAL_APPLICATION_SOURCE_REVISION
) {
  throw new Error(
    "reaction-owned application policy and elemental-application root revisions must match",
  );
}
