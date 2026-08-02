import {
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ROOT,
  GCSIM_DAMAGE_GROUP_ROOT,
  GCSIM_ELEMENTAL_APPLICATION_ROOT,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT
} from "@genshin-dps-lab/icd-profiles";
import { CLASSIC_REACTION_FORMULA_ROOT } from "@genshin-dps-lab/reaction-formulas";
import { describe, expect, it } from "vitest";

import {
  BASIC_REACTION_SCHEDULER_ENGINE_VERSION,
  BASIC_REACTION_SCHEDULER_RUN_MANIFEST_VERSION,
  BASIC_REACTION_SCHEDULER_SCHEMA_VERSION,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  migrateConfig,
  parseSimulationRunManifestForConfig,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
  REPRODUCIBILITY_IDENTITY_ALGORITHM,
  simConfigV150Schema,
  simConfigV151Schema,
  simulationRunManifestV151Schema
} from "./index";

const legacyConfig = {
  meta: { name: "basic-reaction-scheduler", version: "test-data-v1" },
  duration: 120,
  cycleLength: 20,
  enemy: { level: 110, resistance: 0.1, defReduction: 0 },
  characters: [
    {
      id: "actor",
      name: "Actor",
      element: "anemo",
      color: "#0cc",
      level: 90,
      energyMax: 60,
      initialEnergy: 0,
      stats: {}
    }
  ],
  rotation: []
};

const runtimeOptions = {
  energyMode: "configured" as const,
  critMode: "average" as const,
  compatibilityMode: "legal-frame-v1" as const,
  randomSeed: "basic-reaction-scheduler-seed"
};

function freezeAsV150() {
  const current = migrateConfig(legacyConfig);
  const {
    basicReactionSchedulerModel: _basicReactionSchedulerModel,
    freezeBrokenAttackModel: _freezeBrokenAttackModel,
    callbackBusModel: _callbackBusModel,
    ...payload
  } = current;
  return simConfigV150Schema.parse({
    ...payload,
    schemaVersion: REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
    engineVersion: REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION
  });
}

function makeNativeV151() {
  const {
    freezeBrokenAttackModel: _freezeBrokenAttackModel,
    callbackBusModel: _callbackBusModel,
    ...frozen
  } = migrateConfig(legacyConfig);
  return simConfigV151Schema.parse({
    ...frozen,
    schemaVersion: BASIC_REACTION_SCHEDULER_SCHEMA_VERSION,
    engineVersion: BASIC_REACTION_SCHEDULER_ENGINE_VERSION,
    basicReactionSchedulerModel: {
      mode: "fixed-gcsim-basic-reaction-scheduler-v2",
      policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID
    }
  });
}

describe("1.51 basic reaction scheduler identity", () => {
  it("retains the frozen 1.51 config and manifest identities", () => {
    expect(CURRENT_SCHEMA_VERSION).not.toBe(
      BASIC_REACTION_SCHEDULER_SCHEMA_VERSION
    );
    expect(CURRENT_ENGINE_VERSION).not.toBe(
      BASIC_REACTION_SCHEDULER_ENGINE_VERSION
    );
    expect(BASIC_REACTION_SCHEDULER_SCHEMA_VERSION).toBe("1.51.0");
    expect(BASIC_REACTION_SCHEDULER_ENGINE_VERSION).toBe(
      "1.51.0-basic-reaction-scheduler"
    );
    expect(BASIC_REACTION_SCHEDULER_RUN_MANIFEST_VERSION).toBe("1.7.0");
  });

  it("migrates an exact 1.50 wire with the legacy V1 scheduler only", () => {
    const frozen = freezeAsV150();
    const migrated = migrateConfig(frozen);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
    expect(migrated.basicReactionSchedulerModel).toEqual({
      mode: "legacy-immediate-basic-reaction-scheduler-v1",
      policyId: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID
    });
    expect(migrated.reactionDamageGroupModel).toEqual(
      frozen.reactionDamageGroupModel
    );
  });

  it("requires a native 1.51 own model and rejects historical future fields", () => {
    const native = makeNativeV151();
    expect(native.basicReactionSchedulerModel.mode).toBe(
      "fixed-gcsim-basic-reaction-scheduler-v2"
    );

    const {
      basicReactionSchedulerModel: _basicReactionSchedulerModel,
      ...missingModel
    } = native;
    expect(simConfigV151Schema.safeParse(missingModel).success).toBe(false);
    expect(() => migrateConfig(missingModel)).toThrow(
      /basicReactionSchedulerModel/
    );

    const inheritedModel = Object.create({
      mode: "fixed-gcsim-basic-reaction-scheduler-v2",
      policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID
    });
    expect(() =>
      migrateConfig({
        ...native,
        basicReactionSchedulerModel: inheritedModel
      })
    ).toThrow();

    const frozen = freezeAsV150();
    expect(() =>
      migrateConfig({
        ...frozen,
        basicReactionSchedulerModel: native.basicReactionSchedulerModel
      })
    ).toThrow(/does not support basic-reaction scheduler policy selection/);
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        basicReactionSchedulerModel: native.basicReactionSchedulerModel
      })
    ).toThrow(/does not support basic-reaction scheduler policy selection/);
  });

  it("binds the current manifest to the exact selected scheduler root", () => {
    const config = makeNativeV151();
    const identity = {
      version: BASIC_REACTION_SCHEDULER_RUN_MANIFEST_VERSION,
      identityAlgorithm: REPRODUCIBILITY_IDENTITY_ALGORITHM,
      schemaVersion: BASIC_REACTION_SCHEDULER_SCHEMA_VERSION,
      engineVersion: BASIC_REACTION_SCHEDULER_ENGINE_VERSION,
      dataVersion: config.dataVersion,
      configHash: createSimulationConfigHash(config),
      resolvedRuntimeOptions: runtimeOptions,
      plugins: [],
      reactionFormulaRoot: CLASSIC_REACTION_FORMULA_ROOT,
      directDamageGroupRoot: GCSIM_DAMAGE_GROUP_ROOT,
      elementalApplicationIcdRoot: GCSIM_ELEMENTAL_APPLICATION_ROOT,
      reactionOwnedElementalApplicationRoot:
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
      reactionDamageGroupRoot:
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT,
      basicReactionSchedulerRoot:
        GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ROOT
    };
    const manifest = {
      ...identity,
      reproducibilityKey: createSimulationReproducibilityKey(identity)
    };
    expect(simulationRunManifestV151Schema.parse(manifest)).toEqual(manifest);
    expect(parseSimulationRunManifestForConfig(manifest, config)).toEqual(
      manifest
    );

    const {
      reproducibilityKey: _reproducibilityKey,
      ...forgedIdentity
    } = {
      ...manifest,
      basicReactionSchedulerRoot:
        LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT
    };
    const forgedManifest = {
      ...forgedIdentity,
      reproducibilityKey:
        createSimulationReproducibilityKey(forgedIdentity)
    };
    expect(simulationRunManifestV151Schema.parse(forgedManifest)).toEqual(
      forgedManifest
    );
    expect(() =>
      parseSimulationRunManifestForConfig(forgedManifest, config)
    ).toThrow(/not bound/);
  });
});
