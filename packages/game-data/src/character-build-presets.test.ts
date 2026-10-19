import { describe, expect, it } from "vitest";
import { getCharacterBuildPreset, characterBuildPresets, characterBuildPresetCoverage } from "./character-build-presets";
import { resolveEquipmentBuild } from "./equipment-build";
import { resolveArtifactBuild } from "./artifact-build";
import { gameDataCatalog } from "./catalog";

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
    expect(preset.talentLevels).toEqual({ normal: 9, skill: 6, burst: 1 });
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
    expect(offensiveRolls).toBe(22);
    expect(() => resolveArtifactBuild(pieces)).not.toThrow();

    const resolved = resolveEquipmentBuild(preset.build);
    const attack = (resolved.build.characterBaseAtk + resolved.build.weaponBaseAtk) * (1 + resolved.build.atkPercent) + resolved.build.flatAtk;
    expect(resolved.build.critRate).toBeCloseTo(0.8018, 10);
    expect(resolved.build.critDamage).toBeCloseTo(1.61048, 10);
    expect(attack).toBeCloseTo(1802.1962670176001, 10);
    expect(resolved.otherStats.energyRechargeBonus).toBeCloseTo(0.0518, 10);
    expect(resolved.verification).toBe("provisional");
  });

  it("uses a sourced Wanderer developed weapon, ≥10 Normal Attack, and legal +20 artifact entries", () => {
    const preset = getCharacterBuildPreset("character:10000075", "developed")!;
    const pieces = preset.build.artifacts!;
    const allRolls = pieces.flatMap(piece => piece.substats).reduce((sum, substat) => sum + substat.rolls.length, 0);
    expect(preset.coverage).toBe("role-specific");
    expect(preset.build.weaponId).toBe("weapon:14501"); // Skyward Atlas R1, a sourced suitable 5-star option.
    expect(preset.build.refinement).toBe(1);
    expect(preset.talentLevels.normal).toBeGreaterThanOrEqual(10);
    expect(preset.talentLevels).toEqual({ normal: 10, skill: 9, burst: 1 });
    expect(allRolls).toBe(45);
    expect(pieces.every(piece => piece.level === 20 && piece.initialSubstats === 4)).toBe(true);
    expect(() => resolveArtifactBuild(pieces)).not.toThrow();
    expect(() => resolveEquipmentBuild(preset.build)).not.toThrow();
  });
});
