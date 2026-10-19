import { describe, expect, it } from "vitest";
import { applyCharacterConstellationScope, applyIttoChargedContext, getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument, type CalculatorHit } from "../calculator";

const get = (kind: "combo" | "finisher", level = 1): CalculatorDocument => {
  const document = getCharacterDocuments("character:10000057", level).find(doc => doc.gameContext?.skillId === `aratakiitto-kesagiri-${kind}`);
  if (!document) throw Error("Registered source Kesagiri action required");
  return document;
};
const hit = (document: CalculatorDocument): Extract<CalculatorHit, { kind: "ordinary" }> => {
  const selected = document.hits[0];
  if (selected?.kind !== "ordinary") throw Error();
  return selected;
};
const value = (document: CalculatorDocument, id: string) => calculateDocument(document).hits[0]!.trace.find(node => node.id === id)?.result?.value;

describe("source-conditioned single Itto Kesagiri action", () => {
  it("separates A4 full-DEF action snapshot from Q non-Extra history and keeps the two talents independent", () => {
    const base = get("combo");
    expect(base.hits).toHaveLength(1);
    expect(base.gameContext!.scopeCoverage).toBe("complete-cast");
    expect(hit(base).terms).toEqual([{ stat: "atk", coefficient: 0.9116 }]);
    expect(value(base, "customAdditiveBase")).toBe(280);
    let document = applyIttoChargedContext(base, {
      ...base.gameContext!.ittoCharged!, actionDefenseStable: false, actionDefenseSnapshotTotal: 1500,
      burst: { active: true, effectiveTalentLevel: 1, defenseSnapshotNonExtra: 1000, accounting: "add-to-panel" },
    });
    expect(hit(document).element).toBe("geo");
    expect(value(document, "sourceAttackAdjustment")).toBe(576);
    expect(value(document, "hitAttack")).toBe(2576);
    expect(value(document, "customAdditiveBase")).toBe(525);
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo((2576 * 0.9116 + 525) * 0.5 * 0.9, 10);
    const before = calculateDocument(document).totals;
    if (document.build.mode === "equipment-derived") throw Error();
    document.build.stats.def = 9000;
    expect(calculateDocument(document).totals).toEqual(before);
    document = applyIttoChargedContext(document, { ...document.gameContext!.ittoCharged!, burst: { ...document.gameContext!.ittoCharged!.burst, effectiveTalentLevel: 10 } });
    expect(value(document, "sourceAttackAdjustment")).toBe(1036.8);
    expect(hit(document).terms[0]!.coefficient).toBe(0.9116);
    expect(document.gameContext!.effectiveTalentLevel).toBe(1);
  });

  it("validates the selected stack branch and applies C6 only as tagged critical damage with exact final JSON replay", () => {
    const combo = get("combo");
    expect(calculateDocument(applyIttoChargedContext(combo, { ...combo.gameContext!.ittoCharged!, superstrengthStacks: 1 })).status).toBe("blocked");
    combo.gameContext!.constellation = 6;
    const c6 = applyCharacterConstellationScope(applyIttoChargedContext(combo, { ...combo.gameContext!.ittoCharged!, superstrengthStacks: 1, c6PreserveStack: true }));
    const calculated = calculateDocument(c6);
    expect(calculated.status).toBe("calculated");
    expect(value(c6, "characterCritDamage")).toBe(0.7);
    expect(value(c6, "applicableCritDamage")).toBe(1.9);
    expect(calculated.hits[0]!.nonCritical).toBe(calculateDocument(get("combo")).hits[0]!.nonCritical);
    expect(calculated.hits[0]!.critical).toBeCloseTo(calculated.hits[0]!.nonCritical! * 2.9, 10);
    const final = parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(c6)));
    expect(calculateDocument(final).totals).toEqual(calculated.totals);
    expect(hit(final).effectiveCritDamage).toBe(1.9);
    expect(calculateDocument(final).hits[0]!.trace.find(node => node.id === "characterCritDamage")?.status).toBe("not-applicable");
    const finisher = get("finisher"); finisher.gameContext!.constellation = 6;
    expect(hit(finisher).terms[0]!.coefficient).toBe(1.9092);
    expect(calculateDocument(applyCharacterConstellationScope(finisher)).status).toBe("calculated");
    expect(calculateDocument(applyIttoChargedContext(finisher, { ...finisher.gameContext!.ittoCharged!, c6PreserveStack: true })).status).toBe("blocked");
  });

  it("requires only applicable snapshots, blocks unresolved live C4 gear, and preserves Q accounting across final conversion", () => {
    const base = get("combo");
    const unstable = applyIttoChargedContext(base, { ...base.gameContext!.ittoCharged!, actionDefenseStable: false });
    expect(calculateDocument(unstable).blockers.join()).toContain("重击动作起手完整 DEF");
    unstable.gameContext!.ascension = 3;
    expect(calculateDocument(applyIttoChargedContext(unstable, unstable.gameContext!.ittoCharged!)).status).toBe("calculated");
    delete unstable.gameContext!.ascension;
    expect(calculateDocument(applyIttoChargedContext(unstable, unstable.gameContext!.ittoCharged!)).blockers.join()).toContain("突破阶段");
    const included = applyIttoChargedContext(base, { ...base.gameContext!.ittoCharged!, burst: { active: true, effectiveTalentLevel: 1, accounting: "already-in-final-panel" } });
    expect(calculateDocument(included).status).toBe("calculated");
    expect(calculateDocument(included).hits[0]!.trace.find(node => node.id === "sourceAttackAdjustment")?.status).toBe("not-applicable");

    base.gameContext!.constellation = 4;
    base.build = { mode: "equipment-derived", characterBaseAtk: 500, weaponBaseAtk: 500, atkPercent: 1, flatAtk: 100, baseHp: 10000, hpPercent: 0, flatHp: 0, baseDef: 2000, defPercent: 0, flatDef: 0, em: 0, critRate: 0.7, critDamage: 1.2 };
    const c4 = applyCharacterConstellationScope(applyIttoChargedContext(base, { ...base.gameContext!.ittoCharged!, c4BuffActive: true }));
    expect(calculateDocument(c4).blockers.join()).toContain("C4 当前有效");
    expect(() => convertCalculatorToFinalPanel(c4)).toThrow("C4 当前有效");
    const active = applyCharacterConstellationScope(applyIttoChargedContext(base, { ...base.gameContext!.ittoCharged!, c4BuffActive: false, burst: { active: true, effectiveTalentLevel: 1, defenseSnapshotNonExtra: 1000, accounting: "add-to-panel" } }));
    expect(value(active, "hitAttack")).toBe(2676); // Q flat ATK is not multiplied by 100% ATK.
    const final = parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(active)));
    expect(final.gameContext!.ittoCharged!.burst.accounting).toBe("add-to-panel");
    expect(calculateDocument(final).totals).toEqual(calculateDocument(active).totals);
    expect(final.build.mode !== "equipment-derived" && final.build.stats.atk).toBe(2100);
  });
});
