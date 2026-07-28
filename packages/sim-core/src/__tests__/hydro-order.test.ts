import {
  type AuraReactionEngineConfig,
  type SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { AuraEngine } from "../aura";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function noIcd(gaugeUnits: number) {
  return {
    gaugeUnits,
    icdTag: "hydro-order-test",
    icdGroup: "no-icd" as const
  };
}

const ORDERED_HYDRO_MODES = [
  "aura-v5",
  "aura-v6"
] as const satisfies readonly AuraReactionEngineConfig["mode"][];

function makeHydroFrozenBloomConfig(): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Ordered Hydro target",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            { element: "pyro", gaugeUnits: 1 },
            { element: "cryo", gaugeUnits: 1 },
            { element: "dendro", gaugeUnits: 1 },
            { element: "electro", gaugeUnits: 1 }
          ]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "hydro",
        name: "Hydro",
        element: "hydro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0,
          em: 100,
          reactionBonus: 0.2
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v6" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "hydro",
      swapFrames: 12,
      abilities: [
        {
          id: "ordered-hydro",
          actorId: "hydro",
          name: "Ordered Hydro",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "strong-hydro",
              label: "Strong Hydro",
              frame: 0,
              scaling: 0,
              element: "hydro",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed"
              },
              application: noIcd(3)
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "hydro",
          abilityId: "ordered-hydro",
          atFrame: 0
        }
      ]
    }
  };
}

describe("fixed ordered Hydro reaction pipeline", () => {
  it("aura-v6 rejects Electro-Charged when the same hit creates Frozen", () => {
    const audit = new AuraEngine({
      mode: "aura-v6",
      initialAura: [
        { element: "pyro", gaugeUnits: 1 },
        { element: "cryo", gaugeUnits: 1 },
        { element: "dendro", gaugeUnits: 1 },
        { element: "electro", gaugeUnits: 1 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(3)
    });

    expect(audit.reaction).toBe("vaporize");
    expect(audit.reactions).toEqual([
      "vaporize",
      "freeze",
      "bloom"
    ]);
    expect(audit.auraConsumed).toMatchObject([
      { element: "pyro", gaugeUnits: 0.8 },
      { element: "cryo", gaugeUnits: 0.8 },
      { element: "dendro", gaugeUnits: 0.8 }
    ]);
    expect(audit.frozenReaction).toMatchObject({
      operation: "start",
      generatedGaugeUnits: 1.6,
      frozenGaugeAfter: 1.6
    });
    expect(audit.bloomReactions).toEqual([
      expect.objectContaining({
        sourceGaugeUnitsBefore: 1.8,
        sourceGaugeUnitsSpent: 1.6,
        sourceGaugeUnitsAfter: 0.2,
        dendroConsumedGaugeUnits: 0.8,
        coreSpawnFrame: 30
      })
    ]);
    expect(audit.periodicReaction).toBeNull();
    expect(audit.auraAfter).toEqual([
      expect.objectContaining({
        element: "electro",
        gaugeUnits: 0.8
      }),
      expect.objectContaining({
        element: "frozen",
        gaugeUnits: 1.6
      })
    ]);
  });

  it("keeps aura-v5's historical post-Freeze EC compatibility behavior", () => {
    const audit = new AuraEngine({
      mode: "aura-v5",
      initialAura: [
        { element: "pyro", gaugeUnits: 1 },
        { element: "cryo", gaugeUnits: 1 },
        { element: "dendro", gaugeUnits: 1 },
        { element: "electro", gaugeUnits: 1 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(3)
    });

    expect(audit.reactions).toEqual([
      "vaporize",
      "freeze",
      "bloom",
      "electroCharged"
    ]);
    expect(audit.periodicReaction).toMatchObject({
      operation: "start",
      firstDamageFrame: 10,
      nextTickFrame: 70,
      coexistenceExpiresAtFrame: null
    });
    expect(audit.frozenReaction).toMatchObject({
      operation: "start",
      frozenGaugeAfter: 1.6
    });
    expect(audit.bloomReactions).toEqual([
      expect.objectContaining({
        coreSpawnFrame: 30
      })
    ]);
  });

  it.each(ORDERED_HYDRO_MODES)(
    "%s still allows the post-Freeze EC attempt when Freeze immunity creates no Frozen",
    (mode) => {
      const audit = new AuraEngine({
        mode,
        freezeResistance: 1,
        initialAura: [
          { element: "cryo", gaugeUnits: 1 },
          { element: "electro", gaugeUnits: 1 }
        ]
      }).processHit({
        frame: 0,
        sourceActorId: "hydro",
        element: "hydro",
        application: noIcd(2)
      });

      expect(audit.reactions).toEqual([
        "freeze",
        "electroCharged"
      ]);
      expect(audit.frozenReaction).toMatchObject({
        operation: "immune",
        generatedGaugeUnits: 0,
        frozenGaugeAfter: 0
      });
      expect(audit.periodicReaction).toMatchObject({
        operation: "start",
        firstDamageFrame: 10,
        nextTickFrame: 70,
        coexistenceExpiresAtFrame: null
      });
      expect(audit.auraAfter).toEqual([
        expect.objectContaining({
          element: "electro",
          gaugeUnits: 0.8
        })
      ]);
    }
  );

  it("keeps the F+30 Bloom core but queues no F+10 EC damage while Frozen remains", () => {
    const result = simulate(makeHydroFrozenBloomConfig(), {
      critMode: "noCrit"
    });
    const direct = result.damageEvents.find(
      (event) => event.hitId === "strong-hydro"
    );

    expect(direct?.reactionAudit.reactions).toEqual([
      "vaporize",
      "freeze",
      "bloom"
    ]);
    expect(direct?.reactionAudit.periodicReaction).toBeNull();
    expect(
      result.damageEvents.filter(
        (event) => event.reaction === "electroCharged"
      )
    ).toEqual([]);
    expect(
      result.reactionDamageLog.filter(
        (entry) => entry.reaction === "electroCharged"
      )
    ).toEqual([]);
    expect(
      result.periodicReactionLog.filter(
        (entry) => entry.reaction === "electroCharged"
      )
    ).toEqual([]);
    expect(
      result.dendroCoreLog
        .filter(
          (entry) =>
            entry.operation === "spawn-scheduled" ||
            entry.operation === "spawn"
        )
        .map((entry) => ({
          operation: entry.operation,
          frame: entry.frame,
          spawnFrame:
            entry.operation === "spawn-scheduled"
              ? entry.spawnFrame
              : entry.spawnedAtFrame
        }))
    ).toEqual([
      {
        operation: "spawn-scheduled",
        frame: 0,
        spawnFrame: 30
      },
      {
        operation: "spawn",
        frame: 30,
        spawnFrame: 30
      }
    ]);
  });
});
