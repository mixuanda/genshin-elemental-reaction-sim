import {
  playerDamageResultReferencesSchema,
  targetClockResultReferencesSchema,
  type EnemyElementalResistances,
  type SimConfig,
  type SimulationResult
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import {
  simulate,
  validateDisabledPlayerDamageBackReferences,
  validateEnemyTargetOutputProjection
} from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const RESISTANCES: EnemyElementalResistances = {
  pyro: 0.35,
  cryo: 0.1,
  hydro: 0.2,
  electro: 0.25,
  anemo: 0.15,
  geo: 0.3,
  dendro: 0.4,
  physical: 0.5
};

function makeDisabledClockProjectionConfig(): SimConfig {
  return makeConfig({
    enemy: {
      level: 95,
      resistance: 0.12,
      resistances: RESISTANCES,
      defReduction: 0.05,
      freezeResistance: 0.2,
      targets: [
        {
          id: "enemy-0",
          name: "Projection target",
          level: 98,
          position: { x: 2, y: 3 },
          hitboxRadius: 0.75
        }
      ]
    },
    rotation: [
      {
        id: "projection-hit",
        actorId: "a",
        name: "Projection hit",
        at: 0,
        hits: [
          {
            id: "projection-hit-0",
            offset: 0,
            scaling: 1,
            element: "pyro",
            snapshot: "hit"
          }
        ]
      }
    ]
  });
}

function makeDisabledPlayerBurningConfig(): SimConfig {
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
          name: "Burning target",
          initialAura: [
            {
              element: "dendro",
              gaugeUnits: 2
            }
          ]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "pyro",
        name: "Pyro",
        element: "pyro",
        stats: {
          ...neutralStats,
          baseAtk: 0,
          em: 100
        }
      }
    ],
    reactionEngine: {
      mode: "aura-v4"
    },
    rotation: [],
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "pyro",
      swapFrames: 12,
      abilities: [
        {
          id: "burning-start",
          actorId: "pyro",
          name: "Burning start",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "pyro-hit",
              label: "Pyro hit",
              frame: 0,
              scaling: 0,
              element: "pyro",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed"
              },
              application: {
                gaugeUnits: 1,
                icd: { mode: "no-icd-v1" }
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "pyro",
          abilityId: "burning-start"
        }
      ]
    }
  };
}

describe("disabled output fast-path projections", () => {
  it("retains target identity, level, resolved profile, and per-hit resistance checks", () => {
    const result = simulate(
      makeDisabledClockProjectionConfig(),
      { critMode: "noCrit" }
    );
    expect(result.config.targetClockModel.mode).toBe("disabled");
    expect(result.damageEvents).toHaveLength(1);
    expect(() =>
      validateEnemyTargetOutputProjection(result)
    ).not.toThrow();
    expect(() =>
      targetClockResultReferencesSchema.parse(result)
    ).not.toThrow();

    const expectRejected = (
      mutate: (forged: SimulationResult) => void,
      message: RegExp
    ): void => {
      const forged = structuredClone(result);
      mutate(forged);
      expect(() =>
        validateEnemyTargetOutputProjection(forged)
      ).toThrow(message);
      expect(() =>
        targetClockResultReferencesSchema.parse(forged)
      ).toThrow();
    };

    expectRejected(
      (forged) => {
        forged.enemyTargets[0]!.id = "forged-target";
      },
      /enemyTargets\[0\]\.id/
    );
    expectRejected(
      (forged) => {
        forged.enemyTargets[0]!.name = "Forged name";
      },
      /enemyTargets\[0\]\.name/
    );
    expectRejected(
      (forged) => {
        forged.enemyTargets[0]!.level += 1;
      },
      /enemyTargets\[0\]\.level/
    );
    expectRejected(
      (forged) => {
        forged.enemyTargets[0]!.resistance += 0.01;
      },
      /enemyTargets\[0\]\.resistance/
    );
    expectRejected(
      (forged) => {
        forged.enemyTargets[0]!.resistances!.pyro += 0.01;
      },
      /enemyTargets\[0\]\.resistances/
    );
    expectRejected(
      (forged) => {
        forged.damageEvents[0]!.enemyStateBeforeHit.baseResistance +=
          0.01;
      },
      /damageEvents\[0\].*baseResistance/
    );
  });

  it("rejects player back-references when the player model is disabled", () => {
    const result = simulate(
      makeDisabledPlayerBurningConfig(),
      { critMode: "noCrit" }
    );
    expect(result.config.playerDamageModel.mode).toBe(
      "disabled"
    );
    expect(result.reactionDamageLog.length).toBeGreaterThan(0);
    expect(() =>
      validateDisabledPlayerDamageBackReferences(result)
    ).not.toThrow();
    expect(() =>
      playerDamageResultReferencesSchema.parse(result)
    ).not.toThrow();

    const forgedHitReference = structuredClone(result);
    forgedHitReference.reactionDamageLog[0]!
      .playerHitResolutionLogIds = [0];
    expect(() =>
      validateDisabledPlayerDamageBackReferences(
        forgedHitReference
      )
    ).toThrow(/empty player back-references/);
    expect(() =>
      playerDamageResultReferencesSchema.parse(
        forgedHitReference
      )
    ).toThrow(/empty reaction-damage back-references/);

    const forgedDamageReference = structuredClone(result);
    forgedDamageReference.reactionDamageLog[0]!
      .playerDamageEventIds = [0];
    expect(() =>
      validateDisabledPlayerDamageBackReferences(
        forgedDamageReference
      )
    ).toThrow(/empty player back-references/);
    expect(() =>
      playerDamageResultReferencesSchema.parse(
        forgedDamageReference
      )
    ).toThrow(/empty reaction-damage back-references/);
  });
});
