import {
  GCSIM_DAMAGE_GROUP_PROFILE_ID,
  GCSIM_DAMAGE_GROUP_ROOT
} from "@genshin-dps-lab/icd-profiles";
import {
  CLASSIC_REACTION_FORMULA_PROFILE_ID,
  CLASSIC_REACTION_FORMULA_ROOT
} from "@genshin-dps-lab/reaction-formulas";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  createSimulationRunManifest
} from "./reproducibility";
import {
  BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  DIRECT_DAMAGE_GROUP_PLUGIN_TRACE_VERIFICATION,
  DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
  DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
  EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION,
  EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
  LEGACY_SIMULATION_RUN_MANIFEST_VERSION,
  REACTION_FORMULA_ROOT_ENGINE_VERSION,
  REACTION_FORMULA_ROOT_SCHEMA_VERSION,
  REACTION_FORMULA_RUN_MANIFEST_VERSION,
  SIMULATION_RUN_MANIFEST_VERSION,
  type DirectDamageGroupLogEntry,
  type SimulationResultForV145,
  type SimulationResultForV146,
  type SimulationRunManifestV142,
  type SimulationRunManifestV144,
  type SimulationRunManifestV145
} from "./types";

const commonIdentity = {
  identityAlgorithm: "fnv1a32-v2" as const,
  dataVersion: "test-data-v1",
  configHash: "fnv1a32:01234567",
  resolvedRuntimeOptions: {
    energyMode: "configured" as const,
    critMode: "average" as const,
    compatibilityMode: "legacy-v0.1" as const,
    randomSeed: "repro-test-seed"
  },
  plugins: []
};

describe("versioned reproducibility identities", () => {
  it("binds both fixed mechanics roots in the current 1.46 manifest", () => {
    const manifest = createSimulationRunManifest({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION,
      reactionFormulaRoot: CLASSIC_REACTION_FORMULA_ROOT,
      directDamageGroupRoot: GCSIM_DAMAGE_GROUP_ROOT,
      dataVersion: commonIdentity.dataVersion,
      configHash: commonIdentity.configHash,
      resolvedRuntimeOptions: commonIdentity.resolvedRuntimeOptions,
      plugins: commonIdentity.plugins
    });

    expect(CURRENT_SCHEMA_VERSION).toBe(
      DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION
    );
    expect(CURRENT_ENGINE_VERSION).toBe(
      DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION
    );
    expect(manifest.version).toBe(SIMULATION_RUN_MANIFEST_VERSION);
    expect(manifest.version).toBe("1.2.0");
    expect(manifest.reactionFormulaRoot).toBe(
      CLASSIC_REACTION_FORMULA_ROOT
    );
    expect(manifest.directDamageGroupRoot).toBe(
      GCSIM_DAMAGE_GROUP_ROOT
    );

    const {
      reproducibilityKey: _reproducibilityKey,
      ...identity
    } = manifest;
    expect(manifest.reproducibilityKey).toBe(
      createSimulationReproducibilityKey(identity)
    );
    expect(
      createSimulationReproducibilityKey({
        ...identity,
        directDamageGroupRoot: {
          ...identity.directDamageGroupRoot,
          contentHash: `sha256:${"0".repeat(64)}`
        }
      } as unknown as typeof identity)
    ).not.toBe(manifest.reproducibilityKey);
  });

  it("retains exact 1.42, 1.44, and 1.45 identities without the new root", () => {
    const frozenV142Identity: Omit<
      SimulationRunManifestV142,
      "reproducibilityKey"
    > = {
      ...commonIdentity,
      version: LEGACY_SIMULATION_RUN_MANIFEST_VERSION,
      schemaVersion: EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
      engineVersion: EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION
    };
    const frozenV144Identity: Omit<
      SimulationRunManifestV144,
      "reproducibilityKey"
    > = {
      ...commonIdentity,
      version: LEGACY_SIMULATION_RUN_MANIFEST_VERSION,
      schemaVersion: BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
      engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION
    };
    const frozenV145Identity: Omit<
      SimulationRunManifestV145,
      "reproducibilityKey"
    > = {
      ...commonIdentity,
      version: REACTION_FORMULA_RUN_MANIFEST_VERSION,
      schemaVersion: REACTION_FORMULA_ROOT_SCHEMA_VERSION,
      engineVersion: REACTION_FORMULA_ROOT_ENGINE_VERSION,
      reactionFormulaRoot: CLASSIC_REACTION_FORMULA_ROOT
    };

    expect(frozenV145Identity.version).toBe("1.1.0");
    expect("directDamageGroupRoot" in frozenV142Identity).toBe(false);
    expect("directDamageGroupRoot" in frozenV144Identity).toBe(false);
    expect("directDamageGroupRoot" in frozenV145Identity).toBe(false);
    expect(
      [
        createSimulationReproducibilityKey(frozenV142Identity),
        createSimulationReproducibilityKey(frozenV144Identity),
        createSimulationReproducibilityKey(frozenV145Identity)
      ]
    ).toEqual([
      "gdl-v2-fnv1a32-a82adc28",
      "gdl-v2-fnv1a32-452a4d63",
      "gdl-v2-fnv1a32-322d4ab9"
    ]);
  });

  it("binds the fixed direct-damage-group model in the config hash", () => {
    const configIdentity = {
      reactionFormulaModel: {
        mode: "classic-formula-profile-v1",
        profileId: CLASSIC_REACTION_FORMULA_PROFILE_ID
      },
      directDamageGroupModel: {
        mode: "fixed-gcsim-direct-damage-group-v1",
        profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID
      }
    };

    expect(
      createSimulationConfigHash({
        ...configIdentity,
        directDamageGroupModel: {
          ...configIdentity.directDamageGroupModel,
          profileId: "forged-profile"
        }
      })
    ).not.toBe(createSimulationConfigHash(configIdentity));
  });
});

describe("direct-damage-group audit identity", () => {
  it("keeps the 1.46-only log out of frozen result types", () => {
    expectTypeOf<
      "directDamageGroupLog" extends keyof SimulationResultForV145
        ? true
        : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "directDamageGroupLog" extends keyof SimulationResultForV146
        ? true
        : false
    >().toEqualTypeOf<true>();
  });

  it("records the group that opened a shared tag window", () => {
    const evaluated: DirectDamageGroupLogEntry = {
      id: 0,
      damageEventId: 0,
      hitResolutionLogId: 0,
      frame: 120,
      sourceActorId: "actor",
      targetId: "enemy-0",
      hitId: "hit-0",
      profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID,
      evaluation: "evaluated",
      icdTag: "shared-tag",
      icdGroup: "reaction-b",
      windowStartGroup: "reaction-a",
      resetFrames: 30,
      windowStartFrame: 100,
      resetAtFrame: 129,
      hitIndex: 1,
      sequenceIndex: 1,
      sequenceMultiplier: 0,
      configuredMultiplier: 0.75,
      prePluginMultiplier: 0.75,
      postPluginMultiplier: 0.75,
      pluginMultiplierTrace: [],
      pluginTraceVerification:
        DIRECT_DAMAGE_GROUP_PLUGIN_TRACE_VERIFICATION,
      effectiveMultiplier: 0,
      damageGroupOnEnemyHitAllowed: false
    };
    const bypassed: DirectDamageGroupLogEntry = {
      ...evaluated,
      id: 1,
      damageEventId: 1,
      hitResolutionLogId: 1,
      hitId: "hit-1",
      evaluation: "bypassed",
      icdTag: null,
      icdGroup: null,
      windowStartGroup: null,
      resetFrames: null,
      windowStartFrame: null,
      resetAtFrame: null,
      hitIndex: null,
      sequenceIndex: null,
      sequenceMultiplier: 1,
      prePluginMultiplier: 0.75,
      postPluginMultiplier: 0.75,
      effectiveMultiplier: 0.75,
      damageGroupOnEnemyHitAllowed: true
    };

    expect(evaluated.windowStartGroup).toBe("reaction-a");
    expect(bypassed.windowStartGroup).toBeNull();
  });
});
