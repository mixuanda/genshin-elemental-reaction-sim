import { describe, expect, it } from "vitest";
import { artifactMainStatValue, artifactSubstatTiers, resolveArtifactBuild, type ArtifactPieceInput } from "./artifact-build";
import { resolveEquipmentBuild } from "./equipment-build";

const flower: ArtifactPieceInput = {
  slot: "flower", setId: "artifact-set:15001", rarity: 5, level: 20, mainStat: "hp", initialSubstats: 3,
  substats: [{ stat: "critRate_", rolls: [0, 0, 0, 0, 0] }, { stat: "critDMG_", rolls: [3] }, { stat: "atk_", rolls: [3] }, { stat: "enerRech_", rolls: [3] }]
};

describe("source artifact main stats and legal substat histories", () => {
  it("looks up exact rank/level values with no interpolation or rounded-display reconstruction", () => {
    expect(artifactMainStatValue(1, 4, "hp")).toBe(324);
    expect(artifactMainStatValue(5, 20, "hp")).toBe(4780);
    expect(artifactMainStatValue(5, 20, "atk")).toBe(311);
    expect(artifactMainStatValue(5, 20, "atk_")).toBe(0.466);
    expect(artifactMainStatValue(5, 20, "critRate_")).toBe(0.311);
    expect(artifactSubstatTiers(5, "atk")).toEqual([13.62, 15.56, 17.51, 19.45]);
    expect(() => artifactMainStatValue(5, 19.5, "atk_")).toThrow("整数");
    expect(() => artifactMainStatValue(4, 20, "atk_")).toThrow("0–16");
  });

  it("retains each exact roll and source so the shared core sums real contributions", () => {
    const result = resolveArtifactBuild([flower]);
    expect(result.statContributions).toHaveLength(9);
    expect(result.statContributions.filter(term => term.property === "FIGHT_PROP_CRITICAL").map(term => term.value)).toEqual([0.0272, 0.0272, 0.0272, 0.0272, 0.0272]);
    expect(result.statContributions[0]).toMatchObject({ property: "FIGHT_PROP_HP", value: 4780 });
    expect(result.setCounts).toEqual({ "artifact-set:15001": 1 });
    expect(result.statContributions.every(term => term.sourceRef.includes("180a0a1015cb725c7570cd828eb086749960df98"))).toBe(true);
  });

  it("checks slot/set rarity and main/substat exclusivity", () => {
    expect(() => resolveArtifactBuild([flower, flower])).toThrow("重复装备");
    expect(() => resolveArtifactBuild([{ ...flower, setId: "artifact-set:15009", rarity: 4 }])).toThrow("没有生之花");
    expect(() => resolveArtifactBuild([{ ...flower, setId: "artifact-set:10005" }])).toThrow("不存在 5 星");
    expect(() => resolveArtifactBuild([{ ...flower, mainStat: "critRate_" }])).toThrow("不允许主词条");
    expect(() => resolveArtifactBuild([{ ...flower, substats: [{ stat: "hp", rolls: [0, 0, 0, 0, 0] }, ...flower.substats.slice(1)] }])).toThrow("不能同名");
  });

  it("requires every unlock and upgrade rather than accepting arbitrary substat totals", () => {
    expect(() => resolveArtifactBuild([{ ...flower, substats: flower.substats.map(sub => ({ ...sub, rolls: [0] })) }])).toThrow("需要 8 次");
    expect(() => resolveArtifactBuild([{ ...flower, level: 0, substats: flower.substats.slice(0, 3) }])).toThrow("未解锁四条");
    expect(() => resolveArtifactBuild([{ ...flower, substats: [{ stat: "critRate_", rolls: [0, 0, 0, 0, 4] }, ...flower.substats.slice(1)] }])).toThrow("没有档位 4");
    expect(resolveArtifactBuild([{ slot: "flower", setId: "artifact-set:10010", rarity: 1, level: 0, mainStat: "hp", initialSubstats: 0, substats: [] }]).statContributions[0]?.value).toBe(129);
  });

  it("adds equipped terms and enabled source effects exactly once", () => {
    const pieces: ArtifactPieceInput[] = ["flower", "plume"].map((slot) => ({
      slot: slot as "flower" | "plume", setId: "artifact-set:15001", rarity: 5, level: 0, mainStat: slot === "flower" ? "hp" : "atk", initialSubstats: 3,
      substats: [{ stat: "critRate_", rolls: [3] }, { stat: "critDMG_", rolls: [3] }, { stat: "atk_", rolls: [3] }]
    }));
    const result = resolveEquipmentBuild({ characterId: "character:10000002", weaponId: "weapon:11302", level: 90, ascension: 6, weaponLevel: 90, weaponAscension: 6, refinement: 5, effectsDisabled: true, artifacts: pieces, weaponEffectsEnabled: true, setEffectsEnabled: true, effectContext: { hpFraction: 1 } });
    expect(result.build.flatHp).toBe(717);
    expect(result.build.flatAtk).toBe(47);
    expect(result.build.atkPercent).toBeCloseTo(0.0583 * 2 + 0.18, 12);
    expect(result.build.critRate).toBeCloseTo(0.05 + 0.0389 * 2 + 0.28, 12);
    expect(result.build.equipment.artifacts).toEqual(pieces);
    expect(result.build.equipment.effectContext?.hpFraction).toBe(1);
    expect(result.verification).toBe("provisional");
  });
});
