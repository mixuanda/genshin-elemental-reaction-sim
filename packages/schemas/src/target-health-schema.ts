import { z } from "zod";

const id = z.string().trim().min(1);
const frame = z.number().int().nonnegative();
const amount = z.number().finite().nonnegative();
const drop = z.object({
  id, element: z.enum(["pyro", "hydro", "electro", "cryo", "anemo", "geo", "dendro", "neutral"]),
  kind: z.enum(["particle", "orb"]), count: z.number().int().positive(), travelFrames: frame, sourceRef: id
}).strict();
export const targetParticleDropDefinitionSchema = drop.extend({
  trigger: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("hp-threshold"), hpRatio: z.number().finite().gt(0).lt(1) }).strict(),
    z.object({ kind: z.literal("defeat") }).strict()
  ])
});
export const externalParticleDropDefinitionSchema = drop.extend({ frame });
export const targetHealthDefinitionSchema = z.object({
  targetId: id, maxHp: z.number().finite().positive(), initialHp: amount, sourceRef: id,
  drops: z.array(targetParticleDropDefinitionSchema)
}).strict().superRefine((value, context) => {
  if (value.initialHp > value.maxHp) context.addIssue({ code: "custom", path: ["initialHp"], message: "initialHp cannot exceed maxHp" });
});
export const targetHealthModelSchema = z.object({
  mode: z.literal("declared-target-health-v1"), targets: z.array(targetHealthDefinitionSchema),
  externalDrops: z.array(externalParticleDropDefinitionSchema)
}).strict().superRefine((model, context) => {
  if (model.targets.length + model.externalDrops.length === 0) context.addIssue({ code: "custom", message: "declare at least one target HP state or external drop" });
  const targets = new Set<string>(), drops = new Set<string>();
  const checkDrop = (dropId: string, path: (string | number)[]) => {
    if (drops.has(dropId)) context.addIssue({ code: "custom", path, message: "declared drop IDs must be globally unique" });
    drops.add(dropId);
  };
  model.targets.forEach((target, index) => {
    if (targets.has(target.targetId)) context.addIssue({ code: "custom", path: ["targets", index, "targetId"], message: "target HP IDs must be unique" });
    targets.add(target.targetId);
    target.drops.forEach((entry, dropIndex) => checkDrop(entry.id, ["targets", index, "drops", dropIndex, "id"]));
  });
  model.externalDrops.forEach((entry, index) => checkDrop(entry.id, ["externalDrops", index, "id"]));
});
export const declaredParticleOriginSchema = z.object({
  kind: z.enum(["enemy-hp-threshold", "enemy-defeat", "external"]), dropId: id,
  targetId: id.nullable(), targetHealthLogId: frame.nullable(), damageEventId: frame.nullable(), sourceRef: id
}).strict();
export const targetHealthLogEntrySchema = z.object({
  id: frame, targetId: id, damageEventId: frame, frame, timeSeconds: amount,
  eventPriority: amount, eventSequence: frame, maxHp: z.number().finite().positive(),
  hpBefore: amount, hpAfter: amount, rawDamage: amount, effectiveHpDamage: amount, overkill: amount,
  defeated: z.boolean(), triggeredDropIds: z.array(id), sourceRef: id, trace: z.array(z.unknown())
}).strict();
export const targetHealthSummarySchema = z.object({
  targetId: id, maxHp: z.number().finite().positive(), initialHp: amount, finalHp: amount,
  totalRawDamage: amount, totalEffectiveHpDamage: amount, totalOverkill: amount, defeatedFrame: frame.nullable()
}).strict();
