/** Remaining source-owned character vectors: Nicole through Thoma. */
import { expr, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterModifierDynamicDescriptor } from "./source-host-character-modifier-dynamic-formula";

const classic = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const stellar = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd";
const both = [classic, stellar] as const;
const v = expr.input;
const n = expr.value;
const file = (character: string, name: string) => `internal/characters/${character}/${name}`;
const count = { label: "原生已完成的数值更新次数", unit: "count", minimum: 0, integer: true } as const;
const talent = { label: "原生天赋表索引", unit: "index", minimum: 0, maximum: 14, integer: true } as const;
function constant(character: string, title: string, statIndex: number, modifierKey: string, sourceFile: string, value: number, sourceCommits: readonly string[] = both, phase: "creation" | "read" = "creation"): SourceHostCharacterModifierDynamicDescriptor {
  return { character, title, statIndex, modifierKey, sourceFile: file(character, sourceFile), sourceCommits, phase, inputs: {}, expression: n(value), explanation: "原生数值写点的固定字面量；触发、受益者、期限和 Amount 门槛仍由 Go 保留。" };
}
function choose(index: FormulaExpression, values: readonly FormulaExpression[]): FormulaExpression {
  return values.reduceRight<FormulaExpression>((otherwise, value, i) => expr.condition("equal", index, n(i), value, otherwise), n(0));
}
function orderedAdds(initial: number, increment: number, steps: number, cap?: number): FormulaExpression[] {
  const values: FormulaExpression[] = [n(initial)];
  for (let i = 1; i <= steps; i++) {
    const added = expr.add(values[i - 1]!, n(increment));
    values.push(cap === undefined ? added : expr.min(added, n(cap)));
  }
  return values;
}
const nicoleRatio = [.0825,.09,.0975,.105,.1125,.12,.1275,.135,.1425,.15,.159,.168,.177,.186,.195] as const;
const nicoleCap = [330,360,390,420,450,480,510,540,570,600,636,672,708,744,780] as const;
const razorSpeed = [.26,.28,.3,.32,.34,.36,.37,.38,.39,.4,.4,.4,.4,.4,.4] as const;
const skirkBurst = [
  [.035,.04,.045,.05,.055,.06,.065,.07,.075,.08,.085,.09,.095,.1,.105],
  [.066,.072,.078,.084,.09,.096,.102,.108,.114,.12,.126,.132,.138,.144,.15],
  [.088,.096,.104,.112,.12,.128,.136,.144,.152,.16,.168,.176,.184,.192,.2],
  [.11,.12,.13,.14,.15,.16,.17,.18,.19,.2,.21,.22,.23,.24,.25],
] as const;
const c6Hex = { label: "本次受益者原生 Hexerei 标记", unit: "flag", choices: [{ value: 0, label: "否" }, { value: 1, label: "是" }] } as const;
const sucroseC6 = (statIndex: number, element: string, lane: "b4" | "a7"): SourceHostCharacterModifierDynamicDescriptor => ({
  character: "sucrose", title: `砂糖 C6 ${element}伤加成`, statIndex, modifierKey: "sucrose-c6", sourceFile: file("sucrose", "cons.go"), sourceCommits: [lane === "b4" ? classic : stellar], phase: "read", inputs: { hexerei: c6Hex },
  expression: expr.add(n(.20), expr.condition("equal", v("hexerei"), n(1), n(lane === "b4" ? .0857142 : .085714), n(0))),
  explanation: "每名受益者的原 Amount 在同一共享切片对应元素槽重写 20%；Hexerei 受益者再按本源码版本加原字面量。",
});
export const characterModifierVectorGroupC = {
  "char-vector-nicole-a1": constant("nicole", "妮可 A1 攻击力", 5, "guidance-of-theosis", "asc.go", 300),
  "char-vector-nicole-c2": constant("nicole", "妮可 C2 攻击力", 5, "nicole-c2", "cons.go", 300),
  "char-vector-nicole-skill": { character: "nicole", title: "妮可战技攻击力", statIndex: 5, modifierKey: "grace-of-kenosis", sourceFile: file("nicole","skill.go"), sourceCommits: both, phase: "creation", inputs: { totalAtk: { label: "本次原生非额外总攻击力", unit: "ATK" }, ratioIndex: { ...talent, label: "首次原生天赋表索引" }, capIndex: { ...talent, label: "第二次原生天赋表索引" } }, statLeaf: { stateKey: "totalAtk", getter: "non-extra-total-atk", actor: "holder" }, expression: expr.min(expr.mul(v("totalAtk"),choose(v("ratioIndex"),nicoleRatio.map(n))),choose(v("capIndex"),nicoleCap.map(n))), explanation: "技能原 hitmark 只读取一次非额外总攻击力，并按原先后两次天赋等级读取的索引分别查来源倍率表与上限表。" },
  "char-vector-odette-c2-self": { character: "odette", title: "奥黛特 C2 本人攻击力", statIndex: 6, modifierKey: "odette-c2", sourceFile: file("odette","cons.go"), sourceCommits: [stellar], phase: "read", inputs: { stacks: count }, expression: expr.mul(v("stacks"),n(.07)), explanation: "原 danceDouble 状态门后读取本人当前层数。" },
  "char-vector-odette-c2-others": { character: "odette", title: "奥黛特 C2 队友攻击力", statIndex: 6, modifierKey: "odette-c2", sourceFile: file("odette","cons.go"), sourceCommits: [stellar], phase: "read", inputs: { stacks: count }, expression: expr.mul(v("stacks"),n(.07)), explanation: "原 danceDouble 状态门后读取队友当前层数。" },
  "char-vector-ororon-c1": constant("ororon", "欧洛伦 C1 伤害", 21, "ororon-c1", "cons.go", .5),
  "char-vector-prune-a4": { character: "prune", title: "普露恩 A4 攻击转增伤", statIndex: 21, modifierKey: "prune-tolling-rally", sourceFile: file("prune","asc.go"), sourceCommits: [stellar], phase: "creation", inputs: { totalAtk: { label: "本次非额外总攻击力", unit: "ATK" } }, statLeaf: { stateKey: "totalAtk", getter: "non-extra-total-atk", actor: "holder" }, expression: expr.min(expr.mul(expr.max(expr.sub(v("totalAtk"),n(2000)),n(0)),n(.00025)),n(.5)), explanation: "原回调创建时一次读取攻击力，保持先扣 2000、下限零、乘倍率、上限 50% 的顺序。" },
  "char-vector-prune-hex-self": constant("prune", "普露恩 Hexerei 本人攻击力", 6, "prune-hex-self-buff", "asc.go", .60, [stellar]),
  "char-vector-prune-hex-team": constant("prune", "普露恩 Hexerei 队友攻击力", 6, "prune-hex-team-buff", "asc.go", .30, [stellar]),
  "char-vector-prune-c2": { character: "prune", title: "普露恩 C2 命中递增加攻", statIndex: 6, modifierKey: "prune-c2", sourceFile: file("prune","cons.go"), sourceCommits: [stellar], phase: "creation", inputs: { hits: { ...count, maximum: 7 } }, expression: choose(v("hits"),orderedAdds(.10,.05,7,.40)), explanation: "初始 10%，每次原生命中在上一结果上加 5% 再截到 40%；按命中次数展开原运算次序，避免乘法改变浮点舍入。" },
  "char-vector-prune-c6": { ...constant("prune", "普露恩 C6 固定攻击力", 5, "prune-c6-self-buff", "cons.go", 350, [stellar]), consumerSlots: { "prune-c6-self-buff": 5, "prune-c6-active-buff": 5 } },
  "char-vector-qiqi-c2-cryodmg": constant("qiqi", "七七 C2 冰附着目标增伤", 21, "qiqi-c2", "cons.go", .15, [stellar]),
  "char-vector-qiqi-c2-radiance": constant("qiqi", "七七 C2 星辉攻击力", 6, "qiqi-c2-radiance", "cons.go", .5, [stellar]),
  "char-vector-razor-a4": constant("razor", "雷泽 A4 充能", 7, "razor-a4", "asc.go", .3),
  "char-vector-razor-burst-speed": { character: "razor", title: "雷泽爆发攻击速度", statIndex: 20, modifierKey: "razor-q", sourceFile: file("razor","burst.go"), sourceCommits: both, phase: "creation", inputs: { talentLevel: talent }, expression: choose(v("talentLevel"),razorSpeed.map(n)), explanation: "原爆发任务以实际天赋索引写入来源表的攻击速度，后续只关联该创建回执。" },
  "char-vector-razor-c1": constant("razor", "雷泽 C1 伤害", 21, "razor-c1", "cons.go", .1),
  "char-vector-razor-c2": constant("razor", "雷泽 C2 低血量目标暴率", 9, "razor-c2", "cons.go", .1),
  "char-vector-razor-hexerei-c6-cr": constant("razor", "雷泽 Hexerei C6 暴率", 9, "razor-hexerei-c6-buff", "cons.go", .1),
  "char-vector-razor-hexerei-c6-cd": constant("razor", "雷泽 Hexerei C6 暴伤", 10, "razor-hexerei-c6-buff", "cons.go", .5),
  "char-vector-sara-c6": constant("sara", "九条裟罗 C6 雷暴伤", 10, "sara-c6", "cons.go", .6),
  "char-vector-sayu-c2": { character: "sayu", title: "早柚 C2 翻滚递增增伤", statIndex: 21, modifierKey: "sayu-c2", sourceFile: file("sayu","skill.go"), sourceCommits: both, phase: "creation", inputs: { ticks: { ...count, maximum: 20 } }, expression: choose(v("ticks"),orderedAdds(0,.033,20)), explanation: "按原按下赋一次 0.033、短按/长按重置为零、每次合格滚动 tick 再加 0.033 的顺序展开；原小于 0.66 的门仍在 Go。" },
  "char-vector-sethos-c4": constant("sethos", "赛索斯 C4 精通", 8, "sethos-c4", "cons.go", 80),
  "char-vector-shenhe-a4": { ...constant("shenhe", "申鹤 A4 战技队友增伤", 21, "shenhe-a4-press", "shenhe.go", .15), consumerSlots: { "shenhe-a4-press": 21, "shenhe-a4-hold": 21 } },
  "char-vector-shenhe-a1": constant("shenhe", "申鹤 A1 冰伤", 14, "shenhe-a1", "shenhe.go", .15),
  "char-vector-shenhe-c2": constant("shenhe", "申鹤 C2 暴伤", 10, "shenhe-c2", "shenhe.go", .15),
  "char-vector-sigewinne-a1": constant("sigewinne", "希格雯 A1 水伤", 13, "sigewinne-a1", "asc.go", .08),
  "char-vector-skirk-burst": { character: "skirk", title: "丝柯克爆发虚空裂隙增伤", statIndex: 21, modifierKey: "skirk-burst-extinction-dmg", sourceFile: file("skirk","burst.go"), sourceCommits: both, phase: "read", inputs: { voids: { label: "原生虚空裂隙吸收档位", unit: "index", minimum: 0, maximum: 3, integer: true }, talentLevel: talent }, expression: choose(v("voids"),skirkBurst.map(row => choose(v("talentLevel"),row.map(n)))), explanation: "原 BurstInit 回调保留状态、ICD、次数扣减后，用实际裂隙档位和一次天赋索引读取来源二维表。" },
  "char-vector-skirk-c2": constant("skirk", "丝柯克 C2 攻击力", 6, "skirk-c2", "cons.go", .7),
  "char-vector-sucrose-a1": constant("sucrose", "砂糖 A1 精通", 8, "sucrose-a1", "asc.go", 50),
  "char-vector-sucrose-hex-skill": constant("sucrose", "砂糖 Hexerei 战技增伤", 21, "sucrose-hexerei-skill", "asc.go", .0571428),
  "char-vector-sucrose-hex-burst": constant("sucrose", "砂糖 Hexerei 爆发增伤", 21, "sucrose-hexerei-burst", "asc.go", .0714285),
  "char-vector-sucrose-c6-pyro-b4": sucroseC6(12,"火","b4"),
  "char-vector-sucrose-c6-hydro-b4": sucroseC6(13,"水","b4"),
  "char-vector-sucrose-c6-cryo-b4": sucroseC6(14,"冰","b4"),
  "char-vector-sucrose-c6-electro-b4": sucroseC6(15,"雷","b4"),
  "char-vector-sucrose-c6-pyro-a7": sucroseC6(12,"火","a7"),
  "char-vector-sucrose-c6-hydro-a7": sucroseC6(13,"水","a7"),
  "char-vector-sucrose-c6-cryo-a7": sucroseC6(14,"冰","a7"),
  "char-vector-sucrose-c6-electro-a7": sucroseC6(15,"雷","a7"),
  "char-vector-thoma-c6": constant("thoma", "托马 C6 普攻重击下落增伤", 21, "thoma-c6", "thoma.go", .15),
} as const satisfies Record<string, SourceHostCharacterModifierDynamicDescriptor>;
