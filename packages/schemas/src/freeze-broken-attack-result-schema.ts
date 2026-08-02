import { z } from "zod";

import { simulationEventTypeSchema } from "./schema";

const finiteNumberSchema = z.number().finite();
const nonNegativeFiniteNumberSchema = finiteNumberSchema.nonnegative();
const positiveFiniteNumberSchema = finiteNumberSchema.positive();
const nonEmptyStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, {
    message: "must not be blank"
  });
const nullableNonEmptyStringSchema = nonEmptyStringSchema.nullable();
const nonNegativeSafeIntegerSchema = z
  .number()
  .int()
  .finite()
  .nonnegative()
  .refine(Number.isSafeInteger, {
    message: "must be a safe integer"
  });
const positiveSafeIntegerSchema = z
  .number()
  .int()
  .finite()
  .positive()
  .refine(Number.isSafeInteger, {
    message: "must be a safe integer"
  });

/** Strict 1.52 wire for the normalized, audit-only Freeze Broken attack. */
export const freezeBrokenAttackLogEntrySchema = z
  .object({
    id: nonNegativeSafeIntegerSchema,
    frame: nonNegativeSafeIntegerSchema,
    targetFrame: nonNegativeSafeIntegerSchema.optional(),
    timeSeconds: nonNegativeFiniteNumberSchema,
    targetId: nonEmptyStringSchema,
    targetName: nonEmptyStringSchema,
    generation: positiveSafeIntegerSchema,
    sourceFrozenStateLogId: nonNegativeSafeIntegerSchema,
    depletionOperation: z.enum([
      "consume",
      "poise-consume",
      "shatter-consume",
      "expire"
    ]),
    reaction: z.enum([
      "freeze",
      "shatter",
      "swirlCryo",
      "crystallizeCryo"
    ]),
    reason: nullableNonEmptyStringSchema,
    depletionDamageEventId: nonNegativeSafeIntegerSchema.nullable(),
    sourceFreezeDamageEventId: nonNegativeSafeIntegerSchema.nullable(),
    triggerEventType: simulationEventTypeSchema,
    triggerEventPriority: nonNegativeFiniteNumberSchema,
    triggerEventSequence: nonNegativeSafeIntegerSchema,
    intraEventSequence: nonNegativeSafeIntegerSchema,
    frozenGaugeBefore: positiveFiniteNumberSchema,
    frozenGaugeAfter: z.literal(0),
    attack: z
      .object({
        actorIndex: z.literal(0),
        resolvedActorId: nonEmptyStringSchema,
        damageSource: z.literal("receiving-target"),
        damageSourceTargetId: nonEmptyStringSchema,
        ability: z.literal("Freeze Broken"),
        attackTag: z.literal("AttackTagNone"),
        icdTag: z.literal("ICDTagNone"),
        icdGroup: z.literal("ICDGroupDefault"),
        strikeType: z.literal("StrikeTypeDefault"),
        element: z.literal("NoElement"),
        noImpulse: z.literal(false),
        durability: z.literal(0),
        multiplier: z.literal(0),
        flatDamage: z.literal(0),
        snapshotDelayFrames: z.literal(-1),
        damageDelayFrames: z.literal(0),
        targeting: z.literal("single-target"),
        sourceIsSim: z.literal(true),
        doNotLog: z.literal(true)
      })
      .strict(),
    syncPhase: z
      .object({
        disposition: z.literal(
          "reference-audit-only-not-dispatched"
        ),
        referencePhase: z.literal("same-call-stack-immediate"),
        order: z.tuple([
          z.literal("on-aura-durability-depleted-frozen"),
          z.literal("on-apply-attack-freeze-broken"),
          z.literal("on-enemy-hit-freeze-broken"),
          z.literal("damage-log-freeze-broken")
        ])
      })
      .strict(),
    endOfFramePhase: z
      .object({
        disposition: z.literal(
          "reference-audit-only-not-dispatched"
        ),
        referencePhase: z.literal("zero-delay-core-task"),
        order: z.tuple([
          z.literal("apply-zero-damage"),
          z.literal("on-enemy-damage-freeze-broken-zero"),
          z.literal("attack-callbacks-none-supplied")
        ]),
        damage: z.literal(0),
        relativeToTriggerEnemyDamage: z.enum([
          "before",
          "not-applicable"
        ])
      })
      .strict(),
    executionStatus: z.literal(
      "reference-audit-only-not-dispatched"
    ),
    damageEventId: z.null(),
    hitResolutionLogId: z.null()
  })
  .strict()
  .superRefine((entry, context) => {
    if (Math.abs(entry.timeSeconds - entry.frame / 60) > 1e-9) {
      context.addIssue({
        code: "custom",
        path: ["timeSeconds"],
        message: "must equal frame / 60"
      });
    }
    const validSource =
      (entry.reaction === "freeze" &&
        entry.depletionOperation === "expire") ||
      (entry.reaction === "shatter" &&
        (entry.depletionOperation === "poise-consume" ||
          entry.depletionOperation === "shatter-consume")) ||
      (entry.reaction === "swirlCryo" &&
        entry.depletionOperation === "consume") ||
      (entry.reaction === "crystallizeCryo" &&
        entry.depletionOperation === "consume");
    if (!validSource) {
      context.addIssue({
        code: "custom",
        path: ["depletionOperation"],
        message:
          "must be one of the five supported terminal Frozen trigger paths"
      });
    }
    const expires = entry.depletionOperation === "expire";
    if (expires !== (entry.depletionDamageEventId === null)) {
      context.addIssue({
        code: "custom",
        path: ["depletionDamageEventId"],
        message:
          "natural expiry requires null; damage-triggered depletion requires an event ID"
      });
    }
    const expectedRelativePhase = expires ? "not-applicable" : "before";
    if (
      entry.endOfFramePhase.relativeToTriggerEnemyDamage !==
      expectedRelativePhase
    ) {
      context.addIssue({
        code: "custom",
        path: [
          "endOfFramePhase",
          "relativeToTriggerEnemyDamage"
        ],
        message: `must equal ${expectedRelativePhase} for ${entry.depletionOperation}`
      });
    }
  });

/** Strict 1.53 wire for the five callback-bus-dispatched audit phases. */
export const freezeBrokenAttackLogEntryV153Schema = z
  .object({
    id: nonNegativeSafeIntegerSchema,
    frame: nonNegativeSafeIntegerSchema,
    targetFrame: nonNegativeSafeIntegerSchema.optional(),
    timeSeconds: nonNegativeFiniteNumberSchema,
    targetId: nonEmptyStringSchema,
    targetName: nonEmptyStringSchema,
    generation: positiveSafeIntegerSchema,
    sourceFrozenStateLogId: nonNegativeSafeIntegerSchema,
    depletionOperation: z.enum([
      "consume",
      "poise-consume",
      "shatter-consume",
      "expire"
    ]),
    reaction: z.enum([
      "freeze",
      "shatter",
      "swirlCryo",
      "crystallizeCryo"
    ]),
    reason: nullableNonEmptyStringSchema,
    depletionDamageEventId: nonNegativeSafeIntegerSchema.nullable(),
    sourceFreezeDamageEventId: nonNegativeSafeIntegerSchema.nullable(),
    triggerEventType: simulationEventTypeSchema,
    triggerEventPriority: nonNegativeFiniteNumberSchema,
    triggerEventSequence: nonNegativeSafeIntegerSchema,
    intraEventSequence: nonNegativeSafeIntegerSchema,
    frozenGaugeBefore: positiveFiniteNumberSchema,
    frozenGaugeAfter: z.literal(0),
    attack: z
      .object({
        actorIndex: z.literal(0),
        resolvedActorId: nonEmptyStringSchema,
        damageSource: z.literal("receiving-target"),
        damageSourceTargetId: nonEmptyStringSchema,
        ability: z.literal("Freeze Broken"),
        attackTag: z.literal("AttackTagNone"),
        icdTag: z.literal("ICDTagNone"),
        icdGroup: z.literal("ICDGroupDefault"),
        strikeType: z.literal("StrikeTypeDefault"),
        element: z.literal("NoElement"),
        noImpulse: z.literal(false),
        durability: z.literal(0),
        multiplier: z.literal(0),
        flatDamage: z.literal(0),
        snapshotDelayFrames: z.literal(-1),
        damageDelayFrames: z.literal(0),
        targeting: z.literal("single-target"),
        sourceIsSim: z.literal(true),
        doNotLog: z.literal(true)
      })
      .strict(),
    syncPhase: z
      .object({
        disposition: z.literal("callback-bus-dispatched-normalized"),
        referencePhase: z.literal("same-call-stack-immediate"),
        order: z.tuple([
          z.literal("on-aura-durability-depleted-frozen"),
          z.literal("on-apply-attack-freeze-broken"),
          z.literal("on-enemy-hit-freeze-broken"),
          z.literal("damage-log-freeze-broken")
        ]),
        callbackDeliveryLogIds: z.tuple([
          nonNegativeSafeIntegerSchema,
          nonNegativeSafeIntegerSchema,
          nonNegativeSafeIntegerSchema
        ])
      })
      .strict(),
    endOfFramePhase: z
      .object({
        disposition: z.literal("callback-bus-dispatched-normalized"),
        referencePhase: z.literal("zero-delay-core-task"),
        order: z.tuple([
          z.literal("apply-zero-damage"),
          z.literal("on-enemy-damage-freeze-broken-zero"),
          z.literal("attack-callbacks-none-supplied")
        ]),
        callbackDeliveryLogIds: z.tuple([
          nonNegativeSafeIntegerSchema,
          nonNegativeSafeIntegerSchema
        ]),
        damage: z.literal(0),
        relativeToTriggerEnemyDamage: z.enum(["before", "not-applicable"])
      })
      .strict(),
    executionStatus: z.literal("callback-bus-dispatched-normalized"),
    damageEventId: z.null(),
    hitResolutionLogId: z.null()
  })
  .strict()
  .superRefine((entry, context) => {
    if (Math.abs(entry.timeSeconds - entry.frame / 60) > 1e-9) {
      context.addIssue({
        code: "custom",
        path: ["timeSeconds"],
        message: "must equal frame / 60"
      });
    }
    const validSource =
      (entry.reaction === "freeze" && entry.depletionOperation === "expire") ||
      (entry.reaction === "shatter" &&
        (entry.depletionOperation === "poise-consume" ||
          entry.depletionOperation === "shatter-consume")) ||
      (entry.reaction === "swirlCryo" &&
        entry.depletionOperation === "consume") ||
      (entry.reaction === "crystallizeCryo" &&
        entry.depletionOperation === "consume");
    if (!validSource) {
      context.addIssue({
        code: "custom",
        path: ["depletionOperation"],
        message: "must be one of the five supported terminal Frozen trigger paths"
      });
    }
    const expires = entry.depletionOperation === "expire";
    if (expires !== (entry.depletionDamageEventId === null)) {
      context.addIssue({
        code: "custom",
        path: ["depletionDamageEventId"],
        message:
          "natural expiry requires null; damage-triggered depletion requires an event ID"
      });
    }
    const expectedRelativePhase = expires ? "not-applicable" : "before";
    if (
      entry.endOfFramePhase.relativeToTriggerEnemyDamage !==
      expectedRelativePhase
    ) {
      context.addIssue({
        code: "custom",
        path: ["endOfFramePhase", "relativeToTriggerEnemyDamage"],
        message: `must equal ${expectedRelativePhase} for ${entry.depletionOperation}`
      });
    }
    const callbackIds = [
      ...entry.syncPhase.callbackDeliveryLogIds,
      ...entry.endOfFramePhase.callbackDeliveryLogIds
    ];
    if (new Set(callbackIds).size !== callbackIds.length) {
      context.addIssue({
        code: "custom",
        path: ["syncPhase", "callbackDeliveryLogIds"],
        message: "all five callback delivery IDs must be distinct"
      });
    }
  });
