import { expect, it } from "vitest";
import { gameDataCatalog } from "../catalog";
import { applyCharacterConstellationScope, getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { calculateDocument } from "../../../sim-core/src/calculator";

it("permits only reviewed Nefer C1 ordinary E/Q with unchanged damage and no additional lunar component", () => {
  const character = gameDataCatalog.characters.find((entry) => entry.slug === "nefer");
  if (!character) throw new Error("Missing Nefer source identity");
  const actions = getCharacterDocuments(character.id, 10);
  for (const [skillId, hitCount] of [["nefer-skill-rush", 1], ["nefer-burst", 2]] as const) {
    const doc = actions.find((entry) => entry.gameContext?.skillId === skillId);
    if (!doc?.gameContext || doc.build.mode !== "manual-final") throw new Error(`Missing source action ${skillId}`);
    doc.build.stats.em = 100;
    for (const hit of doc.hits) if (hit.kind === "ordinary") {
      const formula = hit.damageBonusFormula ?? hit.elementalMasteryAdjustment?.formula;
      if (!formula) throw new Error("Missing Nefer resource expression");
      const veils = formula.inputs.find((input) => input.key === "neferVeilStacks");
      if (veils) veils.value = 3;
      formula.inputs.find((input) => input.key === "moonsignCount")!.value = 2;
    }
    const c0 = calculateDocument(applyCharacterConstellationScope(doc));
    expect(c0.status).toBe("calculated");
    doc.gameContext.constellation = 1;
    const scoped = applyCharacterConstellationScope(doc);
    const c1 = calculateDocument(scoped);
    expect(c1.status).toBe("calculated");
    expect(c1.totals).toEqual(c0.totals);
    expect(scoped.hits).toHaveLength(hitCount);
    expect(scoped.selectedHitIds).toEqual(doc.selectedHitIds);
    expect(scoped.hits.every((hit) => hit.kind === "ordinary")).toBe(true);
    expect(scoped.dependencies.filter((dependency) => dependency.id.startsWith("constellation-scope:")))
      .toHaveLength(hitCount);
    expect(scoped.dependencies.filter((dependency) => dependency.id.startsWith("constellation-scope:"))
      .every((dependency) => dependency.status === "provisional" && dependency.sourceRefs.some((ref) => ref.endsWith("#L195-L199")))).toBe(true);
  }
});
