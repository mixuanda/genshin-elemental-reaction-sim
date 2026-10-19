import { z } from "zod";

const number = z.number().finite();
const index = number.int().nonnegative();
const text = z.string().trim().min(1);

export const conditionalHitGroupDefinitionSchema = z.object({
  id: text,
  kind: z.literal("owner-hp-at-action-v1"),
  comparison: z.literal("lte"),
  thresholdRatio: number.min(0).max(1),
  hitIds: z.array(text).min(1),
  sourceRefs: z.array(text).min(1)
}).strict();

export const actionConditionLogEntrySchema = z.object({
  id: index,
  actionLogIndex: index,
  actorId: text,
  actionId: text,
  groupId: text,
  frame: index,
  timeSeconds: number.nonnegative(),
  eventPriority: number.nonnegative(),
  eventSequence: index,
  ownerCurrentHp: number.nonnegative(),
  ownerMaxHp: number.positive(),
  thresholdRatio: number.min(0).max(1),
  selected: z.boolean(),
  hitIds: z.array(text).min(1),
  trace: z.array(z.unknown()).min(1)
}).strict();
