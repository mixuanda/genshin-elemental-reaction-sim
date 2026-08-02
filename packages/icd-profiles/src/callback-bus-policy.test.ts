import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  CALLBACK_BUS_POLICY_VERSION,
  canonicalCallbackBusPolicyPayloadJson,
  canonicalGcsimCallbackBusPolicyV2PayloadJson,
  canonicalLegacyCallbackBusPolicyV1PayloadJson,
  GCSIM_CALLBACK_BUS_EVENT_KINDS,
  GCSIM_CALLBACK_BUS_PHASE_ORDER,
  GCSIM_CALLBACK_BUS_POLICY_CONTENT_SHA256,
  GCSIM_CALLBACK_BUS_POLICY_ID,
  GCSIM_CALLBACK_BUS_POLICY_MODE,
  GCSIM_CALLBACK_BUS_POLICY_PROFILE,
  GCSIM_CALLBACK_BUS_POLICY_ROOT,
  GCSIM_CALLBACK_BUS_POLICY_V2_CONTENT_SHA256,
  GCSIM_CALLBACK_BUS_POLICY_V2_ID,
  GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
  GCSIM_CALLBACK_BUS_POLICY_V2_PROFILE,
  GCSIM_CALLBACK_BUS_POLICY_V2_ROOT,
  GCSIM_CALLBACK_BUS_POLICY_V2_SOURCE_REVISION,
  LEGACY_CALLBACK_BUS_POLICY_V1_CONTENT_SHA256,
  LEGACY_CALLBACK_BUS_POLICY_V1_ID,
  LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
  LEGACY_CALLBACK_BUS_POLICY_V1_PROFILE,
  LEGACY_CALLBACK_BUS_POLICY_V1_ROOT,
  resolveCallbackBusPolicyRoot,
  type CallbackBusPolicyRoot,
  type GcsimCallbackBusEventKind,
  type GcsimCallbackBusPolicyV2Root,
  type LegacyCallbackBusPolicyV1Root,
} from "./index";

const sha256 = (payload: string): string =>
  `sha256:${createHash("sha256").update(payload).digest("hex")}`;

describe("versioned callback-bus policy roots", () => {
  it("freezes V1 as the legacy absence of a versioned callback bus", () => {
    expect(LEGACY_CALLBACK_BUS_POLICY_V1_PROFILE).toEqual({
      version: "1.0.0",
      policyId: "legacy-no-versioned-callback-bus-v1",
      mode: "legacy-no-versioned-callback-bus-v1",
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
        mechanicsDataStatus: "legacy-project-absent",
        sourceProject: "genshin-dps-lab",
        sourceRevision: "genshin-dps-lab-1.52.0-local-baseline",
        pinnedGcsimReference: false,
        officialServerTruth: false,
        completeGcsimParity: false,
        coverage: "legacy-absence-of-versioned-callback-dispatch-only",
        provisional: true,
      },
    });
    expect(LEGACY_CALLBACK_BUS_POLICY_V1_ROOT).toMatchObject({
      mode: LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
      implementationStatus: "absent",
      eventKinds: [],
      dispatchDisposition: "none",
      subscriberLifecycleDisposition: "none",
      pinnedGcsimReference: false,
    });

    const typedRoot: LegacyCallbackBusPolicyV1Root =
      LEGACY_CALLBACK_BUS_POLICY_V1_ROOT;
    expect(typedRoot.policyId).toBe(LEGACY_CALLBACK_BUS_POLICY_V1_ID);
  });

  it("pins the five Freeze Broken callback phases and their timing", () => {
    const typedKinds: readonly GcsimCallbackBusEventKind[] =
      GCSIM_CALLBACK_BUS_EVENT_KINDS;
    expect(typedKinds).toEqual([
      "on-aura-durability-depleted",
      "on-apply-attack",
      "on-enemy-hit",
      "on-enemy-damage",
      "attack-callback",
    ]);
    expect(GCSIM_CALLBACK_BUS_PHASE_ORDER).toEqual([
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
    ]);
    expect(GCSIM_CALLBACK_BUS_POLICY_V2_PROFILE).toMatchObject({
      version: "2.0.0",
      policyId:
        "gcsim-b4ae769-versioned-callback-bus-normalized-provisional-v2",
      mode: "fixed-gcsim-versioned-callback-bus-v2",
      implementationStatus: "typed-deterministic-normalized-provisional",
      dispatchSurface: "freeze-broken-attack-only",
      eventKinds: typedKinds,
      phaseOrder: GCSIM_CALLBACK_BUS_PHASE_ORDER,
      dispatchAudit: {
        cardinality:
          "five-phase-records-per-eligible-freeze-broken-transition",
        zeroSubscriberDisposition: "record-phase-with-zero-deliveries",
        deliveryOrdering: "active-slot-insertion-order",
        deliveryCardinality: "at-most-once-per-active-slot-per-phase",
      },
      referenceBehavior: {
        freezeBrokenComputedDamage: 0,
        freezeBrokenCritRngDraws: 1,
        freezeBrokenAttackCallbacksSupplied: false,
      },
    });
  });

  it("specifies deterministic subscriber slots, replacement, and tombstones", () => {
    expect(
      GCSIM_CALLBACK_BUS_POLICY_V2_PROFILE.subscriberLifecycle,
    ).toEqual({
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
    });
    expect(GCSIM_CALLBACK_BUS_POLICY_V2_ROOT).toMatchObject({
      deliveryOrdering: "active-slot-insertion-order",
      duplicateKeyDisposition:
        "replace-handler-in-original-slot-without-reordering",
      unsubscribeDisposition: "set-handler-null-and-retain-slot-tombstone",
      mutationDuringDispatchDisposition: "reject",
      reentrantDispatchDisposition: "reject",
    });

    const typedRoot: GcsimCallbackBusPolicyV2Root =
      GCSIM_CALLBACK_BUS_POLICY_V2_ROOT;
    expect(typedRoot.eventKinds).toHaveLength(5);
  });

  it("makes the no-RNG/no-DamageEvent normalization and deviations explicit", () => {
    expect(
      GCSIM_CALLBACK_BUS_POLICY_V2_PROFILE.localNormalization,
    ).toEqual({
      callbackArgumentsDisposition: "readonly-typed-freeze-broken-context",
      subscriberReturnDisposition: "structured-audit-outcome-only",
      stateMutationAuthority: "none-in-callback-bus-v2",
      rngDisposition: "consume-none",
      damageEventDisposition: "emit-none",
      syntheticDamageDisposition: "emit-none",
      impulseDisposition:
        "record-no-impulse-field-without-enemy-physics-implementation",
    });
    expect(
      GCSIM_CALLBACK_BUS_POLICY_V2_PROFILE.intentionalDeviations,
    ).toEqual([
      "reject-subscription-mutation-during-dispatch",
      "reject-reentrant-dispatch",
      "consume-no-freeze-broken-crit-rng",
      "emit-no-freeze-broken-damage-event",
      "audit-empty-attack-callback-phase",
      "expose-readonly-context-and-structured-outcomes-only",
    ]);
    expect(GCSIM_CALLBACK_BUS_POLICY_V2_ROOT).toMatchObject({
      rngDisposition: "consume-none",
      damageEventDisposition: "emit-none",
      intentionalDeviations:
        GCSIM_CALLBACK_BUS_POLICY_V2_PROFILE.intentionalDeviations,
    });
  });

  it("makes V2 current and resolves both discriminated roots fail-closed", () => {
    expect(CALLBACK_BUS_POLICY_VERSION).toBe("2.0.0");
    expect(GCSIM_CALLBACK_BUS_POLICY_ID).toBe(
      GCSIM_CALLBACK_BUS_POLICY_V2_ID,
    );
    expect(GCSIM_CALLBACK_BUS_POLICY_MODE).toBe(
      GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
    );
    expect(GCSIM_CALLBACK_BUS_POLICY_PROFILE).toBe(
      GCSIM_CALLBACK_BUS_POLICY_V2_PROFILE,
    );
    expect(GCSIM_CALLBACK_BUS_POLICY_ROOT).toBe(
      GCSIM_CALLBACK_BUS_POLICY_V2_ROOT,
    );
    expect(GCSIM_CALLBACK_BUS_POLICY_CONTENT_SHA256).toBe(
      GCSIM_CALLBACK_BUS_POLICY_V2_CONTENT_SHA256,
    );

    const roots: CallbackBusPolicyRoot[] = [
      resolveCallbackBusPolicyRoot(LEGACY_CALLBACK_BUS_POLICY_V1_ID),
      resolveCallbackBusPolicyRoot(GCSIM_CALLBACK_BUS_POLICY_V2_ID),
    ];
    expect(roots).toEqual([
      LEGACY_CALLBACK_BUS_POLICY_V1_ROOT,
      GCSIM_CALLBACK_BUS_POLICY_V2_ROOT,
    ]);
    expect(() => resolveCallbackBusPolicyRoot("unknown-callback-bus")).toThrow(
      /unknown callback bus policy/,
    );
  });

  it("pins both canonical payloads to independent literal SHA-256 values", () => {
    const v1Payload = canonicalLegacyCallbackBusPolicyV1PayloadJson();
    const v2Payload = canonicalGcsimCallbackBusPolicyV2PayloadJson();
    expect(JSON.parse(v1Payload)).toEqual(
      LEGACY_CALLBACK_BUS_POLICY_V1_PROFILE,
    );
    expect(JSON.parse(v2Payload)).toEqual(
      GCSIM_CALLBACK_BUS_POLICY_V2_PROFILE,
    );
    expect(Buffer.byteLength(v1Payload)).toBe(1003);
    expect(Buffer.byteLength(v2Payload)).toBe(4858);
    expect(sha256(v1Payload)).toBe(
      LEGACY_CALLBACK_BUS_POLICY_V1_CONTENT_SHA256,
    );
    expect(sha256(v2Payload)).toBe(
      GCSIM_CALLBACK_BUS_POLICY_V2_CONTENT_SHA256,
    );
    expect(canonicalCallbackBusPolicyPayloadJson()).toBe(v2Payload);
  });

  it("deep-freezes profiles and roots and rejects mutation attacks", () => {
    const assertDeepFrozen = (value: unknown): void => {
      if (value === null || typeof value !== "object") return;
      expect(Object.isFrozen(value)).toBe(true);
      for (const child of Object.values(value)) assertDeepFrozen(child);
    };

    for (const value of [
      LEGACY_CALLBACK_BUS_POLICY_V1_PROFILE,
      LEGACY_CALLBACK_BUS_POLICY_V1_ROOT,
      GCSIM_CALLBACK_BUS_POLICY_V2_PROFILE,
      GCSIM_CALLBACK_BUS_POLICY_V2_ROOT,
    ]) {
      assertDeepFrozen(value);
    }

    expect(() => {
      (GCSIM_CALLBACK_BUS_EVENT_KINDS as unknown as string[]).push(
        "on-target-died",
      );
    }).toThrow(TypeError);
    expect(() => {
      (
        GCSIM_CALLBACK_BUS_POLICY_V2_PROFILE.subscriberLifecycle as {
          reentrantDispatchDisposition: string;
        }
      ).reentrantDispatchDisposition = "allow";
    }).toThrow(TypeError);
    expect(() => {
      (
        GCSIM_CALLBACK_BUS_POLICY_V2_ROOT
          .intentionalDeviations as unknown as string[]
      )[0] = "none";
    }).toThrow(TypeError);
  });

  it("pins provenance while excluding Mona, physics, and parity overclaims", () => {
    expect(GCSIM_CALLBACK_BUS_POLICY_V2_SOURCE_REVISION).toBe(
      "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
    );
    expect(GCSIM_CALLBACK_BUS_POLICY_V2_PROFILE.provenance).toEqual({
      mechanicsDataStatus: "fixed-gcsim-normalized-provisional",
      sourceProject: "genshinsim/gcsim",
      sourceRevision: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
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
      coverage:
        "freeze-broken-five-phase-callback-dispatch-and-subscriber-lifecycle-only",
      provisional: true,
    });
    expect(
      GCSIM_CALLBACK_BUS_POLICY_V2_PROFILE.scope.excludedMechanics,
    ).toEqual(
      expect.arrayContaining([
        "mona-bubble-status-and-pop-effects",
        "enemy-impulse-and-general-physics",
        "general-character-and-enemy-event-surface",
        "official-live-server-callback-ordering",
        "complete-gcsim-event-task-attack-and-rng-parity",
      ]),
    );
    expect(GCSIM_CALLBACK_BUS_POLICY_V2_ROOT).toMatchObject({
      officialServerTruth: false,
      completeGcsimParity: false,
      provisional: true,
    });
  });
});
