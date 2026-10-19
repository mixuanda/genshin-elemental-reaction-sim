import { z } from "zod";
import { sourceHostOwnedEntityQueuedAttackSchema } from "./source-host-owned-entity-types";

const nonnegative = z.number().int().nonnegative();
const id = z.number().int().positive();

/** One native per-target callback batch, queued before its Core task runs. */
export const sourceHostHitCallbackBatchSchema = z.object({
  id,
  parentQueueId: id.optional(),
  parentAttackId: id,
  parentDispatchId: id,
  targetKey: z.number().int(),
  queuedFrame: nonnegative,
  runFrame: nonnegative.optional(),
  completedFrame: nonnegative.optional(),
  state: z.enum(["pending", "completed", "blocked"]),
  callbackCount: nonnegative,
  callbackIds: z.array(id),
  hitConfirmBlocked: z.boolean(),
}).strict();
export type SourceHostHitCallbackBatch = z.infer<typeof sourceHostHitCallbackBatchSchema>;

/** A callback that actually ran. Only audited sites label intrinsic child emits. */
export const sourceHostHitCallbackSchema = z.object({
  id,
  batchId: id,
  callbackIndex: nonnegative,
  siteId: z.string().optional(),
  startedFrame: nonnegative,
  completedFrame: nonnegative,
  queuedAttacks: z.array(sourceHostOwnedEntityQueuedAttackSchema),
  entryFacts: z.record(z.string(), z.number().finite()).optional(),
}).strict();
export type SourceHostHitCallback = z.infer<typeof sourceHostHitCallbackSchema>;
