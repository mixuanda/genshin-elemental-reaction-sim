import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
import type { SourceHostTargetPhaseMatch } from "./source-host-target-phase";

/** Shared per-hit application gate for explicitly declared target scenarios.
 * It models the selected phase inputs only; it is not a native enemy-mechanics claim.
 */
export interface SourceHostTargetApplicationInput {
  rawCalculationId: number;
  rawDamage: number;
  hpBefore: number;
  damageMode: boolean;
}

export interface SourceHostTargetApplicationResult {
  value: number;
  hpLoss: number;
  trace: CalculationTraceNode[];
  explanationGaps: string[];
}

export function resolveSourceHostTargetApplication(
  input: SourceHostTargetApplicationInput,
  phase: SourceHostTargetPhaseMatch,
): SourceHostTargetApplicationResult {
  const builder = new TraceBuilder([
    "source-host-target-application-v1",
    "declared-target-phases-v1",
  ]);
  const source = { kind: "source-host-target-phase" as const, reference: phase.id };
  const rawOrigin = { kind: "source-host-calculation", reference: String(input.rawCalculationId) };
  const damageAllowed = phase.effects.damage === "normal";
  const allowed = builder.add(
    "targetPhase.damageAllowed",
    "用户声明阶段中的伤害门控",
    expr.value(Number(damageAllowed)),
    [traceInput("damageAllowed", Number(damageAllowed), "boolean", source,
      damageAllowed ? "此帧位于用户声明的正常伤害阶段" : "此帧位于用户声明的免伤阶段")],
    { unit: "boolean", status: damageAllowed ? "applied" : "not-applicable",
      explanationKey: "该阶段是用户声明的目标情景，不代表游戏敌人机制已验证。" },
  );
  builder.add(
    "targetPhase.aura",
    "用户声明阶段中的附着处理",
    expr.value(Number(phase.effects.aura === "normal")),
    [traceInput("aura", Number(phase.effects.aura === "normal"), "boolean", source,
      phase.effects.aura === "normal" ? "用户声明允许附着处理" : "用户声明阻止附着处理")],
    { unit: "boolean", explanationKey: "附着轴作为用户声明的阶段输入保留；本公式只计算伤害应用。" },
  );
  builder.add(
    "targetPhase.hitConfirm",
    "用户声明阶段中的命中确认",
    expr.value(Number(phase.effects.hitConfirm === "normal")),
    [traceInput("hitConfirm", Number(phase.effects.hitConfirm === "normal"), "boolean", source,
      phase.effects.hitConfirm === "normal" ? "用户声明保留命中确认" : "用户声明阻止命中确认")],
    { unit: "boolean", explanationKey: "命中确认轴作为用户声明的阶段输入保留；其回调门控由来源执行路径处理。" },
  );
  const hpLoss = builder.add(
    "targetApplication.hpLoss",
    "本次目标生命损失",
    expr.condition("equal", expr.input("damageAllowed"), expr.value(1),
      expr.min(expr.input("rawDamage"), expr.input("hpBefore")), expr.value(0)),
    [traceInput("damageAllowed", allowed, "boolean", source, "用户声明的伤害阶段门控"),
      traceInput("rawDamage", input.rawDamage, "damage", rawOrigin, "前置 outgoing 计算的实际返回值"),
      traceInput("hpBefore", input.hpBefore, "hp", "来源实际扣血前", "应用本击前目标剩余生命")],
    { unit: "hp", explanationKey: damageAllowed
      ? "正常伤害阶段按来源目标扣血规则取伤害与剩余生命的较小值。"
      : "免伤阶段将本次目标生命损失设为零；这是用户声明情景。",
      childIds: ["targetPhase.damageAllowed"] },
  );
  const applied = builder.add(
    "targetApplication.appliedDamage",
    "伤害回调记账量",
    expr.condition("equal", expr.input("damageMode"), expr.value(1),
      expr.input("hpLoss"),
      expr.condition("equal", expr.input("damageAllowed"), expr.value(1), expr.input("rawDamage"), expr.value(0))),
    [traceInput("damageMode", Number(input.damageMode), "boolean", "来源实际运行模式", "击杀模式返回实际扣血；固定时长模式保留原始伤害统计量"),
      traceInput("hpLoss", hpLoss, "hp", { kind: "shared-core-execution", reference: "targetApplication.hpLoss" }, "前一步共享公式计算的目标生命损失"),
      traceInput("damageAllowed", allowed, "boolean", source, "用户声明的伤害阶段门控"),
      traceInput("rawDamage", input.rawDamage, "damage", rawOrigin, "前置 outgoing 计算的实际返回值")],
    { unit: "damage", explanationKey: "击杀模式记实际生命损失，固定时长模式记原始伤害；用户声明免伤时两者均为零。",
      childIds: ["targetApplication.hpLoss", "targetPhase.damageAllowed"] },
  );
  return { value: applied, hpLoss, trace: builder.nodes,
    explanationGaps: ["目标阶段三轴与半开窗口是用户声明的观察条件，不是已验证的游戏敌人机制。"] };
}
