import { describe, expect, it } from "vitest";
import { gameDataCatalog } from "../../../packages/game-data/src/catalog";
import { calculateDocument, type CalculatorDocument } from "@genshin-dps-lab/sim-core";
import { getCharacterDocuments, applyKukiDamageContext, applyCharlotteSkillContext } from "./character-calculations";
import { collectCalculatorRequirements } from "./calculator-requirements";
import { renderKukiDamageControls } from "./calculator-kuki-controls";
import { renderColleiCharlotteControls } from "./calculator-collei-charlotte-controls";

function fixture(slug: "kukishinobu" | "charlotte", skill: string): CalculatorDocument {
  const character = gameDataCatalog.characters.find(row => row.slug === slug)!;
  const document = getCharacterDocuments(character.id, 1).find(row => row.gameContext?.skillId === skill)!;
  document.build = { mode: "manual-final", ascension: 6, source: "Explicit conditional-cast test panel, not a player import",
    stats: { atk: 1000, hp: 10000, def: 800, em: 0, critRate: .5, critDamage: 1 } };
  document.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  return document;
}
const paths = (document: CalculatorDocument) => collectCalculatorRequirements(document).fields.map(field => field.fieldPath);

describe("conditional character casts expose the model's actual missing inputs", () => {
  it("links Kuki's Q cast HP, keeps the 50% boundary exact, and never guesses a duration", () => {
    let document = fixture("kukishinobu", "kuki-burst-low-hp-complete-cast");
    expect(calculateDocument(document).status).toBe("blocked");
    expect(paths(document)).toContain("gameContext.kukiDamage.burstHpRatioAtCast");
    const field = collectCalculatorRequirements(document).fields.find(row => row.fieldPath.endsWith("burstHpRatioAtCast"))!;
    expect(renderKukiDamageControls(document)).toContain(`data-field="${field.fieldPath}"`);
    expect(collectCalculatorRequirements(document).blockers.every(row => row.status === "linked-controls")).toBe(true);
    document = applyKukiDamageContext(document, { ...document.gameContext!.kukiDamage!, burstHpRatioAtCast: .5 });
    const result = calculateDocument(document);
    expect(result.status).toBe("calculated");
    expect(result.totals!.nonCritical).toBeCloseTo(12 * .036048 * 10000 * .5 * .9, 9);
    document = applyKukiDamageContext(document, { ...document.gameContext!.kukiDamage!, burstHpRatioAtCast: .500001 });
    expect(calculateDocument(document).status).toBe("blocked");
    expect(paths(document)).toContain("gameContext.kukiDamage.burstHpRatioAtCast");
  });

  it("does not ask an independent early Q hit for later duration or stable multi-hit conditions", () => {
    let document = fixture("kukishinobu", "kuki-burst-low-hp-complete-cast");
    document.scope = "single-hit"; document.selectedHitIds = [document.hits[0]!.id];
    document = applyKukiDamageContext(document, {});
    expect(paths(document)).toEqual([]);
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(.036048 * 10000 * .5 * .9, 9);
    document.selectedHitIds = [document.hits[7]!.id]; document = applyKukiDamageContext(document, {});
    expect(paths(document)).toContain("gameContext.kukiDamage.burstHpRatioAtCast");
    expect(calculateDocument(document).status).toBe("blocked");
  });

  it("links Kuki's complete ring and C6 EM accounting without inventing HP-triggered history", () => {
    let document = fixture("kukishinobu", "kuki-skill-c2-complete-cast");
    document.gameContext!.constellation = 6; document = applyKukiDamageContext(document, {});
    expect(paths(document)).toEqual(expect.arrayContaining([
      "gameContext.kukiDamage.statsStableAcrossHits", "gameContext.kukiDamage.ringUninterrupted",
      "gameContext.kukiDamage.c6FinalEmRestored", "gameContext.kukiDamage.c6Active", "gameContext.kukiDamage.c6IncludedInPanel",
    ]));
    document = applyKukiDamageContext(document, { ringUninterrupted: true, statsStableAcrossHits: true, c6Active: false, c6IncludedInPanel: false });
    expect(paths(document)).toEqual([]);
    expect(calculateDocument(document).status).toBe("calculated");
    document.scope = "single-hit"; document.selectedHitIds = [document.hits[1]!.id];
    document = applyKukiDamageContext(document, { c6FinalEmRestored: true });
    expect(paths(document)).toEqual([]);
    expect(calculateDocument(document).status).toBe("calculated");
  });

  it("links Charlotte's actual team count, accepts a real zero and keeps mark conditions scoped to a full cast", () => {
    let document = fixture("charlotte", "charlotte-skill-press-complete");
    const before = JSON.stringify(document);
    expect(paths(document)).toEqual(expect.arrayContaining([
      "gameContext.charlotteSkill.nonFontaineTeammates", "gameContext.charlotteSkill.markUninterrupted",
      "gameContext.charlotteSkill.statsStableAcrossHits",
    ]));
    expect(JSON.stringify(document)).toBe(before);
    expect(renderColleiCharlotteControls(document)).toContain('id="calc-charlotte-non-fontaine"');
    document = applyCharlotteSkillContext(document, { a4IncludedInPanel: false, nonFontaineTeammates: 0, markUninterrupted: true, statsStableAcrossHits: true });
    expect(paths(document)).toEqual([]);
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo((.672 + 4 * .392) * 1000 * .5 * .9, 9);
    document.scope = "single-hit"; document.selectedHitIds = [document.hits[0]!.id];
    document = applyCharlotteSkillContext(document, { a4IncludedInPanel: false, nonFontaineTeammates: 2 });
    expect(paths(document)).toEqual([]);
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(.672 * 1000 * 1.1 * .5 * .9, 9);
  });

  it("links only the selected Charlotte C2 snapshot and requires white ATK only for an actual difference", () => {
    let document = fixture("charlotte", "charlotte-skill-hold-complete");
    document.gameContext!.constellation = 2; document.scope = "single-hit"; document.selectedHitIds = [document.hits[0]!.id];
    document = applyCharlotteSkillContext(document, { a4IncludedInPanel: false, nonFontaineTeammates: 2 });
    const hitId = document.selectedHitIds[0]!;
    expect(paths(document)).toEqual(expect.arrayContaining(["gameContext.charlotteSkill.c2IncludedStacks", `gameContext.charlotteSkill.c2HitStacks.${hitId}`]));
    expect(paths(document)).not.toContain("gameContext.charlotteSkill.c2BaseAttack");
    document = applyCharlotteSkillContext(document, { ...document.gameContext!.charlotteSkill!, c2IncludedStacks: 0, c2HitStacks: { [hitId]: 1 } });
    expect(paths(document)).toEqual(["gameContext.charlotteSkill.c2BaseAttack"]);
    document = applyCharlotteSkillContext(document, { ...document.gameContext!.charlotteSkill!, c2BaseAttack: 500 });
    expect(paths(document)).toEqual([]);
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(1.392 * 1050 * 1.1 * .5 * .9, 9);
    document = applyCharlotteSkillContext(document, { a4IncludedInPanel: false, nonFontaineTeammates: 0, c2IncludedStacks: 0, c2HitStacks: { [hitId]: 0 } });
    expect(paths(document)).toEqual([]);
    expect(calculateDocument(document).status).toBe("calculated");
  });

  it("uses the existing ascension control for missing evidence and does not ask for an A4 team condition before unlock", () => {
    let document = fixture("charlotte", "charlotte-skill-press-complete");
    document.scope = "single-hit"; document.selectedHitIds = [document.hits[0]!.id];
    if (document.build.mode !== "manual-final") throw new Error("Expected final panel");
    delete document.build.ascension; delete document.gameContext!.ascension;
    document = applyCharlotteSkillContext(document, { a4IncludedInPanel: false });
    expect(collectCalculatorRequirements(document).fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldPath: "build.ascension", controlSelector: "#calc-ascension" }),
    ]));
    expect(calculateDocument(document).status).toBe("blocked");
    if (document.build.mode !== "manual-final") throw new Error("Expected final panel");
    document.build.ascension = 3;
    document = applyCharlotteSkillContext(document, { a4IncludedInPanel: false });
    expect(paths(document)).toEqual([]);
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(.672 * 1000 * .5 * .9, 9);
  });
});
