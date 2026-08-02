import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  durinMeltPreset,
  particleEnergyDemoPreset
} from "@genshin-dps-lab/game-data/presets";
import {
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT
} from "@genshin-dps-lab/icd-profiles";
import type {
  SimConfig,
  SimulationResult
} from "@genshin-dps-lab/schemas";
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

const POST_V146_DAMAGE_EVENT_WIRE_ONLY_FIELDS = new Set([
  "applicationIcdDecision",
  "applicationIcdLogId",
  "elementalApplicationIcdLogId",
  "applicationMultiplier",
  "nominalApplicationGaugeUnits",
  "effectiveApplicationGaugeUnits"
]);

interface FrozenV146ReactionAuditOverride {
  icdAllowed: boolean;
  icdTag: string;
  icdGroup: "no-icd" | "burning";
  applicationGaugeUnits?: number;
  note?: string;
}

/** Keep the sustained-Burning performance sentinel on frozen 1.46 semantics. */
function projectDamageEventsToFrozenV146(
  result: SimulationResult
): unknown[] {
  const frozenV146AuditByDamageEventId = new Map<
    number,
    FrozenV146ReactionAuditOverride
  >(
    result.elementalApplicationIcdLog.flatMap(
      (
        entry
      ): Array<
        readonly [number, FrozenV146ReactionAuditOverride]
      > => {
        if (entry.damageEventId === null) {
          return [];
        }
        if (entry.sourceKind === "burning-tick") {
          return [
            [
              entry.damageEventId,
              {
                icdAllowed: entry.decision.allowed,
                icdTag: "burning-application",
                icdGroup: "burning",
                applicationGaugeUnits: entry.nominalGaugeUnits,
                note:
                  "燃烧范围传播：先以 1U 附着处理目标 Aura 与二次反应，再结算不暴击、无视防御的扩散伤害。"
              }
            ] as const
          ];
        }
        if (entry.selector.mode !== "no-icd-v1") return [];
        const legacyIcdTag =
          entry.hitId === "pyro-start"
            ? "burning-performance-start"
            : entry.hitId.startsWith("dendro-refresh-")
              ? entry.hitId.replace(
                  "dendro-refresh-",
                  "burning-refresh-"
                )
              : null;
        if (legacyIcdTag === null) {
          throw new Error(
            `Unknown sustained-Burning hit ${entry.hitId} in frozen performance projection.`
          );
        }
        return [
          [
            entry.damageEventId,
            {
              icdAllowed: entry.decision.allowed,
              icdTag: legacyIcdTag,
              icdGroup: "no-icd"
            }
          ] as const
        ];
      }
    )
  );
  return result.damageEvents.map((event) => {
    const withoutApplicationAudit = Object.fromEntries(
      Object.entries(event).filter(
        ([key]) => !POST_V146_DAMAGE_EVENT_WIRE_ONLY_FIELDS.has(key)
      )
    );
    const reactionAudit = event.reactionAudit;
    const legacyAudit = frozenV146AuditByDamageEventId.get(
      event.id
    );
    return reactionAudit === null || legacyAudit === undefined
      ? withoutApplicationAudit
      : {
          ...withoutApplicationAudit,
          reactionAudit: Object.fromEntries(
            [
              ...Object.entries(reactionAudit).filter(
                ([key]) =>
                  !POST_V146_DAMAGE_EVENT_WIRE_ONLY_FIELDS.has(key)
              ),
              ...Object.entries(legacyAudit)
            ]
          )
        };
  });
}

function makeSustainedBurningPerformanceConfig(): SimConfig {
  const base = makeConfig({
    reactionOwnedElementalApplicationModel: {
      mode: "fixed-gcsim-reaction-owned-application-v1",
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID
    }
  });
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
        icd: { mode: "no-icd-v1" as const }
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
                icd: { mode: "no-icd-v1" }
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
    const burningApplications =
      probe.elementalApplicationIcdLog.filter(
        (entry) => entry.sourceKind === "burning-tick"
      );
    const allowedBurningApplications = burningApplications.filter(
      (entry) => entry.decision.allowed
    );
    const blockedBurningApplications = burningApplications.filter(
      (entry) => !entry.decision.allowed
    );
    const burningApplicationHash = sha256(burningApplications);
    const sustainedOutputHash = sha256({
      totalDamage: probe.totalDamage,
      dps: probe.dps,
      damageEvents: projectDamageEventsToFrozenV146(probe),
      burningStateLog: probe.burningStateLog,
      quickenStateLog: probe.quickenStateLog,
      targetStateTimeline: probe.targetStateTimeline
    });

    process.stdout.write(
      `120s sustained-Burning output probe: totalDamage=${probe.totalDamage} dps=${probe.dps} ticks=${burningTicks.length} applications=${burningApplications.length} allowedApplications=${allowedBurningApplications.length} blockedApplications=${blockedBurningApplications.length} applicationHash=${burningApplicationHash} frozenV146ProjectionHash=${sustainedOutputHash}\n`
    );

    expect(burningTicks).toHaveLength(479);
    expect(burningApplications).toHaveLength(479);
    expect(allowedBurningApplications).toHaveLength(60);
    expect(blockedBurningApplications).toHaveLength(419);
    expect(burningApplicationHash).toBe(
      "60b3b32508e8dab91a95bf2f8e8dc455171dc7bc2e0534927d9a987a0a32e011"
    );
    expect(fuelRefreshes).toHaveLength(119);
    expect(targetStateTimelinePoints).toHaveLength(1198);
    expect(probe.quickenStateLog).toEqual([]);
    expect(
      config.reactionOwnedElementalApplicationModel
    ).toEqual({
      mode: "fixed-gcsim-reaction-owned-application-v1",
      policyId: GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID
    });
    expect(
      probe.runManifest.reactionOwnedElementalApplicationRoot
    ).toEqual(GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ROOT);
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
