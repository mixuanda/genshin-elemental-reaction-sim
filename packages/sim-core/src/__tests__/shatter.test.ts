import type { SimConfig } from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { calcTransformativeReactionDamage } from "../formulas";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function makeShatterConfig(options?: {
  strikeType?: "default" | "blunt";
  poiseDamage?: number;
  element?: "physical" | "geo";
  repeatWithinGcd?: boolean;
}): SimConfig {
  const base = makeConfig();
  const template = base.characters[0]!;
  const strikeType = options?.strikeType ?? "blunt";
  const poiseDamage = options?.poiseDamage;
  const crusherElement = options?.element ?? "physical";
  const hit = {
    id: "crusher-hit",
    label: "碎冰触发命中",
    frame: 0,
    scaling: 1,
    element: crusherElement,
    strikeType,
    ...(poiseDamage === undefined ? {} : { poiseDamage })
  } as const;
  return {
    ...base,
    duration: 2,
    cycleLength: 2,
    enemy: {
      level: 90,
      resistance: 0.25,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "冻结目标",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "cryo", gaugeUnits: 1 }]
        },
        {
          id: "enemy-1",
          name: "邻近目标",
          position: { x: 0.1, y: 0 }
        }
      ]
    },
    characters: [
      {
        ...template,
        id: "hydro",
        name: "Hydro",
        element: "hydro",
        level: 90,
        stats: { ...neutralStats, baseAtk: 1000 }
      },
      {
        ...template,
        id: "crusher",
        name: "Crusher",
        element: crusherElement,
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
        id: "cryo",
        name: "Cryo",
        element: "cryo",
        level: 90,
        stats: { ...neutralStats, baseAtk: 1000 }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "hydro",
      swapFrames: 1,
      abilities: [
        {
          id: "hydro-freeze",
          actorId: "hydro",
          name: "Hydro Freeze",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "hydro-freeze-hit",
              label: "水触发冻结",
              frame: 0,
              scaling: 1,
              element: "hydro",
              application: {
                gaugeUnits: 1,
                icdTag: "freeze",
                icdGroup: "no-icd"
              }
            }
          ]
        },
        {
          id: "crusher-skill",
          actorId: "crusher",
          name: "Crusher Hit",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [hit]
        },
        {
          id: "cryo-attach",
          actorId: "cryo",
          name: "Cryo Attach",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "cryo-attach-hit",
              label: "冰附着",
              frame: 0,
              scaling: 1,
              element: "cryo",
              application: {
                gaugeUnits: 1,
                icdTag: "cryo-attach",
                icdGroup: "no-icd"
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "hydro",
          abilityId: "hydro-freeze"
        },
        { type: "swap", characterId: "crusher" },
        {
          type: "skill",
          actorId: "crusher",
          abilityId: "crusher-skill"
        },
        ...(options?.repeatWithinGcd
          ? ([
              { type: "swap", characterId: "cryo" },
              {
                type: "skill",
                actorId: "cryo",
                abilityId: "cryo-attach"
              },
              { type: "swap", characterId: "hydro" },
              {
                type: "skill",
                actorId: "hydro",
                abilityId: "hydro-freeze"
              },
              { type: "swap", characterId: "crusher" },
              {
                type: "skill",
                actorId: "crusher",
                abilityId: "crusher-skill"
              }
            ] as const)
          : [])
      ]
    }
  };
}

function makeReactionAShatterConfig(): SimConfig {
  const config = makeShatterConfig();
  const crusherAbility = config.timeline!.abilities.find(
    (ability) => ability.id === "crusher-skill"
  )!;
  const shatterHit = crusherAbility.hits![0]!;
  crusherAbility.cancelFrame = 25;
  crusherAbility.animationEndFrame = 25;
  crusherAbility.hits = [
    shatterHit,
    {
      id: "refreeze-cryo-2",
      label: "第二次冻结冰附着",
      frame: 3,
      scaling: 1,
      element: "cryo",
      application: {
        gaugeUnits: 1,
        icdTag: "refreeze-cryo-2",
        icdGroup: "no-icd"
      }
    },
    {
      id: "refreeze-hydro-2",
      label: "第二次冻结水附着",
      frame: 4,
      scaling: 1,
      element: "hydro",
      application: {
        gaugeUnits: 1,
        icdTag: "refreeze-hydro-2",
        icdGroup: "no-icd"
      }
    },
    {
      ...shatterHit,
      id: "crusher-hit-2",
      frame: 12
    },
    {
      id: "refreeze-cryo-3",
      label: "第三次冻结冰附着",
      frame: 15,
      scaling: 1,
      element: "cryo",
      application: {
        gaugeUnits: 1,
        icdTag: "refreeze-cryo-3",
        icdGroup: "no-icd"
      }
    },
    {
      id: "refreeze-hydro-3",
      label: "第三次冻结水附着",
      frame: 16,
      scaling: 1,
      element: "hydro",
      application: {
        gaugeUnits: 1,
        icdTag: "refreeze-hydro-3",
        icdGroup: "no-icd"
      }
    },
    {
      ...shatterHit,
      id: "crusher-hit-3",
      frame: 24
    }
  ];
  return config;
}

function makeOverloadShatterConfig(): SimConfig {
  const base = makeConfig();
  const template = base.characters[0]!;
  return {
    ...base,
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "超载触发目标",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "electro", gaugeUnits: 1 }]
        },
        {
          id: "enemy-1",
          name: "邻近冻结目标",
          position: { x: 3, y: 0 },
          initialAura: [{ element: "cryo", gaugeUnits: 1 }]
        }
      ]
    },
    characters: [
      {
        ...template,
        id: "hydro",
        name: "Hydro",
        element: "hydro",
        level: 90,
        stats: { ...neutralStats, baseAtk: 1000 }
      },
      {
        ...template,
        id: "pyro",
        name: "Pyro",
        element: "pyro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1000,
          em: 100
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "hydro",
      swapFrames: 1,
      abilities: [
        {
          id: "freeze-neighbor",
          actorId: "hydro",
          name: "Freeze Neighbor",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "freeze-neighbor-hit",
              frame: 0,
              scaling: 1,
              element: "hydro",
              targeting: {
                targetId: "enemy-1",
                outcome: "landed"
              },
              application: {
                gaugeUnits: 1,
                icdTag: "freeze-neighbor",
                icdGroup: "no-icd"
              }
            }
          ]
        },
        {
          id: "trigger-overload",
          actorId: "pyro",
          name: "Trigger Overload",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "trigger-overload-hit",
              frame: 0,
              scaling: 1,
              element: "pyro",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed"
              },
              application: {
                gaugeUnits: 1,
                icdTag: "trigger-overload",
                icdGroup: "no-icd"
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "hydro",
          abilityId: "freeze-neighbor"
        },
        { type: "swap", characterId: "pyro" },
        {
          type: "skill",
          actorId: "pyro",
          abilityId: "trigger-overload"
        }
      ]
    }
  };
}

describe("Shatter simulation integration", () => {
  it("emits exact single-target physical reaction damage on the trigger frame", () => {
    const result = simulate(makeShatterConfig(), {
      critMode: "allCrit"
    });
    const trigger = result.damageEvents.find(
      (event) =>
        event.kind === "direct" &&
        event.sourceActorId === "crusher"
    );
    const shatter = result.damageEvents.find(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "shatter"
    );
    const expected = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: 100,
      reactionBonus: 0.2,
      baseMultiplier: 3,
      effectiveResistance: 0.25
    });

    expect(trigger).toMatchObject({
      frame: 2,
      reaction: "none",
      reactionAudit: {
        shatterReaction: {
          reaction: "shatter",
          strikeType: "blunt",
          poiseDamage: 0,
          triggered: true,
          scheduled: true,
          damageFrame: 2,
          baseMultiplier: 3,
          blockedReason: null,
          nextAvailableFrame: 14,
          shatterConsumedGaugeUnits: expect.any(Number),
          frozenGaugeAfter: 0
        }
      }
    });
    expect(shatter).toMatchObject({
      frame: 2,
      element: "physical",
      reaction: "shatter",
      parentDamageEventId: trigger?.id,
      targetId: "enemy-0",
      damageFactors: {
        defenseMultiplier: 1,
        critMultiplier: 1
      },
      transformativeReactionFactors: {
        baseMultiplier: 3,
        elementalMastery: 100,
        effectiveResistance: 0.25
      }
    });
    expect(shatter?.finalDamage).toBeCloseTo(
      expected.finalDamage,
      10
    );
    expect(
      result.damageEvents.filter(
        (event) => event.reaction === "shatter"
      )
    ).toHaveLength(1);
    expect(result.reactionDamageLog).toMatchObject([
      {
        reaction: "shatter",
        triggerDamageEventId: trigger?.id,
        triggerFrame: 2,
        damageFrame: 2,
        targetingMode: "single-target",
        radius: 0,
        checkedTargetIds: ["enemy-0"],
        hitTargetIds: ["enemy-0"],
        damageEventIds: [shatter?.id]
      }
    ]);
    expect(
      result.frozenStateLog.map((entry) => [
        entry.operation,
        entry.frame,
        entry.reason
      ])
    ).toEqual([
      ["start", 0, null],
      ["shatter-consume", 2, "FROZEN_CONSUMED_BY_SHATTER"]
    ]);
  });

  it("reads Shatter level, EM, and reaction bonus live at the trigger frame across an action-snapshot buff boundary", () => {
    const config = makeShatterConfig();
    const freezeAbility = config.timeline!.abilities.find(
      (ability) => ability.id === "hydro-freeze"
    )!;
    const crusherHit = config.timeline!.abilities.find(
      (ability) => ability.id === "crusher-skill"
    )!.hits![0]!;
    freezeAbility.buffs = [
      {
        key: "temporary-em",
        label: "动作快照精通",
        target: "crusher",
        stat: "em",
        value: 200,
        startFrame: 0,
        durationFrames: 10
      },
      {
        key: "temporary-reaction-bonus",
        label: "动作快照反应加成",
        target: "crusher",
        stat: "reactionBonus",
        value: 0.3,
        startFrame: 0,
        durationFrames: 10
      }
    ];
    crusherHit.frame = 20;
    crusherHit.snapshot = "action";

    const result = simulate(config, { critMode: "noCrit" });
    const trigger = result.damageEvents.find(
      (event) =>
        event.kind === "direct" &&
        event.sourceActorId === "crusher"
    );
    const shatter = result.damageEvents.find(
      (event) => event.reaction === "shatter"
    );
    const expected = calcTransformativeReactionDamage({
      characterLevel: 90,
      elementalMastery: 100,
      reactionBonus: 0.2,
      baseMultiplier: 3,
      effectiveResistance: 0.25
    });

    expect(trigger).toMatchObject({
      frame: 22,
      snapshot: "action",
      statsBeforeDamage: {
        em: 300,
        reactionBonus: 0.5
      }
    });
    expect(shatter).toMatchObject({
      frame: 22,
      snapshot: "hit",
      statsBeforeDamage: {
        em: 100,
        reactionBonus: 0.2
      },
      activeStatuses: [],
      transformativeReactionFactors: {
        characterLevel: 90,
        elementalMastery: 100,
        reactionBonus: 0.2
      }
    });
    expect(shatter?.finalDamage).toBeCloseTo(
      expected.finalDamage,
      10
    );
  });

  it("lets Geo trigger Shatter without a blunt strike classification", () => {
    const result = simulate(
      makeShatterConfig({
        strikeType: "default",
        element: "geo"
      }),
      { critMode: "noCrit" }
    );
    const trigger = result.damageEvents.find(
      (event) => event.sourceActorId === "crusher"
    );

    expect(trigger?.reactionAudit.shatterReaction).toMatchObject({
      strikeType: "default",
      triggered: true,
      scheduled: true
    });
    expect(
      result.damageEvents.some(
        (event) => event.reaction === "shatter"
      )
    ).toBe(true);
  });

  it("does not run Shatter checks for non-blunt non-Geo hits", () => {
    const result = simulate(
      makeShatterConfig({ strikeType: "default" }),
      { critMode: "noCrit" }
    );
    const trigger = result.damageEvents.find(
      (event) => event.sourceActorId === "crusher"
    );

    expect(trigger?.reactionAudit.shatterReaction).toBeNull();
    expect(result.reactionDamageLog).toEqual([]);
    expect(
      result.frozenStateLog.map((entry) => entry.operation)
    ).toEqual(["start"]);
  });

  it("applies blunt poise consumption first and prevents Shatter when it depletes Frozen", () => {
    const result = simulate(
      makeShatterConfig({ poiseDamage: 300 }),
      { critMode: "noCrit" }
    );
    const trigger = result.damageEvents.find(
      (event) => event.sourceActorId === "crusher"
    );

    expect(trigger?.reactionAudit.shatterReaction).toMatchObject({
      triggered: false,
      scheduled: false,
      blockedReason: "FROZEN_DEPLETED_BY_POISE",
      poiseDamage: 300,
      frozenGaugeAfterPoise: 0,
      shatterConsumedGaugeUnits: 0
    });
    expect(result.reactionDamageLog).toEqual([]);
    expect(
      result.frozenStateLog.map((entry) => [
        entry.operation,
        entry.reason
      ])
    ).toEqual([
      ["start", null],
      ["poise-consume", "FROZEN_DEPLETED_BY_BLUNT_POISE"]
    ]);
  });

  it("consumes refrozen durability inside the 12-frame GCD but blocks only the second damage", () => {
    const config = makeShatterConfig({ repeatWithinGcd: true });
    const first = simulate(config, { critMode: "noCrit" });
    const second = simulate(config, { critMode: "noCrit" });
    const shatterLogs = first.reactionDamageLog.filter(
      (entry) => entry.reaction === "shatter"
    );

    expect(shatterLogs).toMatchObject([
      {
        triggerFrame: 2,
        damageFrame: 2,
        scheduled: true,
        blockedReason: null,
        nextAvailableFrame: 14,
        damageEventIds: [expect.any(Number)]
      },
      {
        triggerFrame: 8,
        damageFrame: 8,
        scheduled: false,
        withinSimulation: false,
        blockedReason: "REACTION_DAMAGE_GCD",
        nextAvailableFrame: 14,
        damageEventIds: []
      }
    ]);
    expect(
      first.frozenStateLog
        .filter((entry) => entry.operation === "shatter-consume")
        .map((entry) => entry.frame)
    ).toEqual([2, 8]);
    expect(
      first.damageEvents.filter(
        (event) => event.reaction === "shatter"
      )
    ).toHaveLength(1);
    expect(second).toEqual(first);
  });

  it("applies ReactionA first-two-in-30f after the independent 12-frame Shatter trigger GCD", () => {
    const config = makeReactionAShatterConfig();
    const first = simulate(config, { critMode: "noCrit" });
    const second = simulate(config, { critMode: "noCrit" });
    const shatterLogs = first.reactionDamageLog.filter(
      (entry) => entry.reaction === "shatter"
    );
    const shatterEvents = first.damageEvents.filter(
      (event) => event.reaction === "shatter"
    );

    expect(
      shatterLogs.map((entry) => entry.triggerFrame)
    ).toEqual([2, 14, 26]);
    expect(
      shatterLogs.map(
        (entry) => entry.damageGroupDecisions[0]
      )
    ).toMatchObject([
      {
        reaction: "shatter",
        sourceActorId: "crusher",
        targetId: "enemy-0",
        windowStartFrame: 2,
        hitIndex: 0,
        resetFrames: 30,
        sequence: [true, true, false],
        damageAllowed: true,
        blockedReason: null
      },
      {
        reaction: "shatter",
        sourceActorId: "crusher",
        targetId: "enemy-0",
        windowStartFrame: 2,
        hitIndex: 1,
        resetFrames: 30,
        sequence: [true, true, false],
        damageAllowed: true,
        blockedReason: null
      },
      {
        reaction: "shatter",
        sourceActorId: "crusher",
        targetId: "enemy-0",
        windowStartFrame: 2,
        hitIndex: 2,
        resetFrames: 30,
        sequence: [true, true, false],
        damageAllowed: false,
        blockedReason: "REACTION_A_DAMAGE_ICD"
      }
    ]);
    expect(
      shatterLogs.map(
        (entry) => entry.damageGroupBlockedTargetIds
      )
    ).toEqual([[], [], ["enemy-0"]]);
    expect(shatterEvents.map((event) => event.frame)).toEqual([
      2, 14, 26
    ]);
    expect(shatterEvents[2]).toMatchObject({
      potentialDamage: 0,
      finalDamage: 0,
      displayDamage: 0,
      damageFactors: {
        groupMultiplier: 0
      },
      damageComposition: {
        direct: 0,
        additiveReaction: 0,
        transformativeReaction: 0
      }
    });
    expect(shatterLogs[2]?.damageEventIds).toEqual([
      shatterEvents[2]?.id
    ]);
    expect(
      first.frozenStateLog
        .filter(
          (entry) => entry.operation === "shatter-consume"
        )
        .map((entry) => entry.frame)
    ).toEqual([2, 14, 26]);
    expect(second).toEqual(first);
  });

  it("models Overload as a 90-poise blunt hit that can Shatter a nearby frozen target", () => {
    const result = simulate(makeOverloadShatterConfig(), {
      critMode: "noCrit"
    });
    const overloadOnFrozen = result.damageEvents.find(
      (event) =>
        event.reaction === "overload" &&
        event.targetId === "enemy-1"
    );
    const shatter = result.damageEvents.find(
      (event) => event.reaction === "shatter"
    );

    expect(overloadOnFrozen).toMatchObject({
      frame: 3,
      reactionAudit: {
        shatterReaction: {
          strikeType: "blunt",
          poiseDamage: 90,
          triggered: true,
          scheduled: true,
          poiseConsumedGaugeUnits: 0.54,
          frozenGaugeAfter: 0
        }
      }
    });
    expect(shatter).toMatchObject({
      frame: 3,
      targetId: "enemy-1",
      parentDamageEventId: overloadOnFrozen?.id,
      element: "physical",
      reaction: "shatter"
    });
    expect(
      result.frozenStateLog.map((entry) => [
        entry.operation,
        entry.frame,
        entry.reason
      ])
    ).toEqual([
      ["start", 0, null],
      [
        "poise-consume",
        3,
        "FROZEN_PARTIALLY_CONSUMED_BY_BLUNT_POISE"
      ],
      ["shatter-consume", 3, "FROZEN_CONSUMED_BY_SHATTER"]
    ]);
    expect(
      result.reactionDamageLog.map((entry) => entry.reaction)
    ).toEqual(["overload", "shatter"]);
  });
});
