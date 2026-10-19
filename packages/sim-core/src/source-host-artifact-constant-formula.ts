/** Stateless artifact Amount values from the pinned Go source. Native Go still
 * decides whether each modifier exists, applies, or has expired. */
import { z } from "zod";
import { expr, TraceBuilder, type CalculationTraceNode } from "./calculation-trace";
import { artifactConstantGroupA } from "./source-host-artifact-constant-group-a";
import { artifactConstantGroupB } from "./source-host-artifact-constant-group-b";

export interface SourceHostArtifactConstantDescriptor {
  set: string;
  title: string;
  statIndex: number;
  value: number;
  modifierKeys: readonly string[];
  explanation: string;
}

const overlap = Object.keys(artifactConstantGroupA).filter(key => Object.prototype.hasOwnProperty.call(artifactConstantGroupB, key));
if (overlap.length) throw new Error(`重复的来源圣遗物常量规则：${overlap.join(", ")}`);

export const sourceHostArtifactConstantRules = {
  ...artifactConstantGroupA, ...artifactConstantGroupB,
} as const satisfies Record<string, SourceHostArtifactConstantDescriptor>;
export type SourceHostArtifactConstantRuleId = keyof typeof sourceHostArtifactConstantRules;
export const sourceHostArtifactConstantRuleIds = Object.keys(sourceHostArtifactConstantRules) as SourceHostArtifactConstantRuleId[];
const own = (value: string): value is SourceHostArtifactConstantRuleId => Object.prototype.hasOwnProperty.call(sourceHostArtifactConstantRules, value);
export const isSourceHostArtifactConstantRuleId = own;
export const sourceHostArtifactConstantInputSchema = z.object({
  ruleId: z.custom<SourceHostArtifactConstantRuleId>((value) => typeof value === "string" && own(value), "未知来源圣遗物常量规则"),
}).strict();
export type SourceHostArtifactConstantInput = z.infer<typeof sourceHostArtifactConstantInputSchema>;

export function sourceHostArtifactConstantRuleStatIndex(ruleId: SourceHostArtifactConstantRuleId): number {
  return sourceHostArtifactConstantRules[ruleId].statIndex;
}
export function sourceHostArtifactConstantRuleTitle(ruleId: SourceHostArtifactConstantRuleId): string {
  return sourceHostArtifactConstantRules[ruleId].title;
}
export function sourceHostArtifactConstantModifierKeys(ruleId: SourceHostArtifactConstantRuleId): readonly string[] {
  return sourceHostArtifactConstantRules[ruleId].modifierKeys;
}
export interface SourceHostArtifactConstantCalculation { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] }

export function resolveSourceHostArtifactConstantInput(raw: unknown, sourceCommit: string, prefix = "artifactScalar"): SourceHostArtifactConstantCalculation {
  const input = sourceHostArtifactConstantInputSchema.parse(raw);
  const descriptor = sourceHostArtifactConstantRules[input.ruleId];
  const builder = new TraceBuilder([`https://github.com/genshinsim/gcsim/blob/${sourceCommit}/internal/artifacts/${descriptor.set}/${descriptor.set}.go`]);
  const value = builder.add(`${prefix}.${input.ruleId}`, descriptor.title, expr.value(descriptor.value), [], {
    unit: descriptor.statIndex === 8 ? "EM" : [2, 3, 5, 23, 24, 25].includes(descriptor.statIndex) ? "stat" : "ratio",
    explanationKey: `${descriptor.explanation} Go 保留原生装备调用的触发、适用与到期；这是本次实际请求的固定返回值。`,
  });
  return { value, trace: builder.nodes, explanationGaps: ["来源圣遗物调用的触发与适用由 Go 原生状态决定；固定值公式不重演生命周期。"] };
}
