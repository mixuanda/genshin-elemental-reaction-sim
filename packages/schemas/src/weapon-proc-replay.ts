import { createWeaponProcLifecycleState, stepWeaponProcLifecycle, getWeaponProcCoefficient, getWeaponProcCooldownFrames, getWeaponProcDefinition, getWeaponProcTriggerProbability, resolveEyeOfPerceptionDefinition, type WeaponProcLifecycleState } from "@genshin-dps-lab/reaction-formulas";
import { actionEventPriority, actionOwner } from "./action-condition-integrity";
import { EnergyReplayRandom, replayActualParticleReceives } from "./energy-replay-integrity";
import { weaponProcTriggerAuraAtPhaseEnd } from "./weapon-proc-aura-replay";
import type { ActionDefinition, DamageEvent, HitDefinition, SimulationResult, WeaponProcLifecycleLogEntry, WeaponProcLogEntry } from "./types";

export interface ReplayedWeaponProcOccurrence {
  logId: number;
  parent: DamageEvent;
  action: ActionDefinition;
  hit: HitDefinition;
  frame: number;
  snapshotFrame: number;
  snapshotTimeSeconds: number;
  snapshotPriority: number;
  snapshotTaken: boolean;
  snapshotEventSequence?: number;
  actorId: string;
  actionId: string;
  hitId: string;
  cycle: number;
  origin: { x: number; y: number } | null;
  radius: number | null;
  /** New random callbacks execute after their source hit phase's queued hits. */
  callbackEventSequence?: number;
}

export interface ReplayedWeaponProcAttempt {
  parent: DamageEvent;
  expected: Omit<WeaponProcLogEntry, "triggerSnapshot" | "triggerBuffStatuses" | "damageEventIds" | "hitResolutionIds">;
  occurrence?: ReplayedWeaponProcOccurrence;
  occurrences: ReplayedWeaponProcOccurrence[];
  deferredCallback?: { afterEventSequence: number; beforeEventSequence?: number };
}

function targetPosition(result: SimulationResult, targetId: string, frame: number): { x: number; y: number } | null {
  let position = result.config.enemy.targets?.find(target => target.id === targetId)?.position;
  if (position === undefined) return null;
  for (const motion of result.config.enemy.targetMotions ?? []) {
    if (motion.targetId !== targetId) continue;
    if (frame < motion.startFrame) break;
    if (frame >= motion.endFrame) { position = motion.endPosition; continue; }
    const fraction = (frame - motion.startFrame) / (motion.endFrame - motion.startFrame);
    return { x: position.x + (motion.endPosition.x - position.x) * fraction,
      y: position.y + (motion.endPosition.y - position.y) * fraction };
  }
  return { ...position };
}

function configuredHit(result: SimulationResult, parent: DamageEvent, procs: Map<string, ReplayedWeaponProcOccurrence>): HitDefinition | undefined {
  const proc = procs.get(parent.actionId);
  if (proc !== undefined || parent.weaponProcLogId !== undefined) return proc !== undefined && parent.weaponProcLogId === proc.logId &&
    parent.sourceActorId === proc.actorId && parent.cycle === proc.cycle && parent.frame === proc.frame &&
    parent.hitId === proc.hitId && parent.hitGroupId === `${proc.actionId}:${proc.cycle}:0:${proc.frame}` ? proc.hit : undefined;
  const prefix = `${parent.actionId}:${parent.cycle}:`;
  const suffix = `:${parent.frame}`;
  const index = parent.hitGroupId.startsWith(prefix) && parent.hitGroupId.endsWith(suffix)
    ? parent.hitGroupId.slice(prefix.length, -suffix.length) : "";
  if (!/^(0|[1-9]\d*)$/.test(index)) return undefined;
  const owner = parent.sourceAbilityId === undefined
    ? result.config.rotation.find(action => action.id === parent.actionId && action.actorId === parent.sourceActorId)
    : result.config.timeline?.abilities.find(action => action.id === parent.sourceAbilityId && action.actorId === parent.sourceActorId);
  const hit = owner?.hits?.[Number(index)];
  return hit !== undefined && (hit.id ?? `${parent.actionId}:hit-${index}`) === parent.hitId ? hit as HitDefinition : undefined;
}

export interface ReplayedWeaponProcLifecycle {
  expected: Omit<WeaponProcLifecycleLogEntry, "eventSequence">;
  /** Only a captured independent action event can authenticate an absolute heap ID. */
  knownEventSequence: number | null;
}
export interface WeaponProcReplay {
  attempts: ReplayedWeaponProcAttempt[];
  lifecycle: ReplayedWeaponProcLifecycle[];
}

/** Independent source/cooldown replay. Output log rows never activate a window or create a proc. */
export function replayWeaponProcs(result: SimulationResult): WeaponProcReplay {
  const actors = new Map(result.config.weaponProcModel?.actors.filter(actor => actor.weaponId !== "swordofnarzissenkreuz" || actor.hasInnateArkhe === false).map(actor => [actor.actorId, actor]) ?? []);
  if (actors.size === 0) return { attempts: [], lifecycle: [] };
  const actorDefinition = (actor: NonNullable<SimulationResult["config"]["weaponProcModel"]>["actors"][number]) =>
    resolveEyeOfPerceptionDefinition(getWeaponProcDefinition(actor.weaponId)!, actor.eyeOfPerceptionProfile);
  const eyeBounceMarks = new Map<string, Array<{ start: number; end: number }>>();
  const eyeEligibleTarget = (center: { x: number; y: number }, frame: number, eventSequence: number): string | null => {
    let nearest: { id: string; distance: number } | null = null;
    for (const target of result.config.enemy.targets ?? []) {
      const declaredHealth = result.config.targetHealthModel?.targets.find(row => row.targetId === target.id);
      const healthRows = result.targetHealthLog?.filter(row => row.targetId === target.id &&
        (row.frame < frame || row.frame === frame && row.eventSequence <= eventSequence)) ?? [];
      if ((healthRows.at(-1)?.hpAfter ?? declaredHealth?.initialHp ?? 1) <= 0) continue;
      if (eyeBounceMarks.get(target.id)?.some(mark => mark.start <= frame && frame <= mark.end)) continue;
      const position = targetPosition(result, target.id, frame);
      if (position === null) continue;
      const distance = (position.x - center.x) ** 2 + (position.y - center.y) ** 2;
      if (distance <= (8 + (target.hitboxRadius ?? 0)) ** 2 && (nearest === null || distance < nearest.distance)) nearest = { id: target.id, distance };
    }
    return nearest?.id ?? null;
  };
  const markEyeTarget = (targetId: string, frame: number): void => {
    eyeBounceMarks.set(targetId, [...(eyeBounceMarks.get(targetId) ?? []), { start: frame, end: frame + 36 }]);
  };
  // Energy-rejected actions still reached the runtime action callback and change
  // its active actor. Both accepted and skipped actions are authenticated by the
  // existing timeline/energy replay before these callbacks are trusted.
  const actions = [...result.actionLog, ...result.skippedActions].map(action => ({
    actorId: action.actorId, frame: action.frame, timeSeconds: action.time,
    priority: actionEventPriority(actionOwner(result.config, action)), cycle: action.cycle,
    order: action.timelineCommandIndex ?? result.config.rotation.findIndex(owner => owner.id === action.actionId && owner.actorId === action.actorId)
  })).sort((a, b) => a.timeSeconds - b.timeSeconds || a.priority - b.priority || a.cycle - b.cycle || a.order - b.order);
  let activeCharacterId = result.config.timeline?.initialActiveCharacterId ?? result.config.characters[0]?.id ?? null;
  let actionIndex = 0;
  const ready = new Map<string, number>();
  const states = new Map<string, WeaponProcLifecycleState>();
  for (const actor of actors.values()) if (actorDefinition(actor).lifecycleKind !== undefined) states.set(actor.actorId, createWeaponProcLifecycleState());
  const lifecycle: ReplayedWeaponProcLifecycle[] = [];
  type LifecycleInput = { kind: "skill" | "particle-received"; frame: number; timeSeconds: number; priority: number; order: number;
    actionLogIndex: number | null; particleEventId: number | null; activeCharacterId: string | null; knownEventSequence: number | null };
  const lifecycleInputs: LifecycleInput[] = [];
  if ([...actors.values()].some(actor => ["debateclub", "endoftheline"].includes(actor.weaponId))) {
    result.actionLog.forEach((action, actionLogIndex) => {
      const owner = actionOwner(result.config, action);
      if (owner === undefined || !("kind" in owner) || owner.kind !== "skill") return;
      const anchor = result.energyCostLog?.find(row => row.actionLogIndex === actionLogIndex && row.operation === "reserve")
        ?? result.actionConditionLog?.find(row => row.actionLogIndex === actionLogIndex)
        ?? result.statConversionLog?.find(row => row.actionLogIndex === actionLogIndex);
      lifecycleInputs.push({ kind: "skill", frame: action.frame, timeSeconds: action.time, priority: actionEventPriority(owner),
        order: action.timelineCommandIndex!, actionLogIndex, particleEventId: null, activeCharacterId: action.actorId,
        knownEventSequence: anchor?.eventSequence ?? null });
    });
  }
  if ([...actors.values()].some(actor => actor.weaponId === "crescentpike")) for (const receive of replayActualParticleReceives(result)) {
    lifecycleInputs.push({ ...receive, kind: "particle-received", actionLogIndex: null, knownEventSequence: null });
  }
  lifecycleInputs.sort((a, b) => a.timeSeconds - b.timeSeconds || a.priority - b.priority || a.order - b.order);
  let lifecycleIndex = 0;
  const consumeLifecycleThrough = (time: number, priority: number): void => {
    while (lifecycleIndex < lifecycleInputs.length) {
      const input = lifecycleInputs[lifecycleIndex]!;
      if (input.timeSeconds > time + 1e-9 || Math.abs(input.timeSeconds - time) <= 1e-9 && input.priority > priority) break;
      lifecycleIndex++;
      for (const actor of actors.values()) {
        if (!(input.kind === "skill" ? ["debateclub", "endoftheline"].includes(actor.weaponId) : actor.weaponId === "crescentpike")) continue;
        const definition = actorDefinition(actor);
        const stateBefore = states.get(actor.actorId)!;
        const next = stepWeaponProcLifecycle(definition.lifecycleKind!, stateBefore,
          { kind: input.kind, frame: input.frame, holderOnField: input.activeCharacterId === actor.actorId });
        states.set(actor.actorId, next.state);
        lifecycle.push({ knownEventSequence: input.knownEventSequence, expected: {
          id: lifecycle.length, sourceProfileId: "gcsim-stateful-weapon-proc-v1", sourceRef: definition.sourceRef,
          actorId: actor.actorId, weaponId: definition.lifecycleKind!, refinement: actor.refinement,
          frame: input.frame, timeSeconds: input.timeSeconds, eventPriority: input.priority, kind: input.kind,
          actionLogIndex: input.actionLogIndex, particleEventId: input.particleEventId, activeCharacterId: input.activeCharacterId,
          outcome: next.outcome as WeaponProcLifecycleLogEntry["outcome"], stateBefore, stateAfter: next.state,
        } });
      }
    }
  };
  const procs = new Map<string, ReplayedWeaponProcOccurrence>();
  const attempts: ReplayedWeaponProcAttempt[] = [];
  const eyeAdvancedActions = new Set<string>();
  const appendEyeOccurrence = (attempt: ReplayedWeaponProcAttempt, selected: string, selectionFrame: number, index: number): void => {
    const origin = targetPosition(result, selected, selectionFrame);
    if (origin === null) return;
    const actor = actors.get(attempt.expected.actorId)!;
    const actionId = index === 0 ? attempt.expected.procActionId! : `${attempt.expected.procActionId}:bounce-${index}`;
    const hitId = `${actionId}:hit`;
    const hit: HitDefinition = { id: hitId, label: "昭心追击", offset: 10 / 60,
      scaling: attempt.expected.coefficient, scalingStat: "atk", element: "physical", attackTag: "proc", snapshot: "action",
      dmgBonus: actor.physicalDamageBonus, geometry: { kind: "circle", coordinateSpace: "world", origin, radius: .6 } };
    const action: ActionDefinition = { id: actionId, actorId: actor.actorId, name: "昭心追击",
      at: selectionFrame / 60, once: true, hits: [hit] };
    markEyeTarget(selected, selectionFrame);
    const occurrence: ReplayedWeaponProcOccurrence = { logId: attempt.expected.id, parent: attempt.parent, action, hit,
      frame: selectionFrame + 10, snapshotFrame: attempt.parent.frame, snapshotTimeSeconds: attempt.parent.timeSeconds,
      snapshotPriority: attempt.parent.eventPriority, snapshotTaken: true, actorId: actor.actorId,
      actionId, hitId, cycle: attempt.parent.cycle, origin, radius: .6 };
    attempt.occurrences.push(occurrence);
    if (index === 0) attempt.occurrence = occurrence;
    procs.set(actionId, occurrence);
  };
  const random = new EnergyReplayRandom(`${result.resolvedRuntimeOptions.randomSeed}\u0000independent-weapon-proc-v1`);
  let drawCount = 0;
  const callbackSequences = new Map((result.weaponProcLog ?? []).map(row => [row.parentDamageEventId, row.eventSequence]));
  const snapshotSequences = new Map((result.weaponProcLog ?? []).map(row => [row.parentDamageEventId, row.snapshotEventSequence]));
  const callbacks = result.damageEvents.filter(parent => parent.kind === "direct" && actors.has(parent.sourceActorId) &&
    parent.mechanicsStatus !== "mechanics-truncated" && parent.reactionAudit.mechanicsTruncation === null);
  const deferred = (parent: DamageEvent): boolean => {
    const definition = actorDefinition(actors.get(parent.sourceActorId)!);
    return definition.randomTrigger !== undefined || definition.lifecycleKind !== undefined || definition.requiresWeakPoint === true;
  };
  if ([...actors.values()].some(actor => { const definition = actorDefinition(actor); return definition.randomTrigger !== undefined || definition.lifecycleKind !== undefined || definition.requiresWeakPoint === true; })) {
    // Absolute callback IDs include unrelated heap work. Their captured ordering
    // is constrained by independent parent FIFO and task enqueue provenance below;
    // only actual direct damage parents can create replay attempts.
    callbacks.sort((a, b) => a.timeSeconds - b.timeSeconds || a.eventPriority - b.eventPriority ||
      (deferred(a) ? callbackSequences.get(a.id) ?? -1 : a.eventSequence) -
      (deferred(b) ? callbackSequences.get(b.id) ?? -1 : b.eventSequence) || a.id - b.id);
  }
  for (const parent of callbacks) {
    const chain = parent.weaponProcLogId === undefined ? undefined : attempts[parent.weaponProcLogId];
    if (chain?.expected.weaponId === "eyeofperception" && !eyeAdvancedActions.has(parent.actionId)) {
      eyeAdvancedActions.add(parent.actionId);
      const index = Number(/:bounce-(\d+)$/.exec(parent.actionId)?.[1] ?? 0);
      const center = targetPosition(result, parent.targetId, parent.frame);
      const selected = index >= 4 || center === null ? null : eyeEligibleTarget(center, parent.frame, parent.eventSequence);
      if (selected !== null) appendEyeOccurrence(chain, selected, parent.frame, index + 1);
    }
    consumeLifecycleThrough(parent.timeSeconds, parent.eventPriority);
    const actor = actors.get(parent.sourceActorId);
    if (parent.kind !== "direct" || actor === undefined || parent.mechanicsStatus === "mechanics-truncated" || parent.reactionAudit.mechanicsTruncation !== null) continue;
    while (actionIndex < actions.length) {
      const action = actions[actionIndex]!;
      if (action.timeSeconds > parent.timeSeconds + 1e-9 || Math.abs(action.timeSeconds - parent.timeSeconds) <= 1e-9 && action.priority > parent.eventPriority) break;
      activeCharacterId = action.actorId; actionIndex++;
    }
    const definition = actorDefinition(actor);
    const hit = configuredHit(result, parent, procs);
    const attackTag = hit?.attackTag ?? null;
    const stateBefore = states.get(actor.actorId);
    const before = stateBefore === undefined ? ready.get(actor.actorId) ?? null : stateBefore.hitCooldownExpiresFrame;
    let stateAfter: WeaponProcLifecycleState | undefined;
    let outcome: WeaponProcLogEntry["outcome"];
    let randomAudit: WeaponProcLogEntry["random"];
    let triggerAura: WeaponProcLogEntry["triggerAura"];
    let coefficient = definition.coefficients[actor.refinement - 1]!;
    if (definition.lifecycleKind !== undefined) {
      const next = stepWeaponProcLifecycle(definition.lifecycleKind, stateBefore!, { kind: "damage", frame: parent.frame,
        holderOnField: activeCharacterId === actor.actorId, isHolderDamage: true, attackTag, damage: parent.finalDamage });
      outcome = next.outcome as WeaponProcLogEntry["outcome"];
      stateAfter = next.state;
      states.set(actor.actorId, stateAfter);
    } else if (definition.requiresWeakPoint === true) {
      outcome = activeCharacterId !== actor.actorId ? "off-field" : hit?.hitWeakPoint !== true ? "not-weak-point"
        : before !== null && parent.frame <= before ? "cooldown-blocked" : "triggered";
    } else if (actor.weaponId === "swordofnarzissenkreuz") {
      outcome = activeCharacterId !== actor.actorId ? "off-field"
        : !definition.triggerAttackTags!.some(tag => tag === attackTag) ? "wrong-attack-tag"
          : before !== null && parent.frame <= before ? "cooldown-blocked" : "triggered";
    } else if (definition.randomTrigger === undefined) {
      outcome = definition.triggerAttackTags !== null && !definition.triggerAttackTags.some(tag => tag === attackTag)
        ? "wrong-attack-tag" : definition.requiresOnField && activeCharacterId !== actor.actorId ? "off-field"
          : before !== null && parent.frame <= before ? "cooldown-blocked" : "triggered";
    } else {
      const probability = getWeaponProcTriggerProbability(definition, actor.refinement)!;
      const drawCountBefore = drawCount;
      let roll: number | null = null;
      let drawIndex: number | null = null;
      if (definition.cryoOrFrozenCoefficients !== undefined) triggerAura = null;
      // Viridescent checks tags before its ICD; the older random sources check the ICD first.
      const wrongAttackTag = definition.triggerAttackTags !== null && !definition.triggerAttackTags.some(tag => tag === attackTag);
      if (activeCharacterId !== actor.actorId) outcome = "off-field";
      else if (actor.weaponId === "theviridescenthunt" && wrongAttackTag) outcome = "wrong-attack-tag";
      else if (before !== null && parent.frame <= before) outcome = "cooldown-blocked";
      else if (wrongAttackTag) outcome = "wrong-attack-tag";
      else {
        drawIndex = drawCount++;
        roll = random.next();
        const success = definition.randomTrigger.successComparison === "<=" ? roll <= probability : roll < probability;
        outcome = !success ? "failed-roll" : definition.randomTrigger.zeroDamageGate === "after-roll" && parent.finalDamage === 0 ? "zero-damage" : "triggered";
        if (outcome === "triggered" && definition.cryoOrFrozenCoefficients !== undefined) {
          triggerAura = weaponProcTriggerAuraAtPhaseEnd(result, parent);
          coefficient = getWeaponProcCoefficient(definition, actor.refinement, triggerAura.cryo || triggerAura.frozen);
        }
      }
      randomAudit = { rngStream: "independent-weapon-proc-v1", probability, successComparison: definition.randomTrigger.successComparison,
        roll, drawIndex, drawCountBefore, drawCountAfter: drawCount };
    }
    const id = attempts.length;
    const triggered = outcome === "triggered";
    const cooldownFrames = getWeaponProcCooldownFrames(definition, actor.refinement);
    if (triggered && stateAfter === undefined) ready.set(actor.actorId, parent.frame + cooldownFrames);
    const actionId = `weapon-proc:${actor.actorId}:${id}`;
    const hitId = `${actionId}:hit`;
    const deliverySnapshot = definition.snapshotTiming === "delivery";
    const snapshotFrame = parent.frame + (deliverySnapshot ? definition.damageDelayFrames : 0);
    const snapshotTimeSeconds = deliverySnapshot ? snapshotFrame / 60 : parent.timeSeconds;
    const snapshotPriority = deliverySnapshot ? 3 : parent.eventPriority;
    const eyePose = actor.weaponId === "eyeofperception" && triggered
      ? result.config.actorPoses?.find(row => row.actorId === activeCharacterId) : undefined;
    const firstEyeTarget = eyePose === undefined ? null : eyeEligibleTarget(eyePose.position, parent.frame, parent.eventSequence);
    const hasScheduledAttack = triggered && (actor.weaponId !== "eyeofperception" || firstEyeTarget !== null);
    const snapshotTaken = hasScheduledAttack && snapshotTimeSeconds <= result.config.duration + 1e-9;
    const snapshotEventSequence = deliverySnapshot && snapshotTaken ? snapshotSequences.get(parent.id) ?? -1 : undefined;
    const origin = actor.weaponId === "eyeofperception" ? snapshotTaken && firstEyeTarget !== null ? targetPosition(result, firstEyeTarget, parent.frame) : null
      : snapshotTaken && definition.targetMode === "circle" ? targetPosition(result, parent.targetId, snapshotFrame) : null;
    const expected: ReplayedWeaponProcAttempt["expected"] = {
      id, sourceProfileId: actor.weaponId === "eyeofperception" ? "gcsim-eye-of-perception-implementation-v1" : deliverySnapshot ? "gcsim-delayed-weapon-proc-v1" : definition.requiresWeakPoint === true ? "gcsim-messenger-weapon-proc-v1" : definition.lifecycleKind !== undefined ? "gcsim-stateful-weapon-proc-v1" : definition.randomTrigger === undefined ? "gcsim-independent-weapon-proc-v1" : "gcsim-random-weapon-proc-v1", sourceRef: definition.sourceRef,
      weaponId: actor.weaponId, refinement: actor.refinement, actorId: actor.actorId,
      parentDamageEventId: parent.id, targetId: parent.targetId, frame: parent.frame, timeSeconds: parent.timeSeconds,
      eventPriority: parent.eventPriority,
      // The absolute heap counter includes unrelated queued work. Integrity
      // below proves its tail placement and FIFO; it never selects Aura state.
      eventSequence: deferred(parent) ? callbackSequences.get(parent.id) ?? -1 : parent.eventSequence,
      attackTag, activeCharacterId, damage: parent.finalDamage,
      outcome, cooldownFrames, cooldownExpiresFrameBefore: before,
      cooldownExpiresFrameAfter: stateAfter === undefined ? ready.get(actor.actorId) ?? null : stateAfter.hitCooldownExpiresFrame,
      coefficient, scalingStat: definition.scalingStat,
      procActionId: hasScheduledAttack ? actionId : null, procHitId: hasScheduledAttack ? hitId : null, damageFrame: hasScheduledAttack ? parent.frame + definition.damageDelayFrames : null,
      ...(["theviridescenthunt", "swordofnarzissenkreuz"].includes(actor.weaponId) ? { snapshotFrame: triggered ? snapshotFrame : null } : {}),
      ...(deliverySnapshot ? { snapshotEventSequence: snapshotEventSequence ?? null } : {}),
      origin, radius: definition.radius,
      ...(definition.requiresWeakPoint === true && hit?.hitWeakPoint !== undefined ? { hitWeakPoint: hit.hitWeakPoint } : {}),
      ...(randomAudit === undefined ? {} : { random: randomAudit }),
      ...(triggerAura === undefined ? {} : { triggerAura }),
      ...(stateAfter === undefined ? {} : { stateBefore: stateBefore!, stateAfter })
    };
    const phaseHits = result.hitResolutionLog.filter(hit => hit.frame === parent.frame && hit.eventPriority === parent.eventPriority &&
      Math.abs(hit.timeSeconds - parent.timeSeconds) < 1e-9);
    const pendingTasks = [...procs.values()].filter(proc => proc.snapshotEventSequence !== undefined &&
      proc.snapshotFrame === parent.frame && proc.snapshotPriority === parent.eventPriority);
    const laterCreatedHits = phaseHits.filter(hit => {
      const proc = procs.get(hit.sourceActionId);
      return proc?.snapshotEventSequence !== undefined && proc.snapshotFrame === parent.frame &&
        proc.snapshotPriority === parent.eventPriority && proc.snapshotEventSequence > parent.eventSequence;
    });
    const laterCreatedIds = new Set(laterCreatedHits.map(hit => hit.id));
    const deferredCallback = !deferred(parent) ? undefined : {
      afterEventSequence: Math.max(parent.eventSequence, ...pendingTasks.map(proc => proc.snapshotEventSequence!),
        ...phaseHits.filter(hit => !laterCreatedIds.has(hit.id)).map(hit => hit.eventSequence!)),
      ...(laterCreatedHits.length === 0 ? {} : { beforeEventSequence: Math.min(...laterCreatedHits.map(hit => hit.eventSequence!)) })
    };
    if (!hasScheduledAttack) { attempts.push({ parent, expected, occurrences: [], ...(deferredCallback === undefined ? {} : { deferredCallback }) }); continue; }
    if (actor.weaponId === "eyeofperception") {
      const attempt: ReplayedWeaponProcAttempt = { parent, expected, occurrences: [],
        ...(deferredCallback === undefined ? {} : { deferredCallback }) };
      attempts.push(attempt);
      appendEyeOccurrence(attempt, firstEyeTarget!, parent.frame, 0);
      continue;
    }
    const occurrences = (definition.damageOffsetsFrames ?? [definition.damageDelayFrames]).map((offsetFrames, tickIndex): ReplayedWeaponProcOccurrence => {
      const tickActionId = tickIndex === 0 ? actionId : `${actionId}:tick-${tickIndex}`;
      const tickHitId = `${tickActionId}:hit`;
      const procHit: HitDefinition = { id: tickHitId, label: `${definition.weaponName}追击`, offset: deliverySnapshot ? 0 : offsetFrames / 60,
        scaling: expected.coefficient, scalingStat: expected.scalingStat, element: "physical", attackTag: "proc", snapshot: "action",
        dmgBonus: actor.physicalDamageBonus,
        ...(definition.forcedCrit === true ? { hitWeakPoint: true } : {}),
        ...(definition.targetMode === "circle" && origin !== null
          ? { geometry: { kind: "circle", coordinateSpace: "world", origin, radius: definition.radius! } }
          : { targeting: { targetId: parent.targetId, outcome: "landed" } }) };
      const action: ActionDefinition = { id: tickActionId, actorId: actor.actorId, name: `${definition.weaponName}追击`, at: deliverySnapshot ? snapshotTimeSeconds : parent.timeSeconds, once: true, hits: [procHit] };
      const occurrence: ReplayedWeaponProcOccurrence = { logId: id, parent, action, hit: procHit, frame: parent.frame + offsetFrames,
        snapshotFrame, snapshotTimeSeconds, snapshotPriority, snapshotTaken,
        ...(snapshotEventSequence === undefined ? {} : { snapshotEventSequence }), actorId: actor.actorId,
        actionId: tickActionId, hitId: tickHitId, cycle: parent.cycle, origin, radius: expected.radius,
        ...(!deferred(parent) ? {} : { callbackEventSequence: expected.eventSequence }) };
      procs.set(tickActionId, occurrence);
      return occurrence;
    });
    attempts.push({ parent, expected, occurrences, occurrence: occurrences[0]!, ...(deferredCallback === undefined ? {} : { deferredCallback }) });
  }
  consumeLifecycleThrough(Infinity, Infinity);
  return { attempts, lifecycle };
}

export function replayWeaponProcAttempts(result: SimulationResult): ReplayedWeaponProcAttempt[] {
  return replayWeaponProcs(result).attempts;
}

export function replayWeaponProcOccurrences(result: SimulationResult): ReplayedWeaponProcOccurrence[] {
  return replayWeaponProcAttempts(result).flatMap(row => row.occurrences);
}

/** Authenticate the optional weak-point fact from configured hits and source-owned
 * proc definitions. A serialized damage flag never grants its own guarantee. */
export function replayDirectHitWeakPoints(result: SimulationResult): ReadonlyMap<number, boolean> {
  const hasMessenger = result.config.weaponProcModel?.actors.some(actor => actor.weaponId === "messenger") === true;
  const weakPoints = new Map<number, boolean>();
  if (!hasMessenger && ![...result.config.rotation, ...(result.config.timeline?.abilities ?? [])]
      .some(action => action.hits?.some(hit => hit.hitWeakPoint !== undefined))) return weakPoints;
  const procs = new Map(hasMessenger ? replayWeaponProcOccurrences(result).map(proc => [proc.actionId, proc]) : []);
  for (const event of result.damageEvents) {
    if (event.kind !== "direct") continue;
    const weakPoint = configuredHit(result, event, procs)?.hitWeakPoint;
    if (weakPoint !== undefined) weakPoints.set(event.id, weakPoint);
  }
  return weakPoints;
}
