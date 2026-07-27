import type { SimConfig } from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { calcTransformativeReactionDamage } from "../formulas";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function auraV2RetainedGauge(
  frame: number,
  consumedGaugeUnits = 0
): number {
  return (
    0.8 -
    (0.8 / 426) * frame -
    consumedGaugeUnits
  );
}

function makeElectroChargedConfig(): SimConfig {
  const base = makeConfig();
  const template = base.characters[0]!;
  return {
    ...base,
    duration: 3,
    cycleLength: 3,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "感电目标",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "hydro", gaugeUnits: 1 }]
        },
        {
          id: "enemy-1",
          name: "邻近但无独立感电流",
          position: { x: 0.1, y: 0 },
          initialAura: [{ element: "hydro", gaugeUnits: 1 }]
        }
      ]
    },
    characters: [
      {
        ...template,
        id: "electro-a",
        name: "Electro A",
        element: "electro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1000,
          em: 100,
          reactionBonus: 0.2
        }
      },
      {
        ...template,
        id: "hydro-b",
        name: "Hydro B",
        element: "hydro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1000,
          em: 300,
          reactionBonus: 0.1
        }
      }
    ],
    rotation: [],
    reactionEngine: {
      mode: "aura-v2"
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "electro-a",
      swapFrames: 12,
      abilities: [
        {
          id: "electro-start",
          actorId: "electro-a",
          name: "Electro start",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "electro-start-hit",
              label: "雷触发感电",
              frame: 0,
              scaling: 1,
              element: "electro",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed"
              },
              application: {
                gaugeUnits: 1,
                icdTag: "ec-start",
                icdGroup: "no-icd"
              }
            }
          ]
        },
        {
          id: "hydro-refresh",
          actorId: "hydro-b",
          name: "Hydro refresh",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "hydro-refresh-hit",
              label: "水刷新感电",
              frame: 0,
              scaling: 1,
              element: "hydro",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed"
              },
              application: {
                gaugeUnits: 1,
                icdTag: "ec-refresh",
                icdGroup: "no-icd"
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "electro-a",
          abilityId: "electro-start"
        },
        { type: "wait", frames: 7 },
        { type: "swap", characterId: "hydro-b" },
        {
          type: "skill",
          actorId: "hydro-b",
          abilityId: "hydro-refresh"
        }
      ]
    }
  };
}

describe("Electro-Charged simulation integration", () => {
  it("emits every single-target tick and transfers future ownership on refresh", () => {
    const config = makeElectroChargedConfig();
    const result = simulate(config, {
      critMode: "noCrit"
    });
    const triggers = result.damageEvents.filter(
      (event) => event.kind === "direct"
    );
    const ticks = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "electroCharged"
    );
    const firstExpected = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: 100,
      reactionBonus: 0.2,
      baseMultiplier: 2,
      effectiveResistance: 0.1
    });
    const secondExpected = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: 300,
      reactionBonus: 0.1,
      baseMultiplier: 2,
      effectiveResistance: 0.1
    });

    expect(triggers.map((event) => event.frame)).toEqual([0, 20]);
    expect(triggers[0]?.reactionAudit.periodicReaction).toMatchObject({
      operation: "start",
      firstDamageFrame: 10,
      nextTickFrame: 70
    });
    expect(triggers[1]?.reactionAudit.periodicReaction).toMatchObject({
      operation: "refresh",
      firstDamageFrame: null,
      nextTickFrame: 70
    });
    expect(ticks).toHaveLength(2);
    expect(
      ticks.map((event) => ({
        frame: event.frame,
        actorId: event.sourceActorId,
        parentDamageEventId: event.parentDamageEventId,
        targetId: event.targetId,
        element: event.element,
        reaction: event.reaction
      }))
    ).toEqual([
      {
        frame: 10,
        actorId: "electro-a",
        parentDamageEventId: triggers[0]?.id,
        targetId: "enemy-0",
        element: "electro",
        reaction: "electroCharged"
      },
      {
        frame: 70,
        actorId: "hydro-b",
        parentDamageEventId: triggers[1]?.id,
        targetId: "enemy-0",
        element: "electro",
        reaction: "electroCharged"
      }
    ]);
    expect(ticks[0]?.finalDamage).toBeCloseTo(
      firstExpected.finalDamage,
      10
    );
    expect(ticks[1]?.finalDamage).toBeCloseTo(
      secondExpected.finalDamage,
      10
    );
    expect(
      result.damageEvents.some(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.targetId === "enemy-1"
      )
    ).toBe(false);
    expect(simulate(config, { critMode: "noCrit" })).toEqual(
      result
    );
  });

  it("logs an immediate stop when a later reaction removes the coexisting aura", () => {
    const config = makeElectroChargedConfig();
    config.characters[1]!.element = "pyro";
    config.characters[1]!.name = "Pyro B";
    config.timeline!.abilities[1]!.name = "Pyro stop";
    config.timeline!.abilities[1]!.hits![0]!.element = "pyro";
    config.timeline!.abilities[1]!.hits![0]!.label =
      "火触发超载并终止感电";
    config.timeline!.abilities[1]!.hits![0]!.application!.gaugeUnits =
      auraV2RetainedGauge(20, 0.4);

    const result = simulate(config, { critMode: "noCrit" });
    const directHits = result.damageEvents.filter(
      (event) => event.kind === "direct"
    );
    const electroChargedTicks = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "electroCharged"
    );

    expect(electroChargedTicks.map((event) => event.frame)).toEqual([
      10
    ]);
    expect(
      directHits[1]?.reactionAudit.periodicReaction
    ).toMatchObject({
      operation: "stop",
      generation: 1,
      nextTickFrame: null,
      coexistenceExpiresAtFrame: null
    });
    expect(
      result.periodicReactionLog.map((entry) => [
        entry.operation,
        entry.frame,
        entry.reason
      ])
    ).toEqual([
      ["start", 0, null],
      ["tick", 10, null],
      ["wane", 16, null],
      ["stop", 20, "COEXISTING_AURA_REMOVED_BY_HIT"]
    ]);
    expect(
      result.damageEvents.some(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.reaction === "overload" &&
          event.frame === 21
      )
    ).toBe(true);
  });

  it("keeps an already queued first tick after an early stop without wane or later ticks", () => {
    const config = makeElectroChargedConfig();
    config.characters[1]!.element = "pyro";
    config.timeline!.swapFrames = 1;
    config.timeline!.abilities[1]!.hits![0]!.element = "pyro";
    config.timeline!.abilities[1]!.hits![0]!.application!.gaugeUnits =
      auraV2RetainedGauge(5);
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start"
      },
      { type: "wait", frames: 3 },
      { type: "swap", characterId: "hydro-b" },
      {
        type: "skill",
        actorId: "hydro-b",
        abilityId: "hydro-refresh"
      }
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const ticks = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "electroCharged"
    );
    const electroChargedSchedules =
      result.reactionDamageLog.filter(
        (entry) => entry.reaction === "electroCharged"
      );

    expect(ticks.map((event) => event.frame)).toEqual([10]);
    expect(
      result.periodicReactionLog.map((entry) => [
        entry.operation,
        entry.frame,
        entry.reason,
        entry.nextTickFrame,
        entry.waneFrame
      ])
    ).toEqual([
      ["start", 0, null, 70, null],
      [
        "stop",
        5,
        "COEXISTING_AURA_REMOVED_BY_HIT",
        null,
        null
      ],
      [
        "tick",
        10,
        "QUEUED_FIRST_TICK_AFTER_STREAM_STOP",
        null,
        null
      ]
    ]);
    expect(electroChargedSchedules).toHaveLength(1);
    expect(electroChargedSchedules[0]?.nextAvailableFrame).toBeNull();
  });

  it("audits start, refresh, tick, delayed wane, and Aura depletion", () => {
    const config = makeElectroChargedConfig();
    config.duration = 4;
    config.cycleLength = 4;
    const result = simulate(config, {
      critMode: "noCrit"
    });

    expect(
      result.periodicReactionLog.map((entry) => ({
        operation: entry.operation,
        frame: entry.frame,
        actorId: entry.sourceActorId,
        tickIndex: entry.tickIndex,
        damageEventId: entry.damageEventId,
        reason: entry.reason
      }))
    ).toMatchObject([
      {
        operation: "start",
        frame: 0,
        actorId: "electro-a",
        tickIndex: null
      },
      {
        operation: "tick",
        frame: 10,
        actorId: "electro-a",
        tickIndex: 0,
        damageEventId: expect.any(Number)
      },
      {
        operation: "wane",
        frame: 16,
        actorId: "electro-a",
        tickIndex: 0,
        damageEventId: expect.any(Number),
        reason: null
      },
      {
        operation: "refresh",
        frame: 20,
        actorId: "hydro-b",
        tickIndex: null
      },
      {
        operation: "tick",
        frame: 70,
        actorId: "hydro-b",
        tickIndex: 1,
        damageEventId: expect.any(Number)
      },
      {
        operation: "wane",
        frame: 76,
        actorId: "hydro-b",
        tickIndex: 1,
        damageEventId: expect.any(Number),
        reason: "AURA_DEPLETED_BY_WANE"
      }
    ]);
    const wanes = result.periodicReactionLog.filter(
      (entry) => entry.operation === "wane"
    );
    expect(wanes[0]?.auraConsumed).toEqual([
      { element: "hydro", gaugeUnits: 0.4 },
      { element: "electro", gaugeUnits: 0.4 }
    ]);
    expect(wanes[1]?.auraAfter).toEqual([
      expect.objectContaining({ element: "hydro" })
    ]);
    expect(
      wanes[1]?.auraAfter.some(
        (aura) => aura.element === "electro"
      )
    ).toBe(false);
    expect(result.reactionDamageLog).toMatchObject([
      {
        reaction: "electroCharged",
        scheduleKind: "periodic-tick",
        targetingMode: "single-target",
        damageFrame: 10,
        hitTargetIds: ["enemy-0"]
      },
      {
        reaction: "electroCharged",
        scheduleKind: "periodic-tick",
        targetingMode: "single-target",
        damageFrame: 70,
        hitTargetIds: ["enemy-0"]
      }
    ]);
  });

  it("keeps Aura when an Electro-Charged tick has zero actual damage", () => {
    const config = makeElectroChargedConfig();
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start"
      }
    ];
    config.enemy.targetPhases = [
      {
        id: "immune-first-ec-tick",
        label: "首次感电数值免疫",
        targetId: "enemy-0",
        startFrame: 10,
        endFrame: 11,
        reason: "EC_TICK_IMMUNE",
        effects: {
          damage: "immune",
          aura: "normal",
          hitConfirm: "normal"
        }
      }
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const ticks = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "electroCharged"
    );
    const skippedWane = result.periodicReactionLog.find(
      (entry) => entry.operation === "wane-skipped"
    );

    expect(ticks.map((event) => event.frame)).toEqual([10, 70, 130]);
    expect(ticks[0]).toMatchObject({
      targetDamagePolicy: "immune",
      finalDamage: 0
    });
    expect(skippedWane).toMatchObject({
      frame: 16,
      auraConsumed: [],
      reason: "ZERO_ACTUAL_DAMAGE"
    });
  });

  it("stops the stream at the exact natural Aura expiry before a later tick", () => {
    const config = makeElectroChargedConfig();
    config.duration = 7.2;
    config.cycleLength = 7.2;
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start"
      }
    ];
    config.enemy.targetPhases = [
      {
        id: "immune-entire-ec-stream",
        label: "感电全程数值免疫",
        targetId: "enemy-0",
        startFrame: 0,
        endFrame: 432,
        reason: "EC_STREAM_DAMAGE_IMMUNE",
        effects: {
          damage: "immune",
          aura: "normal",
          hitConfirm: "normal"
        }
      }
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const tickFrames = result.damageEvents
      .filter(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.reaction === "electroCharged"
      )
      .map((event) => event.frame);
    const stopped = result.periodicReactionLog.find(
      (entry) => entry.operation === "stop"
    );

    expect(tickFrames).toEqual([10, 70, 130, 190, 250, 310, 370]);
    expect(stopped).toMatchObject({
      frame: 426,
      operation: "stop",
      auraAfter: [],
      reason: "AURA_DECAY_EXPIRED"
    });
    expect(tickFrames).not.toContain(430);
  });

  it("keeps separate periodic streams for each fanout target", () => {
    const config = makeElectroChargedConfig();
    config.duration = 1;
    config.cycleLength = 1;
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start"
      }
    ];
    config.timeline!.abilities[0]!.hits![0]!.targeting = {
      mode: "fanout",
      targets: [
        { targetId: "enemy-0", outcome: "landed" },
        { targetId: "enemy-1", outcome: "landed" }
      ]
    };

    const result = simulate(config, { critMode: "noCrit" });
    const ticks = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "electroCharged"
    );
    const starts = result.periodicReactionLog.filter(
      (entry) => entry.operation === "start"
    );

    expect(
      ticks.map((event) => [event.frame, event.targetId])
    ).toEqual([
      [10, "enemy-0"],
      [10, "enemy-1"]
    ]);
    expect(starts.map((entry) => entry.targetId)).toEqual([
      "enemy-0",
      "enemy-1"
    ]);
    expect(
      result.reactionDamageLog.map((entry) => entry.sourceTargetId)
    ).toEqual(["enemy-0", "enemy-1"]);
  });

  it("applies a same-frame direct refresh before the scheduled periodic tick", () => {
    const config = makeElectroChargedConfig();
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start"
      },
      { type: "wait", frames: 57 },
      { type: "swap", characterId: "hydro-b" },
      {
        type: "skill",
        actorId: "hydro-b",
        abilityId: "hydro-refresh"
      }
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const frame70 = result.damageEvents.filter(
      (event) => event.frame === 70
    );
    const tick = frame70.find(
      (event) => event.kind === "transformative-reaction"
    );

    expect(frame70.map((event) => event.kind)).toEqual([
      "direct",
      "transformative-reaction"
    ]);
    expect(tick).toMatchObject({
      sourceActorId: "hydro-b",
      parentDamageEventId: frame70[0]?.id,
      reaction: "electroCharged"
    });
  });

  it("keeps the already queued first tick snapshot when refreshed before frame 10", () => {
    const config = makeElectroChargedConfig();
    config.timeline!.swapFrames = 1;
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start"
      },
      { type: "swap", characterId: "hydro-b" },
      {
        type: "skill",
        actorId: "hydro-b",
        abilityId: "hydro-refresh"
      }
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const ticks = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "electroCharged"
    );

    expect(ticks.map((event) => event.sourceActorId)).toEqual([
      "electro-a",
      "hydro-b"
    ]);
    expect(ticks.map((event) => event.frame)).toEqual([10, 70]);
  });

  it("keeps a blocked queued restart tick as zero damage inside the target-local ReactionB window", () => {
    const config = makeElectroChargedConfig();
    config.duration = 1;
    config.cycleLength = 1;
    const electroStart = config.timeline!.abilities[0]!;
    const pyroStop = config.timeline!.abilities[1]!;
    pyroStop.id = "pyro-stop";
    pyroStop.actorId = "electro-a";
    pyroStop.name = "Pyro stop";
    pyroStop.hits![0] = {
      ...pyroStop.hits![0]!,
      id: "pyro-stop-hit",
      label: "火触发超载并终止第一条感电流",
      element: "pyro",
      application: {
        gaugeUnits: auraV2RetainedGauge(5),
        icdTag: "ec-stop",
        icdGroup: "no-icd"
      }
    };
    config.timeline!.abilities.push({
      ...electroStart,
      id: "electro-restart",
      name: "Electro restart",
      hits: electroStart.hits!.map((hit) => ({
        ...hit,
        id: "electro-restart-hit",
        label: "雷重启感电",
        application: {
          gaugeUnits: 1,
          icdTag: "ec-restart",
          icdGroup: "no-icd"
        }
      }))
    });
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start"
      },
      { type: "wait", frames: 4 },
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "pyro-stop"
      },
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-restart"
      }
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const ticks = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "electroCharged"
    );
    const schedules = result.reactionDamageLog.filter(
      (entry) => entry.reaction === "electroCharged"
    );

    expect(
      result.periodicReactionLog
        .filter((entry) => entry.operation === "tick")
        .map((entry) => ({
          frame: entry.frame,
          generation: entry.generation,
          sourceActorId: entry.sourceActorId,
          reason: entry.reason
        }))
    ).toEqual([
      {
        frame: 10,
        generation: 1,
        sourceActorId: "electro-a",
        reason: "QUEUED_FIRST_TICK_AFTER_STREAM_REPLACED"
      },
      {
        frame: 16,
        generation: 2,
        sourceActorId: "electro-a",
        reason: null
      }
    ]);
    expect(
      ticks.map((event) => ({
        frame: event.frame,
        sourceActorId: event.sourceActorId,
        targetId: event.targetId,
        finalDamage: event.finalDamage,
        groupMultiplier: event.damageFactors.groupMultiplier
      }))
    ).toEqual([
      {
        frame: 10,
        sourceActorId: "electro-a",
        targetId: "enemy-0",
        finalDamage: expect.any(Number),
        groupMultiplier: 1
      },
      {
        frame: 16,
        sourceActorId: "electro-a",
        targetId: "enemy-0",
        finalDamage: 0,
        groupMultiplier: 0
      }
    ]);
    expect(ticks[0]?.finalDamage).toBeGreaterThan(0);
    expect(ticks[1]).toMatchObject({
      displayDamage: 0,
      damageComposition: {
        direct: 0,
        additiveReaction: 0,
        transformativeReaction: 0
      }
    });
    expect(schedules).toHaveLength(2);
    expect(schedules[1]).toMatchObject({
      damageFrame: 16,
      damageGroupBlockedTargetIds: ["enemy-0"],
      damageEventIds: [ticks[1]?.id],
      damageGroupDecisions: [
        {
          reaction: "electroCharged",
          sourceActorId: "electro-a",
          targetId: "enemy-0",
          windowStartFrame: 10,
          hitIndex: 1,
          resetFrames: 30,
          sequence: [true, false],
          damageAllowed: false,
          blockedReason: "REACTION_B_DAMAGE_ICD"
        }
      ]
    });
  });

  it("freezes trigger-frame live EM and reaction bonus for a queued action-snapshot tick", () => {
    const config = makeElectroChargedConfig();
    config.duration = 1;
    config.cycleLength = 1;
    config.timeline!.commands = [
      {
        type: "skill",
        actorId: "electro-a",
        abilityId: "electro-start"
      }
    ];
    const ability = config.timeline!.abilities[0]!;
    const hit = ability.hits![0]!;
    ability.cancelFrame = 11;
    ability.animationEndFrame = 11;
    ability.buffs = [
      {
        key: "ec-live-em",
        label: "感电触发帧精通",
        target: "self",
        stat: "em",
        value: 200,
        startFrame: 5,
        durationFrames: 6
      },
      {
        key: "ec-live-reaction-bonus",
        label: "感电触发帧反应增伤",
        target: "self",
        stat: "reactionBonus",
        value: 0.3,
        startFrame: 5,
        durationFrames: 6
      }
    ];
    ability.hits = [
      {
        ...hit,
        frame: 10,
        snapshot: "action"
      }
    ];

    const result = simulate(config, { critMode: "noCrit" });
    const direct = result.damageEvents.find(
      (event) => event.hitId === "electro-start-hit"
    );
    const tick = result.damageEvents.find(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "electroCharged"
    );
    const expected = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: 300,
      reactionBonus: 0.5,
      baseMultiplier: 2,
      effectiveResistance: 0.1
    });

    expect(direct).toMatchObject({
      frame: 10,
      snapshot: "action",
      statsBeforeDamage: {
        em: 100,
        reactionBonus: 0.2
      }
    });
    expect(tick).toMatchObject({
      frame: 20,
      sourceActorId: "electro-a",
      snapshot: "hit",
      statsBeforeDamage: {
        em: 300,
        reactionBonus: 0.5
      },
      transformativeReactionFactors: {
        characterLevel: 90,
        elementalMastery: 300,
        reactionBonus: 0.5
      }
    });
    expect(tick?.buffs).toEqual([
      "感电触发帧精通",
      "感电触发帧反应增伤"
    ]);
    expect(tick?.finalDamage).toBeCloseTo(
      expected.finalDamage,
      10
    );
  });
});
