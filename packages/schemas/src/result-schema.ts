import { z } from "zod";
import {
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
  GCSIM_CONFIGURABLE_ELEMENTAL_APPLICATION_GROUP_IDS,
  GCSIM_DAMAGE_GROUP_PROFILE,
  GCSIM_DAMAGE_GROUP_PROFILE_ID,
  GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID,
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
  resolveDamageGroup,
  resolveReactionDamageGroupBindingForPolicy,
  type GcsimDamageGroupId,
  type PublicGcsimElementalApplicationGroupId
} from "@genshin-dps-lab/icd-profiles";
import {
  BASIC_REACTION_SCHEDULER_ENGINE_VERSION,
  BASIC_REACTION_SCHEDULER_SCHEMA_VERSION,
  BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
  DIRECT_DAMAGE_GROUP_PLUGIN_TRACE_VERIFICATION,
  DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
  DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
  ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION,
  ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
  EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION,
  EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
  REACTION_FORMULA_ROOT_ENGINE_VERSION,
  REACTION_FORMULA_ROOT_SCHEMA_VERSION,
  REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION,
  REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
  type BurningElementalApplicationIcdLogEntryV148,
  type BurningElementalApplicationIcdLogEntryV149,
  type ElementalApplicationIcdLogEntryV148,
  type ElementalApplicationIcdLogEntryV149,
  type ElementalApplicationIcdDecisionV147,
  type ElementalApplicationIcdLogEntryV147,
  type ElementalApplicationReactionFixedGcsimDecisionV148,
  type ElementalApplicationReactionFixedGcsimDecisionV149,
  type PlayerDamageEventV150,
  type ReactionDamageGroupDecisionAuditV150,
  type ReactionDamageGroupResetLogEntryV150,
  type ReactionOwnedElementalApplicationIcdSkippedDecisionV148,
  type SwirlPropagationElementalApplicationIcdLogEntryV148,
  type SwirlPropagationElementalApplicationIcdLogEntryV149,
  type TargetPhaseV3DeliveryAttemptV148,
  type SimulationResult,
  type SimulationResultForV148,
  type SimulationResultForV150,
  type SimulationResultForV151,
  type VersionedSimulationResult
} from "./types";
import {
  validateSimulationResultV142Integrity,
  validateSimulationResultV144Integrity,
  validateSimulationResultV145Integrity,
  validateSimulationResultV146Integrity,
  validateSimulationResultV147Integrity,
  validateSimulationResultV148Integrity,
  validateSimulationResultV149Integrity,
  validateSimulationResultV150Integrity,
  validateSimulationResultV151Integrity
} from "./result-integrity";
import {
  actorPoseDefinitionSchema,
  auraGaugeEntrySchema,
  auraStateEntrySchema,
  bloomReactionAuditSchema,
  burningReactionAuditSchema,
  burningStateLogEntrySchema,
  crystallizeShieldLogEntrySchema,
  crystallizeShieldTimelinePointSchema,
  damagePluginManifestEntrySchema,
  dendroCoreContactLogSchema,
  dendroCoreLogSchema,
  dendroCoreResultReferencesSchema,
  dendroCoreTimelineSchema,
  electroChargedCleanupResultReferencesSchema,
  electroChargedPropagationAuditSchema,
  elementSchema,
  elementalApplicationIcdSelectorSchema,
  enemyTargetsResultReferencesSchema,
  playerDamageEventSchema,
  playerReactionSelfDamageFactorsSchema,
  playerDamageResultReferencesSchema,
  playerHitResolutionLogEntrySchema,
  playerHpSummarySchema,
  playerHpTimelineSchema,
  playerSelfDamageStatusSchema,
  parseSimulationRunManifestForConfig,
  point2DSchema,
  quickenReactionAuditSchema,
  quickenStateLogEntrySchema,
  reactionDamageGroupAuditSchema,
  reactionDeliveryResultReferencesSchema,
  reactionTaskLogSchema,
  reactionTypeSchema,
  rejectNonPlainJsonWire,
  resolvedEnemyTargetProfileSchema,
  resolvedSimulationRuntimeOptionsSchema,
  scalingStatSchema,
  simConfigV142Schema,
  simConfigV144Schema,
  simConfigV145Schema,
  simConfigV146Schema,
  simConfigV147Schema,
  simConfigV148Schema,
  simConfigV149Schema,
  simConfigV150Schema,
  simConfigV151Schema,
  simulationRunManifestV142Schema,
  simulationRunManifestV144Schema,
  simulationRunManifestV145Schema,
  simulationRunManifestV146Schema,
  simulationRunManifestV147Schema,
  simulationRunManifestV148Schema,
  simulationRunManifestV149Schema,
  simulationRunManifestV150Schema,
  simulationRunManifestV151Schema,
  targetClockAuditSchema,
  targetClockLogSchema,
  targetClockResultReferencesSchema,
  targetHitlagLogSchema,
  targetPhaseV2LogSchema,
  targetPhaseV2ResultReferencesSchema,
  targetPhaseV3DeliverySchema,
  targetPhaseV3LogEntrySchema,
  targetPhaseV3LogSchema,
  targetPhaseV3TargetTaskSchema,
  targetStateTimelineSchema,
  targetTaskPhaseLogSchema,
  targetTaskPhaseResultReferencesSchema,
  transformativeReactionAuditSchema
} from "./schema";

const finiteNumberSchema = z.number().finite();
const nonNegativeFiniteNumberSchema =
  finiteNumberSchema.nonnegative();
const positiveFiniteNumberSchema =
  finiteNumberSchema.positive();
const integerSchema = z.number().int();
const nonNegativeIntegerSchema =
  integerSchema.nonnegative();
const positiveIntegerSchema = integerSchema.positive();
const nonNegativeSafeIntegerSchema = integerSchema
  .finite()
  .nonnegative()
  .refine(Number.isSafeInteger, {
    message: "must be a safe integer"
  });
const positiveSafeIntegerSchema = integerSchema
  .finite()
  .positive()
  .refine(Number.isSafeInteger, {
    message: "must be a safe integer"
  });
const frameSchema = nonNegativeIntegerSchema;
const nullableFrameSchema = frameSchema.nullable();
const nonEmptyStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, {
    message: "must not be blank"
  });
const nullableNonEmptyStringSchema =
  nonEmptyStringSchema.nullable();
const nonNegativeFiniteRecordSchema = z.record(
  nonEmptyStringSchema,
  nonNegativeFiniteNumberSchema
);
const finiteRecordSchema = z.record(
  nonEmptyStringSchema,
  finiteNumberSchema
);

const auraElementSchema = z.enum([
  "pyro",
  "cryo",
  "hydro",
  "electro"
]);
const auraStateElementSchema = z.enum([
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
const transformativeReactionSchema = z.enum([
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
  "swirlElectro"
]);
const swirlReactionSchema = z.enum([
  "swirlPyro",
  "swirlHydro",
  "swirlCryo",
  "swirlElectro"
]);
const crystallizeReactionSchema = z.enum([
  "crystallizePyro",
  "crystallizeHydro",
  "crystallizeCryo",
  "crystallizeElectro"
]);
const additiveReactionSchema = z.enum([
  "aggravate",
  "spread"
]);
const unsupportedMechanicsBranchSchema = z.enum([
  "burning",
  "bloom",
  "legacy-multi-reaction-order",
  "non-pyro-multi-reaction-order"
]);
const mechanicsResolutionStatusSchema = z.enum([
  "authoritative",
  "mechanics-truncated"
]);
const playerReactionSelfDamageKindSchema = z.enum([
  "burning",
  "bloom",
  "burgeon",
  "hyperbloom"
]);
const particleElementSchema = z.enum([
  "pyro",
  "cryo",
  "hydro",
  "electro",
  "anemo",
  "geo",
  "dendro",
  "neutral"
]);
const particleKindSchema = z.enum(["particle", "orb"]);
const directDamageGroupIds = new Set<string>(
  GCSIM_DAMAGE_GROUP_PROFILE.groups.map((group) => group.id)
);
const directDamageGroupIdSchema =
  z.custom<GcsimDamageGroupId>(
    (value) =>
      typeof value === "string" &&
      directDamageGroupIds.has(value),
    "unknown fixed direct-damage group"
  );
const publicElementalApplicationGroupIds = new Set<string>(
  GCSIM_CONFIGURABLE_ELEMENTAL_APPLICATION_GROUP_IDS
);
const publicElementalApplicationGroupIdSchema =
  z.custom<PublicGcsimElementalApplicationGroupId>(
    (value) =>
      typeof value === "string" &&
      publicElementalApplicationGroupIds.has(value),
    "unknown public fixed elemental-application group"
  );

export const activeStatusSnapshotV142Schema = z
  .object({
    key: nonEmptyStringSchema,
    kind: z.enum(["buff", "debuff"]),
    sourceActorId: nonEmptyStringSchema.optional(),
    targetId: nonEmptyStringSchema.optional(),
    stat: z
      .enum([
        "atkFlat",
        "atkPct",
        "hpFlat",
        "hpPct",
        "defFlat",
        "defPct",
        "em",
        "critRate",
        "critDmg",
        "dmgBonus",
        "defIgnore",
        "reactionBonus",
        "energyRecharge"
      ])
      .optional(),
    element: z
      .union([elementSchema, z.literal("all")])
      .optional(),
    value: finiteNumberSchema.optional(),
    resShred: finiteNumberSchema.optional(),
    defReduction: finiteNumberSchema.optional(),
    startTimeSeconds: nonNegativeFiniteNumberSchema,
    endTimeSeconds: nonNegativeFiniteNumberSchema,
    label: nonEmptyStringSchema
  })
  .strict()
  .superRefine((status, context) => {
    if (status.endTimeSeconds < status.startTimeSeconds) {
      context.addIssue({
        code: "custom",
        path: ["endTimeSeconds"],
        message: "must not precede startTimeSeconds"
      });
    }
  });

export const enemyStateBeforeHitV142Schema = z
  .object({
    level: positiveIntegerSchema,
    baseResistance: finiteNumberSchema,
    resistanceShred: finiteNumberSchema,
    effectiveResistance: finiteNumberSchema,
    baseDefenseReduction: finiteNumberSchema,
    effectiveDefenseReduction: finiteNumberSchema
  })
  .strict();

/**
 * Runtime stat snapshots retain the three historical flat-stat buff keys.
 * They are not accepted by input CharacterStats, but they are emitted by the
 * compatibility accumulator and therefore belong to the exact result wire.
 */
export const runtimeCharacterStatsV142Schema = z
  .object({
    baseAtk: finiteNumberSchema,
    atkPct: finiteNumberSchema,
    flatAtk: finiteNumberSchema,
    baseHp: finiteNumberSchema,
    hpPct: finiteNumberSchema,
    flatHp: finiteNumberSchema,
    baseDef: finiteNumberSchema,
    defPct: finiteNumberSchema,
    flatDef: finiteNumberSchema,
    em: finiteNumberSchema,
    critRate: finiteNumberSchema,
    critDmg: finiteNumberSchema,
    dmgBonus: finiteNumberSchema,
    defIgnore: finiteNumberSchema,
    reactionBonus: finiteNumberSchema,
    energyRecharge: nonNegativeFiniteNumberSchema,
    atkFlat: finiteNumberSchema.optional(),
    hpFlat: finiteNumberSchema.optional(),
    defFlat: finiteNumberSchema.optional()
  })
  .strict();

export const targetMechanicsTruncationAuditV142Schema = z
  .object({
    operation: z.enum(["trigger", "carry"]),
    startedAtFrame: frameSchema,
    unsupportedReactions: z
      .array(unsupportedMechanicsBranchSchema)
      .min(1),
    discardedAura: z.array(auraStateEntrySchema),
    reason: z.enum([
      "UNSUPPORTED_DENDRO_REACTION",
      "UNSUPPORTED_REACTION_ORDER"
    ])
  })
  .strict();

export const additiveReactionAuditV142Schema = z
  .object({
    reaction: additiveReactionSchema,
    triggerElement: z.enum(["dendro", "electro"]),
    quickenGaugeUnitsBefore: nonNegativeFiniteNumberSchema,
    quickenGaugeUnitsAfter: nonNegativeFiniteNumberSchema,
    consumedQuickenGaugeUnits: z.literal(0)
  })
  .strict()
  .superRefine((audit, context) => {
    const expectedElement =
      audit.reaction === "aggravate" ? "electro" : "dendro";
    if (audit.triggerElement !== expectedElement) {
      context.addIssue({
        code: "custom",
        path: ["triggerElement"],
        message: `${audit.reaction} requires ${expectedElement}`
      });
    }
    const expectedQuickenGaugeUnitsAfter =
      audit.quickenGaugeUnitsBefore -
      audit.consumedQuickenGaugeUnits;
    const gaugeTolerance =
      1e-12 *
      Math.max(
        1,
        Math.abs(audit.quickenGaugeUnitsBefore),
        Math.abs(audit.quickenGaugeUnitsAfter),
        Math.abs(expectedQuickenGaugeUnitsAfter)
      );
    if (
      Math.abs(
        audit.quickenGaugeUnitsAfter -
          expectedQuickenGaugeUnitsAfter
      ) > gaugeTolerance
    ) {
      context.addIssue({
        code: "custom",
        path: ["quickenGaugeUnitsAfter"],
        message:
          `${audit.reaction} cannot consume Quicken Gauge; ` +
          "quickenGaugeUnitsAfter must approximately equal " +
          "quickenGaugeUnitsBefore - consumedQuickenGaugeUnits"
      });
    }
  });

export const catalyzeReactionAuditV142Schema = z
  .object({
    quicken: quickenReactionAuditSchema.nullable(),
    additive: additiveReactionAuditV142Schema.nullable()
  })
  .strict();

export const reactionStatusEffectDefinitionV142Schema = z
  .object({
    key: nonEmptyStringSchema,
    label: nonEmptyStringSchema,
    element: z.union([elementSchema, z.literal("all")]),
    resShred: finiteNumberSchema,
    durationFrames: positiveIntegerSchema
  })
  .strict();

export const periodicReactionAuditV142Schema = z
  .object({
    reaction: z.literal("electroCharged"),
    generation: positiveIntegerSchema,
    operation: z.enum(["start", "refresh", "stop"]),
    damageElement: elementSchema,
    baseMultiplier: nonNegativeFiniteNumberSchema,
    firstDamageFrame: nullableFrameSchema,
    nextTickFrame: nullableFrameSchema,
    tickIntervalFrames: positiveIntegerSchema,
    waneDelayFrames: nonNegativeIntegerSchema,
    waneGaugeUnits: nonNegativeFiniteNumberSchema,
    coexistenceExpiresAtFrame: nullableFrameSchema,
    cadenceStatus: z
      .enum(["scheduled", "dormant", "stopped"])
      .optional(),
    waneListenerActive: z.boolean().optional()
  })
  .strict()
  .superRefine((audit, context) => {
    if (
      (audit.cadenceStatus === undefined) !==
      (audit.waneListenerActive === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["cadenceStatus"],
        message:
          "cadenceStatus and waneListenerActive must be present or omitted together"
      });
    }
  });

export const frozenReactionAuditV142Schema = z
  .object({
    generation: positiveIntegerSchema,
    operation: z.enum([
      "start",
      "refresh",
      "immune",
      "consume"
    ]),
    freezeResistance: finiteNumberSchema.min(0).max(1),
    generatedGaugeUnits: nonNegativeFiniteNumberSchema,
    consumedGaugeUnits: nonNegativeFiniteNumberSchema,
    frozenGaugeBefore: nonNegativeFiniteNumberSchema,
    frozenGaugeAfter: nonNegativeFiniteNumberSchema,
    decayRatePerFrame: nonNegativeFiniteNumberSchema,
    expiresAtFrame: nullableFrameSchema
  })
  .strict();

export const shatterReactionAuditV142Schema = z
  .object({
    reaction: z.literal("shatter"),
    generation: nonNegativeIntegerSchema,
    strikeType: z.enum(["default", "blunt"]),
    poiseDamage: nonNegativeFiniteNumberSchema,
    triggered: z.boolean(),
    scheduled: z.boolean(),
    damageElement: z.literal("physical"),
    damageFrame: frameSchema,
    baseMultiplier: nonNegativeFiniteNumberSchema,
    blockedReason: z
      .enum([
        "NO_FROZEN_AURA",
        "FROZEN_DEPLETED_BY_POISE",
        "REACTION_DAMAGE_GCD",
        "TARGET_MECHANICS_TRUNCATION"
      ])
      .nullable(),
    nextAvailableFrame: nullableFrameSchema,
    frozenGaugeBefore: nonNegativeFiniteNumberSchema,
    poiseConsumedGaugeUnits: nonNegativeFiniteNumberSchema,
    frozenGaugeAfterPoise: nonNegativeFiniteNumberSchema,
    shatterConsumedGaugeUnits:
      nonNegativeFiniteNumberSchema,
    frozenGaugeAfter: nonNegativeFiniteNumberSchema,
    auraBefore: z.array(auraStateEntrySchema),
    auraAfterPoise: z.array(auraStateEntrySchema),
    auraAfter: z.array(auraStateEntrySchema),
    expiresAtFrame: nullableFrameSchema
  })
  .strict();

export const swirlReactionAuditV142Schema = z
  .object({
    reaction: swirlReactionSchema,
    swirledElement: auraElementSchema,
    consumedAuraElement: auraStateElementSchema,
    sourceGaugeUnitsBefore: nonNegativeFiniteNumberSchema,
    sourceGaugeUnitsSpent: nonNegativeFiniteNumberSchema,
    sourceGaugeUnitsAfter: nonNegativeFiniteNumberSchema,
    auraGaugeUnitsBefore: nonNegativeFiniteNumberSchema,
    auraConsumedGaugeUnits: nonNegativeFiniteNumberSchema,
    auraGaugeUnitsAfter: nonNegativeFiniteNumberSchema,
    propagatedGaugeUnits: nonNegativeFiniteNumberSchema,
    scheduled: z.boolean(),
    blockedReason: z
      .literal("REACTION_QUEUE_GCD")
      .nullable(),
    nextAvailableFrame: frameSchema,
    selfDamageFrame: frameSchema,
    propagationDamageFrame: frameSchema,
    selfBaseMultiplier: nonNegativeFiniteNumberSchema,
    propagationBaseMultiplier:
      nonNegativeFiniteNumberSchema,
    radius: nonNegativeFiniteNumberSchema
  })
  .strict()
  .superRefine((audit, context) => {
    const expectedElement = {
      swirlPyro: "pyro",
      swirlHydro: "hydro",
      swirlCryo: "cryo",
      swirlElectro: "electro"
    }[audit.reaction];
    if (audit.swirledElement !== expectedElement) {
      context.addIssue({
        code: "custom",
        path: ["swirledElement"],
        message: `${audit.reaction} requires ${expectedElement}`
      });
    }
    if (
      audit.consumedAuraElement !== expectedElement &&
      !(
        audit.reaction === "swirlCryo" &&
        audit.consumedAuraElement === "frozen"
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["consumedAuraElement"],
        message:
          `${audit.reaction} must consume ${expectedElement}` +
          (audit.reaction === "swirlCryo"
            ? " or frozen"
            : "")
      });
    }
  });

export const swirlDamageGroupAuditV142Schema = z
  .object({
    reaction: swirlReactionSchema,
    windowStartFrame: frameSchema,
    hitIndex: nonNegativeIntegerSchema,
    resetFrames: positiveIntegerSchema,
    sequence: z.tuple([
      z.literal(true),
      z.literal(true),
      z.literal(false)
    ]),
    damageAllowed: z.boolean(),
    blockedReason: z
      .literal("REACTION_A_DAMAGE_ICD")
      .nullable()
  })
  .strict();

export const crystallizeReactionAuditV142Schema = z
  .object({
    reaction: crystallizeReactionSchema,
    crystallizedElement: auraElementSchema,
    consumedAuraElement: auraStateElementSchema,
    sourceGaugeUnitsBefore: nonNegativeFiniteNumberSchema,
    sourceGaugeUnitsSpent: nonNegativeFiniteNumberSchema,
    sourceGaugeUnitsAfter: nonNegativeFiniteNumberSchema,
    auraGaugeUnitsBefore: nonNegativeFiniteNumberSchema,
    auraConsumedGaugeUnits: nonNegativeFiniteNumberSchema,
    auraGaugeUnitsAfter: nonNegativeFiniteNumberSchema,
    scheduled: z.boolean(),
    blockedReason: z
      .literal("REACTION_QUEUE_GCD")
      .nullable(),
    nextAvailableFrame: frameSchema,
    shardSpawnFrame: frameSchema,
    earliestPickupFrame: frameSchema,
    shardExpiresAtFrame: frameSchema,
    shardDurationFrames: positiveIntegerSchema,
    maxActiveShards: positiveIntegerSchema
  })
  .strict()
  .superRefine((audit, context) => {
    const expectedElement = {
      crystallizePyro: "pyro",
      crystallizeHydro: "hydro",
      crystallizeCryo: "cryo",
      crystallizeElectro: "electro"
    }[audit.reaction];
    if (audit.crystallizedElement !== expectedElement) {
      context.addIssue({
        code: "custom",
        path: ["crystallizedElement"],
        message: `${audit.reaction} requires ${expectedElement}`
      });
    }
    if (
      audit.consumedAuraElement !== expectedElement &&
      !(
        audit.reaction === "crystallizeCryo" &&
        audit.consumedAuraElement === "frozen"
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["consumedAuraElement"],
        message:
          `${audit.reaction} must consume ${expectedElement}` +
          (audit.reaction === "crystallizeCryo"
            ? " or frozen"
            : "")
      });
    }
  });

export const reactionAuditV142Schema = z
  .object({
    model: z.enum([
      "none",
      "manual-override",
      "aura-engine",
      "reaction-damage"
    ]),
    triggered: z.boolean(),
    reaction: reactionTypeSchema,
    reactions: z.array(reactionTypeSchema),
    unsupportedReactions: z.array(
      unsupportedMechanicsBranchSchema
    ),
    mechanicsTruncation:
      targetMechanicsTruncationAuditV142Schema.nullable(),
    icdAllowed: z.boolean().nullable(),
    icdTag: nullableNonEmptyStringSchema,
    icdGroup: nullableNonEmptyStringSchema,
    applicationGaugeUnits:
      nonNegativeFiniteNumberSchema.nullable(),
    auraBefore: z.array(auraStateEntrySchema).nullable(),
    auraApplied: z.array(auraGaugeEntrySchema).nullable(),
    auraConsumed: z.array(auraGaugeEntrySchema).nullable(),
    auraAfter: z.array(auraStateEntrySchema).nullable(),
    transformativeReactions: z
      .array(transformativeReactionAuditSchema)
      .optional(),
    transformativeReaction:
      transformativeReactionAuditSchema.nullable(),
    periodicReaction:
      periodicReactionAuditV142Schema.nullable(),
    frozenReaction:
      frozenReactionAuditV142Schema.nullable(),
    shatterReaction:
      shatterReactionAuditV142Schema.nullable(),
    swirlReactions: z.array(swirlReactionAuditV142Schema),
    swirlDamageGroup:
      swirlDamageGroupAuditV142Schema.nullable(),
    crystallizeReaction:
      crystallizeReactionAuditV142Schema.nullable(),
    catalyzeReaction:
      catalyzeReactionAuditV142Schema.nullable(),
    burningReaction: burningReactionAuditSchema.nullable(),
    bloomReactions: z.array(bloomReactionAuditSchema),
    note: nonEmptyStringSchema.optional()
  })
  .strict()
  .superRefine((audit, context) => {
    if (audit.triggered && audit.reaction === "none") {
      context.addIssue({
        code: "custom",
        path: ["reaction"],
        message:
          "a triggered reaction cannot use reaction=none"
      });
    }
    if (
      audit.transformativeReactions !== undefined &&
      audit.transformativeReactions.length > 0 &&
      audit.transformativeReaction !== null &&
      JSON.stringify(audit.transformativeReactions[0]) !==
        JSON.stringify(audit.transformativeReaction)
    ) {
      context.addIssue({
        code: "custom",
        path: ["transformativeReaction"],
        message:
          "must equal the first ordered transformative reaction"
      });
    }
  });

export const flatDamageDetailV142Schema = z
  .object({
    ownerId: nonEmptyStringSchema,
    stat: scalingStatSchema,
    multiplier: finiteNumberSchema,
    sourceValue: finiteNumberSchema,
    amount: finiteNumberSchema
  })
  .strict();

export const damageFactorsV142Schema = z
  .object({
    scaling: finiteNumberSchema,
    scalingStat: scalingStatSchema,
    scalingValue: finiteNumberSchema,
    flatDamage: finiteNumberSchema,
    baseDamage: finiteNumberSchema,
    damageBonus: finiteNumberSchema,
    damageBonusMultiplier: finiteNumberSchema,
    defenseIgnore: finiteNumberSchema,
    defenseReduction: finiteNumberSchema,
    defenseMultiplier: finiteNumberSchema,
    effectiveResistance: finiteNumberSchema,
    resistanceMultiplier: finiteNumberSchema,
    critRate: finiteNumberSchema,
    critDamage: finiteNumberSchema,
    critMultiplier: finiteNumberSchema,
    reactionBase: finiteNumberSchema,
    elementalMasteryBonus: finiteNumberSchema,
    reactionBonus: finiteNumberSchema,
    amplifyingReactionMultiplier: finiteNumberSchema,
    groupMultiplier: finiteNumberSchema
  })
  .strict();

export const transformativeReactionFactorsV142Schema = z
  .object({
    reaction: transformativeReactionSchema,
    characterLevel: positiveIntegerSchema,
    levelBaseDamage: nonNegativeFiniteNumberSchema,
    baseMultiplier: nonNegativeFiniteNumberSchema,
    elementalMastery: nonNegativeFiniteNumberSchema,
    elementalMasteryBonus: finiteNumberSchema,
    reactionBonus: finiteNumberSchema,
    preResistanceDamage: nonNegativeFiniteNumberSchema,
    effectiveResistance: finiteNumberSchema,
    resistanceMultiplier: finiteNumberSchema
  })
  .strict();

export const additiveReactionFactorsV142Schema = z
  .object({
    reaction: additiveReactionSchema,
    sourceActorId: nonEmptyStringSchema,
    characterLevel: positiveIntegerSchema,
    levelBaseDamage: nonNegativeFiniteNumberSchema,
    baseMultiplier: nonNegativeFiniteNumberSchema,
    elementalMastery: nonNegativeFiniteNumberSchema,
    elementalMasteryBonus: finiteNumberSchema,
    reactionBonus: finiteNumberSchema,
    flatDamage: finiteNumberSchema,
    appliedFlatDamage: finiteNumberSchema,
    snapshotMode: z.literal("hit-time")
  })
  .strict();

export const damageCompositionV142Schema = z
  .object({
    direct: finiteNumberSchema,
    additiveReaction: finiteNumberSchema,
    transformativeReaction: finiteNumberSchema
  })
  .strict();

export const damageEventV142Schema = z
  .object({
    id: nonNegativeIntegerSchema,
    kind: z.enum(["direct", "transformative-reaction"]),
    eventPriority: nonNegativeFiniteNumberSchema,
    eventSequence: nonNegativeIntegerSchema,
    parentDamageEventId:
      nonNegativeIntegerSchema.nullable(),
    sourceActorId: nonEmptyStringSchema,
    scalingOwnerId: nonEmptyStringSchema,
    creditOwnerId: nonEmptyStringSchema,
    actionId: nonEmptyStringSchema,
    hitId: nonEmptyStringSchema,
    hitGroupId: nonEmptyStringSchema,
    targetIndex: nonNegativeIntegerSchema,
    targetCount: positiveIntegerSchema,
    targetResolutionId: nonNegativeIntegerSchema,
    targetId: nonEmptyStringSchema,
    targetName: nonEmptyStringSchema,
    targetDamagePolicy: z.enum(["normal", "immune"]),
    targetDamageMultiplier: z.union([
      z.literal(0),
      z.literal(1)
    ]),
    mechanicsStatus: mechanicsResolutionStatusSchema,
    potentialDamage: nonNegativeFiniteNumberSchema,
    frame: frameSchema,
    timeSeconds: nonNegativeFiniteNumberSchema,
    activeCharacterId: nullableNonEmptyStringSchema,
    statsBeforeDamage: runtimeCharacterStatsV142Schema,
    activeStatuses: z.array(activeStatusSnapshotV142Schema),
    enemyStateBeforeHit: enemyStateBeforeHitV142Schema,
    reactionAudit: reactionAuditV142Schema,
    damageFactors: damageFactorsV142Schema,
    transformativeReactionFactors:
      transformativeReactionFactorsV142Schema.nullable(),
    additiveReactionFactors:
      additiveReactionFactorsV142Schema.nullable(),
    damageComposition: damageCompositionV142Schema,
    finalDamage: nonNegativeFiniteNumberSchema,
    displayDamage: nonNegativeIntegerSchema,
    sourceActorName: nonEmptyStringSchema,
    scalingOwnerName: nonEmptyStringSchema,
    creditOwnerName: nonEmptyStringSchema,
    actionName: nonEmptyStringSchema,
    hitLabel: nonEmptyStringSchema,
    element: elementSchema,
    reaction: reactionTypeSchema,
    snapshot: z.enum(["action", "hit"]),
    cycle: nonNegativeIntegerSchema,
    flatDetails: z.array(flatDamageDetailV142Schema),
    timelineCommandIndex:
      nonNegativeIntegerSchema.optional(),
    sourceAbilityId: nonEmptyStringSchema.optional(),
    actionStartFrame: frameSchema.optional(),
    actionCancelFrame: frameSchema.optional(),
    actionAnimationEndFrame: frameSchema.optional(),
    time: nonNegativeFiniteNumberSchema,
    second: nonNegativeIntegerSchema,
    actorId: nonEmptyStringSchema,
    creditId: nonEmptyStringSchema,
    actorName: nonEmptyStringSchema,
    activeId: nullableNonEmptyStringSchema,
    scaling: finiteNumberSchema,
    scalingStat: scalingStatSchema,
    scalingValue: finiteNumberSchema,
    flat: finiteNumberSchema,
    baseDamage: finiteNumberSchema,
    dmgBonus: finiteNumberSchema,
    bonusFactor: finiteNumberSchema,
    defIgnore: finiteNumberSchema,
    defReduction: finiteNumberSchema,
    defenseFactor: finiteNumberSchema,
    effectiveRes: finiteNumberSchema,
    resFactor: finiteNumberSchema,
    critRate: finiteNumberSchema,
    critDmg: finiteNumberSchema,
    critFactor: finiteNumberSchema,
    em: finiteNumberSchema,
    reactionBase: finiteNumberSchema,
    emBonus: finiteNumberSchema,
    reactionBonus: finiteNumberSchema,
    reactionFactor: finiteNumberSchema,
    groupMultiplier: finiteNumberSchema,
    buffs: z.array(nonEmptyStringSchema),
    debuffs: z.array(nonEmptyStringSchema)
  })
  .strict()
  .superRefine((event, context) => {
    const issue = (
      path: Array<string | number>,
      message: string
    ): void => {
      context.addIssue({ code: "custom", path, message });
    };
    const approximatelyEqual = (
      left: number,
      right: number
    ): boolean =>
      Math.abs(left - right) <=
      1e-9 * Math.max(1, Math.abs(left), Math.abs(right));

    if (
      event.frame !== Math.round(event.timeSeconds * 60)
    ) {
      issue(
        ["timeSeconds"],
        "must round to frame at 60 FPS"
      );
    }
    if (event.time !== event.timeSeconds) {
      issue(["time"], "must equal timeSeconds");
    }
    if (event.second !== Math.floor(event.timeSeconds)) {
      issue(["second"], "must equal floor(timeSeconds)");
    }
    if (
      event.displayDamage !== Math.round(event.finalDamage)
    ) {
      issue(
        ["displayDamage"],
        "must equal Math.round(finalDamage)"
      );
    }
    if (
      !approximatelyEqual(
        event.finalDamage,
        event.damageComposition.direct +
          event.damageComposition.additiveReaction +
          event.damageComposition.transformativeReaction
      )
    ) {
      issue(
        ["damageComposition"],
        "components must sum to finalDamage"
      );
    }
    if (
      !approximatelyEqual(
        event.finalDamage,
        event.potentialDamage * event.targetDamageMultiplier
      )
    ) {
      issue(
        ["finalDamage"],
        "must equal potentialDamage * targetDamageMultiplier"
      );
    }
    if (
      event.targetDamagePolicy === "immune" &&
      event.targetDamageMultiplier !== 0
    ) {
      issue(
        ["targetDamageMultiplier"],
        "immune targets require multiplier 0"
      );
    }
    if (event.targetIndex >= event.targetCount) {
      issue(
        ["targetIndex"],
        "must be less than targetCount"
      );
    }
    if (event.kind === "direct") {
      if (event.transformativeReactionFactors !== null) {
        issue(
          ["transformativeReactionFactors"],
          "direct damage must not carry transformative factors"
        );
      }
      if (event.parentDamageEventId !== null) {
        issue(
          ["parentDamageEventId"],
          "direct damage must not have a parent damage event"
        );
      }
    } else {
      if (event.transformativeReactionFactors === null) {
        issue(
          ["transformativeReactionFactors"],
          "transformative damage requires transformative factors"
        );
      }
    }
    const aliases: Array<
      readonly [
        string,
        string | number | null,
        string | number | null
      ]
    > = [
      ["actorId", event.actorId, event.sourceActorId],
      ["creditId", event.creditId, event.creditOwnerId],
      ["actorName", event.actorName, event.creditOwnerName],
      ["activeId", event.activeId, event.activeCharacterId],
      [
        "scaling",
        event.scaling,
        event.damageFactors.scaling
      ],
      [
        "scalingStat",
        event.scalingStat,
        event.damageFactors.scalingStat
      ],
      [
        "scalingValue",
        event.scalingValue,
        event.damageFactors.scalingValue
      ],
      ["flat", event.flat, event.damageFactors.flatDamage],
      [
        "baseDamage",
        event.baseDamage,
        event.damageFactors.baseDamage
      ],
      [
        "dmgBonus",
        event.dmgBonus,
        event.damageFactors.damageBonus
      ],
      [
        "bonusFactor",
        event.bonusFactor,
        event.damageFactors.damageBonusMultiplier
      ],
      [
        "defIgnore",
        event.defIgnore,
        event.damageFactors.defenseIgnore
      ],
      [
        "defReduction",
        event.defReduction,
        event.damageFactors.defenseReduction
      ],
      [
        "defenseFactor",
        event.defenseFactor,
        event.damageFactors.defenseMultiplier
      ],
      [
        "effectiveRes",
        event.effectiveRes,
        event.damageFactors.effectiveResistance
      ],
      [
        "resFactor",
        event.resFactor,
        event.damageFactors.resistanceMultiplier
      ],
      [
        "critRate",
        event.critRate,
        event.damageFactors.critRate
      ],
      [
        "critDmg",
        event.critDmg,
        event.damageFactors.critDamage
      ],
      [
        "critFactor",
        event.critFactor,
        event.damageFactors.critMultiplier
      ],
      [
        "reactionBase",
        event.reactionBase,
        event.damageFactors.reactionBase
      ],
      [
        "emBonus",
        event.emBonus,
        event.damageFactors.elementalMasteryBonus
      ],
      [
        "reactionBonus",
        event.reactionBonus,
        event.damageFactors.reactionBonus
      ],
      [
        "groupMultiplier",
        event.groupMultiplier,
        event.damageFactors.groupMultiplier
      ]
    ];
    for (const [field, actual, expected] of aliases) {
      if (actual !== expected) {
        issue(
          [field],
          `must equal damageFactors/${field} source`
        );
      }
    }
  });

export const hitResolutionLogEntryV142Schema = z
  .object({
    id: nonNegativeIntegerSchema,
    frame: frameSchema,
    timeSeconds: nonNegativeFiniteNumberSchema,
    eventPriority: nonNegativeFiniteNumberSchema.optional(),
    eventSequence: nonNegativeIntegerSchema.optional(),
    intraEventSequence: nonNegativeIntegerSchema.optional(),
    cycle: nonNegativeIntegerSchema,
    sourceActorId: nonEmptyStringSchema,
    sourceActionId: nonEmptyStringSchema,
    actionName: nonEmptyStringSchema,
    hitId: nonEmptyStringSchema,
    hitGroupId: nonEmptyStringSchema,
    targetIndex: nonNegativeIntegerSchema,
    targetCount: positiveIntegerSchema,
    hitLabel: nonEmptyStringSchema,
    element: elementSchema,
    targetId: nonEmptyStringSchema,
    targetName: nonEmptyStringSchema,
    targetingSource: z.enum([
      "default",
      "scripted",
      "geometry",
      "reaction-source",
      "reaction-geometry"
    ]),
    resolutionKind: z.enum(["direct", "reaction-damage"]),
    targetPosition: point2DSchema.nullable(),
    sourceActorPosition: point2DSchema.nullable(),
    sourceActorFacingDegrees: finiteNumberSchema.nullable(),
    geometryKind: z
      .enum(["circle", "rectangle", "capsule", "sector"])
      .nullable(),
    geometryCoordinateSpace: z
      .enum(["world", "actor-local"])
      .nullable(),
    geometryOrigin: point2DSchema.nullable(),
    geometryStart: point2DSchema.nullable(),
    geometryEnd: point2DSchema.nullable(),
    geometryRadius:
      nonNegativeFiniteNumberSchema.nullable(),
    geometryHalfWidth:
      nonNegativeFiniteNumberSchema.nullable(),
    geometryHalfHeight:
      nonNegativeFiniteNumberSchema.nullable(),
    geometryRotationDegrees: finiteNumberSchema.nullable(),
    geometryDirectionDegrees: finiteNumberSchema.nullable(),
    geometryAngleDegrees: finiteNumberSchema.nullable(),
    geometryDistance:
      nonNegativeFiniteNumberSchema.nullable(),
    geometryThreshold:
      nonNegativeFiniteNumberSchema.nullable(),
    outcome: z.enum(["landed", "miss"]),
    landed: z.boolean(),
    reason: nullableNonEmptyStringSchema,
    targetEffectSource: z.enum([
      "normal",
      "hit",
      "target-phase"
    ]),
    targetPhaseId: nullableNonEmptyStringSchema,
    damageAllowed: z.boolean(),
    auraAllowed: z.boolean(),
    hitConfirmAllowed: z.boolean(),
    mechanicsStatus: mechanicsResolutionStatusSchema,
    damageEventId: nonNegativeIntegerSchema.nullable(),
    potentialDamage: nonNegativeFiniteNumberSchema,
    finalDamage: nonNegativeFiniteNumberSchema,
    displayDamage: nonNegativeIntegerSchema,
    timelineCommandIndex:
      nonNegativeIntegerSchema.optional(),
    sourceAbilityId: nonEmptyStringSchema.optional()
  })
  .strict()
  .superRefine((entry, context) => {
    if (
      entry.frame !== Math.round(entry.timeSeconds * 60)
    ) {
      context.addIssue({
        code: "custom",
        path: ["timeSeconds"],
        message: "must round to frame at 60 FPS"
      });
    }
    if (entry.landed !== (entry.outcome === "landed")) {
      context.addIssue({
        code: "custom",
        path: ["landed"],
        message: "must agree with outcome"
      });
    }
    if (entry.targetIndex >= entry.targetCount) {
      context.addIssue({
        code: "custom",
        path: ["targetIndex"],
        message: "must be less than targetCount"
      });
    }
    if (
      entry.displayDamage !== Math.round(entry.finalDamage)
    ) {
      context.addIssue({
        code: "custom",
        path: ["displayDamage"],
        message: "must equal Math.round(finalDamage)"
      });
    }
    const tuplePresent = [
      entry.eventPriority,
      entry.eventSequence,
      entry.intraEventSequence
    ].filter((value) => value !== undefined).length;
    if (tuplePresent !== 0 && tuplePresent !== 3) {
      context.addIssue({
        code: "custom",
        path: ["eventPriority"],
        message:
          "eventPriority, eventSequence, and intraEventSequence must be present or omitted together"
      });
    }
    if (
      entry.outcome === "miss" &&
      (entry.damageEventId !== null ||
        entry.potentialDamage !== 0 ||
        entry.finalDamage !== 0 ||
        entry.displayDamage !== 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["damageEventId"],
        message: "misses cannot own damage output"
      });
    }
  });

const elementalApplicationIcdNoWindowShape = {
  scope: z.null(),
  profileId: z.null(),
  icdTag: z.null(),
  groupId: z.null(),
  windowStartGroupId: z.null(),
  resetFrames: z.null(),
  windowStartFrame: z.null(),
  resetAtFrame: z.null(),
  hitIndex: z.null(),
  sequenceIndex: z.null(),
  tailPolicy: z.null()
} as const;

const elementalApplicationIcdWindowShape = {
  resetFrames: positiveSafeIntegerSchema,
  windowStartFrame: nonNegativeSafeIntegerSchema,
  resetAtFrame: nonNegativeSafeIntegerSchema,
  hitIndex: nonNegativeSafeIntegerSchema,
  sequenceIndex: nonNegativeSafeIntegerSchema
} as const;

/**
 * Exact 1.47 elemental-application ICD decision wire.
 *
 * Skips are not evaluations and therefore omit every window field. No-ICD is
 * an evaluated bypass but carries explicit nulls, making it impossible to
 * serialize a plausible-looking partial window. Legacy and fixed decisions
 * are consumed attempts and own complete, mutually exclusive window shapes.
 */
export const elementalApplicationIcdDecisionV147Schema = z
  .discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("skipped"),
        evaluated: z.literal(false),
        reason: z.enum([
          "miss",
          "target-aura-blocked",
          "no-aura-engine",
          "mechanics-truncated"
        ]),
        consumed: z.literal(false),
        applicationMultiplier: z.literal(0),
        allowed: z.literal(false)
      })
      .strict(),
    z
      .object({
        kind: z.literal("no-icd"),
        evaluated: z.literal(true),
        consumed: z.literal(false),
        applicationMultiplier: z.literal(1),
        allowed: z.literal(true),
        ...elementalApplicationIcdNoWindowShape,
        resetSchedulePolicy: z.literal("bypass")
      })
      .strict(),
    z
      .object({
        kind: z.literal("legacy-profile"),
        evaluated: z.literal(true),
        consumed: z.literal(true),
        allowed: z.boolean(),
        scope: z.enum([
          "actor-tag-profile",
          "target-global-burning"
        ]),
        profileId: nonEmptyStringSchema,
        icdTag: nonEmptyStringSchema,
        groupId: z.null(),
        windowStartGroupId: z.null(),
        ...elementalApplicationIcdWindowShape,
        applicationMultiplier: z.union([
          z.literal(0),
          z.literal(1)
        ]),
        tailPolicy: z.enum(["repeat", "clamp"]),
        resetSchedulePolicy: z.literal(
          "window-start-plus-reset-frames"
        )
      })
      .strict(),
    z
      .object({
        kind: z.literal("fixed-gcsim"),
        evaluated: z.literal(true),
        consumed: z.literal(true),
        allowed: z.boolean(),
        scope: z.literal("actor-tag"),
        profileId: z.literal(
          GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID
        ),
        icdTag: nonEmptyStringSchema,
        groupId: publicElementalApplicationGroupIdSchema,
        windowStartGroupId:
          publicElementalApplicationGroupIdSchema,
        ...elementalApplicationIcdWindowShape,
        applicationMultiplier:
          nonNegativeFiniteNumberSchema,
        tailPolicy: z.literal("clamp"),
        resetSchedulePolicy: z.literal(
          "window-start-plus-reset-frames-minus-one"
        )
      })
      .strict()
  ])
  .superRefine((decision, context) => {
    if (
      decision.kind === "skipped" ||
      decision.kind === "no-icd"
    ) {
      return;
    }
    if (
      decision.allowed !==
      decision.applicationMultiplier > 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["allowed"],
        message: "must equal applicationMultiplier > 0"
      });
    }
    const expectedResetAtFrame =
      decision.kind === "fixed-gcsim"
        ? decision.windowStartFrame +
          decision.resetFrames -
          1
        : decision.windowStartFrame + decision.resetFrames;
    if (
      !Number.isSafeInteger(expectedResetAtFrame) ||
      decision.resetAtFrame !== expectedResetAtFrame
    ) {
      context.addIssue({
        code: "custom",
        path: ["resetAtFrame"],
        message:
          "must equal the decision window start plus its versioned reset schedule"
      });
    }
  }) satisfies z.ZodType<ElementalApplicationIcdDecisionV147>;

const elementalApplicationElementV147Schema = z.enum([
  "pyro",
  "cryo",
  "hydro",
  "electro",
  "anemo",
  "geo",
  "dendro"
]);

/** One source-configured elemental application attempt, including skips. */
export const elementalApplicationIcdLogEntryV147Schema = z
  .object({
    id: nonNegativeSafeIntegerSchema,
    sourceKind: z.literal("configured-direct-hit"),
    hitResolutionLogId: nonNegativeSafeIntegerSchema,
    damageEventId: nonNegativeSafeIntegerSchema.nullable(),
    frame: nonNegativeSafeIntegerSchema,
    sourceActorId: nonEmptyStringSchema,
    targetId: nonEmptyStringSchema,
    hitId: nonEmptyStringSchema,
    hitGroupId: nonEmptyStringSchema,
    element: elementalApplicationElementV147Schema,
    selector: elementalApplicationIcdSelectorSchema,
    nominalGaugeUnits: positiveFiniteNumberSchema,
    effectiveGaugeUnits: nonNegativeFiniteNumberSchema,
    decision: elementalApplicationIcdDecisionV147Schema
  })
  .strict()
  .superRefine((entry, context) => {
    const statefulDecision =
      entry.decision.kind === "legacy-profile" ||
      entry.decision.kind === "fixed-gcsim"
        ? entry.decision
        : null;
    if (
      statefulDecision !== null &&
      (statefulDecision.windowStartFrame > entry.frame ||
        statefulDecision.resetAtFrame <= entry.frame)
    ) {
      context.addIssue({
        code: "custom",
        path: ["decision", "windowStartFrame"],
        message:
          "active window must start no later than this frame and reset after it"
      });
    }
    if (
      statefulDecision !== null &&
      statefulDecision.sequenceIndex >
        statefulDecision.hitIndex
    ) {
      context.addIssue({
        code: "custom",
        path: ["decision", "sequenceIndex"],
        message: "cannot exceed hitIndex"
      });
    }
    if (
      entry.decision.kind === "skipped" &&
      entry.decision.reason === "miss"
    ) {
      if (entry.damageEventId !== null) {
        context.addIssue({
          code: "custom",
          path: ["damageEventId"],
          message:
            "missed application attempts cannot own a damage event"
        });
      }
    } else if (entry.damageEventId === null) {
      context.addIssue({
        code: "custom",
        path: ["damageEventId"],
        message:
          "landed configured direct-hit attempts require a damage event"
      });
    }

    const expectedEffectiveGaugeUnits =
      entry.nominalGaugeUnits *
      entry.decision.applicationMultiplier;
    const gaugeTolerance =
      1e-12 *
      Math.max(1, Math.abs(expectedEffectiveGaugeUnits));
    if (
      !Number.isFinite(expectedEffectiveGaugeUnits) ||
      Math.abs(
        entry.effectiveGaugeUnits -
          expectedEffectiveGaugeUnits
      ) > gaugeTolerance
    ) {
      context.addIssue({
        code: "custom",
        path: ["effectiveGaugeUnits"],
        message:
          "must approximately equal nominalGaugeUnits * decision.applicationMultiplier"
      });
    }

    if (
      entry.decision.kind === "no-icd" &&
      entry.selector.mode !== "no-icd-v1"
    ) {
      context.addIssue({
        code: "custom",
        path: ["decision", "kind"],
        message:
          "no-icd decision requires the no-icd-v1 selector"
      });
    }
    if (entry.decision.kind === "legacy-profile") {
      if (
        entry.selector.mode !== "legacy-boolean-profile-v1"
      ) {
        context.addIssue({
          code: "custom",
          path: ["decision", "kind"],
          message:
            "legacy-profile decision requires a legacy-boolean-profile-v1 selector"
        });
      } else {
        if (
          entry.decision.icdTag !== entry.selector.icdTag
        ) {
          context.addIssue({
            code: "custom",
            path: ["decision", "icdTag"],
            message: "must equal selector.icdTag"
          });
        }
        if (
          entry.decision.profileId !==
          entry.selector.profileId
        ) {
          context.addIssue({
            code: "custom",
            path: ["decision", "profileId"],
            message: "must equal selector.profileId"
          });
        }
      }
    }
    if (entry.decision.kind === "fixed-gcsim") {
      if (
        entry.selector.mode !== "fixed-gcsim-application-v1"
      ) {
        context.addIssue({
          code: "custom",
          path: ["decision", "kind"],
          message:
            "fixed-gcsim decision requires a fixed-gcsim-application-v1 selector"
        });
      } else {
        if (
          entry.decision.icdTag !== entry.selector.icdTag
        ) {
          context.addIssue({
            code: "custom",
            path: ["decision", "icdTag"],
            message: "must equal selector.icdTag"
          });
        }
        if (
          entry.decision.groupId !== entry.selector.groupId
        ) {
          context.addIssue({
            code: "custom",
            path: ["decision", "groupId"],
            message: "must equal selector.groupId"
          });
        }
      }
    }
  }) satisfies z.ZodType<ElementalApplicationIcdLogEntryV147>;

const directDamageGroupLogCommonV146Shape = {
  id: nonNegativeIntegerSchema,
  damageEventId: nonNegativeIntegerSchema,
  hitResolutionLogId: nonNegativeIntegerSchema,
  frame: frameSchema,
  sourceActorId: nonEmptyStringSchema,
  targetId: nonEmptyStringSchema,
  hitId: nonEmptyStringSchema,
  profileId: z.literal(GCSIM_DAMAGE_GROUP_PROFILE_ID),
  configuredMultiplier: finiteNumberSchema,
  prePluginMultiplier: finiteNumberSchema,
  postPluginMultiplier: finiteNumberSchema,
  pluginMultiplierTrace: z.array(
    z
      .object({
        pluginManifestIndex: nonNegativeIntegerSchema,
        pluginId: nonEmptyStringSchema,
        inputMultiplier: finiteNumberSchema,
        outcome: z.enum(["no-change", "override"]),
        outputMultiplier: finiteNumberSchema
      })
      .strict()
  ),
  pluginTraceVerification: z.literal(
    DIRECT_DAMAGE_GROUP_PLUGIN_TRACE_VERIFICATION
  ),
  effectiveMultiplier: finiteNumberSchema,
  damageGroupOnEnemyHitAllowed: z.boolean()
} as const;

/**
 * Exact 1.46 ordinary direct-damage-group audit wire.
 *
 * Bypassed hits still own a row so the log has a reversible one-to-one
 * cardinality with landed ordinary direct DamageEvents. Stateful fields are
 * deliberately null for bypass rows rather than carrying plausible-looking
 * defaults that cannot be replayed.
 */
export const directDamageGroupLogEntryV146Schema =
  z.discriminatedUnion("evaluation", [
    z
      .object({
        ...directDamageGroupLogCommonV146Shape,
        evaluation: z.literal("bypassed"),
        icdTag: z.null(),
        icdGroup: z.null(),
        windowStartGroup: z.null(),
        resetFrames: z.null(),
        windowStartFrame: z.null(),
        resetAtFrame: z.null(),
        hitIndex: z.null(),
        sequenceIndex: z.null(),
        sequenceMultiplier: z.literal(1)
      })
      .strict(),
    z
      .object({
        ...directDamageGroupLogCommonV146Shape,
        evaluation: z.literal("evaluated"),
        icdTag: nonEmptyStringSchema,
        icdGroup: directDamageGroupIdSchema,
        windowStartGroup: directDamageGroupIdSchema,
        resetFrames: positiveIntegerSchema,
        windowStartFrame: frameSchema,
        resetAtFrame: frameSchema,
        hitIndex: nonNegativeIntegerSchema,
        sequenceIndex: nonNegativeIntegerSchema,
        sequenceMultiplier: z.union([
          z.literal(0),
          z.literal(1)
        ])
      })
      .strict()
  ]);

export const targetMechanicsTruncationLogEntryV142Schema = z
  .object({
    id: nonNegativeIntegerSchema,
    targetId: nonEmptyStringSchema,
    targetName: nonEmptyStringSchema,
    frame: frameSchema,
    timeSeconds: nonNegativeFiniteNumberSchema,
    sourceActorId: nonEmptyStringSchema,
    sourceActionId: nonEmptyStringSchema,
    hitId: nonEmptyStringSchema,
    triggerDamageEventId: nonNegativeIntegerSchema,
    unsupportedReactions: z
      .array(unsupportedMechanicsBranchSchema)
      .min(1),
    discardedAura: z.array(auraStateEntrySchema),
    reason: z.enum([
      "UNSUPPORTED_DENDRO_REACTION",
      "UNSUPPORTED_REACTION_ORDER"
    ])
  })
  .strict();

export const reactionDamageLogEntryV142Schema = z
  .object({
    id: nonNegativeIntegerSchema,
    reaction: transformativeReactionSchema,
    triggerDamageEventId:
      nonNegativeIntegerSchema.nullable(),
    triggerHitGroupId: nullableNonEmptyStringSchema,
    sourceActorId: nonEmptyStringSchema,
    sourceTargetId: nonEmptyStringSchema,
    triggerFrame: frameSchema,
    damageFrame: frameSchema,
    scheduled: z.boolean(),
    withinSimulation: z.boolean(),
    blockedReason: z
      .enum([
        "REACTION_DAMAGE_GCD",
        "REACTION_QUEUE_GCD",
        "TARGET_MECHANICS_TRUNCATION"
      ])
      .nullable(),
    nextAvailableFrame: nullableFrameSchema,
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
      "nearest-target-radius",
      "electro-charged-nearby-wet"
    ]),
    electroChargedPropagation:
      electroChargedPropagationAuditSchema.optional(),
    centerPosition: point2DSchema.nullable(),
    radius: nonNegativeFiniteNumberSchema,
    sourceCoreId: nonNegativeIntegerSchema.nullable(),
    sourceCoreLogId: nonNegativeIntegerSchema.nullable(),
    selectionRadius:
      nonNegativeFiniteNumberSchema.nullable(),
    selectedTargetId: nullableNonEmptyStringSchema,
    resolutionReason: z
      .literal("NO_TARGET_IN_RANGE")
      .nullable(),
    applicationGaugeUnits:
      nonNegativeFiniteNumberSchema.nullable(),
    excludedTargetIds: z.array(nonEmptyStringSchema),
    checkedTargetIds: z.array(nonEmptyStringSchema),
    hitTargetIds: z.array(nonEmptyStringSchema),
    unresolvedTargetIds: z.array(nonEmptyStringSchema),
    damageGroupBlockedTargetIds: z.array(
      nonEmptyStringSchema
    ),
    damageEventIds: z.array(nonNegativeIntegerSchema),
    playerHitResolutionLogIds: z.array(
      nonNegativeIntegerSchema
    ),
    playerDamageEventIds: z.array(nonNegativeIntegerSchema),
    reactionStatusLogIds: z.array(nonNegativeIntegerSchema),
    damageGroupDecisions: z.array(
      reactionDamageGroupAuditSchema
    )
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.damageFrame < entry.triggerFrame) {
      context.addIssue({
        code: "custom",
        path: ["damageFrame"],
        message: "must not precede triggerFrame"
      });
    }
    if (
      entry.targetingMode ===
        "electro-charged-nearby-wet" &&
      entry.electroChargedPropagation === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["electroChargedPropagation"],
        message:
          "nearby-Wet targeting requires a propagation audit"
      });
    }
    if (
      entry.targetingMode !==
        "electro-charged-nearby-wet" &&
      entry.electroChargedPropagation !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["electroChargedPropagation"],
        message:
          "propagation audit is reserved for nearby-Wet targeting"
      });
    }
  });

export const reactionStatusLogEntryV142Schema = z
  .object({
    id: nonNegativeIntegerSchema,
    reaction: transformativeReactionSchema,
    reactionDamageEventId: nonNegativeIntegerSchema,
    targetId: nonEmptyStringSchema,
    targetName: nonEmptyStringSchema,
    key: nonEmptyStringSchema,
    label: nonEmptyStringSchema,
    element: z.union([elementSchema, z.literal("all")]),
    resShred: finiteNumberSchema,
    startFrame: frameSchema,
    endFrame: frameSchema,
    startTimeSeconds: nonNegativeFiniteNumberSchema,
    endTimeSeconds: nonNegativeFiniteNumberSchema,
    operation: z.enum(["apply", "refresh"]),
    supersededAtFrame: nullableFrameSchema
  })
  .strict()
  .superRefine((entry, context) => {
    if (
      entry.endFrame < entry.startFrame ||
      (entry.endFrame === entry.startFrame &&
        entry.supersededAtFrame !== entry.startFrame)
    ) {
      context.addIssue({
        code: "custom",
        path: ["endFrame"],
        message:
          "must form a non-empty half-open interval unless superseded by a same-frame refresh"
      });
    }
    if (
      Math.abs(
        entry.startTimeSeconds - entry.startFrame / 60
      ) > 1e-9 ||
      Math.abs(entry.endTimeSeconds - entry.endFrame / 60) >
        1e-9
    ) {
      context.addIssue({
        code: "custom",
        path: ["startTimeSeconds"],
        message:
          "status times must equal their frame boundaries / 60"
      });
    }
    if (
      entry.supersededAtFrame !== null &&
      (entry.supersededAtFrame < entry.startFrame ||
        entry.supersededAtFrame > entry.endFrame)
    ) {
      context.addIssue({
        code: "custom",
        path: ["supersededAtFrame"],
        message: "must remain inside the recorded interval"
      });
    }
  });

export const periodicReactionLogEntryV142Schema = z
  .object({
    id: nonNegativeIntegerSchema,
    reaction: z.literal("electroCharged"),
    generation: positiveIntegerSchema,
    operation: z.enum([
      "start",
      "refresh",
      "tick",
      "tick-skipped",
      "wane",
      "wane-skipped",
      "stop"
    ]),
    frame: frameSchema,
    targetFrame: frameSchema.optional(),
    timeSeconds: nonNegativeFiniteNumberSchema,
    targetId: nonEmptyStringSchema,
    targetName: nonEmptyStringSchema,
    sourceActorId: nullableNonEmptyStringSchema,
    triggerDamageEventId:
      nonNegativeIntegerSchema.nullable(),
    reactionTaskLogId: nonNegativeIntegerSchema.optional(),
    reactionDamageLogId:
      nonNegativeIntegerSchema.nullable(),
    damageEventId: nonNegativeIntegerSchema.nullable(),
    tickIndex: nonNegativeIntegerSchema.nullable(),
    auraBefore: z.array(auraStateEntrySchema),
    auraConsumed: z.array(auraGaugeEntrySchema),
    auraAfter: z.array(auraStateEntrySchema),
    nextTickFrame: nullableFrameSchema,
    coexistenceExpiresAtFrame: nullableFrameSchema,
    waneFrame: nullableFrameSchema,
    reason: nullableNonEmptyStringSchema,
    cadenceStatus: z
      .enum(["scheduled", "dormant", "stopped"])
      .optional(),
    waneListenerActive: z.boolean().optional()
  })
  .strict()
  .superRefine((entry, context) => {
    if (
      Math.abs(entry.timeSeconds - entry.frame / 60) > 1e-9
    ) {
      context.addIssue({
        code: "custom",
        path: ["timeSeconds"],
        message: "must equal frame / 60"
      });
    }
    if (
      (entry.cadenceStatus === undefined) !==
      (entry.waneListenerActive === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["cadenceStatus"],
        message:
          "cadenceStatus and waneListenerActive must be present or omitted together"
      });
    }
    const operationOwnsTickIndex =
      entry.operation === "tick" ||
      entry.operation === "tick-skipped" ||
      entry.operation === "wane" ||
      entry.operation === "wane-skipped" ||
      (entry.operation === "stop" &&
        entry.waneFrame !== null);
    if (
      operationOwnsTickIndex !==
      (entry.tickIndex !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["tickIndex"],
        message:
          "tick and Wane callback operations require their owning tick index"
      });
    }
  });

export const frozenStateLogEntryV142Schema = z
  .object({
    id: nonNegativeIntegerSchema,
    reaction: z.enum([
      "freeze",
      "melt",
      "superconduct",
      "shatter",
      "swirlCryo",
      "crystallizeCryo"
    ]),
    generation: positiveIntegerSchema,
    operation: z.enum([
      "start",
      "refresh",
      "immune",
      "consume",
      "poise-consume",
      "shatter-consume",
      "expire"
    ]),
    frame: frameSchema,
    targetFrame: frameSchema.optional(),
    timeSeconds: nonNegativeFiniteNumberSchema,
    targetId: nonEmptyStringSchema,
    targetName: nonEmptyStringSchema,
    sourceActorId: nullableNonEmptyStringSchema,
    triggerDamageEventId:
      nonNegativeIntegerSchema.nullable(),
    freezeResistance: finiteNumberSchema.min(0).max(1),
    generatedGaugeUnits: nonNegativeFiniteNumberSchema,
    consumedGaugeUnits: nonNegativeFiniteNumberSchema,
    auraBefore: z.array(auraStateEntrySchema),
    auraAfter: z.array(auraStateEntrySchema),
    expiresAtFrame: nullableFrameSchema,
    expiresAtTargetFrame: nullableFrameSchema.optional(),
    reason: nullableNonEmptyStringSchema
  })
  .strict()
  .superRefine((entry, context) => {
    if (
      Math.abs(entry.timeSeconds - entry.frame / 60) > 1e-9
    ) {
      context.addIssue({
        code: "custom",
        path: ["timeSeconds"],
        message: "must equal frame / 60"
      });
    }
    const validOperation =
      (entry.reaction === "freeze" &&
        (entry.operation === "start" ||
          entry.operation === "refresh" ||
          entry.operation === "immune" ||
          entry.operation === "expire")) ||
      (entry.reaction === "shatter" &&
        (entry.operation === "poise-consume" ||
          entry.operation === "shatter-consume")) ||
      ((entry.reaction === "melt" ||
        entry.reaction === "superconduct" ||
        entry.reaction === "swirlCryo" ||
        entry.reaction === "crystallizeCryo") &&
        entry.operation === "consume");
    if (!validOperation) {
      context.addIssue({
        code: "custom",
        path: ["operation"],
        message: `operation ${entry.operation} is invalid for ${entry.reaction}`
      });
    }
  });

export const crystallizeShardLogEntryV142Schema = z
  .object({
    id: nonNegativeIntegerSchema,
    operation: z.enum([
      "spawn",
      "pickup-attempt",
      "pickup",
      "expire",
      "evict"
    ]),
    frame: frameSchema,
    timeSeconds: nonNegativeFiniteNumberSchema,
    shardId: nonNegativeIntegerSchema.nullable(),
    reaction: crystallizeReactionSchema.nullable(),
    element: z.union([auraElementSchema, z.literal("any")]),
    sourceActorId: nullableNonEmptyStringSchema,
    sourceTargetId: nullableNonEmptyStringSchema,
    triggerDamageEventId:
      nonNegativeIntegerSchema.nullable(),
    triggerFrame: nullableFrameSchema,
    spawnedAtFrame: nullableFrameSchema,
    earliestPickupFrame: nullableFrameSchema,
    expiresAtFrame: nullableFrameSchema,
    position: point2DSchema.nullable(),
    spawnRadius: nonNegativeFiniteNumberSchema.nullable(),
    spawnAngleDegrees: finiteNumberSchema.nullable(),
    sourceCharacterLevel: positiveIntegerSchema.nullable(),
    sourceElementalMastery:
      nonNegativeFiniteNumberSchema.nullable(),
    pickupCommandIndex: nonNegativeIntegerSchema.nullable(),
    pickedUpByActorId: nullableNonEmptyStringSchema,
    shieldLogId: nonNegativeIntegerSchema.nullable(),
    success: z.boolean(),
    reason: z
      .enum([
        "SPAWNED",
        "TOO_EARLY",
        "NO_MATCHING_SHARD",
        "PICKED_UP",
        "EXPIRED",
        "ACTIVE_SHARD_LIMIT"
      ])
      .nullable()
  })
  .strict()
  .superRefine((entry, context) => {
    if (
      Math.abs(entry.timeSeconds - entry.frame / 60) > 1e-9
    ) {
      context.addIssue({
        code: "custom",
        path: ["timeSeconds"],
        message: "must equal frame / 60"
      });
    }
    const hasShardSnapshot =
      entry.shardId !== null &&
      entry.reaction !== null &&
      entry.element !== "any" &&
      entry.sourceActorId !== null &&
      entry.sourceTargetId !== null &&
      entry.triggerDamageEventId !== null &&
      entry.triggerFrame !== null &&
      entry.spawnedAtFrame !== null &&
      entry.earliestPickupFrame !== null &&
      entry.expiresAtFrame !== null &&
      entry.spawnRadius !== null &&
      entry.spawnAngleDegrees !== null &&
      entry.sourceCharacterLevel !== null &&
      entry.sourceElementalMastery !== null;
    const expectedElement =
      entry.reaction === null
        ? null
        : {
            crystallizePyro: "pyro",
            crystallizeHydro: "hydro",
            crystallizeCryo: "cryo",
            crystallizeElectro: "electro"
          }[entry.reaction];
    if (
      expectedElement !== null &&
      entry.element !== expectedElement
    ) {
      context.addIssue({
        code: "custom",
        path: ["element"],
        message: `${entry.reaction} requires ${expectedElement}`
      });
    }
    if (entry.operation === "spawn") {
      if (
        !hasShardSnapshot ||
        !entry.success ||
        entry.reason !== "SPAWNED" ||
        entry.frame !== entry.spawnedAtFrame ||
        entry.pickupCommandIndex !== null ||
        entry.pickedUpByActorId !== null ||
        entry.shieldLogId !== null
      ) {
        context.addIssue({
          code: "custom",
          path: ["operation"],
          message:
            "spawn must emit one successful complete shard snapshot"
        });
      }
      return;
    }
    if (entry.operation === "pickup") {
      if (
        !hasShardSnapshot ||
        !entry.success ||
        entry.reason !== "PICKED_UP" ||
        entry.pickupCommandIndex === null ||
        entry.pickedUpByActorId === null ||
        entry.shieldLogId === null
      ) {
        context.addIssue({
          code: "custom",
          path: ["operation"],
          message:
            "pickup must emit a successful shard-to-shield transition"
        });
      }
      return;
    }
    if (entry.operation === "pickup-attempt") {
      const missingShardAttempt =
        entry.reason === "NO_MATCHING_SHARD" &&
        entry.shardId === null &&
        entry.reaction === null &&
        entry.sourceActorId === null &&
        entry.sourceTargetId === null &&
        entry.triggerDamageEventId === null;
      const tooEarlyAttempt =
        entry.reason === "TOO_EARLY" && hasShardSnapshot;
      if (
        entry.success ||
        entry.pickupCommandIndex === null ||
        entry.pickedUpByActorId === null ||
        entry.shieldLogId !== null ||
        (!missingShardAttempt && !tooEarlyAttempt)
      ) {
        context.addIssue({
          code: "custom",
          path: ["operation"],
          message:
            "pickup-attempt must describe TOO_EARLY or NO_MATCHING_SHARD"
        });
      }
      return;
    }
    const expectedReason =
      entry.operation === "expire"
        ? "EXPIRED"
        : "ACTIVE_SHARD_LIMIT";
    if (
      !hasShardSnapshot ||
      !entry.success ||
      entry.reason !== expectedReason ||
      entry.pickupCommandIndex !== null ||
      entry.pickedUpByActorId !== null ||
      entry.shieldLogId !== null ||
      (entry.operation === "expire" &&
        entry.frame !== entry.expiresAtFrame)
    ) {
      context.addIssue({
        code: "custom",
        path: ["operation"],
        message: `${entry.operation} must emit a successful terminal shard snapshot`
      });
    }
  });

export const targetPhaseTimelineEntryV142Schema = z
  .object({
    id: nonEmptyStringSchema,
    label: nonEmptyStringSchema,
    targetId: nonEmptyStringSchema,
    startFrame: frameSchema,
    endFrame: frameSchema,
    reason: nonEmptyStringSchema,
    effects: z
      .object({
        damage: z.enum(["normal", "immune"]),
        aura: z.enum(["normal", "blocked"]),
        hitConfirm: z.enum(["normal", "blocked"])
      })
      .strict(),
    startTimeSeconds: nonNegativeFiniteNumberSchema,
    endTimeSeconds: nonNegativeFiniteNumberSchema
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.endFrame <= entry.startFrame) {
      context.addIssue({
        code: "custom",
        path: ["endFrame"],
        message: "must form a non-empty half-open interval"
      });
    }
    if (
      Math.abs(
        entry.startTimeSeconds - entry.startFrame / 60
      ) > 1e-9 ||
      Math.abs(entry.endTimeSeconds - entry.endFrame / 60) >
        1e-9
    ) {
      context.addIssue({
        code: "custom",
        path: ["startTimeSeconds"],
        message:
          "timeline times must equal their frame boundaries / 60"
      });
    }
  });

export const targetMotionTimelineEntryV142Schema = z
  .object({
    id: nonEmptyStringSchema,
    label: nonEmptyStringSchema,
    targetId: nonEmptyStringSchema,
    startFrame: frameSchema,
    endFrame: frameSchema,
    endPosition: point2DSchema,
    startPosition: point2DSchema,
    startTimeSeconds: nonNegativeFiniteNumberSchema,
    endTimeSeconds: nonNegativeFiniteNumberSchema
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.endFrame <= entry.startFrame) {
      context.addIssue({
        code: "custom",
        path: ["endFrame"],
        message: "must form a non-empty movement interval"
      });
    }
    if (
      Math.abs(
        entry.startTimeSeconds - entry.startFrame / 60
      ) > 1e-9 ||
      Math.abs(entry.endTimeSeconds - entry.endFrame / 60) >
        1e-9
    ) {
      context.addIssue({
        code: "custom",
        path: ["startTimeSeconds"],
        message:
          "timeline times must equal their frame boundaries / 60"
      });
    }
  });

export const skippedActionV142Schema = z
  .object({
    time: nonNegativeFiniteNumberSchema,
    frame: frameSchema,
    actorId: nonEmptyStringSchema,
    actionId: nonEmptyStringSchema,
    action: nonEmptyStringSchema,
    reason: nonEmptyStringSchema,
    reasonCode: z.literal("INSUFFICIENT_ENERGY"),
    energyBefore: nonNegativeFiniteNumberSchema,
    energyCost: nonNegativeFiniteNumberSchema,
    cycle: nonNegativeIntegerSchema,
    timelineCommandIndex:
      nonNegativeIntegerSchema.optional(),
    sourceAbilityId: nonEmptyStringSchema.optional()
  })
  .strict();

export const actionLogEntryV142Schema = z
  .object({
    time: nonNegativeFiniteNumberSchema,
    frame: frameSchema,
    actorId: nonEmptyStringSchema,
    actionId: nonEmptyStringSchema,
    action: nonEmptyStringSchema,
    cycle: nonNegativeIntegerSchema,
    energyBefore: nonNegativeFiniteNumberSchema,
    energyAfter: nonNegativeFiniteNumberSchema,
    timelineCommandIndex:
      nonNegativeIntegerSchema.optional(),
    sourceAbilityId: nonEmptyStringSchema.optional(),
    cancelFrame: frameSchema.optional(),
    animationEndFrame: frameSchema.optional()
  })
  .strict();

export const energySummaryV142Schema = z
  .object({
    initial: nonNegativeFiniteNumberSchema,
    gained: nonNegativeFiniteNumberSchema,
    fixedGained: nonNegativeFiniteNumberSchema,
    particleGained: nonNegativeFiniteNumberSchema,
    wasted: nonNegativeFiniteNumberSchema,
    spent: nonNegativeFiniteNumberSchema,
    skipped: nonNegativeIntegerSchema,
    final: nonNegativeFiniteNumberSchema
  })
  .strict();

export const energyLogEntryV142Schema = z
  .object({
    id: nonNegativeIntegerSchema,
    kind: z.enum(["fixed", "particle"]),
    frame: frameSchema,
    timeSeconds: nonNegativeFiniteNumberSchema,
    sourceActorId: nonEmptyStringSchema,
    sourceActionId: nonEmptyStringSchema,
    source: nonEmptyStringSchema,
    receiverId: nonEmptyStringSchema,
    activeCharacterId: nullableNonEmptyStringSchema,
    isOnField: z.boolean(),
    energyBefore: nonNegativeFiniteNumberSchema,
    rawEnergy: nonNegativeFiniteNumberSchema,
    finalEnergy: nonNegativeFiniteNumberSchema,
    gainedEnergy: nonNegativeFiniteNumberSchema,
    wastedEnergy: nonNegativeFiniteNumberSchema,
    energyAfter: nonNegativeFiniteNumberSchema,
    spawnFrame: nullableFrameSchema,
    receiveFrame: frameSchema,
    particleElement: particleElementSchema.nullable(),
    particleKind: particleKindSchema.nullable(),
    particleCount: nonNegativeFiniteNumberSchema.nullable(),
    isSameElement: z.boolean().nullable(),
    energyRecharge: nonNegativeFiniteNumberSchema,
    fieldMultiplier: nonNegativeFiniteNumberSchema,
    baseEnergyPerParticle:
      nonNegativeFiniteNumberSchema.nullable(),
    applied: z.boolean(),
    blockedReason: z
      .literal("INTERNAL_COOLDOWN")
      .nullable(),
    internalCooldownKey: nullableNonEmptyStringSchema,
    internalCooldownDurationFrames: nullableFrameSchema,
    internalCooldownReadyFrame: nullableFrameSchema
  })
  .strict();

export const particleEventLogV142Schema = z
  .object({
    id: nonNegativeIntegerSchema,
    sourceActorId: nonEmptyStringSchema,
    sourceActionId: nonEmptyStringSchema,
    source: nonEmptyStringSchema,
    particleId: nonEmptyStringSchema,
    spawnFrame: frameSchema,
    receiveFrame: frameSchema,
    spawnTimeSeconds: nonNegativeFiniteNumberSchema,
    receiveTimeSeconds: nonNegativeFiniteNumberSchema,
    particleElement: particleElementSchema,
    particleKind: particleKindSchema,
    particleCount: nonNegativeFiniteNumberSchema,
    receivedWithinSimulation: z.boolean(),
    cycle: nonNegativeIntegerSchema,
    triggerLogId: nonNegativeIntegerSchema.nullable(),
    triggerHitId: nullableNonEmptyStringSchema
  })
  .strict();

export const particleTriggerLogEntryV142Schema = z
  .object({
    id: nonNegativeIntegerSchema,
    frame: frameSchema,
    timeSeconds: nonNegativeFiniteNumberSchema,
    cycle: nonNegativeIntegerSchema,
    sourceActorId: nonEmptyStringSchema,
    sourceActionId: nonEmptyStringSchema,
    source: nonEmptyStringSchema,
    particleId: nonEmptyStringSchema,
    hitId: nonEmptyStringSchema,
    hitGroupId: nonEmptyStringSchema,
    checkedTargetIds: z.array(nonEmptyStringSchema),
    confirmedTargetIds: z.array(nonEmptyStringSchema),
    triggered: z.boolean(),
    blockedReason: z
      .enum([
        "INTERNAL_COOLDOWN",
        "TARGET_MISS",
        "TARGET_HIT_CONFIRM_BLOCKED"
      ])
      .nullable(),
    internalCooldownKey: nullableNonEmptyStringSchema,
    internalCooldownDurationFrames: nullableFrameSchema,
    internalCooldownReadyFrame: nullableFrameSchema
  })
  .strict();

export const energyCurvePointV142Schema = z
  .object({
    id: nonNegativeIntegerSchema,
    frame: frameSchema,
    timeSeconds: nonNegativeFiniteNumberSchema,
    kind: z.enum([
      "initial",
      "spend",
      "fixed",
      "fixed-blocked",
      "particle"
    ]),
    receiverId: nullableNonEmptyStringSchema,
    source: nonEmptyStringSchema,
    energyByCharacter: nonNegativeFiniteRecordSchema
  })
  .strict();

export const skillSummaryV142Schema = z
  .object({
    creditId: nonEmptyStringSchema,
    actionName: nonEmptyStringSchema,
    damage: nonNegativeFiniteNumberSchema,
    hits: nonNegativeIntegerSchema,
    dps: nonNegativeFiniteNumberSchema,
    share: nonNegativeFiniteNumberSchema
  })
  .strict();

export const characterDamageSummaryV142Schema = z
  .object({
    characterId: nonEmptyStringSchema,
    damage: nonNegativeFiniteNumberSchema,
    hits: nonNegativeIntegerSchema,
    dps: nonNegativeFiniteNumberSchema,
    share: nonNegativeFiniteNumberSchema
  })
  .strict();

export const enemyTargetDamageSummaryV142Schema = z
  .object({
    targetId: nonEmptyStringSchema,
    targetName: nonEmptyStringSchema,
    damage: nonNegativeFiniteNumberSchema,
    potentialDamage: nonNegativeFiniteNumberSchema,
    damageEvents: nonNegativeIntegerSchema,
    landedChecks: nonNegativeIntegerSchema,
    missedChecks: nonNegativeIntegerSchema,
    immuneDamageEvents: nonNegativeIntegerSchema,
    dps: nonNegativeFiniteNumberSchema,
    share: nonNegativeFiniteNumberSchema
  })
  .strict();

export const damageCurvePointV142Schema = z
  .object({
    damageEventId: nonNegativeIntegerSchema,
    targetId: nonEmptyStringSchema,
    targetName: nonEmptyStringSchema,
    frame: frameSchema,
    timeSeconds: nonNegativeFiniteNumberSchema,
    sourceActorId: nonEmptyStringSchema,
    creditOwnerId: nonEmptyStringSchema,
    finalDamage: nonNegativeFiniteNumberSchema,
    cumulativeDamage: nonNegativeFiniteNumberSchema,
    cumulativeByCharacter: nonNegativeFiniteRecordSchema,
    cumulativeByComponent: damageCompositionV142Schema,
    cumulativeByReaction: z.partialRecord(
      transformativeReactionSchema,
      nonNegativeFiniteNumberSchema
    )
  })
  .strict();

export const auraTimelinePointV142Schema = z
  .object({
    damageEventId: nonNegativeIntegerSchema,
    eventPriority: nonNegativeFiniteNumberSchema,
    eventSequence: nonNegativeIntegerSchema,
    targetId: nonEmptyStringSchema,
    targetName: nonEmptyStringSchema,
    frame: frameSchema,
    timeSeconds: nonNegativeFiniteNumberSchema,
    sourceActorId: nonEmptyStringSchema,
    actionId: nonEmptyStringSchema,
    hitId: nonEmptyStringSchema,
    incomingElement: elementSchema,
    icdAllowed: z.boolean().nullable(),
    reaction: reactionTypeSchema,
    reactions: z.array(reactionTypeSchema),
    unsupportedReactions: z.array(
      unsupportedMechanicsBranchSchema
    ),
    mechanicsTruncation:
      targetMechanicsTruncationAuditV142Schema.nullable(),
    auraBefore: z.array(auraStateEntrySchema),
    auraApplied: z.array(auraGaugeEntrySchema),
    auraConsumed: z.array(auraGaugeEntrySchema),
    auraAfter: z.array(auraStateEntrySchema)
  })
  .strict();

export const auraEndStateV142Schema = z
  .object({
    targetId: nonEmptyStringSchema,
    targetName: nonEmptyStringSchema,
    frame: frameSchema,
    timeSeconds: nonNegativeFiniteNumberSchema,
    aura: z.array(auraStateEntrySchema)
  })
  .strict();

export const timelineStateLogEntryV142Schema = z
  .object({
    sequence: nonNegativeIntegerSchema,
    frame: frameSchema,
    timeSeconds: nonNegativeFiniteNumberSchema,
    operation: z.enum([
      "grant",
      "replace",
      "consume",
      "clear",
      "expire"
    ]),
    actorId: nonEmptyStringSchema,
    statusKey: nonEmptyStringSchema,
    label: nonEmptyStringSchema,
    expiresAtFrame: frameSchema,
    commandIndex: nonNegativeIntegerSchema,
    abilityId: nonEmptyStringSchema
  })
  .strict();

export const timelineFailureV142Schema = z
  .object({
    commandIndex: nonNegativeIntegerSchema,
    code: z.enum([
      "ACTION_OVERLAP",
      "ABILITY_ON_COOLDOWN",
      "INSUFFICIENT_ENERGY",
      "UNKNOWN_ABILITY",
      "WRONG_ACTIVE_CHARACTER",
      "ALREADY_ACTIVE",
      "MISSING_REQUIRED_STATE",
      "OUT_OF_DURATION"
    ]),
    frame: frameSchema,
    message: nonEmptyStringSchema,
    energyBefore: nonNegativeFiniteNumberSchema.optional(),
    energyCost: nonNegativeFiniteNumberSchema.optional()
  })
  .strict();

export const timelineAdjustmentV142Schema = z
  .object({
    commandIndex: nonNegativeIntegerSchema,
    code: z.enum(["ACTION_OVERLAP", "ABILITY_ON_COOLDOWN"]),
    requestedFrame: frameSchema,
    executedFrame: frameSchema,
    waitedFrames: nonNegativeIntegerSchema,
    message: nonEmptyStringSchema
  })
  .strict();

export const timelineCommandResultV142Schema = z
  .object({
    commandIndex: nonNegativeIntegerSchema,
    commandType: z.enum([
      "wait",
      "swap",
      "skill",
      "burst",
      "normal",
      "charge",
      "dash",
      "jump",
      "pickUpCrystallize"
    ]),
    actorId: nullableNonEmptyStringSchema,
    abilityId: nullableNonEmptyStringSchema,
    requestedFrame: frameSchema,
    startFrame: nullableFrameSchema,
    cancelFrame: nullableFrameSchema,
    animationEndFrame: nullableFrameSchema,
    endFrame: nullableFrameSchema,
    status: z.enum(["executed", "waited", "rejected"]),
    waitedFrames: nonNegativeIntegerSchema,
    failureCode: z
      .enum([
        "ACTION_OVERLAP",
        "ABILITY_ON_COOLDOWN",
        "INSUFFICIENT_ENERGY",
        "UNKNOWN_ABILITY",
        "WRONG_ACTIVE_CHARACTER",
        "ALREADY_ACTIVE",
        "MISSING_REQUIRED_STATE",
        "OUT_OF_DURATION"
      ])
      .optional(),
    energyBefore: nonNegativeFiniteNumberSchema.optional(),
    energyCost: nonNegativeFiniteNumberSchema.optional()
  })
  .strict();

export const timelineExecutionV142Schema = z
  .object({
    mode: z.literal("legal-frame-v1"),
    fps: z.literal(60),
    legalityMode: z.enum(["strict", "wait"]),
    initialActiveCharacterId: nonEmptyStringSchema,
    finalActiveCharacterId: nonEmptyStringSchema,
    totalFrames: nonNegativeIntegerSchema,
    commandResults: z.array(
      timelineCommandResultV142Schema
    ),
    adjustments: z.array(timelineAdjustmentV142Schema),
    failures: z.array(timelineFailureV142Schema),
    stateLog: z.array(timelineStateLogEntryV142Schema)
  })
  .strict();

export const simulationResultV142ValueSchema = z
  .object({
    schemaVersion: z.literal(
      EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION
    ),
    engineVersion: z.literal(
      EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION
    ),
    dataVersion: nonEmptyStringSchema,
    randomSeed: nonEmptyStringSchema,
    runManifest: simulationRunManifestV142Schema,
    resolvedRuntimeOptions:
      resolvedSimulationRuntimeOptionsSchema,
    pluginManifest: z.array(
      damagePluginManifestEntrySchema
    ),
    reproducibilityKey: nonEmptyStringSchema,
    compatibilityMode: z.enum([
      "legacy-v0.1",
      "legal-frame-v1"
    ]),
    mechanicsStatus: z.enum(["complete", "partial"]),
    config: simConfigV142Schema,
    actorPoses: z.array(actorPoseDefinitionSchema),
    enemyTargets: z.array(resolvedEnemyTargetProfileSchema),
    damageEvents: z.array(damageEventV142Schema),
    hitEvents: z.array(damageEventV142Schema),
    hitResolutionLog: z.array(
      hitResolutionLogEntryV142Schema
    ),
    targetClockAudit: targetClockAuditSchema,
    targetClockLog: targetClockLogSchema,
    targetHitlagLog: targetHitlagLogSchema,
    targetTaskPhaseLog: targetTaskPhaseLogSchema,
    targetPhaseLog: targetPhaseV2LogSchema,
    targetMechanicsTruncationLog: z.array(
      targetMechanicsTruncationLogEntryV142Schema
    ),
    reactionDamageLog: z.array(
      reactionDamageLogEntryV142Schema
    ),
    reactionTaskLog: reactionTaskLogSchema,
    reactionStatusLog: z.array(
      reactionStatusLogEntryV142Schema
    ),
    periodicReactionLog: z.array(
      periodicReactionLogEntryV142Schema
    ),
    frozenStateLog: z.array(frozenStateLogEntryV142Schema),
    quickenStateLog: z.array(quickenStateLogEntrySchema),
    burningStateLog: z.array(burningStateLogEntrySchema),
    dendroCoreLog: dendroCoreLogSchema,
    dendroCoreContactLog: dendroCoreContactLogSchema,
    dendroCoreTimeline: dendroCoreTimelineSchema,
    crystallizeShardLog: z.array(
      crystallizeShardLogEntryV142Schema
    ),
    crystallizeShieldLog: z.array(
      crystallizeShieldLogEntrySchema
    ),
    crystallizeShieldTimeline: z.array(
      crystallizeShieldTimelinePointSchema
    ),
    playerHitResolutionLog: z.array(
      playerHitResolutionLogEntrySchema
    ),
    playerDamageEvents: z.array(playerDamageEventSchema),
    playerHpTimeline: playerHpTimelineSchema,
    playerHpSummaries: z.array(playerHpSummarySchema),
    playerSelfDamageStatus: playerSelfDamageStatusSchema,
    totalPlayerDamageTaken: nonNegativeFiniteNumberSchema,
    totalReactionSelfDamageTaken:
      nonNegativeFiniteNumberSchema,
    targetPhaseTimeline: z.array(
      targetPhaseTimelineEntryV142Schema
    ),
    targetMotionTimeline: z.array(
      targetMotionTimelineEntryV142Schema
    ),
    skippedActions: z.array(skippedActionV142Schema),
    actionLog: z.array(actionLogEntryV142Schema),
    energyStats: z.record(
      nonEmptyStringSchema,
      energySummaryV142Schema
    ),
    energyLog: z.array(energyLogEntryV142Schema),
    particleEvents: z.array(particleEventLogV142Schema),
    particleTriggerLog: z.array(
      particleTriggerLogEntryV142Schema
    ),
    energyCurve: z.array(energyCurvePointV142Schema),
    totalDamage: nonNegativeFiniteNumberSchema,
    dps: nonNegativeFiniteNumberSchema,
    reactedHits: nonNegativeIntegerSchema,
    byCharacter: nonNegativeFiniteRecordSchema,
    characterSummaries: z.array(
      characterDamageSummaryV142Schema
    ),
    targetSummaries: z.array(
      enemyTargetDamageSummaryV142Schema
    ),
    bySkill: z.array(skillSummaryV142Schema),
    perSecond: z.array(nonNegativeFiniteRecordSchema),
    damageCurve: z.array(damageCurvePointV142Schema),
    auraTimeline: z.array(auraTimelinePointV142Schema),
    targetStateTimeline: targetStateTimelineSchema,
    auraInitialStates: z.array(auraEndStateV142Schema),
    auraEndStates: z.array(auraEndStateV142Schema),
    timelineExecution:
      timelineExecutionV142Schema.optional()
  })
  .strict()
  .superRefine((result, context) => {
    const issue = (
      path: Array<string | number>,
      message: string
    ): void =>
      context.addIssue({ code: "custom", path, message });
    if (
      result.engineVersion !== result.config.engineVersion
    ) {
      issue(
        ["engineVersion"],
        "must equal config.engineVersion"
      );
    }
    if (result.dataVersion !== result.config.dataVersion) {
      issue(
        ["dataVersion"],
        "must equal config.dataVersion"
      );
    }
    if (
      result.randomSeed !==
      result.resolvedRuntimeOptions.randomSeed
    ) {
      issue(
        ["randomSeed"],
        "must equal resolvedRuntimeOptions.randomSeed"
      );
    }
    if (
      result.compatibilityMode !==
      result.resolvedRuntimeOptions.compatibilityMode
    ) {
      issue(
        ["compatibilityMode"],
        "must equal resolvedRuntimeOptions.compatibilityMode"
      );
    }
    if (
      result.reproducibilityKey !==
      result.runManifest.reproducibilityKey
    ) {
      issue(
        ["reproducibilityKey"],
        "must equal runManifest.reproducibilityKey"
      );
    }
    if (
      JSON.stringify(result.pluginManifest) !==
      JSON.stringify(result.runManifest.plugins)
    ) {
      issue(
        ["pluginManifest"],
        "must equal runManifest.plugins"
      );
    }
    const validateFacet = (
      label: string,
      schema: z.ZodType
    ): void => {
      const parsed = schema.safeParse(result);
      if (parsed.success) return;
      for (const facetIssue of parsed.error.issues) {
        context.addIssue({
          code: "custom",
          path: [...facetIssue.path],
          message: `${label}: ${facetIssue.message}`
        });
      }
    };
    validateFacet(
      "enemy target references",
      enemyTargetsResultReferencesSchema
    );
    validateFacet(
      "reaction delivery references",
      reactionDeliveryResultReferencesSchema
    );
    validateFacet(
      "target task phase references",
      targetTaskPhaseResultReferencesSchema
    );
    validateFacet(
      "target phase v2 references",
      targetPhaseV2ResultReferencesSchema
    );
    validateFacet(
      "player damage references",
      playerDamageResultReferencesSchema
    );
    validateFacet(
      "target clock references",
      targetClockResultReferencesSchema
    );
    const auraMode = result.config.reactionEngine?.mode;
    if (
      auraMode === "aura-v5" ||
      auraMode === "aura-v6" ||
      auraMode === "aura-v7" ||
      auraMode === "aura-v8" ||
      auraMode === "aura-v9"
    ) {
      validateFacet(
        "Dendro core references",
        dendroCoreResultReferencesSchema
      );
    }
    if (
      (auraMode === "aura-v8" || auraMode === "aura-v9") &&
      (result.reactionTaskLog.some(
        (task) => task.electroChargedCleanup !== null
      ) ||
        result.periodicReactionLog.some(
          (entry) => entry.reaction === "electroCharged"
        ))
    ) {
      validateFacet(
        "Electro-Charged cleanup references",
        electroChargedCleanupResultReferencesSchema
      );
    }
    validateSimulationResultV142Integrity(
      result as unknown as SimulationResult,
      context
    );
  });

export const simulationResultV142Schema = z.preprocess(
  rejectNonPlainJsonWire("SimulationResult 1.42"),
  simulationResultV142ValueSchema
);

export type SimulationResultV142 = z.output<
  typeof simulationResultV142Schema
>;

/**
 * Exact 1.44 result wire. The top-level field set is inherited from the
 * frozen 1.42 shape, but identity, config, run manifest, and target-phase
 * ownership are replaced explicitly. Reading `.shape` does not reuse the
 * 1.42 refinements, so the frozen validator remains identity-exact.
 */
export const simulationResultV144ValueSchema = z
  .object({
    ...simulationResultV142ValueSchema.shape,
    schemaVersion: z.literal(
      BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION
    ),
    engineVersion: z.literal(
      BURNING_CALLBACK_DELIVERY_ENGINE_VERSION
    ),
    runManifest: simulationRunManifestV144Schema,
    config: simConfigV144Schema,
    targetPhaseLog: z.union([
      targetPhaseV2LogSchema,
      targetPhaseV3LogSchema
    ])
  })
  .strict()
  .superRefine((result, context) => {
    const issue = (
      path: Array<string | number>,
      message: string
    ): void =>
      context.addIssue({ code: "custom", path, message });
    if (
      result.engineVersion !== result.config.engineVersion
    ) {
      issue(
        ["engineVersion"],
        "must equal config.engineVersion"
      );
    }
    if (result.dataVersion !== result.config.dataVersion) {
      issue(
        ["dataVersion"],
        "must equal config.dataVersion"
      );
    }
    if (
      result.randomSeed !==
      result.resolvedRuntimeOptions.randomSeed
    ) {
      issue(
        ["randomSeed"],
        "must equal resolvedRuntimeOptions.randomSeed"
      );
    }
    if (
      result.compatibilityMode !==
      result.resolvedRuntimeOptions.compatibilityMode
    ) {
      issue(
        ["compatibilityMode"],
        "must equal resolvedRuntimeOptions.compatibilityMode"
      );
    }
    if (
      result.reproducibilityKey !==
      result.runManifest.reproducibilityKey
    ) {
      issue(
        ["reproducibilityKey"],
        "must equal runManifest.reproducibilityKey"
      );
    }
    if (
      JSON.stringify(result.pluginManifest) !==
      JSON.stringify(result.runManifest.plugins)
    ) {
      issue(
        ["pluginManifest"],
        "must equal runManifest.plugins"
      );
    }
    const validateFacet = (
      label: string,
      schema: z.ZodType
    ): void => {
      const parsed = schema.safeParse(result);
      if (parsed.success) return;
      for (const facetIssue of parsed.error.issues) {
        context.addIssue({
          code: "custom",
          path: [...facetIssue.path],
          message: `${label}: ${facetIssue.message}`
        });
      }
    };
    validateFacet(
      "enemy target references",
      enemyTargetsResultReferencesSchema
    );
    validateFacet(
      "reaction delivery references",
      reactionDeliveryResultReferencesSchema
    );
    validateFacet(
      "target task phase references",
      targetTaskPhaseResultReferencesSchema
    );
    if (
      result.config.targetTaskModel.mode !==
      "target-phase-v3"
    ) {
      validateFacet(
        "target phase v2 references",
        targetPhaseV2ResultReferencesSchema
      );
    }
    validateFacet(
      "player damage references",
      playerDamageResultReferencesSchema
    );
    validateFacet(
      "target clock references",
      targetClockResultReferencesSchema
    );
    const auraMode = result.config.reactionEngine?.mode;
    if (
      auraMode === "aura-v5" ||
      auraMode === "aura-v6" ||
      auraMode === "aura-v7" ||
      auraMode === "aura-v8" ||
      auraMode === "aura-v9"
    ) {
      validateFacet(
        "Dendro core references",
        dendroCoreResultReferencesSchema
      );
    }
    if (
      (auraMode === "aura-v8" || auraMode === "aura-v9") &&
      (result.reactionTaskLog.some(
        (task) => task.electroChargedCleanup !== null
      ) ||
        result.periodicReactionLog.some(
          (entry) => entry.reaction === "electroCharged"
        ))
    ) {
      validateFacet(
        "Electro-Charged cleanup references",
        electroChargedCleanupResultReferencesSchema
      );
    }
    validateSimulationResultV144Integrity(
      result as unknown as SimulationResult,
      context
    );
  });

export const simulationResultV144Schema = z.preprocess(
  rejectNonPlainJsonWire("SimulationResult 1.44"),
  simulationResultV144ValueSchema
);

export type SimulationResultV144 = z.output<
  typeof simulationResultV144Schema
>;

/**
 * Exact 1.45 result wire. The event/timeline fields remain byte-compatible
 * with 1.44; only the versioned config and manifest identities advance. The
 * fixed-profile integrity pass derives formula inputs from compiled data.
 */
export const simulationResultV145ValueSchema = z
  .object({
    ...simulationResultV144ValueSchema.shape,
    schemaVersion: z.literal(
      REACTION_FORMULA_ROOT_SCHEMA_VERSION
    ),
    engineVersion: z.literal(
      REACTION_FORMULA_ROOT_ENGINE_VERSION
    ),
    runManifest: simulationRunManifestV145Schema,
    config: simConfigV145Schema
  })
  .strict()
  .superRefine((result, context) => {
    const issue = (
      path: Array<string | number>,
      message: string
    ): void =>
      context.addIssue({ code: "custom", path, message });
    if (
      result.engineVersion !== result.config.engineVersion
    ) {
      issue(
        ["engineVersion"],
        "must equal config.engineVersion"
      );
    }
    if (result.dataVersion !== result.config.dataVersion) {
      issue(
        ["dataVersion"],
        "must equal config.dataVersion"
      );
    }
    if (
      result.randomSeed !==
      result.resolvedRuntimeOptions.randomSeed
    ) {
      issue(
        ["randomSeed"],
        "must equal resolvedRuntimeOptions.randomSeed"
      );
    }
    if (
      result.compatibilityMode !==
      result.resolvedRuntimeOptions.compatibilityMode
    ) {
      issue(
        ["compatibilityMode"],
        "must equal resolvedRuntimeOptions.compatibilityMode"
      );
    }
    if (
      result.reproducibilityKey !==
      result.runManifest.reproducibilityKey
    ) {
      issue(
        ["reproducibilityKey"],
        "must equal runManifest.reproducibilityKey"
      );
    }
    if (
      JSON.stringify(result.pluginManifest) !==
      JSON.stringify(result.runManifest.plugins)
    ) {
      issue(
        ["pluginManifest"],
        "must equal runManifest.plugins"
      );
    }
    const validateFacet = (
      label: string,
      schema: z.ZodType
    ): void => {
      const parsed = schema.safeParse(result);
      if (parsed.success) return;
      for (const facetIssue of parsed.error.issues) {
        context.addIssue({
          code: "custom",
          path: [...facetIssue.path],
          message: `${label}: ${facetIssue.message}`
        });
      }
    };
    validateFacet(
      "enemy target references",
      enemyTargetsResultReferencesSchema
    );
    validateFacet(
      "reaction delivery references",
      reactionDeliveryResultReferencesSchema
    );
    validateFacet(
      "target task phase references",
      targetTaskPhaseResultReferencesSchema
    );
    if (
      result.config.targetTaskModel.mode !==
      "target-phase-v3"
    ) {
      validateFacet(
        "target phase v2 references",
        targetPhaseV2ResultReferencesSchema
      );
    }
    validateFacet(
      "player damage references",
      playerDamageResultReferencesSchema
    );
    validateFacet(
      "target clock references",
      targetClockResultReferencesSchema
    );
    const auraMode = result.config.reactionEngine?.mode;
    if (
      auraMode === "aura-v5" ||
      auraMode === "aura-v6" ||
      auraMode === "aura-v7" ||
      auraMode === "aura-v8" ||
      auraMode === "aura-v9"
    ) {
      validateFacet(
        "Dendro core references",
        dendroCoreResultReferencesSchema
      );
    }
    if (
      (auraMode === "aura-v8" || auraMode === "aura-v9") &&
      (result.reactionTaskLog.some(
        (task) => task.electroChargedCleanup !== null
      ) ||
        result.periodicReactionLog.some(
          (entry) => entry.reaction === "electroCharged"
        ))
    ) {
      validateFacet(
        "Electro-Charged cleanup references",
        electroChargedCleanupResultReferencesSchema
      );
    }
    validateSimulationResultV145Integrity(
      result as unknown as SimulationResult,
      context
    );
  });

export const simulationResultV145Schema = z.preprocess(
  rejectNonPlainJsonWire("SimulationResult 1.45"),
  simulationResultV145ValueSchema
);

export type SimulationResultV145 = z.output<
  typeof simulationResultV145Schema
>;

/**
 * Exact frozen 1.46 result wire. All inherited 1.45 fields remain exact;
 * this boundary adds only the fixed direct-damage-group identity and the
 * required replay log.
 */
export const simulationResultV146ValueSchema = z
  .object({
    ...simulationResultV145ValueSchema.shape,
    schemaVersion: z.literal(
      DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION
    ),
    engineVersion: z.literal(
      DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION
    ),
    runManifest: simulationRunManifestV146Schema,
    config: simConfigV146Schema,
    directDamageGroupLog: z.array(
      directDamageGroupLogEntryV146Schema
    )
  })
  .strict()
  .superRefine((result, context) => {
    const issue = (
      path: Array<string | number>,
      message: string
    ): void =>
      context.addIssue({ code: "custom", path, message });
    if (
      result.engineVersion !== result.config.engineVersion
    ) {
      issue(
        ["engineVersion"],
        "must equal config.engineVersion"
      );
    }
    if (result.dataVersion !== result.config.dataVersion) {
      issue(
        ["dataVersion"],
        "must equal config.dataVersion"
      );
    }
    if (
      result.randomSeed !==
      result.resolvedRuntimeOptions.randomSeed
    ) {
      issue(
        ["randomSeed"],
        "must equal resolvedRuntimeOptions.randomSeed"
      );
    }
    if (
      result.compatibilityMode !==
      result.resolvedRuntimeOptions.compatibilityMode
    ) {
      issue(
        ["compatibilityMode"],
        "must equal resolvedRuntimeOptions.compatibilityMode"
      );
    }
    if (
      result.reproducibilityKey !==
      result.runManifest.reproducibilityKey
    ) {
      issue(
        ["reproducibilityKey"],
        "must equal runManifest.reproducibilityKey"
      );
    }
    if (
      JSON.stringify(result.pluginManifest) !==
      JSON.stringify(result.runManifest.plugins)
    ) {
      issue(
        ["pluginManifest"],
        "must equal runManifest.plugins"
      );
    }
    const validateFacet = (
      label: string,
      schema: z.ZodType
    ): void => {
      const parsed = schema.safeParse(result);
      if (parsed.success) return;
      for (const facetIssue of parsed.error.issues) {
        context.addIssue({
          code: "custom",
          path: [...facetIssue.path],
          message: `${label}: ${facetIssue.message}`
        });
      }
    };
    validateFacet(
      "enemy target references",
      enemyTargetsResultReferencesSchema
    );
    validateFacet(
      "reaction delivery references",
      reactionDeliveryResultReferencesSchema
    );
    validateFacet(
      "target task phase references",
      targetTaskPhaseResultReferencesSchema
    );
    if (
      result.config.targetTaskModel.mode !==
      "target-phase-v3"
    ) {
      validateFacet(
        "target phase v2 references",
        targetPhaseV2ResultReferencesSchema
      );
    }
    validateFacet(
      "player damage references",
      playerDamageResultReferencesSchema
    );
    validateFacet(
      "target clock references",
      targetClockResultReferencesSchema
    );
    const auraMode = result.config.reactionEngine?.mode;
    if (
      auraMode === "aura-v5" ||
      auraMode === "aura-v6" ||
      auraMode === "aura-v7" ||
      auraMode === "aura-v8" ||
      auraMode === "aura-v9"
    ) {
      validateFacet(
        "Dendro core references",
        dendroCoreResultReferencesSchema
      );
    }
    if (
      (auraMode === "aura-v8" || auraMode === "aura-v9") &&
      (result.reactionTaskLog.some(
        (task) => task.electroChargedCleanup !== null
      ) ||
        result.periodicReactionLog.some(
          (entry) => entry.reaction === "electroCharged"
        ))
    ) {
      validateFacet(
        "Electro-Charged cleanup references",
        electroChargedCleanupResultReferencesSchema
      );
    }
    validateSimulationResultV146Integrity(
      result as unknown as SimulationResult,
      context
    );
  });

export const simulationResultV146Schema = z.preprocess(
  rejectNonPlainJsonWire("SimulationResult 1.46"),
  simulationResultV146ValueSchema
);

export type SimulationResultV146 = z.output<
  typeof simulationResultV146Schema
>;

/**
 * Exact current 1.47 result wire. The frozen 1.46 shape is copied before the
 * new identity and required application-ICD log are introduced, so parsing a
 * historical result never starts accepting 1.47-only fields.
 */
export const simulationResultV147ValueSchema = z
  .object({
    ...simulationResultV146ValueSchema.shape,
    schemaVersion: z.literal(
      ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION
    ),
    engineVersion: z.literal(
      ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION
    ),
    runManifest: simulationRunManifestV147Schema,
    config: simConfigV147Schema,
    elementalApplicationIcdLog: z.array(
      elementalApplicationIcdLogEntryV147Schema
    )
  })
  .strict()
  .superRefine((result, context) => {
    const issue = (
      path: Array<string | number>,
      message: string
    ): void =>
      context.addIssue({ code: "custom", path, message });
    if (
      result.engineVersion !== result.config.engineVersion
    ) {
      issue(
        ["engineVersion"],
        "must equal config.engineVersion"
      );
    }
    if (result.dataVersion !== result.config.dataVersion) {
      issue(
        ["dataVersion"],
        "must equal config.dataVersion"
      );
    }
    if (
      result.randomSeed !==
      result.resolvedRuntimeOptions.randomSeed
    ) {
      issue(
        ["randomSeed"],
        "must equal resolvedRuntimeOptions.randomSeed"
      );
    }
    if (
      result.compatibilityMode !==
      result.resolvedRuntimeOptions.compatibilityMode
    ) {
      issue(
        ["compatibilityMode"],
        "must equal resolvedRuntimeOptions.compatibilityMode"
      );
    }
    if (
      result.reproducibilityKey !==
      result.runManifest.reproducibilityKey
    ) {
      issue(
        ["reproducibilityKey"],
        "must equal runManifest.reproducibilityKey"
      );
    }
    if (
      JSON.stringify(result.pluginManifest) !==
      JSON.stringify(result.runManifest.plugins)
    ) {
      issue(
        ["pluginManifest"],
        "must equal runManifest.plugins"
      );
    }
    const validateFacet = (
      label: string,
      schema: z.ZodType
    ): void => {
      const parsed = schema.safeParse(result);
      if (parsed.success) return;
      for (const facetIssue of parsed.error.issues) {
        context.addIssue({
          code: "custom",
          path: [...facetIssue.path],
          message: `${label}: ${facetIssue.message}`
        });
      }
    };
    validateFacet(
      "enemy target references",
      enemyTargetsResultReferencesSchema
    );
    validateFacet(
      "reaction delivery references",
      reactionDeliveryResultReferencesSchema
    );
    validateFacet(
      "target task phase references",
      targetTaskPhaseResultReferencesSchema
    );
    if (
      result.config.targetTaskModel.mode !==
      "target-phase-v3"
    ) {
      validateFacet(
        "target phase v2 references",
        targetPhaseV2ResultReferencesSchema
      );
    }
    validateFacet(
      "player damage references",
      playerDamageResultReferencesSchema
    );
    validateFacet(
      "target clock references",
      targetClockResultReferencesSchema
    );
    const auraMode = result.config.reactionEngine?.mode;
    if (
      auraMode === "aura-v5" ||
      auraMode === "aura-v6" ||
      auraMode === "aura-v7" ||
      auraMode === "aura-v8" ||
      auraMode === "aura-v9"
    ) {
      validateFacet(
        "Dendro core references",
        dendroCoreResultReferencesSchema
      );
    }
    if (
      (auraMode === "aura-v8" || auraMode === "aura-v9") &&
      (result.reactionTaskLog.some(
        (task) => task.electroChargedCleanup !== null
      ) ||
        result.periodicReactionLog.some(
          (entry) => entry.reaction === "electroCharged"
        ))
    ) {
      validateFacet(
        "Electro-Charged cleanup references",
        electroChargedCleanupResultReferencesSchema
      );
    }
    validateSimulationResultV147Integrity(
      result as unknown as SimulationResult,
      context
    );
  });

export const simulationResultV147Schema = z.preprocess(
  rejectNonPlainJsonWire("SimulationResult 1.47"),
  simulationResultV147ValueSchema
);

export type SimulationResultV147 = z.output<
  typeof simulationResultV147Schema
>;

/* ------------------------------------------------------------------------- */
/* 1.48 reaction-owned elemental-application result wire                     */
/* ------------------------------------------------------------------------- */

const trustedReactionApplicationSelectorBaseShape = {
  mode: z.literal(
    "fixed-gcsim-reaction-owned-application-v1"
  ),
  policyId: z.literal(
    GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID
  )
} as const;

export const burningTickElementalApplicationSelectorV148Schema =
  z
    .object({
      ...trustedReactionApplicationSelectorBaseShape,
      channel: z
        .object({ kind: z.literal("burning-tick") })
        .strict()
    })
    .strict();

const swirlPropagationElementV148Schema = z.enum([
  "pyro",
  "hydro",
  "cryo",
  "electro"
]);

export const swirlPropagationElementalApplicationSelectorV148Schema =
  z
    .object({
      ...trustedReactionApplicationSelectorBaseShape,
      channel: z
        .object({
          kind: z.literal("swirl-propagation"),
          element: swirlPropagationElementV148Schema
        })
        .strict()
    })
    .strict();

/** A reaction-owned attempt which was never presented to an ICD window. */
export const reactionOwnedElementalApplicationSkippedDecisionV148Schema =
  z
    .object({
      kind: z.literal("skipped"),
      evaluated: z.literal(false),
      reason: z.enum([
        "miss",
        "target-aura-blocked",
        "mechanics-truncated"
      ]),
      consumed: z.literal(false),
      applicationMultiplier: z.literal(0),
      allowed: z.literal(false)
    })
    .strict() satisfies z.ZodType<ReactionOwnedElementalApplicationIcdSkippedDecisionV148>;

/**
 * Complete numeric decision emitted by the trusted reaction-owned state
 * machine. Reserved groups remain unavailable to configured direct hits.
 */
const elementalApplicationReactionFixedGcsimDecisionCommonV148Shape =
  {
    kind: z.literal("reaction-fixed-gcsim"),
    evaluated: z.literal(true),
    consumed: z.literal(true),
    applicationMultiplier: nonNegativeFiniteNumberSchema,
    allowed: z.boolean(),
    policyId: z.literal(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_V1_ID
    ),
    profileId: z.literal(
      GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID
    ),
    windowStartFrame: nonNegativeSafeIntegerSchema,
    resetAtFrame: nonNegativeSafeIntegerSchema,
    hitIndex: nonNegativeSafeIntegerSchema,
    sequenceIndex: nonNegativeSafeIntegerSchema,
    tailPolicy: z.literal("clamp"),
    resetSchedulePolicy: z.literal(
      "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one"
    )
  } as const;

export const elementalApplicationReactionFixedGcsimDecisionV148Schema =
  z
    .discriminatedUnion("groupId", [
      z
        .object({
          ...elementalApplicationReactionFixedGcsimDecisionCommonV148Shape,
          scope: z.literal(
            "trusted-target-global-burning-projection"
          ),
          icdTag: z.literal("ICDTagBurningDamage"),
          groupId: z.literal("burning"),
          windowStartGroupId: z.literal("burning"),
          resetFrames: z.literal(120)
        })
        .strict(),
      z
        .object({
          ...elementalApplicationReactionFixedGcsimDecisionCommonV148Shape,
          scope: z.literal("actor-tag"),
          icdTag: z.enum([
            "ICDTagSwirlPyro",
            "ICDTagSwirlHydro",
            "ICDTagSwirlCryo",
            "ICDTagSwirlElectro"
          ]),
          groupId: z.literal("reaction-a"),
          windowStartGroupId: z.literal("reaction-a"),
          resetFrames: z.literal(30)
        })
        .strict()
    ])
    .superRefine((decision, context) => {
      const issue = (
        path: Array<string | number>,
        message: string
      ): void =>
        context.addIssue({ code: "custom", path, message });
      if (
        decision.allowed !==
        decision.applicationMultiplier > 0
      ) {
        issue(
          ["allowed"],
          "must equal applicationMultiplier > 0"
        );
      }
      const expectedResetAtFrame =
        decision.windowStartFrame +
        decision.resetFrames -
        1;
      if (
        !Number.isSafeInteger(expectedResetAtFrame) ||
        decision.resetAtFrame !== expectedResetAtFrame
      ) {
        issue(
          ["resetAtFrame"],
          "must equal windowStartFrame + resetFrames - 1"
        );
      }
      if (decision.sequenceIndex > decision.hitIndex) {
        issue(["sequenceIndex"], "cannot exceed hitIndex");
      }

      const isBurning = decision.groupId === "burning";
      const expectedFinalSequenceIndex = isBurning ? 7 : 9;
      const expectedSequenceIndex = Math.min(
        decision.hitIndex,
        expectedFinalSequenceIndex
      );
      if (
        decision.sequenceIndex !== expectedSequenceIndex
      ) {
        issue(
          ["sequenceIndex"],
          "must equal the clamped trusted sequence index"
        );
      }
      const expectedMultiplier =
        isBurning && expectedSequenceIndex > 0 ? 0 : 1;
      if (
        decision.applicationMultiplier !==
        expectedMultiplier
      ) {
        issue(
          ["applicationMultiplier"],
          "must equal the trusted fixed sequence multiplier"
        );
      }
    }) satisfies z.ZodType<ElementalApplicationReactionFixedGcsimDecisionV148>;

export const reactionOwnedElementalApplicationIcdDecisionV148Schema =
  z.discriminatedUnion("kind", [
    reactionOwnedElementalApplicationSkippedDecisionV148Schema,
    elementalApplicationReactionFixedGcsimDecisionV148Schema
  ]);

const reactionOwnedElementalApplicationLogCommonV148Shape =
  {
    id: nonNegativeSafeIntegerSchema,
    reactionDamageLogId: nonNegativeSafeIntegerSchema,
    hitResolutionLogId: nonNegativeSafeIntegerSchema,
    damageEventId: nonNegativeSafeIntegerSchema.nullable(),
    frame: nonNegativeSafeIntegerSchema,
    eventPriority: nonNegativeFiniteNumberSchema,
    eventSequence: nonNegativeSafeIntegerSchema,
    attemptIndex: nonNegativeSafeIntegerSchema,
    attemptCount: positiveSafeIntegerSchema,
    deliveryPhase: z.enum([
      "reaction-damage-event",
      "before-reactable-tick",
      "after-reactable-tick"
    ]),
    sourceActorId: nonEmptyStringSchema,
    targetId: nonEmptyStringSchema,
    hitId: nonEmptyStringSchema,
    hitGroupId: nonEmptyStringSchema,
    nominalGaugeUnits: positiveFiniteNumberSchema,
    effectiveGaugeUnits: nonNegativeFiniteNumberSchema,
    decision:
      reactionOwnedElementalApplicationIcdDecisionV148Schema
  } as const;

type ReactionOwnedApplicationRowForLocalValidation = {
  sourceKind: "burning-tick" | "swirl-propagation";
  frame: number;
  attemptIndex: number;
  attemptCount: number;
  deliveryPhase:
    | "reaction-damage-event"
    | "before-reactable-tick"
    | "after-reactable-tick";
  damageEventId: number | null;
  element: "pyro" | "hydro" | "cryo" | "electro";
  nominalGaugeUnits: number;
  effectiveGaugeUnits: number;
  selector:
    | {
        channel: { kind: "burning-tick" };
      }
    | {
        channel: {
          kind: "swirl-propagation";
          element: "pyro" | "hydro" | "cryo" | "electro";
        };
      };
  decision:
    | ReactionOwnedElementalApplicationIcdSkippedDecisionV148
    | ElementalApplicationReactionFixedGcsimDecisionV149;
};

function validateReactionOwnedApplicationRowLocalIdentities(
  entry: ReactionOwnedApplicationRowForLocalValidation,
  context: z.RefinementCtx
): void {
  const issue = (
    path: Array<string | number>,
    message: string
  ): void =>
    context.addIssue({ code: "custom", path, message });

  if (entry.attemptIndex >= entry.attemptCount) {
    issue(
      ["attemptIndex"],
      "must be less than attemptCount"
    );
  }
  if (
    entry.sourceKind === "swirl-propagation" &&
    entry.deliveryPhase !== "reaction-damage-event"
  ) {
    issue(
      ["deliveryPhase"],
      "Swirl propagation must use reaction-damage-event delivery"
    );
  }

  const missed =
    entry.decision.kind === "skipped" &&
    entry.decision.reason === "miss";
  if (missed && entry.damageEventId !== null) {
    issue(
      ["damageEventId"],
      "misses cannot own damage output"
    );
  }
  if (!missed && entry.damageEventId === null) {
    issue(
      ["damageEventId"],
      "landed reaction-owned attempts require a damage event"
    );
  }

  const expectedEffectiveGaugeUnits =
    entry.nominalGaugeUnits *
    entry.decision.applicationMultiplier;
  const gaugeTolerance =
    1e-12 *
    Math.max(1, Math.abs(expectedEffectiveGaugeUnits));
  if (
    !Number.isFinite(expectedEffectiveGaugeUnits) ||
    Math.abs(
      entry.effectiveGaugeUnits -
        expectedEffectiveGaugeUnits
    ) > gaugeTolerance
  ) {
    issue(
      ["effectiveGaugeUnits"],
      "must approximately equal nominalGaugeUnits * decision.applicationMultiplier"
    );
  }

  if (entry.decision.kind === "skipped") return;

  const isBurning = entry.sourceKind === "burning-tick";
  const expectedScope = isBurning
    ? "trusted-target-global-burning-projection"
    : "actor-tag";
  const expectedGroup = isBurning
    ? "burning"
    : "reaction-a";
  const expectedResetFrames = isBurning ? 120 : 30;
  const expectedIcdTag = isBurning
    ? "ICDTagBurningDamage"
    : `ICDTagSwirl${entry.element[0]!.toUpperCase() + entry.element.slice(1)}`;

  if (entry.decision.scope !== expectedScope) {
    issue(
      ["decision", "scope"],
      `must equal ${expectedScope}`
    );
  }
  if (entry.decision.icdTag !== expectedIcdTag) {
    issue(
      ["decision", "icdTag"],
      "must equal the trusted source channel ICD tag"
    );
  }
  if (entry.decision.groupId !== expectedGroup) {
    issue(
      ["decision", "groupId"],
      `must equal ${expectedGroup}`
    );
  }
  if (entry.decision.windowStartGroupId !== expectedGroup) {
    issue(
      ["decision", "windowStartGroupId"],
      `must equal ${expectedGroup}`
    );
  }
  if (entry.decision.resetFrames !== expectedResetFrames) {
    issue(
      ["decision", "resetFrames"],
      `must equal ${expectedResetFrames}`
    );
  }
  const attemptBeforeBoundaryReset =
    entry.sourceKind === "burning-tick" &&
    entry.decision.resetSchedulePolicy ===
      "provisional-attempt-before-core-reset-at-window-start-plus-reset-frames-minus-one";
  if (
    entry.decision.windowStartFrame > entry.frame ||
    (attemptBeforeBoundaryReset
      ? entry.decision.resetAtFrame < entry.frame
      : entry.decision.resetAtFrame <= entry.frame)
  ) {
    issue(
      ["decision", "windowStartFrame"],
      "active window must start no later than this frame and reset after it"
    );
  }

  const finalSequenceIndex = isBurning ? 7 : 9;
  const expectedSequenceIndex = Math.min(
    entry.decision.hitIndex,
    finalSequenceIndex
  );
  if (
    entry.decision.sequenceIndex !== expectedSequenceIndex
  ) {
    issue(
      ["decision", "sequenceIndex"],
      "must equal the clamped trusted sequence index"
    );
  }
  const expectedMultiplier =
    isBurning && expectedSequenceIndex > 0 ? 0 : 1;
  if (
    entry.decision.applicationMultiplier !==
    expectedMultiplier
  ) {
    issue(
      ["decision", "applicationMultiplier"],
      "must equal the trusted fixed sequence multiplier"
    );
  }
}

export const burningTickElementalApplicationIcdLogEntryV148Schema =
  z
    .object({
      ...reactionOwnedElementalApplicationLogCommonV148Shape,
      sourceKind: z.literal("burning-tick"),
      selector:
        burningTickElementalApplicationSelectorV148Schema,
      element: z.literal("pyro")
    })
    .strict()
    .superRefine((entry, context) => {
      if (entry.nominalGaugeUnits !== 1) {
        context.addIssue({
          code: "custom",
          path: ["nominalGaugeUnits"],
          message:
            "Burning tick application Gauge is fixed at 1U"
        });
      }
      validateReactionOwnedApplicationRowLocalIdentities(
        entry,
        context
      );
    }) satisfies z.ZodType<BurningElementalApplicationIcdLogEntryV148>;

export const swirlPropagationElementalApplicationIcdLogEntryV148Schema =
  z
    .object({
      ...reactionOwnedElementalApplicationLogCommonV148Shape,
      sourceKind: z.literal("swirl-propagation"),
      selector:
        swirlPropagationElementalApplicationSelectorV148Schema,
      element: swirlPropagationElementV148Schema
    })
    .strict()
    .superRefine((entry, context) => {
      if (
        entry.selector.channel.element !== entry.element
      ) {
        context.addIssue({
          code: "custom",
          path: ["selector", "channel", "element"],
          message: "must equal the propagated element"
        });
      }
      validateReactionOwnedApplicationRowLocalIdentities(
        entry,
        context
      );
    }) satisfies z.ZodType<SwirlPropagationElementalApplicationIcdLogEntryV148>;

const trustedReactionApplicationSelectorV2BaseShape = {
  mode: z.literal(
    "fixed-gcsim-reaction-owned-application-v2"
  ),
  policyId: z.literal(
    GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID
  )
} as const;

export const burningTickElementalApplicationSelectorV149Schema =
  z
    .object({
      ...trustedReactionApplicationSelectorV2BaseShape,
      channel: z
        .object({ kind: z.literal("burning-tick") })
        .strict()
    })
    .strict();

export const swirlPropagationElementalApplicationSelectorV149Schema =
  z
    .object({
      ...trustedReactionApplicationSelectorV2BaseShape,
      channel: z
        .object({
          kind: z.literal("swirl-propagation"),
          element: swirlPropagationElementV148Schema
        })
        .strict()
    })
    .strict();

const elementalApplicationReactionFixedGcsimDecisionCommonV149Shape =
  {
    kind: z.literal("reaction-fixed-gcsim"),
    evaluated: z.literal(true),
    consumed: z.literal(true),
    applicationMultiplier: nonNegativeFiniteNumberSchema,
    allowed: z.boolean(),
    policyId: z.literal(
      GCSIM_REACTION_OWNED_APPLICATION_POLICY_ID
    ),
    profileId: z.literal(
      GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID
    ),
    windowStartFrame: nonNegativeSafeIntegerSchema,
    resetAtFrame: nonNegativeSafeIntegerSchema,
    hitIndex: nonNegativeSafeIntegerSchema,
    sequenceIndex: nonNegativeSafeIntegerSchema,
    tailPolicy: z.literal("clamp")
  } as const;

export const elementalApplicationReactionFixedGcsimDecisionV149Schema =
  z
    .discriminatedUnion("groupId", [
      z
        .object({
          ...elementalApplicationReactionFixedGcsimDecisionCommonV149Shape,
          scope: z.literal(
            "trusted-target-global-burning-projection"
          ),
          icdTag: z.literal("ICDTagBurningDamage"),
          groupId: z.literal("burning"),
          windowStartGroupId: z.literal("burning"),
          resetFrames: z.literal(120),
          resetSchedulePolicy: z.literal(
            "provisional-attempt-before-core-reset-at-window-start-plus-reset-frames-minus-one"
          )
        })
        .strict(),
      z
        .object({
          ...elementalApplicationReactionFixedGcsimDecisionCommonV149Shape,
          scope: z.literal("actor-tag"),
          icdTag: z.enum([
            "ICDTagSwirlPyro",
            "ICDTagSwirlHydro",
            "ICDTagSwirlCryo",
            "ICDTagSwirlElectro"
          ]),
          groupId: z.literal("reaction-a"),
          windowStartGroupId: z.literal("reaction-a"),
          resetFrames: z.literal(30),
          resetSchedulePolicy: z.literal(
            "provisional-reset-before-attempt-at-window-start-plus-reset-frames-minus-one"
          )
        })
        .strict()
    ])
    .superRefine((decision, context) => {
      const issue = (
        path: Array<string | number>,
        message: string
      ): void =>
        context.addIssue({ code: "custom", path, message });
      if (
        decision.allowed !==
        decision.applicationMultiplier > 0
      ) {
        issue(
          ["allowed"],
          "must equal applicationMultiplier > 0"
        );
      }
      const expectedResetAtFrame =
        decision.windowStartFrame +
        decision.resetFrames -
        1;
      if (
        !Number.isSafeInteger(expectedResetAtFrame) ||
        decision.resetAtFrame !== expectedResetAtFrame
      ) {
        issue(
          ["resetAtFrame"],
          "must equal windowStartFrame + resetFrames - 1"
        );
      }
      if (decision.sequenceIndex > decision.hitIndex) {
        issue(["sequenceIndex"], "cannot exceed hitIndex");
      }
      const isBurning = decision.groupId === "burning";
      const expectedSequenceIndex = Math.min(
        decision.hitIndex,
        isBurning ? 7 : 9
      );
      if (
        decision.sequenceIndex !== expectedSequenceIndex
      ) {
        issue(
          ["sequenceIndex"],
          "must equal the clamped trusted sequence index"
        );
      }
      const expectedMultiplier =
        isBurning && expectedSequenceIndex > 0 ? 0 : 1;
      if (
        decision.applicationMultiplier !==
        expectedMultiplier
      ) {
        issue(
          ["applicationMultiplier"],
          "must equal the trusted fixed sequence multiplier"
        );
      }
    });

export const reactionOwnedElementalApplicationIcdDecisionV149Schema =
  z.union([
    reactionOwnedElementalApplicationIcdDecisionV148Schema,
    elementalApplicationReactionFixedGcsimDecisionV149Schema
  ]);

const reactionOwnedElementalApplicationLogCommonV149Shape =
  {
    ...reactionOwnedElementalApplicationLogCommonV148Shape,
    decision: z.union([
      reactionOwnedElementalApplicationSkippedDecisionV148Schema,
      elementalApplicationReactionFixedGcsimDecisionV149Schema
    ])
  } as const;

const burningTickElementalApplicationIcdLogEntryV149OnlySchema =
  z
    .object({
      ...reactionOwnedElementalApplicationLogCommonV149Shape,
      sourceKind: z.literal("burning-tick"),
      selector:
        burningTickElementalApplicationSelectorV149Schema,
      element: z.literal("pyro")
    })
    .strict()
    .superRefine((entry, context) => {
      if (entry.nominalGaugeUnits !== 1) {
        context.addIssue({
          code: "custom",
          path: ["nominalGaugeUnits"],
          message:
            "Burning tick application Gauge is fixed at 1U"
        });
      }
      validateReactionOwnedApplicationRowLocalIdentities(
        entry,
        context
      );
    });

const swirlPropagationElementalApplicationIcdLogEntryV149OnlySchema =
  z
    .object({
      ...reactionOwnedElementalApplicationLogCommonV149Shape,
      sourceKind: z.literal("swirl-propagation"),
      selector:
        swirlPropagationElementalApplicationSelectorV149Schema,
      element: swirlPropagationElementV148Schema
    })
    .strict()
    .superRefine((entry, context) => {
      if (
        entry.selector.channel.element !== entry.element
      ) {
        context.addIssue({
          code: "custom",
          path: ["selector", "channel", "element"],
          message: "must equal the propagated element"
        });
      }
      validateReactionOwnedApplicationRowLocalIdentities(
        entry,
        context
      );
    });

export const burningTickElementalApplicationIcdLogEntryV149Schema =
  z.union([
    burningTickElementalApplicationIcdLogEntryV148Schema,
    burningTickElementalApplicationIcdLogEntryV149OnlySchema
  ]) satisfies z.ZodType<BurningElementalApplicationIcdLogEntryV149>;

export const swirlPropagationElementalApplicationIcdLogEntryV149Schema =
  z.union([
    swirlPropagationElementalApplicationIcdLogEntryV148Schema,
    swirlPropagationElementalApplicationIcdLogEntryV149OnlySchema
  ]) satisfies z.ZodType<SwirlPropagationElementalApplicationIcdLogEntryV149>;

/** Exact unified 1.48 log union; the configured-direct branch is 1.47. */
export const elementalApplicationIcdLogEntryV148Schema =
  z.discriminatedUnion("sourceKind", [
    elementalApplicationIcdLogEntryV147Schema,
    burningTickElementalApplicationIcdLogEntryV148Schema,
    swirlPropagationElementalApplicationIcdLogEntryV148Schema
  ]) satisfies z.ZodType<ElementalApplicationIcdLogEntryV148>;

export const elementalApplicationIcdLogEntryV149Schema =
  z.union([
    elementalApplicationIcdLogEntryV147Schema,
    burningTickElementalApplicationIcdLogEntryV149Schema,
    swirlPropagationElementalApplicationIcdLogEntryV149Schema
  ]) satisfies z.ZodType<ElementalApplicationIcdLogEntryV149>;

const basicReactionSchedulerLogEntryCommonShape = {
  id: nonNegativeSafeIntegerSchema,
  frame: frameSchema,
  timeSeconds: nonNegativeFiniteNumberSchema,
  eventPriority: finiteNumberSchema,
  eventSequence: nonNegativeSafeIntegerSchema,
  parentEventSequence: nonNegativeSafeIntegerSchema,
  reactionDamageLogId: nonNegativeSafeIntegerSchema,
  hitResolutionLogId: nonNegativeSafeIntegerSchema,
  elementalApplicationIcdLogId:
    nonNegativeSafeIntegerSchema.nullable(),
  sourceActorId: nonEmptyStringSchema,
  targetId: nonEmptyStringSchema,
  element: swirlPropagationElementV148Schema,
  reaction: reactionTypeSchema,
  reactions: z.array(reactionTypeSchema),
  auraBefore: z.array(auraStateEntrySchema),
  auraApplied: z.array(auraGaugeEntrySchema),
  auraConsumed: z.array(auraGaugeEntrySchema),
  auraAfter: z.array(auraStateEntrySchema)
} as const;

/** The propagation attack resolves damage and any nested reactions first. */
export const basicReactionSchedulerSwirlAttackResolutionLogEntrySchema =
  z
    .union([
      z
        .object({
          ...basicReactionSchedulerLogEntryCommonShape,
          kind: z.literal("swirl-attack-resolution"),
          disposition: z.literal("legacy-immediate"),
          pairedLogId: z.null()
        })
        .strict(),
      z
        .object({
          ...basicReactionSchedulerLogEntryCommonShape,
          kind: z.literal("swirl-attack-resolution"),
          disposition: z.literal("deferred"),
          pairedLogId: nonNegativeSafeIntegerSchema
        })
        .strict(),
      z
        .object({
          ...basicReactionSchedulerLogEntryCommonShape,
          kind: z.literal("swirl-attack-resolution"),
          disposition: z.literal("not-attached"),
          pairedLogId: z.null()
        })
        .strict()
    ])
    .superRefine((entry, context) => {
      if (
        entry.parentEventSequence !== entry.eventSequence
      ) {
        context.addIssue({
          code: "custom",
          path: ["parentEventSequence"],
          message:
            "an attack row must own itself: parentEventSequence must equal eventSequence"
        });
      }
      if (entry.timeSeconds !== entry.frame / 60) {
        context.addIssue({
          code: "custom",
          path: ["timeSeconds"],
          message: "must equal frame / 60"
        });
      }
    });

/** The zero-delay child task commits only the previously deferred Aura. */
export const basicReactionSchedulerDeferredAuraAttachmentLogEntrySchema =
  z
    .object({
      ...basicReactionSchedulerLogEntryCommonShape,
      kind: z.literal("deferred-aura-attachment"),
      disposition: z.literal("committed"),
      pairedLogId: nonNegativeSafeIntegerSchema
    })
    .strict()
    .superRefine((entry, context) => {
      if (
        entry.eventSequence <= entry.parentEventSequence
      ) {
        context.addIssue({
          code: "custom",
          path: ["eventSequence"],
          message:
            "a deferred commit must execute after its parent attack sequence"
        });
      }
      if (entry.timeSeconds !== entry.frame / 60) {
        context.addIssue({
          code: "custom",
          path: ["timeSeconds"],
          message: "must equal frame / 60"
        });
      }
    });

/** Strict public wire for the 1.51 attack/commit scheduler proof. */
export const basicReactionSchedulerLogEntrySchema = z.union(
  [
    basicReactionSchedulerSwirlAttackResolutionLogEntrySchema,
    basicReactionSchedulerDeferredAuraAttachmentLogEntrySchema
  ]
);

function forwardSchemaIssues(
  label: string,
  parsed: z.ZodSafeParseResult<unknown>,
  context: z.RefinementCtx
): void {
  if (parsed.success) return;
  for (const nestedIssue of parsed.error.issues) {
    context.addIssue({
      code: "custom",
      path: [...nestedIssue.path],
      message: `${label}: ${nestedIssue.message}`
    });
  }
}

/** 1.48 damage event; all 1.47 fields remain exact. */
export const damageEventV148Schema = z
  .object({
    ...damageEventV142Schema.shape,
    elementalApplicationIcdLogId:
      nonNegativeSafeIntegerSchema.nullable()
  })
  .strict()
  .superRefine((event, context) => {
    const {
      elementalApplicationIcdLogId:
        _elementalApplicationIcdLogId,
      ...frozenEvent
    } = event;
    forwardSchemaIssues(
      "frozen 1.47 damage event",
      damageEventV142Schema.safeParse(frozenEvent),
      context
    );
  });

/** 1.48 target resolution with reciprocal reaction/application links. */
export const hitResolutionLogEntryV148Schema = z
  .object({
    ...hitResolutionLogEntryV142Schema.shape,
    reactionDamageLogId:
      nonNegativeSafeIntegerSchema.nullable(),
    elementalApplicationIcdLogId:
      nonNegativeSafeIntegerSchema.nullable()
  })
  .strict()
  .superRefine((entry, context) => {
    const {
      reactionDamageLogId: _reactionDamageLogId,
      elementalApplicationIcdLogId:
        _elementalApplicationIcdLogId,
      ...frozenEntry
    } = entry;
    forwardSchemaIssues(
      "frozen 1.47 hit resolution",
      hitResolutionLogEntryV142Schema.safeParse(
        frozenEntry
      ),
      context
    );
    if (
      (entry.resolutionKind === "reaction-damage") !==
      (entry.reactionDamageLogId !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["reactionDamageLogId"],
        message:
          "must be present exactly for reaction-damage resolutions"
      });
    }
  });

/** 1.48 reaction owner with deterministic reciprocal target-attempt arrays. */
export const reactionDamageLogEntryV148Schema = z
  .object({
    ...reactionDamageLogEntryV142Schema.shape,
    hitResolutionLogIds: z.array(
      nonNegativeSafeIntegerSchema
    ),
    elementalApplicationIcdLogIds: z.array(
      nonNegativeSafeIntegerSchema
    )
  })
  .strict()
  .superRefine((entry, context) => {
    const {
      hitResolutionLogIds: _hitResolutionLogIds,
      elementalApplicationIcdLogIds:
        _elementalApplicationIcdLogIds,
      ...frozenEntry
    } = entry;
    forwardSchemaIssues(
      "frozen 1.47 reaction damage row",
      reactionDamageLogEntryV142Schema.safeParse(
        frozenEntry
      ),
      context
    );
    for (const [field, ids] of [
      ["hitResolutionLogIds", entry.hitResolutionLogIds],
      [
        "elementalApplicationIcdLogIds",
        entry.elementalApplicationIcdLogIds
      ]
    ] as const) {
      if (new Set(ids).size !== ids.length) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "must not contain duplicate ids"
        });
      }
    }
  });

const reactionDamageGroupReactionV150Schema = z.enum([
  "swirlPyro",
  "swirlHydro",
  "swirlCryo",
  "swirlElectro",
  "shatter",
  "superconduct",
  "bloom",
  "burgeon",
  "hyperbloom",
  "overload",
  "electroCharged"
]);

const reactionDamageGroupIcdTagV150Schema = z.enum([
  "ICDTagSwirlPyro",
  "ICDTagSwirlHydro",
  "ICDTagSwirlCryo",
  "ICDTagSwirlElectro",
  "ICDTagShatter",
  "ICDTagSuperconductDamage",
  "ICDTagBloomDamage",
  "ICDTagBurgeonDamage",
  "ICDTagHyperbloomDamage",
  "ICDTagOverloadDamage",
  "ICDTagECDamage"
]);

const reactionDamageGroupDecisionCommonV150Shape = {
  profileId: z.literal(GCSIM_DAMAGE_GROUP_PROFILE_ID),
  icdTag: reactionDamageGroupIcdTagV150Schema,
  sourceActorId: nonEmptyStringSchema,
  targetId: nonEmptyStringSchema,
  scopeKey: nonEmptyStringSchema,
  frame: nonNegativeSafeIntegerSchema,
  damageGroupTaskSequence: nonNegativeSafeIntegerSchema,
  windowGeneration: nonNegativeSafeIntegerSchema,
  windowStartFrame: nonNegativeSafeIntegerSchema,
  resetAtFrame: nonNegativeSafeIntegerSchema,
  hitIndex: nonNegativeSafeIntegerSchema,
  sequenceIndex: nonNegativeSafeIntegerSchema,
  sequenceMultiplier: z.union([z.literal(0), z.literal(1)]),
  damageAllowed: z.boolean()
} as const;

const reactionDamageGroupPolicyV1DecisionV150Shape = {
  policyId: z.literal(GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID),
  resetTaskLogId: z.null(),
  resetTaskSequence: z.null()
} as const;

const reactionDamageGroupPolicyV2DecisionV150Shape = {
  policyId: z.literal(GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID),
  resetTaskLogId: nonNegativeSafeIntegerSchema,
  resetTaskSequence: nonNegativeSafeIntegerSchema
} as const;

const reactionADamageGroupDecisionV150Shape = {
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
  icdGroup: z.literal("reaction-a"),
  blockedReason: z.literal("REACTION_A_DAMAGE_ICD").nullable()
} as const;

const reactionBDamageGroupDecisionV150Shape = {
  reaction: z.enum(["overload", "electroCharged"]),
  icdGroup: z.literal("reaction-b"),
  blockedReason: z.literal("REACTION_B_DAMAGE_ICD").nullable()
} as const;

const reactionDamageGroupDecisionVariantsV150 = [
  z
    .object({
      ...reactionDamageGroupDecisionCommonV150Shape,
      ...reactionDamageGroupPolicyV1DecisionV150Shape,
      ...reactionADamageGroupDecisionV150Shape
    })
    .strict(),
  z
    .object({
      ...reactionDamageGroupDecisionCommonV150Shape,
      ...reactionDamageGroupPolicyV1DecisionV150Shape,
      ...reactionBDamageGroupDecisionV150Shape
    })
    .strict(),
  z
    .object({
      ...reactionDamageGroupDecisionCommonV150Shape,
      ...reactionDamageGroupPolicyV2DecisionV150Shape,
      ...reactionADamageGroupDecisionV150Shape
    })
    .strict(),
  z
    .object({
      ...reactionDamageGroupDecisionCommonV150Shape,
      ...reactionDamageGroupPolicyV2DecisionV150Shape,
      ...reactionBDamageGroupDecisionV150Shape
    })
    .strict()
] as const;

function refineReactionDamageGroupDecisionV150(
  decision: ReactionDamageGroupDecisionAuditV150,
  context: z.RefinementCtx
): void {
  const issue = (path: string, message: string): void => {
    context.addIssue({ code: "custom", path: [path], message });
  };
  const binding = resolveReactionDamageGroupBindingForPolicy(
    decision.policyId,
    decision.reaction
  );
  const group = resolveDamageGroup(binding.groupId);
  const expectedScopeKey = JSON.stringify([
    decision.targetId,
    decision.sourceActorId,
    binding.icdTag
  ]);
  const expectedResetAtFrame =
    decision.windowStartFrame +
    (decision.policyId ===
    GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID
      ? group.resetFrames
      : group.resetFrames - 1);
  const expectedSequenceIndex = Math.min(
    decision.hitIndex,
    group.damageSequence.length - 1
  );
  const expectedSequenceMultiplier =
    group.damageSequence[expectedSequenceIndex];
  if (decision.icdTag !== binding.icdTag) {
    issue("icdTag", "must equal the compiled reaction binding ICD tag");
  }
  if (decision.icdGroup !== binding.groupId) {
    issue("icdGroup", "must equal the compiled reaction binding group");
  }
  if (decision.scopeKey !== expectedScopeKey) {
    issue("scopeKey", "must equal [targetId, sourceActorId, icdTag]");
  }
  if (decision.frame < decision.windowStartFrame) {
    issue("frame", "cannot precede windowStartFrame");
  }
  if (decision.resetAtFrame !== expectedResetAtFrame) {
    issue(
      "resetAtFrame",
      `must equal windowStartFrame plus ${group.resetFrames}${
        decision.policyId === GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID
          ? ""
          : " minus one"
      }`
    );
  }
  if (decision.sequenceIndex !== expectedSequenceIndex) {
    issue("sequenceIndex", "must apply the compiled clamp-last policy");
  }
  if (decision.sequenceMultiplier !== expectedSequenceMultiplier) {
    issue(
      "sequenceMultiplier",
      "must equal the compiled damage-group sequence multiplier"
    );
  }
  const expectedAllowed = expectedSequenceMultiplier === 1;
  const expectedBlockedReason = expectedAllowed
    ? null
    : decision.icdGroup === "reaction-a"
      ? "REACTION_A_DAMAGE_ICD"
      : "REACTION_B_DAMAGE_ICD";
  if (
    decision.damageAllowed !== expectedAllowed ||
    decision.blockedReason !== expectedBlockedReason
  ) {
    issue(
      "damageAllowed",
      "must match sequenceMultiplier and the group-specific blocked reason"
    );
  }
  if (
    decision.policyId === GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID &&
    decision.hitIndex === 0 &&
    decision.resetTaskSequence <= decision.damageGroupTaskSequence
  ) {
    issue(
      "resetTaskSequence",
      "a v2 reset task must be allocated after its opening attempt"
    );
  }
}

export const reactionADamageGroupDecisionAuditV150Schema = z
  .union([
    reactionDamageGroupDecisionVariantsV150[0],
    reactionDamageGroupDecisionVariantsV150[2]
  ])
  .superRefine(refineReactionDamageGroupDecisionV150);

export const reactionBDamageGroupDecisionAuditV150Schema = z
  .union([
    reactionDamageGroupDecisionVariantsV150[1],
    reactionDamageGroupDecisionVariantsV150[3]
  ])
  .superRefine(refineReactionDamageGroupDecisionV150);

export const reactionDamageGroupDecisionAuditV150Schema = z
  .union([
    reactionDamageGroupDecisionVariantsV150[0],
    reactionDamageGroupDecisionVariantsV150[1],
    reactionDamageGroupDecisionVariantsV150[2],
    reactionDamageGroupDecisionVariantsV150[3]
  ])
  .superRefine(refineReactionDamageGroupDecisionV150);

function projectReactionDamageGroupDecisionV150ToV149(
  decision: ReactionDamageGroupDecisionAuditV150
) {
  return {
    reaction: decision.reaction,
    sourceActorId: decision.sourceActorId,
    targetId: decision.targetId,
    windowStartFrame: decision.windowStartFrame,
    hitIndex: decision.hitIndex,
    resetFrames: 30 as const,
    sequence:
      decision.icdGroup === "reaction-a"
        ? ([true, true, false] as const)
        : ([true, false] as const),
    damageAllowed: decision.damageAllowed,
    blockedReason: decision.blockedReason
  };
}

/** Current reaction owner with policy-bound ReactionA/B decisions. */
export const reactionDamageLogEntryV150Schema = z
  .object({
    ...reactionDamageLogEntryV148Schema.shape,
    damageGroupDecisions: z.array(
      reactionDamageGroupDecisionAuditV150Schema
    )
  })
  .strict()
  .superRefine((entry, context) => {
    forwardSchemaIssues(
      "frozen 1.49 reaction damage row",
      reactionDamageLogEntryV148Schema.safeParse({
        ...entry,
        damageGroupDecisions: entry.damageGroupDecisions.map(
          projectReactionDamageGroupDecisionV150ToV149
        )
      }),
      context
    );
  });

export const reactionDamageGroupResetLogEntryV150Schema = z
  .object({
    id: nonNegativeSafeIntegerSchema,
    policyId: z.literal(GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID),
    sourceActorId: nonEmptyStringSchema,
    targetId: nonEmptyStringSchema,
    scopeKey: nonEmptyStringSchema,
    reaction: reactionDamageGroupReactionV150Schema,
    icdTag: reactionDamageGroupIcdTagV150Schema,
    icdGroup: z.enum(["reaction-a", "reaction-b"]),
    windowGeneration: nonNegativeSafeIntegerSchema,
    windowStartFrame: nonNegativeSafeIntegerSchema,
    resetAtFrame: nonNegativeSafeIntegerSchema,
    taskSequence: nonNegativeSafeIntegerSchema,
    withinSimulation: z.boolean(),
    executed: z.boolean(),
    executedBeforeAttemptTaskSequence:
      nonNegativeSafeIntegerSchema.nullable(),
    executionFrame: nonNegativeSafeIntegerSchema.nullable(),
    stale: z.boolean(),
    invalidatedReason: z
      .enum(["WINDOW_GENERATION_MISMATCH", "ALREADY_EXECUTED"])
      .nullable()
  })
  .strict()
  .superRefine((entry, context) => {
    const issue = (path: string, message: string): void => {
      context.addIssue({ code: "custom", path: [path], message });
    };
    const binding = resolveReactionDamageGroupBindingForPolicy(
      entry.policyId,
      entry.reaction
    );
    const group = resolveDamageGroup(binding.groupId);
    if (entry.icdTag !== binding.icdTag) {
      issue("icdTag", "must equal the compiled reaction binding ICD tag");
    }
    if (entry.icdGroup !== binding.groupId) {
      issue("icdGroup", "must equal the compiled reaction binding group");
    }
    if (
      entry.scopeKey !==
      JSON.stringify([
        entry.targetId,
        entry.sourceActorId,
        binding.icdTag
      ])
    ) {
      issue("scopeKey", "must equal [targetId, sourceActorId, icdTag]");
    }
    if (
      entry.resetAtFrame !==
      entry.windowStartFrame + group.resetFrames - 1
    ) {
      issue(
        "resetAtFrame",
        "must equal windowStartFrame plus resetFrames minus one"
      );
    }
    if (
      entry.executedBeforeAttemptTaskSequence !== null &&
      entry.executedBeforeAttemptTaskSequence <= entry.taskSequence
    ) {
      issue(
        "executedBeforeAttemptTaskSequence",
        "must follow the reset task in global FIFO order"
      );
    }
    if (!entry.withinSimulation) {
      if (
        entry.executed ||
        entry.executionFrame !== null ||
        entry.executedBeforeAttemptTaskSequence !== null ||
        entry.stale ||
        entry.invalidatedReason !== null
      ) {
        issue(
          "withinSimulation",
          "an out-of-range reset task cannot execute or carry an outcome"
        );
      }
      return;
    }
    if (!entry.executed || entry.executionFrame !== entry.resetAtFrame) {
      issue(
        "executionFrame",
        "an in-range reset task must execute at resetAtFrame"
      );
    }
    if (entry.stale !== (entry.invalidatedReason !== null)) {
      issue(
        "invalidatedReason",
        "stale and invalidatedReason must be jointly present or absent"
      );
    }
  }) satisfies z.ZodType<ReactionDamageGroupResetLogEntryV150>;

export const playerReactionSelfDamageFactorsV150Schema = z
  .object({
    ...playerReactionSelfDamageFactorsSchema.shape,
    damageGroupDecision:
      reactionADamageGroupDecisionAuditV150Schema.nullable()
  })
  .strict()
  .superRefine((factors, context) => {
    forwardSchemaIssues(
      "frozen 1.49 player reaction factors",
      playerReactionSelfDamageFactorsSchema.safeParse({
        ...factors,
        damageGroupDecision:
          factors.damageGroupDecision === null
            ? null
            : projectReactionDamageGroupDecisionV150ToV149(
                factors.damageGroupDecision
              )
      }),
      context
    );
  });

export const playerDamageEventV150Schema = z
  .object({
    ...playerDamageEventSchema.shape,
    damageFactors: playerReactionSelfDamageFactorsV150Schema
  })
  .strict()
  .superRefine((event, context) => {
    forwardSchemaIssues(
      "frozen 1.49 player damage event",
      playerDamageEventSchema.safeParse({
        ...event,
        damageFactors: {
          ...event.damageFactors,
          damageGroupDecision:
            event.damageFactors.damageGroupDecision === null
              ? null
              : projectReactionDamageGroupDecisionV150ToV149(
                  event.damageFactors.damageGroupDecision
                )
        }
      }),
      context
    );
  }) satisfies z.ZodType<PlayerDamageEventV150>;

const targetPhaseV3DeliveryAttemptBaseV148Shape = {
  order: nonNegativeSafeIntegerSchema,
  targetId: nonEmptyStringSchema,
  targetOrder: nonNegativeSafeIntegerSchema,
  applicationPhase: z.enum([
    "before-reactable-tick",
    "after-reactable-tick"
  ])
} as const;

export const targetPhaseV3DeliveryAttemptV148Schema =
  z.discriminatedUnion("outcome", [
    z
      .object({
        ...targetPhaseV3DeliveryAttemptBaseV148Shape,
        outcome: z.literal("landed"),
        hitResolutionLogId: nonNegativeSafeIntegerSchema,
        damageEventId: nonNegativeSafeIntegerSchema,
        elementalApplicationIcdLogId:
          nonNegativeSafeIntegerSchema,
        targetStateTimelinePointId:
          nonNegativeSafeIntegerSchema
      })
      .strict(),
    z
      .object({
        ...targetPhaseV3DeliveryAttemptBaseV148Shape,
        outcome: z.literal("miss"),
        hitResolutionLogId: nonNegativeSafeIntegerSchema,
        damageEventId: z.null(),
        elementalApplicationIcdLogId:
          nonNegativeSafeIntegerSchema,
        targetStateTimelinePointId: z.null()
      })
      .strict(),
    z
      .object({
        ...targetPhaseV3DeliveryAttemptBaseV148Shape,
        outcome: z.literal("unresolved"),
        hitResolutionLogId: z.null(),
        damageEventId: z.null(),
        elementalApplicationIcdLogId: z.null(),
        targetStateTimelinePointId: z.null()
      })
      .strict()
  ]) satisfies z.ZodType<TargetPhaseV3DeliveryAttemptV148>;

type ParsedTargetPhaseV3DeliveryAttemptV148 = z.output<
  typeof targetPhaseV3DeliveryAttemptV148Schema
>;

function projectTargetPhaseV3DeliveryAttemptToV147(
  attempt: ParsedTargetPhaseV3DeliveryAttemptV148
): Omit<
  ParsedTargetPhaseV3DeliveryAttemptV148,
  "elementalApplicationIcdLogId"
> {
  const {
    elementalApplicationIcdLogId:
      _elementalApplicationIcdLogId,
    ...frozenAttempt
  } = attempt;
  return frozenAttempt;
}

export const targetPhaseV3DeliveryV148Schema = z
  .object({
    ...targetPhaseV3DeliverySchema.shape,
    attempts: z.array(
      targetPhaseV3DeliveryAttemptV148Schema
    )
  })
  .strict()
  .superRefine((delivery, context) => {
    const projectedDelivery = {
      ...delivery,
      attempts: delivery.attempts.map(
        projectTargetPhaseV3DeliveryAttemptToV147
      )
    };
    forwardSchemaIssues(
      "frozen 1.47 target-phase-v3 delivery",
      targetPhaseV3DeliverySchema.safeParse(
        projectedDelivery
      ),
      context
    );
    const applicationIds = delivery.attempts.flatMap(
      (attempt) =>
        attempt.elementalApplicationIcdLogId === null
          ? []
          : [attempt.elementalApplicationIcdLogId]
    );
    if (
      new Set(applicationIds).size !== applicationIds.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["attempts"],
        message:
          "one Burning callback delivery cannot reuse an application log id"
      });
    }
  });

export const targetPhaseV3TargetTaskV148Schema = z
  .object({
    ...targetPhaseV3TargetTaskSchema.shape,
    delivery: targetPhaseV3DeliveryV148Schema.nullable()
  })
  .strict()
  .superRefine((task, context) => {
    const projectedTask = {
      ...task,
      delivery:
        task.delivery === null
          ? null
          : {
              ...task.delivery,
              attempts: task.delivery.attempts.map(
                projectTargetPhaseV3DeliveryAttemptToV147
              )
            }
    };
    forwardSchemaIssues(
      "frozen 1.47 target-phase-v3 task",
      targetPhaseV3TargetTaskSchema.safeParse(
        projectedTask
      ),
      context
    );
  });

export const targetPhaseV3LogEntryV148Schema = z
  .object({
    ...targetPhaseV3LogEntrySchema.shape,
    targetTasks: z.array(targetPhaseV3TargetTaskV148Schema)
  })
  .strict()
  .superRefine((entry, context) => {
    const projectedEntry = {
      ...entry,
      targetTasks: entry.targetTasks.map((task) => ({
        ...task,
        delivery:
          task.delivery === null
            ? null
            : {
                ...task.delivery,
                attempts: task.delivery.attempts.map(
                  projectTargetPhaseV3DeliveryAttemptToV147
                )
              }
      }))
    };
    forwardSchemaIssues(
      "frozen 1.47 target-phase-v3 entry",
      targetPhaseV3LogEntrySchema.safeParse(projectedEntry),
      context
    );
  });

export const targetPhaseV3LogV148Schema = z
  .array(targetPhaseV3LogEntryV148Schema)
  .superRefine((entries, context) => {
    const projectedEntries = entries.map((entry) => ({
      ...entry,
      targetTasks: entry.targetTasks.map((task) => ({
        ...task,
        delivery:
          task.delivery === null
            ? null
            : {
                ...task.delivery,
                attempts: task.delivery.attempts.map(
                  projectTargetPhaseV3DeliveryAttemptToV147
                )
              }
      }))
    }));
    forwardSchemaIssues(
      "frozen 1.47 target-phase-v3 log",
      targetPhaseV3LogSchema.safeParse(projectedEntries),
      context
    );
  });

/**
 * Exact current 1.48 result wire. Every inherited 1.47 field remains exact;
 * only the versioned identity and the six explicitly replaced audit fields
 * advance. In particular, the frozen 1.47 schemas never accept reciprocal
 * IDs or reaction-owned application rows.
 */
export const simulationResultV148ValueSchema = z
  .object({
    ...simulationResultV147ValueSchema.shape,
    schemaVersion: z.literal(
      REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION
    ),
    engineVersion: z.literal(
      REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION
    ),
    runManifest: simulationRunManifestV148Schema,
    config: simConfigV148Schema,
    damageEvents: z.array(damageEventV148Schema),
    hitEvents: z.array(damageEventV148Schema),
    hitResolutionLog: z.array(
      hitResolutionLogEntryV148Schema
    ),
    reactionDamageLog: z.array(
      reactionDamageLogEntryV148Schema
    ),
    elementalApplicationIcdLog: z.array(
      elementalApplicationIcdLogEntryV148Schema
    ),
    targetPhaseLog: z.union([
      targetPhaseV2LogSchema,
      targetPhaseV3LogV148Schema
    ])
  })
  .strict()
  .superRefine((result, context) => {
    const issue = (
      path: Array<string | number>,
      message: string
    ): void =>
      context.addIssue({ code: "custom", path, message });
    if (
      result.engineVersion !== result.config.engineVersion
    ) {
      issue(
        ["engineVersion"],
        "must equal config.engineVersion"
      );
    }
    if (result.dataVersion !== result.config.dataVersion) {
      issue(
        ["dataVersion"],
        "must equal config.dataVersion"
      );
    }
    if (
      result.randomSeed !==
      result.resolvedRuntimeOptions.randomSeed
    ) {
      issue(
        ["randomSeed"],
        "must equal resolvedRuntimeOptions.randomSeed"
      );
    }
    if (
      result.compatibilityMode !==
      result.resolvedRuntimeOptions.compatibilityMode
    ) {
      issue(
        ["compatibilityMode"],
        "must equal resolvedRuntimeOptions.compatibilityMode"
      );
    }
    if (
      result.reproducibilityKey !==
      result.runManifest.reproducibilityKey
    ) {
      issue(
        ["reproducibilityKey"],
        "must equal runManifest.reproducibilityKey"
      );
    }
    if (
      JSON.stringify(result.pluginManifest) !==
      JSON.stringify(result.runManifest.plugins)
    ) {
      issue(
        ["pluginManifest"],
        "must equal runManifest.plugins"
      );
    }
    const validateFacet = (
      label: string,
      schema: z.ZodType
    ): void => {
      const parsed = schema.safeParse(result);
      if (parsed.success) return;
      for (const facetIssue of parsed.error.issues) {
        context.addIssue({
          code: "custom",
          path: [...facetIssue.path],
          message: `${label}: ${facetIssue.message}`
        });
      }
    };
    validateFacet(
      "enemy target references",
      enemyTargetsResultReferencesSchema
    );
    validateFacet(
      "reaction delivery references",
      reactionDeliveryResultReferencesSchema
    );
    validateFacet(
      "target task phase references",
      targetTaskPhaseResultReferencesSchema
    );
    if (
      result.config.targetTaskModel.mode !==
      "target-phase-v3"
    ) {
      validateFacet(
        "target phase v2 references",
        targetPhaseV2ResultReferencesSchema
      );
    }
    validateFacet(
      "player damage references",
      playerDamageResultReferencesSchema
    );
    validateFacet(
      "target clock references",
      targetClockResultReferencesSchema
    );
    const auraMode = result.config.reactionEngine?.mode;
    if (
      auraMode === "aura-v5" ||
      auraMode === "aura-v6" ||
      auraMode === "aura-v7" ||
      auraMode === "aura-v8" ||
      auraMode === "aura-v9"
    ) {
      validateFacet(
        "Dendro core references",
        dendroCoreResultReferencesSchema
      );
    }
    if (
      (auraMode === "aura-v8" || auraMode === "aura-v9") &&
      (result.reactionTaskLog.some(
        (task) => task.electroChargedCleanup !== null
      ) ||
        result.periodicReactionLog.some(
          (entry) => entry.reaction === "electroCharged"
        ))
    ) {
      validateFacet(
        "Electro-Charged cleanup references",
        electroChargedCleanupResultReferencesSchema
      );
    }
    validateSimulationResultV148Integrity(
      result as unknown as SimulationResultForV148,
      context
    );
  });

export const simulationResultV148Schema = z.preprocess(
  rejectNonPlainJsonWire("SimulationResult 1.48"),
  simulationResultV148ValueSchema
);

export type SimulationResultV148 = z.output<
  typeof simulationResultV148Schema
>;

/** Frozen 1.49 result wire with an explicit application reset policy. */
export const simulationResultV149ValueSchema = z
  .object({
    ...simulationResultV148ValueSchema.shape,
    schemaVersion: z.literal(
      REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION
    ),
    engineVersion: z.literal(
      REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION
    ),
    runManifest: simulationRunManifestV149Schema,
    config: simConfigV149Schema,
    elementalApplicationIcdLog: z.array(
      elementalApplicationIcdLogEntryV149Schema
    )
  })
  .strict()
  .superRefine((result, context) => {
    const issue = (
      path: Array<string | number>,
      message: string
    ): void =>
      context.addIssue({ code: "custom", path, message });
    if (
      result.engineVersion !== result.config.engineVersion
    ) {
      issue(
        ["engineVersion"],
        "must equal config.engineVersion"
      );
    }
    if (result.dataVersion !== result.config.dataVersion) {
      issue(
        ["dataVersion"],
        "must equal config.dataVersion"
      );
    }
    if (
      result.randomSeed !==
      result.resolvedRuntimeOptions.randomSeed
    ) {
      issue(
        ["randomSeed"],
        "must equal resolvedRuntimeOptions.randomSeed"
      );
    }
    if (
      result.compatibilityMode !==
      result.resolvedRuntimeOptions.compatibilityMode
    ) {
      issue(
        ["compatibilityMode"],
        "must equal resolvedRuntimeOptions.compatibilityMode"
      );
    }
    if (
      result.reproducibilityKey !==
      result.runManifest.reproducibilityKey
    ) {
      issue(
        ["reproducibilityKey"],
        "must equal runManifest.reproducibilityKey"
      );
    }
    if (
      JSON.stringify(result.pluginManifest) !==
      JSON.stringify(result.runManifest.plugins)
    ) {
      issue(
        ["pluginManifest"],
        "must equal runManifest.plugins"
      );
    }
    // The public manifest/config parser follows the current 1.50 wire.
    // Frozen 1.49 binding is replayed below by its versioned integrity proof,
    // including configHash, identity hash, and every compiled root selection.

    const selectedPolicy =
      result.config.reactionOwnedElementalApplicationModel;
    for (const [
      index,
      entry
    ] of result.elementalApplicationIcdLog.entries()) {
      if (entry.sourceKind === "configured-direct-hit")
        continue;
      if (
        entry.selector.mode !== selectedPolicy.mode ||
        entry.selector.policyId !== selectedPolicy.policyId
      ) {
        issue(
          ["elementalApplicationIcdLog", index, "selector"],
          "must equal the reaction-owned policy selected by config"
        );
      }
      if (
        entry.decision.kind === "reaction-fixed-gcsim" &&
        entry.decision.policyId !== selectedPolicy.policyId
      ) {
        issue(
          [
            "elementalApplicationIcdLog",
            index,
            "decision",
            "policyId"
          ],
          "must equal the reaction-owned policy selected by config"
        );
      }
    }

    const validateFacet = (
      label: string,
      schema: z.ZodType
    ): void => {
      const parsed = schema.safeParse(result);
      if (parsed.success) return;
      for (const facetIssue of parsed.error.issues) {
        context.addIssue({
          code: "custom",
          path: [...facetIssue.path],
          message: `${label}: ${facetIssue.message}`
        });
      }
    };
    validateFacet(
      "enemy target references",
      enemyTargetsResultReferencesSchema
    );
    validateFacet(
      "reaction delivery references",
      reactionDeliveryResultReferencesSchema
    );
    validateFacet(
      "target task phase references",
      targetTaskPhaseResultReferencesSchema
    );
    if (
      result.config.targetTaskModel.mode !==
      "target-phase-v3"
    ) {
      validateFacet(
        "target phase v2 references",
        targetPhaseV2ResultReferencesSchema
      );
    }
    validateFacet(
      "player damage references",
      playerDamageResultReferencesSchema
    );
    validateFacet(
      "target clock references",
      targetClockResultReferencesSchema
    );
    const auraMode = result.config.reactionEngine?.mode;
    if (
      auraMode === "aura-v5" ||
      auraMode === "aura-v6" ||
      auraMode === "aura-v7" ||
      auraMode === "aura-v8" ||
      auraMode === "aura-v9"
    ) {
      validateFacet(
        "Dendro core references",
        dendroCoreResultReferencesSchema
      );
    }
    if (
      (auraMode === "aura-v8" || auraMode === "aura-v9") &&
      (result.reactionTaskLog.some(
        (task) => task.electroChargedCleanup !== null
      ) ||
        result.periodicReactionLog.some(
          (entry) => entry.reaction === "electroCharged"
        ))
    ) {
      validateFacet(
        "Electro-Charged cleanup references",
        electroChargedCleanupResultReferencesSchema
      );
    }
    validateSimulationResultV149Integrity(
      result as unknown as SimulationResult,
      context
    );
  });

export const simulationResultV149Schema = z.preprocess(
  rejectNonPlainJsonWire("SimulationResult 1.49"),
  simulationResultV149ValueSchema
);

export type SimulationResultV149 = z.output<
  typeof simulationResultV149Schema
>;

function projectV150ResultForFrozenReferenceFacets(
  result: SimulationResultForV150
) {
  return {
    ...result,
    reactionDamageLog: result.reactionDamageLog.map((entry) => ({
      ...entry,
      damageGroupDecisions: entry.damageGroupDecisions.map(
        projectReactionDamageGroupDecisionV150ToV149
      )
    })),
    playerDamageEvents: result.playerDamageEvents.map((event) => ({
      ...event,
      damageFactors: {
        ...event.damageFactors,
        damageGroupDecision:
          event.damageFactors.damageGroupDecision === null
            ? null
            : projectReactionDamageGroupDecisionV150ToV149(
                event.damageFactors.damageGroupDecision
              )
      }
    }))
  };
}

/**
 * Frozen 1.50 timeline leaf. The shared current timeline schema admits the
 * 1.51 scheduler event/cause/link, so the historical result boundary must
 * explicitly reject those values.
 */
export const targetStateTimelineV150Schema =
  targetStateTimelineSchema.superRefine(
    (timeline, context) => {
      for (const [
        pointIndex,
        point
      ] of timeline.points.entries()) {
        if (point.eventType === "reactionAuraAttachment") {
          context.addIssue({
            code: "custom",
            path: ["points", pointIndex, "eventType"],
            message:
              "reactionAuraAttachment is a 1.51-only event type"
          });
        }
        if (point.cause === "reaction-aura-attachment") {
          context.addIssue({
            code: "custom",
            path: ["points", pointIndex, "cause"],
            message:
              "reaction-aura-attachment is a 1.51-only cause"
          });
        }
        for (const [
          linkIndex,
          link
        ] of point.links.entries()) {
          if (link.kind !== "basic-reaction-scheduler-log")
            continue;
          context.addIssue({
            code: "custom",
            path: [
              "points",
              pointIndex,
              "links",
              linkIndex,
              "kind"
            ],
            message:
              "basic-reaction-scheduler-log is a 1.51-only timeline link"
          });
        }
      }
    }
  );

/** Frozen 1.50 result wire with task-ordered ReactionA/B reset proof. */
export const simulationResultV150ValueSchema = z
  .object({
    ...simulationResultV149ValueSchema.shape,
    schemaVersion: z.literal(
      REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION
    ),
    engineVersion: z.literal(
      REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION
    ),
    runManifest: simulationRunManifestV150Schema,
    config: simConfigV150Schema,
    reactionDamageLog: z.array(
      reactionDamageLogEntryV150Schema
    ),
    reactionDamageGroupResetLog: z.array(
      reactionDamageGroupResetLogEntryV150Schema
    ),
    playerDamageEvents: z.array(playerDamageEventV150Schema),
    targetStateTimeline: targetStateTimelineV150Schema
  })
  .strict()
  .superRefine((result, context) => {
    const issue = (
      path: Array<string | number>,
      message: string
    ): void =>
      context.addIssue({ code: "custom", path, message });
    if (result.engineVersion !== result.config.engineVersion) {
      issue(["engineVersion"], "must equal config.engineVersion");
    }
    if (result.dataVersion !== result.config.dataVersion) {
      issue(["dataVersion"], "must equal config.dataVersion");
    }
    if (
      result.randomSeed !==
      result.resolvedRuntimeOptions.randomSeed
    ) {
      issue(
        ["randomSeed"],
        "must equal resolvedRuntimeOptions.randomSeed"
      );
    }
    if (
      result.compatibilityMode !==
      result.resolvedRuntimeOptions.compatibilityMode
    ) {
      issue(
        ["compatibilityMode"],
        "must equal resolvedRuntimeOptions.compatibilityMode"
      );
    }
    if (
      result.reproducibilityKey !==
      result.runManifest.reproducibilityKey
    ) {
      issue(
        ["reproducibilityKey"],
        "must equal runManifest.reproducibilityKey"
      );
    }
    if (
      JSON.stringify(result.pluginManifest) !==
      JSON.stringify(result.runManifest.plugins)
    ) {
      issue(
        ["pluginManifest"],
        "must equal runManifest.plugins"
      );
    }
    try {
      parseSimulationRunManifestForConfig(
        result.runManifest,
        result.config
      );
    } catch (error) {
      issue(
        ["runManifest"],
        error instanceof Error
          ? error.message
          : "is not bound to the supplied migrated config"
      );
    }

    const selectedReactionOwnedPolicy =
      result.config.reactionOwnedElementalApplicationModel;
    for (const [
      index,
      entry
    ] of result.elementalApplicationIcdLog.entries()) {
      if (entry.sourceKind === "configured-direct-hit") continue;
      if (
        entry.selector.mode !== selectedReactionOwnedPolicy.mode ||
        entry.selector.policyId !==
          selectedReactionOwnedPolicy.policyId
      ) {
        issue(
          ["elementalApplicationIcdLog", index, "selector"],
          "must equal the reaction-owned policy selected by config"
        );
      }
      if (
        entry.decision.kind === "reaction-fixed-gcsim" &&
        entry.decision.policyId !==
          selectedReactionOwnedPolicy.policyId
      ) {
        issue(
          [
            "elementalApplicationIcdLog",
            index,
            "decision",
            "policyId"
          ],
          "must equal the reaction-owned policy selected by config"
        );
      }
    }

    const selectedDamageGroupPolicy =
      result.config.reactionDamageGroupModel.policyId;
    for (const [logIndex, log] of
      result.reactionDamageLog.entries()) {
      for (const [decisionIndex, decision] of
        log.damageGroupDecisions.entries()) {
        if (decision.policyId !== selectedDamageGroupPolicy) {
          issue(
            [
              "reactionDamageLog",
              logIndex,
              "damageGroupDecisions",
              decisionIndex,
              "policyId"
            ],
            "must equal the reaction damage-group policy selected by config"
          );
        }
      }
    }
    for (const [index, reset] of
      result.reactionDamageGroupResetLog.entries()) {
      if (reset.policyId !== selectedDamageGroupPolicy) {
        issue(
          ["reactionDamageGroupResetLog", index, "policyId"],
          "must equal the reaction damage-group policy selected by config"
        );
      }
    }
    if (
      selectedDamageGroupPolicy ===
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID &&
      result.reactionDamageGroupResetLog.length !== 0
    ) {
      issue(
        ["reactionDamageGroupResetLog"],
        "the v1 lazy-window policy requires an empty reset-task log"
      );
    }

    const frozenReferenceView =
      projectV150ResultForFrozenReferenceFacets(
        result as SimulationResultForV150
      );
    const validateFacet = (
      label: string,
      schema: z.ZodType,
      view: unknown = frozenReferenceView
    ): void => {
      const parsed = schema.safeParse(view);
      if (parsed.success) return;
      for (const facetIssue of parsed.error.issues) {
        context.addIssue({
          code: "custom",
          path: [...facetIssue.path],
          message: `${label}: ${facetIssue.message}`
        });
      }
    };
    validateFacet(
      "enemy target references",
      enemyTargetsResultReferencesSchema
    );
    validateFacet(
      "reaction delivery references",
      reactionDeliveryResultReferencesSchema,
      result
    );
    validateFacet(
      "target task phase references",
      targetTaskPhaseResultReferencesSchema
    );
    if (
      result.config.targetTaskModel.mode !== "target-phase-v3"
    ) {
      validateFacet(
        "target phase v2 references",
        targetPhaseV2ResultReferencesSchema
      );
    }
    validateFacet(
      "player damage references",
      playerDamageResultReferencesSchema,
      result
    );
    validateFacet(
      "target clock references",
      targetClockResultReferencesSchema
    );
    const auraMode = result.config.reactionEngine?.mode;
    if (
      auraMode === "aura-v5" ||
      auraMode === "aura-v6" ||
      auraMode === "aura-v7" ||
      auraMode === "aura-v8" ||
      auraMode === "aura-v9"
    ) {
      validateFacet(
        "Dendro core references",
        dendroCoreResultReferencesSchema,
        result
      );
    }
    if (
      (auraMode === "aura-v8" || auraMode === "aura-v9") &&
      (result.reactionTaskLog.some(
        (task) => task.electroChargedCleanup !== null
      ) ||
        result.periodicReactionLog.some(
          (entry) => entry.reaction === "electroCharged"
        ))
    ) {
      validateFacet(
        "Electro-Charged cleanup references",
        electroChargedCleanupResultReferencesSchema
      );
    }
    validateSimulationResultV150Integrity(
      result as SimulationResultForV150,
      context
    );
  });

export const simulationResultV150Schema = z.preprocess(
  rejectNonPlainJsonWire("SimulationResult 1.50"),
  simulationResultV150ValueSchema
);

export type SimulationResultV150 = z.output<
  typeof simulationResultV150Schema
>;

function basicReactionSchedulerWireEquals(
  left: unknown,
  right: unknown
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function damageAuditOwnsSchedulerAttachment(
  event:
    | SimulationResultForV151["damageEvents"][number]
    | undefined,
  phase: "legacy-immediate" | "deferred"
): boolean {
  if (event === undefined) return false;
  const audit = event.reactionAudit;
  return (
    audit.model === "aura-engine" &&
    audit.icdAllowed === true &&
    audit.triggered === false &&
    audit.reaction === "none" &&
    audit.reactions.length === 0 &&
    audit.unsupportedReactions.length === 0 &&
    audit.mechanicsTruncation === null &&
    audit.applicationGaugeUnits !== null &&
    audit.applicationGaugeUnits > 0 &&
    (audit.auraApplied?.length ?? 0) ===
      (phase === "legacy-immediate" ? 1 : 0) &&
    (audit.auraConsumed?.length ?? 0) === 0 &&
    audit.transformativeReaction === null &&
    (audit.transformativeReactions?.length ?? 0) === 0 &&
    audit.periodicReaction === null &&
    audit.frozenReaction === null &&
    audit.shatterReaction === null &&
    audit.swirlReactions.length === 0 &&
    audit.crystallizeReaction === null &&
    audit.catalyzeReaction === null &&
    audit.burningReaction === null &&
    audit.bloomReactions.length === 0
  );
}

function validateBasicReactionSchedulerResult(
  result: SimulationResultForV151,
  context: z.RefinementCtx
): void {
  const issue = (
    path: Array<string | number>,
    message: string
  ): void =>
    context.addIssue({ code: "custom", path, message });
  const log = result.basicReactionSchedulerLog;
  const selectedModel =
    result.config.basicReactionSchedulerModel;
  const selectedRoot =
    result.runManifest.basicReactionSchedulerRoot;

  if (selectedRoot.policyId !== selectedModel.policyId) {
    issue(
      [
        "runManifest",
        "basicReactionSchedulerRoot",
        "policyId"
      ],
      "must equal config.basicReactionSchedulerModel.policyId"
    );
  }
  if (
    selectedModel.mode ===
      "legacy-immediate-basic-reaction-scheduler-v1" &&
    selectedModel.policyId !==
      LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID
  ) {
    issue(
      ["config", "basicReactionSchedulerModel", "policyId"],
      "must select the compiled legacy scheduler policy"
    );
  }
  if (
    selectedModel.mode ===
      "fixed-gcsim-basic-reaction-scheduler-v2" &&
    selectedModel.policyId !==
      GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID
  ) {
    issue(
      ["config", "basicReactionSchedulerModel", "policyId"],
      "must select the compiled deferred-attachment scheduler policy"
    );
  }

  const commitIdsByAttackId = new Map<number, number[]>();
  const attackIndexesByResolutionId = new Map<
    number,
    number[]
  >();
  const commitIndexesByResolutionId = new Map<
    number,
    number[]
  >();
  const timelineLinkCounts = log.map(() => 0);
  const expectedSwirlReactionByElement = {
    pyro: "swirlPyro",
    hydro: "swirlHydro",
    cryo: "swirlCryo",
    electro: "swirlElectro"
  } as const;

  for (const [index, entry] of log.entries()) {
    const path = [
      "basicReactionSchedulerLog",
      index
    ] as const;
    if (entry.id !== index) {
      issue(
        [...path, "id"],
        `scheduler log ids must be zero-based and contiguous; expected ${index}`
      );
    }
    if (entry.timeSeconds !== entry.frame / 60) {
      issue(
        [...path, "timeSeconds"],
        "must equal frame / 60"
      );
    }
    if (entry.reactions.includes("none")) {
      issue(
        [...path, "reactions"],
        "the ordered reactions list cannot contain the none sentinel"
      );
    }
    const expectedPrimaryReaction =
      [...entry.reactions]
        .reverse()
        .find(
          (reaction) =>
            reaction === "melt" ||
            reaction === "reverseMelt" ||
            reaction === "vaporize" ||
            reaction === "reverseVaporize"
        ) ??
      entry.reactions[0] ??
      "none";
    if (entry.reaction !== expectedPrimaryReaction) {
      issue(
        [...path, "reaction"],
        "must equal the last amplifying reaction, otherwise the first ordered reaction, or none"
      );
    }

    if (entry.kind === "swirl-attack-resolution") {
      const attackIndexes =
        attackIndexesByResolutionId.get(
          entry.hitResolutionLogId
        ) ?? [];
      attackIndexes.push(index);
      attackIndexesByResolutionId.set(
        entry.hitResolutionLogId,
        attackIndexes
      );
      if (
        entry.parentEventSequence !== entry.eventSequence
      ) {
        issue(
          [...path, "parentEventSequence"],
          "an attack row must own itself"
        );
      }
      if (
        selectedModel.mode ===
          "legacy-immediate-basic-reaction-scheduler-v1" &&
        entry.disposition === "deferred"
      ) {
        issue(
          [...path, "disposition"],
          "the v1 immediate scheduler cannot emit deferred attacks"
        );
      }
      if (
        selectedModel.mode ===
          "fixed-gcsim-basic-reaction-scheduler-v2" &&
        entry.disposition === "legacy-immediate"
      ) {
        issue(
          [...path, "disposition"],
          "the v2 scheduler cannot emit legacy-immediate attachment"
        );
      }
      if (entry.disposition === "deferred") {
        if (entry.reactions.length !== 0) {
          issue(
            [...path, "reactions"],
            "a deferred non-reacted attachment cannot claim a reaction"
          );
        }
        if (
          entry.auraApplied.length !== 0 ||
          entry.auraConsumed.length !== 0 ||
          !basicReactionSchedulerWireEquals(
            entry.auraBefore,
            entry.auraAfter
          )
        ) {
          issue(
            [...path, "auraAfter"],
            "a deferred attack must leave Aura unchanged until its child commit"
          );
        }
      }
    } else {
      const commitIndexes =
        commitIndexesByResolutionId.get(
          entry.hitResolutionLogId
        ) ?? [];
      commitIndexes.push(index);
      commitIndexesByResolutionId.set(
        entry.hitResolutionLogId,
        commitIndexes
      );
      const ownerCommitIds =
        commitIdsByAttackId.get(entry.pairedLogId) ?? [];
      ownerCommitIds.push(entry.id);
      commitIdsByAttackId.set(
        entry.pairedLogId,
        ownerCommitIds
      );
      if (
        selectedModel.mode ===
        "legacy-immediate-basic-reaction-scheduler-v1"
      ) {
        issue(
          [...path, "kind"],
          "the v1 immediate scheduler cannot emit a deferred commit"
        );
      }
      if (
        entry.eventSequence <= entry.parentEventSequence
      ) {
        issue(
          [...path, "eventSequence"],
          "a deferred commit must follow its parent attack"
        );
      }
      if (entry.reactions.length !== 0) {
        issue(
          [...path, "reactions"],
          "a deferred non-reacted Aura commit cannot trigger a reaction"
        );
      }
      if (entry.auraConsumed.length !== 0) {
        issue(
          [...path, "auraConsumed"],
          "a deferred non-reacted Aura commit cannot consume Aura"
        );
      }
      if (entry.auraApplied.length === 0) {
        issue(
          [...path, "auraApplied"],
          "a committed deferred attachment must apply Aura"
        );
      }
    }

    if (entry.pairedLogId !== null) {
      const paired = log[entry.pairedLogId];
      if (paired === undefined) {
        issue(
          [...path, "pairedLogId"],
          "must reference an existing scheduler log row"
        );
      } else {
        if (paired.pairedLogId !== entry.id) {
          issue(
            [...path, "pairedLogId"],
            "scheduler row pairs must be reciprocal"
          );
        }
        if (paired.kind === entry.kind) {
          issue(
            [...path, "pairedLogId"],
            "a pair must contain one attack row and one deferred commit row"
          );
        }
        for (const [field, left, right] of [
          ["frame", entry.frame, paired.frame],
          [
            "eventPriority",
            entry.eventPriority,
            paired.eventPriority
          ],
          [
            "parentEventSequence",
            entry.parentEventSequence,
            paired.parentEventSequence
          ],
          [
            "reactionDamageLogId",
            entry.reactionDamageLogId,
            paired.reactionDamageLogId
          ],
          [
            "hitResolutionLogId",
            entry.hitResolutionLogId,
            paired.hitResolutionLogId
          ],
          [
            "elementalApplicationIcdLogId",
            entry.elementalApplicationIcdLogId,
            paired.elementalApplicationIcdLogId
          ],
          [
            "sourceActorId",
            entry.sourceActorId,
            paired.sourceActorId
          ],
          ["targetId", entry.targetId, paired.targetId],
          ["element", entry.element, paired.element]
        ] as const) {
          if (left !== right) {
            issue(
              [...path, field],
              `must equal the paired scheduler row ${field}`
            );
          }
        }
        if (
          !basicReactionSchedulerWireEquals(
            entry.reactions,
            paired.reactions
          )
        ) {
          issue(
            [...path, "reactions"],
            "must equal the paired scheduler row reactions"
          );
        }
      }
    }

    const reactionDamage =
      result.reactionDamageLog[entry.reactionDamageLogId];
    if (
      reactionDamage === undefined ||
      reactionDamage.id !== entry.reactionDamageLogId
    ) {
      issue(
        [...path, "reactionDamageLogId"],
        "must reference an existing reaction damage row"
      );
    } else {
      if (
        reactionDamage.scheduleKind !==
          "swirl-propagation" ||
        reactionDamage.reaction !==
          expectedSwirlReactionByElement[entry.element]
      ) {
        issue(
          [...path, "reactionDamageLogId"],
          "must reference the matching Swirl propagation reaction"
        );
      }
      if (
        reactionDamage.damageFrame !== entry.frame ||
        reactionDamage.sourceActorId !==
          entry.sourceActorId ||
        !reactionDamage.checkedTargetIds.includes(
          entry.targetId
        ) ||
        !reactionDamage.hitResolutionLogIds.includes(
          entry.hitResolutionLogId
        )
      ) {
        issue(
          [...path, "reactionDamageLogId"],
          "reaction damage frame, source, target, and hit-resolution backlink must match"
        );
      }
      if (
        entry.elementalApplicationIcdLogId !== null &&
        !reactionDamage.elementalApplicationIcdLogIds.includes(
          entry.elementalApplicationIcdLogId
        )
      ) {
        issue(
          [...path, "elementalApplicationIcdLogId"],
          "must be backlinked by the owning reaction damage row"
        );
      }
    }

    const hitResolution =
      result.hitResolutionLog[entry.hitResolutionLogId];
    if (
      hitResolution === undefined ||
      hitResolution.id !== entry.hitResolutionLogId
    ) {
      issue(
        [...path, "hitResolutionLogId"],
        "must reference an existing hit-resolution row"
      );
    } else if (
      hitResolution.reactionDamageLogId !==
        entry.reactionDamageLogId ||
      hitResolution.elementalApplicationIcdLogId !==
        entry.elementalApplicationIcdLogId ||
      hitResolution.resolutionKind !== "reaction-damage" ||
      hitResolution.frame !== entry.frame ||
      hitResolution.eventSequence !==
        entry.parentEventSequence ||
      hitResolution.sourceActorId !== entry.sourceActorId ||
      hitResolution.targetId !== entry.targetId ||
      hitResolution.element !== entry.element
    ) {
      issue(
        [...path, "hitResolutionLogId"],
        "hit-resolution ownership, frame, attack sequence, source, target, and element must match"
      );
    }
    if (
      hitResolution !== undefined &&
      entry.kind === "swirl-attack-resolution" &&
      entry.disposition !== "not-attached" &&
      !hitResolution.landed
    ) {
      issue(
        [...path, "disposition"],
        "a deferred or legacy-immediate attachment requires a landed target attempt"
      );
    }
    if (
      hitResolution !== undefined &&
      entry.kind === "deferred-aura-attachment" &&
      !hitResolution.landed
    ) {
      issue(
        [...path, "kind"],
        "a deferred commit requires a landed parent target attempt"
      );
    }

    if (entry.elementalApplicationIcdLogId === null) {
      issue(
        [...path, "elementalApplicationIcdLogId"],
        "a scheduler row must reference its Swirl propagation application attempt"
      );
    } else {
      const application =
        result.elementalApplicationIcdLog[
          entry.elementalApplicationIcdLogId
        ];
      if (
        application === undefined ||
        application.id !==
          entry.elementalApplicationIcdLogId ||
        application.sourceKind !== "swirl-propagation"
      ) {
        issue(
          [...path, "elementalApplicationIcdLogId"],
          "must reference an existing Swirl propagation application row"
        );
      } else if (
        application.reactionDamageLogId !==
          entry.reactionDamageLogId ||
        application.hitResolutionLogId !==
          entry.hitResolutionLogId ||
        application.frame !== entry.frame ||
        application.eventSequence !==
          entry.parentEventSequence ||
        application.sourceActorId !== entry.sourceActorId ||
        application.targetId !== entry.targetId ||
        application.element !== entry.element ||
        application.selector.channel.element !==
          entry.element
      ) {
        issue(
          [...path, "elementalApplicationIcdLogId"],
          "application ownership, frame, attack sequence, source, target, and element must match"
        );
      }
    }
  }

  for (const [
    attackId,
    commitIds
  ] of commitIdsByAttackId.entries()) {
    if (commitIds.length !== 1) {
      issue(
        [
          "basicReactionSchedulerLog",
          attackId,
          "pairedLogId"
        ],
        "a deferred attack must own exactly one commit"
      );
    }
  }
  for (const [index, entry] of log.entries()) {
    if (
      entry.kind === "swirl-attack-resolution" &&
      entry.disposition === "deferred" &&
      (commitIdsByAttackId.get(entry.id)?.length ?? 0) !== 1
    ) {
      issue(
        ["basicReactionSchedulerLog", index, "pairedLogId"],
        "a v2 deferred attack requires one unique commit"
      );
    }
  }

  const replayedResolutionIds = new Set<number>();
  for (const parent of result.reactionDamageLog) {
    if (parent.scheduleKind !== "swirl-propagation")
      continue;
    for (const resolutionId of parent.hitResolutionLogIds) {
      if (replayedResolutionIds.has(resolutionId)) continue;
      replayedResolutionIds.add(resolutionId);
      const resolution = result.hitResolutionLog[resolutionId];
      const damageEvent =
        resolution === undefined ||
        resolution.damageEventId === null
          ? undefined
          : result.damageEvents[resolution.damageEventId];
      const ownsLegacyAttachment =
        resolution !== undefined &&
        resolution.landed &&
        resolution.auraAllowed &&
        resolution.mechanicsStatus !==
          "mechanics-truncated" &&
        damageAuditOwnsSchedulerAttachment(
          damageEvent,
          "legacy-immediate"
        );
      const ownsDeferredAttachment =
        resolution !== undefined &&
        resolution.landed &&
        resolution.auraAllowed &&
        resolution.mechanicsStatus !==
          "mechanics-truncated" &&
        damageAuditOwnsSchedulerAttachment(
          damageEvent,
          "deferred"
        );
      const expectsAttack =
        selectedModel.mode ===
          "fixed-gcsim-basic-reaction-scheduler-v2" ||
        ownsLegacyAttachment;
      const expectsCommit =
        selectedModel.mode ===
          "fixed-gcsim-basic-reaction-scheduler-v2" &&
        ownsDeferredAttachment;
      const attackIndexes =
        attackIndexesByResolutionId.get(resolutionId) ?? [];
      const commitIndexes =
        commitIndexesByResolutionId.get(resolutionId) ?? [];

      if (attackIndexes.length !== (expectsAttack ? 1 : 0)) {
        issue(
          ["basicReactionSchedulerLog"],
          `${selectedModel.mode} requires ${
            expectsAttack ? "exactly one" : "no"
          } attack row for Swirl target attempt ${resolutionId}`
        );
      }
      if (commitIndexes.length !== (expectsCommit ? 1 : 0)) {
        issue(
          ["basicReactionSchedulerLog"],
          `${selectedModel.mode} requires ${
            expectsCommit ? "exactly one" : "no"
          } commit row for Swirl target attempt ${resolutionId}`
        );
      }
      const attack = log[attackIndexes[0] ?? -1];
      if (
        attack !== undefined &&
        attack.kind === "swirl-attack-resolution"
      ) {
        const expectedDisposition =
          selectedModel.mode ===
          "legacy-immediate-basic-reaction-scheduler-v1"
            ? "legacy-immediate"
            : ownsDeferredAttachment
              ? "deferred"
              : "not-attached";
        if (attack.disposition !== expectedDisposition) {
          issue(
            [
              "basicReactionSchedulerLog",
              attack.id,
              "disposition"
            ],
            `must equal replayed scheduler disposition ${expectedDisposition}`
          );
        }
      }
    }
  }

  for (const [
    pointIndex,
    point
  ] of result.targetStateTimeline.points.entries()) {
    for (const [linkIndex, link] of point.links.entries()) {
      if (link.kind !== "basic-reaction-scheduler-log")
        continue;
      const entry = log[link.id];
      if (entry === undefined || entry.id !== link.id) {
        issue(
          [
            "targetStateTimeline",
            "points",
            pointIndex,
            "links",
            linkIndex,
            "id"
          ],
          "must reference an existing basic-reaction scheduler row"
        );
        continue;
      }
      timelineLinkCounts[entry.id] =
        (timelineLinkCounts[entry.id] ?? 0) + 1;
      const expectedCause =
        entry.kind === "swirl-attack-resolution"
          ? "reaction-damage-application"
          : "reaction-aura-attachment";
      const expectedEventType =
        entry.kind === "swirl-attack-resolution"
          ? "reactionDamage"
          : "reactionAuraAttachment";
      if (
        point.frame !== entry.frame ||
        point.targetId !== entry.targetId ||
        point.eventPriority !== entry.eventPriority ||
        point.eventSequence !== entry.eventSequence ||
        point.eventType !== expectedEventType ||
        point.cause !== expectedCause ||
        point.reaction !== entry.reaction ||
        !basicReactionSchedulerWireEquals(
          point.reactions,
          entry.reactions
        ) ||
        !basicReactionSchedulerWireEquals(
          point.auraBefore,
          entry.auraBefore
        ) ||
        !basicReactionSchedulerWireEquals(
          point.auraApplied,
          entry.auraApplied
        ) ||
        !basicReactionSchedulerWireEquals(
          point.auraConsumed,
          entry.auraConsumed
        ) ||
        !basicReactionSchedulerWireEquals(
          point.auraAfter,
          entry.auraAfter
        )
      ) {
        issue(
          [
            "targetStateTimeline",
            "points",
            pointIndex,
            "links",
            linkIndex
          ],
          "scheduler timeline link must preserve the row event tuple and Aura projection"
        );
      }
    }
  }
  for (const [
    index,
    count
  ] of timelineLinkCounts.entries()) {
    if (count !== 1) {
      issue(
        ["basicReactionSchedulerLog", index],
        "each scheduler row requires exactly one target-state timeline link"
      );
    }
  }
}

/** Current 1.51 result wire with scheduler-root and attack/commit proof. */
export const simulationResultV151ValueSchema = z
  .object({
    ...simulationResultV150ValueSchema.shape,
    schemaVersion: z.literal(
      BASIC_REACTION_SCHEDULER_SCHEMA_VERSION
    ),
    engineVersion: z.literal(
      BASIC_REACTION_SCHEDULER_ENGINE_VERSION
    ),
    runManifest: simulationRunManifestV151Schema,
    config: simConfigV151Schema,
    targetStateTimeline: targetStateTimelineSchema,
    basicReactionSchedulerLog: z.array(
      basicReactionSchedulerLogEntrySchema
    )
  })
  .strict()
  .superRefine((result, context) => {
    const issue = (
      path: Array<string | number>,
      message: string
    ): void =>
      context.addIssue({ code: "custom", path, message });
    if (
      result.engineVersion !== result.config.engineVersion
    ) {
      issue(
        ["engineVersion"],
        "must equal config.engineVersion"
      );
    }
    if (result.dataVersion !== result.config.dataVersion) {
      issue(
        ["dataVersion"],
        "must equal config.dataVersion"
      );
    }
    if (
      result.randomSeed !==
      result.resolvedRuntimeOptions.randomSeed
    ) {
      issue(
        ["randomSeed"],
        "must equal resolvedRuntimeOptions.randomSeed"
      );
    }
    if (
      result.compatibilityMode !==
      result.resolvedRuntimeOptions.compatibilityMode
    ) {
      issue(
        ["compatibilityMode"],
        "must equal resolvedRuntimeOptions.compatibilityMode"
      );
    }
    if (
      result.reproducibilityKey !==
      result.runManifest.reproducibilityKey
    ) {
      issue(
        ["reproducibilityKey"],
        "must equal runManifest.reproducibilityKey"
      );
    }
    if (
      JSON.stringify(result.pluginManifest) !==
      JSON.stringify(result.runManifest.plugins)
    ) {
      issue(
        ["pluginManifest"],
        "must equal runManifest.plugins"
      );
    }
    try {
      parseSimulationRunManifestForConfig(
        result.runManifest,
        result.config
      );
    } catch (error) {
      issue(
        ["runManifest"],
        error instanceof Error
          ? error.message
          : "is not bound to the supplied migrated config"
      );
    }

    const selectedReactionOwnedPolicy =
      result.config.reactionOwnedElementalApplicationModel;
    for (const [
      index,
      entry
    ] of result.elementalApplicationIcdLog.entries()) {
      if (entry.sourceKind === "configured-direct-hit")
        continue;
      if (
        entry.selector.mode !==
          selectedReactionOwnedPolicy.mode ||
        entry.selector.policyId !==
          selectedReactionOwnedPolicy.policyId
      ) {
        issue(
          ["elementalApplicationIcdLog", index, "selector"],
          "must equal the reaction-owned policy selected by config"
        );
      }
      if (
        entry.decision.kind === "reaction-fixed-gcsim" &&
        entry.decision.policyId !==
          selectedReactionOwnedPolicy.policyId
      ) {
        issue(
          [
            "elementalApplicationIcdLog",
            index,
            "decision",
            "policyId"
          ],
          "must equal the reaction-owned policy selected by config"
        );
      }
    }

    const selectedDamageGroupPolicy =
      result.config.reactionDamageGroupModel.policyId;
    for (const [
      logIndex,
      reactionLog
    ] of result.reactionDamageLog.entries()) {
      for (const [
        decisionIndex,
        decision
      ] of reactionLog.damageGroupDecisions.entries()) {
        if (
          decision.policyId !== selectedDamageGroupPolicy
        ) {
          issue(
            [
              "reactionDamageLog",
              logIndex,
              "damageGroupDecisions",
              decisionIndex,
              "policyId"
            ],
            "must equal the reaction damage-group policy selected by config"
          );
        }
      }
    }
    for (const [
      index,
      reset
    ] of result.reactionDamageGroupResetLog.entries()) {
      if (reset.policyId !== selectedDamageGroupPolicy) {
        issue(
          [
            "reactionDamageGroupResetLog",
            index,
            "policyId"
          ],
          "must equal the reaction damage-group policy selected by config"
        );
      }
    }
    if (
      selectedDamageGroupPolicy ===
        GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID &&
      result.reactionDamageGroupResetLog.length !== 0
    ) {
      issue(
        ["reactionDamageGroupResetLog"],
        "the v1 lazy-window policy requires an empty reset-task log"
      );
    }

    validateBasicReactionSchedulerResult(
      result as SimulationResultForV151,
      context
    );

    const frozenReferenceView =
      projectV150ResultForFrozenReferenceFacets(
        result as unknown as SimulationResultForV150
      );
    const validateFacet = (
      label: string,
      schema: z.ZodType,
      view: unknown = frozenReferenceView
    ): void => {
      const parsed = schema.safeParse(view);
      if (parsed.success) return;
      for (const facetIssue of parsed.error.issues) {
        context.addIssue({
          code: "custom",
          path: [...facetIssue.path],
          message: `${label}: ${facetIssue.message}`
        });
      }
    };
    validateFacet(
      "enemy target references",
      enemyTargetsResultReferencesSchema
    );
    validateFacet(
      "reaction delivery references",
      reactionDeliveryResultReferencesSchema,
      result
    );
    validateFacet(
      "target task phase references",
      targetTaskPhaseResultReferencesSchema
    );
    if (
      result.config.targetTaskModel.mode !==
      "target-phase-v3"
    ) {
      validateFacet(
        "target phase v2 references",
        targetPhaseV2ResultReferencesSchema
      );
    }
    validateFacet(
      "player damage references",
      playerDamageResultReferencesSchema,
      result
    );
    validateFacet(
      "target clock references",
      targetClockResultReferencesSchema
    );
    const auraMode = result.config.reactionEngine?.mode;
    if (
      auraMode === "aura-v5" ||
      auraMode === "aura-v6" ||
      auraMode === "aura-v7" ||
      auraMode === "aura-v8" ||
      auraMode === "aura-v9"
    ) {
      validateFacet(
        "Dendro core references",
        dendroCoreResultReferencesSchema,
        result
      );
    }
    if (
      (auraMode === "aura-v8" || auraMode === "aura-v9") &&
      (result.reactionTaskLog.some(
        (task) => task.electroChargedCleanup !== null
      ) ||
        result.periodicReactionLog.some(
          (entry) => entry.reaction === "electroCharged"
        ))
    ) {
      validateFacet(
        "Electro-Charged cleanup references",
        electroChargedCleanupResultReferencesSchema
      );
    }
    validateSimulationResultV151Integrity(
      result as SimulationResultForV151,
      context
    );
  });

export const simulationResultV151Schema = z.preprocess(
  rejectNonPlainJsonWire("SimulationResult 1.51"),
  simulationResultV151ValueSchema
);

export type SimulationResultV151 = z.output<
  typeof simulationResultV151Schema
>;

/** Current public result boundary. Frozen versioned schemas remain exported. */
export const simulationResultSchema =
  simulationResultV151Schema;
export type ParsedSimulationResult = SimulationResultV151;

/** Strict public parser for exact frozen/current result identities. */
export function parseVersionedSimulationResult(
  input: unknown
): VersionedSimulationResult {
  const cleanInput = z
    .preprocess(
      rejectNonPlainJsonWire("SimulationResult"),
      z.record(z.string(), z.unknown())
    )
    .parse(input);
  const wire = cleanInput;
  const schemaVersion = wire.schemaVersion;
  const engineVersion = wire.engineVersion;
  if (
    schemaVersion ===
      BASIC_REACTION_SCHEDULER_SCHEMA_VERSION &&
    engineVersion ===
      BASIC_REACTION_SCHEDULER_ENGINE_VERSION
  ) {
    return simulationResultV151Schema.parse(
      cleanInput
    ) as VersionedSimulationResult;
  }
  if (
    schemaVersion ===
      REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION &&
    engineVersion ===
      REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION
  ) {
    return simulationResultV150Schema.parse(
      cleanInput
    ) as VersionedSimulationResult;
  }
  if (
    schemaVersion ===
      REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION &&
    engineVersion ===
      REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION
  ) {
    return simulationResultV149Schema.parse(
      cleanInput
    ) as VersionedSimulationResult;
  }
  if (
    schemaVersion ===
      REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION &&
    engineVersion ===
      REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION
  ) {
    return simulationResultV148Schema.parse(
      cleanInput
    ) as VersionedSimulationResult;
  }
  if (
    schemaVersion ===
      ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION &&
    engineVersion ===
      ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION
  ) {
    return simulationResultV147Schema.parse(
      cleanInput
    ) as VersionedSimulationResult;
  }
  if (
    schemaVersion ===
      DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION &&
    engineVersion ===
      DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION
  ) {
    return simulationResultV146Schema.parse(
      cleanInput
    ) as VersionedSimulationResult;
  }
  if (
    schemaVersion ===
      REACTION_FORMULA_ROOT_SCHEMA_VERSION &&
    engineVersion === REACTION_FORMULA_ROOT_ENGINE_VERSION
  ) {
    return simulationResultV145Schema.parse(
      cleanInput
    ) as VersionedSimulationResult;
  }
  if (
    schemaVersion ===
      BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION &&
    engineVersion ===
      BURNING_CALLBACK_DELIVERY_ENGINE_VERSION
  ) {
    return simulationResultV144Schema.parse(
      cleanInput
    ) as VersionedSimulationResult;
  }
  if (
    schemaVersion ===
      EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION &&
    engineVersion ===
      EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION
  ) {
    return simulationResultV142Schema.parse(
      cleanInput
    ) as unknown as VersionedSimulationResult;
  }
  throw new Error(
    `Unsupported SimulationResult identity ${String(schemaVersion)} / ${String(engineVersion)}`
  );
}
