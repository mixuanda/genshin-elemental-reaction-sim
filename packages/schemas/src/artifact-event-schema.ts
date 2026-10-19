import { z } from "zod";

const id = z.string().trim().min(1);
const frame = z.number().int().nonnegative();
const time = z.number().finite().nonnegative();
const mode = z.literal("fixed-source-no-character-hitlag-v1");
export const artifactEffectIdSchema = z.enum(["exile-4pc", "scholar-4pc", "gambler-4pc", "scroll-2pc"]);
export const artifactEventModelSchema = z.object({
  mode,
  actors: z.array(z.object({ actorId: id, effectId: artifactEffectIdSchema }).strict()).min(1).max(4),
  partyWeaponTypes: z.array(z.object({ actorId: id,
    weaponType: z.enum(["sword", "claymore", "polearm", "bow", "catalyst"])
  }).strict()).min(1).max(4).optional(),
}).strict();
export const nightsoulBurstModelSchema = z.object({ mode, natlanActorIds: z.array(id).min(1).max(4) }).strict();

export const artifactEventLogEntrySchema = z.object({
  id: frame, sourceProfileId: z.literal("gcsim-artifact-events-v1"), sourceRef: id,
  actorId: id, effectId: artifactEffectIdSchema,
  frame, timeSeconds: time, eventPriority: time, eventSequence: frame,
  kind: z.enum(["burst", "particle-received", "target-died", "nightsoul-burst", "exile-tick"]),
  sourceActionId: id.nullable(), actionLogIndex: frame.nullable(), particleEventId: frame.nullable(),
  targetHealthLogId: frame.nullable(), nightsoulBurstLogId: frame.nullable(), activeCharacterId: id.nullable(),
  outcome: z.enum(["activated", "off-field", "cooldown-blocked", "party-effect-active", "wrong-killer", "energy-granted", "skill-reset"]),
  cooldownExpiresFrameBefore: frame.nullable(), cooldownExpiresFrameAfter: frame.nullable(),
  exileRecipients: z.array(z.object({ actorId: id, expiresFrame: frame }).strict()),
  energyLogIds: z.array(frame), skillCooldownLogId: frame.nullable(),
  parentArtifactEventLogId: frame.nullable(), receiverId: id.nullable(), tickIndex: z.number().int().min(1).max(3).nullable(),
}).strict();
export const nightsoulBurstLogEntrySchema = z.object({
  id: frame, sourceProfileId: z.literal("gcsim-nightsoul-burst-v1"), sourceRef: id,
  frame, timeSeconds: time, eventPriority: time, eventSequence: frame,
  parentDamageEventId: frame, sourceActorId: id, targetId: id, activeCharacterId: id.nullable(),
  natlanActorIds: z.array(id).min(1).max(4), cooldownFrames: frame,
  cooldownExpiresFrameBefore: frame.nullable(), cooldownExpiresFrameAfter: frame.nullable(),
  outcome: z.enum(["triggered", "cooldown-blocked"]),
}).strict();
