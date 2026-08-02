import {
  GCSIM_CALLBACK_BUS_POLICY_V2_ID,
  GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
  GCSIM_CALLBACK_BUS_POLICY_V2_ROOT,
  GCSIM_DAMAGE_GROUP_ROOT,
  GCSIM_ELEMENTAL_APPLICATION_ROOT,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ROOT,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT,
  LEGACY_CALLBACK_BUS_POLICY_V1_ID,
  LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
  LEGACY_CALLBACK_BUS_POLICY_V1_ROOT,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT
} from "@genshin-dps-lab/icd-profiles";
import { CLASSIC_REACTION_FORMULA_ROOT } from "@genshin-dps-lab/reaction-formulas";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  CALLBACK_BUS_ENGINE_VERSION,
  CALLBACK_BUS_RUN_MANIFEST_VERSION,
  CALLBACK_BUS_SCHEMA_VERSION,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  createSimulationRunManifest,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  FREEZE_BROKEN_ATTACK_ENGINE_VERSION,
  FREEZE_BROKEN_ATTACK_SCHEMA_VERSION,
  migrateConfig,
  parseSimulationRunManifestForConfig,
  simConfigV152Schema,
  simConfigV153Schema,
  simulationRunManifestV152Schema,
  simulationRunManifestV153Schema,
  type FreezeBrokenAttackModelV152,
  type SimulationResultForV152,
  type SimulationResultForV153
} from "./index";

const legacyConfig = {
  meta: { name: "callback-bus", version: "test-data-v1" },
  duration: 120,
  cycleLength: 20,
  enemy: { level: 110, resistance: 0.1, defReduction: 0 },
  characters: [
    {
      id: "actor",
      name: "Actor",
      element: "cryo",
      color: "#9cf",
      level: 90,
      energyMax: 60,
      initialEnergy: 0,
      stats: {}
    }
  ],
  rotation: []
};

const legacyBusModel = {
  mode: LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
  policyId: LEGACY_CALLBACK_BUS_POLICY_V1_ID
} as const;

const callbackBusModel = {
  mode: GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
  policyId: GCSIM_CALLBACK_BUS_POLICY_V2_ID
} as const;

const freezeV3Model = {
  mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE,
  policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID
} as const;

function freezeAsV152(freezeBrokenAttackModel: FreezeBrokenAttackModelV152) {
  const {
    callbackBusModel: _callbackBusModel,
    ...current
  } = migrateConfig(legacyConfig);
  return simConfigV152Schema.parse({
    ...current,
    schemaVersion: FREEZE_BROKEN_ATTACK_SCHEMA_VERSION,
    engineVersion: FREEZE_BROKEN_ATTACK_ENGINE_VERSION,
    freezeBrokenAttackModel
  });
}

function makeNativeV153() {
  return simConfigV153Schema.parse({
    ...migrateConfig(legacyConfig),
    schemaVersion: CALLBACK_BUS_SCHEMA_VERSION,
    engineVersion: CALLBACK_BUS_ENGINE_VERSION,
    freezeBrokenAttackModel: freezeV3Model,
    callbackBusModel
  });
}

const runtimeOptions = {
  energyMode: "configured" as const,
  critMode: "average" as const,
  compatibilityMode: "legal-frame-v1" as const,
  randomSeed: "callback-bus-seed"
};

describe("1.53 callback-bus config and manifest identity", () => {
  it("advances current identity while keeping the exact 1.52 schemas frozen", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(CALLBACK_BUS_SCHEMA_VERSION);
    expect(CURRENT_ENGINE_VERSION).toBe(CALLBACK_BUS_ENGINE_VERSION);
    expect(CALLBACK_BUS_SCHEMA_VERSION).toBe("1.53.0");
    expect(CALLBACK_BUS_ENGINE_VERSION).toBe("1.53.0-callback-bus");
    expect(CALLBACK_BUS_RUN_MANIFEST_VERSION).toBe("1.9.0");

    const frozen = freezeAsV152({
      mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
      policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID
    });
    expect(
      simConfigV152Schema.safeParse({ ...frozen, callbackBusModel: legacyBusModel })
        .success
    ).toBe(false);
    expect(
      simConfigV152Schema.safeParse({
        ...frozen,
        freezeBrokenAttackModel: freezeV3Model
      }).success
    ).toBe(false);
  });

  it.each([
    {
      mode: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
      policyId: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID
    },
    {
      mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
      policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID
    }
  ] satisfies FreezeBrokenAttackModelV152[])(
    "migrates frozen 1.52 policy $policyId without changing it",
    (freezeBrokenAttackModel) => {
      const frozen = freezeAsV152(freezeBrokenAttackModel);
      const migrated = migrateConfig(frozen);
      expect(migrated.schemaVersion).toBe(CALLBACK_BUS_SCHEMA_VERSION);
      expect(migrated.engineVersion).toBe(CALLBACK_BUS_ENGINE_VERSION);
      expect(migrated.freezeBrokenAttackModel).toEqual(
        freezeBrokenAttackModel
      );
      expect(migrated.callbackBusModel).toEqual(legacyBusModel);
    }
  );

  it("accepts only the two declared Freeze Broken/callback-bus pair families", () => {
    const native = makeNativeV153();
    expect(native.freezeBrokenAttackModel).toEqual(freezeV3Model);
    expect(native.callbackBusModel).toEqual(callbackBusModel);

    const { callbackBusModel: _callbackBusModel, ...missingBus } = native;
    expect(simConfigV153Schema.safeParse(missingBus).success).toBe(false);
    expect(() => migrateConfig(missingBus)).toThrow(/callbackBusModel/);

    const inheritedBus = Object.create(callbackBusModel);
    expect(() =>
      migrateConfig({ ...native, callbackBusModel: inheritedBus })
    ).toThrow();

    expect(
      simConfigV153Schema.safeParse({
        ...native,
        callbackBusModel: legacyBusModel
      }).success
    ).toBe(false);
    expect(
      simConfigV153Schema.safeParse({
        ...native,
        freezeBrokenAttackModel: {
          mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
          policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID
        }
      }).success
    ).toBe(false);

    const compatibility = migrateConfig(legacyConfig);
    expect(simConfigV153Schema.parse(compatibility)).toEqual(compatibility);
  });

  it("rejects callback-bus fields on a frozen 1.52 migration wire", () => {
    const frozen = freezeAsV152({
      mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
      policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID
    });
    expect(() =>
      migrateConfig({ ...frozen, callbackBusModel: legacyBusModel })
    ).toThrow(/does not support callback-bus policy selection/);
  });

  it("binds both policy roots and rejects an illegal root pair", () => {
    const config = makeNativeV153();
    const manifest = createSimulationRunManifest({
      schemaVersion: CALLBACK_BUS_SCHEMA_VERSION,
      engineVersion: CALLBACK_BUS_ENGINE_VERSION,
      dataVersion: config.dataVersion,
      configHash: createSimulationConfigHash(config),
      resolvedRuntimeOptions: runtimeOptions,
      plugins: [],
      pluginCapabilities: [],
      pluginCallbackSubscriptions: [],
      reactionFormulaRoot: CLASSIC_REACTION_FORMULA_ROOT,
      directDamageGroupRoot: GCSIM_DAMAGE_GROUP_ROOT,
      elementalApplicationIcdRoot: GCSIM_ELEMENTAL_APPLICATION_ROOT,
      reactionOwnedElementalApplicationRoot:
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
      reactionDamageGroupRoot: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT,
      basicReactionSchedulerRoot:
        LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT,
      freezeBrokenAttackRoot: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ROOT,
      callbackBusRoot: GCSIM_CALLBACK_BUS_POLICY_V2_ROOT
    });
    expect(simulationRunManifestV153Schema.parse(manifest)).toEqual(manifest);
    expect(manifest.pluginCapabilities).toEqual([]);
    expect(manifest.pluginCallbackSubscriptions).toEqual([]);
    expect(parseSimulationRunManifestForConfig(manifest, config)).toEqual(
      manifest
    );

    const {
      pluginCapabilities: _pluginCapabilities,
      ...missingCapabilities
    } = manifest;
    expect(
      simulationRunManifestV153Schema.safeParse(missingCapabilities).success
    ).toBe(false);
    const {
      pluginCallbackSubscriptions: _pluginCallbackSubscriptions,
      ...missingSubscriptions
    } = manifest;
    expect(
      simulationRunManifestV153Schema.safeParse(missingSubscriptions).success
    ).toBe(false);
    const {
      reproducibilityKey: _mismatchedKey,
      ...mismatchedCapabilityIdentity
    } = {
      ...manifest,
      pluginCapabilities: ["damage-modifier" as const]
    };
    expect(
      simulationRunManifestV153Schema.safeParse({
        ...mismatchedCapabilityIdentity,
        reproducibilityKey: createSimulationReproducibilityKey(
          mismatchedCapabilityIdentity
        )
      }).success
    ).toBe(false);

    const {
      version: _version,
      identityAlgorithm: _identityAlgorithm,
      reproducibilityKey: _reproducibilityKey,
      ...manifestInput
    } = manifest;

    const descriptor = {
      order: 0,
      index: 0,
      id: "test.capability-identity",
      version: "1.0.0",
      kind: "code" as const,
      contentHash: "fnv1a32:11111111"
    };
    const manifestBase = {
      ...manifestInput,
      plugins: [descriptor]
    };
    const damageCapabilityManifest = createSimulationRunManifest({
      ...manifestBase,
      pluginCapabilities: ["damage-modifier"],
      pluginCallbackSubscriptions: [[]]
    });
    const callbackCapabilityManifest = createSimulationRunManifest({
      ...manifestBase,
      pluginCapabilities: ["callback-subscriber"],
      pluginCallbackSubscriptions: [[]]
    });
    expect(damageCapabilityManifest.reproducibilityKey).not.toBe(
      callbackCapabilityManifest.reproducibilityKey
    );
    expect(
      simulationRunManifestV153Schema.parse(callbackCapabilityManifest)
    ).toEqual(callbackCapabilityManifest);

    const callbackAtEnemyDamage = createSimulationRunManifest({
      ...manifestBase,
      pluginCapabilities: ["callback-subscriber"],
      pluginCallbackSubscriptions: [[{
        eventKind: "on-enemy-damage-freeze-broken-zero",
        subscriberKey: "identity-binding"
      }]]
    });
    const callbackAtEnemyHit = createSimulationRunManifest({
      ...manifestBase,
      pluginCapabilities: ["callback-subscriber"],
      pluginCallbackSubscriptions: [[{
        eventKind: "on-enemy-hit-freeze-broken",
        subscriberKey: "identity-binding"
      }]]
    });
    expect(callbackAtEnemyDamage.plugins).toEqual(callbackAtEnemyHit.plugins);
    expect(callbackAtEnemyDamage.pluginCapabilities).toEqual(
      callbackAtEnemyHit.pluginCapabilities
    );
    expect(callbackAtEnemyDamage.reproducibilityKey).not.toBe(
      callbackAtEnemyHit.reproducibilityKey
    );
    expect(simulationRunManifestV153Schema.parse(callbackAtEnemyDamage)).toEqual(
      callbackAtEnemyDamage
    );
    expect(simulationRunManifestV153Schema.parse(callbackAtEnemyHit)).toEqual(
      callbackAtEnemyHit
    );

    const orderedBindings = [
      {
        eventKind: "on-enemy-hit-freeze-broken" as const,
        subscriberKey: "first"
      },
      {
        eventKind: "on-enemy-hit-freeze-broken" as const,
        subscriberKey: "second"
      }
    ];
    const orderedManifest = createSimulationRunManifest({
      ...manifestBase,
      pluginCapabilities: ["callback-subscriber"],
      pluginCallbackSubscriptions: [orderedBindings]
    });
    const reversedManifest = createSimulationRunManifest({
      ...manifestBase,
      pluginCapabilities: ["callback-subscriber"],
      pluginCallbackSubscriptions: [[...orderedBindings].reverse()]
    });
    expect(orderedManifest.reproducibilityKey).not.toBe(
      reversedManifest.reproducibilityKey
    );

    const damageWithCallbackDeclaration = createSimulationRunManifest({
      ...manifestBase,
      pluginCapabilities: ["damage-modifier"],
      pluginCallbackSubscriptions: [[{
        eventKind: "on-enemy-hit-freeze-broken",
        subscriberKey: "illegal-damage-binding"
      }]]
    });
    expect(
      simulationRunManifestV153Schema.safeParse(damageWithCallbackDeclaration)
        .success
    ).toBe(false);

    const compatibilityManifest = createSimulationRunManifest({
      ...manifestInput,
      freezeBrokenAttackRoot: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
      callbackBusRoot: LEGACY_CALLBACK_BUS_POLICY_V1_ROOT
    });
    expect(
      simulationRunManifestV153Schema.parse(compatibilityManifest)
        .reproducibilityKey
    ).not.toBe(manifest.reproducibilityKey);

    const { reproducibilityKey: _key, ...illegalIdentity } = {
      ...manifest,
      callbackBusRoot: LEGACY_CALLBACK_BUS_POLICY_V1_ROOT
    };
    const illegalManifest = {
      ...illegalIdentity,
      reproducibilityKey: createSimulationReproducibilityKey(illegalIdentity)
    };
    expect(simulationRunManifestV153Schema.safeParse(illegalManifest).success).toBe(
      false
    );
  });

  it("keeps the frozen 1.52 manifest root surface unchanged", () => {
    const config = freezeAsV152({
      mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
      policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID
    });
    const manifest = createSimulationRunManifest({
      schemaVersion: FREEZE_BROKEN_ATTACK_SCHEMA_VERSION,
      engineVersion: FREEZE_BROKEN_ATTACK_ENGINE_VERSION,
      dataVersion: config.dataVersion,
      configHash: createSimulationConfigHash(config),
      resolvedRuntimeOptions: runtimeOptions,
      plugins: [],
      reactionFormulaRoot: CLASSIC_REACTION_FORMULA_ROOT,
      directDamageGroupRoot: GCSIM_DAMAGE_GROUP_ROOT,
      elementalApplicationIcdRoot: GCSIM_ELEMENTAL_APPLICATION_ROOT,
      reactionOwnedElementalApplicationRoot:
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
      reactionDamageGroupRoot: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT,
      basicReactionSchedulerRoot:
        LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT,
      freezeBrokenAttackRoot: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT
    });
    expect(simulationRunManifestV152Schema.parse(manifest)).toEqual(manifest);
    expect(parseSimulationRunManifestForConfig(manifest, config)).toEqual(
      manifest
    );
    expect(
      simulationRunManifestV152Schema.safeParse({
        ...manifest,
        pluginCapabilities: [],
        pluginCallbackSubscriptions: [],
      }).success
    ).toBe(false);
    expect(
      simulationRunManifestV152Schema.safeParse({
        ...manifest,
        freezeBrokenAttackRoot: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ROOT,
        callbackBusRoot: GCSIM_CALLBACK_BUS_POLICY_V2_ROOT
      }).success
    ).toBe(false);
    expect(LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT.policyId).toBe(
      LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID
    );
  });

  it("adds only the callback audit tables to the versioned result surface", () => {
    expectTypeOf<
      Exclude<keyof SimulationResultForV153, keyof SimulationResultForV152>
    >().toEqualTypeOf<"callbackRegistrationLog" | "callbackDeliveryLog">();
    expectTypeOf<
      "callbackRegistrationLog" extends keyof SimulationResultForV152
        ? true
        : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "callbackDeliveryLog" extends keyof SimulationResultForV152
        ? true
        : false
    >().toEqualTypeOf<false>();
  });
});
