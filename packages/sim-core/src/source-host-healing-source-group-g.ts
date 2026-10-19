/** Stellar-only HealInfo.Src producers left after the shared character groups. */
import { expr } from "./calculation-trace";
import type { SourceHostHealingSourceDescriptor } from "./source-host-healing-source-formula";

const stellar = ["a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const n = expr.value;
const v = expr.input;
const totalAtk = { label: "原位置一次总攻击力读取", unit: "ATK" } as const;
const em = { label: "原位置一次元素精通读取", unit: "EM" } as const;
const flat = { label: "原天赋等级固定治疗表项", unit: "HP" } as const;
const ratio = { label: "原天赋等级属性倍率表项", unit: "ratio" } as const;
const a1HealMult = { label: "原 A1 保存的治疗倍率", unit: "ratio",
  choices: [{ value: 1, label: "原初始化倍率" }, { value: 1.2, label: "原水元素 A1 倍率" }] } as const;
const atkLeaf = { stateKey: "totalAtk", getter: "total-atk", actor: "holder" } as const;
const emLeaf = { stateKey: "em", getter: "stat", statIndex: 8, actor: "holder" } as const;

export const healingSourceGroupG = {
  "heal-source-iansan-a4": {
    character: "iansan", title: "伊安珊 A4 热身治疗", sourceFile: "internal/characters/iansan/asc.go",
    sourceCommits: stellar, resultUnit: "HP", inputs: { totalAtk }, statLeaf: atkLeaf,
    expression: expr.mul(v("totalAtk"), n(.6)),
    explanation: "原夜魂迸发状态与治疗冷却通过后，读取一次总攻击力并乘 0.6；治疗加成另沿原 Heal 读取。",
  },
  "heal-source-ifa-skill": {
    character: "ifa", title: "伊法战技治疗", sourceFile: "internal/characters/ifa/skill.go",
    sourceCommits: stellar, resultUnit: "HP", inputs: { em, ratio, flat }, statLeaf: emLeaf,
    expression: expr.add(expr.mul(v("ratio"), v("em")), v("flat")),
    explanation: "原位置读取精通一次，按两次原天赋等级读表分别取得倍率及固定治疗值；技能命中冷却门槛与 Heal 属性读取不变。",
  },
  "heal-source-jahoda-burst-additional": {
    character: "jahoda", title: "雅霍达爆发低血队友额外治疗", sourceFile: "internal/characters/jahoda/burst.go",
    sourceCommits: stellar, resultUnit: "HP", inputs: { flat, ratio, totalAtk, a1HealMult }, statLeaf: atkLeaf,
    expression: expr.mul(expr.add(v("flat"), expr.mul(v("ratio"), v("totalAtk"))), v("a1HealMult")),
    explanation: "仅原前台生命比例高于 70% 且有低血队友时，按固定表项、倍率表项、一次总攻击力顺序计算，再乘 A1 保存的水元素队伍倍率（初始化 1.0；水分支 1.2）。",
  },
  "heal-source-jahoda-burst-robot": {
    character: "jahoda", title: "雅霍达爆发机器治疗", sourceFile: "internal/characters/jahoda/burst.go",
    sourceCommits: stellar, resultUnit: "HP", inputs: { flat, ratio, totalAtk, a1HealMult }, statLeaf: atkLeaf,
    expression: expr.mul(expr.add(v("flat"), expr.mul(v("ratio"), v("totalAtk"))), v("a1HealMult")),
    explanation: "每个原生机器治疗 tick 各自读取两次天赋表和一次总攻击力，再乘 A1 保存的水元素队伍倍率（初始化 1.0；水分支 1.2）。",
  },
} as const satisfies Record<string, SourceHostHealingSourceDescriptor>;
