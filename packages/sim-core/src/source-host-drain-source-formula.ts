/** Original DrainInfo.Amount producer arithmetic. Go retains the HP state and event order. */
import { z } from "zod";
import { TraceBuilder, traceInput, type CalculationTraceNode, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterModifierDynamicParameter } from "./source-host-character-modifier-dynamic-formula";
import type { SourceHostHealingSourceStatLeaf } from "./source-host-healing-source-formula";
import { drainSourceGroupA } from "./source-host-drain-source-group-a";
import { drainSourceGroupB } from "./source-host-drain-source-group-b";
import { drainSpecialRules } from "./source-host-drain-special-formula";

export interface SourceHostDrainSourceDescriptor {
  character: string;
  title: string;
  sourceFile: string;
  sourceCommits: readonly string[];
  resultUnit: "HP" | "damage";
  outputSlot?: "drain-amount" | "redmane-pool" | "manual-raw-damage" | "intermediate";
  inputs: Readonly<Record<string, SourceHostCharacterModifierDynamicParameter>>;
  expression: FormulaExpression;
  explanation: string;
  explanationGaps?: readonly string[];
  statLeaf?: SourceHostHealingSourceStatLeaf;
  statLeaves?: readonly SourceHostHealingSourceStatLeaf[];
  valueSources?: Readonly<Record<string, string | readonly string[]>>;
  initialZeroKeys?: readonly string[];
}

const groups = [drainSourceGroupA, drainSourceGroupB, drainSpecialRules];
const ids = groups.flatMap(group => Object.keys(group));
if (new Set(ids).size !== ids.length) throw new Error("来源 Drain 源数值规则 ID 重复");
export const sourceHostDrainSourceRules = { ...drainSourceGroupA, ...drainSourceGroupB, ...drainSpecialRules } as const satisfies Record<string, SourceHostDrainSourceDescriptor>;
export type SourceHostDrainSourceRuleId = keyof typeof sourceHostDrainSourceRules;
export const sourceHostDrainSourceRuleIds = Object.keys(sourceHostDrainSourceRules) as SourceHostDrainSourceRuleId[];
export function isSourceHostDrainSourceRuleId(value: string): value is SourceHostDrainSourceRuleId {
  return Object.prototype.hasOwnProperty.call(sourceHostDrainSourceRules, value);
}
export function sourceHostDrainSourceRuleDescriptor(ruleId: SourceHostDrainSourceRuleId): SourceHostDrainSourceDescriptor {
  return sourceHostDrainSourceRules[ruleId];
}
export const sourceHostDrainSourceInputSchema = z.object({
  ruleId: z.custom<SourceHostDrainSourceRuleId>(value => typeof value === "string" && isSourceHostDrainSourceRuleId(value),
    "未知来源 Drain 源数值规则"),
  sourceHolderIndex: z.number().int().nonnegative(),
  state: z.record(z.string(), z.number().finite()),
}).strict().superRefine((input, context) => {
  if (!isSourceHostDrainSourceRuleId(input.ruleId)) return;
  const descriptor = sourceHostDrainSourceRuleDescriptor(input.ruleId);
  for (const [key, parameter] of Object.entries(descriptor.inputs)) {
    if (!Object.prototype.hasOwnProperty.call(input.state, key)) {
      context.addIssue({ code: "custom", path: ["state", key], message: `缺少来源实际状态 ${key}` });
      continue;
    }
    const value = input.state[key]!;
    if (parameter.minimum !== undefined && value < parameter.minimum ||
      parameter.maximum !== undefined && value > parameter.maximum ||
      parameter.integer && !Number.isInteger(value) ||
      parameter.choices !== undefined && !parameter.choices.some(choice => choice.value === value))
      context.addIssue({ code: "custom", path: ["state", key], message: `来源实际状态 ${key} 超出规则定义的数值范围` });
  }
  for (const key of Object.keys(input.state)) if (!Object.prototype.hasOwnProperty.call(descriptor.inputs, key))
    context.addIssue({ code: "custom", path: ["state", key], message: `规则没有状态参数 ${key}` });
});
export type SourceHostDrainSourceInput = z.infer<typeof sourceHostDrainSourceInputSchema>;

export function resolveSourceHostDrainSourceInput(raw: unknown, sourceCommit: string,
  prefix = "drainSource"): { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] } {
  const input = sourceHostDrainSourceInputSchema.parse(raw);
  const descriptor = sourceHostDrainSourceRuleDescriptor(input.ruleId);
  if (!descriptor.sourceCommits.includes(sourceCommit))
    throw new Error(`Drain 源数值规则不属于固定源码版本：${input.ruleId}`);
  const output = descriptor.outputSlot === "redmane-pool" ? "原生 Redmane's Blood 字段"
    : descriptor.outputSlot === "manual-raw-damage" ? "原生手工自伤入盾值"
      : descriptor.outputSlot === "intermediate" ? "原生中间数值" : "原生 DrainInfo.Amount";
  const builder = new TraceBuilder([`https://github.com/genshinsim/gcsim/blob/${sourceCommit}/${descriptor.sourceFile}`]);
  const value = builder.add(`${prefix}.${input.ruleId}`, descriptor.title, descriptor.expression,
    Object.entries(descriptor.inputs).map(([key, parameter]) => traceInput(key, input.state[key]!, parameter.unit,
      "source-host-native-state", `${parameter.label}：原生 DrainInfo 构造点实际状态`)), {
      unit: descriptor.resultUnit,
      explanationKey: `${descriptor.explanation} Go 将共享结果写入${output}；来源持有者 #${input.sourceHolderIndex}。`,
    });
  return { value, trace: builder.nodes, explanationGaps: [...(descriptor.explanationGaps ?? [])] };
}
