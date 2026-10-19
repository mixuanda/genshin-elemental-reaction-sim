import { z } from "zod";

/** Explicit source status activation; distinct from callback and trigger ancestry. */
export const sourceHostStatusOwnerSchema = z.object({
  actorIndex: z.number().int().nonnegative(), statusKey: z.string().min(1),
  instanceId: z.number().int().positive(), createdFrame: z.number().finite(),
  creationActionSequence: z.number().int().positive().optional(),
}).strict();

/** Associations are observations, not a complete skill lifetime or damage ownership. */
export const sourceHostOriginSchema = z.object({
  creationActionSequence: z.number().int().positive().optional(),
  triggerActionSequence: z.number().int().positive().optional(),
  parentAttackId: z.number().int().positive().optional(),
  via: z.enum(["action", "task", "event-callback", "attack-callback", "unassigned"]),
  eventKey: z.string().optional(), eventType: z.number().int().nonnegative().optional(),
  statusOwner: sourceHostStatusOwnerSchema.optional(),
}).strict();
export type SourceHostOrigin = z.infer<typeof sourceHostOriginSchema>;

export const sourceHostStatusInstanceSchema = sourceHostStatusOwnerSchema.extend({
  initialExpiryFrame: z.number().int(), finalExpiryFrame: z.number().int(),
  endState: z.enum(["replaced", "removed", "expired-at-end", "active-at-end", "unknown-at-end"]),
  endFrame: z.number().int(), replacedByInstanceId: z.number().int().positive().optional(),
  nativeOverwrite: z.boolean().optional(),
}).strict();
export type SourceHostStatusInstance = z.infer<typeof sourceHostStatusInstanceSchema>;

/** Actual scheduled core tasks still present when execution stopped. This is not
 * a census of every character task, entity, event hook or attack opportunity. */
export const sourceHostPendingAttackStageSchema = z.object({
  id: z.number().int().positive(), stage: z.enum(["snapshot", "application"]),
  queuedFrame: z.number().int(), dueFrame: z.number().int(),
  attackId: z.number().int().positive().optional(), origin: sourceHostOriginSchema,
}).strict();
export type SourceHostPendingAttackStage = z.infer<typeof sourceHostPendingAttackStageSchema>;

export const sourceHostAttackObservationSchema = z.object({
  attackId: z.number().int().positive().optional(),
  dispatchId: z.number().int().positive().optional(),
  stage: z.enum(["queued", "dispatched", "resolved", "missed"]),
  frame: z.number().finite(), targetKey: z.number().int().optional(), reason: z.string().optional(),
  origin: sourceHostOriginSchema.optional(),
}).strict();

/** Observed scheduler receipts. No timing is inferred from a character name or
 * from animation-local frame thresholds. Old captures remain unassociated. */
export interface SourceActionReceipt {
  sequence: number;
  characterKey: string;
  action: string;
  queuedFrame: number;
  acceptedFrame?: number;
  inputWindowFrame?: number;
  noOp?: boolean;
}

export function sourceActionReceipts(logs: unknown): SourceActionReceipt[] {
  if (!Array.isArray(logs)) return [];
  const receipts = new Map<number, SourceActionReceipt>();
  for (const row of logs) {
    if (!row || typeof row !== "object" || row.event !== "action" || !Number.isFinite(row.frame)) continue;
    const fields = row.logs;
    if (!fields || !Number.isInteger(fields.sequence)) continue;
    if (row.msg === "source-host action queued" && typeof fields.characterKey === "string" && typeof fields.action === "string") {
      receipts.set(fields.sequence, { sequence: fields.sequence, characterKey: fields.characterKey, action: fields.action, queuedFrame: row.frame });
      continue;
    }
    const receipt = receipts.get(fields.sequence);
    if (!receipt) continue;
    if (row.msg === "source-host input window opened") {
      receipt.inputWindowFrame = row.frame;
      continue;
    }
    if (receipt.characterKey !== fields.characterKey || receipt.action !== fields.action) continue;
    if (row.msg === "source-host action accepted") {
      receipt.acceptedFrame = row.frame;
      receipt.noOp = fields.noop === true;
    }
  }
  return [...receipts.values()];
}
