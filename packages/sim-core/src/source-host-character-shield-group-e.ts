/** Bell and Crystallize share the same source-backed shield calculation lane. */
import { expr, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterShieldDescriptor } from "./source-host-character-shield-formula";
const commits = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const n = expr.value, v = expr.input;
// NewShield clamps its zero-based lookup to 0..99, even though the source table is longer.
const shieldBaseHP = [91.1791, 98.707664, 106.23622, 113.76477, 121.29332, 128.82188, 136.35042, 143.87898, 151.40752, 158.93608, 169.99149, 181.07625, 192.19037, 204.0482, 215.939, 227.86275, 247.68594, 267.5421, 287.4312, 303.82642, 320.22522, 336.62762, 352.31927, 368.01093, 383.70255, 394.43237, 405.18146, 415.94992, 426.73764, 437.5447, 450.6, 463.7003, 476.84558, 491.1275, 502.55457, 514.0121, 531.4096, 549.9796, 568.5849, 584.9965, 605.67035, 626.3862, 646.0523, 665.7556, 685.4961, 700.8394, 723.3331, 745.8653, 768.4357, 786.79193, 809.5388, 832.32904, 855.16266, 878.0396, 899.4848, 919.362, 946.0396, 974.7642, 1003.5786, 1030.077, 1056.635, 1085.2463, 1113.9244, 1149.2587, 1178.0648, 1200.2238, 1227.6603, 1257.243, 1284.9174, 1314.7529, 1342.6652, 1372.7524, 1396.321, 1427.3124, 1458.3745, 1482.3358, 1511.9109, 1541.5493, 1569.1537, 1596.8143, 1622.4197, 1648.074, 1666.3761, 1684.6782, 1702.9803, 1726.1047, 1754.6715, 1785.8666, 1817.1375, 1851.0603, 1885.0671, 1921.7493, 1958.5233, 2006.1941, 2041.569, 2054.4722, 2065.975, 2174.7227, 2186.7683, 2198.814] as const;
const index = expr.clamp(expr.sub(v("level"), n(1)), n(0), n(99));
const baseHP = shieldBaseHP.reduceRight<FormulaExpression>((otherwise, hp, i) =>
  expr.condition("equal", index, n(i), n(hp), otherwise), n(0));
export const characterShieldGroupE = {
  "char-shield-bell": {
    character: "*", title: "钟剑受伤触发护盾生命值", sourceFile: "internal/weapons/claymore/bell/bell.go", sourceCommits: commits,
    inputs: { refinement: { label: "原武器精炼等级", unit: "level", integer: true, minimum: 1, maximum: 5 }, maxHp: { label: "持有者原位置生命上限读取", unit: "HP" } },
    statLeaf: { stateKey: "maxHp", getter: "max-hp", actor: "holder" },
    expression: expr.mul(expr.add(n(.17), expr.mul(v("refinement"), n(.03))), v("maxHp")),
    explanation: "在原外部伤害、正扣血与冷却门控后，以精炼系数乘持有者生命上限写入钟剑护盾；不改变原触发顺序。",
  },
  "char-shield-crystallize-base": {
    character: "*", title: "结晶盾等级基础生命值", sourceFile: "internal/template/crystallize/shield.go", sourceCommits: commits,
    inputs: { level: { label: "碎片生成时原快照角色等级", unit: "level", integer: true } },
    expression: baseHP,
    explanation: "保留固定源码先等级减一、再夹到 0 至 99 的查表规则；该原始 HP 在碎片生成时保存，拾取只改变盾期限。",
  },
  "char-shield-crystallize-em": {
    character: "*", title: "结晶盾生成时精通吸收加成", sourceFile: "internal/template/crystallize/shield.go", sourceCommits: commits,
    inputs: { em: { label: "碎片生成时原快照元素精通", unit: "EM" } },
    snapshotLeaf: { stateKey: "em", getter: "em" }, resultUnit: "ratio",
    expression: expr.mul(expr.div(n(40), n(9)), expr.div(v("em"), expr.add(n(1400), v("em")))),
    explanation: "原生在碎片生成时保存精通加成，之后拾取与受击不会重读当前精通；保持原乘除顺序。",
  },
  "char-shield-crystallize-bonus-total": {
    character: "*", title: "结晶盾本次受击总吸收加成", sourceFile: "internal/template/crystallize/shield.go", sourceCommits: commits,
    inputs: { handlerBonus: { label: "护盾管理器本次单读护盾强效", unit: "ratio" }, emBonus: { label: "碎片生成时保存的精通加成", unit: "ratio" } },
    valueSources: { emBonus: "char-shield-crystallize-em" }, resultUnit: "ratio",
    expression: expr.add(v("handlerBonus"), v("emBonus")),
    explanation: "结晶盾原 OnDamage 在通用护盾消耗前，将本次护盾强效加上先前保存的精通加成；这个结果作为真实吸收公式实参。",
  },
} as const satisfies Record<string, SourceHostCharacterShieldDescriptor>;
