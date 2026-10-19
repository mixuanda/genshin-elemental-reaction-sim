import { z } from "zod";
const text=z.string().trim().min(1),frame=z.number().int().nonnegative(),amount=z.number().finite().nonnegative();
export const neferPhantasmEventSchema=z.strictObject({candidateId:text,templateRole:z.enum(["nefer1","nefer2","shade1","shade2","shade3"]),frame,snapshotFrame:frame,snapshotId:text,targetId:text});
export const neferPhantasmHitStateSchema=z.strictObject({
  moonsignLevel:z.number().int().min(0).max(4).optional(),veilStacks:z.number().int().min(0).max(3).optional(),
  fullVeilEmBuffActive:z.boolean().optional(),includedFullVeilEm:amount.optional(),
  intrinsicEmMatchesSnapshot:z.boolean().optional(),actualIntrinsicEm:amount.optional(),
  specialBaseBonus:amount.optional(),includedIntrinsicBaseBonus:amount.max(.14).optional(),reactionBonus:amount.optional(),specialAdditive:amount.optional(),elevationMultiplier:amount.positive().optional(),
});
export const neferPhantasmCastBaseSchema=z.strictObject({
  casterId:text.optional(),targetId:text.optional(),phantasmOccurred:z.boolean().optional(),shadowDanceActiveAtAction:z.boolean().optional(),
  verdantDewBefore:z.number().int().min(0).max(3).optional(),phantasmsUsedBefore:z.number().int().min(0).max(3).optional(),firstShadeSummonFrame:frame.optional(),
  fullObservedLifetime:z.boolean().optional(),observedThroughFrame:frame.optional(),statsStableAcrossHits:z.boolean().optional(),
  observations:z.array(neferPhantasmEventSchema).max(5).optional(),independentEvent:neferPhantasmEventSchema.optional(),
  targetContacts:z.record(text,z.boolean()).optional(),sharedState:neferPhantasmHitStateSchema.optional(),hitStates:z.record(text,neferPhantasmHitStateSchema).optional(),finalizedHitEvents:z.record(text,text).optional(),
});
export type NeferPhantasmEvent=z.infer<typeof neferPhantasmEventSchema>;
export type NeferPhantasmScheduleContext=z.infer<typeof neferPhantasmCastBaseSchema>;
