import {
  SACRIFICIAL, createSerialSkillCooldown, recoverSerialSkillCooldown, resetSerialSkillCooldown,
  sacrificialCooldownFrames, sacrificialCooldownIsActive, sacrificialProbability,
  serialSkillCooldownRemaining, serialSkillCooldownWorker, startSerialSkillCooldown,
  type SerialSkillCooldownState,
} from "@genshin-dps-lab/reaction-formulas";
import { actionEventPriority, actionOwner } from "./action-condition-integrity";
import { EnergyReplayRandom } from "./energy-replay-integrity";
import { getRuntimeSkillCooldownActors } from "./skill-cooldown-model";
import { artifactDamageCommandIndex, replayArtifactEvents } from "./artifact-event-replay";
import type { ActionLogEntry, DamageEvent, SacrificialLogEntry, SimulationResult, SkillCooldownLogEntry } from "./types";

type ReplayedCooldown = Omit<SkillCooldownLogEntry, "eventSequence"> & { eventSequence: number | null };
type Task = { actorId: string; actionId: string; abilityId: string; timelineCommandIndex: number; recoveryFrames: number; workerGeneration: number | null };
type Event = { frame: number; priority: number; order: number; sequence: number | null } & (
  | { kind: "action"; action: ActionLogEntry; accepted: boolean }
  | { kind: "damage"; damage: DamageEvent }
  | { kind: "start"; task: Task }
  | { kind: "recover"; task: Task });

export interface SacrificialReplay {
  attempts: SacrificialLogEntry[];
  cooldowns: ReplayedCooldown[];
  invalidCasts: string[];
}

/** Reconstruct source callbacks and serial workers from accepted commands and
 * authenticated hits. Neither imported weapon logs nor queue states drive it.
 * A prefix excludes the current/later requests, including their damage. */
export function replaySacrificial(result: SimulationResult, beforeCommandIndex = Infinity): SacrificialReplay {
  const actors = new Map(result.config.sacrificialModel?.actors.map(actor => [actor.actorId, actor]) ?? []);
  const cooldownActors = getRuntimeSkillCooldownActors(result.config);
  const abilities = new Map(result.config.timeline?.abilities.map(ability => [ability.id, ability]) ?? []);
  const states = new Map<string, SerialSkillCooldownState>();
  for (const ability of abilities.values()) if (ability.kind === "skill" && cooldownActors.has(ability.actorId) && !states.has(ability.actorId)) {
    states.set(ability.actorId, createSerialSkillCooldown(ability.maxCharges ?? 1));
  }
  const attempts: SacrificialLogEntry[] = [];
  const cooldowns: ReplayedCooldown[] = [];
  const invalidCasts: string[] = [];
  if (cooldownActors.size === 0) return { attempts, cooldowns, invalidCasts };
  const artifactResets = result.config.artifactEventModel?.actors.some(actor => actor.effectId === "gambler-4pc")
    ? replayArtifactEvents(result, undefined, beforeCommandIndex).attempts.filter(row => row.expected.outcome === "skill-reset") : [];
  const queue: Event[] = [];
  let order = 0;
  const durationFrames = Math.round(result.config.duration * 60);
  const acceptedById = new Map(result.actionLog.map(action => [action.actionId, action]));
  const included = (index: number | undefined): boolean => index !== undefined && index < beforeCommandIndex;
  for (const [actionLogIndex, action] of result.actionLog.entries()) {
    if (!included(action.timelineCommandIndex)) continue;
    const anchor = result.energyCostLog?.find(row => row.operation === "reserve" && row.actionLogIndex === actionLogIndex)
      ?? result.actionConditionLog?.find(row => row.actionLogIndex === actionLogIndex)
      ?? result.statConversionLog?.find(row => row.actionLogIndex === actionLogIndex);
    queue.push({ kind: "action", action, accepted: true, frame: action.frame,
      priority: actionEventPriority(actionOwner(result.config, action)), sequence: anchor?.eventSequence ?? null,
      order: action.timelineCommandIndex! });
  }
  for (const action of result.skippedActions) if (included(action.timelineCommandIndex)) {
    queue.push({ kind: "action", action: { ...action, energyAfter: action.energyBefore }, accepted: false, frame: action.frame,
      priority: actionEventPriority(actionOwner(result.config, action)), sequence: null, order: action.timelineCommandIndex! });
  }
  order = (result.config.timeline?.commands.length ?? 0) + 1;
  for (const damage of result.damageEvents) {
    const sourceCommandIndex = artifactResets.length === 0 ? damage.timelineCommandIndex : artifactDamageCommandIndex(result, damage);
    if (!included(sourceCommandIndex)) continue;
    const sacrificialCallback = damage.kind === "direct" && actors.has(damage.sourceActorId) &&
      damage.mechanicsStatus !== "mechanics-truncated" && damage.reactionAudit.mechanicsTruncation === null;
    if (!sacrificialCallback && !artifactResets.some(row => row.parentDamageEventId === damage.id)) continue;
    queue.push({ kind: "damage", damage, frame: damage.frame, priority: damage.eventPriority, sequence: damage.eventSequence, order: order++ });
  }
  let activeCharacterId: string | null = result.config.timeline?.initialActiveCharacterId ?? result.config.characters[0]?.id ?? null;
  const expiry = new Map<string, number>();
  const random = new EnergyReplayRandom(`${result.resolvedRuntimeOptions.randomSeed}\u0000sacrificial-v1`);
  let drawCount = 0;
  const record = (event: Event, actorId: string, operation: SkillCooldownLogEntry["operation"], next: SerialSkillCooldownState,
    task: Task | null, sacrificialLogId: number | null = null, artifactEventLogId?: number): number => {
    const stateBefore = states.get(actorId)!;
    const id = cooldowns.length;
    cooldowns.push({ id, actorId, actionId: task?.actionId ?? null, abilityId: task?.abilityId ?? null,
      timelineCommandIndex: task?.timelineCommandIndex ?? null, frame: event.frame, timeSeconds: event.frame / 60,
      eventPriority: event.priority, eventSequence: event.sequence, operation,
      workerGeneration: task?.workerGeneration ?? null, sacrificialLogId, stateBefore, stateAfter: next,
      ...(artifactEventLogId === undefined ? {} : { artifactEventLogId }) });
    states.set(actorId, next);
    const worker = serialSkillCooldownWorker(next);
    if (worker !== null && stateBefore.workerGeneration !== next.workerGeneration && worker.frame <= durationFrames) {
      const head = next.queue[0]!;
      const action = acceptedById.get(head.castId)!;
      queue.push({ kind: "recover", frame: worker.frame, priority: -1, sequence: null, order: order++, task: {
        actorId, actionId: head.castId, abilityId: head.abilityId, recoveryFrames: head.recoveryFrames,
        timelineCommandIndex: action.timelineCommandIndex!, workerGeneration: worker.generation } });
    }
    return id;
  };
  while (queue.length > 0) {
    queue.sort((a, b) => a.frame - b.frame || a.priority - b.priority ||
      (a.kind === "damage" && b.kind === "damage" ? a.damage.id - b.damage.id : a.order - b.order));
    const event = queue.shift()!;
    if (event.frame > durationFrames) continue;
    if (event.kind === "action") {
      activeCharacterId = event.action.actorId;
      const ability = event.action.sourceAbilityId === undefined ? undefined : abilities.get(event.action.sourceAbilityId);
      if (!event.accepted || ability?.kind !== "skill" || !cooldownActors.has(ability.actorId)) continue;
      const state = states.get(ability.actorId)!;
      if (state.availableCharges <= 0) { invalidCasts.push(event.action.actionId); continue; }
      const task: Task = { actorId: ability.actorId, actionId: event.action.actionId, abilityId: ability.id,
        timelineCommandIndex: event.action.timelineCommandIndex!, recoveryFrames: ability.chargeRecoveryFrames ?? ability.cooldownFrames, workerGeneration: null };
      const delay = ability.cooldownStartFrame ?? 0;
      if (delay > 0) queue.push({ kind: "start", task, frame: event.frame + delay, priority: -1, sequence: null, order: order++ });
      else record(event, ability.actorId, "start", startSerialSkillCooldown(state, event.frame,
        { castId: task.actionId, abilityId: task.abilityId, recoveryFrames: task.recoveryFrames }), task);
      continue;
    }
    if (event.kind === "start" || event.kind === "recover") {
      const task = event.task;
      const state = states.get(task.actorId)!;
      if (event.kind === "start" && state.availableCharges <= 0) { invalidCasts.push(task.actionId); continue; }
      const next = event.kind === "start" ? startSerialSkillCooldown(state, event.frame,
        { castId: task.actionId, abilityId: task.abilityId, recoveryFrames: task.recoveryFrames })
        : recoverSerialSkillCooldown(state, event.frame, task.workerGeneration!);
      record(event, task.actorId, event.kind === "start" ? "start" : next === state ? "stale-worker" : "recover", next, task);
      continue;
    }
    const parent = event.damage;
    for (const reset of artifactResets.filter(row => row.parentDamageEventId === parent.id)) {
      record(event, reset.expected.actorId, "reset", resetSerialSkillCooldown(states.get(reset.expected.actorId)!, event.frame),
        null, null, reset.expected.id);
    }
    const actor = actors.get(parent.sourceActorId);
    if (actor === undefined || parent.kind !== "direct" || parent.mechanicsStatus === "mechanics-truncated" || parent.reactionAudit.mechanicsTruncation !== null) continue;
    const owner = parent.sourceAbilityId === undefined ? undefined : abilities.get(parent.sourceAbilityId);
    const prefix = `${parent.actionId}:${parent.cycle}:`;
    const suffix = `:${parent.frame}`;
    const hitIndex = parent.hitGroupId.startsWith(prefix) && parent.hitGroupId.endsWith(suffix)
      ? Number(parent.hitGroupId.slice(prefix.length, -suffix.length)) : -1;
    const hit = Number.isInteger(hitIndex) && hitIndex >= 0 ? owner?.hits?.[hitIndex] : undefined;
    const attackTag = hit?.attackTag ?? null;
    const cooldownExpiresFrameBefore = expiry.get(actor.actorId) ?? null;
    const probability = sacrificialProbability(actor.refinement);
    const cooldownFrames = sacrificialCooldownFrames(actor.refinement);
    const drawCountBefore = drawCount;
    let skillCooldownBefore: number | null = null;
    let roll: number | null = null;
    let drawIndex: number | null = null;
    let outcome: SacrificialLogEntry["outcome"];
    if (activeCharacterId !== actor.actorId) outcome = "off-field";
    else if (attackTag !== "skill") outcome = "attack-tag-blocked";
    else if (sacrificialCooldownIsActive(cooldownExpiresFrameBefore, event.frame)) outcome = "cooldown-blocked";
    else {
      skillCooldownBefore = serialSkillCooldownRemaining(states.get(actor.actorId)!, event.frame);
      if (skillCooldownBefore === 0) outcome = "skill-ready";
      else if (parent.finalDamage === 0) outcome = "zero-damage";
      else { drawIndex = drawCount++; roll = random.next(); outcome = roll < probability ? "triggered" : "failed-roll"; }
    }
    const id = attempts.length;
    let skillCooldownLogId: number | null = null;
    if (outcome === "triggered") {
      expiry.set(actor.actorId, event.frame + cooldownFrames);
      skillCooldownLogId = record(event, actor.actorId, "reset", resetSerialSkillCooldown(states.get(actor.actorId)!, event.frame), null, id);
    }
    attempts.push({ id, sourceProfileId: "gcsim-sacrificial-v1", sourceRef: SACRIFICIAL.sourceRef, rngStream: "sacrificial-v1",
      actorId: actor.actorId, weaponId: actor.weaponId, refinement: actor.refinement, frame: event.frame, timeSeconds: parent.timeSeconds,
      eventPriority: event.priority, eventSequence: parent.eventSequence, damageEventId: parent.id, activeCharacterId, attackTag,
      damage: parent.finalDamage, probability, cooldownFrames, cooldownExpiresFrameBefore,
      cooldownExpiresFrameAfter: expiry.get(actor.actorId) ?? null, skillCooldownBefore, outcome, roll, drawIndex,
      drawCountBefore, drawCountAfter: drawCount, skillCooldownLogId });
  }
  return { attempts, cooldowns, invalidCasts };
}
