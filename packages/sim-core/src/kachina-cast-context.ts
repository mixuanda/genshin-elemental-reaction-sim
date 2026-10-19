import { z } from "zod";

const frame = z.number().int().min(0);
const name = z.string().trim().min(1);

/** The game text gives 60 starting points, but not a trustworthy drain/tick schedule. */
export const kachinaCastBaseSchema = z.strictObject({
  casterId: name.optional(), targetId: name.optional(),
  startingMode: z.enum(["riding", "independent"]).optional(),
  events: z.array(z.strictObject({
    id: name, frame, kind: z.enum(["mount", "dismount", "riding-slam", "independent-slam", "points-observed", "end"]),
    nightsoulPointsAfter: z.number().min(0).max(60),
    targetContact: z.boolean().optional(),
    /** Observed at this slam, not inferred from the 12-second description. */
    a1Active: z.boolean().optional(),
    /** Whether this slam's supplied damage bonus already contains the 20% A1 share. */
    a1IncludedInDamageBonus: z.boolean().optional(),
    snapshotId: name.optional(),
  })).optional(),
  allActionsRecorded: z.boolean().optional(), fullObservedLifetime: z.boolean().optional(),
  noPhlogiston: z.boolean().optional(), noReplacement: z.boolean().optional(), noInterruption: z.boolean().optional(),
  a1InactiveThroughout: z.boolean().optional(),
  statsStableAcrossHits: z.boolean().optional(), observedThroughFrame: frame.optional(),
  finalizedHitEvents: z.record(name, name).optional(),
});
export type KachinaCastBase = z.infer<typeof kachinaCastBaseSchema>;
