import { expect, it, vi } from "vitest";
import { createVersionedContentHash } from "@genshin-dps-lab/schemas";
import { applyExecutionProfile, IDEALIZED_EXECUTION_PROFILE } from "../execution-profiles";
import * as startup from "../simulation-analysis";
import { analyzeStochasticStartup } from "../stochastic-startup";
import { makeConfig } from "./fixtures";

it("resolves a Sacrificial reference once and keeps its repeated requests fixed across random trajectories", () => {
  const config = makeConfig({ duration: 20, cycleLength: 20, rotation: [],
    sacrificialModel: {mode: "fixed-source-no-character-hitlag-v1", actors: [{actorId: "a", weaponId: "sacrificialsword", refinement: 5}]},
    timeline: {mode: "legal-frame-v1", fps: 60, legalityMode: "wait", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{id: "e", actorId: "a", name: "合成祭礼技能", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 600,
        hits: [{id: "e-hit", frame: 6, attackTag: "skill", scaling: 1, element: "physical"}]}],
      commands: [{type: "skill", actorId: "a", abilityId: "e", atFrame: 1}, {type: "skill", actorId: "a", abilityId: "e", atFrame: 10}]},
  });
  const original = structuredClone(config);
  const options = {randomSeed: "sacrificial-consumer-reference", critMode: "noCrit" as const};
  const profile = applyExecutionProfile(config, IDEALIZED_EXECUTION_PROFILE, options);
  // Reference roll 0.6284964594524354 < R5's 0.8 resets at frame 7.
  expect(profile.changes.map(row => row.originalStartTick)).toEqual([1, 10]);
  expect(profile.baselineRuntimeOptions).toMatchObject(options);
  expect(() => applyExecutionProfile(config, {...IDEALIZED_EXECUTION_PROFILE, version: "1.0.0", baselineMode: "structural-v1"}, options)).toThrow("旧1.0.0结构基线不能解析祭礼");

  const observer = vi.spyOn(startup, "simulateWithStartup");
  try {
    const result = analyzeStochasticStartup(config, {sampleCount: 2, warmupCycles: 1}, options);
    expect(observer).toHaveBeenCalledTimes(4);
    const repeated = observer.mock.calls[0]![0];
    expect(repeated.timeline!.commands.flatMap(row => row.type === "skill" ? [row.atFrame] : [])).toEqual([1, 10, 1201, 1210, 2401, 2410]);
    for (const [input] of observer.mock.calls) expect(input.timeline!.commands).toEqual(repeated.timeline!.commands);
    expect(result.randomness).toMatchObject({sacrificialPolicy: {rngStream: "sacrificial-v1", matchesGcsimRandomSequence: false},
      requestTemplate: {mode: "runtime-cooldown-v1", referenceSeed: options.randomSeed, requestedRuntimeOptions: options,
        repeatedConfigHash: createVersionedContentHash(repeated)}});
    const firstSeed = observer.mock.results[0]!.value as startup.SimulationStartupResult;
    const secondSeed = observer.mock.results[2]!.value as startup.SimulationStartupResult;
    expect(firstSeed.result!.timelineExecution!.commandResults[1]!.startFrame).toBe(10);
    // Seed 1 rolls 0.9920402334537357: it must wait for the real worker,
    // while its requested frame remains the shared reference's frame 10.
    expect(secondSeed.result!.timelineExecution!.commandResults[1]).toMatchObject({requestedFrame: 10, startFrame: 601});
    expect(startup.evaluateSimulationSteadyState(firstSeed.result!).status).toBe("not-established");
    expect(config).toEqual(original);
  } finally { observer.mockRestore(); }
});
