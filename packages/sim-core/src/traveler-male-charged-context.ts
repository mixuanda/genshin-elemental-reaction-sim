import { z } from "zod";

const text = z.string().trim().min(1), frame = z.number().int().nonnegative();
const number = z.number().finite(), bool = z.boolean();

/** These qualifications belong to the actual hit, including independent single hits. */
export const travelerMaleChargedHitStateSchema = z.strictObject({
  externalInfusionActive: bool.optional(),
  trueMoonStoryBuffEnabled: bool.optional(),
  cryoSkillActive: bool.optional(),
  cryoRadiance: z.enum(["none", "stellar-conduct", "stellar-swirl"]).optional(),
  cryoTrueMoonStacks: z.number().int().min(0).max(3).optional(),
});

export const travelerMaleChargedEventSchema = z.strictObject({
  candidateId: z.enum(["hit-1", "hit-2"]),
  templateRole: z.enum(["hit-1", "hit-2"]),
  frame, snapshotFrame: frame, snapshotId: text, targetId: text,
});

/** calculator-model attaches its final-snapshot schema without a circular import. */
export const travelerMaleChargedCastBaseSchema = z.strictObject({
  casterId: text.optional(), targetId: text.optional(), freshCastConfirmed: bool.optional(),
  noHitlag: bool.optional(), noInterruption: bool.optional(), noReplacement: bool.optional(),
  fullObservedLifetime: bool.optional(), observedThroughFrame: frame.optional(),
  statsStableAcrossHits: bool.optional(),
  precedingNormalAttackConfirmed: bool.optional(),
  normalCounterBeforeCast: z.number().int().min(0).max(4).optional(),
  actionReadyConfirmed: bool.optional(),
  initialStamina: number.nonnegative().optional(),
  staminaCostMultiplier: number.nonnegative().optional(),
  targetContacts: z.record(text, bool).optional(),
  sharedState: travelerMaleChargedHitStateSchema.optional(),
  hitStates: z.record(text, travelerMaleChargedHitStateSchema).optional(),
  finalizedHitEvents: z.record(text, text).optional(),
});

export type TravelerMaleChargedScheduleContext = z.infer<typeof travelerMaleChargedCastBaseSchema>;
export type TravelerMaleChargedHitState = z.infer<typeof travelerMaleChargedHitStateSchema>;
export type TravelerMaleChargedEvent = z.infer<typeof travelerMaleChargedEventSchema>;
