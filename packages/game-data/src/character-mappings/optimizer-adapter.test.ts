import { describe, expect, it } from "vitest";
import { gameDataCatalog } from "../catalog";
import { getClassifiedHitCoverage } from "../classified-hits";
import { getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { calculateDocument } from "../../../sim-core/src/calculator";
import { parseCalculatorDocument, serializeCalculatorDocument } from "../../../sim-core/src/calculator-model";

const newIdentities = ["kachina", "nefer", "zibai", "illuga", "lohen", "linnea", "sandrone", "alyosha"];

// These public actions intentionally start unanswered, not with invented hit
// observations. Positive numerical counterparts live in optimizer-observed-
// plunge.test.ts, optimizer-kachina-mappings.test.ts, remaining-horizontal-
// source.test.ts, traveler-zibai-source-batch.test.ts and the Linnea/Sandrone
// observed-lifecycle suites. Keep exact action keys so new blockers cannot pass.
const unansweredActionBlockers: Record<string, readonly string[]> = {
  "kachina-plunge-low-with-collision": ["observed-plunge:schedule"],
  "kachina-plunge-high-with-collision": ["observed-plunge:schedule"],
  "kachina-skill-observed-lifecycle": ["kachina-cast:schedule"],
  "nefer-phantasm-observed-c0": ["nefer-phantasm:nefer-phantasm-observed-c0-nefer1", "nefer-phantasm:schedule"],
  "zibai-finite-spirit-steed-c0": ["zibai-finite:zibai-finite-spirit-steed-c0-ordinary"],
  "zibai-finite-burst-c0": ["zibai-finite:zibai-finite-burst-c0-ordinary"],
  "lohen-plunge-low-observed-base": ["observed-plunge:schedule"],
  "lohen-plunge-high-observed-base": ["observed-plunge:schedule"],
  "linnea-plunge-low-observed-base": ["observed-plunge:schedule"],
  "linnea-plunge-high-observed-base": ["observed-plunge:schedule"],
  "sandrone-plunge-low-observed-base": ["observed-plunge:schedule"],
  "sandrone-plunge-high-observed-base": ["observed-plunge:schedule"],
  "alyosha-plunge-low-observed-base": ["observed-plunge:schedule"],
  "alyosha-plunge-high-observed-base": ["observed-plunge:schedule"],
  "linnea-lumi-heavy-overdrive-hammer-component": ["observed-special-component:source"],
  "linnea-lumi-million-ton-crush-component": ["observed-special-component:source"],
  "sandrone-charged-beam-stellar-conduct-component": ["observed-special-component:source"],
  "sandrone-charged-beam-stellar-swirl-component": ["observed-special-component:source"],
  "sandrone-skill-prism-stellar-conduct-component": ["observed-special-component:source"],
  "sandrone-skill-prism-stellar-swirl-component": ["observed-special-component:source"],
  "sandrone-burst-ray-stellar-conduct-component": ["observed-special-component:source"],
  "sandrone-burst-ray-stellar-swirl-component": ["observed-special-component:source"],
};

describe("Optimizer source additions through the shared calculator adapter", () => {
  it("roundtrips every action at levels 1 and 10, calculates ready inputs and preserves exact unanswered gates", () => {
    let documents = 0, calculated = 0, unanswered = 0;
    const observedUnanswered = new Set<string>();
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
          const skillId = doc.gameContext!.skillId;
          const expectedBlockers = unansweredActionBlockers[skillId];
          if (expectedBlockers) {
            unanswered++;
            observedUnanswered.add(skillId);
            expect(result.status, doc.id).toBe("blocked");
            expect(result.totals, doc.id).toBeUndefined();
            expect([...new Set(result.blockers.map(reason => reason.split("：")[0]!))].sort(), doc.id).toEqual([...expectedBlockers].sort());
            expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(doc))).blockers, doc.id).toEqual(result.blockers);
          } else {
            calculated++;
            expect(result.status, doc.id).toBe("calculated");
            expect(result.blockers, doc.id).toEqual([]);
            expect(result.verification, doc.id).toBe("provisional");
            expect(result.totals!.nonCritical, doc.id).toBeGreaterThan(0);
            expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(doc))).totals, doc.id).toEqual(result.totals);
          }
          for (const hit of doc.hits) {
            expect(hit.sourceRefs.some((ref) => ref.includes("frzyc/genshin-optimizer/blob/180a0a1015cb725c7570cd828eb086749960df98/")), hit.id).toBe(true);
            expect(hit.dependencies).not.toContain("unrelated-team-rotation");
          }
        }
      }
    }
    expect(documents).toBe(202);
    expect(calculated).toBe(158);
    expect(unanswered).toBe(44);
    expect([...observedUnanswered].sort()).toEqual(Object.keys(unansweredActionBlockers).sort());
    const coverage = getClassifiedHitCoverage();
    expect(coverage.charactersWithHits).toBeGreaterThanOrEqual(120);
    expect(coverage.classifiedHits).toBeGreaterThanOrEqual(676);
    expect(coverage.teamSimulationReadyFromTheseMappings).toBe(0);
    // The later raw-source additions now map the former four inventory gaps;
    // mapped fields still confer no team-simulation readiness above.
    expect(coverage.uncoveredCharacterIdentities.map((entry) => entry.slug).sort()).toEqual([]);
  });
});
