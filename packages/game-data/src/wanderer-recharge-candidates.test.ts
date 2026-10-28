import { describe, expect, it } from "vitest";
import { resolveArtifactBuild, type ArtifactPieceInput, type ArtifactStatKey } from "./artifact-build";
import type { EquipmentBuildInput } from "./equipment-build";
import trackedProxy from "./wanderer-recharge-candidates-proxy.json";
import {
  buildWandererRechargeCandidate, createFrozenWandererOffenseScore,
  validateWandererRollTransfers, wandererArtifactTotals, type FrozenWandererHit,
} from "./wanderer-recharge-candidates";

// The retained team's explicit roll histories, not a reconstruction of observed
// panel values. No weapon, constellation, set or main stat is varied by search.
const pieces = (): ArtifactPieceInput[] => [
  { slot: "flower", setId: "artifact-set:15027", rarity: 5, level: 20, mainStat: "hp", initialSubstats: 4,
    substats: [{ stat: "critRate_", rolls: [0, 1, 2] }, { stat: "critDMG_", rolls: [1, 3] }, { stat: "atk_", rolls: [2, 3, 2] }, { stat: "atk", rolls: [0] }] },
  { slot: "plume", setId: "artifact-set:15027", rarity: 5, level: 20, mainStat: "atk", initialSubstats: 4,
    substats: [{ stat: "critRate_", rolls: [1, 2, 3, 1] }, { stat: "critDMG_", rolls: [2, 3] }, { stat: "atk_", rolls: [3, 0] }, { stat: "enerRech_", rolls: [0] }] },
  { slot: "sands", setId: "artifact-set:15027", rarity: 5, level: 20, mainStat: "atk_", initialSubstats: 4,
    substats: [{ stat: "critRate_", rolls: [2, 3, 0] }, { stat: "critDMG_", rolls: [3, 0, 2, 1] }, { stat: "atk", rolls: [0] }, { stat: "enerRech_", rolls: [1] }] },
  { slot: "goblet", setId: "artifact-set:15027", rarity: 5, level: 20, mainStat: "anemo_dmg_", initialSubstats: 4,
    substats: [{ stat: "critRate_", rolls: [3, 0, 1] }, { stat: "critDMG_", rolls: [0, 1, 3] }, { stat: "atk_", rolls: [1, 2] }, { stat: "atk", rolls: [2] }] },
  { slot: "circlet", setId: "artifact-set:15001", rarity: 5, level: 20, mainStat: "critRate_", initialSubstats: 4,
    substats: [{ stat: "critDMG_", rolls: [0, 1, 2, 3, 3] }, { stat: "atk_", rolls: [1, 2] }, { stat: "atk", rolls: [2] }, { stat: "enerRech_", rolls: [0] }] },
];
const equipment = (): EquipmentBuildInput => ({ characterId: "character:10000075", weaponId: "weapon:14512", level: 100,
  ascension: 6, characterLevelCap: 100, weaponLevel: 90, weaponAscension: 6, refinement: 5,
  effectsDisabled: true, weaponEffectsEnabled: false, setEffectsEnabled: false, artifacts: pieces() });
const hit = (overrides: Partial<FrozenWandererHit> = {}): FrozenWandererHit => ({ frame: 10,
  ability: "synthetic independent ordinary ATK hit", baseAtk: 1000, attack: 2000,
  scaling: 2, baseDamageBonus: 0.25, flatDamage: 100,
  critRate: 1.18, critDamage: 1, usedCritRate: 1, usedCritDamage: 1.5,
  isCrit: true, actualDamage: 12750, ...overrides });
const sortedTiers = (piece: ArtifactPieceInput) => piece.substats.flatMap(sub => sub.rolls).sort();

describe("Wanderer legal recharge candidate frontier", () => {
  it("resolves the retained explicit baseline totals without adding base ER or equipment twice", () => {
    const actual = wandererArtifactTotals(pieces());
    expect(actual.hp).toBe(4780);
    expect(actual.atk).toBeCloseTo(373.26, 10);
    expect(actual.atk_).toBeCloseTo(0.9266, 12);
    expect(actual.critRate_).toBeCloseTo(0.7387, 12);
    expect(actual.critDMG_).toBeCloseTo(1.0879, 12);
    // ER tier indices [0], [1], [0] = .0453+.0518+.0453.
    expect(actual.enerRech_).toBeCloseTo(0.1424, 12);
    expect(actual.anemo_dmg_).toBe(0.466);
  });

  it("scores unclamped CR overflow, actual used CD, ATK deltas and flat damage independently", () => {
    const baseline = pieces(), original = wandererArtifactTotals(baseline);
    const score = createFrozenWandererOffenseScore(baseline, [hit()]);
    expect(score(original)).toBe(12750); // (2000*2*1.25+100)*(1+1*1.5)
    const changed = { ...original, atk_: original.atk_! - 0.1, atk: original.atk! - 5,
      critRate_: original.critRate_! - 0.1, critDMG_: original.critDMG_! + 0.2 };
    expect(score(changed)).toBeCloseTo(13061.25, 8); // (1895*2*1.25+100)*2.7; CR1.08 still caps1.
  });

  it("removes sampled critical damage and restores average damage without changing the RNG stream", () => {
    const baseline = pieces(), original = wandererArtifactTotals(baseline);
    const score = createFrozenWandererOffenseScore(baseline, [hit({ critRate: 0.5, usedCritRate: 0.5 })]);
    expect(score(original)).toBe(8925); // Noncrit5100 * (1+.5*1.5), not sampled12750.
    const noncrit = createFrozenWandererOffenseScore(baseline, [hit({ critRate: 0.5, usedCritRate: 0.5,
      isCrit: false, actualDamage: 5100 })]);
    expect(noncrit(original)).toBe(score(original));
  });

  it.each([1.4, 1.5, 1.6])("finds a legal discrete candidate at total ER >= %s with frozen other inputs", target => {
    const input = equipment(), original = structuredClone(input);
    const result = buildWandererRechargeCandidate(input, [hit()], target, 1);
    expect(result.totalEnergyRecharge).toBeGreaterThanOrEqual(target - 1e-12);
    expect(result.totalEnergyRecharge).toBeLessThan(target + 0.0648 + 1e-12);
    expect(result.search.energyConstraint.status).toBe("satisfied");
    expect(result.proxy.label).toContain("not-native-DPS");
    const { artifacts: before, ...fixedBefore } = input;
    const { artifacts: after, ...fixedAfter } = result.equipment;
    expect(fixedAfter).toEqual(fixedBefore);
    expect(input).toEqual(original);
    expect(() => resolveArtifactBuild(after)).not.toThrow();
    expect(validateWandererRollTransfers(before!, after)).toEqual(result.rollMoves);
    expect(after.reduce((sum, piece) => sum + sortedTiers(piece).length, 0)).toBe(45);
    for (const [index, piece] of after.entries()) {
      const old = before![index]!;
      expect({ ...piece, substats: undefined }).toEqual({ ...old, substats: undefined });
      expect(piece.substats.map(sub => sub.stat)).toEqual(old.substats.map(sub => sub.stat));
      expect(piece.substats.every(sub => sub.rolls.length >= 1)).toBe(true);
      expect(sortedTiers(piece)).toEqual(sortedTiers(old));
    }
    expect(result.artifactDelta.hp).toBe(0);
    expect(result.artifactDelta.anemo_dmg_).toBe(0);
    expect(result.equipment.artifacts[0]!.substats.some(sub => sub.stat === "enerRech_")).toBe(false);
    expect(result.equipment.artifacts[3]!.substats.some(sub => sub.stat === "enerRech_")).toBe(false);
  });

  it.each([
    { target: 1.4, er: 1.4016, cr: 0.622, cd: 1.3753, atk: 0.6525 },
    { target: 1.5, er: 1.5182, cr: 0.587, cd: 1.2976, atk: 0.6584 },
    { target: 1.6, er: 1.6025, cr: 0.5598, cd: 1.251, atk: 0.6584 },
  ])("reproduces the shipped $target snapshot-ranked candidate without the 51 MB trace", expected => {
    expect(trackedProxy.order.length).toBe(282);
    expect(trackedProxy.terms.length).toBe(67);
    const hits = trackedProxy.order.map(index => trackedProxy.terms[index]!);
    const result = buildWandererRechargeCandidate(equipment(), hits, expected.target, 1);
    expect(result.totalEnergyRecharge).toBeCloseTo(expected.er, 12);
    expect(result.artifactTotals.critRate_).toBeCloseTo(expected.cr, 12);
    expect(result.artifactTotals.critDMG_).toBeCloseTo(expected.cd, 12);
    expect(result.artifactTotals.atk_).toBeCloseTo(expected.atk, 12);
    expect(result.search.energyConstraint.status).toBe("satisfied");
  });

  it("replays the exact within-piece transfer delta back to the candidate without creating rolls", () => {
    const input = equipment(), result = buildWandererRechargeCandidate(input, [hit()], 1.4, 1);
    const replay = structuredClone(input.artifacts!);
    for (const move of result.rollMoves) {
      const piece = replay.find(item => item.slot === move.slot)!;
      const donor = piece.substats.find(sub => sub.stat === move.from)!;
      const index = donor.rolls.indexOf(move.tierIndex);
      expect(index).toBeGreaterThanOrEqual(0);
      donor.rolls.splice(index, 1);
      piece.substats.find(sub => sub.stat === move.to)!.rolls.push(move.tierIndex);
    }
    expect(replay.map(piece => piece.substats.map(sub => ({ ...sub, rolls: sub.rolls.sort() }))))
      .toEqual(result.equipment.artifacts.map(piece => piece.substats.map(sub => ({ ...sub, rolls: [...sub.rolls].sort() }))));
    result.pieceBudgets[0]!.before[0]!.rolls.push(3);
    expect(input.artifacts![0]!.substats[0]!.rolls).toEqual([0, 1, 2]);
  });

  it("reports an impossible ER target unsatisfied rather than manufacturing a stat", () => {
    const result = buildWandererRechargeCandidate(equipment(), [hit()], 3, 1);
    expect(result.search.energyConstraint.status).toBe("unsatisfied");
    expect(result.totalEnergyRecharge).toBeLessThan(3);
    expect(result.rollMoves.every(move => move.to === "enerRech_" || move.slot === "flower" || move.slot === "goblet")).toBe(true);
    expect(() => validateWandererRollTransfers(pieces(), result.equipment.artifacts)).not.toThrow();
  });

  it("supports eight-roll pieces without silently upgrading their budget", () => {
    const input = equipment();
    input.artifacts![0]!.initialSubstats = 3;
    input.artifacts![0]!.substats[0]!.rolls.pop();
    const result = buildWandererRechargeCandidate(input, [hit()], 1.4, 1);
    expect(sortedTiers(result.equipment.artifacts[0]!).length).toBe(8);
    expect(result.pieceBudgets[0]!.totalRolls).toBe(8);
  });

  it.each(["extra-roll", "duplicate-substat", "main-sub-overlap", "imaginary-tier", "observed", "missing-piece"])("rejects invalid %s evidence", invalid => {
    const input = equipment();
    const first = input.artifacts![0]!;
    if (invalid === "extra-roll") first.substats[0]!.rolls.push(3);
    if (invalid === "duplicate-substat") first.substats[1]!.stat = "critRate_";
    if (invalid === "main-sub-overlap") first.substats[1]!.stat = "hp";
    if (invalid === "imaginary-tier") first.substats[0]!.rolls[0] = 4;
    if (invalid === "observed") first.observed = { source: "observed-panel-not-roll-history", substats: [{ stat: "critRate_", value: 0.1 }] };
    if (invalid === "missing-piece") input.artifacts!.pop();
    expect(() => buildWandererRechargeCandidate(input, [hit()], 1.4, 1)).toThrow();
  });

  it("rejects legal-looking outputs that change an identity or the per-piece quality multiset", () => {
    const before = pieces(), identity = structuredClone(before), quality = structuredClone(before);
    identity[0]!.substats[3]!.stat = "enerRech_"; // Legal artifact, forbidden template change.
    quality[0]!.substats[0]!.rolls[0] = 3; // Same legal 9-roll count, upgraded quality.
    expect(() => resolveArtifactBuild(identity)).not.toThrow();
    expect(() => resolveArtifactBuild(quality)).not.toThrow();
    for (const after of [identity, quality]) expect(() => validateWandererRollTransfers(before, after)).toThrow("cannot change");
  });

  it.each([NaN, Infinity, -1, 0.4])("rejects invalid total ER %s instead of treating it as an artifact bonus", target => {
    expect(() => buildWandererRechargeCandidate(equipment(), [hit()], target, 1)).toThrow();
  });

  it("rejects another character, missing hits, changed unmodeled stats and inconsistent CR evidence", () => {
    expect(() => buildWandererRechargeCandidate({ ...equipment(), characterId: "character:10000076" }, [hit()], 1.4, 1)).toThrow();
    expect(() => buildWandererRechargeCandidate(equipment(), [], 1.4, 1)).toThrow();
    for (const bad of [hit({ baseAtk: 0 }), hit({ actualDamage: NaN }), hit({ usedCritRate: 0.5 }), hit({ flatDamage: -1 })])
      expect(() => createFrozenWandererOffenseScore(pieces(), [bad])).toThrow();
    const score = createFrozenWandererOffenseScore(pieces(), [hit()]);
    const original = wandererArtifactTotals(pieces());
    for (const stat of ["hp", "eleMas", "anemo_dmg_"] as ArtifactStatKey[])
      expect(() => score({ ...original, [stat]: (original[stat] ?? 0) + 1 })).toThrow("cannot score changed");
  });
});
