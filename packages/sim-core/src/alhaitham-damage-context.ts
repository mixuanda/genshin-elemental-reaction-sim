import { z } from "zod";

export const alhaithamProjectionHitStateSchema = z.strictObject({
  connected: z.boolean().optional(),
  /** Current EM when the attack modifier executes on this target's impact. */
  hitTimeMastery: z.number().finite().nonnegative().optional(),
  /** Varying-stage input is the full actual EM, including active C2 at impact. */
  c2HitMasteryFinal: z.boolean().optional(),
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
  /** Actual independently unexpired C2 stacks at delayed offensive snapshot. */
  c2SnapshotStacks: z.number().int().min(0).max(4).optional(),
  /** C2's native 50EM shares already present in the entered snapshot EM. */
  c2SnapshotIncludedStacks: z.number().int().min(0).max(4).optional(),
  /** Varying trigger input already contains that stage's actual C2 mastery. */
  c2TriggerMasteryFinal: z.boolean().optional(),
  /** Explicit correction when a final panel's other stats are not actual yet. */
  c2OtherSnapshotStatsFinal: z.boolean().optional(),
  /** An observation-entry draft needs explicit confirmation, including after reopen. */
  c2RequiresActualPanelConfirmation: z.boolean().optional(),
  statsAndTargetStableAcrossHits: z.boolean().optional(),
  hitStates: z.record(z.string(), alhaithamProjectionHitStateSchema).optional(),
  finalizedHitStates: z.record(z.string(), z.string()).optional(),
});
export type AlhaithamProjectionHitState = z.infer<typeof alhaithamProjectionHitStateSchema>;
export type AlhaithamDamageContext = z.infer<typeof alhaithamDamageContextSchema>;
