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
        initialAura: [{ element: "cryo", gaugeUnits: 1 }]
      },
      {
        id: "enemy-1",
        name: "副目标",
        level: 90,
        resistance: 0.5,
        defReduction: 0,
        initialAura: [{ element: "hydro", gaugeUnits: 1 }]
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
});
