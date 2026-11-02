import { describe, expect, it } from "vitest";
import { z } from "zod";
import { lunarExecutionArtifactsSchema, lunarExecutionPartySchema } from "./schema";

describe("dependency collection limits before element validation", () => {
  it("rejects an oversized array before parsing elements or running later refinements", () => {
    let elements = 0;
    let refinements = 0;
    const schema = z.array(z.preprocess(value => { elements++; return value; }, z.string()))
      .max(2).superRefine(() => { refinements++; });
    const result = schema.safeParse(["a", "b", "c"]);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Oversized array was accepted");
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0]).toMatchObject({ code: "too_big", maximum: 2, path: [] });
    expect({ elements, refinements }).toEqual({ elements: 0, refinements: 0 });
  });

  it("rejects an oversized Map before parsing either keys or values", () => {
    let keys = 0;
    let values = 0;
    const schema = z.map(
      z.preprocess(value => { keys++; return value; }, z.string()),
      z.preprocess(value => { values++; return value; }, z.number())
    ).max(1);
    const result = schema.safeParse(new Map([["a", 1], ["b", 2]]));
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Oversized Map was accepted");
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0]).toMatchObject({ code: "too_big", maximum: 1 });
    expect({ keys, values }).toEqual({ keys: 0, values: 0 });
  });

  it("rejects an oversized Set before parsing members", () => {
    let members = 0;
    const schema = z.set(z.preprocess(value => { members++; return value; }, z.string())).max(1);
    const result = schema.safeParse(new Set(["a", "b"]));
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Oversized Set was accepted");
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0]).toMatchObject({ code: "too_big", maximum: 1 });
    expect(members).toBe(0);
  });

  it("checks the real four-character execution limit before reading any character fields", () => {
    let reads = 0;
    const party = Array.from({ length: 5 }, () => ({
      get actorId(): string { reads++; throw new Error("Oversized party element was visited"); },
      characterKey: "synthetic-limit-probe"
    }));
    const result = lunarExecutionPartySchema.safeParse(party);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Five-character party was accepted");
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0]).toMatchObject({ code: "too_big", maximum: 4 });
    expect(reads).toBe(0);
  });

  it("checks the real artifact-owner count before reading any declarations", () => {
    let reads = 0;
    const artifacts = Array.from({ length: 5 }, () => ({
      get actorId(): string { reads++; throw new Error("Oversized artifact declaration was visited"); },
      kind: "thundering-fury-4pc" as const
    }));
    const result = lunarExecutionArtifactsSchema.safeParse(artifacts);
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Five artifact-owner declarations were accepted");
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0]).toMatchObject({ code: "too_big", maximum: 4 });
    expect(reads).toBe(0);
  });

  it("preserves valid boundary inputs and existing duplicate-owner rejection", () => {
    const party = Array.from({ length: 4 }, (_, index) => ({ actorId: `a-${index}`, characterKey: `synthetic-${index}` }));
    const before = structuredClone(party);
    expect(lunarExecutionPartySchema.parse(party)).toStrictEqual(party);
    expect(party).toStrictEqual(before);
    const duplicate = lunarExecutionPartySchema.safeParse([party[0], party[0]]);
    expect(duplicate.success).toBe(false);
    if (duplicate.success) throw new Error("Duplicate character owner was accepted");
    expect(duplicate.error.issues).toContainEqual(expect.objectContaining({
      code: "custom", path: [1, "actorId"], message: "party actor IDs must be unique"
    }));
    expect(lunarExecutionPartySchema.safeParse([]).success).toBe(false);
    expect(lunarExecutionPartySchema.safeParse([{ actorId: 0, characterKey: "synthetic" }]).success).toBe(false);
  });

  it("preserves explicitly ordered value rewrites before an upper bound", () => {
    const schema = z.array(z.string()).overwrite(values => values.slice(0, 2)).max(2);
    expect(schema.parse(["a", "b", "c"])).toStrictEqual(["a", "b"]);
  });
});
