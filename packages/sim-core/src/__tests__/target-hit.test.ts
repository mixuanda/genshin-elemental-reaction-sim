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
});
