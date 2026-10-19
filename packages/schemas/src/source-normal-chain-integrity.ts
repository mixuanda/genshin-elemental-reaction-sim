import type { RefinementCtx } from "zod";
import { actionEventPriority, actionOwner } from "./action-condition-integrity";
import { canonicalStringify } from "./reproducibility";
import { SOURCE_NORMAL_CHAIN_PROFILE_ID, SOURCE_NORMAL_CHAIN_SOURCE_REFS, type SourceNormalChainLogEntry, type SourceNormalChainState } from "./source-normal-chain";
import type { SimulationResult } from "./types";
import { getSourceNormalChainMetadata, sourceNormalStateScopeConflicts } from "./source-normal-family";

/** Reconstruct only the source counter from accepted action identities. Log
 * before/after values never seed replay, and damage-hit count is irrelevant. */
export function validateSourceNormalChainIntegrity(result: SimulationResult & {
  sourceNormalChainLog?: SourceNormalChainLogEntry[]; sourceNormalChainState?: SourceNormalChainState;
}, context: RefinementCtx): void {
  const issue = (path: Array<string | number>, message: string) => context.addIssue({ code: "custom", path, message });
  const equal = (path: Array<string | number>, actual: unknown, expected: unknown) => {
    if (actual === undefined || expected === undefined ? actual !== expected : canonicalStringify(actual) !== canonicalStringify(expected)) issue(path, "must match accepted-input source normal-chain replay");
  };
  const actorIds = [...new Set((result.config.sourceAbilityBindings ?? []).filter(binding => getSourceNormalChainMetadata(binding.sourceActionId) !== undefined).map(binding => binding.actorId))];
  if (!actorIds.length) {
    if (result.sourceNormalChainLog !== undefined || result.sourceNormalChainState !== undefined) issue(["sourceNormalChainLog"], "normal-chain output requires bound source normal abilities");
    return;
  }
  const bindings = result.config.sourceAbilityBindings!, rows = result.sourceNormalChainLog;
  for (const conflict of sourceNormalStateScopeConflicts(result.config)) issue(["config", "timeline", "commands", conflict.commandIndex], "input conflicts with the explicitly declared source normal state scope");
  const state: SourceNormalChainState = { actors: actorIds.map(actorId => {
    const chain = getSourceNormalChainMetadata(bindings.find(binding => binding.actorId === actorId && getSourceNormalChainMetadata(binding.sourceActionId) !== undefined)!.sourceActionId)!;
    return { actorId, chainId: chain.id, length: chain.length, nextIndex: 1 };
  }) };
  for (const actorId of actorIds) {
    const normals = bindings.filter(binding => binding.actorId === actorId && getSourceNormalChainMetadata(binding.sourceActionId) !== undefined);
    const actor = state.actors.find(actor => actor.actorId === actorId)!;
    if (normals.length !== actor.length || new Set(normals.map(binding => binding.sourceActionId)).size !== actor.length ||
        normals.some(binding => getSourceNormalChainMetadata(binding.sourceActionId)!.id !== actor.chainId) || new Set(normals.map(binding => binding.talentLevel)).size !== 1) {
      issue(["config", "sourceAbilityBindings"], "source normal-chain replay requires every segment with one shared normal talent level");
    }
  }
  if (rows === undefined || result.sourceNormalChainState === undefined) issue(["sourceNormalChainLog"], "source normal abilities require the complete accepted-input log and final state");
  type Expected = { frame: number; priority: number; commandIndex: number; actorId: string; kind: SourceNormalChainLogEntry["kind"];
    actionId: string | null; sourceAbilityId: string | null; actionLogIndex: number | null; normalIndex: number | null };
  const expected: Expected[] = [];
  const commands = result.config.timeline?.commands ?? [];
  for (const [actionLogIndex, action] of result.actionLog.entries()) {
    const commandIndex = action.timelineCommandIndex;
    if (commandIndex === undefined) continue; // Initial SetActive is not a Player.Exec input.
    const command = commands[commandIndex];
    if (!command || command.type === "wait" || command.type === "pickUpCrystallize") continue;
    if (command.type === "normal" && !actorIds.includes(action.actorId)) continue;
    const binding = bindings.find(row => row.abilityId === action.sourceAbilityId && row.actorId === action.actorId);
    const normalIndex = command.type === "normal" && binding ? getSourceNormalChainMetadata(binding.sourceActionId)?.index ?? null : null;
    if (command.type === "normal" && normalIndex === null) issue(["actionLog", actionLogIndex], "a tracked source actor cannot advance from an unbound normal ability");
    expected.push({ frame: action.frame, priority: actionEventPriority(actionOwner(result.config, action)), commandIndex,
      actorId: action.actorId, kind: command.type === "normal" ? "normal-accepted" : command.type === "swap" ? "swap-complete-reset" : "non-normal-reset",
      actionId: action.actionId, sourceAbilityId: action.sourceAbilityId ?? null, actionLogIndex, normalIndex });
  }
  let active = result.config.timeline?.initialActiveCharacterId ?? result.config.characters[0]!.id;
  for (const command of result.timelineExecution?.commandResults ?? []) {
    if (command.commandType !== "swap" || command.status === "rejected" || command.startFrame === null || command.actorId === null) continue;
    if (command.actorId === active) { issue(["timelineExecution", "commandResults", command.commandIndex], "same-actor swap is a no-op and cannot reset a source normal chain"); continue; }
    if (command.startFrame <= Math.round(result.config.duration * 60)) expected.push({ frame: command.startFrame, priority: 8, commandIndex: command.commandIndex,
      actorId: active, kind: "swap-start-reset", actionId: null, sourceAbilityId: null, actionLogIndex: null, normalIndex: null });
    active = command.actorId;
  }
  expected.sort((a, b) => a.frame - b.frame || a.priority - b.priority || a.commandIndex - b.commandIndex);
  if (rows?.length !== expected.length) issue(["sourceNormalChainLog"], "must contain exactly the accepted normal inputs and source resets, including both real swap phases");
  expected.forEach((event, index) => {
    const before = structuredClone(state), actor = state.actors.find(row => row.actorId === event.actorId);
    if (event.kind === "normal-accepted") {
      if (!actor || event.normalIndex !== actor.nextIndex) issue(["actionLog", event.actionLogIndex ?? 0], "accepted normal must use the source segment selected by the prior counter");
      if (actor) actor.nextIndex = actor.nextIndex === actor.length ? 1 : actor.nextIndex + 1;
    } else for (const actor of state.actors) actor.nextIndex = 1;
    const row = rows?.[index];
    if (!row) return;
    const path = ["sourceNormalChainLog", index];
    for (const [key, value] of Object.entries({ id: index, profileId: SOURCE_NORMAL_CHAIN_PROFILE_ID, kind: event.kind,
      frame: event.frame, eventPriority: event.priority, actorId: event.actorId, actionId: event.actionId,
      sourceAbilityId: event.sourceAbilityId, timelineCommandIndex: event.commandIndex, actionLogIndex: event.actionLogIndex,
      normalIndex: event.normalIndex, stateBefore: before, stateAfter: state, sourceRefs: SOURCE_NORMAL_CHAIN_SOURCE_REFS })) equal([...path, key], row[key as keyof SourceNormalChainLogEntry], value);
    if (Math.abs(row.timeSeconds - event.frame / 60) > 1e-9) issue([...path, "timeSeconds"], "must match the actual accepted frame");
    const previous = rows?.[index - 1];
    if (previous && previous.frame === row.frame && previous.eventPriority === row.eventPriority &&
        (previous.eventSequence > row.eventSequence || previous.eventSequence === row.eventSequence && previous.intraEventSequence >= row.intraEventSequence)) {
      issue([...path, "eventSequence"], "same-frame source decisions must preserve actual heap and intra-event order");
    }
  });
  equal(["sourceNormalChainState"], result.sourceNormalChainState, state);
}
