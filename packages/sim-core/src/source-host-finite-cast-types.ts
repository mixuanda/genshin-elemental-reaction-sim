import { z } from "zod";
import { sourceHostOriginSchema } from "./source-host-action-origin";

const nonnegative = z.number().int().nonnegative();
const positive = z.number().int().positive();

export const sourceHostAbilityQueuedAttackSchema = z.object({
  queueId: positive, attackId: positive.optional(), ability: z.string(),
  attackTagName: z.string(), frame: nonnegative,
}).strict();
export type SourceHostAbilityQueuedAttack = z.infer<typeof sourceHostAbilityQueuedAttackSchema>;

/** One native useAbility entry and return, with attacks actually queued by that method. */
export const sourceHostAbilityInvocationSchema = z.object({
  id: positive, actionSequence: positive, actorIndex: nonnegative,
  characterKey: z.string(), action: z.string(), params: z.record(z.string(), z.number().finite()),
  entryFacts: z.record(z.string(), z.number().finite()).optional(),
  constellation: nonnegative, ascension: nonnegative,
  startedFrame: nonnegative, returnedFrame: nonnegative,
  success: z.boolean(), animationQueuedCallbacks: nonnegative, hasOnRemoved: z.boolean(),
  queuedAttacks: z.array(sourceHostAbilityQueuedAttackSchema),
}).strict();
export type SourceHostAbilityInvocation = z.infer<typeof sourceHostAbilityInvocationSchema>;

/** A native ability producer may still be pending after useAbility returns. */
export const sourceHostAbilityProducerSchema = z.object({
  id: positive,
  invocationId: positive.optional(),
  parentProducerId: positive.optional(),
  parentHitCallbackId: positive.optional(),
  taskId: nonnegative.optional(),
  siteId: z.string(),
  entryFacts: z.record(z.string(), z.number().finite()).optional(),
  actorIndex: nonnegative,
  queuedFrame: nonnegative,
  startedFrame: nonnegative.optional(),
  completedFrame: nonnegative.optional(),
  state: z.enum(["pending", "completed"]),
  queuedAttacks: z.array(sourceHostAbilityQueuedAttackSchema),
}).strict();
export type SourceHostAbilityProducer = z.infer<typeof sourceHostAbilityProducerSchema>;

/** A live status instance registered an audited damage generator. */
export const sourceHostOwnedGeneratorSchema = z.object({
  id: positive,
  siteId: z.string(),
  invocationId: positive.optional(),
  statusInstanceId: positive,
  actorIndex: nonnegative,
  /** The caster remains actorIndex; a party AttackMod may live on another holder. */
  holderActorIndex: nonnegative.optional(),
  activationProducerId: positive.optional(),
  activatedFrame: nonnegative,
  triggerIds: z.array(positive),
}).strict();
export type SourceHostOwnedGenerator = z.infer<typeof sourceHostOwnedGeneratorSchema>;

export const sourceHostOwnedGeneratorTriggerSchema = z.object({
  id: positive,
  generatorId: positive,
  siteId: z.string(),
  kind: z.enum(["state-change", "ticker", "skill-hit", "enemy-damage", "enemy-hit"]),
  origin: sourceHostOriginSchema,
  startedFrame: nonnegative,
  completedFrame: nonnegative,
  queuedAttacks: z.array(sourceHostAbilityQueuedAttackSchema.extend({ emitSiteId: z.string() })),
}).strict();
export type SourceHostOwnedGeneratorTrigger = z.infer<typeof sourceHostOwnedGeneratorTriggerSchema>;

/** One completed native ApplyAttack enemy loop; not a general future-callback census. */
export const sourceHostAttackDispatchCompletionSchema = z.object({
  dispatchId: positive, attackId: positive, frame: nonnegative,
  origin: sourceHostOriginSchema,
  enemyTargetKeys: z.array(z.number().int()),
  skippedEnemyKeys: z.array(z.number().int()),
  skipsEnemies: z.boolean(),
}).strict();
export type SourceHostAttackDispatchCompletion = z.infer<typeof sourceHostAttackDispatchCompletionSchema>;
