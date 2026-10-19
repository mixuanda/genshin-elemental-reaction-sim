import { z } from "zod";

export const playerMaxHpProfileId = "gcsim-b4ae769-ratio-preserving-v1" as const;
export const playerMaxHpModelSchema = z.object({ mode: z.literal(playerMaxHpProfileId) }).strict();
const finite = z.number().finite();
const index = z.number().int().nonnegative();
export const playerMaxHpEventSchema = z.object({
  id: index, frame: index, timeSeconds: finite.nonnegative(),
  eventPriority: finite.min(-1), eventSequence: index, intraEventSequence: index,
  actorId: z.string().trim().min(1), cause: z.enum(["buff-apply", "buff-expire"]),
  maxHpBefore: finite.positive(), maxHpAfter: finite.positive(),
  statsAfter: z.object({ baseHp: finite.positive(), hpPct: finite, flatHp: finite }).strict(),
  hpBefore: finite.nonnegative(), hpAfter: finite.nonnegative(),
  hpRatioBefore: finite.min(0).max(1), hpRatioAfter: finite.min(0).max(1),
  hpAdjustment: finite,
  bondOfLifeBefore: finite.nonnegative().optional(), bondOfLifeAfter: finite.nonnegative().optional(),
  trace: z.array(z.unknown()).min(1),
}).strict();
