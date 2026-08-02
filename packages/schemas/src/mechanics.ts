import { z } from "zod";
import {
  abilityCancelFramesSchema,
  abilityTimelineStateSchema,
  directDamageGroupDefinitionSchema,
  elementalApplicationV146Schema,
  elementalApplicationV147Schema,
  rejectNonPlainJsonWire
} from "./schema";

export const ELEMENTAL_APPLICATION_ICD_MECHANICS_SCHEMA_VERSION =
  "1.9.0" as const;
export const DIRECT_DAMAGE_GROUP_MECHANICS_SCHEMA_VERSION =
  "1.8.0" as const;
export const CURRENT_MECHANICS_SCHEMA_VERSION =
  ELEMENTAL_APPLICATION_ICD_MECHANICS_SCHEMA_VERSION;
export const PRE_DIRECT_DAMAGE_GROUP_MECHANICS_SCHEMA_VERSION =
  "1.7.0" as const;
export const MOVEMENT_COMMAND_MECHANICS_SCHEMA_VERSION = "1.6.0" as const;
export const HIT_PARTICLE_TRIGGER_MECHANICS_SCHEMA_VERSION =
  "1.5.0" as const;
export const FIXED_ENERGY_ICD_MECHANICS_SCHEMA_VERSION = "1.4.0" as const;
export const RUNTIME_ENERGY_MECHANICS_SCHEMA_VERSION = "1.3.0" as const;
export const FOLLOWUP_CANCEL_MECHANICS_SCHEMA_VERSION = "1.2.0" as const;
export const ACTION_STATE_MECHANICS_SCHEMA_VERSION = "1.1.0" as const;
export const INITIAL_MECHANICS_SCHEMA_VERSION = "1.0.0" as const;

const idSchema = z.string().trim().min(1);
const finiteNumber = z.number().finite();

export const mechanicsEvidenceSchema = z
  .object({
    source: idSchema,
    sourceVersion: idSchema,
    url: z.string().url(),
    path: idSchema,
    verifiedAt: z.string().datetime(),
    verificationStatus: z.enum([
      "verified",
      "provisional",
      "user-supplied"
    ]),
    notes: idSchema
  })
  .strict();

export const talentParameterReferenceSchema = z
  .object({
    talentSetId: idSchema,
    abilityKey: idSchema,
    parameterKey: idSchema,
    talentLevel: z.number().int().min(1).max(15)
  })
  .strict();

const mappedHitBlueprintBaseShape = {
  id: idSchema,
  label: idSchema,
  frame: z.number().int().min(0),
  scalingRef: talentParameterReferenceSchema,
  scalingStat: z.enum(["atk", "hp", "def", "em"]).default("atk"),
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
  directDamageGroup: directDamageGroupDefinitionSchema.optional(),
  snapshot: z.enum(["action", "hit"]).default("hit")
} as const;

/** Exact frozen mapped-hit wire used by mechanics schema 1.8. */
export const mappedHitBlueprintV18Schema = z.preprocess(
  rejectNonPlainJsonWire("mapped hit blueprint"),
  z
    .object({
      ...mappedHitBlueprintBaseShape,
      application: elementalApplicationV146Schema.optional()
    })
    .strict()
);

/** Current mapped-hit wire; every application carries an explicit selector. */
export const mappedHitBlueprintSchema = z.preprocess(
  rejectNonPlainJsonWire("mapped hit blueprint"),
  z
    .object({
      ...mappedHitBlueprintBaseShape,
      application: elementalApplicationV147Schema.optional()
    })
    .strict()
);

export const mappedEnergyGainBlueprintSchema = z
  .object({
    target: idSchema,
    frame: z.number().int().min(0),
    amountRef: talentParameterReferenceSchema,
    source: idSchema,
    internalCooldown: z
      .object({
        key: idSchema,
        durationFrames: z.number().int().positive()
      })
      .strict()
      .optional()
  })
  .strict();

export const mappedParticleBlueprintSchema = z
  .object({
    id: idSchema,
    source: idSchema,
    element: z.enum([
      "pyro",
      "cryo",
      "hydro",
      "electro",
      "anemo",
      "geo",
      "dendro",
      "neutral"
    ]),
    kind: z.enum(["particle", "orb"]).default("particle"),
    count: finiteNumber.positive(),
    spawnFrame: z.number().int().min(0).optional(),
    travelFrames: z.number().int().min(0),
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
    if (
      particle.trigger === undefined &&
      particle.spawnFrame === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["spawnFrame"],
        message: "is required without a hit-confirm trigger"
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

const abilityBlueprintBaseShape = {
  mappingVersion: idSchema,
  dataVersion: idSchema,
  id: idSchema,
  catalogCharacterId: idSchema,
  actorId: idSchema,
  name: idSchema,
  kind: z.enum(["skill", "burst", "normal", "charge"]),
  verificationStatus: z.enum([
    "provisional",
    "verified",
    "user-supplied"
  ]),
  simulationStatus: z.enum(["partial", "mechanics-mapped"]),
  cancelFrame: z.number().int().min(0),
  cancelFrames: abilityCancelFramesSchema.optional(),
  animationEndFrame: z.number().int().min(0),
  cooldownFrames: z.number().int().min(0),
  maxCharges: z.number().int().min(1).max(10).optional(),
  chargeRecoveryFrames: z.number().int().min(0).optional(),
  energyCost: finiteNumber.min(0).optional(),
  energyGains: z.array(mappedEnergyGainBlueprintSchema).default([]),
  particles: z.array(mappedParticleBlueprintSchema).default([]),
  timelineState: abilityTimelineStateSchema.optional(),
  prerequisites: z.array(idSchema),
  unresolvedMechanics: z.array(idSchema),
  evidence: z.array(mechanicsEvidenceSchema).min(1)
} as const;

interface AbilityBlueprintValidationInput {
  cancelFrame: number;
  cancelFrames?:
    | {
        normal?: number | undefined;
        charge?: number | undefined;
        skill?: number | undefined;
        burst?: number | undefined;
        dash?: number | undefined;
        jump?: number | undefined;
        swap?: number | undefined;
      }
    | undefined;
  animationEndFrame: number;
  simulationStatus: "partial" | "mechanics-mapped";
  unresolvedMechanics: string[];
  hits: Array<{ id: string }>;
  particles: Array<{
    trigger?: { hitIds: string[] } | undefined;
  }>;
}

function validateAbilityBlueprint(
  blueprint: AbilityBlueprintValidationInput,
  context: z.RefinementCtx
): void {
  if (blueprint.cancelFrame > blueprint.animationEndFrame) {
    context.addIssue({
      code: "custom",
      path: ["cancelFrame"],
      message: "must not exceed animationEndFrame"
    });
  }
  for (const [followup, cancelFrame] of Object.entries(
    blueprint.cancelFrames ?? {}
  )) {
    if (
      cancelFrame !== undefined &&
      cancelFrame > blueprint.animationEndFrame
    ) {
      context.addIssue({
        code: "custom",
        path: ["cancelFrames", followup],
        message: "must not exceed animationEndFrame"
      });
    }
  }
  if (
    blueprint.simulationStatus === "mechanics-mapped" &&
    blueprint.unresolvedMechanics.length > 0
  ) {
    context.addIssue({
      code: "custom",
      path: ["unresolvedMechanics"],
      message: "mechanics-mapped abilities cannot retain unresolved mechanics"
    });
  }
  if (
    blueprint.simulationStatus === "partial" &&
    blueprint.unresolvedMechanics.length === 0
  ) {
    context.addIssue({
      code: "custom",
      path: ["unresolvedMechanics"],
      message: "partial abilities must state what remains unresolved"
    });
  }
  const hitIds = new Set<string>();
  blueprint.hits.forEach((hit, index) => {
    if (hitIds.has(hit.id)) {
      context.addIssue({
        code: "custom",
        path: ["hits", index, "id"],
        message: `duplicate hit id "${hit.id}"`
      });
    }
    hitIds.add(hit.id);
  });
  blueprint.particles.forEach((particle, particleIndex) => {
    particle.trigger?.hitIds.forEach((hitId, hitIndex) => {
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
          message: `unknown blueprint hit id "${hitId}"`
        });
      }
    });
  });
}

const abilityBlueprintV18ValueSchema = z
  .object({
    schemaVersion: z.literal(DIRECT_DAMAGE_GROUP_MECHANICS_SCHEMA_VERSION),
    ...abilityBlueprintBaseShape,
    hits: z.array(mappedHitBlueprintV18Schema)
  })
  .strict()
  .superRefine(validateAbilityBlueprint);

const abilityBlueprintValueSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_MECHANICS_SCHEMA_VERSION),
    ...abilityBlueprintBaseShape,
    hits: z.array(mappedHitBlueprintSchema)
  })
  .strict()
  .superRefine(validateAbilityBlueprint);

const plainAbilityBlueprintWireSchema = z.preprocess(
  rejectNonPlainJsonWire("ability blueprint"),
  z.unknown()
);

/**
 * Public blueprint parsing is a JSON-wire boundary. Sanitize the complete
 * graph before any shaped Schema reads a property so inherited fields,
 * accessors, cycles, symbols, and non-finite values fail closed.
 */
export const abilityBlueprintSchema = z.preprocess(
  rejectNonPlainJsonWire("ability blueprint"),
  abilityBlueprintValueSchema
);

/** Exact frozen mechanics-schema 1.8 authoring wire. */
export const abilityBlueprintV18Schema = z.preprocess(
  rejectNonPlainJsonWire("ability blueprint"),
  abilityBlueprintV18ValueSchema
);

export type MechanicsEvidence = z.infer<typeof mechanicsEvidenceSchema>;
export type TalentParameterReference = z.infer<
  typeof talentParameterReferenceSchema
>;
export type AbilityBlueprint = z.infer<typeof abilityBlueprintSchema>;

function migrateLegacyElementalApplication(
  application: z.infer<typeof elementalApplicationV146Schema>
): z.infer<typeof elementalApplicationV147Schema> {
  return {
    gaugeUnits: application.gaugeUnits,
    icd:
      application.icdGroup === "no-icd"
        ? { mode: "no-icd-v1" }
        : {
            mode: "legacy-boolean-profile-v1",
            icdTag: application.icdTag,
            profileId: application.icdGroup
          }
  };
}

export function migrateAbilityBlueprint(input: unknown): AbilityBlueprint {
  // This must be the first operation: migration cannot inspect a version or
  // spread an untrusted object because either operation may execute a getter.
  const plainInput = plainAbilityBlueprintWireSchema.parse(input);
  const plainBlueprint =
    typeof plainInput === "object" && plainInput !== null
      ? (plainInput as Record<string, unknown>)
      : null;
  if (
    plainBlueprint !== null &&
    Object.hasOwn(plainBlueprint, "schemaVersion") &&
    (plainBlueprint.schemaVersion === INITIAL_MECHANICS_SCHEMA_VERSION ||
      plainBlueprint.schemaVersion ===
        ACTION_STATE_MECHANICS_SCHEMA_VERSION ||
      plainBlueprint.schemaVersion ===
        FOLLOWUP_CANCEL_MECHANICS_SCHEMA_VERSION ||
      plainBlueprint.schemaVersion ===
        RUNTIME_ENERGY_MECHANICS_SCHEMA_VERSION ||
      plainBlueprint.schemaVersion ===
        FIXED_ENERGY_ICD_MECHANICS_SCHEMA_VERSION ||
      plainBlueprint.schemaVersion ===
        HIT_PARTICLE_TRIGGER_MECHANICS_SCHEMA_VERSION ||
      plainBlueprint.schemaVersion ===
        MOVEMENT_COMMAND_MECHANICS_SCHEMA_VERSION ||
      plainBlueprint.schemaVersion ===
        PRE_DIRECT_DAMAGE_GROUP_MECHANICS_SCHEMA_VERSION ||
      plainBlueprint.schemaVersion ===
        DIRECT_DAMAGE_GROUP_MECHANICS_SCHEMA_VERSION)
  ) {
    const frozenV18 = abilityBlueprintV18ValueSchema.parse({
      ...plainBlueprint,
      schemaVersion: DIRECT_DAMAGE_GROUP_MECHANICS_SCHEMA_VERSION
    });
    return abilityBlueprintValueSchema.parse({
      ...frozenV18,
      schemaVersion: CURRENT_MECHANICS_SCHEMA_VERSION,
      hits: frozenV18.hits.map((hit) => ({
        ...hit,
        ...(hit.application === undefined
          ? {}
          : {
              application: migrateLegacyElementalApplication(
                hit.application
              )
            })
      }))
    });
  }
  return abilityBlueprintValueSchema.parse(plainInput);
}
