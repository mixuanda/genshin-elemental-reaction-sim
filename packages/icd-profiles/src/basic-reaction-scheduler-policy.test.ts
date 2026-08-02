import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  BASIC_REACTION_SCHEDULER_POLICY_VERSION,
  canonicalBasicReactionSchedulerPolicyPayloadJson,
  canonicalGcsimBasicReactionSchedulerPolicyV2PayloadJson,
  canonicalLegacyBasicReactionSchedulerPolicyV1PayloadJson,
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_CONTENT_SHA256,
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_ID,
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_PROFILE,
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_ROOT,
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_CONTENT_SHA256,
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_PROFILE,
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ROOT,
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_SOURCE_REVISION,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_CONTENT_SHA256,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_PROFILE,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT,
  resolveBasicReactionSchedulerPolicyRoot,
  type BasicReactionSchedulerPolicyRoot,
  type GcsimBasicReactionSchedulerPolicyV2Root,
  type LegacyBasicReactionSchedulerPolicyV1Root,
} from "./index";

const sha256 = (payload: string): string =>
  `sha256:${createHash("sha256").update(payload).digest("hex")}`;

describe("versioned basic-reaction scheduler policy roots", () => {
  it("freezes V1 as the local 1.50 partial immediate-attachment behavior without a gcsim claim", () => {
    expect(LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_PROFILE).toEqual({
      version: "1.0.0",
      policyId:
        "legacy-partial-basic-reaction-scheduler-immediate-attachment-v1",
      scheduler: {
        mode: "legacy-1.50-partial-immediate-reaction-owned-attachment",
        attackResolutionPhase: "legacy-immediate-reaction-damage-task",
        nonReactedAttachmentPhase: "immediate-within-attack-resolution",
        sameFrameOrdering:
          "legacy-partial-immediate-attachment-without-complete-provenance",
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
        mechanicsDataStatus: "legacy-project-partial",
        sourceProject: "genshin-dps-lab",
        sourceRevision: "genshin-dps-lab-1.50.0-local-baseline",
        pinnedGcsimReference: false,
        officialServerTruth: false,
        completeGcsimParity: false,
        coverage:
          "legacy-1.50-partial-reaction-owned-attachment-scheduling-only",
        provisional: true,
      },
    });
    expect(LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT).toMatchObject({
      policyId: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
      sourceProject: "genshin-dps-lab",
      pinnedGcsimReference: false,
      nonReactedAttachmentPhase: "immediate-within-attack-resolution",
      officialServerTruth: false,
      completeGcsimParity: false,
      provisional: true,
    });
    expect(
      "sourceFiles" in LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_PROFILE.provenance,
    ).toBe(false);

    const typedRoot: LegacyBasicReactionSchedulerPolicyV1Root =
      LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT;
    expect(typedRoot.pinnedGcsimReference).toBe(false);
  });

  it("pins V2 Burning and Swirl timing, deferred attachment, FIFO, and the generation-safe deviation", () => {
    expect(GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_PROFILE).toMatchObject({
      version: "2.0.0",
      policyId:
        "gcsim-b4ae769-basic-reaction-scheduler-provenance-provisional-v2",
      scheduler: {
        mode: "fixed-gcsim-normalized-provisional-scheduler-v2",
        orderingAuthority: "genshin-dps-lab-global-event-heap",
        taskPriorityPolicy: "preserve-existing-event-priority",
        samePriorityOrderingKey: [
          "frame",
          "globalInsertionEventSequence",
        ],
        samePriorityOrdering: "fifo",
        sameFrameOrdering:
          "same-priority-frame-and-global-insertion-event-sequence-fifo",
      },
      burning: {
        streamOwner: "receiving-enemy-target",
        tickIntervalFrames: 15,
        skippedTickSlot: 9,
        tickAoe: {
          delayFrames: 0,
          radius: 1,
          fanoutOrder: "enemy-registration-order",
        },
        cascadeStream: {
          firstTickDelayFrames: 15,
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
        sourceTargetHit: { delayFrames: 1 },
        propagationAoe: {
          delayFrames: 5,
          radius: 5,
          excludeSourceTarget: true,
        },
        queueGcd: {
          frames: 6,
          scopeKeyFields: ["receivingTargetId", "swirledElement"],
        },
        hydroPropagation: {
          damageDisposition: "zero-damage",
          gaugeDisposition: "propagate-derived-gauge",
        },
      },
      provenance: {
        sourceProject: "genshinsim/gcsim",
        sourceRevision: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
        normalization:
          "local-versioned-event-heap-projection-with-explicit-deviations",
        officialServerTruth: false,
        completeGcsimParity: false,
        provisional: true,
      },
    });
    expect(GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ROOT).toMatchObject({
      policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
      sourceRevision:
        GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_SOURCE_REVISION,
      pinnedGcsimReference: true,
      attackResolutionPhase: "immediate-core-task",
      nonReactedAttachmentPhase: "deferred-zero-delay-core-task",
      intentionalDeviations: ["burning-monotonic-generation-guard"],
      officialServerTruth: false,
      completeGcsimParity: false,
      provisional: true,
    });

    const typedRoot: GcsimBasicReactionSchedulerPolicyV2Root =
      GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ROOT;
    expect(typedRoot.intentionalDeviations).toHaveLength(1);
  });

  it("makes V2 current while resolving both discriminated root types fail-closed", () => {
    expect(BASIC_REACTION_SCHEDULER_POLICY_VERSION).toBe("2.0.0");
    expect(GCSIM_BASIC_REACTION_SCHEDULER_POLICY_ID).toBe(
      GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
    );
    expect(GCSIM_BASIC_REACTION_SCHEDULER_POLICY_PROFILE).toBe(
      GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_PROFILE,
    );
    expect(GCSIM_BASIC_REACTION_SCHEDULER_POLICY_ROOT).toBe(
      GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ROOT,
    );
    expect(GCSIM_BASIC_REACTION_SCHEDULER_POLICY_CONTENT_SHA256).toBe(
      GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_CONTENT_SHA256,
    );

    const v1: LegacyBasicReactionSchedulerPolicyV1Root =
      resolveBasicReactionSchedulerPolicyRoot(
        LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
      );
    const v2: GcsimBasicReactionSchedulerPolicyV2Root =
      resolveBasicReactionSchedulerPolicyRoot(
        GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
      );
    const roots: BasicReactionSchedulerPolicyRoot[] = [v1, v2];
    expect(v1).toBe(LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT);
    expect(v2).toBe(GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ROOT);
    expect(roots.map(({ policyId }) => policyId)).toEqual([
      LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
      GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
    ]);

    const unsafeResolver = resolveBasicReactionSchedulerPolicyRoot as (
      policyId: string,
    ) => unknown;
    expect(() => unsafeResolver("unknown-scheduler-policy")).toThrow(
      /unknown basic reaction scheduler policy/,
    );
  });

  it("pins both canonical payloads to independent literal SHA-256 values", () => {
    const v1Payload =
      canonicalLegacyBasicReactionSchedulerPolicyV1PayloadJson();
    const v2Payload =
      canonicalGcsimBasicReactionSchedulerPolicyV2PayloadJson();
    expect(JSON.parse(v1Payload)).toEqual(
      LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_PROFILE,
    );
    expect(JSON.parse(v2Payload)).toEqual(
      GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_PROFILE,
    );
    expect(Buffer.byteLength(v1Payload)).toBe(1369);
    expect(Buffer.byteLength(v2Payload)).toBe(3441);
    expect(sha256(v1Payload)).toBe(
      LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_CONTENT_SHA256,
    );
    expect(sha256(v2Payload)).toBe(
      GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_CONTENT_SHA256,
    );
    expect(canonicalBasicReactionSchedulerPolicyPayloadJson()).toBe(v2Payload);
  });

  it("deep-freezes both graphs and rejects mutation attacks", () => {
    const assertDeepFrozen = (value: unknown): void => {
      if (value === null || typeof value !== "object") return;
      expect(Object.isFrozen(value)).toBe(true);
      for (const child of Object.values(value)) assertDeepFrozen(child);
    };

    for (const value of [
      LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_PROFILE,
      LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT,
      GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_PROFILE,
      GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ROOT,
    ]) {
      assertDeepFrozen(value);
    }

    expect(() => {
      (
        LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_PROFILE.scheduler as {
          nonReactedAttachmentPhase: string;
        }
      ).nonReactedAttachmentPhase = "deferred-zero-delay-core-task";
    }).toThrow(TypeError);
    expect(() => {
      (
        GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_PROFILE.burning as {
          tickIntervalFrames: number;
        }
      ).tickIntervalFrames = 14;
    }).toThrow(TypeError);
    expect(() => {
      (
        GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_PROFILE.swirl
          .dispatchOrder as unknown as string[]
      ).push("geo");
    }).toThrow(TypeError);
    expect(() => {
      (
        GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ROOT
          .intentionalDeviations as unknown as string[]
      )[0] = "none";
    }).toThrow(TypeError);
  });

  it("keeps V1/V2 scope orthogonal to application ICD and refuses parity overclaims", () => {
    for (const profile of [
      LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_PROFILE,
      GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_PROFILE,
    ]) {
      expect(profile.scope.includedReactions).toEqual(["burning", "swirl"]);
      expect(profile.relationToReactionOwnedApplicationPolicy).toBe(
        "orthogonal-scheduler-selector-does-not-select-or-replace-application-icd-policy",
      );
      expect(profile.provenance).toMatchObject({
        officialServerTruth: false,
        completeGcsimParity: false,
        provisional: true,
      });
      expect(profile.scope.excludedMechanics).toContain("lunar-reactions");
    }
    expect(
      LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_PROFILE.scope
        .excludedMechanics,
    ).toContain("pinned-gcsim-scheduler-provenance");
    expect(
      GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_PROFILE.scope
        .excludedMechanics,
    ).toContain("complete-gcsim-enemy-character-core-task-tier-parity");
    expect(
      GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_PROFILE.scope
        .includedMechanics,
    ).toEqual([
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
    ]);
    expect(
      GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_PROFILE.provenance.sourceFiles,
    ).toEqual([
      "pkg/reactable/burning.go",
      "pkg/reactable/swirl.go",
      "pkg/enemy/hitlag.go",
      "pkg/enemy/attack.go",
      "pkg/core/attack.go",
      "pkg/core/combat/attack.go",
      "pkg/core/task/task.go",
      "pkg/target/target.go",
    ]);
  });
});
