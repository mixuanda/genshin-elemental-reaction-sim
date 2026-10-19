import { describe, expect, it } from "vitest";
import { getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { prepareSourceCastDocument } from "../../../sim-core/src/source-cast-context";
import { calculateDocument } from "../../../sim-core/src/calculator";

const characters = [
  ["lohen", "character:10000129"],
  ["linnea", "character:10000130"],
  ["sandrone", "character:10000133"],
  ["alyosha", "character:10000148"],
] as const;

describe("observed low and high plunge", () => {
  it("uses actual collision opportunities and target contacts without inferring them from height", () => {
    for (const [slug, characterId] of characters) for (const height of ["low", "high"] as const) {
      const skillId = `${slug}-plunge-${height}-observed-base`;
      const base = getCharacterDocuments(characterId, 1).find((document) => document.gameContext?.skillId === skillId);
      expect(base, skillId).toBeDefined();
      const document = structuredClone(base!);
      document.gameContext!.observedPlunge = {
        collisionCount: 3, collisionContacts: { "1": true, "2": false, "3": true },
        landingContact: true, statsStableAcrossHits: true, noExternalInfusion: true,
      };
      const prepared = prepareSourceCastDocument(document);
      expect(prepared.gameContext?.scopeCoverage, skillId).toBe("complete-cast");
      expect(prepared.hits.map((hit) => hit.id)).toEqual([
        `${skillId}:collision-1`, `${skillId}:collision-3`, `${skillId}:landing`,
      ]);
      const missed = structuredClone(prepared);
      missed.gameContext!.observedPlunge = {
        collisionCount: 0, landingContact: false, statsStableAcrossHits: true, noExternalInfusion: true,
      };
      const noContact = prepareSourceCastDocument(missed);
      expect(noContact.hits.map((hit) => hit.kind)).toEqual(["non-damaging"]);
      noContact.gameContext!.observedPlunge!.collisionCount = 1;
      noContact.gameContext!.observedPlunge!.collisionContacts = { "1": true };
      expect(prepareSourceCastDocument(noContact).hits.map((hit) => hit.id)).toEqual([`${skillId}:collision-1`]);
    }
  });
  it("uses each observed offensive snapshot and requires unchanged target conditions", () => {
    const skillId = "lohen-plunge-low-observed-base";
    const base = structuredClone(getCharacterDocuments("character:10000129", 1).find(document => document.gameContext?.skillId === skillId)!);
    base.gameContext!.observedPlunge = { collisionCount: 1, collisionContacts: { "1": true }, landingContact: true,
      noExternalInfusion: true, statsStableAcrossHits: false, targetConditionsStableAcrossHits: true };
    let document = prepareSourceCastDocument(base);
    expect(document.gameContext!.scopeCoverage).toBe("selected-components");
    document.hits.forEach((hit, index) => {
      if (hit.kind !== "ordinary") throw new Error("Expected two ordinary plunge hits");
      hit.finalSnapshot = { stats: { atk: 1000 + index * 1000, hp: 10000, def: 700, em: 0, critRate: 0, critDamage: 0.5 },
        characterLevel: 90, ascension: 6, damageBonus: 0, additiveBaseDamage: 0, reactionBonus: 0,
        source: `Synthetic observed offense ${index + 1}; not an in-game measurement`, sourceRefs: ["fixture:plunge-history"] };
    });
    document = prepareSourceCastDocument(document);
    const result = calculateDocument(document);
    expect(document.gameContext!.scopeCoverage).toBe("complete-cast");
    expect(result.status, result.blockers.join("; ")).toBe("calculated");
    expect(result.trace.some(node => node.id.includes("snapshot.atk"))).toBe(true);
    const changedBuild = structuredClone(document);
    changedBuild.build = { mode: "manual-final", stats: { atk: 9999, hp: 99999, def: 999, em: 999, critRate: 1, critDamage: 9 }, source: "unrelated current panel" };
    expect(calculateDocument(changedBuild).totals).toEqual(result.totals);
    const unknownTarget = structuredClone(document);
    delete unknownTarget.gameContext!.observedPlunge!.targetConditionsStableAcrossHits;
    expect(calculateDocument(unknownTarget).status).toBe("blocked");
    const missing = structuredClone(document);
    if (missing.hits[0]!.kind === "ordinary") delete missing.hits[0]!.finalSnapshot;
    expect(calculateDocument(missing).status).toBe("blocked");
  });
});
