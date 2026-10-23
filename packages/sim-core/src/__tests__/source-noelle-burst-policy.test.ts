import { describe, expect, it } from "vitest";
import { SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT } from "../source-host-wire";
import { resolveSourceNoelleBurstParameters } from "../source-noelle-burst-policy";

const input = { sourceRevision: SOURCE_HOST_COMMIT, characterKey: "noelle", constellation: 6, actionKind: "burst" };

for (const sourceRevision of [SOURCE_HOST_COMMIT, SOURCE_HOST_STELLAR_COMMIT]) {
  describe(sourceRevision.slice(0, 7), () => {
    it("makes unproved extension zero without mutating an ordinary draft", () => {
      const draft = { ...input, sourceRevision, parameters: { custom: 2 } };
      const original = structuredClone(draft);
      const resolution = resolveSourceNoelleBurstParameters(draft);
      expect(resolution.parameters).toEqual({ custom: 2, extend: 0 });
      expect(resolution.extension).toMatchObject({ seconds: 0, origin: "default-zero" });
      expect(resolution.extension!.message).toContain("未计额外延长");
      expect(draft).toEqual(original);
      expect(resolution.parameters).not.toBe(draft.parameters);
    });
    it.each([0, 3, 10])("preserves explicit %i seconds through JSON reopen without adding another extension", seconds => {
      const draft = { ...input, sourceRevision, parameters: { extend: seconds, custom: 2 } };
      const reopened = JSON.parse(JSON.stringify(draft));
      const resolution = resolveSourceNoelleBurstParameters(reopened);
      expect(resolution.parameters).toEqual(draft.parameters);
      expect(resolution.extension).toMatchObject({ seconds, origin: "explicit" });
      expect(resolveSourceNoelleBurstParameters({ ...reopened, parameters: resolution.parameters })).toEqual(resolution);
    });
  });
}

it.each([-1, 11, 0.5, Number.NaN, Number.POSITIVE_INFINITY, undefined, null, "3"])("rejects an explicit unsupported or unknown extension: %s", extend => {
  expect(() => resolveSourceNoelleBurstParameters({ ...input, parameters: { extend } as never })).toThrow(/0–10/);
});

it("preserves other actors, other actions and C0–C5 parameters without making C6 claims", () => {
  for (const changed of [{ characterKey: "itto" }, { actionKind: "skill" }, ...[0, 1, 2, 3, 4, 5].map(constellation => ({ constellation }))]) {
    const parameters = { custom: 2 };
    expect(resolveSourceNoelleBurstParameters({ ...input, ...changed, parameters })).toEqual({ parameters });
    expect(parameters).toEqual({ custom: 2 });
  }
});

it("refuses to transfer the pinned default policy to an unknown source revision", () => {
  expect(() => resolveSourceNoelleBurstParameters({ ...input, sourceRevision: "unverified" })).toThrow(/当前来源尚未核对/);
  expect(() => resolveSourceNoelleBurstParameters({ ...input, sourceRevision: "unverified", parameters: { extend: 3 } })).toThrow(/当前来源尚未核对/);
});

it.each([-1, 7, 1.5, Number.NaN])("rejects malformed Noelle constellation %s", constellation => {
  expect(() => resolveSourceNoelleBurstParameters({ ...input, constellation })).toThrow(/命之座/);
});
