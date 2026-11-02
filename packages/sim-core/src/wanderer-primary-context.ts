import { z } from "zod";

export const wandererPrimaryContextSchema = z.strictObject({
  skillTalentLevel: z.number().int().min(1).max(15).optional(),
  /** Neither means no Pyro ATK / Cryo CR share; Hydro/Electro may still apply. */
  absorptionBonuses: z.enum(["neither", "pyro", "cryo", "pyro-cryo"]).optional(),
  baseAttack: z.number().finite().nonnegative().optional(),
  pyroAttackIncludedPercent: z.number().finite().min(0).max(30).optional(),
  cryoCritRateIncludedPercent: z.number().finite().min(0).max(20).optional(),
  c6ParentQualified: z.boolean().optional(),
  burstWindfavoredAtCast: z.boolean().optional(),
  /** 50 denotes the source cap, including any actual spent amount above50. */
  burstC2ConsumedPointsUpTo50: z.number().int().min(0).max(50).optional(),
  burstC2IncludedPercent: z.number().finite().min(0).max(200).optional(),
  burstAllHitsConnected: z.boolean().optional(),
  burstConditionsStable: z.boolean().optional(),
  finalizedHitStates: z.record(z.string(), z.string()).optional(),
});
export type WandererPrimaryContext = z.infer<typeof wandererPrimaryContextSchema>;
