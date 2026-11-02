import { describe, expect, it } from "vitest";
import { getCharacterDocuments } from "../../../apps/web/src/character-calculations";
import { calculateDocument, parseCalculatorDocument, serializeCalculatorDocument } from "../../sim-core/src/calculator";
import { prepareSourceCastDocument } from "../../sim-core/src/source-cast-context";
import type { CalculatorDocument } from "../../sim-core/src/calculator-model";
import { gameDataCatalog, findTalentSetById } from "./catalog";
import { travelerCrossSourceTemplates } from "./character-mappings/traveler-cross-source-mappings";
import { iansanSwiftResolvedTemplates } from "./character-mappings/iansan-swift-resolved-mappings";

const OPTIMIZER = "180a0a1015cb725c7570cd828eb086749960df98";
const BEHAVIOR = "a7dc4bf4f5e18390035ca0333fb6eb1d5fac32bd";
function documentFor(slug: string, skillId: string, level: number): CalculatorDocument {
  const character = gameDataCatalog.characters.find(row => row.slug === slug);
  if (!character) throw new Error(`Missing existing catalog identity ${slug}`);
  const document = getCharacterDocuments(character.id, level).find(row => row.gameContext?.skillId === skillId);
  if (!document) throw new Error(`Missing current action ${skillId}`);
  document.scope = "one-cast";
  document.characterLevel = 90;
  document.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  document.build = { mode: "manual-final", stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, ascension: 6, source: "Declared synthetic actual panel; no weapon, team or extra damage bonus" };
  return document;
}
function anemo(gender: "aether" | "lumine"): CalculatorDocument {
  const document = documentFor(gender, `traveler-cross-${gender}-anemo-burst-c0`, 1);
  document.gameContext!.travelerCrossEntityCast = {
    casterId: gender, targetId: "enemy", trueMoonStoryBuffInactive: true,
    freshCastConfirmed: true, noHitlag: true, noInterruption: true, noReplacement: true,
    fullObservedLifetime: true, observedThroughFrame: 363, statsStableAcrossHits: true,
    anemo: { noAbsorption: true },
    targetContacts: Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`tick-${index + 1}`, index !== 1])),
  };
  return document;
}
function swift(): CalculatorDocument {
  const document = documentFor("iansan", "iansan-swift-resolved-c0", 1);
  document.gameContext!.iansanSwiftResolvedCast = {
    casterId: "iansan", targetId: "enemy", freshCastConfirmed: true, noHitlag: true,
    noInterruption: true, noReplacement: true, fullObservedLifetime: true, observedThroughFrame: 25,
    statsStableAcrossHits: true, inputKind: "charged", actionReadyConfirmed: true, groundedAtCast: true,
    fastSkillActiveAtCast: true, initialStamina: 0, targetContacts: { swift: true },
    sharedState: { a1ActiveAtSnapshot: false, includedA1Attack: 0, burstInactiveAtSnapshot: true },
  };
  return document;
}
function ready(document: CalculatorDocument) {
  const prepared = prepareSourceCastDocument(document), result = calculateDocument(prepared);
  expect(result.blockers).toEqual([]);
  expect(result.status).toBe("calculated");
  expect(result.verification).toBe("provisional");
  expect(prepared.gameContext!.scopeCoverage).toBe("complete-cast");
  return { prepared, result };
}
function blocked(document: CalculatorDocument): void {
  const result = calculateDocument(document);
  expect(result.status).toBe("blocked");
  expect(result.totals).toBeUndefined();
}

describe("current classified identity replacements", () => {
  it.each(["aether", "lumine"] as const)("keeps %s Anemo identity, exact source coefficients and an actual miss through JSON", gender => {
    const document = anemo(gender), skillId = document.gameContext!.skillId;
    const template = travelerCrossSourceTemplates.find(row => row.skillId === skillId)!;
    expect(template).toMatchObject({ characterSlug: gender, variantId: `${gender}-anemo`, element: "anemo", abilityKey: "combat3", sourceCommit: OPTIMIZER, behaviorSourceCommit: BEHAVIOR });
    const ability = findTalentSetById("talent-set:traveleranemo")!.abilities.find(row => row.key === "combat3")!;
    expect(template.roles.tick.sourceValues).toHaveLength(15);
    expect(template.roles.tick.sourceValues).toEqual(ability.parameters.param1);
    expect(template.roles.tick.sourceValues[0]).toBe(.808);
    expect(template.roles.tick.sourceValues[9]).toBe(1.4544);
    expect(template.roles.tick.sourceValues).not.toEqual(template.roles.tick.gcsimValues);
    const { prepared, result } = ready(document);
    expect(prepared.gameContext).toMatchObject({ characterId: gameDataCatalog.characters.find(row => row.slug === gender)!.id, variantId: `${gender}-anemo`, abilityId: "talent:traveleranemo:combat3", constellation: 0, effectiveTalentLevel: 1 });
    expect(prepared.hits).toHaveLength(8); // tick-2 is explicitly false; nine opportunities are not nine guaranteed hits.
    expect(prepared.hits.map(hit => {
      if (hit.kind !== "ordinary") throw new Error("Expected the admitted Anemo hits");
      expect(hit.element).toBe("anemo");
      expect(hit.attackTag).toBe("burst");
      expect(hit.terms).toEqual([{ stat: "atk", coefficient: .808 }]);
      expect(hit.sourceRefs.some(ref => ref.includes(`/blob/${OPTIMIZER}/`))).toBe(true);
      expect(hit.sourceRefs.some(ref => ref.includes(`/blob/${BEHAVIOR}/`))).toBe(true);
      return [hit.travelerCrossEntityEvent!.frame, hit.travelerCrossEntityEvent!.snapshotFrame];
    })).toEqual([94, 154, 184, 214, 244, 274, 304, 334].map(frame => [frame, 0]));
    expect(result.totals!.nonCritical).toBeCloseTo(8 * 2000 * .808 * .5 * .9, 10);
    expect(result.totals!.expected).toBeCloseTo(8726.4, 10);
    const restored = parseCalculatorDocument(serializeCalculatorDocument(document));
    expect(restored.gameContext!.travelerCrossEntityCast!.targetContacts!["tick-2"]).toBe(false);
    expect(calculateDocument(restored).totals).toEqual(result.totals);
  });

  it("requires actual Anemo branch, observation, contact and snapshot conditions rather than treating missing values as false or true", () => {
    const good = anemo("aether");
    const missingStory = structuredClone(good); delete missingStory.gameContext!.travelerCrossEntityCast!.trueMoonStoryBuffInactive;
    const activeStory = structuredClone(good); activeStory.gameContext!.travelerCrossEntityCast!.trueMoonStoryBuffInactive = false;
    const absorbed = structuredClone(good); absorbed.gameContext!.travelerCrossEntityCast!.anemo!.noAbsorption = false;
    const unknownContact = structuredClone(good); delete unknownContact.gameContext!.travelerCrossEntityCast!.targetContacts!["tick-2"];
    const unfinished = structuredClone(good); unfinished.gameContext!.travelerCrossEntityCast!.observedThroughFrame = 362;
    const changingPanel = structuredClone(good); changingPanel.gameContext!.travelerCrossEntityCast!.statsStableAcrossHits = false;
    const higherConstellation = structuredClone(good); higherConstellation.gameContext!.constellation = 1;
    for (const document of [missingStory, activeStory, absorbed, unknownContact, unfinished, changingPanel]) blocked(document);
    // C1 changes the skill, not this no-absorption burst; the public Anemo
    // route now explicitly supports C0-C6 without weakening unknown inputs.
    expect(calculateDocument(higherConstellation).status).toBe("calculated");
    expect(calculateDocument(higherConstellation).totals).toEqual(calculateDocument(good).totals);
    const restored = parseCalculatorDocument(serializeCalculatorDocument(missingStory));
    expect(restored.gameContext!.travelerCrossEntityCast).not.toHaveProperty("trueMoonStoryBuffInactive");
    blocked(restored);
  });

  it("binds Swift to NA1, samples only prior A1 and never adds the same known panel share twice", () => {
    const document = swift(), template = iansanSwiftResolvedTemplates[0]!;
    expect(template).toMatchObject({ skillId: "iansan-swift-resolved-c0", abilityKey: "combat1", element: "electro", sourceCommit: OPTIMIZER, behaviorSourceCommit: BEHAVIOR });
    expect(template.roles.swift.sourceValues).toHaveLength(15);
    expect(template.roles.swift.sourceValues).toEqual(findTalentSetById("talent-set:iansan")!.abilities.find(row => row.key === "combat1")!.parameters.param5);
    expect(template.roles.swift.sourceValues[0]).toBe(.84194);
    expect(template.roles.swift.sourceValues[9]).toBe(1.6643);
    const base = ready(document);
    expect(base.prepared.gameContext).toMatchObject({ characterId: "character:10000110", abilityId: "talent:iansan:combat1", effectiveTalentLevel: 1, constellation: 0 });
    expect(base.prepared.hits).toHaveLength(1);
    expect(base.prepared.hits[0]).toMatchObject({ element: "electro", attackTag: "charged", terms: [{ stat: "atk", coefficient: .84194 }], iansanSwiftResolvedEvent: { frame: 25, snapshotFrame: 25, swiftQualifiedAtCast: true } });
    expect(base.result.totals!.nonCritical).toBeCloseTo(757.746, 10);
    const priorA1 = structuredClone(document);
    priorA1.gameContext!.iansanSwiftResolvedCast!.sharedState = { a1ActiveAtSnapshot: true, includedA1Attack: 0, baseAttack: 800, burstInactiveAtSnapshot: true };
    const added = ready(priorA1).result;
    expect(added.totals!.nonCritical).toBeCloseTo((2000 + .2 * 800) * .84194 * .5 * .9, 10);
    const alreadyIncluded = structuredClone(priorA1);
    if (alreadyIncluded.build.mode !== "manual-final") throw new Error("Expected the explicit final-panel case");
    alreadyIncluded.build.stats.atk = 2160;
    alreadyIncluded.gameContext!.iansanSwiftResolvedCast!.sharedState!.includedA1Attack = 160;
    expect(ready(alreadyIncluded).result.totals).toEqual(added.totals);
    expect(ready(parseCalculatorDocument(serializeCalculatorDocument(alreadyIncluded))).result.totals).toEqual(added.totals);
  });

  it("keeps unknown Swift state, wrong talent, Q feedback and unfunded slow charged inputs blocked", () => {
    const good = swift();
    const unknownFast = structuredClone(good); delete unknownFast.gameContext!.iansanSwiftResolvedCast!.fastSkillActiveAtCast;
    const normalOutsideFast = structuredClone(good); Object.assign(normalOutsideFast.gameContext!.iansanSwiftResolvedCast!, { inputKind: "normal", fastSkillActiveAtCast: false, nightsoulBlessingAtCast: true });
    const unknownA1 = structuredClone(good); delete unknownA1.gameContext!.iansanSwiftResolvedCast!.sharedState!.a1ActiveAtSnapshot;
    const unknownIncluded = structuredClone(good); delete unknownIncluded.gameContext!.iansanSwiftResolvedCast!.sharedState!.includedA1Attack;
    const activeQ = structuredClone(good); activeQ.gameContext!.iansanSwiftResolvedCast!.sharedState!.burstInactiveAtSnapshot = false;
    const wrongTalent = structuredClone(good); wrongTalent.gameContext!.abilityId = "talent:iansan:combat2";
    const unknownContact = structuredClone(good); delete unknownContact.gameContext!.iansanSwiftResolvedCast!.targetContacts!.swift;
    const slow = structuredClone(good); Object.assign(slow.gameContext!.iansanSwiftResolvedCast!, { fastSkillActiveAtCast: false, nightsoulBlessingAtCast: true, precedingNormalAttackConfirmed: true, normalCounterBeforeCast: 1, initialStamina: 24, staminaCostMultiplier: 1 });
    for (const document of [unknownFast, normalOutsideFast, unknownA1, unknownIncluded, activeQ, wrongTalent, unknownContact, slow]) blocked(document);
    slow.gameContext!.iansanSwiftResolvedCast!.initialStamina = 25;
    expect(ready(slow).result.totals!.nonCritical).toBeCloseTo(757.746, 10);
    const restored = parseCalculatorDocument(serializeCalculatorDocument(unknownA1));
    expect(restored.gameContext!.iansanSwiftResolvedCast!.sharedState).not.toHaveProperty("a1ActiveAtSnapshot");
    blocked(restored);
  });
});
