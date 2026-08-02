import {
  GCSIM_CALLBACK_BUS_POLICY_V2_ID,
  GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE,
  LEGACY_CALLBACK_BUS_POLICY_V1_ID,
  LEGACY_CALLBACK_BUS_POLICY_V1_MODE
} from "@genshin-dps-lab/icd-profiles";
import { beforeAll, describe, expect, it } from "vitest";

import {
  defineCallbackSubscriberPluginV153,
  defineDamageModifierPlugin,
  simulate
} from "../../sim-core/src";
import { makeConfig, neutralStats } from "../../sim-core/src/__tests__/fixtures";
import { assertTrustedSimulationResultV153 } from "./result-integrity";
import {
  callbackDeliveryLogEntryV153Schema,
  callbackRegistrationLogEntryV153Schema,
  callbackSubscriberAttemptV153Schema,
  simulationResultV153Schema
} from "./result-schema";
import type {
  AbilityDefinition,
  CallbackBusEventKindV153,
  CallbackDeliveryLogEntryV153,
  SimConfig,
  SimulationResultForV153
} from "./types";
import { CALLBACK_SUBSCRIBER_OUTCOME_VERIFICATION } from "./types";
import { createSimulationReproducibilityKey } from "./reproducibility";

const OUTCOME_VERIFICATION =
  CALLBACK_SUBSCRIBER_OUTCOME_VERIFICATION;

function validRegistration() {
  return {
    id: 0,
    registryRevision: 1,
    eventKind: "on-enemy-damage-freeze-broken-zero" as const,
    subscriberKey: "freeze-audit",
    slotIndex: 0,
    operation: "subscribe" as const,
    previousSubscriptionId: null,
    currentSubscriptionId: 7,
    sourceKind: "plugin" as const,
    pluginManifestIndex: 0,
    pluginId: "test.callback-a",
    subscriberAttemptRefs: [{ callbackDeliveryLogId: 3, attemptIndex: 0 }]
  };
}

function validAttempt() {
  return {
    index: 0,
    slotIndex: 0,
    registrationLogId: 0,
    subscriptionId: 7,
    subscriberKey: "freeze-audit",
    pluginManifestIndex: 0,
    pluginId: "test.callback-a",
    status: "completed" as const,
    outcomeVerification: OUTCOME_VERIFICATION,
    outcome: {
      kind: "freeze-broken-audit" as const,
      freezeBrokenAttackLogId: 0,
      sourceFrozenStateLogId: 2
    }
  };
}

const EVENT_KINDS = [
  "on-aura-durability-depleted-frozen",
  "on-apply-attack-freeze-broken",
  "on-enemy-hit-freeze-broken",
  "on-enemy-damage-freeze-broken-zero",
  "attack-callback-freeze-broken"
] as const satisfies readonly CallbackBusEventKindV153[];

function validDelivery(eventIndex: 0 | 1 | 2 | 3 | 4): unknown {
  const common = {
    id: eventIndex,
    eventIndex,
    eventKind: EVENT_KINDS[eventIndex],
    registryRevision: 1,
    frame: 60,
    targetFrame: 58,
    timeSeconds: 1,
    targetId: "enemy-0",
    targetName: "Enemy",
    generation: 1,
    sourceFrozenStateLogId: 2,
    freezeBrokenAttackLogId: 0,
    triggerEventType: "frozenExpiry" as const,
    triggerEventPriority: 2,
    triggerEventSequence: 9,
    triggerIntraEventSequence: 4,
    eventPriority: 2,
    eventSequence: eventIndex < 3 ? 9 : 10,
    intraEventSequence: eventIndex < 3 ? eventIndex : eventIndex - 3,
    parentCallbackDeliveryLogId: eventIndex === 0 ? null : eventIndex - 1,
    subscriberAttempts: eventIndex === 3 ? [validAttempt()] : []
  };
  if (eventIndex === 0) {
    return {
      ...common,
      phase: { kind: "same-call-stack-immediate" as const },
      payload: {
        kind: "frozen-durability-depleted" as const,
        element: "frozen" as const
      }
    };
  }
  if (eventIndex === 1 || eventIndex === 2) {
    return {
      ...common,
      phase: { kind: "same-call-stack-immediate" as const },
      payload: {
        kind: "freeze-broken-attack" as const,
        ability: "Freeze Broken" as const
      }
    };
  }
  const phase = {
    kind: "zero-delay-core-task" as const,
    scheduledAfterCallbackDeliveryLogId: 2,
    taskSequence: 10,
    delayFrames: 0 as const,
    referenceRelativeToTriggerEnemyDamage: "not-applicable" as const,
    localExecutionRelativeToTriggerEvent: "after-current-event" as const
  };
  if (eventIndex === 3) {
    return {
      ...common,
      phase,
      payload: {
        kind: "freeze-broken-zero-damage" as const,
        ability: "Freeze Broken" as const,
        actualDamage: 0 as const,
        crit: null,
        rngDisposition: "not-consumed" as const
      }
    };
  }
  return {
    ...common,
    phase,
    payload: {
      kind: "freeze-broken-attack-callback" as const,
      ability: "Freeze Broken" as const,
      suppliedCallbackCount: 0 as const
    }
  };
}

function makeFreezeBrokenV3Config(targetCount = 1): SimConfig {
  const base = makeConfig();
  const targets = Array.from({ length: targetCount }, (_, index) => ({
    id: `enemy-${index}`,
    name: `Freeze target ${index}`,
    initialAura: [{ element: "cryo" as const, gaugeUnits: 1 }]
  }));
  const ability: AbilityDefinition = {
    id: "freeze-v3-sequence",
    actorId: "tester",
    name: "Freeze V3 sequence",
    kind: "skill",
    cancelFrame: 1,
    animationEndFrame: 1,
    cooldownFrames: 0,
    hits: targets.map((target, index) => ({
        id: `create-freeze-${index}`,
        label: `Create Freeze ${index}`,
        frame: 0,
        scaling: 1,
        element: "hydro",
        targeting: {
          targetId: target.id,
          outcome: "landed" as const
        },
        application: {
          gaugeUnits: 1,
          icd: { mode: "no-icd-v1" }
        }
      }))
  };

  return {
    ...base,
    duration: 4,
    cycleLength: 4,
    freezeBrokenAttackModel: {
      mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE,
      policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID
    },
    callbackBusModel: {
      mode: GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
      policyId: GCSIM_CALLBACK_BUS_POLICY_V2_ID
    },
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "tester",
        name: "Test actor index zero",
        element: "hydro",
        level: 90,
        stats: { ...neutralStats, baseAtk: 1000 }
      }
    ],
    reactionEngine: { mode: "aura-v2" },
    rotation: [],
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "tester",
      swapFrames: 1,
      abilities: [ability],
      commands: [
        {
          type: "skill",
          actorId: "tester",
          abilityId: ability.id
        }
      ]
    }
  };
}

function callbackPlugin(
  id: string,
  subscriberKey = "shared-freeze-audit"
) {
  return defineCallbackSubscriberPluginV153(
    {
      id,
      version: "1.0.0",
      kind: "code",
      contentHash: `fnv1a32:${id === "test.callback-a" ? "11111111" : "22222222"}`
    },
    [
      {
        eventKind: "on-enemy-damage-freeze-broken-zero",
        subscriberKey
      }
    ],
    () => ({ handleCallback: () => ({ kind: "no-side-effect" }) })
  );
}

function makeFreezeBrokenV2Config(): SimConfig {
  return {
    ...makeFreezeBrokenV3Config(),
    freezeBrokenAttackModel: {
      mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
      policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID
    },
    callbackBusModel: {
      mode: LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
      policyId: LEGACY_CALLBACK_BUS_POLICY_V1_ID
    }
  };
}

function expectPublicAndTrustedRejected(
  result: SimulationResultForV153
): void {
  expect(simulationResultV153Schema.safeParse(result).success).toBe(false);
  expect(() => assertTrustedSimulationResultV153(result)).toThrow(
    /Trusted SimulationResult 1\.53 integrity validation failed/
  );
}

function rekeyRunManifest(result: SimulationResultForV153): void {
  const { reproducibilityKey: _reproducibilityKey, ...identity } =
    result.runManifest;
  result.runManifest.reproducibilityKey =
    createSimulationReproducibilityKey(identity);
  result.reproducibilityKey = result.runManifest.reproducibilityKey;
}

describe("V1.53 callback result leaf schemas", () => {
  it("keeps raw callback leaves capable of subscribe/replace/unsubscribe lifecycle semantics", () => {
    const subscribe = validRegistration();
    const replace = {
      ...subscribe,
      id: 1,
      registryRevision: 2,
      operation: "replace" as const,
      previousSubscriptionId: subscribe.currentSubscriptionId,
      currentSubscriptionId: 8,
      subscriberAttemptRefs: []
    };
    const unsubscribe = {
      ...replace,
      id: 2,
      registryRevision: 3,
      operation: "unsubscribe" as const,
      previousSubscriptionId: replace.currentSubscriptionId,
      currentSubscriptionId: null
    };

    for (const entry of [subscribe, replace, unsubscribe]) {
      expect(
        callbackRegistrationLogEntryV153Schema.safeParse(entry).success
      ).toBe(true);
    }
  });

  it("rejects lifecycle drift, duplicate attempt refs, and unknown fields", () => {
    const entry = validRegistration();
    for (const candidate of [
      { ...entry, registryRevision: 0 },
      { ...entry, previousSubscriptionId: 6 },
      { ...entry, currentSubscriptionId: null },
      {
        ...entry,
        subscriberAttemptRefs: [
          ...entry.subscriberAttemptRefs,
          ...entry.subscriberAttemptRefs
        ]
      },
      { ...entry, callbackRuntime: "unversioned" }
    ]) {
      expect(
        callbackRegistrationLogEntryV153Schema.safeParse(candidate).success
      ).toBe(false);
    }
  });

  it("requires plugin references to be paired and forbids them on core leaves", () => {
    const entry = validRegistration();
    expect(
      callbackRegistrationLogEntryV153Schema.safeParse({
        ...entry,
        pluginId: null
      }).success
    ).toBe(false);
    expect(
      callbackRegistrationLogEntryV153Schema.safeParse({
        ...entry,
        sourceKind: "core",
        pluginManifestIndex: null,
        pluginId: null
      }).success
    ).toBe(true);
    expect(
      callbackRegistrationLogEntryV153Schema.safeParse({
        ...entry,
        sourceKind: "core"
      }).success
    ).toBe(false);

    const attempt = validAttempt();
    expect(
      callbackSubscriberAttemptV153Schema.safeParse({
        ...attempt,
        pluginManifestIndex: null
      }).success
    ).toBe(false);
  });

  it("accepts exactly the five correlated event/payload/phase union members", () => {
    for (const eventIndex of [0, 1, 2, 3, 4] as const) {
      expect(
        callbackDeliveryLogEntryV153Schema.safeParse(
          validDelivery(eventIndex)
        ).success
      ).toBe(true);
    }
  });

  it("rejects event-index, payload, phase, time, and strict-literal drift", () => {
    const immediate = validDelivery(0) as Record<string, unknown>;
    const zeroDelay = validDelivery(3) as Record<string, unknown>;
    for (const candidate of [
      { ...immediate, eventIndex: 1 },
      {
        ...immediate,
        payload: { kind: "frozen-durability-depleted", element: "cryo" }
      },
      {
        ...immediate,
        phase: {
          kind: "zero-delay-core-task",
          scheduledAfterCallbackDeliveryLogId: 2,
          taskSequence: 10,
          delayFrames: 0,
          referenceRelativeToTriggerEnemyDamage: "not-applicable",
          localExecutionRelativeToTriggerEvent: "after-current-event"
        }
      },
      { ...zeroDelay, timeSeconds: 1.01 },
      {
        ...zeroDelay,
        phase: {
          ...(zeroDelay.phase as Record<string, unknown>),
          localExecutionRelativeToTriggerEvent: "before-trigger-event"
        }
      },
      { ...zeroDelay, callbackStatus: "complete" }
    ]) {
      expect(
        callbackDeliveryLogEntryV153Schema.safeParse(candidate).success
      ).toBe(false);
    }
  });

  it("pins structural-only outcome verification and strict outcome leaves", () => {
    const attempt = validAttempt();
    expect(callbackSubscriberAttemptV153Schema.parse(attempt)).toEqual(attempt);
    for (const candidate of [
      { ...attempt, outcomeVerification: "runtime-verified" },
      { ...attempt, status: "threw" },
      {
        ...attempt,
        outcome: { ...attempt.outcome, mutationApplied: true }
      }
    ]) {
      expect(
        callbackSubscriberAttemptV153Schema.safeParse(candidate).success
      ).toBe(false);
    }
  });
});

describe("V1.53 callback result public and trusted integrity", () => {
  let replacementResult: SimulationResultForV153;
  let twoTargetResult: SimulationResultForV153;
  let twoSlotResult: SimulationResultForV153;
  let legacyBusResult: SimulationResultForV153;

  beforeAll(() => {
    replacementResult = simulate(makeFreezeBrokenV3Config(), {
      critMode: "noCrit",
      plugins: [
        callbackPlugin("test.callback-a"),
        callbackPlugin("test.callback-b")
      ]
    });
    twoTargetResult = simulate(makeFreezeBrokenV3Config(2), {
      critMode: "noCrit"
    });
    twoSlotResult = simulate(makeFreezeBrokenV3Config(), {
      critMode: "noCrit",
      plugins: [
        callbackPlugin("test.callback-a", "first-slot"),
        callbackPlugin("test.callback-b", "second-slot")
      ]
    });
    legacyBusResult = simulate(makeFreezeBrokenV2Config(), {
      critMode: "noCrit"
    });
  });

  function requireV3Audit(
    result: SimulationResultForV153,
    index = 0
  ): Extract<
    SimulationResultForV153["freezeBrokenAttackLog"][number],
    { executionStatus: "callback-bus-dispatched-normalized" }
  > {
    const audit = result.freezeBrokenAttackLog[index];
    if (
      audit === undefined ||
      audit.executionStatus !== "callback-bus-dispatched-normalized"
    ) {
      throw new Error(`the fixture requires V3 audit row ${index}`);
    }
    return audit;
  }

  it("accepts a cross-plugin replacement at the same event/key slot", () => {
    const result = replacementResult;

    expect(result.callbackRegistrationLog).toMatchObject([
      {
        id: 0,
        operation: "subscribe",
        eventKind: "on-enemy-damage-freeze-broken-zero",
        subscriberKey: "shared-freeze-audit",
        slotIndex: 0,
        pluginManifestIndex: 0,
        pluginId: "test.callback-a",
        subscriberAttemptRefs: []
      },
      {
        id: 1,
        operation: "replace",
        eventKind: "on-enemy-damage-freeze-broken-zero",
        subscriberKey: "shared-freeze-audit",
        slotIndex: 0,
        pluginManifestIndex: 1,
        pluginId: "test.callback-b",
        subscriberAttemptRefs: [{ callbackDeliveryLogId: 3, attemptIndex: 0 }]
      }
    ]);
    expect(result.callbackDeliveryLog.map((entry) => entry.eventKind)).toEqual(
      EVENT_KINDS
    );
    expect(result.runManifest.pluginCapabilities).toEqual([
      "callback-subscriber",
      "callback-subscriber"
    ]);
    expect(result.runManifest.pluginCallbackSubscriptions).toEqual([
      [{
        eventKind: "on-enemy-damage-freeze-broken-zero",
        subscriberKey: "shared-freeze-audit"
      }],
      [{
        eventKind: "on-enemy-damage-freeze-broken-zero",
        subscriberKey: "shared-freeze-audit"
      }]
    ]);
    expect(
      result.callbackRegistrationLog.map(
        (registration) => registration.currentSubscriptionId
      )
    ).toEqual([0, 1]);
    expect(simulationResultV153Schema.parse(result)).toEqual(result);
    expect(assertTrustedSimulationResultV153(result)).toBe(result);
  });

  it("rejects a coherently re-keyed callback declaration that does not match startup registration", () => {
    const forged = structuredClone(replacementResult);
    const declaration =
      forged.runManifest.pluginCallbackSubscriptions[1]?.[0];
    if (declaration === undefined) {
      throw new Error("the fixture requires the replacement declaration");
    }
    declaration.subscriberKey = "declared-but-not-registered";
    rekeyRunManifest(forged);

    expectPublicAndTrustedRejected(forged);
  });

  it("rejects malformed callback subscription declarations at both boundaries", () => {
    const makeForged = () => structuredClone(replacementResult);

    const unknownKey = makeForged();
    Object.assign(
      unknownKey.runManifest.pluginCallbackSubscriptions[0]![0]!,
      { unversionedAuthority: true }
    );
    rekeyRunManifest(unknownKey);
    expect(simulationResultV153Schema.safeParse(unknownKey).success).toBe(false);
    expect(() => assertTrustedSimulationResultV153(unknownKey)).toThrow(
      /must contain exactly eventKind and subscriberKey own keys/
    );

    const blankKey = makeForged();
    blankKey.runManifest.pluginCallbackSubscriptions[0]![0]!.subscriberKey =
      "   ";
    blankKey.callbackRegistrationLog[0]!.subscriberKey = "   ";
    rekeyRunManifest(blankKey);
    expect(simulationResultV153Schema.safeParse(blankKey).success).toBe(false);
    expect(() => assertTrustedSimulationResultV153(blankKey)).toThrow(
      /subscriberKey: must not be blank/
    );

    const duplicateBinding = makeForged();
    duplicateBinding.runManifest.pluginCallbackSubscriptions[0]!.push(
      structuredClone(
        duplicateBinding.runManifest.pluginCallbackSubscriptions[0]![0]!
      )
    );
    rekeyRunManifest(duplicateBinding);
    expect(
      simulationResultV153Schema.safeParse(duplicateBinding).success
    ).toBe(false);
    expect(() => assertTrustedSimulationResultV153(duplicateBinding)).toThrow(
      /must not duplicate an eventKind\/subscriberKey binding/
    );
  });

  it("fails closed when a V3 config carries a valid V2 Freeze Broken row", () => {
    const forged = structuredClone(replacementResult);
    const legacyAudit = legacyBusResult.freezeBrokenAttackLog[0];
    if (
      legacyAudit === undefined ||
      legacyAudit.executionStatus !==
        "reference-audit-only-not-dispatched"
    ) {
      throw new Error("the fixture requires a valid V2 Freeze Broken row");
    }
    forged.freezeBrokenAttackLog[0] = structuredClone(legacyAudit);

    expect(() => simulationResultV153Schema.safeParse(forged)).not.toThrow();
    expect(simulationResultV153Schema.safeParse(forged).success).toBe(false);
    expect(() => assertTrustedSimulationResultV153(forged)).toThrow(
      /Trusted SimulationResult 1\.53 integrity validation failed: freezeBrokenAttackLog\.0\.executionStatus/
    );
  });

  it("rejects persisted unsubscribe and tombstone-resubscribe histories that the simulator cannot produce", () => {
    const unsubscribeOnly = structuredClone(replacementResult);
    const unsubscribeActive = unsubscribeOnly.callbackRegistrationLog[1];
    if (
      unsubscribeActive === undefined ||
      unsubscribeActive.currentSubscriptionId === null
    ) {
      throw new Error("the fixture requires an active replacement registration");
    }
    unsubscribeActive.subscriberAttemptRefs = [];
    unsubscribeOnly.callbackRegistrationLog.push({
      ...structuredClone(unsubscribeActive),
      id: 2,
      registryRevision: 3,
      operation: "unsubscribe",
      previousSubscriptionId: unsubscribeActive.currentSubscriptionId,
      currentSubscriptionId: null,
      subscriberAttemptRefs: []
    });
    for (const delivery of unsubscribeOnly.callbackDeliveryLog) {
      delivery.registryRevision = 3;
      delivery.subscriberAttempts = [];
    }
    expectPublicAndTrustedRejected(unsubscribeOnly);

    const tombstoneResubscribe = structuredClone(replacementResult);
    const replaced = tombstoneResubscribe.callbackRegistrationLog[1];
    if (replaced === undefined || replaced.currentSubscriptionId === null) {
      throw new Error("the fixture requires an active replacement registration");
    }
    const originalAttemptRefs = structuredClone(replaced.subscriberAttemptRefs);
    const resumedSubscriptionId = replaced.currentSubscriptionId + 100;
    replaced.subscriberAttemptRefs = [];
    tombstoneResubscribe.callbackRegistrationLog.push(
      {
        ...structuredClone(replaced),
        id: 2,
        registryRevision: 3,
        operation: "unsubscribe",
        previousSubscriptionId: replaced.currentSubscriptionId,
        currentSubscriptionId: null,
        subscriberAttemptRefs: []
      },
      {
        ...structuredClone(replaced),
        id: 3,
        registryRevision: 4,
        operation: "replace",
        previousSubscriptionId: null,
        currentSubscriptionId: resumedSubscriptionId,
        subscriberAttemptRefs: originalAttemptRefs
      }
    );
    for (const delivery of tombstoneResubscribe.callbackDeliveryLog) {
      delivery.registryRevision = 4;
      for (const attempt of delivery.subscriberAttempts) {
        if (attempt.registrationLogId === replaced.id) {
          attempt.registrationLogId = 3;
          attempt.subscriptionId = resumedSubscriptionId;
        }
      }
    }
    expectPublicAndTrustedRejected(tombstoneResubscribe);
  });

  it("accepts same-frame two-target dispatch with independent task namespaces", () => {
    expect(twoTargetResult.freezeBrokenAttackLog).toHaveLength(2);
    expect(new Set(twoTargetResult.callbackDeliveryLog.map((row) => row.frame))).toEqual(
      new Set([twoTargetResult.callbackDeliveryLog[0]?.frame])
    );
    const claimedIds = [0, 1].flatMap((auditIndex) => {
      const audit = requireV3Audit(twoTargetResult, auditIndex);
      const ids = [
        ...audit.syncPhase.callbackDeliveryLogIds,
        ...audit.endOfFramePhase.callbackDeliveryLogIds
      ];
      expect(ids.every((id, index) => index === 0 || id > ids[index - 1]!)).toBe(
        true
      );
      expect(
        ids.map((id) => twoTargetResult.callbackDeliveryLog[id]?.eventIndex)
      ).toEqual([0, 1, 2, 3, 4]);
      return ids;
    });
    expect([...claimedIds].sort((left, right) => left - right)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9
    ]);
    expect(simulationResultV153Schema.parse(twoTargetResult)).toEqual(
      twoTargetResult
    );
    expect(assertTrustedSimulationResultV153(twoTargetResult)).toBe(
      twoTargetResult
    );
  });

  it("accepts non-contiguous five-phase groups linked only by explicit IDs", () => {
    const interleaved = structuredClone(twoTargetResult);
    const oldRows = interleaved.callbackDeliveryLog;
    const oldOrder = [0, 1, 2, 5, 6, 7, 3, 4, 8, 9] as const;
    const newIdByOldId = new Map<number, number>(
      oldOrder.map((oldId, newId) => [oldId, newId] as const)
    );
    const remapId = (oldId: number): number => {
      const newId = newIdByOldId.get(oldId);
      if (newId === undefined) {
        throw new Error(`missing remap for callback delivery ${oldId}`);
      }
      return newId;
    };
    interleaved.callbackDeliveryLog = oldOrder.map((oldId, newId) => {
      const row = oldRows[oldId];
      if (row === undefined) {
        throw new Error(`missing callback delivery ${oldId}`);
      }
      const parent = row.parentCallbackDeliveryLogId;
      row.id = newId;
      row.parentCallbackDeliveryLogId =
        parent === null ? null : remapId(parent);
      if (row.phase.kind === "zero-delay-core-task") {
        row.phase.scheduledAfterCallbackDeliveryLogId = remapId(
          row.phase.scheduledAfterCallbackDeliveryLogId
        );
      }
      return row;
    });
    for (const rawAudit of interleaved.freezeBrokenAttackLog) {
      if (
        rawAudit.executionStatus !== "callback-bus-dispatched-normalized"
      ) {
        throw new Error("the fixture requires only V3 audit rows");
      }
      rawAudit.syncPhase.callbackDeliveryLogIds =
        rawAudit.syncPhase.callbackDeliveryLogIds.map(remapId) as [
          number,
          number,
          number
        ];
      rawAudit.endOfFramePhase.callbackDeliveryLogIds =
        rawAudit.endOfFramePhase.callbackDeliveryLogIds.map(remapId) as [
          number,
          number
        ];
    }

    expect(requireV3Audit(interleaved, 0)).toMatchObject({
      syncPhase: { callbackDeliveryLogIds: [0, 1, 2] },
      endOfFramePhase: { callbackDeliveryLogIds: [6, 7] }
    });
    expect(requireV3Audit(interleaved, 1)).toMatchObject({
      syncPhase: { callbackDeliveryLogIds: [3, 4, 5] },
      endOfFramePhase: { callbackDeliveryLogIds: [8, 9] }
    });
    expect(simulationResultV153Schema.parse(interleaved)).toEqual(interleaved);
    expect(assertTrustedSimulationResultV153(interleaved)).toBe(interleaved);
  });

  it("rejects a persisted core registration even when its plugin refs are removed", () => {
    const forged = structuredClone(replacementResult);
    const superseded = forged.callbackRegistrationLog[0];
    if (superseded === undefined) {
      throw new Error("the fixture requires a superseded registration");
    }
    superseded.sourceKind = "core";
    superseded.pluginManifestIndex = null;
    superseded.pluginId = null;

    expect(
      callbackRegistrationLogEntryV153Schema.safeParse(superseded).success
    ).toBe(true);
    expectPublicAndTrustedRejected(forged);
  });

  it("rejects unknown own keys at every nested callback result boundary", () => {
    const forge = (
      mutate: (result: SimulationResultForV153) => void
    ): SimulationResultForV153 => {
      const result = structuredClone(replacementResult);
      mutate(result);
      return result;
    };
    const addUnknownKey = (value: object): void => {
      Object.assign(value, { unversionedExtra: true });
    };
    const requireActiveRegistration = (
      result: SimulationResultForV153
    ) => {
      const registration = result.callbackRegistrationLog[1];
      if (registration === undefined) {
        throw new Error("the fixture requires an active registration");
      }
      return registration;
    };
    const requireSubscriberAttempt = (result: SimulationResultForV153) => {
      const delivery = result.callbackDeliveryLog.find(
        (entry) => entry.eventIndex === 3
      );
      const attempt = delivery?.subscriberAttempts[0];
      if (attempt === undefined) {
        throw new Error("the fixture requires a subscriber attempt");
      }
      return attempt;
    };

    const forgedResults = [
      forge((result) => addUnknownKey(requireActiveRegistration(result))),
      forge((result) => {
        const reference =
          requireActiveRegistration(result).subscriberAttemptRefs[0];
        if (reference === undefined) {
          throw new Error("the fixture requires an attempt reference");
        }
        addUnknownKey(reference);
      }),
      forge((result) => addUnknownKey(result.callbackDeliveryLog[0]!)),
      forge((result) => addUnknownKey(requireSubscriberAttempt(result))),
      forge((result) => addUnknownKey(result.callbackDeliveryLog[0]!.phase)),
      forge((result) => addUnknownKey(result.callbackDeliveryLog[0]!.payload)),
      forge((result) => addUnknownKey(requireSubscriberAttempt(result).outcome))
    ];

    for (const forged of forgedResults) {
      expectPublicAndTrustedRejected(forged);
    }
  });

  it("rejects duplicate end-of-frame task sequences across audits", () => {
    const forged = structuredClone(twoTargetResult);
    const endOfFrame = forged.callbackDeliveryLog.filter(
      (entry): entry is Extract<
        CallbackDeliveryLogEntryV153,
        { eventIndex: 3 }
      > => entry.eventIndex === 3
    );
    const first = endOfFrame[0];
    const second = endOfFrame[1];
    if (first === undefined || second === undefined) {
      throw new Error("the fixture requires two end-of-frame callback tasks");
    }
    second.phase.taskSequence = first.phase.taskSequence;

    expectPublicAndTrustedRejected(forged);
  });

  it("rejects a coherently forged EOF task outside the reserved public namespace", () => {
    const forged = structuredClone(replacementResult);
    const audit = requireV3Audit(forged);
    for (const deliveryId of audit.endOfFramePhase.callbackDeliveryLogIds) {
      const delivery = forged.callbackDeliveryLog[deliveryId];
      if (
        delivery === undefined ||
        delivery.phase.kind !== "zero-delay-core-task"
      ) {
        throw new Error("the fixture requires both EOF callback deliveries");
      }
      delivery.phase.taskSequence = 1_234_567_890;
      delivery.eventSequence = 1_234_567_890;
    }

    expectPublicAndTrustedRejected(forged);
  });

  it("rejects coherently renumbered subscription IDs outside the runtime allocator lifecycle", () => {
    const forged = structuredClone(twoSlotResult);
    const firstRegistration = forged.callbackRegistrationLog[0];
    if (
      firstRegistration === undefined ||
      firstRegistration.currentSubscriptionId !== 0
    ) {
      throw new Error("the fixture requires subscription ID 0");
    }
    firstRegistration.currentSubscriptionId = 99;
    for (const delivery of forged.callbackDeliveryLog) {
      for (const attempt of delivery.subscriberAttempts) {
        if (attempt.registrationLogId === firstRegistration.id) {
          expect(attempt.subscriptionId).toBe(0);
          attempt.subscriptionId = 99;
        }
      }
    }

    expectPublicAndTrustedRejected(forged);
  });

  it("rejects a missing callback delivery", () => {
    const forged = structuredClone(replacementResult);
    forged.callbackDeliveryLog.pop();

    expectPublicAndTrustedRejected(forged);
  });

  it("rejects an extra orphan callback delivery", () => {
    const forged = structuredClone(replacementResult);
    const last = forged.callbackDeliveryLog.at(-1);
    if (last === undefined) {
      throw new Error("the fixture requires a callback delivery");
    }
    forged.callbackDeliveryLog.push({
      ...structuredClone(last),
      id: forged.callbackDeliveryLog.length
    });

    expectPublicAndTrustedRejected(forged);
  });

  it("rejects a reordered audit event-ID tuple", () => {
    const forged = structuredClone(replacementResult);
    const audit = requireV3Audit(forged);
    const [first, second, third] = audit.syncPhase.callbackDeliveryLogIds;
    audit.syncPhase.callbackDeliveryLogIds = [second, first, third];

    expectPublicAndTrustedRejected(forged);
  });

  it("rejects a broken parent-delivery backlink", () => {
    const forged = structuredClone(replacementResult);
    const audit = requireV3Audit(forged);
    const applyAttack =
      forged.callbackDeliveryLog[audit.syncPhase.callbackDeliveryLogIds[1]];
    if (applyAttack === undefined) {
      throw new Error("the fixture requires an apply-attack delivery");
    }
    applyAttack.parentCallbackDeliveryLogId = null;

    expectPublicAndTrustedRejected(forged);
  });

  it("rejects a delivery-to-audit reciprocal ID drift", () => {
    const forged = structuredClone(replacementResult);
    const delivery = forged.callbackDeliveryLog[0];
    if (delivery === undefined) {
      throw new Error("the fixture requires a callback delivery");
    }
    delivery.freezeBrokenAttackLogId += 1;

    expectPublicAndTrustedRejected(forged);
  });

  it("rejects a delivery-to-Frozen-source reciprocal ID drift", () => {
    const forged = structuredClone(replacementResult);
    const delivery = forged.callbackDeliveryLog[0];
    if (delivery === undefined) {
      throw new Error("the fixture requires a callback delivery");
    }
    delivery.sourceFrozenStateLogId += 1;

    expectPublicAndTrustedRejected(forged);
  });

  it("rejects non-reciprocal registration subscriber-attempt references", () => {
    const forged = structuredClone(replacementResult);
    const active = forged.callbackRegistrationLog[1];
    if (active === undefined) {
      throw new Error("the fixture requires an active replacement");
    }
    active.subscriberAttemptRefs = [];

    expectPublicAndTrustedRejected(forged);
  });

  it("rejects a registration plugin manifest index/ID mismatch", () => {
    const forged = structuredClone(replacementResult);
    const active = forged.callbackRegistrationLog[1];
    if (active === undefined) {
      throw new Error("the fixture requires an active replacement");
    }
    active.pluginId = "test.callback-missing";

    expectPublicAndTrustedRejected(forged);
  });

  it("rejects callback registration and attempt refs bound to damage capability", () => {
    const forged = structuredClone(replacementResult);
    forged.runManifest.pluginCapabilities[1] = "damage-modifier";
    rekeyRunManifest(forged);

    expect(simulationResultV153Schema.safeParse(forged).success).toBe(false);
    expect(() => assertTrustedSimulationResultV153(forged)).toThrow(
      /callbackRegistrationLog\.1\.pluginManifestIndex: must resolve to a callback-subscriber capability.*callbackDeliveryLog\.3\.subscriberAttempts\.0\.pluginManifestIndex: must resolve to a callback-subscriber capability/
    );
  });

  it("rejects a coherently re-keyed scaling override declared as callback-only", () => {
    const descriptor = {
      id: "test.callback-only-scaling-authority",
      version: "1.0.0",
      kind: "code" as const,
      contentHash: "fnv1a32:ca110153"
    };
    const callbackOnlyPlugin = defineCallbackSubscriberPluginV153(
      descriptor,
      [],
      () => ({ handleCallback: () => ({ kind: "no-side-effect" }) })
    );
    const scalingPlugin = defineDamageModifierPlugin(
      descriptor,
      () => ({
        modifyDamage(context) {
          return {
            scalingValue: context.damageInput.scalingValue + 1
          };
        }
      })
    );
    const config = makeFreezeBrokenV3Config();
    const callbackOnly = simulate(config, {
      critMode: "noCrit",
      plugins: [callbackOnlyPlugin]
    });
    const scalingModified = simulate(config, {
      critMode: "noCrit",
      plugins: [scalingPlugin]
    });

    expect(callbackOnly.pluginManifest).toEqual(scalingModified.pluginManifest);
    expect(callbackOnly.runManifest.pluginCapabilities).toEqual([
      "callback-subscriber"
    ]);
    expect(scalingModified.runManifest.pluginCapabilities).toEqual([
      "damage-modifier"
    ]);
    expect(assertTrustedSimulationResultV153(callbackOnly)).toBe(callbackOnly);
    expect(assertTrustedSimulationResultV153(scalingModified)).toBe(
      scalingModified
    );

    const forged = structuredClone(scalingModified);
    forged.runManifest.pluginCapabilities = ["callback-subscriber"];
    rekeyRunManifest(forged);
    expect(forged.reproducibilityKey).toBe(callbackOnly.reproducibilityKey);
    expect(forged.damageEvents[0]?.damageFactors.scalingValue).not.toBe(
      callbackOnly.damageEvents[0]?.damageFactors.scalingValue
    );

    expect(simulationResultV153Schema.safeParse(forged).success).toBe(false);
    expect(() => assertTrustedSimulationResultV153(forged)).toThrow(
      /snapshot scaling-stat value/
    );
  });

  it("rejects subscriber attempts delivered outside registry slot order", () => {
    const forged = structuredClone(twoSlotResult);
    const enemyDamage = forged.callbackDeliveryLog.find(
      (entry) => entry.eventIndex === 3
    );
    if (enemyDamage === undefined) {
      throw new Error("the fixture requires an enemy-damage delivery");
    }
    enemyDamage.subscriberAttempts.reverse();

    expectPublicAndTrustedRejected(forged);
  });

  it("rejects a missing active-slot subscriber attempt", () => {
    const forged = structuredClone(twoSlotResult);
    const enemyDamage = forged.callbackDeliveryLog.find(
      (entry) => entry.eventIndex === 3
    );
    if (enemyDamage === undefined) {
      throw new Error("the fixture requires an enemy-damage delivery");
    }
    enemyDamage.subscriberAttempts.pop();

    expectPublicAndTrustedRejected(forged);
  });

  it("rejects non-empty callback logs under Freeze V2 and callback bus V1", () => {
    expect(legacyBusResult.callbackRegistrationLog).toEqual([]);
    expect(legacyBusResult.callbackDeliveryLog).toEqual([]);
    const forged = structuredClone(legacyBusResult);
    const delivery = replacementResult.callbackDeliveryLog[0];
    if (delivery === undefined) {
      throw new Error("the V3 fixture requires a callback delivery");
    }
    forged.callbackDeliveryLog = [structuredClone(delivery)];

    expectPublicAndTrustedRejected(forged);
  });

  it("rejects an EOF task scheduled after the wrong sync delivery", () => {
    const forged = structuredClone(replacementResult);
    const audit = requireV3Audit(forged);
    const enemyDamage =
      forged.callbackDeliveryLog[
        audit.endOfFramePhase.callbackDeliveryLogIds[0]
      ];
    if (
      enemyDamage === undefined ||
      enemyDamage.phase.kind !== "zero-delay-core-task"
    ) {
      throw new Error("the fixture requires an EOF callback task");
    }
    enemyDamage.phase.scheduledAfterCallbackDeliveryLogId =
      audit.syncPhase.callbackDeliveryLogIds[1];

    expectPublicAndTrustedRejected(forged);
  });

  it("rejects an EOF reference relation that disagrees with its audit", () => {
    const forged = structuredClone(replacementResult);
    const audit = requireV3Audit(forged);
    const enemyDamage =
      forged.callbackDeliveryLog[
        audit.endOfFramePhase.callbackDeliveryLogIds[0]
      ];
    if (
      enemyDamage === undefined ||
      enemyDamage.phase.kind !== "zero-delay-core-task"
    ) {
      throw new Error("the fixture requires an EOF callback task");
    }
    expect(audit.endOfFramePhase.relativeToTriggerEnemyDamage).toBe(
      "not-applicable"
    );
    enemyDamage.phase.referenceRelativeToTriggerEnemyDamage = "before";

    expectPublicAndTrustedRejected(forged);
  });

  it("rejects reverse same-frame immediate groups even when owners and local orders remain valid", () => {
    const interleaved = structuredClone(twoTargetResult);
    expect(interleaved.callbackRegistrationLog).toEqual([]);
    const oldRows = interleaved.callbackDeliveryLog;
    const firstImmediateIds = [
      ...requireV3Audit(interleaved, 0).syncPhase.callbackDeliveryLogIds
    ];
    const secondImmediateIds = [
      ...requireV3Audit(interleaved, 1).syncPhase.callbackDeliveryLogIds
    ];
    const immediateIds = new Set([
      ...firstImmediateIds,
      ...secondImmediateIds
    ]);
    const oldOrder = [
      ...secondImmediateIds,
      ...firstImmediateIds,
      ...oldRows.map((row) => row.id).filter((id) => !immediateIds.has(id))
    ];
    const newIdByOldId = new Map<number, number>(
      oldOrder.map((oldId, newId) => [oldId, newId] as const)
    );
    const remapId = (oldId: number): number => {
      const newId = newIdByOldId.get(oldId);
      if (newId === undefined) {
        throw new Error(`missing remap for callback delivery ${oldId}`);
      }
      return newId;
    };
    interleaved.callbackDeliveryLog = oldOrder.map((oldId, newId) => {
      const row = oldRows[oldId];
      if (row === undefined) {
        throw new Error(`missing callback delivery ${oldId}`);
      }
      const parent = row.parentCallbackDeliveryLogId;
      row.id = newId;
      row.parentCallbackDeliveryLogId =
        parent === null ? null : remapId(parent);
      if (row.phase.kind === "zero-delay-core-task") {
        row.phase.scheduledAfterCallbackDeliveryLogId = remapId(
          row.phase.scheduledAfterCallbackDeliveryLogId
        );
      }
      return row;
    });
    for (const rawAudit of interleaved.freezeBrokenAttackLog) {
      if (
        rawAudit.executionStatus !== "callback-bus-dispatched-normalized"
      ) {
        throw new Error("the fixture requires only V3 audit rows");
      }
      rawAudit.syncPhase.callbackDeliveryLogIds =
        rawAudit.syncPhase.callbackDeliveryLogIds.map(remapId) as [
          number,
          number,
          number
        ];
      rawAudit.endOfFramePhase.callbackDeliveryLogIds =
        rawAudit.endOfFramePhase.callbackDeliveryLogIds.map(remapId) as [
          number,
          number
        ];
    }

    expect(requireV3Audit(interleaved, 0)).toMatchObject({
      syncPhase: { callbackDeliveryLogIds: [3, 4, 5] },
      endOfFramePhase: { callbackDeliveryLogIds: [6, 7] }
    });
    expect(requireV3Audit(interleaved, 1)).toMatchObject({
      syncPhase: { callbackDeliveryLogIds: [0, 1, 2] },
      endOfFramePhase: { callbackDeliveryLogIds: [8, 9] }
    });
    expectPublicAndTrustedRejected(interleaved);
  });

  it("accepts reverse EOF interleaving without treating public task IDs as heap order", () => {
    const interleaved = structuredClone(twoTargetResult);
    expect(interleaved.callbackRegistrationLog).toEqual([]);
    const oldRows = interleaved.callbackDeliveryLog;
    const firstAudit = requireV3Audit(interleaved, 0);
    const secondAudit = requireV3Audit(interleaved, 1);
    const oldOrder = [
      ...firstAudit.syncPhase.callbackDeliveryLogIds,
      ...secondAudit.syncPhase.callbackDeliveryLogIds,
      ...secondAudit.endOfFramePhase.callbackDeliveryLogIds,
      ...firstAudit.endOfFramePhase.callbackDeliveryLogIds
    ];
    const newIdByOldId = new Map<number, number>(
      oldOrder.map((oldId, newId) => [oldId, newId] as const)
    );
    const remapId = (oldId: number): number => {
      const newId = newIdByOldId.get(oldId);
      if (newId === undefined) {
        throw new Error(`missing remap for callback delivery ${oldId}`);
      }
      return newId;
    };
    interleaved.callbackDeliveryLog = oldOrder.map((oldId, newId) => {
      const row = oldRows[oldId];
      if (row === undefined) {
        throw new Error(`missing callback delivery ${oldId}`);
      }
      const parent = row.parentCallbackDeliveryLogId;
      row.id = newId;
      row.parentCallbackDeliveryLogId =
        parent === null ? null : remapId(parent);
      if (row.phase.kind === "zero-delay-core-task") {
        row.phase.scheduledAfterCallbackDeliveryLogId = remapId(
          row.phase.scheduledAfterCallbackDeliveryLogId
        );
      }
      return row;
    });
    for (const rawAudit of interleaved.freezeBrokenAttackLog) {
      if (
        rawAudit.executionStatus !== "callback-bus-dispatched-normalized"
      ) {
        throw new Error("the fixture requires only V3 audit rows");
      }
      rawAudit.syncPhase.callbackDeliveryLogIds =
        rawAudit.syncPhase.callbackDeliveryLogIds.map(remapId) as [
          number,
          number,
          number
        ];
      rawAudit.endOfFramePhase.callbackDeliveryLogIds =
        rawAudit.endOfFramePhase.callbackDeliveryLogIds.map(remapId) as [
          number,
          number
        ];
    }

    expect(requireV3Audit(interleaved, 0)).toMatchObject({
      syncPhase: { callbackDeliveryLogIds: [0, 1, 2] },
      endOfFramePhase: { callbackDeliveryLogIds: [8, 9] }
    });
    expect(requireV3Audit(interleaved, 1)).toMatchObject({
      syncPhase: { callbackDeliveryLogIds: [3, 4, 5] },
      endOfFramePhase: { callbackDeliveryLogIds: [6, 7] }
    });
    expect(simulationResultV153Schema.parse(interleaved)).toEqual(interleaved);
    expect(assertTrustedSimulationResultV153(interleaved)).toBe(interleaved);
  });
});
