import { describe, expect, it } from "vitest";
import {
  ConfigMigrationError,
  CURRENT_ENGINE_VERSION,
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
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
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

  it("migrates 1.0.0 through 1.20.0 configs to actor poses", () => {
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
    const migratedFromParticles = migrateConfig({
      ...current,
      schemaVersion: "1.2.0",
      engineVersion: "1.2.0-particles"
    });
    const migratedFromIcdProfiles = migrateConfig({
      ...current,
      schemaVersion: "1.3.0",
      engineVersion: "1.3.0-icd-profiles"
    });
    const migratedFromActionStates = migrateConfig({
      ...current,
      schemaVersion: "1.4.0",
      engineVersion: "1.4.0-action-states"
    });
    const migratedFromFollowupCancels = migrateConfig({
      ...current,
      schemaVersion: "1.5.0",
      engineVersion: "1.5.0-followup-cancels"
    });
    const migratedFromRuntimeEnergy = migrateConfig({
      ...current,
      schemaVersion: "1.6.0",
      engineVersion: "1.6.0-runtime-energy"
    });
    const migratedFromFixedEnergyIcd = migrateConfig({
      ...current,
      schemaVersion: "1.7.0",
      engineVersion: "1.7.0-fixed-energy-icd"
    });
    const migratedFromHitParticles = migrateConfig({
      ...current,
      schemaVersion: "1.8.0",
      engineVersion: "1.8.0-hit-particle-triggers"
    });
    const migratedFromMovementCommands = migrateConfig({
      ...current,
      schemaVersion: "1.9.0",
      engineVersion: "1.9.0-movement-commands"
    });
    const migratedFromStateClears = migrateConfig({
      ...current,
      schemaVersion: "1.10.0",
      engineVersion: "1.10.0-timeline-state-clears"
    });
    const migratedFromTargetHitResolution = migrateConfig({
      ...current,
      schemaVersion: "1.11.0",
      engineVersion: "1.11.0-target-hit-resolution"
    });
    const migratedFromTargetEffectPolicy = migrateConfig({
      ...current,
      schemaVersion: "1.12.0",
      engineVersion: "1.12.0-target-effect-policy"
    });
    const migratedFromTargetPhaseTimeline = migrateConfig({
      ...current,
      schemaVersion: "1.13.0",
      engineVersion: "1.13.0-target-phase-timeline"
    });
    const migratedFromMultiTargetRegistry = migrateConfig({
      ...current,
      schemaVersion: "1.14.0",
      engineVersion: "1.14.0-multi-target-registry"
    });
    const migratedFromAoeFanout = migrateConfig({
      ...current,
      schemaVersion: "1.15.0",
      engineVersion: "1.15.0-aoe-fanout"
    });
    const migratedFromCircleGeometry = migrateConfig({
      ...current,
      schemaVersion: "1.16.0",
      engineVersion: "1.16.0-circle-geometry"
    });
    const migratedFromTargetMotion = migrateConfig({
      ...current,
      schemaVersion: "1.17.0",
      engineVersion: "1.17.0-target-motion"
    });
    const migratedFromOrientedRectangle = migrateConfig({
      ...current,
      schemaVersion: "1.18.0",
      engineVersion: "1.18.0-oriented-rectangle"
    });
    const migratedFromCapsuleGeometry = migrateConfig({
      ...current,
      schemaVersion: "1.19.0",
      engineVersion: "1.19.0-capsule-geometry"
    });
    const migratedFromSectorGeometry = migrateConfig({
      ...current,
      schemaVersion: "1.20.0",
      engineVersion: "1.20.0-sector-geometry"
    });

    expect(migratedFromOne.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migratedFromOne.engineVersion).toBe(CURRENT_ENGINE_VERSION);
    expect(migratedFromAura.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migratedFromAura.engineVersion).toBe(CURRENT_ENGINE_VERSION);
    expect(migratedFromParticles.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromParticles.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromIcdProfiles.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromIcdProfiles.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromActionStates.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromActionStates.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromFollowupCancels.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromFollowupCancels.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromRuntimeEnergy.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromRuntimeEnergy.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromFixedEnergyIcd.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromFixedEnergyIcd.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromHitParticles.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromHitParticles.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromMovementCommands.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromMovementCommands.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromStateClears.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromStateClears.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromTargetHitResolution.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromTargetHitResolution.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromTargetEffectPolicy.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromTargetEffectPolicy.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromTargetPhaseTimeline.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromTargetPhaseTimeline.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromMultiTargetRegistry.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromMultiTargetRegistry.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromAoeFanout.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromAoeFanout.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromCircleGeometry.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromCircleGeometry.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromTargetMotion.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromTargetMotion.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromOrientedRectangle.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromOrientedRectangle.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromCapsuleGeometry.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromCapsuleGeometry.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromSectorGeometry.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromSectorGeometry.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
  });

  it("requires an auditable reason for a scripted miss", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [
          {
            id: "miss",
            actorId: "a",
            name: "未命中",
            at: 0,
            hits: [
              {
                id: "miss-hit",
                offset: 0,
                scaling: 1,
                targeting: {
                  targetId: "enemy-0",
                  outcome: "miss"
                }
              }
            ]
          }
        ]
      })
    ).toThrow(/rotation\.0\.hits\.0\.targeting\.reason/);
  });

  it("rejects a misleading reason on an explicitly landed hit", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [
          {
            id: "landed",
            actorId: "a",
            name: "命中",
            at: 0,
            hits: [
              {
                id: "landed-hit",
                offset: 0,
                scaling: 1,
                targeting: {
                  targetId: "enemy-0",
                  outcome: "landed",
                  reason: "should not exist"
                }
              }
            ]
          }
        ]
      })
    ).toThrow(/rotation\.0\.hits\.0\.targeting\.reason/);
  });

  it("rejects unregistered enemy target ids", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [
          {
            id: "fake-multitarget",
            actorId: "a",
            name: "伪多目标",
            at: 0,
            hits: [
              {
                id: "fake-second-target",
                offset: 0,
                scaling: 1,
                targeting: {
                  targetId: "enemy-1",
                  outcome: "miss",
                  reason: "UNSUPPORTED_SECOND_TARGET"
                }
              }
            ]
          }
        ]
      })
    ).toThrow(/rotation\.0\.hits\.0\.targeting\.targetId/);
  });

  it("accepts registered targets and overlapping phases on different targets", () => {
    const parsed = migrateConfig({
      ...legacyConfig,
      duration: 2,
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          { id: "enemy-0", name: "主目标" },
          {
            id: "enemy-1",
            name: "副目标",
            level: 100,
            resistance: 0.5,
            defReduction: 0.1
          }
        ],
        targetPhases: [
          {
            id: "main-window",
            label: "主目标窗口",
            targetId: "enemy-0",
            startFrame: 30,
            endFrame: 60,
            reason: "MAIN_WINDOW",
            effects: {
              damage: "immune",
              aura: "blocked",
              hitConfirm: "blocked"
            }
          },
          {
            id: "secondary-window",
            label: "副目标窗口",
            targetId: "enemy-1",
            startFrame: 30,
            endFrame: 60,
            reason: "SECONDARY_WINDOW",
            effects: {
              damage: "immune",
              aura: "normal",
              hitConfirm: "normal"
            }
          }
        ]
      },
      rotation: [
        {
          id: "secondary-hit",
          actorId: "a",
          name: "副目标命中",
          at: 0,
          hits: [
            {
              id: "secondary-hit-1",
              offset: 0,
              scaling: 1,
              targeting: {
                targetId: "enemy-1",
                outcome: "landed"
              }
            }
          ]
        }
      ]
    });

    expect(parsed.enemy.targets?.[1]).toMatchObject({
      id: "enemy-1",
      resistance: 0.5
    });
    expect(parsed.enemy.targetPhases).toHaveLength(2);
  });

  it("rejects target-specific initial Aura when the Aura engine is disabled", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        enemy: {
          ...legacyConfig.enemy,
          targets: [
            { id: "enemy-0", name: "主目标" },
            {
              id: "enemy-1",
              name: "副目标",
              initialAura: [{ element: "hydro", gaugeUnits: 1 }]
            }
          ]
        }
      })
    ).toThrow(/enemy\.targets\.1\.initialAura/);
  });

  it("accepts unique AoE fanout targets and rejects duplicates", () => {
    const input = {
      ...legacyConfig,
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          { id: "enemy-0", name: "主目标" },
          { id: "enemy-1", name: "副目标" }
        ]
      },
      rotation: [
        {
          id: "aoe",
          actorId: "a",
          name: "范围命中",
          at: 0,
          hits: [
            {
              id: "aoe-hit",
              offset: 0,
              scaling: 1,
              targeting: {
                mode: "fanout",
                targets: [
                  { targetId: "enemy-0", outcome: "landed" },
                  { targetId: "enemy-1", outcome: "landed" }
                ]
              }
            }
          ]
        }
      ]
    };
    const parsed = migrateConfig(input);
    expect(parsed.rotation[0]?.hits?.[0]?.targeting).toMatchObject({
      mode: "fanout",
      targets: [
        { targetId: "enemy-0" },
        { targetId: "enemy-1" }
      ]
    });

    const duplicate = structuredClone(input);
    duplicate.rotation[0]!.hits[0]!.targeting.targets[1]!.targetId =
      "enemy-0";
    expect(() => migrateConfig(duplicate)).toThrow(
      /targeting\.targets\.1\.targetId/
    );
  });

  it("accepts static circle geometry when every target has a position", () => {
    const parsed = migrateConfig({
      ...legacyConfig,
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "主目标",
            position: { x: 0, y: 0 },
            hitboxRadius: 0.5
          },
          {
            id: "enemy-1",
            name: "副目标",
            position: { x: 1.5, y: 0 },
            hitboxRadius: 0.5
          }
        ]
      },
      rotation: [
        {
          id: "circle",
          actorId: "a",
          name: "圆形范围",
          at: 0,
          hits: [
            {
              id: "circle-hit",
              offset: 0,
              scaling: 1,
              geometry: {
                kind: "circle",
                origin: { x: 0, y: 0 },
                radius: 1
              }
            }
          ]
        }
      ]
    });

    expect(parsed.enemy.targets?.[1]).toMatchObject({
      position: { x: 1.5, y: 0 },
      hitboxRadius: 0.5
    });
    expect(parsed.rotation[0]?.hits?.[0]?.geometry).toEqual({
      kind: "circle",
      origin: { x: 0, y: 0 },
      radius: 1
    });
  });

  it("accepts a rotated rectangle and rejects incomplete rectangle parameters", () => {
    const input = {
      ...legacyConfig,
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "矩形目标",
            position: { x: 0, y: 0 },
            hitboxRadius: 0.5
          }
        ]
      },
      rotation: [
        {
          id: "rectangle",
          actorId: "a",
          name: "矩形范围",
          at: 0,
          hits: [
            {
              id: "rectangle-hit",
              offset: 0,
              scaling: 1,
              geometry: {
                kind: "rectangle",
                origin: { x: 0, y: 0 },
                halfWidth: 2,
                halfHeight: 0.5,
                rotationDegrees: 45
              }
            }
          ]
        }
      ]
    };
    const parsed = migrateConfig(input);
    expect(parsed.rotation[0]?.hits?.[0]?.geometry).toEqual({
      kind: "rectangle",
      origin: { x: 0, y: 0 },
      halfWidth: 2,
      halfHeight: 0.5,
      rotationDegrees: 45
    });

    const invalid = structuredClone(input);
    invalid.rotation[0]!.hits[0]!.geometry.halfHeight = 0;
    expect(() => migrateConfig(invalid)).toThrow(
      /geometry\.halfHeight/
    );
  });

  it("accepts capsule geometry including a degenerate zero-length segment", () => {
    const parsed = migrateConfig({
      ...legacyConfig,
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "胶囊目标",
            position: { x: 0, y: 0 },
            hitboxRadius: 0.5
          }
        ]
      },
      rotation: [
        {
          id: "capsule",
          actorId: "a",
          name: "胶囊范围",
          at: 0,
          hits: [
            {
              id: "capsule-hit",
              offset: 0,
              scaling: 1,
              geometry: {
                kind: "capsule",
                start: { x: -1, y: 0 },
                end: { x: 2, y: 0 },
                radius: 0.5
              }
            },
            {
              id: "degenerate-capsule",
              offset: 0,
              scaling: 1,
              geometry: {
                kind: "capsule",
                start: { x: 0, y: 0 },
                end: { x: 0, y: 0 },
                radius: 1
              }
            }
          ]
        }
      ]
    });

    expect(parsed.rotation[0]?.hits?.[0]?.geometry).toEqual({
      kind: "capsule",
      start: { x: -1, y: 0 },
      end: { x: 2, y: 0 },
      radius: 0.5
    });
    expect(parsed.rotation[0]?.hits?.[1]?.geometry).toMatchObject({
      kind: "capsule",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 0 }
    });
  });

  it("accepts a filled sector geometry and rejects invalid angular bounds", () => {
    const input = {
      ...legacyConfig,
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "扇形目标",
            position: { x: 1, y: 0 },
            hitboxRadius: 0.25
          }
        ]
      },
      rotation: [
        {
          id: "sector",
          actorId: "a",
          name: "扇形范围",
          at: 0,
          hits: [
            {
              id: "sector-hit",
              offset: 0,
              scaling: 1,
              geometry: {
                kind: "sector",
                origin: { x: 0, y: 0 },
                radius: 2,
                directionDegrees: 45,
                angleDegrees: 90
              }
            }
          ]
        }
      ]
    };

    const parsed = migrateConfig(input);
    expect(parsed.rotation[0]?.hits?.[0]?.geometry).toEqual({
      kind: "sector",
      origin: { x: 0, y: 0 },
      radius: 2,
      directionDegrees: 45,
      angleDegrees: 90
    });

    const invalidAngle = structuredClone(input);
    invalidAngle.rotation[0]!.hits[0]!.geometry.angleDegrees = 0;
    expect(() => migrateConfig(invalidAngle)).toThrow(
      /geometry\.angleDegrees/
    );

    const invalidDirection = structuredClone(input);
    invalidDirection.rotation[0]!.hits[0]!.geometry.directionDegrees =
      360.1;
    expect(() => migrateConfig(invalidDirection)).toThrow(
      /geometry\.directionDegrees/
    );
  });

  it("validates static actor poses required by actor-local geometry", () => {
    const input = {
      ...legacyConfig,
      actorPoses: [
        {
          actorId: "a",
          position: { x: 10, y: 20 },
          facingDegrees: 90
        }
      ],
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "局部坐标目标",
            position: { x: 10, y: 21 },
            hitboxRadius: 0
          }
        ]
      },
      rotation: [
        {
          id: "actor-local",
          actorId: "a",
          name: "施放者局部范围",
          at: 0,
          hits: [
            {
              id: "actor-local-hit",
              offset: 0,
              scaling: 1,
              geometry: {
                kind: "circle",
                coordinateSpace: "actor-local",
                origin: { x: 1, y: 0 },
                radius: 0.1
              }
            }
          ]
        }
      ]
    };

    const parsed = migrateConfig(input);
    expect(parsed.actorPoses).toEqual(input.actorPoses);
    expect(
      parsed.rotation[0]?.hits?.[0]?.geometry?.coordinateSpace
    ).toBe("actor-local");

    const missingPose = structuredClone(input);
    missingPose.actorPoses.length = 0;
    expect(() => migrateConfig(missingPose)).toThrow(
      /geometry\.coordinateSpace: actor-local geometry requires an actorPoses entry/
    );

    const duplicatePose = structuredClone(input);
    duplicatePose.actorPoses.push({
      actorId: "a",
      position: { x: 0, y: 0 },
      facingDegrees: 0
    });
    expect(() => migrateConfig(duplicatePose)).toThrow(
      /actorPoses\.1\.actorId: duplicate actor pose/
    );

    const unknownPose = structuredClone(input);
    unknownPose.actorPoses[0]!.actorId = "missing";
    expect(() => migrateConfig(unknownPose)).toThrow(
      /actorPoses\.0\.actorId: unknown character id/
    );
  });

  it("requires complete target positions and one hit-resolution source for geometry", () => {
    const base = {
      ...legacyConfig,
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "主目标",
            position: { x: 0, y: 0 }
          },
          { id: "enemy-1", name: "缺少位置" }
        ]
      },
      rotation: [
        {
          id: "circle",
          actorId: "a",
          name: "圆形范围",
          at: 0,
          hits: [
            {
              id: "circle-hit",
              offset: 0,
              scaling: 1,
              geometry: {
                kind: "circle",
                origin: { x: 0, y: 0 },
                radius: 1
              }
            }
          ]
        }
      ]
    };

    expect(() => migrateConfig(base)).toThrow(
      /requires enemy\.targets and a position for every registered target/
    );

    const conflicting = structuredClone(base);
    conflicting.enemy.targets[1]!.position = { x: 2, y: 0 };
    Object.assign(conflicting.rotation[0]!.hits[0]!, {
      targeting: {
        targetId: "enemy-0",
        outcome: "landed"
      }
    });
    expect(() => migrateConfig(conflicting)).toThrow(
      /cannot be combined with scripted targeting/
    );
  });

  it("accepts sorted adjacent target motions with explicit initial positions", () => {
    const parsed = migrateConfig({
      ...legacyConfig,
      duration: 2,
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "移动目标",
            position: { x: 0, y: 0 },
            hitboxRadius: 0.5
          }
        ],
        targetMotions: [
          {
            id: "outbound",
            label: "向外移动",
            targetId: "enemy-0",
            startFrame: 0,
            endFrame: 60,
            endPosition: { x: 2, y: 0 }
          },
          {
            id: "return",
            label: "返回",
            targetId: "enemy-0",
            startFrame: 60,
            endFrame: 120,
            endPosition: { x: 0, y: 0 }
          }
        ]
      }
    });

    expect(parsed.enemy.targetMotions).toHaveLength(2);
    expect(parsed.enemy.targetMotions?.[1]).toMatchObject({
      startFrame: 60,
      endFrame: 120,
      endPosition: { x: 0, y: 0 }
    });
  });

  it("rejects overlapping, unregistered, and positionless target motions", () => {
    const base = {
      ...legacyConfig,
      duration: 2,
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "移动目标",
            position: { x: 0, y: 0 }
          }
        ],
        targetMotions: [
          {
            id: "first",
            label: "第一段",
            targetId: "enemy-0",
            startFrame: 0,
            endFrame: 60,
            endPosition: { x: 2, y: 0 }
          },
          {
            id: "overlap",
            label: "重叠段",
            targetId: "enemy-0",
            startFrame: 59,
            endFrame: 120,
            endPosition: { x: 0, y: 0 }
          }
        ]
      }
    };
    expect(() => migrateConfig(base)).toThrow(
      /target motions must be sorted and non-overlapping/
    );

    const unregistered = structuredClone(base);
    unregistered.enemy.targetMotions = [
      {
        ...unregistered.enemy.targetMotions[0]!,
        targetId: "enemy-1"
      }
    ];
    expect(() => migrateConfig(unregistered)).toThrow(
      /unknown enemy target id "enemy-1"/
    );

    const positionless = structuredClone(base);
    positionless.enemy.targets = [
      { id: "enemy-0", name: "移动目标" }
    ] as typeof positionless.enemy.targets;
    positionless.enemy.targetMotions = [
      positionless.enemy.targetMotions[0]!
    ];
    expect(() => migrateConfig(positionless)).toThrow(
      /requires an initial position/
    );

    const outOfBounds = structuredClone(base);
    outOfBounds.duration = 1;
    outOfBounds.enemy.targetMotions = [
      {
        ...outOfBounds.enemy.targetMotions[0]!,
        endFrame: 61
      }
    ];
    expect(() => migrateConfig(outOfBounds)).toThrow(
      /targetMotions\.0\.endFrame: must not exceed simulation duration/
    );
  });

  it("requires a reason and at least one change for target effect policies", () => {
    const base = {
      ...legacyConfig,
      rotation: [
        {
          id: "effect-policy",
          actorId: "a",
          name: "目标策略",
          at: 0,
          hits: [
            {
              id: "policy-hit",
              offset: 0,
              scaling: 1,
              targeting: {
                targetId: "enemy-0",
                outcome: "landed",
                effects: {
                  damage: "immune",
                  aura: "blocked",
                  hitConfirm: "blocked"
                }
              }
            }
          ]
        }
      ]
    };

    expect(() => migrateConfig(base)).toThrow(
      /rotation\.0\.hits\.0\.targeting\.reason/
    );
    const withReason = structuredClone(base);
    Object.assign(withReason.rotation[0]!.hits[0]!.targeting, {
      reason: "SCRIPTED_INVULNERABLE_PHASE"
    });
    withReason.rotation[0]!.hits[0]!.targeting.effects = {
      damage: "normal",
      aura: "normal",
      hitConfirm: "normal"
    };
    expect(() => migrateConfig(withReason)).toThrow(
      /rotation\.0\.hits\.0\.targeting\.effects/
    );
  });

  it("accepts an explicit landed target effect policy", () => {
    const parsed = migrateConfig({
      ...legacyConfig,
      rotation: [
        {
          id: "effect-policy",
          actorId: "a",
          name: "目标策略",
          at: 0,
          hits: [
            {
              id: "policy-hit",
              offset: 0,
              scaling: 1,
              targeting: {
                targetId: "enemy-0",
                outcome: "landed",
                reason: "SCRIPTED_INVULNERABLE_PHASE",
                effects: {
                  damage: "immune",
                  aura: "blocked",
                  hitConfirm: "blocked"
                }
              }
            }
          ]
        }
      ]
    });

    expect(parsed.rotation[0]?.hits?.[0]?.targeting).toMatchObject({
      outcome: "landed",
      reason: "SCRIPTED_INVULNERABLE_PHASE",
      effects: {
        damage: "immune",
        aura: "blocked",
        hitConfirm: "blocked"
      }
    });
  });

  it("accepts sorted half-open target phases within the simulation", () => {
    const parsed = migrateConfig({
      ...legacyConfig,
      duration: 2,
      enemy: {
        ...legacyConfig.enemy,
        targetPhases: [
          {
            id: "damage-window",
            label: "伤害免疫窗口",
            targetId: "enemy-0",
            startFrame: 30,
            endFrame: 60,
            reason: "SCRIPTED_DAMAGE_WINDOW",
            effects: {
              damage: "immune",
              aura: "normal",
              hitConfirm: "normal"
            }
          },
          {
            id: "full-window",
            label: "全层阻断窗口",
            targetId: "enemy-0",
            startFrame: 60,
            endFrame: 90,
            reason: "SCRIPTED_FULL_WINDOW",
            effects: {
              damage: "immune",
              aura: "blocked",
              hitConfirm: "blocked"
            }
          }
        ]
      }
    });

    expect(parsed.enemy.targetPhases).toHaveLength(2);
    expect(parsed.enemy.targetPhases?.[1]).toMatchObject({
      id: "full-window",
      startFrame: 60,
      endFrame: 90
    });
  });

  it("rejects overlapping or out-of-duration target phases", () => {
    const phase = {
      id: "phase-a",
      label: "阶段 A",
      targetId: "enemy-0",
      startFrame: 30,
      endFrame: 61,
      reason: "SCRIPTED_PHASE_A",
      effects: {
        damage: "immune",
        aura: "blocked",
        hitConfirm: "blocked"
      }
    };
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        duration: 2,
        enemy: {
          ...legacyConfig.enemy,
          targetPhases: [
            phase,
            {
              ...phase,
              id: "phase-b",
              startFrame: 60,
              endFrame: 90
            }
          ]
        }
      })
    ).toThrow(/enemy\.targetPhases\.1\.startFrame/);

    expect(() =>
      migrateConfig({
        ...legacyConfig,
        duration: 1,
        enemy: {
          ...legacyConfig.enemy,
          targetPhases: [phase]
        }
      })
    ).toThrow(/enemy\.targetPhases\.0\.endFrame/);
  });

  it("requires positive explicit occupancy for dash and jump commands", () => {
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
          commands: [{ type: "dash", actorId: "a", frames: 0 }]
        }
      })
    ).toThrow(/timeline\.commands\.0\.frames/);
  });

  it("rejects a hit-confirm particle that names an unknown action hit", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [
          {
            id: "trigger",
            actorId: "a",
            name: "命中产球",
            at: 0,
            hits: [
              {
                id: "known-hit",
                offset: 0,
                scaling: 1,
                element: "pyro"
              }
            ],
            particles: [
              {
                id: "triggered-particle",
                element: "pyro",
                count: 1,
                travelTime: 0,
                trigger: {
                  kind: "hit-confirm",
                  hitIds: ["missing-hit"]
                }
              }
            ]
          }
        ]
      })
    ).toThrow(
      /rotation\.0\.particles\.0\.trigger\.hitIds\.0: unknown action hit id "missing-hit"/
    );
  });

  it("rejects a fixed spawn offset on a hit-confirm particle", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [
          {
            id: "trigger",
            actorId: "a",
            name: "命中产球",
            at: 0,
            hits: [
              {
                id: "hit",
                offset: 0,
                scaling: 1,
                element: "pyro"
              }
            ],
            particles: [
              {
                id: "triggered-particle",
                element: "pyro",
                count: 1,
                spawnOffset: 0,
                travelTime: 0,
                trigger: {
                  kind: "hit-confirm",
                  hitIds: ["hit"]
                }
              }
            ]
          }
        ]
      })
    ).toThrow(
      /rotation\.0\.particles\.0\.spawnOffset: must be omitted for hit-confirm particle triggers/
    );
  });

  it("does not allow custom profiles to replace built-in ICD semantics", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [],
        reactionEngine: {
          mode: "aura-v1",
          icdProfiles: {
            default: {
              resetFrames: 1,
              applicationSequence: [true]
            }
          }
        },
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
    ).toThrow(/built-in ICD group/);
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

  it("requires every consumed action state to be declared as required", () => {
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
          abilities: [
            {
              id: "bad-state",
              actorId: "a",
              name: "坏状态定义",
              kind: "skill",
              cancelFrame: 1,
              animationEndFrame: 1,
              cooldownFrames: 0,
              timelineState: {
                consumes: ["missing-requirement"]
              }
            }
          ],
          commands: []
        }
      })
    ).toThrow(
      /timeline\.abilities\.0\.timelineState\.consumes\.0: consumed state/
    );
  });

  it("accepts energy-gated state transitions for runtime rollback", () => {
    const parsed = migrateConfig({
      ...legacyConfig,
      rotation: [],
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [
          {
            id: "energy-burst-state",
            actorId: "a",
            name: "能量爆发状态",
            kind: "burst",
            cancelFrame: 1,
            animationEndFrame: 1,
            cooldownFrames: 600,
            energyCost: 60,
            timelineState: {
              grants: [
                {
                  key: "burst-active",
                  label: "爆发状态",
                  durationFrames: 60
                }
              ]
            }
          }
        ],
        commands: []
      }
    });

    expect(parsed.timeline?.abilities[0]).toMatchObject({
      energyCost: 60,
      timelineState: {
        grants: [
          {
            key: "burst-active",
            durationFrames: 60
          }
        ]
      }
    });
  });

  it("rejects a followup cancel after the animation end", () => {
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
          abilities: [
            {
              id: "bad-cancel",
              actorId: "a",
              name: "坏取消帧",
              kind: "skill",
              cancelFrame: 1,
              cancelFrames: {
                burst: 11
              },
              animationEndFrame: 10,
              cooldownFrames: 0
            }
          ],
          commands: []
        }
      })
    ).toThrow(
      /timeline\.abilities\.0\.cancelFrames\.burst: must not exceed animationEndFrame/
    );
  });

  it("rejects a non-positive fixed-energy internal cooldown", () => {
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
          abilities: [
            {
              id: "bad-energy-icd",
              actorId: "a",
              name: "坏回能 ICD",
              kind: "skill",
              cancelFrame: 1,
              animationEndFrame: 1,
              cooldownFrames: 0,
              energyGains: [
                {
                  target: "a",
                  amount: 5,
                  internalCooldown: {
                    key: "bad",
                    durationFrames: 0
                  }
                }
              ]
            }
          ],
          commands: []
        }
      })
    ).toThrow(
      /timeline\.abilities\.0\.energyGains\.0\.internalCooldown\.durationFrames/
    );
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

  it("gates Electro Aura behind aura-v2", () => {
    const current = migrateConfig(legacyConfig);
    const withTimeline = {
      ...current,
      rotation: [],
      timeline: {
        mode: "legal-frame-v1" as const,
        fps: 60 as const,
        legalityMode: "strict" as const,
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [],
        commands: []
      }
    };

    expect(() =>
      migrateConfig({
        ...withTimeline,
        reactionEngine: {
          mode: "aura-v1",
          initialAura: [{ element: "electro", gaugeUnits: 1 }]
        }
      })
    ).toThrow(/electro aura requires reactionEngine\.mode to be aura-v2/);

    const parsed = migrateConfig({
      ...withTimeline,
      reactionEngine: {
        mode: "aura-v2",
        initialAura: [{ element: "electro", gaugeUnits: 1 }]
      },
      timeline: {
        ...withTimeline.timeline,
        abilities: [
          {
            id: "electro-hit",
            actorId: "a",
            name: "雷附着",
            kind: "skill",
            cancelFrame: 1,
            animationEndFrame: 1,
            cooldownFrames: 0,
            hits: [
              {
                id: "electro-hit-1",
                frame: 0,
                scaling: 1,
                element: "electro",
                application: {
                  gaugeUnits: 1,
                  icdTag: "electro",
                  icdGroup: "no-icd"
                }
              }
            ]
          }
        ]
      }
    });
    expect(parsed.reactionEngine).toEqual({
      mode: "aura-v2",
      initialAura: [{ element: "electro", gaugeUnits: 1 }]
    });
    expect(
      parsed.timeline?.abilities[0]?.hits?.[0]?.element
    ).toBe("electro");
  });

  it("accepts Anemo applications only in aura-v2", () => {
    const current = migrateConfig(legacyConfig);
    const withAnemoApplication = {
      ...current,
      rotation: [],
      timeline: {
        mode: "legal-frame-v1" as const,
        fps: 60 as const,
        legalityMode: "strict" as const,
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [
          {
            id: "anemo-hit",
            actorId: "a",
            name: "风附着",
            kind: "skill" as const,
            cancelFrame: 1,
            animationEndFrame: 1,
            cooldownFrames: 0,
            hits: [
              {
                id: "anemo-hit-1",
                frame: 0,
                scaling: 1,
                element: "anemo" as const,
                application: {
                  gaugeUnits: 1,
                  icdTag: "anemo",
                  icdGroup: "no-icd" as const
                }
              }
            ]
          }
        ],
        commands: []
      }
    };

    expect(() =>
      migrateConfig({
        ...withAnemoApplication,
        reactionEngine: { mode: "aura-v1" }
      })
    ).toThrow(
      /aura-v1 elemental applications currently support only pyro, cryo, and hydro hits/
    );

    const parsed = migrateConfig({
      ...withAnemoApplication,
      reactionEngine: { mode: "aura-v2" }
    });
    expect(
      parsed.timeline?.abilities[0]?.hits?.[0]?.application
        ?.gaugeUnits
    ).toBe(1);
  });

  it("accepts Geo applications only in aura-v2 and validates shard pickup commands", () => {
    const current = migrateConfig(legacyConfig);
    const withGeoApplication = {
      ...current,
      rotation: [],
      timeline: {
        mode: "legal-frame-v1" as const,
        fps: 60 as const,
        legalityMode: "strict" as const,
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [
          {
            id: "geo-hit",
            actorId: "a",
            name: "岩附着",
            kind: "skill" as const,
            cancelFrame: 1,
            animationEndFrame: 1,
            cooldownFrames: 0,
            hits: [
              {
                id: "geo-hit-1",
                frame: 0,
                scaling: 1,
                element: "geo" as const,
                application: {
                  gaugeUnits: 1,
                  icdTag: "geo",
                  icdGroup: "no-icd" as const
                }
              }
            ]
          }
        ],
        commands: [
          {
            type: "pickUpCrystallize" as const,
            element: "any" as const,
            atFrame: 54
          }
        ]
      }
    };

    expect(() =>
      migrateConfig({
        ...withGeoApplication,
        reactionEngine: { mode: "aura-v1" }
      })
    ).toThrow(
      /aura-v1 elemental applications currently support only pyro, cryo, and hydro hits/
    );

    const parsed = migrateConfig({
      ...withGeoApplication,
      reactionEngine: { mode: "aura-v2" }
    });
    expect(parsed.timeline?.commands).toEqual([
      {
        type: "pickUpCrystallize",
        element: "any",
        atFrame: 54
      }
    ]);
    expect(
      parsed.timeline?.abilities[0]?.hits?.[0]?.application
        ?.gaugeUnits
    ).toBe(1);
  });

  it("migrates the actor-pose schema into the Overload schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...current,
      schemaVersion: "1.21.0",
      engineVersion: "1.21.0-actor-local-geometry"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Overload schema into the Superconduct schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...current,
      schemaVersion: "1.22.0",
      engineVersion: "1.22.0-overload-reaction"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Superconduct schema into the Electro-Charged schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...current,
      schemaVersion: "1.23.0",
      engineVersion: "1.23.0-superconduct-reaction"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Electro-Charged schema into the Frozen-state schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...current,
      schemaVersion: "1.24.0",
      engineVersion: "1.24.0-electro-charged-reaction"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Frozen-state schema into the Shatter schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...current,
      schemaVersion: "1.25.0",
      engineVersion: "1.25.0-freeze-state"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Shatter schema into the Swirl propagation schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...current,
      schemaVersion: "1.26.0",
      engineVersion: "1.26.0-shatter-reaction"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Swirl propagation schema into the Crystallize shard schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...current,
      schemaVersion: "1.27.0",
      engineVersion: "1.27.0-swirl-propagation"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Crystallize shard schema into the Catalyze schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...current,
      schemaVersion: "1.28.0",
      engineVersion: "1.28.0-crystallize-shards"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("gates Dendro Aura and applications behind aura-v3", () => {
    const current = migrateConfig(legacyConfig);
    const withDendroApplication = {
      ...current,
      rotation: [],
      timeline: {
        mode: "legal-frame-v1" as const,
        fps: 60 as const,
        legalityMode: "strict" as const,
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [
          {
            id: "dendro-hit",
            actorId: "a",
            name: "草附着",
            kind: "skill" as const,
            cancelFrame: 1,
            animationEndFrame: 1,
            cooldownFrames: 0,
            hits: [
              {
                id: "dendro-hit-1",
                frame: 0,
                scaling: 1,
                element: "dendro" as const,
                application: {
                  gaugeUnits: 1,
                  icdTag: "dendro",
                  icdGroup: "no-icd" as const
                }
              }
            ]
          }
        ],
        commands: []
      }
    };

    for (const mode of ["aura-v1", "aura-v2"] as const) {
      expect(() =>
        migrateConfig({
          ...withDendroApplication,
          reactionEngine: { mode }
        })
      ).toThrow(
        new RegExp(`${mode} elemental applications currently support`)
      );
      expect(() =>
        migrateConfig({
          ...withDendroApplication,
          reactionEngine: {
            mode,
            initialAura: [{ element: "dendro", gaugeUnits: 1 }]
          },
          timeline: {
            ...withDendroApplication.timeline,
            abilities: []
          }
        })
      ).toThrow(/dendro aura requires reactionEngine\.mode to be aura-v3/);
    }

    const parsed = migrateConfig({
      ...withDendroApplication,
      reactionEngine: {
        mode: "aura-v3",
        initialAura: [{ element: "dendro", gaugeUnits: 1 }]
      }
    });
    expect(parsed.reactionEngine).toEqual({
      mode: "aura-v3",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }]
    });
    expect(parsed.timeline?.abilities[0]?.hits?.[0]?.element).toBe(
      "dendro"
    );
  });

  it("requires a legal frame timeline for aura-v3", () => {
    const current = migrateConfig(legacyConfig);

    expect(() =>
      migrateConfig({
        ...current,
        rotation: [],
        reactionEngine: { mode: "aura-v3" }
      })
    ).toThrow(
      /aura-v1, aura-v2, and aura-v3 currently require timeline\.mode legal-frame-v1/
    );
  });

  it("applies Aura hit validation to aura-v3", () => {
    const current = migrateConfig(legacyConfig);
    const withHit = (hit: Record<string, unknown>) => ({
      ...current,
      rotation: [],
      reactionEngine: { mode: "aura-v3" as const },
      timeline: {
        mode: "legal-frame-v1" as const,
        fps: 60 as const,
        legalityMode: "strict" as const,
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [
          {
            id: "aura-v3-hit",
            actorId: "a",
            name: "Aura v3 validation",
            kind: "skill" as const,
            cancelFrame: 1,
            animationEndFrame: 1,
            cooldownFrames: 0,
            hits: [
              {
                id: "aura-v3-hit-1",
                frame: 0,
                scaling: 1,
                ...hit
              }
            ]
          }
        ],
        commands: []
      }
    });

    expect(() =>
      migrateConfig(
        withHit({
          element: "electro",
          reaction: "melt"
        })
      )
    ).toThrow(/manual reaction labels are forbidden in aura-v1, aura-v2, and aura-v3/);

    expect(() =>
      migrateConfig(
        withHit({
          element: "electro",
          reactionOverride: "melt"
        })
      )
    ).toThrow(/debugAllowReactionOverride=true/);

    expect(() =>
      migrateConfig(
        withHit({
          element: "dendro",
          application: {
            gaugeUnits: 1,
            icdTag: "dendro",
            icdGroup: "missing-profile"
          }
        })
      )
    ).toThrow(/unknown ICD profile "missing-profile"/);

    expect(() =>
      migrateConfig(
        withHit({
          element: "physical",
          application: {
            gaugeUnits: 1,
            icdTag: "invalid",
            icdGroup: "no-icd"
          }
        })
      )
    ).toThrow(
      /aura-v3 elemental applications currently support pyro, cryo, hydro, electro, anemo, geo, and dendro hits/
    );

    const parsed = migrateConfig({
      ...withHit({
        element: "dendro",
        reactionOverride: "melt",
        application: {
          gaugeUnits: 1,
          icdTag: "dendro",
          icdGroup: "no-icd"
        }
      }),
      reactionEngine: {
        mode: "aura-v3",
        debugAllowReactionOverride: true
      }
    });
    expect(
      parsed.timeline?.abilities[0]?.hits?.[0]?.reactionOverride
    ).toBe("melt");
  });

  it("validates blunt strike and poise damage in both action formats", () => {
    const parsed = migrateConfig({
      ...legacyConfig,
      rotation: [
        {
          id: "blunt-action",
          actorId: "a",
          name: "Blunt Action",
          at: 0,
          hits: [
            {
              offset: 0,
              scaling: 1,
              strikeType: "blunt",
              poiseDamage: 90
            }
          ]
        }
      ]
    });
    expect(parsed.rotation[0]?.hits?.[0]).toMatchObject({
      strikeType: "blunt",
      poiseDamage: 90
    });

    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [
          {
            id: "invalid-poise",
            actorId: "a",
            name: "Invalid Poise",
            at: 0,
            hits: [
              {
                offset: 0,
                scaling: 1,
                strikeType: "default",
                poiseDamage: 90
              }
            ]
          }
        ]
      })
    ).toThrow(/rotation\.0\.hits\.0\.poiseDamage/);

    const current = migrateConfig(legacyConfig);
    expect(() =>
      migrateConfig({
        ...current,
        rotation: [],
        timeline: {
          mode: "legal-frame-v1",
          fps: 60,
          legalityMode: "strict",
          initialActiveCharacterId: "a",
          swapFrames: 1,
          abilities: [
            {
              id: "invalid-frame-poise",
              actorId: "a",
              name: "Invalid Frame Poise",
              kind: "skill",
              cancelFrame: 1,
              animationEndFrame: 1,
              cooldownFrames: 0,
              hits: [
                {
                  frame: 0,
                  scaling: 1,
                  poiseDamage: 1
                }
              ]
            }
          ],
          commands: []
        }
      })
    ).toThrow(/timeline\.abilities\.0\.hits\.0\.poiseDamage/);
  });

  it("validates shared and target-specific Frozen resistance", () => {
    const current = migrateConfig(legacyConfig);
    const parsed = migrateConfig({
      ...current,
      enemy: {
        ...current.enemy,
        freezeResistance: 0.25,
        targets: [
          {
            id: "enemy-0",
            name: "冻结抗性目标",
            freezeResistance: 1
          }
        ]
      }
    });

    expect(parsed.enemy.freezeResistance).toBe(0.25);
    expect(parsed.enemy.targets?.[0]?.freezeResistance).toBe(1);
    expect(() =>
      migrateConfig({
        ...current,
        enemy: {
          ...current.enemy,
          freezeResistance: 1.01
        }
      })
    ).toThrow(/enemy\.freezeResistance/);
  });
});
