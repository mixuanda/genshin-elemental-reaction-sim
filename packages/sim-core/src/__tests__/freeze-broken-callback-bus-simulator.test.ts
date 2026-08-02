import {
  GCSIM_CALLBACK_BUS_POLICY_V2_ID,
  GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE,
  LEGACY_CALLBACK_BUS_POLICY_V1_ID,
  LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
} from "@genshin-dps-lab/icd-profiles";
import {
  assertTrustedSimulationResultV153,
  simulationResultV153Schema,
  type SimConfig,
  type SimulationResult,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import { defineCallbackSubscriberPluginV153 } from "../callback-plugins";
import { defineDamageModifierPlugin } from "../plugins";
import { simulate, type SimulationRuntimeOptions } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const V2_MODEL = {
  mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
} as const;

const V3_MODEL = {
  mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE,
  policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID,
} as const;

const BUS_V1_MODEL = {
  mode: LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
  policyId: LEGACY_CALLBACK_BUS_POLICY_V1_ID,
} as const;

const BUS_V2_MODEL = {
  mode: GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
  policyId: GCSIM_CALLBACK_BUS_POLICY_V2_ID,
} as const;

const CALLBACK_EVENT_KINDS = [
  "on-aura-durability-depleted-frozen",
  "on-apply-attack-freeze-broken",
  "on-enemy-hit-freeze-broken",
  "on-enemy-damage-freeze-broken-zero",
  "attack-callback-freeze-broken",
] as const;

function makeNaturalExpiryConfig(targetCount = 1): SimConfig {
  const base = makeConfig({
    freezeBrokenAttackModel: V3_MODEL,
    callbackBusModel: BUS_V2_MODEL,
  });
  const targets = Array.from({ length: targetCount }, (_, index) => ({
    id: `enemy-${index}`,
    name: `Freeze callback target ${index}`,
    initialAura: [{ element: "cryo" as const, gaugeUnits: 1 }],
  }));
  return {
    ...base,
    duration: 4,
    cycleLength: 4,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets,
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "tester",
        name: "Freeze callback tester",
        element: "hydro",
        level: 90,
        stats: { ...neutralStats, baseAtk: 1000 },
      },
    ],
    reactionEngine: { mode: "aura-v2" },
    rotation: [],
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "tester",
      swapFrames: 1,
      abilities: [
        {
          id: "create-freeze",
          actorId: "tester",
          name: "Create Freeze",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "create-freeze-hit",
              label: "Create Freeze",
              frame: 0,
              scaling: 1,
              element: "hydro",
              targeting: {
                mode: "fanout",
                targets: targets.map((target) => ({
                  targetId: target.id,
                  outcome: "landed" as const,
                })),
              },
              application: {
                gaugeUnits: 1,
                icd: { mode: "no-icd-v1" },
              },
            },
          ],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "tester",
          abilityId: "create-freeze",
        },
      ],
    },
  };
}

function makeInterleavedSwirlConfig(): SimConfig {
  const config = makeNaturalExpiryConfig(3);
  config.duration = 1;
  config.cycleLength = 1;
  config.enemy.targets = [
    {
      id: "enemy-0",
      name: "Cryo Swirl source",
      position: { x: 0, y: 0 },
      initialAura: [{ element: "cryo", gaugeUnits: 1 }],
    },
    {
      id: "enemy-1",
      name: "Frozen propagation target 1",
      position: { x: 1, y: 0 },
      initialAura: [{ element: "cryo", gaugeUnits: 0.25 }],
    },
    {
      id: "enemy-2",
      name: "Frozen propagation target 2",
      position: { x: 2, y: 0 },
      initialAura: [{ element: "cryo", gaugeUnits: 0.25 }],
    },
  ];
  config.characters[0]!.element = "anemo";
  const ability = config.timeline!.abilities[0]!;
  ability.cancelFrame = 12;
  ability.animationEndFrame = 12;
  ability.hits = [
    {
      id: "prepare-frozen-targets",
      label: "Prepare Frozen targets",
      frame: 0,
      scaling: 1,
      element: "hydro",
      targeting: {
        mode: "fanout",
        targets: [
          { targetId: "enemy-1", outcome: "landed" },
          { targetId: "enemy-2", outcome: "landed" },
        ],
      },
      application: {
        gaugeUnits: 1,
        icd: { mode: "no-icd-v1" },
      },
    },
    {
      id: "propagate-cryo-swirl",
      label: "Propagate Cryo Swirl",
      frame: 6,
      scaling: 1,
      element: "anemo",
      targeting: { targetId: "enemy-0", outcome: "landed" },
      application: {
        gaugeUnits: 1,
        icd: { mode: "no-icd-v1" },
      },
    },
  ];
  return config;
}

function withModels(
  config: SimConfig,
  freezeBrokenAttackModel: SimConfig["freezeBrokenAttackModel"],
  callbackBusModel: SimConfig["callbackBusModel"],
): SimConfig {
  return {
    ...structuredClone(config),
    freezeBrokenAttackModel,
    callbackBusModel,
  };
}

function simulateNoCrit(
  config: SimConfig,
  plugins: NonNullable<SimulationRuntimeOptions["plugins"]> = [],
): SimulationResult {
  return simulate(config, {
    compatibilityMode: "legal-frame-v1",
    critMode: "noCrit",
    plugins,
  });
}

function expectCombatOutputEqual(
  actual: SimulationResult,
  expected: SimulationResult,
): void {
  expect(actual.damageEvents).toEqual(expected.damageEvents);
  expect(actual.hitEvents).toEqual(expected.hitEvents);
  expect(actual.hitResolutionLog).toEqual(expected.hitResolutionLog);
  expect(actual.totalDamage).toBe(expected.totalDamage);
  expect(actual.dps).toBe(expected.dps);
  expect(actual.reactedHits).toBe(expected.reactedHits);
  expect(actual.byCharacter).toEqual(expected.byCharacter);
  expect(actual.bySkill).toEqual(expected.bySkill);
  expect(actual.perSecond).toEqual(expected.perSecond);
  expect(actual.damageCurve).toEqual(expected.damageCurve);
}

describe("Freeze Broken V1.53 callback-bus simulator integration", () => {
  it("rejects an accessor-backed capability before it can change authority", () => {
    let capabilityReads = 0;
    const unstablePlugin = {
      get capability() {
        capabilityReads += 1;
        return capabilityReads === 1
          ? "callback-subscriber"
          : "damage-modifier";
      },
      descriptor: {
        id: "test.unstable-capability",
        version: "1.0.0",
        kind: "code",
        contentHash: "fnv1a32:unstable-capability",
      },
      subscriptions: [],
      createRuntime: () => ({
        modifyDamage: () => ({ damageBonus: 100 }),
      }),
    } as unknown as NonNullable<
      SimulationRuntimeOptions["plugins"]
    >[number];

    expect(() =>
      simulateNoCrit(makeNaturalExpiryConfig(), [unstablePlugin]),
    ).toThrow(/capability must be an own data property/i);
    expect(capabilityReads).toBe(0);
  });

  it("fails closed for an unknown explicit plugin capability", () => {
    const unknownCapabilityPlugin = {
      capability: "callback-subscriber-vNEXT",
      descriptor: {
        id: "test.unknown-capability",
        version: "1.0.0",
        kind: "code",
        contentHash: "fnv1a32:unknown-capability",
      },
      subscriptions: [],
      createRuntime: () => ({
        modifyDamage: () => ({ damageBonus: 100 }),
      }),
    } as unknown as NonNullable<
      SimulationRuntimeOptions["plugins"]
    >[number];

    expect(() =>
      simulateNoCrit(makeNaturalExpiryConfig(), [unknownCapabilityPlugin]),
    ).toThrow(/unsupported capability callback-subscriber-vNEXT/i);
  });

  it("rejects accessor-backed subscription bindings before registration", () => {
    let subscriberKeyReads = 0;
    const unstableSubscriptionPlugin = {
      capability: "callback-subscriber",
      descriptor: {
        id: "test.unstable-subscription",
        version: "1.0.0",
        kind: "code",
        contentHash: "fnv1a32:unstable-subscription",
      },
      subscriptions: [
        {
          eventKind: "on-enemy-damage-freeze-broken-zero",
          get subscriberKey() {
            subscriberKeyReads += 1;
            return subscriberKeyReads === 1 ? "logged-key" : "runtime-key";
          },
        },
      ],
      createRuntime: () => ({
        handleCallback: () => ({ kind: "no-side-effect" }),
      }),
    } as unknown as NonNullable<
      SimulationRuntimeOptions["plugins"]
    >[number];

    expect(() =>
      simulateNoCrit(makeNaturalExpiryConfig(), [unstableSubscriptionPlugin]),
    ).toThrow(/subscription 0\.subscriberKey must be an own data property/i);
    expect(subscriberKeyReads).toBe(0);
  });

  it("dispatches the five phases without changing combat output", () => {
    const config = makeNaturalExpiryConfig();
    const v2 = simulateNoCrit(withModels(config, V2_MODEL, BUS_V1_MODEL));
    const v3 = simulateNoCrit(config);

    expect(v2.callbackRegistrationLog).toEqual([]);
    expect(v2.callbackDeliveryLog).toEqual([]);
    expect(v2.freezeBrokenAttackLog).toHaveLength(1);
    expect(v2.mechanicsStatus).toBe("partial");
    expect(v3.callbackRegistrationLog).toEqual([]);
    expect(v3.callbackDeliveryLog).toHaveLength(5);
    expect(v3.callbackDeliveryLog.map((row) => row.eventKind)).toEqual(
      CALLBACK_EVENT_KINDS,
    );
    expect(v3.callbackDeliveryLog.map((row) => row.eventIndex)).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(
      v3.callbackDeliveryLog.map((row) => row.parentCallbackDeliveryLogId),
    ).toEqual([null, 0, 1, 2, 3]);
    expect(v3.callbackDeliveryLog.map((row) => row.registryRevision)).toEqual([
      0, 0, 0, 0, 0,
    ]);
    expect(v3.callbackDeliveryLog.map((row) => row.subscriberAttempts)).toEqual([
      [], [], [], [], [],
    ]);

    const audit = v3.freezeBrokenAttackLog[0]!;
    expect(audit).toMatchObject({
      id: 0,
      executionStatus: "callback-bus-dispatched-normalized",
      damageEventId: null,
      hitResolutionLogId: null,
      syncPhase: {
        disposition: "callback-bus-dispatched-normalized",
        callbackDeliveryLogIds: [0, 1, 2],
      },
      endOfFramePhase: {
        disposition: "callback-bus-dispatched-normalized",
        callbackDeliveryLogIds: [3, 4],
        damage: 0,
      },
    });
    expect(v3.callbackDeliveryLog.slice(0, 3).map((row) => row.phase)).toEqual([
      { kind: "same-call-stack-immediate" },
      { kind: "same-call-stack-immediate" },
      { kind: "same-call-stack-immediate" },
    ]);
    const enemyDamage = v3.callbackDeliveryLog[3]!;
    const attackCallback = v3.callbackDeliveryLog[4]!;
    expect(enemyDamage.payload).toEqual({
      kind: "freeze-broken-zero-damage",
      ability: "Freeze Broken",
      actualDamage: 0,
      crit: null,
      rngDisposition: "not-consumed",
    });
    expect(enemyDamage.phase).toMatchObject({
      kind: "zero-delay-core-task",
      scheduledAfterCallbackDeliveryLogId: 2,
      delayFrames: 0,
      localExecutionRelativeToTriggerEvent: "after-current-event",
    });
    expect(attackCallback.phase).toMatchObject({
      kind: "zero-delay-core-task",
      scheduledAfterCallbackDeliveryLogId: 2,
      delayFrames: 0,
    });
    if (
      enemyDamage.phase.kind !== "zero-delay-core-task" ||
      attackCallback.phase.kind !== "zero-delay-core-task"
    ) {
      throw new Error("the test fixture requires both zero-delay phases");
    }
    expect(attackCallback.phase.taskSequence).toBe(
      enemyDamage.phase.taskSequence,
    );
    expect(enemyDamage.eventPriority).toBe(audit.triggerEventPriority);
    expect(attackCallback.eventPriority).toBe(audit.triggerEventPriority);
    expect(v3.mechanicsStatus).toBe("partial");
    expect(
      v3.damageEvents.some((event) => event.actionName === "Freeze Broken"),
    ).toBe(false);
    expect(
      v3.hitResolutionLog.some((row) => row.actionName === "Freeze Broken"),
    ).toBe(false);
    expectCombatOutputEqual(v3, v2);
    expect(simulationResultV153Schema.safeParse(v3).success).toBe(true);
    expect(assertTrustedSimulationResultV153(v3)).toBe(v3);
  });

  it("settles each zero-delay task after its parent before the next target parent", () => {
    const config = makeInterleavedSwirlConfig();
    const v2 = simulateNoCrit(withModels(config, V2_MODEL, BUS_V1_MODEL));
    const result = simulateNoCrit(config);

    expect(result.freezeBrokenAttackLog).toHaveLength(2);
    expect(result.callbackDeliveryLog).toHaveLength(10);
    expect(result.callbackDeliveryLog.map((row) => row.eventIndex)).toEqual([
      0, 1, 2, 3, 4, 0, 1, 2, 3, 4,
    ]);
    expect(
      result.callbackDeliveryLog.map((row) => row.freezeBrokenAttackLogId),
    ).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
    expect(
      result.callbackDeliveryLog.map((row) => row.parentCallbackDeliveryLogId),
    ).toEqual([null, 0, 1, 2, 3, null, 5, 6, 7, 8]);
    expect(result.freezeBrokenAttackLog[0]).toMatchObject({
      syncPhase: { callbackDeliveryLogIds: [0, 1, 2] },
      endOfFramePhase: { callbackDeliveryLogIds: [3, 4] },
    });
    expect(result.freezeBrokenAttackLog[1]).toMatchObject({
      syncPhase: { callbackDeliveryLogIds: [5, 6, 7] },
      endOfFramePhase: { callbackDeliveryLogIds: [8, 9] },
    });
    expectCombatOutputEqual(result, v2);
    expect(assertTrustedSimulationResultV153(result)).toBe(result);
  });

  it.each(["before", "after"] as const)(
    "keeps global manifest order when the callback plugin is %s the damage plugin",
    (placement) => {
      const callbackPlugin = defineCallbackSubscriberPluginV153(
        {
          id: `test.callback-${placement}`,
          version: "1.0.0",
          kind: "code",
          contentHash: "fnv1a32:cb000001",
        },
        [
          {
            eventKind: "on-enemy-damage-freeze-broken-zero",
            subscriberKey: "freeze-audit",
          },
        ],
        () => ({
          handleCallback(context) {
            return {
              kind: "freeze-broken-audit",
              freezeBrokenAttackLogId: context.freezeBrokenAttackLogId,
              sourceFrozenStateLogId: context.sourceFrozenStateLogId,
            };
          },
        }),
      );
      const damagePlugin = defineDamageModifierPlugin(
        {
          id: `test.damage-${placement}`,
          version: "1.0.0",
          kind: "code",
          contentHash: "fnv1a32:da000001",
        },
        () => ({ modifyDamage() {} }),
      );
      const plugins =
        placement === "before"
          ? [callbackPlugin, damagePlugin]
          : [damagePlugin, callbackPlugin];
      const callbackManifestIndex = placement === "before" ? 0 : 1;
      const result = simulateNoCrit(makeNaturalExpiryConfig(), plugins);
      const repeated = simulateNoCrit(makeNaturalExpiryConfig(), plugins);

      expect(result).toEqual(repeated);
      expect(result.pluginManifest).toEqual(result.runManifest.plugins);
      expect(result.reproducibilityKey).toBe(repeated.reproducibilityKey);
      expect(result.pluginManifest.map((entry) => entry.id)).toEqual(
        plugins.map((plugin) => plugin.descriptor.id),
      );
      expect(result.runManifest.pluginCapabilities).toEqual(
        placement === "before"
          ? ["callback-subscriber", "damage-modifier"]
          : ["damage-modifier", "callback-subscriber"],
      );
      expect(result.callbackRegistrationLog).toEqual([
        expect.objectContaining({
          id: 0,
          eventKind: "on-enemy-damage-freeze-broken-zero",
          subscriberKey: "freeze-audit",
          sourceKind: "plugin",
          pluginManifestIndex: callbackManifestIndex,
          pluginId: callbackPlugin.descriptor.id,
          subscriberAttemptRefs: [
            { callbackDeliveryLogId: 3, attemptIndex: 0 },
          ],
        }),
      ]);
      expect(result.callbackDeliveryLog[3]!.subscriberAttempts).toEqual([
        expect.objectContaining({
          index: 0,
          slotIndex: 0,
          registrationLogId: 0,
          subscriptionId: 0,
          subscriberKey: "freeze-audit",
          pluginManifestIndex: callbackManifestIndex,
          pluginId: callbackPlugin.descriptor.id,
          status: "completed",
          outcomeVerification:
            "structural-only-unverified-runtime-output-v1",
          outcome: {
            kind: "freeze-broken-audit",
            freezeBrokenAttackLogId: 0,
            sourceFrozenStateLogId:
              result.freezeBrokenAttackLog[0]!.sourceFrozenStateLogId,
          },
        }),
      ]);
      expect(
        result.callbackDeliveryLog
          .filter((row) => row.id !== 3)
          .every((row) => row.subscriberAttempts.length === 0),
      ).toBe(true);
      for (const directGroup of result.directDamageGroupLog) {
        expect(directGroup.pluginMultiplierTrace).toHaveLength(2);
        const callbackTrace =
          directGroup.pluginMultiplierTrace[callbackManifestIndex];
        expect(callbackTrace).toMatchObject({
          pluginManifestIndex: callbackManifestIndex,
          pluginId: callbackPlugin.descriptor.id,
          outcome: "no-change",
        });
        expect(callbackTrace?.outputMultiplier).toBe(
          callbackTrace?.inputMultiplier,
        );
      }
      expect(assertTrustedSimulationResultV153(result)).toBe(result);
    },
  );

  it("binds normalized callback subscriptions into the reproducibility identity", () => {
    const descriptor = {
      id: "test.callback-subscription-identity",
      version: "1.0.0",
      kind: "code" as const,
      contentHash: "fnv1a32:cafe0153",
    };
    const createPlugin = (
      eventKind: "on-enemy-hit-freeze-broken" | "on-enemy-damage-freeze-broken-zero",
      subscriberKey: string,
    ) =>
      defineCallbackSubscriberPluginV153(
        descriptor,
        [{ eventKind, subscriberKey }],
        () => ({ handleCallback: () => ({ kind: "no-side-effect" }) }),
      );
    const enemyHit = simulateNoCrit(makeNaturalExpiryConfig(), [
      createPlugin("on-enemy-hit-freeze-broken", "identity-binding"),
    ]);
    const enemyDamage = simulateNoCrit(makeNaturalExpiryConfig(), [
      createPlugin(
        "on-enemy-damage-freeze-broken-zero",
        "identity-binding",
      ),
    ]);

    expect(enemyHit.pluginManifest).toEqual(enemyDamage.pluginManifest);
    expect(enemyHit.runManifest.pluginCapabilities).toEqual(
      enemyDamage.runManifest.pluginCapabilities,
    );
    expect(enemyHit.runManifest.pluginCallbackSubscriptions).toEqual([[{
      eventKind: "on-enemy-hit-freeze-broken",
      subscriberKey: "identity-binding",
    }]]);
    expect(enemyDamage.runManifest.pluginCallbackSubscriptions).toEqual([[{
      eventKind: "on-enemy-damage-freeze-broken-zero",
      subscriberKey: "identity-binding",
    }]]);
    expect(enemyHit.reproducibilityKey).not.toBe(
      enemyDamage.reproducibilityKey,
    );
  });

  it("replaces a duplicate plugin subscriber key in its original slot", () => {
    const first = defineCallbackSubscriberPluginV153(
      {
        id: "test.callback-replaced",
        version: "1.0.0",
        kind: "code",
        contentHash: "fnv1a32:ca110001",
      },
      [
        {
          eventKind: "on-enemy-damage-freeze-broken-zero",
          subscriberKey: "same-slot",
        },
      ],
      () => ({ handleCallback: () => ({ kind: "no-side-effect" }) }),
    );
    const replacement = defineCallbackSubscriberPluginV153(
      {
        id: "test.callback-replacement",
        version: "1.0.0",
        kind: "code",
        contentHash: "fnv1a32:ca110002",
      },
      [
        {
          eventKind: "on-enemy-damage-freeze-broken-zero",
          subscriberKey: "same-slot",
        },
      ],
      () => ({
        handleCallback(context) {
          return {
            kind: "freeze-broken-audit",
            freezeBrokenAttackLogId: context.freezeBrokenAttackLogId,
            sourceFrozenStateLogId: context.sourceFrozenStateLogId,
          };
        },
      }),
    );
    const result = simulateNoCrit(makeNaturalExpiryConfig(), [
      first,
      replacement,
    ]);

    expect(result.callbackRegistrationLog).toEqual([
      expect.objectContaining({
        id: 0,
        operation: "subscribe",
        slotIndex: 0,
        previousSubscriptionId: null,
        currentSubscriptionId: 0,
        pluginManifestIndex: 0,
        subscriberAttemptRefs: [],
      }),
      expect.objectContaining({
        id: 1,
        operation: "replace",
        slotIndex: 0,
        previousSubscriptionId: 0,
        currentSubscriptionId: 1,
        pluginManifestIndex: 1,
        subscriberAttemptRefs: [
          { callbackDeliveryLogId: 3, attemptIndex: 0 },
        ],
      }),
    ]);
    expect(result.callbackDeliveryLog[3]!.subscriberAttempts).toEqual([
      expect.objectContaining({
        registrationLogId: 1,
        subscriptionId: 1,
        slotIndex: 0,
        pluginManifestIndex: 1,
        pluginId: replacement.descriptor.id,
      }),
    ]);
    expect(assertTrustedSimulationResultV153(result)).toBe(result);
  });

  it("fails fast when a callback subscriber throws", () => {
    const plugin = defineCallbackSubscriberPluginV153(
      {
        id: "test.throwing-callback",
        version: "1.0.0",
        kind: "code",
        contentHash: "fnv1a32:fa110001",
      },
      [
        {
          eventKind: "on-apply-attack-freeze-broken",
          subscriberKey: "throw-now",
        },
      ],
      () => ({
        handleCallback() {
          throw new Error("callback subscriber failure");
        },
      }),
    );

    expect(() =>
      simulateNoCrit(makeNaturalExpiryConfig(), [plugin]),
    ).toThrow("callback subscriber failure");
  });

  it("rejects a callback plugin outcome whose audit IDs drift", () => {
    const plugin = defineCallbackSubscriberPluginV153(
      {
        id: "test.invalid-callback-outcome",
        version: "1.0.0",
        kind: "code",
        contentHash: "fnv1a32:bad00001",
      },
      [
        {
          eventKind: "on-aura-durability-depleted-frozen",
          subscriberKey: "invalid-audit",
        },
      ],
      () => ({
        handleCallback(context) {
          return {
            kind: "freeze-broken-audit",
            freezeBrokenAttackLogId: context.freezeBrokenAttackLogId + 1,
            sourceFrozenStateLogId: context.sourceFrozenStateLogId,
          };
        },
      }),
    );

    expect(() =>
      simulateNoCrit(makeNaturalExpiryConfig(), [plugin]),
    ).toThrow(/audit references must match the current Freeze Broken context/);
  });

  it("keeps selector-only V3 runs complete and rejects V3 with the legacy bus", () => {
    const noFreeze = makeNaturalExpiryConfig();
    noFreeze.enemy.targets![0]!.initialAura = [];
    const selectorOnly = simulateNoCrit(noFreeze);

    expect(selectorOnly.freezeBrokenAttackLog).toEqual([]);
    expect(selectorOnly.callbackDeliveryLog).toEqual([]);
    expect(selectorOnly.mechanicsStatus).toBe("complete");
    expect(() =>
      simulateNoCrit(withModels(noFreeze, V3_MODEL, BUS_V1_MODEL)),
    ).toThrow(/callback bus|callbackBusModel|requires/i);
  });
});
