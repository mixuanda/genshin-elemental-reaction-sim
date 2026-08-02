import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  canonicalFreezeBrokenAttackPolicyPayloadJson,
  canonicalGcsimFreezeBrokenAttackPolicyV2PayloadJson,
  canonicalLegacyFreezeBrokenAttackPolicyV1PayloadJson,
  FREEZE_BROKEN_ATTACK_POLICY_VERSION,
  GCSIM_FREEZE_BROKEN_ATTACK_EXCLUDED_REACTION_SOURCES,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_CONTENT_SHA256,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_PROFILE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_ROOT,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_CONTENT_SHA256,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_SOURCE_REVISION,
  GCSIM_FREEZE_BROKEN_ATTACK_TRIGGER_SOURCES,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_CONTENT_SHA256,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_PROFILE,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT,
  resolveFreezeBrokenAttackPolicyRoot,
  type FreezeBrokenAttackPolicyRoot,
  type GcsimFreezeBrokenAttackPolicyV2Root,
  type LegacyFreezeBrokenAttackPolicyV1Root,
} from "./index";

const sha256 = (payload: string): string =>
  `sha256:${createHash("sha256").update(payload).digest("hex")}`;

describe("versioned Freeze Broken attack policy roots", () => {
  it("freezes V1 as the legacy behavior with no callback", () => {
    expect(LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_PROFILE).toEqual({
      version: "1.0.0",
      policyId: "legacy-no-freeze-broken-attack-callback-v1",
      mode: "legacy-no-freeze-broken-attack-callback",
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
        mechanicsDataStatus: "legacy-project-absent",
        sourceProject: "genshin-dps-lab",
        sourceRevision: "genshin-dps-lab-1.51.0-local-baseline",
        pinnedGcsimReference: false,
        officialServerTruth: false,
        completeGcsimParity: false,
        coverage: "legacy-no-freeze-broken-callback-only",
        provisional: true,
      },
    });
    expect(LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT).toMatchObject({
      callbackDisposition: "none",
      triggerSources: [],
      damageEventDisposition: "none",
      pinnedGcsimReference: false,
      officialServerTruth: false,
      completeGcsimParity: false,
    });

    const typedRoot: LegacyFreezeBrokenAttackPolicyV1Root =
      LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT;
    expect(typedRoot.callbackDisposition).toBe("none");
  });

  it("pins only the five checkFreeze sources and explicitly excludes Melt and Superconduct", () => {
    expect(GCSIM_FREEZE_BROKEN_ATTACK_TRIGGER_SOURCES).toEqual([
      "natural-decay",
      "poise",
      "shatter",
      "swirl-frozen",
      "crystallize-frozen",
    ]);
    expect(GCSIM_FREEZE_BROKEN_ATTACK_EXCLUDED_REACTION_SOURCES).toEqual([
      "melt",
      "superconduct",
    ]);
    expect(GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE).toMatchObject({
      triggerSources: GCSIM_FREEZE_BROKEN_ATTACK_TRIGGER_SOURCES,
      excludedReactionSources:
        GCSIM_FREEZE_BROKEN_ATTACK_EXCLUDED_REACTION_SOURCES,
      scope: {
        excludedMechanics: expect.arrayContaining([
          "melt-as-freeze-broken-trigger",
          "superconduct-as-freeze-broken-trigger",
        ]),
      },
    });
    expect(
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE.triggerSources,
    ).not.toContain("melt");
    expect(
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE.triggerSources,
    ).not.toContain("superconduct");
  });

  it("records the pinned synthetic attack, dead DoNotLog field, and ZeroDur duplicate boundary", () => {
    expect(GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE).toMatchObject({
      version: "2.0.0",
      policyId:
        "gcsim-b4ae769-freeze-broken-attack-normalized-provisional-v2",
      mechanicsStatus: "partial",
      callbackSurface:
        "audit-only-until-callback-bus-bubble-and-impulse-implementation",
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
          transitionGuard: "absent",
          verificationStatus: "reproduced-at-pinned-revision",
        },
      },
      provenance: {
        sourceProject: "genshinsim/gcsim",
        sourceRevision: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
      },
    });
    expect(
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE.referenceBehavior
        .observableSequence,
    ).toEqual([
      "on-aura-durability-depleted-frozen",
      "on-apply-attack-freeze-broken",
      "on-enemy-hit-freeze-broken",
      "damage-log-freeze-broken",
      "on-enemy-damage-freeze-broken-zero",
    ]);
  });

  it("records but does not dispatch the planned exactly-once non-damage callback", () => {
    expect(
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE.localNormalization,
    ).toEqual({
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
    });
    expect(GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT).toMatchObject({
      mechanicsStatus: "partial",
      callbackSurface:
        "audit-only-until-callback-bus-bubble-and-impulse-implementation",
      callbackDisposition: "reference-audit-only-not-dispatched",
      executionStatus: "reference-audit-only-not-dispatched",
      auditDisposition: "reference-audit-only-not-dispatched",
      plannedCallbackCardinality:
        "exactly-once-per-positive-to-depleted-transition",
      normalizedDepletionThreshold: 0.0000000001,
      normalizedDepletionComparator: "positive-to-less-than-or-equal",
      rngDisposition: "consume-none",
      damageEventDisposition: "emit-none",
      intentionalDeviations: [
        "collapse-zero-durability-duplicate-to-exactly-once",
        "consume-no-crit-rng",
        "emit-no-synthetic-damage-event",
        "normalize-depletion-threshold-from-1e-11-to-1e-10",
        "callback-subscriber-side-effects-unimplemented",
        "mona-bubble-and-impulse-bus-unimplemented",
      ],
    });

    const typedRoot: GcsimFreezeBrokenAttackPolicyV2Root =
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT;
    expect(typedRoot.intentionalDeviations).toHaveLength(6);
  });

  it("makes V2 current while resolving both discriminated roots fail-closed", () => {
    expect(FREEZE_BROKEN_ATTACK_POLICY_VERSION).toBe("2.0.0");
    expect(GCSIM_FREEZE_BROKEN_ATTACK_POLICY_ID).toBe(
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
    );
    expect(GCSIM_FREEZE_BROKEN_ATTACK_POLICY_PROFILE).toBe(
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE,
    );
    expect(GCSIM_FREEZE_BROKEN_ATTACK_POLICY_ROOT).toBe(
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
    );
    expect(GCSIM_FREEZE_BROKEN_ATTACK_POLICY_CONTENT_SHA256).toBe(
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_CONTENT_SHA256,
    );

    const v1 = resolveFreezeBrokenAttackPolicyRoot(
      LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
    );
    const v2 = resolveFreezeBrokenAttackPolicyRoot(
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
    );
    const roots: FreezeBrokenAttackPolicyRoot[] = [v1, v2];
    expect(roots).toEqual([
      LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT,
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
    ]);
    expect(() =>
      resolveFreezeBrokenAttackPolicyRoot("unknown-freeze-broken-policy"),
    ).toThrow(/unknown Freeze Broken attack policy/);
  });

  it("pins canonical payloads to independent literal SHA-256 values", () => {
    const v1Payload =
      canonicalLegacyFreezeBrokenAttackPolicyV1PayloadJson();
    const v2Payload =
      canonicalGcsimFreezeBrokenAttackPolicyV2PayloadJson();
    expect(JSON.parse(v1Payload)).toEqual(
      LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_PROFILE,
    );
    expect(JSON.parse(v2Payload)).toEqual(
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE,
    );
    expect(Buffer.byteLength(v1Payload)).toBe(832);
    expect(Buffer.byteLength(v2Payload)).toBe(4302);
    expect(sha256(v1Payload)).toBe(
      LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_CONTENT_SHA256,
    );
    expect(sha256(v2Payload)).toBe(
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_CONTENT_SHA256,
    );
    expect(canonicalFreezeBrokenAttackPolicyPayloadJson()).toBe(v2Payload);
  });

  it("deep-freezes profiles and roots and rejects mutation attacks", () => {
    const assertDeepFrozen = (value: unknown): void => {
      if (value === null || typeof value !== "object") return;
      expect(Object.isFrozen(value)).toBe(true);
      for (const child of Object.values(value)) assertDeepFrozen(child);
    };

    for (const value of [
      LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_PROFILE,
      LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT,
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE,
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
    ]) {
      assertDeepFrozen(value);
    }

    expect(() => {
      (
        GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE.triggerSources as unknown as string[]
      ).push("melt");
    }).toThrow(TypeError);
    expect(() => {
      (
        GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE.localNormalization as {
          rngDisposition: string;
        }
      ).rngDisposition = "consume-one";
    }).toThrow(TypeError);
    expect(() => {
      (
        GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT
          .intentionalDeviations as unknown as string[]
      )[0] = "none";
    }).toThrow(TypeError);
  });

  it("refuses official-server and complete-gcsim parity claims", () => {
    for (const profile of [
      LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_PROFILE,
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE,
    ]) {
      expect(profile.provenance).toMatchObject({
        officialServerTruth: false,
        completeGcsimParity: false,
        provisional: true,
      });
    }
    expect(GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_SOURCE_REVISION).toBe(
      "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    );
    expect(
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE.provenance
        .mechanicsImplementationStatus,
    ).toBe("partial");
    expect(
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_PROFILE.scope.excludedMechanics,
    ).toEqual(
      expect.arrayContaining([
        "official-live-server-freeze-break-semantics",
        "complete-gcsim-freeze-aura-task-and-impulse-parity",
        "mona-bubble-electro-charged-live-server-parity",
        "callback-subscriber-side-effects",
        "mona-bubble-and-impulse-bus",
      ]),
    );
  });
});
