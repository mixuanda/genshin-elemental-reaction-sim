import type { CalculatorFormula } from "./calculator-model";
import { expr } from "./calculation-trace";

const root = "https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
export const ITTO_KESAGIRI_SOURCE_REFS = [
  `${root}/internal/characters/itto/charge.go#L87-L111`,
  `${root}/internal/characters/itto/charge.go#L185-L272`,
  `${root}/internal/characters/itto/asc.go#L63-L68`,
  `${root}/internal/characters/itto/cons.go#L12-L72`,
  `${root}/internal/characters/itto/burst.go#L39-L110`,
  `${root}/internal/characters/itto/itto.go#L83-L98`,
  `${root}/internal/characters/itto/zz_aratakiitto.dm.go`,
  `${root}/pkg/core/player/character/stats.go#L122-L166`,
];

export function createIttoBurstAttackFormula(input: { conversionCoefficient: number; effectiveTalentLevel: number; defenseSnapshotNonExtra?: number }): CalculatorFormula {
  return {
    ruleId: "itto-burst-def-to-atk-gcsim-b4ae769",
    label: `一斗 Q：历史非 Extra DEF × 有效 Q 等级 ${input.effectiveTalentLevel} 转换比例`,
    expression: expr.mul(expr.input("ittoBurstDefenseSnapshotNonExtra"), expr.input("ittoBurstDefConversion")),
    inputs: [
      { key: "ittoBurstDefConversion", value: input.conversionCoefficient, unit: "ratio", meaningKey: "input.ittoBurstDefConversion", origin: "source-table" },
      ...(input.defenseSnapshotNonExtra === undefined ? [] : [{ key: "ittoBurstDefenseSnapshotNonExtra", value: input.defenseSnapshotNonExtra, minimum: 0, unit: "stat", meaningKey: "input.ittoBurstDefenseSnapshotNonExtra", origin: "conditioned-user-input", ownerId: "character:10000057" }]),
    ],
    requirements: { maximumConstellation: 6 },
    sourceRefs: [...ITTO_KESAGIRI_SOURCE_REFS],
  };
}

/** The source reads total DEF at ChargeAttack construction, before QueueAttack's assumed start snapshot. */
export function createIttoA4AdditiveFormula(input: { actionDefenseSnapshotTotal?: number; actionDefenseStable: boolean }): CalculatorFormula {
  const stable = input.actionDefenseSnapshotTotal === undefined && input.actionDefenseStable;
  return {
    ruleId: "itto-a4-kesagiri-total-def-gcsim-b4ae769",
    label: `一斗 A4：本次荒泷逆袈裟起手总 DEF × 35%${stable ? "（明确假定起手至命中 DEF 等于当前输入面板）" : "（独立动作起手快照，包含 Extra DEF）"}`,
    expression: expr.mul(expr.input(stable ? "def" : "ittoActionDefenseSnapshotTotal"), expr.input("ittoA4DefCoefficient")),
    inputs: [
      { key: "ittoA4DefCoefficient", value: 0.35, unit: "ratio", meaningKey: "input.ittoA4DefCoefficient", origin: "source-rule" },
      ...(input.actionDefenseSnapshotTotal === undefined ? [] : [{ key: "ittoActionDefenseSnapshotTotal", value: input.actionDefenseSnapshotTotal, minimum: 0, unit: "stat", meaningKey: "input.ittoActionDefenseSnapshotTotal", origin: "conditioned-user-input", ownerId: "character:10000057" }]),
    ],
    requirements: { minimumAscension: 4, maximumConstellation: 6, attackTags: ["charged"] },
    sourceRefs: [...ITTO_KESAGIRI_SOURCE_REFS],
  };
}

export function createIttoC6CritDamageFormula(): CalculatorFormula {
  return {
    ruleId: "itto-c6-charged-crit-damage-gcsim-b4ae769",
    label: "一斗 C6：本次重击暴击伤害 +70%（不耗层概率不乘入伤害）",
    expression: expr.input("ittoC6CritDamage"),
    inputs: [{ key: "ittoC6CritDamage", value: 0.7, unit: "ratio", meaningKey: "input.ittoC6CritDamage", origin: "source-rule" }],
    requirements: { minimumConstellation: 6, maximumConstellation: 6, attackTags: ["charged"] },
    sourceRefs: [...ITTO_KESAGIRI_SOURCE_REFS],
  };
}
