import type { AbilityDefinition } from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

describe("single-target hit resolution", () => {
  it("keeps misses out of damage, Aura, reactions, and hit-confirmed particles", () => {
    const ability: AbilityDefinition = {
      id: "scripted-target-checks",
      actorId: "a",
      name: "目标判定向量",
      kind: "skill",
      cancelFrame: 0,
      animationEndFrame: 24,
      cooldownFrames: 0,
      hits: [
        {
          id: "miss-before-icd",
          label: "范围外",
          frame: 0,
          scaling: 1,
          element: "pyro",
          targeting: {
            targetId: "enemy-0",
            outcome: "miss",
            reason: "OUTSIDE_HITBOX"
          },
          application: {
            gaugeUnits: 1,
            icdTag: "target-vector",
            icdGroup: "default"
          }
        },
        {
          id: "landed-start",
          label: "首次命中",
          frame: 6,
          scaling: 1,
          element: "pyro",
          application: {
            gaugeUnits: 1,
            icdTag: "target-vector",
            icdGroup: "default"
          }
        },
        {
          id: "miss-inside-particle-icd",
          label: "冷却内未命中",
          frame: 12,
          scaling: 1,
          element: "pyro",
          targeting: {
            targetId: "enemy-0",
            outcome: "miss",
            reason: "SCRIPTED_TARGET_MOVED"
          },
          application: {
            gaugeUnits: 1,
            icdTag: "target-vector",
            icdGroup: "default"
          }
        },
        {
          id: "landed-boundary",
          label: "边界命中",
          frame: 24,
          scaling: 1,
          element: "pyro",
          targeting: {
            targetId: "enemy-0",
            outcome: "landed"
          },
          application: {
            gaugeUnits: 1,
            icdTag: "target-vector",
            icdGroup: "default"
          }
        }
      ],
      particles: [
        {
          id: "target-hit-particle",
          source: "target-hit-confirmed",
          element: "pyro",
          count: 1,
          travelFrames: 0,
          trigger: {
            kind: "hit-confirm",
            hitIds: [
              "miss-before-icd",
              "landed-start",
              "miss-inside-particle-icd",
              "landed-boundary"
            ],
            internalCooldown: {
              key: "target-hit-particle-icd",
              durationFrames: 18
            }
          }
        }
      ]
    };
    const config = makeConfig({
      duration: 1,
      cycleLength: 1,
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
      },
      reactionEngine: {
        mode: "aura-v1",
        initialAura: [{ element: "cryo", gaugeUnits: 4 }]
      }
    });

    const result = simulate(config, { critMode: "noCrit" });

    expect(
      result.hitResolutionLog.map(
        ({
          frame,
          hitId,
          outcome,
          landed,
          reason,
          damageEventId,
          displayDamage
        }) => ({
          frame,
          hitId,
          outcome,
          landed,
          reason,
          damageEventId,
          displayDamage
        })
      )
    ).toEqual([
      {
        frame: 0,
        hitId: "miss-before-icd",
        outcome: "miss",
        landed: false,
        reason: "OUTSIDE_HITBOX",
        damageEventId: null,
        displayDamage: 0
      },
      {
        frame: 6,
        hitId: "landed-start",
        outcome: "landed",
        landed: true,
        reason: null,
        damageEventId: 0,
        displayDamage: 855
      },
      {
        frame: 12,
        hitId: "miss-inside-particle-icd",
        outcome: "miss",
        landed: false,
        reason: "SCRIPTED_TARGET_MOVED",
        damageEventId: null,
        displayDamage: 0
      },
      {
        frame: 24,
        hitId: "landed-boundary",
        outcome: "landed",
        landed: true,
        reason: null,
        damageEventId: 1,
        displayDamage: 428
      }
    ]);
    expect(
      result.damageEvents.map(
        ({ id, frame, hitId, targetResolutionId, targetId, reaction }) => ({
          id,
          frame,
          hitId,
          targetResolutionId,
          targetId,
          reaction
        })
      )
    ).toEqual([
      {
        id: 0,
        frame: 6,
        hitId: "landed-start",
        targetResolutionId: 1,
        targetId: "enemy-0",
        reaction: "melt"
      },
      {
        id: 1,
        frame: 24,
        hitId: "landed-boundary",
        targetResolutionId: 3,
        targetId: "enemy-0",
        reaction: "none"
      }
    ]);
    expect(result.auraTimeline.map(({ frame }) => frame)).toEqual([6, 24]);
    expect(
      result.particleTriggerLog.map(
        ({
          frame,
          hitId,
          triggered,
          blockedReason,
          internalCooldownReadyFrame
        }) => ({
          frame,
          hitId,
          triggered,
          blockedReason,
          internalCooldownReadyFrame
        })
      )
    ).toEqual([
      {
        frame: 0,
        hitId: "miss-before-icd",
        triggered: false,
        blockedReason: "TARGET_MISS",
        internalCooldownReadyFrame: null
      },
      {
        frame: 6,
        hitId: "landed-start",
        triggered: true,
        blockedReason: null,
        internalCooldownReadyFrame: 24
      },
      {
        frame: 12,
        hitId: "miss-inside-particle-icd",
        triggered: false,
        blockedReason: "TARGET_MISS",
        internalCooldownReadyFrame: 24
      },
      {
        frame: 24,
        hitId: "landed-boundary",
        triggered: true,
        blockedReason: null,
        internalCooldownReadyFrame: 42
      }
    ]);
    expect(
      result.particleEvents.map(
        ({ spawnFrame, triggerHitId, triggerLogId }) => ({
          spawnFrame,
          triggerHitId,
          triggerLogId
        })
      )
    ).toEqual([
      {
        spawnFrame: 6,
        triggerHitId: "landed-start",
        triggerLogId: 1
      },
      {
        spawnFrame: 24,
        triggerHitId: "landed-boundary",
        triggerLogId: 3
      }
    ]);
    expect(simulate(config, { critMode: "noCrit" })).toEqual(result);
  });

  it("keeps damage immunity, Aura blocking, and hit-confirm blocking independent", () => {
    const ability: AbilityDefinition = {
      id: "target-effect-policy",
      actorId: "a",
      name: "目标层级策略",
      kind: "skill",
      cancelFrame: 0,
      animationEndFrame: 18,
      cooldownFrames: 0,
      hits: [
        {
          id: "all-blocked",
          label: "全层阻断",
          frame: 0,
          scaling: 1,
          element: "pyro",
          targeting: {
            targetId: "enemy-0",
            outcome: "landed",
            reason: "SCRIPTED_FULL_INVULNERABILITY",
            effects: {
              damage: "immune",
              aura: "blocked",
              hitConfirm: "blocked"
            }
          },
          application: {
            gaugeUnits: 1,
            icdTag: "effect-policy",
            icdGroup: "no-icd"
          }
        },
        {
          id: "damage-only-immune",
          label: "只免疫伤害",
          frame: 18,
          scaling: 1,
          element: "pyro",
          targeting: {
            targetId: "enemy-0",
            outcome: "landed",
            reason: "SCRIPTED_DAMAGE_IMMUNITY_ONLY",
            effects: {
              damage: "immune",
              aura: "normal",
              hitConfirm: "normal"
            }
          },
          application: {
            gaugeUnits: 1,
            icdTag: "effect-policy",
            icdGroup: "no-icd"
          }
        }
      ],
      particles: [
        {
          id: "effect-policy-particle",
          source: "effect-policy-hit-confirm",
          element: "pyro",
          count: 1,
          travelFrames: 0,
          trigger: {
            kind: "hit-confirm",
            hitIds: ["all-blocked", "damage-only-immune"],
            internalCooldown: {
              key: "effect-policy-particle-icd",
              durationFrames: 18
            }
          }
        }
      ]
    };
    const config = makeConfig({
      duration: 1,
      cycleLength: 1,
      reactionEngine: {
        mode: "aura-v1",
        initialAura: [{ element: "cryo", gaugeUnits: 4 }]
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
          frame,
          hitId,
          landed,
          damageAllowed,
          auraAllowed,
          hitConfirmAllowed,
          potentialDamage,
          finalDamage
        }) => ({
          frame,
          hitId,
          landed,
          damageAllowed,
          auraAllowed,
          hitConfirmAllowed,
          potentialDamage,
          finalDamage
        })
      )
    ).toEqual([
      {
        frame: 0,
        hitId: "all-blocked",
        landed: true,
        damageAllowed: false,
        auraAllowed: false,
        hitConfirmAllowed: false,
        potentialDamage: 427.5,
        finalDamage: 0
      },
      {
        frame: 18,
        hitId: "damage-only-immune",
        landed: true,
        damageAllowed: false,
        auraAllowed: true,
        hitConfirmAllowed: true,
        potentialDamage: 855,
        finalDamage: 0
      }
    ]);
    expect(
      result.damageEvents.map(
        ({
          frame,
          reaction,
          targetDamagePolicy,
          targetDamageMultiplier,
          potentialDamage,
          finalDamage,
          displayDamage
        }) => ({
          frame,
          reaction,
          targetDamagePolicy,
          targetDamageMultiplier,
          potentialDamage,
          finalDamage,
          displayDamage
        })
      )
    ).toEqual([
      {
        frame: 0,
        reaction: "none",
        targetDamagePolicy: "immune",
        targetDamageMultiplier: 0,
        potentialDamage: 427.5,
        finalDamage: 0,
        displayDamage: 0
      },
      {
        frame: 18,
        reaction: "melt",
        targetDamagePolicy: "immune",
        targetDamageMultiplier: 0,
        potentialDamage: 855,
        finalDamage: 0,
        displayDamage: 0
      }
    ]);
    expect(result.auraTimeline[0]).toMatchObject({
      frame: 0,
      reaction: "none",
      auraApplied: [],
      auraConsumed: [],
      auraBefore: [expect.objectContaining({ element: "cryo" })],
      auraAfter: [expect.objectContaining({ element: "cryo" })]
    });
    expect(result.damageEvents[0]?.reactionAudit.note).toContain(
      "目标效果策略阻止"
    );
    expect(result.auraTimeline[1]).toMatchObject({
      frame: 18,
      reaction: "melt",
      auraApplied: [expect.objectContaining({ element: "pyro" })],
      auraConsumed: [expect.objectContaining({ element: "cryo" })]
    });
    expect(
      result.particleTriggerLog.map(
        ({
          frame,
          hitId,
          triggered,
          blockedReason,
          internalCooldownReadyFrame
        }) => ({
          frame,
          hitId,
          triggered,
          blockedReason,
          internalCooldownReadyFrame
        })
      )
    ).toEqual([
      {
        frame: 0,
        hitId: "all-blocked",
        triggered: false,
        blockedReason: "TARGET_HIT_CONFIRM_BLOCKED",
        internalCooldownReadyFrame: null
      },
      {
        frame: 18,
        hitId: "damage-only-immune",
        triggered: true,
        blockedReason: null,
        internalCooldownReadyFrame: 36
      }
    ]);
    expect(result.particleEvents).toHaveLength(1);
    expect(result.particleEvents[0]).toMatchObject({
      spawnFrame: 18,
      triggerHitId: "damage-only-immune"
    });
    expect(result.totalDamage).toBe(0);
    expect(result.damageCurve.map((point) => point.cumulativeDamage)).toEqual([
      0, 0
    ]);
  });

  it("resolves half-open target phases by frame and lets a hit policy override the active phase", () => {
    const ability: AbilityDefinition = {
      id: "target-phase-boundaries",
      actorId: "a",
      name: "目标阶段边界",
      kind: "skill",
      cancelFrame: 0,
      animationEndFrame: 30,
      cooldownFrames: 0,
      hits: [
        {
          id: "before-phase",
          frame: 5,
          scaling: 1,
          element: "pyro",
          application: {
            gaugeUnits: 1,
            icdTag: "target-phase",
            icdGroup: "no-icd"
          }
        },
        {
          id: "phase-start",
          frame: 6,
          scaling: 1,
          element: "pyro",
          application: {
            gaugeUnits: 1,
            icdTag: "target-phase",
            icdGroup: "no-icd"
          }
        },
        {
          id: "hit-override",
          frame: 12,
          scaling: 1,
          element: "pyro",
          targeting: {
            targetId: "enemy-0",
            outcome: "landed",
            reason: "SCRIPTED_HIT_OVERRIDE",
            effects: {
              damage: "normal",
              aura: "normal",
              hitConfirm: "blocked"
            }
          },
          application: {
            gaugeUnits: 1,
            icdTag: "target-phase",
            icdGroup: "no-icd"
          }
        },
        {
          id: "miss-override",
          frame: 17,
          scaling: 1,
          element: "pyro",
          targeting: {
            targetId: "enemy-0",
            outcome: "miss",
            reason: "SCRIPTED_MISS_OVERRIDE"
          },
          application: {
            gaugeUnits: 1,
            icdTag: "target-phase",
            icdGroup: "no-icd"
          }
        },
        {
          id: "adjacent-phase-start",
          frame: 18,
          scaling: 1,
          element: "pyro",
          application: {
            gaugeUnits: 1,
            icdTag: "target-phase",
            icdGroup: "no-icd"
          }
        },
        {
          id: "after-phases",
          frame: 30,
          scaling: 1,
          element: "pyro",
          application: {
            gaugeUnits: 1,
            icdTag: "target-phase",
            icdGroup: "no-icd"
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
        targetPhases: [
          {
            id: "full-block",
            label: "全层阻断",
            targetId: "enemy-0",
            startFrame: 6,
            endFrame: 18,
            reason: "SCRIPTED_FULL_BLOCK_PHASE",
            effects: {
              damage: "immune",
              aura: "blocked",
              hitConfirm: "blocked"
            }
          },
          {
            id: "damage-only",
            label: "伤害免疫",
            targetId: "enemy-0",
            startFrame: 18,
            endFrame: 30,
            reason: "SCRIPTED_DAMAGE_ONLY_PHASE",
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
        initialAura: [{ element: "cryo", gaugeUnits: 10 }]
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

    expect(result.targetPhaseTimeline).toEqual([
      expect.objectContaining({
        id: "full-block",
        startFrame: 6,
        endFrame: 18,
        startTimeSeconds: 0.1,
        endTimeSeconds: 0.3
      }),
      expect.objectContaining({
        id: "damage-only",
        startFrame: 18,
        endFrame: 30,
        startTimeSeconds: 0.3,
        endTimeSeconds: 0.5
      })
    ]);
    expect(
      result.hitResolutionLog.map(
        ({
          frame,
          hitId,
          targetEffectSource,
          targetPhaseId,
          reason,
          damageAllowed,
          auraAllowed,
          hitConfirmAllowed,
          potentialDamage,
          finalDamage
        }) => ({
          frame,
          hitId,
          targetEffectSource,
          targetPhaseId,
          reason,
          damageAllowed,
          auraAllowed,
          hitConfirmAllowed,
          potentialDamage,
          finalDamage
        })
      )
    ).toEqual([
      {
        frame: 5,
        hitId: "before-phase",
        targetEffectSource: "normal",
        targetPhaseId: null,
        reason: null,
        damageAllowed: true,
        auraAllowed: true,
        hitConfirmAllowed: true,
        potentialDamage: 900,
        finalDamage: 900
      },
      {
        frame: 6,
        hitId: "phase-start",
        targetEffectSource: "target-phase",
        targetPhaseId: "full-block",
        reason: "SCRIPTED_FULL_BLOCK_PHASE",
        damageAllowed: false,
        auraAllowed: false,
        hitConfirmAllowed: false,
        potentialDamage: 450,
        finalDamage: 0
      },
      {
        frame: 12,
        hitId: "hit-override",
        targetEffectSource: "hit",
        targetPhaseId: "full-block",
        reason: "SCRIPTED_HIT_OVERRIDE",
        damageAllowed: true,
        auraAllowed: true,
        hitConfirmAllowed: false,
        potentialDamage: 900,
        finalDamage: 900
      },
      {
        frame: 17,
        hitId: "miss-override",
        targetEffectSource: "hit",
        targetPhaseId: "full-block",
        reason: "SCRIPTED_MISS_OVERRIDE",
        damageAllowed: false,
        auraAllowed: false,
        hitConfirmAllowed: false,
        potentialDamage: 0,
        finalDamage: 0
      },
      {
        frame: 18,
        hitId: "adjacent-phase-start",
        targetEffectSource: "target-phase",
        targetPhaseId: "damage-only",
        reason: "SCRIPTED_DAMAGE_ONLY_PHASE",
        damageAllowed: false,
        auraAllowed: true,
        hitConfirmAllowed: true,
        potentialDamage: 900,
        finalDamage: 0
      },
      {
        frame: 30,
        hitId: "after-phases",
        targetEffectSource: "normal",
        targetPhaseId: null,
        reason: null,
        damageAllowed: true,
        auraAllowed: true,
        hitConfirmAllowed: true,
        potentialDamage: 900,
        finalDamage: 900
      }
    ]);
    expect(result.totalDamage).toBe(2700);
    expect(simulate(config, { critMode: "noCrit" })).toEqual(result);
  });
});
