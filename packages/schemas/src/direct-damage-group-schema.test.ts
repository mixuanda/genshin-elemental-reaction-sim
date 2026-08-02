import { describe, expect, it } from "vitest";

import {
  GCSIM_DAMAGE_GROUP_PROFILE,
  GCSIM_DAMAGE_GROUP_PROFILE_ID,
  GCSIM_DAMAGE_GROUP_ROOT,
  GCSIM_ELEMENTAL_APPLICATION_ROOT,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT
} from "@genshin-dps-lab/icd-profiles";
import {
  CLASSIC_REACTION_FORMULA_PROFILE_ID,
  CLASSIC_REACTION_FORMULA_ROOT
} from "@genshin-dps-lab/reaction-formulas";

import {
  BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  createSimulationRunManifest,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  directDamageGroupDefinitionSchema,
  directDamageGroupIdSchema,
  directDamageGroupModelSchema,
  DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
  DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
  DIRECT_DAMAGE_GROUP_RUN_MANIFEST_VERSION,
  migrateConfig,
  parseSimConfig,
  REACTION_FORMULA_ROOT_ENGINE_VERSION,
  REACTION_FORMULA_ROOT_SCHEMA_VERSION,
  REACTION_FORMULA_RUN_MANIFEST_VERSION,
  REPRODUCIBILITY_IDENTITY_ALGORITHM,
  simulationRunManifestV145Schema,
  simulationRunManifestV146Schema,
  simConfigV144Schema,
  simConfigV145Schema,
  simConfigV146Schema
} from "./index";

const legacyConfig = {
  meta: { name: "direct-group-schema", version: "test-data-v1" },
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

const fixedModel = {
  mode: "fixed-gcsim-direct-damage-group-v1",
  profileId: GCSIM_DAMAGE_GROUP_PROFILE_ID
} as const;

const makeDirectHit = (icdGroup = "pole-extra-attack") => ({
  id: "direct-hit",
  offset: 0,
  scaling: 1,
  directDamageGroup: {
    icdTag: "actor-normal-attack",
    icdGroup
  }
});

const makeCurrentConfig = () => migrateConfig(legacyConfig);

const makeV146Config = () => {
  const current = makeCurrentConfig();
  const {
    schemaVersion: _schemaVersion,
    engineVersion: _engineVersion,
    elementalApplicationIcdModel:
      _elementalApplicationIcdModel,
    reactionOwnedElementalApplicationModel:
      _reactionOwnedElementalApplicationModel,
    reactionDamageGroupModel: _reactionDamageGroupModel,
    ...unchanged
  } = current;
  return simConfigV146Schema.parse({
    ...unchanged,
    schemaVersion: DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
    engineVersion: DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION
  });
};

const makeV145Config = () => {
  const current = makeV146Config();
  const {
    schemaVersion: _schemaVersion,
    engineVersion: _engineVersion,
    directDamageGroupModel: _directDamageGroupModel,
    ...unchanged
  } = current;
  return {
    ...unchanged,
    schemaVersion: REACTION_FORMULA_ROOT_SCHEMA_VERSION,
    engineVersion: REACTION_FORMULA_ROOT_ENGINE_VERSION
  } as const;
};

describe("1.46 direct-damage-group config wire", () => {
  it("requires the exact fixed model and injects it into legacy configs", () => {
    const current = makeCurrentConfig();
    expect(current.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(current.engineVersion).toBe(CURRENT_ENGINE_VERSION);
    expect(current.directDamageGroupModel).toEqual(fixedModel);
    expect(simConfigV146Schema.parse(makeV146Config())).toEqual(
      makeV146Config()
    );
    expect(directDamageGroupModelSchema.parse(fixedModel)).toEqual(
      fixedModel
    );

    for (const directDamageGroupModel of [
      undefined,
      { ...fixedModel, mode: "manual-v1" },
      { ...fixedModel, profileId: "latest" },
      { ...fixedModel, verified: true }
    ]) {
      const forged = {
        ...current,
        directDamageGroupModel
      } as Record<string, unknown>;
      if (directDamageGroupModel === undefined) {
        delete forged.directDamageGroupModel;
      }
      expect(() => parseSimConfig(forged)).toThrow(
        /directDamageGroupModel/
      );
      expect(() => migrateConfig(forged)).toThrow(
        /directDamageGroupModel/
      );
    }

    const inheritedModel = Object.create(fixedModel);
    expect(() =>
      parseSimConfig({
        ...current,
        directDamageGroupModel: inheritedModel
      })
    ).toThrow(/plain JSON objects|explicit own/);
  });

  it("accepts selectors on rotation and legal-timeline hits and requires explicit hit ids", () => {
    const current = makeV146Config();
    const rotationWire = {
      ...current,
      rotation: [
        {
          id: "rotation-action",
          actorId: "actor",
          name: "Rotation action",
          at: 0,
          hits: [makeDirectHit()]
        }
      ]
    };
    const timelineWire = {
      ...current,
      rotation: [],
      timeline: {
        mode: "legal-frame-v1" as const,
        fps: 60 as const,
        legalityMode: "strict" as const,
        initialActiveCharacterId: "actor",
        swapFrames: 1,
        abilities: [
          {
            id: "timeline-ability",
            actorId: "actor",
            name: "Timeline ability",
            kind: "normal" as const,
            cancelFrame: 1,
            animationEndFrame: 1,
            cooldownFrames: 0,
            hits: [
              {
                id: "timeline-hit",
                frame: 0,
                scaling: 1,
                directDamageGroup: {
                  icdTag: "actor-normal-attack",
                  icdGroup: "ayaka-extra-attack"
                }
              }
            ]
          }
        ],
        commands: []
      }
    };

    const parsedRotation = simConfigV146Schema.parse(
      rotationWire
    );
    expect(
      parsedRotation.rotation[0]?.hits?.[0]?.directDamageGroup
    ).toEqual(makeDirectHit().directDamageGroup);
    const parsedTimeline = simConfigV146Schema.parse(
      timelineWire
    );
    expect(
      parsedTimeline.timeline?.abilities[0]?.hits?.[0]
        ?.directDamageGroup
    ).toEqual({
      icdTag: "actor-normal-attack",
      icdGroup: "ayaka-extra-attack"
    });

    const rotationWithoutId = structuredClone(rotationWire);
    delete (rotationWithoutId.rotation[0]!.hits![0]! as {
      id?: string;
    }).id;
    expect(() => parseSimConfig(rotationWithoutId)).toThrow(
      /explicit non-empty hit id/
    );

    const timelineWithoutId = structuredClone(timelineWire);
    delete (timelineWithoutId.timeline.abilities[0]!.hits![0]! as {
      id?: string;
    }).id;
    expect(() => parseSimConfig(timelineWithoutId)).toThrow(
      /explicit non-empty hit id/
    );

    expect(() =>
      simConfigV146Schema.parse({
        ...current,
        rotation: [
          {
            id: "ordinary-action",
            actorId: "actor",
            name: "Ordinary action",
            at: 0,
            hits: [{ offset: 0, scaling: 1 }]
          }
        ]
      })
    ).not.toThrow();
  });

  it("pins all 58 exact group ids while reserving internal reaction groups", () => {
    expect(GCSIM_DAMAGE_GROUP_PROFILE.groups).toHaveLength(58);
    const reserved = new Set(["reaction-a", "reaction-b", "burning"]);
    for (const group of GCSIM_DAMAGE_GROUP_PROFILE.groups) {
      expect(directDamageGroupIdSchema.parse(group.id)).toBe(group.id);
      const selector = {
        icdTag: "tag",
        icdGroup: group.id
      };
      expect(
        directDamageGroupDefinitionSchema.safeParse(selector).success
      ).toBe(!reserved.has(group.id));
    }
    expect(() => directDamageGroupIdSchema.parse("unknown-group")).toThrow();
    for (const icdGroup of reserved) {
      expect(() =>
        directDamageGroupDefinitionSchema.parse({
          icdTag: "tag",
          icdGroup
        })
      ).toThrow(/reserved for internal reaction delivery/);
      expect(() =>
        parseSimConfig({
          ...makeCurrentConfig(),
          rotation: [
            {
              id: "reserved-action",
              actorId: "actor",
              name: "Reserved action",
              at: 0,
              hits: [makeDirectHit(icdGroup)]
            }
          ]
        })
      ).toThrow(/reserved for internal reaction delivery/);
    }
  });

  it("rejects malformed tags, unknown fields, inherited selectors, and unknown groups", () => {
    for (const icdTag of [
      "",
      "   ",
      "nul\0tag",
      "line\nbreak",
      "tab\ttag",
      `c1${String.fromCharCode(0x80)}`,
      "x".repeat(129)
    ]) {
      expect(() =>
        directDamageGroupDefinitionSchema.parse({
          icdTag,
          icdGroup: "default"
        })
      ).toThrow();
    }
    expect(() =>
      directDamageGroupDefinitionSchema.parse({
        icdTag: "tag",
        icdGroup: "unknown-group"
      })
    ).toThrow();
    expect(() =>
      directDamageGroupDefinitionSchema.parse({
        icdTag: "tag",
        icdGroup: "default",
        extra: true
      })
    ).toThrow(/Unrecognized key/);

    const inherited = Object.create({
      icdTag: "tag",
      icdGroup: "default"
    });
    expect(() =>
      directDamageGroupDefinitionSchema.parse(inherited)
    ).toThrow(/plain JSON objects/);
  });

  it("keeps 1.42/1.44/1.45 exact wires closed to both new fields", () => {
    const frozenV145 = makeV145Config();
    expect(simConfigV145Schema.parse(frozenV145)).toEqual(
      frozenV145
    );
    expect(() =>
      simConfigV145Schema.parse({
        ...frozenV145,
        directDamageGroupModel: fixedModel
      })
    ).toThrow(/Unrecognized key/);
    expect(() =>
      migrateConfig({
        ...frozenV145,
        directDamageGroupModel: fixedModel
      })
    ).toThrow(/does not support ordinary direct-damage-group selection/);

    const v145WithHit = {
      ...frozenV145,
      rotation: [
        {
          id: "old-action",
          actorId: "actor",
          name: "Old action",
          at: 0,
          hits: [makeDirectHit()]
        }
      ]
    };
    expect(() => simConfigV145Schema.parse(v145WithHit)).toThrow(
      /Unrecognized key/
    );
    expect(() => migrateConfig(v145WithHit)).toThrow(
      /does not support ordinary direct-damage-group selection/
    );

    const {
      reactionFormulaModel: _reactionFormulaModel,
      ...preFormula
    } = frozenV145;
    const frozenV144 = {
      ...preFormula,
      schemaVersion: BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
      engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION
    };
    expect(simConfigV144Schema.parse(frozenV144)).toEqual(
      frozenV144
    );
    expect(() =>
      migrateConfig({
        ...frozenV144,
        rotation: v145WithHit.rotation
      })
    ).toThrow(/does not support ordinary direct-damage-group selection/);
  });

  it("migrates exact 1.45 through current fixed roots without changing old semantics", () => {
    const frozen = makeV145Config();
    const migrated = migrateConfig(frozen);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
    expect(migrated.reactionFormulaModel).toEqual(
      frozen.reactionFormulaModel
    );
    expect(migrated.directDamageGroupModel).toEqual(fixedModel);

    const {
      schemaVersion: _oldSchema,
      engineVersion: _oldEngine,
      ...oldSemantics
    } = frozen;
    const {
      schemaVersion: _newSchema,
      engineVersion: _newEngine,
      directDamageGroupModel: _newModel,
      elementalApplicationIcdModel:
        _newElementalApplicationIcdModel,
      reactionOwnedElementalApplicationModel:
        _newReactionOwnedElementalApplicationModel,
      reactionDamageGroupModel: _newReactionDamageGroupModel,
      ...newSemantics
    } = migrated;
    expect(newSemantics).toEqual(oldSemantics);

    expect(() =>
      migrateConfig({
        ...frozen,
        reactionFormulaModel: {
          mode: "classic-formula-profile-v1",
          profileId: "latest"
        }
      })
    ).toThrow(/reactionFormulaModel/);
  });
});

describe("1.46 run-manifest exact roots", () => {
  const makeCurrentManifest = () => {
    const config = makeCurrentConfig();
    return createSimulationRunManifest({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION,
      dataVersion: config.dataVersion,
      configHash: createSimulationConfigHash(config),
      resolvedRuntimeOptions: {
        energyMode: "configured",
        critMode: "average",
        compatibilityMode: "legacy-v0.1",
        randomSeed: config.randomSeed
      },
      plugins: [],
      reactionFormulaRoot: CLASSIC_REACTION_FORMULA_ROOT,
      directDamageGroupRoot: GCSIM_DAMAGE_GROUP_ROOT,
      elementalApplicationIcdRoot:
        GCSIM_ELEMENTAL_APPLICATION_ROOT,
      reactionOwnedElementalApplicationRoot:
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT,
      reactionDamageGroupRoot:
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ROOT
    });
  };

  const makeV146Manifest = () => {
    const config = makeV146Config();
    const identity = {
      version: DIRECT_DAMAGE_GROUP_RUN_MANIFEST_VERSION,
      identityAlgorithm: REPRODUCIBILITY_IDENTITY_ALGORITHM,
      schemaVersion: DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
      engineVersion: DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
      dataVersion: config.dataVersion,
      configHash: createSimulationConfigHash(config),
      resolvedRuntimeOptions: {
        energyMode: "configured" as const,
        critMode: "average" as const,
        compatibilityMode: "legacy-v0.1" as const,
        randomSeed: config.randomSeed
      },
      plugins: [],
      reactionFormulaRoot: CLASSIC_REACTION_FORMULA_ROOT,
      directDamageGroupRoot: GCSIM_DAMAGE_GROUP_ROOT
    };
    return {
      ...identity,
      reproducibilityKey:
        createSimulationReproducibilityKey(identity)
    };
  };

  it("binds the canonical elemental-application root in the current manifest", () => {
    expect(makeCurrentManifest().elementalApplicationIcdRoot).toEqual(
      GCSIM_ELEMENTAL_APPLICATION_ROOT
    );
  });

  it("keeps 1.45 and 1.46 manifest wires mutually exact", () => {
    const current = makeV146Manifest();
    expect(simulationRunManifestV146Schema.parse(current)).toEqual(
      current
    );
    expect(() =>
      simulationRunManifestV145Schema.parse(current)
    ).toThrow();

    const frozenIdentity = {
      version: REACTION_FORMULA_RUN_MANIFEST_VERSION,
      identityAlgorithm: REPRODUCIBILITY_IDENTITY_ALGORITHM,
      schemaVersion: REACTION_FORMULA_ROOT_SCHEMA_VERSION,
      engineVersion: REACTION_FORMULA_ROOT_ENGINE_VERSION,
      dataVersion: current.dataVersion,
      configHash: current.configHash,
      resolvedRuntimeOptions: current.resolvedRuntimeOptions,
      plugins: current.plugins,
      reactionFormulaRoot: CLASSIC_REACTION_FORMULA_ROOT
    } as const;
    const frozen = {
      ...frozenIdentity,
      reproducibilityKey:
        createSimulationReproducibilityKey(frozenIdentity)
    };
    expect(simulationRunManifestV145Schema.parse(frozen)).toEqual(
      frozen
    );
    expect(() =>
      simulationRunManifestV146Schema.parse(frozen)
    ).toThrow();
  });

  it("rejects a tampered damage-group root even after coherent re-keying", () => {
    const current = makeV146Manifest();
    const tamperedIdentity = {
      ...current,
      directDamageGroupRoot: {
        ...current.directDamageGroupRoot,
        coverage: "all-icd-semantics"
      }
    };
    const {
      reproducibilityKey: _oldKey,
      ...identity
    } = tamperedIdentity;
    const tampered = {
      ...identity,
      reproducibilityKey: createSimulationReproducibilityKey(
        identity as Parameters<
          typeof createSimulationReproducibilityKey
        >[0]
      )
    };
    expect(() =>
      simulationRunManifestV146Schema.parse(tampered)
    ).toThrow(/exactly equal.*direct-damage-group root/);
  });
});
