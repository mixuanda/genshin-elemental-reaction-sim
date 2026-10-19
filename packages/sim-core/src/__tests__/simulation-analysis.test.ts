import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { evaluatePhaseAlignedSteadyState, evaluateSimulationSteadyState, measureDamageWindow, solveEnergyRecharge, simulateWithStartup, repeatLegalTimelineForDuration, STEADY_STATE_DIMENSIONS, type PhaseCheckpoint, type PhaseAlignedState } from "../simulation-analysis";
import { applyBenchmarkProfile, compareSimulationSignatures, createComparisonSignature, KQMS_INSPIRED_BENCHMARK, LEGACY_ZERO_ENERGY_BENCHMARK, SIMULATION_DURATION_PRESETS, type ComparisonContext } from "../benchmark-profiles";
import { makeConfig } from "./fixtures";

function energyScenario() {
  return makeConfig({ duration: 2, cycleLength: 2, rotation: [], timeline: {
    mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 12,
    abilities: [
      { id: "e", actorId: "a", name: "合成产球", kind: "skill", cancelFrame: 2, animationEndFrame: 2, cooldownFrames: 0,
        particles: [{ id: "one-particle", element: "pyro", count: 1, spawnFrame: 0, travelFrames: 1 }] },
      { id: "q", actorId: "a", name: "合成耗能", kind: "burst", cancelFrame: 2, animationEndFrame: 2, cooldownFrames: 0, energyCost: 6,
        hits: [{ id: "q-hit", frame: 0, scaling: 1, element: "pyro" }] },
    ], commands: [{ type: "skill", actorId: "a", abilityId: "e" }, { type: "burst", actorId: "a", abilityId: "q" }],
  } });
}

const comparisonContext: ComparisonContext = {
  datasetChannel: "synthetic", evidence: "unchecked", snapshotId: "synthetic-test-1", benchmarkProfile: null,
  executionProfile: { id: "test-explicit-frames", version: "1", assumptions: ["synthetic"] },
  buildDescription: "synthetic manual panel", artifactInvestment: null, externalEnergyAssumptions: "none",
};

describe("versioned benchmark controls and comparison declarations", () => {
  it("retains the legacy user's exact controls without mutating the build or rotation length", () => {
    const original = energyScenario();
    const before = structuredClone(original);
    const applied = applyBenchmarkProfile(original, LEGACY_ZERO_ENERGY_BENCHMARK);
    expect(original).toEqual(before);
    expect(applied.config.duration).toBe(120);
    expect(applied.config.cycleLength).toBe(2);
    expect(applied.config.enemy).toEqual({ level: 110, resistance: 0.1, defReduction: 0 });
    expect(applied.options).toEqual({ energyMode: "zero", critMode: "average" });
    expect(applied.config.characters).toEqual(original.characters);
    expect(applied.config.timeline).toEqual(original.timeline);
    expect(applied.profile.externalParticles).toBe("none");
    expect(applied.profile.killParticles).toBe("none");
  });

  it("labels KQMS-inspired deviations and keeps all requested/custom window controls", () => {
    expect(SIMULATION_DURATION_PRESETS).toEqual([15, 18, 20, 60, 90, 120]);
    const applied = applyBenchmarkProfile(energyScenario(), KQMS_INSPIRED_BENCHMARK, 18);
    expect(applied.profile.compliance).toBe("KQMS-inspired/custom");
    expect(applied.config.enemy.level).toBe(100);
    expect(applied.options.energyMode).toBe("full");
    expect(applied.profile.deviations.join(" ")).toContain("1000");
    expect(applied.assumptions.join(" ")).toContain("18");
    expect(() => applyBenchmarkProfile(energyScenario(), LEGACY_ZERO_ENERGY_BENCHMARK, 0.001)).toThrow("整帧");
    const multiple = energyScenario();
    multiple.enemy.targets = [{ id: "a", name: "one" }, { id: "b", name: "two" }];
    expect(() => applyBenchmarkProfile(multiple, LEGACY_ZERO_ENERGY_BENCHMARK)).toThrow("不自动删除");
  });

  it("warns for different scenario inputs and excludes synthetic/preview from formal rankings", () => {
    const result = simulate(energyScenario());
    const first = createComparisonSignature(result, comparisonContext);
    expect(compareSimulationSignatures(first, createComparisonSignature(result, comparisonContext))).toMatchObject({ compatible: true, eligibleForVerifiedRanking: false });
    const second = createComparisonSignature(simulate(energyScenario(), { energyMode: "full", critMode: "allCrit" }), {
      ...comparisonContext, datasetChannel: "preview", snapshotId: "preview-v1",
    });
    const comparison = compareSimulationSignatures(first, second);
    expect(comparison.compatible).toBe(false);
    expect(comparison.eligibleForVerifiedRanking).toBe(false);
    expect(comparison.differences).toEqual(expect.arrayContaining(["datasetChannel", "snapshotId", "energyPolicy", "criticalPolicy"]));
    expect(first.fields.rng).toMatchObject({ sampled: expect.stringContaining("not critical hits") });
  });
});

describe("bounded ER analysis", () => {
  it("finds the exact grid minimum from shared particle distribution and verifies a safety margin", () => {
    const original = energyScenario();
    const answer = solveEnergyRecharge(original, { actorId: "a", minimumEr: 1, maximumEr: 3, step: 0.5, safetyMargin: 0.25 });
    expect(answer.status).toBe("feasible-on-grid");
    expect(answer.minimumFeasibleEr).toBe(2); // one same-element on-field particle: 3 × ER >= 6.
    expect(answer.recommendedEr).toBe(2.25);
    expect(answer.evaluated.map((item) => [item.energyRecharge, item.feasible])).toEqual([[1, false], [1.5, false], [2, true], [2.5, true], [3, true], [2.25, true]]);
    expect(answer.observedGridMonotonicity).toBe("monotone");
    expect(original.characters[0]!.stats.energyRecharge).toBe(1);
    expect(answer.method).toContain("no-monotonicity-assumption");
  });

  it("reports ER progress without allowing an observer to change numerical candidates", () => {
    const seen: number[] = [];
    const answer = solveEnergyRecharge(energyScenario(), { actorId: "a", minimumEr: 1, maximumEr: 2, step: 0.5 }, {
      onProgress(progress) { seen.push(progress.completed); if (progress.candidate) progress.candidate.feasible = false; },
    });
    expect(seen).toEqual([0, 1, 2, 3]);
    expect(answer.minimumFeasibleEr).toBe(2);
    expect(answer.evaluated[2]!.feasible).toBe(true);
  });

  it("keeps an observed absence of particles within the finite search claim", () => {
    const noParticles = energyScenario();
    noParticles.timeline!.abilities[0]!.particles = [];
    expect(solveEnergyRecharge(noParticles, { actorId: "a", minimumEr: 1, maximumEr: 2, step: 1 }).status).toBe("infeasible-within-bounds");
    const finite = solveEnergyRecharge(energyScenario(), { actorId: "a", minimumEr: 1, maximumEr: 1.5, step: 0.5 });
    expect(finite.status).toBe("infeasible-within-bounds");
    expect(finite.minimumFeasibleEr).toBeNull();
  });

  it("full is only initial energy and may not be used as an unlimited energy bypass", () => {
    const config = energyScenario();
    config.characters[0]!.energyMax = 6;
    config.timeline!.abilities[0]!.particles = [];
    config.timeline!.commands = [{ type: "burst", actorId: "a", abilityId: "q" }, { type: "burst", actorId: "a", abilityId: "q" }];
    const result = simulate(config, { energyMode: "full" });
    expect(result.actionLog).toHaveLength(1);
    expect(result.skippedActions).toHaveLength(1);
    expect(result.energyStats.a?.initial).toBe(6);
    expect(result.energyStats.a?.final).toBe(0);
  });

  it("fails closed on oversized searches, non-legal modes and undefined objectives", () => {
    expect(solveEnergyRecharge(energyScenario(), { actorId: "a", minimumEr: 1, maximumEr: 10, step: 0.01 }).status).toBe("blocked");
    expect(solveEnergyRecharge(makeConfig(), { actorId: "a", minimumEr: 1, maximumEr: 2, step: 1 }).status).toBe("blocked");
    const config = energyScenario();
    config.timeline!.commands = [{ type: "skill", actorId: "a", abilityId: "e" }];
    expect(solveEnergyRecharge(config, { actorId: "a", minimumEr: 1, maximumEr: 2, step: 1 }).reasons.join(" ")).toContain("未定义");
  });
});

describe("actual simulator startup and phase-aligned convergence", () => {
  it("runs full/zero/custom policies through the same engine and rejects incomplete custom maps", () => {
    const input = energyScenario();
    const zero = simulateWithStartup(input, { mode: "zero" });
    const full = simulateWithStartup(input, { mode: "full" });
    const custom = simulateWithStartup(input, { mode: "custom", energyByCharacter: { a: 3 } });
    expect(zero.status).toBe("completed");
    expect(zero.result!.energyStats.a!.initial).toBe(0);
    expect(zero.result!.skippedActions).toHaveLength(1);
    expect(full.result!.energyStats.a!.initial).toBe(60);
    expect(custom.result!.energyStats.a!.initial).toBe(3);
    expect(custom.result!.skippedActions).toHaveLength(0);
    expect(custom.startup.energyAtMeasurementStart).toEqual({ a: 3 });
    expect(simulateWithStartup(input, { mode: "custom", energyByCharacter: {} }).status).toBe("blocked");
    expect(input.characters[0]!.initialEnergy).toBe(0);
  });

  it("establishes an actual repeated particle/spend rotation without resetting state", () => {
    const input = energyScenario();
    input.characters[0]!.stats.energyRecharge = 2;
    input.characters[0]!.energyMax = 6;
    const actual = simulateWithStartup(input, { mode: "steady-state", maximumWarmupCycles: 6 });
    expect(actual.reasons).toEqual(expect.any(Array));
    expect(actual.status, JSON.stringify(actual.reasons)).toBe("steady-state-established");
    expect(actual.result!.executionAudit!.checkpointCoverage.complete).toBe(true);
    expect(actual.result!.executionAudit!.phaseCheckpoints).toHaveLength(5);
    expect(actual.steadyState!.periodCycles).toBe(1);
    expect(actual.startup).toMatchObject({ warmupTicks: 720, measurementStartTick: 720, measurementEndTick: 840, energyAtMeasurementStart: { a: 0 } });
    expect(actual.result!.particleEvents).toHaveLength(8);
    expect(actual.result!.energyStats.a!.initial).toBe(0);
    expect(actual.result!.energyStats.a!.spent).toBe(48);
    expect(actual.result!.skippedActions).toHaveLength(0);
    expect(actual.measurement!.includedDamageEventIds).toHaveLength(1);
    expect(actual.steadyState!.steadyStateDps).toBeCloseTo(actual.measurement!.dps, 12);
  });

  it("refuses actual stochastic/incomplete runs and does not reset the active character", () => {
    const random = energyScenario();
    random.timeline!.abilities[0]!.particles![0]!.count = { min: 1, max: 2 };
    const sampled = simulateWithStartup(random, { mode: "steady-state", maximumWarmupCycles: 6 });
    expect(sampled.status).toBe("steady-state-not-established");
    expect(sampled.steadyState!.steadyStateDps).toBeNull();
    expect(sampled.reasons.join()).toContain("随机");
    const differentActor = energyScenario();
    differentActor.characters.push({ ...structuredClone(differentActor.characters[0]!), id: "b", name: "B" });
    differentActor.timeline!.commands.push({ type: "swap", characterId: "b" });
    expect(() => repeatLegalTimelineForDuration(differentActor, 12)).toThrow("不能在边界偷偷重置");
    expect(simulateWithStartup(energyScenario(), { mode: "steady-state", maximumWarmupCycles: 301 }).status).toBe("blocked");
  });

  it("carries particles across cycle boundaries and preserves the genuine zero-energy startup failures", () => {
    const input = energyScenario();
    input.characters[0]!.stats.energyRecharge = 2;
    input.characters[0]!.energyMax = 6;
    input.timeline!.abilities[0]!.particles![0]!.travelFrames = 150;
    const actual = simulateWithStartup(input, { mode: "steady-state", maximumWarmupCycles: 6 });
    expect(actual.status, JSON.stringify(actual.reasons)).toBe("steady-state-established");
    expect(actual.result!.skippedActions.map((action) => action.frame)).toEqual([2, 122]);
    expect(actual.startup.simulationTicks).toBe(960); // two full future cycles prove repeating input and preserve in-flight particles.
    expect(actual.startup.measurementEndTick).toBe(840); // extra verification tail never enters requested DPS.
    expect(actual.startup.energyAtMeasurementStart).toEqual({ a: 6 });
    expect(actual.measurement!.includedDamageEventIds).toHaveLength(1);
    expect(actual.steadyState!.steadyStateDps).toBeCloseTo(actual.measurement!.dps, 12);
  });
});

describe("half-open fixed windows and honest steady state", () => {
  it("excludes the right endpoint and divides by the entire window including idle time", () => {
    const result = simulate(makeConfig({ duration: 3, cycleLength: 3, rotation: [{ id: "a", actorId: "a", name: "test", at: 0,
      hits: [0, 1, 2, 3].map((offset) => ({ id: `hit-${offset}`, offset, scaling: 1, element: "pyro" })) }] }));
    const window = measureDamageWindow(result, 0, 120);
    expect(window.includedDamageEventIds).toEqual(result.damageEvents.filter((event) => event.frame < 120).map((event) => event.id));
    expect(window.includedDamageEventIds).toHaveLength(2);
    expect(window.dps).toBe(window.totalDamage / 2);
    const idle = measureDamageWindow(result, 121, 180);
    expect(idle.totalDamage).toBe(0);
    expect(() => measureDamageWindow(result, 0, 181)).toThrow();
  });

  function state(energy: number): PhaseAlignedState {
    return { ...Object.fromEntries(STEADY_STATE_DIMENSIONS.map((dimension) => [dimension, []])), energy: { a: energy } } as PhaseAlignedState;
  }
  function checkpoints(values: number[]): PhaseCheckpoint[] {
    return values.map((value, cycle) => ({ tick: cycle * 60, cumulativeDamage: cycle * 100, state: state(value) }));
  }

  it("allows a genuine two-cycle period after checking every intervening phase and period damage", () => {
    const input = { checkpoints: checkpoints([0, 1, 0, 1, 0, 1, 0, 1, 0]), cycleTicks: 60, deterministic: true, checkpointProducer: "synthetic-complete-state-v1" };
    const evaluation = evaluatePhaseAlignedSteadyState(input);
    expect(evaluation.status).toBe("established-for-supplied-checkpoints");
    expect(evaluation.periodCycles).toBe(2);
    expect(evaluation.steadyStateDps).toBe(100);
    const drifting = structuredClone(input);
    drifting.checkpoints[8]!.state.resourcesAndHp = { hp: 99 };
    expect(evaluatePhaseAlignedSteadyState(drifting).status).toBe("not-established");
    const changingDamage = structuredClone(input);
    changingDamage.checkpoints[8]!.cumulativeDamage += 1;
    expect(evaluatePhaseAlignedSteadyState(changingDamage).status).toBe("not-established");
  });

  it("refuses missing, stochastic, misaligned or insufficient checkpoints instead of trusting loop count", () => {
    const input = { checkpoints: checkpoints([0, 0, 0, 0, 0]), cycleTicks: 60, deterministic: true, checkpointProducer: "synthetic-v1" };
    expect(evaluatePhaseAlignedSteadyState(input).periodCycles).toBe(1);
    expect(evaluatePhaseAlignedSteadyState({ ...input, deterministic: false }).status).toBe("not-established");
    expect(evaluatePhaseAlignedSteadyState({ ...input, maximumWarmupCycles: 2 }).status).toBe("not-established");
    expect(evaluatePhaseAlignedSteadyState({ ...input, maximumPeriodCycles: Number.MAX_SAFE_INTEGER }).status).toBe("not-established");
    input.checkpoints[1]!.tick += 1;
    expect(evaluatePhaseAlignedSteadyState(input).status).toBe("not-established");
    const missing = { ...input, checkpoints: checkpoints([0, 0, 0, 0, 0]) };
    delete (missing.checkpoints[0]!.state as Partial<PhaseAlignedState>).entities;
    expect(evaluatePhaseAlignedSteadyState(missing).status).toBe("not-established");
    expect(evaluateSimulationSteadyState(simulate(energyScenario()))).toMatchObject({ status: "not-established", steadyStateDps: null });
  });
});
