import type { ActionLogEntry, PeriodicEntityDefinition, SimulationResult } from "./types";
import { actionOwner, actionEventPriority, actionChildEventPriority } from "./action-condition-integrity";

export interface ReplayedPeriodicEntityRow {
  operation: "spawn" | "replace" | "tick" | "expire" | "cancelled-tick";
  instanceId: string;
  definition: PeriodicEntityDefinition;
  action: ActionLogEntry;
  actionLogIndex: number;
  frame: number;
  eventPriority: number;
  /** Relative FIFO order among replayed queued actions/entity events. */
  order: number;
  generation: number;
  spawnFrame: number;
  expiresAtFrame: number;
  tickIndex?: number;
  replacedInstanceId?: string;
}

/** Replays lifecycle from configured definitions and accepted actions, never output logs. */
export function replayPeriodicEntities(result: Pick<SimulationResult, "config" | "actionLog">): ReplayedPeriodicEntityRow[] {
  if (![...result.config.rotation, ...(result.config.timeline?.abilities ?? [])].some(owner => owner.periodicEntities?.length)) return [];
  const endFrame = Math.round(result.config.duration * 60);
  type Instance = Omit<ReplayedPeriodicEntityRow, "operation" | "frame" | "eventPriority" | "order" | "tickIndex" | "replacedInstanceId">;
  type Event = { frame: number; priority: number; order: number } & (
    | { kind: "action"; actionLogIndex: number }
    | { kind: "spawn"; actionLogIndex: number; definition: PeriodicEntityDefinition }
    | { kind: "tick"; instance: Instance; tickIndex: number }
  );
  const compare = (a: Event, b: Event) => a.frame - b.frame || a.priority - b.priority || a.order - b.order;
  const queue: Event[] = result.actionLog.map<Event>((action, actionLogIndex) => ({
    kind: "action", actionLogIndex, frame: action.frame, priority: actionEventPriority(actionOwner(result.config, action)), order: actionLogIndex
  })).sort(compare);
  let sequence = queue.length;
  const push = (event: Event): void => {
    if (event.frame > endFrame) return;
    let low = 0; let high = queue.length;
    while (low < high) { const middle = (low + high) >>> 1; if (compare(queue[middle]!, event) <= 0) low = middle + 1; else high = middle; }
    queue.splice(low, 0, event);
  };
  const generations = new Map<string, number>();
  const active = new Map<string, Instance>();
  const rows: ReplayedPeriodicEntityRow[] = [];
  while (queue.length > 0) {
    const event = queue.shift()!;
    if (event.kind === "action") {
      const action = result.actionLog[event.actionLogIndex]!;
      const owner = action.sourceAbilityId === undefined
        ? result.config.rotation.find(candidate => candidate.id === action.actionId && candidate.actorId === action.actorId)
        : result.config.timeline?.abilities.find(candidate => candidate.id === action.sourceAbilityId && candidate.actorId === action.actorId);
      for (const definition of owner?.periodicEntities ?? []) push({ kind: "spawn", actionLogIndex: event.actionLogIndex,
        definition, frame: action.frame + definition.spawnFrame, priority: actionChildEventPriority(owner, definition.spawnFrame, 2), order: sequence++ });
      continue;
    }
    if (event.kind === "spawn") {
      const action = result.actionLog[event.actionLogIndex]!;
      const key = `${action.actorId}\u0000${event.definition.id}`;
      const previous = active.get(key);
      const generation = (generations.get(key) ?? -1) + 1;
      generations.set(key, generation);
      const instance: Instance = { instanceId: `${action.actorId}:${event.definition.id}:${generation}`,
        definition: event.definition, action, actionLogIndex: event.actionLogIndex, generation,
        spawnFrame: event.frame, expiresAtFrame: event.frame + event.definition.durationFrames };
      active.set(key, instance);
      rows.push({ ...instance, operation: previous === undefined ? "spawn" : "replace", frame: event.frame, eventPriority: event.priority, order: event.order,
        ...(previous === undefined ? {} : { replacedInstanceId: previous.instanceId }) });
      push({ kind: "tick", instance, tickIndex: 0, frame: event.frame + event.definition.firstTickDelayFrames, priority: event.priority >= 10 && event.definition.firstTickDelayFrames === 0 ? 12 : 2, order: sequence++ });
      continue;
    }
    const instance = event.instance;
    const key = `${instance.action.actorId}\u0000${instance.definition.id}`;
    const row = { ...instance, frame: event.frame, eventPriority: event.priority, order: event.order, tickIndex: event.tickIndex };
    if (active.get(key)?.instanceId !== instance.instanceId) {
      rows.push({ ...row, operation: "cancelled-tick" });
      continue;
    }
    rows.push({ ...row, operation: "tick" });
    if (event.frame >= instance.expiresAtFrame) {
      rows.push({ ...row, operation: "expire" });
      active.delete(key);
    } else push({ kind: "tick", instance, tickIndex: event.tickIndex + 1,
      frame: event.frame + instance.definition.intervalFrames, priority: 2, order: sequence++ });
  }
  return rows;
}
