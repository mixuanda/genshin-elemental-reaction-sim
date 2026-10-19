import { describe, expect, it, vi } from "vitest";
import * as startup from "../simulation-analysis";
import { analyzeStochasticStartup, summarizeStochasticValues } from "../stochastic-startup";
import { makeConfig } from "./fixtures";

function fixture() {
  const config = makeConfig({ duration: 4, cycleLength: 2, rotation: [], timeline: {
    mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 12,
    abilities: [
      { id: "e", actorId: "a", name: "合成固定产球", kind: "skill", cancelFrame: 2, animationEndFrame: 2, cooldownFrames: 0,
        particles: [{ id: "one", element: "pyro", count: 1, spawnFrame: 0, travelFrames: 1 }] },
      { id: "q", actorId: "a", name: "合成耗能", kind: "burst", cancelFrame: 2, animationEndFrame: 2, cooldownFrames: 0, energyCost: 6,
        hits: [{ id: "q-hit", frame: 0, scaling: 1, element: "pyro" }] },
    ], commands: [{ type: "skill", actorId: "a", abilityId: "e" }, { type: "burst", actorId: "a", abilityId: "q" }],
  } });
  config.characters[0]!.energyMax = 6;
  config.characters[0]!.stats.critRate = 0.5;
  config.characters.push({ ...structuredClone(config.characters[0]!), id: "b", name: "无耗能请求的后台角色" });
  return config;
}

describe("finite stochastic startup diagnostics", () => {
  it("separates empirical spread from a Student-t mean interval and undefined rates", () => {
    const summary = summarizeStochasticValues([1, 2, 3, 4, 5])!;
    expect(summary.mean).toBe(3);
    expect(summary.sampleStandardDeviation).toBe(Math.sqrt(2.5));
    expect(summary.spreadPercentiles).toEqual({ p05: 1.2, p50: 3, p95: 4.8 });
    expect(summary.meanConfidenceInterval).toMatchObject({ method: "student-t-95-approximation", degreesOfFreedom: 4, criticalValue: 2.776 });
    expect(summary.meanConfidenceInterval!.low).toBeCloseTo(3 - 2.776 / Math.sqrt(2), 14);
    expect(summary.meanConfidenceInterval!.high).toBeCloseTo(3 + 2.776 / Math.sqrt(2), 14);
    expect(summarizeStochasticValues([])).toBeNull();
    expect(summarizeStochasticValues([7])!.meanConfidenceInterval).toBeNull();
    expect(summarizeStochasticValues([2, 2])!.meanConfidenceInterval).toMatchObject({ low: 2, high: 2, criticalValue: 12.706 });
    expect(summarizeStochasticValues(Array.from({ length: 32 }, (_, i) => i))!.meanConfidenceInterval).toMatchObject({ degreesOfFreedom: 31, criticalValue: 2.040 });
    expect(() => analyzeStochasticStartup(fixture(), { sampleCount: 1 })).toThrow("2至32");
    expect(() => analyzeStochasticStartup(fixture(), { sampleCount: 2 }, {}, { shouldCancel: () => true })).toThrow("取消");
  });

  it("measures overlapping windows on exactly two continuous trajectories per seed and pairs before summarizing", () => {
    const config = fixture();
    const before = structuredClone(config);
    const observer = vi.spyOn(startup, "simulateWithStartup");
    const progress: number[] = [];
    try {
      const answer = analyzeStochasticStartup(config, { sampleCount: 2, warmupCycles: 1 },
        { randomSeed: "small-paired-fixture", execution: { criticalSampling: "seeded-random-v1" } },
        { onProgress: (entry) => progress.push(entry.completed) });
      expect(observer).toHaveBeenCalledTimes(4);
      expect(progress).toEqual([0, 1, 2, 3, 4]);
      expect(config).toEqual(before);
      expect(answer.policy).toMatchObject({ simulationTicks: 480, observationTicks: 240, warmupTicks: 120 });
      expect(answer.status).toBe("completed-diagnostic");
      expect(answer.runs).toHaveLength(4);
      expect(new Set(answer.runs.map((run) => run.seed)).size).toBe(2);
      expect(answer.representativeResult.skippedActions.map((entry) => entry.frame)).toEqual([2, 242]);
      expect(answer.representativeResult.damageEvents.map((entry) => entry.frame)).toEqual([122, 362]);
      expect(answer.representativeResult.executionAudit!.hits.every((hit) => hit.trace!.length > 0)).toBe(true);
      for (const [index, run] of answer.runs.entries()) {
        const [input, initial, options] = observer.mock.calls[index]!;
        expect(input.duration).toBe(8);
        expect(input.timeline!.commands.filter((command) => command.type === "burst")).toHaveLength(4);
        expect(initial.mode).toBe(run.initialEnergy);
        expect(options).toMatchObject({ randomSeed: run.seed, execution: { captureHits: index === 0, detailedTraces: index === 0 } });
        expect(run.runManifest.resolvedRuntimeOptions.randomSeed).toBe(run.seed);
        const expectedEnergy = run.initialEnergy === "zero" ? [3, 0] : [0, 3];
        for (const [windowIndex, window] of run.windows.entries()) {
          expect(window).toMatchObject({ startTick: (windowIndex + 1) * 120, endTick: (windowIndex + 3) * 120 });
          expect(window.actors.a).toEqual({ startEnergy: expectedEnergy[windowIndex], endEnergy: expectedEnergy[windowIndex],
            energyCostAttempts: 2, energyCostFailures: 1, insufficientEnergyFailures: 1, energyCostFailureRate: 0.5 });
          expect(window.actors.b!.energyCostFailureRate).toBeNull();
          // One Q per 4-second observation window: 1000 × 190/400 × 0.9, optionally × 1.5.
          expect([427.5, 641.25]).toContain(window.damage);
          expect(window.dps).toBe(window.damage / 4);
        }
      }
      for (const contrast of answer.contrasts) {
        expect(contrast.pairedSamples).toHaveLength(2);
        const expectedDifferences = answer.randomness.seeds.map((seed) => {
          const windows = answer.runs.filter((run) => run.seed === seed).flatMap((run) => run.windows);
          return windows.find((sample) => sample.cellId === contrast.minuend)!.damage - windows.find((sample) => sample.cellId === contrast.subtrahend)!.damage;
        });
        expect(contrast.pairedSamples.map((sample) => sample.damage)).toEqual(expectedDifferences);
        expect(contrast.metrics.damage.mean).toBe((expectedDifferences[0]! + expectedDifferences[1]!) / 2);
        expect(contrast.metrics.damage.meanConfidenceInterval).toMatchObject({ degreesOfFreedom: 1, criticalValue: 12.706 });
        expect(contrast.metrics.actors.b!.energyCostFailureRate).toBeNull();
      }
    } finally { observer.mockRestore(); }
  });

  it("counts energy and legality rejections once each instead of treating an absent action as successful", () => {
    const config = fixture();
    config.duration = 2;
    config.timeline!.legalityMode = "wait";
    config.timeline!.abilities = [
      { id: "q", actorId: "a", name: "耗能状态启动", kind: "burst", cancelFrame: 2, animationEndFrame: 2, cooldownFrames: 0, energyCost: 6,
        timelineState: { grants: [{ key: "q-state", label: "合成短状态", durationFrames: 20 }] } },
      { id: "r", actorId: "a", name: "要求状态的耗能动作", kind: "skill", cancelFrame: 2, animationEndFrame: 2, cooldownFrames: 0, energyCost: 1,
        timelineState: { requires: ["q-state"] } },
    ];
    config.timeline!.commands = [{ type: "burst", actorId: "a", abilityId: "q" }, { type: "skill", actorId: "a", abilityId: "r" }];
    const result = analyzeStochasticStartup(config, { sampleCount: 2, warmupCycles: 1 });
    for (const run of result.runs) for (const window of run.windows) {
      expect(window.actors.a).toMatchObject({ energyCostAttempts: 2, energyCostFailures: 2, insufficientEnergyFailures: 1, energyCostFailureRate: 1 });
    }
    expect(result.representativeResult.timelineExecution!.failures.map((entry) => entry.code)).toEqual([
      "INSUFFICIENT_ENERGY", "MISSING_REQUIRED_STATE", "INSUFFICIENT_ENERGY", "MISSING_REQUIRED_STATE", "INSUFFICIENT_ENERGY", "MISSING_REQUIRED_STATE",
    ]);
    expect(result.representativeResult.skippedActions).toHaveLength(3);
  });
});
