import { describe, expect, it } from "vitest";
import {
  evaluateFormulaExpression,
  executeFormulaExpressionDetailed,
  expr,
  formatFormulaExpression,
  validateFormulaExpression,
  type FormulaExpression,
} from "../calculation-trace";

describe("formula table lookup", () => {
  it("executes a nested talent table and preserves the chosen indices through JSON", () => {
    const formula = expr.lookup("talent", [[1, 2, 3, 4, 5, 6, 7, 8, 9], [10, 20]], expr.input("branch"), expr.input("rank"));
    const restored = JSON.parse(JSON.stringify(formula)) as FormulaExpression;
    const bindings = { branch: 0, rank: 8 };
    expect(evaluateFormulaExpression(restored, bindings)).toBe(9);
    expect(formatFormulaExpression(restored)).toBe("talent[branch][rank]");
    expect(formatFormulaExpression(restored, bindings)).toBe("talent[0][8]");
    expect(executeFormulaExpressionDetailed(restored, bindings).steps).toEqual([{
      path: "$", kind: "lookup", symbolicFormula: "talent[branch][rank]",
      substitution: "talent[0][8]", result: 9,
      lookup: { table: "talent", indices: [0, 8], selectedValue: 9 },
    }]);
  });

  it("rejects invalid table data and indices instead of selecting a fallback value", () => {
    expect(() => validateFormulaExpression({ kind: "lookup", table: "talent", values: 1, indices: [expr.value(0)] })).toThrow(/values must be an array/);
    expect(() => validateFormulaExpression({ kind: "lookup", table: "talent", values: [1, Infinity], indices: [expr.value(0)] })).toThrow(/finite number/);
    expect(() => evaluateFormulaExpression(expr.lookup("talent", [1, 2], expr.value(1.5)), {})).toThrow(/non-negative integer/);
    expect(() => evaluateFormulaExpression(expr.lookup("talent", [1, 2], expr.value(-1)), {})).toThrow(/non-negative integer/);
    expect(() => evaluateFormulaExpression(expr.lookup("talent", [1, 2], expr.value(2)), {})).toThrow(/out of range/);
    expect(() => evaluateFormulaExpression(expr.lookup("talent", [[1]], expr.value(0)), {})).toThrow(/select a scalar/);
    expect(() => evaluateFormulaExpression(expr.lookup("talent", [1], expr.value(0), expr.value(0)), {})).toThrow(/too many indices/);
  });
});
