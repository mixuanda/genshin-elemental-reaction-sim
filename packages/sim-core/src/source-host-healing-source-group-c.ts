import { expr } from "./calculation-trace";
import type { SourceHostHealingSourceDescriptor } from "./source-host-healing-source-formula";

const commits = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const v = expr.input;
const n = expr.value;
const flat = { label: "原治疗固定量表值", unit: "HP" } as const;
const ratio = { label: "原治疗倍率表值", unit: "ratio" } as const;
const totalAtk = { label: "原攻击快照或单次读取总攻击力", unit: "ATK" } as const;
const maxHp = { label: "原攻击快照或单次读取最大生命值", unit: "HP" } as const;
const totalDef = { label: "原攻击快照总防御力", unit: "DEF" } as const;
const atkSnapshot = { stateKey: "totalAtk", getter: "total-atk" } as const;
const atkRead = { stateKey: "totalAtk", getter: "total-atk", actor: "holder" } as const;
const hpSnapshot = { stateKey: "maxHp", getter: "total-hp" } as const;
const hpRead = { stateKey: "maxHp", getter: "max-hp", actor: "holder" } as const;
const defSnapshot = { stateKey: "totalDef", getter: "total-def" } as const;
const emRead = { stateKey: "em", getter: "stat", statIndex: 8, actor: "holder" } as const;
const atkFormula = expr.add(v("flat"), expr.mul(v("totalAtk"), v("ratio")));
const hpFormula = expr.add(expr.mul(v("ratio"), v("maxHp")), v("flat"));

function rule(character: string, title: string, file: string,
  inputs: SourceHostHealingSourceDescriptor["inputs"], expression: SourceHostHealingSourceDescriptor["expression"],
  explanation: string, extras: Partial<SourceHostHealingSourceDescriptor> = {}): SourceHostHealingSourceDescriptor {
  return { character, title, sourceFile: `internal/characters/${character}/${file}`,
    sourceCommits: commits, resultUnit: "HP", inputs, expression, explanation, ...extras };
}
function snapshotAtk(character: string, title: string, file: string, explanation: string): SourceHostHealingSourceDescriptor {
  return rule(character, title, file, { flat, totalAtk, ratio }, atkFormula, explanation, { snapshotLeaf: atkSnapshot });
}

export const healingSourceGroupC = {
  "heal-source-jean-a1": rule("jean", "琴 A1 顺风而行治疗源", "asc.go", { totalAtk },
    expr.mul(v("totalAtk"), n(0.15)),
    "原普通攻击命中后经过 50% 随机门槛，仅从该次攻击快照取总攻击力乘 15%。", { snapshotLeaf: atkSnapshot }),
  "heal-source-jean-burst-initial": snapshotAtk("jean", "琴爆发初始治疗源", "burst.go",
    "爆发施放时按 burstInitialHealFlat 与 burstInitialHealPer 两表及同一攻击快照求值，延迟初始治疗保留此值。"),
  "heal-source-jean-burst-dot": snapshotAtk("jean", "琴爆发领域周期治疗源", "burst.go",
    "爆发施放时按 burstDotHealFlat 与 burstDotHealPer 两表及同一攻击快照求值，后续领域周期治疗复用。"),
  "heal-source-kaeya-a1": rule("kaeya", "凯亚 A1 冷血之剑治疗源", "skill.go", { totalAtk },
    expr.mul(v("totalAtk"), n(0.15)), "原战技命中且 A1 门槛满足时，以该次命中攻击快照总攻击力乘 15%。",
    { snapshotLeaf: atkSnapshot }),
  "heal-source-kokomi-burst-base": rule("kokomi", "珊瑚宫心海爆发普重击治疗基础值", "burst.go",
    { ratio, maxHp, flat }, hpFormula,
    "原爆发命中回调先按 burstHealPct、一次 MaxHP 读取及 burstHealFlat 求基础治疗，随后对每名角色独立判断 C2。",
    { statLeaf: hpRead }),
  "heal-source-kokomi-burst-c2": rule("kokomi", "珊瑚宫心海爆发二命低血治疗", "burst.go",
    { baseHeal: { label: "同次命中已计算的基础治疗", unit: "HP" }, maxHp },
    expr.add(v("baseHeal"), expr.mul(n(0.006), v("maxHp"))),
    "仅原二命且该受益角色生命不高于一半时，另读一次心海 MaxHP，向基础治疗加 0.6%。",
    { statLeaf: hpRead, valueSources: { baseHeal: "heal-source-kokomi-burst-base" } }),
  "heal-source-kokomi-skill-tick": rule("kokomi", "珊瑚宫心海化海月周期治疗源", "skill.go",
    { ratio, maxHp, flat, c2: { label: "原二命且当前受益角色低血分支", unit: "flag", integer: true,
      choices: [{ value: 0, label: "未触发" }, { value: 1, label: "触发" }] } },
    expr.condition("equal", v("c2"), n(1),
      expr.add(hpFormula, expr.mul(n(0.045), v("maxHp"))), hpFormula),
    "原海月快照 MaxHP 只读一次；先按 skillHealPct/skillHealFlat 求基础值，二命低血分支再加同一 MaxHP 的 4.5%。",
    { snapshotLeaf: hpSnapshot }),
  "heal-source-noelle-skill-attack": rule("noelle", "诺艾尔护心铠攻击治疗源", "skill.go",
    { ratio, totalDef, flat }, expr.add(expr.mul(v("ratio"), v("totalDef")), v("flat")),
    "原护盾有效、概率门槛满足后，从触发攻击快照取总防御力，按 shieldHeal 与 shieldHealFlat 两表计算。",
    { snapshotLeaf: defSnapshot }),
  "heal-source-qiqi-talisman": rule("qiqi", "七七度厄真符动态治疗源", "qiqi.go",
    { flat, totalAtk, ratio }, atkFormula,
    "原 healDynamic 在真符命中触发时读取一次当前总攻击力，再按 burstHealFlat 与 burstHealPer 两表计算。",
    { statLeaf: atkRead }),
  "heal-source-qiqi-skill-attack": snapshotAtk("qiqi", "七七寒病鬼差攻击治疗源", "qiqi.go",
    "原 healSnapshot 从保存的 skillHealSnapshot 取总攻击力，按 skillHealOnHitFlat 与 skillHealOnHitPer 两表计算。"),
  "heal-source-qiqi-skill-initial": snapshotAtk("qiqi", "七七寒病鬼差首次治疗源", "qiqi.go",
    "原战技施放回调先建立攻击快照，healSnapshot 用 skillHealContFlat 与 skillHealContPer 两表求首次治疗。"),
  "heal-source-qiqi-skill-tick": snapshotAtk("qiqi", "七七寒病鬼差周期治疗源", "qiqi.go",
    "原 skillHealSnapshot 在施放时保存，后续 healSnapshot 从该快照读取总攻击力，用 skillHealContFlat 与 skillHealContPer 两表求值。"),
  "heal-source-qiqi-c4-stellar": rule("qiqi", "七七星辉四命度厄真符治疗源", "cons.go",
    { totalAtk }, expr.mul(n(1.8), v("totalAtk")),
    "仅星辉来源 C4 回调实际执行时读取一次当前总攻击力，并乘固定 1.8。",
    { statLeaf: atkRead, sourceCommits: [commits[1]] }),
  "heal-source-sayu-a1": rule("sayu", "早柚 A1 扩散治疗源", "asc.go",
    { em: { label: "原扩散回调一次元素精通读取", unit: "EM" } },
    expr.add(n(300), expr.mul(v("em"), n(1.2))),
    "原扩散、在场和冷却门槛后读取一次 EM，按 300+1.2×EM 求全队治疗。", { statLeaf: emRead }),
  "heal-source-sayu-burst-initial": snapshotAtk("sayu", "早柚爆发初始治疗源", "burst.go",
    "爆发初始快照总攻击力与 initHealFlat、initHealPP 两表在原治疗点求值。"),
  "heal-source-sayu-burst-tick": rule("sayu", "早柚不倒貉貉周期治疗源", "burst.go",
    { flat, totalAtk, ratio }, atkFormula,
    "未解锁六命时，不倒貉貉建立时从独立快照读取总攻击力，与 burstHealFlat、burstHealPP 两表求值并由周期治疗复用。",
    { snapshotLeaf: atkSnapshot }),
  "heal-source-sayu-burst-tick-c6": rule("sayu", "早柚六命不倒貉貉周期治疗源", "burst.go",
    { flat, totalAtk, ratio, em: { label: "不倒貉貉原快照元素精通", unit: "EM" } },
    expr.add(atkFormula, expr.min(expr.mul(v("em"), n(3)), n(6000))),
    "原六命分支在独立快照总攻击力治疗基础上，再按同快照 EM×3 与 6000 的最小值增加治疗，周期复用。",
    { snapshotLeaves: [atkSnapshot, { stateKey: "em", getter: "em" }] }),
  "heal-source-gorou-field-def": rule("gorou", "五郎四命领域防御缓存来源", "burst.go",
    { totalDef: { label: "原领域初始化完整 Stats 读取的总防御力", unit: "DEF" } }, v("totalDef"),
    "原爆发初击帧的 Stats() 完整读取只执行一次，缓存到 healFieldStats；此 ID 保存其 DEF 数值以供后续周期治疗引用。",
    { resultUnit: "DEF", statLeaf: { stateKey: "totalDef", getter: "stats-total-def", actor: "holder" } }),
  "heal-source-gorou-field-tick": rule("gorou", "五郎四命领域周期治疗源", "burst.go",
    { savedDef: { label: "原 healFieldStats 保存的总防御力", unit: "DEF" } },
    expr.mul(v("savedDef"), n(0.5)),
    "原领域每 90 帧读取保存的 healFieldStats 总防御力乘 50%，不重新执行角色 Stats getter。",
    { valueSources: { savedDef: "heal-source-gorou-field-def" } }),
} as const satisfies Record<string, SourceHostHealingSourceDescriptor>;
