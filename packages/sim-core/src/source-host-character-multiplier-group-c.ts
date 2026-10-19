import { expr, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterMultiplierDescriptor } from "./source-host-character-multiplier-formula";

const classic = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const stellar = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd";
const both = [classic, stellar] as const;
const stellarOnly = [stellar] as const;
const v = expr.input;
const n = expr.value;

const odetteA4 = expr.mul(v("base"), expr.add(n(1), expr.min(
  expr.mul(expr.div(expr.max(expr.sub(v("totalAtk"), n(1000)), n(0)), n(100)), n(0.015)),
  n(0.3),
)));
const odetteBase = { label: "原位置天赋表或命座倍率", unit: "ratio" } as const;
const odetteAtk = { label: "本次 A4 读取的原生总攻击力", unit: "ATK" } as const;

function odette(title: string, file: "skill.go" | "cons.go", enabled: boolean): SourceHostCharacterMultiplierDescriptor {
  return {
    character: "odette", title, sourceFile: `internal/characters/odette/${file}`,
    sourceCommits: stellarOnly, operation: "set",
    inputs: enabled ? { base: odetteBase, totalAtk: odetteAtk } : { base: odetteBase },
    ...(enabled ? { statLeaf: { stateKey: "totalAtk", getter: "total-atk", actor: "holder" } as const } : {}),
    expression: enabled ? odetteA4 : v("base"),
    explanation: enabled
      ? "A4 已解锁：在原写入点只读取一次总攻击力，按超过 1000 的部分每 100 点增加 1.5%，封顶 30%，再乘原位置倍率。"
      : "A4 未解锁：原辅助函数直接返回 1，保留零次攻击力读取。",
  };
}

const shotgunMultipliers = [
  0, 1, 1.05000000074505806, 1.10000000149011612,
  1.15000000596046448, 1.20000000298023224,
  1.36000001430511475, 1.4000000059604645,
  1.6000000238418579, 1.6660000085830688,
  1.8999999761581421, 2,
] as const;
const shotgunMultiplier = shotgunMultipliers.reduceRight<FormulaExpression>(
  (otherwise, factor, hits) => expr.condition("equal", v("hits"), n(hits), n(factor), otherwise), n(0),
);

export const characterMultiplierGroupC = {
  "char-mult-odette-coda-conduct-a4": odette("奥黛特终奏星辉导通倍率（A4）", "skill.go", true),
  "char-mult-odette-coda-conduct-no-a4": odette("奥黛特终奏星辉导通倍率（未解锁 A4）", "skill.go", false),
  "char-mult-odette-coda-swirl-a4": odette("奥黛特终奏星辉扩散倍率（A4）", "skill.go", true),
  "char-mult-odette-coda-swirl-no-a4": odette("奥黛特终奏星辉扩散倍率（未解锁 A4）", "skill.go", false),
  "char-mult-odette-dance-tick-a4": odette("奥黛特双人舞星辉段倍率（A4）", "skill.go", true),
  "char-mult-odette-dance-tick-no-a4": odette("奥黛特双人舞星辉段倍率（未解锁 A4）", "skill.go", false),
  "char-mult-odette-c1-conduct-a4": odette("奥黛特一命星辉导通倍率（A4）", "cons.go", true),
  "char-mult-odette-c1-conduct-no-a4": odette("奥黛特一命星辉导通倍率（未解锁 A4）", "cons.go", false),
  "char-mult-odette-c1-swirl-a4": odette("奥黛特一命星辉扩散倍率（A4）", "cons.go", true),
  "char-mult-odette-c1-swirl-no-a4": odette("奥黛特一命星辉扩散倍率（未解锁 A4）", "cons.go", false),
  "char-mult-navia-shotgun": {
    character: "navia", title: "娜维娅战技弹片命中倍率", sourceFile: "internal/characters/navia/skill.go",
    sourceCommits: both, operation: "set",
    inputs: {
      base: { label: "本次战技天赋表倍率", unit: "ratio" },
      hits: { label: "原生逐目标弹片命中数", unit: "count", minimum: 0, maximum: 11, integer: true },
    },
    expression: expr.mul(v("base"), shotgunMultiplier),
    explanation: "原生逐目标扫描与命中计数不变；共享公式按本次实际弹片数选取来源的十二档倍率，再乘一次战技表值。",
  },
  "char-mult-lauma-dew": {
    character: "lauma", title: "菈乌玛长按战技月露消耗倍率", sourceFile: "internal/characters/lauma/skill.go",
    sourceCommits: both, operation: "set",
    inputs: {
      base: { label: "本次长按战技天赋表倍率", unit: "ratio" },
      dewCount: { label: "原生已消耗的月露数", unit: "count", minimum: 0, maximum: 3, integer: true },
    },
    expression: expr.mul(v("base"), v("dewCount")),
    explanation: "原生先读取并消耗最多三点月露，再在原 Mult 写入点乘本次天赋表值。",
  },
} as const satisfies Record<string, SourceHostCharacterMultiplierDescriptor>;
