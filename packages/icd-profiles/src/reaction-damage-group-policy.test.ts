import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  canonicalReactionDamageGroupPolicyPayloadJson,
  canonicalReactionDamageGroupPolicyV1PayloadJson,
  canonicalReactionDamageGroupPolicyV2PayloadJson,
  GCSIM_DAMAGE_GROUP_ROOT,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_CONTENT_SHA256,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_MODE,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_PROFILE,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_ROOT,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_SOURCE_REVISION,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_CONTENT_SHA256,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_MODE,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_PROFILE,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_CONTENT_SHA256,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_MODE,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_PROFILE,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ROOT,
  REACTION_DAMAGE_GROUP_POLICY_VERSION,
  REACTION_DAMAGE_GROUP_POLICY_V2_VERSION,
  resolveDamageGroup,
  resolveReactionDamageGroupBinding,
  resolveReactionDamageGroupBindingForPolicy,
  resolveReactionDamageGroupPolicyRoot,
  resolveReactionDamageGroupPolicyRootForMode,
  resolveReactionDamageGroupResetFrame,
  type GcsimReactionDamageGroupPolicyRoot,
  type GcsimReactionDamageGroupPolicyV1Root,
  type GcsimReactionDamageGroupPolicyV2Root,
} from "./index";

const EXPECTED_BINDINGS = [
  {
    reaction: "swirlPyro",
    damageElement: "pyro",
    attackTag: "AttackTagSwirlPyro",
    icdTag: "ICDTagSwirlPyro",
    groupId: "reaction-a",
  },
  {
    reaction: "swirlHydro",
    damageElement: "hydro",
    attackTag: "AttackTagSwirlHydro",
    icdTag: "ICDTagSwirlHydro",
    groupId: "reaction-a",
  },
  {
    reaction: "swirlCryo",
    damageElement: "cryo",
    attackTag: "AttackTagSwirlCryo",
    icdTag: "ICDTagSwirlCryo",
    groupId: "reaction-a",
  },
  {
    reaction: "swirlElectro",
    damageElement: "electro",
    attackTag: "AttackTagSwirlElectro",
    icdTag: "ICDTagSwirlElectro",
    groupId: "reaction-a",
  },
  {
    reaction: "shatter",
    damageElement: "physical",
    attackTag: "AttackTagShatter",
    icdTag: "ICDTagShatter",
    groupId: "reaction-a",
  },
  {
    reaction: "superconduct",
    damageElement: "cryo",
    attackTag: "AttackTagSuperconductDamage",
    icdTag: "ICDTagSuperconductDamage",
    groupId: "reaction-a",
  },
  {
    reaction: "bloom",
    damageElement: "dendro",
    attackTag: "AttackTagBloom",
    icdTag: "ICDTagBloomDamage",
    groupId: "reaction-a",
  },
  {
    reaction: "burgeon",
    damageElement: "dendro",
    attackTag: "AttackTagBurgeon",
    icdTag: "ICDTagBurgeonDamage",
    groupId: "reaction-a",
  },
  {
    reaction: "hyperbloom",
    damageElement: "dendro",
    attackTag: "AttackTagHyperbloom",
    icdTag: "ICDTagHyperbloomDamage",
    groupId: "reaction-a",
  },
  {
    reaction: "overload",
    damageElement: "pyro",
    attackTag: "AttackTagOverloadDamage",
    icdTag: "ICDTagOverloadDamage",
    groupId: "reaction-b",
  },
  {
    reaction: "electroCharged",
    damageElement: "electro",
    attackTag: "AttackTagECDamage",
    icdTag: "ICDTagECDamage",
    groupId: "reaction-b",
  },
].map((binding) => ({
  ...binding,
  durability: 0 as const,
  applicationDisposition: "none" as const,
  damageSourceInScopeKey: false as const,
})) as readonly {
  reaction: string;
  damageElement: string;
  attackTag: string;
  icdTag: string;
  groupId: "reaction-a" | "reaction-b";
  durability: 0;
  applicationDisposition: "none";
  damageSourceInScopeKey: false;
}[];

const sha256 = (payload: string): string =>
  `sha256:${createHash("sha256").update(payload).digest("hex")}`;

describe("gcsim ReactionA/B damage-group reset policy roots", () => {
  it("pins the complete ReactionA and ReactionB mapping to the existing damage-group root", () => {
    for (const profile of [
      GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_PROFILE,
      GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_PROFILE,
    ]) {
      expect(profile.bindings).toEqual(EXPECTED_BINDINGS);
      expect(profile.damageGroupRootRef).toEqual({
        version: GCSIM_DAMAGE_GROUP_ROOT.version,
        profileId: GCSIM_DAMAGE_GROUP_ROOT.profileId,
        contentHash: GCSIM_DAMAGE_GROUP_ROOT.contentHash,
        sourceRevision: GCSIM_DAMAGE_GROUP_ROOT.sourceRevision,
        tailPolicy: GCSIM_DAMAGE_GROUP_ROOT.tailPolicy,
        resetSchedulePolicy: GCSIM_DAMAGE_GROUP_ROOT.resetSchedulePolicy,
      });
    }

    expect(
      EXPECTED_BINDINGS.filter(({ groupId }) => groupId === "reaction-a").map(
        ({ reaction }) => reaction,
      ),
    ).toEqual([
      "swirlPyro",
      "swirlHydro",
      "swirlCryo",
      "swirlElectro",
      "shatter",
      "superconduct",
      "bloom",
      "burgeon",
      "hyperbloom",
    ]);
    expect(
      EXPECTED_BINDINGS.filter(({ groupId }) => groupId === "reaction-b").map(
        ({ reaction }) => reaction,
      ),
    ).toEqual(["overload", "electroCharged"]);
    expect(resolveDamageGroup("reaction-a")).toMatchObject({
      resetFrames: 30,
      damageSequence: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(resolveDamageGroup("reaction-b")).toMatchObject({
      resetFrames: 30,
      damageSequence: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(GCSIM_REACTION_DAMAGE_GROUP_POLICY_SOURCE_REVISION).toBe(
      GCSIM_DAMAGE_GROUP_ROOT.sourceRevision,
    );
  });

  it("freezes V1 as the legacy F30 lazy half-open-window boundary", () => {
    expect(GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_PROFILE).toMatchObject({
      version: "1.0.0",
      policyId:
        "gcsim-b4ae769-reaction-damage-group-legacy-window-provisional-v1",
      mode: "legacy-reaction-damage-group-window-v1",
      resetBoundary: "lazy-attempt-window-check",
      scopeKeyFields: ["receivingTargetId", "sourceActorId", "icdTag"],
      damageSourceInScopeKey: false,
      resetSchedulePolicy:
        "legacy-lazy-reset-before-attempt-at-window-start-plus-reset-frames",
      resetFrameOffsetAdjustment: 0,
      sameFrameOrdering:
        "provisional-lazy-attempt-boundary-without-scheduler-provenance",
      boundaryExample: {
        windowStartFrame: 0,
        resetFrames: 30,
        resetFrame: 30,
        firstAttemptEligibleForNewWindowFrame: 30,
      },
      provisional: true,
      provenance: {
        timingSource: "legacy-genshin-dps-lab-half-open-window",
        schedulerProvenance: "provisional-not-complete",
        officialServerTruth: false,
        completeGcsimParity: false,
        provisional: true,
      },
    });
    expect(
      resolveReactionDamageGroupResetFrame(
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
        "shatter",
        0,
      ),
    ).toBe(30);
    expect(
      resolveReactionDamageGroupResetFrame(
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
        "electroCharged",
        100,
      ),
    ).toBe(130);
  });

  it("pins V2 to the F29 reset task while leaving same-frame execution order provisional", () => {
    expect(GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_PROFILE).toMatchObject({
      version: "2.0.0",
      policyId: "gcsim-b4ae769-reaction-damage-group-task-order-provisional-v2",
      mode: "fixed-gcsim-reaction-damage-task-order-v2",
      resetBoundary: "scheduled-reset-task",
      scopeKeyFields: ["receivingTargetId", "sourceActorId", "icdTag"],
      damageSourceInScopeKey: false,
      resetSchedulePolicy:
        "scheduled-reset-task-at-window-start-plus-reset-frames-minus-one",
      resetFrameOffsetAdjustment: -1,
      sameFrameOrdering: "provisional-insertion-and-event-sequence-dependent",
      boundaryExample: {
        windowStartFrame: 0,
        resetFrames: 30,
        resetTaskFrame: 29,
        sameFrameOutcome: "insertion-and-event-sequence-dependent",
      },
      provisional: true,
      provenance: {
        timingSource: "pinned-gcsim-damage-group-reset-task",
        schedulerProvenance: "provisional-not-complete",
        officialServerTruth: false,
        completeGcsimParity: false,
        provisional: true,
      },
    });
    expect(
      resolveReactionDamageGroupResetFrame(
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
        "swirlPyro",
        0,
      ),
    ).toBe(29);
    expect(
      resolveReactionDamageGroupResetFrame(
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
        "overload",
        100,
      ),
    ).toBe(129);
    expect(
      GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_PROFILE.sameFrameOrdering,
    ).not.toContain("reset-before-attempt");
  });

  it("makes V2 the current alias without changing either explicit root", () => {
    expect(REACTION_DAMAGE_GROUP_POLICY_VERSION).toBe(
      REACTION_DAMAGE_GROUP_POLICY_V2_VERSION,
    );
    expect(GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID).toBe(
      GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
    );
    expect(GCSIM_REACTION_DAMAGE_GROUP_POLICY_MODE).toBe(
      GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_MODE,
    );
    expect(GCSIM_REACTION_DAMAGE_GROUP_POLICY_PROFILE).toBe(
      GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_PROFILE,
    );
    expect(GCSIM_REACTION_DAMAGE_GROUP_POLICY_ROOT).toBe(
      GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ROOT,
    );
    expect(GCSIM_REACTION_DAMAGE_GROUP_POLICY_CONTENT_SHA256).toBe(
      GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_CONTENT_SHA256,
    );

    const v1Root: GcsimReactionDamageGroupPolicyV1Root =
      GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT;
    const v2Root: GcsimReactionDamageGroupPolicyV2Root =
      GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ROOT;
    const currentRoot: GcsimReactionDamageGroupPolicyRoot =
      GCSIM_REACTION_DAMAGE_GROUP_POLICY_ROOT;
    expect(currentRoot).toBe(v2Root);
    expect(v1Root).not.toBe(v2Root);
  });

  it("resolves explicit IDs, modes, and bindings and fails closed on unknown selectors", () => {
    expect(
      resolveReactionDamageGroupPolicyRoot(
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
      ),
    ).toBe(GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT);
    expect(
      resolveReactionDamageGroupPolicyRoot(
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
      ),
    ).toBe(GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ROOT);
    expect(
      resolveReactionDamageGroupPolicyRootForMode(
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_MODE,
      ),
    ).toBe(GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT);
    expect(
      resolveReactionDamageGroupPolicyRootForMode(
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_MODE,
      ),
    ).toBe(GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ROOT);

    expect(resolveReactionDamageGroupBinding("hyperbloom")).toMatchObject({
      reaction: "hyperbloom",
      groupId: "reaction-a",
      damageElement: "dendro",
      attackTag: "AttackTagHyperbloom",
      icdTag: "ICDTagHyperbloomDamage",
      durability: 0,
      applicationDisposition: "none",
      damageSourceInScopeKey: false,
    });
    expect(
      resolveReactionDamageGroupBindingForPolicy(
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
        "electroCharged",
      ),
    ).toMatchObject({
      reaction: "electroCharged",
      groupId: "reaction-b",
      damageElement: "electro",
      attackTag: "AttackTagECDamage",
      icdTag: "ICDTagECDamage",
      durability: 0,
      applicationDisposition: "none",
      damageSourceInScopeKey: false,
    });

    const unsafeRoot = resolveReactionDamageGroupPolicyRoot as (
      policyId: string,
    ) => unknown;
    const unsafeMode = resolveReactionDamageGroupPolicyRootForMode as (
      mode: string,
    ) => unknown;
    const unsafeBinding = resolveReactionDamageGroupBindingForPolicy as (
      policyId: string,
      reaction: string,
    ) => unknown;
    const unsafeReset = resolveReactionDamageGroupResetFrame as (
      policyId: string,
      reaction: string,
      windowStartFrame: unknown,
    ) => unknown;
    expect(() => unsafeRoot("unknown-policy")).toThrow(
      /unknown reaction damage-group policy/,
    );
    expect(() => unsafeMode("unknown-mode")).toThrow(
      /unknown reaction damage-group policy mode/,
    );
    expect(() =>
      unsafeBinding(GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID, "burning"),
    ).toThrow(/unknown reaction damage-group binding/);
    expect(() => unsafeReset("unknown-policy", "overload", 0)).toThrow(
      /unknown reaction damage-group policy/,
    );
    expect(() =>
      unsafeReset(GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID, "burning", 0),
    ).toThrow(/unknown reaction damage-group binding/);
    for (const invalidFrame of [NaN, Infinity, -1, 0.5, "0", null]) {
      expect(() =>
        unsafeReset(
          GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
          "overload",
          invalidFrame,
        ),
      ).toThrow(/windowStartFrame/);
    }
    expect(() =>
      unsafeReset(
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ID,
        "overload",
        Number.MAX_SAFE_INTEGER,
      ),
    ).toThrow(/exceeds safe range/);
  });

  it("deep-freezes profiles, roots, provenance, references, and bindings", () => {
    for (const [profile, root] of [
      [
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_PROFILE,
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT,
      ],
      [
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_PROFILE,
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ROOT,
      ],
    ] as const) {
      expect(Object.isFrozen(profile)).toBe(true);
      expect(Object.isFrozen(profile.bindings)).toBe(true);
      expect(
        profile.bindings.every((binding) => Object.isFrozen(binding)),
      ).toBe(true);
      expect(Object.isFrozen(profile.boundaryExample)).toBe(true);
      expect(Object.isFrozen(profile.provenance)).toBe(true);
      expect(Object.isFrozen(profile.damageGroupRootRef)).toBe(true);
      expect(Object.isFrozen(root)).toBe(true);
      expect(Object.isFrozen(root.damageGroupRootRef)).toBe(true);
    }
  });

  it("pins independent canonical V1 and V2 payload bytes and SHA literals", () => {
    const v1Payload = canonicalReactionDamageGroupPolicyV1PayloadJson();
    const v2Payload = canonicalReactionDamageGroupPolicyV2PayloadJson();
    expect(JSON.parse(v1Payload)).toEqual(
      GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_PROFILE,
    );
    expect(JSON.parse(v2Payload)).toEqual(
      GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_PROFILE,
    );
    expect(v2Payload).toBe(canonicalReactionDamageGroupPolicyPayloadJson());
    expect(Buffer.byteLength(v1Payload)).toBe(3_755);
    expect(Buffer.byteLength(v2Payload)).toBe(3_755);
    expect(GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_CONTENT_SHA256).toBe(
      "sha256:db377845d06edaac61e92de5a9478117f2fdc79e55e920ad445a102cf9b9a3bd",
    );
    expect(GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_CONTENT_SHA256).toBe(
      "sha256:026b9728156ddd124a2d85793b80d71a1d3f3baacec8376c8ac120bf68c17346",
    );
    expect(sha256(v1Payload)).toBe(
      GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_CONTENT_SHA256,
    );
    expect(sha256(v2Payload)).toBe(
      GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_CONTENT_SHA256,
    );
  });
});
