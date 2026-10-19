import { expect, it } from "vitest";
import { sourceTargetProfileClause, sourceTargetResistanceValues, type SourceTargetProfile } from "./source-target-profile";

const base: SourceTargetProfile = { level: 90, resistance: 0.1 };

it("keeps legacy resist but emits eight absolute element values when any override exists", () => {
  expect(sourceTargetProfileClause(base)).toBe("target lvl=90 resist=0.1 radius=2 pos=0,2.4;");
  const target: SourceTargetProfile = { ...base, resistanceByElement: { pyro: 0.35, hydro: -0.2 } };
  const clause = sourceTargetProfileClause(target);
  expect(clause).not.toMatch(/\bresist=/);
  expect(clause).toContain("pyro=0.35");
  expect(clause).toContain("hydro=-0.2");
  expect(clause.match(/(?:electro|pyro|cryo|hydro|anemo|dendro|geo|physical)=/g)).toHaveLength(8);
  expect(sourceTargetResistanceValues(target)).toMatchObject({ electro: 0.1, pyro: 0.35, hydro: -0.2 });
  expect(sourceTargetProfileClause({ ...base, resistance: 1.5 })).toContain("resist=1.5");
  expect(sourceTargetProfileClause({ ...base, resistance: -2.5, resistanceByElement: { pyro: 2 } })).toContain("electro=-2.5 pyro=2");
});

it("emits explicit HP, freeze resistance and native particle tokens in order with exponent-free numbers", () => {
  const clause = sourceTargetProfileClause({ ...base, geometry: { radius: 1e-7, x: 0, y: 2.4 },
    freezeResistance: 0.3, hp: 1e21,
    particleDrops: { threshold: 1e-7, count: 2, element: "hydro" } });
  expect(clause).toMatch(/radius=0\.0000001 pos=0,2\.4 freeze_resist=0\.3 hp=1000000000000000000000 particle_threshold=0\.0000001 particle_drop_count=2 particle_element=hydro;$/);
  expect(clause).not.toMatch(/[eE][+-]?\d/);
});

it("rejects partial or nonfinite profile values without inventing target rules", () => {
  expect(() => sourceTargetProfileClause({ ...base, particleDrops: { threshold: 1, count: 1, element: "none" } })).toThrow(/生命/);
  expect(() => sourceTargetProfileClause({ ...base, hp: 0 })).toThrow(/正有限/);
  expect(() => sourceTargetProfileClause({ ...base, hp: 100, particleDrops: { threshold: 0, count: 1, element: "none" } })).toThrow(/正阈值/);
  expect(() => sourceTargetProfileClause({ ...base, resistanceByElement: { pyro: Number.POSITIVE_INFINITY } })).toThrow(/有限绝对值/);
  expect(() => sourceTargetProfileClause({ ...base, freezeResistance: 1.1 })).toThrow(/0–1/);
});
