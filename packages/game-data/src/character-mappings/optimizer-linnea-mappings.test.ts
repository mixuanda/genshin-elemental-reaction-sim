import { describe, expect, it } from "vitest";
import { findTalentSetById } from "../catalog";
import {
  optimizerLinneaMappings,
  optimizerLinneaMappingExclusions,
  optimizerLinneaSourceEvidence
} from "./optimizer-linnea-mappings";

function required<T>(value: T | undefined): T {
  expect(value).toBeDefined();
  if (value === undefined) throw new Error("Expected reviewed Linnea mapping");
  return value;
}

describe("pinned Linnea ordinary Lumi component", () => {
  it("cross-checks the full 15-level ordinary DEF coefficient vector", () => {
    expect(optimizerLinneaMappings).toHaveLength(1);
    const mapping = required(optimizerLinneaMappings[0]);
    const ability = findTalentSetById("talent-set:linnea")?.abilities.find((entry) => entry.key === "combat2");
    expect(mapping.sourceCoefficientValues).toHaveLength(15);
    expect(ability?.parameters.param1).toEqual(mapping.sourceCoefficientValues);
    expect(mapping).toMatchObject({ parameterKey: "param1", abilityKey: "combat2", scalingStat: "def", element: "geo", attackTag: "skill", coefficientTolerance: 0 });
    expect(mapping.sourceCoefficientValues![0]).toBe(0.96);
    expect(mapping.sourceCoefficientValues![9]).toBe(1.728);
    expect(mapping.sourceCoefficientValues![14]).toBe(2.28);
  });

  it("represents two Pummeler instances without inventing a full summon hit count", () => {
    const mapping = required(optimizerLinneaMappings[0]);
    expect(mapping).toMatchObject({ skillId: "linnea-lumi-pummeler-pair", instanceCount: 2, completeAction: false });
    expect(mapping.additionalTerms).toBeUndefined();
    expect(optimizerLinneaSourceEvidence.multiplicityEvidence).toContain("one ordinary pummelerDmg formula");
    expect(optimizerLinneaSourceEvidence.constants.find((constant) => constant.key === "pummelerInstanceCount"))
      .toMatchObject({ value: 2, corroborationField: "skill.skillParamsEncoding.0 = {{0, percent(fixed: 1)}}% DEF ×2" });
    expect(optimizerLinneaMappingExclusions.map((exclusion) => exclusion.action)).toEqual([
      "lumi-heavy-overdrive-hammer", "lumi-million-ton-crush", "full-summon-duration"
    ]);
    expect(mapping.exclusions.join(" ")).toContain("25秒持续时间不能推出命中总轮数");
  });

  it("routes A1 to the resistance formula with sourced total reductions, not a hardcoded final resistance", () => {
    const mapping = required(optimizerLinneaMappings[0]);
    const constants = optimizerLinneaSourceEvidence.constants;
    expect(mapping.resistanceReductionFormulaId).toBe("linnea-a1-lumi");
    expect(mapping).not.toHaveProperty("effectiveResistance");
    expect(mapping.damageBonusFormulaId).toBeUndefined();
    expect(constants.find((constant) => constant.key === "a1MinimumAscension")?.value).toBe(1);
    expect(constants.find((constant) => constant.key === "ascendantMoonsignThreshold")?.value).toBe(2);
    expect(constants.find((constant) => constant.key === "a1GeoResistanceReduction")?.value).toBe(0.15);
    expect(constants.find((constant) => constant.key === "a1AscendantTotalGeoResistanceReduction")?.value).toBe(0.3);
    expect(mapping.assumptions.join(" ")).toContain("0.30 已是总量，不能再加0.15");
    expect(mapping.assumptions.join(" ")).toContain("目标处于减抗范围");
  });

  it("retains immutable primary source bytes, exact URLs, line locations and constant fields", () => {
    const evidence = optimizerLinneaSourceEvidence;
    const mapping = required(optimizerLinneaMappings[0]);
    expect(mapping.sourceRepository).toBe("frzyc/genshin-optimizer");
    expect(mapping.sourceCommit).toBe("180a0a1015cb725c7570cd828eb086749960df98");
    for (const path of mapping.sourcePaths) {
      const source = evidence.sourceFiles.find((entry) => entry.path === path)!;
      expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(source.url).toBe(`https://raw.githubusercontent.com/${mapping.sourceRepository}/${mapping.sourceCommit}/${path}`);
      expect(path).not.toContain("/formula/src/data/");
    }
    for (const source of evidence.sourceLocations) {
      expect(source.startLine).toBeGreaterThan(0);
      expect(source.endLine).toBeGreaterThanOrEqual(source.startLine);
      expect(evidence.sourceFiles.some((entry) => entry.path === source.path)).toBe(true);
    }
    expect(evidence.constants.find((constant) => constant.key === "a1GeoResistanceReduction"))
      .toMatchObject({ sourceLocation: "/passive1/0/0" });
    expect(evidence.constants.find((constant) => constant.key === "a1AscendantTotalGeoResistanceReduction"))
      .toMatchObject({ sourceLocation: "/passive1/1/0" });
  });
});
