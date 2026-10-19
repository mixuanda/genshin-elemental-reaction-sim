/** Shared arithmetic for selected source-owned artifact modifiers. Go still
 * decides triggers, live stacks, expiry, hitlag, and whether Amount returns nil. */
import { z } from "zod";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode, type FormulaExpression, type TraceInput } from "./calculation-trace";
import { isSourceHostArtifactConstantRuleId, resolveSourceHostArtifactConstantInput,
  sourceHostArtifactConstantInputSchema, sourceHostArtifactConstantRuleStatIndex, sourceHostArtifactConstantRuleTitle } from "./source-host-artifact-constant-formula";
import { isSourceHostArtifactDynamicRuleId, resolveSourceHostArtifactDynamicInput,
  sourceHostArtifactDynamicInputSchema, sourceHostArtifactDynamicRuleStatIndex, sourceHostArtifactDynamicRuleTitle } from "./source-host-artifact-dynamic-formula";
import { isSourceHostArtifactAuxiliaryRuleId, resolveSourceHostArtifactAuxiliaryInput,
  sourceHostArtifactAuxiliaryInputSchema, sourceHostArtifactAuxiliaryDescriptor } from "./source-host-artifact-auxiliary-formula";

const constantRules = ["mh-2pc", "gt-2pc", "hod-2pc", "hod-4pc", "nd-2pc", "pf-2pc", "cw-2pc", "vg-2pc", "vg-4pc-base", "vg-4pc-stack"] as const;
const sourceHostArtifactLegacyScalarInputSchema = z.discriminatedUnion("ruleId", [
  z.object({ ruleId: z.literal("mh-2pc") }).strict(),
  z.object({ ruleId: z.literal("gt-2pc") }).strict(),
  z.object({ ruleId: z.literal("hod-2pc") }).strict(),
  z.object({ ruleId: z.literal("hod-4pc") }).strict(),
  z.object({ ruleId: z.literal("nd-2pc") }).strict(),
  z.object({ ruleId: z.literal("pf-2pc") }).strict(),
  z.object({ ruleId: z.literal("cw-2pc") }).strict(),
  z.object({ ruleId: z.literal("vg-2pc") }).strict(),
  z.object({ ruleId: z.literal("vg-4pc-base") }).strict(),
  z.object({ ruleId: z.literal("vg-4pc-stack") }).strict(),
  z.object({ ruleId: z.literal("mh-4pc"), stacks: z.number().int().min(0).max(3) }).strict(),
  z.object({ ruleId: z.literal("nd-4pc-atk"), stacks: z.number().int().min(0).max(3) }).strict(),
  z.object({ ruleId: z.literal("nd-4pc-hydro"), stacks: z.number().int().min(0).max(3) }).strict(),
  z.object({ ruleId: z.literal("pf-4pc-atk"), stacks: z.number().int().min(0).max(2) }).strict(),
  z.object({ ruleId: z.literal("pf-4pc-physical"), stacks: z.number().int().min(0).max(2) }).strict(),
  z.object({ ruleId: z.literal("cw-4pc-pyro"), stacks: z.number().int().min(0).max(3) }).strict(),
  z.object({ ruleId: z.literal("gt-4pc"), tier: z.union([z.literal(1), z.literal(2)]) }).strict(),
  z.object({ ruleId: z.literal("cw-4pc-reaction"), branch: z.enum(["transformative", "amplifying", "none"]) }).strict(),
]);
export const sourceHostArtifactScalarInputSchema = z.union([sourceHostArtifactLegacyScalarInputSchema, sourceHostArtifactConstantInputSchema, sourceHostArtifactDynamicInputSchema, sourceHostArtifactAuxiliaryInputSchema]);
export type SourceHostArtifactScalarInput = z.infer<typeof sourceHostArtifactScalarInputSchema>;
export type SourceHostArtifactRuleId = SourceHostArtifactScalarInput["ruleId"];
type SourceHostArtifactLegacyRuleId = z.infer<typeof sourceHostArtifactLegacyScalarInputSchema>["ruleId"];

const ruleInfo: Record<SourceHostArtifactLegacyRuleId, { set: string; title: string; statIndex?: number; explanation: string }> = {
  "mh-2pc": { set: "marechausseehunter", title: "逐影猎人两件：普攻与重击增伤", statIndex: 21, explanation: "Go 已按攻击标签筛选；此处只计算符合条件时的 15% 增伤。" },
  "mh-4pc": { set: "marechausseehunter", title: "逐影猎人四件：暴击率层数", statIndex: 9, explanation: "Go 保留生命变化事件、持续时间与最多三层状态；每层实际给予 12% 暴击率。" },
  "gt-2pc": { set: "goldentroupe", title: "黄金剧团两件：战技增伤", statIndex: 21, explanation: "Go 已按战技攻击标签筛选；本项是 20% 增伤。" },
  "gt-4pc": { set: "goldentroupe", title: "黄金剧团四件：场上状态增伤", statIndex: 21, explanation: "Go 保留换人及两秒清除任务；一档 25%，离场期间二档 50%。" },
  "hod-2pc": { set: "heartofdepth", title: "沉沦之心两件：水伤", statIndex: 13, explanation: "水元素伤害加成 15%。" },
  "hod-4pc": { set: "heartofdepth", title: "沉沦之心四件：普攻与重击增伤", statIndex: 21, explanation: "Go 保留战技触发、持续时间与攻击标签筛选；本项是 30% 增伤。" },
  "nd-2pc": { set: "nymphsdream", title: "水仙之梦两件：水伤", statIndex: 13, explanation: "水元素伤害加成 15%。" },
  "nd-4pc-atk": { set: "nymphsdream", title: "水仙之梦四件：攻击力层级", statIndex: 6, explanation: "Go 在取样时检查五类真实状态；一、二、三层分别为 7%、16%、25% 攻击力。" },
  "nd-4pc-hydro": { set: "nymphsdream", title: "水仙之梦四件：水伤层级", statIndex: 13, explanation: "Go 在取样时检查五类真实状态；一、二、三层分别为 4%、9%、15% 水伤。" },
  "pf-2pc": { set: "paleflame", title: "苍白之火两件：物理伤害", statIndex: 19, explanation: "物理伤害加成 25%。" },
  "pf-4pc-atk": { set: "paleflame", title: "苍白之火四件：攻击力层数", statIndex: 6, explanation: "Go 保留战技命中、0.3 秒间隔与七秒时长；每层 9% 攻击力。" },
  "pf-4pc-physical": { set: "paleflame", title: "苍白之火四件：满层物伤", statIndex: 19, explanation: "仅来源实际达到两层时另加 25% 物理伤害。" },
  "cw-2pc": { set: "crimson", title: "炽烈的炎之魔女两件：火伤", statIndex: 12, explanation: "火元素伤害加成 15%。" },
  "cw-4pc-pyro": { set: "crimson", title: "炽烈的炎之魔女四件：火伤层数", statIndex: 12, explanation: "Go 保留战技事件、十秒状态与最多三层；每层是两件套火伤值一半，即 7.5%。" },
  "cw-4pc-reaction": { set: "crimson", title: "炽烈的炎之魔女四件：反应加成", explanation: "Go 保留实际反应标签与增幅判断；超载、燃烧、烈绽放为 40%，增幅为 15%，否则为零。" },
  "vg-2pc": { set: "vourukashasglow", title: "花海甘露之光两件：生命值", statIndex: 4, explanation: "生命值百分比提高 20%。" },
  "vg-4pc-base": { set: "vourukashasglow", title: "花海甘露之光四件：基础战技与爆发增伤", statIndex: 21, explanation: "Go 已按战技/爆发标签筛选；基础加成为 10%。" },
  "vg-4pc-stack": { set: "vourukashasglow", title: "花海甘露之光四件：单个独立伤害层", statIndex: 21, explanation: "Go 保留五个独立到期的 AttackMod；当前这个实际存在的层单独提供 8%。" },
};
export function sourceHostArtifactRuleStatIndex(ruleId: SourceHostArtifactRuleId): number | undefined {
  if (isSourceHostArtifactAuxiliaryRuleId(ruleId)) return undefined;
  if (isSourceHostArtifactConstantRuleId(ruleId)) return sourceHostArtifactConstantRuleStatIndex(ruleId);
  if (isSourceHostArtifactDynamicRuleId(ruleId)) return sourceHostArtifactDynamicRuleStatIndex(ruleId);
  return ruleInfo[ruleId].statIndex;
}
export function sourceHostArtifactRuleTitle(ruleId: SourceHostArtifactRuleId): string {
  if (isSourceHostArtifactAuxiliaryRuleId(ruleId)) return sourceHostArtifactAuxiliaryDescriptor(ruleId).title;
  if (isSourceHostArtifactConstantRuleId(ruleId)) return sourceHostArtifactConstantRuleTitle(ruleId);
  if (isSourceHostArtifactDynamicRuleId(ruleId)) return sourceHostArtifactDynamicRuleTitle(ruleId);
  return ruleInfo[ruleId].title;
}

const constantValues: Record<(typeof constantRules)[number], number> = {
  "mh-2pc": .15, "gt-2pc": .2, "hod-2pc": .15, "hod-4pc": .3, "nd-2pc": .15,
  "pf-2pc": .25, "cw-2pc": .15, "vg-2pc": .2, "vg-4pc-base": .1, "vg-4pc-stack": .08,
};
export interface SourceHostArtifactScalarCalculation { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] }

/** Pure formula API for both live Go callbacks and independent edits. */
export function resolveSourceHostArtifactScalarInput(raw: unknown, sourceCommit: string, prefix = "artifactScalar"): SourceHostArtifactScalarCalculation {
  const parsed = sourceHostArtifactScalarInputSchema.parse(raw);
  if (isSourceHostArtifactAuxiliaryRuleId(parsed.ruleId)) return resolveSourceHostArtifactAuxiliaryInput(parsed, sourceCommit, prefix);
  if (isSourceHostArtifactConstantRuleId(parsed.ruleId)) return resolveSourceHostArtifactConstantInput(parsed, sourceCommit, prefix);
  if (isSourceHostArtifactDynamicRuleId(parsed.ruleId)) return resolveSourceHostArtifactDynamicInput(parsed, sourceCommit, prefix);
  const input = sourceHostArtifactLegacyScalarInputSchema.parse(parsed);
  const info = ruleInfo[input.ruleId];
  const builder = new TraceBuilder([`https://github.com/genshinsim/gcsim/blob/${sourceCommit}/internal/artifacts/${info.set}/${info.set}.go`]);
  let expression: FormulaExpression;
  const values: TraceInput[] = [];
  if ("stacks" in input) {
    values.push(traceInput("stacks", input.stacks, "count", "source-host-native-state", "Go 在原 modifier Amount 时实际读取的层数"));
    if (input.ruleId === "nd-4pc-atk") expression = expr.condition("equal", expr.input("stacks"), expr.value(0), expr.value(0), expr.sub(expr.mul(expr.value(.09), expr.input("stacks")), expr.value(.02)));
    else if (input.ruleId === "nd-4pc-hydro") expression = expr.condition("equal", expr.input("stacks"), expr.value(0), expr.value(0), expr.condition("equal", expr.input("stacks"), expr.value(1), expr.value(.04), expr.condition("equal", expr.input("stacks"), expr.value(2), expr.value(.09), expr.value(.15))));
    else if (input.ruleId === "pf-4pc-physical") expression = expr.condition("equal", expr.input("stacks"), expr.value(2), expr.value(.25), expr.value(0));
    else expression = expr.mul(expr.value(input.ruleId === "mh-4pc" ? .12 : input.ruleId === "pf-4pc-atk" ? .09 : .075), expr.input("stacks"));
  } else if (input.ruleId === "gt-4pc") {
    values.push(traceInput("tier", input.tier, "count", "source-host-native-state", "Go 换人/清除任务实际维护的一档或二档"));
    expression = expr.mul(expr.value(.25), expr.input("tier"));
  } else if (input.ruleId === "cw-4pc-reaction") {
    const branch = input.branch === "transformative" ? 2 : input.branch === "amplifying" ? 1 : 0;
    values.push(traceInput("branch", branch, "category", "source-host-native-state", "Go 实际攻击标签与 Amped 判定：2=超载/燃烧/烈绽放，1=增幅，0=其他"));
    expression = expr.condition("equal", expr.input("branch"), expr.value(2), expr.value(.4), expr.condition("equal", expr.input("branch"), expr.value(1), expr.value(.15), expr.value(0)));
  } else {
    expression = expr.value(constantValues[input.ruleId]);
  }
  const value = builder.add(`${prefix}.${input.ruleId}`, info.title, expression, values, {
    unit: "ratio", explanationKey: info.explanation,
  });
  return { value, trace: builder.nodes, explanationGaps: ["触发、持续时间、状态来源及适用性由固定 Go 宿主执行；此 AST 只负责本次确实请求的数值。"] };
}
