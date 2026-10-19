import { actionEventPriority, actionOwner } from "./action-condition-integrity";
import { replayActualParticleReceives } from "./energy-replay-integrity";
import { ARTIFACT_EVENT_SOURCE_PROFILE as source, NIGHTSOUL_BURST_SOURCE_PROFILE as nightsoulSource } from "./artifact-event-source";
import type { ArtifactEffectId, ArtifactEventLogEntry, DamageEvent, NightsoulBurstLogEntry, SimulationResult } from "./types";

export interface ArtifactParticleReceive {
  particleEventId: number;
  frame: number;
  timeSeconds: number;
  priority: number;
  order: number;
  activeCharacterId: string | null;
  creationFrame: number;
  creationPriority: number;
  creationOrder: number;
}
export interface ArtifactExpectedEnergyGrant {
  artifactEventLogId: number;
  actorId: string;
  sourceActionId: string;
  source: string;
  frame: number;
  timeSeconds: number;
  eventPriority: number;
  creationFrame: number;
  creationPriority: number;
  creationOrder: number;
  gainOrder: number;
  receivers: Array<{ receiverId: string; amount: number }>;
  afterParticleEventId: number | null;
  afterDamageEventId: number | null;
}
export interface ReplayedArtifactEvent {
  expected: Omit<ArtifactEventLogEntry, "eventSequence" | "energyLogIds" | "skillCooldownLogId">;
  knownEventSequence: number | null;
  gains: Array<{ receiverId: string; amount: number }>;
  parentDamageEventId: number | null;
  deferredAfterSequence?: number;
}
export interface ReplayedNightsoulBurst {
  expected: Omit<NightsoulBurstLogEntry, "eventSequence">;
  parent: DamageEvent;
  deferredAfterSequence: number;
}

/** Follow the authenticated damage ancestry to its actual accepted input.
 * Weapon-generated hits retain their own identity rather than borrowing E/Q fields. */
export function artifactDamageCommandIndex(result: SimulationResult, damage: DamageEvent): number | undefined {
  let current: DamageEvent | undefined = damage;
  for (let depth = 0; current !== undefined && depth <= result.damageEvents.length; depth++) {
    if (current.timelineCommandIndex !== undefined) return current.timelineCommandIndex;
    const action = result.actionLog.find(row => row.actionId === current!.actionId && row.cycle === current!.cycle);
    if (action?.timelineCommandIndex !== undefined) return action.timelineCommandIndex;
    const parentId: number | null | undefined = current.parentDamageEventId ??
      (current.weaponProcLogId === undefined ? undefined : result.weaponProcLog?.[current.weaponProcLogId]?.parentDamageEventId);
    if (parentId === undefined || parentId === null) return undefined;
    current = result.damageEvents[parentId];
  }
  return undefined;
}

type Point = { frame: number; priority: number; creationFrame: number; creationPriority: number; creationOrder: number; slot: number; knownSequence: number | null };
type ReplayEvent = Point & (
  | { kind: "action"; actorId: string; actionLogIndex: number | null; actionId: string }
  | { kind: "particle"; receive: ArtifactParticleReceive }
  | { kind: "death"; parent: DamageEvent; targetHealthLogId: number }
  | { kind: "nightsoul"; parent: DamageEvent }
  | { kind: "tick"; actorId: string; receiverId: string; actionId: string; parentArtifactEventLogId: number; tickIndex: number }
);

/** Source callbacks are reconstructed from accepted actions, authenticated
 * particle receives and actual damage. Imported artifact rows never activate effects. */
export function replayArtifactEvents(result: SimulationResult, particleReceives?: ArtifactParticleReceive[], beforeCommandIndex = Infinity): {
  attempts: ReplayedArtifactEvent[]; nightsoul: ReplayedNightsoulBurst[]; energyGrants: ArtifactExpectedEnergyGrant[];
} {
  const attempts: ReplayedArtifactEvent[] = [];
  const nightsoul: ReplayedNightsoulBurst[] = [];
  const energyGrants: ArtifactExpectedEnergyGrant[] = [];
  const model = result.config.artifactEventModel;
  const nightModel = result.config.nightsoulBurstModel;
  if (model === undefined && nightModel === undefined) return { attempts, nightsoul, energyGrants };
  const actors = model?.actors ?? [];
  const partyIds = result.config.characters.map(actor => actor.id);
  const queue: ReplayEvent[] = [];
  const included = (index: number | undefined) => beforeCommandIndex === Infinity || index !== undefined && index < beforeCommandIndex;
  for (const [actionLogIndex, action] of result.actionLog.entries()) {
    if (!included(action.timelineCommandIndex)) continue;
    const priority = actionEventPriority(actionOwner(result.config, action));
    const anchor = result.energyCostLog?.find(row => row.actionLogIndex === actionLogIndex && row.operation === "reserve")
      ?? result.actionConditionLog?.find(row => row.actionLogIndex === actionLogIndex)
      ?? result.statConversionLog?.find(row => row.actionLogIndex === actionLogIndex);
    queue.push({ kind: "action", actorId: action.actorId, actionLogIndex, actionId: action.actionId,
      frame: action.frame, priority, creationFrame: -1, creationPriority: 0,
      creationOrder: action.timelineCommandIndex!, slot: 0, knownSequence: anchor?.eventSequence ?? null });
  }
  for (const action of result.skippedActions) {
    if (!included(action.timelineCommandIndex)) continue;
    queue.push({ kind: "action", actorId: action.actorId, actionLogIndex: null, actionId: action.actionId,
      frame: action.frame, priority: actionEventPriority(actionOwner(result.config, action)),
      creationFrame: -1, creationPriority: 0, creationOrder: action.timelineCommandIndex!, slot: 0, knownSequence: null });
  }
  if (actors.some(actor => actor.effectId === "scholar-4pc")) {
    for (const receive of particleReceives ?? replayActualParticleReceives(result)) {
      const particle = result.particleEvents[receive.particleEventId]!;
      const action = result.actionLog.find(row => row.actionId === particle.sourceActionId && row.cycle === particle.cycle);
      const originDamage = particle.origin?.damageEventId === null || particle.origin?.damageEventId === undefined
        ? undefined : result.damageEvents[particle.origin.damageEventId];
      if (beforeCommandIndex !== Infinity && particle.origin?.kind !== "external" &&
          !included(action?.timelineCommandIndex ?? (originDamage === undefined ? undefined : artifactDamageCommandIndex(result, originDamage)))) continue;
      queue.push({ kind: "particle", receive, frame: receive.frame, priority: receive.priority,
        creationFrame: receive.creationFrame, creationPriority: receive.creationPriority,
        creationOrder: receive.creationOrder, slot: 0, knownSequence: null });
    }
  }
  const hp = new Map(result.config.targetHealthModel?.targets.map(target => [target.targetId, target.initialHp]) ?? []);
  let healthLogId = 0;
  for (const parent of result.damageEvents) {
    if (!included(artifactDamageCommandIndex(result, parent))) continue;
    const before = hp.get(parent.targetId);
    if (before !== undefined) {
      const after = before - Math.min(before, parent.finalDamage);
      hp.set(parent.targetId, after);
      if (before > 0 && after === 0) queue.push({ kind: "death", parent, targetHealthLogId: healthLogId,
        frame: parent.frame, priority: parent.eventPriority, creationFrame: -1, creationPriority: 0,
        creationOrder: parent.eventSequence, slot: parent.id, knownSequence: parent.eventSequence });
      healthLogId++;
    }
    if (nightModel !== undefined && parent.element !== "physical" && parent.mechanicsStatus !== "mechanics-truncated" && parent.reactionAudit.mechanicsTruncation === null) {
      queue.push({ kind: "nightsoul", parent, frame: parent.frame, priority: parent.eventPriority,
        creationFrame: parent.frame, creationPriority: parent.eventPriority,
        creationOrder: parent.eventSequence, slot: parent.id, knownSequence: null });
    }
  }
  const phaseLastDamage = new Map<string, number>();
  for (const damage of result.damageEvents) {
    const key = `${damage.frame}:${damage.eventPriority}`;
    phaseLastDamage.set(key, Math.max(phaseLastDamage.get(key) ?? -1, damage.eventSequence));
  }
  const cooldowns = new Map<string, number>();
  const exileRecipients = new Map<string, number>();
  let nightExpiry: number | null = null;
  let activeCharacterId: string | null = result.config.timeline?.initialActiveCharacterId ?? result.config.characters[0]?.id ?? null;
  const durationFrames = Math.round(result.config.duration * 60);
  const emit = (event: ReplayEvent, actorId: string, effectId: ArtifactEffectId,
    fields: Partial<ReplayedArtifactEvent["expected"]>, gains: ReplayedArtifactEvent["gains"] = []): ReplayedArtifactEvent => {
    const expiry = cooldowns.get(`${effectId}:${actorId}`) ?? null;
    const expected: ReplayedArtifactEvent["expected"] = {
      id: attempts.length, sourceProfileId: source.id, sourceRef: source.sourceRefs[effectId], actorId, effectId,
      frame: event.frame, timeSeconds: event.frame / 60, eventPriority: event.priority,
      kind: "burst", sourceActionId: null, actionLogIndex: null, particleEventId: null, targetHealthLogId: null,
      nightsoulBurstLogId: null, activeCharacterId, outcome: "activated",
      cooldownExpiresFrameBefore: expiry, cooldownExpiresFrameAfter: expiry, exileRecipients: [],
      parentArtifactEventLogId: null, receiverId: null, tickIndex: null, ...fields,
    };
    const replay: ReplayedArtifactEvent = { expected, knownEventSequence: event.knownSequence, gains,
      parentDamageEventId: event.kind === "death" || event.kind === "nightsoul" ? event.parent.id : null,
      ...(event.kind === "nightsoul" ? { deferredAfterSequence: phaseLastDamage.get(`${event.frame}:${event.priority}`)! } : {}) };
    attempts.push(replay);
    if (gains.length > 0) energyGrants.push({ artifactEventLogId: expected.id, actorId, sourceActionId: expected.sourceActionId!,
      source: `artifact:${effectId}`, frame: event.frame, timeSeconds: event.frame / 60, eventPriority: event.priority,
      creationFrame: event.creationFrame, creationPriority: event.creationPriority, creationOrder: event.creationOrder,
      gainOrder: event.slot, receivers: gains, afterParticleEventId: event.kind === "particle" ? event.receive.particleEventId : null,
      afterDamageEventId: event.kind === "nightsoul" ? event.parent.id : null });
    return replay;
  };
  while (queue.length > 0) {
    queue.sort((a, b) => a.frame - b.frame || a.priority - b.priority ||
      a.creationFrame - b.creationFrame || a.creationPriority - b.creationPriority ||
      a.creationOrder - b.creationOrder || a.slot - b.slot);
    const event = queue.shift()!;
    if (event.frame > durationFrames) continue;
    if (event.kind === "action") {
      activeCharacterId = event.actorId;
      if (event.actionLogIndex === null) continue;
      const action = result.actionLog[event.actionLogIndex]!;
      const owner = actionOwner(result.config, action);
      if (owner === undefined || !("kind" in owner) || owner.kind !== "burst") continue;
      for (const actor of actors.filter(actor => actor.effectId === "exile-4pc")) {
        const outcome = activeCharacterId !== actor.actorId ? "off-field"
          : [...exileRecipients.values()].some(expiry => expiry >= event.frame) ? "party-effect-active" : "activated";
        const recipients = outcome === "activated" ? partyIds.filter(id => id !== actor.actorId)
          .map(actorId => ({ actorId, expiresFrame: event.frame + source.exile.durationFrames })) : [];
        const row = emit(event, actor.actorId, actor.effectId, { kind: "burst", sourceActionId: event.actionId,
          actionLogIndex: event.actionLogIndex, outcome, exileRecipients: recipients });
        for (const [recipientIndex, recipient] of recipients.entries()) {
          exileRecipients.set(recipient.actorId, recipient.expiresFrame);
          for (const [index, delay] of source.exile.tickFrames.entries()) queue.push({ kind: "tick", actorId: actor.actorId,
            receiverId: recipient.actorId, actionId: event.actionId, parentArtifactEventLogId: row.expected.id, tickIndex: index + 1,
            frame: event.frame + delay, priority: 2, creationFrame: event.frame, creationPriority: event.priority,
            creationOrder: event.creationOrder, slot: -100 + recipientIndex * 3 + index, knownSequence: null });
        }
      }
    } else if (event.kind === "tick") {
      emit(event, event.actorId, "exile-4pc", { kind: "exile-tick", sourceActionId: event.actionId,
        parentArtifactEventLogId: event.parentArtifactEventLogId, receiverId: event.receiverId,
        tickIndex: event.tickIndex, outcome: "energy-granted" }, [{ receiverId: event.receiverId, amount: source.exile.energy }]);
    } else if (event.kind === "particle") {
      for (const actor of actors.filter(actor => actor.effectId === "scholar-4pc")) {
        const key = `${actor.effectId}:${actor.actorId}`;
        const before = cooldowns.get(key) ?? null;
        const outcome = activeCharacterId !== actor.actorId ? "off-field" : before !== null && before >= event.frame ? "cooldown-blocked" : "energy-granted";
        const after = outcome === "energy-granted" ? event.frame + source.scholar.cooldownFrames : before;
        const gains = outcome === "energy-granted" ? partyIds.filter(actorId => {
          const type = model?.partyWeaponTypes?.find(entry => entry.actorId === actorId)?.weaponType;
          return type === "bow" || type === "catalyst";
        }).map(receiverId => ({ receiverId, amount: source.scholar.energy })) : [];
        emit(event, actor.actorId, actor.effectId, { kind: "particle-received",
          sourceActionId: result.particleEvents[event.receive.particleEventId]!.sourceActionId,
          particleEventId: event.receive.particleEventId, outcome, cooldownExpiresFrameAfter: after }, gains);
        if (after !== null) cooldowns.set(key, after);
      }
    } else if (event.kind === "death") {
      for (const actor of actors.filter(actor => actor.effectId === "gambler-4pc")) {
        const key = `${actor.effectId}:${actor.actorId}`;
        const before = cooldowns.get(key) ?? null;
        const outcome = before !== null && before >= event.frame ? "cooldown-blocked"
          : event.parent.sourceActorId !== actor.actorId ? "wrong-killer"
            : activeCharacterId !== actor.actorId ? "off-field" : "skill-reset";
        const after = outcome === "skill-reset" ? event.frame + source.gambler.cooldownFrames : before;
        emit(event, actor.actorId, actor.effectId, { kind: "target-died", sourceActionId: event.parent.actionId,
          targetHealthLogId: event.targetHealthLogId, outcome, cooldownExpiresFrameAfter: after });
        if (after !== null) cooldowns.set(key, after);
      }
    } else {
      const cooldownFrames = nightsoulSource.cooldownFramesByNatlanCount[nightModel!.natlanActorIds.length]!;
      const before = nightExpiry;
      const outcome = before !== null && before > event.frame ? "cooldown-blocked" : "triggered";
      if (outcome === "triggered") nightExpiry = event.frame + cooldownFrames;
      const id = nightsoul.length;
      nightsoul.push({ parent: event.parent, deferredAfterSequence: phaseLastDamage.get(`${event.frame}:${event.priority}`)!, expected: {
        id, sourceProfileId: nightsoulSource.id, sourceRef: nightsoulSource.sourceRef, frame: event.frame,
        timeSeconds: event.frame / 60, eventPriority: event.priority, parentDamageEventId: event.parent.id,
        sourceActorId: event.parent.sourceActorId, targetId: event.parent.targetId, activeCharacterId,
        natlanActorIds: [...nightModel!.natlanActorIds], cooldownFrames,
        cooldownExpiresFrameBefore: before, cooldownExpiresFrameAfter: nightExpiry, outcome,
      } });
      if (outcome === "triggered") for (const actor of actors.filter(actor => actor.effectId === "scroll-2pc")) {
        emit(event, actor.actorId, actor.effectId, { kind: "nightsoul-burst", sourceActionId: event.parent.actionId,
          nightsoulBurstLogId: id, outcome: "energy-granted" }, [{ receiverId: actor.actorId, amount: source.scroll.energy }]);
      }
    }
  }
  return { attempts, nightsoul, energyGrants };
}
