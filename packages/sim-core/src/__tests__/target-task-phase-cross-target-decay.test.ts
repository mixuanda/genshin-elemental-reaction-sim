import type { SimConfig } from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

function makeCrossTargetDecayConfig(
  mode: SimConfig["targetTaskModel"]["mode"]
): SimConfig {
  const base = makeConfig();

  return {
    ...base,
    duration: 7.5,
    cycleLength: 7.5,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Earlier expiring target",
          position: { x: 100, y: 0 },
          initialAura: [
            {
              element: "hydro",
              gaugeUnits: 0.001
            }
          ]
        },
        {
          id: "enemy-1",
          name: "Later Burning target",
          position: { x: 0, y: 0 },
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
        id: "driver",
        name: "Cross-target decay driver",
        element: "pyro"
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v7" },
    targetTaskModel: { mode },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "driver",
      swapFrames: 1,
      abilities: [
        {
          id: "late-burning-start",
          actorId: "driver",
          name: "Late Burning start",
          kind: "skill",
          cancelFrame: 287,
          animationEndFrame: 287,
          cooldownFrames: 0,
          hits: [
            {
              id: "late-pyro",
              label: "Late Pyro",
              frame: 286,
              scaling: 0,
              element: "pyro",
              geometry: {
                kind: "circle",
                coordinateSpace: "world",
                origin: { x: 0, y: 0 },
                radius: 1
              },
              application: {
                gaugeUnits: 1,
                icdTag: "late-pyro",
                icdGroup: "no-icd"
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "driver",
          abilityId: "late-burning-start",
          atFrame: 0
        }
      ]
    }
  };
}

function numericalProjection(
  result: ReturnType<typeof simulate>
) {
  return {
    totalDamage: result.totalDamage,
    reactedHits: result.reactedHits,
    damage: result.damageEvents.map((event) => ({
      frame: event.frame,
      kind: event.kind,
      reaction: event.reaction,
      targetId: event.targetId,
      finalDamage: event.finalDamage,
      displayDamage: event.displayDamage
    })),
    auraEndStates: result.auraEndStates
  };
}

describe("target-phase cross-target decay order", () => {
  it("decays an earlier target before a later target's same-frame Burning callback", () => {
    const phased = simulate(
      makeCrossTargetDecayConfig("target-phase-v1"),
      { critMode: "noCrit" }
    );
    const legacy = simulate(
      makeCrossTargetDecayConfig("legacy-event-heap-v1"),
      { critMode: "noCrit" }
    );

    expect(
      phased.auraInitialStates[0]?.aura[0]?.expiresAtFrame
    ).toBe(421);
    expect(
      phased.burningStateLog.find(
        (entry) =>
          entry.frame === 421 &&
          entry.targetId === "enemy-1"
      )
    ).toMatchObject({
      operation: "tick-skipped",
      tickIndex: 9,
      eventPriority: 0.5 + 0.5 / 3
    });

    const expiryIndex =
      phased.targetStateTimeline.points.findIndex(
        (point) =>
          point.frame === 421 &&
          point.targetId === "enemy-0" &&
          point.cause === "aura-natural-expiry"
      );
    const callbackIndex =
      phased.targetStateTimeline.points.findIndex(
        (point) =>
          point.frame === 421 &&
          point.targetId === "enemy-1" &&
          point.cause === "burning-tick"
      );
    expect(expiryIndex).toBeGreaterThanOrEqual(0);
    expect(callbackIndex).toBeGreaterThanOrEqual(0);
    expect(expiryIndex).toBeLessThan(callbackIndex);

    expect(numericalProjection(phased)).toStrictEqual(
      numericalProjection(legacy)
    );
  });
});
