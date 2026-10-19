import { z } from "zod";
import { ARTIFACT_BUFF_EFFECT_IDS, ARTIFACT_BUFF_REACTIONS, ARTIFACT_BUFF_PROFILE_ID, ARTIFACT_BUFF_SOURCE } from "@genshin-dps-lab/reaction-formulas";
export { ARTIFACT_BUFF_EFFECT_IDS, ARTIFACT_BUFF_PROFILE_ID, ARTIFACT_BUFF_SOURCE } from "@genshin-dps-lab/reaction-formulas";
export type { ArtifactBuffActor, ArtifactBuffModel, ArtifactBuffEffectId, ArtifactBuffState, ArtifactBuffCapturedState, ArtifactBuffDecision, ArtifactBuffEvent, ArtifactBuffApplication, ArtifactBuffDelayedApplication } from "@genshin-dps-lab/reaction-formulas";

const id = z.string().trim().min(1);
const frame = z.number().int().nonnegative();
const number = z.number().finite();
const effectId = z.enum(ARTIFACT_BUFF_EFFECT_IDS);
const actor = z.object({ actorId: id, effectId, noblesseSelfDelayFrames: z.union([z.literal(0), z.literal(1)]).optional() }).strict();

export const artifactBuffModelSchema = z.object({
  mode: z.literal(ARTIFACT_BUFF_SOURCE.mode), actors: z.array(actor).min(1).max(4),
}).strict().superRefine((model, context) => {
  const holders = new Set<string>();
  model.actors.forEach((entry, index) => {
    if (holders.has(entry.actorId)) context.addIssue({ code: "custom", path: ["actors", index, "actorId"], message: "each actor can equip only one modeled four-piece artifact set" });
    holders.add(entry.actorId);
    if ((entry.effectId === "noblesse-4pc") !== (entry.noblesseSelfDelayFrames !== undefined)) context.addIssue({
      code: "custom", path: ["actors", index, "noblesseSelfDelayFrames"], message: "Noblesse requires an explicit source self-snapshot delay of 0 or 1; other sets must omit it",
    });
  });
  if (model.actors.filter(entry => entry.effectId === "vermillion-4pc").length > 1) context.addIssue({
    code: "custom", path: ["actors"], message: "multiple Vermillion holders are outside this profile: the fixed source uses colliding subscription keys",
  });
});

export const artifactBuffStateSchema = z.object({
  stacks: frame.max(4), effectExpiresFrame: frame.nullable(), cooldownExpiresFrame: frame.nullable(),
}).strict();
export const artifactBuffCapturedStateSchema = z.object({ actors: z.array(actor.extend({
  state: artifactBuffStateSchema, sameElementCount: frame.max(3), differentElementCount: frame.max(3),
})).max(4) }).strict();
export const artifactBuffDelayedApplicationSchema = z.object({
  actorId: id, effectId: z.literal("noblesse-4pc"), receiverId: id, applyFrame: frame, sourceFrame: frame,
}).strict();
export const artifactBuffEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("burst"), frame, sourceActorId: id, activeCharacterId: id.nullable() }).strict(),
  z.object({ kind: z.literal("reaction"), frame, sourceActorId: id, activeCharacterId: id.nullable(), reaction: z.enum(ARTIFACT_BUFF_REACTIONS), targetIsEnemy: z.boolean() }).strict(),
  z.object({ kind: z.literal("bond-of-life-change"), frame, actorId: id, amount: number }).strict(),
  z.object({ kind: z.literal("hp-drain"), frame, amount: number }).strict(),
  z.object({ kind: z.literal("swap"), frame, previousActorId: id.nullable(), nextActorId: id }).strict(),
  z.object({ kind: z.literal("stats-sample"), frame, actorId: id }).strict(),
  z.object({ kind: z.literal("react-bonus-read"), frame, actorId: id, reaction: id }).strict(),
  z.object({ kind: z.literal("delayed-buff"), frame, task: artifactBuffDelayedApplicationSchema }).strict(),
]);
export const artifactBuffApplicationSchema = z.object({
  receiverId: id, sourceActorId: id, key: id, stat: z.enum(["atkPct", "em", "dmgBonus"]),
  operation: z.enum(["replace", "update"]), value: number, startFrame: frame, expiresFrame: frame,
}).strict();
export const artifactBuffLogEntrySchema = z.object({
  id: frame, sourceProfileId: z.literal(ARTIFACT_BUFF_PROFILE_ID), sourceRef: id, actorId: id, effectId,
  event: artifactBuffEventSchema, outcome: z.enum(["applied", "scheduled", "stack-gained", "window-removed", "expired-on-read", "off-field", "wrong-owner", "zero-change", "cooldown-blocked", "window-inactive", "max-stacks", "target-not-enemy"]),
  stateBefore: artifactBuffStateSchema, stateAfter: artifactBuffStateSchema,
  sameElementCount: frame.max(3), differentElementCount: frame.max(3),
  applications: z.array(artifactBuffApplicationSchema),
  removals: z.array(z.object({ receiverId: id, key: id }).strict()),
  delayedApplications: z.array(artifactBuffDelayedApplicationSchema),
  frame, timeSeconds: number.nonnegative(), eventPriority: number, eventSequence: frame, intraEventSequence: frame,
  actionLogIndex: frame.nullable(), parentDamageEventId: frame.nullable(), playerHealthEventId: frame.nullable(),
  reactionTaskLogId: frame.nullable(), parentArtifactBuffLogId: frame.nullable(),
  trace: z.array(z.unknown()),
}).strict().superRefine((entry, context) => {
  if (entry.frame !== entry.event.frame) context.addIssue({ code: "custom", path: ["event", "frame"], message: "artifact event and queue tuple must identify the same actual frame" });
  if (entry.sourceRef !== ARTIFACT_BUFF_SOURCE.sourceRefs[entry.effectId]) context.addIssue({ code: "custom", path: ["sourceRef"], message: "artifact source must match its fixed effect" });
});
export type ArtifactBuffLogEntry = z.infer<typeof artifactBuffLogEntrySchema>;

/** Shared current-config gate; numeric input stats are never silently stripped. */
export function artifactBuffConfigurationIssues(model: z.infer<typeof artifactBuffModelSchema>, context: {
  characterIds: readonly string[]; hasLegalTimeline: boolean; hasOrdinaryAura: boolean;
  hasBondOfLife: boolean; hasPlayerHealth: boolean; otherArtifactHolderIds: readonly string[];
  manuallyDeclaredBuffKeys: readonly string[];
}): string[] {
  const issues: string[] = [];
  if (!context.hasLegalTimeline) issues.push("artifact buff lifecycles require an explicit legal frame timeline");
  const keys = new Set<string>(Object.values(ARTIFACT_BUFF_SOURCE).flatMap(value => typeof value === "object" && value !== null && "key" in value ? [value.key] : []));
  if (context.manuallyDeclaredBuffKeys.some(key => keys.has(key))) issues.push("source-owned artifact buff keys cannot also be declared as manual timeline buffs");
  for (const entry of model.actors) {
    if (!context.characterIds.includes(entry.actorId)) issues.push(`${entry.actorId}: artifact holder is not a configured character`);
    if (context.otherArtifactHolderIds.includes(entry.actorId)) issues.push(`${entry.actorId}: this four-piece set cannot be equipped with another modeled artifact set`);
    if (["instructor-4pc", "gilded-4pc", "paradise-4pc"].includes(entry.effectId) && !context.hasOrdinaryAura) issues.push(`${entry.actorId}: ${entry.effectId} requires actual ordinary reaction events`);
    if (entry.effectId === "fragment-4pc" && !context.hasBondOfLife) issues.push(`${entry.actorId}: Fragment requires an explicit Bond of Life ledger`);
    if (entry.effectId === "vermillion-4pc" && !context.hasPlayerHealth) issues.push(`${entry.actorId}: Vermillion requires an explicit player health ledger`);
  }
  return issues;
}
