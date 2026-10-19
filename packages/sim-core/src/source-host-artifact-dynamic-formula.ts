/** Source-owned artifact state is sampled by Go; this module owns only the
 * scalar arithmetic returned to the original modifier Amount call. */
import { z } from "zod";
import { TraceBuilder, traceInput, type CalculationTraceNode, type FormulaExpression } from "./calculation-trace";
import { artifactDynamicGroupA } from "./source-host-artifact-dynamic-group-a";
import { artifactDynamicGroupB } from "./source-host-artifact-dynamic-group-b";
import { artifactDynamicGroupC } from "./source-host-artifact-dynamic-group-c";
import { artifactDynamicGroupD } from "./source-host-artifact-dynamic-group-d";

export interface SourceHostArtifactDynamicParameter {
  label: string;
  unit: string;
  minimum?: number;
  maximum?: number;
  integer?: boolean;
  choices?: readonly { value: number; label: string }[];
}
export interface SourceHostArtifactDynamicDescriptor {
  set: string;
  title: string;
  statIndex?: number;
  modifierKeys: readonly string[];
  inputs: Readonly<Record<string, SourceHostArtifactDynamicParameter>>;
  expression: FormulaExpression;
  explanation: string;
  sourceCommits?: readonly string[];
}

const dynamicRuleIds = [
  ...Object.keys(artifactDynamicGroupA),
  ...Object.keys(artifactDynamicGroupB),
  ...Object.keys(artifactDynamicGroupC),
  ...Object.keys(artifactDynamicGroupD),
];
if (new Set(dynamicRuleIds).size !== dynamicRuleIds.length) throw new Error("来源动态圣遗物规则 ID 重复");
export const sourceHostArtifactDynamicRules = {
  ...artifactDynamicGroupA,
  ...artifactDynamicGroupB,
  ...artifactDynamicGroupC,
  ...artifactDynamicGroupD,
} as const satisfies Record<string, SourceHostArtifactDynamicDescriptor>;
export type SourceHostArtifactDynamicRuleId = keyof typeof sourceHostArtifactDynamicRules;
export const sourceHostArtifactDynamicRuleIds = Object.keys(sourceHostArtifactDynamicRules) as SourceHostArtifactDynamicRuleId[];
export function isSourceHostArtifactDynamicRuleId(value: string): value is SourceHostArtifactDynamicRuleId {
  return Object.prototype.hasOwnProperty.call(sourceHostArtifactDynamicRules, value);
}
export function sourceHostArtifactDynamicRuleDescriptor(ruleId: SourceHostArtifactDynamicRuleId): SourceHostArtifactDynamicDescriptor {
  return sourceHostArtifactDynamicRules[ruleId];
}
export function sourceHostArtifactDynamicInputs(ruleId: SourceHostArtifactDynamicRuleId): Readonly<Record<string, SourceHostArtifactDynamicParameter>> {
  return sourceHostArtifactDynamicRules[ruleId].inputs as Readonly<Record<string, SourceHostArtifactDynamicParameter>>;
}
export function sourceHostArtifactDynamicRuleTitle(ruleId: SourceHostArtifactDynamicRuleId): string {
  return sourceHostArtifactDynamicRules[ruleId].title;
}
export function sourceHostArtifactDynamicRuleStatIndex(ruleId: SourceHostArtifactDynamicRuleId): number | undefined {
  const descriptor: SourceHostArtifactDynamicDescriptor = sourceHostArtifactDynamicRules[ruleId];
  return descriptor.statIndex;
}
export function sourceHostArtifactDynamicModifierKeys(ruleId: SourceHostArtifactDynamicRuleId): readonly string[] {
  return sourceHostArtifactDynamicRules[ruleId].modifierKeys;
}

export const sourceHostArtifactDynamicInputSchema = z.object({
  ruleId: z.custom<SourceHostArtifactDynamicRuleId>((value) => typeof value === "string" && isSourceHostArtifactDynamicRuleId(value), "未知来源圣遗物动态规则"),
  state: z.record(z.string(), z.number().finite()),
}).strict().superRefine((input, context) => {
  if (!isSourceHostArtifactDynamicRuleId(input.ruleId)) return;
  const parameters = sourceHostArtifactDynamicInputs(input.ruleId);
  for (const [key, parameter] of Object.entries(parameters)) {
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
  for (const key of Object.keys(input.state)) if (!Object.prototype.hasOwnProperty.call(parameters, key)) {
    context.addIssue({ code: "custom", path: ["state", key], message: `规则没有状态参数 ${key}` });
  }
});
export type SourceHostArtifactDynamicInput = z.infer<typeof sourceHostArtifactDynamicInputSchema>;
export interface SourceHostArtifactDynamicCalculation { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] }

export function resolveSourceHostArtifactDynamicInput(raw: unknown, sourceCommit: string, prefix = "artifactScalar"): SourceHostArtifactDynamicCalculation {
  const input = sourceHostArtifactDynamicInputSchema.parse(raw);
  const descriptor = sourceHostArtifactDynamicRuleDescriptor(input.ruleId);
  if (descriptor.sourceCommits !== undefined && !descriptor.sourceCommits.includes(sourceCommit)) {
    throw new Error(`来源动态圣遗物规则 ${input.ruleId} 不适用于固定源码 ${sourceCommit}`);
  }
  const builder = new TraceBuilder([`https://github.com/genshinsim/gcsim/blob/${sourceCommit}/internal/artifacts/${descriptor.set}/${descriptor.set}.go`]);
  const values = Object.entries(descriptor.inputs).map(([key, parameter]) => traceInput(key, input.state[key]!, parameter.unit,
    "source-host-native-state", `${parameter.label}：Go 在本次原生装备调用实际读取的状态`));
  const unit = descriptor.statIndex === 8 ? "EM" : descriptor.statIndex !== undefined && [2, 3, 5, 23, 24, 25].includes(descriptor.statIndex) ? "stat" : "ratio";
  const value = builder.add(`${prefix}.${input.ruleId}`, descriptor.title, descriptor.expression, values, {
    unit, explanationKey: `${descriptor.explanation} 触发、状态更新与生命周期仍由固定 Go 宿主执行。`,
  });
  return { value, trace: builder.nodes, explanationGaps: ["动态圣遗物输入是来源本次实际状态；共享 AST 计算本次装备调用的返回值，不重演触发历史或过期顺序。"] };
}
