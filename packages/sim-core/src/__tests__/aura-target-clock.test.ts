import { describe, expect, it } from "vitest";
import { AuraEngine } from "../aura";
import { TargetLocalClock } from "../target-clock";

function noIcd(gaugeUnits = 1) {
  return {
    gaugeUnits,
    icdTag: "target-clock-test",
    icdGroup: "no-icd" as const
  };
}

describe("AuraEngine with an enabled target-local clock", () => {
  it("delays a normal 1U Aura expiry by frozen target ticks", () => {
    const clock = new TargetLocalClock();
    const engine = new AuraEngine({
      mode: "aura-v3",
      targetClock: clock,
      initialAura: [{ element: "cryo", gaugeUnits: 1 }]
    });

    clock.applyHitlag({
      globalFrame: 0,
      haltFrames: 5,
      factor: 0
    });

    const beforeExpiry = engine.processHit({
      frame: 574,
      sourceActorId: "observer",
      element: "physical"
    });
    const atExpiry = engine.processHit({
      frame: 575,
      sourceActorId: "observer",
      element: "physical"
    });

    expect(clock.getState()).toMatchObject({
      globalFrame: 575,
      localFrame: 570,
      frozenFrames: 0
    });
    expect(beforeExpiry.auraBefore).toEqual([
      {
        element: "cryo",
        gaugeUnits: expect.closeTo(0.8 / 570, 12),
        expiresAtFrame: 575,
        expiresAtTargetFrame: 570,
        sourceSlots: [
          {
            sourceActorId: "__initial__",
            gaugeUnits: expect.closeTo(0.8 / 570, 12)
          }
        ]
      }
    ]);
    expect(atExpiry.auraBefore).toEqual([]);
  });

  it("delays Frozen and Quicken natural expiry without changing their target-frame durations", () => {
    const frozenClock = new TargetLocalClock();
    const frozenEngine = new AuraEngine({
      mode: "aura-v2",
      targetClock: frozenClock,
      initialAura: [{ element: "cryo", gaugeUnits: 1 }]
    });
    const frozenStart = frozenEngine.processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd()
    });
    const frozenGeneration =
      frozenStart.frozenReaction!.generation;

    frozenClock.applyHitlag({
      globalFrame: 0,
      haltFrames: 7,
      factor: 0
    });
    const frozenBeforeExpiry = frozenEngine.processHit({
      frame: 182,
      sourceActorId: "observer",
      element: "physical"
    });
    const frozenExpiry = frozenEngine.expireFrozen(
      183,
      frozenGeneration,
      183
    );

    expect(frozenClock.getState()).toMatchObject({
      globalFrame: 183,
      localFrame: 176
    });
    expect(frozenBeforeExpiry.auraBefore).toEqual([
      expect.objectContaining({
        element: "frozen",
        expiresAtFrame: 183
      })
    ]);
    expect(frozenExpiry).toMatchObject({
      operation: "expire",
      frame: 183,
      expiresAtFrame: null,
      reason: "FROZEN_DECAY_EXPIRED"
    });

    const quickenClock = new TargetLocalClock();
    const quickenEngine = new AuraEngine({
      mode: "aura-v3",
      targetClock: quickenClock,
      initialAura: [{ element: "dendro", gaugeUnits: 1 }]
    });
    const quickenStart = quickenEngine.processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd()
    });
    const quickenGeneration =
      quickenStart.catalyzeReaction!.quicken!.generation;

    quickenClock.applyHitlag({
      globalFrame: 0,
      haltFrames: 11,
      factor: 0
    });
    const quickenBeforeExpiry = quickenEngine.processHit({
      frame: 610,
      sourceActorId: "observer",
      element: "physical"
    });
    const quickenExpiry = quickenEngine.expireQuicken(
      611,
      quickenGeneration,
      611
    );

    expect(quickenClock.getState()).toMatchObject({
      globalFrame: 611,
      localFrame: 600
    });
    expect(quickenBeforeExpiry.auraBefore).toEqual([
      expect.objectContaining({
        element: "quicken",
        expiresAtFrame: 611
      })
    ]);
    expect(quickenExpiry).toMatchObject({
      operation: "expire",
      frame: 611,
      expiresAtFrame: null,
      reason: "QUICKEN_DECAY_EXPIRED"
    });
  });

  it("runs Burning ticks every 15 target frames and delays Fuel expiry", () => {
    const clock = new TargetLocalClock();
    const engine = new AuraEngine({
      mode: "aura-v4",
      targetClock: clock,
      initialAura: [{ element: "dendro", gaugeUnits: 1 }]
    });
    const start = engine.processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd()
    });
    const generation = start.burningReaction!.generation;

    clock.applyHitlag({
      globalFrame: 0,
      haltFrames: 5,
      factor: 0
    });
    const ticks = Array.from({ length: 8 }, (_, index) =>
      engine.prepareBurningTick(
        (index + 1) * 15 + 5,
        generation,
        index + 1
      )
    );
    const expiry = engine.expireBurningFuel(
      126,
      generation,
      126
    );

    expect(ticks.map((tick) => tick.frame)).toEqual([
      20, 35, 50, 65, 80, 95, 110, 125
    ]);
    expect(ticks.every((tick) => tick.operation === "tick")).toBe(
      true
    );
    expect(ticks.map((tick) => tick.nextTickFrame)).toEqual([
      35, 50, 65, 80, 95, 110, 125, 140
    ]);
    expect(expiry).toMatchObject({
      operation: "expire",
      frame: 126,
      burningGaugeUnitsBefore: 2,
      burningGaugeUnitsAfter: 0,
      fuelGaugeUnitsBefore: expect.closeTo(1 / 150, 12),
      fuelGaugeUnitsAfter: 0,
      nextTickFrame: null,
      fuelExpiresAtFrame: null,
      reason: "FUEL_EXPIRED"
    });
    expect(clock.getState()).toMatchObject({
      globalFrame: 126,
      localFrame: 121
    });
  });

  it("checks a reprojected Burning target task before the resumed target-frame decay", () => {
    const clock = new TargetLocalClock();
    const engine = new AuraEngine({
      mode: "aura-v4",
      targetClock: clock,
      initialAura: [
        { element: "dendro", gaugeUnits: 7 / 60 }
      ]
    });
    const start = engine.processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd()
    });
    clock.applyHitlag({
      globalFrame: 0,
      haltFrames: 5,
      factor: 0
    });

    expect(start.burningReaction).toMatchObject({
      generation: 1,
      firstTickFrame: 15,
      fuelExpiresAtFrame: 15
    });
    const callback =
      engine.prepareBurningTickBeforeDecay(20, 1, 1);
    expect(callback).toMatchObject({
      operation: "tick",
      frame: 20,
      tickIndex: 1,
      fuelGaugeUnitsBefore: expect.closeTo(1 / 150, 12),
      nextTickFrame: 35
    });
    expect(clock.getState()).toMatchObject({
      globalFrame: 19,
      localFrame: 14
    });
    expect(engine.getAuraStateAt(20)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "burning" }),
        expect.objectContaining({ element: "burningFuel" })
      ])
    );
    expect(clock.getState()).toMatchObject({
      globalFrame: 20,
      localFrame: 15
    });
  });

  it("allows same-global-frame and hitlag-period hits to mutate Aura at one target frame", () => {
    const clock = new TargetLocalClock();
    const engine = new AuraEngine({
      mode: "aura-v3",
      targetClock: clock,
      initialAura: [{ element: "cryo", gaugeUnits: 1 }]
    });

    clock.applyHitlag({
      globalFrame: 0,
      haltFrames: 4,
      factor: 0
    });
    const refreshed = engine.processHit({
      frame: 1,
      sourceActorId: "cryo",
      element: "cryo",
      application: noIcd(2)
    });
    const consumed = engine.processHit({
      frame: 1,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd()
    });
    const reapplied = engine.processHit({
      frame: 2,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd()
    });

    expect(refreshed).toMatchObject({
      reaction: "none",
      auraAfter: [
        expect.objectContaining({
          element: "cryo",
          gaugeUnits: 1.6
        })
      ]
    });
    expect(consumed).toMatchObject({
      reaction: "melt",
      auraConsumed: [
        {
          element: "cryo",
          gaugeUnits: 1.6
        }
      ],
      auraAfter: []
    });
    expect(reapplied).toMatchObject({
      reaction: "none",
      auraAfter: [
        expect.objectContaining({
          element: "hydro",
          gaugeUnits: 0.8
        })
      ]
    });
    expect(engine.getCurrentFrame()).toBe(2);
    expect(engine.getCurrentTargetFrame()).toBe(0);
    expect(clock.getState()).toMatchObject({
      globalFrame: 2,
      localFrame: 0,
      frozenFrames: 2
    });
  });

  it("keeps Electro-Charged damage cadence global while Aura expiry follows the target clock", () => {
    const clock = new TargetLocalClock();
    const engine = new AuraEngine({
      mode: "aura-v2",
      targetClock: clock,
      initialAura: [{ element: "hydro", gaugeUnits: 1 }]
    });
    const started = engine.processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd()
    });
    const generation =
      started.periodicReaction!.generation;

    clock.applyHitlag({
      globalFrame: 0,
      haltFrames: 100,
      factor: 0
    });
    const tick = engine.prepareElectroChargedTick(
      70,
      generation
    );

    expect(started.periodicReaction).toMatchObject({
      operation: "start",
      firstDamageFrame: 10,
      nextTickFrame: 70
    });
    expect(tick).toMatchObject({
      operation: "tick",
      frame: 70,
      nextTickFrame: 130,
      coexistenceExpiresAtFrame: 526
    });
    expect(engine.getCurrentTargetFrame()).toBe(0);
    expect(clock.getState()).toMatchObject({
      globalFrame: 70,
      localFrame: 0,
      frozenFrames: 30
    });
  });
});
