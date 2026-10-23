import { z } from "zod";

/** Actual state before the selected hit's on-hit bond consumption. */
export const arlecchinoDamageContextSchema = z.strictObject({
  /** Player-facing percent: 30 means 30% MaxHP, not 0.30%. */
  bondOfLifePercent: z.number().finite().min(0).max(200).optional(),
  passivePyroBonusIncluded: z.boolean().optional(),
  includedBondBase: z.number().finite().nonnegative().optional(),
  /** Actual C6 attack modifier at this hit's damage evaluation, not an E timer. */
  c6Active: z.boolean().optional(),
  /** Percentage points of the C6 share already present in the input panel. */
  c6CritRateIncludedPercent: z.number().finite().min(0).max(10).optional(),
  c6CritDamageIncludedPercent: z.number().finite().min(0).max(70).optional(),
  finalizedHitStates: z.record(z.string(), z.string()).optional(),
});
export type ArlecchinoDamageContext = z.infer<typeof arlecchinoDamageContextSchema>;
