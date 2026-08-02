import {
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  assertTrustedSimulationResult,
  simulationResultSchema,
  type SimConfig,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const noIcd = (gaugeUnits = 1) => ({
  gaugeUnits,
  icd: { mode: "no-icd-v1" as const },
});

function makeSameFrameBurningRestartConfig(): SimConfig {
  const base = makeConfig({
    targetTaskModel: { mode: "target-phase-v2" },
  });

  return {
    ...base,
    dataVersion: "synthetic-burning-v151-e2e-gate-1",
    randomSeed: "synthetic-burning-v151-e2e-gate-seed",
    duration: 1,
    cycleLength: 1,
    meta: {
      name: "V1.51 same-frame Burning restart gate",
      version: "1.51.0",
      verificationStatus: "provisional",
    },
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Burning restart target",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "dendro", gaugeUnits: 1 }],
        },
      ],
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "reaction-driver",
        name: "Reaction driver",
        element: "pyro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0,
          em: 100,
        },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v9" },
    targetTaskModel: { mode: "target-phase-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "reaction-driver",
      swapFrames: 1,
      abilities: [
        {
          id: "same-frame-burning-restart",
          actorId: "reaction-driver",
          name: "Same-frame Burning restart",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "start-burning",
              label: "Start Burning",
              frame: 0,
              scaling: 0,
              element: "pyro",
              geometry: {
                kind: "circle",
                coordinateSpace: "world",
                origin: { x: 0, y: 0 },
                radius: 1,
              },
              application: noIcd(),
            },
            {
              id: "stop-burning",
              label: "Stop Burning",
              frame: 0,
              scaling: 0,
              element: "cryo",
              geometry: {
                kind: "circle",
                coordinateSpace: "world",
                origin: { x: 0, y: 0 },
                radius: 1,
              },
              application: noIcd(10),
            },
            {
              id: "restart-burning",
              label: "Restart Burning",
              frame: 0,
              scaling: 0,
              element: "pyro",
              geometry: {
                kind: "circle",
                coordinateSpace: "world",
                origin: { x: 0, y: 0 },
                radius: 1,
              },
              application: noIcd(),
            },
          ],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "reaction-driver",
          abilityId: "same-frame-burning-restart",
          atFrame: 0,
        },
      ],
    },
  };
}

describe("V1.51 Burning simulator end-to-end gate", () => {
  it("keeps a same-frame stop/restart generation-safe and audits the stale callback", () => {
    const config = makeSameFrameBurningRestartConfig();
    const first = simulate(config, { critMode: "noCrit" });
    const repeated = simulate(structuredClone(config), { critMode: "noCrit" });

    expect(first.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(first.engineVersion).toBe(CURRENT_ENGINE_VERSION);
    expect(first.config.basicReactionSchedulerModel.mode).toBe(
      "fixed-gcsim-basic-reaction-scheduler-v2",
    );

    const lifecycle = first.burningStateLog.map((entry) => ({
      frame: entry.frame,
      operation: entry.operation,
      generation: entry.generation,
      triggerElement: entry.triggerElement,
    }));
    expect(lifecycle.slice(0, 3)).toEqual([
      {
        frame: 0,
        operation: "start",
        generation: 1,
        triggerElement: "pyro",
      },
      {
        frame: 0,
        operation: "stop",
        generation: 1,
        triggerElement: "cryo",
      },
      {
        frame: 0,
        operation: "start",
        generation: 3,
        triggerElement: "pyro",
      },
    ]);

    const frame15 = first.targetPhaseLog.find(
      (entry) => entry.globalFrame === 15,
    );
    expect(frame15?.targetTasks).toEqual([
      expect.objectContaining({
        kind: "burning-tick",
        generation: 1,
        tickIndex: 1,
        status: "stale",
        burningStateLogId: null,
      }),
      expect.objectContaining({
        kind: "burning-tick",
        generation: 3,
        tickIndex: 1,
        status: "applied",
        burningStateLogId: expect.any(Number),
      }),
    ]);
    expect(first.burningStateLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          frame: 15,
          operation: "tick",
          generation: 3,
          tickIndex: 1,
        }),
      ]),
    );

    expect(simulationResultSchema.parse(first)).toEqual(first);
    expect(assertTrustedSimulationResult(first)).toBe(first);
    expect(repeated).toEqual(first);
  });
});
