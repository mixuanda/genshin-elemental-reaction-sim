import { describe, expect, it } from "vitest";
import { resolveEquipmentBuild, type EquipmentBuildInput } from "./equipment-build";
import { equipmentDataSource } from "./equipment-source";
import { calculateDocument, parseCalculatorDocument, resolveCalculatorStats, serializeCalculatorDocument } from "../../sim-core/src/calculator";
import { loadWorkedExample } from "../../sim-core/src/worked-examples";

const ayakaHarbinger: EquipmentBuildInput = {
  characterId: "character:10000002", weaponId: "weapon:11302", level: 90, ascension: 6,
  weaponLevel: 90, weaponAscension: 6, refinement: 5, effectsDisabled: true
};

describe("source-derived character and weapon stats", () => {
  it("resolves unrounded exact level-90 terms, including each secondary stat once", () => {
    const result = resolveEquipmentBuild(ayakaHarbinger);
    expect(result.build.characterBaseAtk).toBeCloseTo(342.0250874, 8);
    expect(result.build.weaponBaseAtk).toBeCloseTo(401.2935898, 8);
    expect(result.build.baseHp).toBeCloseTo(12858.206654, 8);
    expect(result.build.critDamage).toBeCloseTo(0.5 + 0.384 + 0.468588, 10);
    expect(result.build.critRate).toBe(0.05); // The R5 HP-conditioned passive was explicitly disabled.
    expect(result.build.equipment.derivedStats).toHaveLength(5);
    expect(result.verification).toBe("provisional");
    expect(result.source.releaseStatus).toBe(equipmentDataSource.releaseStatus);
    expect(result.source.sourceCommit).toBe(equipmentDataSource.sourceCommit);
    expect(result.assumptions.some(reason => reason.includes("黎明神剑") && reason.includes("停用"))).toBe(true);
    expect(result.effectBlockers.some(reason => reason.includes("黎明神剑"))).toBe(false);
  });

  it("distinguishes pre- and post-ascension level boundaries without interpolation", () => {
    const before = resolveEquipmentBuild({ ...ayakaHarbinger, level: 20, ascension: 0, weaponId: "weapon:11101", weaponLevel: 20, weaponAscension: 0, refinement: 1 });
    const after = resolveEquipmentBuild({ ...ayakaHarbinger, level: 20, ascension: 1, weaponId: "weapon:11101", weaponLevel: 20, weaponAscension: 1, refinement: 1 });
    expect(after.build.characterBaseAtk - before.build.characterBaseAtk).toBeCloseTo(22.828234, 8);
    expect(after.build.weaponBaseAtk - before.build.weaponBaseAtk).toBeCloseTo(11.7, 8);
    expect(before.build.equipment.secondaryContributions.find(c => c.property === "FIGHT_PROP_NONE")?.value).toBe(0);
    expect(() => resolveEquipmentBuild({ ...ayakaHarbinger, level: 20.5, ascension: 1 })).toThrow("整数");
    expect(() => resolveEquipmentBuild({ ...ayakaHarbinger, level: 19, ascension: 1 })).toThrow("等级范围");
    expect(() => resolveEquipmentBuild({ ...ayakaHarbinger, level: 91 })).toThrow("已解锁");
  });

  it("respects weapon type, starter level caps, and restricted refinements", () => {
    expect(() => resolveEquipmentBuild({ ...ayakaHarbinger, weaponId: "weapon:11412", refinement: 2 })).toThrow("合法来源记录");
    expect(() => resolveEquipmentBuild({ ...ayakaHarbinger, weaponId: "weapon:11101", weaponAscension: 4, refinement: 1 })).toThrow("等级范围");
    expect(() => resolveEquipmentBuild({ ...ayakaHarbinger, weaponId: "weapon:15101" })).toThrow("武器类型不匹配");
    expect(() => resolveEquipmentBuild({ ...ayakaHarbinger, weaponId: "weapon:11419" })).toThrow("任务专用试用变体");
    expect(() => resolveEquipmentBuild({ ...ayakaHarbinger, effectsDisabled: false })).toThrow("明确选择停用");
  });

  it("maps ascension ATK and weapon ATK independently and preserves non-damage stats", () => {
    const amber = resolveEquipmentBuild({ characterId: "character:10000021", weaponId: "weapon:15415", level: 90, ascension: 6, weaponLevel: 1, weaponAscension: 0, refinement: 1, effectsDisabled: true });
    expect(amber.build.atkPercent).toBeCloseTo(0.24 + 0.09, 12);
    expect(amber.build.flatAtk).toBe(0); // Predator's platform/character passive is not fabricated.
    const jean = resolveEquipmentBuild({ ...ayakaHarbinger, characterId: "character:10000003" });
    expect(jean.otherStats.healingBonus).toBe(0.2215);
    expect(jean.damageBonuses).toEqual({});
  });

  it("executes stored source terms in the shared trace and keeps imported final panels separate", () => {
    const document = loadWorkedExample("fixture-a");
    const resolution = resolveEquipmentBuild(ayakaHarbinger);
    document.build = resolution.build;
    document.dataIdentity = { datasetId: resolution.source.catalogVersion, gameVersion: resolution.source.gameVersion, releaseStatus: "unknown", evidenceStatus: "provisional" };
    const restored = parseCalculatorDocument(serializeCalculatorDocument(document));
    const derived = calculateDocument(restored);
    expect(derived.verification).toBe("provisional");
    expect(derived.trace.find(node => node.id === "build.equipment.characterBaseAtk")?.result?.value).toBe(resolution.build.characterBaseAtk);
    restored.build = { mode: "imported-final", source: "test supplied final panel", stats: resolveCalculatorStats(resolution.build) };
    const imported = calculateDocument(restored);
    expect(imported.totals).toEqual(derived.totals);
    expect(imported.trace.some(node => node.id.startsWith("build.equipment."))).toBe(false);
  });
});
