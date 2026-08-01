import {
  auraReactionDemoPreset,
  blankPreset,
  durinMeltPreset,
  legalTimelineDemoPreset,
  particleEnergyDemoPreset
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
  type SimConfig
} from "@genshin-dps-lab/schemas";
import {
  CLASSIC_REACTION_FORMULA_PROFILE_ID,
  CLASSIC_REACTION_FORMULA_ROOT
} from "@genshin-dps-lab/reaction-formulas";
import { describe, expect, it } from "vitest";
import { defineDamageModifierPlugin } from "../plugins";
import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

const EXPECTED_FORMULA_MODEL = {
  mode: "classic-formula-profile-v1",
  profileId: CLASSIC_REACTION_FORMULA_PROFILE_ID
} as const;

function asV144Input(config: SimConfig): unknown {
  const {
    reactionFormulaModel: _reactionFormulaModel,
    ...legacyConfig
  } = structuredClone(config);
  return {
    ...legacyConfig,
    schemaVersion: BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
    engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION
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
            snapshot: "hit"
          }
        ]
      }
    ]
  });
}

describe("reaction formula run-manifest root", () => {
  it("pins every current built-in config to the fixed classic profile", () => {
    const currentConfigs = [
      makeConfig(),
      durinMeltPreset,
      blankPreset,
      legalTimelineDemoPreset,
      auraReactionDemoPreset,
      particleEnergyDemoPreset
    ];

    for (const config of currentConfigs) {
      expect(config.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(config.engineVersion).toBe(CURRENT_ENGINE_VERSION);
      expect(config.reactionFormulaModel).toEqual(
        EXPECTED_FORMULA_MODEL
      );
    }
  });

  it("binds the fixed formula root into the manifest identity", () => {
    const result = simulate(makeConfig());

    expect(result.runManifest.reactionFormulaRoot).toEqual(
      CLASSIC_REACTION_FORMULA_ROOT
    );
    expect(result.runManifest.configHash).toBe(
      createSimulationConfigHash(result.config)
    );
    expect(
      simulationRunManifestSchema.parse(result.runManifest)
    ).toEqual(result.runManifest);

    const {
      reproducibilityKey: _reproducibilityKey,
      ...identity
    } = result.runManifest;
    const alteredIdentity = {
      ...identity,
      reactionFormulaRoot: {
        ...identity.reactionFormulaRoot,
        contentHash: `sha256:${"0".repeat(64)}`
      }
    };
    expect(
      createSimulationReproducibilityKey(
        alteredIdentity as Parameters<
          typeof createSimulationReproducibilityKey
        >[0]
      )
    ).not.toBe(result.reproducibilityKey);

    const alteredConfig = {
      ...result.config,
      reactionFormulaModel: {
        ...result.config.reactionFormulaModel,
        profileId: "untrusted-custom-profile"
      }
    };
    expect(createSimulationConfigHash(alteredConfig)).not.toBe(
      result.runManifest.configHash
    );
  });

  it("migrates a 1.44 input into the fixed 1.45 formula profile", () => {
    const legacyInput = asV144Input(durinMeltPreset);
    const migrated = migrateConfig(legacyInput);
    const result = simulate(legacyInput);

    expect(migrated).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION,
      reactionFormulaModel: EXPECTED_FORMULA_MODEL
    });
    expect(result.config.reactionFormulaModel).toEqual(
      EXPECTED_FORMULA_MODEL
    );
    expect(result.runManifest.reactionFormulaRoot).toEqual(
      CLASSIC_REACTION_FORMULA_ROOT
    );
  });

  it("preserves the default 120-second damage semantics", () => {
    const result = simulate(durinMeltPreset);

    expect({
      totalDamage: result.totalDamage,
      dps: result.dps,
      hitCount: result.damageEvents.length,
      reactedHits: result.reactedHits,
      skippedActionCount: result.skippedActions.length
    }).toEqual({
      totalDamage: 41410555.13728799,
      dps: 345087.9594773999,
      hitCount: 269,
      reactedHits: 129,
      skippedActionCount: 3
    });
  });

  it.each([
    [
      "a custom profile id",
      {
        mode: "classic-formula-profile-v1",
        profileId: "untrusted-custom-profile"
      }
    ],
    [
      "inline formula tables",
      {
        ...EXPECTED_FORMULA_MODEL,
        tables: { melt: 20 }
      }
    ]
  ])("rejects %s at the simulator input boundary", (_label, model) => {
    expect(() =>
      simulate({
        ...makeConfig(),
        reactionFormulaModel: model
      })
    ).toThrow();
  });

  it("rejects a manifest that appends uncommitted formula tables", () => {
    const manifest = structuredClone(
      simulate(makeConfig()).runManifest
    ) as unknown as Record<string, unknown>;
    manifest.reactionFormulaRoot = {
      ...CLASSIC_REACTION_FORMULA_ROOT,
      tables: { melt: 20 }
    };

    expect(() =>
      simulationRunManifestSchema.parse(manifest)
    ).toThrow();
  });

  it.each(["reaction", "explicitReactionBase"] as const)(
    "rejects a current plugin that overrides %s",
    (field) => {
      const plugin = defineDamageModifierPlugin(
        {
          id: `formula-root-${field}`,
          version: "1",
          kind: "code",
          contentHash: createVersionedContentHash({ field })
        },
        () => ({
          modifyDamage: () =>
            ({
              [field]: field === "reaction" ? "melt" : 20
            }) as never
        })
      );

      expect(() =>
        simulate(oneHitConfig(), { plugins: [plugin] })
      ).toThrow(/cannot override formula-bound field/);
    }
  );
});
