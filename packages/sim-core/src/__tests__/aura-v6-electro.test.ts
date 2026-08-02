import { describe, expect, it } from "vitest";
import { AuraEngine } from "../aura";

function noIcd(gaugeUnits = 1) {
  return {
    gaugeUnits,
    icd: { mode: "no-icd-v1" as const }
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

describe("aura-v6 incoming Electro ordered chain", () => {
  it("resolves Overload → EC → Superconduct → Quicken → Bloom with one shared Gauge budget", () => {
    const audit = new AuraEngine({
      mode: "aura-v6",
      initialAura: [
        { element: "pyro", gaugeUnits: 0.5 },
        { element: "hydro", gaugeUnits: 1 },
        { element: "cryo", gaugeUnits: 0.5 },
        { element: "dendro", gaugeUnits: 1 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(2)
    });

    expect(audit).toMatchObject({
      reaction: "overload",
      reactions: [
        "overload",
        "electroCharged",
        "superconduct",
        "quicken",
        "bloom"
      ],
      unsupportedReactions: [],
      mechanicsTruncation: null,
      auraConsumed: [
        { element: "pyro", gaugeUnits: 0.4 },
        { element: "cryo", gaugeUnits: 0.4 },
        { element: "dendro", gaugeUnits: 0.8 },
        { element: "quicken", gaugeUnits: 0.4 },
        { element: "hydro", gaugeUnits: 0.8 }
      ],
      auraAfter: [
        { element: "quicken", gaugeUnits: 0.4 }
      ],
      periodicReaction: {
        reaction: "electroCharged",
        operation: "start",
        firstDamageFrame: 10,
        nextTickFrame: 70,
        coexistenceExpiresAtFrame: null
      },
      catalyzeReaction: {
        quicken: {
          sourceGaugeUnitsBefore: 1.2,
          sourceGaugeUnitsSpent: 0.8,
          sourceGaugeUnitsAfter: 0.4,
          pendingHydroBloomFollowup: true
        }
      },
      bloomReactions: [
        {
          operation: "quicken-followup",
          triggerElement: "electro",
          sourceGaugeUnitsBefore: 0.8,
          sourceGaugeUnitsSpent: 0.4,
          sourceGaugeUnitsAfter: 0.4,
          scheduled: true,
          coreSpawnFrame: 30
        }
      ]
    });
    expect(audit.transformativeReactions).toMatchObject([
      {
        reaction: "overload",
        scheduled: true,
        damageFrame: 1
      },
      {
        reaction: "superconduct",
        scheduled: true,
        damageFrame: 1
      }
    ]);
    expect(audit.transformativeReaction).toEqual(
      audit.transformativeReactions?.[0]
    );
    expect(gauge(audit, "electro")).toBe(0);

    for (const entry of [
      ...(audit.auraBefore ?? []),
      ...(audit.auraAfter ?? []),
      ...(audit.auraConsumed ?? [])
    ]) {
      expect(entry.gaugeUnits).toBeGreaterThanOrEqual(0);
    }
    for (const mutation of audit.auraConsumed?.flatMap(
      (entry) => entry.sourceMutations ?? []
    ) ?? []) {
      expect(mutation.gaugeUnitsAfter).toBeGreaterThanOrEqual(0);
      expect(
        mutation.consumedGaugeUnits +
          mutation.gaugeUnitsAfter
      ).toBeCloseTo(mutation.gaugeUnitsBefore, 12);
    }
  });

  it("runs Frozen Superconduct once, consumes Cryo first, and blocks later Quicken", () => {
    const engine = new AuraEngine({
      mode: "aura-v6",
      initialAura: [
        { element: "cryo", gaugeUnits: 2 },
        { element: "dendro", gaugeUnits: 1 }
      ]
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(1)
    });

    const audit = engine.processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(1.5)
    });

    expect(audit).toMatchObject({
      reaction: "superconduct",
      reactions: ["superconduct"],
      auraConsumed: [
        { element: "cryo", gaugeUnits: 0.6 },
        { element: "frozen", gaugeUnits: 0.9 }
      ],
      frozenReaction: {
        operation: "consume",
        consumedGaugeUnits: 0.9,
        frozenGaugeBefore: 2,
        frozenGaugeAfter: 1.1
      },
      catalyzeReaction: null
    });
    expect(audit.transformativeReactions).toHaveLength(1);
    expect(gauge(audit, "dendro")).toBe(0.8);
    expect(gauge(audit, "electro")).toBe(0);
  });

  it("still triggers Frozen Superconduct when ordinary Cryo spends the full incoming budget", () => {
    const engine = new AuraEngine({
      mode: "aura-v6",
      initialAura: [{ element: "cryo", gaugeUnits: 2 }]
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(0.5)
    });

    const audit = engine.processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(1.1)
    });

    expect(audit).toMatchObject({
      reactions: ["superconduct"],
      auraConsumed: [
        { element: "cryo", gaugeUnits: 1.1 }
      ],
      frozenReaction: null,
      auraAfter: [
        expect.objectContaining({
          element: "frozen",
          gaugeUnits: 1
        })
      ]
    });
    expect(audit.transformativeReactions).toMatchObject([
      { reaction: "superconduct", scheduled: true }
    ]);
  });

  it("emits Aggravate first without consuming Quicken and still attaches Electro", () => {
    const engine = new AuraEngine({
      mode: "aura-v6",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }]
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "starter",
      element: "electro",
      application: noIcd(1)
    });

    const audit = engine.processHit({
      frame: 0,
      sourceActorId: "aggravate",
      element: "electro",
      application: noIcd(1)
    });

    expect(audit).toMatchObject({
      reaction: "aggravate",
      reactions: ["aggravate"],
      catalyzeReaction: {
        quicken: null,
        additive: {
          reaction: "aggravate",
          quickenGaugeUnitsBefore: 0.8,
          quickenGaugeUnitsAfter: 0.8,
          consumedQuickenGaugeUnits: 0
        }
      },
      transformativeReactions: []
    });
    expect(gauge(audit, "quicken")).toBe(0.8);
    expect(gauge(audit, "electro")).toBe(0.8);
  });

  it("inherits aura-v5 Burning and Bloom semantics", () => {
    const burning = (mode: "aura-v5" | "aura-v6") =>
      new AuraEngine({
        mode,
        initialAura: [{ element: "dendro", gaugeUnits: 1 }]
      }).processHit({
        frame: 0,
        sourceActorId: "pyro",
        element: "pyro",
        application: noIcd(1)
      });
    const bloom = (mode: "aura-v5" | "aura-v6") =>
      new AuraEngine({
        mode,
        initialAura: [{ element: "dendro", gaugeUnits: 1 }]
      }).processHit({
        frame: 0,
        sourceActorId: "hydro",
        element: "hydro",
        application: noIcd(1)
      });

    expect(burning("aura-v6")).toEqual(
      burning("aura-v5")
    );
    expect(bloom("aura-v6")).toEqual(bloom("aura-v5"));
  });

  it("keeps aura-v5 multi-reaction fail-closed and does not add the v6 array field", () => {
    const audit = new AuraEngine({
      mode: "aura-v5",
      initialAura: [
        { element: "pyro", gaugeUnits: 1 },
        { element: "cryo", gaugeUnits: 1 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(20)
    });

    expect(audit).toMatchObject({
      reaction: "overload",
      reactions: ["overload"],
      unsupportedReactions: [
        "non-pyro-multi-reaction-order"
      ],
      mechanicsTruncation: {
        reason: "UNSUPPORTED_REACTION_ORDER"
      },
      auraAfter: [],
      transformativeReaction: {
        reaction: "overload",
        scheduled: false,
        blockedReason: "TARGET_MECHANICS_TRUNCATION"
      }
    });
    expect("transformativeReactions" in audit).toBe(false);
  });
});
