import { z } from "zod";
const text = z.string().trim().min(1), frame = z.number().int().nonnegative(), amount = z.number().finite().nonnegative();
/** Actual chronology is entered explicitly: the old gcsim HP callback order conflicts with independent evidence. */
export const travelerHydroResolvedEventSchema = z.strictObject({
  candidateId: text, templateRole: z.enum(["dew", "torrent", "thorn"]),
  launchFrame: frame, frame, snapshotFrame: frame, snapshotId: text, targetId: text,
  hpReadFrame: frame.optional(), hpReadOrder: frame.optional(),
  actualCurrentHp: amount.optional(), actualMaxHp: amount.positive().optional(),
  consumedHpThisCast: amount.optional(),
  /** A saved or directly entered event's qualification belongs to this hit, not a future cast. */
  observedSourceEvent: z.boolean().optional(),
});
export type TravelerHydroResolvedEvent = z.infer<typeof travelerHydroResolvedEventSchema>;
export const travelerHydroResolvedHitStateSchema = z.strictObject({
  includedSourceFlatDamage: amount.optional(),
});
export const travelerHydroResolvedHpEventSchema = z.discriminatedUnion("kind", [
  z.strictObject({ id: text, frame, order: frame, kind: z.literal("suffusion") }),
  z.strictObject({ id: text, frame, order: frame, kind: z.literal("observed-hp-state"), currentHp: amount, maxHp: amount.positive(), reason: text }),
]);
export const travelerHydroResolvedCastBaseSchema = z.strictObject({
  casterId: text.optional(), targetId: text.optional(), trueMoonStoryBuffInactive: z.boolean().optional(),
  freshCastConfirmed: z.boolean().optional(), noHitlag: z.boolean().optional(),
  noInterruption: z.boolean().optional(), noReplacement: z.boolean().optional(),
  fullObservedLifetime: z.boolean().optional(), allHpChangesRecorded: z.boolean().optional(), allDamageEventsRecorded: z.boolean().optional(),
  observedThroughFrame: frame.optional(), statsStableAcrossHits: z.boolean().optional(),
  initialCurrentHp: amount.optional(), initialMaxHp: amount.positive().optional(),
  releaseFrame: frame.optional(), releaseOrder: frame.optional(),
  dewCount: z.number().int().min(1).max(22).optional(), spiritbreathTriggered: z.boolean().optional(),
  hpEvents: z.array(travelerHydroResolvedHpEventSchema).optional(),
  events: z.array(travelerHydroResolvedEventSchema).optional(),
  targetContacts: z.record(text, z.boolean()).optional(),
  sharedState: travelerHydroResolvedHitStateSchema.optional(),
  hitStates: z.record(text, travelerHydroResolvedHitStateSchema).optional(),
  independentEvent: travelerHydroResolvedEventSchema.optional(),
  finalizedHitEvents: z.record(text, text).optional(),
});
export type TravelerHydroResolvedScheduleContext = z.infer<typeof travelerHydroResolvedCastBaseSchema>;
