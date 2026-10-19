import { describe, expect, it } from "vitest";
import { gameDataCatalog } from "../../../game-data/src/catalog";
import { artifactSetCatalog } from "../../../game-data/src/supplemental";
import { resolveEquipmentBuild, type EquipmentBuildInput } from "../../../game-data/src/equipment-build";
import { type ArtifactPieceInput } from "../../../game-data/src/artifact-build";
import { calculateDocument, convertCalculatorToFinalPanel, parseCalculatorDocument, serializeCalculatorDocument } from "../calculator";
import { loadWorkedExample } from "../worked-examples";

function build(character: string, weapon: string, extra: Partial<EquipmentBuildInput> = {}) {
  return resolveEquipmentBuild({ characterId: gameDataCatalog.characters.find(entry => entry.slug === character)!.id,
    weaponId: gameDataCatalog.weapons.find(entry => entry.slug === weapon)!.id,
    level: 90, ascension: 6, weaponLevel: 90, weaponAscension: 6, refinement: 1, effectsDisabled: true, ...extra }).build;
}
function fourPieces(slug: string): ArtifactPieceInput[] {
  const setId = artifactSetCatalog.find(entry => entry.slug === slug)!.id;
  return (["flower", "plume", "sands", "goblet"] as const).map(slot => ({ slot, setId, rarity: 5, level: 0,
    mainStat: slot === "flower" ? "hp" : slot === "plume" ? "atk" : slot === "sands" ? "hp_" : "cryo_dmg_",
    initialSubstats: 3, substats: [{ stat: "critRate_", rolls: [3] }, { stat: "critDMG_", rolls: [3] }, { stat: "atk_", rolls: [3] }] }));
}

describe("pure equipment DMG Bonus dependencies", () => {
  it("keeps unrelated attacks usable while retaining unknown tag and element clauses through final JSON", () => {
    const cases = [
      { slug: "goldentroupe", safeTag: "normal", blockedTag: "skill", safeElement: "cryo", blockedElement: "cryo", context: {} },
      { slug: "finaleofthedeepgalleries", safeTag: "normal", blockedTag: "burst", safeElement: "cryo", blockedElement: "cryo", context: { setNormalEffectActive: false } },
      { slug: "nighttimewhispersintheechoingwoods", safeTag: "skill", blockedTag: "skill", safeElement: "physical", blockedElement: "geo", context: {} }
    ] as const;
    for (const row of cases) {
      const doc = loadWorkedExample("fixture-a"), safe = doc.hits[0]!;
      if (safe.kind !== "ordinary") throw Error("ordinary fixture required");
      doc.build = build("kaeya", "coolsteel", { setEffectsEnabled: true, artifacts: fourPieces(row.slug), effectContext: row.context });
      safe.attackTag = row.safeTag; safe.element = row.safeElement;
      const blocked = { ...structuredClone(safe), id: "pending", attackTag: row.blockedTag, element: row.blockedElement };
      doc.hits.push(blocked);
      const result = calculateDocument(doc);
      expect(result.status, row.slug).toBe("calculated");
      const final = parseCalculatorDocument(serializeCalculatorDocument(convertCalculatorToFinalPanel(doc)));
      expect(calculateDocument(final).totals).toEqual(result.totals);
      const retained = final.hits[1]!;
      expect(retained.kind === "ordinary" && retained.pendingEquipmentEffects?.some(effect => effect.kind === "damageBonus")).toBe(true);
      final.selectedHitIds = ["pending"];
      expect(calculateDocument(final).status, row.slug).toBe("blocked");
      expect(calculateDocument(final).blockers.join()).toMatch(/setEffectActive|setBurstEffectActive/);
      doc.selectedHitIds = ["pending"];
      expect(() => convertCalculatorToFinalPanel(doc)).toThrow(/setEffectActive|setBurstEffectActive/);
    }
  });

  it("limits bow and charged-attack conditions to relevant ordinary hits without treating unknown stats as zero", () => {
    for (const weapon of ["hamayumi", "slingshot"] as const) {
      const doc = loadWorkedExample("fixture-a"), hit = doc.hits[0]!;
      if (hit.kind !== "ordinary") throw Error("ordinary fixture required");
      doc.build = build("amber", weapon, { weaponEffectsEnabled: true });
      hit.attackTag = "burst"; hit.element = "pyro";
      expect(calculateDocument(doc).status, weapon).toBe("calculated");
      hit.attackTag = "normal";
      expect(calculateDocument(doc).status, weapon).toBe("blocked");
      delete hit.attackTag;
      expect(calculateDocument(doc).status).toBe("blocked");
      doc.hits = [{ kind: "transformative", id: hit.id, label: "合成超导", reaction: "superconduct", reactionBonus: 0, sourceRefs: [], dependencies: [] }];
      expect(calculateDocument(doc).status).toBe("calculated");
    }
    const doc = loadWorkedExample("fixture-a"), hit = doc.hits[0]!;
    if (hit.kind !== "ordinary") throw Error("ordinary fixture required");
    doc.build = build("noelle", "ferrousshadow", { weaponEffectsEnabled: true, effectContext: { hpFraction: 0.7 } });
    hit.attackTag = "normal";
    expect(calculateDocument(doc).status).toBe("calculated");
    hit.attackTag = "charged";
    expect(calculateDocument(doc).blockers.join()).toContain("边界来源冲突");
    expect(() => build("amber", "prototypecrescent", { weaponEffectsEnabled: true })).toThrow(/weaponEffectActive/);
  });
});
