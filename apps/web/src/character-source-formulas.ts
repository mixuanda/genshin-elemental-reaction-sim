import type { ClassifiedCharacterHit } from "@genshin-dps-lab/game-data/classified-hits";
import type { CalculatorFormula } from "../../../packages/sim-core/src/calculator-model";
import { expr } from "../../../packages/sim-core/src/calculation-trace";

const sourceRoot = "https://github.com/frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/";
const neferSource = `${sourceRoot}libs/gi/sheets/src/Characters/Nefer/index.tsx`;
const veilInputs = (constellation = 0): CalculatorFormula["inputs"] => [
  { key: "neferVeilStacks", value: 0, minimum: 0, maximum: constellation >= 2 ? 5 : 3, integer: true, unit: "count", meaningKey: "本次 Q 实际消耗帷幕数；不是结算后剩余数", origin: "conditioned-user-input" },
  { key: "moonsignCount", value: 1, minimum: 0, maximum: 4, integer: true, unit: "count", meaningKey: "队伍实际月兆角色数", origin: "conditioned-user-input" }
];

/** The eight-second EM buff is independent of current or consumed Veil stacks. */
export function createNeferFullVeilEmFormula(constellation = 0): CalculatorFormula {
  const highConstellation = constellation >= 2;
  return {
    ruleId: `nefer-full-veil-em-${highConstellation ? "c2-c6" : "c0-c1"}-optimizer-180a0a1`, label: `奈芙尔：实际仍生效的满帷幕 ${highConstellation ? 200 : 100} 精通状态（8秒）`,
    expression: expr.condition("lt", expr.input("moonsignCount"), expr.value(2), expr.value(0),
      expr.mul(expr.input("neferFullVeilEmBuffActive"), expr.value(highConstellation ? 200 : 100))),
    inputs: [
      { key: "neferFullVeilEmBuffActive", value: 0, allowedValues: [0, 1], unit: "boolean", meaningKey: "本段结算时实际满层精通增益仍在8秒持续期内；与Q消耗数独立，1有效、0无效", origin: "conditioned-user-input" },
      { key: "moonsignCount", value: 1, minimum: 0, maximum: 4, integer: true, unit: "count", meaningKey: "队伍实际月兆角色数", origin: "conditioned-user-input" }
    ],
    requirements: { minimumAscension: 1, ...(highConstellation ? { minimumConstellation: 2, maximumConstellation: 6 } : { maximumConstellation: 1 }), elements: ["dendro"], attackTags: ["skill", "burst"] },
    sourceRefs: [neferSource, `${sourceRoot}libs/gi/stats/Data/Characters/Nefer/skillParam.json`, `${sourceRoot}libs/gi/dm-localization/assets/locales/en/char_Nefer_gen.json`]
  };
}

export function createNeferBurstVeilBonusFormula(hit: ClassifiedCharacterHit, constellation = 0): CalculatorFormula {
  const coefficient = hit.formulaInputs.find((input) => input.key === "neferBurstBonusPerVeil");
  if (!coefficient) throw new Error("奈芙尔 Q 缺少完整来源核验的每层增伤参数。");
  return {
    ruleId: `nefer-burst-veils-${constellation >= 2 ? "c2-c6" : "c0-c1"}-optimizer-180a0a1`, label: "奈芙尔 Q：本次消耗帷幕的伤害加成",
    expression: expr.condition("lt", expr.input("moonsignCount"), expr.value(2), expr.value(0), expr.mul(expr.input(coefficient.key), expr.input("neferVeilStacks"))),
    inputs: [{ key: coefficient.key, value: coefficient.value, unit: "ratio", meaningKey: coefficient.coefficientField, origin: "source-talent-field" }, ...veilInputs(constellation)],
    requirements: { minimumAscension: 1, ...(constellation >= 2 ? { minimumConstellation: 2, maximumConstellation: 6 } : { maximumConstellation: 1 }), elements: ["dendro"], attackTags: ["burst"] }, sourceRefs: [neferSource, ...hit.sourceRefs]
  };
}

export function createNeferC4ResistanceReductionFormula(): CalculatorFormula {
  return {
    ruleId: "nefer-c4-target-dendro-resistance-optimizer-180a0a1", label: "奈芙尔 C4：该目标实际生效的20%草抗削减（含4.5秒残留）",
    expression: expr.mul(expr.value(0.2), expr.input("neferC4TargetDebuffActive")),
    inputs: [{ key: "neferC4TargetDebuffActive", value: 0, allowedValues: [0, 1], unit: "boolean", meaningKey: "本段目标实际仍受C4减抗：含影舞附近状态或离开后4.5秒内残留；不由选择E推断", origin: "conditioned-user-input" }],
    requirements: { minimumConstellation: 4, maximumConstellation: 6, elements: ["dendro"], attackTags: ["skill", "burst"] },
    sourceRefs: [`${neferSource}#L201-L206`, `${sourceRoot}libs/gi/stats/Data/Characters/Nefer/skillParam.json`, `${sourceRoot}libs/gi/dm-localization/assets/locales/en/char_Nefer_gen.json`]
  };
}

export function createAlyoshaA4BonusFormula(): CalculatorFormula {
  return {
    ruleId: "alyosha-a4-er-optimizer-180a0a1", label: "阿罗夏 A4：实际元素充能效率转战技/爆发伤害加成（上限 70%）",
    expression: expr.mul(expr.value(0.0035), expr.min(expr.mul(expr.input("erRatio"), expr.value(100)), expr.value(200))),
    inputs: [], requirements: { minimumAscension: 4, maximumConstellation: 0, elements: ["electro"], attackTags: ["skill", "burst"] },
    sourceRefs: [`${sourceRoot}libs/gi/sheets/src/Characters/Alyosha/index.tsx#L135-L143`, `${sourceRoot}libs/gi/stats/Data/Characters/Alyosha/skillParam.json`]
  };
}

/** Reviewed resource states, not an automatic reconstruction of Will acquisition. */
export function createLohenWillFormula(hit: ClassifiedCharacterHit): CalculatorFormula {
  const perPoint = hit.formulaInputs.find((input) => input.key === "willMultiplierPerPoint");
  if (!perPoint) throw new Error("洛恩伤害缺少完整来源核验的每点争胜倍率。");
  return {
    ruleId: "lohen-will-c0-optimizer-180a0a1", label: "洛恩：本次实际消耗争胜对天赋基础伤害的附加乘区",
    expression: expr.mul(
      expr.add(...hit.terms.map((term) => expr.mul(expr.input(`lohenTalent_${term.stat}`), expr.input(term.stat)))),
      expr.input(perPoint.key), expr.input("lohenWillConsumed")
    ),
    inputs: [
      ...hit.terms.map((term) => ({ key: `lohenTalent_${term.stat}`, value: term.coefficient, unit: "ratio", meaningKey: term.coefficientField, origin: "source-talent-field" })),
      { key: perPoint.key, value: perPoint.value, unit: "ratio", meaningKey: perPoint.coefficientField, origin: "source-talent-field" },
      { key: "lohenWillConsumed", value: 20, minimum: 20, maximum: 100, integer: true, allowedValues: [20, 40, 60, 80, 100], unit: "count", meaningKey: "本次明确消耗争胜；仅开放已审来源选项，不认证游戏的资源粒度", origin: "conditioned-user-input" }
    ],
    requirements: { maximumConstellation: 0, elements: ["cryo"], attackTags: ["skill", "burst"] },
    sourceRefs: [`${sourceRoot}libs/gi/sheets/src/Characters/Lohen/index.tsx`, ...hit.sourceRefs]
  };
}

export function createLinneaA1ResistanceReductionFormula(): CalculatorFormula {
  return {
    ruleId: "linnea-a1-lumi-c0-optimizer-180a0a1", label: "莉奈娅 A1：露米在场且命中目标位于附近时的岩抗削减",
    expression: expr.mul(expr.input("linneaLumiPresent"), expr.input("linneaTargetNearby"), expr.condition("lt", expr.input("moonsignCount"), expr.value(2), expr.value(0.15), expr.value(0.3))),
    inputs: [
      { key: "moonsignCount", value: 1, minimum: 1, maximum: 4, integer: true, unit: "count", meaningKey: "队伍实际月兆角色数（含莉奈娅本人）", origin: "conditioned-user-input" },
      { key: "linneaLumiPresent", value: 1, allowedValues: [0, 1], unit: "boolean", meaningKey: "本次结算时明确露米仍在场：1是、0否", origin: "conditioned-user-input" },
      { key: "linneaTargetNearby", value: 1, allowedValues: [0, 1], unit: "boolean", meaningKey: "本次目标明确位于A1附近范围：1是、0否；不由选择技能推断", origin: "conditioned-user-input" }
    ],
    requirements: { minimumAscension: 1, maximumConstellation: 0, elements: ["geo"], attackTags: ["skill"] },
    sourceRefs: [`${sourceRoot}libs/gi/sheets/src/Characters/Linnea/index.tsx#L127-L140`, `${sourceRoot}libs/gi/stats/Data/Characters/Linnea/skillParam.json`]
  };
}

/** The source attack modifier applies to each burst hit, never the global panel. */
export function createAmberA1CritRateFormula(): CalculatorFormula {
  return {
    ruleId: "amber-a1-burst-crit-rate-b4ae769", label: "安柏 A1：箭雨专属暴击率 +10%",
    expression: expr.value(0.1), inputs: [],
    requirements: { minimumAscension: 1, maximumConstellation: 0, elements: ["pyro"], attackTags: ["burst"] },
    sourceRefs: ["https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/amber/asc.go#L11-L30"]
  };
}
