import { z } from "zod";

const nonnegative = z.number().finite().nonnegative();
/** One fresh Q initial hit; absence is an unknown observation, never false/zero. */
export const faruzanBurstInitialContextSchema = z.strictObject({
  freshBurstNoPriorEffects: z.boolean().optional(),
  insideBurstArea: z.boolean().optional(),
  noOtherAnemoBeforeInitial: z.boolean().optional(),
  baseAttack: nonnegative.optional(),
  includedBurstDamageBonus: nonnegative.optional(),
  includedA4BaseDamage: nonnegative.optional(),
  includedResistanceReduction: nonnegative.optional(),
  c6CritDamageIncludedInPanel: z.boolean().optional(),
  finalizedHitState: z.string().min(1).optional(),
});
export type FaruzanBurstInitialContext = z.infer<typeof faruzanBurstInitialContextSchema>;
