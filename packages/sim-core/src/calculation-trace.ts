/**
 * Executable formula trees shared by calculation, substitution and explanation.
 * Values are IEEE-754 numbers throughout; display formatting never feeds arithmetic.
 * This module is independent of the DOM, network access and game-data classification.
 */
export type FormulaLookupTable = number | FormulaLookupTable[];

export type FormulaExpression =
  | { kind: "constant"; value: number }
  | { kind: "variable"; key: string }
  | { kind: "lookup"; table: string; values: FormulaLookupTable[]; indices: FormulaExpression[] }
  | { kind: "add" | "multiply" | "min" | "max"; terms: FormulaExpression[] }
  | { kind: "subtract" | "divide"; left: FormulaExpression; right: FormulaExpression }
  | { kind: "truncate"; value: FormulaExpression }
  | { kind: "clamp"; value: FormulaExpression; min: FormulaExpression; max: FormulaExpression }
  | {
      kind: "condition";
      operator: "lt" | "lte" | "equal";
      left: FormulaExpression;
      right: FormulaExpression;
      whenTrue: FormulaExpression;
      whenFalse: FormulaExpression;
    };

export type TraceContext = Record<string, string | number | boolean | null>;

export interface TraceInput {
  key: string;
  value: number;
  unit: string;
  meaningKey: string;
  origin: string | { kind: string; reference?: string };
  context?: TraceContext;
}

export interface TraceValue {
  /** Unrounded machine value, used by dependent calculations and exports. */
  value: number;
  /** Presentation only; never parse this field back into a calculation. */
  display: string;
  unit: string;
}

export type TraceStatus = "applied" | "not-applicable" | "assumed" | "blocked";

export interface CalculationTraceNode {
  id: string;
  parentId?: string;
  ruleId: string;
  titleKey: string;
  explanationKey: string;
  status: TraceStatus;
  expression: FormulaExpression;
  inputs: TraceInput[];
  result?: TraceValue;
  childIds: string[];
  applicabilityReason?: string;
  sourceRefs: string[];
  warnings: string[];
  /** Both strings are generated from expression, not authored independently. */
  symbolicFormula: string;
  substitution: string;
}

export interface TraceNodeOptions {
  ruleId?: string;
  explanationKey?: string;
  parentId?: string;
  status?: TraceStatus;
  childIds?: string[];
  sourceRefs?: string[];
  warnings?: string[];
  applicabilityReason?: string;
  unit?: string;
  displayDigits?: number;
}

export const TRACE_TEXT_ZH: Record<string, string> = {
  "trace.applied": "已应用",
  "trace.not-applicable": "不适用",
  "trace.assumed": "条件假设",
  "trace.blocked": "缺少必要依据",
  "trace.input": "输入",
  "trace.result": "结果",
  "trace.symbolicFormula": "公式",
  "trace.substitution": "实际数值代入",
  "trace.ratio": "倍率",
  "trace.damage": "伤害",
};

export function traceText(key: string): string {
  return Object.prototype.hasOwnProperty.call(TRACE_TEXT_ZH, key) ? TRACE_TEXT_ZH[key]! : key;
}

export const expr = {
  value: (value: number): FormulaExpression => ({ kind: "constant", value }),
  input: (key: string): FormulaExpression => ({ kind: "variable", key }),
  lookup: (table: string, values: FormulaLookupTable[], ...indices: FormulaExpression[]): FormulaExpression =>
    ({ kind: "lookup", table, values, indices }),
  add: (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "add", terms }),
  mul: (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "multiply", terms }),
  sub: (left: FormulaExpression, right: FormulaExpression): FormulaExpression => ({ kind: "subtract", left, right }),
  div: (left: FormulaExpression, right: FormulaExpression): FormulaExpression => ({ kind: "divide", left, right }),
  trunc: (value: FormulaExpression): FormulaExpression => ({ kind: "truncate", value }),
  clamp: (value: FormulaExpression, min: FormulaExpression, max: FormulaExpression): FormulaExpression => ({ kind: "clamp", value, min, max }),
  min: (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "min", terms }),
  max: (...terms: FormulaExpression[]): FormulaExpression => ({ kind: "max", terms }),
  condition: (
    operator: "lt" | "lte" | "equal",
    left: FormulaExpression,
    right: FormulaExpression,
    whenTrue: FormulaExpression,
    whenFalse: FormulaExpression,
  ): FormulaExpression => ({ kind: "condition", operator, left, right, whenTrue, whenFalse }),
};

export function traceInput(
  key: string,
  value: number,
  unit = "ratio",
  origin: TraceInput["origin"] = "user",
  meaningKey = `input.${key}`,
): TraceInput {
  const input = { key, value, unit, meaningKey, origin };
  validateTraceInput(input);
  return input;
}

function finite(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
}

function nonempty(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0 || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error(`${label} must be a non-empty string without control characters`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Bounds prevent cyclic or adversarial imported expressions exhausting the stack. */
const MAX_EXPRESSION_DEPTH = 128;
const MAX_EXPRESSION_NODES = 10_000;

export function validateFormulaExpression(expression: unknown): asserts expression is FormulaExpression {
  const ancestors = new Set<object>();
  let nodeCount = 0;
  const visitTable = (value: unknown, depth: number): void => {
    if (depth > MAX_EXPRESSION_DEPTH) throw new Error("Formula lookup table exceeds maximum depth");
    if (++nodeCount > MAX_EXPRESSION_NODES) throw new Error("Formula expression exceeds maximum node count");
    if (typeof value === "number") {
      finite(value, "Formula lookup table value");
      return;
    }
    if (!Array.isArray(value)) throw new Error("Formula lookup table must contain arrays or finite numbers");
    if (ancestors.has(value)) throw new Error("Formula expression must not contain a cycle");
    ancestors.add(value);
    for (const item of value) visitTable(item, depth + 1);
    ancestors.delete(value);
  };
  const visit = (value: unknown, depth: number): void => {
    if (depth > MAX_EXPRESSION_DEPTH) throw new Error("Formula expression exceeds maximum depth");
    if (++nodeCount > MAX_EXPRESSION_NODES) throw new Error("Formula expression exceeds maximum node count");
    if (!isRecord(value)) throw new Error("Formula expression node must be an object");
    if (ancestors.has(value)) throw new Error("Formula expression must not contain a cycle");
    ancestors.add(value);
    switch (value.kind) {
      case "constant":
        finite(value.value, "Formula constant");
        break;
      case "variable":
        nonempty(value.key, "Formula variable key");
        break;
      case "lookup":
        nonempty(value.table, "Formula lookup table name");
        if (!Array.isArray(value.values)) throw new Error("Formula lookup values must be an array");
        if (!Array.isArray(value.indices) || value.indices.length === 0) {
          throw new Error("Formula lookup requires at least one index");
        }
        visitTable(value.values, depth + 1);
        for (const index of value.indices) visit(index, depth + 1);
        break;
      case "add":
      case "multiply":
      case "min":
      case "max":
        if (!Array.isArray(value.terms)) throw new Error("Formula terms must be an array");
        if ((value.kind === "min" || value.kind === "max") && value.terms.length === 0) {
          throw new Error(`${value.kind} requires at least one term`);
        }
        for (const term of value.terms) visit(term, depth + 1);
        break;
      case "subtract":
      case "divide":
        visit(value.left, depth + 1);
        visit(value.right, depth + 1);
        break;
      case "truncate":
        visit(value.value, depth + 1);
        break;
      case "clamp":
        visit(value.value, depth + 1);
        visit(value.min, depth + 1);
        visit(value.max, depth + 1);
        break;
      case "condition":
        if (value.operator !== "lt" && value.operator !== "lte" && value.operator !== "equal") {
          throw new Error("Formula condition operator must be lt, lte or equal");
        }
        visit(value.left, depth + 1);
        visit(value.right, depth + 1);
        visit(value.whenTrue, depth + 1);
        visit(value.whenFalse, depth + 1);
        break;
      default:
        throw new Error(`Unknown formula expression kind: ${String(value.kind)}`);
    }
    ancestors.delete(value);
  };
  visit(expression, 0);
}

function children(expression: FormulaExpression): FormulaExpression[] {
  switch (expression.kind) {
    case "constant":
    case "variable": return [];
    case "lookup": return expression.indices;
    case "add":
    case "multiply":
    case "min":
    case "max": return expression.terms;
    case "subtract":
    case "divide": return [expression.left, expression.right];
    case "truncate": return [expression.value];
    case "clamp": return [expression.value, expression.min, expression.max];
    case "condition": return [expression.left, expression.right, expression.whenTrue, expression.whenFalse];
  }
}

function validateVariables(expression: FormulaExpression, values: Record<string, number>): void {
  if (!isRecord(values)) throw new Error("Formula variables must be an object");
  const visit = (node: FormulaExpression): void => {
    if (node.kind === "variable") {
      if (!Object.prototype.hasOwnProperty.call(values, node.key)) {
        throw new Error(`Missing formula variable: ${node.key}`);
      }
      finite(values[node.key], `Formula variable ${node.key}`);
    }
    for (const child of children(node)) visit(child);
  };
  visit(expression);
}

function checked(value: number, operation: string): number {
  finite(value, `${operation} result`);
  return value;
}

export interface FormulaExecutionStep {
  /** Root is "$"; child paths follow the expression fields, such as "$.terms[0]". */
  path: string;
  kind: Exclude<FormulaExpression["kind"], "constant" | "variable">;
  symbolicFormula: string;
  substitution: string;
  result: number;
  condition?: {
    operator: "lt" | "lte" | "equal";
    left: number;
    right: number;
    matched: boolean;
    selectedBranch: "whenTrue" | "whenFalse";
  };
  lookup?: {
    table: string;
    indices: number[];
    selectedValue: number;
  };
}

type FormulaStepObserver = (step: FormulaExecutionStep) => void;

function execute(
  expression: FormulaExpression,
  values: Record<string, number>,
  observer?: FormulaStepObserver,
  path = "$",
): number {
  const run = (child: FormulaExpression, suffix: string): number =>
    execute(child, values, observer, observer ? `${path}${suffix}` : "");
  const finish = (
    result: number,
    condition?: FormulaExecutionStep["condition"],
    lookup?: FormulaExecutionStep["lookup"],
  ): number => {
    if (observer && expression.kind !== "constant" && expression.kind !== "variable") {
      observer({
        path,
        kind: expression.kind,
        symbolicFormula: format(expression),
        substitution: format(expression, values),
        result,
        ...(condition ? { condition } : {}),
        ...(lookup ? { lookup } : {}),
      });
    }
    return result;
  };
  switch (expression.kind) {
    case "constant": return expression.value;
    case "variable": return values[expression.key]!;
    case "lookup": {
      let selected: FormulaLookupTable = expression.values;
      const indices: number[] = [];
      for (const [position, indexExpression] of expression.indices.entries()) {
        const index = run(indexExpression, `.indices[${position}]`);
        indices.push(index);
        if (!Number.isInteger(index) || index < 0) {
          throw new Error(`Formula lookup ${expression.table} index ${position} must be a non-negative integer`);
        }
        if (!Array.isArray(selected)) {
          throw new Error(`Formula lookup ${expression.table} has too many indices`);
        }
        if (index >= selected.length) {
          throw new Error(`Formula lookup ${expression.table} index ${position} is out of range`);
        }
        selected = selected[index]!;
      }
      if (Array.isArray(selected)) throw new Error(`Formula lookup ${expression.table} needs another index to select a scalar`);
      return finish(checked(selected, "Formula lookup"), undefined, {
        table: expression.table, indices, selectedValue: selected,
      });
    }
    case "add": return finish(expression.terms.reduce((sum, term, index) => checked(sum + run(term, `.terms[${index}]`), "Addition"), 0));
    case "multiply": return finish(expression.terms.reduce((product, term, index) => checked(product * run(term, `.terms[${index}]`), "Multiplication"), 1));
    case "subtract": return finish(checked(run(expression.left, ".left") - run(expression.right, ".right"), "Subtraction"));
    case "divide": {
      const numerator = run(expression.left, ".left");
      const denominator = run(expression.right, ".right");
      if (denominator === 0) throw new Error("Formula division by zero");
      return finish(checked(numerator / denominator, "Division"));
    }
    case "min": return finish(expression.terms.reduce((value, term, index) => Math.min(value, run(term, `.terms[${index}]`)), Infinity));
    case "max": return finish(expression.terms.reduce((value, term, index) => Math.max(value, run(term, `.terms[${index}]`)), -Infinity));
    case "truncate": return finish(Math.trunc(run(expression.value, ".value")));
    case "clamp": {
      const value = run(expression.value, ".value");
      const lower = run(expression.min, ".min");
      const upper = run(expression.max, ".max");
      if (lower > upper) throw new Error("Formula clamp minimum must not exceed maximum");
      return finish(Math.min(upper, Math.max(lower, value)));
    }
    case "condition": {
      const left = run(expression.left, ".left");
      const right = run(expression.right, ".right");
      const matched = expression.operator === "lt" ? left < right : expression.operator === "lte" ? left <= right : left === right;
      const selectedBranch = matched ? "whenTrue" : "whenFalse";
      return finish(run(expression[selectedBranch], `.${selectedBranch}`), {
        operator: expression.operator,
        left,
        right,
        matched,
        selectedBranch,
      });
    }
  }
}

/** Trusted in-code graph entry point; imported expressions must use evaluateFormulaExpression. */
export function executeFormulaExpression(expression: FormulaExpression, values: Record<string, number>): number {
  return execute(expression, values);
}

/** Replays an expression and returns executed operations in child-before-parent order. */
export function executeFormulaExpressionDetailed(
  expression: FormulaExpression,
  values: Record<string, number>,
): { value: number; steps: FormulaExecutionStep[] } {
  validateFormulaExpression(expression);
  validateVariables(expression, values);
  const steps: FormulaExecutionStep[] = [];
  const value = execute(expression, values, (step) => steps.push(step));
  return { value, steps };
}

/** Conditions evaluate only the selected branch; every referenced input is validated. */
export function evaluateFormulaExpression(expression: FormulaExpression, values: Record<string, number>): number {
  validateFormulaExpression(expression);
  validateVariables(expression, values);
  return execute(expression, values);
}

function numericText(value: number): string {
  const text = Object.is(value, -0) ? "-0" : String(value);
  return value < 0 || Object.is(value, -0) ? `(${text})` : text;
}

function format(expression: FormulaExpression, values?: Record<string, number>): string {
  const child = (value: FormulaExpression) => format(value, values);
  switch (expression.kind) {
    case "constant": return numericText(expression.value);
    case "variable": return values ? numericText(values[expression.key]!) : expression.key;
    case "lookup": return `${expression.table}${expression.indices.map((index) => `[${child(index)}]`).join("")}`;
    case "add": return expression.terms.length ? `(${expression.terms.map(child).join(" + ")})` : "0";
    case "multiply": return expression.terms.length ? `(${expression.terms.map(child).join(" × ")})` : "1";
    case "subtract": return `(${child(expression.left)} − ${child(expression.right)})`;
    case "truncate": return `trunc(${child(expression.value)})`;
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

/** Omitting values produces symbols; supplying values produces unrounded substitution. */
export function formatFormulaExpression(expression: FormulaExpression, values?: Record<string, number>): string {
  validateFormulaExpression(expression);
  if (values !== undefined) validateVariables(expression, values);
  return format(expression, values);
}

export const evaluateExpression = evaluateFormulaExpression;
export const formatExpression = formatFormulaExpression;

function validateTraceInput(input: TraceInput): void {
  if (!isRecord(input)) throw new Error("Trace input must be an object");
  nonempty(input.key, "Trace input key");
  finite(input.value, `Trace input ${input.key}`);
  nonempty(input.unit, `Trace input ${input.key} unit`);
  nonempty(input.meaningKey, `Trace input ${input.key} meaningKey`);
  if (typeof input.origin === "string") {
    nonempty(input.origin, `Trace input ${input.key} origin`);
  } else {
    if (!isRecord(input.origin)) throw new Error("Trace input origin must be a string or object");
    nonempty(input.origin.kind, "Trace input origin kind");
    if (input.origin.reference !== undefined) nonempty(input.origin.reference, "Trace input origin reference");
  }
  if (input.context !== undefined) {
    if (!isRecord(input.context)) throw new Error("Trace input context must be an object");
    for (const [key, value] of Object.entries(input.context)) {
      nonempty(key, "Trace input context key");
      if (typeof value === "number") finite(value, `Trace input context ${key}`);
      else if (value !== null && typeof value !== "string" && typeof value !== "boolean") {
        throw new Error("Trace input context values must be string, finite number, boolean or null");
      }
    }
  }
}

function stringList(values: unknown, label: string): asserts values is string[] {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`);
  for (const value of values) nonempty(value, label);
}

function immutableClone<T>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (object: unknown): void => {
    if (object !== null && typeof object === "object") {
      for (const child of Object.values(object)) freeze(child);
      Object.freeze(object);
    }
  };
  freeze(copy);
  return copy;
}

/**
 * Executes nodes in dependency order. childIds must name already executed nodes.
 * Returned arrays are snapshots, and nodes are immutable to prevent stale traces.
 */
export class TraceBuilder {
  private readonly traceNodes: CalculationTraceNode[] = [];
  private readonly sourceRefs: string[];

  constructor(sourceRefs: string[] = []) {
    stringList(sourceRefs, "Trace source references");
    this.sourceRefs = [...sourceRefs];
  }

  get nodes(): CalculationTraceNode[] {
    return [...this.traceNodes];
  }

  add(
    id: string,
    titleKey: string,
    expression: FormulaExpression,
    inputs: TraceInput[],
    options: TraceNodeOptions = {},
  ): number {
    nonempty(id, "Trace node id");
    nonempty(titleKey, "Trace titleKey");
    if (this.traceNodes.some((node) => node.id === id)) throw new Error(`Duplicate trace node id: ${id}`);
    if (typeof options !== "object" || options === null || Array.isArray(options)) throw new Error("Trace options must be an object");
    const ruleId = options.ruleId ?? id;
    const explanationKey = options.explanationKey ?? titleKey;
    nonempty(ruleId, "Trace ruleId");
    nonempty(explanationKey, "Trace explanationKey");
    if (options.parentId !== undefined) nonempty(options.parentId, "Trace parentId");
    if (options.applicabilityReason !== undefined) nonempty(options.applicabilityReason, "Trace applicability reason");
    const status = options.status ?? "applied";
    if (!["applied", "not-applicable", "assumed", "blocked"].includes(status)) throw new Error("Unknown trace status");
    if (status === "blocked") throw new Error("Blocked trace nodes must not execute or produce a numeric result");
    const childIds = options.childIds ?? [];
    const sourceRefs = options.sourceRefs ?? this.sourceRefs;
    const warnings = options.warnings ?? [];
    stringList(childIds, "Trace childIds");
    stringList(sourceRefs, "Trace source references");
    stringList(warnings, "Trace warnings");
    if (new Set(childIds).size !== childIds.length) throw new Error("Trace childIds must not contain duplicates");
    for (const childId of childIds) {
      if (!this.traceNodes.some((node) => node.id === childId)) throw new Error(`Unknown or unexecuted trace child: ${childId}`);
    }
    if (!Array.isArray(inputs)) throw new Error("Trace inputs must be an array");
    const values: Record<string, number> = Object.create(null) as Record<string, number>;
    for (const input of inputs) {
      validateTraceInput(input);
      if (Object.prototype.hasOwnProperty.call(values, input.key)) throw new Error(`Duplicate trace input: ${input.key}`);
      values[input.key] = input.value;
    }
    const value = evaluateFormulaExpression(expression, values);
    const unit = options.unit ?? "ratio";
    nonempty(unit, "Trace result unit");
    const displayDigits = options.displayDigits ?? 6;
    if (!Number.isInteger(displayDigits) || displayDigits < 0 || displayDigits > 15) {
      throw new Error("Trace displayDigits must be an integer from 0 to 15");
    }
    const result: TraceValue = {
      value,
      display: new Intl.NumberFormat("zh-CN", { maximumFractionDigits: displayDigits }).format(value),
      unit,
    };
    const node: CalculationTraceNode = {
      id,
      ruleId,
      titleKey,
      explanationKey,
      status,
      expression,
      inputs,
      result,
      childIds,
      sourceRefs,
      warnings,
      symbolicFormula: format(expression),
      substitution: format(expression, values),
      ...(options.parentId !== undefined ? { parentId: options.parentId } : {}),
      ...(options.applicabilityReason !== undefined ? { applicabilityReason: options.applicabilityReason } : {}),
    };
    this.traceNodes.push(immutableClone(node));
    return value;
  }
}
