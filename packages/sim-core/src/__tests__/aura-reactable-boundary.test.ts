import { describe, expect, it } from "vitest";
import { AuraEngine } from "../aura";
import { TargetLocalClock } from "../target-clock";

function noIcd(gaugeUnits = 1) {
  return {
    gaugeUnits,
    icd: {
      mode: "no-icd-v1" as const
    }
  };
}

function frozenGaugeForFrames(frames: number): number {
  const baseDecay = 0.4 / 60;
  const acceleration = 0.1 / (60 * 60);
  return (
    frames * baseDecay +
    (acceleration * frames * (frames + 1)) / 2
  );
}

function makeFrozenQuickenBoundary() {
  const frame = 600;
  const frozenGauge = frozenGaugeForFrames(frame);
  const clock = new TargetLocalClock();
  const engine = new AuraEngine({
    mode: "aura-v5",
    targetClock: clock,
    reactableTickModel: "cached-boundary-v2",
    initialAura: [{ element: "dendro", gaugeUnits: 1 }]
  });
  const quicken = engine.processHit({
    frame: 0,
    sourceActorId: "electro",
    element: "electro",
    application: noIcd(1)
  }).catalyzeReaction!.quicken!;
  engine.processHit({
    frame: 0,
    sourceActorId: "cryo",
    element: "cryo",
    application: noIcd(frozenGauge / 1.6)
  });
  const frozen = engine.processHit({
    frame: 0,
    sourceActorId: "hydro",
    element: "hydro",
    application: noIcd(frozenGauge / 2)
  }).frozenReaction!;

  expect(quicken.expiresAtFrame).toBe(frame);
  expect(frozen.expiresAtFrame).toBe(frame);
  return {
    engine,
    frame,
    frozenGeneration: frozen.generation,
    quickenGeneration: quicken.generation
  };
}

function makeLowFuelBoundary(withQuicken: boolean) {
  const engine = new AuraEngine({
    mode: "aura-v5",
    reactableTickModel: "cached-boundary-v2",
    initialAura: [
      {
        element: "dendro",
        gaugeUnits: withQuicken ? 1 : 7 / 60
      }
    ]
  });
  let quickenGeneration: number | null = null;
  if (withQuicken) {
    quickenGeneration = engine.processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(1)
    }).catalyzeReaction!.quicken!.generation;
  }
  const burning = engine.processHit({
    frame: 0,
    sourceActorId: "pyro",
    element: "pyro",
    application: noIcd(1)
  }).burningReaction!;
  let shortenedQuickenGeneration = quickenGeneration;
  if (withQuicken) {
    const refresh = engine.processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(7 / 60)
    }).burningReaction!;
    shortenedQuickenGeneration =
      refresh.quickenStateMutation.generationAfter;
    expect(refresh.fuelExpiresAtFrame).toBe(15);
    expect(refresh.quickenStateMutation).toMatchObject({
      operation: "decay-rebase",
      endCauseAfter: "BURNING_FUEL_EXPIRED",
      expiresAtFrameAfter: 15
    });
  }
  return {
    engine,
    burningGeneration: burning.generation,
    quickenGeneration: shortenedQuickenGeneration
  };
}

describe("AuraEngine Reactable.Tick lifecycle boundaries", () => {
  it("materializes same-frame Frozen and Quicken expiry independently of observer order", () => {
    const run = (order: "frozen-first" | "quicken-first") => {
      const setup = makeFrozenQuickenBoundary();
      expect(setup.engine.getAuraStateAt(setup.frame)).toEqual([]);
      expect(setup.engine.getCurrentFrame()).toBe(setup.frame);

      const frozen = () =>
        setup.engine.expireFrozen(
          setup.frame,
          setup.frozenGeneration,
          setup.frame
        );
      const quicken = () =>
        setup.engine.expireQuicken(
          setup.frame,
          setup.quickenGeneration,
          setup.frame
        );
      const results =
        order === "frozen-first"
          ? { frozen: frozen(), quicken: quicken() }
          : { quicken: quicken(), frozen: frozen() };
      const frameAfterMaterialization =
        setup.engine.getCurrentFrame();
      const repeated =
        order === "frozen-first" ? frozen() : quicken();

      expect(frameAfterMaterialization).toBe(setup.frame);
      expect(setup.engine.getCurrentFrame()).toBe(setup.frame);
      expect(repeated).toMatchObject({
        operation: "stale"
      });
      return results;
    };

    const frozenFirst = run("frozen-first");
    const quickenFirst = run("quicken-first");

    expect(frozenFirst).toEqual(quickenFirst);
    expect(frozenFirst.frozen).toMatchObject({
      operation: "expire",
      reason: "FROZEN_DECAY_EXPIRED",
      auraBefore: [
        expect.objectContaining({ element: "frozen" })
      ],
      auraAfter: []
    });
    expect(frozenFirst.quicken).toMatchObject({
      operation: "expire",
      reason: "QUICKEN_DECAY_EXPIRED",
      quickenGaugeUnitsBefore: expect.any(Number),
      quickenGaugeUnitsAfter: 0,
      auraBefore: [
        expect.objectContaining({ element: "frozen" }),
        expect.objectContaining({ element: "quicken" })
      ],
      auraAfter: [
        expect.objectContaining({ element: "frozen" })
      ]
    });
    expect(frozenFirst.quicken.auraAfter).toEqual(
      frozenFirst.frozen.auraBefore
    );
    expect(frozenFirst.frozen.auraAfter).toEqual([]);
  });

  it("materializes Fuel expiry after the same-frame Burning callback and owns the Quicken removal", () => {
    const setup = makeLowFuelBoundary(true);
    const callback =
      setup.engine.prepareBurningTickBeforeDecay(
        15,
        setup.burningGeneration,
        1
      );

    expect(callback).toMatchObject({
      operation: "tick",
      frame: 15,
      fuelGaugeUnitsBefore: expect.closeTo(1 / 150, 12)
    });
    expect(setup.engine.getCurrentFrame()).toBe(14);
    setup.engine.getAuraStateAt(15);

    const expiry = setup.engine.expireBurningFuel(
      15,
      setup.burningGeneration,
      15
    );
    expect(expiry).toMatchObject({
      operation: "expire",
      reason: "FUEL_EXPIRED",
      fuelGaugeUnitsBefore: expect.closeTo(1 / 150, 12),
      fuelGaugeUnitsAfter: 0,
      quickenStateMutation: {
        operation: "remove",
        generationBefore: setup.quickenGeneration,
        generationAfter: setup.quickenGeneration! + 1,
        endCauseBefore: "BURNING_FUEL_EXPIRED",
        endCauseAfter: null
      }
    });
    const fuelLifecycleElements = new Set([
      "burning",
      "burningFuel",
      "dendro",
      "quicken"
    ]);
    const selectFuelLifecycle = (
      snapshot: typeof expiry.auraBefore
    ) =>
      snapshot.filter((entry) =>
        fuelLifecycleElements.has(entry.element)
      );
    expect(
      selectFuelLifecycle(expiry.auraBefore)
    ).toEqual(selectFuelLifecycle(callback.auraAfter));
    for (const before of callback.auraAfter) {
      const afterOrdinaryDecay = expiry.auraBefore.find(
        (entry) => entry.element === before.element
      );
      expect(afterOrdinaryDecay).toBeDefined();
      expect(afterOrdinaryDecay!.gaugeUnits).toBeLessThanOrEqual(
        before.gaugeUnits
      );
      expect(afterOrdinaryDecay!.expiresAtFrame).toBe(
        before.expiresAtFrame
      );
      expect(
        afterOrdinaryDecay!.sourceSlots?.map(
          (slot) => slot.sourceActorId
        )
      ).toEqual(
        before.sourceSlots?.map(
          (slot) => slot.sourceActorId
        )
      );
      for (const beforeSlot of before.sourceSlots ?? []) {
        const afterSlot =
          afterOrdinaryDecay!.sourceSlots?.find(
            (slot) =>
              slot.sourceActorId ===
              beforeSlot.sourceActorId
          );
        expect(afterSlot).toBeDefined();
        expect(afterSlot!.gaugeUnits).toBeLessThanOrEqual(
          beforeSlot.gaugeUnits
        );
      }
    }
    expect(
      expiry.auraBefore.find(
        (entry) => entry.element === "pyro"
      )!.gaugeUnits
    ).toBeLessThan(
      callback.auraAfter.find(
        (entry) => entry.element === "pyro"
      )!.gaugeUnits
    );
    expect(
      expiry.auraAfter.filter(
        (entry) =>
          !fuelLifecycleElements.has(entry.element)
      )
    ).toEqual(
      expiry.auraBefore.filter(
        (entry) =>
          !fuelLifecycleElements.has(entry.element)
      )
    );
    expect(
      expiry.auraBefore.map((entry) => entry.element)
    ).toEqual(
      expect.arrayContaining([
        "burning",
        "burningFuel",
        "quicken"
      ])
    );
    expect(
      expiry.auraAfter.some(
        (entry) =>
          entry.element === "burning" ||
          entry.element === "burningFuel" ||
          entry.element === "quicken"
      )
    ).toBe(false);

    const standaloneQuicken = setup.engine.expireQuicken(
      15,
      setup.quickenGeneration!,
      15
    );
    const repeatedFuel = setup.engine.expireBurningFuel(
      15,
      setup.burningGeneration,
      15
    );
    expect(standaloneQuicken).toMatchObject({
      operation: "stale",
      reason: "STALE_QUICKEN_EXPIRY_CHECK"
    });
    expect(repeatedFuel).toMatchObject({
      operation: "stale",
      reason: "STALE_BURNING_FUEL_EXPIRY_CHECK"
    });
    expect(setup.engine.getCurrentFrame()).toBe(15);
  });

  it("stops Electro-Charged after a prior snapshot advanced the shared Tick", () => {
    const engine = new AuraEngine({
      mode: "aura-v2",
      reactableTickModel: "cached-boundary-v2",
      initialAura: [{ element: "hydro", gaugeUnits: 1 }]
    });
    const started = engine.processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(1)
    }).periodicReaction!;
    const expiryFrame = started.coexistenceExpiresAtFrame!;

    expect(engine.getAuraStateAt(expiryFrame)).toEqual([]);
    const stopped = engine.expireElectroCharged(
      expiryFrame,
      started.generation,
      expiryFrame
    );
    expect(stopped).toMatchObject({
      operation: "stop",
      reason: "AURA_DECAY_EXPIRED",
      auraBefore: [],
      auraAfter: []
    });
    expect(
      engine.expireElectroCharged(
        expiryFrame,
        started.generation,
        expiryFrame
      )
    ).toMatchObject({
      operation: "stale",
      reason: "STREAM_ALREADY_INACTIVE"
    });
    expect(engine.getCurrentFrame()).toBe(expiryFrame);
  });

  it("never advances target state for stale lifecycle generations", () => {
    const mixed = makeFrozenQuickenBoundary();
    expect(
      mixed.engine.expireFrozen(
        500,
        mixed.frozenGeneration + 1,
        mixed.frame
      )
    ).toMatchObject({ operation: "stale" });
    expect(
      mixed.engine.expireQuicken(
        500,
        mixed.quickenGeneration + 1,
        mixed.frame
      )
    ).toMatchObject({ operation: "stale" });
    expect(mixed.engine.getCurrentFrame()).toBe(0);

    const fuel = makeLowFuelBoundary(false);
    expect(
      fuel.engine.expireBurningFuel(
        10,
        fuel.burningGeneration + 1,
        15
      )
    ).toMatchObject({ operation: "stale" });
    expect(fuel.engine.getCurrentFrame()).toBe(0);

    const electroCharged = new AuraEngine({
      mode: "aura-v2",
      reactableTickModel: "cached-boundary-v2",
      initialAura: [{ element: "hydro", gaugeUnits: 1 }]
    });
    const stream = electroCharged.processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(1)
    }).periodicReaction!;
    expect(
      electroCharged.expireElectroCharged(
        100,
        stream.generation + 1,
        stream.coexistenceExpiresAtFrame!
      )
    ).toMatchObject({ operation: "stale" });
    expect(electroCharged.getCurrentFrame()).toBe(0);
  });
});
