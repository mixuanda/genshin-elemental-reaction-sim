import { z } from "zod";

import { simulationEventTypeSchema } from "./schema";

const finiteNumberSchema = z.number().finite();
const nonNegativeFiniteNumberSchema = finiteNumberSchema.nonnegative();
const nonEmptyStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, {
    message: "must not be blank"
  });
const nonNegativeSafeIntegerSchema = z
  .number()
  .int()
  .finite()
  .nonnegative()
  .refine(Number.isSafeInteger, {
    message: "must be a safe integer"
  });

export const callbackBusEventKindV153Schema = z.enum([
  "on-aura-durability-depleted-frozen",
  "on-apply-attack-freeze-broken",
  "on-enemy-hit-freeze-broken",
  "on-enemy-damage-freeze-broken-zero",
  "attack-callback-freeze-broken"
]);

const callbackSubscriberAttemptReferenceV153Schema = z
  .object({
    callbackDeliveryLogId: nonNegativeSafeIntegerSchema,
    attemptIndex: nonNegativeSafeIntegerSchema
  })
  .strict();

/** Strict V1.53 wire for one successful callback-registry mutation. */
export const callbackRegistrationLogEntryV153Schema = z
  .object({
    id: nonNegativeSafeIntegerSchema,
    registryRevision: nonNegativeSafeIntegerSchema,
    eventKind: callbackBusEventKindV153Schema,
    subscriberKey: nonEmptyStringSchema,
    slotIndex: nonNegativeSafeIntegerSchema,
    operation: z.enum(["subscribe", "replace", "unsubscribe"]),
    previousSubscriptionId: nonNegativeSafeIntegerSchema.nullable(),
    currentSubscriptionId: nonNegativeSafeIntegerSchema.nullable(),
    sourceKind: z.enum(["core", "plugin"]),
    pluginManifestIndex: nonNegativeSafeIntegerSchema.nullable(),
    pluginId: nonEmptyStringSchema.nullable(),
    subscriberAttemptRefs: z.array(
      callbackSubscriberAttemptReferenceV153Schema
    )
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.registryRevision !== entry.id + 1) {
      context.addIssue({
        code: "custom",
        path: ["registryRevision"],
        message: "must equal id + 1"
      });
    }
    if (
      entry.operation === "subscribe" &&
      (entry.previousSubscriptionId !== null ||
        entry.currentSubscriptionId === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["operation"],
        message:
          "subscribe requires a null previousSubscriptionId and a currentSubscriptionId"
      });
    }
    if (
      entry.operation === "replace" &&
      entry.currentSubscriptionId === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["currentSubscriptionId"],
        message: "replace requires a currentSubscriptionId"
      });
    }
    if (
      entry.operation === "replace" &&
      entry.previousSubscriptionId !== null &&
      entry.previousSubscriptionId === entry.currentSubscriptionId
    ) {
      context.addIssue({
        code: "custom",
        path: ["currentSubscriptionId"],
        message: "replace must allocate a new subscription ID"
      });
    }
    if (
      entry.operation === "unsubscribe" &&
      (entry.previousSubscriptionId === null ||
        entry.currentSubscriptionId !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["operation"],
        message:
          "unsubscribe requires a previousSubscriptionId and a null currentSubscriptionId"
      });
    }
    if (
      entry.operation === "unsubscribe" &&
      entry.subscriberAttemptRefs.length !== 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["subscriberAttemptRefs"],
        message: "an unsubscribe tombstone cannot own delivery attempts"
      });
    }
    const pluginRefsPresent =
      entry.pluginManifestIndex !== null && entry.pluginId !== null;
    if (
      (entry.sourceKind === "plugin") !== pluginRefsPresent ||
      (entry.pluginManifestIndex === null) !== (entry.pluginId === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["pluginManifestIndex"],
        message:
          "plugin registrations require both plugin references; core registrations require neither"
      });
    }
    const seenAttemptRefs = new Set<string>();
    for (const [index, reference] of entry.subscriberAttemptRefs.entries()) {
      const key = `${reference.callbackDeliveryLogId}:${reference.attemptIndex}`;
      if (seenAttemptRefs.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["subscriberAttemptRefs", index],
          message: "must not duplicate a subscriber-attempt reference"
        });
      }
      seenAttemptRefs.add(key);
    }
  });

const callbackSubscriberOutcomeV153Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("no-side-effect") }).strict(),
  z
    .object({
      kind: z.literal("freeze-broken-audit"),
      freezeBrokenAttackLogId: nonNegativeSafeIntegerSchema,
      sourceFrozenStateLogId: nonNegativeSafeIntegerSchema
    })
    .strict()
]);

/** A successful subscriber invocation nested under one delivery row. */
export const callbackSubscriberAttemptV153Schema = z
  .object({
    index: nonNegativeSafeIntegerSchema,
    slotIndex: nonNegativeSafeIntegerSchema,
    registrationLogId: nonNegativeSafeIntegerSchema,
    subscriptionId: nonNegativeSafeIntegerSchema,
    subscriberKey: nonEmptyStringSchema,
    pluginManifestIndex: nonNegativeSafeIntegerSchema.nullable(),
    pluginId: nonEmptyStringSchema.nullable(),
    status: z.literal("completed"),
    outcomeVerification: z.literal(
      "structural-only-unverified-runtime-output-v1"
    ),
    outcome: callbackSubscriberOutcomeV153Schema
  })
  .strict()
  .superRefine((attempt, context) => {
    if (
      (attempt.pluginManifestIndex === null) !== (attempt.pluginId === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["pluginManifestIndex"],
        message: "pluginManifestIndex and pluginId must both be null or present"
      });
    }
  });

const immediatePhaseSchema = z
  .object({ kind: z.literal("same-call-stack-immediate") })
  .strict();
const zeroDelayPhaseSchema = z
  .object({
    kind: z.literal("zero-delay-core-task"),
    scheduledAfterCallbackDeliveryLogId: nonNegativeSafeIntegerSchema,
    taskSequence: nonNegativeSafeIntegerSchema,
    delayFrames: z.literal(0),
    referenceRelativeToTriggerEnemyDamage: z.enum([
      "before",
      "not-applicable"
    ]),
    localExecutionRelativeToTriggerEvent: z.literal("after-current-event")
  })
  .strict();

const callbackDeliveryCommonShape = {
  id: nonNegativeSafeIntegerSchema,
  registryRevision: nonNegativeSafeIntegerSchema,
  frame: nonNegativeSafeIntegerSchema,
  targetFrame: nonNegativeSafeIntegerSchema.optional(),
  timeSeconds: nonNegativeFiniteNumberSchema,
  targetId: nonEmptyStringSchema,
  targetName: nonEmptyStringSchema,
  generation: nonNegativeSafeIntegerSchema,
  sourceFrozenStateLogId: nonNegativeSafeIntegerSchema,
  freezeBrokenAttackLogId: nonNegativeSafeIntegerSchema,
  triggerEventType: simulationEventTypeSchema,
  triggerEventPriority: nonNegativeFiniteNumberSchema,
  triggerEventSequence: nonNegativeSafeIntegerSchema,
  triggerIntraEventSequence: nonNegativeSafeIntegerSchema,
  eventPriority: nonNegativeFiniteNumberSchema,
  eventSequence: nonNegativeSafeIntegerSchema,
  intraEventSequence: nonNegativeSafeIntegerSchema,
  parentCallbackDeliveryLogId: nonNegativeSafeIntegerSchema.nullable(),
  subscriberAttempts: z.array(callbackSubscriberAttemptV153Schema)
} as const;

const callbackDeliveryLogEntryV153ValueSchema = z.discriminatedUnion(
  "eventKind",
  [
    z
      .object({
        ...callbackDeliveryCommonShape,
        eventIndex: z.literal(0),
        eventKind: z.literal("on-aura-durability-depleted-frozen"),
        phase: immediatePhaseSchema,
        payload: z
          .object({
            kind: z.literal("frozen-durability-depleted"),
            element: z.literal("frozen")
          })
          .strict()
      })
      .strict(),
    z
      .object({
        ...callbackDeliveryCommonShape,
        eventIndex: z.literal(1),
        eventKind: z.literal("on-apply-attack-freeze-broken"),
        phase: immediatePhaseSchema,
        payload: z
          .object({
            kind: z.literal("freeze-broken-attack"),
            ability: z.literal("Freeze Broken")
          })
          .strict()
      })
      .strict(),
    z
      .object({
        ...callbackDeliveryCommonShape,
        eventIndex: z.literal(2),
        eventKind: z.literal("on-enemy-hit-freeze-broken"),
        phase: immediatePhaseSchema,
        payload: z
          .object({
            kind: z.literal("freeze-broken-attack"),
            ability: z.literal("Freeze Broken")
          })
          .strict()
      })
      .strict(),
    z
      .object({
        ...callbackDeliveryCommonShape,
        eventIndex: z.literal(3),
        eventKind: z.literal("on-enemy-damage-freeze-broken-zero"),
        phase: zeroDelayPhaseSchema,
        payload: z
          .object({
            kind: z.literal("freeze-broken-zero-damage"),
            ability: z.literal("Freeze Broken"),
            actualDamage: z.literal(0),
            crit: z.null(),
            rngDisposition: z.literal("not-consumed")
          })
          .strict()
      })
      .strict(),
    z
      .object({
        ...callbackDeliveryCommonShape,
        eventIndex: z.literal(4),
        eventKind: z.literal("attack-callback-freeze-broken"),
        phase: zeroDelayPhaseSchema,
        payload: z
          .object({
            kind: z.literal("freeze-broken-attack-callback"),
            ability: z.literal("Freeze Broken"),
            suppliedCallbackCount: z.literal(0)
          })
          .strict()
      })
      .strict()
  ]
);

/** Strict V1.53 callback delivery wire, including deterministic slot order. */
export const callbackDeliveryLogEntryV153Schema =
  callbackDeliveryLogEntryV153ValueSchema.superRefine((entry, context) => {
    if (Math.abs(entry.timeSeconds - entry.frame / 60) > 1e-9) {
      context.addIssue({
        code: "custom",
        path: ["timeSeconds"],
        message: "must equal frame / 60"
      });
    }
    const subscriberKeys = new Set<string>();
    const registrationIds = new Set<number>();
    const subscriptionIds = new Set<number>();
    let previousSlotIndex = -1;
    for (const [index, attempt] of entry.subscriberAttempts.entries()) {
      if (attempt.index !== index) {
        context.addIssue({
          code: "custom",
          path: ["subscriberAttempts", index, "index"],
          message: "must be contiguous and equal the array index"
        });
      }
      if (attempt.slotIndex <= previousSlotIndex) {
        context.addIssue({
          code: "custom",
          path: ["subscriberAttempts", index, "slotIndex"],
          message: "must be strictly increasing in registry slot order"
        });
      }
      previousSlotIndex = attempt.slotIndex;
      if (subscriberKeys.has(attempt.subscriberKey)) {
        context.addIssue({
          code: "custom",
          path: ["subscriberAttempts", index, "subscriberKey"],
          message: "must be unique within one delivery"
        });
      }
      subscriberKeys.add(attempt.subscriberKey);
      if (registrationIds.has(attempt.registrationLogId)) {
        context.addIssue({
          code: "custom",
          path: ["subscriberAttempts", index, "registrationLogId"],
          message: "must be unique within one delivery"
        });
      }
      registrationIds.add(attempt.registrationLogId);
      if (subscriptionIds.has(attempt.subscriptionId)) {
        context.addIssue({
          code: "custom",
          path: ["subscriberAttempts", index, "subscriptionId"],
          message: "must be unique within one delivery"
        });
      }
      subscriptionIds.add(attempt.subscriptionId);
    }
  });
