import type { CalculatorFormula } from "@genshin-dps-lab/sim-core";

type FormulaInput = CalculatorFormula["inputs"][number];

/** These values are resolved from the selected source/talent, not battle answers. */
export function isSourceOwnedFormulaInput(input: FormulaInput): boolean {
  return input.origin === "source-table" || input.origin === "source-talent-field";
}

/** Synthetic examples retain their explicitly editable teaching inputs. */
export function isReadonlySourceFormulaInput(input: FormulaInput, synthetic: boolean): boolean {
  return !synthetic && isSourceOwnedFormulaInput(input);
}

/** Restore answers for the same key and owner; retain the fresh source metadata
 * and coefficients. In particular, a prior talent level is not a user override.
 */
export function restoreCalculatorFormulaAnswers(next: CalculatorFormula, previous: CalculatorFormula): void {
  for (const input of next.inputs) {
    if (isSourceOwnedFormulaInput(input)) continue;
    const answer = previous.inputs.find(candidate => candidate.key === input.key && candidate.ownerId === input.ownerId);
    if (answer && !isSourceOwnedFormulaInput(answer)) input.value = answer.value;
  }
}
