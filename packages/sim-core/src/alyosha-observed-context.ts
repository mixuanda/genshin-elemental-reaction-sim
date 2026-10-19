import { z } from "zod";

const id = z.string().trim().min(1);
const frame = z.number().int().nonnegative();
const stamp = { id, frame, order: frame };
const markSource = z.enum(["normal-fourth", "skill-press", "skill-hold"]);

/** Callback order and hit frames are observations. The sheet supplies no first Q tick frame. */
export const alyoshaObservedEventSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...stamp, kind: z.literal("burst-cast"), burstId: id, actionReadyConfirmed: z.boolean() }),
  z.strictObject({ ...stamp, kind: z.literal("mark-apply"), targetId: id, source: markSource, contactConfirmed: z.boolean(), nearbyRecipientIds: z.array(id).optional(), markActiveAtExpiryBoundary: z.boolean().optional() }),
  z.strictObject({ ...stamp, kind: z.literal("field-attack"), burstId: id, targetId: id, targetEnteredFieldConfirmed: z.boolean(), contactConfirmed: z.boolean(), attackId: id }),
  z.strictObject({ ...stamp, kind: z.literal("tugarin-attack"), burstId: id, targetId: id, approachedTargetConfirmed: z.boolean(), contactConfirmed: z.boolean(), attackId: id, nearbyRecipientIds: z.array(id).optional(), healRecipientId: id.optional(), healResolvedConfirmed: z.boolean().optional(), alyoshaAttackAtHeal: z.number().finite().nonnegative().optional(), markActiveAtExpiryBoundary: z.boolean().optional() }),
  z.strictObject({ ...stamp, kind: z.literal("field-change"), activeActorId: id }),
  z.strictObject({ ...stamp, kind: z.literal("precision-check"), recipientId: id, precisionActiveAtExpiryBoundary: z.boolean().optional(), radianceStellarConductActiveConfirmed: z.boolean().optional() }),
]);

export const alyoshaObservedContextSchema = z.strictObject({
  character: z.literal("alyosha"), casterId: id, constellation: z.literal(0), ascension: z.number().int().min(0).max(6), skillTalentLevel: z.number().int().min(1).max(15),
  initialFrame: frame, initialOrder: frame, initialMarksKnownClear: z.boolean(), initialPrecisionKnownClear: z.boolean(), initialBurstKnownClear: z.boolean(),
  initialActiveActorId: id, eventsObservedThroughCutoff: z.boolean(), observedOrderConfirmed: z.boolean(), noHitlag: z.boolean(),
  events: z.array(alyoshaObservedEventSchema).max(2048),
  hitBindings: z.record(id, id).optional(),
});
export type AlyoshaObservedContext = z.infer<typeof alyoshaObservedContextSchema>;
export type AlyoshaObservedEvent = z.infer<typeof alyoshaObservedEventSchema>;
