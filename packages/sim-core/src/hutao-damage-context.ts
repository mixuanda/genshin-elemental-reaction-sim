import { z } from 'zod';

export const hutaoDamageContextSchema = z.strictObject({
  paramitaActive: z.boolean().optional(),
  skillTalentLevel: z.number().int().min(1).max(15).optional(),
  skillAttackIncludedInPanel: z.boolean().optional(),
  maxHpUnchangedSinceSkillCast: z.boolean().optional(),
  skillCastMaxHp: z.number().finite().positive().optional(),
  baseAttack: z.number().finite().nonnegative().optional(),
  hpPercentAtSnapshot: z.number().finite().min(0).max(100).optional(),
  a4ThresholdStable: z.boolean().optional(),
  a4IncludedInDamageBonus: z.boolean().optional(),
  finalizedHitStates: z.record(z.string(), z.string()).optional(),
});
export type HutaoDamageContext = z.infer<typeof hutaoDamageContextSchema>;
