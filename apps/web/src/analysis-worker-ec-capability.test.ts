import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../docs/fixtures/ec-event-steps.synthetic.json";
import { migrateConfig } from "@genshin-dps-lab/schemas";

// Execute the production message handler, not a reimplementation of its routing.
const postMessage = vi.fn();
const workerScope = {
  onmessage: null as ((event: MessageEvent<unknown>) => void) | null,
  postMessage,
};
beforeAll(async () => {
  vi.stubGlobal("self", workerScope);
  await import("./analysis-worker");
});
beforeEach(() => postMessage.mockClear());
afterAll(() => vi.unstubAllGlobals());

describe("analysis worker preserves fail-closed nearby-Wet capability results", () => {
  it("returns an explicit blocked steady-startup response, not a partial result", () => {
    workerScope.onmessage!({data: {kind: "steady", config: migrateConfig(fixture),
      options: {critMode: "noCrit"}, warmupCycles: 1, warmupEnergyMode: "configured"}} as MessageEvent);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0]![0]).toMatchObject({type: "startup", result: {
      status: "blocked", result: null, measurement: null, steadyState: null,
      reasons: [expect.stringContaining("EVENT_STEP_ANALYSIS_UNSUPPORTED")],
    }});
  });

  it("returns an actionable stochastic error before any progress or completed samples", () => {
    workerScope.onmessage!({data: {kind: "stochastic", config: migrateConfig(fixture),
      options: {critMode: "noCrit"}, policy: {sampleCount: 2, warmupCycles: 1}}} as MessageEvent);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0]![0]).toEqual({type: "error", message: expect.stringContaining("EVENT_STEP_ANALYSIS_UNSUPPORTED")});
    expect(postMessage.mock.calls[0]![0].message).toContain("运行模拟");
  });

  it("returns blocked ER for an actual cost-bearing action without claiming infeasibility or evaluating a grid", () => {
    const config = migrateConfig(fixture);
    config.timeline!.abilities[0]!.energyCost = 10;
    config.characters[0]!.initialEnergy = 60;
    workerScope.onmessage!({data: {kind: "energy", config, options: {
      actorId: "ec-owner", minimumEr: 1, maximumEr: 2, step: 0.5,
      runtimeOptions: {energyMode: "full", critMode: "noCrit"},
    }}} as MessageEvent);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0]![0]).toMatchObject({type: "result", result: {
      status: "blocked", evaluated: [], minimumFeasibleEr: null, recommendedEr: null,
      reasons: [expect.stringContaining("EVENT_STEP_ANALYSIS_UNSUPPORTED")],
    }});
  });
});
