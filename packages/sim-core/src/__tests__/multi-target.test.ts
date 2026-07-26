import type { AbilityDefinition } from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

describe("registered enemy targets", () => {
  it("keeps stats, Aura, ICD, phases, and audit identity independent per target", () => {
    const ability: AbilityDefinition = {
      id: "multi-target-sequence",
      actorId: "a",
      name: "多目标顺序命中",
      kind: "skill",
      cancelFrame: 0,
      animationEndFrame: 18,
      cooldownFrames: 0,
      hits: [
        {
          id: "main-open",
          label: "主目标起手",
          frame: 0,
          scaling: 1,
          element: "pyro",
          targeting: {
            targetId: "enemy-0",
            outcome: "landed"
          },
          application: {
            gaugeUnits: 1,
            icdTag: "shared-attack-stream",
            icdGroup: "default"
          }
        },
        {
          id: "main-phase-block",
          label: "主目标阶段阻断",
          frame: 6,
          scaling: 1,
          element: "pyro",
          targeting: {
            targetId: "enemy-0",
            outcome: "landed"
          },
          application: {
            gaugeUnits: 1,
            icdTag: "shared-attack-stream",
            icdGroup: "default"
          }
        },
        {
          id: "secondary-phase-immune",
          label: "副目标只免伤",
          frame: 6,
          scaling: 1,
          element: "pyro",
          targeting: {
            targetId: "enemy-1",
            outcome: "landed"
          },
          application: {
            gaugeUnits: 1,
            icdTag: "shared-attack-stream",
            icdGroup: "default"
          }
        },
        {
          id: "main-after-phase",
          label: "主目标阶段后",
          frame: 12,
          scaling: 1,
          element: "pyro",
          targeting: {
            targetId: "enemy-0",
            outcome: "landed"
          },
          application: {
            gaugeUnits: 1,
            icdTag: "shared-attack-stream",
            icdGroup: "default"
          }
        },
        {
          id: "secondary-after-phase",
          label: "副目标阶段后",
          frame: 18,
          scaling: 1,
          element: "pyro",
          targeting: {
            targetId: "enemy-1",
            outcome: "landed"
          },
          application: {
            gaugeUnits: 1,
            icdTag: "shared-attack-stream",
            icdGroup: "default"
          }
        }
      ]
    };
    const config = makeConfig({
      duration: 1,
      cycleLength: 1,
      enemy: {
        level: 90,
        resistance: 0.1,
        defReduction: 0,
        targets: [
          { id: "enemy-0", name: "主目标" },
          {
            id: "enemy-1",
            name: "副目标",
            resistance: 0.5,
            initialAura: [{ element: "hydro", gaugeUnits: 1 }]
          }
        ],
        targetPhases: [
          {
            id: "main-full-block",
            label: "主目标全层阻断",
            targetId: "enemy-0",
            startFrame: 6,
            endFrame: 12,
            reason: "MAIN_FULL_BLOCK",
            effects: {
              damage: "immune",
              aura: "blocked",
              hitConfirm: "blocked"
            }
          },
          {
            id: "secondary-damage-immunity",
            label: "副目标伤害免疫",
            targetId: "enemy-1",
            startFrame: 6,
            endFrame: 18,
            reason: "SECONDARY_DAMAGE_IMMUNITY",
            effects: {
              damage: "immune",
              aura: "normal",
              hitConfirm: "normal"
            }
          }
        ]
      },
      reactionEngine: {
        mode: "aura-v1",
        initialAura: [{ element: "cryo", gaugeUnits: 1 }]
      },
      rotation: [],
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [ability],
        commands: [
          {
            type: "skill",
            actorId: "a",
            abilityId: ability.id
          }
        ]
      }
    });

    const result = simulate(config, { critMode: "noCrit" });

    expect(result.enemyTargets).toEqual([
      {
        id: "enemy-0",
        name: "主目标",
        level: 90,
        resistance: 0.1,
        defReduction: 0,
        initialAura: [{ element: "cryo", gaugeUnits: 1 }],
        position: null,
        hitboxRadius: 0
      },
      {
        id: "enemy-1",
        name: "副目标",
        level: 90,
        resistance: 0.5,
        defReduction: 0,
        initialAura: [{ element: "hydro", gaugeUnits: 1 }],
        position: null,
        hitboxRadius: 0
      }
    ]);
    expect(
      result.hitResolutionLog.map(
        ({
          frame,
          hitId,
          targetId,
          targetName,
          targetPhaseId,
          damageAllowed,
          auraAllowed,
          potentialDamage,
          finalDamage
        }) => ({
          frame,
          hitId,
          targetId,
          targetName,
          targetPhaseId,
          damageAllowed,
          auraAllowed,
          potentialDamage,
          finalDamage
        })
      )
    ).toEqual([
      {
        frame: 0,
        hitId: "main-open",
        targetId: "enemy-0",
        targetName: "主目标",
        targetPhaseId: null,
        damageAllowed: true,
        auraAllowed: true,
        potentialDamage: 900,
        finalDamage: 900
      },
      {
        frame: 6,
        hitId: "main-phase-block",
        targetId: "enemy-0",
        targetName: "主目标",
        targetPhaseId: "main-full-block",
        damageAllowed: false,
        auraAllowed: false,
        potentialDamage: 450,
        finalDamage: 0
      },
      {
        frame: 6,
        hitId: "secondary-phase-immune",
        targetId: "enemy-1",
        targetName: "副目标",
        targetPhaseId: "secondary-damage-immunity",
        damageAllowed: false,
        auraAllowed: true,
        potentialDamage: 375,
        finalDamage: 0
      },
      {
        frame: 12,
        hitId: "main-after-phase",
        targetId: "enemy-0",
        targetName: "主目标",
        targetPhaseId: null,
        damageAllowed: true,
        auraAllowed: true,
        potentialDamage: 450,
        finalDamage: 450
      },
      {
        frame: 18,
        hitId: "secondary-after-phase",
        targetId: "enemy-1",
        targetName: "副目标",
        targetPhaseId: null,
        damageAllowed: true,
        auraAllowed: true,
        potentialDamage: 250,
        finalDamage: 250
      }
    ]);
    expect(
      result.auraTimeline.map(
        ({ frame, targetId, reaction, icdAllowed }) => ({
          frame,
          targetId,
          reaction,
          icdAllowed
        })
      )
    ).toEqual([
      {
        frame: 0,
        targetId: "enemy-0",
        reaction: "melt",
        icdAllowed: true
      },
      {
        frame: 6,
        targetId: "enemy-0",
        reaction: "none",
        icdAllowed: null
      },
      {
        frame: 6,
        targetId: "enemy-1",
        reaction: "reverseVaporize",
        icdAllowed: true
      },
      {
        frame: 12,
        targetId: "enemy-0",
        reaction: "none",
        icdAllowed: false
      },
      {
        frame: 18,
        targetId: "enemy-1",
        reaction: "none",
        icdAllowed: false
      }
    ]);
    expect(result.totalDamage).toBe(1600);
    expect(result.targetSummaries).toEqual([
      {
        targetId: "enemy-0",
        targetName: "主目标",
        damage: 1350,
        potentialDamage: 1800,
        damageEvents: 3,
        landedChecks: 3,
        missedChecks: 0,
        immuneDamageEvents: 1,
        dps: 1350,
        share: 0.84375
      },
      {
        targetId: "enemy-1",
        targetName: "副目标",
        damage: 250,
        potentialDamage: 625,
        damageEvents: 2,
        landedChecks: 2,
        missedChecks: 0,
        immuneDamageEvents: 1,
        dps: 250,
        share: 0.15625
      }
    ]);
    expect(result.damageCurve.map((point) => point.targetId)).toEqual([
      "enemy-0",
      "enemy-0",
      "enemy-1",
      "enemy-0",
      "enemy-1"
    ]);
    expect(simulate(config, { critMode: "noCrit" })).toEqual(result);
  });

  it("fans one logical hit out per target but aggregates hit-confirmed particles once", () => {
    const ability: AbilityDefinition = {
      id: "aoe-fanout",
      actorId: "a",
      name: "范围扇出",
      kind: "skill",
      cancelFrame: 0,
      animationEndFrame: 0,
      cooldownFrames: 0,
      hits: [
        {
          id: "aoe-hit",
          frame: 0,
          scaling: 1,
          element: "pyro",
          targeting: {
            mode: "fanout",
            targets: [
              {
                targetId: "enemy-0",
                outcome: "miss",
                reason: "OUTSIDE_AOE"
              },
              {
                targetId: "enemy-1",
                outcome: "landed",
                reason: "CALLBACK_BLOCKED",
                effects: {
                  damage: "immune",
                  aura: "normal",
                  hitConfirm: "blocked"
                }
              },
              {
                targetId: "enemy-2",
                outcome: "landed"
              }
            ]
          },
          application: {
            gaugeUnits: 1,
            icdTag: "aoe",
            icdGroup: "no-icd"
          }
        }
      ],
      particles: [
        {
          id: "aoe-particle",
          source: "aoe-hit-confirm",
          element: "pyro",
          count: 1,
          travelFrames: 0,
          trigger: {
            kind: "hit-confirm",
            hitIds: ["aoe-hit"]
          }
        }
      ]
    };
    const config = makeConfig({
      duration: 1,
      cycleLength: 1,
      enemy: {
        level: 90,
        resistance: 0.1,
        defReduction: 0,
        targets: [
          { id: "enemy-0", name: "范围外目标" },
          { id: "enemy-1", name: "回调阻断目标" },
          { id: "enemy-2", name: "正常目标" }
        ]
      },
      reactionEngine: {
        mode: "aura-v1",
        initialAura: [{ element: "cryo", gaugeUnits: 1 }]
      },
      rotation: [],
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [ability],
        commands: [
          {
            type: "skill",
            actorId: "a",
            abilityId: ability.id
          }
        ]
      }
    });

    const result = simulate(config, { critMode: "noCrit" });

    expect(
      result.hitResolutionLog.map(
        ({
          targetId,
          outcome,
          damageAllowed,
          auraAllowed,
          hitConfirmAllowed,
          hitGroupId,
          targetIndex,
          targetCount
        }) => ({
          targetId,
          outcome,
          damageAllowed,
          auraAllowed,
          hitConfirmAllowed,
          hitGroupId,
          targetIndex,
          targetCount
        })
      )
    ).toEqual([
      {
        targetId: "enemy-0",
        outcome: "miss",
        damageAllowed: false,
        auraAllowed: false,
        hitConfirmAllowed: false,
        hitGroupId: "aoe-fanout#0:0:0:0",
        targetIndex: 0,
        targetCount: 3
      },
      {
        targetId: "enemy-1",
        outcome: "landed",
        damageAllowed: false,
        auraAllowed: true,
        hitConfirmAllowed: false,
        hitGroupId: "aoe-fanout#0:0:0:0",
        targetIndex: 1,
        targetCount: 3
      },
      {
        targetId: "enemy-2",
        outcome: "landed",
        damageAllowed: true,
        auraAllowed: true,
        hitConfirmAllowed: true,
        hitGroupId: "aoe-fanout#0:0:0:0",
        targetIndex: 2,
        targetCount: 3
      }
    ]);
    expect(result.damageEvents).toHaveLength(2);
    expect(
      result.damageEvents.map(
        ({ targetId, finalDamage, hitGroupId }) => ({
          targetId,
          finalDamage,
          hitGroupId
        })
      )
    ).toEqual([
      {
        targetId: "enemy-1",
        finalDamage: 0,
        hitGroupId: "aoe-fanout#0:0:0:0"
      },
      {
        targetId: "enemy-2",
        finalDamage: 900,
        hitGroupId: "aoe-fanout#0:0:0:0"
      }
    ]);
    expect(result.particleTriggerLog).toEqual([
      expect.objectContaining({
        hitId: "aoe-hit",
        hitGroupId: "aoe-fanout#0:0:0:0",
        checkedTargetIds: ["enemy-0", "enemy-1", "enemy-2"],
        confirmedTargetIds: ["enemy-2"],
        triggered: true,
        blockedReason: null
      })
    ]);
    expect(result.particleEvents).toHaveLength(1);
    expect(result.particleEvents[0]).toMatchObject({
      spawnFrame: 0,
      triggerHitId: "aoe-hit"
    });
    expect(simulate(config, { critMode: "noCrit" })).toEqual(result);
  });

  it("resolves circle geometry at the hitbox boundary and audits distance per target", () => {
    const ability: AbilityDefinition = {
      id: "circle-geometry",
      actorId: "a",
      name: "圆形几何命中",
      kind: "skill",
      cancelFrame: 0,
      animationEndFrame: 0,
      cooldownFrames: 0,
      hits: [
        {
          id: "circle-hit",
          frame: 0,
          scaling: 1,
          element: "pyro",
          geometry: {
            kind: "circle",
            origin: { x: 0, y: 0 },
            radius: 1
          },
          application: {
            gaugeUnits: 1,
            icdTag: "circle-hit",
            icdGroup: "no-icd"
          }
        }
      ],
      particles: [
        {
          id: "circle-particle",
          source: "circle-hit-confirm",
          element: "pyro",
          count: 1,
          travelFrames: 0,
          trigger: {
            kind: "hit-confirm",
            hitIds: ["circle-hit"]
          }
        }
      ]
    };
    const config = makeConfig({
      duration: 1,
      cycleLength: 1,
      enemy: {
        level: 90,
        resistance: 0.1,
        defReduction: 0,
        targets: [
          {
            id: "enemy-0",
            name: "中心目标",
            position: { x: 0, y: 0 },
            hitboxRadius: 0.5
          },
          {
            id: "enemy-1",
            name: "边界目标",
            position: { x: 1.5, y: 0 },
            hitboxRadius: 0.5
          },
          {
            id: "enemy-2",
            name: "范围外目标",
            position: { x: 1.5001, y: 0 },
            hitboxRadius: 0.5
          }
        ]
      },
      reactionEngine: {
        mode: "aura-v1",
        initialAura: [{ element: "cryo", gaugeUnits: 1 }]
      },
      rotation: [],
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [ability],
        commands: [
          {
            type: "skill",
            actorId: "a",
            abilityId: ability.id
          }
        ]
      }
    });

    const result = simulate(config, { critMode: "noCrit" });

    expect(
      result.hitResolutionLog.map(
        ({
          targetId,
          targetingSource,
          geometryDistance,
          geometryThreshold,
          outcome,
          reason,
          targetIndex,
          targetCount
        }) => ({
          targetId,
          targetingSource,
          geometryDistance,
          geometryThreshold,
          outcome,
          reason,
          targetIndex,
          targetCount
        })
      )
    ).toEqual([
      {
        targetId: "enemy-0",
        targetingSource: "geometry",
        geometryDistance: 0,
        geometryThreshold: 1.5,
        outcome: "landed",
        reason: null,
        targetIndex: 0,
        targetCount: 3
      },
      {
        targetId: "enemy-1",
        targetingSource: "geometry",
        geometryDistance: 1.5,
        geometryThreshold: 1.5,
        outcome: "landed",
        reason: null,
        targetIndex: 1,
        targetCount: 3
      },
      {
        targetId: "enemy-2",
        targetingSource: "geometry",
        geometryDistance: 1.5001,
        geometryThreshold: 1.5,
        outcome: "miss",
        reason: "OUTSIDE_CIRCLE_GEOMETRY",
        targetIndex: 2,
        targetCount: 3
      }
    ]);
    expect(result.damageEvents.map((event) => event.targetId)).toEqual([
      "enemy-0",
      "enemy-1"
    ]);
    expect(result.auraTimeline.map((entry) => entry.targetId)).toEqual([
      "enemy-0",
      "enemy-1"
    ]);
    expect(result.totalDamage).toBe(1800);
    expect(result.particleTriggerLog).toEqual([
      expect.objectContaining({
        hitId: "circle-hit",
        hitGroupId: "circle-geometry#0:0:0:0",
        checkedTargetIds: ["enemy-0", "enemy-1", "enemy-2"],
        confirmedTargetIds: ["enemy-0", "enemy-1"],
        triggered: true,
        blockedReason: null
      })
    ]);
    expect(result.particleEvents).toHaveLength(1);
    expect(simulate(config, { critMode: "noCrit" })).toEqual(result);
  });

  it("intersects circular target hitboxes with a rotated rectangle", () => {
    const ability: AbilityDefinition = {
      id: "rotated-rectangle",
      actorId: "a",
      name: "旋转矩形命中",
      kind: "skill",
      cancelFrame: 0,
      animationEndFrame: 0,
      cooldownFrames: 0,
      hits: [
        {
          id: "rectangle-hit",
          frame: 0,
          scaling: 1,
          element: "pyro",
          geometry: {
            kind: "rectangle",
            origin: { x: 0, y: 0 },
            halfWidth: 2,
            halfHeight: 0.5,
            rotationDegrees: 90
          }
        }
      ]
    };
    const config = makeConfig({
      duration: 1,
      cycleLength: 1,
      enemy: {
        level: 90,
        resistance: 0.1,
        defReduction: 0,
        targets: [
          {
            id: "enemy-0",
            name: "矩形内部",
            position: { x: 0, y: 1.5 },
            hitboxRadius: 0
          },
          {
            id: "enemy-1",
            name: "长边边界",
            position: { x: 0, y: 2 },
            hitboxRadius: 0
          },
          {
            id: "enemy-2",
            name: "短边碰撞体接触",
            position: { x: -0.6, y: 0 },
            hitboxRadius: 0.1
          },
          {
            id: "enemy-3",
            name: "角点碰撞体接触",
            position: { x: -0.9, y: 2.3 },
            hitboxRadius: 0.5
          },
          {
            id: "enemy-4",
            name: "角点范围外",
            position: { x: -0.9, y: 2.3001 },
            hitboxRadius: 0.5
          }
        ]
      },
      rotation: [],
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [ability],
        commands: [
          {
            type: "skill",
            actorId: "a",
            abilityId: ability.id
          }
        ]
      }
    });

    const result = simulate(config, { critMode: "noCrit" });
    const rectangleChecks = result.hitResolutionLog;

    expect(
      rectangleChecks.map(
        ({
          targetId,
          geometryKind,
          geometryRadius,
          geometryHalfWidth,
          geometryHalfHeight,
          geometryRotationDegrees,
          geometryThreshold,
          outcome,
          reason
        }) => ({
          targetId,
          geometryKind,
          geometryRadius,
          geometryHalfWidth,
          geometryHalfHeight,
          geometryRotationDegrees,
          geometryThreshold,
          outcome,
          reason
        })
      )
    ).toEqual([
      {
        targetId: "enemy-0",
        geometryKind: "rectangle",
        geometryRadius: null,
        geometryHalfWidth: 2,
        geometryHalfHeight: 0.5,
        geometryRotationDegrees: 90,
        geometryThreshold: 0,
        outcome: "landed",
        reason: null
      },
      {
        targetId: "enemy-1",
        geometryKind: "rectangle",
        geometryRadius: null,
        geometryHalfWidth: 2,
        geometryHalfHeight: 0.5,
        geometryRotationDegrees: 90,
        geometryThreshold: 0,
        outcome: "landed",
        reason: null
      },
      {
        targetId: "enemy-2",
        geometryKind: "rectangle",
        geometryRadius: null,
        geometryHalfWidth: 2,
        geometryHalfHeight: 0.5,
        geometryRotationDegrees: 90,
        geometryThreshold: 0.1,
        outcome: "landed",
        reason: null
      },
      {
        targetId: "enemy-3",
        geometryKind: "rectangle",
        geometryRadius: null,
        geometryHalfWidth: 2,
        geometryHalfHeight: 0.5,
        geometryRotationDegrees: 90,
        geometryThreshold: 0.5,
        outcome: "landed",
        reason: null
      },
      {
        targetId: "enemy-4",
        geometryKind: "rectangle",
        geometryRadius: null,
        geometryHalfWidth: 2,
        geometryHalfHeight: 0.5,
        geometryRotationDegrees: 90,
        geometryThreshold: 0.5,
        outcome: "miss",
        reason: "OUTSIDE_RECTANGLE_GEOMETRY"
      }
    ]);
    expect(rectangleChecks[0]?.geometryDistance).toBeCloseTo(0, 12);
    expect(rectangleChecks[1]?.geometryDistance).toBeCloseTo(0, 12);
    expect(rectangleChecks[2]?.geometryDistance).toBeCloseTo(0.1, 12);
    expect(rectangleChecks[3]?.geometryDistance).toBeCloseTo(0.5, 12);
    expect(rectangleChecks[4]?.geometryDistance).toBeGreaterThan(0.5);
    expect(result.damageEvents).toHaveLength(4);
    expect(simulate(config, { critMode: "noCrit" })).toEqual(result);
  });

  it("intersects target hitboxes with a finite capsule and handles a zero-length segment", () => {
    const ability: AbilityDefinition = {
      id: "capsule-geometry",
      actorId: "a",
      name: "胶囊命中",
      kind: "skill",
      cancelFrame: 0,
      animationEndFrame: 1,
      cooldownFrames: 0,
      hits: [
        {
          id: "capsule-main",
          frame: 0,
          scaling: 1,
          element: "pyro",
          geometry: {
            kind: "capsule",
            start: { x: -2, y: 0 },
            end: { x: 2, y: 0 },
            radius: 0.5
          }
        },
        {
          id: "capsule-degenerate",
          frame: 1,
          scaling: 1,
          element: "pyro",
          geometry: {
            kind: "capsule",
            start: { x: 0, y: 0 },
            end: { x: 0, y: 0 },
            radius: 1
          }
        }
      ]
    };
    const config = makeConfig({
      duration: 1,
      cycleLength: 1,
      enemy: {
        level: 90,
        resistance: 0.1,
        defReduction: 0,
        targets: [
          {
            id: "enemy-0",
            name: "线段内部",
            position: { x: 0, y: 0 },
            hitboxRadius: 0
          },
          {
            id: "enemy-1",
            name: "侧边边界",
            position: { x: 0, y: 0.5 },
            hitboxRadius: 0
          },
          {
            id: "enemy-2",
            name: "端帽边界",
            position: { x: 2.5, y: 0 },
            hitboxRadius: 0
          },
          {
            id: "enemy-3",
            name: "目标碰撞体接触",
            position: { x: 1, y: 0.7 },
            hitboxRadius: 0.2
          },
          {
            id: "enemy-4",
            name: "端帽范围外",
            position: { x: 2.5001, y: 0 },
            hitboxRadius: 0
          }
        ]
      },
      rotation: [],
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [ability],
        commands: [
          {
            type: "skill",
            actorId: "a",
            abilityId: ability.id
          }
        ]
      }
    });

    const result = simulate(config, { critMode: "noCrit" });
    const mainChecks = result.hitResolutionLog.filter(
      (entry) => entry.hitId === "capsule-main"
    );
    expect(
      mainChecks.map(
        ({
          targetId,
          geometryKind,
          geometryStart,
          geometryEnd,
          geometryRadius,
          geometryThreshold,
          outcome,
          reason
        }) => ({
          targetId,
          geometryKind,
          geometryStart,
          geometryEnd,
          geometryRadius,
          geometryThreshold,
          outcome,
          reason
        })
      )
    ).toEqual([
      {
        targetId: "enemy-0",
        geometryKind: "capsule",
        geometryStart: { x: -2, y: 0 },
        geometryEnd: { x: 2, y: 0 },
        geometryRadius: 0.5,
        geometryThreshold: 0.5,
        outcome: "landed",
        reason: null
      },
      {
        targetId: "enemy-1",
        geometryKind: "capsule",
        geometryStart: { x: -2, y: 0 },
        geometryEnd: { x: 2, y: 0 },
        geometryRadius: 0.5,
        geometryThreshold: 0.5,
        outcome: "landed",
        reason: null
      },
      {
        targetId: "enemy-2",
        geometryKind: "capsule",
        geometryStart: { x: -2, y: 0 },
        geometryEnd: { x: 2, y: 0 },
        geometryRadius: 0.5,
        geometryThreshold: 0.5,
        outcome: "landed",
        reason: null
      },
      {
        targetId: "enemy-3",
        geometryKind: "capsule",
        geometryStart: { x: -2, y: 0 },
        geometryEnd: { x: 2, y: 0 },
        geometryRadius: 0.5,
        geometryThreshold: 0.7,
        outcome: "landed",
        reason: null
      },
      {
        targetId: "enemy-4",
        geometryKind: "capsule",
        geometryStart: { x: -2, y: 0 },
        geometryEnd: { x: 2, y: 0 },
        geometryRadius: 0.5,
        geometryThreshold: 0.5,
        outcome: "miss",
        reason: "OUTSIDE_CAPSULE_GEOMETRY"
      }
    ]);
    expect(mainChecks.map((entry) => entry.geometryDistance)).toEqual([
      0, 0.5, 0.5, 0.7, 0.5001000000000002
    ]);
    const degenerateChecks = result.hitResolutionLog.filter(
      (entry) => entry.hitId === "capsule-degenerate"
    );
    expect(degenerateChecks[0]).toMatchObject({
      geometryStart: { x: 0, y: 0 },
      geometryEnd: { x: 0, y: 0 },
      geometryDistance: 0,
      geometryThreshold: 1,
      outcome: "landed"
    });
    expect(degenerateChecks[2]).toMatchObject({
      geometryDistance: 2.5,
      geometryThreshold: 1,
      outcome: "miss"
    });
    expect(result.damageEvents).toHaveLength(6);
    expect(simulate(config, { critMode: "noCrit" })).toEqual(result);
  });

  it("intersects circular target hitboxes with a filled sector and treats 360 degrees as a disk", () => {
    const ability: AbilityDefinition = {
      id: "sector-geometry",
      actorId: "a",
      name: "扇形命中",
      kind: "skill",
      cancelFrame: 0,
      animationEndFrame: 1,
      cooldownFrames: 0,
      hits: [
        {
          id: "sector-main",
          frame: 0,
          scaling: 1,
          element: "pyro",
          geometry: {
            kind: "sector",
            origin: { x: 0, y: 0 },
            radius: 2,
            directionDegrees: 0,
            angleDegrees: 90
          }
        },
        {
          id: "sector-full-disk",
          frame: 1,
          scaling: 1,
          element: "pyro",
          geometry: {
            kind: "sector",
            origin: { x: 0, y: 0 },
            radius: 2,
            directionDegrees: 123,
            angleDegrees: 360
          }
        }
      ]
    };
    const config = makeConfig({
      duration: 1,
      cycleLength: 1,
      enemy: {
        level: 90,
        resistance: 0.1,
        defReduction: 0,
        targets: [
          {
            id: "enemy-0",
            name: "扇形内部",
            position: { x: 1, y: 0 },
            hitboxRadius: 0
          },
          {
            id: "enemy-1",
            name: "圆弧边界",
            position: { x: 2, y: 0 },
            hitboxRadius: 0
          },
          {
            id: "enemy-2",
            name: "径向边界",
            position: { x: 1, y: 1 },
            hitboxRadius: 0
          },
          {
            id: "enemy-3",
            name: "径向边擦碰",
            position: { x: 1, y: 1.2 },
            hitboxRadius: 0.15
          },
          {
            id: "enemy-4",
            name: "角点擦碰",
            position: { x: 1.6, y: 1.6 },
            hitboxRadius: 0.27
          },
          {
            id: "enemy-5",
            name: "圆弧范围外",
            position: { x: 2.0001, y: 0 },
            hitboxRadius: 0
          },
          {
            id: "enemy-6",
            name: "全圆边界擦碰",
            position: { x: 0, y: -2.1 },
            hitboxRadius: 0.1
          }
        ]
      },
      rotation: [],
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [ability],
        commands: [
          {
            type: "skill",
            actorId: "a",
            abilityId: ability.id
          }
        ]
      }
    });

    const result = simulate(config, { critMode: "noCrit" });
    const sectorChecks = result.hitResolutionLog.filter(
      (entry) => entry.hitId === "sector-main"
    );
    expect(
      sectorChecks.map(
        ({
          targetId,
          geometryKind,
          geometryOrigin,
          geometryRadius,
          geometryDirectionDegrees,
          geometryAngleDegrees,
          geometryThreshold,
          outcome,
          reason
        }) => ({
          targetId,
          geometryKind,
          geometryOrigin,
          geometryRadius,
          geometryDirectionDegrees,
          geometryAngleDegrees,
          geometryThreshold,
          outcome,
          reason
        })
      )
    ).toEqual([
      {
        targetId: "enemy-0",
        geometryKind: "sector",
        geometryOrigin: { x: 0, y: 0 },
        geometryRadius: 2,
        geometryDirectionDegrees: 0,
        geometryAngleDegrees: 90,
        geometryThreshold: 0,
        outcome: "landed",
        reason: null
      },
      {
        targetId: "enemy-1",
        geometryKind: "sector",
        geometryOrigin: { x: 0, y: 0 },
        geometryRadius: 2,
        geometryDirectionDegrees: 0,
        geometryAngleDegrees: 90,
        geometryThreshold: 0,
        outcome: "landed",
        reason: null
      },
      {
        targetId: "enemy-2",
        geometryKind: "sector",
        geometryOrigin: { x: 0, y: 0 },
        geometryRadius: 2,
        geometryDirectionDegrees: 0,
        geometryAngleDegrees: 90,
        geometryThreshold: 0,
        outcome: "landed",
        reason: null
      },
      {
        targetId: "enemy-3",
        geometryKind: "sector",
        geometryOrigin: { x: 0, y: 0 },
        geometryRadius: 2,
        geometryDirectionDegrees: 0,
        geometryAngleDegrees: 90,
        geometryThreshold: 0.15,
        outcome: "landed",
        reason: null
      },
      {
        targetId: "enemy-4",
        geometryKind: "sector",
        geometryOrigin: { x: 0, y: 0 },
        geometryRadius: 2,
        geometryDirectionDegrees: 0,
        geometryAngleDegrees: 90,
        geometryThreshold: 0.27,
        outcome: "landed",
        reason: null
      },
      {
        targetId: "enemy-5",
        geometryKind: "sector",
        geometryOrigin: { x: 0, y: 0 },
        geometryRadius: 2,
        geometryDirectionDegrees: 0,
        geometryAngleDegrees: 90,
        geometryThreshold: 0,
        outcome: "miss",
        reason: "OUTSIDE_SECTOR_GEOMETRY"
      },
      {
        targetId: "enemy-6",
        geometryKind: "sector",
        geometryOrigin: { x: 0, y: 0 },
        geometryRadius: 2,
        geometryDirectionDegrees: 0,
        geometryAngleDegrees: 90,
        geometryThreshold: 0.1,
        outcome: "miss",
        reason: "OUTSIDE_SECTOR_GEOMETRY"
      }
    ]);
    expect(sectorChecks[0]?.geometryDistance).toBeCloseTo(0, 12);
    expect(sectorChecks[1]?.geometryDistance).toBeCloseTo(0, 12);
    expect(sectorChecks[2]?.geometryDistance).toBeCloseTo(0, 12);
    expect(sectorChecks[3]?.geometryDistance).toBeCloseTo(
      Math.SQRT1_2 * 0.2,
      12
    );
    expect(sectorChecks[4]?.geometryDistance).toBeCloseTo(
      Math.hypot(1.6 - Math.SQRT2, 1.6 - Math.SQRT2),
      12
    );
    expect(sectorChecks[5]?.geometryDistance).toBeCloseTo(0.0001, 12);

    const fullDiskChecks = result.hitResolutionLog.filter(
      (entry) => entry.hitId === "sector-full-disk"
    );
    expect(fullDiskChecks[6]).toMatchObject({
      geometryDirectionDegrees: 123,
      geometryAngleDegrees: 360,
      geometryThreshold: 0.1,
      outcome: "landed",
      reason: null
    });
    expect(fullDiskChecks[6]?.geometryDistance).toBeCloseTo(0.1, 12);
    expect(fullDiskChecks[5]).toMatchObject({
      geometryDistance: 0.00010000000000021103,
      geometryThreshold: 0,
      outcome: "miss",
      reason: "OUTSIDE_SECTOR_GEOMETRY"
    });
    expect(result.damageEvents).toHaveLength(11);
    expect(simulate(config, { critMode: "noCrit" })).toEqual(result);
  });

  it("interpolates target motion at integer hit frames and holds adjacent boundaries", () => {
    const ability: AbilityDefinition = {
      id: "moving-circle-target",
      actorId: "a",
      name: "移动目标圆形命中",
      kind: "skill",
      cancelFrame: 0,
      animationEndFrame: 120,
      cooldownFrames: 0,
      hits: [0, 30, 31, 60, 75, 90, 105, 106, 120].map((frame) => ({
        id: `moving-hit-${frame}`,
        frame,
        scaling: 1,
        element: "pyro" as const,
        geometry: {
          kind: "circle" as const,
          origin: { x: 0, y: 0 },
          radius: 0.5
        }
      }))
    };
    const config = makeConfig({
      duration: 3,
      cycleLength: 3,
      enemy: {
        level: 90,
        resistance: 0.1,
        defReduction: 0,
        targets: [
          {
            id: "enemy-0",
            name: "往返目标",
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
            label: "返回中心",
            targetId: "enemy-0",
            startFrame: 90,
            endFrame: 120,
            endPosition: { x: 0, y: 0 }
          },
          {
            id: "adjacent-outbound",
            label: "边界帧再次向外",
            targetId: "enemy-0",
            startFrame: 120,
            endFrame: 180,
            endPosition: { x: 2, y: 0 }
          }
        ]
      },
      rotation: [],
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [ability],
        commands: [
          {
            type: "skill",
            actorId: "a",
            abilityId: ability.id
          }
        ]
      }
    });

    const result = simulate(config, { critMode: "noCrit" });

    expect(result.targetMotionTimeline).toEqual([
      {
        id: "outbound",
        label: "向外移动",
        targetId: "enemy-0",
        startFrame: 0,
        endFrame: 60,
        startPosition: { x: 0, y: 0 },
        endPosition: { x: 2, y: 0 },
        startTimeSeconds: 0,
        endTimeSeconds: 1
      },
      {
        id: "return",
        label: "返回中心",
        targetId: "enemy-0",
        startFrame: 90,
        endFrame: 120,
        startPosition: { x: 2, y: 0 },
        endPosition: { x: 0, y: 0 },
        startTimeSeconds: 1.5,
        endTimeSeconds: 2
      },
      {
        id: "adjacent-outbound",
        label: "边界帧再次向外",
        targetId: "enemy-0",
        startFrame: 120,
        endFrame: 180,
        startPosition: { x: 0, y: 0 },
        endPosition: { x: 2, y: 0 },
        startTimeSeconds: 2,
        endTimeSeconds: 3
      }
    ]);
    expect(
      result.hitResolutionLog.map(
        ({ frame, targetPosition, geometryDistance, outcome }) => ({
          frame,
          targetPosition,
          geometryDistance,
          outcome
        })
      )
    ).toEqual([
      {
        frame: 0,
        targetPosition: { x: 0, y: 0 },
        geometryDistance: 0,
        outcome: "landed"
      },
      {
        frame: 30,
        targetPosition: { x: 1, y: 0 },
        geometryDistance: 1,
        outcome: "landed"
      },
      {
        frame: 31,
        targetPosition: { x: 31 / 30, y: 0 },
        geometryDistance: 31 / 30,
        outcome: "miss"
      },
      {
        frame: 60,
        targetPosition: { x: 2, y: 0 },
        geometryDistance: 2,
        outcome: "miss"
      },
      {
        frame: 75,
        targetPosition: { x: 2, y: 0 },
        geometryDistance: 2,
        outcome: "miss"
      },
      {
        frame: 90,
        targetPosition: { x: 2, y: 0 },
        geometryDistance: 2,
        outcome: "miss"
      },
      {
        frame: 105,
        targetPosition: { x: 1, y: 0 },
        geometryDistance: 1,
        outcome: "landed"
      },
      {
        frame: 106,
        targetPosition: { x: 0.9333333333333333, y: 0 },
        geometryDistance: 0.9333333333333333,
        outcome: "landed"
      },
      {
        frame: 120,
        targetPosition: { x: 0, y: 0 },
        geometryDistance: 0,
        outcome: "landed"
      }
    ]);
    expect(result.damageEvents).toHaveLength(5);
    expect(simulate(config, { critMode: "noCrit" })).toEqual(result);
  });
});
