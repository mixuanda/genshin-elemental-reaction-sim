import { expr } from "./calculation-trace";
import type { SourceHostCharacterShieldDescriptor } from "./source-host-character-shield-formula";

const both = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const v = expr.input;
const maxHp = { label: "原写入点单次读取的最大生命值", unit: "HP" } as const;
const totalAtk = { label: "原写入点单次读取的总攻击力", unit: "ATK" } as const;
const ratio = { label: "原位置天赋表比例", unit: "ratio" } as const;
const flat = { label: "原位置天赋表固定值", unit: "HP" } as const;
const hpRead = { stateKey: "maxHp", getter: "max-hp", actor: "holder" } as const;
const atkRead = { stateKey: "totalAtk", getter: "total-atk", actor: "holder" } as const;
const hpFormula = expr.add(expr.mul(v("ratio"), v("maxHp")), v("flat"));
const atkFormula = expr.add(expr.mul(v("ratio"), v("totalAtk")), v("flat"));
const amount = { label: "同次原生护盾基础吸收量", unit: "HP" } as const;
const oldHP = { label: "原生旧盾本次 CurrentHP 读取值", unit: "HP" } as const;
const maximum = { label: "本次原生上限公式结果", unit: "HP" } as const;
const inherited = ["player-shield-hpAfter"] as const;

function rule(character: string, title: string, sourceFile: string,
  inputs: SourceHostCharacterShieldDescriptor["inputs"], expression: SourceHostCharacterShieldDescriptor["expression"],
  explanation: string, extras: Partial<SourceHostCharacterShieldDescriptor> = {}): SourceHostCharacterShieldDescriptor {
  return { character, title, sourceFile: `internal/characters/${character}/${sourceFile}`,
    sourceCommits: both, inputs, expression, explanation, ...extras };
}

export const characterShieldGroupB = {
  "char-shield-thoma-skill-base": rule("thoma", "托马战技护盾基础吸收量", "skill.go",
    { ratio, maxHp, flat }, hpFormula, "战技第九帧按原顺序读取比例表、最大生命值、固定表值；生成与一帧延迟保持原生。", { statLeaf: hpRead }),
  "char-shield-thoma-burst-base": rule("thoma", "托马爆发炽炎崩破护盾基础吸收量", "burst.go",
    { ratio, maxHp, flat }, hpFormula, "炽炎崩破命中回调只生成一次护盾，按原顺序读取两次天赋表与一次最大生命值。", { statLeaf: hpRead }),
  "char-shield-thoma-max": rule("thoma", "托马护盾叠加上限", "thoma.go",
    { ratio, maxHp, flat }, hpFormula, "仅已有托马护盾时才读取原上限表和一次最大生命值。", { statLeaf: hpRead }),
  "char-shield-thoma-stack": rule("thoma", "托马爆发护盾叠加", "shield.go",
    { amount, oldHP, maximum }, expr.min(expr.add(v("amount"), v("oldHP")), v("maximum")),
    "原有护盾存在时先读取 CurrentHP，加上本次炽炎崩破生成量，再按本次独立读取的上限截断；旧盾被伤害削减后的实值为本次输入。",
    { valueSources: { amount: "char-shield-thoma-burst-base", oldHP: [...inherited, "char-shield-thoma-skill-base", "char-shield-thoma-burst-base", "char-shield-thoma-stack", "char-shield-thoma-refresh"], maximum: "char-shield-thoma-max" } }),
  "char-shield-thoma-refresh": rule("thoma", "托马战技护盾刷新", "shield.go",
    { amount, oldHP, maximum }, expr.min(expr.max(v("amount"), v("oldHP")), v("maximum")),
    "战技刷新时取新旧护盾较大吸收量，再按本次上限截断；不将旧盾实值误作未受击初始量。",
    { valueSources: { amount: "char-shield-thoma-skill-base", oldHP: [...inherited, "char-shield-thoma-skill-base", "char-shield-thoma-burst-base", "char-shield-thoma-stack", "char-shield-thoma-refresh"], maximum: "char-shield-thoma-max" } }),

  "char-shield-kirara-base": rule("kirara", "绮良良战技护盾基础吸收量", "shield.go",
    { ratio, maxHp, flat }, hpFormula, "战技或 A1 生盾点先读取一次最大生命值与原战技天赋表。", { statLeaf: hpRead }),
  "char-shield-kirara-a1": rule("kirara", "绮良良 A1 强化包装护盾", "asc.go",
    { amount, stacks: { label: "原生强化包装层数", unit: "stack", integer: true, minimum: 0, maximum: 3 } },
    expr.mul(v("amount"), expr.value(0.2), v("stacks")),
    "原 A1 在原基础盾值读取后乘 20% 与当前层数，不重新读取最大生命值。",
    { valueSources: { amount: "char-shield-kirara-base" } }),
  "char-shield-kirara-max": rule("kirara", "绮良良护盾上限", "shield.go",
    { ratio, maxHp, flat }, hpFormula, "每次生成或叠加均在旧盾读取之后另读一次最大生命值，以来源最大吸收量表计算上限。", { statLeaf: hpRead }),
  "char-shield-kirara-create": rule("kirara", "绮良良新护盾上限截断", "shield.go",
    { amount, maximum }, expr.min(v("amount"), v("maximum")),
    "没有旧盾时仍按原生上限截断基础或 A1 护盾量。",
    { valueSources: { amount: ["char-shield-kirara-base", "char-shield-kirara-a1"], maximum: "char-shield-kirara-max" } }),
  "char-shield-kirara-refresh": rule("kirara", "绮良良护盾叠加与上限", "shield.go",
    { amount, oldHP, maximum }, expr.min(expr.add(v("amount"), v("oldHP")), v("maximum")),
    "旧盾存在时先将本次量与本次 CurrentHP 实值相加，再按新读取的上限截断。",
    { valueSources: { amount: ["char-shield-kirara-base", "char-shield-kirara-a1"], oldHP: [...inherited, "char-shield-kirara-create", "char-shield-kirara-refresh"], maximum: "char-shield-kirara-max" } }),

  "char-shield-lanyan-base": rule("lanyan", "蓝砚飞羽护盾基础吸收量", "shield.go",
    { ratio, totalAtk, flat }, atkFormula, "生成或刷新各自按原调用点读取一次总攻击力；刷新时两次调用拥有独立回执。", { statLeaf: atkRead }),
  "char-shield-lanyan-restore-fraction": rule("lanyan", "蓝砚二命护盾恢复份额", "shield.go",
    { amount, percent: { label: "原 C2 恢复比例", unit: "ratio" } }, expr.mul(v("amount"), v("percent")),
    "在查询旧盾存在性之前，原生先读取一次总攻击力并乘恢复比例；即使随后无盾也保留该已执行计算。",
    { valueSources: { amount: "char-shield-lanyan-base" } }),
  "char-shield-lanyan-restore": rule("lanyan", "蓝砚二命护盾刷新上限", "shield.go",
    { amount, oldHP, maximum }, expr.min(expr.add(v("amount"), v("oldHP")), v("maximum")),
    "读取旧盾 CurrentHP 后再独立第二次读取总攻击力求新上限，不把首次数值快照复用为第二次读取。",
    { valueSources: { amount: "char-shield-lanyan-restore-fraction", oldHP: [...inherited, "char-shield-lanyan-base", "char-shield-lanyan-restore"], maximum: "char-shield-lanyan-base" } }),

  "char-shield-dahlia-burst": rule("dahlia", "塔利雅圣宠之盾吸收量", "shield.go",
    { ratio, maxHp, flat }, hpFormula, "初始爆发护盾与原生破盾后再生共用同一写入点；每次均重新读取最大生命值和爆发天赋表。", { statLeaf: hpRead }),
} as const satisfies Record<string, SourceHostCharacterShieldDescriptor>;
