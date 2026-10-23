import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { arlecchinoDamageContextSchema, type ArlecchinoDamageContext } from "../../../packages/sim-core/src/arlecchino-damage-context";
import { isArlecchinoDamageAction, prepareArlecchinoDamageDocument, type ArlecchinoCalculatorDocument } from "../../../packages/sim-core/src/arlecchino-damage-formulas";

export function applyArlecchinoDamageContext(document: CalculatorDocument, supplied: ArlecchinoDamageContext): CalculatorDocument {
  if (!isArlecchinoDamageAction(document)) return document;
  const result = structuredClone(document) as ArlecchinoCalculatorDocument;
  result.gameContext.arlecchinoDamage = arlecchinoDamageContextSchema.parse(supplied);
  return prepareArlecchinoDamageDocument(result);
}

/** Explicit zero accounting belongs to the unmaterialized teaching panel.
 * Actual bond state is never invented, including for teaching entries. */
export function initializeArlecchinoDamageDocument(document: CalculatorDocument): CalculatorDocument {
  return applyArlecchinoDamageContext(document, {passivePyroBonusIncluded: false, includedBondBase: 0,
    c6CritRateIncludedPercent: 0, c6CritDamageIncludedPercent: 0});
}
