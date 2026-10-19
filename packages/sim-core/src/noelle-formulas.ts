import type { CalculatorFormula } from "./calculator-model";
import { expr } from "./calculation-trace";

export const NOELLE_SOURCE_COMMIT = "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541";
const root = `https://github.com/genshinsim/gcsim/blob/${NOELLE_SOURCE_COMMIT}`;
export const NOELLE_BURST_SOURCE_REFS = [
  `${root}/internal/characters/noelle/burst.go#L33-L127`,
  `${root}/internal/characters/noelle/noelle.go#L41-L57`,
  `${root}/internal/characters/noelle/cons.go#L12-L27`,
  `${root}/internal/characters/noelle/charge.go#L157-L181`,
  `${root}/internal/characters/noelle/zz_noelle.dm.go`,
  `${root}/pkg/core/player/character/stats.go#L122-L166`,
];

/** The adapter resolves the independent effective Q talent from the checked source table. */
export function createNoelleBurstAttackFormula(input: {
  active: boolean;
  conversionCoefficient: number;
  effectiveTalentLevel: number;
  constellation: number;
  defenseSnapshotNonExtra?: number;
}): CalculatorFormula {
  const c6 = input.constellation === 6;
  return {
    ruleId: `noelle-burst-def-to-atk-${c6 ? "c6" : "c0-c5"}-gcsim-b4ae769`,
    label: `诺艾尔大扫除：历史非 Extra 防御快照 ×（有效 Q 等级 ${input.effectiveTalentLevel} 转换系数${c6 ? " + C6 50%" : ""}）`,
    expression: input.active
      ? expr.mul(expr.input("noelleBurstSnapshotDefNonExtra"), expr.add(expr.input("noelleBurstDefConversion"), expr.input("noelleC6Conversion")))
      : expr.value(0),
    inputs: [
      { key: "noelleBurstDefConversion", value: input.conversionCoefficient, unit: "ratio", meaningKey: "Q 有效天赋等级对应的防御转换比例", origin: "source-table" },
      { key: "noelleC6Conversion", value: c6 ? 0.5 : 0, unit: "ratio", meaningKey: "C6 额外防御转换比例（替当前命座明确取值）", origin: "source-rule" },
      ...(input.defenseSnapshotNonExtra === undefined ? [] : [{ key: "noelleBurstSnapshotDefNonExtra", value: input.defenseSnapshotNonExtra, minimum: 0, unit: "stat", meaningKey: "Q 建立转换时的非 Extra 防御快照（不是当前最终 DEF）", origin: "conditioned-user-input", ownerId: "character:10000034" }]),
    ],
    requirements: c6 ? { minimumConstellation: 6, maximumConstellation: 6 } : { maximumConstellation: 5 },
    sourceRefs: [...NOELLE_BURST_SOURCE_REFS],
  };
}

/** Source AttackTagExtra is the charged spin and finisher, including while Geo-infused. */
export function createNoelleC2ChargedBonusFormula(): CalculatorFormula {
  return {
    ruleId: "noelle-c2-charged-damage-bonus-gcsim-b4ae769",
    label: "诺艾尔 C2：所选重击伤害加成 15%（旋转与终结均适用）",
    expression: expr.input("noelleC2ChargedDamageBonus"),
    inputs: [{ key: "noelleC2ChargedDamageBonus", value: 0.15, unit: "ratio", meaningKey: "C2 重击伤害加成", origin: "source-rule" }],
    requirements: { minimumConstellation: 2, maximumConstellation: 6, attackTags: ["charged"] },
    sourceRefs: [...NOELLE_BURST_SOURCE_REFS],
  };
}
