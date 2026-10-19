import { expr } from "./calculation-trace";
import type { SourceHostDrainSourceDescriptor } from "./source-host-drain-source-formula";

const sourceCommits = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const v = expr.input;
const n = expr.value;
const currentHp = { label: "原 DrainInfo.Amount 写入点一次 CurrentHP 读取", unit: "HP" } as const;
const maxHp = { label: "原 DrainInfo.Amount 写入点一次 MaxHP 读取", unit: "HP" } as const;
const ratio = { label: "沙龙侍从原始扣血比例", unit: "ratio", choices: [
  { value: 0.016, label: "Chevalmarin：1.6%" },
  { value: 0.024, label: "Usher：2.4%" },
  { value: 0.036, label: "Crabaletta：3.6%" },
] } as const;
const maxHpHolderLeaf = { stateKey: "maxHp", getter: "max-hp", actor: "holder" } as const;

function rule(character: string, title: string, sourceFile: string,
  inputs: SourceHostDrainSourceDescriptor["inputs"], expression: SourceHostDrainSourceDescriptor["expression"],
  explanation: string, extras: Partial<SourceHostDrainSourceDescriptor> = {}): SourceHostDrainSourceDescriptor {
  return { character, title, sourceFile: `internal/characters/${character}/${sourceFile}`,
    sourceCommits, resultUnit: "HP", inputs, expression, explanation, ...extras };
}

const cappedDrain = (baseRatio: number, threshold: number) => expr.condition("lte",
  expr.div(expr.sub(v("currentHp"), expr.mul(n(baseRatio), v("maxHp"))), v("maxHp")), n(threshold),
  expr.sub(v("currentHp"), expr.mul(n(threshold), v("maxHp"))), expr.mul(n(baseRatio), v("maxHp")));
const cappedCurrentHpDrain = (baseRatio: number, threshold: number) => expr.condition("lte",
  expr.div(expr.sub(v("currentHp"), expr.mul(n(baseRatio), v("currentHp"))), v("maxHp")), n(threshold),
  expr.sub(v("currentHp"), expr.mul(n(threshold), v("maxHp"))), expr.mul(n(baseRatio), v("currentHp")));

export const drainSourceGroupA = {
  "drain-source-furina-c6-pneuma": rule("furina", "芙宁娜命座六荒性自耗生命", "cons.go",
    { currentHp }, expr.mul(n(0.01), v("currentHp")),
    "仅在原 C6 荒性分支逐名册成员执行；每次 Drain 前读取该成员一次 CurrentHP 并乘字面常量 0.01，队伍遍历顺序和扣血者身份不变。"),
  "drain-source-furina-skill": rule("furina", "芙宁娜沙龙侍从团队生命消耗", "skill.go",
    { ratio, maxHp }, expr.mul(v("maxHp"), v("ratio")),
    "只对 CurrentHPRatio 大于 0.5 的队员执行；保留被动计数先增、主动角色处于爆发状态时跳过 Drain 的源码顺序。三种实际调用参数分别是 Chevalmarin 0.016、Usher 0.024、Crabaletta 0.036；每次在 Drain 前读取该队员一次 MaxHP。", {
      statLeaf: { stateKey: "maxHp", getter: "max-hp", actor: "native" },
    }),
  "drain-source-gaming-plunge": rule("gaming", "嘉明战技强化下落生命消耗", "plunge.go",
    { currentHp, maxHp }, cappedDrain(0.15, 0.1),
    "只在命中后一帧且当前生命比例大于 0.1 时执行；先读取一次 CurrentHP 再读取一次 MaxHP。原条件 `(currentHP - 0.15*maxHP)/maxHP <= 0.1` 选择将 Amount 封顶为 `currentHP - 0.1*maxHP` 的分支，保证至少保留 10% MaxHP。", {
      statLeaf: maxHpHolderLeaf,
    }),
  "drain-source-hutao-skill": rule("hutao", "胡桃蝶引来生启动生命消耗", "skill.go",
    { currentHp }, expr.mul(n(0.3), v("currentHp")),
    "沿用技能激活时、排队 A1 任务之后的原位置读取一次 CurrentHP，并按源码字面常量 0.30 计算；随后仍先 Drain 再创建零伤害攻击。"),
  "drain-source-kuki-skill": rule("kuki", "久岐忍越祓草轮生命消耗", "skill.go",
    { currentHp, maxHp }, cappedCurrentHpDrain(0.3, 0.2),
    "仅在原 CurrentHPRatio 大于 0.2 的分支执行；保留 CurrentHP 后 MaxHP 的读取顺序。原条件 `(currentHP - 0.3*currentHP)/maxHP <= 0.2` 选择 `currentHP - 0.2*maxHP` 封顶分支，至少保留 20% MaxHP。", {
      statLeaf: maxHpHolderLeaf,
    }),
  "drain-source-lynette-skill": rule("lynette", "琳妮特战技后周期生命消耗", "skill.go",
    { currentHp }, expr.mul(n(0.06), v("currentHp")),
    "count 递增到 4 时原函数先返回、不产生 Drain；其余每次排队 tick 在 Drain 前读取一次实时 CurrentHP 并乘 0.06，下一 tick 仍沿用原一秒间隔。"),
  "drain-source-lyney-prop-surplus": rule("lyney", "林尼二段蓄力生命消耗", "aimed.go",
    { currentHp, maxHp }, cappedDrain(0.2, 0.6),
    "保留原 CurrentHPRatio 低于 0.6 的跳过和 0.6 附近容差拒绝分支；通过后先读一次 CurrentHP，再读一次 MaxHP。原条件 `(currentHP - 0.2*maxHP)/maxHP <= 0.6` 选择将 Amount 封顶到 `currentHP - 0.6*maxHP`，随后才增加 Prop Surplus 层数。", {
      statLeaf: maxHpHolderLeaf,
    }),
} as const satisfies Record<string, SourceHostDrainSourceDescriptor>;
