import type { SimConfig } from "@genshin-dps-lab/schemas";
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

describe("Superconduct simulation integration", () => {
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
});
