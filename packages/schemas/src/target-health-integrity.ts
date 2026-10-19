import type { RefinementCtx } from "zod";
import type { DeclaredParticleDropDefinition, DeclaredParticleOrigin, HitResolutionLogEntry, SimulationResult, TargetHealthLogEntry, TargetHealthSummary } from "./types";

export interface ReplayedDeclaredDrop {
  definition: DeclaredParticleDropDefinition;
  origin: DeclaredParticleOrigin;
  frame: number;
  timeSeconds: number;
  cycle: number;
  priority: number;
}

/** Independent arithmetic/provenance oracle; never derives a drop from output HP rows. */
export function replayTargetHealth(result: SimulationResult): {
  log: Array<Omit<TargetHealthLogEntry, "trace">>;
  summaries: TargetHealthSummary[];
  drops: ReplayedDeclaredDrop[];
} {
  const model = result.config.targetHealthModel;
  const log: Array<Omit<TargetHealthLogEntry, "trace">> = [];
  const drops: ReplayedDeclaredDrop[] = [];
  if (model === undefined) return { log, summaries: [], drops };
  const states = new Map((model?.targets ?? []).map(definition => [definition.targetId, {
    definition, hp: definition.initialHp, consumed: new Set<string>(),
    summary: { targetId: definition.targetId, maxHp: definition.maxHp, initialHp: definition.initialHp,
      finalHp: definition.initialHp, totalRawDamage: 0, totalEffectiveHpDamage: 0, totalOverkill: 0,
      defeatedFrame: definition.initialHp === 0 ? 0 : null } as TargetHealthSummary
  }]));
  for (const definition of model?.externalDrops ?? []) {
    if (definition.frame / 60 <= result.config.duration + 1e-9) drops.push({ definition, frame: definition.frame, timeSeconds: definition.frame / 60, cycle: 0, priority: 2,
      origin: { kind: "external", dropId: definition.id, targetId: null, targetHealthLogId: null, damageEventId: null, sourceRef: definition.sourceRef } });
  }
  // Accepted parent hits can settle after their recursive Shatter child killed the target.
  // Keep their raw damage and zero effective HP damage in this actual settlement order.
  for (const event of result.damageEvents) {
    const state = states.get(event.targetId);
    if (state === undefined) continue;
    const { definition, hp: hpBefore, summary } = state;
    const effectiveHpDamage = Math.min(event.finalDamage, hpBefore);
    const hpAfter = hpBefore - effectiveHpDamage;
    const overkill = event.finalDamage - effectiveHpDamage;
    const defeated = hpBefore > 0 && hpAfter === 0;
    const triggered = definition.drops.filter(drop => !state.consumed.has(drop.id) && (drop.trigger.kind === "defeat" ? defeated
      : hpBefore > definition.maxHp * drop.trigger.hpRatio && hpAfter <= definition.maxHp * drop.trigger.hpRatio));
    const id = log.length;
    log.push({ id, targetId: event.targetId, damageEventId: event.id, frame: event.frame, timeSeconds: event.timeSeconds,
      eventPriority: event.eventPriority, eventSequence: event.eventSequence, maxHp: definition.maxHp,
      hpBefore, hpAfter, rawDamage: event.finalDamage, effectiveHpDamage, overkill, defeated,
      triggeredDropIds: triggered.map(drop => drop.id), sourceRef: definition.sourceRef });
    for (const drop of triggered) {
      state.consumed.add(drop.id);
      drops.push({ definition: drop, frame: event.frame, timeSeconds: event.timeSeconds, cycle: event.cycle, priority: event.eventPriority >= 8 ? 12 : 2,
        origin: { kind: drop.trigger.kind === "defeat" ? "enemy-defeat" : "enemy-hp-threshold", dropId: drop.id,
          targetId: event.targetId, targetHealthLogId: id, damageEventId: event.id, sourceRef: drop.sourceRef } });
    }
    state.hp = hpAfter;
    summary.finalHp = hpAfter;
    summary.totalRawDamage += event.finalDamage;
    summary.totalEffectiveHpDamage += effectiveHpDamage;
    summary.totalOverkill += overkill;
    if (defeated) summary.defeatedFrame = event.frame;
  }
  return { log, summaries: [...states.values()].map(state => state.summary), drops };
}

/** Only a previously settled death or an explicitly zero initial HP can justify this miss. */
export function isDeclaredTargetDefeatedMiss(result: SimulationResult, hit: HitResolutionLogEntry): boolean {
  if (hit.reason !== "TARGET_DEFEATED") return false;
  const target = result.config.targetHealthModel?.targets.find(target => target.targetId === hit.targetId);
  if (target === undefined) return false;
  if (target.initialHp === 0) return true;
  return (result.targetHealthLog ?? []).some(entry => {
    if (entry.targetId !== hit.targetId || entry.hpAfter !== 0) return false;
    if (entry.timeSeconds < hit.timeSeconds) return true;
    if (entry.timeSeconds > hit.timeSeconds) return false;
    if (hit.eventSequence !== undefined && hit.eventPriority !== undefined) {
      return entry.eventPriority < hit.eventPriority || entry.eventPriority === hit.eventPriority && entry.eventSequence < hit.eventSequence;
    }
    return (result.damageEvents[entry.damageEventId]?.targetResolutionId ?? Infinity) < hit.id;
  });
}

export function validateTargetHealthIntegrity(result: SimulationResult, context: RefinementCtx): void {
  const issue = (path: (string | number)[], message: string) => context.addIssue({ code: "custom", path, message });
  const near = (a: number, b: number) => Number.isFinite(a) && Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));
  const model = result.config.targetHealthModel;
  if (model === undefined) {
    if (result.targetHealthLog !== undefined || result.targetHealthSummaries !== undefined || result.particleEvents.some(row => row.origin !== undefined)) {
      issue(["targetHealthLog"], "HP output and declared particle origins require targetHealthModel");
    }
  } else {
    const expected = replayTargetHealth(result);
    if (result.targetHealthLog?.length !== expected.log.length) issue(["targetHealthLog"], "requires exactly one settlement per actual damage event on a declared target");
    expected.log.forEach((row, index) => {
      const actual = result.targetHealthLog?.[index];
      if (actual === undefined) return;
      for (const [key, value] of Object.entries(row)) {
        const observed = actual[key as keyof typeof actual];
        if (typeof value === "number" ? typeof observed !== "number" || !near(observed, value) : JSON.stringify(observed) !== JSON.stringify(value)) {
          issue(["targetHealthLog", index, key], "must equal independently replayed target HP settlement");
        }
      }
      if (actual.trace.length === 0) issue(["targetHealthLog", index, "trace"], "requires the executed HP calculation trace");
    });
    if (result.targetHealthSummaries?.length !== expected.summaries.length) issue(["targetHealthSummaries"], "requires one summary per declared target");
    expected.summaries.forEach((row, index) => {
      const actual = result.targetHealthSummaries?.[index];
      if (actual === undefined) return;
      for (const [key, value] of Object.entries(row)) {
        const observed = actual[key as keyof typeof actual];
        if (typeof value === "number" ? typeof observed !== "number" || !near(observed, value) : observed !== value) {
          issue(["targetHealthSummaries", index, key], "must equal independently accumulated target HP state");
        }
      }
    });
    const remaining = new Map(expected.drops.map(drop => [drop.definition.id, drop]));
    result.particleEvents.forEach((event, index) => {
      if (event.origin === undefined) return;
      const expectedDrop = remaining.get(event.origin.dropId);
      if (expectedDrop === undefined) { issue(["particleEvents", index, "origin"], "must match one executed declared drop"); return; }
      remaining.delete(event.origin.dropId);
      for (const [key, value] of Object.entries(expectedDrop.origin)) {
        if (event.origin[key as keyof DeclaredParticleOrigin] !== value) issue(["particleEvents", index, "origin", key], "must match the declared drop and actual HP trigger");
      }
    });
    if (remaining.size > 0) issue(["particleEvents"], "every executed declared drop requires its particle event");
  }
  result.hitResolutionLog.forEach((hit, index) => {
    if (hit.reason !== "TARGET_DEFEATED") return;
    if (!isDeclaredTargetDefeatedMiss(result, hit) || hit.landed || hit.outcome !== "miss" || hit.damageAllowed || hit.auraAllowed || hit.hitConfirmAllowed || hit.damageEventId !== null) {
      issue(["hitResolutionLog", index], "TARGET_DEFEATED must be a zero-effect miss after declared target death");
    }
  });
}
