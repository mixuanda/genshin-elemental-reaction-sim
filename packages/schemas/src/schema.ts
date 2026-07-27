import { z } from "zod";
import {
  ACTOR_POSE_SCHEMA_VERSION,
  ACTION_STATE_SCHEMA_VERSION,
  AOE_FANOUT_SCHEMA_VERSION,
  BURNING_REACTION_ENGINE_VERSION,
  BURNING_REACTION_SCHEMA_VERSION,
  CAPSULE_GEOMETRY_SCHEMA_VERSION,
  CATALYZE_REACTION_ENGINE_VERSION,
  CATALYZE_REACTION_SCHEMA_VERSION,
  CIRCLE_GEOMETRY_SCHEMA_VERSION,
  CRYSTALLIZE_REACTION_SCHEMA_VERSION,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  DENDRO_CORE_ENGINE_VERSION,
  DENDRO_CORE_SCHEMA_VERSION,
  ELECTRO_CHARGED_REACTION_SCHEMA_VERSION,
  FREEZE_REACTION_SCHEMA_VERSION,
  FIXED_ENERGY_ICD_SCHEMA_VERSION,
  FOLLOWUP_CANCEL_SCHEMA_VERSION,
  HIT_PARTICLE_TRIGGER_SCHEMA_VERSION,
  ICD_PROFILE_SCHEMA_VERSION,
  INITIAL_TYPED_SCHEMA_VERSION,
  LEGACY_SCHEMA_VERSION,
  MOVEMENT_COMMAND_SCHEMA_VERSION,
  MULTI_TARGET_REGISTRY_SCHEMA_VERSION,
  OVERLOAD_REACTION_SCHEMA_VERSION,
  ORIENTED_RECTANGLE_SCHEMA_VERSION,
  PARTICLE_SCHEMA_VERSION,
  PREVIOUS_SCHEMA_VERSION,
  RUNTIME_ENERGY_SCHEMA_VERSION,
  REPRODUCIBILITY_IDENTITY_ALGORITHM,
  SHATTER_REACTION_SCHEMA_VERSION,
  SIMULATION_RUN_MANIFEST_VERSION,
  SECTOR_GEOMETRY_SCHEMA_VERSION,
  SUPERCONDUCT_REACTION_SCHEMA_VERSION,
  SWIRL_REACTION_SCHEMA_VERSION,
  TARGET_MOTION_SCHEMA_VERSION,
  TARGET_EFFECT_POLICY_SCHEMA_VERSION,
  TARGET_HIT_RESOLUTION_SCHEMA_VERSION,
  TARGET_PHASE_TIMELINE_SCHEMA_VERSION,
  TIMELINE_STATE_CLEAR_SCHEMA_VERSION,
  type SimConfig,
  type SimulationRunManifest
} from "./types";
import {
  createSimulationConfigHash,
  createSimulationReproducibilityKey
} from "./reproducibility";

const idSchema = z.string().trim().min(1);
const wireNonEmptyStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, {
    message: "must not be blank"
  });
const finiteNumber = z.number().finite();
const spatialCoordinateSchema = finiteNumber.min(-10_000).max(10_000);
const geometryCoordinateSpaceSchema = z.enum(["world", "actor-local"]);
const fnv1a32ContentHashSchema = z
  .string()
  .regex(/^fnv1a32:[0-9a-f]{8}$/);

export const resolvedSimulationRuntimeOptionsSchema = z
  .object({
    energyMode: z.enum(["configured", "zero", "full"]),
    critMode: z.enum(["average", "allCrit", "noCrit"]),
    compatibilityMode: z.enum([
      "legacy-v0.1",
      "legal-frame-v1"
    ]),
    randomSeed: wireNonEmptyStringSchema
  })
  .strict();

export const damagePluginManifestEntrySchema = z
  .object({
    order: z.number().int().nonnegative(),
    index: z.number().int().nonnegative(),
    id: wireNonEmptyStringSchema.refine(
      (value) => value === value.trim(),
      { message: "must not have surrounding whitespace" }
    ),
    version: wireNonEmptyStringSchema,
    kind: z.enum(["code", "declarative"]),
    contentHash: fnv1a32ContentHashSchema
  })
  .strict();

export const simulationRunManifestSchema = z
  .object({
    version: z.literal(SIMULATION_RUN_MANIFEST_VERSION),
    identityAlgorithm: z.literal(
      REPRODUCIBILITY_IDENTITY_ALGORITHM
    ),
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    engineVersion: z.literal(CURRENT_ENGINE_VERSION),
    dataVersion: wireNonEmptyStringSchema,
    configHash: fnv1a32ContentHashSchema,
    resolvedRuntimeOptions:
      resolvedSimulationRuntimeOptionsSchema,
    plugins: z.array(damagePluginManifestEntrySchema),
    reproducibilityKey: z
      .string()
      .regex(/^gdl-v2-fnv1a32-[0-9a-f]{8}$/)
  })
  .strict()
  .superRefine((manifest, context) => {
    const pluginIds = new Set<string>();
    for (const [index, plugin] of manifest.plugins.entries()) {
      if (plugin.order !== index || plugin.index !== index) {
        context.addIssue({
          code: "custom",
          path: ["plugins", index],
          message:
            "plugin order and index must equal the descriptor array position"
        });
      }
      if (pluginIds.has(plugin.id)) {
        context.addIssue({
          code: "custom",
          path: ["plugins", index, "id"],
          message: `duplicate plugin id "${plugin.id}"`
        });
      }
      pluginIds.add(plugin.id);
    }

    const {
      reproducibilityKey: _reproducibilityKey,
      ...identity
    } = manifest;
    const expectedKey =
      createSimulationReproducibilityKey(identity);
    if (manifest.reproducibilityKey !== expectedKey) {
      context.addIssue({
        code: "custom",
        path: ["reproducibilityKey"],
        message:
          "does not match the versioned run-manifest identity"
      });
    }
  });

/**
 * Parse a strict run manifest and verify that it is bound to this already
 * migrated config. The FNV identity detects ordinary drift but is not a
 * cryptographic signature.
 */
export function parseSimulationRunManifestForConfig(
  input: unknown,
  config: SimConfig
): SimulationRunManifest {
  const manifest = simulationRunManifestSchema.parse(input);
  if (
    manifest.schemaVersion !== config.schemaVersion ||
    manifest.engineVersion !== config.engineVersion ||
    manifest.dataVersion !== config.dataVersion ||
    manifest.configHash !== createSimulationConfigHash(config)
  ) {
    throw new Error(
      "Simulation run manifest is not bound to the supplied migrated config."
    );
  }
  return manifest;
}

export const point2DSchema = z
  .object({
    x: spatialCoordinateSchema,
    y: spatialCoordinateSchema
  })
  .strict();

export const playerElementalResistancesSchema = z
  .object({
    pyro: finiteNumber.min(-10).max(10),
    cryo: finiteNumber.min(-10).max(10),
    hydro: finiteNumber.min(-10).max(10),
    electro: finiteNumber.min(-10).max(10),
    anemo: finiteNumber.min(-10).max(10),
    geo: finiteNumber.min(-10).max(10),
    dendro: finiteNumber.min(-10).max(10),
    physical: finiteNumber.min(-10).max(10)
  })
  .strict();

export const playerReactionSelfCharacterStateSchema = z
  .object({
    actorId: idSchema,
    initialHpRatio: finiteNumber.min(0).max(1),
    resistances: playerElementalResistancesSchema
  })
  .strict();

export const playerDamageModelSchema = z.discriminatedUnion(
  "mode",
  [
    z
      .object({
        mode: z.literal("disabled")
      })
      .strict(),
    z
      .object({
        mode: z.literal("reaction-self-v1"),
        position: point2DSchema,
        hitboxRadius: finiteNumber.positive().max(1_000),
        shieldMode: z.literal("crystallize-v1"),
        zeroHpPolicy: z.literal("clamp-and-continue"),
        characters: z
          .array(playerReactionSelfCharacterStateSchema)
          .min(1)
          .max(4)
      })
      .strict()
  ]
);

export const playerSelfDamageStatusSchema = z.enum([
  "unsupported-player-damage-model",
  "modeled-player-reaction-damage"
]);

const derivedPoint2DSchema = z
  .object({
    x: finiteNumber,
    y: finiteNumber
  })
  .strict();

const resolvedCircleHitGeometrySchema = z
  .object({
    kind: z.literal("circle"),
    coordinateSpace: z.literal("world"),
    origin: derivedPoint2DSchema,
    radius: finiteNumber.positive().max(1_000)
  })
  .strict();

const resolvedRectangleHitGeometrySchema = z
  .object({
    kind: z.literal("rectangle"),
    coordinateSpace: z.literal("world"),
    origin: derivedPoint2DSchema,
    halfWidth: finiteNumber.positive().max(1_000),
    halfHeight: finiteNumber.positive().max(1_000),
    rotationDegrees: finiteNumber.min(-360).max(360)
  })
  .strict();

const resolvedCapsuleHitGeometrySchema = z
  .object({
    kind: z.literal("capsule"),
    coordinateSpace: z.literal("world"),
    start: derivedPoint2DSchema,
    end: derivedPoint2DSchema,
    radius: finiteNumber.nonnegative().max(1_000)
  })
  .strict();

const resolvedSectorHitGeometrySchema = z
  .object({
    kind: z.literal("sector"),
    coordinateSpace: z.literal("world"),
    origin: derivedPoint2DSchema,
    radius: finiteNumber.positive().max(1_000),
    directionDegrees: finiteNumber.min(-360).max(360),
    angleDegrees: finiteNumber.positive().max(360)
  })
  .strict();

export const resolvedWorldHitGeometrySchema = z.discriminatedUnion(
  "kind",
  [
    resolvedCircleHitGeometrySchema,
    resolvedRectangleHitGeometrySchema,
    resolvedCapsuleHitGeometrySchema,
    resolvedSectorHitGeometrySchema
  ]
);

export const elementSchema = z.enum([
  "pyro",
  "cryo",
  "hydro",
  "electro",
  "anemo",
  "geo",
  "dendro",
  "physical"
]);

export const reactionSchema = z.enum([
  "none",
  "melt",
  "reverseMelt",
  "vaporize",
  "reverseVaporize"
]);

export const scalingStatSchema = z.enum(["atk", "hp", "def", "em"]);

export const elementalApplicationSchema = z
  .object({
    gaugeUnits: finiteNumber.positive().max(20),
    icdTag: idSchema,
    icdGroup: idSchema
  })
  .strict();

export const initialAuraApplicationSchema = z
  .object({
    element: z.enum(["pyro", "cryo", "hydro", "electro", "dendro"]),
    gaugeUnits: finiteNumber.positive().max(20)
  })
  .strict();

export const auraReactionEngineConfigSchema = z
  .object({
    mode: z.enum([
      "aura-v1",
      "aura-v2",
      "aura-v3",
      "aura-v4",
      "aura-v5"
    ]),
    initialAura: z.array(initialAuraApplicationSchema).max(5).optional(),
    icdProfiles: z
      .record(
        idSchema,
        z
          .object({
            resetFrames: z.number().int().positive().max(36_000),
            applicationSequence: z.array(z.boolean()).min(1).max(128)
          })
          .strict()
      )
      .optional(),
    debugAllowReactionOverride: z.boolean().optional()
  })
  .strict()
  .superRefine((engine, context) => {
    const elements = new Set<string>();
    engine.initialAura?.forEach((aura, index) => {
      if (engine.mode === "aura-v1" && aura.element === "electro") {
        context.addIssue({
          code: "custom",
          path: ["initialAura", index, "element"],
          message:
            "electro aura requires reactionEngine.mode to be aura-v2, aura-v3, aura-v4, or aura-v5"
        });
      }
      if (
        engine.mode !== "aura-v3" &&
        engine.mode !== "aura-v4" &&
        engine.mode !== "aura-v5" &&
        aura.element === "dendro"
      ) {
        context.addIssue({
          code: "custom",
          path: ["initialAura", index, "element"],
          message:
            "dendro aura requires reactionEngine.mode to be aura-v3, aura-v4, or aura-v5"
        });
      }
      if (elements.has(aura.element)) {
        context.addIssue({
          code: "custom",
          path: ["initialAura", index, "element"],
          message: `duplicate initial aura element "${aura.element}"`
        });
      }
      elements.add(aura.element);
    });
    for (const builtIn of ["default", "no-icd", "burning"]) {
      if (engine.icdProfiles?.[builtIn] !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["icdProfiles", builtIn],
          message: `"${builtIn}" is a built-in ICD group and cannot be overridden`
        });
      }
    }
  });

export const auraStateElementSchema = z.enum([
  "pyro",
  "cryo",
  "hydro",
  "electro",
  "dendro",
  "quicken",
  "frozen",
  "burning",
  "burningFuel"
]);

export const auraSourceGaugeSlotSchema = z
  .object({
    sourceActorId: wireNonEmptyStringSchema,
    gaugeUnits: finiteNumber.nonnegative()
  })
  .strict();

export const auraSourceGaugeMutationSchema = z
  .object({
    sourceActorId: wireNonEmptyStringSchema,
    gaugeUnitsBefore: finiteNumber.nonnegative(),
    consumedGaugeUnits: finiteNumber.nonnegative(),
    gaugeUnitsAfter: finiteNumber.nonnegative()
  })
  .strict();

export const auraStateEntrySchema = z
  .object({
    element: auraStateElementSchema,
    gaugeUnits: finiteNumber.nonnegative(),
    expiresAtFrame: z.number().int().nonnegative().nullable(),
    sourceSlots: z.array(auraSourceGaugeSlotSchema).optional()
  })
  .strict();

export const auraGaugeEntrySchema = z
  .object({
    element: z.enum([
      "pyro",
      "cryo",
      "hydro",
      "electro",
      "dendro",
      "quicken",
      "frozen",
      "burning",
      "burningFuel",
      "anemo",
      "geo"
    ]),
    gaugeUnits: finiteNumber.nonnegative(),
    sourceActorId: wireNonEmptyStringSchema.optional(),
    sourceMutations: z.array(auraSourceGaugeMutationSchema).optional()
  })
  .strict();

type AuraStateWireEntry = z.infer<typeof auraStateEntrySchema>;

function auraStateSnapshotsEqual(
  left: readonly AuraStateWireEntry[],
  right: readonly AuraStateWireEntry[]
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Validate an Aura-only clock advance between two emitted observations.
 *
 * A clock advance may decay or expire existing state. It cannot create Aura,
 * increase durability, extend a deadline, or add a source slot: each of those
 * requires an explicit mutation point.
 */
function auraStateOnlyDecreases(
  before: readonly AuraStateWireEntry[],
  after: readonly AuraStateWireEntry[],
  frame: number
): string | null {
  const beforeByElement = new Map(
    before.map((entry) => [entry.element, entry] as const)
  );
  if (beforeByElement.size !== before.length) {
    return "Aura snapshots cannot contain duplicate elements";
  }
  if (new Set(after.map((entry) => entry.element)).size !== after.length) {
    return "Aura snapshots cannot contain duplicate elements";
  }

  for (const afterEntry of after) {
    const beforeEntry = beforeByElement.get(afterEntry.element);
    if (beforeEntry === undefined) {
      return `Aura clock advance cannot add ${afterEntry.element}`;
    }
    if (afterEntry.gaugeUnits > beforeEntry.gaugeUnits) {
      return `Aura clock advance cannot increase ${afterEntry.element} durability`;
    }
    if (
      beforeEntry.expiresAtFrame !== null &&
      (afterEntry.expiresAtFrame === null ||
        afterEntry.expiresAtFrame > beforeEntry.expiresAtFrame)
    ) {
      return `Aura clock advance cannot extend ${afterEntry.element} expiry`;
    }

    const beforeSlots = new Map(
      (beforeEntry.sourceSlots ?? []).map(
        (slot) => [slot.sourceActorId, slot] as const
      )
    );
    if (
      beforeSlots.size !== (beforeEntry.sourceSlots ?? []).length ||
      new Set(
        (afterEntry.sourceSlots ?? []).map(
          (slot) => slot.sourceActorId
        )
      ).size !== (afterEntry.sourceSlots ?? []).length
    ) {
      return `${afterEntry.element} source slots must be unique by actor`;
    }
    for (const afterSlot of afterEntry.sourceSlots ?? []) {
      const beforeSlot = beforeSlots.get(afterSlot.sourceActorId);
      if (beforeSlot === undefined) {
        return `Aura clock advance cannot add ${afterEntry.element} source slot ${afterSlot.sourceActorId}`;
      }
      if (afterSlot.gaugeUnits > beforeSlot.gaugeUnits) {
        return `Aura clock advance cannot increase ${afterEntry.element} source slot ${afterSlot.sourceActorId}`;
      }
    }
  }

  const afterElements = new Set(after.map((entry) => entry.element));
  for (const beforeEntry of before) {
    if (
      !afterElements.has(beforeEntry.element) &&
      (beforeEntry.expiresAtFrame === null ||
        beforeEntry.expiresAtFrame > frame)
    ) {
      return `Aura clock advance cannot remove unexpired ${beforeEntry.element}`;
    }
  }
  return null;
}

export const reactionTypeSchema = z.enum([
  "none",
  "melt",
  "reverseMelt",
  "vaporize",
  "reverseVaporize",
  "overload",
  "superconduct",
  "electroCharged",
  "burning",
  "bloom",
  "burgeon",
  "hyperbloom",
  "shatter",
  "swirlPyro",
  "swirlHydro",
  "swirlCryo",
  "swirlElectro",
  "freeze",
  "quicken",
  "crystallizePyro",
  "crystallizeHydro",
  "crystallizeCryo",
  "crystallizeElectro",
  "aggravate",
  "spread"
]);

const amplifyingReactionTypes = new Set([
  "melt",
  "reverseMelt",
  "vaporize",
  "reverseVaporize"
]);

export const simulationEventTypeSchema = z.enum([
  "action",
  "buff",
  "debuff",
  "energy",
  "particleSpawn",
  "particleReceive",
  "hit",
  "reactionDamage",
  "periodicReactionTick",
  "periodicReactionWane",
  "periodicReactionExpiry",
  "burningTick",
  "burningFuelExpiry",
  "dendroCoreSpawn",
  "dendroCoreExpiry",
  "frozenExpiry",
  "quickenExpiry",
  "crystallizeShardSpawn",
  "crystallizeShardExpiry",
  "crystallizePickup",
  "crystallizeShieldExpiry"
]);

export const targetStateTimelineLinkSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("damage-event"),
      id: z.number().int().nonnegative()
    })
    .strict(),
  z
    .object({
      kind: z.literal("reaction-damage-log"),
      id: z.number().int().nonnegative()
    })
    .strict(),
  z
    .object({
      kind: z.literal("periodic-reaction-log"),
      id: z.number().int().nonnegative()
    })
    .strict(),
  z
    .object({
      kind: z.literal("frozen-state-log"),
      id: z.number().int().nonnegative()
    })
    .strict(),
  z
    .object({
      kind: z.literal("quicken-state-log"),
      id: z.number().int().nonnegative()
    })
    .strict(),
  z
    .object({
      kind: z.literal("burning-state-log"),
      id: z.number().int().nonnegative()
    })
    .strict(),
  z
    .object({
      kind: z.literal("target-mechanics-truncation-log"),
      id: z.number().int().nonnegative()
    })
    .strict()
]);

export const targetStateTimelinePointKindSchema = z.enum([
  "boundary",
  "derived",
  "observation",
  "mutation"
]);

export const targetStateTimelineCauseSchema = z.enum([
  "simulation-start",
  "simulation-end",
  "aura-natural-expiry",
  "direct-hit-shatter",
  "direct-hit-application",
  "reaction-damage-application",
  "reaction-damage-shatter",
  "frozen-expiry",
  "quicken-expiry",
  "electro-charged-expiry",
  "electro-charged-tick",
  "electro-charged-wane",
  "burning-fuel-expiry",
  "burning-tick",
  "target-mechanics-truncation"
]);

export const targetStateTimelinePointSchema = z
  .object({
    id: z.number().int().nonnegative(),
    frame: z.number().int().nonnegative(),
    timeSeconds: finiteNumber.nonnegative(),
    targetId: wireNonEmptyStringSchema,
    targetName: wireNonEmptyStringSchema,
    pointKind: targetStateTimelinePointKindSchema,
    cause: targetStateTimelineCauseSchema,
    eventType: simulationEventTypeSchema.nullable(),
    eventPriority: finiteNumber.nonnegative().nullable(),
    eventSequence: z.number().int().nonnegative().nullable(),
    intraEventSequence: z.number().int().nonnegative().nullable(),
    reaction: reactionTypeSchema,
    reactions: z.array(reactionTypeSchema),
    primaryDamageEventId: z.number().int().nonnegative().nullable(),
    links: z.array(targetStateTimelineLinkSchema),
    auraBefore: z.array(auraStateEntrySchema),
    auraApplied: z.array(auraGaugeEntrySchema),
    auraConsumed: z.array(auraGaugeEntrySchema),
    auraAfter: z.array(auraStateEntrySchema)
  })
  .strict()
  .superRefine((point, context) => {
    const issue = (path: string, message: string): void => {
      context.addIssue({ code: "custom", path: [path], message });
    };
    const eventTuple = [
      point.eventType,
      point.eventPriority,
      point.eventSequence,
      point.intraEventSequence
    ];
    const boundaryCause =
      point.cause === "simulation-start" ||
      point.cause === "simulation-end";
    const derivedCause = point.cause === "aura-natural-expiry";
    const hasAuraMutation =
      point.auraApplied.length > 0 ||
      point.auraConsumed.length > 0 ||
      !auraStateSnapshotsEqual(point.auraBefore, point.auraAfter);

    if (point.pointKind === "boundary") {
      if (!eventTuple.every((value) => value === null)) {
        issue(
          "eventType",
          "boundary points must not carry an event ordering tuple"
        );
      }
      if (!boundaryCause) {
        issue(
          "cause",
          "boundary points require simulation-start or simulation-end"
        );
      }
      if (!auraStateSnapshotsEqual(point.auraBefore, point.auraAfter)) {
        issue(
          "auraAfter",
          "boundary points must preserve an exact Aura snapshot"
        );
      }
      if (
        point.auraApplied.length !== 0 ||
        point.auraConsumed.length !== 0
      ) {
        issue(
          "auraApplied",
          "boundary points cannot claim an application or consumption"
        );
      }
      if (
        point.reaction !== "none" ||
        point.reactions.length !== 0
      ) {
        issue("reaction", "boundary points cannot claim a reaction");
      }
      if (
        point.primaryDamageEventId !== null ||
        point.links.length !== 0
      ) {
        issue("links", "boundary points cannot carry damage or log links");
      }
    } else if (point.pointKind === "derived") {
      if (!eventTuple.every((value) => value === null)) {
        issue(
          "eventType",
          "derived points must not carry an event ordering tuple"
        );
      }
      if (!derivedCause) {
        issue("cause", "derived points require aura-natural-expiry");
      }
      if (!hasAuraMutation) {
        issue(
          "auraAfter",
          "aura-natural-expiry must change the target Aura state"
        );
      }
      const decreaseIssue = auraStateOnlyDecreases(
        point.auraBefore,
        point.auraAfter,
        point.frame
      );
      if (decreaseIssue !== null) {
        issue(
          "auraAfter",
          `aura-natural-expiry may only decrease existing Aura: ${decreaseIssue}`
        );
      }
      if (
        !point.auraBefore.some(
          (entry) =>
            entry.expiresAtFrame !== null &&
            entry.expiresAtFrame <= point.frame
        )
      ) {
        issue(
          "auraBefore",
          "aura-natural-expiry requires an Aura deadline at or before its frame"
        );
      }
      if (
        point.primaryDamageEventId !== null ||
        point.links.length !== 0
      ) {
        issue(
          "links",
          "aura-natural-expiry cannot carry damage or log links"
        );
      }
      if (
        point.reaction !== "none" ||
        point.reactions.length !== 0
      ) {
        issue(
          "reaction",
          "aura-natural-expiry cannot claim a reaction"
        );
      }
      if (
        point.auraApplied.length !== 0 ||
        point.auraConsumed.length !== 0
      ) {
        issue(
          "auraApplied",
          "aura-natural-expiry cannot claim an application or consumption"
        );
      }
    } else {
      if (eventTuple.some((value) => value === null)) {
        issue(
          "eventType",
          "event points require eventType, priority, sequence, and intra-event sequence"
        );
      }
      if (boundaryCause) {
        issue(
          "cause",
          "simulation boundary causes require pointKind=boundary"
        );
      }
      if (derivedCause) {
        issue(
          "cause",
          "aura-natural-expiry requires pointKind=derived"
        );
      }
      if (point.pointKind === "observation" && hasAuraMutation) {
        issue(
          "pointKind",
          "observation points cannot apply, consume, or change Aura"
        );
      }
      if (point.pointKind === "mutation" && !hasAuraMutation) {
        issue(
          "pointKind",
          "mutation points must apply, consume, or change Aura"
        );
      }
    }

    if (point.reactions.includes("none")) {
      issue(
        "reactions",
        "the ordered reactions list cannot contain the none sentinel"
      );
    }
    const primaryAmplifyingReaction = point.reactions
      .filter((reaction) =>
        amplifyingReactionTypes.has(reaction)
      )
      .at(-1);
    const expectedPrimaryReaction =
      primaryAmplifyingReaction ??
      point.reactions[0] ??
      "none";
    if (point.reaction !== expectedPrimaryReaction) {
      issue(
        "reaction",
        "reaction must equal the last amplifying reaction, otherwise the first ordered reaction, or none when reactions is empty"
      );
    }

    if (
      point.cause === "simulation-start" &&
      (point.frame !== 0 || point.timeSeconds !== 0)
    ) {
      issue(
        "frame",
        "simulation-start must be recorded at frame 0 and time 0"
      );
    }

    const requiredEventTypeByCause = {
      "direct-hit-shatter": "hit",
      "direct-hit-application": "hit",
      "reaction-damage-application": "reactionDamage",
      "reaction-damage-shatter": "reactionDamage",
      "frozen-expiry": "frozenExpiry",
      "quicken-expiry": "quickenExpiry",
      "electro-charged-expiry": "periodicReactionExpiry",
      "electro-charged-tick": "periodicReactionTick",
      "electro-charged-wane": "periodicReactionWane",
      "burning-fuel-expiry": "burningFuelExpiry",
      "burning-tick": "burningTick"
    } as const;
    if (
      point.cause in requiredEventTypeByCause &&
      point.eventType !==
        requiredEventTypeByCause[
          point.cause as keyof typeof requiredEventTypeByCause
        ]
    ) {
      issue(
        "eventType",
        `${point.cause} requires eventType=${requiredEventTypeByCause[
          point.cause as keyof typeof requiredEventTypeByCause
        ]}`
      );
    }
    if (
      point.cause === "target-mechanics-truncation" &&
      point.eventType !== "hit" &&
      point.eventType !== "reactionDamage"
    ) {
      issue(
        "eventType",
        "target-mechanics-truncation requires a hit or reactionDamage event"
      );
    }

    const linkKeys = new Set<string>();
    for (const [index, link] of point.links.entries()) {
      const key = `${link.kind}:${link.id}`;
      if (linkKeys.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["links", index],
          message: `duplicate timeline link "${key}"`
        });
      }
      linkKeys.add(key);
    }

    if (
      point.primaryDamageEventId !== null &&
      !point.links.some(
        (link) =>
          link.kind === "damage-event" &&
          link.id === point.primaryDamageEventId
      )
    ) {
      issue(
        "primaryDamageEventId",
        "primaryDamageEventId requires a matching damage-event link"
      );
    }
  });

export const targetStateTimelineSchema = z
  .object({
    version: z.literal("1.0.0"),
    points: z.array(targetStateTimelinePointSchema).min(1)
  })
  .strict()
  .superRefine((timeline, context) => {
    let previousFrame = -1;
    let eventTupleFrame = -1;
    let previousEventTuple: readonly [number, number, number] | null = null;
    const targetTrackers = new Map<
      string,
      {
        targetName: string;
        firstPointIndex: number;
        startCount: number;
        endCount: number;
        ended: boolean;
        previousPoint: (typeof timeline.points)[number];
      }
    >();

    timeline.points.forEach((point, index) => {
      if (point.id !== index) {
        context.addIssue({
          code: "custom",
          path: ["points", index, "id"],
          message: `timeline point ids must be zero-based and contiguous; expected ${index}`
        });
      }
      if (point.frame < previousFrame) {
        context.addIssue({
          code: "custom",
          path: ["points", index, "frame"],
          message: `timeline frames must be nondecreasing; previous frame was ${previousFrame}`
        });
      }
      previousFrame = point.frame;

      const existingTracker = targetTrackers.get(point.targetId);
      if (existingTracker === undefined) {
        targetTrackers.set(point.targetId, {
          targetName: point.targetName,
          firstPointIndex: index,
          startCount: point.cause === "simulation-start" ? 1 : 0,
          endCount: point.cause === "simulation-end" ? 1 : 0,
          ended: point.cause === "simulation-end",
          previousPoint: point
        });
        if (point.cause !== "simulation-start") {
          context.addIssue({
            code: "custom",
            path: ["points", index, "cause"],
            message:
              "the first point for each target must be simulation-start"
          });
        }
      } else {
        if (point.targetName !== existingTracker.targetName) {
          context.addIssue({
            code: "custom",
            path: ["points", index, "targetName"],
            message: `targetName must remain stable for target "${point.targetId}"`
          });
        }
        if (existingTracker.ended) {
          context.addIssue({
            code: "custom",
            path: ["points", index, "cause"],
            message: `target "${point.targetId}" cannot emit points after simulation-end`
          });
        }
        if (point.cause === "simulation-start") {
          existingTracker.startCount += 1;
          context.addIssue({
            code: "custom",
            path: ["points", index, "cause"],
            message: `target "${point.targetId}" must have exactly one simulation-start boundary`
          });
        }
        if (point.cause === "simulation-end") {
          existingTracker.endCount += 1;
          existingTracker.ended = true;
        }

        if (point.frame >= existingTracker.previousPoint.frame) {
          const continuityIssue =
            point.frame === existingTracker.previousPoint.frame
              ? auraStateSnapshotsEqual(
                  existingTracker.previousPoint.auraAfter,
                  point.auraBefore
                )
                ? null
                : "same-frame auraBefore must exactly equal the previous auraAfter"
              : auraStateOnlyDecreases(
                  existingTracker.previousPoint.auraAfter,
                  point.auraBefore,
                  point.frame
                );
          if (continuityIssue !== null) {
            context.addIssue({
              code: "custom",
              path: ["points", index, "auraBefore"],
              message: `target Aura timeline is discontinuous: ${continuityIssue}`
            });
          }
        }
        existingTracker.previousPoint = point;
      }

      if (point.frame !== eventTupleFrame) {
        eventTupleFrame = point.frame;
        previousEventTuple = null;
      }
      if (
        point.eventPriority !== null &&
        point.eventSequence !== null &&
        point.intraEventSequence !== null
      ) {
        const tuple = [
          point.eventPriority,
          point.eventSequence,
          point.intraEventSequence
        ] as const;
        if (
          previousEventTuple !== null &&
          (tuple[0] < previousEventTuple[0] ||
            (tuple[0] === previousEventTuple[0] &&
              tuple[1] < previousEventTuple[1]) ||
            (tuple[0] === previousEventTuple[0] &&
              tuple[1] === previousEventTuple[1] &&
              tuple[2] <= previousEventTuple[2]))
        ) {
          context.addIssue({
            code: "custom",
            path: ["points", index, "eventPriority"],
            message:
              "same-frame event points must be ordered by priority, sequence, and intra-event sequence"
          });
        }
        previousEventTuple = tuple;
      }
    });

    for (const [targetId, tracker] of targetTrackers) {
      if (tracker.startCount !== 1) {
        context.addIssue({
          code: "custom",
          path: ["points", tracker.firstPointIndex, "cause"],
          message: `target "${targetId}" must have exactly one simulation-start boundary`
        });
      }
      if (tracker.endCount !== 1) {
        context.addIssue({
          code: "custom",
          path: ["points", tracker.firstPointIndex, "cause"],
          message: `target "${targetId}" must have exactly one simulation-end boundary`
        });
      }
    }
  });

const quickenDecayMutationEpsilon = 1e-9;
const quickenDecayEndCauseSchema = z
  .enum(["QUICKEN_DECAY", "BURNING_FUEL_EXPIRED"])
  .nullable();

export const quickenDecayMutationAuditSchema = z
  .object({
    operation: z.enum(["none", "decay-rebase", "remove"]),
    generationBefore: z.number().int().nonnegative(),
    generationAfter: z.number().int().nonnegative(),
    quickenGaugeUnitsBefore: finiteNumber.nonnegative(),
    quickenGaugeUnitsAfter: finiteNumber.nonnegative(),
    decayPerFrameBefore: finiteNumber.nonnegative(),
    decayPerFrameAfter: finiteNumber.nonnegative(),
    expiresAtFrameBefore: z
      .number()
      .int()
      .nonnegative()
      .nullable(),
    expiresAtFrameAfter: z
      .number()
      .int()
      .nonnegative()
      .nullable(),
    endCauseBefore: quickenDecayEndCauseSchema,
    endCauseAfter: quickenDecayEndCauseSchema,
    operationAuraBefore: z.array(auraStateEntrySchema),
    operationAuraAfter: z.array(auraStateEntrySchema)
  })
  .strict()
  .superRefine((mutation, context) => {
    const issue = (
      field: keyof typeof mutation,
      message: string
    ): void => {
      context.addIssue({
        code: "custom",
        path: [field],
        message
      });
    };
    const approximatelyEqualDecay = (
      left: number,
      right: number
    ): boolean =>
      Math.abs(left - right) <= quickenDecayMutationEpsilon;
    const validateState = (
      side: "Before" | "After"
    ): void => {
      const snapshotField =
        `operationAura${side}` as const;
      const gaugeField =
        `quickenGaugeUnits${side}` as const;
      const decayField =
        `decayPerFrame${side}` as const;
      const expiryField =
        `expiresAtFrame${side}` as const;
      const endCauseField =
        `endCause${side}` as const;
      const snapshot = mutation[snapshotField];
      const gaugeUnits = mutation[gaugeField];
      const decayPerFrame = mutation[decayField];
      const expiresAtFrame = mutation[expiryField];
      const endCause = mutation[endCauseField];
      if (
        new Set(snapshot.map((entry) => entry.element)).size !==
        snapshot.length
      ) {
        issue(
          snapshotField,
          "Quicken decay operation snapshot cannot contain duplicate elements"
        );
      }
      const quicken = snapshot.find(
        (entry) => entry.element === "quicken"
      );
      if (gaugeUnits <= quickenDecayMutationEpsilon) {
        if (quicken !== undefined) {
          issue(
            snapshotField,
            "zero Quicken Gauge requires no Quicken snapshot entry"
          );
        }
        if (!approximatelyEqualDecay(decayPerFrame, 0)) {
          issue(
            decayField,
            "absent Quicken state requires zero decay"
          );
        }
        if (expiresAtFrame !== null || endCause !== null) {
          issue(
            expiryField,
            "absent Quicken state requires null expiry and end cause"
          );
        }
        return;
      }
      if (
        quicken === undefined ||
        !approximatelyEqualDecay(
          quicken.gaugeUnits,
          gaugeUnits
        ) ||
        quicken.expiresAtFrame !== expiresAtFrame
      ) {
        issue(
          snapshotField,
          "Quicken snapshot must match the audited Gauge and expiry"
        );
      }
      if (
        decayPerFrame <= 0 ||
        expiresAtFrame === null ||
        endCause === null
      ) {
        issue(
          decayField,
          "active Quicken state requires positive decay, expiry, and end cause"
        );
      }
    };

    validateState("Before");
    validateState("After");
    if (
      !auraStateSnapshotsEqual(
        mutation.operationAuraBefore.filter(
          (entry) => entry.element !== "quicken"
        ),
        mutation.operationAuraAfter.filter(
          (entry) => entry.element !== "quicken"
        )
      )
    ) {
      issue(
        "operationAuraAfter",
        "Quicken decay operation may only change the Quicken slot"
      );
    }

    if (mutation.operation === "none") {
      if (
        mutation.generationAfter !== mutation.generationBefore ||
        !approximatelyEqualDecay(
          mutation.quickenGaugeUnitsAfter,
          mutation.quickenGaugeUnitsBefore
        ) ||
        !approximatelyEqualDecay(
          mutation.decayPerFrameAfter,
          mutation.decayPerFrameBefore
        ) ||
        mutation.expiresAtFrameAfter !==
          mutation.expiresAtFrameBefore ||
        mutation.endCauseAfter !== mutation.endCauseBefore ||
        !auraStateSnapshotsEqual(
          mutation.operationAuraBefore,
          mutation.operationAuraAfter
        )
      ) {
        issue(
          "operation",
          "operation=none must preserve the complete Quicken state"
        );
      }
      return;
    }

    if (
      mutation.generationAfter !==
      mutation.generationBefore + 1
    ) {
      issue(
        "generationAfter",
        "Quicken decay mutation must advance generation exactly once"
      );
    }
    if (mutation.operation === "decay-rebase") {
      if (
        mutation.quickenGaugeUnitsBefore <=
          quickenDecayMutationEpsilon ||
        !approximatelyEqualDecay(
          mutation.quickenGaugeUnitsAfter,
          mutation.quickenGaugeUnitsBefore
        )
      ) {
        issue(
          "quickenGaugeUnitsAfter",
          "decay-rebase must preserve a positive Quicken Gauge"
        );
      }
      if (
        mutation.expiresAtFrameAfter === null ||
        mutation.endCauseAfter === null ||
        mutation.decayPerFrameAfter <= 0
      ) {
        issue(
          "expiresAtFrameAfter",
          "decay-rebase requires active decay, expiry, and end cause"
        );
      }
      if (
        approximatelyEqualDecay(
          mutation.decayPerFrameAfter,
          mutation.decayPerFrameBefore
        ) &&
        mutation.expiresAtFrameAfter ===
          mutation.expiresAtFrameBefore &&
        mutation.endCauseAfter === mutation.endCauseBefore
      ) {
        issue(
          "operation",
          "decay-rebase must change decay, expiry, or end cause"
        );
      }
      return;
    }

    if (
      mutation.quickenGaugeUnitsBefore <=
        quickenDecayMutationEpsilon ||
      !approximatelyEqualDecay(
        mutation.quickenGaugeUnitsAfter,
        0
      ) ||
      !approximatelyEqualDecay(mutation.decayPerFrameAfter, 0) ||
      mutation.expiresAtFrameAfter !== null ||
      mutation.endCauseAfter !== null
    ) {
      issue(
        "operation",
        "remove requires an active pre-state and an empty post-state"
      );
    }
  });

export const burningReactionAuditSchema = z
  .object({
    reaction: z.literal("burning"),
    operation: z.enum([
      "start",
      "refresh-fuel",
      "refresh-snapshot",
      "stop"
    ]),
    reactionTriggered: z.boolean(),
    generation: z.number().int().nonnegative(),
    triggerElement: elementSchema,
    fuelOperation: z.enum([
      "start",
      "overwrite",
      "unchanged",
      "remove"
    ]),
    stopReason: z.literal("BURNING_AURA_CONSUMED").nullable(),
    scheduled: z.boolean(),
    blockedReason: z
      .literal("TARGET_MECHANICS_TRUNCATION")
      .nullable(),
    damageSourceActorId: idSchema,
    fuelSourceActorId: idSchema.nullable(),
    burningGaugeUnitsBefore: finiteNumber.nonnegative(),
    candidateBurningGaugeUnits: finiteNumber.nonnegative(),
    burningGaugeUnitsAfter: finiteNumber.nonnegative(),
    burningDecayPerFrame: z.literal(0),
    burningExpiresAtFrame: z.null(),
    fuelGaugeUnitsBefore: finiteNumber.nonnegative(),
    candidateFuelGaugeUnits: finiteNumber.nonnegative(),
    fuelGaugeUnitsAfter: finiteNumber.nonnegative(),
    fuelDecayPerFrame: finiteNumber.nonnegative(),
    fuelExpiresAtFrame: z.number().int().nonnegative().nullable(),
    quickenStateMutation: quickenDecayMutationAuditSchema,
    snapshotFrame: z.number().int().nonnegative(),
    clockModel: z.literal("target-local-no-hitlag"),
    hitlagStatus: z.literal("unsupported-enemy-hitlag"),
    firstTickFrame: z.number().int().nonnegative().nullable(),
    nextTickFrame: z.number().int().nonnegative().nullable(),
    tickIntervalFrames: z.literal(15),
    skippedTickIndex: z.literal(9),
    damageElement: z.literal("pyro"),
    baseMultiplier: z.literal(0.25),
    radius: z.literal(1),
    applicationGaugeUnits: z.literal(1),
    selfDamageStatus: playerSelfDamageStatusSchema
  })
  .strict()
  .superRefine((audit, context) => {
    const issue = (path: string, message: string): void => {
      context.addIssue({ code: "custom", path: [path], message });
    };
    const expectedFuelOperation = {
      start: "start",
      "refresh-fuel": "overwrite",
      "refresh-snapshot": "unchanged",
      stop: "remove"
    } as const;
    if (audit.fuelOperation !== expectedFuelOperation[audit.operation]) {
      issue(
        "fuelOperation",
        `${audit.operation} requires fuelOperation=${expectedFuelOperation[audit.operation]}`
      );
    }
    const quickenMutation = audit.quickenStateMutation;
    const quickenLifecycleApproximatelyEqual = (
      left: number,
      right: number
    ): boolean =>
      Math.abs(left - right) <= quickenDecayMutationEpsilon;
    const quickenBeforeActive =
      quickenMutation.quickenGaugeUnitsBefore >
      quickenDecayMutationEpsilon;
    const quickenAfterActive =
      quickenMutation.quickenGaugeUnitsAfter >
      quickenDecayMutationEpsilon;
    if (
      audit.operation === "refresh-snapshot" &&
      quickenMutation.operation !== "none"
    ) {
      issue(
        "quickenStateMutation",
        "refresh-snapshot cannot change the Quicken lifetime"
      );
    }
    const isFuelAttachBoundary =
      audit.operation === "start" ||
      audit.operation === "refresh-fuel";
    if (
      isFuelAttachBoundary &&
      audit.blockedReason === null
    ) {
      if (
        quickenBeforeActive !== quickenAfterActive ||
        !quickenLifecycleApproximatelyEqual(
          quickenMutation.quickenGaugeUnitsAfter,
          quickenMutation.quickenGaugeUnitsBefore
        )
      ) {
        issue(
          "quickenStateMutation",
          `${audit.operation} must preserve the complete Quicken Gauge`
        );
      }
      if (quickenAfterActive) {
        if (quickenMutation.operation !== "decay-rebase") {
          issue(
            "quickenStateMutation",
            `${audit.operation} with active Quicken requires a real Fuel-driven decay rebase`
          );
        }
        if (
          audit.fuelDecayPerFrame <=
            quickenDecayMutationEpsilon ||
          audit.fuelExpiresAtFrame === null
        ) {
          issue(
            "quickenStateMutation",
            "Fuel-driven Quicken rebase requires positive Fuel decay and an expiry frame"
          );
        } else {
          if (
            !quickenLifecycleApproximatelyEqual(
              quickenMutation.decayPerFrameAfter,
              audit.fuelDecayPerFrame
            )
          ) {
            issue(
              "quickenStateMutation",
              "Fuel-driven Quicken rebase must use the Burning Fuel decay rate"
            );
          }
          const quickenDecayExpiryFrame =
            audit.snapshotFrame +
            Math.max(
              0,
              Math.ceil(
                quickenMutation.quickenGaugeUnitsAfter /
                  audit.fuelDecayPerFrame -
                  quickenDecayMutationEpsilon
              )
            );
          const fuelOwnsExpiry =
            audit.fuelExpiresAtFrame <=
            quickenDecayExpiryFrame;
          const expectedEndCause = fuelOwnsExpiry
            ? "BURNING_FUEL_EXPIRED"
            : "QUICKEN_DECAY";
          const expectedExpiryFrame = fuelOwnsExpiry
            ? audit.fuelExpiresAtFrame
            : quickenDecayExpiryFrame;
          if (
            quickenMutation.endCauseAfter !==
              expectedEndCause ||
            quickenMutation.expiresAtFrameAfter !==
              expectedExpiryFrame
          ) {
            issue(
              "quickenStateMutation",
              "Fuel-driven Quicken expiry must use the earlier Fuel or Quicken boundary, with Fuel winning ties"
            );
          }
        }
      } else if (quickenMutation.operation !== "none") {
        issue(
          "quickenStateMutation",
          `${audit.operation} without active Quicken requires operation=none`
        );
      }
    }
    if (audit.operation === "stop") {
      if (quickenBeforeActive !== quickenAfterActive) {
        issue(
          "quickenStateMutation",
          "Burning stop must preserve any residual Quicken Gauge"
        );
      } else if (quickenAfterActive) {
        if (
          quickenMutation.operation !== "decay-rebase" ||
          !quickenLifecycleApproximatelyEqual(
            quickenMutation.quickenGaugeUnitsAfter,
            quickenMutation.quickenGaugeUnitsBefore
          )
        ) {
          issue(
            "quickenStateMutation",
            "Burning stop with residual Quicken requires a Gauge-preserving decay rebase"
          );
        }
        if (
          quickenMutation.decayPerFrameAfter <=
          quickenDecayMutationEpsilon
        ) {
          issue(
            "quickenStateMutation",
            "Burning stop must restore positive intrinsic Quicken decay"
          );
        } else {
          const intrinsicExpiryFrame =
            audit.snapshotFrame +
            Math.max(
              0,
              Math.ceil(
                quickenMutation.quickenGaugeUnitsAfter /
                  quickenMutation.decayPerFrameAfter -
                  quickenDecayMutationEpsilon
              )
            );
          if (
            quickenMutation.endCauseAfter !==
              "QUICKEN_DECAY" ||
            quickenMutation.expiresAtFrameAfter !==
              intrinsicExpiryFrame
          ) {
            issue(
              "quickenStateMutation",
              "Burning stop must restore residual Quicken to its intrinsic decay expiry"
            );
          }
        }
      } else if (quickenMutation.operation !== "none") {
        issue(
          "quickenStateMutation",
          "Burning stop without residual Quicken requires operation=none"
        );
      }
    }
    if (audit.operation === "stop") {
      if (audit.reactionTriggered) {
        issue(
          "reactionTriggered",
          "stop cannot report a newly triggered Burning reaction"
        );
      }
      if (audit.stopReason !== "BURNING_AURA_CONSUMED") {
        issue(
          "stopReason",
          "stop requires stopReason=BURNING_AURA_CONSUMED"
        );
      }
      if (audit.burningGaugeUnitsAfter !== 0) {
        issue("burningGaugeUnitsAfter", "stop requires a depleted marker");
      }
      if (audit.fuelGaugeUnitsAfter !== 0) {
        issue("fuelGaugeUnitsAfter", "stop requires removed Fuel");
      }
      if (audit.fuelExpiresAtFrame !== null) {
        issue("fuelExpiresAtFrame", "stop cannot retain a Fuel expiry");
      }
      if (audit.firstTickFrame !== null || audit.nextTickFrame !== null) {
        issue("nextTickFrame", "stop cannot retain a Burning tick");
      }
      if (audit.scheduled || audit.blockedReason !== null) {
        issue(
          "scheduled",
          "stop is a state removal and cannot schedule a Burning stream"
        );
      }
      return;
    }
    if (audit.stopReason !== null) {
      issue("stopReason", "only stop may declare a stopReason");
    }
    if (
      audit.reactionTriggered !==
      (audit.operation === "start")
    ) {
      issue(
        "reactionTriggered",
        `${audit.operation} requires reactionTriggered=${audit.operation === "start"}`
      );
    }
    if (audit.triggerElement !== "pyro" && audit.triggerElement !== "dendro") {
      issue(
        "triggerElement",
        `${audit.operation} requires a Pyro or Dendro trigger`
      );
    }
    if (
      audit.operation === "refresh-fuel" &&
      audit.triggerElement !== "dendro"
    ) {
      issue("triggerElement", "refresh-fuel requires a Dendro trigger");
    }
    if (
      audit.operation === "refresh-snapshot" &&
      audit.triggerElement !== "pyro"
    ) {
      issue("triggerElement", "refresh-snapshot requires a Pyro trigger");
    }
    if (audit.blockedReason === "TARGET_MECHANICS_TRUNCATION") {
      if (audit.scheduled) {
        issue("scheduled", "a truncated Burning stream cannot be scheduled");
      }
      if (audit.firstTickFrame !== null || audit.nextTickFrame !== null) {
        issue(
          "nextTickFrame",
          "a truncated Burning stream cannot retain a tick"
        );
      }
      if (
        audit.burningGaugeUnitsAfter !== 0 ||
        audit.fuelGaugeUnitsAfter !== 0 ||
        audit.fuelExpiresAtFrame !== null
      ) {
        issue(
          "fuelGaugeUnitsAfter",
          "a truncated Burning stream cannot retain marker or Fuel state"
        );
      }
    } else if (!audit.scheduled) {
      issue(
        "scheduled",
        `${audit.operation} must schedule or retain the Burning stream`
      );
    } else {
      if (audit.burningGaugeUnitsAfter <= 0) {
        issue(
          "burningGaugeUnitsAfter",
          `${audit.operation} requires an active Burning marker`
        );
      }
      if (audit.fuelGaugeUnitsAfter <= 0) {
        issue(
          "fuelGaugeUnitsAfter",
          `${audit.operation} requires active Burning Fuel`
        );
      }
      if (audit.fuelExpiresAtFrame === null) {
        issue(
          "fuelExpiresAtFrame",
          `${audit.operation} requires a Fuel expiry frame`
        );
      }
      if (audit.nextTickFrame === null) {
        issue(
          "nextTickFrame",
          `${audit.operation} requires a retained Burning tick`
        );
      }
      if (audit.operation === "start") {
        if (audit.firstTickFrame === null) {
          issue(
            "firstTickFrame",
            "start requires its first Burning tick frame"
          );
        } else if (
          audit.nextTickFrame !== audit.firstTickFrame
        ) {
          issue(
            "nextTickFrame",
            "start requires nextTickFrame to equal firstTickFrame"
          );
        }
      } else if (audit.firstTickFrame !== null) {
        issue(
          "firstTickFrame",
          `${audit.operation} cannot restart the first-tick cadence`
        );
      }
    }
  });

const bloomGaugeEpsilon = 1e-9;
const approximatelyEqual = (
  left: number,
  right: number
): boolean => Math.abs(left - right) <= bloomGaugeEpsilon;

const validateQuickenOperationSnapshots = ({
  context,
  before,
  after,
  beforeGaugeUnits,
  afterGaugeUnits,
  beforeExpiryFrame,
  afterExpiryFrame,
  pathPrefix
}: {
  context: z.RefinementCtx;
  before: AuraStateWireEntry[];
  after: AuraStateWireEntry[];
  beforeGaugeUnits: number;
  afterGaugeUnits: number;
  beforeExpiryFrame?: number | null;
  afterExpiryFrame: number | null;
  pathPrefix: Array<string | number>;
}): void => {
  const issue = (
    field: "operationAuraBefore" | "operationAuraAfter",
    message: string
  ): void => {
    context.addIssue({
      code: "custom",
      path: [...pathPrefix, field],
      message
    });
  };
  const validateSnapshot = (
    field: "operationAuraBefore" | "operationAuraAfter",
    snapshot: AuraStateWireEntry[],
    expectedGaugeUnits: number,
    expectedExpiryFrame: number | null | undefined
  ): void => {
    if (
      new Set(snapshot.map((entry) => entry.element)).size !==
      snapshot.length
    ) {
      issue(field, "Aura snapshot cannot contain duplicate elements");
    }
    const quickenEntries = snapshot.filter(
      (entry) => entry.element === "quicken"
    );
    if (quickenEntries.length > 1) {
      issue(field, "Aura snapshot cannot contain duplicate Quicken entries");
      return;
    }
    const quicken = quickenEntries[0];
    if (expectedGaugeUnits <= bloomGaugeEpsilon) {
      if (quicken !== undefined) {
        issue(
          field,
          "zero Quicken Gauge requires no Quicken snapshot entry"
        );
      }
      return;
    }
    if (quicken === undefined) {
      issue(
        field,
        "positive Quicken Gauge requires a Quicken snapshot entry"
      );
      return;
    }
    if (
      !approximatelyEqual(
        quicken.gaugeUnits,
        expectedGaugeUnits
      )
    ) {
      issue(
        field,
        "Quicken snapshot Gauge must match the scalar audit"
      );
    }
    if (
      expectedExpiryFrame !== undefined &&
      quicken.expiresAtFrame !== expectedExpiryFrame
    ) {
      issue(
        field,
        "Quicken snapshot expiry must match the scalar audit"
      );
    }
  };

  validateSnapshot(
    "operationAuraBefore",
    before,
    beforeGaugeUnits,
    beforeExpiryFrame
  );
  validateSnapshot(
    "operationAuraAfter",
    after,
    afterGaugeUnits,
    afterExpiryFrame
  );
  if (
    !auraStateSnapshotsEqual(
      before.filter((entry) => entry.element !== "quicken"),
      after.filter((entry) => entry.element !== "quicken")
    )
  ) {
    issue(
      "operationAuraAfter",
      "a Quicken operation cannot mutate non-Quicken Aura state"
    );
  }
};

export const quickenReactionAuditSchema = z
  .object({
    reaction: z.literal("quicken"),
    triggerElement: z.enum(["dendro", "electro"]),
    consumedAuraElement: z.enum(["dendro", "electro"]),
    sourceGaugeUnitsBefore: finiteNumber.nonnegative(),
    sourceGaugeUnitsSpent: finiteNumber.nonnegative(),
    sourceGaugeUnitsAfter: finiteNumber.nonnegative(),
    auraGaugeUnitsBefore: finiteNumber.nonnegative(),
    auraConsumedGaugeUnits: finiteNumber.nonnegative(),
    auraGaugeUnitsAfter: finiteNumber.nonnegative(),
    quickenGaugeUnitsBefore: finiteNumber.nonnegative(),
    candidateGaugeUnits: finiteNumber.nonnegative(),
    quickenGaugeUnitsAfter: finiteNumber.nonnegative(),
    operation: z.enum(["start", "refresh", "unchanged"]),
    generation: z.number().int().nonnegative(),
    decayPerFrameBefore: finiteNumber.nonnegative(),
    expiresAtFrameBefore: z
      .number()
      .int()
      .nonnegative()
      .nullable(),
    endCauseBefore: quickenDecayEndCauseSchema,
    decayPerFrame: finiteNumber.nonnegative(),
    expiresAtFrame: z.number().int().nonnegative().nullable(),
    endCause: z.enum([
      "QUICKEN_DECAY",
      "BURNING_FUEL_EXPIRED"
    ]),
    operationAuraBefore: z.array(auraStateEntrySchema),
    operationAuraAfter: z.array(auraStateEntrySchema),
    pendingHydroBloomFollowup: z.boolean()
  })
  .strict()
  .superRefine((audit, context) => {
    validateQuickenOperationSnapshots({
      context,
      before: audit.operationAuraBefore,
      after: audit.operationAuraAfter,
      beforeGaugeUnits: audit.quickenGaugeUnitsBefore,
      afterGaugeUnits: audit.quickenGaugeUnitsAfter,
      beforeExpiryFrame: audit.expiresAtFrameBefore,
      afterExpiryFrame: audit.expiresAtFrame,
      pathPrefix: []
    });
    if (
      !approximatelyEqual(
        audit.sourceGaugeUnitsAfter,
        audit.sourceGaugeUnitsBefore -
          audit.sourceGaugeUnitsSpent
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceGaugeUnitsAfter"],
        message: "Quicken source Gauge requires after = before - spent"
      });
    }
    if (
      !approximatelyEqual(
        audit.auraGaugeUnitsAfter,
        audit.auraGaugeUnitsBefore -
          audit.auraConsumedGaugeUnits
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["auraGaugeUnitsAfter"],
        message: "Quicken opposing Aura requires after = before - consumed"
      });
    }
    if (audit.triggerElement === audit.consumedAuraElement) {
      context.addIssue({
        code: "custom",
        path: ["consumedAuraElement"],
        message:
          "Quicken must consume the opposite Dendro/Electro Aura"
      });
    }
    const maximumConsumedGaugeUnits = Math.min(
      audit.sourceGaugeUnitsBefore,
      audit.auraGaugeUnitsBefore
    );
    if (
      !approximatelyEqual(
        audit.sourceGaugeUnitsSpent,
        maximumConsumedGaugeUnits
      ) ||
      !approximatelyEqual(
        audit.auraConsumedGaugeUnits,
        maximumConsumedGaugeUnits
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceGaugeUnitsSpent"],
        message:
          "Quicken must consume the maximum shared incoming/opposing Gauge budget"
      });
    }
    if (
      !approximatelyEqual(
        audit.candidateGaugeUnits,
        maximumConsumedGaugeUnits
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["candidateGaugeUnits"],
        message:
          "Quicken candidate Gauge must equal the consumed shared Gauge budget"
      });
    }
    const hasHydroAfterOperation =
      (audit.operationAuraAfter.find(
        (entry) => entry.element === "hydro"
      )?.gaugeUnits ?? 0) > bloomGaugeEpsilon;
    if (
      audit.pendingHydroBloomFollowup !== hasHydroAfterOperation
    ) {
      context.addIssue({
        code: "custom",
        path: ["pendingHydroBloomFollowup"],
        message:
          "pendingHydroBloomFollowup must match retained Hydro in the operation snapshot"
      });
    }
    if (
      audit.quickenGaugeUnitsAfter <= bloomGaugeEpsilon ||
      audit.decayPerFrame <= 0 ||
      audit.expiresAtFrame === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["quickenGaugeUnitsAfter"],
        message:
          "Quicken formation requires positive Gauge, decay, and an expiry frame"
      });
    }
    if (audit.quickenGaugeUnitsBefore <= bloomGaugeEpsilon) {
      if (
        audit.decayPerFrameBefore !== 0 ||
        audit.expiresAtFrameBefore !== null ||
        audit.endCauseBefore !== null
      ) {
        context.addIssue({
          code: "custom",
          path: ["decayPerFrameBefore"],
          message:
            "absent pre-operation Quicken requires zero decay and null expiry/end cause"
        });
      }
    } else if (
      audit.decayPerFrameBefore <= 0 ||
      audit.expiresAtFrameBefore === null ||
      audit.endCauseBefore === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["decayPerFrameBefore"],
        message:
          "active pre-operation Quicken requires decay, expiry, and end cause"
      });
    }
    if (audit.operation === "start") {
      if (audit.quickenGaugeUnitsBefore > bloomGaugeEpsilon) {
        context.addIssue({
          code: "custom",
          path: ["operation"],
          message: "start requires no pre-existing Quicken state"
        });
      }
      if (
        !approximatelyEqual(
          audit.quickenGaugeUnitsAfter,
          audit.candidateGaugeUnits
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["quickenGaugeUnitsAfter"],
          message: "start must attach the candidate Quicken Gauge"
        });
      }
    } else if (audit.operation === "refresh") {
      if (audit.quickenGaugeUnitsBefore <= bloomGaugeEpsilon) {
        context.addIssue({
          code: "custom",
          path: ["operation"],
          message: "refresh requires a pre-existing Quicken state"
        });
      }
      if (
        !approximatelyEqual(
          audit.quickenGaugeUnitsAfter,
          audit.candidateGaugeUnits
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["quickenGaugeUnitsAfter"],
          message: "refresh must attach the candidate Quicken Gauge"
        });
      }
      if (
        audit.candidateGaugeUnits + bloomGaugeEpsilon <
        audit.quickenGaugeUnitsBefore
      ) {
        context.addIssue({
          code: "custom",
          path: ["operation"],
          message:
            "refresh requires candidate Quicken Gauge at least as strong as the existing state"
        });
      }
    } else {
      if (
        !approximatelyEqual(
          audit.quickenGaugeUnitsAfter,
          audit.quickenGaugeUnitsBefore
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["quickenGaugeUnitsAfter"],
          message: "unchanged must preserve the Quicken Gauge"
        });
      }
      if (
        !approximatelyEqual(
          audit.decayPerFrame,
          audit.decayPerFrameBefore
        ) ||
        audit.expiresAtFrame !== audit.expiresAtFrameBefore ||
        audit.endCause !== audit.endCauseBefore
      ) {
        context.addIssue({
          code: "custom",
          path: ["decayPerFrame"],
          message:
            "unchanged must preserve Quicken decay, expiry, and end cause"
        });
      }
      if (
        !auraStateSnapshotsEqual(
          audit.operationAuraBefore,
          audit.operationAuraAfter
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["operationAuraAfter"],
          message: "unchanged must preserve the complete Aura snapshot"
        });
      }
      if (
        audit.candidateGaugeUnits + bloomGaugeEpsilon >=
        audit.quickenGaugeUnitsBefore
      ) {
        context.addIssue({
          code: "custom",
          path: ["operation"],
          message:
            "unchanged requires a strictly weaker candidate Quicken Gauge"
        });
      }
    }
  });

export const quickenStateLogEntrySchema = z
  .object({
    id: z.number().int().nonnegative(),
    reaction: z.literal("quicken"),
    generation: z.number().int().nonnegative(),
    operation: z.enum([
      "start",
      "refresh",
      "unchanged",
      "decay-rebase",
      "partial-consume",
      "remove",
      "expire"
    ]),
    frame: z.number().int().nonnegative(),
    timeSeconds: finiteNumber.nonnegative(),
    targetId: wireNonEmptyStringSchema,
    targetName: wireNonEmptyStringSchema,
    sourceActorId: wireNonEmptyStringSchema.nullable(),
    triggerDamageEventId: z
      .number()
      .int()
      .nonnegative()
      .nullable(),
    triggerElement: z.enum(["dendro", "electro"]).nullable(),
    consumedAuraElement: z
      .enum(["dendro", "electro"])
      .nullable(),
    candidateGaugeUnits: finiteNumber.nonnegative(),
    quickenGaugeUnitsBefore: finiteNumber.nonnegative(),
    quickenGaugeUnitsAfter: finiteNumber.nonnegative(),
    decayPerFrameBefore: finiteNumber.nonnegative(),
    decayPerFrameAfter: finiteNumber.nonnegative(),
    expiresAtFrameBefore: z
      .number()
      .int()
      .nonnegative()
      .nullable(),
    auraBefore: z.array(auraStateEntrySchema),
    auraAfter: z.array(auraStateEntrySchema),
    expiresAtFrame: z.number().int().nonnegative().nullable(),
    endCauseBefore: quickenDecayEndCauseSchema,
    endCauseAfter: quickenDecayEndCauseSchema,
    reason: z.string().min(1).nullable()
  })
  .strict()
  .superRefine((entry, context) => {
    if (
      Math.abs(entry.timeSeconds - entry.frame / 60) >
      bloomGaugeEpsilon
    ) {
      context.addIssue({
        code: "custom",
        path: ["timeSeconds"],
        message: "must equal frame / 60"
      });
    }
    validateQuickenOperationSnapshots({
      context,
      before: entry.auraBefore,
      after: entry.auraAfter,
      beforeGaugeUnits: entry.quickenGaugeUnitsBefore,
      afterGaugeUnits: entry.quickenGaugeUnitsAfter,
      beforeExpiryFrame: entry.expiresAtFrameBefore,
      afterExpiryFrame: entry.expiresAtFrame,
      pathPrefix: []
    });
    const validateLifecycleSide = (
      side: "Before" | "After",
      gaugeUnits: number,
      decayPerFrame: number,
      expiresAtFrame: number | null,
      endCause:
        | "QUICKEN_DECAY"
        | "BURNING_FUEL_EXPIRED"
        | null
    ): void => {
      if (gaugeUnits <= bloomGaugeEpsilon) {
        if (
          decayPerFrame !== 0 ||
          expiresAtFrame !== null ||
          endCause !== null
        ) {
          context.addIssue({
            code: "custom",
            path: [`decayPerFrame${side}`],
            message:
              "inactive Quicken requires zero decay and null expiry/end cause"
          });
        }
      } else if (
        decayPerFrame <= 0 ||
        expiresAtFrame === null ||
        endCause === null
      ) {
        context.addIssue({
          code: "custom",
          path: [`decayPerFrame${side}`],
          message:
            "active Quicken requires positive decay, expiry, and end cause"
        });
      }
    };
    validateLifecycleSide(
      "Before",
      entry.quickenGaugeUnitsBefore,
      entry.decayPerFrameBefore,
      entry.expiresAtFrameBefore,
      entry.endCauseBefore
    );
    validateLifecycleSide(
      "After",
      entry.quickenGaugeUnitsAfter,
      entry.decayPerFrameAfter,
      entry.expiresAtFrame,
      entry.endCauseAfter
    );

    const beforeActive =
      entry.quickenGaugeUnitsBefore > bloomGaugeEpsilon;
    const afterActive =
      entry.quickenGaugeUnitsAfter > bloomGaugeEpsilon;
    if (entry.operation === "start") {
      if (beforeActive || !afterActive) {
        context.addIssue({
          code: "custom",
          path: ["operation"],
          message: "start requires inactive before and active after"
        });
      }
    } else if (
      entry.operation === "refresh" ||
      entry.operation === "unchanged"
    ) {
      if (!beforeActive || !afterActive) {
        context.addIssue({
          code: "custom",
          path: ["operation"],
          message: `${entry.operation} requires active Quicken before and after`
        });
      }
      if (
        entry.operation === "unchanged" &&
        (!approximatelyEqual(
          entry.quickenGaugeUnitsAfter,
          entry.quickenGaugeUnitsBefore
        ) ||
          !approximatelyEqual(
            entry.decayPerFrameAfter,
            entry.decayPerFrameBefore
          ) ||
          entry.expiresAtFrame !== entry.expiresAtFrameBefore ||
          entry.endCauseAfter !== entry.endCauseBefore ||
          !auraStateSnapshotsEqual(entry.auraBefore, entry.auraAfter))
      ) {
        context.addIssue({
          code: "custom",
          path: ["operation"],
          message: "unchanged must preserve the complete Quicken state"
        });
      }
    } else if (entry.operation === "decay-rebase") {
      if (
        !beforeActive ||
        !afterActive ||
        !approximatelyEqual(
          entry.quickenGaugeUnitsAfter,
          entry.quickenGaugeUnitsBefore
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["operation"],
          message:
            "decay-rebase must preserve a positive Quicken Gauge"
        });
      }
    } else if (entry.operation === "partial-consume") {
      if (
        !beforeActive ||
        !afterActive ||
        entry.quickenGaugeUnitsAfter >=
          entry.quickenGaugeUnitsBefore
      ) {
        context.addIssue({
          code: "custom",
          path: ["operation"],
          message:
            "partial-consume requires a smaller positive Quicken Gauge"
        });
      }
    } else if (entry.operation === "remove" || entry.operation === "expire") {
      if (!beforeActive || afterActive) {
        context.addIssue({
          code: "custom",
          path: ["operation"],
          message: `${entry.operation} requires active before and inactive after`
        });
      }
    }

    const isAttachDecision =
      entry.operation === "start" ||
      entry.operation === "refresh" ||
      entry.operation === "unchanged";
    if (
      isAttachDecision !==
      (entry.triggerElement !== null &&
        entry.consumedAuraElement !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["triggerElement"],
        message:
          "only Quicken attach decisions carry trigger and consumed Aura elements"
      });
    }
    if (
      !isAttachDecision &&
      entry.candidateGaugeUnits !== 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["candidateGaugeUnits"],
        message:
          "lifecycle mutations after attach require candidateGaugeUnits=0"
      });
    }
  });

export const bloomQuickenStateMutationAuditSchema = z
  .object({
    operation: z.enum([
      "none",
      "decay-rebase",
      "partial-consume",
      "remove"
    ]),
    generationBefore: z.number().int().nonnegative(),
    generationAfter: z.number().int().nonnegative(),
    decayPerFrameBefore: finiteNumber.nonnegative(),
    decayPerFrameAfter: finiteNumber.nonnegative(),
    expiresAtFrameBefore: z
      .number()
      .int()
      .nonnegative()
      .nullable(),
    expiresAtFrameAfter: z
      .number()
      .int()
      .nonnegative()
      .nullable(),
    endCauseBefore: quickenDecayEndCauseSchema,
    endCauseAfter: quickenDecayEndCauseSchema,
    operationAuraBefore: z.array(auraStateEntrySchema),
    operationAuraAfter: z.array(auraStateEntrySchema)
  })
  .strict();

export const bloomBurningFuelStateMutationAuditSchema = z
  .object({
    operation: z.enum([
      "none",
      "expiry-rebase",
      "deplete-pending-purge"
    ]),
    generation: z.number().int().positive().nullable(),
    decayPerFrame: finiteNumber.nonnegative(),
    expiresAtFrameBefore: z
      .number()
      .int()
      .nonnegative()
      .nullable(),
    expiresAtFrameAfter: z
      .number()
      .int()
      .nonnegative()
      .nullable()
  })
  .strict()
  .superRefine((mutation, context) => {
    if (mutation.generation === null) {
      if (
        mutation.operation !== "none" ||
        mutation.decayPerFrame !== 0 ||
        mutation.expiresAtFrameBefore !== null ||
        mutation.expiresAtFrameAfter !== null
      ) {
        context.addIssue({
          code: "custom",
          path: ["generation"],
          message:
            "an absent Burning stream requires operation=none, zero decay, and null expiry boundaries"
        });
      }
      return;
    }
    if (
      mutation.decayPerFrame <= 0 ||
      mutation.expiresAtFrameBefore === null ||
      mutation.expiresAtFrameAfter === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["decayPerFrame"],
        message:
          "an active Burning stream requires positive Fuel decay and explicit before/after expiry boundaries"
      });
    }
  });

export const bloomReactionAuditSchema = z
  .object({
    reaction: z.literal("bloom"),
    operation: z.enum(["direct", "quicken-followup"]),
    triggerElement: z.enum(["hydro", "dendro", "electro"]),
    sourceActorId: wireNonEmptyStringSchema,
    triggerFrame: z.number().int().nonnegative(),
    sourceBudget: z.enum([
      "incoming-application",
      "quicken-state"
    ]),
    sourceGaugeUnitsBefore: finiteNumber.nonnegative(),
    sourceGaugeUnitsSpent: finiteNumber.nonnegative(),
    sourceGaugeUnitsAfter: finiteNumber.nonnegative(),
    hydroGaugeUnitsBefore: finiteNumber.nonnegative(),
    hydroConsumedGaugeUnits: finiteNumber.nonnegative(),
    hydroGaugeUnitsAfter: finiteNumber.nonnegative(),
    dendroGaugeUnitsBefore: finiteNumber.nonnegative(),
    dendroConsumedGaugeUnits: finiteNumber.nonnegative(),
    dendroGaugeUnitsAfter: finiteNumber.nonnegative(),
    quickenGaugeUnitsBefore: finiteNumber.nonnegative(),
    quickenConsumedGaugeUnits: finiteNumber.nonnegative(),
    quickenGaugeUnitsAfter: finiteNumber.nonnegative(),
    quickenStateMutation:
      bloomQuickenStateMutationAuditSchema,
    burningFuelGaugeUnitsBefore: finiteNumber.nonnegative(),
    burningFuelConsumedGaugeUnits: finiteNumber.nonnegative(),
    burningFuelGaugeUnitsAfter: finiteNumber.nonnegative(),
    burningFuelStateMutation:
      bloomBurningFuelStateMutationAuditSchema,
    scheduled: z.boolean(),
    coreSpawnFrame: z.number().int().nonnegative().nullable(),
    coreSpawnDelayFrames: z.literal(30),
    blockedReason: z
      .literal("TARGET_MECHANICS_TRUNCATION")
      .nullable(),
    mechanicsDataStatus: z.literal("fixed-gcsim-provisional"),
    selfDamageStatus: playerSelfDamageStatusSchema
  })
  .strict()
  .superRefine((audit, context) => {
    const issue = (path: string, message: string): void => {
      context.addIssue({ code: "custom", path: [path], message });
    };
    const validateConservation = (
      prefix: "source" | "hydro" | "dendro" | "quicken" | "burningFuel",
      before: number,
      consumed: number,
      after: number
    ): void => {
      if (!approximatelyEqual(after, before - consumed)) {
        issue(
          `${prefix}GaugeUnitsAfter`,
          `${prefix} gauge requires after = before - consumed`
        );
      }
    };

    validateConservation(
      "source",
      audit.sourceGaugeUnitsBefore,
      audit.sourceGaugeUnitsSpent,
      audit.sourceGaugeUnitsAfter
    );
    validateConservation(
      "hydro",
      audit.hydroGaugeUnitsBefore,
      audit.hydroConsumedGaugeUnits,
      audit.hydroGaugeUnitsAfter
    );
    validateConservation(
      "dendro",
      audit.dendroGaugeUnitsBefore,
      audit.dendroConsumedGaugeUnits,
      audit.dendroGaugeUnitsAfter
    );
    validateConservation(
      "quicken",
      audit.quickenGaugeUnitsBefore,
      audit.quickenConsumedGaugeUnits,
      audit.quickenGaugeUnitsAfter
    );
    validateConservation(
      "burningFuel",
      audit.burningFuelGaugeUnitsBefore,
      audit.burningFuelConsumedGaugeUnits,
      audit.burningFuelGaugeUnitsAfter
    );

    const mutation = audit.quickenStateMutation;
    const mutationIssue = (
      field: keyof typeof mutation,
      message: string
    ): void => {
      context.addIssue({
        code: "custom",
        path: ["quickenStateMutation", field],
        message
      });
    };
    const quickenLifecycleChanged =
      !approximatelyEqual(
        mutation.decayPerFrameAfter,
        mutation.decayPerFrameBefore
      ) ||
      mutation.expiresAtFrameAfter !==
        mutation.expiresAtFrameBefore ||
      mutation.endCauseAfter !== mutation.endCauseBefore ||
      !auraStateSnapshotsEqual(
        mutation.operationAuraBefore,
        mutation.operationAuraAfter
      );
    const expectedMutationOperation =
      audit.quickenConsumedGaugeUnits > bloomGaugeEpsilon
        ? audit.quickenGaugeUnitsAfter <= bloomGaugeEpsilon
          ? "remove"
          : "partial-consume"
        : quickenLifecycleChanged
          ? "decay-rebase"
          : "none";
    const mutationSnapshotIssue = (
      field: "operationAuraBefore" | "operationAuraAfter",
      message: string
    ): void => {
      mutationIssue(field, message);
    };
    const validateMutationSnapshot = (
      field: "operationAuraBefore" | "operationAuraAfter",
      snapshot: AuraStateWireEntry[],
      expectedGaugeUnits: number,
      expectedExpiresAtFrame: number | null
    ): void => {
      if (
        new Set(snapshot.map((entry) => entry.element)).size !==
        snapshot.length
      ) {
        mutationSnapshotIssue(
          field,
          "Quicken mutation Aura snapshots cannot contain duplicate elements"
        );
      }
      const quickenEntries = snapshot.filter(
        (entry) => entry.element === "quicken"
      );
      if (expectedGaugeUnits <= bloomGaugeEpsilon) {
        if (quickenEntries.length !== 0) {
          mutationSnapshotIssue(
            field,
            "zero Quicken Gauge requires the Quicken slot to be absent from the operation snapshot"
          );
        }
        return;
      }
      if (
        quickenEntries.length !== 1 ||
        !approximatelyEqual(
          quickenEntries[0]?.gaugeUnits ?? 0,
          expectedGaugeUnits
        ) ||
        quickenEntries[0]?.expiresAtFrame !== expectedExpiresAtFrame
      ) {
        mutationSnapshotIssue(
          field,
          "operation snapshot Quicken slot must match the audited Gauge and expiry"
        );
      }
    };
    validateMutationSnapshot(
      "operationAuraBefore",
      mutation.operationAuraBefore,
      audit.quickenGaugeUnitsBefore,
      mutation.expiresAtFrameBefore
    );
    validateMutationSnapshot(
      "operationAuraAfter",
      mutation.operationAuraAfter,
      audit.quickenGaugeUnitsAfter,
      mutation.expiresAtFrameAfter
    );
    if (
      !auraStateSnapshotsEqual(
        mutation.operationAuraBefore.filter(
          (entry) => entry.element !== "quicken"
        ),
        mutation.operationAuraAfter.filter(
          (entry) => entry.element !== "quicken"
        )
      )
    ) {
      mutationSnapshotIssue(
        "operationAuraAfter",
        "Quicken mutation operation snapshots may only change the Quicken slot"
      );
    }
    if (mutation.operation !== expectedMutationOperation) {
      mutationIssue(
        "operation",
        `Quicken lifecycle operation must be ${expectedMutationOperation} for this Bloom Gauge mutation`
      );
    }
    const validateQuickenLifecycleSide = (
      side: "Before" | "After",
      gaugeUnits: number
    ): void => {
      const decayField = `decayPerFrame${side}` as const;
      const expiryField = `expiresAtFrame${side}` as const;
      const endCauseField = `endCause${side}` as const;
      const decayPerFrame = mutation[decayField];
      const expiresAtFrame = mutation[expiryField];
      const endCause = mutation[endCauseField];
      if (gaugeUnits <= bloomGaugeEpsilon) {
        if (
          !approximatelyEqual(decayPerFrame, 0) ||
          expiresAtFrame !== null ||
          endCause !== null
        ) {
          mutationIssue(
            decayField,
            "absent Quicken state requires zero decay and null expiry/end cause"
          );
        }
        return;
      }
      if (
        decayPerFrame <= 0 ||
        expiresAtFrame === null ||
        endCause === null
      ) {
        mutationIssue(
          decayField,
          "active Quicken state requires positive decay, expiry, and end cause"
        );
        return;
      }
      const intrinsicExpiryFrame =
        audit.triggerFrame +
        Math.max(
          0,
          Math.ceil(gaugeUnits / decayPerFrame - 1e-9)
        );
      if (
        (endCause === "QUICKEN_DECAY" &&
          expiresAtFrame !== intrinsicExpiryFrame) ||
        (endCause === "BURNING_FUEL_EXPIRED" &&
          expiresAtFrame > intrinsicExpiryFrame)
      ) {
        mutationIssue(
          expiryField,
          endCause === "QUICKEN_DECAY"
            ? "Quicken-owned expiry must equal the remaining Gauge decay boundary"
            : "Fuel-owned expiry cannot occur after intrinsic Quicken decay"
        );
      }
    };
    validateQuickenLifecycleSide(
      "Before",
      audit.quickenGaugeUnitsBefore
    );
    validateQuickenLifecycleSide(
      "After",
      audit.quickenGaugeUnitsAfter
    );
    if (mutation.operation === "none") {
      if (
        !approximatelyEqual(
          audit.quickenConsumedGaugeUnits,
          0
        )
      ) {
        mutationIssue(
          "operation",
          "operation=none requires zero Quicken consumption"
        );
      }
      if (
        mutation.generationAfter !== mutation.generationBefore
      ) {
        mutationIssue(
          "generationAfter",
          "operation=none must preserve the Quicken generation"
        );
      }
      if (
        !approximatelyEqual(
          mutation.decayPerFrameAfter,
          mutation.decayPerFrameBefore
        ) ||
        mutation.expiresAtFrameAfter !==
          mutation.expiresAtFrameBefore ||
        mutation.endCauseAfter !== mutation.endCauseBefore
      ) {
        mutationIssue(
          "expiresAtFrameAfter",
          "operation=none must preserve Quicken decay, expiry, and end cause"
        );
      }
      if (
        !auraStateSnapshotsEqual(
          mutation.operationAuraBefore,
          mutation.operationAuraAfter
        )
      ) {
        mutationIssue(
          "operationAuraAfter",
          "operation=none must preserve the complete Aura snapshot"
        );
      }
    } else if (mutation.operation === "decay-rebase") {
      if (
        !approximatelyEqual(
          audit.quickenConsumedGaugeUnits,
          0
        ) ||
        audit.quickenGaugeUnitsBefore <= bloomGaugeEpsilon ||
        !approximatelyEqual(
          audit.quickenGaugeUnitsAfter,
          audit.quickenGaugeUnitsBefore
        )
      ) {
        mutationIssue(
          "operation",
          "decay-rebase requires an unchanged positive Quicken Gauge and zero Quicken consumption"
        );
      }
      if (
        mutation.generationAfter !==
        mutation.generationBefore + 1
      ) {
        mutationIssue(
          "generationAfter",
          "Quicken lifecycle rebase must advance the generation exactly once"
        );
      }
    } else {
      if (
        audit.quickenConsumedGaugeUnits <= bloomGaugeEpsilon
      ) {
        mutationIssue(
          "operation",
          `${mutation.operation} requires positive Quicken consumption`
        );
      }
      if (
        mutation.generationAfter !==
        mutation.generationBefore + 1
      ) {
        mutationIssue(
          "generationAfter",
          "Quicken consumption must advance the generation exactly once"
        );
      }
      if (mutation.operation === "partial-consume") {
        if (
          audit.quickenGaugeUnitsAfter <= bloomGaugeEpsilon ||
          audit.quickenGaugeUnitsAfter >=
            audit.quickenGaugeUnitsBefore
        ) {
          mutationIssue(
            "operation",
            "partial-consume requires positive remaining Quicken Gauge below the pre-consumption Gauge"
          );
        }
        if (mutation.expiresAtFrameAfter === null) {
          mutationIssue(
            "expiresAtFrameAfter",
            "partial-consume requires a recomputed expiry frame"
          );
        }
        if (
          mutation.expiresAtFrameAfter !== null &&
          mutation.expiresAtFrameBefore !== null &&
          mutation.expiresAtFrameAfter >
            mutation.expiresAtFrameBefore
        ) {
          mutationIssue(
            "expiresAtFrameAfter",
            "partial Quicken consumption cannot lengthen the effective expiry"
          );
        }
      } else {
        if (
          !approximatelyEqual(
            audit.quickenGaugeUnitsAfter,
            0
          )
        ) {
          mutationIssue(
            "operation",
            "remove requires zero remaining Quicken Gauge"
          );
        }
        if (mutation.expiresAtFrameAfter !== null) {
          mutationIssue(
            "expiresAtFrameAfter",
            "remove requires a null post-consumption expiry"
          );
        }
        if (mutation.endCauseAfter !== null) {
          mutationIssue(
            "endCauseAfter",
            "remove requires a null post-consumption end cause"
          );
        }
      }
    }

    const fuelMutation = audit.burningFuelStateMutation;
    const fuelMutationIssue = (
      field: keyof typeof fuelMutation,
      message: string
    ): void => {
      context.addIssue({
        code: "custom",
        path: ["burningFuelStateMutation", field],
        message
      });
    };
    const expectedFuelMutationOperation =
      audit.burningFuelConsumedGaugeUnits <=
      bloomGaugeEpsilon
        ? "none"
        : audit.burningFuelGaugeUnitsAfter >
            bloomGaugeEpsilon
          ? "expiry-rebase"
          : "deplete-pending-purge";
    if (
      fuelMutation.operation !== expectedFuelMutationOperation
    ) {
      fuelMutationIssue(
        "operation",
        `Burning Fuel lifecycle operation must be ${expectedFuelMutationOperation} for this Bloom Gauge mutation`
      );
    }
    if (
      audit.burningFuelGaugeUnitsBefore <=
      bloomGaugeEpsilon
    ) {
      if (
        fuelMutation.generation !== null ||
        fuelMutation.decayPerFrame !== 0 ||
        fuelMutation.expiresAtFrameBefore !== null ||
        fuelMutation.expiresAtFrameAfter !== null
      ) {
        fuelMutationIssue(
          "generation",
          "Bloom without an active Burning Fuel stream requires null generation/expiry and zero decay"
        );
      }
    } else if (
      fuelMutation.generation === null ||
      fuelMutation.decayPerFrame <= 0 ||
      fuelMutation.expiresAtFrameBefore === null
    ) {
      fuelMutationIssue(
        "generation",
        "active Burning Fuel requires its stream generation, decay, and pre-mutation expiry"
      );
    } else {
      const remainingFuelFramesBefore = Math.max(
        0,
        Math.ceil(
          audit.burningFuelGaugeUnitsBefore /
            fuelMutation.decayPerFrame -
            1e-9
        )
      );
      const attachmentGraceFrames =
        fuelMutation.expiresAtFrameBefore -
        (audit.triggerFrame + remainingFuelFramesBefore);
      if (
        attachmentGraceFrames !== 0 &&
        attachmentGraceFrames !== 1
      ) {
        fuelMutationIssue(
          "expiresAtFrameBefore",
          "Burning Fuel pre-mutation expiry must equal its remaining decay boundary with at most the same-frame attachment grace"
        );
      }
      if (fuelMutation.operation === "none") {
        if (
          fuelMutation.expiresAtFrameAfter !==
          fuelMutation.expiresAtFrameBefore
        ) {
          fuelMutationIssue(
            "expiresAtFrameAfter",
            "operation=none must preserve the Burning Fuel expiry"
          );
        }
      } else if (
        fuelMutation.operation === "expiry-rebase"
      ) {
        const expectedExpiryFrame =
          audit.triggerFrame +
          attachmentGraceFrames +
          Math.max(
            0,
            Math.ceil(
              audit.burningFuelGaugeUnitsAfter /
                fuelMutation.decayPerFrame -
                1e-9
            )
          );
        if (
          fuelMutation.expiresAtFrameAfter !==
          expectedExpiryFrame
        ) {
          fuelMutationIssue(
            "expiresAtFrameAfter",
            "partial Bloom Fuel consumption must rebase expiry from the remaining Gauge using the same decay and attachment grace"
          );
        }
      } else if (
        fuelMutation.expiresAtFrameAfter !==
        audit.triggerFrame + 1
      ) {
        fuelMutationIssue(
          "expiresAtFrameAfter",
          "depleted Burning Fuel must retain its stream identity until the next-frame purge boundary"
        );
      }
    }

    if (audit.operation === "direct") {
      if (
        audit.triggerElement !== "hydro" &&
        audit.triggerElement !== "dendro"
      ) {
        issue(
          "triggerElement",
          "direct Bloom requires a Hydro or Dendro trigger"
        );
      }
      if (audit.sourceBudget !== "incoming-application") {
        issue(
          "sourceBudget",
          "direct Bloom requires sourceBudget=incoming-application"
        );
      }
      if (audit.triggerElement === "hydro") {
        if (audit.hydroConsumedGaugeUnits !== 0) {
          issue(
            "hydroConsumedGaugeUnits",
            "Hydro-triggered Bloom does not consume retained Hydro Aura"
          );
        }
        const expectedDendroConsumed = Math.min(
          audit.dendroGaugeUnitsBefore,
          audit.sourceGaugeUnitsBefore * 0.5
        );
        const expectedQuickenConsumed = Math.min(
          audit.quickenGaugeUnitsBefore,
          audit.sourceGaugeUnitsBefore * 0.5
        );
        const expectedBurningFuelConsumed = Math.min(
          audit.burningFuelGaugeUnitsBefore,
          audit.sourceGaugeUnitsBefore * 0.5
        );
        if (
          !approximatelyEqual(
            audit.dendroConsumedGaugeUnits,
            expectedDendroConsumed
          )
        ) {
          issue(
            "dendroConsumedGaugeUnits",
            "Hydro-triggered Bloom must consume min(Dendro before, source before × 0.5)"
          );
        }
        if (
          !approximatelyEqual(
            audit.quickenConsumedGaugeUnits,
            expectedQuickenConsumed
          )
        ) {
          issue(
            "quickenConsumedGaugeUnits",
            "Hydro-triggered Bloom must consume min(Quicken before, source before × 0.5)"
          );
        }
        if (
          !approximatelyEqual(
            audit.burningFuelConsumedGaugeUnits,
            expectedBurningFuelConsumed
          )
        ) {
          issue(
            "burningFuelConsumedGaugeUnits",
            "Hydro-triggered Bloom must consume min(Burning Fuel before, source before × 0.5)"
          );
        }
        const expectedSourceSpent = Math.max(
          expectedDendroConsumed / 0.5,
          expectedQuickenConsumed / 0.5,
          expectedBurningFuelConsumed / 0.5
        );
        if (
          !approximatelyEqual(
            audit.sourceGaugeUnitsSpent,
            expectedSourceSpent
          )
        ) {
          issue(
            "sourceGaugeUnitsSpent",
            "Hydro-triggered Bloom source spend must equal the maximum normalized Dendro, Quicken, or Burning Fuel consumption"
          );
        }
      } else if (audit.triggerElement === "dendro") {
        if (
          audit.dendroConsumedGaugeUnits !== 0 ||
          audit.quickenConsumedGaugeUnits !== 0 ||
          audit.burningFuelConsumedGaugeUnits !== 0
        ) {
          issue(
            "dendroConsumedGaugeUnits",
            "Dendro-triggered Bloom may only consume retained Hydro Aura"
          );
        }
        const expectedHydroConsumed = Math.min(
          audit.hydroGaugeUnitsBefore,
          audit.sourceGaugeUnitsBefore * 2
        );
        if (
          !approximatelyEqual(
            audit.hydroConsumedGaugeUnits,
            expectedHydroConsumed
          )
        ) {
          issue(
            "hydroConsumedGaugeUnits",
            "Dendro-triggered Bloom must consume min(Hydro before, source before × 2)"
          );
        }
        if (
          !approximatelyEqual(
            audit.sourceGaugeUnitsSpent,
            Math.min(
              audit.sourceGaugeUnitsBefore,
              expectedHydroConsumed / 2
            )
          )
        ) {
          issue(
            "sourceGaugeUnitsSpent",
            "Dendro-triggered Bloom source spend must equal Hydro consumption / 2"
          );
        }
      }
    } else {
      if (
        audit.triggerElement !== "dendro" &&
        audit.triggerElement !== "electro"
      ) {
        issue(
          "triggerElement",
          "Quicken-follow-up Bloom requires a Dendro or Electro trigger"
        );
      }
      if (audit.sourceBudget !== "quicken-state") {
        issue(
          "sourceBudget",
          "Quicken-follow-up Bloom requires sourceBudget=quicken-state"
        );
      }
      if (
        audit.dendroConsumedGaugeUnits !== 0 ||
        audit.burningFuelConsumedGaugeUnits !== 0
      ) {
        issue(
          "dendroConsumedGaugeUnits",
          "Quicken-follow-up Bloom cannot consume Dendro or Burning Fuel"
        );
      }
      const expectedHydroConsumed = Math.min(
        audit.hydroGaugeUnitsBefore,
        audit.sourceGaugeUnitsBefore * 2
      );
      const expectedQuickenConsumed = Math.min(
        audit.sourceGaugeUnitsBefore,
        expectedHydroConsumed / 2
      );
      if (
        !approximatelyEqual(
          audit.hydroConsumedGaugeUnits,
          expectedHydroConsumed
        )
      ) {
        issue(
          "hydroConsumedGaugeUnits",
          "Quicken-follow-up Bloom must consume min(Hydro before, Quicken before × 2)"
        );
      }
      if (
        !approximatelyEqual(
          audit.quickenConsumedGaugeUnits,
          expectedQuickenConsumed
        )
      ) {
        issue(
          "quickenConsumedGaugeUnits",
          "Quicken-follow-up Bloom must consume the normalized Hydro reduction"
        );
      }
      if (
        !approximatelyEqual(
          audit.sourceGaugeUnitsSpent,
          expectedQuickenConsumed
        ) ||
        !approximatelyEqual(
          audit.sourceGaugeUnitsSpent,
          expectedHydroConsumed / 2
        )
      ) {
        issue(
          "sourceGaugeUnitsSpent",
          "Quicken-follow-up source spend must equal Quicken consumption and Hydro consumption / 2"
        );
      }
      if (
        !approximatelyEqual(
          audit.sourceGaugeUnitsBefore,
          audit.quickenGaugeUnitsBefore
        ) ||
        !approximatelyEqual(
          audit.sourceGaugeUnitsAfter,
          audit.quickenGaugeUnitsAfter
        )
      ) {
        issue(
          "sourceGaugeUnitsBefore",
          "Quicken-follow-up source budget must mirror Quicken state"
        );
      }
    }

    if (audit.scheduled) {
      const opposingGaugeConsumed =
        audit.hydroConsumedGaugeUnits +
        audit.dendroConsumedGaugeUnits +
        audit.quickenConsumedGaugeUnits +
        audit.burningFuelConsumedGaugeUnits;
      if (
        audit.sourceGaugeUnitsSpent <= bloomGaugeEpsilon ||
        opposingGaugeConsumed <= bloomGaugeEpsilon
      ) {
        issue(
          "sourceGaugeUnitsSpent",
          "scheduled Bloom requires actual source and opposing Gauge consumption"
        );
      }
      if (audit.blockedReason !== null) {
        issue(
          "blockedReason",
          "scheduled Bloom cannot declare a blocked reason"
        );
      }
      if (
        audit.coreSpawnFrame !==
        audit.triggerFrame + audit.coreSpawnDelayFrames
      ) {
        issue(
          "coreSpawnFrame",
          "scheduled Bloom requires coreSpawnFrame = triggerFrame + 30"
        );
      }
    } else {
      if (audit.blockedReason !== "TARGET_MECHANICS_TRUNCATION") {
        issue(
          "blockedReason",
          "unscheduled Bloom requires TARGET_MECHANICS_TRUNCATION"
        );
      }
      if (audit.coreSpawnFrame !== null) {
        issue(
          "coreSpawnFrame",
          "blocked Bloom cannot retain a core spawn frame"
        );
      }
    }
  });

const reactionASequenceSchema = z.tuple([
  z.literal(true),
  z.literal(true),
  z.literal(false)
]);

export const reactionADamageGroupAuditSchema = z
  .object({
    reaction: z.enum([
      "swirlPyro",
      "swirlHydro",
      "swirlCryo",
      "swirlElectro",
      "shatter",
      "superconduct",
      "bloom",
      "burgeon",
      "hyperbloom"
    ]),
    sourceActorId: wireNonEmptyStringSchema,
    targetId: wireNonEmptyStringSchema,
    windowStartFrame: z.number().int().nonnegative(),
    hitIndex: z.number().int().nonnegative(),
    resetFrames: z.literal(30),
    sequence: reactionASequenceSchema,
    damageAllowed: z.boolean(),
    blockedReason: z.literal("REACTION_A_DAMAGE_ICD").nullable()
  })
  .strict()
  .superRefine((audit, context) => {
    const expectedAllowed = audit.hitIndex < 2;
    if (audit.damageAllowed !== expectedAllowed) {
      context.addIssue({
        code: "custom",
        path: ["damageAllowed"],
        message:
          "ReactionA permits only hitIndex 0 and 1 in each 30-frame window"
      });
    }
    const expectedReason = expectedAllowed
      ? null
      : "REACTION_A_DAMAGE_ICD";
    if (audit.blockedReason !== expectedReason) {
      context.addIssue({
        code: "custom",
        path: ["blockedReason"],
        message: expectedAllowed
          ? "an allowed ReactionA hit cannot declare a blocked reason"
          : "a blocked ReactionA hit requires REACTION_A_DAMAGE_ICD"
      });
    }
  });

const reactionBSequenceSchema = z.tuple([
  z.literal(true),
  z.literal(false)
]);

export const reactionBDamageGroupAuditSchema = z
  .object({
    reaction: z.enum(["overload", "electroCharged"]),
    sourceActorId: wireNonEmptyStringSchema,
    targetId: wireNonEmptyStringSchema,
    windowStartFrame: z.number().int().nonnegative(),
    hitIndex: z.number().int().nonnegative(),
    resetFrames: z.literal(30),
    sequence: reactionBSequenceSchema,
    damageAllowed: z.boolean(),
    blockedReason: z.literal("REACTION_B_DAMAGE_ICD").nullable()
  })
  .strict()
  .superRefine((audit, context) => {
    const expectedAllowed = audit.hitIndex === 0;
    if (audit.damageAllowed !== expectedAllowed) {
      context.addIssue({
        code: "custom",
        path: ["damageAllowed"],
        message:
          "ReactionB permits only hitIndex 0 in each 30-frame window"
      });
    }
    const expectedReason = expectedAllowed
      ? null
      : "REACTION_B_DAMAGE_ICD";
    if (audit.blockedReason !== expectedReason) {
      context.addIssue({
        code: "custom",
        path: ["blockedReason"],
        message: expectedAllowed
          ? "an allowed ReactionB hit cannot declare a blocked reason"
          : "a blocked ReactionB hit requires REACTION_B_DAMAGE_ICD"
      });
    }
  });

export const reactionDamageGroupAuditSchema = z.union([
  reactionADamageGroupAuditSchema,
  reactionBDamageGroupAuditSchema
]);

const dendroCoreLogBaseShape = {
  id: z.number().int().nonnegative(),
  coreId: z.number().int().nonnegative(),
  frame: z.number().int().nonnegative(),
  timeSeconds: finiteNumber.nonnegative(),
  // Burning's atomic multi-target fanout deliberately uses priorities in
  // (4, 5); ordinary reaction-damage events use 5.
  eventPriority: finiteNumber.nonnegative(),
  eventSequence: z.number().int().nonnegative(),
  intraEventSequence: z.number().int().nonnegative(),
  sourceActorId: wireNonEmptyStringSchema,
  sourceTargetId: wireNonEmptyStringSchema,
  originDamageEventId: z.number().int().nonnegative(),
  triggerFrame: z.number().int().nonnegative(),
  coreDurationFrames: z.literal(300),
  hitboxRadius: z.literal(2),
  maxActiveCores: z.literal(5),
  clockModel: z.literal("global-frame-no-hitlag"),
  hitlagStatus: z.literal("unsupported-enemy-hitlag"),
  mechanicsDataStatus: z.literal("fixed-gcsim-provisional"),
  selfDamageStatus: playerSelfDamageStatusSchema
};

const validateLogTime = (
  entry: { frame: number; timeSeconds: number },
  context: z.RefinementCtx
): void => {
  if (
    Math.abs(entry.timeSeconds - entry.frame / 60) >
    bloomGaugeEpsilon
  ) {
    context.addIssue({
      code: "custom",
      path: ["timeSeconds"],
      message: "must equal frame / 60"
    });
  }
};

export const dendroCoreSpawnScheduledLogEntrySchema = z
  .object({
    ...dendroCoreLogBaseShape,
    operation: z.literal("spawn-scheduled"),
    eventType: z.enum(["hit", "reactionDamage"]),
    bloomReactionIndex: z.number().int().nonnegative(),
    spawnFrame: z.number().int().nonnegative(),
    withinSimulation: z.boolean(),
    reason: z.literal("BLOOM_TRIGGERED")
  })
  .strict()
  .superRefine((entry, context) => {
    validateLogTime(entry, context);
    if (entry.frame !== entry.triggerFrame) {
      context.addIssue({
        code: "custom",
        path: ["frame"],
        message: "spawn scheduling must be logged on the trigger frame"
      });
    }
    const expectedPriority =
      entry.eventType === "hit" ? 3 : 5;
    if (entry.eventPriority !== expectedPriority) {
      context.addIssue({
        code: "custom",
        path: ["eventPriority"],
        message: `${entry.eventType} Bloom scheduling requires priority ${expectedPriority}`
      });
    }
    if (entry.spawnFrame !== entry.triggerFrame + 30) {
      context.addIssue({
        code: "custom",
        path: ["spawnFrame"],
        message: "Dendro cores must be scheduled 30 frames after Bloom"
      });
    }
  });

export const dendroCoreSpawnLogEntrySchema = z
  .object({
    ...dendroCoreLogBaseShape,
    operation: z.literal("spawn"),
    eventType: z.literal("dendroCoreSpawn"),
    spawnedAtFrame: z.number().int().nonnegative(),
    expiresAtFrame: z.number().int().nonnegative(),
    position: derivedPoint2DSchema,
    spawnRadius: finiteNumber.nonnegative(),
    spawnAngleDegrees: finiteNumber.min(0).refine(
      (value) => value < 360,
      "must be less than 360"
    ),
    positionRandomRoll: finiteNumber.min(0).refine(
      (value) => value < 1,
      "must be less than 1"
    ),
    rngStream: z.literal("dendro-core-position-v1"),
    reason: z.literal("SPAWNED")
  })
  .strict()
  .superRefine((entry, context) => {
    validateLogTime(entry, context);
    if (
      entry.frame !== entry.spawnedAtFrame ||
      entry.expiresAtFrame !==
        entry.spawnedAtFrame + entry.coreDurationFrames
    ) {
      context.addIssue({
        code: "custom",
        path: ["expiresAtFrame"],
        message:
          "spawn requires frame=spawnedAtFrame and a 300-frame half-open lifetime"
      });
    }
    if (entry.eventPriority !== 2) {
      context.addIssue({
        code: "custom",
        path: ["eventPriority"],
        message: "Dendro-core spawn requires priority 2"
      });
    }
    if (
      Math.abs(
        entry.spawnAngleDegrees -
          entry.positionRandomRoll * 360
      ) > bloomGaugeEpsilon
    ) {
      context.addIssue({
        code: "custom",
        path: ["spawnAngleDegrees"],
        message:
          "spawnAngleDegrees must be the recorded position random roll × 360"
      });
    }
  });

const dendroCoreRemovalBaseShape = {
  ...dendroCoreLogBaseShape,
  reactionDamageLogId: z.number().int().nonnegative(),
  playerHitResolutionLogId: z
    .number()
    .int()
    .nonnegative()
    .nullable(),
  playerDamageEventId: z.number().int().nonnegative().nullable(),
  damageFrame: z.number().int().nonnegative(),
  withinSimulation: z.boolean()
};

export const dendroCoreExpiryLogEntrySchema = z
  .object({
    ...dendroCoreRemovalBaseShape,
    operation: z.literal("expire"),
    eventType: z.literal("dendroCoreExpiry"),
    reaction: z.literal("bloom"),
    contactLogId: z.null(),
    reason: z.literal("NATURAL_EXPIRY")
  })
  .strict()
  .superRefine((entry, context) => {
    validateLogTime(entry, context);
    if (entry.eventPriority !== 2) {
      context.addIssue({
        code: "custom",
        path: ["eventPriority"],
        message: "Dendro-core expiry requires priority 2"
      });
    }
    if (entry.damageFrame !== entry.frame + 1) {
      context.addIssue({
        code: "custom",
        path: ["damageFrame"],
        message: "natural Bloom must be scheduled one frame after expiry"
      });
    }
  });

export const dendroCoreEvictionLogEntrySchema = z
  .object({
    ...dendroCoreRemovalBaseShape,
    operation: z.literal("evict"),
    eventType: z.literal("dendroCoreSpawn"),
    reaction: z.literal("bloom"),
    contactLogId: z.null(),
    reason: z.literal("ACTIVE_CORE_LIMIT")
  })
  .strict()
  .superRefine((entry, context) => {
    validateLogTime(entry, context);
    if (entry.eventPriority !== 2) {
      context.addIssue({
        code: "custom",
        path: ["eventPriority"],
        message: "Dendro-core eviction requires priority 2"
      });
    }
    if (entry.damageFrame !== entry.frame + 1) {
      context.addIssue({
        code: "custom",
        path: ["damageFrame"],
        message:
          "core-limit Bloom must be scheduled one frame after eviction"
      });
    }
  });

export const dendroCoreConsumeLogEntrySchema = z
  .object({
    ...dendroCoreRemovalBaseShape,
    operation: z.literal("consume"),
    eventType: z.enum(["hit", "reactionDamage"]),
    reaction: z.enum(["burgeon", "hyperbloom"]),
    contactLogId: z.number().int().nonnegative(),
    reason: z.enum([
      "BURGEON_CONTACT",
      "HYPERBLOOM_CONTACT"
    ])
  })
  .strict()
  .superRefine((entry, context) => {
    validateLogTime(entry, context);
    if (
      (entry.eventType === "hit" &&
        entry.eventPriority !== 3) ||
      (entry.eventType === "reactionDamage" &&
        (entry.eventPriority <= 4 ||
          entry.eventPriority > 5))
    ) {
      context.addIssue({
        code: "custom",
        path: ["eventPriority"],
        message:
          "Dendro-core consumption requires priority 3 for hit or priority in (4, 5] for reactionDamage"
      });
    }
    const isBurgeon = entry.reaction === "burgeon";
    const expectedReason = isBurgeon
      ? "BURGEON_CONTACT"
      : "HYPERBLOOM_CONTACT";
    const expectedDamageFrame = entry.frame + (isBurgeon ? 1 : 60);
    if (entry.reason !== expectedReason) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: `${entry.reaction} requires ${expectedReason}`
      });
    }
    if (entry.damageFrame !== expectedDamageFrame) {
      context.addIssue({
        code: "custom",
        path: ["damageFrame"],
        message: `${entry.reaction} requires damage at frame ${expectedDamageFrame}`
      });
    }
  });

export const dendroCoreRemovalLogEntrySchema = z.union([
  dendroCoreExpiryLogEntrySchema,
  dendroCoreEvictionLogEntrySchema,
  dendroCoreConsumeLogEntrySchema
]);

export const dendroCoreLogEntrySchema = z.union([
  dendroCoreSpawnScheduledLogEntrySchema,
  dendroCoreSpawnLogEntrySchema,
  dendroCoreExpiryLogEntrySchema,
  dendroCoreEvictionLogEntrySchema,
  dendroCoreConsumeLogEntrySchema
]);

const addDuplicateIdIssues = (
  values: number[],
  path: string,
  context: z.RefinementCtx
): void => {
  const seen = new Set<number>();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      context.addIssue({
        code: "custom",
        path: [path, index],
        message: `duplicate id ${value}`
      });
    }
    seen.add(value);
  });
};

export const dendroCoreLogSchema = z
  .array(dendroCoreLogEntrySchema)
  .superRefine((entries, context) => {
    const histories = new Map<
      number,
      Array<(typeof entries)[number]>
    >();
    let previousFrame = -1;
    let previousTuple: readonly [number, number, number] | null = null;
    entries.forEach((entry, index) => {
      if (entry.id !== index) {
        context.addIssue({
          code: "custom",
          path: [index, "id"],
          message: `expected contiguous log id ${index}`
        });
      }
      if (entry.frame < previousFrame) {
        context.addIssue({
          code: "custom",
          path: [index, "frame"],
          message: "lifecycle log frames must be non-decreasing"
        });
      }
      const tuple = [
        entry.eventPriority,
        entry.eventSequence,
        entry.intraEventSequence
      ] as const;
      if (entry.frame !== previousFrame) {
        previousTuple = null;
      }
      if (
        previousTuple !== null &&
        (tuple[0] < previousTuple[0] ||
          (tuple[0] === previousTuple[0] &&
            tuple[1] < previousTuple[1]) ||
          (tuple[0] === previousTuple[0] &&
            tuple[1] === previousTuple[1] &&
            tuple[2] <= previousTuple[2]))
      ) {
        context.addIssue({
          code: "custom",
          path: [index, "eventPriority"],
          message:
            "same-frame lifecycle entries must be ordered by priority, sequence, and intra-event sequence"
        });
      }
      previousFrame = entry.frame;
      previousTuple = tuple;
      const history = histories.get(entry.coreId) ?? [];
      history.push(entry);
      histories.set(entry.coreId, history);
    });

    for (const [coreId, history] of histories) {
      const scheduled = history.filter(
        (entry) => entry.operation === "spawn-scheduled"
      );
      const spawned = history.filter(
        (entry) => entry.operation === "spawn"
      );
      const removed = history.filter(
        (entry) =>
          entry.operation === "expire" ||
          entry.operation === "evict" ||
          entry.operation === "consume"
      );
      if (scheduled.length !== 1) {
        context.addIssue({
          code: "custom",
          path: [],
          message: `core ${coreId} requires exactly one spawn-scheduled entry`
        });
        continue;
      }
      const schedule = scheduled[0]!;
      if (spawned.length > 1 || removed.length > 1) {
        context.addIssue({
          code: "custom",
          path: [],
          message: `core ${coreId} may spawn and be removed at most once`
        });
      }
      if (!schedule.withinSimulation) {
        if (spawned.length !== 0 || removed.length !== 0) {
          context.addIssue({
            code: "custom",
            path: [],
            message: `out-of-duration core ${coreId} cannot have runtime lifecycle entries`
          });
        }
        continue;
      }
      if (spawned.length !== 1) {
        context.addIssue({
          code: "custom",
          path: [],
          message: `scheduled in-duration core ${coreId} requires one spawn entry`
        });
        continue;
      }
      const spawn = spawned[0]!;
      if (
        spawn.operation === "spawn" &&
        (spawn.id <= schedule.id ||
          spawn.frame !== schedule.spawnFrame ||
          spawn.sourceActorId !== schedule.sourceActorId ||
          spawn.sourceTargetId !== schedule.sourceTargetId ||
          spawn.triggerFrame !== schedule.triggerFrame ||
          spawn.originDamageEventId !==
            schedule.originDamageEventId)
      ) {
        context.addIssue({
          code: "custom",
          path: [],
          message: `core ${coreId} spawn does not match its schedule`
        });
      }
      if (
        removed.length === 1 &&
        (removed[0]!.id <= spawn.id ||
          removed[0]!.frame < spawn.frame)
      ) {
        context.addIssue({
          code: "custom",
          path: [],
          message: `core ${coreId} cannot be logged as removed before it spawns`
        });
      }
      if (removed.length === 1 && spawn.operation === "spawn") {
        const removal = removed[0]!;
        if (
          removal.sourceActorId !== spawn.sourceActorId ||
          removal.sourceTargetId !== spawn.sourceTargetId ||
          removal.originDamageEventId !==
            spawn.originDamageEventId ||
          removal.triggerFrame !== spawn.triggerFrame
        ) {
          context.addIssue({
            code: "custom",
            path: [],
            message: `core ${coreId} removal does not match its spawn provenance`
          });
        }
        if (
          removal.operation === "expire" &&
          removal.frame !== spawn.expiresAtFrame
        ) {
          context.addIssue({
            code: "custom",
            path: [],
            message: `core ${coreId} must expire exactly at its half-open lifetime boundary`
          });
        }
        if (
          (removal.operation === "consume" ||
            removal.operation === "evict") &&
          removal.frame >= spawn.expiresAtFrame
        ) {
          context.addIssue({
            code: "custom",
            path: [],
            message: `core ${coreId} cannot be contacted or evicted at/after expiry`
          });
        }
      }
    }
  });

export const dendroCoreContactLogEntrySchema = z
  .object({
    id: z.number().int().nonnegative(),
    frame: z.number().int().nonnegative(),
    timeSeconds: finiteNumber.nonnegative(),
    eventType: z.enum(["hit", "reactionDamage"]),
    // Fractional priorities preserve Burning target-atomic ordering.
    eventPriority: finiteNumber.nonnegative(),
    eventSequence: z.number().int().nonnegative(),
    intraEventSequence: z.number().int().nonnegative(),
    sourceActorId: wireNonEmptyStringSchema,
    sourceActionId: wireNonEmptyStringSchema,
    hitId: wireNonEmptyStringSchema,
    hitGroupId: wireNonEmptyStringSchema,
    triggerReactionDamageLogId: z
      .number()
      .int()
      .nonnegative()
      .nullable(),
    triggerElement: z.enum(["pyro", "electro"]),
    reaction: z.enum(["burgeon", "hyperbloom"]),
    hitResolutionLogIds: z.array(
      z.number().int().nonnegative()
    ),
    triggerDamageEventIds: z.array(
      z.number().int().nonnegative()
    ),
    resolvedGeometry: resolvedWorldHitGeometrySchema.nullable(),
    checkedCoreIds: z.array(z.number().int().nonnegative()),
    contactedCoreIds: z.array(z.number().int().nonnegative()),
    removalLogIds: z.array(z.number().int().nonnegative()),
    reactionDamageLogIds: z.array(
      z.number().int().nonnegative()
    ),
    blockedReason: z
      .literal("MISSING_EXPLICIT_GEOMETRY")
      .nullable()
  })
  .strict()
  .superRefine((entry, context) => {
    validateLogTime(entry, context);
    if (
      (entry.eventType === "hit" &&
        entry.triggerReactionDamageLogId !== null) ||
      (entry.eventType === "reactionDamage" &&
        entry.triggerReactionDamageLogId === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["triggerReactionDamageLogId"],
        message:
          "direct-hit core contact requires null and reactionDamage contact requires its triggering reaction-damage log id"
      });
    }
    if (
      (entry.eventType === "hit" &&
        entry.eventPriority !== 3) ||
      (entry.eventType === "reactionDamage" &&
        (entry.eventPriority <= 4 ||
          entry.eventPriority > 5))
    ) {
      context.addIssue({
        code: "custom",
        path: ["eventPriority"],
        message:
          "Dendro-core contact requires priority 3 for hit or priority in (4, 5] for reactionDamage"
      });
    }
    addDuplicateIdIssues(
      entry.hitResolutionLogIds,
      "hitResolutionLogIds",
      context
    );
    addDuplicateIdIssues(
      entry.triggerDamageEventIds,
      "triggerDamageEventIds",
      context
    );
    addDuplicateIdIssues(
      entry.checkedCoreIds,
      "checkedCoreIds",
      context
    );
    addDuplicateIdIssues(
      entry.contactedCoreIds,
      "contactedCoreIds",
      context
    );
    addDuplicateIdIssues(
      entry.removalLogIds,
      "removalLogIds",
      context
    );
    addDuplicateIdIssues(
      entry.reactionDamageLogIds,
      "reactionDamageLogIds",
      context
    );

    const expectedReaction =
      entry.triggerElement === "pyro"
        ? "burgeon"
        : "hyperbloom";
    if (entry.reaction !== expectedReaction) {
      context.addIssue({
        code: "custom",
        path: ["reaction"],
        message: `${entry.triggerElement} core contact requires ${expectedReaction}`
      });
    }
    if (
      entry.contactedCoreIds.length !== entry.removalLogIds.length ||
      entry.contactedCoreIds.length !==
        entry.reactionDamageLogIds.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["contactedCoreIds"],
        message:
          "contacted cores, removal logs, and reaction-damage logs must have equal lengths"
      });
    }
    const checked = new Set(entry.checkedCoreIds);
    if (entry.contactedCoreIds.some((id) => !checked.has(id))) {
      context.addIssue({
        code: "custom",
        path: ["contactedCoreIds"],
        message: "every contacted core must appear in checkedCoreIds"
      });
    }
    if (entry.blockedReason !== null) {
      if (entry.resolvedGeometry !== null) {
        context.addIssue({
          code: "custom",
          path: ["resolvedGeometry"],
          message:
            "MISSING_EXPLICIT_GEOMETRY requires null resolvedGeometry"
        });
      }
      if (
        entry.contactedCoreIds.length !== 0 ||
        entry.removalLogIds.length !== 0 ||
        entry.reactionDamageLogIds.length !== 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["contactedCoreIds"],
          message:
            "geometry-blocked contact cannot consume cores or queue damage"
        });
      }
    } else if (entry.resolvedGeometry === null) {
      context.addIssue({
        code: "custom",
        path: ["resolvedGeometry"],
        message: "an unblocked core contact requires resolved geometry"
      });
    }
  });

export const dendroCoreContactLogSchema = z
  .array(dendroCoreContactLogEntrySchema)
  .superRefine((entries, context) => {
    const hitGroups = new Set<string>();
    entries.forEach((entry, index) => {
      if (entry.id !== index) {
        context.addIssue({
          code: "custom",
          path: [index, "id"],
          message: `expected contiguous contact log id ${index}`
        });
      }
      if (hitGroups.has(entry.hitGroupId)) {
        context.addIssue({
          code: "custom",
          path: [index, "hitGroupId"],
          message: `duplicate Dendro-core contact for hitGroupId "${entry.hitGroupId}"`
        });
      }
      hitGroups.add(entry.hitGroupId);
    });
  });

export const dendroCoreSnapshotSchema = z
  .object({
    coreId: z.number().int().nonnegative(),
    sourceActorId: wireNonEmptyStringSchema,
    sourceTargetId: wireNonEmptyStringSchema,
    spawnedAtFrame: z.number().int().nonnegative(),
    expiresAtFrame: z.number().int().nonnegative(),
    position: derivedPoint2DSchema,
    hitboxRadius: z.literal(2)
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (
      snapshot.expiresAtFrame !==
      snapshot.spawnedAtFrame + 300
    ) {
      context.addIssue({
        code: "custom",
        path: ["expiresAtFrame"],
        message: "Dendro-core snapshots require a 300-frame lifetime"
      });
    }
  });

export const dendroCoreTimelinePointSchema = z
  .object({
    id: z.number().int().nonnegative(),
    frame: z.number().int().nonnegative(),
    timeSeconds: finiteNumber.nonnegative(),
    eventType: z.enum([
      "dendroCoreSpawn",
      "dendroCoreExpiry",
      "hit",
      "reactionDamage"
    ]),
    // Fractional priorities preserve Burning target-atomic ordering.
    eventPriority: finiteNumber.nonnegative(),
    eventSequence: z.number().int().nonnegative(),
    intraEventSequence: z.number().int().nonnegative(),
    operation: z.enum(["spawn", "expire", "evict", "consume"]),
    dendroCoreLogId: z.number().int().nonnegative(),
    coreId: z.number().int().nonnegative(),
    activeCores: z.array(dendroCoreSnapshotSchema).max(5)
  })
  .strict()
  .superRefine((point, context) => {
    validateLogTime(point, context);
    addDuplicateIdIssues(
      point.activeCores.map((core) => core.coreId),
      "activeCores",
      context
    );
    const expectedEventType = {
      spawn: "dendroCoreSpawn",
      expire: "dendroCoreExpiry",
      evict: "dendroCoreSpawn"
    } as const;
    if (
      point.operation !== "consume" &&
      point.eventType !== expectedEventType[point.operation]
    ) {
      context.addIssue({
        code: "custom",
        path: ["eventType"],
        message: `${point.operation} requires eventType=${expectedEventType[point.operation]}`
      });
    }
    if (
      point.operation === "consume" &&
      point.eventType !== "hit" &&
      point.eventType !== "reactionDamage"
    ) {
      context.addIssue({
        code: "custom",
        path: ["eventType"],
        message: "consume requires eventType=hit or reactionDamage"
      });
    }
    if (point.operation === "consume") {
      if (
        (point.eventType === "hit" &&
          point.eventPriority !== 3) ||
        (point.eventType === "reactionDamage" &&
          (point.eventPriority <= 4 ||
            point.eventPriority > 5))
      ) {
        context.addIssue({
          code: "custom",
          path: ["eventPriority"],
          message:
            "consume requires priority 3 for hit or priority in (4, 5] for reactionDamage"
        });
      }
    } else if (point.eventPriority !== 2) {
      context.addIssue({
        code: "custom",
        path: ["eventPriority"],
        message: `${point.operation} requires eventPriority=2`
      });
    }
  });

export const dendroCoreTimelineSchema = z
  .object({
    version: z.literal("1.0.0"),
    points: z.array(dendroCoreTimelinePointSchema)
  })
  .strict()
  .superRefine((timeline, context) => {
    let activeCoreIds: number[] = [];
    let previousFrame = -1;
    let previousTuple: readonly [number, number, number] | null = null;
    const stableSnapshots = new Map<number, string>();
    const seenCoreIds = new Set<number>();
    const lifetimeByCoreId = new Map<
      number,
      { spawnedAtFrame: number; expiresAtFrame: number }
    >();

    timeline.points.forEach((point, index) => {
      if (point.id !== index) {
        context.addIssue({
          code: "custom",
          path: ["points", index, "id"],
          message: `expected contiguous timeline id ${index}`
        });
      }
      if (point.frame < previousFrame) {
        context.addIssue({
          code: "custom",
          path: ["points", index, "frame"],
          message: "timeline frames must be non-decreasing"
        });
      }
      const tuple = [
        point.eventPriority,
        point.eventSequence,
        point.intraEventSequence
      ] as const;
      if (point.frame !== previousFrame) {
        previousTuple = null;
      }
      if (
        previousTuple !== null &&
        (tuple[0] < previousTuple[0] ||
          (tuple[0] === previousTuple[0] &&
            tuple[1] < previousTuple[1]) ||
          (tuple[0] === previousTuple[0] &&
            tuple[1] === previousTuple[1] &&
            tuple[2] <= previousTuple[2]))
      ) {
        context.addIssue({
          code: "custom",
          path: ["points", index, "eventPriority"],
          message:
            "same-frame points must be ordered by priority, sequence, and intra-event sequence"
        });
      }

      const hadCore = activeCoreIds.includes(point.coreId);
      if (point.operation === "spawn") {
        if (seenCoreIds.has(point.coreId)) {
          context.addIssue({
            code: "custom",
            path: ["points", index, "coreId"],
            message:
              "a Dendro-core id cannot be reused after removal"
          });
        }
        if (hadCore) {
          context.addIssue({
            code: "custom",
            path: ["points", index, "coreId"],
            message: "spawn cannot add an already-active core"
          });
        }
        const spawnedSnapshot = point.activeCores.find(
          (snapshot) => snapshot.coreId === point.coreId
        );
        if (spawnedSnapshot === undefined) {
          context.addIssue({
            code: "custom",
            path: ["points", index, "activeCores"],
            message:
              "spawn requires its post-operation core snapshot"
          });
        } else {
          if (spawnedSnapshot.spawnedAtFrame !== point.frame) {
            context.addIssue({
              code: "custom",
              path: [
                "points",
                index,
                "activeCores",
                point.activeCores.indexOf(spawnedSnapshot),
                "spawnedAtFrame"
              ],
              message:
                "spawn snapshot spawnedAtFrame must equal the timeline point frame"
            });
          }
          lifetimeByCoreId.set(point.coreId, {
            spawnedAtFrame: spawnedSnapshot.spawnedAtFrame,
            expiresAtFrame: spawnedSnapshot.expiresAtFrame
          });
        }
        seenCoreIds.add(point.coreId);
        activeCoreIds = [...activeCoreIds, point.coreId];
      } else {
        if (!hadCore) {
          context.addIssue({
            code: "custom",
            path: ["points", index, "coreId"],
            message: `${point.operation} requires an active core`
          });
        }
        const lifetime = lifetimeByCoreId.get(point.coreId);
        if (
          lifetime !== undefined &&
          point.operation === "expire" &&
          point.frame !== lifetime.expiresAtFrame
        ) {
          context.addIssue({
            code: "custom",
            path: ["points", index, "frame"],
            message:
              "expire must occur exactly at the cached core expiry frame"
          });
        }
        if (
          lifetime !== undefined &&
          (point.operation === "consume" ||
            point.operation === "evict") &&
          point.frame >= lifetime.expiresAtFrame
        ) {
          context.addIssue({
            code: "custom",
            path: ["points", index, "frame"],
            message:
              "consume/evict must occur before the cached core expiry frame"
          });
        }
        activeCoreIds = activeCoreIds.filter(
          (coreId) => coreId !== point.coreId
        );
      }

      const actualIds = point.activeCores.map((core) => core.coreId);
      if (
        actualIds.length !== activeCoreIds.length ||
        actualIds.some(
          (coreId, coreIndex) =>
            coreId !== activeCoreIds[coreIndex]
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["points", index, "activeCores"],
          message:
            "activeCores must equal the ordered post-operation entity state"
        });
      }
      point.activeCores.forEach((snapshot, snapshotIndex) => {
        if (
          point.frame < snapshot.spawnedAtFrame ||
          point.frame >= snapshot.expiresAtFrame
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "points",
              index,
              "activeCores",
              snapshotIndex
            ],
            message:
              "active cores must be inside their half-open lifetime at the timeline frame"
          });
        }
        const serialized = JSON.stringify(snapshot);
        const previous = stableSnapshots.get(snapshot.coreId);
        if (previous !== undefined && previous !== serialized) {
          context.addIssue({
            code: "custom",
            path: [
              "points",
              index,
              "activeCores",
              snapshotIndex
            ],
            message:
              "an active Dendro-core snapshot cannot mutate between lifecycle operations"
          });
        }
        stableSnapshots.set(snapshot.coreId, serialized);
      });

      previousFrame = point.frame;
      previousTuple = tuple;
    });
  });

const dendroCoreDamageEventReferenceSchema = z
  .object({
    id: z.number().int().nonnegative(),
    kind: z.enum(["direct", "transformative-reaction"]),
    parentDamageEventId: z.number().int().nonnegative().nullable(),
    sourceActorId: wireNonEmptyStringSchema,
    scalingOwnerId: wireNonEmptyStringSchema,
    creditOwnerId: wireNonEmptyStringSchema,
    hitGroupId: wireNonEmptyStringSchema,
    targetId: wireNonEmptyStringSchema,
    frame: z.number().int().nonnegative(),
    element: z.enum([
      "pyro",
      "cryo",
      "hydro",
      "electro",
      "anemo",
      "geo",
      "dendro",
      "physical"
    ]),
    reaction: wireNonEmptyStringSchema,
    reactionAudit: z
      .object({
        bloomReactions: z.array(
          z
            .object({
              scheduled: z.boolean(),
              coreSpawnFrame: z
                .number()
                .int()
                .nonnegative()
                .nullable(),
              triggerFrame: z.number().int().nonnegative(),
              sourceActorId: wireNonEmptyStringSchema
            })
            .passthrough()
        )
      })
      .passthrough()
  })
  .passthrough();

const dendroCoreHitResolutionReferenceSchema = z
  .object({
    id: z.number().int().nonnegative(),
    frame: z.number().int().nonnegative(),
    sourceActorId: wireNonEmptyStringSchema,
    sourceActionId: wireNonEmptyStringSchema,
    hitId: wireNonEmptyStringSchema,
    hitGroupId: wireNonEmptyStringSchema,
    targetId: wireNonEmptyStringSchema,
    element: z.enum([
      "pyro",
      "cryo",
      "hydro",
      "electro",
      "anemo",
      "geo",
      "dendro",
      "physical"
    ]),
    resolutionKind: z.enum(["direct", "reaction-damage"]),
    damageEventId: z.number().int().nonnegative().nullable()
  })
  .passthrough();

const dendroCoreReactionDamageReferenceSchema = z
  .object({
    id: z.number().int().nonnegative(),
    reaction: wireNonEmptyStringSchema,
    triggerDamageEventId: z
      .number()
      .int()
      .nonnegative()
      .nullable(),
    triggerHitGroupId: wireNonEmptyStringSchema.nullable(),
    sourceActorId: wireNonEmptyStringSchema,
    sourceTargetId: wireNonEmptyStringSchema,
    triggerFrame: z.number().int().nonnegative(),
    damageFrame: z.number().int().nonnegative(),
    scheduled: z.boolean(),
    withinSimulation: z.boolean(),
    blockedReason: z
      .enum([
        "REACTION_DAMAGE_GCD",
        "REACTION_QUEUE_GCD",
        "TARGET_MECHANICS_TRUNCATION"
      ])
      .nullable(),
    nextAvailableFrame: z.number().int().nonnegative().nullable(),
    scheduleKind: z.enum([
      "one-shot",
      "periodic-tick",
      "burning-tick",
      "swirl-self",
      "swirl-propagation",
      "dendro-core-bloom",
      "dendro-core-burgeon",
      "dendro-core-hyperbloom"
    ]),
    targetingMode: z.enum([
      "radius",
      "single-target",
      "nearest-target-radius"
    ]),
    centerPosition: derivedPoint2DSchema.nullable(),
    radius: finiteNumber.nonnegative(),
    sourceCoreId: z.number().int().nonnegative().nullable(),
    sourceCoreLogId: z.number().int().nonnegative().nullable(),
    selectionRadius: finiteNumber.nonnegative().nullable(),
    selectedTargetId: wireNonEmptyStringSchema.nullable(),
    resolutionReason: z.literal("NO_TARGET_IN_RANGE").nullable(),
    applicationGaugeUnits: finiteNumber.nonnegative().nullable(),
    excludedTargetIds: z.array(wireNonEmptyStringSchema),
    checkedTargetIds: z.array(wireNonEmptyStringSchema),
    hitTargetIds: z.array(wireNonEmptyStringSchema),
    unresolvedTargetIds: z.array(wireNonEmptyStringSchema),
    damageGroupBlockedTargetIds: z.array(
      wireNonEmptyStringSchema
    ),
    damageEventIds: z.array(z.number().int().nonnegative()),
    playerHitResolutionLogIds: z.array(
      z.number().int().nonnegative()
    ),
    playerDamageEventIds: z.array(
      z.number().int().nonnegative()
    ),
    reactionStatusLogIds: z.array(
      z.number().int().nonnegative()
    ),
    damageGroupDecisions: z.array(
      reactionDamageGroupAuditSchema
    )
  })
  .passthrough();

const playerSelfDamageAuditStatusReferenceSchema = z
  .object({
    selfDamageStatus: playerSelfDamageStatusSchema
  })
  .passthrough();

/**
 * Minimal DamageEvent projection used only to bind reaction-audit player
 * status to the top-level player damage model. The complete DamageEvent
 * contract remains owned by sim-core.
 */
const playerSelfDamageDamageEventReferenceSchema = z
  .object({
    id: z.number().int().nonnegative(),
    reactionAudit: z
      .object({
        burningReaction:
          playerSelfDamageAuditStatusReferenceSchema.nullable(),
        bloomReactions: z.array(
          playerSelfDamageAuditStatusReferenceSchema
        )
      })
      .passthrough()
  })
  .passthrough();

const addMissingReferenceIssue = (
  context: z.RefinementCtx,
  path: Array<string | number>,
  message: string
): void => {
  context.addIssue({
    code: "custom",
    path,
    message
  });
};

/**
 * Cross-log integrity projection for Dendro-core outputs.
 *
 * This intentionally is not a complete SimulationResult schema. It accepts
 * additional result fields while strictly validating the core-owned lifecycle,
 * contact, timeline, damage-event, and reaction-damage references.
 */
export const dendroCoreResultReferencesSchema = z
  .object({
    dendroCoreLog: dendroCoreLogSchema,
    dendroCoreContactLog: dendroCoreContactLogSchema,
    dendroCoreTimeline: dendroCoreTimelineSchema,
    hitResolutionLog: z.array(
      dendroCoreHitResolutionReferenceSchema
    ),
    reactionDamageLog: z.array(
      dendroCoreReactionDamageReferenceSchema
    ),
    damageEvents: z.array(dendroCoreDamageEventReferenceSchema)
  })
  .passthrough()
  .superRefine((result, context) => {
    const lifecycleById = new Map(
      result.dendroCoreLog.map((entry) => [entry.id, entry])
    );
    const contactById = new Map(
      result.dendroCoreContactLog.map((entry) => [
        entry.id,
        entry
      ])
    );
    const reactionDamageById = new Map(
      result.reactionDamageLog.map((entry) => [entry.id, entry])
    );
    const hitResolutionById = new Map(
      result.hitResolutionLog.map((entry) => [entry.id, entry])
    );
    const damageEventById = new Map(
      result.damageEvents.map((entry) => [entry.id, entry])
    );

    addDuplicateIdIssues(
      result.hitResolutionLog.map((entry) => entry.id),
      "hitResolutionLog",
      context
    );
    addDuplicateIdIssues(
      result.reactionDamageLog.map((entry) => entry.id),
      "reactionDamageLog",
      context
    );
    addDuplicateIdIssues(
      result.damageEvents.map((entry) => entry.id),
      "damageEvents",
      context
    );
    (
      [
        ["hitResolutionLog", result.hitResolutionLog],
        ["reactionDamageLog", result.reactionDamageLog],
        ["damageEvents", result.damageEvents]
      ] as const
    ).forEach(([logName, entries]) => {
      entries.forEach((entry, index) => {
        if (entry.id !== index) {
          addMissingReferenceIssue(
            context,
            [logName, index, "id"],
            `${logName} requires contiguous id ${index}`
          );
        }
      });
    });

    result.dendroCoreLog.forEach((entry, index) => {
      const origin = damageEventById.get(
        entry.originDamageEventId
      );
      if (origin === undefined) {
        addMissingReferenceIssue(
          context,
          ["dendroCoreLog", index, "originDamageEventId"],
          `missing damage event ${entry.originDamageEventId}`
        );
      } else if (
        origin.frame !== entry.triggerFrame ||
        origin.sourceActorId !== entry.sourceActorId ||
        origin.targetId !== entry.sourceTargetId ||
        (entry.operation === "spawn-scheduled" &&
          entry.eventType !==
            (origin.kind === "direct" ? "hit" : "reactionDamage"))
      ) {
        addMissingReferenceIssue(
          context,
          ["dendroCoreLog", index, "originDamageEventId"],
          "core lifecycle provenance does not match its origin damage event"
        );
      }

      if (entry.operation === "spawn-scheduled") {
        const bloomAudit =
          origin?.reactionAudit.bloomReactions[
            entry.bloomReactionIndex
          ];
        if (bloomAudit === undefined) {
          addMissingReferenceIssue(
            context,
            [
              "dendroCoreLog",
              index,
              "bloomReactionIndex"
            ],
            `missing Bloom audit ${entry.bloomReactionIndex} on damage event ${entry.originDamageEventId}`
          );
        } else if (
          !bloomAudit.scheduled ||
          bloomAudit.coreSpawnFrame !== entry.spawnFrame ||
          bloomAudit.triggerFrame !== entry.triggerFrame ||
          bloomAudit.sourceActorId !== entry.sourceActorId
        ) {
          addMissingReferenceIssue(
            context,
            [
              "dendroCoreLog",
              index,
              "bloomReactionIndex"
            ],
            "spawn schedule does not match its referenced Bloom audit"
          );
        }
        return;
      }

      if (
        entry.operation === "expire" ||
        entry.operation === "evict" ||
        entry.operation === "consume"
      ) {
        const consumeContact =
          entry.operation === "consume"
            ? contactById.get(entry.contactLogId)
            : undefined;
        const reactionDamage = reactionDamageById.get(
          entry.reactionDamageLogId
        );
        const expectedScheduleKind =
          entry.reaction === "bloom"
            ? "dendro-core-bloom"
            : entry.reaction === "burgeon"
              ? "dendro-core-burgeon"
              : "dendro-core-hyperbloom";
        const expectedTargetingMode =
          entry.reaction === "hyperbloom"
            ? "nearest-target-radius"
            : "radius";
        const expectedRadius =
          entry.reaction === "hyperbloom" ? 1 : 5;
        const expectedSelectionRadius =
          entry.reaction === "hyperbloom" ? 15 : null;
        const expectedTriggerDamageEventId =
          entry.operation === "consume"
            ? (consumeContact?.triggerDamageEventIds[0] ?? null)
            : entry.originDamageEventId;
        const expectedTriggerHitGroupId =
          entry.operation === "consume"
            ? (consumeContact?.hitGroupId ?? null)
            : null;
        if (reactionDamage === undefined) {
          addMissingReferenceIssue(
            context,
            [
              "dendroCoreLog",
              index,
              "reactionDamageLogId"
            ],
            `missing reaction-damage log ${entry.reactionDamageLogId}`
          );
        } else if (
          reactionDamage.reaction !== entry.reaction ||
          reactionDamage.sourceCoreId !== entry.coreId ||
          reactionDamage.sourceCoreLogId !== entry.id ||
          reactionDamage.triggerFrame !== entry.frame ||
          reactionDamage.damageFrame !== entry.damageFrame ||
          reactionDamage.scheduled !== true ||
          reactionDamage.withinSimulation !==
            entry.withinSimulation ||
          reactionDamage.blockedReason !== null ||
          reactionDamage.nextAvailableFrame !== null ||
          reactionDamage.scheduleKind !== expectedScheduleKind ||
          reactionDamage.targetingMode !==
            expectedTargetingMode ||
          reactionDamage.radius !== expectedRadius ||
          reactionDamage.selectionRadius !==
            expectedSelectionRadius ||
          reactionDamage.triggerDamageEventId !==
            expectedTriggerDamageEventId ||
          reactionDamage.triggerHitGroupId !==
            expectedTriggerHitGroupId ||
          reactionDamage.applicationGaugeUnits !== null ||
          reactionDamage.excludedTargetIds.length !== 0 ||
          reactionDamage.reactionStatusLogIds.length !== 0 ||
          (entry.operation === "consume"
            ? consumeContact !== undefined &&
              reactionDamage.sourceActorId !==
                consumeContact.sourceActorId
            : reactionDamage.sourceActorId !==
              entry.sourceActorId) ||
          reactionDamage.sourceTargetId !== entry.sourceTargetId
        ) {
          addMissingReferenceIssue(
            context,
            [
              "dendroCoreLog",
              index,
              "reactionDamageLogId"
            ],
            "removal does not match its referenced reaction-damage log"
          );
        }

        if (
          reactionDamage !== undefined &&
          entry.reaction !== "hyperbloom"
        ) {
          const spawn = result.dendroCoreLog.find(
            (candidate) =>
              candidate.operation === "spawn" &&
              candidate.coreId === entry.coreId
          );
          if (
            spawn?.operation !== "spawn" ||
            reactionDamage.centerPosition === null ||
            Math.abs(
              reactionDamage.centerPosition.x - spawn.position.x
            ) > bloomGaugeEpsilon ||
            Math.abs(
              reactionDamage.centerPosition.y - spawn.position.y
            ) > bloomGaugeEpsilon ||
            reactionDamage.selectedTargetId !== null ||
            reactionDamage.resolutionReason !== null
          ) {
            addMissingReferenceIssue(
              context,
              [
                "dendroCoreLog",
                index,
                "reactionDamageLogId"
              ],
              "Bloom/Burgeon targeting must remain centered on the source core"
            );
          }
        }

        if (
          reactionDamage !== undefined &&
          entry.reaction === "hyperbloom" &&
          reactionDamage.withinSimulation
        ) {
          const hasSelectedTarget =
            reactionDamage.selectedTargetId !== null;
          if (
            hasSelectedTarget ===
              (reactionDamage.resolutionReason !== null) ||
            (hasSelectedTarget &&
              !reactionDamage.hitTargetIds.includes(
                reactionDamage.selectedTargetId!
              )) ||
            (!hasSelectedTarget &&
              (reactionDamage.centerPosition !== null ||
                reactionDamage.checkedTargetIds.length !== 0 ||
                reactionDamage.hitTargetIds.length !== 0 ||
                reactionDamage.damageEventIds.length !== 0 ||
                reactionDamage.damageGroupDecisions.length !== 0))
          ) {
            addMissingReferenceIssue(
              context,
              [
                "dendroCoreLog",
                index,
                "reactionDamageLogId"
              ],
              "Hyperbloom target selection is inconsistent with its resolution"
            );
          }
        }

        if (entry.operation === "consume") {
          const contact = consumeContact;
          if (contact === undefined) {
            addMissingReferenceIssue(
              context,
              ["dendroCoreLog", index, "contactLogId"],
              `missing core-contact log ${entry.contactLogId}`
            );
          } else {
            const coreIndex = contact.contactedCoreIds.indexOf(
              entry.coreId
            );
            if (
              coreIndex < 0 ||
              contact.removalLogIds[coreIndex] !== entry.id ||
              contact.reactionDamageLogIds[coreIndex] !==
                entry.reactionDamageLogId ||
              contact.frame !== entry.frame ||
              contact.eventType !== entry.eventType ||
              contact.reaction !== entry.reaction
            ) {
              addMissingReferenceIssue(
                context,
                ["dendroCoreLog", index, "contactLogId"],
                "consumption does not match its referenced core-contact log"
              );
            }
          }
        }
      }
    });

    result.dendroCoreContactLog.forEach((contact, index) => {
      const reactionDamageSuffix =
        contact.triggerReactionDamageLogId === null
          ? ""
          : `:reaction-damage-log-${contact.triggerReactionDamageLogId}`;
      const expectedResolutionKind =
        contact.eventType === "hit"
          ? "direct"
          : "reaction-damage";
      const referencedDamageEventIds: number[] = [];
      contact.hitResolutionLogIds.forEach(
        (hitResolutionLogId, referenceIndex) => {
          const hitResolution =
            hitResolutionById.get(hitResolutionLogId);
          if (hitResolution === undefined) {
            addMissingReferenceIssue(
              context,
              [
                "dendroCoreContactLog",
                index,
                "hitResolutionLogIds",
                referenceIndex
              ],
              `missing hit-resolution log ${hitResolutionLogId}`
            );
            return;
          }
          if (
            hitResolution.frame !== contact.frame ||
            hitResolution.sourceActorId !==
              contact.sourceActorId ||
            hitResolution.sourceActionId !==
              contact.sourceActionId ||
            `${hitResolution.hitId}${reactionDamageSuffix}` !==
              contact.hitId ||
            `${hitResolution.hitGroupId}${reactionDamageSuffix}` !==
              contact.hitGroupId ||
            hitResolution.element !== contact.triggerElement ||
            hitResolution.resolutionKind !==
              expectedResolutionKind
          ) {
            addMissingReferenceIssue(
              context,
              [
                "dendroCoreContactLog",
                index,
                "hitResolutionLogIds",
                referenceIndex
              ],
              "core-contact hit resolution does not match its frame, source, hit identity, element, or resolution kind"
            );
          }
          if (hitResolution.damageEventId !== null) {
            referencedDamageEventIds.push(
              hitResolution.damageEventId
            );
          }
        }
      );
      if (
        referencedDamageEventIds.length !==
          contact.triggerDamageEventIds.length ||
        referencedDamageEventIds.some(
          (damageEventId, damageIndex) =>
            damageEventId !==
            contact.triggerDamageEventIds[damageIndex]
        )
      ) {
        addMissingReferenceIssue(
          context,
          [
            "dendroCoreContactLog",
            index,
            "hitResolutionLogIds"
          ],
          "core-contact hit resolutions must reproduce triggerDamageEventIds in target order"
        );
      }
      const triggeringReactionDamage =
        contact.triggerReactionDamageLogId === null
          ? undefined
          : reactionDamageById.get(
              contact.triggerReactionDamageLogId
            );
      if (contact.eventType === "reactionDamage") {
        if (triggeringReactionDamage === undefined) {
          addMissingReferenceIssue(
            context,
            [
              "dendroCoreContactLog",
              index,
              "triggerReactionDamageLogId"
            ],
            `missing triggering reaction-damage log ${contact.triggerReactionDamageLogId}`
          );
        } else if (
          triggeringReactionDamage.damageFrame !== contact.frame ||
          triggeringReactionDamage.sourceActorId !==
            contact.sourceActorId ||
          triggeringReactionDamage.damageEventIds.length !==
            contact.triggerDamageEventIds.length ||
          triggeringReactionDamage.damageEventIds.some(
            (damageEventId, damageIndex) =>
              damageEventId !==
              contact.triggerDamageEventIds[damageIndex]
          )
        ) {
          addMissingReferenceIssue(
            context,
            [
              "dendroCoreContactLog",
              index,
              "triggerReactionDamageLogId"
            ],
            "reactionDamage core contact does not match its triggering reaction-damage event"
          );
        }
      }
      contact.triggerDamageEventIds.forEach(
        (damageEventId, referenceIndex) => {
          const triggerDamageEvent =
            damageEventById.get(damageEventId);
          const expectedHitGroupId =
            contact.eventType === "hit"
              ? triggerDamageEvent?.hitGroupId
              : triggerDamageEvent !== undefined &&
                  contact.triggerReactionDamageLogId !== null
                ? `${triggerDamageEvent.hitGroupId}:reaction-damage-log-${contact.triggerReactionDamageLogId}`
                : undefined;
          if (triggerDamageEvent === undefined) {
            addMissingReferenceIssue(
              context,
              [
                "dendroCoreContactLog",
                index,
                "triggerDamageEventIds",
                referenceIndex
              ],
              `missing damage event ${damageEventId}`
            );
          } else if (
            triggerDamageEvent.frame !== contact.frame ||
            triggerDamageEvent.sourceActorId !==
              contact.sourceActorId ||
            expectedHitGroupId !== contact.hitGroupId ||
            triggerDamageEvent.kind !==
              (contact.eventType === "hit"
                ? "direct"
                : "transformative-reaction")
          ) {
            addMissingReferenceIssue(
              context,
              [
                "dendroCoreContactLog",
                index,
                "triggerDamageEventIds",
                referenceIndex
              ],
              "core-contact trigger does not match its damage-event provenance"
            );
          }
        }
      );
      contact.contactedCoreIds.forEach((coreId, coreIndex) => {
        const removalId = contact.removalLogIds[coreIndex];
        const reactionDamageId =
          contact.reactionDamageLogIds[coreIndex];
        const removal =
          removalId === undefined
            ? undefined
            : lifecycleById.get(removalId);
        const reactionDamage =
          reactionDamageId === undefined
            ? undefined
            : reactionDamageById.get(reactionDamageId);
        if (
          removal === undefined ||
          removal.operation !== "consume" ||
          removal.coreId !== coreId ||
          removal.contactLogId !== contact.id
        ) {
          addMissingReferenceIssue(
            context,
            [
              "dendroCoreContactLog",
              index,
              "removalLogIds",
              coreIndex
            ],
            "contact does not resolve to the matching core-consumption log"
          );
        }
        if (
          reactionDamage === undefined ||
          reactionDamage.sourceCoreId !== coreId ||
          reactionDamage.sourceCoreLogId !== removalId ||
          reactionDamage.reaction !== contact.reaction
        ) {
          addMissingReferenceIssue(
            context,
            [
              "dendroCoreContactLog",
              index,
              "reactionDamageLogIds",
              coreIndex
            ],
            "contact does not resolve to the matching reaction-damage log"
          );
        }
      });
    });

    result.dendroCoreTimeline.points.forEach((point, index) => {
      const lifecycle = lifecycleById.get(point.dendroCoreLogId);
      if (
        lifecycle === undefined ||
        lifecycle.operation === "spawn-scheduled"
      ) {
        addMissingReferenceIssue(
          context,
          [
            "dendroCoreTimeline",
            "points",
            index,
            "dendroCoreLogId"
          ],
          `missing runtime lifecycle log ${point.dendroCoreLogId}`
        );
        return;
      }
      if (
        lifecycle.operation !== point.operation ||
        lifecycle.coreId !== point.coreId ||
        lifecycle.frame !== point.frame ||
        lifecycle.eventType !== point.eventType ||
        lifecycle.eventPriority !== point.eventPriority ||
        lifecycle.eventSequence !== point.eventSequence ||
        lifecycle.intraEventSequence >=
          point.intraEventSequence
      ) {
        addMissingReferenceIssue(
          context,
          [
            "dendroCoreTimeline",
            "points",
            index,
            "dendroCoreLogId"
          ],
          "timeline point does not match its referenced lifecycle log"
        );
      }
    });

    const coreReactionAAttempts: Array<{
      reaction: string;
      sourceActorId: string;
      targetId: string;
      frame: number;
      damageEventId: number;
      windowStartFrame: number;
      hitIndex: number;
      logIndex: number;
      decisionIndex: number;
    }> = [];

    result.reactionDamageLog.forEach((entry, index) => {
      if (
        entry.triggerDamageEventId !== null &&
        !damageEventById.has(entry.triggerDamageEventId)
      ) {
        addMissingReferenceIssue(
          context,
          [
            "reactionDamageLog",
            index,
            "triggerDamageEventId"
          ],
          `missing trigger damage event ${entry.triggerDamageEventId}`
        );
      }
      entry.damageEventIds.forEach(
        (damageEventId, referenceIndex) => {
          if (!damageEventById.has(damageEventId)) {
            addMissingReferenceIssue(
              context,
              [
                "reactionDamageLog",
                index,
                "damageEventIds",
                referenceIndex
              ],
              `missing produced damage event ${damageEventId}`
            );
          }
        }
      );
      if (
        (entry.sourceCoreId === null) !==
        (entry.sourceCoreLogId === null)
      ) {
        addMissingReferenceIssue(
          context,
          ["reactionDamageLog", index, "sourceCoreLogId"],
          "core-owned reaction damage requires both sourceCoreId and sourceCoreLogId"
        );
      } else if (
        entry.sourceCoreLogId !== null &&
        entry.sourceCoreId !== null
      ) {
        const lifecycle = lifecycleById.get(
          entry.sourceCoreLogId
        );
        if (
          lifecycle === undefined ||
          (lifecycle.operation !== "expire" &&
            lifecycle.operation !== "evict" &&
            lifecycle.operation !== "consume") ||
          lifecycle.coreId !== entry.sourceCoreId ||
          lifecycle.reactionDamageLogId !== entry.id
        ) {
          addMissingReferenceIssue(
            context,
            ["reactionDamageLog", index, "sourceCoreLogId"],
            "reaction damage does not resolve to its owning core-removal log"
          );
        }

        if (
          entry.damageEventIds.length !==
            entry.hitTargetIds.length ||
          entry.damageGroupDecisions.length !==
            entry.hitTargetIds.length
        ) {
          addMissingReferenceIssue(
            context,
            ["reactionDamageLog", index, "damageEventIds"],
            "core reaction damage requires hit targets, ReactionA decisions, and produced damage events to align 1:1"
          );
        }

        const checkedTargets = new Set(entry.checkedTargetIds);
        if (
          entry.hitTargetIds.some(
            (targetId) => !checkedTargets.has(targetId)
          )
        ) {
          addMissingReferenceIssue(
            context,
            ["reactionDamageLog", index, "hitTargetIds"],
            "every core-reaction hit target must appear in checkedTargetIds"
          );
        }

        if (
          !entry.withinSimulation &&
          (entry.checkedTargetIds.length !== 0 ||
            entry.hitTargetIds.length !== 0 ||
            entry.damageGroupDecisions.length !== 0 ||
            entry.damageEventIds.length !== 0)
        ) {
          addMissingReferenceIssue(
            context,
            ["reactionDamageLog", index, "withinSimulation"],
            "out-of-duration core reaction damage cannot retain resolved targets, decisions, or damage events"
          );
        }

        entry.damageEventIds.forEach(
          (damageEventId, referenceIndex) => {
            const produced = damageEventById.get(damageEventId);
            if (
              produced !== undefined &&
              (produced.kind !== "transformative-reaction" ||
                produced.parentDamageEventId !==
                  entry.triggerDamageEventId ||
                produced.sourceActorId !== entry.sourceActorId ||
                produced.scalingOwnerId !== entry.sourceActorId ||
                produced.creditOwnerId !== entry.sourceActorId ||
                produced.frame !== entry.damageFrame ||
                produced.element !== "dendro" ||
                produced.reaction !== entry.reaction ||
                produced.targetId !==
                  entry.hitTargetIds[referenceIndex])
            ) {
              addMissingReferenceIssue(
                context,
                [
                  "reactionDamageLog",
                  index,
                  "damageEventIds",
                  referenceIndex
                ],
                "produced damage event does not match its core-reaction parent, frame, reaction, source, or target"
              );
            }
          }
        );

        entry.damageGroupDecisions.forEach(
          (decision, decisionIndex) => {
            coreReactionAAttempts.push({
              reaction: decision.reaction,
              sourceActorId: decision.sourceActorId,
              targetId: decision.targetId,
              frame: entry.damageFrame,
              damageEventId:
                entry.damageEventIds[decisionIndex] ??
                Number.MAX_SAFE_INTEGER,
              windowStartFrame: decision.windowStartFrame,
              hitIndex: decision.hitIndex,
              logIndex: index,
              decisionIndex
            });
            if (
              decision.reaction !== entry.reaction ||
              decision.sourceActorId !== entry.sourceActorId ||
              decision.targetId !==
                entry.hitTargetIds[decisionIndex] ||
              decision.windowStartFrame > entry.damageFrame ||
              entry.damageFrame >=
                decision.windowStartFrame + decision.resetFrames
            ) {
              addMissingReferenceIssue(
                context,
                [
                  "reactionDamageLog",
                  index,
                  "damageGroupDecisions",
                  decisionIndex
                ],
                "ReactionA decision does not match the core reaction, source, target, or 30-frame damage window"
              );
            }
          }
        );

        const expectedBlockedTargets =
          entry.damageGroupDecisions
            .filter((decision) => !decision.damageAllowed)
            .map((decision) => decision.targetId);
        if (
          expectedBlockedTargets.length !==
            entry.damageGroupBlockedTargetIds.length ||
          expectedBlockedTargets.some(
            (targetId, targetIndex) =>
              targetId !==
              entry.damageGroupBlockedTargetIds[targetIndex]
          )
        ) {
          addMissingReferenceIssue(
            context,
            [
              "reactionDamageLog",
              index,
              "damageGroupBlockedTargetIds"
            ],
            "damageGroupBlockedTargetIds must exactly match blocked ReactionA decisions"
          );
        }
      }
    });

    const reactionAWindowByScope = new Map<
      string,
      { windowStartFrame: number; attemptCount: number }
    >();
    coreReactionAAttempts
      .sort(
        (left, right) =>
          left.frame - right.frame ||
          left.damageEventId - right.damageEventId
      )
      .forEach((attempt) => {
        const scopeKey = JSON.stringify([
          attempt.targetId,
          attempt.sourceActorId,
          attempt.reaction
        ]);
        const previous = reactionAWindowByScope.get(scopeKey);
        const startsNewWindow =
          previous === undefined ||
          attempt.frame - previous.windowStartFrame >= 30;
        const expectedWindowStartFrame = startsNewWindow
          ? attempt.frame
          : previous.windowStartFrame;
        const expectedHitIndex = startsNewWindow
          ? 0
          : previous.attemptCount;
        if (
          attempt.windowStartFrame !==
            expectedWindowStartFrame ||
          attempt.hitIndex !== expectedHitIndex
        ) {
          addMissingReferenceIssue(
            context,
            [
              "reactionDamageLog",
              attempt.logIndex,
              "damageGroupDecisions",
              attempt.decisionIndex
            ],
            "ReactionA windowStartFrame and hitIndex must follow target/actor/reaction attempt order"
          );
        }
        reactionAWindowByScope.set(scopeKey, {
          windowStartFrame: expectedWindowStartFrame,
          attemptCount: expectedHitIndex + 1
        });
      });
  });

const burningIcdApplicationSequenceSchema = z.tuple([
  z.literal(true),
  z.literal(false),
  z.literal(false),
  z.literal(false),
  z.literal(false),
  z.literal(false),
  z.literal(false),
  z.literal(false)
]);

export const burningStateLogEntrySchema = z
  .object({
    id: z.number().int().nonnegative(),
    reaction: z.literal("burning"),
    generation: z.number().int().nonnegative(),
    operation: z.enum([
      "start",
      "refresh-fuel",
      "refresh-snapshot",
      "tick",
      "tick-skipped",
      "stop",
      "fuel-expire"
    ]),
    frame: z.number().int().nonnegative(),
    timeSeconds: finiteNumber.nonnegative(),
    eventPriority: finiteNumber.nonnegative(),
    eventSequence: z.number().int().nonnegative(),
    clockModel: z.literal("target-local-no-hitlag"),
    hitlagStatus: z.literal("unsupported-enemy-hitlag"),
    targetId: idSchema,
    targetName: idSchema,
    triggerElement: elementSchema.nullable(),
    damageSourceActorId: idSchema.nullable(),
    fuelSourceActorId: idSchema.nullable(),
    triggerDamageEventId: z.number().int().nonnegative().nullable(),
    reactionDamageLogId: z.number().int().nonnegative().nullable(),
    damageEventIds: z.array(z.number().int().nonnegative()),
    playerHitResolutionLogId: z
      .number()
      .int()
      .nonnegative()
      .nullable(),
    playerDamageEventId: z.number().int().nonnegative().nullable(),
    tickIndex: z.number().int().positive().nullable(),
    tickSkipped: z.boolean(),
    skipReason: z.literal("COUNTER_9_SKIP").nullable(),
    damageAllowed: z.boolean().nullable(),
    burningGaugeUnitsBefore: finiteNumber.nonnegative(),
    burningGaugeUnitsAfter: finiteNumber.nonnegative(),
    fuelGaugeUnitsBefore: finiteNumber.nonnegative(),
    fuelGaugeUnitsAfter: finiteNumber.nonnegative(),
    fuelDecayPerFrame: finiteNumber.nonnegative(),
    fuelExpiresAtFrame: z.number().int().nonnegative().nullable(),
    auraBefore: z.array(auraStateEntrySchema),
    auraApplied: z.array(auraGaugeEntrySchema),
    auraConsumed: z.array(auraGaugeEntrySchema),
    auraAfter: z.array(auraStateEntrySchema),
    nextTickFrame: z.number().int().nonnegative().nullable(),
    icdGroup: z.literal("burning"),
    icdTag: z.literal("burning-application"),
    icdScope: z.literal("global-target"),
    icdWindowStartFrame: z.number().int().nonnegative().nullable(),
    icdHitIndex: z.number().int().nonnegative().nullable(),
    icdResetFrames: z.literal(120),
    icdApplicationSequence: burningIcdApplicationSequenceSchema,
    applicationAllowed: z.boolean().nullable(),
    applicationBlockedReason: z
      .enum([
        "BURNING_APPLICATION_ICD",
        "TARGET_AURA_BLOCKED"
      ])
      .nullable(),
    selfDamageStatus: playerSelfDamageStatusSchema,
    reason: z
      .enum([
        "FUEL_EXPIRED",
        "BURNING_AURA_CONSUMED",
        "TARGET_MECHANICS_TRUNCATION",
        "SOURCE_CHANGED"
      ])
      .nullable()
  })
  .strict()
  .superRefine((entry, context) => {
    const issue = (path: string, message: string): void => {
      context.addIssue({ code: "custom", path: [path], message });
    };
    if (entry.applicationAllowed === false) {
      if (entry.applicationBlockedReason !== "BURNING_APPLICATION_ICD") {
        issue(
          "applicationBlockedReason",
          "applicationAllowed=false requires BURNING_APPLICATION_ICD"
        );
      }
    } else if (
      entry.applicationAllowed === true &&
      entry.applicationBlockedReason !== null
    ) {
      issue(
        "applicationBlockedReason",
        "applicationBlockedReason requires applicationAllowed=false"
      );
    } else if (
      entry.applicationAllowed === null &&
      entry.applicationBlockedReason !== null &&
      entry.applicationBlockedReason !== "TARGET_AURA_BLOCKED"
    ) {
      issue(
        "applicationBlockedReason",
        "applicationAllowed=null only permits TARGET_AURA_BLOCKED"
      );
    }

    if (entry.operation === "tick") {
      if (entry.tickIndex === null) {
        issue("tickIndex", "tick requires a one-based tickIndex");
      }
      if (entry.reactionDamageLogId === null) {
        issue(
          "reactionDamageLogId",
          "tick requires a reaction-damage link"
        );
      }
      if (entry.tickSkipped || entry.skipReason !== null) {
        issue("tickSkipped", "tick cannot be marked skipped");
      }
      if (entry.damageAllowed === null) {
        issue(
          "damageAllowed",
          "tick requires a target damage-policy decision"
        );
      }
      if (entry.applicationAllowed === null) {
        if (
          entry.applicationBlockedReason !== "TARGET_AURA_BLOCKED"
        ) {
          issue(
            "applicationAllowed",
            "tick without an ICD decision requires TARGET_AURA_BLOCKED"
          );
        }
        if (
          entry.icdWindowStartFrame !== null ||
          entry.icdHitIndex !== null
        ) {
          issue(
            "icdWindowStartFrame",
            "Aura-blocked tick cannot consume a Burning ICD slot"
          );
        }
      } else if (
        entry.icdWindowStartFrame === null ||
        entry.icdHitIndex === null
      ) {
        issue(
          "icdWindowStartFrame",
          "tick requires its Burning application ICD window and hit index"
        );
      }
    } else if (entry.operation === "tick-skipped") {
      if (entry.tickIndex !== 9) {
        issue(
          "tickIndex",
          "tick-skipped is reserved for one-based tickIndex 9"
        );
      }
      if (!entry.tickSkipped || entry.skipReason !== "COUNTER_9_SKIP") {
        issue(
          "skipReason",
          "tick-skipped requires COUNTER_9_SKIP"
        );
      }
      if (entry.reactionDamageLogId !== null) {
        issue(
          "reactionDamageLogId",
          "tick-skipped cannot queue reaction damage"
        );
      }
      if (entry.damageEventIds.length !== 0) {
        issue("damageEventIds", "tick-skipped cannot link damage events");
      }
      if (entry.damageAllowed !== false) {
        issue("damageAllowed", "tick-skipped requires damageAllowed=false");
      }
      if (
        entry.applicationAllowed !== null ||
        entry.applicationBlockedReason !== null ||
        entry.icdWindowStartFrame !== null ||
        entry.icdHitIndex !== null
      ) {
        issue(
          "applicationAllowed",
          "tick-skipped cannot claim an application ICD decision"
        );
      }
    } else {
      if (entry.tickIndex !== null) {
        issue("tickIndex", `${entry.operation} cannot claim a tickIndex`);
      }
      if (entry.tickSkipped || entry.skipReason !== null) {
        issue("tickSkipped", `${entry.operation} cannot be marked skipped`);
      }
      if (entry.reactionDamageLogId !== null) {
        issue(
          "reactionDamageLogId",
          `${entry.operation} cannot claim a reaction-damage link`
        );
      }
      if (entry.damageEventIds.length !== 0) {
        issue(
          "damageEventIds",
          `${entry.operation} cannot claim damage-event links`
        );
      }
      if (entry.damageAllowed !== null) {
        issue(
          "damageAllowed",
          `${entry.operation} cannot claim a tick damage decision`
        );
      }
      if (
        entry.applicationAllowed !== null ||
        entry.applicationBlockedReason !== null ||
        entry.icdWindowStartFrame !== null ||
        entry.icdHitIndex !== null
      ) {
        issue(
          "applicationAllowed",
          `${entry.operation} cannot claim an application ICD decision`
        );
      }
    }

    if (
      entry.operation === "start" ||
      entry.operation === "refresh-fuel" ||
      entry.operation === "refresh-snapshot"
    ) {
      if (
        entry.triggerElement === null ||
        entry.triggerDamageEventId === null
      ) {
        issue(
          "triggerDamageEventId",
          `${entry.operation} requires its triggering hit and element`
        );
      }
      if (
        entry.reason !== null &&
        entry.reason !== "TARGET_MECHANICS_TRUNCATION"
      ) {
        issue(
          "reason",
          `${entry.operation} may only report target mechanics truncation`
        );
      }
      if (entry.reason === "TARGET_MECHANICS_TRUNCATION") {
        if (
          entry.nextTickFrame !== null ||
          entry.burningGaugeUnitsAfter !== 0 ||
          entry.fuelGaugeUnitsAfter !== 0 ||
          entry.fuelExpiresAtFrame !== null
        ) {
          issue(
            "nextTickFrame",
            "a truncated Burning start/refresh cannot establish a stream"
          );
        }
      }
    } else if (entry.operation === "fuel-expire") {
      if (entry.reason !== "FUEL_EXPIRED") {
        issue("reason", "fuel-expire requires FUEL_EXPIRED");
      }
    } else if (entry.operation === "stop") {
      if (
        entry.reason === null ||
        entry.reason === "FUEL_EXPIRED"
      ) {
        issue(
          "reason",
          "stop requires a non-expiry Burning stop reason"
        );
      }
    } else if (entry.reason !== null) {
      issue("reason", `${entry.operation} cannot declare a stop reason`);
    }

    if (
      entry.selfDamageStatus ===
      "unsupported-player-damage-model"
    ) {
      if (
        entry.playerHitResolutionLogId !== null ||
        entry.playerDamageEventId !== null
      ) {
        issue(
          "playerHitResolutionLogId",
          "unsupported player damage cannot retain player-side references"
        );
      }
    } else if (entry.operation === "tick") {
      if (entry.playerHitResolutionLogId === null) {
        issue(
          "playerHitResolutionLogId",
          "a modeled Burning tick requires a player hit-resolution link"
        );
      }
    } else if (
      entry.playerHitResolutionLogId !== null ||
      entry.playerDamageEventId !== null
    ) {
      issue(
        "playerHitResolutionLogId",
        `${entry.operation} cannot retain player-side damage references`
      );
    }
    if (
      entry.playerDamageEventId !== null &&
      entry.playerHitResolutionLogId === null
    ) {
      issue(
        "playerDamageEventId",
        "a player damage event requires a player hit-resolution link"
      );
    }
  });

const playerReactionSelfDamageKindSchema = z.enum([
  "burning",
  "bloom",
  "burgeon",
  "hyperbloom"
]);

const playerReactionSelfDamageAuthorities = {
  burning: {
    element: "pyro",
    selfDamageMultiplier: 1,
    damageRadius: 1
  },
  bloom: {
    element: "dendro",
    selfDamageMultiplier: 0.02,
    damageRadius: 5
  },
  burgeon: {
    element: "dendro",
    selfDamageMultiplier: 0.02,
    damageRadius: 5
  },
  hyperbloom: {
    element: "dendro",
    selfDamageMultiplier: 0.02,
    damageRadius: 1
  }
} as const;

const expectedPlayerResistanceMultiplier = (
  resistance: number
): number => {
  if (resistance < 0) return 1 - resistance / 2;
  if (resistance < 0.75) return 1 - resistance;
  return 1 / (4 * resistance + 1);
};

export const playerHitResolutionLogEntrySchema = z
  .object({
    id: z.number().int().nonnegative(),
    frame: z.number().int().nonnegative(),
    timeSeconds: finiteNumber.nonnegative(),
    eventPriority: finiteNumber.nonnegative(),
    eventSequence: z.number().int().nonnegative(),
    intraEventSequence: z.number().int().nonnegative(),
    reaction: playerReactionSelfDamageKindSchema,
    element: elementSchema,
    sourceActorId: wireNonEmptyStringSchema,
    sourceTargetId: wireNonEmptyStringSchema,
    targetActorId: wireNonEmptyStringSchema,
    reactionDamageLogId: z.number().int().nonnegative(),
    burningStateLogId: z.number().int().nonnegative().nullable(),
    dendroCoreRemovalLogId: z
      .number()
      .int()
      .nonnegative()
      .nullable(),
    damageCenter: derivedPoint2DSchema,
    damageRadius: finiteNumber.nonnegative(),
    playerCenter: derivedPoint2DSchema,
    playerRadius: finiteNumber.positive(),
    distance: finiteNumber.nonnegative(),
    distanceSquared: finiteNumber.nonnegative(),
    combinedRadius: finiteNumber.positive(),
    combinedRadiusSquared: finiteNumber.positive(),
    outcome: z.enum(["landed", "miss"]),
    blockedReason: z.literal("OUT_OF_RANGE").nullable(),
    playerDamageEventId: z.number().int().nonnegative().nullable()
  })
  .strict()
  .superRefine((entry, context) => {
    validateLogTime(entry, context);
    const authority =
      playerReactionSelfDamageAuthorities[entry.reaction];
    if (
      entry.element !== authority.element ||
      !approximatelyEqual(
        entry.damageRadius,
        authority.damageRadius
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["damageRadius"],
        message:
          "player hit element and damage radius must match the authoritative reaction mapping"
      });
    }
    const approximatelyEqualGeometry = (
      left: number,
      right: number
    ): boolean =>
      Math.abs(left - right) <=
      1e-9 * Math.max(1, Math.abs(left), Math.abs(right));
    const expectedDistanceSquared =
      (entry.damageCenter.x - entry.playerCenter.x) ** 2 +
      (entry.damageCenter.y - entry.playerCenter.y) ** 2;
    const expectedCombinedRadius =
      entry.damageRadius + entry.playerRadius;
    if (
      !approximatelyEqualGeometry(
        entry.distanceSquared,
        expectedDistanceSquared
      ) ||
      !approximatelyEqualGeometry(
        entry.distance,
        Math.sqrt(expectedDistanceSquared)
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["distance"],
        message:
          "distance and distanceSquared must match the recorded centers"
      });
    }
    if (
      !approximatelyEqualGeometry(
        entry.combinedRadius,
        expectedCombinedRadius
      ) ||
      !approximatelyEqualGeometry(
        entry.combinedRadiusSquared,
        expectedCombinedRadius ** 2
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["combinedRadius"],
        message:
          "combined radius values must equal damageRadius + playerRadius"
      });
    }
    const expectedLanded =
      expectedDistanceSquared <= expectedCombinedRadius ** 2;
    if (
      entry.outcome !== (expectedLanded ? "landed" : "miss") ||
      entry.blockedReason !==
        (expectedLanded ? null : "OUT_OF_RANGE")
    ) {
      context.addIssue({
        code: "custom",
        path: ["outcome"],
        message:
          "player hit outcome must follow the inclusive circular-overlap boundary"
      });
    }
    if (
      (entry.outcome === "landed") !==
      (entry.playerDamageEventId !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["playerDamageEventId"],
        message:
          "landed player hits require one damage event and misses require none"
      });
    }
    if (
      entry.reaction === "burning" &&
      entry.burningStateLogId === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["burningStateLogId"],
        message: "Burning player hits require a Burning-state link"
      });
    }
    if (
      entry.reaction !== "burning" &&
      entry.burningStateLogId !== null
    ) {
      context.addIssue({
        code: "custom",
        path: ["burningStateLogId"],
        message:
          "non-Burning player hits cannot link a Burning-state row"
      });
    }
    const isCoreReaction = entry.reaction !== "burning";
    if (
      isCoreReaction !==
      (entry.dendroCoreRemovalLogId !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["dendroCoreRemovalLogId"],
        message:
          "Bloom-family player hits require exactly one Dendro-core removal link"
      });
    }
  });

export const playerReactionSelfDamageFactorsSchema = z
  .object({
    reaction: playerReactionSelfDamageKindSchema,
    sourcePreResistanceDamage: finiteNumber.nonnegative(),
    selfDamageMultiplier: finiteNumber.nonnegative(),
    preResistanceDamage: finiteNumber.nonnegative(),
    effectiveResistance: finiteNumber,
    resistanceMultiplier: finiteNumber.nonnegative(),
    ignoreDefense: z.literal(1),
    defenseMultiplier: z.literal(1),
    damageGroupMultiplier: z.union([
      z.literal(0),
      z.literal(1)
    ]),
    damageGroupDecision:
      reactionADamageGroupAuditSchema.nullable(),
    finalDamage: finiteNumber.nonnegative()
  })
  .strict()
  .superRefine((factors, context) => {
    const authority =
      playerReactionSelfDamageAuthorities[factors.reaction];
    const expectedPreResistance =
      factors.sourcePreResistanceDamage *
      factors.selfDamageMultiplier;
    const expectedResistance =
      expectedPlayerResistanceMultiplier(
        factors.effectiveResistance
      );
    const expectedFinal =
      factors.preResistanceDamage *
      factors.resistanceMultiplier *
      factors.damageGroupMultiplier;
    if (
      !approximatelyEqual(
        factors.selfDamageMultiplier,
        authority.selfDamageMultiplier
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["selfDamageMultiplier"],
        message:
          "must match the authoritative player self-damage multiplier for the reaction"
      });
    }
    if (
      !approximatelyEqual(
        factors.resistanceMultiplier,
        expectedResistance
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["resistanceMultiplier"],
        message:
          "must be recomputed from effectiveResistance using the three-branch resistance formula"
      });
    }
    if (
      !approximatelyEqual(
        factors.preResistanceDamage,
        expectedPreResistance
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["preResistanceDamage"],
        message:
          "must equal sourcePreResistanceDamage * selfDamageMultiplier"
      });
    }
    if (
      !approximatelyEqual(factors.finalDamage, expectedFinal)
    ) {
      context.addIssue({
        code: "custom",
        path: ["finalDamage"],
        message:
          "must equal preResistanceDamage * resistanceMultiplier"
      });
    }
    if (factors.reaction === "burning") {
      if (
        factors.damageGroupMultiplier !== 1 ||
        factors.damageGroupDecision !== null
      ) {
        context.addIssue({
          code: "custom",
          path: ["damageGroupDecision"],
          message:
            "Burning requires multiplier 1 and no ReactionA decision"
        });
      }
    } else {
      const decision = factors.damageGroupDecision;
      if (
        decision === null ||
        decision.reaction !== factors.reaction ||
        decision.targetId !== "player-avatar" ||
        decision.damageAllowed !==
          (factors.damageGroupMultiplier === 1)
      ) {
        context.addIssue({
          code: "custom",
          path: ["damageGroupDecision"],
          message:
            "Bloom-family player damage requires a matching player-avatar ReactionA decision"
        });
      }
    }
  });

export const playerCrystallizeShieldResolutionSchema = z
  .object({
    mode: z.literal("crystallize-v1"),
    shieldId: z.number().int().nonnegative().nullable(),
    shieldElement: z
      .enum(["pyro", "cryo", "hydro", "electro"])
      .nullable(),
    incomingDamage: finiteNumber.nonnegative(),
    incomingElement: elementSchema,
    elementalMasteryBonus: finiteNumber,
    shieldStrengthBonus: finiteNumber,
    absorptionMultiplier: z.union([
      z.literal(1),
      z.literal(1.5),
      z.literal(2.5)
    ]),
    effectiveAbsorptionMultiplier: finiteNumber.positive(),
    baseHpBefore: finiteNumber.nonnegative(),
    baseHpConsumed: finiteNumber.nonnegative(),
    baseHpAfter: finiteNumber.nonnegative(),
    absorptionCapacity: finiteNumber.nonnegative(),
    absorbedDamage: finiteNumber.nonnegative(),
    damageAfterShield: finiteNumber.nonnegative(),
    shieldBroken: z.boolean()
  })
  .strict()
  .superRefine((resolution, context) => {
    const issue = (path: string, message: string): void => {
      context.addIssue({ code: "custom", path: [path], message });
    };
    if (
      !approximatelyEqual(
        resolution.baseHpAfter,
        resolution.baseHpBefore -
          resolution.baseHpConsumed
      )
    ) {
      issue(
        "baseHpAfter",
        "must equal baseHpBefore - baseHpConsumed"
      );
    }
    if (
      resolution.shieldId === null ||
      resolution.shieldElement === null
    ) {
      if (
        resolution.shieldId !== null ||
        resolution.shieldElement !== null ||
        resolution.baseHpBefore !== 0 ||
        resolution.baseHpConsumed !== 0 ||
        resolution.baseHpAfter !== 0 ||
        resolution.absorptionCapacity !== 0 ||
        resolution.absorbedDamage !== 0 ||
        resolution.elementalMasteryBonus !== 0 ||
        resolution.shieldStrengthBonus !== 0 ||
        resolution.absorptionMultiplier !== 1 ||
        resolution.effectiveAbsorptionMultiplier !== 1 ||
        !approximatelyEqual(
          resolution.damageAfterShield,
          resolution.incomingDamage
        ) ||
        resolution.shieldBroken
      ) {
        issue(
          "shieldId",
          "an absent shield requires null identity and zero absorption state"
        );
      }
    } else {
      const expectedAbsorptionMultiplier =
        resolution.incomingElement === resolution.shieldElement
          ? 2.5
          : resolution.incomingElement === "geo"
            ? 1.5
            : 1;
      const expectedEffectiveMultiplier =
        expectedAbsorptionMultiplier *
        (1 +
          resolution.elementalMasteryBonus +
          resolution.shieldStrengthBonus);
      if (
        resolution.absorptionMultiplier !==
          expectedAbsorptionMultiplier ||
        !approximatelyEqual(
          resolution.effectiveAbsorptionMultiplier,
          expectedEffectiveMultiplier
        )
      ) {
        issue(
          "effectiveAbsorptionMultiplier",
          "must apply matching-element/Geo absorption and recorded shield bonuses"
        );
      }
      const expectedCapacity =
        resolution.baseHpBefore *
        resolution.effectiveAbsorptionMultiplier;
      if (
        !approximatelyEqual(
          resolution.absorptionCapacity,
          expectedCapacity
        )
      ) {
        issue(
          "absorptionCapacity",
          "must equal baseHpBefore * effectiveAbsorptionMultiplier"
        );
      }
      if (
        !approximatelyEqual(
          resolution.baseHpConsumed,
          resolution.absorbedDamage /
            resolution.effectiveAbsorptionMultiplier
        )
      ) {
        issue(
          "baseHpConsumed",
          "must reproduce absorbed damage through the effective absorption multiplier"
        );
      }
      const expectedAbsorbedDamage = Math.min(
        resolution.incomingDamage,
        resolution.absorptionCapacity
      );
      const expectedShieldBroken =
        resolution.incomingDamage >=
        resolution.absorptionCapacity;
      if (
        !approximatelyEqual(
          resolution.absorbedDamage,
          expectedAbsorbedDamage
        )
      ) {
        issue(
          "absorbedDamage",
          "must equal min(incomingDamage, absorptionCapacity)"
        );
      }
      if (resolution.shieldBroken !== expectedShieldBroken) {
        issue(
          "shieldBroken",
          "a present shield breaks exactly when incomingDamage >= absorptionCapacity"
        );
      }
    }
    if (
      resolution.absorbedDamage >
      resolution.absorptionCapacity + 1e-9
    ) {
      issue(
        "absorbedDamage",
        "cannot exceed the available absorption capacity"
      );
    }
    if (
      !approximatelyEqual(
        resolution.incomingDamage,
        resolution.absorbedDamage +
          resolution.damageAfterShield
      )
    ) {
      issue(
        "damageAfterShield",
        "incoming damage must equal absorbed damage + damageAfterShield"
      );
    }
  });

export const playerHpDamageResolutionSchema = z
  .object({
    zeroHpPolicy: z.literal("clamp-and-continue"),
    inputCurrentHp: finiteNumber.nonnegative(),
    currentHpBefore: finiteNumber.nonnegative(),
    currentHpAfter: finiteNumber.nonnegative(),
    maxHp: finiteNumber.positive(),
    attemptedLoss: finiteNumber.nonnegative(),
    actualLoss: finiteNumber.nonnegative(),
    overkill: finiteNumber.nonnegative(),
    hpRatioBefore: finiteNumber.min(0).max(1),
    hpRatioAfter: finiteNumber.min(0).max(1)
  })
  .strict()
  .superRefine((resolution, context) => {
    const issue = (path: string, message: string): void => {
      context.addIssue({ code: "custom", path: [path], message });
    };
    if (
      !approximatelyEqual(
        resolution.currentHpBefore,
        Math.min(resolution.inputCurrentHp, resolution.maxHp)
      ) ||
      !approximatelyEqual(
        resolution.actualLoss,
        Math.min(
          resolution.currentHpBefore,
          resolution.attemptedLoss
        )
      ) ||
      !approximatelyEqual(
        resolution.currentHpAfter,
        resolution.currentHpBefore - resolution.actualLoss
      ) ||
      !approximatelyEqual(
        resolution.overkill,
        resolution.attemptedLoss - resolution.actualLoss
      )
    ) {
      issue(
        "currentHpAfter",
        "HP loss must clamp at zero and conserve attempted loss and overkill"
      );
    }
    if (
      !approximatelyEqual(
        resolution.hpRatioBefore,
        resolution.currentHpBefore / resolution.maxHp
      ) ||
      !approximatelyEqual(
        resolution.hpRatioAfter,
        resolution.currentHpAfter / resolution.maxHp
      )
    ) {
      issue(
        "hpRatioAfter",
        "HP ratios must match current HP divided by max HP"
      );
    }
  });

export const playerDamageEventSchema = z
  .object({
    id: z.number().int().nonnegative(),
    frame: z.number().int().nonnegative(),
    timeSeconds: finiteNumber.nonnegative(),
    eventPriority: finiteNumber.nonnegative(),
    eventSequence: z.number().int().nonnegative(),
    intraEventSequence: z.number().int().nonnegative(),
    reaction: playerReactionSelfDamageKindSchema,
    element: elementSchema,
    sourceActorId: wireNonEmptyStringSchema,
    sourceTargetId: wireNonEmptyStringSchema,
    targetActorId: wireNonEmptyStringSchema,
    reactionDamageLogId: z.number().int().nonnegative(),
    playerHitResolutionLogId: z.number().int().nonnegative(),
    burningStateLogId: z.number().int().nonnegative().nullable(),
    dendroCoreRemovalLogId: z
      .number()
      .int()
      .nonnegative()
      .nullable(),
    damageFactors: playerReactionSelfDamageFactorsSchema,
    shieldResolution:
      playerCrystallizeShieldResolutionSchema,
    hpResolution: playerHpDamageResolutionSchema,
    finalDamage: finiteNumber.nonnegative(),
    displayDamage: z.number().int().nonnegative()
  })
  .strict()
  .superRefine((event, context) => {
    validateLogTime(event, context);
    const authority =
      playerReactionSelfDamageAuthorities[event.reaction];
    if (
      event.damageFactors.reaction !== event.reaction ||
      event.shieldResolution.incomingElement !== event.element ||
      event.element !== authority.element
    ) {
      context.addIssue({
        code: "custom",
        path: ["damageFactors", "reaction"],
        message:
          "nested damage and shield audits must match the event reaction and element"
      });
    }
    const damageGroupDecision =
      event.damageFactors.damageGroupDecision;
    if (
      event.reaction !== "burning" &&
      (damageGroupDecision === null ||
        damageGroupDecision.sourceActorId !==
          event.sourceActorId ||
        damageGroupDecision.reaction !== event.reaction ||
        damageGroupDecision.targetId !== "player-avatar")
    ) {
      context.addIssue({
        code: "custom",
        path: ["damageFactors", "damageGroupDecision"],
        message:
          "player ReactionA decision must bind the event source actor, reaction, and player-avatar target"
      });
    }
    if (
      !approximatelyEqual(
        event.hpResolution.attemptedLoss,
        event.shieldResolution.damageAfterShield
      ) ||
      !approximatelyEqual(
        event.shieldResolution.incomingDamage,
        event.damageFactors.finalDamage
      ) ||
      !approximatelyEqual(
        event.finalDamage,
        event.hpResolution.actualLoss
      ) ||
      event.displayDamage !== Math.round(event.finalDamage)
    ) {
      context.addIssue({
        code: "custom",
        path: ["finalDamage"],
        message:
          "finalDamage must equal actual HP loss and displayDamage its nearest integer"
      });
    }
    if (
      event.reaction === "burning" &&
      event.burningStateLogId === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["burningStateLogId"],
        message: "Burning damage requires a Burning-state link"
      });
    }
    if (
      event.reaction !== "burning" &&
      event.burningStateLogId !== null
    ) {
      context.addIssue({
        code: "custom",
        path: ["burningStateLogId"],
        message:
          "non-Burning player damage cannot link a Burning-state row"
      });
    }
    if (
      (event.reaction !== "burning") !==
      (event.dendroCoreRemovalLogId !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["dendroCoreRemovalLogId"],
        message:
          "Bloom-family player damage requires exactly one core-removal link"
      });
    }
  });

export const crystallizeShieldLogEntrySchema = z
  .object({
    id: z.number().int().nonnegative(),
    operation: z.enum([
      "add",
      "overwrite",
      "absorb",
      "break",
      "expire"
    ]),
    frame: z.number().int().nonnegative(),
    timeSeconds: finiteNumber.nonnegative(),
    eventPriority: finiteNumber.nonnegative(),
    eventSequence: z.number().int().nonnegative(),
    intraEventSequence: z.number().int().nonnegative(),
    shieldId: z.number().int().nonnegative(),
    shardId: z.number().int().nonnegative(),
    element: z.enum(["pyro", "cryo", "hydro", "electro"]),
    sourceActorId: wireNonEmptyStringSchema,
    pickedUpByActorId: wireNonEmptyStringSchema,
    sourceCharacterLevel: z.number().int().positive(),
    sourceElementalMastery: finiteNumber.nonnegative(),
    baseHp: finiteNumber.nonnegative(),
    elementalMasteryBonus: finiteNumber.nonnegative(),
    generalAbsorption: finiteNumber.nonnegative(),
    matchingElementAbsorption: finiteNumber.nonnegative(),
    geoDamageAbsorption: finiteNumber.nonnegative(),
    currentBaseHp: finiteNumber.nonnegative(),
    expiresAtFrame: z.number().int().nonnegative(),
    previousShieldId: z.number().int().nonnegative().nullable(),
    playerDamageEventId: z.number().int().nonnegative().nullable(),
    incomingElement: elementSchema.nullable(),
    baseHpBeforeAbsorption: finiteNumber.nonnegative(),
    baseHpConsumed: finiteNumber.nonnegative(),
    baseHpAfterAbsorption: finiteNumber.nonnegative(),
    absorbedDamage: finiteNumber.nonnegative(),
    damageAfterShield: finiteNumber.nonnegative()
  })
  .strict()
  .superRefine((entry, context) => {
    validateLogTime(entry, context);
    const absorptionOperation =
      entry.operation === "absorb" ||
      entry.operation === "break";
    if (!absorptionOperation) {
      if (
        entry.playerDamageEventId !== null ||
        entry.incomingElement !== null ||
        entry.baseHpBeforeAbsorption !== 0 ||
        entry.baseHpConsumed !== 0 ||
        entry.baseHpAfterAbsorption !== 0 ||
        entry.absorbedDamage !== 0 ||
        entry.damageAfterShield !== 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["playerDamageEventId"],
          message:
            "add/overwrite/expire shield rows require null player link and zero absorption audit fields"
        });
      }
      return;
    }
    if (
      entry.playerDamageEventId === null ||
      entry.incomingElement === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["playerDamageEventId"],
        message:
          "absorb/break shield rows require player damage and incoming-element provenance"
      });
    }
    if (
      !approximatelyEqual(
        entry.baseHpAfterAbsorption,
        entry.baseHpBeforeAbsorption -
          entry.baseHpConsumed
      ) ||
      !approximatelyEqual(
        entry.currentBaseHp,
        entry.baseHpAfterAbsorption
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["baseHpAfterAbsorption"],
        message:
          "shield base HP must conserve the absorption and equal currentBaseHp"
      });
    }
    if (
      entry.operation === "break" !==
      approximatelyEqual(entry.baseHpAfterAbsorption, 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["operation"],
        message:
          "break requires zero remaining base HP; absorb requires a surviving shield"
      });
    }
  });

export const crystallizeShieldTimelinePointSchema = z
  .object({
    id: z.number().int().nonnegative(),
    frame: z.number().int().nonnegative(),
    timeSeconds: finiteNumber.nonnegative(),
    eventPriority: finiteNumber.nonnegative(),
    eventSequence: z.number().int().nonnegative(),
    intraEventSequence: z.number().int().nonnegative(),
    operation: z.enum([
      "add",
      "overwrite",
      "absorb",
      "break",
      "expire"
    ]),
    shieldId: z.number().int().nonnegative().nullable(),
    element: z
      .enum(["pyro", "cryo", "hydro", "electro"])
      .nullable(),
    generalAbsorption: finiteNumber.nonnegative(),
    expiresAtFrame: z.number().int().nonnegative().nullable(),
    playerDamageEventId: z.number().int().nonnegative().nullable(),
    baseHpBeforeAbsorption: finiteNumber.nonnegative(),
    baseHpAfterAbsorption: finiteNumber.nonnegative(),
    absorbedDamage: finiteNumber.nonnegative(),
    damageAfterShield: finiteNumber.nonnegative()
  })
  .strict()
  .superRefine((point, context) => {
    validateLogTime(point, context);
    const absorptionOperation =
      point.operation === "absorb" ||
      point.operation === "break";
    if (!absorptionOperation) {
      if (
        point.playerDamageEventId !== null ||
        point.baseHpBeforeAbsorption !== 0 ||
        point.baseHpAfterAbsorption !== 0 ||
        point.absorbedDamage !== 0 ||
        point.damageAfterShield !== 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["playerDamageEventId"],
          message:
            "non-absorption timeline points require null player link and zero absorption audit fields"
        });
      }
    } else if (
      point.playerDamageEventId === null ||
      (point.operation === "absorb" && point.shieldId === null) ||
      (point.operation === "break" && point.shieldId !== null) ||
      (point.operation === "break") !==
        approximatelyEqual(point.baseHpAfterAbsorption, 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["playerDamageEventId"],
        message:
          "absorb/break timeline points require a player link and coherent post-operation shield state"
      });
    }
  });

export const playerHpTimelinePointSchema = z
  .object({
    id: z.number().int().nonnegative(),
    frame: z.number().int().nonnegative(),
    timeSeconds: finiteNumber.nonnegative(),
    eventPriority: finiteNumber.nonnegative().nullable(),
    eventSequence: z.number().int().nonnegative().nullable(),
    intraEventSequence: z.number().int().nonnegative().nullable(),
    operation: z.enum([
      "initial",
      "damage",
      "simulation-end"
    ]),
    actorId: wireNonEmptyStringSchema,
    playerDamageEventId: z.number().int().nonnegative().nullable(),
    maxHp: finiteNumber.positive(),
    hpBefore: finiteNumber.nonnegative(),
    hpAfter: finiteNumber.nonnegative(),
    hpRatioAfter: finiteNumber.min(0).max(1)
  })
  .strict()
  .superRefine((point, context) => {
    validateLogTime(point, context);
    if (
      !approximatelyEqual(
        point.hpRatioAfter,
        point.hpAfter / point.maxHp
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["hpRatioAfter"],
        message: "must equal hpAfter / maxHp"
      });
    }
    if (
      point.operation === "damage" &&
      point.playerDamageEventId === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["playerDamageEventId"],
        message: "damage timeline points require a damage-event link"
      });
    }
    if (
      point.operation !== "damage" &&
      (point.playerDamageEventId !== null ||
        point.eventPriority !== null ||
        point.eventSequence !== null ||
        point.intraEventSequence !== null ||
        !approximatelyEqual(point.hpBefore, point.hpAfter))
    ) {
      context.addIssue({
        code: "custom",
        path: ["playerDamageEventId"],
        message:
          "boundary HP points cannot link damage or mutate current HP"
      });
    } else if (
      point.operation === "damage" &&
      (point.eventPriority === null ||
        point.eventSequence === null ||
        point.intraEventSequence === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["eventPriority"],
        message: "damage HP points require a complete event tuple"
      });
    }
  });

export const playerHpTimelineSchema = z
  .object({
    version: z.literal("1.0.0"),
    points: z.array(playerHpTimelinePointSchema)
  })
  .strict()
  .superRefine((timeline, context) => {
    let previousFrame = -1;
    let previousTuple:
      | readonly [number, number, number]
      | null = null;
    let previousOperation:
      | "initial"
      | "damage"
      | "simulation-end"
      | null = null;
    timeline.points.forEach((point, index) => {
      if (point.id !== index) {
        context.addIssue({
          code: "custom",
          path: ["points", index, "id"],
          message: `expected contiguous timeline id ${index}`
        });
      }
      if (point.frame < previousFrame) {
        context.addIssue({
          code: "custom",
          path: ["points", index, "frame"],
          message: "HP timeline frames must be non-decreasing"
        });
      }
      const tuple = [
        point.operation === "initial"
          ? -1
          : point.operation === "simulation-end"
            ? Number.POSITIVE_INFINITY
            : point.eventPriority!,
        point.eventSequence ?? 0,
        point.intraEventSequence ?? 0
      ] as const;
      if (point.frame !== previousFrame) {
        previousTuple = null;
        previousOperation = null;
      }
      const sameTuple =
        previousTuple !== null &&
        tuple[0] === previousTuple[0] &&
        tuple[1] === previousTuple[1] &&
        tuple[2] === previousTuple[2];
      const repeatedBoundary =
        sameTuple &&
        point.operation !== "damage" &&
        previousOperation === point.operation;
      if (
        previousTuple !== null &&
        (tuple[0] < previousTuple[0] ||
          (tuple[0] === previousTuple[0] &&
            tuple[1] < previousTuple[1]) ||
          (tuple[0] === previousTuple[0] &&
            tuple[1] === previousTuple[1] &&
            tuple[2] <= previousTuple[2] &&
            !repeatedBoundary))
      ) {
        context.addIssue({
          code: "custom",
          path: ["points", index, "eventPriority"],
          message:
            "same-frame HP points must follow priority, sequence, and intra-event order"
        });
      }
      previousFrame = point.frame;
      previousTuple = tuple;
      previousOperation = point.operation;
    });
  });

export const playerHpSummarySchema = z
  .object({
    actorId: wireNonEmptyStringSchema,
    maxHp: finiteNumber.positive(),
    initialHp: finiteNumber.nonnegative(),
    finalHp: finiteNumber.nonnegative(),
    totalIncomingDamage: finiteNumber.nonnegative(),
    totalAbsorbedDamage: finiteNumber.nonnegative(),
    totalHpDamage: finiteNumber.nonnegative(),
    hitCount: z.number().int().nonnegative(),
    zeroHpReached: z.boolean()
  })
  .strict()
  .superRefine((summary, context) => {
    if (
      summary.initialHp > summary.maxHp + 1e-9 ||
      summary.finalHp > summary.maxHp + 1e-9 ||
      !approximatelyEqual(
        summary.totalHpDamage,
        summary.initialHp - summary.finalHp
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["totalHpDamage"],
        message:
          "summary HP values must stay within max HP and conserve total HP damage"
      });
    }
    if (
      summary.zeroHpReached !==
      approximatelyEqual(summary.finalHp, 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["zeroHpReached"],
        message: "must reflect whether final HP reached zero"
      });
    }
  });

export const characterStatsSchema = z
  .object({
    baseAtk: finiteNumber.default(0),
    atkPct: finiteNumber.default(0),
    flatAtk: finiteNumber.default(0),
    baseHp: finiteNumber.default(0),
    hpPct: finiteNumber.default(0),
    flatHp: finiteNumber.default(0),
    baseDef: finiteNumber.default(0),
    defPct: finiteNumber.default(0),
    flatDef: finiteNumber.default(0),
    em: finiteNumber.default(0),
    critRate: finiteNumber.default(0.05),
    critDmg: finiteNumber.default(0.5),
    dmgBonus: finiteNumber.default(0),
    defIgnore: finiteNumber.default(0),
    reactionBonus: finiteNumber.default(0),
    energyRecharge: finiteNumber.min(0).max(10).default(1)
  })
  .strict();

export const characterProfileSchema = z
  .object({
    id: idSchema,
    name: idSchema,
    element: elementSchema,
    color: z.string().trim().min(1),
    level: z.number().int().min(1).max(100),
    energyMax: finiteNumber.min(0),
    initialEnergy: finiteNumber.min(0),
    stats: characterStatsSchema
  })
  .strict()
  .superRefine((character, context) => {
    if (character.initialEnergy > character.energyMax) {
      context.addIssue({
        code: "custom",
        path: ["initialEnergy"],
        message: "must not exceed energyMax"
      });
    }
  });

export const actorPoseDefinitionSchema = z
  .object({
    actorId: idSchema,
    position: point2DSchema,
    facingDegrees: finiteNumber.min(-360).max(360)
  })
  .strict();

export const flatDamageSourceSchema = z
  .object({
    ownerId: idSchema.optional(),
    stat: scalingStatSchema.optional(),
    multiplier: finiteNumber
  })
  .strict();

export const targetEffectPolicySchema = z
  .object({
    damage: z.enum(["normal", "immune"]),
    aura: z.enum(["normal", "blocked"]),
    hitConfirm: z.enum(["normal", "blocked"])
  })
  .strict()
  .superRefine((effects, context) => {
    if (
      effects.damage === "normal" &&
      effects.aura === "normal" &&
      effects.hitConfirm === "normal"
    ) {
      context.addIssue({
        code: "custom",
        message: "must change at least one target effect"
      });
    }
  });

export const targetPhaseDefinitionSchema = z
  .object({
    id: idSchema,
    label: idSchema,
    targetId: idSchema,
    startFrame: z.number().int().min(0).max(36_000),
    endFrame: z.number().int().positive().max(36_000),
    reason: z.string().trim().min(1),
    effects: targetEffectPolicySchema
  })
  .strict()
  .superRefine((phase, context) => {
    if (phase.endFrame <= phase.startFrame) {
      context.addIssue({
        code: "custom",
        path: ["endFrame"],
        message: "must be greater than startFrame"
      });
    }
  });

export const targetMotionDefinitionSchema = z
  .object({
    id: idSchema,
    label: idSchema,
    targetId: idSchema,
    startFrame: z.number().int().min(0).max(36_000),
    endFrame: z.number().int().positive().max(36_000),
    endPosition: point2DSchema
  })
  .strict()
  .superRefine((motion, context) => {
    if (motion.endFrame <= motion.startFrame) {
      context.addIssue({
        code: "custom",
        path: ["endFrame"],
        message: "must be greater than startFrame"
      });
    }
  });

export const enemyTargetProfileSchema = z
  .object({
    id: idSchema,
    name: idSchema,
    level: z.number().int().min(1).max(200).optional(),
    resistance: finiteNumber.optional(),
    defReduction: finiteNumber.optional(),
    freezeResistance: finiteNumber.min(0).max(1).optional(),
    initialAura: z.array(initialAuraApplicationSchema).max(5).optional(),
    position: point2DSchema.optional(),
    hitboxRadius: finiteNumber.min(0).max(1_000).optional()
  })
  .strict();

export const enemyProfileSchema = z
  .object({
    level: z.number().int().min(1).max(200),
    resistance: finiteNumber,
    defReduction: finiteNumber,
    freezeResistance: finiteNumber.min(0).max(1).optional(),
    targets: z.array(enemyTargetProfileSchema).min(1).max(32).optional(),
    targetPhases: z.array(targetPhaseDefinitionSchema).max(256).optional(),
    targetMotions: z.array(targetMotionDefinitionSchema).max(256).optional()
  })
  .strict()
  .superRefine((enemy, context) => {
    const targetIds = new Set<string>();
    for (const [index, target] of (enemy.targets ?? []).entries()) {
      if (targetIds.has(target.id)) {
        context.addIssue({
          code: "custom",
          path: ["targets", index, "id"],
          message: `duplicate enemy target id "${target.id}"`
        });
      }
      targetIds.add(target.id);
      const auraElements = new Set<string>();
      for (const [auraIndex, aura] of (
        target.initialAura ?? []
      ).entries()) {
        if (auraElements.has(aura.element)) {
          context.addIssue({
            code: "custom",
            path: ["targets", index, "initialAura", auraIndex, "element"],
            message: `duplicate initial aura element "${aura.element}"`
          });
        }
        auraElements.add(aura.element);
      }
    }
    if (enemy.targets !== undefined && !targetIds.has("enemy-0")) {
      context.addIssue({
        code: "custom",
        path: ["targets"],
        message:
          'must include compatibility target "enemy-0" because hits without targeting resolve to it'
      });
    }

    const targetById = new Map(
      (enemy.targets ?? []).map((target) => [target.id, target])
    );
    const motionIds = new Set<string>();
    const previousMotionEndFrameByTarget = new Map<string, number>();
    for (const [index, motion] of (
      enemy.targetMotions ?? []
    ).entries()) {
      if (motionIds.has(motion.id)) {
        context.addIssue({
          code: "custom",
          path: ["targetMotions", index, "id"],
          message: `duplicate target motion id "${motion.id}"`
        });
      }
      motionIds.add(motion.id);
      const target = targetById.get(motion.targetId);
      if (target === undefined) {
        context.addIssue({
          code: "custom",
          path: ["targetMotions", index, "targetId"],
          message: `unknown enemy target id "${motion.targetId}"`
        });
      } else if (target.position === undefined) {
        context.addIssue({
          code: "custom",
          path: ["targetMotions", index, "targetId"],
          message: `target "${motion.targetId}" requires an initial position`
        });
      }
      const previousEndFrame =
        previousMotionEndFrameByTarget.get(motion.targetId) ?? -1;
      if (motion.startFrame < previousEndFrame) {
        context.addIssue({
          code: "custom",
          path: ["targetMotions", index, "startFrame"],
          message:
            "target motions must be sorted and non-overlapping per target"
        });
      }
      previousMotionEndFrameByTarget.set(
        motion.targetId,
        Math.max(previousEndFrame, motion.endFrame)
      );
    }

    const phaseIds = new Set<string>();
    const previousEndFrameByTarget = new Map<string, number>();
    for (const [index, phase] of (enemy.targetPhases ?? []).entries()) {
      if (phaseIds.has(phase.id)) {
        context.addIssue({
          code: "custom",
          path: ["targetPhases", index, "id"],
          message: `duplicate target phase id "${phase.id}"`
        });
      }
      phaseIds.add(phase.id);
      const previousEndFrame =
        previousEndFrameByTarget.get(phase.targetId) ?? -1;
      if (phase.startFrame < previousEndFrame) {
        context.addIssue({
          code: "custom",
          path: ["targetPhases", index, "startFrame"],
          message:
            "target phases must be sorted and non-overlapping with half-open boundaries"
        });
      }
      previousEndFrameByTarget.set(
        phase.targetId,
        Math.max(previousEndFrame, phase.endFrame)
      );
    }
  });

export const hitTargetingSchema = z
  .object({
    targetId: idSchema,
    outcome: z.enum(["landed", "miss"]),
    reason: z.string().trim().min(1).optional(),
    effects: targetEffectPolicySchema.optional()
  })
  .strict()
  .superRefine((targeting, context) => {
    const requiresReason =
      targeting.outcome === "miss" || targeting.effects !== undefined;
    if (requiresReason && targeting.reason === undefined) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message:
          "is required for a miss or non-normal target effect policy"
      });
    }
    if (!requiresReason && targeting.reason !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message:
          "must be omitted for a normal landed target result"
      });
    }
    if (targeting.outcome === "miss" && targeting.effects !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["effects"],
        message: "must be omitted when outcome is miss"
      });
    }
  });

export const hitTargetingGroupSchema = z
  .object({
    mode: z.literal("fanout"),
    targets: z.array(hitTargetingSchema).min(1).max(32)
  })
  .strict()
  .superRefine((group, context) => {
    const targetIds = new Set<string>();
    for (const [index, targeting] of group.targets.entries()) {
      if (targetIds.has(targeting.targetId)) {
        context.addIssue({
          code: "custom",
          path: ["targets", index, "targetId"],
          message: `duplicate fanout target id "${targeting.targetId}"`
        });
      }
      targetIds.add(targeting.targetId);
    }
  });

export const hitTargetingConfigSchema = z.union([
  hitTargetingSchema,
  hitTargetingGroupSchema
]);

export const circleHitGeometrySchema = z
  .object({
    kind: z.literal("circle"),
    coordinateSpace: geometryCoordinateSpaceSchema.optional(),
    origin: point2DSchema,
    radius: finiteNumber.min(0).max(1_000)
  })
  .strict();

export const rectangleHitGeometrySchema = z
  .object({
    kind: z.literal("rectangle"),
    coordinateSpace: geometryCoordinateSpaceSchema.optional(),
    origin: point2DSchema,
    halfWidth: finiteNumber.positive().max(1_000),
    halfHeight: finiteNumber.positive().max(1_000),
    rotationDegrees: finiteNumber.min(-360).max(360)
  })
  .strict();

export const capsuleHitGeometrySchema = z
  .object({
    kind: z.literal("capsule"),
    coordinateSpace: geometryCoordinateSpaceSchema.optional(),
    start: point2DSchema,
    end: point2DSchema,
    radius: finiteNumber.min(0).max(1_000)
  })
  .strict();

export const sectorHitGeometrySchema = z
  .object({
    kind: z.literal("sector"),
    coordinateSpace: geometryCoordinateSpaceSchema.optional(),
    origin: point2DSchema,
    radius: finiteNumber.positive().max(1_000),
    directionDegrees: finiteNumber.min(-360).max(360),
    angleDegrees: finiteNumber.positive().max(360)
  })
  .strict();

export const hitGeometrySchema = z.discriminatedUnion("kind", [
  circleHitGeometrySchema,
  rectangleHitGeometrySchema,
  capsuleHitGeometrySchema,
  sectorHitGeometrySchema
]);

const hitDefinitionObjectSchema = z
  .object({
    id: idSchema.optional(),
    offset: finiteNumber.min(0),
    label: z.string().optional(),
    scaling: finiteNumber,
    scalingStat: scalingStatSchema.optional(),
    element: elementSchema.optional(),
    strikeType: z.enum(["default", "blunt"]).optional(),
    poiseDamage: finiteNumber.min(0).optional(),
    targeting: hitTargetingConfigSchema.optional(),
    geometry: hitGeometrySchema.optional(),
    application: elementalApplicationSchema.optional(),
    reaction: reactionSchema.optional(),
    reactionOverride: reactionSchema.optional(),
    snapshot: z.enum(["action", "hit"]).optional(),
    scalingOwnerId: idSchema.optional(),
    creditId: idSchema.optional(),
    flat: finiteNumber.optional(),
    flatSources: z.array(flatDamageSourceSchema).optional(),
    dmgBonus: finiteNumber.optional(),
    defIgnore: finiteNumber.optional(),
    defReduction: finiteNumber.optional(),
    resShred: finiteNumber.optional(),
    critRate: finiteNumber.optional(),
    critDmg: finiteNumber.optional(),
    reactionBonus: finiteNumber.optional(),
    ampBase: finiteNumber.optional(),
    groupMultiplier: finiteNumber.optional()
  })
  .strict();

const validateHitPoiseDamage = (
  hit: {
    strikeType?: "default" | "blunt" | undefined;
    poiseDamage?: number | undefined;
  },
  context: z.RefinementCtx
): void => {
    if (
      hit.poiseDamage !== undefined &&
      hit.strikeType !== "blunt"
    ) {
      context.addIssue({
        code: "custom",
        path: ["poiseDamage"],
        message: 'requires strikeType "blunt"'
      });
    }
};

export const hitDefinitionSchema =
  hitDefinitionObjectSchema.superRefine(validateHitPoiseDamage);

export const buffDefinitionSchema = z
  .object({
    kind: z.literal("buff").optional(),
    key: idSchema.optional(),
    label: z.string().optional(),
    target: z
      .union([z.string(), z.array(idSchema).min(1)])
      .optional(),
    stat: z.enum([
      "atkFlat",
      "atkPct",
      "hpFlat",
      "hpPct",
      "defFlat",
      "defPct",
      "dmgBonus",
      "critRate",
      "critDmg",
      "em",
      "defIgnore",
      "reactionBonus",
      "energyRecharge"
    ]),
    value: finiteNumber,
    duration: finiteNumber.min(0),
    offset: finiteNumber.min(0).optional()
  })
  .strict();

export const debuffDefinitionSchema = z
  .object({
    kind: z.literal("debuff").optional(),
    key: idSchema.optional(),
    label: z.string().optional(),
    element: z.union([elementSchema, z.literal("all")]).optional(),
    resShred: finiteNumber.optional(),
    defReduction: finiteNumber.optional(),
    duration: finiteNumber.min(0),
    offset: finiteNumber.min(0).optional()
  })
  .strict();

export const energyInternalCooldownSchema = z
  .object({
    key: idSchema,
    duration: finiteNumber.positive()
  })
  .strict();

export const energyEventSchema = z
  .object({
    target: z.union([z.string(), z.array(idSchema)]).optional(),
    amount: finiteNumber,
    offset: finiteNumber.min(0).optional(),
    source: idSchema.optional(),
    internalCooldown: energyInternalCooldownSchema.optional()
  })
  .strict();

export const particleCountRangeSchema = z
  .object({
    min: finiteNumber.positive(),
    max: finiteNumber.positive(),
    step: finiteNumber.positive().optional()
  })
  .strict()
  .superRefine((range, context) => {
    if (range.max < range.min) {
      context.addIssue({
        code: "custom",
        path: ["max"],
        message: "must be greater than or equal to min"
      });
    }
    if (
      range.step !== undefined &&
      range.step > range.max - range.min + 1e-12 &&
      range.max !== range.min
    ) {
      context.addIssue({
        code: "custom",
        path: ["step"],
        message: "must not exceed the configured range"
      });
    }
    if (range.step !== undefined) {
      const steps = (range.max - range.min) / range.step;
      if (Math.abs(steps - Math.round(steps)) > 1e-9) {
        context.addIssue({
          code: "custom",
          path: ["step"],
          message: "must divide the min-to-max range into whole steps"
        });
      }
    }
  });

const particleDefinitionObjectSchema = z
  .object({
    id: idSchema.optional(),
    source: idSchema.optional(),
    kind: z.enum(["particle", "orb"]).optional(),
    element: z.union([
      z.enum(["pyro", "cryo", "hydro", "electro", "anemo", "geo", "dendro"]),
      z.literal("neutral")
    ]),
    count: z.union([finiteNumber.positive(), particleCountRangeSchema]),
    spawnOffset: finiteNumber.min(0).optional(),
    travelTime: finiteNumber.min(0),
    trigger: z
      .object({
        kind: z.literal("hit-confirm"),
        hitIds: z.array(idSchema).min(1),
        internalCooldown: energyInternalCooldownSchema.optional()
      })
      .strict()
      .optional()
  })
  .strict();

export const particleDefinitionSchema =
  particleDefinitionObjectSchema.superRefine((particle, context) => {
    if (
      particle.trigger !== undefined &&
      particle.spawnOffset !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["spawnOffset"],
        message: "must be omitted for hit-confirm particle triggers"
      });
    }
    const hitIds = new Set<string>();
    for (const [index, hitId] of (
      particle.trigger?.hitIds ?? []
    ).entries()) {
      if (hitIds.has(hitId)) {
        context.addIssue({
          code: "custom",
          path: ["trigger", "hitIds", index],
          message: `duplicate hit id "${hitId}"`
        });
      }
      hitIds.add(hitId);
    }
  });

export const actionDefinitionSchema = z
  .object({
    id: idSchema,
    actorId: idSchema,
    name: idSchema,
    at: finiteNumber.min(0),
    once: z.boolean().optional(),
    cycles: z.array(z.number().int().min(0)).optional(),
    everyNCycles: z.number().int().positive().optional(),
    cycleRemainder: z.number().int().min(0).optional(),
    energyCost: finiteNumber.min(0).optional(),
    hits: z.array(hitDefinitionSchema).optional(),
    buffs: z.array(buffDefinitionSchema).optional(),
    debuffs: z.array(debuffDefinitionSchema).optional(),
    energyGains: z.array(energyEventSchema).optional(),
    particles: z.array(particleDefinitionSchema).optional(),
    timelineCommandIndex: z.number().int().min(0).optional(),
    sourceAbilityId: idSchema.optional(),
    startFrame: z.number().int().min(0).optional(),
    cancelFrame: z.number().int().min(0).optional(),
    animationEndFrame: z.number().int().min(0).optional()
  })
  .strict()
  .superRefine((action, context) => {
    const hitIds = new Set(
      (action.hits ?? []).flatMap((hit) =>
        hit.id === undefined ? [] : [hit.id]
      )
    );
    for (const [particleIndex, particle] of (
      action.particles ?? []
    ).entries()) {
      for (const [hitIndex, hitId] of (
        particle.trigger?.hitIds ?? []
      ).entries()) {
        if (!hitIds.has(hitId)) {
          context.addIssue({
            code: "custom",
            path: [
              "particles",
              particleIndex,
              "trigger",
              "hitIds",
              hitIndex
            ],
            message: `unknown action hit id "${hitId}"`
          });
        }
      }
    }
  });

const frameSchema = z.number().int().min(0);

export const frameHitDefinitionSchema = hitDefinitionObjectSchema
  .omit({ offset: true })
  .extend({
    frame: frameSchema
  })
  .strict()
  .superRefine(validateHitPoiseDamage);

export const frameBuffDefinitionSchema = buffDefinitionSchema
  .omit({ duration: true, offset: true })
  .extend({
    startFrame: frameSchema.optional(),
    durationFrames: frameSchema
  })
  .strict();

export const frameDebuffDefinitionSchema = debuffDefinitionSchema
  .omit({ duration: true, offset: true })
  .extend({
    startFrame: frameSchema.optional(),
    durationFrames: frameSchema
  })
  .strict();

export const frameEnergyEventSchema = energyEventSchema
  .omit({ offset: true, internalCooldown: true })
  .extend({
    frame: frameSchema.optional(),
    internalCooldown: z
      .object({
        key: idSchema,
        durationFrames: z.number().int().positive()
      })
      .strict()
      .optional()
  })
  .strict();

export const frameParticleDefinitionSchema = particleDefinitionObjectSchema
  .omit({ spawnOffset: true, travelTime: true, trigger: true })
  .extend({
    spawnFrame: frameSchema.optional(),
    travelFrames: frameSchema,
    trigger: z
      .object({
        kind: z.literal("hit-confirm"),
        hitIds: z.array(idSchema).min(1),
        internalCooldown: z
          .object({
            key: idSchema,
            durationFrames: z.number().int().positive()
          })
          .strict()
          .optional()
      })
      .strict()
      .optional()
  })
  .strict()
  .superRefine((particle, context) => {
    if (
      particle.trigger !== undefined &&
      particle.spawnFrame !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["spawnFrame"],
        message: "must be omitted for hit-confirm particle triggers"
      });
    }
    const hitIds = new Set<string>();
    for (const [index, hitId] of (
      particle.trigger?.hitIds ?? []
    ).entries()) {
      if (hitIds.has(hitId)) {
        context.addIssue({
          code: "custom",
          path: ["trigger", "hitIds", index],
          message: `duplicate hit id "${hitId}"`
        });
      }
      hitIds.add(hitId);
    }
  });

export const timelineStateGrantSchema = z
  .object({
    key: idSchema,
    label: idSchema,
    durationFrames: z.number().int().min(1).max(216_000)
  })
  .strict();

export const abilityTimelineStateSchema = z
  .object({
    requires: z.array(idSchema).optional(),
    consumes: z.array(idSchema).optional(),
    clears: z.array(idSchema).optional(),
    grants: z.array(timelineStateGrantSchema).optional()
  })
  .strict()
  .superRefine((state, context) => {
    for (const field of ["requires", "consumes", "clears"] as const) {
      const seen = new Set<string>();
      for (const [index, key] of (state[field] ?? []).entries()) {
        if (seen.has(key)) {
          context.addIssue({
            code: "custom",
            path: [field, index],
            message: `duplicate state key "${key}"`
          });
        }
        seen.add(key);
      }
    }
    const grantKeys = new Set<string>();
    for (const [index, grant] of (state.grants ?? []).entries()) {
      if (grantKeys.has(grant.key)) {
        context.addIssue({
          code: "custom",
          path: ["grants", index, "key"],
          message: `duplicate state key "${grant.key}"`
        });
      }
      grantKeys.add(grant.key);
    }
    const required = new Set(state.requires ?? []);
    for (const [index, key] of (state.consumes ?? []).entries()) {
      if (!required.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["consumes", index],
          message: `consumed state "${key}" must also be required`
        });
      }
    }
  });

export const abilityCancelFramesSchema = z
  .object({
    normal: frameSchema.optional(),
    charge: frameSchema.optional(),
    skill: frameSchema.optional(),
    burst: frameSchema.optional(),
    dash: frameSchema.optional(),
    jump: frameSchema.optional(),
    swap: frameSchema.optional()
  })
  .strict();

export const abilityDefinitionSchema = z
  .object({
    id: idSchema,
    actorId: idSchema,
    name: idSchema,
    kind: z.enum(["skill", "burst", "normal", "charge"]),
    cancelFrame: frameSchema,
    cancelFrames: abilityCancelFramesSchema.optional(),
    animationEndFrame: frameSchema,
    cooldownFrames: frameSchema,
    maxCharges: z.number().int().min(1).max(10).optional(),
    chargeRecoveryFrames: frameSchema.optional(),
    energyCost: finiteNumber.min(0).optional(),
    hits: z.array(frameHitDefinitionSchema).optional(),
    buffs: z.array(frameBuffDefinitionSchema).optional(),
    debuffs: z.array(frameDebuffDefinitionSchema).optional(),
    energyGains: z.array(frameEnergyEventSchema).optional(),
    particles: z.array(frameParticleDefinitionSchema).optional(),
    timelineState: abilityTimelineStateSchema.optional()
  })
  .strict()
  .superRefine((ability, context) => {
    if (ability.cancelFrame > ability.animationEndFrame) {
      context.addIssue({
        code: "custom",
        path: ["cancelFrame"],
        message: "must not exceed animationEndFrame"
      });
    }
    for (const [followup, cancelFrame] of Object.entries(
      ability.cancelFrames ?? {}
    )) {
      if (
        cancelFrame !== undefined &&
        cancelFrame > ability.animationEndFrame
      ) {
        context.addIssue({
          code: "custom",
          path: ["cancelFrames", followup],
          message: "must not exceed animationEndFrame"
        });
      }
    }
    if (
      (ability.maxCharges ?? 1) > 1 &&
      (ability.chargeRecoveryFrames ?? ability.cooldownFrames) <= 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["chargeRecoveryFrames"],
        message: "multi-charge abilities require a positive recovery"
      });
    }
    const abilityHitIds = new Set(
      (ability.hits ?? []).flatMap((hit) =>
        hit.id === undefined ? [] : [hit.id]
      )
    );
    for (const [particleIndex, particle] of (
      ability.particles ?? []
    ).entries()) {
      for (const [hitIndex, hitId] of (
        particle.trigger?.hitIds ?? []
      ).entries()) {
        if (!abilityHitIds.has(hitId)) {
          context.addIssue({
            code: "custom",
            path: [
              "particles",
              particleIndex,
              "trigger",
              "hitIds",
              hitIndex
            ],
            message: `unknown ability hit id "${hitId}"`
          });
        }
      }
    }
  });

export const legalTimelineCommandSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("wait"),
      frames: z.number().int().min(1)
    })
    .strict(),
  z
    .object({
      type: z.literal("swap"),
      characterId: idSchema,
      atFrame: frameSchema.optional()
    })
    .strict(),
  z
    .object({
      type: z.literal("pickUpCrystallize"),
      element: z.enum(["pyro", "hydro", "cryo", "electro", "any"]),
      atFrame: frameSchema.optional()
    })
    .strict(),
  ...(["dash", "jump"] as const).map((type) =>
    z
      .object({
        type: z.literal(type),
        actorId: idSchema,
        frames: z.number().int().positive(),
        atFrame: frameSchema.optional()
      })
      .strict()
  ),
  ...(["skill", "burst", "normal", "charge"] as const).map((type) =>
    z
      .object({
        type: z.literal(type),
        actorId: idSchema,
        abilityId: idSchema,
        atFrame: frameSchema.optional()
      })
      .strict()
  )
]);

export const legalTimelineConfigSchema = z
  .object({
    mode: z.literal("legal-frame-v1"),
    fps: z.literal(60),
    legalityMode: z.enum(["strict", "wait"]),
    initialActiveCharacterId: idSchema,
    swapFrames: z.number().int().min(1),
    abilities: z.array(abilityDefinitionSchema),
    commands: z.array(legalTimelineCommandSchema)
  })
  .strict();

export const simConfigSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    engineVersion: z.literal(CURRENT_ENGINE_VERSION),
    dataVersion: idSchema,
    randomSeed: idSchema,
    meta: z
      .object({
        name: idSchema,
        version: idSchema,
        note: z.string().optional(),
        verificationStatus: z.enum(["verified", "provisional", "user-supplied"])
      })
      .strict(),
    duration: finiteNumber.min(1).max(600),
    cycleLength: finiteNumber.min(0.1).max(120),
    enemy: enemyProfileSchema,
    characters: z
      .array(characterProfileSchema)
      .min(1)
      .max(4, "Genshin parties support at most four characters"),
    actorPoses: z.array(actorPoseDefinitionSchema).max(4).optional(),
    rotation: z.array(actionDefinitionSchema),
    timeline: legalTimelineConfigSchema.optional(),
    reactionEngine: auraReactionEngineConfigSchema.optional(),
    playerDamageModel: playerDamageModelSchema
  })
  .strict()
  .superRefine((config, context) => {
    if (config.playerDamageModel.mode === "reaction-self-v1") {
      if (
        config.enemy.targets === undefined ||
        config.enemy.targets.length === 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["enemy", "targets"],
          message:
            "player reaction self-damage requires explicit positioned enemy targets"
        });
      } else {
        config.enemy.targets.forEach((target, targetIndex) => {
          if (target.position === undefined) {
            context.addIssue({
              code: "custom",
              path: [
                "enemy",
                "targets",
                targetIndex,
                "position"
              ],
              message:
                "player reaction self-damage requires a target position for spatial self-hit resolution"
            });
          }
        });
      }
      const characterIds = new Set(
        config.characters.map((character) => character.id)
      );
      const stateByActorId = new Map<string, number>();
      config.playerDamageModel.characters.forEach(
        (state, stateIndex) => {
          if (!characterIds.has(state.actorId)) {
            context.addIssue({
              code: "custom",
              path: [
                "playerDamageModel",
                "characters",
                stateIndex,
                "actorId"
              ],
              message: `unknown character id "${state.actorId}"`
            });
          }
          const previousIndex = stateByActorId.get(state.actorId);
          if (previousIndex !== undefined) {
            context.addIssue({
              code: "custom",
              path: [
                "playerDamageModel",
                "characters",
                stateIndex,
                "actorId"
              ],
              message: `duplicate player damage state for character "${state.actorId}" (first declared at index ${previousIndex})`
            });
          } else {
            stateByActorId.set(state.actorId, stateIndex);
          }
        }
      );
      config.characters.forEach((character, characterIndex) => {
        if (!stateByActorId.has(character.id)) {
          context.addIssue({
            code: "custom",
            path: ["playerDamageModel", "characters"],
            message: `missing player damage state for character "${character.id}"`
          });
        }
        const maxHp =
          character.stats.baseHp *
            (1 + character.stats.hpPct) +
          character.stats.flatHp;
        if (character.stats.baseHp <= 0) {
          context.addIssue({
            code: "custom",
            path: [
              "characters",
              characterIndex,
              "stats",
              "baseHp"
            ],
            message:
              "player reaction self-damage requires baseHp > 0"
          });
        }
        if (!Number.isFinite(maxHp) || maxHp <= 0) {
          context.addIssue({
            code: "custom",
            path: [
              "characters",
              characterIndex,
              "stats",
              "baseHp"
            ],
            message:
              "player reaction self-damage requires baseHp * (1 + hpPct) + flatHp > 0"
          });
        }
      });
    }
    const enemyTargetIds = new Set(
      (config.enemy.targets ?? [{ id: "enemy-0" }]).map(
        (target) => target.id
      )
    );
    const validateEnemyTarget = (
      targetId: string | undefined,
      path: Array<string | number>
    ): void => {
      if (targetId !== undefined && !enemyTargetIds.has(targetId)) {
        context.addIssue({
          code: "custom",
          path,
          message: `unknown enemy target id "${targetId}"`
        });
      }
    };
    const actorPoseIds = new Set(
      (config.actorPoses ?? []).map((pose) => pose.actorId)
    );
    const validateHitGeometry = (
      hit: {
        targeting?: unknown;
        geometry?:
          | {
              coordinateSpace?:
                | "world"
                | "actor-local"
                | undefined;
            }
          | undefined;
      },
      actorId: string,
      path: Array<string | number>
    ): void => {
      if (hit.targeting !== undefined && hit.geometry !== undefined) {
        context.addIssue({
          code: "custom",
          path: [...path, "geometry"],
          message:
            "cannot be combined with scripted targeting; choose one hit-resolution source"
        });
      }
      if (
        hit.geometry !== undefined &&
        (config.enemy.targets === undefined ||
          config.enemy.targets.some((target) => target.position === undefined))
      ) {
        context.addIssue({
          code: "custom",
          path: [...path, "geometry"],
          message:
            "requires enemy.targets and a position for every registered target"
        });
      }
      if (
        hit.geometry?.coordinateSpace === "actor-local" &&
        !actorPoseIds.has(actorId)
      ) {
        context.addIssue({
          code: "custom",
          path: [...path, "geometry", "coordinateSpace"],
          message: `actor-local geometry requires an actorPoses entry for "${actorId}"`
        });
      }
    };
    const durationFrames = Math.round(config.duration * 60);
    config.enemy.targets?.forEach((target, index) => {
      if (
        target.initialAura !== undefined &&
        config.reactionEngine?.mode !== "aura-v1" &&
        config.reactionEngine?.mode !== "aura-v2" &&
        config.reactionEngine?.mode !== "aura-v3" &&
        config.reactionEngine?.mode !== "aura-v4" &&
        config.reactionEngine?.mode !== "aura-v5"
      ) {
        context.addIssue({
          code: "custom",
          path: ["enemy", "targets", index, "initialAura"],
          message:
            "requires reactionEngine.mode to be aura-v1, aura-v2, aura-v3, aura-v4, or aura-v5"
        });
      }
      target.initialAura?.forEach((aura, auraIndex) => {
        if (
          aura.element === "electro" &&
          config.reactionEngine?.mode !== "aura-v2" &&
          config.reactionEngine?.mode !== "aura-v3" &&
          config.reactionEngine?.mode !== "aura-v4" &&
          config.reactionEngine?.mode !== "aura-v5"
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "enemy",
              "targets",
              index,
              "initialAura",
              auraIndex,
              "element"
            ],
            message:
              "electro aura requires reactionEngine.mode to be aura-v2, aura-v3, aura-v4, or aura-v5"
          });
        }
        if (
          aura.element === "dendro" &&
          config.reactionEngine?.mode !== "aura-v3" &&
          config.reactionEngine?.mode !== "aura-v4" &&
          config.reactionEngine?.mode !== "aura-v5"
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "enemy",
              "targets",
              index,
              "initialAura",
              auraIndex,
              "element"
            ],
            message:
              "dendro aura requires reactionEngine.mode to be aura-v3, aura-v4, or aura-v5"
          });
        }
      });
    });
    config.enemy.targetPhases?.forEach((phase, index) => {
      validateEnemyTarget(phase.targetId, [
        "enemy",
        "targetPhases",
        index,
        "targetId"
      ]);
      if (phase.endFrame > durationFrames) {
        context.addIssue({
          code: "custom",
          path: ["enemy", "targetPhases", index, "endFrame"],
          message: `must not exceed simulation duration (${durationFrames} frames)`
        });
      }
    });
    config.enemy.targetMotions?.forEach((motion, index) => {
      if (motion.endFrame > durationFrames) {
        context.addIssue({
          code: "custom",
          path: ["enemy", "targetMotions", index, "endFrame"],
          message: `must not exceed simulation duration (${durationFrames} frames)`
        });
      }
    });

    const characterIds = new Set<string>();
    config.characters.forEach((character, index) => {
      if (characterIds.has(character.id)) {
        context.addIssue({
          code: "custom",
          path: ["characters", index, "id"],
          message: `duplicate character id "${character.id}"`
        });
      }
      characterIds.add(character.id);
    });
    const seenActorPoseIds = new Set<string>();
    config.actorPoses?.forEach((pose, index) => {
      if (seenActorPoseIds.has(pose.actorId)) {
        context.addIssue({
          code: "custom",
          path: ["actorPoses", index, "actorId"],
          message: `duplicate actor pose for "${pose.actorId}"`
        });
      }
      seenActorPoseIds.add(pose.actorId);
      if (!characterIds.has(pose.actorId)) {
        context.addIssue({
          code: "custom",
          path: ["actorPoses", index, "actorId"],
          message: `unknown character id "${pose.actorId}"`
        });
      }
    });

    const actionIds = new Set<string>();
    config.rotation.forEach((action, actionIndex) => {
      const validateTarget = (
        target: string | string[] | undefined,
        path: Array<string | number>,
        allowSelf: boolean
      ): void => {
        const targets = Array.isArray(target) ? target : [target];
        targets.forEach((candidate, targetIndex) => {
          if (
            candidate === undefined ||
            candidate === "team" ||
            (allowSelf && candidate === "self")
          ) {
            return;
          }
          if (!characterIds.has(candidate)) {
            context.addIssue({
              code: "custom",
              path: [
                ...path,
                ...(Array.isArray(target) ? [targetIndex] : [])
              ],
              message: `unknown character id "${candidate}"`
            });
          }
        });
      };

      if (actionIds.has(action.id)) {
        context.addIssue({
          code: "custom",
          path: ["rotation", actionIndex, "id"],
          message: `duplicate action id "${action.id}"`
        });
      }
      actionIds.add(action.id);

      if (!characterIds.has(action.actorId)) {
        context.addIssue({
          code: "custom",
          path: ["rotation", actionIndex, "actorId"],
          message: `unknown character id "${action.actorId}"`
        });
      }

      if (
        action.everyNCycles !== undefined &&
        action.cycleRemainder !== undefined &&
        action.cycleRemainder >= action.everyNCycles
      ) {
        context.addIssue({
          code: "custom",
          path: ["rotation", actionIndex, "cycleRemainder"],
          message: "must be less than everyNCycles"
        });
      }

      action.hits?.forEach((hit, hitIndex) => {
        validateHitGeometry(hit, action.actorId, [
          "rotation",
          actionIndex,
          "hits",
          hitIndex
        ]);
        const targetings =
          hit.targeting === undefined
            ? []
            : "mode" in hit.targeting
              ? hit.targeting.targets
              : [hit.targeting];
        targetings.forEach((targeting, targetingIndex) => {
          validateEnemyTarget(targeting.targetId, [
            "rotation",
            actionIndex,
            "hits",
            hitIndex,
            "targeting",
            ...("mode" in (hit.targeting ?? {})
              ? ["targets", targetingIndex]
              : []),
            "targetId"
          ]);
        });
        for (const [field, id] of [
          ["scalingOwnerId", hit.scalingOwnerId],
          ["creditId", hit.creditId]
        ] as const) {
          if (id !== undefined && !characterIds.has(id)) {
            context.addIssue({
              code: "custom",
              path: ["rotation", actionIndex, "hits", hitIndex, field],
              message: `unknown character id "${id}"`
            });
          }
        }
        hit.flatSources?.forEach((source, sourceIndex) => {
          if (source.ownerId !== undefined && !characterIds.has(source.ownerId)) {
            context.addIssue({
              code: "custom",
              path: ["rotation", actionIndex, "hits", hitIndex, "flatSources", sourceIndex, "ownerId"],
              message: `unknown character id "${source.ownerId}"`
            });
          }
        });
      });

      action.buffs?.forEach((buff, buffIndex) => {
        validateTarget(
          buff.target,
          ["rotation", actionIndex, "buffs", buffIndex, "target"],
          true
        );
      });
      action.energyGains?.forEach((gain, gainIndex) => {
        validateTarget(
          gain.target,
          ["rotation", actionIndex, "energyGains", gainIndex, "target"],
          false
        );
      });
    });

    if (config.timeline) {
      if (config.rotation.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["rotation"],
          message: "must be empty when timeline.mode is legal-frame-v1"
        });
      }
      const durationFrames = config.duration * config.timeline.fps;
      if (
        Math.abs(durationFrames - Math.round(durationFrames)) >
        1e-9
      ) {
        context.addIssue({
          code: "custom",
          path: ["duration"],
          message: "must resolve to an integer frame for legal-frame-v1"
        });
      }
      if (!characterIds.has(config.timeline.initialActiveCharacterId)) {
        context.addIssue({
          code: "custom",
          path: ["timeline", "initialActiveCharacterId"],
          message: `unknown character id "${config.timeline.initialActiveCharacterId}"`
        });
      }

      const abilityIds = new Set<string>();
      const abilityById = new Map<
        string,
        (typeof config.timeline.abilities)[number]
      >();
      config.timeline.abilities.forEach((ability, abilityIndex) => {
        if (abilityIds.has(ability.id)) {
          context.addIssue({
            code: "custom",
            path: ["timeline", "abilities", abilityIndex, "id"],
            message: `duplicate ability id "${ability.id}"`
          });
        }
        abilityIds.add(ability.id);
        abilityById.set(ability.id, ability);
        if (!characterIds.has(ability.actorId)) {
          context.addIssue({
            code: "custom",
            path: ["timeline", "abilities", abilityIndex, "actorId"],
            message: `unknown character id "${ability.actorId}"`
          });
        }
        ability.hits?.forEach((hit, hitIndex) => {
          validateHitGeometry(hit, ability.actorId, [
            "timeline",
            "abilities",
            abilityIndex,
            "hits",
            hitIndex
          ]);
          const targetings =
            hit.targeting === undefined
              ? []
              : "mode" in hit.targeting
                ? hit.targeting.targets
                : [hit.targeting];
          targetings.forEach((targeting, targetingIndex) => {
            validateEnemyTarget(targeting.targetId, [
              "timeline",
              "abilities",
              abilityIndex,
              "hits",
              hitIndex,
              "targeting",
              ...("mode" in (hit.targeting ?? {})
                ? ["targets", targetingIndex]
                : []),
              "targetId"
            ]);
          });
          for (const [field, id] of [
            ["scalingOwnerId", hit.scalingOwnerId],
            ["creditId", hit.creditId]
          ] as const) {
            if (id !== undefined && !characterIds.has(id)) {
              context.addIssue({
                code: "custom",
                path: [
                  "timeline",
                  "abilities",
                  abilityIndex,
                  "hits",
                  hitIndex,
                  field
                ],
                message: `unknown character id "${id}"`
              });
            }
          }
          hit.flatSources?.forEach((source, sourceIndex) => {
            if (
              source.ownerId !== undefined &&
              !characterIds.has(source.ownerId)
            ) {
              context.addIssue({
                code: "custom",
                path: [
                  "timeline",
                  "abilities",
                  abilityIndex,
                  "hits",
                  hitIndex,
                  "flatSources",
                  sourceIndex,
                  "ownerId"
                ],
                message: `unknown character id "${source.ownerId}"`
              });
            }
          });
        });
        const validateTimelineTarget = (
          target: string | string[] | undefined,
          path: Array<string | number>,
          allowSelf: boolean
        ): void => {
          const targets = Array.isArray(target) ? target : [target];
          targets.forEach((candidate, targetIndex) => {
            if (
              candidate === undefined ||
              candidate === "team" ||
              (allowSelf && candidate === "self")
            ) {
              return;
            }
            if (!characterIds.has(candidate)) {
              context.addIssue({
                code: "custom",
                path: [
                  ...path,
                  ...(Array.isArray(target) ? [targetIndex] : [])
                ],
                message: `unknown character id "${candidate}"`
              });
            }
          });
        };
        ability.buffs?.forEach((buff, buffIndex) => {
          validateTimelineTarget(
            buff.target,
            [
              "timeline",
              "abilities",
              abilityIndex,
              "buffs",
              buffIndex,
              "target"
            ],
            true
          );
        });
        ability.energyGains?.forEach((gain, gainIndex) => {
          validateTimelineTarget(
            gain.target,
            [
              "timeline",
              "abilities",
              abilityIndex,
              "energyGains",
              gainIndex,
              "target"
            ],
            false
          );
        });
      });

      config.timeline.commands.forEach((command, commandIndex) => {
        if (
          command.type === "wait" ||
          command.type === "pickUpCrystallize"
        ) {
          return;
        }
        if (command.type === "swap") {
          if (!characterIds.has(command.characterId)) {
            context.addIssue({
              code: "custom",
              path: ["timeline", "commands", commandIndex, "characterId"],
              message: `unknown character id "${command.characterId}"`
            });
          }
          return;
        }
        if (!characterIds.has(command.actorId)) {
          context.addIssue({
            code: "custom",
            path: ["timeline", "commands", commandIndex, "actorId"],
            message: `unknown character id "${command.actorId}"`
          });
        }
        if (!("abilityId" in command)) {
          return;
        }
        const ability = abilityById.get(command.abilityId);
        if (!ability) {
          context.addIssue({
            code: "custom",
            path: ["timeline", "commands", commandIndex, "abilityId"],
            message: `unknown ability id "${command.abilityId}"`
          });
          return;
        }
        if (ability.actorId !== command.actorId) {
          context.addIssue({
            code: "custom",
            path: ["timeline", "commands", commandIndex, "actorId"],
            message: `ability "${command.abilityId}" belongs to "${ability.actorId}"`
          });
        }
        if (ability.kind !== command.type) {
          context.addIssue({
            code: "custom",
            path: ["timeline", "commands", commandIndex, "type"],
            message: `ability "${command.abilityId}" is kind "${ability.kind}"`
          });
        }
      });
    }

    if (
      config.reactionEngine?.mode === "aura-v1" ||
      config.reactionEngine?.mode === "aura-v2" ||
      config.reactionEngine?.mode === "aura-v3" ||
      config.reactionEngine?.mode === "aura-v4" ||
      config.reactionEngine?.mode === "aura-v5"
    ) {
      if (!config.timeline) {
        context.addIssue({
          code: "custom",
          path: ["reactionEngine"],
          message:
            "aura-v1, aura-v2, aura-v3, aura-v4, and aura-v5 currently require timeline.mode legal-frame-v1"
        });
      }
      if (config.reactionEngine.mode === "aura-v5") {
        if (config.enemy.targets === undefined) {
          context.addIssue({
            code: "custom",
            path: ["enemy", "targets"],
            message:
              "aura-v5 requires enemy.targets and a position for every registered target"
          });
        } else {
          config.enemy.targets.forEach((target, targetIndex) => {
            if (target.position === undefined) {
              context.addIssue({
                code: "custom",
                path: [
                  "enemy",
                  "targets",
                  targetIndex,
                  "position"
                ],
                message:
                  "aura-v5 requires a position for every registered target"
              });
            }
          });
        }
      }
      const validateAuraHit = (
        hit: {
          reaction?: string | undefined;
          reactionOverride?: string | undefined;
          ampBase?: number | undefined;
          application?:
            | { gaugeUnits: number; icdGroup: string }
            | undefined;
          element?: string | undefined;
          scalingOwnerId?: string | undefined;
          geometry?: unknown;
        },
        path: Array<string | number>,
        actorId: string
      ): void => {
        const scalingOwnerId = hit.scalingOwnerId ?? actorId;
        const resolvedElement =
          hit.element ??
          config.characters.find(
            (character) => character.id === scalingOwnerId
          )?.element;
        if (hit.reaction !== undefined && hit.reaction !== "none") {
          context.addIssue({
            code: "custom",
            path: [...path, "reaction"],
            message:
              "manual reaction labels are forbidden in aura-v1, aura-v2, aura-v3, aura-v4, and aura-v5; use reactionOverride only for explicit debug runs"
          });
        }
        if (
          hit.reactionOverride !== undefined &&
          hit.reactionOverride !== "none" &&
          config.reactionEngine?.debugAllowReactionOverride !== true
        ) {
          context.addIssue({
            code: "custom",
            path: [...path, "reactionOverride"],
            message:
              "requires reactionEngine.debugAllowReactionOverride=true"
          });
        }
        if (
          hit.ampBase !== undefined &&
          !(
            config.reactionEngine?.debugAllowReactionOverride === true &&
            hit.reactionOverride !== undefined &&
            hit.reactionOverride !== "none"
          )
        ) {
          context.addIssue({
            code: "custom",
            path: [...path, "ampBase"],
            message:
              "ampBase is a legacy/debug-only override in Aura modes and requires a non-none reactionOverride with reactionEngine.debugAllowReactionOverride=true"
          });
        }
        if (
          hit.application !== undefined &&
          !(
            config.reactionEngine?.mode === "aura-v2"
              ? [
                  "pyro",
                  "cryo",
                  "hydro",
                  "electro",
                  "anemo",
                  "geo"
                ]
              : config.reactionEngine?.mode === "aura-v3" ||
                  config.reactionEngine?.mode === "aura-v4" ||
                  config.reactionEngine?.mode === "aura-v5"
                ? [
                    "pyro",
                    "cryo",
                    "hydro",
                    "electro",
                    "anemo",
                    "geo",
                    "dendro"
                  ]
              : ["pyro", "cryo", "hydro"]
          ).includes(resolvedElement ?? "")
        ) {
          context.addIssue({
            code: "custom",
            path: [...path, "application"],
            message:
              config.reactionEngine?.mode === "aura-v3" ||
              config.reactionEngine?.mode === "aura-v4" ||
              config.reactionEngine?.mode === "aura-v5"
                ? `${config.reactionEngine.mode} elemental applications currently support pyro, cryo, hydro, electro, anemo, geo, and dendro hits`
                : config.reactionEngine?.mode === "aura-v2"
                  ? "aura-v2 elemental applications currently support only pyro, cryo, hydro, electro, anemo, and geo hits"
                : "aura-v1 elemental applications currently support only pyro, cryo, and hydro hits"
          });
        }
        if (
          config.reactionEngine?.mode === "aura-v5" &&
          hit.application !== undefined &&
          (resolvedElement === "pyro" ||
            resolvedElement === "electro") &&
          hit.geometry === undefined
        ) {
          context.addIssue({
            code: "custom",
            path: [...path, "geometry"],
            message:
              "aura-v5 Pyro/Electro elemental applications require explicit geometry for Dendro-core contact checks"
          });
        }
        if (
          hit.application !== undefined &&
          !["default", "no-icd", "burning"].includes(
            hit.application.icdGroup
          ) &&
          config.reactionEngine?.icdProfiles?.[
            hit.application.icdGroup
          ] === undefined
        ) {
          context.addIssue({
            code: "custom",
            path: [...path, "application", "icdGroup"],
            message: `unknown ICD profile "${hit.application.icdGroup}"`
          });
        }
      };
      config.rotation.forEach((action, actionIndex) => {
        action.hits?.forEach((hit, hitIndex) => {
          validateAuraHit(
            hit,
            ["rotation", actionIndex, "hits", hitIndex],
            action.actorId
          );
        });
      });
      config.timeline?.abilities.forEach((ability, abilityIndex) => {
        ability.hits?.forEach((hit, hitIndex) => {
          validateAuraHit(
            hit,
            [
              "timeline",
              "abilities",
              abilityIndex,
              "hits",
              hitIndex
            ],
            ability.actorId
          );
        });
      });
    }
  });

/**
 * Strict player-reaction-damage output boundary plus cross-log integrity.
 *
 * Like the Dendro-core projection, this intentionally accepts unrelated
 * SimulationResult fields while parsing every player-owned structure strictly.
 */
export const playerDamageResultReferencesSchema = z
  .object({
    config: simConfigSchema,
    damageEvents: z.array(
      playerSelfDamageDamageEventReferenceSchema
    ),
    reactionDamageLog: z.array(
      dendroCoreReactionDamageReferenceSchema
    ),
    burningStateLog: z.array(burningStateLogEntrySchema),
    dendroCoreLog: dendroCoreLogSchema,
    playerHitResolutionLog: z.array(
      playerHitResolutionLogEntrySchema
    ),
    playerDamageEvents: z.array(playerDamageEventSchema),
    playerHpTimeline: playerHpTimelineSchema,
    playerHpSummaries: z.array(playerHpSummarySchema),
    crystallizeShieldLog: z.array(
      crystallizeShieldLogEntrySchema
    ),
    crystallizeShieldTimeline: z.array(
      crystallizeShieldTimelinePointSchema
    ),
    playerSelfDamageStatus: playerSelfDamageStatusSchema,
    totalPlayerDamageTaken: finiteNumber.nonnegative(),
    totalReactionSelfDamageTaken: finiteNumber.nonnegative()
  })
  .passthrough()
  .superRefine((result, context) => {
    const reactionDamageById = new Map(
      result.reactionDamageLog.map((entry) => [entry.id, entry])
    );
    const burningById = new Map(
      result.burningStateLog.map((entry) => [entry.id, entry])
    );
    const coreById = new Map(
      result.dendroCoreLog.map((entry) => [entry.id, entry])
    );
    const hitById = new Map(
      result.playerHitResolutionLog.map((entry) => [
        entry.id,
        entry
      ])
    );
    const damageById = new Map(
      result.playerDamageEvents.map((entry) => [
        entry.id,
        entry
      ])
    );
    const issue = (
      path: Array<string | number>,
      message: string
    ): void => addMissingReferenceIssue(context, path, message);
    (
      [
        ["reactionDamageLog", result.reactionDamageLog],
        ["burningStateLog", result.burningStateLog],
        ["playerHitResolutionLog", result.playerHitResolutionLog],
        ["playerDamageEvents", result.playerDamageEvents]
      ] as const
    ).forEach(([name, entries]) => {
      addDuplicateIdIssues(
        entries.map((entry) => entry.id),
        name,
        context
      );
      entries.forEach((entry, index) => {
        if (entry.id !== index) {
          issue(
            [name, index, "id"],
            `${name} requires contiguous id ${index}`
          );
        }
      });
    });

    const disabled =
      result.config.playerDamageModel.mode === "disabled";
    if (disabled) {
      if (
        result.playerHitResolutionLog.length !== 0 ||
        result.playerDamageEvents.length !== 0 ||
        result.playerHpTimeline.points.length !== 0 ||
        result.playerHpSummaries.length !== 0 ||
        result.playerSelfDamageStatus !==
          "unsupported-player-damage-model" ||
        result.totalPlayerDamageTaken !== 0 ||
        result.totalReactionSelfDamageTaken !== 0
      ) {
        issue(
          ["config", "playerDamageModel", "mode"],
          "disabled player damage requires empty player logs, HP timeline, and summaries"
        );
      }
    } else if (
      result.playerSelfDamageStatus !==
      "modeled-player-reaction-damage"
    ) {
      issue(
        ["playerSelfDamageStatus"],
        "reaction-self-v1 requires modeled-player-reaction-damage status"
      );
    }
    result.damageEvents.forEach((event, eventIndex) => {
      const burningStatus =
        event.reactionAudit.burningReaction
          ?.selfDamageStatus;
      if (
        burningStatus !== undefined &&
        burningStatus !== result.playerSelfDamageStatus
      ) {
        issue(
          [
            "damageEvents",
            eventIndex,
            "reactionAudit",
            "burningReaction",
            "selfDamageStatus"
          ],
          "Burning reaction-audit selfDamageStatus must match the top-level playerSelfDamageStatus"
        );
      }
      event.reactionAudit.bloomReactions.forEach(
        (bloomAudit, bloomIndex) => {
          if (
            bloomAudit.selfDamageStatus !==
            result.playerSelfDamageStatus
          ) {
            issue(
              [
                "damageEvents",
                eventIndex,
                "reactionAudit",
                "bloomReactions",
                bloomIndex,
                "selfDamageStatus"
              ],
              "Bloom reaction-audit selfDamageStatus must match the top-level playerSelfDamageStatus"
            );
          }
        }
      );
    });

    result.reactionDamageLog.forEach((entry, index) => {
      addDuplicateIdIssues(
        entry.playerHitResolutionLogIds,
        "playerHitResolutionLogIds",
        context
      );
      addDuplicateIdIssues(
        entry.playerDamageEventIds,
        "playerDamageEventIds",
        context
      );
      if (
        disabled &&
        (entry.playerHitResolutionLogIds.length !== 0 ||
          entry.playerDamageEventIds.length !== 0)
      ) {
        issue(
          [
            "reactionDamageLog",
            index,
            "playerHitResolutionLogIds"
          ],
          "disabled player damage requires empty reaction-damage back-references"
        );
      }
      const isPlayerSelfDamageReaction = [
        "burning",
        "bloom",
        "burgeon",
        "hyperbloom"
      ].includes(entry.reaction);
      const shouldResolvePlayerHit =
        !disabled &&
        isPlayerSelfDamageReaction &&
        entry.scheduled &&
        entry.withinSimulation &&
        entry.blockedReason === null &&
        entry.resolutionReason === null;
      if (
        entry.playerHitResolutionLogIds.length !==
          (shouldResolvePlayerHit ? 1 : 0) ||
        (!shouldResolvePlayerHit &&
          entry.playerDamageEventIds.length !== 0)
      ) {
        issue(
          [
            "reactionDamageLog",
            index,
            "playerHitResolutionLogIds"
          ],
          "reaction-damage player references must contain exactly one spatial check for each in-duration Burning/Bloom-family explosion"
        );
      }
      entry.playerHitResolutionLogIds.forEach(
        (hitId, referenceIndex) => {
          const hit = hitById.get(hitId);
          if (
            hit === undefined ||
            hit.reactionDamageLogId !== entry.id
          ) {
            issue(
              [
                "reactionDamageLog",
                index,
                "playerHitResolutionLogIds",
                referenceIndex
              ],
              `missing reciprocal player hit-resolution ${hitId}`
            );
          }
        }
      );
      entry.playerDamageEventIds.forEach(
        (damageId, referenceIndex) => {
          const damage = damageById.get(damageId);
          if (
            damage === undefined ||
            damage.reactionDamageLogId !== entry.id
          ) {
            issue(
              [
                "reactionDamageLog",
                index,
                "playerDamageEventIds",
                referenceIndex
              ],
              `missing reciprocal player damage event ${damageId}`
            );
          }
        }
      );
      if (shouldResolvePlayerHit) {
        const hit = hitById.get(
          entry.playerHitResolutionLogIds[0]!
        );
        const expectedDamageIds =
          hit?.playerDamageEventId === null ||
          hit?.playerDamageEventId === undefined
            ? []
            : [hit.playerDamageEventId];
        if (
          entry.playerDamageEventIds.length !==
            expectedDamageIds.length ||
          entry.playerDamageEventIds.some(
            (id, damageIndex) =>
              id !== expectedDamageIds[damageIndex]
          )
        ) {
          issue(
            [
              "reactionDamageLog",
              index,
              "playerDamageEventIds"
            ],
            "reaction-damage player damage IDs must exactly project its landed player hit"
          );
        }
      }
    });

    result.playerHitResolutionLog.forEach((hit, index) => {
      const reactionDamage = reactionDamageById.get(
        hit.reactionDamageLogId
      );
      if (
        reactionDamage === undefined ||
        reactionDamage.reaction !== hit.reaction ||
        reactionDamage.damageFrame !== hit.frame ||
        reactionDamage.sourceActorId !== hit.sourceActorId ||
        reactionDamage.sourceTargetId !== hit.sourceTargetId ||
        !reactionDamage.playerHitResolutionLogIds.includes(hit.id)
      ) {
        issue(
          [
            "playerHitResolutionLog",
            index,
            "reactionDamageLogId"
          ],
          "player hit resolution does not match its reciprocal reaction-damage provenance"
        );
      }
      if (
        reactionDamage === undefined ||
        reactionDamage.centerPosition === null ||
        !approximatelyEqual(
          hit.damageCenter.x,
          reactionDamage.centerPosition.x
        ) ||
        !approximatelyEqual(
          hit.damageCenter.y,
          reactionDamage.centerPosition.y
        )
      ) {
        issue(
          [
            "playerHitResolutionLog",
            index,
            "damageCenter"
          ],
          "player hit damageCenter must match its reaction-damage centerPosition"
        );
      }
      const playerDamageModel =
        result.config.playerDamageModel;
      if (
        playerDamageModel.mode === "reaction-self-v1" &&
        (!approximatelyEqual(
          hit.playerCenter.x,
          playerDamageModel.position.x
        ) ||
          !approximatelyEqual(
            hit.playerCenter.y,
            playerDamageModel.position.y
          ) ||
          !approximatelyEqual(
            hit.playerRadius,
            playerDamageModel.hitboxRadius
          ))
      ) {
        issue(
          [
            "playerHitResolutionLog",
            index,
            "playerCenter"
          ],
          "player hit center and radius must match the configured player damage model"
        );
      }
      const damage =
        hit.playerDamageEventId === null
          ? undefined
          : damageById.get(hit.playerDamageEventId);
      if (
        hit.playerDamageEventId !== null &&
        (damage === undefined ||
          damage.playerHitResolutionLogId !== hit.id ||
          damage.eventPriority !== hit.eventPriority ||
          damage.eventSequence !== hit.eventSequence ||
          damage.intraEventSequence <=
            hit.intraEventSequence)
      ) {
        issue(
          [
            "playerHitResolutionLog",
            index,
            "playerDamageEventId"
          ],
          "player hit resolution does not resolve to its reciprocal damage event"
        );
      }
    });

    result.playerDamageEvents.forEach((event, index) => {
      const hit = hitById.get(event.playerHitResolutionLogId);
      const reactionDamage = reactionDamageById.get(
        event.reactionDamageLogId
      );
      if (
        hit === undefined ||
        hit.playerDamageEventId !== event.id ||
        hit.reactionDamageLogId !== event.reactionDamageLogId ||
        hit.reaction !== event.reaction ||
        hit.element !== event.element ||
        hit.sourceActorId !== event.sourceActorId ||
        hit.sourceTargetId !== event.sourceTargetId ||
        hit.targetActorId !== event.targetActorId ||
        hit.frame !== event.frame
      ) {
        issue(
          [
            "playerDamageEvents",
            index,
            "playerHitResolutionLogId"
          ],
          "player damage event does not match its reciprocal landed hit"
        );
      }
      if (
        reactionDamage === undefined ||
        !reactionDamage.playerDamageEventIds.includes(event.id)
      ) {
        issue(
          [
            "playerDamageEvents",
            index,
            "reactionDamageLogId"
          ],
          "player damage event is missing from its reaction-damage back-references"
        );
      }
      const playerDamageModel =
        result.config.playerDamageModel;
      if (playerDamageModel.mode === "reaction-self-v1") {
        const configuredState =
          playerDamageModel.characters.find(
            (state) =>
              state.actorId === event.targetActorId
          );
        const configuredResistance =
          configuredState?.resistances[event.element];
        if (
          configuredResistance === undefined ||
          !approximatelyEqual(
            event.damageFactors.effectiveResistance,
            configuredResistance
          )
        ) {
          issue(
            [
              "playerDamageEvents",
              index,
              "damageFactors",
              "effectiveResistance"
            ],
            "effectiveResistance must equal the configured target actor resistance for the event element"
          );
        }
      }
      if (
        !approximatelyEqual(
          event.damageFactors.finalDamage,
          event.shieldResolution.absorbedDamage +
            event.shieldResolution.damageAfterShield
        )
      ) {
        issue(
          [
            "playerDamageEvents",
            index,
            "shieldResolution",
            "damageAfterShield"
          ],
          "shield absorption and post-shield damage must conserve incoming player damage"
        );
      }
    });

    result.crystallizeShieldLog.forEach((entry, index) => {
      if (
        entry.operation !== "absorb" &&
        entry.operation !== "break"
      ) {
        return;
      }
      const event =
        entry.playerDamageEventId === null
          ? undefined
          : damageById.get(entry.playerDamageEventId);
      if (
        event === undefined ||
        event.frame !== entry.frame ||
        event.eventPriority !== entry.eventPriority ||
        event.eventSequence !== entry.eventSequence ||
        event.shieldResolution.shieldId !== entry.shieldId ||
        event.shieldResolution.incomingElement !==
          entry.incomingElement ||
        !approximatelyEqual(
          event.shieldResolution.baseHpBefore,
          entry.baseHpBeforeAbsorption
        ) ||
        !approximatelyEqual(
          event.shieldResolution.baseHpConsumed,
          entry.baseHpConsumed
        ) ||
        !approximatelyEqual(
          event.shieldResolution.baseHpAfter,
          entry.baseHpAfterAbsorption
        ) ||
        !approximatelyEqual(
          event.shieldResolution.absorbedDamage,
          entry.absorbedDamage
        ) ||
        !approximatelyEqual(
          event.shieldResolution.damageAfterShield,
          entry.damageAfterShield
        )
      ) {
        issue(
          [
            "crystallizeShieldLog",
            index,
            "playerDamageEventId"
          ],
          "shield absorption row does not match its player damage event"
        );
      }
    });
    result.crystallizeShieldTimeline.forEach(
      (point, index) => {
        if (
          point.operation !== "absorb" &&
          point.operation !== "break"
        ) {
          return;
        }
        const log = result.crystallizeShieldLog.find(
          (entry) =>
            entry.frame === point.frame &&
            entry.operation === point.operation &&
            entry.playerDamageEventId ===
              point.playerDamageEventId
        );
        if (
          log === undefined ||
          !approximatelyEqual(
            log.baseHpBeforeAbsorption,
            point.baseHpBeforeAbsorption
          ) ||
          !approximatelyEqual(
            log.baseHpAfterAbsorption,
            point.baseHpAfterAbsorption
          ) ||
          !approximatelyEqual(
            log.absorbedDamage,
            point.absorbedDamage
          ) ||
          !approximatelyEqual(
            log.damageAfterShield,
            point.damageAfterShield
          )
        ) {
          issue(
            [
              "crystallizeShieldTimeline",
              index,
              "playerDamageEventId"
            ],
            "shield timeline absorption point does not match a shield log row"
          );
        }
      }
    );

    result.burningStateLog.forEach((entry, index) => {
      if (
        disabled &&
        (entry.playerHitResolutionLogId !== null ||
          entry.playerDamageEventId !== null ||
          entry.selfDamageStatus !==
            "unsupported-player-damage-model")
      ) {
        issue(
          [
            "burningStateLog",
            index,
            "playerHitResolutionLogId"
          ],
          "disabled player damage requires null Burning player references and unsupported status"
        );
      }
      if (entry.playerHitResolutionLogId !== null) {
        const hit = hitById.get(entry.playerHitResolutionLogId);
        if (
          hit === undefined ||
          hit.burningStateLogId !== entry.id ||
          hit.reactionDamageLogId !== entry.reactionDamageLogId
        ) {
          issue(
            [
              "burningStateLog",
              index,
              "playerHitResolutionLogId"
            ],
            "Burning player hit link is not reciprocal"
          );
        }
      }
      if (entry.playerDamageEventId !== null) {
        const damage = damageById.get(entry.playerDamageEventId);
        if (
          damage === undefined ||
          damage.burningStateLogId !== entry.id
        ) {
          issue(
            [
              "burningStateLog",
              index,
              "playerDamageEventId"
            ],
            "Burning player damage link is not reciprocal"
          );
        }
      }
    });

    result.dendroCoreLog.forEach((entry, index) => {
      if (
        entry.operation !== "expire" &&
        entry.operation !== "evict" &&
        entry.operation !== "consume"
      ) {
        return;
      }
      if (
        disabled &&
        (entry.playerHitResolutionLogId !== null ||
          entry.playerDamageEventId !== null ||
          entry.selfDamageStatus !==
            "unsupported-player-damage-model")
      ) {
        issue(
          [
            "dendroCoreLog",
            index,
            "playerHitResolutionLogId"
          ],
          "disabled player damage requires null core-removal player references and unsupported status"
        );
      }
      if (entry.playerHitResolutionLogId !== null) {
        const hit = hitById.get(entry.playerHitResolutionLogId);
        if (
          hit === undefined ||
          hit.dendroCoreRemovalLogId !== entry.id ||
          hit.reactionDamageLogId !==
            entry.reactionDamageLogId
        ) {
          issue(
            [
              "dendroCoreLog",
              index,
              "playerHitResolutionLogId"
            ],
            "core-removal player hit link is not reciprocal"
          );
        }
      }
      if (entry.playerDamageEventId !== null) {
        const damage = damageById.get(entry.playerDamageEventId);
        if (
          damage === undefined ||
          damage.dendroCoreRemovalLogId !== entry.id
        ) {
          issue(
            [
              "dendroCoreLog",
              index,
              "playerDamageEventId"
            ],
            "core-removal player damage link is not reciprocal"
          );
        }
      }
    });

    if (disabled) return;

    const enabledPlayerDamageModel =
      result.config.playerDamageModel;
    if (
      enabledPlayerDamageModel.mode !== "reaction-self-v1"
    ) {
      return;
    }
    const expectedReactionDamageTaken =
      result.playerDamageEvents.reduce(
        (sum, event) => sum + event.finalDamage,
        0
      );
    if (
      !approximatelyEqual(
        result.totalReactionSelfDamageTaken,
        expectedReactionDamageTaken
      ) ||
      !approximatelyEqual(
        result.totalPlayerDamageTaken,
        expectedReactionDamageTaken
      )
    ) {
      issue(
        ["totalPlayerDamageTaken"],
        "1.32 totals must equal the sum of player reaction self-damage HP loss"
      );
    }

    const configuredStates = new Map(
      enabledPlayerDamageModel.characters.map((state) => [
        state.actorId,
        state
      ])
    );
    const timelineByActor = new Map<
      string,
      typeof result.playerHpTimeline.points
    >();
    result.playerHpTimeline.points.forEach((point, index) => {
      const points = timelineByActor.get(point.actorId) ?? [];
      points.push(point);
      timelineByActor.set(point.actorId, points);
      if (point.operation === "damage") {
        const event =
          point.playerDamageEventId === null
            ? undefined
            : damageById.get(point.playerDamageEventId);
        if (
          event === undefined ||
          event.targetActorId !== point.actorId ||
          event.frame !== point.frame ||
          event.eventPriority !== point.eventPriority ||
          event.eventSequence !== point.eventSequence ||
          point.intraEventSequence === null ||
          point.intraEventSequence <=
            event.intraEventSequence ||
          !approximatelyEqual(
            event.hpResolution.currentHpBefore,
            point.hpBefore
          ) ||
          !approximatelyEqual(
            event.hpResolution.currentHpAfter,
            point.hpAfter
          )
        ) {
          issue(
            [
              "playerHpTimeline",
              "points",
              index,
              "playerDamageEventId"
            ],
            "HP timeline damage point does not match its player damage event"
          );
        }
      }
    });
    result.config.characters.forEach((character) => {
      const maxHp =
        character.stats.baseHp *
          (1 + character.stats.hpPct) +
        character.stats.flatHp;
      const state = configuredStates.get(character.id)!;
      const expectedInitialHp = maxHp * state.initialHpRatio;
      const points = timelineByActor.get(character.id) ?? [];
      const initial = points.filter(
        (point) => point.operation === "initial"
      );
      const end = points.filter(
        (point) => point.operation === "simulation-end"
      );
      const actorDamageEvents = result.playerDamageEvents.filter(
        (event) => event.targetActorId === character.id
      );
      const damagePoints = points.filter(
        (point) => point.operation === "damage"
      );
      if (
        initial.length !== 1 ||
        end.length !== 1 ||
        points[0]?.operation !== "initial" ||
        points.at(-1)?.operation !== "simulation-end" ||
        initial[0]!.frame !== 0 ||
        !approximatelyEqual(initial[0]!.maxHp, maxHp) ||
        !approximatelyEqual(
          initial[0]!.hpAfter,
          expectedInitialHp
        ) ||
        end[0]!.frame !==
          Math.round(result.config.duration * 60) ||
        damagePoints.length !== actorDamageEvents.length
      ) {
        issue(
          ["playerHpTimeline", "points"],
          `character "${character.id}" requires exact initial and simulation-end HP boundaries`
        );
      }
      points.forEach((point, pointIndex) => {
        if (
          pointIndex > 0 &&
          !approximatelyEqual(
            point.hpBefore,
            points[pointIndex - 1]!.hpAfter
          )
        ) {
          issue(
            ["playerHpTimeline", "points"],
            `character "${character.id}" HP timeline must form a continuous state chain`
          );
        }
      });
      const eventIds = damagePoints.map(
        (point) => point.playerDamageEventId
      );
      if (
        new Set(eventIds).size !== eventIds.length ||
        actorDamageEvents.some(
          (event) => !eventIds.includes(event.id)
        )
      ) {
        issue(
          ["playerHpTimeline", "points"],
          `character "${character.id}" requires exactly one HP point per player damage event`
        );
      }
    });

    const summariesByActor = new Map(
      result.playerHpSummaries.map((summary) => [
        summary.actorId,
        summary
      ])
    );
    if (
      summariesByActor.size !== result.playerHpSummaries.length ||
      result.playerHpSummaries.length !==
        result.config.characters.length
    ) {
      issue(
        ["playerHpSummaries"],
        "enabled player damage requires exactly one summary per character"
      );
    }
    result.config.characters.forEach((character) => {
      const summary = summariesByActor.get(character.id);
      const actorEvents = result.playerDamageEvents.filter(
        (event) => event.targetActorId === character.id
      );
      const points = timelineByActor.get(character.id) ?? [];
      const initial = points.find(
        (point) => point.operation === "initial"
      );
      const end = points.find(
        (point) => point.operation === "simulation-end"
      );
      const totalIncoming = actorEvents.reduce(
        (sum, event) =>
          sum + event.damageFactors.finalDamage,
        0
      );
      const totalAbsorbed = actorEvents.reduce(
        (sum, event) =>
          sum + event.shieldResolution.absorbedDamage,
        0
      );
      const totalHpDamage = actorEvents.reduce(
        (sum, event) => sum + event.finalDamage,
        0
      );
      if (
        summary === undefined ||
        initial === undefined ||
        end === undefined ||
        !approximatelyEqual(summary.maxHp, initial.maxHp) ||
        !approximatelyEqual(summary.initialHp, initial.hpAfter) ||
        !approximatelyEqual(summary.finalHp, end.hpAfter) ||
        !approximatelyEqual(
          summary.totalIncomingDamage,
          totalIncoming
        ) ||
        !approximatelyEqual(
          summary.totalAbsorbedDamage,
          totalAbsorbed
        ) ||
        !approximatelyEqual(
          summary.totalHpDamage,
          totalHpDamage
        ) ||
        summary.hitCount !== actorEvents.length
      ) {
        issue(
          ["playerHpSummaries"],
          `summary for character "${character.id}" does not match HP timeline and damage events`
        );
      }
    });
  });

export class ConfigMigrationError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = "ConfigMigrationError";
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeLegacyCharacter(raw: unknown, index: number): unknown {
  if (!isRecord(raw)) return raw;
  const element = typeof raw.element === "string" ? raw.element : "physical";
  return {
    ...raw,
    id: typeof raw.id === "string" && raw.id ? raw.id : `char-${index}`,
    name:
      typeof raw.name === "string" && raw.name
        ? raw.name
        : typeof raw.id === "string" && raw.id
          ? raw.id
          : `char-${index}`,
    element,
    color:
      typeof raw.color === "string" && raw.color
        ? raw.color
        : "#9aa4b2",
    level: raw.level ?? 90,
    energyMax: raw.energyMax ?? 60,
    initialEnergy: raw.initialEnergy ?? 0,
    stats: isRecord(raw.stats) ? raw.stats : {}
  };
}

function migrateLegacyConfig(input: Record<string, unknown>): Record<string, unknown> {
  const meta = isRecord(input.meta) ? input.meta : {};
  const dataVersion =
    typeof meta.version === "string" && meta.version
      ? meta.version
      : "0.1.0-demo";

  return {
    ...input,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    engineVersion: CURRENT_ENGINE_VERSION,
    dataVersion,
    randomSeed: "legacy-default",
    meta: {
      name:
        typeof meta.name === "string" && meta.name
          ? meta.name
          : "迁移的 v0.1 配置",
      version: dataVersion,
      ...(typeof meta.note === "string" ? { note: meta.note } : {}),
      verificationStatus: "provisional"
    },
    duration: input.duration ?? 120,
    cycleLength: input.cycleLength ?? 20,
    enemy: isRecord(input.enemy)
      ? {
          level: input.enemy.level ?? 110,
          resistance: input.enemy.resistance ?? 0.1,
          defReduction: input.enemy.defReduction ?? 0,
          ...(Array.isArray(input.enemy.targets)
            ? { targets: input.enemy.targets }
            : {}),
          ...(Array.isArray(input.enemy.targetPhases)
            ? { targetPhases: input.enemy.targetPhases }
            : {}),
          ...(Array.isArray(input.enemy.targetMotions)
            ? { targetMotions: input.enemy.targetMotions }
            : {})
        }
      : { level: 110, resistance: 0.1, defReduction: 0 },
    characters: Array.isArray(input.characters)
      ? input.characters.map(normalizeLegacyCharacter)
      : [],
    rotation: Array.isArray(input.rotation) ? input.rotation : [],
    playerDamageModel: { mode: "disabled" }
  };
}

export function formatZodError(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "<root>";
    return `${path}: ${issue.message}`;
  });
}

export function parseSimConfig(input: unknown): SimConfig {
  const parsed = simConfigSchema.safeParse(input);
  if (!parsed.success) {
    const issues = formatZodError(parsed.error);
    throw new ConfigMigrationError(
      `配置校验失败：\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
      issues
    );
  }
  return parsed.data as SimConfig;
}

type HistoricalAuraMode =
  | "aura-v1"
  | "aura-v2"
  | "aura-v3"
  | "aura-v4"
  | "aura-v5";

interface HistoricalSchemaContract {
  engineVersion: string;
  allowedAuraModes: readonly HistoricalAuraMode[];
}

const HISTORICAL_AURA_MODES = {
  none: [] as const,
  v1: ["aura-v1"] as const,
  v2: ["aura-v1", "aura-v2"] as const,
  v3: ["aura-v1", "aura-v2", "aura-v3"] as const,
  v4: ["aura-v1", "aura-v2", "aura-v3", "aura-v4"] as const,
  v5: [
    "aura-v1",
    "aura-v2",
    "aura-v3",
    "aura-v4",
    "aura-v5"
  ] as const
} satisfies Record<string, readonly HistoricalAuraMode[]>;

/**
 * Historical schema/engine pairs are wire-format contracts. A migration must
 * never reinterpret a forged engine version or silently opt an old config into
 * an Aura mode that did not exist in that schema release.
 */
const HISTORICAL_SCHEMA_CONTRACTS = {
  [INITIAL_TYPED_SCHEMA_VERSION]: {
    engineVersion: "1.0.0-compat",
    allowedAuraModes: HISTORICAL_AURA_MODES.none
  },
  [PREVIOUS_SCHEMA_VERSION]: {
    engineVersion: "1.1.0-aura",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [PARTICLE_SCHEMA_VERSION]: {
    engineVersion: "1.2.0-particles",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [ICD_PROFILE_SCHEMA_VERSION]: {
    engineVersion: "1.3.0-icd-profiles",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [ACTION_STATE_SCHEMA_VERSION]: {
    engineVersion: "1.4.0-action-states",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [FOLLOWUP_CANCEL_SCHEMA_VERSION]: {
    engineVersion: "1.5.0-followup-cancels",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [RUNTIME_ENERGY_SCHEMA_VERSION]: {
    engineVersion: "1.6.0-runtime-energy",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [FIXED_ENERGY_ICD_SCHEMA_VERSION]: {
    engineVersion: "1.7.0-fixed-energy-icd",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [HIT_PARTICLE_TRIGGER_SCHEMA_VERSION]: {
    engineVersion: "1.8.0-hit-particle-triggers",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [MOVEMENT_COMMAND_SCHEMA_VERSION]: {
    engineVersion: "1.9.0-movement-commands",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [TIMELINE_STATE_CLEAR_SCHEMA_VERSION]: {
    engineVersion: "1.10.0-timeline-state-clears",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [TARGET_HIT_RESOLUTION_SCHEMA_VERSION]: {
    engineVersion: "1.11.0-target-hit-resolution",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [TARGET_EFFECT_POLICY_SCHEMA_VERSION]: {
    engineVersion: "1.12.0-target-effect-policy",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [TARGET_PHASE_TIMELINE_SCHEMA_VERSION]: {
    engineVersion: "1.13.0-target-phase-timeline",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [MULTI_TARGET_REGISTRY_SCHEMA_VERSION]: {
    engineVersion: "1.14.0-multi-target-registry",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [AOE_FANOUT_SCHEMA_VERSION]: {
    engineVersion: "1.15.0-aoe-fanout",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [CIRCLE_GEOMETRY_SCHEMA_VERSION]: {
    engineVersion: "1.16.0-circle-geometry",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [TARGET_MOTION_SCHEMA_VERSION]: {
    engineVersion: "1.17.0-target-motion",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [ORIENTED_RECTANGLE_SCHEMA_VERSION]: {
    engineVersion: "1.18.0-oriented-rectangle",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [CAPSULE_GEOMETRY_SCHEMA_VERSION]: {
    engineVersion: "1.19.0-capsule-geometry",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [SECTOR_GEOMETRY_SCHEMA_VERSION]: {
    engineVersion: "1.20.0-sector-geometry",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [ACTOR_POSE_SCHEMA_VERSION]: {
    engineVersion: "1.21.0-actor-local-geometry",
    allowedAuraModes: HISTORICAL_AURA_MODES.v1
  },
  [OVERLOAD_REACTION_SCHEMA_VERSION]: {
    engineVersion: "1.22.0-overload-reaction",
    allowedAuraModes: HISTORICAL_AURA_MODES.v2
  },
  [SUPERCONDUCT_REACTION_SCHEMA_VERSION]: {
    engineVersion: "1.23.0-superconduct-reaction",
    allowedAuraModes: HISTORICAL_AURA_MODES.v2
  },
  [ELECTRO_CHARGED_REACTION_SCHEMA_VERSION]: {
    engineVersion: "1.24.0-electro-charged-reaction",
    allowedAuraModes: HISTORICAL_AURA_MODES.v2
  },
  [FREEZE_REACTION_SCHEMA_VERSION]: {
    engineVersion: "1.25.0-freeze-state",
    allowedAuraModes: HISTORICAL_AURA_MODES.v2
  },
  [SHATTER_REACTION_SCHEMA_VERSION]: {
    engineVersion: "1.26.0-shatter-reaction",
    allowedAuraModes: HISTORICAL_AURA_MODES.v2
  },
  [SWIRL_REACTION_SCHEMA_VERSION]: {
    engineVersion: "1.27.0-swirl-propagation",
    allowedAuraModes: HISTORICAL_AURA_MODES.v2
  },
  [CRYSTALLIZE_REACTION_SCHEMA_VERSION]: {
    engineVersion: "1.28.0-crystallize-shards",
    allowedAuraModes: HISTORICAL_AURA_MODES.v2
  },
  [CATALYZE_REACTION_SCHEMA_VERSION]: {
    engineVersion: CATALYZE_REACTION_ENGINE_VERSION,
    allowedAuraModes: HISTORICAL_AURA_MODES.v3
  },
  [BURNING_REACTION_SCHEMA_VERSION]: {
    engineVersion: BURNING_REACTION_ENGINE_VERSION,
    allowedAuraModes: HISTORICAL_AURA_MODES.v4
  },
  [DENDRO_CORE_SCHEMA_VERSION]: {
    engineVersion: DENDRO_CORE_ENGINE_VERSION,
    allowedAuraModes: HISTORICAL_AURA_MODES.v5
  }
} as const satisfies Record<string, HistoricalSchemaContract>;

function validateHistoricalSchemaContract(
  input: Record<string, unknown>,
  version: string
): void {
  const contract: HistoricalSchemaContract | undefined =
    HISTORICAL_SCHEMA_CONTRACTS[version as keyof typeof HISTORICAL_SCHEMA_CONTRACTS];
  if (contract === undefined) return;

  if (input.engineVersion !== contract.engineVersion) {
    const issue = `engineVersion: schemaVersion "${version}" requires "${contract.engineVersion}"`;
    throw new ConfigMigrationError(
      `配置校验失败：\n- ${issue}`,
      [issue]
    );
  }

  const reactionEngineMode = isRecord(input.reactionEngine)
    ? input.reactionEngine.mode
    : undefined;
  if (
    typeof reactionEngineMode === "string" &&
    !contract.allowedAuraModes.some(
      (allowedMode) => allowedMode === reactionEngineMode
    )
  ) {
    const issue = `reactionEngine.mode: schemaVersion "${version}" does not support "${reactionEngineMode}"`;
    throw new ConfigMigrationError(
      `配置校验失败：\n- ${issue}`,
      [issue]
    );
  }
}

export function migrateConfig(rawInput: unknown): SimConfig {
  if (!isRecord(rawInput)) {
    throw new ConfigMigrationError("配置校验失败：<root>: expected an object");
  }
  let input: Record<string, unknown> = rawInput;

  const version = input.schemaVersion;
  if (
    version !== CURRENT_SCHEMA_VERSION &&
    version !== DENDRO_CORE_SCHEMA_VERSION &&
    isRecord(input.reactionEngine) &&
    input.reactionEngine.mode === "aura-v5"
  ) {
    const historicalVersion =
      version === undefined
        ? LEGACY_SCHEMA_VERSION
        : String(version);
    const issue = `reactionEngine.mode: schemaVersion "${historicalVersion}" does not support "aura-v5"`;
    throw new ConfigMigrationError(
      `配置校验失败：\n- ${issue}`,
      [issue]
    );
  }
  if (
    version !== CURRENT_SCHEMA_VERSION &&
    input.playerDamageModel !== undefined &&
    !(
      isRecord(input.playerDamageModel) &&
      input.playerDamageModel.mode === "disabled" &&
      Object.keys(input.playerDamageModel).length === 1
    )
  ) {
    const historicalVersion =
      version === undefined
        ? LEGACY_SCHEMA_VERSION
        : String(version);
    const issue = `playerDamageModel: schemaVersion "${historicalVersion}" does not support player reaction self-damage configuration`;
    throw new ConfigMigrationError(
      `配置校验失败：\n- ${issue}`,
      [issue]
    );
  }
  if (
    version === undefined ||
    version === LEGACY_SCHEMA_VERSION ||
    version === "0.1.0-demo"
  ) {
    return parseSimConfig(migrateLegacyConfig(input));
  }
  if (version === CURRENT_SCHEMA_VERSION) {
    return parseSimConfig(input);
  }
  if (typeof version === "string") {
    validateHistoricalSchemaContract(input, version);
  }
  input = {
    ...input,
    playerDamageModel: { mode: "disabled" }
  };
  if (version === DENDRO_CORE_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION,
      playerDamageModel: { mode: "disabled" }
    });
  }
  if (version === BURNING_REACTION_SCHEMA_VERSION) {
    if (input.engineVersion !== BURNING_REACTION_ENGINE_VERSION) {
      const issue = `engineVersion: schemaVersion "${BURNING_REACTION_SCHEMA_VERSION}" requires "${BURNING_REACTION_ENGINE_VERSION}"`;
      throw new ConfigMigrationError(
        `配置校验失败：\n- ${issue}`,
        [issue]
      );
    }
    if (
      isRecord(input.reactionEngine) &&
      input.reactionEngine.mode === "aura-v5"
    ) {
      const issue =
        'reactionEngine.mode: schemaVersion "1.30.0" does not support "aura-v5"';
      throw new ConfigMigrationError(
        `配置校验失败：\n- ${issue}`,
        [issue]
      );
    }
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === CATALYZE_REACTION_SCHEMA_VERSION) {
    if (input.engineVersion !== CATALYZE_REACTION_ENGINE_VERSION) {
      const issue = `engineVersion: schemaVersion "${CATALYZE_REACTION_SCHEMA_VERSION}" requires "${CATALYZE_REACTION_ENGINE_VERSION}"`;
      throw new ConfigMigrationError(
        `配置校验失败：\n- ${issue}`,
        [issue]
      );
    }
    if (
      isRecord(input.reactionEngine) &&
      (input.reactionEngine.mode === "aura-v4" ||
        input.reactionEngine.mode === "aura-v5")
    ) {
      const issue =
        `reactionEngine.mode: schemaVersion "1.29.0" does not support "${String(input.reactionEngine.mode)}"`;
      throw new ConfigMigrationError(
        `配置校验失败：\n- ${issue}`,
        [issue]
      );
    }
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === CRYSTALLIZE_REACTION_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === SWIRL_REACTION_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === SHATTER_REACTION_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === FREEZE_REACTION_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === ELECTRO_CHARGED_REACTION_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === SUPERCONDUCT_REACTION_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === OVERLOAD_REACTION_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === ACTOR_POSE_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === SECTOR_GEOMETRY_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === CAPSULE_GEOMETRY_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === ORIENTED_RECTANGLE_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === TARGET_MOTION_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === CIRCLE_GEOMETRY_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === AOE_FANOUT_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === MULTI_TARGET_REGISTRY_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === TARGET_PHASE_TIMELINE_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === TARGET_EFFECT_POLICY_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === TARGET_HIT_RESOLUTION_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === TIMELINE_STATE_CLEAR_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === MOVEMENT_COMMAND_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === HIT_PARTICLE_TRIGGER_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === FIXED_ENERGY_ICD_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === RUNTIME_ENERGY_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === FOLLOWUP_CANCEL_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === ACTION_STATE_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === ICD_PROFILE_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === PARTICLE_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === PREVIOUS_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  if (version === INITIAL_TYPED_SCHEMA_VERSION) {
    return parseSimConfig({
      ...input,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION
    });
  }
  throw new ConfigMigrationError(
    `不支持的 schemaVersion "${String(version)}"；当前版本为 ${CURRENT_SCHEMA_VERSION}`
  );
}
