import { z } from "zod";
import burstEvidence from "../../game-data/sources/iansan-swift-resolved-casts/active-burst-evidence.json";
import constellationEvidence from "../../game-data/sources/iansan-swift-resolved-casts/constellation-evidence.json";

const amount = z.number().finite().nonnegative();
const burstInput = z.strictObject({
  effectiveBurstTalentLevel: z.number().int().min(1).max(15),
  nonExtraAttackAtUpdate: amount,
  nightsoulPointsAtUpdate: amount.max(54),
});
export type IansanBurstAttackFeedbackInput = z.infer<typeof burstInput>;

/** Pure value from one witnessed Q refresh. No actor/recipient inference,
 * constellation level increment, current-panel reconstruction or time advance. */
export function evaluateIansanBurstAttackFeedback(input: IansanBurstAttackFeedbackInput): {
  rate: number; cap: number; attackBonus: number;
} {
  const value = burstInput.parse(input), table = burstEvidence.formula;
  const index = value.effectiveBurstTalentLevel - 1;
  const rate = value.nightsoulPointsAtUpdate >= table.highThreshold
    ? table.highAttackConversionByLevel[index]!
    : table.lowAttackConversionPerPointByLevel[index]! * value.nightsoulPointsAtUpdate;
  const cap = table.maxAttackBonusByLevel[index]!;
  return { rate, cap, attackBonus: Math.min(value.nonExtraAttackAtUpdate * rate, cap) };
}

const c6Input = z.strictObject({
  constellation: z.number().int().min(0).max(6),
  active: z.boolean(),
  includedDamageBonus: amount.max(constellationEvidence.facts.c6.damageBonus),
});
export type IansanC6DamageBonusInput = z.infer<typeof c6Input>;

/** `active` is the actual received modifier at this damage event. It is not
 * inferred from current Nightsoul points, Q state or the active character now. */
export function evaluateIansanC6DamageBonus(input: IansanC6DamageBonusInput): {
  actualBonus: number; delta: number;
} {
  const value = c6Input.parse(input);
  if (value.active && value.constellation < 6) throw new Error("伊安珊未解锁C6，不能声明极限发力有效。");
  const actualBonus = value.active ? constellationEvidence.facts.c6.damageBonus : 0;
  return { actualBonus, delta: actualBonus - value.includedDamageBonus };
}
