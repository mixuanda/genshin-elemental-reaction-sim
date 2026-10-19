import { z } from "zod";
const text = z.string().trim().min(1), frame = z.number().int().nonnegative();
export const noellePlungeEventSchema = z.strictObject({
  candidateId: text, templateRole: z.enum(["collision", "landing"]), frame, snapshotFrame: frame, snapshotId: text, targetId: text,
});
export const noellePlungeCastBaseSchema = z.strictObject({
  casterId: text.optional(), targetId: text.optional(), noHitlag: z.boolean().optional(), noInterruption: z.boolean().optional(),
  fullObservedLifetime: z.boolean().optional(), observedThroughFrame: frame.optional(), statsStableAcrossHits: z.boolean().optional(),
  airborneXianyunConfirmed: z.boolean().optional(), returnedToGroundConfirmed: z.boolean().optional(),
  burstInactive: z.boolean().optional(), noExternalInfusion: z.boolean().optional(), collisionOccurred: z.boolean().optional(),
  targetContacts: z.record(text, z.boolean()).optional(), finalizedHitEvents: z.record(text, text).optional(),
});
export type NoellePlungeScheduleContext = z.infer<typeof noellePlungeCastBaseSchema>;
export type NoellePlungeEvent = z.infer<typeof noellePlungeEventSchema>;
