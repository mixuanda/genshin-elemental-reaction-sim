import type { CalculatorFormula } from "./calculator-model";
import { expr } from "./calculation-trace";

const root = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters";
export const KEQING_BURST_SOURCE_REFS = ["burst.go", "asc.go", "cons.go", "keqing.go", "zz_keqing.dm.go", "attack.go", "charge.go", "skill.go"].map((file) => `${root}/keqing/${file}`);
export const XINGQIU_SKILL_SOURCE_REFS = ["skill.go", "asc.go", "burst.go", "xingqiu.go", "zz_xingqiu.dm.go"].map((file) => `${root}/xingqiu/${file}`);
const input = (key: string, value: number, origin = "source-rule", unit = "ratio") => ({ key, value, origin, unit, meaningKey: `input.${key}` });

export function createKeqingA4CritRateFormula(ascension: number, included: boolean): CalculatorFormula {
  return {
    ruleId: "keqing-q-a4-critical-rate-accounting-gcsim-b4ae769", label: "刻晴 Q 先触发 A4：15% 暴击率减去面板已含份额",
    expression: expr.mul(expr.input("keqingA4Rate"), expr.sub(expr.input("keqingA4Unlocked"), expr.input("keqingA4Included"))),
    inputs: [input("keqingA4Rate", .15), input("keqingA4Unlocked", Number(ascension >= 4), "explicit-ascension", "boolean"), input("keqingA4Included", Number(included), "explicit-accounting", "boolean")],
    requirements: { maximumConstellation: 6, elements: ["electro"], attackTags: ["burst"] }, sourceRefs: KEQING_BURST_SOURCE_REFS,
  };
}

export function createKeqingC4AttackFormula(state: { active: boolean; included: boolean; baseAttack?: number; characterBaseAttack?: number; weaponBaseAttack?: number }): CalculatorFormula {
  const equipmentBase = state.characterBaseAttack !== undefined && state.weaponBaseAttack !== undefined;
  const noAdjustment = state.active === state.included;
  const base = equipmentBase ? expr.add(expr.input("keqingCharacterBaseAtk"), expr.input("keqingWeaponBaseAtk")) : expr.input("keqingHistoricalBaseAtk");
  return {
    ruleId: "keqing-c4-per-hit-attack-accounting-gcsim-b4ae769",
    label: noAdjustment ? "刻晴 C4：本段有效份额与共享面板已含份额相同，攻击修正为零，不反推基础攻击" : "刻晴 C4：基础攻击 ×25%×（本段有效 − 共享面板已含），只补差值",
    expression: noAdjustment ? expr.value(0) : expr.mul(base, expr.input("keqingC4Rate"), expr.sub(expr.input("keqingC4Active"), expr.input("keqingC4Included"))),
    inputs: [input("keqingC4Rate", .25), input("keqingC4Active", Number(state.active), "conditioned-user-input", "boolean"), input("keqingC4Included", Number(state.included), "explicit-accounting", "boolean"),
      ...(noAdjustment ? [] : equipmentBase ? [input("keqingCharacterBaseAtk", state.characterBaseAttack!, "equipment-base", "stat"), input("keqingWeaponBaseAtk", state.weaponBaseAttack!, "equipment-base", "stat")] : state.baseAttack === undefined ? [] : [input("keqingHistoricalBaseAtk", state.baseAttack, "explicit-historical-base", "stat")])],
    requirements: { minimumConstellation: 4, maximumConstellation: 6, elements: ["electro"], attackTags: ["burst"] }, sourceRefs: KEQING_BURST_SOURCE_REFS,
  };
}

export function createKeqingC6DamageBonusFormula(state: { normal: boolean; charged: boolean; skill: boolean; includedStacks: number }): CalculatorFormula {
  return {
    ruleId: "keqing-c6-per-hit-category-accounting-gcsim-b4ae769", label: "刻晴 C6：本次 Q 类与三个逐击动作类别各6%，减去已填增伤中的层数",
    expression: expr.mul(expr.input("keqingC6PerCategory"), expr.sub(expr.add(expr.input("keqingC6BurstActive"), expr.input("keqingC6NormalActive"), expr.input("keqingC6ChargedActive"), expr.input("keqingC6SkillActive")), expr.input("keqingC6IncludedStacks"))),
    inputs: [input("keqingC6PerCategory", .06), input("keqingC6BurstActive", 1, "source-cast-timing", "boolean"), input("keqingC6NormalActive", Number(state.normal), "conditioned-user-input", "boolean"), input("keqingC6ChargedActive", Number(state.charged), "conditioned-user-input", "boolean"), input("keqingC6SkillActive", Number(state.skill), "conditioned-user-input", "boolean"), input("keqingC6IncludedStacks", state.includedStacks, "explicit-accounting", "count")],
    requirements: { minimumConstellation: 6, maximumConstellation: 6, elements: ["electro"], attackTags: ["burst"] }, sourceRefs: KEQING_BURST_SOURCE_REFS,
  };
}

export function createXingqiuA4DamageBonusFormula(ascension: number, included: boolean): CalculatorFormula {
  return {
    ruleId: "xingqiu-a4-hydro-accounting-gcsim-b4ae769", label: "行秋 A4：20% 水伤减去已填增伤中的既有份额",
    expression: expr.mul(expr.input("xingqiuA4Bonus"), expr.sub(expr.input("xingqiuA4Unlocked"), expr.input("xingqiuA4Included"))),
    inputs: [input("xingqiuA4Bonus", .2), input("xingqiuA4Unlocked", Number(ascension >= 4), "explicit-ascension", "boolean"), input("xingqiuA4Included", Number(included), "explicit-accounting", "boolean")],
    requirements: { maximumConstellation: 6, elements: ["hydro"], attackTags: ["skill"] }, sourceRefs: XINGQIU_SKILL_SOURCE_REFS,
  };
}

export function createXingqiuC4SkillBaseFormula(coefficient: number, constellation: number, burstActiveAtCast: boolean): CalculatorFormula {
  return {
    ruleId: "xingqiu-c4-skill-talent-multiplier-gcsim-b4ae769", label: "行秋 E 基数：C4 且起手时 Q 有效则天赋倍率 ×1.5",
    expression: expr.mul(expr.input("atk"), expr.input("xingqiuSkillCoefficient"), expr.condition("equal", expr.mul(expr.input("xingqiuC4Unlocked"), expr.input("xingqiuBurstActiveAtCast")), expr.value(1), expr.input("xingqiuC4Multiplier"), expr.value(1))),
    inputs: [input("xingqiuSkillCoefficient", coefficient, "source-table"), input("xingqiuC4Unlocked", Number(constellation >= 4), "explicit-constellation", "boolean"), input("xingqiuBurstActiveAtCast", Number(burstActiveAtCast), "conditioned-user-input", "boolean"), input("xingqiuC4Multiplier", 1.5)],
    requirements: { maximumConstellation: 6, elements: ["hydro"], attackTags: ["skill"] }, sourceRefs: XINGQIU_SKILL_SOURCE_REFS,
  };
}

export function createXingqiuC2ResistanceFormula(active: boolean, included: boolean): CalculatorFormula {
  return {
    ruleId: "xingqiu-c2-existing-hydro-resistance-accounting-gcsim-b4ae769", label: "行秋 C2：既有目标水减抗减去敌人抗性输入已含份额",
    expression: expr.mul(expr.input("xingqiuC2Reduction"), expr.sub(expr.input("xingqiuC2Active"), expr.input("xingqiuC2Included"))),
    inputs: [input("xingqiuC2Reduction", .15), input("xingqiuC2Active", Number(active), "conditioned-user-input", "boolean"), input("xingqiuC2Included", Number(included), "explicit-accounting", "boolean")],
    requirements: { maximumConstellation: 6, elements: ["hydro"], attackTags: ["skill"] }, sourceRefs: XINGQIU_SKILL_SOURCE_REFS,
  };
}
