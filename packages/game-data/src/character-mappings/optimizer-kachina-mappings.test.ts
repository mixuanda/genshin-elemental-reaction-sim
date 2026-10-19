import { describe, expect, it } from "vitest";
import { findTalentSetById } from "../catalog";
import { getClassifiedHitCoverage } from "../classified-hits";
import { optimizerKachinaMappings, optimizerKachinaSourceEvidence } from "./optimizer-kachina-mappings";
import { getCharacterDocuments } from "../../../../apps/web/src/character-calculations";
import { calculateDocument } from "../../../sim-core/src/calculator";
import { prepareSourceCastDocument } from "../../../sim-core/src/source-cast-context";

describe("fixed Optimizer production-sheet Kachina damage components", () => {
  it("matches all 270 source values exactly and retains repository-specific evidence", () => {
    expect(optimizerKachinaMappings).toHaveLength(18);
    const talent = findTalentSetById("talent-set:kachina")!;
    for (const mapping of optimizerKachinaMappings) {
      const ability = talent.abilities.find((entry) => entry.key === mapping.abilityKey)!;
      expect(mapping.sourceCoefficientValues, mapping.id).toHaveLength(15);
      expect(mapping.sourceCoefficientValues, mapping.id).toEqual(ability.parameters[mapping.parameterKey]);
      expect(mapping.coefficientTolerance).toBe(0);
      expect(mapping.sourceRepository).toBe("frzyc/genshin-optimizer");
      for (const path of mapping.sourcePaths) {
        expect(optimizerKachinaSourceEvidence.sourceFiles.find((source) => source.path === path)?.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(path).not.toContain("formula/src/data/char");
      }
    }
    expect(getClassifiedHitCoverage().charactersWithHits).toBeGreaterThanOrEqual(113);
  });

  it("keeps both N2 coefficients and computes DEF skill components with automatic A4 once", () => {
    const docs = getCharacterDocuments("character:10000100", 1);
    const normal = docs.find((doc) => doc.gameContext!.skillId === "kachina-normal-2")!;
    expect(normal.hits).toHaveLength(2);
    expect(normal.gameContext!.scopeCoverage).toBe("complete-cast");
    expect(calculateDocument(normal).totals!.nonCritical).toBeCloseTo(2000 * (0.27569 + 0.306323) * 0.5 * 0.9, 10);
    const skill = docs.find((doc) => doc.gameContext!.skillId === "kachina-skill-riding-single-pulse")!;
    expect(skill.hits[0]).toMatchObject({ kind: "ordinary", attackTag: "skill", element: "geo", terms: [{ stat: "def", coefficient: 0.8776 }, { stat: "def", coefficient: 0.2, minimumAscension: 4 }] });
    expect(skill.gameContext!.scopeCoverage).toBe("selected-components");
    expect(calculateDocument(skill).totals!.nonCritical).toBeCloseTo(800 * (0.8776 + 0.2) * 0.5 * 0.9, 10);
    skill.gameContext!.ascension = 3;
    expect(calculateDocument(skill).totals!.nonCritical).toBeCloseTo(800 * 0.8776 * 0.5 * 0.9, 10);
    expect(skill.hits.every((hit) => hit.sourceRefs.some((ref) => ref.includes("frzyc/genshin-optimizer/blob/180a0a1")))).toBe(true);
    expect(skill.hits.every((hit) => !hit.sourceRefs.some((ref) => ref.includes("genshinsim/gcsim/blob/180a0a1")))).toBe(true);
  });

  it("keeps the one-pulse entries partial while C0 Q owns its single direct hit", () => {
    const docs = getCharacterDocuments("character:10000100", 1);
    const burst = docs.find((doc) => doc.gameContext!.skillId === "kachina-burst-initial")!;
    expect(burst.gameContext!.scopeCoverage).toBe("complete-cast");
    expect(burst.hits[0]).toMatchObject({ terms: [{ stat: "def", coefficient: 3.805672 }] });
    expect(burst.assumptions.join()).toContain("夜魂迸发后 12 秒");
    expect(burst.assumptions.join()).toContain("后续E震荡归属E");
    expect(docs.find(doc => doc.gameContext?.skillId === "kachina-skill-independent-single-pulse")?.gameContext?.scopeCoverage).toBe("selected-components");
  });

  it("materializes only the observed E lifetime and preserves a standalone occurred slam", () => {
    const docs = getCharacterDocuments("character:10000100", 1);
    const base = docs.find(doc => doc.gameContext?.skillId === "kachina-skill-observed-lifecycle")!;
    expect(base.gameContext?.scopeCoverage).toBe("selected-components");
    base.gameContext!.kachinaCast = {
      casterId: "kachina", targetId: "enemy", startingMode: "independent", allActionsRecorded: true,
      fullObservedLifetime: true, noPhlogiston: true, noReplacement: true, noInterruption: true, a1InactiveThroughout: true,
      statsStableAcrossHits: true, observedThroughFrame: 300,
      events: [
        { id: "independent-1", frame: 30, kind: "independent-slam", nightsoulPointsAfter: 50, targetContact: true },
        { id: "mount", frame: 90, kind: "mount", nightsoulPointsAfter: 40 },
        { id: "riding-1", frame: 120, kind: "riding-slam", nightsoulPointsAfter: 30, targetContact: true },
        { id: "drain", frame: 299, kind: "points-observed", nightsoulPointsAfter: 0 },
        { id: "end", frame: 300, kind: "end", nightsoulPointsAfter: 0 },
      ],
    };
    const prepared = prepareSourceCastDocument(base);
    expect(prepared.gameContext?.scopeCoverage).toBe("complete-cast");
    expect(prepared.hits.map(hit => hit.id)).toEqual([
      "kachina-skill-observed-lifecycle:independent-1", "kachina-skill-observed-lifecycle:riding-1",
    ]);
    expect(calculateDocument(prepared).totals!.nonCritical).toBeCloseTo(800 * (0.6376 + 0.2 + 0.8776 + 0.2) * 0.5 * 0.9, 8);
    const incomplete = structuredClone(base);
    incomplete.gameContext!.kachinaCast!.events = incomplete.gameContext!.kachinaCast!.events!.slice(0, 1);
    incomplete.scope = "single-hit";
    const occurred = prepareSourceCastDocument(incomplete);
    expect(occurred.gameContext?.scopeCoverage).toBe("single-hit");
    expect(occurred.hits).toHaveLength(1);
    expect(calculateDocument(occurred).totals!.nonCritical).toBeCloseTo(800 * (0.6376 + 0.2) * 0.5 * 0.9, 8);
  });

  it("accounts for an observed A1 slam once, including historical bonus inputs", () => {
    const base = getCharacterDocuments("character:10000100", 1).find(doc => doc.gameContext?.skillId === "kachina-skill-observed-lifecycle")!;
    base.gameContext!.kachinaCast = {
      casterId: "kachina", targetId: "enemy", startingMode: "independent", allActionsRecorded: true,
      fullObservedLifetime: true, noPhlogiston: true, noReplacement: true, noInterruption: true,
      a1InactiveThroughout: false, statsStableAcrossHits: true, observedThroughFrame: 60,
      events: [
        { id: "active", frame: 30, kind: "independent-slam", nightsoulPointsAfter: 30, targetContact: true, a1Active: true, a1IncludedInDamageBonus: false },
        { id: "end", frame: 60, kind: "end", nightsoulPointsAfter: 0 },
      ],
    };
    const prepared = prepareSourceCastDocument(base);
    expect(prepared.gameContext?.scopeCoverage).toBe("complete-cast");
    const first = calculateDocument(prepared);
    expect(first.totals!.nonCritical).toBeCloseTo(800 * (0.6376 + 0.2) * 1.2 * 0.5 * 0.9, 8);
    expect(first.hits[0]!.trace.some(node => node.ruleId === "optimizer-kachina-a1-observed-geo-damage-bonus-180a0a1" && node.result?.value === 0.2)).toBe(true);

    const included = structuredClone(prepared);
    included.gameContext!.kachinaCast!.events![0]!.a1IncludedInDamageBonus = true;
    if (included.hits[0]!.kind !== "ordinary") throw new Error("Expected observed slam");
    included.hits[0]!.damageBonus = 0.2;
    const countedOnce = calculateDocument(prepareSourceCastDocument(included));
    expect(countedOnce.totals!.nonCritical).toBeCloseTo(first.totals!.nonCritical, 8);
    expect(countedOnce.hits[0]!.trace.some(node => node.ruleId === "optimizer-kachina-a1-observed-geo-damage-bonus-180a0a1" && node.result?.value === 0)).toBe(true);

    const historical = structuredClone(prepared);
    historical.gameContext!.kachinaCast!.events![0]!.a1IncludedInDamageBonus = true;
    if (historical.hits[0]!.kind !== "ordinary") throw new Error("Expected observed slam");
    historical.hits[0]!.finalSnapshot = {
      stats: { atk: 1000, hp: 10000, def: 800, em: 0, critRate: 0, critDamage: 0 },
      characterLevel: 90, ascension: 6, damageBonus: 0.2, additiveBaseDamage: 0, reactionBonus: 0,
      source: "Synthetic historical A1-inclusive panel", sourceRefs: ["synthetic:kachina-a1-accounting"],
    };
    expect(calculateDocument(prepareSourceCastDocument(historical)).totals!.nonCritical).toBeCloseTo(first.totals!.nonCritical, 8);

    const unknown = structuredClone(base);
    delete unknown.gameContext!.kachinaCast!.events![0]!.a1IncludedInDamageBonus;
    expect(prepareSourceCastDocument(unknown).gameContext?.scopeCoverage).not.toBe("complete-cast");
    const conflict = structuredClone(base);
    conflict.gameContext!.kachinaCast!.a1InactiveThroughout = true;
    expect(prepareSourceCastDocument(conflict).gameContext?.scopeCoverage).not.toBe("complete-cast");
  });

  it("offers a complete collision plus landing plunge branch", () => {
    const docs = getCharacterDocuments("character:10000100", 1);
    const plunge = docs.find(doc => doc.gameContext?.skillId === "kachina-plunge-low-with-collision")!;
    expect(plunge.hits).toHaveLength(2);
    expect(plunge.gameContext?.scopeCoverage).toBe("complete-cast");
  });
});
