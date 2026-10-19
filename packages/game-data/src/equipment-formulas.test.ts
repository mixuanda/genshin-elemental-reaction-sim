import { expect, it } from "vitest";
import { evaluateFormulaExpression } from "../../sim-core/src/calculation-trace";
import { resolveWeaponFormulaEffects, resolveArtifactFormulaEffects, type EquipmentFormulaResolution } from "./equipment-formulas";

const panel = { atk: 2000, hp: 20000, def: 1000, em: 800, baseAtk: 1000, erRatio: 2.5 };
const cases = [
  { id: "weapon:13501", stacks: 0, r1: { hpPercent: 0.2, flatAtk: 360 }, r5: { hpPercent: 0.4, flatAtk: 680 } },
  { id: "weapon:11505", stacks: 0, r1: { hpPercent: 0.2, flatAtk: 240 }, r5: { hpPercent: 0.4, flatAtk: 480 } },
  { id: "weapon:13509", stacks: 0, r1: { energyRechargeBonus: 0.3, atkPercent: 0.42 }, r5: { energyRechargeBonus: 0.5, atkPercent: 0.84 } },
  { id: "weapon:13511", stacks: 3, r1: { flatAtk: 1088 }, r5: { flatAtk: 2176 } },
  { id: "weapon:11418", stacks: 0, r1: { energyRechargeBonus: 0.252 }, r5: { energyRechargeBonus: 0.504 } },
  { id: "weapon:12415", stacks: 0, r1: { flatAtk: 168 }, r5: { flatAtk: 336 } },
  { id: "weapon:12504", stacks: 5, r1: { atkPercent: 0.4 }, r5: { atkPercent: 0.8 } },
  { id: "weapon:14504", stacks: 5, r1: { atkPercent: 0.4 }, r5: { atkPercent: 0.8 } },
  { id: "weapon:13504", stacks: 5, r1: { atkPercent: 0.4 }, r5: { atkPercent: 0.8 } },
  { id: "weapon:13505", stacks: 7, r1: { atkPercent: 0.224, hitBonus: 0.12 }, r5: { atkPercent: 0.42, hitBonus: 0.24 } },
  { id: "weapon:13507", stacks: 6, r1: { atkPercent: 0.384, hitBonus: 0.12 }, r5: { atkPercent: 0.768, hitBonus: 0.24 } },
  { id: "weapon:11511", stacks: 3, r1: { hpPercent: 0.2, em: 188 }, r5: { hpPercent: 0.4, em: 376 } },
  { id: "artifact-set:15020", stacks: 0, r1: { hitBonus: 0.625 }, r5: { hitBonus: 0.625 } },
  { id: "artifact-set:15021", stacks: 4, r1: { defPercent: 0.24, hitBonus: 0.24 }, r5: { defPercent: 0.24, hitBonus: 0.24 } }
];
const totals = (result: EquipmentFormulaResolution, values = panel): Record<string, number> => {
  const sum: Record<string, number> = {};
  for (const modifier of [...result.statModifiers, ...result.dynamicHitBonuses.map(bonus => ({ ...bonus, target: "hitBonus" }))]) {
    expect(modifier.inputs.some(entry => Object.hasOwn(panel, entry.key))).toBe(false);
    const number = evaluateFormulaExpression(modifier.expression, { ...values, ...Object.fromEntries(modifier.inputs.map(entry => [entry.key, entry.value])) });
    sum[modifier.target] = (sum[modifier.target] ?? 0) + number;
  }
  return sum;
};

it.each(cases)("executes source clauses and boundary semantics for $id", row => {
  const context = { hpFraction: 0.4, weaponStacks: row.stacks, setStacks: row.stacks, shielded: true, offField: true, burstEffectActive: true, timedEffectActive: true, keyTeamBuffActive: true, timedSnapshotEm: 700, keySnapshotHp: 30000, keyTeamSnapshotHp: 40000 };
  const resolve = (refinement: number) => row.id.startsWith("weapon:")
    ? resolveWeaponFormulaEffects({ weaponId: row.id, refinement, enabled: true, context })
    : resolveArtifactFormulaEffects({ setId: row.id, pieces: 4, enabled: true, context });
  for (const refinement of [1, 2, 3, 4, 5]) {
    const result = resolve(refinement);
    expect(result.missingConditions).toEqual([]);
    const computed = totals(result);
    expect(Object.values(computed).every(Number.isFinite)).toBe(true);
    expect(result.sourceRefs.some(ref => ref.includes("b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541"))).toBe(true);
    if (refinement === 1 || refinement === 5) {
      const expected = refinement === 1 ? row.r1 : row.r5;
      for (const [target, value] of Object.entries(expected)) expect(computed[target]).toBeCloseTo(value, 12);
    }
  }
  if (row.id === "weapon:13501") {
    const result = resolveWeaponFormulaEffects({ weaponId: row.id, refinement: 1, enabled: true, context: { hpFraction: 0.5 } });
    expect(result.missingConditions.join()).toMatch(/50%生命边界来源冲突/);
    expect(resolveWeaponFormulaEffects({ weaponId: row.id, refinement: 1, enabled: true }).missingConditions.join()).toMatch(/hpFraction/);
  }
  if (["weapon:11418", "weapon:12415"].includes(row.id)) {
    expect(resolveWeaponFormulaEffects({ weaponId: row.id, refinement: 1, enabled: true, context: { timedEffectActive: true } }).missingConditions.join()).toMatch(/timedSnapshotEm/);
    const inactive = resolveWeaponFormulaEffects({ weaponId: row.id, refinement: 1, enabled: true, context: { timedEffectActive: false } });
    expect(inactive.missingConditions).toEqual([]);
    expect(Object.values(totals(inactive))).toEqual([0]);
  }
  if (row.id === "weapon:11511") {
    const { keyTeamSnapshotHp: _omitted, ...withoutTeamSnapshot } = context;
    expect(resolveWeaponFormulaEffects({ weaponId: row.id, refinement: 1, enabled: true, context: withoutTeamSnapshot }).missingConditions.join()).toMatch(/keyTeamSnapshotHp/);
  }
  if (row.id === "artifact-set:15020") {
    const result = resolve(1);
    expect(result.dynamicHitBonuses[0]?.attackTags).toEqual(["burst"]);
    expect(result.dynamicHitBonuses[0]?.inputPolicy).toBe("pre-conversion");
    expect(totals(result, { ...panel, erRatio: 5 }).hitBonus).toBe(0.75);
  }
  if (row.id === "weapon:13509") {
    expect(totals(resolve(1), { ...panel, erRatio: 0.8 }).atkPercent).toBe(0);
    expect(totals(resolve(1), { ...panel, erRatio: 10 }).atkPercent).toBe(0.8);
  }
  if (row.id.startsWith("weapon:") && row.stacks > 0) expect(() => resolveWeaponFormulaEffects({ weaponId: row.id, refinement: 1, enabled: true, context: { ...context, weaponStacks: row.stacks + 1 } })).toThrow(/层数/);
  if (row.id === "artifact-set:15021") expect(() => resolveArtifactFormulaEffects({ setId: row.id, pieces: 4, enabled: true, context: { setStacks: 5 } })).toThrow(/层数/);
});
