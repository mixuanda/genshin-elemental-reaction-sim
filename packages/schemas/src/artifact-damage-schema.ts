import { z } from "zod";

export const ARTIFACT_DAMAGE_PROFILE_ID = "gcsim-b4ae769-artifact-damage-v1" as const;
const sourceRoot = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/artifacts";
export const ARTIFACT_DAMAGE_SOURCE_REFS = {
  "echoes-4pc": `${sourceRoot}/echoes/echoes.go`,
  "song-of-days-past-4pc": `${sourceRoot}/songofdayspast/songofdayspast.go`
} as const;
const id = z.string().trim().min(1);
const integer = z.number().int().nonnegative();
const amount = z.number().finite().nonnegative();
const effectId = z.enum(["echoes-4pc", "song-of-days-past-4pc"]);

export const artifactDamageModelSchema = z.object({
  mode: z.literal(ARTIFACT_DAMAGE_PROFILE_ID),
  actors: z.array(z.object({ actorId: id, effectId }).strict()).min(1).max(4)
}).strict();

export const artifactDamageStateSchema = z.object({
  echoes: z.array(z.object({ actorId: id, probability: amount, cooldownExpiresFrame: integer, riteExpiresFrame: integer }).strict()).max(4),
  song: z.object({ healingPool: amount.max(15000), yearningExpiresFrame: integer,
    waveHealing: amount.max(15000), wavesExpiresFrame: integer, charges: integer.max(5) }).strict()
}).strict();

export const artifactDamageRandomStateSchema = z.object({
  algorithm: z.literal("fnv1a32-mulberry32-v1"),
  state: integer.max(0xffffffff), accumulator: z.number().finite().int(), drawCount: integer.safe()
}).strict().superRefine((random, context) => {
  if ((random.accumulator >>> 0) !== random.state) context.addIssue({ code: "custom", path: ["state"], message: "must equal the unsigned state of the captured accumulator" });
});

export const artifactDamageCapturedStateSchema = z.object({
  state: artifactDamageStateSchema,
  random: artifactDamageRandomStateSchema.optional()
}).strict();

export const artifactDamageLogEntrySchema = z.object({
  id: integer, sourceProfileId: z.literal(ARTIFACT_DAMAGE_PROFILE_ID), sourceRef: id,
  effectId, actorId: id, frame: integer, timeSeconds: amount,
  eventPriority: amount, eventSequence: integer, intraEventSequence: integer,
  kind: z.enum(["enemy-hit", "heal", "song-convert"]),
  parentDamageEventId: integer.nullable(), hitResolutionLogId: integer.nullable(),
  playerHealthEventId: integer.nullable(), parentLogId: integer.nullable(),
  sourceActorId: id, targetId: id.nullable(), activeCharacterId: id.nullable(),
  attackTag: id.nullable(), currentAttack: z.number().finite().nullable(), requestedHealing: amount.nullable(),
  random: z.object({ drawIndex: integer, roll: amount.lt(1), probability: amount }).strict().nullable(),
  flatDamage: z.number().finite(), stateBefore: artifactDamageStateSchema, stateAfter: artifactDamageStateSchema,
  outcome: z.enum(["off-field", "wrong-owner", "ineligible-tag", "rite-active", "cooldown-blocked", "roll-failed", "rite-triggered",
    "recorded-healing", "waves-created", "waves-inactive", "waves-consumed"])
}).strict();

export type ArtifactDamageModel = z.infer<typeof artifactDamageModelSchema>;
export type ArtifactDamageEffectId = ArtifactDamageModel["actors"][number]["effectId"];
export type ArtifactDamageState = z.infer<typeof artifactDamageStateSchema>;
export type ArtifactDamageCapturedState = z.infer<typeof artifactDamageCapturedStateSchema>;
export type ArtifactDamageLogEntry = z.infer<typeof artifactDamageLogEntrySchema>;
