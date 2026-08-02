import {
  GCSIM_DAMAGE_GROUP_ROOT,
  GCSIM_ELEMENTAL_APPLICATION_ROOT,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ROOT,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT
} from "@genshin-dps-lab/icd-profiles";
import { CLASSIC_REACTION_FORMULA_ROOT } from "@genshin-dps-lab/reaction-formulas";
import { describe, expect, it } from "vitest";

import {
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  createSimulationRunManifest,
  createVersionedContentHash,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  migrateConfig,
  parseSimulationRunManifestForConfig,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
  REPRODUCIBILITY_IDENTITY_ALGORITHM,
  simConfigV149Schema,
  simConfigV150Schema,
  simulationRunManifestV149Schema,
  simulationRunManifestV150Schema,
  type SimConfigV149,
  type SimConfigV150,
  type SimulationRunManifestV149
} from "./index";

const legacyConfig = {
  meta: { name: "reaction-damage-reset", version: "test-data-v1" },
  duration: 120,
  cycleLength: 20,
  enemy: { level: 110, resistance: 0.1, defReduction: 0 },
  characters: [
    {
      id: "actor",
      name: "Actor",
      element: "pyro",
      color: "#f00",
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
  randomSeed: "reaction-damage-reset-seed"
};

function freezeAsV149(config: SimConfigV150): SimConfigV149 {
  const {
    reactionDamageGroupModel: _reactionDamageGroupModel,
    ...payload
  } = config;
  return simConfigV149Schema.parse({
    ...payload,
    schemaVersion: REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
    engineVersion: REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION
  });
}

function createV149Manifest(config: SimConfigV149) {
  const identity = {
    version: REACTION_OWNED_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
    identityAlgorithm: REPRODUCIBILITY_IDENTITY_ALGORITHM,
    schemaVersion: REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
    engineVersion: REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
    dataVersion: config.dataVersion,
    configHash: createSimulationConfigHash(config),
    resolvedRuntimeOptions: runtimeOptions,
    plugins: [],
    reactionFormulaRoot: CLASSIC_REACTION_FORMULA_ROOT,
    directDamageGroupRoot: GCSIM_DAMAGE_GROUP_ROOT,
    elementalApplicationIcdRoot: GCSIM_ELEMENTAL_APPLICATION_ROOT,
    reactionOwnedElementalApplicationRoot:
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT
  } satisfies Omit<SimulationRunManifestV149, "reproducibilityKey">;
  return {
    ...identity,
    reproducibilityKey: createSimulationReproducibilityKey(identity)
  };
}

describe("1.50 reaction damage-group reset-boundary identity", () => {
  it("advances only current config and manifest identities", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe("1.50.0");
    expect(CURRENT_ENGINE_VERSION).toBe(
      "1.50.0-reaction-damage-reset-boundary"
    );
    expect(CURRENT_SCHEMA_VERSION).toBe(
      REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION
    );
    expect(CURRENT_ENGINE_VERSION).toBe(
      REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION
    );
    expect(REACTION_DAMAGE_GROUP_RESET_BOUNDARY_RUN_MANIFEST_VERSION).toBe(
      "1.6.0"
    );
    expect(REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION).toBe("1.49.0");
    expect(REACTION_OWNED_RESET_BOUNDARY_RUN_MANIFEST_VERSION).toBe("1.5.0");
  });

  it("migrates every historical wire to V1 and requires native V2 explicitly", () => {
    const migratedLegacy = migrateConfig(legacyConfig);
    expect(migratedLegacy.reactionDamageGroupModel).toEqual({
      mode: "legacy-reaction-damage-group-window-v1",
      policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID
    });

    const frozenV149 = freezeAsV149(migratedLegacy);
    const migratedV149 = migrateConfig(frozenV149);
    expect(migratedV149.reactionDamageGroupModel).toEqual(
      migratedLegacy.reactionDamageGroupModel
    );
    expect(migratedV149.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migratedV149.engineVersion).toBe(CURRENT_ENGINE_VERSION);

    const nativeV2 = simConfigV150Schema.parse({
      ...migratedV149,
      reactionDamageGroupModel: {
        mode: "fixed-gcsim-reaction-damage-task-order-v2",
        policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID
      }
    });
    expect(nativeV2.reactionDamageGroupModel.mode).toBe(
      "fixed-gcsim-reaction-damage-task-order-v2"
    );
    expect(() =>
      simConfigV150Schema.parse({
        ...nativeV2,
        reactionDamageGroupModel: {
          mode: "legacy-reaction-damage-group-window-v1",
          policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID
        }
      })
    ).toThrow();
  });

  it("strictly rejects future policy fields on 1.49 and legacy wires", () => {
    const current = migrateConfig(legacyConfig);
    const frozenV149 = freezeAsV149(current);
    expect(
      simConfigV149Schema.safeParse({
        ...frozenV149,
        reactionDamageGroupModel: current.reactionDamageGroupModel
      }).success
    ).toBe(false);
    expect(() =>
      migrateConfig({
        ...frozenV149,
        reactionDamageGroupModel: current.reactionDamageGroupModel
      })
    ).toThrow(/does not support reaction damage-group policy selection/);
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        reactionDamageGroupModel: current.reactionDamageGroupModel
      })
    ).toThrow(/does not support reaction damage-group policy selection/);
    const {
      reactionDamageGroupModel: _reactionDamageGroupModel,
      ...missingModel
    } = current;
    expect(() => simConfigV150Schema.parse(missingModel)).toThrow(
      /reactionDamageGroupModel/
    );
  });

  it("binds each current config to its exact selected damage-group root", () => {
    const migratedV1 = migrateConfig(legacyConfig);
    const nativeV2 = simConfigV150Schema.parse({
      ...migratedV1,
      reactionDamageGroupModel: {
        mode: "fixed-gcsim-reaction-damage-task-order-v2",
        policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID
      }
    });
    expect(createSimulationConfigHash(migratedV1)).not.toBe(
      createSimulationConfigHash(nativeV2)
    );
    const reproducibilityKeys: string[] = [];

    for (const [config, root, forgedRoot] of [
      [
        migratedV1,
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT,
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ROOT
      ],
      [
        nativeV2,
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V2_ROOT,
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT
      ]
    ] as const) {
      const manifest = createSimulationRunManifest({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        engineVersion: CURRENT_ENGINE_VERSION,
        dataVersion: config.dataVersion,
        configHash: createSimulationConfigHash(config),
        resolvedRuntimeOptions: runtimeOptions,
        plugins: [],
        reactionFormulaRoot: CLASSIC_REACTION_FORMULA_ROOT,
        directDamageGroupRoot: GCSIM_DAMAGE_GROUP_ROOT,
        elementalApplicationIcdRoot: GCSIM_ELEMENTAL_APPLICATION_ROOT,
        reactionOwnedElementalApplicationRoot:
          GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
        reactionDamageGroupRoot: root
      });
      expect(simulationRunManifestV150Schema.parse(manifest)).toEqual(
        manifest
      );
      expect(parseSimulationRunManifestForConfig(manifest, config)).toEqual(
        manifest
      );
      reproducibilityKeys.push(manifest.reproducibilityKey);

      const {
        reproducibilityKey: _reproducibilityKey,
        ...forgedIdentity
      } = {
        ...manifest,
        reactionDamageGroupRoot: forgedRoot
      };
      const forgedManifest = {
        ...forgedIdentity,
        reproducibilityKey:
          createSimulationReproducibilityKey(forgedIdentity)
      };
      expect(simulationRunManifestV150Schema.parse(forgedManifest)).toEqual(
        forgedManifest
      );
      expect(() =>
        parseSimulationRunManifestForConfig(forgedManifest, config)
      ).toThrow(/not bound/);
    }
    expect(new Set(reproducibilityKeys).size).toBe(2);
  });

  it("keeps the exact 1.49 config and manifest envelopes frozen", () => {
    const configV149 = freezeAsV149(migrateConfig(legacyConfig));
    const manifestV149 = createV149Manifest(configV149);
    expect(simConfigV149Schema.parse(configV149)).toEqual(configV149);
    expect(simulationRunManifestV149Schema.parse(manifestV149)).toEqual(
      manifestV149
    );
    expect(
      simulationRunManifestV149Schema.safeParse({
        ...manifestV149,
        reactionDamageGroupRoot:
          GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT
      }).success
    ).toBe(false);
    expect(createVersionedContentHash(configV149)).toBe(
      "fnv1a32:b2d4c480"
    );
    expect(manifestV149.reproducibilityKey).toBe(
      "gdl-v2-fnv1a32-0750fe45"
    );
  });
});
