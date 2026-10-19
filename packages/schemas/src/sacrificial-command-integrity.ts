import type { RefinementCtx } from "zod";
import { createSerialSkillCooldown, serialSkillCooldownWorker } from "@genshin-dps-lab/reaction-formulas";
import { actionEventPriority } from "./action-condition-integrity";
import { replaySacrificial, type SacrificialReplay } from "./sacrificial-replay";
import { getRuntimeSkillCooldownActors } from "./skill-cooldown-model";
import type { SimulationResult } from "./types";

/** Inspect only source-replayed transitions from earlier commands. A reset
 * after the input phase becomes usable on the next frame; earlier commands
 * at the same input phase have already consumed their charges. */
function earliestReadyFrame(
  cooldowns: SacrificialReplay["cooldowns"], actorId: string, baseFrame: number,
  actionPriority: number, maxCharges: number, durationFrames: number
): number {
  if (baseFrame > durationFrames) return baseFrame;
  const rows = cooldowns.filter(row => row.actorId === actorId);
  const candidates = [...new Set([baseFrame, ...rows.map(row =>
    row.frame + Number(row.eventPriority > actionPriority))])]
    .filter(frame => frame >= baseFrame)
    .sort((left, right) => left - right);
  let state = createSerialSkillCooldown(maxCharges);
  let rowIndex = 0;
  for (const frame of candidates) {
    while (rowIndex < rows.length) {
      const row = rows[rowIndex]!;
      if (row.frame > frame || row.frame === frame && row.eventPriority > actionPriority) break;
      state = row.stateAfter;
      rowIndex++;
    }
    if (state.availableCharges > 0) return frame;
  }
  return Math.max(candidates[candidates.length - 1]!, serialSkillCooldownWorker(state)?.frame ?? durationFrames + 1);
}

/** The imported cooldown audit cannot justify when a skill command ran.
 * Its earliest legal frame comes from a fresh prefix replay which excludes
 * the current and every later command, including their hits and resets. */
export function validateSacrificialCommandIntegrity(result: SimulationResult, context: RefinementCtx): void {
  const timeline = result.config.timeline;
  const execution = result.timelineExecution;
  const actors = getRuntimeSkillCooldownActors(result.config);
  if (actors.size === 0 || timeline === undefined || execution === undefined) return;
  const abilities = new Map(timeline.abilities.map(ability => [ability.id, ability]));
  const durationFrames = Math.round(result.config.duration * 60);
  const issue = (path: Array<string | number>, message: string): void =>
    context.addIssue({ code: "custom", path, message });

  for (const [commandIndex, command] of timeline.commands.entries()) {
    if (!("abilityId" in command)) continue;
    const ability = abilities.get(command.abilityId);
    if (ability?.kind !== "skill" || !actors.has(ability.actorId)) continue;
    const executed = execution.commandResults[commandIndex];
    if (executed === undefined || executed.status === "rejected" &&
        executed.failureCode !== "INSUFFICIENT_ENERGY" && executed.failureCode !== "OUT_OF_DURATION") continue;

    const adjustments = execution.adjustments.filter(row => row.commandIndex === commandIndex);
    // The existing timeline facet authenticates requestedFrame and overlap.
    // Cooldown precedes stamina, so a stamina-delayed start is not this base.
    const baseFrame = adjustments.find(row => row.code === "ACTION_OVERLAP")?.executedFrame ?? executed.requestedFrame;
    const prefix = replaySacrificial(result, commandIndex);
    const readyFrame = earliestReadyFrame(prefix.cooldowns, ability.actorId, baseFrame,
      actionEventPriority(ability), ability.maxCharges ?? 1, durationFrames);
    const cooldownAdjustments = adjustments.filter(row => row.code === "ABILITY_ON_COOLDOWN");
    const needsWait = readyFrame > baseFrame;
    if (cooldownAdjustments.length !== Number(needsWait)) {
      issue(["timelineExecution", "adjustments"],
        `skill command ${commandIndex} requires ${Number(needsWait)} cooldown adjustment from its independently replayed prefix`);
    }
    for (const adjustment of cooldownAdjustments) {
      if (adjustment.requestedFrame !== baseFrame || adjustment.executedFrame !== readyFrame ||
          adjustment.waitedFrames !== readyFrame - baseFrame) {
        issue(["timelineExecution", "adjustments", execution.adjustments.indexOf(adjustment)],
          `skill command ${commandIndex} must wait from frame ${baseFrame} to its first usable charge at frame ${readyFrame}`);
      }
    }

    const stamina = adjustments.find(row => row.code === "INSUFFICIENT_STAMINA");
    const expectedAttemptFrame = readyFrame > durationFrames ? readyFrame : stamina?.executedFrame ?? readyFrame;
    const failure = execution.failures.find(row => row.commandIndex === commandIndex);
    const actualAttemptFrame = executed.startFrame ?? failure?.frame;
    if (actualAttemptFrame !== expectedAttemptFrame) {
      issue(["timelineExecution", "commandResults", commandIndex, "startFrame"],
        "skill command must use the independently replayed cooldown frame before its existing stamina adjustment");
    }
    if ((expectedAttemptFrame > durationFrames) !== (executed.failureCode === "OUT_OF_DURATION")) {
      issue(["timelineExecution", "commandResults", commandIndex, "failureCode"],
        "skill command duration failure must match the independently replayed attempt frame");
    }
  }
}
