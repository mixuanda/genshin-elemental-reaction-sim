import { expect, it } from "vitest";
import { gameDataCatalog } from "../../game-data/src/catalog";
import { sourceClassifiedMappings } from "../../game-data/src/classified-hits";
import { calculateDocument, convertCalculatorToFinalPanel } from "./calculator";
import {
  parseCalculatorDocument, serializeCalculatorDocument,
  type CalculatorDocument, type CalculatorFinalSnapshot, type CalculatorFinalStats,
} from "./calculator-model";
import { expr } from "./calculation-trace";
import { prepareSourceCastDocument } from "./source-cast-context";

const neutral: CalculatorFinalStats = { atk: 1000, hp: 20000, def: 1000, em: 0, critRate: 0, critDamage: 0 };

function documentFor(skillId: string, ascension = 3): CalculatorDocument {
  const mapping = sourceClassifiedMappings.find(row => row.skillId === skillId);
  if (!mapping) throw new Error(`Missing source registry entry: ${skillId}`);
  const sourceRefs = mapping.sourcePaths.map(path =>
    `https://github.com/${mapping.sourceRepository}/blob/${mapping.sourceCommit}/${path}`);
  return {
    schemaVersion: "1.0.0", ruleVersion: "ordinary-trace-v1", id: skillId, label: skillId,
    scope: "one-cast", characterLevel: 90,
    build: { mode: "manual-final", stats: { ...neutral }, ascension, source: "Explicit hypothetical source-protocol input" },
    enemy: { level: 90, resistance: 0, defenseAdjustment: 0, defenseIgnore: 0 },
    gameContext: {
      characterId: gameDataCatalog.characters.find(row => row.slug === mapping.characterSlug)!.id, characterName: mapping.characterSlug,
      abilityId: `${mapping.talentSetId.replace("talent-set:", "talent:")}:${mapping.abilityKey}`, skillId,
      skillName: mapping.skillLabel ?? skillId,
      ...(mapping.variantId ? { variantId: mapping.variantId } : {}),
      effectiveTalentLevel: 1, ascension, constellation: 0,
      scopeCoverage: "selected-components", attributionPolicy: "Only explicitly observed source-protocol damage",
    },
    hits: [{
      id: mapping.id, label: mapping.hitLabel, kind: "ordinary", element: mapping.element,
      attackTag: mapping.attackTag, terms: [{ stat: mapping.scalingStat, coefficient: mapping.sourceCoefficientValues![0]! }],
      additiveBaseDamage: 0, damageBonus: 0, critEligible: true, reaction: "none", reactionBonus: 0,
      groupMultiplier: 1, sourceRefs, dependencies: [],
    }],
    selectedHitIds: [mapping.id], assumptions: ["Synthetic observations and panels; not an in-game measurement."], dependencies: [],
    dataIdentity: { datasetId: "synthetic-traveler-zibai-source-protocol", gameVersion: "synthetic", releaseStatus: "synthetic", evidenceStatus: "synthetic" },
  };
}

function snapshot(stats: CalculatorFinalStats, ascension: number): CalculatorFinalSnapshot {
  return {
    stats, characterLevel: 90, ascension, damageBonus: 0, additiveBaseDamage: 0, reactionBonus: 0,
    source: "Explicit hypothetical historical panel, separate from the current build",
    sourceRefs: ["synthetic:declared-historical-panel"],
  };
}

function complete(document: CalculatorDocument) {
  const prepared = prepareSourceCastDocument(document), result = calculateDocument(prepared);
  expect(result.blockers, document.gameContext!.skillId).toEqual([]);
  expect(prepared.gameContext!.scopeCoverage).toBe("complete-cast");
  return { prepared, result };
}

// One focused acceptance gate: three source protocols, no simulator or character matrix.
it("executes cryo callbacks, cross-source traveler snapshots and finite Zibai damage through the same calculator core", () => {
  const cryo = documentFor("aether-cryo-skill-state-c0");
  const cryoContacts = ["initial", "coordinated:n171", "coordinated:n184", "periodic-2-1", "periodic-2-2", "periodic-3-1", "periodic-3-2", "periodic-4-1", "periodic-4-2"];
  cryo.gameContext!.travelerCryoStateCast = {
    casterId: "aether", targetId: "enemy-0", freshCastConfirmed: true, noHitlag: true,
    noInterruption: true, noReplacement: true, fullObservedLifetime: true, observedThroughFrame: 740,
    statsStableAcrossHits: true, trueMoonStoryBuffEnabled: false,
    radianceHistoryComplete: true, initialRadiance: "none",
    radianceChanges: [{ id: "enter", frame: 170, radiance: "stellar-conduct" }, { id: "leave", frame: 190, radiance: "none" }],
    callbacksComplete: true,
    triggerCallbacks: [171, 183, 184].map(frame => ({
      id: `n${frame}`, frame, actorId: "aether", targetId: "enemy-0", attackTag: "normal",
      evidence: { kind: "external-execution", reference: "Explicit synthetic observed callback fixture, not measured gameplay", legalActionConfirmed: true, actualEnemyHitConfirmed: true },
    })),
    targetContacts: Object.fromEntries(cryoContacts.map(id => [id, true])),
  };
  const a = complete(cryo);
  expect(a.prepared.hits.map(hit => hit.kind === "ordinary" ? [hit.travelerCryoStateEvent?.candidateId, hit.travelerCryoStateEvent?.snapshotFrame, hit.travelerCryoStateEvent?.frame] : null)).toEqual([
    ["initial", 19, 19], ["periodic-2-1", 354, 363], ["periodic-2-2", 367, 376],
    ["periodic-3-1", 530, 539], ["periodic-3-2", 543, 552], ["periodic-4-1", 706, 715], ["periodic-4-2", 719, 728],
    ["coordinated:n171", 174, 183], ["coordinated:n184", 187, 196],
  ]);
  // Fixed a7dc4bf source: initial .9168 + eight crystals .21392.
  // Callback 183 is exactly 12 frames after 171, so it contributes no crystal.
  expect(a.result.totals!.expected).toBeCloseTo(1000 * (.9168 + 8 * .21392) * .5, 8);

  const independent = documentFor("aether-cryo-burst-state-c0");
  independent.scope = "single-hit";
  independent.build = { mode: "manual-final", stats: { ...neutral, atk: 4000 }, ascension: 3, source: "Current panel is deliberately different from the recorded Q snapshot" };
  independent.gameContext!.travelerCryoStateCast = {
    casterId: "aether", targetId: "enemy-0", noHitlag: true, trueMoonStoryBuffEnabled: false,
    independentEvent: { candidateId: "burst-1", templateRole: "burst-conduct", frame: 42, snapshotFrame: 36, snapshotId: "snapshot-36", targetId: "enemy-0", radiance: "stellar-conduct", frostglowStacks: 8 },
    snapshots: { "snapshot-36": snapshot({ ...neutral }, 3) },
    sharedState: { impactAtk: 2000, otherSpecialBaseBonus: 0, otherReactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1, polestarApplicationCount: 12 },
  };
  independent.hits.push({ id: "unselected-future", kind: "blocked", label: "Unobserved future", reasons: ["Future callbacks are intentionally absent"], sourceRefs: [], dependencies: [] });
  const special = calculateDocument(independent);
  expect(special.blockers).toEqual([]);
  expect(special.hits).toHaveLength(1);
  // Direct stellar-conduct has no ordinary DEF multiplier; ATK freezes at 36f,
  // while the separate hit-time ATK produces the capped 7% intrinsic base bonus.
  expect(special.totals!.expected).toBeCloseTo(1000 * (.36754 + 8 * .018377) * 2 * 1.07, 8);
  const sourceStage = special.hits[0]!.trace.find(node => node.id === "traveler-cryo-state:impact-base-bonus")!;
  expect(sourceStage.result!.value).toBeCloseTo(.07, 12);
  expect(sourceStage.inputs.find(input => input.key === "impactAtk")).toMatchObject({ value: 2000 });
  expect(sourceStage.symbolicFormula).not.toBe("");
  expect(sourceStage.substitution).not.toBe("");
  expect(sourceStage.explanationKey).not.toBe("");

  // Lv14 is intentionally away from the Lv1 defaults. Anemo uses the resolved
  // Optimizer/catalog 1.818 coefficient, not the retained conflicting .846 vector.
  for (const element of ["anemo", "dendro"] as const) {
    const skillId = `traveler-cross-lumine-${element}-burst-c0`, dendro = element === "dendro";
    const cross = documentFor(skillId, 6), count = dendro ? 8 : 9, snapshotFrame = dendro ? 54 : 0;
    cross.gameContext!.effectiveTalentLevel = 14;
    cross.enemy.resistance = .1;
    cross.build = { mode: "manual-final", stats: { ...neutral, atk: 5000, em: 900, critRate: 1, critDamage: 2 }, ascension: 6, source: "Current panel is not the historical entity snapshot" };
    cross.gameContext!.travelerCrossEntityCast = {
      casterId: "lumine", targetId: "enemy-0", trueMoonStoryBuffInactive: true,
      freshCastConfirmed: true, noHitlag: true, noInterruption: true, noReplacement: true,
      fullObservedLifetime: true, observedThroughFrame: dendro ? 816 : 363, statsStableAcrossHits: false,
      ...(dendro ? { dendro: { noTransformation: true, noGadgetRemoval: true } } : { anemo: { noAbsorption: true } }),
      targetContacts: Object.fromEntries(Array.from({ length: count }, (_, index) => [`tick-${index + 1}`, true])),
      snapshots: { [`snapshot-${snapshotFrame}`]: snapshot({ ...neutral, atk: 2000, em: 50, critRate: .5, critDamage: 1 }, 6) },
      ...(dendro ? { sharedState: { actualEm: 200, actualEmIncludesLotuslight: true, includedA4DamageBonus: 0 }, hitStates: { [`${skillId}:tick-2`]: { actualEm: 300 } } } : {}),
    };
    const b = complete(cross);
    expect(b.prepared.hits).toHaveLength(count);
    expect(b.prepared.hits.map(hit => hit.kind === "ordinary" ? [hit.travelerCrossEntityEvent?.frame, hit.travelerCrossEntityEvent?.snapshotFrame, hit.terms[0]!.coefficient] : null)).toEqual(
      Array.from({ length: count }, (_, index) => [dendro ? 91 + 90 * index : 94 + 30 * index, snapshotFrame, dendro ? 1.8036 : 1.818]),
    );
    const oracle = dendro ? 2000 * 1.8036 * .5 * .9 * 1.5 * (7 * 1.2 + 1.3) : 9 * 2000 * 1.818 * .5 * .9 * 1.5;
    expect(b.result.totals!.expected).toBeCloseTo(oracle, 8);
    if (dendro) expect(b.result.hits[1]!.expected).toBeCloseTo(2000 * 1.8036 * .5 * .9 * 1.5 * 1.3, 8);
  }

  const observations = [
    { candidateId: "first", templateRole: "ordinary" as const, frame: 10, snapshotFrame: 10, snapshotId: "first", targetId: "enemy-0" },
    { candidateId: "second", templateRole: "lunar" as const, frame: 20, snapshotFrame: 20, snapshotId: "second", targetId: "enemy-0" },
  ];
  const sharedState = { a1WindowActive: true, specialBaseBonus: 0, includedIntrinsicBaseBonus: 0, reactionBonus: 0, specialAdditive: 0, includedA1Additive: 0, elevationMultiplier: 1 };
  for (const ability of ["spirit-steed", "burst"] as const) {
    const zibai = documentFor(`zibai-finite-${ability}-c0`, 1);
    zibai.gameContext!.zibaiFiniteCast = {
      casterId: "zibai", targetId: "enemy-0", legalCastConfirmed: true,
      ...(ability === "spirit-steed" ? { spiritSteedRecastConfirmed: true } : {}),
      fullObservedLifetime: true, observedThroughFrame: 20, statsStableAcrossHits: true,
      // These are declared synthetic observations, not certified animation frames.
      observations, targetContacts: { first: true, second: true },
      sharedState: { ...sharedState, ...(ability === "burst" ? { includedA1Additive: 999 } : {}) },
    };
    const c = complete(zibai);
    expect(c.prepared.hits.map(hit => hit.kind)).toEqual(["ordinary", "special"]);
    expect(c.result.hits[0]!.expected).toBeCloseTo(ability === "spirit-steed" ? 862.64 : 634.8, 8);
    expect(c.result.hits[1]!.expected).toBeCloseTo(ability === "spirit-steed" ? 2413.37216 + 600 : 3042.97728, 8);
    const a1 = c.result.hits[1]!.trace.find(node => node.id === "zibai.a1Additive")!;
    expect(a1.result!.value).toBe(ability === "spirit-steed" ? 600 : 0);
    if (ability === "burst") expect(a1.status).toBe("not-applicable");
  }

  const gear = documentFor("zibai-finite-spirit-steed-c0", 6);
  const conversionRefs = ["synthetic:explicit-em-and-def-conversion-protocol"];
  gear.build = {
    mode: "equipment-derived", characterBaseAtk: 500, weaponBaseAtk: 500, atkPercent: 0, flatAtk: 0,
    baseHp: 20000, hpPercent: 0, flatHp: 0, baseDef: 800, defPercent: 0, flatDef: 0,
    em: 200, critRate: 0, critDamage: 0,
    equipment: {
      characterId: "character:zibai", weaponId: "synthetic:em-def-conversion", level: 90, ascension: 6,
      weaponLevel: 90, weaponAscension: 6, refinement: 1, sourceVersion: "synthetic-explicit-conversion",
      sourceRefs: conversionRefs, derivedStats: [], secondaryContributions: [], effectBlockers: [], bonusAccounting: "core-sourced-v1",
      assumptions: ["Two hypothetical same-phase conversions exercise the existing equipment protocol, not a real weapon passive."],
      statModifiers: [
        { id: "em-to-def-percent", label: "Synthetic EM × .001 as DEF ratio", target: "defPercent", phase: "conversion", expression: expr.mul(expr.input("em"), expr.value(.001)), inputs: [], sourceRefs: conversionRefs },
        { id: "def-to-em", label: "Synthetic DEF × .1 as EM", target: "em", phase: "conversion", expression: expr.mul(expr.input("def"), expr.value(.1)), inputs: [], sourceRefs: conversionRefs },
      ],
    },
  };
  gear.gameContext!.zibaiFiniteCast = {
    casterId: "zibai", targetId: "enemy-0", legalCastConfirmed: true, spiritSteedRecastConfirmed: true,
    fullObservedLifetime: true, observedThroughFrame: 20, statsStableAcrossHits: true,
    observations, targetContacts: { first: true, second: true },
    sharedState: { ...sharedState, otherGeoTeammates: 1, hydroTeammates: 2, includedA4DefensePercent: 0, includedA4ElementalMastery: 0 },
  };
  const d = complete(gear);
  // A4 first gives DEF=800×1.15=920 and EM=200+120=320. Both
  // conversions read that same stage: final DEF=800×(1+.15+.320)=1176,
  // final EM=320+920×.1=412; they must not feed each other recursively.
  const ordinaryOracle = 1176 * 1.72528 * .5;
  const lunarOracle = 1.6 * 1176 * 1.40968 * (1 + .08232) * (1 + 6 * 412 / (412 + 2000)) + .6 * 1176;
  expect(d.result.hits[0]!.expected).toBeCloseTo(ordinaryOracle, 8);
  expect(d.result.hits[1]!.expected).toBeCloseTo(lunarOracle, 8);
  const final = convertCalculatorToFinalPanel(d.prepared), finalResult = calculateDocument(final);
  expect(finalResult.blockers).toEqual([]);
  expect(finalResult.totals!.expected).toBeCloseTo(ordinaryOracle + lunarOracle, 8);
  for (const hit of final.hits) {
    expect(hit.kind === "ordinary" || hit.kind === "special").toBe(true);
    if (hit.kind === "ordinary" || hit.kind === "special") {
      expect(hit.finalSnapshot?.origin).toBe("equipment-conversion");
      expect(hit.finalSnapshot!.stats.def).toBeCloseTo(1176, 10);
      expect(hit.finalSnapshot!.stats.em).toBeCloseTo(412, 10);
    }
  }
  const restored = parseCalculatorDocument(serializeCalculatorDocument(final)), restoredResult = calculateDocument(restored);
  expect(restored.gameContext!.zibaiFiniteCast).toEqual(final.gameContext!.zibaiFiniteCast);
  expect(restoredResult.blockers).toEqual([]);
  expect(restoredResult.totals).toEqual(finalResult.totals);
  expect(restoredResult.trace).toEqual(finalResult.trace);
});
