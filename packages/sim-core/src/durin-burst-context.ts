import { z } from "zod";

export const durinBurstContextSchema = z.strictObject({
  tickIndex: z.number().int().min(1).max(20).optional(),
  c2PyroBonusActive: z.boolean().optional(),
  c2PyroBonusIncluded: z.boolean().optional(),
  finalizedHitStates: z.record(z.string(), z.string()).optional(),
});
export type DurinBurstContext = z.infer<typeof durinBurstContextSchema>;
