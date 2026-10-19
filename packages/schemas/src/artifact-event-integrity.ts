import type { RefinementCtx } from "zod";
import { canonicalStringify } from "./reproducibility";
import { replayArtifactEvents } from "./artifact-event-replay";
import { replaySacrificial } from "./sacrificial-replay";
import type { ArtifactEventLogEntry, SimulationResult } from "./types";

/** Verify imported callbacks against actual source events and the shared serial
 * E replay. Numeric energy state is independently checked by the energy facet. */
export function validateArtifactEventIntegrity(result: SimulationResult, context: RefinementCtx): void {
  const issue = (path: Array<string | number>, message: string): void => context.addIssue({ code: "custom", path, message });
  const equal = (path: Array<string | number>, actual: unknown, expected: unknown): void => {
    const matches = typeof actual === "number" && typeof expected === "number"
      ? Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(actual), Math.abs(expected))
      : canonicalStringify(actual) === canonicalStringify(expected);
    if (!matches) issue(path, "must match independently replayed artifact source events and receiver order");
  };
  const hasArtifacts = result.config.artifactEventModel !== undefined;
  const hasNightsoul = result.config.nightsoulBurstModel !== undefined;
  if (!hasArtifacts && result.artifactEventLog !== undefined) issue(["artifactEventLog"], "requires its explicit artifact event model");
  if (!hasNightsoul && result.nightsoulBurstLog !== undefined) issue(["nightsoulBurstLog"], "requires its explicit Nightsoul Burst model");
  if (!hasArtifacts && !hasNightsoul) {
    for (const row of result.energyLog) if (row.artifactEventLogId !== undefined) issue(["energyLog", row.id, "artifactEventLogId"], "requires its explicit artifact event model");
    return;
  }
  if (result.compatibilityMode !== "legal-frame-v1" || result.config.timeline === undefined) issue(["compatibilityMode"], "artifact event callbacks require the actual legal-frame timeline");
  const execution = result.resolvedRuntimeOptions.execution;
  if (hasNightsoul && execution !== undefined && [execution.lunarCharged, execution.lunarCrystallize, execution.lunarMixed,
    execution.lunarMixedV2, execution.stellarConduct, execution.stellarSwirl, execution.lunarBloom].some(value => value !== undefined)) {
    issue(["resolvedRuntimeOptions", "execution"], "Nightsoul callbacks do not yet cover special damage deliveries");
  }
  const replay = replayArtifactEvents(result);
  if (hasArtifacts && result.artifactEventLog?.length !== replay.attempts.length) issue(["artifactEventLog"], "requires one complete source callback audit, including every blocked attempt and delivered Exile tick");
  if (hasNightsoul && result.nightsoulBurstLog?.length !== replay.nightsoul.length) issue(["nightsoulBurstLog"], "requires one deferred callback for every actually delivered ordinary elemental damage event");
  let previousNightsoul: { frame: number; priority: number; sequence: number } | undefined;
  for (const { expected, deferredAfterSequence } of replay.nightsoul) {
    const actual = result.nightsoulBurstLog?.[expected.id];
    if (actual === undefined) continue;
    for (const [field, value] of Object.entries(expected)) equal(["nightsoulBurstLog", expected.id, field], actual[field as keyof typeof actual], value);
    if (actual.eventSequence <= deferredAfterSequence) issue(["nightsoulBurstLog", expected.id, "eventSequence"], "must follow the parent's already queued damage phase");
    if (previousNightsoul?.frame === actual.frame && previousNightsoul.priority === actual.eventPriority && previousNightsoul.sequence >= actual.eventSequence) {
      issue(["nightsoulBurstLog", expected.id, "eventSequence"], "must preserve independently derived parent damage FIFO order");
    }
    previousNightsoul = { frame: actual.frame, priority: actual.eventPriority, sequence: actual.eventSequence };
  }
  const cooldowns = replay.attempts.some(row => row.expected.outcome === "skill-reset") ? replaySacrificial(result).cooldowns : [];
  let previous: ArtifactEventLogEntry | undefined;
  const usedEnergy = new Set<number>();
  for (const attempt of replay.attempts) {
    const { expected, knownEventSequence, gains } = attempt;
    const actual = result.artifactEventLog?.[expected.id];
    if (actual === undefined) continue;
    const path: Array<string | number> = ["artifactEventLog", expected.id];
    for (const [field, value] of Object.entries(expected)) equal([...path, field], actual[field as keyof typeof actual], value);
    if (knownEventSequence !== null) equal([...path, "eventSequence"], actual.eventSequence, knownEventSequence);
    if (expected.nightsoulBurstLogId !== null) equal([...path, "eventSequence"], actual.eventSequence,
      result.nightsoulBurstLog?.[expected.nightsoulBurstLogId]?.eventSequence);
    if (expected.parentArtifactEventLogId !== null) {
      const parent = result.artifactEventLog?.[expected.parentArtifactEventLogId];
      if (parent !== undefined && actual.eventSequence <= parent.eventSequence) issue([...path, "eventSequence"], "Exile energy must be a task queued by its accepted Burst callback");
    }
    if (expected.actionLogIndex !== null) {
      const action = result.actionLog[expected.actionLogIndex]!;
      if (result.damageEvents.some(event => event.actionId === action.actionId && event.cycle === action.cycle && event.eventSequence <= actual.eventSequence)) {
        issue([...path, "eventSequence"], "accepted OnBurst must precede the damage queued by its Burst body");
      }
    }
    if (previous?.frame === actual.frame && previous.eventPriority === actual.eventPriority && previous.eventSequence > actual.eventSequence) {
      issue([...path, "eventSequence"], "must preserve actual source hook and queued tick order");
    }
    previous = actual;
    const energy = result.energyLog.filter(row => row.artifactEventLogId === expected.id);
    equal([...path, "energyLogIds"], actual.energyLogIds, energy.map(row => row.id));
    equal([...path, "energyLogIds", "length"], energy.length, gains.length);
    for (const [index, gain] of gains.entries()) {
      const row = energy[index];
      if (row === undefined) continue;
      usedEnergy.add(row.id);
      for (const [field, value] of Object.entries({ kind: "fixed", frame: expected.frame, timeSeconds: expected.timeSeconds,
        sourceActorId: expected.actorId, sourceActionId: expected.sourceActionId, source: `artifact:${expected.effectId}`,
        receiverId: gain.receiverId, rawEnergy: gain.amount, finalEnergy: gain.amount, energyRecharge: 1, fieldMultiplier: 1,
        spawnFrame: null, receiveFrame: expected.frame, particleElement: null, particleKind: null, particleCount: null,
        isSameElement: null, baseEnergyPerParticle: null, activeCharacterId: expected.activeCharacterId,
        isOnField: gain.receiverId === expected.activeCharacterId, applied: true, blockedReason: null,
        internalCooldownKey: null, internalCooldownDurationFrames: null, internalCooldownReadyFrame: null })) {
        equal(["energyLog", row.id, field], row[field as keyof typeof row], value);
      }
    }
    const reset = cooldowns.find(row => row.artifactEventLogId === expected.id);
    equal([...path, "skillCooldownLogId"], actual.skillCooldownLogId, expected.outcome === "skill-reset" ? reset?.id : null);
  }
  for (const row of result.energyLog) if (row.artifactEventLogId !== undefined && !usedEnergy.has(row.id)) {
    issue(["energyLog", row.id, "artifactEventLogId"], "must belong to an independently derived artifact energy recipient");
  }
}
