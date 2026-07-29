import { describe, expect, it } from "vitest";
import { AuraEngine, type ElectroChargedCleanupResult } from "../aura";
import { TargetLocalClock } from "../target-clock";

function noIcd(gaugeUnits: number, tag: string) {
  return {
    gaugeUnits,
    icdTag: tag,
    icdGroup: "no-icd" as const,
  };
}

function createQuickenBloomStream(
  mode: "aura-v7" | "aura-v8",
  hydroGaugeUnits = 0.5,
  targetClock?: TargetLocalClock,
  dendroGaugeUnits = 0.5,
) {
  const engine = new AuraEngine({
    mode,
    reactableTickModel: "cached-boundary-v2",
    ...(targetClock === undefined ? {} : { targetClock }),
  });
  engine.processHit({
    frame: 0,
    sourceActorId: "hydro",
    element: "hydro",
    application: noIcd(hydroGaugeUnits, "hydro"),
  });
  const electro = engine.processHit({
    frame: 0,
    sourceActorId: "electro",
    element: "electro",
    application: noIcd(1, "electro"),
  });
  const dendro = engine.processHit({
    frame: 0,
    sourceActorId: "dendro",
    element: "dendro",
    application: noIcd(dendroGaugeUnits, "dendro"),
  });
  const generation = electro.periodicReaction?.generation;
  if (generation === undefined) {
    throw new Error("Expected Electro-Charged to start.");
  }
  expect(electro.periodicReaction).toMatchObject({
    operation: "start",
    generation,
    firstDamageFrame: 10,
    nextTickFrame: 70,
  });
  expect(dendro.catalyzeReaction?.quicken?.pendingHydroBloomFollowup).toBe(
    true,
  );
  return { engine, generation };
}

function runFollowup(
  engine: AuraEngine,
  originReactionTaskId: number | null = 7,
) {
  return engine.processQuickenBloomFollowup({
    frame: 0,
    sourceActorId: "dendro",
    triggerElement: "dendro",
    originReactionTaskId,
  });
}

function onlyResult(
  results: ElectroChargedCleanupResult[],
): ElectroChargedCleanupResult {
  expect(results).toHaveLength(1);
  return results[0]!;
}

describe("aura-v8 Quicken→Bloom Electro-Charged cleanup", () => {
  it("arms when the follow-up removes the last Hydro and stops only after the next target Tick", () => {
    const { engine, generation } = createQuickenBloomStream("aura-v8");
    const followup = runFollowup(engine);
    const armed = onlyResult(engine.drainElectroChargedCleanupResults());

    expect(followup).toMatchObject({
      status: "triggered",
      bloomReaction: {
        operation: "quicken-followup",
        hydroGaugeUnitsBefore: 0.4,
        hydroConsumedGaugeUnits: 0.4,
        hydroGaugeUnitsAfter: 0,
      },
    });
    expect(armed).toMatchObject({
      model: "quicken-bloom-target-tick-v1",
      generation,
      armedAtFrame: 0,
      armedAtTargetFrame: 0,
      deadlineTargetFrame: 1,
      resolvedAtFrame: null,
      resolvedAtTargetFrame: null,
      outcome: "armed",
      reason: "QUICKEN_BLOOM_DEPLETED_LAST_HYDRO",
      originReactionTaskId: 7,
      nextTickFrame: 70,
    });
    expect(engine.getAuraStateAt(0)).toEqual(followup.auraAfter);
    expect(engine.drainElectroChargedCleanupResults()).toEqual([]);

    const stateAtOne = engine.getAuraStateAt(1);
    const stopped = onlyResult(engine.drainElectroChargedCleanupResults());
    expect(stopped).toMatchObject({
      generation,
      armedAtFrame: 0,
      armedAtTargetFrame: 0,
      deadlineTargetFrame: 1,
      resolvedAtFrame: 1,
      resolvedAtTargetFrame: 1,
      outcome: "stopped",
      reason: "COEXISTING_AURA_REMOVED_BY_QUICKEN_BLOOM",
      originReactionTaskId: 7,
      nextTickFrame: null,
    });
    expect(
      stopped.auraBefore.map(({ element, gaugeUnits, sourceSlots }) => ({
        element,
        gaugeUnits,
        sourceSlots,
      })),
    ).toEqual(
      armed.auraAfter.map(({ element, gaugeUnits, sourceSlots }) => ({
        element,
        gaugeUnits,
        sourceSlots,
      })),
    );
    expect(stopped.auraAfter).toEqual(stateAtOne);
    expect(
      stopped.auraAfter.find((entry) => entry.element === "electro")!
        .gaugeUnits,
    ).toBeLessThan(
      stopped.auraBefore.find((entry) => entry.element === "electro")!
        .gaugeUnits,
    );
    expect(engine.prepareElectroChargedTick(10, generation)).toMatchObject({
      operation: "stop",
      reason: "COEXISTING_AURA_MISSING",
    });
  });

  it("retains the same generation and cadence when coexistence is restored before the deadline", () => {
    const { engine, generation } = createQuickenBloomStream(
      "aura-v8",
      0.5,
      undefined,
      0.2,
    );
    runFollowup(engine, null);
    onlyResult(engine.drainElectroChargedCleanupResults());

    // This is an AuraEngine ordering vector before the next effective
    // Reactable.Tick. It does not assert that the simulator exposes an
    // ordinary direct-hit path at this exact task boundary.
    const restored = engine.processHit({
      frame: 0,
      sourceActorId: "same-frame-hydro",
      element: "hydro",
      application: noIcd(0.5, "same-frame-hydro"),
    });
    expect(restored.periodicReaction).toMatchObject({
      operation: "refresh",
      generation,
      firstDamageFrame: null,
      nextTickFrame: 70,
    });

    engine.getAuraStateAt(1);
    const retained = onlyResult(engine.drainElectroChargedCleanupResults());
    expect(retained).toMatchObject({
      generation,
      outcome: "retained",
      reason: "COEXISTENCE_RESTORED_BEFORE_TARGET_TICK",
      originReactionTaskId: null,
      nextTickFrame: 70,
    });
    expect(engine.prepareElectroChargedTick(10, generation)).toMatchObject({
      operation: "tick",
      generation,
      nextTickFrame: 70,
      reason: null,
    });
  });

  it("reports natural expiry when a restored coexistence Aura expires on the cleanup deadline", () => {
    const { engine, generation } = createQuickenBloomStream("aura-v8");
    runFollowup(engine);
    onlyResult(engine.drainElectroChargedCleanupResults());

    // Inject a one-target-frame restored-Aura vector. A public Hydro hit would
    // react with the live Quicken state instead of attaching normal Hydro, and
    // normal player Aura has a much longer base lifetime. This white-box vector
    // therefore isolates the exact lifecycle collision without claiming it is
    // an ordinary character application.
    const mutable = engine as unknown as {
      auras: Map<
        string,
        {
          element: string;
          gaugeUnits: number;
          decayPerFrame: number;
          sourceSlots?: Map<string, number>;
        }
      >;
    };
    mutable.auras.set("hydro", {
      element: "hydro",
      gaugeUnits: 0.000001,
      decayPerFrame: 0.000001,
      sourceSlots: new Map([["short-hydro", 0.000001]]),
    });
    expect(
      engine.getAuraStateAt(0).find((entry) => entry.element === "hydro"),
    ).toMatchObject({
      gaugeUnits: 0.000001,
      expiresAtFrame: 1,
    });

    engine.getAuraStateAt(1);
    const collision = onlyResult(engine.drainElectroChargedCleanupResults());
    expect(collision).toMatchObject({
      generation,
      deadlineTargetFrame: 1,
      resolvedAtFrame: 1,
      resolvedAtTargetFrame: 1,
      outcome: "natural-expiry",
      reason: "AURA_DECAY_EXPIRED_BEFORE_CLEANUP",
      originReactionTaskId: 7,
      nextTickFrame: null,
    });

    // The cached natural lifecycle boundary remains authoritative and is
    // consumed exactly once by the simulator's earlier expiry callback.
    expect(engine.expireElectroCharged(1, generation, 1)).toMatchObject({
      generation,
      operation: "stop",
      frame: 1,
      reason: "AURA_DECAY_EXPIRED",
      nextTickFrame: null,
    });
    expect(engine.expireElectroCharged(1, generation, 1)).toMatchObject({
      generation,
      operation: "stale",
      reason: "STREAM_ALREADY_INACTIVE",
    });
  });

  it("reports a replaced EC generation as superseded without stopping the replacement", () => {
    const { engine, generation } = createQuickenBloomStream("aura-v8");
    runFollowup(engine);
    engine.drainElectroChargedCleanupResults();

    const mutable = engine as unknown as {
      electroChargedGeneration: number;
      electroChargedActive: boolean;
      electroChargedNextTickFrame: number;
    };
    // White-box stale-marker hardening: the runtime owns generation changes,
    // while this Aura unit verifies that an old marker survives until its
    // deadline and cannot stop a replacement stream.
    mutable.electroChargedGeneration = generation + 1;
    mutable.electroChargedActive = true;
    mutable.electroChargedNextTickFrame = 70;
    expect(engine.drainElectroChargedCleanupResults()).toEqual([]);

    engine.getAuraStateAt(1);
    expect(
      onlyResult(engine.drainElectroChargedCleanupResults()),
    ).toMatchObject({
      generation,
      outcome: "superseded",
      reason: "ELECTRO_CHARGED_GENERATION_SUPERSEDED",
      nextTickFrame: 70,
    });
  });

  it("does not arm when Hydro survives a partial follow-up consumption", () => {
    const { engine, generation } = createQuickenBloomStream("aura-v8", 2);
    const followup = runFollowup(engine);

    expect(followup).toMatchObject({
      status: "triggered",
      bloomReaction: {
        hydroGaugeUnitsBefore: 1.6,
        hydroConsumedGaugeUnits: 1,
        hydroGaugeUnitsAfter: 0.6,
      },
    });
    expect(engine.drainElectroChargedCleanupResults()).toEqual([]);
    engine.getAuraStateAt(1);
    expect(engine.drainElectroChargedCleanupResults()).toEqual([]);
    expect(engine.prepareElectroChargedTick(10, generation)).toMatchObject({
      operation: "tick",
      generation,
    });
  });

  it("waits for the next effective target Tick when hitlag freezes the target clock", () => {
    const clock = new TargetLocalClock();
    const { engine, generation } = createQuickenBloomStream(
      "aura-v8",
      0.5,
      clock,
    );
    runFollowup(engine);
    const armed = onlyResult(engine.drainElectroChargedCleanupResults());
    engine.applyTargetHitlag({
      globalFrame: 0,
      haltFrames: 2,
      factor: 0,
    });

    engine.getAuraStateAt(2);
    expect(engine.getCurrentTargetFrame()).toBe(0);
    expect(engine.drainElectroChargedCleanupResults()).toEqual([]);

    const stateAtGlobalThree = engine.getAuraStateAt(3);
    const stopped = onlyResult(engine.drainElectroChargedCleanupResults());
    expect(stopped).toMatchObject({
      generation,
      armedAtFrame: 0,
      armedAtTargetFrame: 0,
      deadlineTargetFrame: 1,
      resolvedAtFrame: 3,
      resolvedAtTargetFrame: 1,
      outcome: "stopped",
      reason: "COEXISTING_AURA_REMOVED_BY_QUICKEN_BLOOM",
      nextTickFrame: null,
    });
    // Hitlag changes only the projected global expiry frames. The target-frame
    // durability and source ownership remain reciprocal across the boundary.
    expect(
      stopped.auraBefore.map(
        ({ element, gaugeUnits, expiresAtTargetFrame, sourceSlots }) => ({
          element,
          gaugeUnits,
          expiresAtTargetFrame,
          sourceSlots,
        }),
      ),
    ).toEqual(
      armed.auraAfter.map(
        ({ element, gaugeUnits, expiresAtTargetFrame, sourceSlots }) => ({
          element,
          gaugeUnits,
          expiresAtTargetFrame,
          sourceSlots,
        }),
      ),
    );
    expect(stopped.auraAfter).toEqual(stateAtGlobalThree);
  });

  it("leaves aura-v7 without the new marker or cleanup observations", () => {
    const { engine, generation } = createQuickenBloomStream("aura-v7");
    const followup = runFollowup(engine);

    expect(followup).toMatchObject({
      status: "triggered",
      bloomReaction: {
        hydroGaugeUnitsAfter: 0,
      },
    });
    expect(engine.drainElectroChargedCleanupResults()).toEqual([]);
    engine.getAuraStateAt(1);
    expect(engine.drainElectroChargedCleanupResults()).toEqual([]);
    expect(engine.prepareElectroChargedTick(10, generation)).toMatchObject({
      operation: "stop",
      reason: "COEXISTING_AURA_MISSING",
    });
  });
});
