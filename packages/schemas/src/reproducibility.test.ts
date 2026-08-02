import {
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_ID,
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_ROOT,
  GCSIM_CALLBACK_BUS_POLICY_V2_ID,
  GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
  GCSIM_CALLBACK_BUS_POLICY_V2_ROOT,
  GCSIM_DAMAGE_GROUP_PROFILE_ID,
  GCSIM_DAMAGE_GROUP_ROOT,
  GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  GCSIM_ELEMENTAL_APPLICATION_ROOT,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ROOT,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_ROOT,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT,
  LEGACY_CALLBACK_BUS_POLICY_V1_ID,
  LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
  LEGACY_CALLBACK_BUS_POLICY_V1_ROOT,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT,
  type PublicGcsimElementalApplicationGroupId,
} from "@genshin-dps-lab/icd-profiles";
import {
  CLASSIC_REACTION_FORMULA_PROFILE_ID,
  CLASSIC_REACTION_FORMULA_ROOT,
} from "@genshin-dps-lab/reaction-formulas";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  createSimulationRunManifest,
} from "./reproducibility";
import {
  BASIC_REACTION_SCHEDULER_ENGINE_VERSION,
  BASIC_REACTION_SCHEDULER_RUN_MANIFEST_VERSION,
  BASIC_REACTION_SCHEDULER_SCHEMA_VERSION,
  CALLBACK_BUS_ENGINE_VERSION,
  CALLBACK_BUS_RUN_MANIFEST_VERSION,
  CALLBACK_BUS_SCHEMA_VERSION,
  BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  DIRECT_DAMAGE_GROUP_RUN_MANIFEST_VERSION,
  DIRECT_DAMAGE_GROUP_PLUGIN_TRACE_VERIFICATION,
  DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
  DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
  EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION,
  EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
  FREEZE_BROKEN_ATTACK_ENGINE_VERSION,
  FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION,
  FREEZE_BROKEN_ATTACK_SCHEMA_VERSION,
  ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION,
  ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
  ELEMENTAL_APPLICATION_ICD_RUN_MANIFEST_VERSION,
  LEGACY_SIMULATION_RUN_MANIFEST_VERSION,
  REACTION_FORMULA_ROOT_ENGINE_VERSION,
  REACTION_FORMULA_ROOT_SCHEMA_VERSION,
  REACTION_FORMULA_RUN_MANIFEST_VERSION,
  REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION,
  REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
  REACTION_OWNED_APPLICATION_RUN_MANIFEST_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
  SIMULATION_RUN_MANIFEST_VERSION,
  type DirectDamageGroupLogEntry,
  type ElementalApplication,
  type ElementalApplicationIcdLogEntry,
  type ElementalApplicationIcdLogEntryV147,
  type ElementalApplicationIcdLogEntryV148,
  type ElementalApplicationIcdLogEntryV149,
  type ElementalApplicationReactionFixedGcsimDecision,
  type DamageEventV147,
  type DamageEventV148,
  type HitResolutionLogEntryV147,
  type HitResolutionLogEntryV148,
  type ReactionDamageLogEntryV147,
  type ReactionDamageLogEntryV148,
  type LegacyElementalApplicationV146,
  type SimulationResultForV145,
  type SimulationResultForV146,
  type SimulationResultForV147,
  type SimulationResultForV148,
  type SimulationResultForV149,
  type SimulationResultForV151,
  type SimulationResultForV152,
  type SimulationResultForV153,
  type SimulationRunManifestV142,
  type SimulationRunManifestV144,
  type SimulationRunManifestV145,
  type SimulationRunManifestV146,
  type SimulationRunManifestV147,
  type SimulationRunManifestV148,
  type SimulationRunManifestV149,
  type SimulationRunManifestV150,
  type SimulationRunManifestV151,
  type SimulationRunManifestV152,
} from "./types";

const commonIdentity = {
  identityAlgorithm: "fnv1a32-v2" as const,
  dataVersion: "test-data-v1",
  configHash: "fnv1a32:01234567",
  resolvedRuntimeOptions: {
    energyMode: "configured" as const,
    critMode: "average" as const,
    compatibilityMode: "legacy-v0.1" as const,
    randomSeed: "repro-test-seed",
  },
  plugins: [],
};

describe("versioned reproducibility identities", () => {
  it("keeps trusted Burning and Swirl decision tuples disjoint in TypeScript", () => {
    type BurningDecision = Extract<
      ElementalApplicationReactionFixedGcsimDecision,
      { scope: "trusted-target-global-burning-projection" }
    >;
    type SwirlDecision = Extract<
      ElementalApplicationReactionFixedGcsimDecision,
      { scope: "actor-tag" }
    >;

    expectTypeOf<
      BurningDecision["icdTag"]
    >().toEqualTypeOf<"ICDTagBurningDamage">();
    expectTypeOf<BurningDecision["groupId"]>().toEqualTypeOf<"burning">();
    expectTypeOf<SwirlDecision["icdTag"]>().toEqualTypeOf<
      | "ICDTagSwirlPyro"
      | "ICDTagSwirlHydro"
      | "ICDTagSwirlCryo"
      | "ICDTagSwirlElectro"
    >();
    expectTypeOf<SwirlDecision["groupId"]>().toEqualTypeOf<"reaction-a">();
    expectTypeOf<
      Extract<
        ElementalApplicationReactionFixedGcsimDecision,
        {
          scope: "trusted-target-global-burning-projection";
          icdTag: "ICDTagSwirlPyro";
        }
      >
    >().toEqualTypeOf<never>();

  });

  it("binds all eight fixed mechanics roots in the current 1.53 manifest", () => {
    const manifest = createSimulationRunManifest({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION,
      reactionFormulaRoot: CLASSIC_REACTION_FORMULA_ROOT,
      directDamageGroupRoot: GCSIM_DAMAGE_GROUP_ROOT,
      elementalApplicationIcdRoot: GCSIM_ELEMENTAL_APPLICATION_ROOT,
      reactionOwnedElementalApplicationRoot:
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT,
      reactionDamageGroupRoot:
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_ROOT,
      basicReactionSchedulerRoot:
        GCSIM_BASIC_REACTION_SCHEDULER_POLICY_ROOT,
      freezeBrokenAttackRoot:
        GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ROOT,
      callbackBusRoot: GCSIM_CALLBACK_BUS_POLICY_V2_ROOT,
      dataVersion: commonIdentity.dataVersion,
      configHash: commonIdentity.configHash,
      resolvedRuntimeOptions: commonIdentity.resolvedRuntimeOptions,
      plugins: commonIdentity.plugins,
      pluginCapabilities: [],
      pluginCallbackSubscriptions: [],
    });

    expect(CURRENT_SCHEMA_VERSION).toBe(CALLBACK_BUS_SCHEMA_VERSION);
    expect(CURRENT_ENGINE_VERSION).toBe(CALLBACK_BUS_ENGINE_VERSION);
    expect(manifest.version).toBe(SIMULATION_RUN_MANIFEST_VERSION);
    expect(manifest.version).toBe(
      CALLBACK_BUS_RUN_MANIFEST_VERSION,
    );
    expect(manifest.version).toBe("1.9.0");
    expect(manifest.reactionFormulaRoot).toBe(CLASSIC_REACTION_FORMULA_ROOT);
    expect(manifest.directDamageGroupRoot).toBe(GCSIM_DAMAGE_GROUP_ROOT);
    expect(manifest.elementalApplicationIcdRoot).toBe(
      GCSIM_ELEMENTAL_APPLICATION_ROOT,
    );
    expect(manifest.reactionOwnedElementalApplicationRoot).toBe(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT,
    );
    expect(manifest.reactionDamageGroupRoot).toBe(
      GCSIM_REACTION_DAMAGE_GROUP_POLICY_ROOT,
    );
    expect(manifest.basicReactionSchedulerRoot).toBe(
      GCSIM_BASIC_REACTION_SCHEDULER_POLICY_ROOT,
    );
    expect(manifest.freezeBrokenAttackRoot).toBe(
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ROOT,
    );
    expect(manifest.callbackBusRoot).toBe(
      GCSIM_CALLBACK_BUS_POLICY_V2_ROOT,
    );

    const { reproducibilityKey: _reproducibilityKey, ...identity } = manifest;
    expect(manifest.reproducibilityKey).toBe(
      createSimulationReproducibilityKey(identity),
    );
    const forgedContentHash = `sha256:${"0".repeat(64)}`;
    const forgedIdentities = [
      {
        ...identity,
        reactionFormulaRoot: {
          ...identity.reactionFormulaRoot,
          contentHash: forgedContentHash,
        },
      },
      {
        ...identity,
        directDamageGroupRoot: {
          ...identity.directDamageGroupRoot,
          contentHash: forgedContentHash,
        },
      },
      {
        ...identity,
        elementalApplicationIcdRoot: {
          ...identity.elementalApplicationIcdRoot,
          contentHash: forgedContentHash,
        },
      },
      {
        ...identity,
        reactionOwnedElementalApplicationRoot: {
          ...identity.reactionOwnedElementalApplicationRoot,
          contentHash: forgedContentHash,
        },
      },
      {
        ...identity,
        reactionDamageGroupRoot: {
          ...identity.reactionDamageGroupRoot,
          contentHash: forgedContentHash,
        },
      },
      {
        ...identity,
        basicReactionSchedulerRoot: {
          ...identity.basicReactionSchedulerRoot,
          contentHash: forgedContentHash,
        },
      },
      {
        ...identity,
        freezeBrokenAttackRoot: {
          ...identity.freezeBrokenAttackRoot,
          contentHash: forgedContentHash,
        },
      },
      {
        ...identity,
        callbackBusRoot: {
          ...identity.callbackBusRoot,
          contentHash: forgedContentHash,
        },
      },
    ] as unknown as Array<typeof identity>;
    for (const forgedIdentity of forgedIdentities) {
      expect(createSimulationReproducibilityKey(forgedIdentity)).not.toBe(
        manifest.reproducibilityKey,
      );
    }

    const v1Identity = {
      ...identity,
      basicReactionSchedulerRoot:
        LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT,
      freezeBrokenAttackRoot:
        LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT,
      callbackBusRoot: LEGACY_CALLBACK_BUS_POLICY_V1_ROOT,
    };
    expect(createSimulationReproducibilityKey(v1Identity)).not.toBe(
      manifest.reproducibilityKey,
    );
    expect(
      createSimulationReproducibilityKey({
        ...v1Identity,
        basicReactionSchedulerRoot: {
          ...v1Identity.basicReactionSchedulerRoot,
          contentHash: forgedContentHash,
        },
      } as unknown as typeof v1Identity),
    ).not.toBe(createSimulationReproducibilityKey(v1Identity));
  });

  it("retains exact historical identities through the frozen 1.52 wire", () => {
    const frozenV142Identity: Omit<
      SimulationRunManifestV142,
      "reproducibilityKey"
    > = {
      ...commonIdentity,
      version: LEGACY_SIMULATION_RUN_MANIFEST_VERSION,
      schemaVersion: EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
      engineVersion: EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION,
    };
    const frozenV144Identity: Omit<
      SimulationRunManifestV144,
      "reproducibilityKey"
    > = {
      ...commonIdentity,
      version: LEGACY_SIMULATION_RUN_MANIFEST_VERSION,
      schemaVersion: BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
      engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
    };
    const frozenV145Identity: Omit<
      SimulationRunManifestV145,
      "reproducibilityKey"
    > = {
      ...commonIdentity,
      version: REACTION_FORMULA_RUN_MANIFEST_VERSION,
      schemaVersion: REACTION_FORMULA_ROOT_SCHEMA_VERSION,
      engineVersion: REACTION_FORMULA_ROOT_ENGINE_VERSION,
      reactionFormulaRoot: CLASSIC_REACTION_FORMULA_ROOT,
    };
    const frozenV146Identity: Omit<
      SimulationRunManifestV146,
      "reproducibilityKey"
    > = {
      ...commonIdentity,
      version: DIRECT_DAMAGE_GROUP_RUN_MANIFEST_VERSION,
      schemaVersion: DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
      engineVersion: DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
      reactionFormulaRoot: CLASSIC_REACTION_FORMULA_ROOT,
      directDamageGroupRoot: GCSIM_DAMAGE_GROUP_ROOT,
    };
    const frozenV147Identity: Omit<
      SimulationRunManifestV147,
      "reproducibilityKey"
    > = {
      ...commonIdentity,
      version: ELEMENTAL_APPLICATION_ICD_RUN_MANIFEST_VERSION,
      schemaVersion: ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
      engineVersion: ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION,
      reactionFormulaRoot: CLASSIC_REACTION_FORMULA_ROOT,
      directDamageGroupRoot: GCSIM_DAMAGE_GROUP_ROOT,
      elementalApplicationIcdRoot: GCSIM_ELEMENTAL_APPLICATION_ROOT,
    };
    const frozenV148Identity: Omit<
      SimulationRunManifestV148,
      "reproducibilityKey"
    > = {
      ...commonIdentity,
      version: REACTION_OWNED_APPLICATION_RUN_MANIFEST_VERSION,
      schemaVersion: REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
      engineVersion: REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION,
      reactionFormulaRoot: CLASSIC_REACTION_FORMULA_ROOT,
      directDamageGroupRoot: GCSIM_DAMAGE_GROUP_ROOT,
      elementalApplicationIcdRoot: GCSIM_ELEMENTAL_APPLICATION_ROOT,
      reactionOwnedElementalApplicationRoot:
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
    };
    const frozenV149Identity: Omit<
      SimulationRunManifestV149,
      "reproducibilityKey"
    > = {
      ...commonIdentity,
      version: REACTION_OWNED_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
      schemaVersion: REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
      engineVersion: REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
      reactionFormulaRoot: CLASSIC_REACTION_FORMULA_ROOT,
      directDamageGroupRoot: GCSIM_DAMAGE_GROUP_ROOT,
      elementalApplicationIcdRoot: GCSIM_ELEMENTAL_APPLICATION_ROOT,
      reactionOwnedElementalApplicationRoot:
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT,
    };
    const frozenV150Identity: Omit<
      SimulationRunManifestV150,
      "reproducibilityKey"
    > = {
      ...commonIdentity,
      version:
        REACTION_DAMAGE_GROUP_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
      schemaVersion: REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
      engineVersion: REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
      reactionFormulaRoot: CLASSIC_REACTION_FORMULA_ROOT,
      directDamageGroupRoot: GCSIM_DAMAGE_GROUP_ROOT,
      elementalApplicationIcdRoot: GCSIM_ELEMENTAL_APPLICATION_ROOT,
      reactionOwnedElementalApplicationRoot:
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT,
      reactionDamageGroupRoot:
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_ROOT,
    };
    const frozenV151Identity: Omit<
      SimulationRunManifestV151,
      "reproducibilityKey"
    > = {
      ...frozenV150Identity,
      version: BASIC_REACTION_SCHEDULER_RUN_MANIFEST_VERSION,
      schemaVersion: BASIC_REACTION_SCHEDULER_SCHEMA_VERSION,
      engineVersion: BASIC_REACTION_SCHEDULER_ENGINE_VERSION,
      basicReactionSchedulerRoot:
        GCSIM_BASIC_REACTION_SCHEDULER_POLICY_ROOT,
    };
    const frozenV152Identity: Omit<
      SimulationRunManifestV152,
      "reproducibilityKey"
    > = {
      ...frozenV151Identity,
      version: FREEZE_BROKEN_ATTACK_RUN_MANIFEST_VERSION,
      schemaVersion: FREEZE_BROKEN_ATTACK_SCHEMA_VERSION,
      engineVersion: FREEZE_BROKEN_ATTACK_ENGINE_VERSION,
      freezeBrokenAttackRoot: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
    };

    expect(frozenV145Identity.version).toBe("1.1.0");
    expect("directDamageGroupRoot" in frozenV142Identity).toBe(false);
    expect("directDamageGroupRoot" in frozenV144Identity).toBe(false);
    expect("directDamageGroupRoot" in frozenV145Identity).toBe(false);
    expect("elementalApplicationIcdRoot" in frozenV146Identity).toBe(false);
    expect("reactionOwnedElementalApplicationRoot" in frozenV147Identity).toBe(
      false,
    );
    expect("reactionDamageGroupRoot" in frozenV149Identity).toBe(false);
    expect("basicReactionSchedulerRoot" in frozenV150Identity).toBe(false);
    expect("freezeBrokenAttackRoot" in frozenV151Identity).toBe(false);
    expect("callbackBusRoot" in frozenV152Identity).toBe(false);
    expect([
      createSimulationReproducibilityKey(frozenV142Identity),
      createSimulationReproducibilityKey(frozenV144Identity),
      createSimulationReproducibilityKey(frozenV145Identity),
      createSimulationReproducibilityKey(frozenV146Identity),
      createSimulationReproducibilityKey(frozenV147Identity),
      createSimulationReproducibilityKey(frozenV148Identity),
      createSimulationReproducibilityKey(frozenV149Identity),
      createSimulationReproducibilityKey(frozenV150Identity),
      createSimulationReproducibilityKey(frozenV151Identity),
      createSimulationReproducibilityKey(frozenV152Identity),
    ]).toEqual([
      "gdl-v2-fnv1a32-a82adc28",
      "gdl-v2-fnv1a32-452a4d63",
      "gdl-v2-fnv1a32-322d4ab9",
      "gdl-v2-fnv1a32-cba353ae",
      "gdl-v2-fnv1a32-ee6a05c7",
      "gdl-v2-fnv1a32-fe4848e6",
      "gdl-v2-fnv1a32-fd502d2b",
      "gdl-v2-fnv1a32-89f61b57",
      "gdl-v2-fnv1a32-29871774",
      "gdl-v2-fnv1a32-ee85c2fe",
    ]);
  });

  it("binds all fixed mechanics models in the config hash", () => {
    const configIdentity = {
      reactionFormulaModel: {
        mode: "classic-formula-profile-v1",
        profileId: CLASSIC_REACTION_FORMULA_PROFILE_ID,
      },
      directDamageGroupModel: {
        mode: "fixed-gcsim-direct-damage-group-v1",
        profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID,
      },
      elementalApplicationIcdModel: {
        mode: "fixed-gcsim-elemental-application-v1",
        profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
      },
      reactionOwnedElementalApplicationModel: {
        mode: "fixed-gcsim-reaction-owned-application-v2",
        policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID,
      },
      reactionDamageGroupModel: {
        mode: "fixed-gcsim-reaction-damage-task-order-v2",
        policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID,
      },
      basicReactionSchedulerModel: {
        mode: "fixed-gcsim-basic-reaction-scheduler-v2",
        policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_ID,
      },
      freezeBrokenAttackModel: {
        mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE,
        policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID,
      },
      callbackBusModel: {
        mode: GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
        policyId: GCSIM_CALLBACK_BUS_POLICY_V2_ID,
      },
      configuredApplication: {
        gaugeUnits: 1,
        icd: {
          mode: "fixed-gcsim-application-v1",
          icdTag: "skill",
          groupId: "default",
        },
      },
    };

    expect(
      createSimulationConfigHash({
        ...configIdentity,
        directDamageGroupModel: {
          ...configIdentity.directDamageGroupModel,
          profileId: "forged-profile",
        },
      }),
    ).not.toBe(createSimulationConfigHash(configIdentity));
    expect(
      createSimulationConfigHash({
        ...configIdentity,
        callbackBusModel: {
          mode: LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
          policyId: LEGACY_CALLBACK_BUS_POLICY_V1_ID,
        },
      }),
    ).not.toBe(createSimulationConfigHash(configIdentity));
    expect(
      createSimulationConfigHash({
        ...configIdentity,
        reactionDamageGroupModel: {
          ...configIdentity.reactionDamageGroupModel,
          policyId: "forged-reaction-damage-policy",
        },
      }),
    ).not.toBe(createSimulationConfigHash(configIdentity));
    expect(
      createSimulationConfigHash({
        ...configIdentity,
        basicReactionSchedulerModel: {
          mode: "legacy-immediate-basic-reaction-scheduler-v1",
          policyId: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
        },
      }),
    ).not.toBe(createSimulationConfigHash(configIdentity));
    expect(
      createSimulationConfigHash({
        ...configIdentity,
        basicReactionSchedulerModel: {
          ...configIdentity.basicReactionSchedulerModel,
          policyId: "forged-basic-reaction-scheduler-policy",
        },
      }),
    ).not.toBe(createSimulationConfigHash(configIdentity));
    expect(
      createSimulationConfigHash({
        ...configIdentity,
        freezeBrokenAttackModel: {
          ...configIdentity.freezeBrokenAttackModel,
          policyId: "forged-freeze-broken-attack-policy",
        },
      }),
    ).not.toBe(createSimulationConfigHash(configIdentity));
    expect(
      createSimulationConfigHash({
        ...configIdentity,
        reactionOwnedElementalApplicationModel: {
          ...configIdentity.reactionOwnedElementalApplicationModel,
          policyId: "forged-reaction-policy",
        },
      }),
    ).not.toBe(createSimulationConfigHash(configIdentity));
    expect(
      createSimulationConfigHash({
        ...configIdentity,
        elementalApplicationIcdModel: {
          ...configIdentity.elementalApplicationIcdModel,
          profileId: "forged-application-profile",
        },
      }),
    ).not.toBe(createSimulationConfigHash(configIdentity));
    expect(
      createSimulationConfigHash({
        ...configIdentity,
        configuredApplication: {
          ...configIdentity.configuredApplication,
          icd: {
            ...configIdentity.configuredApplication.icd,
            groupId: "nahida-skill",
          },
        },
      }),
    ).not.toBe(createSimulationConfigHash(configIdentity));
  });
});

describe("direct-damage-group audit identity", () => {
  it("adds the Freeze Broken audit log only at the 1.52 boundary", () => {
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

  it("adds only callback audit tables at the 1.53 result boundary", () => {
    expectTypeOf<
      Exclude<keyof SimulationResultForV153, keyof SimulationResultForV152>
    >().toEqualTypeOf<"callbackRegistrationLog" | "callbackDeliveryLog">();
    expectTypeOf<
      Exclude<keyof SimulationResultForV152, keyof SimulationResultForV153>
    >().toEqualTypeOf<never>();
  });

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

  it("adds the application ICD log only at the 1.47 result boundary", () => {
    expectTypeOf<
      "elementalApplicationIcdLog" extends keyof SimulationResultForV146
        ? true
        : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "elementalApplicationIcdLog" extends keyof SimulationResultForV147
        ? true
        : false
    >().toEqualTypeOf<true>();
  });

  it("freezes 1.47 nested logs while 1.48 exposes reciprocal unified links", () => {
    expectTypeOf<
      SimulationResultForV147["damageEvents"][number]
    >().toEqualTypeOf<DamageEventV147>();
    expectTypeOf<
      SimulationResultForV148["damageEvents"][number]
    >().toEqualTypeOf<DamageEventV148>();
    expectTypeOf<
      SimulationResultForV147["hitResolutionLog"][number]
    >().toEqualTypeOf<HitResolutionLogEntryV147>();
    expectTypeOf<
      SimulationResultForV148["hitResolutionLog"][number]
    >().toEqualTypeOf<HitResolutionLogEntryV148>();
    expectTypeOf<
      SimulationResultForV147["reactionDamageLog"][number]
    >().toEqualTypeOf<ReactionDamageLogEntryV147>();
    expectTypeOf<
      SimulationResultForV148["reactionDamageLog"][number]
    >().toEqualTypeOf<ReactionDamageLogEntryV148>();
    expectTypeOf<
      SimulationResultForV147["elementalApplicationIcdLog"][number]
    >().toEqualTypeOf<ElementalApplicationIcdLogEntryV147>();
    expectTypeOf<
      SimulationResultForV148["elementalApplicationIcdLog"][number]
    >().toEqualTypeOf<ElementalApplicationIcdLogEntryV148>();
    expectTypeOf<
      SimulationResultForV149["elementalApplicationIcdLog"][number]
    >().toEqualTypeOf<ElementalApplicationIcdLogEntryV149>();

    expectTypeOf<
      "elementalApplicationIcdLogId" extends keyof DamageEventV147
        ? true
        : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      DamageEventV148["elementalApplicationIcdLogId"]
    >().toEqualTypeOf<number | null>();
    expectTypeOf<
      HitResolutionLogEntryV148["reactionDamageLogId"]
    >().toEqualTypeOf<number | null>();
    expectTypeOf<
      ReactionDamageLogEntryV148["elementalApplicationIcdLogIds"]
    >().toEqualTypeOf<number[]>();
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
      pluginTraceVerification: DIRECT_DAMAGE_GROUP_PLUGIN_TRACE_VERIFICATION,
      effectiveMultiplier: 0,
      damageGroupOnEnemyHitAllowed: false,
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
      damageGroupOnEnemyHitAllowed: true,
    };

    expect(evaluated.windowStartGroup).toBe("reaction-a");
    expect(bypassed.windowStartGroup).toBeNull();
  });
});

describe("elemental-application ICD audit identity", () => {
  it("keeps the frozen boolean wire distinct from current selectors", () => {
    expectTypeOf<LegacyElementalApplicationV146>().toEqualTypeOf<{
      gaugeUnits: number;
      icdTag: string;
      icdGroup: string;
    }>();
    expectTypeOf<ElementalApplication>().toEqualTypeOf<{
      gaugeUnits: number;
      icd:
        | { mode: "no-icd-v1" }
        | {
            mode: "legacy-boolean-profile-v1";
            icdTag: string;
            profileId: string;
          }
        | {
            mode: "fixed-gcsim-application-v1";
            icdTag: string;
            groupId: PublicGcsimElementalApplicationGroupId;
          };
    }>();
  });

  it("represents a numeric fixed-profile decision without weakening legacy profiles", () => {
    const fixed: ElementalApplicationIcdLogEntry = {
      id: 0,
      sourceKind: "configured-direct-hit",
      hitResolutionLogId: 0,
      damageEventId: 0,
      frame: 149,
      sourceActorId: "actor",
      targetId: "enemy-0",
      hitId: "hit",
      hitGroupId: "action:hit:0",
      element: "dendro",
      selector: {
        mode: "fixed-gcsim-application-v1",
        icdTag: "skill",
        groupId: "nahida-skill",
      },
      nominalGaugeUnits: 1,
      effectiveGaugeUnits: 1.5,
      decision: {
        kind: "fixed-gcsim",
        evaluated: true,
        consumed: true,
        applicationMultiplier: 1.5,
        allowed: true,
        scope: "actor-tag",
        profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
        icdTag: "skill",
        groupId: "nahida-skill",
        windowStartGroupId: "nahida-skill",
        resetFrames: 60,
        windowStartFrame: 149,
        resetAtFrame: 208,
        hitIndex: 0,
        sequenceIndex: 0,
        tailPolicy: "clamp",
        resetSchedulePolicy: "window-start-plus-reset-frames-minus-one",
      },
    };

    expect(fixed.decision.applicationMultiplier).toBe(1.5);
    expect(fixed.effectiveGaugeUnits).toBe(1.5);
  });
});
