import { z } from "zod";
const text=z.string().trim().min(1),amount=z.number().finite().nonnegative(),frame=z.number().int().nonnegative();
export const observedSpecialComponentEventSchema=z.strictObject({candidateId:text,frame,snapshotFrame:frame,snapshotId:text,targetId:text});
export const observedSpecialComponentStateSchema=z.strictObject({
  intrinsicStatMatchesSnapshot:z.boolean().optional(),actualIntrinsicStat:amount.optional(),
  specialBaseBonus:amount.optional(),includedIntrinsicBaseBonus:amount.max(.14).optional(),reactionBonus:amount.optional(),specialAdditive:amount.optional(),elevationMultiplier:amount.positive().optional(),
  includedCharacterEm:amount.optional(),a4PreConversionStat:amount.optional(),
  moonsignLevel:z.number().int().min(0).max(4).optional(),lumiPresent:z.boolean().optional(),targetWithinLumiA1Range:z.boolean().optional(),includedResistanceReduction:amount.optional(),
  linneaA4AppliesToSelf:z.boolean().optional(),lumiForm:z.enum(["super-power","ultimate-power"]).optional(),nearbyMoondrift:z.boolean().optional(),
  actualRadiance:z.enum(["stellar-conduct","stellar-swirl"]).optional(),decodingMode:z.boolean().optional(),decodingPowerAtSkill:amount.max(100).optional(),refinedTacticsConsumed:z.number().int().min(0).max(10).optional(),
  polestarApplicationCount:z.number().int().min(0).max(12).optional(),
});
export const observedSpecialComponentBaseSchema=z.strictObject({
  casterId:text.optional(),targetId:text.optional(),actualComponentOccurred:z.boolean().optional(),independentEvent:observedSpecialComponentEventSchema.optional(),
  sharedState:observedSpecialComponentStateSchema.optional(),hitStates:z.record(text,observedSpecialComponentStateSchema).optional(),finalizedHitEvents:z.record(text,text).optional(),
});
