import type { CalculatorDocument } from "../../../packages/sim-core/src/calculator-model";
import { durinBurstContextSchema, type DurinBurstContext } from "../../../packages/sim-core/src/durin-burst-context";
import { isDurinBurstAction, prepareDurinBurstDocument, type DurinBurstDocument } from "../../../packages/sim-core/src/durin-burst-formulas";

export function applyDurinBurstContext(document: CalculatorDocument, supplied: DurinBurstContext): CalculatorDocument {
  if (!isDurinBurstAction(document)) return document;
  const result = structuredClone(document) as DurinBurstDocument;
  result.gameContext.durinBurst = durinBurstContextSchema.parse(supplied);
  return prepareDurinBurstDocument(result);
}
export function initializeDurinBurstDocument(document: CalculatorDocument): CalculatorDocument {
  return applyDurinBurstContext(document, {c2PyroBonusIncluded: false});
}
