import { z } from "zod";
import { sourceHostOriginSchema } from "./source-host-action-origin";
import { sourceHostAbilityQueuedAttackSchema } from "./source-host-finite-cast-types";

const integer = z.number().int();
const positive = integer.positive();
const frame = integer.nonnegative();
const finite = z.number().finite();

/** One native Add installation; source frame and mutable HP calculation are not identity. */
export const sourceHostShieldInstanceSchema = z.object({
  id: positive, actorIndex: integer.nonnegative(), targetIndex: integer,
  type: integer, description: z.string(), sourceKeyFrame: integer,
  createdFrame: frame, nativeExpiryFrame: integer, initialHP: finite,
  birthHPSourceCalculationId: positive.optional(), creationOrigin: sourceHostOriginSchema,
  creationSiteId: z.string().optional(), invocationId: positive.optional(),
  spawnProducerId: positive.optional(), creationCallbackId: positive.optional(),
  creationEventListenerCallId: positive.optional(),
  replacesInstanceId: positive.optional(), replacedByInstanceId: positive.optional(),
  terminalFrame: frame.optional(), terminalReason: z.enum(["overwritten", "broken", "expired"]).optional(),
  lastHP: finite, lastHPSourceCalculationId: positive.optional(),
}).strict();
export type SourceHostShieldInstance = z.infer<typeof sourceHostShieldInstanceSchema>;

export const sourceHostShieldHookSchema = z.object({
  id: positive, instanceId: positive, siteId: z.string().optional(),
  cause: z.enum(["overwrite", "damage", "expiry", "refresh", "trigger"]),
  abilityProducerId: positive.optional(), shieldProducerId: positive.optional(),
  hitCallbackId: positive.optional(), eventListenerCallId: positive.optional(),
  entryFacts: z.record(z.string(), finite).optional(),
  startedFrame: frame, completedFrame: frame, playerAttackId: positive.optional(),
  hpBefore: finite, hpAfter: finite,
  queuedAttacks: z.array(sourceHostAbilityQueuedAttackSchema.extend({ emitSiteId: z.string() })),
}).strict();
export type SourceHostShieldHook = z.infer<typeof sourceHostShieldHookSchema>;

/** A queued native shield task retains its birth owner separately from its current shield gate. */
export const sourceHostShieldProducerSchema = z.object({
  id: positive, siteId: z.string(), ownerInstanceId: positive.optional(), parentProducerId: positive.optional(),
  parentHookId: positive.optional(), spawnAbilityProducerId: positive.optional(),
  taskId: integer.nonnegative(), queuedFrame: frame, runFrame: frame.optional(), completedFrame: frame.optional(),
  state: z.enum(["pending", "completed"]), gateObserved: z.boolean(), gateInstanceId: positive.optional(),
  entryFacts: z.record(z.string(), finite).optional(),
  queuedAttacks: z.array(sourceHostAbilityQueuedAttackSchema.extend({ emitSiteId: z.string() })),
}).strict();
export type SourceHostShieldProducer = z.infer<typeof sourceHostShieldProducerSchema>;
