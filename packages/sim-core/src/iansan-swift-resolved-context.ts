import { z } from "zod";

const text = z.string().trim().min(1), frame = z.number().int().nonnegative();
const amount = z.number().finite().nonnegative(), bool = z.boolean();

export const iansanSwiftResolvedEventSchema = z.strictObject({
  candidateId: z.literal("swift"), templateRole: z.literal("swift"),
  frame, snapshotFrame: frame, snapshotId: text, targetId: text,
  /** The charged branch is chosen at action entry, not checked again at impact. */
  swiftQualifiedAtCast: bool.optional(),
});
export const iansanSwiftResolvedHitStateSchema = z.strictObject({
  /** Independent hits confirm their already-occurring branch without future observations. */
  swiftQualifiedAtCast: bool.optional(),
  a1ActiveAtSnapshot: bool.optional(),
  /** Flat ATK from Iansan A1 already included in the input panel. */
  includedA1Attack: amount.optional(),
  baseAttack: amount.optional(),
  /** Historical final snapshots already contain the actual pre-existing A1 state. */
  snapshotIncludesActualA1: bool.optional(),
  /** This bounded action excludes Iansan's separate Q ATK-feedback state. */
  burstInactiveAtSnapshot: bool.optional(),
});

/** calculator-model adds snapshots using its common final-snapshot schema. */
export const iansanSwiftResolvedCastBaseSchema = z.strictObject({
  casterId: text.optional(), targetId: text.optional(), freshCastConfirmed: bool.optional(),
  noHitlag: bool.optional(), noInterruption: bool.optional(), noReplacement: bool.optional(),
  fullObservedLifetime: bool.optional(), observedThroughFrame: frame.optional(),
  statsStableAcrossHits: bool.optional(),
  inputKind: z.enum(["normal", "charged"]).optional(),
  actionReadyConfirmed: bool.optional(), groundedAtCast: bool.optional(),
  fastSkillActiveAtCast: bool.optional(), nightsoulBlessingAtCast: bool.optional(),
  precedingNormalAttackConfirmed: bool.optional(),
  normalCounterBeforeCast: z.number().int().min(0).max(2).optional(),
  initialStamina: amount.optional(), staminaCostMultiplier: amount.optional(),
  targetContacts: z.record(text, bool).optional(),
  sharedState: iansanSwiftResolvedHitStateSchema.optional(),
  hitStates: z.record(text, iansanSwiftResolvedHitStateSchema).optional(),
  independentEvent: iansanSwiftResolvedEventSchema.optional(),
  finalizedHitEvents: z.record(text, text).optional(),
});

export type IansanSwiftResolvedScheduleContext = z.infer<typeof iansanSwiftResolvedCastBaseSchema>;
export type IansanSwiftResolvedHitState = z.infer<typeof iansanSwiftResolvedHitStateSchema>;
export type IansanSwiftResolvedEvent = z.infer<typeof iansanSwiftResolvedEventSchema>;
