import { expr, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterFlatDescriptor } from "./source-host-character-flat-formula";

const classic = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const stellar = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd";
const both = [classic, stellar] as const;
const v = expr.input;
const n = expr.value;
const file = (character: string, name: string) => `internal/characters/${character}/${name}`;
function table(index: FormulaExpression, values: readonly number[]): FormulaExpression {
  return values.reduceRight<FormulaExpression>((otherwise, value, i) => expr.condition("equal", index, n(i), n(value), otherwise), n(0));
}

const talent = { label: "原生天赋等级表索引", unit: "index", integer: true, minimum: 0, maximum: 14 } as const;
const em = { label: "原生读取的元素精通", unit: "EM" } as const;
const maxHP = { label: "原生读取的最大生命值", unit: "HP" } as const;
const totalDef = { label: "原生读取的非额外总防御力", unit: "DEF" } as const;
const holderEM = { stateKey: "em", getter: "stat", statIndex: 8, actor: "holder" } as const;
const holderHp = { stateKey: "maxHP", getter: "max-hp", actor: "holder" } as const;
const holderDef = { stateKey: "totalDef", getter: "total-def", actor: "holder" } as const;

const sethosShadowPierce = [1.3456,1.44652,1.54744,1.682,1.78292,1.88384,2.0184,2.15296,2.28752,2.42208,2.55664,2.6912,2.8594,3.0276,3.1958] as const;
const sethosDuskBolt = [1.9616,2.10872,2.25584,2.452,2.59912,2.74624,2.9424,3.13856,3.33472,3.53088,3.72704,3.9232,4.1684,4.4136,4.6588] as const;
const laylaBurst = [.046488,.049975,.053461,.05811,.061597,.065083,.069732,.074381,.07903,.083678,.088327,.092976,.098787,.104598,.110409] as const;
const laylaA4 = .015;
const travelerDewdrop = [.0064,.0069,.0074,.008,.0085,.009,.0096,.0102,.0109,.0115,.0122,.0128,.0136,.0144,.0152] as const;

export const characterFlatGroupD = {
  "char-flat-sethos-shadowpiercing-em": {
    character: "sethos", title: "赛索斯二阶蓄力箭元素精通基伤", sourceFile: file("sethos", "aimed.go"), sourceCommits: both,
    operation: "set", inputs: { talentLevel: talent, em }, statLeaf: holderEM,
    expression: expr.mul(table(v("talentLevel"), sethosShadowPierce), v("em")),
    explanation: "在原二阶蓄力箭排队时，按原普攻天赋索引查表并乘一次赛索斯元素精通；技能消耗与命中条件仍按来源执行。",
  },
  "char-flat-sethos-shadowpiercing-a4": {
    character: "sethos", title: "赛索斯 A4 影穿箭追加", sourceFile: file("sethos", "aimed.go"), sourceCommits: both,
    operation: "add", inputs: { em }, statLeaf: holderEM,
    expression: expr.mul(n(7), v("em")),
    explanation: "原 A4 状态门通过后按原顺序给影穿箭的既有 FlatDmg 加上七倍元素精通；日志与状态消费不变。",
  },
  "char-flat-sethos-dusk-bolt": {
    character: "sethos", title: "赛索斯夜巡逐猎·昏识之得基伤", sourceFile: file("sethos", "attack.go"), sourceCommits: both,
    operation: "set", inputs: { talentLevel: talent, em }, statLeaf: holderEM,
    expression: expr.mul(table(v("talentLevel"), sethosDuskBolt), v("em")),
    explanation: "原爆发状态下，以爆发天赋索引查来源倍率并乘一次元素精通；命中队列、攻击倍率与 C4 回调保持原顺序。",
  },
  "char-flat-layla-burst": {
    character: "layla", title: "莱依拉星流摇床基伤", sourceFile: file("layla", "burst.go"), sourceCommits: both,
    operation: "set", inputs: { talentLevel: talent, maxHP }, statLeaf: holderHp,
    expression: expr.mul(table(v("talentLevel"), laylaBurst), v("maxHP")),
    explanation: "来源爆发伤害表中的百分比乘莱依拉最大生命值；状态持续与周期攻击仍由来源队列处理。",
  },
  "char-flat-layla-shooting-star-a4": {
    character: "layla", title: "莱依拉 A4 夜星附加基伤", sourceFile: file("layla", "asc.go"), sourceCommits: both,
    operation: "set", inputs: { maxHP }, statLeaf: holderHp,
    expression: expr.mul(n(laylaA4), v("maxHP")),
    explanation: "原突破四阶门通过时读取最大生命值并乘 1.5%；夜星是否发射和命中时序不由本式决定。",
  },
  "char-flat-lauma-frostgrove-sanctuary": {
    character: "lauma", title: "菈乌玛霜林圣域周期基伤", sourceFile: file("lauma", "skill.go"), sourceCommits: both,
    operation: "set", inputs: { talentLevel: talent, em }, statLeaf: holderEM,
    expression: expr.mul(table(v("talentLevel"), [1.92,2.064,2.208,2.4,2.544,2.688,2.88,3.072,3.264,3.456,3.648,3.84,4.08,4.32,4.56]), v("em")),
    explanation: "原领域周期命中时读取元素精通并乘来源技能等级表；来源仍检查领域实例和持续状态。",
  },
  "char-flat-citlali-c4-spiritvessel-skull": {
    character: "citlali", title: "茜特菈莉 C4 精神器骷髅基伤", sourceFile: file("citlali", "cons.go"), sourceCommits: both,
    operation: "set", inputs: { em }, statLeaf: holderEM,
    expression: expr.mul(n(18), v("em")),
    explanation: "原 C4 冷却通过并完成夜魂与能量副作用后，按 18 倍元素精通创建骷髅攻击。",
  },
  "char-flat-citlali-ice-storm-a4": {
    character: "citlali", title: "茜特菈莉 A4 冰暴基伤", sourceFile: file("citlali", "asc.go"), sourceCommits: both,
    operation: "set", inputs: { em }, statLeaf: holderEM,
    expression: expr.mul(n(12), v("em")),
    explanation: "原 A4 突破门通过且能力为冰暴时读取元素精通并乘十二。",
  },
  "char-flat-citlali-frostfall-a4": {
    character: "citlali", title: "茜特菈莉 A4 霜坠风暴基伤", sourceFile: file("citlali", "asc.go"), sourceCommits: both,
    operation: "set", inputs: { em }, statLeaf: holderEM,
    expression: expr.mul(n(.9), v("em")),
    explanation: "原 A4 突破门通过且能力为霜坠风暴时读取元素精通并乘 0.9。",
  },
  "char-flat-gorou-a4-skill": {
    character: "gorou", title: "五郎 A4 战技附加基伤", sourceFile: file("gorou", "asc.go"), sourceCommits: both,
    operation: "set", inputs: { totalDef }, statLeaf: holderDef,
    expression: expr.mul(n(1.56), v("totalDef")),
    explanation: "原突破四阶门通过后以非额外总防御力乘 156%；来源战技仍决定何时创建攻击。",
  },
  "char-flat-gorou-a4-burst": {
    character: "gorou", title: "五郎 A4 爆发与晶塌附加基伤", sourceFile: file("gorou", "asc.go"), sourceCommits: both,
    operation: "set", inputs: { totalDef }, statLeaf: holderDef,
    expression: expr.mul(n(.156), v("totalDef")),
    explanation: "原突破四阶门通过后以非额外总防御力乘 15.6%；用于来源爆发初击和晶塌各自真实创建的攻击。",
  },
  "char-flat-thoma-a4-fiery-collapse": {
    character: "thoma", title: "托马 A4 烈烧佑命之侍护协同基伤", sourceFile: file("thoma", "asc.go"), sourceCommits: both,
    operation: "set", inputs: { maxHP }, statLeaf: holderHp,
    expression: expr.mul(n(.022), v("maxHP")),
    explanation: "原突破一阶门通过时读取最大生命值并乘 2.2%；烈烧佑命之侍护的触发与队列仍由来源处理。",
  },
  "char-flat-zhongli-a4-normal-charge": {
    character: "zhongli", title: "钟离 A4 普攻与重击附加基伤", sourceFile: file("zhongli", "asc.go"), sourceCommits: both,
    operation: "set", inputs: { maxHP }, statLeaf: holderHp,
    expression: expr.mul(n(.0139), v("maxHP")),
    explanation: "原突破四阶门通过时读取最大生命值并乘 1.39%，用于来源普攻或重击攻击构造。",
  },
  "char-flat-zhongli-a4-skill": {
    character: "zhongli", title: "钟离 A4 战技附加基伤", sourceFile: file("zhongli", "asc.go"), sourceCommits: both,
    operation: "set", inputs: { maxHP }, statLeaf: holderHp,
    expression: expr.mul(n(.019), v("maxHP")),
    explanation: "原突破四阶门通过时读取最大生命值并乘 1.9%；岩脊初次创建后的共鸣跳字复用真实创建回执。",
  },
  "char-flat-zhongli-a4-burst": {
    character: "zhongli", title: "钟离 A4 天星附加基伤", sourceFile: file("zhongli", "asc.go"), sourceCommits: both,
    operation: "set", inputs: { maxHP }, statLeaf: holderHp,
    expression: expr.mul(n(.33), v("maxHP")),
    explanation: "原突破四阶门通过时读取最大生命值并乘 33%。",
  },
  "char-flat-hydro-traveler-dewdrop": {
    character: "hydro-traveler", title: "水主源水之滴技能基伤", sourceFile: file("traveler/common/hydro", "skill.go"), sourceCommits: both,
    operation: "set", inputs: { talentLevel: talent, maxHP }, statLeaf: holderHp,
    expression: expr.mul(table(v("talentLevel"), travelerDewdrop), v("maxHP")),
    explanation: "原气血门通过时按技能天赋等级表乘最大生命值；后续扣血、加成累计及队列仍由来源执行。",
  },
  "char-flat-hydro-traveler-a4-first-accumulate": {
    character: "hydro-traveler", title: "水主 A4 蓄水叠加", sourceFile: file("traveler/common/hydro", "skill.go"), sourceCommits: both,
    operation: "set", inputs: { drainHP: { label: "原此次扣除生命值", unit: "HP" } },
    expression: expr.min(n(5000), expr.mul(n(.45), v("drainHP"))),
    explanation: "字段默认零值仅作为此独立公式的明确常量；第一次真实生命消耗后按 45% 增加蓄水并按 5000 封顶。",
  },
  "char-flat-hydro-traveler-a4-accumulate": {
    character: "hydro-traveler", title: "水主 A4 后续蓄水叠加", sourceFile: file("traveler/common/hydro", "skill.go"), sourceCommits: both,
    operation: "set", inputs: { previousBonus: { label: "来源上次累计的蓄水值", unit: "damage" }, drainHP: { label: "原此次扣除生命值", unit: "HP" } },
    valueSources: { previousBonus: ["char-flat-hydro-traveler-a4-first-accumulate", "char-flat-hydro-traveler-a4-accumulate"] },
    expression: expr.min(n(5000), expr.add(v("previousBonus"), expr.mul(n(.45), v("drainHP")))),
    explanation: "后续真实生命消耗递归读取上次累计的创建 ID，再按来源公式增加并按 5000 封顶。",
  },
  "char-flat-hydro-traveler-a4-consume-zero": {
    character: "hydro-traveler", title: "水主 A4 初始蓄水加入战技", sourceFile: file("traveler/common/hydro", "skill.go"), sourceCommits: both,
    operation: "add", inputs: {}, expression: n(0),
    explanation: "来源字段仍为默认零值时，保留原加零操作；不伪造不存在的初始化事件。",
  },
  "char-flat-hydro-traveler-a4-consume": {
    character: "hydro-traveler", title: "水主 A4 蓄水加入战技", sourceFile: file("traveler/common/hydro", "skill.go"), sourceCommits: both,
    operation: "add", inputs: { storedBonus: { label: "来源字段保存的 A4 蓄水值", unit: "damage" } },
    valueSources: { storedBonus: ["char-flat-hydro-traveler-a4-first-accumulate", "char-flat-hydro-traveler-a4-accumulate"] },
    expression: v("storedBonus"),
    explanation: "战技按原顺序将上次累计的蓄水值加入已有 FlatDmg，随后清零；此链接追溯该真实字段最近一次创建记录。",
  },
} as const satisfies Record<string, SourceHostCharacterFlatDescriptor>;
