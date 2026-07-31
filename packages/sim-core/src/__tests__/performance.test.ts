import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  durinMeltPreset,
  particleEnergyDemoPreset
} from "@genshin-dps-lab/game-data/presets";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const PERFORMANCE_RUNS = 21;
const DESKTOP_TARGET_MS = 100;
const PATHOLOGICAL_OUTLIER_CEILING_MS = 250;

interface TimingSummary {
  average: number;
  median: number;
  p95: number;
  maximum: number;
}

function percentile(
  sortedDurations: readonly number[],
  percentileValue: number
): number {
  const rank = Math.ceil(
    percentileValue * sortedDurations.length
  );
  return sortedDurations[Math.max(0, rank - 1)]!;
}

function summarizeDurations(
  durations: readonly number[]
): TimingSummary {
  const sortedDurations = [...durations].sort(
    (left, right) => left - right
  );
  const middle = Math.floor(sortedDurations.length / 2);
  const median =
    sortedDurations.length % 2 === 0
      ? (sortedDurations[middle - 1]! +
          sortedDurations[middle]!) /
        2
      : sortedDurations[middle]!;
  return {
    average:
      durations.reduce((sum, duration) => sum + duration, 0) /
      durations.length,
    median,
    p95: percentile(sortedDurations, 0.95),
    maximum: sortedDurations.at(-1)!
  };
}

function expectDesktopPerformance(
  summary: TimingSummary
): void {
  // Wall-clock maxima are sensitive to scheduler pauses. The median measures
  // the typical desktop run against the product target, while the independent
  // ceiling still catches a pathological stall instead of hiding it.
  expect(summary.median).toBeLessThan(DESKTOP_TARGET_MS);
  expect(summary.maximum).toBeLessThan(
    PATHOLOGICAL_OUTLIER_CEILING_MS
  );
}

function formatTimingSummary(summary: TimingSummary): string {
  return (
    `avg=${summary.average.toFixed(3)}ms ` +
    `median=${summary.median.toFixed(3)}ms ` +
    `p95=${summary.p95.toFixed(3)}ms ` +
    `max=${summary.maximum.toFixed(3)}ms`
  );
}

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function makeSustainedBurningPerformanceConfig(): SimConfig {
  const base = makeConfig();
  const refreshHits = Array.from(
    { length: 119 },
    (_, index) => ({
      id: `dendro-refresh-${index + 1}`,
      label: `Dendro refresh ${index + 1}`,
      frame: (index + 1) * 60,
      scaling: 0,
      element: "dendro" as const,
      targeting: {
        targetId: "enemy-0",
        outcome: "landed" as const
      },
      application: {
        gaugeUnits: 1,
        icdTag: `burning-refresh-${index + 1}`,
        icdGroup: "no-icd" as const
      }
    })
  );
  return {
    ...base,
    dataVersion: "burning-performance-1",
    randomSeed: "burning-performance-seed",
    duration: 120,
    cycleLength: 120,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "持续燃烧性能目标",
          position: { x: 0, y: 0 },
          initialAura: [
            {
              element: "dendro",
              gaugeUnits: 2
            }
          ]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "pyro",
        name: "Burning Performance",
        element: "pyro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0,
          em: 100,
          reactionBonus: 0.2
        }
      }
    ],
    rotation: [],
    reactionEngine: {
      mode: "aura-v4"
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "pyro",
      swapFrames: 12,
      abilities: [
        {
          id: "burning-maintenance",
          actorId: "pyro",
          name: "120s Burning Maintenance",
          kind: "skill",
          cancelFrame: 7141,
          animationEndFrame: 7141,
          cooldownFrames: 0,
          hits: [
            {
              id: "pyro-start",
              label: "Pyro start",
              frame: 0,
              scaling: 0,
              element: "pyro",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed"
              },
              application: {
                gaugeUnits: 1,
                icdTag: "burning-performance-start",
                icdGroup: "no-icd"
              }
            },
            ...refreshHits
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "pyro",
          abilityId: "burning-maintenance"
        }
      ]
    }
  };
}

describe("simulation performance", () => {
  it("stays below the first-stage 100 ms desktop target", () => {
    simulate(durinMeltPreset);
    const durations: number[] = [];
    for (let index = 0; index < PERFORMANCE_RUNS; index += 1) {
      const start = performance.now();
      simulate(durinMeltPreset);
      durations.push(performance.now() - start);
    }
    const summary = summarizeDurations(durations);
    process.stdout.write(
      `120s benchmark: ${formatTimingSummary(summary)} runs=${durations.length}\n`
    );
    expectDesktopPerformance(summary);
  });

  it("keeps runtime-energy prefix probes below the 100 ms desktop target", () => {
    const config = structuredClone(particleEnergyDemoPreset);
    config.duration = 120;
    config.cycleLength = 120;
    simulate(config);
    const durations: number[] = [];
    for (let index = 0; index < PERFORMANCE_RUNS; index += 1) {
      const start = performance.now();
      simulate(config);
      durations.push(performance.now() - start);
    }
    const summary = summarizeDurations(durations);
    process.stdout.write(
      `120s runtime-energy benchmark: ${formatTimingSummary(summary)} runs=${durations.length}\n`
    );
    expectDesktopPerformance(summary);
  });

  it("keeps a sustained 120s Burning refresh stream below the 100 ms desktop target", () => {
    const config = makeSustainedBurningPerformanceConfig();
    const probe = simulate(config, { critMode: "noCrit" });
    const burningTicks = probe.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "burning"
    );
    const fuelRefreshes = probe.burningStateLog.filter(
      (entry) => entry.operation === "refresh-fuel"
    );
    const targetStateTimelinePoints =
      probe.targetStateTimeline.points;
    const sustainedOutputHash = sha256({
      totalDamage: probe.totalDamage,
      dps: probe.dps,
      damageEvents: probe.damageEvents,
      burningStateLog: probe.burningStateLog,
      quickenStateLog: probe.quickenStateLog,
      targetStateTimeline: probe.targetStateTimeline
    });

    expect(burningTicks).toHaveLength(479);
    expect(fuelRefreshes).toHaveLength(119);
    expect(targetStateTimelinePoints).toHaveLength(1198);
    expect(probe.quickenStateLog).toEqual([]);
    expect(sustainedOutputHash).toBe(
      "d26177a6c34306f895fe385a8d6452037ef0fc125545becf833f34134fe3fc65"
    );
    expect(
      targetStateTimelinePoints.every(
        (point) =>
          point.auraBefore.every(
            (entry) => entry.element !== "quicken"
          ) &&
          point.auraAfter.every(
            (entry) => entry.element !== "quicken"
          )
      )
    ).toBe(true);
    expect(probe.targetStateTimeline.version).toBe("1.0.0");
    expect(targetStateTimelinePoints.length).toBeGreaterThan(
      burningTicks.length
    );
    expect(
      targetStateTimelinePoints.map((point) => point.id)
    ).toEqual(
      Array.from(
        { length: targetStateTimelinePoints.length },
        (_, index) => index
      )
    );

    const durations: number[] = [];
    for (let index = 0; index < PERFORMANCE_RUNS; index += 1) {
      const start = performance.now();
      simulate(config, { critMode: "noCrit" });
      durations.push(performance.now() - start);
    }
    const summary = summarizeDurations(durations);
    process.stdout.write(
      `120s sustained-Burning benchmark: ticks=${burningTicks.length} refreshes=${fuelRefreshes.length} targetStatePoints=${targetStateTimelinePoints.length} hash=${sustainedOutputHash} ${formatTimingSummary(summary)} runs=${durations.length}\n`
    );
    expectDesktopPerformance(summary);
  });
});
