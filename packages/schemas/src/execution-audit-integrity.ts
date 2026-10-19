import type { RefinementCtx } from "zod";
import { CLASSIC_REACTION_FORMULA_PROFILE } from "@genshin-dps-lab/reaction-formulas";
import { simulationExecutionAuditSchema, EXECUTION_CHECKPOINT_DIMENSIONS } from "./execution-audit-schema";
import { replayDirectHitWeakPoints } from "./weapon-proc-replay";
import type { CapturedOrdinaryDamageInput, SimulationResult } from "./types";

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const resistance = (value: number) => value < 0 ? 1 - value / 2 : value < 0.75 ? 1 - value : 1 / (4 * value + 1);

/** Independent replay of the versioned UTF-16 FNV-1a seeded Mulberry32 stream. */
function criticalRandom(seed: string): () => number {
  let state = 0x811c9dc5;
  for (let index = 0; index < seed.length; index++) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 0x01000193);
  }
  state >>>= 0;
  return () => {
    let value = (state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function ordinaryFactors(input: Omit<CapturedOrdinaryDamageInput, "explicitReactionBase"> & { explicitReactionBase?: number | undefined }) {
  const defenseIgnore = clamp(input.defenseIgnore, 0, 1);
  const defenseReduction = clamp(input.defenseReduction, -1, 0.9);
  const critRate = clamp(input.critRate, 0, 1);
  const critDamage = Math.max(0, input.critDamage);
  const reactionBase = input.explicitReactionBase ?? CLASSIC_REACTION_FORMULA_PROFILE.amplifyingBaseMultipliers[input.reaction];
  const elementalMastery = Math.max(0, input.elementalMastery);
  const elementalMasteryBonus = reactionBase === 1 ? 0 : 2.78 * elementalMastery / (1400 + elementalMastery);
  const reactionBonus = reactionBase === 1 ? 0 : Math.max(0, input.reactionBonus);
  return {
    scaling: input.scaling, scalingStat: input.scalingStat, scalingValue: input.scalingValue,
    flatDamage: input.flatDamage, baseDamage: input.scaling * input.scalingValue + input.flatDamage,
    damageBonus: input.damageBonus, damageBonusMultiplier: 1 + input.damageBonus,
    defenseIgnore, defenseReduction,
    defenseMultiplier: (input.characterLevel + 100) / (input.characterLevel + 100 + (input.enemyLevel + 100) * (1 + defenseReduction) * (1 - defenseIgnore)),
    effectiveResistance: input.effectiveResistance, resistanceMultiplier: resistance(input.effectiveResistance),
    critRate, critDamage,
    critMultiplier: input.critMode === "allCrit" ? 1 + critDamage : input.critMode === "noCrit" ? 1 : 1 + critRate * critDamage,
    reactionBase, elementalMasteryBonus, reactionBonus,
    amplifyingReactionMultiplier: reactionBase * (1 + elementalMasteryBonus + reactionBonus),
    groupMultiplier: input.groupMultiplier
  };
}

/** This checks captured computation inputs, never executes untrusted plugin code. */
export function validateSimulationExecutionAudit(result: SimulationResult, context: RefinementCtx): void {
  const execution = result.resolvedRuntimeOptions.execution;
  const issue = (path: Array<string | number>, message: string) => context.addIssue({ code: "custom", path: ["executionAudit", ...path], message });
  if (execution === undefined) {
    if (result.executionAudit !== undefined) issue([], "requires explicit resolved execution options");
    return;
  }
  if (result.executionAudit === undefined) {
    issue([], "is required when execution options are selected");
    return;
  }
  const parsed = simulationExecutionAuditSchema.safeParse(result.executionAudit);
  if (!parsed.success) {
    for (const problem of parsed.error.issues) issue(problem.path as Array<string | number>, problem.message);
    return;
  }
  const audit = parsed.data;
  const close = (actual: number, expected: number, path: Array<string | number>) => {
    if (!Number.isFinite(expected) || !Number.isFinite(actual) || Math.abs(actual - expected) > 1e-9 * Math.max(1, Math.abs(actual), Math.abs(expected))) {
      issue(path, `does not reproduce captured formula input (expected ${expected}, received ${actual})`);
    }
  };
  const expectCapture = execution.captureHits !== false || execution.detailedTraces === true || execution.criticalSampling !== undefined;
  if (audit.hits.length !== (expectCapture ? result.damageEvents.length : 0)) issue(["hits"], "must capture exactly every damage event in event order when hit capture is enabled");
  const sampling = execution.criticalSampling === "seeded-random-v1";
  const expectedSeed = `${result.randomSeed}:critical-hit-v1`;
  const next = criticalRandom(expectedSeed);
  let drawCount = 0;
  if (sampling) {
    if (audit.criticalSampling?.seed !== expectedSeed) issue(["criticalSampling", "seed"], "must bind the dedicated critical-hit stream to the run seed");
  } else if (audit.criticalSampling !== null) issue(["criticalSampling"], "must be null when critical sampling was not requested");
  const hasDamagePlugin = result.runManifest.pluginCapabilities.includes("damage-modifier");
  const weakPoints = replayDirectHitWeakPoints(result);
  for (const [index, hit] of audit.hits.entries()) {
    const path: Array<string | number> = ["hits", index];
    if (hit.eventId !== index) issue([...path, "eventId"], "must equal its contiguous damage event index");
    const event = result.damageEvents[hit.eventId];
    if (!event) { issue([...path, "eventId"], "references a missing damage event"); continue; }
    if (execution.detailedTraces === true && hit.trace === undefined) issue([...path, "trace"], "is required when detailed traces are requested");
    const decision = hit.critical;
    const weakPoint = weakPoints.get(event.id) === true;
    if (weakPoint) {
      if (decision.mode !== "configured" || !decision.eligible || decision.outcome !== "critical") {
        issue([...path, "critical"], "source-proven weak-point hits require an eligible configured critical outcome");
      }
      if (decision.roll !== null || decision.drawIndex !== null) {
        issue([...path, "critical"], "source-proven weak-point hits consume no critical-stream draw");
      }
      if (hit.inputKind !== "ordinary" || hit.input.critMode !== "allCrit") {
        issue([...path, "input"], "source-proven weak-point hits require ordinary allCrit input, including with damage plugins");
      }
    } else if (decision.mode === "seeded-random-v1") {
      if (!sampling || !decision.eligible || hit.inputKind !== "ordinary") issue([...path, "critical"], "seeded draws require an eligible ordinary hit and seeded execution mode");
      if (decision.drawIndex !== drawCount) issue([...path, "critical", "drawIndex"], "must be the next zero-based critical-stream draw index");
      const roll = next();
      drawCount++;
      if (decision.roll !== roll) issue([...path, "critical", "roll"], "does not replay from the recorded run seed");
      if (hit.inputKind === "ordinary") {
        const outcome = roll < clamp(hit.input.critRate, 0, 1) ? "critical" : "noncritical";
        if (decision.outcome !== outcome) issue([...path, "critical", "outcome"], "does not match the seeded roll against clamped critical rate");
      }
    } else {
      if (decision.roll !== null || decision.drawIndex !== null) issue([...path, "critical"], "configured and ineligible hits consume no critical-stream draw");
      if (sampling && decision.eligible && hit.inputKind === "ordinary" && !hasDamagePlugin) issue([...path, "critical", "mode"], "eligible hits must sample unless a damage plugin explicitly overrides critical mode");
    }
    if (hit.inputKind === "ordinary") {
      if (hit.input.hitWeakPoint !== weakPoints.get(event.id)) issue([...path, "input", "hitWeakPoint"], "must match the independently configured or source-owned weak-point fact");
      if (hit.stellarConduct !== undefined) {
        const field = hit.stellarConduct;
        if (execution.stellarConduct?.profileId !== "stellar-conduct-reference-v1") issue([...path, "stellarConduct"], "requires the explicit Stellar-Conduct execution profile");
        if (field.snapshotFrame > event.frame) issue([...path, "stellarConduct", "snapshotFrame"], "cannot snapshot after damage delivery");
        if ((event.element === "physical" ? event.frame : field.snapshotFrame) >= field.buffExpiresAtFrame) issue([...path, "stellarConduct", "buffExpiresAtFrame"], "field modifier must be active at its applicable snapshot or delivery");
        const allowedBonus = [0.2, 0.29, 0.3, 0.31, 0.32, 0.33, 0.34, 0.35, 0.36, 0.37, 0.38, 0.39, 0.4][field.activeCount]!;
        close(field.damageBonus, event.element === "cryo" || event.element === "electro" ? allowedBonus : 0, [...path, "stellarConduct", "damageBonus"]);
        close(field.physicalResistanceReduction, event.element === "physical" ? 0.4 : 0, [...path, "stellarConduct", "physicalResistanceReduction"]);
        close(hit.input.damageBonus, field.baseDamageBonus + field.damageBonus, [...path, "stellarConduct", "baseDamageBonus"]);
        close(hit.input.effectiveResistance, field.baseResistance - field.ordinaryResistanceShred - field.physicalResistanceReduction, [...path, "stellarConduct", "baseResistance"]);
      }
      if (event.kind !== "direct") issue([...path, "inputKind"], "ordinary input requires a direct damage event");
      const expectedOutcome = !decision.eligible ? "ineligible" : hit.input.critMode === "allCrit" ? "critical" : hit.input.critMode === "noCrit" ? "noncritical" : "expected";
      if (decision.outcome !== expectedOutcome) issue([...path, "critical", "outcome"], "must agree with the captured critical mode and eligibility");
      if (!decision.eligible && hit.input.critMode !== "noCrit") issue([...path, "input", "critMode"], "ineligible hits must use noCrit");
      if (hit.input.explicitReactionBase !== undefined && hit.input.explicitReactionBase <= 0) issue([...path, "input", "explicitReactionBase"], "must be positive when present");
      const expectedFactors = ordinaryFactors(hit.input);
      for (const [key, expected] of Object.entries(expectedFactors)) {
        const actual = event.damageFactors[key as keyof typeof expectedFactors];
        if (typeof expected === "number" && typeof actual === "number") close(actual, expected, [...path, "input", key]);
        else if (actual !== expected) issue([...path, "input", key], "does not match the damage factor");
      }
      close(event.em, hit.input.elementalMastery, [...path, "input", "elementalMastery"]);
      const f = expectedFactors;
      close(event.potentialDamage, f.baseDamage * f.damageBonusMultiplier * f.defenseMultiplier * f.resistanceMultiplier * f.critMultiplier * f.amplifyingReactionMultiplier * f.groupMultiplier, [...path, "input"]);
    } else {
      if (event.kind !== "transformative-reaction") issue([...path, "inputKind"], "transformative input requires a transformative reaction event");
      if (decision.mode !== "configured" || decision.eligible || decision.outcome !== "ineligible") issue([...path, "critical"], "transformative reactions are ineligible and consume no critical draw");
      const factors = event.transformativeReactionFactors;
      if (factors === null) { issue([...path, "input"], "requires transformative reaction factors"); continue; }
      for (const [key, expected] of Object.entries(hit.input)) close(factors[key as keyof typeof hit.input], expected, [...path, "input", key]);
      const levelBase = CLASSIC_REACTION_FORMULA_PROFILE.levelBaseDamageByLevel[hit.input.characterLevel - 1];
      if (levelBase === undefined) { issue([...path, "input", "characterLevel"], "requires an exact supported level from 1 to 100"); continue; }
      const em = Math.max(0, hit.input.elementalMastery);
      // The immutable event retains the independently validated reaction-group
      // decision. A blocked hit keeps its real formula inputs, then multiplies
      // by zero; capturing it must not rewrite its reaction coefficient to zero.
      const potential = levelBase * hit.input.baseMultiplier * (1 + 16 * em / (2000 + em) + Math.max(0, hit.input.reactionBonus)) * resistance(hit.input.effectiveResistance) * event.damageFactors.groupMultiplier;
      close(event.potentialDamage, potential, [...path, "input"]);
    }
  }
  if (audit.criticalSampling !== null && audit.criticalSampling.drawCount !== drawCount) issue(["criticalSampling", "drawCount"], "must equal the number of replayed critical draws");
  const coverage = audit.checkpointCoverage;
  if (coverage.complete && (coverage.missingDimensions.length !== 0 || coverage.reasons.length !== 0)) issue(["checkpointCoverage"], "complete coverage cannot have missing dimensions or blockers");
  if (!coverage.complete && coverage.reasons.length === 0) issue(["checkpointCoverage", "reasons"], "incomplete coverage requires an explicit reason");
  for (const dimension of coverage.missingDimensions) if (!(EXECUTION_CHECKPOINT_DIMENSIONS as readonly string[]).includes(dimension)) issue(["checkpointCoverage", "missingDimensions"], `unknown state dimension ${dimension}`);
  const requestedFrames = execution.checkpointFrames ?? [];
  if (coverage.complete && (audit.phaseCheckpoints.length !== requestedFrames.length || audit.phaseCheckpoints.some((checkpoint, index) => checkpoint.tick !== requestedFrames[index]))) issue(["phaseCheckpoints"], "complete coverage must contain every requested checkpoint in order");
  for (const [index, checkpoint] of audit.phaseCheckpoints.entries()) {
    if (!requestedFrames.includes(checkpoint.tick)) issue(["phaseCheckpoints", index, "tick"], "must correspond to an explicitly requested frame");
    if (index > 0 && checkpoint.tick <= audit.phaseCheckpoints[index - 1]!.tick) issue(["phaseCheckpoints", index, "tick"], "must increase strictly");
    // Checkpoints run before all events at tick, defining a half-open prefix.
    close(checkpoint.cumulativeDamage, result.damageEvents.filter(event => event.frame < checkpoint.tick).reduce((sum, event) => sum + event.finalDamage, 0), ["phaseCheckpoints", index, "cumulativeDamage"]);
    if (coverage.complete) for (const dimension of EXECUTION_CHECKPOINT_DIMENSIONS) if (checkpoint.state[dimension] === null) issue(["phaseCheckpoints", index, "state", dimension], "complete coverage cannot omit a state dimension");
    const random = (checkpoint.state.icdAndTriggerHistory as { randomExecution?: { streams: Record<string, { drawCount: number }> } } | null)?.randomExecution;
    if (random !== undefined) {
      const before = <T extends { frame: number }>(rows: T[]) => rows.filter(row => row.frame < checkpoint.tick);
      const expected: Record<string, number> = {
        critical: audit.hits.filter(hit => hit.critical.drawIndex !== null && result.damageEvents[hit.eventId]!.frame < checkpoint.tick).length,
        particleTrigger: before(result.particleTriggerLog).filter(row => row.drawIndex !== undefined && row.drawIndex !== null).length,
        normalHitEnergy: before(result.normalHitEnergyLog ?? []).at(-1)?.drawCountAfter ?? 0,
        favonius: before(result.favoniusLog ?? []).at(-1)?.drawCountAfter ?? 0,
        sacrificial: before(result.sacrificialLog ?? []).at(-1)?.drawCountAfter ?? 0,
        weaponProc: before(result.weaponProcLog ?? []).filter(row => row.random?.drawIndex !== undefined && row.random.drawIndex !== null).length,
        artifactDamage: before(result.artifactDamageLog ?? []).filter(row => row.random !== null).length,
        dendroCorePosition: before(result.dendroCoreLog).filter(row => row.operation === "spawn").length,
        crystallizePosition: before(result.crystallizeShardLog).filter(row => row.operation === "spawn").length,
      };
      for (const [name, count] of Object.entries(expected)) {
        if (random.streams[name] !== undefined && random.streams[name]!.drawCount !== count) issue(["phaseCheckpoints", index, "state", "icdAndTriggerHistory", "randomExecution", "streams", name, "drawCount"], "must equal the actual pre-boundary draws in this stream");
      }
    }
  }
}
