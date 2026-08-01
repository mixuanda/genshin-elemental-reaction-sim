import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import electroChargedGlobalCadenceGoldenV142 from "../../test-vectors/fixtures/electro-charged-global-cadence-1.42.golden.json";
import electroChargedPropagationGolden from "../../test-vectors/fixtures/electro-charged-propagation-1.41.golden.json";
import legacyDefault120sGolden from "../../test-vectors/fixtures/legacy-default-120s-1.41.golden.json";
import legacyDefault120sGoldenV142 from "../../test-vectors/fixtures/legacy-default-120s-1.42.golden.json";
import {
  additiveReactionAuditV142Schema,
  auraSourceGaugeMutationSchema,
  auraStateEntrySchema,
  bloomReactionAuditSchema,
  BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
  BURNING_REACTION_ENGINE_VERSION,
  BURNING_REACTION_SCHEMA_VERSION,
  burningReactionAuditSchema,
  burningStateLogEntrySchema,
  ConfigMigrationError,
  canonicalStringify,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  createSimulationRunManifest,
  createVersionedContentHash,
  crystallizeShieldLogEntrySchema,
  crystallizeShieldTimelinePointSchema,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  DENDRO_CORE_ENGINE_VERSION,
  DENDRO_CORE_SCHEMA_VERSION,
  EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION,
  EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
  EC_NEXT_TARGET_TICK_ENGINE_VERSION,
  EC_NEXT_TARGET_TICK_SCHEMA_VERSION,
  EC_SECONDARY_WET_PROPAGATION_ENGINE_VERSION,
  EC_SECONDARY_WET_PROPAGATION_SCHEMA_VERSION,
  electroChargedCleanupAuditSchema,
  electroChargedCleanupResultReferencesSchema,
  electroChargedGlobalCadenceGoldenFixtureV142Schema,
  electroChargedGlobalCadenceGoldenScenarioIdsV142,
  electroChargedPropagationAuditSchema,
  electroChargedPropagationGoldenFixtureV141Schema,
  electroChargedPropagationModelSchema,
  dendroCoreContactLogEntrySchema,
  dendroCoreContactLogSchema,
  dendroCoreLogEntrySchema,
  dendroCoreLogSchema,
  dendroCoreResultReferencesSchema,
  dendroCoreTimelinePointSchema,
  dendroCoreTimelineSchema,
  ELEMENTAL_ENEMY_RESISTANCE_ENGINE_VERSION,
  ELEMENTAL_ENEMY_RESISTANCE_SCHEMA_VERSION,
  enemyTargetProfileSchema,
  enemyTargetsResultReferencesSchema,
  GENERAL_REACTION_ORDER_ENGINE_VERSION,
  GENERAL_REACTION_ORDER_SCHEMA_VERSION,
  goldenFixtureEnvelopeV141Schema,
  legacyDefault120sGoldenFixtureV141Schema,
  legacyDefault120sGoldenFixtureV142Schema,
  migrateConfig,
  parseSimConfig,
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
  reactionDeliveryModelSchema,
  reactionDeliveryResultReferencesSchema,
  reactionADamageGroupAuditSchema,
  reactionBDamageGroupAuditSchema,
  reactionDamageGroupAuditSchema,
  QUICKEN_BLOOM_TASK_ENGINE_VERSION,
  QUICKEN_BLOOM_TASK_SCHEMA_VERSION,
  resolvedEnemyTargetProfileSchema,
  resolvedWorldHitGeometrySchema,
  SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION,
  SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
  simulationRunManifestSchema,
  simulationRunManifestV142Schema,
  simulationRunManifestV144Schema,
  simConfigSchema,
  simConfigV142Schema,
  simConfigV144Schema,
  TARGET_REACTABLE_PHASE_ENGINE_VERSION,
  TARGET_REACTABLE_PHASE_SCHEMA_VERSION,
  TARGET_TASK_PHASE_ENGINE_VERSION,
  TARGET_TASK_PHASE_SCHEMA_VERSION,
  targetClockAuditSchema,
  targetClockLogSchema,
  targetClockResultReferencesSchema,
  targetHitlagDefinitionSchema,
  targetHitlagLogEntrySchema,
  targetHitlagLogSchema,
  targetTaskPhaseLogEntrySchema,
  targetTaskPhaseLogSchema,
  targetTaskPhaseResultReferencesSchema,
  targetTaskModelSchema,
  targetLifecycleTransitionSchema,
  targetPhaseV2LogEntrySchema,
  targetPhaseV2LogSchema,
  targetPhaseV2ResultReferencesSchema,
  targetPhaseV2TargetTaskSchema,
  targetPhaseV3DeliveryAttemptSchema,
  targetPhaseV3DeliverySchema,
  targetPhaseV3LogEntrySchema,
  targetPhaseV3LogSchema,
  targetPhaseV3TargetTaskSchema,
  TARGET_LOCAL_HITLAG_ENGINE_VERSION,
  TARGET_LOCAL_HITLAG_SCHEMA_VERSION,
  targetStateTimelinePointSchema,
  targetStateTimelineSchema,
  transformativeReactionAuditSchema,
  type EnemyTargetProfile,
  type TargetClockLogEntry,
  type TargetHitlagLogEntry,
  type TargetPhaseV2LogEntry,
  type TargetTaskPhaseLogEntry,
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

const asPre139Wire = <T extends object>(
  config: T
): Omit<
  T,
  "reactionDeliveryModel" | "electroChargedPropagationModel"
> => {
  const {
    reactionDeliveryModel: _reactionDeliveryModel,
    electroChargedPropagationModel:
      _electroChargedPropagationModel,
    ...wire
  } = config as T & {
    reactionDeliveryModel?: unknown;
    electroChargedPropagationModel?: unknown;
  };
  return wire as Omit<
    T,
    "reactionDeliveryModel" | "electroChargedPropagationModel"
  >;
};

const withoutOwn = <
  T extends object,
  K extends keyof T
>(value: T, key: K): Omit<T, K> => {
  const clone = { ...value } as Record<PropertyKey, unknown>;
  delete clone[key];
  return clone as Omit<T, K>;
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

describe("Aura source-slot result contract", () => {
  it("validates optional source-slot ownership without rejecting legacy projections", () => {
    expect(
      auraStateEntrySchema.parse({
        element: "dendro",
        gaugeUnits: 1.2,
        expiresAtFrame: 600,
        sourceSlots: [
          { sourceActorId: "dendro-a", gaugeUnits: 0.4 },
          {
            sourceActorId: "dendro-b",
            gaugeUnits: 1.2 + 5e-10
          }
        ]
      })
    ).toMatchObject({
      gaugeUnits: 1.2,
      sourceSlots: [
        { sourceActorId: "dendro-a", gaugeUnits: 0.4 },
        { sourceActorId: "dendro-b" }
      ]
    });
    expect(
      auraStateEntrySchema.parse({
        element: "pyro",
        gaugeUnits: 0.8,
        expiresAtFrame: 560
      })
    ).not.toHaveProperty("sourceSlots");

    expect(() =>
      auraStateEntrySchema.parse({
        element: "dendro",
        gaugeUnits: 1.2,
        expiresAtFrame: 600,
        sourceSlots: [
          { sourceActorId: "same-owner", gaugeUnits: 1.2 },
          { sourceActorId: "same-owner", gaugeUnits: 0.4 }
        ]
      })
    ).toThrow(/sourceSlots must be unique by sourceActorId/);
    expect(() =>
      auraStateEntrySchema.parse({
        element: "dendro",
        gaugeUnits: 1.1,
        expiresAtFrame: 600,
        sourceSlots: [
          { sourceActorId: "dendro-a", gaugeUnits: 0.4 },
          { sourceActorId: "dendro-b", gaugeUnits: 1.2 }
        ]
      })
    ).toThrow(/maximum sourceSlots gaugeUnits/);
  });

  it("requires every source mutation to conserve its own Gauge budget", () => {
    expect(
      auraSourceGaugeMutationSchema.parse({
        sourceActorId: "dendro-a",
        gaugeUnitsBefore: 0.8,
        consumedGaugeUnits: 0.3,
        gaugeUnitsAfter: 0.5
      })
    ).toEqual({
      sourceActorId: "dendro-a",
      gaugeUnitsBefore: 0.8,
      consumedGaugeUnits: 0.3,
      gaugeUnitsAfter: 0.5
    });
    expect(() =>
      auraSourceGaugeMutationSchema.parse({
        sourceActorId: "dendro-a",
        gaugeUnitsBefore: 0.8,
        consumedGaugeUnits: 0.9,
        gaugeUnitsAfter: 0
      })
    ).toThrow(/cannot exceed gaugeUnitsBefore/);
    expect(() =>
      auraSourceGaugeMutationSchema.parse({
        sourceActorId: "dendro-a",
        gaugeUnitsBefore: 0.8,
        consumedGaugeUnits: 0.3,
        gaugeUnitsAfter: 0.6
      })
    ).toThrow(
      /must equal gaugeUnitsBefore - consumedGaugeUnits/
    );
  });
});

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
      ...asPre139Wire(current),
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
      reactionDeliveryModel: _reactionDeliveryModel,
      electroChargedPropagationModel:
        _electroChargedPropagationModel,
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
    enemyTargets: [
      {
        id: "enemy-0",
        name: "Target",
        level: 110,
        resistance: 0.1,
        defReduction: 0,
        freezeResistance: 0,
        initialAura: [],
        position: { x: 0, y: 0 },
        hitboxRadius: 0
      }
    ],
    damageEvents: [],
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

  it("preserves the exact 1.33 player, target-clock, and Aura contracts when migrating to 1.34", () => {
    const targetClockConfig = makeTargetClockConfig();
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
    const current = migrateConfig({
      ...targetClockConfig,
      characters: targetClockConfig.characters.map(
        (character) => ({
          ...character,
          stats: {
            ...character.stats,
            baseHp: 1_000,
            hpPct: 0,
            flatHp: 0
          }
        })
      ),
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
      },
      reactionEngine: {
        mode: "aura-v5",
        initialAura: [
          { element: "dendro", gaugeUnits: 1 }
        ]
      }
    });
    const historical = {
      ...asPre139Wire(current),
      schemaVersion: TARGET_LOCAL_HITLAG_SCHEMA_VERSION,
      engineVersion: TARGET_LOCAL_HITLAG_ENGINE_VERSION
    };
    const migrated = migrateConfig(historical);

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
    expect(migrated.playerDamageModel).toEqual(
      current.playerDamageModel
    );
    expect(migrated.targetClockModel).toEqual(
      current.targetClockModel
    );
    expect(migrated.reactionEngine).toEqual(
      current.reactionEngine
    );
    expect(() =>
      migrateConfig({
        ...historical,
        engineVersion: "1.33.0-forged"
      })
    ).toThrow(
      /schemaVersion "1\.33\.0" requires "1\.33\.0-target-local-hitlag"/
    );
    expect(() =>
      migrateConfig({
        ...historical,
        reactionEngine: { mode: "aura-v6" }
      })
    ).toThrow(
      /schemaVersion "1\.33\.0" does not support "aura-v6"/
    );
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
    const frozen139Result: any = structuredClone(result);
    frozen139Result.config.schemaVersion =
      SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION;
    frozen139Result.config.engineVersion =
      SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION;
    delete frozen139Result.config.electroChargedPropagationModel;
    expect(() =>
      targetClockResultReferencesSchema.parse(frozen139Result)
    ).not.toThrow();
    expect(() =>
      targetClockResultReferencesSchema.parse({
        ...frozen139Result,
        config: {
          ...frozen139Result.config,
          electroChargedPropagationModel: {
            mode: "single-target-v1"
          }
        }
      })
    ).toThrow(/pre-1\.41 result config/);

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
      enemyTargets: [
        {
          id: "enemy-0",
          name: "敌人 0",
          level: config.enemy.level,
          resistance: config.enemy.resistance,
          defReduction: config.enemy.defReduction,
          freezeResistance: 0,
          initialAura: [],
          position: null,
          hitboxRadius: 0
        }
      ],
      damageEvents: [],
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

describe("1.34 general reaction order contract", () => {
  const makeAuraV6Config = () => {
    const current = migrateConfig(legacyConfig);
    const ability = {
      id: "v6-pyro-application",
      actorId: "a",
      name: "v6 Pyro application",
      kind: "skill" as const,
      cancelFrame: 1,
      animationEndFrame: 1,
      cooldownFrames: 0,
      hits: [
        {
          id: "v6-pyro-application-hit",
          frame: 0,
          scaling: 1,
          element: "pyro" as const,
          application: {
            gaugeUnits: 1,
            icdTag: "v6-pyro",
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
    return {
      ...current,
      enemy: {
        ...current.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "Positioned v6 target",
            position: { x: 0, y: 0 }
          }
        ]
      },
      rotation: [],
      timeline: {
        mode: "legal-frame-v1" as const,
        fps: 60 as const,
        legalityMode: "strict" as const,
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [ability],
        commands: []
      },
      reactionEngine: { mode: "aura-v6" as const }
    };
  };

  it("strictly accepts aura-v6 under the current schema/engine pair", () => {
    const config = makeAuraV6Config();
    const parsed = migrateConfig(config);
    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.engineVersion).toBe(CURRENT_ENGINE_VERSION);
    expect(parsed.reactionEngine?.mode).toBe("aura-v6");

    expect(() =>
      migrateConfig({
        ...config,
        reactionEngine: {
          mode: "aura-v6",
          unversionedOrder: true
        }
      })
    ).toThrow(/Unrecognized key/);
    expect(() =>
      migrateConfig({
        ...config,
        engineVersion: TARGET_LOCAL_HITLAG_ENGINE_VERSION
      })
    ).toThrow(/engineVersion/);

    for (const historical of [
      {
        schemaVersion: TARGET_LOCAL_HITLAG_SCHEMA_VERSION,
        engineVersion: TARGET_LOCAL_HITLAG_ENGINE_VERSION
      },
      {
        schemaVersion: PLAYER_REACTION_DAMAGE_SCHEMA_VERSION,
        engineVersion: PLAYER_REACTION_DAMAGE_ENGINE_VERSION
      },
      {
        schemaVersion: "1.0.0",
        engineVersion: "1.0.0-compat"
      }
    ] as const) {
      expect(() =>
        migrateConfig({
          ...asPre139Wire(config),
          ...historical
        })
      ).toThrow(
        new RegExp(
          `schemaVersion "${historical.schemaVersion.replaceAll(".", "\\.")}" does not support "aura-v6"`
        )
      );
    }
  });

  it("migrates the frozen 1.35 aura-v6, per-element resistance, player, and target-clock contracts exactly", () => {
    const current = makeAuraV6Config();
    const sharedResistances = {
      pyro: 0.1,
      cryo: 0.2,
      hydro: 0.3,
      electro: 0.4,
      anemo: 0.5,
      geo: 0.6,
      dendro: 0.7,
      physical: 0.8
    };
    const targetResistances = {
      ...sharedResistances,
      dendro: -0.15,
      physical: 1.2
    };
    const playerDamageModel = {
      mode: "reaction-self-v1" as const,
      position: { x: 0, y: 0 },
      hitboxRadius: 0.5,
      shieldMode: "crystallize-v1" as const,
      zeroHpPolicy: "clamp-and-continue" as const,
      characters: [
        {
          actorId: "a",
          initialHpRatio: 0.75,
          resistances: {
            pyro: 0.11,
            cryo: 0.12,
            hydro: 0.13,
            electro: 0.14,
            anemo: 0.15,
            geo: 0.16,
            dendro: 0.17,
            physical: 0.18
          }
        }
      ]
    };
    const targetClockModel = {
      mode: "target-local-hitlag-v1" as const
    };
    const historical = {
      ...asPre139Wire(current),
      schemaVersion: ELEMENTAL_ENEMY_RESISTANCE_SCHEMA_VERSION,
      engineVersion: ELEMENTAL_ENEMY_RESISTANCE_ENGINE_VERSION,
      characters: current.characters.map((character) => ({
        ...character,
        stats: {
          ...character.stats,
          baseHp: 12_345
        }
      })),
      enemy: {
        ...current.enemy,
        resistances: sharedResistances,
        targets: current.enemy.targets.map((target) => ({
          ...target,
          resistances: targetResistances
        }))
      },
      reactionEngine: { mode: "aura-v6" as const },
      playerDamageModel,
      targetClockModel
    };

    expect(migrateConfig(historical)).toEqual({
      ...historical,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION,
      reactionDeliveryModel: {
        mode: "deferred-event-heap-v1"
      },
      electroChargedPropagationModel: {
        mode: "single-target-v1"
      }
    });
  });

  it("preserves the frozen compatibility ampBase multiplier across 1.35 to 1.36", () => {
    const current = migrateConfig({
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
    const historical = {
      ...asPre139Wire(current),
      schemaVersion: ELEMENTAL_ENEMY_RESISTANCE_SCHEMA_VERSION,
      engineVersion: ELEMENTAL_ENEMY_RESISTANCE_ENGINE_VERSION
    };

    expect(migrateConfig(historical)).toEqual({
      ...historical,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION,
      reactionDeliveryModel: {
        mode: "deferred-event-heap-v1"
      },
      electroChargedPropagationModel: {
        mode: "single-target-v1"
      }
    });
  });

  it("fails closed on aura-v7 or a forged engine under the frozen 1.35 identity", () => {
    const current = makeAuraV6Config();
    const historical = {
      ...asPre139Wire(current),
      schemaVersion: ELEMENTAL_ENEMY_RESISTANCE_SCHEMA_VERSION,
      engineVersion: ELEMENTAL_ENEMY_RESISTANCE_ENGINE_VERSION
    };

    expect(() =>
      migrateConfig({
        ...historical,
        reactionEngine: { mode: "aura-v7" }
      })
    ).toThrow(
      /reactionEngine\.mode: schemaVersion "1\.35\.0" does not support "aura-v7"/
    );
    expect(() =>
      migrateConfig({
        ...historical,
        engineVersion: "1.35.0-forged"
      })
    ).toThrow(
      /schemaVersion "1\.35\.0" requires "1\.35\.0-elemental-enemy-resistance"/
    );
  });

  it("migrates the frozen 1.34 player, target-clock, scalar-resistance, and aura-v6 contracts unchanged", () => {
    const current = makeAuraV6Config();
    const playerDamageModel = {
      mode: "reaction-self-v1" as const,
      position: { x: 0, y: 0 },
      hitboxRadius: 0.5,
      shieldMode: "crystallize-v1" as const,
      zeroHpPolicy: "clamp-and-continue" as const,
      characters: [
        {
          actorId: "a",
          initialHpRatio: 1,
          resistances: {
            pyro: 0.1,
            cryo: 0.1,
            hydro: 0.1,
            electro: 0.1,
            anemo: 0.1,
            geo: 0.1,
            dendro: 0.1,
            physical: 0.1
          }
        }
      ]
    };
    const targetClockModel = {
      mode: "target-local-hitlag-v1" as const
    };
    const historical = {
      ...asPre139Wire(current),
      schemaVersion: GENERAL_REACTION_ORDER_SCHEMA_VERSION,
      engineVersion: GENERAL_REACTION_ORDER_ENGINE_VERSION,
      characters: current.characters.map((character) => ({
        ...character,
        stats: {
          ...character.stats,
          baseHp: 1_000
        }
      })),
      enemy: {
        ...current.enemy,
        targets: current.enemy.targets.map((target) => ({
          ...target,
          resistance: 0.35
        }))
      },
      playerDamageModel,
      targetClockModel
    };
    const migrated = migrateConfig(historical);

    expect(migrated).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION,
      enemy: {
        resistance: historical.enemy.resistance,
        targets: [{ resistance: 0.35 }]
      },
      reactionEngine: { mode: "aura-v6" },
      playerDamageModel,
      targetClockModel
    });
    expect("resistances" in migrated.enemy).toBe(false);
    expect(
      "resistances" in (migrated.enemy.targets?.[0] ?? {})
    ).toBe(false);
    expect(() =>
      migrateConfig({
        ...historical,
        engineVersion: "1.34.0-forged"
      })
    ).toThrow(
      /schemaVersion "1\.34\.0" requires "1\.34\.0-general-reaction-order"/
    );
  });

  it("inherits aura-v5 legal-frame, target-position, and geometry boundaries", () => {
    const config = makeAuraV6Config();
    expect(() =>
      migrateConfig(withoutOwn(config, "timeline"))
    ).toThrow(/require timeline\.mode legal-frame-v1/);
    expect(() =>
      migrateConfig({
        ...config,
        enemy: withoutOwn(config.enemy, "targets")
      })
    ).toThrow(/aura-v6 requires enemy\.targets/);
    expect(() =>
      migrateConfig({
        ...config,
        enemy: {
          ...config.enemy,
          targets: [
            { id: "enemy-0", name: "Unpositioned v6 target" }
          ]
        }
      })
    ).toThrow(/aura-v6 requires a position/);

    const ability = config.timeline.abilities[0]!;
    expect(() =>
      migrateConfig({
        ...config,
        timeline: {
          ...config.timeline,
          abilities: [
            {
              ...ability,
              hits: ability.hits.map((hit) => ({
                ...withoutOwn(hit, "geometry")
              }))
            }
          ]
        }
      })
    ).toThrow(
      /aura-v6 Pyro\/Electro elemental applications require explicit geometry/
    );
  });

  it("strictly validates each ordered transformative-reaction audit", () => {
    const overload = {
      reaction: "overload",
      damageElement: "pyro",
      scheduled: true,
      damageFrame: 1,
      radius: 3,
      baseMultiplier: 2.75,
      blockedReason: null,
      nextAvailableFrame: 6,
      statusEffect: null
    } as const;
    const superconduct = {
      reaction: "superconduct",
      damageElement: "cryo",
      scheduled: true,
      damageFrame: 1,
      radius: 3,
      baseMultiplier: 1.5,
      blockedReason: null,
      nextAvailableFrame: 6,
      statusEffect: {
        key: "superconduct-physical-resistance",
        label: "Superconduct physical resistance",
        element: "physical",
        resShred: 0.4,
        durationFrames: 720
      }
    } as const;

    expect(transformativeReactionAuditSchema.parse(overload)).toEqual(
      overload
    );
    expect(
      transformativeReactionAuditSchema.parse(superconduct)
    ).toEqual(superconduct);
    expect(() =>
      transformativeReactionAuditSchema.parse({
        ...overload,
        scheduled: false
      })
    ).toThrow(/require an explicit reason/);
    expect(() =>
      transformativeReactionAuditSchema.parse({
        ...superconduct,
        damageElement: "electro"
      })
    ).toThrow(/must match the reaction contract/);
    expect(() =>
      transformativeReactionAuditSchema.parse({
        ...overload,
        unversionedField: true
      })
    ).toThrow(/Unrecognized key/);
  });
});

describe("1.38 target Reactable phase config and frozen 1.37 migration", () => {
  const makeAuraV7Config = () => {
    const current = migrateConfig(legacyConfig);
    return {
      ...current,
      enemy: {
        ...current.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "Target task phase target",
            position: { x: 0, y: 0 }
          }
        ]
      },
      rotation: [],
      timeline: {
        mode: "legal-frame-v1" as const,
        fps: 60 as const,
        legalityMode: "strict" as const,
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [],
        commands: []
      },
      reactionEngine: { mode: "aura-v7" as const }
    };
  };

  const burningPhase: TargetTaskPhaseLogEntry = {
    id: 0,
    targetId: "enemy-0",
    targetName: "First target",
    globalFrame: 10,
    timeSeconds: 10 / 60,
    targetFrame: 8,
    targetOrder: 0,
    wakeKind: "burning-tick",
    eventType: "burningTick",
    eventPriority: 0.5,
    eventSequence: 4,
    intraEventSequence: 0,
    auraBeforeTasks: [],
    auraAfterTasks: [],
    auraAfterDecay: [],
    burningStateLogIds: [1, 3],
    hitResolutionLogIds: [2, 5],
    reactionTaskLogIds: [0, 4]
  };

  const incomingPhase: TargetTaskPhaseLogEntry = {
    id: 1,
    targetId: "enemy-1",
    targetName: "Second target",
    globalFrame: 10,
    timeSeconds: 10 / 60,
    targetFrame: 10,
    targetOrder: 1,
    wakeKind: "incoming",
    eventType: "hit",
    eventPriority: 3,
    eventSequence: 5,
    intraEventSequence: 0,
    auraBeforeTasks: [],
    auraAfterTasks: [],
    auraAfterDecay: [],
    burningStateLogIds: [],
    hitResolutionLogIds: [6],
    reactionTaskLogIds: []
  };

  const laterFirstTargetPhase: TargetTaskPhaseLogEntry = {
    ...incomingPhase,
    id: 2,
    targetId: "enemy-0",
    targetName: "First target",
    globalFrame: 15,
    timeSeconds: 15 / 60,
    targetFrame: 8,
    targetOrder: 0,
    eventType: "reactionDamage",
    eventPriority: 5,
    eventSequence: 9,
    hitResolutionLogIds: [],
    reactionTaskLogIds: [7]
  };

  it("migrates the frozen 1.36 pair and all legacy inputs to the legacy event heap", () => {
    const {
      targetTaskModel: _targetTaskModel,
      reactionDeliveryModel: _reactionDeliveryModel,
      electroChargedPropagationModel:
        _electroChargedPropagationModel,
      ...wire136
    } = makeAuraV7Config();
    const historical = {
      ...wire136,
      schemaVersion: QUICKEN_BLOOM_TASK_SCHEMA_VERSION,
      engineVersion: QUICKEN_BLOOM_TASK_ENGINE_VERSION
    };

    for (const mode of [
      "aura-v1",
      "aura-v2",
      "aura-v3",
      "aura-v4",
      "aura-v5",
      "aura-v6",
      "aura-v7"
    ] as const) {
      const versioned = {
        ...historical,
        reactionEngine: { mode }
      };
      expect(migrateConfig(versioned)).toEqual({
        ...versioned,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        engineVersion: CURRENT_ENGINE_VERSION,
        targetTaskModel: { mode: "legacy-event-heap-v1" },
        reactionDeliveryModel: {
          mode: "deferred-event-heap-v1"
        },
        electroChargedPropagationModel: {
          mode: "single-target-v1"
        }
      });
    }

    const current = migrateConfig(legacyConfig);
    const {
      targetTaskModel: _currentTargetTaskModel,
      reactionDeliveryModel: _currentReactionDeliveryModel,
      electroChargedPropagationModel:
        _currentElectroChargedPropagationModel,
      ...historicalWire
    } = current;
    for (const identity of [
      {
        schemaVersion: ELEMENTAL_ENEMY_RESISTANCE_SCHEMA_VERSION,
        engineVersion: ELEMENTAL_ENEMY_RESISTANCE_ENGINE_VERSION
      },
      {
        schemaVersion: TARGET_LOCAL_HITLAG_SCHEMA_VERSION,
        engineVersion: TARGET_LOCAL_HITLAG_ENGINE_VERSION
      },
      {
        schemaVersion: "1.0.0",
        engineVersion: "1.0.0-compat"
      }
    ] as const) {
      expect(
        migrateConfig({ ...historicalWire, ...identity })
          .targetTaskModel
      ).toEqual({ mode: "legacy-event-heap-v1" });
    }
    expect(migrateConfig(legacyConfig).targetTaskModel).toEqual({
      mode: "legacy-event-heap-v1"
    });
  });

  it("rejects a forged 1.36 engine and historical target-phase opt-in", () => {
    const current = migrateConfig(legacyConfig);
    const historical = {
      ...asPre139Wire(current),
      schemaVersion: QUICKEN_BLOOM_TASK_SCHEMA_VERSION,
      engineVersion: QUICKEN_BLOOM_TASK_ENGINE_VERSION
    };

    expect(() =>
      migrateConfig({
        ...historical,
        engineVersion: "1.36.0-forged"
      })
    ).toThrow(
      /schemaVersion "1\.36\.0" requires "1\.36\.0-quicken-bloom-task"/
    );
    expect(() =>
      migrateConfig({
        ...historical,
        targetTaskModel: { mode: "target-phase-v1" }
      })
    ).toThrow(
      /schemaVersion "1\.36\.0" does not support target-phase task scheduling/
    );
  });

  it("strictly preserves the frozen 1.37 legacy/v1 mode and rejects missing, v2, or forged wires", () => {
    const current = makeAuraV7Config();
    const historicalBase = {
      ...asPre139Wire(current),
      schemaVersion: TARGET_TASK_PHASE_SCHEMA_VERSION,
      engineVersion: TARGET_TASK_PHASE_ENGINE_VERSION
    };
    for (const mode of [
      "legacy-event-heap-v1",
      "target-phase-v1"
    ] as const) {
      expect(
        migrateConfig({
          ...historicalBase,
          targetTaskModel: { mode }
        }).targetTaskModel
      ).toEqual({ mode });
    }
    expect(() =>
      migrateConfig({
        ...historicalBase,
        engineVersion: "1.37.0-forged",
        targetTaskModel: { mode: "target-phase-v1" }
      })
    ).toThrow(/schemaVersion "1\.37\.0" requires/);
    const missingModel = {
      ...historicalBase
    } as Record<string, unknown>;
    delete missingModel.targetTaskModel;
    expect(() => migrateConfig(missingModel)).toThrow(
      /requires an explicit legacy-event-heap-v1 or target-phase-v1/
    );
    expect(() =>
      migrateConfig({
        ...historicalBase,
        targetTaskModel: { mode: "target-phase-v2" }
      })
    ).toThrow(
      /requires an explicit legacy-event-heap-v1 or target-phase-v1/
    );
  });

  it("requires the target task model field under the current identity", () => {
    const current = migrateConfig(legacyConfig);
    const missingModel = {
      ...current
    } as Record<string, unknown>;
    delete missingModel.targetTaskModel;

    expect(() => migrateConfig(missingModel)).toThrow(
      /targetTaskModel/
    );
  });

  it("strictly accepts the established modes and fail-closes v2 to legal 60 FPS Aura v7", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe("1.44.0");
    expect(CURRENT_ENGINE_VERSION).toBe(
      "1.44.0-burning-callback-delivery"
    );
    expect(TARGET_TASK_PHASE_SCHEMA_VERSION).toBe("1.37.0");
    expect(TARGET_TASK_PHASE_ENGINE_VERSION).toBe(
      "1.37.0-target-task-phase"
    );
    expect(
      targetTaskModelSchema.parse({
        mode: "legacy-event-heap-v1"
      })
    ).toEqual({ mode: "legacy-event-heap-v1" });
    expect(() =>
      targetTaskModelSchema.parse({
        mode: "target-phase-v1",
        unversionedField: true
      })
    ).toThrow(/Unrecognized key/);

    const rotationOnly = migrateConfig({
      ...migrateConfig(legacyConfig),
      targetTaskModel: { mode: "target-phase-v1" }
    });
    expect(rotationOnly.timeline).toBeUndefined();
    expect(rotationOnly.targetTaskModel).toEqual({
      mode: "target-phase-v1"
    });

    const auraV7 = migrateConfig({
      ...makeAuraV7Config(),
      targetTaskModel: { mode: "target-phase-v1" }
    });
    expect(auraV7.targetTaskModel.mode).toBe("target-phase-v1");
    expect(auraV7.reactionEngine?.mode).toBe("aura-v7");

    expect(() =>
      migrateConfig({
        ...makeAuraV7Config(),
        reactionEngine: { mode: "aura-v6" },
        targetTaskModel: { mode: "target-phase-v1" }
      })
    ).toThrow(
      /target-phase-v1 requires reactionEngine\.mode aura-v7/
    );

    expect(
      migrateConfig({
        ...makeAuraV7Config(),
        targetTaskModel: { mode: "target-phase-v2" }
      }).targetTaskModel
    ).toEqual({ mode: "target-phase-v2" });
    expect(() =>
      migrateConfig({
        ...withoutOwn(makeAuraV7Config(), "timeline"),
        targetTaskModel: { mode: "target-phase-v2" }
      })
    ).toThrow(/requires timeline\.mode legal-frame-v1/);
    expect(() =>
      migrateConfig({
        ...makeAuraV7Config(),
        reactionEngine: { mode: "aura-v6" },
        targetTaskModel: { mode: "target-phase-v2" }
      })
    ).toThrow(/target-phase-v2 requires reactionEngine\.mode aura-v7/);
  });

  it("strictly validates target task phase entries and their wake discriminant", () => {
    expect(
      targetTaskPhaseLogEntrySchema.parse(burningPhase)
    ).toEqual(burningPhase);
    expect(
      targetTaskPhaseLogEntrySchema.parse(incomingPhase)
    ).toEqual(incomingPhase);
    expect(() =>
      targetTaskPhaseLogEntrySchema.parse({
        ...burningPhase,
        eventType: "hit"
      })
    ).toThrow();
    expect(() =>
      targetTaskPhaseLogEntrySchema.parse({
        ...incomingPhase,
        eventType: "burningTick"
      })
    ).toThrow();
    expect(() =>
      targetTaskPhaseLogEntrySchema.parse({
        ...incomingPhase,
        eventPriority: 1
      })
    ).toThrow(/hit priority 3/);
    expect(() =>
      targetTaskPhaseLogEntrySchema.parse({
        ...laterFirstTargetPhase,
        eventPriority: 4
      })
    ).toThrow(/reactionDamage priority/);
    expect(() =>
      targetTaskPhaseLogEntrySchema.parse({
        ...burningPhase,
        unversionedField: true
      })
    ).toThrow(/Unrecognized key/);
  });

  it("binds phase time and target clocks and requires increasing referenced ids", () => {
    expect(() =>
      targetTaskPhaseLogEntrySchema.parse({
        ...burningPhase,
        timeSeconds: 0
      })
    ).toThrow(/globalFrame \/ 60/);
    expect(() =>
      targetTaskPhaseLogEntrySchema.parse({
        ...burningPhase,
        targetFrame: 11
      })
    ).toThrow(/cannot exceed globalFrame/);

    for (const field of [
      "burningStateLogIds",
      "hitResolutionLogIds",
      "reactionTaskLogIds"
    ] as const) {
      expect(() =>
        targetTaskPhaseLogEntrySchema.parse({
          ...burningPhase,
          [field]: [3, 3]
        })
      ).toThrow(/strictly increasing/);
      expect(() =>
        targetTaskPhaseLogEntrySchema.parse({
          ...burningPhase,
          [field]: [3, 2]
        })
      ).toThrow(/strictly increasing/);
    }
  });

  it("validates deterministic array order and per-target clock progression", () => {
    expect(
      targetTaskPhaseLogSchema.parse([
        burningPhase,
        incomingPhase,
        laterFirstTargetPhase
      ])
    ).toEqual([
      burningPhase,
      incomingPhase,
      laterFirstTargetPhase
    ]);

    expect(() =>
      targetTaskPhaseLogSchema.parse([
        burningPhase,
        { ...incomingPhase, id: 2 }
      ])
    ).toThrow(/ids must be contiguous/);
    expect(() =>
      targetTaskPhaseLogSchema.parse([
        { ...burningPhase, targetOrder: 1 },
        { ...incomingPhase, targetOrder: 0 }
      ])
    ).toThrow(/sorted by \(globalFrame, targetOrder\)/);
    expect(() =>
      targetTaskPhaseLogSchema.parse([
        burningPhase,
        {
          ...incomingPhase,
          targetId: burningPhase.targetId,
          targetName: burningPhase.targetName
        }
      ])
    ).toThrow(/unique by \(globalFrame, targetId\)/);
    expect(() =>
      targetTaskPhaseLogSchema.parse([
        burningPhase,
        {
          ...laterFirstTargetPhase,
          id: 1,
          targetFrame: burningPhase.targetFrame - 1
        }
      ])
    ).toThrow(/targetFrame must be nondecreasing/);
    expect(() =>
      targetTaskPhaseLogSchema.parse([
        {
          ...burningPhase,
          globalFrame: 15,
          timeSeconds: 15 / 60
        },
        {
          ...laterFirstTargetPhase,
          id: 1,
          globalFrame: 10,
          timeSeconds: 10 / 60
        }
      ])
    ).toThrow(/globalFrame must strictly increase/);
  });
});

describe("1.39 Shatter recursive delivery config and references", () => {
  const makeLegalAuraV7Config = () => {
    const current = migrateConfig(legacyConfig);
    return {
      ...current,
      enemy: {
        ...current.enemy,
        targets: [
          {
            id: "enemy-0",
            name: "Recursive Shatter target",
            position: { x: 0, y: 0 }
          }
        ]
      },
      rotation: [],
      timeline: {
        mode: "legal-frame-v1" as const,
        fps: 60 as const,
        legalityMode: "strict" as const,
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [],
        commands: []
      },
      reactionEngine: { mode: "aura-v7" as const }
    };
  };

  const noShatterReactionAudit = {
    reactions: [] as const,
    mechanicsTruncation: null,
    transformativeReaction: null,
    burningReaction: null,
    shatterReaction: null,
    swirlReactions: [] as const
  };
  type TestDamageGroupReaction =
    | "overload"
    | "electroCharged"
    | "superconduct"
    | "bloom"
    | "burgeon"
    | "hyperbloom"
    | "shatter"
    | "swirlPyro"
    | "swirlHydro"
    | "swirlCryo"
    | "swirlElectro";
  const makeDamageGroupDecision = (
    reaction: TestDamageGroupReaction,
    targetId: string,
    windowStartFrame: number,
    hitIndex = 0,
    sourceActorId = "a"
  ) => {
    const reactionB =
      reaction === "overload" ||
      reaction === "electroCharged";
    const damageAllowed = reactionB
      ? hitIndex === 0
      : hitIndex < 2;
    return {
      reaction,
      sourceActorId,
      targetId,
      windowStartFrame,
      hitIndex,
      resetFrames: 30 as const,
      sequence: reactionB
        ? ([true, false] as const)
        : ([true, true, false] as const),
      damageAllowed,
      blockedReason: damageAllowed
        ? null
        : reactionB
          ? ("REACTION_B_DAMAGE_ICD" as const)
          : ("REACTION_A_DAMAGE_ICD" as const)
    };
  };
  const makeTriggeredShatterReactionAudit = (
    scheduled: boolean,
    damageFrame = 12
  ) => ({
    reactions: [] as const,
    mechanicsTruncation: null,
    transformativeReaction: null,
    burningReaction: null,
    shatterReaction: {
      reaction: "shatter" as const,
      strikeType: "default" as const,
      triggered: true,
      scheduled,
      damageElement: "physical" as const,
      damageFrame,
      baseMultiplier: 3,
      blockedReason: scheduled
        ? null
        : ("REACTION_DAMAGE_GCD" as const),
      nextAvailableFrame: damageFrame + 12,
      frozenGaugeBefore: 1,
      poiseConsumedGaugeUnits: 0,
      frozenGaugeAfterPoise: 1,
      shatterConsumedGaugeUnits: 1,
      frozenGaugeAfter: 0
    },
    swirlReactions: [] as const
  });

  const makeOneShotTransformativeAudit = (
    reaction: "overload" | "superconduct",
    triggerFrame = 12,
    scheduled = true
  ) => ({
    reaction,
    scheduled,
    damageFrame: triggerFrame + 1,
    blockedReason: scheduled
      ? null
      : ("REACTION_DAMAGE_GCD" as const),
    nextAvailableFrame: triggerFrame + 6
  });

  const makeRecursiveReferenceResult = () => ({
    schemaVersion: SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
    engineVersion: SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION,
    config: {
      schemaVersion: SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
      engineVersion: SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION,
      duration: 1,
      enemy: {
        targets: [{ id: "enemy-0" }]
      },
      reactionDeliveryModel: {
        mode: "shatter-recursive-zero-delay-v1" as const
      }
    },
    damageEvents: [
      {
        id: 0,
        kind: "transformative-reaction" as const,
        parentDamageEventId: 1,
        eventPriority: 3,
        eventSequence: 7,
        sourceActorId: "a",
        targetId: "enemy-0",
        frame: 12,
        element: "physical" as const,
        reaction: "shatter" as const,
        finalDamage: 100,
        damageFactors: {
          groupMultiplier: 1
        },
        transformativeReactionFactors: {
          baseMultiplier: 3
        },
        reactionAudit: noShatterReactionAudit
      },
      {
        id: 1,
        kind: "direct" as const,
        parentDamageEventId: null,
        eventPriority: 3,
        eventSequence: 7,
        sourceActorId: "a",
        targetId: "enemy-0",
        frame: 12,
        element: "geo" as const,
        reaction: "none" as const,
        reactionAudit: makeTriggeredShatterReactionAudit(true)
      }
    ],
    reactionDamageLog: [
      {
        id: 0,
        reaction: "shatter" as const,
        triggerDamageEventId: 1,
        sourceActorId: "a",
        sourceTargetId: "enemy-0",
        triggerFrame: 12,
        damageFrame: 12,
        scheduled: true,
        withinSimulation: true,
        blockedReason: null,
        nextAvailableFrame: 24,
        scheduleKind: "one-shot" as const,
        targetingMode: "single-target" as const,
        checkedTargetIds: ["enemy-0"],
        hitTargetIds: ["enemy-0"],
        damageEventIds: [0],
        damageGroupBlockedTargetIds: [],
        damageGroupDecisions: [
          makeDamageGroupDecision(
            "shatter",
            "enemy-0",
            12
          )
        ]
      }
    ]
  });

  const makeDeferredReferenceResult = () => ({
    schemaVersion: SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
    engineVersion: SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION,
    config: {
      schemaVersion: SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
      engineVersion: SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION,
      duration: 1,
      enemy: {
        targets: [{ id: "enemy-0" }, { id: "enemy-1" }]
      },
      reactionDeliveryModel: {
        mode: "deferred-event-heap-v1" as const
      }
    },
    damageEvents: [
      {
        id: 0,
        kind: "direct" as const,
        parentDamageEventId: null,
        eventPriority: 3,
        eventSequence: 7,
        sourceActorId: "a",
        targetId: "enemy-0",
        frame: 12,
        element: "pyro" as const,
        reaction: "overload" as const,
        reactionAudit: {
          reactions: ["overload" as const],
          mechanicsTruncation: null,
          transformativeReaction:
            makeOneShotTransformativeAudit("overload"),
          burningReaction: null,
          shatterReaction: null,
          swirlReactions: [] as const
        }
      },
      {
        id: 1,
        kind: "transformative-reaction" as const,
        parentDamageEventId: 0,
        eventPriority: 5,
        eventSequence: 8,
        sourceActorId: "a",
        targetId: "enemy-1",
        frame: 13,
        element: "pyro" as const,
        reaction: "overload" as const,
        finalDamage: 100,
        damageFactors: {
          groupMultiplier: 1
        },
        reactionAudit: {
          reactions: ["overload" as const],
          mechanicsTruncation: null,
          transformativeReaction: null,
          burningReaction: null,
          shatterReaction: null,
          swirlReactions: [] as const
        }
      }
    ],
    reactionDamageLog: [
      {
        id: 0,
        reaction: "overload" as const,
        triggerDamageEventId: 0,
        sourceActorId: "a",
        sourceTargetId: "enemy-0",
        triggerFrame: 12,
        damageFrame: 13,
        scheduled: true,
        withinSimulation: true,
        blockedReason: null,
        nextAvailableFrame: 18,
        scheduleKind: "one-shot" as const,
        targetingMode: "radius" as const,
        checkedTargetIds: ["enemy-0", "enemy-1"],
        hitTargetIds: ["enemy-1"],
        damageEventIds: [1],
        damageGroupBlockedTargetIds: [],
        damageGroupDecisions: [
          makeDamageGroupDecision(
            "overload",
            "enemy-1",
            13
          )
        ]
      }
    ]
  });

  const makeDeferredShatterReferenceResult = () => {
    const recursive = makeRecursiveReferenceResult();
    return {
      ...recursive,
      config: {
        ...recursive.config,
        reactionDeliveryModel: {
          mode: "deferred-event-heap-v1" as const
        }
      },
      damageEvents: [
        {
          ...recursive.damageEvents[1],
          id: 0
        },
        {
          ...recursive.damageEvents[0],
          id: 1,
          parentDamageEventId: 0,
          eventPriority: 5,
          eventSequence: 8
        }
      ],
      reactionDamageLog: [
        {
          ...recursive.reactionDamageLog[0],
          triggerDamageEventId: 0,
          damageEventIds: [1]
        }
      ]
    };
  };

  const makeUntriggeredShatterReferenceResult = (
    blockedReason:
      | "NO_FROZEN_AURA"
      | "FROZEN_DEPLETED_BY_POISE" = "NO_FROZEN_AURA"
  ) => {
    const recursive = makeRecursiveReferenceResult();
    return {
      ...recursive,
      damageEvents: [
        {
          ...recursive.damageEvents[1],
          id: 0,
          reactionAudit: {
            ...noShatterReactionAudit,
            shatterReaction: {
              ...makeTriggeredShatterReactionAudit(false)
                .shatterReaction,
              strikeType:
                blockedReason ===
                "FROZEN_DEPLETED_BY_POISE"
                  ? ("blunt" as const)
                  : ("default" as const),
              triggered: false,
              blockedReason,
              nextAvailableFrame: null,
              frozenGaugeBefore:
                blockedReason ===
                "FROZEN_DEPLETED_BY_POISE"
                  ? 1
                  : 0,
              poiseConsumedGaugeUnits:
                blockedReason ===
                "FROZEN_DEPLETED_BY_POISE"
                  ? 1
                  : 0,
              frozenGaugeAfterPoise: 0,
              shatterConsumedGaugeUnits: 0,
              frozenGaugeAfter: 0
            }
          }
        }
      ],
      reactionDamageLog: []
    };
  };

  const makeGcdBlockedShatterReferenceResult = () => {
    const recursive = makeRecursiveReferenceResult();
    return {
      ...recursive,
      damageEvents: [
        {
          ...recursive.damageEvents[1],
          id: 0,
          reactionAudit:
            makeTriggeredShatterReactionAudit(false)
        }
      ],
      reactionDamageLog: [
        {
          ...recursive.reactionDamageLog[0],
          triggerDamageEventId: 0,
          scheduled: false,
          withinSimulation: false,
          blockedReason: "REACTION_DAMAGE_GCD" as const,
          checkedTargetIds: [],
          hitTargetIds: [],
          damageEventIds: []
        }
      ]
    };
  };

  const makeSwirlReferenceResult = () => {
    const deferred = makeDeferredReferenceResult();
    const trigger = {
      ...deferred.damageEvents[0],
      element: "anemo" as const,
      reaction: "swirlPyro" as const,
      reactionAudit: {
        ...deferred.damageEvents[0]!.reactionAudit,
        reactions: ["swirlPyro" as const],
        transformativeReaction: null,
        swirlReactions: [
          {
            reaction: "swirlPyro" as const,
            scheduled: true,
            blockedReason: null,
            nextAvailableFrame: 18,
            selfDamageFrame: 13,
            propagationDamageFrame: 17
          }
        ]
      }
    };
    const selfDamage = {
      ...deferred.damageEvents[1],
      targetId: "enemy-0",
      element: "pyro" as const,
      reaction: "swirlPyro" as const
    };
    const propagationDamage = {
      ...selfDamage,
      id: 2,
      targetId: "enemy-1",
      frame: 17,
      eventSequence: 9
    };
    const selfLog = {
      ...deferred.reactionDamageLog[0],
      reaction: "swirlPyro" as const,
      scheduleKind: "swirl-self" as const,
      targetingMode: "single-target" as const,
      checkedTargetIds: ["enemy-0"],
      hitTargetIds: ["enemy-0"],
      damageEventIds: [1],
      damageGroupBlockedTargetIds: [],
      damageGroupDecisions: [
        makeDamageGroupDecision(
          "swirlPyro",
          "enemy-0",
          13
        )
      ]
    };
    const propagationLog = {
      ...selfLog,
      id: 1,
      scheduleKind: "swirl-propagation" as const,
      targetingMode: "radius" as const,
      damageFrame: 17,
      checkedTargetIds: ["enemy-1"],
      hitTargetIds: ["enemy-1"],
      damageEventIds: [2],
      damageGroupDecisions: [
        makeDamageGroupDecision(
          "swirlPyro",
          "enemy-1",
          17
        )
      ]
    };
    return {
      ...deferred,
      damageEvents: [
        trigger,
        selfDamage,
        propagationDamage
      ] as const,
      reactionDamageLog: [
        selfLog,
        propagationLog
      ] as const
    };
  };

  const makeNestedRecursiveReferenceResult = () => ({
    schemaVersion: SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
    engineVersion: SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION,
    config: {
      schemaVersion: SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
      engineVersion: SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION,
      duration: 1,
      enemy: {
        targets: [{ id: "enemy-0" }, { id: "enemy-1" }]
      },
      reactionDeliveryModel: {
        mode: "shatter-recursive-zero-delay-v1" as const
      }
    },
    damageEvents: [
      {
        id: 0,
        kind: "direct" as const,
        parentDamageEventId: null,
        eventPriority: 3,
        eventSequence: 7,
        sourceActorId: "a",
        targetId: "enemy-0",
        frame: 12,
        element: "pyro" as const,
        reaction: "overload" as const,
        reactionAudit: {
          reactions: ["overload" as const],
          mechanicsTruncation: null,
          transformativeReaction:
            makeOneShotTransformativeAudit("overload"),
          burningReaction: null,
          shatterReaction: null,
          swirlReactions: [] as const
        }
      },
      {
        id: 1,
        kind: "transformative-reaction" as const,
        parentDamageEventId: 2,
        eventPriority: 5,
        eventSequence: 8,
        sourceActorId: "a",
        targetId: "enemy-1",
        frame: 13,
        element: "physical" as const,
        reaction: "shatter" as const,
        finalDamage: 100,
        damageFactors: {
          groupMultiplier: 1
        },
        transformativeReactionFactors: {
          baseMultiplier: 3
        },
        reactionAudit: noShatterReactionAudit
      },
      {
        id: 2,
        kind: "transformative-reaction" as const,
        parentDamageEventId: 0,
        eventPriority: 5,
        eventSequence: 8,
        sourceActorId: "a",
        targetId: "enemy-1",
        frame: 13,
        element: "pyro" as const,
        reaction: "overload" as const,
        finalDamage: 100,
        damageFactors: {
          groupMultiplier: 1
        },
        reactionAudit: {
          ...makeTriggeredShatterReactionAudit(true, 13),
          shatterReaction: {
            ...makeTriggeredShatterReactionAudit(true, 13)
              .shatterReaction,
            strikeType: "blunt" as const
          }
        }
      }
    ],
    reactionDamageLog: [
      {
        id: 0,
        reaction: "overload" as const,
        triggerDamageEventId: 0,
        sourceActorId: "a",
        sourceTargetId: "enemy-0",
        triggerFrame: 12,
        damageFrame: 13,
        scheduled: true,
        withinSimulation: true,
        blockedReason: null,
        nextAvailableFrame: 18,
        scheduleKind: "one-shot" as const,
        targetingMode: "radius" as const,
        checkedTargetIds: ["enemy-0", "enemy-1"],
        hitTargetIds: ["enemy-1"],
        damageEventIds: [2],
        damageGroupBlockedTargetIds: [],
        damageGroupDecisions: [
          makeDamageGroupDecision(
            "overload",
            "enemy-1",
            13
          )
        ]
      },
      {
        id: 1,
        reaction: "shatter" as const,
        triggerDamageEventId: 2,
        sourceActorId: "a",
        sourceTargetId: "enemy-1",
        triggerFrame: 13,
        damageFrame: 13,
        scheduled: true,
        withinSimulation: true,
        blockedReason: null,
        nextAvailableFrame: 25,
        scheduleKind: "one-shot" as const,
        targetingMode: "single-target" as const,
        checkedTargetIds: ["enemy-1"],
        hitTargetIds: ["enemy-1"],
        damageEventIds: [1],
        damageGroupBlockedTargetIds: [],
        damageGroupDecisions: [
          makeDamageGroupDecision(
            "shatter",
            "enemy-1",
            13
          )
        ]
      }
    ]
  });

  const makeCoreDamageGroupReplayResult = (
    attempts: Array<{
      frame: number;
      windowStartFrame: number;
      hitIndex: number;
      reaction?: "bloom" | "burgeon";
      targetId?: "enemy-0" | "enemy-1";
      sourceActorId?: string;
    }>
  ) => {
    const deferred = makeDeferredReferenceResult();
    const resolvedAttempts = attempts.map((attempt) => {
      const reaction = attempt.reaction ?? "bloom";
      const targetId = attempt.targetId ?? "enemy-0";
      const sourceActorId = attempt.sourceActorId ?? "a";
      const decision = makeDamageGroupDecision(
        reaction,
        targetId,
        attempt.windowStartFrame,
        attempt.hitIndex,
        sourceActorId
      );
      return {
        ...attempt,
        reaction,
        targetId,
        sourceActorId,
        decision
      };
    });
    return {
      ...deferred,
      damageEvents: resolvedAttempts.map(
        (attempt, attemptIndex) => ({
          ...deferred.damageEvents[1],
          id: attemptIndex,
          parentDamageEventId: null,
          eventPriority: 5,
          eventSequence: attemptIndex,
          sourceActorId: attempt.sourceActorId,
          targetId: attempt.targetId,
          frame: attempt.frame,
          element: "dendro" as const,
          reaction: attempt.reaction,
          finalDamage: attempt.decision.damageAllowed
            ? 100
            : 0,
          damageFactors: {
            groupMultiplier: attempt.decision.damageAllowed
              ? 1
              : 0
          },
          reactionAudit: noShatterReactionAudit
        })
      ),
      reactionDamageLog: resolvedAttempts.map(
        (attempt, attemptIndex) => ({
          ...deferred.reactionDamageLog[0],
          id: attemptIndex,
          reaction: attempt.reaction,
          triggerDamageEventId: null,
          sourceActorId: attempt.sourceActorId,
          sourceTargetId: attempt.targetId,
          triggerFrame: attempt.frame,
          damageFrame: attempt.frame,
          nextAvailableFrame: null,
          scheduleKind:
            attempt.reaction === "bloom"
              ? ("dendro-core-bloom" as const)
              : ("dendro-core-burgeon" as const),
          targetingMode: "radius" as const,
          checkedTargetIds: [attempt.targetId],
          hitTargetIds: [attempt.targetId],
          damageEventIds: [attemptIndex],
          damageGroupBlockedTargetIds:
            attempt.decision.damageAllowed
              ? []
              : [attempt.targetId],
          damageGroupDecisions: [attempt.decision]
        })
      )
    };
  };

  const makeElectroChargedDamageGroupReplayResult = (
    attempts: Array<{
      frame: number;
      windowStartFrame: number;
      hitIndex: number;
    }>
  ) => {
    const deferred = makeDeferredReferenceResult();
    const trigger = {
      ...deferred.damageEvents[0],
      id: 0,
      frame: 0,
      eventSequence: 0,
      targetId: "enemy-0",
      reaction: "electroCharged" as const,
      reactionAudit: {
        ...deferred.damageEvents[0]!.reactionAudit,
        reactions: ["electroCharged" as const],
        transformativeReaction: null
      }
    };
    const decisions = attempts.map((attempt) =>
      makeDamageGroupDecision(
        "electroCharged",
        "enemy-0",
        attempt.windowStartFrame,
        attempt.hitIndex
      )
    );
    return {
      ...deferred,
      damageEvents: [
        trigger,
        ...attempts.map((attempt, attemptIndex) => ({
          ...deferred.damageEvents[1],
          id: attemptIndex + 1,
          parentDamageEventId: 0,
          eventPriority: 5,
          eventSequence: attemptIndex + 1,
          targetId: "enemy-0",
          frame: attempt.frame,
          element: "electro" as const,
          reaction: "electroCharged" as const,
          finalDamage: decisions[attemptIndex]!
            .damageAllowed
            ? 100
            : 0,
          damageFactors: {
            groupMultiplier: decisions[attemptIndex]!
              .damageAllowed
              ? 1
              : 0
          },
          reactionAudit: noShatterReactionAudit
        }))
      ],
      reactionDamageLog: attempts.map(
        (attempt, attemptIndex) => ({
          ...deferred.reactionDamageLog[0],
          id: attemptIndex,
          reaction: "electroCharged" as const,
          triggerDamageEventId: 0,
          sourceTargetId: "enemy-0",
          triggerFrame: 0,
          damageFrame: attempt.frame,
          nextAvailableFrame: null,
          scheduleKind: "periodic-tick" as const,
          targetingMode: "single-target" as const,
          checkedTargetIds: ["enemy-0"],
          hitTargetIds: ["enemy-0"],
          damageEventIds: [attemptIndex + 1],
          damageGroupBlockedTargetIds:
            decisions[attemptIndex]!.damageAllowed
              ? []
              : ["enemy-0"],
          damageGroupDecisions: [decisions[attemptIndex]!]
        })
      )
    };
  };

  const makeNearbyWetPropagationReferenceResult = () => {
    const scenario = structuredClone(
      electroChargedPropagationGolden.scenario
    );
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION,
      config: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        engineVersion: CURRENT_ENGINE_VERSION,
        duration: 1,
        enemy: {
          targets:
            scenario.configContract.enemyTargets.map(
              (target) => ({
                id: target.id,
                name: target.name,
                ...(target.position === null
                  ? {}
                  : { position: target.position }),
                hitboxRadius: target.hitboxRadius
              })
            ),
          targetPhases: [
            {
              id: "immune-at-first-tick",
              label: "Immune at first tick",
              targetId: "wet-immune",
              startFrame: 10,
              endFrame: 11,
              reason: "TEST_EC_IMMUNE",
              effects: {
                damage: "immune",
                aura: "normal",
                hitConfirm: "normal"
              }
            }
          ]
        },
        reactionEngine:
          scenario.configContract.reactionEngine,
        targetClockModel:
          scenario.configContract.targetClockModel,
        targetTaskModel:
          scenario.configContract.targetTaskModel,
        timeline: scenario.configContract.timeline,
        reactionDeliveryModel:
          scenario.configContract.reactionDeliveryModel,
        electroChargedPropagationModel:
          scenario.configContract
            .electroChargedPropagationModel
      },
      damageEvents: scenario.allRelatedDamageEvents,
      reactionDamageLog: scenario.reactionDamage,
      hitResolutionLog: scenario.relevantHitResolutions,
      periodicReactionLog:
        scenario.periodicElectroCharged,
      targetClockLog: [],
      targetHitlagLog: [],
      targetStateTimeline: scenario.targetStateTimeline
    };
  };

  it("freezes the 1.39 identity and strictly gates the recursive model under 1.40", () => {
    expect(SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION).toBe(
      "1.39.0"
    );
    expect(SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION).toBe(
      "1.39.0-shatter-recursive-delivery"
    );
    expect(CURRENT_SCHEMA_VERSION).toBe(
      BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION
    );
    expect(CURRENT_ENGINE_VERSION).toBe(
      BURNING_CALLBACK_DELIVERY_ENGINE_VERSION
    );
    expect(
      reactionDeliveryModelSchema.parse({
        mode: "deferred-event-heap-v1"
      })
    ).toEqual({ mode: "deferred-event-heap-v1" });
    expect(() =>
      reactionDeliveryModelSchema.parse({
        mode: "shatter-recursive-zero-delay-v1",
        futureField: true
      })
    ).toThrow(/Unrecognized key/);
    expect(
      electroChargedPropagationModelSchema.parse({
        mode: "single-target-v1"
      })
    ).toEqual({ mode: "single-target-v1" });
    expect(
      electroChargedPropagationModelSchema.parse({
        mode: "nearby-wet-radius-v1",
        radius: 5,
        verificationStatus: "provisional"
      })
    ).toEqual({
      mode: "nearby-wet-radius-v1",
      radius: 5,
      verificationStatus: "provisional"
    });
    expect(() =>
      electroChargedPropagationModelSchema.parse({
        mode: "nearby-wet-radius-v1",
        radius: 0,
        verificationStatus: "provisional"
      })
    ).toThrow();
    expect(() =>
      electroChargedPropagationModelSchema.parse({
        mode: "nearby-wet-radius-v1",
        radius: 101,
        verificationStatus: "provisional"
      })
    ).toThrow();

    const current = migrateConfig(legacyConfig);
    const missing = { ...current } as Record<string, unknown>;
    delete missing.reactionDeliveryModel;
    expect(() => migrateConfig(missing)).toThrow(
      /reactionDeliveryModel/
    );
    expect(() =>
      migrateConfig({
        ...current,
        reactionDeliveryModel: {
          mode: "shatter-recursive-zero-delay-v1"
        }
      })
    ).toThrow(/requires timeline\.mode legal-frame-v1/);
    expect(() =>
      migrateConfig({
        ...makeLegalAuraV7Config(),
        reactionEngine: { mode: "aura-v6" },
        reactionDeliveryModel: {
          mode: "shatter-recursive-zero-delay-v1"
        }
      })
    ).toThrow(/requires reactionEngine\.mode aura-v7/);
    expect(
      migrateConfig({
        ...makeLegalAuraV7Config(),
        reactionDeliveryModel: {
          mode: "shatter-recursive-zero-delay-v1"
        }
      }).reactionDeliveryModel
    ).toEqual({ mode: "shatter-recursive-zero-delay-v1" });
  });

  it("migrates pre-1.41 exact 1.40 by injecting source-only EC propagation and nothing else", () => {
    const current = {
      ...makeLegalAuraV7Config(),
      reactionEngine: { mode: "aura-v8" as const },
      targetTaskModel: { mode: "target-phase-v2" as const }
    };
    const {
      electroChargedPropagationModel:
        _electroChargedPropagationModel,
      ...currentPayload
    } = current;
    const historical = {
      ...currentPayload,
      schemaVersion: EC_NEXT_TARGET_TICK_SCHEMA_VERSION,
      engineVersion: EC_NEXT_TARGET_TICK_ENGINE_VERSION
    };
    const migrated = migrateConfig(historical);

    expect(migrated).toEqual({
      ...historical,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION,
      electroChargedPropagationModel: {
        mode: "single-target-v1"
      }
    });
    expect(() =>
      migrateConfig({
        ...historical,
        electroChargedPropagationModel: {
          mode: "nearby-wet-radius-v1",
          radius: 5,
          verificationStatus: "provisional"
        }
      })
    ).toThrow(
      /1\.40\.0.*does not support Electro-Charged propagation selection/
    );
    expect(() =>
      migrateConfig({
        ...historical,
        engineVersion: "1.40.0-forged"
      })
    ).toThrow(/schemaVersion "1\.40\.0" requires/);
  });

  it("migrates exact 1.41 to 1.42 without changing aura-v8 or its propagation model", () => {
    const propagation = {
      mode: "nearby-wet-radius-v1" as const,
      radius: 5,
      verificationStatus: "provisional" as const
    };
    const historical = {
      ...makeLegalAuraV7Config(),
      schemaVersion:
        EC_SECONDARY_WET_PROPAGATION_SCHEMA_VERSION,
      engineVersion:
        EC_SECONDARY_WET_PROPAGATION_ENGINE_VERSION,
      reactionEngine: { mode: "aura-v8" as const },
      targetTaskModel: { mode: "target-phase-v2" as const },
      electroChargedPropagationModel: propagation
    };

    expect(migrateConfig(historical)).toEqual({
      ...historical,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
    expect(() =>
      migrateConfig({
        ...historical,
        reactionEngine: { mode: "aura-v9" }
      })
    ).toThrow(
      /schemaVersion "1\.41\.0" does not support "aura-v9"/
    );
    expect(() =>
      migrateConfig({
        ...historical,
        engineVersion: "1.41.0-forged"
      })
    ).toThrow(/schemaVersion "1\.41\.0" requires/);
  });

  it("gates aura-v9 to exact 1.42 legal 60 FPS target-phase-v2 configs", () => {
    const legal = {
      ...makeLegalAuraV7Config(),
      reactionEngine: { mode: "aura-v9" as const },
      targetTaskModel: { mode: "target-phase-v2" as const }
    };
    expect(migrateConfig(legal).reactionEngine?.mode).toBe(
      "aura-v9"
    );
    expect(() =>
      migrateConfig({
        ...withoutOwn(legal, "timeline")
      })
    ).toThrow(
      /aura-v9 requires timeline\.mode legal-frame-v1 at 60 FPS/
    );
    expect(() =>
      migrateConfig({
        ...legal,
        targetTaskModel: { mode: "target-phase-v1" }
      })
    ).toThrow(
      /aura-v9 requires targetTaskModel\.mode target-phase-v2/
    );
  });

  it("freezes 1.42, migrates it by identity only, and gates explicit 1.44 target-phase-v3", () => {
    const frozenV142 = {
      ...makeLegalAuraV7Config(),
      schemaVersion: EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
      engineVersion: EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION,
      reactionEngine: { mode: "aura-v9" as const },
      targetTaskModel: { mode: "target-phase-v2" as const }
    };
    const parsedFrozenV142 = simConfigV142Schema.parse(frozenV142);
    expect(parsedFrozenV142).toMatchObject({
      schemaVersion: EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
      engineVersion: EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION,
      targetTaskModel: { mode: "target-phase-v2" }
    });

    const migrated = migrateConfig(parsedFrozenV142);
    expect(migrated).toEqual({
      ...parsedFrozenV142,
      schemaVersion: BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
      engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION
    });
    expect(migrated.targetTaskModel).toEqual({
      mode: "target-phase-v2"
    });
    expect(simConfigV144Schema.parse(migrated)).toEqual(migrated);

    for (const mode of ["aura-v7", "aura-v8", "aura-v9"] as const) {
      expect(
        migrateConfig({
          ...migrated,
          reactionEngine: { mode },
          targetTaskModel: { mode: "target-phase-v3" }
        }).targetTaskModel
      ).toEqual({ mode: "target-phase-v3" });
    }
    expect(() =>
      migrateConfig({
        ...withoutOwn(migrated, "timeline"),
        targetTaskModel: { mode: "target-phase-v3" }
      })
    ).toThrow(/requires timeline\.mode legal-frame-v1/);
    expect(() =>
      migrateConfig({
        ...migrated,
        reactionEngine: { mode: "aura-v6" },
        targetTaskModel: { mode: "target-phase-v3" }
      })
    ).toThrow(/requires reactionEngine\.mode aura-v7/);
    expect(() =>
      migrateConfig({
        ...frozenV142,
        targetTaskModel: { mode: "target-phase-v3" }
      })
    ).toThrow(/1\.42\.0.*target-phase-v2 model/);
    expect(() =>
      migrateConfig({
        ...migrated,
        targetTaskModel: Object.create({
          mode: "target-phase-v3"
        })
      })
    ).toThrow(/targetTaskModel: config must contain only plain JSON objects/);
    expect(() =>
      migrateConfig({
        ...migrated,
        schemaVersion: "1.43.0",
        engineVersion: "1.43.0-unpublished"
      })
    ).toThrow();
    expect(() =>
      simConfigV144Schema.parse({
        ...migrated,
        burningCallbackModel: { mode: "unversioned" }
      })
    ).toThrow(/Unrecognized key/);
  });

  it("validates aura-v9 cleanup cadence state and the ended-before-deadline wire", () => {
    const pending = {
      generation: 1,
      requestedTargetFrame: 0,
      deadlineTargetFrame: 1,
      requestReason:
        "QUICKEN_BLOOM_DEPLETED_LAST_HYDRO" as const,
      outcome: "pending-at-end" as const,
      resolutionReason: null,
      resolvedGlobalFrame: null,
      resolvedTargetFrame: null,
      targetPhaseLogId: null,
      periodicReactionLogId: null,
      targetStateTimelinePointId: null,
      cadence: {
        status: "dormant" as const,
        nextTickFrame: null,
        waneListenerActive: false,
        lastCallbackFrame: 70
      }
    };
    expect(
      electroChargedCleanupAuditSchema.parse(pending)
    ).toEqual(pending);

    const ended = {
      ...pending,
      outcome: "ended-before-deadline" as const,
      resolutionReason:
        "ELECTRO_CHARGED_STREAM_ENDED_BEFORE_CLEANUP" as const,
      resolvedGlobalFrame: 121,
      resolvedTargetFrame: 1,
      targetPhaseLogId: 2,
      periodicReactionLogId: 4,
      targetStateTimelinePointId: 8,
      cadence: {
        status: "stopped" as const,
        nextTickFrame: null,
        waneListenerActive: false,
        lastCallbackFrame: null
      }
    };
    expect(
      electroChargedCleanupAuditSchema.parse(ended)
    ).toEqual(ended);
    expect(() =>
      electroChargedCleanupAuditSchema.parse({
        ...pending,
        cadence: {
          ...pending.cadence,
          status: "scheduled",
          nextTickFrame: null
        }
      })
    ).toThrow(/scheduled cleanup cadence requires a next callback/);
  });

  it("gates provisional nearby-Wet propagation to exact Aura-v8 target-phase-v2 and permits auditable unresolved positions", () => {
    const legal = makeLegalAuraV7Config();
    const targetsWithoutPositions =
      legal.enemy.targets?.map(
        ({ position: _position, ...target }) => target
      ) ?? [];
    const targetedElectroAbility = {
      id: "single-target-electro",
      actorId: "a",
      name: "Single target Electro",
      kind: "skill" as const,
      cancelFrame: 1,
      animationEndFrame: 1,
      cooldownFrames: 0,
      hits: [
        {
          frame: 0,
          scaling: 1,
          element: "electro" as const,
          targeting: {
            targetId: "enemy-0",
            outcome: "landed" as const
          },
          application: {
            gaugeUnits: 1,
            icdTag: "test",
            icdGroup: "default"
          }
        }
      ]
    };
    const nearby = {
      ...legal,
      enemy: {
        ...legal.enemy,
        targets: targetsWithoutPositions
      },
      reactionEngine: { mode: "aura-v8" as const },
      targetTaskModel: { mode: "target-phase-v2" as const },
      electroChargedPropagationModel: {
        mode: "nearby-wet-radius-v1" as const,
        radius: 5,
        verificationStatus: "provisional" as const
      },
      timeline: {
        ...legal.timeline,
        abilities: [targetedElectroAbility]
      }
    };
    expect(parseSimConfig(nearby)).toEqual(nearby);
    expect(() =>
      parseSimConfig({
        ...nearby,
        electroChargedPropagationModel: {
          mode: "single-target-v1"
        }
      })
    ).toThrow(/requires a position for every registered target/);
    expect(() =>
      parseSimConfig({
        ...nearby,
        timeline: {
          ...nearby.timeline,
          abilities: [
            {
              ...targetedElectroAbility,
              hits: [
                {
                  ...withoutOwn(
                    targetedElectroAbility.hits[0]!,
                    "targeting"
                  )
                }
              ]
            }
          ]
        }
      })
    ).toThrow(/require explicit geometry/);
    expect(() =>
      parseSimConfig({
        ...nearby,
        reactionEngine: { mode: "aura-v7" }
      })
    ).toThrow(/requires reactionEngine\.mode aura-v8/);
  });

  it("strictly validates provisional propagation audits and rejects mutation or prototype smuggling", () => {
    const audit = {
      model: "nearby-wet-radius-v1",
      verificationStatus: "provisional",
      mechanicsDataStatus: "community-provisional",
      generation: 1,
      tickIndex: 0,
      evaluationFrame: 10,
      eventPriority: 5,
      eventSequence: 7,
      radius: 5,
      selectionMode:
        "all-in-range-registration-order-v1",
      sourcePosition: null,
      candidates: [
        {
          targetId: "enemy-1",
          targetName: "Source",
          targetOrder: 1,
          hydroGaugeUnits: 0.4,
          position: null,
          distance: null,
          threshold: null,
          selected: true,
          reason: "SOURCE_STREAM_TARGET",
          auraObservationTimelinePointId: 0,
          hitResolutionLogId: 4,
          damageEventId: 8
        },
        {
          targetId: "enemy-0",
          targetName: "Dry",
          targetOrder: 0,
          hydroGaugeUnits: 0,
          position: null,
          distance: null,
          threshold: null,
          selected: false,
          reason: "NO_HYDRO_AURA",
          auraObservationTimelinePointId: 1,
          hitResolutionLogId: null,
          damageEventId: null
        },
        {
          targetId: "enemy-2",
          targetName: "Wet unresolved",
          targetOrder: 2,
          hydroGaugeUnits: 0.5,
          position: null,
          distance: null,
          threshold: null,
          selected: false,
          reason: "SOURCE_POSITION_UNRESOLVED",
          auraObservationTimelinePointId: 2,
          hitResolutionLogId: null,
          damageEventId: null
        }
      ]
    } as const;
    expect(
      electroChargedPropagationAuditSchema.parse(audit)
    ).toEqual(audit);
    expect(() =>
      electroChargedPropagationAuditSchema.parse({
        ...audit,
        mechanicsDataStatus: "fixed-gcsim-provisional"
      })
    ).toThrow();
    expect(() =>
      electroChargedPropagationAuditSchema.parse({
        ...audit,
        candidates: audit.candidates.map(
          (candidate, index) =>
            index === 1
              ? { ...candidate, targetOrder: 2 }
              : candidate
        )
      })
    ).toThrow(/unique|registration order/);
    expect(() =>
      electroChargedPropagationAuditSchema.parse({
        ...audit,
        candidates: [
          {
            ...audit.candidates[0],
            damageEventId: null
          },
          ...audit.candidates.slice(1)
        ]
      })
    ).toThrow(/require one hit-resolution and damage-event child/);

    const resolvedAudit: any = {
      ...audit,
      radius: 3,
      sourcePosition: { x: 0, y: 0 },
      candidates: [
        {
          ...audit.candidates[0],
          targetId: "enemy-0",
          targetOrder: 0,
          position: { x: 0, y: 0 },
          auraObservationTimelinePointId: 10
        },
        {
          targetId: "enemy-1",
          targetName: "Wet nearby",
          targetOrder: 1,
          hydroGaugeUnits: 0.5,
          position: { x: 3, y: 0 },
          distance: 3,
          threshold: 3,
          selected: true,
          reason: "NEARBY_WET_IN_RANGE",
          auraObservationTimelinePointId: 11,
          hitResolutionLogId: 5,
          damageEventId: 9
        },
        {
          targetId: "enemy-2",
          targetName: "Dry",
          targetOrder: 2,
          hydroGaugeUnits: 1e-10,
          position: { x: 1, y: 0 },
          distance: null,
          threshold: null,
          selected: false,
          reason: "NO_HYDRO_AURA",
          auraObservationTimelinePointId: 12,
          hitResolutionLogId: null,
          damageEventId: null
        },
        {
          targetId: "enemy-3",
          targetName: "Wet outside",
          targetOrder: 3,
          hydroGaugeUnits: 0.5,
          position: { x: 3.01, y: 0 },
          distance: 3.01,
          threshold: 3,
          selected: false,
          reason: "OUT_OF_RANGE",
          auraObservationTimelinePointId: 13,
          hitResolutionLogId: null,
          damageEventId: null
        },
        {
          targetId: "enemy-4",
          targetName: "Wet unresolved",
          targetOrder: 4,
          hydroGaugeUnits: 0.5,
          position: null,
          distance: null,
          threshold: null,
          selected: false,
          reason: "POSITION_UNRESOLVED",
          auraObservationTimelinePointId: 14,
          hitResolutionLogId: null,
          damageEventId: null
        }
      ]
    };
    expect(() =>
      electroChargedPropagationAuditSchema.parse(
        resolvedAudit
      )
    ).not.toThrow();
    const mutateResolvedCandidate = (
      candidateIndex: number,
      mutation: Record<string, unknown>
    ): any => {
      const mutated = structuredClone(resolvedAudit);
      Object.assign(
        mutated.candidates[candidateIndex],
        mutation
      );
      return mutated;
    };
    for (const [candidateIndex, mutation] of [
      [0, { distance: 0 }],
      [
        0,
        {
          selected: false,
          hitResolutionLogId: null,
          damageEventId: null
        }
      ],
      [1, { hydroGaugeUnits: 1e-10 }],
      [1, { position: null }],
      [1, { distance: 2.5 }],
      [1, { distance: 3.01 }],
      [1, { threshold: 2.9999999995 }],
      [2, { hydroGaugeUnits: 1e-9 }],
      [2, { distance: 1, threshold: 3 }],
      [3, { hydroGaugeUnits: 0 }],
      [3, { position: null }],
      [3, { distance: 3 }],
      [4, { hydroGaugeUnits: 0 }],
      [4, { position: { x: 2, y: 0 } }],
      [4, { distance: 2, threshold: 3 }],
      [2, { hitResolutionLogId: 99 }]
    ] as const) {
      expect(() =>
        electroChargedPropagationAuditSchema.parse(
          mutateResolvedCandidate(
            candidateIndex,
            mutation
          )
        )
      ).toThrow();
    }
    expect(() =>
      electroChargedPropagationAuditSchema.parse({
        ...audit,
        sourcePosition: { x: 0, y: 0 }
      })
    ).toThrow(/SOURCE_POSITION_UNRESOLVED/);
    expect(() =>
      electroChargedPropagationAuditSchema.parse({
        ...audit,
        candidates: audit.candidates.map(
          (candidate, index) =>
            index === 2
              ? {
                  ...candidate,
                  reason: "POSITION_UNRESOLVED"
                }
              : candidate
        )
      })
    ).toThrow(/missing source position|resolved audit source position/);

    const {
      model: inheritedModel,
      ...ownAuditFields
    } = structuredClone(resolvedAudit);
    expect(() =>
      electroChargedPropagationAuditSchema.parse(
        Object.assign(
          Object.create({ model: inheritedModel }),
          ownAuditFields
        )
      )
    ).toThrow(/explicit own wire property/);
    for (const inheritedField of [
      "reason",
      "selected"
    ] as const) {
      const inheritedCandidateAudit =
        structuredClone(resolvedAudit);
      const candidate =
        inheritedCandidateAudit.candidates[1];
      const inheritedValue = candidate[inheritedField];
      delete candidate[inheritedField];
      inheritedCandidateAudit.candidates[1] =
        Object.assign(
          Object.create({
            [inheritedField]: inheritedValue
          }),
          candidate
        );
      expect(() =>
        electroChargedPropagationAuditSchema.parse(
          inheritedCandidateAudit
        )
      ).toThrow(/explicit own wire property/);
    }
    expect(() =>
      electroChargedPropagationModelSchema.parse(
        Object.create({ mode: "single-target-v1" })
      )
    ).toThrow(/explicit own property/);
  });

  it("binds every real 1.41 propagation candidate to witnessed Aura and configured motion geometry", () => {
    const reference: any =
      makeNearbyWetPropagationReferenceResult();
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(reference)
    ).not.toThrow();

    const expectRejectedMutation = (
      mutate: (result: any) => void,
      expected: RegExp
    ): void => {
      const mutated: any =
        makeNearbyWetPropagationReferenceResult();
      mutate(mutated);
      expect(() =>
        reactionDeliveryResultReferencesSchema.parse(mutated)
      ).toThrow(expected);
    };

    expectRejectedMutation((result) => {
      const audit =
        result.reactionDamageLog[0]
          .electroChargedPropagation;
      const { model, ...ownFields } = audit;
      result.reactionDamageLog[0].electroChargedPropagation =
        Object.assign(
          Object.create({ model }),
          ownFields
        );
    }, /explicit own wire propert/);
    expectRejectedMutation((result) => {
      result.reactionDamageLog[0] = Object.create(
        result.reactionDamageLog[0]
      );
    }, /plain JSON objects|explicit own wire/);
    expectRejectedMutation((result) => {
      const candidate =
        result.reactionDamageLog[0]
          .electroChargedPropagation.candidates[1];
      result.targetStateTimeline.points[
        candidate.auraObservationTimelinePointId
      ] = Object.create(
        result.targetStateTimeline.points[
          candidate.auraObservationTimelinePointId
        ]
      );
    }, /plain JSON objects|explicit own wire/);
    for (const inheritedField of [
      "reason",
      "selected"
    ] as const) {
      expectRejectedMutation((result) => {
        const candidates =
          result.reactionDamageLog[0]
            .electroChargedPropagation.candidates;
        const candidate = candidates[1];
        const inheritedValue = candidate[inheritedField];
        delete candidate[inheritedField];
        candidates[1] = Object.assign(
          Object.create({
            [inheritedField]: inheritedValue
          }),
          candidate
        );
      }, /explicit own wire propert/);
    }

    expectRejectedMutation((result) => {
      result.reactionDamageLog[0]
        .electroChargedPropagation.candidates[1]
        .targetName = "Forged target";
    }, /targetName|Aura witness/);
    expectRejectedMutation((result) => {
      result.reactionDamageLog[0]
        .electroChargedPropagation.candidates[1]
        .hydroGaugeUnits = 999;
    }, /Hydro gauge|witness/);
    expectRejectedMutation((result) => {
      result.hitResolutionLog[2].targetName =
        "Forged target";
    }, /exact landed reaction-damage hit resolution/);
    expectRejectedMutation((result) => {
      result.hitResolutionLog[2].eventPriority = 999;
    }, /exact landed reaction-damage hit resolution/);
    expectRejectedMutation((result) => {
      result.damageEvents[2].targetName =
        "Forged target";
    }, /exact Electro-Charged damage event/);
    const selectedCandidateAt = (
      result: any,
      candidateIndex = 1
    ): {
      candidate: any;
      hit: any;
      damage: any;
    } => {
      const candidate =
        result.reactionDamageLog[0]
          .electroChargedPropagation.candidates[
          candidateIndex
        ];
      return {
        candidate,
        hit:
          result.hitResolutionLog[
            candidate.hitResolutionLogId
          ],
        damage:
          result.damageEvents[candidate.damageEventId]
      };
    };
    for (const mutate of [
      (result: any) => {
        selectedCandidateAt(result).hit.sourceActorId =
          "forged-owner";
      },
      (result: any) => {
        selectedCandidateAt(result).hit.targetIndex = 0;
      },
      (result: any) => {
        selectedCandidateAt(result).hit.targetCount = 99;
      },
      (result: any) => {
        selectedCandidateAt(result).hit.targetPosition = {
          x: 3.5000000005,
          y: 0
        };
      },
      (result: any) => {
        selectedCandidateAt(result).hit.targetingSource =
          "reaction-source";
      },
      (result: any) => {
        selectedCandidateAt(result).hit.geometryKind =
          "sector";
      },
      (result: any) => {
        selectedCandidateAt(result).hit.geometryOrigin = {
          x: 0.0000000005,
          y: 0
        };
      },
      (result: any) => {
        selectedCandidateAt(result).hit.geometryDistance +=
          0.0000000005;
      },
      (result: any) => {
        selectedCandidateAt(result).hit.geometryThreshold +=
          0.0000000005;
      },
      (result: any) => {
        selectedCandidateAt(result).hit.auraAllowed = true;
      },
      (result: any) => {
        selectedCandidateAt(result).hit.hitConfirmAllowed =
          true;
      },
      (result: any) => {
        selectedCandidateAt(result).hit.damageAllowed = false;
      }
    ]) {
      expectRejectedMutation(
        mutate,
        /exact landed reaction-damage hit resolution|target-policy provenance/
      );
    }
    for (const mutate of [
      (result: any) => {
        selectedCandidateAt(result).damage.targetResolutionId =
          1;
      },
      (result: any) => {
        selectedCandidateAt(result).damage.scalingOwnerId =
          "forged-owner";
      },
      (result: any) => {
        selectedCandidateAt(result).damage.creditOwnerId =
          "forged-owner";
      },
      (result: any) => {
        selectedCandidateAt(result).damage.creditId =
          "forged-owner";
      },
      (result: any) => {
        selectedCandidateAt(result).damage.parentDamageEventId =
          null;
      },
      (result: any) => {
        selectedCandidateAt(result).damage.targetIndex = 0;
      },
      (result: any) => {
        selectedCandidateAt(result).damage.targetCount = 99;
      },
      (result: any) => {
        selectedCandidateAt(result).damage.element = "hydro";
      },
      (result: any) => {
        selectedCandidateAt(result).damage.snapshot = "action";
      },
      (result: any) => {
        selectedCandidateAt(result).damage.displayDamage += 1;
      }
    ]) {
      expectRejectedMutation(
        mutate,
        /exact Electro-Charged damage event/
      );
    }
    expectRejectedMutation((result) => {
      for (const hit of result.hitResolutionLog.filter(
        (entry: any) =>
          entry.resolutionKind === "reaction-damage"
      )) {
        hit.sourceActionId = "forged-action";
        hit.actionName = "Forged action · 感电";
        hit.hitId = "forged-hit:electroCharged";
        hit.hitGroupId =
          "forged-group:electroCharged:0";
      }
      for (const damage of result.damageEvents.filter(
        (entry: any) =>
          entry.kind === "transformative-reaction" &&
          entry.reaction === "electroCharged"
      )) {
        damage.actionId = "forged-action";
        damage.actionName = "Forged action · 感电";
        damage.hitId = "forged-hit:electroCharged";
        damage.hitGroupId =
          "forged-group:electroCharged:0";
      }
    }, /exact landed reaction-damage hit resolution|exact Electro-Charged damage event/);
    expectRejectedMutation((result) => {
      const { candidate, hit } =
        selectedCandidateAt(result);
      candidate.distance += 0.0000000005;
      hit.geometryDistance += 0.0000000005;
    }, /derived from witnessed Hydro|geometry/);
    expectRejectedMutation((result) => {
      const { candidate, hit } =
        selectedCandidateAt(result);
      const forgedHit = structuredClone(hit);
      forgedHit.id = 99;
      result.hitResolutionLog.push(forgedHit);
      candidate.hitResolutionLogId = 99;
    }, /contiguous|unique exact landed reaction-damage hit resolution/);
    expectRejectedMutation((result) => {
      const { damage } = selectedCandidateAt(result);
      const point =
        result.targetStateTimeline.points.find(
          (entry: any) =>
            entry.cause ===
              "reaction-damage-application" &&
            entry.primaryDamageEventId === damage.id
        );
      point.primaryDamageEventId = null;
    }, /exactly one immutable same-frame damage-application point/);
    expectRejectedMutation((result) => {
      const { damage } = selectedCandidateAt(result);
      const point =
        result.targetStateTimeline.points.find(
          (entry: any) =>
            entry.primaryDamageEventId === damage.id
        );
      point.links.push({
        kind: "reaction-damage-log",
        id: 0
      });
    }, /exactly one immutable same-frame damage-application point/);
    expectRejectedMutation((result) => {
      const { damage } = selectedCandidateAt(result);
      const point =
        result.targetStateTimeline.points.find(
          (entry: any) =>
            entry.primaryDamageEventId === damage.id
        );
      point.links.reverse();
    }, /exactly one immutable same-frame damage-application point/);
    expectRejectedMutation((result) => {
      const tick = result.periodicReactionLog.find(
        (entry: any) => entry.operation === "tick"
      );
      tick.targetName = "Forged source";
    }, /source periodic tick/);
    expectRejectedMutation((result) => {
      const tick = result.periodicReactionLog.find(
        (entry: any) => entry.operation === "tick"
      );
      tick.sourceActorId = "forged-owner";
    }, /source periodic tick/);
    expectRejectedMutation((result) => {
      const wane = result.periodicReactionLog.find(
        (entry: any) => entry.operation === "wane"
      );
      wane.triggerDamageEventId = null;
    }, /Wane.*provenance|provenance.*Wane/);
    expectRejectedMutation((result) => {
      const log = result.reactionDamageLog[0];
      log.centerPosition = { x: 1, y: 0 };
      log.electroChargedPropagation.sourcePosition = {
        x: 1,
        y: 0
      };
      log.electroChargedPropagation.candidates[0].position = {
        x: 1,
        y: 0
      };
    }, /configured source target position|reaction center/);
    expectRejectedMutation((result) => {
      result.reactionDamageLog[0]
        .electroChargedPropagation.candidates[1]
        .position = { x: 3.4, y: 0 };
    }, /configured linear-motion position/);
    expectRejectedMutation((result) => {
      result.reactionDamageLog[0]
        .electroChargedPropagation.candidates[1]
        .distance = 3.4;
    }, /derived from witnessed Hydro|geometry/);
    expectRejectedMutation((result) => {
      result.reactionDamageLog[0]
        .electroChargedPropagation.candidates[1]
        .threshold = 3.6;
    }, /derived from witnessed Hydro|geometry/);
    expectRejectedMutation((result) => {
      const candidate =
        result.reactionDamageLog[0]
          .electroChargedPropagation.candidates[1];
      const point =
        result.targetStateTimeline.points[
          candidate.auraObservationTimelinePointId
        ];
      point.links[0].id = 999;
    }, /reaction-damage parent link|missing reaction damage log/);
    expectRejectedMutation((result) => {
      const candidate =
        result.reactionDamageLog[0]
          .electroChargedPropagation.candidates[1];
      const point =
        result.targetStateTimeline.points[
          candidate.auraObservationTimelinePointId
        ];
      const hydroBefore = point.auraBefore.find(
        (aura: any) => aura.element === "hydro"
      );
      const hydroAfter = point.auraAfter.find(
        (aura: any) => aura.element === "hydro"
      );
      hydroBefore.gaugeUnits += 0.25;
      hydroAfter.gaugeUnits += 0.25;
    }, /Hydro gauge|discontinuous/);
    expectRejectedMutation((result) => {
      result.reactionDamageLog[0].withinSimulation = false;
    }, /out-of-simulation reaction damage cannot claim/);

    const movingTarget: any =
      makeNearbyWetPropagationReferenceResult();
    movingTarget.config.enemy.targetMotions = [
      {
        id: "wet-boundary-motion",
        label: "Wet boundary linear motion",
        targetId: "wet-boundary",
        startFrame: 0,
        endFrame: 20,
        endPosition: { x: 3.4, y: 0 }
      }
    ];
    const movingCandidate =
      movingTarget.reactionDamageLog[0]
        .electroChargedPropagation.candidates[1];
    movingCandidate.position = { x: 3.45, y: 0 };
    movingCandidate.distance = 3.45;
    const movingHit =
      movingTarget.hitResolutionLog[
        movingCandidate.hitResolutionLogId
      ];
    movingHit.targetPosition = { x: 3.45, y: 0 };
    movingHit.geometryDistance = 3.45;
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(
        movingTarget
      )
    ).not.toThrow();
    movingCandidate.position = { x: 3.4, y: 0 };
    movingCandidate.distance = 3.4;
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(
        movingTarget
      )
    ).toThrow(/configured linear-motion position|derived from witnessed Hydro/);

    const forgedDisabledTargetFrame: any =
      makeNearbyWetPropagationReferenceResult();
    const forgedDisabledCandidate =
      forgedDisabledTargetFrame.reactionDamageLog[0]
        .electroChargedPropagation.candidates[1];
    const forgedDisabledObservation =
      forgedDisabledTargetFrame.targetStateTimeline.points[
        forgedDisabledCandidate.auraObservationTimelinePointId
      ];
    const forgedDisabledApplication =
      forgedDisabledTargetFrame.targetStateTimeline.points.find(
        (point: any) =>
          point.cause ===
            "reaction-damage-application" &&
          point.primaryDamageEventId ===
            forgedDisabledCandidate.damageEventId
      );
    forgedDisabledObservation.targetFrame = 9;
    forgedDisabledApplication.targetFrame = 9;
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(
        forgedDisabledTargetFrame
      )
    ).toThrow(/target-clock|targetFrame|Aura witness/);

    const targetClockLagged: any =
      makeNearbyWetPropagationReferenceResult();
    targetClockLagged.config.targetClockModel = {
      mode: "target-local-hitlag-v1"
    };
    const sourceCandidate =
      targetClockLagged.reactionDamageLog[0]
        .electroChargedPropagation.candidates[0];
    const sourceObservation =
      targetClockLagged.targetStateTimeline.points[
        sourceCandidate.auraObservationTimelinePointId
      ];
    const sourceApplication =
      targetClockLagged.targetStateTimeline.points.find(
        (point: any) =>
          point.cause ===
            "reaction-damage-application" &&
          point.primaryDamageEventId ===
            sourceCandidate.damageEventId
      );
    const sourceTick =
      targetClockLagged.targetStateTimeline.points.find(
        (point: any) =>
          point.cause === "electro-charged-tick"
      );
    const sourceWane =
      targetClockLagged.targetStateTimeline.points.find(
        (point: any) =>
          point.cause === "electro-charged-wane"
      );
    sourceObservation.targetFrame = 9;
    sourceApplication.targetFrame = 9;
    sourceTick.targetFrame = 9;
    sourceWane.targetFrame = 15;
    const targetIds =
      targetClockLagged.config.enemy.targets.map(
        (target: any) => ({
          id: target.id,
          name: target.name
        })
      );
    targetClockLagged.targetClockLog = [
      {
        id: 0,
        targetId: "enemy-0",
        targetName: "Source",
        operation: "apply-hitlag",
        globalFrameBefore: 0,
        globalFrameAfter: 0,
        targetFrameBefore: 0,
        targetFrameAfter: 0,
        frozenFramesBefore: 0,
        consumedFrozenFrames: 0,
        addedFrozenFrames: 1,
        frozenFramesAfter: 1,
        targetHitlagLogId: 0,
        cause: "hit"
      },
      {
        id: 1,
        targetId: "enemy-0",
        targetName: "Source",
        operation: "advance",
        globalFrameBefore: 0,
        globalFrameAfter: 60,
        targetFrameBefore: 0,
        targetFrameAfter: 59,
        frozenFramesBefore: 1,
        consumedFrozenFrames: 1,
        addedFrozenFrames: 0,
        frozenFramesAfter: 0,
        targetHitlagLogId: null,
        cause: "simulation-end"
      },
      ...targetIds.slice(1).map(
        (target: any, targetIndex: number) => ({
          id: targetIndex + 2,
          targetId: target.id,
          targetName: target.name,
          operation: "advance",
          globalFrameBefore: 0,
          globalFrameAfter: 60,
          targetFrameBefore: 0,
          targetFrameAfter: 60,
          frozenFramesBefore: 0,
          consumedFrozenFrames: 0,
          addedFrozenFrames: 0,
          frozenFramesAfter: 0,
          targetHitlagLogId: null,
          cause: "simulation-end"
        })
      )
    ];
    targetClockLagged.targetHitlagLog = [
      {
        id: 0,
        globalFrame: 0,
        timeSeconds: 0,
        targetFrame: 0,
        eventPriority: 3,
        eventSequence: 1,
        intraEventSequence: 1,
        targetId: "enemy-0",
        targetName: "Source",
        sourceActorId: "ec-owner",
        sourceActionId: "start-ec#0",
        hitId: "start-source-with-unresolved-candidate",
        hitGroupId: "start-ec#0:0:0:0",
        hitResolutionLogId: 0,
        haltFrames: 1,
        factor: 0,
        roundedHaltFrames: 1,
        extensionFrames: 1,
        frozenFramesBefore: 0,
        frozenFramesAfter: 1,
        pausedGlobalFrameStart: 1,
        nextTargetAdvanceGlobalFrame: 2,
        applied: true,
        blockedReason: null,
        extendedReactionStatusLogIds: [],
        mechanicsDataStatus: "fixed-gcsim-provisional"
      }
    ];
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(
        targetClockLagged
      )
    ).not.toThrow();
    targetClockLagged.targetHitlagLog[0].intraEventSequence =
      0;
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(
        targetClockLagged
      )
    ).toThrow(/target-Hitlag row must exactly match/);
    targetClockLagged.targetHitlagLog[0].intraEventSequence =
      1;
    const targetClockWithMiss = structuredClone(
      targetClockLagged
    );
    const missedHit = {
      ...structuredClone(
        targetClockWithMiss.hitResolutionLog[0]
      ),
      id: targetClockWithMiss.hitResolutionLog.length,
      eventSequence: 2,
      targetIndex: 1,
      targetCount: 2,
      targetId: "wet-boundary",
      targetName: "Wet boundary",
      targetingSource: "geometry",
      targetPosition: { x: 3.5, y: 0 },
      outcome: "miss",
      landed: false,
      reason: "OUTSIDE_GEOMETRY",
      targetEffectSource: "hit",
      damageAllowed: false,
      auraAllowed: false,
      hitConfirmAllowed: false,
      damageEventId: null,
      potentialDamage: 0,
      finalDamage: 0,
      displayDamage: 0
    };
    targetClockWithMiss.hitResolutionLog.push(missedHit);
    targetClockWithMiss.targetHitlagLog.push({
      ...structuredClone(
        targetClockWithMiss.targetHitlagLog[0]
      ),
      id: 1,
      targetId: "wet-boundary",
      targetName: "Wet boundary",
      targetFrame: 0,
      eventSequence: missedHit.eventSequence,
      intraEventSequence: missedHit.intraEventSequence,
      hitResolutionLogId: missedHit.id,
      applied: false,
      blockedReason: "TARGET_MISS",
      frozenFramesBefore: 0,
      frozenFramesAfter: 0,
      pausedGlobalFrameStart: null,
      nextTargetAdvanceGlobalFrame: null
    });
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(
        targetClockWithMiss
      )
    ).not.toThrow();
    targetClockWithMiss.targetHitlagLog[1].intraEventSequence =
      missedHit.intraEventSequence + 1;
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(
        targetClockWithMiss
      )
    ).toThrow(/target-Hitlag row must exactly match/);
    sourceObservation.targetFrame = 8;
    sourceApplication.targetFrame = 8;
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(
        targetClockLagged
      )
    ).toThrow(/target-clock|targetFrame|Aura witness/);
  });

  it("fail-closes every exact 1.41 nearby-Wet trigger, child, clock, and periodic provenance edge", () => {
    const expectRejected = (
      label: string,
      mutate: (result: any) => void
    ): void => {
      const result: any =
        makeNearbyWetPropagationReferenceResult();
      mutate(result);
      expect(
        reactionDeliveryResultReferencesSchema.safeParse(
          result
        ).success,
        label
      ).toBe(false);
    };
    const selected = (result: any, candidateIndex = 1) => {
      const candidate =
        result.reactionDamageLog[0]
          .electroChargedPropagation.candidates[
          candidateIndex
        ];
      return {
        candidate,
        hit:
          result.hitResolutionLog[
            candidate.hitResolutionLogId
          ],
        damage:
          result.damageEvents[candidate.damageEventId],
        application:
          result.targetStateTimeline.points.find(
            (point: any) =>
              point.cause ===
                "reaction-damage-application" &&
              point.primaryDamageEventId ===
                candidate.damageEventId
          ),
        observation:
          result.targetStateTimeline.points[
            candidate.auraObservationTimelinePointId
          ]
      };
    };
    const triggerApplication = (result: any) =>
      result.targetStateTimeline.points.find(
        (point: any) =>
          point.cause === "direct-hit-application" &&
          point.primaryDamageEventId === 0
      );
    const periodic = (result: any, operation: string) =>
      result.periodicReactionLog.find(
        (entry: any) => entry.operation === operation
      );
    const periodicTimeline = (
      result: any,
      cause: string
    ) =>
      result.targetStateTimeline.points.find(
        (point: any) => point.cause === cause
      );

    const triggerMutations: Array<
      readonly [string, (result: any) => void]
    > = [
      [
        "trigger kind",
        (result) => {
          result.damageEvents[0].kind =
            "transformative-reaction";
        }
      ],
      [
        "trigger parent",
        (result) => {
          result.damageEvents[0].parentDamageEventId = 1;
        }
      ],
      [
        "trigger target name",
        (result) => {
          result.damageEvents[0].targetName = "Forged";
        }
      ],
      [
        "trigger target resolution",
        (result) => {
          result.damageEvents[0].targetResolutionId = 1;
        }
      ],
      [
        "trigger event priority",
        (result) => {
          result.damageEvents[0].eventPriority = 4;
        }
      ],
      [
        "trigger event sequence",
        (result) => {
          result.damageEvents[0].eventSequence = 2;
        }
      ],
      [
        "trigger action",
        (result) => {
          result.damageEvents[0].actionId = "forged";
        }
      ],
      [
        "trigger action name",
        (result) => {
          result.damageEvents[0].actionName = "Forged";
        }
      ],
      [
        "trigger hit",
        (result) => {
          result.damageEvents[0].hitId = "forged";
        }
      ],
      [
        "trigger hit group",
        (result) => {
          result.damageEvents[0].hitGroupId = "forged";
        }
      ],
      [
        "trigger hit backlink",
        (result) => {
          result.hitResolutionLog[0].damageEventId = 1;
        }
      ],
      [
        "trigger hit action backlink",
        (result) => {
          result.hitResolutionLog[0].sourceActionId =
            "forged";
        }
      ],
      [
        "trigger application primary",
        (result) => {
          triggerApplication(result).primaryDamageEventId = 1;
        }
      ],
      [
        "trigger application links",
        (result) => {
          triggerApplication(result).links[0].id = 1;
        }
      ],
      [
        "trigger application intra-event ordering",
        (result) => {
          triggerApplication(result).intraEventSequence = 1;
        }
      ],
      [
        "trigger application Aura",
        (result) => {
          triggerApplication(result).auraAfter[0]
            .gaugeUnits += 0.01;
        }
      ]
    ];
    triggerMutations.forEach(([label, mutate]) =>
      expectRejected(label, mutate)
    );

    for (const [field, forgedValue] of [
      ["generation", 2],
      ["operation", "refresh"],
      ["damageElement", "hydro"],
      ["baseMultiplier", 3],
      ["firstDamageFrame", 11],
      ["nextTickFrame", 71],
      ["tickIntervalFrames", 59],
      ["waneDelayFrames", 5],
      ["waneGaugeUnits", 0.5],
      ["coexistenceExpiresAtFrame", 569]
    ] as const) {
      expectRejected(
        `trigger periodic audit ${field}`,
        (result) => {
          result.damageEvents[0].reactionAudit
            .periodicReaction[field] = forgedValue;
        }
      );
    }

    const selectedHitMutations: Array<
      readonly [string, (result: any) => void]
    > = [
      [
        "selected hit time",
        (result) => {
          selected(result).hit.timeSeconds += 0.01;
        }
      ],
      [
        "selected hit intra-event ordering",
        (result) => {
          selected(result).hit.intraEventSequence += 1;
        }
      ],
      [
        "selected hit source position",
        (result) => {
          selected(result).hit.sourceActorPosition = {
            x: 0,
            y: 0
          };
        }
      ],
      [
        "selected hit source facing",
        (result) => {
          selected(result).hit.sourceActorFacingDegrees = 0;
        }
      ],
      [
        "selected hit reason",
        (result) => {
          selected(result).hit.reason = "FORGED";
        }
      ],
      [
        "selected hit target effect source",
        (result) => {
          selected(result).hit.targetEffectSource =
            "target-phase";
        }
      ],
      [
        "selected hit target phase",
        (result) => {
          selected(result).hit.targetPhaseId =
            "immune-at-first-tick";
        }
      ],
      [
        "selected hit and damage source ability",
        (result) => {
          const child = selected(result);
          child.hit.sourceAbilityId = "forged";
          child.damage.sourceAbilityId = "forged";
        }
      ],
      [
        "selected hit and damage cycle",
        (result) => {
          const child = selected(result);
          child.hit.cycle = 1;
          child.damage.cycle = 1;
        }
      ],
      [
        "selected hit and damage timeline command",
        (result) => {
          const child = selected(result);
          child.hit.timelineCommandIndex = 1;
          child.damage.timelineCommandIndex = 1;
        }
      ],
      [
        "selected hit and damage mechanics status",
        (result) => {
          const child = selected(result);
          child.hit.mechanicsStatus =
            "mechanics-truncated";
          child.damage.mechanicsStatus =
            "mechanics-truncated";
        }
      ]
    ];
    selectedHitMutations.forEach(([label, mutate]) =>
      expectRejected(label, mutate)
    );

    const selectedDamageMutations: Array<
      readonly [string, (result: any) => void]
    > = [
      [
        "selected damage time",
        (result) => {
          selected(result).damage.timeSeconds += 0.01;
        }
      ],
      [
        "selected damage active character",
        (result) => {
          selected(result).damage.activeCharacterId =
            "forged-active";
        }
      ],
      [
        "selected damage active id",
        (result) => {
          selected(result).damage.activeId =
            "forged-active";
        }
      ],
      [
        "selected damage audit model",
        (result) => {
          selected(result).damage.reactionAudit.model =
            "aura-engine";
        }
      ],
      [
        "selected damage audit trigger",
        (result) => {
          selected(result).damage.reactionAudit.triggered =
            false;
        }
      ],
      [
        "selected damage audit reaction",
        (result) => {
          selected(result).damage.reactionAudit.reaction =
            "overload";
        }
      ],
      [
        "selected damage ordered reactions",
        (result) => {
          selected(result).damage.reactionAudit.reactions =
            [];
        }
      ],
      [
        "selected damage periodic audit",
        (result) => {
          selected(result).damage.reactionAudit
            .periodicReaction =
            structuredClone(
              result.damageEvents[0].reactionAudit
                .periodicReaction
            );
        }
      ],
      [
        "selected application time",
        (result) => {
          selected(result).application.timeSeconds += 0.01;
        }
      ],
      [
        "selected application intra-event ordering",
        (result) => {
          selected(result).application.intraEventSequence += 1;
        }
      ],
      [
        "candidate witness intra-event ordering",
        (result) => {
          selected(result).observation.intraEventSequence += 1;
        }
      ]
    ];
    selectedDamageMutations.forEach(([label, mutate]) =>
      expectRejected(label, mutate)
    );

    const periodicMutations: Array<
      readonly [string, (result: any) => void]
    > = [
      [
        "duplicate generation start",
        (result) => {
          const duplicate = structuredClone(
            periodic(result, "start")
          );
          duplicate.id = result.periodicReactionLog.length;
          result.periodicReactionLog.push(duplicate);
        }
      ],
      [
        "start target name",
        (result) => {
          periodic(result, "start").targetName = "Forged";
        }
      ],
      [
        "start source",
        (result) => {
          periodic(result, "start").sourceActorId =
            "forged";
        }
      ],
      [
        "start trigger",
        (result) => {
          periodic(result, "start").triggerDamageEventId = 1;
        }
      ],
      [
        "start reaction parent",
        (result) => {
          periodic(result, "start").reactionDamageLogId = 0;
        }
      ],
      [
        "start damage child",
        (result) => {
          periodic(result, "start").damageEventId = 1;
        }
      ],
      [
        "start tick index",
        (result) => {
          periodic(result, "start").tickIndex = 0;
        }
      ],
      [
        "start next tick",
        (result) => {
          periodic(result, "start").nextTickFrame = 71;
        }
      ],
      [
        "start Aura",
        (result) => {
          periodic(result, "start").auraAfter[0]
            .gaugeUnits += 0.01;
        }
      ],
      [
        "tick reaction parent",
        (result) => {
          periodic(result, "tick").reactionDamageLogId = null;
        }
      ],
      [
        "tick source child",
        (result) => {
          periodic(result, "tick").damageEventId = 2;
        }
      ],
      [
        "tick index",
        (result) => {
          periodic(result, "tick").tickIndex = 1;
        }
      ],
      [
        "tick trigger",
        (result) => {
          periodic(result, "tick").triggerDamageEventId = null;
        }
      ],
      [
        "tick source",
        (result) => {
          periodic(result, "tick").sourceActorId = null;
        }
      ],
      [
        "tick next cadence",
        (result) => {
          periodic(result, "tick").nextTickFrame = 71;
        }
      ],
      [
        "tick Wane cadence",
        (result) => {
          periodic(result, "tick").waneFrame = 17;
        }
      ],
      [
        "tick immutable Aura",
        (result) => {
          periodic(result, "tick").auraConsumed.push({
            element: "hydro",
            gaugeUnits: 0.1
          });
        }
      ],
      [
        "tick reason while stream continues",
        (result) => {
          periodic(result, "tick").reason = "FORGED";
        }
      ],
      [
        "tick timeline link",
        (result) => {
          periodicTimeline(
            result,
            "electro-charged-tick"
          ).links[0].id = 0;
        }
      ],
      [
        "tick timeline Aura",
        (result) => {
          periodicTimeline(
            result,
            "electro-charged-tick"
          ).auraAfter[0].gaugeUnits += 0.01;
        }
      ],
      [
        "Wane operation",
        (result) => {
          periodic(result, "wane").operation =
            "wane-skipped";
        }
      ],
      [
        "Wane frame",
        (result) => {
          periodic(result, "wane").frame = 17;
          periodic(result, "wane").timeSeconds = 17 / 60;
        }
      ],
      [
        "Wane source child",
        (result) => {
          periodic(result, "wane").damageEventId = 2;
        }
      ],
      [
        "Wane trigger",
        (result) => {
          periodic(result, "wane").triggerDamageEventId = 1;
        }
      ],
      [
        "Wane reaction parent",
        (result) => {
          periodic(result, "wane").reactionDamageLogId = 0;
        }
      ],
      [
        "Wane tick index",
        (result) => {
          periodic(result, "wane").tickIndex = 1;
        }
      ],
      [
        "Wane gauge",
        (result) => {
          periodic(result, "wane").auraConsumed[0]
            .gaugeUnits = 0.3;
        }
      ],
      [
        "Wane Aura result",
        (result) => {
          const wane = periodic(result, "wane");
          const hydro = wane.auraAfter.find(
            (aura: any) => aura.element === "hydro"
          );
          hydro.gaugeUnits += 0.01;
          hydro.sourceSlots[0].gaugeUnits += 0.01;
          periodicTimeline(
            result,
            "electro-charged-wane"
          ).auraAfter = structuredClone(wane.auraAfter);
        }
      ],
      [
        "Wane timeline source child",
        (result) => {
          periodicTimeline(
            result,
            "electro-charged-wane"
          ).primaryDamageEventId = 2;
        }
      ],
      [
        "orphan tick with null parents",
        (result) => {
          const orphan = structuredClone(
            periodic(result, "tick")
          );
          orphan.id = result.periodicReactionLog.length;
          orphan.generation = 99;
          orphan.reactionDamageLogId = null;
          orphan.damageEventId = null;
          orphan.tickIndex = null;
          orphan.triggerDamageEventId = null;
          orphan.sourceActorId = null;
          result.periodicReactionLog.push(orphan);
        }
      ]
    ];
    periodicMutations.forEach(([label, mutate]) =>
      expectRejected(label, mutate)
    );
  });

  it("strictly freezes both 1.41 Golden fixture envelopes and their provisional provenance", () => {
    expect(() =>
      electroChargedPropagationGoldenFixtureV141Schema.parse(
        electroChargedPropagationGolden
      )
    ).not.toThrow();
    expect(() =>
      legacyDefault120sGoldenFixtureV141Schema.parse(
        legacyDefault120sGolden
      )
    ).not.toThrow();
    expect(() =>
      goldenFixtureEnvelopeV141Schema.parse(
        electroChargedPropagationGolden
      )
    ).not.toThrow();
    expect(() =>
      goldenFixtureEnvelopeV141Schema.parse(
        legacyDefault120sGolden
      )
    ).not.toThrow();
    expect(
      createHash("sha256")
        .update(
          canonicalStringify(
            electroChargedPropagationGolden.scenario
          )
        )
        .digest("hex")
    ).toBe(electroChargedPropagationGolden.scenarioSha256);

    const expectPropagationDriftRejected = (
      label: string,
      mutate: (fixture: any) => void
    ): void => {
      const fixture: any = structuredClone(
        electroChargedPropagationGolden
      );
      mutate(fixture);
      expect(
        electroChargedPropagationGoldenFixtureV141Schema.safeParse(
          fixture
        ).success,
        label
      ).toBe(false);
    };
    const expectLegacyDriftRejected = (
      label: string,
      mutate: (fixture: any) => void
    ): void => {
      const fixture: any = structuredClone(
        legacyDefault120sGolden
      );
      mutate(fixture);
      expect(
        legacyDefault120sGoldenFixtureV141Schema.safeParse(
          fixture
        ).success,
        label
      ).toBe(false);
    };
    expectPropagationDriftRejected(
      "unknown envelope field",
      (fixture) => {
        fixture.futureClaim = true;
      }
    );
    expectPropagationDriftRejected(
      "reference commit",
      (fixture) => {
        fixture.provenance.referenceCommit = "forged";
      }
    );
    expectPropagationDriftRejected(
      "provisional mechanics status",
      (fixture) => {
        fixture.provenance.mechanicsDataStatus =
          "official-verified";
      }
    );
    expectPropagationDriftRejected(
      "single-target gcsim disclaimer",
      (fixture) => {
        fixture.provenance.notes[0] =
          "Nearby propagation is official.";
      }
    );
    expectPropagationDriftRejected(
      "scenario identity",
      (fixture) => {
        fixture.scenario.identity.engineVersion = "forged";
      }
    );
    expectPropagationDriftRejected(
      "scenario config hash",
      (fixture) => {
        fixture.scenario.identity.configHash =
          "fnv1a32:00000000";
      }
    );
    expectPropagationDriftRejected(
      "nearby radius",
      (fixture) => {
        fixture.scenario.configContract
          .electroChargedPropagationModel.radius = 5;
      }
    );
    expectPropagationDriftRejected(
      "damage total",
      (fixture) => {
        fixture.scenario.totals.totalDamage += 1;
      }
    );
    expectPropagationDriftRejected(
      "scenario SHA",
      (fixture) => {
        fixture.scenarioSha256 = "0".repeat(64);
      }
    );

    expectLegacyDriftRejected(
      "unverified-data disclaimer",
      (fixture) => {
        fixture.provenance.note =
          "All values are officially verified.";
      }
    );
    expectLegacyDriftRejected(
      "legacy config hash",
      (fixture) => {
        fixture.configHash = "fnv1a32:00000000";
      }
    );
    expectLegacyDriftRejected(
      "legacy propagation mode",
      (fixture) => {
        fixture.electroChargedPropagationModel.mode =
          "nearby-wet-radius-v1";
      }
    );
    expectLegacyDriftRejected(
      "legacy total",
      (fixture) => {
        fixture.totalDamage += 1;
      }
    );
    expectLegacyDriftRejected(
      "legacy damage digest",
      (fixture) => {
        fixture.legacyDamageEventsSha256 =
          "0".repeat(64);
      }
    );

    const inheritedFixture = Object.assign(
      Object.create({
        fixtureVersion:
          electroChargedPropagationGolden.fixtureVersion
      }),
      structuredClone(electroChargedPropagationGolden)
    );
    delete inheritedFixture.fixtureVersion;
    expect(
      electroChargedPropagationGoldenFixtureV141Schema.safeParse(
        inheritedFixture
      ).success
    ).toBe(false);
  });

  it("strictly freezes the exact 1.42 default and five-scenario EC cadence Golden envelopes", () => {
    expect(() =>
      legacyDefault120sGoldenFixtureV142Schema.parse(
        legacyDefault120sGoldenV142
      )
    ).not.toThrow();
    expect(() =>
      electroChargedGlobalCadenceGoldenFixtureV142Schema.parse(
        electroChargedGlobalCadenceGoldenV142
      )
    ).not.toThrow();
    expect(
      Object.keys(
        electroChargedGlobalCadenceGoldenV142.scenarios
      ).sort()
    ).toEqual(
      [...electroChargedGlobalCadenceGoldenScenarioIdsV142].sort()
    );

    const forgedDefault: any = structuredClone(
      legacyDefault120sGoldenV142
    );
    forgedDefault.totalDamage += 1;
    expect(
      legacyDefault120sGoldenFixtureV142Schema.safeParse(
        forgedDefault
      ).success
    ).toBe(false);
    forgedDefault.totalDamage =
      legacyDefault120sGoldenV142.totalDamage;
    forgedDefault.configHash = "fnv1a32:00000000";
    expect(
      legacyDefault120sGoldenFixtureV142Schema.safeParse(
        forgedDefault
      ).success
    ).toBe(false);

    const missingScenario: any = structuredClone(
      electroChargedGlobalCadenceGoldenV142
    );
    delete missingScenario.scenarios
      .longHitlagRestoreF71Dormant;
    expect(
      electroChargedGlobalCadenceGoldenFixtureV142Schema.safeParse(
        missingScenario
      ).success
    ).toBe(false);

    const forgedCadence: any = structuredClone(
      electroChargedGlobalCadenceGoldenV142
    );
    delete forgedCadence.scenarios.longHitlagNoRestoreStop
      .periodicElectroCharged[0].cadenceStatus;
    expect(
      electroChargedGlobalCadenceGoldenFixtureV142Schema.safeParse(
        forgedCadence
      ).success
    ).toBe(false);

    const forgedComposition: any = structuredClone(
      electroChargedGlobalCadenceGoldenV142
    );
    forgedComposition.scenarios.pureEcHitlag120GlobalCadence
      .damageEvents[0].damageComposition
      .transformativeReaction += 1;
    expect(
      electroChargedGlobalCadenceGoldenFixtureV142Schema.safeParse(
        forgedComposition
      ).success
    ).toBe(false);

    const forgedScenarioHash: any = structuredClone(
      electroChargedGlobalCadenceGoldenV142
    );
    forgedScenarioHash.hashes.longHitlagNoRestoreStop =
      "0".repeat(64);
    expect(
      electroChargedGlobalCadenceGoldenFixtureV142Schema.safeParse(
        forgedScenarioHash
      ).success
    ).toBe(false);
  });

  it("keeps aura-v9 cleanup validation isolated from non-EC and mixed global reaction logs", () => {
    const projectScenario = (scenario: any): any => ({
      schemaVersion: scenario.identity.schemaVersion,
      engineVersion: scenario.identity.engineVersion,
      config: {
        schemaVersion: scenario.identity.schemaVersion,
        engineVersion: scenario.identity.engineVersion,
        duration: scenario.configContract.duration,
        enemy: scenario.configContract.enemy,
        reactionEngine: scenario.configContract.reactionEngine,
        targetClockModel:
          scenario.configContract.targetClockModel,
        targetTaskModel:
          scenario.configContract.targetTaskModel,
        electroChargedPropagationModel:
          scenario.configContract
            .electroChargedPropagationModel,
        timeline: {
          ...scenario.configContract.timeline,
          legalityMode: "strict",
          initialActiveCharacterId: "schema-projection",
          swapFrames: 1,
          abilities: [],
          commands: []
        }
      },
      reactionTaskLog: scenario.reactionTasks,
      targetPhaseLog: scenario.targetPhaseLog,
      targetStateTimeline: scenario.targetStateTimeline,
      periodicReactionLog:
        scenario.periodicElectroCharged,
      reactionDamageLog: scenario.reactionDamageLog,
      damageEvents: scenario.damageEvents,
      targetClockAudit: scenario.targetClockAudit,
      targetClockLog: scenario.targetClockLog
    });
    const nonEcOnly = {
      schemaVersion:
        EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
      engineVersion:
        EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION,
      config: {
        schemaVersion:
          EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
        engineVersion:
          EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION,
        duration: 1,
        enemy: {
          level: 90,
          resistance: 0.1,
          defReduction: 0,
          targets: [
            {
              id: "enemy-0",
              name: "Non-EC target"
            }
          ]
        },
        reactionEngine: { mode: "aura-v9" },
        targetClockModel: { mode: "disabled" },
        targetTaskModel: { mode: "target-phase-v2" },
        electroChargedPropagationModel: {
          mode: "single-target-v1"
        },
        timeline: {
          mode: "legal-frame-v1",
          fps: 60,
          legalityMode: "strict",
          initialActiveCharacterId: "schema-projection",
          swapFrames: 1,
          abilities: [],
          commands: []
        }
      },
      reactionTaskLog: [],
      targetPhaseLog: [],
      targetStateTimeline: {
        version: "1.0.0",
        points: [
          {
            id: 0,
            frame: 0,
            targetFrame: 0,
            timeSeconds: 0,
            targetId: "enemy-0",
            targetName: "Non-EC target",
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
            targetFrame: 60,
            timeSeconds: 1,
            targetId: "enemy-0",
            targetName: "Non-EC target",
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
      },
      periodicReactionLog: [],
      reactionDamageLog: [
        {
          id: 0,
          reaction: "overload",
          sourceActorId: "driver",
          sourceTargetId: "enemy-0",
          triggerFrame: 0,
          damageFrame: 0,
          scheduled: true,
          withinSimulation: true,
          blockedReason: null,
          nextAvailableFrame: 60,
          scheduleKind: "one-shot",
          damageEventIds: []
        }
      ],
      damageEvents: [],
      targetClockAudit: {
        version: "1.0.0",
        mode: "disabled",
        hitlagStatus: "unsupported-enemy-hitlag",
        targets: []
      },
      targetClockLog: []
    };
    expect(() =>
      electroChargedCleanupResultReferencesSchema.parse(
        nonEcOnly
      )
    ).not.toThrow();

    const pureEc = projectScenario(
      electroChargedGlobalCadenceGoldenV142.scenarios
        .pureEcHitlag120GlobalCadence
    );
    expect(() =>
      electroChargedCleanupResultReferencesSchema.parse(pureEc)
    ).not.toThrow();

    const mixed = structuredClone(pureEc);
    mixed.reactionDamageLog.push({
      id: mixed.reactionDamageLog.length,
      reaction: "overload",
      sourceActorId: "driver",
      sourceTargetId: "enemy-0",
      triggerFrame: 0,
      damageFrame: 0,
      scheduled: true,
      withinSimulation: true,
      blockedReason: null,
      nextAvailableFrame: 60,
      scheduleKind: "one-shot",
      damageEventIds: []
    });
    expect(() =>
      electroChargedCleanupResultReferencesSchema.parse(mixed)
    ).not.toThrow();

    mixed.reactionDamageLog.at(-1).reaction =
      "electroCharged";
    expect(() =>
      electroChargedCleanupResultReferencesSchema.parse(mixed)
    ).toThrow(
      /Electro-Charged cleanup-owned reaction damage requires periodic-tick/
    );
  });

  it("isolates aura-v9 cadence fields from aura-v8 result wires", () => {
    const scenario: any =
      electroChargedGlobalCadenceGoldenV142.scenarios
        .pureEcHitlag120GlobalCadence;
    const v9: any = {
      schemaVersion: scenario.identity.schemaVersion,
      engineVersion: scenario.identity.engineVersion,
      config: {
        schemaVersion: scenario.identity.schemaVersion,
        engineVersion: scenario.identity.engineVersion,
        duration: scenario.configContract.duration,
        enemy: scenario.configContract.enemy,
        reactionEngine: { mode: "aura-v9" },
        targetClockModel:
          scenario.configContract.targetClockModel,
        targetTaskModel:
          scenario.configContract.targetTaskModel,
        electroChargedPropagationModel:
          scenario.configContract
            .electroChargedPropagationModel,
        timeline: {
          ...scenario.configContract.timeline,
          legalityMode: "strict",
          initialActiveCharacterId: "schema-projection",
          swapFrames: 1,
          abilities: [],
          commands: []
        }
      },
      reactionTaskLog: scenario.reactionTasks,
      targetPhaseLog: scenario.targetPhaseLog,
      targetStateTimeline: scenario.targetStateTimeline,
      periodicReactionLog:
        scenario.periodicElectroCharged,
      reactionDamageLog: scenario.reactionDamageLog,
      damageEvents: scenario.damageEvents,
      targetClockAudit: scenario.targetClockAudit,
      targetClockLog: scenario.targetClockLog
    };
    const missingV9Cadence = structuredClone(v9);
    delete missingV9Cadence.periodicReactionLog[0]
      .cadenceStatus;
    expect(() =>
      electroChargedCleanupResultReferencesSchema.parse(
        missingV9Cadence
      )
    ).toThrow(
      /aura-v9 periodic rows require explicit cadenceStatus/
    );

    const v8 = structuredClone(v9);
    v8.config.reactionEngine.mode = "aura-v8";
    expect(() =>
      electroChargedCleanupResultReferencesSchema.parse(v8)
    ).toThrow(/aura-v8 periodic rows must omit aura-v9 cadence/);
    for (const row of v8.periodicReactionLog) {
      delete row.cadenceStatus;
      delete row.waneListenerActive;
    }
    expect(() =>
      electroChargedCleanupResultReferencesSchema.parse(v8)
    ).not.toThrow();
  });

  it("rejects any same-generation lifecycle row after an ended-before terminal and before cleanup", () => {
    const scenario: any =
      electroChargedGlobalCadenceGoldenV142.scenarios
        .longHitlagRestoreF5EndedBeforeDeadline;
    const result: any = {
      schemaVersion: scenario.identity.schemaVersion,
      engineVersion: scenario.identity.engineVersion,
      config: {
        schemaVersion: scenario.identity.schemaVersion,
        engineVersion: scenario.identity.engineVersion,
        duration: scenario.configContract.duration,
        enemy: scenario.configContract.enemy,
        reactionEngine: scenario.configContract.reactionEngine,
        targetClockModel:
          scenario.configContract.targetClockModel,
        targetTaskModel:
          scenario.configContract.targetTaskModel,
        electroChargedPropagationModel:
          scenario.configContract
            .electroChargedPropagationModel,
        timeline: {
          ...scenario.configContract.timeline,
          legalityMode: "strict",
          initialActiveCharacterId: "schema-projection",
          swapFrames: 1,
          abilities: [],
          commands: []
        }
      },
      reactionTaskLog: scenario.reactionTasks,
      targetPhaseLog: scenario.targetPhaseLog,
      targetStateTimeline: scenario.targetStateTimeline,
      periodicReactionLog: structuredClone(
        scenario.periodicElectroCharged
      ),
      reactionDamageLog: scenario.reactionDamageLog,
      damageEvents: scenario.damageEvents,
      targetClockAudit: scenario.targetClockAudit,
      targetClockLog: scenario.targetClockLog
    };
    expect(() =>
      electroChargedCleanupResultReferencesSchema.parse(result)
    ).not.toThrow();

    const terminal = result.periodicReactionLog.at(-1);
    const laterLifecycle = {
      ...structuredClone(terminal),
      id: result.periodicReactionLog.length,
      operation: "refresh",
      frame: terminal.frame + 1,
      timeSeconds: (terminal.frame + 1) / 60,
      reactionDamageLogId: null,
      damageEventId: null,
      tickIndex: null,
      auraBefore: terminal.auraAfter,
      auraConsumed: [],
      auraAfter: terminal.auraAfter,
      waneFrame: null,
      reason: null
    };
    delete laterLifecycle.reactionTaskLogId;
    result.periodicReactionLog.push(laterLifecycle);
    expect(() =>
      electroChargedCleanupResultReferencesSchema.parse(result)
    ).toThrow(/no later lifecycle row/);
  });

  it("version-gates EC propagation result wires and rejects inherited result identity", () => {
    const historical: any =
      makeElectroChargedDamageGroupReplayResult([
        { frame: 10, windowStartFrame: 10, hitIndex: 0 }
      ]);
    historical.schemaVersion =
      EC_NEXT_TARGET_TICK_SCHEMA_VERSION;
    historical.engineVersion =
      EC_NEXT_TARGET_TICK_ENGINE_VERSION;
    historical.config.schemaVersion =
      EC_NEXT_TARGET_TICK_SCHEMA_VERSION;
    historical.config.engineVersion =
      EC_NEXT_TARGET_TICK_ENGINE_VERSION;
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(historical)
    ).not.toThrow();

    const smuggled = structuredClone(historical) as any;
    smuggled.reactionDamageLog[0].targetingMode =
      "electro-charged-nearby-wet";
    smuggled.reactionDamageLog[0].electroChargedPropagation = {
      model: "nearby-wet-radius-v1",
      verificationStatus: "provisional",
      mechanicsDataStatus: "community-provisional",
      generation: 1,
      tickIndex: 0,
      evaluationFrame: 10,
      eventPriority: 5,
      eventSequence: 1,
      radius: 5,
      selectionMode:
        "all-in-range-registration-order-v1",
      sourcePosition: { x: 0, y: 0 },
      candidates: [
        {
          targetId: "enemy-0",
          targetName: "Target",
          targetOrder: 0,
          hydroGaugeUnits: 0.4,
          position: { x: 0, y: 0 },
          distance: null,
          threshold: null,
          selected: true,
          reason: "SOURCE_STREAM_TARGET",
          auraObservationTimelinePointId: 0,
          hitResolutionLogId: 0,
          damageEventId: 1
        }
      ]
    };
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(smuggled)
    ).toThrow(/pre-1\.41/);

    const currentSingle = structuredClone(historical) as any;
    currentSingle.schemaVersion = CURRENT_SCHEMA_VERSION;
    currentSingle.engineVersion = CURRENT_ENGINE_VERSION;
    currentSingle.config.schemaVersion =
      CURRENT_SCHEMA_VERSION;
    currentSingle.config.engineVersion =
      CURRENT_ENGINE_VERSION;
    currentSingle.config.electroChargedPropagationModel = {
      mode: "single-target-v1"
    };
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(
        currentSingle
      )
    ).not.toThrow();
    currentSingle.reactionDamageLog[0]
      .electroChargedPropagation =
      smuggled.reactionDamageLog[0]
        .electroChargedPropagation;
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(
        currentSingle
      )
    ).toThrow(/single-target-v1/);

    const inheritedIdentity =
      structuredClone(historical) as Record<string, unknown>;
    const schemaVersion = inheritedIdentity.schemaVersion;
    delete inheritedIdentity.schemaVersion;
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(
        Object.assign(
          Object.create({ schemaVersion }),
          inheritedIdentity
        )
      )
    ).toThrow(/explicit own wire properties/);
  });

  it("sanitizes the full reaction-delivery wire without invoking accessors or inherited proof fields", () => {
    const expectWireRejected = (wire: unknown): void => {
      expect(
        reactionDeliveryResultReferencesSchema.safeParse(wire)
          .success
      ).toBe(false);
    };

    for (const [ownerKind, field] of [
      ["root", "damageEvents"],
      ["root", "reactionDamageLog"],
      ["root", "hitResolutionLog"],
      ["root", "periodicReactionLog"],
      ["root", "targetStateTimeline"],
      ["config", "duration"],
      ["config", "enemy"],
      ["config", "timeline"],
      ["config", "reactionDeliveryModel"],
      ["config", "electroChargedPropagationModel"]
    ] as const) {
      const wire: any =
        makeNearbyWetPropagationReferenceResult();
      const owner =
        ownerKind === "root" ? wire : wire.config;
      const inheritedValue = owner[field];
      delete owner[field];
      const previousDescriptor =
        Object.getOwnPropertyDescriptor(
          Object.prototype,
          field
        );
      Object.defineProperty(Object.prototype, field, {
        value: inheritedValue,
        enumerable: false,
        configurable: true,
        writable: true
      });
      try {
        expect(
          reactionDeliveryResultReferencesSchema.safeParse(
            wire
          ).success,
          `${ownerKind}.${field}`
        ).toBe(false);
      } finally {
        if (previousDescriptor === undefined) {
          delete (Object.prototype as any)[field];
        } else {
          Object.defineProperty(
            Object.prototype,
            field,
            previousDescriptor
          );
        }
      }
    }

    let getterCalls = 0;
    const getterWire: any =
      makeNearbyWetPropagationReferenceResult();
    delete getterWire.damageEvents;
    Object.defineProperty(getterWire, "damageEvents", {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        return [];
      }
    });
    expectWireRejected(getterWire);
    expect(getterCalls).toBe(0);

    let arrayGetterCalls = 0;
    const arrayGetterWire: any =
      makeNearbyWetPropagationReferenceResult();
    Object.defineProperty(
      arrayGetterWire.hitResolutionLog,
      "1",
      {
        enumerable: true,
        configurable: true,
        get() {
          arrayGetterCalls += 1;
          return {};
        }
      }
    );
    expectWireRejected(arrayGetterWire);
    expect(arrayGetterCalls).toBe(0);

    for (const invalidValue of [
      undefined,
      () => undefined,
      Symbol("wire-value"),
      1n,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY
    ]) {
      const wire: any =
        makeNearbyWetPropagationReferenceResult();
      wire.untrustedExtension = invalidValue;
      expectWireRejected(wire);
    }

    let toJsonCalls = 0;
    const toJsonWire: any =
      makeNearbyWetPropagationReferenceResult();
    toJsonWire.toJSON = () => {
      toJsonCalls += 1;
      return {};
    };
    expectWireRejected(toJsonWire);
    expect(toJsonCalls).toBe(0);

    const symbolWire: any =
      makeNearbyWetPropagationReferenceResult();
    Object.defineProperty(symbolWire, Symbol("wire-field"), {
      value: true,
      enumerable: true
    });
    expectWireRejected(symbolWire);

    const hiddenWire: any =
      makeNearbyWetPropagationReferenceResult();
    Object.defineProperty(hiddenWire, "hiddenField", {
      value: true,
      enumerable: false
    });
    expectWireRejected(hiddenWire);

    const sparseWire: any =
      makeNearbyWetPropagationReferenceResult();
    delete sparseWire.hitResolutionLog[1];
    expectWireRejected(sparseWire);

    const extraArrayPropertyWire: any =
      makeNearbyWetPropagationReferenceResult();
    extraArrayPropertyWire.hitResolutionLog.extra = true;
    expectWireRejected(extraArrayPropertyWire);

    const sharedProof = Object.assign(
      Object.create(null),
      { marker: "shared-dag" }
    );
    const sharedDagWire: any =
      makeNearbyWetPropagationReferenceResult();
    sharedDagWire.proofA = sharedProof;
    sharedDagWire.proofB = sharedProof;
    expect(
      reactionDeliveryResultReferencesSchema.safeParse(
        sharedDagWire
      ).success
    ).toBe(true);

    const cyclicWire: any =
      makeNearbyWetPropagationReferenceResult();
    cyclicWire.recursive = cyclicWire;
    expectWireRejected(cyclicWire);

    const throwingProxyWire: any =
      makeNearbyWetPropagationReferenceResult();
    throwingProxyWire.untrustedExtension = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("must not escape safeParse");
        }
      }
    );
    expectWireRejected(throwingProxyWire);

    const revokedProxyWire: any =
      makeNearbyWetPropagationReferenceResult();
    const revokedArrayProxy = Proxy.revocable([], {});
    revokedProxyWire.untrustedExtension =
      revokedArrayProxy.proxy;
    revokedArrayProxy.revoke();
    let revokedProxyResult:
      | ReturnType<
          typeof reactionDeliveryResultReferencesSchema.safeParse
        >
      | undefined;
    expect(() => {
      revokedProxyResult =
        reactionDeliveryResultReferencesSchema.safeParse(
          revokedProxyWire
        );
    }).not.toThrow();
    expect(revokedProxyResult?.success).toBe(false);

    const deepWire: any =
      makeNearbyWetPropagationReferenceResult();
    let deepExtension: Record<string, unknown> = {
      leaf: true
    };
    for (let depth = 0; depth < 20_000; depth += 1) {
      deepExtension = { child: deepExtension };
    }
    deepWire.untrustedExtension = deepExtension;
    let deepResult:
      | ReturnType<
          typeof reactionDeliveryResultReferencesSchema.safeParse
        >
      | undefined;
    expect(() => {
      deepResult =
        reactionDeliveryResultReferencesSchema.safeParse(
          deepWire
        );
    }).not.toThrow();
    expect(deepResult?.success).toBe(false);
    if (deepResult?.success === false) {
      expect(deepResult.error.message).toMatch(
        /maximum JSON wire depth/
      );
    }

    const nonWritablePrototypeWire: any =
      makeNearbyWetPropagationReferenceResult();
    nonWritablePrototypeWire.toString = "own-wire-value";
    const originalToStringDescriptor =
      Object.getOwnPropertyDescriptor(
        Object.prototype,
        "toString"
      )!;
    Object.defineProperty(Object.prototype, "toString", {
      ...originalToStringDescriptor,
      writable: false
    });
    try {
      let nonWritablePrototypeResult:
        | ReturnType<
            typeof reactionDeliveryResultReferencesSchema.safeParse
          >
        | undefined;
      expect(() => {
        nonWritablePrototypeResult =
          reactionDeliveryResultReferencesSchema.safeParse(
            nonWritablePrototypeWire
          );
      }).not.toThrow();
      expect(nonWritablePrototypeResult?.success).toBe(false);
      if (nonWritablePrototypeResult?.success === false) {
        expect(
          nonWritablePrototypeResult.error.message
        ).toMatch(/non-writable Object\.prototype/);
      }
    } finally {
      Object.defineProperty(
        Object.prototype,
        "toString",
        originalToStringDescriptor
      );
    }
  });

  it("migrates the exact 1.38 wire deeply and rejects future fields on every historical wire", () => {
    const current = makeLegalAuraV7Config();
    const historical = {
      ...asPre139Wire(current),
      schemaVersion: TARGET_REACTABLE_PHASE_SCHEMA_VERSION,
      engineVersion: TARGET_REACTABLE_PHASE_ENGINE_VERSION,
      targetTaskModel: { mode: "target-phase-v2" as const }
    };
    const migrated = migrateConfig(historical);
    const {
      schemaVersion: _schemaVersion,
      engineVersion: _engineVersion,
      reactionDeliveryModel: _reactionDeliveryModel,
      electroChargedPropagationModel:
        _electroChargedPropagationModel,
      ...migratedPayload
    } = migrated;
    const {
      schemaVersion: _oldSchemaVersion,
      engineVersion: _oldEngineVersion,
      ...historicalPayload
    } = historical;
    expect(migratedPayload).toEqual(historicalPayload);
    expect(migrated.reactionDeliveryModel).toEqual({
      mode: "deferred-event-heap-v1"
    });
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);

    for (const wire of [
      historical,
      {
        ...asPre139Wire(current),
        schemaVersion: TARGET_TASK_PHASE_SCHEMA_VERSION,
        engineVersion: TARGET_TASK_PHASE_ENGINE_VERSION,
        targetTaskModel: { mode: "target-phase-v1" as const }
      },
      legacyConfig
    ]) {
      expect(() =>
        migrateConfig({
          ...wire,
          reactionDeliveryModel: {
            mode: "deferred-event-heap-v1"
          }
        })
      ).toThrow(/does not support reaction delivery selection/);
    }
    expect(() =>
      migrateConfig({
        ...historical,
        engineVersion: "1.38.0-forged"
      })
    ).toThrow(
      /schemaVersion "1\.38\.0" requires "1\.38\.0-target-reactable-phase"/
    );
  });

  it("migrates exact 1.39 wires without changing delivery, target-task, or aura-v7 semantics", () => {
    const current = makeLegalAuraV7Config();
    for (const deliveryMode of [
      "deferred-event-heap-v1",
      "shatter-recursive-zero-delay-v1"
    ] as const) {
      const historical = {
        ...asPre139Wire(current),
        schemaVersion:
          SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
        engineVersion:
          SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION,
        targetTaskModel: { mode: "target-phase-v2" as const },
        reactionDeliveryModel: { mode: deliveryMode }
      };
      const migrated = migrateConfig(historical);
      expect(migrated.schemaVersion).toBe(
        CURRENT_SCHEMA_VERSION
      );
      expect(migrated.engineVersion).toBe(
        CURRENT_ENGINE_VERSION
      );
      expect(migrated.reactionEngine?.mode).toBe("aura-v7");
      expect(migrated.targetTaskModel).toEqual({
        mode: "target-phase-v2"
      });
      expect(migrated.reactionDeliveryModel).toEqual({
        mode: deliveryMode
      });
    }
  });

  it("fails closed on missing, forged, or extended 1.39 delivery wires and pre-1.39 smuggling", () => {
    const historical = {
      ...asPre139Wire(makeLegalAuraV7Config()),
      schemaVersion:
        SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
      engineVersion:
        SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION,
      targetTaskModel: { mode: "target-phase-v2" as const },
      reactionDeliveryModel: {
        mode: "deferred-event-heap-v1" as const
      }
    };
    const missing = {
      ...historical
    } as Record<string, unknown>;
    delete missing.reactionDeliveryModel;
    expect(() => migrateConfig(missing)).toThrow(
      /1\.39\.0.*requires an explicit.*reaction|reactionDeliveryModel/
    );
    expect(() =>
      migrateConfig({
        ...historical,
        engineVersion: "1.39.0-forged"
      })
    ).toThrow(/schemaVersion "1\.39\.0" requires/);
    expect(() =>
      migrateConfig({
        ...historical,
        reactionDeliveryModel: {
          mode: "deferred-event-heap-v1",
          futureField: true
        }
      })
    ).toThrow(/reactionDeliveryModel.*Unrecognized key/s);
    expect(() =>
      migrateConfig({
        ...historical,
        reactionEngine: { mode: "aura-v8" }
      })
    ).toThrow(/schemaVersion "1\.39\.0" does not support "aura-v8"/);
    expect(() =>
      migrateConfig({
        ...historical,
        schemaVersion: TARGET_REACTABLE_PHASE_SCHEMA_VERSION,
        engineVersion: TARGET_REACTABLE_PHASE_ENGINE_VERSION
      })
    ).toThrow(/does not support reaction delivery selection/);
  });

  it("rejects inherited config identities and inherited current or 1.39 model discriminators", () => {
    const current = makeLegalAuraV7Config();
    const {
      schemaVersion,
      engineVersion,
      reactionDeliveryModel,
      reactionEngine,
      targetTaskModel,
      ...payload
    } = current;

    expect(() =>
      migrateConfig(
        Object.assign(
          Object.create({ schemaVersion }),
          {
            ...payload,
            engineVersion,
            reactionDeliveryModel,
            reactionEngine,
            targetTaskModel
          }
        )
      )
    ).toThrow(/plain JSON objects.*explicit own wire properties/);
    expect(() =>
      migrateConfig(
        Object.assign(
          Object.create({ engineVersion }),
          {
            ...payload,
            schemaVersion,
            reactionDeliveryModel,
            reactionEngine,
            targetTaskModel
          }
        )
      )
    ).toThrow(/plain JSON objects.*explicit own wire properties/);
    expect(() =>
      migrateConfig(
        Object.assign(
          Object.create({ reactionDeliveryModel }),
          {
            ...payload,
            schemaVersion,
            engineVersion,
            reactionEngine,
            targetTaskModel
          }
        )
      )
    ).toThrow(/plain JSON objects.*explicit own wire properties/);

    const inheritedMode = Object.create({
      mode: "deferred-event-heap-v1"
    });
    expect(() =>
      reactionDeliveryModelSchema.parse(inheritedMode)
    ).toThrow(/explicit own property/);
    expect(() =>
      migrateConfig({
        ...current,
        reactionDeliveryModel: inheritedMode
      })
    ).toThrow(/reactionDeliveryModel: config must contain only plain JSON objects/);
    expect(() =>
      migrateConfig({
        ...current,
        targetTaskModel: Object.create({
          mode: "target-phase-v2"
        })
      })
    ).toThrow(/targetTaskModel: config must contain only plain JSON objects/);
    expect(() =>
      migrateConfig({
        ...current,
        reactionEngine: Object.create({
          mode: "aura-v7"
        })
      })
    ).toThrow(/reactionEngine: config must contain only plain JSON objects/);

    const historical139 = {
      ...asPre139Wire(current),
      schemaVersion:
        SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
      engineVersion:
        SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION,
      reactionDeliveryModel: inheritedMode
    };
    expect(() => migrateConfig(historical139)).toThrow(
      /reactionDeliveryModel: config must contain only plain JSON objects/
    );
    const {
      reactionDeliveryModel: _delivery,
      ...historicalPayload
    } = historical139;
    expect(() =>
      migrateConfig(
        Object.assign(
          Object.create({
            reactionDeliveryModel: {
              mode: "deferred-event-heap-v1"
            }
          }),
          historicalPayload
        )
      )
    ).toThrow(/plain JSON objects.*explicit own wire properties/);
  });

  it("gates aura-v8 to the 1.40 legal target-phase-v2 boundary while preserving current aura-v7", () => {
    const legalV7 = {
      ...makeLegalAuraV7Config(),
      targetTaskModel: { mode: "target-phase-v2" as const }
    };
    expect(migrateConfig(legalV7).reactionEngine?.mode).toBe(
      "aura-v7"
    );

    const legalV8 = {
      ...legalV7,
      reactionEngine: { mode: "aura-v8" as const }
    };
    for (const targetClockModel of [
      { mode: "disabled" as const },
      { mode: "target-local-hitlag-v1" as const }
    ]) {
      const migrated = migrateConfig({
        ...legalV8,
        targetClockModel,
        reactionDeliveryModel: {
          mode: "shatter-recursive-zero-delay-v1"
        }
      });
      expect(migrated.reactionEngine?.mode).toBe("aura-v8");
      expect(migrated.targetClockModel).toEqual(targetClockModel);
      expect(migrated.reactionDeliveryModel).toEqual({
        mode: "shatter-recursive-zero-delay-v1"
      });
    }

    expect(() =>
      migrateConfig({
        ...legalV8,
        targetTaskModel: { mode: "target-phase-v1" }
      })
    ).toThrow(/aura-v8 requires targetTaskModel\.mode target-phase-v2/);
    expect(() =>
      migrateConfig({
        ...withoutOwn(legalV8, "timeline")
      })
    ).toThrow(/aura-v8 requires timeline\.mode legal-frame-v1 at 60 FPS/);
  });

  it("validates reaction-delivery references under exact 1.39 and 1.40 identities", () => {
    const historical = makeRecursiveReferenceResult();
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(historical)
    ).not.toThrow();

    const current: any = structuredClone(historical);
    current.schemaVersion = EC_NEXT_TARGET_TICK_SCHEMA_VERSION;
    current.engineVersion = EC_NEXT_TARGET_TICK_ENGINE_VERSION;
    current.config.schemaVersion =
      EC_NEXT_TARGET_TICK_SCHEMA_VERSION;
    current.config.engineVersion =
      EC_NEXT_TARGET_TICK_ENGINE_VERSION;
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(current)
    ).not.toThrow();
    current.config.reactionEngine = { mode: "aura-v8" };
    current.config.targetTaskModel = {
      mode: "target-phase-v2"
    };
    current.config.timeline = {
      mode: "legal-frame-v1",
      fps: 60
    };
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(current)
    ).not.toThrow();

    const forgedHistoricalAuraV8: any =
      structuredClone(historical);
    forgedHistoricalAuraV8.config.reactionEngine = {
      mode: "aura-v8"
    };
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(
        forgedHistoricalAuraV8
      )
    ).toThrow(/aura-v8.*exact 1\.40/);
  });

  it("allows only an exact recursive Shatter forward-parent backlink and rejects cycles", () => {
    const recursive = makeRecursiveReferenceResult();
    expect(
      reactionDeliveryResultReferencesSchema.parse(recursive)
    ).toEqual(recursive);

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        config: {
          ...recursive.config,
          reactionDeliveryModel: {
            mode: "deferred-event-heap-v1"
          }
        }
      })
    ).toThrow(/forbids forward parent damage references/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        engineVersion: TARGET_REACTABLE_PHASE_ENGINE_VERSION,
        config: {
          ...recursive.config,
          engineVersion: TARGET_REACTABLE_PHASE_ENGINE_VERSION
        }
      })
    ).toThrow(/requires an exact supported 1\.39 through 1\.42 or 1\.44 schema and engine identity/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        damageEvents: [
          {
            ...recursive.damageEvents[0],
            element: "geo"
          },
          recursive.damageEvents[1]
        ]
      })
    ).toThrow(/physical transformative Shatter child/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        reactionDamageLog: []
      })
    ).toThrow(/exactly one matching reaction-damage log backlink/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        reactionDamageLog: [
          recursive.reactionDamageLog[0],
          {
            ...recursive.reactionDamageLog[0],
            id: 1
          }
        ]
      })
    ).toThrow(/exactly one matching reaction-damage log backlink/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        damageEvents: [
          recursive.damageEvents[0],
          {
            ...recursive.damageEvents[1],
            parentDamageEventId: 0
          }
        ]
      })
    ).toThrow(/must be acyclic/);
  });

  it("accepts delayed deferred AoE ownership, nested Overload to Shatter, and valid empty recursive states", () => {
    const deferred = makeDeferredReferenceResult();
    expect(
      reactionDeliveryResultReferencesSchema.parse(deferred)
    ).toEqual(deferred);
    const deferredShatter =
      makeDeferredShatterReferenceResult();
    expect(
      reactionDeliveryResultReferencesSchema.parse(
        deferredShatter
      )
    ).toEqual(deferredShatter);

    const nested = makeNestedRecursiveReferenceResult();
    expect(
      reactionDeliveryResultReferencesSchema.parse(nested)
    ).toEqual(nested);

    const recursive = makeRecursiveReferenceResult();
    const emptyBlocked = {
      ...recursive,
      damageEvents: [
        {
          ...recursive.damageEvents[1],
          id: 0,
          reactionAudit:
            makeTriggeredShatterReactionAudit(false)
        }
      ],
      reactionDamageLog: [
        {
          ...recursive.reactionDamageLog[0],
          triggerDamageEventId: 0,
          scheduled: false,
          withinSimulation: false,
          blockedReason: "REACTION_DAMAGE_GCD" as const,
          checkedTargetIds: [],
          hitTargetIds: [],
          damageEventIds: []
        }
      ]
    };
    expect(
      reactionDeliveryResultReferencesSchema.parse(emptyBlocked)
    ).toEqual(emptyBlocked);

    const impossibleOutOfDuration = {
      ...emptyBlocked,
      damageEvents: [
        {
          ...emptyBlocked.damageEvents[0],
          reactionAudit:
            makeTriggeredShatterReactionAudit(true)
        }
      ],
      reactionDamageLog: [
        {
          ...emptyBlocked.reactionDamageLog[0],
          scheduled: true,
          blockedReason: null
        }
      ]
    };
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(
        impossibleOutOfDuration
      )
    ).toThrow(/requires a settled scheduled state/);
  });

  it("requires an exact supported delivery identity for deferred results too", () => {
    const deferred = makeDeferredReferenceResult();
    for (const [schemaVersion, engineVersion] of [
      [
        TARGET_REACTABLE_PHASE_SCHEMA_VERSION,
        TARGET_REACTABLE_PHASE_ENGINE_VERSION
      ],
      ["1.37.0", "1.37.0-target-task-phase"],
      ["9.99.0", "evil-engine"]
    ]) {
      expect(() =>
        reactionDeliveryResultReferencesSchema.parse({
          ...deferred,
          schemaVersion,
          engineVersion,
          config: {
            ...deferred.config,
            schemaVersion,
            engineVersion
          }
        })
      ).toThrow(/requires an exact supported 1\.39 through 1\.42 or 1\.44 schema and engine identity/);
    }
  });

  it("rejects missing, duplicate, direct, and multiply-owned damage references", () => {
    const recursive = makeRecursiveReferenceResult();
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        reactionDamageLog: [
          {
            ...recursive.reactionDamageLog[0],
            checkedTargetIds: ["enemy-0", "enemy-1"],
            hitTargetIds: ["enemy-0", "enemy-1"],
            damageEventIds: [0, 99]
          }
        ]
      })
    ).toThrow(/missing produced damage event 99/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        reactionDamageLog: [
          {
            ...recursive.reactionDamageLog[0],
            hitTargetIds: ["enemy-0", "enemy-0"],
            damageEventIds: [0, 0]
          }
        ]
      })
    ).toThrow(/duplicate produced damage event 0/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        reactionDamageLog: [
          {
            ...recursive.reactionDamageLog[0],
            damageEventIds: [1]
          }
        ]
      })
    ).toThrow(/produced damage event does not match/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        reactionDamageLog: [
          recursive.reactionDamageLog[0],
          {
            ...recursive.reactionDamageLog[0],
            id: 1
          }
        ]
      })
    ).toThrow(/requires exactly one owning reaction-damage log/);
  });

  it("requires direct damage to remain parentless and reaction target fanout to stay unique", () => {
    const deferred = makeDeferredReferenceResult();
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        damageEvents: [
          deferred.damageEvents[0],
          {
            ...deferred.damageEvents[0],
            id: 1,
            parentDamageEventId: 0,
            eventPriority: 99,
            eventSequence: 99,
            sourceActorId: "other",
            targetId: "enemy-9",
            frame: 99
          }
        ],
        reactionDamageLog: []
      })
    ).toThrow(/direct damage events must have a null parent/);

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        damageEvents: [
          deferred.damageEvents[0],
          deferred.damageEvents[1],
          {
            ...deferred.damageEvents[1],
            id: 2
          }
        ],
        reactionDamageLog: [
          {
            ...deferred.reactionDamageLog[0],
            hitTargetIds: ["enemy-1", "enemy-1"],
            damageEventIds: [1, 2]
          }
        ]
      })
    ).toThrow(/duplicate reaction-damage target/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        reactionDamageLog: [
          {
            ...deferred.reactionDamageLog[0],
            checkedTargetIds: [
              "enemy-0",
              "enemy-1",
              "enemy-1"
            ]
          }
        ]
      })
    ).toThrow(/duplicate reaction-damage target/);
  });

  it("rejects wrong child/log provenance and orphan transformative damage", () => {
    const recursive = makeRecursiveReferenceResult();
    for (const damageEvent of [
      {
        ...recursive.damageEvents[0],
        parentDamageEventId: null
      },
      {
        ...recursive.damageEvents[0],
        sourceActorId: "other"
      },
      {
        ...recursive.damageEvents[0],
        targetId: "enemy-1"
      },
      {
        ...recursive.damageEvents[0],
        frame: 13
      },
      {
        ...recursive.damageEvents[0],
        reaction: "overload" as const
      }
    ]) {
      expect(() =>
        reactionDeliveryResultReferencesSchema.parse({
          ...recursive,
          damageEvents: [
            damageEvent,
            recursive.damageEvents[1]
          ]
        })
      ).toThrow(/does not match|recursive Shatter|forward parent/);
    }

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        reactionDamageLog: [
          {
            ...recursive.reactionDamageLog[0],
            triggerFrame: 11
          }
        ]
      })
    ).toThrow(/exact zero-delay|backlink/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        damageEvents: [
          ...recursive.damageEvents,
          {
            id: 2,
            kind: "transformative-reaction" as const,
            parentDamageEventId: 1,
            eventPriority: 4,
            eventSequence: 8,
            sourceActorId: "a",
            targetId: "enemy-0",
            frame: 13,
            element: "pyro" as const,
            reaction: "overload" as const,
            reactionAudit: noShatterReactionAudit
          }
        ]
      })
    ).toThrow(/requires exactly one owning reaction-damage log/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        damageEvents: [
          {
            ...recursive.damageEvents[0],
            reaction: "none" as const
          },
          recursive.damageEvents[1]
        ],
        reactionDamageLog: [
          {
            ...recursive.reactionDamageLog[0],
            reaction: "none" as const
          }
        ]
      })
    ).toThrow(/reactionDamageLog/);
  });

  it("binds non-core trigger provenance while preserving the Dendro-core ownership exception", () => {
    const deferred = makeDeferredReferenceResult();
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        damageEvents: [
          deferred.damageEvents[0],
          {
            ...deferred.damageEvents[1],
            sourceActorId: "forged"
          }
        ],
        reactionDamageLog: [
          {
            ...deferred.reactionDamageLog[0],
            sourceActorId: "forged"
          }
        ]
      })
    ).toThrow(/non-core trigger damage event does not match/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        damageEvents: [
          {
            ...deferred.damageEvents[0]!,
            reactionAudit: {
              ...deferred.damageEvents[0]!.reactionAudit,
              reactions: []
            }
          },
          deferred.damageEvents[1]
        ]
      })
    ).toThrow(/requires its trigger audit to include/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        reactionDamageLog: [
          {
            ...deferred.reactionDamageLog[0],
            sourceTargetId: "forged-target"
          }
        ]
      })
    ).toThrow(/non-core trigger damage event does not match/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        reactionDamageLog: [
          {
            ...deferred.reactionDamageLog[0],
            triggerFrame: 999
          }
        ]
      })
    ).toThrow(/non-core trigger damage event does not match/);

    const coreOwned = {
      ...deferred,
      damageEvents: [
        {
          ...deferred.damageEvents[0],
          reactionAudit: noShatterReactionAudit
        },
        {
          ...deferred.damageEvents[1],
          sourceActorId: "core-owner",
          element: "dendro" as const,
          reaction: "burgeon" as const
        }
      ],
      reactionDamageLog: [
        {
          ...deferred.reactionDamageLog[0],
          reaction: "burgeon" as const,
          sourceActorId: "core-owner",
          sourceTargetId: "enemy-0",
          triggerFrame: 13,
          scheduleKind: "dendro-core-burgeon" as const,
          damageGroupDecisions: [
            makeDamageGroupDecision(
              "burgeon",
              "enemy-1",
              13,
              0,
              "core-owner"
            )
          ]
        }
      ]
    };
    expect(
      reactionDeliveryResultReferencesSchema.parse(coreOwned)
    ).toEqual(coreOwned);
  });

  it("binds Burning ticks to Burning audit provenance and settled single-target delivery", () => {
    const deferred = makeDeferredReferenceResult();
    const burning = {
      ...deferred,
      damageEvents: [
        {
          ...deferred.damageEvents[0]!,
          reaction: "burning" as const,
          reactionAudit: {
            ...deferred.damageEvents[0]!.reactionAudit,
            reactions: [] as const,
            transformativeReaction: null,
            burningReaction: {
              reaction: "burning" as const,
              operation: "start" as const
            }
          }
        },
        {
          ...deferred.damageEvents[1]!,
          reaction: "burning" as const
        }
      ],
      reactionDamageLog: [
        {
          ...deferred.reactionDamageLog[0],
          reaction: "burning" as const,
          scheduleKind: "burning-tick" as const,
          damageGroupBlockedTargetIds: [],
          damageGroupDecisions: []
        }
      ]
    };
    expect(
      reactionDeliveryResultReferencesSchema.parse(burning)
    ).toEqual(burning);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...burning,
        damageEvents: [
          {
            ...burning.damageEvents[0]!,
            reactionAudit: {
              ...burning.damageEvents[0]!.reactionAudit,
              burningReaction: null
            }
          },
          burning.damageEvents[1]!
        ]
      })
    ).toThrow(/active start or refresh burningReaction trigger audit/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...burning,
        damageEvents: [
          {
            ...burning.damageEvents[0]!,
            reactionAudit: {
              ...burning.damageEvents[0]!.reactionAudit,
              burningReaction: {
                reaction: "burning",
                operation: "stop"
              }
            }
          },
          burning.damageEvents[1]!
        ]
      })
    ).toThrow(/active start or refresh burningReaction trigger audit/);

    const electroCharged = {
      ...deferred,
      damageEvents: [
        {
          ...deferred.damageEvents[0]!,
          reaction: "electroCharged" as const,
          reactionAudit: {
            ...deferred.damageEvents[0]!.reactionAudit,
            reactions: ["electroCharged" as const],
            transformativeReaction: null
          }
        },
        {
          ...deferred.damageEvents[1]!,
          targetId: "enemy-0",
          element: "electro" as const,
          reaction: "electroCharged" as const
        }
      ],
      reactionDamageLog: [
        {
          ...deferred.reactionDamageLog[0],
          reaction: "electroCharged" as const,
          scheduleKind: "periodic-tick" as const,
          targetingMode: "single-target" as const,
          checkedTargetIds: ["enemy-0"],
          hitTargetIds: ["enemy-0"],
          damageGroupDecisions: [
            makeDamageGroupDecision(
              "electroCharged",
              "enemy-0",
              13
            )
          ]
        }
      ]
    };
    expect(
      reactionDeliveryResultReferencesSchema.parse(
        electroCharged
      )
    ).toEqual(electroCharged);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...electroCharged,
        damageEvents: [electroCharged.damageEvents[0]],
        reactionDamageLog: [
          {
            ...electroCharged.reactionDamageLog[0],
            checkedTargetIds: [],
            hitTargetIds: [],
            damageEventIds: []
          }
        ]
      })
    ).toThrow(/settled single-target reaction damage/);
  });

  it("requires a bidirectional parent shatterReaction audit for every Shatter log", () => {
    const recursive = makeRecursiveReferenceResult();
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        damageEvents: [
          recursive.damageEvents[0],
          {
            ...recursive.damageEvents[1],
            reactionAudit: noShatterReactionAudit
          }
        ]
      })
    ).toThrow(/does not match its triggering parent/);

    for (const shatterReaction of [
      {
        ...makeTriggeredShatterReactionAudit(true)
          .shatterReaction,
        scheduled: false,
        blockedReason: "REACTION_DAMAGE_GCD" as const
      },
      {
        ...makeTriggeredShatterReactionAudit(true)
          .shatterReaction,
        damageFrame: 13
      },
      {
        ...makeTriggeredShatterReactionAudit(true)
          .shatterReaction,
        blockedReason: "TARGET_MECHANICS_TRUNCATION" as const
      },
      {
        ...makeTriggeredShatterReactionAudit(true)
          .shatterReaction,
        nextAvailableFrame: 43
      }
    ]) {
      expect(() =>
        reactionDeliveryResultReferencesSchema.parse({
          ...recursive,
          damageEvents: [
            recursive.damageEvents[0],
            {
              ...recursive.damageEvents[1],
              reactionAudit: {
                ...recursive.damageEvents[1]!.reactionAudit,
                shatterReaction
              }
            }
          ]
        })
      ).toThrow(/does not match its triggering parent/);
    }

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        damageEvents: [
          {
            ...recursive.damageEvents[1],
            id: 0
          }
        ],
        reactionDamageLog: []
      })
    ).toThrow(/requires exactly one Shatter log/);

    const falseAudit = {
      ...makeTriggeredShatterReactionAudit(false).shatterReaction,
      triggered: false
    };
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        damageEvents: [
          {
            ...recursive.damageEvents[1],
            id: 0,
            reactionAudit: {
              ...recursive.damageEvents[1]!.reactionAudit,
              shatterReaction: falseAudit
            }
          }
        ],
        reactionDamageLog: [
          {
            ...recursive.reactionDamageLog[0],
            triggerDamageEventId: 0,
            scheduled: false,
            withinSimulation: false,
            blockedReason: "REACTION_DAMAGE_GCD",
            checkedTargetIds: [],
            hitTargetIds: [],
            damageEventIds: []
          }
        ]
      })
    ).toThrow(/does not match its triggering parent/);
  });

  it("applies Shatter trigger uniqueness and audit reciprocity in deferred mode", () => {
    const deferred = makeDeferredShatterReferenceResult();
    const blockedByTruncation = {
      ...deferred,
      damageEvents: [
        {
          ...deferred.damageEvents[0],
          reactionAudit: {
            reactions: [],
            mechanicsTruncation: {
              operation: "trigger"
            },
            transformativeReaction: null,
            burningReaction: null,
            shatterReaction: {
              ...makeTriggeredShatterReactionAudit(false)
                .shatterReaction,
              blockedReason:
                "TARGET_MECHANICS_TRUNCATION" as const
            },
            swirlReactions: []
          }
        }
      ],
      reactionDamageLog: []
    };
    expect(
      reactionDeliveryResultReferencesSchema.parse(
        blockedByTruncation
      )
    ).toEqual(blockedByTruncation);

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        damageEvents: [
          deferred.damageEvents[0],
          deferred.damageEvents[1],
          {
            ...deferred.damageEvents[1],
            id: 2
          }
        ],
        reactionDamageLog: [
          deferred.reactionDamageLog[0],
          {
            ...deferred.reactionDamageLog[0],
            id: 1,
            damageEventIds: [2]
          }
        ]
      })
    ).toThrow(/at most one Shatter log/);
  });

  it("accepts both legal untriggered Shatter terminal states", () => {
    for (const result of [
      makeUntriggeredShatterReferenceResult(
        "NO_FROZEN_AURA"
      ),
      makeUntriggeredShatterReferenceResult(
        "FROZEN_DEPLETED_BY_POISE"
      )
    ]) {
      expect(
        reactionDeliveryResultReferencesSchema.parse(result)
      ).toEqual(result);
    }
  });

  it.each([
    [
      "scheduled",
      { scheduled: true },
      /untriggered shatterReaction cannot be scheduled/
    ],
    [
      "null blockedReason",
      { blockedReason: null },
      /untriggered shatterReaction requires/
    ],
    [
      "damage-GCD blockedReason",
      { blockedReason: "REACTION_DAMAGE_GCD" as const },
      /untriggered shatterReaction requires/
    ],
    [
      "mechanics-truncation blockedReason",
      {
        blockedReason:
          "TARGET_MECHANICS_TRUNCATION" as const
      },
      /untriggered shatterReaction requires/
    ],
    [
      "nextAvailableFrame",
      { nextAvailableFrame: 42 },
      /cannot retain a damage-GCD ready frame/
    ],
    [
      "damageFrame",
      { damageFrame: 13 },
      /damageFrame must equal its owning/
    ]
  ])(
    "rejects an untriggered Shatter single-field mutation: %s",
    (_label, patch, expectedError) => {
      const result =
        makeUntriggeredShatterReferenceResult();
      const event = result.damageEvents[0]!;
      expect(() =>
        reactionDeliveryResultReferencesSchema.parse({
          ...result,
          damageEvents: [
            {
              ...event,
              reactionAudit: {
                ...event.reactionAudit,
                shatterReaction: {
                  ...event.reactionAudit.shatterReaction!,
                  ...patch
                }
              }
            }
          ]
        })
      ).toThrow(expectedError);
    }
  );

  it("accepts a legal Shatter damage-GCD terminal state", () => {
    const result =
      makeGcdBlockedShatterReferenceResult();
    expect(
      reactionDeliveryResultReferencesSchema.parse(result)
    ).toEqual(result);
  });

  it.each([
    [
      "triggered",
      { triggered: false },
      /untriggered shatterReaction requires/
    ],
    [
      "scheduled",
      { scheduled: true },
      /scheduled shatterReaction requires a null blockedReason/
    ],
    [
      "null blockedReason",
      { blockedReason: null },
      /unscheduled recursive shatterReaction requires/
    ],
    [
      "no-aura blockedReason",
      { blockedReason: "NO_FROZEN_AURA" as const },
      /unscheduled recursive shatterReaction requires/
    ],
    [
      "mechanics-truncation blockedReason",
      {
        blockedReason:
          "TARGET_MECHANICS_TRUNCATION" as const
      },
      /unscheduled recursive shatterReaction requires/
    ],
    [
      "null nextAvailableFrame",
      { nextAvailableFrame: null },
      /nextAvailableFrame greater than damageFrame/
    ],
    [
      "non-future nextAvailableFrame",
      { nextAvailableFrame: 12 },
      /nextAvailableFrame greater than damageFrame/
    ],
    [
      "damageFrame",
      { damageFrame: 13 },
      /damageFrame must equal its owning/
    ]
  ])(
    "rejects a GCD-blocked Shatter single-field mutation: %s",
    (_label, patch, expectedError) => {
      const result =
        makeGcdBlockedShatterReferenceResult();
      const event = result.damageEvents[0]!;
      expect(() =>
        reactionDeliveryResultReferencesSchema.parse({
          ...result,
          damageEvents: [
            {
              ...event,
              reactionAudit: {
                ...event.reactionAudit,
                shatterReaction: {
                  ...event.reactionAudit.shatterReaction!,
                  ...patch
                }
              }
            }
          ]
        })
      ).toThrow(expectedError);
    }
  );

  it.each([
    [
      "triggered",
      { triggered: false },
      /untriggered shatterReaction cannot be scheduled/
    ],
    [
      "scheduled",
      { scheduled: false },
      /unscheduled recursive shatterReaction requires/
    ],
    [
      "blockedReason",
      { blockedReason: "REACTION_DAMAGE_GCD" as const },
      /scheduled shatterReaction requires a null blockedReason/
    ],
    [
      "null nextAvailableFrame",
      { nextAvailableFrame: null },
      /nextAvailableFrame greater than damageFrame/
    ],
    [
      "non-future nextAvailableFrame",
      { nextAvailableFrame: 12 },
      /nextAvailableFrame greater than damageFrame/
    ]
  ])(
    "rejects a scheduled Shatter single-field mutation: %s",
    (_label, patch, expectedError) => {
      const result = makeRecursiveReferenceResult();
      const parent = result.damageEvents[1]!;
      expect(() =>
        reactionDeliveryResultReferencesSchema.parse({
          ...result,
          damageEvents: [
            result.damageEvents[0],
            {
              ...parent,
              reactionAudit: {
                ...parent.reactionAudit,
                shatterReaction: {
                  ...parent.reactionAudit.shatterReaction!,
                  ...patch
                }
              }
            }
          ]
        })
      ).toThrow(expectedError);
    }
  );

  it("requires a blunt strike or Geo parent for triggered Shatter", () => {
    const recursive = makeRecursiveReferenceResult();
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        damageEvents: [
          recursive.damageEvents[0],
          {
            ...recursive.damageEvents[1],
            element: "pyro"
          }
        ]
      })
    ).toThrow(/requires a blunt strike or Geo parent/);

    const bluntPyro = {
      ...recursive,
      damageEvents: [
        recursive.damageEvents[0],
        {
          ...recursive.damageEvents[1],
          element: "pyro" as const,
          reactionAudit: {
            ...recursive.damageEvents[1]!.reactionAudit,
            shatterReaction: {
              ...recursive.damageEvents[1]!.reactionAudit
                .shatterReaction!,
              strikeType: "blunt" as const
            }
          }
        }
      ]
    };
    expect(
      reactionDeliveryResultReferencesSchema.parse(bluntPyro)
    ).toEqual(bluntPyro);
  });

  it.each([
    [
      "damage element",
      { damageElement: "pyro" as const },
      /physical/
    ],
    [
      "base multiplier",
      { baseMultiplier: 2.9 },
      /baseMultiplier must equal 3/
    ],
    [
      "Shatter consumption",
      { shatterConsumedGaugeUnits: 0 },
      /positive Shatter consumption/
    ],
    [
      "Frozen gauge after poise",
      { frozenGaugeAfterPoise: 0 },
      /positive Shatter consumption/
    ],
    [
      "Frozen gauge after",
      { frozenGaugeAfter: 1 },
      /positive Shatter consumption/
    ]
  ])(
    "rejects a triggered Shatter legality mutation: %s",
    (_label, patch, expectedError) => {
      const recursive = makeRecursiveReferenceResult();
      const parent = recursive.damageEvents[1]!;
      expect(() =>
        reactionDeliveryResultReferencesSchema.parse({
          ...recursive,
          damageEvents: [
            recursive.damageEvents[0],
            {
              ...parent,
              reactionAudit: {
                ...parent.reactionAudit,
                shatterReaction: {
                  ...parent.reactionAudit.shatterReaction!,
                  ...patch
                }
              }
            }
          ]
        })
      ).toThrow(expectedError);
    }
  );

  it("rejects coordinated Shatter gauge mutations that break both conservation equations", () => {
    const recursive = makeRecursiveReferenceResult();
    const parent = recursive.damageEvents[1]!;
    const parsed =
      reactionDeliveryResultReferencesSchema.safeParse({
        ...recursive,
        damageEvents: [
          recursive.damageEvents[0],
          {
            ...parent,
            reactionAudit: {
              ...parent.reactionAudit,
              shatterReaction: {
                ...parent.reactionAudit.shatterReaction!,
                strikeType: "blunt",
                frozenGaugeBefore: 10,
                poiseConsumedGaugeUnits: 7,
                frozenGaugeAfterPoise: 1,
                shatterConsumedGaugeUnits: 0.2,
                frozenGaugeAfter: 0.7
              }
            }
          }
        ]
      });
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error(
        "coordinated Shatter gauge mutation must be rejected"
      );
    }
    expect(parsed.error.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /frozenGaugeAfterPoise must equal frozenGaugeBefore - poiseConsumedGaugeUnits/
        ),
        expect.stringMatching(
          /frozenGaugeAfter must equal frozenGaugeAfterPoise - shatterConsumedGaugeUnits/
        )
      ])
    );
  });

  it("rejects Shatter consumption beyond each preceding Frozen gauge state", () => {
    const poiseDepleted =
      makeUntriggeredShatterReferenceResult(
        "FROZEN_DEPLETED_BY_POISE"
      );
    const poiseParent = poiseDepleted.damageEvents[0]!;
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...poiseDepleted,
        damageEvents: [
          {
            ...poiseParent,
            reactionAudit: {
              ...poiseParent.reactionAudit,
              shatterReaction: {
                ...poiseParent.reactionAudit.shatterReaction!,
                poiseConsumedGaugeUnits: 1.1
              }
            }
          }
        ]
      })
    ).toThrow(/poiseConsumedGaugeUnits cannot exceed/);

    const recursive = makeRecursiveReferenceResult();
    const shatterParent = recursive.damageEvents[1]!;
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        damageEvents: [
          recursive.damageEvents[0],
          {
            ...shatterParent,
            reactionAudit: {
              ...shatterParent.reactionAudit,
              shatterReaction: {
                ...shatterParent.reactionAudit.shatterReaction!,
                shatterConsumedGaugeUnits: 1.1
              }
            }
          }
        ]
      })
    ).toThrow(/shatterConsumedGaugeUnits cannot exceed/);
  });

  it("forbids non-blunt Shatter parents from consuming Frozen through poise", () => {
    const recursive = makeRecursiveReferenceResult();
    const parent = recursive.damageEvents[1]!;
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        damageEvents: [
          recursive.damageEvents[0],
          {
            ...parent,
            reactionAudit: {
              ...parent.reactionAudit,
              shatterReaction: {
                ...parent.reactionAudit.shatterReaction!,
                poiseConsumedGaugeUnits: 0.25,
                frozenGaugeAfterPoise: 0.75,
                shatterConsumedGaugeUnits: 0.75
              }
            }
          }
        ]
      })
    ).toThrow(/non-blunt Shatter parent cannot consume/);
  });

  it("accepts the zero residual Shatter boundary within gauge cleanup tolerance", () => {
    const recursive = makeRecursiveReferenceResult();
    const parent = recursive.damageEvents[1]!;
    const legalBoundary = {
      ...recursive,
      damageEvents: [
        recursive.damageEvents[0],
        {
          ...parent,
          reactionAudit: {
            ...parent.reactionAudit,
            shatterReaction: {
              ...parent.reactionAudit.shatterReaction!,
              frozenGaugeBefore: 1.0000000004,
              poiseConsumedGaugeUnits: 0,
              frozenGaugeAfterPoise: 1.0000000003,
              shatterConsumedGaugeUnits: 1.0000000002,
              frozenGaugeAfter: 0
            }
          }
        }
      ]
    };
    expect(
      reactionDeliveryResultReferencesSchema.parse(
        legalBoundary
      )
    ).toEqual(legalBoundary);
  });

  it("binds the fixed Shatter multiplier to its child factors", () => {
    const recursive = makeRecursiveReferenceResult();
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        damageEvents: [
          {
            ...recursive.damageEvents[0],
            transformativeReactionFactors: {
              baseMultiplier: 2.9
            }
          },
          recursive.damageEvents[1]
        ]
      })
    ).toThrow(/child transformative baseMultiplier/);
  });

  it("closes the Shatter ReactionA decision and child damage state", () => {
    const recursive = makeRecursiveReferenceResult();
    const allowedImmune = {
      ...recursive,
      damageEvents: [
        {
          ...recursive.damageEvents[0],
          finalDamage: 0
        },
        recursive.damageEvents[1]
      ]
    };
    expect(
      reactionDeliveryResultReferencesSchema.parse(
        allowedImmune
      )
    ).toEqual(allowedImmune);
    const childWithFinalDamage =
      recursive.damageEvents[0]!;
    if (!("finalDamage" in childWithFinalDamage)) {
      throw new Error(
        "recursive fixture child must project finalDamage"
      );
    }
    const {
      finalDamage: _finalDamage,
      ...childWithoutFinalDamage
    } = childWithFinalDamage;
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        damageEvents: [
          childWithoutFinalDamage,
          recursive.damageEvents[1]
        ]
      })
    ).toThrow(/requires an explicit finalDamage/);

    const makeShatterAttempt = (
      childId: number,
      frame: number,
      eventSequence: number,
      hitIndex: number
    ) => {
      const decision = makeDamageGroupDecision(
        "shatter",
        "enemy-0",
        0,
        hitIndex
      );
      const child = {
        ...recursive.damageEvents[0],
        id: childId,
        parentDamageEventId: childId + 1,
        frame,
        eventSequence,
        finalDamage: decision.damageAllowed ? 100 : 0,
        damageFactors: {
          groupMultiplier: decision.damageAllowed ? 1 : 0
        }
      };
      const parent = {
        ...recursive.damageEvents[1],
        id: childId + 1,
        frame,
        eventSequence,
        reactionAudit:
          makeTriggeredShatterReactionAudit(true, frame)
      };
      const log = {
        ...recursive.reactionDamageLog[0],
        id: childId / 2,
        triggerDamageEventId: parent.id,
        triggerFrame: frame,
        damageFrame: frame,
        nextAvailableFrame: frame + 12,
        damageEventIds: [child.id],
        damageGroupBlockedTargetIds: decision.damageAllowed
          ? []
          : ["enemy-0"],
        damageGroupDecisions: [decision]
      };
      return { child, parent, log };
    };
    const shatterAttempts = [
      makeShatterAttempt(0, 0, 7, 0),
      makeShatterAttempt(2, 12, 8, 1),
      makeShatterAttempt(4, 24, 9, 2)
    ];
    const blocked = {
      ...recursive,
      damageEvents: shatterAttempts.flatMap(
        ({ child, parent }) => [child, parent]
      ),
      reactionDamageLog: shatterAttempts.map(({ log }) => log)
    };
    expect(
      reactionDeliveryResultReferencesSchema.parse(blocked)
    ).toEqual(blocked);

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        reactionDamageLog: [
          {
            ...recursive.reactionDamageLog[0],
            damageGroupDecisions: [
              {
                ...recursive.reactionDamageLog[0]!
                  .damageGroupDecisions[0]!,
                damageAllowed: false,
                blockedReason:
                  "REACTION_A_DAMAGE_ICD" as const
              }
            ]
          }
        ]
      })
    ).toThrow(/blocked Shatter ReactionA damage requires/);

    for (const mutation of [
      {
        damageEvents: blocked.damageEvents.map((event, index) =>
          index === 4 ? { ...event, finalDamage: 1 } : event
        )
      },
      {
        damageEvents: blocked.damageEvents.map((event, index) =>
          index === 4
            ? {
                ...event,
                damageFactors: {
                  groupMultiplier: 1
                }
              }
            : event
        )
      },
      {
        reactionDamageLog: blocked.reactionDamageLog.map(
          (entry, index) =>
            index === 2
              ? {
                  ...entry,
                  damageGroupBlockedTargetIds: []
                }
              : entry
        )
      },
      {
        reactionDamageLog: blocked.reactionDamageLog.map(
          (entry, index) =>
            index === 2
              ? {
                  ...entry,
                  damageGroupDecisions: [
                    {
                      ...entry.damageGroupDecisions[0]!,
                      blockedReason: null
                    }
                  ]
                }
              : entry
        )
      }
    ]) {
      expect(() =>
        reactionDeliveryResultReferencesSchema.parse({
          ...blocked,
          ...mutation
        })
      ).toThrow(/blocked Shatter ReactionA damage requires/);
    }
  });

  it.each(["overload", "superconduct"] as const)(
    "rejects a second %s one-shot log even when its damage frame changes",
    (reaction) => {
      const deferred = makeDeferredReferenceResult();
      const damageElement =
        reaction === "overload"
          ? ("pyro" as const)
          : ("cryo" as const);
      const trigger = {
        ...deferred.damageEvents[0],
        reaction,
        reactionAudit: {
          ...deferred.damageEvents[0]!.reactionAudit,
          reactions: [reaction],
          transformativeReaction:
            makeOneShotTransformativeAudit(reaction)
        }
      };
      const firstDamage = {
        ...deferred.damageEvents[1],
        element: damageElement,
        reaction
      };
      const firstLog = {
        ...deferred.reactionDamageLog[0],
        reaction
      };
      expect(() =>
        reactionDeliveryResultReferencesSchema.parse({
          ...deferred,
          damageEvents: [
            trigger,
            firstDamage,
            {
              ...firstDamage,
              id: 2,
              frame: 18,
              eventSequence: 9
            }
          ],
          reactionDamageLog: [
            firstLog,
            {
              ...firstLog,
              id: 1,
              damageFrame: 18,
              damageEventIds: [2]
            }
          ]
        })
      ).toThrow(/single-delivery reaction-damage logs/);
    }
  );

  it.each([
    "swirl-self",
    "swirl-propagation"
  ] as const)(
    "rejects a duplicate %s role even when its damage frame changes",
    (duplicateRole) => {
      const deferred = makeDeferredReferenceResult();
      const trigger = {
        ...deferred.damageEvents[0],
        element: "anemo" as const,
        reaction: "swirlPyro" as const,
        reactionAudit: {
          ...deferred.damageEvents[0]!.reactionAudit,
          reactions: ["swirlPyro" as const],
          transformativeReaction: null,
          swirlReactions: [
            {
              reaction: "swirlPyro" as const,
              scheduled: true,
              blockedReason: null,
              nextAvailableFrame: 18,
              selfDamageFrame: 13,
              propagationDamageFrame: 17
            }
          ]
        }
      };
      const selfDamage = {
        ...deferred.damageEvents[1],
        targetId: "enemy-0",
        element: "pyro" as const,
        reaction: "swirlPyro" as const
      };
      const propagationDamage = {
        ...selfDamage,
        id: 2,
        targetId: "enemy-1",
        frame: 17,
        eventSequence: 9
      };
      const selfLog = {
        ...deferred.reactionDamageLog[0],
        reaction: "swirlPyro" as const,
        scheduleKind: "swirl-self" as const,
        targetingMode: "single-target" as const,
        checkedTargetIds: ["enemy-0"],
        hitTargetIds: ["enemy-0"],
        damageEventIds: [1],
        damageGroupBlockedTargetIds: [],
        damageGroupDecisions: [
          makeDamageGroupDecision(
            "swirlPyro",
            "enemy-0",
            13
          )
        ]
      };
      const propagationLog = {
        ...selfLog,
        id: 1,
        scheduleKind: "swirl-propagation" as const,
        targetingMode: "radius" as const,
        damageFrame: 17,
        checkedTargetIds: ["enemy-1"],
        hitTargetIds: ["enemy-1"],
        damageEventIds: [2],
        damageGroupDecisions: [
          makeDamageGroupDecision(
            "swirlPyro",
            "enemy-1",
            17
          )
        ]
      };
      const duplicateDamage =
        duplicateRole === "swirl-self"
          ? {
              ...selfDamage,
              id: 3,
              frame: 18,
              eventSequence: 9
            }
          : {
              ...propagationDamage,
              id: 3,
              frame: 18,
              eventSequence: 9
            };
      const duplicateLog = {
        ...(duplicateRole === "swirl-self"
          ? selfLog
          : propagationLog),
        id: 2,
        damageFrame: 18,
        damageEventIds: [3]
      };
      expect(() =>
        reactionDeliveryResultReferencesSchema.parse({
          ...deferred,
          damageEvents: [
            trigger,
            selfDamage,
            propagationDamage,
            duplicateDamage
          ],
          reactionDamageLog: [
            selfLog,
            propagationLog,
            duplicateLog
          ]
        })
      ).toThrow(/single-delivery reaction-damage logs/);
    }
  );

  it.each([
    ["electroCharged", "periodic-tick", "electro"],
    ["burning", "burning-tick", "pyro"]
  ] as const)(
    "preserves legal multi-tick %s logs from one source trigger",
    (reaction, scheduleKind, damageElement) => {
      const deferred = makeDeferredReferenceResult();
      const singleTarget = reaction === "electroCharged";
      const trigger = {
        ...deferred.damageEvents[0],
        reaction,
        reactionAudit: {
          ...deferred.damageEvents[0]!.reactionAudit,
          reactions: singleTarget ? [reaction] : [],
          transformativeReaction: null,
          burningReaction: singleTarget
            ? null
            : {
                reaction: "burning" as const,
                operation: "start" as const
              }
        }
      };
      const firstDamage = {
        ...deferred.damageEvents[1],
        targetId: singleTarget ? "enemy-0" : "enemy-1",
        element: damageElement,
        reaction
      };
      const firstLog = {
        ...deferred.reactionDamageLog[0],
        reaction,
        scheduleKind,
        targetingMode: singleTarget
          ? ("single-target" as const)
          : ("radius" as const),
        checkedTargetIds: singleTarget
          ? ["enemy-0"]
          : ["enemy-0", "enemy-1"],
        hitTargetIds: [
          singleTarget ? "enemy-0" : "enemy-1"
        ],
        damageGroupBlockedTargetIds: [],
        damageGroupDecisions: singleTarget
          ? [
              makeDamageGroupDecision(
                "electroCharged",
                "enemy-0",
                13
              )
            ]
          : []
      };
      const secondDamage = {
        ...firstDamage,
        id: 2,
        frame: 18,
        eventSequence: 9,
        ...(singleTarget
          ? {
              finalDamage: 0,
              damageFactors: {
                groupMultiplier: 0
              }
            }
          : {})
      };
      const secondLog = {
        ...firstLog,
        id: 1,
        damageFrame: 18,
        damageEventIds: [2],
        damageGroupBlockedTargetIds: singleTarget
          ? ["enemy-0"]
          : [],
        damageGroupDecisions: singleTarget
          ? [
              makeDamageGroupDecision(
                "electroCharged",
                "enemy-0",
                13,
                1
              )
            ]
          : []
      };
      const multiTick = {
        ...deferred,
        damageEvents: [trigger, firstDamage, secondDamage],
        reactionDamageLog: [firstLog, secondLog]
      };
      expect(
        reactionDeliveryResultReferencesSchema.parse(
          multiTick
        )
      ).toEqual(multiTick);
    }
  );

  it("replays ReactionA windows through F29, same-frame order, and the F30 reset boundary", () => {
    const replay = makeCoreDamageGroupReplayResult([
      {
        frame: 0,
        windowStartFrame: 0,
        hitIndex: 0
      },
      {
        frame: 29,
        windowStartFrame: 0,
        hitIndex: 1
      },
      {
        frame: 29,
        windowStartFrame: 0,
        hitIndex: 2
      },
      {
        frame: 30,
        windowStartFrame: 30,
        hitIndex: 0
      }
    ]);
    expect(
      reactionDeliveryResultReferencesSchema.parse(replay)
    ).toEqual(replay);
    expect(
      replay.reactionDamageLog.map((entry) => ({
        frame: entry.damageFrame,
        hitIndex: entry.damageGroupDecisions[0]!.hitIndex,
        allowed:
          entry.damageGroupDecisions[0]!.damageAllowed
      }))
    ).toEqual([
      { frame: 0, hitIndex: 0, allowed: true },
      { frame: 29, hitIndex: 1, allowed: true },
      { frame: 29, hitIndex: 2, allowed: false },
      { frame: 30, hitIndex: 0, allowed: true }
    ]);
  });

  it("isolates same-frame ReactionA windows by target, actor, and reaction", () => {
    const isolated = makeCoreDamageGroupReplayResult([
      {
        frame: 0,
        windowStartFrame: 0,
        hitIndex: 0,
        reaction: "bloom",
        targetId: "enemy-0",
        sourceActorId: "a"
      },
      {
        frame: 0,
        windowStartFrame: 0,
        hitIndex: 0,
        reaction: "bloom",
        targetId: "enemy-1",
        sourceActorId: "a"
      },
      {
        frame: 0,
        windowStartFrame: 0,
        hitIndex: 0,
        reaction: "bloom",
        targetId: "enemy-0",
        sourceActorId: "b"
      },
      {
        frame: 0,
        windowStartFrame: 0,
        hitIndex: 0,
        reaction: "burgeon",
        targetId: "enemy-0",
        sourceActorId: "a"
      }
    ]);
    expect(
      reactionDeliveryResultReferencesSchema.parse(isolated)
    ).toEqual(isolated);
  });

  it("replays ReactionB second-hit blocking and rejects coordinated window forgery", () => {
    const replay =
      makeElectroChargedDamageGroupReplayResult([
        {
          frame: 0,
          windowStartFrame: 0,
          hitIndex: 0
        },
        {
          frame: 29,
          windowStartFrame: 0,
          hitIndex: 1
        },
        {
          frame: 30,
          windowStartFrame: 30,
          hitIndex: 0
        }
      ]);
    expect(
      reactionDeliveryResultReferencesSchema.parse(replay)
    ).toEqual(replay);

    const forgedDecision = makeDamageGroupDecision(
      "electroCharged",
      "enemy-0",
      29,
      0
    );
    const forged = {
      ...replay,
      damageEvents: replay.damageEvents.map((event, index) =>
        index === 2
          ? {
              ...event,
              finalDamage: 100,
              damageFactors: {
                groupMultiplier: 1
              }
            }
          : event
      ),
      reactionDamageLog: replay.reactionDamageLog.map(
        (entry, index) =>
          index === 1
            ? {
                ...entry,
                damageGroupBlockedTargetIds: [],
                damageGroupDecisions: [forgedDecision]
              }
            : entry
      )
    };
    const parsed =
      reactionDeliveryResultReferencesSchema.safeParse(forged);
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error(
        "coordinated ReactionB window forgery must be rejected"
      );
    }
    expect(parsed.error.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /windowStartFrame must replay to 0/
        ),
        expect.stringMatching(/hitIndex must replay to 1/)
      ])
    );
  });

  it("closes non-Shatter ReactionA/B decisions against child damage state", () => {
    const deferred = makeDeferredReferenceResult();
    const secondTrigger = {
      ...deferred.damageEvents[0],
      id: 2,
      frame: 17,
      eventSequence: 9,
      reactionAudit: {
        ...deferred.damageEvents[0]!.reactionAudit,
        transformativeReaction:
          makeOneShotTransformativeAudit(
            "overload",
            17
          )
      }
    };
    const secondChild = {
      ...deferred.damageEvents[1],
      id: 3,
      parentDamageEventId: 2,
      frame: 18,
      eventSequence: 10,
      finalDamage: 0,
      damageFactors: {
        groupMultiplier: 0
      }
    };
    const blocked = {
      ...deferred,
      damageEvents: [
        deferred.damageEvents[0],
        deferred.damageEvents[1],
        secondTrigger,
        secondChild
      ],
      reactionDamageLog: [
        deferred.reactionDamageLog[0],
        {
          ...deferred.reactionDamageLog[0],
          id: 1,
          triggerDamageEventId: 2,
          triggerFrame: 17,
          damageFrame: 18,
          nextAvailableFrame: 23,
          damageEventIds: [3],
          damageGroupBlockedTargetIds: ["enemy-1"],
          damageGroupDecisions: [
            makeDamageGroupDecision(
              "overload",
              "enemy-1",
              13,
              1
            )
          ]
        }
      ]
    };
    expect(
      reactionDeliveryResultReferencesSchema.parse(blocked)
    ).toEqual(blocked);

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...blocked,
        damageEvents: [
          blocked.damageEvents[0],
          blocked.damageEvents[1],
          blocked.damageEvents[2],
          {
            ...blocked.damageEvents[3],
            finalDamage: 100,
            damageFactors: {
              groupMultiplier: 1
            }
          }
        ]
      })
    ).toThrow(
      /blocked ReactionA\/B damage requires REACTION_B_DAMAGE_ICD, child groupMultiplier 0, and finalDamage 0/
    );

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        reactionDamageLog: [
          {
            ...deferred.reactionDamageLog[0],
            damageGroupDecisions: []
          }
        ]
      })
    ).toThrow(/decisions must align 1:1/);
  });

  it("rejects forged Burning damage-group state and requires neutral child grouping", () => {
    const deferred = makeDeferredReferenceResult();
    const trigger = {
      ...deferred.damageEvents[0],
      reaction: "burning" as const,
      reactionAudit: {
        ...deferred.damageEvents[0]!.reactionAudit,
        reactions: [] as const,
        transformativeReaction: null,
        burningReaction: {
          reaction: "burning" as const,
          operation: "start" as const
        }
      }
    };
    const forged = {
      ...deferred,
      damageEvents: [
        trigger,
        {
          ...deferred.damageEvents[1],
          reaction: "burning" as const,
          finalDamage: 0,
          damageFactors: {
            groupMultiplier: 0
          }
        }
      ],
      reactionDamageLog: [
        {
          ...deferred.reactionDamageLog[0],
          reaction: "burning" as const,
          scheduleKind: "burning-tick" as const,
          damageGroupBlockedTargetIds: ["enemy-1"],
          damageGroupDecisions: [
            makeDamageGroupDecision(
              "overload",
              "enemy-1",
              13,
              1
            )
          ]
        }
      ]
    };
    const parsed =
      reactionDeliveryResultReferencesSchema.safeParse(forged);
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error(
        "forged Burning damage-group state must be rejected"
      );
    }
    expect(parsed.error.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /Burning does not use a ReactionA\/B damage group/
        ),
        expect.stringMatching(
          /settled Burning damage requires child groupMultiplier 1/
        )
      ])
    );
  });

  it("preserves allowed zero-damage Hydro Swirl children", () => {
    const swirl = makeSwirlReferenceResult();
    const swirlTrigger = swirl.damageEvents[0]!;
    const swirlChildren = swirl.damageEvents.slice(1);
    const hydroSwirl = {
      ...swirl,
      damageEvents: [
        {
          ...swirlTrigger,
          reaction: "swirlHydro" as const,
          reactionAudit: {
            ...swirlTrigger.reactionAudit,
            reactions: ["swirlHydro" as const],
            swirlReactions:
              swirlTrigger.reactionAudit.swirlReactions.map(
                (audit) => ({
                  ...audit,
                  reaction: "swirlHydro" as const
                })
              )
          }
        },
        ...swirlChildren.map((event) => ({
          ...event,
          element: "hydro" as const,
          reaction: "swirlHydro" as const,
          finalDamage: 0,
          damageFactors: {
            groupMultiplier: 1
          }
        }))
      ],
      reactionDamageLog: swirl.reactionDamageLog.map(
        (entry) => ({
          ...entry,
          reaction: "swirlHydro" as const,
          damageGroupDecisions:
            entry.damageGroupDecisions.map((decision) => ({
              ...decision,
              reaction: "swirlHydro" as const
            }))
        })
      )
    };
    expect(
      reactionDeliveryResultReferencesSchema.parse(hydroSwirl)
    ).toEqual(hydroSwirl);
  });

  it("requires one-shot transformative audits and logs in both directions", () => {
    const deferred = makeDeferredReferenceResult();
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        damageEvents: [deferred.damageEvents[0]],
        reactionDamageLog: []
      })
    ).toThrow(/requires exactly one reaction-damage log/);

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        damageEvents: [
          {
            ...deferred.damageEvents[0],
            reactionAudit: {
              ...deferred.damageEvents[0]!.reactionAudit,
              transformativeReaction: null
            }
          },
          deferred.damageEvents[1]
        ]
      })
    ).toThrow(/requires exactly one matching parent reaction audit/);
  });

  it("accepts the real one-shot GCD and mechanics-truncation terminal states", () => {
    const deferred = makeDeferredReferenceResult();
    const gcdAudit = {
      ...makeOneShotTransformativeAudit(
        "overload",
        12,
        false
      ),
      // A hit one frame before the previous 6f window closes
      // legitimately makes readyFrame equal damageFrame.
      nextAvailableFrame: 13
    };
    const gcdBlocked = {
      ...deferred,
      damageEvents: [
        {
          ...deferred.damageEvents[0],
          reactionAudit: {
            ...deferred.damageEvents[0]!.reactionAudit,
            transformativeReaction: gcdAudit
          }
        }
      ],
      reactionDamageLog: [
        {
          ...deferred.reactionDamageLog[0],
          scheduled: false,
          withinSimulation: false,
          blockedReason: "REACTION_DAMAGE_GCD" as const,
          nextAvailableFrame: 13,
          checkedTargetIds: [],
          hitTargetIds: [],
          damageEventIds: [],
          damageGroupBlockedTargetIds: [],
          damageGroupDecisions: []
        }
      ]
    };
    expect(
      reactionDeliveryResultReferencesSchema.parse(gcdBlocked)
    ).toEqual(gcdBlocked);

    const truncatedAudit = {
      ...makeOneShotTransformativeAudit(
        "overload",
        12,
        false
      ),
      blockedReason:
        "TARGET_MECHANICS_TRUNCATION" as const,
      nextAvailableFrame: 18
    };
    const mechanicsTruncated = {
      ...deferred,
      damageEvents: [
        {
          ...deferred.damageEvents[0],
          reactionAudit: {
            ...deferred.damageEvents[0]!.reactionAudit,
            mechanicsTruncation: {
              operation: "trigger"
            },
            transformativeReaction: truncatedAudit
          }
        }
      ],
      reactionDamageLog: []
    };
    expect(
      reactionDeliveryResultReferencesSchema.parse(
        mechanicsTruncated
      )
    ).toEqual(mechanicsTruncated);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...mechanicsTruncated,
        damageEvents: [
          {
            ...mechanicsTruncated.damageEvents[0],
            reactionAudit: {
              ...mechanicsTruncated.damageEvents[0]!
                .reactionAudit,
              mechanicsTruncation: null
            }
          }
        ]
      })
    ).toThrow(/requires a non-null mechanicsTruncation/);
  });

  it.each([
    [
      "damageFrame",
      { damageFrame: 14 },
      /trigger frame \+ 1/
    ],
    [
      "nextAvailableFrame",
      { nextAvailableFrame: 19 },
      /trigger frame \+ 6/
    ],
    [
      "scheduled",
      { scheduled: false },
      /scheduling does not match blockedReason/
    ],
    [
      "blockedReason",
      { blockedReason: "REACTION_DAMAGE_GCD" as const },
      /scheduling does not match blockedReason/
    ]
  ])(
    "rejects a one-shot audit single-field mutation: %s",
    (_label, patch, expectedError) => {
      const deferred = makeDeferredReferenceResult();
      const trigger = deferred.damageEvents[0]!;
      expect(() =>
        reactionDeliveryResultReferencesSchema.parse({
          ...deferred,
          damageEvents: [
            {
              ...trigger,
              reactionAudit: {
                ...trigger.reactionAudit,
                transformativeReaction: {
                  ...trigger.reactionAudit
                    .transformativeReaction!,
                  ...patch
                }
              }
            },
            deferred.damageEvents[1]
          ]
        })
      ).toThrow(expectedError);
    }
  );

  it("requires the two fixed Swirl delivery roles and their fine audit", () => {
    const swirl = makeSwirlReferenceResult();
    expect(
      reactionDeliveryResultReferencesSchema.parse(swirl)
    ).toEqual(swirl);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...swirl,
        damageEvents: swirl.damageEvents.slice(0, 2),
        reactionDamageLog: [swirl.reactionDamageLog[0]]
      })
    ).toThrow(/requires exactly one swirl-propagation/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...swirl,
        damageEvents: [
          {
            ...swirl.damageEvents[0],
            reactionAudit: {
              ...swirl.damageEvents[0]!.reactionAudit,
              swirlReactions: []
            }
          },
          swirl.damageEvents[1],
          swirl.damageEvents[2]
        ]
      })
    ).toThrow(/requires exactly one matching parent reaction audit/);
  });

  it.each([
    [
      "selfDamageFrame",
      { selfDamageFrame: 14 },
      /selfDamageFrame must equal/
    ],
    [
      "propagationDamageFrame",
      { propagationDamageFrame: 18 },
      /propagationDamageFrame must equal/
    ],
    [
      "nextAvailableFrame",
      { nextAvailableFrame: 19 },
      /trigger frame \+ 6/
    ],
    [
      "scheduled",
      { scheduled: false },
      /scheduling does not match blockedReason/
    ]
  ])(
    "rejects a Swirl audit single-field mutation: %s",
    (_label, patch, expectedError) => {
      const swirl = makeSwirlReferenceResult();
      const trigger = swirl.damageEvents[0]!;
      expect(() =>
        reactionDeliveryResultReferencesSchema.parse({
          ...swirl,
          damageEvents: [
            {
              ...trigger,
              reactionAudit: {
                ...trigger.reactionAudit,
                swirlReactions: [
                  {
                    ...trigger.reactionAudit.swirlReactions[0]!,
                    ...patch
                  }
                ]
              }
            },
            swirl.damageEvents[1],
            swirl.damageEvents[2]
          ]
        })
      ).toThrow(expectedError);
    }
  );

  it("rejects hit-target misalignment and a contiguous bogus log", () => {
    const deferred = makeDeferredReferenceResult();
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        reactionDamageLog: [
          {
            ...deferred.reactionDamageLog[0],
            hitTargetIds: []
          }
        ]
      })
    ).toThrow(/must align 1:1/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        reactionDamageLog: [
          {
            ...deferred.reactionDamageLog[0],
            checkedTargetIds: ["enemy-0"]
          }
        ]
      })
    ).toThrow(/in-order subsequence of checkedTargetIds/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        reactionDamageLog: [
          deferred.reactionDamageLog[0],
          {
            ...deferred.reactionDamageLog[0],
            id: 1,
            triggerDamageEventId: 99,
            checkedTargetIds: [],
            hitTargetIds: [],
            damageEventIds: []
          }
        ]
      })
    ).toThrow(/missing trigger damage event 99/);
  });

  it("does not let an empty recursive Shatter log claim settled status", () => {
    const recursive = makeRecursiveReferenceResult();
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        damageEvents: [
          {
            ...recursive.damageEvents[1],
            id: 0
          }
        ],
        reactionDamageLog: [
          {
            ...recursive.reactionDamageLog[0],
            triggerDamageEventId: 0,
            hitTargetIds: [],
            damageEventIds: []
          }
        ]
      })
    ).toThrow(/settled Shatter log requires exactly one/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        reactionDamageLog: [
          {
            ...recursive.reactionDamageLog[0],
            checkedTargetIds: ["enemy-0", "enemy-1"]
          }
        ]
      })
    ).toThrow(/settled Shatter log requires exactly one/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        damageEvents: [
          {
            ...recursive.damageEvents[1],
            id: 0,
            reactionAudit:
              makeTriggeredShatterReactionAudit(false)
          }
        ],
        reactionDamageLog: [
          {
            ...recursive.reactionDamageLog[0],
            triggerDamageEventId: 0,
            scheduled: false,
            withinSimulation: false,
            blockedReason: "REACTION_QUEUE_GCD",
            checkedTargetIds: ["enemy-0"],
            hitTargetIds: [],
            damageEventIds: []
          }
        ]
      })
    ).toThrow(/cannot retain checked targets/);
  });

  it.each([
    ["unscheduled but within duration", { withinSimulation: true }],
    ["unscheduled without a block", { blockedReason: null }],
    [
      "scheduled out of duration with a damage-GCD block",
      {
        scheduled: true,
        blockedReason: "REACTION_DAMAGE_GCD" as const
      }
    ],
    [
      "reaction queue GCD",
      { blockedReason: "REACTION_QUEUE_GCD" as const }
    ],
    [
      "target mechanics truncation",
      { blockedReason: "TARGET_MECHANICS_TRUNCATION" as const }
    ],
    ["null trigger", { triggerDamageEventId: null }],
    ["periodic schedule", { scheduleKind: "periodic-tick" as const }],
    ["radius targeting", { targetingMode: "radius" as const }]
  ])(
    "rejects impossible non-settled recursive Shatter state: %s",
    (_label, patch) => {
      const recursive = makeRecursiveReferenceResult();
      const blocked = {
        ...recursive,
        damageEvents: [
          {
            ...recursive.damageEvents[1],
            id: 0,
            reactionAudit:
              makeTriggeredShatterReactionAudit(
                "scheduled" in patch
                  ? patch.scheduled === true
                  : false
              )
          }
        ],
        reactionDamageLog: [
          {
            ...recursive.reactionDamageLog[0],
            triggerDamageEventId: 0,
            scheduled: false,
            withinSimulation: false,
            blockedReason: "REACTION_DAMAGE_GCD" as const,
            checkedTargetIds: [],
            hitTargetIds: [],
            damageEventIds: [],
            ...patch
          }
        ]
      };
      expect(() =>
        reactionDeliveryResultReferencesSchema.parse(blocked)
      ).toThrow(
        /Shatter|reaction-damage scheduling/
      );
    }
  );

  it("enforces the generic scheduled/within/output state machine for deferred logs", () => {
    const deferred = makeDeferredReferenceResult();
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        reactionDamageLog: [
          {
            ...deferred.reactionDamageLog[0],
            scheduled: false,
            withinSimulation: false,
            blockedReason: "REACTION_DAMAGE_GCD"
          }
        ]
      })
    ).toThrow(/cannot retain checked targets/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        reactionDamageLog: [
          {
            ...deferred.reactionDamageLog[0],
            scheduled: false,
            blockedReason: "REACTION_DAMAGE_GCD",
            checkedTargetIds: [],
            hitTargetIds: [],
            damageEventIds: []
          }
        ]
      })
    ).toThrow(/withinSimulation only when scheduled/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        reactionDamageLog: [
          {
            ...deferred.reactionDamageLog[0],
            blockedReason: "REACTION_DAMAGE_GCD"
          }
        ]
      })
    ).toThrow(/null blockedReason when scheduled/);

    const scheduledAfterDuration = {
      ...deferred,
      config: {
        ...deferred.config,
        duration: 0.2
      },
      damageEvents: [deferred.damageEvents[0]],
      reactionDamageLog: [
        {
          ...deferred.reactionDamageLog[0],
          withinSimulation: false,
          checkedTargetIds: [],
          hitTargetIds: [],
          damageEventIds: [],
          damageGroupBlockedTargetIds: [],
          damageGroupDecisions: []
        }
      ]
    };
    expect(
      reactionDeliveryResultReferencesSchema.parse(
        scheduledAfterDuration
      )
    ).toEqual(scheduledAfterDuration);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...scheduledAfterDuration,
        reactionDamageLog: [
          {
            ...scheduledAfterDuration.reactionDamageLog[0],
            withinSimulation: true
          }
        ]
      })
    ).toThrow(/withinSimulation must equal scheduled/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        config: {
          ...deferred.config,
          duration: 0.2
        }
      })
    ).toThrow(/damage events cannot occur after simulation frame/);
  });

  it("rejects pre-trigger reaction damage, non-core null triggers, and invalid queued ordering", () => {
    const deferred = makeDeferredReferenceResult();
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        damageEvents: [
          deferred.damageEvents[0],
          {
            ...deferred.damageEvents[1],
            frame: 11
          }
        ],
        reactionDamageLog: [
          {
            ...deferred.reactionDamageLog[0],
            damageFrame: 11
          }
        ]
      })
    ).toThrow(/cannot occur before its trigger frame/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        damageEvents: [deferred.damageEvents[0]],
        reactionDamageLog: [
          {
            ...deferred.reactionDamageLog[0],
            damageFrame: 11,
            scheduled: false,
            withinSimulation: false,
            blockedReason: "REACTION_DAMAGE_GCD",
            checkedTargetIds: [],
            hitTargetIds: [],
            damageEventIds: []
          }
        ]
      })
    ).toThrow(/cannot occur before its trigger frame/);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        damageEvents: [
          deferred.damageEvents[0],
          {
            ...deferred.damageEvents[1],
            parentDamageEventId: null
          }
        ],
        reactionDamageLog: [
          {
            ...deferred.reactionDamageLog[0],
            triggerDamageEventId: null
          }
        ]
      })
    ).toThrow(/only Dendro-core reaction damage may omit/);

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        damageEvents: [
          {
            ...deferred.damageEvents[0],
            eventPriority: 5,
            eventSequence: 9
          },
          {
            ...deferred.damageEvents[1],
            frame: 12,
            eventPriority: 5,
            eventSequence: 8
          }
        ],
        reactionDamageLog: [
          {
            ...deferred.reactionDamageLog[0],
            damageFrame: 12
          }
        ]
      })
    ).toThrow(/later eventSequence/);

    expect(
      reactionDeliveryResultReferencesSchema.parse(
        deferred
      )
    ).toEqual(deferred);
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        damageEvents: [
          deferred.damageEvents[0],
          {
            ...deferred.damageEvents[1],
            eventPriority: 1
          }
        ]
      })
    ).toThrow(/eventPriority 5/);
  });

  it("locks reaction schedule, targeting, and damage-element mappings", () => {
    const deferred = makeDeferredReferenceResult();
    for (const patch of [
      { scheduleKind: "periodic-tick" as const },
      { targetingMode: "nearest-target-radius" as const }
    ]) {
      expect(() =>
        reactionDeliveryResultReferencesSchema.parse({
          ...deferred,
          reactionDamageLog: [
            {
              ...deferred.reactionDamageLog[0],
              ...patch
            }
          ]
        })
      ).toThrow(/fixed reaction-delivery matrix/);
    }
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...deferred,
        damageEvents: [
          deferred.damageEvents[0],
          {
            ...deferred.damageEvents[1],
            element: "hydro"
          }
        ]
      })
    ).toThrow(/damage element/);
  });

  it("locks per-log damage-id, target, and event-tuple ordering", () => {
    const deferred = makeDeferredReferenceResult();
    const secondTargetEvent = {
      ...deferred.damageEvents[1],
      id: 2,
      targetId: "enemy-2"
    };
    const twoTargetResult = {
      ...deferred,
      config: {
        ...deferred.config,
        enemy: {
          targets: [
            { id: "enemy-0" },
            { id: "enemy-1" },
            { id: "enemy-2" }
          ]
        }
      },
      damageEvents: [
        deferred.damageEvents[0],
        deferred.damageEvents[1],
        secondTargetEvent
      ],
      reactionDamageLog: [
        {
          ...deferred.reactionDamageLog[0],
          checkedTargetIds: [
            "enemy-0",
            "enemy-1",
            "enemy-2"
          ],
          hitTargetIds: ["enemy-1", "enemy-2"],
          damageEventIds: [1, 2],
          damageGroupDecisions: [
            makeDamageGroupDecision(
              "overload",
              "enemy-1",
              13
            ),
            makeDamageGroupDecision(
              "overload",
              "enemy-2",
              13
            )
          ]
        }
      ]
    };
    expect(
      reactionDeliveryResultReferencesSchema.parse(
        twoTargetResult
      )
    ).toEqual(twoTargetResult);

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...twoTargetResult,
        reactionDamageLog: [
          {
            ...twoTargetResult.reactionDamageLog[0],
            checkedTargetIds: [
              "enemy-0",
              "enemy-2",
              "enemy-1"
            ],
            hitTargetIds: ["enemy-2", "enemy-1"],
            damageEventIds: [2, 1]
          }
        ]
      })
    ).toThrow(/strictly increasing/);

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...twoTargetResult,
        damageEvents: [
          twoTargetResult.damageEvents[0],
          {
            ...twoTargetResult.damageEvents[1],
            targetId: "enemy-2"
          },
          {
            ...twoTargetResult.damageEvents[2],
            targetId: "enemy-1"
          }
        ],
        reactionDamageLog: [
          {
            ...twoTargetResult.reactionDamageLog[0],
            hitTargetIds: ["enemy-2", "enemy-1"]
          }
        ]
      })
    ).toThrow(/in-order subsequence/);

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...twoTargetResult,
        damageEvents: [
          twoTargetResult.damageEvents[0],
          twoTargetResult.damageEvents[1],
          {
            ...twoTargetResult.damageEvents[2],
            eventSequence: 9
          }
        ]
      })
    ).toThrow(/must share the same event tuple/);
  });

  it("binds checked targets to canonical config traversal order", () => {
    const deferred = makeDeferredReferenceResult();
    const firstTargetDamage = {
      ...deferred.damageEvents[1],
      targetId: "enemy-0"
    };
    const secondTargetDamage = {
      ...deferred.damageEvents[1],
      id: 2,
      targetId: "enemy-1"
    };
    const canonical = {
      ...deferred,
      damageEvents: [
        deferred.damageEvents[0],
        firstTargetDamage,
        secondTargetDamage
      ],
      reactionDamageLog: [
        {
          ...deferred.reactionDamageLog[0],
          checkedTargetIds: ["enemy-0", "enemy-1"],
          hitTargetIds: ["enemy-0", "enemy-1"],
          damageEventIds: [1, 2],
          damageGroupDecisions: [
            makeDamageGroupDecision(
              "overload",
              "enemy-0",
              13
            ),
            makeDamageGroupDecision(
              "overload",
              "enemy-1",
              13
            )
          ]
        }
      ]
    };
    expect(
      reactionDeliveryResultReferencesSchema.parse(canonical)
    ).toEqual(canonical);

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...canonical,
        damageEvents: [
          canonical.damageEvents[0],
          {
            ...canonical.damageEvents[1],
            targetId: "enemy-1"
          },
          {
            ...canonical.damageEvents[2],
            targetId: "enemy-0"
          }
        ],
        reactionDamageLog: [
          {
            ...canonical.reactionDamageLog[0],
            checkedTargetIds: ["enemy-1", "enemy-0"],
            hitTargetIds: ["enemy-1", "enemy-0"]
          }
        ]
      })
    ).toThrow(/config\.enemy\.targets traversal order/);

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...canonical,
        reactionDamageLog: [
          {
            ...canonical.reactionDamageLog[0],
            checkedTargetIds: ["enemy-0", "unregistered"]
          }
        ]
      })
    ).toThrow(/not registered in config\.enemy\.targets/);
  });

  it("uses enemy-0 as the canonical target when config omits enemy.targets", () => {
    const recursive = makeRecursiveReferenceResult();
    const {
      enemy: _enemy,
      ...configWithoutEnemy
    } = recursive.config;
    const fallback = {
      ...recursive,
      config: configWithoutEnemy
    };
    expect(
      reactionDeliveryResultReferencesSchema.parse(fallback)
    ).toEqual(fallback);

    const fallbackWithEnemy = {
      ...recursive,
      config: {
        ...recursive.config,
        enemy: {}
      }
    };
    expect(
      reactionDeliveryResultReferencesSchema.parse(
        fallbackWithEnemy
      )
    ).toEqual(fallbackWithEnemy);
  });

  it("requires an explicit target registry to retain compatibility target enemy-0", () => {
    const recursive = makeRecursiveReferenceResult();
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        config: {
          ...recursive.config,
          enemy: {
            targets: [{ id: "enemy-1" }]
          }
        },
        damageEvents: recursive.damageEvents.map((event) => ({
          ...event,
          targetId: "enemy-1"
        })),
        reactionDamageLog: [
          {
            ...recursive.reactionDamageLog[0],
            sourceTargetId: "enemy-1",
            checkedTargetIds: ["enemy-1"],
            hitTargetIds: ["enemy-1"],
            damageGroupDecisions:
              recursive.reactionDamageLog[0]!
                .damageGroupDecisions.map((decision) => ({
                  ...decision,
                  targetId: "enemy-1"
                }))
          }
        ]
      })
    ).toThrow(/must include compatibility target/);
  });

  it("locks global damage commit tuple order and direct hit priority", () => {
    const recursive = makeRecursiveReferenceResult();
    expect(
      reactionDeliveryResultReferencesSchema.parse(recursive)
    ).toEqual(recursive);

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        damageEvents: [
          recursive.damageEvents[0],
          {
            ...recursive.damageEvents[1],
            eventPriority: 999
          }
        ]
      })
    ).toThrow(/EVENT_PRIORITY\.hit = 3/);

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        damageEvents: [
          recursive.damageEvents[0],
          recursive.damageEvents[1],
          {
            ...recursive.damageEvents[1],
            id: 2,
            frame: 11,
            eventSequence: 8,
            reactionAudit: noShatterReactionAudit
          }
        ]
      })
    ).toThrow(/nondecreasing \(frame, eventPriority, eventSequence\)/);

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        damageEvents: [
          {
            ...recursive.damageEvents[0],
            eventPriority: 999
          },
          {
            ...recursive.damageEvents[1],
            eventPriority: 999
          }
        ]
      })
    ).toThrow(/EVENT_PRIORITY\.hit = 3/);
  });

  it("locks recursive Shatter adjacency, inherited ordering, and one child per parent", () => {
    const recursive = makeRecursiveReferenceResult();
    const unrelated = {
      ...recursive,
      damageEvents: [
        {
          ...recursive.damageEvents[0],
          parentDamageEventId: 2
        },
        {
          ...recursive.damageEvents[1],
          id: 1,
          parentDamageEventId: null
        },
        {
          ...recursive.damageEvents[1],
          id: 2
        }
      ],
      reactionDamageLog: [
        {
          ...recursive.reactionDamageLog[0],
          triggerDamageEventId: 2
        }
      ]
    };
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(unrelated)
    ).toThrow(/adjacent/);

    for (const damageEvent of [
      {
        ...recursive.damageEvents[0],
        eventPriority: 4
      },
      {
        ...recursive.damageEvents[0],
        eventSequence: 8
      }
    ]) {
      expect(() =>
        reactionDeliveryResultReferencesSchema.parse({
          ...recursive,
          damageEvents: [
            damageEvent,
            recursive.damageEvents[1]
          ]
        })
      ).toThrow(/same-tuple|exact zero-delay/);
    }

    const childTwo = {
      ...recursive.damageEvents[0],
      id: 1,
      parentDamageEventId: 2
    };
    const sharedParent = {
      ...recursive,
      damageEvents: [
        {
          ...recursive.damageEvents[0],
          parentDamageEventId: 2
        },
        childTwo,
        {
          ...recursive.damageEvents[1],
          id: 2
        }
      ],
      reactionDamageLog: [
        {
          ...recursive.reactionDamageLog[0],
          triggerDamageEventId: 2
        },
        {
          ...recursive.reactionDamageLog[0],
          id: 1,
          triggerDamageEventId: 2,
          damageEventIds: [1]
        }
      ]
    };
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(sharedParent)
    ).toThrow(/at most one forward recursive Shatter child/);

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...sharedParent,
        reactionDamageLog: [
          {
            ...sharedParent.reactionDamageLog[0],
            hitTargetIds: ["enemy-0", "enemy-0"],
            damageEventIds: [0, 1]
          }
        ]
      })
    ).toThrow(
      /settled Shatter|exactly one owning|duplicate reaction-damage target/
    );

    const chainedShatter = {
      ...recursive,
      damageEvents: [
        {
          ...recursive.damageEvents[0],
          parentDamageEventId: 1
        },
        {
          ...recursive.damageEvents[0],
          id: 1,
          parentDamageEventId: 2
        },
        {
          ...recursive.damageEvents[1],
          id: 2
        }
      ],
      reactionDamageLog: [
        recursive.reactionDamageLog[0],
        {
          ...recursive.reactionDamageLog[0],
          id: 1,
          triggerDamageEventId: 2,
          damageEventIds: [1]
        }
      ]
    };
    expect(() =>
      reactionDeliveryResultReferencesSchema.parse(chainedShatter)
    ).toThrow(/cannot be the parent of another recursive Shatter/);

    expect(() =>
      reactionDeliveryResultReferencesSchema.parse({
        ...recursive,
        reactionDamageLog: [
          recursive.reactionDamageLog[0],
          {
            ...recursive.reactionDamageLog[0],
            id: 1,
            scheduled: false,
            withinSimulation: false,
            blockedReason: "REACTION_DAMAGE_GCD",
            checkedTargetIds: [],
            hitTargetIds: [],
            damageEventIds: []
          }
        ]
      })
    ).toThrow(/at most one Shatter log/);
  });

  it.each([
    ["scheduled", { scheduled: false }],
    ["withinSimulation", { withinSimulation: false }],
    [
      "blockedReason",
      { blockedReason: "REACTION_DAMAGE_GCD" as const }
    ],
    ["scheduleKind", { scheduleKind: "periodic-tick" as const }],
    ["targetingMode", { targetingMode: "radius" as const }]
  ])(
    "rejects a settled recursive Shatter child with wrong %s",
    (_field, patch) => {
      const recursive = makeRecursiveReferenceResult();
      expect(() =>
        reactionDeliveryResultReferencesSchema.parse({
          ...recursive,
          reactionDamageLog: [
            {
              ...recursive.reactionDamageLog[0],
              ...patch
            }
          ]
        })
      ).toThrow(
        /exact zero-delay one-shot provenance|non-settled|backlink|reaction-damage scheduling|always requires one-shot/
      );
    }
  );

  it.each(["eventPriority", "eventSequence"] as const)(
    "requires recursive damage events to project %s",
    (field) => {
      const recursive = makeRecursiveReferenceResult();
      const child = {
        ...recursive.damageEvents[0]
      } as Record<string, unknown>;
      delete child[field];
      expect(() =>
        reactionDeliveryResultReferencesSchema.parse({
          ...recursive,
          damageEvents: [child, recursive.damageEvents[1]]
        })
      ).toThrow(new RegExp(field));
    }
  );
});

describe("1.37 target task phase result references", () => {
  type TargetTaskPhaseReferenceFixture = {
    schemaVersion: string;
    engineVersion: string;
    config: {
      schemaVersion: string;
      engineVersion: string;
      targetTaskModel: {
        mode: "target-phase-v1" | "legacy-event-heap-v1";
      };
      targetClockModel: {
        mode: "disabled" | "target-local-hitlag-v1";
      };
      reactionEngine: { mode: string };
    };
    enemyTargets: Array<{ id: string; name: string }>;
    targetClockAudit: {
      mode: "disabled" | "target-local-hitlag-v1";
    };
    targetClockLog: TargetClockLogEntry[];
    targetTaskPhaseLog: TargetTaskPhaseLogEntry[];
    burningStateLog: Array<{
      id: number;
      operation:
        | "start"
        | "refresh-fuel"
        | "refresh-snapshot"
        | "tick"
        | "tick-skipped"
        | "stop"
        | "fuel-expire";
      frame: number;
      targetFrame?: number;
      timeSeconds: number;
      eventPriority: number;
      eventSequence: number;
      targetId: string;
      targetName: string;
      auraBefore: TargetTaskPhaseLogEntry["auraBeforeTasks"];
      auraAfter: TargetTaskPhaseLogEntry["auraAfterTasks"];
    }>;
    hitResolutionLog: Array<{
      id: number;
      frame: number;
      timeSeconds: number;
      eventPriority?: number;
      eventSequence?: number;
      intraEventSequence?: number;
      targetId: string;
      targetName: string;
      resolutionKind: "direct" | "reaction-damage";
      landed: boolean;
      damageEventId: number | null;
    }>;
    reactionTaskLog: Array<{
      id: number;
      frame: number;
      timeSeconds: number;
      targetId: string;
      targetName: string;
      eventPriority: number;
      eventSequence: number;
      intraEventSequence: number;
      auraBefore: TargetTaskPhaseLogEntry["auraBeforeTasks"];
      auraAfter: TargetTaskPhaseLogEntry["auraAfterTasks"];
    }>;
    targetStateTimeline: TargetStateTimeline;
  };

  const makeReferenceResult =
    (): TargetTaskPhaseReferenceFixture => ({
    schemaVersion: TARGET_TASK_PHASE_SCHEMA_VERSION,
    engineVersion: TARGET_TASK_PHASE_ENGINE_VERSION,
    config: {
      schemaVersion: TARGET_TASK_PHASE_SCHEMA_VERSION,
      engineVersion: TARGET_TASK_PHASE_ENGINE_VERSION,
      targetTaskModel: { mode: "target-phase-v1" as const },
      targetClockModel: { mode: "disabled" as const },
      reactionEngine: { mode: "aura-v7" }
    },
    enemyTargets: [{ id: "enemy-0", name: "Target" }],
    targetClockAudit: { mode: "disabled" as const },
    targetClockLog: [],
    targetTaskPhaseLog: [
      {
        id: 0,
        targetId: "enemy-0",
        targetName: "Target",
        globalFrame: 15,
        timeSeconds: 15 / 60,
        targetFrame: 15,
        targetOrder: 0,
        wakeKind: "incoming" as const,
        eventType: "hit" as const,
        eventPriority: 3,
        eventSequence: 10,
        intraEventSequence: 0,
        auraBeforeTasks: [],
        auraAfterTasks: [],
        auraAfterDecay: [],
        burningStateLogIds: [],
        hitResolutionLogIds: [0],
        reactionTaskLogIds: []
      }
    ],
    burningStateLog: [],
    hitResolutionLog: [
      {
        id: 0,
        frame: 15,
        timeSeconds: 15 / 60,
        eventPriority: 3,
        eventSequence: 10,
        intraEventSequence: 1,
        targetId: "enemy-0",
        targetName: "Target",
        resolutionKind: "direct" as const,
        landed: true,
        damageEventId: 0
      }
    ],
    reactionTaskLog: [],
    targetStateTimeline: {
      version: "1.0.0" as const,
      points: [
        {
          id: 0,
          frame: 0,
          targetFrame: 0,
          timeSeconds: 0,
          targetId: "enemy-0",
          targetName: "Target",
          pointKind: "boundary" as const,
          cause: "simulation-start" as const,
          eventType: null,
          eventPriority: null,
          eventSequence: null,
          intraEventSequence: null,
          reaction: "none" as const,
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
          frame: 15,
          targetFrame: 15,
          timeSeconds: 15 / 60,
          targetId: "enemy-0",
          targetName: "Target",
          pointKind: "observation" as const,
          cause: "direct-hit-application" as const,
          eventType: "hit" as const,
          eventPriority: 3,
          eventSequence: 10,
          intraEventSequence: 1,
          reaction: "none" as const,
          reactions: [],
          primaryDamageEventId: 0,
          links: [
            { kind: "damage-event" as const, id: 0 }
          ],
          auraBefore: [],
          auraApplied: [],
          auraConsumed: [],
          auraAfter: []
        },
        {
          id: 2,
          frame: 60,
          targetFrame: 60,
          timeSeconds: 1,
          targetId: "enemy-0",
          targetName: "Target",
          pointKind: "boundary" as const,
          cause: "simulation-end" as const,
          eventType: null,
          eventPriority: null,
          eventSequence: null,
          intraEventSequence: null,
          reaction: "none" as const,
          reactions: [],
          primaryDamageEventId: null,
          links: [],
          auraBefore: [],
          auraApplied: [],
          auraConsumed: [],
          auraAfter: []
        }
      ]
    }
  });

  const makeBurningReferenceResult = () => {
    const result = makeReferenceResult();
    return {
      ...result,
      targetTaskPhaseLog: [
        {
          ...result.targetTaskPhaseLog[0]!,
          wakeKind: "burning-tick" as const,
          eventType: "burningTick" as const,
          eventPriority: 0.5,
          eventSequence: 5,
          burningStateLogIds: [0],
          hitResolutionLogIds: []
        }
      ],
      burningStateLog: [
        {
          id: 0,
          operation: "tick" as const,
          frame: 15,
          targetFrame: 15,
          timeSeconds: 15 / 60,
          eventPriority: 0.5,
          eventSequence: 5,
          targetId: "enemy-0",
          targetName: "Target",
          auraBefore: [],
          auraAfter: []
        }
      ],
      hitResolutionLog: [],
      targetStateTimeline: {
        ...result.targetStateTimeline,
        points: [
          result.targetStateTimeline.points[0]!,
          {
            ...result.targetStateTimeline.points[1]!,
            cause: "burning-tick" as const,
            eventType: "burningTick" as const,
            eventPriority: 0.5,
            eventSequence: 5,
            primaryDamageEventId: null,
            links: [
              { kind: "burning-state-log" as const, id: 0 }
            ]
          },
          result.targetStateTimeline.points[2]!
        ]
      }
    };
  };

  it("accepts a complete target-phase projection and historical empty legacy output", () => {
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(
        makeReferenceResult()
      )
    ).not.toThrow();
    for (const identity of [
      {
        schemaVersion: TARGET_REACTABLE_PHASE_SCHEMA_VERSION,
        engineVersion: TARGET_REACTABLE_PHASE_ENGINE_VERSION
      },
      {
        schemaVersion:
          SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
        engineVersion:
          SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION
      },
      {
        schemaVersion: EC_NEXT_TARGET_TICK_SCHEMA_VERSION,
        engineVersion: EC_NEXT_TARGET_TICK_ENGINE_VERSION
      }
    ]) {
      const versioned = makeReferenceResult();
      versioned.schemaVersion = identity.schemaVersion;
      versioned.engineVersion = identity.engineVersion;
      versioned.config.schemaVersion = identity.schemaVersion;
      versioned.config.engineVersion = identity.engineVersion;
      expect(() =>
        targetTaskPhaseResultReferencesSchema.parse(versioned)
      ).not.toThrow();
    }

    const currentLegacy = makeReferenceResult();
    currentLegacy.config.targetTaskModel = {
      mode: "legacy-event-heap-v1"
    };
    currentLegacy.targetTaskPhaseLog = [];
    delete currentLegacy.hitResolutionLog[0]!.eventPriority;
    delete currentLegacy.hitResolutionLog[0]!.eventSequence;
    delete currentLegacy.hitResolutionLog[0]!
      .intraEventSequence;
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(
        currentLegacy
      )
    ).not.toThrow();

    const historical = makeReferenceResult();
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse({
        ...historical,
        schemaVersion: QUICKEN_BLOOM_TASK_SCHEMA_VERSION,
        engineVersion: QUICKEN_BLOOM_TASK_ENGINE_VERSION,
        config: {
          schemaVersion: QUICKEN_BLOOM_TASK_SCHEMA_VERSION,
          engineVersion: QUICKEN_BLOOM_TASK_ENGINE_VERSION
        },
        targetTaskPhaseLog: []
      })
    ).not.toThrow();
  });

  it("rejects missing current fields, legacy rows, and incomplete target-phase projections", () => {
    const missingModel = makeReferenceResult();
    delete (
      missingModel.config as Partial<
        typeof missingModel.config
      >
    ).targetTaskModel;
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(missingModel)
    ).toThrow(/requires config\.targetTaskModel/);

    const legacyRows = makeReferenceResult();
    legacyRows.config.targetTaskModel = {
      mode: "legacy-event-heap-v1"
    };
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(legacyRows)
    ).toThrow(/requires an empty target task phase log/);

    const splitLegacyTopEngine = makeReferenceResult();
    splitLegacyTopEngine.config.targetTaskModel = {
      mode: "legacy-event-heap-v1"
    };
    splitLegacyTopEngine.targetTaskPhaseLog = [];
    splitLegacyTopEngine.engineVersion =
      QUICKEN_BLOOM_TASK_ENGINE_VERSION;
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(
        splitLegacyTopEngine
      )
    ).toThrow(/engineVersion must match/);

    const splitLegacyConfigEngine = makeReferenceResult();
    splitLegacyConfigEngine.config.targetTaskModel = {
      mode: "legacy-event-heap-v1"
    };
    splitLegacyConfigEngine.targetTaskPhaseLog = [];
    splitLegacyConfigEngine.config.engineVersion =
      QUICKEN_BLOOM_TASK_ENGINE_VERSION;
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(
        splitLegacyConfigEngine
      )
    ).toThrow(/engineVersion must match/);

    const forgedHistoricalTargetPhase = makeReferenceResult();
    forgedHistoricalTargetPhase.schemaVersion =
      QUICKEN_BLOOM_TASK_SCHEMA_VERSION;
    forgedHistoricalTargetPhase.config.schemaVersion =
      QUICKEN_BLOOM_TASK_SCHEMA_VERSION;
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(
        forgedHistoricalTargetPhase
      )
    ).toThrow(
      /historical target-task output cannot enable target-phase-v1/
    );

    const splitTopIdentity = makeReferenceResult();
    splitTopIdentity.schemaVersion =
      QUICKEN_BLOOM_TASK_SCHEMA_VERSION;
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(
        splitTopIdentity
      )
    ).toThrow(/schemaVersion must match|must both use/);

    const splitConfigIdentity = makeReferenceResult();
    splitConfigIdentity.config.schemaVersion =
      QUICKEN_BLOOM_TASK_SCHEMA_VERSION;
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(
        splitConfigIdentity
      )
    ).toThrow(/schemaVersion must match|must both use/);

    const forgedEngineIdentity = makeReferenceResult();
    forgedEngineIdentity.config.engineVersion =
      QUICKEN_BLOOM_TASK_ENGINE_VERSION;
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(
        forgedEngineIdentity
      )
    ).toThrow(/exact supported 1\.37 through 1\.42 or 1\.44 identity/);

    const wrongClockMode = makeReferenceResult();
    wrongClockMode.config.targetClockModel.mode =
      "target-local-hitlag-v1";
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(wrongClockMode)
    ).toThrow(/targetClockModel\.mode must match/);

    const wrongAuraMode = makeReferenceResult();
    wrongAuraMode.config.reactionEngine.mode = "aura-v6";
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(wrongAuraMode)
    ).toThrow(/require reactionEngine\.mode aura-v7/);

    const missingTimeline = makeReferenceResult();
    delete (
      missingTimeline as Partial<typeof missingTimeline>
    ).targetStateTimeline;
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(
        missingTimeline
      )
    ).toThrow(/requires targetStateTimeline/);
  });

  it("binds target identity, order, and target-clock replay", () => {
    const wrongName = makeReferenceResult();
    wrongName.targetTaskPhaseLog[0]!.targetName = "Forged";
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(wrongName)
    ).toThrow(/targetName must match enemyTargets/);

    const wrongOrder = makeReferenceResult();
    wrongOrder.targetTaskPhaseLog[0]!.targetOrder = 1;
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(wrongOrder)
    ).toThrow(/targetOrder must equal/);

    const wrongClock = makeReferenceResult();
    wrongClock.targetTaskPhaseLog[0]!.targetFrame = 14;
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(wrongClock)
    ).toThrow(/target-clock replay/);
  });

  it("enforces direct-hit ownership and preserves later reaction-damage ownership", () => {
    const missingDirectOwner = makeReferenceResult();
    missingDirectOwner.targetTaskPhaseLog[0]!.hitResolutionLogIds =
      [];
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(
        missingDirectOwner
      )
    ).toThrow(/direct hit-resolution log 0 requires exactly one/);

    const wrongWakeType = makeReferenceResult();
    wrongWakeType.hitResolutionLog[0]!.resolutionKind =
      "reaction-damage";
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(wrongWakeType)
    ).toThrow(/wake type/);

    const laterReactionDamage = makeReferenceResult();
    laterReactionDamage.hitResolutionLog = [
      ...laterReactionDamage.hitResolutionLog,
      {
        ...laterReactionDamage.hitResolutionLog[0]!,
        id: 1,
        resolutionKind: "reaction-damage" as const,
        damageEventId: 1
      }
    ];
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(
        laterReactionDamage
      )
    ).not.toThrow();

    const forgedWakeTuple = makeReferenceResult();
    forgedWakeTuple.targetTaskPhaseLog[0]!.eventSequence = 999;
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(
        forgedWakeTuple
      )
    ).toThrow(/first reciprocal target timeline event tuple/);
  });

  it("binds incoming event tuples for no-Aura landed hits and misses", () => {
    const noAuraLanded = makeReferenceResult();
    delete (
      noAuraLanded.config as Partial<
        typeof noAuraLanded.config
      >
    ).reactionEngine;
    noAuraLanded.targetStateTimeline.points = [
      noAuraLanded.targetStateTimeline.points[0]!,
      {
        ...noAuraLanded.targetStateTimeline.points[2]!,
        id: 1
      }
    ];
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(
        noAuraLanded
      )
    ).not.toThrow();
    noAuraLanded.targetTaskPhaseLog[0]!.eventSequence = 999;
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(
        noAuraLanded
      )
    ).toThrow(/wake hit-resolution event tuple/);

    const missed = makeReferenceResult();
    missed.hitResolutionLog[0]!.landed = false;
    missed.hitResolutionLog[0]!.damageEventId = null;
    missed.targetStateTimeline.points = [
      missed.targetStateTimeline.points[0]!,
      {
        ...missed.targetStateTimeline.points[2]!,
        id: 1
      }
    ];
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(missed)
    ).not.toThrow();
    missed.targetTaskPhaseLog[0]!.intraEventSequence = 999;
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(missed)
    ).toThrow(/wake hit-resolution event tuple/);
  });

  it("requires an event tuple on every same-frame target-phase hit", () => {
    const multiHit = makeReferenceResult();
    multiHit.targetTaskPhaseLog[0]!.hitResolutionLogIds = [
      0,
      1
    ];
    multiHit.hitResolutionLog.push({
      ...multiHit.hitResolutionLog[0]!,
      id: 1,
      intraEventSequence: 2,
      damageEventId: 1
    });
    multiHit.targetStateTimeline.points = [
      multiHit.targetStateTimeline.points[0]!,
      multiHit.targetStateTimeline.points[1]!,
      {
        ...multiHit.targetStateTimeline.points[1]!,
        id: 2,
        intraEventSequence: 2,
        primaryDamageEventId: 1,
        links: [
          { kind: "damage-event" as const, id: 1 }
        ]
      },
      {
        ...multiHit.targetStateTimeline.points[2]!,
        id: 3
      }
    ];
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(multiHit)
    ).not.toThrow();

    delete multiHit.hitResolutionLog[1]!.eventSequence;
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(multiHit)
    ).toThrow(
      /target-phase-v1 hit-resolution log 1 requires eventSequence/
    );
  });

  it("requires reaction-task ownership and a reciprocal timeline point", () => {
    const result = makeReferenceResult();
    result.targetTaskPhaseLog[0]!.reactionTaskLogIds = [0];
    result.reactionTaskLog = [
      {
        id: 0,
        frame: 15,
        timeSeconds: 15 / 60,
        targetId: "enemy-0",
        targetName: "Target",
        eventPriority: 3,
        eventSequence: 11,
        intraEventSequence: 0,
        auraBefore: [],
        auraAfter: []
      }
    ];
    result.targetStateTimeline.points = [
      result.targetStateTimeline.points[0]!,
      result.targetStateTimeline.points[1]!,
      {
        ...result.targetStateTimeline.points[1]!,
        id: 2,
        cause: "quicken-bloom-followup",
        eventType: "quickenBloomFollowup",
        eventSequence: 11,
        primaryDamageEventId: null,
        links: [
          { kind: "reaction-task-log" as const, id: 0 }
        ]
      },
      {
        ...result.targetStateTimeline.points[2]!,
        id: 3
      }
    ];
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(result)
    ).not.toThrow();

    result.targetStateTimeline.points[2]!.links = [];
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(result)
    ).toThrow(/reciprocal target timeline point/);

    const missingOwner = makeReferenceResult();
    missingOwner.reactionTaskLog = result.reactionTaskLog;
    missingOwner.targetStateTimeline =
      result.targetStateTimeline;
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(missingOwner)
    ).toThrow(/requires exactly one target phase reference/);
  });

  it("enforces Aura phase boundaries and reciprocal Burning timeline links", () => {
    const incomingMutation = makeReferenceResult();
    incomingMutation.targetTaskPhaseLog[0]!.auraAfterTasks = [
      {
        element: "pyro",
        gaugeUnits: 0.8,
        expiresAtFrame: 100
      }
    ];
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(
        incomingMutation
      )
    ).toThrow(/incoming wake cannot mutate Aura/);

    const forgedDecay = makeReferenceResult();
    forgedDecay.targetTaskPhaseLog[0]!.auraAfterDecay = [
      {
        element: "pyro",
        gaugeUnits: 0.8,
        expiresAtFrame: 100
      }
    ];
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(forgedDecay)
    ).toThrow(/decay may only decrease existing Aura/);

    const burning = makeBurningReferenceResult();
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(burning)
    ).not.toThrow();
    burning.targetStateTimeline.points[1]!.links = [];
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(burning)
    ).toThrow(/reciprocal timeline link/);

    const orphanedTick = makeBurningReferenceResult();
    orphanedTick.targetTaskPhaseLog[0]!.burningStateLogIds =
      [];
    orphanedTick.burningStateLog[0]!.eventPriority = 0.600001;
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(orphanedTick)
    ).toThrow(/requires exactly one phase reference/);

    const forgedPrePhaseAura = makeReferenceResult();
    const fabricatedPyro = {
      element: "pyro" as const,
      gaugeUnits: 0.8,
      expiresAtFrame: 15
    };
    forgedPrePhaseAura.targetTaskPhaseLog[0]!.auraBeforeTasks = [
      fabricatedPyro
    ];
    forgedPrePhaseAura.targetTaskPhaseLog[0]!.auraAfterTasks = [
      fabricatedPyro
    ];
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(
        forgedPrePhaseAura
      )
    ).toThrow(/pre-task Aura must descend/);
  });

  it("fails closed on forged current legacy identity and legacy aura-v8 before returning", () => {
    const forgedIdentity: any = makeReferenceResult();
    forgedIdentity.schemaVersion =
      EC_NEXT_TARGET_TICK_SCHEMA_VERSION;
    forgedIdentity.engineVersion = "1.40.0-forged";
    forgedIdentity.config.schemaVersion =
      EC_NEXT_TARGET_TICK_SCHEMA_VERSION;
    forgedIdentity.config.engineVersion = "1.40.0-forged";
    forgedIdentity.config.targetTaskModel = {
      mode: "legacy-event-heap-v1"
    };
    forgedIdentity.targetTaskPhaseLog = [];
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(
        forgedIdentity
      )
    ).toThrow(/exact supported schema and engine identity/);

    const legacyAuraV8: any = makeReferenceResult();
    legacyAuraV8.schemaVersion =
      EC_NEXT_TARGET_TICK_SCHEMA_VERSION;
    legacyAuraV8.engineVersion =
      EC_NEXT_TARGET_TICK_ENGINE_VERSION;
    legacyAuraV8.config.schemaVersion =
      EC_NEXT_TARGET_TICK_SCHEMA_VERSION;
    legacyAuraV8.config.engineVersion =
      EC_NEXT_TARGET_TICK_ENGINE_VERSION;
    legacyAuraV8.config.targetTaskModel = {
      mode: "legacy-event-heap-v1"
    };
    legacyAuraV8.config.reactionEngine = {
      mode: "aura-v8"
    };
    legacyAuraV8.config.timeline = {
      mode: "legal-frame-v1",
      fps: 60
    };
    legacyAuraV8.targetTaskPhaseLog = [];
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(
        legacyAuraV8
      )
    ).toThrow(/aura-v8.*requires target-phase-v2/);
  });
});

describe("1.38 target Reactable phase schema and references", () => {
  const expiringFrozenAura = [
    {
      element: "frozen" as const,
      gaugeUnits: 0.01,
      expiresAtFrame: 10,
      expiresAtTargetFrame: 10
    }
  ];

  const makeFrozenV2ReferenceResult = () => {
    const phase: TargetPhaseV2LogEntry = {
      model: "target-phase-v2",
      id: 0,
      targetId: "enemy-0",
      targetName: "Target",
      globalFrame: 10,
      timeSeconds: 10 / 60,
      targetFrame: 10,
      targetOrder: 0,
      auraBeforeTargetTasks: expiringFrozenAura,
      targetTasks: [],
      auraAfterTargetTasks: expiringFrozenAura,
      reactableTick: {
        fromTargetFrame: 0,
        toTargetFrame: 10,
        auraBefore: expiringFrozenAura,
        transitions: [
          {
            stage: "reactable-tick",
            kind: "frozen-expiry",
            order: 0,
            generation: 1,
            deadlineTargetFrame: 10,
            frozenStateLogId: 0,
            targetStateTimelinePointId: 1
          }
        ],
        auraAfter: []
      },
      hitResolutionLogIds: [],
      reactionTaskLogIds: []
    };
    return {
      schemaVersion: TARGET_REACTABLE_PHASE_SCHEMA_VERSION,
      engineVersion: TARGET_REACTABLE_PHASE_ENGINE_VERSION,
      config: {
        schemaVersion: TARGET_REACTABLE_PHASE_SCHEMA_VERSION,
        engineVersion: TARGET_REACTABLE_PHASE_ENGINE_VERSION,
        targetTaskModel: { mode: "target-phase-v2" as const },
        targetClockModel: { mode: "disabled" as const },
        timeline: {
          mode: "legal-frame-v1" as const,
          fps: 60 as const
        },
        reactionEngine: { mode: "aura-v7" }
      },
      enemyTargets: [{ id: "enemy-0", name: "Target" }],
      targetClockAudit: { mode: "disabled" as const },
      targetClockLog: [],
      targetTaskPhaseLog: [],
      targetPhaseLog: [phase],
      burningStateLog: [],
      frozenStateLog: [
        {
          id: 0,
          generation: 1,
          operation: "expire" as const,
          frame: 10,
          targetFrame: 10,
          timeSeconds: 10 / 60,
          targetId: "enemy-0",
          targetName: "Target",
          auraBefore: expiringFrozenAura,
          auraAfter: [],
          reason: "FROZEN_DECAY_EXPIRED"
        }
      ],
      quickenStateLog: [],
      periodicReactionLog: [],
      hitResolutionLog: [],
      reactionTaskLog: [],
      targetStateTimeline: {
        version: "1.0.0" as const,
        points: [
          {
            id: 0,
            frame: 0,
            targetFrame: 0,
            timeSeconds: 0,
            targetId: "enemy-0",
            targetName: "Target",
            pointKind: "boundary" as const,
            cause: "simulation-start" as const,
            eventType: null,
            eventPriority: null,
            eventSequence: null,
            intraEventSequence: null,
            reaction: "none" as const,
            reactions: [],
            primaryDamageEventId: null,
            links: [],
            auraBefore: expiringFrozenAura,
            auraApplied: [],
            auraConsumed: [],
            auraAfter: expiringFrozenAura
          },
          {
            id: 1,
            frame: 10,
            targetFrame: 10,
            timeSeconds: 10 / 60,
            targetId: "enemy-0",
            targetName: "Target",
            pointKind: "mutation" as const,
            cause: "frozen-expiry" as const,
            eventType: "frozenExpiry" as const,
            eventPriority: 0.5,
            eventSequence: 1,
            intraEventSequence: 0,
            reaction: "none" as const,
            reactions: [],
            primaryDamageEventId: null,
            links: [
              { kind: "frozen-state-log" as const, id: 0 }
            ],
            auraBefore: expiringFrozenAura,
            auraApplied: [],
            auraConsumed: [],
            auraAfter: []
          },
          {
            id: 2,
            frame: 60,
            targetFrame: 60,
            timeSeconds: 1,
            targetId: "enemy-0",
            targetName: "Target",
            pointKind: "boundary" as const,
            cause: "simulation-end" as const,
            eventType: null,
            eventPriority: null,
            eventSequence: null,
            intraEventSequence: null,
            reaction: "none" as const,
            reactions: [],
            primaryDamageEventId: null,
            links: [],
            auraBefore: [],
            auraApplied: [],
            auraConsumed: [],
            auraAfter: []
          }
        ]
      }
    };
  };

  const makeLifecycleFixture = (
    kind:
      | "aura-natural-expiry"
      | "quicken-expiry"
      | "burning-fuel-expiry"
      | "electro-charged-expiry"
  ): any => {
    const result: any = structuredClone(
      makeFrozenV2ReferenceResult()
    );
    const phase = result.targetPhaseLog[0];
    const point = result.targetStateTimeline.points[1];
    result.frozenStateLog = [];
    const setLifecycleAura = (aura: any[]): void => {
      const snapshot = structuredClone(aura);
      result.targetStateTimeline.points[0].auraBefore =
        structuredClone(snapshot);
      result.targetStateTimeline.points[0].auraAfter =
        structuredClone(snapshot);
      phase.auraBeforeTargetTasks = structuredClone(snapshot);
      phase.auraAfterTargetTasks = structuredClone(snapshot);
      phase.reactableTick.auraBefore =
        structuredClone(snapshot);
      phase.reactableTick.auraAfter = [];
      point.auraBefore = structuredClone(snapshot);
      point.auraAfter = [];
    };
    if (kind === "aura-natural-expiry") {
      const aura = [
        {
          element: "pyro",
          gaugeUnits: 0.01,
          expiresAtFrame: 10,
          expiresAtTargetFrame: 10
        }
      ];
      setLifecycleAura(aura);
      phase.reactableTick.transitions = [
        {
          stage: "reactable-tick",
          kind,
          order: 0,
          deadlineTargetFrame: 10,
          targetStateTimelinePointId: 1
        }
      ];
      point.pointKind = "derived";
      point.cause = "aura-natural-expiry";
      point.eventType = null;
      point.eventPriority = null;
      point.eventSequence = null;
      point.intraEventSequence = null;
      point.links = [];
      return result;
    }
    if (kind === "quicken-expiry") {
      const aura = [
        {
          element: "quicken",
          gaugeUnits: 0.01,
          expiresAtFrame: 10,
          expiresAtTargetFrame: 10
        }
      ];
      setLifecycleAura(aura);
      phase.reactableTick.transitions = [
        {
          stage: "reactable-tick",
          kind,
          order: 0,
          generation: 3,
          deadlineTargetFrame: 10,
          quickenStateLogId: 0,
          targetStateTimelinePointId: 1
        }
      ];
      point.cause = "quicken-expiry";
      point.eventType = "quickenExpiry";
      point.links = [{ kind: "quicken-state-log", id: 0 }];
      result.quickenStateLog = [
        {
          id: 0,
          generation: 3,
          operation: "expire",
          frame: 10,
          targetFrame: 10,
          timeSeconds: 10 / 60,
          targetId: "enemy-0",
          targetName: "Target",
          auraBefore: structuredClone(aura),
          auraAfter: [],
          reason: "QUICKEN_DECAY_EXPIRED"
        }
      ];
      return result;
    }
    if (kind === "burning-fuel-expiry") {
      const aura = [
        {
          element: "burning",
          gaugeUnits: 2,
          expiresAtFrame: null,
          expiresAtTargetFrame: null
        },
        {
          element: "burningFuel",
          gaugeUnits: 0.01,
          expiresAtFrame: 10,
          expiresAtTargetFrame: 10
        }
      ];
      setLifecycleAura(aura);
      phase.reactableTick.transitions = [
        {
          stage: "reactable-tick",
          kind,
          order: 0,
          generation: 4,
          deadlineTargetFrame: 10,
          burningStateLogId: 0,
          quickenStateLogIds: [],
          targetStateTimelinePointId: 1
        }
      ];
      point.cause = "burning-fuel-expiry";
      point.eventType = "burningFuelExpiry";
      point.links = [{ kind: "burning-state-log", id: 0 }];
      result.burningStateLog = [
        {
          id: 0,
          generation: 4,
          operation: "fuel-expire",
          frame: 10,
          targetFrame: 10,
          timeSeconds: 10 / 60,
          eventPriority: 0.5,
          eventSequence: 1,
          targetId: "enemy-0",
          targetName: "Target",
          tickIndex: null,
          auraBefore: structuredClone(aura),
          auraAfter: [],
          reason: "FUEL_EXPIRED"
        }
      ];
      return result;
    }
    const coexistenceAura = [
      {
        element: "electro",
        gaugeUnits: 0.01,
        expiresAtFrame: 10,
        expiresAtTargetFrame: 10
      },
      {
        element: "hydro",
        gaugeUnits: 0.01,
        expiresAtFrame: 10,
        expiresAtTargetFrame: 10
      }
    ];
    setLifecycleAura(coexistenceAura);
    phase.reactableTick.transitions = [
      {
        stage: "reactable-tick",
        kind: "aura-natural-expiry",
        order: 0,
        deadlineTargetFrame: 10,
        targetStateTimelinePointId: 1
      },
      {
        stage: "reactable-tick",
        kind,
        order: 1,
        generation: 5,
        deadlineTargetFrame: 10,
        periodicReactionLogId: 0,
        targetStateTimelinePointId: 2
      }
    ];
    point.pointKind = "derived";
    point.cause = "aura-natural-expiry";
    point.eventType = null;
    point.eventPriority = null;
    point.eventSequence = null;
    point.intraEventSequence = null;
    point.links = [];
    const electroChargedPoint = {
      ...structuredClone(point),
      id: 2,
      pointKind: "observation",
      cause: "electro-charged-expiry",
      eventType: "periodicReactionExpiry",
      eventPriority: 0.5,
      eventSequence: 1,
      intraEventSequence: 0,
      links: [
      { kind: "periodic-reaction-log", id: 0 }
      ],
      auraBefore: [],
      auraAfter: []
    };
    result.targetStateTimeline.points[2].id = 3;
    result.targetStateTimeline.points.splice(
      2,
      0,
      electroChargedPoint
    );
    result.periodicReactionLog = [
      {
        id: 0,
        reaction: "electroCharged",
        generation: 5,
        operation: "stop",
        frame: 10,
        targetFrame: 10,
        timeSeconds: 10 / 60,
        targetId: "enemy-0",
        targetName: "Target",
        auraBefore: [],
        auraAfter: [],
        reason: "AURA_DECAY_EXPIRED"
      }
    ];
    return result;
  };

  const makeBridgeV2ReferenceResult = (): any => {
    const initialAura = [
      {
        element: "pyro",
        gaugeUnits: 1,
        expiresAtFrame: 50,
        expiresAtTargetFrame: 50
      }
    ];
    const beforeTasks = [
      {
        ...initialAura[0],
        gaugeUnits: 0.9
      }
    ];
    const afterDecay = [
      {
        ...initialAura[0],
        gaugeUnits: 0.8
      }
    ];
    const result: any = structuredClone(
      makeFrozenV2ReferenceResult()
    );
    result.frozenStateLog = [];
    result.targetPhaseLog[0] = {
      model: "target-phase-v2",
      id: 0,
      targetId: "enemy-0",
      targetName: "Target",
      globalFrame: 10,
      timeSeconds: 10 / 60,
      targetFrame: 10,
      targetOrder: 0,
      auraBeforeTargetTasks: structuredClone(beforeTasks),
      targetTasks: [
        {
          stage: "target-task",
          kind: "burning-tick",
          order: 0,
          eventType: "burningTick",
          eventPriority: 0.5,
          eventSequence: 1,
          intraEventSequence: 0,
          generation: 1,
          tickIndex: 1,
          deadlineTargetFrame: 10,
          status: "stale",
          burningStateLogId: null,
          targetStateTimelinePointId: 1
        }
      ],
      auraAfterTargetTasks: structuredClone(beforeTasks),
      reactableTick: {
        fromTargetFrame: 0,
        toTargetFrame: 10,
        auraBefore: structuredClone(afterDecay),
        transitions: [],
        auraAfter: structuredClone(afterDecay)
      },
      hitResolutionLogIds: [],
      reactionTaskLogIds: []
    };
    result.targetStateTimeline.points = [
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
        auraBefore: structuredClone(initialAura),
        auraApplied: [],
        auraConsumed: [],
        auraAfter: structuredClone(initialAura)
      },
      {
        id: 1,
        frame: 10,
        targetFrame: 10,
        timeSeconds: 10 / 60,
        targetId: "enemy-0",
        targetName: "Target",
        pointKind: "observation",
        cause: "burning-tick",
        eventType: "burningTick",
        eventPriority: 0.5,
        eventSequence: 1,
        intraEventSequence: 0,
        reaction: "none",
        reactions: [],
        primaryDamageEventId: null,
        links: [],
        auraBefore: structuredClone(beforeTasks),
        auraApplied: [],
        auraConsumed: [],
        auraAfter: structuredClone(beforeTasks)
      },
      {
        id: 2,
        frame: 10,
        targetFrame: 10,
        timeSeconds: 10 / 60,
        targetId: "enemy-0",
        targetName: "Target",
        pointKind: "observation",
        cause: "direct-hit-application",
        eventType: "hit",
        eventPriority: 3,
        eventSequence: 2,
        intraEventSequence: 0,
        reaction: "none",
        reactions: [],
        primaryDamageEventId: null,
        links: [{ kind: "target-phase-log", id: 0 }],
        auraBefore: structuredClone(afterDecay),
        auraApplied: [],
        auraConsumed: [],
        auraAfter: structuredClone(afterDecay)
      },
      {
        id: 3,
        frame: 60,
        targetFrame: 60,
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
    ];
    return result;
  };

  const makeAppliedBurningBridgeResult = (): any => {
    const result = makeBridgeV2ReferenceResult();
    const phase = result.targetPhaseLog[0];
    const task = phase.targetTasks[0];
    const point = result.targetStateTimeline.points[1];
    task.status = "applied";
    task.burningStateLogId = 0;
    point.links = [{ kind: "burning-state-log", id: 0 }];
    result.burningStateLog = [
      {
        id: 0,
        generation: task.generation,
        operation: "tick",
        frame: phase.globalFrame,
        targetFrame: phase.targetFrame,
        timeSeconds: phase.timeSeconds,
        eventPriority: task.eventPriority,
        eventSequence: task.eventSequence,
        targetId: phase.targetId,
        targetName: phase.targetName,
        tickIndex: task.tickIndex,
        callbackAuraBefore: structuredClone(
          point.auraBefore
        ),
        callbackAuraAfter: structuredClone(
          point.auraAfter
        ),
        auraBefore: [],
        auraAfter: [],
        reason: null
      }
    ];
    return result;
  };

  it("strictly validates v2 target tasks, transitions, entries, and deterministic logs", () => {
    const appliedTask = {
      stage: "target-task" as const,
      kind: "burning-tick" as const,
      order: 0,
      eventType: "burningTick" as const,
      eventPriority: 0.5,
      eventSequence: 1,
      intraEventSequence: 0,
      generation: 1,
      tickIndex: 1,
      deadlineTargetFrame: 10,
      status: "applied" as const,
      burningStateLogId: 0,
      targetStateTimelinePointId: 1
    };
    expect(
      targetPhaseV2TargetTaskSchema.parse(appliedTask)
    ).toEqual(appliedTask);
    expect(() =>
      targetPhaseV2TargetTaskSchema.parse({
        ...appliedTask,
        burningStateLogId: null
      })
    ).toThrow(/applied Burning target tasks require/);
    for (const forgedTask of [
      {
        ...appliedTask,
        kind: "quicken-bloom-followup"
      },
      {
        ...appliedTask,
        eventType: "periodicReactionTick"
      },
      {
        ...appliedTask,
        unversionedField: true
      }
    ]) {
      expect(() =>
        targetPhaseV2TargetTaskSchema.parse(forgedTask)
      ).toThrow();
    }
    expect(() =>
      targetLifecycleTransitionSchema.parse({
        stage: "reactable-tick",
        kind: "electro-charged-tick",
        order: 0,
        deadlineTargetFrame: 10,
        periodicReactionLogId: 0,
        targetStateTimelinePointId: 1
      })
    ).toThrow();

    const result = makeFrozenV2ReferenceResult();
    const phase = result.targetPhaseLog[0]!;
    expect(targetPhaseV2LogEntrySchema.parse(phase)).toEqual(
      phase
    );
    expect(targetPhaseV2LogSchema.parse([phase])).toEqual([
      phase
    ]);
    expect(() =>
      targetPhaseV2LogEntrySchema.parse({
        ...phase,
        unversionedField: true
      })
    ).toThrow(/Unrecognized key/);
    expect(() =>
      targetPhaseV2LogEntrySchema.parse({
        ...phase,
        reactableTick: {
          ...phase.reactableTick,
          transitions: [
            phase.reactableTick.transitions[0],
            {
              stage: "reactable-tick",
              kind: "aura-natural-expiry",
              order: 1,
              deadlineTargetFrame: 10,
              targetStateTimelinePointId: 2
            }
          ]
        }
      })
    ).toThrow(/must be unique and follow natural Aura/);
  });

  it("strictly validates v3 Burning delivery attempts without imposing v2 same-target Aura continuity", () => {
    const delivery = {
      model: "burning-callback-zero-delay-v1" as const,
      reactionDamageLogId: 0,
      eventPriority: 5,
      eventSequence: 2,
      attempts: [
        {
          order: 0,
          targetId: "enemy-0",
          targetOrder: 0,
          applicationPhase: "before-reactable-tick" as const,
          outcome: "landed" as const,
          hitResolutionLogId: 0,
          damageEventId: 0,
          targetStateTimelinePointId: 2
        },
        {
          order: 1,
          targetId: "enemy-1",
          targetOrder: 1,
          applicationPhase: "after-reactable-tick" as const,
          outcome: "unresolved" as const,
          hitResolutionLogId: null,
          damageEventId: null,
          targetStateTimelinePointId: null
        }
      ]
    };
    expect(targetPhaseV3DeliverySchema.parse(delivery)).toEqual(
      delivery
    );
    expect(
      targetPhaseV3DeliveryAttemptSchema.parse({
        ...delivery.attempts[0],
        outcome: "miss",
        damageEventId: null,
        targetStateTimelinePointId: null
      })
    ).toMatchObject({ outcome: "miss" });
    expect(() =>
      targetPhaseV3DeliveryAttemptSchema.parse({
        ...delivery.attempts[0],
        outcome: "unresolved",
        hitResolutionLogId: 0,
        damageEventId: null,
        targetStateTimelinePointId: null
      })
    ).toThrow();
    expect(() =>
      targetPhaseV3DeliverySchema.parse({
        ...delivery,
        attempts: [
          delivery.attempts[0],
          {
            ...delivery.attempts[1],
            order: 0,
            targetId: "enemy-0"
          }
        ]
      })
    ).toThrow(/order must be contiguous|same target twice/);

    const appliedTask = {
      stage: "target-task" as const,
      kind: "burning-tick" as const,
      order: 0,
      eventType: "burningTick" as const,
      eventPriority: 0.5,
      eventSequence: 1,
      intraEventSequence: 0,
      generation: 1,
      tickIndex: 1,
      deadlineTargetFrame: 10,
      status: "applied" as const,
      burningStateLogId: 0,
      targetStateTimelinePointId: 1,
      delivery
    };
    expect(targetPhaseV3TargetTaskSchema.parse(appliedTask)).toEqual(
      appliedTask
    );
    expect(
      targetPhaseV3TargetTaskSchema.parse({
        ...appliedTask,
        delivery: null
      })
    ).toMatchObject({ status: "applied", delivery: null });

    const phase = structuredClone(
      makeBridgeV2ReferenceResult().targetPhaseLog[0]
    );
    phase.model = "target-phase-v3";
    phase.targetTasks = phase.targetTasks.map((task: object) => ({
      ...task,
      delivery: null
    }));
    phase.reactableTick.auraBefore = [
      ...phase.reactableTick.auraBefore,
      {
        element: "hydro",
        gaugeUnits: 0.2,
        expiresAtFrame: 50,
        expiresAtTargetFrame: 50
      }
    ];
    phase.reactableTick.auraAfter = structuredClone(
      phase.reactableTick.auraBefore
    );
    expect(targetPhaseV3LogEntrySchema.parse(phase)).toEqual(phase);
    expect(targetPhaseV3LogSchema.parse([phase])).toEqual([phase]);
    expect(() =>
      targetPhaseV3LogEntrySchema.parse({
        ...phase,
        timeSeconds: 0
      })
    ).toThrow(/globalFrame \/ 60/);
  });

  it("proves sparse and same-target-frame ordinary decay through one reciprocal phase bridge", () => {
    const result = makeBridgeV2ReferenceResult();
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(result)
    ).not.toThrow();

    const missingBridge = makeBridgeV2ReferenceResult();
    missingBridge.targetStateTimeline.points[2].links = [];
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        missingBridge
      )
    ).toThrow(/timeline is discontinuous/);

    const phaseOnlyMissingBridge =
      makeBridgeV2ReferenceResult();
    const authoritativeAura = structuredClone(
      phaseOnlyMissingBridge.targetPhaseLog[0]
        .auraAfterTargetTasks
    );
    phaseOnlyMissingBridge.targetStateTimeline.points[2].links =
      [];
    phaseOnlyMissingBridge.targetStateTimeline.points[2].auraBefore =
      structuredClone(authoritativeAura);
    phaseOnlyMissingBridge.targetStateTimeline.points[2].auraAfter =
      structuredClone(authoritativeAura);
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        phaseOnlyMissingBridge
      )
    ).toThrow(
      /ordinary-decay gap requires exactly one reciprocal target-phase timeline bridge/
    );

    const noGapNeedsNoBridge =
      makeBridgeV2ReferenceResult();
    noGapNeedsNoBridge.targetPhaseLog[0].reactableTick.auraBefore =
      structuredClone(authoritativeAura);
    noGapNeedsNoBridge.targetPhaseLog[0].reactableTick.auraAfter =
      structuredClone(authoritativeAura);
    noGapNeedsNoBridge.targetStateTimeline.points[2].links = [];
    noGapNeedsNoBridge.targetStateTimeline.points[2].auraBefore =
      structuredClone(authoritativeAura);
    noGapNeedsNoBridge.targetStateTimeline.points[2].auraAfter =
      structuredClone(authoritativeAura);
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        noGapNeedsNoBridge
      )
    ).not.toThrow();

    const danglingBridge = makeBridgeV2ReferenceResult();
    danglingBridge.targetStateTimeline.points[2].links[0].id =
      999;
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        danglingBridge
      )
    ).toThrow(/missing target phase 999/);

    const wrongTargetFrame = makeBridgeV2ReferenceResult();
    wrongTargetFrame.targetStateTimeline.points[2].targetFrame =
      9;
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        wrongTargetFrame
      )
    ).toThrow(
      /must match its phase target, global frame, and target frame/
    );

    const duplicateBridge = makeBridgeV2ReferenceResult();
    const secondBridgePoint = structuredClone(
      duplicateBridge.targetStateTimeline.points[2]
    );
    secondBridgePoint.id = 3;
    secondBridgePoint.eventSequence = 3;
    secondBridgePoint.auraBefore = [
      {
        ...secondBridgePoint.auraBefore[0],
        gaugeUnits: 0.7
      }
    ];
    secondBridgePoint.auraAfter =
      secondBridgePoint.auraBefore;
    duplicateBridge.targetStateTimeline.points[3].id = 4;
    duplicateBridge.targetStateTimeline.points.splice(
      3,
      0,
      secondBridgePoint
    );
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        duplicateBridge
      )
    ).toThrow(/bridged by both timeline points/);

    const unnecessaryBridge = makeBridgeV2ReferenceResult();
    const exactAura =
      unnecessaryBridge.targetPhaseLog[0]
        .auraAfterTargetTasks;
    unnecessaryBridge.targetPhaseLog[0].reactableTick.auraBefore =
      exactAura;
    unnecessaryBridge.targetPhaseLog[0].reactableTick.auraAfter =
      exactAura;
    unnecessaryBridge.targetStateTimeline.points[2].auraBefore =
      exactAura;
    unnecessaryBridge.targetStateTimeline.points[2].auraAfter =
      exactAura;
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        unnecessaryBridge
      )
    ).toThrow(/requires an actual Aura continuity gap/);
  });

  it("rejects fabricated Aura across sparse phases and ordinary-decay bridges", () => {
    const addedAura = makeBridgeV2ReferenceResult();
    const fabricatedHydro = {
      element: "hydro",
      gaugeUnits: 0.2,
      expiresAtFrame: 50,
      expiresAtTargetFrame: 50
    };
    addedAura.targetPhaseLog[0].reactableTick.auraBefore = [
      ...addedAura.targetPhaseLog[0].reactableTick.auraBefore,
      fabricatedHydro
    ];
    addedAura.targetPhaseLog[0].reactableTick.auraAfter =
      structuredClone(
        addedAura.targetPhaseLog[0].reactableTick.auraBefore
      );
    addedAura.targetStateTimeline.points[2].auraBefore =
      structuredClone(
        addedAura.targetPhaseLog[0].reactableTick.auraBefore
      );
    addedAura.targetStateTimeline.points[2].auraAfter =
      structuredClone(
        addedAura.targetPhaseLog[0].reactableTick.auraBefore
      );
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(addedAura)
    ).toThrow(/cannot add hydro/);

    const increasedAura = makeBridgeV2ReferenceResult();
    increasedAura.targetPhaseLog[0].reactableTick
      .auraBefore[0].gaugeUnits = 1;
    increasedAura.targetPhaseLog[0].reactableTick
      .auraAfter[0].gaugeUnits = 1;
    increasedAura.targetStateTimeline.points[2]
      .auraBefore[0].gaugeUnits = 1;
    increasedAura.targetStateTimeline.points[2]
      .auraAfter[0].gaugeUnits = 1;
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        increasedAura
      )
    ).toThrow(/cannot increase pyro durability/);

    const extendedDeadline = makeBridgeV2ReferenceResult();
    for (const aura of [
      extendedDeadline.targetPhaseLog[0].reactableTick
        .auraBefore[0],
      extendedDeadline.targetPhaseLog[0].reactableTick
        .auraAfter[0],
      extendedDeadline.targetStateTimeline.points[2]
        .auraBefore[0],
      extendedDeadline.targetStateTimeline.points[2]
        .auraAfter[0]
    ]) {
      aura.expiresAtFrame = 55;
      aura.expiresAtTargetFrame = 55;
    }
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        extendedDeadline
      )
    ).toThrow(/cannot extend pyro/);

    const removedAtDeadline =
      makeBridgeV2ReferenceResult();
    removedAtDeadline.targetPhaseLog[0].reactableTick.auraBefore =
      [];
    removedAtDeadline.targetPhaseLog[0].reactableTick.auraAfter =
      [];
    removedAtDeadline.targetStateTimeline.points[2].auraBefore =
      [];
    removedAtDeadline.targetStateTimeline.points[2].auraAfter =
      [];
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        removedAtDeadline
      )
    ).toThrow(
      /cannot remove pyro without a typed lifecycle transition/
    );

    const removedSourceOwner =
      makeBridgeV2ReferenceResult();
    for (const aura of [
      removedSourceOwner.targetPhaseLog[0]
        .auraBeforeTargetTasks[0],
      removedSourceOwner.targetPhaseLog[0]
        .auraAfterTargetTasks[0],
      removedSourceOwner.targetStateTimeline.points[0]
        .auraBefore[0],
      removedSourceOwner.targetStateTimeline.points[0]
        .auraAfter[0],
      removedSourceOwner.targetStateTimeline.points[1]
        .auraBefore[0],
      removedSourceOwner.targetStateTimeline.points[1]
        .auraAfter[0]
    ]) {
      aura.sourceSlots = [
        {
          sourceActorId: "primary",
          gaugeUnits: aura.gaugeUnits
        },
        {
          sourceActorId: "vanishing",
          gaugeUnits: 0.05
        }
      ];
    }
    for (const aura of [
      removedSourceOwner.targetPhaseLog[0].reactableTick
        .auraBefore[0],
      removedSourceOwner.targetPhaseLog[0].reactableTick
        .auraAfter[0],
      removedSourceOwner.targetStateTimeline.points[2]
        .auraBefore[0],
      removedSourceOwner.targetStateTimeline.points[2]
        .auraAfter[0]
    ]) {
      aura.sourceSlots = [
        {
          sourceActorId: "primary",
          gaugeUnits: aura.gaugeUnits
        }
      ];
    }
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        removedSourceOwner
      )
    ).not.toThrow();

    const addedSourceOwner =
      makeBridgeV2ReferenceResult();
    for (const aura of [
      addedSourceOwner.targetPhaseLog[0]
        .auraBeforeTargetTasks[0],
      addedSourceOwner.targetPhaseLog[0]
        .auraAfterTargetTasks[0],
      addedSourceOwner.targetStateTimeline.points[0]
        .auraBefore[0],
      addedSourceOwner.targetStateTimeline.points[0]
        .auraAfter[0],
      addedSourceOwner.targetStateTimeline.points[1]
        .auraBefore[0],
      addedSourceOwner.targetStateTimeline.points[1]
        .auraAfter[0]
    ]) {
      aura.sourceSlots = [
        {
          sourceActorId: "primary",
          gaugeUnits: aura.gaugeUnits
        }
      ];
    }
    for (const aura of [
      addedSourceOwner.targetPhaseLog[0].reactableTick
        .auraBefore[0],
      addedSourceOwner.targetPhaseLog[0].reactableTick
        .auraAfter[0],
      addedSourceOwner.targetStateTimeline.points[2]
        .auraBefore[0],
      addedSourceOwner.targetStateTimeline.points[2]
        .auraAfter[0]
    ]) {
      aura.sourceSlots = [
        {
          sourceActorId: "primary",
          gaugeUnits: aura.gaugeUnits
        },
        {
          sourceActorId: "fabricated",
          gaugeUnits: 0.1
        }
      ];
    }
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        addedSourceOwner
      )
    ).toThrow(/cannot add pyro source owner fabricated/);

    const increasedSourceGauge =
      makeBridgeV2ReferenceResult();
    for (const aura of [
      increasedSourceGauge.targetPhaseLog[0]
        .auraBeforeTargetTasks[0],
      increasedSourceGauge.targetPhaseLog[0]
        .auraAfterTargetTasks[0],
      increasedSourceGauge.targetStateTimeline.points[0]
        .auraBefore[0],
      increasedSourceGauge.targetStateTimeline.points[0]
        .auraAfter[0],
      increasedSourceGauge.targetStateTimeline.points[1]
        .auraBefore[0],
      increasedSourceGauge.targetStateTimeline.points[1]
        .auraAfter[0]
    ]) {
      aura.sourceSlots = [
        {
          sourceActorId: "primary",
          gaugeUnits: aura.gaugeUnits
        },
        {
          sourceActorId: "secondary",
          gaugeUnits: 0.2
        }
      ];
    }
    for (const aura of [
      increasedSourceGauge.targetPhaseLog[0].reactableTick
        .auraBefore[0],
      increasedSourceGauge.targetPhaseLog[0].reactableTick
        .auraAfter[0],
      increasedSourceGauge.targetStateTimeline.points[2]
        .auraBefore[0],
      increasedSourceGauge.targetStateTimeline.points[2]
        .auraAfter[0]
    ]) {
      aura.sourceSlots = [
        {
          sourceActorId: "primary",
          gaugeUnits: aura.gaugeUnits
        },
        {
          sourceActorId: "secondary",
          gaugeUnits: 0.3
        }
      ];
    }
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        increasedSourceGauge
      )
    ).toThrow(/cannot increase pyro source slot secondary/);

    const wrongRightEndpoint = makeBridgeV2ReferenceResult();
    wrongRightEndpoint.targetStateTimeline.points[2]
      .auraBefore[0].gaugeUnits = 0.7;
    wrongRightEndpoint.targetStateTimeline.points[2]
      .auraAfter[0].gaugeUnits = 0.7;
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        wrongRightEndpoint
      )
    ).toThrow(/right endpoint must equal/);

    const wrongLeftEndpoint = makeBridgeV2ReferenceResult();
    wrongLeftEndpoint.targetStateTimeline.points[1]
      .auraBefore[0].gaugeUnits = 0.85;
    wrongLeftEndpoint.targetStateTimeline.points[1]
      .auraAfter[0].gaugeUnits = 0.85;
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        wrongLeftEndpoint
      )
    ).toThrow(/left endpoint must equal/);

    const fabricatedSparseAura = makeBridgeV2ReferenceResult();
    fabricatedSparseAura.targetPhaseLog[0]
      .auraBeforeTargetTasks.push(fabricatedHydro);
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        fabricatedSparseAura
      )
    ).toThrow(/sparse clock advance may only decrease/);
  });

  it("forbids target-phase-v2 timeline bridges in legacy and frozen-v1 output", () => {
    for (const mode of [
      "legacy-event-heap-v1",
      "target-phase-v1"
    ] as const) {
      const result = makeBridgeV2ReferenceResult();
      result.config.targetTaskModel = { mode };
      result.targetPhaseLog = [];
      expect(() =>
        targetPhaseV2ResultReferencesSchema.parse(result)
      ).toThrow(/cannot carry target-phase-v2 timeline bridges/);
      expect(() =>
        targetTaskPhaseResultReferencesSchema.parse(result)
      ).toThrow(/cannot carry target-phase-v2 timeline bridges/);
    }
  });

  it("binds v2 Burning callback Aura separately from later global application Aura", () => {
    const result = makeAppliedBurningBridgeResult();
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(result)
    ).not.toThrow();

    const missingCallback = makeAppliedBurningBridgeResult();
    delete missingCallback.burningStateLog[0]
      .callbackAuraBefore;
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        missingCallback
      )
    ).toThrow(/does not match its target task/);

    const forgedCallback = makeAppliedBurningBridgeResult();
    forgedCallback.burningStateLog[0].callbackAuraAfter[0]
      .gaugeUnits = 0.1;
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        forgedCallback
      )
    ).toThrow(/does not match its target task/);

    for (const mode of [
      "legacy-event-heap-v1",
      "target-phase-v1"
    ] as const) {
      const historical: any =
        makeFrozenV2ReferenceResult();
      historical.config.targetTaskModel = { mode };
      historical.targetPhaseLog = [];
      historical.burningStateLog = structuredClone(
        result.burningStateLog
      );
      expect(() =>
        targetPhaseV2ResultReferencesSchema.parse(historical)
      ).toThrow(/must omit callback Aura|cannot carry.*callback Aura/);
      expect(() =>
        targetTaskPhaseResultReferencesSchema.parse(historical)
      ).toThrow(/cannot carry.*callback Aura/);
    }
  });

  it("fails closed when an exact 1.44 standalone v2 projection omits current fields", () => {
    const makeExact144V2 = (): any => {
      const result: any = structuredClone(
        makeFrozenV2ReferenceResult()
      );
      result.schemaVersion =
        BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION;
      result.engineVersion =
        BURNING_CALLBACK_DELIVERY_ENGINE_VERSION;
      result.config.schemaVersion =
        BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION;
      result.config.engineVersion =
        BURNING_CALLBACK_DELIVERY_ENGINE_VERSION;
      result.config.electroChargedPropagationModel = {
        mode: "single-target-v1"
      };
      return result;
    };

    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        makeExact144V2()
      )
    ).not.toThrow();

    for (const field of [
      "targetPhaseLog",
      "targetTaskPhaseLog"
    ] as const) {
      const missing = makeExact144V2();
      delete missing[field];
      const parsed =
        targetPhaseV2ResultReferencesSchema.safeParse(missing);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(
          parsed.error.issues.some(
            (issue) => issue.path.join(".") === field
          )
        ).toBe(true);
      }
    }

    const missingTargetTaskModel = makeExact144V2();
    delete missingTargetTaskModel.config.targetTaskModel;
    const missingTargetTaskModelResult =
      targetPhaseV2ResultReferencesSchema.safeParse(
        missingTargetTaskModel
      );
    expect(missingTargetTaskModelResult.success).toBe(false);
    if (!missingTargetTaskModelResult.success) {
      expect(
        missingTargetTaskModelResult.error.issues.some(
          (issue) =>
            issue.path.join(".") ===
            "config.targetTaskModel"
        )
      ).toBe(true);
    }

    const v3 = makeExact144V2();
    v3.config.targetTaskModel = { mode: "target-phase-v3" };
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(v3)
    ).toThrow(/only validates target-phase-v2/);

    const historicalV3: any = structuredClone(
      makeFrozenV2ReferenceResult()
    );
    historicalV3.config.targetTaskModel = {
      mode: "target-phase-v3"
    };
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(historicalV3)
    ).toThrow(/only validates target-phase-v2/);
  });

  it("accepts all five typed lifecycle mappings and exact reciprocal links", () => {
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        makeFrozenV2ReferenceResult()
      )
    ).not.toThrow();
    const frozen139Identity: any =
      makeFrozenV2ReferenceResult();
    frozen139Identity.schemaVersion =
      SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION;
    frozen139Identity.engineVersion =
      SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION;
    frozen139Identity.config.schemaVersion =
      SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION;
    frozen139Identity.config.engineVersion =
      SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION;
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(frozen139Identity)
    ).not.toThrow();

    const currentIdentity: any =
      makeFrozenV2ReferenceResult();
    currentIdentity.schemaVersion =
      EC_NEXT_TARGET_TICK_SCHEMA_VERSION;
    currentIdentity.engineVersion =
      EC_NEXT_TARGET_TICK_ENGINE_VERSION;
    currentIdentity.config.schemaVersion =
      EC_NEXT_TARGET_TICK_SCHEMA_VERSION;
    currentIdentity.config.engineVersion =
      EC_NEXT_TARGET_TICK_ENGINE_VERSION;
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(currentIdentity)
    ).not.toThrow();
    currentIdentity.config.reactionEngine = {
      mode: "aura-v8"
    };
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(currentIdentity)
    ).not.toThrow();

    const forgedHistoricalAuraV8: any =
      makeFrozenV2ReferenceResult();
    forgedHistoricalAuraV8.config.reactionEngine = {
      mode: "aura-v8"
    };
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        forgedHistoricalAuraV8
      )
    ).toThrow(/aura-v8.*exact 1\.40/);

    const mixedIdentity: any =
      makeFrozenV2ReferenceResult();
    mixedIdentity.schemaVersion =
      SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION;
    mixedIdentity.engineVersion =
      SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION;
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(mixedIdentity)
    ).toThrow(
      /schemaVersion must match|engineVersion must match|exact supported 1\.38, 1\.39, or 1\.40/
    );
    for (const kind of [
      "aura-natural-expiry",
      "quicken-expiry",
      "burning-fuel-expiry",
      "electro-charged-expiry"
    ] as const) {
      expect(() =>
        targetPhaseV2ResultReferencesSchema.parse(
          makeLifecycleFixture(kind)
        )
      ).not.toThrow();
    }

    const fuelWithQuicken = makeLifecycleFixture(
      "burning-fuel-expiry"
    );
    const dependentQuicken = {
      element: "quicken",
      gaugeUnits: 0.02,
      expiresAtFrame: 10,
      expiresAtTargetFrame: 10
    };
    for (const snapshot of [
      fuelWithQuicken.targetStateTimeline.points[0]
        .auraBefore,
      fuelWithQuicken.targetStateTimeline.points[0]
        .auraAfter,
      fuelWithQuicken.targetPhaseLog[0]
        .auraBeforeTargetTasks,
      fuelWithQuicken.targetPhaseLog[0]
        .auraAfterTargetTasks,
      fuelWithQuicken.targetPhaseLog[0].reactableTick
        .auraBefore,
      fuelWithQuicken.targetStateTimeline.points[1]
        .auraBefore
    ]) {
      snapshot.push(structuredClone(dependentQuicken));
    }
    fuelWithQuicken.burningStateLog[0].auraBefore =
      structuredClone(
        fuelWithQuicken.targetStateTimeline.points[1]
          .auraBefore
      );
    fuelWithQuicken.targetPhaseLog[0].reactableTick
      .transitions[0].quickenStateLogIds = [0];
    fuelWithQuicken.targetStateTimeline.points[1].links.push({
      kind: "quicken-state-log",
      id: 0
    });
    fuelWithQuicken.quickenStateLog = [
      {
        id: 0,
        generation: 9,
        operation: "remove",
        frame: 10,
        targetFrame: 10,
        timeSeconds: 10 / 60,
        targetId: "enemy-0",
        targetName: "Target",
        auraBefore: structuredClone(
          fuelWithQuicken.targetStateTimeline.points[1]
            .auraBefore
        ),
        auraAfter: [],
        reason: "BURNING_FUEL_EXPIRED"
      }
    ];
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        fuelWithQuicken
      )
    ).not.toThrow();

    const missingQuickenDeltaLog =
      structuredClone(fuelWithQuicken);
    missingQuickenDeltaLog.targetPhaseLog[0].reactableTick
      .transitions[0].quickenStateLogIds = [];
    missingQuickenDeltaLog.targetStateTimeline.points[1].links =
      missingQuickenDeltaLog.targetStateTimeline.points[1].links.filter(
        (link: { kind: string }) =>
          link.kind !== "quicken-state-log"
      );
    missingQuickenDeltaLog.quickenStateLog = [];
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        missingQuickenDeltaLog
      )
    ).toThrow(/exactly one Quicken lifecycle log iff/);

    fuelWithQuicken.quickenStateLog[0].operation = "expire";
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        fuelWithQuicken
      )
    ).toThrow(/Burning-dependent Quicken cleanup/);
  });

  it("binds every lifecycle transition to its exact target-frame deadline", () => {
    for (const result of [
      makeFrozenV2ReferenceResult(),
      makeLifecycleFixture("aura-natural-expiry"),
      makeLifecycleFixture("quicken-expiry"),
      makeLifecycleFixture("burning-fuel-expiry"),
      makeLifecycleFixture("electro-charged-expiry")
    ]) {
      const transitions =
        result.targetPhaseLog[0].reactableTick.transitions;
      transitions[transitions.length - 1].deadlineTargetFrame =
        0;
      expect(() =>
        targetPhaseV2ResultReferencesSchema.parse(result)
      ).toThrow(
        /lifecycle deadline must exactly equal its target-local frame/
      );
    }

    const wrongFrozenExpiry: any = structuredClone(
      makeFrozenV2ReferenceResult()
    );
    for (const snapshot of [
      wrongFrozenExpiry.targetStateTimeline.points[0]
        .auraBefore,
      wrongFrozenExpiry.targetStateTimeline.points[0]
        .auraAfter,
      wrongFrozenExpiry.targetPhaseLog[0]
        .auraBeforeTargetTasks,
      wrongFrozenExpiry.targetPhaseLog[0]
        .auraAfterTargetTasks,
      wrongFrozenExpiry.targetPhaseLog[0].reactableTick
        .auraBefore,
      wrongFrozenExpiry.targetStateTimeline.points[1]
        .auraBefore,
      wrongFrozenExpiry.frozenStateLog[0].auraBefore
    ]) {
      snapshot[0].expiresAtFrame = 100;
      snapshot[0].expiresAtTargetFrame = 100;
    }
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        wrongFrozenExpiry
      )
    ).toThrow(/exact target-local deadline/);
  });

  it("rejects lifecycle points that delete unrelated Aura state", () => {
    for (const result of [
      structuredClone(makeFrozenV2ReferenceResult()),
      makeLifecycleFixture("quicken-expiry"),
      makeLifecycleFixture("burning-fuel-expiry")
    ]) {
      const transition =
        result.targetPhaseLog[0].reactableTick.transitions[0];
      const point =
        result.targetStateTimeline.points[
          transition.targetStateTimelinePointId
        ];
      const unrelatedPyro = {
        element: "pyro",
        gaugeUnits: 0.5,
        expiresAtFrame: 100,
        expiresAtTargetFrame: 100
      };
      result.targetStateTimeline.points[0].auraBefore = [
        ...structuredClone(
          result.targetStateTimeline.points[0].auraBefore
        ),
        structuredClone(unrelatedPyro)
      ];
      result.targetStateTimeline.points[0].auraAfter = [
        ...structuredClone(
          result.targetStateTimeline.points[0].auraAfter
        ),
        structuredClone(unrelatedPyro)
      ];
      result.targetPhaseLog[0].auraBeforeTargetTasks = [
        ...structuredClone(
          result.targetPhaseLog[0].auraBeforeTargetTasks
        ),
        structuredClone(unrelatedPyro)
      ];
      result.targetPhaseLog[0].auraAfterTargetTasks = [
        ...structuredClone(
          result.targetPhaseLog[0].auraAfterTargetTasks
        ),
        structuredClone(unrelatedPyro)
      ];
      result.targetPhaseLog[0].reactableTick.auraBefore = [
        ...structuredClone(
          result.targetPhaseLog[0].reactableTick.auraBefore
        ),
        structuredClone(unrelatedPyro)
      ];
      point.auraBefore = [
        ...structuredClone(point.auraBefore),
        structuredClone(unrelatedPyro)
      ];
      const typedLog =
        transition.kind === "frozen-expiry"
          ? result.frozenStateLog[0]
          : transition.kind === "quicken-expiry"
            ? result.quickenStateLog[0]
            : result.burningStateLog[0];
      typedLog.auraBefore = structuredClone(point.auraBefore);
      expect(() =>
        targetPhaseV2ResultReferencesSchema.parse(result)
      ).toThrow(/unrelated pyro/);
    }

    const naturalGaugeOnly = makeLifecycleFixture(
      "aura-natural-expiry"
    );
    const retainedPyro = [
      {
        ...naturalGaugeOnly.targetStateTimeline.points[1]
          .auraBefore[0],
        gaugeUnits: 0.005
      }
    ];
    naturalGaugeOnly.targetStateTimeline.points[1].auraAfter =
      structuredClone(retainedPyro);
    naturalGaugeOnly.targetPhaseLog[0].reactableTick.auraAfter =
      structuredClone(retainedPyro);
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        naturalGaugeOnly
      )
    ).toThrow(/must remove an ordinary Aura/);

    const electroCharged = makeLifecycleFixture(
      "electro-charged-expiry"
    );
    const ecPoint =
      electroCharged.targetStateTimeline.points[2];
    const unrelatedPyro = {
      element: "pyro",
      gaugeUnits: 0.5,
      expiresAtFrame: 100,
      expiresAtTargetFrame: 100
    };
    for (const snapshot of [
      electroCharged.targetStateTimeline.points[0].auraBefore,
      electroCharged.targetStateTimeline.points[0].auraAfter,
      electroCharged.targetPhaseLog[0].auraBeforeTargetTasks,
      electroCharged.targetPhaseLog[0].auraAfterTargetTasks,
      electroCharged.targetPhaseLog[0].reactableTick.auraBefore,
      electroCharged.targetStateTimeline.points[1].auraBefore
    ]) {
      snapshot.push(structuredClone(unrelatedPyro));
    }
    electroCharged.targetStateTimeline.points[1].auraAfter = [
      structuredClone(unrelatedPyro)
    ];
    ecPoint.auraBefore = [structuredClone(unrelatedPyro)];
    ecPoint.auraAfter = [];
    electroCharged.periodicReactionLog[0].auraBefore =
      structuredClone(ecPoint.auraBefore);
    electroCharged.periodicReactionLog[0].auraAfter = [];
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        electroCharged
      )
    ).toThrow(/may only stop the periodic stream/);
  });

  it("requires exact reverse ownership for every lifecycle timeline point", () => {
    const naturalExpiry = makeLifecycleFixture(
      "aura-natural-expiry"
    );
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(naturalExpiry)
    ).not.toThrow();

    const unownedNaturalExpiry = makeLifecycleFixture(
      "aura-natural-expiry"
    );
    unownedNaturalExpiry.targetPhaseLog[0].reactableTick
      .transitions = [];
    unownedNaturalExpiry.targetPhaseLog[0].reactableTick.auraAfter =
      structuredClone(
        unownedNaturalExpiry.targetPhaseLog[0].reactableTick
          .auraBefore
      );
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        unownedNaturalExpiry
      )
    ).toThrow(
      /target lifecycle timeline point 1 \(aura-natural-expiry\) requires exactly one Reactable\.Tick transition/
    );

    const duplicateOwner: any =
      makeFrozenV2ReferenceResult();
    duplicateOwner.targetPhaseLog[0].reactableTick.transitions = [
      {
        stage: "reactable-tick",
        kind: "aura-natural-expiry",
        order: 0,
        deadlineTargetFrame: 10,
        targetStateTimelinePointId: 1
      },
      {
        ...duplicateOwner.targetPhaseLog[0].reactableTick
          .transitions[0],
        order: 1
      }
    ];
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(duplicateOwner)
    ).toThrow(
      /target lifecycle timeline point 1 is claimed by both target phase 0 transition 0 and target phase 0 transition 1/
    );
  });

  it("enforces exact v2 identity, mutually exclusive phase logs, and frozen 1.37 compatibility", () => {
    const result: any = makeFrozenV2ReferenceResult();
    result.engineVersion = TARGET_TASK_PHASE_ENGINE_VERSION;
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(result)
    ).toThrow(/engineVersion must match|exact 1\.38/);

    const oldLogResult: any =
      makeFrozenV2ReferenceResult();
    oldLogResult.targetTaskPhaseLog = [
      {
        id: 0,
        targetId: "enemy-0",
        targetName: "Target",
        globalFrame: 10,
        timeSeconds: 10 / 60,
        targetFrame: 10,
        targetOrder: 0,
        wakeKind: "incoming",
        eventType: "hit",
        eventPriority: 3,
        eventSequence: 1,
        intraEventSequence: 0,
        auraBeforeTasks: [],
        auraAfterTasks: [],
        auraAfterDecay: [],
        burningStateLogIds: [],
        hitResolutionLogIds: [],
        reactionTaskLogIds: []
      }
    ];
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(oldLogResult)
    ).toThrow(/empty targetTaskPhaseLog/);

    const currentV1: any =
      makeFrozenV2ReferenceResult();
    currentV1.config.targetTaskModel = {
      mode: "target-phase-v1"
    };
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(currentV1)
    ).toThrow(/requires an empty targetPhaseLog/);
    currentV1.targetPhaseLog = [];
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(currentV1)
    ).not.toThrow();

    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse({
        schemaVersion: TARGET_TASK_PHASE_SCHEMA_VERSION,
        engineVersion: TARGET_TASK_PHASE_ENGINE_VERSION,
        config: {
          schemaVersion: TARGET_TASK_PHASE_SCHEMA_VERSION,
          engineVersion: TARGET_TASK_PHASE_ENGINE_VERSION,
          targetTaskModel: { mode: "target-phase-v1" }
        },
        targetTaskPhaseLog: [],
        targetPhaseLog: []
      })
    ).not.toThrow();
  });

  it("rejects forged current legacy identity and legacy aura-v8 before the v2 branch return", () => {
    const forgedIdentity: any =
      makeFrozenV2ReferenceResult();
    forgedIdentity.schemaVersion =
      EC_NEXT_TARGET_TICK_SCHEMA_VERSION;
    forgedIdentity.engineVersion = "1.40.0-forged";
    forgedIdentity.config.schemaVersion =
      EC_NEXT_TARGET_TICK_SCHEMA_VERSION;
    forgedIdentity.config.engineVersion = "1.40.0-forged";
    forgedIdentity.config.targetTaskModel = {
      mode: "legacy-event-heap-v1"
    };
    forgedIdentity.targetPhaseLog = [];
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        forgedIdentity
      )
    ).toThrow(/exact supported schema and engine identity/);

    const legacyAuraV8: any =
      makeFrozenV2ReferenceResult();
    legacyAuraV8.schemaVersion =
      EC_NEXT_TARGET_TICK_SCHEMA_VERSION;
    legacyAuraV8.engineVersion =
      EC_NEXT_TARGET_TICK_ENGINE_VERSION;
    legacyAuraV8.config.schemaVersion =
      EC_NEXT_TARGET_TICK_SCHEMA_VERSION;
    legacyAuraV8.config.engineVersion =
      EC_NEXT_TARGET_TICK_ENGINE_VERSION;
    legacyAuraV8.config.targetTaskModel = {
      mode: "legacy-event-heap-v1"
    };
    legacyAuraV8.config.reactionEngine = {
      mode: "aura-v8"
    };
    legacyAuraV8.targetPhaseLog = [];
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(
        legacyAuraV8
      )
    ).toThrow(/aura-v8.*requires target-phase-v2/);
  });

  it("binds target identity, target clock, Aura continuity, and unique phase ownership", () => {
    const wrongOrder: any =
      makeFrozenV2ReferenceResult();
    wrongOrder.targetPhaseLog[0].targetOrder = 1;
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(wrongOrder)
    ).toThrow(/targetOrder must equal/);

    const wrongClock: any =
      makeFrozenV2ReferenceResult();
    wrongClock.targetPhaseLog[0].targetFrame = 9;
    wrongClock.targetPhaseLog[0].reactableTick.toTargetFrame = 9;
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(wrongClock)
    ).toThrow(/target-clock replay/);

    const forgedAura: any =
      makeFrozenV2ReferenceResult();
    const fabricatedPyro = [
      {
        element: "pyro",
        gaugeUnits: 0.8,
        expiresAtFrame: 100,
        expiresAtTargetFrame: 100
      }
    ];
    forgedAura.targetPhaseLog[0].auraBeforeTargetTasks =
      fabricatedPyro;
    forgedAura.targetPhaseLog[0].auraAfterTargetTasks =
      fabricatedPyro;
    forgedAura.targetPhaseLog[0].reactableTick.auraBefore =
      fabricatedPyro;
    forgedAura.targetStateTimeline.points[1].auraBefore =
      fabricatedPyro;
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(forgedAura)
    ).toThrow(
      /sparse clock advance may only decrease.*cannot add pyro/
    );

    const orphaned: any =
      makeFrozenV2ReferenceResult();
    orphaned.targetPhaseLog[0].reactableTick.transitions =
      [];
    orphaned.targetPhaseLog[0].reactableTick.auraAfter =
      expiringFrozenAura;
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(orphaned)
    ).toThrow(/requires exactly one Reactable\.Tick transition/);
  });

  it("rejects forged lifecycle provenance and targetFrame leakage from non-expiry EC rows", () => {
    const wrongReason: any =
      makeFrozenV2ReferenceResult();
    wrongReason.frozenStateLog[0].reason = "FORGED";
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(wrongReason)
    ).toThrow(/Frozen expiry transition/);

    const wrongLink: any =
      makeFrozenV2ReferenceResult();
    wrongLink.targetStateTimeline.points[1].links = [
      { kind: "frozen-state-log", id: 1 }
    ];
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(wrongLink)
    ).toThrow(/reciprocal typed timeline point/);

    const ec: any = makeLifecycleFixture(
      "electro-charged-expiry"
    );
    ec.periodicReactionLog.push({
      ...ec.periodicReactionLog[0],
      id: 1,
      operation: "tick",
      reason: null
    });
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(ec)
    ).toThrow(/must omit targetFrame/);
  });

  it("owns every incoming hit and Quicken-Bloom task without admitting them into targetTasks", () => {
    const result: any = makeFrozenV2ReferenceResult();
    result.targetPhaseLog[0].hitResolutionLogIds = [0];
    result.hitResolutionLog = [
      {
        id: 0,
        frame: 10,
        timeSeconds: 10 / 60,
        eventPriority: 3,
        eventSequence: 2,
        intraEventSequence: 0,
        targetId: "enemy-0",
        targetName: "Target",
        resolutionKind: "direct",
        landed: false,
        damageEventId: null
      }
    ];
    result.targetPhaseLog[0].reactionTaskLogIds = [0];
    result.reactionTaskLog = [
      {
        id: 0,
        kind: "quicken-bloom-followup",
        frame: 10,
        timeSeconds: 10 / 60,
        targetId: "enemy-0",
        targetName: "Target",
        eventPriority: 3,
        eventSequence: 3,
        intraEventSequence: 0,
        auraBefore: [],
        auraAfter: []
      }
    ];
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(result)
    ).not.toThrow();
    result.targetPhaseLog[0].hitResolutionLogIds = [];
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(result)
    ).toThrow(/hit-resolution log 0 requires exactly one/);
    result.targetPhaseLog[0].hitResolutionLogIds = [0];
    result.reactionTaskLog[0].kind = "periodicReactionTick";
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(result)
    ).toThrow();
  });
});

describe("1.35 per-element enemy resistance schema", () => {
  const resistances = {
    pyro: 20,
    cryo: -12,
    hydro: 0.3,
    electro: 0.4,
    anemo: 0.5,
    geo: 0.6,
    dendro: 0.7,
    physical: 0.8
  };

  it("accepts exact shared and target eight-element tables without player resistance bounds", () => {
    const current = migrateConfig(legacyConfig);
    const targetResistances = {
      ...resistances,
      pyro: -20,
      physical: 12
    };
    const parsed = migrateConfig({
      ...current,
      enemy: {
        ...current.enemy,
        resistances,
        targets: [
          { id: "enemy-0", name: "Shared table target" },
          {
            id: "enemy-1",
            name: "Target table override",
            resistances: targetResistances
          }
        ]
      }
    });

    expect(parsed.enemy.resistances).toEqual(resistances);
    expect(parsed.enemy.targets?.[1]?.resistances).toEqual(
      targetResistances
    );
  });

  it("keeps scalar and table target overrides mutually exclusive in TypeScript and Zod", () => {
    type AmbiguousTarget = {
      id: "enemy-0";
      name: "Ambiguous";
      resistance: 0.2;
      resistances: typeof resistances;
    };
    type AmbiguousTargetIsAssignable =
      AmbiguousTarget extends EnemyTargetProfile ? true : false;
    const ambiguousTargetIsAssignable: AmbiguousTargetIsAssignable =
      false;
    const scalarTarget: EnemyTargetProfile = {
      id: "enemy-0",
      name: "Scalar",
      resistance: 0.2
    };
    const tableTarget: EnemyTargetProfile = {
      id: "enemy-0",
      name: "Table",
      resistances
    };

    expect(ambiguousTargetIsAssignable).toBe(false);
    expect(enemyTargetProfileSchema.parse(scalarTarget)).toEqual(
      scalarTarget
    );
    expect(enemyTargetProfileSchema.parse(tableTarget)).toEqual(
      tableTarget
    );
    expect(() =>
      enemyTargetProfileSchema.parse({
        id: "enemy-0",
        name: "Ambiguous",
        resistance: 0.2,
        resistances
      })
    ).toThrow(
      /cannot be combined with the scalar resistance override/
    );
  });

  it("strictly parses scalar resolved targets without adding a table field", () => {
    const config = migrateConfig(legacyConfig);
    const projection = {
      config,
      enemyTargets: [
        {
          id: "enemy-0",
          name: "敌人 0",
          level: config.enemy.level,
          resistance: config.enemy.resistance,
          defReduction: config.enemy.defReduction,
          freezeResistance: 0,
          initialAura: [],
          position: null,
          hitboxRadius: 0
        }
      ],
      damageEvents: [],
      unrelatedResultField: "preserved"
    };
    const parsed =
      enemyTargetsResultReferencesSchema.parse(projection);

    expect(parsed).toEqual(projection);
    expect(parsed.enemyTargets[0]).not.toHaveProperty(
      "resistances"
    );
    expect(
      resolvedEnemyTargetProfileSchema.parse(
        projection.enemyTargets[0]
      )
    ).toEqual(projection.enemyTargets[0]);
    expect(() =>
      resolvedEnemyTargetProfileSchema.parse({
        ...projection.enemyTargets[0],
        unexpected: true
      })
    ).toThrow(/Unrecognized key/);
  });

  it("validates resolved table inheritance, scalar suppression, and the compatibility fallback", () => {
    const current = migrateConfig(legacyConfig);
    const config = migrateConfig({
      ...current,
      enemy: {
        ...current.enemy,
        resistance: 0.15,
        resistances,
        targets: [
          {
            id: "enemy-0",
            name: "Shared table",
            position: { x: 1, y: 2 }
          },
          {
            id: "scalar-target",
            name: "Scalar override",
            resistance: 0.45
          }
        ]
      }
    });
    const projection = {
      config,
      enemyTargets: [
        {
          id: "enemy-0",
          name: "Shared table",
          level: config.enemy.level,
          resistance: 0.15,
          resistances,
          defReduction: config.enemy.defReduction,
          freezeResistance: 0,
          initialAura: [],
          position: { x: 1, y: 2 },
          hitboxRadius: 0
        },
        {
          id: "scalar-target",
          name: "Scalar override",
          level: config.enemy.level,
          resistance: 0.45,
          defReduction: config.enemy.defReduction,
          freezeResistance: 0,
          initialAura: [],
          position: null,
          hitboxRadius: 0
        }
      ],
      damageEvents: []
    };

    expect(
      enemyTargetsResultReferencesSchema.parse(projection)
    ).toEqual(projection);

    const missingPhysical = structuredClone(projection);
    delete (
      missingPhysical.enemyTargets[0]!.resistances as Partial<
        typeof resistances
      >
    ).physical;
    expect(() =>
      enemyTargetsResultReferencesSchema.parse(missingPhysical)
    ).toThrow(/physical/);

    const wrongFallback = structuredClone(projection);
    wrongFallback.enemyTargets[0]!.resistance = 0.2;
    expect(() =>
      enemyTargetsResultReferencesSchema.parse(wrongFallback)
    ).toThrow(/scalar compatibility fallback/);

    const leakedSharedTable = {
      ...projection,
      enemyTargets: projection.enemyTargets.map((target, index) =>
        index === 1 ? { ...target, resistances } : target
      )
    };
    expect(() =>
      enemyTargetsResultReferencesSchema.parse(leakedSharedTable)
    ).toThrow(/must be omitted/);
  });

  it.each([
    [
      "missing key",
      (() => {
        const { physical: _physical, ...missingPhysical } =
          resistances;
        return missingPhysical;
      })(),
      /physical/
    ],
    [
      "unknown key",
      { ...resistances, all: 0.1 },
      /Unrecognized key/
    ],
    [
      "NaN",
      { ...resistances, electro: Number.NaN },
      /electro/
    ]
  ])("rejects a %s", (_label, invalidResistances, expected) => {
    const current = migrateConfig(legacyConfig);
    expect(() =>
      migrateConfig({
        ...current,
        enemy: {
          ...current.enemy,
          resistances: invalidResistances
        }
      })
    ).toThrow(expected);
  });

  it("rejects simultaneous scalar and per-element target overrides", () => {
    const current = migrateConfig(legacyConfig);
    expect(() =>
      migrateConfig({
        ...current,
        enemy: {
          ...current.enemy,
          targets: [
            {
              id: "enemy-0",
              name: "Ambiguous resistance target",
              resistance: 0.2,
              resistances
            }
          ]
        }
      })
    ).toThrow(
      /cannot be combined with the scalar resistance override/
    );
  });

  it("fails closed when a frozen 1.34 wire config carries shared or target per-element resistance", () => {
    const current = migrateConfig(legacyConfig);
    const historical = {
      ...asPre139Wire(current),
      schemaVersion: GENERAL_REACTION_ORDER_SCHEMA_VERSION,
      engineVersion: GENERAL_REACTION_ORDER_ENGINE_VERSION
    };

    expect(() =>
      migrateConfig({
        ...historical,
        enemy: {
          ...historical.enemy,
          resistances
        }
      })
    ).toThrow(
      /enemy\.resistances: schemaVersion "1\.34\.0" does not support per-element enemy resistance/
    );
    expect(() =>
      migrateConfig({
        ...historical,
        enemy: {
          ...historical.enemy,
          targets: [
            {
              id: "enemy-0",
              name: "Historical smuggled target",
              resistances
            }
          ]
        }
      })
    ).toThrow(
      /enemy\.targets\.0\.resistances: schemaVersion "1\.34\.0" does not support per-element enemy resistance/
    );
  });

  it("fails closed when a non-JSON 1.34 object inherits per-element resistance from its prototype", () => {
    const current = migrateConfig(legacyConfig);
    const historical = {
      ...asPre139Wire(current),
      schemaVersion: GENERAL_REACTION_ORDER_SCHEMA_VERSION,
      engineVersion: GENERAL_REACTION_ORDER_ENGINE_VERSION
    };
    const inheritedSharedEnemy = Object.assign(
      Object.create({ resistances }),
      historical.enemy
    );
    const inheritedTarget = Object.assign(
      Object.create({ resistances }),
      {
        id: "enemy-0",
        name: "Inherited historical target"
      }
    );

    expect(() =>
      migrateConfig({
        ...historical,
        enemy: inheritedSharedEnemy
      })
    ).toThrow(
      /enemy: config must contain only plain JSON objects/
    );
    expect(() =>
      migrateConfig({
        ...historical,
        enemy: {
          ...historical.enemy,
          targets: [inheritedTarget]
        }
      })
    ).toThrow(
      /enemy\.targets\.0: config must contain only plain JSON objects/
    );
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
    expect(simulationRunManifestV144Schema.parse(manifest)).toEqual(
      manifest
    );
    expect(() =>
      simulationRunManifestV142Schema.parse(manifest)
    ).toThrow();

    const {
      reproducibilityKey: _currentReproducibilityKey,
      ...currentIdentity
    } = manifest;
    const frozenIdentity = {
      ...currentIdentity,
      schemaVersion: EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
      engineVersion: EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION
    };
    const frozenManifest = {
      ...frozenIdentity,
      reproducibilityKey: createSimulationReproducibilityKey(
        frozenIdentity as unknown as Parameters<
          typeof createSimulationReproducibilityKey
        >[0]
      )
    };
    expect(
      simulationRunManifestV142Schema.parse(frozenManifest)
    ).toEqual(frozenManifest);
    expect(() =>
      simulationRunManifestSchema.parse(frozenManifest)
    ).toThrow();
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

  it("requires an acyclic recursively plain config wire before any version projection", () => {
    const current = migrateConfig(legacyConfig);
    const ordinaryJson = JSON.parse(
      JSON.stringify(current)
    ) as unknown;
    expect(parseSimConfig(ordinaryJson)).toEqual(current);
    expect(migrateConfig(ordinaryJson)).toEqual(current);
    expect(simConfigSchema.safeParse(ordinaryJson).success).toBe(
      true
    );

    const toNullPrototypeWire = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        return value.map(toNullPrototypeWire);
      }
      if (typeof value !== "object" || value === null) {
        return value;
      }
      const clone = Object.create(null) as Record<
        string,
        unknown
      >;
      for (const [key, entry] of Object.entries(value)) {
        clone[key] = toNullPrototypeWire(entry);
      }
      return clone;
    };
    const nullPrototypeWire = toNullPrototypeWire(current);
    expect(parseSimConfig(nullPrototypeWire)).toEqual(current);
    expect(migrateConfig(nullPrototypeWire)).toEqual(current);
    expect(
      simConfigV144Schema.safeParse(nullPrototypeWire).success
    ).toBe(true);

    const frozenV142 = {
      ...current,
      schemaVersion: EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
      engineVersion: EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION
    };
    expect(simConfigV142Schema.safeParse(frozenV142).success).toBe(
      true
    );
    const v142Prototype = {};
    Object.defineProperty(v142Prototype, "burningCallbackModel", {
      value: { mode: "synchronous-zero-delay-v1" },
      enumerable: false
    });
    const inheritedFutureV142 = Object.assign(
      Object.create(v142Prototype),
      frozenV142
    );
    // The frozen value schema intentionally remains unchanged. Persistence and
    // import callers must enter through migrateConfig, which owns the wire gate.
    expect(
      simConfigV142Schema.safeParse(inheritedFutureV142).success
    ).toBe(true);
    expect(() => migrateConfig(inheritedFutureV142)).toThrow(
      /plain JSON objects.*explicit own wire properties/
    );

    const currentPrototype = {};
    Object.defineProperty(currentPrototype, "futureDeliveryModel", {
      value: { mode: "v1" },
      enumerable: false
    });
    const inheritedFutureCurrent = Object.assign(
      Object.create(currentPrototype),
      structuredClone(current)
    );
    expect(
      simConfigV144Schema.safeParse(inheritedFutureCurrent).success
    ).toBe(false);
    expect(
      simConfigSchema.safeParse(inheritedFutureCurrent).success
    ).toBe(false);
    expect(() => parseSimConfig(inheritedFutureCurrent)).toThrow(
      /plain JSON objects.*explicit own wire properties/
    );
    expect(() => migrateConfig(inheritedFutureCurrent)).toThrow(
      /plain JSON objects.*explicit own wire properties/
    );

    expect(() =>
      migrateConfig({
        ...current,
        meta: { ...current.meta, note: new Date(0) }
      })
    ).toThrow(/plain JSON objects.*explicit own wire properties/);
    class CustomEnemyProfile {}
    expect(() =>
      parseSimConfig({
        ...current,
        enemy: Object.assign(
          new CustomEnemyProfile(),
          current.enemy
        )
      })
    ).toThrow(/plain JSON objects.*explicit own wire properties/);

    const cyclic = structuredClone(current) as unknown as Record<
      string,
      unknown
    >;
    const cyclicMeta = cyclic.meta as Record<string, unknown>;
    cyclicMeta.self = cyclicMeta;
    expect(simConfigV144Schema.safeParse(cyclic).success).toBe(
      false
    );
    expect(() => migrateConfig(cyclic)).toThrow(
      /acyclic plain JSON wire/
    );
    expect(() => parseSimConfig(cyclic)).toThrow(
      /acyclic plain JSON wire/
    );
  });

  it("fail-closes parseSimConfig on inherited current identities and nested discriminators", () => {
    const current = migrateConfig(legacyConfig);
    const legal = migrateConfig({
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
      },
      reactionEngine: { mode: "aura-v1" as const }
    });

    expect(parseSimConfig(structuredClone(legal))).toEqual(legal);

    const inheritRootIdentity = (
      field: "schemaVersion" | "engineVersion"
    ): Record<string, unknown> => {
      const clone = structuredClone(
        legal
      ) as unknown as Record<string, unknown>;
      const value = clone[field];
      delete clone[field];
      return Object.assign(
        Object.create({ [field]: value }),
        clone
      ) as Record<string, unknown>;
    };

    expect(() =>
      parseSimConfig(inheritRootIdentity("schemaVersion"))
    ).toThrow(/plain JSON objects.*explicit own wire properties/);
    expect(() =>
      parseSimConfig(inheritRootIdentity("engineVersion"))
    ).toThrow(/plain JSON objects.*explicit own wire properties/);

    const nestedFields = [
      ["reactionEngine", "mode"],
      ["playerDamageModel", "mode"],
      ["targetClockModel", "mode"],
      ["targetTaskModel", "mode"],
      ["reactionDeliveryModel", "mode"],
      ["electroChargedPropagationModel", "mode"],
      ["timeline", "mode"],
      ["timeline", "fps"]
    ] as const;
    for (const [containerField, field] of nestedFields) {
      const clone = structuredClone(
        legal
      ) as unknown as Record<string, unknown>;
      const container = clone[containerField] as Record<
        string,
        unknown
      >;
      const value = container[field];
      delete container[field];
      clone[containerField] = Object.assign(
        Object.create({ [field]: value }),
        container
      );

      expect(() => parseSimConfig(clone)).toThrow(
        new RegExp(
          `${containerField}: config must contain only plain JSON objects`
        )
      );
    }

    const inheritedContainer = structuredClone(
      legal
    ) as unknown as Record<string, unknown>;
    const reactionDeliveryModel =
      inheritedContainer.reactionDeliveryModel;
    delete inheritedContainer.reactionDeliveryModel;
    expect(() =>
      parseSimConfig(
        Object.assign(
          Object.create({ reactionDeliveryModel }),
          inheritedContainer
        )
      )
    ).toThrow(/plain JSON objects.*explicit own wire properties/);
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
        ...migrateConfig(legacyConfig),
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
      ...asPre139Wire(current),
      schemaVersion: "1.0.0",
      engineVersion: "1.0.0-compat"
    });
    const migratedFromAura = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.1.0",
      engineVersion: "1.1.0-aura"
    });
    const migratedFromParticles = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.2.0",
      engineVersion: "1.2.0-particles"
    });
    const migratedFromIcdProfiles = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.3.0",
      engineVersion: "1.3.0-icd-profiles"
    });
    const migratedFromActionStates = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.4.0",
      engineVersion: "1.4.0-action-states"
    });
    const migratedFromFollowupCancels = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.5.0",
      engineVersion: "1.5.0-followup-cancels"
    });
    const migratedFromRuntimeEnergy = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.6.0",
      engineVersion: "1.6.0-runtime-energy"
    });
    const migratedFromFixedEnergyIcd = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.7.0",
      engineVersion: "1.7.0-fixed-energy-icd"
    });
    const migratedFromHitParticles = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.8.0",
      engineVersion: "1.8.0-hit-particle-triggers"
    });
    const migratedFromMovementCommands = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.9.0",
      engineVersion: "1.9.0-movement-commands"
    });
    const migratedFromStateClears = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.10.0",
      engineVersion: "1.10.0-timeline-state-clears"
    });
    const migratedFromTargetHitResolution = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.11.0",
      engineVersion: "1.11.0-target-hit-resolution"
    });
    const migratedFromTargetEffectPolicy = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.12.0",
      engineVersion: "1.12.0-target-effect-policy"
    });
    const migratedFromTargetPhaseTimeline = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.13.0",
      engineVersion: "1.13.0-target-phase-timeline"
    });
    const migratedFromMultiTargetRegistry = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.14.0",
      engineVersion: "1.14.0-multi-target-registry"
    });
    const migratedFromAoeFanout = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.15.0",
      engineVersion: "1.15.0-aoe-fanout"
    });
    const migratedFromCircleGeometry = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.16.0",
      engineVersion: "1.16.0-circle-geometry"
    });
    const migratedFromTargetMotion = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.17.0",
      engineVersion: "1.17.0-target-motion"
    });
    const migratedFromOrientedRectangle = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.18.0",
      engineVersion: "1.18.0-oriented-rectangle"
    });
    const migratedFromCapsuleGeometry = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.19.0",
      engineVersion: "1.19.0-capsule-geometry"
    });
    const migratedFromSectorGeometry = migrateConfig({
      ...asPre139Wire(current),
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
      },
      {
        schemaVersion: TARGET_LOCAL_HITLAG_SCHEMA_VERSION,
        engineVersion: TARGET_LOCAL_HITLAG_ENGINE_VERSION,
        allowedMode: "aura-v5",
        futureMode: "aura-v6"
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
        ...asPre139Wire(current),
        schemaVersion: contract.schemaVersion,
        engineVersion: contract.engineVersion,
        ...(contract.allowedMode === "aura-v5"
          ? {
              enemy: {
                ...current.enemy,
                targets: [
                  {
                    id: "enemy-0",
                    name: "Positioned historical target",
                    position: { x: 0, y: 0 }
                  }
                ]
              }
            }
          : {}),
        rotation: [],
        timeline: legalTimeline,
        ...(contract.allowedMode === null
          ? {}
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
          ...asPre139Wire(current),
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

    const conflicting: any = structuredClone(base);
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

  it("accepts versioned ICD tail policies and rejects unknown policies", () => {
    const current = migrateConfig(legacyConfig);
    const withPolicies = {
      ...current,
      rotation: [],
      reactionEngine: {
        mode: "aura-v1" as const,
        icdProfiles: {
          repeating: {
            resetFrames: 60,
            applicationSequence: [true, false],
            tailPolicy: "repeat" as const
          },
          clamped: {
            resetFrames: 60,
            applicationSequence: [true, false],
            tailPolicy: "clamp" as const
          }
        }
      },
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

    expect(migrateConfig(withPolicies).reactionEngine).toEqual(
      withPolicies.reactionEngine
    );
    expect(() =>
      migrateConfig({
        ...withPolicies,
        reactionEngine: {
          mode: "aura-v1",
          icdProfiles: {
            invalid: {
              resetFrames: 60,
              applicationSequence: [true, false],
              tailPolicy: "cycle"
            }
          }
        }
      })
    ).toThrow(/tailPolicy/);
  });

  it("migrates historical custom ICD profiles without changing their implicit repeat tail", () => {
    const current = migrateConfig(legacyConfig);
    const historicalReactionEngine = {
      mode: "aura-v1" as const,
      icdProfiles: {
        historical: {
          resetFrames: 60,
          applicationSequence: [true, false]
        }
      }
    };
    const migrated = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.3.0",
      engineVersion: "1.3.0-icd-profiles",
      rotation: [],
      reactionEngine: historicalReactionEngine,
      timeline: {
        mode: "legal-frame-v1",
        fps: 60,
        legalityMode: "strict",
        initialActiveCharacterId: "a",
        swapFrames: 12,
        abilities: [],
        commands: []
      }
    });

    expect(migrated.reactionEngine).toEqual(
      historicalReactionEngine
    );
    expect(
      migrated.reactionEngine?.icdProfiles?.historical
        ?.tailPolicy
    ).toBeUndefined();
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
      ...asPre139Wire(current),
      schemaVersion: "1.21.0",
      engineVersion: "1.21.0-actor-local-geometry"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Overload schema into the Superconduct schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.22.0",
      engineVersion: "1.22.0-overload-reaction"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Superconduct schema into the Electro-Charged schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.23.0",
      engineVersion: "1.23.0-superconduct-reaction"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Electro-Charged schema into the Frozen-state schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.24.0",
      engineVersion: "1.24.0-electro-charged-reaction"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Frozen-state schema into the Shatter schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.25.0",
      engineVersion: "1.25.0-freeze-state"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Shatter schema into the Swirl propagation schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.26.0",
      engineVersion: "1.26.0-shatter-reaction"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Swirl propagation schema into the Crystallize shard schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.27.0",
      engineVersion: "1.27.0-swirl-propagation"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Crystallize shard schema into the Catalyze schema", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...asPre139Wire(current),
      schemaVersion: "1.28.0",
      engineVersion: "1.28.0-crystallize-shards"
    });

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  });

  it("migrates the Catalyze schema without silently opting aura-v3 into Burning", () => {
    const current = migrateConfig(legacyConfig);
    const migrated = migrateConfig({
      ...asPre139Wire(current),
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
      const historicalWire = {
        ...asPre139Wire(current),
        schemaVersion: "1.29.0"
      };
      expect(() =>
        migrateConfig(
          engineVersion === undefined
            ? historicalWire
            : { ...historicalWire, engineVersion }
        )
      ).toThrow(
        /schemaVersion "1\.29\.0" requires "1\.29\.0-catalyze-reaction"/
      );
    }

    expect(() =>
      migrateConfig({
        ...asPre139Wire(current),
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
      ...asPre139Wire(current),
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
        ...asPre139Wire(current),
        schemaVersion: BURNING_REACTION_SCHEMA_VERSION,
        engineVersion: "1.30.0-forged"
      })
    ).toThrow(
      /schemaVersion "1\.30\.0" requires "1\.30\.0-burning-reaction"/
    );

    expect(() =>
      migrateConfig({
        ...asPre139Wire(current),
        schemaVersion: BURNING_REACTION_SCHEMA_VERSION,
        engineVersion: BURNING_REACTION_ENGINE_VERSION,
        reactionEngine: { mode: "aura-v5" }
      })
    ).toThrow(
      /schemaVersion "1\.30\.0" does not support "aura-v5"/
    );

    expect(() =>
      migrateConfig({
        ...asPre139Wire(current),
        schemaVersion: "1.29.0",
        engineVersion: "1.29.0-catalyze-reaction",
        reactionEngine: { mode: "aura-v5" }
      })
    ).toThrow(
      /schemaVersion "1\.29\.0" does not support "aura-v5"/
    );
    expect(() =>
      migrateConfig({
        ...asPre139Wire(current),
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
      migrateConfig(withoutOwn(validV5, "timeline"))
    ).toThrow(/require timeline\.mode legal-frame-v1/);
    expect(() =>
      migrateConfig({
        ...validV5,
        enemy: withoutOwn(current.enemy, "targets")
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
                  ...withoutOwn(ability.hits[0]!, "geometry")
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
                  ...withoutOwn(
                    withoutOwn(ability.hits[0]!, "element"),
                    "geometry"
                  )
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
          ...withoutOwn(ability.hits[0]!, "geometry"),
          element: "dendro" as const,
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

  it("requires additive Catalyze audits to preserve Quicken Gauge", () => {
    for (const [reaction, triggerElement] of [
      ["aggravate", "electro"],
      ["spread", "dendro"]
    ] as const) {
      const audit = {
        reaction,
        triggerElement,
        quickenGaugeUnitsBefore: 0.8,
        quickenGaugeUnitsAfter: 0.8,
        consumedQuickenGaugeUnits: 0 as const
      };
      expect(
        additiveReactionAuditV142Schema.parse(audit)
      ).toEqual(audit);
      for (const quickenGaugeUnitsAfter of [
        0.8 + 5e-10,
        0.79,
        0
      ]) {
        expect(() =>
          additiveReactionAuditV142Schema.parse({
            ...audit,
            quickenGaugeUnitsAfter
          })
        ).toThrow(/cannot consume Quicken Gauge/);
      }

      expect(() =>
        additiveReactionAuditV142Schema.parse({
          ...audit,
          quickenGaugeUnitsBefore: 1e12,
          quickenGaugeUnitsAfter: 1e12 - 1_000
        })
      ).toThrow(/cannot consume Quicken Gauge/);
    }
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

  it("allows only queued siblings in serialized same-frame Dendro-core expiry snapshots", () => {
    const snapshots = Array.from({ length: 3 }, (_, coreId) => ({
      coreId,
      sourceActorId: "hydro-owner",
      sourceTargetId: "enemy-0",
      spawnedAtFrame: 30,
      expiresAtFrame: 330,
      position: { x: coreId, y: 0 },
      hitboxRadius: 2
    }));
    const points = [
      ...snapshots.map((snapshot, index) => ({
        id: index,
        frame: 30,
        timeSeconds: 0.5,
        eventType: "dendroCoreSpawn",
        eventPriority: 2,
        eventSequence: index,
        intraEventSequence: 0,
        operation: "spawn",
        dendroCoreLogId: index,
        coreId: snapshot.coreId,
        activeCores: snapshots.slice(0, index + 1)
      })),
      ...snapshots.map((snapshot, index) => ({
        id: snapshots.length + index,
        frame: 330,
        timeSeconds: 5.5,
        eventType: "dendroCoreExpiry",
        eventPriority: 2,
        eventSequence: snapshots.length + index,
        intraEventSequence: 0,
        operation: "expire",
        dendroCoreLogId: snapshots.length + index,
        coreId: snapshot.coreId,
        activeCores: snapshots.slice(index + 1)
      }))
    ];
    const timeline = {
      version: "1.0.0",
      points
    };

    expect(dendroCoreTimelineSchema.parse(timeline)).toEqual(
      timeline
    );
    expect(() =>
      dendroCoreTimelineSchema.parse({
        ...timeline,
        points: points.slice(0, -1)
      })
    ).toThrow(/half-open lifetime/);
    expect(() =>
      dendroCoreTimelineSchema.parse({
        ...timeline,
        points: points.map((point, index) =>
          index === points.length - 1
            ? {
                ...point,
                frame: 331,
                timeSeconds: 331 / 60
              }
            : point
        )
      })
    ).toThrow(/half-open lifetime/);
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
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION,
      config: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        engineVersion: CURRENT_ENGINE_VERSION,
        reactionEngine: { mode: "aura-v5" as const },
        electroChargedPropagationModel: {
          mode: "single-target-v1" as const
        }
      },
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
    const frozen131: any = structuredClone(references);
    frozen131.schemaVersion = DENDRO_CORE_SCHEMA_VERSION;
    frozen131.engineVersion = DENDRO_CORE_ENGINE_VERSION;
    frozen131.config.schemaVersion =
      DENDRO_CORE_SCHEMA_VERSION;
    frozen131.config.engineVersion =
      DENDRO_CORE_ENGINE_VERSION;
    delete frozen131.config.electroChargedPropagationModel;
    expect(() =>
      dendroCoreResultReferencesSchema.parse(frozen131)
    ).not.toThrow();

    const frozen139: any = structuredClone(references);
    frozen139.schemaVersion =
      SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION;
    frozen139.engineVersion =
      SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION;
    frozen139.config.schemaVersion =
      SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION;
    frozen139.config.engineVersion =
      SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION;
    delete frozen139.config.electroChargedPropagationModel;
    frozen139.config.reactionEngine = { mode: "aura-v7" };
    expect(() =>
      dendroCoreResultReferencesSchema.parse(frozen139)
    ).not.toThrow();
    frozen139.config.reactionEngine = { mode: "aura-v8" };
    expect(() =>
      dendroCoreResultReferencesSchema.parse(frozen139)
    ).toThrow(/1\.39\.0 does not support aura-v8/);

    const forgedCurrentIdentity: any =
      structuredClone(references);
    forgedCurrentIdentity.engineVersion = "1.40.0-forged";
    forgedCurrentIdentity.config.engineVersion =
      "1.40.0-forged";
    expect(() =>
      dendroCoreResultReferencesSchema.parse(
        forgedCurrentIdentity
      )
    ).toThrow(/exact supported schema and engine identity/);
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

  it("gates Dendro Aura and applications behind aura-v3 through aura-v9", () => {
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
        /dendro aura requires reactionEngine\.mode to be aura-v3 through aura-v9/
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
        /aura-v1 through aura-v9 currently require timeline\.mode legal-frame-v1/
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
      /manual reaction labels are forbidden in aura-v1 through aura-v9/
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

    const legacyAmpBaseConfig = {
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
              element: "pyro" as const,
              reaction: "none" as const,
              ampBase: 2
            }
          ]
        }
      ]
    };
    const legacyAmpBaseParsed = migrateConfig(legacyAmpBaseConfig);
    expect(legacyAmpBaseParsed.rotation[0]?.hits?.[0]).toMatchObject({
      reaction: "none",
      ampBase: 2
    });

    const legacyParsed = migrateConfig({
      ...legacyAmpBaseConfig,
      rotation: legacyAmpBaseConfig.rotation.map((action) => ({
        ...action,
        hits: action.hits.map((hit) => ({
          ...hit,
          reaction: "melt" as const
        }))
      }))
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
