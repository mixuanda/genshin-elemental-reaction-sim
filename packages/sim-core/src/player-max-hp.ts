import { TraceBuilder, expr, traceInput, type CalculationTraceNode } from "./calculation-trace";

const revision = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
export const PLAYER_MAX_HP_PROFILE = {
  id: "gcsim-b4ae769-ratio-preserving-v1", evidenceStatus: "fixed-source-assumed",
  sourceRefs: ["internal/template/character/hp.go", "pkg/core/player/character/stats.go", "pkg/core/attributes/stats.go"].map(path => `https://github.com/genshinsim/gcsim/blob/${revision}/${path}`),
  assumptions: ["采用固定源码：最大生命变化保留当前生命比例，绝对生命同步缩放；这不是治疗、生命消耗或伤害。", "生命之契保存绝对值；上限变化不自动清契或钳制，下一次非零债务操作才使用新的上限。", "只重放已声明的队伍属性增益；人物条件属性回调与 OnHPDebt 同步修改属性的专属机制未自动映射，未经实机确认。"],
} as const;
export interface PlayerMaxHpChangeInput { hpBefore: number; maxHpBefore: number; maxHpAfter: number; statsAfter: { baseHp: number; hpPct: number; flatHp: number }; bondOfLifeBefore?: number }
export function calculatePlayerMaxHpChange(input: PlayerMaxHpChangeInput): PlayerMaxHpChangeInput & {
  hpAfter: number; hpRatioBefore: number; hpRatioAfter: number; hpAdjustment: number; bondOfLifeAfter?: number; trace: CalculationTraceNode[];
} {
  if (input.maxHpBefore <= 0 || input.maxHpAfter <= 0) throw new Error("动态最大生命模式要求变化前后最大生命均大于零。");
  const trace = new TraceBuilder([...PLAYER_MAX_HP_PROFILE.sourceRefs]);
  const value = (key: string, amount: number, meaning: string, unit = "HP") => traceInput(key, amount, unit, "actual-player-max-hp-state", meaning);
  const options = { unit: "HP", status: "assumed" as const, warnings: [...PLAYER_MAX_HP_PROFILE.assumptions] };
  const maxHpAfter = trace.add("max-hp.maximum", "真实增益状态下的最大生命", expr.add(expr.mul(expr.input("baseHp"), expr.add(expr.value(1), expr.input("hpPct"))), expr.input("flatHp")),
    [value("baseHp", input.statsAfter.baseHp, "队伍基础生命"), value("hpPct", input.statsAfter.hpPct, "实际生效的生命百分比总和", "ratio"), value("flatHp", input.statsAfter.flatHp, "实际生效的固定生命总和")],
    { ...options, explanationKey: "最大生命 = 基础生命 × (1 + 生命百分比) + 固定生命；使用本次真实增益状态的属性，不从事件结果反推。" });
  if (maxHpAfter !== input.maxHpAfter) throw new Error("动态最大生命与实际属性输入计算不一致。");
  const hpRatioBefore = trace.add("max-hp.ratio", "保留当前生命比例", expr.div(expr.input("hpBefore"), expr.input("maxHpBefore")),
    [value("hpBefore", input.hpBefore, "变化前当前生命"), value("maxHpBefore", input.maxHpBefore, "变化前最大生命")], { ...options, unit: "ratio", explanationKey: "固定源码保存生命比例；属性变化本身不修改此比例。" });
  const hpAfter = trace.add("max-hp.after", "新上限下的当前生命", expr.mul(expr.input("hpRatioBefore"), expr.input("maxHpAfter")),
    [value("hpRatioBefore", hpRatioBefore, "保留的生命比例", "ratio"), value("maxHpAfter", maxHpAfter, "真实增益状态对应的新最大生命")],
    { ...options, childIds: ["max-hp.maximum", "max-hp.ratio"], explanationKey: "CurrentHP 每次返回保留比例乘实时 MaxHP；在账本中显式记录等价的绝对生命变化。" });
  const hpAdjustment = trace.add("max-hp.adjustment", "上限导致的生命变化", expr.sub(expr.input("hpAfter"), expr.input("hpBefore")),
    [value("hpAfter", hpAfter, "变化后当前生命"), value("hpBefore", input.hpBefore, "变化前当前生命")],
    { ...options, childIds: ["max-hp.after"], explanationKey: "仅为属性上限变化造成的状态调整；不计入治疗、生命消耗或伤害，不发这些事件。" });
  return { ...input, hpAfter, hpRatioBefore, hpRatioAfter: hpRatioBefore, hpAdjustment,
    ...(input.bondOfLifeBefore === undefined ? {} : { bondOfLifeAfter: input.bondOfLifeBefore }), trace: trace.nodes };
}
