import { describe, expect, it } from "vitest";
import { findTalentSetById, gameDataCatalog } from "../catalog";
import { optimizerResourceMappings, optimizerResourceSourceEvidence } from "./optimizer-resource-mappings";

const commit = "180a0a1015cb725c7570cd828eb086749960df98";

describe("Lohen explicit consumed-Will source mappings", () => {
  it("matches both base vectors and both fifteen-level resource coefficient vectors exactly", () => {
    expect(optimizerResourceMappings).toHaveLength(2);
    const character = gameDataCatalog.characters.find((entry) => entry.slug === "lohen");
    expect(character?.talentSetIds).toContain("talent-set:lohen");
    let positions = 0;
    for (const mapping of optimizerResourceMappings) {
      const ability = findTalentSetById(mapping.talentSetId)?.abilities.find((entry) => entry.key === mapping.abilityKey);
      for (const term of [mapping, ...(mapping.formulaParameters ?? [])]) {
        expect(term.sourceCoefficientValues, mapping.id).toHaveLength(15);
        expect(term.coefficientTolerance, mapping.id).toBe(0);
        expect(ability?.parameters[term.parameterKey], mapping.id).toEqual(term.sourceCoefficientValues);
        positions += term.sourceCoefficientValues!.length;
      }
    }
    expect(positions).toBe(60);
  });

  it("binds the exact E and Q slots to the resource formula rather than treating the coefficient as another ATK term", () => {
    expect(optimizerResourceMappings.map((entry) => [entry.abilityKey, entry.parameterKey, entry.formulaParameters?.[0]?.parameterKey]))
      .toEqual([["combat2", "param17", "param18"], ["combat3", "param1", "param2"]]);
    for (const mapping of optimizerResourceMappings) {
      expect(mapping).toMatchObject({
        characterSlug: "lohen", element: "cryo", scalingStat: "atk",
        additiveFormulaId: "lohen-will-consumed", sourceRepository: "frzyc/genshin-optimizer", sourceCommit: commit
      });
      expect(mapping.formulaParameters).toEqual([{
        key: "willMultiplierPerPoint", parameterKey: mapping.abilityKey === "combat2" ? "param18" : "param2",
        sourceCoefficientValues: Array<number>(15).fill(0.004), coefficientTolerance: 0
      }]);
      expect(mapping.additionalTerms).toBeUndefined();
      expect(mapping.assumptions.join(" ")).toContain("ATK×天赋倍率×(1+willMultiplierPerPoint×willConsumed)");
    }
    expect(optimizerResourceMappings[0]!.sourceCoefficientValues![9]).toBe(1.08);
    expect(optimizerResourceMappings[1]!.sourceCoefficientValues![9]).toBe(2.1384);
  });

  it("distinguishes one etch component from the explicitly six-hit burst and preserves actual ascension context", () => {
    expect(optimizerResourceMappings[0]).toMatchObject({ attackTag: "skill", instanceCount: 1, completeAction: false });
    expect(optimizerResourceMappings[1]).toMatchObject({ attackTag: "burst", instanceCount: 6, completeAction: true });
    expect(optimizerResourceMappings[0]!.assumptions.join(" ")).toContain("a0HighSpirits");
    expect(optimizerResourceMappings[0]!.assumptions.join(" ")).toContain("实际有效 E 天赋等级");
    for (const mapping of optimizerResourceMappings) {
      expect(mapping.assumptions.join(" ")).toContain("最终 ATK 必须包含实际 A4 状态");
      expect(mapping.assumptions.join(" ")).not.toContain("a4MasterCryo=off");
      expect(mapping.assumptions.join(" ")).toContain("未触发时不可虚构加攻");
    }
  });

  it("records source UI choices without claiming an exhaustive in-game resource domain or a zero default", () => {
    const evidence = optimizerResourceSourceEvidence;
    expect(evidence.sourceUiChoices).toEqual([20, 40, 60, 80, 100]);
    expect(evidence.sourceMaxWill).toBe(100);
    expect(evidence.sourceWillGainPerEvent).toBe(20);
    expect(evidence.sourceAscension1AdditionalWillGain).toBe(60);
    expect(evidence.resourceGranularityStatus).toBe("unverified");
    expect(evidence.automaticResourceSchedulerVerified).toBe(false);
    expect(evidence.emptyChoiceSourceFallback).toContain("not proof of a real consumed amount");
    for (const mapping of optimizerResourceMappings) {
      expect(mapping.assumptions.join(" ")).toContain("20仅为明确的教学示例，不是缺失上下文默认值");
      expect(mapping.exclusions.join(" ")).toContain("naught");
    }
  });

  it("pins the production expressions, inclusive range helper and their verified Git blob identities", () => {
    const evidence = optimizerResourceSourceEvidence;
    expect(evidence.commit).toBe(commit);
    expect(evidence.sourceFiles).toHaveLength(6);
    expect(evidence.sourceUiRangeSemantics).toContain("i <= to");
    expect(evidence.verifiedCoefficientPositions).toBe(60);
    for (const file of evidence.sourceFiles) {
      expect(file.url).toBe(`https://raw.githubusercontent.com/frzyc/genshin-optimizer/${commit}/${file.path}`);
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(file.gitBlobSha).toMatch(/^[a-f0-9]{40}$/);
      expect(file.path).not.toContain("/formula/src/data/char/");
    }
    const hashes = evidence.sourceSha256;
    for (const mapping of optimizerResourceMappings) {
      for (const path of mapping.sourcePaths) expect(hashes[path as keyof typeof hashes], path).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
