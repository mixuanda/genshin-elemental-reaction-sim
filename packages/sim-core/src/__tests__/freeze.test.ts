import type { SimConfig } from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function makeFreezeConfig(includeSuperconduct: boolean): SimConfig {
  const base = makeConfig();
  const template = base.characters[0]!;
  const config: SimConfig = {
    ...base,
    duration: 4,
    cycleLength: 4,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      freezeResistance: 0,
      targets: [
        {
          id: "enemy-0",
          name: "冻结审计目标",
          initialAura: [{ element: "cryo", gaugeUnits: 1 }]
        }
      ]
    },
    characters: [
      {
        ...template,
        id: "hydro",
        name: "Hydro",
        element: "hydro",
        level: 90,
        stats: { ...neutralStats, baseAtk: 1000 }
      },
      {
        ...template,
        id: "electro",
        name: "Electro",
        element: "electro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1000,
          em: 100
        }
      }
    ],
    rotation: [],
    reactionEngine: {
      mode: "aura-v2"
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "hydro",
      swapFrames: 1,
      abilities: [
        {
          id: "hydro-freeze",
          actorId: "hydro",
          name: "Hydro Freeze",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "hydro-freeze-hit",
              label: "水触发冻结",
              frame: 0,
              scaling: 1,
              element: "hydro",
              application: {
                gaugeUnits: 1,
                icd: { mode: "no-icd-v1" }
              }
            }
          ]
        },
        {
          id: "electro-superconduct",
          actorId: "electro",
          name: "Frozen Superconduct",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "electro-superconduct-hit",
              label: "雷触发冻结底超导",
              frame: 0,
              scaling: 1,
              element: "electro",
              application: {
                gaugeUnits: 2,
                icd: { mode: "no-icd-v1" }
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "hydro",
          abilityId: "hydro-freeze"
        },
        ...(includeSuperconduct
          ? ([
              { type: "swap", characterId: "electro" },
              {
                type: "skill",
                actorId: "electro",
                abilityId: "electro-superconduct"
              }
            ] as const)
          : [])
      ]
    }
  };
  return config;
}

describe("Frozen simulation integration", () => {
  it("logs creation and exact natural expiry without changing direct damage", () => {
    const config = makeFreezeConfig(false);
    const result = simulate(config, { critMode: "noCrit" });
    const directHit = result.damageEvents[0];

    expect(result.enemyTargets[0]?.freezeResistance).toBe(0);
    expect(directHit).toMatchObject({
      frame: 0,
      kind: "direct",
      reaction: "freeze",
      damageFactors: {
        reactionBase: 1
      },
      reactionAudit: {
        frozenReaction: {
          operation: "start",
          generatedGaugeUnits: 1.6,
          expiresAtFrame: 176
        }
      }
    });
    expect(
      result.frozenStateLog.map((entry) => ({
        operation: entry.operation,
        frame: entry.frame,
        expiresAtFrame: entry.expiresAtFrame,
        reason: entry.reason
      }))
    ).toEqual([
      {
        operation: "start",
        frame: 0,
        expiresAtFrame: 176,
        reason: null
      },
      {
        operation: "expire",
        frame: 176,
        expiresAtFrame: null,
        reason: "FROZEN_DECAY_EXPIRED"
      }
    ]);
    expect(result.reactionDamageLog).toEqual([]);
    expect(simulate(config, { critMode: "noCrit" })).toEqual(result);
  });

  it("consumes Frozen durability for Superconduct and cancels stale expiry", () => {
    const result = simulate(makeFreezeConfig(true), {
      critMode: "noCrit"
    });
    const trigger = result.damageEvents.find(
      (event) =>
        event.kind === "direct" &&
        event.sourceActorId === "electro"
    );
    const superconduct = result.damageEvents.find(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "superconduct"
    );

    expect(trigger).toMatchObject({
      frame: 2,
      reaction: "superconduct",
      reactionAudit: {
        periodicReaction: null,
        frozenReaction: {
          operation: "consume",
          frozenGaugeAfter: 0,
          expiresAtFrame: null
        }
      }
    });
    expect(superconduct).toMatchObject({
      frame: 3,
      element: "cryo",
      parentDamageEventId: trigger?.id
    });
    expect(
      result.frozenStateLog.map((entry) => [
        entry.operation,
        entry.frame,
        entry.reason
      ])
    ).toEqual([
      ["start", 0, null],
      ["consume", 2, "FROZEN_CONSUMED_BY_SUPERCONDUCT"]
    ]);
    expect(result.reactionStatusLog).toHaveLength(1);
  });

  it("resolves target-specific Frozen immunity without hiding the reaction", () => {
    const config = makeFreezeConfig(false);
    config.enemy.freezeResistance = 0.25;
    config.enemy.targets![0]!.freezeResistance = 1;
    const result = simulate(config, { critMode: "noCrit" });

    expect(result.enemyTargets[0]?.freezeResistance).toBe(1);
    expect(result.damageEvents[0]).toMatchObject({
      reaction: "freeze",
      reactionAudit: {
        auraConsumed: [{ element: "cryo", gaugeUnits: 0.8 }],
        auraAfter: [],
        frozenReaction: {
          generation: 1,
          operation: "immune",
          freezeResistance: 1,
          generatedGaugeUnits: 0,
          expiresAtFrame: null
        }
      }
    });
    expect(result.frozenStateLog).toMatchObject([
      {
        operation: "immune",
        freezeResistance: 1,
        reason: "FREEZE_RESISTANCE_IMMUNE"
      }
    ]);
  });

  it("expires Frozen before a direct hit on the exact boundary frame", () => {
    const config = makeFreezeConfig(true);
    config.characters[1]!.element = "pyro";
    config.characters[1]!.name = "Pyro";
    config.timeline!.abilities[1]!.name = "Boundary Pyro";
    config.timeline!.abilities[1]!.hits![0]!.element = "pyro";
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "hydro",
        abilityId: "hydro-freeze"
      },
      { type: "wait", frames: 174 },
      { type: "swap", characterId: "electro" },
      {
        type: "skill",
        actorId: "electro",
        abilityId: "electro-superconduct"
      }
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const boundaryHit = result.damageEvents.find(
      (event) =>
        event.kind === "direct" &&
        event.sourceActorId === "electro"
    );

    expect(boundaryHit).toMatchObject({
      frame: 176,
      reaction: "none",
      reactionAudit: {
        auraBefore: [],
        frozenReaction: null
      }
    });
    expect(
      result.frozenStateLog.map((entry) => [
        entry.operation,
        entry.frame
      ])
    ).toEqual([
      ["start", 0],
      ["expire", 176]
    ]);
  });
});
