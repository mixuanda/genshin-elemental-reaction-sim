import {
  type AuraReactionEngineConfig,
  type SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

type CompatibilityMode = Extract<
  AuraReactionEngineConfig["mode"],
  "aura-v5" | "aura-v6"
>;

function makeSingleHitChainConfig(
  mode: CompatibilityMode
): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    dataVersion: "quicken-burning-bloom-order-provisional-1",
    randomSeed: `quicken-burning-bloom-order-${mode}`,
    duration: 12,
    cycleLength: 12,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Electro + Pyro + Hydro target",
          position: { x: 0, y: 0 },
          initialAura: [
            { element: "electro", gaugeUnits: 0.1 },
            { element: "pyro", gaugeUnits: 1 },
            { element: "hydro", gaugeUnits: 2.4 }
          ]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "dendro",
        name: "Dendro driver",
        element: "dendro",
        level: 90,
        stats: { ...neutralStats, baseAtk: 0 }
      }
    ],
    rotation: [],
    reactionEngine: { mode },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "dendro",
      swapFrames: 1,
      abilities: [
        {
          id: "dendro-chain",
          actorId: "dendro",
          name: "Dendro chain",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "dendro-chain-hit",
              label: "Quicken to Burning to Bloom",
              frame: 0,
              scaling: 0,
              element: "dendro",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed"
              },
              application: {
                gaugeUnits: 1,
                icdTag: "dendro-chain",
                icdGroup: "no-icd"
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "dendro",
          abilityId: "dendro-chain",
          atFrame: 0
        }
      ]
    }
  };
}

describe("Quicken, Burning, and Bloom same-hit serialization", () => {
  it.each(["aura-v5", "aura-v6"] as const)(
    "keeps %s lifecycle mutations in Aura order",
    (mode) => {
      const result = simulate(makeSingleHitChainConfig(mode), {
        critMode: "noCrit"
      });
      const direct = result.damageEvents.find(
        (event) =>
          event.kind === "direct" &&
          event.hitId === "dendro-chain-hit"
      )!;

      expect(direct.reactionAudit.reactions).toEqual([
        "quicken",
        "burning",
        "bloom",
        "bloom"
      ]);
      expect(
        direct.reactionAudit.catalyzeReaction?.quicken
          ?.pendingHydroBloomFollowup
      ).toBe(true);
      const quicken =
        direct.reactionAudit.catalyzeReaction!.quicken!;
      const burningMutation =
        direct.reactionAudit.burningReaction!
          .quickenStateMutation;
      const bloomMutation = direct.reactionAudit.bloomReactions.find(
        (entry) => entry.operation === "quicken-followup"
      )!.quickenStateMutation;

      expect(quicken).toMatchObject({
        operation: "start",
        generation: 1,
        expiresAtFrame: 384
      });
      expect(burningMutation).toMatchObject({
        operation: "decay-rebase",
        generationBefore: 1,
        generationAfter: 2,
        expiresAtFrameBefore: 384,
        expiresAtFrameAfter: 12
      });
      expect(bloomMutation).toMatchObject({
        operation: "partial-consume",
        generationBefore: 2,
        generationAfter: 3,
        expiresAtFrameBefore: 12,
        expiresAtFrameAfter: 6
      });

      expect(
        result.quickenStateLog.map((entry) => ({
          id: entry.id,
          operation: entry.operation,
          generation: entry.generation,
          frame: entry.frame,
          reason: entry.reason,
          expiresAtFrame: entry.expiresAtFrame,
          sourceActorId: entry.sourceActorId,
          triggerDamageEventId: entry.triggerDamageEventId
        }))
      ).toEqual([
        {
          id: 0,
          operation: "start",
          generation: 1,
          frame: 0,
          reason: "QUICKEN_STARTED",
          expiresAtFrame: 384,
          sourceActorId: "dendro",
          triggerDamageEventId: direct.id
        },
        {
          id: 1,
          operation: "decay-rebase",
          generation: 2,
          frame: 0,
          reason: "BURNING_REBASED_QUICKEN_DECAY",
          expiresAtFrame: 12,
          sourceActorId: "dendro",
          triggerDamageEventId: direct.id
        },
        {
          id: 2,
          operation: "partial-consume",
          generation: 3,
          frame: 0,
          reason: "BLOOM_PARTIALLY_CONSUMED_QUICKEN",
          expiresAtFrame: 6,
          sourceActorId: "dendro",
          triggerDamageEventId: direct.id
        },
        {
          id: 3,
          operation: "expire",
          generation: 3,
          frame: 6,
          reason: "QUICKEN_DECAY_EXPIRED",
          expiresAtFrame: null,
          sourceActorId: "dendro",
          triggerDamageEventId: direct.id
        }
      ]);

      const directTimeline =
        result.targetStateTimeline.points.find(
          (point) =>
            point.cause === "direct-hit-application" &&
            point.primaryDamageEventId === direct.id
        );
      expect(directTimeline?.links).toEqual([
        { kind: "damage-event", id: direct.id },
        { kind: "quicken-state-log", id: 1 }
      ]);
      expect(
        result.targetStateTimeline.points.find(
          (point) =>
            point.cause === "quicken-expiry" &&
            point.frame === 6
        )?.links
      ).toEqual([{ kind: "quicken-state-log", id: 3 }]);
      expect(
        result.targetStateTimeline.points.find(
          (point) =>
            point.cause === "quicken-expiry" &&
            point.frame === 12
        )?.links
      ).toEqual([]);
    }
  );
});
