import { describe, expect, it } from "vitest";
import { gameDataCatalog, findTalentSetById } from "../catalog";
import {
  chargedAttackMappings,
  chargedAttackMappingExclusions,
  chargedAttackSourceEvidence
} from "./charged-attack-mappings";

describe("pinned charged and plunge damage actions", () => {
  it("matches every 15-level source vector to one identified catalog combat1 field", () => {
    for (const mapping of chargedAttackMappings) {
      const character = gameDataCatalog.characters.find((entry) => entry.slug === mapping.characterSlug);
      expect(character, mapping.id).toBeDefined();
      expect(character!.talentSetIds, mapping.id).toContain(mapping.talentSetId);
      const ability = findTalentSetById(mapping.talentSetId)?.abilities.find((entry) => entry.key === mapping.abilityKey);
      expect(mapping.sourceCoefficientValues, mapping.id).toHaveLength(15);
      expect(ability?.parameters[mapping.parameterKey], `${mapping.id}: catalog drift requires source review`)
        .toEqual(mapping.sourceCoefficientValues);
      expect(mapping.coefficientTolerance, mapping.id).toBe(0);
    }
  });

  it("preserves three-hit charged actions and distinct two-term sword hits", () => {
    const count = (skillId: string) => chargedAttackMappings.filter((mapping) => mapping.skillId === skillId)
      .reduce((sum, mapping) => sum + (mapping.instanceCount ?? 1), 0);
    expect(count("kinich-charged-base")).toBe(3);
    expect(count("lanyan-charged-base")).toBe(3);
    expect(count("skirk-charged-base")).toBe(2);
    expect(chargedAttackMappings.filter((mapping) => mapping.skillId === "xingqiu-charged-base")
      .map((mapping) => mapping.parameterKey)).toEqual(["param8", "param9"]);
    expect(chargedAttackMappings.filter((mapping) => mapping.skillId === "varka-charged-base")
      .map((mapping) => mapping.parameterKey)).toEqual(["param10", "param11"]);
  });

  it("keeps Xilonen charged ATK separate from no-nightsoul plunge DEF", () => {
    expect(chargedAttackMappings.find((mapping) => mapping.skillId === "xilonen-charged-base"))
      .toMatchObject({ scalingStat: "atk", parameterKey: "param5", element: "physical", attackTag: "charged" });
    for (const height of ["low", "high"]) {
      const mapping = chargedAttackMappings.find((entry) => entry.skillId === `xilonen-${height}-plunge-no-collision`);
      expect(mapping).toMatchObject({ scalingStat: "def", element: "physical", attackTag: "plunge", instanceCount: 1 });
      expect(mapping?.assumptions.join(" ")).toContain("canUseNightsoul=false");
      expect(mapping?.assumptions.join(" ")).toContain("collision=0");
    }
  });

  it("keeps Yelan's HP-only barb distinct from a fully-charged ATK arrow and its default-ready state", () => {
    const barb = chargedAttackMappings.find((mapping) => mapping.skillId === "yelan-breakthrough-barb")!;
    const aimed = chargedAttackMappings.find((mapping) => mapping.skillId === "yelan-aimed-fully-charged")!;
    expect(barb).toMatchObject({ scalingStat: "hp", element: "hydro", parameterKey: "param7", instanceCount: 1 });
    expect(barb.additionalTerms).toBeUndefined();
    expect(barb.sourceCoefficientValues![9]).toBe(0.208368);
    expect(barb.assumptions.join(" ")).toContain("breakthrough=true");
    expect(aimed).toMatchObject({ scalingStat: "atk", element: "hydro", parameterKey: "param6" });
    expect(aimed.assumptions.join(" ")).toContain("breakthrough=false");
  });

  it("restores Yoimiya's main arrow plus the exact selected number of kindling arrows", () => {
    for (let extra = 0; extra <= 3; extra += 1) {
      const hits = chargedAttackMappings.filter((mapping) => mapping.skillId === `yoimiya-aimed-fully-charged-${extra}-kindling`);
      expect(hits.reduce((sum, mapping) => sum + (mapping.instanceCount ?? 1), 0)).toBe(extra + 1);
      expect(hits[0]).toMatchObject({ parameterKey: "param7", instanceCount: 1, scalingStat: "atk", element: "pyro" });
      if (extra > 0) expect(hits[1]).toMatchObject({ parameterKey: "param8", instanceCount: extra });
      for (const hit of hits) expect(hit.assumptions.join(" ")).toContain("焰硝庭火舞未启用");
    }
  });

  it("documents unresolved special formulas instead of reusing ordinary charged damage for them", () => {
    expect(chargedAttackMappingExclusions.find((entry) => entry.characterSlug === "columbina")?.action).toBe("charged-lunar-bloom");
    const columbina = chargedAttackMappings.find((mapping) => mapping.skillId === "columbina-charged-base")!;
    expect(columbina).toMatchObject({ scalingStat: "atk", element: "hydro", attackTag: "charged" });
    expect(columbina.assumptions.join(" ")).toContain("Dew=0");
    expect(chargedAttackMappings.some((mapping) => mapping.characterSlug === "zhongli")).toBe(false);
    expect(chargedAttackMappings.some((mapping) => mapping.characterSlug === "varesa")).toBe(false);
  });

  it("pins every source reference and keeps action IDs unique", () => {
    const hashes = chargedAttackSourceEvidence.sourceSha256;
    for (const mapping of chargedAttackMappings) {
      for (const path of mapping.sourcePaths) expect(hashes[path as keyof typeof hashes], `${mapping.id}: ${path}`).toMatch(/^[a-f0-9]{64}$/);
    }
    for (const blocker of chargedAttackMappingExclusions) expect(hashes[blocker.sourcePath]).toMatch(/^[a-f0-9]{64}$/);
    expect(new Set(chargedAttackMappings.map((mapping) => mapping.id)).size).toBe(chargedAttackMappings.length);
  });
});
