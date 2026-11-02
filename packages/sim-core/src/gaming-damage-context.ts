import {z} from 'zod';
export const gamingDamageContextSchema=z.strictObject({
 hpPercent:z.number().finite().min(0).max(100).optional(),
 c2Active:z.boolean().optional(),
 c2Included:z.boolean().optional(),
 baseAttack:z.number().finite().nonnegative().optional(),
 a4Included:z.boolean().optional(),
 c6CritRateIncluded:z.boolean().optional(),
 c6CritDamageIncluded:z.boolean().optional(),
 finalizedHitStates:z.record(z.string(),z.string()).optional(),
});
export type GamingDamageContext=z.infer<typeof gamingDamageContextSchema>;
