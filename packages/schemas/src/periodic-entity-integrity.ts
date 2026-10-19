import type { RefinementCtx } from "zod";
import type { CharacterStats, HealthChangeDefinition, SimulationResult } from "./types";
import { replayPeriodicEntities } from "./periodic-entity-replay";

export interface ReplayedPeriodicHealing {
  change: HealthChangeDefinition;
  actionLogIndex: number;
  sourceActorId: string;
  frame: number;
  eventSequence: number;
  eventPriority: number;
  periodicEntityLogId: number;
}

/** Independent entity lifecycle and owner-state formula proof. */
export function validatePeriodicEntityIntegrity(result: SimulationResult, context: RefinementCtx,
  statsAt: (actorId: string, frame: number, priority?: number) => CharacterStats | undefined): Map<number, ReplayedPeriodicHealing> {
  const expected = replayPeriodicEntities(result);
  const configured = [...result.config.rotation, ...(result.config.timeline?.abilities ?? [])].some(owner => owner.periodicEntities?.length);
  const rows = result.periodicEntityLog;
  const healing = new Map<number, ReplayedPeriodicHealing>();
  const issue = (path: Array<string | number>, message: string): void => context.addIssue({ code: "custom", path, message });
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));
  if (!configured) { if (rows !== undefined) issue(["periodicEntityLog"], "requires declared periodic entities"); return healing; }
  if (rows === undefined || rows.length !== expected.length) issue(["periodicEntityLog"], "must contain the complete independently replayed entity lifecycle");
  expected.forEach((entry, index) => {
    const row = rows?.[index];
    const path: Array<string | number> = ["periodicEntityLog", index];
    if (row === undefined) return;
    const identity = { id: index, operation: entry.operation, instanceId: entry.instanceId, definitionId: entry.definition.id,
      actorId: entry.action.actorId, actionLogIndex: entry.actionLogIndex, frame: entry.frame, generation: entry.generation,
      spawnFrame: entry.spawnFrame, expiresAtFrame: entry.expiresAtFrame, eventPriority: entry.eventPriority,
      tickIndex: entry.tickIndex, replacedInstanceId: entry.replacedInstanceId };
    for (const [field, value] of Object.entries(identity)) if (row[field as keyof typeof identity] !== value) issue([...path, field], "must match configured accepted-action lifecycle replay");
    if (!near(row.timeSeconds, entry.frame / 60)) issue([...path, "timeSeconds"], "must equal frame / 60");
    const previous = rows?.[index - 1];
    if (previous !== undefined && entry.frame === previous.frame && entry.eventPriority === previous.eventPriority) {
      const sameEvent = expected[index - 1]!.order === entry.order;
      if (sameEvent ? row.eventSequence !== previous.eventSequence : row.eventSequence <= previous.eventSequence) issue([...path, "eventSequence"], "must preserve the replayed queue FIFO and final tick/expiry event identity");
    }
    if (entry.operation !== "tick") {
      if (row.healing !== undefined || row.healthEventId !== undefined) issue(path, "only live periodic ticks may heal");
      return;
    }
    const actor = result.config.characters.find(candidate => candidate.id === entry.action.actorId)!;
    let ownerMaxHp = actor.stats.baseHp * (1 + actor.stats.hpPct) + actor.stats.flatHp;
    let ownerCurrentHp = result.config.playerDamageModel.mode === "reaction-self-v1"
      ? ownerMaxHp * result.config.playerDamageModel.characters.find(state => state.actorId === actor.id)!.initialHpRatio : 0;
    for (const point of result.playerHpTimeline.points) {
      if (point.actorId !== actor.id || point.operation === "simulation-end") continue;
      if (point.operation === "initial" || point.frame < entry.frame || point.frame === entry.frame &&
          (point.eventPriority! < entry.eventPriority || point.eventPriority === entry.eventPriority && point.eventSequence! < row.eventSequence)) {
        ownerCurrentHp = point.hpAfter;
        if (result.config.playerMaxHpModel !== undefined) ownerMaxHp = point.maxHp;
      }
    }
    const ownerEm = statsAt(actor.id, entry.frame, entry.eventPriority)?.em ?? actor.stats.em;
    const definition = entry.definition.healing;
    const baseHealing = ownerMaxHp * definition.ownerHpCoefficient + definition.flat + ownerEm * definition.ownerEmCoefficient;
    const healingBonus = definition.healingBonus + (definition.lowHpBonus !== undefined && ownerCurrentHp <= ownerMaxHp * definition.lowHpBonus.thresholdRatio ? definition.lowHpBonus.bonus : 0);
    const numeric = { ownerMaxHp, ownerCurrentHp, ownerEm, baseHealing, healingBonus, incomingHealingBonus: definition.incomingHealingBonus };
    if (row.healing === undefined) issue([...path, "healing"], "live tick requires owner-state healing inputs and formula trace");
    else for (const [field, value] of Object.entries(numeric)) if (!near(row.healing[field as keyof typeof numeric], value)) issue([...path, "healing", field], "must equal independently replayed tick-time owner state and declared healing formula");
    const healthEventId = row.healthEventId;
    const healthEvent = healthEventId === undefined ? undefined : result.playerHealthEvents?.[healthEventId];
    if (healthEventId === undefined || healthEvent === undefined || healthEvent.periodicEntityLogId !== index ||
        healthEvent.eventSequence !== row.eventSequence || healthEvent.frame !== row.frame || healthEvent.actionLogIndex !== row.actionLogIndex) {
      issue([...path, "healthEventId"], "periodic tick must have a reciprocal same-event health transition");
      return;
    }
    if (healing.has(healthEventId)) issue([...path, "healthEventId"], "each periodic tick must own one unique health event");
    healing.set(healthEventId, { actionLogIndex: entry.actionLogIndex, sourceActorId: actor.id, frame: entry.frame,
      periodicEntityLogId: index, eventSequence: row.eventSequence, eventPriority: row.eventPriority, change: {
        id: `${entry.definition.id}:heal:${entry.tickIndex}`, label: `${entry.definition.label}治疗`,
        frameOffset: entry.frame - entry.action.frame, target: { kind: "active" }, source: { kind: "source", refs: entry.definition.sourceRefs },
        operation: "heal", amount: { basis: "fixed", value: baseHealing }, healingBonus, incomingHealingBonus: definition.incomingHealingBonus
      } });
  });
  return healing;
}
