/** Source-owned same-hit FlatDmg formulas from Nicole through Yun Jin. */
import { expr, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterAdditiveDescriptor } from "./source-host-character-additive-formula";

const classic = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const stellar = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd";
const both = [classic, stellar] as const;
const v = expr.input;
const n = expr.value;
const file = (character: string, name: string) => `internal/characters/${character}/${name}`;
function table(index: FormulaExpression, values: readonly number[]): FormulaExpression {
  return values.reduceRight<FormulaExpression>((otherwise, value, i) => expr.condition("equal", index, n(i), n(value), otherwise), n(0));
}
const shenheQuill = [.45656,.490802,.525044,.5707,.604942,.639184,.68484,.730496,.776152,.821808,.867464,.91312,.97019,1.02726,1.08433] as const;
const yunjinBurst = [.3216,.34572,.36984,.402,.42612,.45024,.4824,.51456,.54672,.57888,.61104,.6432,.6834,.7236,.7638] as const;
const talent = { label: "原生天赋等级表索引", unit: "index", integer: true, minimum: 0, maximum: 14 } as const;
const totalAtk = { label: "本次来源角色总攻击力", unit: "ATK" } as const;
const totalDef = { label: "本次来源角色总防御力", unit: "DEF" } as const;
const holderAtk = { stateKey: "totalAtk", getter: "total-atk", actor: "holder" } as const;
const holderDef = { stateKey: "totalDef", getter: "total-def", actor: "holder" } as const;
export const characterAdditiveGroupC = {
  "char-add-nicole-c4": {
    character: "nicole", title: "妮可 C4 命中附加攻击力", sourceFile: file("nicole","cons.go"), sourceCommits: both, phase: "hit", inputs: { totalAtk }, statLeaf: holderAtk,
    expression: expr.mul(n(.7),v("totalAtk")), explanation: "原命中标签、目标、状态和剩余次数门后只读取一次妮可总攻击力；同击返还 70% 作为 FlatDmg。",
  },
  "char-add-qiqi-c6": {
    character: "qiqi", title: "七七 C6 星辉直伤附加", sourceFile: file("qiqi","cons.go"), sourceCommits: [stellar], phase: "hit", inputs: { totalAtk }, statLeaf: holderAtk,
    expression: expr.mul(n(6),v("totalAtk")), explanation: "仅星辉源码在直击标签且原状态门通过后扣层，再读取一次七七总攻击力并乘六。",
  },
  "char-add-shenhe-quill": {
    character: "shenhe", title: "申鹤冰翎同击附加", sourceFile: file("shenhe","skill.go"), sourceCommits: both, phase: "hit", inputs: { talentLevel: talent, totalAtk }, statLeaf: holderAtk,
    expression: expr.mul(table(v("talentLevel"),shenheQuill),v("totalAtk")), explanation: "原冰伤、攻击类别和冰翎状态门通过后，先读取技能天赋索引，再读取当次申鹤总攻击力；消耗层数和 C4 回调仍在原位置。",
  },
  "char-add-sigewinne-a1": {
    character: "sigewinne", title: "希格雯 A1 静养附加", sourceFile: file("sigewinne","asc.go"), sourceCommits: both, phase: "hit", inputs: { maxHp: { label: "本次来源角色最大生命值", unit: "HP" }, c1: { label: "原生命座一分支", unit: "flag", choices: [{value:0,label:"未达一命"},{value:1,label:"一命及以上"}] } }, statLeaf: { stateKey: "maxHp", getter: "max-hp", actor: "holder" },
    expression: expr.condition("equal",v("c1"),n(1),expr.min(n(3500),expr.mul(expr.max(expr.sub(v("maxHp"),n(30000)),n(0)),n(.1))),expr.min(n(2800),expr.mul(expr.max(expr.sub(v("maxHp"),n(30000)),n(0)),n(.08)))),
    explanation: "原技能标签、其他离场角色和静养层数门后先扣层，再读取一次最大生命；超过 30000 的部分按原一命或默认系数计算并封顶。",
  },
  "char-add-xianyun-a4-atk-snapshot": {
    character: "xianyun", title: "闲云 A4 定时攻击力快照", sourceFile: file("xianyun","asc.go"), sourceCommits: both, phase: "creation", inputs: { totalAtk: { label: "本次三十帧更新的总攻击力", unit: "ATK" } }, statLeaf: holderAtk,
    resultUnit: "ATK",
    expression: v("totalAtk"), explanation: "原 a4AtkUpdate 每次任务实际执行时只读取一次总攻击力，值与创建 ID 存入原 a4Atk 字段供后续命中使用。",
  },
  "char-add-xianyun-a4": {
    character: "xianyun", title: "闲云 A4 下落同击附加", sourceFile: file("xianyun","asc.go"), sourceCommits: both, phase: "hit", inputs: { atkSnapshot: { label: "最近一次原三十帧更新保存的攻击力", unit: "ATK" }, c2: { label: "原生命座二分支", unit: "flag", choices: [{value:0,label:"默认"},{value:1,label:"二命及以上"}] } }, valueSources: { atkSnapshot: "char-add-xianyun-a4-atk-snapshot" },
    expression: expr.condition("equal",v("c2"),n(1),expr.min(n(18000),expr.mul(n(4),v("atkSnapshot"))),expr.min(n(9000),expr.mul(n(2),v("atkSnapshot")))),
    explanation: "原下落、非碰撞、窗口和 ICD 门后，使用上次真实定时更新的共享创建值；C2 扩大倍率及上限，原日志和 ICD 时序保留。",
  },
  "char-add-xilonen-c4": {
    character: "xilonen", title: "希诺宁 C4 命中附加防御力", sourceFile: file("xilonen","cons.go"), sourceCommits: both, phase: "hit", inputs: { totalDef }, statLeaf: holderDef,
    expression: expr.mul(n(.65),v("totalDef")), explanation: "原普攻、重击、下落、受益者窗口和次数门后只读取一次希诺宁总防御力，之后原位置扣层。",
  },
  "char-add-xilonen-c6": {
    character: "xilonen", title: "希诺宁 C6 夜魂命中附加", sourceFile: file("xilonen","cons.go"), sourceCommits: both, phase: "hit", inputs: { totalDef }, statLeaf: holderDef,
    expression: expr.mul(v("totalDef"),n(3)), explanation: "原 AttackMod 正常/下落与夜魂标签门后读取一次总防御力，返回三倍同击 FlatDmg；Amount 原 nil 返回保留。",
  },
  "char-add-yunjin-burst": {
    character: "yunjin", title: "云堇飞云旗阵同击附加", sourceFile: file("yunjin","burst.go"), sourceCommits: both, phase: "hit", inputs: { talentLevel: talent, teamElements: { label: "原初始化累计的队伍元素种类数", unit: "count", minimum: 0, maximum: 4, integer: true }, ascension: { label: "原四阶突破分支", unit: "flag", choices: [{value:0,label:"未达四阶"},{value:1,label:"四阶及以上"}] }, totalDef }, statLeaf: holderDef,
    expression: expr.mul(v("totalDef"),expr.add(table(v("talentLevel"),yunjinBurst),expr.condition("equal",v("ascension"),n(1),expr.condition("equal",v("teamElements"),n(4),n(.115),expr.mul(n(.025),v("teamElements"))),n(0)))),
    explanation: "原普通攻击和旗阵次数门后按实际天赋索引查表，再沿原 A4 四元素特例或每种 2.5% 算增量，最后读取一次总防御力相乘；原扣层与日志顺序保留。",
  },
} as const satisfies Record<string, SourceHostCharacterAdditiveDescriptor>;
