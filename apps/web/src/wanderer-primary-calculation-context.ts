import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { wandererPrimaryContextSchema, type WandererPrimaryContext } from "../../../packages/sim-core/src/wanderer-primary-context";
import { isWandererPrimaryAction, prepareWandererPrimaryDocument, type WandererPrimaryDocument } from "../../../packages/sim-core/src/wanderer-primary-formulas";

export function applyWandererPrimaryContext(document: CalculatorDocument, supplied: WandererPrimaryContext): CalculatorDocument {
  if (!isWandererPrimaryAction(document)) return document;
  const result = structuredClone(document) as WandererPrimaryDocument;
  result.gameContext.wandererPrimary = wandererPrimaryContextSchema.parse(supplied);
  return prepareWandererPrimaryDocument(result);
}
export function initializeWandererPrimaryDocument(document: CalculatorDocument): CalculatorDocument {
  return applyWandererPrimaryContext(document, {pyroAttackIncludedPercent: 0, cryoCritRateIncludedPercent: 0, burstC2IncludedPercent: 0});
}
