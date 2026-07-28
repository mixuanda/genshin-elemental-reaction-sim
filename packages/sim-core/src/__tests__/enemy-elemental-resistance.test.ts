import type {
  EnemyElementalResistances,
  SimConfig
} from "@genshin-dps-lab/schemas";
import { enemyTargetsResultReferencesSchema } from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import {
  calcAdditiveReactionDamage,
  calcTransformativeReactionDamage
} from "../formulas";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function resistanceTable(
  overrides: Partial<EnemyElementalResistances> = {}
): EnemyElementalResistances {
  return {
    pyro: 0.1,
    cryo: 0.1,
    hydro: 0.1,
    electro: 0.1,
    anemo: 0.1,
    geo: 0.1,
    dendro: 0.1,
    physical: 0.1,
    ...overrides
  };
}

function makeThreeTargetDirectConfig(): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      resistances: resistanceTable({ pyro: 0.2 }),
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Target table",
          resistances: resistanceTable({ pyro: 0.4 }),
          position: { x: 0, y: 0 }
        },
        {
          id: "target-scalar",
          name: "Target scalar",
          resistance: 0.6,
          initialAura: [{ element: "cryo", gaugeUnits: 1 }],
          position: { x: 1, y: 0 }
        },
        {
          id: "shared-table",
          name: "Shared table",
          initialAura: [{ element: "hydro", gaugeUnits: 1 }],
          position: { x: 2, y: 0 }
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "pyro",
        name: "Pyro",
        element: "pyro",
        level: 90,
        stats: { ...neutralStats, baseAtk: 1_000 }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v1" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "pyro",
      swapFrames: 12,
      abilities: [
        {
          id: "elemental-all-targets",
          actorId: "pyro",
          name: "Melt all targets",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "direct-hit",
              frame: 0,
              scaling: 1,
              element: "pyro",
              geometry: {
                kind: "circle",
                coordinateSpace: "world",
                origin: { x: 0, y: 0 },
                radius: 3
              },
              application: {
                gaugeUnits: 1,
                icdTag: "elemental-all-targets",
                icdGroup: "no-icd"
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "pyro",
          abilityId: "elemental-all-targets"
        }
      ]
    }
  };
}

function makeAggravateConfig(): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      resistances: resistanceTable({ electro: 0.35 }),
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Catalyze target",
          initialAura: [{ element: "dendro", gaugeUnits: 1 }]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "electro",
        name: "Electro",
        element: "electro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1_000,
          em: 100,
          reactionBonus: 0.1
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v3" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "electro",
      swapFrames: 12,
      abilities: [
        {
          id: "aggravate-sequence",
          actorId: "electro",
          name: "Aggravate sequence",
          kind: "skill",
          cancelFrame: 3,
          animationEndFrame: 3,
          cooldownFrames: 0,
          hits: [
            {
              id: "quicken-setup",
              frame: 0,
              scaling: 0,
              element: "electro",
              application: {
                gaugeUnits: 1,
                icdTag: "quicken-setup",
                icdGroup: "no-icd"
              }
            },
            {
              id: "aggravate-hit",
              frame: 2,
              scaling: 1,
              element: "electro",
              application: {
                gaugeUnits: 1,
                icdTag: "aggravate-hit",
                icdGroup: "no-icd"
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "electro",
          abilityId: "aggravate-sequence"
        }
      ]
    }
  };
}

function makeSuperconductConfig(): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      resistances: resistanceTable({
        cryo: 0.25,
        physical: 0.6
      }),
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Superconduct target",
          initialAura: [{ element: "cryo", gaugeUnits: 1 }]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "electro",
        name: "Electro",
        element: "electro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1_000,
          em: 100,
          reactionBonus: 0.2
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "electro",
      swapFrames: 12,
      abilities: [
        {
          id: "superconduct-sequence",
          actorId: "electro",
          name: "Superconduct sequence",
          kind: "skill",
          cancelFrame: 3,
          animationEndFrame: 3,
          cooldownFrames: 0,
          hits: [
            {
              id: "superconduct-trigger",
              frame: 0,
              scaling: 0,
              element: "electro",
              application: {
                gaugeUnits: 1,
                icdTag: "superconduct-trigger",
                icdGroup: "no-icd"
              }
            },
            {
              id: "physical-after-superconduct",
              frame: 2,
              scaling: 1,
              element: "physical"
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "electro",
          abilityId: "superconduct-sequence"
        }
      ]
    }
  };
}

function makeSwirlConfig(): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      resistances: resistanceTable({ pyro: 0.3 }),
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Swirl target",
          initialAura: [{ element: "pyro", gaugeUnits: 1 }]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "anemo",
        name: "Anemo",
        element: "anemo",
        level: 90,
        stats: { ...neutralStats, em: 0, reactionBonus: 0 }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "anemo",
      swapFrames: 12,
      abilities: [
        {
          id: "swirl",
          actorId: "anemo",
          name: "Swirl",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "swirl-trigger",
              frame: 0,
              scaling: 0,
              element: "anemo",
              application: {
                gaugeUnits: 1,
                icdTag: "swirl-trigger",
                icdGroup: "no-icd"
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "anemo",
          abilityId: "swirl"
        }
      ]
    }
  };
}

describe("per-element enemy base resistance", () => {
  it(
    "resolves target table, target scalar, shared table, then shared scalar without output drift",
    () => {
      const config = makeThreeTargetDirectConfig();
      const result = simulate(config, { critMode: "noCrit" });
      expect(() =>
        enemyTargetsResultReferencesSchema.parse(result)
      ).not.toThrow();
      const directHits = result.damageEvents.filter(
        (event) =>
          event.kind === "direct" &&
          event.hitId === "direct-hit"
      );
      const expectedByTarget = new Map([
        [
          "enemy-0",
          {
            baseResistance: 0.4,
            reaction: "none",
            amplifyingReactionMultiplier: 1,
            damage: 300
          }
        ],
        [
          "target-scalar",
          {
            baseResistance: 0.6,
            reaction: "melt",
            amplifyingReactionMultiplier: 2,
            damage: 400
          }
        ],
        [
          "shared-table",
          {
            baseResistance: 0.2,
            reaction: "reverseVaporize",
            amplifyingReactionMultiplier: 1.5,
            damage: 600
          }
        ]
      ]);

      expect(directHits).toHaveLength(3);
      for (const event of directHits) {
        const expected = expectedByTarget.get(event.targetId);
        expect(expected).toBeDefined();
        expect(event).toMatchObject({
          reaction: expected!.reaction,
          element: "pyro",
          enemyStateBeforeHit: {
            baseResistance: expected!.baseResistance,
            resistanceShred: 0,
            effectiveResistance: expected!.baseResistance
          },
          damageFactors: {
            effectiveResistance: expected!.baseResistance,
            resistanceMultiplier: 1 - expected!.baseResistance,
            amplifyingReactionMultiplier:
              expected!.amplifyingReactionMultiplier
          }
        });
        expect(event.finalDamage).toBeCloseTo(
          expected!.damage,
          12
        );
      }

      expect(result.enemyTargets[0]?.resistances?.pyro).toBe(
        0.4
      );
      expect(result.enemyTargets[1]?.resistance).toBe(0.6);
      expect(result.enemyTargets[1]).not.toHaveProperty(
        "resistances"
      );
      expect(result.enemyTargets[2]?.resistances?.pyro).toBe(
        0.2
      );

      const {
        resistances: _shared,
        ...enemyWithoutSharedTable
      } = config.enemy;
      const noTableConfig: SimConfig = {
        ...config,
        enemy: {
          ...enemyWithoutSharedTable,
          targets: config.enemy.targets!.map((target) => {
            const {
              resistances: _targetTable,
              ...targetWithoutTable
            } = target;
            return targetWithoutTable;
          })
        }
      };
      const noTableResult = simulate(noTableConfig, {
        critMode: "noCrit"
      });
      expect(
        noTableResult.enemyTargets.every(
          (target) =>
            !Object.prototype.hasOwnProperty.call(
              target,
              "resistances"
            )
        )
      ).toBe(true);
      expect(
        noTableResult.damageEvents.find(
          (event) => event.targetId === "shared-table"
        )?.enemyStateBeforeHit.baseResistance
      ).toBe(0.1);

      const wrongPerHitResistance = structuredClone(result);
      wrongPerHitResistance.damageEvents[0]!.enemyStateBeforeHit.baseResistance =
        987;
      expect(() =>
        enemyTargetsResultReferencesSchema.parse(
          wrongPerHitResistance
        )
      ).toThrow(
        /must equal the resolved target resistance for this damage element/
      );
    }
  );

  it("uses Electro resistance for the whole direct plus Aggravate additive hit", () => {
    const result = simulate(makeAggravateConfig(), {
      critMode: "noCrit"
    });
    const aggravate = result.damageEvents.find(
      (event) => event.hitId === "aggravate-hit"
    );
    const additive = calcAdditiveReactionDamage({
      reaction: "aggravate",
      characterLevel: 90,
      elementalMastery: 100,
      reactionBonus: 0.1
    });
    const resistanceMultiplier = 0.65;

    expect(aggravate).toMatchObject({
      kind: "direct",
      element: "electro",
      reaction: "aggravate",
      enemyStateBeforeHit: {
        baseResistance: 0.35,
        resistanceShred: 0,
        effectiveResistance: 0.35
      },
      damageFactors: {
        effectiveResistance: 0.35,
        resistanceMultiplier
      },
      additiveReactionFactors: {
        reaction: "aggravate",
        flatDamage: additive.flatDamage,
        appliedFlatDamage: additive.flatDamage
      }
    });
    expect(aggravate?.finalDamage).toBeCloseTo(
      (1_000 + additive.flatDamage) *
        0.5 *
        resistanceMultiplier,
      10
    );
    expect(aggravate?.damageComposition).toEqual({
      direct: expect.closeTo(
        1_000 * 0.5 * resistanceMultiplier,
        10
      ),
      additiveReaction: expect.closeTo(
        additive.flatDamage * 0.5 * resistanceMultiplier,
        10
      ),
      transformativeReaction: 0
    });
  });

  it(
    "uses Cryo resistance for queued Superconduct and Physical resistance before its shred",
    () => {
      const result = simulate(makeSuperconductConfig(), {
        critMode: "noCrit"
      });
      const superconduct = result.damageEvents.find(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.reaction === "superconduct"
      );
      const physical = result.damageEvents.find(
        (event) =>
          event.hitId === "physical-after-superconduct"
      );
      const expectedSuperconduct =
        calcTransformativeReactionDamage({
          characterLevel: 90,
          elementalMastery: 100,
          reactionBonus: 0.2,
          baseMultiplier: 1.5,
          effectiveResistance: 0.25
        });

      expect(superconduct).toMatchObject({
        frame: 1,
        element: "cryo",
        enemyStateBeforeHit: {
          baseResistance: 0.25,
          resistanceShred: 0,
          effectiveResistance: 0.25
        },
        damageFactors: {
          effectiveResistance: 0.25,
          resistanceMultiplier: 0.75
        },
        transformativeReactionFactors: {
          effectiveResistance: 0.25,
          resistanceMultiplier: 0.75
        }
      });
      expect(superconduct?.finalDamage).toBeCloseTo(
        expectedSuperconduct.finalDamage,
        10
      );
      expect(physical).toMatchObject({
        frame: 2,
        element: "physical",
        enemyStateBeforeHit: {
          baseResistance: 0.6,
          resistanceShred: 0.4
        },
        damageFactors: {
          resistanceMultiplier: 0.8
        },
        debuffs: ["超导物理抗性降低"]
      });
      expect(
        physical?.enemyStateBeforeHit.effectiveResistance
      ).toBeCloseTo(0.2, 15);
      expect(
        physical?.damageFactors.effectiveResistance
      ).toBeCloseTo(0.2, 15);
      expect(physical?.finalDamage).toBeCloseTo(400, 12);
    }
  );

  it("uses the absorbed element resistance for queued Swirl damage", () => {
    const result = simulate(makeSwirlConfig(), {
      critMode: "noCrit"
    });
    const swirl = result.damageEvents.find(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "swirlPyro"
    );
    const expected = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: 0,
      reactionBonus: 0,
      baseMultiplier: 0.6,
      effectiveResistance: 0.3
    });

    expect(swirl).toMatchObject({
      frame: 1,
      element: "pyro",
      enemyStateBeforeHit: {
        baseResistance: 0.3,
        resistanceShred: 0,
        effectiveResistance: 0.3
      },
      damageFactors: {
        effectiveResistance: 0.3,
        resistanceMultiplier: 0.7
      },
      transformativeReactionFactors: {
        effectiveResistance: 0.3,
        resistanceMultiplier: 0.7
      }
    });
    expect(swirl?.finalDamage).toBeCloseTo(
      expected.finalDamage,
      10
    );
  });
});
