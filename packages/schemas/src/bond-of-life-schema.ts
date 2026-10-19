import { z } from "zod";

export const bondOfLifeProfileId = "gcsim-b4ae769-same-heal-remainder-v1" as const;

export const bondOfLifeModelSchema = z.object({
  mode: z.literal(bondOfLifeProfileId),
  characters: z.array(z.object({
    actorId: z.string().trim().min(1),
    initialRatio: z.number().finite().min(0).max(2)
  }).strict()).min(1).max(4)
}).strict();

export const bondOfLifeEventAuditSchema = z.object({
  profileId: z.literal(bondOfLifeProfileId),
  debtBefore: z.number().finite().nonnegative(),
  debtAfter: z.number().finite().nonnegative(),
  absorbedHealing: z.number().finite().nonnegative(),
  healingAfterDebt: z.number().finite().nonnegative(),
  requestedDebtDelta: z.number().finite(),
  actualDebtDelta: z.number().finite(),
  sourceEventEmitted: z.boolean(),
  sourceCallbackAmount: z.number().finite()
}).strict();
