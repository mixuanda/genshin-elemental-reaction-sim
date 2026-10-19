import { z } from "zod";
import { sourceHostOriginSchema } from "./source-host-action-origin";
import { sourceHostAbilityQueuedAttackSchema } from "./source-host-finite-cast-types";

const nonnegative = z.number().int().nonnegative();
const positive = z.number().int().positive();

export const sourceHostEventQueuedAttackSchema = sourceHostAbilityQueuedAttackSchema.extend({ emitSiteId: z.string() });
export type SourceHostEventQueuedAttack = z.infer<typeof sourceHostEventQueuedAttackSchema>;

/** Identity and lifetime of one actual event subscription slot. */
export const sourceHostEventRegistrationSchema = z.object({
  id: positive,
  eventType: nonnegative,
  slotIndex: nonnegative,
  key: z.string(),
  createdFrame: nonnegative,
  origin: sourceHostOriginSchema,
  state: z.enum(["active", "replaced", "unsubscribed"]),
  endedFrame: nonnegative.optional(),
  siteId: z.string().optional(),
}).strict();
export type SourceHostEventRegistration = z.infer<typeof sourceHostEventRegistrationSchema>;

/** Listener IDs are calls that ran; suppressed IDs are active registration IDs skipped by EmitObserved. */
export const sourceHostEventEmissionSchema = z.object({
  id: positive,
  eventType: nonnegative,
  mode: z.enum(["gameplay", "observed"]),
  frame: nonnegative,
  targetKey: z.number().int(),
  parentQueueId: positive.optional(),
  parentAttackId: positive.optional(),
  parentDispatchId: positive.optional(),
  parentEmissionId: positive.optional(),
  listenerIds: z.array(positive),
  suppressedListenerIds: z.array(positive),
  completedFrame: nonnegative,
}).strict();
export type SourceHostEventEmission = z.infer<typeof sourceHostEventEmissionSchema>;

/** Only a listener that actually ran has a call row and explicit child emits. */
export const sourceHostEventListenerCallSchema = z.object({
  id: positive,
  emissionId: positive,
  registrationId: positive,
  slotIndex: nonnegative,
  eventType: nonnegative,
  key: z.string(),
  siteId: z.string().optional(),
  startedFrame: nonnegative,
  completedFrame: nonnegative,
  queuedAttacks: z.array(sourceHostEventQueuedAttackSchema),
  entryFacts: z.record(z.string(), z.number().finite()).optional(),
}).strict();
export type SourceHostEventListenerCall = z.infer<typeof sourceHostEventListenerCallSchema>;

/** An audited native task, rooted in an event call and optionally spawned by another such task. */
export const sourceHostEventProducerSchema = z.object({
  id: positive,
  siteId: z.string(),
  listenerCallId: positive,
  parentProducerId: positive.optional(),
  taskId: positive,
  queuedFrame: nonnegative,
  runFrame: nonnegative.optional(),
  completedFrame: nonnegative.optional(),
  state: z.enum(["pending", "completed"]),
  queuedAttacks: z.array(sourceHostEventQueuedAttackSchema),
  entryFacts: z.record(z.string(), z.number().finite()).optional(),
}).strict();
export type SourceHostEventProducer = z.infer<typeof sourceHostEventProducerSchema>;
