import { z } from "zod";
const text = z.string().trim().min(1), frame = z.number().int().nonnegative(), amount = z.number().finite().nonnegative();
export const zibaiFiniteEventSchema = z.strictObject({
  candidateId: text, templateRole: z.enum(["ordinary", "lunar"]), frame, snapshotFrame: frame, snapshotId: text, targetId: text,
});
/** Ratios use 0.15 for 15%. Missing values remain unknown, including zero shares. */
export const zibaiFiniteHitStateSchema = z.strictObject({
  otherGeoTeammates: z.number().int().min(0).max(3).optional(), hydroTeammates: z.number().int().min(0).max(3).optional(),
  baseDefense: amount.optional(), includedA4DefensePercent: amount.optional(), includedA4ElementalMastery: amount.optional(),
  a1WindowActive: z.boolean().optional(),
  specialBaseBonus: amount.optional(), includedIntrinsicBaseBonus: amount.max(.14).optional(),
  reactionBonus: amount.optional(), specialAdditive: amount.optional(), includedA1Additive: amount.optional(),
  elevationMultiplier: amount.positive().optional(),
});
export const zibaiFiniteCastBaseSchema = z.strictObject({
  casterId: text.optional(), targetId: text.optional(), legalCastConfirmed: z.boolean().optional(),
  spiritSteedRecastConfirmed: z.boolean().optional(), fullObservedLifetime: z.boolean().optional(),
  observedThroughFrame: frame.optional(), statsStableAcrossHits: z.boolean().optional(),
  observations: z.array(zibaiFiniteEventSchema).max(2).optional(), independentEvent: zibaiFiniteEventSchema.optional(),
  targetContacts: z.record(text, z.boolean()).optional(), sharedState: zibaiFiniteHitStateSchema.optional(),
  hitStates: z.record(text, zibaiFiniteHitStateSchema).optional(), finalizedHitEvents: z.record(text, text).optional(),
});
export type ZibaiFiniteScheduleContext = z.infer<typeof zibaiFiniteCastBaseSchema>;
export type ZibaiFiniteEvent = z.infer<typeof zibaiFiniteEventSchema>;
export type ZibaiFiniteHitState = z.infer<typeof zibaiFiniteHitStateSchema>;
