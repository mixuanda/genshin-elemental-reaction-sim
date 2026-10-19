import { z } from "zod";

const id = z.string().trim().min(1);
const frame = z.number().int().nonnegative();
const stamp = { id, frame, order: frame };
const form = z.enum(["standard-power", "super-power", "ultimate-power"]);

/** Every transition and contact is observed; the archive supplies no attack cadence or feed threshold. */
export const linneaObservedEventSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...stamp, kind: z.literal("skill-tap"), summonId: id, observedEffect: z.enum(["summon", "feed"]), observedExpiresFrame: frame.optional(), supplyAfter: z.number().int().nonnegative().optional(), actionReadyConfirmed: z.boolean() }),
  z.strictObject({ ...stamp, kind: z.literal("normal-tap-feed"), summonId: id, supplyAfter: z.number().int().nonnegative(), contactConfirmed: z.boolean() }),
  z.strictObject({ ...stamp, kind: z.literal("burst-cast"), summonId: id, observedExpiresFrame: frame, actionReadyConfirmed: z.boolean() }),
  z.strictObject({ ...stamp, kind: z.literal("form-observed"), summonId: id, form }),
  z.strictObject({ ...stamp, kind: z.literal("expire-observed"), summonId: id }),
  z.strictObject({ ...stamp, kind: z.literal("depart-observed"), summonId: id, reason: z.enum(["expired", "cancelled", "replaced"]) }),
  z.strictObject({ ...stamp, kind: z.literal("attack-contact"), summonId: id, attackId: id, component: z.enum(["pummeler-1", "pummeler-2", "hammer", "crush"]), pairId: id.optional(), targetId: id,
    contactConfirmed: z.boolean(), targetWithinLumiA1Range: z.boolean(), nearbyMoondrift: z.boolean(), moonsignLevel: z.number().int().min(1).max(4),
    snapshotFrame: frame.optional(), snapshotId: id.optional(), activeAtExpiryBoundary: z.boolean().optional() }),
]);

export const linneaObservedContextSchema = z.strictObject({
  character: z.literal("linnea"), constellation: z.literal(0), initialLumiAbsentKnown: z.boolean(),
  eventsObservedThroughSelected: z.boolean(), observedOrderConfirmed: z.boolean(),
  events: z.array(linneaObservedEventSchema).max(2048),
  hitBindings: z.record(id, id).optional(), selectedEventId: id.optional(),
});
export type LinneaObservedContext = z.infer<typeof linneaObservedContextSchema>;
export type LinneaObservedEvent = z.infer<typeof linneaObservedEventSchema>;
export type LinneaForm = z.infer<typeof form>;
