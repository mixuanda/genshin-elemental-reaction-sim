/** Source-owned queued FlatDmg terms. The shared result is the full value
 * after the original set, add or multiply operation. */
import { z } from "zod";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterModifierDynamicParameter, SourceHostCharacterModifierDynamicStatLeaf } from "./source-host-character-modifier-dynamic-formula";
import { characterFlatGroupA } from "./source-host-character-flat-group-a";
import { characterFlatGroupB } from "./source-host-character-flat-group-b";
import { characterFlatGroupC } from "./source-host-character-flat-group-c";
import { characterFlatGroupD } from "./source-host-character-flat-group-d";
import { characterFlatGroupE } from "./source-host-character-flat-group-e";
import { characterFlatGroupF } from "./source-host-character-flat-group-f";

export interface SourceHostCharacterFlatDescriptor {
  character: string;
  title: string;
  sourceFile: string;
  sourceCommits: readonly string[];
  operation: "set" | "add" | "multiply";
  /** A source-owned cache can hold a stat instead of damage. */
  resultUnit?: "damage" | "ATK";
  inputs: Readonly<Record<string, SourceHostCharacterModifierDynamicParameter>>;
  /** Exactly the original source operand, before applying the operator. */
  expression: FormulaExpression;
  explanation: string;
  statLeaf?: SourceHostCharacterModifierDynamicStatLeaf;
  statLeaves?: readonly SourceHostCharacterModifierDynamicStatLeaf[];
  snapshotLeaf?: { stateKey: string; getter: "total-atk" | "total-def" | "em" };
  /** Several operands from the same original attack snapshot, in source order. */
  snapshotLeaves?: readonly { stateKey: string; getter: "total-atk" | "total-def" | "em" }[];
  /** State leaves backed by earlier recorded character-flat computations. */
  valueSources?: Readonly<Record<string, string | readonly string[]>>;
}

const ids = [
  ...Object.keys(characterFlatGroupA), ...Object.keys(characterFlatGroupB), ...Object.keys(characterFlatGroupC),
  ...Object.keys(characterFlatGroupD), ...Object.keys(characterFlatGroupE), ...Object.keys(characterFlatGroupF),
];
if (new Set(ids).size !== ids.length) throw new Error("来源角色 FlatDmg 规则 ID 重复");
export const sourceHostCharacterFlatRules = {
  ...characterFlatGroupA, ...characterFlatGroupB, ...characterFlatGroupC, ...characterFlatGroupD, ...characterFlatGroupE, ...characterFlatGroupF,
} as const satisfies Record<string, SourceHostCharacterFlatDescriptor>;
export type SourceHostCharacterFlatRuleId = keyof typeof sourceHostCharacterFlatRules;
export const sourceHostCharacterFlatRuleIds = Object.keys(sourceHostCharacterFlatRules) as SourceHostCharacterFlatRuleId[];
export function isSourceHostCharacterFlatRuleId(value: string): value is SourceHostCharacterFlatRuleId {
  return Object.prototype.hasOwnProperty.call(sourceHostCharacterFlatRules, value);
}
export function sourceHostCharacterFlatRuleDescriptor(ruleId: SourceHostCharacterFlatRuleId): SourceHostCharacterFlatDescriptor {
  return sourceHostCharacterFlatRules[ruleId];
}

export const sourceHostCharacterFlatInputSchema = z.object({
  ruleId: z.custom<SourceHostCharacterFlatRuleId>((value) => typeof value === "string" && isSourceHostCharacterFlatRuleId(value), "未知来源角色 FlatDmg 规则"),
  sourceHolderIndex: z.number().int().nonnegative(),
  priorFlatDamage: z.number().finite(),
  state: z.record(z.string(), z.number().finite()),
}).strict().superRefine((input, context) => {
  if (!isSourceHostCharacterFlatRuleId(input.ruleId)) return;
  const descriptor = sourceHostCharacterFlatRuleDescriptor(input.ruleId);
  for (const [key, parameter] of Object.entries(descriptor.inputs)) {
    if (!Object.prototype.hasOwnProperty.call(input.state, key)) {
      context.addIssue({ code: "custom", path: ["state", key], message: `缺少来源实际状态 ${key}` });
      continue;
    }
    const value = input.state[key]!;
    if ((parameter.minimum !== undefined && value < parameter.minimum) ||
      (parameter.maximum !== undefined && value > parameter.maximum) ||
      (parameter.integer && !Number.isInteger(value)) ||
      (parameter.choices !== undefined && !parameter.choices.some(choice => choice.value === value))) {
      context.addIssue({ code: "custom", path: ["state", key], message: `来源实际状态 ${key} 超出规则定义的数值范围` });
    }
  }
  for (const key of Object.keys(input.state)) if (!Object.prototype.hasOwnProperty.call(descriptor.inputs, key)) {
    context.addIssue({ code: "custom", path: ["state", key], message: `规则没有状态参数 ${key}` });
  }
});
export type SourceHostCharacterFlatInput = z.infer<typeof sourceHostCharacterFlatInputSchema>;
export interface SourceHostCharacterFlatCalculation { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] }

export function resolveSourceHostCharacterFlatInput(raw: unknown, sourceCommit: string, prefix = "characterFlat"): SourceHostCharacterFlatCalculation {
  const input = sourceHostCharacterFlatInputSchema.parse(raw);
  const descriptor = sourceHostCharacterFlatRuleDescriptor(input.ruleId);
  if (!descriptor.sourceCommits.includes(sourceCommit)) throw new Error(`来源角色 FlatDmg 规则不属于该固定源码版本：${input.ruleId}`);
  const resultUnit = descriptor.resultUnit ?? "damage";
  const builder = new TraceBuilder([`https://github.com/genshinsim/gcsim/blob/${sourceCommit}/${descriptor.sourceFile}`]);
  const termId = `${prefix}.${input.ruleId}.sourceTerm`;
  const term = builder.add(termId, `${descriptor.title}：原生算式操作数`, descriptor.expression,
    Object.entries(descriptor.inputs).map(([key, parameter]) => traceInput(key, input.state[key]!, parameter.unit,
      "source-host-native-state", `${parameter.label}：原生写入点实际状态`)), {
      unit: descriptor.operation === "multiply" ? "ratio" : resultUnit,
      explanationKey: "只计算原生赋值语句右侧的数值；生命周期、门槛和原 getter 次序仍由固定来源回调执行。",
    });
  const expression = descriptor.operation === "set" ? expr.input("sourceTerm")
    : descriptor.operation === "add" ? expr.add(expr.input("priorFlatDamage"), expr.input("sourceTerm"))
      : expr.mul(expr.input("priorFlatDamage"), expr.input("sourceTerm"));
  const value = builder.add(`${prefix}.${input.ruleId}`, descriptor.title, expression, [
    traceInput("sourceTerm", term, descriptor.operation === "multiply" ? "ratio" : resultUnit,
      { kind: "source-host-character-flat", reference: termId }, "原生右侧算式的共享计算结果"),
    ...(descriptor.operation === "set" ? [] : [traceInput("priorFlatDamage", input.priorFlatDamage, resultUnit,
      "source-host-native-prior-flat", "此赋值发生前原 AttackInfo.FlatDmg 的真实值")]),
  ], { unit: resultUnit, childIds: [termId],
    explanationKey: `${descriptor.explanation} 按原 ${descriptor.operation} 操作和原 IEEE-754 顺序得到${resultUnit === "damage" ? "完整 FlatDmg" : "保存的攻击力"}；来源持有者 #${input.sourceHolderIndex}。` });
  return { value, trace: builder.nodes, explanationGaps: [] };
}
