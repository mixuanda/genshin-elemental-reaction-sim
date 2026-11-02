import { z } from 'zod';

/** Missing answers remain unknown, including accounting for imported final panels. */
export const cynoDamageContextSchema = z.strictObject({
  burstActive: z.boolean().optional(),
  burstEmIncludedInPanel: z.boolean().optional(),
  emStableFromActionStart: z.boolean().optional(),
  actionStartEm: z.number().finite().nonnegative().optional(),
  includedA4Base: z.number().finite().nonnegative().optional(),
  finalizedHitStates: z.record(z.string(), z.string()).optional(),
});
export type CynoDamageContext = z.infer<typeof cynoDamageContextSchema>;
