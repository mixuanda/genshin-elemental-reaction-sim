import { z } from "zod";

const text = z.string().trim().min(1);
const frame = z.number().int().nonnegative();
const amount = z.number().finite().nonnegative();
const bool = z.boolean();
export const travelerCryoRadianceSchema = z.enum(["none", "stellar-conduct", "stellar-swirl"]);
export const travelerCryoStateRoleSchema = z.enum(["initial", "crystal", "burst-ordinary", "burst-conduct", "burst-swirl"]);

/** These are records of actual callbacks, not requests to synthesize a legal N/CA/P action. */
export const travelerCryoTriggerCallbackSchema = z.strictObject({
  id: text, frame, actorId: text, targetId: text, attackTag: z.enum(["normal", "charged", "plunge"]),
  airborneState: z.enum(["xianyun", "other"]).optional(),
  evidence: z.strictObject({
    kind: z.enum(["observed-gameplay", "pinned-gcsim-execution", "external-execution"]),
    reference: text, legalActionConfirmed: bool, actualEnemyHitConfirmed: bool,
  }),
});

/** Per-hit numerical accounting is independent from the action history. */
export const travelerCryoStateHitStateSchema = z.strictObject({
  nonExtraAtk: amount.optional(), includedA4Em: amount.max(160).optional(), impactAtk: amount.optional(),
  otherSpecialBaseBonus: amount.optional(), otherReactionBonus: amount.optional(), specialAdditive: amount.optional(),
  elevationMultiplier: amount.positive().optional(), polestarApplicationCount: z.number().int().min(0).max(12).optional(),
});

export const travelerCryoStateEventSchema = z.strictObject({
  candidateId: text, templateRole: travelerCryoStateRoleSchema,
  frame, snapshotFrame: frame, snapshotId: text, targetId: text,
  radiance: travelerCryoRadianceSchema.optional(), frostglowStacks: z.number().int().min(0).max(8).optional(),
  triggerId: text.optional(), triggerFrame: frame.optional(),
  triggerEvidence: travelerCryoTriggerCallbackSchema.optional(),
  skillActiveAtTrigger: bool.optional(), triggerIcdReady: bool.optional(),
});

/** calculator-model adds its final-snapshot schema without a circular import. */
export const travelerCryoStateCastBaseSchema = z.strictObject({
  independentEvent: travelerCryoStateEventSchema.optional(),
  casterId: text.optional(), targetId: text.optional(), freshCastConfirmed: bool.optional(),
  noHitlag: bool.optional(), noInterruption: bool.optional(), noReplacement: bool.optional(),
  fullObservedLifetime: bool.optional(), observedThroughFrame: frame.optional(), statsStableAcrossHits: bool.optional(),
  trueMoonStoryBuffEnabled: bool.optional(), travelFrames: frame.optional(),
  radianceHistoryComplete: bool.optional(), initialRadiance: travelerCryoRadianceSchema.optional(),
  radianceChanges: z.array(z.strictObject({
    id: text, frame, radiance: travelerCryoRadianceSchema,
    /** Changes coinciding with checks must explicitly precede or follow all checks that frame. */
    beforeCallbacks: bool.optional(),
  })).optional(),
  callbacksComplete: bool.optional(), triggerCallbacks: z.array(travelerCryoTriggerCallbackSchema).optional(),
  radianceAtBurst: travelerCryoRadianceSchema.optional(), frostglowStacksAtBurst: z.number().int().min(0).max(8).optional(),
  targetContacts: z.record(text, bool).optional(),
  sharedState: travelerCryoStateHitStateSchema.optional(), hitStates: z.record(text, travelerCryoStateHitStateSchema).optional(),
  finalizedHitEvents: z.record(text, text).optional(),
});

export type TravelerCryoStateScheduleContext = z.infer<typeof travelerCryoStateCastBaseSchema>;
export type TravelerCryoStateHitState = z.infer<typeof travelerCryoStateHitStateSchema>;
export type TravelerCryoStateEvent = z.infer<typeof travelerCryoStateEventSchema>;
export type TravelerCryoTriggerCallback = z.infer<typeof travelerCryoTriggerCallbackSchema>;
export type TravelerCryoRadiance = z.infer<typeof travelerCryoRadianceSchema>;
