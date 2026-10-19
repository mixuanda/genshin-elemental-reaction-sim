/** Native shield HP assignments for the remaining D-group characters. */
import { expr, type FormulaExpression } from "./calculation-trace";
import type { SourceHostCharacterShieldDescriptor } from "./source-host-character-shield-formula";

const both = ["b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541", "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd"] as const;
const n = expr.value;
const v = expr.input;
const talentRatio = { label: "原系数天赋表索引", unit: "index", integer: true, minimum: 0, maximum: 14 } as const;
const talentFlat = { label: "原固定值天赋表索引", unit: "index", integer: true, minimum: 0, maximum: 14 } as const;
const maxHp = { label: "原位置生命上限读取", unit: "HP" } as const;
const totalAtk = { label: "原位置总攻击力读取", unit: "ATK" } as const;
const em = { label: "原位置元素精通读取", unit: "EM" } as const;
const hpLeaf = { stateKey: "maxHp", getter: "max-hp", actor: "holder" } as const;
const atkLeaf = { stateKey: "totalAtk", getter: "total-atk", actor: "holder" } as const;
const emLeaf = { stateKey: "em", getter: "stat", statIndex: 8, actor: "holder" } as const;
const atkRatios = [2.21184, 2.377728, 2.543616, 2.7648, 2.930688, 3.096576, 3.31776, 3.538944, 3.760128, 3.981312, 4.202496, 4.42368, 4.70016, 4.97664, 5.25312] as const;
const nicoleFlat = [1386.6697, 1525.356, 1675.5994, 1837.4, 2010.7578, 2195.6729, 2392.145, 2600.1743, 2819.761, 3050.9045, 3293.6055, 3547.8638, 3813.679, 4091.0515, 4379.981] as const;
const otherFlat = [1386.6759, 1525.3628, 1675.6068, 1837.4082, 2010.7667, 2195.6826, 2392.1558, 2600.186, 2819.7734, 3050.9182, 3293.6204, 3547.8796, 3813.696, 4091.0698, 4380.0005] as const;
const citlaliRatios = [5.76, 6.192, 6.624, 7.2, 7.632, 8.064, 8.64, 9.216, 9.792, 10.368, 10.944, 11.52, 12.24, 12.96, 13.68] as const;
function table(key: string, values: readonly number[]): FormulaExpression {
  return values.reduceRight<FormulaExpression>((otherwise, value, index) =>
    expr.condition("equal", v(key), n(index), n(value), otherwise), n(0));
}
function simple(character: string, title: string, sourceFile: string, ratio: number): SourceHostCharacterShieldDescriptor {
  return { character, title, sourceFile, sourceCommits: both, inputs: { maxHp },
    statLeaf: hpLeaf, expression: expr.mul(n(ratio), v("maxHp")),
    explanation: "原星座与技能门槛通过后，在护盾创建或刷新写入点读取一次生命上限，写入真实护盾 HP。" };
}

export const characterShieldGroupD = {
  "char-shield-nicole-skill": {
    character: "nicole", title: "尼可战技护盾生命值", sourceFile: "internal/characters/nicole/shield.go", sourceCommits: both,
    inputs: { talentRatio, totalAtk, talentFlat }, statLeaf: atkLeaf,
    expression: expr.add(expr.mul(table("talentRatio", atkRatios), v("totalAtk")), table("talentFlat", nicoleFlat)),
    explanation: "原战技等级表系数、同位置一次总攻击力读取与尼可专用固定值表相加；创建原生护盾。",
  },
  "char-shield-citlali-skill": {
    character: "citlali", title: "茜特菈莉战技护盾生命值", sourceFile: "internal/characters/citlali/shield.go", sourceCommits: both,
    inputs: { em, talentRatio, talentFlat }, statLeaf: emLeaf,
    expression: expr.add(expr.mul(table("talentRatio", citlaliRatios), v("em")), table("talentFlat", otherFlat)),
    explanation: "原位置一次元素精通读取后，按战技等级表计算并写入原生护盾。",
  },
  "char-shield-ineffa-skill": {
    character: "ineffa", title: "伊涅芙战技护盾生命值", sourceFile: "internal/characters/ineffa/shield.go", sourceCommits: both,
    inputs: { totalAtk, talentRatio, talentFlat }, statLeaf: atkLeaf,
    expression: expr.add(expr.mul(table("talentRatio", atkRatios), v("totalAtk")), table("talentFlat", otherFlat)),
    explanation: "原位置一次总攻击力读取后，按战技等级表计算并写入原生护盾；随后原 C1 回调照常执行。",
  },
  "char-shield-sigewinne-c2": simple("sigewinne", "希格雯二命护盾生命值", "internal/characters/sigewinne/shield.go", .3),
  "char-shield-yanfei-c4": simple("yanfei", "烟绯四命护盾生命值", "internal/characters/yanfei/cons.go", .45),
  "char-shield-columbina-c1": simple("columbina", "哥伦比娅一命雨海护盾生命值", "internal/characters/columbina/cons.go", .12),
  "char-shield-kaeya-c4": simple("kaeya", "凯亚四命冰吻护盾生命值", "internal/characters/kaeya/cons.go", .3),
  "char-shield-traveler-hydro-c4-refresh": simple("hydro-traveler", "水主四命护盾刷新生命值", "internal/characters/traveler/common/hydro/cons.go", .1),
  "char-shield-traveler-hydro-c4-create": simple("hydro-traveler", "水主四命护盾创建生命值", "internal/characters/traveler/common/hydro/cons.go", .1),
} as const satisfies Record<string, SourceHostCharacterShieldDescriptor>;
