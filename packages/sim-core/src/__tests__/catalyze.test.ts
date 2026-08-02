import { describe, expect, it } from "vitest";
import {
  assertTrustedSimulationResult,
  createVersionedContentHash,
  simulationResultSchema,
  type SimConfig,
} from "@genshin-dps-lab/schemas";
import { AuraEngine } from "../aura";
import {
  calcAdditiveReactionDamage,
  calcTransformativeReactionDamage,
} from "../formulas";
import { simulate } from "../simulator";
import {
  defineDamageModifierPlugin,
  type DamagePluginChanges,
  type DamagePluginContext,
} from "../plugins";
import { makeConfig, neutralStats } from "./fixtures";

function testDamagePlugin(
  id: string,
  modifyDamage: (context: DamagePluginContext) => DamagePluginChanges | void,
) {
  return defineDamageModifierPlugin(
    {
      id,
      version: "1.0.0-test",
      kind: "code",
      contentHash: createVersionedContentHash({
        testPlugin: id,
      }),
    },
    () => ({ modifyDamage }),
  );
}

function noIcd(gaugeUnits = 1) {
  return {
    gaugeUnits,
    icd: { mode: "no-icd-v1" as const },
  };
}

describe("aura-v3 Dendro and Catalyze", () => {
  it.each(["pyro", "cryo", "hydro", "electro", "dendro"] as const)(
    "uses the fixed 25-durability U conversion for a 570-frame 1U $0 aura",
    (element) => {
      const engine = new AuraEngine({
        mode: "aura-v3",
        initialAura: [{ element, gaugeUnits: 1 }],
      });
      const beforeExpiry = engine.processHit({
        frame: 569,
        sourceActorId: "observer",
        element: "physical",
      });
      const atExpiry = engine.processHit({
        frame: 570,
        sourceActorId: "observer",
        element: "physical",
      });

      expect(beforeExpiry.auraBefore).toEqual([
        {
          element,
          gaugeUnits: expect.closeTo(0.8 / 570, 12),
          expiresAtFrame: 570,
          sourceSlots: [
            {
              sourceActorId: "__initial__",
              gaugeUnits: expect.closeTo(0.8 / 570, 12),
            },
          ],
        },
      ]);
      expect(atExpiry.auraBefore).toEqual([]);
    },
  );

  it.each([
    {
      initialElement: "dendro" as const,
      triggerElement: "electro" as const,
      consumedElement: "dendro" as const,
    },
    {
      initialElement: "electro" as const,
      triggerElement: "dendro" as const,
      consumedElement: "electro" as const,
    },
  ])(
    "creates a 0.8U / 600-frame Quicken state for $triggerElement on $initialElement",
    ({ initialElement, triggerElement, consumedElement }) => {
      const audit = new AuraEngine({
        mode: "aura-v3",
        initialAura: [{ element: initialElement, gaugeUnits: 1 }],
      }).processHit({
        frame: 0,
        sourceActorId: "trigger",
        element: triggerElement,
        application: noIcd(),
      });

      expect(audit).toMatchObject({
        reaction: "quicken",
        reactions: ["quicken"],
        auraConsumed: [
          {
            element: consumedElement,
            gaugeUnits: 0.8,
          },
        ],
        catalyzeReaction: {
          additive: null,
          quicken: {
            triggerElement,
            consumedAuraElement: consumedElement,
            sourceGaugeUnitsBefore: 1,
            sourceGaugeUnitsSpent: 0.8,
            sourceGaugeUnitsAfter: 0.2,
            candidateGaugeUnits: 0.8,
            quickenGaugeUnitsAfter: 0.8,
            operation: "start",
            generation: 1,
            expiresAtFrame: 600,
          },
        },
      });
      expect(audit.auraAfter).toEqual([
        {
          element: "quicken",
          gaugeUnits: 0.8,
          expiresAtFrame: 600,
          sourceSlots: [
            {
              sourceActorId: "trigger",
              gaugeUnits: 0.8,
            },
          ],
        },
      ]);
    },
  );

  it("keeps source slots independent and reduces every Dendro owner on Quicken", () => {
    const engine = new AuraEngine({ mode: "aura-v3" });
    engine.processHit({
      frame: 0,
      sourceActorId: "dendro-1",
      element: "dendro",
      application: noIcd(1),
    });
    const overlap = engine.processHit({
      frame: 1,
      sourceActorId: "dendro-2",
      element: "dendro",
      application: noIcd(2),
    });
    const quicken = engine.processHit({
      frame: 2,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(1),
    });

    expect(overlap.auraAfter?.[0]).toMatchObject({
      element: "dendro",
      gaugeUnits: 1.6,
      sourceSlots: [
        {
          sourceActorId: "dendro-1",
          gaugeUnits: expect.closeTo(0.8 - 0.8 / 570, 12),
        },
        {
          sourceActorId: "dendro-2",
          gaugeUnits: 1.6,
        },
      ],
    });
    expect(quicken.auraConsumed?.[0]).toMatchObject({
      element: "dendro",
      gaugeUnits: 1,
      sourceMutations: [
        {
          sourceActorId: "dendro-1",
          consumedGaugeUnits: expect.closeTo(0.8 - (2 * 0.8) / 570, 12),
          gaugeUnitsAfter: 0,
        },
        {
          sourceActorId: "dendro-2",
          consumedGaugeUnits: 1,
          gaugeUnitsAfter: expect.closeTo(0.6 - 0.8 / 570, 12),
        },
      ],
    });
    expect(
      quicken.auraAfter?.find((entry) => entry.element === "dendro"),
    ).toMatchObject({
      sourceSlots: [
        {
          sourceActorId: "dendro-2",
          gaugeUnits: expect.closeTo(0.6 - 0.8 / 570, 12),
        },
      ],
    });
  });

  it("does not consume Quicken on Aggravate and preserves Spread → Quicken order", () => {
    const engine = new AuraEngine({
      mode: "aura-v3",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }],
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(),
    });
    const aggravate = engine.processHit({
      frame: 1,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(),
    });
    const spreadAndQuicken = engine.processHit({
      frame: 2,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(),
    });

    expect(aggravate).toMatchObject({
      reaction: "aggravate",
      reactions: ["aggravate"],
      catalyzeReaction: {
        additive: {
          reaction: "aggravate",
          consumedQuickenGaugeUnits: 0,
        },
        quicken: null,
      },
    });
    expect(
      aggravate.auraBefore?.find((entry) => entry.element === "quicken")
        ?.gaugeUnits,
    ).toBeCloseTo(
      aggravate.auraAfter?.find((entry) => entry.element === "quicken")
        ?.gaugeUnits ?? 0,
      12,
    );
    expect(spreadAndQuicken).toMatchObject({
      reaction: "spread",
      reactions: ["spread", "quicken"],
      catalyzeReaction: {
        additive: {
          reaction: "spread",
          consumedQuickenGaugeUnits: 0,
        },
        quicken: {
          reaction: "quicken",
          consumedAuraElement: "electro",
        },
      },
    });
  });

  it("keeps a standalone Spread audit symmetric and non-consuming", () => {
    const engine = new AuraEngine({
      mode: "aura-v3",
      initialAura: [{ element: "electro", gaugeUnits: 1 }],
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(),
    });
    const spread = engine.processHit({
      frame: 1,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(),
    });
    const additive = spread.catalyzeReaction?.additive;

    expect(spread).toMatchObject({
      reaction: "spread",
      reactions: ["spread"],
      catalyzeReaction: {
        quicken: null,
        additive: {
          reaction: "spread",
          triggerElement: "dendro",
          consumedQuickenGaugeUnits: 0,
        },
      },
    });
    expect(additive?.quickenGaugeUnitsBefore).toBeGreaterThan(0);
    expect(additive?.quickenGaugeUnitsAfter).toBeCloseTo(
      additive?.quickenGaugeUnitsBefore ?? 0,
      12,
    );
  });

  it("rejects coordinated shared-result additive Quicken Gauge drift", () => {
    const result = simulate(makeCatalyzeSimulationConfig(), {
      critMode: "allCrit",
    });
    const aggravate = result.damageEvents.find(
      (event) => event.hitId === "aggravate-hit",
    );
    if (aggravate === undefined) {
      throw new Error("Catalyze fixture must produce Aggravate.");
    }
    expect(simulationResultSchema.parse(result)).toEqual(result);

    for (const [quickenGaugeUnitsBefore, quickenGaugeUnitsAfter] of [
      [0.8, 0.7],
      [1e12, 1e12 - 1_000],
      [5e-10, 0],
    ] as const) {
      const forged = structuredClone(result);
      for (const event of [...forged.damageEvents, ...forged.hitEvents]) {
        if (event.id !== aggravate.id) continue;
        const additive = event.reactionAudit.catalyzeReaction?.additive;
        if (additive === null || additive === undefined) {
          throw new Error("Catalyze fixture must expose an additive audit.");
        }
        additive.quickenGaugeUnitsBefore = quickenGaugeUnitsBefore;
        additive.quickenGaugeUnitsAfter = quickenGaugeUnitsAfter;
      }

      expect(simulationResultSchema.safeParse(forged).success).toBe(false);
      expect(() => assertTrustedSimulationResult(forged)).toThrow(
        /Trusted SimulationResult 1\.51 integrity validation failed/,
      );
    }
  });

  it("audits a weaker Quicken candidate without refreshing the existing state", () => {
    const engine = new AuraEngine({
      mode: "aura-v3",
      initialAura: [{ element: "dendro", gaugeUnits: 2 }],
    });
    engine.processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(2),
    });
    engine.processHit({
      frame: 1,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(),
    });
    const audit = engine.processHit({
      frame: 2,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(0.5),
    });

    expect(audit.catalyzeReaction?.quicken).toMatchObject({
      candidateGaugeUnits: 0.5,
      operation: "unchanged",
      generation: 1,
      expiresAtFrame: 840,
    });
  });

  it("blocks Catalyze together with elemental application when ICD fails", () => {
    const engine = new AuraEngine({
      mode: "aura-v3",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }],
    });
    const application = {
      gaugeUnits: 1,
      icd: {
        mode: "legacy-boolean-profile-v1" as const,
        icdTag: "normal",
        profileId: "default",
      },
    };
    engine.processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application,
    });
    const blocked = engine.processHit({
      frame: 1,
      sourceActorId: "electro",
      element: "electro",
      application,
    });

    expect(blocked).toMatchObject({
      triggered: false,
      reaction: "none",
      reactions: [],
      icdAllowed: false,
      catalyzeReaction: null,
    });
  });

  it("reports Bloom and Burning prerequisites as structured unsupported reactions", () => {
    const bloom = new AuraEngine({
      mode: "aura-v3",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }],
    }).processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(),
    });
    const burning = new AuraEngine({
      mode: "aura-v3",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }],
    }).processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd(),
    });

    expect(bloom.unsupportedReactions).toEqual(["bloom"]);
    expect(bloom.note).toMatch(/草原核实体尚未实现/);
    expect(bloom.auraAfter).toEqual([]);
    expect(bloom.mechanicsTruncation).toMatchObject({
      operation: "trigger",
      startedAtFrame: 0,
      unsupportedReactions: ["bloom"],
      discardedAura: [
        expect.objectContaining({
          element: "dendro",
          gaugeUnits: 0.8,
        }),
      ],
      reason: "UNSUPPORTED_DENDRO_REACTION",
    });
    expect(burning.unsupportedReactions).toEqual(["burning"]);
    expect(burning.note).toMatch(/燃烧燃料、周期伤害/);
    expect(burning.auraAfter).toEqual([]);
    expect(burning.mechanicsTruncation).toMatchObject({
      operation: "trigger",
      unsupportedReactions: ["burning"],
    });
  });

  it("fails closed after Dendro → Hydro so later Electro hits cannot invent Quicken or Aggravate", () => {
    const engine = new AuraEngine({
      mode: "aura-v3",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }],
    });
    const bloom = engine.processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(),
    });
    const firstElectro = engine.processHit({
      frame: 1,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(),
    });
    const secondElectro = engine.processHit({
      frame: 2,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(),
    });

    expect(bloom.mechanicsTruncation?.operation).toBe("trigger");
    for (const audit of [firstElectro, secondElectro]) {
      expect(audit).toMatchObject({
        triggered: false,
        reaction: "none",
        reactions: [],
        unsupportedReactions: ["bloom"],
        mechanicsTruncation: {
          operation: "carry",
          startedAtFrame: 0,
          unsupportedReactions: ["bloom"],
        },
        auraBefore: [],
        auraApplied: [],
        auraConsumed: [],
        auraAfter: [],
        catalyzeReaction: null,
      });
    }
  });

  it("fails closed after the ordered Quicken → unsupported Bloom branch on Hydro/Electro coexistence", () => {
    const engine = new AuraEngine({
      mode: "aura-v3",
      initialAura: [
        { element: "hydro", gaugeUnits: 1 },
        { element: "electro", gaugeUnits: 1 },
      ],
    });
    const dendro = engine.processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(),
    });
    const laterElectro = engine.processHit({
      frame: 1,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(),
    });

    expect(dendro).toMatchObject({
      reaction: "quicken",
      reactions: ["quicken"],
      unsupportedReactions: ["bloom"],
      mechanicsTruncation: {
        operation: "trigger",
        unsupportedReactions: ["bloom"],
      },
      auraAfter: [],
    });
    expect(dendro.catalyzeReaction?.quicken).not.toBeNull();
    expect(laterElectro).toMatchObject({
      reaction: "none",
      reactions: [],
      catalyzeReaction: null,
      mechanicsTruncation: { operation: "carry" },
    });
  });

  it("carries a Burning truncation through a later hit at the same frame", () => {
    const engine = new AuraEngine({
      mode: "aura-v3",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }],
    });
    const burning = engine.processHit({
      frame: 20,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd(),
    });
    const sameFrameFollowup = engine.processHit({
      frame: 20,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(),
    });

    expect(burning.mechanicsTruncation).toMatchObject({
      operation: "trigger",
      startedAtFrame: 20,
      unsupportedReactions: ["burning"],
    });
    expect(sameFrameFollowup).toMatchObject({
      reaction: "none",
      reactions: [],
      unsupportedReactions: ["burning"],
      mechanicsTruncation: {
        operation: "carry",
        startedAtFrame: 20,
      },
      auraAfter: [],
    });
  });

  it("invalidates queued Quicken and Frozen expiry checks at the truncation boundary", () => {
    const quickenEngine = new AuraEngine({
      mode: "aura-v3",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }],
    });
    const quicken = quickenEngine.processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(),
    }).catalyzeReaction?.quicken;
    expect(quicken?.expiresAtFrame).not.toBeNull();
    quickenEngine.processHit({
      frame: 1,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(),
    });
    const staleQuicken = quickenEngine.expireQuicken(
      quicken?.expiresAtFrame ?? 600,
      quicken?.generation ?? 0,
      quicken?.expiresAtFrame ?? 600,
    );
    expect(staleQuicken).toMatchObject({
      operation: "stale",
      reason: "STALE_QUICKEN_EXPIRY_CHECK",
      auraAfter: [],
    });

    const frozenEngine = new AuraEngine({
      mode: "aura-v3",
      initialAura: [
        { element: "cryo", gaugeUnits: 1 },
        { element: "dendro", gaugeUnits: 1 },
      ],
    });
    const frozenResult = frozenEngine.processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(),
    });
    const frozen = frozenResult.frozenReaction;
    expect(frozenResult.mechanicsTruncation).toMatchObject({
      operation: "trigger",
      unsupportedReactions: ["bloom"],
    });
    expect(frozen?.expiresAtFrame).not.toBeNull();
    const staleFrozen = frozenEngine.expireFrozen(
      frozen?.expiresAtFrame ?? 1,
      frozen?.generation ?? 0,
      frozen?.expiresAtFrame ?? 1,
    );
    expect(staleFrozen).toMatchObject({
      operation: "stale",
      reason: "STALE_FROZEN_EXPIRY_CHECK",
      auraAfter: [],
    });
  });

  it("does not claim an earlier Overload consequence was queued when the same hit reaches unsupported Burning", () => {
    const engine = new AuraEngine({
      mode: "aura-v3",
      initialAura: [
        { element: "dendro", gaugeUnits: 1 },
        { element: "electro", gaugeUnits: 1 },
      ],
    });
    const result = engine.processHit({
      frame: 0,
      sourceActorId: "pyro",
      element: "pyro",
      application: noIcd(),
    });

    expect(result).toMatchObject({
      reaction: "overload",
      reactions: ["overload"],
      unsupportedReactions: ["burning"],
      mechanicsTruncation: {
        operation: "trigger",
        unsupportedReactions: ["burning"],
      },
      transformativeReaction: {
        reaction: "overload",
        scheduled: false,
        blockedReason: "TARGET_MECHANICS_TRUNCATION",
      },
    });
    expect(result.note).toMatch(/目标机制截断，独立反应伤害未排队/);
  });

  it("stops at the first unsupported Dendro branch in fixed reaction order", () => {
    const result = new AuraEngine({
      mode: "aura-v3",
      initialAura: [
        { element: "hydro", gaugeUnits: 1 },
        { element: "pyro", gaugeUnits: 1 },
      ],
    }).processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd(),
    });

    expect(result).toMatchObject({
      reaction: "none",
      reactions: [],
      unsupportedReactions: ["burning"],
      mechanicsTruncation: {
        operation: "trigger",
        unsupportedReactions: ["burning"],
      },
    });
    expect(result.note).toMatch(/燃烧前提/);
    expect(result.note).not.toMatch(/绽放前提/);
  });

  it("stops Hydro at unsupported Bloom before Electro-Charged", () => {
    const result = new AuraEngine({
      mode: "aura-v3",
      initialAura: [
        { element: "dendro", gaugeUnits: 1 },
        { element: "electro", gaugeUnits: 1 },
      ],
    }).processHit({
      frame: 0,
      sourceActorId: "hydro",
      element: "hydro",
      application: noIcd(),
    });

    expect(result).toMatchObject({
      reaction: "none",
      reactions: [],
      unsupportedReactions: ["bloom"],
      mechanicsTruncation: {
        operation: "trigger",
        unsupportedReactions: ["bloom"],
      },
      periodicReaction: null,
    });
  });
});

function makeCatalyzeSimulationConfig(): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    duration: 11,
    cycleLength: 11,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "electro",
        name: "Electro",
        element: "electro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1000,
          em: 0,
          critRate: 1,
          critDmg: 0.5,
          dmgBonus: 0.2,
          reactionBonus: 0.1,
        },
      },
    ],
    rotation: [],
    reactionEngine: {
      mode: "aura-v3",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }],
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "electro",
      swapFrames: 12,
      abilities: [
        {
          id: "electro-skill",
          actorId: "electro",
          name: "Electro Skill",
          kind: "skill",
          cancelFrame: 3,
          animationEndFrame: 3,
          cooldownFrames: 0,
          buffs: [
            {
              key: "live-em",
              label: "命中时精通",
              target: "self",
              stat: "em",
              value: 100,
              durationFrames: 60,
              startFrame: 1,
            },
          ],
          hits: [
            {
              id: "quicken-hit",
              label: "原激化",
              frame: 0,
              scaling: 1,
              element: "electro",
              snapshot: "action",
              application: noIcd(),
            },
            {
              id: "aggravate-hit",
              label: "超激化",
              frame: 2,
              scaling: 1,
              element: "electro",
              snapshot: "action",
              application: noIcd(),
            },
          ],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "electro",
          abilityId: "electro-skill",
        },
      ],
    },
  };
}

describe("Catalyze simulation integration", () => {
  it("does not advertise or schedule Electro-Charged when the same legacy hit fail-closes on Quicken", () => {
    const config = makeCatalyzeSimulationConfig();
    config.duration = 1;
    config.cycleLength = 1;
    config.reactionEngine = {
      mode: "aura-v3",
      initialAura: [
        { element: "hydro", gaugeUnits: 1 },
        { element: "dendro", gaugeUnits: 1 },
      ],
    };
    const ability = config.timeline!.abilities[0]!;
    ability.cancelFrame = 1;
    ability.animationEndFrame = 1;
    ability.hits = [
      {
        ...ability.hits![0]!,
        id: "ec-quicken-truncation",
        label: "EC into Quicken truncation",
        frame: 0,
        element: "electro",
      },
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const trigger = result.damageEvents.find(
      (event) => event.hitId === "ec-quicken-truncation",
    );
    expect(trigger?.reactionAudit).toMatchObject({
      reaction: "electroCharged",
      periodicReaction: null,
      mechanicsTruncation: {
        operation: "trigger",
        unsupportedReactions: ["legacy-multi-reaction-order"],
      },
    });
    expect(result.periodicReactionLog).toEqual([]);
    expect(
      result.reactionDamageLog.filter(
        (entry) => entry.reaction === "electroCharged",
      ),
    ).toEqual([]);
    expect(
      result.targetStateTimeline.points.filter((point) =>
        point.cause.startsWith("electro-charged-"),
      ),
    ).toEqual([]);
    expect(simulationResultSchema.parse(result)).toEqual(result);
    expect(assertTrustedSimulationResult(result)).toBe(result);

    const legalPeriodicAudit = new AuraEngine({
      mode: "aura-v3",
      initialAura: [{ element: "hydro", gaugeUnits: 1 }],
    }).processHit({
      frame: 0,
      sourceActorId: "electro",
      element: "electro",
      application: noIcd(),
    }).periodicReaction;
    if (legalPeriodicAudit === null || trigger === undefined) {
      throw new Error(
        "EC truncation fixture must expose its trigger and one legal periodic donor.",
      );
    }
    const forged = structuredClone(result);
    for (const event of [...forged.damageEvents, ...forged.hitEvents]) {
      if (event.id === trigger.id) {
        event.reactionAudit.periodicReaction =
          structuredClone(legalPeriodicAudit);
      }
    }
    expect(simulationResultSchema.safeParse(forged).success).toBe(false);
    expect(() => assertTrustedSimulationResult(forged)).toThrow(
      /Trusted SimulationResult 1\.51 integrity validation failed/,
    );
  });

  it("adds hit-time Catalyze flat damage before bonus, defense, resistance, and crit", () => {
    const result = simulate(makeCatalyzeSimulationConfig(), {
      critMode: "allCrit",
    });
    const aggravate = result.damageEvents.find(
      (event) => event.hitId === "aggravate-hit",
    );
    const expected = calcAdditiveReactionDamage({
      reaction: "aggravate",
      characterLevel: 90,
      elementalMastery: 100,
      reactionBonus: 0.1,
    });

    expect(aggravate).toBeDefined();
    expect(aggravate?.statsBeforeDamage.em).toBe(0);
    expect(aggravate?.additiveReactionFactors).toMatchObject({
      reaction: "aggravate",
      sourceActorId: "electro",
      elementalMastery: 100,
      flatDamage: expected.flatDamage,
      snapshotMode: "hit-time",
    });
    expect(aggravate?.baseDamage).toBeCloseTo(1000 + expected.flatDamage, 10);
    expect(aggravate?.finalDamage).toBeCloseTo(
      (1000 + expected.flatDamage) * 1.2 * 0.5 * 0.9 * 1.5,
      10,
    );
    expect(aggravate?.damageComposition).toEqual({
      direct: expect.closeTo(1000 * 1.2 * 0.5 * 0.9 * 1.5, 10),
      additiveReaction: expect.closeTo(
        expected.flatDamage * 1.2 * 0.5 * 0.9 * 1.5,
        10,
      ),
      transformativeReaction: 0,
    });
    expect(
      Object.values(aggravate?.damageComposition ?? {}).reduce(
        (sum, value) => sum + value,
        0,
      ),
    ).toBeCloseTo(aggravate?.finalDamage ?? 0, 10);
    expect(
      result.damageCurve.at(-1)?.cumulativeByComponent.additiveReaction,
    ).toBeCloseTo(aggravate?.damageComposition.additiveReaction ?? 0, 10);
  });

  it("uses the source actor for Catalyze when scaling and credit owners differ", () => {
    const config = makeCatalyzeSimulationConfig();
    config.characters.push(
      {
        ...config.characters[0]!,
        id: "proxy",
        name: "缩放代理",
        level: 100,
        stats: {
          ...config.characters[0]!.stats,
          baseAtk: 2500,
          em: 1000,
          reactionBonus: 1,
        },
      },
      {
        ...config.characters[0]!,
        id: "credit",
        name: "伤害归属代理",
        stats: {
          ...config.characters[0]!.stats,
          em: 500,
          reactionBonus: 0.5,
        },
      },
    );
    const aggravateHit = config.timeline!.abilities[0]!.hits![1]!;
    aggravateHit.scalingOwnerId = "proxy";
    aggravateHit.creditId = "credit";

    const result = simulate(config, { critMode: "noCrit" });
    const aggravate = result.damageEvents.find(
      (event) => event.hitId === "aggravate-hit",
    );

    expect(aggravate).toMatchObject({
      sourceActorId: "electro",
      scalingOwnerId: "proxy",
      creditOwnerId: "credit",
      additiveReactionFactors: {
        sourceActorId: "electro",
        characterLevel: 90,
        elementalMastery: 100,
        reactionBonus: 0.1,
      },
    });
  });

  it("logs Quicken start and exact expiry while keeping the curve source data deterministic", () => {
    const first = simulate(makeCatalyzeSimulationConfig(), {
      critMode: "allCrit",
    });
    const second = simulate(makeCatalyzeSimulationConfig(), {
      critMode: "allCrit",
    });

    expect(first.quickenStateLog).toMatchObject([
      {
        operation: "start",
        frame: 0,
        generation: 1,
        quickenGaugeUnitsAfter: 0.8,
        expiresAtFrame: 600,
        triggerDamageEventId: 0,
      },
      {
        operation: "expire",
        frame: 600,
        generation: 1,
        quickenGaugeUnitsAfter: 0,
        expiresAtFrame: null,
      },
    ]);
    expect(second.quickenStateLog).toEqual(first.quickenStateLog);
    expect(second.damageEvents).toEqual(first.damageEvents);
  });

  it("expires Quicken before a hit on the exact expiry frame", () => {
    const config = makeCatalyzeSimulationConfig();
    const ability = config.timeline!.abilities[0]!;
    const quickenHit = ability.hits![0]!;
    ability.cancelFrame = 601;
    ability.animationEndFrame = 601;
    ability.hits = [
      quickenHit,
      {
        ...quickenHit,
        id: "expiry-boundary-hit",
        label: "到期帧命中",
        frame: 600,
      },
    ];

    const result = simulate(config, { critMode: "allCrit" });
    const boundaryHit = result.damageEvents.find(
      (event) => event.hitId === "expiry-boundary-hit",
    );

    expect(result.quickenStateLog).toMatchObject([
      { operation: "start", frame: 0, expiresAtFrame: 600 },
      { operation: "expire", frame: 600, expiresAtFrame: null },
    ]);
    expect(boundaryHit).toMatchObject({
      frame: 600,
      reaction: "none",
      additiveReactionFactors: null,
      reactionAudit: {
        reactions: [],
        auraBefore: [],
      },
    });
  });

  it("ignores a stale expiry after an equal-strength Quicken refresh", () => {
    const config = makeCatalyzeSimulationConfig();
    const ability = config.timeline!.abilities[0]!;
    const refreshHit = ability.hits![1]!;
    ability.hits = [
      ability.hits![0]!,
      {
        ...refreshHit,
        id: "electro-aura-hit",
        label: "雷附着",
        frame: 1,
      },
      {
        ...refreshHit,
        id: "quicken-refresh-hit",
        label: "等强刷新",
        element: "dendro",
      },
    ];

    const result = simulate(config, { critMode: "allCrit" });

    expect(
      result.quickenStateLog.map((entry) => ({
        operation: entry.operation,
        frame: entry.frame,
        generation: entry.generation,
        expiresAtFrame: entry.expiresAtFrame,
      })),
    ).toEqual([
      {
        operation: "start",
        frame: 0,
        generation: 1,
        expiresAtFrame: 600,
      },
      {
        operation: "refresh",
        frame: 2,
        generation: 2,
        expiresAtFrame: 602,
      },
      {
        operation: "expire",
        frame: 602,
        generation: 2,
        expiresAtFrame: null,
      },
    ]);
  });

  it("keeps Quicken generations and expiry schedules isolated per target", () => {
    const config = makeCatalyzeSimulationConfig();
    config.enemy = {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "目标一",
          initialAura: [{ element: "dendro", gaugeUnits: 1 }],
        },
        {
          id: "enemy-1",
          name: "目标二",
          initialAura: [{ element: "dendro", gaugeUnits: 1 }],
        },
      ],
    };
    config.reactionEngine = { mode: "aura-v3" };
    const ability = config.timeline!.abilities[0]!;
    const baseHit = ability.hits![0]!;
    ability.cancelFrame = 3;
    ability.animationEndFrame = 3;
    ability.hits = [
      {
        ...baseHit,
        id: "target-0-quicken",
        frame: 0,
        targeting: { targetId: "enemy-0", outcome: "landed" },
      },
      {
        ...baseHit,
        id: "target-1-quicken",
        frame: 1,
        targeting: { targetId: "enemy-1", outcome: "landed" },
      },
      {
        ...baseHit,
        id: "target-0-aggravate",
        frame: 2,
        targeting: { targetId: "enemy-0", outcome: "landed" },
      },
    ];

    const result = simulate(config, { critMode: "noCrit" });

    expect(
      result.damageEvents.map((event) => ({
        targetId: event.targetId,
        reactions: event.reactionAudit.reactions,
      })),
    ).toEqual([
      { targetId: "enemy-0", reactions: ["quicken"] },
      { targetId: "enemy-1", reactions: ["quicken"] },
      { targetId: "enemy-0", reactions: ["aggravate"] },
    ]);
    expect(
      result.quickenStateLog.map((entry) => ({
        targetId: entry.targetId,
        operation: entry.operation,
        frame: entry.frame,
        generation: entry.generation,
      })),
    ).toEqual([
      {
        targetId: "enemy-0",
        operation: "start",
        frame: 0,
        generation: 1,
      },
      {
        targetId: "enemy-1",
        operation: "start",
        frame: 1,
        generation: 1,
      },
      {
        targetId: "enemy-0",
        operation: "expire",
        frame: 600,
        generation: 1,
      },
      {
        targetId: "enemy-1",
        operation: "expire",
        frame: 601,
        generation: 1,
      },
    ]);
  });

  it("isolates target truncation, excludes later potential damage, and respects same-frame hit order", () => {
    const config = makeCatalyzeSimulationConfig();
    config.duration = 1;
    config.cycleLength = 1;
    config.enemy = {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "绽放截断目标",
          initialAura: [{ element: "dendro", gaugeUnits: 1 }],
        },
        {
          id: "enemy-1",
          name: "正常激化目标",
          initialAura: [{ element: "dendro", gaugeUnits: 1 }],
        },
      ],
    };
    config.reactionEngine = { mode: "aura-v3" };
    const ability = config.timeline!.abilities[0]!;
    const baseHit = ability.hits![0]!;
    ability.cancelFrame = 2;
    ability.animationEndFrame = 2;
    ability.hits = [
      {
        ...baseHit,
        id: "target-0-bloom-trigger",
        frame: 0,
        element: "hydro",
        targeting: {
          targetId: "enemy-0",
          outcome: "landed",
        },
      },
      {
        ...baseHit,
        id: "target-0-same-frame-truncated",
        frame: 0,
        element: "electro",
        targeting: {
          targetId: "enemy-0",
          outcome: "landed",
        },
      },
      {
        ...baseHit,
        id: "target-1-quicken",
        frame: 0,
        element: "electro",
        targeting: {
          targetId: "enemy-1",
          outcome: "landed",
        },
      },
      {
        ...baseHit,
        id: "target-1-aggravate",
        frame: 1,
        element: "electro",
        targeting: {
          targetId: "enemy-1",
          outcome: "landed",
        },
      },
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const events = Object.fromEntries(
      result.damageEvents.map((event) => [event.hitId, event]),
    );
    const trigger = events["target-0-bloom-trigger"];
    const truncated = events["target-0-same-frame-truncated"];
    const quicken = events["target-1-quicken"];
    const aggravate = events["target-1-aggravate"];

    expect(result.mechanicsStatus).toBe("partial");
    expect(result.targetMechanicsTruncationLog).toEqual([
      expect.objectContaining({
        id: 0,
        targetId: "enemy-0",
        frame: 0,
        hitId: "target-0-bloom-trigger",
        triggerDamageEventId: trigger?.id,
        unsupportedReactions: ["bloom"],
        reason: "UNSUPPORTED_DENDRO_REACTION",
      }),
    ]);
    expect(trigger).toMatchObject({
      mechanicsStatus: "authoritative",
      reactionAudit: {
        unsupportedReactions: ["bloom"],
        mechanicsTruncation: { operation: "trigger" },
      },
    });
    expect(trigger?.finalDamage ?? 0).toBeGreaterThan(0);
    expect(truncated).toMatchObject({
      frame: 0,
      mechanicsStatus: "mechanics-truncated",
      targetDamageMultiplier: 0,
      finalDamage: 0,
      damageComposition: {
        direct: 0,
        additiveReaction: 0,
        transformativeReaction: 0,
      },
      reactionAudit: {
        reaction: "none",
        reactions: [],
        mechanicsTruncation: { operation: "carry" },
      },
    });
    expect(truncated?.potentialDamage ?? 0).toBeGreaterThan(0);
    expect(quicken).toMatchObject({
      mechanicsStatus: "authoritative",
      reaction: "quicken",
    });
    expect(aggravate).toMatchObject({
      mechanicsStatus: "authoritative",
      reaction: "aggravate",
    });
    expect(result.totalDamage).toBeCloseTo(
      [trigger, quicken, aggravate].reduce(
        (sum, event) => sum + (event?.finalDamage ?? 0),
        0,
      ),
      10,
    );
    expect(
      result.targetSummaries.find((summary) => summary.targetId === "enemy-0"),
    ).toMatchObject({
      damage: trigger?.finalDamage,
    });
    expect(result.quickenStateLog.map((entry) => entry.targetId)).toEqual([
      "enemy-1",
    ]);
  });

  it("keeps ordered Overload audit but emits no independent damage after a Burning truncation", () => {
    const config = makeCatalyzeSimulationConfig();
    config.duration = 1;
    config.cycleLength = 1;
    config.reactionEngine = {
      mode: "aura-v3",
      initialAura: [
        { element: "dendro", gaugeUnits: 1 },
        { element: "electro", gaugeUnits: 1 },
      ],
    };
    const ability = config.timeline!.abilities[0]!;
    const baseHit = ability.hits![0]!;
    ability.cancelFrame = 1;
    ability.animationEndFrame = 1;
    ability.hits = [
      {
        ...baseHit,
        id: "overload-burning-truncation",
        frame: 0,
        element: "pyro",
      },
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const trigger = result.damageEvents.find(
      (event) => event.hitId === "overload-burning-truncation",
    );

    expect(trigger).toMatchObject({
      mechanicsStatus: "authoritative",
      reaction: "overload",
      reactionAudit: {
        reactions: ["overload"],
        unsupportedReactions: ["burning"],
        mechanicsTruncation: { operation: "trigger" },
        transformativeReaction: {
          reaction: "overload",
          scheduled: false,
          blockedReason: "TARGET_MECHANICS_TRUNCATION",
        },
      },
    });
    expect(
      result.reactionDamageLog.some(
        (entry) =>
          entry.triggerDamageEventId === trigger?.id &&
          entry.reaction === "overload",
      ),
    ).toBe(false);
    expect(
      result.damageEvents.some(
        (event) =>
          event.parentDamageEventId === trigger?.id &&
          event.reaction === "overload",
      ),
    ).toBe(false);
  });

  it("does not emit a phantom natural Quicken expiry after target truncation", () => {
    const config = makeCatalyzeSimulationConfig();
    const ability = config.timeline!.abilities[0]!;
    const baseHit = ability.hits![0]!;
    ability.hits = [
      baseHit,
      {
        ...baseHit,
        id: "bloom-truncation",
        label: "绽放截断",
        frame: 1,
        element: "hydro",
      },
    ];

    const result = simulate(config, { critMode: "noCrit" });

    expect(result.mechanicsStatus).toBe("partial");
    expect(
      result.quickenStateLog.map((entry) => ({
        operation: entry.operation,
        frame: entry.frame,
      })),
    ).toEqual([{ operation: "start", frame: 0 }]);
    expect(result.targetMechanicsTruncationLog).toEqual([
      expect.objectContaining({
        frame: 1,
        hitId: "bloom-truncation",
        unsupportedReactions: ["bloom"],
      }),
    ]);
    expect(
      result.quickenStateLog.some(
        (entry) => entry.operation === "expire" && entry.frame === 600,
      ),
    ).toBe(false);
  });

  it("drops an already queued Electro-Charged wane after the target truncates", () => {
    const config = makeCatalyzeSimulationConfig();
    config.duration = 10;
    config.cycleLength = 10;
    config.reactionEngine = {
      mode: "aura-v3",
      initialAura: [{ element: "electro", gaugeUnits: 1 }],
    };
    const ability = config.timeline!.abilities[0]!;
    const baseHit = ability.hits![0]!;
    ability.cancelFrame = 13;
    ability.animationEndFrame = 13;
    ability.hits = [
      {
        ...baseHit,
        id: "electro-charged-before-truncation",
        frame: 0,
        element: "hydro",
      },
      {
        ...baseHit,
        id: "dendro-truncates-before-wane",
        frame: 12,
        element: "dendro",
      },
    ];

    const result = simulate(config, { critMode: "noCrit" });

    expect(result.targetMechanicsTruncationLog).toEqual([
      expect.objectContaining({
        frame: 12,
        hitId: "dendro-truncates-before-wane",
        unsupportedReactions: ["bloom"],
      }),
    ]);
    expect(
      result.periodicReactionLog.some(
        (entry) => entry.operation === "tick" && entry.frame === 10,
      ),
    ).toBe(true);
    expect(
      result.periodicReactionLog.filter((entry) => entry.frame > 12),
    ).toEqual([]);
    expect(
      result.periodicReactionLog.some(
        (entry) => entry.operation === "stop" && entry.frame === 16,
      ),
    ).toBe(false);
    expect(
      result.targetStateTimeline.points.filter(
        (point) =>
          point.frame > 12 && point.cause.startsWith("electro-charged-"),
      ),
    ).toEqual([]);
  });

  it("does not claim Shatter damage was queued when the same hit truncates on Burning", () => {
    const config = makeCatalyzeSimulationConfig();
    config.reactionEngine = {
      mode: "aura-v3",
      initialAura: [{ element: "cryo", gaugeUnits: 1 }],
    };
    const ability = config.timeline!.abilities[0]!;
    const baseHit = ability.hits![0]!;
    ability.cancelFrame = 3;
    ability.animationEndFrame = 3;
    ability.hits = [
      {
        ...baseHit,
        id: "freeze-before-shatter",
        frame: 0,
        element: "hydro",
      },
      {
        ...baseHit,
        id: "dendro-before-shatter",
        frame: 1,
        element: "dendro",
      },
      {
        ...baseHit,
        id: "shatter-burning-truncation",
        frame: 2,
        element: "pyro",
        strikeType: "blunt",
      },
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const trigger = result.damageEvents.find(
      (event) => event.hitId === "shatter-burning-truncation",
    );

    expect(trigger).toMatchObject({
      reactionAudit: {
        unsupportedReactions: ["burning"],
        mechanicsTruncation: { operation: "trigger" },
        shatterReaction: {
          reaction: "shatter",
          triggered: true,
          scheduled: false,
          blockedReason: "TARGET_MECHANICS_TRUNCATION",
        },
      },
    });
    expect(
      result.reactionDamageLog.some(
        (entry) =>
          entry.triggerDamageEventId === trigger?.id &&
          entry.reaction === "shatter",
      ),
    ).toBe(false);
    expect(
      result.damageEvents.some(
        (event) =>
          event.parentDamageEventId === trigger?.id &&
          event.reaction === "shatter",
      ),
    ).toBe(false);
  });

  it("keeps the legacy total-flat plugin override compatible without Catalyze", () => {
    const config = makeCatalyzeSimulationConfig();
    config.reactionEngine = { mode: "aura-v3" };
    const result = simulate(config, {
      critMode: "allCrit",
      plugins: [
        testDamagePlugin("legacy-flat-without-catalyze", (context) => {
          if (context.hit.id === "aggravate-hit") {
            return {
              flatDamage: context.damageInput.flatDamage + 37,
            };
          }
        }),
      ],
    });
    const secondHit = result.damageEvents.find(
      (event) => event.hitId === "aggravate-hit",
    );

    expect(secondHit).toMatchObject({
      reaction: "none",
      additiveReactionFactors: null,
      damageFactors: {
        flatDamage: 37,
        baseDamage: 1037,
      },
      damageComposition: {
        additiveReaction: 0,
        transformativeReaction: 0,
      },
    });
    expect(secondHit?.damageComposition.direct).toBeCloseTo(
      secondHit?.finalDamage ?? 0,
      10,
    );
  });

  it("fails fast when a Catalyze plugin returns an ambiguous total-flat override", () => {
    expect(() =>
      simulate(makeCatalyzeSimulationConfig(), {
        critMode: "allCrit",
        plugins: [
          testDamagePlugin("ambiguous-catalyze-flat", (context) => {
            if (context.additiveReactionFactors !== null) {
              return { flatDamage: 0 };
            }
          }),
        ],
      }),
    ).toThrowError(
      'Damage plugin "ambiguous-catalyze-flat" returned ambiguous flatDamage for a Catalyze hit; return ordinaryFlatDamage and/or additiveReactionFlatDamage instead.',
    );
  });

  it("keeps hit.flat and flatSources ordinary while removing only Catalyze", () => {
    const config = makeCatalyzeSimulationConfig();
    const aggravateHit = config.timeline!.abilities[0]!.hits![1]!;
    aggravateHit.flat = 40;
    aggravateHit.flatSources = [
      {
        ownerId: "electro",
        stat: "atk",
        multiplier: 0.1,
      },
    ];
    const observedComponents: Array<{
      ordinaryFlatDamage: number;
      additiveReactionFlatDamage: number;
    }> = [];
    const result = simulate(config, {
      critMode: "allCrit",
      plugins: [
        testDamagePlugin("remove-only-catalyze", (context) => {
          if (context.additiveReactionFactors !== null) {
            observedComponents.push({
              ...context.flatDamageComponents,
            });
            return { additiveReactionFlatDamage: 0 };
          }
        }),
      ],
    });
    const aggravate = result.damageEvents.find(
      (event) => event.hitId === "aggravate-hit",
    );

    expect(observedComponents).toEqual([
      {
        ordinaryFlatDamage: 140,
        additiveReactionFlatDamage: expect.any(Number),
      },
    ]);
    expect(observedComponents[0]!.additiveReactionFlatDamage).toBeGreaterThan(
      0,
    );
    expect(aggravate?.flatDetails).toEqual([
      {
        ownerId: "electro",
        stat: "atk",
        multiplier: 0.1,
        sourceValue: 1000,
        amount: 100,
      },
    ]);
    expect(aggravate?.damageFactors).toMatchObject({
      flatDamage: 140,
      baseDamage: 1140,
    });
    expect(aggravate?.additiveReactionFactors).toMatchObject({
      reaction: "aggravate",
      appliedFlatDamage: 0,
    });
    expect(aggravate?.damageComposition).toEqual({
      direct: aggravate?.finalDamage,
      additiveReaction: 0,
      transformativeReaction: 0,
    });
  });

  it("removes only ordinary flat without changing the Catalyze component", () => {
    const config = makeCatalyzeSimulationConfig();
    config.timeline!.abilities[0]!.hits![1]!.flat = 30;
    const result = simulate(config, {
      critMode: "allCrit",
      plugins: [
        testDamagePlugin("ordinary-flat-only", (context) => {
          if (context.additiveReactionFactors !== null) {
            return { ordinaryFlatDamage: 0 };
          }
        }),
      ],
    });
    const aggravate = result.damageEvents.find(
      (event) => event.hitId === "aggravate-hit",
    );
    const additiveFlat = aggravate?.additiveReactionFactors?.flatDamage ?? 0;
    const commonMultiplier =
      (aggravate?.finalDamage ?? 0) / (aggravate?.baseDamage ?? 1);

    expect(aggravate?.additiveReactionFactors?.appliedFlatDamage).toBeCloseTo(
      additiveFlat,
      10,
    );
    expect(aggravate?.damageFactors.flatDamage).toBeCloseTo(additiveFlat, 10);
    expect(aggravate?.damageComposition.direct).toBeCloseTo(
      1000 * commonMultiplier,
      10,
    );
    expect(aggravate?.damageComposition.additiveReaction).toBeCloseTo(
      additiveFlat * commonMultiplier,
      10,
    );
    expect(
      Object.values(aggravate?.damageComposition ?? {}).reduce(
        (sum, value) => sum + value,
        0,
      ),
    ).toBeCloseTo(aggravate?.finalDamage ?? 0, 10);
  });

  it("attributes a partially retained Catalyze component exactly", () => {
    const result = simulate(makeCatalyzeSimulationConfig(), {
      critMode: "allCrit",
      plugins: [
        testDamagePlugin("quarter-catalyze", (context) => {
          if (context.additiveReactionFactors !== null) {
            return {
              additiveReactionFlatDamage:
                context.flatDamageComponents.additiveReactionFlatDamage * 0.25,
            };
          }
        }),
      ],
    });
    const aggravate = result.damageEvents.find(
      (event) => event.hitId === "aggravate-hit",
    );
    const formulaFlat = aggravate?.additiveReactionFactors?.flatDamage ?? 0;
    const appliedFlat = formulaFlat * 0.25;
    const commonMultiplier =
      (aggravate?.finalDamage ?? 0) / (aggravate?.baseDamage ?? 1);

    expect(aggravate?.additiveReactionFactors?.appliedFlatDamage).toBeCloseTo(
      appliedFlat,
      10,
    );
    expect(aggravate?.damageComposition.additiveReaction).toBeCloseTo(
      appliedFlat * commonMultiplier,
      10,
    );
    expect(aggravate?.damageComposition.direct).toBeCloseTo(
      1000 * commonMultiplier,
      10,
    );
  });

  it("preserves positive Catalyze and negative direct components when their bases cancel", () => {
    const result = simulate(makeCatalyzeSimulationConfig(), {
      critMode: "allCrit",
      plugins: [
        testDamagePlugin("cancel-catalyze-with-ordinary-flat", (context) => {
          if (context.additiveReactionFactors !== null) {
            return {
              ordinaryFlatDamage:
                -(
                  context.damageInput.scaling * context.damageInput.scalingValue
                ) - context.flatDamageComponents.additiveReactionFlatDamage,
            };
          }
        }),
      ],
    });
    const aggravate = result.damageEvents.find(
      (event) => event.hitId === "aggravate-hit",
    );
    const additiveFlat =
      aggravate?.additiveReactionFactors?.appliedFlatDamage ?? 0;
    const factors = aggravate?.damageFactors;
    const commonMultiplier =
      (factors?.damageBonusMultiplier ?? 0) *
      (factors?.defenseMultiplier ?? 0) *
      (factors?.resistanceMultiplier ?? 0) *
      (factors?.critMultiplier ?? 0) *
      (factors?.amplifyingReactionMultiplier ?? 0) *
      (factors?.groupMultiplier ?? 0);
    const expectedAdditive = additiveFlat * commonMultiplier;

    expect(aggravate?.baseDamage).toBeCloseTo(0, 10);
    expect(aggravate?.finalDamage).toBeCloseTo(0, 10);
    expect(aggravate?.damageComposition.additiveReaction).toBeCloseTo(
      expectedAdditive,
      10,
    );
    expect(aggravate?.damageComposition.direct).toBeCloseTo(
      -expectedAdditive,
      10,
    );
    expect(
      Object.values(aggravate?.damageComposition ?? {}).reduce(
        (sum, value) => sum + value,
        0,
      ),
    ).toBeCloseTo(aggravate?.finalDamage ?? 0, 10);
    const curvePoint = result.damageCurve.find(
      (point) => point.timeSeconds === aggravate?.timeSeconds,
    );
    expect(
      curvePoint?.cumulativeByComponent.additiveReaction ?? 0,
    ).toBeGreaterThan(0);
    expect(curvePoint?.cumulativeByComponent.direct ?? 0).toBeLessThan(0);
  });

  it("passes exact updated components through a multi-plugin chain", () => {
    const secondPluginObservations: Array<{
      ordinaryFlatDamage: number;
      additiveReactionFlatDamage: number;
      totalFlatDamage: number;
      appliedFlatDamage: number;
    }> = [];
    const result = simulate(makeCatalyzeSimulationConfig(), {
      critMode: "allCrit",
      plugins: [
        testDamagePlugin("first-component-plugin", (context) => {
          if (context.additiveReactionFactors !== null) {
            return {
              ordinaryFlatDamage:
                context.flatDamageComponents.ordinaryFlatDamage + 25,
              additiveReactionFlatDamage:
                context.flatDamageComponents.additiveReactionFlatDamage * 0.5,
            };
          }
        }),
        testDamagePlugin("second-component-plugin", (context) => {
          if (context.additiveReactionFactors !== null) {
            secondPluginObservations.push({
              ...context.flatDamageComponents,
              totalFlatDamage: context.damageInput.flatDamage,
              appliedFlatDamage:
                context.additiveReactionFactors.appliedFlatDamage,
            });
            return {
              ordinaryFlatDamage:
                context.flatDamageComponents.ordinaryFlatDamage * 2,
              additiveReactionFlatDamage:
                context.flatDamageComponents.additiveReactionFlatDamage + 10,
            };
          }
        }),
      ],
    });
    const aggravate = result.damageEvents.find(
      (event) => event.hitId === "aggravate-hit",
    );
    const formulaFlat = aggravate?.additiveReactionFactors?.flatDamage ?? 0;
    const afterFirstAdditive = formulaFlat * 0.5;
    const finalAdditive = afterFirstAdditive + 10;
    const commonMultiplier =
      (aggravate?.finalDamage ?? 0) / (aggravate?.baseDamage ?? 1);

    expect(secondPluginObservations).toEqual([
      {
        ordinaryFlatDamage: 25,
        additiveReactionFlatDamage: expect.closeTo(afterFirstAdditive, 10),
        totalFlatDamage: expect.closeTo(25 + afterFirstAdditive, 10),
        appliedFlatDamage: expect.closeTo(afterFirstAdditive, 10),
      },
    ]);
    expect(aggravate?.damageFactors.flatDamage).toBeCloseTo(
      50 + finalAdditive,
      10,
    );
    expect(aggravate?.additiveReactionFactors?.appliedFlatDamage).toBeCloseTo(
      finalAdditive,
      10,
    );
    expect(aggravate?.damageComposition.direct).toBeCloseTo(
      1050 * commonMultiplier,
      10,
    );
    expect(aggravate?.damageComposition.additiveReaction).toBeCloseTo(
      finalAdditive * commonMultiplier,
      10,
    );
  });

  it("applies Aggravate and composition to Electro Swirl propagation", () => {
    const config = makeCatalyzeSimulationConfig();
    const actorId = config.characters[0]!.id;
    config.duration = 1;
    config.cycleLength = 1;
    config.enemy = {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "雷扩散源",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "electro", gaugeUnits: 1 }],
        },
        {
          id: "enemy-1",
          name: "激化传播目标",
          position: { x: 3, y: 0 },
          initialAura: [{ element: "dendro", gaugeUnits: 1 }],
        },
      ],
    };
    config.reactionEngine = { mode: "aura-v3" };
    config.timeline = {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: actorId,
      swapFrames: 12,
      abilities: [
        {
          id: "seed-quicken",
          actorId,
          name: "生成激元素",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "seed-quicken-hit",
              frame: 0,
              scaling: 1,
              element: "electro",
              targeting: {
                targetId: "enemy-1",
                outcome: "landed",
              },
              application: noIcd(),
            },
          ],
        },
        {
          id: "electro-swirl",
          actorId,
          name: "雷扩散传播",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "electro-swirl-hit",
              frame: 0,
              scaling: 1,
              element: "anemo",
              reactionBonus: 0.4,
              targeting: {
                targetId: "enemy-0",
                outcome: "landed",
              },
              application: noIcd(),
            },
          ],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId,
          abilityId: "seed-quicken",
          atFrame: 0,
        },
        {
          type: "skill",
          actorId,
          abilityId: "electro-swirl",
          atFrame: 10,
        },
      ],
    };

    const result = simulate(config, { critMode: "noCrit" });
    expect(simulationResultSchema.parse(result)).toEqual(result);
    expect(assertTrustedSimulationResult(result)).toBe(result);
    const expectedTransformative = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: 0,
      reactionBonus: 0.5,
      baseMultiplier: 0.6,
      effectiveResistance: 0.1,
    });
    const expectedAdditive = calcAdditiveReactionDamage({
      reaction: "aggravate",
      characterLevel: 90,
      elementalMastery: 0,
      reactionBonus: 0.5,
    });
    const expectedAdditiveFinal = expectedAdditive.flatDamage * 0.9;
    const expectedFinalDamage =
      expectedTransformative.finalDamage + expectedAdditiveFinal;
    const propagation = result.damageEvents.find(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.frame === 15 &&
        event.targetId === "enemy-1",
    );

    expect(propagation).toMatchObject({
      reaction: "swirlElectro",
      reactionAudit: {
        reaction: "aggravate",
        reactions: ["aggravate"],
      },
      additiveReactionFactors: {
        reaction: "aggravate",
        sourceActorId: actorId,
        reactionBonus: 0.5,
        flatDamage: expectedAdditive.flatDamage,
        appliedFlatDamage: expectedAdditive.flatDamage,
      },
    });
    expect(
      propagation?.transformativeReactionFactors?.reactionBonus,
    ).toBeCloseTo(0.5, 10);
    expect(propagation?.damageComposition.direct).toBe(0);
    expect(propagation?.damageComposition.additiveReaction).toBeCloseTo(
      expectedAdditiveFinal,
      10,
    );
    expect(propagation?.damageComposition.transformativeReaction).toBeCloseTo(
      expectedTransformative.finalDamage,
      10,
    );
    expect(propagation?.finalDamage).toBeCloseTo(expectedFinalDamage, 10);
    expect(propagation?.displayDamage).toBe(Math.round(expectedFinalDamage));
    expect(
      Object.values(propagation?.damageComposition ?? {}).reduce(
        (sum, value) => sum + value,
        0,
      ),
    ).toBeCloseTo(propagation?.finalDamage ?? 0, 10);
  });
});
