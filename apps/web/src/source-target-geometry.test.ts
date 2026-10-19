import { expect, it } from "vitest";
import { defaultSourceTargetGeometry, resolveSourceTargetGeometry, sourceTargetGeometryClause } from "./source-target-geometry";

it("preserves the legacy clause only when geometry is wholly absent", () => {
  expect(resolveSourceTargetGeometry()).toEqual(defaultSourceTargetGeometry);
  expect(sourceTargetGeometryClause()).toBe("radius=2 pos=0,2.4");
  expect(sourceTargetGeometryClause({ radius: 1, x: 0, y: 0 })).toBe("radius=1 pos=0,0");
  expect(() => resolveSourceTargetGeometry({ radius: 1, x: 0 } as never)).toThrow(/有限/);
  expect(() => resolveSourceTargetGeometry({ radius: 0, x: 0, y: 0 })).toThrow(/大于零/);
});

it("expands finite shortest decimals into GCSL tokens without changing their numeric values", () => {
  for (const geometry of [
    { radius: 1e-7, x: -1.2e21, y: Number.MIN_VALUE },
    { radius: Number.MAX_VALUE, x: -0, y: 0 },
  ]) {
    const clause = sourceTargetGeometryClause(geometry);
    const tokens = /^radius=([^ ]+) pos=([^,]+),(.+)$/.exec(clause);
    expect(tokens).not.toBeNull();
    for (const [token, expected] of [[tokens![1]!, geometry.radius], [tokens![2]!, geometry.x], [tokens![3]!, geometry.y]] as const) {
      expect(token).toMatch(/^-?\d+(?:\.\d+)?$/);
      expect(token).not.toMatch(/[eE]/);
      expect(Number(token)).toBe(expected);
    }
  }
});
