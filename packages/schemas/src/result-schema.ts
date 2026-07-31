import { z } from "zod";
import {
  BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
  EC_GLOBAL_CADENCE_SAFETY_ENGINE_VERSION,
  EC_GLOBAL_CADENCE_SAFETY_SCHEMA_VERSION,
  type SimulationResult
} from "./types";
import {
  validateSimulationResultV142Integrity,
  validateSimulationResultV144Integrity
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
  enemyTargetsResultReferencesSchema,
  playerDamageEventSchema,
  playerDamageResultReferencesSchema,
  playerHitResolutionLogEntrySchema,
  playerHpSummarySchema,
  playerHpTimelineSchema,
  playerSelfDamageStatusSchema,
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
  simulationRunManifestV142Schema,
  simulationRunManifestV144Schema,
  targetClockAuditSchema,
  targetClockLogSchema,
  targetClockResultReferencesSchema,
  targetHitlagLogSchema,
  targetPhaseV2LogSchema,
  targetPhaseV2ResultReferencesSchema,
  targetPhaseV3LogSchema,
  targetStateTimelineSchema,
  targetTaskPhaseLogSchema,
  targetTaskPhaseResultReferencesSchema,
  transformativeReactionAuditSchema
} from "./schema";

const finiteNumberSchema = z.number().finite();
const nonNegativeFiniteNumberSchema = finiteNumberSchema.nonnegative();
const positiveFiniteNumberSchema = finiteNumberSchema.positive();
const integerSchema = z.number().int();
const nonNegativeIntegerSchema = integerSchema.nonnegative();
const positiveIntegerSchema = integerSchema.positive();
const frameSchema = nonNegativeIntegerSchema;
const nullableFrameSchema = frameSchema.nullable();
const nonEmptyStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, {
    message: "must not be blank"
  });
const nullableNonEmptyStringSchema = nonEmptyStringSchema.nullable();
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
const additiveReactionSchema = z.enum(["aggravate", "spread"]);
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
    shatterConsumedGaugeUnits: nonNegativeFiniteNumberSchema,
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
    blockedReason: z.literal("REACTION_QUEUE_GCD").nullable(),
    nextAvailableFrame: frameSchema,
    selfDamageFrame: frameSchema,
    propagationDamageFrame: frameSchema,
    selfBaseMultiplier: nonNegativeFiniteNumberSchema,
    propagationBaseMultiplier: nonNegativeFiniteNumberSchema,
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
    blockedReason: z.literal("REACTION_QUEUE_GCD").nullable(),
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
    periodicReaction: periodicReactionAuditV142Schema.nullable(),
    frozenReaction: frozenReactionAuditV142Schema.nullable(),
    shatterReaction: shatterReactionAuditV142Schema.nullable(),
    swirlReactions: z.array(swirlReactionAuditV142Schema),
    swirlDamageGroup: swirlDamageGroupAuditV142Schema.nullable(),
    crystallizeReaction:
      crystallizeReactionAuditV142Schema.nullable(),
    catalyzeReaction: catalyzeReactionAuditV142Schema.nullable(),
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
        message: "a triggered reaction cannot use reaction=none"
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
    parentDamageEventId: nonNegativeIntegerSchema.nullable(),
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
    targetDamageMultiplier: z.union([z.literal(0), z.literal(1)]),
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
    timelineCommandIndex: nonNegativeIntegerSchema.optional(),
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

    if (event.frame !== Math.round(event.timeSeconds * 60)) {
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
    if (event.displayDamage !== Math.round(event.finalDamage)) {
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
    if (
      event.targetIndex >= event.targetCount
    ) {
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
      ["scaling", event.scaling, event.damageFactors.scaling],
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
        issue([field], `must equal damageFactors/${field} source`);
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
    geometryRadius: nonNegativeFiniteNumberSchema.nullable(),
    geometryHalfWidth: nonNegativeFiniteNumberSchema.nullable(),
    geometryHalfHeight: nonNegativeFiniteNumberSchema.nullable(),
    geometryRotationDegrees: finiteNumberSchema.nullable(),
    geometryDirectionDegrees: finiteNumberSchema.nullable(),
    geometryAngleDegrees: finiteNumberSchema.nullable(),
    geometryDistance: nonNegativeFiniteNumberSchema.nullable(),
    geometryThreshold: nonNegativeFiniteNumberSchema.nullable(),
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
    timelineCommandIndex: nonNegativeIntegerSchema.optional(),
    sourceAbilityId: nonEmptyStringSchema.optional()
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.frame !== Math.round(entry.timeSeconds * 60)) {
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
    if (entry.displayDamage !== Math.round(entry.finalDamage)) {
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
    triggerDamageEventId: nonNegativeIntegerSchema.nullable(),
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
    selectionRadius: nonNegativeFiniteNumberSchema.nullable(),
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
    damageGroupBlockedTargetIds: z.array(nonEmptyStringSchema),
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
      entry.targetingMode === "electro-charged-nearby-wet" &&
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
      entry.targetingMode !== "electro-charged-nearby-wet" &&
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
      Math.abs(entry.startTimeSeconds - entry.startFrame / 60) >
        1e-9 ||
      Math.abs(entry.endTimeSeconds - entry.endFrame / 60) > 1e-9
    ) {
      context.addIssue({
        code: "custom",
        path: ["startTimeSeconds"],
        message: "status times must equal their frame boundaries / 60"
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
    triggerDamageEventId: nonNegativeIntegerSchema.nullable(),
    reactionTaskLogId: nonNegativeIntegerSchema.optional(),
    reactionDamageLogId: nonNegativeIntegerSchema.nullable(),
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
    if (Math.abs(entry.timeSeconds - entry.frame / 60) > 1e-9) {
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
    if (operationOwnsTickIndex !== (entry.tickIndex !== null)) {
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
    triggerDamageEventId: nonNegativeIntegerSchema.nullable(),
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
    if (Math.abs(entry.timeSeconds - entry.frame / 60) > 1e-9) {
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
    triggerDamageEventId: nonNegativeIntegerSchema.nullable(),
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
          message: "spawn must emit one successful complete shard snapshot"
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
          message: "pickup must emit a successful shard-to-shield transition"
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
          message: "pickup-attempt must describe TOO_EARLY or NO_MATCHING_SHARD"
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
      Math.abs(entry.startTimeSeconds - entry.startFrame / 60) >
        1e-9 ||
      Math.abs(entry.endTimeSeconds - entry.endFrame / 60) > 1e-9
    ) {
      context.addIssue({
        code: "custom",
        path: ["startTimeSeconds"],
        message: "timeline times must equal their frame boundaries / 60"
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
      Math.abs(entry.startTimeSeconds - entry.startFrame / 60) >
        1e-9 ||
      Math.abs(entry.endTimeSeconds - entry.endFrame / 60) > 1e-9
    ) {
      context.addIssue({
        code: "custom",
        path: ["startTimeSeconds"],
        message: "timeline times must equal their frame boundaries / 60"
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
    timelineCommandIndex: nonNegativeIntegerSchema.optional(),
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
    timelineCommandIndex: nonNegativeIntegerSchema.optional(),
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
    blockedReason: z.literal("INTERNAL_COOLDOWN").nullable(),
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
    code: z.enum([
      "ACTION_OVERLAP",
      "ABILITY_ON_COOLDOWN"
    ]),
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
    commandResults: z.array(timelineCommandResultV142Schema),
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
    pluginManifest: z.array(damagePluginManifestEntrySchema),
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
    hitResolutionLog: z.array(hitResolutionLogEntryV142Schema),
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
    timelineExecution: timelineExecutionV142Schema.optional()
  })
  .strict()
  .superRefine((result, context) => {
    const issue = (
      path: Array<string | number>,
      message: string
    ): void => context.addIssue({ code: "custom", path, message });
    if (result.engineVersion !== result.config.engineVersion) {
      issue(
        ["engineVersion"],
        "must equal config.engineVersion"
      );
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
    ): void => context.addIssue({ code: "custom", path, message });
    if (result.engineVersion !== result.config.engineVersion) {
      issue(
        ["engineVersion"],
        "must equal config.engineVersion"
      );
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
    if (result.config.targetTaskModel.mode !== "target-phase-v3") {
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

/** Current public result boundary. Frozen versioned schemas remain exported. */
export const simulationResultSchema = simulationResultV144Schema;
export type ParsedSimulationResult = SimulationResultV144;
