import { z } from "zod";

const number = z.number().finite();
const frame = number.int().nonnegative();
const text = z.string().trim().min(1);

export const periodicEntityDefinitionSchema = z.object({
  kind: z.literal("periodic-active-heal-v1"),
  id: text,
  label: text,
  spawnFrame: frame,
  durationFrames: frame.positive(),
  firstTickDelayFrames: frame,
  intervalFrames: frame.positive(),
  hitDelayFrames: frame,
  hitIds: z.array(text).min(1),
  healing: z.object({
    ownerHpCoefficient: number.nonnegative(),
    flat: number.nonnegative(),
    ownerEmCoefficient: number.nonnegative(),
    healingBonus: number.nonnegative(),
    incomingHealingBonus: number.nonnegative(),
    lowHpBonus: z.object({ thresholdRatio: number.min(0).max(1), bonus: number.nonnegative() }).strict().optional()
  }).strict(),
  sourceRefs: z.array(text).min(1)
}).strict();

export const periodicEntityLogEntrySchema = z.object({
  id: frame,
  operation: z.enum(["spawn", "replace", "tick", "expire", "cancelled-tick"]),
  instanceId: text,
  definitionId: text,
  actorId: text,
  actionLogIndex: frame,
  frame,
  timeSeconds: number.nonnegative(),
  eventPriority: number.nonnegative(),
  eventSequence: frame,
  generation: frame,
  spawnFrame: frame,
  expiresAtFrame: frame,
  tickIndex: frame.optional(),
  replacedInstanceId: text.optional(),
  healthEventId: frame.optional(),
  healing: z.object({
    ownerMaxHp: number.positive(),
    ownerCurrentHp: number.nonnegative(),
    ownerEm: number.nonnegative(),
    baseHealing: number.nonnegative(),
    healingBonus: number.nonnegative(),
    incomingHealingBonus: number.nonnegative(),
    trace: z.array(z.unknown()).min(1)
  }).strict().optional()
}).strict();
