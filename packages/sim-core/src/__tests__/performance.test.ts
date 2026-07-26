import { performance } from "node:perf_hooks";
import {
  durinMeltPreset,
  particleEnergyDemoPreset
} from "@genshin-dps-lab/game-data/presets";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";

describe("simulation performance", () => {
  it("stays below the first-stage 100 ms desktop target", () => {
    simulate(durinMeltPreset);
    const durations: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const start = performance.now();
      simulate(durinMeltPreset);
      durations.push(performance.now() - start);
    }
    const average =
      durations.reduce((sum, duration) => sum + duration, 0) /
      durations.length;
    const maximum = Math.max(...durations);
    console.info(
      `120s benchmark: avg=${average.toFixed(3)}ms max=${maximum.toFixed(3)}ms runs=${durations.length}`
    );
    expect(maximum).toBeLessThan(100);
  });

  it("keeps runtime-energy prefix probes below the 100 ms desktop target", () => {
    const config = structuredClone(particleEnergyDemoPreset);
    config.duration = 120;
    config.cycleLength = 120;
    simulate(config);
    const durations: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const start = performance.now();
      simulate(config);
      durations.push(performance.now() - start);
    }
    const average =
      durations.reduce((sum, duration) => sum + duration, 0) /
      durations.length;
    const maximum = Math.max(...durations);
    console.info(
      `120s runtime-energy benchmark: avg=${average.toFixed(3)}ms max=${maximum.toFixed(3)}ms runs=${durations.length}`
    );
    expect(maximum).toBeLessThan(100);
  });
});
