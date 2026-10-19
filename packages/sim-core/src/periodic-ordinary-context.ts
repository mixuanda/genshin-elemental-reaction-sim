import { z } from "zod";

const frame = z.number().int().min(0).max(100000);
const amount = z.number().finite().min(0);
const text = z.string().min(1);
export const periodicOrdinaryHitStateSchema = z.strictObject({
  includedDamageBonus: amount.optional(),
  includedResistanceReduction: amount.optional(),
  /** The explicit already-occurring single hit may have no full contact history. */
  laumaOwnShredActive: z.boolean().optional(),
  ineffaA4Inactive: z.boolean().optional(), columbinaA1Inactive: z.boolean().optional(),
});
export const periodicOrdinaryCastBaseSchema = z.strictObject({
  casterId: text.optional(), targetId: text.optional(), freshCastConfirmed: z.boolean().optional(),
  noHitlag: z.boolean().optional(), noInterruption: z.boolean().optional(), noReplacement: z.boolean().optional(),
  fullObservedLifetime: z.boolean().optional(), observedThroughFrame: frame.optional(), statsStableAcrossHits: z.boolean().optional(),
  targetContacts: z.record(z.string(), z.boolean()).optional(),
  ineffa: z.strictObject({ noLunarChargedField: z.boolean().optional(), burstInactive: z.boolean().optional() }).optional(),
  columbina: z.strictObject({ noLunarEvents: z.boolean().optional(), noPriorGravityOrA1: z.boolean().optional() }).optional(),
  lauma: z.strictObject({ noPriorShred: z.boolean().optional(), initializationEm: amount.optional() }).optional(),
  chasca: z.strictObject({
    /** One entry for each other party member; duplicates remain distinct. */
    partyElements: z.array(z.enum(["pyro", "hydro", "cryo", "electro", "anemo", "geo", "dendro"])).max(3).optional(),
    bulletElements: z.array(z.enum(["anemo", "pyro", "hydro", "cryo", "electro"])).length(6).optional(),
    onlyOneEnemy: z.boolean().optional(), nightsoulInactive: z.boolean().optional(), noNightsoulBurst: z.boolean().optional(),
  }).optional(),
  sharedState: periodicOrdinaryHitStateSchema.optional(), hitStates: z.record(z.string(), periodicOrdinaryHitStateSchema).optional(),
  finalizedHitEvents: z.record(z.string(), text).optional(),
});
export type PeriodicOrdinaryScheduleContext = z.infer<typeof periodicOrdinaryCastBaseSchema>;
export const periodicOrdinaryEventSchema = z.strictObject({
  candidateId: text, templateRole: text, frame, snapshotFrame: frame, snapshotId: text, targetId: text,
  laumaOwnShredActive: z.boolean().optional(),
});
