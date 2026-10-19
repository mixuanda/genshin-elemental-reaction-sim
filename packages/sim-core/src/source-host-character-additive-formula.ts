/** Source-owned character FlatDmg clauses. Go retains every native gate,
 * side effect and attack identity; the shared AST returns the added amount. */
import { z } from "zod";
import { TraceBuilder, traceInput, type CalculationTraceNode, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterModifierDynamicParameter, SourceHostCharacterModifierDynamicStatLeaf } from "./source-host-character-modifier-dynamic-formula";
import { characterAdditiveGroupA } from "./source-host-character-additive-group-a";
import { characterAdditiveGroupB } from "./source-host-character-additive-group-b";
import { characterAdditiveGroupC } from "./source-host-character-additive-group-c";

export interface SourceHostCharacterAdditiveDescriptor {
  character: string;
  title: string;
  sourceFile: string;
  sourceCommits: readonly string[];
  phase: "hit" | "creation";
  inputs: Readonly<Record<string, SourceHostCharacterModifierDynamicParameter>>;
  expression: FormulaExpression;
  explanation: string;
  resultUnit?: string;
  /** A getter originally executed at this callback or creation point. */
  statLeaf?: SourceHostCharacterModifierDynamicStatLeaf;
  /** Several original getters, bound to leaves in their exact call order. */
  statLeaves?: readonly SourceHostCharacterModifierDynamicStatLeaf[];
  /** A number already present in the actual attack snapshot; no getter runs. */
  snapshotLeaf?: { stateKey: string; getter: "total-atk" | "total-def" };
  /** State leaves backed by earlier character-additive creation receipts. */
  valueSources?: Readonly<Record<string, string>>;
}

const ids = [...Object.keys(characterAdditiveGroupA), ...Object.keys(characterAdditiveGroupB), ...Object.keys(characterAdditiveGroupC)];
if (new Set(ids).size !== ids.length) throw new Error("来源角色附加伤害规则 ID 重复");
export const sourceHostCharacterAdditiveRules = {
  ...characterAdditiveGroupA,
  ...characterAdditiveGroupB,
  ...characterAdditiveGroupC,
} as const satisfies Record<string, SourceHostCharacterAdditiveDescriptor>;
export type SourceHostCharacterAdditiveRuleId = keyof typeof sourceHostCharacterAdditiveRules;
export const sourceHostCharacterAdditiveRuleIds = Object.keys(sourceHostCharacterAdditiveRules) as SourceHostCharacterAdditiveRuleId[];
export function isSourceHostCharacterAdditiveRuleId(value: string): value is SourceHostCharacterAdditiveRuleId {
  return Object.prototype.hasOwnProperty.call(sourceHostCharacterAdditiveRules, value);
}
export function sourceHostCharacterAdditiveRuleDescriptor(ruleId: SourceHostCharacterAdditiveRuleId): SourceHostCharacterAdditiveDescriptor {
  return sourceHostCharacterAdditiveRules[ruleId];
}

export const sourceHostCharacterAdditiveInputSchema = z.object({
  ruleId: z.custom<SourceHostCharacterAdditiveRuleId>((value) => typeof value === "string" && isSourceHostCharacterAdditiveRuleId(value), "未知来源角色附加伤害规则"),
  sourceHolderIndex: z.number().int().nonnegative(),
  phase: z.enum(["hit", "creation"]),
  state: z.record(z.string(), z.number().finite()),
}).strict().superRefine((input, context) => {
  if (!isSourceHostCharacterAdditiveRuleId(input.ruleId)) return;
  const descriptor = sourceHostCharacterAdditiveRuleDescriptor(input.ruleId);
  if (input.phase !== descriptor.phase) context.addIssue({ code: "custom", path: ["phase"], message: "来源角色附加伤害计算阶段与规则不符" });
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
export type SourceHostCharacterAdditiveInput = z.infer<typeof sourceHostCharacterAdditiveInputSchema>;
export interface SourceHostCharacterAdditiveCalculation { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] }

/** Only original numeric leaves enter here; hit eligibility stays in Go. */
export function resolveSourceHostCharacterAdditiveInput(raw: unknown, sourceCommit: string, prefix = "characterAdditive"): SourceHostCharacterAdditiveCalculation {
  const input = sourceHostCharacterAdditiveInputSchema.parse(raw);
  const descriptor = sourceHostCharacterAdditiveRuleDescriptor(input.ruleId);
  if (!descriptor.sourceCommits.includes(sourceCommit)) throw new Error(`来源角色附加伤害规则不属于该固定源码版本：${input.ruleId}`);
  const builder = new TraceBuilder([`https://github.com/genshinsim/gcsim/blob/${sourceCommit}/${descriptor.sourceFile}`]);
  const values = Object.entries(descriptor.inputs).map(([key, parameter]) => traceInput(key, input.state[key]!, parameter.unit,
    "source-host-native-state", `${parameter.label}：Go 在原 ${descriptor.phase === "creation" ? "状态创建" : "命中回调"} 位置实际读取的状态叶`));
  const value = builder.add(`${prefix}.${input.ruleId}`, descriptor.title, descriptor.expression, values, {
    unit: descriptor.resultUnit ?? "damage",
    explanationKey: `${descriptor.explanation} 来源持有者 #${input.sourceHolderIndex}；触发、攻击身份和副作用由固定 Go 回调执行。`,
  });
  return { value, trace: builder.nodes, explanationGaps: [descriptor.phase === "creation"
    ? "共享公式在原创建帧求值；随后命中只关联保存的值和创建回执，不重复计算创建状态。"
    : "共享公式仅替换原生门槛通过后的 FlatDmg 数值操作，不重演回调副作用。"] };
}
