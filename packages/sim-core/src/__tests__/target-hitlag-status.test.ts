import {
  assertTrustedSimulationResultV142,
  simulationResultV142Schema,
  type SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const HITLAG_EXTENSION_FRAMES = 3;
const SUPERCONDUCT_STATUS_DURATION_FRAMES = 720;

function makeTargetHitlagSuperconductConfig({
  hitlagFrame,
  hitlagOnTrigger = false
}: {
  hitlagFrame: number;
  hitlagOnTrigger?: boolean;
}): SimConfig {
  const base = makeConfig();
  const lastHitFrame = hitlagOnTrigger ? 0 : hitlagFrame;

  return {
    ...base,
    duration: 13,
    cycleLength: 13,
    targetClockModel: {
      mode: "target-local-hitlag-v1"
    },
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "超导测试目标",
          position: { x: 0, y: 0 },
          initialAura: [
            { element: "cryo", gaugeUnits: 1 }
          ]
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
          id: "target-hitlag-superconduct",
          actorId: "electro",
          name: "超导 Hitlag 状态边界",
          kind: "skill",
          cancelFrame: Math.max(lastHitFrame, 1),
          animationEndFrame: Math.max(lastHitFrame, 1),
          cooldownFrames: 0,
          hits: [
            {
              id: "superconduct-trigger",
              label: "超导触发",
              frame: 0,
              scaling: 1,
              element: "electro",
              geometry: {
                kind: "circle",
                coordinateSpace: "world",
                origin: { x: 0, y: 0 },
                radius: 1
              },
              application: {
                gaugeUnits: 1,
                icd: { mode: "no-icd-v1" }
              },
              ...(hitlagOnTrigger
                ? {
                    targetHitlag: {
                      haltFrames:
                        HITLAG_EXTENSION_FRAMES,
                      factor: 0
                    }
                  }
                : {})
            },
            ...(!hitlagOnTrigger
              ? [
                  {
                    id: "status-boundary-hitlag",
                    label: "状态边界 Hitlag",
                    frame: hitlagFrame,
                    scaling: 1,
                    element: "physical" as const,
                    targeting: {
                      targetId: "enemy-0",
                      outcome: "landed" as const
                    },
                    targetHitlag: {
                      haltFrames:
                        HITLAG_EXTENSION_FRAMES,
                      factor: 0
                    }
                  }
                ]
              : [])
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "electro",
          abilityId: "target-hitlag-superconduct"
        }
      ]
    }
  };
}

describe("target-local Hitlag and Superconduct status boundaries", () => {
  it("extends an already-active physical resistance shred and records the reciprocal status id", () => {
    const hitlagFrame = 10;
    const result = simulate(
      makeTargetHitlagSuperconductConfig({
        hitlagFrame
      }),
      { critMode: "noCrit" }
    );

    expect(result.reactionStatusLog).toHaveLength(1);
    const status = result.reactionStatusLog[0]!;
    expect(status).toMatchObject({
      id: 0,
      reaction: "superconduct",
      targetId: "enemy-0",
      startFrame: 1,
      endFrame:
        1 +
        SUPERCONDUCT_STATUS_DURATION_FRAMES +
        HITLAG_EXTENSION_FRAMES,
      supersededAtFrame: null
    });

    expect(result.targetHitlagLog).toHaveLength(1);
    expect(result.targetHitlagLog[0]).toMatchObject({
      globalFrame: hitlagFrame,
      targetId: "enemy-0",
      extensionFrames: HITLAG_EXTENSION_FRAMES,
      applied: true,
      blockedReason: null,
      extendedReactionStatusLogIds: [status.id]
    });
  });

  it("does not retroactively extend the status created by the triggering hit's future reaction-damage event", () => {
    const result = simulate(
      makeTargetHitlagSuperconductConfig({
        hitlagFrame: 0,
        hitlagOnTrigger: true
      }),
      { critMode: "noCrit" }
    );

    expect(result.targetHitlagLog).toHaveLength(1);
    expect(result.targetHitlagLog[0]).toMatchObject({
      globalFrame: 0,
      extensionFrames: HITLAG_EXTENSION_FRAMES,
      applied: true,
      extendedReactionStatusLogIds: []
    });
    expect(result.reactionStatusLog).toMatchObject([
      {
        id: 0,
        reaction: "superconduct",
        startFrame: 1,
        endFrame:
          1 + SUPERCONDUCT_STATUS_DURATION_FRAMES,
        supersededAtFrame: null
      }
    ]);
  });

  it("accumulates same-frame Hitlag extensions exactly once per landed hit", () => {
    const hitlagFrame = 10;
    const config = makeTargetHitlagSuperconductConfig({
      hitlagFrame
    });
    const timeline = config.timeline;
    if (timeline?.mode !== "legal-frame-v1") {
      throw new Error("Expected legal-frame-v1 test timeline");
    }
    const ability = timeline.abilities[0];
    if (ability === undefined) {
      throw new Error("Expected target Hitlag test ability");
    }
    const hits = ability.hits;
    if (hits === undefined) {
      throw new Error("Expected target Hitlag test hits");
    }
    hits.push({
      id: "status-boundary-hitlag-second",
      label: "同帧第二次状态边界 Hitlag",
      frame: hitlagFrame,
      scaling: 1,
      element: "physical",
      targeting: {
        targetId: "enemy-0",
        outcome: "landed"
      },
      targetHitlag: {
        haltFrames: HITLAG_EXTENSION_FRAMES,
        factor: 0
      }
    });

    const result = simulate(config, {
      critMode: "noCrit"
    });
    const status = result.reactionStatusLog[0]!;

    expect(status.endFrame).toBe(
      1 +
        SUPERCONDUCT_STATUS_DURATION_FRAMES +
        HITLAG_EXTENSION_FRAMES * 2
    );
    expect(result.targetHitlagLog).toHaveLength(2);
    expect(
      result.targetHitlagLog.map((entry) => ({
        globalFrame: entry.globalFrame,
        extensionFrames: entry.extensionFrames,
        extendedReactionStatusLogIds:
          entry.extendedReactionStatusLogIds
      }))
    ).toEqual([
      {
        globalFrame: hitlagFrame,
        extensionFrames: HITLAG_EXTENSION_FRAMES,
        extendedReactionStatusLogIds: [status.id]
      },
      {
        globalFrame: hitlagFrame,
        extensionFrames: HITLAG_EXTENSION_FRAMES,
        extendedReactionStatusLogIds: [status.id]
      }
    ]);
  });

  it("does not extend a half-open status whose endFrame equals the Hitlag frame", () => {
    const statusEndFrame =
      1 + SUPERCONDUCT_STATUS_DURATION_FRAMES;
    const result = simulate(
      makeTargetHitlagSuperconductConfig({
        hitlagFrame: statusEndFrame
      }),
      { critMode: "noCrit" }
    );

    expect(result.reactionStatusLog).toMatchObject([
      {
        id: 0,
        reaction: "superconduct",
        startFrame: 1,
        endFrame: statusEndFrame,
        supersededAtFrame: null
      }
    ]);
    expect(result.targetHitlagLog).toHaveLength(1);
    expect(result.targetHitlagLog[0]).toMatchObject({
      globalFrame: statusEndFrame,
      extensionFrames: HITLAG_EXTENSION_FRAMES,
      applied: true,
      extendedReactionStatusLogIds: []
    });
  });

  it("rejects missing or duplicate reciprocal Hitlag status links at both result boundaries", () => {
    const result = simulate(
      makeTargetHitlagSuperconductConfig({
        hitlagFrame: 10
      }),
      { critMode: "noCrit" }
    );

    const missing = structuredClone(result);
    missing.targetHitlagLog[0]!.extendedReactionStatusLogIds =
      [];
    missing.reactionStatusLog[0]!.endFrame -=
      HITLAG_EXTENSION_FRAMES;
    missing.reactionStatusLog[0]!.endTimeSeconds =
      missing.reactionStatusLog[0]!.endFrame / 60;
    expect(
      simulationResultV142Schema.safeParse(missing).success
    ).toBe(false);
    expect(() =>
      assertTrustedSimulationResultV142(missing)
    ).toThrow(
      /Trusted SimulationResult 1\.42 integrity validation failed/
    );

    const duplicate = structuredClone(result);
    duplicate.targetHitlagLog[0]!.extendedReactionStatusLogIds =
      [0, 0];
    expect(
      simulationResultV142Schema.safeParse(duplicate).success
    ).toBe(false);
    expect(() =>
      assertTrustedSimulationResultV142(duplicate)
    ).toThrow(
      /Trusted SimulationResult 1\.42 integrity validation failed/
    );
  });
});
