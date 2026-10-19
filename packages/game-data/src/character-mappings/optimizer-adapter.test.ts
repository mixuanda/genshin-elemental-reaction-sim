import { describe, expect, it } from "vitest";
import { gameDataCatalog } from "../catalog";
import { getClassifiedHitCoverage } from "../classified-hits";
import { getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { calculateDocument } from "../../../sim-core/src/calculator";
import { parseCalculatorDocument, serializeCalculatorDocument } from "../../../sim-core/src/calculator-model";

const newIdentities = ["kachina", "nefer", "zibai", "illuga", "lohen", "linnea", "sandrone", "alyosha"];

describe("Optimizer source additions through the shared calculator adapter", () => {
  it("executes and roundtrips every new action at levels 1 and 10 with fixed repository references", () => {
    let documents = 0;
    for (const slug of newIdentities) {
      const character = gameDataCatalog.characters.find((entry) => entry.slug === slug)!;
      for (const level of [1, 10]) {
        const actions = getCharacterDocuments(character.id, level);
        expect(actions.length, slug).toBeGreaterThan(0);
        for (const doc of actions) {
          documents++;
          expect(doc.gameContext!.effectiveTalentLevel).toBe(level);
          expect(parseCalculatorDocument(serializeCalculatorDocument(doc)), doc.id).toEqual(doc);
          const result = calculateDocument(doc);
          expect(result.status, doc.id).toBe("calculated");
          expect(result.verification, doc.id).toBe("provisional");
          expect(result.totals!.nonCritical, doc.id).toBeGreaterThan(0);
          for (const hit of doc.hits) {
            expect(hit.sourceRefs.some((ref) => ref.includes("frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/")), hit.id).toBe(true);
            expect(hit.dependencies).not.toContain("unrelated-team-rotation");
          }
        }
      }
    }
    expect(documents).toBe(162);
    const coverage = getClassifiedHitCoverage();
    expect(coverage.charactersWithHits).toBeGreaterThanOrEqual(120);
    expect(coverage.classifiedHits).toBeGreaterThanOrEqual(676);
    expect(coverage.teamSimulationReadyFromTheseMappings).toBe(0);
    expect(coverage.uncoveredCharacterIdentities.map((entry) => entry.slug).sort()).toEqual(["manekin", "manekina", "vesna", "vodyanitsa"]);
  });
});
