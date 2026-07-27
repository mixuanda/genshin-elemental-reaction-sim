import {
  burningStateLogEntrySchema,
  type SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { AuraEngine } from "../aura";
import { calcTransformativeReactionDamage } from "../formulas";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function noIcd(gaugeUnits = 1) {
  return {
    gaugeUnits,
    icdTag: "burning-test",
    icdGroup: "no-icd" as const
  };
}

function makeBurningConfig(
  overrides: {
    duration?: number;
    initialDendroGaugeUnits?: number;
    nearbyTarget?: boolean;
  } = {}
): SimConfig {
  const base = makeConfig();
  const duration = overrides.duration ?? 2.1;
  const targets: NonNullable<
    SimConfig["enemy"]["targets"]
  > = [
    {
      id: "enemy-0",
      name: "燃烧触发目标",
      position: { x: 0, y: 0 },
      initialAura: [
        {
          element: "dendro",
          gaugeUnits:
            overrides.initialDendroGaugeUnits ?? 1
        }
      ]
    }
  ];
  if (overrides.nearbyTarget === true) {
    targets.push({
      id: "enemy-1",
      name: "燃烧范围目标",
      position: { x: 0.5, y: 0 }
    });
  }
  return {
    ...base,
    duration,
    cycleLength: duration,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "pyro",
        name: "Pyro",
        element: "pyro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0,
          em: 100,
          reactionBonus: 0.2
        }
      }
    ],
    rotation: [],
    reactionEngine: {
      mode: "aura-v4"
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
              label: "燃烧触发命中",
              frame: 0,
              scaling: 1,
              element: "pyro",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed"
              },
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

describe("aura-v4 Burning lifecycle", () => {
  it.each([
    {
      initialElement: "dendro" as const,
      triggerElement: "pyro" as const
    },
    {
      initialElement: "pyro" as const,
      triggerElement: "dendro" as const
    }
  ])(
    "starts Burning for $triggerElement on $initialElement",
    ({ initialElement, triggerElement }) => {
      const audit = new AuraEngine({
        mode: "aura-v4",
        initialAura: [
          { element: initialElement, gaugeUnits: 1 }
        ]
      }).processHit({
        frame: 0,
        sourceActorId: "trigger",
        element: triggerElement,
        application: noIcd()
      });

      expect(audit).toMatchObject({
        triggered: true,
        reaction: "burning",
        reactions: ["burning"],
        unsupportedReactions: [],
        mechanicsTruncation: null,
        burningReaction: {
          reaction: "burning",
          operation: "start",
          reactionTriggered: true,
          generation: 1,
          triggerElement,
          fuelOperation: "start",
          scheduled: true,
          blockedReason: null,
          damageSourceActorId: "trigger",
          fuelSourceActorId: "trigger",
          burningGaugeUnitsBefore: 0,
          candidateBurningGaugeUnits: 2,
          burningGaugeUnitsAfter: 2,
          burningDecayPerFrame: 0,
          burningExpiresAtFrame: null,
          fuelGaugeUnitsBefore: 0,
          candidateFuelGaugeUnits: 0.8,
          fuelGaugeUnitsAfter: 0.8,
          fuelDecayPerFrame: 1 / 150,
          fuelExpiresAtFrame: 121,
          snapshotFrame: 0,
          firstTickFrame: 15,
          nextTickFrame: 15,
          tickIntervalFrames: 15,
          skippedTickIndex: 9,
          damageElement: "pyro",
          baseMultiplier: 0.25,
          radius: 1,
          applicationGaugeUnits: 1,
          clockModel: "target-local-no-hitlag",
          hitlagStatus: "unsupported-enemy-hitlag",
          selfDamageStatus:
            "unsupported-player-damage-model"
        }
      });
      expect(audit.auraAfter).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            element: "burning",
            gaugeUnits: 2
          }),
          expect.objectContaining({
            element: "burningFuel",
            gaugeUnits: 0.8
          })
        ])
      );
    }
  );

  it("emits 1U tick slots at 15..120 and removes Burning/Fuel at frame 121", () => {
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
    const generation = start.burningReaction!.generation;
    const ticks = Array.from({ length: 8 }, (_, index) =>
      engine.prepareBurningTick(
        (index + 1) * 15,
        generation,
        index + 1
      )
    );
    const expiry = engine.expireBurningFuel(
      121,
      generation,
      121
    );

    expect(ticks.map((tick) => tick.frame)).toEqual([
      15, 30, 45, 60, 75, 90, 105, 120
    ]);
    expect(ticks.every((tick) => tick.operation === "tick")).toBe(
      true
    );
    expect(ticks.map((tick) => tick.nextTickFrame)).toEqual([
      30, 45, 60, 75, 90, 105, 120, 135
    ]);
    expect(expiry).toMatchObject({
      operation: "expire",
      frame: 121,
      burningGaugeUnitsBefore: 2,
      burningGaugeUnitsAfter: 0,
      fuelGaugeUnitsBefore: expect.closeTo(1 / 150, 12),
      fuelGaugeUnitsAfter: 0,
      nextTickFrame: null,
      fuelExpiresAtFrame: null,
      reason: "FUEL_EXPIRED"
    });
    expect(expiry.auraAfter).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "burning" }),
        expect.objectContaining({ element: "burningFuel" }),
        expect.objectContaining({ element: "dendro" }),
        expect.objectContaining({ element: "quicken" })
      ])
    );
  });

  it("skips only slot 9, resumes slot 10, and keeps cadence across both refresh forms", () => {
    const engine = new AuraEngine({
      mode: "aura-v4",
      initialAura: [{ element: "dendro", gaugeUnits: 2 }]
    });
    const start = engine.processHit({
      frame: 0,
      sourceActorId: "pyro-start",
      element: "pyro",
      application: noIcd()
    });
    const generation = start.burningReaction!.generation;
    for (let index = 1; index <= 8; index += 1) {
      expect(
        engine.prepareBurningTick(
          index * 15,
          generation,
          index
        ).operation
      ).toBe("tick");
    }
    const skipped = engine.prepareBurningTick(
      135,
      generation,
      9
    );
    const resumed = engine.prepareBurningTick(
      150,
      generation,
      10
    );
    const dendroRefresh = engine.processHit({
      frame: 151,
      sourceActorId: "dendro-refresh",
      element: "dendro",
      application: noIcd(0.5)
    });
    const pyroRefresh = engine.processHit({
      frame: 152,
      sourceActorId: "pyro-refresh",
      element: "pyro",
      application: noIcd()
    });

    expect(skipped).toMatchObject({
      operation: "tick-skipped",
      tickIndex: 9,
      skipReason: "COUNTER_9_SKIP",
      nextTickFrame: 150
    });
    expect(resumed).toMatchObject({
      operation: "tick",
      tickIndex: 10,
      skipReason: null,
      nextTickFrame: 165
    });
    expect(dendroRefresh.burningReaction).toMatchObject({
      operation: "refresh-fuel",
      generation,
      fuelOperation: "overwrite",
      damageSourceActorId: "dendro-refresh",
      fuelSourceActorId: "dendro-refresh",
      candidateFuelGaugeUnits: 0.4,
      fuelGaugeUnitsAfter: 0.4,
      nextTickFrame: 165
    });
    expect(pyroRefresh.burningReaction).toMatchObject({
      operation: "refresh-snapshot",
      generation,
      fuelOperation: "unchanged",
      damageSourceActorId: "pyro-refresh",
      fuelSourceActorId: "dendro-refresh",
      candidateFuelGaugeUnits: 0.4,
      fuelGaugeUnitsAfter: 0.4,
      nextTickFrame: 165
    });
  });

  it("uses target-global Burning application ICD, clamps beyond the fixed sequence, and resets at 120f", () => {
    const engine = new AuraEngine({ mode: "aura-v4" });
    const frames = [
      15, 25, 35, 45, 55, 65, 75, 85, 95, 105, 135
    ];
    const decisions = frames.map((frame) => {
      const audit = engine.processHit({
        frame,
        sourceActorId:
          frame % 30 === 0 ? "source-b" : "source-a",
        element: "pyro",
        application: {
          gaugeUnits: 1,
          icdTag: "burning-application",
          icdGroup: "burning"
        }
      });
      return {
        allowed: audit.icdAllowed,
        decision:
          engine.getLastBurningApplicationIcdDecision()
      };
    });

    expect(decisions.map((entry) => entry.allowed)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true
    ]);
    expect(decisions.map((entry) => entry.decision?.hitIndex)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0
    ]);
    expect(
      decisions.map(
        (entry) => entry.decision?.windowStartFrame
      )
    ).toEqual([
      15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 135
    ]);
  });

  it("preserves fixed reaction order for Overload → Burning", () => {
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
      application: noIcd()
    });

    expect(audit).toMatchObject({
      reaction: "overload",
      reactions: ["overload", "burning"],
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

  it("records Burning before Bloom truncation and leaves no live or ghost Burning stream", () => {
    const engine = new AuraEngine({
      mode: "aura-v4",
      initialAura: [
        { element: "pyro", gaugeUnits: 1 },
        { element: "hydro", gaugeUnits: 1 }
      ]
    });
    const audit = engine.processHit({
      frame: 0,
      sourceActorId: "dendro",
      element: "dendro",
      application: noIcd()
    });
    const generation = audit.burningReaction!.generation;
    const ghost = engine.prepareBurningTick(15, generation, 1);

    expect(audit).toMatchObject({
      reaction: "burning",
      reactions: ["burning"],
      unsupportedReactions: ["bloom"],
      mechanicsTruncation: {
        operation: "trigger",
        startedAtFrame: 0,
        unsupportedReactions: ["bloom"]
      },
      auraAfter: [],
      burningReaction: {
        operation: "start",
        scheduled: false,
        blockedReason: "TARGET_MECHANICS_TRUNCATION",
        burningGaugeUnitsAfter: 0,
        fuelGaugeUnitsAfter: 0,
        fuelExpiresAtFrame: null,
        firstTickFrame: null,
        nextTickFrame: null
      }
    });
    expect(ghost).toMatchObject({
      operation: "stale",
      damageSourceActorId: null,
      nextTickFrame: null,
      reason: "SUPERSEDED_STREAM"
    });
  });

  it("stops immediately when a reaction consumes the Burning marker", () => {
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
    const stop = engine.processHit({
      frame: 1,
      sourceActorId: "cryo",
      element: "cryo",
      application: noIcd(10)
    });

    expect(stop.burningReaction).toMatchObject({
      operation: "stop",
      reactionTriggered: false,
      triggerElement: "cryo",
      fuelOperation: "remove",
      stopReason: "BURNING_AURA_CONSUMED",
      scheduled: false,
      burningGaugeUnitsBefore: 2,
      burningGaugeUnitsAfter: 0,
      fuelGaugeUnitsAfter: 0,
      nextTickFrame: null
    });
    expect(stop.auraAfter).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "burning" }),
        expect.objectContaining({ element: "burningFuel" })
      ])
    );
    expect(stop.auraAfter).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          element: "dendro",
          gaugeUnits: expect.any(Number)
        })
      ])
    );
  });
});

describe("Burning simulation integration", () => {
  it("emits every 15..120 damage tick, exact composition, links, curve, and natural expiry", () => {
    const result = simulate(makeBurningConfig(), {
      critMode: "allCrit"
    });
    const direct = result.damageEvents.find(
      (event) => event.kind === "direct"
    )!;
    const ticks = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "burning"
    );
    expect(
      result.burningStateLog.map((entry) =>
        burningStateLogEntrySchema.parse(entry)
      )
    ).toEqual(result.burningStateLog);
    const expected = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: 100,
      reactionBonus: 0.2,
      baseMultiplier: 0.25,
      effectiveResistance: 0.1
    });

    expect(expected.finalDamage).toBeCloseTo(
      638.6824735714285,
      12
    );
    expect(direct.reactionAudit.burningReaction).toMatchObject({
      operation: "start",
      firstTickFrame: 15,
      fuelExpiresAtFrame: 121
    });
    expect(ticks.map((event) => event.frame)).toEqual([
      15, 30, 45, 60, 75, 90, 105, 120
    ]);
    expect(
      ticks.every(
        (event) =>
          Math.abs(event.finalDamage - expected.finalDamage) <
            1e-10 &&
          event.displayDamage === 639 &&
          event.damageComposition.direct === 0 &&
          event.damageComposition.additiveReaction === 0 &&
          Math.abs(
            event.damageComposition.transformativeReaction -
              expected.finalDamage
          ) < 1e-10 &&
          event.damageFactors.defenseMultiplier === 1 &&
          event.damageFactors.critMultiplier === 1
      )
    ).toBe(true);
    expect(
      result.reactionDamageLog
        .filter((entry) => entry.reaction === "burning")
        .map((entry) => entry.damageFrame)
    ).toEqual([15, 30, 45, 60, 75, 90, 105, 120]);
    expect(
      result.burningStateLog
        .filter((entry) => entry.operation === "tick")
        .map((entry) => ({
          frame: entry.frame,
          tickIndex: entry.tickIndex,
          linkedDamageCount: entry.damageEventIds.length,
          hasReactionDamageLink:
            entry.reactionDamageLogId !== null
        }))
    ).toEqual(
      ticks.map((event, index) => ({
        frame: event.frame,
        tickIndex: index + 1,
        linkedDamageCount: 1,
        hasReactionDamageLink: true
      }))
    );
    expect(
      result.burningStateLog.at(-1)
    ).toMatchObject({
      operation: "fuel-expire",
      frame: 121,
      burningGaugeUnitsAfter: 0,
      fuelGaugeUnitsAfter: 0,
      reason: "FUEL_EXPIRED"
    });
    expect(
      result.damageCurve.at(-1)?.cumulativeByReaction.burning
    ).toBeCloseTo(expected.finalDamage * 8, 10);
    expect(result.totalDamage).toBeCloseTo(
      expected.finalDamage * 8,
      10
    );
  });

  it("resolves each Burning tick independently on a nearby target", () => {
    const result = simulate(
      makeBurningConfig({
        duration: 1,
        nearbyTarget: true
      }),
      { critMode: "noCrit" }
    );
    const tickDamage = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "burning"
    );
    const burningLog = result.reactionDamageLog.find(
      (entry) => entry.reaction === "burning"
    );

    expect(
      tickDamage.map((event) => ({
        targetId: event.targetId,
        parentDamageEventId: event.parentDamageEventId,
        frame: event.frame
      }))
    ).toEqual(
      [15, 30, 45, 60].flatMap((frame) => [
        {
          targetId: "enemy-0",
          parentDamageEventId: expect.any(Number),
          frame
        },
        {
          targetId: "enemy-1",
          parentDamageEventId: expect.any(Number),
          frame
        }
      ])
    );
    expect(burningLog).toMatchObject({
      scheduleKind: "burning-tick",
      targetingMode: "radius",
      centerPosition: { x: 0, y: 0 },
      radius: 1,
      checkedTargetIds: ["enemy-0", "enemy-1"],
      hitTargetIds: ["enemy-0", "enemy-1"],
      damageEventIds: tickDamage
        .filter((event) => event.frame === 15)
        .map((event) => event.id)
    });
  });

  it("resolves same-frame multi-target Burning ticks atomically in target order", () => {
    const config = makeBurningConfig({
      duration: 1,
      nearbyTarget: true
    });
    const targets = config.enemy.targets!;
    targets[1]!.initialAura = [
      { element: "dendro", gaugeUnits: 1 }
    ];
    const hit = config.timeline!.abilities[0]!.hits![0]!;
    hit.targeting = {
      mode: "fanout",
      targets: [
        { targetId: "enemy-0", outcome: "landed" },
        { targetId: "enemy-1", outcome: "landed" }
      ]
    };

    const result = simulate(config, { critMode: "noCrit" });
    const tickLogs = result.reactionDamageLog.filter(
      (entry) =>
        entry.reaction === "burning" &&
        entry.damageFrame === 15
    );
    const firstTargetTick = tickLogs.find(
      (entry) => entry.sourceTargetId === "enemy-0"
    )!;
    const secondTargetTick = tickLogs.find(
      (entry) => entry.sourceTargetId === "enemy-1"
    )!;
    const firstTickDamageOnSecondTarget =
      result.damageEvents.find(
        (event) =>
          firstTargetTick.damageEventIds.includes(event.id) &&
          event.targetId === "enemy-1"
      )!;
    const secondTickState = result.burningStateLog.find(
      (entry) =>
        entry.operation === "tick" &&
        entry.frame === 15 &&
        entry.targetId === "enemy-1"
    )!;

    expect(tickLogs.map((entry) => entry.sourceTargetId)).toEqual([
      "enemy-0",
      "enemy-1"
    ]);
    expect(secondTargetTick.triggerDamageEventId).toBe(
      firstTickDamageOnSecondTarget.id
    );
    expect(firstTickDamageOnSecondTarget.eventPriority).toBeLessThan(
      secondTickState.eventPriority
    );
    expect(secondTickState.eventPriority).toBeLessThan(
      result.damageEvents.find(
        (event) =>
          secondTargetTick.damageEventIds.includes(event.id)
      )!.eventPriority
    );
  });

  it("separates damage immunity, Aura blocking, and Burning ICD decisions", () => {
    const config = makeBurningConfig({ duration: 1 });
    config.enemy.targetPhases = [
      {
        id: "burning-damage-immune",
        label: "燃烧伤害免疫",
        targetId: "enemy-0",
        startFrame: 15,
        endFrame: 30,
        reason: "BURNING_DAMAGE_IMMUNE",
        effects: {
          damage: "immune",
          aura: "normal",
          hitConfirm: "normal"
        }
      },
      {
        id: "burning-aura-blocked",
        label: "燃烧附着阻断",
        targetId: "enemy-0",
        startFrame: 30,
        endFrame: 45,
        reason: "BURNING_AURA_BLOCKED",
        effects: {
          damage: "normal",
          aura: "blocked",
          hitConfirm: "normal"
        }
      }
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const tickDamage = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "burning" &&
        event.frame <= 45
    );
    const tickLog = result.burningStateLog.filter(
      (entry) =>
        entry.operation === "tick" && entry.frame <= 45
    );

    expect(
      tickDamage.map((event) => ({
        frame: event.frame,
        policy: event.targetDamagePolicy,
        finalDamage: event.finalDamage
      }))
    ).toEqual([
      { frame: 15, policy: "immune", finalDamage: 0 },
      {
        frame: 30,
        policy: "normal",
        finalDamage: expect.any(Number)
      },
      {
        frame: 45,
        policy: "normal",
        finalDamage: expect.any(Number)
      }
    ]);
    expect(tickDamage[1]!.finalDamage).toBeGreaterThan(0);
    expect(tickDamage[2]!.finalDamage).toBeGreaterThan(0);
    expect(
      tickLog.map((entry) => ({
        frame: entry.frame,
        damageAllowed: entry.damageAllowed,
        applicationAllowed: entry.applicationAllowed,
        applicationBlockedReason:
          entry.applicationBlockedReason,
        icdWindowStartFrame: entry.icdWindowStartFrame,
        icdHitIndex: entry.icdHitIndex
      }))
    ).toEqual([
      {
        frame: 15,
        damageAllowed: false,
        applicationAllowed: true,
        applicationBlockedReason: null,
        icdWindowStartFrame: 15,
        icdHitIndex: 0
      },
      {
        frame: 30,
        damageAllowed: true,
        applicationAllowed: null,
        applicationBlockedReason: "TARGET_AURA_BLOCKED",
        icdWindowStartFrame: null,
        icdHitIndex: null
      },
      {
        frame: 45,
        damageAllowed: true,
        applicationAllowed: false,
        applicationBlockedReason: "BURNING_APPLICATION_ICD",
        icdWindowStartFrame: 15,
        icdHitIndex: 1
      }
    ]);
  });
});
