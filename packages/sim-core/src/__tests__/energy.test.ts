import type {
  AbilityDefinition,
  LegalTimelineCommand,
  SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import {
  calculateParticleEnergy,
  resolveParticleCount,
  SeededRandom
} from "../energy";
import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

describe("particle energy rules", () => {
  it("applies same/neutral/different element, orb, field, and ER factors", () => {
    expect(
      calculateParticleEnergy({
        particleElement: "pyro",
        particleKind: "particle",
        particleCount: 2,
        receiverElement: "pyro",
        isOnField: true,
        partySize: 4,
        energyRecharge: 1.5
      })
    ).toEqual({
      baseEnergyPerParticle: 3,
      kindMultiplier: 1,
      fieldMultiplier: 1,
      isSameElement: true,
      rawEnergy: 6,
      energyRecharge: 1.5,
      finalEnergy: 9
    });

    expect(
      calculateParticleEnergy({
        particleElement: "pyro",
        particleKind: "particle",
        particleCount: 2,
        receiverElement: "cryo",
        isOnField: false,
        partySize: 4,
        energyRecharge: 1
      })
    ).toMatchObject({
      baseEnergyPerParticle: 1,
      fieldMultiplier: 0.6,
      rawEnergy: 1.2,
      finalEnergy: 1.2
    });

    expect(
      calculateParticleEnergy({
        particleElement: "neutral",
        particleKind: "orb",
        particleCount: 1,
        receiverElement: "hydro",
        isOnField: true,
        partySize: 4,
        energyRecharge: 1
      })
    ).toMatchObject({
      baseEnergyPerParticle: 2,
      kindMultiplier: 3,
      rawEnergy: 6,
      finalEnergy: 6
    });
  });

  it("rolls discrete particle ranges reproducibly from the configured seed", () => {
    const first = new SeededRandom("particle-seed");
    const second = new SeededRandom("particle-seed");
    const range = { min: 2, max: 4, step: 0.5 };
    const firstRolls = Array.from({ length: 6 }, () =>
      resolveParticleCount(range, first)
    );
    const secondRolls = Array.from({ length: 6 }, () =>
      resolveParticleCount(range, second)
    );

    expect(firstRolls).toEqual(secondRolls);
    expect(firstRolls).toEqual([2, 2, 3, 3.5, 3.5, 4]);
  });
});

function legalEnergyConfig(
  abilities: AbilityDefinition[],
  commands: LegalTimelineCommand[],
  overrides: Partial<SimConfig> = {}
): SimConfig {
  const base = makeConfig();
  return makeConfig({
    duration: 3,
    cycleLength: 3,
    characters: [
      {
        ...base.characters[0]!,
        id: "a",
        name: "A",
        element: "pyro",
        initialEnergy: 0,
        stats: {
          ...base.characters[0]!.stats,
          energyRecharge: 1.5
        }
      },
      {
        ...base.characters[0]!,
        id: "b",
        name: "B",
        element: "cryo",
        initialEnergy: 0,
        stats: {
          ...base.characters[0]!.stats,
          energyRecharge: 2
        }
      }
    ],
    rotation: [],
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "a",
      swapFrames: 12,
      abilities,
      commands
    },
    ...overrides
  });
}

describe("particle event simulation", () => {
  it("spawns on confirmed hits, blocks inside particle ICD, and allows the boundary", () => {
    const hitTriggeredSkill: AbilityDefinition = {
      id: "hit-triggered-particles",
      actorId: "a",
      name: "命中确认产球",
      kind: "skill",
      cancelFrame: 0,
      animationEndFrame: 18,
      cooldownFrames: 0,
      hits: [
        {
          id: "particle-hit-1",
          frame: 0,
          scaling: 1,
          element: "pyro"
        },
        {
          id: "particle-hit-2",
          frame: 17,
          scaling: 1,
          element: "pyro"
        },
        {
          id: "particle-hit-3",
          frame: 18,
          scaling: 1,
          element: "pyro"
        }
      ],
      particles: [
        {
          id: "hit-particle",
          source: "confirmed-hit",
          element: "pyro",
          count: 1,
          travelFrames: 0,
          trigger: {
            kind: "hit-confirm",
            hitIds: [
              "particle-hit-1",
              "particle-hit-2",
              "particle-hit-3"
            ],
            internalCooldown: {
              key: "particle-icd",
              durationFrames: 18
            }
          }
        }
      ]
    };
    const result = simulate(
      legalEnergyConfig(
        [hitTriggeredSkill],
        [
          {
            type: "skill",
            actorId: "a",
            abilityId: "hit-triggered-particles"
          }
        ]
      ),
      { energyMode: "zero" }
    );

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
        hitId: "particle-hit-1",
        triggered: true,
        blockedReason: null,
        internalCooldownReadyFrame: 18
      },
      {
        frame: 17,
        hitId: "particle-hit-2",
        triggered: false,
        blockedReason: "INTERNAL_COOLDOWN",
        internalCooldownReadyFrame: 18
      },
      {
        frame: 18,
        hitId: "particle-hit-3",
        triggered: true,
        blockedReason: null,
        internalCooldownReadyFrame: 36
      }
    ]);
    expect(
      result.particleEvents.map(
        ({ spawnFrame, triggerLogId, triggerHitId }) => ({
          spawnFrame,
          triggerLogId,
          triggerHitId
        })
      )
    ).toEqual([
      {
        spawnFrame: 0,
        triggerLogId: 0,
        triggerHitId: "particle-hit-1"
      },
      {
        spawnFrame: 18,
        triggerLogId: 2,
        triggerHitId: "particle-hit-3"
      }
    ]);
  });

  it("scopes a shared particle ICD key to the source actor", () => {
    const makeTriggeredSkill = (
      actorId: "a" | "b"
    ): AbilityDefinition => ({
      id: `${actorId}-particle-skill`,
      actorId,
      name: `${actorId} 命中产球`,
      kind: "skill",
      cancelFrame: 0,
      animationEndFrame: 0,
      cooldownFrames: 0,
      hits: [
        {
          id: `${actorId}-particle-hit`,
          frame: 0,
          scaling: 1,
          element: actorId === "a" ? "pyro" : "cryo"
        }
      ],
      particles: [
        {
          id: `${actorId}-particle`,
          element: actorId === "a" ? "pyro" : "cryo",
          count: 1,
          travelFrames: 0,
          trigger: {
            kind: "hit-confirm",
            hitIds: [`${actorId}-particle-hit`],
            internalCooldown: {
              key: "shared-particle-icd",
              durationFrames: 18
            }
          }
        }
      ]
    });
    const result = simulate(
      legalEnergyConfig(
        [makeTriggeredSkill("a"), makeTriggeredSkill("b")],
        [
          { type: "skill", actorId: "a", abilityId: "a-particle-skill" },
          { type: "swap", characterId: "b" },
          { type: "skill", actorId: "b", abilityId: "b-particle-skill" }
        ]
      ),
      { energyMode: "zero" }
    );

    expect(
      result.particleTriggerLog.map(
        ({ frame, sourceActorId, triggered, internalCooldownReadyFrame }) => ({
          frame,
          sourceActorId,
          triggered,
          internalCooldownReadyFrame
        })
      )
    ).toEqual([
      {
        frame: 0,
        sourceActorId: "a",
        triggered: true,
        internalCooldownReadyFrame: 18
      },
      {
        frame: 12,
        sourceActorId: "b",
        triggered: true,
        internalCooldownReadyFrame: 30
      }
    ]);
  });

  it("uses the active character at receive time and logs every receiver", () => {
    const particleSkill: AbilityDefinition = {
      id: "particle-skill",
      actorId: "a",
      name: "产球技能",
      kind: "skill",
      cancelFrame: 20,
      animationEndFrame: 30,
      cooldownFrames: 120,
      particles: [
        {
          id: "pyro-particles",
          source: "particle-skill",
          element: "pyro",
          count: 2,
          spawnFrame: 10,
          travelFrames: 30
        }
      ]
    };
    const result = simulate(
      legalEnergyConfig(
        [particleSkill],
        [
          { type: "skill", actorId: "a", abilityId: "particle-skill" },
          { type: "swap", characterId: "b" }
        ]
      ),
      { energyMode: "zero" }
    );

    expect(result.particleEvents).toEqual([
      expect.objectContaining({
        particleId: "pyro-particles",
        spawnFrame: 10,
        receiveFrame: 40,
        particleElement: "pyro",
        particleCount: 2,
        receivedWithinSimulation: true
      })
    ]);
    expect(result.energyLog).toHaveLength(2);
    expect(result.energyLog[0]).toMatchObject({
      receiverId: "a",
      activeCharacterId: "b",
      isOnField: false,
      isSameElement: true,
      fieldMultiplier: 0.8,
      energyRecharge: 1.5,
      rawEnergy: 4.8,
      finalEnergy: 7.2,
      gainedEnergy: 7.2,
      energyAfter: 7.2
    });
    expect(result.energyLog[1]).toMatchObject({
      receiverId: "b",
      activeCharacterId: "b",
      isOnField: true,
      isSameElement: false,
      fieldMultiplier: 1,
      energyRecharge: 2,
      rawEnergy: 2,
      finalEnergy: 4,
      gainedEnergy: 4,
      energyAfter: 4
    });
    expect(result.energyStats.a).toMatchObject({
      particleGained: 7.2,
      fixedGained: 0,
      final: 7.2
    });
    expect(result.energyStats.b).toMatchObject({
      particleGained: 4,
      final: 4
    });
  });

  it("records energy cap overflow instead of silently discarding it", () => {
    const base = makeConfig();
    const config = makeConfig({
      duration: 1,
      cycleLength: 1,
      characters: [
        {
          ...base.characters[0]!,
          initialEnergy: 59
        }
      ],
      rotation: [
        {
          id: "orb",
          actorId: "a",
          name: "无元素晶球",
          at: 0,
          once: true,
          particles: [
            {
              element: "neutral",
              kind: "orb",
              count: 1,
              travelTime: 0
            }
          ]
        }
      ]
    });
    const result = simulate(config);

    expect(result.energyLog[0]).toMatchObject({
      rawEnergy: 6,
      finalEnergy: 6,
      gainedEnergy: 1,
      wastedEnergy: 5,
      energyAfter: 60
    });
    expect(result.energyStats.a).toMatchObject({
      gained: 1,
      particleGained: 1,
      wasted: 5,
      final: 60
    });
  });

  it("keeps fixed energy separate from particle energy", () => {
    const config = makeConfig({
      duration: 1,
      cycleLength: 1,
      rotation: [
        {
          id: "fixed",
          actorId: "a",
          name: "固定回能",
          at: 0,
          once: true,
          energyGains: [
            {
              target: "a",
              amount: 5,
              source: "passive-flat-energy"
            }
          ]
        }
      ]
    });
    const result = simulate(config);

    expect(result.energyLog).toEqual([
      expect.objectContaining({
        kind: "fixed",
        source: "passive-flat-energy",
        receiverId: "a",
        rawEnergy: 5,
        finalEnergy: 5,
        gainedEnergy: 5
      })
    ]);
    expect(result.energyStats.a).toMatchObject({
      gained: 5,
      fixedGained: 5,
      particleGained: 0
    });
  });

  it("blocks fixed energy inside an actor-scoped cooldown and allows the boundary frame", () => {
    const fixedEnergySkill: AbilityDefinition = {
      id: "fixed-energy-icd",
      actorId: "a",
      name: "固定回能 ICD",
      kind: "skill",
      cancelFrame: 0,
      animationEndFrame: 0,
      cooldownFrames: 0,
      energyGains: [
        {
          target: "a",
          amount: 10,
          frame: 0,
          source: "fixed-energy-icd",
          internalCooldown: {
            key: "shared-energy-icd",
            durationFrames: 360
          }
        }
      ]
    };
    const result = simulate(
      legalEnergyConfig(
        [fixedEnergySkill],
        [
          {
            type: "skill",
            actorId: "a",
            abilityId: "fixed-energy-icd",
            atFrame: 0
          },
          {
            type: "skill",
            actorId: "a",
            abilityId: "fixed-energy-icd",
            atFrame: 359
          },
          {
            type: "skill",
            actorId: "a",
            abilityId: "fixed-energy-icd",
            atFrame: 360
          }
        ],
        {
          duration: 7,
          cycleLength: 7,
          characters: [
            {
              ...makeConfig().characters[0]!,
              initialEnergy: 0
            }
          ]
        }
      ),
      { energyMode: "zero" }
    );

    expect(
      result.energyLog.map(
        ({
          frame,
          applied,
          blockedReason,
          gainedEnergy,
          energyAfter,
          internalCooldownKey,
          internalCooldownReadyFrame
        }) => ({
          frame,
          applied,
          blockedReason,
          gainedEnergy,
          energyAfter,
          internalCooldownKey,
          internalCooldownReadyFrame
        })
      )
    ).toEqual([
      {
        frame: 0,
        applied: true,
        blockedReason: null,
        gainedEnergy: 10,
        energyAfter: 10,
        internalCooldownKey: "shared-energy-icd",
        internalCooldownReadyFrame: 360
      },
      {
        frame: 359,
        applied: false,
        blockedReason: "INTERNAL_COOLDOWN",
        gainedEnergy: 0,
        energyAfter: 10,
        internalCooldownKey: "shared-energy-icd",
        internalCooldownReadyFrame: 360
      },
      {
        frame: 360,
        applied: true,
        blockedReason: null,
        gainedEnergy: 10,
        energyAfter: 20,
        internalCooldownKey: "shared-energy-icd",
        internalCooldownReadyFrame: 720
      }
    ]);
    expect(result.energyStats.a).toMatchObject({
      fixedGained: 20,
      final: 20
    });
    expect(result.energyCurve.map((point) => point.kind)).toEqual([
      "initial",
      "fixed",
      "fixed-blocked",
      "fixed"
    ]);
  });

  it("keeps identical fixed-energy cooldown keys isolated by source actor", () => {
    const config = makeConfig({
      duration: 1,
      cycleLength: 1,
      characters: [
        {
          ...makeConfig().characters[0]!,
          id: "a",
          initialEnergy: 0
        },
        {
          ...makeConfig().characters[0]!,
          id: "b",
          initialEnergy: 0
        }
      ],
      rotation: ["a", "b"].map((actorId) => ({
        id: `${actorId}-fixed-energy`,
        actorId,
        name: `${actorId} 固定回能`,
        at: 0,
        once: true,
        energyGains: [
          {
            target: actorId,
            amount: 5,
            source: "actor-scoped-energy",
            internalCooldown: {
              key: "same-key",
              duration: 6
            }
          }
        ]
      }))
    });
    const result = simulate(config, { energyMode: "zero" });

    expect(result.energyLog.map((entry) => entry.applied)).toEqual([
      true,
      true
    ]);
    expect(result.energyStats.a?.fixedGained).toBe(5);
    expect(result.energyStats.b?.fixedGained).toBe(5);
  });

  it("uses received particles for a later burst and exposes the full energy curve", () => {
    const skill: AbilityDefinition = {
      id: "battery",
      actorId: "a",
      name: "充能技能",
      kind: "skill",
      cancelFrame: 20,
      animationEndFrame: 30,
      cooldownFrames: 0,
      particles: [
        {
          element: "pyro",
          count: 2,
          spawnFrame: 0,
          travelFrames: 10
        }
      ]
    };
    const burst: AbilityDefinition = {
      id: "burst",
      actorId: "a",
      name: "元素爆发",
      kind: "burst",
      cancelFrame: 1,
      animationEndFrame: 1,
      cooldownFrames: 0,
      energyCost: 9
    };
    const config = legalEnergyConfig(
      [skill, burst],
      [
        { type: "skill", actorId: "a", abilityId: "battery" },
        { type: "burst", actorId: "a", abilityId: "burst" }
      ],
      {
        characters: [
          {
            ...makeConfig().characters[0]!,
            initialEnergy: 0,
            stats: {
              ...makeConfig().characters[0]!.stats,
              energyRecharge: 1.5
            }
          }
        ]
      }
    );
    const result = simulate(config, { energyMode: "zero" });

    expect(result.skippedActions).toHaveLength(0);
    expect(result.actionLog.find((action) => action.sourceAbilityId === "burst"))
      .toMatchObject({
        frame: 20,
        energyBefore: 9,
        energyAfter: 0
      });
    expect(result.energyCurve.map((point) => point.kind)).toEqual([
      "initial",
      "particle",
      "spend"
    ]);
    expect(result.energyCurve.at(-1)?.energyByCharacter.a).toBe(0);
  });

  it("checks an action before a particle received on the same frame", () => {
    const skill: AbilityDefinition = {
      id: "same-frame-particle",
      actorId: "a",
      name: "同帧粒子",
      kind: "skill",
      cancelFrame: 20,
      animationEndFrame: 20,
      cooldownFrames: 0,
      particles: [
        {
          element: "pyro",
          count: 2,
          spawnFrame: 0,
          travelFrames: 20
        }
      ]
    };
    const burst: AbilityDefinition = {
      id: "same-frame-burst",
      actorId: "a",
      name: "同帧爆发",
      kind: "burst",
      cancelFrame: 1,
      animationEndFrame: 1,
      cooldownFrames: 0,
      energyCost: 9
    };
    const result = simulate(
      legalEnergyConfig(
        [skill, burst],
        [
          {
            type: "skill",
            actorId: "a",
            abilityId: "same-frame-particle"
          },
          {
            type: "burst",
            actorId: "a",
            abilityId: "same-frame-burst"
          }
        ],
        {
          characters: [
            {
              ...makeConfig().characters[0]!,
              initialEnergy: 0,
              stats: {
                ...makeConfig().characters[0]!.stats,
                energyRecharge: 1.5
              }
            }
          ]
        }
      ),
      { energyMode: "zero" }
    );

    expect(result.skippedActions).toEqual([
      expect.objectContaining({
        frame: 20,
        actionId: "same-frame-burst#1",
        reasonCode: "INSUFFICIENT_ENERGY"
      })
    ]);
    expect(result.energyLog[0]).toMatchObject({
      frame: 20,
      finalEnergy: 9,
      energyAfter: 9
    });
  });

  it("applies a same-frame Energy Recharge buff before particle receipt", () => {
    const particleSkill: AbilityDefinition = {
      id: "buffed-particle",
      actorId: "a",
      name: "待接收粒子",
      kind: "skill",
      cancelFrame: 20,
      animationEndFrame: 20,
      cooldownFrames: 0,
      particles: [
        {
          element: "pyro",
          count: 1,
          spawnFrame: 0,
          travelFrames: 20
        }
      ]
    };
    const rechargeBuff: AbilityDefinition = {
      id: "same-frame-er",
      actorId: "a",
      name: "同帧充能增益",
      kind: "skill",
      cancelFrame: 1,
      animationEndFrame: 1,
      cooldownFrames: 0,
      buffs: [
        {
          stat: "energyRecharge",
          value: 1,
          durationFrames: 60
        }
      ]
    };
    const result = simulate(
      legalEnergyConfig(
        [particleSkill, rechargeBuff],
        [
          {
            type: "skill",
            actorId: "a",
            abilityId: "buffed-particle"
          },
          {
            type: "skill",
            actorId: "a",
            abilityId: "same-frame-er"
          }
        ],
        {
          characters: [
            {
              ...makeConfig().characters[0]!,
              initialEnergy: 0,
              stats: {
                ...makeConfig().characters[0]!.stats,
                energyRecharge: 1
              }
            }
          ]
        }
      ),
      { energyMode: "zero" }
    );

    expect(result.energyLog[0]).toMatchObject({
      frame: 20,
      rawEnergy: 3,
      energyRecharge: 2,
      finalEnergy: 6
    });
  });

  it("records particles whose arrival falls outside the simulation window", () => {
    const config = makeConfig({
      duration: 1,
      cycleLength: 1,
      rotation: [
        {
          id: "late",
          actorId: "a",
          name: "过晚粒子",
          at: 0,
          once: true,
          particles: [
            {
              element: "pyro",
              count: 3,
              travelTime: 2
            }
          ]
        }
      ]
    });
    const result = simulate(config);

    expect(result.particleEvents[0]).toMatchObject({
      spawnFrame: 0,
      receiveFrame: 120,
      receivedWithinSimulation: false
    });
    expect(result.energyLog).toEqual([]);
    expect(result.energyStats.a?.final).toBe(0);
  });

  it("does not spawn particles from an action rejected for insufficient energy", () => {
    const config = makeConfig({
      duration: 1,
      cycleLength: 1,
      rotation: [
        {
          id: "rejected",
          actorId: "a",
          name: "失败行动",
          at: 0,
          once: true,
          energyCost: 1,
          particles: [
            {
              element: "pyro",
              count: 3,
              travelTime: 0
            }
          ]
        }
      ]
    });
    const result = simulate(config, { energyMode: "zero" });

    expect(result.skippedActions).toHaveLength(1);
    expect(result.particleEvents).toEqual([]);
    expect(result.energyLog).toEqual([]);
  });
});
