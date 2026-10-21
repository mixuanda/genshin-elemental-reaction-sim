import { describe, expect, it } from "vitest";
import {
  evaluateFormulaExpression,
  executeFormulaExpressionDetailed,
  expr,
  formatFormulaExpression,
  TraceBuilder,
  traceInput,
  traceText,
  validateFormulaExpression,
  type FormulaExpression,
  type TraceInput,
} from "../calculation-trace";

describe("typed formula execution", () => {
  it("uses the same toward-zero truncation for execution and numerical substitution", () => {
    const formula = expr.trunc(expr.input("frames"));
    expect(evaluateFormulaExpression(formula, { frames: 9.75 })).toBe(9);
    expect(evaluateFormulaExpression(formula, { frames: -9.75 })).toBe(-9);
    expect(formatFormulaExpression(formula, { frames: -9.75 })).toBe("trunc((-9.75))");
  });
  it("evaluates ordered mixed scaling and resource caps without parsing formula strings", () => {
    const formula = expr.add(
      expr.mul(expr.input("atk"), expr.value(2)),
      expr.mul(expr.input("hp"), expr.value(0.1)),
      expr.mul(expr.clamp(expr.input("stacks"), expr.value(0), expr.value(3)), expr.value(50)),
    );
    expect(evaluateFormulaExpression(formula, { atk: 2_000, hp: 30_000, stacks: 9 })).toBe(7_150);
    expect(evaluateFormulaExpression(formula, { atk: 2_000, hp: 30_000, stacks: -1 })).toBe(7_000);
  });

  it("preserves explicit modifier order", () => {
    const baseThenAdd = expr.add(expr.mul(expr.input("atk"), expr.value(2)), expr.value(300));
    const addThenBase = expr.mul(expr.add(expr.input("atk"), expr.value(300)), expr.value(2));
    expect(evaluateFormulaExpression(baseThenAdd, { atk: 2_000 })).toBe(4_300);
    expect(evaluateFormulaExpression(addThenBase, { atk: 2_000 })).toBe(4_600);
  });

  it("supports n-ary min/max, subtraction, division and empty sum/product identities", () => {
    expect(evaluateFormulaExpression(expr.max(expr.value(3), expr.value(5), expr.value(4)), {})).toBe(5);
    expect(evaluateFormulaExpression(expr.min(expr.value(3), expr.value(5), expr.value(4)), {})).toBe(3);
    expect(evaluateFormulaExpression(expr.div(expr.sub(expr.value(12), expr.value(2)), expr.value(4)), {})).toBe(2.5);
    expect(evaluateFormulaExpression(expr.add(), {})).toBe(0);
    expect(evaluateFormulaExpression(expr.mul(), {})).toBe(1);
  });

  it.each([
    ["lt", 1, 1, 20],
    ["lt", 0, 1, 10],
    ["lte", 1, 1, 10],
    ["lte", 2, 1, 20],
    ["equal", 1, 1, 10],
    ["equal", 2, 1, 20],
  ] as const)("takes the correct %s branch at %s and %s", (operator, left, right, expected) => {
    expect(evaluateFormulaExpression(expr.condition(operator, expr.value(left), expr.value(right), expr.value(10), expr.value(20)), {})).toBe(expected);
  });

  it("does not execute arithmetic in an inactive conditional branch", () => {
    const expression = expr.condition("equal", expr.input("value"), expr.value(0), expr.value(1), expr.div(expr.value(1), expr.input("value")));
    expect(evaluateFormulaExpression(expression, { value: 0 })).toBe(1);
    expect(evaluateFormulaExpression(expression, { value: 2 })).toBe(0.5);
  });

  it("replays nested operations and the selected conditional branch as ordered steps", () => {
    const expression = expr.condition(
      "equal",
      expr.input("mode"),
      expr.value(1),
      expr.min(expr.mul(expr.input("base"), expr.value(2)), expr.value(7)),
      expr.div(expr.value(1), expr.value(0)),
    );
    const restored = JSON.parse(JSON.stringify(expression)) as FormulaExpression;
    const detailed = executeFormulaExpressionDetailed(restored, { mode: 1, base: 4 });
    expect(detailed.value).toBe(evaluateFormulaExpression(expression, { mode: 1, base: 4 }));
    expect(detailed.steps.map(({ path, kind, result }) => ({ path, kind, result }))).toEqual([
      { path: "$.whenTrue.terms[0]", kind: "multiply", result: 8 },
      { path: "$.whenTrue", kind: "min", result: 7 },
      { path: "$", kind: "condition", result: 7 },
    ]);
    expect(detailed.steps[0]).toMatchObject({ symbolicFormula: "(base × 2)", substitution: "(4 × 2)" });
    expect(detailed.steps[2]?.condition).toEqual({
      operator: "equal", left: 1, right: 1, matched: true, selectedBranch: "whenTrue",
    });
    expect(detailed.steps.some(({ path }) => path.startsWith("$.whenFalse"))).toBe(false);
  });

  it("evaluates the resistance boundaries through a conditional expression", () => {
    const r = expr.input("res");
    const expression = expr.condition("lt", r, expr.value(0), expr.sub(expr.value(1), expr.div(r, expr.value(2))),
      expr.condition("lt", r, expr.value(0.75), expr.sub(expr.value(1), r), expr.div(expr.value(1), expr.add(expr.value(1), expr.mul(expr.value(4), r)))));
    for (const [res, expected] of [[-0.2, 1.1], [0, 1], [0.1, 0.9], [0.75, 0.25], [1, 0.2]]) {
      expect(evaluateFormulaExpression(expression, { res: res! })).toBeCloseTo(expected!, 12);
    }
  });

  it("rejects invalid arithmetic instead of emitting NaN, Infinity or a substituted zero", () => {
    expect(() => evaluateFormulaExpression(expr.input("missing"), {})).toThrow(/Missing formula variable/);
    expect(() => evaluateFormulaExpression(expr.input("atk"), { atk: Infinity })).toThrow(/finite number/);
    expect(() => evaluateFormulaExpression(expr.value(NaN), {})).toThrow(/finite number/);
    expect(() => evaluateFormulaExpression(expr.div(expr.value(1), expr.value(-0)), {})).toThrow(/division by zero/);
    expect(() => evaluateFormulaExpression(expr.mul(expr.value(Number.MAX_VALUE), expr.value(2)), {})).toThrow(/finite number/);
    expect(() => evaluateFormulaExpression(expr.add(expr.value(Number.MAX_VALUE), expr.value(Number.MAX_VALUE)), {})).toThrow(/finite number/);
    expect(() => evaluateFormulaExpression(expr.clamp(expr.value(1), expr.value(2), expr.value(0)), {})).toThrow(/minimum/);
    expect(() => evaluateFormulaExpression(expr.min(), {})).toThrow(/at least one term/);
  });

  it("rejects inherited inputs and requires variables even in a currently inactive branch", () => {
    const inherited = Object.create({ atk: 2_000 }) as Record<string, number>;
    expect(() => evaluateFormulaExpression(expr.input("atk"), inherited)).toThrow(/Missing formula variable/);
    const expression = expr.condition("equal", expr.value(1), expr.value(1), expr.value(10), expr.input("missing"));
    expect(() => evaluateFormulaExpression(expression, {})).toThrow(/Missing formula variable/);
  });

  it("rejects malformed, executable-string, cyclic and oversized expression trees", () => {
    expect(() => validateFormulaExpression("atk * 2")).toThrow(/must be an object/);
    expect(() => validateFormulaExpression({ kind: "eval", code: "1 + 1" })).toThrow(/Unknown formula expression kind/);
    expect(() => validateFormulaExpression({ kind: "condition", operator: "javascript" })).toThrow(/operator/);
    expect(() => validateFormulaExpression({ kind: "add", terms: [null] })).toThrow(/must be an object/);
    const cycle: FormulaExpression = expr.add();
    if (cycle.kind === "add") cycle.terms.push(cycle);
    expect(() => validateFormulaExpression(cycle)).toThrow(/cycle/);
    let deep: FormulaExpression = expr.value(1);
    for (let index = 0; index < 130; index++) deep = expr.add(deep);
    expect(() => validateFormulaExpression(deep)).toThrow(/maximum depth/);
    expect(() => validateFormulaExpression(expr.add(...Array.from({ length: 10_001 }, () => expr.value(1))))).toThrow(/node count/);
  });

  it("accepts a reused expression node without mistaking a DAG for a cycle", () => {
    const shared = expr.input("atk");
    expect(evaluateFormulaExpression(expr.add(shared, shared), { atk: 10 })).toBe(20);
  });
});

describe("formula-derived explanations", () => {
  it("derives both symbolic and numerical expressions from the same tree", () => {
    const formula = expr.add(expr.mul(expr.input("baseAtk"), expr.add(expr.value(1), expr.input("atkPct"))), expr.input("flatAtk"));
    expect(formatFormulaExpression(formula)).toBe("((baseAtk × (1 + atkPct)) + flatAtk)");
    expect(formatFormulaExpression(formula, { baseAtk: 1_000, atkPct: 0.8, flatAtk: 200 })).toBe("((1000 × (1 + 0.8)) + 200)");
    expect(evaluateFormulaExpression(formula, { baseAtk: 1_000, atkPct: 0.8, flatAtk: 200 })).toBe(2_000);
    expect(formatFormulaExpression(formula, { baseAtk: 1_000, atkPct: 0.9, flatAtk: 200 })).toBe("((1000 × (1 + 0.9)) + 200)");
    expect(evaluateFormulaExpression(formula, { baseAtk: 1_000, atkPct: 0.9, flatAtk: 200 })).toBe(2_100);
  });

  it("preserves unrounded precision and unambiguous negative substitutions", () => {
    const value = 0.1 + 0.2;
    expect(formatFormulaExpression(expr.input("result"), { result: value })).toBe("0.30000000000000004");
    expect(formatFormulaExpression(expr.sub(expr.value(1), expr.input("res")), { res: -0.2 })).toBe("(1 − (-0.2))");
    expect(formatFormulaExpression(expr.value(-0))).toBe("(-0)");
  });

  it("keeps explicit branches, caps and extrema inspectable", () => {
    const expression = expr.condition("lte", expr.input("hp"), expr.value(50), expr.max(expr.value(1), expr.value(2)), expr.clamp(expr.input("stacks"), expr.value(0), expr.min(expr.value(3), expr.value(4))));
    expect(formatFormulaExpression(expression)).toBe("(if hp ≤ 50 then max(1, 2) else clamp(stacks, 0, min(3, 4)))");
    expect(() => formatFormulaExpression(expression, { hp: 50 })).toThrow(/Missing formula variable/);
  });
});

describe("executed trace graphs", () => {
  it("executes the mandatory ordinary-damage arithmetic and its weighted expectation", () => {
    const trace = new TraceBuilder(["synthetic:fixture-a"]);
    const base = trace.add("base", "atk.base", expr.add(expr.input("character"), expr.input("weapon")), [traceInput("character", 300, "ATK"), traceInput("weapon", 700, "ATK")]);
    const atk = trace.add("atk", "atk.final", expr.add(expr.mul(expr.input("base"), expr.add(expr.value(1), expr.input("pct"))), expr.input("flat")), [traceInput("base", base), traceInput("pct", 0.8), traceInput("flat", 200)], { childIds: ["base"] });
    const damage = trace.add("noncrit", "damage.nonCritical", expr.mul(expr.add(expr.mul(expr.input("atk"), expr.value(2)), expr.value(300)), expr.value(1.5), expr.div(expr.value(190), expr.value(380)), expr.value(0.9)), [traceInput("atk", atk)], { childIds: ["atk"], unit: "damage" });
    const critical = trace.add("crit", "damage.critical", expr.mul(expr.input("noncrit"), expr.add(expr.value(1), expr.input("cd"))), [traceInput("noncrit", damage), traceInput("cd", 1.2)], { childIds: ["noncrit"], unit: "damage" });
    const expected = trace.add("expected", "damage.expected", expr.mul(expr.input("noncrit"), expr.add(expr.value(1), expr.mul(expr.input("cr"), expr.input("cd")))), [traceInput("noncrit", damage), traceInput("cr", 0.7), traceInput("cd", 1.2)], { childIds: ["noncrit"], unit: "damage" });
    expect(base).toBe(1_000);
    expect(atk).toBe(2_000);
    expect(damage).toBeCloseTo(2_902.5, 9);
    expect(critical).toBeCloseTo(6_385.5, 9);
    expect(expected).toBeCloseTo(5_340.6, 9);
    expect(0.3 * damage + 0.7 * critical).toBeCloseTo(expected, 9);
    for (const node of trace.nodes) {
      const variables = Object.fromEntries(node.inputs.map((input) => [input.key, input.value]));
      expect(node.result?.value).toBe(evaluateFormulaExpression(node.expression, variables));
      expect(node.symbolicFormula).toBe(formatFormulaExpression(node.expression));
      expect(node.substitution).toBe(formatFormulaExpression(node.expression, variables));
    }
  });

  it("keeps display rounding separate from subsequent arithmetic", () => {
    const trace = new TraceBuilder();
    const third = trace.add("third", "third", expr.div(expr.value(1), expr.value(3)), [], { displayDigits: 2 });
    const final = trace.add("final", "final", expr.mul(expr.input("third"), expr.value(3)), [traceInput("third", third)], { childIds: ["third"] });
    expect(trace.nodes[0]?.result?.display).toBe("0.33");
    expect(trace.nodes[0]?.result?.value).toBe(1 / 3);
    expect(trace.nodes[1]?.substitution).toBe("(0.3333333333333333 × 3)");
    expect(final).toBe(1);
  });

  it("preserves input provenance and isolates completed traces from caller mutation", () => {
    const sourceRefs = ["test:source"];
    const trace = new TraceBuilder(sourceRefs);
    const input: TraceInput = { ...traceInput("atk", 2_000, "ATK", { kind: "imported-final-panel", reference: "public-showcase" }, "stat.atk"), context: { buildMode: "imported", derived: false } };
    const expression = expr.input("atk");
    trace.add("atk", "stat.atk", expression, [input], { explanationKey: "stat.importedEntry", status: "assumed", applicabilityReason: "Supplied final panel; no reconstruction", warnings: ["source decomposition unavailable"] });
    input.value = 3_000;
    input.context!.buildMode = "changed";
    sourceRefs.push("other");
    if (expression.kind === "variable") expression.key = "changed";
    const nodes = trace.nodes;
    expect(nodes[0]?.inputs[0]?.value).toBe(2_000);
    expect(nodes[0]?.inputs[0]?.context).toEqual({ buildMode: "imported", derived: false });
    expect(nodes[0]?.sourceRefs).toEqual(["test:source"]);
    expect(nodes[0]?.symbolicFormula).toBe("atk");
    expect(Object.isFrozen(nodes[0])).toBe(true);
    expect(Object.isFrozen(nodes[0]?.inputs[0]?.context)).toBe(true);
    nodes.pop();
    expect(trace.nodes).toHaveLength(1);
  });

  it("round trips expression, input provenance and raw results through JSON", () => {
    const trace = new TraceBuilder(["test:rule@1"]);
    trace.add("value", "value.title", expr.div(expr.input("input"), expr.value(7)), [traceInput("input", 10, "damage", "manual-final-panel")], { ruleId: "exact-rule@1", explanationKey: "value.explanation" });
    const original = trace.nodes[0]!;
    const restored = JSON.parse(JSON.stringify(original)) as typeof original;
    expect(evaluateFormulaExpression(restored.expression, Object.fromEntries(restored.inputs.map((input) => [input.key, input.value])))).toBe(original.result!.value);
    expect(restored).toEqual(original);
  });

  it("rejects duplicate identifiers and unresolved dependency edges", () => {
    const trace = new TraceBuilder();
    trace.add("first", "first", expr.value(1), []);
    expect(() => trace.add("first", "first", expr.value(2), [])).toThrow(/Duplicate trace node/);
    expect(() => trace.add("second", "second", expr.value(2), [], { childIds: ["missing"] })).toThrow(/Unknown or unexecuted/);
    expect(() => trace.add("second", "second", expr.value(2), [], { childIds: ["first", "first"] })).toThrow(/duplicates/);
    expect(() => trace.add("second", "second", expr.input("atk"), [traceInput("atk", 1), traceInput("atk", 2)])).toThrow(/Duplicate trace input/);
    expect(trace.nodes).toHaveLength(1);
  });

  it("rejects invalid trace metadata and never creates a numeric blocked result", () => {
    const trace = new TraceBuilder();
    expect(() => trace.add("blocked", "blocked", expr.value(0), [], { status: "blocked" })).toThrow(/must not execute/);
    expect(() => trace.add("badDisplay", "title", expr.value(1), [], { displayDigits: NaN })).toThrow(/displayDigits/);
    expect(() => trace.add("badInput", "title", expr.input("atk"), [{ ...traceInput("atk", 1), context: { bad: Infinity } }])).toThrow(/finite number/);
    expect(() => traceInput("", 1)).toThrow(/non-empty/);
    expect(() => traceInput("atk", NaN)).toThrow(/finite number/);
    expect(trace.nodes).toHaveLength(0);
  });

  it("uses explicit localization keys with a safe unknown-key fallback", () => {
    expect(traceText("trace.substitution")).toBe("实际数值代入");
    expect(traceText("new.rule.explanation")).toBe("new.rule.explanation");
    expect(traceText("toString")).toBe("toString");
  });
});

it('indexed trace IDs retain failed-add and child-order validation with identical locale formatting',()=>{
 const b=new TraceBuilder();
 expect(()=>b.add('later','later',expr.value(1),[],{childIds:['missing']})).toThrow('Unknown');
 b.add('later','later',expr.value(-0.000000125),[],{displayDigits:9});
 expect(()=>b.add('later','duplicate',expr.value(2),[])).toThrow('Duplicate');
 for(let digits=0;digits<=15;digits++){
  b.add(`d${digits}`,'decimal',expr.value(12345.6789012345),[],{displayDigits:digits,childIds:['later']});
  expect(b.nodes.at(-1)!.result!.display).toBe(new Intl.NumberFormat('zh-CN',{maximumFractionDigits:digits}).format(12345.6789012345));
 }
 expect(Object.isFrozen(b.nodes[0])).toBe(true);
});
