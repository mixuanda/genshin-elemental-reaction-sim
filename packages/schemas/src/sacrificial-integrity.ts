import type { RefinementCtx } from "zod";
import { canonicalStringify } from "./reproducibility";
import { validateSacrificialCommandIntegrity } from "./sacrificial-command-integrity";
import { replaySacrificial } from "./sacrificial-replay";
import { getRuntimeSkillCooldownActors } from "./skill-cooldown-model";
import type { SimulationResult } from "./types";

/** Imported cooldown rows are evidence to verify, never scheduling authority. */
export function validateSacrificialIntegrity(result: SimulationResult, context: RefinementCtx): void {
  const issue = (path: Array<string | number>, message: string): void => context.addIssue({ code: "custom", path, message });
  if (result.config.sacrificialModel === undefined && result.sacrificialLog !== undefined) {
    issue(["sacrificialLog"], "requires the explicit legal-timeline Sacrificial model");
  }
  if (getRuntimeSkillCooldownActors(result.config).size === 0) {
    if (result.skillCooldownLog !== undefined) issue(["skillCooldownLog"], "requires a skill with explicit cooldownStartFrame or a modeled Sacrificial holder");
    return;
  }
  const replay = replaySacrificial(result);
  if (replay.invalidCasts.length > 0) issue(["skillCooldownLog"], `accepted casts or delayed cooldown starts exceeded actual available charges: ${replay.invalidCasts.join(", ")}`);
  for (const [key, expectedRows] of [["sacrificialLog", replay.attempts], ["skillCooldownLog", replay.cooldowns]] as const) {
    if (key === "sacrificialLog" && result.config.sacrificialModel === undefined) continue;
    const rows = result[key];
    if (rows === undefined || rows.length !== expectedRows.length) issue([key], "requires the complete independently replayed source callbacks and serial cooldown transitions");
    for (const expected of expectedRows) {
      const row = rows?.[expected.id];
      if (row === undefined) continue;
      if (key === "skillCooldownLog" && !("artifactEventLogId" in expected) && "artifactEventLogId" in row) {
        issue([key, expected.id, "artifactEventLogId"], "only an independently replayed Gambler defeat reset may carry an artifact backlink");
      }
      for (const [field, value] of Object.entries(expected)) {
        // Worker queue sequence numbers include unrelated engine tasks. Their
        // source insertion order is verified below; reset/damage anchors are exact.
        if (field === "eventSequence" && value === null) continue;
        const actual = (row as unknown as Record<string, unknown>)[field];
        const equal = typeof actual === "number" && typeof value === "number"
          ? Math.abs(actual - value) <= 1e-9 * Math.max(1, Math.abs(actual), Math.abs(value))
          : canonicalStringify(actual) === canonicalStringify(value);
        if (!equal) issue([key, expected.id, field], "must match actual command/hit provenance, source filter order, named RNG, and serial charge replay");
      }
      const previous = rows?.[expected.id - 1];
      if (previous !== undefined && previous.frame === row.frame && previous.eventPriority === row.eventPriority &&
          (previous.eventSequence > row.eventSequence || key === "skillCooldownLog" && previous.eventSequence === row.eventSequence)) {
        issue([key, expected.id, "eventSequence"], "same-frame transitions must retain actual source task insertion order");
      }
    }
  }
  validateSacrificialCommandIntegrity(result, context);
}
