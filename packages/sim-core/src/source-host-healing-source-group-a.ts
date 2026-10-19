import { expr, type FormulaExpression } from "./calculation-trace";
import type { SourceHostHealingSourceDescriptor } from "./source-host-healing-source-formula";
import type { SourceHostCharacterModifierDynamicParameter } from "./source-host-character-modifier-dynamic-formula";

const commits = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const n = expr.value;
const v = expr.input;
const hp = { label: "原 HealInfo.Src 运算点一次真实生命上限", unit: "HP" } as const;
const hpLeaf = { stateKey: "maxHp", getter: "max-hp", actor: "holder" } as const;
const ratio = { label: "原源码倍率表读取值", unit: "ratio" } as const;
const flat = { label: "原源码固定治疗表读取值", unit: "HP" } as const;
const source = (character: string, title: string, sourceFile: string, inputs: Readonly<Record<string, SourceHostCharacterModifierDynamicParameter>>,
  expression: FormulaExpression, explanation: string) => ({
    character, title, sourceFile, sourceCommits: commits, resultUnit: "HP" as const, inputs, expression, explanation,
    ...(Object.prototype.hasOwnProperty.call(inputs, "maxHp") ? { statLeaf: hpLeaf } : {}),
  });

export const healingSourceGroupA = {
  "heal-source-info-bonus-stats": {
    character: "*", title: "治疗附加加成原 Stats 快照", sourceFile: "pkg/core/player/character/stats.go",
    sourceCommits: commits, resultUnit: "ratio",
    inputs: { healBonus: { label: "原 Stats 结果中的 Heal 槽", unit: "ratio" } },
    statLeaf: { stateKey: "healBonus", getter: "stats-stat", statIndex: 11, actor: "holder" },
    expression: v("healBonus"),
    explanation: "转交来源先前 StatsWithProvenance 的一次 Stats 读取中 Heal 槽实际值；适用于延迟 HealInfo 沿用的班尼特与芭芭拉治疗快照。",
  },
  "heal-source-baizhu-burst": source("baizhu", "白术无郤气治疗", "internal/characters/baizhu/burst.go",
    { ratio, maxHp: hp, flat }, expr.add(expr.mul(v("ratio"), v("maxHp")), v("flat")),
    "原式读取 burstHealPP 与 burstHealFlat 两张爆发天赋表，以倍率×该次生命上限再加固定治疗值。"),
  "heal-source-baizhu-c2": source("baizhu", "白术命座二治疗", "internal/characters/baizhu/cons.go",
    { ratio, maxHp: hp, flat }, expr.mul(n(0.2), expr.add(expr.mul(v("ratio"), v("maxHp")), v("flat"))),
    "仅在原 C2 命中与冷却门控通过后执行；读取 skillHealPP 与 skillHealFlat，再将技能治疗乘 0.2。"),
  "heal-source-baizhu-skill": source("baizhu", "白术普度众生治疗", "internal/characters/baizhu/skill.go",
    { ratio, maxHp: hp, flat }, expr.add(expr.mul(v("ratio"), v("maxHp")), v("flat")),
    "沿用原代码以 TalentLvlBurst 索引 skillHealPP 与 skillHealFlat 的读表行为，再乘一次生命上限并加固定值。"),
  "heal-source-barbara-normal": source("barbara", "芭芭拉普通攻击治疗", "internal/characters/barbara/attack.go",
    { ratio, maxHp: hp, flat }, expr.add(expr.mul(v("ratio"), v("maxHp")), v("flat")),
    "敌方命中且 Melody Loop 尚存时执行；读取 prochpp 与 prochp 表并按原式计算。"),
  "heal-source-barbara-burst": source("barbara", "芭芭拉闪耀奇迹治疗", "internal/characters/barbara/burst.go",
    { flat, ratio, maxHp: hp }, expr.add(v("flat"), expr.mul(v("ratio"), v("maxHp"))),
    "爆发创建时读取 bursthp 与 bursthpp 天赋表和当次生命上限，延后 77 帧施加；Bonus 沿用原 Stats 快照。"),
  "heal-source-barbara-charge": source("barbara", "芭芭拉重击治疗", "internal/characters/barbara/charge.go",
    { ratio, maxHp: hp, flat }, expr.mul(n(4), expr.add(expr.mul(v("ratio"), v("maxHp")), v("flat"))),
    "仅在敌方命中且 Melody Loop 生效时执行；读取 prochpp 与 prochp 表，原式将单次治疗乘四。"),
  "heal-source-barbara-skill-tick": source("barbara", "芭芭拉演唱，开始治疗跳数", "internal/characters/barbara/skill.go",
    { flat, ratio, maxHp: hp }, expr.add(v("flat"), expr.mul(v("ratio"), v("maxHp"))),
    "技能施放时读取 skillhp 与 skillhpp 表及当次生命上限，将结果保存在周期治疗闭包；各 tick 沿用该保存值。"),
  "heal-source-bennett-burst": source("bennett", "班尼特美妙旅程治疗", "internal/characters/bennett/burst.go",
    { flat, ratio, maxHp: hp }, expr.add(v("flat"), expr.mul(v("ratio"), v("maxHp"))),
    "原 applyBennettField 调用读取 bursthp 与 bursthpp 表和一次生命上限；Heal Bonus 使用爆发创建时保存的 Stats 快照。"),
  "heal-source-chevreuse-c6": source("chevreuse", "夏沃蕾命座六团队治疗", "internal/characters/chevreuse/cons.go",
    { maxHp: hp }, expr.mul(n(0.1), v("maxHp")),
    "沿用原 C6 等待与排队门控，对夏沃蕾在 HealInfo 创建点的一次生命上限取 10%。"),
  "heal-source-chevreuse-skill": source("chevreuse", "夏沃蕾战技治疗", "internal/characters/chevreuse/skill.go",
    { ratio, maxHp: hp, flat }, expr.add(expr.mul(v("ratio"), v("maxHp")), v("flat")),
    "仅在原技能治疗状态存续的 tick 执行；读取 skillHpRegen 与 skillHpFlat 表并按原式计算。"),
  "heal-source-dehya-a4-initial": source("dehya", "迪希雅四命座突破天赋首次治疗", "internal/characters/dehya/asc.go",
    { maxHp: hp }, expr.mul(n(0.2), v("maxHp")),
    "只保留真实 HealInfo 的 20% 生命上限治疗；原 HP 门槛、冷却与事件订阅门控不变。"),
  "heal-source-dehya-a4-dot": source("dehya", "迪希雅四命座突破天赋持续治疗", "internal/characters/dehya/asc.go",
    { maxHp: hp }, expr.mul(n(0.06), v("maxHp")),
    "每个已排队的 A4 tick 在创建 HealInfo 时读取一次当前生命上限并乘 6%；保留五次计数和间隔。"),
  "heal-source-dehya-c4": source("dehya", "迪希雅命座四攻击命中治疗", "internal/characters/dehya/cons.go",
    { maxHp: hp }, expr.mul(n(0.025), v("maxHp")),
    "仅在原命座、敌方命中与内部冷却门控通过后执行，对该次生命上限取 2.5%。"),
  "heal-source-fischl-c4": source("fischl", "菲谢尔命座四治疗", "internal/characters/fischl/burst.go",
    { maxHp: hp }, expr.mul(n(0.2), v("maxHp")),
    "仅在原 C4 爆发分支创建并由命中回调调用时执行，对该次生命上限取 20%。"),
} as const satisfies Record<string, SourceHostHealingSourceDescriptor>;
