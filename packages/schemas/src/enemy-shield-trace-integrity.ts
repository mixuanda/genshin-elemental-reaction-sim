import { canonicalStringify } from "./reproducibility";

export interface ExpectedEnemyShieldTraceNode {
  id: string;
  expression: unknown;
  values: Record<string, { value: number; unit: string; origin: unknown }>;
  result: number;
  unit: string;
  status?: string;
  childIds?: string[];
  sourceRefs: string[];
}

type Expression =
  | { kind: "constant"; value: number }
  | { kind: "variable"; key: string }
  | { kind: "add" | "multiply" | "min" | "max"; terms: Expression[] }
  | { kind: "subtract" | "divide"; left: Expression; right: Expression }
  | { kind: "clamp"; value: Expression; min: Expression; max: Expression }
  | { kind: "condition"; operator: "lt" | "lte" | "equal"; left: Expression; right: Expression; whenTrue: Expression; whenFalse: Expression };

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const nonempty = (value: unknown): boolean => typeof value === "string" && value.trim().length > 0;
const same = (left: unknown, right: unknown): boolean => {
  if (left === undefined || right === undefined) return left === right;
  try { return canonicalStringify(left) === canonicalStringify(right); } catch { return false; }
};
const numericText = (value: number): string => {
  const text = Object.is(value, -0) ? "-0" : String(value);
  return value < 0 || Object.is(value, -0) ? `(${text})` : text;
};

/** Only the caller's independently constructed AST is formatted; imported ASTs never execute. */
function format(expression: Expression, values?: ExpectedEnemyShieldTraceNode["values"]): string {
  const child = (value: Expression): string => format(value, values);
  switch (expression.kind) {
    case "constant": return numericText(expression.value);
    case "variable": return values === undefined ? expression.key : numericText(values[expression.key]!.value);
    case "add": return expression.terms.length ? `(${expression.terms.map(child).join(" + ")})` : "0";
    case "multiply": return expression.terms.length ? `(${expression.terms.map(child).join(" × ")})` : "1";
    case "subtract": return `(${child(expression.left)} − ${child(expression.right)})`;
    case "divide": return `(${child(expression.left)} / ${child(expression.right)})`;
    case "min":
    case "max": return `${expression.kind}(${expression.terms.map(child).join(", ")})`;
    case "clamp": return `clamp(${child(expression.value)}, ${child(expression.min)}, ${child(expression.max)})`;
    case "condition": {
      const operator = expression.operator === "lt" ? "<" : expression.operator === "lte" ? "≤" : "=";
      return `(if ${child(expression.left)} ${operator} ${child(expression.right)} then ${child(expression.whenTrue)} else ${child(expression.whenFalse)})`;
    }
  }
}

/** Expected values and results must come from source/configuration replay, never the imported shield GU. */
export function validateEnemyShieldTrace(
  trace: unknown[],
  expectedNodes: readonly ExpectedEnemyShieldTraceNode[],
  issue: (path: Array<string | number>, message: string) => void,
): void {
  if (trace.length !== expectedNodes.length) issue([], "must contain exactly the independently replayed shield formula nodes");
  expectedNodes.forEach((expected, index) => {
    const node = trace[index];
    if (!record(node)) { issue([index], "requires a structured shield formula node"); return; }
    const expression = expected.expression as Expression;
    const fields = {
      id: expected.id, ruleId: expected.id, expression: expected.expression,
      status: expected.status ?? "applied", childIds: expected.childIds ?? [],
      sourceRefs: expected.sourceRefs, warnings: [],
      symbolicFormula: format(expression), substitution: format(expression, expected.values),
      result: { value: expected.result,
        display: new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 6 }).format(expected.result), unit: expected.unit },
    };
    for (const [field, value] of Object.entries(fields)) {
      if (!same(node[field], value)) issue([index, field], "must match the independently replayed shield formula, substitution, and result");
    }
    if (!nonempty(node.titleKey)) issue([index, "titleKey"], "requires a formula title");
    if (!nonempty(node.explanationKey)) issue([index, "explanationKey"], "requires a formula explanation");
    const bindings = Object.entries(expected.values);
    if (!Array.isArray(node.inputs) || node.inputs.length !== bindings.length) {
      issue([index, "inputs"], "must contain exactly the defined shield formula inputs");
      return;
    }
    const inputs: unknown[] = node.inputs;
    bindings.forEach(([key, binding], inputIndex) => {
      const input = inputs[inputIndex];
      if (!record(input)) { issue([index, "inputs", inputIndex], "requires a structured shield formula input"); return; }
      for (const [field, value] of Object.entries({ key, ...binding })) {
        if (!same(input[field], value)) issue([index, "inputs", inputIndex, field], "must bind the independently replayed input value, unit, and origin");
      }
      if (!nonempty(input.meaningKey)) issue([index, "inputs", inputIndex, "meaningKey"], "requires the input variable definition");
    });
  });
}
