import {
  GCSIM_CALLBACK_BUS_POLICY_V2_ID,
  GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE,
  LEGACY_CALLBACK_BUS_POLICY_V1_ID,
  LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
  LEGACY_CALLBACK_BUS_POLICY_V1_ROOT,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
} from "@genshin-dps-lab/icd-profiles";
import {
  FREEZE_BROKEN_ATTACK_ENGINE_VERSION,
  FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION,
  FREEZE_BROKEN_ATTACK_SCHEMA_VERSION,
  assertTrustedSimulationResultV152,
  assertTrustedSimulationResultV153,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  simulationResultV152Schema,
  simulationResultV153Schema,
  type CallbackBusModel,
  type FreezeBrokenAttackModel,
  type SimConfig,
  type SimulationResultForV153,
  type SimulationRunManifestV153,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import {
  makeConfig,
  neutralStats,
} from "../../sim-core/src/__tests__/fixtures";
import {
  defineCallbackSubscriberPluginV153,
  defineDamageModifierPlugin,
} from "../../sim-core/src";
import { simulate } from "../../sim-core/src/simulator";
import { projectSimulationResultV153ToV152 } from "./project-v153-to-v152";

const NO_CRIT = {
  compatibilityMode: "legal-frame-v1",
  critMode: "noCrit",
  randomSeed: "v153-to-v152-projection",
} as const;

const LEGACY_CALLBACK_BUS = {
  mode: LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
  policyId: LEGACY_CALLBACK_BUS_POLICY_V1_ID,
} as const satisfies CallbackBusModel;

const FIXED_CALLBACK_BUS = {
  mode: GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
  policyId: GCSIM_CALLBACK_BUS_POLICY_V2_ID,
} as const satisfies CallbackBusModel;

const LEGACY_FREEZE_BROKEN = {
  mode: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
  policyId: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
} as const satisfies FreezeBrokenAttackModel;

const AUDIT_ONLY_FREEZE_BROKEN = {
  mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
} as const satisfies FreezeBrokenAttackModel;

const DISPATCHED_FREEZE_BROKEN = {
  mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE,
  policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID,
} as const satisfies FreezeBrokenAttackModel;

function runEmpty(
  callbackBusModel: CallbackBusModel,
  freezeBrokenAttackModel: FreezeBrokenAttackModel,
) {
  return simulate(
    makeConfig({ callbackBusModel, freezeBrokenAttackModel }),
    NO_CRIT,
  );
}

function makeNaturalExpiryConfig(
  callbackBusModel: CallbackBusModel,
  freezeBrokenAttackModel: FreezeBrokenAttackModel,
): SimConfig {
  const base = makeConfig({ callbackBusModel, freezeBrokenAttackModel });
  const template = base.characters[0]!;
  return {
    ...base,
    duration: 4,
    cycleLength: 4,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      freezeResistance: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Projection frozen target",
          initialAura: [{ element: "cryo", gaugeUnits: 1 }],
        },
      ],
    },
    characters: [
      {
        ...template,
        id: "hydro",
        name: "Projection Hydro",
        element: "hydro",
        level: 90,
        stats: { ...neutralStats, baseAtk: 1000 },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "hydro",
      swapFrames: 1,
      abilities: [
        {
          id: "hydro-freeze",
          actorId: "hydro",
          name: "Hydro Freeze",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "hydro-freeze-hit",
              label: "Freeze",
              frame: 0,
              scaling: 1,
              element: "hydro",
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
          actorId: "hydro",
          abilityId: "hydro-freeze",
        },
      ],
    },
  };
}

function runNaturalExpiry(
  callbackBusModel: CallbackBusModel,
  freezeBrokenAttackModel: FreezeBrokenAttackModel,
) {
  return simulate(
    makeNaturalExpiryConfig(callbackBusModel, freezeBrokenAttackModel),
    NO_CRIT,
  );
}

function rebindV152CompatibilityPolicies(
  result: SimulationResultForV153,
): SimulationResultForV153 {
  const rebound = structuredClone(result);
  rebound.config.callbackBusModel = LEGACY_CALLBACK_BUS;
  rebound.config.freezeBrokenAttackModel = AUDIT_ONLY_FREEZE_BROKEN;
  const configHash = createSimulationConfigHash(rebound.config);
  const { reproducibilityKey: _reproducibilityKey, ...manifestRest } =
    rebound.runManifest;
  const manifestIdentity: Omit<
    SimulationRunManifestV153,
    "reproducibilityKey"
  > = {
    ...manifestRest,
    configHash,
    callbackBusRoot: LEGACY_CALLBACK_BUS_POLICY_V1_ROOT,
    freezeBrokenAttackRoot: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
  };
  rebound.runManifest = {
    ...manifestIdentity,
    reproducibilityKey: createSimulationReproducibilityKey(manifestIdentity),
  };
  rebound.reproducibilityKey = rebound.runManifest.reproducibilityKey;
  return rebound;
}

describe("V1.53 to frozen V1.52 result projection", () => {
  it.each([
    ["Freeze Broken V1", LEGACY_FREEZE_BROKEN],
    ["Freeze Broken V2", AUDIT_ONLY_FREEZE_BROKEN],
  ] as const)(
    "projects inactive callback-bus V1 with %s and rebuilds exact V1.52 identity",
    (_label, freezeBrokenAttackModel) => {
      const current = runEmpty(LEGACY_CALLBACK_BUS, freezeBrokenAttackModel);
      expect(current.callbackRegistrationLog).toEqual([]);
      expect(current.callbackDeliveryLog).toEqual([]);
      expect(simulationResultV153Schema.parse(current)).toEqual(current);
      expect(assertTrustedSimulationResultV153(current)).toBe(current);

      const projected = projectSimulationResultV153ToV152(current);
      expect(simulationResultV152Schema.parse(projected)).toEqual(projected);
      expect(assertTrustedSimulationResultV152(projected)).toBe(projected);
      expect(projected.schemaVersion).toBe(FREEZE_BROKEN_ATTACK_SCHEMA_VERSION);
      expect(projected.engineVersion).toBe(FREEZE_BROKEN_ATTACK_ENGINE_VERSION);
      expect(projected.runManifest.version).toBe(
        FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION,
      );
      expect(Object.hasOwn(projected.config, "callbackBusModel")).toBe(false);
      expect(Object.hasOwn(projected.runManifest, "callbackBusRoot")).toBe(
        false,
      );
      expect(
        Object.hasOwn(projected.runManifest, "pluginCapabilities"),
      ).toBe(false);
      expect(
        Object.hasOwn(projected.runManifest, "pluginCallbackSubscriptions"),
      ).toBe(false);
      expect(Object.hasOwn(projected, "callbackRegistrationLog")).toBe(false);
      expect(Object.hasOwn(projected, "callbackDeliveryLog")).toBe(false);
      expect(projected.runManifest.configHash).toBe(
        createSimulationConfigHash(projected.config),
      );
      const { reproducibilityKey: _reproducibilityKey, ...manifestIdentity } =
        projected.runManifest;
      expect(projected.reproducibilityKey).toBe(
        createSimulationReproducibilityKey(manifestIdentity),
      );
      expect(projected.totalDamage).toBe(current.totalDamage);
      expect(projected.damageEvents).toEqual(current.damageEvents);
      expect(projected.freezeBrokenAttackLog).toEqual(
        current.freezeBrokenAttackLog,
      );
    },
  );

  it("preserves a V2 audit-only Freeze Broken row under callback-bus V1", () => {
    const current = runNaturalExpiry(
      LEGACY_CALLBACK_BUS,
      AUDIT_ONLY_FREEZE_BROKEN,
    );
    expect(current.freezeBrokenAttackLog.length).toBeGreaterThan(0);
    expect(
      current.freezeBrokenAttackLog.every(
        (entry) =>
          entry.executionStatus === "reference-audit-only-not-dispatched",
      ),
    ).toBe(true);
    expect(current.callbackRegistrationLog).toEqual([]);
    expect(current.callbackDeliveryLog).toEqual([]);

    const projected = projectSimulationResultV153ToV152(current);
    expect(assertTrustedSimulationResultV152(projected)).toBe(projected);
    expect(projected.freezeBrokenAttackLog).toEqual(
      current.freezeBrokenAttackLog,
    );
  });

  it("strips a damage-modifier capability while preserving its frozen plugin entry", () => {
    const damagePlugin = defineDamageModifierPlugin(
      {
        id: "test.projectable-damage-plugin",
        version: "1.0.0",
        kind: "code",
        contentHash: "fnv1a32:da000152",
      },
      () => ({ modifyDamage() {} }),
    );
    const current = simulate(
      makeConfig({
        callbackBusModel: LEGACY_CALLBACK_BUS,
        freezeBrokenAttackModel: AUDIT_ONLY_FREEZE_BROKEN,
      }),
      { ...NO_CRIT, plugins: [damagePlugin] },
    );
    expect(current.runManifest.pluginCapabilities).toEqual([
      "damage-modifier",
    ]);

    const projected = projectSimulationResultV153ToV152(current);
    expect(projected.pluginManifest).toEqual(current.pluginManifest);
    expect(projected.runManifest.plugins).toEqual(current.runManifest.plugins);
    expect(Object.hasOwn(projected.runManifest, "pluginCapabilities")).toBe(
      false,
    );
    expect(assertTrustedSimulationResultV152(projected)).toBe(projected);
  });

  it("fails closed for an otherwise inactive callback-subscriber capability", () => {
    const callbackPlugin = defineCallbackSubscriberPluginV153(
      {
        id: "test.unprojectable-callback-plugin",
        version: "1.0.0",
        kind: "code",
        contentHash: "fnv1a32:cb000153",
      },
      [],
      () => ({ handleCallback: () => ({ kind: "no-side-effect" }) }),
    );
    const current = simulate(
      makeConfig({
        callbackBusModel: FIXED_CALLBACK_BUS,
        freezeBrokenAttackModel: DISPATCHED_FREEZE_BROKEN,
      }),
      { ...NO_CRIT, plugins: [callbackPlugin] },
    );
    expect(current.callbackRegistrationLog).toEqual([]);
    expect(current.callbackDeliveryLog).toEqual([]);
    expect(current.runManifest.pluginCapabilities).toEqual([
      "callback-subscriber",
    ]);
    expect(assertTrustedSimulationResultV153(current)).toBe(current);

    expect(() => projectSimulationResultV153ToV152(current)).toThrow(
      /cannot represent callback-subscriber capability/i,
    );
  });

  it("fails closed for callback-bus V2 even when no callback fires", () => {
    const current = runEmpty(FIXED_CALLBACK_BUS, DISPATCHED_FREEZE_BROKEN);
    expect(current.callbackRegistrationLog).toEqual([]);
    expect(current.callbackDeliveryLog).toEqual([]);
    expect(assertTrustedSimulationResultV153(current)).toBe(current);

    expect(() => projectSimulationResultV153ToV152(current)).toThrow(
      /requires callback bus V1/i,
    );
  });

  it("fails closed for an active V3 Freeze Broken callback delivery", () => {
    const current = runNaturalExpiry(
      FIXED_CALLBACK_BUS,
      DISPATCHED_FREEZE_BROKEN,
    );
    expect(current.callbackDeliveryLog).toHaveLength(5);
    expect(
      current.freezeBrokenAttackLog.some(
        (entry) =>
          entry.executionStatus === "callback-bus-dispatched-normalized",
      ),
    ).toBe(true);
    expect(assertTrustedSimulationResultV153(current)).toBe(current);

    expect(() => projectSimulationResultV153ToV152(current)).toThrow(
      /callback bus V1|Freeze Broken V3|callback delivery/i,
    );
  });

  it("rejects callback logs before any V1.53 proof can be stripped", () => {
    const current = runEmpty(FIXED_CALLBACK_BUS, DISPATCHED_FREEZE_BROKEN);
    const forged = rebindV152CompatibilityPolicies(current);
    expect(assertTrustedSimulationResultV153(forged)).toBe(forged);
    forged.callbackRegistrationLog = [
      {
        id: 0,
        registryRevision: 1,
        eventKind: "on-apply-attack-freeze-broken",
        subscriberKey: "forged",
        slotIndex: 0,
        operation: "subscribe",
        previousSubscriptionId: null,
        currentSubscriptionId: 0,
        sourceKind: "core",
        pluginManifestIndex: null,
        pluginId: null,
        subscriberAttemptRefs: [],
      },
    ];

    expect(() => projectSimulationResultV153ToV152(forged)).toThrow(
      /callback|registration|legacy|V1/i,
    );
  });

  it("rejects a mismatched callback-bus config/root before stripping identity", () => {
    const current = runEmpty(LEGACY_CALLBACK_BUS, AUDIT_ONLY_FREEZE_BROKEN);
    const mismatched = structuredClone(current);
    mismatched.config.callbackBusModel = FIXED_CALLBACK_BUS;

    expect(() => projectSimulationResultV153ToV152(mismatched)).toThrow(
      /callback|root|policy|configHash|manifest/i,
    );
  });

  it("rejects a forged callback-bus trust root before it can be discarded", () => {
    const current = structuredClone(
      runEmpty(LEGACY_CALLBACK_BUS, AUDIT_ONLY_FREEZE_BROKEN),
    );
    const forged = current as unknown as {
      runManifest: { callbackBusRoot: { contentHash: string } };
    };
    forged.runManifest.callbackBusRoot.contentHash = `sha256:${"0".repeat(64)}`;

    expect(() =>
      projectSimulationResultV153ToV152(
        forged as unknown as SimulationResultForV153,
      ),
    ).toThrow(/callback|root|contentHash/i);
  });

  it("does not mutate the validated V1.53 source", () => {
    const current = runNaturalExpiry(
      LEGACY_CALLBACK_BUS,
      AUDIT_ONLY_FREEZE_BROKEN,
    );
    const before = structuredClone(current);

    projectSimulationResultV153ToV152(current);
    expect(current).toEqual(before);
    expect(current.runManifest.callbackBusRoot).toEqual(
      LEGACY_CALLBACK_BUS_POLICY_V1_ROOT,
    );
  });

  it("preserves authored key order in unchanged historical nested wires", () => {
    const current = runNaturalExpiry(
      LEGACY_CALLBACK_BUS,
      AUDIT_ONLY_FREEZE_BROKEN,
    );
    const projected = projectSimulationResultV153ToV152(current);
    const currentApplication = current.elementalApplicationIcdLog[0]!;
    const projectedApplication = projected.elementalApplicationIcdLog[0]!;

    expect(Object.keys(projectedApplication)).toEqual(
      Object.keys(currentApplication),
    );
  });
});
