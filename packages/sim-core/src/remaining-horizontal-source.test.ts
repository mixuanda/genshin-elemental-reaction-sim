import { createObservedHydroHoldContext } from "./__tests__/hydro-observed-context-fixture";
import { simulationResultSchema, type SimConfig } from "@genshin-dps-lab/schemas";
import { makeConfig, neutralStats } from "./__tests__/fixtures";
import { compileSourceRuntimeAbility } from "./source-runtime-abilities";
import { deriveSourceBackedRotationMappings } from "./source-action-library";
import { parseRotationDsl } from "./rotation-dsl";
import { simulate } from "./simulator";
import { captureSimulationHit, replaySimulationHit } from "./calculator-bridge";
import { SeededRandom, type SeededRandomState } from "./energy";
import { expect, it } from "vitest";
import { sourceClassifiedMappings } from "../../game-data/src/classified-hits";
import { calculateDocument, convertCalculatorToFinalPanel } from "./calculator";
import { parseCalculatorDocument, serializeCalculatorDocument, type CalculatorDocument, type CalculatorFinalSnapshot, type CalculatorFinalStats } from "./calculator-model";
import { prepareSourceCastDocument } from "./source-cast-context";
import { createObservedSpecialComponentDocument } from "./observed-special-component-formulas";
import { compileTravelerHydroResolvedSchedule } from "./traveler-hydro-resolved-schedule";
import { compileIansanSwiftResolvedSchedule } from "./iansan-swift-resolved-schedule";

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
      characterId: `character:${mapping.characterSlug}`, characterName: mapping.characterSlug,
      abilityId: `${mapping.talentSetId}:${mapping.abilityKey}`, skillId,
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
    dataIdentity: { datasetId: "synthetic-remaining-horizontal-source-protocol", gameVersion: "synthetic", releaseStatus: "synthetic", evidenceStatus: "synthetic" },
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

// One calculator gate for this batch; observation frames are declared synthetic
// evidence, not a replacement for an unverified automatic character timeline.
it("calculates resolved Hydro/Swift, observed special components and the finite five-hit Phantasm with source oracles", () => {
  const hydro = documentFor("traveler-hydro-resolved-aether-hold-c0", 6);
  hydro.enemy.resistance = .1;
  hydro.build = { mode: "manual-final", stats: { ...neutral, atk: 9999 }, ascension: 6, source: "Current panel must not replace either historical offensive sample" };
  hydro.gameContext!.travelerHydroResolvedCast = createObservedHydroHoldContext();
  const hydroSchedule = compileTravelerHydroResolvedSchedule("traveler-hydro-resolved-aether-hold-c0", hydro.gameContext!.travelerHydroResolvedCast);
  expect(hydroSchedule.issues).toEqual([]);
  expect(hydroSchedule.hpLedger[0]).toMatchObject({ frame: 54, order: 0, hpBefore: 12000, hpAfter: 11200, consumedHp: 800 });
  const hydroResult = complete(hydro);
  const dew = hydroResult.result.hits.find(hit => hit.id.endsWith(":dew-1"))!;
  const torrent = hydroResult.result.hits.find(hit => hit.id.endsWith(":torrent"))!;
  // E1 source coefficients: .328 ATK + .0064 MaxHP for the qualifying dew;
  // torrent 1.8928 ATK + min(5000, this-cast consumed HP × .45).
  expect(dew.expected).toBeCloseTo((1000 * .328 + 20000 * .0064) * .5 * .9 * 1.5, 8);
  expect(torrent.expected).toBeCloseTo((2000 * 1.8928 + 800 * .45) * .5 * .9 * 1.5, 8);
  expect(hydroResult.result.totals!.expected).toBeCloseTo(3106.08, 8);
  const standaloneTorrent = documentFor("traveler-hydro-resolved-aether-hold-c0", 6);
  standaloneTorrent.scope = "single-hit";
  standaloneTorrent.enemy.resistance = .1;
  standaloneTorrent.build = { mode: "manual-final", stats: { ...neutral, atk: 2000, critRate: .5, critDamage: 1 }, ascension: 6, source: "Actual final offensive panel of the already-occurring torrent" };
  standaloneTorrent.gameContext!.travelerHydroResolvedCast = {
    trueMoonStoryBuffInactive: true,
    independentEvent: { candidateId: "torrent", templateRole: "torrent", launchFrame: 54, frame: 57, snapshotFrame: 57, snapshotId: "actual-torrent", targetId: "enemy", observedSourceEvent: true, consumedHpThisCast: 800 },
    sharedState: { includedSourceFlatDamage: 0 },
  };
  const independentTorrent = calculateDocument(standaloneTorrent);
  expect(independentTorrent.blockers).toEqual([]);
  expect(independentTorrent.hits).toHaveLength(1);
  expect(independentTorrent.totals!.expected).toBeCloseTo(2798.28, 8);

  const swift = documentFor("iansan-swift-resolved-c0", 6);
  swift.gameContext!.characterId = "character:10000110";
  swift.gameContext!.abilityId = "talent:iansan:combat1";
  swift.enemy.resistance = .1;
  swift.build = { mode: "manual-final", stats: { ...neutral, atk: 2000, critRate: .5, critDamage: 1 }, ascension: 6, source: "Actual panel excludes the previous A1 bonus, base attack explicitly restored" };
  swift.gameContext!.iansanSwiftResolvedCast = {
    casterId: "iansan", targetId: "enemy", freshCastConfirmed: true, noHitlag: true,
    noInterruption: true, noReplacement: true, fullObservedLifetime: true, observedThroughFrame: 25,
    statsStableAcrossHits: true, inputKind: "charged", actionReadyConfirmed: true, groundedAtCast: true,
    fastSkillActiveAtCast: false, nightsoulBlessingAtCast: true, precedingNormalAttackConfirmed: true,
    normalCounterBeforeCast: 1, initialStamina: 25, staminaCostMultiplier: 1,
    targetContacts: { swift: true },
    sharedState: { a1ActiveAtSnapshot: true, includedA1Attack: 0, baseAttack: 800, burstInactiveAtSnapshot: true },
  };
  const swiftSchedule = compileIansanSwiftResolvedSchedule("iansan-swift-resolved-c0", swift.gameContext!.iansanSwiftResolvedCast);
  expect(swiftSchedule.issues).toEqual([]);
  expect(compileIansanSwiftResolvedSchedule("iansan-swift-resolved-c0", { ...swift.gameContext!.iansanSwiftResolvedCast, initialStamina: 24 }).issues.some(issue => issue.includes("25"))).toBe(true);
  expect(swiftSchedule.instances).toEqual([{ id: "swift", templateRole: "swift", frame: 25, snapshotFrame: 25, snapshotId: "snapshot-25", targetId: "enemy", swiftQualifiedAtCast: true }]);
  const swiftResult = complete(swift);
  // This uses NA1=.84194, not E10=1.6643; the previous A1 contributes 20%
  // of the actual base 800. The A1 created after this impact is not a second buff.
  expect(swiftResult.result.totals!.expected).toBeCloseTo((2000 + .2 * 800) * .84194 * .5 * .9 * 1.5, 8);
  const standaloneSwift = documentFor("iansan-swift-resolved-c0", 6);
  standaloneSwift.gameContext!.characterId = "character:10000110";
  standaloneSwift.gameContext!.abilityId = "talent:iansan:combat1";
  standaloneSwift.scope = "single-hit";
  standaloneSwift.enemy.resistance = .1;
  standaloneSwift.build = { mode: "manual-final", stats: { ...neutral, atk: 2000, critRate: .5, critDamage: 1 }, ascension: 6, source: "Already-occurring Swift without previous A1" };
  standaloneSwift.gameContext!.iansanSwiftResolvedCast = { sharedState: { swiftQualifiedAtCast: true, a1ActiveAtSnapshot: false, includedA1Attack: 0, burstInactiveAtSnapshot: true } };
  const independentSwift = calculateDocument(standaloneSwift);
  expect(independentSwift.blockers).toEqual([]);
  expect(independentSwift.totals!.expected).toBeCloseTo(1136.619, 8);

  const linnea = createObservedSpecialComponentDocument(documentFor("linnea-lumi-pummeler-pair", 6), "linnea-lumi-heavy-overdrive-hammer-component");
  linnea.gameContext!.observedSpecialComponent = {
    casterId: "linnea", targetId: "enemy", actualComponentOccurred: true,
    independentEvent: { candidateId: "observed-hammer", frame: 10, snapshotFrame: 10, snapshotId: "actual-hammer", targetId: "enemy" },
    sharedState: {
      intrinsicStatMatchesSnapshot: true, specialBaseBonus: 0, includedIntrinsicBaseBonus: 0,
      reactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1,
      linneaA4AppliesToSelf: true, a4PreConversionStat: 1000, includedCharacterEm: 0,
      lumiForm: "super-power", nearbyMoondrift: true, lumiPresent: true,
      targetWithinLumiA1Range: true, moonsignLevel: 2, includedResistanceReduction: 0,
    },
  };
  const hammer = calculateDocument(linnea);
  expect(hammer.blockers).toEqual([]);
  expect(hammer.hits).toHaveLength(1);
  // Raw Optimizer skill[1][0] = 1.0 DEF. A4 adds 50 EM; own base bonus is
  // .07; A1 at moonsign2 gives -.30 resistance, hence multiplier 1.15.
  expect(hammer.totals!.expected).toBeCloseTo(1.6 * 1000 * 1 * (1 + .07) * (1 + 6 * 50 / (50 + 2000)) * 1.15, 8);
  expect(linnea.scope).toBe("single-hit");
  const hammerA4 = hammer.hits[0]!.trace.find(node => node.id === "component.a4Em")!;
  expect(hammerA4.result!.value).toBe(50);
  expect(hammerA4.symbolicFormula).not.toBe("");
  expect(hammerA4.substitution).not.toBe("");
  expect(hammerA4.explanationKey).not.toBe("");

  const sandrone = createObservedSpecialComponentDocument(documentFor("sandrone-normal-1-base", 6), "sandrone-charged-beam-stellar-swirl-component");
  sandrone.gameContext!.observedSpecialComponent = {
    casterId: "sandrone", targetId: "enemy", actualComponentOccurred: true,
    independentEvent: { candidateId: "observed-beam", frame: 20, snapshotFrame: 20, snapshotId: "actual-beam", targetId: "enemy" },
    sharedState: {
      intrinsicStatMatchesSnapshot: true, specialBaseBonus: 0, includedIntrinsicBaseBonus: 0,
      reactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1,
      a4PreConversionStat: 1000, includedCharacterEm: 0, actualRadiance: "stellar-swirl", decodingMode: true,
    },
  };
  const beam = calculateDocument(sandrone);
  expect(beam.blockers).toEqual([]);
  expect(beam.hits).toHaveLength(1);
  // Source adjudication uses auto[10][0]=1.2255 for Stellar Swirl, not the
  // conflicting charged node's auto[5] reference. No ordinary DEF multiplier.
  expect(beam.totals!.expected).toBeCloseTo(1000 * 1.2255 * 1.07 * (1 + 6 * 80 / (80 + 2000)), 8);
  expect(beam.hits[0]!.trace.find(node => node.id === "component.a4Em")!.result!.value).toBe(80);

  const nefer = documentFor("nefer-phantasm-observed-c0", 1);
  nefer.gameContext!.abilityId = "talent:nefer:combat2";
  nefer.build = {
    mode: "equipment-derived", characterBaseAtk: 500, weaponBaseAtk: 500, atkPercent: 0, flatAtk: 0,
    baseHp: 20000, hpPercent: 0, flatHp: 0, baseDef: 1000, defPercent: 0, flatDef: 0,
    em: 100, critRate: 0, critDamage: 0,
    equipment: {
      characterId: "character:nefer", weaponId: "synthetic:neutral-source-panel", level: 90, ascension: 1,
      weaponLevel: 90, weaponAscension: 6, refinement: 1, sourceVersion: "synthetic-explicit-neutral-gear",
      sourceRefs: ["synthetic:explicit-neutral-gear"], derivedStats: [], secondaryContributions: [],
      effectBlockers: [], bonusAccounting: "core-sourced-v1",
      assumptions: ["Explicit synthetic gear protocol for final-panel materialization; not a released weapon or legal progression claim."],
    },
  };
  const roles = ["nefer1", "shade1", "nefer2", "shade2", "shade3"] as const;
  nefer.gameContext!.neferPhantasmCast = {
    casterId: "nefer", targetId: "enemy", phantasmOccurred: true, shadowDanceActiveAtAction: true,
    verdantDewBefore: 3, phantasmsUsedBefore: 1, firstShadeSummonFrame: 15,
    fullObservedLifetime: true, observedThroughFrame: 50, statsStableAcrossHits: true,
    // Only the source's separate Nefer and shade orders are authoritative;
    // this interleaving is an explicit synthetic observation, not animation data.
    observations: roles.map((templateRole, index) => ({ candidateId: templateRole, templateRole,
      frame: 10 * (index + 1), snapshotFrame: 10 * (index + 1), snapshotId: `actual-${templateRole}`, targetId: "enemy" })),
    targetContacts: Object.fromEntries(roles.map(role => [role, true])),
    sharedState: {
      moonsignLevel: 2, veilStacks: 3, fullVeilEmBuffActive: true, includedFullVeilEm: 0,
      intrinsicEmMatchesSnapshot: true, specialBaseBonus: 0, includedIntrinsicBaseBonus: 0,
      reactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1,
    },
  };
  const phantasm = complete(nefer);
  expect(phantasm.result.hits).toHaveLength(5);
  // Source Lv1: two ATK+EM ordinary hits and three EM-only direct Lunar Bloom
  // hits. The actual independent +100 EM window and three Veil stacks are both
  // explicit; neither is inferred from the other. Direct Lunar Bloom factor=1.
  const ordinaryOracles = [(1000 * .2464 + 200 * .4928) * 1.24 * .5, (1000 * .32032 + 200 * .64064) * 1.24 * .5];
  const lunarOracles = [.96, .96, 1.28].map(coefficient => 200 * coefficient * 1.24 * 1.035 * (1 + 6 * 200 / (200 + 2000)));
  const oracleByRole = { nefer1: ordinaryOracles[0]!, nefer2: ordinaryOracles[1]!, shade1: lunarOracles[0]!, shade2: lunarOracles[1]!, shade3: lunarOracles[2]! };
  for (const role of roles) expect(phantasm.result.hits.find(hit => hit.id.endsWith(`:${role}`))!.expected).toBeCloseTo(oracleByRole[role], 8);
  const fullOracle = [...ordinaryOracles, ...lunarOracles].reduce((sum, value) => sum + value, 0);
  expect(phantasm.result.totals!.expected).toBeCloseTo(fullOracle, 8);
  const final = convertCalculatorToFinalPanel(phantasm.prepared), finalResult = calculateDocument(final);
  expect(finalResult.blockers).toEqual([]);
  expect(finalResult.totals!.expected).toBeCloseTo(fullOracle, 8);
  for (const hit of final.hits) {
    expect(hit.kind === "ordinary" || hit.kind === "special").toBe(true);
    if (hit.kind === "ordinary" || hit.kind === "special") expect(hit.finalSnapshot!.stats.em).toBe(200);
  }
  const restored = parseCalculatorDocument(serializeCalculatorDocument(final)), restoredResult = calculateDocument(restored);
  expect(restored.gameContext!.neferPhantasmCast).toEqual(final.gameContext!.neferPhantasmCast);
  expect(restored.hits).toEqual(final.hits);
  expect(restoredResult.blockers).toEqual([]);
  expect(restoredResult.totals).toEqual(finalResult.totals);
  expect(restoredResult.trace).toEqual(finalResult.trace);
});

function horizontalNormalFixture(): SimConfig {
  const sourceNormals = ["amber-n1", "amber-n2", "amber-n3", "amber-n4", "amber-n5"] as const;
  const compiled = ["a", "b"].flatMap(actorId => sourceNormals.map(sourceActionId =>
    compileSourceRuntimeAbility({ actorId, sourceActionId, talentLevel: 1, ascension: 0, constellation: 0 })));
  const burst = compileSourceRuntimeAbility({ actorId: "a", sourceActionId: "amber-q", talentLevel: 1, ascension: 0, constellation: 0 });
  compiled.push(burst);
  const config = makeConfig({
    duration: 10, cycleLength: 10, dataVersion: "synthetic-horizontal-normal-v1", randomSeed: "horizontal-source-normal",
    meta: { name: "合成面板的真实来源普攻接受状态", version: "synthetic-horizontal-normal-v1", verificationStatus: "user-supplied" },
    enemy: { level: 90, resistance: 0, defReduction: 0 },
    characters: ["a", "b"].map(id => ({ id, name: `明确合成面板 ${id}`, element: "pyro" as const, color: "#555555", level: 90,
      energyMax: 40, initialEnergy: 0, stats: { ...neutralStats } })),
    reactionEngine: { mode: "aura-v3", initialAura: [], icdProfiles: {} },
    normalHitEnergyModel: { mode: "fixed-source-independent-stream-v1", actors: [{ actorId: "a", weaponType: "bow" }, { actorId: "b", weaponType: "bow" }] },
    sourceAbilityBindings: compiled.map(row => row.binding),
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: compiled.map(row => row.ability), commands: [] },
  });
  // `at` is a prefix on the next command. The first N3 naturally occupies
  // 26 + 22 + 37 = 85 frames; explicit wait 60f therefore leaves N4 at 145f.
  config.timeline!.commands = parseRotationDsl(
    ["N3", "wait 60f", "N2", "at 300f N", "at 330f Q", "at 340f N", "at 380f swap b", "at 390f N", "at 430f swap a", "at 450f N"].join("\n"),
    { abilities: config.timeline!.abilities, characterIds: ["a", "b"], initialActiveCharacterId: "a", ...deriveSourceBackedRotationMappings(config)! },
  );
  return config;
}

function assertHorizontalNormalMechanisms() {
  const config = horizontalNormalFixture();
  expect(config.timeline!.commands.filter(command => command.type === "normal").every(command => command.type === "normal" && command.sourceNormalChain === "next-v1")).toBe(true);
  const result = simulate(config, { critMode: "average", energyMode: "configured" });
  const accepted = result.sourceNormalChainLog!.filter(row => row.kind === "normal-accepted");
  expect(accepted.map(row => [row.actorId, row.normalIndex, row.frame])).toEqual([
    ["a", 1, 0], ["a", 2, 26], ["a", 3, 48], ["a", 4, 145], ["a", 5, 179],
    ["a", 1, 300], ["a", 2, 340], ["b", 1, 390], ["a", 1, 450],
  ]);
  expect(result.damageEvents.map(event => event.frame)).toEqual([24, 46, 85, 181, 215, 324, 360, 414, 474]);
  // Independent source Lv1 coefficients, 1000 ATK, equal levels, zero resistance and CR.
  const expectedDamage = [180.6, 180.6, 232.2, 236.5, 296.7, 180.6, 180.6, 180.6, 180.6];
  result.damageEvents.forEach((event, index) => expect(event.finalDamage).toBeCloseTo(expectedDamage[index]!, 10));
  expect(result.totalDamage).toBeCloseTo(1849, 10);
  expect(result.sourceSnapshotLog!.map(row => row.frame)).toEqual([14, 36, 75, 171, 205, 314, 350, 404, 464]);
  const failedBurst = result.timelineExecution!.commandResults[7]!;
  expect(failedBurst).toMatchObject({ status: "rejected", failureCode: "INSUFFICIENT_ENERGY", startFrame: 330, energyCost: 40 });
  // At most six preceding arrows can request one energy each. This rejection
  // does not depend on a particular RNG outcome, and cannot reset the chain.
  expect(failedBurst.energyBefore).toBeGreaterThanOrEqual(0);
  expect(failedBurst.energyBefore).toBeLessThanOrEqual(6);
  expect(result.energyCostLog).toEqual([]);
  expect(result.sourceNormalChainLog!.some(row => row.kind === "non-normal-reset")).toBe(false);
  const swaps = result.sourceNormalChainLog!.filter(row => row.kind.startsWith("swap-"));
  expect(swaps.map(row => [row.kind, row.frame])).toEqual([
    ["swap-start-reset", 380], ["swap-complete-reset", 381], ["swap-start-reset", 430], ["swap-complete-reset", 431],
  ]);
  expect(swaps[0]!.stateBefore.actors.map(row => [row.actorId, row.nextIndex])).toEqual([["a", 3], ["b", 1]]);
  expect(swaps[2]!.stateBefore.actors.map(row => [row.actorId, row.nextIndex])).toEqual([["a", 1], ["b", 2]]);
  expect(swaps.every(row => row.stateAfter.actors.every(actor => actor.nextIndex === 1))).toBe(true);
  expect(result.sourceNormalChainState!.actors.map(row => [row.actorId, row.nextIndex])).toEqual([["a", 2], ["b", 1]]);
  const restored = simulationResultSchema.parse(JSON.parse(JSON.stringify(result)));
  expect(restored.sourceNormalChainLog).toEqual(result.sourceNormalChainLog);
  expect(restored.sourceNormalChainState).toEqual(result.sourceNormalChainState);
  expect(replaySimulationHit(captureSimulationHit(restored, result.damageEvents[2]!.id)).difference).toBe(0);
  return { totalDamage: result.totalDamage, acceptedInputs: accepted.length, hitFrames: result.damageEvents.map(event => event.frame), rejectedBurstFrame: failedBurst.startFrame };
}

// Frozen source-clock oracle supplied in
// docs/validation/periodic-reaction-checkpoint-state.md. The four isolated
// targets keep this one runtime from accidentally testing cross-target AoE.
function horizontalPeriodicFixture(): SimConfig {
  // Both before-frame samples have one full future 1200f cycle available;
  // this finite observation does not assert a repeating or stochastic steady state.
  const rows = [
    { id: "enemy-0", aura: "hydro", hit: "electro", x: 0 },
    { id: "burn", aura: "dendro", hit: "pyro", x: 100 },
    { id: "core", aura: "hydro", hit: "dendro", x: 200 },
    { id: "shard", aura: "cryo", hit: "geo", x: 300 },
  ] as const;
  return makeConfig({
    duration: 40, cycleLength: 20, dataVersion: "synthetic-horizontal-periodic-v1", randomSeed: "horizontal-periodic-state",
    meta: { name: "四个隔离目标的普通周期反应真实队列", version: "synthetic-horizontal-periodic-v1", verificationStatus: "user-supplied" },
    enemy: { level: 90, resistance: 0, defReduction: 0,
      targets: rows.map(row => ({ id: row.id, name: row.id, position: { x: row.x, y: 0 }, hitboxRadius: 0,
        initialAura: [{ element: row.aura, gaugeUnits: 1 }] })) },
    reactionEngine: { mode: "aura-v9" }, targetTaskModel: { mode: "target-phase-v2" },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "four-observed-inputs", actorId: "a", name: "明确合成的四次独立元素输入", kind: "skill",
        cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
        hits: rows.map(row => ({ id: `input-${row.id}`, frame: 0, scaling: 1, element: row.hit,
          geometry: { kind: "circle" as const, origin: { x: row.x, y: 0 }, radius: 1 },
          application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" as const } } })) }],
      commands: [{ type: "skill", actorId: "a", abilityId: "four-observed-inputs", atFrame: 1 }],
    },
  });
}

// Current phase checkpoint state is a heterogeneous serializable audit tree.
// Keep its test-side structural view local; production runtime/schema stay untouched.
type HorizontalPhaseState = Record<string, any>;
function assertHorizontalPeriodicMechanisms() {
  const result = simulate(horizontalPeriodicFixture(), { execution: { checkpointFrames: [2, 32] } });
  expect(result.executionAudit!.checkpointCoverage).toEqual({ complete: true, missingDimensions: [], reasons: [] });
  expect(result.executionAudit!.phaseCheckpoints.map(row => row.tick)).toEqual([2, 32]);
  const [before, after] = result.executionAudit!.phaseCheckpoints.map(row => row.state as HorizontalPhaseState);
  expect(before!.pendingEvents.inFlight).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "periodicReactionTick", remainingTicks: 9, payload: expect.objectContaining({ targetId: "enemy-0", firstTick: true }) }),
    expect.objectContaining({ type: "periodicReactionTick", remainingTicks: 69 }),
    expect.objectContaining({ type: "burningTick", remainingTicks: 14 }),
    expect.objectContaining({ type: "dendroCoreSpawn", remainingTicks: 29 }),
    expect.objectContaining({ type: "crystallizeShardSpawn", remainingTicks: 22 }),
  ]));
  const beforeEntities = before!.entities.reactionEntities;
  expect(beforeEntities.dendroCore.active).toEqual([]);
  expect(beforeEntities.dendroCore.sources).toHaveLength(1);
  expect(beforeEntities.dendroCore.sources[0].reservation.spawnRemainingTicks).toBe(29);
  expect(beforeEntities.crystallize.shards).toEqual([]);
  const beforeStreams = before!.icdAndTriggerHistory.randomExecution.streams as Record<string, SeededRandomState>;
  const afterStreams = after!.icdAndTriggerHistory.randomExecution.streams as Record<string, SeededRandomState>;
  expect([beforeStreams.dendroCorePosition!.drawCount, beforeStreams.crystallizePosition!.drawCount]).toEqual([0, 0]);
  expect([afterStreams.dendroCorePosition!.drawCount, afterStreams.crystallizePosition!.drawCount]).toEqual([1, 1]);
  const afterEntities = after!.entities.reactionEntities;
  expect(afterEntities.dendroCore.active).toHaveLength(1);
  expect(afterEntities.dendroCore.active[0]).toMatchObject({ sourceTargetId: "core", spawnAgeTicks: 1, expiryRemainingTicks: 299 });
  expect(afterEntities.crystallize.shards).toHaveLength(1);
  expect(afterEntities.crystallize.shards[0]).toMatchObject({ sourceTargetId: "shard", spawnAgeTicks: 8, earliestPickupRemainingTicks: 23, expiryRemainingTicks: 892 });
  expect(after!.pendingEvents.inFlight).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "dendroCoreExpiry", remainingTicks: 299 }),
    expect.objectContaining({ type: "crystallizeShardExpiry", remainingTicks: 892 }),
  ]));
  // The serialized pre-spawn stream must reproduce the subsequent actual draw.
  // This proves state capture/continuation, not convergence or random steady state.
  const coreRandom = SeededRandom.fromState(JSON.parse(JSON.stringify(beforeStreams.dendroCorePosition)));
  const shardRandom = SeededRandom.fromState(JSON.parse(JSON.stringify(beforeStreams.crystallizePosition)));
  expect(afterEntities.dendroCore.active[0].positionRandomRoll).toBe(coreRandom.next());
  expect(afterEntities.crystallize.shards[0].spawnAngleDegrees).toBe(shardRandom.next() * 360);
  expect(afterStreams.dendroCorePosition).toEqual(coreRandom.captureState());
  expect(afterStreams.crystallizePosition).toEqual(shardRandom.captureState());
  const restored = simulationResultSchema.parse(JSON.parse(JSON.stringify(result)));
  expect(restored.executionAudit!.phaseCheckpoints).toEqual(result.executionAudit!.phaseCheckpoints);
  return { checkpoints: [2, 32], beforeQueue: before!.pendingEvents.inFlight.map((row: HorizontalPhaseState) => [row.type, row.remainingTicks]), positionDrawsAt32: [1, 1] };
}


it("preserves accepted-input normal state and real periodic-reaction queues and RNG at before-frame checkpoints", () => {
  const normal = assertHorizontalNormalMechanisms();
  const periodic = assertHorizontalPeriodicMechanisms();
  console.info("remaining horizontal mechanisms", JSON.stringify({ normal, periodic }));
});
