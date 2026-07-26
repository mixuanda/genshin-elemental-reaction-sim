import { describe, expect, it } from "vitest";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import { AuraEngine } from "../aura";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function noIcd(gaugeUnits = 1) {
  return {
    gaugeUnits,
    icdTag: "none",
    icdGroup: "no-icd" as const
  };
}

function defaultIcd(tag = "attack", gaugeUnits = 1) {
  return {
    gaugeUnits,
    icdTag: tag,
    icdGroup: "default" as const
  };
}

describe("AuraEngine normal aura and amplifying reactions", () => {
  it("consumes a 1U Cryo aura with a 1U Pyro forward Melt", () => {
    const engine = new AuraEngine({
      mode: "aura-v1",
      initialAura: [{ element: "cryo", gaugeUnits: 1 }]
    });

    const audit = engine.processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd()
    });

    expect(audit).toMatchObject({
      model: "aura-engine",
      triggered: true,
      reaction: "melt",
      icdAllowed: true,
      applicationGaugeUnits: 1,
      auraBefore: [{ element: "cryo", gaugeUnits: 0.8 }],
      auraApplied: [{ element: "pyro", gaugeUnits: 1 }],
      auraConsumed: [{ element: "cryo", gaugeUnits: 0.8 }],
      auraAfter: []
    });
  });

  it("keeps the correct residual aura for reverse Melt and reverse Vaporize", () => {
    const melt = new AuraEngine({
      mode: "aura-v1",
      initialAura: [{ element: "pyro", gaugeUnits: 1 }]
    }).processHit({
      frame: 0,
      sourceActorId: "cryo",
      element: "cryo",
      application: noIcd()
    });
    const vaporize = new AuraEngine({
      mode: "aura-v1",
      initialAura: [{ element: "hydro", gaugeUnits: 1 }]
    }).processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd()
    });

    expect(melt.reaction).toBe("reverseMelt");
    expect(melt.auraConsumed).toEqual([
      { element: "pyro", gaugeUnits: 0.5 }
    ]);
    expect(melt.auraAfter).toMatchObject([
      { element: "pyro", gaugeUnits: 0.3 }
    ]);
    expect(vaporize.reaction).toBe("reverseVaporize");
    expect(vaporize.auraConsumed).toEqual([
      { element: "hydro", gaugeUnits: 0.5 }
    ]);
    expect(vaporize.auraAfter).toMatchObject([
      { element: "hydro", gaugeUnits: 0.3 }
    ]);
  });

  it("supports forward Vaporize and removes the weaker Pyro aura", () => {
    const audit = new AuraEngine({
      mode: "aura-v1",
      initialAura: [{ element: "pyro", gaugeUnits: 1 }]
    }).processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd()
    });

    expect(audit.reaction).toBe("vaporize");
    expect(audit.auraConsumed).toEqual([
      { element: "pyro", gaugeUnits: 0.8 }
    ]);
    expect(audit.auraAfter).toEqual([]);
  });

  it("decays a normal 1U aura to zero after 426 frames", () => {
    const engine = new AuraEngine({
      mode: "aura-v1",
      initialAura: [{ element: "cryo", gaugeUnits: 1 }]
    });
    const beforeExpiry = engine.processHit({
      frame: 425,
      sourceActorId: "observer",
      element: "physical"
    });
    const atExpiry = engine.processHit({
      frame: 426,
      sourceActorId: "observer",
      element: "physical"
    });

    expect(beforeExpiry.auraBefore?.[0]?.gaugeUnits).toBeCloseTo(
      0.8 / 426,
      12
    );
    expect(beforeExpiry.auraBefore?.[0]?.expiresAtFrame).toBe(426);
    expect(atExpiry.auraBefore).toEqual([]);
  });
});

describe("AuraEngine ICD", () => {
  it("uses the default 3-hit elemental application sequence", () => {
    const engine = new AuraEngine({ mode: "aura-v1" });
    const allowed = [0, 1, 2, 3].map(
      (frame) =>
        engine.processHit({
          frame,
          sourceActorId: "a",
          element: "pyro",
          application: defaultIcd("normal")
        }).icdAllowed
    );

    expect(allowed).toEqual([true, false, false, true]);
  });

  it("resets default ICD at the 150-frame boundary", () => {
    const engine = new AuraEngine({ mode: "aura-v1" });
    const hit = (frame: number) =>
      engine.processHit({
        frame,
        sourceActorId: "a",
        element: "pyro",
        application: defaultIcd("skill")
      }).icdAllowed;

    expect([hit(0), hit(1), hit(150)]).toEqual([true, false, true]);
  });

  it("keeps actor/tag/group streams independent and supports no ICD", () => {
    const engine = new AuraEngine({ mode: "aura-v1" });
    const apply = (
      actor: string,
      tag: string,
      group: string
    ) =>
      engine.processHit({
        frame: 0,
        sourceActorId: actor,
        element: "hydro",
        application: {
          gaugeUnits: 1,
          icdTag: tag,
          icdGroup: group
        }
      }).icdAllowed;

    expect(apply("a", "shared", "default")).toBe(true);
    expect(apply("a", "shared", "default")).toBe(false);
    expect(apply("a", "other", "default")).toBe(true);
    expect(apply("b", "shared", "default")).toBe(true);
    expect(apply("a", "shared", "no-icd")).toBe(true);
    expect(apply("a", "shared", "no-icd")).toBe(true);
  });

  it("supports a declared character-specific reset and application sequence", () => {
    const engine = new AuraEngine({
      mode: "aura-v1",
      icdProfiles: {
        "durin-skill": {
          resetFrames: 18,
          applicationSequence: [true, false, false]
        }
      }
    });
    const hit = (frame: number) =>
      engine.processHit({
        frame,
        sourceActorId: "durin",
        element: "pyro",
        application: {
          gaugeUnits: 1,
          icdTag: "denial-of-darkness",
          icdGroup: "durin-skill"
        }
      }).icdAllowed;

    expect([hit(0), hit(5), hit(10), hit(18)]).toEqual([
      true,
      false,
      false,
      true
    ]);
  });

  it("fails loudly when direct engine use references an undeclared profile", () => {
    const engine = new AuraEngine({ mode: "aura-v1" });
    expect(() =>
      engine.processHit({
        frame: 0,
        sourceActorId: "durin",
        element: "pyro",
        application: {
          gaugeUnits: 1,
          icdTag: "skill",
          icdGroup: "missing-profile"
        }
      })
    ).toThrow(/Unknown ICD profile/);
  });
});

describe("AuraEngine Overload scheduling", () => {
  it("supports both Pyro-on-Electro and Electro-on-Pyro", () => {
    const pyroIncoming = new AuraEngine({
      mode: "aura-v2",
      initialAura: [{ element: "electro", gaugeUnits: 1 }]
    }).processHit({
      frame: 10,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd()
    });
    const electroIncoming = new AuraEngine({
      mode: "aura-v2",
      initialAura: [{ element: "pyro", gaugeUnits: 1 }]
    }).processHit({
      frame: 10,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd()
    });

    for (const audit of [pyroIncoming, electroIncoming]) {
      expect(audit.reaction).toBe("overload");
      expect(audit.auraConsumed?.[0]?.gaugeUnits).toBeCloseTo(
        0.8 - (0.8 / 426) * 10,
        10
      );
      expect(audit.transformativeReaction).toMatchObject({
        reaction: "overload",
        damageElement: "pyro",
        scheduled: true,
        damageFrame: 11,
        radius: 3,
        baseMultiplier: 2.75,
        blockedReason: null,
        nextAvailableFrame: 16
      });
    }
  });

  it("consumes Aura even when the 6-frame damage GCD blocks the explosion", () => {
    const engine = new AuraEngine({
      mode: "aura-v2",
      initialAura: [{ element: "electro", gaugeUnits: 3 }]
    });
    const hit = (frame: number) =>
      engine.processHit({
        frame,
        sourceActorId: "pyro",
        element: "pyro",
        application: noIcd()
      });

    const first = hit(0);
    const blocked = hit(5);
    const boundary = hit(6);

    expect(first.transformativeReaction).toMatchObject({
      scheduled: true,
      nextAvailableFrame: 6
    });
    expect(blocked).toMatchObject({
      triggered: true,
      reaction: "overload",
      transformativeReaction: {
        scheduled: false,
        blockedReason: "REACTION_DAMAGE_GCD",
        nextAvailableFrame: 6
      }
    });
    expect(blocked.auraConsumed?.[0]?.gaugeUnits).toBeGreaterThan(0);
    expect(boundary.transformativeReaction).toMatchObject({
      scheduled: true,
      blockedReason: null,
      damageFrame: 7,
      nextAvailableFrame: 12
    });
  });
});

function makeAuraTimelineConfig(initialAura: boolean): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    duration: 2,
    cycleLength: 2,
    characters: [
      {
        ...base.characters[0]!,
        id: "pyro",
        name: "Pyro",
        initialEnergy: 60,
        stats: { ...neutralStats, baseAtk: 1000 }
      }
    ],
    rotation: [],
    reactionEngine: {
      mode: "aura-v1",
      ...(initialAura
        ? { initialAura: [{ element: "cryo" as const, gaugeUnits: 1 }] }
        : {})
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "pyro",
      swapFrames: 12,
      abilities: [
        {
          id: "pyro-skill",
          actorId: "pyro",
          name: "Pyro Skill",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "pyro-hit",
              frame: 0,
              scaling: 1,
              element: "pyro",
              application: noIcd()
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "pyro",
          abilityId: "pyro-skill"
        }
      ]
    }
  };
}

describe("Aura engine simulation integration", () => {
  it("feeds automatic reaction state into damage and the structured timeline", () => {
    const result = simulate(makeAuraTimelineConfig(true), {
      critMode: "noCrit"
    });
    const hit = result.damageEvents[0]!;

    expect(hit.reaction).toBe("melt");
    expect(hit.damageFactors.reactionBase).toBe(2);
    expect(hit.reactionAudit.model).toBe("aura-engine");
    expect(result.auraTimeline).toHaveLength(1);
    expect(result.auraTimeline[0]).toMatchObject({
      hitId: "pyro-hit",
      reaction: "melt",
      auraConsumed: [{ element: "cryo", gaugeUnits: 0.8 }],
      auraAfter: []
    });
  });

  it("does not trigger Melt when the enemy has no Aura", () => {
    const result = simulate(makeAuraTimelineConfig(false), {
      critMode: "noCrit"
    });

    expect(result.damageEvents[0]?.reaction).toBe("none");
    expect(result.damageEvents[0]?.damageFactors.reactionBase).toBe(1);
  });

  it("rejects a formal aura-v1 preset that manually labels Melt", () => {
    const config = makeAuraTimelineConfig(false);
    config.timeline!.abilities[0]!.hits![0]!.reaction = "melt";

    expect(() => simulate(config)).toThrow(
      /manual reaction labels are forbidden in aura-v1/
    );
  });

  it("rejects undeclared custom ICD groups before simulation starts", () => {
    const config = makeAuraTimelineConfig(false);
    config.timeline!.abilities[0]!.hits![0]!.application!.icdGroup =
      "missing-profile";

    expect(() => simulate(config)).toThrow(
      /unknown ICD profile "missing-profile"/
    );
  });
});
