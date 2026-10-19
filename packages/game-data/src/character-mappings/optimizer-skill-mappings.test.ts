import { describe, expect, it } from "vitest";
import { findTalentSetById } from "../catalog";
import {
  optimizerSkillMappings,
  optimizerSkillMappingExclusions,
  optimizerSkillSourceEvidence
} from "./optimizer-skill-mappings";

function required<T>(value: T | undefined): T {
  expect(value).toBeDefined();
  if (value === undefined) throw new Error("Expected a reviewed source term or formula parameter");
  return value;
}

describe("production Optimizer deterministic ordinary E/Q components", () => {
  it("cross-checks all 195 unique talent coefficient and formula parameter values", () => {
    expect(optimizerSkillMappings).toHaveLength(7);
    const fields = new Set<string>();
    for (const mapping of optimizerSkillMappings) {
      const ability = findTalentSetById(mapping.talentSetId)?.abilities.find((entry) => entry.key === mapping.abilityKey);
      const terms = [mapping, ...(mapping.additionalTerms ?? []), ...(mapping.formulaParameters ?? [])];
      for (const term of terms) {
        expect(term.sourceCoefficientValues, mapping.id).toHaveLength(15);
        expect(ability?.parameters[term.parameterKey], `${mapping.id}: ${term.parameterKey} drift requires source review`)
          .toEqual(term.sourceCoefficientValues);
        expect(term.coefficientTolerance).toBe(0);
        fields.add(`${mapping.talentSetId}.${mapping.abilityKey}.${term.parameterKey}`);
      }
    }
    expect(fields.size).toBe(13);
  });

  it("retains both Illuga EM/DEF terms and the explicit Song-off dependency", () => {
    const press = optimizerSkillMappings.find((mapping) => mapping.id === "illuga-skill-press-hit")!;
    const hold = optimizerSkillMappings.find((mapping) => mapping.id === "illuga-skill-hold-hit")!;
    expect(press.sourceCoefficientValues![9]).toBe(8.68608);
    expect(required(press.additionalTerms?.[0]).sourceCoefficientValues[9]).toBe(4.34304);
    expect(hold.sourceCoefficientValues![9]).toBe(10.8576);
    expect(required(hold.additionalTerms?.[0]).sourceCoefficientValues[9]).toBe(5.4288);
    for (const mapping of [press, hold]) {
      expect(mapping).toMatchObject({ scalingStat: "em", element: "geo", attackTag: "skill", completeAction: true, instanceCount: 1 });
      expect(required(mapping.additionalTerms?.[0]).scalingStat).toBe("def");
      expect(mapping.assumptions.join(" ")).toContain("burstSong=off");
      expect(mapping.assumptions.join(" ")).toContain("不能由 C0 自动推出");
      expect(mapping.assumptions.join(" ")).toContain("target.charKey≠Illuga");
    }
    expect(optimizerSkillMappings.some((mapping) => mapping.characterSlug === "illuga" && mapping.abilityKey === "combat3")).toBe(false);
    expect(optimizerSkillMappingExclusions.find((entry) => entry.characterSlug === "illuga" && entry.action === "burst")?.reason)
      .toContain("缺独立执行时序证据");
  });

  it("keeps Zibai's ordinary first hits partial and separate from lunar second hits", () => {
    const skill = optimizerSkillMappings.find((mapping) => mapping.id === "zibai-spirit-steed-first-hit")!;
    const burst = optimizerSkillMappings.find((mapping) => mapping.id === "zibai-burst-first-hit")!;
    expect(skill).toMatchObject({ abilityKey: "combat2", parameterKey: "param1", attackTag: "skill", scalingStat: "def", completeAction: false });
    expect(burst).toMatchObject({ abilityKey: "combat3", parameterKey: "param1", attackTag: "burst", scalingStat: "def", completeAction: false });
    expect(skill.sourceCoefficientValues![9]).toBe(3.105504);
    expect(burst.sourceCoefficientValues![9]).toBe(2.28528);
    expect(skill.assumptions.join(" ")).toContain("这不是进入隙中月的 E 开启动作");
    for (const mapping of [skill, burst]) {
      expect(mapping.instanceCount).toBe(1);
      expect(mapping.additionalTerms).toBeUndefined();
      expect(mapping.assumptions.join(" ")).toContain("只属于 Spirit Steed's Stride 的第二段月结晶");
      expect(mapping.exclusions.join(" ")).toContain("不得把此结果标为整次战技重施或完整爆发总伤害");
    }
  });

  it("excludes Nefer's disputed E Veil multiplier and retains the independent Q bonus and EM context", () => {
    const skill = optimizerSkillMappings.find((mapping) => mapping.id === "nefer-skill-rush-hit")!;
    const burst = optimizerSkillMappings.filter((mapping) => mapping.skillId === "nefer-burst");
    expect(skill.additiveFormulaId).toBeUndefined();
    expect(skill.elementalMasteryAdjustmentFormulaId).toBe("nefer-full-veil-em");
    expect(skill.damageBonusFormulaId).toBeUndefined();
    expect(skill.sourceCoefficientValues![9]).toBe(1.374912);
    expect(required(skill.additionalTerms?.[0]).sourceCoefficientValues[9]).toBe(2.749824);
    expect(skill.assumptions.join(" ")).toContain("不乘外部附加伤害");
    expect(burst).toHaveLength(2);
    expect(burst.map((mapping) => mapping.parameterKey)).toEqual(["param1", "param3"]);
    expect(burst.map((mapping) => required(mapping.additionalTerms?.[0]).parameterKey)).toEqual(["param2", "param4"]);
    for (const hit of burst) {
      expect(hit.damageBonusFormulaId).toBe("nefer-burst-veils");
      expect(hit.additiveFormulaId).toBeUndefined();
      const bonusParameter = required(hit.formulaParameters?.[0]);
      expect(bonusParameter).toMatchObject({ key: "neferBurstBonusPerVeil", parameterKey: "param5", coefficientTolerance: 0 });
      expect(bonusParameter.sourceCoefficientValues[9]).toBe(0.4);
      expect(hit).toMatchObject({ element: "dendro", attackTag: "burst", completeAction: true });
      expect(hit.elementalMasteryAdjustmentFormulaId).toBe("nefer-full-veil-em");
      expect(hit.assumptions.join(" ")).toContain("共享核心只加一次");
      expect(hit.assumptions.join(" ")).toContain("C0–C6");
    }
  });

  it("reuses the pinned production-source hashes and records skill-specific coordinates", () => {
    const evidence = optimizerSkillSourceEvidence;
    expect(evidence.sourceRepository).toBe("frzyc/genshin-optimizer");
    expect(evidence.revision).toBe("180a0a1015cb725c7570cd828eb086749960df98");
    expect(evidence.fieldCoordinates).toHaveLength(14);
    for (const mapping of optimizerSkillMappings) {
      expect(mapping.sourceRepository).toBe(evidence.sourceRepository);
      expect(mapping.sourceCommit).toBe(evidence.revision);
      for (const path of mapping.sourcePaths) {
        const file = evidence.sourceFiles.find((entry) => entry.path === path)!;
        expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(file.url).toBe(`https://raw.githubusercontent.com/${evidence.sourceRepository}/${evidence.revision}/${path}`);
        expect(path).not.toContain("/formula/src/data/");
      }
    }
    expect(new Set(optimizerSkillMappings.map((mapping) => mapping.id)).size).toBe(7);
  });
});
