/** Original source character shield HP expressions. Go still owns creation,
 * refresh, replacement, expiration, and each actual stat read. */
import { z } from "zod";
import { TraceBuilder, traceInput, type CalculationTraceNode, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterModifierDynamicParameter, SourceHostCharacterModifierDynamicStatLeaf } from "./source-host-character-modifier-dynamic-formula";
import { characterShieldGroupA } from "./source-host-character-shield-group-a";
import { characterShieldGroupB } from "./source-host-character-shield-group-b";
import { characterShieldGroupC } from "./source-host-character-shield-group-c";
import { characterShieldGroupD } from "./source-host-character-shield-group-d";
import { characterShieldGroupE } from "./source-host-character-shield-group-e";

export interface SourceHostCharacterShieldDescriptor {
  character: string;
  title: string;
  sourceFile: string;
  sourceCommits: readonly string[];
  /** A delayed shield may first save a DEF source before writing HP. */
  resultUnit?: "HP" | "DEF" | "ratio";
  inputs: Readonly<Record<string, SourceHostCharacterModifierDynamicParameter>>;
  expression: FormulaExpression;
  explanation: string;
  statLeaf?: SourceHostCharacterModifierDynamicStatLeaf;
  statLeaves?: readonly SourceHostCharacterModifierDynamicStatLeaf[];
  snapshotLeaf?: { stateKey: string; getter: "total-atk" | "total-def" | "em" };
  snapshotLeaves?: readonly { stateKey: string; getter: "total-atk" | "total-def" | "em" }[];
  /** A saved shield HP may come from another character shield formula or an
   * actual Tmpl.OnDamage hpAfter step. The latter uses this exact sentinel. */
  valueSources?: Readonly<Record<string, string | readonly string[]>>;
}

const groups = [characterShieldGroupA, characterShieldGroupB, characterShieldGroupC, characterShieldGroupD, characterShieldGroupE];
const ids = groups.flatMap(group => Object.keys(group));
if (new Set(ids).size !== ids.length) throw new Error("来源角色护盾 HP 规则 ID 重复");
export const sourceHostCharacterShieldRules = {
  ...characterShieldGroupA, ...characterShieldGroupB, ...characterShieldGroupC, ...characterShieldGroupD,
  ...characterShieldGroupE,
} as const satisfies Record<string, SourceHostCharacterShieldDescriptor>;
export type SourceHostCharacterShieldRuleId = keyof typeof sourceHostCharacterShieldRules;
export const sourceHostCharacterShieldRuleIds = Object.keys(sourceHostCharacterShieldRules) as SourceHostCharacterShieldRuleId[];
export function isSourceHostCharacterShieldRuleId(value: string): value is SourceHostCharacterShieldRuleId {
  return Object.prototype.hasOwnProperty.call(sourceHostCharacterShieldRules, value);
}
export function sourceHostCharacterShieldRuleDescriptor(ruleId: SourceHostCharacterShieldRuleId): SourceHostCharacterShieldDescriptor {
  return sourceHostCharacterShieldRules[ruleId];
}

export const sourceHostCharacterShieldInputSchema = z.object({
  ruleId: z.custom<SourceHostCharacterShieldRuleId>(value => typeof value === "string" && isSourceHostCharacterShieldRuleId(value),
    "未知来源角色护盾 HP 规则"),
  sourceHolderIndex: z.number().int().nonnegative(),
  state: z.record(z.string(), z.number().finite()),
}).strict().superRefine((input, context) => {
  if (!isSourceHostCharacterShieldRuleId(input.ruleId)) return;
  const descriptor = sourceHostCharacterShieldRuleDescriptor(input.ruleId);
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
export type SourceHostCharacterShieldInput = z.infer<typeof sourceHostCharacterShieldInputSchema>;

export function resolveSourceHostCharacterShieldInput(raw: unknown, sourceCommit: string,
  prefix = "characterShield"): { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] } {
  const input = sourceHostCharacterShieldInputSchema.parse(raw);
  const descriptor = sourceHostCharacterShieldRuleDescriptor(input.ruleId);
  if (!descriptor.sourceCommits.includes(sourceCommit))
    throw new Error(`来源角色护盾 HP 规则不属于该固定源码版本：${input.ruleId}`);
  const builder = new TraceBuilder([`https://github.com/genshinsim/gcsim/blob/${sourceCommit}/${descriptor.sourceFile}`]);
  const value = builder.add(`${prefix}.${input.ruleId}`, descriptor.title, descriptor.expression,
    Object.entries(descriptor.inputs).map(([key, parameter]) => traceInput(key, input.state[key]!, parameter.unit,
      "source-host-native-state", `${parameter.label}：原生护盾 HP 写入点实际状态`)), {
      unit: descriptor.resultUnit ?? "HP", explanationKey: `${descriptor.explanation} 共享公式结果由 Go 在原位置保存；最终 HP 规则写入真正护盾；来源持有者 #${input.sourceHolderIndex}。`,
    });
  return { value, trace: builder.nodes, explanationGaps: [] };
}
