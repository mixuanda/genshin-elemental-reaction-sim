import {
  GCSIM_DAMAGE_GROUP_ROOT,
  GCSIM_ELEMENTAL_APPLICATION_ROOT,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
} from "@genshin-dps-lab/icd-profiles";
import { CLASSIC_REACTION_FORMULA_ROOT } from "@genshin-dps-lab/reaction-formulas";
import { describe, expect, it } from "vitest";

import {
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  migrateConfig,
  REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION,
  REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
  REACTION_OWNED_APPLICATION_RUN_MANIFEST_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
  REPRODUCIBILITY_IDENTITY_ALGORITHM,
  simConfigV148Schema,
  simConfigV149Schema,
  simulationRunManifestV148Schema,
  simulationRunManifestV149Schema,
  type SimConfigV149,
  type SimConfigV150,
  type SimConfigV151,
  type SimulationRunManifestV148,
  type SimulationRunManifestV149,
} from "./index";

const legacyConfig = {
  meta: { name: "reset-boundary-schema", version: "test-data-v1" },
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
      stats: {},
    },
  ],
  rotation: [],
};

const runtimeOptions = {
  energyMode: "configured" as const,
  critMode: "average" as const,
  compatibilityMode: "legal-frame-v1" as const,
  randomSeed: "reset-boundary-seed",
};

function freezeAsV149(
  config: SimConfigV150 | SimConfigV151
): SimConfigV149 {
  const {
    reactionDamageGroupModel: _reactionDamageGroupModel,
    ...withPossibleScheduler
  } = config;
  const {
    basicReactionSchedulerModel: _basicReactionSchedulerModel,
    ...payload
  } = withPossibleScheduler as typeof withPossibleScheduler & {
    basicReactionSchedulerModel?: unknown;
  };
  return simConfigV149Schema.parse({
    ...payload,
    schemaVersion: REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
    engineVersion: REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
  });
}

describe("1.49 reaction-owned reset-boundary identity", () => {
  it("keeps the 1.49 schema, engine, and manifest identities frozen", () => {
    expect(REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION).toBe("1.49.0");
    expect(REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION).toBe(
      "1.49.0-reaction-owned-reset-boundary",
    );
    expect(CURRENT_SCHEMA_VERSION).not.toBe(
      REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
    );
    expect(CURRENT_ENGINE_VERSION).not.toBe(
      REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
    );
    expect(REACTION_OWNED_RESET_BOUNDARY_RUN_MANIFEST_VERSION).toBe("1.5.0");
    expect(REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION).toBe("1.48.0");
    expect(REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION).toBe(
      "1.48.0-reaction-owned-application-root",
    );
    expect(REACTION_OWNED_APPLICATION_RUN_MANIFEST_VERSION).toBe("1.4.0");
  });

  it("preserves v1 for every historical migration and admits v2 only explicitly", () => {
    const migratedLegacy = migrateConfig(legacyConfig);
    expect(migratedLegacy.reactionOwnedElementalApplicationModel).toEqual({
      mode: "fixed-gcsim-reaction-owned-application-v1",
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
    });

    const frozenV149 = freezeAsV149(migratedLegacy);
    const frozenV148 = simConfigV148Schema.parse({
      ...frozenV149,
      schemaVersion: REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
      engineVersion: REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION,
    });
    const migratedV148 = migrateConfig(frozenV148);
    expect(migratedV148.reactionOwnedElementalApplicationModel).toEqual(
      frozenV148.reactionOwnedElementalApplicationModel,
    );
    expect(migratedV148.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migratedV148.engineVersion).toBe(CURRENT_ENGINE_VERSION);

    const explicitV2 = simConfigV149Schema.parse({
      ...frozenV149,
      reactionOwnedElementalApplicationModel: {
        mode: "fixed-gcsim-reaction-owned-application-v2",
        policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT.policyId,
      },
    });
    expect(explicitV2.reactionOwnedElementalApplicationModel.mode).toBe(
      "fixed-gcsim-reaction-owned-application-v2",
    );
    expect(() =>
      simConfigV148Schema.parse({
        ...frozenV148,
        reactionOwnedElementalApplicationModel:
          explicitV2.reactionOwnedElementalApplicationModel,
      }),
    ).toThrow();
  });

  it("binds the 1.49 manifest to the exact selected v1 or v2 root", () => {
    const configV1 = freezeAsV149(migrateConfig(legacyConfig));
    const configV2 = simConfigV149Schema.parse({
      ...configV1,
      reactionOwnedElementalApplicationModel: {
        mode: "fixed-gcsim-reaction-owned-application-v2",
        policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT.policyId,
      },
    });

    for (const [config, root] of [
      [configV1, GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT],
      [configV2, GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT],
    ] as const) {
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
        reactionOwnedElementalApplicationRoot: root,
      } satisfies Omit<SimulationRunManifestV149, "reproducibilityKey">;
      const manifest = {
        ...identity,
        reproducibilityKey: createSimulationReproducibilityKey(identity),
      };
      expect(manifest.version).toBe(
        REACTION_OWNED_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
      );
      expect(simulationRunManifestV149Schema.parse(manifest)).toEqual(manifest);
      expect(manifest.reactionOwnedElementalApplicationRoot.policyId).toBe(
        config.reactionOwnedElementalApplicationModel.policyId,
      );
    }
  });

  it("keeps the exact 1.48 manifest root frozen to v1", () => {
    const configV149 = freezeAsV149(migrateConfig(legacyConfig));
    const configV148 = simConfigV148Schema.parse({
      ...configV149,
      schemaVersion: REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
      engineVersion: REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION,
    });
    const identity = {
      version: REACTION_OWNED_APPLICATION_RUN_MANIFEST_VERSION,
      identityAlgorithm: REPRODUCIBILITY_IDENTITY_ALGORITHM,
      schemaVersion: REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
      engineVersion: REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION,
      dataVersion: configV148.dataVersion,
      configHash: createSimulationConfigHash(configV148),
      resolvedRuntimeOptions: runtimeOptions,
      plugins: [],
      reactionFormulaRoot: CLASSIC_REACTION_FORMULA_ROOT,
      directDamageGroupRoot: GCSIM_DAMAGE_GROUP_ROOT,
      elementalApplicationIcdRoot: GCSIM_ELEMENTAL_APPLICATION_ROOT,
      reactionOwnedElementalApplicationRoot:
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
    } satisfies Omit<SimulationRunManifestV148, "reproducibilityKey">;
    const manifest = {
      ...identity,
      reproducibilityKey: createSimulationReproducibilityKey(identity),
    };
    expect(simulationRunManifestV148Schema.parse(manifest)).toEqual(manifest);
    expect(
      simulationRunManifestV148Schema.safeParse({
        ...manifest,
        reactionOwnedElementalApplicationRoot:
          GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT,
      }).success,
    ).toBe(false);
  });
});
