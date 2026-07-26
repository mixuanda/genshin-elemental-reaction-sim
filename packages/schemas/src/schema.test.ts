import { describe, expect, it } from "vitest";
import {
  ConfigMigrationError,
  CURRENT_SCHEMA_VERSION,
  migrateConfig
} from "./index";

const legacyConfig = {
  meta: { name: "旧配置", version: "0.1.0-demo", note: "legacy" },
  duration: 120,
  cycleLength: 20,
  enemy: { level: 110, resistance: 0.1, defReduction: 0 },
  characters: [
    {
      id: "a",
      name: "A",
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

describe("versioned config schema", () => {
  it("migrates a legacy config and fills required versions/default stats", () => {
    const migrated = migrateConfig(legacyConfig);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe("1.2.0-particles");
    expect(migrated.dataVersion).toBe("0.1.0-demo");
    expect(migrated.randomSeed).toBe("legacy-default");
    expect(migrated.meta.verificationStatus).toBe("provisional");
    expect(migrated.characters[0]?.stats.critRate).toBe(0.05);
  });

  it("reports a precise field path before simulation", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        enemy: { ...legacyConfig.enemy, level: 999 }
      })
    ).toThrowError(ConfigMigrationError);

    try {
      migrateConfig({
        ...legacyConfig,
        enemy: { ...legacyConfig.enemy, level: 999 }
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigMigrationError);
      expect((error as ConfigMigrationError).issues).toContain(
        "enemy.level: Too big: expected number to be <=200"
      );
    }
  });

  it("rejects unknown fields instead of silently ignoring them", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        engineVersion: "1",
        dataVersion: "1",
        randomSeed: "seed",
        meta: {
          ...legacyConfig.meta,
          verificationStatus: "provisional"
        },
        unexpected: true
      })
    ).toThrow(/unexpected/);
  });

  it("rejects unknown character references with a field path", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [
          {
            id: "bad",
            actorId: "missing",
            name: "坏行动",
            at: 0
          }
        ]
      })
    ).toThrow(/rotation\.0\.actorId/);
  });

  it("validates legal timeline ability references before scheduling", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [],
        timeline: {
          mode: "legal-frame-v1",
          fps: 60,
          legalityMode: "strict",
          initialActiveCharacterId: "a",
          swapFrames: 12,
          abilities: [],
          commands: [
            {
              type: "skill",
              actorId: "a",
              abilityId: "missing"
            }
          ]
        }
      })
    ).toThrow(/timeline\.commands\.0\.abilityId/);
  });

  it("rejects absolute rotations mixed with a legal timeline", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [
          {
            id: "legacy-action",
            actorId: "a",
            name: "旧行动",
            at: 0
          }
        ],
        timeline: {
          mode: "legal-frame-v1",
          fps: 60,
          legalityMode: "strict",
          initialActiveCharacterId: "a",
          swapFrames: 12,
          abilities: [],
          commands: []
        }
      })
    ).toThrow(/rotation: must be empty/);
  });

  it("migrates 1.0.0 and 1.1.0 configs to the current particle schema", () => {
    const current = migrateConfig(legacyConfig);
    const migratedFromOne = migrateConfig({
      ...current,
      schemaVersion: "1.0.0",
      engineVersion: "1.0.0-compat"
    });
    const migratedFromAura = migrateConfig({
      ...current,
      schemaVersion: "1.1.0",
      engineVersion: "1.1.0-aura"
    });

    expect(migratedFromOne.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migratedFromOne.engineVersion).toBe("1.2.0-particles");
    expect(migratedFromAura.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migratedFromAura.engineVersion).toBe("1.2.0-particles");
  });

  it("requires an explicit debug flag for reactionOverride", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [],
        reactionEngine: { mode: "aura-v1" },
        timeline: {
          mode: "legal-frame-v1",
          fps: 60,
          legalityMode: "strict",
          initialActiveCharacterId: "a",
          swapFrames: 12,
          abilities: [
            {
              id: "debug-hit",
              actorId: "a",
              name: "debug",
              kind: "skill",
              cancelFrame: 1,
              animationEndFrame: 1,
              cooldownFrames: 0,
              hits: [
                {
                  frame: 0,
                  scaling: 1,
                  element: "pyro",
                  reactionOverride: "melt"
                }
              ]
            }
          ],
          commands: [
            {
              type: "skill",
              actorId: "a",
              abilityId: "debug-hit"
            }
          ]
        }
      })
    ).toThrow(/debugAllowReactionOverride=true/);
  });

  it("validates discrete particle ranges with a precise field path", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [
          {
            id: "particles",
            actorId: "a",
            name: "粒子",
            at: 0,
            particles: [
              {
                element: "pyro",
                count: { min: 2, max: 4, step: 0.7 },
                travelTime: 0
              }
            ]
          }
        ]
      })
    ).toThrow(/rotation\.0\.particles\.0\.count\.step/);
  });

  it("rejects parties larger than the in-game four-character limit", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        characters: Array.from({ length: 5 }, (_, index) => ({
          ...legacyConfig.characters[0],
          id: `character-${index}`
        }))
      })
    ).toThrow(/characters: Genshin parties support at most four characters/);
  });
});
