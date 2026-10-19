import { z } from "zod";

const text = z.string().trim().min(1), finite = z.number().finite(), amount = finite.nonnegative(), frame = z.number().int().nonnegative();
export const ENEMY_SHIELD_HOST_MODE = "kqm-standard-force-ordinary-v1" as const;
/** Declared scenario ordering, not a claim about every enemy AI's generation animation. */
export const ENEMY_SHIELD_PHASE_PRIORITY = -2;

export const enemyShieldDefinitionInputSchema = z.strictObject({
  id: text, targetId: text,
  profile: z.literal("standard-abyss-mage-v1"),
  element: z.enum(["pyro", "frozen"]),
  targetMaxHp: finite.positive(), shieldGaugeMultiplier: finite.positive(),
  activePhaseId: text, brokenPhaseId: text, scenarioSourceRef: text,
});
export const enemyShieldPhaseInputSchema = z.discriminatedUnion("kind", [
  z.strictObject({ id: text, frame, kind: z.literal("create"), definitionId: text, sourceRef: text }),
  z.strictObject({ id: text, frame, kind: z.literal("remove"), definitionId: text, nextPhaseId: text, sourceRef: text }),
]);
export const enemyShieldModelSchema = z.strictObject({
  mode: z.literal(ENEMY_SHIELD_HOST_MODE),
  eventTiming: z.literal("declared-before-frame-input-v1"),
  definitions: z.array(enemyShieldDefinitionInputSchema).min(1),
  events: z.array(enemyShieldPhaseInputSchema),
}).superRefine((model, ctx) => {
  const definitions = new Map<string, typeof model.definitions[number]>();
  model.definitions.forEach((definition, index) => {
    if (definitions.has(definition.id)) ctx.addIssue({ code: "custom", path: ["definitions", index, "id"], message: "敌盾定义身份不能重复。" });
    definitions.set(definition.id, definition);
  });
  const ids = new Set<string>();
  model.events.forEach((event, index) => {
    if (ids.has(event.id)) ctx.addIssue({ code: "custom", path: ["events", index, "id"], message: "真实阶段事件身份不能重复。" });
    ids.add(event.id);
    if (!definitions.has(event.definitionId)) ctx.addIssue({ code: "custom", path: ["events", index, "definitionId"], message: "阶段事件必须引用本场实际敌盾定义。" });
  });
});
export type EnemyShieldModel = z.infer<typeof enemyShieldModelSchema>;
export type EnemyShieldPhaseInput = z.infer<typeof enemyShieldPhaseInputSchema>;

export const enemyShieldStateSchema = z.strictObject({
  definitionId: text, targetId: text, generation: z.number().int().positive(), active: z.boolean(),
  gaugeUnits: amount, createdFrame: frame, removedFrame: frame.nullable(), phaseId: text,
});
export const enemyShieldHostStateSchema = z.strictObject({
  states: z.array(enemyShieldStateSchema), consumedPhaseInputIds: z.array(text),
});
const point = { frame, eventPriority: finite, eventSequence: frame, intraEventSequence: frame, sourceEventId: text };
const disposition = z.strictObject({ kind: z.enum(["unshielded", "shield-blocked", "armor-passthrough", "breaking-hit-resolved", "breaking-hit-unresolved"]), damage: amount.nullable() });
const reactionInput = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("none"), reason: z.enum(["icd-blocked", "no-elemental-application", "no-shield-reaction"]) }),
  z.strictObject({ kind: z.literal("standard-force-application"), element: z.enum(["physical", "pyro", "hydro", "electro", "cryo", "dendro", "anemo", "geo"]), gaugeUnitsReachingShield: amount, applicationEventId: text }),
  z.strictObject({ kind: z.literal("electro-charged-tick"), reactionEventId: text }),
  z.strictObject({ kind: z.literal("resolved-reaction"), reaction: text, gaugeUnitsReachingShield: amount, coefficient: amount, reactionEventId: text, sourceRefs: z.array(text).min(1) }),
]);
export const enemyShieldHitInputSchema = z.strictObject({
  ...point, targetId: text, damageEventId: frame.nullable(),
  damageElement: z.enum(["physical", "pyro", "hydro", "electro", "cryo", "dendro", "anemo", "geo"]),
  finalDamage: amount, damageWithoutAmplifyingReaction: amount, reaction: reactionInput,
  poise: z.strictObject({ attackType: z.enum(["none", "melee", "ranged"]), strikeType: z.enum(["none", "default", "slash", "pierce", "blunt", "spear"]), initialDamage: amount, sourceRef: text }),
  breakingHitTransfer: z.strictObject({ hpDamage: amount, sourceRef: text }).optional(),
});
/** Formula/input identities are re-executed by the host replay; opaque trace payload is never an authority. */
export const enemyShieldLogEntrySchema = z.strictObject({
  ...point, id: frame, kind: z.enum(["create", "replace", "hit", "remove"]),
  targetId: text, definitionId: text, damageEventId: frame.nullable(), before: enemyShieldStateSchema.nullable(), after: enemyShieldStateSchema,
  reactionCost: amount, damageCost: amount, poiseCost: amount, totalGaugeCost: amount, effectiveGaugeCost: amount, excessGaugeCost: amount,
  broken: z.boolean(), hpDisposition: disposition.nullable(), input: enemyShieldHitInputSchema.nullable(), sourceRefs: z.array(text), trace: z.array(z.unknown()),
});
export const enemyShieldHostLogEntrySchema = z.strictObject({
  ...point, id: frame, operation: z.enum(["phase", "direct-hit"]), inputEventId: text.nullable(),
  sourceActorId: text.nullable(), sourceActionId: text.nullable(), hitId: text.nullable(), damageEventId: frame.nullable(), hitResolutionLogId: frame.nullable(),
  elementalApplicationIcdLogId: frame.nullable(), applicationDecision: z.unknown().nullable(),
  outcome: z.enum(["created", "replaced", "removed", "already-inactive", "different-definition-active", "shield-damaged", "shield-broken"]),
  shield: enemyShieldLogEntrySchema.nullable(),
  unamplifiedDamageTrace: z.array(z.unknown()), sourceRefs: z.array(text),
});

export type EnemyShieldState = z.infer<typeof enemyShieldStateSchema>;
export type EnemyShieldHostState = z.infer<typeof enemyShieldHostStateSchema>;
export type EnemyShieldLogEntry = z.infer<typeof enemyShieldLogEntrySchema>;
export type EnemyShieldHostLogEntry = z.infer<typeof enemyShieldHostLogEntrySchema>;
