/** Varka and Skirk source-owned AttackInfo.Mult arithmetic. */
import { expr } from "./calculation-trace";
import type { SourceHostCharacterMultiplierDescriptor } from "./source-host-character-multiplier-formula";

const both = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const n = expr.value;
const v = expr.input;
const flag = (label: string) => ({ label, unit: "flag", integer: true, choices: [{ value: 0, label: "否" }, { value: 1, label: "是" }] } as const);
const baseTalent = { label: "原位置读取的天赋倍率表项", unit: "ratio" } as const;
const a1Factor = { label: "A1 初始化时按队伍条件保存的倍率", unit: "ratio" } as const;
const c1Factor = { label: "C1 原调用消耗额外次数后返回的倍率", unit: "ratio" } as const;
const ascension = { label: "原 A1 helper 的突破等级门", unit: "level", integer: true, minimum: 0, maximum: 0 } as const;
const a4Stacks = { label: "本次 A4 helper 遍历队伍状态得到的层数", unit: "stack", integer: true, minimum: 0, maximum: 3 } as const;

const varkaA1 = expr.condition("equal", v("twoAnemo"), n(1),
  expr.condition("equal", v("twoPhec"), n(1), n(2.2), n(1.4)),
  expr.condition("equal", v("twoPhec"), n(1), n(1.4), n(1)));
const varkaC1 = expr.condition("lt", v("cons"), n(1), n(1),
  expr.condition("lt", n(0), v("extraBefore"), n(2), n(1)));
const skirkAttackA4 = expr.condition("equal", v("a4Stacks"), n(0), n(1),
  expr.condition("equal", v("a4Stacks"), n(1), n(1.1),
    expr.condition("equal", v("a4Stacks"), n(2), n(1.2), n(1.7))));
const skirkBurstA4 = expr.condition("equal", v("a4Stacks"), n(0), n(1),
  expr.condition("equal", v("a4Stacks"), n(1), n(1.05),
    expr.condition("equal", v("a4Stacks"), n(2), n(1.15), n(1.6))));
const subtletyBonus = expr.max(expr.min(expr.sub(v("serpentsSubtlety"), n(50)),
  expr.add(n(12), expr.condition("lt", v("cons"), n(2), n(0), n(10)))), n(0));

function varkaHit(title: string, sourceFile: string, withC1: boolean, withA1: boolean): SourceHostCharacterMultiplierDescriptor {
  const inputs = {
    baseTalent,
    ...(withA1 ? { a1Factor } : { ascension }),
    ...(withC1 ? { c1Factor } : {}),
  };
  const a1 = withA1 ? v("a1Factor") : expr.condition("lt", v("ascension"), n(1), n(1), n(1));
  const valueSources: Record<string, string> = {};
  if (withA1) valueSources.a1Factor = "char-mult-varka-a1-cache";
  if (withC1) valueSources.c1Factor = "char-mult-varka-c1-factor";
  return {
    character: "varka", title, sourceFile: `internal/characters/varka/${sourceFile}`, sourceCommits: both,
    operation: "set", inputs,
    expression: withC1 ? expr.mul(v("baseTalent"), a1, v("c1Factor")) : expr.mul(v("baseTalent"), a1),
    valueSources,
    explanation: withA1
      ? "原天赋表项先乘初始化时真实保存的 A1 队伍倍率；C1 原辅助函数仍仅调用一次并保留其创建回执。"
      : "原 A1 helper 在未突破时返回 1；不伪造未执行的队伍缓存生产者。",
  };
}

function skirkBurst(title: string, baseFile: string): SourceHostCharacterMultiplierDescriptor {
  return {
    character: "skirk", title, sourceFile: `internal/characters/skirk/${baseFile}`, sourceCommits: both,
    operation: "set", inputs: {
      baseTalent, bonusTalent: { label: "同次第二次爆发天赋表读取的加成表项", unit: "ratio" },
      serpentsSubtlety: { label: "爆发起手原蛇之狡谋值", unit: "point", minimum: 0 },
      cons: { label: "原 C2 helper 读取的星座等级", unit: "level", integer: true, minimum: 0, maximum: 6 },
      a4Stacks,
    },
    expression: expr.mul(expr.add(v("baseTalent"), expr.mul(subtletyBonus, v("bonusTalent"))), skirkBurstA4),
    explanation: "从起手蛇之狡谋、C2 上限和本次 A4 队友状态数重建原乘区；A4 原 helper 每次仅遍历一次队伍状态。",
  };
}

export const characterMultiplierGroupB = {
  "char-mult-varka-a1-cache": {
    character: "varka", title: "法尔伽 A1 队伍条件缓存倍率", sourceFile: "internal/characters/varka/asc.go",
    sourceCommits: both, operation: "set",
    inputs: { twoAnemo: flag("原初始化队伍至少两名风元素角色"), twoPhec: flag("原初始化队伍至少两名同元素火水雷冰角色") },
    expression: varkaA1,
    explanation: "仅突破门通过后的原初始化分支生成，按两项队伍条件保存 1、1.4 或 2.2；后续实际施放复用此 ID。",
  },
  "char-mult-varka-c1-factor": {
    character: "varka", title: "法尔伽 C1 特殊技能倍率", sourceFile: "internal/characters/varka/cons.go",
    sourceCommits: both, operation: "set",
    inputs: { cons: { label: "原 C1 helper 的星座等级", unit: "level", integer: true, minimum: 0, maximum: 6 },
      extraBefore: { label: "原 helper 消耗前 C1 额外次数", unit: "count", integer: true, minimum: 0 } },
    expression: varkaC1,
    explanation: "在原 C1 helper 调用前保存次数，并只调用一次原 helper 保留其扣减；同次多段攻击复用此创建 ID。",
  },
  "char-mult-varka-four-winds": varkaHit("法尔伽四风进击技能倍率", "skill.go", true, true),
  "char-mult-varka-four-winds-unasc": varkaHit("法尔伽未突破四风进击技能倍率", "skill.go", true, false),
  "char-mult-varka-skill-normal": varkaHit("法尔伽战技状态普通攻击倍率", "attack.go", false, true),
  "char-mult-varka-skill-normal-unasc": varkaHit("法尔伽未突破战技状态普通攻击倍率", "attack.go", false, false),
  "char-mult-varka-skill-charge": varkaHit("法尔伽战技状态重击倍率", "charge.go", false, true),
  "char-mult-varka-skill-charge-unasc": varkaHit("法尔伽未突破战技状态重击倍率", "charge.go", false, false),
  "char-mult-varka-azure-devour": varkaHit("法尔伽苍噬四段重击倍率", "charge.go", true, true),
  "char-mult-varka-azure-devour-unasc": varkaHit("法尔伽未突破苍噬四段重击倍率", "charge.go", true, false),
  "char-mult-skirk-burst-dot": skirkBurst("丝柯克爆发多段倍率", "burst.go"),
  "char-mult-skirk-burst-final": skirkBurst("丝柯克爆发终结倍率", "burst.go"),
  "char-mult-skirk-skill-normal": {
    character: "skirk", title: "丝柯克战技状态普通攻击倍率", sourceFile: "internal/characters/skirk/attack.go",
    sourceCommits: both, operation: "set", inputs: { baseTalent, a4Stacks },
    expression: expr.mul(v("baseTalent"), skirkAttackA4),
    explanation: "原技能普攻天赋表项乘本次 A4 helper 逐队员检查所得层数对应的原数组倍率。",
  },
  "char-mult-skirk-c6-burst": {
    character: "skirk", title: "丝柯克 C6 爆发追加攻击倍率", sourceFile: "internal/characters/skirk/cons.go",
    sourceCommits: both, operation: "set", inputs: { a4Stacks },
    expression: expr.mul(n(7.5), skirkBurstA4),
    explanation: "C6 原触发门和消耗保持；一次 A4 helper 读取的队伍状态数选择爆发倍率。",
  },
  "char-mult-skirk-c6-normal": {
    character: "skirk", title: "丝柯克 C6 普攻追加攻击倍率", sourceFile: "internal/characters/skirk/cons.go",
    sourceCommits: both, operation: "set", inputs: { a4Stacks },
    expression: expr.mul(n(1.8), skirkAttackA4),
    explanation: "C6 原层数和 ICD 门保持；一次 A4 helper 读取的队伍状态数选择普攻倍率。",
  },
} as const satisfies Record<string, SourceHostCharacterMultiplierDescriptor>;
