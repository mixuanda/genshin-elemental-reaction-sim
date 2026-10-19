import { z } from "zod";
import { bondOfLifeEventAuditSchema } from "./bond-of-life-schema";

const finite = z.number().finite();
const nonnegative = finite.nonnegative();
const index = z.number().int().nonnegative();
const text = z.string().trim().min(1);

const definition = {
  id: text,
  label: text,
  frameOffset: index,
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("self") }).strict(),
    z.object({ kind: z.literal("active") }).strict(),
    z.object({ kind: z.literal("party") }).strict(),
    z.object({ kind: z.literal("actor"), actorId: text }).strict()
  ]),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("custom"), note: text }).strict(),
    z.object({ kind: z.literal("source"), refs: z.array(text).min(1) }).strict()
  ])
};

export const healthChangeDefinitionSchema = z.discriminatedUnion("operation", [
  z.object({
    ...definition,
    operation: z.literal("heal"),
    amount: z.object({ basis: z.enum(["fixed", "target-max-hp"]), value: nonnegative }).strict(),
    healingBonus: nonnegative,
    incomingHealingBonus: nonnegative
  }).strict(),
  z.object({
    ...definition,
    operation: z.literal("consume"),
    amount: z.object({ basis: z.enum(["fixed", "target-max-hp", "target-current-hp"]), value: nonnegative }).strict(),
    minimumHpRatio: finite.min(0).max(1)
  }).strict(),
  z.object({
    ...definition,
    operation: z.literal("bond-add"),
    amount: z.object({ basis: z.enum(["fixed", "target-max-hp"]), value: nonnegative }).strict()
  }).strict(),
  z.object({
    ...definition,
    operation: z.literal("bond-remove"),
    amount: z.object({ basis: z.enum(["fixed", "target-max-hp"]), value: nonnegative }).strict()
  }).strict()
]);

export const playerHealthEventSchema = z.object({
  id: index,
  frame: index,
  timeSeconds: nonnegative,
  eventPriority: nonnegative,
  eventSequence: index,
  intraEventSequence: index,
  actionLogIndex: index,
  sourceActorId: text,
  targetActorId: text,
  changeId: text,
  periodicEntityLogId: index.optional(),
  operation: z.enum(["heal", "consume", "bond-add", "bond-remove"]),
  bondOfLife: bondOfLifeEventAuditSchema.optional(),
  maxHp: finite.positive(),
  hpBefore: nonnegative,
  hpAfter: nonnegative,
  baseAmount: nonnegative,
  bonusMultiplier: nonnegative,
  requestedAmount: nonnegative,
  actualChange: nonnegative,
  overheal: nonnegative,
  minimumHp: nonnegative,
  trace: z.array(z.unknown()).min(1)
}).strict();
