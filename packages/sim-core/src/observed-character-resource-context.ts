import { z } from "zod";
const text = z.string().trim().min(1), frame = z.number().int().nonnegative(), points = z.number().int().min(0).max(100);
const stamp = { id: text, frame, order: frame, stanceActiveAtBoundaryConfirmed: z.boolean().optional(), cooldownBoundaryReadyConfirmed: z.boolean().optional() };
export const observedCharacterResourceEventSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...stamp, kind: z.literal("enter"), stanceId: text, actionReadyConfirmed: z.boolean() }),
  z.strictObject({ ...stamp, kind: z.literal("normal-hit"), attackTag: z.enum(["normal", "charged"]), actorId: text, hitId: text, enemyHitConfirmed: z.boolean() }),
  z.strictObject({ ...stamp, kind: z.literal("party-damage"), actorId: text, damageId: text, nearbyPartyMemberConfirmed: z.boolean(), damage: z.number().finite().nonnegative(), lohenBaseAttack: z.number().finite().positive() }),
  z.strictObject({ ...stamp, kind: z.literal("etch-cast"), actionId: text, actionReadyConfirmed: z.boolean() }),
  z.strictObject({ ...stamp, kind: z.literal("etch-resolve"), actionId: text, hitOpponent: z.boolean() }),
  z.strictObject({ ...stamp, kind: z.literal("burst-cast"), actionId: text, actionReadyConfirmed: z.boolean() }),
  z.strictObject({ ...stamp, kind: z.literal("exit"), reason: z.enum(["leave-field", "duration", "observed-early-exit"]) }),
]);
export const observedCharacterResourceContextSchema = z.strictObject({
  character: z.literal("lohen"), casterId: text.optional(), constellation: z.number().int().min(0).max(6).optional(), ascension: z.number().int().min(0).max(6).optional(),
  initialStateObserved: z.boolean().optional(), eventsObservedThroughCutoff: z.boolean().optional(), observedOrderConfirmed: z.boolean().optional(), noHitlag: z.boolean().optional(),
  /** Clear means all source gain cooldowns were observed ready at the initial stamp. */
  cooldownsClearAtStart: z.boolean().optional(),
  initial: z.strictObject({ frame, order: frame, stanceActive: z.boolean(), stanceId: text.optional(), expiresAtFrame: frame.optional(), joy: points, will: points,
    etchUses: z.number().int().min(0).max(3), noPendingEtchConfirmed: z.boolean(), joyGainReadyAtFrame: frame.optional(), willGainReadyAtByActor: z.record(text,frame).optional() }).optional(),
  events: z.array(observedCharacterResourceEventSchema).max(1024).optional(),
  consumptionEventId: text.optional(), hitBindings: z.record(text,text).optional(),
  finalizedBindings: z.record(text,text).optional(),
});
export type ObservedCharacterResourceContext = z.infer<typeof observedCharacterResourceContextSchema>;
export type ObservedCharacterResourceEvent = z.infer<typeof observedCharacterResourceEventSchema>;
