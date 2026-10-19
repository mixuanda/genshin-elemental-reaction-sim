import { z } from "zod";

const finite = z.number().finite();
const index = z.number().int().nonnegative();

export const capturedOrdinaryDamageInputSchema = z.object({
  scaling: finite,
  scalingStat: z.enum(["atk", "hp", "def", "em"]),
  scalingValue: finite,
  flatDamage: finite,
  damageBonus: finite,
  characterLevel: finite,
  enemyLevel: finite,
  defenseReduction: finite,
  defenseIgnore: finite,
  effectiveResistance: finite,
  critRate: finite,
  critDamage: finite,
  critMode: z.enum(["average", "allCrit", "noCrit"]),
  hitWeakPoint: z.boolean().optional(),
  reaction: z.enum(["none", "melt", "reverseMelt", "vaporize", "reverseVaporize"]),
  elementalMastery: finite,
  reactionBonus: finite,
  explicitReactionBase: finite.optional(),
  groupMultiplier: finite
}).strict();

export const capturedTransformativeDamageInputSchema = z.object({
  characterLevel: finite,
  elementalMastery: finite,
  reactionBonus: finite,
  baseMultiplier: finite,
  effectiveResistance: finite
}).strict();

export const capturedCriticalDecisionSchema = z.object({
  mode: z.enum(["configured", "seeded-random-v1"]),
  eligible: z.boolean(),
  outcome: z.enum(["critical", "noncritical", "expected", "ineligible"]),
  roll: finite.min(0).lt(1).nullable(),
  drawIndex: index.nullable()
}).strict();

const commonHit = {
  eventId: index,
  critical: capturedCriticalDecisionSchema,
  trace: z.array(z.unknown()).optional(),
  stellarConduct: z.object({ snapshotFrame: index, activeCount: index.max(12), fieldPresent: z.boolean(), buffExpiresAtFrame: index,
    baseDamageBonus: finite, damageBonus: finite, baseResistance: finite, ordinaryResistanceShred: finite, physicalResistanceReduction: finite,
    sourceRefs: z.array(z.string().min(1)).min(1) }).strict().optional()
};

export const capturedSimulationHitSchema = z.discriminatedUnion("inputKind", [
  z.object({ ...commonHit, inputKind: z.literal("ordinary"), input: capturedOrdinaryDamageInputSchema }).strict(),
  z.object({ ...commonHit, inputKind: z.literal("transformative"), input: capturedTransformativeDamageInputSchema }).strict()
]);

export const EXECUTION_CHECKPOINT_DIMENSIONS = [
  "energy", "cooldownsAndCharges", "buffsAndDebuffs", "entities", "auras",
  "resourcesAndHp", "icdAndTriggerHistory", "pendingEvents", "activeCharacterAndActionPhase"
] as const;

const randomStreamStateSchema = z.object({
  algorithm: z.literal("fnv1a32-mulberry32-v1"),
  state: z.number().int().min(0).max(0xffffffff),
  accumulator: z.number().finite().refine(Number.isInteger, "must preserve the integer accumulator"),
  drawCount: index,
}).strict().superRefine((state, context) => {
  if ((state.accumulator >>> 0) !== state.state) context.addIssue({ code: "custom", path: ["state"], message: "must match the accumulator's unsigned low word" });
});

const randomExecutionCheckpointSchema = z.object({
  version: z.literal("named-rng-state-v1"),
  streams: z.object({ particleCount: randomStreamStateSchema.optional(), particleTrigger: randomStreamStateSchema.optional(),
    critical: randomStreamStateSchema.optional(), normalHitEnergy: randomStreamStateSchema.optional(),
    dendroCorePosition: randomStreamStateSchema.optional(), crystallizePosition: randomStreamStateSchema.optional(),
    favonius: randomStreamStateSchema.optional(), sacrificial: randomStreamStateSchema.optional(), weaponProc: randomStreamStateSchema.optional(), artifactDamage: randomStreamStateSchema.optional() }).strict(),
  normalHitEnergy: z.unknown().optional(), favonius: z.unknown().optional(), sacrificial: z.unknown().optional(),
}).strict();

export const executionCheckpointStateSchema = z.object({
  energy: z.unknown(),
  cooldownsAndCharges: z.unknown(),
  buffsAndDebuffs: z.unknown(),
  entities: z.unknown(),
  auras: z.unknown(),
  resourcesAndHp: z.unknown(),
  icdAndTriggerHistory: z.unknown(),
  pendingEvents: z.unknown(),
  activeCharacterAndActionPhase: z.unknown()
}).strict().superRefine((state, context) => {
  for (const dimension of EXECUTION_CHECKPOINT_DIMENSIONS) {
    if (!Object.prototype.hasOwnProperty.call(state, dimension) || state[dimension] === undefined) {
      context.addIssue({ code: "custom", path: [dimension], message: "must explicitly capture this state dimension (use null with a coverage reason when unavailable)" });
    }
  }
  const history = state.icdAndTriggerHistory as { randomExecution?: unknown } | null;
  if (history?.randomExecution !== undefined) {
    const random = randomExecutionCheckpointSchema.safeParse(history.randomExecution);
    if (!random.success) for (const issue of random.error.issues) context.addIssue({ ...issue, path: ["icdAndTriggerHistory", "randomExecution", ...issue.path] });
  }
});

export const simulationExecutionAuditSchema = z.object({
  version: z.literal("execution-audit-v1"),
  hits: z.array(capturedSimulationHitSchema),
  phaseCheckpoints: z.array(z.object({
    tick: index,
    cumulativeDamage: finite,
    state: executionCheckpointStateSchema
  }).strict()),
  checkpointCoverage: z.object({
    complete: z.boolean(),
    missingDimensions: z.array(z.string().min(1)),
    reasons: z.array(z.string().min(1))
  }).strict(),
  criticalSampling: z.object({
    algorithm: z.literal("mulberry32-v1"),
    seed: z.string().min(1),
    drawCount: index
  }).strict().nullable()
}).strict();
