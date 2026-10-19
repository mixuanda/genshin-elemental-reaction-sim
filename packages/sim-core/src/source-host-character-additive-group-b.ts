/** Kokomi, Lauma, Layla and Mizuki source-owned same-hit additions. */
import { expr, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterAdditiveDescriptor } from "./source-host-character-additive-formula";

const both = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const n = expr.value;
const v = expr.input;
const em = { label: "原命中帧读取的来源元素精通", unit: "EM" };
const talentLevel = { label: "本次爆发天赋表索引", unit: "level", integer: true, minimum: 0, maximum: 14 };
const c2Active = { label: "原 C2 倍率辅助函数的非零分支", unit: "flag", integer: true, choices: [{ value: 0, label: "未激活" }, { value: 1, label: "已激活" }] };

function table(level: string, values: readonly number[]): FormulaExpression {
  return values.reduceRight<FormulaExpression>((rest, value, index) =>
    expr.condition("equal", v(level), n(index), n(value), rest), n(values[values.length - 1]!));
}

const bloom = [2.7776, 2.98592, 3.19424, 3.472, 3.68032, 3.88864, 4.1664, 4.44416, 4.72192, 4.99968, 5.27744, 5.5552, 5.9024, 6.2496, 6.5968] as const;
const lunarBloom = [2.2224, 2.38908, 2.55576, 2.778, 2.94468, 3.11136, 3.3336, 3.55584, 3.77808, 4.00032, 4.22256, 4.4448, 4.7226, 5.0004, 5.2782] as const;

export const characterAdditiveGroupB = {
  "char-add-kokomi-a4": {
    character: "kokomi", title: "心海 A4 同击附加伤害", sourceFile: "internal/characters/kokomi/asc.go", sourceCommits: both, phase: "hit",
    inputs: { healBonus: { label: "原命中帧治疗加成", unit: "ratio" }, maxHP: { label: "随后读取的生命上限", unit: "HP" } },
    statLeaves: [{ stateKey: "healBonus", getter: "stat", statIndex: 11, actor: "holder" }, { stateKey: "maxHP", getter: "max-hp", actor: "holder" }],
    expression: expr.mul(v("healBonus"), n(0.15), v("maxHP")),
    explanation: "保留本人普通或重击、爆发衣状态门；按原 Stat(Heal) 后 MaxHP 两次读取顺序追加伤害。",
  },
  "char-add-lauma-bloom-base": {
    character: "lauma", title: "菈乌玛苍色赞歌绽放基础加值", sourceFile: "internal/characters/lauma/burst.go", sourceCommits: both, phase: "hit",
    inputs: { em, talentLevel }, statLeaf: { stateKey: "em", getter: "stat", statIndex: 8, actor: "holder" },
    expression: expr.mul(v("em"), table("talentLevel", bloom)),
    explanation: "原草原核、绽放、超绽放或烈绽放及苍色赞歌门通过后，按爆发天赋表追加第一笔伤害。",
  },
  "char-add-lauma-bloom-c2": {
    character: "lauma", title: "菈乌玛 C2 绽放额外加值", sourceFile: "internal/characters/lauma/burst.go", sourceCommits: both, phase: "hit",
    inputs: { em, c2Active }, statLeaf: { stateKey: "em", getter: "stat", statIndex: 8, actor: "holder" },
    expression: expr.mul(v("em"), n(5), v("c2Active")),
    explanation: "第一笔绽放加值之后保留第二次原生加法；C2 辅助函数仍调用一次，零与五倍分支由共享公式明确计算。",
  },
  "char-add-lauma-lunar-bloom-base": {
    character: "lauma", title: "菈乌玛苍色赞歌月绽放基础加值", sourceFile: "internal/characters/lauma/burst.go", sourceCommits: both, phase: "hit",
    inputs: { em, talentLevel }, statLeaf: { stateKey: "em", getter: "stat", statIndex: 8, actor: "holder" },
    expression: expr.mul(v("em"), table("talentLevel", lunarBloom)),
    explanation: "原直接月绽放与苍色赞歌门通过后，按独立爆发天赋表追加第一笔伤害。",
  },
  "char-add-lauma-lunar-bloom-c2": {
    character: "lauma", title: "菈乌玛 C2 月绽放额外加值", sourceFile: "internal/characters/lauma/burst.go", sourceCommits: both, phase: "hit",
    inputs: { em, c2Active }, statLeaf: { stateKey: "em", getter: "stat", statIndex: 8, actor: "holder" },
    expression: expr.mul(v("em"), n(4), v("c2Active")),
    explanation: "第一笔月绽放加值之后保留第二次原生加法；C2 辅助函数仍调用一次，零与四倍分支由共享公式明确计算。",
  },
  "char-add-layla-c4": {
    character: "layla", title: "莱依拉 C4 晨星同击附加伤害", sourceFile: "internal/characters/layla/cons.go", sourceCommits: both, phase: "hit",
    inputs: { maxHP: { label: "莱依拉当次实际生命上限", unit: "HP" } },
    statLeaf: { stateKey: "maxHP", getter: "max-hp", actor: "holder" }, expression: expr.mul(n(0.05), v("maxHP")),
    explanation: "原受益者普攻或重击及晨星状态门通过后追加 5% 生命上限；随后原排队状态删除与日志仍执行。",
  },
  "char-add-mizuki-c1-em": {
    character: "mizuki", title: "梦见月瑞希 C1 周期精通快照", sourceFile: "internal/characters/mizuki/cons.go", sourceCommits: both, phase: "creation",
    resultUnit: "EM",
    inputs: { em: { label: "原三点五秒任务读取的元素精通", unit: "EM" } },
    statLeaf: { stateKey: "em", getter: "stat", statIndex: 8, actor: "holder" }, expression: v("em"),
    explanation: "在原云团任务每次写 c1EM 时存精通与创建回执，不在后续命中重新读取。",
  },
  "char-add-mizuki-c1": {
    character: "mizuki", title: "梦见月瑞希 C1 扩散附加伤害", sourceFile: "internal/characters/mizuki/cons.go", sourceCommits: both, phase: "hit",
    inputs: { savedEM: { label: "最近一次原任务保存的元素精通", unit: "EM" } },
    valueSources: { savedEM: "char-add-mizuki-c1-em" }, expression: expr.mul(n(11), v("savedEM")),
    explanation: "原敌人标记、扩散类型与非零 FlatDmg 门通过后，在已有反应伤害上追加十一倍旧精通；日志、技能名与消耗标记次序保留。",
  },
} as const satisfies Record<string, SourceHostCharacterAdditiveDescriptor>;
