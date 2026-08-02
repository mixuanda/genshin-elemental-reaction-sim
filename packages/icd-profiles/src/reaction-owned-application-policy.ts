import {
  GCSIM_ELEMENTAL_APPLICATION_ROOT,
  GCSIM_ELEMENTAL_APPLICATION_SOURCE_REVISION,
} from "./application-profile";

export const REACTION_OWNED_APPLICATION_POLICY_VERSION = "1.0.0" as const;

export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID =
  "gcsim-b4ae769-reaction-owned-elemental-application-policy-provisional-v1" as const;

export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_SOURCE_REVISION =
  "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541" as const;

export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_COVERAGE =
  "burning-tick-and-swirl-aoe-propagation-only" as const;

export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_RESET_TIMER_DATA_SOURCE =
  "referenced-elemental-application-root" as const;

export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_SAME_FRAME_ORDERING =
  "provisional-source-task-insertion-dependent" as const;

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
export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE = deepFreeze({
  version: REACTION_OWNED_APPLICATION_POLICY_VERSION,
  policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID,
  elementalApplicationRootRef: ELEMENTAL_APPLICATION_ROOT_REF,
  resetTimerDataSource:
    GCSIM_REACTION_OWNED_APPLICATION_POLICY_RESET_TIMER_DATA_SOURCE,
  sameFrameOrdering:
    GCSIM_REACTION_OWNED_APPLICATION_POLICY_SAME_FRAME_ORDERING,
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

export type GcsimReactionOwnedApplicationPolicyProfile =
  typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE;
export type GcsimReactionOwnedApplicationBinding =
  GcsimReactionOwnedApplicationPolicyProfile["bindings"][number];
export type GcsimReactionOwnedApplicationSourceKind =
  GcsimReactionOwnedApplicationBinding["sourceKind"];
export type GcsimSwirlPropagationElement = Extract<
  GcsimReactionOwnedApplicationBinding,
  { sourceKind: "swirl-propagation" }
>["element"];

export type GcsimBurningTickApplicationBinding = Extract<
  GcsimReactionOwnedApplicationBinding,
  { sourceKind: "burning-tick" }
>;
export type GcsimSwirlPropagationApplicationBinding = Extract<
  GcsimReactionOwnedApplicationBinding,
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

export function canonicalReactionOwnedApplicationPolicyPayloadJson(): string {
  return canonicalJson(
    GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE,
    new Set(),
  );
}

// Literal is independently derived from the canonical policy payload bytes.
export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_CONTENT_SHA256 =
  "sha256:50abcc04ad7bc55510e5786cbc3ace5105238e5fb2dea8e0944cd95708c80acc" as const;

export const GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT = deepFreeze({
  version: REACTION_OWNED_APPLICATION_POLICY_VERSION,
  policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID,
  contentHash: GCSIM_REACTION_OWNED_APPLICATION_POLICY_CONTENT_SHA256,
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
    GCSIM_REACTION_OWNED_APPLICATION_POLICY_SAME_FRAME_ORDERING,
  provisional: true,
} as const);

export type GcsimReactionOwnedApplicationPolicyRoot =
  typeof GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT;

const BURNING_TICK_BINDING =
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE.bindings[0];

const SWIRL_PROPAGATION_BINDING_BY_ELEMENT: ReadonlyMap<
  string,
  GcsimSwirlPropagationApplicationBinding
> = new Map(
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE.bindings
    .filter(
      (binding): binding is GcsimSwirlPropagationApplicationBinding =>
        binding.sourceKind === "swirl-propagation",
    )
    .map((binding) => [binding.element, binding]),
);

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
  if (sourceKind === "burning-tick") {
    if (element !== undefined) {
      throw new RangeError(
        "burning-tick binding does not accept an element selector",
      );
    }
    return BURNING_TICK_BINDING;
  }

  if (sourceKind === "swirl-propagation") {
    if (element === undefined) {
      throw new RangeError(
        "swirl-propagation binding requires an element selector",
      );
    }
    const binding = SWIRL_PROPAGATION_BINDING_BY_ELEMENT.get(element);
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

if (
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_SOURCE_REVISION !==
  GCSIM_ELEMENTAL_APPLICATION_SOURCE_REVISION
) {
  throw new Error(
    "reaction-owned application policy and elemental-application root revisions must match",
  );
}
