import type { RefinementCtx } from "zod";
import { getWeaponProcDefinition } from "@genshin-dps-lab/reaction-formulas";
import { actionChildEventPriority, actionOwner } from "./action-condition-integrity";
import { canonicalStringify } from "./reproducibility";
import { replayWeaponProcs } from "./weapon-proc-replay";
import { replayThrillingTales, thrillingTalesBuffsAt, thrillingTalesRowsAt } from "./thrilling-tales-replay";
import type { ActiveStatusSnapshot, CharacterStats, DamageEvent, SimulationResult } from "./types";

type Point = { frame: number; timeSeconds: number; priority?: number; actionOrder?: number };
const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** Buff labels are replayed from accepted configured actions, not a host's
 * potentially older action snapshot (or a proc log's self-reported panel). */
function triggerBuffs(result: SimulationResult, actorId: string, point: { frame: number; timeSeconds: number; priority: number }): ActiveStatusSnapshot[] {
  const queued: Array<{ frame: number; priority: number; actionIndex: number; buffIndex: number; time?: number; buff: ActiveStatusSnapshot }> = [];
  for (const [actionIndex, action] of result.actionLog.entries()) {
    const owner = actionOwner(result.config, action);
    for (const [buffIndex, buff] of (owner?.buffs ?? []).entries()) {
      const targets = buff.target === "team" ? result.config.characters.map(actor => actor.id)
        : buff.target === "self" || buff.target === undefined ? [action.actorId]
          : Array.isArray(buff.target) ? buff.target : [buff.target];
      if (!targets.includes(actorId)) continue;
      const rawStart = action.time + ("durationFrames" in buff ? (buff.startFrame ?? 0) / 60 : buff.offset ?? 0);
      const frame = Math.round(rawStart * 60);
      const start = result.compatibilityMode === "legal-frame-v1" ? frame / 60 : rawStart;
      const duration = "durationFrames" in buff ? buff.durationFrames / 60 : buff.duration;
      queued.push({ frame, priority: actionChildEventPriority(owner, frame - action.frame, 1), actionIndex, buffIndex,
        buff: { key: `${buff.key ?? buff.stat}:${actorId}`, kind: "buff", sourceActorId: action.actorId,
          targetId: actorId, stat: buff.stat, value: buff.value, startTimeSeconds: start,
          endTimeSeconds: start + duration, label: buff.label ?? buff.key ?? buff.stat } });
    }
  }
  const ttdsReplay = replayThrillingTales(result);
  const ttdsRows = thrillingTalesRowsAt(result, ttdsReplay, actorId, point);
  for (const [index, buff] of thrillingTalesBuffsAt(result, ttdsReplay, actorId, point).entries()) {
    const row = ttdsRows[index]!.expected;
    queued.push({ frame: row.frame, priority: row.eventPriority, actionIndex: row.actionLogIndex ?? -1, buffIndex: -1, time: row.timeSeconds, buff });
  }
  queued.sort((a, b) => (a.time ?? a.buff.startTimeSeconds) - (b.time ?? b.buff.startTimeSeconds) || a.priority - b.priority || a.actionIndex - b.actionIndex || a.buffIndex - b.buffIndex);
  const active = new Map<string, ActiveStatusSnapshot>();
  for (const row of queued) {
    if (row.buff.startTimeSeconds > point.timeSeconds + 1e-9 || near(row.buff.startTimeSeconds, point.timeSeconds) && row.priority >= point.priority) continue;
    active.delete(row.buff.key); active.set(row.buff.key, row.buff);
  }
  return [...active.values()].filter(buff => buff.endTimeSeconds > point.timeSeconds + 1e-9);
}

export function validateWeaponProcIntegrity(result: SimulationResult, context: RefinementCtx,
  statsAt: (actorId: string, point: Point) => CharacterStats | undefined): void {
  const issue = (path: Array<string | number>, message: string): void => context.addIssue({ code: "custom", path, message });
  const equal = (path: Array<string | number>, actual: unknown, expected: unknown): void => {
    const matches = typeof actual === "number" && typeof expected === "number" ? near(actual, expected)
      : canonicalStringify(actual ?? null) === canonicalStringify(expected ?? null);
    if (!matches) issue(path, "must match the independent configured weapon callback replay");
  };
  const rows = result.weaponProcLog;
  if (result.config.weaponProcModel === undefined) {
    if (rows !== undefined) issue(["weaponProcLog"], "requires its explicit independent weapon model");
    if (result.weaponProcLifecycleLog !== undefined) issue(["weaponProcLifecycleLog"], "requires an explicitly configured stateful weapon");
    for (const event of result.damageEvents) if (event.weaponProcLogId !== undefined) issue(["damageEvents", event.id, "weaponProcLogId"], "requires an independently configured weapon proc");
    return;
  }
  const hasLifecycle = result.config.weaponProcModel.actors.some(actor => getWeaponProcDefinition(actor.weaponId)!.lifecycleKind !== undefined);
  if (result.config.weaponProcModel.actors.some(actor => {
    const definition = getWeaponProcDefinition(actor.weaponId)!;
    return definition.randomTrigger !== undefined || definition.lifecycleKind !== undefined || definition.requiresWeakPoint === true || definition.snapshotTiming === "delivery";
  }) &&
      result.compatibilityMode !== "legal-frame-v1") issue(["compatibilityMode"], "deferred or delayed weapon callbacks require the explicit native 60-fps event queue");
  const { attempts, lifecycle } = replayWeaponProcs(result);
  if (hasLifecycle) {
    if (result.weaponProcLifecycleLog === undefined || result.weaponProcLifecycleLog.length !== lifecycle.length) {
      issue(["weaponProcLifecycleLog"], "requires every actual accepted skill or particle pickup hook, including blocked attempts");
    }
    let previous: { frame: number; priority: number; sequence: number } | undefined;
    for (const { expected, knownEventSequence } of lifecycle) {
      const actual = result.weaponProcLifecycleLog?.[expected.id];
      if (actual === undefined) continue;
      const path: Array<string | number> = ["weaponProcLifecycleLog", expected.id];
      for (const [key, value] of Object.entries(expected)) equal([...path, key], actual[key as keyof typeof actual], value);
      if (knownEventSequence !== null) equal([...path, "eventSequence"], actual.eventSequence, knownEventSequence);
      if (previous !== undefined && previous.frame === actual.frame && previous.priority === actual.eventPriority && previous.sequence > actual.eventSequence) {
        issue([...path, "eventSequence"], "lifecycle hooks must retain actual action or pickup order");
      }
      previous = { frame: actual.frame, priority: actual.eventPriority, sequence: actual.eventSequence };
      if (expected.actionLogIndex !== null) {
        const action = result.actionLog[expected.actionLogIndex]!;
        if (result.damageEvents.some(event => event.actionId === action.actionId && event.cycle === action.cycle && event.eventSequence <= actual.eventSequence)) {
          issue([...path, "eventSequence"], "OnSkill must precede damage queued by that accepted skill");
        }
      }
    }
  } else if (result.weaponProcLifecycleLog !== undefined) issue(["weaponProcLifecycleLog"], "the original eight weapons cannot carry lifecycle fields");
  if (rows === undefined || rows.length !== attempts.length) issue(["weaponProcLog"], "requires exactly one audit for every eligible ordinary damage callback, including blocked callbacks");
  if (result.executionAudit === undefined) issue(["executionAudit"], "independent weapon procs require captured ordinary formula execution");
  let previousDeferred: { time: number; priority: number; sequence: number; parentSequence: number } | undefined;
  for (const { parent, expected, occurrence, occurrences, deferredCallback } of attempts) {
    const row = rows?.[expected.id];
    if (row === undefined) continue;
    const path: Array<string | number> = ["weaponProcLog", expected.id];
    for (const [key, value] of Object.entries(expected)) equal([...path, key], row[key as keyof typeof expected], value);
    if (expected.snapshotFrame !== undefined && row.snapshotFrame === undefined) issue([...path, "snapshotFrame"], "delayed and multi-hit source weapons require their planned snapshot frame");
    if (expected.snapshotFrame === undefined && row.snapshotFrame !== undefined) issue([...path, "snapshotFrame"], "only delayed or multi-hit source weapons carry an explicit snapshot frame");
    if (expected.snapshotEventSequence !== undefined && row.snapshotEventSequence === undefined) issue([...path, "snapshotEventSequence"], "delayed source weapons require their task execution provenance");
    if (expected.snapshotEventSequence === undefined && row.snapshotEventSequence !== undefined) issue([...path, "snapshotEventSequence"], "only delayed source weapons carry a snapshot task sequence");
    if (expected.hitWeakPoint === undefined && row.hitWeakPoint !== undefined) issue([...path, "hitWeakPoint"], "only Messenger callbacks carry an explicit source weak-point fact");
    if (expected.random === undefined && row.random !== undefined) issue([...path, "random"], "the original deterministic weapons cannot carry random-source fields");
    if (expected.triggerAura === undefined && row.triggerAura !== undefined) issue([...path, "triggerAura"], "only frost-source weapons query callback Cryo/Frozen state");
    if (expected.stateBefore === undefined && (row.stateBefore !== undefined || row.stateAfter !== undefined)) issue([...path, "stateBefore"], "the original eight weapons cannot carry stateful weapon fields");
    if (deferredCallback !== undefined) {
      if (row.eventSequence <= deferredCallback.afterEventSequence) issue([...path, "eventSequence"], "deferred callbacks must run after this phase's already queued ordinary hits");
      if (deferredCallback.beforeEventSequence !== undefined && row.eventSequence >= deferredCallback.beforeEventSequence) {
        issue([...path, "eventSequence"], "a callback must precede immediate hits created by tasks that execute after its parent");
      }
      if (previousDeferred !== undefined && near(previousDeferred.time, row.timeSeconds) && previousDeferred.priority === row.eventPriority &&
          (previousDeferred.sequence >= row.eventSequence || previousDeferred.parentSequence >= parent.eventSequence)) issue([...path, "eventSequence"], "deferred callbacks must retain their independently derived parent-hit FIFO order");
      previousDeferred = { time: row.timeSeconds, priority: row.eventPriority, sequence: row.eventSequence, parentSequence: parent.eventSequence };
    }
    equal(["damageEvents", parent.id, "activeCharacterId"], parent.activeCharacterId, expected.activeCharacterId);
    const children = result.damageEvents.filter(event => event.weaponProcLogId === expected.id);
    const occurrenceByActionId = new Map(occurrences.map(child => [child.actionId, child]));
    const resolutions = result.hitResolutionLog.filter(hit => occurrenceByActionId.has(hit.sourceActionId));
    if (occurrence?.snapshotEventSequence !== undefined &&
        (occurrence.snapshotEventSequence <= parent.eventSequence || resolutions.some(hit => hit.eventSequence! <= occurrence.snapshotEventSequence!))) {
      issue([...path, "snapshotEventSequence"], "the delayed task must be queued after its trigger and before its emitted hits");
    }
    if (deferredCallback !== undefined && resolutions.some(hit => hit.eventSequence! <= row.eventSequence)) {
      issue([...path, "eventSequence"], "the callback must precede the independent attack it actually queued");
    }
    equal([...path, "damageEventIds"], row.damageEventIds, children.map(event => event.id));
    equal([...path, "hitResolutionIds"], row.hitResolutionIds, resolutions.map(hit => hit.id));
    if (occurrence === undefined || !occurrence.snapshotTaken) {
      equal([...path, "triggerSnapshot"], row.triggerSnapshot, null);
      equal([...path, "triggerBuffStatuses"], row.triggerBuffStatuses, []);
      equal([...path, "damageEventIds"], row.damageEventIds, []);
      equal([...path, "hitResolutionIds"], row.hitResolutionIds, []);
      continue;
    }
    if (expected.radius !== null && expected.origin === null) issue([...path, "origin"], "circle procs require the configured target position at their source snapshot time");
    const point = { frame: occurrence.snapshotFrame, timeSeconds: occurrence.snapshotTimeSeconds, priority: occurrence.snapshotPriority };
    const stats = statsAt(expected.actorId, point);
    if (stats === undefined) issue([...path, "triggerSnapshot"], "requires independently replayable source snapshot owner stats");
    else {
      equal([...path, "triggerSnapshot"], Object.keys(row.triggerSnapshot ?? {}).sort(), Object.keys(stats).sort());
      for (const [key, value] of Object.entries(stats)) equal([...path, "triggerSnapshot", key], row.triggerSnapshot?.[key as keyof CharacterStats], value);
    }
    const buffs = triggerBuffs(result, expected.actorId, point);
    equal([...path, "triggerBuffStatuses"], row.triggerBuffStatuses, buffs);
    for (const event of children) {
      const occurrence = occurrenceByActionId.get(event.actionId);
      if (occurrence === undefined) { issue(["damageEvents", event.id, "actionId"], "must belong to a source-scheduled weapon attack"); continue; }
      const eventPath: Array<string | number> = ["damageEvents", event.id];
      const identity = { kind: "direct", parentDamageEventId: parent.id, sourceActorId: expected.actorId,
        scalingOwnerId: expected.actorId, creditOwnerId: expected.actorId, actionId: occurrence.actionId,
        actionName: occurrence.action.name, hitId: occurrence.hitId, hitLabel: occurrence.hit.label,
        hitGroupId: `${occurrence.actionId}:${occurrence.cycle}:0:${occurrence.frame}`, frame: occurrence.frame,
        cycle: occurrence.cycle, element: "physical", snapshot: "action", eventPriority: 3,
        scaling: expected.coefficient, scalingStat: expected.scalingStat, reaction: "none" };
      for (const [key, value] of Object.entries(identity)) equal([...eventPath, key], event[key as keyof DamageEvent], value);
      for (const key of ["timelineCommandIndex", "sourceAbilityId", "actionStartFrame", "actionCancelFrame", "actionAnimationEndFrame"] as const) {
        if (event[key] !== undefined) issue([...eventPath, key], "independent weapon attacks cannot borrow host timeline metadata");
      }
      equal([...eventPath, "activeStatuses"], event.activeStatuses.filter(status => status.kind === "buff"), buffs);
      equal([...eventPath, "flatDetails"], event.flatDetails, []);
      if (stats !== undefined && !result.runManifest.pluginCapabilities.includes("damage-modifier")) {
        for (const [key, value] of Object.entries({ scaling: expected.coefficient, scalingStat: expected.scalingStat,
          flatDamage: 0, damageBonus: stats.dmgBonus + (occurrence.hit.dmgBonus ?? 0), critRate: stats.critRate,
          critDamage: stats.critDmg, defenseIgnore: stats.defIgnore, groupMultiplier: 1 })) {
          equal([...eventPath, "damageFactors", key], event.damageFactors[key as keyof typeof event.damageFactors], value);
        }
      }
    }
  }
  for (const event of result.damageEvents) if (event.weaponProcLogId !== undefined &&
    !attempts[event.weaponProcLogId]?.occurrences.some(occurrence => occurrence.actionId === event.actionId)) {
    issue(["damageEvents", event.id, "weaponProcLogId"], "must point to the exact independently replayed triggered attack");
  }
}
