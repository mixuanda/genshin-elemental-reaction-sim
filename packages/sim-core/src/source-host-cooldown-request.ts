/** Verify the native cooldown handoff before replaying its numeric formula. */
import { resolveSourceHostCooldownInput, sourceHostCooldownRouteTargets, type SourceHostCooldownInput } from "./source-host-cooldown-formula";
import type { CalculationTraceNode } from "./calculation-trace";
import { SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT, type SourceHostCooldownRequest, type SourceHostCalculationRecord } from "./source-host-wire";

type Lookup = ReadonlyMap<number, SourceHostCalculationRecord>;
type Calculation = { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] };

const terminal: Record<SourceHostCooldownInput["operation"], string> = {
  source: "source", route: "routed", remaining: "remaining", reduce: "reduced",
  "special-reduce": "specialReduced", duration: "duration",
};

function sameValue(actual: number, expected: number): boolean {
  return Number.isFinite(actual) && Number.isFinite(expected)
    && Math.abs(actual - expected) <= 1e-10 * Math.max(1, Math.abs(expected));
}

/** Native calls may have no producer record; a present parent must be the one actual handoff. */
export function sourceHostCooldownParentIds(request: SourceHostCooldownRequest): number[] {
  if (request.componentApplications.length || request.componentIds.length > 1)
    throw new Error("冷却请求只能引用一个真实上游冷却计算。");
  const operation = request.input.operation;
  if ((operation === "source" || operation === "duration") && request.componentIds.length)
    throw new Error("冷却来源或持续帧数计算不应携带上游记录。");
  return request.componentIds;
}

export function resolveSourceHostCooldownRequest(
  request: SourceHostCooldownRequest, components: Lookup,
  resolve: (request: SourceHostCalculationRecord["request"], components: Lookup) => Calculation,
): Calculation {
  if (request.ability !== request.input.action ||
    ((request.input.operation === "remaining" || request.input.operation === "special-reduce")
      && request.input.currentFrame !== request.frame))
    throw new Error("冷却公式与原生动作或读取帧不一致。");
  const input = request.input;
  const commit = request.sourceCommit ?? SOURCE_HOST_COMMIT;
  if (input.operation === "route") {
    const expected = input.rule === "cyno" ? "cyno" : input.rule === "odette" ? "odette" : "varka";
    if (request.actorKey !== expected ||
      (input.rule === "varka-classic" && commit !== SOURCE_HOST_COMMIT) ||
      ((input.rule === "varka-stellar" || input.rule === "odette") && commit !== SOURCE_HOST_STELLAR_COMMIT))
      throw new Error("冷却转发角色或固定来源版本与原生覆写不一致。");
  }
  if (input.operation === "special-reduce" && request.actorKey !== "varka")
    throw new Error("四风独立计时器的角色身份不一致。");

  const ids = sourceHostCooldownParentIds(request);
  const pure = resolveSourceHostCooldownInput(input, commit, `cooldown.${request.id}`);
  if (!ids.length) return pure;
  const parent = components.get(ids[0]!);
  if (!parent || parent.request.kind !== "character-cooldown" || parent.request.id !== ids[0] ||
    parent.request.id >= request.id || parent.request.frame !== request.frame ||
    parent.request.sourceFrame !== request.sourceFrame ||
    parent.request.actorIndex !== request.actorIndex || parent.request.actorKey !== request.actorKey ||
    (parent.request.sourceCommit ?? SOURCE_HOST_COMMIT) !== commit)
    throw new Error("冷却上游计算的身份、时间或固定来源不一致。");
  const parentInput = parent.request.input;
  if (input.operation === "route") {
    if (parentInput.operation !== "source" || parentInput.action !== input.action || parentInput.actionType !== input.actionType)
      throw new Error("角色冷却转发必须直接接收本次如雷来源值。");
  } else if (parentInput.operation !== "source" && parentInput.operation !== "route") {
    throw new Error("实际冷却消费必须来自原始来源或角色转发。");
  }
  if (input.operation === "special-reduce" &&
    (parentInput.operation !== "route" || parentInput.rule !== "varka-classic" || !parentInput.specialActive))
    throw new Error("四风独立计时器必须接收瓦尔卡已激活的本次技能转发。");
  if (input.operation !== "route") {
    const targets = parentInput.operation === "route" ? sourceHostCooldownRouteTargets(parentInput) : [parentInput.actionType];
    if (!targets.includes(input.actionType)) throw new Error("实际冷却动作不属于原生转发目标。");
    if (parentInput.operation === "source" && parentInput.action !== input.action)
      throw new Error("实际冷却动作与直接来源不一致。");
  }
  if ((input.operation === "route" || input.operation === "reduce" || input.operation === "special-reduce")
    && !sameValue(input.reduction, parent.value))
    throw new Error("冷却传递的缩短帧数与上游实际返回值不一致。");
  const resolvedParent = resolve(parent.request, components);
  if (!sameValue(resolvedParent.value, parent.value)) throw new Error("冷却上游计算无法复现原生返回值。");
  const parentTerminal = `cooldown.${parent.request.id}.${terminal[parentInput.operation]}`;
  const linked = pure.trace.map(node => ({ ...node, inputs: node.inputs.map(value =>
    value.key === "reduction" && (input.operation === "route" || input.operation === "reduce" || input.operation === "special-reduce")
      ? { ...value, origin: { kind: "source-host-cooldown", reference: parentTerminal } } : value),
  }));
  return { ...pure, trace: [...resolvedParent.trace, ...linked],
    explanationGaps: [...resolvedParent.explanationGaps, ...pure.explanationGaps] };
}
