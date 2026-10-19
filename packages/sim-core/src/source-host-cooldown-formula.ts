/** Numeric cooldown arithmetic at the pinned native character boundary. */
import { z } from "zod";
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";

const integer = z.number().int();
const action = { action: z.string().min(1), actionType: integer };

export const sourceHostCooldownInputSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("duration"), ...action, originalDuration: integer, cooldownFactor: z.number().finite() }).strict(),
  z.object({ operation: z.literal("remaining"), ...action, workerStartedAt: integer, headDuration: integer, currentFrame: integer }).strict(),
  z.object({ operation: z.literal("reduce"), ...action, remaining: integer, reduction: integer }).strict(),
  z.object({ operation: z.literal("source"), ...action, rule: z.literal("thundering-fury"), reduction: z.literal(60) }).strict(),
  z.object({ operation: z.literal("route"), ...action,
    rule: z.enum(["cyno", "varka-classic", "varka-stellar", "odette"]), reduction: integer, specialActive: z.boolean() }).strict(),
  z.object({ operation: z.literal("special-reduce"), ...action, rule: z.literal("varka-classic"),
    expiry: integer, reduction: integer, currentFrame: integer }).strict(),
]);

export type SourceHostCooldownInput = z.infer<typeof sourceHostCooldownInputSchema>;
export interface SourceHostCooldownCalculation { value: number; trace: CalculationTraceNode[]; explanationGaps: string[] }

/** Destinations of the original override, in its actual dispatch order. */
export function sourceHostCooldownRouteTargets(input: Extract<SourceHostCooldownInput, { operation: "route" }>): number[] {
  if (input.rule === "cyno") return input.actionType === 1 ? [input.actionType, 6] : [input.actionType];
  if (!input.specialActive) return [input.actionType];
  if (input.rule === "varka-classic") return [1, input.actionType]; // first target is its private Four Winds counter
  return input.rule === "odette" ? [14] : [14, input.actionType];
}

export function resolveSourceHostCooldownInput(raw: unknown, sourceCommit: string, prefix = "characterCooldown"): SourceHostCooldownCalculation {
  const input = sourceHostCooldownInputSchema.parse(raw);
  const source = `https://github.com/genshinsim/gcsim/blob/${sourceCommit}/`;
  const builder = new TraceBuilder([
    source + "internal/template/character/cooldown.go",
    source + "pkg/core/player/character/mods.go",
  ]);
  const observed = (key: string, value: number, meaning: string) => traceInput(key, value, "frame", "source-host-native-cooldown", meaning);
  const context = `动作 ${input.action}（原生编号 ${input.actionType}）`;

  if (input.operation === "source") {
    const value = builder.add(`${prefix}.source`, "如雷四件套本次冷却返还", expr.value(60), [], {
      unit: "frame", explanationKey: "原生如雷四件套已通过持有者、前台、反应与触发间隔判断，随后传入固定 60 帧。这里只记录本次来源数值；不把一次请求当成冷却已实际减少 60 帧。",
    });
    return { value, trace: builder.nodes, explanationGaps: ["如雷触发资格与间隔由原生事件回调决定；冷却已满、重置或其他角色转发须看后续实际记录。"] };
  }

  if (input.operation === "route") {
    if ((input.rule === "varka-classic" && sourceCommit !== "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541") ||
      ((input.rule === "varka-stellar" || input.rule === "odette") && sourceCommit !== "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"))
      throw new Error("角色冷却覆写分支不属于该固定来源版本。");
    if (input.specialActive && (input.actionType !== 1 || input.rule === "cyno"))
      throw new Error("特殊技能冷却分支与原始动作不一致。");
    const active = Number(input.specialActive);
    const targets = sourceHostCooldownRouteTargets(input);
    const branchInputs = [traceInput("actionType", input.actionType, "enum", "source-host-native-cooldown", "本次请求的原生动作编号"),
      traceInput("specialActive", active, "flag", "source-host-native-cooldown", "原判断的单次结果；非 skill 分支不额外读取状态")];
    const firstTarget = input.rule === "cyno" ? expr.input("actionType")
      : expr.condition("equal", expr.input("specialActive"), expr.value(1), expr.value(input.rule === "varka-classic" ? 1 : 14), expr.input("actionType"));
    builder.add(`${prefix}.firstTarget`, "首个冷却处理目标", firstTarget, branchInputs, {
      unit: "enum", explanationKey: input.rule === "varka-classic" && input.specialActive
        ? "经典来源瓦尔卡先处理自己的四风计时器（skill 编号 1），随后仍调用普通 skill 队列。"
        : `${context}：${input.rule} 原生覆写的首个目标；special_skill 编号 14 仅属于星辉来源。`,
    });
    const count = input.rule === "cyno" ? expr.condition("equal", expr.input("actionType"), expr.value(1), expr.value(2), expr.value(1))
      : input.rule === "odette" ? expr.value(1)
        : expr.condition("equal", expr.input("specialActive"), expr.value(1), expr.value(2), expr.value(1));
    builder.add(`${prefix}.targetCount`, "本次转发目标数", count, branchInputs, {
      unit: "count", explanationKey: `${context}：原生顺序为 ${targets.join(" → ")}。赛诺 skill 另转发 low_plunge；星辉瓦尔卡先特殊再普通；奥黛特特殊分支直接返回。转发次数不是有效冷却减少次数。`,
    });
    const value = builder.add(`${prefix}.routed`, "转发给冷却处理器的帧数", expr.input("reduction"), [
      observed("reduction", input.reduction, "本次原调用传入的缩短帧数，各目标使用同一数值"),
    ], { unit: "frame", childIds: [`${prefix}.firstTarget`, `${prefix}.targetCount`],
      explanationKey: "原生角色覆写只选择处理目标，不改变请求的缩短帧数；各目标的队列空、充能满及重置分支仍由来源执行。" });
    return { value, trace: builder.nodes, explanationGaps: ["此记录证明发生了该次分发；具体队列的有效变化以实际剩余、缩短或来源日志为准。"] };
  }

  if (input.operation === "special-reduce") {
    if (sourceCommit !== "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541" || input.actionType !== 1)
      throw new Error("四风独立计时器只属于经典来源 skill 分支。");
    const difference = builder.add(`${prefix}.beforeClamp`, "四风到期帧减返还帧数",
      expr.sub(expr.input("expiry"), expr.input("reduction")), [
        observed("expiry", input.expiry, "原 fourWindsCDDoneF 的绝对到期帧"),
        observed("reduction", input.reduction, "原调用实际传入的返还帧数"),
      ], { unit: "frame", explanationKey: "保留原到期帧减去本次返还的整数运算顺序。" });
    const value = builder.add(`${prefix}.specialReduced`, "四风新的到期帧",
      expr.max(expr.input("beforeClamp"), expr.input("currentFrame")), [
        traceInput("beforeClamp", difference, "frame", { kind: "shared-core-execution", reference: `${prefix}.beforeClamp` }, "上一步到期帧减返还"),
        observed("currentFrame", input.currentFrame, "实际调用时当前帧"),
      ], { unit: "frame", childIds: [`${prefix}.beforeClamp`], explanationKey: "原生 max 保证到期帧不早于当前帧；仍由原队列重排任务，日志中原有 expiry 写法保持。" });
    return { value, trace: builder.nodes, explanationGaps: ["原生四风可用次数、计时器状态与任务代次由固定来源维护；编辑只重算到期帧。"] };
  }

  if (input.operation === "duration") {
    const product = builder.add(`${prefix}.product`, "冷却修正后未截断帧数",
      expr.mul(expr.input("originalDuration"), expr.input("cooldownFactor")), [
        observed("originalDuration", input.originalDuration, "原 SetCD/DiscardActionCooldown 传入的持续帧数"),
        traceInput("cooldownFactor", input.cooldownFactor, "ratio", "source-host-native-cooldown", "原 CDReduction 循环累加所有有效 CooldownMod Amount 后的倍率"),
      ], { unit: "frame", explanationKey: `${context}：先保留来源实际读取的冷却倍率，再乘原始持续帧数；修饰器触发、到期、日志和列表清理仍由 Go 执行。` });
    // The common trace AST owns Go's toward-zero integer conversion.
    const value = builder.add(`${prefix}.duration`, "写入队列的冷却帧数",
      expr.trunc(expr.input("product")), [observed("product", product, "原始帧数与冷却倍率的未截断乘积")],
      { unit: "frame", childIds: [`${prefix}.product`], explanationKey: `${context}：原生 Go 将乘积转成 int，向零截断；这个整数才写入冷却队列。` });
    return { value, trace: builder.nodes, explanationGaps: ["冷却修饰器 Amount 的条件与来源、充能队列和 worker 调度仍由固定 Go 宿主执行。"] };
  }

  if (input.operation === "remaining") {
    const value = builder.add(`${prefix}.remaining`, "当前冷却剩余帧数",
      expr.sub(expr.add(expr.input("workerStartedAt"), expr.input("headDuration")), expr.input("currentFrame")), [
        observed("workerStartedAt", input.workerStartedAt, "当前冷却队列 worker 的真实起始帧"),
        observed("headDuration", input.headDuration, "当前动作冷却队列首项的真实持续帧数"),
        observed("currentFrame", input.currentFrame, "本次读取时的原生帧"),
      ], { unit: "frame", explanationKey: `${context}：保持来源的 worker 起点 + 队首帧数 - 当前帧顺序；是否提前返回由 Go 的原生版本门控制。` });
    return { value, trace: builder.nodes, explanationGaps: ["可用充能检查和队列空检查仍由固定 Go 宿主执行；b4 与 a7 保留各自的提前返回规则。"] };
  }

  const value = builder.add(`${prefix}.reduced`, "缩短后的队首冷却帧数",
    expr.sub(expr.input("remaining"), expr.input("reduction")), [
      observed("remaining", input.remaining, "原生队首冷却实际剩余帧数"),
      observed("reduction", input.reduction, "本次调用传入的冷却缩短帧数；不按数值猜测来源装备"),
    ], { unit: "frame", explanationKey: `${context}：只有原生比较 reduction < remaining 后才计算并写回队首；其余情况由 Go 重置充能。` });
  return { value, trace: builder.nodes, explanationGaps: ["本次缩短的触发来源、重置分支及队列 worker 重新排程仍由固定 Go 宿主决定。"] };
}
