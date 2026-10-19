import { z } from "zod";

const text = z.string().trim().min(1), frame = z.number().int().min(0), num = z.number().finite();
const bool = z.boolean(), ratio = num.min(0).max(1), nonnegative = num.min(0);
const selection = z.strictObject({
  frame: frame.optional(), inRangeTargetIds: z.array(text).optional(),
  selectedTargetId: text.nullable().optional(), completeRosterConfirmed: bool.optional(),
});
const event = z.strictObject({ id: text, frame, actorId: text.optional() });
const interval = z.strictObject({ startFrame: frame, endFrame: frame });

/** Actual per-hit inputs are independent from the offensive snapshot. Missing is never zero. */
export const observedEntityHitStateSchema = z.strictObject({
  actualHPRatioAtSnapshot: ratio.optional(), paramitaActiveAtSnapshot: bool.optional(), includedAttackBonus: nonnegative.optional(),
  actualMaxHPAtScaling: nonnegative.optional(), actualAtkAtHit: nonnegative.optional(),
  targetBurningAtHit: bool.optional(), includedDamageBonus: nonnegative.optional(),
  includedAdditiveBaseDamage: nonnegative.optional(), furinaPartyMembersAboveHalf: z.number().int().min(0).max(4).optional(),
  furinaA4MaxHPAtLastRefresh: nonnegative.optional(),
});

/** Snapshot schema is attached by calculator-model; this module has no runtime model dependency. */
export const observedEntityCastBaseSchema = z.strictObject({
  casterId: text.optional(), targetId: text.optional(), freshCastConfirmed: bool.optional(),
  noHitlag: bool.optional(), noInterruption: bool.optional(), noReplacement: bool.optional(),
  fullObservedLifetime: bool.optional(), observedThroughFrame: frame.optional(), statsStableAcrossHits: bool.optional(),
  /** Q can produce a later E-tagged radish or restore E-level entities; Q talent level cannot substitute. */
  skillTalentLevel: z.number().int().min(1).max(15).optional(),
  targetContacts: z.record(z.string(), bool).optional(),
  kaeya: z.strictObject({ fixedSourceApproximationConfirmed: bool.optional() }).optional(),
  aloy: z.strictObject({ fixedSourceApproximationConfirmed: bool.optional(), travelFrames: frame.optional(),
    bombDelayFrames: frame.optional(), bombletCount: frame.optional(), allSourceBombletsDeclared: bool.optional() }).optional(),
  hutao: z.strictObject({ allChargedAttacksRecorded: bool.optional(), exitFrame: frame.optional(), noSwapUntilNaturalEnd: bool.optional(),
    skillStartCurrentHP: nonnegative.optional(), skillStartMaxHP: num.positive().optional(), skillStartBaseATK: nonnegative.optional(),
    chargedAttacks: z.array(z.strictObject({ id: text, startFrame: frame, removedFrame: frame,
      nextState: z.enum(["burst", "other"]), actorId: text, targetId: text, hitConfirmed: bool.optional() })).optional(),
  }).optional(),
  klee: z.strictObject({
    waves: z.array(z.strictObject({ extraAt12: bool.optional(), extraAt24: bool.optional() })).max(6).optional(),
    onFieldUntilEndConfirmed: bool.optional(), exitFrame: frame.optional(),
  }).optional(),
  ayato: z.strictObject({ selections: z.record(z.string(), selection).optional() }).optional(),
  layla: z.strictObject({
    shieldEndFrame: frame.optional(), shieldLifetimeConfirmed: bool.optional(),
    skillEvents: z.array(event).optional(),
    burstHitEvents: z.array(event.extend({ hitConfirmed: bool.optional(), beforeFinalStarLaunch: bool.optional() })).optional(),
    allStarEventsRecorded: bool.optional(),
    targetChecks: z.record(z.string(), z.strictObject({ targetId: text.nullable().optional(), closestWithin10Confirmed: bool.optional() })).optional(),
  }).optional(),
  yaoyao: z.strictObject({
    noPreexistingYuegui: bool.optional(), onFieldUntilEndConfirmed: bool.optional(), exitFrame: frame.optional(),
    movementStates: z.array(interval.extend({ activeActorId: text.optional(), state: z.enum(["dash", "jump", "other"]).optional() })).optional(),
    throws: z.record(z.string(), selection.extend({ activeHpRatio: ratio.optional(), activeActorId: text.optional() })).optional(),
  }).optional(),
  furina: z.strictObject({
    ousiaThroughoutConfirmed: bool.optional(),
    salonTicks: z.strictObject({ chevalmarin: z.array(frame).optional(), usher: z.array(frame).optional(), crabaletta: z.array(frame).optional() }).optional(),
    partyAtLaunch: z.record(z.string(), z.strictObject({
      activeActorId: text.optional(), activeInBurstAnimation: bool.optional(),
      members: z.array(z.strictObject({ actorId: text, currentHP: nonnegative, maxHP: num.positive() })).min(1).max(4).optional(),
      completePartyConfirmed: bool.optional(),
    })).optional(),
    a4FirstRefreshFrame: num.int().min(-29).max(0).optional(),
    a4MaxHPByRefreshFrame: z.record(z.string(), nonnegative).optional(),
    maxHPByScalingFrame: z.record(z.string(), nonnegative).optional(),
  }).optional(),
  emilie: z.strictObject({
    caseTravelFrames: frame.optional(), arkheReady: bool.optional(),
    burningWithin20: z.array(interval.extend({ burningPresent: bool.optional() })).optional(),
    burningHistoryComplete: bool.optional(), burstSelections: z.record(z.string(), selection).optional(),
  }).optional(),
  sharedState: observedEntityHitStateSchema.optional(),
  hitStates: z.record(z.string(), observedEntityHitStateSchema).optional(),
  finalizedHitEvents: z.record(z.string(), text).optional(),
});
export type ObservedEntityScheduleContext = z.infer<typeof observedEntityCastBaseSchema>;
export type ObservedEntityHitState = z.infer<typeof observedEntityHitStateSchema>;
