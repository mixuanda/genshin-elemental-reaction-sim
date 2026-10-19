import type { RefinementCtx } from "zod";
import { canonicalStringify } from "./reproducibility";
import { getSourceNormalChainMetadata } from "./source-normal-family";
import type { AbilityDefinition, ActionDefinition, ConditionalHitGroup, SimConfig, SimulationResult } from "./types";

type ActionOwner = ActionDefinition | AbilityDefinition;
type ActionIdentity = { actorId: string; actionId: string; sourceAbilityId?: string; timelineCommandIndex?: number };

export function actionOwner(config: Pick<SimConfig, "rotation" | "timeline" | "sourceAbilityBindings">, action: ActionIdentity): ActionOwner | undefined {
  const command = action.timelineCommandIndex === undefined ? undefined : config.timeline?.commands[action.timelineCommandIndex];
  if (action.sourceAbilityId === undefined && command && (command.type === "dash" || command.type === "jump" || command.type === "walk") &&
      config.sourceAbilityBindings?.some(binding => getSourceNormalChainMetadata(binding.sourceActionId) !== undefined)) {
    return { id: action.actionId, actorId: action.actorId, name: action.actionId, at: 0, actionPhase: "after-frame-tasks-v1" };
  }
  return action.sourceAbilityId === undefined
    ? config.rotation.find(owner => owner.id === action.actionId && owner.actorId === action.actorId)
    : config.timeline?.abilities.find(owner => owner.id === action.sourceAbilityId && owner.actorId === action.actorId);
}

export function actionEventPriority(owner: Pick<ActionOwner, "actionPhase"> | undefined): number {
  return owner?.actionPhase === "after-frame-tasks-v1" ? 8 : 0;
}

export function actionChildEventPriority(owner: Pick<ActionOwner, "actionPhase"> | undefined, childDelayFrames: number, basePriority: number): number {
  return basePriority + (owner?.actionPhase === "after-frame-tasks-v1" && childDelayFrames === 0 ? 10 : 0);
}

/** Reads already validated shared HP transitions strictly before action acceptance. */
export function actionConditionState(result: SimulationResult, actionLogIndex: number): { ownerCurrentHp: number; ownerMaxHp: number } {
  const action = result.actionLog[actionLogIndex]!;
  const actor = result.config.characters.find(character => character.id === action.actorId)!;
  let ownerMaxHp = actor.stats.baseHp * (1 + actor.stats.hpPct) + actor.stats.flatHp;
  const initialRatio = result.config.playerDamageModel.mode === "reaction-self-v1"
    ? result.config.playerDamageModel.characters.find(character => character.actorId === actor.id)!.initialHpRatio : 0;
  const priority = actionEventPriority(actionOwner(result.config, action));
  let ownerCurrentHp = ownerMaxHp * initialRatio;
  for (const point of result.playerHpTimeline.points) {
    if (point.actorId !== actor.id || point.operation === "simulation-end") continue;
    if (point.operation === "initial" || point.frame < action.frame ||
        point.frame === action.frame && point.eventPriority !== null && point.eventPriority < priority) {
      ownerCurrentHp = point.hpAfter;
      if (result.config.playerMaxHpModel !== undefined) ownerMaxHp = point.maxHp;
    }
  }
  return { ownerCurrentHp, ownerMaxHp };
}

export function actionConditionSelected(result: SimulationResult, actionLogIndex: number, group: ConditionalHitGroup): boolean {
  const hp = actionConditionState(result, actionLogIndex);
  return hp.ownerCurrentHp <= hp.ownerMaxHp * group.thresholdRatio;
}

export function isActionHitSelected(result: SimulationResult, actionLogIndex: number, hitId: string): boolean {
  const owner = actionOwner(result.config, result.actionLog[actionLogIndex]!);
  const group = owner?.conditionalHitGroups?.find(candidate => candidate.hitIds.includes(hitId));
  return group === undefined || actionConditionSelected(result, actionLogIndex, group);
}

export function validateActionConditionIntegrity(result: SimulationResult, context: RefinementCtx): void {
  const configured = [...result.config.rotation, ...(result.config.timeline?.abilities ?? [])].some(owner => owner.conditionalHitGroups?.length);
  const rows = result.actionConditionLog;
  const issue = (path: Array<string | number>, message: string): void => context.addIssue({ code: "custom", path, message });
  if (!configured) {
    if (rows !== undefined) issue(["actionConditionLog"], "requires configured conditional hit groups");
    return;
  }
  const expected = result.actionLog.flatMap((action, actionLogIndex) => {
    const owner = actionOwner(result.config, action);
    return (owner?.conditionalHitGroups ?? []).map(group => ({ action, actionLogIndex, owner, group }));
  });
  if (rows === undefined || rows.length !== expected.length) issue(["actionConditionLog"], "must contain one decision for each accepted action conditional group");
  const near = (left: number, right: number): boolean => Math.abs(left - right) <= 1e-8 * Math.max(1, Math.abs(left), Math.abs(right));
  expected.forEach(({ action, actionLogIndex, owner, group }, index) => {
    const row = rows?.[index];
    if (row === undefined) return;
    const path: Array<string | number> = ["actionConditionLog", index];
    const hp = actionConditionState(result, actionLogIndex);
    const identity = { id: index, actionLogIndex, actorId: action.actorId, actionId: action.actionId, groupId: group.id,
      frame: action.frame, eventPriority: actionEventPriority(owner), selected: hp.ownerCurrentHp <= hp.ownerMaxHp * group.thresholdRatio };
    for (const [field, value] of Object.entries(identity)) if (row[field as keyof typeof identity] !== value) issue([...path, field], "must match the accepted action and independent HP condition replay");
    for (const [field, value] of Object.entries({ ...hp, thresholdRatio: group.thresholdRatio, timeSeconds: action.frame / 60 })) {
      if (!near(row[field as keyof typeof hp | "thresholdRatio" | "timeSeconds"], value)) issue([...path, field], "must equal shared owner HP state before the action and the configured threshold");
    }
    if (row.hitIds.length !== group.hitIds.length || row.hitIds.some((id, hitIndex) => id !== group.hitIds[hitIndex])) issue([...path, "hitIds"], "must preserve the declared conditional hit IDs");
    const actionAnchor = result.energyCostLog?.find(entry => entry.actionLogIndex === actionLogIndex && entry.operation === "reserve")
      ?? result.statConversionLog?.find(entry => entry.actionLogIndex === actionLogIndex);
    if (actionAnchor !== undefined && (row.eventSequence !== actionAnchor.eventSequence || row.eventPriority !== actionAnchor.eventPriority)) issue([...path, "eventSequence"], "must share the actual accepted action tuple with its energy reservation or stat conversion");
    validateConditionTrace(row.trace, group, hp, [...path, "trace"], issue);
    const previous = rows?.[index - 1];
    if (previous !== undefined && previous.actionLogIndex === actionLogIndex && previous.eventSequence !== row.eventSequence) issue([...path, "eventSequence"], "groups accepted by one action must share its actual event sequence");
  });
}


/** This contract has exactly two AST nodes; it does not accept arbitrary imported formulas. */
function validateConditionTrace(trace: unknown[], group: ConditionalHitGroup,
  hp: { ownerCurrentHp: number; ownerMaxHp: number }, path: Array<string | number>,
  issue: (path: Array<string | number>, message: string) => void): void {
  const prefix = `action-condition.${group.id}`;
  const threshold = hp.ownerMaxHp * group.thresholdRatio;
  const selected = hp.ownerCurrentHp <= threshold ? 1 : 0;
  const variable = (key: string) => ({ kind: "variable", key });
  const expected = [
    { id: `${prefix}.threshold`,
      expression: { kind: "multiply", terms: [variable("ownerMaxHp"), variable("thresholdRatio")] },
      values: [hp.ownerMaxHp, group.thresholdRatio], keys: ["ownerMaxHp", "thresholdRatio"], units: ["HP", "ratio"],
      origins: ["accepted-action-shared-hp", "declared-action-condition"],
      value: threshold, unit: "HP", childIds: [] as string[], symbolicFormula: "(ownerMaxHp × thresholdRatio)",
      substitution: `(${hp.ownerMaxHp} × ${group.thresholdRatio})` },
    { id: `${prefix}.selected`,
      expression: { kind: "condition", operator: "lte", left: variable("ownerCurrentHp"), right: variable("threshold"),
        whenTrue: { kind: "constant", value: 1 }, whenFalse: { kind: "constant", value: 0 } },
      values: [hp.ownerCurrentHp, threshold], keys: ["ownerCurrentHp", "threshold"], units: ["HP", "HP"],
      origins: ["accepted-action-shared-hp", { kind: "previous-step", reference: `${prefix}.threshold` }],
      value: selected, unit: "boolean", childIds: [`${prefix}.threshold`], symbolicFormula: "(if ownerCurrentHp ≤ threshold then 1 else 0)",
      substitution: `(if ${hp.ownerCurrentHp} ≤ ${threshold} then 1 else 0)` }
  ];
  const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
  const same = (left: unknown, right: unknown): boolean => {
    try { return canonicalStringify(left) === canonicalStringify(right); } catch { return false; }
  };
  if (trace.length !== expected.length) issue(path, "requires exactly the threshold and selection formula nodes");
  expected.forEach((definition, index) => {
    const node = trace[index];
    if (!record(node)) { issue([...path, index], "requires a structured condition formula node"); return; }
    const identity = { id: definition.id, ruleId: definition.id, status: "assumed", expression: definition.expression,
      childIds: definition.childIds, sourceRefs: group.sourceRefs, warnings: [], symbolicFormula: definition.symbolicFormula,
      substitution: definition.substitution, result: { value: definition.value,
        display: new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 6 }).format(definition.value), unit: definition.unit } };
    for (const [field, value] of Object.entries(identity)) if (!same(node[field], value)) issue([...path, index, field], "must reproduce the declared condition AST, actual numerical substitution, and evaluated result");
    if (typeof node.titleKey !== "string" || !node.titleKey.trim() || typeof node.explanationKey !== "string" || !node.explanationKey.trim()) issue([...path, index], "requires a title and explanation");
    if (!Array.isArray(node.inputs) || node.inputs.length !== 2) { issue([...path, index, "inputs"], "requires exactly the two defined formula inputs"); return; }
    node.inputs.forEach((input, inputIndex) => {
      const expectedInput = { key: definition.keys[inputIndex], value: definition.values[inputIndex], unit: definition.units[inputIndex], origin: definition.origins[inputIndex] };
      if (!record(input) || Object.entries(expectedInput).some(([field, value]) => !same(input[field], value)) || typeof input.meaningKey !== "string" || !input.meaningKey.trim()) issue([...path, index, "inputs", inputIndex], "must define the actual shared HP input or preceding threshold result");
    });
  });
}
