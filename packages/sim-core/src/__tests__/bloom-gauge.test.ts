import { describe, expect, it } from "vitest";
import {
  BLOOM_GAUGE_EPSILON,
  resolveBloomGauge,
  type BloomGaugeInput,
  type BloomGaugeSlots
} from "../bloom-gauge";

const BASE_GAUGES: BloomGaugeSlots = {
  dendro: 0,
  quicken: 0,
  burningFuel: 0,
  hydro: 0
};

function input(
  overrides: Partial<BloomGaugeInput> = {}
): BloomGaugeInput {
  return {
    frame: 120,
    triggerElement: "hydro",
    incomingGauge: 1,
    gauges: BASE_GAUGES,
    runQuickenHydroFollowup: false,
    ...overrides
  };
}

describe("resolveBloomGauge", () => {
  it("reduces every Dendro-mapped slot but spends only the largest normalized Hydro gauge", () => {
    const result = resolveBloomGauge(
      input({
        gauges: {
          dendro: 0.2,
          quicken: 0.1,
          burningFuel: 0.4,
          hydro: 0.7
        }
      })
    );

    expect(result).toMatchObject({
      incomingGaugeBefore: 1,
      incomingGaugeConsumed: 0.8,
      incomingGaugeAfter: 0.2,
      createdCoreCount: 1,
      gaugesAfter: {
        dendro: 0,
        quicken: 0,
        burningFuel: 0,
        hydro: 0.7
      }
    });
    expect(result.resolutions).toEqual([
      expect.objectContaining({
        frame: 120,
        order: 0,
        kind: "direct",
        triggerElement: "hydro",
        auraConsumptionFactor: 0.5,
        driver: {
          kind: "incoming",
          gaugeBefore: 1,
          consumedGauge: 0.8,
          gaugeAfter: 0.2
        },
        gaugeConsumedBySlot: {
          dendro: 0.2,
          quicken: 0.1,
          burningFuel: 0.4,
          hydro: 0
        },
        createsCore: true
      })
    ]);
    expect(
      result.resolutions[0]?.incomingGaugeConsumed
    ).not.toBe(1.4);
  });

  it("caps each Hydro-triggered mapped-slot reduction at factor 0.5", () => {
    const result = resolveBloomGauge(
      input({
        incomingGauge: 1,
        gauges: {
          dendro: 3,
          quicken: 2,
          burningFuel: 4,
          hydro: 0
        }
      })
    );

    expect(
      result.resolutions[0]?.gaugeConsumedBySlot
    ).toEqual({
      dendro: 0.5,
      quicken: 0.5,
      burningFuel: 0.5,
      hydro: 0
    });
    expect(result.incomingGaugeAfter).toBe(0);
    expect(result.gaugesAfter).toEqual({
      dendro: 2.5,
      quicken: 1.5,
      burningFuel: 3.5,
      hydro: 0
    });
  });

  it("uses factor 2 for a Dendro-triggered direct Bloom", () => {
    const full = resolveBloomGauge(
      input({
        triggerElement: "dendro",
        incomingGauge: 0.8,
        gauges: { ...BASE_GAUGES, hydro: 1.8 }
      })
    );
    const partial = resolveBloomGauge(
      input({
        triggerElement: "dendro",
        incomingGauge: 0.8,
        gauges: { ...BASE_GAUGES, hydro: 0.5 }
      })
    );

    expect(full).toMatchObject({
      incomingGaugeConsumed: 0.8,
      incomingGaugeAfter: 0,
      gaugesAfter: { hydro: 0.2 },
      createdCoreCount: 1
    });
    expect(full.resolutions[0]).toMatchObject({
      auraConsumptionFactor: 2,
      gaugeConsumedBySlot: { hydro: 1.6 }
    });
    expect(partial).toMatchObject({
      incomingGaugeConsumed: 0.25,
      incomingGaugeAfter: 0.55,
      gaugesAfter: { hydro: 0 },
      createdCoreCount: 1
    });
  });

  it("returns no resolution and preserves gauges when no compatible aura exists", () => {
    const hydro = resolveBloomGauge(
      input({
        incomingGauge: 0.75,
        gauges: { ...BASE_GAUGES, hydro: 1 }
      })
    );
    const dendro = resolveBloomGauge(
      input({
        triggerElement: "dendro",
        incomingGauge: 0.75,
        gauges: { ...BASE_GAUGES, dendro: 1 }
      })
    );

    expect(hydro).toMatchObject({
      incomingGaugeConsumed: 0,
      incomingGaugeAfter: 0.75,
      createdCoreCount: 0,
      resolutions: []
    });
    expect(hydro.gaugesAfter).toEqual(hydro.gaugesBefore);
    expect(dendro).toMatchObject({
      incomingGaugeConsumed: 0,
      incomingGaugeAfter: 0.75,
      createdCoreCount: 0,
      resolutions: []
    });
    expect(dendro.gaugesAfter).toEqual(dendro.gaugesBefore);
  });

  it("orders direct Bloom before an explicitly queued same-frame Quicken follow-up", () => {
    const result = resolveBloomGauge(
      input({
        frame: 240,
        triggerElement: "dendro",
        incomingGauge: 0.2,
        gauges: {
          ...BASE_GAUGES,
          quicken: 0.4,
          hydro: 1.5
        },
        runQuickenHydroFollowup: true
      })
    );

    expect(
      result.resolutions.map(
        ({
          order,
          kind,
          driver,
          incomingGaugeConsumed,
          gaugeConsumedBySlot
        }) => ({
          order,
          kind,
          driver,
          incomingGaugeConsumed,
          gaugeConsumedBySlot
        })
      )
    ).toEqual([
      {
        order: 0,
        kind: "direct",
        driver: {
          kind: "incoming",
          gaugeBefore: 0.2,
          consumedGauge: 0.2,
          gaugeAfter: 0
        },
        incomingGaugeConsumed: 0.2,
        gaugeConsumedBySlot: {
          dendro: 0,
          quicken: 0,
          burningFuel: 0,
          hydro: 0.4
        }
      },
      {
        order: 1,
        kind: "quicken-followup",
        driver: {
          kind: "quicken",
          gaugeBefore: 0.4,
          consumedGauge: 0.4,
          gaugeAfter: 0
        },
        incomingGaugeConsumed: 0,
        gaugeConsumedBySlot: {
          dendro: 0,
          quicken: 0.4,
          burningFuel: 0,
          hydro: 0.8
        }
      }
    ]);
    expect(result).toMatchObject({
      frame: 240,
      incomingGaugeConsumed: 0.2,
      incomingGaugeAfter: 0,
      gaugesAfter: {
        dendro: 0,
        quicken: 0,
        burningFuel: 0,
        hydro: 0.3
      },
      createdCoreCount: 2
    });
  });

  it("partially spends Quicken when the follow-up has less Hydro remaining", () => {
    const result = resolveBloomGauge(
      input({
        triggerElement: "dendro",
        incomingGauge: 0.1,
        gauges: {
          ...BASE_GAUGES,
          quicken: 1,
          hydro: 0.3
        },
        runQuickenHydroFollowup: true
      })
    );

    expect(result.resolutions).toHaveLength(2);
    expect(result.resolutions[1]).toMatchObject({
      kind: "quicken-followup",
      driver: {
        kind: "quicken",
        gaugeBefore: 1,
        consumedGauge: 0.05,
        gaugeAfter: 0.95
      },
      gaugeConsumedBySlot: {
        quicken: 0.05,
        hydro: 0.1
      },
      incomingGaugeConsumed: 0
    });
    expect(result.gaugesAfter).toEqual({
      dendro: 0,
      quicken: 0.95,
      burningFuel: 0,
      hydro: 0
    });
  });

  it("never infers the Quicken follow-up merely from coexisting slots", () => {
    const result = resolveBloomGauge(
      input({
        triggerElement: "dendro",
        incomingGauge: 0.1,
        gauges: {
          ...BASE_GAUGES,
          quicken: 1,
          hydro: 1
        },
        runQuickenHydroFollowup: false
      })
    );

    expect(
      result.resolutions.map((resolution) => resolution.kind)
    ).toEqual(["direct"]);
    expect(result.gaugesAfter).toEqual({
      dendro: 0,
      quicken: 1,
      burningFuel: 0,
      hydro: 0.8
    });
  });

  it("cleans floating-point residue and preserves subtraction invariants", () => {
    const cases: BloomGaugeInput[] = [
      input({
        triggerElement: "dendro",
        incomingGauge: 0.1,
        gauges: {
          ...BASE_GAUGES,
          hydro: 0.20000000000004
        }
      }),
      input({
        incomingGauge: 0.3,
        gauges: {
          ...BASE_GAUGES,
          dendro: 0.10000000000004,
          quicken: 0.15,
          burningFuel: 0.07
        }
      }),
      input({
        incomingGauge: BLOOM_GAUGE_EPSILON / 2,
        gauges: { ...BASE_GAUGES, dendro: 1 }
      })
    ];

    for (const sample of cases) {
      const result = resolveBloomGauge(sample);
      expect(
        result.incomingGaugeBefore -
          result.incomingGaugeConsumed
      ).toBeCloseTo(result.incomingGaugeAfter, 12);
      for (const resolution of result.resolutions) {
        for (const key of Object.keys(
          resolution.gaugesBefore
        ) as (keyof BloomGaugeSlots)[]) {
          expect(
            resolution.gaugeConsumedBySlot[key]
          ).toBeGreaterThanOrEqual(0);
          expect(
            resolution.gaugeConsumedBySlot[key]
          ).toBeLessThanOrEqual(
            resolution.gaugesBefore[key]
          );
          expect(
            resolution.gaugesBefore[key] -
              resolution.gaugeConsumedBySlot[key]
          ).toBeCloseTo(resolution.gaugesAfter[key], 12);
        }
      }
      for (const gauge of Object.values(result.gaugesAfter)) {
        expect(gauge).toBeGreaterThanOrEqual(0);
      }
    }

    expect(resolveBloomGauge(cases[0]!)).toMatchObject({
      incomingGaugeAfter: 0,
      gaugesAfter: { hydro: 0 }
    });
    expect(resolveBloomGauge(cases[2]!)).toMatchObject({
      incomingGaugeBefore: 0,
      incomingGaugeConsumed: 0,
      incomingGaugeAfter: 0,
      resolutions: []
    });
  });

  it("preserves every gauge invariant across a deterministic numeric matrix", () => {
    const gaugeValues = [
      0,
      BLOOM_GAUGE_EPSILON / 2,
      0.05,
      0.1,
      0.3333333333333,
      0.8,
      1,
      4
    ];

    for (const triggerElement of [
      "hydro",
      "dendro"
    ] as const) {
      for (const incomingGauge of gaugeValues) {
        for (const dendro of gaugeValues) {
          for (const opposingGauge of gaugeValues) {
            const result = resolveBloomGauge(
              input({
                triggerElement,
                incomingGauge,
                gauges: {
                  dendro,
                  quicken:
                    triggerElement === "hydro"
                      ? opposingGauge
                      : dendro / 2,
                  burningFuel:
                    triggerElement === "hydro"
                      ? dendro / 3
                      : 0,
                  hydro:
                    triggerElement === "dendro"
                      ? opposingGauge
                      : 0.25
                },
                runQuickenHydroFollowup:
                  triggerElement === "dendro"
              })
            );

            expect(result.createdCoreCount).toBe(
              result.resolutions.length
            );
            expect(
              result.incomingGaugeBefore -
                result.incomingGaugeConsumed
            ).toBeCloseTo(result.incomingGaugeAfter, 12);
            expect(result.incomingGaugeConsumed).toBeGreaterThanOrEqual(
              0
            );
            expect(result.incomingGaugeConsumed).toBeLessThanOrEqual(
              result.incomingGaugeBefore
            );

            let previousGauges = result.gaugesBefore;
            for (const [order, resolution] of
              result.resolutions.entries()) {
              expect(resolution.order).toBe(order);
              expect(resolution.createsCore).toBe(true);
              expect(resolution.gaugesBefore).toEqual(
                previousGauges
              );
              expect(
                resolution.driver.gaugeBefore -
                  resolution.driver.consumedGauge
              ).toBeCloseTo(
                resolution.driver.gaugeAfter,
                12
              );
              for (const key of Object.keys(
                resolution.gaugesBefore
              ) as (keyof BloomGaugeSlots)[]) {
                const before =
                  resolution.gaugesBefore[key];
                const consumed =
                  resolution.gaugeConsumedBySlot[key];
                const after = resolution.gaugesAfter[key];
                expect(Number.isFinite(before)).toBe(true);
                expect(Number.isFinite(consumed)).toBe(true);
                expect(Number.isFinite(after)).toBe(true);
                expect(consumed).toBeGreaterThanOrEqual(0);
                expect(consumed).toBeLessThanOrEqual(before);
                expect(before - consumed).toBeCloseTo(
                  after,
                  12
                );
              }
              previousGauges = resolution.gaugesAfter;
            }
            expect(result.gaugesAfter).toEqual(
              previousGauges
            );
          }
        }
      }
    }
  });

  it("is deterministic, immutable, and does not mutate input slots", () => {
    const gauges: BloomGaugeSlots = {
      dendro: 0.25,
      quicken: 0.5,
      burningFuel: 0.75,
      hydro: 0
    };
    const sample = input({ frame: 333, gauges });
    const first = resolveBloomGauge(sample);
    const second = resolveBloomGauge(sample);

    expect(second).toEqual(first);
    expect(gauges).toEqual({
      dendro: 0.25,
      quicken: 0.5,
      burningFuel: 0.75,
      hydro: 0
    });
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.gaugesAfter)).toBe(true);
    expect(Object.isFrozen(first.resolutions)).toBe(true);
    expect(Object.isFrozen(first.resolutions[0])).toBe(true);
  });

  it("rejects malformed frames, gauges, flags, and illegal follow-up triggers", () => {
    expect(() =>
      resolveBloomGauge(input({ frame: -1 }))
    ).toThrow(/non-negative safe integer/);
    expect(() =>
      resolveBloomGauge(input({ frame: 0.5 }))
    ).toThrow(/non-negative safe integer/);
    expect(() =>
      resolveBloomGauge(input({ incomingGauge: -0.1 }))
    ).toThrow(/non-negative/);
    expect(() =>
      resolveBloomGauge(
        input({
          gauges: {
            ...BASE_GAUGES,
            dendro: Number.POSITIVE_INFINITY
          }
        })
      )
    ).toThrow(/finite number/);
    expect(() =>
      resolveBloomGauge({
        ...input(),
        runQuickenHydroFollowup:
          "yes" as unknown as boolean
      })
    ).toThrow(/must be boolean/);
    expect(() =>
      resolveBloomGauge(
        input({
          triggerElement: "hydro",
          runQuickenHydroFollowup: true
        })
      )
    ).toThrow(/requires a dendro trigger/);
  });
});
