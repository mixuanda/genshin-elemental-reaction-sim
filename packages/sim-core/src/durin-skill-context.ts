import { z } from "zod";

export const durinSkillHitStateSchema = z.strictObject({
  /** Actual C2 Pyro bonus at this hit's snapshot, not merely a reaction selection. */
  c2PyroBonusActive: z.boolean().optional(),
  /** Whether this hit's damage-bonus input already includes that same 50% share. */
  c2PyroBonusIncluded: z.boolean().optional(),
});

export const durinSkillContextSchema = z.strictObject({
  statsStableAcrossHits: z.boolean().optional(),
  hitStates: z.record(z.string().min(1), durinSkillHitStateSchema).optional(),
});

export type DurinSkillContext = z.infer<typeof durinSkillContextSchema>;
