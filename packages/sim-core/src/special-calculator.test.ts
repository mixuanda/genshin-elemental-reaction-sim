import { describe, expect, it } from "vitest";
import { calculateConditionedSpecial, SPECIAL_BRANCHES } from "@genshin-dps-lab/reaction-formulas";
import { evaluateFormulaExpression, formatFormulaExpression } from "./calculation-trace";
import { calculateSpecialCalculatorHit, createSpecialTeachingContext, SPECIAL_TRACE_TEXT_ZH } from "./special-calculator";

describe("special formula shared execution traces", () => {
  it.each(Object.keys(SPECIAL_BRANCHES) as (keyof typeof SPECIAL_BRANCHES)[])("executes complete example through shared AST for %s", branch => {
    const context = createSpecialTeachingContext(branch);
    const result = calculateSpecialCalculatorHit(context);
    const raw = calculateConditionedSpecial(context);
    expect(result.nonCritical).toBe(raw.nonCritical);
    expect(result.critical).toBe(raw.critical);
    expect(result.expected).toBe(raw.expected);
    for (const node of result.trace) {
      const values = Object.fromEntries(node.inputs.map(input => [input.key, input.value]));
      expect(evaluateFormulaExpression(node.expression, values)).toBe(node.result!.value);
      expect(formatFormulaExpression(node.expression, values)).toBe(node.substitution);
      expect(SPECIAL_TRACE_TEXT_ZH[node.titleKey]).toBeTruthy();
      expect(SPECIAL_TRACE_TEXT_ZH[node.explanationKey]).toBeTruthy();
      expect(node.sourceRefs.length).toBeGreaterThan(0);
    }
  });
  it("preserves complete context, version, numeric outcomes and traces across JSON round trip", () => {
    const context = createSpecialTeachingContext("stellar-swirl-vortex-2");
    expect(calculateSpecialCalculatorHit(JSON.parse(JSON.stringify(context)))).toEqual(calculateSpecialCalculatorHit(context));
  });
  it("editing a contributor updates nonlinear outcomes and derived substitutions", () => {
    const context = createSpecialTeachingContext("lunar-charged-reaction");
    const first = calculateSpecialCalculatorHit(context);
    context.contributors[0]!.critDamage = 3;
    const second = calculateSpecialCalculatorHit(context);
    expect(second.expected).not.toBe(first.expected);
    expect(second.trace.find(node => node.id === "special-hit.expected.1.0.crit")!.substitution).not.toBe(first.trace.find(node => node.id === "special-hit.expected.1.0.crit")!.substitution);
    expect(second.trace.find(node => node.id === "special-hit.expected.total")!.result!.value).toBe(second.expected);
  });
  it("non-damaging state and disabled conversion carry no invented arithmetic", () => {
    const state = calculateSpecialCalculatorHit(createSpecialTeachingContext("lunar-bloom-event"));
    expect(state.trace).toEqual([]); expect(state.status).toBe("non-damaging"); expect(state.warnings.some(w => w.includes("草露"))).toBe(true);
    const context = createSpecialTeachingContext("stellar-swirl-direct"); context.context.enablement = "disabled";
    const disabled = calculateSpecialCalculatorHit(context);
    expect(disabled.trace).toEqual([]); expect(disabled.status).toBe("blocked"); expect(disabled.expected).toBeUndefined();
  });
});
