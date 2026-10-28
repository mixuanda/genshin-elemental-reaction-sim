import { resolveTravelerMaleChargedValues } from "./character-mappings/traveler-male-charged-values";
import { getManekinSupplementalTalentSet } from "./character-mappings/manekin-raw-mappings";
import { defaultContextContract } from "./default-context-contracts";
import { describe, expect, it } from "vitest";
import { gameDataCatalog, findTalentSetById } from "./catalog";
import { getClassifiedCharacterHits, getClassifiedHitCoverage, resolveClassifiedCharacterHits, sourceClassifiedMappings } from "./classified-hits";
import { getCharacterDocuments } from "../../../apps/web/src/character-calculations";
import { calculateDocument } from "../../sim-core/src/calculator";
import { calculatorDocumentSchema, parseCalculatorDocument, serializeCalculatorDocument } from "../../sim-core/src/calculator-model";
import { releasedRuntimeWorkspace } from "./runtime-workspace";

// Closed raw-only exceptions: these vectors and supplements share one extraction
// lineage. Equality checks consistency, never an independent game-data cross-check.
const rawSupplementMappingIds = [
  "manekin-normal-1-raw-base-hit-1",
  "manekin-normal-2-raw-base-hit-1",
  "manekin-normal-3-raw-base-hit-1",
  "manekin-normal-3-raw-base-hit-2",
  "manekin-normal-4-raw-base-hit-1",
  "manekin-charged-raw-base-hit-1",
  "manekin-charged-raw-base-hit-2",
  "manekin-plunge-low-raw-base-hit-1",
  "manekin-plunge-high-raw-base-hit-1",
  "manekin-skill-pyro-raw-hit-1",
  "manekin-skill-hydro-raw-hit-1",
  "manekin-skill-electro-raw-hit-1",
  "manekin-skill-cryo-raw-hit-1",
  "manekin-skill-anemo-raw-hit-1",
  "manekin-skill-geo-raw-hit-1",
  "manekin-skill-dendro-raw-hit-1",
  "manekina-normal-1-raw-base-hit-1",
  "manekina-normal-2-raw-base-hit-1",
  "manekina-normal-3-raw-base-hit-1",
  "manekina-normal-3-raw-base-hit-2",
  "manekina-normal-4-raw-base-hit-1",
  "manekina-charged-raw-base-hit-1",
  "manekina-charged-raw-base-hit-2",
  "manekina-plunge-low-raw-base-hit-1",
  "manekina-plunge-high-raw-base-hit-1",
  "manekina-skill-pyro-raw-hit-1",
  "manekina-skill-hydro-raw-hit-1",
  "manekina-skill-electro-raw-hit-1",
  "manekina-skill-cryo-raw-hit-1",
  "manekina-skill-anemo-raw-hit-1",
  "manekina-skill-geo-raw-hit-1",
  "manekina-skill-dendro-raw-hit-1",
] as const;
const maleChargedAdjudicatedIds = [
  "male-charged-aether-anemo-c0-hit-1",
  "male-charged-aether-anemo-c0-hit-2",
  "male-charged-aether-geo-c0-hit-1",
  "male-charged-aether-geo-c0-hit-2",
  "male-charged-aether-electro-c0-hit-1",
  "male-charged-aether-electro-c0-hit-2",
  "male-charged-aether-dendro-c0-hit-1",
  "male-charged-aether-dendro-c0-hit-2",
  "male-charged-aether-hydro-c0-hit-1",
  "male-charged-aether-hydro-c0-hit-2",
  "male-charged-aether-pyro-c0-hit-1",
  "male-charged-aether-pyro-c0-hit-2",
  "male-charged-aether-cryo-c0-hit-1",
  "male-charged-aether-cryo-c0-hit-2",
] as const;
const maleChargedIds = new Set<string>(maleChargedAdjudicatedIds);
const rawSupplementIds = new Set<string>(rawSupplementMappingIds);
const rawSupplementOwners = {
  manekin: { characterId: "character:10000117", talentSetId: "talent-set:manekin" },
  manekina: { characterId: "character:10000118", talentSetId: "talent-set:manekina" },
} as const;

const characterId = (slug: string) => gameDataCatalog.characters.find((entry) => entry.slug === slug)!.id;

describe("source-classified field-level character calculations", () => {
  it("checks every supported source vector and keeps character-wide mechanics out of hit dependencies", () => {
    const coverage = getClassifiedHitCoverage();
    expect(coverage.charactersWithHits).toBeGreaterThanOrEqual(60);
    expect(coverage.classifiedHits).toBeGreaterThanOrEqual(290);
    expect(coverage.teamSimulationReadyFromTheseMappings).toBe(0);
    for (const character of coverage.perCharacter) {
      for (let doc of getCharacterDocuments(character.characterId, 10)) {
        if (doc.gameContext?.skillId === "jean-burst-two-boundaries-complete-c0") {
          // Default UI inputs deliberately do not assert observed full-cast contact.
          // Verify the guard before supplying an explicit positive test scenario.
          const unconfirmed = calculateDocument(doc);
          expect(unconfirmed.status).toBe("blocked");
          expect(unconfirmed.totals).toBeUndefined();
          expect(unconfirmed.blockers).toHaveLength(3);
          expect(unconfirmed.blockers.every(reason => reason.startsWith("batch-finite-context:"))).toBe(true);
          for (const missing of ["completeCastConfirmed", "statsStableAcrossHits"] as const) {
            const incomplete = structuredClone(doc);
            incomplete.gameContext!.batchFiniteCast = { completeCastConfirmed: true, statsStableAcrossHits: true };
            incomplete.gameContext!.batchFiniteCast[missing] = false;
            expect(calculateDocument(incomplete).status, missing).toBe("blocked");
            expect(calculateDocument(incomplete).totals, missing).toBeUndefined();
          }
          doc = structuredClone(doc);
          doc.gameContext!.batchFiniteCast = { completeCastConfirmed: true, statsStableAcrossHits: true };
          // Q10 at the existing teaching panel: three independently sourced hits.
          expect(calculateDocument(doc).totals?.nonCritical).toBeCloseTo(2000 * (7.6464 + 1.4112 + 1.4112) * .5 * .9, 8);
        }
        expect(calculatorDocumentSchema.safeParse(doc).success, doc.id).toBe(true);
        const result = calculateDocument(doc);
        const contextContract = defaultContextContract(doc.gameContext?.skillId);
        if (contextContract) {
          expect(result.status, doc.id).toBe("blocked");
          expect(result.totals, doc.id).toBeUndefined();
          expect(result.blockers, doc.id).toHaveLength(contextContract.defaultBlockerCount);
          expect([...new Set(result.blockers.map(reason => reason.split(":")[0]))].sort(), doc.id)
            .toEqual([...contextContract.blockerPrefixes].sort());
        } else if (doc.gameContext?.skillId === "xiao-burst-activation") {
          // This exact source action changes state; it has no direct hit or numeric subtotal.
          expect(doc.hits.map(hit => [hit.id, hit.kind]), doc.id).toEqual([["xiao-q-activation", "non-damaging"]]);
          expect(doc.selectedHitIds, doc.id).toEqual(["xiao-q-activation"]);
          expect(result.status, doc.id).toBe("calculated");
          expect(result.blockers, doc.id).toEqual([]);
          expect(result.hits.map(hit => [hit.id, hit.status]), doc.id).toEqual([["xiao-q-activation", "non-damaging"]]);
          expect(result.totals, doc.id).toBeUndefined();
        } else if (doc.hits.some((hit) => hit.kind === "blocked")) {
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
    const supplemented: string[] = [];
    const fixedOnlyIds = ["observed-emilie-skill-c0-a1", "observed-emilie-burst-c0-a1"] as const;
    const fixedChecked: string[] = [];
    const maleChecked: string[] = [];
    for (const mapping of sourceClassifiedMappings) {
      let talentSet = findTalentSetById(mapping.talentSetId);
      if (talentSet === null) {
        expect(rawSupplementIds.has(mapping.id), `Unreviewed missing catalog talent: ${mapping.id}`).toBe(true);
        const expectedSlug = mapping.id.startsWith("manekina-") ? "manekina" : "manekin";
        expect(mapping.characterSlug, mapping.id).toBe(expectedSlug);
        const owner = rawSupplementOwners[expectedSlug];
        expect(mapping.talentSetId, mapping.id).toBe(owner.talentSetId);
        expect(mapping.numericEvidenceStatus, mapping.id).toBe("single-source-extracted");
        talentSet = getManekinSupplementalTalentSet(owner.characterId, owner.talentSetId) ?? null;
        supplemented.push(mapping.id);
      }
      expect(talentSet, mapping.id).not.toBeNull();
      const ability = talentSet!.abilities.find((entry) => entry.key === mapping.abilityKey);
      expect(ability, mapping.id).toBeDefined();
      if (mapping.fixedOnly) {
        // These two source-fixed A1 roles are not catalog E/Q level vectors.
        expect((fixedOnlyIds as readonly string[]).includes(mapping.id), mapping.id).toBe(true);
        expect(mapping.characterSlug).toBe("emilie");
        expect(mapping.talentSetId).toBe("talent-set:emilie");
        expect(mapping.abilityKey).toBe("combat2");
        expect(mapping.parameterKey).toBe("");
        expect(mapping.sourceCoefficientValues).toBeUndefined();
        expect(mapping.sourceRepository).toBe("genshinsim/gcsim");
        expect(mapping.sourceCommit).toBe("b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541");
        expect(mapping.fixedTerms).toEqual([{ scalingStat: "atk", coefficient: 6,
          sourceField: "internal/characters/emilie/asc.go:a1:Mult", minimumAscension: 1 }]);
        for (let level = 1; level <= 15; level++) {
          const resolved = resolveClassifiedCharacterHits(characterId("emilie"), level);
          expect(resolved.blockers.some(hit => hit.id === mapping.id)).toBe(false);
          expect(resolved.hits.find(hit => hit.id === mapping.id)?.terms).toEqual([{ stat: "atk", coefficient: 6,
            minimumAscension: 1, coefficientField: "genshinsim/gcsim:b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541:internal/characters/emilie/asc.go:a1:Mult" }]);
        }
        fixedChecked.push(mapping.id);
      } else if (maleChargedIds.has(mapping.id)) {
        // The catalog's shared second charged vector remains raw evidence; the
        // previously reviewed male-specific adjudication must not overwrite it.
        expect(mapping.characterSlug).toBe("aether");
        expect(mapping.sourceCoefficientValues, mapping.id).toHaveLength(15);
        const character = gameDataCatalog.characters.find(entry => entry.id === "character:10000005")!;
        const raw = structuredClone(ability!.parameters);
        for (const [index, expected] of mapping.sourceCoefficientValues!.entries()) {
          const resolved = resolveTravelerMaleChargedValues({ mapping, character,
            catalogVersion: gameDataCatalog.catalogVersion, talentSetId: mapping.talentSetId,
            ability, parameterKey: mapping.parameterKey, talentLevel: index + 1 });
          expect(resolved?.status, mapping.id).toBe("resolved");
          if (resolved?.status !== "resolved") throw Error(`Male-source adjudication blocked: ${mapping.id}`);
          expect(resolved.values[index], mapping.id).toBe(expected);
          expect(resolved.coefficientField).toMatch(/^frzyc\/genshin-optimizer:180a0a1015cb725c7570cd828eb086749960df98:/);
        }
        if (mapping.id.endsWith("hit-2")) expect(raw[mapping.parameterKey]).not.toEqual(mapping.sourceCoefficientValues);
        else expect(raw[mapping.parameterKey]).toEqual(mapping.sourceCoefficientValues);
        expect(ability!.parameters).toStrictEqual(raw);
        maleChecked.push(mapping.id);
      } else {
        expect(mapping.sourceCoefficientValues, mapping.id).toHaveLength(15);
        for (const [index, expected] of mapping.sourceCoefficientValues!.entries()) {
          expect(Math.abs(ability!.parameters[mapping.parameterKey]![index]! - expected), mapping.id).toBeLessThanOrEqual(mapping.coefficientTolerance ?? 0);
        }
      }
    }
    expect(supplemented.sort()).toEqual([...rawSupplementMappingIds].sort());
    expect(fixedChecked.sort()).toEqual([...fixedOnlyIds].sort());
    expect(maleChecked.sort()).toEqual([...maleChargedAdjudicatedIds].sort());
  });

  it("keeps raw supplements bound to their exact owner and outside imported catalog records", () => {
    for (const owner of Object.values(rawSupplementOwners)) {
      expect(findTalentSetById(owner.talentSetId)).toBeNull();
      expect(getManekinSupplementalTalentSet(owner.characterId, owner.talentSetId)?.id).toBe(owner.talentSetId);
      expect(getManekinSupplementalTalentSet("character:unknown", owner.talentSetId)).toBeUndefined();
      expect(getManekinSupplementalTalentSet(owner.characterId, "talent-set:unknown")).toBeUndefined();
      expect(findTalentSetById(owner.talentSetId)).toBeNull();
    }
    expect(getManekinSupplementalTalentSet("character:10000117", "talent-set:manekina")).toBeUndefined();
    expect(getManekinSupplementalTalentSet("character:10000118", "talent-set:manekin")).toBeUndefined();
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
      // UI documents use their explicitly selected, separately parsed runtime
      // workspace. Mutating the legacy catalog must not contaminate that data.
      const released = getCharacterDocuments(characterId("kaeya"), 1);
      const releasedSkill = released.find((doc) => doc.gameContext?.skillId === "kaeya-skill")!;
      expect(calculateDocument(releasedSkill).totals!.nonCritical).toBeCloseTo(2000 * original[0]! * 0.5 * 0.9, 10);

      const workspace = structuredClone(releasedRuntimeWorkspace);
      const runtimeAbility = workspace.catalog.talentSets.find((entry) => entry.id === "talent-set:kaeya")!.abilities.find((entry) => entry.key === "combat2")!;
      runtimeAbility.parameters.param1 = [...runtimeAbility.parameters.param1!];
      runtimeAbility.parameters.param1[0] = original[0]! + 0.001;
      const runtimeResolved = resolveClassifiedCharacterHits(characterId("kaeya"), 1, workspace);
      expect(runtimeResolved.blockers.some((entry) => entry.id === "kaeya-skill-hit")).toBe(true);
      expect(runtimeResolved.hits.some((entry) => entry.id === "kaeya-normal-1-hit-1")).toBe(true);
      const docs = getCharacterDocuments(characterId("kaeya"), 1, workspace);
      const blocked = docs.find((doc) => doc.gameContext?.skillId === "kaeya-skill")!;
      expect(calculateDocument(blocked)).toMatchObject({ status: "blocked", verification: "blocked" });
      expect(calculateDocument(blocked).totals).toBeUndefined();
      expect(calculateDocument(docs.find((doc) => doc.gameContext?.skillId === "kaeya-normal-1")!).status).toBe("calculated");
      expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(blocked))).status).toBe("blocked");
      expect(calculateDocument(getCharacterDocuments(characterId("kaeya"), 1).find((doc) => doc.gameContext?.skillId === "kaeya-skill")!).totals)
        .toEqual(calculateDocument(releasedSkill).totals);
      runtimeAbility.parameters.param1 = [...original];
      expect(calculateDocument(getCharacterDocuments(characterId("kaeya"), 1, workspace).find((doc) => doc.gameContext?.skillId === "kaeya-skill")!).totals)
        .toEqual(calculateDocument(releasedSkill).totals);
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
    expect(aether.some((doc) => doc.gameContext?.skillId === "aether-anemo-burst")).toBe(false);
    const burst = aether.find((doc) => doc.gameContext?.skillId === "traveler-cross-aether-anemo-burst-c0")!;
    expect(burst.gameContext).toMatchObject({ variantId: "aether-anemo", abilityId: "talent:traveleranemo:combat3", constellation: 0 });
    expect(calculateDocument(burst).status).toBe("blocked");
    expect(calculateDocument(burst).totals).toBeUndefined();
    burst.scope = "one-cast";
    burst.characterLevel = 90;
    burst.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    burst.build = { mode: "manual-final", stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, ascension: 6, source: "Synthetic actual unchanged Anemo Q panel" };
    burst.gameContext!.travelerCrossEntityCast = {
      casterId: "aether", targetId: "enemy", trueMoonStoryBuffInactive: true,
      freshCastConfirmed: true, noHitlag: true, noInterruption: true, noReplacement: true,
      fullObservedLifetime: true, observedThroughFrame: 363, statsStableAcrossHits: true,
      anemo: { noAbsorption: true },
      targetContacts: Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`tick-${index + 1}`, true])),
    };
    const burstResult = calculateDocument(burst);
    expect(burstResult.blockers).toEqual([]);
    expect(burstResult.status).toBe("calculated");
    expect(burstResult.hits).toHaveLength(9);
    expect(burstResult.totals!.nonCritical).toBeCloseTo(9 * 2000 * 1.4544 * .5 * .9, 10);
    const charge = aether.find((doc) => doc.gameContext?.skillId === "male-charged-aether-anemo-c0")!;
    expect(charge.gameContext).toMatchObject({ characterId: characterId("aether"), variantId: "aether-anemo", abilityId: "talent:traveleranemo:combat1", constellation: 0 });
    charge.scope = "one-cast";
    expect(calculateDocument(charge).status).toBe("blocked");
    charge.scope = "single-hit";
    charge.selectedHitIds = [charge.hits.find((hit) => hit.kind === "ordinary")!.id];
    expect(calculateDocument(charge).status).toBe("blocked");
    charge.gameContext!.travelerMaleChargedCast = { sharedState: { externalInfusionActive: false, trueMoonStoryBuffEnabled: false } };
    expect(calculateDocument(charge).status).toBe("calculated");
    const blockerIds = getClassifiedHitCoverage().travelerActionBlockers.map((entry) => entry.id);
    expect(blockerIds).not.toContain("aether-anemo-burst-blocked");
    expect(blockerIds).not.toContain("lumine-pyro-charged-base-blocked");
    expect(blockerIds).not.toContain("aether-cryo-unverified-actions-blocked");
    const cryo = aether.find((doc) => doc.gameContext?.skillId === "aether-cryo-burst-state-c0")!;
    expect(cryo.gameContext).toMatchObject({ variantId: "aether-cryo", abilityId: "talent:travelercryo:combat3", constellation: 0 });
    expect(calculateDocument(cryo).status).toBe("blocked");
    cryo.scope = "one-cast";
    cryo.characterLevel = 90;
    cryo.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    cryo.build = { mode: "manual-final", stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, ascension: 6, source: "Synthetic actual Cryo Q panel; nonExtra ATK independently declared below" };
    cryo.gameContext!.travelerCryoStateCast = {
      casterId: "aether", targetId: "enemy", trueMoonStoryBuffEnabled: false,
      freshCastConfirmed: true, noHitlag: true, noInterruption: true, noReplacement: true,
      fullObservedLifetime: true, observedThroughFrame: 80, statsStableAcrossHits: true,
      radianceAtBurst: "none", frostglowStacksAtBurst: 0,
      targetContacts: { "burst-1": true, "burst-2": true, "burst-3": true },
      sharedState: { nonExtraAtk: 2000, includedA4Em: 0 },
    };
    const cryoResult = calculateDocument(cryo);
    expect(cryoResult.blockers).toEqual([]);
    expect(cryoResult.hits).toHaveLength(3);
    expect(cryoResult.aggregation.scope).toBe("complete-cast");
    expect(cryoResult.status).toBe("calculated");
    expect(cryoResult.totals!.nonCritical).toBeCloseTo(3 * 2000 * .992358 * .5 * .9, 10);
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
    expect(iansan.some((doc) => doc.gameContext?.skillId === "iansan-swift-talent-unresolved")).toBe(false);
    const swift = iansan.find((doc) => doc.gameContext?.skillId === "iansan-swift-resolved-c0")!;
    expect(swift.gameContext).toMatchObject({ characterId: characterId("iansan"), abilityId: "talent:iansan:combat1", constellation: 0, effectiveTalentLevel: 10 });
    expect(calculateDocument(swift).status).toBe("blocked");
    expect(calculateDocument(swift).totals).toBeUndefined();
    swift.scope = "one-cast";
    swift.characterLevel = 90;
    swift.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    swift.build = { mode: "manual-final", stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, ascension: 6, source: "Synthetic actual25f panel without prior A1" };
    swift.gameContext!.iansanSwiftResolvedCast = {
      casterId: "iansan", targetId: "enemy", freshCastConfirmed: true, noHitlag: true,
      noInterruption: true, noReplacement: true, fullObservedLifetime: true, observedThroughFrame: 25,
      statsStableAcrossHits: true, inputKind: "charged", actionReadyConfirmed: true, groundedAtCast: true,
      fastSkillActiveAtCast: true, targetContacts: { swift: true },
      sharedState: { a1ActiveAtSnapshot: false, includedA1Attack: 0, burstInactiveAtSnapshot: true },
    };
    const swiftResult = calculateDocument(swift);
    expect(swiftResult.blockers).toEqual([]);
    expect(swiftResult.status).toBe("calculated");
    expect(swiftResult.hits).toHaveLength(1);
    expect(swiftResult.totals!.nonCritical).toBeCloseTo(2000 * 1.6643 * .5 * .9, 10);
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
