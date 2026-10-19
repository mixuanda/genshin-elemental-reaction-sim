import { z } from "zod";

const frame = z.number().int().nonnegative(), number = z.number().finite(), name = z.string().trim().min(1);
const element = z.enum(["pyro", "hydro", "electro", "cryo"]);
/** These values describe the actual source sampling, independently of the offensive snapshot. */
export const extendedStanceHitStateSchema = z.strictObject({
  includedDamageBonus: number.nonnegative().optional(),
  includedElementalMastery: number.nonnegative().optional(),
  ifaA4Active: z.boolean().optional(),
  varkaA1NonExtraAtkAtLastRefresh: number.nonnegative().optional(),
  varkaA1Multiplier: z.union([z.literal(1), z.literal(1.4), z.literal(2.2)]).optional(),
  varkaA4Stacks: frame.max(4).optional(),
  convertedElement: z.enum(["physical", "pyro", "hydro", "electro", "cryo"]).optional(),
});
export const extendedStanceEventSchema = z.strictObject({
  candidateId: name, templateRole: name, frame, snapshotFrame: frame, snapshotId: name, targetId: name,
  actionId: name.optional(), launchFrame: frame.optional(),
  element: z.enum(["physical", "anemo", "pyro", "hydro", "electro", "cryo"]).optional(),
  coefficientMultiplier: z.union([z.literal(1), z.literal(1.4), z.literal(2.2)]).optional(), varkaA4Stacks: frame.max(4).optional(),
  observationId: name.optional(),
});
export const extendedStanceActionSchema = z.strictObject({
  id: name, frame, actorId: name, kind: z.enum(["normal", "charged", "skill", "swap"]),
  travelFrames: frame.optional(), attackSpeedBonus: number.optional(),
  staminaBeforeAction: number.nonnegative().optional(),
  swapDelayFrames: frame.optional(),
});
const swirl = z.strictObject({
  id: name, frame, actorId: name, targetId: name.optional(), targetIsEnemy: z.boolean().optional(),
  element: element.optional(),
  /** A reaction emitted by a declared candidate follows that candidate's damage. */
  triggerCandidateId: name.optional(),
  beforeSelectedTarget: z.boolean().optional(),
});
/** Snapshot schema is attached by calculator-model; this module has no runtime model dependency. */
export const extendedStanceCastBaseSchema = z.strictObject({
  casterId: name.optional(), targetId: name.optional(), freshCastConfirmed: z.boolean().optional(),
  noHitlag: z.boolean().optional(), noInterruption: z.boolean().optional(), noReplacement: z.boolean().optional(),
  fullObservedLifetime: z.boolean().optional(), observedThroughFrame: frame.optional(),
  statsStableAcrossHits: z.boolean().optional(),
  followupActions: z.array(extendedStanceActionSchema).optional(),
  targetContacts: z.record(name, z.boolean()).optional(),
  /** Any enemy, including enemies other than the calculator's selected target. */
  enemyHits: z.record(name, z.boolean()).optional(),
  ifa: z.strictObject({ noExternalNightsoulChanges: z.boolean().optional(), noUnlistedActions: z.boolean().optional() }).optional(),
  dahlia: z.strictObject({ shieldUnbroken: z.boolean().optional(), noNormalHitsOrFrozen: z.boolean().optional(), noSwaps: z.boolean().optional() }).optional(),
  varka: z.strictObject({
    teamElements: z.array(z.enum(["anemo", "geo", "dendro", "pyro", "hydro", "electro", "cryo"])).min(1).max(4).optional(),
    completeTeamConfirmed: z.boolean().optional(), hexerei: z.boolean().optional(), hexereiCount: frame.max(4).optional(),
    noUnlistedActions: z.boolean().optional(), noExternalCooldownChanges: z.boolean().optional(),
    allSwirlsRecorded: z.boolean().optional(), swirlEvents: z.array(swirl).optional(),
  }).optional(),
  prune: z.strictObject({
    hexerei: z.boolean().optional(), allInitialSwirlsRecorded: z.boolean().optional(),
    initialSwirls: z.array(swirl).optional(), recastDeclined: z.boolean().optional(),
  }).optional(),
  sharedState: extendedStanceHitStateSchema.optional(), hitStates: z.record(name, extendedStanceHitStateSchema).optional(),
  finalizedHitEvents: z.record(name, name).optional(),
});
export type ExtendedStanceScheduleContext = z.infer<typeof extendedStanceCastBaseSchema>;
export type ExtendedStanceHitState = z.infer<typeof extendedStanceHitStateSchema>;
export type ExtendedStanceAction = z.infer<typeof extendedStanceActionSchema>;
