/** Source-owned arithmetic that writes the complete AttackInfo.Mult ratio. */
import { z } from "zod";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterModifierDynamicParameter, SourceHostCharacterModifierDynamicStatLeaf } from "./source-host-character-modifier-dynamic-formula";
import { characterMultiplierGroupA } from "./source-host-character-multiplier-group-a";
import { characterMultiplierGroupB } from "./source-host-character-multiplier-group-b";
import { characterMultiplierGroupC } from "./source-host-character-multiplier-group-c";

export interface SourceHostCharacterMultiplierDescriptor {
  character: string;
  title: string;
  sourceFile: string;
  sourceCommits: readonly string[];
  operation: "set" | "add" | "multiply";
  /** A producer may cache an ATK value without attaching it as an attack ratio. */
  resultUnit?: "ratio" | "ATK";
  inputs: Readonly<Record<string, SourceHostCharacterModifierDynamicParameter>>;
  /** Original right-hand expression before the source set/add/multiply write. */
  expression: FormulaExpression;
  explanation: string;
  statLeaf?: SourceHostCharacterModifierDynamicStatLeaf;
  statLeaves?: readonly SourceHostCharacterModifierDynamicStatLeaf[];
  valueSources?: Readonly<Record<string, string | readonly string[]>>;
}

const ids = [...Object.keys(characterMultiplierGroupA), ...Object.keys(characterMultiplierGroupB), ...Object.keys(characterMultiplierGroupC)];
if (new Set(ids).size !== ids.length) throw new Error("来源角色攻击倍率规则 ID 重复");
export const sourceHostCharacterMultiplierRules = {
  ...characterMultiplierGroupA, ...characterMultiplierGroupB, ...characterMultiplierGroupC,
} as const satisfies Record<string, SourceHostCharacterMultiplierDescriptor>;
export type SourceHostCharacterMultiplierRuleId = keyof typeof sourceHostCharacterMultiplierRules;
export function isSourceHostCharacterMultiplierRuleId(value: string): value is SourceHostCharacterMultiplierRuleId {
  return Object.prototype.hasOwnProperty.call(sourceHostCharacterMultiplierRules, value);
}
export function sourceHostCharacterMultiplierRuleDescriptor(ruleId: SourceHostCharacterMultiplierRuleId): SourceHostCharacterMultiplierDescriptor {
  return sourceHostCharacterMultiplierRules[ruleId];
}

export const sourceHostCharacterMultiplierInputSchema = z.object({
  ruleId: z.custom<SourceHostCharacterMultiplierRuleId>(value => typeof value === "string" && isSourceHostCharacterMultiplierRuleId(value), "未知来源角色攻击倍率规则"),
  sourceHolderIndex: z.number().int().nonnegative(), priorMultiplier: z.number().finite(),
  state: z.record(z.string(), z.number().finite()),
}).strict().superRefine((input, context) => {
  if (!isSourceHostCharacterMultiplierRuleId(input.ruleId)) return;
  const descriptor = sourceHostCharacterMultiplierRuleDescriptor(input.ruleId);
  for (const [key, parameter] of Object.entries(descriptor.inputs)) {
    if (!Object.prototype.hasOwnProperty.call(input.state, key)) {
      context.addIssue({ code: "custom", path: ["state", key], message: `缺少来源实际状态 ${key}` });
      continue;
    }
    const value = input.state[key]!;
    if ((parameter.minimum !== undefined && value < parameter.minimum) ||
      (parameter.maximum !== undefined && value > parameter.maximum) ||
      (parameter.integer && !Number.isInteger(value)) ||
      (parameter.choices !== undefined && !parameter.choices.some(choice => choice.value === value)))
      context.addIssue({ code: "custom", path: ["state", key], message: `来源实际状态 ${key} 超出规则定义的数值范围` });
  }
  for (const key of Object.keys(input.state)) if (!Object.prototype.hasOwnProperty.call(descriptor.inputs, key))
    context.addIssue({ code: "custom", path: ["state", key], message: `规则没有状态参数 ${key}` });
});
export type SourceHostCharacterMultiplierInput = z.infer<typeof sourceHostCharacterMultiplierInputSchema>;

export function resolveSourceHostCharacterMultiplierInput(raw: unknown, sourceCommit: string, prefix = "characterMultiplier"):
  { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] } {
  const input = sourceHostCharacterMultiplierInputSchema.parse(raw);
  const descriptor = sourceHostCharacterMultiplierRuleDescriptor(input.ruleId);
  if (!descriptor.sourceCommits.includes(sourceCommit)) throw new Error(`来源角色攻击倍率规则不属于该固定源码版本：${input.ruleId}`);
  const resultUnit = descriptor.resultUnit ?? "ratio";
  const builder = new TraceBuilder([`https://github.com/genshinsim/gcsim/blob/${sourceCommit}/${descriptor.sourceFile}`]);
  const termId = `${prefix}.${input.ruleId}.sourceTerm`;
  const term = builder.add(termId, `${descriptor.title}：原生右侧算式`, descriptor.expression,
    Object.entries(descriptor.inputs).map(([key, parameter]) => traceInput(key, input.state[key]!, parameter.unit,
      "source-host-native-state", `${parameter.label}：原生写入点实际状态`)), {
      unit: descriptor.operation === "multiply" ? "ratio" : resultUnit,
      explanationKey: "来源只在原写入点取状态与属性；共享核心逐字计算本次右侧算式。",
    });
  const expression = descriptor.operation === "set" ? expr.input("sourceTerm")
    : descriptor.operation === "add" ? expr.add(expr.input("priorMultiplier"), expr.input("sourceTerm"))
      : expr.mul(expr.input("priorMultiplier"), expr.input("sourceTerm"));
  const value = builder.add(`${prefix}.${input.ruleId}`, descriptor.title, expression, [
    traceInput("sourceTerm", term, descriptor.operation === "multiply" ? "ratio" : resultUnit,
      { kind: "source-host-character-multiplier", reference: termId }, "原右侧算式结果"),
    ...(descriptor.operation === "set" ? [] : [traceInput("priorMultiplier", input.priorMultiplier, resultUnit,
      "source-host-native-prior-multiplier", "本次写入前 AttackInfo.Mult 的实际值")]),
  ], { unit: resultUnit, childIds: [termId],
    explanationKey: `${descriptor.explanation} 按原 ${descriptor.operation} 操作得到完整${resultUnit === "ATK" ? "攻击力缓存" : " AttackInfo.Mult"}；来源持有者 #${input.sourceHolderIndex}。` });
  return { value, trace: builder.nodes, explanationGaps: [] };
}
