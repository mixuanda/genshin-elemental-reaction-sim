import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  canonicalReactionOwnedApplicationPolicyPayloadJson,
  canonicalReactionOwnedApplicationPolicyV1PayloadJson,
  canonicalReactionOwnedApplicationPolicyV2PayloadJson,
  GCSIM_ELEMENTAL_APPLICATION_CONTENT_SHA256,
  GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  GCSIM_ELEMENTAL_APPLICATION_SOURCE_REVISION,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_CONTENT_SHA256,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_SOURCE_REVISION,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_CONTENT_SHA256,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_PROFILE,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_RESET_SCHEDULE_POLICY,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_CONTENT_SHA256,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_PROFILE,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_RESET_SCHEDULE_POLICY,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ROOT,
  REACTION_OWNED_APPLICATION_POLICY_VERSION,
  REACTION_OWNED_APPLICATION_POLICY_V1_VERSION,
  REACTION_OWNED_APPLICATION_POLICY_V2_VERSION,
  resolveElementalApplicationGroup,
  resolveReactionOwnedApplicationBinding,
  resolveReactionOwnedApplicationBindingForPolicy,
  resolveReactionOwnedApplicationPolicyRoot,
  type GcsimReactionOwnedApplicationPolicyRoot,
  type GcsimReactionOwnedApplicationPolicyV1Root,
  type GcsimReactionOwnedApplicationPolicyV2Root,
  type GcsimReactionOwnedApplicationV1Binding,
  type GcsimReactionOwnedApplicationV2Binding,
} from "./index";

const EXPECTED_V1_BINDINGS = [
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
  ...(["pyro", "hydro", "cryo", "electro"] as const).map((element) => ({
    sourceKind: "swirl-propagation" as const,
    reaction: "swirl" as const,
    element,
    sourceIcdTag: `ICDTagSwirl${element[0]?.toUpperCase()}${element.slice(1)}`,
    groupId: "reaction-a" as const,
    gauge: { kind: "propagated-gauge-derived" as const },
    stateScope: "per-target-source-character-and-icd-tag" as const,
  })),
] as const;

const EXPECTED_V2_BINDINGS = EXPECTED_V1_BINDINGS.map((binding) =>
  binding.sourceKind === "burning-tick"
    ? {
        ...binding,
        deliveryChannel: "enemy-target-task",
        resetBoundary: "attempt-before-core-reset",
        resetSchedulePolicy:
          "provisional-attempt-before-core-reset-at-window-start-plus-reset-frames-minus-one",
      }
    : {
        ...binding,
        deliveryChannel: "follow-up-core-propagation",
        resetBoundary: "reset-before-attempt",
        resetSchedulePolicy:
          "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one",
      },
);

const sha256 = (payload: string): string =>
  `sha256:${createHash("sha256").update(payload).digest("hex")}`;

describe("gcsim reaction-owned elemental-application policy roots", () => {
  it("keeps the v1 payload, identity, root, and canonical hash byte-for-byte", () => {
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_PROFILE.bindings).toEqual(
      EXPECTED_V1_BINDINGS,
    );
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_PROFILE).toMatchObject({
      version: "1.0.0",
      policyId:
        "gcsim-b4ae769-reaction-owned-elemental-application-policy-provisional-v1",
      sameFrameOrdering: "provisional-source-task-insertion-dependent",
      provisional: true,
    });
    expect(
      "resetSchedulePolicy" in
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_PROFILE,
    ).toBe(false);
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT).toEqual({
      version: REACTION_OWNED_APPLICATION_POLICY_V1_VERSION,
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
      contentHash: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_CONTENT_SHA256,
      mechanicsDataStatus: "fixed-gcsim-provisional",
      sourceProject: "genshinsim/gcsim",
      sourceRevision: GCSIM_REACTION_OWNED_APPLICATION_POLICY_SOURCE_REVISION,
      elementalApplicationRootRef: {
        profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
        contentHash: GCSIM_ELEMENTAL_APPLICATION_CONTENT_SHA256,
      },
      officialServerTruth: false,
      completeGcsimParity: false,
      coverage: "burning-tick-and-swirl-aoe-propagation-only",
      resetTimerDataSource: "referenced-elemental-application-root",
      sameFrameOrdering: "provisional-source-task-insertion-dependent",
      provisional: true,
    });
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_RESET_SCHEDULE_POLICY).toBe(
      "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one",
    );

    const payload = canonicalReactionOwnedApplicationPolicyV1PayloadJson();
    expect(Buffer.byteLength(payload)).toBe(1898);
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_CONTENT_SHA256).toBe(
      "sha256:50abcc04ad7bc55510e5786cbc3ace5105238e5fb2dea8e0944cd95708c80acc",
    );
    expect(sha256(payload)).toBe(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_CONTENT_SHA256,
    );

    const typedRoot: GcsimReactionOwnedApplicationPolicyV1Root =
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT;
    expect(typedRoot.completeGcsimParity).toBe(false);
  });

  it("makes v2 the current policy and pins channel-specific reset boundaries", () => {
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_PROFILE.bindings).toEqual(
      EXPECTED_V2_BINDINGS,
    );
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_PROFILE).toMatchObject({
      version: "2.0.0",
      policyId:
        "gcsim-b4ae769-reaction-owned-elemental-application-policy-provisional-v2",
      resetSchedulePolicy:
        "channel-specific-core-reset-boundary-at-window-start-plus-reset-frames-minus-one",
      sameFrameOrdering: "provisional-channel-specific-reset-boundary",
      provisional: true,
      provenance: {
        sourceRevision: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
        officialServerTruth: false,
        completeGcsimParity: false,
        provisional: true,
      },
    });
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ROOT).toMatchObject({
      version: REACTION_OWNED_APPLICATION_POLICY_V2_VERSION,
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID,
      contentHash: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_CONTENT_SHA256,
      resetSchedulePolicy:
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_RESET_SCHEDULE_POLICY,
      sameFrameOrdering: "provisional-channel-specific-reset-boundary",
      officialServerTruth: false,
      completeGcsimParity: false,
      provisional: true,
    });

    expect(REACTION_OWNED_APPLICATION_POLICY_VERSION).toBe(
      REACTION_OWNED_APPLICATION_POLICY_V2_VERSION,
    );
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID).toBe(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID,
    );
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_PROFILE).toBe(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_PROFILE,
    );
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT).toBe(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ROOT,
    );
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_CONTENT_SHA256).toBe(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_CONTENT_SHA256,
    );

    const typedRoot: GcsimReactionOwnedApplicationPolicyV2Root =
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ROOT;
    const currentTypedRoot: GcsimReactionOwnedApplicationPolicyRoot =
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT;
    expect(currentTypedRoot).toBe(typedRoot);
  });

  it("pins the independent elemental-application root and gcsim revision", () => {
    for (const profile of [
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_PROFILE,
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_PROFILE,
    ]) {
      expect(profile.elementalApplicationRootRef).toEqual({
        profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
        contentHash: GCSIM_ELEMENTAL_APPLICATION_CONTENT_SHA256,
      });
    }
    expect(resolveElementalApplicationGroup("burning")).toMatchObject({
      resetFrames: 120,
      applicationSequence: [1, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(resolveElementalApplicationGroup("reaction-a")).toMatchObject({
      resetFrames: 30,
      applicationSequence: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    });
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_SOURCE_REVISION).toBe(
      GCSIM_ELEMENTAL_APPLICATION_SOURCE_REVISION,
    );
  });

  it("resolves roots and bindings by explicit policyId without v1/v2 drift", () => {
    expect(
      resolveReactionOwnedApplicationPolicyRoot(
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
      ),
    ).toBe(GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT);
    expect(
      resolveReactionOwnedApplicationPolicyRoot(
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID,
      ),
    ).toBe(GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ROOT);

    const v1Binding: GcsimReactionOwnedApplicationV1Binding =
      resolveReactionOwnedApplicationBindingForPolicy(
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
        "burning-tick",
      );
    expect(v1Binding).toEqual(EXPECTED_V1_BINDINGS[0]);
    expect("resetBoundary" in v1Binding).toBe(false);

    const v2Binding: GcsimReactionOwnedApplicationV2Binding =
      resolveReactionOwnedApplicationBindingForPolicy(
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID,
        "burning-tick",
      );
    expect(v2Binding).toEqual(EXPECTED_V2_BINDINGS[0]);
    expect(resolveReactionOwnedApplicationBinding("burning-tick")).toBe(
      v2Binding,
    );

    expect(
      resolveReactionOwnedApplicationBindingForPolicy(
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID,
        "swirl-propagation",
        "electro",
      ),
    ).toEqual(EXPECTED_V2_BINDINGS[4]);

    const unsafeRoot = resolveReactionOwnedApplicationPolicyRoot as (
      policyId: string,
    ) => unknown;
    expect(() => unsafeRoot("unknown-policy")).toThrow(
      /unknown reaction-owned application policy/,
    );
    const unsafeBinding =
      resolveReactionOwnedApplicationBindingForPolicy as unknown as (
        policyId: string,
        sourceKind: string,
        element?: string,
      ) => unknown;
    expect(() =>
      unsafeBinding(GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID, "overload"),
    ).toThrow(/unknown reaction-owned application source kind/);
    expect(() =>
      unsafeBinding(
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ID,
        "swirl-propagation",
        "anemo",
      ),
    ).toThrow(/unknown swirl-propagation application element/);
  });

  it("deep-freezes both historical and current policy graphs", () => {
    for (const [profile, root] of [
      [
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_PROFILE,
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
      ],
      [
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_PROFILE,
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_ROOT,
      ],
    ] as const) {
      expect(Object.isFrozen(profile)).toBe(true);
      expect(Object.isFrozen(profile.bindings)).toBe(true);
      expect(
        profile.bindings.every(
          (binding) => Object.isFrozen(binding) && Object.isFrozen(binding.gauge),
        ),
      ).toBe(true);
      expect(Object.isFrozen(root)).toBe(true);
      expect(Object.isFrozen(root.elementalApplicationRootRef)).toBe(true);
    }
  });

  it("pins independent canonical v2 bytes and content SHA", () => {
    const payload = canonicalReactionOwnedApplicationPolicyV2PayloadJson();
    expect(JSON.parse(payload)).toEqual(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_PROFILE,
    );
    expect(payload).toBe(canonicalReactionOwnedApplicationPolicyPayloadJson());
    expect(Buffer.byteLength(payload)).toBe(2939);
    expect(GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_CONTENT_SHA256).toBe(
      "sha256:9b3b07731d49ebf8abb445708c3edb99b3ce8c3c7465ce5ca02b0a7c8092a660",
    );
    expect(sha256(payload)).toBe(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_V2_CONTENT_SHA256,
    );
  });
});
