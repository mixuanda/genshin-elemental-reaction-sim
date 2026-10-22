import { describe, expect, it } from "vitest";
import { applyCharacterConstellationScope, getCharacterDocuments } from "../../../apps/web/src/character-calculations";
import { calculateDocument, convertCalculatorToFinalPanel } from "./calculator";
import { parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument } from "./calculator-model";
import { prepareSourceCastDocument, resetSourceCastPanelAccounting } from "./source-cast-context";

function fixture(black = false, constellation = 2): CalculatorDocument {
  const document = getCharacterDocuments("character:10000123", 10)
    .find(row => row.gameContext?.skillId === (black ? "durin-denial-of-darkness" : "durin-confirmation-of-purity"))!;
  document.gameContext!.constellation = constellation;
  document.gameContext!.durinSkill = { statsStableAcrossHits: true, hitStates: Object.fromEntries(document.hits.map(hit => [hit.id, { c2PyroBonusActive: constellation === 2, c2PyroBonusIncluded: false }])) };
  document.characterLevel = 90;
  document.build = { mode: "imported-final", ascension: 6, source: "Synthetic source-permitted Durin E panel, not the player's build",
    stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 } };
  document.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  return document;
}

describe("Durin C0–C2 selected E branches", () => {
  it.each([0, 1, 2])("calculates white E at C%i with sourced C2 accounting", constellation => {
    const document = applyCharacterConstellationScope(fixture(false, constellation));
    const result = calculateDocument(document);
    // Source skillWhite[9]=1.9008; C1's extra base excludes Durin's own E.
    const nonCritical = 2000 * 1.9008 * (constellation === 2 ? 1.5 : 1) * .5 * .9;
    expect(result.blockers).toEqual([]);
    expect(result.hits).toHaveLength(1);
    expect(result.totals!.nonCritical).toBeCloseTo(nonCritical, 9);
    expect(result.totals!.expected).toBeCloseTo(nonCritical * 1.5, 9);
    expect(document.gameContext!.constellation).toBe(constellation);
  });

  it("calculates black E's three independent coefficients and per-hit C2 states", () => {
    const document = fixture(true), ids = document.hits.map(hit => hit.id);
    document.gameContext!.durinSkill!.hitStates![ids[0]!]!.c2PyroBonusActive = false;
    const result = calculateDocument(applyCharacterConstellationScope(document));
    const coefficients = [1.30032, .9576, 1.16352]; // Source skillBlack rows, effective E10.
    const expected = coefficients.map((coefficient, i) => 2000 * coefficient * (i === 0 ? 1 : 1.5) * .5 * .9 * 1.5);
    expect(result.blockers).toEqual([]);
    expect(result.hits.map(hit => hit.expected)).toEqual(expected.map(value => expect.closeTo(value, 9)));
    expect(result.totals!.expected).toBeCloseTo(expected.reduce((sum, value) => sum + value, 0), 9);
  });

  it("subtracts an already included share and can remove a stale C2 share", () => {
    const active = fixture(), hit = active.hits[0]!;
    if (hit.kind !== "ordinary") throw new Error("Expected the sourced E hit");
    hit.damageBonus = .5;
    const state = active.gameContext!.durinSkill!.hitStates![hit.id]!;
    state.c2PyroBonusIncluded = true;
    const activeResult = calculateDocument(applyCharacterConstellationScope(active));
    expect(activeResult.totals!.expected).toBeCloseTo(2000 * 1.9008 * 1.5 * .5 * .9 * 1.5, 9);
    state.c2PyroBonusActive = false;
    const expired = calculateDocument(applyCharacterConstellationScope(active));
    expect(expired.totals!.expected).toBeCloseTo(2000 * 1.9008 * .5 * .9 * 1.5, 9);
  });

  it("blocks unknown C2 state instead of assuming the reaction menu triggers it", () => {
    const document = fixture();
    document.gameContext!.durinSkill!.hitStates = {};
    const result = calculateDocument(applyCharacterConstellationScope(document));
    expect(result.status).toBe("blocked");
    expect(result.blockers.some(reason => reason.includes("是否实际有效"))).toBe(true);
    expect(result.blockers.some(reason => reason.includes("是否已包含"))).toBe(true);
    expect(result.totals).toBeUndefined();
  });

  it("keeps unselected C2 omissions independent and requires stability only for multi-hit totals", () => {
    const document = fixture(true), id = document.hits[1]!.id;
    document.scope = "single-hit";
    document.selectedHitIds = [id];
    document.gameContext!.durinSkill = { hitStates: { [id]: { c2PyroBonusActive: true, c2PyroBonusIncluded: false } } };
    expect(calculateDocument(applyCharacterConstellationScope(document)).blockers).toEqual([]);
    document.scope = "one-cast";
    document.selectedHitIds = document.hits.map(hit => hit.id);
    const multi = calculateDocument(applyCharacterConstellationScope(document));
    expect(multi.blockers.some(reason => reason.includes("其他面板"))).toBe(true);
    expect(multi.totals).toBeUndefined();
  });

  it.each([3, 6])("does not widen E support to unreviewed C%i", constellation => {
    const result = calculateDocument(applyCharacterConstellationScope(fixture(false, constellation)));
    expect(result.status).toBe("blocked");
    expect(result.blockers.some(reason => reason.includes("C0–C2"))).toBe(true);
  });

  it("keeps the unimplemented amplified A1 branch and an invalid selected hit blocked", () => {
    const amplified = fixture();
    if (amplified.hits[0]!.kind === "ordinary") amplified.hits[0]!.reaction = "reverseVaporize";
    expect(calculateDocument(applyCharacterConstellationScope(amplified)).blockers.some(reason => reason.includes("A1反应增益"))).toBe(true);
    const unknown = fixture();
    unknown.hits[0]!.id = "unknown-durin-hit"; unknown.selectedHitIds = [unknown.hits[0]!.id];
    expect(calculateDocument(applyCharacterConstellationScope(unknown)).blockers.some(reason => reason.includes("不属于此杜林E"))).toBe(true);
  });

  it("restores coefficients, retains effective levels, and round-trips accounting through JSON and conversion", () => {
    let document = fixture(true);
    if (document.hits[0]!.kind === "ordinary") document.hits[0]!.terms[0]!.coefficient = 999;
    document = applyCharacterConstellationScope(document);
    expect(document.hits[0]).toMatchObject({ terms: [{ stat: "atk", coefficient: 1.30032 }] });
    expect(document.gameContext!.effectiveTalentLevel).toBe(10);
    const totals = calculateDocument(document).totals;
    expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(document))).totals).toEqual(totals);
    expect(calculateDocument(convertCalculatorToFinalPanel(document, "imported-final")).totals).toEqual(totals);
    expect(calculateDocument(prepareSourceCastDocument(document)).totals).toEqual(totals);
  });

  it("clears only panel accounting on import and never invents the actual C2 trigger", () => {
    const document = fixture();
    resetSourceCastPanelAccounting(document, "imported-final");
    expect(document.gameContext!.durinSkill!.hitStates![document.hits[0]!.id]).toEqual({ c2PyroBonusActive: true });
    expect(calculateDocument(document).status).toBe("blocked");
    resetSourceCastPanelAccounting(document, "fresh-equipment");
    expect(document.gameContext!.durinSkill!.hitStates![document.hits[0]!.id]).toEqual({ c2PyroBonusActive: true, c2PyroBonusIncluded: false });
  });
});
