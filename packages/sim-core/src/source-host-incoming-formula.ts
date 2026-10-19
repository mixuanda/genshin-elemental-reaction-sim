/** Arithmetic of the pinned gcsim Player.calc path; Go keeps live player state. */
import { expr, TraceBuilder, traceInput, type CalculationTraceNode } from "./calculation-trace";
import { SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT } from "./source-host-wire";

export interface SourceHostPlayerIncomingInput {
  scalingStat: "atk" | "hp" | "def" | "em";
  scalingValue: number;
  scaling: number;
  flatDamage: number;
  damageBonus: number;
  playerDefense: number;
  defenseIgnore: number;
  playerResistance: number;
  attackerLevel: number;
  critRate: number;
  critDamage: number;
  isCrit: boolean;
  critRoll: number | null;
  hitWeakPoint: boolean;
  elementalMastery: number;
  amped: boolean;
  amplifyingMultiplier: number;
  reactionBonus: number;
  groupMultiplier: number;
}

export interface SourceHostPlayerIncomingRequest {
  input: SourceHostPlayerIncomingInput;
  sourceCommit?: typeof SOURCE_HOST_COMMIT | typeof SOURCE_HOST_STELLAR_COMMIT | undefined;
}

const input = (key: string, value: number, unit = "ratio") =>
  traceInput(key, value, unit, "来源宿主实际计算上下文", `固定来源玩家受击计算的 ${key}`);

/** Returns the exact pre-shield damage consumed by the native shield handler. */
export function resolveSourceHostPlayerIncomingRequest(request: SourceHostPlayerIncomingRequest): {
  value: number;
  trace: CalculationTraceNode[];
  explanationGaps: string[];
} {
  const x = request.input;
  const stellar = request.sourceCommit === SOURCE_HOST_STELLAR_COMMIT;
  const trace = new TraceBuilder([`https://github.com/genshinsim/gcsim/blob/${request.sourceCommit ?? SOURCE_HOST_COMMIT}/pkg/avatar/avatar.go`]);
  const gaps = [
    "固定来源宿主的玩家抗性仍硬编码为 0；这反映来源实现，不证明当前游戏的全部玩家抗性机制。",
    "玩家防御和来源快照以实际取样值进入共享公式；上游角色、装备及闭包变化尚未全部展开。",
    "此公式只负责传给护盾的伤害；若捕获保存了共享护盾与生命步骤，它们在独立状态计算中逐项展示。",
  ];
  if (x.hitWeakPoint) {
    if (!x.isCrit || x.critRoll !== null) throw new Error("来源玩家受击弱点必暴记录与随机抽样不一致。");
  } else if (x.critRoll === null || (x.critRoll <= x.critRate) !== x.isCrit) {
    throw new Error("来源玩家受击暴击结果与实际抽样不一致。");
  }
  if (x.critRate < 0 || x.critRate > 1) throw new Error("来源玩家受击暴击率未按原路径钳制。");
  const ignored = Math.min(x.defenseIgnore, 1);
  if (ignored !== x.defenseIgnore) throw new Error("来源玩家受击忽防未按原路径钳制。");

  const base = trace.add("incomingBase", "玩家受击基础伤害", expr.add(expr.mul(expr.input("scaling"), expr.input("scalingValue")), expr.input("flatDamage")), [
    input("scaling", x.scaling), input("scalingValue", x.scalingValue, "stat"), input("flatDamage", x.flatDamage, "damage"),
  ], { unit: "damage", explanationKey: "固定来源先算攻击倍率乘以所选属性，再加固定伤害；不会使用攻击字段的 BaseDmgBonus。" });
  const afterBonus = trace.add("incomingAfterBonus", "玩家受击增伤后", expr.mul(expr.input("base"), expr.add(expr.value(1), expr.input("damageBonus"))), [
    input("base", base, "damage"), input("damageBonus", x.damageBonus),
  ], { unit: "damage", childIds: ["incomingBase"], explanationKey: "固定来源无条件读取元素增伤与通用增伤并相加。" });
  const effectiveDefense = trace.add("incomingEffectiveDefense", "玩家有效防御", expr.mul(expr.input("playerDefense"), expr.sub(expr.value(1), expr.input("defenseIgnore"))), [
    input("playerDefense", x.playerDefense, "stat"), input("defenseIgnore", x.defenseIgnore),
  ], { unit: "stat", explanationKey: "玩家的 TotalDef(false) 只读取一次；来源仅对忽防设置上限 1。" });
  const defenseMultiplier = trace.add("incomingDefenseMultiplier", "玩家受击防御倍率", expr.sub(expr.value(1), expr.div(expr.input("effectiveDefense"), expr.add(expr.input("effectiveDefense"), expr.mul(expr.value(5), expr.input("attackerLevel")), expr.value(500)))), [
    input("effectiveDefense", effectiveDefense, "stat"), input("attackerLevel", x.attackerLevel, "level"),
  ], { childIds: ["incomingEffectiveDefense"], explanationKey: "固定来源使用 1 − 有效防御/(有效防御 + 5×攻击方等级 + 500)。" });
  const afterDefense = trace.add("incomingAfterDefense", "玩家受击防御后", expr.mul(expr.input("damage"), expr.input("defenseMultiplier")), [
    input("damage", afterBonus, "damage"), input("defenseMultiplier", defenseMultiplier),
  ], { unit: "damage", childIds: ["incomingAfterBonus", "incomingDefenseMultiplier"] });
  // b4 uses a strict high-RES test; a7 changed equality to the high-RES branch.
  const resistanceMultiplier = trace.add("incomingResistanceMultiplier", "玩家受击抗性倍率", expr.condition("lt", expr.input("resistance"), expr.value(0),
    expr.sub(expr.value(1), expr.div(expr.input("resistance"), expr.value(2))),
    expr.condition("lt", expr.input("resistance"), expr.value(0.75),
      expr.sub(expr.value(1), expr.input("resistance")),
      expr.condition(stellar ? "lte" : "lt", expr.value(0.75), expr.input("resistance"),
        expr.div(expr.value(1), expr.add(expr.mul(expr.value(4), expr.input("resistance")), expr.value(1))),
        expr.sub(expr.value(1), expr.div(expr.input("resistance"), expr.value(2)))))), [
    input("resistance", x.playerResistance),
  ], { explanationKey: stellar ? "重放 a7 来源抗性分支；抗性恰为 0.75 时走高抗性公式。" : "重放 b4 来源抗性分支；抗性恰为 0.75 时走默认分支。" });
  const afterResistance = trace.add("incomingAfterResistance", "玩家受击抗性后", expr.mul(expr.input("damage"), expr.input("resistanceMultiplier")), [
    input("damage", afterDefense, "damage"), input("resistanceMultiplier", resistanceMultiplier),
  ], { unit: "damage", childIds: ["incomingAfterDefense", "incomingResistanceMultiplier"] });
  const crit = trace.add("incomingCritOutcome", "玩家受击暴击判定", x.hitWeakPoint ? expr.value(1) : expr.condition("lte", expr.input("critRoll"), expr.input("critRate"), expr.value(1), expr.value(0)),
    x.hitWeakPoint ? [] : [input("critRoll", x.critRoll!, "probability"), input("critRate", x.critRate)],
    { unit: "boolean", explanationKey: "沿用来源 Go 已消耗的随机数；弱点必暴不抽随机数。" });
  if (Boolean(crit) !== x.isCrit) throw new Error("来源玩家受击暴击判定无法重放。");
  const afterCrit = trace.add("incomingAfterCrit", "玩家受击暴击后", expr.mul(expr.input("damage"), expr.input("critMultiplier")), [
    input("damage", afterResistance, "damage"), input("critMultiplier", x.isCrit ? 1 + x.critDamage : 1),
  ], { unit: "damage", childIds: ["incomingAfterResistance", "incomingCritOutcome"] });
  const emBonus = trace.add("incomingAmplifyingEmBonus", "玩家受击增幅精通加成", x.amped
    ? expr.div(expr.mul(expr.value(2.78), expr.input("elementalMastery")), expr.add(expr.value(1400), expr.input("elementalMastery")))
    : expr.value(0), x.amped ? [input("elementalMastery", x.elementalMastery, "stat")] : [],
    { status: x.amped ? "applied" : "not-applicable", explanationKey: "来源在检查是否增幅之前计算精通加成；无增幅时此值不影响伤害。" });
  const ampMultiplier = trace.add("incomingAmplifyingMultiplier", "玩家受击增幅倍率", x.amped ? expr.mul(expr.input("baseMultiplier"), expr.add(expr.value(1), expr.input("emBonus"), expr.input("reactionBonus"))) : expr.value(1),
    x.amped ? [input("baseMultiplier", x.amplifyingMultiplier), input("emBonus", emBonus), input("reactionBonus", x.reactionBonus)] : [],
    { status: x.amped ? "applied" : "not-applicable", childIds: ["incomingAmplifyingEmBonus"], explanationKey: "来源仅在 Amped 时读取 ReactBonus，并将基础增幅、精通和反应加成相乘。" });
  const afterAmp = trace.add("incomingAfterAmp", "玩家受击增幅后", expr.mul(expr.input("damage"), expr.input("ampMultiplier")), [
    input("damage", afterCrit, "damage"), input("ampMultiplier", ampMultiplier),
  ], { unit: "damage", childIds: ["incomingAfterCrit", "incomingAmplifyingMultiplier"] });
  const value = trace.add("incomingRawDamage", "进入护盾的玩家受击伤害", expr.mul(expr.input("damage"), expr.input("groupMultiplier")), [
    input("damage", afterAmp, "damage"), input("groupMultiplier", x.groupMultiplier),
  ], { unit: "damage", childIds: ["incomingAfterAmp"], explanationKey: "来源在暴击与增幅后读取伤害组倍率；此结果原样交给 Go 护盾处理。" });
  return { value, trace: trace.nodes, explanationGaps: gaps };
}
