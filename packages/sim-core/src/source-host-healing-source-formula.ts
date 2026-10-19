/** Original HealInfo.Src and HealInfo.Bonus producer arithmetic. Native Go
 * retains all gates, queues, getter timing, HP changes, and events. */
import { z } from "zod";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterModifierDynamicParameter, SourceHostCharacterModifierDynamicStatLeaf } from "./source-host-character-modifier-dynamic-formula";
import { healingSourceGroupA } from "./source-host-healing-source-group-a";
import { healingSourceGroupB } from "./source-host-healing-source-group-b";
import { healingSourceGroupC } from "./source-host-healing-source-group-c";
import { healingSourceGroupD } from "./source-host-healing-source-group-d";
import { healingSourceGroupE } from "./source-host-healing-source-group-e";
import { healingSourceGroupF } from "./source-host-healing-source-group-f";
import { healingSourceGroupG } from "./source-host-healing-source-group-g";

export interface SourceHostHealingSourceSnapshotLeaf {
  stateKey: string;
  getter: "heal" | "em" | "total-atk" | "total-def" | "total-hp" | "stat";
  statIndex?: number;
}
export type SourceHostHealingSourceStatLeaf = SourceHostCharacterModifierDynamicStatLeaf | {
  stateKey: string;
  getter: "stats-stat" | "stats-total-atk" | "stats-total-def" | "stats-total-hp";
  actor: "holder" | "request-actor" | "native";
  statIndex?: number;
};
export interface SourceHostHealingSourceDescriptor {
  character: string;
  title: string;
  sourceFile: string;
  sourceCommits: readonly string[];
  resultUnit: "HP" | "ratio" | "DEF" | "ATK";
  inputs: Readonly<Record<string, SourceHostCharacterModifierDynamicParameter>>;
  expression: FormulaExpression;
  explanation: string;
  explanationGaps?: readonly string[];
  statLeaf?: SourceHostHealingSourceStatLeaf;
  statLeaves?: readonly SourceHostHealingSourceStatLeaf[];
  snapshotLeaf?: SourceHostHealingSourceSnapshotLeaf;
  snapshotLeaves?: readonly SourceHostHealingSourceSnapshotLeaf[];
  valueSources?: Readonly<Record<string, string | readonly string[]>>;
}

const commits = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const generic = {
  "heal-source-info-bonus-stat": {
    character: "*", title: "治疗附加加成原生治疗属性读取", sourceFile: "pkg/core/player/character/stats.go",
    sourceCommits: commits, resultUnit: "ratio",
    inputs: { healBonus: { label: "原位置 Heal 属性读取", unit: "ratio" } },
    statLeaf: { stateKey: "healBonus", getter: "stat", statIndex: 11, actor: "holder" },
    expression: expr.input("healBonus"),
    explanation: "来源角色在构造 HealInfo.Bonus 前实际读取 Heal 属性一次；此公式仅转交该次读数。",
  },
  "heal-source-info-bonus-snapshot": {
    character: "*", title: "治疗附加加成原攻击快照治疗属性", sourceFile: "pkg/core/player/character/stats.go",
    sourceCommits: commits, resultUnit: "ratio",
    inputs: { healBonus: { label: "原攻击快照 Heal 属性", unit: "ratio" } },
    snapshotLeaf: { stateKey: "healBonus", getter: "heal" },
    expression: expr.input("healBonus"),
    explanation: "来源在构造 HealInfo.Bonus 时使用已有攻击快照 Heal 槽，不重新读取角色属性。",
  },
} as const satisfies Record<string, SourceHostHealingSourceDescriptor>;
const groups = [generic, healingSourceGroupA, healingSourceGroupB, healingSourceGroupC,
  healingSourceGroupD, healingSourceGroupE, healingSourceGroupF, healingSourceGroupG];
const ids = groups.flatMap(group => Object.keys(group));
if (new Set(ids).size !== ids.length) throw new Error("来源治疗源数值规则 ID 重复");
export const sourceHostHealingSourceRules = {
  ...generic, ...healingSourceGroupA, ...healingSourceGroupB, ...healingSourceGroupC,
  ...healingSourceGroupD, ...healingSourceGroupE, ...healingSourceGroupF, ...healingSourceGroupG,
} as const satisfies Record<string, SourceHostHealingSourceDescriptor>;
export type SourceHostHealingSourceRuleId = keyof typeof sourceHostHealingSourceRules;
export const sourceHostHealingSourceRuleIds = Object.keys(sourceHostHealingSourceRules) as SourceHostHealingSourceRuleId[];
export function isSourceHostHealingSourceRuleId(value: string): value is SourceHostHealingSourceRuleId {
  return Object.prototype.hasOwnProperty.call(sourceHostHealingSourceRules, value);
}
export function sourceHostHealingSourceRuleDescriptor(ruleId: SourceHostHealingSourceRuleId): SourceHostHealingSourceDescriptor {
  return sourceHostHealingSourceRules[ruleId];
}
export const sourceHostHealingSourceInputSchema = z.object({
  operation: z.literal("source"),
  ruleId: z.custom<SourceHostHealingSourceRuleId>(value => typeof value === "string" && isSourceHostHealingSourceRuleId(value),
    "未知来源治疗源数值规则"),
  sourceHolderIndex: z.number().int().nonnegative(),
  state: z.record(z.string(), z.number().finite()),
}).strict().superRefine((input, context) => {
  if (!isSourceHostHealingSourceRuleId(input.ruleId)) return;
  const descriptor = sourceHostHealingSourceRuleDescriptor(input.ruleId);
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
export type SourceHostHealingSourceInput = z.infer<typeof sourceHostHealingSourceInputSchema>;

export function resolveSourceHostHealingSourceInput(raw: unknown, sourceCommit: string,
  prefix = "healingSource"): { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] } {
  const input = sourceHostHealingSourceInputSchema.parse(raw);
  const descriptor = sourceHostHealingSourceRuleDescriptor(input.ruleId);
  if (!descriptor.sourceCommits.includes(sourceCommit))
    throw new Error(`治疗源数值规则不属于固定源码版本：${input.ruleId}`);
  const builder = new TraceBuilder([`https://github.com/genshinsim/gcsim/blob/${sourceCommit}/${descriptor.sourceFile}`]);
  const value = builder.add(`${prefix}.${input.ruleId}`, descriptor.title, descriptor.expression,
    Object.entries(descriptor.inputs).map(([key, parameter]) => traceInput(key, input.state[key]!, parameter.unit,
      "source-host-native-state", `${parameter.label}：原生 HealInfo 构造点实际状态`)), {
      unit: descriptor.resultUnit, explanationKey: `${descriptor.explanation} Go 将共享结果写入实际 HealInfo 字段；来源持有者 #${input.sourceHolderIndex}。`,
    });
  return { value, trace: builder.nodes, explanationGaps: [...(descriptor.explanationGaps ?? [])] };
}
