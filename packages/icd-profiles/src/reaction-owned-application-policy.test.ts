import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  canonicalReactionOwnedApplicationPolicyPayloadJson,
  GCSIM_ELEMENTAL_APPLICATION_CONTENT_SHA256,
  GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  GCSIM_ELEMENTAL_APPLICATION_ROOT,
  GCSIM_ELEMENTAL_APPLICATION_SOURCE_REVISION,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_CONTENT_SHA256,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_COVERAGE,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_RESET_TIMER_DATA_SOURCE,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_SAME_FRAME_ORDERING,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_SOURCE_REVISION,
  REACTION_OWNED_APPLICATION_POLICY_VERSION,
  resolveElementalApplicationGroup,
  resolveReactionOwnedApplicationBinding,
  type GcsimReactionOwnedApplicationBinding,
  type GcsimReactionOwnedApplicationPolicyRoot,
} from "./index";

const EXPECTED_BINDINGS = [
  {
    sourceKind: "burning-tick",
    reaction: "burning",
    element: "pyro",
    sourceIcdTag: "ICDTagBurningDamage",
    groupId: "burning",
    gauge: { kind: "fixed", units: 1 },
    stateScope:
      "trusted-target-global-observable-projection-of-all-character-counters",
  },
  {
    sourceKind: "swirl-propagation",
    reaction: "swirl",
    element: "pyro",
    sourceIcdTag: "ICDTagSwirlPyro",
    groupId: "reaction-a",
    gauge: { kind: "propagated-gauge-derived" },
    stateScope: "per-target-source-character-and-icd-tag",
  },
  {
    sourceKind: "swirl-propagation",
    reaction: "swirl",
    element: "hydro",
    sourceIcdTag: "ICDTagSwirlHydro",
    groupId: "reaction-a",
    gauge: { kind: "propagated-gauge-derived" },
    stateScope: "per-target-source-character-and-icd-tag",
  },
  {
    sourceKind: "swirl-propagation",
    reaction: "swirl",
    element: "cryo",
    sourceIcdTag: "ICDTagSwirlCryo",
    groupId: "reaction-a",
    gauge: { kind: "propagated-gauge-derived" },
    stateScope: "per-target-source-character-and-icd-tag",
  },
  {
    sourceKind: "swirl-propagation",
    reaction: "swirl",
    element: "electro",
    sourceIcdTag: "ICDTagSwirlElectro",
    groupId: "reaction-a",
    gauge: { kind: "propagated-gauge-derived" },
    stateScope: "per-target-source-character-and-icd-tag",
  },
] as const;

describe("gcsim reaction-owned elemental-application policy", () => {
  it("pins the independent Burning tick and Swirl AoE binding oracle", () => {
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE.bindings).toEqual(
      EXPECTED_BINDINGS,
    );
    expect(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE.bindings,
    ).toHaveLength(5);

    const reactions = new Set(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE.bindings.map(
        ({ reaction }) => reaction,
      ),
    );
    expect(reactions).toEqual(new Set(["burning", "swirl"]));
    expect(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE.bindings.filter(
        ({ sourceKind }) => sourceKind === "burning-tick",
      ),
    ).toHaveLength(1);
    expect(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE.bindings.filter(
        ({ sourceKind }) => sourceKind === "swirl-propagation",
      ),
    ).toHaveLength(4);
  });

  it("references the existing elemental-application root for groups and reset timers", () => {
    const expectedRef = {
      profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
      contentHash: GCSIM_ELEMENTAL_APPLICATION_CONTENT_SHA256,
    };
    expect(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE.elementalApplicationRootRef,
    ).toEqual(expectedRef);
    expect(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT.elementalApplicationRootRef,
    ).toEqual(expectedRef);
    expect(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE.resetTimerDataSource,
    ).toBe("referenced-elemental-application-root");
    expect(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT.resetTimerDataSource,
    ).toBe("referenced-elemental-application-root");

    expect(resolveElementalApplicationGroup("burning")).toMatchObject({
      resetFrames: 120,
      applicationSequence: [1, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(resolveElementalApplicationGroup("reaction-a")).toMatchObject({
      resetFrames: 30,
      applicationSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    });
    expect(
      new Set(
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE.bindings.map(
          ({ groupId }) => groupId,
        ),
      ),
    ).toEqual(new Set(["burning", "reaction-a"]));

    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_SOURCE_REVISION).toBe(
      GCSIM_ELEMENTAL_APPLICATION_SOURCE_REVISION,
    );
    expect(GCSIM_ELEMENTAL_APPLICATION_ROOT.contentHash).toBe(
      GCSIM_ELEMENTAL_APPLICATION_CONTENT_SHA256,
    );
  });

  it("pins provisional provenance and source-task-dependent same-frame ordering", () => {
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE).toMatchObject({
      version: REACTION_OWNED_APPLICATION_POLICY_VERSION,
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID,
      resetTimerDataSource:
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_RESET_TIMER_DATA_SOURCE,
      sameFrameOrdering:
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_SAME_FRAME_ORDERING,
      provisional: true,
      provenance: {
        mechanicsDataStatus: "fixed-gcsim-provisional",
        sourceProject: "genshinsim/gcsim",
        sourceRevision: GCSIM_REACTION_OWNED_APPLICATION_POLICY_SOURCE_REVISION,
        officialServerTruth: false,
        completeGcsimParity: false,
        coverage: GCSIM_REACTION_OWNED_APPLICATION_POLICY_COVERAGE,
        provisional: true,
      },
    });
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT).toEqual({
      version: REACTION_OWNED_APPLICATION_POLICY_VERSION,
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID,
      contentHash: GCSIM_REACTION_OWNED_APPLICATION_POLICY_CONTENT_SHA256,
      mechanicsDataStatus: "fixed-gcsim-provisional",
      sourceProject: "genshinsim/gcsim",
      sourceRevision: GCSIM_REACTION_OWNED_APPLICATION_POLICY_SOURCE_REVISION,
      elementalApplicationRootRef: {
        profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
        contentHash: GCSIM_ELEMENTAL_APPLICATION_CONTENT_SHA256,
      },
      officialServerTruth: false,
      completeGcsimParity: false,
      coverage: GCSIM_REACTION_OWNED_APPLICATION_POLICY_COVERAGE,
      resetTimerDataSource:
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_RESET_TIMER_DATA_SOURCE,
      sameFrameOrdering: "provisional-source-task-insertion-dependent",
      provisional: true,
    });

    const typedRoot: GcsimReactionOwnedApplicationPolicyRoot =
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT;
    expect(typedRoot.officialServerTruth).toBe(false);
    expect(typedRoot.completeGcsimParity).toBe(false);
  });

  it("resolves only the exact reaction-owned source and element combinations", () => {
    expect(resolveReactionOwnedApplicationBinding("burning-tick")).toEqual(
      EXPECTED_BINDINGS[0],
    );
    expect(
      resolveReactionOwnedApplicationBinding("swirl-propagation", "pyro"),
    ).toEqual(EXPECTED_BINDINGS[1]);
    expect(
      resolveReactionOwnedApplicationBinding("swirl-propagation", "hydro"),
    ).toEqual(EXPECTED_BINDINGS[2]);
    expect(
      resolveReactionOwnedApplicationBinding("swirl-propagation", "cryo"),
    ).toEqual(EXPECTED_BINDINGS[3]);
    expect(
      resolveReactionOwnedApplicationBinding("swirl-propagation", "electro"),
    ).toEqual(EXPECTED_BINDINGS[4]);

    const unsafeResolve = resolveReactionOwnedApplicationBinding as unknown as (
      sourceKind: string,
      element?: string,
    ) => GcsimReactionOwnedApplicationBinding;
    expect(() => unsafeResolve("burning-tick", "pyro")).toThrow(
      /does not accept an element selector/,
    );
    expect(() => unsafeResolve("swirl-propagation")).toThrow(
      /requires an element selector/,
    );
    expect(() => unsafeResolve("swirl-propagation", "anemo")).toThrow(
      /unknown swirl-propagation application element/,
    );
    expect(() => unsafeResolve("overload")).toThrow(
      /unknown reaction-owned application source kind/,
    );
  });

  it("deep-freezes the policy payload, nested bindings, and root references", () => {
    expect(
      Object.isFrozen(GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE),
    ).toBe(true);
    expect(
      Object.isFrozen(
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE.provenance,
      ),
    ).toBe(true);
    expect(
      Object.isFrozen(
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE.elementalApplicationRootRef,
      ),
    ).toBe(true);
    expect(
      Object.isFrozen(GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE.bindings),
    ).toBe(true);
    expect(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE.bindings.every(
        (binding) => Object.isFrozen(binding) && Object.isFrozen(binding.gauge),
      ),
    ).toBe(true);
    expect(Object.isFrozen(GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT)).toBe(
      true,
    );
    expect(
      Object.isFrozen(
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT.elementalApplicationRootRef,
      ),
    ).toBe(true);

    expect(() => {
      const gauge = GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE.bindings[0]
        .gauge as unknown as { units: number };
      gauge.units = 2;
    }).toThrow(TypeError);
    expect(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE.bindings[0].gauge,
    ).toEqual({ kind: "fixed", units: 1 });
  });

  it("pins canonical payload bytes and independently recomputes the content SHA", () => {
    const canonicalPayload =
      canonicalReactionOwnedApplicationPolicyPayloadJson();
    expect(JSON.parse(canonicalPayload)).toEqual(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE,
    );
    expect(canonicalPayload).toBe(
      canonicalReactionOwnedApplicationPolicyPayloadJson(),
    );
    expect(canonicalPayload.startsWith('{"bindings":')).toBe(true);
    expect(Buffer.byteLength(canonicalPayload)).toBe(1898);
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_CONTENT_SHA256).toBe(
      "sha256:50abcc04ad7bc55510e5786cbc3ace5105238e5fb2dea8e0944cd95708c80acc",
    );
    expect(
      `sha256:${createHash("sha256").update(canonicalPayload).digest("hex")}`,
    ).toBe(GCSIM_REACTION_OWNED_APPLICATION_POLICY_CONTENT_SHA256);
  });
});
