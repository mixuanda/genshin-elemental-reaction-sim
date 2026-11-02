import { describe, expect, it } from "vitest";
import { artifactMainStatValue, artifactSubstatTiers, resolveArtifactBuild, type ArtifactPieceInput, type ArtifactStatKey } from "./artifact-build";
import { createRepresentativeArtifactBudgetObjective, type RepresentativeArtifactBudgetScenario } from "./representative-artifact-budget";
import { getCharacterBuildPreset, characterBuildPresetCoverage } from "./character-build-presets";
import { resolveEquipmentBuild } from "./equipment-build";
import { calcDamage, calcTransformativeReactionDamage } from "../../sim-core/src/formulas";
import { balanceFiveStarArtifactRolls, type ArtifactStatTotals } from "./artifact-budget-balance";

function totals(pieces: readonly ArtifactPieceInput[]): ArtifactStatTotals {
  const stats: Partial<Record<ArtifactStatKey, number>> = {};
  const add = (stat: ArtifactStatKey, amount: number) => { stats[stat] = (stats[stat] ?? 0) + amount; };
  for (const piece of pieces) {
    add(piece.mainStat, artifactMainStatValue(piece.rarity, piece.level, piece.mainStat));
    for (const sub of piece.substats) for (const tier of sub.rolls) add(sub.stat, artifactSubstatTiers(piece.rarity, sub.stat)[tier]!);
  }
  return stats;
}

const identities = [
  { id: "character:10000087", slug: "neuvillette", weapon: "weapon:14406", constellation: 0, talents: { normal: 10, skill: 6, burst: 6 } },
  { id: "character:10000034", slug: "noelle", weapon: "weapon:12407", constellation: 6, talents: { normal: 9, skill: 6, burst: 10 } },
  { id: "character:10000065", slug: "kukishinobu", weapon: "weapon:11407", constellation: 0, talents: { normal: 1, skill: 9, burst: 1 } },
] as const;

describe("bounded real HP, DEF-conversion and owned Hyperbloom artifact objectives", () => {
  it.each(identities)("holds $slug level, talents, weapon and constellation fixed without claiming complete coverage", row => {
    const starter = getCharacterBuildPreset(row.id, "starter")!;
    const developed = getCharacterBuildPreset(row.id, "developed")!;
    expect(starter.coverage).toBe("partial");
    expect(developed.coverage).toBe("partial");
    expect(characterBuildPresetCoverage.roleSpecific).toEqual(["wanderer"]);
    expect({ ...starter.build, artifacts: [] }).toEqual({ ...developed.build, artifacts: [] });
    expect(starter.build).toMatchObject({ level: 90, ascension: 6, weaponId: row.weapon, weaponLevel: 90, refinement: 1,
      effectsDisabled: true, weaponEffectsEnabled: false, setEffectsEnabled: false });
    expect(starter.constellation).toBe(row.constellation);
    expect(developed.constellation).toBe(row.constellation);
    expect(starter.talentLevels).toEqual(row.talents);
    expect(developed.talentLevels).toEqual(row.talents);
    expect(starter.artifactBalance).toMatchObject({ scope: "single-effect-not-rotation-dps", energyRequirement: "unknown-without-team-and-rotation",
      energyConstraint: { status: "unspecified" } });
    expect(starter.artifactBalance!.description).toContain("循环 DPS");
    expect(developed.artifactBalance!.scenario).toEqual(starter.artifactBalance!.scenario);
    expect(developed.artifactBalance!.finalScore).toBeGreaterThanOrEqual(starter.artifactBalance!.finalScore);
    expect(developed.artifactBalance!.starterComparisonScore).toBeCloseTo(starter.artifactBalance!.finalScore, 8);
    for (const preset of [starter, developed]) {
      const pieces = preset.build.artifacts!;
      expect(pieces).toHaveLength(5);
      const initial = pieces[0]!.initialSubstats;
      expect([3, 4]).toContain(initial);
      expect(pieces.reduce((sum, piece) => sum + piece.substats.reduce((n, sub) => n + sub.rolls.length, 0), 0)).toBe(initial === 3 ? 40 : 45);
      for (const piece of pieces) {
        expect(piece.initialSubstats).toBe(initial);
        expect(piece.substats).toHaveLength(4);
        expect(new Set(piece.substats.map(sub => sub.stat)).size).toBe(4);
        expect(piece.substats.every(sub => sub.stat !== piece.mainStat && sub.rolls.length >= 1 && sub.rolls.length <= initial + 2)).toBe(true);
      }
      expect(() => resolveArtifactBuild(pieces)).not.toThrow();
      const { score } = createRepresentativeArtifactBudgetObjective(preset.build, preset.artifactBalance!.scenario!);
      expect(score(totals(pieces))).toBeCloseTo(preset.artifactBalance!.finalScore, 8);
      expect(preset.artifactBalance!.finalScore).toBeGreaterThan(preset.artifactBalance!.initialScore);
    }
  });

  it("matches a real HP charged hit at explicit HP ratio and does not substitute ATK", () => {
    const preset = getCharacterBuildPreset("character:10000087", "starter")!;
    const resolution = resolveEquipmentBuild(preset.build);
    const b = resolution.build;
    const hp = b.baseHp * (1 + b.hpPercent) + b.flatHp;
    const hit = calcDamage({ scaling: 0.14467, scalingStat: "hp", scalingValue: hp, flatDamage: 0,
      damageBonus: (resolution.damageBonuses.hydro ?? 0) + 0.3, characterLevel: 90, enemyLevel: 100,
      defenseReduction: 0, defenseIgnore: 0, effectiveResistance: 0.1, critRate: b.critRate, critDamage: b.critDamage,
      critMode: "average", reaction: "none", elementalMastery: b.em, reactionBonus: 0, groupMultiplier: 1 });
    expect(hit.finalDamage).toBeCloseTo(preset.artifactBalance!.finalScore * 190 / 390 * 0.9, 8);
    const { score } = createRepresentativeArtifactBudgetObjective(preset.build, preset.artifactBalance!.scenario!);
    expect(score({ atk_: 10, atk: 100000 })).toBe(score({}));
    expect(score({ hp_: 0.1 })).toBeGreaterThan(score({}));
    const at30 = createRepresentativeArtifactBudgetObjective(preset.build, {
      kind: "neuvillette-equitable-judgment-hit", normalTalentLevel: 10, currentHpRatio: 0.3, pastDraconicGloriesStacks: 0,
    });
    expect(score({}) / at30.score({})).toBeCloseTo(1.3, 12);
  });

  it("uses effective Q13 plus C6, then adds DEF conversion once outside ATK%", () => {
    const preset = getCharacterBuildPreset("character:10000034", "starter")!;
    const resolution = resolveEquipmentBuild(preset.build);
    const b = resolution.build;
    const attack = (b.characterBaseAtk + b.weaponBaseAtk) * (1 + b.atkPercent) + b.flatAtk;
    const defense = b.baseDef * (1 + b.defPercent) + b.flatDef;
    const conversion = 0.85 + 0.5; // C5: base Q10 -> effective Q13, then C6.
    const hit = calcDamage({ scaling: 1.4536, scalingStat: "atk", scalingValue: attack + conversion * defense, flatDamage: 0,
      damageBonus: resolution.damageBonuses.geo ?? 0, characterLevel: 90, enemyLevel: 100,
      defenseReduction: 0, defenseIgnore: 0, effectiveResistance: 0.1, critRate: b.critRate, critDamage: b.critDamage,
      critMode: "average", reaction: "none", elementalMastery: b.em, reactionBonus: 0, groupMultiplier: 1 });
    expect(hit.finalDamage).toBeCloseTo(preset.artifactBalance!.finalScore * 190 / 390 * 0.9, 8);
    const { score } = createRepresentativeArtifactBudgetObjective(preset.build, preset.artifactBalance!.scenario!);
    const c0 = createRepresentativeArtifactBudgetObjective(preset.build, {
      kind: "noelle-burst-active-normal-hit", normalTalentLevel: 9, baseBurstTalentLevel: 10, constellation: 0,
      burstActive: true, defenseAtCast: "same-as-current-non-extra", attackIncludesBurstConversion: false,
    });
    expect(score({})).toBeGreaterThan(c0.score({}));
    // Increasing ATK% cannot multiply the already added DEF conversion.
    const base = resolveEquipmentBuild({ ...preset.build, artifacts: [] }).build;
    expect(score({ atk_: 1, def_: 1 }) - score({ atk_: 1 })).toBeCloseTo(score({ def_: 1 }) - score({}), 10);
    expect(score({ def_: 0.1 }) - score({})).toBeCloseTo(1.4536 * 1.35 * base.baseDef * 0.1 * (1 + base.critRate * base.critDamage), 10);
  });

  it("scores actual owned Hyperbloom, ignoring ATK/CRIT and keeping the legal 10/12 flower/plume EM ceiling", () => {
    for (const tier of ["starter", "developed"] as const) {
      const preset = getCharacterBuildPreset("character:10000065", tier)!;
      const b = resolveEquipmentBuild(preset.build).build;
      const actual = calcTransformativeReactionDamage({ characterLevel: 90, elementalMastery: b.em,
        baseMultiplier: 3, reactionBonus: 0, effectiveResistance: 0.1 });
      expect(preset.artifactBalance!.finalScore).toBeCloseTo(actual.finalDamage, 8);
      const { score } = createRepresentativeArtifactBudgetObjective(preset.build, preset.artifactBalance!.scenario!);
      expect(score({ critRate_: 10, critDMG_: 10, atk_: 10, atk: 100000, hp_: 10 })).toBe(score({}));
      const pieces = preset.build.artifacts!;
      expect(pieces.slice(2).every(piece => piece.mainStat === "eleMas" && piece.substats.every(sub => sub.stat !== "eleMas"))).toBe(true);
      expect(pieces.flatMap(piece => piece.substats).filter(sub => sub.stat === "eleMas").reduce((sum, sub) => sum + sub.rolls.length, 0)).toBe(tier === "starter" ? 10 : 12);
    }
  });

  it("preserves each piece's exact quality multiset and identities for a real HP objective", () => {
    const preset = getCharacterBuildPreset("character:10000087", "starter")!;
    const before = structuredClone(preset.build.artifacts!);
    for (const piece of before) {
      // A legal but poor HP allocation: keep four identities and all tier quality.
      const donor = piece.substats.find(sub => ["hp_", "critDMG_"].includes(sub.stat) && sub.rolls.length > 1);
      const receiver = piece.substats.find(sub => sub.stat === "enerRech_");
      if (donor && receiver) receiver.rolls.push(...donor.rolls.splice(1));
    }
    const { score } = createRepresentativeArtifactBudgetObjective(preset.build, preset.artifactBalance!.scenario!);
    const result = balanceFiveStarArtifactRolls(before, score);
    expect(result.finalScore).toBeGreaterThan(result.initialScore);
    for (const [i, piece] of result.pieces.entries()) {
      expect(piece.substats.map(sub => sub.stat)).toEqual(before[i]!.substats.map(sub => sub.stat));
      expect(piece.substats.flatMap(sub => sub.rolls).sort()).toEqual(before[i]!.substats.flatMap(sub => sub.rolls).sort());
      expect({ ...piece, substats: [] }).toEqual({ ...before[i]!, substats: [] });
    }
  });

  it("rejects unsupported identities, implicit Q/double conversion, impossible levels, unknown ownership and enabled passives", () => {
    const noelle = getCharacterBuildPreset("character:10000034", "starter")!;
    const scenario = noelle.artifactBalance!.scenario!;
    expect(() => createRepresentativeArtifactBudgetObjective({ ...noelle.build, characterId: "character:10000075" }, scenario)).toThrow("身份");
    expect(() => createRepresentativeArtifactBudgetObjective({ ...noelle.build, weaponEffectsEnabled: true }, scenario)).toThrow("被动关闭");
    for (const invalid of [{ burstActive: false }, { attackIncludesBurstConversion: true }, { defenseAtCast: "inferred" }, { baseBurstTalentLevel: 13 }]) {
      expect(() => createRepresentativeArtifactBudgetObjective(noelle.build, { ...scenario, ...invalid } as RepresentativeArtifactBudgetScenario)).toThrow();
    }
    const neuv = getCharacterBuildPreset("character:10000087", "starter")!;
    for (const invalid of [{ normalTalentLevel: 16 }, { currentHpRatio: Number.NaN }, { currentHpRatio: 1.01 }]) {
      expect(() => createRepresentativeArtifactBudgetObjective(neuv.build, { ...neuv.artifactBalance!.scenario!, ...invalid } as RepresentativeArtifactBudgetScenario)).toThrow();
    }
    const kuki = getCharacterBuildPreset("character:10000065", "starter")!;
    expect(() => createRepresentativeArtifactBudgetObjective(kuki.build, { ...kuki.artifactBalance!.scenario!, triggerOwner: "unknown" } as unknown as RepresentativeArtifactBudgetScenario)).toThrow("归属");
  });
});
