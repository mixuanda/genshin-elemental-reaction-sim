import { z } from "zod";

const id = z.string().trim().min(1);
const frame = z.number().int().min(0);
const heat = z.number().min(0).max(100);
export const sandroneObservedEventSchema = z.strictObject({
  id, frame,
  kind: z.enum(["window-start", "window-end", "window-cancel", "observe-heat", "observe-mode", "observe-radiance", "hit"]),
  heat: heat.optional(),
  mode: z.enum(["inactive", "decoding", "overdrive"]).optional(),
  radiance: z.enum(["none", "stellar-conduct", "stellar-swirl"]).optional(),
  hitKind: z.enum(["sweep", "beam", "overdrive", "prism-1", "prism-2", "ray"]).optional(),
  targetId: z.string().trim().min(1).optional(),
  snapshotFrame: frame.optional(), snapshotId: id.optional(),
  contact: z.boolean().optional(),
}).superRefine((event, context) => {
  if (event.kind === "observe-heat" && event.heat === undefined) context.addIssue({ code: "custom", message: "Heat observation needs an actual value." });
  if (event.kind === "observe-mode" && event.mode === undefined) context.addIssue({ code: "custom", message: "Mode observation needs an actual mode." });
  if (event.kind === "observe-radiance" && event.radiance === undefined) context.addIssue({ code: "custom", message: "Radiance observation needs an actual state." });
  if (event.kind === "hit" && (!event.hitKind || !event.targetId || event.contact === undefined))
    context.addIssue({ code: "custom", message: "Attack opportunity needs kind, target and explicit contact." });
  if (event.kind === "hit" && event.contact === true && (event.snapshotFrame === undefined || !event.snapshotId))
    context.addIssue({ code: "custom", message: "Actual contact needs its attack snapshot." });
  if (event.snapshotFrame !== undefined && event.snapshotFrame > event.frame) context.addIssue({ code: "custom", message: "Snapshot cannot follow hit delivery." });
});

export const sandroneObservedLifecycleSchema = z.strictObject({
  initialHeat: heat.optional(),
  initialMode: z.enum(["inactive", "decoding", "overdrive"]).optional(),
  initialRadiance: z.enum(["none", "stellar-conduct", "stellar-swirl"]).optional(),
  /** Same-frame array order is the user's observed order; no frame interval is generated. */
  events: z.array(sandroneObservedEventSchema).default([]),
  hitBindings: z.record(z.string(), id).optional(),
  /** All relevant events up to the selected hit are recorded; never certifies a full charged cycle. */
  completeObservation: z.boolean().optional(),
});

export type SandroneObservedLifecycle = z.infer<typeof sandroneObservedLifecycleSchema>;
export type SandroneObservedEvent = z.infer<typeof sandroneObservedEventSchema>;
