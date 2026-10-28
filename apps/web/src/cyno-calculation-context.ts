import type { CalculatorDocument } from '../../../packages/sim-core/src/calculator-model';
import { cynoDamageContextSchema, type CynoDamageContext } from '../../../packages/sim-core/src/cyno-damage-context';
import { isCynoDamageDocument, prepareCynoDamageDocument, type CynoCalculatorDocument } from '../../../packages/sim-core/src/cyno-damage-formulas';

export function applyCynoDamageContext(document: CalculatorDocument, supplied: CynoDamageContext): CalculatorDocument {
  if (!isCynoDamageDocument(document)) return document;
  const result = structuredClone(document) as CynoCalculatorDocument;
  result.gameContext.cynoDamage = cynoDamageContextSchema.parse(supplied);
  return prepareCynoDamageDocument(result);
}

/** Only for labelled teaching examples. Imports must use resetCynoPanelAccounting('imported-final'). */
export function createCynoExampleContext(): CynoDamageContext {
  return { burstActive: true, burstEmIncludedInPanel: false, includedA4Base: 0 };
}
