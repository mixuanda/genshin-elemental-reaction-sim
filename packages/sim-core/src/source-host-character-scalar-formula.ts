/** Numeric clauses in source-owned character scalar modifier callbacks. */
import { z } from "zod";
import { TraceBuilder, traceInput, type CalculationTraceNode, type FormulaExpression } from "./calculation-trace";
import { characterScalarRulesA } from "./source-host-character-scalar-rules-a";
import { characterScalarRulesB } from "./source-host-character-scalar-rules-b";
import type { SourceHostCharacterModifierDynamicParameter, SourceHostCharacterModifierDynamicStatLeaf } from "./source-host-character-modifier-dynamic-formula";

export interface SourceHostCharacterScalarDescriptor {
  character: string;
  title: string;
  kind: "reaction-bonus" | "heal-bonus" | "cooldown-factor";
  modifierKey: string;
  sourceFile: string;
  sourceCommits: readonly string[];
  phase: "read" | "creation";
  inputs: Readonly<Record<string, SourceHostCharacterModifierDynamicParameter>>;
  statLeaf?: SourceHostCharacterModifierDynamicStatLeaf;
  valueSources?: Readonly<Record<string, string>>;
  expression: FormulaExpression;
  explanation: string;
}

const ids = [...Object.keys(characterScalarRulesA), ...Object.keys(characterScalarRulesB)];
if (new Set(ids).size !== ids.length) throw new Error("来源角色辅助标量规则 ID 重复");
export const sourceHostCharacterScalarRules = {
  ...characterScalarRulesA,
  ...characterScalarRulesB,
} as const satisfies Record<string, SourceHostCharacterScalarDescriptor>;
export type SourceHostCharacterScalarRuleId = keyof typeof sourceHostCharacterScalarRules;
export const sourceHostCharacterScalarRuleIds = Object.keys(sourceHostCharacterScalarRules) as SourceHostCharacterScalarRuleId[];
export function isSourceHostCharacterScalarRuleId(value: string): value is SourceHostCharacterScalarRuleId {
  return Object.prototype.hasOwnProperty.call(sourceHostCharacterScalarRules, value);
}
export function sourceHostCharacterScalarRuleDescriptor(ruleId: SourceHostCharacterScalarRuleId): SourceHostCharacterScalarDescriptor {
  return sourceHostCharacterScalarRules[ruleId];
}

export const sourceHostCharacterScalarInputSchema = z.object({
  ruleId: z.custom<SourceHostCharacterScalarRuleId>((value) => typeof value === "string" && isSourceHostCharacterScalarRuleId(value), "未知来源角色辅助标量规则"),
  modifierKey: z.string().min(1),
  sourceHolderIndex: z.number().int().nonnegative(),
  phase: z.enum(["read", "creation"]),
  state: z.record(z.string(), z.number().finite()),
}).strict().superRefine((input, context) => {
  if (!isSourceHostCharacterScalarRuleId(input.ruleId)) return;
  const descriptor = sourceHostCharacterScalarRuleDescriptor(input.ruleId);
  if (input.modifierKey !== descriptor.modifierKey) context.addIssue({ code: "custom", path: ["modifierKey"], message: "来源角色辅助 modifier key 与规则不符" });
  if (input.phase !== descriptor.phase) context.addIssue({ code: "custom", path: ["phase"], message: "来源角色辅助公式计算阶段与规则不符" });
  for (const [key, parameter] of Object.entries(descriptor.inputs)) {
    if (!Object.prototype.hasOwnProperty.call(input.state, key)) {
      context.addIssue({ code: "custom", path: ["state", key], message: `缺少来源实际状态 ${key}` });
      continue;
    }
    const value = input.state[key]!;
    if ((parameter.minimum !== undefined && value < parameter.minimum)
      || (parameter.maximum !== undefined && value > parameter.maximum)
      || (parameter.integer && !Number.isInteger(value))
      || (parameter.choices !== undefined && !parameter.choices.some(choice => choice.value === value))) {
      context.addIssue({ code: "custom", path: ["state", key], message: `来源实际状态 ${key} 超出规则定义的数值范围` });
    }
  }
  for (const key of Object.keys(input.state)) if (!Object.prototype.hasOwnProperty.call(descriptor.inputs, key)) {
    context.addIssue({ code: "custom", path: ["state", key], message: `规则没有状态参数 ${key}` });
  }
});
export type SourceHostCharacterScalarInput = z.infer<typeof sourceHostCharacterScalarInputSchema>;
export interface SourceHostCharacterScalarCalculation { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] }

/** Source state supplies leaves; the shared AST supplies the value Go consumes. */
export function resolveSourceHostCharacterScalarInput(raw: unknown, sourceCommit: string, prefix = "characterScalar"): SourceHostCharacterScalarCalculation {
  const input = sourceHostCharacterScalarInputSchema.parse(raw);
  const descriptor = sourceHostCharacterScalarRuleDescriptor(input.ruleId);
  if (!descriptor.sourceCommits.includes(sourceCommit)) throw new Error(`来源角色辅助规则不属于该固定源码版本：${input.ruleId}`);
  const builder = new TraceBuilder([`https://github.com/genshinsim/gcsim/blob/${sourceCommit}/${descriptor.sourceFile}`]);
  const values = Object.entries(descriptor.inputs).map(([key, parameter]) => traceInput(key, input.state[key]!, parameter.unit,
    "source-host-native-state", `${parameter.label}：Go 在原 ${descriptor.phase === "creation" ? "buff 创建" : "modifier Amount"} 位置实际读取的叶状态`));
  const value = builder.add(`${prefix}.${input.ruleId}`, descriptor.title, descriptor.expression, values, {
    unit: "ratio",
    explanationKey: `${descriptor.explanation} 来源持有者 #${input.sourceHolderIndex}，原生 key ${input.modifierKey}；触发、适用、期限与副作用仍由 Go 执行。`,
  });
  return { value, trace: builder.nodes, explanationGaps: [descriptor.phase === "creation"
    ? "数值由共享公式在原创建帧算出；后续消费只关联创建回执，不重读创建状态。"
    : "数值由共享公式在原 Amount 调用时计算；不会重演 Go 的触发及生命周期。"] };
}
