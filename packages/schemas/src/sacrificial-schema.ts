import { z } from "zod";
import { hitAttackTagSchema } from "./weapon-proc-schema";

export const sacrificialWeaponIdSchema = z.enum([
  "sacrificialsword", "sacrificialgreatsword", "sacrificialbow", "sacrificialfragments"
]);

export const sacrificialModelSchema = z.object({
  mode: z.literal("fixed-source-no-character-hitlag-v1"),
  actors: z.array(z.object({
    actorId: z.string().trim().min(1),
    weaponId: sacrificialWeaponIdSchema,
    refinement: z.number().int().min(1).max(5)
  }).strict()).min(1).max(4)
}).strict();

const nonNegativeIntegerSchema = z.number().int().nonnegative();
const nonNegativeFiniteNumberSchema = z.number().finite().nonnegative();
const nonEmptyStringSchema = z.string().min(1);

export const serialSkillCooldownStateSchema = z.object({
  maxCharges: z.number().int().positive(),
  availableCharges: nonNegativeIntegerSchema,
  queue: z.array(z.object({
    castId: nonEmptyStringSchema,
    abilityId: nonEmptyStringSchema,
    recoveryFrames: z.number().int().positive()
  }).strict()),
  workerStartedFrame: nonNegativeIntegerSchema.nullable(),
  workerGeneration: nonNegativeIntegerSchema
}).strict();

export const sacrificialLogEntrySchema = z.object({
  id: nonNegativeIntegerSchema,
  sourceProfileId: z.literal("gcsim-sacrificial-v1"),
  sourceRef: nonEmptyStringSchema,
  rngStream: z.literal("sacrificial-v1"),
  actorId: nonEmptyStringSchema,
  weaponId: sacrificialWeaponIdSchema,
  refinement: z.number().int().min(1).max(5),
  frame: nonNegativeIntegerSchema,
  timeSeconds: nonNegativeFiniteNumberSchema,
  eventPriority: nonNegativeFiniteNumberSchema,
  eventSequence: nonNegativeIntegerSchema,
  damageEventId: nonNegativeIntegerSchema,
  activeCharacterId: nonEmptyStringSchema.nullable(),
  attackTag: hitAttackTagSchema.nullable(),
  damage: nonNegativeFiniteNumberSchema,
  probability: z.number().finite().min(0).max(1),
  cooldownFrames: nonNegativeIntegerSchema,
  cooldownExpiresFrameBefore: nonNegativeIntegerSchema.nullable(),
  cooldownExpiresFrameAfter: nonNegativeIntegerSchema.nullable(),
  skillCooldownBefore: z.number().finite().nullable(),
  outcome: z.enum(["off-field", "attack-tag-blocked", "cooldown-blocked", "skill-ready", "zero-damage", "failed-roll", "triggered"]),
  roll: z.number().finite().min(0).lt(1).nullable(),
  drawIndex: nonNegativeIntegerSchema.nullable(),
  drawCountBefore: nonNegativeIntegerSchema,
  drawCountAfter: nonNegativeIntegerSchema,
  skillCooldownLogId: nonNegativeIntegerSchema.nullable()
}).strict();

export const skillCooldownLogEntrySchema = z.object({
  artifactEventLogId: nonNegativeIntegerSchema.optional(),
  id: nonNegativeIntegerSchema,
  actorId: nonEmptyStringSchema,
  actionId: nonEmptyStringSchema.nullable(),
  abilityId: nonEmptyStringSchema.nullable(),
  timelineCommandIndex: nonNegativeIntegerSchema.nullable(),
  frame: nonNegativeIntegerSchema,
  timeSeconds: nonNegativeFiniteNumberSchema,
  eventPriority: z.number().int().min(-1),
  eventSequence: nonNegativeIntegerSchema,
  operation: z.enum(["start", "recover", "reset", "stale-worker"]),
  workerGeneration: nonNegativeIntegerSchema.nullable(),
  sacrificialLogId: nonNegativeIntegerSchema.nullable(),
  stateBefore: serialSkillCooldownStateSchema,
  stateAfter: serialSkillCooldownStateSchema
}).strict();
