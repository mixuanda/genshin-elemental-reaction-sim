import { z } from "zod";
const frame=z.number().int().min(0).max(100000), amount=z.number().finite().nonnegative(), text=z.string().min(1);
export const mixedSourceHitStateSchema=z.strictObject({
  includedDamageBonus:amount.optional(), includedResistanceReduction:amount.optional(), laumaOwnShredActive:z.boolean().optional(),
  laumaBurstBuffInactive:z.boolean().optional(), odetteBurstBuffInactive:z.boolean().optional(),
  impactAtk:amount.optional(), impactEm:amount.optional(), nonExtraAtk:amount.optional(), includedFlinsA4Em:amount.max(160).optional(),
  includedLaumaA1CritRate:amount.max(.1).optional(), includedLaumaA1CritDamage:amount.max(.2).optional(),
  otherSpecialBaseBonus:amount.optional(), otherReactionBonus:amount.optional(), specialAdditive:amount.optional(), elevationMultiplier:amount.positive().optional(),
  polestarApplicationCount:z.number().int().min(0).max(12).optional(), odetteA1Stacks:z.number().int().min(0).max(4).optional(),
});
export const mixedSourceEventSchema=z.strictObject({candidateId:text,templateRole:text,frame,snapshotFrame:frame,snapshotId:text,targetId:text,
  dewConsumed:z.number().int().min(0).max(3).optional(),laumaOwnShredActive:z.boolean().optional(),odetteA1Stacks:z.number().int().min(0).max(4).optional(),
});

export const mixedSourceCastBaseSchema=z.strictObject({
  independentEvent:mixedSourceEventSchema.optional(),
  casterId:text.optional(),targetId:text.optional(),noHitlag:z.boolean().optional(),noInterruption:z.boolean().optional(),noReplacement:z.boolean().optional(),
  fullObservedLifetime:z.boolean().optional(),observedThroughFrame:frame.optional(),statsStableAcrossHits:z.boolean().optional(),targetContacts:z.record(z.string(),z.boolean()).optional(),
  moonsignLevel:z.number().int().nonnegative().optional(),
  lauma:z.strictObject({initialDew:z.number().int().min(1).max(3).optional(),dewHistoryComplete:z.boolean().optional(),dewEvents:z.array(z.strictObject({id:text,frame:frame.max(29),kind:z.enum(["gain","consume"]),amount:z.number().int().min(1).max(3)})).max(100).optional(),burstInactive:z.boolean().optional(),noPriorShred:z.boolean().optional(),initializationEm:amount.optional(),noOtherMoonSongRefresh:z.boolean().optional()}).optional(),
  flins:z.strictObject({symphonyInactive:z.boolean().optional()}).optional(),
  odette:z.strictObject({burstBuffInactive:z.boolean().optional(),danceDoubleRemainingFrames:frame.max(1262).optional(),recastWindowRemainingFrames:frame.max(394).optional(),specialSkillCooldownReady:z.boolean().optional(),remainsOnFieldThroughout:z.boolean().optional(),a1StacksAtStart:z.number().int().min(0).max(4).optional(),radianceHistoryComplete:z.boolean().optional(),priorStellarSwirlRemainingFrames:frame.max(480).optional(),stellarSwirlFrames:z.array(frame).max(1000).optional(),polestarIntervals:z.array(z.strictObject({id:text,startFrame:frame,endFrame:frame})).max(1000).optional()}).optional(),
  sharedState:mixedSourceHitStateSchema.optional(),hitStates:z.record(z.string(),mixedSourceHitStateSchema).optional(),finalizedHitEvents:z.record(z.string(),text).optional(),
});
export type MixedSourceScheduleContext=z.infer<typeof mixedSourceCastBaseSchema>;
