import { describe, expect, it } from "vitest";
import { findTalentSetById, gameDataCatalog } from "../catalog";
import {
  optimizerNormalMappings,
  optimizerNormalMappingExclusions,
  optimizerNormalSourceEvidence
} from "./optimizer-normal-mappings";

describe("fixed production Optimizer base attack mappings", () => {
  it("cross-checks every one of the 360 source values against the active catalog", () => {
    expect(optimizerNormalMappings).toHaveLength(24);
    expect(new Set(optimizerNormalMappings.map((mapping) => mapping.characterSlug)))
      .toEqual(new Set(["nefer", "zibai", "illuga"]));
    for (const mapping of optimizerNormalMappings) {
      const character = gameDataCatalog.characters.find((entry) => entry.slug === mapping.characterSlug);
      expect(character, mapping.id).toBeDefined();
      expect(character!.talentSetIds).toContain(mapping.talentSetId);
      const ability = findTalentSetById(mapping.talentSetId)?.abilities.find((entry) => entry.key === mapping.abilityKey);
      expect(mapping.sourceCoefficientValues, mapping.id).toHaveLength(15);
      expect(ability?.parameters[mapping.parameterKey], `${mapping.id}: re-review source when this catalog field changes`)
        .toEqual(mapping.sourceCoefficientValues);
      expect(mapping.coefficientTolerance).toBe(0);
    }
  });

  it("preserves the distinct equal-valued fields and exact multi-hit boundaries", () => {
    const action = (id: string) => optimizerNormalMappings.filter((mapping) => mapping.skillId === id);
    expect(action("nefer-normal-3")).toHaveLength(1);
    const neferThird = action("nefer-normal-3")[0];
    expect(neferThird).toBeDefined();
    if (!neferThird) throw new Error("Expected the reviewed Nefer N3 mapping");
    expect(neferThird).toMatchObject({ parameterKey: "param3", instanceCount: 2, element: "dendro" });
    expect(neferThird.sourceCoefficientValues![9]).toBe(0.45432);
    expect(action("zibai-normal-3").map((mapping) => mapping.parameterKey)).toEqual(["param3", "param4"]);
    expect(action("zibai-charged-base").map((mapping) => mapping.parameterKey)).toEqual(["param6", "param7"]);
    expect(action("zibai-charged-base").map((mapping) => mapping.sourceCoefficientValues![9])).toEqual([1.45605, 1.45605]);
    expect(action("illuga-normal-3").map((mapping) => mapping.parameterKey)).toEqual(["param3", "param4"]);
    expect(action("illuga-normal-3").map((mapping) => mapping.sourceCoefficientValues![9])).toEqual([0.62135, 0.62135]);
    expect(new Set(optimizerNormalMappings.map((mapping) => mapping.skillId)).size).toBe(21);
    expect(optimizerNormalMappings.reduce((sum, mapping) => sum + (mapping.instanceCount ?? 1), 0)).toBe(25);
    expect(optimizerNormalMappings.every((mapping) => mapping.scalingStat === "atk" && mapping.abilityKey === "combat1")).toBe(true);
  });

  it("limits complete actions to their stated base states, passives and zero-collision impacts", () => {
    const nefer = optimizerNormalMappings.find((mapping) => mapping.skillId === "nefer-charged-base")!;
    expect(nefer.assumptions.join(" ")).toContain("Shadow Dance（影舞）未启用");
    expect(nefer.assumptions.join(" ")).toContain("普通 ATK×倍率节点未接入该乘区");
    expect(nefer.assumptions.join(" ")).toContain("Slither 已退出");
    const zibai = optimizerNormalMappings.find((mapping) => mapping.skillId === "zibai-normal-1")!;
    expect(zibai.element).toBe("physical");
    expect(zibai.assumptions.join(" ")).toContain("Lunar Phase Shift（隙中月）未启用");
    expect(zibai.assumptions.join(" ")).toContain("A4 仅按队伍增加 DEF/EM");
    const illuga = optimizerNormalMappings.find((mapping) => mapping.skillId === "illuga-normal-1")!;
    expect(illuga.element).toBe("physical");
    expect(illuga.assumptions.join(" ")).toContain("target.charKey≠Illuga");
    expect(illuga.assumptions.join(" ")).toContain("未附魔的自身物理普攻/重击/下落不适用");
    const plunges = optimizerNormalMappings.filter((mapping) => mapping.attackTag === "plunge");
    expect(plunges).toHaveLength(6);
    for (const plunge of plunges) {
      expect(plunge.instanceCount).toBe(1);
      expect(plunge.assumptions.join(" ")).toContain("collision=0");
    }
    expect(optimizerNormalMappingExclusions.map((exclusion) => exclusion.action))
      .toContain("plunge-collision");
  });

  it("retains source repository, immutable file hashes, line locations and parameter coordinates", () => {
    const evidence = optimizerNormalSourceEvidence;
    expect(evidence.revision).toBe("180a0a1015cb725c7570cd828eb086749960df98");
    expect(evidence.sourceRepository).toBe("frzyc/genshin-optimizer");
    expect(evidence.fieldCoordinates).toHaveLength(24);
    for (const mapping of optimizerNormalMappings) {
      expect(mapping.sourceRepository).toBe(evidence.sourceRepository);
      expect(mapping.sourceCommit).toBe(evidence.revision);
      const field = evidence.fieldCoordinates.find((entry) => entry.mappingId === mapping.id)!;
      expect(field.catalogField).toBe(`talent:${mapping.characterSlug}:combat1.parameters.${mapping.parameterKey}`);
      expect(field.sourceReferenceLevelCount).toBe(15);
      for (const path of mapping.sourcePaths) {
        const file = evidence.sourceFiles.find((entry) => entry.path === path)!;
        expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(file.url).toBe(`https://raw.githubusercontent.com/${evidence.sourceRepository}/${evidence.revision}/${path}`);
        expect(path).not.toContain("/formula/src/data/");
      }
    }
    for (const location of evidence.sourceLocations) {
      expect(location.startLine).toBeGreaterThan(0);
      expect(location.endLine).toBeGreaterThanOrEqual(location.startLine);
      expect(evidence.sourceFiles.some((entry) => entry.path === location.path)).toBe(true);
    }
    expect(evidence.excludedSourceFiles).toHaveLength(3);
    expect(new Set(optimizerNormalMappings.map((mapping) => mapping.id)).size).toBe(24);
  });
});
