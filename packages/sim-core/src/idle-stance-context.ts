import { z } from "zod";

const frame = z.number().int().nonnegative(), number = z.number().finite(), name = z.string().min(1);
export const idleStanceHitStateSchema = z.strictObject({
  includedDamageBonus: number.optional(), includedResistanceReduction: number.optional(),
  scalingHp: number.nonnegative().optional(), scalingEm: number.nonnegative().optional(),
  scalingStatMatchesPanel: z.boolean().optional(),
  zhongliShieldReductionActive: z.boolean().optional(),
  yanfeiA1Seals: frame.max(3).optional(), chioriA4Active: z.boolean().optional(),
});
export const idleStanceEventSchema = z.strictObject({
  candidateId: name, templateRole: name, frame, snapshotFrame: frame, snapshotId: name, targetId: name,
  scalingSnapshotFrame: frame.optional(), scalingSnapshotId: name.optional(),
});
/** Snapshots are added by calculator-model to avoid a circular schema dependency. */
export const idleStanceCastBaseSchema = z.strictObject({
  casterId: name.optional(), targetId: name.optional(), freshCastConfirmed: z.boolean().optional(),
  noHitlag: z.boolean().optional(), noInterruption: z.boolean().optional(), noReplacement: z.boolean().optional(),
  fullObservedLifetime: z.boolean().optional(), observedThroughFrame: frame.optional(),
  statsStableAcrossHits: z.boolean().optional(),
  followupActions: z.array(z.strictObject({
    id: name, frame, actorId: name,
    kind: z.enum(["normal", "charged", "plunge", "skill", "burst", "dash", "jump", "swap", "terminate-skill"]),
  })).optional(),
  targetContacts: z.record(name, z.boolean()).optional(),
  sharedState: idleStanceHitStateSchema.optional(), hitStates: z.record(name, idleStanceHitStateSchema).optional(),
  finalizedHitEvents: z.record(name, name).optional(),
  razor: z.strictObject({ hexerei: z.boolean().optional() }).optional(),
  zhongli: z.strictObject({ noOtherGeoConstructs: z.boolean().optional(), steleSurvives: z.boolean().optional(), shieldUnbroken: z.boolean().optional(), insideShieldRadius: z.boolean().optional() }).optional(),
  tartaglia: z.strictObject({ startsFromIdle: z.boolean().optional(), noRiptideOrProjectiles: z.boolean().optional() }).optional(),
  yanfei: z.strictObject({ priorA1Inactive: z.boolean().optional() }).optional(),
  ayato: z.strictObject({ illusionDelay: frame.optional() }).optional(),
  nilou: z.strictObject({ noPriorBounty: z.boolean().optional() }).optional(),
  wanderer: z.strictObject({ noAbsorption: z.boolean().optional(), panelExcludesAbsorptionBonuses: z.boolean().optional() }).optional(),
  alhaitham: z.strictObject({ hold: z.boolean().optional(), initialMirrors: frame.max(3).optional() }).optional(),
  mika: z.strictObject({ eligibleOtherEnemyCount: frame.optional(), initialTargetIsEnemy: z.boolean().optional() }).optional(),
  kaveh: z.strictObject({ noDendroCores: z.boolean().optional(), initialCreatesNoDendroCore: z.boolean().optional() }).optional(),
  gaming: z.strictObject({ manChaiReturnDelay: frame.positive().optional(), noPriorManChai: z.boolean().optional() }).optional(),
  chiori: z.strictObject({ hold: z.boolean().optional(), noGeoConstructs: z.boolean().optional(), priorA4Inactive: z.boolean().optional() }).optional(),
});
export type IdleStanceScheduleContext = z.infer<typeof idleStanceCastBaseSchema>;
