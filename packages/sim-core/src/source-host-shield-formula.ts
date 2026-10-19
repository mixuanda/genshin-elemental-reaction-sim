/** Pinned source-host shield and player Drain arithmetic, executed by the live Go host. */
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
import { SOURCE_HOST_COMMIT, type SourceHostPlayerDrainRequest, type SourceHostPlayerShieldRequest,
  type SourceHostPlayerShieldMinimumRequest } from "./source-host-wire";

const source = (commit: string, path: string) => `https://github.com/genshinsim/gcsim/blob/${commit}/${path}`;
const refs = (commit: string) => [source(commit, "pkg/core/player/shield/template.go"), source(commit, "pkg/core/player/shield/handler.go"),
  source(commit, "internal/template/character/heal.go"), source(commit, "internal/template/character/hp.go")];
export const SOURCE_HOST_PLAYER_STATE_PROFILE = {
  id: "gcsim-pinned-player-shield-drain-v1",
  evidenceStatus: "fixed-source-assumed",
  sourceRefs: refs(SOURCE_HOST_COMMIT),
  assumptions: [
    "固定 Tmpl.OnDamage 以入射元素为 Geo 时覆盖为 1.5；ShieldStrength 查询函数却以盾元素为 Geo 判断，两者在来源中不同。",
    "每面适用盾接收同一完整伤害及一次读取的护盾强效；来源运行时保留每盾回调、破盾事件和 Drain 事件顺序。",
    "固定来源实现未经当前游戏实测验证；非正吸收容量及非正生命上限不纳入此有限数值共享公式。",
  ],
} as const;

const input = (key: string, value: number, unit = "ratio") => traceInput(key, value, unit, "来源宿主实际玩家状态", `来源受击时的 ${key}`);
const options = { status: "assumed" as const, warnings: [...SOURCE_HOST_PLAYER_STATE_PROFILE.assumptions] };

export function resolveSourceHostPlayerShieldRequest(request: SourceHostPlayerShieldRequest): {
  value: number; trace: CalculationTraceNode[]; explanationGaps: string[];
} {
  const x = request.input;
  const trace = new TraceBuilder(refs(request.sourceCommit ?? SOURCE_HOST_COMMIT));
  const elementFactor = trace.add("shieldElementFactor", "实际受击元素吸收倍率",
    expr.condition("equal", expr.input("incomingIsGeo"), expr.value(1), expr.value(1.5),
      expr.condition("equal", expr.input("sameElement"), expr.value(1), expr.value(2.5), expr.value(1))),
    [input("incomingIsGeo", Number(x.incomingElement === "Geo" || x.incomingElement === "geo"), "boolean"),
      input("sameElement", Number(x.incomingElement === x.shieldElement), "boolean")],
    { ...options, explanationKey: "按 Tmpl.OnDamage 的实参判断：同元素先给 2.5，入射 Geo 再覆盖为 1.5；不套用 ShieldStrength 查询函数。" });
  const bonusMultiplier = trace.add("shieldBonusMultiplier", "护盾强效乘区", expr.add(expr.value(1), expr.input("bonus")),
    [input("bonus", x.bonus)], { ...options, explanationKey: "由来源 Handler.ShieldBonus 本次仅读取一次的合计加上 1。" });
  const block = trace.add("shieldBlock", "此盾吸收容量", expr.mul(expr.input("hpBefore"), expr.input("elementFactor"), expr.input("bonusMultiplier")),
    [input("hpBefore", x.hpBefore, "HP"), input("elementFactor", elementFactor), input("bonusMultiplier", bonusMultiplier)],
    { ...options, unit: "damage", childIds: ["shieldElementFactor", "shieldBonusMultiplier"], explanationKey: "盾当前原始生命乘元素吸收倍率和护盾强效乘区。每面盾使用完整入射伤害。" });
  if (block <= 0) throw new Error("固定来源盾吸收容量非正，无法产生有限共享公式结果。");
  const hpAfter = trace.add("shieldHpAfter", "受击后盾原始生命",
    expr.max(expr.value(0), expr.sub(expr.input("hpBefore"), expr.mul(expr.input("hpBefore"),
      expr.div(expr.input("incomingDamage"), expr.input("block"))))),
    [input("hpBefore", x.hpBefore, "HP"), input("incomingDamage", x.incomingDamage, "damage"), input("block", block, "damage")],
    { ...options, unit: "HP", childIds: ["shieldBlock"], explanationKey: "保留源码 HP -= HP × (damage / block) 的算术顺序，并在小于零时夹到零。" });
  const damageAfter = trace.add("shieldDamageAfter", "此盾后的穿透伤害",
    expr.max(expr.value(0), expr.sub(expr.input("incomingDamage"), expr.input("block"))),
    [input("incomingDamage", x.incomingDamage, "damage"), input("block", block, "damage")],
    { ...options, unit: "damage", childIds: ["shieldBlock"], explanationKey: "此盾的独立分支伤害等于完整入射伤害减其容量并向下夹零；管理器另取各盾分支最小值。" });
  return { value: x.output === "hpAfter" ? hpAfter : damageAfter, trace: trace.nodes,
    explanationGaps: [...SOURCE_HOST_PLAYER_STATE_PROFILE.assumptions] };
}

export function resolveSourceHostPlayerDrainRequest(request: SourceHostPlayerDrainRequest): {
  value: number; trace: CalculationTraceNode[]; explanationGaps: string[];
} {
  const x = request.input;
  if (x.maxHp <= 0) throw new Error("固定来源玩家最大生命非正，无法产生有限共享公式结果。");
  const trace = new TraceBuilder(refs(request.sourceCommit ?? SOURCE_HOST_COMMIT));
  const newHp = trace.add("drainNewHp", "Drain 后未限制生命", expr.add(expr.input("hpBefore"), expr.input("negativeAmount")),
    [input("hpBefore", x.hpBefore, "HP"), input("negativeAmount", -x.amount, "HP")],
    { ...options, unit: "HP", explanationKey: "实际 OnPlayerPreHPDrain 回调完成后，来源 ModifyHPByAmount 读取当前生命，再加上负的 DrainInfo.Amount。" });
  const rawRatio = trace.add("drainRawRatio", "Drain 后未限制生命比例", expr.div(expr.input("newHp"), expr.input("maxHp")),
    [input("newHp", newHp, "HP"), input("maxHp", x.maxHp, "HP")],
    { ...options, childIds: ["drainNewHp"], explanationKey: "来源 SetHPByAmount 将新的生命值除以此时的最大生命值。" });
  const value = trace.add("drainRatio", "实际写回玩家生命比例", expr.clamp(expr.input("rawRatio"), expr.value(0), expr.value(1)),
    [input("rawRatio", rawRatio)], { ...options, childIds: ["drainRawRatio"],
      explanationKey: "来源 clampHPRatio 把比例限制在零与一之间；此返回值写入实际 Go 角色生命状态。" });
  return { value, trace: trace.nodes, explanationGaps: [...SOURCE_HOST_PLAYER_STATE_PROFILE.assumptions] };
}

export function resolveSourceHostPlayerShieldMinimumRequest(request: SourceHostPlayerShieldMinimumRequest): {
  value: number; trace: CalculationTraceNode[]; explanationGaps: string[];
} {
  const trace = new TraceBuilder(refs(request.sourceCommit ?? SOURCE_HOST_COMMIT));
  const value = trace.add("shieldRunningMinimum", "多盾后的当前最小穿透伤害",
    expr.min(expr.input("currentMinimum"), expr.input("damageAfter")),
    [input("currentMinimum", request.input.currentMinimum, "damage"),
      input("damageAfter", request.input.damageAfter, "damage")],
    { ...options, unit: "damage", explanationKey: "每面适用盾独立处理同一完整伤害；来源管理器按处理顺序取所有分支穿透量的最小值。" });
  return { value, trace: trace.nodes, explanationGaps: [...SOURCE_HOST_PLAYER_STATE_PROFILE.assumptions] };
}
