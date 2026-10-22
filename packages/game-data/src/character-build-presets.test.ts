import { describe, expect, it } from "vitest";
import { getCharacterBuildPreset, characterBuildPresets, characterBuildPresetCoverage } from "./character-build-presets";
import { resolveEquipmentBuild } from "./equipment-build";
import { resolveArtifactBuild } from "./artifact-build";
import { gameDataCatalog } from "./catalog";
import { calcCritMultiplier, calcDamage } from "../../sim-core/src/formulas";
import budgetEvidence from "../../../docs/fixtures/wanderer-graduation-budget-20261022.json";

describe("editable character build presets", () => {
  it("keeps unsupported roles visibly partial or generic instead of presenting them as sourced graduation builds", () => {
    for (const preset of characterBuildPresets) {
      const pieces = preset.build.artifacts ?? [];
      expect(pieces.every(piece => piece.level === 20), preset.id).toBe(true);
      if (pieces.length) expect(() => resolveArtifactBuild(pieces), preset.id).not.toThrow();
    }
    expect(characterBuildPresetCoverage.roleSpecific).toEqual(["wanderer"]);
    expect(characterBuildPresetCoverage.partial).toContain("sangonomiyakokomi");
    expect(characterBuildPresetCoverage.generic.length).toBeGreaterThan(0);
    const preset = characterBuildPresets.find(item => item.tier === "starter" && item.coverage === "generic")!;
    expect(preset.label).toContain("非角色推荐");
    expect(preset.mainStatRationale).toContain("通用可编辑占位");
    expect(preset.assumptions.join(" ")).toContain("不是角色专属推荐");
    expect(preset.assumptions.join(" ")).toContain("不代表所有角色的统一等级上限");
    expect(preset.talentLevels).toEqual({ normal: 8, skill: 8, burst: 8 });
    expect(preset.talentPriority).toBeNull();
    expect(preset.weaponCandidates).toEqual([]);
  });

  it("builds the Wanderer small-graduate input from five legal +20 artifacts and resolves the actual panel", () => {
    const preset = getCharacterBuildPreset("character:10000075", "starter")!;
    const pieces = preset.build.artifacts!;
    const artifactResolution = resolveArtifactBuild(pieces);
    const totalRolls = pieces.flatMap(piece => piece.substats).reduce((sum, substat) => sum + substat.rolls.length, 0);
    const offensiveRolls = pieces.flatMap(piece => piece.substats).filter(substat => ["critRate_", "critDMG_", "atk_"].includes(substat.stat)).reduce((sum, substat) => sum + substat.rolls.length, 0);
    expect(preset).toMatchObject({ coverage: "role-specific", roleLabel: "C0–C1 站场输出", talentPriority: { normal: "primary", skill: "secondary", burst: "low" } });
    expect(preset.talentLevels).toEqual({ normal: 10, skill: 9, burst: 1 });
    expect(preset.build.weaponId).toBe("weapon:14402"); // The Widsith, 4-star R1; its passive is disabled.
    expect(preset.build).toMatchObject({ level: 90, weaponLevel: 90, refinement: 1, setEffectsEnabled: false, weaponEffectsEnabled: false });
    expect(preset.weaponCandidates.map(({ weaponId, refinement }) => [weaponId, refinement])).toEqual([
      ["weapon:14402", 1], ["weapon:14425", 1], ["weapon:14501", 1]
    ]);
    for (const candidate of preset.weaponCandidates) {
      const weapon = gameDataCatalog.weapons.find(item => item.id === candidate.weaponId)!;
      expect(weapon.refinements.some(refinement => refinement.rank === candidate.refinement)).toBe(true);
    }
    expect(pieces.map(piece => [piece.slot, piece.mainStat, piece.level])).toEqual([
      ["flower", "hp", 20], ["plume", "atk", 20], ["sands", "atk_", 20], ["goblet", "anemo_dmg_", 20], ["circlet", "critRate_", 20]
    ]);
    expect(artifactResolution.setCounts).toEqual({ "artifact-set:15027": 4, "artifact-set:15001": 1 });
    expect(totalRolls).toBe(40);
    expect(offensiveRolls).toBe(33);
    expect(() => resolveArtifactBuild(pieces)).not.toThrow();

    const resolved = resolveEquipmentBuild(preset.build);
    const attack = (resolved.build.characterBaseAtk + resolved.build.weaponBaseAtk) * (1 + resolved.build.atkPercent) + resolved.build.flatAtk;
    expect(resolved.build.critRate).toBeCloseTo(0.9456, 10);
    expect(resolved.build.critDamage).toBeCloseTo(1.88248, 10);
    expect(attack).toBeCloseTo(1826.56112460896, 10);
    expect(resolved.otherStats.energyRechargeBonus).toBeCloseTo(0.0518, 10);
    expect(resolved.verification).toBe("provisional");
  });

  it("keeps the developed comparison context fixed and includes the starter solution as a floor", () => {
    const preset = getCharacterBuildPreset("character:10000075", "developed")!;
    const starter = getCharacterBuildPreset("character:10000075", "starter")!;
    const pieces = preset.build.artifacts!;
    const allRolls = pieces.flatMap(piece => piece.substats).reduce((sum, substat) => sum + substat.rolls.length, 0);
    expect(preset.coverage).toBe("role-specific");
    expect(preset.build.weaponId).toBe(starter.build.weaponId);
    expect(preset.build.refinement).toBe(1);
    expect(preset.talentLevels.normal).toBeGreaterThanOrEqual(10);
    expect(preset.talentLevels).toEqual({ normal: 10, skill: 9, burst: 1 });
    expect(preset.talentLevels).toEqual(starter.talentLevels);
    expect(preset.constellation).toBe(starter.constellation);
    expect({ ...preset.build, artifacts: [] }).toEqual({ ...starter.build, artifacts: [] });
    expect(preset.artifactBalance!.finalScore).toBeGreaterThanOrEqual(starter.artifactBalance!.finalScore);
    expect(preset.artifactBalance!.starterComparisonScore).toBeCloseTo(starter.artifactBalance!.finalScore, 8);
    expect(preset.artifactBalance!.energyRequirement).toBe("unknown-without-team-and-rotation");
    expect(allRolls).toBe(45);
    expect(pieces.every(piece => piece.level === 20 && piece.initialSubstats === 4)).toBe(true);
    expect(() => resolveArtifactBuild(pieces)).not.toThrow();
    expect(() => resolveEquipmentBuild(preset.build)).not.toThrow();
  });

  it("improves real direct-damage expectation within the same per-piece counts, identities and tier quality", () => {
    for (const row of budgetEvidence.rows) {
      const preset = getCharacterBuildPreset("character:10000075", row.tier as "starter" | "developed")!;
      const pieces = preset.build.artifacts!;
      expect(pieces).toEqual(row.after.artifacts);
      for (const [index, piece] of pieces.entries()) {
        const before = row.fixedContextBefore.artifacts[index]!;
        expect([piece.slot, piece.setId, piece.rarity, piece.level, piece.mainStat, piece.initialSubstats]).toEqual([before.slot, before.setId, before.rarity, before.level, before.mainStat, before.initialSubstats]);
        expect(piece.substats.map(sub => sub.stat)).toEqual(before.substats.map(sub => sub.stat));
        expect(piece.substats.flatMap(sub => sub.rolls).sort()).toEqual(before.substats.flatMap(sub => sub.rolls).sort());
        expect(piece.substats.every(sub => sub.rolls.length >= 1 && sub.rolls.length <= piece.initialSubstats + 2)).toBe(true);
      }
      const resolved = resolveEquipmentBuild(preset.build);
      const b = resolved.build;
      const attack = (b.characterBaseAtk + b.weaponBaseAtk) * (1 + b.atkPercent) + b.flatAtk;
      const factor = attack * calcCritMultiplier({ critRate: b.critRate, critDamage: b.critDamage, critMode: "average" });
      expect(factor).toBeCloseTo(row.after.expectedDirectFactor, 8);
      expect(factor).toBeCloseTo(preset.artifactBalance!.finalScore, 8);
      expect(factor).toBeGreaterThan(row.fixedContextBefore.expectedDirectFactor * 1.1);
      const hit = calcDamage({ scaling: 1, scalingStat: "atk", scalingValue: attack, flatDamage: 0,
        damageBonus: resolved.damageBonuses.anemo ?? 0, characterLevel: 90, enemyLevel: 100,
        defenseReduction: 0, defenseIgnore: 0, effectiveResistance: 0.1,
        critRate: b.critRate, critDamage: b.critDamage, critMode: "average", reaction: "none", elementalMastery: b.em,
        reactionBonus: 0, groupMultiplier: 1 });
      // Same Talent%, DMG%, DEF and RES factors: the allocation score is
      // proportional to the independently executed normal damage formula.
      expect(hit.finalDamage).toBeCloseTo(factor * (1 + (resolved.damageBonuses.anemo ?? 0)) * 190 / 390 * 0.9, 8);
      expect(preset.artifactBalance!.energyConstraint.status).toBe("unspecified");
    }
    expect([...new Set(characterBuildPresets.filter(preset => preset.artifactBalance).map(preset => preset.characterSlug))].sort())
      .toEqual(["kukishinobu", "neuvillette", "noelle", "wanderer"]);
  });
});
