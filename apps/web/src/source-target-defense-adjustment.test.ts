import { expect, it } from "vitest";
import { sourceTargetProfileClause, type SourceTargetProfile } from "./source-target-profile";

const base: SourceTargetProfile = { level: 90, resistance: 0.1 };

it("preserves omitted DEF adjustment and emits explicit signed scenario values", () => {
  expect(sourceTargetProfileClause(base)).toBe("target lvl=90 resist=0.1 radius=2 pos=0,2.4;");
  expect(sourceTargetProfileClause({ ...base, defenseAdjustment: -0.3 })).toContain("def_adjustment=-0.3;");
  expect(sourceTargetProfileClause({ ...base, defenseAdjustment: 0.2 })).toContain("def_adjustment=0.2;");
});

it("rejects DEF adjustments outside the supported finite range", () => {
  for (const defenseAdjustment of [-1.0001, 0.9001, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => sourceTargetProfileClause({ ...base, defenseAdjustment })).toThrow(/目标防御调整/);
  }
});
