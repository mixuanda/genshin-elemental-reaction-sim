/** Dehya's Redmane pool and manual player-hit arithmetic at their native writes. */
import { expr } from "./calculation-trace";
import type { SourceHostDrainSourceDescriptor } from "./source-host-drain-source-formula";

const sourceCommits = [
  "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541",
  "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd",
] as const;
const common = {
  character: "dehya",
  sourceFile: "internal/characters/dehya/skill.go",
  sourceCommits,
  resultUnit: "HP",
} as const;
const hp = (label: string) => ({ label, unit: "HP" } as const);

export const drainSpecialRules = {
  "drain-source-dehya-mitigation": {
    ...common, title: "迪希雅领域转移的本次伤害",
    resultUnit: "damage",
    outputSlot: "intermediate",
    inputs: {
      beforeAmount: hp("原 OnPlayerPreHPDrain 入参 Amount"),
      talentRatio: { label: "原 skillMitigation[本次技能天赋等级] 查表倍率", unit: "ratio" },
    },
    valueSources: { beforeAmount: "prior-drain-amount" },
    expression: expr.mul(expr.input("beforeAmount"), expr.input("talentRatio")),
    explanation: "通过原 External、场地、位置与生命上限门后，在原位置以扣血前 Amount 乘实际技能倍率；池与最终 Drain Amount 分别在后续步骤写入。",
  },
  "drain-source-dehya-pool-add": {
    ...common, title: "迪希雅赤鬃之血积累",
    outputSlot: "redmane-pool",
    inputs: {
      poolBefore: hp("原字段 skillRedmanesBlood 的写入前值"),
      mitigation: { label: "本次共享计算的转移伤害", unit: "damage" },
    },
    valueSources: {
      poolBefore: ["drain-source-dehya-pool-add", "drain-source-dehya-pool-consume"],
      mitigation: "drain-source-dehya-mitigation",
    },
    initialZeroKeys: ["poolBefore"],
    expression: expr.add(expr.input("poolBefore"), expr.input("mitigation")),
    explanation: "按原加法顺序更新赤鬃之血；没有先前来源 ID 且值为零时，池来自角色结构体的原生零值初始化。",
  },
  "drain-source-dehya-after-mitigation": {
    ...common, title: "迪希雅领域减伤后的真实扣血量",
    outputSlot: "drain-amount",
    inputs: {
      beforeAmount: hp("原 OnPlayerPreHPDrain 入参 Amount"),
      mitigation: { label: "本次共享计算的转移伤害", unit: "damage" },
    },
    valueSources: {
      beforeAmount: "prior-drain-amount",
      mitigation: "drain-source-dehya-mitigation",
    },
    expression: expr.max(expr.sub(expr.input("beforeAmount"), expr.input("mitigation")), expr.value(0)),
    explanation: "池已先增加；随后按原 max(Amount − mitigation, 0) 重写同一个 DrainInfo.Amount，来源 ID 随它进入后续真实 HP 扣减。",
  },
  "drain-source-dehya-tick-raw": {
    ...common, title: "迪希雅赤鬃之血本次原始自伤",
    resultUnit: "damage",
    outputSlot: "manual-raw-damage",
    inputs: { poolBefore: hp("本次 tick 开始时的赤鬃之血") },
    valueSources: { poolBefore: ["drain-source-dehya-pool-add", "drain-source-dehya-pool-consume"] },
    expression: expr.mul(expr.input("poolBefore"), expr.value(0.1)),
    explanation: "原技能在排队下一 tick 和爆发无敌门之后，以池当前值的 10% 生成本次自伤；此值先用于扣池，A1 折减在扣池之后。",
  },
  "drain-source-dehya-pool-consume": {
    ...common, title: "迪希雅赤鬃之血本次扣减",
    outputSlot: "redmane-pool",
    inputs: {
      poolBefore: hp("本次 tick 开始时的赤鬃之血"),
      rawDamage: { label: "本次共享计算的未减免自伤", unit: "damage" },
    },
    valueSources: {
      poolBefore: ["drain-source-dehya-pool-add", "drain-source-dehya-pool-consume"],
      rawDamage: "drain-source-dehya-tick-raw",
    },
    expression: expr.max(expr.sub(expr.input("poolBefore"), expr.input("rawDamage")), expr.value(0)),
    explanation: "在检查 A1 折减和护盾之前，按原 max(pool − rawDamage, 0) 扣减赤鬃之血；后续池读取使用此写入来源。",
  },
  "drain-source-dehya-tick-a1": {
    ...common, title: "迪希雅 A1 折减后的实际自伤",
    resultUnit: "damage",
    outputSlot: "manual-raw-damage",
    inputs: { rawDamage: { label: "本次已从池扣除的未减免自伤", unit: "damage" } },
    valueSources: { rawDamage: "drain-source-dehya-tick-raw" },
    expression: expr.mul(expr.input("rawDamage"), expr.sub(expr.value(1), expr.value(0.6))),
    explanation: "仅在原 A1 状态检查为真时计算；池早已按未减免值扣除，之后才把 40% 自伤写入手工玩家受击 AttackInfo.FlatDmg。",
  },
} as const satisfies Record<string, SourceHostDrainSourceDescriptor>;
