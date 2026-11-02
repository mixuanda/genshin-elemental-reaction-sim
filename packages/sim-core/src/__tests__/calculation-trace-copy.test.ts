import { describe, expect, it } from "vitest";
import { TraceBuilder, expr, traceInput, isImmutableTraceNode, type TraceInput } from "../calculation-trace";

describe("completed trace snapshot copy", () => {
  it("isolates caller-owned shared and shallow-frozen expression children", () => {
    const leaf = expr.input("atk");
    const expression = Object.freeze(expr.add(leaf, leaf));
    const builder = new TraceBuilder(["source"]);
    const input = { ...traceInput("atk", 4), context: { enabled: true } };
    expect(builder.add("first", "first", expression, [input])).toBe(8);
    const first = builder.nodes[0]!;
    expect(first.expression).toEqual(structuredClone(expression));
    if (first.expression.kind !== "add") throw Error("wrong expression");
    expect(first.expression.terms[0]).toBe(first.expression.terms[1]);
    expect(Object.isFrozen(first.expression.terms[0])).toBe(true);
    if (leaf.kind !== "variable") throw Error("wrong leaf");
    leaf.key = "other";
    input.context.enabled = false;
    expect(first.expression.terms[0]).toEqual({ kind: "variable", key: "atk" });
    expect(first.inputs[0]!.context).toEqual({ enabled: true });
    expect(builder.add("second", "second", expression, [traceInput("other", 7)])).toBe(14);
    expect(builder.nodes[1]!.expression).not.toEqual(first.expression);
  });

  it("accepts only privately immutable templates and preserves their full rebound graph", () => {
    const template = new TraceBuilder(["template/source"]);
    template.add("template.first", "first", expr.input("atk"), [traceInput("atk", 4)]);
    const first = template.nodes[0]!;
    expect(isImmutableTraceNode(first.expression)).toBe(true);
    const builder = new TraceBuilder(["caller/source"]);
    builder.appendImmutable(template.nodes, "template", "actual");
    expect(builder.nodes[0]!.expression).toBe(first.expression);
    expect(builder.nodes[0]!.result).toBe(first.result);
    expect(builder.nodes[0]!.id).toBe("actual.first");
    expect(builder.nodes[0]!.sourceRefs).toEqual(["caller/source"]);
    expect(() => builder.appendImmutable(template.nodes, "template", "actual")).toThrow(/Duplicate/);
    const forged = Object.freeze(structuredClone(first));
    expect(() => new TraceBuilder().appendImmutable([forged], "template", "forged")).toThrow(/privately/);
    expect(() => new TraceBuilder().appendImmutable(template.nodes, "wrong", "other")).toThrow(/namespace/);
    expect(() => { (first.expression as { key: string }).key = "forged"; }).toThrow();
    expect(isImmutableTraceNode(Object.freeze({ nested: {} }))).toBe(false);
  });

  it("retains child dependency order and remaps input references without mutating the template", () => {
    const template = new TraceBuilder();
    template.add("template.a", "first", expr.value(2), []);
    template.add("template.b", "second", expr.input("prior"), [traceInput("prior", 2, "stat", { kind: "previous-step", reference: "template.a" })], { childIds: ["template.a"] });
    const builder = new TraceBuilder(); builder.appendImmutable(template.nodes, "template", "actual");
    expect(builder.nodes[1]!.childIds).toEqual(["actual.a"]);
    expect(builder.nodes[1]!.inputs[0]!.origin).toEqual({ kind: "previous-step", reference: "actual.a" });
    expect(template.nodes[1]!.childIds).toEqual(["template.a"]);
    expect(() => new TraceBuilder().appendImmutable([template.nodes[1]!], "template", "broken")).toThrow(/unexecuted/);
  });

  it("preserves own __proto__ context data without changing the copy prototype", () => {
    const context = JSON.parse('{"__proto__":"literal","state":3}') as Record<string, string | number>;
    const builder = new TraceBuilder();
    builder.add("test", "test", expr.value(1), [{ ...traceInput("unused", 0), context }]);
    const saved = builder.nodes[0]!.inputs[0]!.context!;
    expect(Object.getPrototypeOf(saved)).toBe(Object.prototype);
    expect(Object.hasOwn(saved, "__proto__")).toBe(true);
    expect(saved["__proto__"]).toBe("literal");
    context["__proto__"] = "changed";
    expect(saved["__proto__"]).toBe("literal");
  });

  it("retains structuredClone handling of exceptional non-plain metadata", () => {
    const date = new Date("2020-01-01T00:00:00Z");
    const builder = new TraceBuilder();
    const input = { ...traceInput("x", 2), origin: { kind: "test", date } } as TraceInput;
    builder.add("test", "test", expr.input("x"), [input]);
    const origin = builder.nodes[0]!.inputs[0]!.origin as unknown as { date: Date };
    expect(origin.date).toEqual(date);
    date.setUTCFullYear(2021);
    expect(origin.date.getUTCFullYear()).toBe(2020);
    const bad = { ...traceInput("x", 2), origin: { kind: "test", callback() {} } } as TraceInput;
    expect(() => builder.add("bad", "bad", expr.input("x"), [bad])).toThrow();
  });
});
