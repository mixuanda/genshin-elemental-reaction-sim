/**
 * Pure Bloom gauge resolver.
 *
 * The gauge ordering and factors are cross-checked against the fixed gcsim
 * source revision used by this project. They are an implementation reference,
 * not a claim that these values are official live-server truth.
 */

export const BLOOM_GAUGE_EPSILON = 1e-10;
export const BLOOM_GAUGE_PRECISION_DIGITS = 12;

export type BloomTriggerElement = "hydro" | "dendro";
export type BloomGaugeResolutionKind =
  | "direct"
  | "quicken-followup";
export type BloomGaugeDriverKind = "incoming" | "quicken";

export interface BloomGaugeSlots {
  dendro: number;
  quicken: number;
  burningFuel: number;
  hydro: number;
}

export interface BloomGaugeInput {
  frame: number;
  triggerElement: BloomTriggerElement;
  incomingGauge: number;
  gauges: Readonly<BloomGaugeSlots>;
  /**
   * The caller must set this only when a Catalyze path explicitly queued the
   * same-frame Quicken-to-Hydro follow-up. It is not inferred from the slots.
   */
  runQuickenHydroFollowup: boolean;
}

export interface BloomGaugeDriver {
  kind: BloomGaugeDriverKind;
  gaugeBefore: number;
  consumedGauge: number;
  gaugeAfter: number;
}

export interface BloomGaugeResolution {
  frame: number;
  order: number;
  kind: BloomGaugeResolutionKind;
  triggerElement: BloomTriggerElement;
  /**
   * Actual opposing-slot cap is driver gauge multiplied by this factor.
   */
  auraConsumptionFactor: 0.5 | 2;
  driver: Readonly<BloomGaugeDriver>;
  gaugesBefore: Readonly<BloomGaugeSlots>;
  gaugeConsumedBySlot: Readonly<BloomGaugeSlots>;
  gaugesAfter: Readonly<BloomGaugeSlots>;
  incomingGaugeBefore: number;
  incomingGaugeConsumed: number;
  incomingGaugeAfter: number;
  createsCore: true;
}

export interface BloomGaugeResult {
  frame: number;
  triggerElement: BloomTriggerElement;
  gaugesBefore: Readonly<BloomGaugeSlots>;
  gaugesAfter: Readonly<BloomGaugeSlots>;
  incomingGaugeBefore: number;
  incomingGaugeConsumed: number;
  incomingGaugeAfter: number;
  resolutions: readonly Readonly<BloomGaugeResolution>[];
  createdCoreCount: number;
}

function assertFrame(frame: number): void {
  if (!Number.isSafeInteger(frame) || frame < 0) {
    throw new RangeError(
      "Bloom gauge frame must be a non-negative safe integer."
    );
  }
}

function assertTriggerElement(
  element: string
): asserts element is BloomTriggerElement {
  if (element !== "hydro" && element !== "dendro") {
    throw new TypeError(
      "Bloom gauge triggerElement must be hydro or dendro."
    );
  }
}

function assertGauge(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(
      `Bloom gauge ${field} must be a finite number.`
    );
  }
  if (value < 0) {
    throw new RangeError(
      `Bloom gauge ${field} must be non-negative.`
    );
  }
}

function cleanGauge(value: number): number {
  if (Math.abs(value) <= BLOOM_GAUGE_EPSILON) return 0;
  return Number(value.toFixed(BLOOM_GAUGE_PRECISION_DIGITS));
}

function freezeSlots(
  slots: BloomGaugeSlots
): Readonly<BloomGaugeSlots> {
  return Object.freeze({
    dendro: cleanGauge(slots.dendro),
    quicken: cleanGauge(slots.quicken),
    burningFuel: cleanGauge(slots.burningFuel),
    hydro: cleanGauge(slots.hydro)
  });
}

function zeroConsumption(): Readonly<BloomGaugeSlots> {
  return freezeSlots({
    dendro: 0,
    quicken: 0,
    burningFuel: 0,
    hydro: 0
  });
}

function subtractGauge(before: number, consumed: number): number {
  return cleanGauge(Math.max(0, before - consumed));
}

function cappedConsumption(
  availableGauge: number,
  driverGauge: number,
  factor: 0.5 | 2
): number {
  return cleanGauge(
    Math.min(availableGauge, driverGauge * factor)
  );
}

function makeResolution({
  frame,
  order,
  kind,
  triggerElement,
  auraConsumptionFactor,
  driver,
  gaugesBefore,
  gaugeConsumedBySlot,
  gaugesAfter,
  incomingGaugeBefore,
  incomingGaugeConsumed,
  incomingGaugeAfter
}: Omit<BloomGaugeResolution, "createsCore">): Readonly<BloomGaugeResolution> {
  return Object.freeze({
    frame,
    order,
    kind,
    triggerElement,
    auraConsumptionFactor,
    driver: Object.freeze({ ...driver }),
    gaugesBefore,
    gaugeConsumedBySlot,
    gaugesAfter,
    incomingGaugeBefore: cleanGauge(incomingGaugeBefore),
    incomingGaugeConsumed: cleanGauge(incomingGaugeConsumed),
    incomingGaugeAfter: cleanGauge(incomingGaugeAfter),
    createsCore: true
  });
}

/**
 * Resolve direct Bloom and, when explicitly requested, the queued same-frame
 * Quicken-to-Hydro follow-up. The function is deterministic and never mutates
 * its input.
 *
 * Hydro direct Bloom reduces the normal Dendro, Burning Fuel, and Quicken
 * slots independently at factor 0.5. Its incoming gauge spends only the
 * largest normalized reduction, never the sum of those reductions.
 *
 * Dendro direct Bloom reduces Hydro at factor 2. A queued Quicken follow-up
 * then uses the remaining Quicken gauge as its driver, reduces remaining
 * Hydro at factor 2, and spends the matching normalized Quicken gauge.
 */
export function resolveBloomGauge(
  input: Readonly<BloomGaugeInput>
): Readonly<BloomGaugeResult> {
  assertFrame(input.frame);
  assertTriggerElement(input.triggerElement);
  assertGauge(input.incomingGauge, "incomingGauge");
  assertGauge(input.gauges.dendro, "gauges.dendro");
  assertGauge(input.gauges.quicken, "gauges.quicken");
  assertGauge(
    input.gauges.burningFuel,
    "gauges.burningFuel"
  );
  assertGauge(input.gauges.hydro, "gauges.hydro");
  if (typeof input.runQuickenHydroFollowup !== "boolean") {
    throw new TypeError(
      "Bloom gauge runQuickenHydroFollowup must be boolean."
    );
  }
  if (
    input.runQuickenHydroFollowup &&
    input.triggerElement !== "dendro"
  ) {
    throw new RangeError(
      "Bloom gauge Quicken-Hydro follow-up requires a dendro trigger."
    );
  }

  const gaugesBefore = freezeSlots({ ...input.gauges });
  let gauges = gaugesBefore;
  const incomingGaugeBefore = cleanGauge(
    input.incomingGauge
  );
  let incomingGauge = incomingGaugeBefore;
  const resolutions: Readonly<BloomGaugeResolution>[] = [];

  if (
    incomingGauge > BLOOM_GAUGE_EPSILON &&
    input.triggerElement === "hydro" &&
    (gauges.dendro > BLOOM_GAUGE_EPSILON ||
      gauges.quicken > BLOOM_GAUGE_EPSILON ||
      gauges.burningFuel > BLOOM_GAUGE_EPSILON)
  ) {
    const factor = 0.5 as const;
    const dendroConsumed = cappedConsumption(
      gauges.dendro,
      incomingGauge,
      factor
    );
    const quickenConsumed = cappedConsumption(
      gauges.quicken,
      incomingGauge,
      factor
    );
    const burningFuelConsumed = cappedConsumption(
      gauges.burningFuel,
      incomingGauge,
      factor
    );
    const gaugeConsumedBySlot = freezeSlots({
      dendro: dendroConsumed,
      quicken: quickenConsumed,
      burningFuel: burningFuelConsumed,
      hydro: 0
    });
    const normalizedMaximumConsumed = cleanGauge(
      Math.min(
        incomingGauge,
        Math.max(
          dendroConsumed,
          quickenConsumed,
          burningFuelConsumed
        ) / factor
      )
    );
    const nextIncomingGauge = subtractGauge(
      incomingGauge,
      normalizedMaximumConsumed
    );
    const nextGauges = freezeSlots({
      dendro: subtractGauge(
        gauges.dendro,
        dendroConsumed
      ),
      quicken: subtractGauge(
        gauges.quicken,
        quickenConsumed
      ),
      burningFuel: subtractGauge(
        gauges.burningFuel,
        burningFuelConsumed
      ),
      hydro: gauges.hydro
    });
    resolutions.push(
      makeResolution({
        frame: input.frame,
        order: resolutions.length,
        kind: "direct",
        triggerElement: input.triggerElement,
        auraConsumptionFactor: factor,
        driver: {
          kind: "incoming",
          gaugeBefore: incomingGauge,
          consumedGauge: normalizedMaximumConsumed,
          gaugeAfter: nextIncomingGauge
        },
        gaugesBefore: gauges,
        gaugeConsumedBySlot,
        gaugesAfter: nextGauges,
        incomingGaugeBefore: incomingGauge,
        incomingGaugeConsumed: normalizedMaximumConsumed,
        incomingGaugeAfter: nextIncomingGauge
      })
    );
    gauges = nextGauges;
    incomingGauge = nextIncomingGauge;
  }

  if (
    incomingGauge > BLOOM_GAUGE_EPSILON &&
    input.triggerElement === "dendro" &&
    gauges.hydro > BLOOM_GAUGE_EPSILON
  ) {
    const factor = 2 as const;
    const hydroConsumed = cappedConsumption(
      gauges.hydro,
      incomingGauge,
      factor
    );
    const normalizedConsumed = cleanGauge(
      Math.min(incomingGauge, hydroConsumed / factor)
    );
    const gaugeConsumedBySlot = freezeSlots({
      ...zeroConsumption(),
      hydro: hydroConsumed
    });
    const nextIncomingGauge = subtractGauge(
      incomingGauge,
      normalizedConsumed
    );
    const nextGauges = freezeSlots({
      ...gauges,
      hydro: subtractGauge(gauges.hydro, hydroConsumed)
    });
    resolutions.push(
      makeResolution({
        frame: input.frame,
        order: resolutions.length,
        kind: "direct",
        triggerElement: input.triggerElement,
        auraConsumptionFactor: factor,
        driver: {
          kind: "incoming",
          gaugeBefore: incomingGauge,
          consumedGauge: normalizedConsumed,
          gaugeAfter: nextIncomingGauge
        },
        gaugesBefore: gauges,
        gaugeConsumedBySlot,
        gaugesAfter: nextGauges,
        incomingGaugeBefore: incomingGauge,
        incomingGaugeConsumed: normalizedConsumed,
        incomingGaugeAfter: nextIncomingGauge
      })
    );
    gauges = nextGauges;
    incomingGauge = nextIncomingGauge;
  }

  if (
    input.runQuickenHydroFollowup &&
    gauges.quicken > BLOOM_GAUGE_EPSILON &&
    gauges.hydro > BLOOM_GAUGE_EPSILON
  ) {
    const factor = 2 as const;
    const quickenGaugeBefore = gauges.quicken;
    const hydroConsumed = cappedConsumption(
      gauges.hydro,
      quickenGaugeBefore,
      factor
    );
    const quickenConsumed = cleanGauge(
      Math.min(quickenGaugeBefore, hydroConsumed / factor)
    );
    const gaugeConsumedBySlot = freezeSlots({
      ...zeroConsumption(),
      quicken: quickenConsumed,
      hydro: hydroConsumed
    });
    const nextGauges = freezeSlots({
      ...gauges,
      quicken: subtractGauge(
        quickenGaugeBefore,
        quickenConsumed
      ),
      hydro: subtractGauge(gauges.hydro, hydroConsumed)
    });
    resolutions.push(
      makeResolution({
        frame: input.frame,
        order: resolutions.length,
        kind: "quicken-followup",
        triggerElement: input.triggerElement,
        auraConsumptionFactor: factor,
        driver: {
          kind: "quicken",
          gaugeBefore: quickenGaugeBefore,
          consumedGauge: quickenConsumed,
          gaugeAfter: nextGauges.quicken
        },
        gaugesBefore: gauges,
        gaugeConsumedBySlot,
        gaugesAfter: nextGauges,
        incomingGaugeBefore: incomingGauge,
        incomingGaugeConsumed: 0,
        incomingGaugeAfter: incomingGauge
      })
    );
    gauges = nextGauges;
  }

  const frozenResolutions = Object.freeze([...resolutions]);
  return Object.freeze({
    frame: input.frame,
    triggerElement: input.triggerElement,
    gaugesBefore,
    gaugesAfter: gauges,
    incomingGaugeBefore,
    incomingGaugeConsumed: subtractGauge(
      incomingGaugeBefore,
      incomingGauge
    ),
    incomingGaugeAfter: incomingGauge,
    resolutions: frozenResolutions,
    createdCoreCount: frozenResolutions.length
  });
}
