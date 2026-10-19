import { expr, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterFlatDescriptor } from "./source-host-character-flat-formula";
import type { SourceHostCharacterModifierDynamicParameter, SourceHostCharacterModifierDynamicStatLeaf } from "./source-host-character-modifier-dynamic-formula";
const n = expr.value;
const v = expr.input;
function table(index: FormulaExpression, values: readonly number[]): FormulaExpression {
  return values.reduceRight<FormulaExpression>((otherwise, value, i) => expr.condition("equal", index, n(i), n(value), otherwise), n(0));
}
function table2(row: FormulaExpression, index: FormulaExpression, values: readonly (readonly number[])[]): FormulaExpression {
  return values.reduceRight<FormulaExpression>((otherwise, value, i) => expr.condition("equal", row, n(i), table(index, value), otherwise), n(0));
}
const alhaithamBurstEm = [0.9728,1.04576,1.11872,1.216,1.28896,1.36192,1.4592,1.55648,1.65376,1.75104,1.84832,1.9456,2.0672,2.1888,2.3104] as const;
const alhaithamRushEm = [1.5488,1.66496,1.78112,1.936,2.05216,2.16832,2.3232,2.47808,2.63296,2.78784,2.94272,3.0976,3.2912,3.4848,3.6784] as const;
const alhaithamMirrorEm = [1.344,1.4448,1.5456,1.68,1.7808,1.8816,2.016,2.1504,2.2848,2.4192,2.5536,2.688,2.856,3.024,3.192] as const;
const candaceSkillDmg = [[0.12,0.129,0.138,0.15,0.159,0.168,0.18,0.192,0.204,0.216,0.228,0.24,0.255,0.27,0.285],[0.1904,0.20468,0.21896,0.238,0.25228,0.26656,0.2856,0.30464,0.32368,0.34272,0.36176,0.3808,0.4046,0.4284,0.4522]] as const;
const candaceBurstDmg = [0.066104,0.071062,0.07602,0.08263,0.087588,0.092546,0.099156,0.105766,0.112377,0.118987,0.125598,0.132208,0.140471,0.148734,0.156997] as const;
const candaceBurstWaveDmg = [0.066104,0.071062,0.07602,0.08263,0.087588,0.092546,0.099156,0.105766,0.112377,0.118987,0.125598,0.132208,0.140471,0.148734,0.156997] as const;
const dehyaBurstPunchHP = [0.01692,0.018189,0.019458,0.02115,0.022419,0.023688,0.02538,0.027072,0.028764,0.030456,0.032148,0.03384,0.035955,0.03807,0.040185] as const;
const dehyaBurstKickHP = [0.02388,0.025671,0.027462,0.02985,0.031641,0.033432,0.03582,0.038208,0.040596,0.042984,0.045372,0.04776,0.050745,0.05373,0.056715] as const;
const dehyaSkillDotHP = [0.01032,0.011094,0.011868,0.0129,0.013674,0.014448,0.01548,0.016512,0.017544,0.018576,0.019608,0.02064,0.02193,0.02322,0.02451] as const;
const kukiBurst = [0.036048,0.038752,0.041455,0.04506,0.047764,0.050467,0.054072,0.057677,0.061282,0.064886,0.068491,0.072096,0.076602,0.081108,0.085614] as const;
const nilouBurst = [0.18432,0.198144,0.211968,0.2304,0.244224,0.258048,0.27648,0.294912,0.313344,0.331776,0.350208,0.36864,0.39168,0.41472,0.43776] as const;
const nilouBurstAeon = [0.22528,0.242176,0.259072,0.2816,0.298496,0.315392,0.33792,0.360448,0.382976,0.405504,0.428032,0.45056,0.47872,0.50688,0.53504] as const;
const nilouSkill = [0.033389,0.035893,0.038397,0.041736,0.04424,0.046744,0.050083,0.053422,0.056761,0.0601,0.063439,0.066778,0.070951,0.075125,0.079298] as const;
const nilouSwordDance = [[0.045525,0.048939,0.052354,0.056906,0.06032,0.063735,0.068287,0.07284,0.077392,0.081945,0.086497,0.09105,0.09674,0.102431,0.108121],[0.051445,0.055303,0.059162,0.064306,0.068164,0.072023,0.077167,0.082312,0.087456,0.092601,0.097745,0.10289,0.10932,0.115751,0.122181],[0.071688,0.077065,0.082441,0.08961,0.094987,0.100363,0.107532,0.114701,0.12187,0.129038,0.136207,0.143376,0.152337,0.161298,0.170259]] as const;
const nilouWhirlingSteps = [[0.032619,0.035066,0.037512,0.040774,0.04322,0.045667,0.048929,0.052191,0.055453,0.058715,0.061976,0.065238,0.069316,0.073393,0.077471],[0.039605,0.042575,0.045546,0.049506,0.052476,0.055447,0.059407,0.063368,0.067328,0.071289,0.075249,0.07921,0.08416,0.089111,0.094061],[0.050616,0.054412,0.058208,0.06327,0.067066,0.070862,0.075924,0.080986,0.086047,0.091109,0.09617,0.101232,0.107559,0.113886,0.120213]] as const;

const both = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const talent = { label: "原生天赋等级表索引", unit: "index", integer: true, minimum: 0, maximum: 14 } as const;
const maxHp = { label: "原位置一次真实生命上限读取", unit: "HP" } as const;
const em = { label: "原位置一次真实元素精通读取", unit: "EM" } as const;
const c1 = { label: "原生一命是否解锁", unit: "flag", integer: true, choices: [{ value: 0, label: "未解锁" }, { value: 1, label: "已解锁" }] } as const;
const hpLeaf = { stateKey: "maxHp", getter: "max-hp", actor: "holder" } as const;
const emLeaf = { stateKey: "em", getter: "stat", statIndex: 8, actor: "holder" } as const;
function setRule(character: string, title: string, file: string,
  inputs: Readonly<Record<string, SourceHostCharacterModifierDynamicParameter>>,
  expression: FormulaExpression, statLeaf: SourceHostCharacterModifierDynamicStatLeaf,
  explanation: string): SourceHostCharacterFlatDescriptor {
  return { character, title, sourceFile: `internal/characters/${character}/${file}`,
    sourceCommits: both, operation: "set", inputs, expression, statLeaf, explanation };
}
const hpTable = (values: readonly number[]) => expr.mul(table(v("talent"), values), v("maxHp"));
const emTable = (values: readonly number[]) => expr.mul(table(v("talent"), values), v("em"));
const dehyaSkillRatio = expr.condition("equal", v("c1"), n(1), n(.036), n(0));
const dehyaBurstRatio = expr.condition("equal", v("c1"), n(1), n(.06), n(0));

export const characterFlatGroupA = {
  "char-flat-albedo-c2-burst": setRule("albedo", "阿贝多 C2 爆发及生灭之花防御加值", "burst.go",
    { nonExtraDef: { label: "原帧非额外总防御力", unit: "DEF" }, stacks: { label: "爆发起手保存的 C2 层数", unit: "stack", integer: true, minimum: 0, maximum: 4 } },
    expr.mul(v("nonExtraDef"), v("stacks"), n(.3)), { stateKey: "nonExtraDef", getter: "non-extra-total-def", actor: "holder" },
    "起手读取 C2 层数并清零；75 帧后以保存的层数和第二次独立防御力读取覆盖同一 AttackInfo 的旧 FlatDmg，绽放攻击只携新回执。"),
  "char-flat-alhaitham-burst-em": setRule("alhaitham", "艾尔海森爆发精通伤害", "burst.go",
    { talent, em }, emTable(alhaithamBurstEm), emLeaf,
    "爆发 FlatDmg 使用战技天赋等级表，保留原 Burst Mult 的单独爆发天赋读取。"),
  "char-flat-alhaitham-rush-em": setRule("alhaitham", "艾尔海森迅击精通伤害", "skill.go",
    { talent, em }, emTable(alhaithamRushEm), emLeaf,
    "战技点按与长按各在原 AttackInfo 创建位置按同一战技表计算，原蓄力/棱镜时序不变。"),
  "char-flat-alhaitham-mirror-em": setRule("alhaitham", "艾尔海森棱镜投射精通伤害", "skill.go",
    { talent, em }, emTable(alhaithamMirrorEm), emLeaf,
    "每次原投射攻击构造时读取当次战技天赋与一次精通，保留棱镜层、攻击排队和命中条件。"),
  "char-flat-candace-skill-hp": setRule("candace", "坎蒂丝战技生命伤害", "skill.go",
    { chargeLevel: { label: "点按或蓄力档位", unit: "index", integer: true, choices: [{ value: 0, label: "点按" }, { value: 1, label: "蓄力" }] }, talent, maxHp },
    expr.mul(table2(v("chargeLevel"), v("talent"), candaceSkillDmg), v("maxHp")), hpLeaf,
    "沿用 perfect/hold 得到的原 chargeLevel 后查二维战技表，原 windup 与粒子门槛不变。"),
  "char-flat-candace-c6-hp": setRule("candace", "坎蒂丝 C6 生命附加攻击", "cons.go",
    { maxHp }, expr.mul(n(.15), v("maxHp")), hpLeaf,
    "原 C6 事件门槛后构造一次独立水元素攻击，以来源持有者一次生命上限读取计算。"),
  "char-flat-candace-burst-hp": setRule("candace", "坎蒂丝爆发生命伤害", "burst.go",
    { talent, maxHp }, hpTable(candaceBurstDmg), hpLeaf,
    "爆发起手在原 AttackInfo 创建点查爆发天赋表并读取一次生命上限。"),
  "char-flat-candace-wave-hp": setRule("candace", "坎蒂丝爆发切人水波生命伤害", "burst.go",
    { talent, maxHp }, hpTable(candaceBurstWaveDmg), hpLeaf,
    "切人事件原门槛和水波次数保持，水波创建时独立读取一次生命上限。"),
  "char-flat-dehya-skill-hp": setRule("dehya", "迪希雅战技初击与重置生命伤害", "skill.go",
    { c1, maxHp }, expr.mul(dehyaSkillRatio, v("maxHp")), hpLeaf,
    "初次战技和重新布置分别构造攻击；原 C1 初始化把倍率写成 3.6%，未解锁则为零。"),
  "char-flat-dehya-dot-hp": setRule("dehya", "迪希雅领域持续伤害生命项", "skill.go",
    { c1, talent, maxHp }, expr.mul(expr.add(dehyaSkillRatio, table(v("talent"), dehyaSkillDotHP)), v("maxHp")), hpLeaf,
    "领域部署时按 C1 分支与原战技持续伤害表计算并保存快照，后续 tick 不重复读取。"),
  "char-flat-dehya-punch-hp": setRule("dehya", "迪希雅爆发连打生命项", "burst.go",
    { c1, talent, maxHp }, expr.mul(expr.add(dehyaBurstRatio, table(v("talent"), dehyaBurstPunchHP)), v("maxHp")), hpLeaf,
    "每次连打创建时使用原 C1 分支与对应爆发天赋表。"),
  "char-flat-dehya-kick-hp": setRule("dehya", "迪希雅爆发终结生命项", "burst.go",
    { c1, talent, maxHp }, expr.mul(expr.add(dehyaBurstRatio, table(v("talent"), dehyaBurstKickHP)), v("maxHp")), hpLeaf,
    "爆发终结击创建时使用原 C1 分支与终结天赋表。"),
  "char-flat-kuki-c4-hp": setRule("kuki", "久岐忍 C4 生命伤害", "cons.go",
    { maxHp }, expr.mul(v("maxHp"), n(.097)), hpLeaf,
    "原 C4 事件和冷却条件不变，攻击创建时读取一次生命上限。"),
  "char-flat-kuki-burst-hp": setRule("kuki", "久岐忍爆发生命伤害", "burst.go",
    { maxHp, talent }, expr.mul(v("maxHp"), table(v("talent"), kukiBurst)), hpLeaf,
    "原式先读取生命上限，再按爆发天赋表取系数；多段共享原 AttackInfo。"),
  "char-flat-kuki-skill-em": setRule("kuki", "久岐忍战技精通伤害", "skill.go",
    { em }, expr.mul(v("em"), n(.25)), emLeaf,
    "战技起手构造攻击时读取一次精通，保留原技能排队。"),
  "char-flat-kuki-a4-ring-em": setRule("kuki", "久岐忍 A4 雷环精通伤害", "skill.go",
    { em }, expr.mul(v("em"), n(.25)), emLeaf,
    "原 a4Damage 在未达四阶时返回零且不读精通；只在四阶已解锁时生成公式回执。"),
  "char-flat-nilou-burst-hp": setRule("nilou", "妮露爆发初击生命伤害", "burst.go",
    { maxHp, talent }, expr.mul(v("maxHp"), table(v("talent"), nilouBurst)), hpLeaf,
    "保留原式生命上限先于爆发天赋等级表的读取顺序。"),
  "char-flat-nilou-aeon-hp": setRule("nilou", "妮露爆发延迟水环生命伤害", "burst.go",
    { maxHp, talent }, expr.mul(v("maxHp"), table(v("talent"), nilouBurstAeon)), hpLeaf,
    "延迟水环在原任务帧独立读取一次生命上限及爆发天赋。"),
  "char-flat-nilou-skill-hp": setRule("nilou", "妮露战技初击生命伤害", "skill.go",
    { talent, maxHp }, hpTable(nilouSkill), hpLeaf,
    "原战技初击以战技天赋表乘一次生命上限读取。"),
  "char-flat-nilou-sword-hp": setRule("nilou", "妮露剑舞三段生命伤害", "skill.go",
    { stage: { label: "原 dancestep 段数", unit: "index", integer: true, choices: [{ value: 0, label: "一段" }, { value: 1, label: "二段" }, { value: 2, label: "三段" }] }, talent, maxHp },
    expr.mul(table2(v("stage"), v("talent"), nilouSwordDance), v("maxHp")), hpLeaf,
    "原 dancestep 0–2 决定二维剑舞表，保留 AdvanceSkillIndex 时点及位移。"),
  "char-flat-nilou-whirling-hp": setRule("nilou", "妮露旋舞三段生命伤害", "skill.go",
    { stage: { label: "原 dancestep 段数", unit: "index", integer: true, choices: [{ value: 0, label: "一段" }, { value: 1, label: "二段" }, { value: 2, label: "三段" }] }, talent, maxHp },
    expr.mul(table2(v("stage"), v("talent"), nilouWhirlingSteps), v("maxHp")), hpLeaf,
    "原 dancestep 0–2 决定二维旋舞表，保留三段后的水环判定。"),
} as const satisfies Record<string, SourceHostCharacterFlatDescriptor>;
