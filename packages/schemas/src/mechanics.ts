import { z } from "zod";
import {
  abilityCancelFramesSchema,
  abilityTimelineStateSchema
} from "./schema";

export const CURRENT_MECHANICS_SCHEMA_VERSION = "1.5.0" as const;
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

export const mappedHitBlueprintSchema = z
  .object({
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
    application: z
      .object({
        gaugeUnits: finiteNumber.positive().max(20),
        icdTag: idSchema,
        icdGroup: idSchema
      })
      .strict()
      .optional(),
    snapshot: z.enum(["action", "hit"]).default("hit")
  })
  .strict();

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

export const abilityBlueprintSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_MECHANICS_SCHEMA_VERSION),
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
    hits: z.array(mappedHitBlueprintSchema),
    energyGains: z.array(mappedEnergyGainBlueprintSchema).default([]),
    particles: z.array(mappedParticleBlueprintSchema).default([]),
    timelineState: abilityTimelineStateSchema.optional(),
    prerequisites: z.array(idSchema),
    unresolvedMechanics: z.array(idSchema),
    evidence: z.array(mechanicsEvidenceSchema).min(1)
  })
  .strict()
  .superRefine((blueprint, context) => {
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
        message:
          "mechanics-mapped abilities cannot retain unresolved mechanics"
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
  });

export type MechanicsEvidence = z.infer<typeof mechanicsEvidenceSchema>;
export type TalentParameterReference = z.infer<
  typeof talentParameterReferenceSchema
>;
export type AbilityBlueprint = z.infer<typeof abilityBlueprintSchema>;

export function migrateAbilityBlueprint(input: unknown): AbilityBlueprint {
  if (
    typeof input === "object" &&
    input !== null &&
    "schemaVersion" in input &&
    (input.schemaVersion === INITIAL_MECHANICS_SCHEMA_VERSION ||
      input.schemaVersion === ACTION_STATE_MECHANICS_SCHEMA_VERSION ||
      input.schemaVersion === FOLLOWUP_CANCEL_MECHANICS_SCHEMA_VERSION ||
      input.schemaVersion === RUNTIME_ENERGY_MECHANICS_SCHEMA_VERSION ||
      input.schemaVersion === FIXED_ENERGY_ICD_MECHANICS_SCHEMA_VERSION)
  ) {
    return abilityBlueprintSchema.parse({
      ...input,
      schemaVersion: CURRENT_MECHANICS_SCHEMA_VERSION
    });
  }
  return abilityBlueprintSchema.parse(input);
}
