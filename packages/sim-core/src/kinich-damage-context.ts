import { z } from "zod";

/** State of the selected E contact, never reconstructed from showcase stats. */
export const kinichDamageContextSchema = z.strictObject({
  nightsoulBlessingActive: z.boolean().optional(),
  /** Before requesting the cannon; the source consumes these before snapshot. */
  cannonPointsBeforeUse: z.number().int().min(0).max(20).optional(),
  /** Actual unexpired Hunter's Experience consumed when creating this cannon. */
  a4Stacks: z.number().int().min(0).max(2).optional(),
  /** TotalAtk() when a4Amount is called, not the later cannon hit snapshot. */
  a4CreationAttack: z.number().finite().nonnegative().optional(),
  /** Share already present in hit.additiveBaseDamage, in damage-base units. */
  includedA4BaseDamage: z.number().finite().nonnegative().optional(),
  c1CritDamageIncluded: z.boolean().optional(),
  bothLoopHitsConnected: z.boolean().optional(),
  statsStableAcrossHits: z.boolean().optional(),
  finalizedHitStates: z.record(z.string(), z.string()).optional(),
});
export type KinichDamageContext = z.infer<typeof kinichDamageContextSchema>;
