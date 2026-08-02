import type { SimConfig } from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { calcTransformativeReactionDamage } from "../formulas";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function makeOverloadConfig(): SimConfig {
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
          name: "触发目标",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "electro", gaugeUnits: 1 }]
        },
        {
          id: "enemy-1",
          name: "范围内免疫目标",
          position: { x: 3, y: 0 },
          resistance: 0.5
        },
        {
          id: "enemy-2",
          name: "范围外目标",
          position: { x: 3.1, y: 0 }
        },
        {
          id: "enemy-3",
          name: "未提供位置目标"
        }
      ],
      targetPhases: [
        {
          id: "enemy-1-immune",
          label: "反应伤害免疫窗",
          targetId: "enemy-1",
          startFrame: 1,
          endFrame: 2,
          reason: "OVERLOAD_IMMUNE_WINDOW",
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
        id: "pyro",
        name: "Pyro",
        element: "pyro",
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
      initialActiveCharacterId: "pyro",
      swapFrames: 12,
      abilities: [
        {
          id: "pyro-skill",
          actorId: "pyro",
          name: "Pyro Skill",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "pyro-hit",
              label: "触发命中",
              frame: 0,
              scaling: 1,
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
          abilityId: "pyro-skill"
        }
      ]
    }
  };
}

describe("Overload simulation integration", () => {
  it("queues a separate next-frame AoE event and audits every resolvable target", () => {
    const result = simulate(makeOverloadConfig(), {
      critMode: "allCrit"
    });
    const direct = result.damageEvents[0]!;
    const reactionEvents = result.damageEvents.filter(
      (event) => event.kind === "transformative-reaction"
    );
    const expected = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: 100,
      reactionBonus: 0.2,
      baseMultiplier: 2.75,
      effectiveResistance: 0.1
    });

    expect(direct).toMatchObject({
      kind: "direct",
      frame: 0,
      reaction: "overload",
      parentDamageEventId: null,
      transformativeReactionFactors: null
    });
    expect(direct.damageFactors.amplifyingReactionMultiplier).toBe(1);
    expect(direct.reactionAudit.transformativeReaction).toMatchObject({
      scheduled: true,
      damageFrame: 1,
      radius: 3,
      baseMultiplier: 2.75
    });

    expect(reactionEvents).toHaveLength(2);
    expect(reactionEvents[0]).toMatchObject({
      frame: 1,
      targetId: "enemy-0",
      targetDamagePolicy: "normal",
      parentDamageEventId: direct.id,
      element: "pyro",
      reaction: "overload",
      reactionAudit: { model: "reaction-damage" },
      damageFactors: {
        defenseMultiplier: 1,
        critMultiplier: 1
      },
      transformativeReactionFactors: {
        levelBaseDamage: 1446.8535,
        baseMultiplier: 2.75,
        elementalMastery: 100
      }
    });
    expect(reactionEvents[0]?.finalDamage).toBeCloseTo(
      expected.finalDamage,
      10
    );
    expect(reactionEvents[1]).toMatchObject({
      frame: 1,
      targetId: "enemy-1",
      targetDamagePolicy: "immune",
      potentialDamage: expect.any(Number),
      finalDamage: 0,
      displayDamage: 0
    });

    expect(result.reactionDamageLog).toEqual([
      expect.objectContaining({
        reaction: "overload",
        triggerDamageEventId: direct.id,
        sourceTargetId: "enemy-0",
        triggerFrame: 0,
        damageFrame: 1,
        scheduled: true,
        withinSimulation: true,
        centerPosition: { x: 0, y: 0 },
        radius: 3,
        checkedTargetIds: ["enemy-0", "enemy-1", "enemy-2"],
        hitTargetIds: ["enemy-0", "enemy-1"],
        unresolvedTargetIds: ["enemy-3"],
        damageEventIds: reactionEvents.map((event) => event.id)
      })
    ]);
    expect(
      result.hitResolutionLog
        .filter((entry) => entry.resolutionKind === "reaction-damage")
        .map((entry) => ({
          targetId: entry.targetId,
          landed: entry.landed,
          damageAllowed: entry.damageAllowed,
          reason: entry.reason
        }))
    ).toEqual([
      {
        targetId: "enemy-0",
        landed: true,
        damageAllowed: true,
        reason: null
      },
      {
        targetId: "enemy-1",
        landed: true,
        damageAllowed: false,
        reason: "OVERLOAD_IMMUNE_WINDOW"
      },
      {
        targetId: "enemy-2",
        landed: false,
        damageAllowed: false,
        reason: "OUTSIDE_CIRCLE_GEOMETRY"
      }
    ]);
  });

  it("includes reaction damage in totals, skills, per-second buckets, and curves", () => {
    const result = simulate(makeOverloadConfig(), {
      critMode: "noCrit"
    });
    const summed = result.damageEvents.reduce(
      (total, event) => total + event.finalDamage,
      0
    );
    const overload = result.bySkill.find(
      (skill) => skill.actionName === "Pyro Skill · 超载"
    );

    expect(result.totalDamage).toBeCloseTo(summed, 10);
    expect(result.byCharacter.pyro).toBeCloseTo(summed, 10);
    expect(overload).toMatchObject({ hits: 2 });
    expect(overload?.damage).toBeCloseTo(
      result.damageEvents[1]!.finalDamage,
      10
    );
    expect(
      Object.values(result.perSecond[0] ?? {}).reduce(
        (total, damage) => total + damage,
        0
      )
    ).toBeCloseTo(summed, 10);
    expect(result.damageCurve.map((point) => point.frame)).toEqual([
      0,
      1,
      1
    ]);
    expect(result.damageCurve.at(-1)?.cumulativeDamage).toBeCloseTo(
      result.totalDamage,
      10
    );
    expect(result.reactedHits).toBe(1);
    expect(result.auraTimeline).toHaveLength(1);
    expect(result.auraTimeline[0]?.reaction).toBe("overload");
  });

  it("resolves direct hits before queued reaction damage on the same frame", () => {
    const config = makeOverloadConfig();
    config.enemy.targets![0]!.initialAura = [
      { element: "electro", gaugeUnits: 2 }
    ];
    config.timeline!.abilities[0]!.hits!.push({
      id: "pyro-hit-same-frame",
      label: "同帧第二次超载触发",
      frame: 1,
      scaling: 1,
      element: "pyro",
      targeting: {
        targetId: "enemy-0",
        outcome: "landed"
      },
      application: {
        gaugeUnits: 1,
        icd: { mode: "no-icd-v1" }
      }
    });

    const result = simulate(config, { critMode: "noCrit" });

    expect(
      result.damageEvents
        .filter((event) => event.frame === 1)
        .map((event) => event.kind)
    ).toEqual([
      "direct",
      "transformative-reaction",
      "transformative-reaction"
    ]);
    expect(result.reactionDamageLog).toMatchObject([
      {
        triggerFrame: 0,
        scheduled: true,
        blockedReason: null
      },
      {
        triggerFrame: 1,
        scheduled: false,
        blockedReason: "REACTION_DAMAGE_GCD",
        damageEventIds: []
      }
    ]);
  });

  it("uses the actual source actor for reaction level and EM ownership", () => {
    const config = makeOverloadConfig();
    config.characters.push({
      ...config.characters[0]!,
      id: "proxy",
      name: "高精通缩放代理",
      level: 100,
      stats: {
        ...config.characters[0]!.stats,
        em: 1000,
        reactionBonus: 1
      }
    });
    config.timeline!.abilities[0]!.hits![0]!.scalingOwnerId =
      "proxy";

    const result = simulate(config, { critMode: "noCrit" });
    const reaction = result.damageEvents.find(
      (event) => event.kind === "transformative-reaction"
    );

    expect(reaction).toMatchObject({
      sourceActorId: "pyro",
      scalingOwnerId: "pyro",
      creditOwnerId: "pyro",
      statsBeforeDamage: { em: 100 },
      transformativeReactionFactors: {
        characterLevel: 90,
        elementalMastery: 100,
        reactionBonus: 0.2
      }
    });
  });

  it("applies ReactionB only to the first overlapping explosion per target in 30 frames", () => {
    const base = makeConfig();
    const sourceTargets = ["enemy-0", "source-1"];
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
            position: { x: 0, y: index * 2 - 1 },
            initialAura: [
              { element: "electro" as const, gaugeUnits: 1 }
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
          id: "pyro",
          name: "Pyro",
          element: "pyro",
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
        initialActiveCharacterId: "pyro",
        swapFrames: 12,
        abilities: [
          {
            id: "overlapping-overloads",
            actorId: "pyro",
            name: "重叠超载",
            kind: "skill",
            cancelFrame: 7,
            animationEndFrame: 7,
            cooldownFrames: 0,
            hits: sourceTargets.map((targetId, index) => ({
              id: `overload-${index}`,
              label: `超载 ${index}`,
              frame: index * 6,
              scaling: 1,
              element: "pyro" as const,
              targeting: {
                targetId,
                outcome: "landed" as const
              },
              application: {
                gaugeUnits: 1,
                icd: { mode: "no-icd-v1" as const }
              }
            }))
          }
        ],
        commands: [
          {
            type: "skill",
            actorId: "pyro",
            abilityId: "overlapping-overloads"
          }
        ]
      }
    };

    const result = simulate(config, { critMode: "noCrit" });
    const sharedExplosions = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "overload" &&
        event.targetId === "shared-target"
    );
    const sharedDecisions = result.reactionDamageLog.flatMap(
      (entry) =>
        entry.damageGroupDecisions.filter(
          (decision) =>
            decision.reaction === "overload" &&
            decision.targetId === "shared-target"
        )
    );

    expect(sharedExplosions).toHaveLength(2);
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
        finalDamage: 0,
        groupMultiplier: 0
      }
    ]);
    expect(sharedExplosions[0]?.finalDamage).toBeGreaterThan(0);
    expect(sharedDecisions).toEqual([
      {
        reaction: "overload",
        sourceActorId: "pyro",
        targetId: "shared-target",
        windowStartFrame: 1,
        hitIndex: 0,
        resetFrames: 30,
        sequence: [true, false],
        damageAllowed: true,
        blockedReason: null
      },
      {
        reaction: "overload",
        sourceActorId: "pyro",
        targetId: "shared-target",
        windowStartFrame: 1,
        hitIndex: 1,
        resetFrames: 30,
        sequence: [true, false],
        damageAllowed: false,
        blockedReason: "REACTION_B_DAMAGE_ICD"
      }
    ]);
    const blockedLog = result.reactionDamageLog.find(
      (entry) => entry.damageFrame === 7
    );
    expect(blockedLog?.damageGroupBlockedTargetIds).toContain(
      "shared-target"
    );
    expect(blockedLog?.damageEventIds).toContain(
      sharedExplosions[1]?.id
    );
    expect(sharedExplosions[1]).toMatchObject({
      snapshot: "hit",
      finalDamage: 0,
      damageComposition: {
        direct: 0,
        additiveReaction: 0,
        transformativeReaction: 0
      }
    });
  });

  it("freezes trigger-frame live EM and reaction bonus for an action-snapshot Overload", () => {
    const config = makeOverloadConfig();
    config.enemy.targets = [config.enemy.targets![0]!];
    config.enemy.targetPhases = [];
    const ability = config.timeline!.abilities[0]!;
    const hit = ability.hits![0]!;
    ability.cancelFrame = 11;
    ability.animationEndFrame = 11;
    ability.buffs = [
      {
        key: "overload-live-em",
        label: "超载触发帧精通",
        target: "self",
        stat: "em",
        value: 200,
        startFrame: 5,
        durationFrames: 6
      },
      {
        key: "overload-live-reaction-bonus",
        label: "超载触发帧反应增伤",
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
      (event) => event.hitId === "pyro-hit"
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
      baseMultiplier: 2.75,
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

  it("records a scheduled explosion that falls outside the simulation", () => {
    const config = makeOverloadConfig();
    config.timeline!.commands[0] = {
      type: "skill",
      actorId: "pyro",
      abilityId: "pyro-skill",
      atFrame: 60
    };

    const result = simulate(config);

    expect(result.reactionDamageLog).toMatchObject([
      {
        scheduled: true,
        withinSimulation: false,
        damageFrame: 61,
        damageEventIds: []
      }
    ]);
    expect(
      result.damageEvents.filter(
        (event) => event.kind === "transformative-reaction"
      )
    ).toHaveLength(0);
  });
});
