import type { ConditionalHitGroup } from "@genshin-dps-lab/schemas";
import { TraceBuilder, expr, traceInput, type CalculationTraceNode } from "./calculation-trace";

/** Evaluate once at accepted input; subsequent healing never changes this cast. */
export function calculateActionCondition(group: ConditionalHitGroup, owner: { currentHp: number; maxHp: number }): { selected: boolean; trace: CalculationTraceNode[] } {
  const trace = new TraceBuilder(group.sourceRefs);
  const prefix = `action-condition.${group.id}`;
  const threshold = trace.add(`${prefix}.threshold`, "本次起手生命阈值", expr.mul(expr.input("ownerMaxHp"), expr.input("thresholdRatio")), [
    traceInput("ownerMaxHp", owner.maxHp, "HP", "accepted-action-shared-hp", "动作接受时共享生命池的最大生命值"),
    traceInput("thresholdRatio", group.thresholdRatio, "ratio", "declared-action-condition", "来源明确的生命阈值比例")
  ], { unit: "HP", status: "assumed", explanationKey: "将本次动作接受时的最大生命值乘来源阈值；不是初始生命或未来命中时的生命。" });
  const selected = trace.add(`${prefix}.selected`, "本次动作是否纳入条件命中组", expr.condition("lte", expr.input("ownerCurrentHp"), expr.input("threshold"), expr.value(1), expr.value(0)), [
    traceInput("ownerCurrentHp", owner.currentHp, "HP", "accepted-action-shared-hp", "通过行动资格后、自产生命变化前的实际生命值"),
    traceInput("threshold", threshold, "HP", { kind: "previous-step", reference: `${prefix}.threshold` }, "最大生命值乘阈值比例")
  ], { unit: "boolean", status: "assumed", childIds: [`${prefix}.threshold`], explanationKey: "当前生命小于等于阈值时结果为1，纳入这组命中；否则为0。起手后锁定本次选择，之后治疗不会增减本次命中数。" });
  return { selected: selected === 1, trace: trace.nodes };
}
