import {
  targetStateTimelineSchema,
  type SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function makeShatterOrderingConfig(): SimConfig {
  const base = makeConfig();
  const template = base.characters[0]!;
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
          name: "同事件碎冰目标",
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
        stats: { ...neutralStats, baseAtk: 1000 }
      },
      {
        ...template,
        id: "pyro",
        name: "Pyro",
        element: "pyro",
        stats: { ...neutralStats, baseAtk: 1000 }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "hydro",
      swapFrames: 1,
      abilities: [
        {
          id: "freeze",
          actorId: "hydro",
          name: "Freeze",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "freeze-hit",
              frame: 0,
              scaling: 1,
              element: "hydro",
              application: {
                gaugeUnits: 1,
                icdTag: "freeze",
                icdGroup: "no-icd"
              }
            }
          ]
        },
        {
          id: "shatter",
          actorId: "pyro",
          name: "Shatter",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "shatter-hit",
              frame: 0,
              scaling: 1,
              element: "pyro",
              strikeType: "blunt",
              poiseDamage: 1,
              application: {
                gaugeUnits: 1,
                icdTag: "shatter",
                icdGroup: "no-icd"
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "hydro",
          abilityId: "freeze"
        },
        { type: "swap", characterId: "pyro" },
        {
          type: "skill",
          actorId: "pyro",
          abilityId: "shatter"
        }
      ]
    }
  };
}

function makeMultiTargetBurningConfig(): SimConfig {
  const base = makeConfig();
  const template = base.characters[0]!;
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
          name: "燃烧目标 0",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "dendro", gaugeUnits: 1 }]
        },
        {
          id: "enemy-1",
          name: "燃烧目标 1",
          position: { x: 0.5, y: 0 },
          initialAura: [{ element: "dendro", gaugeUnits: 1 }]
        }
      ]
    },
    characters: [
      {
        ...template,
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
    rotation: [],
    reactionEngine: { mode: "aura-v4" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "pyro",
      swapFrames: 1,
      abilities: [
        {
          id: "pyro-aoe",
          actorId: "pyro",
          name: "Pyro AoE",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "pyro-aoe-hit",
              frame: 0,
              scaling: 1,
              element: "pyro",
              geometry: {
                kind: "circle",
                coordinateSpace: "world",
                origin: { x: 0, y: 0 },
                radius: 2
              },
              application: {
                gaugeUnits: 1,
                icdTag: "burning-two-targets",
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
          abilityId: "pyro-aoe"
        }
      ]
    }
  };
}

describe("core-owned target state timeline", () => {
  it("preserves the real direct-hit shatter sub-order before application", () => {
    const result = simulate(makeShatterOrderingConfig(), {
      critMode: "noCrit"
    });
    const shatterDamage = result.damageEvents.find(
      (event) =>
        event.kind === "direct" && event.hitId === "shatter-hit"
    );
    expect(shatterDamage).toBeDefined();

    const points = result.targetStateTimeline.points.filter(
      (point) =>
        point.primaryDamageEventId === shatterDamage?.id
    );
    expect(
      points.map((point) => ({
        cause: point.cause,
        pointKind: point.pointKind,
        priority: point.eventPriority,
        sequence: point.eventSequence,
        intra: point.intraEventSequence,
        reaction: point.reaction
      }))
    ).toEqual([
      {
        cause: "direct-hit-shatter",
        pointKind: "mutation",
        priority: 3,
        sequence: shatterDamage?.eventSequence,
        intra: 0,
        reaction: "none"
      },
      {
        cause: "direct-hit-shatter",
        pointKind: "mutation",
        priority: 3,
        sequence: shatterDamage?.eventSequence,
        intra: 1,
        reaction: "shatter"
      },
      {
        cause: "direct-hit-application",
        pointKind: "mutation",
        priority: 3,
        sequence: shatterDamage?.eventSequence,
        intra: 2,
        reaction: "none"
      }
    ]);
    expect(
      targetStateTimelineSchema.parse(result.targetStateTimeline)
    ).toEqual(result.targetStateTimeline);
  });

  it("keeps multi-target Burning tick/application pairs atomic", () => {
    const result = simulate(makeMultiTargetBurningConfig(), {
      critMode: "noCrit"
    });
    const frameFifteen = result.targetStateTimeline.points.filter(
      (point) => point.frame === 15
    );

    expect(
      frameFifteen.map((point) => ({
        targetId: point.targetId,
        cause: point.cause,
        eventType: point.eventType,
        priority: point.eventPriority,
        intra: point.intraEventSequence
      }))
    ).toEqual([
      {
        targetId: "enemy-0",
        cause: "burning-tick",
        eventType: "burningTick",
        priority: 4,
        intra: 0
      },
      {
        targetId: "enemy-0",
        cause: "reaction-damage-application",
        eventType: "reactionDamage",
        priority: 4.2,
        intra: 0
      },
      {
        targetId: "enemy-1",
        cause: "reaction-damage-application",
        eventType: "reactionDamage",
        priority: 4.2,
        intra: 1
      },
      {
        targetId: "enemy-1",
        cause: "burning-tick",
        eventType: "burningTick",
        priority: 4.4,
        intra: 0
      },
      {
        targetId: "enemy-0",
        cause: "reaction-damage-application",
        eventType: "reactionDamage",
        priority: 4.6000000000000005,
        intra: 0
      },
      {
        targetId: "enemy-1",
        cause: "reaction-damage-application",
        eventType: "reactionDamage",
        priority: 4.6000000000000005,
        intra: 1
      }
    ]);
    expect(
      frameFifteen.map((point) => point.eventSequence)
    ).toEqual([3, 5, 5, 4, 7, 7]);
    expect(
      targetStateTimelineSchema.parse(result.targetStateTimeline)
    ).toEqual(result.targetStateTimeline);
  });

  it("emits the exact ordinary Aura natural-expiry boundary without queue events", () => {
    const base = makeConfig();
    const config: SimConfig = {
      ...base,
      duration: 10,
      cycleLength: 10,
      enemy: {
        ...base.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "自然衰减目标",
            initialAura: [{ element: "dendro", gaugeUnits: 1 }]
          }
        ]
      },
      reactionEngine: { mode: "aura-v4" },
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "a",
        swapFrames: 1,
        abilities: [],
        commands: []
      }
    };
    const result = simulate(config, { critMode: "noCrit" });
    const expiry = result.targetStateTimeline.points.find(
      (point) => point.cause === "aura-natural-expiry"
    );

    expect(expiry).toMatchObject({
      frame: 570,
      timeSeconds: 9.5,
      targetId: "enemy-0",
      pointKind: "derived",
      eventType: null,
      eventPriority: null,
      eventSequence: null,
      intraEventSequence: null,
      reaction: "none",
      reactions: [],
      primaryDamageEventId: null,
      links: []
    });
    expect(expiry?.auraBefore).toEqual([
      expect.objectContaining({
        element: "dendro",
        gaugeUnits: expect.any(Number)
      })
    ]);
    expect(expiry?.auraAfter).toEqual([]);
    expect(result.auraEndStates[0]?.aura).toEqual([]);
    expect(
      targetStateTimelineSchema.parse(result.targetStateTimeline)
    ).toEqual(result.targetStateTimeline);
  });

  it("lets a real same-frame hit observe natural expiry without a duplicate derived point", () => {
    const base = makeConfig();
    const config: SimConfig = {
      ...base,
      duration: 10,
      cycleLength: 10,
      enemy: {
        ...base.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "到期同帧目标",
            initialAura: [{ element: "dendro", gaugeUnits: 1 }]
          }
        ]
      },
      reactionEngine: { mode: "aura-v4" },
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "a",
        swapFrames: 1,
        abilities: [
          {
            id: "boundary-hit",
            actorId: "a",
            name: "Boundary Hit",
            kind: "skill",
            cancelFrame: 1,
            animationEndFrame: 1,
            cooldownFrames: 0,
            hits: [
              {
                id: "boundary-hit-damage",
                frame: 0,
                scaling: 1,
                element: "physical"
              }
            ]
          }
        ],
        commands: [
          { type: "wait", frames: 570 },
          {
            type: "skill",
            actorId: "a",
            abilityId: "boundary-hit"
          }
        ]
      }
    };
    const result = simulate(config, { critMode: "noCrit" });
    const framePoints = result.targetStateTimeline.points.filter(
      (point) => point.frame === 570
    );

    expect(
      framePoints.map((point) => ({
        cause: point.cause,
        pointKind: point.pointKind,
        eventType: point.eventType,
        auraBefore: point.auraBefore,
        auraAfter: point.auraAfter
      }))
    ).toEqual([
      {
        cause: "direct-hit-application",
        pointKind: "observation",
        eventType: "hit",
        auraBefore: [],
        auraAfter: []
      }
    ]);
    expect(
      result.targetStateTimeline.points.some(
        (point) => point.cause === "aura-natural-expiry"
      )
    ).toBe(false);
  });
});
