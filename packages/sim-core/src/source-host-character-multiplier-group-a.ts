import { expr, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterMultiplierDescriptor } from "./source-host-character-multiplier-formula";

const both = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const stellar = [both[1]] as const;
const base = { label: "原位置首次天赋表读取值", unit: "ratio" } as const;
const bonus = { label: "原位置第二次天赋表读取值", unit: "ratio" } as const;
const stacks = { label: "原位置保存的层数或计数", unit: "stack" } as const;
const basePlusBonusTimesStacks = expr.add(expr.input("base"), expr.mul(expr.input("bonus"), expr.input("stacks")));
const basePlusStacksTimesBonus = expr.add(expr.input("base"), expr.mul(expr.input("stacks"), expr.input("bonus")));
const bonusTimesStacks = expr.mul(expr.input("bonus"), expr.input("stacks"));

function rule(character: string, title: string, sourceFile: string, operation: "set" | "add",
  inputs: SourceHostCharacterMultiplierDescriptor["inputs"], expression: FormulaExpression,
  explanation: string, sourceCommits: readonly string[] = both): SourceHostCharacterMultiplierDescriptor {
  return { character, title, sourceFile: `internal/characters/${sourceFile}`, sourceCommits,
    operation, inputs, expression, explanation };
}

export const characterMultiplierGroupA = {
  "char-mult-beidou-skill-counter": rule("beidou", "北斗战技受击计数倍率", "beidou/skill.go", "set",
    { base, bonus, stacks }, basePlusBonusTimesStacks,
    "原战技 counter 先限制至二层并执行 A4，随后各读取一次基础及加成天赋表；原受击计数不重新求值。"),
  "char-mult-eula-lightfall-stacks": rule("eula", "优菈光降之剑层数倍率", "eula/burst.go", "set",
    { base, bonus, stacks }, basePlusBonusTimesStacks,
    "原爆炸时点的 burstCounter 已按原生上限处理；两次天赋表读取及爆炸后的清层保留。"),
  "char-mult-heizou-skill-declension": rule("heizou", "鹿野院平藏战技变格层数倍率", "heizou/skill.go", "set",
    { base, bonus, stacks }, basePlusStacksTimesBonus,
    "原式为基础表值加 float64(decStack) 乘第二次读取的变格表值；发生于延迟释放回调。"),
  "char-mult-heizou-skill-conviction": rule("heizou", "鹿野院平藏满层正论追加倍率", "heizou/skill.go", "add",
    { bonus }, expr.input("bonus"),
    "只有原生四层门通过才在上一完整 Mult 上追加正论天赋表值；先前变格回执作为父值。"),
  "char-mult-lyney-skill-surplus": rule("lyney", "林尼战技盈余幻数倍率", "lyney/skill.go", "set",
    { base, bonus, stacks }, basePlusBonusTimesStacks,
    "两个战技表值与释放前 Prop Surplus 层数在攻击构造处读取；之后的治疗和清层仍按来源顺序进行。"),
  "char-mult-raiden-burst-resolve": rule("raiden", "雷电将军爆发初击愿力追加倍率", "raiden/burst.go", "add",
    { bonus, stacks }, bonusTimesStacks,
    "爆发延迟任务先复制并清空当前愿力，然后在原基础 Mult 上追加爆发初击专用表值乘已消费愿力。"),
  "char-mult-raiden-normal-resolve": rule("raiden", "雷电将军爆发普攻愿力追加倍率", "raiden/attack.go", "add",
    { bonus, stacks }, bonusTimesStacks,
    "原爆发普攻先写入普通表值，再按原追加位置读取一次愿力加成表并使用先前保存的 stacksConsumed。"),
  "char-mult-raiden-charge-resolve": rule("raiden", "雷电将军爆发重击愿力倍率", "raiden/charge.go", "set",
    { base, bonus, stacks }, basePlusBonusTimesStacks,
    "原爆发状态重击创建时两次读取爆发天赋表，使用已消费愿力，不重读当前愿力池。"),
  "char-mult-raiden-low-plunge-resolve": rule("raiden", "雷电将军爆发低空坠击愿力倍率", "raiden/plunge.go", "set",
    { base, bonus, stacks }, basePlusBonusTimesStacks,
    "原低空坠击爆发分支在攻击构造处组合表值与已消费愿力。"),
  "char-mult-raiden-high-plunge-resolve": rule("raiden", "雷电将军爆发高空坠击愿力倍率", "raiden/plunge.go", "set",
    { base, bonus, stacks }, basePlusBonusTimesStacks,
    "原高空坠击爆发分支在攻击构造处组合表值与已消费愿力。"),
  "char-mult-raiden-collision-resolve": rule("raiden", "雷电将军爆发坠击碰撞愿力倍率", "raiden/plunge.go", "set",
    { base, bonus, stacks }, basePlusBonusTimesStacks,
    "原坠击碰撞爆发分支独立构造 AttackInfo，仍使用保存的已消费愿力。"),
  "char-mult-cryo-traveler-burst": rule("travelercryo", "冰旅行者霜辉之枪基础倍率", "traveler/common/cryo/burst.go", "set",
    { base, bonus, stacks }, basePlusBonusTimesStacks,
    "每次原爆发 attack 回调先计算基础冰伤倍率；之后辉光分支可在同一 AttackInfo 上覆盖该值。", stellar),
  "char-mult-cryo-traveler-stellar-conduct": rule("travelercryo", "冰旅行者星辉超导爆发倍率", "traveler/common/cryo/burst.go", "set",
    { base, bonus, stacks }, basePlusBonusTimesStacks,
    "只有原生星辉超导辉光门通过才覆盖基础倍率；新回执替换前一个组件。", stellar),
  "char-mult-cryo-traveler-stellar-swirl": rule("travelercryo", "冰旅行者星辉扩散爆发倍率", "traveler/common/cryo/burst.go", "set",
    { base, bonus, stacks }, basePlusBonusTimesStacks,
    "只有原生星辉扩散辉光门通过才覆盖基础倍率；新回执替换前一个组件。", stellar),
} as const satisfies Record<string, SourceHostCharacterMultiplierDescriptor>;
