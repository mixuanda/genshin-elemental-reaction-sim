import { z } from "zod";
import { sourceHostOriginSchema, type SourceHostOrigin } from "./source-host-action-origin";

const id = z.number().int().nonnegative();
const clock = z.number().finite();

export const sourceHostTaskQueueSchema = z.object({
  id, kind: z.enum(["core", "character", "enemy"]),
  actorIndex: id.optional(), targetKey: z.number().int().optional(), clock,
}).strict();

export const sourceHostTaskRecordSchema = z.object({
  id, parentTaskId: id.optional(), queueId: id,
  queuedFrame: z.number().int(), queuedClock: clock, dueClock: clock,
  runFrame: z.number().int().optional(), completedFrame: z.number().int().optional(),
  state: z.enum(["pending", "completed"]), origin: sourceHostOriginSchema,
  key: z.string().optional(),
}).strict();

/** Clocks are native queue-local clocks, never inferred global frame deadlines. */
export const sourceHostTaskLifecycleSchema = z.object({
  schemaVersion: z.literal(1), observationFrame: z.number().int(),
  queues: z.array(sourceHostTaskQueueSchema), tasks: z.array(sourceHostTaskRecordSchema),
}).strict().superRefine((lifecycle, context) => {
  const queues = new Set<number>();
  for (const [position, queue] of lifecycle.queues.entries()) {
    if (queues.has(queue.id)) context.addIssue({ code: "custom", path: ["queues", position, "id"], message: "Duplicate native task queue ID" });
    queues.add(queue.id);
    if (queue.kind === "character" && queue.actorIndex === undefined)
      context.addIssue({ code: "custom", path: ["queues", position, "actorIndex"], message: "Character task queue requires its actor" });
    if (queue.kind === "enemy" && queue.targetKey === undefined)
      context.addIssue({ code: "custom", path: ["queues", position, "targetKey"], message: "Enemy task queue requires its target" });
  }
  const tasks = new Set<number>();
  for (const [position, task] of lifecycle.tasks.entries()) {
    if (tasks.has(task.id)) context.addIssue({ code: "custom", path: ["tasks", position, "id"], message: "Duplicate native task ID" });
    tasks.add(task.id);
    if (!queues.has(task.queueId)) context.addIssue({ code: "custom", path: ["tasks", position, "queueId"], message: "Native task queue is missing" });
    if (task.state === "pending" && (task.runFrame !== undefined || task.completedFrame !== undefined))
      context.addIssue({ code: "custom", path: ["tasks", position, "state"], message: "Pending task cannot have run or completion frames" });
    if (task.state === "completed" && (task.runFrame === undefined || task.completedFrame === undefined))
      context.addIssue({ code: "custom", path: ["tasks", position, "state"], message: "Completed task requires run and completion frames" });
    if (task.queuedFrame > lifecycle.observationFrame ||
      (task.state === "completed" && task.runFrame !== undefined && task.completedFrame !== undefined &&
        (task.runFrame < task.queuedFrame || task.completedFrame < task.runFrame || task.completedFrame > lifecycle.observationFrame)))
      context.addIssue({ code: "custom", path: ["tasks", position], message: "Native task frames are out of order" });
  }
  lifecycle.tasks.forEach((task, position) => {
    if (task.parentTaskId !== undefined && (!tasks.has(task.parentTaskId) || task.parentTaskId === task.id))
      context.addIssue({ code: "custom", path: ["tasks", position, "parentTaskId"], message: "Native parent task is missing or self-referential" });
  });
});

export type SourceHostTaskLifecycle = z.infer<typeof sourceHostTaskLifecycleSchema>;
export type SourceHostTaskQueue = SourceHostTaskLifecycle["queues"][number];
export type SourceHostTaskRecord = SourceHostTaskLifecycle["tasks"][number];
export type SourceHostTaskAssociation = "creation" | "trigger" | "status-owner";

export function sourceHostTaskAssociationSequence(origin: SourceHostOrigin, association: SourceHostTaskAssociation): number | undefined {
  return association === "status-owner" ? origin.statusOwner?.creationActionSequence
    : association === "creation" ? origin.creationActionSequence : origin.triggerActionSequence;
}

/** Retain directly linked tasks and the real parent chain as context only. */
export function selectSourceHostTaskLifecycle(
  lifecycle: SourceHostTaskLifecycle, sequence: number, association: SourceHostTaskAssociation,
): SourceHostTaskLifecycle {
  const byId = new Map(lifecycle.tasks.map(task => [task.id, task]));
  const selected = new Set<number>();
  for (const task of lifecycle.tasks) {
    if (sourceHostTaskAssociationSequence(task.origin, association) !== sequence) continue;
    let parent: SourceHostTaskRecord | undefined = task;
    while (parent && !selected.has(parent.id)) {
      selected.add(parent.id);
      parent = parent.parentTaskId === undefined ? undefined : byId.get(parent.parentTaskId);
    }
  }
  const tasks = lifecycle.tasks.filter(task => selected.has(task.id));
  const queueIds = new Set(tasks.map(task => task.queueId));
  return {
    schemaVersion: 1, observationFrame: lifecycle.observationFrame,
    queues: lifecycle.queues.filter(queue => queueIds.has(queue.id)), tasks,
  };
}

export interface SourceHostTaskLifecycleSummary {
  recorded: boolean;
  observationFrame?: number;
  associatedTaskIds: number[];
  contextTaskIds: number[];
  pendingCount: number;
  completedCount: number;
  pending: Array<{
    taskId: number; queueId: number; queueKind: SourceHostTaskQueue["kind"];
    queueClock: number; dueClock: number; remainingLocalClock: number;
  }>;
}

export function summarizeSourceHostTaskLifecycle(
  lifecycle: SourceHostTaskLifecycle | undefined, sequence: number, association: SourceHostTaskAssociation,
): SourceHostTaskLifecycleSummary {
  if (!lifecycle) return { recorded: false, associatedTaskIds: [], contextTaskIds: [], pendingCount: 0, completedCount: 0, pending: [] };
  const queues = new Map(lifecycle.queues.map(queue => [queue.id, queue]));
  const associated = lifecycle.tasks.filter(task => sourceHostTaskAssociationSequence(task.origin, association) === sequence);
  return {
    recorded: true, observationFrame: lifecycle.observationFrame,
    associatedTaskIds: associated.map(task => task.id),
    contextTaskIds: lifecycle.tasks.filter(task => sourceHostTaskAssociationSequence(task.origin, association) !== sequence).map(task => task.id),
    pendingCount: associated.filter(task => task.state === "pending").length,
    completedCount: associated.filter(task => task.state === "completed").length,
    pending: associated.filter(task => task.state === "pending").map(task => {
      const queue = queues.get(task.queueId)!;
      return { taskId: task.id, queueId: task.queueId, queueKind: queue.kind,
        queueClock: queue.clock, dueClock: task.dueClock, remainingLocalClock: task.dueClock - queue.clock };
    }),
  };
}
