import {
  dendroCoreContactLogSchema,
  dendroCoreLogSchema,
  dendroCoreResultReferencesSchema,
  dendroCoreTimelineSchema,
  quickenStateLogEntrySchema,
  type AbilityDefinition,
  type CharacterProfile,
  type Element,
  type EnemyTargetProfile,
  type FrameHitDefinition,
  type LegalTimelineCommand,
  type SimConfig,
  type TargetMotionDefinition
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { DENDRO_CORE_CONSTANTS } from "../dendro-core";
import { SeededRandom } from "../energy";
import { calcTransformativeReactionDamage } from "../formulas";
import {
  EVENT_PRIORITY,
  projectBloomBurningFuelExpiry,
  simulate
} from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

type CoreContactElement = "pyro" | "electro";

const DEFAULT_CONTACT_GEOMETRY = {
  kind: "circle" as const,
  coordinateSpace: "world" as const,
  origin: { x: 0, y: 0 },
  radius: 1
};

const OWNER_STATS = {
  hydro: { em: 100, reactionBonus: 0.2 },
  pyro: { em: 200, reactionBonus: 0.1 },
  electro: { em: 200, reactionBonus: 0.1 }
} as const;

function actor(
  base: CharacterProfile,
  id: "hydro" | CoreContactElement
): CharacterProfile {
  const element: Element = id;
  return {
    ...base,
    id,
    name: id,
    element,
    color:
      id === "hydro"
        ? "#3399ff"
        : id === "pyro"
          ? "#ff5533"
          : "#9966ff",
    level: 90,
    stats: {
      ...neutralStats,
      baseAtk: 0,
      em: OWNER_STATS[id].em,
      reactionBonus: OWNER_STATS[id].reactionBonus
    }
  };
}

function applicationHit(
  id: string,
  frame: number,
  element: "hydro" | CoreContactElement,
  contactGeometry: NonNullable<
    FrameHitDefinition["geometry"]
  > = DEFAULT_CONTACT_GEOMETRY
): FrameHitDefinition {
  return {
    id,
    label: id,
    frame,
    scaling: 0,
    element,
    application: {
      gaugeUnits: 1,
      icdTag: id,
      icdGroup: "no-icd"
    },
    ...(element === "hydro"
      ? {}
      : { geometry: contactGeometry })
  };
}

interface CoreScenarioOptions {
  coreCount: number;
  durationFrames: number;
  initialDendroGaugeUnits?: number;
  contact?: CoreContactElement;
  contactFrame?: number;
  contactGeometry?: FrameHitDefinition["geometry"];
  contactBuffEm?: number;
  sourceBuffEm?: number;
  targets?: EnemyTargetProfile[];
  targetMotions?: TargetMotionDefinition[];
  randomSeed?: string;
}

function makeCoreScenario({
  coreCount,
  durationFrames,
  initialDendroGaugeUnits,
  contact,
  contactFrame = 31,
  contactGeometry,
  contactBuffEm,
  sourceBuffEm,
  targets,
  targetMotions,
  randomSeed = "bloom-integration-seed"
}: CoreScenarioOptions): SimConfig {
  const base = makeConfig();
  const sourceTarget: EnemyTargetProfile = {
    id: "enemy-0",
    name: "Core source",
    position: { x: 0, y: 0 },
    hitboxRadius: 0,
    // Initial Aura retains 80% of nominal durability. Each 1U Hydro
    // Bloom consumes 0.5U Dendro, so 0.625 nominal creates one core.
    initialAura: [
      {
        element: "dendro",
        gaugeUnits:
          initialDendroGaugeUnits ?? coreCount * 0.625
      }
    ]
  };
  const targetRegistry = (targets ?? [sourceTarget]).map(
    (target, index) =>
      index === 0
        ? {
            ...target,
            initialAura: sourceTarget.initialAura!
          }
        : target
  );
  const hydroAbility: AbilityDefinition = {
    id: "hydro-core-generator",
    actorId: "hydro",
    name: "Hydro core generator",
    kind: "skill",
    cancelFrame: 1,
    animationEndFrame: 1,
    cooldownFrames: 0,
    hits: Array.from({ length: coreCount }, (_, index) =>
      applicationHit(`hydro-${index}`, 0, "hydro")
    ),
    ...(sourceBuffEm === undefined
      ? {}
      : {
          buffs: [
            {
              key: "hydro-post-spawn-em",
              label: "绽放爆炸帧元素精通",
              target: "self" as const,
              stat: "em" as const,
              value: sourceBuffEm,
              startFrame: 60,
              durationFrames: 400
            }
          ]
        })
  };
  const abilities: AbilityDefinition[] = [hydroAbility];
  const commands: LegalTimelineCommand[] = [
    {
      type: "skill",
      actorId: "hydro",
      abilityId: hydroAbility.id,
      atFrame: 0
    }
  ];
  const characters = [actor(base.characters[0]!, "hydro")];

  if (contact !== undefined) {
    const contactAbility: AbilityDefinition = {
      id: `${contact}-core-contact`,
      actorId: contact,
      name: `${contact} core contact`,
      kind: "skill",
      cancelFrame: 1,
      animationEndFrame: 1,
      cooldownFrames: 0,
      hits: [
        applicationHit(
          `${contact}-contact-hit`,
          0,
          contact,
          contactGeometry ?? DEFAULT_CONTACT_GEOMETRY
        )
      ],
      ...(contactBuffEm === undefined
        ? {}
        : {
            buffs: [
              {
                key: `${contact}-post-contact-em`,
                label: "爆炸帧元素精通",
                target: "self" as const,
                stat: "em" as const,
                value: contactBuffEm,
                startFrame: 1,
                durationFrames: 100
              }
            ]
          })
    };
    abilities.push(contactAbility);
    characters.push(actor(base.characters[0]!, contact));
    commands.push(
      {
        type: "swap",
        characterId: contact,
        atFrame: contactFrame - 1
      },
      {
        type: "skill",
        actorId: contact,
        abilityId: contactAbility.id,
        atFrame: contactFrame
      }
    );
  }

  return {
    ...base,
    dataVersion: "dendro-core-provisional-integration-1",
    randomSeed,
    meta: {
      name: "Dendro-core integration vector",
      version: "1.31.0",
      verificationStatus: "provisional"
    },
    duration: durationFrames / 60,
    cycleLength: durationFrames / 60,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: targetRegistry,
      ...(targetMotions === undefined
        ? {}
        : { targetMotions })
    },
    characters,
    rotation: [],
    reactionEngine: { mode: "aura-v5" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "hydro",
      swapFrames: 1,
      abilities,
      commands
    }
  };
}

function expectedReactionDamage(
  owner: keyof typeof OWNER_STATS,
  multiplier: 2 | 3,
  emBonus = 0
): number {
  return calcTransformativeReactionDamage({
    characterLevel: 90,
    elementalMastery: OWNER_STATS[owner].em + emBonus,
    reactionBonus: OWNER_STATS[owner].reactionBonus,
    baseMultiplier: multiplier,
    effectiveResistance: 0.1
  }).finalDamage;
}

function validateCoreResult(
  result: ReturnType<typeof simulate>
): void {
  expect(() =>
    dendroCoreLogSchema.parse(result.dendroCoreLog)
  ).not.toThrow();
  expect(() =>
    dendroCoreContactLogSchema.parse(
      result.dendroCoreContactLog
    )
  ).not.toThrow();
  expect(() =>
    dendroCoreTimelineSchema.parse(result.dendroCoreTimeline)
  ).not.toThrow();
  expect(() =>
    dendroCoreResultReferencesSchema.parse(result)
  ).not.toThrow();
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

describe("aura-v5 Dendro-core integration", () => {
  it("projects explicit Bloom Fuel lifecycle mutations into authoritative expiry events", () => {
    expect(
      projectBloomBurningFuelExpiry({
        operation: "expiry-rebase",
        generation: 7,
        decayPerFrame: 1 / 150,
        expiresAtFrameBefore: 120,
        expiresAtFrameAfter: 105
      })
    ).toEqual({
      generation: 7,
      expiryFrame: 105
    });
    expect(
      projectBloomBurningFuelExpiry({
        operation: "deplete-pending-purge",
        generation: 7,
        decayPerFrame: 1 / 150,
        expiresAtFrameBefore: 15,
        expiresAtFrameAfter: 1
      })
    ).toEqual({
      generation: 7,
      expiryFrame: 1
    });
    expect(
      projectBloomBurningFuelExpiry({
        operation: "none",
        generation: 7,
        decayPerFrame: 1 / 150,
        expiresAtFrameBefore: 120,
        expiresAtFrameAfter: 120
      })
    ).toBeNull();
  });

  it("spawns at +30, expires after 300 frames, and deals live Bloom damage at +1", () => {
    const config = makeCoreScenario({
      coreCount: 1,
      durationFrames: 360,
      sourceBuffEm: 300
    });
    const result = simulate(config, { critMode: "noCrit" });

    expect(result.timelineExecution?.failures).toEqual([]);
    expect(
      result.dendroCoreLog.map(({ operation, frame }) => ({
        operation,
        frame
      }))
    ).toEqual([
      { operation: "spawn-scheduled", frame: 0 },
      { operation: "spawn", frame: 30 },
      { operation: "expire", frame: 330 }
    ]);
    const spawn = result.dendroCoreLog.find(
      (entry) => entry.operation === "spawn"
    );
    expect(spawn).toMatchObject({
      coreId: 0,
      spawnedAtFrame: 30,
      expiresAtFrame: 330,
      spawnRadius: 0.5,
      rngStream: "dendro-core-position-v1"
    });
    if (spawn?.operation !== "spawn") {
      throw new Error("Expected one Dendro-core spawn.");
    }
    expect(
      Math.hypot(spawn.position.x, spawn.position.y)
    ).toBeCloseTo(0.5, 12);

    const expiry = result.dendroCoreLog.find(
      (entry) => entry.operation === "expire"
    );
    expect(expiry).toMatchObject({
      coreId: 0,
      reaction: "bloom",
      frame: 330,
      damageFrame: 331,
      reason: "NATURAL_EXPIRY"
    });
    if (expiry?.operation !== "expire") {
      throw new Error("Expected one Dendro-core expiry.");
    }
    const bloomLog =
      result.reactionDamageLog[expiry.reactionDamageLogId]!;
    expect(bloomLog).toMatchObject({
      reaction: "bloom",
      sourceActorId: "hydro",
      damageFrame: 331,
      scheduleKind: "dendro-core-bloom",
      targetingMode: "radius",
      radius: 5,
      sourceCoreId: 0,
      sourceCoreLogId: expiry.id,
      scheduled: true,
      withinSimulation: true
    });
    const bloomEvent = result.damageEvents.find(
      (event) =>
        event.reaction === "bloom" && event.frame === 331
    );
    expect(bloomEvent?.sourceActorId).toBe("hydro");
    expect(bloomEvent?.em).toBe(400);
    expect(bloomEvent?.finalDamage).toBeCloseTo(
      expectedReactionDamage("hydro", 2, 300),
      10
    );
    expect(bloomEvent?.displayDamage).toBe(
      Math.round(expectedReactionDamage("hydro", 2, 300))
    );
    expect(
      result.dendroCoreTimeline.points.map(
        ({ frame, operation, coreId, activeCores }) => ({
          frame,
          operation,
          coreId,
          activeIds: activeCores.map((core) => core.coreId)
        })
      )
    ).toEqual([
      {
        frame: 30,
        operation: "spawn",
        coreId: 0,
        activeIds: [0]
      },
      {
        frame: 330,
        operation: "expire",
        coreId: 0,
        activeIds: []
      }
    ]);
    validateCoreResult(result);

    const repeated = simulate(config, { critMode: "noCrit" });
    expect(repeated.dendroCoreLog).toEqual(
      result.dendroCoreLog
    );
    expect(repeated.dendroCoreTimeline).toEqual(
      result.dendroCoreTimeline
    );
    expect(repeated.damageEvents).toEqual(result.damageEvents);
  });

  it("evicts the oldest global core when the sixth core spawns", () => {
    const result = simulate(
      makeCoreScenario({
        coreCount: 6,
        durationFrames: 60
      }),
      { critMode: "noCrit" }
    );

    expect(
      result.dendroCoreLog.filter(
        (entry) => entry.operation === "spawn-scheduled"
      )
    ).toHaveLength(6);
    expect(
      result.dendroCoreLog.filter(
        (entry) => entry.operation === "spawn"
      )
    ).toHaveLength(6);
    const eviction = result.dendroCoreLog.find(
      (entry) => entry.operation === "evict"
    );
    if (eviction?.operation !== "evict") {
      throw new Error("Expected the oldest core to be evicted.");
    }
    expect(eviction).toMatchObject({
      coreId: 0,
      frame: 30,
      reaction: "bloom",
      damageFrame: 31,
      reason: "ACTIVE_CORE_LIMIT"
    });
    expect(
      result.dendroCoreTimeline.points.every(
        (point) => point.activeCores.length <= 5
      )
    ).toBe(true);
    expect(
      result.dendroCoreTimeline.points
        .at(-1)!
        .activeCores.map((core) => core.coreId)
    ).toEqual([1, 2, 3, 4, 5]);
    expect(
      result.reactionDamageLog.find(
        (entry) =>
          entry.scheduleKind === "dendro-core-bloom" &&
          entry.sourceCoreId === 0
      )
    ).toMatchObject({
      reaction: "bloom",
      damageFrame: 31,
      withinSimulation: true
    });
    validateCoreResult(result);
  });

  it("preserves direct-then-Quicken-follow-up ordering when one Dendro hit creates two cores", () => {
    const base = makeConfig();
    const config: SimConfig = {
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
            name: "EC Bloom target",
            position: { x: 0, y: 0 },
            initialAura: [
              { element: "hydro", gaugeUnits: 2.5 },
              { element: "electro", gaugeUnits: 1.25 }
            ]
          }
        ]
      },
      characters: [
        {
          ...base.characters[0]!,
          id: "dendro",
          name: "Dendro",
          element: "dendro",
          level: 90,
          stats: {
            ...neutralStats,
            baseAtk: 0,
            em: 100
          }
        }
      ],
      rotation: [],
      reactionEngine: { mode: "aura-v5" },
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "dendro",
        swapFrames: 1,
        abilities: [
          {
            id: "double-core",
            actorId: "dendro",
            name: "Double core",
            kind: "skill",
            cancelFrame: 1,
            animationEndFrame: 1,
            cooldownFrames: 0,
            hits: [
              {
                id: "dendro-hit",
                frame: 0,
                scaling: 0,
                element: "dendro",
                application: {
                  gaugeUnits: 1.5,
                  icdTag: "double-core",
                  icdGroup: "no-icd"
                }
              }
            ]
          }
        ],
        commands: [
          {
            type: "skill",
            actorId: "dendro",
            abilityId: "double-core",
            atFrame: 0
          }
        ]
      }
    };
    const result = simulate(config, { critMode: "noCrit" });
    const trigger = result.damageEvents[0]!;

    expect(
      trigger.reactionAudit.bloomReactions.map(
        ({
          operation,
          coreSpawnFrame,
          sourceGaugeUnitsSpent
        }) => ({
          operation,
          coreSpawnFrame,
          sourceGaugeUnitsSpent
        })
      )
    ).toEqual([
      {
        operation: "direct",
        coreSpawnFrame: 30,
        sourceGaugeUnitsSpent: 0.5
      },
      {
        operation: "quicken-followup",
        coreSpawnFrame: 30,
        sourceGaugeUnitsSpent: 0.5
      }
    ]);
    expect(
      result.dendroCoreLog
        .filter(
          (entry) => entry.operation === "spawn-scheduled"
        )
        .map((entry) => ({
          coreId: entry.coreId,
          bloomReactionIndex:
            entry.operation === "spawn-scheduled"
              ? entry.bloomReactionIndex
              : -1,
          spawnFrame:
            entry.operation === "spawn-scheduled"
              ? entry.spawnFrame
              : -1
        }))
    ).toEqual([
      { coreId: 0, bloomReactionIndex: 0, spawnFrame: 30 },
      { coreId: 1, bloomReactionIndex: 1, spawnFrame: 30 }
    ]);
    expect(
      result.dendroCoreTimeline.points.map(
        ({ operation, coreId }) => ({ operation, coreId })
      )
    ).toEqual([
      { operation: "spawn", coreId: 0 },
      { operation: "spawn", coreId: 1 }
    ]);
    validateCoreResult(result);
  });

  it("contacts every intersecting core once per hit group and records the third Burgeon as zero damage", () => {
    const result = simulate(
      makeCoreScenario({
        coreCount: 3,
        durationFrames: 120,
        contact: "pyro"
      }),
      { critMode: "noCrit" }
    );

    expect(result.dendroCoreContactLog).toHaveLength(1);
    expect(result.dendroCoreContactLog[0]).toMatchObject({
      frame: 31,
      eventPriority: 3,
      sourceActorId: "pyro",
      triggerElement: "pyro",
      reaction: "burgeon",
      checkedCoreIds: [0, 1, 2],
      contactedCoreIds: [0, 1, 2],
      blockedReason: null
    });
    const removals = result.dendroCoreLog.filter(
      (entry) =>
        entry.operation === "consume" &&
        entry.reaction === "burgeon"
    );
    expect(removals).toHaveLength(3);
    expect(
      removals.map((entry) => {
        if (entry.operation !== "consume") {
          throw new Error("Expected a consumed Dendro core.");
        }
        return {
          frame: entry.frame,
          damageFrame: entry.damageFrame,
          sourceActorId: entry.sourceActorId
        };
      })
    ).toEqual([
      {
        frame: 31,
        damageFrame: 32,
        sourceActorId: "hydro"
      },
      {
        frame: 31,
        damageFrame: 32,
        sourceActorId: "hydro"
      },
      {
        frame: 31,
        damageFrame: 32,
        sourceActorId: "hydro"
      }
    ]);
    const logs = result.reactionDamageLog.filter(
      (entry) =>
        entry.scheduleKind === "dendro-core-burgeon"
    );
    expect(logs).toHaveLength(3);
    expect(
      logs.map((entry) => ({
        sourceActorId: entry.sourceActorId,
        decision: entry.damageGroupDecisions[0],
        blockedTargets: entry.damageGroupBlockedTargetIds
      }))
    ).toMatchObject([
      {
        sourceActorId: "pyro",
        decision: {
          hitIndex: 0,
          damageAllowed: true,
          blockedReason: null
        },
        blockedTargets: []
      },
      {
        sourceActorId: "pyro",
        decision: {
          hitIndex: 1,
          damageAllowed: true,
          blockedReason: null
        },
        blockedTargets: []
      },
      {
        sourceActorId: "pyro",
        decision: {
          hitIndex: 2,
          damageAllowed: false,
          blockedReason: "REACTION_A_DAMAGE_ICD"
        },
        blockedTargets: ["enemy-0"]
      }
    ]);
    const burgeonEvents = logs.map(
      (entry) => result.damageEvents[entry.damageEventIds[0]!]!
    );
    const expected = expectedReactionDamage("pyro", 3);
    expect(burgeonEvents[0]!.finalDamage).toBeCloseTo(expected, 10);
    expect(burgeonEvents[1]!.finalDamage).toBeCloseTo(expected, 10);
    expect(burgeonEvents[2]).toMatchObject({
      reaction: "burgeon",
      finalDamage: 0,
      displayDamage: 0
    });
    expect(burgeonEvents).toHaveLength(3);
    expect(
      new Set(burgeonEvents.map((event) => event.hitId)).size
    ).toBe(3);
    expect(
      new Set(
        burgeonEvents.map((event) => event.hitGroupId)
      ).size
    ).toBe(3);
    validateCoreResult(result);
  });

  it("deduplicates one explicit AoE core contact across enemy fanout", () => {
    const result = simulate(
      makeCoreScenario({
        coreCount: 1,
        durationFrames: 120,
        contact: "pyro",
        contactGeometry: {
          kind: "circle",
          coordinateSpace: "world",
          origin: { x: 0, y: 0 },
          radius: 2
        },
        targets: [
          {
            id: "enemy-0",
            name: "Core source",
            position: { x: 0, y: 0 },
            hitboxRadius: 0
          },
          {
            id: "enemy-1",
            name: "Second enemy",
            position: { x: 1.5, y: 0 },
            hitboxRadius: 0
          }
        ]
      }),
      { critMode: "noCrit" }
    );

    expect(result.dendroCoreContactLog).toHaveLength(1);
    expect(result.dendroCoreContactLog[0]).toMatchObject({
      eventType: "hit",
      sourceActorId: "pyro",
      triggerElement: "pyro",
      checkedCoreIds: [0],
      contactedCoreIds: [0]
    });
    expect(
      result.dendroCoreContactLog[0]!.hitResolutionLogIds
    ).toHaveLength(2);
    expect(
      result.dendroCoreContactLog[0]!.triggerDamageEventIds
    ).toHaveLength(2);
    expect(
      result.dendroCoreLog.filter(
        (entry) => entry.operation === "consume"
      )
    ).toHaveLength(1);
    expect(
      result.reactionDamageLog.filter(
        (entry) =>
          entry.scheduleKind === "dendro-core-burgeon"
      )
    ).toHaveLength(1);
    validateCoreResult(result);
  });

  it("contacts a core from explicit geometry even when the attack misses every enemy", () => {
    const result = simulate(
      makeCoreScenario({
        coreCount: 1,
        durationFrames: 120,
        contact: "pyro",
        contactGeometry: {
          kind: "circle",
          coordinateSpace: "world",
          origin: { x: 1.6, y: 0 },
          radius: 0.1
        }
      }),
      { critMode: "noCrit" }
    );

    expect(result.dendroCoreContactLog).toHaveLength(1);
    expect(result.dendroCoreContactLog[0]).toMatchObject({
      frame: 31,
      hitResolutionLogIds: [1],
      triggerDamageEventIds: [],
      checkedCoreIds: [0],
      contactedCoreIds: [0],
      blockedReason: null
    });
    expect(
      result.hitResolutionLog.find(
        (entry) => entry.sourceActorId === "pyro"
      )
    ).toMatchObject({
      outcome: "miss",
      damageEventId: null
    });
    const burgeonLog = result.reactionDamageLog.find(
      (entry) =>
        entry.scheduleKind === "dendro-core-burgeon"
    );
    expect(burgeonLog).toMatchObject({
      triggerDamageEventId: null,
      triggerHitGroupId: expect.any(String),
      damageEventIds: [1]
    });
    expect(result.damageEvents[1]).toMatchObject({
      reaction: "burgeon",
      parentDamageEventId: null,
      finalDamage: expectedReactionDamage("pyro", 3)
    });
    validateCoreResult(result);
  });

  it("spawns a core before a same-frame raw Pyro hit contacts it", () => {
    const result = simulate(
      makeCoreScenario({
        coreCount: 1,
        durationFrames: 120,
        contact: "pyro",
        contactFrame: 30
      }),
      { critMode: "noCrit" }
    );

    expect(
      result.dendroCoreLog
        .filter(
          (entry) =>
            entry.operation === "spawn" ||
            entry.operation === "consume"
        )
        .map((entry) => ({
          operation: entry.operation,
          frame: entry.frame,
          coreId: entry.coreId
        }))
    ).toEqual([
      { operation: "spawn", frame: 30, coreId: 0 },
      { operation: "consume", frame: 30, coreId: 0 }
    ]);
    expect(result.dendroCoreContactLog).toHaveLength(1);
    expect(result.dendroCoreContactLog[0]).toMatchObject({
      frame: 30,
      triggerElement: "pyro",
      checkedCoreIds: [0],
      contactedCoreIds: [0]
    });
    expect(
      result.reactionDamageLog.find(
        (entry) =>
          entry.scheduleKind === "dendro-core-burgeon"
      )
    ).toMatchObject({
      damageFrame: 31,
      sourceCoreId: 0,
      withinSimulation: true
    });
    validateCoreResult(result);
  });

  it("expires a core before a same-frame contact can consume it", () => {
    const result = simulate(
      makeCoreScenario({
        coreCount: 1,
        durationFrames: 360,
        contact: "pyro",
        contactFrame: 330
      }),
      { critMode: "noCrit" }
    );

    expect(
      result.dendroCoreLog.filter(
        (entry) =>
          entry.operation === "expire" ||
          entry.operation === "consume"
      )
    ).toMatchObject([
      {
        operation: "expire",
        frame: 330,
        reaction: "bloom",
        damageFrame: 331
      }
    ]);
    expect(result.dendroCoreContactLog).toEqual([]);
    expect(
      result.damageEvents.filter(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.reaction === "bloom"
      )
    ).toHaveLength(1);
    expect(
      result.damageEvents.filter(
        (event) => event.reaction === "burgeon"
      )
    ).toEqual([]);
    validateCoreResult(result);
  });

  it.each([
    {
      label: "Overload",
      contact: "pyro" as const,
      initialAuraElement: "electro" as const,
      reaction: "overload" as const,
      damageFrame: 32
    },
    {
      label: "Superconduct",
      contact: "electro" as const,
      initialAuraElement: "cryo" as const,
      reaction: "superconduct" as const,
      damageFrame: 32
    },
    {
      label: "Electro-Charged",
      contact: "electro" as const,
      initialAuraElement: "hydro" as const,
      reaction: "electroCharged" as const,
      damageFrame: 41
    }
  ])(
    "does not let $label reaction damage consume a nearby Dendro core without positive application Gauge",
    ({
      contact,
      initialAuraElement,
      reaction,
      damageFrame
    }) => {
      const reactionCenter = { x: 4, y: 0 };
      const result = simulate(
        makeCoreScenario({
          coreCount: 1,
          durationFrames: 60,
          contact,
          contactFrame: 31,
          contactGeometry: {
            kind: "circle",
            coordinateSpace: "world",
            origin: reactionCenter,
            radius: 0.000001
          },
          targets: [
            {
              id: "enemy-0",
              name: "Core source",
              position: { x: 0, y: 0 },
              hitboxRadius: 0
            },
            {
              id: "enemy-1",
              name: `${reaction} source`,
              position: reactionCenter,
              hitboxRadius: 0,
              initialAura: [
                {
                  element: initialAuraElement,
                  gaugeUnits: 1
                }
              ]
            }
          ]
        }),
        { critMode: "noCrit" }
      );
      const spawn = result.dendroCoreLog.find(
        (entry) => entry.operation === "spawn"
      );
      if (spawn?.operation !== "spawn") {
        throw new Error("Expected one active Dendro core.");
      }
      const reactionLog = result.reactionDamageLog.find(
        (entry) =>
          entry.reaction === reaction &&
          entry.damageFrame === damageFrame
      );
      expect(reactionLog).toMatchObject({
        reaction,
        damageFrame,
        applicationGaugeUnits: null
      });
      expect(
        result.damageEvents.find(
          (event) =>
            event.reaction === reaction &&
            event.frame === damageFrame
        )
      ).toBeDefined();

      if (reaction !== "electroCharged") {
        expect(
          Math.hypot(
            spawn.position.x - reactionCenter.x,
            spawn.position.y - reactionCenter.y
          )
        ).toBeLessThanOrEqual(
          (reactionLog?.radius ?? 0) + spawn.hitboxRadius
        );
      }
      expect(result.dendroCoreContactLog).toMatchObject([
        {
          eventType: "hit",
          contactedCoreIds: []
        }
      ]);
      expect(
        result.dendroCoreContactLog.filter(
          (entry) => entry.eventType === "reactionDamage"
        )
      ).toEqual([]);
      expect(
        result.dendroCoreLog.filter(
          (entry) => entry.operation === "consume"
        )
      ).toEqual([]);
      expect(
        result.dendroCoreTimeline.points
          .at(-1)
          ?.activeCores.map((core) => core.coreId)
      ).toEqual([0]);
      validateCoreResult(result);
    }
  );

  it("does not let natural Bloom damage recursively consume a nearby active core", () => {
    const config = makeCoreScenario({
      coreCount: 2,
      durationFrames: 340,
      targets: [
        {
          id: "enemy-0",
          name: "Early core source",
          position: { x: 0, y: 0 },
          hitboxRadius: 0
        },
        {
          id: "enemy-1",
          name: "Late core source",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            { element: "dendro", gaugeUnits: 0.625 }
          ]
        }
      ]
    });
    const hydroAbility = config.timeline?.abilities.find(
      (ability) => ability.id === "hydro-core-generator"
    );
    if (hydroAbility?.hits === undefined) {
      throw new Error("Expected the Hydro core generator.");
    }
    hydroAbility.animationEndFrame = 91;
    hydroAbility.hits[1] = {
      ...hydroAbility.hits[1]!,
      frame: 90,
      targeting: {
        targetId: "enemy-1",
        outcome: "landed"
      }
    };

    const result = simulate(config, { critMode: "noCrit" });
    const spawns = result.dendroCoreLog.filter(
      (entry) => entry.operation === "spawn"
    );
    const firstSpawn = spawns[0];
    const secondSpawn = spawns[1];
    if (
      firstSpawn?.operation !== "spawn" ||
      secondSpawn?.operation !== "spawn"
    ) {
      throw new Error("Expected two staggered Dendro cores.");
    }
    expect(
      Math.hypot(
        firstSpawn.position.x - secondSpawn.position.x,
        firstSpawn.position.y - secondSpawn.position.y
      )
    ).toBeLessThanOrEqual(DENDRO_CORE_CONSTANTS.bloomRadius);
    expect(
      result.reactionDamageLog.find(
        (entry) =>
          entry.scheduleKind === "dendro-core-bloom" &&
          entry.sourceCoreId === 0
      )
    ).toMatchObject({
      damageFrame: 331,
      applicationGaugeUnits: null
    });
    expect(result.dendroCoreContactLog).toEqual([]);
    expect(
      result.dendroCoreLog.filter(
        (entry) => entry.operation === "consume"
      )
    ).toEqual([]);
    expect(
      result.dendroCoreTimeline.points
        .at(-1)
        ?.activeCores.map((core) => core.coreId)
    ).toEqual([1]);
    validateCoreResult(result);
  });

  it.each([
    {
      contact: "pyro" as const,
      reaction: "burgeon" as const,
      damageFrame: 32,
      durationFrames: 60
    },
    {
      contact: "electro" as const,
      reaction: "hyperbloom" as const,
      damageFrame: 91,
      durationFrames: 100
    }
  ])(
    "does not let $reaction damage recursively consume an overlapping active core",
    ({ contact, reaction, damageFrame, durationFrames }) => {
      const randomSeed = `non-recursive-${reaction}-seed`;
      const random = new SeededRandom(
        `${randomSeed}:dendro-core-position-v1`
      );
      const firstAngle = random.next() * Math.PI * 2;
      const secondAngle = random.next() * Math.PI * 2;
      const firstCorePosition = {
        x:
          Math.cos(firstAngle) *
          DENDRO_CORE_CONSTANTS.spawnRadiusOffset,
        y:
          Math.sin(firstAngle) *
          DENDRO_CORE_CONSTANTS.spawnRadiusOffset
      };
      const desiredSecondCorePosition = {
        x: firstCorePosition.x + 2.5,
        y: firstCorePosition.y
      };
      const secondTargetPosition = {
        x:
          desiredSecondCorePosition.x -
          Math.cos(secondAngle) *
            DENDRO_CORE_CONSTANTS.spawnRadiusOffset,
        y:
          desiredSecondCorePosition.y -
          Math.sin(secondAngle) *
            DENDRO_CORE_CONSTANTS.spawnRadiusOffset
      };
      const config = makeCoreScenario({
        coreCount: 2,
        durationFrames,
        contact,
        contactFrame: 31,
        contactGeometry: {
          kind: "circle",
          coordinateSpace: "world",
          origin: firstCorePosition,
          radius: 0.000001
        },
        randomSeed,
        targets: [
          {
            id: "enemy-0",
            name: "First core source",
            position: { x: 0, y: 0 },
            hitboxRadius: 0
          },
          {
            id: "enemy-1",
            name: "Second core source",
            position: secondTargetPosition,
            hitboxRadius: 0,
            initialAura: [
              { element: "dendro", gaugeUnits: 0.625 }
            ]
          }
        ]
      });
      const hydroAbility = config.timeline?.abilities.find(
        (ability) => ability.id === "hydro-core-generator"
      );
      if (hydroAbility?.hits === undefined) {
        throw new Error("Expected the Hydro core generator.");
      }
      hydroAbility.hits[1] = {
        ...hydroAbility.hits[1]!,
        targeting: {
          targetId: "enemy-1",
          outcome: "landed"
        }
      };

      const result = simulate(config, { critMode: "noCrit" });
      const spawns = result.dendroCoreLog.filter(
        (entry) => entry.operation === "spawn"
      );
      const firstSpawn = spawns[0];
      const secondSpawn = spawns[1];
      if (
        firstSpawn?.operation !== "spawn" ||
        secondSpawn?.operation !== "spawn"
      ) {
        throw new Error("Expected two active Dendro cores.");
      }
      expect(firstSpawn.position.x).toBeCloseTo(
        firstCorePosition.x,
        12
      );
      expect(firstSpawn.position.y).toBeCloseTo(
        firstCorePosition.y,
        12
      );
      expect(secondSpawn.position.x).toBeCloseTo(
        desiredSecondCorePosition.x,
        12
      );
      expect(secondSpawn.position.y).toBeCloseTo(
        desiredSecondCorePosition.y,
        12
      );

      const reactionLog = result.reactionDamageLog.find(
        (entry) =>
          entry.reaction === reaction &&
          entry.sourceCoreId === 0
      );
      expect(reactionLog).toMatchObject({
        reaction,
        damageFrame,
        applicationGaugeUnits: null
      });
      if (
        reactionLog === undefined ||
        reactionLog.centerPosition === null
      ) {
        throw new Error(
          `Expected ${reaction} to resolve an explicit damage center.`
        );
      }
      expect(
        Math.hypot(
          secondSpawn.position.x -
            reactionLog.centerPosition.x,
          secondSpawn.position.y -
            reactionLog.centerPosition.y
        )
      ).toBeLessThanOrEqual(
        reactionLog.radius + secondSpawn.hitboxRadius
      );
      expect(result.dendroCoreContactLog).toMatchObject([
        {
          eventType: "hit",
          checkedCoreIds: [0, 1],
          contactedCoreIds: [0]
        }
      ]);
      expect(
        result.dendroCoreContactLog.filter(
          (entry) => entry.eventType === "reactionDamage"
        )
      ).toEqual([]);
      expect(
        result.dendroCoreLog
          .filter((entry) => entry.operation === "consume")
          .map((entry) => entry.coreId)
      ).toEqual([0]);
      expect(
        result.dendroCoreTimeline.points
          .at(-1)
          ?.activeCores.map((core) => core.coreId)
      ).toEqual([1]);
      validateCoreResult(result);
    }
  );

  it("lets a raw Burning-tick application contact a core even when target Aura ICD blocks that application", () => {
    const result = simulate(
      makeCoreScenario({
        coreCount: 1,
        durationFrames: 60,
        initialDendroGaugeUnits: 2,
        contact: "pyro",
        contactFrame: 10
      }),
      { critMode: "noCrit" }
    );
    const blockedBurningApplication = result.damageEvents.find(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "burning" &&
        event.frame === 40 &&
        event.targetId === "enemy-0"
    );
    expect(
      blockedBurningApplication?.reactionAudit.icdAllowed
    ).toBe(false);
    if (blockedBurningApplication === undefined) {
      throw new Error("Expected the frame-40 Burning tick.");
    }
    expect(result.dendroCoreContactLog).toHaveLength(1);
    expect(result.dendroCoreContactLog[0]).toMatchObject({
      frame: 40,
      eventType: "reactionDamage",
      sourceActorId: "pyro",
      sourceActionId: expect.stringMatching(
        /^pyro-core-contact/
      ),
      triggerElement: "pyro",
      reaction: "burgeon",
      checkedCoreIds: [0],
      contactedCoreIds: [0],
      triggerDamageEventIds: [
        blockedBurningApplication.id
      ],
      blockedReason: null
    });
    expect(
      result.dendroCoreContactLog[0]!.eventPriority
    ).toBeGreaterThan(EVENT_PRIORITY.burningTick);
    const consume = result.dendroCoreLog.find(
      (entry) =>
        entry.operation === "consume" &&
        entry.reaction === "burgeon"
    );
    expect(consume).toMatchObject({
      eventType: "reactionDamage",
      frame: 40,
      damageFrame: 41,
      reason: "BURGEON_CONTACT"
    });
    expect(
      result.damageEvents.find(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.reaction === "burgeon"
      )
    ).toMatchObject({
      frame: 41,
      sourceActorId: "pyro"
    });
    validateCoreResult(result);
  });

  it("gives separate core-contact identities to distinct ticks in one Burning stream", () => {
    const config = makeCoreScenario({
      coreCount: 1,
      durationFrames: 75,
      initialDendroGaugeUnits: 2,
      contact: "pyro",
      contactFrame: 10,
      targets: [
        {
          id: "enemy-0",
          name: "Burning mover",
          position: { x: 0, y: 0 },
          hitboxRadius: 0
        },
        {
          id: "enemy-1",
          name: "Late core source",
          position: { x: 10, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            { element: "dendro", gaugeUnits: 0.625 }
          ]
        }
      ],
      targetMotions: [
        {
          id: "move-burning-stream",
          label: "Move Burning stream to the late core",
          targetId: "enemy-0",
          startFrame: 45,
          endFrame: 46,
          endPosition: { x: 10, y: 0 }
        }
      ]
    });
    const hydroAbility = config.timeline?.abilities.find(
      (ability) => ability.id === "hydro-core-generator"
    );
    if (hydroAbility === undefined) {
      throw new Error("Expected the Hydro core generator.");
    }
    if (hydroAbility.hits === undefined) {
      throw new Error(
        "Expected the Hydro core generator to define frame hits."
      );
    }
    hydroAbility.animationEndFrame = 16;
    hydroAbility.hits.push({
      ...applicationHit("hydro-late-core", 15, "hydro"),
      targeting: {
        targetId: "enemy-1",
        outcome: "landed"
      }
    });

    const result = simulate(config, { critMode: "noCrit" });
    const burningContacts = result.dendroCoreContactLog.filter(
      (entry) =>
        entry.eventType === "reactionDamage" &&
        entry.reaction === "burgeon"
    );
    expect(
      burningContacts.map((entry) => ({
        frame: entry.frame,
        contactedCoreIds: entry.contactedCoreIds
      }))
    ).toEqual([
      { frame: 40, contactedCoreIds: [0] },
      { frame: 55, contactedCoreIds: [1] }
    ]);
    expect(
      new Set(burningContacts.map((entry) => entry.hitGroupId)).size
    ).toBe(2);
    expect(
      burningContacts.every((entry) =>
        entry.hitGroupId.includes(
          ":reaction-damage-log-"
        )
      )
    ).toBe(true);
    validateCoreResult(result);
  });

  it.each([
    {
      auraElement: "pyro" as const,
      swirlReaction: "swirlPyro" as const,
      reaction: "burgeon" as const,
      damageFrame: 37
    },
    {
      auraElement: "electro" as const,
      swirlReaction: "swirlElectro" as const,
      reaction: "hyperbloom" as const,
      damageFrame: 96
    }
  ])(
    "lets $auraElement Swirl propagation contact a core as $reaction",
    ({
      auraElement,
      swirlReaction,
      reaction,
      damageFrame
    }) => {
      const config = makeCoreScenario({
        coreCount: 1,
        durationFrames: 120,
        targets: [
          {
            id: "enemy-0",
            name: "Core source",
            position: { x: 0, y: 0 }
          },
          {
            id: "swirl-source",
            name: "Swirl source",
            position: { x: 0, y: 0 },
            initialAura: [
              { element: auraElement, gaugeUnits: 1 }
            ]
          }
        ]
      });
      const anemoAbility: AbilityDefinition = {
        id: `${auraElement}-swirl-contact`,
        actorId: "anemo",
        name: `${auraElement} Swirl contact`,
        kind: "skill",
        cancelFrame: 1,
        animationEndFrame: 1,
        cooldownFrames: 0,
        hits: [
          {
            id: "anemo-hit",
            frame: 0,
            scaling: 0,
            element: "anemo",
            targeting: {
              targetId: "swirl-source",
              outcome: "landed"
            },
            application: {
              gaugeUnits: 1,
              icdTag: "anemo-hit",
              icdGroup: "no-icd"
            }
          }
        ]
      };
      config.characters.push({
        ...config.characters[0]!,
        id: "anemo",
        name: "Anemo",
        element: "anemo",
        color: "#66ddcc",
        stats: {
          ...neutralStats,
          baseAtk: 0,
          em: 200
        }
      });
      if (config.timeline === undefined) {
        throw new Error("Expected a legal timeline.");
      }
      config.timeline.abilities.push(anemoAbility);
      config.timeline.commands.push(
        {
          type: "swap",
          characterId: "anemo",
          atFrame: 30
        },
        {
          type: "skill",
          actorId: "anemo",
          abilityId: anemoAbility.id,
          atFrame: 31
        }
      );
      const result = simulate(config, { critMode: "noCrit" });
      const selfDamageLog = result.reactionDamageLog.find(
        (entry) =>
          entry.reaction === swirlReaction &&
          entry.scheduleKind === "swirl-self"
      );
      const propagationDamageLog =
        result.reactionDamageLog.find(
          (entry) =>
            entry.reaction === swirlReaction &&
            entry.scheduleKind === "swirl-propagation"
        );

      expect(result.dendroCoreContactLog).toHaveLength(1);
      expect(result.dendroCoreContactLog[0]).toMatchObject({
        frame: 36,
        eventType: "reactionDamage",
        eventPriority: EVENT_PRIORITY.reactionDamage,
        sourceActorId: "anemo",
        sourceActionId: expect.stringMatching(
          new RegExp(`^${anemoAbility.id}`)
        ),
        triggerElement: auraElement,
        reaction,
        checkedCoreIds: [0],
        contactedCoreIds: [0],
        blockedReason: null
      });
      expect(selfDamageLog).toMatchObject({
        scheduleKind: "swirl-self",
        applicationGaugeUnits: null
      });
      expect(propagationDamageLog).toMatchObject({
        scheduleKind: "swirl-propagation",
        applicationGaugeUnits: expect.any(Number)
      });
      expect(
        result.dendroCoreContactLog[0]!
          .triggerReactionDamageLogId
      ).toBe(propagationDamageLog?.id);
      expect(
        result.dendroCoreContactLog.some(
          (entry) =>
            entry.triggerReactionDamageLogId ===
            selfDamageLog?.id
        )
      ).toBe(false);
      expect(
        result.dendroCoreLog.find(
          (entry) => entry.operation === "consume"
        )
      ).toMatchObject({
        eventType: "reactionDamage",
        frame: 36,
        reaction,
        damageFrame
      });
      expect(
        result.reactionDamageLog.find(
          (entry) =>
            entry.sourceCoreId === 0 &&
            entry.reaction === reaction
        )
      ).toMatchObject({
        sourceActorId: "anemo",
        damageFrame
      });
      validateCoreResult(result);
    }
  );

  it("selects the nearest target at Hyperbloom impact and reads live trigger stats", () => {
    const result = simulate(
      makeCoreScenario({
        coreCount: 1,
        durationFrames: 120,
        contact: "electro",
        contactBuffEm: 300,
        targets: [
          {
            id: "enemy-0",
            name: "Moving source",
            position: { x: 0, y: 0 },
            hitboxRadius: 0
          },
          {
            id: "near",
            name: "Nearest at impact",
            position: { x: 4, y: 0 },
            hitboxRadius: 0
          }
        ],
        targetMotions: [
          {
            id: "move-source-away",
            label: "Move source away before Hyperbloom",
            targetId: "enemy-0",
            startFrame: 40,
            endFrame: 41,
            endPosition: { x: 30, y: 0 }
          }
        ]
      }),
      { critMode: "noCrit" }
    );

    const consume = result.dendroCoreLog.find(
      (entry) =>
        entry.operation === "consume" &&
        entry.reaction === "hyperbloom"
    );
    expect(consume).toMatchObject({
      frame: 31,
      damageFrame: 91,
      reason: "HYPERBLOOM_CONTACT"
    });
    if (consume?.operation !== "consume") {
      throw new Error("Expected one Hyperbloom core consume.");
    }
    const log =
      result.reactionDamageLog[consume.reactionDamageLogId]!;
    expect(log).toMatchObject({
      reaction: "hyperbloom",
      sourceActorId: "electro",
      targetingMode: "nearest-target-radius",
      sourceCoreId: 0,
      selectionRadius: 15,
      selectedTargetId: "near",
      resolutionReason: null,
      centerPosition: { x: 4, y: 0 },
      radius: 1,
      hitTargetIds: ["near"]
    });
    const event = result.damageEvents.find(
      (candidate) =>
        candidate.reaction === "hyperbloom" &&
        candidate.frame === 91
    );
    expect(event).toMatchObject({
      sourceActorId: "electro",
      targetId: "near",
      element: "dendro",
      em: 500
    });
    expect(event?.finalDamage).toBeCloseTo(
      expectedReactionDamage("electro", 3, 300),
      10
    );
    validateCoreResult(result);
  });

  it.each([
    {
      targetId: "hurtbox-boundary",
      targetDistance: 15.5,
      selected: true
    },
    {
      targetId: "outside-hurtbox",
      targetDistance: 15.500001,
      selected: false
    }
  ])(
    "uses target hurtbox overlap at the Hyperbloom 15-unit selection boundary ($targetId)",
    ({ targetId, targetDistance, selected }) => {
      const randomSeed = "bloom-integration-seed";
      const coreRoll = new SeededRandom(
        `${randomSeed}:dendro-core-position-v1`
      ).next();
      const coreAngle = coreRoll * Math.PI * 2;
      const corePosition = {
        x:
          Math.cos(coreAngle) *
          DENDRO_CORE_CONSTANTS.spawnRadiusOffset,
        y:
          Math.sin(coreAngle) *
          DENDRO_CORE_CONSTANTS.spawnRadiusOffset
      };
      const targetPosition = {
        x: corePosition.x + targetDistance,
        y: corePosition.y
      };
      const result = simulate(
        makeCoreScenario({
          coreCount: 1,
          durationFrames: 120,
          contact: "electro",
          randomSeed,
          targets: [
            {
              id: "enemy-0",
              name: "Moving source",
              position: { x: 0, y: 0 },
              hitboxRadius: 0
            },
            {
              id: targetId,
              name: "Selection boundary target",
              position: targetPosition,
              hitboxRadius: 0.5
            }
          ],
          targetMotions: [
            {
              id: "move-source-away",
              label: "Move source away before Hyperbloom",
              targetId: "enemy-0",
              startFrame: 40,
              endFrame: 41,
              endPosition: { x: 30, y: 0 }
            }
          ]
        })
      );
      const log = result.reactionDamageLog.find(
        (entry) => entry.reaction === "hyperbloom"
      );

      expect(log).toMatchObject(
        selected
          ? {
              selectedTargetId: targetId,
              resolutionReason: null,
              centerPosition: targetPosition,
              hitTargetIds: [targetId]
            }
          : {
              selectedTargetId: null,
              resolutionReason: "NO_TARGET_IN_RANGE",
              centerPosition: null,
              hitTargetIds: []
            }
      );
      validateCoreResult(result);
    }
  );

  it("consumes a Hyperbloom core without inventing damage when no target is in range", () => {
    const result = simulate(
      makeCoreScenario({
        coreCount: 1,
        durationFrames: 120,
        contact: "electro",
        targetMotions: [
          {
            id: "leave-selection-range",
            label: "Leave Hyperbloom range",
            targetId: "enemy-0",
            startFrame: 40,
            endFrame: 41,
            endPosition: { x: 30, y: 0 }
          }
        ]
      })
    );
    const consume = result.dendroCoreLog.find(
      (entry) =>
        entry.operation === "consume" &&
        entry.reaction === "hyperbloom"
    );
    if (consume?.operation !== "consume") {
      throw new Error("Expected one Hyperbloom core consume.");
    }
    const log =
      result.reactionDamageLog[consume.reactionDamageLogId]!;
    expect(log).toMatchObject({
      reaction: "hyperbloom",
      damageFrame: 91,
      scheduled: true,
      withinSimulation: true,
      targetingMode: "nearest-target-radius",
      selectedTargetId: null,
      resolutionReason: "NO_TARGET_IN_RANGE",
      centerPosition: null,
      checkedTargetIds: [],
      hitTargetIds: [],
      damageEventIds: [],
      damageGroupDecisions: []
    });
    expect(
      result.damageEvents.filter(
        (event) => event.reaction === "hyperbloom"
      )
    ).toEqual([]);
    expect(
      result.dendroCoreTimeline.points.at(-1)!.activeCores
    ).toEqual([]);
    validateCoreResult(result);
  });

  it("runs Electro-Charged → Quicken → Bloom through the simulator and preserves every scheduled consequence", () => {
    const base = makeConfig();
    const durationFrames = 610;
    const electroAbility: AbilityDefinition = {
      id: "electro-ec-quicken-bloom",
      actorId: "electro",
      name: "Electro EC Quicken Bloom",
      kind: "skill",
      cancelFrame: 1,
      animationEndFrame: 1,
      cooldownFrames: 0,
      hits: [
        {
          id: "electro-hit",
          label: "Electro hit",
          frame: 0,
          scaling: 0,
          element: "electro",
          geometry: {
            kind: "circle",
            coordinateSpace: "world",
            origin: { x: 0, y: 0 },
            radius: 1
          },
          application: {
            gaugeUnits: 0.8,
            icdTag: "electro-ec-quicken-bloom",
            icdGroup: "no-icd"
          }
        }
      ]
    };
    const config: SimConfig = {
      ...base,
      dataVersion: "dendro-core-provisional-integration-1",
      randomSeed: "electro-ec-quicken-bloom-seed",
      meta: {
        name: "EC Quicken Bloom integration",
        version: "1.31.0",
        verificationStatus: "provisional"
      },
      duration: durationFrames / 60,
      cycleLength: durationFrames / 60,
      enemy: {
        level: 90,
        resistance: 0.1,
        defReduction: 0,
        targets: [
          {
            id: "enemy-0",
            name: "EC Quicken Bloom target",
            position: { x: 0, y: 0 },
            hitboxRadius: 0,
            initialAura: [
              { element: "hydro", gaugeUnits: 1 },
              { element: "dendro", gaugeUnits: 1 }
            ]
          }
        ]
      },
      characters: [
        {
          ...actor(base.characters[0]!, "electro"),
          stats: {
            ...neutralStats,
            baseAtk: 0,
            em: OWNER_STATS.electro.em,
            reactionBonus:
              OWNER_STATS.electro.reactionBonus
          }
        }
      ],
      rotation: [],
      reactionEngine: { mode: "aura-v5" },
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "electro",
        swapFrames: 1,
        abilities: [electroAbility],
        commands: [
          {
            type: "skill",
            actorId: "electro",
            abilityId: electroAbility.id,
            atFrame: 0
          }
        ]
      }
    };

    const result = simulate(config, { critMode: "noCrit" });
    const trigger = result.damageEvents.find(
      (event) => event.kind === "direct"
    );
    expect(trigger?.reactionAudit.reactions).toEqual([
      "electroCharged",
      "quicken",
      "bloom"
    ]);
    expect(trigger?.reactionAudit.unsupportedReactions).toEqual(
      []
    );
    expect(trigger?.reactionAudit.mechanicsTruncation).toBeNull();
    expect(trigger?.reactionAudit.periodicReaction).toMatchObject(
      {
        reaction: "electroCharged",
        operation: "start",
        firstDamageFrame: 10,
        nextTickFrame: 70
      }
    );
    expect(
      result.damageEvents
        .filter(
          (event) =>
            event.kind === "transformative-reaction" &&
            event.reaction === "electroCharged"
        )
        .map((event) => ({
          frame: event.frame,
          sourceActorId: event.sourceActorId,
          parentDamageEventId: event.parentDamageEventId
        }))
    ).toEqual([
      {
        frame: 10,
        sourceActorId: "electro",
        parentDamageEventId: trigger?.id
      }
    ]);
    expect(
      result.reactionDamageLog.find(
        (entry) =>
          entry.reaction === "electroCharged" &&
          entry.damageFrame === 10
      )
    ).toMatchObject({
      sourceActorId: "electro",
      withinSimulation: true
    });

    const scheduledCore = result.dendroCoreLog.find(
      (entry) => entry.operation === "spawn-scheduled"
    );
    const spawnedCore = result.dendroCoreLog.find(
      (entry) => entry.operation === "spawn"
    );
    expect(scheduledCore).toMatchObject({
      frame: 0,
      sourceActorId: "electro",
      spawnFrame: 30,
      bloomReactionIndex: 0
    });
    expect(spawnedCore).toMatchObject({
      frame: 30,
      sourceActorId: "electro",
      spawnedAtFrame: 30,
      expiresAtFrame: 330
    });
    expect(
      result.quickenStateLog.map((entry) => ({
        operation: entry.operation,
        frame: entry.frame,
        generation: entry.generation,
        expiresAtFrame: entry.expiresAtFrame
      }))
    ).toEqual([
      {
        operation: "start",
        frame: 0,
        generation: 1,
        expiresAtFrame: 600
      },
      {
        operation: "partial-consume",
        frame: 0,
        generation: 2,
        expiresAtFrame: 300
      },
      {
        operation: "expire",
        frame: 300,
        generation: 2,
        expiresAtFrame: null
      }
    ]);
    const [quickenStart, bloomPartialConsume] =
      result.quickenStateLog;
    for (const [index, entry] of result.quickenStateLog.entries()) {
      const parsed = quickenStateLogEntrySchema.safeParse(entry);
      expect(
        parsed.success,
        `quickenStateLog[${index}] ${entry.operation}: ${
          parsed.success
            ? ""
            : JSON.stringify(parsed.error.issues)
        }`
      ).toBe(true);
      if (parsed.success) {
        expect(parsed.data).toEqual(entry);
      }
    }
    expect(quickenStart?.auraAfter).toEqual(
      bloomPartialConsume?.auraBefore
    );
    expect(
      stateGauge(
        bloomPartialConsume?.auraAfter ?? [],
        "quicken"
      )
    ).toBe(0.4);
    validateCoreResult(result);
  });

  it("records and reschedules a Quicken lifetime shortened by same-frame follow-up Bloom", () => {
    const base = makeConfig();
    const ability: AbilityDefinition = {
      id: "dendro-quicken-bloom",
      actorId: "dendro",
      name: "Dendro Quicken then Bloom",
      kind: "skill",
      cancelFrame: 1,
      animationEndFrame: 1,
      cooldownFrames: 0,
      hits: [
        {
          id: "dendro-hit",
          label: "Dendro hit",
          frame: 0,
          scaling: 0,
          element: "dendro",
          application: {
            gaugeUnits: 0.8,
            icdTag: "dendro-hit",
            icdGroup: "no-icd"
          }
        }
      ]
    };
    const durationFrames = 610;
    const config: SimConfig = {
      ...base,
      dataVersion: "dendro-core-provisional-integration-1",
      randomSeed: "quicken-bloom-lifecycle-seed",
      meta: {
        name: "Quicken Bloom lifecycle integration",
        version: "1.31.0",
        verificationStatus: "provisional"
      },
      duration: durationFrames / 60,
      cycleLength: durationFrames / 60,
      enemy: {
        level: 90,
        resistance: 0.1,
        defReduction: 0,
        targets: [
          {
            id: "enemy-0",
            name: "Quicken Bloom target",
            position: { x: 0, y: 0 },
            hitboxRadius: 0,
            initialAura: [
              { element: "hydro", gaugeUnits: 1 },
              { element: "electro", gaugeUnits: 1 }
            ]
          }
        ]
      },
      characters: [
        {
          ...base.characters[0]!,
          id: "dendro",
          name: "Dendro",
          element: "dendro",
          color: "#77aa33",
          level: 90,
          stats: {
            ...neutralStats,
            baseAtk: 0
          }
        }
      ],
      rotation: [],
      reactionEngine: { mode: "aura-v5" },
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "dendro",
        swapFrames: 1,
        abilities: [ability],
        commands: [
          {
            type: "skill",
            actorId: "dendro",
            abilityId: ability.id,
            atFrame: 0
          }
        ]
      }
    };

    const result = simulate(config, { critMode: "noCrit" });
    expect(
      result.damageEvents[0]?.reactionAudit.bloomReactions.find(
        (entry) => entry.operation === "quicken-followup"
      )?.quickenStateMutation
    ).toMatchObject({
      operation: "partial-consume",
      generationBefore: 1,
      generationAfter: 2,
      expiresAtFrameBefore: 600,
      expiresAtFrameAfter: 300
    });
    expect(
      result.quickenStateLog.map((entry) => ({
        operation: entry.operation,
        frame: entry.frame,
        generation: entry.generation,
        before: entry.quickenGaugeUnitsBefore,
        after: entry.quickenGaugeUnitsAfter,
        expiresAtFrame: entry.expiresAtFrame,
        reason: entry.reason
      }))
    ).toEqual([
      {
        operation: "start",
        frame: 0,
        generation: 1,
        before: 0,
        after: 0.8,
        expiresAtFrame: 600,
        reason: "QUICKEN_STARTED"
      },
      {
        operation: "partial-consume",
        frame: 0,
        generation: 2,
        before: 0.8,
        after: 0.4,
        expiresAtFrame: 300,
        reason: "BLOOM_PARTIALLY_CONSUMED_QUICKEN"
      },
      {
        operation: "expire",
        frame: 300,
        generation: 2,
        before: expect.closeTo(1 / 750, 12),
        after: 0,
        expiresAtFrame: null,
        reason: "QUICKEN_DECAY_EXPIRED"
      }
    ]);
    const [quickenStart, bloomPartialConsume] =
      result.quickenStateLog;
    const quickenAudit =
      result.damageEvents[0]?.reactionAudit.catalyzeReaction
        ?.quicken;
    const bloomMutation =
      result.damageEvents[0]?.reactionAudit.bloomReactions.find(
        (entry) => entry.operation === "quicken-followup"
      )?.quickenStateMutation;
    expect(quickenStart?.auraBefore).toEqual(
      quickenAudit?.operationAuraBefore
    );
    expect(quickenStart?.auraAfter).toEqual(
      quickenAudit?.operationAuraAfter
    );
    expect(bloomPartialConsume?.auraBefore).toEqual(
      bloomMutation?.operationAuraBefore
    );
    expect(bloomPartialConsume?.auraAfter).toEqual(
      bloomMutation?.operationAuraAfter
    );
    expect(quickenStart?.auraAfter).toEqual(
      bloomPartialConsume?.auraBefore
    );
    expect(
      stateGauge(quickenStart?.auraBefore ?? [], "hydro")
    ).toBe(0.8);
    expect(
      stateGauge(quickenStart?.auraBefore ?? [], "electro")
    ).toBe(0);
    expect(
      stateGauge(quickenStart?.auraBefore ?? [], "quicken")
    ).toBe(0);
    expect(
      stateGauge(quickenStart?.auraAfter ?? [], "quicken")
    ).toBe(0.8);
    expect(
      stateGauge(
        bloomPartialConsume?.auraAfter ?? [],
        "quicken"
      )
    ).toBe(0.4);
    expect(
      stateGauge(
        bloomPartialConsume?.auraAfter ?? [],
        "hydro"
      )
    ).toBe(0.8);
    expect(
      result.targetStateTimeline.points
        .filter((point) => point.cause === "quicken-expiry")
        .map((point) => ({
          frame: point.frame,
          pointKind: point.pointKind,
          links: point.links
        }))
    ).toEqual([
      {
        frame: 300,
        pointKind: "mutation",
        links: [{ kind: "quicken-state-log", id: 2 }]
      },
      {
        frame: 600,
        pointKind: "observation",
        links: []
      }
    ]);
    expect(
      result.quickenStateLog.filter(
        (entry) =>
          entry.operation === "expire" && entry.frame === 600
      )
    ).toEqual([]);
    validateCoreResult(result);

    const removalResult = simulate(
      {
        ...config,
        randomSeed: "quicken-bloom-removal-seed",
        enemy: {
          ...config.enemy,
          targets: [
            {
              id: "enemy-0",
              name: "Quicken removal target",
              position: { x: 0, y: 0 },
              hitboxRadius: 0,
              initialAura: [
                { element: "hydro", gaugeUnits: 2 },
                { element: "electro", gaugeUnits: 1 }
              ]
            }
          ]
        }
      },
      { critMode: "noCrit" }
    );
    expect(
      removalResult.damageEvents[0]?.reactionAudit.bloomReactions.find(
        (entry) => entry.operation === "quicken-followup"
      )?.quickenStateMutation
    ).toMatchObject({
      operation: "remove",
      generationBefore: 1,
      generationAfter: 2,
      expiresAtFrameBefore: 600,
      expiresAtFrameAfter: null
    });
    expect(
      removalResult.quickenStateLog.map((entry) => ({
        operation: entry.operation,
        frame: entry.frame,
        generation: entry.generation,
        before: entry.quickenGaugeUnitsBefore,
        after: entry.quickenGaugeUnitsAfter,
        expiresAtFrame: entry.expiresAtFrame,
        reason: entry.reason
      }))
    ).toEqual([
      {
        operation: "start",
        frame: 0,
        generation: 1,
        before: 0,
        after: 0.8,
        expiresAtFrame: 600,
        reason: "QUICKEN_STARTED"
      },
      {
        operation: "remove",
        frame: 0,
        generation: 2,
        before: 0.8,
        after: 0,
        expiresAtFrame: null,
        reason: "BLOOM_REMOVED_QUICKEN"
      }
    ]);
    const [removalStart, bloomRemoval] =
      removalResult.quickenStateLog;
    const removalQuickenAudit =
      removalResult.damageEvents[0]?.reactionAudit
        .catalyzeReaction?.quicken;
    const removalMutation =
      removalResult.damageEvents[0]?.reactionAudit.bloomReactions.find(
        (entry) => entry.operation === "quicken-followup"
      )?.quickenStateMutation;
    expect(removalStart?.auraAfter).toEqual(
      bloomRemoval?.auraBefore
    );
    expect(removalStart?.auraBefore).toEqual(
      removalQuickenAudit?.operationAuraBefore
    );
    expect(removalStart?.auraAfter).toEqual(
      removalQuickenAudit?.operationAuraAfter
    );
    expect(bloomRemoval?.auraBefore).toEqual(
      removalMutation?.operationAuraBefore
    );
    expect(bloomRemoval?.auraAfter).toEqual(
      removalMutation?.operationAuraAfter
    );
    expect(
      stateGauge(bloomRemoval?.auraAfter ?? [], "quicken")
    ).toBe(0);
    expect(
      stateGauge(bloomRemoval?.auraAfter ?? [], "hydro")
    ).toBe(1.6);
    expect(
      removalResult.targetStateTimeline.points
        .filter((point) => point.cause === "quicken-expiry")
        .map((point) => ({
          frame: point.frame,
          pointKind: point.pointKind,
          links: point.links
        }))
    ).toEqual([
      {
        frame: 600,
        pointKind: "observation",
        links: []
      }
    ]);
    validateCoreResult(removalResult);
  });

  it("keeps aura-v4 Bloom fail-closed and emits no Dendro-core entities", () => {
    const v5 = makeCoreScenario({
      coreCount: 1,
      durationFrames: 60
    });
    const result = simulate({
      ...v5,
      reactionEngine: { mode: "aura-v4" }
    });

    expect(result.targetMechanicsTruncationLog).toHaveLength(1);
    expect(result.targetMechanicsTruncationLog[0]).toMatchObject({
      frame: 0,
      unsupportedReactions: ["bloom"],
      reason: "UNSUPPORTED_DENDRO_REACTION"
    });
    expect(result.dendroCoreLog).toEqual([]);
    expect(result.dendroCoreContactLog).toEqual([]);
    expect(result.dendroCoreTimeline).toEqual({
      version: "1.0.0",
      points: []
    });
    expect(
      result.damageEvents.some((event) =>
        ["bloom", "burgeon", "hyperbloom"].includes(
          event.reaction
        )
      )
    ).toBe(false);
  });
});
