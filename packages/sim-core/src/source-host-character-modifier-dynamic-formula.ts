/** Numeric clauses in source-owned character modifiers. Go supplies only the
 * state leaves read at the original callback or buff creation point. */
import { z } from "zod";
import { TraceBuilder, traceInput, type CalculationTraceNode, type FormulaExpression } from "./calculation-trace";
import { characterModifierDynamicGroupA } from "./source-host-character-dynamic-group-a";
import { characterModifierDynamicGroupB } from "./source-host-character-dynamic-group-b";
import { characterModifierDynamicGroupC } from "./source-host-character-dynamic-group-c";
import { characterModifierVectorGroupA } from "./source-host-character-vector-group-a";
import { characterModifierVectorGroupB } from "./source-host-character-vector-group-b";
import { characterModifierVectorGroupC } from "./source-host-character-vector-group-c";
import { characterModifierVectorGroupD } from "./source-host-character-vector-group-d";

export interface SourceHostCharacterModifierDynamicParameter {
  label: string;
  unit: string;
  minimum?: number;
  maximum?: number;
  integer?: boolean;
  choices?: readonly { value: number; label: string }[];
}
/** Connects one native state leaf to the same getter receipt passed by Go.
 * Other leaves remain observed native state and are not inferred from a read. */
export interface SourceHostCharacterModifierDynamicStatLeaf {
  stateKey: string;
  getter: "stat" | "non-extra-stat" | "total-atk" | "non-extra-total-atk"
    | "total-def" | "non-extra-total-def" | "max-hp";
  statIndex?: number;
  actor: "holder" | "request-actor" | "native";
}
export interface SourceHostCharacterModifierDynamicDescriptor {
  character: string;
  title: string;
  statIndex: number;
  modifierKey: string;
  sourceFile: string;
  sourceCommits: readonly string[];
  phase: "read" | "creation";
  inputs: Readonly<Record<string, SourceHostCharacterModifierDynamicParameter>>;
  statLeaf?: SourceHostCharacterModifierDynamicStatLeaf;
  /** Ordered bindings for original callbacks with several distinct getters. */
  statLeaves?: readonly SourceHostCharacterModifierDynamicStatLeaf[];
  /** One creation scalar may feed several original modifier keys/slots. */
  consumerSlots?: Readonly<Record<string, number>>;
  expression: FormulaExpression;
  explanation: string;
}

const ids = [
  ...Object.keys(characterModifierDynamicGroupA),
  ...Object.keys(characterModifierDynamicGroupB),
  ...Object.keys(characterModifierDynamicGroupC),
  ...Object.keys(characterModifierVectorGroupA),
  ...Object.keys(characterModifierVectorGroupB),
  ...Object.keys(characterModifierVectorGroupC),
  ...Object.keys(characterModifierVectorGroupD),
];
if (new Set(ids).size !== ids.length) throw new Error("来源角色动态规则 ID 重复");
export const sourceHostCharacterModifierDynamicRules = {
  ...characterModifierDynamicGroupA,
  ...characterModifierDynamicGroupB,
  ...characterModifierDynamicGroupC,
  ...characterModifierVectorGroupA,
  ...characterModifierVectorGroupB,
  ...characterModifierVectorGroupC,
  ...characterModifierVectorGroupD,
} as const satisfies Record<string, SourceHostCharacterModifierDynamicDescriptor>;
export type SourceHostCharacterModifierDynamicRuleId = keyof typeof sourceHostCharacterModifierDynamicRules;
export const sourceHostCharacterModifierDynamicRuleIds = Object.keys(sourceHostCharacterModifierDynamicRules) as SourceHostCharacterModifierDynamicRuleId[];
export function isSourceHostCharacterModifierDynamicRuleId(value: string): value is SourceHostCharacterModifierDynamicRuleId {
  return Object.prototype.hasOwnProperty.call(sourceHostCharacterModifierDynamicRules, value);
}
export function sourceHostCharacterModifierDynamicRuleDescriptor(ruleId: SourceHostCharacterModifierDynamicRuleId): SourceHostCharacterModifierDynamicDescriptor {
  return sourceHostCharacterModifierDynamicRules[ruleId];
}

export const sourceHostCharacterModifierDynamicInputSchema = z.object({
  ruleId: z.custom<SourceHostCharacterModifierDynamicRuleId>((value) => typeof value === "string" && isSourceHostCharacterModifierDynamicRuleId(value), "未知来源角色动态规则"),
  modifierKey: z.string().min(1),
  sourceHolderIndex: z.number().int().nonnegative(),
  phase: z.enum(["read", "creation"]),
  state: z.record(z.string(), z.number().finite()),
}).strict().superRefine((input, context) => {
  if (!isSourceHostCharacterModifierDynamicRuleId(input.ruleId)) return;
  const descriptor = sourceHostCharacterModifierDynamicRuleDescriptor(input.ruleId);
  if (input.modifierKey !== descriptor.modifierKey) context.addIssue({ code: "custom", path: ["modifierKey"], message: "来源角色 modifier key 与规则不符" });
  if (input.phase !== descriptor.phase) context.addIssue({ code: "custom", path: ["phase"], message: "来源角色公式计算阶段与规则不符" });
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
export type SourceHostCharacterModifierDynamicInput = z.infer<typeof sourceHostCharacterModifierDynamicInputSchema>;
export interface SourceHostCharacterModifierDynamicCalculation { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] }

export function resolveSourceHostCharacterModifierDynamicInput(raw: unknown, sourceCommit: string, prefix = "characterModifier"): SourceHostCharacterModifierDynamicCalculation {
  const input = sourceHostCharacterModifierDynamicInputSchema.parse(raw);
  const descriptor = sourceHostCharacterModifierDynamicRuleDescriptor(input.ruleId);
  if (!descriptor.sourceCommits.includes(sourceCommit)) throw new Error(`来源角色动态规则不属于该固定源码版本：${input.ruleId}`);
  const builder = new TraceBuilder([`https://github.com/genshinsim/gcsim/blob/${sourceCommit}/${descriptor.sourceFile}`]);
  const values = Object.entries(descriptor.inputs).map(([key, parameter]) => traceInput(key, input.state[key]!, parameter.unit,
    "source-host-native-state", `${parameter.label}：Go 在原 ${descriptor.phase === "creation" ? "buff 创建" : "modifier Amount"} 位置实际读取的叶状态`));
  const value = builder.add(`${prefix}.${input.ruleId}`, descriptor.title, descriptor.expression, values, {
    unit: descriptor.statIndex === 8 ? "EM" : [2, 3, 5, 23, 24, 25].includes(descriptor.statIndex) ? "stat" : "ratio",
    explanationKey: `${descriptor.explanation} 来源持有者 #${input.sourceHolderIndex}，原生 key ${input.modifierKey}；触发、判定和生命周期仍由 Go 执行。`,
  });
  return { value, trace: builder.nodes, explanationGaps: [descriptor.phase === "creation"
    ? "数值由共享公式在原 buff 创建帧算出并存入原向量；之后的消费只关联创建回执，不重算创建状态。"
    : "数值由共享公式在原 Amount 调用时根据真实状态算出；不会重演 Go 的触发与期限判定。"] };
}
