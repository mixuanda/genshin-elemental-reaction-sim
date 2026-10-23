import type { CalculatorDocument } from '../../../packages/sim-core/src/calculator-model';
import { hutaoDamageContextSchema, type HutaoDamageContext } from '../../../packages/sim-core/src/hutao-damage-context';
import { isHutaoPrimaryDocument, prepareHutaoDamageDocument, type HutaoCalculatorDocument } from '../../../packages/sim-core/src/hutao-damage-formulas';

export function applyHutaoDamageContext(document: CalculatorDocument, supplied: HutaoDamageContext): CalculatorDocument {
  if (!isHutaoPrimaryDocument(document)) return document;
  const result = structuredClone(document) as HutaoCalculatorDocument;
  result.gameContext.hutaoDamage = hutaoDamageContextSchema.parse(supplied);
  return prepareHutaoDamageDocument(result);
}
/** For labelled examples only: no HP, E talent or unchanged-HP history is invented. */
export function createHutaoExampleContext(skillTalentLevel?: number): HutaoDamageContext {
  return hutaoDamageContextSchema.parse({ paramitaActive: true, skillAttackIncludedInPanel: false, a4IncludedInDamageBonus: false, c6CritRateIncludedInPanel: false,
    ...(skillTalentLevel === undefined ? {} : { skillTalentLevel }) });
}
