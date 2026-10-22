import { describe, expect, it } from "vitest";
import { balanceFiveStarArtifactRolls } from "./artifact-budget-balance";
import { artifactMainStatValue, artifactSubstatTiers, resolveArtifactBuild, type ArtifactPieceInput, type ArtifactSubstatKey } from "./artifact-build";
import { calcCritMultiplier } from "../../sim-core/src/formulas";

const sub = (stat: ArtifactSubstatKey, count: number) => ({ stat, rolls: Array<number>(count).fill(3) });
const flower = (substats: ArtifactPieceInput["substats"]): ArtifactPieceInput => ({
  slot: "flower", setId: "artifact-set:15001", rarity: 5, level: 20,
  mainStat: "hp", initialSubstats: 3, substats,
});
const count = (pieces: readonly ArtifactPieceInput[], stat: ArtifactSubstatKey) => pieces.flatMap(piece => piece.substats).filter(item => item.stat === stat).reduce((sum, item) => sum + item.rolls.length, 0);

describe("bounded artifact allocation under a fixed legal budget", () => {
  it("retains the original complete allocation when there is no strict improvement", () => {
    const input = [flower([sub("critRate_", 2), sub("critDMG_", 2), sub("atk_", 2), sub("hp_", 2)])];
    const result = balanceFiveStarArtifactRolls(input, () => 1);
    expect(result.pieces).toEqual(input);
    expect(result.moves).toBe(0);
    expect(result.finalScore).toBe(result.initialScore);
    expect(result.termination).toBe("no-improving-transfer");
  });

  it("spends rolls on effective expected damage instead of overflowing CRIT with a combat buff", () => {
    const input = [flower([sub("critRate_", 5), sub("critDMG_", 1), sub("atk_", 1), sub("def_", 1)])];
    const original = structuredClone(input);
    const result = balanceFiveStarArtifactRolls(input, stats => calcCritMultiplier({
      critRate: 0.8 + 0.2 + (stats.critRate_ ?? 0), critDamage: 0.5 + (stats.critDMG_ ?? 0), critMode: "average",
    }));
    expect(count(result.pieces, "critRate_")).toBe(1);
    expect(count(result.pieces, "critDMG_")).toBe(5);
    expect(result.finalScore).toBeCloseTo(1 + 0.5 + 5 * 0.0777, 12);
    expect(result.finalScore).toBeGreaterThan(result.initialScore);
    expect(input).toEqual(original);
    expect(() => resolveArtifactBuild(result.pieces)).not.toThrow();
  });

  it.each([
    { name: "HP talent", weights: { hp: 0.1, def: 0, atk: 0 }, preferred: "hp_" },
    { name: "DEF talent", weights: { hp: 0, def: 2, atk: 0 }, preferred: "def_" },
    { name: "mixed HP/DEF/ATK talent", weights: { hp: 0.01, def: 1, atk: 0.1 }, preferred: "def_" },
  ])("accepts the explicit $name objective without substituting ATK or CRIT", ({ weights, preferred }) => {
    const result = balanceFiveStarArtifactRolls([flower([sub("atk_", 4), sub("hp_", 1), sub("def_", 1), sub("critDMG_", 2)])], stats =>
      weights.hp * (10000 * (1 + (stats.hp_ ?? 0)) + (stats.hp ?? 0))
      + weights.def * (1000 * (1 + (stats.def_ ?? 0)) + (stats.def ?? 0))
      + weights.atk * (800 * (1 + (stats.atk_ ?? 0)) + (stats.atk ?? 0)));
    expect(count(result.pieces, preferred as ArtifactSubstatKey)).toBe(5);
    expect(count(result.pieces, "critDMG_")).toBe(1);
  });

  it("keeps the triple-EM main-stat exclusion and the real 3-/4-line flower/plume ceiling", () => {
    for (const initialSubstats of [3, 4]) {
      const filler = initialSubstats === 3 ? 5 : 6;
      const input: ArtifactPieceInput[] = [
        { ...flower([sub("eleMas", 1), sub("critRate_", filler), sub("hp_", 1), sub("atk_", 1)]), initialSubstats },
        { ...flower([sub("eleMas", 1), sub("critDMG_", filler), sub("hp_", 1), sub("def_", 1)]), slot: "plume", mainStat: "atk", initialSubstats },
        ...(["sands", "goblet", "circlet"] as const).map(slot => ({ ...flower([sub("critRate_", filler), sub("critDMG_", 1), sub("hp_", 1), sub("atk_", 1)]), slot, mainStat: "eleMas" as const, initialSubstats })),
      ];
      const result = balanceFiveStarArtifactRolls(input, stats => stats.eleMas ?? 0);
      expect(count(result.pieces, "eleMas")).toBe(initialSubstats === 3 ? 10 : 12);
      expect(result.pieces.slice(2).every(piece => piece.substats.every(stat => stat.stat !== "eleMas"))).toBe(true);
      expect(result.finalScore).toBeCloseTo(3 * artifactMainStatValue(5, 20, "eleMas") + (initialSubstats === 3 ? 10 : 12) * artifactSubstatTiers(5, "eleMas")[3]!, 8);
      expect(() => resolveArtifactBuild(result.pieces)).not.toThrow();
    }
  });

  it("prioritizes a declared ER floor and reports a missing ER identity as unsatisfied", () => {
    const input = [flower([sub("critRate_", 1), sub("critDMG_", 5), sub("enerRech_", 1), sub("atk_", 1)])];
    const minimum = 5 * 0.0648;
    const constrained = balanceFiveStarArtifactRolls(input, stats => stats.critDMG_ ?? 0, { minimumArtifactEnergyRechargeBonus: minimum });
    expect(constrained.energyConstraint).toMatchObject({ status: "satisfied", minimumArtifactBonus: minimum });
    expect(constrained.energyConstraint.actualArtifactBonus).toBeCloseTo(minimum, 12);
    expect(count(constrained.pieces, "enerRech_")).toBe(5);
    expect(count(constrained.pieces, "critDMG_")).toBe(1);
    expect(balanceFiveStarArtifactRolls(input, stats => stats.critDMG_ ?? 0).energyConstraint.status).toBe("unspecified");
    const absent = [flower([sub("critRate_", 1), sub("critDMG_", 5), sub("hp_", 1), sub("atk_", 1)])];
    expect(balanceFiveStarArtifactRolls(absent, stats => stats.critDMG_ ?? 0, { minimumArtifactEnergyRechargeBonus: minimum }).energyConstraint.status).toBe("unsatisfied");
  });

  it("refuses to invent discrete rolls for imported observed artifacts", () => {
    const piece = flower([sub("hp_", 5), sub("atk_", 1), sub("critRate_", 1), sub("critDMG_", 1)]);
    piece.observed = { source: "test-observed-panel", substats: [{ stat: "hp_", value: 0.2 }] };
    expect(() => balanceFiveStarArtifactRolls([piece], () => 1)).toThrow("不能猜测");
  });

  it("rejects illegal budgets instead of repairing extra rolls, duplicate identities, main/sub overlap or imaginary tiers", () => {
    const legal = flower([sub("eleMas", 5), sub("hp_", 1), sub("atk_", 1), sub("critDMG_", 1)]);
    const extra = structuredClone(legal);
    extra.substats[0]!.rolls.push(3); // Three-line +20 cannot have 9 rolls / 6 on one stat.
    const duplicate = structuredClone(legal);
    duplicate.substats[1]!.stat = "eleMas";
    const overlap = structuredClone(legal);
    overlap.substats[1]!.stat = "hp";
    const imaginary = structuredClone(legal);
    imaginary.substats[0]!.rolls[0] = 4;
    for (const invalid of [extra, duplicate, overlap, imaginary]) {
      expect(() => balanceFiveStarArtifactRolls([invalid], stats => stats.eleMas ?? 0)).toThrow();
    }
  });
});
