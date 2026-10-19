/** Source-owned queued FlatDmg operations for Baizhu, Chiori, Itto, Kokomi, Lan Yan and Nahida. */
import { expr, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterFlatDescriptor } from "./source-host-character-flat-formula";

const both = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const n = expr.value;
const v = expr.input;
const talentLevel = { label: "原天赋表索引", unit: "level", integer: true, minimum: 0, maximum: 14 };
const maxHP = { label: "原创建点实际生命上限", unit: "HP" };
const em = { label: "原创建点实际元素精通", unit: "EM" };

function table(key: string, values: readonly number[]): FormulaExpression {
  return values.reduceRight<FormulaExpression>((rest, value, index) =>
    expr.condition("equal", v(key), n(index), n(value), rest), n(values[values.length - 1]!));
}

const chioriBurst = [3.204, 3.4443, 3.6846, 4.005, 4.2453, 4.4856, 4.806, 5.1264, 5.4468, 5.7672, 6.0876, 6.408, 6.8085, 7.209, 7.6095] as const;
const chioriThrust = [1.866, 2.00595, 2.1459, 2.3325, 2.47245, 2.6124, 2.799, 2.9856, 3.1722, 3.3588, 3.5454, 3.732, 3.96525, 4.1985, 4.43175] as const;
const chioriTurret = [1.026, 1.10295, 1.1799, 1.2825, 1.35945, 1.4364, 1.539, 1.6416, 1.7442, 1.8468, 1.9494, 2.052, 2.18025, 2.3085, 2.43675] as const;
const kokomiBurst = [.10416, .111972, .119784, .1302, .138012, .145824, .15624, .166656, .177072, .187488, .197904, .20832, .22134, .23436, .24738] as const;
const kokomiNormal = [.0484, .05203, .05566, .0605, .06413, .06776, .0726, .07744, .08228, .08712, .09196, .0968, .10285, .1089, .11495] as const;
const kokomiCharge = [.06776, .072842, .077924, .0847, .089782, .094864, .10164, .108416, .115192, .121968, .128744, .13552, .14399, .15246, .16093] as const;
const kokomiSkill = [.070963, .076285, .081608, .088704, .094026, .099348, .106445, .113541, .120637, .127734, .13483, .141926, .150797, .159667, .168538] as const;
const nahidaTriKarma = [2.064, 2.2188, 2.3736, 2.58, 2.7348, 2.8896, 3.096, 3.3024, 3.5088, 3.7152, 3.9216, 4.128, 4.386, 4.644, 4.902] as const;

function chioriSet(title: string, file: string): SourceHostCharacterFlatDescriptor {
  return { character: "chiori", title, sourceFile: `internal/characters/chiori/${file}`, sourceCommits: both,
    operation: "set", inputs: { snapshotDEF: { label: "原攻击快照的总防御力", unit: "DEF" } },
    snapshotLeaf: { stateKey: "snapshotDEF", getter: "total-def" }, expression: v("snapshotDEF"),
    explanation: "原代码先从已经取得的攻击快照把 FlatDmg 设为总防御力；后续独立乘法才应用倍率。" };
}
function chioriScale(title: string, file: string, values: readonly number[], ratio = 1): SourceHostCharacterFlatDescriptor {
  return { character: "chiori", title, sourceFile: `internal/characters/chiori/${file}`, sourceCommits: both,
    operation: "multiply", inputs: { talentLevel }, expression: expr.mul(table("talentLevel", values), n(ratio)),
    explanation: "保留原快照 DEF 的先前 set 回执，再以原位置一次天赋等级读取乘来源倍率。" };
}
function kokomiBonus(title: string, values: readonly number[], explanation = "原爆发衣状态门和攻击标签分支通过后，先读爆发天赋等级、后读生命上限；值在当前生产帧固定。"): SourceHostCharacterFlatDescriptor {
  return { character: "kokomi", title, sourceFile: "internal/characters/kokomi/burst.go", sourceCommits: both,
    operation: "set", inputs: { talentLevel, maxHP }, statLeaf: { stateKey: "maxHP", getter: "max-hp", actor: "holder" },
    expression: expr.mul(table("talentLevel", values), v("maxHP")),
    explanation };
}

export const characterFlatGroupB = {
  "char-flat-baizhu-c6-spiritvein": { character: "baizhu", title: "白术 C6 灵脉生命附伤", sourceFile: "internal/characters/baizhu/burst.go", sourceCommits: both, operation: "set", inputs: { maxHP }, statLeaf: { stateKey: "maxHP", getter: "max-hp", actor: "holder" }, expression: expr.mul(v("maxHP"), n(.08)), explanation: "保留六命门和原生命上限一次读取，入队前设置 8% 生命附伤。" },

  "char-flat-chiori-a1-def-set": chioriSet("千织 A1 快照防御设值", "asc.go"),
  "char-flat-chiori-a1-scale": chioriScale("千织 A1 战技倍率", "asc.go", chioriThrust),
  "char-flat-chiori-burst-def-set": chioriSet("千织爆发快照防御设值", "burst.go"),
  "char-flat-chiori-burst-scale": chioriScale("千织爆发防御倍率", "burst.go", chioriBurst),
  "char-flat-chiori-c6-def-set": chioriSet("千织 C6 普攻快照防御设值", "cons.go"),
  "char-flat-chiori-c6-scale": { character: "chiori", title: "千织 C6 普攻防御倍率", sourceFile: "internal/characters/chiori/cons.go", sourceCommits: both, operation: "multiply", inputs: {}, expression: n(2.35), explanation: "在原先快照 DEF 设值后，同位置乘 235%；循环中每次重新替换本次攻击组件。" },
  "char-flat-chiori-kinu-def-set": chioriSet("千织绢偶快照防御设值", "kinu.go"),
  "char-flat-chiori-kinu-scale": chioriScale("千织绢偶防御倍率", "kinu.go", chioriTurret, 1.7),
  "char-flat-chiori-skill-upward-def-set": chioriSet("千织战技上挑快照防御设值", "skill.go"),
  "char-flat-chiori-skill-upward-scale": chioriScale("千织战技上挑防御倍率", "skill.go", chioriThrust),
  "char-flat-chiori-skill-doll-def-set": chioriSet("千织人偶攻击快照防御设值", "skill.go"),
  "char-flat-chiori-skill-doll-scale": chioriScale("千织人偶攻击防御倍率", "skill.go", chioriTurret),

  "char-flat-itto-a4": { character: "itto", title: "荒泷一斗 A4 防御附伤", sourceFile: "internal/characters/itto/asc.go", sourceCommits: both, operation: "set", inputs: { totalDEF: { label: "原重击创建点实际总防御力", unit: "DEF" } }, statLeaf: { stateKey: "totalDEF", getter: "total-def", actor: "holder" }, expression: expr.mul(v("totalDEF"), n(.35)), explanation: "四阶门通过后保留一次 TotalDef(false) 读取，于原设值点写入 35% 防御附伤。" },

  "char-flat-kokomi-burst": kokomiBonus("心海爆发初始生命附伤", kokomiBurst, "原爆发动作在入队和赋予爆发衣状态之前，先读爆发天赋等级、后读生命上限；保留原源码关于快照时机未明的 TODO。"),
  "char-flat-kokomi-c1": { character: "kokomi", title: "心海 C1 水鱼生命附伤", sourceFile: "internal/characters/kokomi/cons.go", sourceCommits: both, operation: "set", inputs: { maxHP }, statLeaf: { stateKey: "maxHP", getter: "max-hp", actor: "holder" }, expression: expr.mul(n(.3), v("maxHP")), explanation: "原 C1 排队攻击创建处只读一次生命上限，维持原静态或动态机制 TODO。" },
  "char-flat-kokomi-bonus-normal": kokomiBonus("心海爆发衣普攻生命附伤", kokomiNormal),
  "char-flat-kokomi-bonus-charge": kokomiBonus("心海爆发衣重击生命附伤", kokomiCharge),
  "char-flat-kokomi-bonus-skill": kokomiBonus("心海爆发衣水母生命附伤", kokomiSkill),
  "char-flat-kokomi-bonus-zero": { character: "kokomi", title: "心海爆发衣失效时零附伤", sourceFile: "internal/characters/kokomi/burst.go", sourceCommits: both, operation: "set", inputs: {}, expression: n(0), explanation: "原状态或标签不满足时直接返回零，不增加天赋或生命 getter。" },
  "char-flat-kokomi-skill-tick-active": { character: "kokomi", title: "心海水母 tick 消费保存生命附伤", sourceFile: "internal/characters/kokomi/skill.go", sourceCommits: both, operation: "set", inputs: { savedSkillFlatDmg: { label: "最近一次原生产者保存的水母附伤", unit: "damage" } }, valueSources: { savedSkillFlatDmg: "char-flat-kokomi-bonus-skill" }, expression: v("savedSkillFlatDmg"), explanation: "原技能 tick 在选择保存或现场生产分支后覆写复用的攻击事件，引用对应创建帧回执。" },
  "char-flat-kokomi-skill-tick-zero": { character: "kokomi", title: "心海水母 tick 消费保存零附伤", sourceFile: "internal/characters/kokomi/skill.go", sourceCommits: both, operation: "set", inputs: { savedSkillFlatDmg: { label: "原状态失效后保存的零附伤", unit: "damage" } }, valueSources: { savedSkillFlatDmg: "char-flat-kokomi-bonus-zero" }, expression: v("savedSkillFlatDmg"), explanation: "原技能 tick 的无爆发衣分支仍执行覆写，使用零值生产回执替换此前 tick 的组件。" },

  "char-flat-lanyan-ring": { character: "lanyan", title: "蓝砚羽环精通附伤", sourceFile: "internal/characters/lanyan/attack.go", sourceCommits: both, operation: "set", inputs: { em }, statLeaf: { stateKey: "em", getter: "stat", statIndex: 8, actor: "holder" }, expression: expr.mul(v("em"), n(3.09)), explanation: "原四阶门通过后只读一次精通，同一入队攻击值由多次羽环命中沿用。" },
  "char-flat-lanyan-burst": { character: "lanyan", title: "蓝砚爆发精通附伤", sourceFile: "internal/characters/lanyan/burst.go", sourceCommits: both, operation: "set", inputs: { em }, statLeaf: { stateKey: "em", getter: "stat", statIndex: 8, actor: "holder" }, expression: expr.mul(v("em"), n(7.74)), explanation: "原四阶门通过后只读一次精通，爆发连续命中沿用同一创建值。" },

  "char-flat-nahida-trikarma": { character: "nahida", title: "纳西妲灭净三业精通附伤", sourceFile: "internal/characters/nahida/skill.go", sourceCommits: both, operation: "set", inputs: { snapshotEM: { label: "原本次攻击快照元素精通", unit: "EM" }, talentLevel }, snapshotLeaf: { stateKey: "snapshotEM", getter: "em" }, expression: expr.mul(v("snapshotEM"), table("talentLevel", nahidaTriKarma)), explanation: "原目标门通过并取得攻击快照后，按第二次实际战技天赋表索引设置附伤。" },
  "char-flat-nahida-c6": { character: "nahida", title: "纳西妲 C6 业障净化精通附伤", sourceFile: "internal/characters/nahida/cons.go", sourceCommits: both, operation: "set", inputs: { snapshotEM: { label: "原攻击快照元素精通", unit: "EM" } }, snapshotLeaf: { stateKey: "snapshotEM", getter: "em" }, expression: expr.mul(v("snapshotEM"), n(4)), explanation: "原 C6 触发与六次计数门完成后取一次攻击快照精通，多目标攻击沿用同一附伤。" },
} as const satisfies Record<string, SourceHostCharacterFlatDescriptor>;
