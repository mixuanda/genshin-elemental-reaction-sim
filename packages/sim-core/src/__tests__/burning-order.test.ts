import { describe, expect, it } from "vitest";
import { AuraEngine } from "../aura";

function noIcd(gaugeUnits = 1) {
  return {
    gaugeUnits,
    icd: { mode: "no-icd-v1" as const }
  };
}

describe("aura-v4 fixed Pyro reaction order", () => {
  it("resolves Overload → reverse Vaporize → Burning and keeps the amplifying reaction primary", () => {
    const audit = new AuraEngine({
      mode: "aura-v4",
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
        reaction: "burning",
        operation: "start",
        scheduled: true
      },
      unsupportedReactions: [],
      mechanicsTruncation: null
    });
  });

  it("continues through Melt before Burning and makes Melt the direct-hit reaction", () => {
    const audit = new AuraEngine({
      mode: "aura-v4",
      initialAura: [
        { element: "electro", gaugeUnits: 1 },
        { element: "hydro", gaugeUnits: 1 },
        { element: "cryo", gaugeUnits: 1 },
        { element: "dendro", gaugeUnits: 1 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd(20)
    });

    expect(audit).toMatchObject({
      reaction: "melt",
      reactions: [
        "overload",
        "reverseVaporize",
        "melt",
        "burning"
      ],
      transformativeReaction: {
        reaction: "overload",
        scheduled: true
      },
      burningReaction: {
        reaction: "burning",
        operation: "start",
        scheduled: true
      },
      unsupportedReactions: [],
      mechanicsTruncation: null
    });
  });

  it("does not start or refresh Burning after an earlier reaction exhausts the incoming Pyro gauge", () => {
    const audit = new AuraEngine({
      mode: "aura-v4",
      initialAura: [
        { element: "electro", gaugeUnits: 1 },
        { element: "dendro", gaugeUnits: 1 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd(0.8)
    });

    expect(audit).toMatchObject({
      reaction: "overload",
      reactions: ["overload"],
      transformativeReaction: {
        reaction: "overload",
        scheduled: true
      },
      burningReaction: null
    });
    expect(audit.auraAfter).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "dendro" })
      ])
    );
    expect(audit.auraAfter).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "pyro" }),
        expect.objectContaining({ element: "burning" }),
        expect.objectContaining({ element: "burningFuel" })
      ])
    );
  });

  it("does not start Burning when Quicken exhausts the incoming Dendro gauge", () => {
    const audit = new AuraEngine({
      mode: "aura-v4",
      initialAura: [
        { element: "pyro", gaugeUnits: 1 },
        { element: "electro", gaugeUnits: 0.8 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(0.64)
    });

    expect(audit.catalyzeReaction?.quicken).toMatchObject({
      sourceGaugeUnitsBefore: 0.64,
      sourceGaugeUnitsSpent: 0.64,
      sourceGaugeUnitsAfter: 0
    });
    expect(audit.burningReaction).toBeNull();
    expect(audit.reactions).toEqual(["quicken"]);
  });

  it("starts Burning from only the Dendro gauge left after Quicken", () => {
    const audit = new AuraEngine({
      mode: "aura-v4",
      initialAura: [
        { element: "pyro", gaugeUnits: 1 },
        { element: "electro", gaugeUnits: 0.2 }
      ]
    }).processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(0.8)
    });

    expect(audit.catalyzeReaction?.quicken).toMatchObject({
      sourceGaugeUnitsBefore: 0.8,
      sourceGaugeUnitsSpent: 0.16,
      sourceGaugeUnitsAfter: 0.64
    });
    expect(audit.burningReaction).toMatchObject({
      operation: "start",
      candidateFuelGaugeUnits: 0.512,
      fuelGaugeUnitsAfter: 0.512
    });
    expect(audit.reactions).toEqual(["quicken", "burning"]);
  });

  it("fails closed when a non-Pyro hit can reach multiple ordered reactions", () => {
    const audit = new AuraEngine({
      mode: "aura-v4",
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
        operation: "trigger",
        reason: "UNSUPPORTED_REACTION_ORDER"
      },
      transformativeReaction: {
        reaction: "overload",
        scheduled: false,
        blockedReason: "TARGET_MECHANICS_TRUNCATION"
      },
      auraAfter: []
    });
    expect(audit.note).toContain(
      "非火入射在同一命中内仍可继续触发多个有序反应"
    );
    expect(audit.note).not.toContain("燃烧尚未实现");
  });
});

describe("aura-v4 Burning mapped-Pyro and expiry boundaries", () => {
  it("does not treat a pure Burning marker as ordinary Pyro for Anemo Swirl", () => {
    const engine = new AuraEngine({
      mode: "aura-v4",
      initialAura: [{ element: "pyro", gaugeUnits: 0.1 }]
    });
    const start = engine.processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(20)
    });
    const swirl = engine.processHit({
      frame: 436,
      sourceActorId: "anemo",
      element: "anemo",
      application: noIcd(20)
    });

    expect(start.burningReaction).toMatchObject({
      operation: "start",
      scheduled: true
    });
    expect(swirl.auraBefore).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "pyro" })
      ])
    );
    expect(swirl.auraBefore).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "burning" }),
        expect.objectContaining({ element: "burningFuel" })
      ])
    );
    expect(swirl).toMatchObject({
      reaction: "none",
      reactions: [],
      swirlReactions: [],
      burningReaction: null
    });
    expect(swirl.auraAfter).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "burning" }),
        expect.objectContaining({ element: "burningFuel" })
      ])
    );
  });

  it("allows Pyro Swirl when ordinary Pyro coexists with Burning and consumes both mapped states", () => {
    const engine = new AuraEngine({
      mode: "aura-v4",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }]
    });
    const start = engine.processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd()
    });
    const swirl = engine.processHit({
      frame: 1,
      sourceActorId: "anemo",
      element: "anemo",
      application: noIcd(20)
    });

    expect(start.auraAfter).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "pyro" }),
        expect.objectContaining({ element: "burning" }),
        expect.objectContaining({ element: "burningFuel" })
      ])
    );
    expect(swirl).toMatchObject({
      reaction: "swirlPyro",
      reactions: ["swirlPyro"],
      swirlReactions: [
        expect.objectContaining({
          reaction: "swirlPyro",
          consumedAuraElement: "pyro",
          scheduled: true
        })
      ],
      burningReaction: {
        operation: "stop",
        stopReason: "BURNING_AURA_CONSUMED"
      }
    });
    expect(swirl.auraConsumed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "pyro" }),
        expect.objectContaining({ element: "burning" })
      ])
    );
    expect(swirl.auraAfter).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "pyro" }),
        expect.objectContaining({ element: "burning" }),
        expect.objectContaining({ element: "burningFuel" })
      ])
    );
  });

  it("reports mapped Pyro durability after a partial Swirl consumption", () => {
    const engine = new AuraEngine({
      mode: "aura-v4",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }]
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd()
    });
    const swirl = engine.processHit({
      frame: 1,
      sourceActorId: "anemo",
      element: "anemo",
      application: noIcd()
    });

    expect(swirl.swirlReactions[0]).toMatchObject({
      reaction: "swirlPyro",
      auraGaugeUnitsBefore: 2,
      auraConsumedGaugeUnits: 0.5,
      auraGaugeUnitsAfter: 1.5
    });
    expect(swirl.auraAfter).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          element: "pyro"
        }),
        expect.objectContaining({
          element: "burning",
          gaugeUnits: 1.5
        })
      ])
    );
    expect(
      swirl.auraAfter?.find((entry) => entry.element === "pyro")
        ?.gaugeUnits
    ).toBeCloseTo(0.298596491228, 12);
  });

  it("reports the same 121f Fuel expiry in the start audit and Aura snapshot", () => {
    const audit = new AuraEngine({
      mode: "aura-v4",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }]
    }).processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd()
    });

    expect(audit.burningReaction).toMatchObject({
      operation: "start",
      fuelExpiresAtFrame: 121
    });
    expect(audit.auraAfter).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          element: "burningFuel",
          expiresAtFrame: 121
        })
      ])
    );
  });
});
