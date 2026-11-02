import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../../docs/fixtures/ec-event-steps.synthetic.json";
import { migrateConfig } from "@genshin-dps-lab/schemas";
import * as simulator from "../simulator";
import { parseEventStepResult, simulateEventStepResult } from "../event-step-result";
import {
  getSimulationAnalysisCapability,
  measureDamageWindow,
  repeatLegalTimelineForDuration,
  simulateWithStartup,
  solveEnergyRecharge,
  type SimulationStartupPolicy,
} from "../simulation-analysis";
import { analyzeStochasticStartup } from "../stochastic-startup";

const BLOCKED = "EVENT_STEP_ANALYSIS_UNSUPPORTED";
const input = () => migrateConfig(structuredClone(fixture));
afterEach(() => vi.restoreAllMocks());

describe("nearby-Wet analysis capability at real public entrypoints", () => {
  it("reports the unsupported analysis contract without disabling ordinary witnessed simulation or window measurement", () => {
    const config = input();
    expect(getSimulationAnalysisCapability(config)).toMatchObject({
      supported: false, code: BLOCKED,
      message: expect.stringContaining("运行模拟"),
    });
    const current = simulateEventStepResult(config, {critMode: "noCrit"});
    expect(parseEventStepResult(JSON.parse(JSON.stringify(current.wire))).result).toEqual(current.result);
    const measured = measureDamageWindow(current.result, 0, 60);
    expect(measured.totalDamage).toBe(current.result.totalDamage);
    expect(measured.includedDamageEventIds).toEqual(current.result.damageEvents.map(event => event.id));
    expect(current.wire.result.schemaVersion).toBe("1.54.0-event-steps");
  });

  const policies: SimulationStartupPolicy[] = [
    {mode: "configured"}, {mode: "zero"}, {mode: "full"},
    {mode: "custom", energyByCharacter: {"ec-owner": 60}},
    {mode: "steady-state", maximumWarmupCycles: 1},
  ];
  it.each(policies)("blocks $mode startup before simulation without inventing a result, measurement or steady-state claim", policy => {
    const config = input(), before = structuredClone(config);
    const engine = vi.spyOn(simulator, "simulate"); // Observe, never replace engine output.
    const result = simulateWithStartup(config, policy, {critMode: "noCrit"});
    expect(result).toMatchObject({status: "blocked", result: null, measurement: null, steadyState: null});
    expect(result.reasons.join(" ")).toContain(BLOCKED);
    expect(result.reasons.join(" ")).toContain("测量窗口");
    expect(result.reasons.join(" ")).not.toContain("Trusted reaction-delivery");
    expect(result.startup.startupActionCount).toBe(0);
    expect(engine).not.toHaveBeenCalled();
    expect(config).toEqual(before);
  });

  it("blocks a genuine energy-cost ER request before evaluating any candidate or reporting progress", () => {
    const config = input();
    config.timeline!.abilities[0]!.energyCost = 10;
    config.characters[0]!.initialEnergy = 60;
    const before = structuredClone(config);
    const ordinary = simulateEventStepResult(config, {energyMode: "full", critMode: "noCrit"});
    expect(ordinary.result.energyStats["ec-owner"]!.spent).toBe(10);
    const engine = vi.spyOn(simulator, "simulate"), progress = vi.fn();
    const result = solveEnergyRecharge(config, {
      actorId: "ec-owner", minimumEr: 1, maximumEr: 2, step: 0.5,
      runtimeOptions: {energyMode: "full", critMode: "noCrit"},
    }, {onProgress: progress});
    expect(result).toMatchObject({status: "blocked", evaluated: [], minimumFeasibleEr: null, recommendedEr: null});
    expect(result.reasons.join(" ")).toContain(BLOCKED);
    expect(result).not.toHaveProperty("independentFailureProof");
    expect(engine).not.toHaveBeenCalled();
    expect(progress).not.toHaveBeenCalled();
    expect(config).toEqual(before);
  });

  it("retains the earlier undefined-ER explanation when there is no energy-cost action", () => {
    const engine = vi.spyOn(simulator, "simulate");
    const result = solveEnergyRecharge(input(), {actorId: "ec-owner", minimumEr: 1, maximumEr: 1, step: 1});
    expect(result.status).toBe("blocked");
    expect(result.reasons.join(" ")).toContain("最小ER问题未定义");
    expect(engine).not.toHaveBeenCalled();
  });

  it("rejects stochastic analysis before any sample, partial distribution or progress is produced", () => {
    const config = input(), before = structuredClone(config);
    const engine = vi.spyOn(simulator, "simulate"), progress = vi.fn();
    expect(() => analyzeStochasticStartup(config, {sampleCount: 2, warmupCycles: 1},
      {critMode: "noCrit"}, {onProgress: progress})).toThrow(BLOCKED);
    expect(engine).not.toHaveBeenCalled();
    expect(progress).not.toHaveBeenCalled();
    expect(config).toEqual(before);
  });

  it("allows structural repetition but blocks a runtime-cooldown template before its hidden baseline simulation", () => {
    const config = input();
    const repeated = repeatLegalTimelineForDuration(config, 2);
    expect(repeated.duration).toBe(2);
    config.timeline!.abilities[0]!.cooldownStartFrame = 0;
    const engine = vi.spyOn(simulator, "simulate");
    expect(() => repeatLegalTimelineForDuration(config, 2)).toThrow(BLOCKED);
    expect(engine).not.toHaveBeenCalled();
  });

  it("does not block the existing single-target EC startup contract", () => {
    const config = input();
    config.electroChargedPropagationModel = {mode: "single-target-v1"};
    expect(getSimulationAnalysisCapability(config)).toEqual({supported: true});
    const result = simulateWithStartup(config, {mode: "configured"}, {critMode: "noCrit"});
    expect(result.status, result.reasons.join(" ")).toBe("completed");
    expect(result.result).not.toBeNull();
    expect(result.measurement!.totalDamage).toBe(result.result!.totalDamage);
  });
});
