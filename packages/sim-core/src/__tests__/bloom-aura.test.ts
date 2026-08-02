import { describe, expect, it } from "vitest";
import {
  bloomReactionAuditSchema,
  quickenReactionAuditSchema,
  quickenStateLogEntrySchema,
  type BloomReactionAudit
} from "@genshin-dps-lab/schemas";
import { AuraEngine, type AuraEngineConfig } from "../aura";

function noIcd(gaugeUnits = 1) {
  return {
    gaugeUnits,
    icd: { mode: "no-icd-v1" as const }
  };
}

function defaultIcd(gaugeUnits = 1) {
  return {
    gaugeUnits,
    icd: {
      mode: "legacy-boolean-profile-v1" as const,
      icdTag: "bloom-aura-test",
      profileId: "default"
    }
  };
}

function gauge(
  audit: ReturnType<AuraEngine["processHit"]>,
  element: string
): number {
  return (
    audit.auraAfter?.find(
      (entry) => entry.element === element
    )?.gaugeUnits ?? 0
  );
}

function stateGauge(
  state: readonly { element: string; gaugeUnits: number }[],
  element: string
): number {
  return (
    state.find((entry) => entry.element === element)
      ?.gaugeUnits ?? 0
  );
}

/**
 * B3 is a pure fixed-reference modifier vector. Public SimConfig cannot seed
 * Quicken or Burning Fuel directly, so this narrow engine unit test injects
 * the already-active modifier state and verifies only AuraEngine consumption
 * and audit projection.
 */
function seedModifierState(
  engine: AuraEngine,
  gauges: {
    dendro: number;
    quicken: number;
    burningFuel: number;
    burning?: number;
    hydro?: number;
  }
): void {
  const mutable = engine as unknown as {
    auras: Map<
      string,
      {
        element: string;
        gaugeUnits: number;
        decayPerFrame: number;
        sourceSlots: Map<string, number>;
      }
    >;
  };
  for (const [element, gaugeUnits] of Object.entries(
    gauges
  )) {
    if (gaugeUnits <= 0) continue;
    mutable.auras.set(element, {
      element,
      gaugeUnits,
      decayPerFrame:
        element === "quicken"
          ? gaugeUnits / (360 + 300 * gaugeUnits)
          : element === "burningFuel"
            ? 1 / 150
          : 0,
      sourceSlots: new Map([
        [`__b3-${element}__`, gaugeUnits]
      ])
    });
  }
}

describe("aura-v5 Bloom gauge integration", () => {
  it("round-trips real Quicken start, refresh, and unchanged audits through the strict schema", () => {
    const vectors = [
      {
        operation: "start" as const,
        quickenGaugeUnits: 0
      },
      {
        operation: "refresh" as const,
        quickenGaugeUnits: 0.4
      },
      {
        operation: "unchanged" as const,
        quickenGaugeUnits: 1
      }
    ];

    for (const vector of vectors) {
      const engine = new AuraEngine({
        mode: "aura-v5",
        initialAura: [{ element: "electro", gaugeUnits: 1 }]
      });
      if (vector.quickenGaugeUnits > 0) {
        seedModifierState(engine, {
          dendro: 0,
          quicken: vector.quickenGaugeUnits,
          burningFuel: 0
        });
      }
      const audit = engine.processHit({
        frame: 0,
        sourceActorId: "dendro",
        element: "dendro",
        application: noIcd(1)
      });
      const quicken = audit.catalyzeReaction?.quicken;

      expect(quicken).toMatchObject({
        operation: vector.operation,
        endCause: "QUICKEN_DECAY"
      });
      expect(() =>
        quickenReactionAuditSchema.parse(quicken)
      ).not.toThrow();
    }
  });

  it("B1: Hydro consumes Dendro at factor 0.5 and schedules one core at +30f", () => {
    const audit = new AuraEngine({
      mode: "aura-v5",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }]
    }).processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(1)
    });

    expect(audit).toMatchObject({
      reaction: "bloom",
      reactions: ["bloom"],
      unsupportedReactions: [],
      mechanicsTruncation: null,
      bloomReactions: [
        {
          operation: "direct",
          triggerElement: "hydro",
          sourceBudget: "incoming-application",
          sourceGaugeUnitsBefore: 1,
          sourceGaugeUnitsSpent: 1,
          sourceGaugeUnitsAfter: 0,
          dendroGaugeUnitsBefore: 0.8,
          dendroConsumedGaugeUnits: 0.5,
          dendroGaugeUnitsAfter: 0.3,
          scheduled: true,
          coreSpawnFrame: 30,
          coreSpawnDelayFrames: 30,
          mechanicsDataStatus: "fixed-gcsim-provisional"
        }
      ]
    });
    expect(gauge(audit, "dendro")).toBe(0.3);
    expect(gauge(audit, "hydro")).toBe(0);
  });

  it("B2: Dendro consumes Hydro at factor 2 and never attaches its remaining incoming gauge", () => {
    const audit = new AuraEngine({
      mode: "aura-v5",
      initialAura: [{ element: "hydro", gaugeUnits: 1 }]
    }).processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(1)
    });

    expect(audit.bloomReactions).toEqual([
      expect.objectContaining({
        operation: "direct",
        sourceGaugeUnitsBefore: 1,
        sourceGaugeUnitsSpent: 0.4,
        sourceGaugeUnitsAfter: 0.6,
        hydroGaugeUnitsBefore: 0.8,
        hydroConsumedGaugeUnits: 0.8,
        hydroGaugeUnitsAfter: 0
      })
    ]);
    expect(audit.reactions).toEqual(["bloom"]);
    expect(gauge(audit, "hydro")).toBe(0);
    expect(gauge(audit, "dendro")).toBe(0);
  });

  it("B3: Hydro independently consumes Dendro, Burning Fuel, and Quicken while spending only the maximum normalized source budget", () => {
    const engine = new AuraEngine({
      mode: "aura-v5"
    });
    seedModifierState(engine, {
      dendro: 0.6,
      burningFuel: 0.8,
      quicken: 0.4
    });

    const audit = engine.processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(1)
    });

    expect(audit.bloomReactions).toEqual([
      expect.objectContaining({
        sourceGaugeUnitsBefore: 1,
        sourceGaugeUnitsSpent: 1,
        sourceGaugeUnitsAfter: 0,
        dendroGaugeUnitsBefore: 0.6,
        dendroConsumedGaugeUnits: 0.5,
        dendroGaugeUnitsAfter: 0.1,
        burningFuelGaugeUnitsBefore: 0.8,
        burningFuelConsumedGaugeUnits: 0.5,
        burningFuelGaugeUnitsAfter: 0.3,
        quickenGaugeUnitsBefore: 0.4,
        quickenConsumedGaugeUnits: 0.4,
        quickenGaugeUnitsAfter: 0
      })
    ]);
    expect(gauge(audit, "dendro")).toBe(0.1);
    expect(gauge(audit, "burningFuel")).toBe(0.3);
    expect(gauge(audit, "quicken")).toBe(0);
  });

  it("rebases a partially consumed Burning Fuel expiry and leaves the old Fuel event observational", () => {
    const engine = new AuraEngine({
      mode: "aura-v5"
    });
    seedModifierState(engine, {
      burning: 2,
      burningFuel: 0.8,
      dendro: 1,
      quicken: 1
    });
    const internal = engine as unknown as {
      burningGeneration: number;
      quickenGeneration: number;
      resolveBloom: (
        input: {
          frame: number;
          sourceActorId: string;
          element: "hydro";
        },
        incomingGaugeUnits: number,
        runQuickenHydroFollowup: boolean,
        auraConsumed: unknown[]
      ) => {
        audits: BloomReactionAudit[];
      };
    };
    internal.burningGeneration = 7;
    internal.quickenGeneration = 11;

    const result = internal.resolveBloom(
      {
        frame: 0,
        sourceActorId: "hydro",
        element: "hydro"
      },
      0.2,
      false,
      []
    );
    const bloom = result.audits[0]!;

    expect(bloom.burningFuelStateMutation).toEqual({
      operation: "expiry-rebase",
      generation: 7,
      decayPerFrame: 1 / 150,
      expiresAtFrameBefore: 120,
      expiresAtFrameAfter: 105
    });
    expect(
      bloomReactionAuditSchema.parse(bloom)
    ).toEqual(bloom);

    const staleOldExpiry = engine.expireBurningFuel(
      120,
      7,
      120
    );
    expect(staleOldExpiry).toMatchObject({
      operation: "stale",
      fuelExpiresAtFrame: 105,
      reason: "BURNING_REFRESHED_BEFORE_EXPIRY"
    });
    expect(engine.getCurrentFrame()).toBe(0);
    expect(
      engine.getAuraStateAt(0).find(
        (entry) => entry.element === "burningFuel"
      )?.gaugeUnits
    ).toBeCloseTo(0.7, 12);

    const authoritativeExpiry = engine.expireBurningFuel(
      105,
      7,
      105
    );
    expect(authoritativeExpiry).toMatchObject({
      operation: "expire",
      frame: 105,
      quickenStateMutation: {
        operation: "remove",
        endCauseBefore: "BURNING_FUEL_EXPIRED",
        endCauseAfter: null
      },
      reason: "FUEL_EXPIRED"
    });
  });

  it("keeps a Fuel-depleted Burning marker through the trigger frame and purges its dependent Dendro states on the next frame", () => {
    const engine = new AuraEngine({
      mode: "aura-v5"
    });
    seedModifierState(engine, {
      burning: 2,
      burningFuel: 0.1,
      dendro: 1,
      quicken: 1
    });
    const internal = engine as unknown as {
      burningGeneration: number;
      burningNextTickFrame: number;
      burningNextTickIndex: number;
      quickenGeneration: number;
      resolveBloom: (
        input: {
          frame: number;
          sourceActorId: string;
          element: "hydro";
        },
        incomingGaugeUnits: number,
        runQuickenHydroFollowup: boolean,
        auraConsumed: unknown[]
      ) => {
        audits: BloomReactionAudit[];
      };
    };
    internal.burningGeneration = 7;
    internal.burningNextTickFrame = 15;
    internal.burningNextTickIndex = 1;
    internal.quickenGeneration = 11;

    const result = internal.resolveBloom(
      {
        frame: 0,
        sourceActorId: "hydro",
        element: "hydro"
      },
      0.2,
      false,
      []
    );
    const bloom = result.audits[0]!;

    expect(bloom.burningFuelStateMutation).toEqual({
      operation: "deplete-pending-purge",
      generation: 7,
      decayPerFrame: 1 / 150,
      expiresAtFrameBefore: 15,
      expiresAtFrameAfter: 1
    });
    expect(
      bloomReactionAuditSchema.parse(bloom)
    ).toEqual(bloom);
    expect(engine.getAuraStateAt(0)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "burning" }),
        expect.objectContaining({
          element: "dendro",
          gaugeUnits: 0.9
        }),
        expect.objectContaining({
          element: "quicken",
          gaugeUnits: 0.9
        })
      ])
    );
    expect(engine.getAuraStateAt(0)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "burningFuel" })
      ])
    );
    const authoritativePurge = engine.expireBurningFuel(
      1,
      7,
      1
    );
    expect(authoritativePurge).toMatchObject({
      operation: "expire",
      frame: 1,
      quickenStateMutation: {
        operation: "remove",
        generationBefore: 12,
        generationAfter: 13,
        endCauseBefore: "BURNING_FUEL_EXPIRED",
        endCauseAfter: null
      }
    });
    expect(authoritativePurge.auraAfter).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "burning" }),
        expect.objectContaining({ element: "dendro" }),
        expect.objectContaining({ element: "quicken" })
      ])
    );
    expect(internal.burningGeneration).toBe(8);
    // Bloom's same-frame partial Quicken consumption creates generation 12;
    // the next-frame dependent purge invalidates that shortened state too.
    expect(internal.quickenGeneration).toBe(13);

    const oldBurningTick = engine.prepareBurningTick(15, 7, 1);
    const oldQuickenExpiry = engine.expireQuicken(30, 11, 30);
    const purgedShortenedExpiry = engine.expireQuicken(
      31,
      12,
      594
    );
    expect(oldBurningTick).toMatchObject({
      operation: "stale",
      reason: "SUPERSEDED_STREAM"
    });
    expect(oldQuickenExpiry).toMatchObject({
      operation: "stale",
      reason: "STALE_QUICKEN_EXPIRY_CHECK"
    });
    expect(purgedShortenedExpiry).toMatchObject({
      operation: "stale",
      reason: "STALE_QUICKEN_EXPIRY_CHECK"
    });
  });

  it("cancels the next-frame Fuel-depletion purge when same-frame Dendro restarts Burning", () => {
    const engine = new AuraEngine({
      mode: "aura-v5"
    });
    seedModifierState(engine, {
      burning: 2,
      burningFuel: 0.1,
      dendro: 1,
      quicken: 1
    });
    const internal = engine as unknown as {
      burningGeneration: number;
      quickenGeneration: number;
      resolveBloom: (
        input: {
          frame: number;
          sourceActorId: string;
          element: "hydro";
        },
        incomingGaugeUnits: number,
        runQuickenHydroFollowup: boolean,
        auraConsumed: unknown[]
      ) => {
        audits: BloomReactionAudit[];
      };
    };
    internal.burningGeneration = 7;
    internal.quickenGeneration = 11;
    const result = internal.resolveBloom(
      {
        frame: 0,
        sourceActorId: "hydro",
        element: "hydro"
      },
      0.2,
      false,
      []
    );
    const depletedFuel =
      result.audits[0]!.burningFuelStateMutation;

    const restart = engine.processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(1)
    });

    expect(restart.burningReaction).toMatchObject({
      operation: "start",
      generation: 8,
      scheduled: true
    });
    const stalePendingPurge = engine.expireBurningFuel(
      depletedFuel.expiresAtFrameAfter!,
      depletedFuel.generation!,
      depletedFuel.expiresAtFrameAfter!
    );
    expect(stalePendingPurge).toMatchObject({
      operation: "stale",
      reason: "STALE_BURNING_FUEL_EXPIRY_CHECK"
    });
    expect(engine.getCurrentFrame()).toBe(0);
    expect(engine.getAuraStateAt(1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "burning" }),
        expect.objectContaining({ element: "burningFuel" }),
        expect.objectContaining({ element: "dendro" }),
        expect.objectContaining({ element: "quicken" })
      ])
    );
  });

  it("B4: Quicken resolves first, then its same-frame follow-up consumes Hydro without an incoming Dendro budget", () => {
    const engine = new AuraEngine({
      mode: "aura-v5",
      initialAura: [
        { element: "hydro", gaugeUnits: 1 },
        { element: "electro", gaugeUnits: 1 }
      ]
    });
    const audit = engine.processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(0.8)
    });

    expect(audit.catalyzeReaction?.quicken).toMatchObject({
      sourceGaugeUnitsBefore: 0.8,
      sourceGaugeUnitsSpent: 0.8,
      sourceGaugeUnitsAfter: 0,
      pendingHydroBloomFollowup: true
    });
    const quickenAttach =
      audit.catalyzeReaction?.quicken;
    expect(quickenAttach).not.toBeNull();
    expect(
      stateGauge(
        quickenAttach!.operationAuraBefore,
        "quicken"
      )
    ).toBe(0);
    expect(
      stateGauge(
        quickenAttach!.operationAuraAfter,
        "quicken"
      )
    ).toBe(0.8);
    expect(audit.bloomReactions).toEqual([
      expect.objectContaining({
        operation: "quicken-followup",
        sourceBudget: "quicken-state",
        sourceGaugeUnitsBefore: 0.8,
        sourceGaugeUnitsSpent: 0.4,
        sourceGaugeUnitsAfter: 0.4,
        hydroConsumedGaugeUnits: 0.8,
        quickenStateMutation: expect.objectContaining({
          operation: "partial-consume",
          generationBefore: 1,
          generationAfter: 2,
          expiresAtFrameBefore: 600,
          expiresAtFrameAfter: 300
        }),
        coreSpawnFrame: 30
      })
    ]);
    const partialMutation =
      audit.bloomReactions[0]!.quickenStateMutation;
    expect(
      stateGauge(
        partialMutation.operationAuraBefore,
        "quicken"
      )
    ).toBe(0.8);
    expect(
      stateGauge(
        partialMutation.operationAuraAfter,
        "quicken"
      )
    ).toBe(0.4);
    expect(
      stateGauge(
        partialMutation.operationAuraBefore,
        "hydro"
      )
    ).toBe(0.8);
    expect(
      stateGauge(
        partialMutation.operationAuraAfter,
        "hydro"
      )
    ).toBe(0.8);
    expect(audit.reactions).toEqual(["quicken", "bloom"]);
    expect(gauge(audit, "hydro")).toBe(0);
    expect(gauge(audit, "electro")).toBe(0);
    expect(gauge(audit, "quicken")).toBe(0.4);
    expect(
      bloomReactionAuditSchema.parse(
        audit.bloomReactions[0]
      )
    ).toEqual(audit.bloomReactions[0]);
    const shortenedState =
      engine.getQuickenLifecycleState();
    expect(shortenedState).toMatchObject({
      generation: 2,
      gaugeUnits: 0.4,
      expiresAtFrame: 300
    });
    expect(shortenedState.decayPerFrame).toBeCloseTo(
      1 / 750,
      15
    );

    const shortenedExpiry = engine.expireQuicken(
      300,
      2,
      300
    );
    const oldExpiry = engine.expireQuicken(600, 1, 600);
    expect(shortenedExpiry).toMatchObject({
      operation: "expire",
      expiresAtFrame: null,
      reason: "QUICKEN_DECAY_EXPIRED"
    });
    expect(oldExpiry).toMatchObject({
      operation: "stale",
      reason: "STALE_QUICKEN_EXPIRY_CHECK"
    });
  });

  it("invalidates the old Quicken expiry when the same-frame Bloom follow-up fully removes Quicken", () => {
    const engine = new AuraEngine({
      mode: "aura-v5",
      initialAura: [
        { element: "hydro", gaugeUnits: 2 },
        { element: "electro", gaugeUnits: 1 }
      ]
    });
    const audit = engine.processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(0.8)
    });

    expect(audit.catalyzeReaction?.quicken).toMatchObject({
      generation: 1,
      quickenGaugeUnitsAfter: 0.8,
      expiresAtFrame: 600
    });
    expect(audit.bloomReactions).toEqual([
      expect.objectContaining({
        operation: "quicken-followup",
        quickenGaugeUnitsBefore: 0.8,
        quickenConsumedGaugeUnits: 0.8,
        quickenGaugeUnitsAfter: 0,
        quickenStateMutation: expect.objectContaining({
          operation: "remove",
          generationBefore: 1,
          generationAfter: 2,
          expiresAtFrameBefore: 600,
          expiresAtFrameAfter: null
        })
      })
    ]);
    expect(engine.getQuickenLifecycleState()).toEqual({
      generation: 2,
      gaugeUnits: 0,
      decayPerFrame: 0,
      expiresAtFrame: null,
      endCause: null
    });
    const removalMutation =
      audit.bloomReactions[0]!.quickenStateMutation;
    expect(
      stateGauge(
        removalMutation.operationAuraBefore,
        "quicken"
      )
    ).toBe(0.8);
    expect(
      stateGauge(
        removalMutation.operationAuraAfter,
        "quicken"
      )
    ).toBe(0);
    expect(
      stateGauge(
        removalMutation.operationAuraBefore,
        "hydro"
      )
    ).toBe(1.6);
    expect(
      stateGauge(
        removalMutation.operationAuraAfter,
        "hydro"
      )
    ).toBe(1.6);
    expect(
      bloomReactionAuditSchema.parse(
        audit.bloomReactions[0]
      )
    ).toEqual(audit.bloomReactions[0]);
    expect(engine.expireQuicken(600, 1, 600)).toMatchObject({
      operation: "stale",
      reason: "STALE_QUICKEN_EXPIRY_CHECK"
    });
  });

  it("replays one authoritative Quicken expiry after a generic Aura read already crossed the exact boundary", () => {
    const engine = new AuraEngine({
      mode: "aura-v5",
      initialAura: [
        { element: "cryo", gaugeUnits: 1.2 },
        { element: "electro", gaugeUnits: 1 }
      ]
    });
    const start = engine.processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(1)
    });
    const quicken = start.catalyzeReaction?.quicken;

    expect(quicken).toMatchObject({
      operation: "start",
      generation: 1,
      quickenGaugeUnitsAfter: 0.8,
      expiresAtFrame: 600
    });
    expect(
      engine
        .getAuraStateAt(0)
        .find((entry) => entry.element === "cryo")
        ?.expiresAtFrame
    ).toBe(600);

    expect(engine.getAuraStateAt(600)).toEqual([]);
    const expiry = engine.expireQuicken(600, 1, 600);
    expect(expiry).toMatchObject({
      operation: "expire",
      quickenGaugeUnitsBefore: expect.any(Number),
      quickenGaugeUnitsAfter: 0,
      decayPerFrameBefore: quicken?.decayPerFrame,
      decayPerFrameAfter: 0,
      expiresAtFrameBefore: 600,
      expiresAtFrame: null,
      endCauseBefore: "QUICKEN_DECAY",
      endCauseAfter: null,
      reason: "QUICKEN_DECAY_EXPIRED"
    });
    expect(expiry.quickenGaugeUnitsBefore).toBeGreaterThan(0);
    expect(stateGauge(expiry.auraBefore, "quicken")).toBe(
      expiry.quickenGaugeUnitsBefore
    );
    expect(stateGauge(expiry.auraAfter, "quicken")).toBe(0);
    expect(stateGauge(expiry.auraBefore, "cryo")).toBe(0);
    expect(stateGauge(expiry.auraAfter, "cryo")).toBe(0);
    expect(
      quickenStateLogEntrySchema.parse({
        id: 0,
        reaction: "quicken",
        generation: 1,
        operation: "expire",
        frame: 600,
        timeSeconds: 10,
        targetId: "enemy-0",
        targetName: "Boundary target",
        sourceActorId: "dendro",
        triggerDamageEventId: 0,
        triggerElement: null,
        consumedAuraElement: null,
        candidateGaugeUnits: 0,
        quickenGaugeUnitsBefore:
          expiry.quickenGaugeUnitsBefore,
        quickenGaugeUnitsAfter:
          expiry.quickenGaugeUnitsAfter,
        decayPerFrameBefore:
          expiry.decayPerFrameBefore,
        decayPerFrameAfter:
          expiry.decayPerFrameAfter,
        expiresAtFrameBefore:
          expiry.expiresAtFrameBefore,
        auraBefore: expiry.auraBefore,
        auraAfter: expiry.auraAfter,
        expiresAtFrame: expiry.expiresAtFrame,
        endCauseBefore: expiry.endCauseBefore,
        endCauseAfter: expiry.endCauseAfter,
        reason: expiry.reason
      }).operation
    ).toBe("expire");

    expect(engine.expireQuicken(600, 1, 600)).toMatchObject({
      operation: "stale",
      quickenGaugeUnitsBefore: 0,
      quickenGaugeUnitsAfter: 0,
      reason: "STALE_QUICKEN_EXPIRY_CHECK"
    });
  });

  it("runs Electro's fixed EC → Quicken → same-frame Quicken-follow-up Bloom path without fail-closing", () => {
    const engine = new AuraEngine({
      mode: "aura-v5",
      initialAura: [
        { element: "hydro", gaugeUnits: 1 },
        { element: "dendro", gaugeUnits: 1 }
      ]
    });
    const audit = engine.processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(0.8)
    });

    expect(audit).toMatchObject({
      reaction: "electroCharged",
      reactions: [
        "electroCharged",
        "quicken",
        "bloom"
      ],
      unsupportedReactions: [],
      mechanicsTruncation: null,
      periodicReaction: {
        reaction: "electroCharged",
        operation: "start",
        firstDamageFrame: 10,
        nextTickFrame: 70,
        coexistenceExpiresAtFrame: null
      },
      catalyzeReaction: {
        quicken: {
          triggerElement: "electro",
          consumedAuraElement: "dendro",
          sourceGaugeUnitsBefore: 0.8,
          sourceGaugeUnitsSpent: 0.8,
          sourceGaugeUnitsAfter: 0,
          quickenGaugeUnitsAfter: 0.8,
          pendingHydroBloomFollowup: true
        }
      },
      bloomReactions: [
        {
          operation: "quicken-followup",
          triggerElement: "electro",
          sourceBudget: "quicken-state",
          sourceGaugeUnitsBefore: 0.8,
          sourceGaugeUnitsSpent: 0.4,
          sourceGaugeUnitsAfter: 0.4,
          hydroGaugeUnitsBefore: 0.8,
          hydroConsumedGaugeUnits: 0.8,
          hydroGaugeUnitsAfter: 0,
          quickenGaugeUnitsBefore: 0.8,
          quickenConsumedGaugeUnits: 0.4,
          quickenGaugeUnitsAfter: 0.4,
          quickenStateMutation: {
            operation: "partial-consume",
            generationBefore: 1,
            generationAfter: 2,
            expiresAtFrameBefore: 600,
            expiresAtFrameAfter: 300
          },
          scheduled: true,
          coreSpawnFrame: 30
        }
      ]
    });
    expect(gauge(audit, "electro")).toBe(0.64);
    expect(gauge(audit, "hydro")).toBe(0);
    expect(gauge(audit, "dendro")).toBe(0);
    expect(gauge(audit, "quicken")).toBe(0.4);
    expect(engine.getQuickenLifecycleState()).toMatchObject({
      generation: 2,
      gaugeUnits: 0.4,
      expiresAtFrame: 300
    });
    expect(
      bloomReactionAuditSchema.parse(
        audit.bloomReactions[0]
      )
    ).toEqual(audit.bloomReactions[0]);
  });

  it("B5: one Dendro application emits direct then Quicken-follow-up core requests in stable order", () => {
    const audit = new AuraEngine({
      mode: "aura-v5",
      initialAura: [
        { element: "hydro", gaugeUnits: 2.5 },
        { element: "electro", gaugeUnits: 1.25 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(1.5)
    });

    expect(audit.catalyzeReaction?.quicken).toMatchObject({
      sourceGaugeUnitsSpent: 1,
      sourceGaugeUnitsAfter: 0.5,
      quickenGaugeUnitsAfter: 1
    });
    expect(
      audit.bloomReactions.map((entry) => entry.operation)
    ).toEqual(["direct", "quicken-followup"]);
    expect(audit.bloomReactions).toEqual([
      expect.objectContaining({
        sourceBudget: "incoming-application",
        sourceGaugeUnitsBefore: 0.5,
        sourceGaugeUnitsSpent: 0.5,
        sourceGaugeUnitsAfter: 0,
        hydroGaugeUnitsBefore: 2,
        hydroConsumedGaugeUnits: 1,
        hydroGaugeUnitsAfter: 1,
        coreSpawnFrame: 30
      }),
      expect.objectContaining({
        sourceBudget: "quicken-state",
        sourceGaugeUnitsBefore: 1,
        sourceGaugeUnitsSpent: 0.5,
        sourceGaugeUnitsAfter: 0.5,
        hydroGaugeUnitsBefore: 1,
        hydroConsumedGaugeUnits: 1,
        hydroGaugeUnitsAfter: 0,
        coreSpawnFrame: 30
      })
    ]);
    expect(audit.reactions).toEqual([
      "quicken",
      "bloom",
      "bloom"
    ]);
    for (const bloom of audit.bloomReactions) {
      expect(bloomReactionAuditSchema.parse(bloom)).toEqual(
        bloom
      );
    }
    expect(gauge(audit, "hydro")).toBe(0);
    expect(gauge(audit, "electro")).toBe(0);
    expect(gauge(audit, "quicken")).toBe(0.5);
  });

  it("keeps Hydro's fixed Vaporize → Freeze → Bloom order and passes only the remaining incoming budget to Bloom", () => {
    const audit = new AuraEngine({
      mode: "aura-v5",
      initialAura: [
        { element: "pyro", gaugeUnits: 0.25 },
        { element: "cryo", gaugeUnits: 0.25 },
        { element: "dendro", gaugeUnits: 1 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(1)
    });

    expect(audit.reaction).toBe("vaporize");
    expect(audit.reactions).toEqual([
      "vaporize",
      "freeze",
      "bloom"
    ]);
    expect(audit.frozenReaction).toMatchObject({
      operation: "start",
      generatedGaugeUnits: 0.4
    });
    expect(audit.bloomReactions).toEqual([
      expect.objectContaining({
        sourceGaugeUnitsBefore: 0.7,
        sourceGaugeUnitsSpent: 0.7,
        sourceGaugeUnitsAfter: 0,
        dendroGaugeUnitsBefore: 0.8,
        dendroConsumedGaugeUnits: 0.35,
        dendroGaugeUnitsAfter: 0.45
      })
    ]);
  });

  it("continues from Bloom to a one-shot Electro-Charged first hit when incoming Hydro remains without attaching it", () => {
    const engine = new AuraEngine({
      mode: "aura-v5",
      initialAura: [
        { element: "dendro", gaugeUnits: 0.125 },
        { element: "electro", gaugeUnits: 1 }
      ]
    });
    const audit = engine.processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(1)
    });

    expect(audit.reactions).toEqual([
      "bloom",
      "electroCharged"
    ]);
    expect(audit.bloomReactions[0]).toMatchObject({
      sourceGaugeUnitsBefore: 1,
      sourceGaugeUnitsSpent: 0.2,
      sourceGaugeUnitsAfter: 0.8
    });
    expect(audit.periodicReaction).toMatchObject({
      operation: "start",
      firstDamageFrame: 10,
      nextTickFrame: 70,
      coexistenceExpiresAtFrame: null
    });
    expect(gauge(audit, "hydro")).toBe(0);
    expect(gauge(audit, "electro")).toBe(0.8);

    const sameFrameRefresh = engine.processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(1)
    });
    expect(sameFrameRefresh.periodicReaction).toMatchObject({
      generation: audit.periodicReaction?.generation,
      operation: "refresh",
      firstDamageFrame: null,
      nextTickFrame: 70
    });
  });

  it("keeps Dendro's Quicken → Burning → direct Bloom → Quicken-follow-up order", () => {
    const audit = new AuraEngine({
      mode: "aura-v5",
      initialAura: [
        { element: "hydro", gaugeUnits: 2.5 },
        { element: "electro", gaugeUnits: 1.25 },
        { element: "pyro", gaugeUnits: 0.25 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(1.5)
    });

    expect(audit.reactions).toEqual([
      "quicken",
      "burning",
      "bloom",
      "bloom"
    ]);
    expect(audit.burningReaction).toMatchObject({
      operation: "start",
      fuelGaugeUnitsAfter: 1
    });
    expect(
      audit.bloomReactions.map((entry) => entry.operation)
    ).toEqual(["direct", "quicken-followup"]);
  });

  it("does not resolve or schedule Bloom when normal ICD blocks the application", () => {
    const engine = new AuraEngine({
      mode: "aura-v5",
      initialAura: [{ element: "dendro", gaugeUnits: 2 }]
    });
    const allowed = engine.processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: defaultIcd(0.2)
    });
    const blocked = engine.processHit({
      frame: 1,
      sourceActorId: "hydro",
      element: "hydro",
      application: defaultIcd(1)
    });

    expect(allowed.bloomReactions).toHaveLength(1);
    expect(blocked).toMatchObject({
      icdAllowed: false,
      triggered: false,
      bloomReactions: []
    });
    expect(blocked.auraConsumed).toEqual([]);
    expect(gauge(blocked, "dendro")).toBeGreaterThan(0);
  });

  it("keeps aura-v4 Bloom fail-closed and emits no core request, including carried truncation", () => {
    const engine = new AuraEngine({
      mode: "aura-v4",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }]
    });
    const trigger = engine.processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(1)
    });
    const carried = engine.processHit({
      frame: 1,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(1)
    });

    expect(trigger).toMatchObject({
      unsupportedReactions: ["bloom"],
      mechanicsTruncation: {
        operation: "trigger",
        reason: "UNSUPPORTED_DENDRO_REACTION"
      },
      bloomReactions: []
    });
    expect(carried).toMatchObject({
      mechanicsTruncation: {
        operation: "carry"
      },
      bloomReactions: []
    });
  });

  it("does not falsely truncate aura-v4 when an earlier Vaporize exhausts the incoming Hydro budget", () => {
    const audit = new AuraEngine({
      mode: "aura-v4",
      initialAura: [
        { element: "dendro", gaugeUnits: 1 },
        { element: "pyro", gaugeUnits: 1 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(0.1)
    });

    expect(audit).toMatchObject({
      reaction: "vaporize",
      reactions: ["vaporize"],
      unsupportedReactions: [],
      mechanicsTruncation: null,
      bloomReactions: []
    });
    expect(gauge(audit, "dendro")).toBe(0.8);
  });

  it("still truncates aura-v4 when an earlier Vaporize leaves Hydro budget that can reach Bloom", () => {
    const audit = new AuraEngine({
      mode: "aura-v4",
      initialAura: [
        { element: "dendro", gaugeUnits: 1 },
        { element: "pyro", gaugeUnits: 0.125 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(1)
    });

    expect(audit).toMatchObject({
      reaction: "vaporize",
      reactions: ["vaporize"],
      unsupportedReactions: ["bloom"],
      mechanicsTruncation: {
        operation: "trigger",
        reason: "UNSUPPORTED_DENDRO_REACTION"
      },
      bloomReactions: []
    });
  });

  it("inherits aura-v4 ordered Pyro and Burning semantics in aura-v5", () => {
    const audit = new AuraEngine({
      mode: "aura-v5",
      initialAura: [
        { element: "electro", gaugeUnits: 1 },
        { element: "hydro", gaugeUnits: 1 },
        { element: "dendro", gaugeUnits: 1 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd(20)
    });

    expect(audit).toMatchObject({
      reaction: "reverseVaporize",
      reactions: [
        "overload",
        "reverseVaporize",
        "burning"
      ],
      transformativeReaction: {
        reaction: "overload",
        scheduled: true
      },
      burningReaction: {
        operation: "start",
        scheduled: true
      },
      bloomReactions: [],
      unsupportedReactions: [],
      mechanicsTruncation: null
    });
  });

  it("leaves all prior Aura modes without Bloom scheduling", () => {
    for (const mode of [
      "aura-v1",
      "aura-v2",
      "aura-v3",
      "aura-v4"
    ] as const satisfies readonly AuraEngineConfig["mode"][]) {
      const audit = new AuraEngine({
        mode,
        ...(mode === "aura-v1" || mode === "aura-v2"
          ? {}
          : {
              initialAura: [
                { element: "dendro" as const, gaugeUnits: 1 }
              ]
            })
      }).processHit({
        frame: 0,
        sourceActorId: "hydro",
        element: "hydro",
        application: noIcd(1)
      });
      expect(audit.bloomReactions).toEqual([]);
    }
  });
});
