import type { RefinementCtx } from "zod";
import { ARTIFACT_BUFF_REACTIONS, ARTIFACT_BUFF_SOURCE, createArtifactBuffState,
  type ArtifactBuffCapturedState, type ArtifactBuffDecision, type ArtifactBuffEvent, type ArtifactBuffReaction } from "@genshin-dps-lab/reaction-formulas";
import type { ArtifactBuffLogEntry } from "./artifact-buff-model";
import { replayArtifactBuffDecision } from "./artifact-buff-state-replay";
import { actionEventPriority, actionOwner } from "./action-condition-integrity";
import { actualFullStatReadPoints } from "./thrilling-tales-replay";
import { canonicalStringify } from "./reproducibility";
import type { ActiveStatusSnapshot, SimulationResult } from "./types";

export interface ArtifactBuffReplayPoint {
  frame: number; timeSeconds: number; priority: number; actionOrder?: number; eventSequence?: number;
  parentDamageEventId?: number;
  /** Ordinary attack snapshots precede their own reaction callback. */
  artifactStage?: "before-reaction" | "after-reaction";
}
type Links = Pick<ArtifactBuffLogEntry, "actionLogIndex" | "parentDamageEventId" | "playerHealthEventId" | "reactionTaskLogId" | "parentArtifactBuffLogId">;
type Hook = { event: ArtifactBuffEvent; priority: number; sequence?: number | undefined; actionOrder?: number | undefined; slot: number; links: Links };
type ReplayedRow = { decision: ArtifactBuffDecision; hook: Hook; importedIndex: number };
export interface ArtifactBuffReplay { rows: ReplayedRow[]; state: ArtifactBuffCapturedState; issues: Array<{ path: Array<string | number>; message: string }>; }
const noLinks = (): Links => ({ actionLogIndex: null, parentDamageEventId: null, playerHealthEventId: null, reactionTaskLogId: null, parentArtifactBuffLogId: null });
const reactions = new Set<string>(ARTIFACT_BUFF_REACTIONS);
const cache = new WeakMap<SimulationResult, ArtifactBuffReplay>();
const same = (left: unknown, right: unknown): boolean => left === undefined || right === undefined ? left === right : canonicalStringify(left) === canonicalStringify(right);

/** Actual source callbacks are derived from accepted actions, authenticated
 * Aura/core/health events and full Stats read entitlements, never buff outputs. */
export function replayArtifactBuffs(result: SimulationResult): ArtifactBuffReplay {
  const cached = cache.get(result); if (cached !== undefined) return cached;
  const replay: ArtifactBuffReplay = { rows: [], state: { actors: [] }, issues: [] };
  cache.set(result, replay);
  const model = result.config.artifactBuffModel;
  if (model === undefined) return replay;
  const imported = result.artifactBuffLog ?? [];
  const partyIds = result.config.characters.map(actor => actor.id);
  replay.state.actors = result.config.characters.flatMap(member => model.actors.filter(actor => actor.actorId === member.id).map(actor => ({
    ...actor, state: createArtifactBuffState(),
    sameElementCount: actor.effectId === "gilded-4pc" ? Math.min(3, result.config.characters.filter(other => other.id !== member.id && other.element === member.element).length) : 0,
    differentElementCount: actor.effectId === "gilded-4pc" ? Math.min(3, result.config.characters.filter(other => other.id !== member.id && other.element !== member.element).length) : 0,
  })));
  const issue = (path: Array<string | number>, message: string) => replay.issues.push({ path, message });
  const queue: Hook[] = [];
  const actionSequence = (index: number): number | undefined => result.energyCostLog?.find(row => row.actionLogIndex === index && row.operation === "reserve")?.eventSequence
    ?? result.actionConditionLog?.find(row => row.actionLogIndex === index)?.eventSequence
    ?? imported.find(row => row.actionLogIndex === index && (row.event.kind === "burst" || row.event.kind === "swap" || row.event.kind === "stats-sample"))?.eventSequence;
  const actions = result.actionLog.map((action, index) => ({ ...action, index, priority: actionEventPriority(actionOwner(result.config, action)), sequence: actionSequence(index) }))
    .sort((a, b) => a.frame - b.frame || a.priority - b.priority || a.index - b.index);
  const activeAt = (frame: number, priority: number, sequence?: number, actionOrder?: number): string | null => {
    let active = result.config.timeline?.initialActiveCharacterId ?? partyIds[0] ?? null;
    for (const action of actions) {
      if (action.frame > frame || action.frame === frame && action.priority > priority) break;
      if (action.frame === frame && action.priority === priority && (actionOrder !== undefined ? action.index > actionOrder : sequence !== undefined && action.sequence !== undefined && action.sequence > sequence)) continue;
      active = action.actorId;
    }
    return active;
  };
  let previous = result.config.timeline?.initialActiveCharacterId ?? partyIds[0] ?? null;
  for (const action of actions) {
    const links = { ...noLinks(), actionLogIndex: action.index };
    if (previous !== action.actorId) queue.push({ event: { kind: "swap", frame: action.frame, previousActorId: previous, nextActorId: action.actorId }, priority: action.priority, sequence: action.sequence, actionOrder: action.index, slot: -4, links });
    previous = action.actorId;
    const definition = actionOwner(result.config, action);
    if (definition !== undefined && "kind" in definition && definition.kind === "burst") queue.push({ event: { kind: "burst", frame: action.frame, sourceActorId: action.actorId, activeCharacterId: action.actorId }, priority: action.priority, sequence: action.sequence, actionOrder: action.index, slot: -3, links });
  }
  const addReaction = (reaction: string, sourceActorId: string, frame: number, priority: number, sequence: number,
    targetIsEnemy: boolean, links: Links, slot: number): void => {
    if (!reactions.has(reaction)) return;
    queue.push({ event: { kind: "reaction", frame, sourceActorId, activeCharacterId: activeAt(frame, priority, sequence), reaction: reaction as ArtifactBuffReaction, targetIsEnemy }, priority, sequence, slot, links });
  };
  for (const damage of result.damageEvents) {
    if (damage.reactionAudit.mechanicsTruncation !== null) {
      if (damage.reactionAudit.specialReactions?.length) issue(["damageEvents", damage.id, "reactionAudit", "specialReactions"], "truncated Aura cannot emit a Lunar artifact callback");
      continue;
    }
    const list = [...damage.reactionAudit.reactions];
    if (damage.reactionAudit.shatterReaction?.triggered) {
      addReaction("shatter", damage.sourceActorId, damage.frame, damage.eventPriority, damage.eventSequence, true, { ...noLinks(), parentDamageEventId: damage.id }, damage.targetIndex * 10000 - 1);
    }
    if (damage.reactionAudit.model !== "aura-engine") {
      if (damage.reactionAudit.specialReactions?.length) issue(["damageEvents", damage.id, "reactionAudit", "specialReactions"], "requires an Aura-engine reaction contact");
      continue;
    }
    const execution = result.resolvedRuntimeOptions.execution;
    const auraBefore = damage.reactionAudit.auraBefore ?? [];
    const hasAura = (element: string) => auraBefore.some(aura => aura.element === element && aura.gaugeUnits > 0);
    const actualSpecial = damage.reactionAudit.specialReactions ?? [];
    // Mixed v2 can spend the incoming element on another reaction first; an
    // otherwise unconsumed Hydro/Electro contact still must emit LC.
    const ordinaryLunarCharged = execution?.lunarCharged || execution?.lunarMixed ||
      execution?.lunarMixedV2 && damage.reactionAudit.reactions.length === 0;
    if (ordinaryLunarCharged && damage.reactionAudit.icdAllowed === true &&
        (damage.element === "hydro" && hasAura("electro") || damage.element === "electro" && hasAura("hydro")) &&
        !actualSpecial.includes("lunarCharged")) {
      issue(["damageEvents", damage.id, "reactionAudit", "specialReactions"], "missing Lunar-Charged callback for the recorded Aura contact");
    }
    const lunarCrystallize = execution?.lunarCrystallize || execution?.lunarMixed || execution?.lunarMixedV2;
    if (lunarCrystallize && damage.reactionAudit.icdAllowed === true && damage.element === "geo" &&
        (execution?.lunarCrystallize ? hasAura("hydro") : damage.reactionAudit.auraConsumed?.some(aura => aura.element === "hydro" && aura.gaugeUnits > 0)) &&
        !actualSpecial.includes("lunarCrystallize")) {
      issue(["damageEvents", damage.id, "reactionAudit", "specialReactions"], "missing Lunar-Crystallize callback for the recorded Hydro consumption");
    }
    list.filter(reaction => reaction !== "shatter").forEach((reaction, index) => addReaction(reaction, damage.sourceActorId, damage.frame, damage.eventPriority, damage.eventSequence, true, { ...noLinks(), parentDamageEventId: damage.id }, damage.targetIndex * 10000 + index));
    for (const [index, reaction] of (damage.reactionAudit.specialReactions ?? []).entries()) {
      const enabled = reaction === "lunarCharged"
        ? execution?.lunarCharged || execution?.lunarMixed || execution?.lunarMixedV2
        : execution?.lunarCrystallize || execution?.lunarMixed || execution?.lunarMixedV2;
      const requiredElement = reaction === "lunarCharged" ? ["hydro", "electro"] : ["geo"];
      const oppositeAura = reaction === "lunarCharged" ? damage.element === "hydro" ? "electro" : "hydro" : "hydro";
      if (!enabled || damage.reactionAudit.icdAllowed !== true || !requiredElement.includes(damage.element) ||
          !damage.reactionAudit.auraBefore?.some(aura => aura.element === oppositeAura && aura.gaugeUnits > 0)) {
        issue(["damageEvents", damage.id, "reactionAudit", "specialReactions", index], "requires an eligible actual Lunar Aura contact");
      }
      addReaction(reaction, damage.sourceActorId, damage.frame, damage.eventPriority, damage.eventSequence, true,
        { ...noLinks(), parentDamageEventId: damage.id }, damage.targetIndex * 10000 + list.length + index);
    }
  }
  for (const task of result.reactionTaskLog ?? []) if (task.status === "triggered" && task.bloomReaction !== null) addReaction("bloom", task.sourceActorId, task.frame, task.eventPriority, task.eventSequence, true,
    { ...noLinks(), parentDamageEventId: task.triggerDamageEventId, reactionTaskLogId: task.id }, task.intraEventSequence);
  for (const contact of result.dendroCoreContactLog ?? []) {
    for (const [index, removalId] of contact.removalLogIds.entries()) {
      const removal = result.dendroCoreLog[removalId];
      if (removal?.operation !== "consume") continue;
      addReaction(contact.reaction, contact.sourceActorId, contact.frame, contact.eventPriority, contact.eventSequence, false,
        { ...noLinks(), parentDamageEventId: contact.triggerDamageEventIds[0] ?? null }, 1000000 + index);
    }
  }
  for (const health of result.playerHealthEvents ?? []) {
    const links = { ...noLinks(), playerHealthEventId: health.id };
    if (health.bondOfLife?.sourceEventEmitted) queue.push({ event: { kind: "bond-of-life-change", frame: health.frame, actorId: health.targetActorId, amount: health.bondOfLife.sourceCallbackAmount }, priority: health.eventPriority, sequence: health.eventSequence, slot: health.intraEventSequence, links });
    if (health.operation === "consume") queue.push({ event: { kind: "hp-drain", frame: health.frame, amount: health.requestedAmount }, priority: health.eventPriority, sequence: health.eventSequence, slot: health.intraEventSequence, links });
  }
  const reads = actualFullStatReadPoints(result);
  for (const read of reads) for (const actorId of read.owners) queue.push({ event: { kind: "stats-sample", frame: read.frame, actorId },
    priority: read.priority, sequence: read.eventSequence ?? (read.actionLogIndex === null ? undefined : actionSequence(read.actionLogIndex)),
    actionOrder: read.actionLogIndex ?? undefined, slot: -2, links: noLinks() });

  // Exact source ReactBonus call sites: attack creation, additive/amp reads,
  // periodic source refresh, and live core delivery. Cached periodic damage
  // does not itself create another read. No imported deletion grants a read.
  const addRead = (actorId: string, reaction: string, frame: number, priority: number, sequence: number | undefined, slot: number): void => {
    queue.push({ event: { kind: "react-bonus-read", actorId, reaction, frame }, priority, sequence, slot, links: noLinks() });
  };
  for (const damage of result.damageEvents) {
    const audit = damage.reactionAudit;
    if (audit.mechanicsTruncation !== null) continue;
    const offset = damage.targetIndex * 10000;
    const read = (reaction: string, slot: number) => addRead(damage.sourceActorId, reaction, damage.frame, damage.eventPriority, damage.eventSequence, offset + slot);
    if (audit.shatterReaction?.triggered && audit.shatterReaction.scheduled) read("shatter", -.5);
    if (audit.model !== "aura-engine") continue;
    if (audit.catalyzeReaction?.additive !== null && audit.catalyzeReaction?.additive !== undefined) read(audit.catalyzeReaction.additive.reaction, 400);
    if (["melt", "reverseMelt", "vaporize", "reverseVaporize"].includes(audit.reaction)) read(audit.reaction, 410);
    audit.swirlReactions.filter(row => row.scheduled).forEach((row, index) => read(row.reaction, 500 + index));
    if (audit.burningReaction !== null && audit.burningReaction.operation !== "stop") read("burning", 510);
    (audit.transformativeReactions ?? (audit.transformativeReaction === null ? [] : [audit.transformativeReaction]))
      .filter(row => row.scheduled).forEach((row, index) => read(row.reaction, 520 + index));
    if (audit.periodicReaction !== null && audit.periodicReaction.operation !== "stop") read("electroCharged", 530);
  }
  for (const reaction of result.reactionDamageLog) {
    if (!reaction.scheduleKind.startsWith("dendro-core-") || !reaction.scheduled || !reaction.withinSimulation) continue;
    const damage = result.damageEvents[reaction.damageEventIds[0]!];
    const resolution = result.hitResolutionLog[reaction.hitResolutionLogIds[0]!];
    // A no-target delivery still performs its source read before selecting
    // targets; an existing read tuple only supplies the opaque queue sequence.
    const emitted = imported.find(row => row.event.kind === "react-bonus-read" && row.event.actorId === reaction.sourceActorId && row.event.reaction === reaction.reaction && row.frame === reaction.damageFrame);
    addRead(reaction.sourceActorId, reaction.reaction, reaction.damageFrame,
      damage?.eventPriority ?? resolution?.eventPriority ?? 5,
      damage?.eventSequence ?? resolution?.eventSequence ?? emitted?.eventSequence, -10);
  }
  const used = new Set<number>();
  const sort = (a: Hook, b: Hook): number => a.event.frame - b.event.frame || a.priority - b.priority ||
    (a.actionOrder !== undefined && b.actionOrder !== undefined ? a.actionOrder - b.actionOrder : (a.sequence ?? -1) - (b.sequence ?? -1)) || a.slot - b.slot;
  const findImported = (hook: Hook, actorId: string): number => imported.findIndex((row, index) => !used.has(index) && row.actorId === actorId && same(row.event, hook.event) &&
    (hook.links.actionLogIndex === null || row.actionLogIndex === hook.links.actionLogIndex) &&
    (hook.links.parentDamageEventId === null || row.parentDamageEventId === hook.links.parentDamageEventId) &&
    (hook.links.playerHealthEventId === null || row.playerHealthEventId === hook.links.playerHealthEventId) &&
    (hook.links.reactionTaskLogId === null || row.reactionTaskLogId === hook.links.reactionTaskLogId) &&
    (hook.links.parentArtifactBuffLogId === null || row.parentArtifactBuffLogId === hook.links.parentArtifactBuffLogId));
  while (queue.length) {
    queue.sort(sort); const hook = queue.shift()!;
    if (hook.event.frame > Math.round(result.config.duration * 60)) continue;
    for (const actor of replay.state.actors) {
      const decision = replayArtifactBuffDecision(actor, hook.event, actor.state, partyIds, actor.sameElementCount, actor.differentElementCount);
      if (decision === undefined) continue;
      actor.state = decision.stateAfter;
      const index = findImported(hook, actor.actorId); const row = imported[index];
      if (row === undefined) issue(["artifactBuffLog"], `missing actual ${hook.event.kind} callback for ${actor.actorId} at ${hook.event.frame}f`);
      else {
        used.add(index);
        const { id: _id, frame: _frame, timeSeconds: _time, eventPriority: _priority, eventSequence: _sequence, intraEventSequence: _slot,
          actionLogIndex: _action, parentDamageEventId: _damage, playerHealthEventId: _health, reactionTaskLogId: _reactionTask, parentArtifactBuffLogId: _parent, trace: _trace, ...actual } = row;
        if (!same(actual, decision)) issue(["artifactBuffLog", index], "must match the independently replayed fixed-source state, applications and outcomes");
        if (row.id !== index || row.frame !== hook.event.frame || row.timeSeconds !== hook.event.frame / 60 || row.eventPriority !== hook.priority || hook.sequence !== undefined && row.eventSequence !== hook.sequence) issue(["artifactBuffLog", index], "artifact callback must retain its actual source event tuple");
        for (const key of ["actionLogIndex", "parentDamageEventId", "playerHealthEventId", "reactionTaskLogId", "parentArtifactBuffLogId"] as const) {
          // Full Stats reads may inherit their enclosing source link. Other
          // callbacks require exact, reciprocal source identity.
          if (hook.event.kind !== "stats-sample" && hook.event.kind !== "react-bonus-read" && row[key] !== hook.links[key]) issue(["artifactBuffLog", index, key], "must identify the actual source callback");
        }
        if ((decision.applications.length || decision.delayedApplications.length || !same(decision.stateBefore, decision.stateAfter)) && row.trace.length === 0) issue(["artifactBuffLog", index, "trace"], "executed artifact transitions require their actual formula trace");
      }
      replay.rows.push({ decision, hook, importedIndex: index });
      for (const task of decision.delayedApplications) queue.push({ event: { kind: "delayed-buff", frame: task.applyFrame, task }, priority: 2, slot: 0,
        sequence: imported.find(row => row.event.kind === "delayed-buff" && row.parentArtifactBuffLogId === index && row.event.task.receiverId === task.receiverId)?.eventSequence,
        links: { ...noLinks(), parentArtifactBuffLogId: index } });
    }
  }
  imported.forEach((_, index) => { if (!used.has(index)) issue(["artifactBuffLog", index], "has no independently established actual artifact callback"); });
  return replay;
}

/** Rebuild automatic modifiers at the sampling point, preserving replacement,
 * updates, deletions, half-open numeric windows and source action ordering. */
function rowReached(row: ReplayedRow, point: ArtifactBuffReplayPoint): boolean {
    const { hook } = row;
    if (hook.event.frame > point.frame || hook.event.frame === point.frame && hook.priority > point.priority) return false;
    if (hook.event.frame === point.frame && hook.priority === point.priority) {
      if (point.actionOrder !== undefined && hook.actionOrder !== undefined && hook.actionOrder > point.actionOrder) return false;
      if (point.eventSequence !== undefined && hook.sequence !== undefined) {
        if (hook.sequence > point.eventSequence) return false;
        if (hook.sequence === point.eventSequence && hook.event.kind === "reaction") {
          if (point.artifactStage !== "after-reaction") return false;
          if (point.parentDamageEventId !== undefined && hook.links.parentDamageEventId !== null && hook.links.parentDamageEventId > point.parentDamageEventId) return false;
        }
      } else if (hook.event.kind === "reaction" && point.artifactStage !== "after-reaction") return false;
    }
    return true;
}
export function artifactBuffsAt(result: SimulationResult, actorId: string, point: ArtifactBuffReplayPoint): ActiveStatusSnapshot[] {
  const active = new Map<string, ActiveStatusSnapshot>();
  for (const row of replayArtifactBuffs(result).rows) {
    const { decision } = row;
    if (!rowReached(row, point)) continue;
    for (const removal of decision.removals) if (removal.receiverId === actorId) for (const [key, buff] of active) if (buff.key === `${removal.key}:${actorId}`) active.delete(key);
    const replaces = new Set(decision.applications.filter(application => application.receiverId === actorId && application.operation === "replace").map(application => application.key));
    for (const semanticKey of replaces) for (const [key, buff] of active) if (buff.key === `${semanticKey}:${actorId}`) active.delete(key);
    for (const application of decision.applications) {
      if (application.receiverId !== actorId) continue;
      const identity = `${application.key}:${application.stat}`, existing = active.get(identity);
      if (application.operation === "update") { if (existing !== undefined) active.set(identity, { ...existing, value: application.value }); continue; }
      active.set(identity, { key: `${application.key}:${actorId}`, kind: "buff", sourceActorId: application.sourceActorId, targetId: actorId,
        stat: application.stat, value: application.value, startTimeSeconds: application.startFrame / 60, endTimeSeconds: application.expiresFrame / 60, label: application.key });
    }
  }
  return [...active.values()].filter(buff => buff.endTimeSeconds! > point.timeSeconds + 1e-9);
}

export function artifactReactionBonusAt(result: SimulationResult, actorId: string, reaction: string, point: ArtifactBuffReplayPoint): number {
  if (!result.config.artifactBuffModel?.actors.some(actor => actor.actorId === actorId && actor.effectId === "paradise-4pc") || !["bloom", "hyperbloom", "burgeon"].includes(reaction)) return 0;
  let state = createArtifactBuffState();
  for (const row of replayArtifactBuffs(result).rows) if (row.decision.actorId === actorId && rowReached(row, point)) state = row.decision.stateAfter;
  const stacks = state.effectExpiresFrame !== null && state.effectExpiresFrame > point.frame ? state.stacks : 0;
  return ARTIFACT_BUFF_SOURCE.paradise.baseReactionBonus + ARTIFACT_BUFF_SOURCE.paradise.reactionBonusPerStack * stacks;
}

export function validateArtifactBuffIntegrity(result: SimulationResult, context: RefinementCtx): void {
  const issue = (path: Array<string | number>, message: string) => context.addIssue({ code: "custom", path, message });
  if (result.config.artifactBuffModel === undefined) {
    if (result.artifactBuffLog !== undefined || result.artifactBuffState !== undefined) issue(["artifactBuffLog"], "artifact buff outputs require their explicit model");
    return;
  }
  const execution = result.resolvedRuntimeOptions.execution;
  if ((execution?.stellarConduct || execution?.stellarSwirl) && result.config.artifactBuffModel.actors.some(actor => actor.effectId === "instructor-4pc" || actor.effectId === "gilded-4pc")) {
    issue(["resolvedRuntimeOptions", "execution"], "Instructor and Gilded require Stellar reaction callback timing absent from this host");
  }
  if ((execution?.lunarBloom || execution?.lunarMixedV2) && result.config.artifactBuffModel.actors.some(actor => actor.effectId === "paradise-4pc")) {
    issue(["resolvedRuntimeOptions", "execution"], "Paradise requires its distinct Lunar Bloom reaction bonus");
  }
  if (result.artifactBuffLog === undefined || result.artifactBuffState === undefined) issue(["artifactBuffLog"], "artifact lifecycles require complete callback and final-state records");
  const replay = replayArtifactBuffs(result);
  for (const entry of replay.issues) issue(entry.path, entry.message);
  if (!same(result.artifactBuffState, replay.state)) issue(["artifactBuffState"], "must match the private state replayed from actual source events");
  let previous: ArtifactBuffLogEntry | undefined;
  for (const [index, row] of (result.artifactBuffLog ?? []).entries()) {
    if (previous && (row.frame < previous.frame || row.frame === previous.frame && (row.eventPriority < previous.eventPriority || row.eventPriority === previous.eventPriority && (row.eventSequence < previous.eventSequence || row.eventSequence === previous.eventSequence && row.intraEventSequence <= previous.intraEventSequence)))) issue(["artifactBuffLog", index], "actual callback tuples must be strictly ordered");
    previous = row;
  }
}
