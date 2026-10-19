/** Arithmetic returned to the original source-owned artifact damage callback. */
import { z } from "zod";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

export const sourceHostArtifactAdditiveInputSchema = z.object({
  ruleId: z.enum(["echoes", "songofdayspast", "oceanhuedclam"]),
  sourceValue: z.number().finite(),
}).strict();
export type SourceHostArtifactAdditiveInput = z.infer<typeof sourceHostArtifactAdditiveInputSchema>;
export interface SourceHostArtifactAdditiveCalculation {
  value: number;
  trace: CalculationTraceNode[];
  explanationGaps: string[];
}

const rules = {
  echoes: { title: "来歆余响四件：幽谷祝祀附加伤害", source: "本次实际总攻击力", unit: "ATK", factor: 0.7, path: "echoes/echoes.go" },
  songofdayspast: { title: "昔时之歌四件：往日之歌附加伤害", source: "六秒疗愈快照", unit: "healing", factor: 0.08, path: "songofdayspast/songofdayspast.go" },
  oceanhuedclam: { title: "海染砗磲四件：海染泡沫伤害基数", source: "三秒泡沫累积治疗量", unit: "healing", factor: 0.9, path: "oceanhuedclam/oceanhuedclam.go" },
} as const;

/** The returned value is assigned to the exact native FlatDmg addition or queued attack. */
export function resolveSourceHostArtifactAdditiveInput(raw: unknown, sourceCommit: string, prefix = "artifactAdditive"): SourceHostArtifactAdditiveCalculation {
  const input = sourceHostArtifactAdditiveInputSchema.parse(raw);
  const rule = rules[input.ruleId];
  const builder = new TraceBuilder([`https://github.com/genshinsim/gcsim/blob/${sourceCommit}/internal/artifacts/${rule.path}`]);
  const value = builder.add(`${prefix}.flatDamage`, rule.title,
    expr.mul(expr.input("sourceValue"), expr.value(rule.factor)),
    [traceInput("sourceValue", input.sourceValue, rule.unit, "source-host-native-artifact-state", `Go 原回调本次实际读取的${rule.source}`)],
    { unit: "damage", explanationKey: `共享公式将本次${rule.source}乘以 ${rule.factor}；原生触发门、状态窗口、次数与排队时序由固定 Go 源码决定。` });
  return { value, trace: builder.nodes,
    explanationGaps: ["此公式只计算已经由 Go 决定发生的装备附加值；编辑输入不会重放原生触发、随机抽样或排队。"] };
}
