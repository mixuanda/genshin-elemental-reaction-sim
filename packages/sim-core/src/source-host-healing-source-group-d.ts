import { expr } from "./calculation-trace";
import type { SourceHostHealingSourceDescriptor } from "./source-host-healing-source-formula";

const both = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const v = expr.input;
const n = expr.value;
const hp = { label: "本次原生最大生命值单次读取", unit: "HP" } as const;
const em = { label: "本次原生元素精通单次读取", unit: "EM" } as const;
const ratio = { label: "原位置天赋表或保存比例", unit: "ratio" } as const;
const flat = { label: "原位置天赋表固定治疗量", unit: "HP" } as const;
const hpLeaf = { stateKey: "maxHp", getter: "max-hp", actor: "holder" } as const;
const emLeaf = { stateKey: "em", getter: "stat", statIndex: 8, actor: "holder" } as const;
const scaledHp = expr.mul(v("ratio"), v("maxHp"));
const hpPlusFlat = expr.add(scaledHp, v("flat"));

function rule(character: string, title: string, source: string, unit: "HP" | "ratio",
  inputs: SourceHostHealingSourceDescriptor["inputs"], expression: SourceHostHealingSourceDescriptor["expression"],
  explanation: string, extras: Partial<SourceHostHealingSourceDescriptor> = {}): SourceHostHealingSourceDescriptor {
  return { character, title, sourceFile: `internal/characters/${character}/${source}`,
    sourceCommits: both, resultUnit: unit, inputs, expression, explanation, ...extras };
}

export const healingSourceGroupD = {
  "heal-source-furina-a1": rule("furina", "芙宁娜 A1 持续百分比治疗", "asc.go", "ratio", {}, n(0.02),
    "A1 原有状态及来源帧门槛后，每次回调只写入 2% 比例；受益者最大生命值仍由共用治疗核心稍后读取。"),
  "heal-source-furina-c6-ousia": rule("furina", "芙宁娜六命荒性持续治疗", "cons.go", "HP", { maxHp: hp },
    expr.mul(n(0.04), v("maxHp")), "持续回调在原状态门后实时读取芙宁娜最大生命值；目标生命值不在此处读取。", { statLeaf: hpLeaf }),
  "heal-source-furina-singer": rule("furina", "芙宁娜众水歌者治疗", "skill.go", "HP", { flat, ratio, maxHp: hp },
    expr.add(v("flat"), scaledHp), "按原顺序读固定值表、比例表、一次最大生命值；每个歌者治疗 tick 独立取样。", { statLeaf: hpLeaf }),
  "heal-source-gaming-a1": rule("gaming", "嘉明 A1 百分比治疗", "asc.go", "ratio", {}, n(0.015),
    "原持续回调状态门及后续排程不变，写入目标最大生命值的 1.5% 比例。"),
  "heal-source-gaming-burst": rule("gaming", "嘉明爆发百分比治疗", "burst.go", "ratio", {}, n(0.3),
    "爆发起始任务在原命中帧写入 30% 比例；受益者最大生命值由后续共享治疗核心读取。"),
  "heal-source-gaming-c1": rule("gaming", "嘉明一命百分比治疗", "cons.go", "ratio", {}, n(0.15),
    "一命原门槛满足时写入 15% 比例，后续治疗核心按受益者最大生命值执行。"),
  "heal-source-hutao-burst": rule("hutao", "胡桃爆发预存治疗额", "burst.go", "HP", { maxHp: hp, ratio },
    expr.mul(v("maxHp"), v("ratio")), "施放时用同次最大生命值乘当前半血分支选出的原天赋回复比例，并把回执随保存的 HealInfo 留到命中回调消费。", { statLeaf: hpLeaf }),
  "heal-source-kaveh-a1": rule("kaveh", "卡维 A1 精通治疗", "asc.go", "HP", { em },
    expr.mul(n(3), v("em")), "原受击、反应标签和冷却门通过后仅读取一次元素精通，乘三作为治疗源额。", { statLeaf: emLeaf }),
  "heal-source-kuki-ring-a4": rule("kuki", "久岐忍越祓草轮治疗（A4）", "skill.go", "HP",
    { ratio, maxHp: hp, flat, em }, expr.add(hpPlusFlat, expr.mul(v("em"), n(0.75))),
    "按原式先读生命值比例表和最大生命值，再读固定值表；A4 已解锁时辅助函数另读一次精通并乘 75%。",
    { statLeaves: [hpLeaf, emLeaf] }),
  "heal-source-kuki-ring-no-a4": rule("kuki", "久岐忍越祓草轮治疗（未解锁 A4）", "skill.go", "HP",
    { ratio, maxHp: hp, flat }, hpPlusFlat,
    "A4 未解锁时辅助函数直接返回零，保持只有一次最大生命值读取，不添加精通 getter。", { statLeaf: hpLeaf }),
  "heal-source-lauma-c1": rule("lauma", "菈乌玛一命精通治疗缓存", "cons.go", "HP", { em },
    expr.mul(n(5), v("em")), "触发帧先读取一次元素精通并乘五，延迟任务消费该原值与同一回执，不在治疗帧重读精通。", { statLeaf: emLeaf }),
  "heal-source-lynette-skill": rule("lynette", "琳妮特战技命中治疗", "skill.go", "HP", { maxHp: hp },
    expr.mul(n(0.25), v("maxHp")), "首次命中敌人后在原回调读取一次最大生命值乘 25%；后续 HP 流失排程仍原生。", { statLeaf: hpLeaf }),
  "heal-source-lyney-skill": rule("lyney", "林尼战技盈余幻数治疗缓存", "skill.go", "HP",
    { maxHp: hp, stacks: { label: "清零前原盈余幻数层数", unit: "stack", integer: true, minimum: 0 } },
    expr.mul(n(0.2), v("maxHp"), v("stacks")),
    "创建治疗信息时先按当前最大生命值与清零前层数求值；延迟命中时不重读属性或层数。", { statLeaf: hpLeaf }),
  "heal-source-mizuki-snack": rule("mizuki", "梦见月瑞希点心拾取治疗", "snack.go", "HP",
    { em, ratio, flat, multiplier: { label: "原主动角色是否瑞希的治疗倍数", unit: "ratio", choices: [{ value: 1, label: "其他角色" }, { value: 2, label: "瑞希本人" }] } },
    expr.mul(expr.add(expr.mul(v("em"), v("ratio")), v("flat")), v("multiplier")),
    "原拾取判定后先读精通、爆发治疗比例表与固定值表，再按治疗对象取一倍或两倍。", { statLeaf: emLeaf }),
  "heal-source-neuvillette-droplet": rule("neuvillette", "那维莱特源水之滴治疗", "charge.go", "HP", { maxHp: hp },
    expr.mul(v("maxHp"), n(0.16)), "源水之滴被消耗后延迟五帧才读取最大生命值，并乘 16%。", { statLeaf: hpLeaf }),
  "heal-source-sigewinne-bubble": rule("sigewinne", "希格雯泡泡队友治疗", "skill.go", "HP", { ratio, maxHp: hp, flat },
    hpPlusFlat, "每个队友治疗循环各读取一次比例表、最大生命值和固定表值，保留逐人治疗及 C6 后续调用顺序。", { statLeaf: hpLeaf }),
  "heal-source-sigewinne-final": rule("sigewinne", "希格雯泡泡末段自身治疗", "skill.go", "HP", { maxHp: hp },
    expr.mul(n(0.5), v("maxHp")), "末段自身治疗独立读取一次最大生命值并乘来源固定 50% 比例。", { statLeaf: hpLeaf }),
  "heal-source-sigewinne-tier-bonus": rule("sigewinne", "希格雯泡泡层级混合治疗加成", "skill.go", "ratio",
    { healBonus: { label: "本次治疗属性单次读取", unit: "ratio" }, tier: { label: "本次泡泡层级", unit: "stack", integer: true, minimum: 0 } },
    expr.add(v("healBonus"), expr.mul(v("tier"), n(0.05))),
    "原生先按层级取得每层 5% 加成，构造 Bonus 字段时再读一次 Heal 属性；共享式给出两者合计。",
    { statLeaf: { stateKey: "healBonus", getter: "stat", statIndex: 11, actor: "holder" } }),
  "heal-source-wriothesley-a1": rule("wriothesley", "莱欧斯利 A1 重击治疗", "asc.go", "HP", { ratio, maxHp: hp },
    scaledHp, "A1 攻击命中门通过并清状态后，按当次保存的治疗比例乘实时最大生命值。", { statLeaf: hpLeaf }),
  "heal-source-wriothesley-c1": rule("wriothesley", "莱欧斯利 C1 重击治疗", "cons.go", "HP", { ratio, maxHp: hp },
    scaledHp, "C1 原状态、冷却及延长战技后，按保存的 30% 或 50% 治疗比例乘当次最大生命值。", { statLeaf: hpLeaf }),
} as const satisfies Record<string, SourceHostHealingSourceDescriptor>;
