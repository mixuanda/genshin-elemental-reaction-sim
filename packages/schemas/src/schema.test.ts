import { describe, expect, it } from "vitest";
import {
  bloomReactionAuditSchema,
  BURNING_REACTION_ENGINE_VERSION,
  BURNING_REACTION_SCHEMA_VERSION,
  burningReactionAuditSchema,
  burningStateLogEntrySchema,
  ConfigMigrationError,
  createSimulationConfigHash,
  createSimulationRunManifest,
  createVersionedContentHash,
  crystallizeShieldLogEntrySchema,
  crystallizeShieldTimelinePointSchema,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  DENDRO_CORE_ENGINE_VERSION,
  DENDRO_CORE_SCHEMA_VERSION,
  dendroCoreContactLogEntrySchema,
  dendroCoreContactLogSchema,
  dendroCoreLogEntrySchema,
  dendroCoreLogSchema,
  dendroCoreResultReferencesSchema,
  dendroCoreTimelinePointSchema,
  dendroCoreTimelineSchema,
  migrateConfig,
  parseSimulationRunManifestForConfig,
  PLAYER_REACTION_DAMAGE_ENGINE_VERSION,
  PLAYER_REACTION_DAMAGE_SCHEMA_VERSION,
  playerDamageEventSchema,
  playerDamageModelSchema,
  playerDamageResultReferencesSchema,
  playerCrystallizeShieldResolutionSchema,
  playerHitResolutionLogEntrySchema,
  playerHpTimelineSchema,
  playerReactionSelfDamageFactorsSchema,
  quickenDecayMutationAuditSchema,
  quickenReactionAuditSchema,
  quickenStateLogEntrySchema,
  reactionADamageGroupAuditSchema,
  reactionBDamageGroupAuditSchema,
  reactionDamageGroupAuditSchema,
  resolvedWorldHitGeometrySchema,
  simulationRunManifestSchema,
  targetClockAuditSchema,
  targetClockLogSchema,
  targetClockResultReferencesSchema,
  targetHitlagDefinitionSchema,
  targetHitlagLogEntrySchema,
  targetHitlagLogSchema,
  targetStateTimelinePointSchema,
  targetStateTimelineSchema,
  type TargetClockLogEntry,
  type TargetHitlagLogEntry,
  type TargetStateTimeline
} from "./index";

const legacyConfig = {
  meta: { name: "旧配置", version: "0.1.0-demo", note: "legacy" },
  duration: 120,
  cycleLength: 20,
  enemy: { level: 110, resistance: 0.1, defReduction: 0 },
  characters: [
    {
      id: "a",
      name: "A",
      element: "pyro",
      color: "#f00",
      level: 90,
      energyMax: 60,
      initialEnergy: 0,
      stats: {}
    }
  ],
  rotation: []
};

const validTargetStateTimeline = {
  version: "1.0.0",
  points: [
    {
      id: 0,
      frame: 0,
      timeSeconds: 0,
      targetId: "enemy-0",
      targetName: "Target",
      pointKind: "boundary",
      cause: "simulation-start",
      eventType: null,
      eventPriority: null,
      eventSequence: null,
      intraEventSequence: null,
      reaction: "none",
      reactions: [],
      primaryDamageEventId: null,
      links: [],
      auraBefore: [
        {
          element: "pyro",
          gaugeUnits: 0.8,
          expiresAtFrame: 560
        }
      ],
      auraApplied: [],
      auraConsumed: [],
      auraAfter: [
        {
          element: "pyro",
          gaugeUnits: 0.8,
          expiresAtFrame: 560
        }
      ]
    },
    {
      id: 1,
      frame: 30,
      timeSeconds: 0.5,
      targetId: "enemy-0",
      targetName: "Target",
      pointKind: "mutation",
      cause: "direct-hit-application",
      eventType: "hit",
      eventPriority: 3.25,
      eventSequence: 12,
      intraEventSequence: 0,
      reaction: "vaporize",
      reactions: ["vaporize"],
      primaryDamageEventId: 4,
      links: [{ kind: "damage-event", id: 4 }],
      auraBefore: [
        {
          element: "pyro",
          gaugeUnits: 0.8,
          expiresAtFrame: 560
        }
      ],
      auraApplied: [{ element: "hydro", gaugeUnits: 1 }],
      auraConsumed: [{ element: "pyro", gaugeUnits: 0.4 }],
      auraAfter: [
        {
          element: "pyro",
          gaugeUnits: 0.4,
          expiresAtFrame: 570
        }
      ]
    },
    {
      id: 2,
      frame: 570,
      timeSeconds: 9.5,
      targetId: "enemy-0",
      targetName: "Target",
      pointKind: "derived",
      cause: "aura-natural-expiry",
      eventType: null,
      eventPriority: null,
      eventSequence: null,
      intraEventSequence: null,
      reaction: "none",
      reactions: [],
      primaryDamageEventId: null,
      links: [],
      auraBefore: [
        {
          element: "pyro",
          gaugeUnits: 0.4,
          expiresAtFrame: 570
        }
      ],
      auraApplied: [],
      auraConsumed: [],
      auraAfter: []
    },
    {
      id: 3,
      frame: 600,
      timeSeconds: 10,
      targetId: "enemy-0",
      targetName: "Target",
      pointKind: "boundary",
      cause: "simulation-end",
      eventType: null,
      eventPriority: null,
      eventSequence: null,
      intraEventSequence: null,
      reaction: "none",
      reactions: [],
      primaryDamageEventId: null,
      links: [],
      auraBefore: [],
      auraApplied: [],
      auraConsumed: [],
      auraAfter: []
    }
  ]
} satisfies TargetStateTimeline;

describe("target state timeline result contract", () => {
  it("accepts strict boundaries, fractional event priorities, and typed links", () => {
    expect(targetStateTimelineSchema.parse(validTargetStateTimeline)).toEqual(
      validTargetStateTimeline
    );
  });

  it("requires a complete event tuple for event points and none for boundaries", () => {
    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[0],
        eventType: "hit",
        eventPriority: 3,
        eventSequence: 1,
        intraEventSequence: 0
      })
    ).toThrow(/boundary points must not carry an event ordering tuple/);

    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[1],
        eventSequence: null
      })
    ).toThrow(
      /event points require eventType, priority, sequence, and intra-event sequence/
    );

    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[0],
        auraBefore: [],
        auraApplied: [{ element: "pyro", gaugeUnits: 1 }]
      })
    ).toThrow(
      /boundary points must preserve an exact Aura snapshot|cannot claim an application/
    );
  });

  it("binds event point kinds to actual Aura changes and keeps reaction arrays coherent", () => {
    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[1],
        pointKind: "observation"
      })
    ).toThrow(/observation points cannot apply, consume, or change Aura/);

    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[1],
        pointKind: "mutation",
        reaction: "none",
        reactions: [],
        auraApplied: [],
        auraConsumed: [],
        auraAfter: validTargetStateTimeline.points[1]!.auraBefore
      })
    ).toThrow(/mutation points must apply, consume, or change Aura/);

    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[1],
        reactions: []
      })
    ).toThrow(/reaction must equal the last amplifying reaction/);

    expect(
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[1],
        reaction: "melt",
        reactions: ["vaporize", "melt"]
      })
    ).toMatchObject({
      reaction: "melt",
      reactions: ["vaporize", "melt"]
    });

    expect(
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[1],
        reaction: "reverseMelt",
        reactions: [
          "superconduct",
          "reverseMelt",
          "freeze"
        ]
      })
    ).toMatchObject({
      reaction: "reverseMelt",
      reactions: [
        "superconduct",
        "reverseMelt",
        "freeze"
      ]
    });

    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[1],
        reaction: "overload",
        reactions: [
          "overload",
          "reverseVaporize",
          "burning"
        ]
      })
    ).toThrow(/reaction must equal the last amplifying reaction/);

    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[1],
        reaction: "none",
        reactions: ["none"]
      })
    ).toThrow(/ordered reactions list cannot contain the none sentinel/);
  });

  it("accepts only link-free, reaction-free natural Aura expiry derivations", () => {
    expect(
      targetStateTimelinePointSchema.parse(validTargetStateTimeline.points[2])
    ).toEqual(validTargetStateTimeline.points[2]);

    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[2],
        eventType: "hit",
        eventPriority: 3,
        eventSequence: 1,
        intraEventSequence: 0
      })
    ).toThrow(/derived points must not carry an event ordering tuple/);

    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[2],
        auraAfter: validTargetStateTimeline.points[2]!.auraBefore
      })
    ).toThrow(/must change the target Aura state/);

    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[2],
        reaction: "burning",
        reactions: ["burning"],
        primaryDamageEventId: 4,
        links: [{ kind: "damage-event", id: 4 }]
      })
    ).toThrow(/cannot carry damage or log links|cannot claim a reaction/);

    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[2],
        auraAfter: [
          {
            element: "hydro",
            gaugeUnits: 0.8,
            expiresAtFrame: 900
          }
        ]
      })
    ).toThrow(/may only decrease existing Aura/);

    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[2],
        auraAfter: [
          {
            element: "pyro",
            gaugeUnits: 0.3,
            expiresAtFrame: 900
          }
        ]
      })
    ).toThrow(/cannot extend pyro expiry/);

    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[2],
        frame: 569,
        timeSeconds: 569 / 60
      })
    ).toThrow(/requires an Aura deadline at or before its frame/);
  });

  it("binds granular causes to the producing simulator event type", () => {
    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[1],
        cause: "frozen-expiry"
      })
    ).toThrow(/frozen-expiry requires eventType=frozenExpiry/);
  });

  it("validates output wire names without normalizing their bytes", () => {
    const parsed = targetStateTimelinePointSchema.parse({
      ...validTargetStateTimeline.points[1],
      targetName: " Target ",
      auraBefore: [
        {
          ...validTargetStateTimeline.points[1]!.auraBefore[0]!,
          sourceSlots: [
            { sourceActorId: " aura owner ", gaugeUnits: 0.8 }
          ]
        }
      ],
      auraApplied: [
        {
          element: "hydro",
          gaugeUnits: 1,
          sourceActorId: " attack owner ",
          sourceMutations: [
            {
              sourceActorId: " aura owner ",
              gaugeUnitsBefore: 0.8,
              consumedGaugeUnits: 0.4,
              gaugeUnitsAfter: 0.4
            }
          ]
        }
      ]
    });
    expect(parsed.targetName).toBe(" Target ");
    expect(parsed.auraBefore[0]?.sourceSlots?.[0]?.sourceActorId).toBe(
      " aura owner "
    );
    expect(parsed.auraApplied[0]?.sourceActorId).toBe(
      " attack owner "
    );
    expect(
      parsed.auraApplied[0]?.sourceMutations?.[0]?.sourceActorId
    ).toBe(" aura owner ");
    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[1],
        targetName: "   "
      })
    ).toThrow(/must not be blank/);
  });

  it("requires zero-based contiguous point ids", () => {
    expect(() =>
      targetStateTimelineSchema.parse({
        ...validTargetStateTimeline,
        points: validTargetStateTimeline.points.map((point, index) =>
          index === 1 ? { ...point, id: 7 } : point
        )
      })
    ).toThrow(/expected 1/);
  });

  it("requires chronological frames and scheduler order within each frame", () => {
    expect(() =>
      targetStateTimelineSchema.parse({
        version: "1.0.0",
        points: [
          { ...validTargetStateTimeline.points[1], id: 0, frame: 31 },
          { ...validTargetStateTimeline.points[1], id: 1, frame: 30 }
        ]
      })
    ).toThrow(/timeline frames must be nondecreasing/);

    expect(() =>
      targetStateTimelineSchema.parse({
        version: "1.0.0",
        points: [
          {
            ...validTargetStateTimeline.points[1],
            id: 0,
            frame: 30,
            eventPriority: 4,
            eventSequence: 12,
            intraEventSequence: 0
          },
          {
            ...validTargetStateTimeline.points[1],
            id: 1,
            frame: 30,
            eventPriority: 3,
            eventSequence: 12,
            intraEventSequence: 1
          }
        ]
      })
    ).toThrow(/must be ordered by priority, sequence, and intra-event sequence/);

    expect(() =>
      targetStateTimelineSchema.parse({
        version: "1.0.0",
        points: [
          { ...validTargetStateTimeline.points[0], id: 0 },
          { ...validTargetStateTimeline.points[1], id: 1 },
          {
            ...validTargetStateTimeline.points[1],
            id: 2,
            pointKind: "observation",
            reaction: "none",
            reactions: [],
            auraBefore: validTargetStateTimeline.points[1]!.auraAfter,
            auraApplied: [],
            auraConsumed: [],
            auraAfter: validTargetStateTimeline.points[1]!.auraAfter
          },
          { ...validTargetStateTimeline.points[3], id: 3 }
        ]
      })
    ).toThrow(/must be ordered by priority, sequence, and intra-event sequence/);
  });

  it("requires one stable start/end boundary and continuous Aura state per target", () => {
    expect(() =>
      targetStateTimelineSchema.parse({
        version: "1.0.0",
        points: []
      })
    ).toThrow();

    expect(() =>
      targetStateTimelineSchema.parse({
        ...validTargetStateTimeline,
        points: validTargetStateTimeline.points.slice(0, -1)
      })
    ).toThrow(/exactly one simulation-end boundary/);

    expect(() =>
      targetStateTimelineSchema.parse({
        ...validTargetStateTimeline,
        points: validTargetStateTimeline.points.map((point, index) =>
          index === 1
            ? { ...point, targetName: "Renamed Target" }
            : point
        )
      })
    ).toThrow(/targetName must remain stable/);

    expect(() =>
      targetStateTimelineSchema.parse({
        ...validTargetStateTimeline,
        points: validTargetStateTimeline.points.map((point, index) =>
          index === 1
            ? {
                ...point,
                auraBefore: [
                  {
                    element: "pyro",
                    gaugeUnits: 0.9,
                    expiresAtFrame: 560
                  }
                ]
              }
            : point
        )
      })
    ).toThrow(/target Aura timeline is discontinuous/);

    expect(() =>
      targetStateTimelineSchema.parse({
        version: "1.0.0",
        points: [
          { ...validTargetStateTimeline.points[0], id: 0 },
          { ...validTargetStateTimeline.points[3], id: 1 },
          {
            ...validTargetStateTimeline.points[1],
            id: 2,
            frame: 601,
            timeSeconds: 601 / 60
          }
        ]
      })
    ).toThrow(/cannot emit points after simulation-end/);
  });

  it("treats a target-local Aura deadline as authoritative across Hitlag reprojection", () => {
    const startAura = [
      {
        element: "pyro" as const,
        gaugeUnits: 1,
        expiresAtFrame: 600,
        expiresAtTargetFrame: 500
      }
    ];
    const reprojectedAura = [
      {
        ...startAura[0]!,
        expiresAtFrame: 605
      }
    ];
    expect(
      targetStateTimelineSchema.parse({
        version: "1.0.0",
        points: [
          {
            ...validTargetStateTimeline.points[0],
            id: 0,
            frame: 0,
            targetFrame: 0,
            timeSeconds: 0,
            auraBefore: startAura,
            auraAfter: startAura
          },
          {
            ...validTargetStateTimeline.points[3],
            id: 1,
            frame: 5,
            targetFrame: 0,
            timeSeconds: 5 / 60,
            auraBefore: reprojectedAura,
            auraAfter: reprojectedAura
          }
        ]
      }).points
    ).toHaveLength(2);
  });

  it("requires primary damage ids to have an exact typed link", () => {
    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[1],
        links: [{ kind: "reaction-damage-log", id: 4 }]
      })
    ).toThrow(/primaryDamageEventId requires a matching damage-event link/);
  });

  it("rejects duplicate links, unknown fields, and non-finite values", () => {
    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[1],
        links: [
          { kind: "damage-event", id: 4 },
          { kind: "damage-event", id: 4 }
        ]
      })
    ).toThrow(/duplicate timeline link/);

    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[1],
        unexpected: true
      })
    ).toThrow(/Unrecognized key/);

    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[1],
        links: [{ kind: "damage-event", id: 4, unexpected: true }]
      })
    ).toThrow(/Unrecognized key/);

    expect(() =>
      targetStateTimelineSchema.parse({
        ...validTargetStateTimeline,
        unexpected: true
      })
    ).toThrow(/Unrecognized key/);

    expect(() =>
      targetStateTimelinePointSchema.parse({
        ...validTargetStateTimeline.points[1],
        eventPriority: Number.POSITIVE_INFINITY
      })
    ).toThrow();
  });
});

describe("1.32 player reaction self-damage contract", () => {
  const resistances = {
    pyro: 0.1,
    cryo: 0.1,
    hydro: 0.1,
    electro: 0.1,
    anemo: 0.1,
    geo: 0.1,
    dendro: 0.1,
    physical: 0.1
  };

  const makeEnabledConfig = () => {
    const current = migrateConfig(legacyConfig);
    return migrateConfig({
      ...current,
      duration: 1,
      enemy: {
        ...current.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "Player damage target",
            position: { x: 0, y: 0 }
          }
        ]
      },
      characters: current.characters.map((character) => ({
        ...character,
        stats: {
          ...character.stats,
          baseHp: 1_000,
          hpPct: 0,
          flatHp: 0
        }
      })),
      playerDamageModel: {
        mode: "reaction-self-v1",
        position: { x: 0, y: 0 },
        hitboxRadius: 0.5,
        shieldMode: "crystallize-v1",
        zeroHpPolicy: "clamp-and-continue",
        characters: [
          {
            actorId: "a",
            initialHpRatio: 1,
            resistances
          }
        ]
      }
    });
  };

  it("freezes the 1.31 historical pair and migrates it to explicit disabled mode", () => {
    const current = migrateConfig(legacyConfig);
    const historical = {
      ...current,
      schemaVersion: DENDRO_CORE_SCHEMA_VERSION,
      engineVersion: DENDRO_CORE_ENGINE_VERSION
    };
    expect(migrateConfig(historical).playerDamageModel).toEqual({
      mode: "disabled"
    });
    expect(migrateConfig(historical).targetClockModel).toEqual({
      mode: "disabled"
    });
    expect(() =>
      migrateConfig({
        ...historical,
        engineVersion: "1.31.0-forged"
      })
    ).toThrow(/requires "1\.31\.0-dendro-cores"/);
    expect(() =>
      migrateConfig({
        ...historical,
        playerDamageModel: {
          mode: "reaction-self-v1"
        }
      })
    ).toThrow(/does not support player reaction self-damage/);

    const missingModel = { ...current } as Record<string, unknown>;
    delete missingModel.playerDamageModel;
    expect(() => migrateConfig(missingModel)).toThrow(
      /playerDamageModel/
    );
  });

  it("preserves the exact 1.32 player model while injecting the disabled 1.33 target clock", () => {
    const current = makeEnabledConfig();
    const {
      targetClockModel: _targetClockModel,
      ...wire132
    } = current;
    const historical = {
      ...wire132,
      schemaVersion: PLAYER_REACTION_DAMAGE_SCHEMA_VERSION,
      engineVersion: PLAYER_REACTION_DAMAGE_ENGINE_VERSION
    };
    const migrated = migrateConfig(historical);
    expect(migrated.playerDamageModel).toEqual(
      current.playerDamageModel
    );
    expect(migrated.targetClockModel).toEqual({
      mode: "disabled"
    });
    expect(() =>
      migrateConfig({
        ...historical,
        engineVersion: "1.32.0-forged"
      })
    ).toThrow(
      /requires "1\.32\.0-player-reaction-damage"/
    );
    expect(() =>
      migrateConfig({
        ...historical,
        targetClockModel: {
          mode: "target-local-hitlag-v1"
        }
      })
    ).toThrow(/does not support target-local Hitlag/);
  });

  it("requires one complete player state per character and positive base/max HP", () => {
    const enabled = makeEnabledConfig();
    expect(enabled.playerDamageModel.mode).toBe(
      "reaction-self-v1"
    );
    expect(() =>
      playerDamageModelSchema.parse({
        ...enabled.playerDamageModel,
        extra: true
      })
    ).toThrow(/Unrecognized key/);

    const model = enabled.playerDamageModel;
    if (model.mode !== "reaction-self-v1") {
      throw new Error("expected enabled player model");
    }
    expect(() =>
      migrateConfig({
        ...enabled,
        playerDamageModel: {
          ...model,
          characters: [
            model.characters[0],
            model.characters[0]
          ]
        }
      })
    ).toThrow(/duplicate player damage state/);
    expect(() =>
      migrateConfig({
        ...enabled,
        playerDamageModel: {
          ...model,
          characters: [
            {
              ...model.characters[0],
              actorId: "unknown"
            }
          ]
        }
      })
    ).toThrow(/unknown character id|missing player damage state/);
    expect(() =>
      migrateConfig({
        ...enabled,
        characters: enabled.characters.map((character) => ({
          ...character,
          stats: { ...character.stats, baseHp: 0 }
        }))
      })
    ).toThrow(/requires baseHp > 0/);
    expect(() =>
      playerDamageModelSchema.parse({
        ...model,
        characters: [
          {
            actorId: "a",
            initialHpRatio: 1,
            resistances: {
              ...resistances,
              physical: undefined
            }
          }
        ]
      })
    ).toThrow(/physical/);
    expect(() =>
      migrateConfig({
        ...enabled,
        enemy: {
          ...enabled.enemy,
          targets: enabled.enemy.targets?.map((target) => {
            const { position: _position, ...withoutPosition } = target;
            return withoutPosition;
          })
        }
      })
    ).toThrow(/target position/);
  });

  it("allows deterministic same-frame HP boundaries for multiple party members", () => {
    const boundary = (
      id: number,
      frame: number,
      operation: "initial" | "simulation-end",
      actorId: string
    ) => ({
      id,
      frame,
      timeSeconds: frame / 60,
      eventPriority: null,
      eventSequence: null,
      intraEventSequence: null,
      operation,
      actorId,
      playerDamageEventId: null,
      maxHp: 1_000,
      hpBefore: 1_000,
      hpAfter: 1_000,
      hpRatioAfter: 1
    });
    expect(() =>
      playerHpTimelineSchema.parse({
        version: "1.0.0",
        points: [
          boundary(0, 0, "initial", "a"),
          boundary(1, 0, "initial", "b"),
          boundary(2, 60, "simulation-end", "a"),
          boundary(3, 60, "simulation-end", "b")
        ]
      })
    ).not.toThrow();
  });

  it("strictly validates player formulas, spatial outcomes, and shield absorption", () => {
    const factors = {
      reaction: "burning",
      sourcePreResistanceDamage: 100,
      selfDamageMultiplier: 1,
      preResistanceDamage: 100,
      effectiveResistance: 0.1,
      resistanceMultiplier: 0.9,
      ignoreDefense: 1,
      defenseMultiplier: 1,
      damageGroupMultiplier: 1,
      damageGroupDecision: null,
      finalDamage: 90
    };
    expect(
      playerReactionSelfDamageFactorsSchema.parse(factors)
    ).toEqual(factors);
    expect(
      playerReactionSelfDamageFactorsSchema.parse({
        ...factors,
        effectiveResistance: -0.2,
        resistanceMultiplier: 1.1,
        finalDamage: 110
      }).resistanceMultiplier
    ).toBe(1.1);
    expect(
      playerReactionSelfDamageFactorsSchema.parse({
        ...factors,
        effectiveResistance: 0.75,
        resistanceMultiplier: 0.25,
        finalDamage: 25
      }).resistanceMultiplier
    ).toBe(0.25);
    expect(() =>
      playerReactionSelfDamageFactorsSchema.parse({
        ...factors,
        selfDamageMultiplier: 0.5,
        preResistanceDamage: 50,
        finalDamage: 45
      })
    ).toThrow(/authoritative player self-damage multiplier/);
    expect(() =>
      playerReactionSelfDamageFactorsSchema.parse({
        ...factors,
        resistanceMultiplier: 0.8,
        finalDamage: 80
      })
    ).toThrow(/three-branch resistance formula/);
    expect(() =>
      playerReactionSelfDamageFactorsSchema.parse({
        ...factors,
        reaction: "bloom",
        selfDamageMultiplier: 0.02,
        preResistanceDamage: 2,
        finalDamage: 1.8
      })
    ).toThrow(/player-avatar ReactionA/);

    const miss = {
      id: 0,
      frame: 15,
      timeSeconds: 0.25,
      eventPriority: 5,
      eventSequence: 7,
      intraEventSequence: 0,
      reaction: "burning",
      element: "pyro",
      sourceActorId: "a",
      sourceTargetId: "enemy-0",
      targetActorId: "a",
      reactionDamageLogId: 0,
      burningStateLogId: 0,
      dendroCoreRemovalLogId: null,
      damageCenter: { x: 3, y: 0 },
      damageRadius: 1,
      playerCenter: { x: 0, y: 0 },
      playerRadius: 0.5,
      distance: 3,
      distanceSquared: 9,
      combinedRadius: 1.5,
      combinedRadiusSquared: 2.25,
      outcome: "miss",
      blockedReason: "OUT_OF_RANGE",
      playerDamageEventId: null
    };
    expect(
      playerHitResolutionLogEntrySchema.parse(miss)
    ).toEqual(miss);
    expect(() =>
      playerHitResolutionLogEntrySchema.parse({
        ...miss,
        damageRadius: 2,
        combinedRadius: 2.5,
        combinedRadiusSquared: 6.25
      })
    ).toThrow(/authoritative reaction mapping/);
    expect(() =>
      playerHitResolutionLogEntrySchema.parse({
        ...miss,
        outcome: "landed",
        blockedReason: null
      })
    ).toThrow(/circular-overlap boundary|require one damage event/);

    const shieldAbsorb = {
      id: 0,
      operation: "absorb",
      frame: 15,
      timeSeconds: 0.25,
      eventPriority: 5,
      eventSequence: 7,
      intraEventSequence: 2,
      shieldId: 3,
      shardId: 4,
      element: "pyro",
      sourceActorId: "a",
      pickedUpByActorId: "a",
      sourceCharacterLevel: 90,
      sourceElementalMastery: 0,
      baseHp: 100,
      elementalMasteryBonus: 0,
      generalAbsorption: 100,
      matchingElementAbsorption: 250,
      geoDamageAbsorption: 150,
      currentBaseHp: 64,
      expiresAtFrame: 600,
      previousShieldId: null,
      playerDamageEventId: 0,
      incomingElement: "pyro",
      baseHpBeforeAbsorption: 100,
      baseHpConsumed: 36,
      baseHpAfterAbsorption: 64,
      absorbedDamage: 90,
      damageAfterShield: 0
    };
    expect(
      crystallizeShieldLogEntrySchema.parse(shieldAbsorb)
    ).toEqual(shieldAbsorb);
    const shieldResolution = {
      mode: "crystallize-v1",
      shieldId: 3,
      shieldElement: "pyro",
      incomingDamage: 90,
      incomingElement: "pyro",
      elementalMasteryBonus: 0,
      shieldStrengthBonus: 0,
      absorptionMultiplier: 2.5,
      effectiveAbsorptionMultiplier: 2.5,
      baseHpBefore: 100,
      baseHpConsumed: 36,
      baseHpAfter: 64,
      absorptionCapacity: 250,
      absorbedDamage: 90,
      damageAfterShield: 0,
      shieldBroken: false
    } as const;
    expect(
      playerCrystallizeShieldResolutionSchema.parse(
        shieldResolution
      )
    ).toEqual(shieldResolution);
    expect(() =>
      playerCrystallizeShieldResolutionSchema.parse({
        ...shieldResolution,
        baseHpConsumed: 32,
        baseHpAfter: 68,
        absorbedDamage: 80,
        damageAfterShield: 10
      })
    ).toThrow(/min\(incomingDamage, absorptionCapacity\)/);
    const exactBreak = {
      ...shieldResolution,
      incomingDamage: 250,
      baseHpConsumed: 100,
      baseHpAfter: 0,
      absorbedDamage: 250,
      shieldBroken: true
    };
    expect(
      playerCrystallizeShieldResolutionSchema.parse(exactBreak)
        .shieldBroken
    ).toBe(true);
    expect(() =>
      playerCrystallizeShieldResolutionSchema.parse({
        ...exactBreak,
        shieldBroken: false
      })
    ).toThrow(/breaks exactly/);
    const noShield = {
      ...shieldResolution,
      shieldId: null,
      shieldElement: null,
      elementalMasteryBonus: 0,
      shieldStrengthBonus: 0,
      absorptionMultiplier: 1,
      effectiveAbsorptionMultiplier: 1,
      baseHpBefore: 0,
      baseHpConsumed: 0,
      baseHpAfter: 0,
      absorptionCapacity: 0,
      absorbedDamage: 0,
      damageAfterShield: 90,
      shieldBroken: false
    };
    expect(
      playerCrystallizeShieldResolutionSchema.parse(noShield)
        .shieldBroken
    ).toBe(false);
    expect(() =>
      playerCrystallizeShieldResolutionSchema.parse({
        ...noShield,
        shieldBroken: true
      })
    ).toThrow(/absent shield/);
    expect(
      crystallizeShieldTimelinePointSchema.parse({
        id: 0,
        frame: 15,
        timeSeconds: 0.25,
        eventPriority: 5,
        eventSequence: 7,
        intraEventSequence: 3,
        operation: "absorb",
        shieldId: 3,
        element: "pyro",
        generalAbsorption: 64,
        expiresAtFrame: 600,
        playerDamageEventId: 0,
        baseHpBeforeAbsorption: 100,
        baseHpAfterAbsorption: 64,
        absorbedDamage: 90,
        damageAfterShield: 0
      }).operation
    ).toBe("absorb");
  });

  it("enforces reciprocal player links, HP state continuity, summaries, and totals", () => {
    const config = makeEnabledConfig();
    const reactionDamage = {
      id: 0,
      reaction: "burning",
      triggerDamageEventId: null,
      triggerHitGroupId: null,
      sourceActorId: "a",
      sourceTargetId: "enemy-0",
      triggerFrame: 15,
      damageFrame: 15,
      scheduled: true,
      withinSimulation: true,
      blockedReason: null,
      nextAvailableFrame: null,
      scheduleKind: "burning-tick",
      targetingMode: "radius",
      centerPosition: { x: 0, y: 0 },
      radius: 1,
      sourceCoreId: null,
      sourceCoreLogId: null,
      selectionRadius: null,
      selectedTargetId: null,
      resolutionReason: null,
      applicationGaugeUnits: 1,
      excludedTargetIds: [],
      checkedTargetIds: [],
      hitTargetIds: [],
      unresolvedTargetIds: [],
      damageGroupBlockedTargetIds: [],
      damageEventIds: [],
      playerHitResolutionLogIds: [0],
      playerDamageEventIds: [0],
      reactionStatusLogIds: [],
      damageGroupDecisions: []
    };
    const burning = {
      id: 0,
      reaction: "burning",
      generation: 1,
      operation: "tick",
      frame: 15,
      timeSeconds: 0.25,
      eventPriority: 4,
      eventSequence: 7,
      clockModel: "target-local-no-hitlag",
      hitlagStatus: "unsupported-enemy-hitlag",
      targetId: "enemy-0",
      targetName: "Target",
      triggerElement: null,
      damageSourceActorId: "a",
      fuelSourceActorId: "a",
      triggerDamageEventId: null,
      reactionDamageLogId: 0,
      damageEventIds: [],
      playerHitResolutionLogId: 0,
      playerDamageEventId: 0,
      tickIndex: 1,
      tickSkipped: false,
      skipReason: null,
      damageAllowed: true,
      burningGaugeUnitsBefore: 2,
      burningGaugeUnitsAfter: 2,
      fuelGaugeUnitsBefore: 0.7,
      fuelGaugeUnitsAfter: 0.7,
      fuelDecayPerFrame: 1 / 150,
      fuelExpiresAtFrame: 120,
      auraBefore: [],
      auraApplied: [],
      auraConsumed: [],
      auraAfter: [],
      nextTickFrame: 30,
      icdGroup: "burning",
      icdTag: "burning-application",
      icdScope: "global-target",
      icdWindowStartFrame: 15,
      icdHitIndex: 0,
      icdResetFrames: 120,
      icdApplicationSequence: [
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false
      ],
      applicationAllowed: true,
      applicationBlockedReason: null,
      selfDamageStatus: "modeled-player-reaction-damage",
      reason: null
    };
    const hit = {
      id: 0,
      frame: 15,
      timeSeconds: 0.25,
      eventPriority: 5,
      eventSequence: 7,
      intraEventSequence: 0,
      reaction: "burning",
      element: "pyro",
      sourceActorId: "a",
      sourceTargetId: "enemy-0",
      targetActorId: "a",
      reactionDamageLogId: 0,
      burningStateLogId: 0,
      dendroCoreRemovalLogId: null,
      damageCenter: { x: 0, y: 0 },
      damageRadius: 1,
      playerCenter: { x: 0, y: 0 },
      playerRadius: 0.5,
      distance: 0,
      distanceSquared: 0,
      combinedRadius: 1.5,
      combinedRadiusSquared: 2.25,
      outcome: "landed",
      blockedReason: null,
      playerDamageEventId: 0
    };
    const event = {
      id: 0,
      frame: 15,
      timeSeconds: 0.25,
      eventPriority: 5,
      eventSequence: 7,
      intraEventSequence: 1,
      reaction: "burning",
      element: "pyro",
      sourceActorId: "a",
      sourceTargetId: "enemy-0",
      targetActorId: "a",
      reactionDamageLogId: 0,
      playerHitResolutionLogId: 0,
      burningStateLogId: 0,
      dendroCoreRemovalLogId: null,
      damageFactors: {
        reaction: "burning",
        sourcePreResistanceDamage: 100,
        selfDamageMultiplier: 1,
        preResistanceDamage: 100,
        effectiveResistance: 0.1,
        resistanceMultiplier: 0.9,
        ignoreDefense: 1,
        defenseMultiplier: 1,
        damageGroupMultiplier: 1,
        damageGroupDecision: null,
        finalDamage: 90
      },
      shieldResolution: {
        mode: "crystallize-v1",
        shieldId: null,
        shieldElement: null,
        incomingDamage: 90,
        incomingElement: "pyro",
        elementalMasteryBonus: 0,
        shieldStrengthBonus: 0,
        absorptionMultiplier: 1,
        effectiveAbsorptionMultiplier: 1,
        baseHpBefore: 0,
        baseHpConsumed: 0,
        baseHpAfter: 0,
        absorptionCapacity: 0,
        absorbedDamage: 0,
        damageAfterShield: 90,
        shieldBroken: false
      },
      hpResolution: {
        zeroHpPolicy: "clamp-and-continue",
        inputCurrentHp: 1_000,
        currentHpBefore: 1_000,
        currentHpAfter: 910,
        maxHp: 1_000,
        attemptedLoss: 90,
        actualLoss: 90,
        overkill: 0,
        hpRatioBefore: 1,
        hpRatioAfter: 0.91
      },
      finalDamage: 90,
      displayDamage: 90
    };
    const bloomEvent = {
      ...event,
      reaction: "bloom",
      element: "dendro",
      burningStateLogId: null,
      dendroCoreRemovalLogId: 0,
      damageFactors: {
        reaction: "bloom",
        sourcePreResistanceDamage: 100,
        selfDamageMultiplier: 0.02,
        preResistanceDamage: 2,
        effectiveResistance: 0.1,
        resistanceMultiplier: 0.9,
        ignoreDefense: 1,
        defenseMultiplier: 1,
        damageGroupMultiplier: 1,
        damageGroupDecision: {
          reaction: "bloom",
          sourceActorId: "a",
          targetId: "player-avatar",
          windowStartFrame: 15,
          hitIndex: 0,
          resetFrames: 30,
          sequence: [true, true, false],
          damageAllowed: true,
          blockedReason: null
        },
        finalDamage: 1.8
      },
      shieldResolution: {
        ...event.shieldResolution,
        incomingDamage: 1.8,
        incomingElement: "dendro",
        damageAfterShield: 1.8
      },
      hpResolution: {
        ...event.hpResolution,
        currentHpAfter: 998.2,
        attemptedLoss: 1.8,
        actualLoss: 1.8,
        overkill: 0,
        hpRatioAfter: 0.9982
      },
      finalDamage: 1.8,
      displayDamage: 2
    } as const;
    expect(() =>
      playerDamageEventSchema.parse(bloomEvent)
    ).not.toThrow();
    expect(() =>
      playerDamageEventSchema.parse({
        ...bloomEvent,
        damageFactors: {
          ...bloomEvent.damageFactors,
          damageGroupDecision: {
            ...bloomEvent.damageFactors.damageGroupDecision,
            sourceActorId: "forged-source"
          }
        }
      })
    ).toThrow(/bind the event source actor/);
    expect(() =>
      playerDamageEventSchema.parse({
        ...bloomEvent,
        element: "pyro",
        shieldResolution: {
          ...bloomEvent.shieldResolution,
          incomingElement: "pyro"
        }
      })
    ).toThrow(/event reaction and element/);
    const result = {
      config,
      damageEvents: [
        {
          id: 0,
          reactionAudit: {
            burningReaction: {
              selfDamageStatus:
                "modeled-player-reaction-damage"
            },
            bloomReactions: [
              {
                selfDamageStatus:
                  "modeled-player-reaction-damage"
              }
            ]
          }
        }
      ],
      reactionDamageLog: [reactionDamage],
      burningStateLog: [burning],
      dendroCoreLog: [],
      playerHitResolutionLog: [hit],
      playerDamageEvents: [event],
      playerHpTimeline: {
        version: "1.0.0",
        points: [
          {
            id: 0,
            frame: 0,
            timeSeconds: 0,
            eventPriority: null,
            eventSequence: null,
            intraEventSequence: null,
            operation: "initial",
            actorId: "a",
            playerDamageEventId: null,
            maxHp: 1_000,
            hpBefore: 1_000,
            hpAfter: 1_000,
            hpRatioAfter: 1
          },
          {
            id: 1,
            frame: 15,
            timeSeconds: 0.25,
            eventPriority: 5,
            eventSequence: 7,
            intraEventSequence: 2,
            operation: "damage",
            actorId: "a",
            playerDamageEventId: 0,
            maxHp: 1_000,
            hpBefore: 1_000,
            hpAfter: 910,
            hpRatioAfter: 0.91
          },
          {
            id: 2,
            frame: 60,
            timeSeconds: 1,
            eventPriority: null,
            eventSequence: null,
            intraEventSequence: null,
            operation: "simulation-end",
            actorId: "a",
            playerDamageEventId: null,
            maxHp: 1_000,
            hpBefore: 910,
            hpAfter: 910,
            hpRatioAfter: 0.91
          }
        ]
      },
      playerHpSummaries: [
        {
          actorId: "a",
          maxHp: 1_000,
          initialHp: 1_000,
          finalHp: 910,
          totalIncomingDamage: 90,
          totalAbsorbedDamage: 0,
          totalHpDamage: 90,
          hitCount: 1,
          zeroHpReached: false
        }
      ],
      crystallizeShieldLog: [],
      crystallizeShieldTimeline: [],
      playerSelfDamageStatus: "modeled-player-reaction-damage",
      totalPlayerDamageTaken: 90,
      totalReactionSelfDamageTaken: 90
    };
    expect(() =>
      playerDamageResultReferencesSchema.parse(result)
    ).not.toThrow();
    const enabledBurningStatusTamper =
      structuredClone(result);
    enabledBurningStatusTamper.damageEvents[0]!.reactionAudit
      .burningReaction!.selfDamageStatus =
      "unsupported-player-damage-model";
    expect(() =>
      playerDamageResultReferencesSchema.parse(
        enabledBurningStatusTamper
      )
    ).toThrow(/Burning reaction-audit selfDamageStatus/);
    const enabledBloomStatusTamper = structuredClone(result);
    enabledBloomStatusTamper.damageEvents[0]!.reactionAudit
      .bloomReactions[0]!.selfDamageStatus =
      "unsupported-player-damage-model";
    expect(() =>
      playerDamageResultReferencesSchema.parse(
        enabledBloomStatusTamper
      )
    ).toThrow(/Bloom reaction-audit selfDamageStatus/);
    const disabledResult = {
      ...result,
      config: {
        ...config,
        playerDamageModel: { mode: "disabled" as const }
      },
      damageEvents: [
        {
          id: 0,
          reactionAudit: {
            burningReaction: {
              selfDamageStatus:
                "unsupported-player-damage-model"
            },
            bloomReactions: [
              {
                selfDamageStatus:
                  "unsupported-player-damage-model"
              }
            ]
          }
        }
      ],
      reactionDamageLog: [
        {
          ...reactionDamage,
          playerHitResolutionLogIds: [],
          playerDamageEventIds: []
        }
      ],
      burningStateLog: [
        {
          ...burning,
          playerHitResolutionLogId: null,
          playerDamageEventId: null,
          selfDamageStatus:
            "unsupported-player-damage-model"
        }
      ],
      playerHitResolutionLog: [],
      playerDamageEvents: [],
      playerHpTimeline: {
        version: "1.0.0" as const,
        points: []
      },
      playerHpSummaries: [],
      playerSelfDamageStatus:
        "unsupported-player-damage-model",
      totalPlayerDamageTaken: 0,
      totalReactionSelfDamageTaken: 0
    };
    expect(() =>
      playerDamageResultReferencesSchema.parse(disabledResult)
    ).not.toThrow();
    const disabledBurningStatusTamper =
      structuredClone(disabledResult);
    disabledBurningStatusTamper.damageEvents[0]!.reactionAudit
      .burningReaction!.selfDamageStatus =
      "modeled-player-reaction-damage";
    expect(() =>
      playerDamageResultReferencesSchema.parse(
        disabledBurningStatusTamper
      )
    ).toThrow(/Burning reaction-audit selfDamageStatus/);
    const disabledBloomStatusTamper =
      structuredClone(disabledResult);
    disabledBloomStatusTamper.damageEvents[0]!.reactionAudit
      .bloomReactions[0]!.selfDamageStatus =
      "modeled-player-reaction-damage";
    expect(() =>
      playerDamageResultReferencesSchema.parse(
        disabledBloomStatusTamper
      )
    ).toThrow(/Bloom reaction-audit selfDamageStatus/);
    const resistanceTamper = structuredClone(result);
    if (
      resistanceTamper.config.playerDamageModel.mode !==
      "reaction-self-v1"
    ) {
      throw new Error("expected enabled player model");
    }
    resistanceTamper.config.playerDamageModel.characters[0]!
      .resistances.pyro = 0.2;
    expect(() =>
      playerDamageResultReferencesSchema.parse(
        resistanceTamper
      )
    ).toThrow(/configured target actor resistance/);
    const playerCenterTamper = structuredClone(result);
    if (
      playerCenterTamper.config.playerDamageModel.mode !==
      "reaction-self-v1"
    ) {
      throw new Error("expected enabled player model");
    }
    playerCenterTamper.config.playerDamageModel.position.x =
      0.25;
    expect(() =>
      playerDamageResultReferencesSchema.parse(
        playerCenterTamper
      )
    ).toThrow(/center and radius must match/);
    const hitboxRadiusTamper = structuredClone(result);
    if (
      hitboxRadiusTamper.config.playerDamageModel.mode !==
      "reaction-self-v1"
    ) {
      throw new Error("expected enabled player model");
    }
    hitboxRadiusTamper.config.playerDamageModel.hitboxRadius =
      0.75;
    expect(() =>
      playerDamageResultReferencesSchema.parse(
        hitboxRadiusTamper
      )
    ).toThrow(/center and radius must match/);
    const damageCenterTamper = structuredClone(result);
    damageCenterTamper.reactionDamageLog[0]!.centerPosition = {
      x: 0.25,
      y: 0
    };
    expect(() =>
      playerDamageResultReferencesSchema.parse(
        damageCenterTamper
      )
    ).toThrow(/damageCenter must match/);
    expect(playerDamageEventSchema.parse(event)).toEqual(event);
    expect(
      playerHpTimelineSchema.parse(result.playerHpTimeline)
        .points
    ).toHaveLength(3);
    expect(() =>
      playerDamageResultReferencesSchema.parse({
        ...result,
        totalPlayerDamageTaken: 89
      })
    ).toThrow(/totals|sum/);
    expect(() =>
      playerDamageResultReferencesSchema.parse({
        ...result,
        reactionDamageLog: [
          {
            ...reactionDamage,
            playerDamageEventIds: []
          }
        ]
      })
    ).toThrow(/exactly project|back-references/);
  });
});

describe("1.33 target-local Hitlag contract", () => {
  const makeTargetClockConfig = () => {
    const current = migrateConfig(legacyConfig);
    return migrateConfig({
      ...current,
      duration: 1,
      enemy: {
        ...current.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "Target",
            position: { x: 0, y: 0 }
          }
        ]
      },
      rotation: [],
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [],
        commands: []
      },
      targetClockModel: {
        mode: "target-local-hitlag-v1"
      }
    });
  };

  const makeTargetStateTimeline = (
    finalTargetFrame = 57
  ) => ({
    version: "1.0.0",
    points: [
      {
        id: 0,
        frame: 0,
        targetFrame: 0,
        timeSeconds: 0,
        targetId: "enemy-0",
        targetName: "Target",
        pointKind: "boundary",
        cause: "simulation-start",
        eventType: null,
        eventPriority: null,
        eventSequence: null,
        intraEventSequence: null,
        reaction: "none",
        reactions: [],
        primaryDamageEventId: null,
        links: [],
        auraBefore: [],
        auraApplied: [],
        auraConsumed: [],
        auraAfter: []
      },
      {
        id: 1,
        frame: 60,
        targetFrame: finalTargetFrame,
        timeSeconds: 1,
        targetId: "enemy-0",
        targetName: "Target",
        pointKind: "boundary",
        cause: "simulation-end",
        eventType: null,
        eventPriority: null,
        eventSequence: null,
        intraEventSequence: null,
        reaction: "none",
        reactions: [],
        primaryDamageEventId: null,
        links: [],
        auraBefore: [],
        auraApplied: [],
        auraConsumed: [],
        auraAfter: []
      }
    ]
  });

  const appliedHitlag: TargetHitlagLogEntry = {
    id: 0,
    globalFrame: 10,
    timeSeconds: 10 / 60,
    targetFrame: 10,
    eventPriority: 3,
    eventSequence: 4,
    intraEventSequence: 0,
    targetId: "enemy-0",
    targetName: "Target",
    sourceActorId: "a",
    sourceActionId: "skill",
    hitId: "skill-hit",
    hitGroupId: "skill-hit@10",
    hitResolutionLogId: 0,
    haltFrames: 3.2,
    factor: 0.25,
    roundedHaltFrames: 4,
    extensionFrames: 3,
    frozenFramesBefore: 0,
    frozenFramesAfter: 3,
    pausedGlobalFrameStart: 11,
    nextTargetAdvanceGlobalFrame: 14,
    applied: true,
    blockedReason: null,
    extendedReactionStatusLogIds: [0],
    mechanicsDataStatus: "fixed-gcsim-provisional"
  };

  const appliedClockLog: TargetClockLogEntry[] = [
    {
      id: 0,
      targetId: "enemy-0",
      targetName: "Target",
      operation: "advance",
      globalFrameBefore: 0,
      globalFrameAfter: 10,
      targetFrameBefore: 0,
      targetFrameAfter: 10,
      frozenFramesBefore: 0,
      consumedFrozenFrames: 0,
      addedFrozenFrames: 0,
      frozenFramesAfter: 0,
      targetHitlagLogId: null,
      cause: "target-local-task"
    },
    {
      id: 1,
      targetId: "enemy-0",
      targetName: "Target",
      operation: "apply-hitlag",
      globalFrameBefore: 10,
      globalFrameAfter: 10,
      targetFrameBefore: 10,
      targetFrameAfter: 10,
      frozenFramesBefore: 0,
      consumedFrozenFrames: 0,
      addedFrozenFrames: 3,
      frozenFramesAfter: 3,
      targetHitlagLogId: 0,
      cause: "hit"
    },
    {
      id: 2,
      targetId: "enemy-0",
      targetName: "Target",
      operation: "advance",
      globalFrameBefore: 10,
      globalFrameAfter: 60,
      targetFrameBefore: 10,
      targetFrameAfter: 57,
      frozenFramesBefore: 3,
      consumedFrozenFrames: 3,
      addedFrozenFrames: 0,
      frozenFramesAfter: 0,
      targetHitlagLogId: null,
      cause: "simulation-end"
    }
  ];

  const makeResultReferences = () => ({
    config: makeTargetClockConfig(),
    hitResolutionLog: [
      {
        id: 0,
        frame: 10,
        timeSeconds: 10 / 60,
        sourceActorId: "a",
        sourceActionId: "skill",
        hitId: "skill-hit",
        hitGroupId: "skill-hit@10",
        targetId: "enemy-0",
        targetName: "Target",
        landed: true
      }
    ],
    reactionStatusLog: [
      {
        id: 0,
        reaction: "superconduct",
        targetId: "enemy-0",
        targetName: "Target",
        startFrame: 0,
        endFrame: 723,
        startTimeSeconds: 0,
        endTimeSeconds: 723 / 60,
        supersededAtFrame: null as number | null
      }
    ],
    targetStateTimeline: makeTargetStateTimeline(),
    targetClockAudit: {
      version: "1.0.0",
      mode: "target-local-hitlag-v1",
      hitlagStatus: "modeled-enemy-hitlag",
      roundingModel: "ceil-ceil-v1",
      applicationOrder: "after-current-target-tick",
      mechanicsDataStatus: "fixed-gcsim-provisional",
      targets: [
        {
          targetId: "enemy-0",
          targetName: "Target",
          finalGlobalFrame: 60,
          finalTargetFrame: 57,
          frozenFramesConsumed: 3,
          frozenFramesRemaining: 0,
          hitlagApplications: 1,
          totalExtensionFrames: 3
        }
      ]
    },
    targetClockLog: appliedClockLog,
    targetHitlagLog: [appliedHitlag]
  });

  it("requires an explicit mode, gates it to legal-frame execution, and keeps Hitlag input atomic", () => {
    const current = migrateConfig(legacyConfig);
    const missingMode = {
      ...current
    } as Record<string, unknown>;
    delete missingMode.targetClockModel;
    expect(() => migrateConfig(missingMode)).toThrow(
      /targetClockModel/
    );
    expect(() =>
      migrateConfig({
        ...current,
        targetClockModel: {
          mode: "target-local-hitlag-v1"
        }
      })
    ).toThrow(/requires timeline\.mode legal-frame-v1/);

    const targetHitlag = {
      haltFrames: 3.2,
      factor: 0.25
    };
    expect(
      targetHitlagDefinitionSchema.parse(targetHitlag)
    ).toEqual(targetHitlag);
    expect(
      targetHitlagDefinitionSchema.parse({
        haltFrames: 0,
        factor: 0
      })
    ).toEqual({ haltFrames: 0, factor: 0 });
    expect(() =>
      targetHitlagDefinitionSchema.parse({
        ...targetHitlag,
        preRoundBonus: 1
      })
    ).toThrow(/Unrecognized key/);

    const enabled = makeTargetClockConfig();
    const ability = {
      id: "skill",
      actorId: "a",
      name: "Skill",
      kind: "skill",
      cancelFrame: 1,
      animationEndFrame: 1,
      cooldownFrames: 0,
      hits: [
        {
          id: "skill-hit",
          frame: 0,
          scaling: 1,
          targetHitlag
        }
      ]
    };
    expect(
      migrateConfig({
        ...enabled,
        timeline: {
          ...enabled.timeline!,
          abilities: [ability]
        }
      }).targetClockModel.mode
    ).toBe("target-local-hitlag-v1");
    expect(() =>
      migrateConfig({
        ...enabled,
        targetClockModel: { mode: "disabled" },
        timeline: {
          ...enabled.timeline!,
          abilities: [ability]
        }
      })
    ).toThrow(/targetHitlag requires targetClockModel/);
  });

  it("strictly validates ceil-ceil Hitlag, replay logs, and Superconduct extension references", () => {
    const result = makeResultReferences();
    expect(
      targetHitlagLogEntrySchema.parse(appliedHitlag)
    ).toEqual(appliedHitlag);
    expect(targetHitlagLogSchema.parse([appliedHitlag])).toEqual([
      appliedHitlag
    ]);
    expect(targetClockLogSchema.parse(appliedClockLog)).toEqual(
      appliedClockLog
    );
    expect(
      targetClockAuditSchema.parse(result.targetClockAudit)
    ).toEqual(result.targetClockAudit);
    expect(
      targetClockResultReferencesSchema.parse(result)
    ).toEqual(result);

    expect(() =>
      targetHitlagLogEntrySchema.parse({
        ...appliedHitlag,
        extensionFrames: 2
      })
    ).toThrow(/ceil/);
    expect(() =>
      targetHitlagLogEntrySchema.parse({
        ...appliedHitlag,
        extendedReactionStatusLogIds: [0, 0]
      })
    ).toThrow(/duplicate/);

    const badStatusReference = structuredClone(result);
    badStatusReference.targetHitlagLog[0]!
      .extendedReactionStatusLogIds = [99];
    expect(() =>
      targetClockResultReferencesSchema.parse(
        badStatusReference
      )
    ).toThrow(/Superconduct status 99/);

    const badClockReference = structuredClone(result);
    badClockReference.targetClockLog[1]!.addedFrozenFrames =
      2;
    expect(() =>
      targetClockResultReferencesSchema.parse(
        badClockReference
      )
    ).toThrow(/added duration|exactly replay/);

    const duplicateHitReference = structuredClone(result);
    duplicateHitReference.targetHitlagLog.push({
      ...duplicateHitReference.targetHitlagLog[0]!,
      id: 1,
      eventSequence: 5
    });
    expect(() =>
      targetClockResultReferencesSchema.parse(
        duplicateHitReference
      )
    ).toThrow(/duplicate target Hitlag reference to hit-resolution 0/);

    const badTimelineReplay = structuredClone(result);
    badTimelineReplay.targetStateTimeline.points[1]!.targetFrame =
      56;
    expect(() =>
      targetClockResultReferencesSchema.parse(
        badTimelineReplay
      )
    ).toThrow(/target-clock replay|summary/);

    const badStatusEnd = structuredClone(result);
    badStatusEnd.reactionStatusLog[0]!.endFrame = 724;
    badStatusEnd.reactionStatusLog[0]!.endTimeSeconds =
      724 / 60;
    expect(() =>
      targetClockResultReferencesSchema.parse(badStatusEnd)
    ).toThrow(/startFrame \+ 720 \+ reciprocal Hitlag extensions/);

    const badStatusTime = structuredClone(result);
    badStatusTime.reactionStatusLog[0]!.endTimeSeconds +=
      1 / 60;
    expect(() =>
      targetClockResultReferencesSchema.parse(badStatusTime)
    ).toThrow(/endFrame \/ 60/);

    const superseded = structuredClone(result);
    superseded.reactionStatusLog[0]!.endFrame = 20;
    superseded.reactionStatusLog[0]!.endTimeSeconds = 20 / 60;
    superseded.reactionStatusLog[0]!.supersededAtFrame = 20;
    expect(
      targetClockResultReferencesSchema.parse(superseded)
        .reactionStatusLog[0]
    ).toMatchObject({
      endFrame: 20,
      supersededAtFrame: 20
    });

    const badSupersededEnd = structuredClone(superseded);
    badSupersededEnd.reactionStatusLog[0]!.endFrame = 21;
    badSupersededEnd.reactionStatusLog[0]!.endTimeSeconds =
      21 / 60;
    expect(() =>
      targetClockResultReferencesSchema.parse(
        badSupersededEnd
      )
    ).toThrow(/end exactly at its superseding frame/);
  });

  it("sums same-frame Hitlag extensions into one exact Superconduct deadline", () => {
    const result = makeResultReferences();
    result.hitResolutionLog.push({
      ...result.hitResolutionLog[0]!,
      id: 1,
      hitId: "skill-hit-2",
      hitGroupId: "skill-hit-2@10"
    });
    result.targetHitlagLog.push({
      ...result.targetHitlagLog[0]!,
      id: 1,
      intraEventSequence: 1,
      hitId: "skill-hit-2",
      hitGroupId: "skill-hit-2@10",
      hitResolutionLogId: 1,
      frozenFramesBefore: 3,
      frozenFramesAfter: 6,
      nextTargetAdvanceGlobalFrame: 17
    });
    result.targetClockLog = [
      result.targetClockLog[0]!,
      result.targetClockLog[1]!,
      {
        ...result.targetClockLog[1]!,
        id: 2,
        frozenFramesBefore: 3,
        frozenFramesAfter: 6,
        targetHitlagLogId: 1
      },
      {
        ...result.targetClockLog[2]!,
        id: 3,
        targetFrameAfter: 54,
        frozenFramesBefore: 6,
        consumedFrozenFrames: 6
      }
    ];
    result.targetClockAudit.targets[0] = {
      ...result.targetClockAudit.targets[0]!,
      finalTargetFrame: 54,
      frozenFramesConsumed: 6,
      hitlagApplications: 2,
      totalExtensionFrames: 6
    };
    result.targetStateTimeline = makeTargetStateTimeline(54);
    result.reactionStatusLog[0]!.endFrame = 726;
    result.reactionStatusLog[0]!.endTimeSeconds = 726 / 60;

    expect(
      targetClockResultReferencesSchema.parse(result)
        .reactionStatusLog[0]!.endFrame
    ).toBe(726);

    const oneFrameTooLong = structuredClone(result);
    oneFrameTooLong.reactionStatusLog[0]!.endFrame = 727;
    oneFrameTooLong.reactionStatusLog[0]!.endTimeSeconds =
      727 / 60;
    expect(() =>
      targetClockResultReferencesSchema.parse(oneFrameTooLong)
    ).toThrow(/startFrame \+ 720 \+ reciprocal Hitlag extensions/);
  });

  it("records a miss before zero-extension semantics when factor is one", () => {
    const result = makeResultReferences();
    result.hitResolutionLog[0]!.landed = false;
    result.targetHitlagLog = [
      {
        ...appliedHitlag,
        factor: 1,
        extensionFrames: 0,
        frozenFramesAfter: 0,
        pausedGlobalFrameStart: null,
        nextTargetAdvanceGlobalFrame: null,
        applied: false,
        blockedReason: "TARGET_MISS",
        extendedReactionStatusLogIds: []
      }
    ];
    result.targetClockLog = [
      {
        ...appliedClockLog[0]!,
        id: 0,
        globalFrameAfter: 60,
        targetFrameAfter: 60,
        cause: "simulation-end"
      }
    ];
    result.targetClockAudit.targets[0] = {
      ...result.targetClockAudit.targets[0]!,
      finalTargetFrame: 60,
      frozenFramesConsumed: 0,
      hitlagApplications: 0,
      totalExtensionFrames: 0
    };
    result.targetStateTimeline =
      makeTargetStateTimeline(60);
    result.reactionStatusLog[0]!.endFrame = 720;
    result.reactionStatusLog[0]!.endTimeSeconds = 720 / 60;

    expect(
      targetHitlagLogEntrySchema.parse(
        result.targetHitlagLog[0]
      ).blockedReason
    ).toBe("TARGET_MISS");
    expect(
      targetClockResultReferencesSchema.parse(result)
        .targetHitlagLog[0]!.blockedReason
    ).toBe("TARGET_MISS");

    const wrongPriority = structuredClone(result);
    wrongPriority.targetHitlagLog[0]!.blockedReason =
      "ZERO_EXTENSION";
    expect(() =>
      targetClockResultReferencesSchema.parse(wrongPriority)
    ).toThrow(/landed\/miss state/);
  });

  it("keeps legacy/disabled target-state frames compatible and rejects output drift", () => {
    const config = migrateConfig(legacyConfig);
    const disabled = {
      config,
      hitResolutionLog: [],
      reactionStatusLog: [],
      targetStateTimeline: validTargetStateTimeline,
      targetClockAudit: {
        version: "1.0.0",
        mode: "disabled",
        hitlagStatus: "unsupported-enemy-hitlag",
        targets: []
      },
      targetClockLog: [],
      targetHitlagLog: []
    };
    expect(
      targetClockResultReferencesSchema.parse(disabled)
        .targetClockAudit.mode
    ).toBe("disabled");
    expect(() =>
      targetClockAuditSchema.parse({
        ...disabled.targetClockAudit,
        unexpected: true
      })
    ).toThrow(/Unrecognized key/);
    expect(() =>
      targetClockResultReferencesSchema.parse({
        ...disabled,
        targetStateTimeline: {
          ...validTargetStateTimeline,
          points: validTargetStateTimeline.points.map(
            (point, index) => ({
              ...point,
              targetFrame:
                index === 0 ? point.frame : point.frame - 1
            })
          )
        }
      })
    ).toThrow(/require targetFrame to equal frame/);
  });
});

describe("simulation run manifest contract", () => {
  it("strictly validates its identity and migrated-config binding", () => {
    const config = migrateConfig(legacyConfig);
    const manifest = createSimulationRunManifest({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION,
      dataVersion: config.dataVersion,
      configHash: createSimulationConfigHash(config),
      resolvedRuntimeOptions: {
        energyMode: "configured",
        critMode: "average",
        compatibilityMode: "legacy-v0.1",
        randomSeed: config.randomSeed
      },
      plugins: [
        {
          order: 0,
          index: 0,
          id: "test-plugin",
          version: "1.0.0",
          kind: "code",
          contentHash: createVersionedContentHash({
            behavior: "test"
          })
        }
      ]
    });

    expect(simulationRunManifestSchema.parse(manifest)).toEqual(
      manifest
    );
    expect(
      parseSimulationRunManifestForConfig(manifest, config)
    ).toEqual(manifest);
    expect(() =>
      simulationRunManifestSchema.parse({
        ...manifest,
        unexpected: true
      })
    ).toThrow(/Unrecognized key/);
    expect(() =>
      simulationRunManifestSchema.parse({
        ...manifest,
        reproducibilityKey:
          "gdl-v2-fnv1a32-00000000"
      })
    ).toThrow(
      /does not match the versioned run-manifest identity/
    );
    expect(() =>
      parseSimulationRunManifestForConfig(manifest, {
        ...config,
        randomSeed: "changed-config-seed"
      })
    ).toThrow(/not bound to the supplied migrated config/);
  });

  it("requires exact plugin order and unique plugin ids", () => {
    const config = migrateConfig(legacyConfig);
    const descriptor = {
      id: "duplicate",
      version: "1.0.0",
      kind: "code" as const,
      contentHash: createVersionedContentHash({
        behavior: "test"
      })
    };
    const manifest = createSimulationRunManifest({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION,
      dataVersion: config.dataVersion,
      configHash: createSimulationConfigHash(config),
      resolvedRuntimeOptions: {
        energyMode: "configured",
        critMode: "average",
        compatibilityMode: "legacy-v0.1",
        randomSeed: config.randomSeed
      },
      plugins: [
        { order: 1, index: 0, ...descriptor },
        { order: 1, index: 1, ...descriptor }
      ]
    });

    expect(() =>
      simulationRunManifestSchema.parse(manifest)
    ).toThrow(
      /plugin order and index must equal|duplicate plugin id/
    );
  });

  it("canonicalizes object keys while retaining array order", () => {
    expect(
      createVersionedContentHash({
        alpha: 1,
        nested: { beta: 2 }
      })
    ).toBe(
      createVersionedContentHash({
        nested: { beta: 2 },
        alpha: 1
      })
    );
    expect(
      createVersionedContentHash({
        effects: ["first", "second"]
      })
    ).not.toBe(
      createVersionedContentHash({
        effects: ["second", "first"]
      })
    );
  });
});

describe("versioned config schema", () => {
  it("migrates a legacy config and fills required versions/default stats", () => {
    const migrated = migrateConfig(legacyConfig);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
    expect(migrated.dataVersion).toBe("0.1.0-demo");
    expect(migrated.randomSeed).toBe("legacy-default");
    expect(migrated.meta.verificationStatus).toBe("provisional");
    expect(migrated.characters[0]?.stats.critRate).toBe(0.05);
  });

  it("reports a precise field path before simulation", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        enemy: { ...legacyConfig.enemy, level: 999 }
      })
    ).toThrowError(ConfigMigrationError);

    try {
      migrateConfig({
        ...legacyConfig,
        enemy: { ...legacyConfig.enemy, level: 999 }
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigMigrationError);
      expect((error as ConfigMigrationError).issues).toContain(
        "enemy.level: Too big: expected number to be <=200"
      );
    }
  });

  it("rejects unknown fields instead of silently ignoring them", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        engineVersion: "1",
        dataVersion: "1",
        randomSeed: "seed",
        meta: {
          ...legacyConfig.meta,
          verificationStatus: "provisional"
        },
        unexpected: true
      })
    ).toThrow(/unexpected/);
  });

  it("rejects unknown character references with a field path", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [
          {
            id: "bad",
            actorId: "missing",
            name: "坏行动",
            at: 0
          }
        ]
      })
    ).toThrow(/rotation\.0\.actorId/);
  });

  it("validates legal timeline ability references before scheduling", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [],
        timeline: {
          mode: "legal-frame-v1",
          fps: 60,
          legalityMode: "strict",
          initialActiveCharacterId: "a",
          swapFrames: 12,
          abilities: [],
          commands: [
            {
              type: "skill",
              actorId: "a",
              abilityId: "missing"
            }
          ]
        }
      })
    ).toThrow(/timeline\.commands\.0\.abilityId/);
  });

  it("rejects absolute rotations mixed with a legal timeline", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [
          {
            id: "legacy-action",
            actorId: "a",
            name: "旧行动",
            at: 0
          }
        ],
        timeline: {
          mode: "legal-frame-v1",
          fps: 60,
          legalityMode: "strict",
          initialActiveCharacterId: "a",
          swapFrames: 12,
          abilities: [],
          commands: []
        }
      })
    ).toThrow(/rotation: must be empty/);
  });

  it("migrates 1.0.0 through 1.20.0 configs to actor poses", () => {
    const current = migrateConfig(legacyConfig);
    const migratedFromOne = migrateConfig({
      ...current,
      schemaVersion: "1.0.0",
      engineVersion: "1.0.0-compat"
    });
    const migratedFromAura = migrateConfig({
      ...current,
      schemaVersion: "1.1.0",
      engineVersion: "1.1.0-aura"
    });
    const migratedFromParticles = migrateConfig({
      ...current,
      schemaVersion: "1.2.0",
      engineVersion: "1.2.0-particles"
    });
    const migratedFromIcdProfiles = migrateConfig({
      ...current,
      schemaVersion: "1.3.0",
      engineVersion: "1.3.0-icd-profiles"
    });
    const migratedFromActionStates = migrateConfig({
      ...current,
      schemaVersion: "1.4.0",
      engineVersion: "1.4.0-action-states"
    });
    const migratedFromFollowupCancels = migrateConfig({
      ...current,
      schemaVersion: "1.5.0",
      engineVersion: "1.5.0-followup-cancels"
    });
    const migratedFromRuntimeEnergy = migrateConfig({
      ...current,
      schemaVersion: "1.6.0",
      engineVersion: "1.6.0-runtime-energy"
    });
    const migratedFromFixedEnergyIcd = migrateConfig({
      ...current,
      schemaVersion: "1.7.0",
      engineVersion: "1.7.0-fixed-energy-icd"
    });
    const migratedFromHitParticles = migrateConfig({
      ...current,
      schemaVersion: "1.8.0",
      engineVersion: "1.8.0-hit-particle-triggers"
    });
    const migratedFromMovementCommands = migrateConfig({
      ...current,
      schemaVersion: "1.9.0",
      engineVersion: "1.9.0-movement-commands"
    });
    const migratedFromStateClears = migrateConfig({
      ...current,
      schemaVersion: "1.10.0",
      engineVersion: "1.10.0-timeline-state-clears"
    });
    const migratedFromTargetHitResolution = migrateConfig({
      ...current,
      schemaVersion: "1.11.0",
      engineVersion: "1.11.0-target-hit-resolution"
    });
    const migratedFromTargetEffectPolicy = migrateConfig({
      ...current,
      schemaVersion: "1.12.0",
      engineVersion: "1.12.0-target-effect-policy"
    });
    const migratedFromTargetPhaseTimeline = migrateConfig({
      ...current,
      schemaVersion: "1.13.0",
      engineVersion: "1.13.0-target-phase-timeline"
    });
    const migratedFromMultiTargetRegistry = migrateConfig({
      ...current,
      schemaVersion: "1.14.0",
      engineVersion: "1.14.0-multi-target-registry"
    });
    const migratedFromAoeFanout = migrateConfig({
      ...current,
      schemaVersion: "1.15.0",
      engineVersion: "1.15.0-aoe-fanout"
    });
    const migratedFromCircleGeometry = migrateConfig({
      ...current,
      schemaVersion: "1.16.0",
      engineVersion: "1.16.0-circle-geometry"
    });
    const migratedFromTargetMotion = migrateConfig({
      ...current,
      schemaVersion: "1.17.0",
      engineVersion: "1.17.0-target-motion"
    });
    const migratedFromOrientedRectangle = migrateConfig({
      ...current,
      schemaVersion: "1.18.0",
      engineVersion: "1.18.0-oriented-rectangle"
    });
    const migratedFromCapsuleGeometry = migrateConfig({
      ...current,
      schemaVersion: "1.19.0",
      engineVersion: "1.19.0-capsule-geometry"
    });
    const migratedFromSectorGeometry = migrateConfig({
      ...current,
      schemaVersion: "1.20.0",
      engineVersion: "1.20.0-sector-geometry"
    });

    expect(migratedFromOne.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migratedFromOne.engineVersion).toBe(CURRENT_ENGINE_VERSION);
    expect(migratedFromAura.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migratedFromAura.engineVersion).toBe(CURRENT_ENGINE_VERSION);
    expect(migratedFromParticles.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromParticles.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromIcdProfiles.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromIcdProfiles.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromActionStates.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromActionStates.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromFollowupCancels.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromFollowupCancels.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromRuntimeEnergy.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromRuntimeEnergy.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromFixedEnergyIcd.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromFixedEnergyIcd.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromHitParticles.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromHitParticles.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromMovementCommands.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromMovementCommands.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromStateClears.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromStateClears.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromTargetHitResolution.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromTargetHitResolution.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromTargetEffectPolicy.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromTargetEffectPolicy.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromTargetPhaseTimeline.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromTargetPhaseTimeline.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromMultiTargetRegistry.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromMultiTargetRegistry.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromAoeFanout.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromAoeFanout.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromCircleGeometry.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromCircleGeometry.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromTargetMotion.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromTargetMotion.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromOrientedRectangle.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromOrientedRectangle.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromCapsuleGeometry.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromCapsuleGeometry.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(migratedFromSectorGeometry.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(migratedFromSectorGeometry.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
  });

  it("enforces every typed historical schema/engine pair and Aura-mode ceiling", () => {
    const current = migrateConfig(legacyConfig);
    const legalTimeline = {
      mode: "legal-frame-v1" as const,
      fps: 60 as const,
      legalityMode: "strict" as const,
      initialActiveCharacterId: "a",
      swapFrames: 12,
      abilities: [],
      commands: []
    };
    const contracts = [
      {
        schemaVersion: "1.0.0",
        engineVersion: "1.0.0-compat",
        allowedMode: null,
        futureMode: "aura-v1"
      },
      {
        schemaVersion: "1.1.0",
        engineVersion: "1.1.0-aura",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.2.0",
        engineVersion: "1.2.0-particles",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.3.0",
        engineVersion: "1.3.0-icd-profiles",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.4.0",
        engineVersion: "1.4.0-action-states",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.5.0",
        engineVersion: "1.5.0-followup-cancels",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.6.0",
        engineVersion: "1.6.0-runtime-energy",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.7.0",
        engineVersion: "1.7.0-fixed-energy-icd",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.8.0",
        engineVersion: "1.8.0-hit-particle-triggers",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.9.0",
        engineVersion: "1.9.0-movement-commands",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.10.0",
        engineVersion: "1.10.0-timeline-state-clears",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.11.0",
        engineVersion: "1.11.0-target-hit-resolution",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.12.0",
        engineVersion: "1.12.0-target-effect-policy",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.13.0",
        engineVersion: "1.13.0-target-phase-timeline",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.14.0",
        engineVersion: "1.14.0-multi-target-registry",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.15.0",
        engineVersion: "1.15.0-aoe-fanout",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.16.0",
        engineVersion: "1.16.0-circle-geometry",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.17.0",
        engineVersion: "1.17.0-target-motion",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.18.0",
        engineVersion: "1.18.0-oriented-rectangle",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.19.0",
        engineVersion: "1.19.0-capsule-geometry",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.20.0",
        engineVersion: "1.20.0-sector-geometry",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.21.0",
        engineVersion: "1.21.0-actor-local-geometry",
        allowedMode: "aura-v1",
        futureMode: "aura-v2"
      },
      {
        schemaVersion: "1.22.0",
        engineVersion: "1.22.0-overload-reaction",
        allowedMode: "aura-v2",
        futureMode: "aura-v3"
      },
      {
        schemaVersion: "1.23.0",
        engineVersion: "1.23.0-superconduct-reaction",
        allowedMode: "aura-v2",
        futureMode: "aura-v3"
      },
      {
        schemaVersion: "1.24.0",
        engineVersion: "1.24.0-electro-charged-reaction",
        allowedMode: "aura-v2",
        futureMode: "aura-v3"
      },
      {
        schemaVersion: "1.25.0",
        engineVersion: "1.25.0-freeze-state",
        allowedMode: "aura-v2",
        futureMode: "aura-v3"
      },
      {
        schemaVersion: "1.26.0",
        engineVersion: "1.26.0-shatter-reaction",
        allowedMode: "aura-v2",
        futureMode: "aura-v3"
      },
      {
        schemaVersion: "1.27.0",
        engineVersion: "1.27.0-swirl-propagation",
        allowedMode: "aura-v2",
        futureMode: "aura-v3"
      },
      {
        schemaVersion: "1.28.0",
        engineVersion: "1.28.0-crystallize-shards",
        allowedMode: "aura-v2",
        futureMode: "aura-v3"
      },
      {
        schemaVersion: "1.29.0",
        engineVersion: "1.29.0-catalyze-reaction",
        allowedMode: "aura-v3",
        futureMode: "aura-v4"
      },
      {
        schemaVersion: "1.30.0",
        engineVersion: "1.30.0-burning-reaction",
        allowedMode: "aura-v4",
        futureMode: "aura-v5"
      }
    ] as const;

    const expectMigrationIssue = (
      migrate: () => unknown,
      expectedIssue: string
    ): void => {
      try {
        migrate();
        throw new Error("Expected migration to fail.");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigMigrationError);
        expect((error as ConfigMigrationError).issues).toContain(
          expectedIssue
        );
      }
    };

    for (const contract of contracts) {
      const validInput = {
        ...current,
        schemaVersion: contract.schemaVersion,
        engineVersion: contract.engineVersion,
        rotation: [],
        timeline: legalTimeline,
        ...(contract.allowedMode === null
          ? { reactionEngine: undefined }
          : {
              reactionEngine: {
                mode: contract.allowedMode
              }
            })
      };
      const migrated = migrateConfig(validInput);
      expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
      if (contract.allowedMode !== null) {
        expect(migrated.reactionEngine?.mode).toBe(
          contract.allowedMode
        );
      }

      expectMigrationIssue(
        () =>
          migrateConfig({
            ...validInput,
            engineVersion: `${contract.engineVersion}-forged`
          }),
        `engineVersion: schemaVersion "${contract.schemaVersion}" requires "${contract.engineVersion}"`
      );
      expectMigrationIssue(
        () =>
          migrateConfig({
            ...validInput,
            engineVersion: contract.engineVersion,
            reactionEngine: {
              mode: contract.futureMode
            }
          }),
        `reactionEngine.mode: schemaVersion "${contract.schemaVersion}" does not support "${contract.futureMode}"`
      );
    }

    expectMigrationIssue(
      () =>
        migrateConfig({
          ...current,
          schemaVersion: "1.28.0",
          engineVersion: "1.28.0-crystallize-shards",
          reactionEngine: { mode: "aura-v5" }
        }),
      'reactionEngine.mode: schemaVersion "1.28.0" does not support "aura-v5"'
    );
  });

  it("requires an auditable reason for a scripted miss", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [
          {
            id: "miss",
            actorId: "a",
            name: "未命中",
            at: 0,
            hits: [
              {
                id: "miss-hit",
                offset: 0,
                scaling: 1,
                targeting: {
                  targetId: "enemy-0",
                  outcome: "miss"
                }
              }
            ]
          }
        ]
      })
    ).toThrow(/rotation\.0\.hits\.0\.targeting\.reason/);
  });

  it("rejects a misleading reason on an explicitly landed hit", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [
          {
            id: "landed",
            actorId: "a",
            name: "命中",
            at: 0,
            hits: [
              {
                id: "landed-hit",
                offset: 0,
                scaling: 1,
                targeting: {
                  targetId: "enemy-0",
                  outcome: "landed",
                  reason: "should not exist"
                }
              }
            ]
          }
        ]
      })
    ).toThrow(/rotation\.0\.hits\.0\.targeting\.reason/);
  });

  it("rejects unregistered enemy target ids", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [
          {
            id: "fake-multitarget",
            actorId: "a",
            name: "伪多目标",
            at: 0,
            hits: [
              {
                id: "fake-second-target",
                offset: 0,
                scaling: 1,
                targeting: {
                  targetId: "enemy-1",
                  outcome: "miss",
                  reason: "UNSUPPORTED_SECOND_TARGET"
                }
              }
            ]
          }
        ]
      })
    ).toThrow(/rotation\.0\.hits\.0\.targeting\.targetId/);
  });

  it("accepts registered targets and overlapping phases on different targets", () => {
    const parsed = migrateConfig({
      ...legacyConfig,
      duration: 2,
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          { id: "enemy-0", name: "主目标" },
          {
            id: "enemy-1",
            name: "副目标",
            level: 100,
            resistance: 0.5,
            defReduction: 0.1
          }
        ],
        targetPhases: [
          {
            id: "main-window",
            label: "主目标窗口",
            targetId: "enemy-0",
            startFrame: 30,
            endFrame: 60,
            reason: "MAIN_WINDOW",
            effects: {
              damage: "immune",
              aura: "blocked",
              hitConfirm: "blocked"
            }
          },
          {
            id: "secondary-window",
            label: "副目标窗口",
            targetId: "enemy-1",
            startFrame: 30,
            endFrame: 60,
            reason: "SECONDARY_WINDOW",
            effects: {
              damage: "immune",
              aura: "normal",
              hitConfirm: "normal"
            }
          }
        ]
      },
      rotation: [
        {
          id: "secondary-hit",
          actorId: "a",
          name: "副目标命中",
          at: 0,
          hits: [
            {
              id: "secondary-hit-1",
              offset: 0,
              scaling: 1,
              targeting: {
                targetId: "enemy-1",
                outcome: "landed"
              }
            }
          ]
        }
      ]
    });

    expect(parsed.enemy.targets?.[1]).toMatchObject({
      id: "enemy-1",
      resistance: 0.5
    });
    expect(parsed.enemy.targetPhases).toHaveLength(2);
  });

  it("rejects target-specific initial Aura when the Aura engine is disabled", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        enemy: {
          ...legacyConfig.enemy,
          targets: [
            { id: "enemy-0", name: "主目标" },
            {
              id: "enemy-1",
              name: "副目标",
              initialAura: [{ element: "hydro", gaugeUnits: 1 }]
            }
          ]
        }
      })
    ).toThrow(/enemy\.targets\.1\.initialAura/);
  });

  it("accepts unique AoE fanout targets and rejects duplicates", () => {
    const input = {
      ...legacyConfig,
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          { id: "enemy-0", name: "主目标" },
          { id: "enemy-1", name: "副目标" }
        ]
      },
      rotation: [
        {
          id: "aoe",
          actorId: "a",
          name: "范围命中",
          at: 0,
          hits: [
            {
              id: "aoe-hit",
              offset: 0,
              scaling: 1,
              targeting: {
                mode: "fanout",
                targets: [
                  { targetId: "enemy-0", outcome: "landed" },
                  { targetId: "enemy-1", outcome: "landed" }
                ]
              }
            }
          ]
        }
      ]
    };
    const parsed = migrateConfig(input);
    expect(parsed.rotation[0]?.hits?.[0]?.targeting).toMatchObject({
      mode: "fanout",
      targets: [
        { targetId: "enemy-0" },
        { targetId: "enemy-1" }
      ]
    });

    const duplicate = structuredClone(input);
    duplicate.rotation[0]!.hits[0]!.targeting.targets[1]!.targetId =
      "enemy-0";
    expect(() => migrateConfig(duplicate)).toThrow(
      /targeting\.targets\.1\.targetId/
    );
  });

  it("accepts static circle geometry when every target has a position", () => {
    const parsed = migrateConfig({
      ...legacyConfig,
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "主目标",
            position: { x: 0, y: 0 },
            hitboxRadius: 0.5
          },
          {
            id: "enemy-1",
            name: "副目标",
            position: { x: 1.5, y: 0 },
            hitboxRadius: 0.5
          }
        ]
      },
      rotation: [
        {
          id: "circle",
          actorId: "a",
          name: "圆形范围",
          at: 0,
          hits: [
            {
              id: "circle-hit",
              offset: 0,
              scaling: 1,
              geometry: {
                kind: "circle",
                origin: { x: 0, y: 0 },
                radius: 1
              }
            }
          ]
        }
      ]
    });

    expect(parsed.enemy.targets?.[1]).toMatchObject({
      position: { x: 1.5, y: 0 },
      hitboxRadius: 0.5
    });
    expect(parsed.rotation[0]?.hits?.[0]?.geometry).toEqual({
      kind: "circle",
      origin: { x: 0, y: 0 },
      radius: 1
    });
  });

  it("accepts a rotated rectangle and rejects incomplete rectangle parameters", () => {
    const input = {
      ...legacyConfig,
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "矩形目标",
            position: { x: 0, y: 0 },
            hitboxRadius: 0.5
          }
        ]
      },
      rotation: [
        {
          id: "rectangle",
          actorId: "a",
          name: "矩形范围",
          at: 0,
          hits: [
            {
              id: "rectangle-hit",
              offset: 0,
              scaling: 1,
              geometry: {
                kind: "rectangle",
                origin: { x: 0, y: 0 },
                halfWidth: 2,
                halfHeight: 0.5,
                rotationDegrees: 45
              }
            }
          ]
        }
      ]
    };
    const parsed = migrateConfig(input);
    expect(parsed.rotation[0]?.hits?.[0]?.geometry).toEqual({
      kind: "rectangle",
      origin: { x: 0, y: 0 },
      halfWidth: 2,
      halfHeight: 0.5,
      rotationDegrees: 45
    });

    const invalid = structuredClone(input);
    invalid.rotation[0]!.hits[0]!.geometry.halfHeight = 0;
    expect(() => migrateConfig(invalid)).toThrow(
      /geometry\.halfHeight/
    );
  });

  it("accepts capsule geometry including a degenerate zero-length segment", () => {
    const parsed = migrateConfig({
      ...legacyConfig,
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "胶囊目标",
            position: { x: 0, y: 0 },
            hitboxRadius: 0.5
          }
        ]
      },
      rotation: [
        {
          id: "capsule",
          actorId: "a",
          name: "胶囊范围",
          at: 0,
          hits: [
            {
              id: "capsule-hit",
              offset: 0,
              scaling: 1,
              geometry: {
                kind: "capsule",
                start: { x: -1, y: 0 },
                end: { x: 2, y: 0 },
                radius: 0.5
              }
            },
            {
              id: "degenerate-capsule",
              offset: 0,
              scaling: 1,
              geometry: {
                kind: "capsule",
                start: { x: 0, y: 0 },
                end: { x: 0, y: 0 },
                radius: 1
              }
            }
          ]
        }
      ]
    });

    expect(parsed.rotation[0]?.hits?.[0]?.geometry).toEqual({
      kind: "capsule",
      start: { x: -1, y: 0 },
      end: { x: 2, y: 0 },
      radius: 0.5
    });
    expect(parsed.rotation[0]?.hits?.[1]?.geometry).toMatchObject({
      kind: "capsule",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 0 }
    });
  });

  it("accepts a filled sector geometry and rejects invalid angular bounds", () => {
    const input = {
      ...legacyConfig,
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "扇形目标",
            position: { x: 1, y: 0 },
            hitboxRadius: 0.25
          }
        ]
      },
      rotation: [
        {
          id: "sector",
          actorId: "a",
          name: "扇形范围",
          at: 0,
          hits: [
            {
              id: "sector-hit",
              offset: 0,
              scaling: 1,
              geometry: {
                kind: "sector",
                origin: { x: 0, y: 0 },
                radius: 2,
                directionDegrees: 45,
                angleDegrees: 90
              }
            }
          ]
        }
      ]
    };

    const parsed = migrateConfig(input);
    expect(parsed.rotation[0]?.hits?.[0]?.geometry).toEqual({
      kind: "sector",
      origin: { x: 0, y: 0 },
      radius: 2,
      directionDegrees: 45,
      angleDegrees: 90
    });

    const invalidAngle = structuredClone(input);
    invalidAngle.rotation[0]!.hits[0]!.geometry.angleDegrees = 0;
    expect(() => migrateConfig(invalidAngle)).toThrow(
      /geometry\.angleDegrees/
    );

    const invalidDirection = structuredClone(input);
    invalidDirection.rotation[0]!.hits[0]!.geometry.directionDegrees =
      360.1;
    expect(() => migrateConfig(invalidDirection)).toThrow(
      /geometry\.directionDegrees/
    );
  });

  it("validates static actor poses required by actor-local geometry", () => {
    const input = {
      ...legacyConfig,
      actorPoses: [
        {
          actorId: "a",
          position: { x: 10, y: 20 },
          facingDegrees: 90
        }
      ],
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "局部坐标目标",
            position: { x: 10, y: 21 },
            hitboxRadius: 0
          }
        ]
      },
      rotation: [
        {
          id: "actor-local",
          actorId: "a",
          name: "施放者局部范围",
          at: 0,
          hits: [
            {
              id: "actor-local-hit",
              offset: 0,
              scaling: 1,
              geometry: {
                kind: "circle",
                coordinateSpace: "actor-local",
                origin: { x: 1, y: 0 },
                radius: 0.1
              }
            }
          ]
        }
      ]
    };

    const parsed = migrateConfig(input);
    expect(parsed.actorPoses).toEqual(input.actorPoses);
    expect(
      parsed.rotation[0]?.hits?.[0]?.geometry?.coordinateSpace
    ).toBe("actor-local");

    const missingPose = structuredClone(input);
    missingPose.actorPoses.length = 0;
    expect(() => migrateConfig(missingPose)).toThrow(
      /geometry\.coordinateSpace: actor-local geometry requires an actorPoses entry/
    );

    const duplicatePose = structuredClone(input);
    duplicatePose.actorPoses.push({
      actorId: "a",
      position: { x: 0, y: 0 },
      facingDegrees: 0
    });
    expect(() => migrateConfig(duplicatePose)).toThrow(
      /actorPoses\.1\.actorId: duplicate actor pose/
    );

    const unknownPose = structuredClone(input);
    unknownPose.actorPoses[0]!.actorId = "missing";
    expect(() => migrateConfig(unknownPose)).toThrow(
      /actorPoses\.0\.actorId: unknown character id/
    );
  });

  it("requires complete target positions and one hit-resolution source for geometry", () => {
    const base = {
      ...legacyConfig,
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "主目标",
            position: { x: 0, y: 0 }
          },
          { id: "enemy-1", name: "缺少位置" }
        ]
      },
      rotation: [
        {
          id: "circle",
          actorId: "a",
          name: "圆形范围",
          at: 0,
          hits: [
            {
              id: "circle-hit",
              offset: 0,
              scaling: 1,
              geometry: {
                kind: "circle",
                origin: { x: 0, y: 0 },
                radius: 1
              }
            }
          ]
        }
      ]
    };

    expect(() => migrateConfig(base)).toThrow(
      /requires enemy\.targets and a position for every registered target/
    );

    const conflicting = structuredClone(base);
    conflicting.enemy.targets[1]!.position = { x: 2, y: 0 };
    Object.assign(conflicting.rotation[0]!.hits[0]!, {
      targeting: {
        targetId: "enemy-0",
        outcome: "landed"
      }
    });
    expect(() => migrateConfig(conflicting)).toThrow(
      /cannot be combined with scripted targeting/
    );
  });

  it("accepts sorted adjacent target motions with explicit initial positions", () => {
    const parsed = migrateConfig({
      ...legacyConfig,
      duration: 2,
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "移动目标",
            position: { x: 0, y: 0 },
            hitboxRadius: 0.5
          }
        ],
        targetMotions: [
          {
            id: "outbound",
            label: "向外移动",
            targetId: "enemy-0",
            startFrame: 0,
            endFrame: 60,
            endPosition: { x: 2, y: 0 }
          },
          {
            id: "return",
            label: "返回",
            targetId: "enemy-0",
            startFrame: 60,
            endFrame: 120,
            endPosition: { x: 0, y: 0 }
          }
        ]
      }
    });

    expect(parsed.enemy.targetMotions).toHaveLength(2);
    expect(parsed.enemy.targetMotions?.[1]).toMatchObject({
      startFrame: 60,
      endFrame: 120,
      endPosition: { x: 0, y: 0 }
    });
  });

  it("rejects overlapping, unregistered, and positionless target motions", () => {
    const base = {
      ...legacyConfig,
      duration: 2,
      enemy: {
        ...legacyConfig.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "移动目标",
            position: { x: 0, y: 0 }
          }
        ],
        targetMotions: [
          {
            id: "first",
            label: "第一段",
            targetId: "enemy-0",
            startFrame: 0,
            endFrame: 60,
            endPosition: { x: 2, y: 0 }
          },
          {
            id: "overlap",
            label: "重叠段",
            targetId: "enemy-0",
            startFrame: 59,
            endFrame: 120,
            endPosition: { x: 0, y: 0 }
          }
        ]
      }
    };
    expect(() => migrateConfig(base)).toThrow(
      /target motions must be sorted and non-overlapping/
    );

    const unregistered = structuredClone(base);
    unregistered.enemy.targetMotions = [
      {
        ...unregistered.enemy.targetMotions[0]!,
        targetId: "enemy-1"
      }
    ];
    expect(() => migrateConfig(unregistered)).toThrow(
      /unknown enemy target id "enemy-1"/
    );

    const positionless = structuredClone(base);
    positionless.enemy.targets = [
      { id: "enemy-0", name: "移动目标" }
    ] as typeof positionless.enemy.targets;
    positionless.enemy.targetMotions = [
      positionless.enemy.targetMotions[0]!
    ];
    expect(() => migrateConfig(positionless)).toThrow(
      /requires an initial position/
    );

    const outOfBounds = structuredClone(base);
    outOfBounds.duration = 1;
    outOfBounds.enemy.targetMotions = [
      {
        ...outOfBounds.enemy.targetMotions[0]!,
        endFrame: 61
      }
    ];
    expect(() => migrateConfig(outOfBounds)).toThrow(
      /targetMotions\.0\.endFrame: must not exceed simulation duration/
    );
  });

  it("requires a reason and at least one change for target effect policies", () => {
    const base = {
      ...legacyConfig,
      rotation: [
        {
          id: "effect-policy",
          actorId: "a",
          name: "目标策略",
          at: 0,
          hits: [
            {
              id: "policy-hit",
              offset: 0,
              scaling: 1,
              targeting: {
                targetId: "enemy-0",
                outcome: "landed",
                effects: {
                  damage: "immune",
                  aura: "blocked",
                  hitConfirm: "blocked"
                }
              }
            }
          ]
        }
      ]
    };

    expect(() => migrateConfig(base)).toThrow(
      /rotation\.0\.hits\.0\.targeting\.reason/
    );
    const withReason = structuredClone(base);
    Object.assign(withReason.rotation[0]!.hits[0]!.targeting, {
      reason: "SCRIPTED_INVULNERABLE_PHASE"
    });
    withReason.rotation[0]!.hits[0]!.targeting.effects = {
      damage: "normal",
      aura: "normal",
      hitConfirm: "normal"
    };
    expect(() => migrateConfig(withReason)).toThrow(
      /rotation\.0\.hits\.0\.targeting\.effects/
    );
  });

  it("accepts an explicit landed target effect policy", () => {
    const parsed = migrateConfig({
      ...legacyConfig,
      rotation: [
        {
          id: "effect-policy",
          actorId: "a",
          name: "目标策略",
          at: 0,
          hits: [
            {
              id: "policy-hit",
              offset: 0,
              scaling: 1,
              targeting: {
                targetId: "enemy-0",
                outcome: "landed",
                reason: "SCRIPTED_INVULNERABLE_PHASE",
                effects: {
                  damage: "immune",
                  aura: "blocked",
                  hitConfirm: "blocked"
                }
              }
            }
          ]
        }
      ]
    });

    expect(parsed.rotation[0]?.hits?.[0]?.targeting).toMatchObject({
      outcome: "landed",
      reason: "SCRIPTED_INVULNERABLE_PHASE",
      effects: {
        damage: "immune",
        aura: "blocked",
        hitConfirm: "blocked"
      }
    });
  });

  it("accepts sorted half-open target phases within the simulation", () => {
    const parsed = migrateConfig({
      ...legacyConfig,
      duration: 2,
      enemy: {
        ...legacyConfig.enemy,
        targetPhases: [
          {
            id: "damage-window",
            label: "伤害免疫窗口",
            targetId: "enemy-0",
            startFrame: 30,
            endFrame: 60,
            reason: "SCRIPTED_DAMAGE_WINDOW",
            effects: {
              damage: "immune",
              aura: "normal",
              hitConfirm: "normal"
            }
          },
          {
            id: "full-window",
            label: "全层阻断窗口",
            targetId: "enemy-0",
            startFrame: 60,
            endFrame: 90,
            reason: "SCRIPTED_FULL_WINDOW",
            effects: {
              damage: "immune",
              aura: "blocked",
              hitConfirm: "blocked"
            }
          }
        ]
      }
    });

    expect(parsed.enemy.targetPhases).toHaveLength(2);
    expect(parsed.enemy.targetPhases?.[1]).toMatchObject({
      id: "full-window",
      startFrame: 60,
      endFrame: 90
    });
  });

  it("rejects overlapping or out-of-duration target phases", () => {
    const phase = {
      id: "phase-a",
      label: "阶段 A",
      targetId: "enemy-0",
      startFrame: 30,
      endFrame: 61,
      reason: "SCRIPTED_PHASE_A",
      effects: {
        damage: "immune",
        aura: "blocked",
        hitConfirm: "blocked"
      }
    };
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        duration: 2,
        enemy: {
          ...legacyConfig.enemy,
          targetPhases: [
            phase,
            {
              ...phase,
              id: "phase-b",
              startFrame: 60,
              endFrame: 90
            }
          ]
        }
      })
    ).toThrow(/enemy\.targetPhases\.1\.startFrame/);

    expect(() =>
      migrateConfig({
        ...legacyConfig,
        duration: 1,
        enemy: {
          ...legacyConfig.enemy,
          targetPhases: [phase]
        }
      })
    ).toThrow(/enemy\.targetPhases\.0\.endFrame/);
  });

  it("requires positive explicit occupancy for dash and jump commands", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [],
        timeline: {
          mode: "legal-frame-v1",
          fps: 60,
          legalityMode: "strict",
          initialActiveCharacterId: "a",
          swapFrames: 12,
          abilities: [],
          commands: [{ type: "dash", actorId: "a", frames: 0 }]
        }
      })
    ).toThrow(/timeline\.commands\.0\.frames/);
  });

  it("rejects a hit-confirm particle that names an unknown action hit", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [
          {
            id: "trigger",
            actorId: "a",
            name: "命中产球",
            at: 0,
            hits: [
              {
                id: "known-hit",
                offset: 0,
                scaling: 1,
                element: "pyro"
              }
            ],
            particles: [
              {
                id: "triggered-particle",
                element: "pyro",
                count: 1,
                travelTime: 0,
                trigger: {
                  kind: "hit-confirm",
                  hitIds: ["missing-hit"]
                }
              }
            ]
          }
        ]
      })
    ).toThrow(
      /rotation\.0\.particles\.0\.trigger\.hitIds\.0: unknown action hit id "missing-hit"/
    );
  });

  it("rejects a fixed spawn offset on a hit-confirm particle", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [
          {
            id: "trigger",
            actorId: "a",
            name: "命中产球",
            at: 0,
            hits: [
              {
                id: "hit",
                offset: 0,
                scaling: 1,
                element: "pyro"
              }
            ],
            particles: [
              {
                id: "triggered-particle",
                element: "pyro",
                count: 1,
                spawnOffset: 0,
                travelTime: 0,
                trigger: {
                  kind: "hit-confirm",
                  hitIds: ["hit"]
                }
              }
            ]
          }
        ]
      })
    ).toThrow(
      /rotation\.0\.particles\.0\.spawnOffset: must be omitted for hit-confirm particle triggers/
    );
  });

  it("does not allow custom profiles to replace built-in ICD semantics", () => {
    for (const builtIn of ["default", "no-icd", "burning"]) {
      expect(() =>
        migrateConfig({
          ...legacyConfig,
          rotation: [],
          reactionEngine: {
            mode: "aura-v1",
            icdProfiles: {
              [builtIn]: {
                resetFrames: 1,
                applicationSequence: [true]
              }
            }
          },
          timeline: {
            mode: "legal-frame-v1",
            fps: 60,
            legalityMode: "strict",
            initialActiveCharacterId: "a",
            swapFrames: 12,
            abilities: [],
            commands: []
          }
        })
      ).toThrow(new RegExp(`"${builtIn}" is a built-in ICD group`));
    }
  });

  it("requires an explicit debug flag for reactionOverride", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [],
        reactionEngine: { mode: "aura-v1" },
        timeline: {
          mode: "legal-frame-v1",
          fps: 60,
          legalityMode: "strict",
          initialActiveCharacterId: "a",
          swapFrames: 12,
          abilities: [
            {
              id: "debug-hit",
              actorId: "a",
              name: "debug",
              kind: "skill",
              cancelFrame: 1,
              animationEndFrame: 1,
              cooldownFrames: 0,
              hits: [
                {
                  frame: 0,
                  scaling: 1,
                  element: "pyro",
                  reactionOverride: "melt"
                }
              ]
            }
          ],
          commands: [
            {
              type: "skill",
              actorId: "a",
              abilityId: "debug-hit"
            }
          ]
        }
      })
    ).toThrow(/debugAllowReactionOverride=true/);
  });

  it("validates discrete particle ranges with a precise field path", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [
          {
            id: "particles",
            actorId: "a",
            name: "粒子",
            at: 0,
            particles: [
              {
                element: "pyro",
                count: { min: 2, max: 4, step: 0.7 },
                travelTime: 0
              }
            ]
          }
        ]
      })
    ).toThrow(/rotation\.0\.particles\.0\.count\.step/);
  });

  it("requires every consumed action state to be declared as required", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [],
        timeline: {
          mode: "legal-frame-v1",
          fps: 60,
          legalityMode: "strict",
          initialActiveCharacterId: "a",
          swapFrames: 12,
          abilities: [
            {
              id: "bad-state",
              actorId: "a",
              name: "坏状态定义",
              kind: "skill",
              cancelFrame: 1,
              animationEndFrame: 1,
              cooldownFrames: 0,
              timelineState: {
                consumes: ["missing-requirement"]
              }
            }
          ],
          commands: []
        }
      })
    ).toThrow(
      /timeline\.abilities\.0\.timelineState\.consumes\.0: consumed state/
    );
  });

  it("accepts energy-gated state transitions for runtime rollback", () => {
    const parsed = migrateConfig({
      ...legacyConfig,
      rotation: [],
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [
          {
            id: "energy-burst-state",
            actorId: "a",
            name: "能量爆发状态",
            kind: "burst",
            cancelFrame: 1,
            animationEndFrame: 1,
            cooldownFrames: 600,
            energyCost: 60,
            timelineState: {
              grants: [
                {
                  key: "burst-active",
                  label: "爆发状态",
                  durationFrames: 60
                }
              ]
            }
          }
        ],
        commands: []
      }
    });

    expect(parsed.timeline?.abilities[0]).toMatchObject({
      energyCost: 60,
      timelineState: {
        grants: [
          {
            key: "burst-active",
            durationFrames: 60
          }
        ]
      }
    });
  });

  it("rejects a followup cancel after the animation end", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [],
        timeline: {
          mode: "legal-frame-v1",
          fps: 60,
          legalityMode: "strict",
          initialActiveCharacterId: "a",
          swapFrames: 12,
          abilities: [
            {
              id: "bad-cancel",
              actorId: "a",
              name: "坏取消帧",
              kind: "skill",
              cancelFrame: 1,
              cancelFrames: {
                burst: 11
              },
              animationEndFrame: 10,
              cooldownFrames: 0
            }
          ],
          commands: []
        }
      })
    ).toThrow(
      /timeline\.abilities\.0\.cancelFrames\.burst: must not exceed animationEndFrame/
    );
  });

  it("rejects a non-positive fixed-energy internal cooldown", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [],
        timeline: {
          mode: "legal-frame-v1",
          fps: 60,
          legalityMode: "strict",
          initialActiveCharacterId: "a",
          swapFrames: 12,
          abilities: [
            {
              id: "bad-energy-icd",
              actorId: "a",
              name: "坏回能 ICD",
              kind: "skill",
              cancelFrame: 1,
              animationEndFrame: 1,
              cooldownFrames: 0,
              energyGains: [
                {
                  target: "a",
                  amount: 5,
                  internalCooldown: {
                    key: "bad",
                    durationFrames: 0
                  }
                }
              ]
            }
          ],
          commands: []
        }
      })
    ).toThrow(
      /timeline\.abilities\.0\.energyGains\.0\.internalCooldown\.durationFrames/
    );
  });

  it("rejects parties larger than the in-game four-character limit", () => {
    expect(() =>
      migrateConfig({
        ...legacyConfig,
        characters: Array.from({ length: 5 }, (_, index) => ({
          ...legacyConfig.characters[0],
          id: `character-${index}`
        }))
      })
    ).toThrow(/characters: Genshin parties support at most four characters/);
  });

  it("gates Electro Aura behind aura-v2", () => {
    const current = migrateConfig(legacyConfig);
    const withTimeline = {
      ...current,
      rotation: [],
      timeline: {
        mode: "legal-frame-v1" as const,
        fps: 60 as const,
        legalityMode: "strict" as const,
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [],
        commands: []
      }
    };

    expect(() =>
      migrateConfig({
        ...withTimeline,
        reactionEngine: {
          mode: "aura-v1",
          initialAura: [{ element: "electro", gaugeUnits: 1 }]
        }
      })
    ).toThrow(/electro aura requires reactionEngine\.mode to be aura-v2/);

    const parsed = migrateConfig({
      ...withTimeline,
      reactionEngine: {
        mode: "aura-v2",
        initialAura: [{ element: "electro", gaugeUnits: 1 }]
      },
      timeline: {
        ...withTimeline.timeline,
        abilities: [
          {
            id: "electro-hit",
            actorId: "a",
            name: "雷附着",
            kind: "skill",
            cancelFrame: 1,
            animationEndFrame: 1,
            cooldownFrames: 0,
            hits: [
              {
                id: "electro-hit-1",
                frame: 0,
                scaling: 1,
                element: "electro",
                application: {
                  gaugeUnits: 1,
                  icdTag: "electro",
                  icdGroup: "no-icd"
                }
              }
            ]
          }
        ]
      }
    });
    expect(parsed.reactionEngine).toEqual({
      mode: "aura-v2",
      initialAura: [{ element: "electro", gaugeUnits: 1 }]
    });
    expect(
      parsed.timeline?.abilities[0]?.hits?.[0]?.element
    ).toBe("electro");
  });

  it("accepts Anemo applications only in aura-v2", () => {
    const current = migrateConfig(legacyConfig);
    const withAnemoApplication = {
      ...current,
      rotation: [],
      timeline: {
        mode: "legal-frame-v1" as const,
        fps: 60 as const,
        legalityMode: "strict" as const,
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [
          {
            id: "anemo-hit",
            actorId: "a",
            name: "风附着",
            kind: "skill" as const,
            cancelFrame: 1,
            animationEndFrame: 1,
            cooldownFrames: 0,
            hits: [
              {
                id: "anemo-hit-1",
                frame: 0,
                scaling: 1,
                element: "anemo" as const,
                application: {
                  gaugeUnits: 1,
                  icdTag: "anemo",
                  icdGroup: "no-icd" as const
                }
              }
            ]
          }
        ],
        commands: []
      }
    };

    expect(() =>
      migrateConfig({
        ...withAnemoApplication,
        reactionEngine: { mode: "aura-v1" }
      })
    ).toThrow(
      /aura-v1 elemental applications currently support only pyro, cryo, and hydro hits/
    );

    const parsed = migrateConfig({
      ...withAnemoApplication,
      reactionEngine: { mode: "aura-v2" }
    });
    expect(
      parsed.timeline?.abilities[0]?.hits?.[0]?.application
        ?.gaugeUnits
    ).toBe(1);
  });

  it("accepts Geo applications only in aura-v2 and validates shard pickup commands", () => {
    const current = migrateConfig(legacyConfig);
    const withGeoApplication = {
      ...current,
      rotation: [],
      timeline: {
        mode: "legal-frame-v1" as const,
        fps: 60 as const,
        legalityMode: "strict" as const,
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [
          {
            id: "geo-hit",
            actorId: "a",
            name: "岩附着",
            kind: "skill" as const,
            cancelFrame: 1,
            animationEndFrame: 1,
            cooldownFrames: 0,
            hits: [
              {
                id: "geo-hit-1",
                frame: 0,
                scaling: 1,
                element: "geo" as const,
                application: {
                  gaugeUnits: 1,
                  icdTag: "geo",
                  icdGroup: "no-icd" as const
                }
              }
            ]
          }
        ],
        commands: [
          {
            type: "pickUpCrystallize" as const,
            element: "any" as const,
            atFrame: 54
          }
        ]
      }
    };

    expect(() =>
      migrateConfig({
        ...withGeoApplication,
        reactionEngine: { mode: "aura-v1" }
      })
    ).toThrow(
      /aura-v1 elemental applications currently support only pyro, cryo, and hydro hits/
    );

    const parsed = migrateConfig({
      ...withGeoApplication,
      reactionEngine: { mode: "aura-v2" }
    });
    expect(parsed.timeline?.commands).toEqual([
      {
        type: "pickUpCrystallize",
        element: "any",
        atFrame: 54
      }
    ]);
    expect(
      parsed.timeline?.abilities[0]?.hits?.[0]?.application
        ?.gaugeUnits
    ).toBe(1);
  });

  it("migrates the actor-pose schema into the Overload schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...current,
      schemaVersion: "1.21.0",
      engineVersion: "1.21.0-actor-local-geometry"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Overload schema into the Superconduct schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...current,
      schemaVersion: "1.22.0",
      engineVersion: "1.22.0-overload-reaction"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Superconduct schema into the Electro-Charged schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...current,
      schemaVersion: "1.23.0",
      engineVersion: "1.23.0-superconduct-reaction"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Electro-Charged schema into the Frozen-state schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...current,
      schemaVersion: "1.24.0",
      engineVersion: "1.24.0-electro-charged-reaction"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Frozen-state schema into the Shatter schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...current,
      schemaVersion: "1.25.0",
      engineVersion: "1.25.0-freeze-state"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Shatter schema into the Swirl propagation schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...current,
      schemaVersion: "1.26.0",
      engineVersion: "1.26.0-shatter-reaction"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Swirl propagation schema into the Crystallize shard schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...current,
      schemaVersion: "1.27.0",
      engineVersion: "1.27.0-swirl-propagation"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Crystallize shard schema into the Catalyze schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...current,
      schemaVersion: "1.28.0",
      engineVersion: "1.28.0-crystallize-shards"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Catalyze schema without silently opting aura-v3 into Burning", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...current,
      schemaVersion: "1.29.0",
      engineVersion: "1.29.0-catalyze-reaction",
      rotation: [],
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [],
        commands: []
      },
      reactionEngine: {
        mode: "aura-v3",
        initialAura: [{ element: "dendro", gaugeUnits: 1 }]
      }
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
    expect(migrated.reactionEngine).toEqual({
      mode: "aura-v3",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }]
    });

    for (const engineVersion of [
      undefined,
      "1.29.0-catalyze-reaction-unknown"
    ]) {
      expect(() =>
        migrateConfig({
          ...current,
          schemaVersion: "1.29.0",
          engineVersion
        })
      ).toThrow(
        /schemaVersion "1\.29\.0" requires "1\.29\.0-catalyze-reaction"/
      );
    }

    expect(() =>
      migrateConfig({
        ...current,
        schemaVersion: "1.29.0",
        engineVersion: "1.29.0-catalyze-reaction",
        reactionEngine: {
          mode: "aura-v4"
        }
      })
    ).toThrow(
      /reactionEngine\.mode: schemaVersion "1\.29\.0" does not support "aura-v4"/
    );
  });

  it("migrates 1.30 Burning configs without silently opting aura-v4 into Dendro cores", () => {
    const current = migrateConfig(legacyConfig);
    const oldReactionEngine = {
      mode: "aura-v4" as const,
      initialAura: [{ element: "dendro" as const, gaugeUnits: 1 }],
      icdProfiles: {
        custom: {
          resetFrames: 60,
          applicationSequence: [true, false]
        }
      }
    };
    const migrated = migrateConfig({
      ...current,
      schemaVersion: BURNING_REACTION_SCHEMA_VERSION,
      engineVersion: BURNING_REACTION_ENGINE_VERSION,
      randomSeed: "burning-seed",
      rotation: [],
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [],
        commands: []
      },
      reactionEngine: oldReactionEngine
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
    expect(migrated.randomSeed).toBe("burning-seed");
    expect(migrated.reactionEngine).toEqual(oldReactionEngine);

    expect(() =>
      migrateConfig({
        ...current,
        schemaVersion: BURNING_REACTION_SCHEMA_VERSION,
        engineVersion: "1.30.0-forged"
      })
    ).toThrow(
      /schemaVersion "1\.30\.0" requires "1\.30\.0-burning-reaction"/
    );

    expect(() =>
      migrateConfig({
        ...current,
        schemaVersion: BURNING_REACTION_SCHEMA_VERSION,
        engineVersion: BURNING_REACTION_ENGINE_VERSION,
        reactionEngine: { mode: "aura-v5" }
      })
    ).toThrow(
      /schemaVersion "1\.30\.0" does not support "aura-v5"/
    );

    expect(() =>
      migrateConfig({
        ...current,
        schemaVersion: "1.29.0",
        engineVersion: "1.29.0-catalyze-reaction",
        reactionEngine: { mode: "aura-v5" }
      })
    ).toThrow(
      /schemaVersion "1\.29\.0" does not support "aura-v5"/
    );
    expect(() =>
      migrateConfig({
        ...current,
        schemaVersion: "1.28.0",
        engineVersion: "1.28.0-target-motion",
        reactionEngine: { mode: "aura-v5" }
      })
    ).toThrow(
      /schemaVersion "1\.28\.0" does not support "aura-v5"/
    );
  });

  it("requires legal, positioned, explicit-geometry inputs for aura-v5", () => {
    const current = migrateConfig(legacyConfig);
    const ability = {
      id: "pyro-core-contact",
      actorId: "a",
      name: "Pyro core contact",
      kind: "skill" as const,
      cancelFrame: 1,
      animationEndFrame: 1,
      cooldownFrames: 0,
      hits: [
        {
          id: "pyro-core-contact-hit",
          frame: 0,
          scaling: 1,
          element: "pyro" as const,
          application: {
            gaugeUnits: 1,
            icdTag: "pyro",
            icdGroup: "no-icd"
          },
          geometry: {
            kind: "circle" as const,
            coordinateSpace: "world" as const,
            origin: { x: 0, y: 0 },
            radius: 3
          }
        }
      ]
    };
    const validV5 = {
      ...current,
      rotation: [],
      enemy: {
        ...current.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "Positioned target",
            position: { x: 0, y: 0 }
          }
        ]
      },
      timeline: {
        mode: "legal-frame-v1" as const,
        fps: 60 as const,
        legalityMode: "strict" as const,
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [ability],
        commands: []
      },
      reactionEngine: { mode: "aura-v5" as const }
    };

    expect(migrateConfig(validV5).reactionEngine?.mode).toBe(
      "aura-v5"
    );
    expect(() =>
      migrateConfig({ ...validV5, timeline: undefined })
    ).toThrow(/require timeline\.mode legal-frame-v1/);
    expect(() =>
      migrateConfig({
        ...validV5,
        enemy: { ...current.enemy, targets: undefined }
      })
    ).toThrow(/aura-v5 requires enemy\.targets/);
    expect(() =>
      migrateConfig({
        ...validV5,
        enemy: {
          ...current.enemy,
          targets: [{ id: "enemy-0", name: "No position" }]
        }
      })
    ).toThrow(/aura-v5 requires a position/);
    expect(() =>
      migrateConfig({
        ...validV5,
        timeline: {
          ...validV5.timeline,
          abilities: [
            {
              ...ability,
              hits: [
                {
                  ...ability.hits[0],
                  geometry: undefined
                }
              ]
            }
          ]
        }
      })
    ).toThrow(
      /aura-v5 Pyro\/Electro elemental applications require explicit geometry/
    );
    expect(() =>
      migrateConfig({
        ...validV5,
        timeline: {
          ...validV5.timeline,
          abilities: [
            {
              ...ability,
              hits: [
                {
                  ...ability.hits[0],
                  element: undefined,
                  geometry: undefined
                }
              ]
            }
          ]
        }
      })
    ).toThrow(
      /aura-v5 Pyro\/Electro elemental applications require explicit geometry/
    );

    const dendroWithoutGeometry = {
      ...ability,
      hits: [
        {
          ...ability.hits[0],
          element: "dendro" as const,
          geometry: undefined
        }
      ]
    };
    expect(
      migrateConfig({
        ...validV5,
        timeline: {
          ...validV5.timeline,
          abilities: [dendroWithoutGeometry]
        }
      }).timeline?.abilities[0]?.hits?.[0]?.element
    ).toBe("dendro");
  });

  it("strictly validates Quicken attach-operation snapshots", () => {
    const operationAuraBefore: Array<{
      element: "quicken";
      gaugeUnits: number;
      expiresAtFrame: number;
    }> = [];
    const operationAuraAfter = [
      {
        element: "quicken" as const,
        gaugeUnits: 0.8,
        expiresAtFrame: 600
      }
    ];
    const started = {
      reaction: "quicken",
      triggerElement: "electro",
      consumedAuraElement: "dendro",
      sourceGaugeUnitsBefore: 1,
      sourceGaugeUnitsSpent: 0.8,
      sourceGaugeUnitsAfter: 0.2,
      auraGaugeUnitsBefore: 0.8,
      auraConsumedGaugeUnits: 0.8,
      auraGaugeUnitsAfter: 0,
      quickenGaugeUnitsBefore: 0,
      candidateGaugeUnits: 0.8,
      quickenGaugeUnitsAfter: 0.8,
      operation: "start",
      generation: 1,
      decayPerFrameBefore: 0,
      expiresAtFrameBefore: null,
      endCauseBefore: null,
      decayPerFrame: 0.8 / 600,
      expiresAtFrame: 600,
      endCause: "QUICKEN_DECAY",
      operationAuraBefore,
      operationAuraAfter,
      pendingHydroBloomFollowup: false
    };
    expect(quickenReactionAuditSchema.parse(started)).toEqual(
      started
    );
    expect(() =>
      quickenReactionAuditSchema.parse({
        ...started,
        consumedAuraElement: "electro"
      })
    ).toThrow(/opposite Dendro\/Electro Aura/);
    expect(() =>
      quickenReactionAuditSchema.parse({
        ...started,
        sourceGaugeUnitsSpent: 0.7,
        sourceGaugeUnitsAfter: 0.3,
        auraConsumedGaugeUnits: 0.7,
        auraGaugeUnitsAfter: 0.1
      })
    ).toThrow(/maximum shared incoming\/opposing Gauge budget/);
    expect(() =>
      quickenReactionAuditSchema.parse({
        ...started,
        pendingHydroBloomFollowup: true
      })
    ).toThrow(/must match retained Hydro/);
    expect(() =>
      quickenReactionAuditSchema.parse({
        ...started,
        operationAuraAfter: [
          ...operationAuraBefore,
          {
            element: "quicken",
            gaugeUnits: 0.7,
            expiresAtFrame: 600
          }
        ]
      })
    ).toThrow(/Gauge must match the scalar audit/);
    expect(() =>
      quickenReactionAuditSchema.parse({
        ...started,
        operationAuraAfter: [
          {
            element: "dendro",
            gaugeUnits: 0.1,
            expiresAtFrame: 300
          },
          operationAuraAfter[0]
        ]
      })
    ).toThrow(/cannot mutate non-Quicken Aura state/);

    const unchanged = {
      ...started,
      sourceGaugeUnitsBefore: 0.4,
      sourceGaugeUnitsSpent: 0.4,
      sourceGaugeUnitsAfter: 0,
      auraGaugeUnitsBefore: 0.4,
      auraConsumedGaugeUnits: 0.4,
      auraGaugeUnitsAfter: 0,
      quickenGaugeUnitsBefore: 0.8,
      candidateGaugeUnits: 0.4,
      operation: "unchanged",
      decayPerFrameBefore: 0.8 / 600,
      expiresAtFrameBefore: 600,
      endCauseBefore: "QUICKEN_DECAY",
      operationAuraBefore: operationAuraAfter,
      operationAuraAfter
    };
    expect(quickenReactionAuditSchema.parse(unchanged)).toEqual(
      unchanged
    );
    expect(() =>
      quickenReactionAuditSchema.parse({
        ...unchanged,
        candidateGaugeUnits: 0.8
      })
    ).toThrow(/strictly weaker candidate/);
    expect(() =>
      quickenReactionAuditSchema.parse({
        ...unchanged,
        operationAuraAfter: [
          ...operationAuraBefore,
          {
            element: "quicken",
            gaugeUnits: 0.8,
            expiresAtFrame: 601
          }
        ]
      })
    ).toThrow(/expiry must match the scalar audit|complete Aura snapshot/);
  });

  it("reconstructs Quicken lifecycle mutations from the state log", () => {
    const started = {
      id: 0,
      reaction: "quicken",
      generation: 1,
      operation: "start",
      frame: 0,
      timeSeconds: 0,
      targetId: "enemy-0",
      targetName: "Target",
      sourceActorId: "electro-owner",
      triggerDamageEventId: 7,
      triggerElement: "electro",
      consumedAuraElement: "dendro",
      candidateGaugeUnits: 0.8,
      quickenGaugeUnitsBefore: 0,
      quickenGaugeUnitsAfter: 0.8,
      decayPerFrameBefore: 0,
      decayPerFrameAfter: 0.8 / 600,
      expiresAtFrameBefore: null,
      auraBefore: [],
      auraAfter: [
        {
          element: "quicken",
          gaugeUnits: 0.8,
          expiresAtFrame: 600
        }
      ],
      expiresAtFrame: 600,
      endCauseBefore: null,
      endCauseAfter: "QUICKEN_DECAY",
      reason: null
    };
    expect(quickenStateLogEntrySchema.parse(started)).toEqual(
      started
    );

    const rebased = {
      ...started,
      id: 1,
      generation: 2,
      operation: "decay-rebase",
      frame: 10,
      timeSeconds: 10 / 60,
      sourceActorId: "dendro-owner",
      triggerDamageEventId: null,
      triggerElement: null,
      consumedAuraElement: null,
      candidateGaugeUnits: 0,
      quickenGaugeUnitsBefore: 0.8,
      decayPerFrameBefore: 0.8 / 600,
      expiresAtFrameBefore: 600,
      auraBefore: started.auraAfter,
      decayPerFrameAfter: 0.8 / 110,
      auraAfter: [
        {
          element: "quicken",
          gaugeUnits: 0.8,
          expiresAtFrame: 120
        }
      ],
      expiresAtFrame: 120,
      endCauseBefore: "QUICKEN_DECAY",
      endCauseAfter: "BURNING_FUEL_EXPIRED",
      reason: "BURNING_FUEL_REBASE"
    };
    expect(
      quickenStateLogEntrySchema.parse(rebased).operation
    ).toBe("decay-rebase");
    expect(() =>
      quickenStateLogEntrySchema.parse({
        ...rebased,
        endCauseAfter: null
      })
    ).toThrow(/active Quicken requires positive decay, expiry, and end cause/);
    expect(() =>
      quickenStateLogEntrySchema.parse({
        ...rebased,
        auraAfter: [
          ...rebased.auraAfter,
          {
            element: "hydro",
            gaugeUnits: 0.1,
            expiresAtFrame: 100
          }
        ]
      })
    ).toThrow(/cannot mutate non-Quicken Aura state/);
  });

  it("strictly validates Bloom gauge conservation and scheduling", () => {
    const hydroBloom = {
      reaction: "bloom",
      operation: "direct",
      triggerElement: "hydro",
      sourceActorId: "hydro-owner",
      triggerFrame: 10,
      sourceBudget: "incoming-application",
      sourceGaugeUnitsBefore: 1,
      sourceGaugeUnitsSpent: 1,
      sourceGaugeUnitsAfter: 0,
      hydroGaugeUnitsBefore: 0,
      hydroConsumedGaugeUnits: 0,
      hydroGaugeUnitsAfter: 0,
      dendroGaugeUnitsBefore: 1,
      dendroConsumedGaugeUnits: 0.5,
      dendroGaugeUnitsAfter: 0.5,
      quickenGaugeUnitsBefore: 0.5,
      quickenConsumedGaugeUnits: 0.5,
      quickenGaugeUnitsAfter: 0,
      quickenStateMutation: {
        operation: "remove",
        generationBefore: 1,
        generationAfter: 2,
        decayPerFrameBefore: 0.001,
        decayPerFrameAfter: 0,
        expiresAtFrameBefore: 510,
        expiresAtFrameAfter: null,
        endCauseBefore: "QUICKEN_DECAY",
        endCauseAfter: null,
        operationAuraBefore: [
          {
            element: "quicken",
            gaugeUnits: 0.5,
            expiresAtFrame: 510
          }
        ],
        operationAuraAfter: []
      },
      burningFuelGaugeUnitsBefore: 0.5,
      burningFuelConsumedGaugeUnits: 0.5,
      burningFuelGaugeUnitsAfter: 0,
      burningFuelStateMutation: {
        operation: "deplete-pending-purge",
        generation: 1,
        decayPerFrame: 1 / 150,
        expiresAtFrameBefore: 85,
        expiresAtFrameAfter: 11
      },
      scheduled: true,
      coreSpawnFrame: 40,
      coreSpawnDelayFrames: 30,
      blockedReason: null,
      mechanicsDataStatus: "fixed-gcsim-provisional",
      selfDamageStatus: "unsupported-player-damage-model"
    };
    expect(bloomReactionAuditSchema.parse(hydroBloom)).toEqual(
      hydroBloom
    );
    const partialFuelBloom = {
      ...hydroBloom,
      burningFuelGaugeUnitsBefore: 1,
      burningFuelConsumedGaugeUnits: 0.5,
      burningFuelGaugeUnitsAfter: 0.5,
      burningFuelStateMutation: {
        operation: "expiry-rebase",
        generation: 2,
        decayPerFrame: 1 / 150,
        expiresAtFrameBefore: 160,
        expiresAtFrameAfter: 85
      }
    };
    expect(
      bloomReactionAuditSchema.parse(partialFuelBloom)
        .burningFuelStateMutation.expiresAtFrameAfter
    ).toBe(85);
    expect(() =>
      bloomReactionAuditSchema.parse({
        ...partialFuelBloom,
        burningFuelStateMutation: {
          ...partialFuelBloom.burningFuelStateMutation,
          expiresAtFrameAfter: 86
        }
      })
    ).toThrow(/same decay and attachment grace/);
    expect(() =>
      bloomReactionAuditSchema.parse({
        ...hydroBloom,
        burningFuelStateMutation: {
          ...hydroBloom.burningFuelStateMutation,
          expiresAtFrameAfter: 12
        }
      })
    ).toThrow(/next-frame purge boundary/);
    expect(
      bloomReactionAuditSchema.parse({
        ...hydroBloom,
        sourceActorId: " hydro-owner "
      }).sourceActorId
    ).toBe(" hydro-owner ");
    expect(() =>
      bloomReactionAuditSchema.parse({
        ...hydroBloom,
        sourceGaugeUnitsSpent: 0.9,
        sourceGaugeUnitsAfter: 0.1
      })
    ).toThrow(/maximum normalized/);
    expect(() =>
      bloomReactionAuditSchema.parse({
        ...hydroBloom,
        sourceGaugeUnitsSpent: 0.02,
        sourceGaugeUnitsAfter: 0.98,
        dendroGaugeUnitsBefore: 2,
        dendroConsumedGaugeUnits: 0.01,
        dendroGaugeUnitsAfter: 1.99,
        quickenGaugeUnitsBefore: 2,
        quickenConsumedGaugeUnits: 0.01,
        quickenGaugeUnitsAfter: 1.99,
        burningFuelGaugeUnitsBefore: 2,
        burningFuelConsumedGaugeUnits: 0.01,
        burningFuelGaugeUnitsAfter: 1.99
      })
    ).toThrow(/must consume min/);
    expect(() =>
      bloomReactionAuditSchema.parse({
        ...hydroBloom,
        sourceGaugeUnitsBefore: 0,
        sourceGaugeUnitsSpent: 0,
        sourceGaugeUnitsAfter: 0,
        hydroGaugeUnitsBefore: 0,
        hydroConsumedGaugeUnits: 0,
        hydroGaugeUnitsAfter: 0,
        dendroGaugeUnitsBefore: 0,
        dendroConsumedGaugeUnits: 0,
        dendroGaugeUnitsAfter: 0,
        quickenGaugeUnitsBefore: 0,
        quickenConsumedGaugeUnits: 0,
        quickenGaugeUnitsAfter: 0,
        quickenStateMutation: {
          operation: "none",
          generationBefore: 0,
          generationAfter: 0,
          decayPerFrameBefore: 0,
          decayPerFrameAfter: 0,
          expiresAtFrameBefore: null,
          expiresAtFrameAfter: null,
          endCauseBefore: null,
          endCauseAfter: null,
          operationAuraBefore: [],
          operationAuraAfter: []
        },
        burningFuelGaugeUnitsBefore: 0,
        burningFuelConsumedGaugeUnits: 0,
        burningFuelGaugeUnitsAfter: 0,
        burningFuelStateMutation: {
          operation: "none",
          generation: null,
          decayPerFrame: 0,
          expiresAtFrameBefore: null,
          expiresAtFrameAfter: null
        }
      })
    ).toThrow(/actual source and opposing Gauge consumption/);
    expect(() =>
      bloomReactionAuditSchema.parse({
        ...hydroBloom,
        coreSpawnFrame: 41
      })
    ).toThrow(/triggerFrame \+ 30/);
    expect(() =>
      bloomReactionAuditSchema.parse({
        ...hydroBloom,
        uiDerivedDamage: 1
      })
    ).toThrow(/Unrecognized key/);
    const truncatedBloom = {
      ...hydroBloom,
      scheduled: false,
      coreSpawnFrame: null,
      blockedReason: "TARGET_MECHANICS_TRUNCATION"
    };
    expect(
      bloomReactionAuditSchema.parse(truncatedBloom)
    ).toEqual(truncatedBloom);
    expect(() =>
      bloomReactionAuditSchema.parse({
        ...truncatedBloom,
        coreSpawnFrame: 40
      })
    ).toThrow(/cannot retain a core spawn frame/);

    const dendroBloom = {
      ...hydroBloom,
      triggerElement: "dendro",
      sourceActorId: "dendro-owner",
      sourceGaugeUnitsSpent: 0.4,
      sourceGaugeUnitsAfter: 0.6,
      hydroGaugeUnitsBefore: 0.8,
      hydroConsumedGaugeUnits: 0.8,
      hydroGaugeUnitsAfter: 0,
      dendroGaugeUnitsBefore: 0.4,
      dendroConsumedGaugeUnits: 0,
      dendroGaugeUnitsAfter: 0.4,
      quickenGaugeUnitsBefore: 0,
      quickenConsumedGaugeUnits: 0,
      quickenGaugeUnitsAfter: 0,
      quickenStateMutation: {
        operation: "none",
        generationBefore: 2,
        generationAfter: 2,
        decayPerFrameBefore: 0,
        decayPerFrameAfter: 0,
        expiresAtFrameBefore: null,
        expiresAtFrameAfter: null,
        endCauseBefore: null,
        endCauseAfter: null,
        operationAuraBefore: [],
        operationAuraAfter: []
      },
      burningFuelGaugeUnitsBefore: 0,
      burningFuelConsumedGaugeUnits: 0,
      burningFuelGaugeUnitsAfter: 0,
      burningFuelStateMutation: {
        operation: "none",
        generation: null,
        decayPerFrame: 0,
        expiresAtFrameBefore: null,
        expiresAtFrameAfter: null
      }
    };
    expect(bloomReactionAuditSchema.parse(dendroBloom)).toEqual(
      dendroBloom
    );

    const quickenFollowup = {
      ...dendroBloom,
      operation: "quicken-followup",
      triggerElement: "electro",
      sourceActorId: "electro-owner",
      sourceBudget: "quicken-state",
      sourceGaugeUnitsBefore: 0.4,
      sourceGaugeUnitsSpent: 0.3,
      sourceGaugeUnitsAfter: 0.1,
      hydroGaugeUnitsBefore: 0.6,
      hydroConsumedGaugeUnits: 0.6,
      hydroGaugeUnitsAfter: 0,
      dendroGaugeUnitsBefore: 0,
      dendroGaugeUnitsAfter: 0,
      quickenGaugeUnitsBefore: 0.4,
      quickenConsumedGaugeUnits: 0.3,
      quickenGaugeUnitsAfter: 0.1,
      quickenStateMutation: {
        operation: "partial-consume",
        generationBefore: 1,
        generationAfter: 2,
        decayPerFrameBefore: 0.001,
        decayPerFrameAfter: 0.001,
        expiresAtFrameBefore: 410,
        expiresAtFrameAfter: 110,
        endCauseBefore: "QUICKEN_DECAY",
        endCauseAfter: "QUICKEN_DECAY",
        operationAuraBefore: [
          {
            element: "quicken",
            gaugeUnits: 0.4,
            expiresAtFrame: 410
          }
        ],
        operationAuraAfter: [
          {
            element: "quicken",
            gaugeUnits: 0.1,
            expiresAtFrame: 110
          }
        ]
      }
    };
    expect(
      bloomReactionAuditSchema.parse(quickenFollowup)
    ).toEqual(quickenFollowup);
    expect(() =>
      bloomReactionAuditSchema.parse({
        ...quickenFollowup,
        quickenStateMutation: {
          ...quickenFollowup.quickenStateMutation,
          operationAuraAfter: [
            {
              element: "quicken",
              gaugeUnits: 0.2,
              expiresAtFrame: 110
            }
          ]
        }
      })
    ).toThrow(/must match the audited Gauge and expiry/);
    expect(() =>
      bloomReactionAuditSchema.parse({
        ...quickenFollowup,
        quickenStateMutation: {
          ...quickenFollowup.quickenStateMutation,
          operationAuraBefore: [
            ...quickenFollowup.quickenStateMutation
              .operationAuraBefore,
            {
              element: "hydro",
              gaugeUnits: 0.6,
              expiresAtFrame: 610
            }
          ],
          operationAuraAfter: [
            ...quickenFollowup.quickenStateMutation
              .operationAuraAfter,
            {
              element: "hydro",
              gaugeUnits: 0.5,
              expiresAtFrame: 610
            }
          ]
        }
      })
    ).toThrow(/may only change the Quicken slot/);
    expect(() =>
      bloomReactionAuditSchema.parse({
        ...quickenFollowup,
        triggerElement: "hydro"
      })
    ).toThrow(/Dendro or Electro trigger/);
    expect(() =>
      bloomReactionAuditSchema.parse({
        ...quickenFollowup,
        quickenStateMutation: {
          ...quickenFollowup.quickenStateMutation,
          operation: "none"
        }
      })
    ).toThrow(/must be partial-consume/);
    expect(() =>
      bloomReactionAuditSchema.parse({
        ...quickenFollowup,
        quickenStateMutation: {
          ...quickenFollowup.quickenStateMutation,
          generationAfter: 1
        }
      })
    ).toThrow(/advance the generation exactly once/);
    expect(() =>
      bloomReactionAuditSchema.parse({
        ...quickenFollowup,
        quickenStateMutation: {
          ...quickenFollowup.quickenStateMutation,
          expiresAtFrameAfter: 111,
          operationAuraAfter: [
            {
              element: "quicken",
              gaugeUnits: 0.1,
              expiresAtFrame: 111
            }
          ]
        }
      })
    ).toThrow(/remaining Gauge decay boundary/);
    expect(() =>
      bloomReactionAuditSchema.parse({
        ...hydroBloom,
        quickenStateMutation: {
          ...hydroBloom.quickenStateMutation,
          expiresAtFrameAfter: 10
        }
      })
    ).toThrow(/null post-consumption expiry/);
  });

  it("strictly validates ReactionA decisions", () => {
    const allowed = {
      reaction: "bloom",
      sourceActorId: "dendro-owner",
      targetId: "enemy-0",
      windowStartFrame: 100,
      hitIndex: 1,
      resetFrames: 30,
      sequence: [true, true, false],
      damageAllowed: true,
      blockedReason: null
    };
    expect(reactionADamageGroupAuditSchema.parse(allowed)).toEqual(
      allowed
    );
    expect(() =>
      reactionADamageGroupAuditSchema.parse({
        ...allowed,
        hitIndex: 2
      })
    ).toThrow(/permits only hitIndex 0 and 1/);
    expect(
      reactionADamageGroupAuditSchema.parse({
        ...allowed,
        hitIndex: 2,
        damageAllowed: false,
        blockedReason: "REACTION_A_DAMAGE_ICD"
      }).blockedReason
    ).toBe("REACTION_A_DAMAGE_ICD");
    expect(
      reactionDamageGroupAuditSchema.parse({
        ...allowed,
        reaction: "superconduct"
      }).reaction
    ).toBe("superconduct");
    expect(
      reactionDamageGroupAuditSchema.parse({
        ...allowed,
        reaction: "shatter"
      }).reaction
    ).toBe("shatter");
  });

  it("strictly validates ReactionB decisions", () => {
    const allowed = {
      reaction: "overload",
      sourceActorId: "pyro-owner",
      targetId: "enemy-0",
      windowStartFrame: 100,
      hitIndex: 0,
      resetFrames: 30,
      sequence: [true, false],
      damageAllowed: true,
      blockedReason: null
    };
    expect(reactionBDamageGroupAuditSchema.parse(allowed)).toEqual(
      allowed
    );
    expect(
      reactionDamageGroupAuditSchema.parse({
        ...allowed,
        reaction: "electroCharged",
        hitIndex: 1,
        damageAllowed: false,
        blockedReason: "REACTION_B_DAMAGE_ICD"
      }).blockedReason
    ).toBe("REACTION_B_DAMAGE_ICD");
    expect(() =>
      reactionBDamageGroupAuditSchema.parse({
        ...allowed,
        hitIndex: 1
      })
    ).toThrow(/permits only hitIndex 0/);
    expect(() =>
      reactionBDamageGroupAuditSchema.parse({
        ...allowed,
        sequence: [true, true, false]
      })
    ).toThrow();
    expect(() =>
      reactionBDamageGroupAuditSchema.parse({
        ...allowed,
        damageAllowed: false,
        blockedReason: "REACTION_B_DAMAGE_ICD"
      })
    ).toThrow(/cannot declare a blocked reason/);
  });

  it("strictly validates Dendro-core lifecycle, contact, and entity timelines", () => {
    const base = {
      coreId: 0,
      eventSequence: 7,
      intraEventSequence: 0,
      sourceActorId: "hydro-owner",
      sourceTargetId: "enemy-0",
      originDamageEventId: 3,
      triggerFrame: 10,
      coreDurationFrames: 300,
      hitboxRadius: 2,
      maxActiveCores: 5,
      clockModel: "global-frame-no-hitlag",
      hitlagStatus: "unsupported-enemy-hitlag",
      mechanicsDataStatus: "fixed-gcsim-provisional",
      selfDamageStatus: "unsupported-player-damage-model"
    };
    const scheduled = {
      ...base,
      id: 0,
      frame: 10,
      timeSeconds: 10 / 60,
      eventPriority: 3,
      operation: "spawn-scheduled",
      eventType: "hit",
      bloomReactionIndex: 0,
      spawnFrame: 40,
      withinSimulation: true,
      reason: "BLOOM_TRIGGERED"
    };
    const spawned = {
      ...base,
      id: 1,
      frame: 40,
      timeSeconds: 40 / 60,
      eventPriority: 2,
      eventSequence: 8,
      operation: "spawn",
      eventType: "dendroCoreSpawn",
      spawnedAtFrame: 40,
      expiresAtFrame: 340,
      position: { x: 1, y: 0 },
      spawnRadius: 1,
      spawnAngleDegrees: 90,
      positionRandomRoll: 0.25,
      rngStream: "dendro-core-position-v1",
      reason: "SPAWNED"
    };
    const expired = {
      ...base,
      id: 2,
      frame: 340,
      timeSeconds: 340 / 60,
      eventPriority: 2,
      eventSequence: 9,
      operation: "expire",
      eventType: "dendroCoreExpiry",
      reaction: "bloom",
      reactionDamageLogId: 4,
      playerHitResolutionLogId: null,
      playerDamageEventId: null,
      contactLogId: null,
      damageFrame: 341,
      withinSimulation: true,
      reason: "NATURAL_EXPIRY"
    };
    expect(dendroCoreLogSchema.parse([
      scheduled,
      spawned,
      expired
    ])).toEqual([scheduled, spawned, expired]);
    expect(
      dendroCoreLogEntrySchema.parse({
        ...scheduled,
        clockModel: "global-frame-gadget-v1",
        hitlagStatus: "not-affected-by-enemy-hitlag"
      }).clockModel
    ).toBe("global-frame-gadget-v1");
    expect(() =>
      dendroCoreLogEntrySchema.parse({
        ...scheduled,
        clockModel: "global-frame-gadget-v1"
      })
    ).toThrow(/same Dendro-core clock domain/);
    expect(
      dendroCoreLogEntrySchema.parse({
        ...scheduled,
        eventType: "reactionDamage",
        eventPriority: 5
      }).eventType
    ).toBe("reactionDamage");
    expect(() =>
      dendroCoreLogEntrySchema.parse({
        ...spawned,
        expiresAtFrame: 341
      })
    ).toThrow(/300-frame/);
    expect(() =>
      dendroCoreLogEntrySchema.parse({
        ...scheduled,
        uiInferred: true
      })
    ).toThrow();
    expect(() =>
      dendroCoreLogSchema.parse([
        scheduled,
        { ...spawned, id: 2 }
      ])
    ).toThrow(/contiguous log id 1/);
    expect(() =>
      dendroCoreLogSchema.parse([
        scheduled,
        { ...spawned, triggerFrame: 999 }
      ])
    ).toThrow(/spawn does not match its schedule/);
    const burgeonRemoval = {
      ...base,
      id: 2,
      frame: 50,
      timeSeconds: 50 / 60,
      eventPriority: 3,
      eventSequence: 10,
      operation: "consume",
      eventType: "hit",
      reaction: "burgeon",
      reactionDamageLogId: 4,
      playerHitResolutionLogId: null,
      playerDamageEventId: null,
      contactLogId: 0,
      damageFrame: 51,
      withinSimulation: true,
      reason: "BURGEON_CONTACT"
    };
    expect(
      dendroCoreLogEntrySchema.parse(burgeonRemoval)
    ).toEqual(burgeonRemoval);
    expect(
      dendroCoreLogEntrySchema.parse({
        ...burgeonRemoval,
        eventType: "reactionDamage",
        eventPriority: 5
      }).eventPriority
    ).toBe(5);
    expect(
      dendroCoreLogEntrySchema.parse({
        ...burgeonRemoval,
        eventType: "reactionDamage",
        eventPriority: 4.5
      }).eventPriority
    ).toBe(4.5);
    expect(() =>
      dendroCoreLogEntrySchema.parse({
        ...burgeonRemoval,
        eventType: "reactionDamage",
        eventPriority: 4
      })
    ).toThrow(/priority in \(4, 5\]/);
    expect(() =>
      dendroCoreLogEntrySchema.parse({
        ...burgeonRemoval,
        eventType: "reactionDamage",
        eventPriority: 5.0001
      })
    ).toThrow();
    const hyperbloomRemoval = {
      ...burgeonRemoval,
      reaction: "hyperbloom",
      damageFrame: 110,
      reason: "HYPERBLOOM_CONTACT"
    };
    expect(
      dendroCoreLogEntrySchema.parse(hyperbloomRemoval)
    ).toEqual(hyperbloomRemoval);
    expect(() =>
      dendroCoreLogEntrySchema.parse({
        ...hyperbloomRemoval,
        damageFrame: 109
      })
    ).toThrow(/hyperbloom requires damage at frame 110/);

    const contact = {
      id: 0,
      frame: 50,
      timeSeconds: 50 / 60,
      eventType: "hit",
      eventPriority: 3,
      eventSequence: 10,
      intraEventSequence: 0,
      sourceActorId: "pyro-owner",
      sourceActionId: "pyro-action",
      hitId: "pyro-hit",
      hitGroupId: "pyro-action:pyro-hit:0",
      triggerReactionDamageLogId: null,
      triggerElement: "pyro",
      reaction: "burgeon",
      hitResolutionLogIds: [5, 6],
      triggerDamageEventIds: [8],
      resolvedGeometry: {
        kind: "circle",
        coordinateSpace: "world",
        origin: { x: 0, y: 0 },
        radius: 3
      },
      checkedCoreIds: [0, 1],
      contactedCoreIds: [0],
      removalLogIds: [3],
      reactionDamageLogIds: [4],
      blockedReason: null
    };
    expect(dendroCoreContactLogEntrySchema.parse(contact)).toEqual(
      contact
    );
    expect(
      dendroCoreContactLogEntrySchema.parse({
        ...contact,
        eventType: "reactionDamage",
        triggerReactionDamageLogId: 9,
        eventPriority: 5
      }).eventPriority
    ).toBe(5);
    expect(
      dendroCoreContactLogEntrySchema.parse({
        ...contact,
        eventType: "reactionDamage",
        triggerReactionDamageLogId: 9,
        eventPriority: 4.5
      }).eventPriority
    ).toBe(4.5);
    expect(() =>
      dendroCoreContactLogEntrySchema.parse({
        ...contact,
        eventType: "reactionDamage",
        triggerReactionDamageLogId: 9,
        eventPriority: 4
      })
    ).toThrow(/priority in \(4, 5\]/);
    expect(() =>
      dendroCoreContactLogEntrySchema.parse({
        ...contact,
        eventType: "reactionDamage",
        triggerReactionDamageLogId: 9,
        eventPriority: 5.0001
      })
    ).toThrow();
    expect(() =>
      dendroCoreContactLogEntrySchema.parse({
        ...contact,
        eventType: "reactionDamage",
        eventPriority: 5
      })
    ).toThrow(/requires its triggering reaction-damage log id/);
    expect(
      resolvedWorldHitGeometrySchema.parse(contact.resolvedGeometry)
    ).toEqual(contact.resolvedGeometry);
    expect(() =>
      dendroCoreContactLogEntrySchema.parse({
        ...contact,
        triggerElement: "electro"
      })
    ).toThrow(/requires hyperbloom/);
    expect(() =>
      dendroCoreContactLogEntrySchema.parse({
        ...contact,
        contactedCoreIds: [0, 0],
        removalLogIds: [3, 4],
        reactionDamageLogIds: [4, 5]
      })
    ).toThrow(/duplicate id 0/);
    expect(() =>
      dendroCoreContactLogEntrySchema.parse({
        ...contact,
        resolvedGeometry: null,
        blockedReason: "MISSING_EXPLICIT_GEOMETRY"
      })
    ).toThrow(/cannot consume cores/);
    expect(() =>
      dendroCoreContactLogSchema.parse([
        contact,
        { ...contact, id: 1 }
      ])
    ).toThrow(/duplicate Dendro-core contact/);

    const snapshot = {
      coreId: 0,
      sourceActorId: "hydro-owner",
      sourceTargetId: "enemy-0",
      spawnedAtFrame: 40,
      expiresAtFrame: 340,
      position: { x: 1, y: 0 },
      hitboxRadius: 2
    };
    const timeline = {
      version: "1.0.0",
      points: [
        {
          id: 0,
          frame: 40,
          timeSeconds: 40 / 60,
          eventType: "dendroCoreSpawn",
          eventPriority: 2,
          eventSequence: 8,
          intraEventSequence: 0,
          operation: "spawn",
          dendroCoreLogId: 1,
          coreId: 0,
          activeCores: [snapshot]
        },
        {
          id: 1,
          frame: 50,
          timeSeconds: 50 / 60,
          eventType: "hit",
          eventPriority: 3,
          eventSequence: 10,
          intraEventSequence: 0,
          operation: "consume",
          dendroCoreLogId: 3,
          coreId: 0,
          activeCores: []
        }
      ]
    };
    expect(dendroCoreTimelineSchema.parse(timeline)).toEqual(
      timeline
    );
    expect(
      dendroCoreTimelinePointSchema.parse({
        ...timeline.points[1],
        eventType: "reactionDamage",
        eventPriority: 5
      }).eventPriority
    ).toBe(5);
    expect(
      dendroCoreTimelinePointSchema.parse({
        ...timeline.points[1],
        eventType: "reactionDamage",
        eventPriority: 4.5
      }).eventPriority
    ).toBe(4.5);
    expect(() =>
      dendroCoreTimelinePointSchema.parse({
        ...timeline.points[1],
        eventType: "reactionDamage",
        eventPriority: 4
      })
    ).toThrow(/priority in \(4, 5\]/);
    expect(() =>
      dendroCoreTimelinePointSchema.parse({
        ...timeline.points[1],
        eventType: "reactionDamage",
        eventPriority: 5.0001
      })
    ).toThrow();
    expect(() =>
      dendroCoreTimelinePointSchema.parse({
        ...timeline.points[0],
        eventType: "hit"
      })
    ).toThrow(/requires eventType=dendroCoreSpawn/);
    expect(() =>
      dendroCoreTimelinePointSchema.parse({
        ...timeline.points[0],
        activeCores: Array.from({ length: 6 }, (_, coreId) => ({
          ...snapshot,
          coreId
        }))
      })
    ).toThrow();
    expect(() =>
      dendroCoreTimelineSchema.parse({
        ...timeline,
        points: [
          timeline.points[0],
          {
            ...timeline.points[1],
            coreId: 1
          }
        ]
      })
    ).toThrow(/requires an active core/);
    expect(() =>
      dendroCoreTimelineSchema.parse({
        version: "1.0.0",
        points: [
          {
            ...timeline.points[0],
            activeCores: [
              {
                ...snapshot,
                spawnedAtFrame: 39,
                expiresAtFrame: 339
              }
            ]
          }
        ]
      })
    ).toThrow(/spawnedAtFrame must equal/);
    expect(() =>
      dendroCoreTimelineSchema.parse({
        version: "1.0.0",
        points: [
          timeline.points[0],
          {
            ...timeline.points[1],
            frame: 340,
            timeSeconds: 340 / 60
          }
        ]
      })
    ).toThrow(/before the cached core expiry/);
    expect(() =>
      dendroCoreTimelineSchema.parse({
        version: "1.0.0",
        points: [
          timeline.points[0],
          {
            ...timeline.points[1],
            frame: 339,
            timeSeconds: 339 / 60,
            eventType: "dendroCoreExpiry",
            eventPriority: 2,
            operation: "expire"
          }
        ]
      })
    ).toThrow(/exactly at the cached core expiry/);
    expect(() =>
      dendroCoreTimelineSchema.parse({
        version: "1.0.0",
        points: [
          timeline.points[0],
          timeline.points[1],
          {
            ...timeline.points[0],
            id: 2,
            frame: 60,
            timeSeconds: 1,
            eventSequence: 11,
            dendroCoreLogId: 4,
            activeCores: [
              {
                ...snapshot,
                spawnedAtFrame: 60,
                expiresAtFrame: 360
              }
            ]
          }
        ]
      })
    ).toThrow(/cannot be reused after removal/);
  });

  it("validates Dendro-core result references without claiming a full result schema", () => {
    const scheduled = {
      id: 0,
      coreId: 0,
      frame: 10,
      timeSeconds: 10 / 60,
      eventPriority: 3,
      eventSequence: 7,
      intraEventSequence: 0,
      sourceActorId: "hydro-owner",
      sourceTargetId: "enemy-0",
      originDamageEventId: 0,
      triggerFrame: 10,
      coreDurationFrames: 300,
      hitboxRadius: 2,
      maxActiveCores: 5,
      clockModel: "global-frame-no-hitlag",
      hitlagStatus: "unsupported-enemy-hitlag",
      mechanicsDataStatus: "fixed-gcsim-provisional",
      selfDamageStatus: "unsupported-player-damage-model",
      operation: "spawn-scheduled",
      eventType: "hit",
      bloomReactionIndex: 0,
      spawnFrame: 40,
      withinSimulation: false,
      reason: "BLOOM_TRIGGERED"
    };
    const references = {
      dendroCoreLog: [scheduled],
      dendroCoreContactLog: [],
      dendroCoreTimeline: {
        version: "1.0.0",
        points: []
      },
      hitResolutionLog: [],
      reactionDamageLog: [],
      damageEvents: [
        {
          id: 0,
          kind: "direct",
          parentDamageEventId: null,
          sourceActorId: "hydro-owner",
          scalingOwnerId: "hydro-owner",
          creditOwnerId: "hydro-owner",
          hitGroupId: "hydro-origin-group",
          targetId: "enemy-0",
          frame: 10,
          element: "hydro",
          reaction: "bloom",
          reactionAudit: {
            bloomReactions: [
              {
                scheduled: true,
                coreSpawnFrame: 40,
                triggerFrame: 10,
                sourceActorId: "hydro-owner"
              }
            ]
          }
        }
      ],
      totalDamage: 123
    };
    expect(
      dendroCoreResultReferencesSchema.parse(references)
        .totalDamage
    ).toBe(123);
    expect(() =>
      dendroCoreResultReferencesSchema.parse({
        ...references,
        damageEvents: []
      })
    ).toThrow(/missing damage event 0/);
    expect(() =>
      dendroCoreResultReferencesSchema.parse({
        ...references,
        dendroCoreLog: [
          {
            ...scheduled,
            bloomReactionIndex: 1
          }
        ]
      })
    ).toThrow(/missing Bloom audit 1/);
    expect(() =>
      dendroCoreResultReferencesSchema.parse({
        ...references,
        damageEvents: [
          references.damageEvents[0],
          references.damageEvents[0]
        ]
      })
    ).toThrow(/duplicate id 0/);

    const pyroDamageEvent = {
      ...references.damageEvents[0],
      id: 1,
      sourceActorId: "pyro-owner",
      scalingOwnerId: "pyro-owner",
      creditOwnerId: "pyro-owner",
      hitGroupId: "pyro-action:pyro-hit:0",
      frame: 50,
      element: "pyro",
      reaction: "none",
      reactionAudit: { bloomReactions: [] }
    };
    const coreContact = {
      id: 0,
      frame: 50,
      timeSeconds: 50 / 60,
      eventType: "hit",
      eventPriority: 3,
      eventSequence: 10,
      intraEventSequence: 0,
      sourceActorId: "pyro-owner",
      sourceActionId: "pyro-action",
      hitId: "pyro-hit",
      hitGroupId: "pyro-action:pyro-hit:0",
      triggerReactionDamageLogId: null,
      triggerElement: "pyro",
      reaction: "burgeon",
      hitResolutionLogIds: [0],
      triggerDamageEventIds: [1],
      resolvedGeometry: {
        kind: "circle",
        coordinateSpace: "world",
        origin: { x: 0, y: 0 },
        radius: 3
      },
      checkedCoreIds: [],
      contactedCoreIds: [],
      removalLogIds: [],
      reactionDamageLogIds: [],
      blockedReason: null
    };
    const hitResolution = {
      id: 0,
      frame: 50,
      sourceActorId: "pyro-owner",
      sourceActionId: "pyro-action",
      hitId: "pyro-hit",
      hitGroupId: "pyro-action:pyro-hit:0",
      targetId: "enemy-0",
      element: "pyro",
      resolutionKind: "direct",
      damageEventId: 1
    };
    const contactReferences = {
      ...references,
      dendroCoreContactLog: [coreContact],
      hitResolutionLog: [hitResolution],
      damageEvents: [
        references.damageEvents[0],
        pyroDamageEvent
      ]
    };
    expect(() =>
      dendroCoreResultReferencesSchema.parse(contactReferences)
    ).not.toThrow();
    expect(() =>
      dendroCoreResultReferencesSchema.parse({
        ...contactReferences,
        hitResolutionLog: []
      })
    ).toThrow(/missing hit-resolution log 0/);
    expect(() =>
      dendroCoreResultReferencesSchema.parse({
        ...contactReferences,
        hitResolutionLog: [
          {
            ...hitResolution,
            sourceActionId: "forged-action"
          }
        ]
      })
    ).toThrow(/hit resolution does not match/);
    expect(() =>
      dendroCoreResultReferencesSchema.parse({
        ...contactReferences,
        hitResolutionLog: [{ ...hitResolution, id: 1 }]
      })
    ).toThrow(/contiguous id 0/);

    const lifecycleBase = {
      coreId: 0,
      intraEventSequence: 0,
      sourceActorId: "hydro-owner",
      sourceTargetId: "enemy-0",
      originDamageEventId: 0,
      triggerFrame: 10,
      coreDurationFrames: 300,
      hitboxRadius: 2,
      maxActiveCores: 5,
      clockModel: "global-frame-no-hitlag",
      hitlagStatus: "unsupported-enemy-hitlag",
      mechanicsDataStatus: "fixed-gcsim-provisional",
      selfDamageStatus: "unsupported-player-damage-model"
    };
    const scheduledInDuration = {
      ...scheduled,
      withinSimulation: true
    };
    const spawned = {
      ...lifecycleBase,
      id: 1,
      frame: 40,
      timeSeconds: 40 / 60,
      eventPriority: 2,
      eventSequence: 8,
      operation: "spawn",
      eventType: "dendroCoreSpawn",
      spawnedAtFrame: 40,
      expiresAtFrame: 340,
      position: { x: 1, y: 0 },
      spawnRadius: 1,
      spawnAngleDegrees: 90,
      positionRandomRoll: 0.25,
      rngStream: "dendro-core-position-v1",
      reason: "SPAWNED"
    };
    const expired = {
      ...lifecycleBase,
      id: 2,
      frame: 340,
      timeSeconds: 340 / 60,
      eventPriority: 2,
      eventSequence: 9,
      operation: "expire",
      eventType: "dendroCoreExpiry",
      reaction: "bloom",
      reactionDamageLogId: 0,
      playerHitResolutionLogId: null,
      playerDamageEventId: null,
      contactLogId: null,
      damageFrame: 341,
      withinSimulation: true,
      reason: "NATURAL_EXPIRY"
    };
    const snapshot = {
      coreId: 0,
      sourceActorId: "hydro-owner",
      sourceTargetId: "enemy-0",
      spawnedAtFrame: 40,
      expiresAtFrame: 340,
      position: { x: 1, y: 0 },
      hitboxRadius: 2
    };
    const reactionDamage = {
      id: 0,
      reaction: "bloom",
      triggerDamageEventId: 0,
      triggerHitGroupId: null,
      sourceActorId: "hydro-owner",
      sourceTargetId: "enemy-0",
      triggerFrame: 340,
      damageFrame: 341,
      scheduled: true,
      withinSimulation: true,
      blockedReason: null,
      nextAvailableFrame: null,
      scheduleKind: "dendro-core-bloom",
      targetingMode: "radius",
      centerPosition: { x: 1, y: 0 },
      radius: 5,
      sourceCoreId: 0,
      sourceCoreLogId: 2,
      selectionRadius: null,
      selectedTargetId: null,
      resolutionReason: null,
      applicationGaugeUnits: null,
      excludedTargetIds: [],
      checkedTargetIds: ["enemy-0"],
      hitTargetIds: ["enemy-0"],
      unresolvedTargetIds: [],
      damageGroupBlockedTargetIds: [],
      damageEventIds: [1],
      playerHitResolutionLogIds: [],
      playerDamageEventIds: [],
      reactionStatusLogIds: [],
      damageGroupDecisions: [
        {
          reaction: "bloom",
          sourceActorId: "hydro-owner",
          targetId: "enemy-0",
          windowStartFrame: 341,
          hitIndex: 0,
          resetFrames: 30,
          sequence: [true, true, false],
          damageAllowed: true,
          blockedReason: null
        }
      ]
    };
    const producedDamageEvent = {
      id: 1,
      kind: "transformative-reaction",
      parentDamageEventId: 0,
      sourceActorId: "hydro-owner",
      scalingOwnerId: "hydro-owner",
      creditOwnerId: "hydro-owner",
      hitGroupId: "hydro-origin-group:bloom:0:core-0:log-0",
      targetId: "enemy-0",
      frame: 341,
      element: "dendro",
      reaction: "bloom",
      reactionAudit: { bloomReactions: [] }
    };
    const completeReferences = {
      ...references,
      dendroCoreLog: [
        scheduledInDuration,
        spawned,
        expired
      ],
      dendroCoreTimeline: {
        version: "1.0.0",
        points: [
          {
            id: 0,
            frame: 40,
            timeSeconds: 40 / 60,
            eventType: "dendroCoreSpawn",
            eventPriority: 2,
            eventSequence: 8,
            intraEventSequence: 1,
            operation: "spawn",
            dendroCoreLogId: 1,
            coreId: 0,
            activeCores: [snapshot]
          },
          {
            id: 1,
            frame: 340,
            timeSeconds: 340 / 60,
            eventType: "dendroCoreExpiry",
            eventPriority: 2,
            eventSequence: 9,
            intraEventSequence: 1,
            operation: "expire",
            dendroCoreLogId: 2,
            coreId: 0,
            activeCores: []
          }
        ]
      },
      reactionDamageLog: [reactionDamage],
      damageEvents: [
        references.damageEvents[0],
        producedDamageEvent
      ]
    };
    expect(() =>
      dendroCoreResultReferencesSchema.parse(completeReferences)
    ).not.toThrow();
    expect(() =>
      dendroCoreResultReferencesSchema.parse({
        ...completeReferences,
        reactionDamageLog: [
          {
            ...reactionDamage,
            scheduleKind: "forged-kind"
          }
        ]
      })
    ).toThrow(/scheduleKind/);
    expect(() =>
      dendroCoreResultReferencesSchema.parse({
        ...completeReferences,
        reactionDamageLog: [
          {
            ...reactionDamage,
            damageGroupDecisions: [
              {
                ...reactionDamage.damageGroupDecisions[0],
                resetFrames: 999,
                sequence: [false]
              }
            ]
          }
        ]
      })
    ).toThrow(/damageGroupDecisions/);
    expect(() =>
      dendroCoreResultReferencesSchema.parse({
        ...completeReferences,
        reactionDamageLog: [
          {
            ...reactionDamage,
            triggerHitGroupId: "forged-contact"
          }
        ]
      })
    ).toThrow(/reaction-damage log/);
    expect(() =>
      dendroCoreResultReferencesSchema.parse({
        ...completeReferences,
        reactionDamageLog: [
          {
            ...reactionDamage,
            damageGroupDecisions: [
              {
                ...reactionDamage.damageGroupDecisions[0],
                windowStartFrame: 340
              }
            ]
          }
        ]
      })
    ).toThrow(/windowStartFrame and hitIndex/);
    expect(() =>
      dendroCoreResultReferencesSchema.parse({
        ...completeReferences,
        damageEvents: [
          references.damageEvents[0],
          {
            ...producedDamageEvent,
            frame: 342,
            reaction: "hyperbloom"
          }
        ]
      })
    ).toThrow(/produced damage event/);
  });

  it("strictly validates the Burning hit and lifecycle audit contracts", () => {
    const burningAudit = {
      reaction: "burning",
      operation: "start",
      reactionTriggered: true,
      generation: 1,
      triggerElement: "pyro",
      fuelOperation: "start",
      stopReason: null,
      scheduled: true,
      blockedReason: null,
      damageSourceActorId: "pyro-owner",
      fuelSourceActorId: "dendro-owner",
      burningGaugeUnitsBefore: 0,
      candidateBurningGaugeUnits: 2,
      burningGaugeUnitsAfter: 2,
      burningDecayPerFrame: 0,
      burningExpiresAtFrame: null,
      fuelGaugeUnitsBefore: 0,
      candidateFuelGaugeUnits: 0.8,
      fuelGaugeUnitsAfter: 0.8,
      fuelDecayPerFrame: 1 / 150,
      fuelExpiresAtFrame: 120,
      quickenStateMutation: {
        operation: "none",
        generationBefore: 0,
        generationAfter: 0,
        quickenGaugeUnitsBefore: 0,
        quickenGaugeUnitsAfter: 0,
        decayPerFrameBefore: 0,
        decayPerFrameAfter: 0,
        expiresAtFrameBefore: null,
        expiresAtFrameAfter: null,
        endCauseBefore: null,
        endCauseAfter: null,
        operationAuraBefore: [],
        operationAuraAfter: []
      },
      snapshotFrame: 0,
      clockModel: "target-local-no-hitlag",
      hitlagStatus: "unsupported-enemy-hitlag",
      firstTickFrame: 15,
      nextTickFrame: 15,
      tickIntervalFrames: 15,
      skippedTickIndex: 9,
      damageElement: "pyro",
      baseMultiplier: 0.25,
      radius: 1,
      applicationGaugeUnits: 1,
      selfDamageStatus: "unsupported-player-damage-model"
    };
    expect(burningReactionAuditSchema.parse(burningAudit)).toEqual(
      burningAudit
    );
    expect(
      burningReactionAuditSchema.parse({
        ...burningAudit,
        snapshotTargetFrame: 0,
        fuelExpiresAtTargetFrame: 120,
        firstTickTargetFrame: 15,
        nextTickTargetFrame: 15,
        clockModel: "target-local-hitlag-v1",
        hitlagStatus: "modeled-enemy-hitlag"
      }).clockModel
    ).toBe("target-local-hitlag-v1");
    const rebasedQuicken = {
      operation: "decay-rebase",
      generationBefore: 1,
      generationAfter: 2,
      quickenGaugeUnitsBefore: 0.8,
      quickenGaugeUnitsAfter: 0.8,
      decayPerFrameBefore: 0.8 / 600,
      decayPerFrameAfter: 0.8 / 120,
      expiresAtFrameBefore: 600,
      expiresAtFrameAfter: 120,
      endCauseBefore: "QUICKEN_DECAY",
      endCauseAfter: "BURNING_FUEL_EXPIRED",
      operationAuraBefore: [
        {
          element: "quicken",
          gaugeUnits: 0.8,
          expiresAtFrame: 600
        }
      ],
      operationAuraAfter: [
        {
          element: "quicken",
          gaugeUnits: 0.8,
          expiresAtFrame: 120
        }
      ]
    };
    expect(
      quickenDecayMutationAuditSchema.parse(rebasedQuicken)
    ).toEqual(rebasedQuicken);
    expect(
      burningReactionAuditSchema.parse({
        ...burningAudit,
        quickenStateMutation: rebasedQuicken
      }).quickenStateMutation
    ).toEqual(rebasedQuicken);
    const quickenEndsBeforeFuel = {
      ...rebasedQuicken,
      endCauseAfter: "QUICKEN_DECAY"
    };
    expect(
      burningReactionAuditSchema.parse({
        ...burningAudit,
        fuelExpiresAtFrame: 121,
        quickenStateMutation: quickenEndsBeforeFuel
      }).quickenStateMutation.endCauseAfter
    ).toBe("QUICKEN_DECAY");
    const refreshedQuicken = {
      ...rebasedQuicken,
      decayPerFrameBefore: 0.8 / 100,
      expiresAtFrameBefore: 100,
      endCauseBefore: "BURNING_FUEL_EXPIRED",
      operationAuraBefore: [
        {
          element: "quicken",
          gaugeUnits: 0.8,
          expiresAtFrame: 100
        }
      ]
    };
    expect(
      burningReactionAuditSchema.parse({
        ...burningAudit,
        operation: "refresh-fuel",
        reactionTriggered: false,
        triggerElement: "dendro",
        fuelOperation: "overwrite",
        burningGaugeUnitsBefore: 2,
        fuelGaugeUnitsBefore: 0.4,
        firstTickFrame: null,
        quickenStateMutation: refreshedQuicken
      }).quickenStateMutation
    ).toEqual(refreshedQuicken);
    const unchangedFuelOwnedQuicken = {
      ...rebasedQuicken,
      operation: "none",
      generationAfter: 1,
      decayPerFrameBefore: 0.8 / 120,
      expiresAtFrameBefore: 120,
      endCauseBefore: "BURNING_FUEL_EXPIRED",
      operationAuraBefore: [
        {
          element: "quicken",
          gaugeUnits: 0.8,
          expiresAtFrame: 120
        }
      ]
    };
    expect(
      burningReactionAuditSchema.parse({
        ...burningAudit,
        operation: "refresh-snapshot",
        reactionTriggered: false,
        triggerElement: "pyro",
        fuelOperation: "unchanged",
        burningGaugeUnitsBefore: 2,
        fuelGaugeUnitsBefore: 0.8,
        firstTickFrame: null,
        quickenStateMutation: unchangedFuelOwnedQuicken
      }).quickenStateMutation
    ).toEqual(unchangedFuelOwnedQuicken);
    expect(() =>
      burningReactionAuditSchema.parse({
        ...burningAudit,
        quickenStateMutation: {
          ...rebasedQuicken,
          expiresAtFrameAfter: 119,
          operationAuraAfter: [
            {
              element: "quicken",
              gaugeUnits: 0.8,
              expiresAtFrame: 119
            }
          ]
        }
      })
    ).toThrow(/earlier Fuel or Quicken boundary/);
    expect(() =>
      burningReactionAuditSchema.parse({
        ...burningAudit,
        quickenStateMutation: {
          ...rebasedQuicken,
          operation: "none",
          generationAfter: 1,
          decayPerFrameAfter: 0.8 / 600,
          expiresAtFrameAfter: 600,
          endCauseAfter: "QUICKEN_DECAY",
          operationAuraAfter: [
            {
              element: "quicken",
              gaugeUnits: 0.8,
              expiresAtFrame: 600
            }
          ]
        }
      })
    ).toThrow(/real Fuel-driven decay rebase/);
    expect(() =>
      burningReactionAuditSchema.parse({
        ...burningAudit,
        quickenStateMutation: {
          ...rebasedQuicken,
          decayPerFrameAfter: 0.8 / 100,
          expiresAtFrameAfter: 100,
          endCauseAfter: "QUICKEN_DECAY",
          operationAuraAfter: [
            {
              element: "quicken",
              gaugeUnits: 0.8,
              expiresAtFrame: 100
            }
          ]
        }
      })
    ).toThrow(/Burning Fuel decay rate/);
    expect(() =>
      burningReactionAuditSchema.parse({
        ...burningAudit,
        operation: "refresh-snapshot",
        reactionTriggered: false,
        triggerElement: "pyro",
        fuelOperation: "unchanged",
        firstTickFrame: null,
        quickenStateMutation: rebasedQuicken
      })
    ).toThrow(/refresh-snapshot cannot change/);
    expect(() =>
      quickenDecayMutationAuditSchema.parse({
        ...rebasedQuicken,
        generationAfter: 1
      })
    ).toThrow(/advance generation exactly once/);
    expect(() =>
      quickenDecayMutationAuditSchema.parse({
        ...rebasedQuicken,
        quickenGaugeUnitsAfter: 0.7
      })
    ).toThrow(/must preserve a positive Quicken Gauge|must match the audited Gauge/);
    expect(() =>
      quickenDecayMutationAuditSchema.parse({
        ...rebasedQuicken,
        operationAuraAfter: [
          ...rebasedQuicken.operationAuraAfter,
          {
            element: "hydro",
            gaugeUnits: 0.1,
            expiresAtFrame: 100
          }
        ]
      })
    ).toThrow(/may only change the Quicken slot/);
    const removedQuicken = {
      ...rebasedQuicken,
      operation: "remove",
      quickenGaugeUnitsAfter: 0,
      decayPerFrameAfter: 0,
      expiresAtFrameAfter: null,
      endCauseAfter: null,
      operationAuraAfter: []
    };
    expect(
      quickenDecayMutationAuditSchema.parse(removedQuicken)
    ).toEqual(removedQuicken);
    expect(() =>
      quickenDecayMutationAuditSchema.parse({
        ...removedQuicken,
        expiresAtFrameAfter: 120
      })
    ).toThrow(/empty post-state|absent Quicken state/);
    expect(() =>
      burningReactionAuditSchema.parse({
        ...burningAudit,
        tickIntervalFrames: 16
      })
    ).toThrow();
    expect(() =>
      burningReactionAuditSchema.parse({
        ...burningAudit,
        inferredByUi: true
      })
    ).toThrow(/Unrecognized key/);
    expect(() =>
      burningReactionAuditSchema.parse({
        ...burningAudit,
        reactionTriggered: false
      })
    ).toThrow(/start requires reactionTriggered=true/);
    expect(() =>
      burningReactionAuditSchema.parse({
        ...burningAudit,
        nextTickFrame: null
      })
    ).toThrow(/start requires a retained Burning tick/);
    const burningStop = {
      ...burningAudit,
      operation: "stop",
      reactionTriggered: false,
      triggerElement: "hydro",
      fuelOperation: "remove",
      stopReason: "BURNING_AURA_CONSUMED",
      scheduled: false,
      burningGaugeUnitsAfter: 0,
      fuelGaugeUnitsAfter: 0,
      fuelExpiresAtFrame: null,
      firstTickFrame: null,
      nextTickFrame: null
    };
    expect(burningReactionAuditSchema.parse(burningStop)).toEqual(
      burningStop
    );
    const stopRebasedQuicken = {
      operation: "decay-rebase",
      generationBefore: 2,
      generationAfter: 3,
      quickenGaugeUnitsBefore: 0.6,
      quickenGaugeUnitsAfter: 0.6,
      decayPerFrameBefore: 0.6 / 75,
      decayPerFrameAfter: 0.6 / 600,
      expiresAtFrameBefore: 75,
      expiresAtFrameAfter: 600,
      endCauseBefore: "BURNING_FUEL_EXPIRED",
      endCauseAfter: "QUICKEN_DECAY",
      operationAuraBefore: [
        {
          element: "quicken",
          gaugeUnits: 0.6,
          expiresAtFrame: 75
        }
      ],
      operationAuraAfter: [
        {
          element: "quicken",
          gaugeUnits: 0.6,
          expiresAtFrame: 600
        }
      ]
    };
    expect(
      burningReactionAuditSchema.parse({
        ...burningStop,
        quickenStateMutation: stopRebasedQuicken
      }).quickenStateMutation
    ).toEqual(stopRebasedQuicken);
    expect(() =>
      burningReactionAuditSchema.parse({
        ...burningStop,
        quickenStateMutation: {
          ...stopRebasedQuicken,
          operation: "none",
          generationAfter: 2,
          decayPerFrameAfter: 0.6 / 75,
          expiresAtFrameAfter: 75,
          endCauseAfter: "BURNING_FUEL_EXPIRED",
          operationAuraAfter: [
            {
              element: "quicken",
              gaugeUnits: 0.6,
              expiresAtFrame: 75
            }
          ]
        }
      })
    ).toThrow(/Gauge-preserving decay rebase/);
    expect(() =>
      burningReactionAuditSchema.parse({
        ...burningStop,
        nextTickFrame: 30
      })
    ).toThrow(/stop cannot retain a Burning tick/);
    const truncatedBurning = {
      ...burningAudit,
      scheduled: false,
      blockedReason: "TARGET_MECHANICS_TRUNCATION",
      burningGaugeUnitsAfter: 0,
      fuelGaugeUnitsAfter: 0,
      fuelExpiresAtFrame: null,
      firstTickFrame: null,
      nextTickFrame: null
    };
    expect(
      burningReactionAuditSchema.parse(truncatedBurning)
    ).toEqual(truncatedBurning);
    expect(() =>
      burningReactionAuditSchema.parse({
        ...truncatedBurning,
        nextTickFrame: 15
      })
    ).toThrow(/truncated Burning stream cannot retain a tick/);

    const burningLog = {
      id: 1,
      reaction: "burning",
      generation: 1,
      operation: "tick",
      frame: 15,
      timeSeconds: 0.25,
      eventPriority: 2,
      eventSequence: 7,
      clockModel: "target-local-no-hitlag",
      hitlagStatus: "unsupported-enemy-hitlag",
      targetId: "enemy-0",
      targetName: "测试目标",
      triggerElement: null,
      damageSourceActorId: "pyro-owner",
      fuelSourceActorId: "dendro-owner",
      triggerDamageEventId: 1,
      reactionDamageLogId: 1,
      damageEventIds: [2],
      playerHitResolutionLogId: null,
      playerDamageEventId: null,
      tickIndex: 1,
      tickSkipped: false,
      skipReason: null,
      damageAllowed: true,
      burningGaugeUnitsBefore: 2,
      burningGaugeUnitsAfter: 2,
      fuelGaugeUnitsBefore: 0.7,
      fuelGaugeUnitsAfter: 0.7,
      fuelDecayPerFrame: 1 / 150,
      fuelExpiresAtFrame: 120,
      auraBefore: [
        { element: "burning", gaugeUnits: 2, expiresAtFrame: null }
      ],
      auraApplied: [
        {
          element: "pyro",
          gaugeUnits: 1,
          sourceActorId: "pyro-owner"
        }
      ],
      auraConsumed: [],
      auraAfter: [
        { element: "burning", gaugeUnits: 2, expiresAtFrame: null }
      ],
      nextTickFrame: 30,
      icdGroup: "burning",
      icdTag: "burning-application",
      icdScope: "global-target",
      icdWindowStartFrame: 15,
      icdHitIndex: 0,
      icdResetFrames: 120,
      icdApplicationSequence: [
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false
      ],
      applicationAllowed: true,
      applicationBlockedReason: null,
      selfDamageStatus: "unsupported-player-damage-model",
      reason: null
    };
    expect(burningStateLogEntrySchema.parse(burningLog)).toEqual(burningLog);
    expect(
      burningStateLogEntrySchema.parse({
        ...burningLog,
        targetFrame: 15,
        fuelExpiresAtTargetFrame: 120,
        nextTickTargetFrame: 30,
        clockModel: "target-local-hitlag-v1",
        hitlagStatus: "modeled-enemy-hitlag"
      }).clockModel
    ).toBe("target-local-hitlag-v1");
    const damageBlockedBurningTick = {
      ...burningLog,
      damageAllowed: false
    };
    expect(
      burningStateLogEntrySchema.parse(damageBlockedBurningTick)
    ).toEqual(damageBlockedBurningTick);
    const auraBlockedBurningTick = {
      ...burningLog,
      icdWindowStartFrame: null,
      icdHitIndex: null,
      applicationAllowed: null,
      applicationBlockedReason: "TARGET_AURA_BLOCKED"
    };
    expect(
      burningStateLogEntrySchema.parse(auraBlockedBurningTick)
    ).toEqual(auraBlockedBurningTick);
    expect(() =>
      burningStateLogEntrySchema.parse({
        ...auraBlockedBurningTick,
        icdWindowStartFrame: 15,
        icdHitIndex: 0
      })
    ).toThrow(/Aura-blocked tick cannot consume a Burning ICD slot/);
    expect(() =>
      burningStateLogEntrySchema.parse({
        ...auraBlockedBurningTick,
        applicationBlockedReason: null
      })
    ).toThrow(/tick without an ICD decision requires TARGET_AURA_BLOCKED/);
    expect(() =>
      burningStateLogEntrySchema.parse({
        ...burningLog,
        applicationAllowed: false,
        applicationBlockedReason: null
      })
    ).toThrow(/applicationAllowed=false requires BURNING_APPLICATION_ICD/);
    expect(() =>
      burningStateLogEntrySchema.parse({
        ...burningLog,
        tickIndex: 0
      })
    ).toThrow();
    expect(() =>
      burningStateLogEntrySchema.parse({
        ...burningLog,
        icdResetFrames: 119
      })
    ).toThrow();
    const skippedBurningTick = {
      ...burningLog,
      operation: "tick-skipped",
      reactionDamageLogId: null,
      damageEventIds: [],
      tickIndex: 9,
      tickSkipped: true,
      skipReason: "COUNTER_9_SKIP",
      damageAllowed: false,
      icdWindowStartFrame: null,
      icdHitIndex: null,
      applicationAllowed: null,
      applicationBlockedReason: null
    };
    expect(
      burningStateLogEntrySchema.parse(skippedBurningTick)
    ).toEqual(skippedBurningTick);
    expect(() =>
      burningStateLogEntrySchema.parse({
        ...skippedBurningTick,
        damageEventIds: [2]
      })
    ).toThrow(/cannot link damage events/);
    expect(() =>
      burningStateLogEntrySchema.parse({
        ...burningLog,
        applicationAllowed: true,
        applicationBlockedReason: "BURNING_APPLICATION_ICD"
      })
    ).toThrow(/requires applicationAllowed=false/);
    expect(() =>
      burningStateLogEntrySchema.parse({
        ...burningLog,
        operation: "start",
        tickIndex: null,
        tickSkipped: false,
        skipReason: null,
        damageAllowed: null,
        reactionDamageLogId: null,
        damageEventIds: [],
        icdWindowStartFrame: null,
        icdHitIndex: null,
        applicationAllowed: null,
        applicationBlockedReason: null,
        triggerElement: null,
        triggerDamageEventId: null
      })
    ).toThrow(/requires its triggering hit and element/);
    const truncatedBurningStart = {
      ...burningLog,
      operation: "start",
      tickIndex: null,
      tickSkipped: false,
      skipReason: null,
      damageAllowed: null,
      reactionDamageLogId: null,
      damageEventIds: [],
      icdWindowStartFrame: null,
      icdHitIndex: null,
      applicationAllowed: null,
      applicationBlockedReason: null,
      triggerElement: "dendro",
      burningGaugeUnitsAfter: 0,
      fuelGaugeUnitsAfter: 0,
      fuelExpiresAtFrame: null,
      nextTickFrame: null,
      reason: "TARGET_MECHANICS_TRUNCATION"
    };
    expect(
      burningStateLogEntrySchema.parse(truncatedBurningStart)
    ).toEqual(truncatedBurningStart);
    expect(() =>
      burningStateLogEntrySchema.parse({
        ...burningLog,
        operation: "refresh-snapshot",
        reactionDamageLogId: null,
        damageEventIds: [],
        damageAllowed: null,
        icdWindowStartFrame: null,
        icdHitIndex: null,
        applicationAllowed: null,
        applicationBlockedReason: null
      })
    ).toThrow(/cannot claim a tickIndex/);
  });

  it("gates Dendro Aura and applications behind aura-v3, aura-v4, or aura-v5", () => {
    const current = migrateConfig(legacyConfig);
    const withDendroApplication = {
      ...current,
      rotation: [],
      timeline: {
        mode: "legal-frame-v1" as const,
        fps: 60 as const,
        legalityMode: "strict" as const,
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [
          {
            id: "dendro-hit",
            actorId: "a",
            name: "草附着",
            kind: "skill" as const,
            cancelFrame: 1,
            animationEndFrame: 1,
            cooldownFrames: 0,
            hits: [
              {
                id: "dendro-hit-1",
                frame: 0,
                scaling: 1,
                element: "dendro" as const,
                application: {
                  gaugeUnits: 1,
                  icdTag: "dendro",
                  icdGroup: "no-icd" as const
                }
              }
            ]
          }
        ],
        commands: []
      }
    };

    for (const mode of ["aura-v1", "aura-v2"] as const) {
      expect(() =>
        migrateConfig({
          ...withDendroApplication,
          reactionEngine: { mode }
        })
      ).toThrow(
        new RegExp(`${mode} elemental applications currently support`)
      );
      expect(() =>
        migrateConfig({
          ...withDendroApplication,
          reactionEngine: {
            mode,
            initialAura: [{ element: "dendro", gaugeUnits: 1 }]
          },
          timeline: {
            ...withDendroApplication.timeline,
            abilities: []
          }
        })
      ).toThrow(
        /dendro aura requires reactionEngine\.mode to be aura-v3, aura-v4, or aura-v5/
      );
    }

    const parsed = migrateConfig({
      ...withDendroApplication,
      reactionEngine: {
        mode: "aura-v3",
        initialAura: [{ element: "dendro", gaugeUnits: 1 }]
      }
    });
    expect(parsed.reactionEngine).toEqual({
      mode: "aura-v3",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }]
    });
    expect(parsed.timeline?.abilities[0]?.hits?.[0]?.element).toBe(
      "dendro"
    );

    const burningOptIn = migrateConfig({
      ...withDendroApplication,
      reactionEngine: {
        mode: "aura-v4",
        initialAura: [{ element: "dendro", gaugeUnits: 1 }]
      },
      enemy: {
        ...current.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "燃烧测试目标",
            initialAura: [{ element: "dendro", gaugeUnits: 2 }]
          }
        ]
      }
    });
    expect(burningOptIn.reactionEngine).toEqual({
      mode: "aura-v4",
      initialAura: [{ element: "dendro", gaugeUnits: 1 }]
    });
    expect(burningOptIn.enemy.targets?.[0]?.initialAura).toEqual([
      { element: "dendro", gaugeUnits: 2 }
    ]);

    for (const internalAura of ["burning", "burningFuel"]) {
      expect(() =>
        migrateConfig({
          ...withDendroApplication,
          timeline: {
            ...withDendroApplication.timeline,
            abilities: []
          },
          reactionEngine: {
            mode: "aura-v4",
            initialAura: [{ element: internalAura, gaugeUnits: 1 }]
          }
        })
      ).toThrow(/initialAura\.0\.element/);
    }
  });

  it("requires a legal frame timeline for all Aura engine modes", () => {
    const current = migrateConfig(legacyConfig);

    for (const mode of ["aura-v3", "aura-v4"] as const) {
      expect(() =>
        migrateConfig({
          ...current,
          rotation: [],
          reactionEngine: { mode }
        })
      ).toThrow(
        /aura-v1, aura-v2, aura-v3, aura-v4, and aura-v5 currently require timeline\.mode legal-frame-v1/
      );
    }
  });

  it("applies Aura hit validation to aura-v3", () => {
    const current = migrateConfig(legacyConfig);
    const withHit = (hit: Record<string, unknown>) => ({
      ...current,
      rotation: [],
      reactionEngine: { mode: "aura-v3" as const },
      timeline: {
        mode: "legal-frame-v1" as const,
        fps: 60 as const,
        legalityMode: "strict" as const,
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [
          {
            id: "aura-v3-hit",
            actorId: "a",
            name: "Aura v3 validation",
            kind: "skill" as const,
            cancelFrame: 1,
            animationEndFrame: 1,
            cooldownFrames: 0,
            hits: [
              {
                id: "aura-v3-hit-1",
                frame: 0,
                scaling: 1,
                ...hit
              }
            ]
          }
        ],
        commands: []
      }
    });

    expect(() =>
      migrateConfig(
        withHit({
          element: "electro",
          reaction: "melt"
        })
      )
    ).toThrow(
      /manual reaction labels are forbidden in aura-v1, aura-v2, aura-v3, aura-v4, and aura-v5/
    );

    expect(() =>
      migrateConfig(
        withHit({
          element: "electro",
          reactionOverride: "melt"
        })
      )
    ).toThrow(/debugAllowReactionOverride=true/);

    expect(() =>
      migrateConfig(
        withHit({
          element: "pyro",
          reaction: "none",
          ampBase: 2
        })
      )
    ).toThrow(
      /ampBase is a legacy\/debug-only override in Aura modes/
    );

    expect(() =>
      migrateConfig(
        withHit({
          element: "dendro",
          application: {
            gaugeUnits: 1,
            icdTag: "dendro",
            icdGroup: "missing-profile"
          }
        })
      )
    ).toThrow(/unknown ICD profile "missing-profile"/);

    expect(() =>
      migrateConfig(
        withHit({
          element: "physical",
          application: {
            gaugeUnits: 1,
            icdTag: "invalid",
            icdGroup: "no-icd"
          }
        })
      )
    ).toThrow(
      /aura-v3 elemental applications currently support pyro, cryo, hydro, electro, anemo, geo, and dendro hits/
    );

    const parsed = migrateConfig({
      ...withHit({
        element: "dendro",
        reactionOverride: "melt",
        ampBase: 2,
        application: {
          gaugeUnits: 1,
          icdTag: "dendro",
          icdGroup: "no-icd"
        }
      }),
      reactionEngine: {
        mode: "aura-v3",
        debugAllowReactionOverride: true
      }
    });
    expect(
      parsed.timeline?.abilities[0]?.hits?.[0]?.reactionOverride
    ).toBe("melt");
    expect(parsed.timeline?.abilities[0]?.hits?.[0]?.ampBase).toBe(2);

    const legacyParsed = migrateConfig({
      ...legacyConfig,
      rotation: [
        {
          id: "legacy-amp-base",
          actorId: "a",
          name: "Legacy ampBase compatibility",
          at: 0,
          hits: [
            {
              offset: 0,
              scaling: 1,
              element: "pyro",
              reaction: "none",
              ampBase: 2
            }
          ]
        }
      ]
    });
    expect(legacyParsed.rotation[0]?.hits?.[0]?.ampBase).toBe(2);
  });

  it("validates blunt strike and poise damage in both action formats", () => {
    const parsed = migrateConfig({
      ...legacyConfig,
      rotation: [
        {
          id: "blunt-action",
          actorId: "a",
          name: "Blunt Action",
          at: 0,
          hits: [
            {
              offset: 0,
              scaling: 1,
              strikeType: "blunt",
              poiseDamage: 90
            }
          ]
        }
      ]
    });
    expect(parsed.rotation[0]?.hits?.[0]).toMatchObject({
      strikeType: "blunt",
      poiseDamage: 90
    });

    expect(() =>
      migrateConfig({
        ...legacyConfig,
        rotation: [
          {
            id: "invalid-poise",
            actorId: "a",
            name: "Invalid Poise",
            at: 0,
            hits: [
              {
                offset: 0,
                scaling: 1,
                strikeType: "default",
                poiseDamage: 90
              }
            ]
          }
        ]
      })
    ).toThrow(/rotation\.0\.hits\.0\.poiseDamage/);

    const current = migrateConfig(legacyConfig);
    expect(() =>
      migrateConfig({
        ...current,
        rotation: [],
        timeline: {
          mode: "legal-frame-v1",
          fps: 60,
          legalityMode: "strict",
          initialActiveCharacterId: "a",
          swapFrames: 1,
          abilities: [
            {
              id: "invalid-frame-poise",
              actorId: "a",
              name: "Invalid Frame Poise",
              kind: "skill",
              cancelFrame: 1,
              animationEndFrame: 1,
              cooldownFrames: 0,
              hits: [
                {
                  frame: 0,
                  scaling: 1,
                  poiseDamage: 1
                }
              ]
            }
          ],
          commands: []
        }
      })
    ).toThrow(/timeline\.abilities\.0\.hits\.0\.poiseDamage/);
  });

  it("validates shared and target-specific Frozen resistance", () => {
    const current = migrateConfig(legacyConfig);
    const parsed = migrateConfig({
      ...current,
      enemy: {
        ...current.enemy,
        freezeResistance: 0.25,
        targets: [
          {
            id: "enemy-0",
            name: "冻结抗性目标",
            freezeResistance: 1
          }
        ]
      }
    });

    expect(parsed.enemy.freezeResistance).toBe(0.25);
    expect(parsed.enemy.targets?.[0]?.freezeResistance).toBe(1);
    expect(() =>
      migrateConfig({
        ...current,
        enemy: {
          ...current.enemy,
          freezeResistance: 1.01
        }
      })
    ).toThrow(/enemy\.freezeResistance/);
  });
});
