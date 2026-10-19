import type { HealthChangeDefinition, PlayerHealthEvent } from "@genshin-dps-lab/schemas";
import { TraceBuilder, expr, traceInput, type CalculationTraceNode } from "./calculation-trace";

const revision = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
export const BOND_OF_LIFE_PROFILE = {
  id: "gcsim-b4ae769-same-heal-remainder-v1",
  evidenceStatus: "fixed-source-assumed",
  sourceRefs: [
    `https://github.com/genshinsim/gcsim/blob/${revision}/internal/template/character/hp.go`,
    `https://github.com/genshinsim/gcsim/blob/${revision}/internal/template/character/heal.go`,
  ],
  assumptions: [
    "采用固定源码默认 ReceiveHeal：治疗加成结算后先抵消生命之契，同一口剩余治疗立即恢复生命。源码仍将此余量规则标为 TODO 假设，未经实机确认。",
    "生命之契是独立绝对值资源；非零债务操作才钳制至当前最大生命两倍，上限变化本身不缩放或清除已有债务，不自动到期。",
    "人物治疗覆写及生命之契触发的装备／人物被动未自动映射；具体授予、移除与初值均须显式声明。",
  ],
} as const;

export interface BondOfLifeContext {
  mode: typeof BOND_OF_LIFE_PROFILE.id;
  debtBefore: number;
}
export type BondOfLifeCalculation = NonNullable<PlayerHealthEvent["bondOfLife"]>;

/** Default fixed-source debt mutation, including the source callback's inverse sign. */
export function calculateBondOfLife(operation: HealthChangeDefinition["operation"], requestedAmount: number,
  debtBefore: number, maxHp: number, sharedTrace?: TraceBuilder): BondOfLifeCalculation & { trace: CalculationTraceNode[] } {
  const trace = sharedTrace ?? new TraceBuilder([...BOND_OF_LIFE_PROFILE.sourceRefs]);
  const input = (key: string, value: number, meaning: string) => traceInput(key, value, "HP", "actual-player-health-state", meaning);
  const options = { unit: "HP", status: "assumed" as const, warnings: [...BOND_OF_LIFE_PROFILE.assumptions] };
  const requestedDebtDelta = trace.add("bond.requestedDelta", "请求生命之契变化", operation === "consume" ? expr.value(0)
    : operation === "bond-add" ? expr.input("requestedAmount") : expr.sub(expr.value(0), expr.input("requestedAmount")),
    operation === "consume" ? [] : [input("requestedAmount", requestedAmount, operation === "heal" ? "治疗加成结算后的完整治疗量" : "显式授予或移除的生命之契数值")],
    { ...options, explanationKey: "授予为正，主动移除和治疗抵债为负；生命消耗不会改变生命之契。" });
  const debtAfter = trace.add("bond.after", "事件后生命之契", requestedDebtDelta === 0 ? expr.input("debtBefore") : expr.min(expr.mul(expr.value(2), expr.input("maxHp")),
    expr.max(expr.value(0), expr.add(expr.input("debtBefore"), expr.input("requestedDebtDelta")))),
    [input("debtBefore", debtBefore, "真实事件前生命之契绝对值"), input("requestedDebtDelta", requestedDebtDelta, "本次债务请求变化"), input("maxHp", maxHp, "静态最大生命值")],
    { ...options, childIds: ["bond.requestedDelta"], explanationKey: "零请求直接保留原债务；非零请求才钳制在零与当前最大生命两倍之间。上限降低后已有债务可以暂时超过两倍上限。" });
  const actualDebtDelta = trace.add("bond.actualDelta", "实际生命之契变化", expr.sub(expr.input("debtAfter"), expr.input("debtBefore")),
    [input("debtAfter", debtAfter, "变更后的生命之契"), input("debtBefore", debtBefore, "变更前的生命之契")],
    { ...options, childIds: ["bond.after"], explanationKey: "实际变化可能被上下限截断，不以请求量代替实际资源变化。" });
  const absorbedHealing = trace.add("bond.absorbedHealing", "用于抵债的治疗", operation === "heal" ? expr.min(expr.input("debtBefore"), expr.input("requestedAmount")) : expr.value(0),
    operation === "heal" ? [input("debtBefore", debtBefore, "治疗前生命之契"), input("requestedAmount", requestedAmount, "治疗加成后的请求治疗量")] : [],
    { ...options, explanationKey: "治疗先支付生命之契；被用于抵债的部分既不是有效回血，也不是溢出治疗。" });
  const healingAfterDebt = trace.add("bond.healingAfterDebt", "抵债后可用治疗", operation === "heal" ? expr.max(expr.value(0), expr.sub(expr.input("requestedAmount"), expr.input("debtBefore"))) : expr.value(0),
    operation === "heal" ? [input("requestedAmount", requestedAmount, "完整请求治疗量"), input("debtBefore", debtBefore, "治疗前生命之契")] : [],
    { ...options, explanationKey: "采用所选来源假设：清债同一口治疗的余量立即用于回血，再受缺失生命上限约束。" });
  const sourceCallbackAmount = trace.add("bond.callbackAmount", "来源回调数值", expr.sub(expr.input("debtBefore"), expr.input("debtAfter")),
    [input("debtBefore", debtBefore, "修改前债务"), input("debtAfter", debtAfter, "修改后债务")],
    { ...options, childIds: ["bond.after"], explanationKey: "固定 OnHPDebt 参数是旧值减新值：增加债务为负、清除为正。零请求不发事件；非零请求即使被上限截成零变化也发出数值零。这里只记录来源回调事实，不自动激活未映射被动。" });
  return { profileId: BOND_OF_LIFE_PROFILE.id, debtBefore, debtAfter, requestedDebtDelta, actualDebtDelta,
    absorbedHealing, healingAfterDebt, sourceEventEmitted: requestedDebtDelta !== 0, sourceCallbackAmount, trace: trace.nodes };
}
