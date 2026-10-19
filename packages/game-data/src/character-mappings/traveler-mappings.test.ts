import { describe, expect, it } from "vitest";
import { findTalentSetById, gameDataCatalog } from "../catalog";
import {
  travelerMappings,
  travelerMappingBlockers,
  travelerRoundingEvidence,
  travelerSourceEvidence
} from "./traveler-mappings";

describe("source-reviewed traveler gender and element variants", () => {
  it("resolves every hit against the selected gender and element instead of a canonical traveler talent", () => {
    for (const mapping of travelerMappings) {
      const character = gameDataCatalog.characters.find((entry) => entry.slug === mapping.characterSlug);
      expect(character?.talentSetIds, mapping.id).toContain(mapping.talentSetId);
      expect(mapping.variantId, mapping.id).toBe(`${mapping.characterSlug}-${mapping.talentSetId.replace("talent-set:traveler", "")}`);
      expect(mapping.id.startsWith(`${mapping.variantId}-`), mapping.id).toBe(true);
    }
    expect(new Set(travelerMappings.map((mapping) => mapping.variantId)).size).toBe(12);
    expect(new Set(travelerMappings.map((mapping) => mapping.id)).size).toBe(travelerMappings.length);
  });

  it("requires exact vectors except the three documented source tables rounded to four decimals", () => {
    for (const mapping of travelerMappings) {
      const ability = findTalentSetById(mapping.talentSetId)?.abilities.find((entry) => entry.key === mapping.abilityKey);
      const values = ability?.parameters[mapping.parameterKey];
      const source = mapping.sourceCoefficientValues!;
      expect(values, mapping.id).toHaveLength(15);
      expect(source, mapping.id).toHaveLength(15);
      if (mapping.coefficientTolerance === 0) {
        expect(values, mapping.id).toEqual(source);
      } else {
        expect(mapping.coefficientTolerance, mapping.id).toBe(0.00005);
        const evidence = travelerRoundingEvidence.find((entry) => mapping.talentSetId === `talent-set:traveler${entry.element}`
          && mapping.abilityKey === entry.abilityKey && mapping.parameterKey === entry.parameterKey);
        expect(evidence, mapping.id).toBeDefined();
        expect(values, mapping.id).toEqual(evidence!.catalogValues);
        expect(source, mapping.id).toEqual(evidence!.sourceValues);
        for (let level = 0; level < 15; level += 1) {
          expect(Math.round(values![level]! * 10_000) / 10_000, `${mapping.id}: level ${level + 1}`).toBe(source[level]);
          expect(Math.abs(values![level]! - source[level]!)).toBeLessThanOrEqual(0.00005);
        }
      }
    }
    expect(travelerRoundingEvidence).toHaveLength(3);
  });

  it("retains seven unabsorbed Anemo hold hits and four Geo shockwaves with explicit assumptions", () => {
    for (const gender of ["aether", "lumine"]) {
      const hold = travelerMappings.filter((mapping) => mapping.skillId === `${gender}-anemo-skill-hold-6-no-absorption`);
      expect(hold.map((mapping) => [mapping.parameterKey, mapping.instanceCount])).toEqual([["param1", 2], ["param2", 4], ["param4", 1]]);
      expect(hold.every((mapping) => mapping.completeAction && mapping.assumptions.join(" ").includes("eAbsorb=NoElement"))).toBe(true);
      expect(travelerMappings.find((mapping) => mapping.skillId === `${gender}-geo-burst-four-shockwaves`))
        .toMatchObject({ instanceCount: 4, completeAction: true, attackTag: "burst", element: "geo" });
    }
  });

  it("never substitutes the shared Lumine charged second hit for Aether's different source vector", () => {
    for (const element of ["anemo", "geo", "electro", "dendro", "hydro"]) {
      const female = travelerMappings.filter((mapping) => mapping.skillId === `lumine-${element}-charged-base`);
      expect(female.map((mapping) => mapping.parameterKey)).toEqual(["param6", "param7"]);
      expect(female.every((mapping) => mapping.completeAction)).toBe(true);
      const male = travelerMappings.filter((mapping) => mapping.skillId === `aether-${element}-charged-base`);
      expect(male).toHaveLength(1);
      expect(male[0]).toMatchObject({ parameterKey: "param6", completeAction: false });
      expect(travelerMappingBlockers.find((blocker) => blocker.skillId === `aether-${element}-charged-base`))
        .toMatchObject({ parameterKey: "param7", abilityKey: "combat1" });
    }
    for (const gender of ["aether", "lumine"]) {
      expect(travelerMappings.filter((mapping) => mapping.skillId === `${gender}-pyro-charged-base`))
        .toEqual([expect.objectContaining({ parameterKey: "param6", completeAction: false })]);
    }
  });

  it("exposes real Anemo and Dendro burst disagreements as blockers with both vectors", () => {
    for (const gender of ["aether", "lumine"]) {
      const anemo = travelerMappingBlockers.find((entry) => entry.skillId === `${gender}-anemo-burst`)!;
      expect(anemo.evidence.sourceValues).toEqual(expect.arrayContaining([0.376, 0.6768]));
      expect(anemo.evidence.catalogValues).toEqual(expect.arrayContaining([0.808, 1.4544]));
      expect(travelerMappings.some((mapping) => mapping.skillId === anemo.skillId)).toBe(false);
      const dendro = travelerMappingBlockers.find((entry) => entry.skillId === `${gender}-dendro-burst-lamp-tick`)!;
      expect((dendro.evidence.sourceValues as number[])[13]).toBe(1.80036);
      expect((dendro.evidence.catalogValues as number[])[13]).toBe(1.8036);
      expect(travelerMappings.some((mapping) => mapping.skillId === dendro.skillId)).toBe(false);
    }
  });

  it("keeps Dendro's EM passive in the damage-bonus context and its fire-transformed explosion Dendro", () => {
    const skill = travelerMappings.find((entry) => entry.skillId === "lumine-dendro-skill")!;
    expect(skill.assumptions.join(" ")).toContain("0.0015");
    expect(skill.assumptions.join(" ")).toContain("最终伤害加成区");
    const explosion = travelerMappings.find((entry) => entry.skillId === "lumine-dendro-burst-pyro-transformed-explosion")!;
    expect(explosion).toMatchObject({ element: "dendro", completeAction: false, attackTag: "burst" });
    expect(explosion.assumptions.join(" ")).toContain("0.001");
  });

  it("separates known Hydro tap hits from the unresolved full hold HP-drain context", () => {
    for (const gender of ["aether", "lumine"]) {
      const ready = travelerMappings.filter((entry) => entry.skillId === `${gender}-hydro-skill-tap-thorn-ready`);
      expect(ready.map((entry) => entry.parameterKey)).toEqual(["param2", "param3"]);
      expect(ready.every((entry) => entry.completeAction && entry.assumptions.join(" ").includes("a4Bonus=0"))).toBe(true);
      expect(travelerMappings.filter((entry) => entry.skillId === `${gender}-hydro-skill-tap-thorn-cooldown`)).toHaveLength(1);
      expect(travelerMappingBlockers.find((entry) => entry.skillId === `${gender}-hydro-skill-hold-full`)?.evidence)
        .toMatchObject({ sourceExpression: "drainHP := 0.04 * c.CurrentHP()", catalogExpression: "param5: 4% MaxHP" });
    }
  });

  it("keeps absent Cryo mechanics blocked for both genders without manufacturing zero damage", () => {
    const cryo = travelerMappingBlockers.filter((entry) => entry.variantId.endsWith("-cryo"));
    expect(cryo).toHaveLength(2);
    expect(cryo.every((entry) => entry.evidence.missingSourceDirectory === "internal/characters/traveler/common/cryo")).toBe(true);
    expect(travelerMappings.some((entry) => entry.variantId?.endsWith("-cryo"))).toBe(false);
  });

  it("pins actual common numeric tables, gender constructors, and every referenced source file", () => {
    const hashes = travelerSourceEvidence.sourceSha256;
    for (const entry of [...travelerMappings, ...travelerMappingBlockers]) {
      for (const path of entry.sourcePaths) expect(hashes[path as keyof typeof hashes], `${entry.id}: ${path}`).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(travelerSourceEvidence.numericLocation).toContain("common/<element>/stats.go");
  });
});
