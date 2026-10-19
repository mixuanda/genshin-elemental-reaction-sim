/** Constant scalar clauses applied inside the pinned host's own artifact callbacks.
 * The host still owns creation, recipients, eligibility, duration, and reads. */
import { z } from "zod";
import { expr, TraceBuilder, type CalculationTraceNode } from "./calculation-trace";

const pinnedCommits = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
type AuxiliaryKind = "heal-bonus" | "shield-bonus" | "resistance";
interface AuxiliaryDescriptor { set: string; title: string; kind: AuxiliaryKind; modifierKeys: readonly string[]; element?: string; value: number; explanation: string; sourceCommits: readonly string[] }
export const sourceHostArtifactAuxiliaryRules = {
  "maiden-4pc-heal": { set: "maiden", title: "被怜爱的少女四件：团队受治疗加成", kind: "heal-bonus", modifierKeys: ["maiden-4pc"], value: 0.2, explanation: "来源团队治疗修正闭包在原有施放触发和十秒有效期内返回20%。", sourceCommits: pinnedCommits },
  "bolide-2pc-shield": { set: "bolide", title: "逆飞的流星两件：护盾强效", kind: "shield-bonus", modifierKeys: ["bolide-2pc"], value: 0.35, explanation: "来源全局护盾强效闭包返回35%；保持原生注册及领取语义。", sourceCommits: pinnedCommits },
  "tenacity-4pc-shield": { set: "tenacity", title: "千岩牢固四件：护盾强效", kind: "shield-bonus", modifierKeys: ["tom-4pc"], value: 0.3, explanation: "来源战技命中后创建三秒护盾强效修正，原闭包返回30%；触发间隔和期限由Go维护。", sourceCommits: pinnedCommits },
  "deepwood-4pc-res": { set: "deepwood", title: "深林的记忆四件：目标草抗降低", kind: "resistance", modifierKeys: ["dm-4pc"], element: "dendro", value: -0.3, explanation: "来源战技或爆发命中时在实际目标创建八秒草抗修正；仅将创建时的−30%数值交给共享公式。", sourceCommits: pinnedCommits },
  "viridescent-4pc-res-cryo": { set: "viridescent", title: "翠绿之影四件：目标冰抗降低", kind: "resistance", modifierKeys: ["vvcryo"], element: "cryo", value: -0.4, explanation: "来源在实际目标创建十秒冰抗修正；仅将创建时的−40%数值交给共享公式。", sourceCommits: pinnedCommits },
  "viridescent-4pc-res-electro": { set: "viridescent", title: "翠绿之影四件：目标雷抗降低", kind: "resistance", modifierKeys: ["vvelectro"], element: "electro", value: -0.4, explanation: "来源在实际目标创建十秒雷抗修正；仅将创建时的−40%数值交给共享公式。", sourceCommits: pinnedCommits },
  "viridescent-4pc-res-hydro": { set: "viridescent", title: "翠绿之影四件：目标水抗降低", kind: "resistance", modifierKeys: ["vvhydro"], element: "hydro", value: -0.4, explanation: "来源在实际目标创建十秒水抗修正；仅将创建时的−40%数值交给共享公式。", sourceCommits: pinnedCommits },
  "viridescent-4pc-res-pyro": { set: "viridescent", title: "翠绿之影四件：目标火抗降低", kind: "resistance", modifierKeys: ["vvpyro"], element: "pyro", value: -0.4, explanation: "来源在实际目标创建十秒火抗修正；仅将创建时的−40%数值交给共享公式。", sourceCommits: pinnedCommits },
} as const satisfies Record<string, AuxiliaryDescriptor>;
export type SourceHostArtifactAuxiliaryRuleId = keyof typeof sourceHostArtifactAuxiliaryRules;
export const sourceHostArtifactAuxiliaryRuleIds = Object.keys(sourceHostArtifactAuxiliaryRules) as SourceHostArtifactAuxiliaryRuleId[];
export function isSourceHostArtifactAuxiliaryRuleId(value: string): value is SourceHostArtifactAuxiliaryRuleId {
  return Object.prototype.hasOwnProperty.call(sourceHostArtifactAuxiliaryRules, value);
}
export function sourceHostArtifactAuxiliaryDescriptor(ruleId: SourceHostArtifactAuxiliaryRuleId): AuxiliaryDescriptor {
  return sourceHostArtifactAuxiliaryRules[ruleId];
}
export const sourceHostArtifactAuxiliaryInputSchema = z.object({
  ruleId: z.custom<SourceHostArtifactAuxiliaryRuleId>((value) => typeof value === "string" && isSourceHostArtifactAuxiliaryRuleId(value), "未知来源圣遗物辅助标量规则"),
}).strict();
export type SourceHostArtifactAuxiliaryInput = z.infer<typeof sourceHostArtifactAuxiliaryInputSchema>;
export interface SourceHostArtifactAuxiliaryCalculation { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] }
export function resolveSourceHostArtifactAuxiliaryInput(raw: unknown, sourceCommit: string, prefix = "artifactScalar"): SourceHostArtifactAuxiliaryCalculation {
  const input = sourceHostArtifactAuxiliaryInputSchema.parse(raw);
  const descriptor = sourceHostArtifactAuxiliaryDescriptor(input.ruleId);
  if (!descriptor.sourceCommits.includes(sourceCommit)) throw new Error(`来源圣遗物辅助规则 ${input.ruleId} 不适用于固定源码 ${sourceCommit}`);
  const builder = new TraceBuilder([`https://github.com/genshinsim/gcsim/blob/${sourceCommit}/internal/artifacts/${descriptor.set}/${descriptor.set}.go`]);
  const value = builder.add(`${prefix}.${input.ruleId}`, descriptor.title, expr.value(descriptor.value), [], {
    unit: "ratio", explanationKey: `${descriptor.explanation} 该来源修正值不证明真实游戏数值，固定源码以外的触发与消费不由此公式重演。`,
  });
  return { value, trace: builder.nodes, explanationGaps: ["此共享式只接管固定来源回调或减抗创建点的数值；目标、受益者、触发及到期仍由原生宿主确定。"] };
}
