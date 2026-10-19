import { simulateWithStartup, solveEnergyRecharge, type ErSearchOptions } from "../../../packages/sim-core/src/simulation-analysis";
import type { SimConfig, SimulationOptions } from "@genshin-dps-lab/schemas";
import { analyzeStochasticStartup, type StochasticStartupPolicy } from "../../../packages/sim-core/src/stochastic-startup";

type AnalysisRequest = { kind: "energy"; config: SimConfig; options: ErSearchOptions } | { kind: "steady"; config: SimConfig; options: SimulationOptions; warmupCycles: number; warmupEnergyMode: "zero" | "full" | "configured" } | { kind: "stochastic"; config: SimConfig; options: SimulationOptions; policy: StochasticStartupPolicy };
self.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  try {
    if (event.data.kind === "stochastic") {
      const result = analyzeStochasticStartup(event.data.config, event.data.policy, event.data.options, {
        onProgress: progress => self.postMessage({ type: "progress", ...progress })
      });
      self.postMessage({ type: "stochastic", result });
      return;
    }
    if (event.data.kind === "steady") {
      const result = simulateWithStartup(event.data.config, { mode: "steady-state", maximumWarmupCycles: event.data.warmupCycles, warmupEnergyMode: event.data.warmupEnergyMode }, event.data.options);
      self.postMessage({ type: "startup", result });
      return;
    }
    const result = solveEnergyRecharge(event.data.config, event.data.options, {
      onProgress: ({ completed, total }) => self.postMessage({ type: "progress", completed, total })
    });
    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};
