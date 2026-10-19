/** Arithmetic only: Go owns the weapon trigger, live window, and consumption. */
import { z } from "zod";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

export const sourceHostWeaponAdditiveInputSchema = z.object({
  ruleId: z.enum(["foliar", "hunterspath", "cinnabar"]),
  refinement: z.number().int().min(1).max(5),
  statValue: z.number().finite(),
}).strict();
export type SourceHostWeaponAdditiveInput = z.infer<typeof sourceHostWeaponAdditiveInputSchema>;
export interface SourceHostWeaponAdditiveCalculation {
  value: number;
  trace: CalculationTraceNode[];
  explanationGaps: string[];
}

const rules = {
  foliar: { title: "裁叶萃光：精通附加伤害", stat: "元素精通", unit: "EM", base: .9, perRefinement: .3, path: "sword/foliar/foliar.go" },
  hunterspath: { title: "猎人之径：精通附加伤害", stat: "元素精通", unit: "EM", base: 1.2, perRefinement: .4, path: "bow/hunterspath/hunterspath.go" },
  cinnabar: { title: "辰砂之纺锤：防御附加伤害", stat: "总防御力", unit: "DEF", base: .3, perRefinement: .1, path: "sword/cinnabar/cinnnabar.go" },
} as const;

/** The returned scalar is the value Go adds to the original attack's FlatDmg. */
export function resolveSourceHostWeaponAdditiveInput(raw: unknown, sourceCommit: string, prefix = "weaponAdditive"): SourceHostWeaponAdditiveCalculation {
  const input = sourceHostWeaponAdditiveInputSchema.parse(raw);
  const rule = rules[input.ruleId];
  const builder = new TraceBuilder([`https://github.com/genshinsim/gcsim/blob/${sourceCommit}/internal/weapons/${rule.path}`]);
  const coefficient = builder.add(`${prefix}.coefficient`, `${rule.title}：精炼系数`,
    expr.add(expr.value(rule.base), expr.mul(expr.value(rule.perRefinement), expr.input("refinement"))),
    [traceInput("refinement", input.refinement, "rank", "source-host-native-weapon", "来源实际装备的精炼等级")],
    { unit: "ratio", explanationKey: `此规则按 ${rule.base} + ${rule.perRefinement} × 精炼等级计算。` });
  const value = builder.add(`${prefix}.flatDamage`, rule.title,
    expr.mul(expr.input("statValue"), expr.input("coefficient")), [
      traceInput("statValue", input.statValue, rule.unit, "source-host-native-stat-read", `Go 在本次原生武器回调实际读取的${rule.stat}`),
      traceInput("coefficient", coefficient, "ratio", { kind: "shared-core-execution", reference: `${prefix}.coefficient` }, "上一共享公式步骤得出的精炼系数"),
    ], { unit: "damage", childIds: [`${prefix}.coefficient`],
      explanationKey: `本次共享结果进入原攻击的 FlatDmg；触发、可用次数及冷却由 Go 原生状态决定。` });
  return { value, trace: builder.nodes,
    explanationGaps: ["武器触发窗口、剩余次数与冷却仍由固定 Go 宿主执行；编辑此算式不会重跑武器状态机。"] };
}
