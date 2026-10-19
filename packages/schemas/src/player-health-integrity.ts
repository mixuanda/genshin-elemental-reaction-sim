import type { RefinementCtx } from "zod";
import type { BondOfLifeEventAudit, HealthChangeDefinition, SimulationResult } from "./types";
import { bondOfLifeProfileId } from "./bond-of-life-schema";
import { playerMaxHpForHealthEvent } from "./player-max-hp-integrity";
import type { ReplayedPeriodicHealing } from "./periodic-entity-integrity";
import { actionOwner, actionEventPriority, actionChildEventPriority } from "./action-condition-integrity";

/** Binds health output to accepted actions and the shared player HP chain. */
export function validatePlayerHealthIntegrity(result: SimulationResult, context: RefinementCtx, periodicHealing: ReadonlyMap<number, ReplayedPeriodicHealing> = new Map()): void {
  const owners = [...result.config.rotation, ...(result.config.timeline?.abilities ?? [])];
  const configured = owners.some(owner => (owner.healthChanges?.length ?? 0) > 0 || (owner.periodicEntities?.length ?? 0) > 0);
  const events = result.playerHealthEvents;
  const issue = (path: Array<string | number>, message: string): void => context.addIssue({ code: "custom", path, message });
  const near = (left: number, right: number): boolean => Math.abs(left - right) <= 1e-8 * Math.max(1, Math.abs(left), Math.abs(right));
  const bondModel = result.config.bondOfLifeModel;
  const initialDebt = new Map(result.config.characters.map(actor => {
    const maxHp = actor.stats.baseHp * (1 + actor.stats.hpPct) + actor.stats.flatHp;
    const ratio = bondModel?.characters.find(state => state.actorId === actor.id)?.initialRatio ?? 0;
    return [actor.id, ratio * maxHp] as const;
  }));
  // Only accepted, independently bound health operations mutate this ledger.
  // Captured debtBefore values never initialize or repair replay state.
  const debt = new Map(initialDebt);
  const validateBondSummaries = (): void => {
    if (bondModel === undefined) {
      for (const [index, summary] of result.playerHpSummaries.entries()) {
        if (summary.initialBondOfLife !== undefined || summary.finalBondOfLife !== undefined) issue(
          ["playerHpSummaries", index], "Bond of Life summary fields require the explicit source-profile model");
      }
      return;
    }
    if (result.compatibilityMode !== "legal-frame-v1") issue(["compatibilityMode"], "Bond of Life requires the native 60-fps timeline");
    for (const actor of result.config.characters) {
      const index = result.playerHpSummaries.findIndex(summary => summary.actorId === actor.id);
      const summary = result.playerHpSummaries[index];
      if (summary === undefined) { issue(["playerHpSummaries"], "Bond of Life requires a summary for every configured actor"); continue; }
      for (const [field, value] of [["initialBondOfLife", initialDebt.get(actor.id)!], ["finalBondOfLife", debt.get(actor.id)!]] as const) {
        if (summary[field] === undefined || !near(summary[field], value)) issue(["playerHpSummaries", index, field], "must equal the independently replayed Bond of Life ledger");
      }
    }
  };
  if (!configured) {
    if (events !== undefined) issue(["playerHealthEvents"], "requires configured health changes");
    if (result.playerHpTimeline.points.some(point => point.operation === "heal" || point.operation === "consume" || point.operation === "bond-add" || point.operation === "bond-remove" || point.playerHealthEventId !== undefined)) {
      issue(["playerHpTimeline"], "health HP points require configured health changes");
    }
    if (result.playerHpSummaries.some(summary => summary.totalHealing !== undefined || summary.totalOverheal !== undefined || summary.totalHpConsumed !== undefined)) {
      issue(["playerHpSummaries"], "health totals require configured health changes");
    }
    validateBondSummaries();
    return;
  }
  if (events === undefined || result.config.playerDamageModel.mode !== "reaction-self-v1") {
    issue(["playerHealthEvents"], "health changes require their event audit and enabled player HP state");
    validateBondSummaries();
    return;
  }
  const endFrame = Math.round(result.config.duration * 60);
  const activeAttempts = [...result.actionLog, ...result.skippedActions].sort((left, right) =>
    left.time - right.time || actionEventPriority(actionOwner(result.config, left)) - actionEventPriority(actionOwner(result.config, right)) || left.cycle - right.cycle ||
    (left.timelineCommandIndex ?? result.config.rotation.findIndex(action => action.id === left.actionId)) -
    (right.timelineCommandIndex ?? result.config.rotation.findIndex(action => action.id === right.actionId)));
  const activeAt = (frame: number, priority: number): string | undefined => {
    let actorId = result.config.timeline?.initialActiveCharacterId ?? result.config.characters[0]?.id;
    for (const action of activeAttempts) {
      if (action.frame > frame) break;
      if (action.frame === frame && actionEventPriority(actionOwner(result.config, action)) >= priority) continue;
      actorId = action.actorId;
    }
    return actorId;
  };
  const expected = new Map<string, { change: HealthChangeDefinition; actorId: string; targetId: string; frame: number; priority: number; targetIndex: number; periodicEntityLogId?: number; eventSequence?: number }>();
  result.actionLog.forEach((action, actionIndex) => {
    const definition = action.sourceAbilityId === undefined
      ? result.config.rotation.find(owner => owner.id === action.actionId && owner.actorId === action.actorId)
      : result.config.timeline?.abilities.find(owner => owner.id === action.sourceAbilityId && owner.actorId === action.actorId);
    for (const change of definition?.healthChanges ?? []) {
      const frame = action.frame + change.frameOffset;
      if (frame > endFrame) continue;
      const priority = actionChildEventPriority(definition, change.frameOffset, 2);
      const targetIds = change.target.kind === "party" ? result.config.characters.map(actor => actor.id)
        : [change.target.kind === "self" ? action.actorId : change.target.kind === "actor" ? change.target.actorId : activeAt(frame, priority)];
      targetIds.forEach((targetId, targetIndex) => {
        if (targetId !== undefined) expected.set(`action:${actionIndex}:${change.id}:${targetId}`, { change, actorId: action.actorId, targetId, frame, priority, targetIndex });
      });
    }
  });
  for (const [healthEventId, entry] of periodicHealing) {
    const targetId = activeAt(entry.frame, entry.eventPriority);
    if (targetId !== undefined) expected.set(`periodic:${healthEventId}`, { change: entry.change,
      actorId: entry.sourceActorId, targetId, frame: entry.frame, priority: entry.eventPriority, targetIndex: 0,
      periodicEntityLogId: entry.periodicEntityLogId, eventSequence: entry.eventSequence });
  }
  const healthPoints = result.playerHpTimeline.points.filter(point => point.operation === "heal" || point.operation === "consume" || point.operation === "bond-add" || point.operation === "bond-remove");
  if (healthPoints.length !== events.length) issue(["playerHpTimeline", "points"], "requires exactly one HP point per health event");
  const healthPointIds = new Set<number>();
  healthPoints.forEach(point => {
    if (point.playerHealthEventId === undefined || healthPointIds.has(point.playerHealthEventId)) issue(["playerHpTimeline", "points", point.id], "health point requires a unique event ID");
    else healthPointIds.add(point.playerHealthEventId);
  });
  const eventSequences = new Map<string, number>();
  events.forEach((event, index) => {
    const path: Array<string | number> = ["playerHealthEvents", index];
    const key = event.periodicEntityLogId === undefined ? `action:${event.actionLogIndex}:${event.changeId}:${event.targetActorId}` : `periodic:${index}`;
    const entry = expected.get(key);
    if (entry === undefined) { issue(path, "must match one accepted configured health action and target"); return; }
    expected.delete(key);
    if (event.periodicEntityLogId !== entry.periodicEntityLogId || event.changeId !== entry.change.id ||
        event.targetActorId !== entry.targetId || entry.eventSequence !== undefined && event.eventSequence !== entry.eventSequence) {
      issue(path, "periodic health provenance and active target must match the independently replayed tick");
    }
    const actor = result.config.characters.find(character => character.id === entry.targetId)!;
    const maxHp = playerMaxHpForHealthEvent(result, event.id, actor.stats.baseHp * (1 + actor.stats.hpPct) + actor.stats.flatHp);
    const change = entry.change;
    const baseAmount = change.amount.value * (change.amount.basis === "fixed" ? 1 : change.amount.basis === "target-max-hp" ? maxHp : event.hpBefore);
    const bonusMultiplier = change.operation === "heal" ? 1 + change.healingBonus + change.incomingHealingBonus : 1;
    const requestedAmount = baseAmount * bonusMultiplier;
    const minimumHp = change.operation === "consume" ? maxHp * change.minimumHpRatio : 0;
    const isBondOperation = change.operation === "bond-add" || change.operation === "bond-remove";
    let healingAfterDebt = change.operation === "heal" ? requestedAmount : 0;
    if (bondModel === undefined) {
      if (event.bondOfLife !== undefined) issue([...path, "bondOfLife"], "requires the explicit Bond of Life source profile");
      if (isBondOperation) issue([...path, "operation"], "debt operations require the explicit Bond of Life model");
    } else {
      const debtBefore = debt.get(entry.targetId)!;
      const requestedDebtDelta = change.operation === "bond-add" ? requestedAmount
        : change.operation === "bond-remove" || change.operation === "heal" ? -requestedAmount : 0;
      const debtAfter = requestedDebtDelta === 0 ? debtBefore : Math.min(2 * maxHp, Math.max(0, debtBefore + requestedDebtDelta));
      const absorbedHealing = change.operation === "heal" ? Math.min(debtBefore, requestedAmount) : 0;
      healingAfterDebt = change.operation === "heal" ? Math.max(0, requestedAmount - debtBefore) : 0;
      const expectedBond: BondOfLifeEventAudit = {
        profileId: bondOfLifeProfileId, debtBefore, debtAfter, absorbedHealing, healingAfterDebt,
        requestedDebtDelta, actualDebtDelta: debtAfter - debtBefore,
        sourceEventEmitted: requestedDebtDelta !== 0,
        sourceCallbackAmount: debtBefore - debtAfter
      };
      debt.set(entry.targetId, debtAfter);
      if (event.bondOfLife === undefined) issue([...path, "bondOfLife"], "every enabled health event requires its Bond of Life transition");
      else for (const [field, value] of Object.entries(expectedBond)) {
        const actual = event.bondOfLife[field as keyof BondOfLifeEventAudit];
        if (typeof value === "number" ? typeof actual !== "number" || !near(actual, value) : actual !== value) {
          issue([...path, "bondOfLife", field], "must equal the independently replayed debt transition and source callback");
        }
      }
    }
    const actualChange = change.operation === "heal" ? Math.min(healingAfterDebt, maxHp - event.hpBefore)
      : isBondOperation ? 0 : Math.max(0, Math.min(requestedAmount, event.hpBefore - minimumHp));
    const hpAfter = event.hpBefore + (change.operation === "heal" ? actualChange : -actualChange);
    const numbers = { id: index, frame: entry.frame, timeSeconds: entry.frame / 60, eventPriority: entry.priority,
      intraEventSequence: entry.targetIndex * (change.operation === "heal" && result.config.artifactDamageModel?.actors.some(actor => actor.actorId === entry.actorId && actor.effectId === "song-of-days-past-4pc") ? 3 : 2), maxHp, baseAmount, bonusMultiplier, requestedAmount, minimumHp, actualChange, hpAfter,
      overheal: change.operation === "heal" ? healingAfterDebt - actualChange : 0 };
    for (const [field, value] of Object.entries(numbers)) {
      if (!near(event[field as keyof typeof numbers], value)) issue([...path, field], `must equal independently replayed health value ${value}`);
    }
    if (event.sourceActorId !== entry.actorId || event.operation !== change.operation || event.hpBefore > maxHp || event.trace.length === 0) {
      issue(path, "health action identity, HP range, operation, and formula trace must match");
    }
    const group = event.periodicEntityLogId === undefined ? `action:${event.actionLogIndex}:${event.changeId}` : `periodic:${event.periodicEntityLogId}`;
    const eventSequence = eventSequences.get(group);
    if (eventSequence !== undefined && eventSequence !== event.eventSequence) issue([...path, "eventSequence"], "party targets must share one scheduled health event");
    eventSequences.set(group, event.eventSequence);
    const previous = events[index - 1];
    if (previous !== undefined && (event.frame < previous.frame || event.frame === previous.frame &&
        (event.eventPriority < previous.eventPriority || event.eventPriority === previous.eventPriority && (event.eventSequence < previous.eventSequence || event.eventSequence === previous.eventSequence && event.intraEventSequence <= previous.intraEventSequence)))) {
      issue(path, "health events must preserve frame, sequence, and intra-event order");
    }
    const point = healthPoints.find(candidate => candidate.playerHealthEventId === event.id);
    if (point === undefined || point.operation !== event.operation || point.actorId !== event.targetActorId || point.frame !== event.frame ||
        point.eventPriority !== event.eventPriority || point.eventSequence !== event.eventSequence || point.intraEventSequence !== event.intraEventSequence + 1 ||
        point.playerDamageEventId !== null || !near(point.maxHp, maxHp) || !near(point.hpBefore, event.hpBefore) || !near(point.hpAfter, event.hpAfter)) {
      issue(path, "requires its exact linked HP transition in the shared timeline");
    }
  });
  if (expected.size !== 0) issue(["playerHealthEvents"], "every accepted in-duration health action requires one event per resolved target");
  result.playerHpSummaries.forEach((summary, index) => {
    const actorEvents = events.filter(event => event.targetActorId === summary.actorId);
    const totals = { totalHealing: actorEvents.filter(event => event.operation === "heal").reduce((sum, event) => sum + event.actualChange, 0),
      totalOverheal: actorEvents.reduce((sum, event) => sum + event.overheal, 0),
      totalHpConsumed: actorEvents.filter(event => event.operation === "consume").reduce((sum, event) => sum + event.actualChange, 0) };
    for (const [field, value] of Object.entries(totals)) {
      const actual = summary[field as keyof typeof totals];
      if (actual === undefined || !near(actual, value)) issue(["playerHpSummaries", index, field], "must equal actual health events for this actor");
    }
  });
  validateBondSummaries();
}
