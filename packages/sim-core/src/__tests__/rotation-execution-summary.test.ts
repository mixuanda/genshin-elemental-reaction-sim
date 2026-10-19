import { expect, it } from "vitest";
import { summarizeRotationExecution } from "../simulation-analysis";
import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

it("separates real input occupation, cross-period source damage and a truncated tail", () => {
  const config = makeConfig({ duration: 4, cycleLength: 2, rotation: [],
    enemy: { level: 90, resistance: 0, defReduction: 0 },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 12,
      abilities: [
        { id: "tail", actorId: "a", name: "合成延迟命中", kind: "skill", cancelFrame: 20, animationEndFrame: 60, cooldownFrames: 0,
          hits: [{ id: "tail-hit", frame: 140, scaling: 1, element: "physical" }] },
        { id: "finish", actorId: "a", name: "合成末段动画", kind: "normal", cancelFrame: 10, animationEndFrame: 30, cooldownFrames: 0,
          hits: [{ id: "finish-hit", frame: 0, scaling: 1, element: "physical" }] },
      ], commands: [{ type: "skill", actorId: "a", abilityId: "tail", atFrame: 10 }, { type: "normal", actorId: "a", abilityId: "finish", atFrame: 30 }],
    } });
  const result = simulate(config);
  const summary = summarizeRotationExecution(result);
  expect(summary.requestedCycle).toEqual({ ticks: 120, seconds: 2 });
  // Last cancel is 40f, but no later action cancels its actual 60f animation end.
  expect(summary.inputExecution).toMatchObject({ status: "complete", occupiedEndTick: 60, executableSeconds: 1,
    measurement: { totalDamage: 500, dps: 500 } });
  expect(summary.observation).toMatchObject({ durationSeconds: 4, totalDamage: 1000, dps: 250 });
  expect(summary.tailAttribution).toMatchObject({ status: "complete", declaredHorizonTick: 150, unassignedDamageEventIds: [] });
  expect(summary.tailAttribution.sources.find(source => source.timelineCommandIndex === 0)).toMatchObject({ engineCycle: 0, startTick: 10,
    observedDamage: 500, damageAfterInputEnd: 500 });
  expect(summary.completeRotation).toMatchObject({ totalDamage: 1000, inputDurationSeconds: 1, startTick: 0, endTick: 151, durationSeconds: 151 / 60 });
  expect(summary.completeRotation!.dps).toBeCloseTo(1000 / (151 / 60), 12);
  expect(summary.completeRotation!.primaryTargetDps).toBe(summary.completeRotation!.dps);
  expect(JSON.parse(JSON.stringify(summary))).toEqual(summary);

  const clipped = summarizeRotationExecution(simulate({ ...config, duration: 2 }));
  expect(clipped.inputExecution.status).toBe("complete");
  expect(clipped.tailAttribution.status).toBe("partial");
  expect(clipped.completeRotation).toBeNull();
  expect(clipped.observation.totalDamage).toBe(500);
  const unfinished = structuredClone(config);
  unfinished.timeline!.abilities[1]!.animationEndFrame = 300;
  const occupied = summarizeRotationExecution(simulate(unfinished));
  expect(occupied.inputExecution.status).toBe("partial");
  expect(occupied.inputExecution.occupiedEndTick).toBe(330);
  expect(occupied.completeRotation).toBeNull();
});
