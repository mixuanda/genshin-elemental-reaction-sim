import { sourceHostOriginSchema, sourceHostAttackObservationSchema, sourceHostStatusInstanceSchema, sourceHostPendingAttackStageSchema } from "./source-host-action-origin";
import { sourceHostTaskLifecycleSchema } from "./source-host-task-lifecycle";
import { sourceHostRandomnessSchema } from "./source-host-randomness";
import { sourceHostPhaseObservationRequestSchema, sourceHostPhaseObservationSchema } from "./source-host-phase-analysis";
import { sourceHostTargetPhaseRequestSchema, sourceHostTargetPhaseReceiptSchema, sourceHostTargetPhaseMatchSchema } from "./source-host-target-phase";
import { sourceHostAbilityInvocationSchema, sourceHostAbilityProducerSchema, sourceHostOwnedGeneratorSchema, sourceHostOwnedGeneratorTriggerSchema, sourceHostAttackDispatchCompletionSchema } from "./source-host-finite-cast-types";
import { sourceHostOwnedEntitySchema, sourceHostOwnedEntityTriggerSchema, sourceHostOwnedEntityProducerSchema } from "./source-host-owned-entity-types";
import { sourceHostShieldInstanceSchema, sourceHostShieldHookSchema, sourceHostShieldProducerSchema } from "./source-host-owned-shield-types";
import { sourceHostHitCallbackBatchSchema, sourceHostHitCallbackSchema } from "./source-host-hit-callback-types";
import { sourceHostEventRegistrationSchema, sourceHostEventEmissionSchema, sourceHostEventListenerCallSchema, sourceHostEventProducerSchema } from "./source-host-event-types";
/** Independent source-host wire. It never manufactures an old SimulationResult. */
import { z } from "zod";
import { sourceHostScalarProvenanceSchema } from "./source-host-scalar-provenance";
import { sourceHostArtifactScalarInputSchema } from "./source-host-artifact-formula";
import { sourceHostCharacterModifierInputSchema } from "./source-host-character-modifier-formula";
import { sourceHostCharacterScalarInputSchema } from "./source-host-character-scalar-formula";
import { sourceHostCharacterAdditiveInputSchema } from "./source-host-character-additive-formula";
import { sourceHostCharacterFlatInputSchema } from "./source-host-character-flat-formula";
import { sourceHostCharacterShieldInputSchema } from "./source-host-character-shield-formula";
import { sourceHostCharacterMultiplierInputSchema } from "./source-host-character-multiplier-formula";
import { sourceHostWeaponAdditiveInputSchema } from "./source-host-weapon-formula";
import { sourceHostArtifactAdditiveInputSchema } from "./source-host-artifact-additive-formula";
import { sourceHostEnergyInputSchema } from "./source-host-energy-formula";
import { sourceHostHealingInputSchema } from "./source-host-healing-formula";
import { sourceHostCooldownInputSchema } from "./source-host-cooldown-formula";
import { sourceHostDrainSourceInputSchema } from "./source-host-drain-source-formula";
import { sourceHostStatReadSchema, sourceHostStatProvenanceSchema } from "./source-host-stat-provenance";
import { sourceHostTalentTableReadSchema } from "./source-host-talent-table";
import { sourceHostTalentExpressionReadSchema } from "./source-host-talent-expression";

export const SOURCE_HOST_PROTOCOL = "gidps-source-host-v1" as const;
export const SOURCE_HOST_COMMIT = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541" as const;
export const SOURCE_HOST_STELLAR_COMMIT = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd" as const;
export const sourceHostCommitSchema = z.enum([SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT]);
export const SOURCE_HOST_FORMULA_VERSION = "shared-ast-source-host-v1" as const;
export const SOURCE_HOST_RESULT_VERSION = "source-host-result-v1" as const;
const finite = z.number().finite();
const index = finite.int().nonnegative();
const common = {
  protocol: z.literal(SOURCE_HOST_PROTOCOL), id: index, frame: finite,
  actorIndex: finite.int(), actorKey: z.string(), ability: z.string(),
  attackTag: finite.int(), attackTagName: z.string(), element: z.string(),
  sourceFrame: finite, snapshotFrame: finite,
  attackId: finite.int(), targetKey: finite.int(),
  componentIds: z.array(index),
  origin: sourceHostOriginSchema.optional(),
  multiplierCalculationId: index.optional(),
  scalarProvenance: sourceHostScalarProvenanceSchema.optional(),
  sourceCommit: sourceHostCommitSchema.optional(),
};
export const sourceHostSnapshotSchema = z.object({
  charLevel: finite.int(),
  baseAtk: finite, atkPct: finite, flatAtk: finite,
  baseHp: finite, hpPct: finite, flatHp: finite,
  baseDef: finite, defPct: finite, flatDef: finite,
  em: finite, critRate: finite, critDamage: finite,
  statProvenance: sourceHostStatProvenanceSchema.nullable().optional(),
}).passthrough();
export const sourceHostComponentApplicationSchema = z.object({ id: index, multiplier: finite, amount: finite }).strict();
export const sourceHostDamageRequestSchema = z.object({
  ...common, kind: z.literal("damage"),
  damageCategory: z.enum(["ordinary", "transformative"]),
  talentTableRead: sourceHostTalentTableReadSchema.optional(),
  talentExpressionRead: sourceHostTalentExpressionReadSchema.optional(),
  componentApplications: z.array(sourceHostComponentApplicationSchema),
  snapshotStats: z.array(finite), snapshot: sourceHostSnapshotSchema,
  rawAttack: z.record(z.string(), z.unknown()),
  input: z.object({
    scalingStat: z.enum(["atk", "hp", "def", "em"]), scalingValue: finite, scaling: finite,
    baseDamageBonus: finite, flatDamage: finite, damageBonus: finite,
    // Flat-only source attacks can carry the real zero-value snapshot level;
    // the ordinary AST keeps that value (usually with complete DEF ignore).
    characterLevel: finite.int().min(0).max(100), enemyLevel: finite.int().min(1),
    defenseAdjustment: finite, defenseIgnore: finite, effectiveResistance: finite,
    critRate: finite, critDamage: finite, isCrit: z.boolean(), critRoll: finite.nullable(), hitWeakPoint: z.boolean(),
    elementalMastery: finite, amped: z.boolean(), amplifyingMultiplier: finite,
    amplifyingReaction: z.union([z.string(), finite.int()]), reactionBonus: finite,
    groupMultiplier: finite, elevation: finite,
  }).strict(),
}).passthrough();
const reactionInput = z.object({
  characterLevel: finite.int().min(1).max(100), elementalMastery: finite,
  reactionBonus: finite, levelBaseDamage: finite, baseMultiplier: finite,
}).strict();
export const sourceHostReactionRequestSchema = z.object({
  ...common, kind: z.enum(["transformative-base", "additive-base"]), input: reactionInput,
  statRead: sourceHostStatReadSchema.optional(),
  componentApplications: z.array(sourceHostComponentApplicationSchema),
  damageCategory: z.enum(["ordinary", "transformative"]),
  snapshot: z.null(), snapshotStats: z.null(), rawAttack: z.record(z.string(), z.unknown()),
}).passthrough();
const lunarRankedBranch = z.enum(["lunar-charged-reaction", "lunar-crystallize-reaction"]);
const lunarDirectBranch = z.enum(["lunar-charged-direct", "lunar-bloom-direct", "lunar-crystallize-direct"]);
export const sourceHostLunarContributorRequestSchema = sourceHostDamageRequestSchema.extend({
  kind: z.literal("lunar-contributor"), damageCategory: z.literal("lunar-contributor"),
  input: z.object({
    branch: lunarRankedBranch, characterLevel: finite.int().min(1).max(100), levelBaseDamage: finite,
    elementalMastery: finite, baseDamageBonus: finite, reactionBonus: finite, flatDamage: finite, elevation: finite,
    critRate: finite, critDamage: finite, critRoll: finite.min(0).lt(1), isCrit: z.boolean(),
  }).strict(),
});
export const sourceHostLunarRankedRequestSchema = sourceHostReactionRequestSchema.extend({
  kind: z.literal("lunar-ranked"), damageCategory: z.literal("lunar-ranked"),
  input: z.object({ branch: lunarRankedBranch, rankedContributorIds: z.array(index), weights: z.array(finite), displayIsCrit: z.boolean() }).strict(),
});
export const sourceHostLunarDirectRequestSchema = sourceHostDamageRequestSchema.extend({
  kind: z.literal("lunar-direct"), damageCategory: z.literal("lunar-direct"),
  input: sourceHostDamageRequestSchema.shape.input.extend({ branch: lunarDirectBranch }),
});
export const sourceHostLunarDeliveryRequestSchema = sourceHostDamageRequestSchema.extend({
  kind: z.literal("lunar-delivery"), damageCategory: z.literal("lunar-delivery"),
  input: sourceHostDamageRequestSchema.shape.input.extend({ branch: lunarRankedBranch }),
});
export const sourceHostLunarBloomEventRequestSchema = sourceHostReactionRequestSchema.extend({
  kind: z.literal("lunar-bloom-event"), damageCategory: z.literal("lunar-bloom-event"),
  input: z.object({ branch: z.literal("lunar-bloom-event") }).strict(),
});
export const sourceHostArtifactScalarRequestSchema = sourceHostReactionRequestSchema.extend({
  kind: z.literal("artifact-scalar"), damageCategory: z.literal("artifact-scalar"),
  input: sourceHostArtifactScalarInputSchema,
});
export type SourceHostArtifactScalarRequest = z.infer<typeof sourceHostArtifactScalarRequestSchema>;
export const sourceHostCharacterModifierRequestSchema = sourceHostReactionRequestSchema.extend({
  kind: z.literal("character-modifier"), damageCategory: z.literal("character-modifier"),
  input: sourceHostCharacterModifierInputSchema,
  statRead: sourceHostStatReadSchema.optional(),
  statReads: z.array(sourceHostStatReadSchema).min(2).optional(),
});
export type SourceHostCharacterModifierRequest = z.infer<typeof sourceHostCharacterModifierRequestSchema>;
export const sourceHostCharacterScalarRequestSchema = sourceHostReactionRequestSchema.extend({
  kind: z.literal("character-scalar"), damageCategory: z.literal("character-scalar"),
  input: sourceHostCharacterScalarInputSchema,
  statRead: sourceHostStatReadSchema.optional(),
  valueSources: z.record(z.string(), index).optional(),
});
export type SourceHostCharacterScalarRequest = z.infer<typeof sourceHostCharacterScalarRequestSchema>;
export const sourceHostCharacterAdditiveRequestSchema = sourceHostReactionRequestSchema.extend({
  kind: z.literal("character-additive"), damageCategory: z.literal("character-additive"),
  input: sourceHostCharacterAdditiveInputSchema,
  snapshotStats: z.array(finite).length(26).nullable(), snapshot: sourceHostSnapshotSchema.nullable(),
  componentScope: z.literal("same-hit").optional(),
  statRead: sourceHostStatReadSchema.optional(),
  statReads: z.array(sourceHostStatReadSchema).min(2).optional(),
  valueSources: z.record(z.string(), index).optional(),
});
export type SourceHostCharacterAdditiveRequest = z.infer<typeof sourceHostCharacterAdditiveRequestSchema>;
export const sourceHostCharacterFlatRequestSchema = sourceHostReactionRequestSchema.extend({
  kind: z.literal("character-flat"), damageCategory: z.literal("character-flat"),
  input: sourceHostCharacterFlatInputSchema,
  componentScope: z.literal("queued-attack"),
  snapshotStats: z.array(finite).length(26).nullable(), snapshot: sourceHostSnapshotSchema.nullable(),
  priorComponents: z.array(z.object({
    id: index, multiplier: finite, amount: finite, scope: z.enum(["attack-info", "snapshot"]),
  }).strict()),
  statReads: z.array(sourceHostStatReadSchema).optional(),
  valueSources: z.record(z.string(), index).optional(),
});
export type SourceHostCharacterFlatRequest = z.infer<typeof sourceHostCharacterFlatRequestSchema>;
export const sourceHostCharacterShieldRequestSchema = sourceHostReactionRequestSchema.extend({
  kind: z.literal("character-shield"), damageCategory: z.literal("character-shield"),
  input: sourceHostCharacterShieldInputSchema,
  snapshotStats: z.array(finite).length(26).nullable(), snapshot: sourceHostSnapshotSchema.nullable(),
  statReads: z.array(sourceHostStatReadSchema).optional(),
  valueSources: z.record(z.string(), index).optional(),
});
export type SourceHostCharacterShieldRequest = z.infer<typeof sourceHostCharacterShieldRequestSchema>;
export const sourceHostCharacterMultiplierRequestSchema = sourceHostReactionRequestSchema.extend({
  kind: z.literal("character-multiplier"), damageCategory: z.literal("character-multiplier"),
  input: sourceHostCharacterMultiplierInputSchema,
  priorMultiplierCalculationId: index.optional(),
  statReads: z.array(sourceHostStatReadSchema).optional(),
  valueSources: z.record(z.string(), index).optional(),
});
export type SourceHostCharacterMultiplierRequest = z.infer<typeof sourceHostCharacterMultiplierRequestSchema>;
export const sourceHostWeaponAdditiveRequestSchema = sourceHostReactionRequestSchema.extend({
  kind: z.literal("weapon-additive"), damageCategory: z.literal("weapon-additive"),
  input: sourceHostWeaponAdditiveInputSchema,
  statRead: sourceHostStatReadSchema,
  weaponState: z.object({
    buffExpiry: finite.int(), cooldownExpiry: finite.int(),
    remainingBefore: finite.int().optional(), remainingAfter: finite.int().optional(),
  }).strict(),
});
export type SourceHostWeaponAdditiveRequest = z.infer<typeof sourceHostWeaponAdditiveRequestSchema>;
export const sourceHostArtifactAdditiveStateSchema = z.discriminatedUnion("ruleId", [
  z.object({ ruleId: z.literal("echoes"), sourceHolderIndex: finite.int(), path: z.enum(["active-window", "rolled-proc"]),
    probabilityBefore: finite, probabilityAfter: finite, roll: finite.nullable(),
    procExpiryBefore: finite.int(), procExpiryAfter: finite.int(),
    cooldownBefore: finite.int(), cooldownAfter: finite.int() }).strict(),
  z.object({ ruleId: z.literal("songofdayspast"), sourceHolderIndex: finite.int(),
    remainingBefore: finite.int(), remainingAfter: finite.int(),
    windowRemainingFrames: finite.int(), healSnap: finite }).strict(),
  z.object({ ruleId: z.literal("oceanhuedclam"), sourceHolderIndex: finite.int(), bubbleHealStacks: finite,
    bubbleExpiry: finite.int(), cooldownExpiry: finite.int(), queueDelayFrames: z.literal(1) }).strict(),
]);
export const sourceHostArtifactAdditiveRequestSchema = sourceHostReactionRequestSchema.extend({
  kind: z.literal("artifact-additive"), damageCategory: z.literal("artifact-additive"),
  input: sourceHostArtifactAdditiveInputSchema,
  componentScope: z.enum(["same-hit", "queued-attack"]),
  artifactState: sourceHostArtifactAdditiveStateSchema,
  statRead: sourceHostStatReadSchema.optional(),
});
export type SourceHostArtifactAdditiveRequest = z.infer<typeof sourceHostArtifactAdditiveRequestSchema>;
const stellarRankedBranch = z.enum(["stellar-swirl-anemo-reaction", "stellar-swirl-vortex-1", "stellar-swirl-vortex-2"]);
export const sourceHostStellarContributorRequestSchema = sourceHostLunarContributorRequestSchema.extend({
  kind: z.literal("stellar-contributor"), damageCategory: z.literal("stellar-contributor"),
  input: sourceHostLunarContributorRequestSchema.shape.input.extend({ branch: stellarRankedBranch, reactionMultiplier: finite }),
});
export const sourceHostStellarRankedRequestSchema = sourceHostLunarRankedRequestSchema.extend({
  kind: z.literal("stellar-ranked"), damageCategory: z.literal("stellar-ranked"),
  input: sourceHostLunarRankedRequestSchema.shape.input.extend({ branch: stellarRankedBranch }),
});
export const sourceHostStellarDeliveryRequestSchema = sourceHostDamageRequestSchema.extend({
  kind: z.literal("stellar-delivery"), damageCategory: z.literal("stellar-delivery"),
  input: sourceHostDamageRequestSchema.shape.input.extend({ branch: z.literal("stellar-swirl-delivery") }),
});
export const sourceHostStellarDirectRequestSchema = sourceHostDamageRequestSchema.extend({
  kind: z.literal("stellar-direct"), damageCategory: z.literal("stellar-direct"),
  input: sourceHostDamageRequestSchema.shape.input.extend({
    branch: z.enum(["stellar-conduct-direct", "stellar-swirl-direct"]),
    polestarApplicationCount: finite.int().min(0).max(12).optional(),
  }),
});
export const sourceHostStellarConductEventRequestSchema = sourceHostReactionRequestSchema.extend({
  kind: z.literal("stellar-conduct-event"), damageCategory: z.literal("stellar-conduct-event"),
  input: z.object({ branch: z.literal("stellar-conduct-event") }).strict(),
});
export type SourceHostStellarContributorRequest = z.infer<typeof sourceHostStellarContributorRequestSchema>;
export type SourceHostStellarRequest = z.infer<typeof sourceHostStellarContributorRequestSchema | typeof sourceHostStellarRankedRequestSchema | typeof sourceHostStellarDeliveryRequestSchema | typeof sourceHostStellarDirectRequestSchema | typeof sourceHostStellarConductEventRequestSchema>;
export const sourceHostOutgoingRequestSchema = z.union([sourceHostDamageRequestSchema, sourceHostLunarDirectRequestSchema, sourceHostLunarDeliveryRequestSchema, sourceHostStellarDeliveryRequestSchema, sourceHostStellarDirectRequestSchema]);
export type SourceHostOutgoingRequest = z.infer<typeof sourceHostOutgoingRequestSchema>;
export const sourceHostTargetApplicationRequestSchema = z.object({
  ...common, kind: z.literal("target-application"), damageCategory: z.literal("target-application"),
  componentIds: z.array(index).length(0), componentApplications: z.array(sourceHostComponentApplicationSchema).length(0),
  rawCalculationId: index, phase: sourceHostTargetPhaseMatchSchema,
  input: z.object({ rawDamage: finite, hpBefore: finite, damageMode: z.boolean() }).strict(),
  snapshot: z.null(), snapshotStats: z.null(), rawAttack: z.record(z.string(), z.unknown()),
}).passthrough();
export type SourceHostTargetApplicationRequest = z.infer<typeof sourceHostTargetApplicationRequestSchema>;
export const sourceHostPlayerIncomingRequestSchema = sourceHostDamageRequestSchema.extend({
  kind: z.literal("player-incoming"), damageCategory: z.literal("player-incoming"),
  input: z.object({
    scalingStat: z.enum(["atk", "hp", "def", "em"]), scalingValue: finite, scaling: finite,
    flatDamage: finite, damageBonus: finite, playerDefense: finite, defenseIgnore: finite,
    playerResistance: finite, attackerLevel: finite.int(), critRate: finite, critDamage: finite,
    isCrit: z.boolean(), critRoll: finite.nullable(), hitWeakPoint: z.boolean(),
    elementalMastery: finite, amped: z.boolean(), amplifyingMultiplier: finite,
    reactionBonus: finite, groupMultiplier: finite,
  }).strict(),
});
export type SourceHostPlayerIncomingRequest = z.infer<typeof sourceHostPlayerIncomingRequestSchema>;
const sourceHostPlayerStateCommon = {
  ...common,
  componentApplications: z.array(sourceHostComponentApplicationSchema),
  snapshotStats: z.null(), snapshot: z.null(), rawAttack: z.record(z.string(), z.unknown()),
};
export const sourceHostPlayerManualIncomingRequestSchema = z.object({
  ...sourceHostPlayerStateCommon, kind: z.literal("player-manual-incoming"),
  damageCategory: z.literal("player-manual-incoming"), rawCalculationId: index.optional(),
  input: z.object({ rawDamage: finite }).strict(),
}).passthrough();
export type SourceHostPlayerManualIncomingRequest = z.infer<typeof sourceHostPlayerManualIncomingRequestSchema>;
export const sourceHostPlayerShieldRequestSchema = z.object({
  ...sourceHostPlayerStateCommon, kind: z.literal("player-shield"), damageCategory: z.literal("player-shield"),
  hpBeforeCalculationId: index.optional(),
  bonusCalculationId: index.optional(),
  incomingCalculationId: index.optional(),
  input: z.object({
    hpBefore: finite, incomingDamage: finite, shieldElement: z.string(), incomingElement: z.string(),
    bonus: finite, shieldType: finite.int(), output: z.enum(["hpAfter", "damageAfter"]),
  }).strict(),
}).passthrough();
export const sourceHostPlayerDrainRequestSchema = z.object({
  ...sourceHostPlayerStateCommon, kind: z.literal("player-drain"), damageCategory: z.literal("player-drain"),
  amountCalculationId: index.optional(),
  input: z.object({ hpBefore: finite, maxHp: finite, amount: finite }).strict(),
}).passthrough();
export const sourceHostDrainSourceRequestSchema = z.object({
  ...sourceHostPlayerStateCommon, kind: z.literal("character-drain"), damageCategory: z.literal("character-drain"),
  input: sourceHostDrainSourceInputSchema, statReads: z.array(sourceHostStatReadSchema).optional(),
  valueSources: z.record(z.string(), index).optional(),
}).passthrough();
export type SourceHostDrainSourceRequest = z.infer<typeof sourceHostDrainSourceRequestSchema>;
export const sourceHostPlayerShieldMinimumRequestSchema = z.object({
  ...sourceHostPlayerStateCommon, kind: z.literal("player-shield-min"), damageCategory: z.literal("player-shield-min"),
  input: z.object({ currentMinimum: finite, damageAfter: finite }).strict(),
}).passthrough();
export const sourceHostEnergyRequestSchema = z.object({
  ...sourceHostPlayerStateCommon, kind: z.literal("character-energy"), damageCategory: z.literal("character-energy"),
  input: sourceHostEnergyInputSchema, statRead: sourceHostStatReadSchema.optional(),
}).passthrough();
export type SourceHostEnergyRequest = z.infer<typeof sourceHostEnergyRequestSchema>;
export const sourceHostHealingRequestSchema = z.object({
  ...sourceHostPlayerStateCommon, kind: z.literal("character-healing"), damageCategory: z.literal("character-healing"),
  input: sourceHostHealingInputSchema, statRead: sourceHostStatReadSchema.optional(),
  statReads: z.array(sourceHostStatReadSchema).optional(),
  valueSources: z.record(z.string(), index).optional(),
  snapshotStats: z.array(finite).length(26).nullable(), snapshot: sourceHostSnapshotSchema.nullable(),
}).passthrough();
export type SourceHostHealingRequest = z.infer<typeof sourceHostHealingRequestSchema>;
export const sourceHostCooldownRequestSchema = z.object({
  ...sourceHostPlayerStateCommon, kind: z.literal("character-cooldown"), damageCategory: z.literal("character-cooldown"),
  input: sourceHostCooldownInputSchema,
}).passthrough();
export type SourceHostCooldownRequest = z.infer<typeof sourceHostCooldownRequestSchema>;
export type SourceHostPlayerShieldRequest = z.infer<typeof sourceHostPlayerShieldRequestSchema>;
export type SourceHostPlayerDrainRequest = z.infer<typeof sourceHostPlayerDrainRequestSchema>;
export type SourceHostPlayerShieldMinimumRequest = z.infer<typeof sourceHostPlayerShieldMinimumRequestSchema>;
export const sourceHostCalculationRequestSchema = z.union([sourceHostDamageRequestSchema, sourceHostReactionRequestSchema,
  sourceHostArtifactScalarRequestSchema,
  sourceHostCharacterModifierRequestSchema,
  sourceHostCharacterScalarRequestSchema,
  sourceHostCharacterAdditiveRequestSchema,
  sourceHostCharacterFlatRequestSchema,
  sourceHostCharacterShieldRequestSchema,
  sourceHostCharacterMultiplierRequestSchema,
  sourceHostWeaponAdditiveRequestSchema,
  sourceHostArtifactAdditiveRequestSchema,
  sourceHostEnergyRequestSchema,
  sourceHostHealingRequestSchema, sourceHostCooldownRequestSchema,
  sourceHostLunarContributorRequestSchema, sourceHostLunarRankedRequestSchema, sourceHostLunarDirectRequestSchema,
  sourceHostLunarDeliveryRequestSchema, sourceHostLunarBloomEventRequestSchema, sourceHostPlayerIncomingRequestSchema,
  sourceHostPlayerShieldRequestSchema, sourceHostPlayerShieldMinimumRequestSchema, sourceHostPlayerDrainRequestSchema,
  sourceHostDrainSourceRequestSchema,
  sourceHostPlayerManualIncomingRequestSchema,
  sourceHostTargetApplicationRequestSchema,
  sourceHostStellarContributorRequestSchema, sourceHostStellarRankedRequestSchema, sourceHostStellarDeliveryRequestSchema, sourceHostStellarDirectRequestSchema, sourceHostStellarConductEventRequestSchema]);
export type SourceHostDamageRequest = z.infer<typeof sourceHostDamageRequestSchema>;
export type SourceHostReactionRequest = z.infer<typeof sourceHostReactionRequestSchema>;
export type SourceHostCalculationRequest = z.infer<typeof sourceHostCalculationRequestSchema>;
export type SourceHostLunarContributorRequest = z.infer<typeof sourceHostLunarContributorRequestSchema>;
export type SourceHostSpecialRequest = Exclude<SourceHostCalculationRequest, SourceHostDamageRequest | SourceHostReactionRequest | SourceHostTargetApplicationRequest | SourceHostArtifactScalarRequest | SourceHostCharacterModifierRequest | SourceHostCharacterScalarRequest | SourceHostCharacterAdditiveRequest | SourceHostCharacterFlatRequest | SourceHostCharacterShieldRequest | SourceHostCharacterMultiplierRequest | SourceHostWeaponAdditiveRequest | SourceHostArtifactAdditiveRequest | SourceHostEnergyRequest | SourceHostHealingRequest | SourceHostCooldownRequest | SourceHostDrainSourceRequest | SourceHostPlayerIncomingRequest | SourceHostPlayerManualIncomingRequest | SourceHostPlayerShieldRequest | SourceHostPlayerShieldMinimumRequest | SourceHostPlayerDrainRequest | SourceHostStellarRequest>;
export function isSourceHostOutgoingRequest(request: SourceHostCalculationRequest): request is SourceHostOutgoingRequest {
  return request.kind === "damage" || request.kind === "lunar-direct" || request.kind === "lunar-delivery" || request.kind === "stellar-direct" || request.kind === "stellar-delivery";
}
export const sourceHostCalculationRecordSchema = z.object({ request: sourceHostCalculationRequestSchema, value: finite }).strict();
export type SourceHostCalculationRecord = z.infer<typeof sourceHostCalculationRecordSchema>;
export const sourceHostApplicationSchema = z.object({
  origin: sourceHostOriginSchema.optional(),
  dispatchId: z.number().int().positive().optional(),
  id: index, calculationId: index, attackId: finite.int(), frame: finite, targetKey: finite.int(), damageMode: z.boolean(),
  rawDamage: finite, appliedDamage: finite, hpBefore: finite, hpAfter: finite, isCrit: z.boolean(),
  applicationCalculationId: index.optional(), targetPhase: sourceHostTargetPhaseMatchSchema.optional(),
  targetPhaseEffects: z.object({
    hitCallbacksSkipped: index,
    onEnemyHitGameplaySkipped: index, onEnemyHitObserversEmitted: index,
    onEnemyDamageGameplaySkipped: index, onEnemyDamageObserversEmitted: index,
  }).strict().optional(),
}).passthrough();
export type SourceHostApplication = z.infer<typeof sourceHostApplicationSchema>;
export const sourceHostPlayerApplicationSchema = z.object({
  id: index, calculationId: index, attackId: finite.int(), frame: finite, targetKey: finite.int(),
  activeActorIndex: finite.int(), rawDamage: finite, damageAfterShield: finite,
  damagedActorIndex: finite.int().optional(),
  shieldAbsorbed: finite, drainAttempted: finite, isCrit: z.boolean(),
  shieldCalculationIds: z.array(index).optional(), drainCalculationId: index.nullable().optional(),
}).strict();
export type SourceHostPlayerApplication = z.infer<typeof sourceHostPlayerApplicationSchema>;
export const sourceHostDrainApplicationSchema = z.object({
  id: index, calculationId: index, sourceCalculationId: index.nullable(), attackId: finite.int(),
  frame: finite.int(), actorIndex: finite.int(), actorKey: z.string(), ability: z.string(),
  amount: finite, hpBefore: finite, maxHp: finite, resultRatio: finite,
}).strict();
export type SourceHostDrainApplication = z.infer<typeof sourceHostDrainApplicationSchema>;
export const sourceHostEnergyApplicationSchema = z.object({
  id: index, calculationId: index, frame: finite.int(), actorIndex: finite.int(), actorKey: z.string(),
  source: z.string(), operation: z.enum(["flat-change", "consume", "particle-apply"]),
  energyBefore: finite, energyAfter: finite, requestedAmount: finite, energyMax: finite,
  amountCalculationId: index.optional(),
}).strict();
export type SourceHostEnergyApplication = z.infer<typeof sourceHostEnergyApplicationSchema>;
export const sourceHostHealingApplicationSchema = z.object({
  id: index, frame: finite.int(), actorIndex: finite.int(), actorKey: z.string(), source: z.string(),
  callerIndex: finite.int(), targetIndex: finite.int(),
  baseCalculationId: index, bonusCalculationId: index, amountCalculationId: index,
  receiveCalculationId: index.optional(), overhealCalculationId: index,
  previousHp: finite, previousHpDebt: finite, currentHp: finite, currentHpDebt: finite,
  finalAmount: finite, receivedAmount: finite, overheal: finite,
}).strict();
export type SourceHostHealingApplication = z.infer<typeof sourceHostHealingApplicationSchema>;
export const sourceHostExecutionModeSchema = z.enum(["auto-wait", "strict"]);
export type SourceHostExecutionMode = z.infer<typeof sourceHostExecutionModeSchema>;
export const sourceHostInitialEnergySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("zero") }).strict(),
  z.object({ mode: z.literal("full") }).strict(),
  z.object({ mode: z.literal("custom"), byActor: z.record(z.string().min(1), z.number().int().nonnegative()) }).strict(),
]);
export type SourceHostInitialEnergy = z.infer<typeof sourceHostInitialEnergySchema>;
/** Stable identity for the saved override; Go map insertion order is irrelevant. */
export function sourceHostInitialEnergyIdentity(value?: SourceHostInitialEnergy): string {
  if (value === undefined) return "absent";
  if (value.mode !== "custom") return value.mode;
  return JSON.stringify(["custom", Object.entries(value.byActor).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)]);
}
export const sourceHostStartupStateSchema = z.object({
  mode: z.enum(["zero", "full", "custom"]),
  actors: z.array(z.object({
    actorIndex: z.number().int(), actorKey: z.string().min(1), requestedEnergy: z.number().int().nonnegative().nullable(),
    energy: finite.nonnegative(), maxEnergy: finite.nonnegative(),
  }).strict()),
}).strict();
export type SourceHostStartupState = z.infer<typeof sourceHostStartupStateSchema>;
/** Legacy receipts omit both fields; a new receipt must carry the override and its native startup snapshot together. */
export function assertSourceHostStartupState(
  initialEnergy: SourceHostInitialEnergy | undefined,
  startupState: SourceHostStartupState | undefined,
): void {
  if (initialEnergy === undefined && startupState === undefined) return;
  if (initialEnergy === undefined || startupState === undefined || initialEnergy.mode !== startupState.mode) {
    throw new Error("来源初始能量设置与实际开局状态回执不完整或模式不一致。");
  }
  const keys = new Set<string>();
  const indexes = new Set<number>();
  for (const actor of startupState.actors) {
    if (keys.has(actor.actorKey) || indexes.has(actor.actorIndex)) throw new Error("来源开局状态包含重复角色。");
    keys.add(actor.actorKey); indexes.add(actor.actorIndex);
    const requested = initialEnergy.mode === "custom" ? initialEnergy.byActor[actor.actorKey]
      : initialEnergy.mode === "zero" ? 0 : null;
    if (requested === undefined || actor.requestedEnergy !== requested) throw new Error("来源开局状态的角色请求能量与保存的设置不一致。");
  }
  if (initialEnergy.mode === "custom" && Object.keys(initialEnergy.byActor).some(key => !keys.has(key))) {
    throw new Error("来源开局状态缺少自定义初始能量的角色。");
  }
}
export const sourceHostRunRequestSchema = z.object({ protocol: z.literal(SOURCE_HOST_PROTOCOL), config: z.string(), seed: z.string(), phaseObservation: sourceHostPhaseObservationRequestSchema.optional(), targetPhases: sourceHostTargetPhaseRequestSchema.optional(), hostVariant: z.enum(["classic", "stellar"]).optional(), executionMode: sourceHostExecutionModeSchema.optional(), initialEnergy: sourceHostInitialEnergySchema.optional(), stopAtDuration: z.boolean().optional(), primaryTargetIndex: z.number().int().nonnegative().optional() }).strict();
export type SourceHostRunRequest = z.infer<typeof sourceHostRunRequestSchema>;
export const sourceHostObservationWindowSchema = z.object({
  policy: z.enum(["duration-or-native", "native"]),
  configuredEndFrame: z.number().int().nonnegative(),
  actualEndFrame: z.number().int().nonnegative(),
  endReason: z.enum(["duration", "targets-dead", "actions-exhausted"]),
}).strict();
export type SourceHostObservationWindow = z.infer<typeof sourceHostObservationWindowSchema>;
export const sourceHostTargetSceneSchema = z.object({
  damageMode: z.boolean(),
  primaryTargetIndex: z.number().int().nonnegative(),
  initialDefaultTargetKey: z.number().int(),
  targets: z.array(z.object({
    declarationIndex: z.number().int().nonnegative(),
    targetKey: z.number().int(),
    profile: z.record(z.string(), z.unknown()),
    position: z.object({ x: z.number().finite(), y: z.number().finite(), radius: z.number().finite() }).strict(),
    initialHP: z.number().finite(),
    initialMaxHP: z.number().finite(),
  }).strict()),
}).strict();
export type SourceHostTargetScene = z.infer<typeof sourceHostTargetSceneSchema>;
export const sourceHostNativeResultSchema = z.object({
  taskLifecycle: sourceHostTaskLifecycleSchema.optional(),
  lifecycleObservationFrame: z.number().int().optional(),
  statusInstances: z.array(sourceHostStatusInstanceSchema).optional(),
  pendingAttackStages: z.array(sourceHostPendingAttackStageSchema).optional(),
  attackObservations: z.array(sourceHostAttackObservationSchema).optional(),
  abilityInvocations: z.array(sourceHostAbilityInvocationSchema).optional(),
  abilityProducers: z.array(sourceHostAbilityProducerSchema).optional(),
  ownedGenerators: z.array(sourceHostOwnedGeneratorSchema).optional(),
  ownedGeneratorTriggers: z.array(sourceHostOwnedGeneratorTriggerSchema).optional(),
  ownedEntities: z.array(sourceHostOwnedEntitySchema).optional(),
  ownedEntityTriggers: z.array(sourceHostOwnedEntityTriggerSchema).optional(),
  ownedEntityProducers: z.array(sourceHostOwnedEntityProducerSchema).optional(),
  shieldInstances: z.array(sourceHostShieldInstanceSchema).optional(),
  shieldHooks: z.array(sourceHostShieldHookSchema).optional(),
  shieldProducers: z.array(sourceHostShieldProducerSchema).optional(),
  hitCallbackBatches: z.array(sourceHostHitCallbackBatchSchema).optional(),
  hitCallbacks: z.array(sourceHostHitCallbackSchema).optional(),
  eventRegistrations: z.array(sourceHostEventRegistrationSchema).optional(),
  eventEmissions: z.array(sourceHostEventEmissionSchema).optional(),
  eventListenerCalls: z.array(sourceHostEventListenerCallSchema).optional(),
  eventProducers: z.array(sourceHostEventProducerSchema).optional(),
  attackDispatchCompletions: z.array(sourceHostAttackDispatchCompletionSchema).optional(),
  protocol: z.literal(SOURCE_HOST_PROTOCOL), sourceCommit: sourceHostCommitSchema,
  observationWindow: sourceHostObservationWindowSchema.optional(),
  targetScene: sourceHostTargetSceneSchema.optional(),
  targetPhases: sourceHostTargetPhaseReceiptSchema.optional(),
  randomness: sourceHostRandomnessSchema.optional(),
  config: z.string(), seed: z.string(), phaseObservation: sourceHostPhaseObservationRequestSchema.optional(), phaseObservations: z.array(sourceHostPhaseObservationSchema).optional(), calculations: z.array(sourceHostCalculationRecordSchema),
  executionMode: sourceHostExecutionModeSchema.optional(),
  initialEnergy: sourceHostInitialEnergySchema.optional(), startupState: sourceHostStartupStateSchema.optional(),
  applications: z.array(sourceHostApplicationSchema),
  playerApplications: z.array(sourceHostPlayerApplicationSchema).optional(),
  drainApplications: z.array(sourceHostDrainApplicationSchema).optional(),
  energyApplications: z.array(sourceHostEnergyApplicationSchema).optional(),
  healingApplications: z.array(sourceHostHealingApplicationSchema).optional(),
  result: z.unknown(), logs: z.unknown(), capabilities: z.object({ checkpoint: z.literal(false) }).passthrough(),
}).passthrough();
export type SourceHostNativeResult = z.infer<typeof sourceHostNativeResultSchema>;
export const sourceHostArtifactSchema = z.object({ wasmSha256: z.string().regex(/^[a-f0-9]{64}$/), wasmBytes: z.number().int().positive() }).strict();
export const sourceHostResultSchema = sourceHostNativeResultSchema.extend({
  executionArtifact: sourceHostArtifactSchema.optional(),
  schemaVersion: z.literal(SOURCE_HOST_RESULT_VERSION), formulaVersion: z.literal(SOURCE_HOST_FORMULA_VERSION),
  verification: z.literal("provisional"), explanationStatus: z.literal("partial"), explanationGaps: z.array(z.string()),
});
export type SourceHostResult = z.infer<typeof sourceHostResultSchema>;
