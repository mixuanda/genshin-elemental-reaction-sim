import { z } from "zod";
import { sourceHostAbilityQueuedAttackSchema } from "./source-host-finite-cast-types";

const nonnegative = z.number().int().nonnegative();
const positive = z.number().int().positive();

export const sourceHostOwnedEntityQueuedAttackSchema = sourceHostAbilityQueuedAttackSchema.extend({
  emitSiteId: z.string(),
  emitterEntityId: positive.optional(),
});
export type SourceHostOwnedEntityQueuedAttack = z.infer<typeof sourceHostOwnedEntityQueuedAttackSchema>;

/** A native object lifetime. Unowned constructs provide resonance-location context. */
export const sourceHostOwnedEntitySchema = z.object({
  id: positive,
  kind: z.enum(["gadget", "construct"]),
  construct: z.object({ type: z.string(), expiryFrame: nonnegative, limitedList: z.boolean() }).strict().optional(),
  siteId: z.string(),
  invocationId: positive.optional(),
  spawnProducerId: positive.optional(),
  parentEntityId: positive.optional(),
  actorIndex: z.number().int().min(-1), // -1 only for unowned native resonance objects
  targetKey: z.number().int(),
  createdFrame: nonnegative,
  tickCount: nonnegative.optional(),
  endedFrame: nonnegative.optional(),
  endReason: z.enum(["killed", "expired", "removed", "replaced", "limit", "destroyed"]).optional(),
  triggerIds: z.array(positive),
  producerIds: z.array(positive),
}).strict();
export type SourceHostOwnedEntity = z.infer<typeof sourceHostOwnedEntitySchema>;

export const sourceHostOwnedEntityTriggerSchema = z.object({
  id: positive,
  entityId: positive,
  siteId: z.string(),
  kind: z.enum(["think", "kill", "expiry", "enemy-damage"]),
  eventCallId: positive.optional(),
  startedFrame: nonnegative,
  completedFrame: nonnegative,
  childProducerIds: z.array(positive),
  queuedAttacks: z.array(sourceHostOwnedEntityQueuedAttackSchema),
}).strict();
export type SourceHostOwnedEntityTrigger = z.infer<typeof sourceHostOwnedEntityTriggerSchema>;

export const sourceHostOwnedEntityProducerSchema = z.object({
  constructKeyPresent: z.boolean().optional(),
  snapshotEntityId: positive.optional(),
  constructSelections: z.array(z.object({ primaryEntityId: nonnegative, resonanceEntityIds: z.array(nonnegative) }).strict()).optional(),
  id: positive,
  entityId: positive,
  parentTriggerId: positive.optional(),
  parentProducerId: positive.optional(),
  siteId: z.string(),
  taskId: nonnegative.optional(),
  queuedFrame: nonnegative,
  startedFrame: nonnegative.optional(),
  completedFrame: nonnegative.optional(),
  state: z.enum(["pending", "completed"]),
  queuedAttacks: z.array(sourceHostOwnedEntityQueuedAttackSchema),
}).strict();
export type SourceHostOwnedEntityProducer = z.infer<typeof sourceHostOwnedEntityProducerSchema>;
