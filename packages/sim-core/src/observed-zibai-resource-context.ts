import { z } from "zod";

const text = z.string().trim().min(1), frame = z.number().int().nonnegative();
const points = z.number().int().min(0).max(100), count = z.number().int().min(0).max(4);
const stamp = { id: text, frame, order: z.number().int().nonnegative(),
  /** Resolves observed activity at the nominal duration boundary, not guessed engine order. */
  phaseActiveAtBoundaryConfirmed: z.boolean().optional() };

export const observedZibaiResourceInitialSchema = z.strictObject({
  frame, order: z.number().int().nonnegative(), phaseActive: z.boolean(), radiance: points,
  releasedSteeds: count, noPendingSteedConfirmed: z.boolean(),
  phaseId: text.optional(), expiresAtFrame: frame.optional(),
  normalGainReadyAtFrame: frame.optional(), lunarGainReadyAtFrame: frame.optional(),
  lastNaturalGainFrame: frame.optional(),
});

export const observedZibaiResourceEventSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...stamp, kind: z.literal("enter"), phaseId: text,
    /** Actual entry reading; zero is explicit, never silently supplied. */
    initialRadiance: points, normalGainReadyAtFrame: frame, lunarGainReadyAtFrame: frame }),
  z.strictObject({ ...stamp, kind: z.literal("natural-gain") }),
  z.strictObject({ ...stamp, kind: z.literal("normal-gain"), actorId: text, hitId: text,
    enemyHitConfirmed: z.boolean(), cooldownBoundaryReadyConfirmed: z.boolean().optional() }),
  z.strictObject({ ...stamp, kind: z.literal("lunar-gain"), reactionId: text, triggerOwnerId: text,
    nearbyPartyTriggerConfirmed: z.boolean(), moonsignLevel: z.number().int().nonnegative(),
    cooldownBoundaryReadyConfirmed: z.boolean().optional() }),
  z.strictObject({ ...stamp, kind: z.literal("steed-consume"), actionId: text }),
  /** Release is separately observed; consumption does not invent its order or LC reset. */
  z.strictObject({ ...stamp, kind: z.literal("steed-release"), consumptionEventId: text }),
  z.strictObject({ ...stamp, kind: z.literal("burst-cast"), castId: text }),
  z.strictObject({ ...stamp, kind: z.literal("exit"), reason: z.enum(["duration", "four-steeds", "observed-early-exit"]) }),
]);

export const observedZibaiResourceContextSchema = z.strictObject({
  casterId: text.optional(), constellation: z.number().int().min(0).max(6).optional(),
  initialStateObserved: z.boolean().optional(), eventsObservedThroughCutoff: z.boolean().optional(),
  observedOrderConfirmed: z.boolean().optional(), noHitlag: z.boolean().optional(),
  initial: observedZibaiResourceInitialSchema.optional(),
  events: z.array(observedZibaiResourceEventSchema).max(512).optional(),
  /** One finite Steed action binds both its ordinary and lunar components to this debit. */
  consumptionEventId: text.optional(),
  finalizedBindingIdentity: text.optional(),
});

export type ObservedZibaiResourceContext = z.infer<typeof observedZibaiResourceContextSchema>;
export type ObservedZibaiResourceEvent = z.infer<typeof observedZibaiResourceEventSchema>;
