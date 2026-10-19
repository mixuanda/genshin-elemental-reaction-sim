import { z } from "zod";

const id = z.string().trim().min(1);
const frame = z.number().int().nonnegative();
const stamp = { id, frame, order: frame, activeVeilIdsAtBoundary: z.array(id).optional() };

/** Every callback and its same-frame order is supplied by an observation. */
export const neferObservedEventSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...stamp, kind: z.literal("skill-cast"), castId: id, actionReadyConfirmed: z.boolean() }),
  z.strictObject({ ...stamp, kind: z.literal("rush-hit"), castId: id, targetId: id, contactConfirmed: z.boolean(), snapshotFrame: frame, finalPanelConfirmedAtHit: z.boolean(), emActiveAtExpiryBoundary: z.boolean().optional(), c4ActiveAtExpiryBoundary: z.boolean().optional() }),
  z.strictObject({ ...stamp, kind: z.literal("shadow-enter"), castId: id }),
  z.strictObject({ ...stamp, kind: z.literal("shadow-exit") }),
  z.strictObject({ ...stamp, kind: z.literal("c2-veil-grant"), castId: id, veilIds: z.tuple([id, id]), replacedVeilIds: z.array(id).optional() }),
  z.strictObject({ ...stamp, kind: z.literal("seed-absorb"), seedId: id, veilId: id, source: z.enum(["charged", "phantasm"]), replacesVeilId: id.optional() }),
  z.strictObject({ ...stamp, kind: z.literal("dew-gain"), dewId: id }),
  z.strictObject({ ...stamp, kind: z.literal("first-shade-summon"), phantasmId: id }),
  z.strictObject({ ...stamp, kind: z.literal("c4-target-near"), targetId: id }),
  z.strictObject({ ...stamp, kind: z.literal("c4-target-leave"), targetId: id }),
]);

export const neferObservedContextSchema = z.strictObject({
  character: z.literal("nefer"), casterId: id, constellation: z.number().int().min(0).max(6), ascension: z.number().int().min(0).max(6), moonsignCount: z.number().int().min(0).max(4),
  initialFrame: frame, initialOrder: frame, initialDew: z.number().int().min(0).max(3), initialPhantasmsUsed: z.number().int().min(0).max(3),
  initialVeils: z.array(z.strictObject({ id, expiresAt: frame })).max(5),
  initialEmWindowExpiresAt: frame.optional(), initialShadowDanceActive: z.boolean(),
  initialC4Targets: z.record(id, z.discriminatedUnion("status", [
    z.strictObject({ status: z.literal("near") }),
    z.strictObject({ status: z.literal("residual"), expiresAt: frame }),
  ])),
  eventsObservedThroughCutoff: z.boolean(), observedOrderConfirmed: z.boolean(), noHitlag: z.boolean(),
  events: z.array(neferObservedEventSchema).max(2048), hitBindings: z.record(id, id).optional(),
});

export type NeferObservedContext = z.infer<typeof neferObservedContextSchema>;
export type NeferObservedEvent = z.infer<typeof neferObservedEventSchema>;
