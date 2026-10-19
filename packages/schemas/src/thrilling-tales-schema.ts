import { z } from "zod";

export const thrillingTalesModelSchema = z.object({
  mode: z.literal("fixed-source-no-character-hitlag-v1"),
  actors: z.array(z.object({
    actorId: z.string().trim().min(1),
    refinement: z.number().int().min(1).max(5)
  }).strict()).min(1).max(4)
}).strict();

const nonNegativeIntegerSchema = z.number().int().nonnegative();
const nonNegativeFiniteNumberSchema = z.number().finite().nonnegative();
const nonEmptyStringSchema = z.string().min(1);

export const thrillingTalesLogEntrySchema = z.object({
  id: nonNegativeIntegerSchema,
  sourceProfileId: z.literal("gcsim-thrilling-tales-v1"),
  sourceRef: nonEmptyStringSchema,
  ownerId: nonEmptyStringSchema,
  recipientId: nonEmptyStringSchema,
  refinement: z.number().int().min(1).max(5),
  coefficient: nonNegativeFiniteNumberSchema,
  frame: nonNegativeIntegerSchema,
  timeSeconds: nonNegativeFiniteNumberSchema,
  eventPriority: nonNegativeFiniteNumberSchema,
  eventSequence: nonNegativeIntegerSchema,
  actionId: nonEmptyStringSchema,
  cycle: nonNegativeIntegerSchema,
  timelineCommandIndex: nonNegativeIntegerSchema.nullable(),
  actionLogIndex: nonNegativeIntegerSchema.nullable(),
  skippedActionIndex: nonNegativeIntegerSchema.nullable(),
  outcome: z.enum(["applied", "owner-cooldown", "recipient-already-buffed"]),
  cooldownExpiresFrameBefore: nonNegativeIntegerSchema.nullable(),
  cooldownExpiresFrameAfter: nonNegativeIntegerSchema.nullable(),
  recipientExpiresFrameBefore: nonNegativeIntegerSchema.nullable(),
  recipientExpiresFrameAfter: nonNegativeIntegerSchema.nullable(),
  swapKind: z.enum(["legal-completed", "legacy-implicit"])
}).strict();
