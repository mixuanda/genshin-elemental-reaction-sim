import { expect, it } from "vitest";
import { solveEnergyRecharge, simulateWithStartup } from "../simulation-analysis";
import { makeConfig } from "./fixtures";

it("uses actual dynamic energy, fixed requests and runtime options without claiming unbounded ER failure", () => {
  const config = makeConfig({ duration: 2, cycleLength: 2, rotation: [],
    favoniusModel: { mode: "fixed-source-independent-stream-v1", actors: [
      { actorId: "a", weaponId: "favoniussword", refinement: 5, particleDelayFrames: 10 },
    ] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 12,
      abilities: [
        { id: "hit", actorId: "a", name: "合成暴击触发西风", kind: "normal", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
          hits: [{ id: "hit-0", frame: 0, scaling: 1, element: "physical", critRate: 1 }] },
        { id: "q", actorId: "a", name: "合成耗能请求", kind: "burst", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0, energyCost: 12 },
      ], commands: [{ type: "normal", actorId: "a", abilityId: "hit", atFrame: 0 }, { type: "burst", actorId: "a", abilityId: "q", atFrame: 20 }],
    } });
  const before = structuredClone(config);
  const runtimeOptions = { energyMode: "zero", randomSeed: "er-dynamic-source", execution: { criticalSampling: "seeded-random-v1" } } as const;
  const options = { actorId: "a", minimumEr: 1, maximumEr: 1.5, step: .5, runtimeOptions };
  const bounded = solveEnergyRecharge(config, options);
  expect(bounded.status).toBe("infeasible-within-bounds");
  expect(bounded.scenario).toMatchObject({ seed: "er-dynamic-source", startupEnergy: "zero" });
  expect(bounded.evaluated.every(candidate => candidate.energyEvidence.spawnedParticleEvents === 1 && candidate.energyEvidence.receivedParticleRawEnergy === 6)).toBe(true);
  expect(bounded.evaluated.every(candidate => candidate.energyEvidence.requestedCostCommandIndices.join() === "1" && candidate.energyEvidence.executedCostCommandIndices.length === 0)).toBe(true);

  const complete = solveEnergyRecharge(config, { ...options, maximumEr: 3, maximumEvaluations: 5, safetyMargin: .5 });
  expect(complete.status).toBe("feasible-on-grid");
  expect(complete.evaluated.map(candidate => [candidate.energyRecharge, candidate.feasible])).toEqual([[1, false], [1.5, false], [2, true], [2.5, true], [3, true]]);
  expect(complete.minimumFeasibleEr).toBe(2);
  expect(complete.recommendedEr).toBe(2.5); // Already evaluated grid point consumes no extra evaluation.
  expect(complete.evaluated.slice(0, 2).map(candidate => candidate.reproducibilityKey)).toEqual(bounded.evaluated.map(candidate => candidate.reproducibilityKey));
  const unverifiedMargin = solveEnergyRecharge(config, { ...options, maximumEr: 3, maximumEvaluations: 5, safetyMargin: .25 });
  expect(unverifiedMargin.minimumFeasibleEr).toBe(2);
  expect(unverifiedMargin.recommendedEr).toBeNull();
  expect(unverifiedMargin.reasons.join()).toContain("评估上限");

  const noSource = structuredClone(config);
  delete noSource.favoniusModel;
  const noEnergy = solveEnergyRecharge(noSource, options);
  expect(noEnergy.status).toBe("infeasible-within-bounds");
  expect(noEnergy.evaluated.every(candidate => !candidate.feasible && candidate.energyEvidence.spawnedParticleEvents === 0 && candidate.energyEvidence.receivedParticleRawEnergy === 0 && candidate.energyEvidence.fixedEnergyRequested === 0)).toBe(true);
  expect(noEnergy.reasons.join()).toContain("均未产出");
  noSource.timeline!.commands.pop();
  const undefinedObjective = solveEnergyRecharge(noSource, options);
  expect(undefinedObjective.status).toBe("blocked");
  expect(undefinedObjective.evaluated).toEqual([]);

  const custom = simulateWithStartup(config, { mode: "custom", energyByCharacter: { a: 6 } }, runtimeOptions);
  expect(custom.status).toBe("completed");
  expect(custom.result!.resolvedRuntimeOptions).toMatchObject({ energyMode: "configured", randomSeed: runtimeOptions.randomSeed, execution: runtimeOptions.execution });
  expect(custom.startup.energyAtMeasurementStart).toEqual({ a: 6 });
  expect(custom.result!.skippedActions).toEqual([]);
  expect(config).toEqual(before);
});
