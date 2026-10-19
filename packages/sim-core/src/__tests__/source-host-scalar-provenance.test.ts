import { describe, expect, it } from "vitest";
import { executeSourceHostScalarProvenance } from "../source-host-scalar-provenance";

const stats = Array(26).fill(0) as number[];
const nestedStatRead = {
  id: "stat-read-1", kind: "stat", frame: 10, actorIndex: 0, selector: [8], nonExtra: false,
  base: stats, steps: [], result: stats,
};

describe("source-host scalar provenance", () => {
  it("replays observed additions, skipped modifiers, a nested stat read and the original defense cap", () => {
    const receipt = { version: "scalar-provenance-v1", reads: [
      { id: "scalar-read-1", kind: "reaction-bonus", frame: 10, actorIndex: 0,
        element: "electro", base: 0, sum: 0.2, output: 0.2, transforms: [], steps: [
          { index: 0, key: "reaction", expiryBefore: 50, expiryAfter: 50, affectedByHitlag: false,
            element: "", closureOpaque: true, outcome: "applied", before: 0, delta: 0.2, after: 0.2,
            dependencies: [nestedStatRead] },
          { index: 1, key: "old", expiryBefore: 9, expiryAfter: 9, affectedByHitlag: false,
            element: "", closureOpaque: true, outcome: "expired", before: 0.2, delta: null, after: 0.2,
            dependencies: [] },
        ] },
      { id: "scalar-read-2", kind: "resistance", frame: 10, actorIndex: 0, targetKey: 1,
        element: "electro", base: 0.1, sum: -0.3, output: -0.3, transforms: [], steps: [
          { index: 0, key: "shred", expiryBefore: 50, expiryAfter: 50, affectedByHitlag: false,
            element: "electro", closureOpaque: false, outcome: "applied", before: 0.1, delta: -0.4, after: -0.3,
            dependencies: [] },
          { index: 1, key: "other-element", expiryBefore: 50, expiryAfter: 50, affectedByHitlag: false,
            element: "pyro", closureOpaque: false, outcome: "element-mismatch", before: -0.3, delta: null, after: -0.3,
            dependencies: [] },
        ] },
      { id: "scalar-read-3", kind: "defense-adjustment", frame: 10, targetKey: 1,
        element: "", base: 0, sum: 1.1, output: 0.9,
        transforms: [{ kind: "min", before: 1.1, limit: 0.9, after: 0.9 }], steps: [
          { index: 0, key: "def", expiryBefore: 50, expiryAfter: 50, affectedByHitlag: false,
            element: "", closureOpaque: false, outcome: "applied", before: 0, delta: 1.1, after: 1.1,
            dependencies: [] },
        ] },
    ] };
    const result = executeSourceHostScalarProvenance(receipt, {
      "reaction-bonus": 0.2, resistance: -0.3, "defense-adjustment": 0.9,
    });
    expect(result.finalNodeIds["defense-adjustment"]).toBe("sourceScalar.scalar-read-3.complete");
    expect(result.trace.some(node => node.id.includes("statDependency.0.stat-read-1.complete"))).toBe(true);
    expect(result.trace.find(node => node.id === "sourceScalar.scalar-read-3.transform.0")?.result?.value).toBe(0.9);
    expect(result.explanationGaps.some(gap => gap.includes("闭包"))).toBe(true);
    expect(() => executeSourceHostScalarProvenance(receipt, { resistance: -0.2 })).toThrow(/不一致/);
  });
});
