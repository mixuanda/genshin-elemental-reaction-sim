import { z } from "zod";
const nonnegative = z.number().finite().nonnegative();
export const nicoleSkillInitialContextSchema = z.strictObject({
  noOtherEventsBeforeInitial: z.boolean().optional(),
  noDisplacementBeforeInitial: z.boolean().optional(),
  skillGrantNonExtraAttack: nonnegative.optional(),
  grantAttackSource: z.enum(["equipment-current", "observed"]).optional(),
  includedSkillAttack: nonnegative.optional(),
  c2AttackIncludedInPanel: z.boolean().optional(),
  a1AttackIncludedInPanel: z.boolean().optional(),
  includedC2ResistanceReduction: nonnegative.optional(),
  /** Optional observation consistency check; an undisplaced 5m E hit already
   * proves contact with the concentric10m C2 field, without asking the player. */
  targetInC2AreaAtInitial: z.boolean().optional(),
  finalizedHitState: z.string().min(1).optional(),
});
export type NicoleSkillInitialContext = z.infer<typeof nicoleSkillInitialContextSchema>;
