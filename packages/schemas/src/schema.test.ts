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

  it("migrates 1.0.0 through 1.14.0 configs to AoE fanout", () => {
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
});
