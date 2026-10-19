import { expr } from "./calculation-trace";
import type { SourceHostHealingSourceDescriptor } from "./source-host-healing-source-formula";

const commits = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const v = expr.input;
const refinement = { label: "武器原始精炼等级", unit: "scalar", minimum: 1, maximum: 5, integer: true } as const;
const atk = { label: "原攻击快照总攻击力", unit: "ATK" } as const;
const snapshotAtk = { stateKey: "totalAtk", getter: "total-atk" } as const;
const refineRatio = expr.add(expr.value(0.06), expr.mul(v("refinement"), expr.value(0.02)));
const particleRatio = expr.add(expr.value(0.0075), expr.mul(v("refinement"), expr.value(0.0025)));

function rule(character: string, title: string, sourceFile: string,
  resultUnit: SourceHostHealingSourceDescriptor["resultUnit"],
  inputs: SourceHostHealingSourceDescriptor["inputs"], expression: SourceHostHealingSourceDescriptor["expression"],
  explanation: string, extras: Partial<SourceHostHealingSourceDescriptor> = {}): SourceHostHealingSourceDescriptor {
  return { character, title, sourceFile: `internal/weapons/${sourceFile}`, sourceCommits: commits,
    resultUnit, inputs, expression, explanation, ...extras };
}

export const healingSourceGroupF = {
  "heal-source-weapon-recurve": rule("*", "反曲弓击败敌人治疗比例", "bow/recurve/recurve.go", "ratio",
    { refinement }, refineRatio,
    "仅在原目标死亡、击杀归属与前台门控通过后，使用创建武器时保存的精炼等级计算 0.06 + r*0.02。"),
  "heal-source-weapon-otherworldly": rule("*", "异世界行记收集粒子治疗比例", "catalyst/otherworldly/otherworldly.go", "ratio",
    { refinement }, particleRatio,
    "仅在原粒子事件且持有者位于前台时，使用创建武器时保存的精炼等级计算 0.0075 + r*0.0025。"),
  "heal-source-weapon-prototype": rule("*", "试作金珀周期治疗比例", "catalyst/prototype/prototype.go", "ratio",
    { refinement }, expr.div(expr.add(expr.value(3.5), expr.mul(v("refinement"), expr.value(0.5))), expr.value(100)),
    "每个已排队治疗 tick 沿用创建武器时先算出的 e=3.5+r*0.5，再按原式 e/100 写入比例 Src。"),
  "heal-source-weapon-whiteiron": rule("*", "白铁大剑击败敌人治疗比例", "claymore/whiteiron/whiteiron.go", "ratio",
    { refinement }, refineRatio,
    "仅在原目标死亡、击杀归属与前台门控通过后，使用创建武器时保存的精炼等级计算 0.06 + r*0.02。"),
  "heal-source-weapon-aquila": rule("*", "风鹰剑受击治疗", "sword/aquila/aquila.go", "HP",
    { refinement, totalAtk: atk }, expr.mul(v("totalAtk"), expr.add(expr.value(0.85), expr.mul(v("refinement"), expr.value(0.15)))),
    "原外部扣血和冷却门控通过后使用攻击事件处创建的原快照总攻击力，并乘武器创建时保存的治疗倍率。",
    { snapshotLeaf: snapshotAtk }),
  "heal-source-weapon-blacksword": rule("*", "黑剑暴击治疗", "sword/blacksword/blacksword.go", "HP",
    { refinement, totalAtk: atk }, expr.mul(expr.add(expr.value(0.5), expr.mul(v("refinement"), expr.value(0.1))), v("totalAtk")),
    "仅在原普通或重击暴击、前台与冷却门控通过后，使用该攻击事件的原快照总攻击力；保留 heal*ATK 的顺序。",
    { snapshotLeaf: snapshotAtk }),
  "heal-source-weapon-travelershandysword": rule("*", "旅行剑收集粒子治疗比例", "sword/travelershandysword/travelershandysword.go", "ratio",
    { refinement }, particleRatio,
    "仅在原粒子事件且持有者位于前台时，使用创建武器时保存的精炼等级计算 0.0075 + r*0.0025。"),
} as const satisfies Record<string, SourceHostHealingSourceDescriptor>;
