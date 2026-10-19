/** Counterfactual arithmetic on one captured, source-owned artifact damage addition. */
import { replaySourceHostHit } from "./source-host-capture";
import { resolveSourceHostRequest, type SourceHostCalculation } from "./source-host-formula";
import { resolveSourceHostArtifactAdditiveInput, sourceHostArtifactAdditiveInputSchema,
  type SourceHostArtifactAdditiveInput } from "./source-host-artifact-additive-formula";
import type { CalculationTraceNode } from "./calculation-trace";
import type { SourceHostCalculationRecord, SourceHostOutgoingRequest } from "./source-host-wire";

export type SourceHostArtifactAdditiveEditResult =
  | { status: "calculated"; originalValue: number; editedValue: number; formulaTrace: CalculationTraceNode[];
      originalRawDamage: number; editedRawDamage: number; editedRequest: SourceHostOutgoingRequest; calculation: SourceHostCalculation }
  | { status: "blocked"; originalValue: number; editedValue: number; formulaTrace: CalculationTraceNode[];
      originalRawDamage: number; reason: string };

/** The event state and Echoes statRead remain historical evidence. Only this
 * scalar input is changed; native probability, consumption and queue are not replayed. */
export function deriveSourceHostArtifactAdditiveEdit(rawCapture: unknown, calculationId: number, rawInput: unknown): SourceHostArtifactAdditiveEditResult {
  const capture = replaySourceHostHit(rawCapture).captured;
  const original = capture.components.find(row => row.request.id === calculationId);
  if (original?.request.kind !== "artifact-additive") throw new Error(`捕获未引用圣遗物附加值共享公式 #${calculationId}`);
  const input: SourceHostArtifactAdditiveInput = sourceHostArtifactAdditiveInputSchema.parse(rawInput);
  if (input.ruleId !== original.request.input.ruleId) throw new Error("圣遗物附加伤害实验不能更换来源规则。");
  const formula = resolveSourceHostArtifactAdditiveInput(input, capture.sourceCommit, `artifactAdditive.${calculationId}.edit`);
  const formulaTrace = formula.trace.map(node => ({ ...node,
    explanationKey: `独立数值实验；原 Go 触发窗口、随机数、剩余次数、排队和属性回执均未改写。${node.explanationKey}`,
    inputs: node.inputs.map(value => value.key === "sourceValue"
      ? { ...value, origin: "user-edited-artifact-additive-experiment", meaningKey: "用户独立实验输入；原始 Go sourceValue 与 statRead 保持不变" } : value),
  }));
  const common = { originalValue: original.value, editedValue: formula.value, formulaTrace,
    originalRawDamage: capture.application.rawDamage };
  const blocked = (reason: string): SourceHostArtifactAdditiveEditResult => ({ status: "blocked", ...common, reason });
  const request: SourceHostOutgoingRequest = structuredClone(capture.calculation.request);
  if (request.kind !== "damage" || request.damageCategory !== "ordinary") return blocked("该附加值进入非普通终端伤害路径，无法将单项变化当作完整命中重算。");
  const applied = request.componentApplications.filter(row => row.id === calculationId);
  if (applied.length !== 1 || !request.componentIds.includes(calculationId) || applied[0]!.multiplier !== 1
    || applied[0]!.amount !== original.value) return blocked("原生圣遗物返回值没有唯一、等额地进入本击 FlatDmg。");
  const records: SourceHostCalculationRecord[] = [...(capture.supportingCalculations ?? []), ...capture.components];
  const lookup = new Map(records.map(row => [row.request.id, row]));
  if (lookup.size !== records.length) throw new Error("来源圣遗物捕获包含重复计算 ID。");
  const difference = formula.value - original.value;
  request.input.flatDamage += difference;
  applied[0]!.amount = formula.value;
  const calculation = resolveSourceHostRequest(request, lookup, {
    explicitFinalScaling: difference !== 0,
    artifactEdit: { id: calculationId, value: formula.value, trace: formulaTrace },
  });
  return { status: "calculated", ...common, editedRawDamage: calculation.value, editedRequest: request, calculation };
}
