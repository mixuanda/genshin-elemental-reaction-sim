import { z } from "zod";

/** Actual state before the selected hit's on-hit bond consumption. */
export const arlecchinoDamageContextSchema = z.strictObject({
  /** Player-facing percent: 30 means 30% MaxHP, not 0.30%. */
  bondOfLifePercent: z.number().finite().min(0).max(200).optional(),
  passivePyroBonusIncluded: z.boolean().optional(),
  includedBondBase: z.number().finite().nonnegative().optional(),
  finalizedHitStates: z.record(z.string(), z.string()).optional(),
});
export type ArlecchinoDamageContext = z.infer<typeof arlecchinoDamageContextSchema>;
