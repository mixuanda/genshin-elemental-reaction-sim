import { describe, expect, it } from "vitest";
import { gameDataCatalog } from "../catalog";
import { releasedRuntimeWorkspace, type RuntimeWorkspace } from "../runtime-workspace";
import { getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { calculateDocument } from "../../../sim-core/src/calculator";
import { parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument } from "../../../sim-core/src/calculator-model";

function action(slug: string, skillId: string, workspace: RuntimeWorkspace = releasedRuntimeWorkspace) {
  return getCharacterDocuments(gameDataCatalog.characters.find((character) => character.slug === slug)!.id, 10, workspace)
    .find((doc) => doc.gameContext!.skillId === skillId)!;
}
function setVeils(doc: CalculatorDocument, count: number, moonsign = 2) {
  for (const hit of doc.hits) if (hit.kind === "ordinary") {
    for (const formula of [hit.additiveBaseFormula, hit.damageBonusFormula]) if (formula) {
      formula.inputs.find((input) => input.key === "neferVeilStacks")!.value = count;
      formula.inputs.find((input) => input.key === "moonsignCount")!.value = moonsign;
    }
  }
}

describe("source character formulas execute through the shared calculation core", () => {
  it("keeps Nefer initial E ATK+EM and external flat damage free of the Phantasm-only Veil multiplier", () => {
    const doc = action("nefer", "nefer-skill-rush");
    if (doc.build.mode !== "manual-final") throw new Error("Expected editable panel");
    doc.build.stats.em = 100;
    const hit = doc.hits[0]!;
    if (hit.kind !== "ordinary") throw new Error("Expected ordinary talent hit");
    hit.additiveBaseDamage = 500;
    expect(hit.additiveBaseFormula).toBeUndefined();
    expect(doc.assumptions.join("；")).toContain("来源内部冲突");
    const talentBase = 1.374912 * 2000 + 2.749824 * 100;
    expect(calculateDocument(doc).totals!.nonCritical).toBeCloseTo((talentBase + 500) * 0.5 * 0.9, 9);
    doc.gameContext!.ascension = 0;
    expect(calculateDocument(doc).totals!.nonCritical).toBeCloseTo((talentBase + 500) * 0.5 * 0.9, 9);
  });

  it("uses the Q's consumed veils in its damage-bonus bucket for both hits and bounds C0/C1 resources", () => {
    const doc = action("nefer", "nefer-burst");
    if (doc.build.mode !== "manual-final") throw new Error("Expected editable panel");
    doc.build.stats.em = 100;
    for (const hit of doc.hits) if (hit.kind === "ordinary") hit.damageBonus = 0.2;
    setVeils(doc, 3);
    const base = (4.04352 + 6.06528) * 2000 + (8.08704 + 12.13056) * 100;
    expect(calculateDocument(doc).totals!.nonCritical).toBeCloseTo(base * (1 + 0.2 + 0.4 * 3) * 0.5 * 0.9, 8);
    expect(parseCalculatorDocument(serializeCalculatorDocument(doc))).toEqual(doc);
    doc.gameContext!.constellation = 2;
    expect(calculateDocument(doc).status).toBe("blocked");
    setVeils(doc, 4);
    expect(() => parseCalculatorDocument(JSON.stringify(doc))).toThrow();
  });

  it("blocks only Nefer Q when its separately sourced per-veil coefficient drifts", () => {
    const workspace = structuredClone(releasedRuntimeWorkspace);
    const burst = workspace.catalog.talentSets.find((entry) => entry.id === "talent-set:nefer")!.abilities.find((ability) => ability.key === "combat3")!;
    const values = burst.parameters.param5!;
    values[0] = values[0]! + 0.001;
    expect(calculateDocument(action("nefer", "nefer-burst", workspace)).status).toBe("blocked");
    expect(calculateDocument(action("nefer", "nefer-skill-rush", workspace)).status).toBe("calculated");
  });

  it("reads Alyosha's actual ER, caps A4 at 70%, and requires ER only when that passive applies", () => {
    const doc = action("alyosha", "alyosha-skill-press");
    if (doc.build.mode !== "manual-final") throw new Error("Expected editable panel");
    const hit = doc.hits[0]!;
    if (hit.kind !== "ordinary") throw new Error("Expected ordinary skill");
    const base = 2000 * 5.16096 * 0.5 * 0.9;
    doc.build.stats.energyRecharge = 1;
    expect(calculateDocument(doc).totals!.nonCritical).toBeCloseTo(base * 1.35, 9);
    doc.build.stats.energyRecharge = 2.5;
    hit.damageBonus = 0.2;
    expect(calculateDocument(doc).totals!.nonCritical).toBeCloseTo(base * 1.9, 9);
    delete doc.build.stats.energyRecharge;
    expect(calculateDocument(doc).status).toBe("blocked");
    doc.gameContext!.ascension = 3;
    expect(calculateDocument(doc).totals!.nonCritical).toBeCloseTo(base * 1.2, 9);
  });
});
