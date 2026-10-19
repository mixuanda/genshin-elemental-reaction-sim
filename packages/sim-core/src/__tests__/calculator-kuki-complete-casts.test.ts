import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import evidence from "../../../game-data/sources/kuki-skills/manifest.json";
import optimizer from "../../../game-data/sources/kuki-skills/manifest-go.json";
import comparison from "../../../game-data/sources/kuki-skills/optimizer-catalog-comparison.json";
import { sourceClassifiedMappings } from "../../../game-data/src/classified-hits";
import { applyCharacterConstellationScope, getCharacterDocuments, resetKukiPanelAccounting } from "../../../../apps/web/src/character-calculations";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument, type CalculatorHit } from "../calculator";

const fixture = (skillId: string): CalculatorDocument => {
  const document = getCharacterDocuments("character:10000065", 1).find((row) => row.gameContext?.skillId === skillId)!;
  document.build = {mode: "manual-final", source: "Explicit teaching panel, no inferred build or HP state", stats: {atk: 1000, hp: 20000, def: 800, em: 200, critRate: .5, critDamage: 1}};
  return document;
};
const hit = (document: CalculatorDocument, index: number) => document.hits[index] as Extract<CalculatorHit, {kind: "ordinary"}>;
const apply = applyCharacterConstellationScope;
const single = (document: CalculatorDocument, index: number): CalculatorDocument => { document.scope = "single-hit"; document.selectedHitIds = [document.hits[index]!.id]; return apply(document); };

describe("Kuki complete E/Q through the shared independent calculator", () => {
  it("retains exact fixed sources, calculates C0/C2 E with A4, and localizes the low-ascension initial conflict", () => {
    for (const file of [...evidence.files, ...optimizer.files]) expect(createHash("sha256").update(readFileSync(file.archivedPath)).digest("hex")).toBe(file.sha256);
    expect(comparison.numericValuesChecked).toBe(210);
    expect(evidence.comparedCoefficientPositions).toBe(45);
    expect(evidence.scope.ringHitFramesC0C1).toEqual([115, 205, 295, 385, 475, 565, 655, 745]);
    expect(evidence.scope.ringHitFramesC2C6.at(-1)).toBe(925);
    expect(sourceClassifiedMappings.some((mapping) => ["kuki-skill-hit", "kuki-skill-skilldot-hit", "kuki-burst-burst-hit"].includes(mapping.id))).toBe(false);
    for (const [branch, rings] of [[0, 8], [2, 10]] as const) {
      const document = apply(fixture(`kuki-skill-c${branch}-complete-cast`));
      const result = calculateDocument(document);
      const expected = (1000 * (.75712 + rings * .2524) + (1 + rings) * .25 * 200) * .5 * .9;
      expect(result.status).toBe("calculated"); expect(result.hits).toHaveLength(rings + 1);
      expect(result.totals!.nonCritical).toBeCloseTo(expected, 10); expect(result.totals!.expected).toBeCloseTo(expected * 1.5, 10);
      const base = result.hits[0]!.trace.find((node) => node.ruleId === "kuki-e-atk-and-a4-em-gcsim-b4ae769-optimizer-180a0a1")!;
      expect(base.result!.value).toBeCloseTo(807.12, 10); expect(base.symbolicFormula).toContain("em"); expect(base.substitution).toContain("200");
      expect(base.inputs.find((input) => input.key === "kukiA4Rate")!.value).toBe(.25);
    }
    let document = fixture("kuki-skill-c0-complete-cast");
    document.gameContext!.ascension = 3; delete document.gameContext!.kukiDamage!.ringUninterrupted; delete document.gameContext!.kukiDamage!.statsStableAcrossHits;
    document = single(document, 0);
    expect(calculateDocument(document).blockers.join()).toContain("低突破 E 初击存在固定来源冲突");
    document = single(document, 1);
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(1000 * .2524 * .5 * .9, 10);
    delete document.gameContext!.ascension;
    expect(calculateDocument(apply(document)).blockers.join()).toContain("突破阶段未知");
    document = fixture("kuki-skill-c0-complete-cast"); document.gameContext!.constellation = 2;
    expect(calculateDocument(apply(document)).status).toBe("blocked");
    expect(calculateDocument(single(document, 8)).status).toBe("calculated");
    document = fixture("kuki-skill-c2-complete-cast"); document.gameContext!.constellation = 0;
    expect(calculateDocument(single(document, 8)).status).toBe("calculated");
    expect(calculateDocument(single(document, 9)).blockers.join()).toContain("当前命座与本动作完整环数不符");
  });

  it("uses cast HP at the inclusive threshold, preserves independent reactions/final crit and restores all context via JSON", () => {
    let high = fixture("kuki-burst-high-hp-complete-cast"), low = fixture("kuki-burst-low-hp-complete-cast");
    expect(calculateDocument(high).status).toBe("blocked"); expect(calculateDocument(low).status).toBe("blocked");
    high.gameContext!.kukiDamage!.burstHpRatioAtCast = .50001; low.gameContext!.kukiDamage!.burstHpRatioAtCast = .5;
    high = apply(high); low = apply(low);
    const highResult = calculateDocument(high), lowResult = calculateDocument(low);
    expect(highResult.totals!.nonCritical).toBeCloseTo(20000 * .036048 * 7 * .5 * .9, 10);
    expect(lowResult.totals!.nonCritical).toBeCloseTo(20000 * .036048 * 12 * .5 * .9, 10);
    expect(lowResult.hits).toHaveLength(12); expect(evidence.scope.burstLowHpHitFrames.at(-1)).toBe(237);
    high.gameContext!.kukiDamage!.burstHpRatioAtCast = .5;
    expect(calculateDocument(apply(high)).blockers.join()).toContain("所选 Q 分支与施放时生命比例不符");
    hit(low, 0).effectiveCritRate = .1; hit(low, 0).additiveReaction = "aggravate"; low = apply(low);
    const reacted = calculateDocument(low);
    expect(reacted.hits[0]!.effectiveCritRate).toBe(.1);
    expect(reacted.hits[0]!.nonCritical).toBeGreaterThan(lowResult.hits[0]!.nonCritical!);
    expect(reacted.hits[1]!.nonCritical).toBe(lowResult.hits[1]!.nonCritical);
    const restored = parseCalculatorDocument(serializeCalculatorDocument(low));
    expect(restored.gameContext!.kukiDamage).toEqual(low.gameContext!.kukiDamage); expect(calculateDocument(restored).totals).toEqual(reacted.totals);
    delete low.gameContext!.kukiDamage!.burstHpRatioAtCast; delete low.gameContext!.kukiDamage!.statsStableAcrossHits; delete low.gameContext!.ascension;
    expect(calculateDocument(single(low, 6)).status).toBe("calculated");
    expect(calculateDocument(single(low, 7)).blockers.join()).toContain("施放 Q 时生命比例未知");
  });

  it("accounts C6 EM once in shared formulas, preserves equipment/final conversion, and allows actual final single hits without C6 history", () => {
    let document = fixture("kuki-skill-c2-complete-cast"); document.gameContext!.constellation = 6;
    document.build = {mode: "equipment-derived", characterBaseAtk: 300, weaponBaseAtk: 400, atkPercent: .5, flatAtk: 50, baseHp: 20000, hpPercent: 0, flatHp: 0, baseDef: 800, defPercent: 0, flatDef: 0, em: 200, critRate: .5, critDamage: 1};
    document.gameContext!.kukiDamage!.c6Active = true; resetKukiPanelAccounting(document, "fresh-equipment"); document = apply(document);
    const result = calculateDocument(document), expected = (1100 * (.75712 + 10 * .2524) + 11 * .25 * 350) * .5 * .9;
    expect(result.status).toBe("calculated"); expect(result.totals!.nonCritical).toBeCloseTo(expected, 10);
    expect(result.hits[0]!.trace.find((node) => node.id === "sourceElementalMasteryAdjustment")!.result!.value).toBe(150);
    const final = parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(document)));
    expect(calculateDocument(apply(final)).totals).toEqual(result.totals);
    resetKukiPanelAccounting(document, "fresh-equipment"); expect(calculateDocument(apply(document)).totals).toEqual(result.totals);
    if (final.build.mode === "equipment-derived") throw Error();
    final.build.stats.em = 350; resetKukiPanelAccounting(final, "imported-final");
    expect(calculateDocument(apply(final)).status).toBe("blocked");
    final.gameContext!.kukiDamage!.c6FinalEmRestored = true; delete final.gameContext!.kukiDamage!.c6Active;
    delete final.gameContext!.kukiDamage!.ringUninterrupted; delete final.gameContext!.kukiDamage!.statsStableAcrossHits;
    expect(calculateDocument(single(final, 0)).totals!.nonCritical).toBeCloseTo((1100 * .75712 + .25 * 350) * .5 * .9, 10);
    const q = fixture("kuki-burst-low-hp-complete-cast"); q.gameContext!.constellation = 6;
    expect(calculateDocument(single(q, 0)).status).toBe("calculated"); // No EM-dependent damage or reaction in this final-panel hit.
    hit(q, 0).additiveReaction = "aggravate";
    expect(calculateDocument(apply(q)).blockers.join()).toContain("C6 的150精通实际有效/面板已含状态未知");
    document = fixture("kuki-skill-c2-complete-cast"); document.gameContext!.constellation = 6;
    document.gameContext!.kukiDamage = {statsStableAcrossHits: true, ringUninterrupted: true, c6Active: false, c6IncludedInPanel: true};
    if (document.build.mode === "equipment-derived") throw Error();
    document.build.stats.em = 350;
    expect(calculateDocument(apply(document)).totals!.nonCritical).toBeCloseTo((1000 * (.75712 + 10 * .2524) + 11 * .25 * 200) * .5 * .9, 10);
  });
});
