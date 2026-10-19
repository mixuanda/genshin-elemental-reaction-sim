import { z } from "zod";

const text = z.string().trim().min(1), frame = z.number().int().nonnegative(), nonnegative = z.number().finite().nonnegative();
const element = z.enum(["pyro", "hydro", "electro", "cryo", "anemo", "geo", "dendro"]);
const absorbable = z.enum(["pyro", "hydro", "electro", "cryo"]);
export const entityFollowupHitStateSchema = z.strictObject({
  actualAtkAtScaling: nonnegative.optional(), includedAdditiveBaseDamage: nonnegative.optional(),
  includedJahodaA4EM: nonnegative.optional(), jahodaA4Active: z.boolean().optional(),
  nicoleAtkAtProjection: nonnegative.optional(), nicoleSkillBuffAbsentAtSnapshot: z.boolean().optional(),
});
export const entityFollowupEventSchema = z.strictObject({
  candidateId: text, templateRole: text, frame, snapshotFrame: frame, snapshotId: text, targetId: text,
  ownerId: text, element, scalingFrame: frame.optional(), triggerId: text.optional(), triggerFrame: frame.optional(),
  damageMultiplier: nonnegative.optional(), ownA4EM: nonnegative.optional(), hexereiBonus: z.boolean().optional(), observationId: text.optional(),
});
/** All fields describe observations; missing conditions are never interpreted as zero or false. */
export const entityFollowupCastBaseSchema = z.strictObject({
  casterId: text.optional(), targetId: text.optional(), freshCastConfirmed: z.boolean().optional(),
  noHitlag: z.boolean().optional(), noInterruption: z.boolean().optional(), noReplacement: z.boolean().optional(),
  fullObservedLifetime: z.boolean().optional(), observedThroughFrame: frame.optional(), statsStableAcrossHits: z.boolean().optional(),
  skillTalentLevel: z.number().int().min(1).max(15).optional(), targetContacts: z.record(text, z.boolean()).optional(),
  independentEvent: entityFollowupEventSchema.optional(),
  jahoda: z.strictObject({
    moonsignLevel: z.number().int().min(0).optional(), noShadowPursuit: z.boolean().optional(),
    partyElements: z.array(element).min(1).max(4).optional(), completePartyConfirmed: z.boolean().optional(),
    absorptionChecks: z.record(text, z.strictObject({ allAurasInAreaConfirmed: z.boolean().optional(), elementsPresent: z.array(absorbable).optional() })).optional(),
    attackSelections: z.record(text, z.strictObject({ closestAliveEnemyIds: z.array(text).max(3).optional(), completeSelectionConfirmed: z.boolean().optional() })).optional(),
    healChecks: z.record(text, z.strictObject({ activeActorId: text.optional(), hpRatioBeforeHeal: z.number().finite().min(0).max(1).optional() })).optional(),
  }).optional(),
  nicole: z.strictObject({
    allEnemyHitEventsRecorded: z.boolean().optional(), eventsInSourceOrderConfirmed: z.boolean().optional(), noSkillBuffThroughout: z.boolean().optional(),
    casterIsHexerei: z.boolean().optional(), partyHexereiCount: z.number().int().min(0).max(4).optional(),
    enemyHitEvents: z.array(z.strictObject({ id: text, frame, actorId: text, activeActorId: text, targetId: text,
      actorElement: element, actorIsHexerei: z.boolean().optional(), enemyHitHookFired: z.boolean().optional(),
      afterStatusActivation: z.boolean().optional(),
    })).optional(),
  }).optional(),
  odette: z.strictObject({ noPriorDanceDouble: z.boolean().optional(), noUpgradeThroughout: z.boolean().optional(), noCodaOrRefreshThroughout: z.boolean().optional() }).optional(),
  sharedState: entityFollowupHitStateSchema.optional(), hitStates: z.record(text, entityFollowupHitStateSchema).optional(),
  finalizedHitEvents: z.record(text, text).optional(),
});
export type EntityFollowupScheduleContext = z.infer<typeof entityFollowupCastBaseSchema>;
export type EntityFollowupEvent = z.infer<typeof entityFollowupEventSchema>;
