import { z } from "zod";

export const kazuhaAbsorbedElementSchema = z.enum(["pyro", "hydro", "electro", "cryo"]);
export type KazuhaAbsorbedElement = z.infer<typeof kazuhaAbsorbedElementSchema>;
const optionalBonus = z.number().finite().optional();

/** Conditions for this Q's direct damage, not an aura or rotation simulator. */
export const kazuhaBurstContextSchema = z.strictObject({
  absorptionElement: z.enum(["none", ...kazuhaAbsorbedElementSchema.options]).optional(),
  /** First successful source absorption check: 81 + 18*n, n = 0..16. */
  absorptionStartFrame: z.number().int().min(81).max(369)
    .refine(frame => (frame - 81) % 18 === 0, "首次吸收必须对应81+18×n帧的真实检查，n为0–16。")
    .optional(),
  allHitsConnected: z.boolean().optional(),
  statsStableAcrossSnapshots: z.boolean().optional(),
  /** A matching-element prior swirl's A4 is still active at the 81f snapshot. */
  priorA4Active: z.boolean().optional(),
  /** NonExtraStat(EM) at that actual prior swirl, never this Q's current EM. */
  priorSwirlNonExtraEm: z.number().finite().nonnegative().optional(),
  includedA4DamageBonus: z.number().finite().nonnegative().optional(),
  /** Final panel bonuses for later-generated absorbed hits; missing stays unknown. */
  elementDamageBonuses: z.strictObject({
    pyro: optionalBonus, hydro: optionalBonus, electro: optionalBonus, cryo: optionalBonus,
  }).optional(),
  /** Rebuilt from pinned source; exposed as an auditable schedule. */
  hitEvents: z.record(z.string(), z.strictObject({
    frame: z.number().int().nonnegative(), snapshotFrame: z.union([z.literal(81), z.literal(82)]),
    role: z.enum(["slash", "anemo-dot", "absorbed-dot"]),
    element: z.enum(["anemo", ...kazuhaAbsorbedElementSchema.options]),
    ownerId: z.literal("character:10000047"),
  })).optional(),
  finalizedHitStates: z.record(z.string(), z.string()).optional(),
});
export type KazuhaBurstContext = z.infer<typeof kazuhaBurstContextSchema>;
