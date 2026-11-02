import { describe, expect, it } from "vitest";
import { applyCharacterConstellationScope, getCharacterDocuments } from "../../../apps/web/src/character-calculations";
import { calculateDocument, convertCalculatorToFinalPanel } from "./calculator";
import { parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument } from "./calculator-model";
import { prepareSourceCastDocument } from "./source-cast-context";

function initialHit(constellation = 6): CalculatorDocument {
  const document = getCharacterDocuments("character:10000075", 13)
    .find(candidate => candidate.gameContext?.skillId === "idle-wanderer-skill-c0")!;
  document.scope = "single-hit";
  document.characterLevel = 100;
  document.gameContext!.constellation = constellation;
  document.gameContext!.ascension = 6;
  document.gameContext!.idleStanceCast = { wanderer: { noAbsorption: true, panelExcludesAbsorptionBonuses: true } };
  document.build = { mode: "imported-final", ascension: 6, source: "Synthetic Lv100/E13 panel; not a user's UID data",
    stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 } };
  document.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  return document;
}

describe("Wanderer already-occurred initial E hit", () => {
  it.each([0, 1, 2, 3, 4, 5, 6])("calculates C%i with effective E13 and no future stance record", constellation => {
    const document = applyCharacterConstellationScope(initialHit(constellation));
    const result = calculateDocument(document);
    // Pinned skill[12] = 2.023; Lv100 vs Lv90 DEF = 200 / 390.
    // No absorption, damage bonus or reaction; resistance = 0.9, expected crit = 1.5.
    const nonCritical = 2000 * 2.023 * (200 / 390) * .9;
    expect(result.blockers).toEqual([]);
    expect(result.hits).toHaveLength(1);
    expect(result.totals!.nonCritical).toBeCloseTo(nonCritical, 10);
    expect(result.totals!.critical).toBeCloseTo(nonCritical * 2, 10);
    expect(result.totals!.expected).toBeCloseTo(nonCritical * 1.5, 10);
    expect(document.gameContext!.effectiveTalentLevel).toBe(13);
    expect(document.gameContext!.skillName).toBe("羽画·E初击C0–C6／完整空居C0");
    expect(document.gameContext!.constellation).toBe(constellation);
    expect(document.gameContext!.scopeCoverage).toBe("single-hit");
    expect(document.gameContext!.idleStanceCast!.followupActions).toBeUndefined();
    expect(document.hits[0]!).toMatchObject({ kind: "ordinary", attackTag: "skill", terms: [{ stat: "atk", coefficient: 2.023 }] });
  });

  it("preserves the exact single-hit result through JSON and final-panel conversion", () => {
    const document = applyCharacterConstellationScope(initialHit());
    const totals = calculateDocument(document).totals;
    expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(document))).totals).toEqual(totals);
    expect(calculateDocument(convertCalculatorToFinalPanel(document, "imported-final")).totals).toEqual(totals);
  });

  it.each([
    {}, { noAbsorption: true }, { panelExcludesAbsorptionBonuses: true },
    { noAbsorption: false, panelExcludesAbsorptionBonuses: true },
    { noAbsorption: true, panelExcludesAbsorptionBonuses: false },
  ])("keeps unknown or actually absorbed C4/C6 snapshot conditions blocked: %j", state => {
    const document = initialHit();
    document.gameContext!.idleStanceCast = { wanderer: state };
    const result = calculateDocument(applyCharacterConstellationScope(document));
    expect(result.status).toBe("blocked");
    expect(result.totals).toBeUndefined();
    expect(result.blockers.some(reason => reason.includes("没有元素吸收"))).toBe(true);
  });

  it.each([0, 1, 6])("keeps the complete stance restricted to C0, actual C%i", constellation => {
    const document = initialHit(constellation);
    document.scope = "one-cast";
    Object.assign(document.gameContext!.idleStanceCast!, {
      casterId: "caster", targetId: "enemy", freshCastConfirmed: true, noHitlag: true,
      noInterruption: true, noReplacement: true, fullObservedLifetime: true, observedThroughFrame: 100,
      statsStableAcrossHits: true, targetContacts: { initial: true },
      followupActions: [{ id: "end", frame: 60, actorId: "caster", kind: "terminate-skill" }],
    });
    const result = calculateDocument(prepareSourceCastDocument(document));
    if (constellation === 0) expect(result.blockers).toEqual([]);
    else {
      expect(result.totals).toBeUndefined();
      expect(result.blockers.some(reason => reason.includes("仅支持明确C0"))).toBe(true);
    }
  });

  it("does not grant other idle skills or an unidentified hit high-constellation support", () => {
    const other = getCharacterDocuments("character:10000048", 9)
      .find(candidate => candidate.gameContext?.skillId === "idle-yanfei-burst-c0")!;
    other.gameContext!.constellation = 6;
    expect(calculateDocument(applyCharacterConstellationScope(other)).blockers.some(reason => reason.includes("仅支持明确C0"))).toBe(true);
    const unknown = initialHit();
    unknown.hits[0]!.id = "unreviewed-wanderer-normal";
    unknown.selectedHitIds = [unknown.hits[0]!.id];
    expect(calculateDocument(applyCharacterConstellationScope(unknown)).blockers.some(reason => reason.includes("仅支持明确C0"))).toBe(true);
  });
});
