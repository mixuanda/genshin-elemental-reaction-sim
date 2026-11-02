import { z } from "zod";

const text = z.string().trim().min(1);
const frame = z.number().int().nonnegative();
const amount = z.number().finite().nonnegative();
export const travelerAnemoAbsorbedElementSchema = z.enum(["pyro", "hydro", "cryo", "electro"]);
export type TravelerAnemoAbsorbedElement = z.infer<typeof travelerAnemoAbsorbedElementSchema>;

export const travelerCrossEntityEventSchema = z.strictObject({
  candidateId: text, templateRole: z.enum(["tick", "absorbed-tick"]), frame, snapshotFrame: frame,
  snapshotId: text, targetId: text,
  absorbedElement: travelerAnemoAbsorbedElementSchema.optional(),
  /** Derived from earlier actual same-element contacts, never this hit's callback. */
  c6ActiveBeforeHit: z.boolean().optional(),
  /** Saved eligibility of a generated tick survives projection to single-hit. */
  untransformedAtHit: z.boolean().optional(),
});
export type TravelerCrossEntityEvent = z.infer<typeof travelerCrossEntityEventSchema>;

export const travelerCrossEntityHitStateSchema = z.strictObject({
  /** Dendro A4 reads current EM at impact, independently of the lamp snapshot. */
  actualEm: amount.optional(),
  actualEmIncludesLotuslight: z.boolean().optional(),
  includedA4DamageBonus: amount.optional(),
  /** The independent event proves only this already-occurring tick's branch. */
  untransformedAtHit: z.boolean().optional(),
  c6ActiveBeforeHit: z.boolean().optional(),
  includedC6ResistanceReduction: amount.max(.2).optional(),
});
export type TravelerCrossEntityHitState = z.infer<typeof travelerCrossEntityHitStateSchema>;

export const travelerCrossEntityCastBaseSchema = z.strictObject({
  casterId: text.optional(), targetId: text.optional(),
  trueMoonStoryBuffInactive: z.boolean().optional(),
  freshCastConfirmed: z.boolean().optional(), noHitlag: z.boolean().optional(),
  noInterruption: z.boolean().optional(), noReplacement: z.boolean().optional(),
  fullObservedLifetime: z.boolean().optional(), observedThroughFrame: frame.optional(),
  /** A common input panel represents the actual source snapshot, not live EM. */
  statsStableAcrossHits: z.boolean().optional(),
  targetContacts: z.record(text, z.boolean()).optional(),
  anemo: z.strictObject({
    noAbsorption: z.boolean().optional(),
    singleHitRole: z.enum(["tick", "absorbed-tick"]).optional(),
    absorptionElement: travelerAnemoAbsorbedElementSchema.optional(),
    absorptionStartFrame: frame.optional(),
    elementDamageBonuses: z.strictObject({pyro: z.number().finite().optional(), hydro: z.number().finite().optional(),
      cryo: z.number().finite().optional(), electro: z.number().finite().optional()}).optional(),
    /** Minimal complete C6 branch: no inherited target debuff at Q start. */
    c6InitiallyInactive: z.boolean().optional(),
  }).optional(),
  dendro: z.strictObject({ noTransformation: z.boolean().optional(), noGadgetRemoval: z.boolean().optional() }).optional(),
  sharedState: travelerCrossEntityHitStateSchema.optional(),
  hitStates: z.record(text, travelerCrossEntityHitStateSchema).optional(),
  independentEvent: travelerCrossEntityEventSchema.optional(),
  finalizedHitEvents: z.record(text, text).optional(),
});
export type TravelerCrossEntityScheduleContext = z.infer<typeof travelerCrossEntityCastBaseSchema>;
