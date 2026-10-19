import { z } from "zod";

/** Collision opportunities and target contacts are observations, never inferred from height. */
export const observedPlungeContextSchema = z.strictObject({
  collisionCount: z.number().int().min(0).max(64).optional(),
  collisionContacts: z.record(z.string(), z.boolean()).optional(),
  landingContact: z.boolean().optional(),
  statsStableAcrossHits: z.boolean().optional(),
  targetConditionsStableAcrossHits: z.boolean().optional(),
  noExternalInfusion: z.boolean().optional(),
  targetId: z.string().min(1).optional(),
  finalizedHitEvents: z.record(z.string(), z.string()).optional(),
});

export type ObservedPlungeContext = z.infer<typeof observedPlungeContextSchema>;
