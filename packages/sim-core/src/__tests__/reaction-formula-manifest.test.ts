import {
  auraReactionDemoPreset,
  blankPreset,
  durinMeltPreset,
  legalTimelineDemoPreset,
  particleEnergyDemoPreset,
} from "@genshin-dps-lab/game-data/presets";
import {
  BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  createVersionedContentHash,
  migrateConfig,
  simulationRunManifestSchema,
  type SimConfig,
} from "@genshin-dps-lab/schemas";
import {
  CLASSIC_REACTION_FORMULA_PROFILE_ID,
  CLASSIC_REACTION_FORMULA_ROOT,
} from "@genshin-dps-lab/reaction-formulas";
import {
  GCSIM_DAMAGE_GROUP_PROFILE_ID,
  GCSIM_DAMAGE_GROUP_ROOT,
  GCSIM_CALLBACK_BUS_POLICY_V2_ID,
  GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
  GCSIM_CALLBACK_BUS_POLICY_V2_ROOT,
  GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  GCSIM_ELEMENTAL_APPLICATION_ROOT,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ROOT,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
  LEGACY_CALLBACK_BUS_POLICY_V1_ID,
  LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
  LEGACY_CALLBACK_BUS_POLICY_V1_ROOT,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT,
} from "@genshin-dps-lab/icd-profiles";
import { describe, expect, it } from "vitest";
import { defineDamageModifierPlugin } from "../plugins";
import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

const EXPECTED_FORMULA_MODEL = {
  mode: "classic-formula-profile-v1",
  profileId: CLASSIC_REACTION_FORMULA_PROFILE_ID,
} as const;
const EXPECTED_DIRECT_DAMAGE_GROUP_MODEL = {
  mode: "fixed-gcsim-direct-damage-group-v1",
  profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID,
} as const;
const EXPECTED_ELEMENTAL_APPLICATION_ICD_MODEL = {
  mode: "fixed-gcsim-elemental-application-v1",
  profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
} as const;
const EXPECTED_REACTION_OWNED_APPLICATION_MODEL = {
  mode: "fixed-gcsim-reaction-owned-application-v2",
  policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID,
} as const;
const EXPECTED_MIGRATED_REACTION_OWNED_APPLICATION_MODEL = {
  mode: "fixed-gcsim-reaction-owned-application-v1",
  policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
} as const;
const EXPECTED_FREEZE_BROKEN_ATTACK_MODEL = {
  mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_MODE,
  policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ID,
} as const;
const EXPECTED_CALLBACK_BUS_MODEL = {
  mode: GCSIM_CALLBACK_BUS_POLICY_V2_MODE,
  policyId: GCSIM_CALLBACK_BUS_POLICY_V2_ID,
} as const;
const EXPECTED_MIGRATED_FREEZE_BROKEN_ATTACK_MODEL = {
  mode: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
  policyId: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
} as const;
const EXPECTED_MIGRATED_CALLBACK_BUS_MODEL = {
  mode: LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
  policyId: LEGACY_CALLBACK_BUS_POLICY_V1_ID,
} as const;

function projectApplicationsToLegacyWire(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(projectApplicationsToLegacyWire);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.gaugeUnits === "number" &&
    record.icd !== null &&
    typeof record.icd === "object"
  ) {
    const icd = record.icd as Record<string, unknown>;
    if (icd.mode === "no-icd-v1") {
      return {
        gaugeUnits: record.gaugeUnits,
        icdTag: "legacy-no-icd",
        icdGroup: "no-icd",
      };
    }
    if (icd.mode === "legacy-boolean-profile-v1") {
      return {
        gaugeUnits: record.gaugeUnits,
        icdTag: icd.icdTag,
        icdGroup: icd.profileId,
      };
    }
    if (icd.mode === "fixed-gcsim-application-v1") {
      return {
        gaugeUnits: record.gaugeUnits,
        icdTag: icd.icdTag,
        icdGroup: icd.groupId,
      };
    }
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [
      key,
      projectApplicationsToLegacyWire(entry),
    ]),
  );
}

function asV144Input(config: SimConfig): unknown {
  const {
    reactionFormulaModel: _reactionFormulaModel,
    directDamageGroupModel: _directDamageGroupModel,
    elementalApplicationIcdModel: _elementalApplicationIcdModel,
    reactionOwnedElementalApplicationModel:
      _reactionOwnedElementalApplicationModel,
    reactionDamageGroupModel: _reactionDamageGroupModel,
    basicReactionSchedulerModel: _basicReactionSchedulerModel,
    freezeBrokenAttackModel: _freezeBrokenAttackModel,
    callbackBusModel: _callbackBusModel,
    ...legacyConfig
  } = structuredClone(config);
  return {
    ...(projectApplicationsToLegacyWire(legacyConfig) as Record<
      string,
      unknown
    >),
    schemaVersion: BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
    engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  };
}

function oneHitConfig(): SimConfig {
  return makeConfig({
    rotation: [
      {
        id: "formula-root-hit",
        actorId: "a",
        name: "Formula root hit",
        at: 0,
        hits: [
          {
            id: "formula-root-hit-1",
            offset: 0,
            label: "Formula root hit",
            scaling: 1,
            scalingStat: "atk",
            element: "pyro",
            reaction: "none",
            snapshot: "hit",
          },
        ],
      },
    ],
  });
}

describe("reaction formula run-manifest root", () => {
  it("pins every current built-in config to the fixed classic profile", () => {
    const currentConfigs = [
      makeConfig({
        freezeBrokenAttackModel: EXPECTED_FREEZE_BROKEN_ATTACK_MODEL,
        callbackBusModel: EXPECTED_CALLBACK_BUS_MODEL,
      }),
      durinMeltPreset,
      blankPreset,
      legalTimelineDemoPreset,
      auraReactionDemoPreset,
      particleEnergyDemoPreset,
    ];

    for (const config of currentConfigs) {
      expect(config.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(config.engineVersion).toBe(CURRENT_ENGINE_VERSION);
      expect(config.reactionFormulaModel).toEqual(EXPECTED_FORMULA_MODEL);
      expect(config.directDamageGroupModel).toEqual(
        EXPECTED_DIRECT_DAMAGE_GROUP_MODEL,
      );
      expect(config.elementalApplicationIcdModel).toEqual(
        EXPECTED_ELEMENTAL_APPLICATION_ICD_MODEL,
      );
      expect(config.reactionOwnedElementalApplicationModel).toEqual(
        EXPECTED_REACTION_OWNED_APPLICATION_MODEL,
      );
      expect(config.freezeBrokenAttackModel).toEqual(
        EXPECTED_FREEZE_BROKEN_ATTACK_MODEL,
      );
      expect(config.callbackBusModel).toEqual(EXPECTED_CALLBACK_BUS_MODEL);
    }
  });

  it("binds the fixed formula root into the manifest identity", () => {
    const result = simulate(
      makeConfig({
        freezeBrokenAttackModel: EXPECTED_FREEZE_BROKEN_ATTACK_MODEL,
        callbackBusModel: EXPECTED_CALLBACK_BUS_MODEL,
      }),
    );

    expect(result.runManifest.reactionFormulaRoot).toEqual(
      CLASSIC_REACTION_FORMULA_ROOT,
    );
    expect(result.runManifest.directDamageGroupRoot).toEqual(
      GCSIM_DAMAGE_GROUP_ROOT,
    );
    expect(result.runManifest.elementalApplicationIcdRoot).toEqual(
      GCSIM_ELEMENTAL_APPLICATION_ROOT,
    );
    expect(result.runManifest.reactionOwnedElementalApplicationRoot).toEqual(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT,
    );
    expect(result.runManifest.freezeBrokenAttackRoot).toEqual(
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V3_ROOT,
    );
    expect(result.runManifest.callbackBusRoot).toEqual(
      GCSIM_CALLBACK_BUS_POLICY_V2_ROOT,
    );
    expect(result.runManifest.configHash).toBe(
      createSimulationConfigHash(result.config),
    );
    expect(simulationRunManifestSchema.parse(result.runManifest)).toEqual(
      result.runManifest,
    );

    const { reproducibilityKey: _reproducibilityKey, ...identity } =
      result.runManifest;
    const alteredIdentity = {
      ...identity,
      reactionFormulaRoot: {
        ...identity.reactionFormulaRoot,
        contentHash: `sha256:${"0".repeat(64)}`,
      },
    };
    expect(
      createSimulationReproducibilityKey(
        alteredIdentity as Parameters<
          typeof createSimulationReproducibilityKey
        >[0],
      ),
    ).not.toBe(result.reproducibilityKey);

    const alteredConfig = {
      ...result.config,
      reactionFormulaModel: {
        ...result.config.reactionFormulaModel,
        profileId: "untrusted-custom-profile",
      },
    };
    expect(createSimulationConfigHash(alteredConfig)).not.toBe(
      result.runManifest.configHash,
    );
  });

  it("migrates a 1.44 input into current identity while preserving the frozen v1 reaction-owned policy", () => {
    const legacyInput = asV144Input(durinMeltPreset);
    const migrated = migrateConfig(legacyInput);
    const result = simulate(legacyInput);

    expect(migrated).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION,
      reactionFormulaModel: EXPECTED_FORMULA_MODEL,
      directDamageGroupModel: EXPECTED_DIRECT_DAMAGE_GROUP_MODEL,
      elementalApplicationIcdModel: EXPECTED_ELEMENTAL_APPLICATION_ICD_MODEL,
      reactionOwnedElementalApplicationModel:
        EXPECTED_MIGRATED_REACTION_OWNED_APPLICATION_MODEL,
      freezeBrokenAttackModel: EXPECTED_MIGRATED_FREEZE_BROKEN_ATTACK_MODEL,
      callbackBusModel: EXPECTED_MIGRATED_CALLBACK_BUS_MODEL,
    });
    expect(result.config.reactionFormulaModel).toEqual(EXPECTED_FORMULA_MODEL);
    expect(result.config.directDamageGroupModel).toEqual(
      EXPECTED_DIRECT_DAMAGE_GROUP_MODEL,
    );
    expect(result.config.elementalApplicationIcdModel).toEqual(
      EXPECTED_ELEMENTAL_APPLICATION_ICD_MODEL,
    );
    expect(result.config.reactionOwnedElementalApplicationModel).toEqual(
      EXPECTED_MIGRATED_REACTION_OWNED_APPLICATION_MODEL,
    );
    expect(result.config.freezeBrokenAttackModel).toEqual(
      EXPECTED_MIGRATED_FREEZE_BROKEN_ATTACK_MODEL,
    );
    expect(result.config.callbackBusModel).toEqual(
      EXPECTED_MIGRATED_CALLBACK_BUS_MODEL,
    );
    expect(result.runManifest.reactionFormulaRoot).toEqual(
      CLASSIC_REACTION_FORMULA_ROOT,
    );
    expect(result.runManifest.directDamageGroupRoot).toEqual(
      GCSIM_DAMAGE_GROUP_ROOT,
    );
    expect(result.runManifest.elementalApplicationIcdRoot).toEqual(
      GCSIM_ELEMENTAL_APPLICATION_ROOT,
    );
    expect(result.runManifest.reactionOwnedElementalApplicationRoot).toEqual(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT,
    );
    expect(result.runManifest.freezeBrokenAttackRoot).toEqual(
      LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT,
    );
    expect(result.runManifest.callbackBusRoot).toEqual(
      LEGACY_CALLBACK_BUS_POLICY_V1_ROOT,
    );
  });

  it("preserves the default 120-second damage semantics", () => {
    const result = simulate(durinMeltPreset);

    expect({
      totalDamage: result.totalDamage,
      dps: result.dps,
      hitCount: result.damageEvents.length,
      reactedHits: result.reactedHits,
      skippedActionCount: result.skippedActions.length,
    }).toEqual({
      totalDamage: 41410555.13728799,
      dps: 345087.9594773999,
      hitCount: 269,
      reactedHits: 129,
      skippedActionCount: 3,
    });
  });

  it.each([
    [
      "a custom profile id",
      {
        mode: "classic-formula-profile-v1",
        profileId: "untrusted-custom-profile",
      },
    ],
    [
      "inline formula tables",
      {
        ...EXPECTED_FORMULA_MODEL,
        tables: { melt: 20 },
      },
    ],
  ])("rejects %s at the simulator input boundary", (_label, model) => {
    expect(() =>
      simulate({
        ...makeConfig(),
        reactionFormulaModel: model,
      }),
    ).toThrow();
  });

  it("rejects a manifest that appends uncommitted formula tables", () => {
    const manifest = structuredClone(
      simulate(makeConfig()).runManifest,
    ) as unknown as Record<string, unknown>;
    manifest.reactionFormulaRoot = {
      ...CLASSIC_REACTION_FORMULA_ROOT,
      tables: { melt: 20 },
    };

    expect(() => simulationRunManifestSchema.parse(manifest)).toThrow();
  });

  it.each(["reaction", "explicitReactionBase"] as const)(
    "rejects a current plugin that overrides %s",
    (field) => {
      const plugin = defineDamageModifierPlugin(
        {
          id: `formula-root-${field}`,
          version: "1",
          kind: "code",
          contentHash: createVersionedContentHash({ field }),
        },
        () => ({
          modifyDamage: () =>
            ({
              [field]: field === "reaction" ? "melt" : 20,
            }) as never,
        }),
      );

      expect(() => simulate(oneHitConfig(), { plugins: [plugin] })).toThrow(
        /Trusted SimulationResult 1\.53 integrity validation failed: damageEvents\.0\.damageFactors\.reactionBase/,
      );
    },
  );
});
