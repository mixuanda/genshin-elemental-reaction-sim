import { z } from "zod";

export const alhaithamProjectionHitStateSchema = z.strictObject({
  connected: z.boolean().optional(),
  /** Current EM when the attack modifier executes on this target's impact. */
  hitTimeMastery: z.number().finite().nonnegative().optional(),
  /** Share of the native trigger-EM FlatDmg already in additiveBaseDamage. */
  includedProjectionBase: z.number().finite().nonnegative().optional(),
  /** Own A4 ratio already present in this hit's entered damage bonus. */
  includedA4Bonus: z.number().finite().min(0).max(1).optional(),
});
export const alhaithamDamageContextSchema = z.strictObject({
  /** Named 1/2/3 mirror entries explicitly choose the trigger-time scenario. */
  mirrorCount: z.number().int().min(0).max(3).optional(),
  /** Own on-field NA/CA/plunge hit an enemy with the 96f projection ICD ready. */
  projectionTriggerValid: z.boolean().optional(),
  /** Explicit equality of trigger, delayed snapshot and selected impact EM. */
  masteryStableAcrossStages: z.boolean().optional(),
  triggerMastery: z.number().finite().nonnegative().optional(),
  statsAndTargetStableAcrossHits: z.boolean().optional(),
  hitStates: z.record(z.string(), alhaithamProjectionHitStateSchema).optional(),
  finalizedHitStates: z.record(z.string(), z.string()).optional(),
});
export type AlhaithamProjectionHitState = z.infer<typeof alhaithamProjectionHitStateSchema>;
export type AlhaithamDamageContext = z.infer<typeof alhaithamDamageContextSchema>;
