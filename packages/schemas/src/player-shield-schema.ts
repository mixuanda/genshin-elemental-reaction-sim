import { z } from "zod";

const finite = z.number().finite();
const nonnegative = finite.nonnegative();
const index = z.number().int().nonnegative();
const duration = z.number().int().positive();
const text = z.string().trim().min(1);
const element = z.enum(["physical", "pyro", "hydro", "cryo", "electro", "anemo", "geo", "dendro"]);
const target = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("active") }).strict(),
  z.object({ kind: z.literal("actor"), actorId: text }).strict()
]);
const inputIdentity = { id: text, frame: index, source: z.object({ kind: z.literal("custom"), note: text }).strict() };

export const playerShieldInputEventSchema = z.discriminatedUnion("kind", [
  z.object({ ...inputIdentity, kind: z.literal("grant"), ownerId: text, typeKey: text, label: text,
    element, target, hp: z.object({ flat: nonnegative, stat: z.enum(["atk", "hp", "def", "em"]).optional(), coefficient: nonnegative.optional() }).strict(),
    durationFrames: duration }).strict(),
  z.object({ ...inputIdentity, kind: z.literal("bonus"), key: text, value: nonnegative,
    durationFrames: duration.nullable(), consumeOnRead: z.boolean() }).strict(),
  z.object({ ...inputIdentity, kind: z.literal("incoming-hit"), target, element, incomingDamage: nonnegative }).strict()
]).superRefine((event, context) => {
  if (event.kind !== "grant") return;
  if ((event.hp.stat === undefined) !== (event.hp.coefficient === undefined)) context.addIssue({
    code: "custom", path: ["hp"], message: "shield scaling stat and coefficient must be declared together"
  });
  if (event.hp.flat <= 0 && !(event.hp.stat !== undefined && (event.hp.coefficient ?? 0) > 0)) context.addIssue({
    code: "custom", path: ["hp"], message: "shield generation requires positive flat HP or a positive stat coefficient"
  });
});

export const playerShieldModelSchema = z.object({
  mode: z.literal("gcsim-b4ae769-template-v1"),
  events: z.array(playerShieldInputEventSchema)
}).strict().superRefine((model, context) => {
  const ids = new Set<string>();
  model.events.forEach((event, index) => {
    if (ids.has(event.id)) context.addIssue({ code: "custom", path: ["events", index, "id"], message: "shield input event IDs must be unique" });
    ids.add(event.id);
  });
});

export const playerShieldStateSchema = z.object({
  nextInstanceId: index,
  shields: z.array(z.object({ instanceId: index, definitionId: text, ownerId: text, typeKey: text, label: text,
    element, target, hp: finite.positive(), expiresAtFrame: index }).strict()),
  bonuses: z.array(z.object({ key: text, value: nonnegative, expiresAtFrame: index.nullable(), consumeOnRead: z.boolean() }).strict())
}).strict();

// These leaf snapshots are kept local to avoid a schema/result-schema cycle.
const ownerStats = z.object({
  baseAtk: finite, atkPct: finite, flatAtk: finite, baseHp: finite, hpPct: finite, flatHp: finite,
  baseDef: finite, defPct: finite, flatDef: finite, em: finite, critRate: finite, critDmg: finite,
  dmgBonus: finite, defIgnore: finite, reactionBonus: finite, energyRecharge: nonnegative,
  atkFlat: finite.optional(), hpFlat: finite.optional(), defFlat: finite.optional()
}).strict();
const hpResolution = z.object({
  zeroHpPolicy: z.literal("clamp-and-continue"), inputCurrentHp: nonnegative, currentHpBefore: nonnegative,
  currentHpAfter: nonnegative, maxHp: finite.positive(), attemptedLoss: nonnegative, actualLoss: nonnegative,
  overkill: nonnegative, hpRatioBefore: finite.min(0).max(1), hpRatioAfter: finite.min(0).max(1)
}).strict();

export const playerShieldLogEntrySchema = z.object({
  id: index, frame: index, timeSeconds: nonnegative, eventPriority: finite, eventSequence: index, intraEventSequence: index,
  operation: z.enum(["grant", "bonus", "incoming-hit", "reaction-hit", "expire"]),
  inputEventId: text.nullable(), inputEvent: playerShieldInputEventSchema.nullable(), ownerStats: ownerStats.nullable(),
  targetActorId: text.nullable(), activeCharacterId: text.nullable(), incomingDamage: nonnegative.nullable(), incomingElement: element.nullable(),
  crystallizeDamageAfter: nonnegative.nullable(), capacity: nonnegative.nullable(), strengthBonus: nonnegative.nullable(),
  absorbedDamage: nonnegative.nullable(), damageAfterShield: nonnegative.nullable(),
  shieldDetails: z.array(z.object({ instanceId: index, hpBefore: finite.positive(), absorptionMultiplier: finite.positive(),
    effectiveAbsorptionMultiplier: finite.positive(), capacity: finite.positive(), hpAfter: nonnegative,
    absorbedDamage: nonnegative, damageAfterShield: nonnegative, broken: z.boolean() }).strict()),
  callbacks: z.array(z.object({ kind: z.enum(["OnOverwrite", "OnShielded", "OnExpire", "OnShieldBreak"]),
    instanceId: index, reason: z.enum(["grant", "overwrite", "expire", "damage"]) }).strict()),
  stateBefore: playerShieldStateSchema, stateAfter: playerShieldStateSchema,
  playerDamageEventId: index.nullable(), hpResolution: hpResolution.optional()
}).strict();
