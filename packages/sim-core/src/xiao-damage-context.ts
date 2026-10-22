import { z } from "zod";

/** Actual state for the one selected hit; not a burst/energy/charge simulator. */
export const xiaoDamageContextSchema = z.strictObject({
  burstActive: z.boolean().optional(),
  burstTalentLevel: z.number().int().min(1).max(15).optional(),
  /** At this hit's offensive snapshot: E snapshots on cast, then hits +4f. */
  burstElapsedSeconds: z.number().finite().min(0).optional(),
  skillA4Stacks: z.number().int().min(0).max(3).optional(),
  includedDamageBonus: z.number().finite().min(0).max(1.8795).optional(),
  finalizedHitStates: z.record(z.string(), z.string()).optional(),
});
export type XiaoDamageContext = z.infer<typeof xiaoDamageContextSchema>;
