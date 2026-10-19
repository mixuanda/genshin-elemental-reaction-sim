/** Individually shared HealBonus, ReactBonus, and Cooldown Amount clauses. */
import { expr, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterScalarDescriptor } from "./source-host-character-scalar-formula";

const B4 = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const A7 = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd";
const both = [B4, A7] as const;
const v = expr.input;
const n = expr.value;
function table(index: FormulaExpression, values: readonly number[]): FormulaExpression {
  return values.reduceRight<FormulaExpression>((otherwise, value, i) => expr.condition("equal", index, n(i), n(value), otherwise), n(0));
}
const talent = { label: "原爆发天赋等级表索引", unit: "index", integer: true, minimum: 0, maximum: 14 } as const;
const furinaHeal = [.0001,.0002,.0003,.0004,.0005,.0006,.0007,.0008,.0009,.001,.0011,.0012,.0013,.0014,.0015] as const;
const kavehBloom = [.27488,.295496,.316112,.3436,.364216,.384832,.41232,.439808,.467296,.494784,.522272,.54976,.58412,.61848,.65284] as const;
const columbinaLunar = [.13,.16,.19,.22,.25,.28,.31,.34,.37,.4,.43,.46,.49,.52,.55] as const;
const action = { label: "原生冷却请求动作枚举", unit: "action", integer: true, minimum: 0, maximum: 16 } as const;
const sourceFile = (character: string, file: string) => `internal/characters/${character}/${file}`;

export const characterScalarRulesA = {
  "char-scalar-diona-c6-heal": { character: "diona", title: "迪奥娜 C6 受治疗加成", kind: "heal-bonus", modifierKey: "diona-c6-healbonus", sourceFile: sourceFile("diona", "cons.go"), sourceCommits: both, phase: "read", inputs: {}, expression: n(.3), explanation: "原生命门槛在爆发领域回调决定是否赋予 120 帧 modifier；debug 日志保留在 Go，Amount 每次返回 30%。" },
  "char-scalar-dori-c4-heal": { character: "dori", title: "多莉 C4 受治疗加成", kind: "heal-bonus", modifierKey: "dori-c4-healbonus", sourceFile: sourceFile("dori", "cons.go"), sourceCommits: both, phase: "read", inputs: {}, expression: n(.5), explanation: "原活跃角色生命低于一半的门槛决定 48 帧 modifier 创建；元素充能分支仍独立。" },
  "char-scalar-furina-burst-heal-ratio": { character: "furina", title: "芙宁娜爆发治疗倍率快照", kind: "heal-bonus", modifierKey: "furina-burst-heal-buff", sourceFile: sourceFile("furina", "burst.go"), sourceCommits: both, phase: "creation", inputs: { talent }, expression: table(v("talent"), furinaHeal), explanation: "Q 创建帧第二次天赋读取查原治疗倍率表；后续治疗读取只关联该回执。" },
  "char-scalar-furina-burst-heal": { character: "furina", title: "芙宁娜爆发受治疗加成", kind: "heal-bonus", modifierKey: "furina-burst-heal-buff", sourceFile: sourceFile("furina", "burst.go"), sourceCommits: both, phase: "read", inputs: { fanfare: { label: "当前气氛值", unit: "count" }, fanfareCap: { label: "原爆发气氛上限", unit: "count" }, talentRatio: { label: "Q 创建帧已关联的治疗倍率", unit: "ratio" } }, valueSources: { talentRatio: "char-scalar-furina-burst-heal-ratio" }, expression: expr.mul(expr.min(v("fanfare"), v("fanfareCap")), v("talentRatio")), explanation: "原爆发状态门槛通过后，当前气氛与创建帧倍率相乘；倍率的固定来源表及天赋索引在创建回执中。" },
  "char-scalar-qiqi-a1-heal": { character: "qiqi", title: "七七 A1 受治疗加成", kind: "heal-bonus", modifierKey: "qiqi-a1", sourceFile: sourceFile("qiqi", "asc.go"), sourceCommits: both, phase: "read", inputs: {}, expression: n(.2), explanation: "原反应事件、活跃受益者与八秒期限门槛仍由 Go 执行；Amount 返回 20%。" },
  "char-scalar-chongyun-c2-b4": { character: "chongyun", title: "重云 C2 冷却修正 b4", kind: "cooldown-factor", modifierKey: "chongyun-c2", sourceFile: sourceFile("chongyun", "skill.go"), sourceCommits: [B4], phase: "read", inputs: { action }, expression: expr.condition("equal", v("action"), n(1), n(-.15), expr.condition("equal", v("action"), n(2), n(-.15), n(0))), explanation: "b4 原动作枚举仅战技 1 或爆发 2 命中 -15% 分支，其它动作 0；领域和期限仍在 Go。" },
  "char-scalar-chongyun-c2-a7": { character: "chongyun", title: "重云 C2 冷却修正 a7", kind: "cooldown-factor", modifierKey: "chongyun-c2", sourceFile: sourceFile("chongyun", "skill.go"), sourceCommits: [A7], phase: "read", inputs: { action }, expression: expr.condition("equal", v("action"), n(1), n(-.15), expr.condition("equal", v("action"), n(2), n(-.15), expr.condition("equal", v("action"), n(14), n(-.15), n(0)))), explanation: "a7 除战技 1、爆发 2 外，原生 SpecialSkill 14 也命中 -15%；其它动作 0。" },
  "char-scalar-flins-a1-lunarcharged": { character: "flins", title: "菲林斯 A1 月感电加成", kind: "reaction-bonus", modifierKey: "flins-a1", sourceFile: sourceFile("flins", "asc.go"), sourceCommits: both, phase: "read", inputs: {}, expression: n(.2), explanation: "原月兆二级及直伤／反应月感电标签门槛后返回 20%；事件订阅随固定源码版本保留。" },
  "char-scalar-lauma-c2-lunarbloom": { character: "lauma", title: "菈乌玛 C2 月绽放加成", kind: "reaction-bonus", modifierKey: "lauma-c2-lunarbloom-buff", sourceFile: sourceFile("lauma", "cons.go"), sourceCommits: both, phase: "read", inputs: {}, expression: n(.4), explanation: "原 C2 与直伤月绽放标签门槛后返回 40%。" },
  "char-scalar-kaveh-burst-bloom": { character: "kaveh", title: "卡维爆发绽放加成", kind: "reaction-bonus", modifierKey: "kaveh-q-dmg-bonus", sourceFile: sourceFile("kaveh", "burst.go"), sourceCommits: both, phase: "read", inputs: { talent }, expression: table(v("talent"), kavehBloom), explanation: "原 Bloom 标签门槛后，在 Amount 当次读取爆发天赋索引并查来源倍率表。" },
  "char-scalar-kaveh-c4-bloom": { character: "kaveh", title: "卡维 C4 绽放加成", kind: "reaction-bonus", modifierKey: "kaveh-c4", sourceFile: sourceFile("kaveh", "cons.go"), sourceCommits: both, phase: "read", inputs: {}, expression: n(.6), explanation: "原 C4 已激活且 Bloom 标签门槛后返回 60%。" },
  "char-scalar-columbina-burst-lunar": { character: "columbina", title: "哥伦比娅爆发月反应加成", kind: "reaction-bonus", modifierKey: "columbina-q-buff", sourceFile: sourceFile("columbina", "burst.go"), sourceCommits: both, phase: "read", inputs: { talent }, expression: table(v("talent"), columbinaLunar), explanation: "保留两版各自 AttackTagIsLunar／IsLunar 门槛与 debug 日志，再按 Amount 当次天赋索引查来源表。" },
} as const satisfies Record<string, SourceHostCharacterScalarDescriptor>;
