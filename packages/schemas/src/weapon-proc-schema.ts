import { z } from "zod";

export const hitAttackTagSchema = z.enum([
  "normal", "charged", "skill", "burst", "plunge", "proc"
]);

export const weaponProcWeaponIdSchema = z.enum([
  "halberd", "ashgravendrinkinghorn", "sequenceofsolitude",
  "filletblade", "prototypearchaic", "snowtombedstarsilver", "dragonspinespear", "frostbearer",
  "flute", "debateclub", "crescentpike", "endoftheline", "messenger",
  "theviridescenthunt", "swordofnarzissenkreuz", "eyeofperception"
]);

export const weaponProcModelSchema = z.object({
  mode: z.literal("fixed-source-no-character-hitlag-v1"),
  actors: z.array(z.object({
    actorId: z.string().trim().min(1),
    weaponId: weaponProcWeaponIdSchema,
    refinement: z.number().int().min(1).max(5),
    physicalDamageBonus: z.number().finite().min(0),
    hasInnateArkhe: z.boolean().optional(),
    eyeOfPerceptionProfile: z.literal("gcsim-implementation-v1").optional()
  }).strict().superRefine((actor, context) => {
    if (actor.weaponId === "swordofnarzissenkreuz" && actor.hasInnateArkhe === undefined) {
      context.addIssue({ code: "custom", path: ["hasInnateArkhe"], message: "Sword of Narzissenkreuz requires explicit innate Arkhe eligibility" });
    } else if (actor.weaponId !== "swordofnarzissenkreuz" && actor.hasInnateArkhe !== undefined) {
      context.addIssue({ code: "custom", path: ["hasInnateArkhe"], message: "innate Arkhe eligibility belongs only to Sword of Narzissenkreuz" });
    }
    if (actor.weaponId === "eyeofperception" && actor.eyeOfPerceptionProfile === undefined) {
      context.addIssue({ code: "custom", path: ["eyeOfPerceptionProfile"], message: "Eye of Perception requires an explicit conflicting gcsim implementation profile" });
    } else if (actor.weaponId !== "eyeofperception" && actor.eyeOfPerceptionProfile !== undefined) {
      context.addIssue({ code: "custom", path: ["eyeOfPerceptionProfile"], message: "Eye of Perception profile belongs only to that weapon" });
    }
  })).min(1).max(4)
}).strict();

const nonNegativeIntegerSchema = z.number().int().nonnegative();
const nonNegativeFiniteNumberSchema = z.number().finite().nonnegative();
const nonEmptyStringSchema = z.string().min(1);

export const weaponProcLifecycleStateSchema = z.object({
  effectExpiresFrame: nonNegativeIntegerSchema.nullable(),
  hitCooldownExpiresFrame: nonNegativeIntegerSchema.nullable(),
  activationCooldownExpiresFrame: nonNegativeIntegerSchema.nullable(),
  notes: z.number().int().min(0).max(4),
  procCount: z.number().int().min(0).max(3)
}).strict();

export const weaponProcLifecycleLogEntrySchema = z.object({
  id: nonNegativeIntegerSchema,
  sourceProfileId: z.literal("gcsim-stateful-weapon-proc-v1"),
  sourceRef: nonEmptyStringSchema,
  actorId: nonEmptyStringSchema,
  weaponId: z.enum(["flute", "debateclub", "crescentpike", "endoftheline"]),
  refinement: z.number().int().min(1).max(5),
  frame: nonNegativeIntegerSchema,
  timeSeconds: nonNegativeFiniteNumberSchema,
  eventPriority: nonNegativeFiniteNumberSchema,
  eventSequence: nonNegativeIntegerSchema,
  kind: z.enum(["skill", "particle-received"]),
  actionLogIndex: nonNegativeIntegerSchema.nullable(),
  particleEventId: nonNegativeIntegerSchema.nullable(),
  activeCharacterId: nonEmptyStringSchema.nullable(),
  outcome: z.enum(["window-activated", "off-field", "activation-cooldown-blocked"]),
  stateBefore: weaponProcLifecycleStateSchema,
  stateAfter: weaponProcLifecycleStateSchema
}).strict();
