import { describe, expect, it } from "vitest";
import { gameDataCatalog, findTalentSetById } from "./catalog";
import { getClassifiedCharacterHits, getClassifiedHitCoverage, resolveClassifiedCharacterHits, sourceClassifiedMappings } from "./classified-hits";
import { getCharacterDocuments } from "../../../apps/web/src/character-calculations";
import { calculateDocument } from "../../sim-core/src/calculator";
import { calculatorDocumentSchema, parseCalculatorDocument, serializeCalculatorDocument } from "../../sim-core/src/calculator-model";

const characterId = (slug: string) => gameDataCatalog.characters.find((entry) => entry.slug === slug)!.id;

describe("source-classified field-level character calculations", () => {
  it("cross-checks every supported level and keeps character-wide mechanics out of hit dependencies", () => {
    const coverage = getClassifiedHitCoverage();
    expect(coverage.charactersWithHits).toBeGreaterThanOrEqual(60);
    expect(coverage.classifiedHits).toBeGreaterThanOrEqual(290);
    expect(coverage.teamSimulationReadyFromTheseMappings).toBe(0);
    for (const character of coverage.perCharacter) {
      for (const doc of getCharacterDocuments(character.characterId, 10)) {
        expect(calculatorDocumentSchema.safeParse(doc).success, doc.id).toBe(true);
        const result = calculateDocument(doc);
        if (doc.hits.some((hit) => hit.kind === "blocked")) {
          expect(result.status, doc.id).toBe("blocked");
          expect(result.totals, doc.id).toBeUndefined();
        } else {
          expect(result.status, doc.id).toBe("calculated");
          expect(result.verification, doc.id).toBe("provisional");
          expect(result.totals?.nonCritical, doc.id).toBeGreaterThan(0);
        }
        expect(doc.hits.every((hit) => !hit.dependencies.includes("unrelated-team-rotation"))).toBe(true);
        expect(parseCalculatorDocument(serializeCalculatorDocument(doc))).toEqual(doc);
      }
    }
    for (const mapping of sourceClassifiedMappings) {
      expect(mapping.sourceCoefficientValues, mapping.id).toHaveLength(15);
      const ability = findTalentSetById(mapping.talentSetId)!.abilities.find((entry) => entry.key === mapping.abilityKey)!;
      for (const [index, expected] of mapping.sourceCoefficientValues!.entries()) {
        expect(Math.abs(ability.parameters[mapping.parameterKey]![index]! - expected), mapping.id).toBeLessThanOrEqual(mapping.coefficientTolerance ?? 0);
      }
    }
  });

  it("preserves N-input identity and per-instance multihit critical/reaction calculation", () => {
    const docs = getCharacterDocuments(characterId("xiangling"));
    const fourth = docs.find((doc) => doc.gameContext?.skillId === "xiangling-normal-4")!;
    expect(fourth.hits).toHaveLength(4);
    expect(fourth.gameContext).toMatchObject({ abilityId: "talent:xiangling:combat1", constellation: 0, scopeCoverage: "complete-cast" });
    expect(new Set(fourth.hits.map((hit) => hit.id)).size).toBe(4);
    const result = calculateDocument(fourth);
    expect(result.totals!.expected).toBeCloseTo(result.hits.reduce((sum, hit) => sum + hit.expected!, 0), 10);
    expect(docs.some((doc) => doc.gameContext?.skillId === "xiangling-normal-6")).toBe(false);
    const chongyun = getCharacterDocuments(characterId("chongyun")).find((doc) => doc.gameContext?.skillId === "chongyun-burst-burst")!;
    expect(chongyun.hits).toHaveLength(3);
    expect(chongyun.gameContext!.scopeCoverage).toBe("complete-cast");
  });

  it("retains HP, DEF and mixed stat terms instead of silently coercing all coefficients to ATK", () => {
    const noelle = getClassifiedCharacterHits(characterId("noelle")).find((hit) => hit.id === "noelle-skill-shielddmg-hit")!;
    expect(noelle.terms.map((term) => term.stat)).toEqual(["def"]);
    const neuvillette = getClassifiedCharacterHits(characterId("neuvillette")).find((hit) => hit.id === "neuvillette-skill-hit")!;
    expect(neuvillette.terms.map((term) => term.stat)).toEqual(["hp"]);
    const chiori = getClassifiedCharacterHits(characterId("chiori")).find((hit) => hit.id === "chiori-skill-thrustatkscaling-hit")!;
    expect(chiori.terms.map((term) => term.stat)).toEqual(["atk", "def"]);
    const alhaitham = getClassifiedCharacterHits(characterId("alhaitham")).find((hit) => hit.id === "alhaitham-skill-rushatk-hit")!;
    expect(alhaitham.terms.map((term) => term.stat)).toEqual(["atk", "em"]);
    const doc = getCharacterDocuments(characterId("chiori")).find((entry) => entry.gameContext?.skillId === chiori.skillId)!;
    expect(calculateDocument(doc).totals!.nonCritical).toBeCloseTo((2000 * chiori.terms[0]!.coefficient + 800 * chiori.terms[1]!.coefficient) * 0.5 * 0.9, 10);
    expect(doc.gameContext!.scopeCoverage).toBe("selected-components");
  });

  it("blocks a drifted skill field without blocking the same character's independently matched normals", () => {
    const ability = findTalentSetById("talent-set:kaeya")!.abilities.find((entry) => entry.key === "combat2")!;
    const original = ability.parameters.param1!;
    try {
      ability.parameters.param1 = [...original];
      ability.parameters.param1[0] = original[0]! + 0.001;
      const resolved = resolveClassifiedCharacterHits(characterId("kaeya"), 1);
      expect(resolved.blockers.some((entry) => entry.id === "kaeya-skill-hit")).toBe(true);
      expect(resolved.hits.some((entry) => entry.id === "kaeya-normal-1-hit-1")).toBe(true);
      const docs = getCharacterDocuments(characterId("kaeya"), 1);
      const blocked = docs.find((doc) => doc.gameContext?.skillId === "kaeya-skill")!;
      expect(calculateDocument(blocked)).toMatchObject({ status: "blocked", verification: "blocked" });
      expect(calculateDocument(blocked).totals).toBeUndefined();
      expect(calculateDocument(docs.find((doc) => doc.gameContext?.skillId === "kaeya-normal-1")!).status).toBe("calculated");
    } finally { ability.parameters.param1 = original; }
  });

  it("retains source-counted droplets and six-part burst actions with distinct coefficients", () => {
    const barbara = getCharacterDocuments(characterId("barbara")).find((doc) => doc.gameContext?.skillId === "barbara-skill")!;
    expect(barbara.hits).toHaveLength(2);
    const wriothesley = getCharacterDocuments(characterId("wriothesley")).find((doc) => doc.gameContext?.skillId === "wriothesley-burst-ousia-ready")!;
    expect(wriothesley.hits).toHaveLength(6);
    expect(wriothesley.gameContext!.scopeCoverage).toBe("complete-cast");
    const coefficients = wriothesley.hits.map((hit) => hit.kind === "ordinary" ? hit.terms[0]!.coefficient : NaN);
    expect(coefficients.slice(0, 5).every((coefficient) => coefficient === coefficients[0])).toBe(true);
    expect(coefficients[5]).not.toBe(coefficients[0]);
    expect(calculateDocument(wriothesley).totals!.nonCritical).toBeCloseTo(coefficients.reduce((sum, coefficient) => sum + coefficient * 2000 * 0.5 * 0.9, 0), 10);
  });

  it("applies source passive terms only at their explicit ascension threshold", () => {
    const zhongli = getCharacterDocuments(characterId("zhongli")).find((doc) => doc.gameContext?.skillId === "zhongli-burst-burst")!;
    const unlocked = calculateDocument(zhongli).totals!.nonCritical;
    zhongli.gameContext!.ascension = 0;
    zhongli.characterLevel = 1;
    zhongli.enemy.level = 1;
    const locked = calculateDocument(zhongli);
    expect(locked.status).toBe("calculated");
    expect(unlocked - locked.totals!.nonCritical).toBeCloseTo(20000 * 0.33 * 0.5 * 0.9, 10);
    expect(zhongli.hits[0]).toMatchObject({ terms: [{ stat: "atk" }, { stat: "hp", coefficient: 0.33, minimumAscension: 4 }] });
    delete zhongli.gameContext!.ascension;
    expect(calculateDocument(zhongli).status).toBe("blocked");
  });

  it("executes Clorinde's sourced stack cap as an editable additive formula per burst hit", () => {
    const doc = getCharacterDocuments(characterId("clorinde")).find((entry) => entry.gameContext?.skillId === "clorinde-burst-burstdamage")!;
    expect(doc.hits).toHaveLength(5);
    const zero = calculateDocument(doc).totals!.nonCritical;
    for (const hit of doc.hits) if (hit.kind === "ordinary") hit.additiveBaseFormula!.inputs[0]!.value = 3;
    expect(calculateDocument(doc).totals!.nonCritical - zero).toBeCloseTo(5 * 1200 * 0.5 * 0.9, 10);
    if (doc.build.mode !== "manual-final") throw new Error("Expected editable final panel");
    doc.build.stats.atk = 10000;
    const capped = calculateDocument(doc).totals!.nonCritical;
    for (const hit of doc.hits) if (hit.kind === "ordinary") hit.additiveBaseFormula!.inputs[0]!.value = 0;
    expect(capped - calculateDocument(doc).totals!.nonCritical).toBeCloseTo(5 * 1800 * 0.5 * 0.9, 10);
    doc.gameContext!.constellation = 2;
    expect(calculateDocument(doc).status).toBe("blocked");
  });

  it("does not call a persistent tick a complete skill cast or synthesize unsupported coefficients", () => {
    const fischl = getCharacterDocuments(characterId("fischl")).find((doc) => doc.gameContext?.skillId === "fischl-skill-birdatk")!;
    expect(fischl.gameContext!.scopeCoverage).toBe("selected-components");
    expect(fischl.assumptions.join()).toContain("生命周期");
    expect(() => getClassifiedCharacterHits(characterId("kaeya"), 16)).toThrow(/缺少/);
    expect(getClassifiedCharacterHits("unavailable-character")).toEqual([]);
  });

  it("keeps traveler gender and element identity, blocking only the conflicting action components", () => {
    const aether = getCharacterDocuments(characterId("aether"));
    const tap = aether.find((doc) => doc.gameContext?.skillId === "aether-anemo-skill-tap")!;
    expect(tap.gameContext).toMatchObject({ variantId: "aether-anemo", abilityId: "talent:traveleranemo:combat2" });
    expect(calculateDocument(tap).status).toBe("calculated");
    const burst = aether.find((doc) => doc.gameContext?.skillId === "aether-anemo-burst")!;
    expect(calculateDocument(burst).status).toBe("blocked");
    const charge = aether.find((doc) => doc.gameContext?.skillId === "aether-anemo-charged-base")!;
    expect(calculateDocument(charge).status).toBe("blocked");
    charge.scope = "single-hit";
    charge.selectedHitIds = [charge.hits.find((hit) => hit.kind === "ordinary")!.id];
    expect(calculateDocument(charge).status).toBe("calculated");
    const blockerIds = getClassifiedHitCoverage().travelerActionBlockers.map((entry) => entry.id);
    expect(blockerIds).toContain("aether-anemo-burst-blocked");
    expect(blockerIds).not.toContain("lumine-pyro-charged-base-blocked");
    expect(blockerIds).not.toContain("aether-cryo-unverified-actions-blocked");
    const cryo = aether.find((doc) => doc.gameContext?.skillId === "aether-cryo-burst-no-radiance-zero-frostglow")!;
    expect(cryo.hits).toHaveLength(3);
    expect(cryo.gameContext).toMatchObject({ variantId: "aether-cryo", abilityId: "talent:travelercryo:combat3", scopeCoverage: "complete-cast" });
    expect(calculateDocument(cryo).status).toBe("calculated");
    const luminePyro = getCharacterDocuments(characterId("lumine")).find((doc) => doc.gameContext?.skillId === "lumine-pyro-charged-base")!;
    expect(luminePyro.hits).toHaveLength(2);
    expect(calculateDocument(luminePyro).status).toBe("calculated");
  });

  it("keeps the new source revision explicit and verifies complete tick counts without claiming summon lifetimes", () => {
    const prune = getCharacterDocuments(characterId("prune")).find((doc) => doc.gameContext?.skillId === "prune-burst-no-extra-triggers")!;
    expect(prune.hits).toHaveLength(7);
    expect(prune.gameContext!.scopeCoverage).toBe("complete-cast");
    expect(prune.hits.every((hit) => hit.sourceRefs.some((ref) => ref.includes("/a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd/")))).toBe(true);
    const sum = prune.hits.reduce((total, hit) => total + (hit.kind === "ordinary" ? hit.terms[0]!.coefficient * 2000 * 0.5 * 0.9 : NaN), 0);
    expect(calculateDocument(prune).totals!.nonCritical).toBeCloseTo(sum, 10);
    const odette = getCharacterDocuments(characterId("odette")).find((doc) => doc.gameContext?.skillId === "odette-burst-direct-four-hits")!;
    expect(odette.hits).toHaveLength(4);
    expect(odette.gameContext!.scopeCoverage).toBe("selected-components");
    const iansan = getCharacterDocuments(characterId("iansan"));
    expect(calculateDocument(iansan.find((doc) => doc.gameContext?.skillId === "iansan-swift-talent-unresolved")!).status).toBe("blocked");
    expect(calculateDocument(iansan.find((doc) => doc.gameContext?.skillId === "iansan-skill-skill")!).status).toBe("calculated");
  });

  it("wires the four reviewed Dendro Traveler hit mappings to the shared A4 bonus rule", () => {
    for (const gender of ["aether", "lumine"]) {
      const documents = getCharacterDocuments(characterId(gender));
      const affected = documents.flatMap((doc) => doc.hits.filter((hit) => hit.kind === "ordinary" && hit.damageBonusFormula)
        .map((hit) => ({ doc, hit })));
      expect(affected).toHaveLength(2);
      for (const { doc, hit } of affected) {
        if (hit.kind !== "ordinary") throw new Error("Expected source ordinary hit");
        expect(hit.damageBonusFormula!.ruleId).toBe(`dendro-traveler-a4-${hit.attackTag}-gcsim-b4ae769`);
        expect(hit.damageBonusFormula!.requirements).toMatchObject({ minimumAscension: 4, elements: ["dendro"], attackTags: [hit.attackTag] });
        expect(doc.assumptions.join()).toContain("不能重复加入该被动");
        expect(doc.assumptions.join()).not.toContain("已将命中时元素精通");
      }
    }
  });
});
