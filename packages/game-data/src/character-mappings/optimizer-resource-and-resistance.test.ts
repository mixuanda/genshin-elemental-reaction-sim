import { describe, expect, it } from "vitest";
import { gameDataCatalog } from "../catalog";
import { getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { calculateDocument, convertCalculatorToFinalPanel } from "../../../sim-core/src/calculator";
import { parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument } from "../../../sim-core/src/calculator-model";

function action(slug: string, skillId: string): CalculatorDocument {
  const character = gameDataCatalog.characters.find((entry) => entry.slug === slug);
  if (!character) throw new Error(`Missing source character ${slug}`);
  const doc = getCharacterDocuments(character.id, 10).find((entry) => entry.gameContext?.skillId === skillId);
  if (!doc) throw new Error(`Missing source action ${skillId}`);
  return doc;
}

function setContext(doc: CalculatorDocument, key: string, value: number): void {
  let updated = 0;
  for (const hit of doc.hits) if (hit.kind === "ordinary") {
    for (const formula of [hit.additiveBaseFormula, hit.resistanceReductionFormula]) {
      const input = formula?.inputs.find((entry) => entry.key === key);
      if (input) { input.value = value; updated++; }
    }
  }
  if (!updated) throw new Error(`Missing source context ${key}`);
}

describe("source resource and resistance contexts use the shared core", () => {
  it("applies Lohen's consumed Will to talent base, preserves six Q cuts, and accepts only reviewed resource states", () => {
    const skill = action("lohen", "lohen-skill-etch-resource");
    const hit = skill.hits[0]!;
    if (hit.kind !== "ordinary") throw new Error("Expected ordinary source skill");
    hit.additiveBaseDamage = 500;
    expect(skill.gameContext?.scopeCoverage).toBe("selected-components");
    expect(calculateDocument(skill).totals?.nonCritical).toBeCloseTo((2000 * 1.08 * (1 + 0.004 * 20) + 500) * 0.5 * 0.9, 9);
    setContext(skill, "lohenWillConsumed", 100);
    expect(calculateDocument(skill).totals?.nonCritical).toBeCloseTo(1585.8, 9);

    const burst = action("lohen", "lohen-burst-six-cuts-resource");
    setContext(burst, "lohenWillConsumed", 100);
    expect(burst.hits).toHaveLength(6);
    expect(burst.gameContext?.scopeCoverage).toBe("complete-cast");
    expect(calculateDocument(burst).totals?.nonCritical).toBeCloseTo(16166.304, 8);
    expect(parseCalculatorDocument(serializeCalculatorDocument(burst))).toEqual(burst);
    for (const unsupported of [0, 21]) {
      setContext(skill, "lohenWillConsumed", unsupported);
      expect(() => parseCalculatorDocument(JSON.stringify(skill))).toThrow();
    }
    setContext(skill, "lohenWillConsumed", 20);
    skill.gameContext!.constellation = 1;
    expect(calculateDocument(skill).status).toBe("blocked");
  });

  it("uses Linnea's conditional total 15/30% Geo reduction and preserves its source audit through final-panel replay", () => {
    const doc = action("linnea", "linnea-lumi-pummeler-pair");
    expect(doc.gameContext?.scopeCoverage).toBe("selected-components");
    expect(doc.hits).toHaveLength(2);
    expect(calculateDocument(doc).totals?.nonCritical).toBeCloseTo(1416.96, 9);
    setContext(doc, "moonsignCount", 2);
    expect(calculateDocument(doc).totals?.nonCritical).toBeCloseTo(1520.64, 9);
    setContext(doc, "linneaTargetNearby", 0);
    expect(calculateDocument(doc).totals?.nonCritical).toBeCloseTo(1244.16, 9);
    setContext(doc, "linneaTargetNearby", 1);
    doc.gameContext!.ascension = 0;
    expect(calculateDocument(doc).totals?.nonCritical).toBeCloseTo(1244.16, 9);
    delete doc.gameContext!.ascension;
    expect(calculateDocument(doc).status).toBe("blocked");
    doc.gameContext!.ascension = 6;

    const restored = parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(doc, "imported-final")));
    expect(calculateDocument(restored).totals).toEqual(calculateDocument(doc).totals);
    const restoredHit = restored.hits[0]!;
    if (restoredHit.kind !== "ordinary") throw new Error("Expected ordinary source pair");
    expect(restoredHit.effectiveResistance).toBeCloseTo(-0.2, 12);
    expect(restoredHit.resistanceReductionFormula?.ruleId).toBe("linnea-a1-lumi-c0-optimizer-180a0a1");
    const audit = calculateDocument(restored).hits[0]!.trace.find((entry) => entry.id === "characterResistanceReduction");
    expect(audit?.status).toBe("not-applicable");
    expect(audit?.sourceRefs[0]).toContain("/180a0a1015cb725c7570cd828eb086749960df98/");
  });
});
