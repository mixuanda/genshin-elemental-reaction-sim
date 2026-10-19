import { expr, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterShieldDescriptor } from "./source-host-character-shield-formula";
import type { SourceHostCharacterModifierDynamicParameter } from "./source-host-character-modifier-dynamic-formula";

const n = expr.value;
const v = expr.input;
function table(index: FormulaExpression, values: readonly number[]): FormulaExpression {
  return values.reduceRight<FormulaExpression>((otherwise, value, i) => expr.condition("equal", index, n(i), n(value), otherwise), n(0));
}
const commits = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const talentRatio = { label: "原式倍率表天赋等级索引", unit: "index", integer: true, minimum: 0, maximum: 14 } as const;
const talentFlat = { label: "原式固定值表天赋等级索引", unit: "index", integer: true, minimum: 0, maximum: 14 } as const;
const maxHp = { label: "原护盾写入点一次真实生命上限", unit: "HP" } as const;
const c1 = { label: "原生命座一分支", unit: "flag", integer: true, choices: [{ value: 0, label: "未解锁" }, { value: 1, label: "已解锁" }] } as const;
const shieldHpLeaf = { stateKey: "maxHp", getter: "max-hp", actor: "holder" } as const;
const beidouRatio = [0.144,0.1548,0.1656,0.18,0.1908,0.2016,0.216,0.2304,0.2448,0.2592,0.2736,0.288,0.306,0.324,0.342] as const;
const beidouFlat = [1386.3678,1525.0239,1675.2346,1837,2010.3201,2195.1948,2391.6243,2599.6084,2819.147,3050.2405,3292.8887,3547.0913,3812.8489,4090.161,4379.028] as const;
const candaceRatio = [0.12,0.129,0.138,0.15,0.159,0.168,0.18,0.192,0.204,0.216,0.228,0.24,0.255,0.27,0.285] as const;
const candaceFlat = [1155.5629,1271.1353,1396.3386,1531.173,1675.6384,1829.7349,1993.4624,2166.8208,2349.8105,2542.4312,2744.6826,2956.5652,3178.0789,3409.2236,3649.9995] as const;
const yunjinRatio = candaceRatio;
const yunjinFlat = [1155.4323,1270.9916,1396.1808,1531,1675.4491,1829.5282,1993.2372,2166.5762,2349.545,2542.1438,2744.3726,2956.2312,3177.72,3408.8384,3649.587] as const;
const laylaRatio = [0.108,0.1161,0.1242,0.135,0.1431,0.1512,0.162,0.1728,0.1836,0.1944,0.2052,0.216,0.2295,0.243,0.2565] as const;
const laylaFlat = [1040.007,1144.0221,1256.7052,1378.0562,1508.0751,1646.762,1794.1167,1950.1394,2114.83,2288.1887,2470.215,2660.9097,2860.272,3068.3022,3285.0005] as const;
const baizhuRatio = [0.008,0.0086,0.0092,0.01,0.0106,0.0112,0.012,0.0128,0.0136,0.0144,0.0152,0.016,0.017,0.018,0.019] as const;
const baizhuFlat = [77.03752,84.74235,93.08924,102.0782,111.70923,121.98233,132.89749,144.45473,156.65404,169.4954,182.97885,197.10435,211.87193,227.28157,243.3333] as const;
const hpInputs = (ratioName: string, flatName: string): Readonly<Record<string, SourceHostCharacterModifierDynamicParameter>> => ({
  [ratioName]: talentRatio, maxHp, [flatName]: talentFlat,
});
const basePlusRatio = (ratio: readonly number[], flat: readonly number[], ratioKey: string, flatKey: string) =>
  expr.add(expr.mul(table(v(ratioKey), ratio), v("maxHp")), table(v(flatKey), flat));

export const characterShieldGroupA = {
  "char-shield-beidou-skill": {
    character: "beidou", title: "北斗战技潮汐护盾", sourceFile: "internal/characters/beidou/skill.go", sourceCommits: commits,
    inputs: hpInputs("ratioTalent", "flatTalent"), statLeaf: shieldHpLeaf,
    expression: expr.add(expr.mul(table(v("ratioTalent"), beidouRatio), v("maxHp")), table(v("flatTalent"), beidouFlat)),
    explanation: "在战技原护盾创建处按倍率表×一次生命上限，再加固定值表；护盾命中时点与时长沿用来源。",
  },
  "char-shield-beidou-c1-burst": {
    character: "beidou", title: "北斗 C1 爆发护盾", sourceFile: "internal/characters/beidou/burst.go", sourceCommits: commits,
    inputs: { maxHp }, statLeaf: shieldHpLeaf,
    expression: expr.mul(n(0.16), v("maxHp")),
    explanation: "仅在原 C1 已解锁分支创建，以该位置一次生命上限读取计算 16% 护盾。",
  },
  "char-shield-candace-skill": {
    character: "candace", title: "坎蒂丝战技护盾", sourceFile: "internal/characters/candace/skill.go", sourceCommits: commits,
    inputs: hpInputs("ratioTalent", "flatTalent"), statLeaf: shieldHpLeaf,
    expression: basePlusRatio(candaceRatio, candaceFlat, "ratioTalent", "flatTalent"),
    explanation: "在战技原护盾创建处按倍率表×一次生命上限，再加固定值表；盾的解除帧不变。",
  },
  "char-shield-yunjin-skill": {
    character: "yunjin", title: "云堇战技护盾", sourceFile: "internal/characters/yunjin/skill.go", sourceCommits: commits,
    inputs: hpInputs("ratioTalent", "flatTalent"), statLeaf: shieldHpLeaf,
    expression: basePlusRatio(yunjinRatio, yunjinFlat, "ratioTalent", "flatTalent"),
    explanation: "在战技原护盾创建处按倍率表×一次生命上限，再加固定值表；蓄力和命中时序不变。",
  },
  "char-shield-layla-skill": {
    character: "layla", title: "莱依拉战技护盾", sourceFile: "internal/characters/layla/skill.go", sourceCommits: commits,
    inputs: { ...hpInputs("ratioTalent", "flatTalent"), c1 }, statLeaf: shieldHpLeaf,
    expression: expr.condition("equal", v("c1"), n(1),
      expr.mul(expr.add(table(v("flatTalent"), laylaFlat), expr.mul(table(v("ratioTalent"), laylaRatio), v("maxHp"))), n(1.2)),
      expr.add(table(v("flatTalent"), laylaFlat), expr.mul(table(v("ratioTalent"), laylaRatio), v("maxHp")))),
    explanation: "仅在来源判断为没有现存护盾、实际创建新盾时计算；先固定值+倍率×生命，再按 C1 原分支乘 1.2。刷新既有盾只改到期帧。",
  },
  "char-shield-baizhu-burst": {
    character: "baizhu", title: "白术无郤气护盾", sourceFile: "internal/characters/baizhu/burst.go", sourceCommits: commits,
    inputs: hpInputs("ratioTalent", "flatTalent"), statLeaf: shieldHpLeaf,
    expression: expr.add(expr.mul(table(v("ratioTalent"), baizhuRatio), v("maxHp")), table(v("flatTalent"), baizhuFlat)),
    explanation: "在每次无郤气护盾原创建处按倍率表×一次生命上限，再加固定值表；原有护盾触发灵脉与到期策略不变。",
  },
} as const satisfies Record<string, SourceHostCharacterShieldDescriptor>;
