import { describe, expect, it } from "vitest";
import { gameDataCatalog, findTalentSetById } from "../catalog";
import {
  currentNormalMappings,
  currentNormalMappingExclusions,
  currentNormalSourceEvidence
} from "./current-normal-mappings";

describe("a7dc4bf base normal, charged and aimed classifications", () => {
  it("matches all 360 coefficient values to the active catalog, including Odette", () => {
    expect(new Set(currentNormalMappings.map((mapping) => mapping.characterSlug)))
      .toEqual(new Set(["iansan", "ifa", "jahoda", "prune", "odette"]));
    expect(currentNormalMappings).toHaveLength(24);
    for (const mapping of currentNormalMappings) {
      const character = gameDataCatalog.characters.find((entry) => entry.slug === mapping.characterSlug);
      expect(character, mapping.id).toBeDefined();
      expect(character!.talentSetIds, mapping.id).toContain(mapping.talentSetId);
      const ability = findTalentSetById(mapping.talentSetId)?.abilities.find((entry) => entry.key === "combat1");
      expect(mapping.abilityKey, mapping.id).toBe("combat1");
      expect(mapping.sourceCoefficientValues, mapping.id).toHaveLength(15);
      expect(ability?.parameters[mapping.parameterKey], `${mapping.id}: catalog drift requires source review`)
        .toEqual(mapping.sourceCoefficientValues);
      expect(mapping.coefficientTolerance, mapping.id).toBe(0);
    }
  });

  it("retains Jahoda N2's repeated arrow and Odette N3's two different hits", () => {
    const jahoda = currentNormalMappings.filter((mapping) => mapping.skillId === "jahoda-normal-2");
    expect(jahoda).toHaveLength(1);
    expect(jahoda[0]).toMatchObject({ parameterKey: "param2", instanceCount: 2, attackTag: "normal", element: "physical" });
    expect(jahoda[0]!.sourceCoefficientValues![9]).toBe(0.380154);

    const odette = currentNormalMappings.filter((mapping) => mapping.skillId === "odette-normal-3");
    expect(odette.map((mapping) => mapping.parameterKey)).toEqual(["param3", "param4"]);
    expect(odette.map((mapping) => mapping.sourceCoefficientValues![9])).toEqual([0.64464, 0.75667]);
    expect(odette.every((mapping) => mapping.instanceCount === 1)).toBe(true);
    expect(new Set(currentNormalMappings.filter((mapping) => mapping.attackTag === "normal").map((mapping) => mapping.skillId)).size).toBe(17);
    expect(currentNormalMappings.reduce((sum, mapping) => sum + (mapping.instanceCount ?? 1), 0)).toBe(25);
    expect(currentNormalMappings.some((mapping) => mapping.skillId === "odette-normal-6")).toBe(false);
  });

  it("keeps the ordinary branches separate from replacement attacks and weakspot crit", () => {
    const ifa = currentNormalMappings.find((mapping) => mapping.skillId === "ifa-charged-base")!;
    expect(ifa).toMatchObject({ abilityKey: "combat1", attackTag: "charged", element: "anemo", scalingStat: "atk", parameterKey: "param4" });
    expect(ifa.sourceCoefficientValues![9]).toBe(2.64672);
    expect(ifa.assumptions.join(" ")).toContain("nightsoulState.HasBlessing()=false");
    const iansan = currentNormalMappings.find((mapping) => mapping.skillId === "iansan-charged-base")!;
    expect(iansan).toMatchObject({ element: "physical", parameterKey: "param4" });
    expect(iansan.sourceCoefficientValues![9]).toBe(1.9822);
    expect(currentNormalMappings.some((mapping) => mapping.characterSlug === "iansan" && mapping.parameterKey === "param5")).toBe(false);

    const physical = currentNormalMappings.find((mapping) => mapping.skillId === "jahoda-aimed-physical")!;
    const charged = currentNormalMappings.find((mapping) => mapping.skillId === "jahoda-aimed-fully-charged")!;
    expect(physical).toMatchObject({ element: "physical", parameterKey: "param4", attackTag: "charged" });
    expect(charged).toMatchObject({ element: "anemo", parameterKey: "param5", attackTag: "charged" });
    expect([physical, charged].every((mapping) => mapping.assumptions.join(" ").includes("weakspot=0"))).toBe(true);
    const prune = currentNormalMappings.find((mapping) => mapping.skillId === "prune-charged-base")!;
    expect(prune.assumptions.join(" ")).toContain("NormalCounter≠0");
    expect(currentNormalMappingExclusions.find((exclusion) => exclusion.action === "charged-without-normal-prerequisite")?.reason)
      .toContain("NormalCounter=0");
  });

  it("pins all semantic and numeric source files to the distinct new revision", () => {
    expect(currentNormalSourceEvidence.revision).toBe("a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd");
    expect(currentNormalSourceEvidence.archiveSha256).toBe("c0484e23afda76d7b38bb4fb49c2592b4b7bdccc8d549eaf8a4848e37aa55165");
    const hashes = currentNormalSourceEvidence.sourceSha256;
    for (const mapping of currentNormalMappings) {
      expect(mapping.sourceCommit, mapping.id).toBe(currentNormalSourceEvidence.revision);
      for (const path of mapping.sourcePaths) expect(hashes[path as keyof typeof hashes], `${mapping.id}: ${path}`).toMatch(/^[a-f0-9]{64}$/);
    }
    for (const exclusion of currentNormalMappingExclusions) expect(hashes[exclusion.sourcePath]).toMatch(/^[a-f0-9]{64}$/);
    expect(new Set(currentNormalMappings.map((mapping) => mapping.id)).size).toBe(currentNormalMappings.length);
  });
});
