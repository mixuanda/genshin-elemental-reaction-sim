import { describe, expect, it } from "vitest";
import { gameDataCatalog, findTalentSetById } from "../catalog";
import {
  normalAttackMappings,
  normalAttackMappingExclusions,
  normalAttackSourceEvidence
} from "./normal-attack-mappings";

describe("pinned source normal-attack classification", () => {
  it("cross-checks every imported catalog coefficient against all 15 pinned source levels", () => {
    for (const mapping of normalAttackMappings) {
      const character = gameDataCatalog.characters.find((entry) => entry.slug === mapping.characterSlug);
      expect(character, mapping.id).toBeDefined();
      expect(character!.talentSetIds, mapping.id).toContain(mapping.talentSetId);
      const ability = findTalentSetById(mapping.talentSetId)?.abilities.find((entry) => entry.key === "combat1");
      const current = ability?.parameters[mapping.parameterKey];
      expect(mapping.sourceCoefficientValues, mapping.id).toHaveLength(15);
      expect(current, `${mapping.id}: catalog drift requires a new source classification`).toEqual(mapping.sourceCoefficientValues);
      expect(mapping.coefficientTolerance, mapping.id).toBe(0);
    }
  });

  it("retains actual emitted instances instead of collapsing multihits into a single large hit", () => {
    const count = (skillId: string) => normalAttackMappings
      .filter((mapping) => mapping.skillId === skillId)
      .reduce((sum, mapping) => sum + (mapping.instanceCount ?? 1), 0);
    expect(count("xiangling-normal-3")).toBe(2);
    expect(count("xiangling-normal-4")).toBe(4);
    expect(count("aino-normal-3")).toBe(2);
    expect(count("navia-normal-3")).toBe(3);
    expect(count("shikanoinheizou-normal-4")).toBe(3);
    expect(normalAttackMappings.filter((mapping) => mapping.skillId === "yunjin-normal-3")
      .map((mapping) => mapping.parameterKey)).toEqual(["param3", "param4"]);
    expect(normalAttackMappings.filter((mapping) => mapping.skillId === "shikanoinheizou-normal-4")
      .map((mapping) => mapping.parameterKey)).toEqual(["param4", "param5", "param6"]);
  });

  it("does not convert ambiguous parameter identity or alternate-state mechanics into complete actions", () => {
    for (const exclusion of normalAttackMappingExclusions) {
      expect(normalAttackMappings.some((mapping) => mapping.characterSlug === exclusion.characterSlug
        && (exclusion.normalIndex === null || mapping.skillId === `${exclusion.characterSlug}-normal-${exclusion.normalIndex}`))).toBe(false);
    }
    expect(normalAttackMappings.some((mapping) => mapping.skillId === "shenhe-normal-3")).toBe(true);
    expect(normalAttackMappings.some((mapping) => mapping.skillId === "shenhe-normal-5")).toBe(true);
    expect(normalAttackMappings.find((mapping) => mapping.id === "kaeya-normal-1-hit-1"))
      .toMatchObject({ element: "physical", scalingStat: "atk", attackTag: "normal", instanceCount: 1, completeAction: true });
  });

  it("attributes every classification source to the pinned archive with a file hash", () => {
    expect(normalAttackSourceEvidence.revision).toBe("b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541");
    for (const mapping of normalAttackMappings) {
      for (const source of mapping.sourcePaths) {
        const sha256 = normalAttackSourceEvidence.sourceSha256[source as keyof typeof normalAttackSourceEvidence.sourceSha256];
        expect(sha256, `${mapping.id}: ${source}`).toMatch(/^[a-f0-9]{64}$/);
      }
    }
    expect(new Set(normalAttackMappings.map((mapping) => mapping.id)).size).toBe(normalAttackMappings.length);
  });
});
