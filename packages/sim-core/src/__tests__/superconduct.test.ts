import {
  simulationResultV142Schema,
  targetClockResultReferencesSchema,
  targetStateTimelineSchema,
  type SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { calcTransformativeReactionDamage } from "../formulas";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function makeSuperconductConfig(): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    duration: 13,
    cycleLength: 13,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "触发目标",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "cryo", gaugeUnits: 1 }]
        },
        {
          id: "enemy-1",
          name: "范围内目标",
          position: { x: 3, y: 0 }
        },
        {
          id: "enemy-2",
          name: "范围外目标",
          position: { x: 3.1, y: 0 }
        }
      ],
      targetPhases: [
        {
          id: "enemy-1-superconduct-damage-immune",
          label: "超导数值伤害免疫窗",
          targetId: "enemy-1",
          startFrame: 1,
          endFrame: 2,
          reason: "SUPERCONDUCT_DAMAGE_IMMUNE_WINDOW",
          effects: {
            damage: "immune",
            aura: "normal",
            hitConfirm: "normal"
          }
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
          baseAtk: 1000,
          em: 100,
          reactionBonus: 0.2
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
      initialActiveCharacterId: "electro",
      swapFrames: 12,
      abilities: [
        {
          id: "superconduct-sequence",
          actorId: "electro",
          name: "超导与物理边界",
          kind: "skill",
          cancelFrame: 721,
          animationEndFrame: 721,
          cooldownFrames: 0,
          hits: [
            {
              id: "superconduct-trigger",
              label: "雷元素触发",
              frame: 0,
              scaling: 1,
              element: "electro",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed"
              },
              application: {
                gaugeUnits: 1,
                icdTag: "superconduct",
                icdGroup: "no-icd"
              }
            },
            ...[1, 2, 720, 721].map((frame) => ({
              id: `physical-${frame}`,
              label: `物理 ${frame}f`,
              frame,
              scaling: 1,
              element: "physical" as const,
              targeting: {
                targetId: "enemy-0",
                outcome: "landed" as const
              }
            }))
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

function makeOrderedCryoPipelineConfig(): SimConfig {
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
          name: "Cryo ordered target",
          position: { x: 0, y: 0 },
          initialAura: [
            { element: "hydro", gaugeUnits: 1 }
          ]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "cryo",
        name: "Cryo",
        element: "cryo",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1000,
          em: 100,
          reactionBonus: 0.2
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v5" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "cryo",
      swapFrames: 12,
      abilities: [
        {
          id: "ordered-cryo-pipeline",
          actorId: "cryo",
          name: "Ordered Cryo pipeline",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "ec-setup",
              label: "Electro setup",
              frame: 0,
              scaling: 0,
              element: "electro",
              geometry: {
                kind: "circle",
                coordinateSpace: "world",
                origin: { x: 0, y: 0 },
                radius: 1
              },
              application: {
                gaugeUnits: 1,
                icdTag: "ordered-cryo-ec",
                icdGroup: "no-icd"
              }
            },
            {
              id: "ordered-cryo-hit",
              label: "Strong Cryo",
              frame: 0,
              scaling: 1,
              element: "cryo",
              application: {
                gaugeUnits: 2,
                icdTag: "ordered-cryo-hit",
                icdGroup: "no-icd"
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "cryo",
          abilityId: "ordered-cryo-pipeline"
        }
      ]
    }
  };
}

function makeSameFrameSuperconductRefreshConfig(): SimConfig {
  const base = makeConfig();
  const sourceTargets = [
    {
      id: "source-left",
      name: "左侧超导源",
      position: { x: 0, y: 0 },
      initialAura: [
        { element: "cryo" as const, gaugeUnits: 1 }
      ]
    },
    {
      id: "source-right",
      name: "右侧超导源",
      position: { x: 4, y: 0 },
      initialAura: [
        { element: "cryo" as const, gaugeUnits: 1 }
      ]
    }
  ];

  return {
    ...base,
    duration: 1,
    cycleLength: 1,
    targetClockModel: {
      mode: "target-local-hitlag-v1"
    },
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        ...sourceTargets,
        {
          id: "enemy-0",
          name: "共同受击目标",
          position: { x: 2, y: 0 }
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
          baseAtk: 1000
        }
      }
    ],
    rotation: [],
    reactionEngine: {
      mode: "aura-v5"
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "electro",
      swapFrames: 12,
      abilities: [
        {
          id: "same-frame-superconducts",
          actorId: "electro",
          name: "同帧双超导",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: sourceTargets.map((target, index) => ({
            id: `superconduct-trigger-${index}`,
            label: `超导触发 ${index}`,
            frame: 0,
            scaling: 1,
            element: "electro" as const,
            geometry: {
              kind: "circle" as const,
              coordinateSpace: "world" as const,
              origin: target.position,
              radius: 0.1
            },
            application: {
              gaugeUnits: 1,
              icdTag: `same-frame-superconduct-${index}`,
              icdGroup: "no-icd" as const
            }
          }))
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "electro",
          abilityId: "same-frame-superconducts"
        }
      ]
    }
  };
}

describe("Superconduct simulation integration", () => {
  it("projects aura-v5 Superconduct → Freeze, stops EC, and stays deterministic", () => {
    const config = makeOrderedCryoPipelineConfig();
    const first = simulate(config, { critMode: "noCrit" });
    const second = simulate(config, { critMode: "noCrit" });
    const directHits = first.damageEvents.filter(
      (event) => event.kind === "direct"
    );
    const superconductDamage = first.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "superconduct"
    );

    expect(directHits).toHaveLength(2);
    expect(directHits[0]).toMatchObject({
      frame: 0,
      reaction: "electroCharged",
      reactionAudit: {
        periodicReaction: {
          operation: "start",
          generation: 1
        }
      }
    });
    expect(directHits[1]).toMatchObject({
      frame: 0,
      reaction: "superconduct",
      reactionAudit: {
        reactions: ["superconduct", "freeze"],
        unsupportedReactions: [],
        mechanicsTruncation: null,
        auraConsumed: [
          { element: "electro", gaugeUnits: 0.8 },
          { element: "hydro", gaugeUnits: 0.8 }
        ],
        auraAfter: [
          { element: "frozen", gaugeUnits: 1.6 }
        ],
        transformativeReaction: {
          reaction: "superconduct",
          scheduled: true,
          damageFrame: 1
        },
        frozenReaction: {
          operation: "start",
          generatedGaugeUnits: 1.6
        },
        periodicReaction: {
          operation: "stop",
          generation: 1
        }
      }
    });
    expect(superconductDamage).toHaveLength(1);
    expect(superconductDamage[0]).toMatchObject({
      frame: 1,
      targetId: "enemy-0",
      element: "cryo",
      reaction: "superconduct",
      parentDamageEventId: directHits[1]?.id
    });
    expect(
      first.periodicReactionLog.map((entry) => [
        entry.operation,
        entry.frame,
        entry.reason
      ])
    ).toEqual([
      ["start", 0, null],
      ["stop", 0, "COEXISTING_AURA_REMOVED_BY_HIT"],
      ["tick", 10, "QUEUED_FIRST_TICK_AFTER_STREAM_STOP"]
    ]);
    expect(
      first.frozenStateLog.map((entry) => [
        entry.operation,
        entry.frame,
        entry.generatedGaugeUnits
      ])
    ).toEqual([["start", 0, 1.6]]);
    expect(
      first.reactionDamageLog.map((entry) => [
        entry.reaction,
        entry.damageFrame,
        entry.sourceTargetId
      ])
    ).toEqual([
      ["superconduct", 1, "enemy-0"],
      ["electroCharged", 10, "enemy-0"]
    ]);
    expect(first.targetMechanicsTruncationLog).toEqual([]);
    expect(first.mechanicsStatus).toBe("complete");
    expect(
      targetStateTimelineSchema.parse(
        first.targetStateTimeline
      )
    ).toEqual(first.targetStateTimeline);
    expect(second).toEqual(first);
  });

  it("creates Cryo reaction damage and target-scoped physical resistance statuses", () => {
    const result = simulate(makeSuperconductConfig(), {
      critMode: "noCrit"
    });
    const trigger = result.damageEvents[0]!;
    const reactionEvents = result.damageEvents.filter(
      (event) => event.reactionAudit.model === "reaction-damage"
    );
    const expected = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: 100,
      reactionBonus: 0.2,
      baseMultiplier: 1.5,
      effectiveResistance: 0.1
    });

    expect(trigger).toMatchObject({
      frame: 0,
      reaction: "superconduct",
      reactionAudit: {
        transformativeReaction: {
          reaction: "superconduct",
          damageElement: "cryo",
          damageFrame: 1,
          baseMultiplier: 1.5,
          statusEffect: {
            key: "superconduct-phys-shred",
            resShred: 0.4,
            durationFrames: 720
          }
        }
      }
    });
    expect(reactionEvents).toHaveLength(2);
    expect(reactionEvents[0]).toMatchObject({
      frame: 1,
      targetId: "enemy-0",
      element: "cryo",
      reaction: "superconduct",
      parentDamageEventId: trigger.id,
      transformativeReactionFactors: {
        reaction: "superconduct",
        baseMultiplier: 1.5
      }
    });
    expect(reactionEvents[0]?.finalDamage).toBeCloseTo(
      expected.finalDamage,
      10
    );
    expect(reactionEvents[1]).toMatchObject({
      targetId: "enemy-1",
      targetDamagePolicy: "immune",
      finalDamage: 0
    });
    expect(result.reactionDamageLog).toMatchObject([
      {
        reaction: "superconduct",
        hitTargetIds: ["enemy-0", "enemy-1"],
        checkedTargetIds: ["enemy-0", "enemy-1", "enemy-2"],
        damageEventIds: reactionEvents.map((event) => event.id),
        reactionStatusLogIds: [0, 1]
      }
    ]);
    expect(result.reactionStatusLog).toEqual([
      expect.objectContaining({
        id: 0,
        reactionDamageEventId: reactionEvents[0]!.id,
        targetId: "enemy-0",
        element: "physical",
        resShred: 0.4,
        startFrame: 1,
        endFrame: 721,
        operation: "apply",
        supersededAtFrame: null
      }),
      expect.objectContaining({
        id: 1,
        reactionDamageEventId: reactionEvents[1]!.id,
        targetId: "enemy-1",
        startFrame: 1,
        endFrame: 721
      })
    ]);
  });

  it("applies the status after same-frame direct hits and expires at the half-open boundary", () => {
    const result = simulate(makeSuperconductConfig(), {
      critMode: "noCrit"
    });
    const physical = new Map(
      result.damageEvents
        .filter((event) => event.element === "physical")
        .map((event) => [event.frame, event])
    );

    expect(physical.get(1)).toMatchObject({
      effectiveRes: 0.1,
      resFactor: 0.9,
      buffs: [],
      debuffs: []
    });
    for (const frame of [2, 720]) {
      expect(physical.get(frame)).toMatchObject({
        resFactor: 1.15,
        debuffs: ["超导物理抗性降低"]
      });
      expect(physical.get(frame)?.effectiveRes).toBeCloseTo(
        -0.3,
        15
      );
      expect(
        physical
          .get(frame)
          ?.activeStatuses.some(
            (status) =>
              status.label === "超导物理抗性降低" &&
              status.targetId === "enemy-0"
          )
      ).toBe(true);
    }
    expect(physical.get(721)).toMatchObject({
      effectiveRes: 0.1,
      resFactor: 0.9,
      debuffs: []
    });
    expect(physical.get(2)?.finalDamage).toBeCloseTo(575, 10);
    expect(physical.get(721)?.finalDamage).toBeCloseTo(450, 10);
  });

  it("refreshes a target status and closes the superseded interval", () => {
    const config = makeSuperconductConfig();
    config.enemy.targets![0]!.initialAura = [
      { element: "cryo", gaugeUnits: 2 }
    ];
    config.timeline!.abilities[0]!.hits!.push({
      id: "superconduct-refresh",
      label: "超导刷新",
      frame: 6,
      scaling: 1,
      element: "electro",
      targeting: {
        targetId: "enemy-0",
        outcome: "landed"
      },
      application: {
        gaugeUnits: 1,
        icdTag: "superconduct",
        icdGroup: "no-icd"
      }
    });

    const result = simulate(config, { critMode: "noCrit" });
    const targetStatuses = result.reactionStatusLog.filter(
      (entry) => entry.targetId === "enemy-0"
    );

    expect(targetStatuses).toMatchObject([
      {
        startFrame: 1,
        endFrame: 7,
        operation: "apply",
        supersededAtFrame: 7
      },
      {
        startFrame: 7,
        endFrame: 727,
        operation: "refresh",
        supersededAtFrame: null
      }
    ]);
  });

  it("records a same-frame refresh as an instantaneous superseded status accepted by result schemas", () => {
    const result = simulate(
      makeSameFrameSuperconductRefreshConfig(),
      { critMode: "noCrit" }
    );
    const sharedStatuses = result.reactionStatusLog.filter(
      (entry) => entry.targetId === "enemy-0"
    );

    expect(sharedStatuses).toHaveLength(2);
    expect(sharedStatuses).toMatchObject([
      {
        startFrame: 1,
        endFrame: 1,
        operation: "apply",
        supersededAtFrame: 1
      },
      {
        startFrame: 1,
        endFrame: 721,
        operation: "refresh",
        supersededAtFrame: null
      }
    ]);
    expect(
      sharedStatuses.map(
        (entry) => entry.reactionDamageEventId
      )
    ).toEqual(
      result.reactionDamageLog.map((entry) => {
        const sharedDamageEventId = entry.damageEventIds.find(
          (eventId) =>
            result.damageEvents[eventId]?.targetId ===
            "enemy-0"
        );
        expect(sharedDamageEventId).toBeDefined();
        return sharedDamageEventId;
      })
    );

    expect(
      simulationResultV142Schema.safeParse(result).success
    ).toBe(true);
    expect(
      targetClockResultReferencesSchema.safeParse(result).success
    ).toBe(true);
  });

  it("applies ReactionA to only the first two of three overlapping explosions", () => {
    const base = makeConfig();
    const sourceTargets = ["enemy-0", "source-1", "source-2"];
    const config: SimConfig = {
      ...base,
      duration: 1,
      cycleLength: 1,
      enemy: {
        level: 90,
        resistance: 0.1,
        defReduction: 0,
        targets: [
          ...sourceTargets.map((id, index) => ({
            id,
            name: id,
            position: { x: 0, y: index - 1 },
            initialAura: [
              { element: "cryo" as const, gaugeUnits: 1 }
            ]
          })),
          {
            id: "shared-target",
            name: "共同爆炸目标",
            position: { x: 1, y: 0 }
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
            baseAtk: 1000,
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
            id: "overlapping-superconducts",
            actorId: "electro",
            name: "重叠超导",
            kind: "skill",
            cancelFrame: 13,
            animationEndFrame: 13,
            cooldownFrames: 0,
            hits: sourceTargets.map((targetId, index) => ({
              id: `superconduct-${index}`,
              label: `超导 ${index}`,
              frame: index * 6,
              scaling: 1,
              element: "electro" as const,
              targeting: {
                targetId,
                outcome: "landed" as const
              },
              application: {
                gaugeUnits: 1,
                icdTag: "overlap",
                icdGroup: "no-icd" as const
              }
            }))
          }
        ],
        commands: [
          {
            type: "skill",
            actorId: "electro",
            abilityId: "overlapping-superconducts"
          }
        ]
      }
    };

    const result = simulate(config, { critMode: "noCrit" });
    const sharedExplosions = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "superconduct" &&
        event.targetId === "shared-target"
    );
    const sharedDecisions = result.reactionDamageLog.flatMap(
      (entry) =>
        entry.damageGroupDecisions.filter(
          (decision) =>
            decision.reaction === "superconduct" &&
            decision.targetId === "shared-target"
        )
    );

    expect(sharedExplosions).toHaveLength(3);
    expect(
      sharedExplosions.map((event) => ({
        frame: event.frame,
        finalDamage: event.finalDamage,
        groupMultiplier: event.damageFactors.groupMultiplier
      }))
    ).toMatchObject([
      {
        frame: 1,
        finalDamage: expect.any(Number),
        groupMultiplier: 1
      },
      {
        frame: 7,
        finalDamage: expect.any(Number),
        groupMultiplier: 1
      },
      {
        frame: 13,
        finalDamage: 0,
        groupMultiplier: 0
      }
    ]);
    expect(sharedExplosions[0]?.finalDamage).toBeGreaterThan(0);
    expect(sharedExplosions[1]?.finalDamage).toBeGreaterThan(0);
    expect(sharedDecisions).toEqual([
      {
        reaction: "superconduct",
        sourceActorId: "electro",
        targetId: "shared-target",
        windowStartFrame: 1,
        hitIndex: 0,
        resetFrames: 30,
        sequence: [true, true, false],
        damageAllowed: true,
        blockedReason: null
      },
      {
        reaction: "superconduct",
        sourceActorId: "electro",
        targetId: "shared-target",
        windowStartFrame: 1,
        hitIndex: 1,
        resetFrames: 30,
        sequence: [true, true, false],
        damageAllowed: true,
        blockedReason: null
      },
      {
        reaction: "superconduct",
        sourceActorId: "electro",
        targetId: "shared-target",
        windowStartFrame: 1,
        hitIndex: 2,
        resetFrames: 30,
        sequence: [true, true, false],
        damageAllowed: false,
        blockedReason: "REACTION_A_DAMAGE_ICD"
      }
    ]);
    const blockedLog = result.reactionDamageLog.find(
      (entry) => entry.damageFrame === 13
    );
    const blockedEvent = sharedExplosions[2]!;
    expect(blockedLog?.damageGroupBlockedTargetIds).toContain(
      "shared-target"
    );
    expect(blockedLog?.damageEventIds).toContain(blockedEvent.id);
    expect(blockedEvent).toMatchObject({
      snapshot: "hit",
      finalDamage: 0,
      damageComposition: {
        direct: 0,
        additiveReaction: 0,
        transformativeReaction: 0
      }
    });

    const sharedStatuses = result.reactionStatusLog.filter(
      (entry) => entry.targetId === "shared-target"
    );
    expect(sharedStatuses).toMatchObject([
      {
        reactionDamageEventId: sharedExplosions[0]!.id,
        startFrame: 1,
        operation: "apply",
        supersededAtFrame: 7
      },
      {
        reactionDamageEventId: sharedExplosions[1]!.id,
        startFrame: 7,
        operation: "refresh",
        supersededAtFrame: 13
      },
      {
        reactionDamageEventId: blockedEvent.id,
        startFrame: 13,
        operation: "refresh",
        supersededAtFrame: null
      }
    ]);
  });

  it("freezes trigger-frame live EM and reaction bonus for an action-snapshot Superconduct", () => {
    const config = makeSuperconductConfig();
    config.duration = 1;
    config.cycleLength = 1;
    config.enemy.targets = [config.enemy.targets![0]!];
    config.enemy.targetPhases = [];
    const ability = config.timeline!.abilities[0]!;
    const hit = ability.hits![0]!;
    ability.cancelFrame = 11;
    ability.animationEndFrame = 11;
    ability.buffs = [
      {
        key: "superconduct-live-em",
        label: "超导触发帧精通",
        target: "self",
        stat: "em",
        value: 200,
        startFrame: 5,
        durationFrames: 6
      },
      {
        key: "superconduct-live-reaction-bonus",
        label: "超导触发帧反应增伤",
        target: "self",
        stat: "reactionBonus",
        value: 0.3,
        startFrame: 5,
        durationFrames: 6
      }
    ];
    ability.hits = [
      {
        ...hit,
        frame: 10,
        snapshot: "action"
      }
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const direct = result.damageEvents.find(
      (event) => event.hitId === "superconduct-trigger"
    );
    const reaction = result.damageEvents.find(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.targetId === "enemy-0"
    );
    const expected = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: 300,
      reactionBonus: 0.5,
      baseMultiplier: 1.5,
      effectiveResistance: 0.1
    });

    expect(direct).toMatchObject({
      frame: 10,
      snapshot: "action",
      statsBeforeDamage: {
        em: 100,
        reactionBonus: 0.2
      }
    });
    expect(reaction).toMatchObject({
      frame: 11,
      snapshot: "hit",
      statsBeforeDamage: {
        em: 300,
        reactionBonus: 0.5
      },
      transformativeReactionFactors: {
        characterLevel: 90,
        elementalMastery: 300,
        reactionBonus: 0.5
      }
    });
    expect(reaction?.finalDamage).toBeCloseTo(
      expected.finalDamage,
      10
    );
  });
});
