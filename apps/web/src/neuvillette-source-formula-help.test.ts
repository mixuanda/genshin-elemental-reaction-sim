import { expect, it } from "vitest";
import type { SourceSingleSkillDraft } from "./source-single-skill";
import { renderNeuvilletteSourceFormulaHelp } from "./neuvillette-source-formula-help";

it("explains only pinned C0 Equitable Judgment/Q without changing energy, inputs or subtotal scope", () => {
  const input: SourceSingleSkillDraft = { schemaVersion: 1,
    source: { hostVariant: "classic", revision: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541" },
    member: { id: "neuv", characterKey: "neuvillette", level: 90, levelCap: 90, constellation: 0,
      talents: { auto: 10, skill: 6, burst: 6 }, weapon: { key: "prototypeamber", level: 90, levelCap: 90, refinement: 1 },
      artifactSets: [], artifactStats: {}, initialEnergy: 0 },
    action: { kind: "charge", params: { short: 0, ticks: 1 } }, durationSeconds: 2.2,
    target: { level: 90, resistance: .1 }, startup: "zero", seed: "11" };
  const before = structuredClone(input), charge = renderNeuvilletteSourceFormulaHelp(input);
  expect(charge).toContain("突破1解锁后逐波读取"); expect(charge).toContain("不默认满层");
  expect(charge).toContain("不是随机均值、完整施放伤害或循环DPS");
  expect(charge).toContain("公式伤害（扣除目标剩余生命前）");
  expect(charge).not.toContain("完整技能固有伤害："); expect(input).toEqual(before);
  const burst = structuredClone(input); burst.action = { kind: "burst" };
  const burstBefore = structuredClone(burst), html = renderNeuvilletteSourceFormulaHelp(burst);
  expect(html).toContain("不用后续命中时的生命上限替换"); expect(html).toContain("Q不乘遗龙之荣");
  expect(html).toContain("min(0.3, max(0,"); expect(burst).toEqual(burstBefore);
  for (const change of [
    (copy: SourceSingleSkillDraft) => { copy.member.constellation = 1; },
    (copy: SourceSingleSkillDraft) => { copy.source.revision = "unknown"; },
    (copy: SourceSingleSkillDraft) => { copy.source.hostVariant = "stellar"; },
    (copy: SourceSingleSkillDraft) => { copy.member.characterKey = "kaeya"; },
    (copy: SourceSingleSkillDraft) => { copy.action = { kind: "charge", params: { short: 1 } }; },
    (copy: SourceSingleSkillDraft) => { copy.action = { kind: "skill" }; },
  ]) { const copy = structuredClone(input); change(copy); expect(renderNeuvilletteSourceFormulaHelp(copy)).toBe(""); }
});
