import { expectedSourceSnapshots, sourceSnapshotReplayPoint } from "./source-snapshot-integrity";
import { actionEventPriority, actionOwner, isActionHitSelected } from "./action-condition-integrity";
import { THRILLING_TALES_SOURCE_PROFILE as source } from "./thrilling-tales-source";
import { replayPeriodicEntities } from "./periodic-entity-replay";
import { replayWeaponProcOccurrences } from "./weapon-proc-replay";
import type { ActiveStatusSnapshot, DamageEvent, SimulationResult, ThrillingTalesLogEntry } from "./types";

export interface ThrillingTalesReplayPoint {
  frame: number;
  timeSeconds: number;
  priority?: number;
  actionOrder?: number;
}

export interface ReplayedThrillingTalesAttempt {
  expected: Omit<ThrillingTalesLogEntry, "eventSequence">;
  attemptOrder: number;
}

export interface ThrillingTalesReplay {
  attempts: ReplayedThrillingTalesAttempt[];
  actionOrders: Map<number, number>;
}

type ActionAttempt = {
  actorId: string; actionId: string; sourceAbilityId?: string; frame: number; time: number; cycle: number;
  timelineCommandIndex?: number; actionLogIndex: number | null; skippedActionIndex: number | null;
  priority: number; attemptOrder: number;
};

function actionAttempts(result: SimulationResult): ActionAttempt[] {
  return [
    ...result.actionLog.map((action, actionLogIndex) => ({ ...action, actionLogIndex, skippedActionIndex: null })),
    ...result.skippedActions.map((action, skippedActionIndex) => ({ ...action, actionLogIndex: null, skippedActionIndex }))
  ].map(action => ({ ...action, priority: actionEventPriority(actionOwner(result.config, action)), attemptOrder: 0 }))
    .sort((a, b) => a.time - b.time || a.priority - b.priority || a.cycle - b.cycle ||
      (a.timelineCommandIndex ?? result.config.rotation.findIndex(owner => owner.id === a.actionId && owner.actorId === a.actorId)) -
      (b.timelineCommandIndex ?? result.config.rotation.findIndex(owner => owner.id === b.actionId && owner.actorId === b.actorId)))
    .map((action, attemptOrder) => ({ ...action, attemptOrder }));
}

type StatsRead = { frame: number; time: number; priority: number; actionOrder?: number; eventSequence?: number; owners: string[] };

function configuredSourceHit(result: SimulationResult, event: DamageEvent) {
  const owner = actionOwner(result.config, { actorId: event.sourceActorId, actionId: event.actionId,
    ...(event.sourceAbilityId === undefined ? {} : { sourceAbilityId: event.sourceAbilityId }) });
  const prefix = `${event.actionId}:${event.cycle}:`;
  const suffix = `:${event.frame}`;
  const index = event.hitGroupId.startsWith(prefix) && event.hitGroupId.endsWith(suffix)
    ? event.hitGroupId.slice(prefix.length, -suffix.length) : "";
  return /^(0|[1-9]\d*)$/.test(index) ? owner?.hits?.[Number(index)] : undefined;
}

/** Only actual full panel samples mutate source StatMod presence. SelectStat
 * queries (healing, ER, reaction EM, periodic flat sources, conversions) do not. */
function statsReads(result: SimulationResult, actions: ActionAttempt[]): StatsRead[] {
  const reads: StatsRead[] = [];
  for (const action of actions) {
    if (action.actionLogIndex === null) continue;
    const owner = actionOwner(result.config, action);
    const deferred = new Set([...(owner?.summons ?? []).flatMap(row => row.hitIds), ...(owner?.periodicEntities ?? []).flatMap(row => row.hitIds)]);
    const hits = (owner?.hits ?? []).filter((hit, index) => hit.snapshotFrame === undefined && hit.snapshot === "action" &&
      !deferred.has(hit.id ?? `${action.actionId}:hit-${index}`) &&
      isActionHitSelected(result, action.actionLogIndex!, hit.id ?? `${action.actionId}:hit-${index}`));
    if (hits.length > 0) reads.push({ frame: action.frame, time: action.time, priority: action.priority, actionOrder: action.attemptOrder,
      owners: [...new Set([action.actorId, ...hits.flatMap(hit => [hit.scalingOwnerId ?? action.actorId,
        ...(hit.flatSources ?? []).filter(flat => flat.snapshotFrame === undefined).map(flat => flat.ownerId ?? action.actorId)])])] });
  }
  for (const spawn of result.summonLog ?? []) {
    if (spawn.operation !== "spawn") continue;
    const action = result.actionLog.find(row => row.actorId === spawn.actorId && row.actionId === spawn.actionId && row.cycle === spawn.cycle);
    if (action === undefined) continue;
    const owner = actionOwner(result.config, action);
    const summon = owner?.summons?.find(row => row.id === spawn.summonId);
    const hits = (owner?.hits ?? []).filter(hit => hit.snapshotFrame === undefined && hit.snapshot === "action" && hit.id !== undefined && summon?.hitIds.includes(hit.id));
    if (hits.length > 0) reads.push({ frame: spawn.frame, time: spawn.timeSeconds, priority: spawn.eventPriority, eventSequence: spawn.eventSequence,
      owners: [...new Set([action.actorId, ...hits.flatMap(hit => [hit.scalingOwnerId ?? action.actorId,
        ...(hit.flatSources ?? []).filter(flat => flat.snapshotFrame === undefined).map(flat => flat.ownerId ?? action.actorId)])])] });
  }
  const ticks = replayPeriodicEntities(result).filter(row => row.operation === "tick");
  for (const event of result.damageEvents) {
    if (event.kind !== "direct") continue;
    const hit = configuredSourceHit(result, event);
    if (hit === undefined || hit.snapshot === "action" || hit.snapshotFrame !== undefined) continue;
    const actionIndex = result.actionLog.findIndex(row => row.actorId === event.sourceActorId && row.actionId === event.actionId && row.cycle === event.cycle);
    const periodic = ticks.some(tick => tick.actionLogIndex === actionIndex && tick.frame + tick.definition.hitDelayFrames === event.frame && tick.definition.hitIds.includes(event.hitId));
    reads.push({ frame: event.frame, time: event.timeSeconds, priority: event.eventPriority, eventSequence: event.eventSequence,
      owners: [...new Set([hit.scalingOwnerId ?? event.sourceActorId,
        ...(periodic ? [] : (hit.flatSources ?? []).filter(flat => flat.snapshotFrame === undefined).map(flat => flat.ownerId ?? hit.scalingOwnerId ?? event.sourceActorId))])] });
  }
  for (const expected of expectedSourceSnapshots(result)) {
    if (expected.frame > Math.round(result.config.duration * 60)) continue;
    const point = sourceSnapshotReplayPoint(result, expected);
    reads.push({ frame: expected.frame, time: expected.timeSeconds, priority: point.priority, owners: [expected.ownerId] });
  }
  for (const proc of replayWeaponProcOccurrences(result)) if (proc.snapshotTaken) reads.push({ frame: proc.snapshotFrame, time: proc.snapshotTimeSeconds,
    priority: proc.snapshotPriority, eventSequence: proc.snapshotEventSequence ?? proc.callbackEventSequence ?? proc.parent.eventSequence, owners: [proc.actorId] });
  return reads.sort((a, b) => a.time - b.time || a.priority - b.priority || (a.actionOrder ?? -1) - (b.actionOrder ?? -1) ||
    (a.eventSequence ?? 0) - (b.eventSequence ?? 0));
}

/** Shared source entitlement for real full Stats reads. Artifact modifier
 * presence uses the same reads; readonly panel/ER/EM queries are excluded. */
export function actualFullStatReadPoints(result: SimulationResult) {
  const actions = actionAttempts(result);
  return statsReads(result, actions).map(read => ({ ...read,
    actionLogIndex: read.actionOrder === undefined ? null : actions[read.actionOrder]?.actionLogIndex ?? null,
  }));
}

/** Replay source-owned swaps from authenticated actual action attempts. The
 * numeric buff has a half-open 600-frame lifetime; source presence is separate. */
export function replayThrillingTales(result: SimulationResult): ThrillingTalesReplay {
  const attempts: ReplayedThrillingTalesAttempt[] = [];
  const actionOrders = new Map<number, number>();
  const model = result.config.thrillingTalesModel;
  if (model === undefined) return { attempts, actionOrders };
  const actors = new Map(model.actors.map(actor => [actor.actorId, actor]));
  const cooldowns = new Map<string, number>();
  const recipientPresence = new Map<string, number>();
  const actions = actionAttempts(result);
  const reads = statsReads(result, actions);
  let readIndex = 0;
  let activeId = result.config.timeline?.initialActiveCharacterId ?? result.config.characters[0]?.id ?? null;
  for (const action of actions) {
    while (readIndex < reads.length) {
      const read = reads[readIndex]!;
      if (read.time > action.time + 1e-9 || Math.abs(read.time - action.time) <= 1e-9 &&
          (read.priority > action.priority || read.priority === action.priority && (read.actionOrder ?? -1) >= action.attemptOrder)) break;
      for (const actorId of read.owners) {
        const expiry = recipientPresence.get(actorId);
        if (expiry !== undefined && expiry <= read.frame) recipientPresence.delete(actorId);
      }
      readIndex++;
    }
    if (action.actionLogIndex !== null) actionOrders.set(action.actionLogIndex, action.attemptOrder);
    const owner = activeId === null || activeId === action.actorId ? undefined : actors.get(activeId);
    if (owner !== undefined) {
      const before = cooldowns.get(owner.actorId) ?? null;
      const recipientBefore = recipientPresence.get(action.actorId) ?? null;
      let outcome: ThrillingTalesLogEntry["outcome"];
      if (before !== null && action.frame <= before) outcome = "owner-cooldown";
      else {
        cooldowns.set(owner.actorId, action.frame + source.cooldownFrames);
        if (recipientBefore !== null && recipientBefore < action.frame) recipientPresence.delete(action.actorId);
        if (recipientPresence.has(action.actorId)) outcome = "recipient-already-buffed";
        else { outcome = "applied"; recipientPresence.set(action.actorId, action.frame + source.durationFrames); }
      }
      attempts.push({ attemptOrder: action.attemptOrder, expected: {
        id: attempts.length, sourceProfileId: source.id, sourceRef: source.sourceRef,
        ownerId: owner.actorId, recipientId: action.actorId, refinement: owner.refinement,
        coefficient: source.coefficients[owner.refinement - 1]!, frame: action.frame, timeSeconds: action.time,
        eventPriority: action.priority, actionId: action.actionId, cycle: action.cycle,
        timelineCommandIndex: action.timelineCommandIndex ?? null, actionLogIndex: action.actionLogIndex,
        skippedActionIndex: action.skippedActionIndex, outcome,
        cooldownExpiresFrameBefore: before, cooldownExpiresFrameAfter: cooldowns.get(owner.actorId) ?? null,
        recipientExpiresFrameBefore: outcome === "owner-cooldown" ? null : recipientBefore,
        recipientExpiresFrameAfter: outcome === "owner-cooldown" ? null : recipientPresence.get(action.actorId) ?? null,
        swapKind: result.config.timeline === undefined ? "legacy-implicit" : "legal-completed"
      } });
    }
    activeId = action.actorId;
  }
  return { attempts, actionOrders };
}

export function thrillingTalesRowsAt(result: SimulationResult, replay: ThrillingTalesReplay, actorId: string,
  point: ThrillingTalesReplayPoint): ReplayedThrillingTalesAttempt[] {
  const pointOrder = point.actionOrder === undefined ? undefined : replay.actionOrders.get(point.actionOrder);
  return replay.attempts.filter(attempt => {
    const row = attempt.expected;
    if (row.outcome !== "applied" || row.recipientId !== actorId || point.frame >= row.frame + source.durationFrames) return false;
    const clock = result.compatibilityMode === "legal-frame-v1" ? row.frame - point.frame : row.timeSeconds - point.timeSeconds;
    if (clock > 1e-9) return false;
    if (Math.abs(clock) <= 1e-9) {
      const priority = point.priority ?? 3;
      if (row.eventPriority > priority) return false;
      if (row.eventPriority === priority && pointOrder !== undefined && attempt.attemptOrder > pointOrder) return false;
    }
    return true;
  });
}

export function thrillingTalesBuffsAt(result: SimulationResult, replay: ThrillingTalesReplay, actorId: string,
  point: ThrillingTalesReplayPoint): ActiveStatusSnapshot[] {
  return thrillingTalesRowsAt(result, replay, actorId, point).map(({ expected: row }) => ({
    key: `${source.buffKey}:${actorId}`, kind: "buff", sourceActorId: row.ownerId, targetId: actorId,
    stat: "atkPct", value: row.coefficient, startTimeSeconds: row.frame / 60,
    endTimeSeconds: row.frame / 60 + source.durationFrames / 60, label: source.buffLabel
  }));
}

/** Use the real snapshot point, so an action snapshot can retain TTDS after
 * its live buff expires and a later live buff cannot be retroactively added. */
export function thrillingTalesForDamageEvent(result: SimulationResult, event: DamageEvent): ThrillingTalesLogEntry[] {
  if (result.config.thrillingTalesModel === undefined || event.kind !== "direct") return [];
  const actionIndex = result.actionLog.findIndex(action => action.actorId === event.sourceActorId && action.actionId === event.actionId && action.cycle === event.cycle);
  const action = result.actionLog[actionIndex];
  let point: ThrillingTalesReplayPoint = { frame: event.frame, timeSeconds: event.timeSeconds, priority: event.eventPriority };
  const configuredHit = configuredSourceHit(result, event);
  if (configuredHit?.snapshotFrame !== undefined && action !== undefined) {
    point = sourceSnapshotReplayPoint(result, { actionLogIndex: actionIndex, actionId: action.actionId,
      sourceActorId: action.actorId, ownerId: event.scalingOwnerId, cycle: action.cycle,
      relativeFrame: configuredHit.snapshotFrame, frame: action.frame + configuredHit.snapshotFrame,
      timeSeconds: (action.frame + configuredHit.snapshotFrame) / 60 });
  } else if (event.snapshot === "action") {
    const proc = event.weaponProcLogId === undefined ? undefined : result.weaponProcLog?.[event.weaponProcLogId];
    const summon = result.summonLog?.find(row => row.operation === "spawn" && row.actorId === event.sourceActorId && row.actionId === event.actionId && row.cycle === event.cycle && row.hitIds.includes(event.hitId));
    const tick = replayPeriodicEntities(result).find(row => row.operation === "tick" && row.actionLogIndex === actionIndex && row.frame + row.definition.hitDelayFrames === event.frame && row.definition.hitIds.includes(event.hitId));
    if (proc !== undefined) point = { frame: proc.frame, timeSeconds: proc.timeSeconds, priority: proc.eventPriority };
    else if (summon !== undefined) point = { frame: summon.frame, timeSeconds: summon.timeSeconds, priority: summon.eventPriority };
    else if (tick !== undefined) point = { frame: tick.frame, timeSeconds: tick.frame / 60, priority: tick.eventPriority };
    else if (action !== undefined) point = { frame: action.frame, timeSeconds: action.time,
      priority: actionEventPriority(actionOwner(result.config, action)), actionOrder: actionIndex };
  }
  return thrillingTalesRowsAt(result, replayThrillingTales(result), event.scalingOwnerId, point)
    .map(row => result.thrillingTalesLog![row.expected.id]!);
}
