/** The pinned Dehya self-hit bypasses avatar Player.calc and sends raw damage
 * directly to the native shield handler. This identity has no defense, RES,
 * crit, or reaction terms. */
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
import { SOURCE_HOST_COMMIT, type SourceHostPlayerManualIncomingRequest } from "./source-host-wire";

export function resolveSourceHostPlayerManualIncomingRequest(request: SourceHostPlayerManualIncomingRequest): {
  value: number; trace: CalculationTraceNode[]; explanationGaps: string[];
} {
  const builder = new TraceBuilder([`https://github.com/genshinsim/gcsim/blob/${request.sourceCommit ?? SOURCE_HOST_COMMIT}/internal/characters/dehya/skill.go`]);
  const value = builder.add("manualIncomingRaw", "手工玩家自伤入盾值", expr.input("rawDamage"), [
    traceInput("rawDamage", request.input.rawDamage, "damage", "source-host-native-state", "Dehya 原手工自伤路径传入护盾的实际伤害"),
  ], { unit: "damage", explanationKey: "来源手工自伤路径跳过玩家普通伤害计算；此值原样进入 Shields.OnDamage。" });
  return { value, trace: builder.nodes, explanationGaps: ["Dehya 手工自伤路径是固定来源的特例；其源码 TODO 不代表经过游戏实测。"] };
}
