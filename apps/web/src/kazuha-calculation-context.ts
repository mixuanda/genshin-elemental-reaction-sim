import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { isKazuhaBurstAction, prepareKazuhaBurstDocument, type KazuhaCalculatorDocument } from "../../../packages/sim-core/src/kazuha-burst-formulas";

/** Called after classified mapping construction, before common provenance stamp. */
export function initializeKazuhaBurstDocument(document: CalculatorDocument): CalculatorDocument {
  if (!isKazuhaBurstAction(document)) return document;
  const result = structuredClone(document) as KazuhaCalculatorDocument;
  result.gameContext.kazuhaBurst = {
    // This named example explicitly declares no absorption. Other elements need
    // their real first absorption frame and independent final element bonus.
    ...(result.gameContext.skillId === "kazuha-burst-complete" ? {absorptionElement: "none" as const} : {}),
    includedA4DamageBonus: 0,
  };
  result.gameContext.skillName = result.gameContext.skillId === "kazuha-burst-slash" ? "万叶之一刀·初斩"
    : result.gameContext.skillId === "kazuha-burst-anemo-dot" ? "万叶之一刀·单次风DoT" : "万叶之一刀·完整Q直接伤害";
  result.label = `枫原万叶 · ${result.gameContext.skillName} · 有效天赋等级 ${result.gameContext.effectiveTalentLevel}`;
  return prepareKazuhaBurstDocument(result);
}
