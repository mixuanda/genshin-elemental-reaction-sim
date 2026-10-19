import { describe, expect, it } from "vitest";
import { gameDataCatalog } from "../../game-data/src/catalog";
import { resolveClassifiedCharacterHits } from "../../game-data/src/classified-hits";
import { idleStanceTemplates } from "../../game-data/src/character-mappings/idle-stance-mappings";
import { observedEntityTemplates } from "../../game-data/src/character-mappings/observed-entity-mappings";
import { periodicOrdinaryTemplates } from "../../game-data/src/character-mappings/periodic-ordinary-mappings";
import { travelerMaleChargedTemplates } from "../../game-data/src/character-mappings/traveler-male-charged-mappings";
import { getCharacterDocuments } from "../../../apps/web/src/character-calculations";
import { calculateDocument, convertCalculatorToFinalPanel } from "./calculator";
import { observedEntityCastContextSchema, parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument, type CalculatorHit, type IdleStanceCastContext, type PeriodicOrdinaryCastContext, type TravelerMaleChargedCastContext } from "./calculator-model";
import { compileIdleStanceSchedule, type IdleStanceCastKind } from "./idle-stance-schedule";
import { compilePeriodicOrdinarySchedule, type PeriodicOrdinaryCastKind } from "./periodic-ordinary-schedule";
import { prepareSourceCastDocument } from "./source-cast-context";
import observedCases from "./fixtures/observed-entity-source-cases.json";

type OrdinaryHit = Extract<CalculatorHit, { kind: "ordinary" }>;
const common = {
  casterId: "caster", targetId: "enemy-1", freshCastConfirmed: true, noHitlag: true,
  noInterruption: true, noReplacement: true, fullObservedLifetime: true,
  observedThroughFrame: 2000, statsStableAcrossHits: true,
};

function documentFor(slug: string, skillId: string): CalculatorDocument {
  const character = gameDataCatalog.characters.find(row => row.slug === slug)!;
  const doc = getCharacterDocuments(character.id, 9).find(row => row.gameContext?.skillId === skillId)!;
  expect(doc, skillId).toBeDefined();
  doc.scope = "one-cast";
  doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 200, critRate: .5, critDamage: 1 }, source: "Explicit hypothetical source-permitted batch input" };
  doc.gameContext!.constellation = 0;
  doc.gameContext!.ascension = 6;
  return doc;
}

function roundtripAndConversion(doc: CalculatorDocument): void {
  const result = calculateDocument(doc), label = doc.gameContext!.skillId;
  expect(result.blockers, label).toEqual([]);
  expect(doc.gameContext!.scopeCoverage, label).toBe("complete-cast");
  expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(doc))), label).toEqual(result);
  expect(calculateDocument(prepareSourceCastDocument(doc)).totals, label).toEqual(result.totals);
  const final = convertCalculatorToFinalPanel(doc), converted = calculateDocument(final);
  expect(converted.blockers, label).toEqual([]);
  expect(converted.totals!.expected, label).toBeCloseTo(result.totals!.expected, 8);
  expect(calculateDocument(parseCalculatorDocument(serializeCalculatorDocument(final))).totals, label).toEqual(converted.totals);
}

/** An occurred last hit keeps only its actual local state; unrelated missing hits cannot poison it. */
function standalone(doc: CalculatorDocument, minimal: (single: CalculatorDocument, last: OrdinaryHit) => void): void {
  const expected = calculateDocument(doc).hits.at(-1)!.expected!;
  const single = structuredClone(doc), last = single.hits.at(-1)! as OrdinaryHit;
  single.scope = "single-hit";
  single.selectedHitIds = [last.id];
  minimal(single, last);
  single.hits.push({ id: "unselected-missing-observation", kind: "blocked", label: "Unselected unknown history", reasons: ["Unrelated future observation is deliberately absent"], sourceRefs: [], dependencies: [] });
  const result = calculateDocument(single);
  expect(result.blockers, doc.gameContext!.skillId).toEqual([]);
  expect(result.hits, doc.gameContext!.skillId).toHaveLength(1);
  expect(result.totals!.expected, doc.gameContext!.skillId).toBeCloseTo(expected, 8);
}

function idleContext(kind: IdleStanceCastKind): IdleStanceCastContext {
  const context: IdleStanceCastContext = {
    ...common, followupActions: [],
    sharedState: { includedDamageBonus: 0, includedResistanceReduction: 0, scalingHp: 20000, scalingEm: 200, scalingStatMatchesPanel: true, yanfeiA1Seals: 0, chioriA4Active: false },
    razor: { hexerei: false },
    zhongli: { noOtherGeoConstructs: true, steleSurvives: true, shieldUnbroken: true, insideShieldRadius: true },
    tartaglia: { startsFromIdle: true, noRiptideOrProjectiles: true }, yanfei: { priorA1Inactive: true },
    ayato: { illusionDelay: 35 }, nilou: { noPriorBounty: true },
    wanderer: { noAbsorption: true, panelExcludesAbsorptionBonuses: true },
    alhaitham: { hold: false, initialMirrors: 0 }, mika: { eligibleOtherEnemyCount: 0, initialTargetIsEnemy: true },
    kaveh: { noDendroCores: true, initialCreatesNoDendroCore: true },
    gaming: { manChaiReturnDelay: 100, noPriorManChai: true },
    chiori: { hold: false, noGeoConstructs: true, priorA4Inactive: true },
  };
  if (kind === "idle-wanderer-skill-c0") context.followupActions = [{ id: "end", frame: 60, actorId: "caster", kind: "terminate-skill" }];
  // Contacts are explicit test observations. Independent expected frames below are the oracle.
  context.targetContacts = Object.fromEntries(compileIdleStanceSchedule(kind, context).candidates.map(hit => [hit.id, true]));
  return context;
}

describe("one thirty-action lifecycle source batch", () => {
  it("closes twelve declared idle branches and keeps an occurred hit independent of future stance records", () => {
    const expectedFrames: Record<string, number[]> = {
      "idle-razor-burst-c0": [32], "idle-zhongli-hold-skill-c0": [48, 48, ...Array.from({ length: 15 }, (_, i) => 168 + 120 * i)],
      "idle-tartaglia-skill-c0": [16], "idle-yanfei-burst-c0": [24], "idle-ayato-skill-c0": [35],
      "idle-nilou-skill-c0": [16], "idle-wanderer-skill-c0": [2], "idle-alhaitham-skill-c0": [19],
      "idle-mika-hold-skill-c0": [15], "idle-kaveh-burst-c0": [36], "idle-gaming-burst-c0": [60],
      "idle-chiori-skill-c0": [21, 60, 276, 492, 708, 924],
    };
    expect(idleStanceTemplates).toHaveLength(12);
    for (const cast of idleStanceTemplates) {
      const doc = documentFor(cast.characterSlug, cast.skillId);
      doc.gameContext!.idleStanceCast = idleContext(cast.skillId as IdleStanceCastKind);
      const prepared = prepareSourceCastDocument(doc);
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.idleStanceEvent?.frame : undefined), cast.skillId).toEqual(expectedFrames[cast.skillId]);
      if (cast.characterSlug === "zhongli") roundtripAndConversion(prepared);
      if (cast.characterSlug === "zhongli") standalone(prepared, (single) => {
        const original = single.gameContext!.idleStanceCast!;
        single.gameContext!.idleStanceCast = { sharedState: { ...original.sharedState, zhongliShieldReductionActive: false }, wanderer: original.wanderer, yanfei: original.yanfei };
      });
    }
    const unknown = documentFor("chiori", "idle-chiori-skill-c0");
    unknown.gameContext!.idleStanceCast = idleContext("idle-chiori-skill-c0");
    delete unknown.gameContext!.idleStanceCast.targetContacts;
    expect(calculateDocument(unknown).blockers.length).toBeGreaterThan(0);
  });

  it("retains observed random, entity and HP sampling facts across seven complete lifetimes without requiring a team for one hit", () => {
    const originalObservedTemplates = observedEntityTemplates.filter(cast => cast.skillId in observedCases.contexts);
    expect(originalObservedTemplates).toHaveLength(7);
    const expectedCounts: Record<string, number> = { "observed-klee-burst-c0": 18, "observed-kamisatoayato-burst-c0": 12, "observed-layla-skill-c0": 5, "observed-yaoyao-burst-c0": 11, "observed-furina-skill-ousia-c0": 33, "observed-emilie-skill-c0": 31, "observed-emilie-burst-c0": 32 };
    for (const cast of originalObservedTemplates) {
      const doc = documentFor(cast.characterSlug, cast.skillId);
      const fixture = observedCases.contexts[cast.skillId as keyof typeof observedCases.contexts];
      doc.gameContext!.observedEntityCast = observedEntityCastContextSchema.parse(fixture);
      const prepared = prepareSourceCastDocument(doc);
      expect(prepared.hits, cast.skillId).toHaveLength(expectedCounts[cast.skillId]!);
      if (cast.characterSlug === "furina") roundtripAndConversion(prepared);
      if (cast.characterSlug === "furina") standalone(prepared, (single, last) => {
        const original = single.gameContext!.observedEntityCast!, event = last.observedEntityEvent!;
        const state = { ...original.sharedState, ...original.hitStates?.[last.id] };
        if (event.furinaPartyMembersAboveHalf !== undefined) state.furinaPartyMembersAboveHalf = event.furinaPartyMembersAboveHalf;
        if (event.scalingFrame !== undefined && original.furina?.maxHPByScalingFrame?.[String(event.scalingFrame)] !== undefined) state.actualMaxHPAtScaling = original.furina.maxHPByScalingFrame[String(event.scalingFrame)];
        if (event.a4RefreshFrame !== undefined) state.furinaA4MaxHPAtLastRefresh = original.furina?.a4MaxHPByRefreshFrame?.[String(event.a4RefreshFrame)];
        single.gameContext!.observedEntityCast = { sharedState: state, skillTalentLevel: original.skillTalentLevel };
      });
      if (cast.characterSlug === "emilie") {
        const a1 = prepared.hits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary" && hit.observedEntityEvent?.templateRole === "a1");
        expect(a1).toHaveLength(3);
        expect(a1.every(hit => hit.terms[0]?.coefficient === 6)).toBe(true);
      }
      if (cast.characterSlug === "furina") {
        const unknown = structuredClone(prepared);
        delete unknown.gameContext!.observedEntityCast!.furina;
        expect(calculateDocument(unknown).blockers.length).toBeGreaterThan(0);
      }
    }
  });

  it("closes four ordinary periodic schedules using actual contacts, observed bullet order and source passive accounting", () => {
    expect(periodicOrdinaryTemplates).toHaveLength(4);
    for (const cast of periodicOrdinaryTemplates) {
      const doc = documentFor(cast.characterSlug, cast.skillId);
      const context: PeriodicOrdinaryCastContext = {
        ...common, sharedState: { includedDamageBonus: 0, includedResistanceReduction: 0, ineffaA4Inactive: true, columbinaA1Inactive: true },
        ineffa: { noLunarChargedField: true, burstInactive: true }, columbina: { noLunarEvents: true, noPriorGravityOrA1: true },
        lauma: { noPriorShred: true, initializationEm: 50 },
        chasca: { onlyOneEnemy: true, nightsoulInactive: true, noNightsoulBurst: true, partyElements: ["pyro", "hydro"], bulletElements: ["hydro", "pyro", "pyro", "hydro", "anemo", "anemo"] },
      };
      context.targetContacts = Object.fromEntries(compilePeriodicOrdinarySchedule(cast.skillId as PeriodicOrdinaryCastKind, context).candidates.map(hit => [hit.id, true]));
      doc.gameContext!.periodicOrdinaryCast = context;
      const prepared = prepareSourceCastDocument(doc);
      const frames = cast.characterSlug === "ineffa" ? [26, ...Array.from({ length: 10 }, (_, i) => 110 + 119 * i)]
        : cast.characterSlug === "columbina" ? [21, ...Array.from({ length: 12 }, (_, i) => 138 + 117 * i)]
          : cast.characterSlug === "lauma" ? [16, ...Array.from({ length: 8 }, (_, i) => 62 + 117 * i)] : [96, 103, 139, 147, 153, 157, 160];
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.periodicOrdinaryEvent?.frame : undefined), cast.skillId).toEqual(frames);
      if (cast.characterSlug === "lauma") roundtripAndConversion(prepared);
      if (cast.characterSlug === "lauma") standalone(prepared, (single, last) => { single.gameContext!.periodicOrdinaryCast = { sharedState: { ...context.sharedState, laumaOwnShredActive: last.periodicOrdinaryEvent?.laumaOwnShredActive }, lauma: { initializationEm: 50 } }; });
      if (cast.characterSlug === "lauma") {
        expect(calculateDocument(prepared).hits.map(hit => hit.trace.find(node => node.id === "customDamageBonus")!.result!.value)).toEqual(Array(9).fill(.2));
        expect((prepared.hits[0] as OrdinaryHit).periodicOrdinaryEvent?.laumaOwnShredActive).toBe(false);
        expect((prepared.hits[1] as OrdinaryHit).periodicOrdinaryEvent?.laumaOwnShredActive).toBe(true);
        context.targetContacts.initial = false;
        const firstActual = prepareSourceCastDocument(doc).hits[0] as OrdinaryHit;
        expect(firstActual.periodicOrdinaryEvent?.frame).toBe(62);
        expect(firstActual.periodicOrdinaryEvent?.laumaOwnShredActive).toBe(false);
      }
      if (cast.characterSlug === "chasca") {
        expect(prepared.hits.filter((hit): hit is OrdinaryHit => hit.kind === "ordinary").map(hit => hit.element)).toEqual(["anemo", "hydro", "pyro", "pyro", "hydro", "anemo", "anemo"]);
        context.chasca!.bulletElements![0] = "cryo";
        expect(calculateDocument(doc).blockers.length).toBeGreaterThan(0);
      }
    }
  });

  it("resolves seven male-specific two-hit charged attacks while preserving the separate catalog and physical-hit conditions", () => {
    expect(travelerMaleChargedTemplates).toHaveLength(7);
    for (const cast of travelerMaleChargedTemplates) {
      const doc = documentFor("aether", cast.skillId);
      const context: TravelerMaleChargedCastContext = {
        ...common, precedingNormalAttackConfirmed: true, normalCounterBeforeCast: 1, actionReadyConfirmed: true, initialStamina: 20, staminaCostMultiplier: 1,
        targetContacts: { "hit-1": true, "hit-2": true },
        sharedState: { externalInfusionActive: false, trueMoonStoryBuffEnabled: false, cryoSkillActive: false, cryoRadiance: "none", cryoTrueMoonStacks: 0 },
      };
      doc.gameContext!.travelerMaleChargedCast = context;
      const prepared = prepareSourceCastDocument(doc);
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.travelerMaleChargedEvent?.frame : undefined), cast.skillId).toEqual([9, 20]);
      expect((prepared.hits[1] as OrdinaryHit).terms[0]!.coefficient).toBe(1.11548);
      if (cast.element === "cryo") roundtripAndConversion(prepared);
      if (cast.element === "cryo") standalone(prepared, single => { single.gameContext!.travelerMaleChargedCast = { sharedState: context.sharedState }; });
      delete context.precedingNormalAttackConfirmed;
      expect(calculateDocument(doc).blockers.length, cast.skillId).toBeGreaterThan(0);
      const current = resolveClassifiedCharacterHits("character:10000005", 9);
      expect(current.blockers.some(row => row.skillId === cast.skillId), cast.skillId).toBe(false);
    }
  });
});
