import { expr } from "./calculation-trace";
import type { SourceHostHealingSourceDescriptor } from "./source-host-healing-source-formula";

const both = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const v = expr.input;
const ratio = { label: "原位置天赋表比例", unit: "ratio" } as const;
const flat = { label: "原位置天赋表固定值", unit: "HP" } as const;
const maxHp = { label: "原位置最大生命值读取", unit: "HP" } as const;
const totalAtk = { label: "原位置总攻击力读取", unit: "ATK" } as const;
const scale = { label: "原位置治疗倍率", unit: "ratio" } as const;
const atkRead = { stateKey: "totalAtk", getter: "total-atk", actor: "holder" } as const;
const hpRead = { stateKey: "maxHp", getter: "max-hp", actor: "holder" } as const;
const snapAtk = { stateKey: "totalAtk", getter: "total-atk" } as const;
const hpRatioFlat = expr.add(expr.mul(v("ratio"), v("maxHp")), v("flat"));
const atkFlatRatio = expr.add(v("flat"), expr.mul(v("totalAtk"), v("ratio")));

function rule(character: string, title: string, sourceFile: string,
  inputs: SourceHostHealingSourceDescriptor["inputs"], expression: SourceHostHealingSourceDescriptor["expression"],
  explanation: string, extras: Partial<SourceHostHealingSourceDescriptor> = {}): SourceHostHealingSourceDescriptor {
  return { character, title, sourceFile: `internal/characters/${character}/${sourceFile}`,
    sourceCommits: both, resultUnit: "HP", inputs, expression, explanation, ...extras };
}

export const healingSourceGroupB = {
  "heal-source-charlotte-burst-initial": rule("charlotte", "夏洛蒂元素爆发初始治疗", "burst.go",
    { flat, totalAtk, ratio }, atkFlatRatio,
    "爆发启动点先从原快照读取一次总攻击力，再按顺序读取固定表值并计算 flat + atk*ratio；结果与治疗加成快照一同跨帧保存。",
    { snapshotLeaf: snapAtk }),
  "heal-source-charlotte-burst-dot": rule("charlotte", "夏洛蒂元素爆发持续治疗", "burst.go",
    { flat, totalAtk, ratio }, atkFlatRatio,
    "爆发启动点共用原攻击快照总攻击力，各持续治疗量在排入任务前计算并随任务保存；保留 flat + atk*ratio 的原顺序。",
    { snapshotLeaf: snapAtk }),
  "heal-source-charlotte-c1": rule("charlotte", "夏洛蒂一命周期治疗", "cons.go",
    { ratio, totalAtk }, expr.mul(v("totalAtk"), v("ratio")),
    "一命周期回调实际触发时读取一次总攻击力，乘固定 0.8；门控与后续排程不变。", { statLeaf: atkRead }),
  "heal-source-charlotte-c6": rule("charlotte", "夏洛蒂六命协同治疗", "cons.go",
    { ratio, totalAtk }, expr.mul(v("totalAtk"), v("ratio")),
    "六命范围检查通过后读取一次总攻击力并乘固定 0.42；保持原生范围门控。", { statLeaf: atkRead }),

  "heal-source-diona-burst": rule("diona", "迪奥娜元素爆发持续治疗", "burst.go",
    { ratio, maxHp, flat }, hpRatioFlat,
    "爆发创建时读取一次最大生命值与两个天赋表值并保存 Src；后续各 tick 沿用该来源量。", { statLeaf: hpRead }),

  "heal-source-dori-burst": rule("dori", "多莉元素爆发持续治疗", "burst.go",
    { ratio, maxHp, flat }, hpRatioFlat,
    "每次连接治疗在原区域门控后读取一次实时最大生命值，再依次计算比例乘生命值并加固定表值。", { statLeaf: hpRead }),
  "heal-source-dori-c6": rule("dori", "多莉六命治疗", "cons.go",
    { ratio, maxHp }, expr.mul(v("ratio"), v("maxHp")),
    "六命 ICD 门控通过后读取一次实时最大生命值并乘源码字面常量 0.04。", { statLeaf: hpRead }),

  "heal-source-escoffier-a1": rule("escoffier", "爱可菲固有天赋一治疗", "asc.go",
    { scale, totalAtk }, expr.mul(v("scale"), v("totalAtk")),
    "原 A1 来源及版本门控通过后先计算 a1Scaling + c4ExtraHeal，再读取一次总攻击力并相乘；保留辅助函数既有状态读取。", { statLeaf: atkRead }),
  "heal-source-escoffier-burst": rule("escoffier", "爱可菲元素爆发初始治疗", "burst.go",
    { flat, ratio, totalAtk }, expr.add(v("flat"), expr.mul(v("ratio"), v("totalAtk"))),
    "初始治疗任务执行时按原顺序读取固定表值、比例表值和一次总攻击力，并计算 flat + ratio*atk。", { statLeaf: atkRead }),

  "heal-source-xianyun-burst-initial": rule("xianyun", "闲云元素爆发初始治疗", "burst.go",
    { ratio, totalAtk, flat }, expr.add(expr.mul(v("ratio"), v("totalAtk")), v("flat")),
    "初始治疗点依序读取比例表、实时总攻击力与固定表值，计算 ratio*atk + flat。", { statLeaf: atkRead }),
  "heal-source-xianyun-burst-dot": rule("xianyun", "闲云元素爆发持续治疗", "burst.go",
    { ratio, totalAtk, flat }, expr.add(expr.mul(v("ratio"), v("totalAtk")), v("flat")),
    "持续治疗回调每次按原顺序读取比例表、实时总攻击力与固定表值；保留每次独立读取。", { statLeaf: atkRead }),
  "heal-source-xianyun-c4": rule("xianyun", "闲云四命治疗", "cons.go",
    { ratio, totalAtk }, expr.mul(v("ratio"), v("totalAtk")),
    "四命既有触发与 ICD 门控通过后按 c.skillCounter 读取比例表，再读取一次总攻击力。", { statLeaf: atkRead }),

  "heal-source-mika-burst-initial": rule("mika", "米卡元素爆发初始治疗", "burst.go",
    { flat, ratio, maxHp }, expr.add(v("flat"), expr.mul(v("ratio"), v("maxHp"))),
    "初始治疗任务执行时按原顺序读取固定值、比例值及一次实时最大生命值，计算 flat + ratio*maxHP。", { statLeaf: hpRead }),
  "heal-source-mika-eagleplume": rule("mika", "米卡苍翎治疗", "burst.go",
    { flat, ratio, maxHp }, expr.add(v("flat"), expr.mul(v("ratio"), v("maxHp"))),
    "命中、治疗 ICD 和目标角色确定后按原顺序读取固定值、比例值及一次实时最大生命值，计算 flat + ratio*maxHP。", { statLeaf: hpRead }),
} as const satisfies Record<string, SourceHostHealingSourceDescriptor>;
