import type { RefinementCtx } from "zod";
import { actionChildEventPriority, actionOwner, isActionHitSelected } from "./action-condition-integrity";
import { canonicalStringify } from "./reproducibility";
import { CALLBACK_BUS_SCHEMA_VERSION, type ActiveStatusSnapshot, type CharacterStats, type SimulationResult } from "./types";

export interface ExpectedSourceSnapshot {
  actionLogIndex: number;
  actionId: string;
  sourceActorId: string;
  ownerId: string;
  cycle: number;
  relativeFrame: number;
  frame: number;
  timeSeconds: number;
}

export function sourceSnapshotKey(actionLogIndex: number, ownerId: string, relativeFrame: number): string {
  return JSON.stringify([actionLogIndex, ownerId, relativeFrame]);
}

export function hasExplicitSourceSnapshots(result: SimulationResult): boolean {
  return result.schemaVersion === CALLBACK_BUS_SCHEMA_VERSION &&
    [...result.config.rotation, ...(result.config.timeline?.abilities ?? [])].some(owner =>
      owner.hits?.some(hit => hit.snapshotFrame !== undefined || hit.flatSources?.some(flat => flat.snapshotFrame !== undefined)));
}

/** Entitlements come from accepted actions and their selected configured hits,
 * including future hits and hits that will miss. Result rows grant no samples. */
export function expectedSourceSnapshots(result: SimulationResult): ExpectedSourceSnapshot[] {
  if (!hasExplicitSourceSnapshots(result)) return [];
  const expected = new Map<string, ExpectedSourceSnapshot>();
  for (const [actionLogIndex, action] of result.actionLog.entries()) {
    const add = (ownerId: string, relativeFrame: number): void => {
      const key = sourceSnapshotKey(actionLogIndex, ownerId, relativeFrame);
      if (!expected.has(key)) expected.set(key, { actionLogIndex, actionId: action.actionId,
        sourceActorId: action.actorId, ownerId, cycle: action.cycle, relativeFrame,
        frame: action.frame + relativeFrame, timeSeconds: (action.frame + relativeFrame) / 60 });
    };
    for (const [hitIndex, hit] of (actionOwner(result.config, action)?.hits ?? []).entries()) {
      if (!isActionHitSelected(result, actionLogIndex, hit.id ?? `${action.actionId}:hit-${hitIndex}`)) continue;
      const scalingOwnerId = hit.scalingOwnerId ?? action.actorId;
      if (hit.snapshotFrame !== undefined) {
        add(scalingOwnerId, hit.snapshotFrame);
        add(action.actorId, hit.snapshotFrame);
      }
      for (const flat of hit.flatSources ?? []) {
        const relativeFrame = flat.snapshotFrame ?? hit.snapshotFrame;
        if (relativeFrame !== undefined) add(flat.ownerId ?? scalingOwnerId, relativeFrame);
      }
    }
  }
  return [...expected.values()];
}

/** The actual main queue defers zero-offset children of a late action by
 * ten priority units: own buffs run at 11, samples at 12.5 and hits at 13. */
export function sourceSnapshotReplayPoint(result: SimulationResult, expected: ExpectedSourceSnapshot) {
  const action = result.actionLog[expected.actionLogIndex]!;
  return { frame: expected.frame, timeSeconds: expected.timeSeconds,
    priority: actionChildEventPriority(actionOwner(result.config, action), expected.relativeFrame, 2.5) };
}

export function validateSourceSnapshotIntegrity(
  result: SimulationResult,
  context: RefinementCtx,
  statsAt: (actorId: string, point: ReturnType<typeof sourceSnapshotReplayPoint>) => CharacterStats | undefined,
  buffsAt: (actorId: string, point: ReturnType<typeof sourceSnapshotReplayPoint>) => ActiveStatusSnapshot[]
): Map<string, NonNullable<SimulationResult["sourceSnapshotLog"]>[number]> {
  const rows = result.sourceSnapshotLog;
  const declared = hasExplicitSourceSnapshots(result);
  const issue = (path: Array<string | number>, message: string): void => context.addIssue({ code: "custom", path, message });
  if ((rows !== undefined) !== declared) issue(["sourceSnapshotLog"],
    "sourceSnapshotLog must be present exactly when the current config declares explicit source snapshots");
  const declarations = expectedSourceSnapshots(result);
  const expected = new Map(declarations.map(row => [sourceSnapshotKey(row.actionLogIndex, row.ownerId, row.relativeFrame), row]));
  const actual = new Map<string, NonNullable<typeof rows>[number]>();
  const endFrame = Math.round(result.config.duration * 60);
  const otherTaskSequences = new Set([
    ...result.damageEvents, ...result.hitResolutionLog, ...(result.statConversionLog ?? []),
    ...(result.actionConditionLog ?? []), ...(result.energyCostLog ?? []), ...(result.thrillingTalesLog ?? []),
    ...(result.summonLog ?? []), ...(result.playerHealthEvents ?? []), ...(result.periodicEntityLog ?? [])
  ].map(entry => entry.eventSequence));
  let previousSequence = -1;
  let previousActionIndex = -1;
  for (const [index, row] of (rows ?? []).entries()) {
    const path: Array<string | number> = ["sourceSnapshotLog", index];
    const key = sourceSnapshotKey(row.actionLogIndex, row.ownerId, row.relativeFrame);
    const source = expected.get(key);
    if (source === undefined) { issue(path, "source snapshot has no selected accepted-action declaration"); continue; }
    if (actual.has(key)) issue(path, "source snapshots must be deduplicated by action, owner and relative frame");
    actual.set(key, row);
    const registered = declarations[index];
    if (registered === undefined || sourceSnapshotKey(registered.actionLogIndex, registered.ownerId, registered.relativeFrame) !== key) issue(path,
      "source snapshot registration order must follow selected hit order, main owner, reaction owner and flat sources");
    if (row.actionLogIndex < previousActionIndex) issue([...path, "actionLogIndex"], "source snapshot registration must preserve accepted-action order");
    previousActionIndex = row.actionLogIndex;
    for (const [field, value] of Object.entries(source)) {
      if (field === "timeSeconds") {
        if (Math.abs(row.timeSeconds - source.timeSeconds) > 1e-9) issue([...path, field], "source snapshot time must match its actual action-relative frame");
      } else if (row[field as keyof typeof source] !== value) issue([...path, field], `source snapshot ${field} must match its accepted-action declaration`);
    }
    if (row.id !== index) issue([...path, "id"], "source snapshot IDs must be contiguous and index-addressable");
    const point = sourceSnapshotReplayPoint(result, source);
    if (row.eventPriority !== point.priority) issue([...path, "eventPriority"], "source snapshots must retain their ordinary or late-action main queue priority");
    const sampled = source.frame <= endFrame;
    if (row.status !== (sampled ? "sampled" : "pending")) issue([...path, "status"], "source snapshot status must match the actual simulation horizon");
    if (!sampled) {
      if (row.eventSequence !== null || row.stats !== null || row.activeBuffs.length !== 0) issue(path, "future pending source snapshots have no sampled state");
      continue;
    }
    if (row.eventSequence === null || row.stats === null) { issue(path, "executed source snapshots require actual sequence and sampled stats"); continue; }
    if (row.eventSequence <= previousSequence) issue([...path, "eventSequence"], "source snapshot tasks must preserve their queue registration order and unique sequences");
    previousSequence = row.eventSequence;
    if (otherTaskSequences.has(row.eventSequence)) issue([...path, "eventSequence"], "source snapshots are independent tasks and cannot reuse another executed task sequence");
    const actionSequences = [
      ...(result.statConversionLog ?? []).filter(entry => entry.actionLogIndex === source.actionLogIndex).map(entry => entry.eventSequence),
      ...(result.actionConditionLog ?? []).filter(entry => entry.actionLogIndex === source.actionLogIndex).map(entry => entry.eventSequence),
      ...(result.energyCostLog ?? []).filter(entry => entry.operation === "reserve" && entry.actionLogIndex === source.actionLogIndex).map(entry => entry.eventSequence),
      ...(result.thrillingTalesLog ?? []).filter(entry => entry.actionLogIndex === source.actionLogIndex).map(entry => entry.eventSequence)
    ];
    if (actionSequences.some(sequence => sequence >= row.eventSequence!)) issue([...path, "eventSequence"], "source snapshot task must be queued by its already executing accepted action");
    const stats = statsAt(source.ownerId, point);
    if (stats === undefined) issue([...path, "stats"], "source snapshot owner must have independently replayable stats");
    else {
      const expectedStats = stats as unknown as Record<string, number>;
      const actualStats = row.stats as unknown as Record<string, number>;
      if (canonicalStringify(Object.keys(actualStats).sort()) !== canonicalStringify(Object.keys(expectedStats).sort())) issue([...path, "stats"], "source snapshot stat keys must match independently replayed stats");
      for (const [stat, value] of Object.entries(expectedStats)) if (!Number.isFinite(actualStats[stat]) || Math.abs(actualStats[stat]! - value) > 1e-9 * Math.max(1, Math.abs(value))) {
        issue([...path, "stats", stat], "source snapshot stats must match the independently replayed sampling point");
      }
    }
    const statuses = (entries: ActiveStatusSnapshot[]) => entries.map(entry => canonicalStringify(entry)).sort();
    if (canonicalStringify(statuses(row.activeBuffs)) !== canonicalStringify(statuses(buffsAt(source.ownerId, point)))) issue([...path, "activeBuffs"],
      "source snapshot buffs must match the independently replayed sampling point");
  }
  for (const [key] of expected) if (!actual.has(key)) issue(["sourceSnapshotLog"], "every selected explicit source snapshot must be registered, including future pending samples");
  // Checkpoints are taken before any event at tick. The same source row can
  // therefore be pending at an early checkpoint and sampled in the final log.
  const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
  const equalCapture = (left: unknown, right: unknown): boolean => {
    if (typeof left === "number" && typeof right === "number") return Number.isFinite(left) && Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(right));
    if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => equalCapture(value, right[index]));
    if (isRecord(left) && isRecord(right)) {
      if (canonicalStringify(Object.keys(left).sort()) !== canonicalStringify(Object.keys(right).sort())) return false;
      return Object.keys(right).every(key => {
        if (key !== "activeBuffs" || !Array.isArray(left[key]) || !Array.isArray(right[key])) return equalCapture(left[key], right[key]);
        const order = (values: unknown[]) => [...values].sort((a, b) => canonicalStringify(a).localeCompare(canonicalStringify(b)));
        return equalCapture(order(left[key]), order(right[key]));
      });
    }
    return left === right;
  };
  for (const [checkpointIndex, checkpoint] of (result.executionAudit?.phaseCheckpoints ?? []).entries()) {
    const pending = checkpoint.state.pendingEvents;
    if (!isRecord(pending) || !Array.isArray(pending.inFlight)) continue;
    const path: Array<string | number> = ["executionAudit", "phaseCheckpoints", checkpointIndex, "state", "pendingEvents", "inFlight"];
    const sourceActionId = (action: SimulationResult["actionLog"][number]) => action.sourceAbilityId ??
      (action.timelineCommandIndex === undefined ? action.actionId : action.actionId.replace(/#\d+$/, ""));
    const normalized = (source: ExpectedSourceSnapshot) => {
      const action = result.actionLog[source.actionLogIndex]!;
      const point = sourceSnapshotReplayPoint(result, source);
      const sampled = source.frame < checkpoint.tick;
      return { sourceActionId: sourceActionId(action), sourceActorId: source.sourceActorId, ownerId: source.ownerId,
        actionAgeTicks: checkpoint.tick - action.frame, relativeFrame: source.relativeFrame,
        sampleRemainingTicks: source.frame - checkpoint.tick, eventPriority: point.priority,
        status: sampled ? "sampled" : "pending", stats: sampled ? statsAt(source.ownerId, point) : null,
        activeBuffs: sampled ? buffsAt(source.ownerId, point).map(({ startTimeSeconds, endTimeSeconds, ...buff }) => ({
          ...buff, startAgeTicks: checkpoint.tick - startTimeSeconds * 60, endRemainingTicks: endTimeSeconds * 60 - checkpoint.tick
        })) : [] };
    };
    const pendingSources = declarations.filter(source => result.actionLog[source.actionLogIndex]!.frame < checkpoint.tick && source.frame >= checkpoint.tick)
      .map((source, order) => ({ source, order, point: sourceSnapshotReplayPoint(result, source) }))
      .sort((a, b) => a.source.frame - b.source.frame || a.point.priority - b.point.priority || a.order - b.order)
      .map(({ source, point }) => ({ type: "sourceSnapshot", remainingTicks: source.frame - checkpoint.tick,
        priority: point.priority, payload: normalized(source) }));
    if (!equalCapture(pending.inFlight.filter(value => isRecord(value) && value.type === "sourceSnapshot"), pendingSources)) issue(path,
      "checkpoint must preserve every actually pending source snapshot with its independent action, frame and unsampled state");
    for (const [eventIndex, pendingEvent] of pending.inFlight.entries()) {
      if (!isRecord(pendingEvent) || pendingEvent.type !== "hit" || !isRecord(pendingEvent.payload)) continue;
      const payload = pendingEvent.payload;
      if (!isRecord(payload.action) || typeof payload.hitIndex !== "number" || typeof pendingEvent.remainingTicks !== "number") continue;
      const queuedAction = payload.action;
      const actionLogIndex = result.actionLog.findIndex(action => {
        if (action.frame >= checkpoint.tick || sourceActionId(action) !== queuedAction.id || action.actorId !== queuedAction.actorId) return false;
        const hit = actionOwner(result.config, action)?.hits?.[payload.hitIndex as number];
        if (hit === undefined) return false;
        const hitFrame = "frame" in hit ? hit.frame : Math.round(hit.offset * 60);
        return action.frame + hitFrame === checkpoint.tick + (pendingEvent.remainingTicks as number);
      });
      const action = result.actionLog[actionLogIndex];
      const hit = action === undefined ? undefined : actionOwner(result.config, action)?.hits?.[payload.hitIndex];
      const expectedRefs: Record<string, unknown> = {};
      const resolve = (ownerId: string, relativeFrame: number) => {
        const source = expected.get(sourceSnapshotKey(actionLogIndex, ownerId, relativeFrame));
        return source === undefined ? undefined : normalized(source);
      };
      if (hit !== undefined && action !== undefined) {
        const scalingOwnerId = hit.scalingOwnerId ?? action.actorId;
        if (hit.snapshotFrame !== undefined) {
          expectedRefs.main = resolve(scalingOwnerId, hit.snapshotFrame);
          expectedRefs.reaction = resolve(action.actorId, hit.snapshotFrame);
        }
        const flatSources: Record<string, unknown> = {};
        for (const [index, flat] of (hit.flatSources ?? []).entries()) {
          const frame = flat.snapshotFrame ?? hit.snapshotFrame;
          if (frame !== undefined) flatSources[String(index)] = resolve(flat.ownerId ?? scalingOwnerId, frame);
        }
        if (Object.keys(flatSources).length > 0) expectedRefs.flatSources = flatSources;
      }
      if (!equalCapture(payload.sourceSnapshots, Object.keys(expectedRefs).length === 0 ? undefined : expectedRefs)) issue([...path, eventIndex, "payload", "sourceSnapshots"],
        "pending hit source snapshots must match the accepted configured action and the real pre-frame sampling state");
    }
  }
  return actual;
}
