import {
  GCSIM_DAMAGE_GROUP_ROOT,
  GCSIM_ELEMENTAL_APPLICATION_ROOT,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT
} from "@genshin-dps-lab/icd-profiles";
import { CLASSIC_REACTION_FORMULA_ROOT } from "@genshin-dps-lab/reaction-formulas";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  BASIC_REACTION_SCHEDULER_ENGINE_VERSION,
  BASIC_REACTION_SCHEDULER_SCHEMA_VERSION,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  createSimulationRunManifest,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  FREEZE_BROKEN_ATTACK_ENGINE_VERSION,
  FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION,
  FREEZE_BROKEN_ATTACK_SCHEMA_VERSION,
  migrateConfig,
  parseSimulationRunManifestForConfig,
  simConfigV151Schema,
  simConfigV152Schema,
  simulationRunManifestV152Schema,
  type SimulationResultForV151,
  type SimulationResultForV152
} from "./index";

const legacyConfig = {
  meta: { name: "freeze-broken-attack", version: "test-data-v1" },
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

const runtimeOptions = {
  energyMode: "configured" as const,
  critMode: "average" as const,
  compatibilityMode: "legal-frame-v1" as const,
  randomSeed: "freeze-broken-attack-seed"
};

function freezeAsV151() {
  const {
    freezeBrokenAttackModel: _freezeBrokenAttackModel,
    ...frozen
  } = migrateConfig(legacyConfig);
  return simConfigV151Schema.parse({
    ...frozen,
    schemaVersion: BASIC_REACTION_SCHEDULER_SCHEMA_VERSION,
    engineVersion: BASIC_REACTION_SCHEDULER_ENGINE_VERSION
  });
}

function makeNativeV152() {
  return simConfigV152Schema.parse({
    ...migrateConfig(legacyConfig),
    freezeBrokenAttackModel: {
      mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
      policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID
    }
  });
}

describe("1.52 Freeze Broken attack identity", () => {
  it("advances only the current config and manifest identities", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(FREEZE_BROKEN_ATTACK_SCHEMA_VERSION);
    expect(CURRENT_ENGINE_VERSION).toBe(FREEZE_BROKEN_ATTACK_ENGINE_VERSION);
    expect(FREEZE_BROKEN_ATTACK_SCHEMA_VERSION).toBe("1.52.0");
    expect(FREEZE_BROKEN_ATTACK_ENGINE_VERSION).toBe(
      "1.52.0-freeze-broken-attack"
    );
    expect(FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION).toBe("1.8.0");
  });

  it("migrates an exact 1.51 wire with the legacy V1 policy", () => {
    const frozen = freezeAsV151();
    const migrated = migrateConfig(frozen);

    expect(migrated.schemaVersion).toBe(FREEZE_BROKEN_ATTACK_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(FREEZE_BROKEN_ATTACK_ENGINE_VERSION);
    expect(migrated.freezeBrokenAttackModel).toEqual({
      mode: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
      policyId: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID
    });
    expect(migrated.basicReactionSchedulerModel).toEqual(
      frozen.basicReactionSchedulerModel
    );
  });

  it("requires an explicit native 1.52 policy and rejects future fields", () => {
    const native = makeNativeV152();
    expect(native.freezeBrokenAttackModel.mode).toBe(
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE
    );

    const {
      freezeBrokenAttackModel: _freezeBrokenAttackModel,
      ...missingModel
    } = native;
    expect(simConfigV152Schema.safeParse(missingModel).success).toBe(false);
    expect(() => migrateConfig(missingModel)).toThrow(
      /freezeBrokenAttackModel/
    );

    const inheritedModel = Object.create({
      mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
      policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID
    });
    expect(() =>
      migrateConfig({
        ...native,
        freezeBrokenAttackModel: inheritedModel
      })
    ).toThrow(/explicit own/);

    const frozen = freezeAsV151();
    expect(() =>
      migrateConfig({
        ...frozen,
        freezeBrokenAttackModel: native.freezeBrokenAttackModel
      })
    ).toThrow(/does not support Freeze Broken attack policy selection/);
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        freezeBrokenAttackModel: native.freezeBrokenAttackModel
      })
    ).toThrow(/does not support Freeze Broken attack policy selection/);
  });

  it("binds the seventh manifest root to the selected policy", () => {
    const config = makeNativeV152();
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
      reactionDamageGroupRoot:
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT,
      basicReactionSchedulerRoot:
        LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT,
      freezeBrokenAttackRoot: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT
    });

    expect(simulationRunManifestV152Schema.parse(manifest)).toEqual(manifest);
    expect(parseSimulationRunManifestForConfig(manifest, config)).toEqual(
      manifest
    );

    const {
      reproducibilityKey: _reproducibilityKey,
      ...forgedIdentity
    } = {
      ...manifest,
      freezeBrokenAttackRoot: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT
    };
    const forgedManifest = {
      ...forgedIdentity,
      reproducibilityKey: createSimulationReproducibilityKey(forgedIdentity)
    };
    expect(simulationRunManifestV152Schema.parse(forgedManifest)).toEqual(
      forgedManifest
    );
    expect(() =>
      parseSimulationRunManifestForConfig(forgedManifest, config)
    ).toThrow(/not bound/);
  });

  it("freezes the 1.51 result without the new audit log", () => {
    expectTypeOf<
      Exclude<keyof SimulationResultForV152, keyof SimulationResultForV151>
    >().toEqualTypeOf<"freezeBrokenAttackLog">();
    expectTypeOf<
      Exclude<keyof SimulationResultForV151, keyof SimulationResultForV152>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      "freezeBrokenAttackLog" extends keyof SimulationResultForV151
        ? true
        : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "freezeBrokenAttackLog" extends keyof SimulationResultForV152
        ? true
        : false
    >().toEqualTypeOf<true>();
  });
});
