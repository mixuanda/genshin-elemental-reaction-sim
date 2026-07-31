import {
  assertTrustedSimulationResultV144,
  migrateConfig,
  simulationResultV144Schema
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

function makeEnergyCostConfig(
  initialEnergy: number,
  energyCost: number
) {
  const base = makeConfig();
  return makeConfig({
    duration: 1,
    cycleLength: 1,
    characters: [
      {
        ...base.characters[0]!,
        initialEnergy
      }
    ],
    rotation: [
      {
        id: "energy-boundary-action",
        actorId: "a",
        name: "能量边界行动",
        at: 0,
        once: true,
        energyCost
      }
    ]
  });
}

describe("energy accounting boundaries", () => {
  it.each([1.0000000005, 1.0000000009])(
    "accepts a cost inside the comparison epsilon without returning negative energy (%s)",
    (energyCost) => {
      const result = simulate(makeEnergyCostConfig(1, energyCost));
      const action = result.actionLog[0]!;
      const summary = result.energyStats.a!;

      expect(result.skippedActions).toHaveLength(0);
      expect(action.energyBefore).toBe(1);
      expect(action.energyAfter).toBe(0);
      expect(action.energyAfter).toBeGreaterThanOrEqual(0);
      expect(summary.spent).toBe(1);
      expect(summary.spent).toBe(
        action.energyBefore - action.energyAfter
      );
      expect(summary.final).toBe(0);
      expect(summary.final).toBeGreaterThanOrEqual(0);
      expect(result.energyCurve.at(-1)?.energyByCharacter.a).toBe(0);
      expect(
        simulationResultV144Schema.safeParse(result).success
      ).toBe(true);
    }
  );

  it("preserves exact normal-cost accounting at twelve decimal places", () => {
    const result = simulate(makeEnergyCostConfig(2, 1.25));
    const action = result.actionLog[0]!;
    const summary = result.energyStats.a!;

    expect(action).toMatchObject({
      energyBefore: 2,
      energyAfter: 0.75
    });
    expect(summary).toMatchObject({
      spent: 1.25,
      final: 0.75
    });
    expect(summary.spent).toBe(
      action.energyBefore - action.energyAfter
    );
    expect(
      simulationResultV144Schema.safeParse(result).success
    ).toBe(true);
  });

  it("accepts a forced legal-frame legacy action whose rounded frame falls beyond duration", () => {
    const duration = 1.009;
    const result = simulate(
      makeConfig({
        duration,
        cycleLength: duration,
        rotation: [
          {
            id: "rounded-tail-action",
            actorId: "a",
            name: "归一化后越界行动",
            at: duration,
            once: true,
            energyCost: 1
          }
        ]
      }),
      { compatibilityMode: "legal-frame-v1" }
    );

    expect(Math.round(duration * 60) / 60).toBeGreaterThan(
      duration
    );
    expect(result.actionLog).toHaveLength(0);
    expect(result.skippedActions).toHaveLength(0);
    expect(result.energyCurve).toHaveLength(1);
    expect(
      simulationResultV144Schema.safeParse(result).success
    ).toBe(true);
    expect(() =>
      assertTrustedSimulationResultV144(result)
    ).not.toThrow();
  });

  it("accepts fixed and particle children whose rounded frame falls beyond duration", () => {
    const duration = 1.009;
    const result = simulate(
      makeConfig({
        duration,
        cycleLength: duration,
        rotation: [
          {
            id: "rounded-tail-children",
            actorId: "a",
            name: "归一化后越界子事件",
            at: 0,
            once: true,
            energyGains: [
              {
                target: "a",
                amount: 2,
                offset: duration,
                source: "rounded-tail-fixed"
              }
            ],
            buffs: [
              {
                key: "rounded-tail-er",
                target: "a",
                stat: "energyRecharge",
                value: 1,
                offset: duration,
                duration: 1
              }
            ],
            particles: [
              {
                id: "rounded-tail-particle",
                source: "rounded-tail-particle",
                element: "pyro",
                count: 1,
                spawnOffset: duration,
                travelTime: 0
              },
              {
                id: "rounded-tail-arrival",
                source: "rounded-tail-arrival",
                element: "pyro",
                count: 1,
                spawnOffset: 0,
                travelTime: duration
              }
            ]
          }
        ]
      }),
      { compatibilityMode: "legal-frame-v1" }
    );

    expect(result.actionLog).toHaveLength(1);
    expect(result.energyLog).toHaveLength(0);
    expect(result.particleEvents).toHaveLength(1);
    expect(result.particleEvents[0]).toMatchObject({
      particleId: "rounded-tail-arrival",
      receivedWithinSimulation: true
    });
    expect(result.energyCurve).toHaveLength(1);
    expect(
      simulationResultV144Schema.safeParse(result).success
    ).toBe(true);
    expect(() =>
      assertTrustedSimulationResultV144(result)
    ).not.toThrow();
  });

  it("accepts an integer-frame legal command whose exact seconds exceed a tolerated duration", () => {
    const base = makeConfig();
    const duration = 2 - 1e-12;
    const result = simulate(
      makeConfig({
        duration,
        cycleLength: 2,
        characters: base.characters,
        rotation: [],
        timeline: {
          mode: "legal-frame-v1",
          fps: 60,
          legalityMode: "strict",
          initialActiveCharacterId: "a",
          swapFrames: 12,
          abilities: [
            {
              id: "legal-exact-tail",
              actorId: "a",
              name: "合法精确尾帧行动",
              kind: "skill",
              cancelFrame: 0,
              animationEndFrame: 0,
              cooldownFrames: 0
            }
          ],
          commands: [
            {
              type: "skill",
              actorId: "a",
              abilityId: "legal-exact-tail",
              atFrame: 120
            }
          ]
        }
      })
    );

    expect(
      Math.abs(duration * 60 - Math.round(duration * 60))
    ).toBeLessThanOrEqual(1e-9);
    expect(result.timelineExecution?.commandResults[0]).toMatchObject({
      startFrame: 120,
      status: "executed"
    });
    expect(result.actionLog).toHaveLength(0);
    expect(result.skippedActions).toHaveLength(0);
    expect(result.energyCurve).toHaveLength(1);
    expect(
      simulationResultV144Schema.safeParse(result).success
    ).toBe(true);
    expect(() =>
      assertTrustedSimulationResultV144(result)
    ).not.toThrow();
  });

  it("fails closed when fixed energy gains are used as drains", () => {
    const config = makeConfig({
      duration: 1,
      cycleLength: 1,
      rotation: [
        {
          id: "invalid-energy-drain",
          actorId: "a",
          name: "非法能量扣除",
          at: 0,
          once: true,
          energyGains: [
            {
              target: "a",
              amount: -1,
              source: "invalid-drain"
            }
          ]
        }
      ]
    });

    expect(
      migrateConfig(config).rotation[0]?.energyGains?.[0]?.amount
    ).toBe(-1);
    expect(() => simulate(config)).toThrow(
      /energyGains cannot represent energy drains.*received -1/
    );
  });

  it("fails closed for negative timeline fixed gains without rewriting the frozen V142 input Schema", () => {
    const base = makeConfig();
    const config = makeConfig({
      duration: 1,
      cycleLength: 1,
      characters: [
        {
          ...base.characters[0]!,
          initialEnergy: 0
        }
      ],
      rotation: [],
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [
          {
            id: "invalid-timeline-drain",
            actorId: "a",
            name: "非法时间线能量扣除",
            kind: "skill",
            cancelFrame: 0,
            animationEndFrame: 0,
            cooldownFrames: 0,
            energyGains: [
              {
                target: "a",
                amount: -2,
                frame: 0,
                source: "invalid-timeline-drain"
              }
            ]
          }
        ],
        commands: [
          {
            type: "skill",
            actorId: "a",
            abilityId: "invalid-timeline-drain"
          }
        ]
      }
    });

    expect(
      migrateConfig(config).timeline?.abilities[0]?.energyGains?.[0]
        ?.amount
    ).toBe(-2);
    expect(() => simulate(config)).toThrow(
      /timeline ability "invalid-timeline-drain".*received -2/
    );
  });
});
