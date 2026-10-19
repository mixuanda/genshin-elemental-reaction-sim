import type { RefinementCtx } from "zod";
import { replayThrillingTales } from "./thrilling-tales-replay";
import type { SimulationResult } from "./types";

/** The accepted action/energy facets prove each attempted action; this facet
 * derives transfers and source-state lifetimes without trusting transfer logs. */
export function validateThrillingTalesIntegrity(result: SimulationResult, context: RefinementCtx): void {
  const issue = (path: Array<string | number>, message: string): void => context.addIssue({ code: "custom", path, message });
  const rows = result.thrillingTalesLog;
  if (result.config.thrillingTalesModel === undefined) {
    if (rows !== undefined) issue(["thrillingTalesLog"], "requires the explicit source-backed Thrilling Tales model");
    return;
  }
  const { attempts } = replayThrillingTales(result);
  if (rows === undefined || rows.length !== attempts.length) issue(["thrillingTalesLog"], "requires exactly one decision for every actual switch away from a declared owner");
  for (const { expected } of attempts) {
    const row = rows?.[expected.id];
    if (row === undefined) continue;
    const path: Array<string | number> = ["thrillingTalesLog", expected.id];
    for (const [field, value] of Object.entries(expected)) {
      const actual = row[field as keyof typeof expected];
      const same = typeof value === "number" && typeof actual === "number"
        ? Math.abs(actual - value) <= 1e-9 * Math.max(1, Math.abs(actual), Math.abs(value)) : actual === value;
      if (!same) issue([...path, field], "must match source replay of actual swaps, owner cooldown, and shared recipient state");
    }
    if (expected.actionLogIndex !== null) {
      const anchor = result.energyCostLog?.find(entry => entry.operation === "reserve" && entry.actionLogIndex === expected.actionLogIndex)
        ?? result.statConversionLog?.find(entry => entry.actionLogIndex === expected.actionLogIndex)
        ?? result.actionConditionLog?.find(entry => entry.actionLogIndex === expected.actionLogIndex);
      if (anchor !== undefined && row.eventSequence !== anchor.eventSequence) issue([...path, "eventSequence"], "must share the actual action's event sequence");
    }
    const previous = rows?.[expected.id - 1];
    if (previous !== undefined && previous.frame === row.frame && previous.eventPriority === row.eventPriority && previous.eventSequence >= row.eventSequence) {
      issue([...path, "eventSequence"], "same-frame source swaps must retain their actual action queue order");
    }
  }
}
