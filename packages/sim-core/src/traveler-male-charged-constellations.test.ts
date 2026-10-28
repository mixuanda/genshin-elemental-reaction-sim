import { describe, expect, it } from "vitest";
import { createMaleChargedFixture as fixture } from "./traveler-male-charged.test-helper";
import { calculateDocument, convertCalculatorToFinalPanel } from "./calculator";
import { parseCalculatorDocument, serializeCalculatorDocument } from "./calculator-model";
import type { CalculatorDocument } from "./calculator-model";
import { prepareSourceCastDocument } from "./source-cast-context";
import { travelerMaleChargedConstellationScope, TRAVELER_MALE_CHARGED_ANEMO_CONSTELLATION_SOURCE_REFS } from "./traveler-male-charged-constellations";

const SKILL = "male-charged-aether-anemo-c0";

describe("Aether Anemo physical charged constellation scope", () => {
  it("calculates the source-proven C6 two-hit physical branch without inventing physical resistance reduction or NA levels", () => {
    const document = fixture(), result = calculateDocument(document);
    expect(result.blockers).toEqual([]);
    expect(result.status).toBe("calculated");
    expect(result.hits).toHaveLength(2);
    expect(result.aggregation.scope).toBe("complete-cast");
    expect(result.totals!.nonCritical).toBeCloseTo(2000 * (1.105 + 1.2002) * .5 * .9, 10);
    expect(result.totals!.nonCritical).toBeCloseTo(2074.68, 10);
    expect(result.totals!.critical).toBeCloseTo(4149.36, 10);
    expect(result.totals!.expected).toBeCloseTo(3112.02, 10);
  });

  it.each([0, 1, 2, 3, 4, 5])("keeps actual C%i on the same NA10 coefficients, per-hit timing and physical resistance", constellation => {
    const document = prepareSourceCastDocument(fixture(constellation));
    expect(document.gameContext).toMatchObject({ skillId: SKILL, constellation, variantId: "aether-anemo", abilityId: "talent:traveleranemo:combat1", effectiveTalentLevel: 10 });
    expect(travelerMaleChargedConstellationScope(document)?.allowed).toBe(true);
    expect(document.hits.map(hit => {
      expect(travelerMaleChargedConstellationScope(document, hit)?.allowed).toBe(true);
      if (hit.kind !== "ordinary") throw new Error("Expected the two physical charged hits");
      expect(hit.element).toBe("physical");
      expect(hit.attackTag).toBe("charged");
      expect(hit.resistanceReductionFormula).toBeUndefined();
      expect(hit.sourceRefs).toEqual(expect.arrayContaining([...TRAVELER_MALE_CHARGED_ANEMO_CONSTELLATION_SOURCE_REFS]));
      return [hit.terms[0]!.coefficient, hit.travelerMaleChargedEvent!.frame, hit.travelerMaleChargedEvent!.snapshotFrame];
    })).toEqual([[1.105, 9, 9], [1.2002, 20, 20]]);
    expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(2074.68, 10);
  });

  it.each(["geo", "electro", "dendro", "hydro", "pyro", "cryo"])("retains the C0-only guard for the exact %s effect", element => {
    const document = fixture(6, element);
    document.gameContext!.travelerMaleChargedCast!.sharedState = {
      externalInfusionActive: false, trueMoonStoryBuffEnabled: false, cryoSkillActive: false, cryoRadiance: "none", cryoTrueMoonStacks: 0,
    };
    expect(travelerMaleChargedConstellationScope(document)).toMatchObject({ allowed: false, maximumConstellation: 0 });
    const result = calculateDocument(document);
    expect(result.status).toBe("blocked");
    expect(result.totals).toBeUndefined();
    expect(result.blockers.join()).toContain("非风男性基础重击分支仍仅支持明确C0");
    document.gameContext!.constellation = 0;
    expect(calculateDocument(document).blockers).toEqual([]);
  });

  it("does not lend the Anemo review to another gender, form, talent, attack tag or unrelated effect ID", () => {
    const good = prepareSourceCastDocument(fixture());
    for (const patch of [
      { characterId: "character:10000007" }, { variantId: "aether-geo" }, { abilityId: "talent:traveleranemo:combat2" },
      { abilityId: "talent:travelergeo:combat1" }, { effectiveTalentLevel: 16 },
    ]) {
      const document = structuredClone(good); Object.assign(document.gameContext!, patch);
      expect(travelerMaleChargedConstellationScope(document)?.allowed, JSON.stringify(patch)).toBe(false);
    }
    const hit = good.hits[0]!;
    if (hit.kind !== "ordinary") throw new Error("Expected physical source hit");
    for (const patch of [{ element: "anemo" }, { attackTag: "normal" }, { id: "unrelated-physical-charged" }]) {
      const changed = { ...hit, ...patch } as typeof hit;
      expect(travelerMaleChargedConstellationScope(good, changed)?.allowed, JSON.stringify(patch)).toBe(false);
    }
    const other = structuredClone(good); other.gameContext!.skillId = "aether-anemo-skill-tap";
    expect(travelerMaleChargedConstellationScope(other)).toBeUndefined();
  });

  it("uses an explicitly supplied NA13 once at C3/C5/C6 and respects the fixed vector upper endpoint", () => {
    for (const constellation of [3, 5, 6]) {
      const document = prepareSourceCastDocument(fixture(constellation, "anemo", 13));
      expect(document.hits.map(hit => hit.kind === "ordinary" ? hit.terms[0]!.coefficient : NaN)).toEqual([1.339, 1.45436]);
      expect(calculateDocument(document).totals!.nonCritical).toBeCloseTo(2000 * (1.339 + 1.45436) * .5 * .9, 10);
    }
    const top = prepareSourceCastDocument(fixture(6, "anemo", 15));
    expect(top.hits.map(hit => hit.kind === "ordinary" ? hit.terms[0]!.coefficient : NaN)).toEqual([1.495, 1.6238]);
  });

  it("keeps actual physical qualifications and legal full-cast conditions required after unlocking constellations", () => {
    const mutations: Array<(document: CalculatorDocument) => void> = [
      document => { delete document.gameContext!.travelerMaleChargedCast!.sharedState!.externalInfusionActive; },
      document => { document.gameContext!.travelerMaleChargedCast!.sharedState!.externalInfusionActive = true; },
      document => { delete document.gameContext!.travelerMaleChargedCast!.sharedState!.trueMoonStoryBuffEnabled; },
      document => { document.gameContext!.travelerMaleChargedCast!.sharedState!.trueMoonStoryBuffEnabled = true; },
      document => { delete document.gameContext!.travelerMaleChargedCast!.precedingNormalAttackConfirmed; },
      document => { document.gameContext!.travelerMaleChargedCast!.actionReadyConfirmed = false; },
      document => { document.gameContext!.travelerMaleChargedCast!.normalCounterBeforeCast = 0; },
      document => { delete document.gameContext!.travelerMaleChargedCast!.initialStamina; },
      document => { document.gameContext!.travelerMaleChargedCast!.initialStamina = 19; },
      document => { document.gameContext!.travelerMaleChargedCast!.staminaCostMultiplier = .5; },
      document => { document.gameContext!.travelerMaleChargedCast!.observedThroughFrame = 19; },
      document => { document.gameContext!.travelerMaleChargedCast!.noHitlag = false; },
      document => { delete document.gameContext!.travelerMaleChargedCast!.targetContacts!["hit-2"]; },
      document => { document.gameContext!.travelerMaleChargedCast!.statsStableAcrossHits = false; },
    ];
    for (const mutate of mutations) {
      const document = fixture(); mutate(document);
      expect(calculateDocument(document).status).toBe("blocked");
      const restored = parseCalculatorDocument(serializeCalculatorDocument(document));
      expect(calculateDocument(restored).totals).toBeUndefined();
      expect(restored.gameContext!.travelerMaleChargedCast).toEqual(document.gameContext!.travelerMaleChargedCast);
    }
  });

  it("preserves actual missed contact and allows only the known independent component without future action records", () => {
    const document = fixture(); document.gameContext!.travelerMaleChargedCast!.targetContacts!["hit-2"] = false;
    const result = calculateDocument(document);
    expect(result.hits).toHaveLength(1);
    expect(result.totals!.nonCritical).toBeCloseTo(994.5, 10);
    const independent = fixture();
    independent.scope = "single-hit";
    independent.selectedHitIds = [independent.hits[1]!.id];
    independent.gameContext!.travelerMaleChargedCast = { sharedState: { externalInfusionActive: false, trueMoonStoryBuffEnabled: false } };
    expect(calculateDocument(independent).totals!.nonCritical).toBeCloseTo(1080.18, 10);
    expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(independent))).totals).toEqual(calculateDocument(independent).totals);
  });

  it("uses different actual F9/F20 snapshots and rejects reusing finalized identities after constellation or level edits", () => {
    const changing = fixture(), context = changing.gameContext!.travelerMaleChargedCast!;
    context.statsStableAcrossHits = false;
    context.snapshots = Object.fromEntries([["sample:9", 1800], ["sample:20", 2200]].map(([key, atk]) => [key, {
      stats: { atk: Number(atk), hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 },
      characterLevel: 90, ascension: 6, damageBonus: 0, additiveBaseDamage: 0, reactionBonus: 0,
      source: `Declared actual offensive panel at ${key}`, sourceRefs: [TRAVELER_MALE_CHARGED_ANEMO_CONSTELLATION_SOURCE_REFS[0]!],
    }]));
    expect(calculateDocument(changing).totals!.nonCritical).toBeCloseTo((1800 * 1.105 + 2200 * 1.2002) * .5 * .9, 10);
    const converted = convertCalculatorToFinalPanel(prepareSourceCastDocument(fixture()));
    expect(calculateDocument(converted).totals!.nonCritical).toBeCloseTo(2074.68, 10);
    expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(converted))).totals).toEqual(calculateDocument(converted).totals);
    const changedC = structuredClone(converted); changedC.gameContext!.constellation = 5;
    expect(calculateDocument(changedC).status).toBe("blocked");
    const changedLevel = structuredClone(converted); changedLevel.characterLevel = 100;
    expect(calculateDocument(changedLevel).status).toBe("blocked");
  });
});
