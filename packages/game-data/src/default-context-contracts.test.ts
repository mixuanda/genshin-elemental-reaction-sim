import observedSourceCases from "../../sim-core/src/fixtures/observed-entity-source-cases.json";
import { wandererPrimaryContext } from "../../sim-core/src/wanderer-primary-formulas";
import { cynoContext } from "../../sim-core/src/cyno-damage-formulas";
import { applyColleiSkillContext } from "../../sim-core/src/collei-charlotte-formulas";
import { kazuhaBurstContext } from "../../sim-core/src/kazuha-burst-formulas";
import { hutaoContext } from "../../sim-core/src/hutao-damage-formulas";
import { xiaoContext } from "../../sim-core/src/xiao-damage-formulas";
import { createMaleChargedFixture } from "../../sim-core/src/traveler-male-charged.test-helper";
import { describe, expect, it } from "vitest";
import { applyCharacterConstellationScope, applyNingguangBurstContext, getCharacterDocuments } from "../../../apps/web/src/character-calculations";
import { calculateDocument } from "../../sim-core/src/calculator";
import { prepareCoordinatedCastDocument } from "../../sim-core/src/coordinated-cast-formulas";
import { prepareSourceCastDocument } from "../../sim-core/src/source-cast-context";
import { createObservedHydroHoldContext } from "../../sim-core/src/__tests__/hydro-observed-context-fixture";
import { observedEntityCastContextSchema, calculatorDocumentSchema, type CalculatorDocument, type BatchPeriodicCastContext } from "../../sim-core/src/calculator-model";
import { DEFAULT_CONTEXT_CONTRACTS, defaultContextContract, type RegisteredContextSkill } from "./default-context-contracts";

// Explicit identities/counts paired with the unchanged raw-source-state.test.ts
// 44-action L1/L10 arithmetic, round-trip, four state-profile and eight plunge
// negative oracles. Multihit sums are not a per-hit numeric oracle, and the
// underlying b061b403 data remains provisional/single-source extracted.
const rawSourceCases = [
  ["character:10000117", "manekin-normal-1-raw-base", 1],
  ["character:10000117", "manekin-normal-2-raw-base", 1],
  ["character:10000117", "manekin-normal-3-raw-base", 2],
  ["character:10000117", "manekin-normal-4-raw-base", 1],
  ["character:10000117", "manekin-charged-raw-base", 2],
  ["character:10000117", "manekin-plunge-low-raw-base", 1],
  ["character:10000117", "manekin-plunge-high-raw-base", 1],
  ["character:10000117", "manekin-skill-pyro-raw", 1],
  ["character:10000117", "manekin-skill-hydro-raw", 1],
  ["character:10000117", "manekin-skill-electro-raw", 1],
  ["character:10000117", "manekin-skill-cryo-raw", 1],
  ["character:10000117", "manekin-skill-anemo-raw", 1],
  ["character:10000117", "manekin-skill-geo-raw", 1],
  ["character:10000117", "manekin-skill-dendro-raw", 1],
  ["character:10000118", "manekina-normal-1-raw-base", 1],
  ["character:10000118", "manekina-normal-2-raw-base", 1],
  ["character:10000118", "manekina-normal-3-raw-base", 2],
  ["character:10000118", "manekina-normal-4-raw-base", 1],
  ["character:10000118", "manekina-charged-raw-base", 2],
  ["character:10000118", "manekina-plunge-low-raw-base", 1],
  ["character:10000118", "manekina-plunge-high-raw-base", 1],
  ["character:10000118", "manekina-skill-pyro-raw", 1],
  ["character:10000118", "manekina-skill-hydro-raw", 1],
  ["character:10000118", "manekina-skill-electro-raw", 1],
  ["character:10000118", "manekina-skill-cryo-raw", 1],
  ["character:10000118", "manekina-skill-anemo-raw", 1],
  ["character:10000118", "manekina-skill-geo-raw", 1],
  ["character:10000118", "manekina-skill-dendro-raw", 1],
  ["character:10000140", "vodyanitsa-normal-1-base-c0", 1],
  ["character:10000140", "vodyanitsa-normal-2-base-c0", 1],
  ["character:10000140", "vodyanitsa-normal-3-base-c0", 1],
  ["character:10000140", "vodyanitsa-normal-4-base-c0", 1],
  ["character:10000140", "vodyanitsa-charged-base-c0", 1],
  ["character:10000140", "vodyanitsa-plunge-low-base-c0", 1],
  ["character:10000140", "vodyanitsa-plunge-high-base-c0", 1],
  ["character:10000143", "vesna-normal-1-base-c0", 1],
  ["character:10000143", "vesna-normal-2-base-c0", 1],
  ["character:10000143", "vesna-normal-3-base-c0", 2],
  ["character:10000143", "vesna-normal-4-base-c0", 1],
  ["character:10000143", "vesna-normal-5-base-c0", 1],
  ["character:10000143", "vesna-normal-6-base-c0", 1],
  ["character:10000143", "vesna-charged-base-c0", 1],
  ["character:10000143", "vesna-plunge-low-base-c0", 1],
  ["character:10000143", "vesna-plunge-high-base-c0", 1],
] as const;
const hydroCases = [
  ["character:10000005", "traveler-hydro-resolved-aether-hold-c0"],
  ["character:10000007", "traveler-hydro-resolved-lumine-hold-c0"],
] as const;
const crossCases = [
  ["character:10000005", "traveler-cross-aether-anemo-burst-c0", "anemo"],
  ["character:10000007", "traveler-cross-lumine-anemo-burst-c0", "anemo"],
  ["character:10000005", "traveler-cross-aether-dendro-burst-c0", "dendro"],
  ["character:10000007", "traveler-cross-lumine-dendro-burst-c0", "dendro"],
] as const;
const cryoCases = [
  ["character:10000005", "aether-cryo-skill-state-c0", "aether", "skill"],
  ["character:10000005", "aether-cryo-burst-state-c0", "aether", "burst"],
  ["character:10000007", "lumine-cryo-skill-state-c0", "lumine", "skill"],
  ["character:10000007", "lumine-cryo-burst-state-c0", "lumine", "burst"],
] as const;
const cryoCompleteCases = [
  ["character:10000005", "aether-cryo-skill-periodic-complete-c0", "skill", 0, 9],
  ["character:10000005", "aether-cryo-burst-frostglow-partial-complete-c0", "burst", 4, 3],
  ["character:10000005", "aether-cryo-burst-frostglow-full-complete-c0", "burst", 8, 5],
  ["character:10000007", "lumine-cryo-skill-periodic-complete-c0", "skill", 0, 9],
  ["character:10000007", "lumine-cryo-burst-frostglow-partial-complete-c0", "burst", 4, 3],
  ["character:10000007", "lumine-cryo-burst-frostglow-full-complete-c0", "burst", 8, 5],
] as const;
function cryoCompleteDocument(characterId: string, skillId: RegisteredContextSkill, stacks: number) {
  const doc = getCharacterDocuments(characterId, 1).find(candidate => candidate.gameContext?.skillId === skillId);
  if (!doc?.gameContext) throw new Error(`Missing existing conditional Cryo cast ${skillId}`);
  doc.scope = "one-cast";
  doc.selectedHitIds = doc.hits.map(hit => hit.id);
  doc.characterLevel = 90;
  doc.gameContext.ascension = 6;
  doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 20, critRate: .5, critDamage: 1 },
    source: "Explicit conditional full-cast panel; non-Extra ATK is independently supplied" };
  for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
  doc.gameContext.travelerCryo = { radiance: "none", trueMoonStoryBuff: false, statsStableAcrossHits: true,
    skillUninterrupted: true, frostglowStacksAtBurst: stacks, nonExtraAtk: 1000, a4IncludedEm: 0 };
  return doc;
}
const electroCases = [
  ["character:10000005", "coordinated-aether-electro-burst-c0"],
  ["character:10000007", "coordinated-lumine-electro-burst-c0"],
] as const;
function electroDocument(characterId: string, skillId: RegisteredContextSkill) {
  const doc = getCharacterDocuments(characterId, 1).find(candidate => candidate.gameContext?.skillId === skillId);
  if (!doc?.gameContext) throw new Error(`Missing existing coordinated action ${skillId}`);
  doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id);
  doc.characterLevel = 90; doc.gameContext.ascension = 6;
  doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 20, critRate: .5, critDamage: 1 }, source: "Explicit observed coordinated cast; four external normal-hit triggers" };
  for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
  doc.gameContext.coordinatedCast = {
    casterId: "owner", targetId: "enemy", freshCastConfirmed: true, fullObservedLifetime: true,
    observedThroughFrame: 720, noHitlag: true, noReplacement: true, noInterruption: true,
    allGeneratedHitsConfirmed: true, statsStableAcrossHits: true,
    damageEvents: [100, 130, 160, 251].map(frame => ({ id: `observed-${frame}`, frame, actorId: "driver", activeActorId: "driver", tag: "normal", targetId: "enemy", origin: "external" })),
  };
  return doc;
}
const heldDendroCases = [
  ["character:10000005", "held-aether-dendro-burst-pyro-c0"],
  ["character:10000007", "held-lumine-dendro-burst-pyro-c0"],
] as const;
function heldDendroDocument(characterId: string, skillId: RegisteredContextSkill) {
  const doc = getCharacterDocuments(characterId, 1).find(candidate => candidate.gameContext?.skillId === skillId);
  if (!doc?.gameContext) throw new Error(`Missing existing Dendro explosion ${skillId}`);
  doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[0]!.id];
  doc.characterLevel = 90; doc.gameContext.ascension = 6;
  doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 50, critRate: .5, critDamage: 1 }, source: "Independent occurred explosion; actual impact EM differs from offensive panel EM" };
  for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
  doc.gameContext.heldLifecycleCast = { sharedState: { actualElementalMasteryAtHit: 300, includedDamageBonus: 0 } };
  return doc;
}
const heldHydroCases = [
  ["character:10000005", "held-aether-hydro-skill-no-suffusion-c0"],
  ["character:10000007", "held-lumine-hydro-skill-no-suffusion-c0"],
] as const;
function heldHydroDocument(characterId: string, skillId: RegisteredContextSkill) {
  const doc = getCharacterDocuments(characterId, 1).find(candidate => candidate.gameContext?.skillId === skillId);
  if (!doc?.gameContext) throw new Error(`Missing existing no-Suffusion action ${skillId}`);
  doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id);
  doc.characterLevel = 90; doc.gameContext.ascension = 6;
  doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 50, critRate: .5, critDamage: 1 }, source: "Explicit three emitted drops and independent observed contacts; no Suffusion" };
  for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
  doc.gameContext.heldLifecycleCast = {
    casterId: "owner", targetId: "enemy", freshCastConfirmed: true, noHitlag: true, noInterruption: true,
    noReplacement: true, fullObservedLifetime: true, observedThroughFrame: 133, statsStableAcrossHits: true,
    targetContacts: { "dewdrop-1": true, "dewdrop-2": true, "dewdrop-3": true, torrent: true, arkhe: true },
    hydroHold: { dewdropCount: 3, travelFrames: 6, arkheReady: true, hpRatiosBeforeDewdrops: [.5, .5, .5], noHealingOrDropletPickup: true, priorA4Bonus: 0 },
  };
  return doc;
}
const heldPyroCases = [
  ["character:10000005", "held-aether-pyro-skill-hold-c0"],
  ["character:10000007", "held-lumine-pyro-skill-hold-c0"],
] as const;
function heldPyroDocument(characterId: string, skillId: RegisteredContextSkill) {
  const doc = getCharacterDocuments(characterId, 1).find(candidate => candidate.gameContext?.skillId === skillId);
  if (!doc?.gameContext) throw new Error(`Missing existing Pyro hold ${skillId}`);
  doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id);
  doc.characterLevel = 90; doc.gameContext.ascension = 6; doc.gameContext.constellation = 0;
  doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 50, critRate: .5, critDamage: 1 }, source: "Explicit Pyro hold observations; queued tail covered after resource expiry" };
  for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
  doc.gameContext.heldLifecycleCast = {
    casterId: "owner", targetId: "enemy", freshCastConfirmed: true, noHitlag: true, noInterruption: true,
    noReplacement: true, fullObservedLifetime: true, observedThroughFrame: 417, statsStableAcrossHits: true,
    targetContacts: { initial: true, "proc-initial": true, "proc-external-e25": true, "proc-external-e220": true, "proc-external-e405": true },
    pyro: { initialNightsoulPoints: 0, noExternalPointChanges: true, initialDamagePositive: true,
      damageEvents: [25, 220, 405].map(frame => ({ id: `e${frame}`, frame, actorId: "driver", targetId: "enemy", tag: "normal", origin: "external", damagePositive: true })) },
  };
  return doc;
}
const maleChargedCases = [
  ["character:10000005", "male-charged-aether-anemo-c0", "anemo"],
  ["character:10000005", "male-charged-aether-geo-c0", "geo"],
  ["character:10000005", "male-charged-aether-electro-c0", "electro"],
  ["character:10000005", "male-charged-aether-dendro-c0", "dendro"],
  ["character:10000005", "male-charged-aether-hydro-c0", "hydro"],
  ["character:10000005", "male-charged-aether-pyro-c0", "pyro"],
  ["character:10000005", "male-charged-aether-cryo-c0", "cryo"],
] as const;
const wandererDefaultCases = [
  ["wanderer-windfavored-normal-1", 1.3583, false],
  ["wanderer-windfavored-c6-normal-1", 1.3583, true],
  ["wanderer-windfavored-normal-2", 1.2852, false],
  ["wanderer-windfavored-c6-normal-2", 1.2852, true],
  ["wanderer-windfavored-normal-3-1", 0.9418, false],
  ["wanderer-windfavored-c6-normal-3-1", 0.9418, true],
  ["wanderer-windfavored-normal-3-2", 0.9418, false],
  ["wanderer-windfavored-c6-normal-3-2", 0.9418, true],
  ["wanderer-kyougen-five-hits", 3.128, false],
] as const;
const cynoDefaultCases = [
  ["cyno-q-normal-1-c0", 1.547459],
  ["cyno-q-normal-2-c0", 1.630198],
  ["cyno-q-normal-3-c0", 2.068339],
  ["cyno-q-normal-4-1-c0", 1.021861],
  ["cyno-q-normal-4-2-c0", 1.021861],
  ["cyno-q-normal-5-c0", 2.586465],
] as const;
const hutaoCases = [
  ["hutao-paramita-normal-1-c0-c1", .836496], ["hutao-paramita-normal-2-c0-c1", .860894],
  ["hutao-paramita-normal-3-c0-c1", 1.089188], ["hutao-paramita-normal-4-c0-c1", 1.171094],
  ["hutao-paramita-normal-5-1-c0-c1", .593633], ["hutao-paramita-normal-5-2-c0-c1", .628],
  ["hutao-paramita-normal-6-c0-c1", 1.533576], ["hutao-paramita-charged-c0-c1", 2.42565],
] as const;

// Pinned archived zz_klee/zz_freminet.dm.go T1 literals; explicit complete mapping counts.
const simpleProjectileCases = [
  ["character:10000029", "klee-skill-complete-cast-c0", [.952, .952, .952, ...Array<number>(8).fill(.328)]],
  ["character:10000085", "freminet-skill-initial-complete-cast-c0-arkhe-ready", [.8304, .144]],
] as const;

// Independent NA10 vectors and Q10=.952 from pinned b4ae769/a7dc4bf Xiao tables.
const xiaoCases = [
  ["xiao-q-normal-1", [.49141, .49141]], ["xiao-q-normal-2", [1.01579]],
  ["xiao-q-normal-3", [1.22303]], ["xiao-q-normal-4", [.67196, .67196]],
  ["xiao-q-normal-5", [1.27641]], ["xiao-q-normal-6", [1.70973]],
  ["xiao-q-charged", [2.16032]], ["xiao-q-low-plunge", [3.234591]],
  ["xiao-q-high-plunge", [4.040179]], ["xiao-q-plunge-collision", [1.617638]],
] as const;
function xiaoDocument(skillId: RegisteredContextSkill) {
  const doc = getCharacterDocuments("character:10000026", 10).find(candidate => candidate.gameContext?.skillId === skillId);
  if (!doc?.gameContext) throw new Error(`Missing existing Xiao Q hit ${skillId}`);
  doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[0]!.id]; doc.characterLevel = 90;
  doc.gameContext.constellation = 0; doc.gameContext.ascension = 6;
  doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Actual selected hit and independent Q talent/time; no inferred burst rotation" };
  doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
  Object.assign(xiaoContext(doc)!, { burstActive: true, burstTalentLevel: 10, burstElapsedSeconds: 0, includedDamageBonus: 0 });
  return doc;
}

const normalCoordinatedCases = [
  ["character:10000025", "coordinated-xingqiu-burst-c0", "xingqiu", 933],
  ["character:10000060", "coordinated-yelan-burst-c0", "yelan", 976],
  ["character:10000050", "coordinated-thoma-burst-c0", "thoma", 900],
] as const;
function normalCoordinatedDocument(characterId: string, skillId: RegisteredContextSkill, end: number) {
  const doc = getCharacterDocuments(characterId, 1).find(candidate => candidate.gameContext?.skillId === skillId);
  if (!doc?.gameContext) throw new Error(`Missing existing normal-triggered action ${skillId}`);
  doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id);
  doc.characterLevel = 90; doc.gameContext.ascension = 6; doc.gameContext.constellation = 0;
  doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 50, critRate: .5, critDamage: 1 }, source: "Actual normal-state observation; explicitly stable panel and passive shares" };
  for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
  doc.gameContext.coordinatedCast = { casterId: "owner", targetId: "enemy", freshCastConfirmed: true, fullObservedLifetime: true,
    observedThroughFrame: end + 1, noHitlag: true, noReplacement: true, noInterruption: true, allGeneratedHitsConfirmed: true, statsStableAcrossHits: true,
    normalStates: [{ id: "normal", startFrame: 100, endFrame: 221, actorId: "driver", onField: true, animationStartDelayFrames: 0, firstNormalInChain: true }],
    damageEvents: [], sharedState: { includedDamageBonus: 0, ownerOnField: false } };
  return doc;
}

// T1 literals from pinned batch-complete-finite-skills manifest; counts from reviewed mappings.
const finiteCases = [
  { characterId: "character:10000016", skillId: "diluc-burst-full-contact-complete-c0", atk: [2.04, ...Array<number>(8).fill(.6), 2.04], hp: 0, bonus: .2, passive: true, ascension: 6 },
  { characterId: "character:10000096", skillId: "arlecchino-skill-unabsorbed-complete-c0", atk: [.1484, 1.3356, .318, .318], hp: 0, bonus: .4, passive: true, ascension: 6 },
  { characterId: "character:10000061", skillId: "kirara-burst-six-cardamoms-complete-c0", atk: [5.7024, ...Array<number>(6).fill(.3564)], hp: 0, bonus: .06, passive: true, ascension: 6 },
  { characterId: "character:10000036", skillId: "chongyun-skill-without-a4-complete-c0", atk: [1.7204], hp: 0, bonus: 0, passive: false, ascension: 3 },
  { characterId: "character:10000036", skillId: "chongyun-skill-with-a4-complete-c0", atk: [1.7204, 1.7204], hp: 0, bonus: 0, passive: false, ascension: 6 },
  { characterId: "character:10000079", skillId: "dehya-burst-auto-six-complete-c0", atk: [...Array<number>(6).fill(.987), 1.393], hp: .01692, bonus: 0, passive: false, ascension: 6 },
  { characterId: "character:10000079", skillId: "dehya-burst-rhythm-ten-complete-c0", atk: [...Array<number>(10).fill(.987), 1.393], hp: .01692, bonus: 0, passive: false, ascension: 6 },
] as const;
function finiteDocument(spec: typeof finiteCases[number]) {
  const doc = getCharacterDocuments(spec.characterId, 1).find(candidate => candidate.gameContext?.skillId === spec.skillId);
  if (!doc?.gameContext) throw new Error(`Missing finite action ${spec.skillId}`);
  doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id);
  doc.characterLevel = 90; doc.gameContext.ascension = spec.ascension; doc.gameContext.constellation = 0;
  doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  doc.build = { mode: "manual-final", ascension: spec.ascension, stats: { atk: 2000, hp: 20000, def: 800, em: 50, critRate: .5, critDamage: 1 }, source: "Explicit finite contacts, stable samples and actual passive accounting" };
  for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
  doc.gameContext.batchFiniteCast = { completeCastConfirmed: true, statsStableAcrossHits: true,
    hitStates: Object.fromEntries(doc.hits.map(hit => [hit.id, { includedDamageBonus: 0 }])) };
  return doc;
}

// Independent talent-1 literals and counts from batch-complete-periodic/manifest.json
// and its reviewed mapping contracts; never read the executed formula's output/table.
const periodicCases = [
  { characterId: "character:10000015", skillId: "kaeya-burst-front-thirteen-hits-complete-c0", kind: "kaeya", coefficients: Array<number>(13).fill(.776),
    context: { kaeyaFrontContactModelConfirmed: true }, required: ["kaeyaFrontContactModelConfirmed"], trueOnly: ["kaeyaFrontContactModelConfirmed"] },
  { characterId: "character:10000022", skillId: "venti-burst-twenty-anemo-no-absorption-complete-c0", kind: "venti", coefficients: Array<number>(20).fill(.376),
    context: { ventiNoAbsorption: true, ventiHexereiInactive: true }, required: ["ventiNoAbsorption", "ventiHexereiInactive"], trueOnly: ["ventiNoAbsorption", "ventiHexereiInactive"] },
  { characterId: "character:10000035", skillId: "qiqi-skill-ten-hits-complete-c0", kind: "qiqi", coefficients: [.96, ...Array<number>(9).fill(.36)],
    context: { qiqiRevelationInactive: true }, required: ["qiqiRevelationInactive"], trueOnly: ["qiqiRevelationInactive"] },
  { characterId: "character:10000045", skillId: "rosaria-burst-six-hits-complete-c0", kind: "rosaria", coefficients: [1.04, 1.52, 1.32, 1.32, 1.32, 1.32],
    context: {}, required: [], trueOnly: [] },
  { characterId: "character:10000054", skillId: "kokomi-skill-seven-ticks-no-burst-complete-c0", kind: "kokomi", coefficients: Array<number>(7).fill(1.091904),
    context: { kokomiNoBurstOrRefresh: true, kokomiPassiveIncludedInPanel: false }, required: ["kokomiNoBurstOrRefresh", "kokomiPassiveIncludedInPanel"], trueOnly: ["kokomiNoBurstOrRefresh"] },
  { characterId: "character:10000063", skillId: "shenhe-burst-thirteen-hits-fresh-complete-c0", kind: "shenhe", coefficients: [1.008, ...Array<number>(12).fill(.3312)],
    context: { shenheFreshBurstNoSkillEffects: true, shenheA1IncludedInPanel: false, shenheQReductionIncludedInResistance: false }, required: ["shenheFreshBurstNoSkillEffects", "shenheA1IncludedInPanel", "shenheQReductionIncludedInResistance"], trueOnly: ["shenheFreshBurstNoSkillEffects"] },
  { characterId: "character:10000112", skillId: "escoffier-skill-twenty-three-hits-arkhe-complete-c0", kind: "escoffier", coefficients: [.504, .336, ...Array<number>(21).fill(1.2)],
    context: { escoffierArkheAvailable: true, escoffierCryoHydroMembers: 4, escoffierA4InitiallyActive: false, escoffierInitialHitConnected: true, escoffierA4IncludedInResistance: false },
    required: ["escoffierArkheAvailable", "escoffierCryoHydroMembers", "escoffierA4InitiallyActive", "escoffierInitialHitConnected", "escoffierA4IncludedInResistance"], trueOnly: ["escoffierArkheAvailable", "escoffierInitialHitConnected"] },
] as const;
function periodicDocument(spec: typeof periodicCases[number]) {
  const doc = getCharacterDocuments(spec.characterId, 1).find(candidate => candidate.gameContext?.skillId === spec.skillId);
  if (!doc?.gameContext) throw new Error(`Missing existing periodic action ${spec.skillId}`);
  doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id);
  doc.characterLevel = 90; doc.gameContext.ascension = 6; doc.gameContext.constellation = 0;
  doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 50, critRate: .5, critDamage: 1 }, source: "Explicit confirmed periodic contacts and stable samples; passive accounting supplied separately" };
  for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
  doc.gameContext.batchPeriodicCast = { completeCastConfirmed: true, statsStableAcrossHits: true, ...spec.context };
  return doc;
}
function cryoDocument(characterId: string, skillId: RegisteredContextSkill, gender: string, kind: "skill" | "burst") {
  const doc = getCharacterDocuments(characterId, 1).find(candidate => candidate.gameContext?.skillId === skillId);
  if (!doc?.gameContext) throw new Error(`Missing registered Cryo action ${skillId}`);
  doc.scope = "single-hit";
  doc.selectedHitIds = [doc.hits[0]!.id];
  doc.characterLevel = 90;
  doc.gameContext.ascension = 6;
  doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 20, critRate: .5, critDamage: 1 },
    source: "Explicit hit panel; actual non-Extra ATK is separately supplied, not inferred from final ATK" };
  doc.gameContext.travelerCryoStateCast = {
    casterId: gender, targetId: "enemy", noHitlag: true, trueMoonStoryBuffEnabled: false,
    independentEvent: kind === "skill"
      ? { candidateId: "initial", templateRole: "initial", frame: 19, snapshotFrame: 19, snapshotId: "observed-panel", targetId: "enemy" }
      : { candidateId: "burst-1", templateRole: "burst-ordinary", frame: 42, snapshotFrame: 36, snapshotId: "observed-panel", targetId: "enemy", radiance: "none", frostglowStacks: 0 },
    sharedState: { nonExtraAtk: 1000, includedA4Em: 0 },
  };
  return doc;
}
function crossDocument(characterId: string, skillId: RegisteredContextSkill, element: "anemo" | "dendro") {
  const doc = getCharacterDocuments(characterId, element === "anemo" ? 10 : 14).find(candidate => candidate.gameContext?.skillId === skillId);
  if (!doc?.gameContext) throw new Error(`Missing registered Traveler action ${skillId}`);
  doc.scope = "single-hit";
  doc.selectedHitIds = [doc.hits[0]!.id];
  doc.characterLevel = 90;
  doc.gameContext.ascension = 6;
  doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 50, critRate: .5, critDamage: 1 },
    source: "Explicit offensive sample; Dendro impact EM is independently supplied" };
  for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
  doc.gameContext.travelerCrossEntityCast = { trueMoonStoryBuffInactive: true,
    ...(element === "dendro" ? { sharedState: { untransformedAtHit: true, actualEm: 200, actualEmIncludesLotuslight: true, includedA4DamageBonus: 0 } } : {}) };
  return doc;
}
function observedDocument(characterId: string, skillId: RegisteredContextSkill): CalculatorDocument {
  const doc = getCharacterDocuments(characterId, 1).find(candidate => candidate.gameContext?.skillId === skillId);
  if (!doc?.gameContext) throw new Error(`Missing registered Hydro action ${skillId}`);
  doc.scope = "one-cast";
  doc.characterLevel = 90;
  doc.gameContext.ascension = 6;
  doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
  doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 9999, hp: 20000, def: 1000, em: 0, critRate: 0, critDamage: 0 },
    source: "Current panel must not replace either observed offensive sample" };
  doc.gameContext.travelerHydroResolvedCast = createObservedHydroHoldContext();
  return doc;
}

// This list comes from the declared source-observation contract, not failed output.
const requiredHydroFields = ["casterId", "targetId", "trueMoonStoryBuffInactive", "freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement",
  "fullObservedLifetime", "allHpChangesRecorded", "allDamageEventsRecorded", "observedThroughFrame", "initialCurrentHp", "initialMaxHp",
  "releaseFrame", "releaseOrder", "dewCount", "spiritbreathTriggered", "hpEvents", "events", "targetContacts", "snapshots", "sharedState"] as const;

describe("statically registered default-context contracts", () => {
  it("keeps every registered action attached to a positive numeric-oracle family", () => {
    expect(Object.keys(DEFAULT_CONTEXT_CONTRACTS).sort()).toEqual([
      ...[...hydroCases, ...crossCases, ...cryoCases, ...cryoCompleteCases, ...electroCases, ...heldDendroCases, ...heldHydroCases, ...heldPyroCases, ...maleChargedCases].map(([, skill]) => skill),
      ...periodicCases.map(spec => spec.skillId),
      ...finiteCases.map(spec => spec.skillId),
      ...normalCoordinatedCases.map(([, skillId]) => skillId),
      ...xiaoCases.map(([skillId]) => skillId),
      "ningguang-burst-with-screen",
      "idle-zhongli-hold-skill-c0",
      "coordinated-fischl-skill-c0", "coordinated-fischl-burst-c0",
      "noelle-plunge-low-observed-c0", "noelle-plunge-high-observed-c0",
      "held-noelle-charged-c0",
      "coordinated-albedo-skill-c0", "coordinated-yoimiya-burst-c0", "coordinated-raiden-skill-c0",
      "finite-followup-keqing-skill-recast-c0", "finite-followup-keqing-skill-detonation-c0", "finite-followup-xinyan-skill-level3-c0",
      ...simpleProjectileCases.map(([, skillId]) => skillId),
      ...hutaoCases.map(([skillId]) => skillId),
      ...cynoDefaultCases.map(([skillId]) => skillId),
      ...wandererDefaultCases.map(([skillId]) => skillId),
      "observed-hutao-skill-c0", "kazuha-burst-complete", "idle-yanfei-burst-c0", "observed-aloy-skill-c0",
      "kuki-burst-high-hp-complete-cast", "kuki-burst-low-hp-complete-cast",
      "collei-skill-no-sprout-complete", "collei-skill-sprout-complete", "collei-skill-extended-sprout-complete",
      "idle-nilou-skill-c0", "idle-alhaitham-skill-c0",
      "finite-followup-cyno-skill-no-endseer-c0", "finite-followup-cyno-skill-endseer-c0",
      "chevreuse-burst-complete-cast-c0", "chevreuse-skill-press-complete-cast-c0-arkhe-ready", "chevreuse-skill-hold-complete-cast-c0-arkhe-ready", "chevreuse-skill-overcharged-complete-cast-c0-arkhe-ready",
      "arlecchino-red-death-normal-1", "arlecchino-red-death-normal-2", "arlecchino-red-death-normal-3", "arlecchino-red-death-normal-4-hit-1", "arlecchino-red-death-normal-4-hit-2", "arlecchino-red-death-normal-5", "arlecchino-red-death-normal-6",
      "kinich-loop-shot-single", "kinich-loop-shot-pair", "kinich-scalespiker-cannon",
      "extended-ifa-skill-c0",
      "periodic-ordinary-ineffa-skill-no-lunar-c0",
      ...rawSourceCases.map(([, id]) => id),
      "mixed-lauma-hold-skill-c0",
      "periodic-ordinary-lauma-skill-press-c0",
      "mixed-flins-burst-c0",
      "nefer-phantasm-observed-c0",
      "durin-white-q-tick",
      "durin-denial-of-darkness",
      "entity-followup-jahoda-burst-c0",
      "entity-followup-odette-skill-c0",
      "entity-followup-odette-burst-c0",
      "mixed-odette-coda-c0",
      "periodic-ordinary-columbina-skill-no-lunar-c0",
      "zibai-finite-spirit-steed-c0",
      "zibai-finite-burst-c0",
      "extended-varka-skill-c0",
      "lohen-plunge-low-observed-base", "lohen-plunge-high-observed-base",
      "linnea-plunge-low-observed-base", "linnea-plunge-high-observed-base",
      "sandrone-plunge-low-observed-base", "sandrone-plunge-high-observed-base",
      "alyosha-plunge-low-observed-base", "alyosha-plunge-high-observed-base",
      "sandrone-charged-beam-stellar-conduct-component",
      "sandrone-charged-beam-stellar-swirl-component",
      "sandrone-skill-prism-stellar-conduct-component", "sandrone-skill-prism-stellar-swirl-component",
      "sandrone-burst-ray-stellar-conduct-component", "sandrone-burst-ray-stellar-swirl-component",
      "linnea-lumi-heavy-overdrive-hammer-component",
      "linnea-lumi-million-ton-crush-component",
      "entity-followup-nicole-burst-c0",
      "nicole-skill",
      "extended-prune-skill-c0",
      "iansan-swift-resolved-c0",
      "periodic-ordinary-chasca-burst-c0",
      "kachina-skill-observed-lifecycle",
      "kachina-plunge-low-with-collision", "kachina-plunge-high-with-collision",
      "observed-emilie-burst-c0",
      "observed-emilie-skill-c0",
      "idle-chiori-skill-c0",
      "gaming-charmed-cloudstrider",
      "observed-furina-skill-ousia-c0",
      "charlotte-skill-press-complete", "charlotte-skill-hold-complete",
      "neuvillette-skill", "neuvillette-skill-complete-cast-c0-arkhe-ready",
      "baizhu-skill-complete-cast-c0",
      "coordinated-dehya-skill-fresh-c0", "coordinated-dehya-skill-reposition-c0",
      "observed-layla-skill-c0", "idle-wanderer-skill-c0", "observed-yaoyao-burst-c0",
      "finite-followup-faruzan-skill-hurricane-c0", "finite-followup-faruzan-burst-fresh-c0",
      "alhaitham-projection-1-mirror", "alhaitham-projection-2-mirrors", "alhaitham-projection-3-mirrors",
    ].sort());
    expect(new Set(Object.values(DEFAULT_CONTEXT_CONTRACTS).map(contract => contract.family))).toEqual(new Set(["observed-hydro-hold", "traveler-cross-single-hit", "traveler-cryo-observed-hit", "traveler-cryo-conditional-complete", "traveler-electro-observed-schedule", "held-dendro-independent-hit", "held-hydro-no-suffusion", "held-pyro-observed-hold", "male-charged-observed-physical", "periodic-explicit-conditions", "finite-explicit-contacts", "coordinated-normal-observation", "xiao-selected-q-hit", "ningguang-historical-screen", "projectile-stable-conditions", "zhongli-observed-stele", "fischl-observed-oz", "noelle-observed-plunge", "noelle-observed-charge", "coordinated-observed-damage", "finite-followup-keqing-xinyan", "hutao-selected-paramita", "observed-hutao-marker", "kazuha-explicit-complete", "yanfei-actual-initial", "aloy-reference-protocol", "kuki-cast-hp-branch", "collei-return-snapshot", "initial-cast-scaling", "cyno-selected-q-normal", "cyno-finite-e-branch", "layla-observed-volley", "wanderer-actual-primary", "wanderer-actual-initial", "faruzan-finite-e-initial-q", "alhaitham-actual-projection", "yaoyao-observed-q-tail", "dehya-observed-field", "baizhu-actual-cast-hp", "neuvillette-actual-a4", "charlotte-actual-mark", "furina-observed-salon", "chevreuse-actual-passive-samples", "gaming-actual-hit-hp", "chiori-observed-single-doll", "arlecchino-actual-bond", "emilie-observed-level1", "emilie-observed-q-selection", "kachina-observed-physical-plunge", "kachina-observed-mode-ledger", "kinich-actual-e-contact", "chasca-observed-bullet-order", "iansan-actual-swift-inactive-q", "ifa-observed-ended-shots", "ineffa-observed-no-lunar", "raw-source-explicit-state", "lauma-observed-mixed-hold", "lauma-observed-ordinary-press", "flins-observed-mixed-burst", "nefer-observed-five-part-phantasm", "durin-actual-white-q-tick", "durin-selected-black-e", "jahoda-observed-pyro-a1", "odette-observed-ordinary-skill", "odette-observed-ordinary-burst", "odette-observed-coda", "columbina-observed-no-lunar", "zibai-observed-finite-steed", "zibai-observed-finite-burst", "varka-observed-two-normal", "lohen-observed-physical-plunge", "linnea-observed-physical-plunge", "linnea-actual-hammer-component", "linnea-actual-crush-component", "nicole-observed-owner-projection", "nicole-actual-initial-skill", "prune-observed-first-swirl", "sandrone-observed-physical-plunge", "alyosha-observed-physical-plunge", "sandrone-actual-conduct-beam", "sandrone-actual-swirl-beam", "sandrone-actual-prism", "sandrone-actual-burst-ray"]));
    expect(defaultContextContract("unknown-future-action")).toBeUndefined();
  });
  for (const [characterId, skillId] of hydroCases) {
    it(`${skillId}: default stays blocked; explicit HP chronology and snapshots meet the independent E1 oracle`, () => {
      const initial = getCharacterDocuments(characterId, 10).find(doc => doc.gameContext?.skillId === skillId)!;
      const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS[skillId];
      expect(blocked.status).toBe("blocked");
      expect(blocked.totals).toBeUndefined();
      expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
      expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
      const document = observedDocument(characterId, skillId);
      const prepared = prepareSourceCastDocument(document), result = calculateDocument(prepared);
      expect(result.status).toBe("calculated");
      expect(result.blockers).toEqual([]);
      expect(prepared.gameContext?.scopeCoverage).toBe("complete-cast");
      expect(result.hits).toHaveLength(2);
      expect(result.hits.find(hit => hit.id.endsWith(":dew-1"))?.expected).toBeCloseTo((1000 * .328 + 20000 * .0064) * .5 * .9 * 1.5, 8);
      expect(result.hits.find(hit => hit.id.endsWith(":torrent"))?.expected).toBeCloseTo((2000 * 1.8928 + 800 * .45) * .5 * .9 * 1.5, 8);
      expect(result.totals?.expected).toBeCloseTo(3106.08, 8);
    });
    it.each(["dew-contact", "torrent-contact", "dew-snapshot", "torrent-snapshot", "hp-read-frame", "hp-read-order", "included-source-flat"] as const)(`${skillId}: missing nested %s remains blocked`, missing => {
      const document = observedDocument(characterId, skillId);
      const context = document.gameContext!.travelerHydroResolvedCast!;
      if (missing === "dew-contact") delete context.targetContacts!["dew-1"];
      else if (missing === "torrent-contact") delete context.targetContacts!.torrent;
      else if (missing === "dew-snapshot") delete context.snapshots!["snapshot-60"];
      else if (missing === "torrent-snapshot") delete context.snapshots!["snapshot-57"];
      else if (missing === "hp-read-frame") delete context.events![0]!.hpReadFrame;
      else if (missing === "hp-read-order") delete context.events![0]!.hpReadOrder;
      else delete context.sharedState!.includedSourceFlatDamage;
      const result = calculateDocument(prepareSourceCastDocument(document));
      expect(result.status).toBe("blocked");
      expect(result.totals).toBeUndefined();
      expect(result.blockers.length).toBeGreaterThan(0);
    });
    it.each(requiredHydroFields)(`${skillId}: removing required %s cannot calculate a complete cast`, field => {
      const document = observedDocument(characterId, skillId);
      delete document.gameContext!.travelerHydroResolvedCast![field];
      const result = calculateDocument(prepareSourceCastDocument(document));
      expect(result.status).toBe("blocked");
      expect(result.totals).toBeUndefined();
      expect(result.blockers.length).toBeGreaterThan(0);
    });
  }
});


describe("Traveler cross-entity independent-hit default contracts", () => {
  for (const [characterId, skillId, element] of crossCases) {
    it(`${skillId}: default is blocked and explicit single-hit state meets the pinned coefficient oracle`, () => {
      const initial = getCharacterDocuments(characterId, 10).find(doc => doc.gameContext?.skillId === skillId)!;
      const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS[skillId];
      expect(blocked.status).toBe("blocked");
      expect(blocked.totals).toBeUndefined();
      expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
      expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
      const document = crossDocument(characterId, skillId, element), result = calculateDocument(document);
      expect(result.status).toBe("calculated");
      expect(result.blockers).toEqual([]);
      expect(result.hits).toHaveLength(1);
      // Anemo T10 1.4544 and Dendro T14 1.8036 are the pinned Optimizer vectors,
      // already independently asserted by the source and cross-source suites.
      const expected = element === "anemo" ? 2000 * 1.4544 * .5 * .9 : 2000 * 1.8036 * .5 * .9 * (1 + 200 * .001);
      expect(result.totals?.nonCritical).toBeCloseTo(expected, 8);
      expect(result.totals?.critical).toBeCloseTo(expected * 2, 8);
      expect(result.totals?.expected).toBeCloseTo(expected * 1.5, 8);
      expect(document.gameContext!.travelerCrossEntityCast).not.toHaveProperty("targetContacts");
      expect(document.gameContext!.travelerCrossEntityCast).not.toHaveProperty("fullObservedLifetime");
      expect(document.gameContext!.travelerCrossEntityCast).not.toHaveProperty("independentEvent");
    });
    it.each(["missing", "false"] as const)(`${skillId}: %s story-buff qualification remains blocked`, mode => {
      const document = crossDocument(characterId, skillId, element);
      if (mode === "missing") delete document.gameContext!.travelerCrossEntityCast!.trueMoonStoryBuffInactive;
      else document.gameContext!.travelerCrossEntityCast!.trueMoonStoryBuffInactive = false;
      const result = calculateDocument(document);
      expect(result.status).toBe("blocked");
      expect(result.totals).toBeUndefined();
    });
    if (element === "dendro") {
      it.each(["untransformedAtHit", "actualEm", "actualEmIncludesLotuslight", "includedA4DamageBonus"] as const)(`${skillId}: missing %s cannot invent the impact state`, field => {
        const document = crossDocument(characterId, skillId, element);
        delete document.gameContext!.travelerCrossEntityCast!.sharedState![field];
        const result = calculateDocument(document);
        expect(result.status).toBe("blocked");
        expect(result.totals).toBeUndefined();
      });
      it.each(["untransformedAtHit", "actualEmIncludesLotuslight"] as const)(`${skillId}: false %s is not a qualified hit`, field => {
        const document = crossDocument(characterId, skillId, element);
        document.gameContext!.travelerCrossEntityCast!.sharedState![field] = false;
        const result = calculateDocument(document);
        expect(result.status).toBe("blocked");
        expect(result.totals).toBeUndefined();
      });
      it(`${skillId}: zero actual EM and already-included A4 have explicit independent arithmetic`, () => {
        const zero = crossDocument(characterId, skillId, element);
        zero.gameContext!.travelerCrossEntityCast!.sharedState!.actualEm = 0;
        expect(calculateDocument(zero).totals?.nonCritical).toBeCloseTo(2000 * 1.8036 * .5 * .9, 8);
        const included = crossDocument(characterId, skillId, element);
        included.gameContext!.travelerCrossEntityCast!.sharedState!.includedA4DamageBonus = .2;
        for (const hit of included.hits) if (hit.kind === "ordinary") hit.damageBonus = .2;
        expect(calculateDocument(included).totals?.nonCritical).toBeCloseTo(2000 * 1.8036 * .5 * .9 * 1.2, 8);
      });
    }
  }
});


describe("Cryo Traveler observed single-hit and ASC6 accounting contracts", () => {
  for (const [characterId, skillId, gender, kind] of cryoCases) {
    const fixture = () => cryoDocument(characterId, skillId, gender, kind);
    const expectBlocked = (document: CalculatorDocument) => {
      const result = calculateDocument(document);
      expect(result.status).toBe("blocked");
      expect(result.totals).toBeUndefined();
      expect(result.blockers.some(reason => reason.startsWith("traveler-cryo-state:"))).toBe(true);
    };
    // Independent a7dc4bf archive E1 and ordinary Q1 constants; not read from
    // calculated hits. Special Q coefficients belong to a different protocol.
    const coefficient = kind === "skill" ? .9168 : .55131;
    it(`${skillId}: unknown defaults block; an observed ASC6 hit has explicit damage and actual A4 EM`, () => {
      const initial = getCharacterDocuments(characterId, 10).find(doc => doc.gameContext?.skillId === skillId)!;
      const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS[skillId];
      expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined();
      expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
      expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
      const document = fixture(), result = calculateDocument(document);
      expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(1);
      expect(result.totals?.nonCritical).toBeCloseTo(2000 * coefficient * .5 * .9, 8);
      expect(result.totals?.critical).toBeCloseTo(2000 * coefficient * .5 * .9 * 2, 8);
      expect(result.totals?.expected).toBeCloseTo(2000 * coefficient * .5 * .9 * 1.5, 8);
      // Damage with no reaction cannot prove EM bookkeeping; assert the evaluated
      // source contribution and final hit EM separately from that damage oracle.
      expect(result.hits[0]!.trace.find(node => node.id === "sourceElementalMasteryAdjustment")?.result?.value).toBe(80);
      expect(result.hits[0]!.trace.find(node => node.id === "hitElementalMastery")?.result?.value).toBe(100);
      expect(document.gameContext!.travelerCryoStateCast).not.toHaveProperty("fullObservedLifetime");
      expect(document.gameContext!.travelerCryoStateCast).not.toHaveProperty("triggerCallbacks");
      expect(document.gameContext!.travelerCryoStateCast).not.toHaveProperty("targetContacts");
    });
    it.each(["independentEvent", "casterId", "targetId", "noHitlag", "trueMoonStoryBuffEnabled", "sharedState"] as const)(`${skillId}: missing %s is not supplied by a default`, field => {
      const doc = fixture(); delete doc.gameContext!.travelerCryoStateCast![field]; expectBlocked(doc);
    });
    it.each(["nonExtraAtk", "includedA4Em"] as const)(`${skillId}: missing ASC6 %s remains unknown`, field => {
      const doc = fixture(); delete doc.gameContext!.travelerCryoStateCast!.sharedState![field]; expectBlocked(doc);
    });
    it.each(["hitlag", "story-buff", "target-mismatch", "frame", "snapshot-frame"] as const)(`${skillId}: contradictory %s remains blocked`, field => {
      const doc = fixture(), context = doc.gameContext!.travelerCryoStateCast!;
      if (field === "hitlag") context.noHitlag = false;
      else if (field === "story-buff") context.trueMoonStoryBuffEnabled = true;
      else if (field === "target-mismatch") context.independentEvent!.targetId = "other-enemy";
      else if (field === "frame") context.independentEvent!.frame++;
      else context.independentEvent!.snapshotFrame++;
      expectBlocked(doc);
    });
    it(`${skillId}: level90 does not silently prove ascension`, () => {
      const doc = fixture(); if (doc.build.mode !== "manual-final") throw new Error("manual fixture required");
      delete doc.gameContext!.ascension; delete doc.build.ascension; expectBlocked(doc);
    });
    it.each([[0, 0, 20, 0, 20], [3000, 0, 20, 160, 180], [1000, 80, 100, 0, 100]] as const)(`${skillId}: non-Extra ATK %i and included EM %i retain explicit cap/subtraction`, (nonExtraAtk, includedA4Em, panelEm, delta, hitEm) => {
      const doc = fixture(); doc.gameContext!.travelerCryoStateCast!.sharedState = { nonExtraAtk, includedA4Em };
      if (doc.build.mode !== "manual-final") throw new Error("manual fixture required");
      doc.build.stats.em = panelEm;
      const result = calculateDocument(doc); expect(result.status).toBe("calculated");
      expect(result.hits[0]!.trace.find(node => node.id === "sourceElementalMasteryAdjustment")?.result?.value).toBe(delta);
      expect(result.hits[0]!.trace.find(node => node.id === "hitElementalMastery")?.result?.value).toBe(hitEm);
    });
    it(`${skillId}: historical ASC6 snapshot must already include its actual A4 share`, () => {
      const doc = fixture(), context = doc.gameContext!.travelerCryoStateCast!;
      context.snapshots = { "observed-panel": { stats: { atk: 1200, hp: 20000, def: 800, em: 100, critRate: .5, critDamage: 1 }, characterLevel: 90, ascension: 6,
        damageBonus: 0, additiveBaseDamage: 0, reactionBonus: 0, source: "Explicit independent historical offensive sample", sourceRefs: ["synthetic:observed-historical-panel"] } };
      expectBlocked(doc); // included0 must not add an unrecorded80 to a final snapshot.
      context.sharedState!.includedA4Em = 80;
      const result = calculateDocument(doc); expect(result.status).toBe("calculated");
      expect(result.totals?.nonCritical).toBeCloseTo(1200 * coefficient * .5 * .9, 8);
      // Final snapshots restore recorded EM and intentionally do not execute A4 again.
      expect(result.hits[0]!.trace.find(node => node.id === "snapshot.em")?.result?.value).toBe(100);
      expect(result.hits[0]!.trace.some(node => node.id === "sourceElementalMasteryAdjustment")).toBe(false);
      const melted = prepareSourceCastDocument(doc);
      for (const hit of melted.hits) if (hit.kind === "ordinary" && melted.selectedHitIds.includes(hit.id)) hit.reaction = "reverseMelt";
      expect(calculateDocument(melted).totals?.nonCritical).toBeCloseTo(1200 * coefficient * .5 * .9 * 1.5 * (1 + 2.78 * 100 / (1400 + 100)), 8);
    });
    if (kind === "burst") {
      it.each(["radiance", "frostglowStacks"] as const)(`${skillId}: missing Q %s cannot select a branch`, field => {
        const doc = fixture(); delete doc.gameContext!.travelerCryoStateCast!.independentEvent![field]; expectBlocked(doc);
      });
      it(`${skillId}: Q role must match its observed radiance`, () => {
        const doc = fixture(); doc.gameContext!.travelerCryoStateCast!.independentEvent!.radiance = "stellar-conduct"; expectBlocked(doc);
      });
    }
  }
  for (const [characterId, skillId, kind, stacks, hitCount] of cryoCompleteCases) {
    const fixture = () => cryoCompleteDocument(characterId, skillId, stacks);
    const expectBlocked = (doc: CalculatorDocument) => {
      const result = calculateDocument(doc);
      expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined();
      expect(result.blockers.length).toBeGreaterThan(0);
    };
    // Independent pinned a7dc4bf4 talent-1 constants: do not read the executed formula table.
    const coefficient = kind === "skill" ? .9168 + 8 * .21392 : hitCount * (.55131 + stacks * .027565);
    it(`${skillId}: defaults remain unknown; explicit full-cast conditions meet the independent talent-1 oracle`, () => {
      const initial = getCharacterDocuments(characterId, 10).find(doc => doc.gameContext?.skillId === skillId)!;
      const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS[skillId];
      expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined();
      expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
      expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
      const result = calculateDocument(fixture());
      expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]);
      expect(result.hits).toHaveLength(hitCount);
      expect(result.totals?.nonCritical).toBeCloseTo(2000 * coefficient * .5 * .9, 8);
      expect(result.totals?.expected).toBeCloseTo(2000 * coefficient * .5 * .9 * 1.5, 8);
      for (const hit of result.hits) {
        expect(hit.trace.find(node => node.id === "sourceElementalMasteryAdjustment")?.result?.value).toBe(80);
        expect(hit.trace.find(node => node.id === "hitElementalMastery")?.result?.value).toBe(100);
      }
      const melt = fixture();
      for (const hit of melt.hits) if (hit.kind === "ordinary") hit.reaction = "reverseMelt";
      expect(calculateDocument(melt).totals?.nonCritical).toBeCloseTo(2000 * coefficient * .5 * .9 * 1.5 * (1 + 2.78 * 100 / 1500), 8);
    });
    it.each(["radiance", "trueMoonStoryBuff", "statsStableAcrossHits", "nonExtraAtk", "a4IncludedEm"] as const)(`${skillId}: missing required %s remains blocked`, field => {
      const doc = fixture(); delete doc.gameContext!.travelerCryo![field]; expectBlocked(doc);
    });
    it.each(["radiance", "story", "unstable", "constellation", "ascension"] as const)(`${skillId}: contradictory or absent %s does not inherit approval`, field => {
      const doc = fixture(), context = doc.gameContext!.travelerCryo!;
      if (field === "radiance") context.radiance = "stellar-conduct";
      else if (field === "story") context.trueMoonStoryBuff = true;
      else if (field === "unstable") context.statsStableAcrossHits = false;
      else if (field === "constellation") doc.gameContext!.constellation = 1;
      else { delete doc.gameContext!.ascension; if (doc.build.mode === "manual-final") delete doc.build.ascension; }
      expectBlocked(doc);
    });
    it.each([[0, 0, 20, 0, 20], [3000, 0, 20, 160, 180], [1000, 80, 100, 0, 100]] as const)(`${skillId}: non-Extra %i and included %i preserve A4 zero/cap/subtraction`, (nonExtraAtk, a4IncludedEm, panelEm, delta, hitEm) => {
      const doc = fixture(); Object.assign(doc.gameContext!.travelerCryo!, { nonExtraAtk, a4IncludedEm });
      if (doc.build.mode !== "manual-final") throw new Error("manual fixture required");
      doc.build.stats.em = panelEm;
      const result = calculateDocument(doc); expect(result.status).toBe("calculated");
      for (const hit of result.hits) {
        expect(hit.trace.find(node => node.id === "sourceElementalMasteryAdjustment")?.result?.value).toBe(delta);
        expect(hit.trace.find(node => node.id === "hitElementalMastery")?.result?.value).toBe(hitEm);
      }
    });
    if (kind === "skill") {
      it.each(["missing", "interrupted"] as const)(`${skillId}: %s lifetime cannot establish nine contacts`, mode => {
        const doc = fixture(); if (mode === "missing") delete doc.gameContext!.travelerCryo!.skillUninterrupted;
        else doc.gameContext!.travelerCryo!.skillUninterrupted = false;
        expectBlocked(doc);
      });
    } else {
      it(`${skillId}: missing actual consumed stacks cannot become zero`, () => {
        const doc = fixture(); delete doc.gameContext!.travelerCryo!.frostglowStacksAtBurst; expectBlocked(doc);
      });
      it(`${skillId}: actual stacks must match the three/five-hit menu`, () => {
        const doc = fixture(); doc.gameContext!.travelerCryo!.frostglowStacksAtBurst = hitCount === 5 ? 7 : 8; expectBlocked(doc);
      });
    }
  }

});


describe("Electro Traveler explicitly observed coordinated schedule contracts", () => {
  for (const [characterId, skillId] of electroCases) {
    const fixture = () => electroDocument(characterId, skillId);
    const expectBlocked = (doc: CalculatorDocument) => {
      const result = calculateDocument(doc);
      expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0);
    };
    const expected = (procs: number) => 2000 * (1.144 + procs * .328) * .5 * .9;
    it(`${skillId}: explicit four triggers meet independent Q1 damage and integer-frame oracles`, () => {
      const initial = getCharacterDocuments(characterId, 10).find(doc => doc.gameContext?.skillId === skillId)!;
      const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS[skillId];
      expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined();
      expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
      expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
      const prepared = prepareCoordinatedCastDocument(fixture()), result = calculateDocument(prepared);
      expect(prepared.gameContext?.scopeCoverage).toBe("complete-cast");
      expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(5);
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.coordinatedEvent?.frame : null)).toEqual([37, 101, 131, 161, 252]);
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.coordinatedEvent?.snapshotFrame : null)).toEqual([0, 0, 0, 0, 0]);
      expect(result.totals?.nonCritical).toBeCloseTo(expected(4), 8);
      expect(result.totals?.expected).toBeCloseTo(expected(4) * 1.5, 8);
    });
    it.each(["casterId", "targetId", "freshCastConfirmed", "fullObservedLifetime", "observedThroughFrame", "noHitlag", "noReplacement", "noInterruption", "allGeneratedHitsConfirmed", "statsStableAcrossHits", "damageEvents"] as const)(`${skillId}: missing required %s remains unknown`, field => {
      const doc = fixture(); delete doc.gameContext!.coordinatedCast![field]; expectBlocked(doc);
    });
    it.each(["freshCastConfirmed", "fullObservedLifetime", "noHitlag", "noReplacement", "noInterruption", "allGeneratedHitsConfirmed", "statsStableAcrossHits"] as const)(`${skillId}: false %s cannot authorize complete damage`, field => {
      const doc = fixture(); doc.gameContext!.coordinatedCast![field] = false; expectBlocked(doc);
    });
    it.each(["actorId", "activeActorId", "tag", "targetId", "origin"] as const)(`${skillId}: missing event %s cannot imply eligibility`, field => {
      const doc = fixture(); delete doc.gameContext!.coordinatedCast!.damageEvents![0]![field]; expectBlocked(doc);
    });
    it(`${skillId}: incomplete observation and unknown cross-target delivery stay blocked`, () => {
      const short = fixture(); short.gameContext!.coordinatedCast!.observedThroughFrame = 719; expectBlocked(short);
      const other = fixture(); other.gameContext!.coordinatedCast!.damageEvents![0]!.targetId = "other-enemy"; expectBlocked(other);
    });
    it(`${skillId}: a known inactive actor suppresses its trigger rather than inventing a missing-context failure`, () => {
      const doc = fixture(); doc.gameContext!.coordinatedCast!.damageEvents![0]!.activeActorId = "other-driver";
      const result = calculateDocument(doc); expect(result.status).toBe("calculated");
      expect(result.hits).toHaveLength(4); expect(result.totals?.nonCritical).toBeCloseTo(expected(3), 8);
    });
    it(`${skillId}: explicitly empty events mean initial hit only, not a maximal lifetime proc count`, () => {
      const doc = fixture(); doc.gameContext!.coordinatedCast!.damageEvents = [];
      const result = calculateDocument(doc); expect(result.status).toBe("calculated");
      expect(result.hits).toHaveLength(1); expect(result.totals?.nonCritical).toBeCloseTo(expected(0), 8);
    });
    it(`${skillId}: thirty-frame cooldown, exclusive720 expiry and one-frame queued tail retain exact ordering`, () => {
      const doc = fixture(), context = doc.gameContext!.coordinatedCast!;
      const source = context.damageEvents![0]!;
      context.damageEvents!.push(...[129, 719, 720].map(frame => ({ ...source, id: `boundary-${frame}`, frame })));
      const prepared = prepareCoordinatedCastDocument(doc), result = calculateDocument(prepared);
      expect(result.status).toBe("calculated");
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.coordinatedEvent?.frame : null)).toEqual([37, 101, 131, 161, 252, 720]);
      expect(result.totals?.nonCritical).toBeCloseTo(expected(5), 8);
    });
  }
});


describe("Dendro Traveler occurred explosion impact-A4 contracts", () => {
  for (const [characterId, skillId] of heldDendroCases) {
    const fixture = () => heldDendroDocument(characterId, skillId);
    const expectBlocked = (doc: CalculatorDocument) => {
      const result = calculateDocument(doc);
      expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0);
    };
    it(`${skillId}: missing impact accounting is not defaulted from panel EM`, () => {
      const initial = getCharacterDocuments(characterId, 10).find(doc => doc.gameContext?.skillId === skillId)!;
      const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS[skillId];
      expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined();
      expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
      expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
      const doc = fixture(), result = calculateDocument(doc);
      expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(1);
      // Pinned b4ae769 Q1 explosion4.008; A4 uses actual impactEM300, not panelEM50.
      expect(result.totals?.nonCritical).toBeCloseTo(2000 * 4.008 * 1.3 * .5 * .9, 8);
      expect(result.totals?.expected).toBeCloseTo(2000 * 4.008 * 1.3 * .5 * .9 * 1.5, 8);
      expect(result.hits[0]!.trace.find(node => node.id === "customDamageBonus")?.result?.value).toBeCloseTo(.3, 10);
      expect(doc.gameContext!.heldLifecycleCast).not.toHaveProperty("fullObservedLifetime");
      expect(doc.gameContext!.heldLifecycleCast).not.toHaveProperty("targetContacts");
    });
    it.each(["actualElementalMasteryAtHit", "includedDamageBonus"] as const)(`${skillId}: missing %s stays unknown`, field => {
      const doc = fixture(); delete doc.gameContext!.heldLifecycleCast!.sharedState![field]; expectBlocked(doc);
    });
    it(`${skillId}: missing actual ascension or entire impact context remains blocked`, () => {
      const doc = fixture(); delete doc.gameContext!.ascension; if (doc.build.mode === "manual-final") delete doc.build.ascension; expectBlocked(doc);
      const noContext = fixture(); delete noContext.gameContext!.heldLifecycleCast; expectBlocked(noContext);
    });
    it(`${skillId}: explicit zero impactEM is valid, not replaced by panelEM`, () => {
      const doc = fixture(); doc.gameContext!.heldLifecycleCast!.sharedState!.actualElementalMasteryAtHit = 0;
      const result = calculateDocument(doc); expect(result.status).toBe("calculated");
      expect(result.totals?.nonCritical).toBeCloseTo(2000 * 4.008 * .5 * .9, 8);
    });
    it(`${skillId}: already-included A4 is subtracted rather than counted twice`, () => {
      const doc = fixture(); doc.gameContext!.heldLifecycleCast!.sharedState!.includedDamageBonus = .3;
      for (const hit of doc.hits) if (hit.kind === "ordinary") hit.damageBonus = .3;
      const result = calculateDocument(doc); expect(result.status).toBe("calculated");
      expect(result.hits[0]!.trace.find(node => node.id === "customDamageBonus")?.result?.value).toBeCloseTo(0, 10);
      expect(result.totals?.nonCritical).toBeCloseTo(2000 * 4.008 * 1.3 * .5 * .9, 8);
    });
  }
});


describe("Hydro Traveler no-Suffusion observed-contact contracts", () => {
  for (const [characterId, skillId] of heldHydroCases) {
    const fixture = () => heldHydroDocument(characterId, skillId);
    const expectBlocked = (doc: CalculatorDocument) => {
      const result = calculateDocument(doc);
      expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0);
    };
    // Pinned b4ae769 talent1: each drop/Arkhe .328, Torrent1.8928, no HP Suffusion term.
    const expected = (smallHits: number) => 2000 * (smallHits * .328 + 1.8928) * .5 * .9;
    it(`${skillId}: exact observed contacts meet independent five-hit numeric and frame oracles`, () => {
      const initial = getCharacterDocuments(characterId, 10).find(doc => doc.gameContext?.skillId === skillId)!;
      const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS[skillId];
      expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined();
      expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
      expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
      const prepared = prepareSourceCastDocument(fixture()), result = calculateDocument(prepared);
      expect(prepared.gameContext?.scopeCoverage).toBe("complete-cast");
      expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(5);
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.heldLifecycleEvent?.frame : null)).toEqual([61, 76, 87, 91, 133]);
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.heldLifecycleEvent?.snapshotFrame : null)).toEqual([60, 75, 87, 90, 133]);
      expect(result.totals?.nonCritical).toBeCloseTo(expected(4), 8);
      expect(result.totals?.expected).toBeCloseTo(expected(4) * 1.5, 8);
    });
    it.each(["casterId", "targetId", "freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "observedThroughFrame", "statsStableAcrossHits", "targetContacts", "hydroHold"] as const)(`${skillId}: missing required %s stays blocked`, field => {
      const doc = fixture(); delete doc.gameContext!.heldLifecycleCast![field]; expectBlocked(doc);
    });
    it.each(["freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits"] as const)(`${skillId}: false %s cannot establish this complete branch`, field => {
      const doc = fixture(); doc.gameContext!.heldLifecycleCast![field] = false; expectBlocked(doc);
    });
    it.each(["dewdropCount", "travelFrames", "arkheReady", "hpRatiosBeforeDewdrops", "noHealingOrDropletPickup", "priorA4Bonus"] as const)(`${skillId}: missing hydro %s is not supplied by default`, field => {
      const doc = fixture(); delete doc.gameContext!.heldLifecycleCast!.hydroHold![field]; expectBlocked(doc);
    });
    it.each(["dewdrop-1", "dewdrop-2", "dewdrop-3", "torrent", "arkhe"] as const)(`${skillId}: missing %s contact cannot become a hit or a miss`, id => {
      const doc = fixture(); delete doc.gameContext!.heldLifecycleCast!.targetContacts![id]; expectBlocked(doc);
    });
    it.each(["healing", "prior-bonus", "hp-above-half", "missing-third-hp", "unobserved-tail"] as const)(`${skillId}: contradictory %s stays blocked`, change => {
      const doc = fixture(), context = doc.gameContext!.heldLifecycleCast!, hydro = context.hydroHold!;
      if (change === "healing") hydro.noHealingOrDropletPickup = false;
      else if (change === "prior-bonus") hydro.priorA4Bonus = 1;
      else if (change === "hp-above-half") hydro.hpRatiosBeforeDewdrops![1] = .5001;
      else if (change === "missing-third-hp") hydro.hpRatiosBeforeDewdrops!.pop();
      else context.observedThroughFrame = 132;
      expectBlocked(doc);
    });
    it(`${skillId}: a recorded miss removes only that drop instead of changing emitted count`, () => {
      const doc = fixture(); doc.gameContext!.heldLifecycleCast!.targetContacts!["dewdrop-2"] = false;
      const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.hits).toHaveLength(4);
      expect(result.totals?.nonCritical).toBeCloseTo(expected(3), 8);
      expect(doc.gameContext!.heldLifecycleCast!.hydroHold!.dewdropCount).toBe(3);
    });
    it(`${skillId}: known Arkhe cooldown removes its tail rather than fabricating readiness`, () => {
      const doc = fixture(); doc.gameContext!.heldLifecycleCast!.hydroHold!.arkheReady = false;
      // With no queued Arkhe, only the gender-specific action lifetime remains.
      doc.gameContext!.heldLifecycleCast!.observedThroughFrame = characterId === "character:10000005" ? 120 : 119;
      const prepared = prepareSourceCastDocument(doc), result = calculateDocument(prepared);
      expect(result.status).toBe("calculated"); expect(result.hits).toHaveLength(4);
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.heldLifecycleEvent?.frame : null)).toEqual([61, 76, 87, 91]);
      expect(result.totals?.nonCritical).toBeCloseTo(expected(3), 8);
    });
    it(`${skillId}: a queued Arkhe miss still needs observation through its actual tail frame`, () => {
      const doc = fixture(); doc.gameContext!.heldLifecycleCast!.targetContacts!.arkhe = false;
      expect(calculateDocument(doc).totals?.nonCritical).toBeCloseTo(expected(3), 8);
      doc.gameContext!.heldLifecycleCast!.observedThroughFrame = 132; expectBlocked(doc);
    });
    it(`${skillId}: zero-gauge Arkhe cannot receive an invented amplifying reaction`, () => {
      const doc = prepareSourceCastDocument(fixture());
      const arkhe = doc.hits.find(hit => hit.kind === "ordinary" && hit.heldLifecycleEvent?.templateRole === "arkhe");
      if (!arkhe || arkhe.kind !== "ordinary") throw new Error("Expected explicit Arkhe event");
      arkhe.reaction = "vaporize"; expectBlocked(doc);
    });
  }
});


describe("Pyro Traveler observed hold and queued-tail contracts", () => {
  for (const [characterId, skillId] of heldPyroCases) {
    const fixture = () => heldPyroDocument(characterId, skillId);
    const expectBlocked = (doc: CalculatorDocument) => {
      const result = calculateDocument(doc);
      expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0);
    };
    // Independent pinned b4ae769 E1 initial .988 and Scorching .8144.
    const expected = (procs: number) => 2000 * (.988 + procs * .8144) * .5 * .9;
    it(`${skillId}: explicit event history and contacts satisfy independent E1/frame oracles`, () => {
      const initial = getCharacterDocuments(characterId, 10).find(doc => doc.gameContext?.skillId === skillId)!;
      const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS[skillId];
      expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined();
      expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
      expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
      const prepared = prepareSourceCastDocument(fixture()), result = calculateDocument(prepared);
      expect(prepared.gameContext?.scopeCoverage).toBe("complete-cast");
      expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(4);
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.heldLifecycleEvent?.frame : null)).toEqual([37, 50, 232, 417]);
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.heldLifecycleEvent?.snapshotFrame : null)).toEqual([37, 50, 232, 417]);
      expect(result.totals?.nonCritical).toBeCloseTo(expected(3), 8);
      expect(result.totals?.expected).toBeCloseTo(expected(3) * 1.5, 8);
    });
    it.each(["casterId", "targetId", "freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "observedThroughFrame", "statsStableAcrossHits", "targetContacts", "pyro"] as const)(`${skillId}: missing required %s remains blocked`, field => {
      const doc = fixture(); delete doc.gameContext!.heldLifecycleCast![field]; expectBlocked(doc);
    });
    it.each(["freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits"] as const)(`${skillId}: false %s cannot establish this complete branch`, field => {
      const doc = fixture(); doc.gameContext!.heldLifecycleCast![field] = false; expectBlocked(doc);
    });
    it.each(["initialNightsoulPoints", "noExternalPointChanges", "initialDamagePositive", "damageEvents"] as const)(`${skillId}: missing Pyro %s is not silently supplied`, field => {
      const doc = fixture(); delete doc.gameContext!.heldLifecycleCast!.pyro![field]; expectBlocked(doc);
    });
    it.each(["actorId", "targetId", "tag", "origin", "damagePositive"] as const)(`${skillId}: missing event %s cannot imply a trigger`, field => {
      const doc = fixture(); delete doc.gameContext!.heldLifecycleCast!.pyro!.damageEvents![1]![field]; expectBlocked(doc);
    });
    it.each(["initial", "proc-external-e25", "proc-external-e220", "proc-external-e405"] as const)(`${skillId}: unknown %s contact is not a hit or miss`, id => {
      const doc = fixture(); delete doc.gameContext!.heldLifecycleCast!.targetContacts![id]; expectBlocked(doc);
    });
    it.each(["prior-points", "external-change", "unobserved-tail"] as const)(`${skillId}: unsupported %s remains blocked`, change => {
      const doc = fixture(), context = doc.gameContext!.heldLifecycleCast!;
      if (change === "prior-points") context.pyro!.initialNightsoulPoints = 1;
      else if (change === "external-change") context.pyro!.noExternalPointChanges = false;
      else context.observedThroughFrame = 416;
      expectBlocked(doc);
    });
    it(`${skillId}: a known zero-damage external event does not produce its Scorching hit`, () => {
      const doc = fixture(); doc.gameContext!.heldLifecycleCast!.pyro!.damageEvents![1]!.damagePositive = false;
      const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.hits).toHaveLength(3);
      expect(result.totals?.nonCritical).toBeCloseTo(expected(2), 8);
    });
    it(`${skillId}: explicitly empty external events preserve the independent initial self-trigger decision`, () => {
      const doc = fixture(), context = doc.gameContext!.heldLifecycleCast!; context.pyro!.damageEvents = [];
      let prepared = prepareSourceCastDocument(doc), result = calculateDocument(prepared);
      expect(result.status).toBe("calculated"); expect(result.totals?.nonCritical).toBeCloseTo(expected(1), 8);
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.heldLifecycleEvent?.frame : null)).toEqual([50, 62]);
      context.pyro!.initialDamagePositive = false;
      prepared = prepareSourceCastDocument(doc); result = calculateDocument(prepared);
      expect(result.status).toBe("calculated"); expect(result.hits).toHaveLength(1);
      expect(result.totals?.nonCritical).toBeCloseTo(expected(0), 8);
    });
    it(`${skillId}: cooldown plus180 rejects, plus181 accepts, and407 can queue a419 tail`, () => {
      const doc = fixture(), context = doc.gameContext!.heldLifecycleCast!;
      context.pyro!.damageEvents = [25, 205, 206, 407].map(frame => ({ id: `b${frame}`, frame, actorId: "driver", targetId: "enemy", tag: "normal", origin: "external", damagePositive: true }));
      context.targetContacts = { initial: true, "proc-external-b25": true, "proc-external-b206": true, "proc-external-b407": true };
      context.observedThroughFrame = 419;
      const prepared = prepareSourceCastDocument(doc), result = calculateDocument(prepared);
      expect(result.status).toBe("calculated");
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.heldLifecycleEvent?.frame : null)).toEqual([37, 50, 218, 419]);
      expect(result.totals?.nonCritical).toBeCloseTo(expected(3), 8);
    });
    it(`${skillId}: a fresh eligible-looking trigger at resource-expiry408 is excluded`, () => {
      const doc = fixture(), context = doc.gameContext!.heldLifecycleCast!;
      context.pyro!.initialDamagePositive = false;
      context.pyro!.damageEvents = [{ id: "expired", frame: 408, actorId: "driver", targetId: "enemy", tag: "normal", origin: "external", damagePositive: true }];
      context.targetContacts = { initial: true, "proc-external-expired": true }; context.observedThroughFrame = 420;
      const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.hits).toHaveLength(1);
      expect(result.totals?.nonCritical).toBeCloseTo(expected(0), 8);
    });
    it(`${skillId}: unresolved external/initial same-frame ordering stays blocked`, () => {
      const doc = fixture(), context = doc.gameContext!.heldLifecycleCast!;
      context.pyro!.damageEvents = [{ id: "tie", frame: 50, actorId: "driver", targetId: "enemy", tag: "normal", origin: "external", damagePositive: true }];
      context.targetContacts = { initial: true, "proc-initial": true, "proc-external-tie": true }; expectBlocked(doc);
    });
    it(`${skillId}: initial damage to another enemy can trigger even when selected initial contact missed`, () => {
      const doc = fixture(), context = doc.gameContext!.heldLifecycleCast!;
      context.pyro!.damageEvents = []; context.targetContacts!.initial = false;
      const prepared = prepareSourceCastDocument(doc), result = calculateDocument(prepared);
      expect(result.status).toBe("calculated"); expect(result.hits).toHaveLength(1);
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.heldLifecycleEvent?.frame : null)).toEqual([62]);
      expect(result.totals?.nonCritical).toBeCloseTo(2000 * .8144 * .5 * .9, 8);
    });
    it(`${skillId}: recorded queued miss still needs its post-expiry observation`, () => {
      const doc = fixture(); doc.gameContext!.heldLifecycleCast!.targetContacts!["proc-external-e405"] = false;
      expect(calculateDocument(doc).totals?.nonCritical).toBeCloseTo(expected(2), 8);
      doc.gameContext!.heldLifecycleCast!.observedThroughFrame = 416; expectBlocked(doc);
    });
  }
});


describe("Aether seven-form observed physical charged defaults", () => {
  for (const [characterId, skillId, element] of maleChargedCases) {
    const fixture = () => {
      const doc = createMaleChargedFixture(0, element, 10);
      if (element === "cryo") Object.assign(doc.gameContext!.travelerMaleChargedCast!.sharedState!, { cryoSkillActive: false, cryoRadiance: "none", cryoTrueMoonStacks: 0 });
      return doc;
    };
    const expectBlocked = (doc: CalculatorDocument) => {
      const result = calculateDocument(doc);
      expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0);
    };
    it(`${skillId}: unknown default qualifications do not replace the pinned male NA10 oracle`, () => {
      const initial = getCharacterDocuments(characterId, 10).find(doc => doc.gameContext?.skillId === skillId)!;
      const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS[skillId];
      expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined();
      expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
      expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
      const prepared = prepareSourceCastDocument(fixture()), result = calculateDocument(prepared);
      expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(2);
      expect(prepared.gameContext?.scopeCoverage).toBe("complete-cast");
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? [hit.element, hit.attackTag, hit.travelerMaleChargedEvent?.frame, hit.travelerMaleChargedEvent?.snapshotFrame] : null))
        .toEqual([["physical", "charged", 9, 9], ["physical", "charged", 20, 20]]);
      // Optimizer180a0a1/gcsima7dc4bf4 male vector: second hit1.2002, NOT shared female1.428.
      expect(result.totals?.nonCritical).toBeCloseTo(2000 * (1.105 + 1.2002) * .5 * .9, 8);
      expect(result.totals?.expected).toBeCloseTo(3112.02, 8);
    });
    it.each(["casterId", "targetId", "freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "observedThroughFrame", "statsStableAcrossHits", "precedingNormalAttackConfirmed", "normalCounterBeforeCast", "actionReadyConfirmed", "initialStamina", "staminaCostMultiplier", "targetContacts", "sharedState"] as const)(`${skillId}: missing required %s remains unknown`, field => {
      const doc = fixture(); delete doc.gameContext!.travelerMaleChargedCast![field]; expectBlocked(doc);
    });
    it.each(["freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits", "precedingNormalAttackConfirmed", "actionReadyConfirmed"] as const)(`${skillId}: false %s cannot certify this physical cast`, field => {
      const doc = fixture(); doc.gameContext!.travelerMaleChargedCast![field] = false; expectBlocked(doc);
    });
    it.each(["externalInfusionActive", "trueMoonStoryBuffEnabled"] as const)(`${skillId}: missing or true %s cannot become ordinary physical damage`, field => {
      const unknown = fixture(); delete unknown.gameContext!.travelerMaleChargedCast!.sharedState![field]; expectBlocked(unknown);
      const enabled = fixture(); enabled.gameContext!.travelerMaleChargedCast!.sharedState![field] = true; expectBlocked(enabled);
    });
    it.each(["hit-1", "hit-2"] as const)(`${skillId}: unknown %s contact is not counted`, id => {
      const doc = fixture(); delete doc.gameContext!.travelerMaleChargedCast!.targetContacts![id]; expectBlocked(doc);
    });
    it.each(["stamina", "cost-multiplier", "normal-counter", "observation"] as const)(`${skillId}: invalid %s blocks rather than inventing legal readiness`, change => {
      const doc = fixture(), context = doc.gameContext!.travelerMaleChargedCast!;
      if (change === "stamina") context.initialStamina = 19.999;
      else if (change === "cost-multiplier") context.staminaCostMultiplier = .9;
      else if (change === "normal-counter") context.normalCounterBeforeCast = 0;
      else context.observedThroughFrame = 19;
      expectBlocked(doc);
    });
    it(`${skillId}: recorded second-hit miss preserves first-hit numeric output and observation requirement`, () => {
      const doc = fixture(), context = doc.gameContext!.travelerMaleChargedCast!; context.targetContacts!["hit-2"] = false;
      const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.hits).toHaveLength(1);
      expect(result.totals?.nonCritical).toBeCloseTo(2000 * 1.105 * .5 * .9, 8);
      context.observedThroughFrame = 19; expectBlocked(doc);
    });
    if (element === "cryo") {
      it.each(["cryoSkillActive", "cryoRadiance", "cryoTrueMoonStacks"] as const)(`${skillId}: missing Cryo-specific %s remains unknown`, field => {
        const doc = fixture(); delete doc.gameContext!.travelerMaleChargedCast!.sharedState![field]; expectBlocked(doc);
      });
      it.each(["skill", "radiance", "stacks"] as const)(`${skillId}: active Cryo %s cannot borrow the ordinary physical branch`, state => {
        const doc = fixture(), shared = doc.gameContext!.travelerMaleChargedCast!.sharedState!;
        if (state === "skill") shared.cryoSkillActive = true;
        else if (state === "radiance") shared.cryoRadiance = "stellar-conduct";
        else shared.cryoTrueMoonStacks = 1;
        expectBlocked(doc);
      });
    }
  }
});


describe("Periodic actions with explicit complete-cast and passive accounting", () => {
  for (const spec of periodicCases) {
    const fixture = () => periodicDocument(spec);
    const expectBlocked = (doc: CalculatorDocument) => {
      const result = calculateDocument(doc);
      expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0);
    };
    const expectedHits = spec.coefficients.map((coefficient, index) => {
      // Shenhe Q1 shreds .06: .1-.06=.04. Only initial receives ASC1's15%.
      const bonus = spec.kind === "shenhe" && index === 0 ? 1.15 : 1;
      // Escoffier initial precedes her A4 callback; subsequent4-member shred .55 yields negative-resistance factor1.225.
      const resistance = spec.kind === "shenhe" ? .96 : spec.kind === "escoffier" && index > 0 ? 1.225 : .9;
      return 2000 * coefficient * bonus * .5 * resistance;
    });
    const total = expectedHits.reduce((sum, value) => sum + value, 0);
    it(`${spec.skillId}: unknown defaults stay blocked; each declared hit meets an independent T1 oracle`, () => {
      const initial = getCharacterDocuments(spec.characterId, 10).find(doc => doc.gameContext?.skillId === spec.skillId)!;
      const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS[spec.skillId];
      expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined();
      expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
      expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
      const result = calculateDocument(fixture());
      expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(expectedHits.length);
      result.hits.forEach((hit, index) => expect(hit.nonCritical, hit.id).toBeCloseTo(expectedHits[index]!, 8));
      expect(result.totals?.nonCritical).toBeCloseTo(total, 8);
      // Kokomi's explicit not-yet-included -100% lowers panel50% to clamped0%; other cases retain50%.
      expect(result.totals?.expected).toBeCloseTo(total * (spec.kind === "kokomi" ? 1 : 1.5), 8);
    });
    const required: readonly (keyof BatchPeriodicCastContext)[] = ["completeCastConfirmed", "statsStableAcrossHits", ...spec.required];
    it.each(required)(`${spec.skillId}: missing required %s remains unknown`, field => {
      const doc = fixture(); delete doc.gameContext!.batchPeriodicCast![field]; expectBlocked(doc);
    });
    for (const field of ["completeCastConfirmed", "statsStableAcrossHits", ...spec.trueOnly] as const) {
      it(`${spec.skillId}: false ${field} does not certify this named complete branch`, () => {
        const doc = fixture(); doc.gameContext!.batchPeriodicCast![field] = false; expectBlocked(doc);
      });
    }
    it(`${spec.skillId}: an unreviewed constellation cannot inherit the C0 cast count`, () => {
      const doc = fixture(); doc.gameContext!.constellation = 1; expectBlocked(doc);
    });
    if (spec.kind === "kokomi") {
      it(`${spec.skillId}: explicit already-included passive preserves a real20% final crit rate`, () => {
        const doc = fixture(); doc.gameContext!.batchPeriodicCast!.kokomiPassiveIncludedInPanel = true;
        if (doc.build.mode !== "manual-final") throw new Error("manual fixture required");
        doc.build.stats.critRate = .2;
        const result = calculateDocument(doc); expect(result.status).toBe("calculated");
        expect(result.totals?.expected).toBeCloseTo(total * 1.2, 8);
      });
    }
    if (spec.kind === "shenhe" || spec.kind === "escoffier") {
      it(`${spec.skillId}: actual ascension cannot be inferred from level90`, () => {
        const doc = fixture(); delete doc.gameContext!.ascension; if (doc.build.mode === "manual-final") delete doc.build.ascension; expectBlocked(doc);
      });
    }
    if (spec.kind === "shenhe") {
      it(`${spec.skillId}: already-included A1 and Q resistance are each subtracted once`, () => {
        const doc = fixture(); Object.assign(doc.gameContext!.batchPeriodicCast!, { shenheA1IncludedInPanel: true, shenheQReductionIncludedInResistance: true });
        doc.enemy.resistance = .04;
        for (const hit of doc.hits) if (hit.kind === "ordinary") hit.damageBonus = .15;
        const result = calculateDocument(doc); expect(result.status).toBe("calculated");
        result.hits.forEach((hit, index) => expect(hit.nonCritical, hit.id).toBeCloseTo(expectedHits[index]!, 8));
      });
    }
    if (spec.kind === "escoffier") {
      it.each([[1, .05], [2, .1], [3, .15]] as const)(`${spec.skillId}: actual %i Cryo/Hydro members gives only its pinned reduction`, (members, reduction) => {
        const doc = fixture(); doc.gameContext!.batchPeriodicCast!.escoffierCryoHydroMembers = members;
        const resistance = .1 - reduction, multiplier = resistance < 0 ? 1 - resistance / 2 : 1 - resistance;
        const result = calculateDocument(doc); expect(result.status).toBe("calculated");
        expect(result.hits[0]!.nonCritical).toBeCloseTo(2000 * .504 * .5 * .9, 8);
        expect(result.totals?.nonCritical).toBeCloseTo(2000 * .5 * (.504 * .9 + (.336 + 21 * 1.2) * multiplier), 8);
      });
      it(`${spec.skillId}: pre-existing A4 can affect initial, but included resistance cannot double the shred`, () => {
        const preexisting = fixture(); preexisting.gameContext!.batchPeriodicCast!.escoffierA4InitiallyActive = true;
        expect(calculateDocument(preexisting).totals?.nonCritical).toBeCloseTo(2000 * (.504 + .336 + 21 * 1.2) * .5 * 1.225, 8);
        const included = fixture(); included.gameContext!.batchPeriodicCast!.escoffierA4IncludedInResistance = true; included.enemy.resistance = -.45;
        const result = calculateDocument(included); expect(result.status).toBe("calculated");
        // The initial removes an included-but-not-yet-active A4 share; later hits retain it.
        result.hits.forEach((hit, index) => expect(hit.nonCritical, hit.id).toBeCloseTo(expectedHits[index]!, 8));
      });
      it(`${spec.skillId}: zero-gauge Arkhe cannot receive an invented Melt reaction`, () => {
        const doc = fixture(), arkhe = doc.hits.find(hit => hit.id === "batch-periodic-escoffier-skill-arkhe");
        if (!arkhe || arkhe.kind !== "ordinary") throw new Error("Expected pinned Arkhe role");
        arkhe.reaction = "reverseMelt"; expectBlocked(doc);
      });
    }
  }
});


describe("Finite complete actions retain observed-contact and passive contracts", () => {
  for (const spec of finiteCases) {
    const fixture = () => finiteDocument(spec);
    const expected = spec.atk.map((coefficient, index) =>
      (2000 * coefficient + 20000 * (spec.hp ? (index === spec.atk.length - 1 ? .02388 : .01692) : 0)) * (1 + spec.bonus) * .5 * .9);
    const assertNumeric = (doc: CalculatorDocument, values: readonly number[] = expected) => {
      const result = calculateDocument(doc);
      expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(values.length);
      result.hits.forEach((hit, index) => expect(hit.nonCritical, hit.id).toBeCloseTo(values[index]!, 8));
      expect(result.totals?.nonCritical).toBeCloseTo(values.reduce((a, b) => a + b, 0), 8);
      expect(result.totals?.expected).toBeCloseTo(values.reduce((a, b) => a + b, 0) * 1.5, 8);
    };
    const assertBlocked = (doc: CalculatorDocument) => {
      const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0);
    };
    it(`${spec.skillId}: default remains unknown while explicit contacts meet independent T1 per-hit arithmetic`, () => {
      const initial = getCharacterDocuments(spec.characterId, 10).find(doc => doc.gameContext?.skillId === spec.skillId)!;
      const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS[spec.skillId];
      expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined(); expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
      expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
      assertNumeric(fixture());
    });
    for (const field of (spec.atk.length > 1 ? ["completeCastConfirmed", "statsStableAcrossHits"] : ["completeCastConfirmed"]) as ("completeCastConfirmed" | "statsStableAcrossHits")[]) {
      it(`${spec.skillId}: missing or false ${field} cannot certify this full cast`, () => {
        const missing = fixture(); delete missing.gameContext!.batchFiniteCast![field]; assertBlocked(missing);
        const falseFlag = fixture(); falseFlag.gameContext!.batchFiniteCast![field] = false; assertBlocked(falseFlag);
      });
    }
    it(`${spec.skillId}: C1 cannot silently reuse the C0 branch`, () => {
      const doc = fixture(); doc.gameContext!.constellation = 1; assertBlocked(doc);
    });
    if (spec.passive) {
      it(`${spec.skillId}: every necessary per-hit included share must be explicit`, () => {
        for (let index = 0; index < spec.atk.length; index++) {
          const doc = fixture(); delete doc.gameContext!.batchFiniteCast!.hitStates![doc.hits[index]!.id]!.includedDamageBonus; assertBlocked(doc);
        }
      });
      it(`${spec.skillId}: included passive is subtracted once rather than duplicated`, () => {
        const doc = fixture();
        for (const hit of doc.hits) if (hit.kind === "ordinary") {
          hit.damageBonus = spec.bonus; doc.gameContext!.batchFiniteCast!.hitStates![hit.id]!.includedDamageBonus = spec.bonus;
        }
        assertNumeric(doc);
      });
      it(`${spec.skillId}: ASC3 removes only genuinely ASC-gated bonuses`, () => {
        const doc = fixture(); doc.gameContext!.ascension = 3; if (doc.build.mode === "manual-final") doc.build.ascension = 3;
        assertNumeric(doc, spec.skillId.startsWith("arlecchino") ? expected : expected.map(value => value / (1 + spec.bonus)));
      });
      it(`${spec.skillId}: missing ASC is not inferred from level90 except the inherent ungated passive`, () => {
        const doc = fixture(); delete doc.gameContext!.ascension; if (doc.build.mode === "manual-final") delete doc.build.ascension;
        if (spec.skillId.startsWith("arlecchino")) assertNumeric(doc); else assertBlocked(doc);
      });
    }
    if (spec.skillId.startsWith("chongyun")) {
      it(`${spec.skillId}: absent or opposite actual ASC cannot select the wrong complete branch`, () => {
        const doc = fixture(); doc.gameContext!.ascension = spec.ascension === 3 ? 6 : 3;
        if (doc.build.mode === "manual-final") doc.build.ascension = doc.gameContext!.ascension; assertBlocked(doc);
        delete doc.gameContext!.ascension; if (doc.build.mode === "manual-final") delete doc.build.ascension; assertBlocked(doc);
      });
      if (spec.ascension === 3) it(`${spec.skillId}: a genuine single sample does not require cross-hit stability`, () => {
        const doc = fixture(); delete doc.gameContext!.batchFiniteCast!.statsStableAcrossHits; assertNumeric(doc);
      });
    }
    if (spec.skillId.startsWith("kirara")) it(`${spec.skillId}: A4 uses actual HP rather than an ATK or fixed bonus proxy`, () => {
      const doc = fixture(); if (doc.build.mode !== "manual-final") throw new Error("manual fixture required"); doc.build.stats.hp = 30000;
      assertNumeric(doc, spec.atk.map(coefficient => 2000 * coefficient * 1.09 * .5 * .9));
    });
    if (spec.hp) it(`${spec.skillId}: each punch and final kick preserve their distinct HP coefficients`, () => {
      const doc = fixture(); if (doc.build.mode !== "manual-final") throw new Error("manual fixture required"); doc.build.stats.hp = 30000;
      assertNumeric(doc, spec.atk.map((coefficient, index) => (2000 * coefficient + 30000 * (index === spec.atk.length - 1 ? .02388 : .01692)) * .5 * .9));
    });
  }
});


describe("Normal-state coordinated actions require real observed schedules", () => {
  for (const [characterId, skillId, slug, end] of normalCoordinatedCases) {
    const fixture = () => normalCoordinatedDocument(characterId, skillId, end);
    const frames = slug === "xingqiu" ? [120, 120, 180, 180, 180, 240, 240]
      : slug === "yelan" ? [76, 120, 126, 132, 180, 186, 192, 240, 246, 252] : [40, 111, 171, 231];
    const snapshots = slug === "xingqiu" ? [100, 100, 160, 160, 160, 220, 220]
      : slug === "yelan" ? [76, 100, 100, 100, 160, 160, 160, 220, 220, 220] : [40, 100, 160, 220];
    // Independent T1 coefficients from pinned coordinated-casts definitions, never the prepared hit terms.
    const expected = slug === "xingqiu" ? Array<number>(7).fill(2000 * .54272 * 1.2 * .5 * .9)
      : slug === "yelan" ? [20000 * .07308 * .5 * .9, ...Array<number>(9).fill(20000 * .04872 * .5 * .9)]
      : [2000 * .88 * .5 * .9, ...Array<number>(3).fill((2000 * .58 + 20000 * .022) * .5 * .9)];
    const assertNumeric = (doc: CalculatorDocument, values: readonly number[] = expected) => {
      const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(values.length);
      result.hits.forEach((hit, index) => expect(hit.nonCritical, hit.id).toBeCloseTo(values[index]!, 8));
      expect(result.totals?.nonCritical).toBeCloseTo(values.reduce((a, b) => a + b, 0), 8);
    };
    const assertBlocked = (doc: CalculatorDocument) => {
      const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0);
    };
    it(`${skillId}: unknown default remains blocked; exact observed waves match numeric/frame/snapshot oracles`, () => {
      const initial = getCharacterDocuments(characterId, 10).find(doc => doc.gameContext?.skillId === skillId)!;
      const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS[skillId];
      expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined(); expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
      expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
      const prepared = prepareCoordinatedCastDocument(fixture()); assertNumeric(prepared);
      expect(prepared.gameContext?.scopeCoverage).toBe("complete-cast");
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.coordinatedEvent?.frame : null)).toEqual(frames);
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.coordinatedEvent?.snapshotFrame : null)).toEqual(snapshots);
    });
    it.each(["casterId", "targetId", "freshCastConfirmed", "fullObservedLifetime", "observedThroughFrame", "noHitlag", "noReplacement", "noInterruption", "allGeneratedHitsConfirmed", "statsStableAcrossHits", "normalStates"] as const)(`${skillId}: missing %s cannot certify a full observed cast`, field => {
      const doc = fixture(); delete doc.gameContext!.coordinatedCast![field]; assertBlocked(doc);
    });
    it.each(["freshCastConfirmed", "fullObservedLifetime", "noHitlag", "noReplacement", "noInterruption", "allGeneratedHitsConfirmed", "statsStableAcrossHits"] as const)(`${skillId}: false %s remains unsupported`, field => {
      const doc = fixture(); doc.gameContext!.coordinatedCast![field] = false; assertBlocked(doc);
    });
    it.each(["actorId", "onField", "animationStartDelayFrames"] as const)(`${skillId}: unknown normal-state %s cannot invent eligibility`, field => {
      const doc = fixture(); delete doc.gameContext!.coordinatedCast!.normalStates![0]![field]; assertBlocked(doc);
    });
    it(`${skillId}: observations must pass the inclusive expiry, not merely the last damage`, () => {
      const doc = fixture(); doc.gameContext!.coordinatedCast!.observedThroughFrame = end; assertBlocked(doc);
    });
    it(`${skillId}: C1 is not licensed by this C0 schedule`, () => {
      const doc = fixture(); doc.gameContext!.constellation = 1; assertBlocked(doc);
    });
    it(`${skillId}: known inactive driver emits no coordinated damage, unlike unknown on-field state`, () => {
      const doc = fixture(); doc.gameContext!.coordinatedCast!.normalStates![0]!.onField = false;
      const result = calculateDocument(doc); expect(result.status).toBe("calculated");
      if (slug === "xingqiu") {
        expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(1);
        expect(result.hits[0]!.status).toBe("non-damaging"); expect(result.totals).toBeUndefined();
      } else expect(result.totals?.nonCritical).toBeCloseTo(expected[0]!, 8);
    });
    if (slug !== "thoma") {
      it(`${skillId}: missing included-share bookkeeping blocks`, () => {
        const doc = fixture(); delete doc.gameContext!.coordinatedCast!.sharedState!.includedDamageBonus; assertBlocked(doc);
      });
    }
    it(`${skillId}: actual ASC cannot be inferred from level90`, () => {
      const doc = fixture(); delete doc.gameContext!.ascension; if (doc.build.mode === "manual-final") delete doc.build.ascension; assertBlocked(doc);
    });
    if (slug === "xingqiu") {
      it(`${skillId}: ASC3 and already-included A4 have distinct correct arithmetic`, () => {
        const lower = fixture(); lower.gameContext!.ascension = 3; if (lower.build.mode === "manual-final") lower.build.ascension = 3;
        assertNumeric(lower, expected.map(value => value / 1.2));
        const included = fixture(); included.gameContext!.coordinatedCast!.sharedState!.includedDamageBonus = .2;
        for (const hit of included.hits) if (hit.kind === "ordinary") hit.damageBonus = .2; assertNumeric(included);
      });
      it(`${skillId}: expiry-frame entry is valid, and queued projectiles require the tail`, () => {
        const doc = fixture(), context = doc.gameContext!.coordinatedCast!;
        context.normalStates = [{ id: "last", startFrame: 933, endFrame: 934, actorId: "driver", onField: true, animationStartDelayFrames: 0 }];
        assertBlocked(doc); context.observedThroughFrame = 953;
        assertNumeric(doc, expected.slice(0, 2));
        expect(prepareCoordinatedCastDocument(doc).hits.map(hit => hit.kind === "ordinary" ? hit.coordinatedEvent?.frame : null)).toEqual([953, 953]);
      });
    }
    if (slug === "yelan") {
      it(`${skillId}: missing external damage record or hit-time owner field cannot become empty/false`, () => {
        const events = fixture(); delete events.gameContext!.coordinatedCast!.damageEvents; assertBlocked(events);
        const active = fixture(); delete active.gameContext!.coordinatedCast!.sharedState!.ownerOnField; assertBlocked(active);
      });
      it(`${skillId}: A4 uses each projectile's integer-second hit time, while initial HP uses cast0`, () => {
        const doc = fixture(); doc.gameContext!.coordinatedCast!.sharedState!.ownerOnField = true;
        doc.gameContext!.coordinatedCast!.sharedState!.yelanInitialCastHp = 30000;
        // Initial precedes fresh A4. Remaining frames cross whole-second boundaries at136/196/256.
        assertNumeric(doc, [30000 * .07308 * .5 * .9, ...[.01, .01, .01, .045, .045, .045, .08, .08, .08].map(bonus => 20000 * .04872 * (1 + bonus) * .5 * .9)]);
      });
    }
    if (slug === "thoma") {
      it(`${skillId}: ASC0 excludes HP term while ASC1-3 remain blocked for the known source disagreement`, () => {
        const doc = fixture(); doc.gameContext!.ascension = 0; if (doc.build.mode === "manual-final") doc.build.ascension = 0;
        assertNumeric(doc, [expected[0]!, ...Array<number>(3).fill(2000 * .58 * .5 * .9)]);
        for (const stage of [1, 2, 3]) { doc.gameContext!.ascension = stage; if (doc.build.mode === "manual-final") doc.build.ascension = stage; assertBlocked(doc); }
      });
    }
  }
});


describe("Xiao Q actions are actual separately sampled hits, not a guessed rotation", () => {
  for (const [skillId, coefficients] of xiaoCases) {
    const fixture = () => xiaoDocument(skillId);
    const assertBlocked = (doc: CalculatorDocument) => {
      const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0);
    };
    const assertNumeric = (doc: CalculatorDocument, coefficient: number, bonus = .952 + .05) => {
      const prepared = prepareSourceCastDocument(doc), result = calculateDocument(prepared);
      expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(1);
      expect(result.hits[0]!.nonCritical).toBeCloseTo(2000 * coefficient * (1 + bonus) * .5 * .9, 8);
      expect(result.totals?.expected).toBeCloseTo(2000 * coefficient * (1 + bonus) * .5 * .9 * 1.5, 8);
      expect(prepared.gameContext?.scopeCoverage).toBe("single-hit");
      expect(prepared.hits.filter(hit => doc.selectedHitIds.includes(hit.id)).map(hit => hit.kind === "ordinary" ? hit.element : null)).toEqual(["anemo"]);
    };
    it(`${skillId}: exact unknown default contract and each separately selected numeric oracle`, () => {
      const initial = getCharacterDocuments("character:10000026", 10).find(doc => doc.gameContext?.skillId === skillId)!;
      const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS[skillId];
      expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined(); expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
      expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
      expect(fixture().hits).toHaveLength(coefficients.length);
      coefficients.forEach((coefficient, index) => { const doc = fixture(); doc.selectedHitIds = [doc.hits[index]!.id]; assertNumeric(doc, coefficient); });
    });
    it.each(["burstActive", "burstTalentLevel", "burstElapsedSeconds", "includedDamageBonus"] as const)(`${skillId}: missing %s remains unknown`, field => {
      const doc = fixture(); delete xiaoContext(doc)![field]; assertBlocked(doc);
    });
    it(`${skillId}: explicitly inactive Q cannot borrow the Q-state action`, () => {
      const doc = fixture(); xiaoContext(doc)!.burstActive = false; assertBlocked(doc);
    });
    it(`${skillId}: actual ASC cannot be inferred from level90`, () => {
      const doc = fixture(); delete doc.gameContext!.ascension; if (doc.build.mode === "manual-final") delete doc.build.ascension; assertBlocked(doc);
    });
    it.each([[179 / 60, .05], [3, .1], [12, .25], [15, .25]] as const)(`${skillId}: actual Q elapsed%s follows three-second A1 steps and cap`, (seconds, a1) => {
      const doc = fixture(); xiaoContext(doc)!.burstElapsedSeconds = seconds; assertNumeric(doc, coefficients[0], .952 + a1);
    });
    it(`${skillId}: independent Q13 never reuses NA10 and already-included bonus is subtracted once`, () => {
      const q13 = fixture(); xiaoContext(q13)!.burstTalentLevel = 13; assertNumeric(q13, coefficients[0], 1.0885 + .05);
      const included = fixture(); xiaoContext(included)!.includedDamageBonus = 1.002;
      for (const hit of included.hits) if (hit.kind === "ordinary") hit.damageBonus = 1.002;
      assertNumeric(included, coefficients[0]);
    });
    it(`${skillId}: ASC0 removes A1 but retains explicitly active Q's own bonus`, () => {
      const doc = fixture(); doc.gameContext!.ascension = 0; if (doc.build.mode === "manual-final") doc.build.ascension = 0;
      assertNumeric(doc, coefficients[0], .952);
    });
    if (coefficients.length > 1) it(`${skillId}: shared time cannot certify both actual hit samples`, () => {
      const doc = fixture(); doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); assertBlocked(doc);
    });
  }
});


describe("Ningguang screen gems require a real historical offensive snapshot", () => {
  const fixture = () => {
    const doc = getCharacterDocuments("character:10000027", 1).find(row => row.gameContext?.skillId === "ningguang-burst-with-screen")!;
    doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90; doc.gameContext!.ascension = 6;
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 10000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Synthetic current Q panel, deliberately different from historical E" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
    return applyNingguangBurstContext(doc, { screenAvailable: true, currentA4Active: false, currentA4IncludedInBonus: false, screenA4Active: false, screenA4IncludedInBonus: false,
      screenSnapshot: { stats: { atk: 1000, hp: 12000, def: 700, em: 120, critRate: .2, critDamage: .5 }, characterLevel: 90, ascension: 6, damageBonus: .3, additiveBaseDamage: 0, reactionBonus: 0, source: "Explicit historical E offensive sample; not reconstructed from Q", sourceRefs: doc.hits[6]!.sourceRefs } });
  };
  const calculate = (doc: CalculatorDocument) => calculateDocument(applyNingguangBurstContext(doc, doc.gameContext!.ningguangBurst!));
  it("pins six missing historical-gem blockers and independent six-current plus six-historical Q1 arithmetic", () => {
    const initial = getCharacterDocuments("character:10000027", 10).find(doc => doc.gameContext?.skillId === "ningguang-burst-with-screen")!;
    const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS["ningguang-burst-with-screen"];
    expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined(); expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
    expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
    const result = calculate(fixture()); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(12);
    // Pinned Q1 .8696 applies to both groups, not E's multiplier. Historical crit20%*.5 differs from current50%*1.
    result.hits.forEach((hit, index) => {
      expect(hit.nonCritical).toBeCloseTo(index < 6 ? 782.64 : 508.716, 8);
      expect(hit.expected).toBeCloseTo(index < 6 ? 1173.96 : 559.5876, 8);
    });
    expect(result.totals?.nonCritical).toBeCloseTo(7748.136, 8); expect(result.totals?.expected).toBeCloseTo(10401.2856, 8);
  });
  it("missing historical snapshot cannot borrow current Q, while independent body-only selection remains calculable", () => {
    const doc = fixture(); delete doc.gameContext!.ningguangBurst!.screenSnapshot;
    expect(calculate(doc).status).toBe("blocked"); expect(calculate(doc).totals).toBeUndefined();
    doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[0]!.id];
    expect(calculate(doc).totals?.expected).toBeCloseTo(1173.96, 8);
  });
  it("an unavailable screen cannot fabricate six historical projectiles", () => {
    const doc = fixture(); doc.gameContext!.ningguangBurst!.screenAvailable = false;
    expect(calculate(doc).status).toBe("blocked"); expect(calculate(doc).totals).toBeUndefined();
  });
  it("current ATK changes only body damage, not historical screen offense", () => {
    const doc = fixture(); if (doc.build.mode !== "manual-final") throw new Error("manual fixture"); doc.build.stats.atk = 4000;
    const result = calculate(doc); expect(result.status).toBe("calculated");
    expect(result.hits[0]!.expected).toBeCloseTo(2347.92, 8); expect(result.hits[6]!.expected).toBeCloseTo(559.5876, 8);
  });
  for (const group of ["current", "screen"] as const) {
    it(`${group} A4 belongs only to its own sample and already-included12% is subtracted once`, () => {
      const doc = fixture(), context = doc.gameContext!.ningguangBurst!; context[group === "screen" ? "screenA4Active" : "currentA4Active"] = true;
      const result = calculate(doc); expect(result.status).toBe("calculated");
      expect(result.hits[0]!.expected).toBeCloseTo(2000 * .8696 * (group === "current" ? 1.12 : 1) * .5 * .9 * 1.5, 8);
      expect(result.hits[6]!.expected).toBeCloseTo(1000 * .8696 * (group === "screen" ? 1.42 : 1.3) * .5 * .9 * 1.1, 8);
      context[group === "screen" ? "screenA4IncludedInBonus" : "currentA4IncludedInBonus"] = true;
      if (group === "screen") context.screenSnapshot!.damageBonus = .42;
      else for (const hit of doc.hits.slice(0, 6)) if (hit.kind === "ordinary") hit.damageBonus = .12;
      expect(calculate(doc).totals?.expected).toBeCloseTo(result.totals!.expected, 8);
    });
    it(`${group} A4 cannot be simultaneously inactive/already-included or unlocked before ASC4`, () => {
      const doc = fixture(), context = doc.gameContext!.ningguangBurst!;
      context[group === "screen" ? "screenA4IncludedInBonus" : "currentA4IncludedInBonus"] = true;
      expect(calculate(doc).status).toBe("blocked"); expect(calculate(doc).totals).toBeUndefined();
      context[group === "screen" ? "screenA4Active" : "currentA4Active"] = true;
      if (group === "screen") context.screenSnapshot!.ascension = 3;
      else { doc.gameContext!.ascension = 3; if (doc.build.mode === "manual-final") doc.build.ascension = 3; }
      expect(calculate(doc).status).toBe("blocked"); expect(calculate(doc).totals).toBeUndefined();
    });
  }
});


describe("Explicit stable projectile branches do not assume complete damage by default", () => {
  for (const [characterId, skillId, coefficients] of simpleProjectileCases) {
    const fixture = () => {
      const doc = getCharacterDocuments(characterId, 1).find(row => row.gameContext?.skillId === skillId)!;
      doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
      doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
      doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Explicit actual complete contact scenario with stable samples; not automatic hit-rate simulation" };
      doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
      for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
      doc.gameContext!.batchProjectileCast = { statsStableAcrossHits: true };
      return doc;
    };
    it(`${skillId}: exact missing stability blockers and independent per-hit T1 coefficients/counts`, () => {
      const initial = getCharacterDocuments(characterId, 10).find(doc => doc.gameContext?.skillId === skillId)!;
      const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS[skillId];
      expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined(); expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
      expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
      const result = calculateDocument(fixture()); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(coefficients.length);
      result.hits.forEach((hit, index) => expect(hit.nonCritical).toBeCloseTo(2000 * coefficients[index]! * .5 * .9, 8));
      expect(result.totals?.expected).toBeCloseTo(2000 * coefficients.reduce((a, b) => a + b, 0) * .5 * .9 * 1.5, 8);
    });
    it(`${skillId}: missing or false stability prevents the conditional full-cast sum`, () => {
      for (const value of [undefined, false]) {
        const doc = fixture(); if (value === undefined) delete doc.gameContext!.batchProjectileCast!.statsStableAcrossHits;
        else doc.gameContext!.batchProjectileCast!.statsStableAcrossHits = value;
        const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined();
      }
    });
    it(`${skillId}: a separately selected actual hit is independent of future unselected samples`, () => {
      for (let index = 0; index < coefficients.length; index++) {
        const doc = fixture(); doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[index]!.id]; delete doc.gameContext!.batchProjectileCast!.statsStableAcrossHits;
        const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.hits).toHaveLength(1);
        expect(result.totals?.nonCritical).toBeCloseTo(2000 * coefficients[index]! * .5 * .9, 8);
      }
    });
  }
});


describe("Zhongli one-stele observed lifetime is not an automatic all-contact assumption", () => {
  const fixture = () => {
    const doc = getCharacterDocuments("character:10000030", 1).find(row => row.gameContext?.skillId === "idle-zhongli-hold-skill-c0")!;
    doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
    doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Explicit observed single stele, no other constructs, every candidate contact recorded" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
    doc.gameContext!.idleStanceCast = {
      casterId: "owner", targetId: "enemy", freshCastConfirmed: true, noHitlag: true, noInterruption: true,
      noReplacement: true, fullObservedLifetime: true, observedThroughFrame: 1908, statsStableAcrossHits: true, followupActions: [],
      zhongli: { noOtherGeoConstructs: true, steleSurvives: true, shieldUnbroken: true, insideShieldRadius: true },
      sharedState: { includedResistanceReduction: 0 },
      targetContacts: { hold: true, pillar: true, "resonance-1": true, "resonance-2": true, "resonance-3": true,
        "resonance-4": true, "resonance-5": true, "resonance-6": true, "resonance-7": true, "resonance-8": true,
        "resonance-9": true, "resonance-10": true, "resonance-11": true, "resonance-12": true,
        "resonance-13": true, "resonance-14": true, "resonance-15": true },
    };
    return doc;
  };
  // Pinned T1 hold .8ATK, pillar .16ATK, resonance .32ATK; ASC4 adds .019HP to EACH.
  // Hold/pillar precede shield callback. Resonance10 at1248 still has shred; resonance11 at1368 does not.
  const expected = [891, 315, ...Array<number>(10).fill(535.5), ...Array<number>(5).fill(459)];
  const assertNumeric = (doc: CalculatorDocument, values: readonly number[] = expected) => {
    const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(values.length);
    result.hits.forEach((hit, index) => expect(hit.nonCritical, hit.id).toBeCloseTo(values[index]!, 8));
    expect(result.totals?.nonCritical).toBeCloseTo(values.reduce((a, b) => a + b, 0), 8);
    expect(result.totals?.expected).toBeCloseTo(values.reduce((a, b) => a + b, 0) * 1.5, 8);
  };
  const assertBlocked = (doc: CalculatorDocument) => {
    const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0);
  };
  it("pins default six missing dependencies and independent numeric/frame/snapshot ownership", () => {
    const initial = getCharacterDocuments("character:10000030", 10).find(doc => doc.gameContext?.skillId === "idle-zhongli-hold-skill-c0")!;
    const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS["idle-zhongli-hold-skill-c0"];
    expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined(); expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
    expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
    const prepared = prepareSourceCastDocument(fixture()); assertNumeric(prepared);
    expect(prepared.gameContext?.scopeCoverage).toBe("complete-cast");
    expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.idleStanceEvent?.frame : null))
      .toEqual([48, 48, 168, 288, 408, 528, 648, 768, 888, 1008, 1128, 1248, 1368, 1488, 1608, 1728, 1848]);
    expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.idleStanceEvent?.snapshotFrame : null)).toEqual([0, ...Array<number>(16).fill(48)]);
    expect(calculateDocument(prepared).totals?.nonCritical).toBeCloseTo(8856, 8);
  });
  it.each(["casterId", "targetId", "freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "observedThroughFrame", "statsStableAcrossHits", "followupActions", "zhongli", "targetContacts", "sharedState"] as const)("missing required %s does not become an observed lifetime", field => {
    const doc = fixture(); delete doc.gameContext!.idleStanceCast![field]; assertBlocked(doc);
  });
  it.each(["freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits"] as const)("false %s cannot certify this branch", field => {
    const doc = fixture(); doc.gameContext!.idleStanceCast![field] = false; assertBlocked(doc);
  });
  it.each(["noOtherGeoConstructs", "steleSurvives", "shieldUnbroken", "insideShieldRadius"] as const)("missing or false Zhongli %s cannot silently omit changes", field => {
    const missing = fixture(); delete missing.gameContext!.idleStanceCast!.zhongli![field]; assertBlocked(missing);
    const falseFlag = fixture(); falseFlag.gameContext!.idleStanceCast!.zhongli![field] = false; assertBlocked(falseFlag);
  });
  it("every declared candidate contact remains explicit; a known miss is not an unknown contact", () => {
    for (const id of ["hold", "pillar", "resonance-1", "resonance-2", "resonance-3", "resonance-4", "resonance-5", "resonance-6", "resonance-7", "resonance-8", "resonance-9", "resonance-10", "resonance-11", "resonance-12", "resonance-13", "resonance-14", "resonance-15"]) {
      const doc = fixture(); delete doc.gameContext!.idleStanceCast!.targetContacts![id]; assertBlocked(doc);
    }
    const miss = fixture(); miss.gameContext!.idleStanceCast!.targetContacts!["resonance-15"] = false;
    assertNumeric(miss, expected.slice(0, -1));
    miss.gameContext!.idleStanceCast!.observedThroughFrame = 1907; assertBlocked(miss);
  });
  it("observations cover1908 lifetime, and extra actions cannot be discarded", () => {
    const short = fixture(); short.gameContext!.idleStanceCast!.observedThroughFrame = 1907; assertBlocked(short);
    const extra = fixture(); extra.gameContext!.idleStanceCast!.followupActions = [{ id: "extra", frame: 100, actorId: "owner", kind: "terminate-skill" }]; assertBlocked(extra);
  });
  it("actual ASC gates each HP term; absent ASC is not assumed from level90", () => {
    const doc = fixture(); delete doc.gameContext!.ascension; if (doc.build.mode === "manual-final") delete doc.build.ascension; assertBlocked(doc);
    doc.gameContext!.ascension = 3; if (doc.build.mode === "manual-final") doc.build.ascension = 3;
    assertNumeric(doc, [2000 * .8 * .5 * .9, 2000 * .16 * .5 * .9, ...Array<number>(10).fill(2000 * .32 * .5 * 1.05), ...Array<number>(5).fill(2000 * .32 * .5 * .9)]);
  });
  it("missing shred bookkeeping blocks and included20% is neither duplicated nor retroactively applied", () => {
    const missing = fixture(); delete missing.gameContext!.idleStanceCast!.sharedState!.includedResistanceReduction; assertBlocked(missing);
    const included = fixture(); included.enemy.resistance = -.1; included.gameContext!.idleStanceCast!.sharedState!.includedResistanceReduction = .2; assertNumeric(included);
  });
  it("higher constellation cannot reuse the C0 observed branch", () => {
    const doc = fixture(); doc.gameContext!.constellation = 1; assertBlocked(doc);
  });
});


describe("Fischl observed autonomous Oz schedules keep independent E and Q talents", () => {
  for (const [skillId, isBurst, initial, frames] of [
    ["coordinated-fischl-skill-c0", false, 1.1544, [38, 92, 151, 210, 269, 328, 387, 446, 505, 564, 623]],
    ["coordinated-fischl-burst-c0", true, 2.08, [18, 192, 251, 310, 369, 428, 487, 546, 605, 664, 723]],
  ] as const) {
    const fixture = () => {
      const doc = getCharacterDocuments("character:10000031", 1).find(row => row.gameContext?.skillId === skillId)!;
      doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
      doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
      doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Observed Oz lifetime, explicit ten-frame travel and actual no-extra-proc conditions" };
      doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
      for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
      doc.gameContext!.coordinatedCast = { casterId: "owner", targetId: "enemy", freshCastConfirmed: true, fullObservedLifetime: true,
        observedThroughFrame: isBurst ? 723 : 623, noHitlag: true, noReplacement: true, noInterruption: true, allGeneratedHitsConfirmed: true,
        statsStableAcrossHits: true, noFischlA4: true, noFischlHexerei: true, fischlOzTravelFrames: 10,
        ...(isBurst ? { noEarlySwapBeforeOz: true, skillTalentLevel: 1 } : {}) };
      return doc;
    };
    const assertNumeric = (doc: CalculatorDocument, oz = .888) => {
      const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(11);
      result.hits.forEach((hit, index) => expect(hit.nonCritical).toBeCloseTo(2000 * (index === 0 ? initial : oz) * .5 * .9, 8));
      expect(result.totals?.expected).toBeCloseTo(2000 * (initial + 10 * oz) * .5 * .9 * 1.5, 8);
    };
    const assertBlocked = (doc: CalculatorDocument) => {
      const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0);
    };
    it(`${skillId}: exact missing default and independent T1/chronology/snapshot oracles`, () => {
      const initialDoc = getCharacterDocuments("character:10000031", 10).find(doc => doc.gameContext?.skillId === skillId)!;
      const blocked = calculateDocument(initialDoc), contract = DEFAULT_CONTEXT_CONTRACTS[skillId];
      expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined(); expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
      expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
      const prepared = prepareCoordinatedCastDocument(fixture()); assertNumeric(prepared);
      expect(prepared.gameContext?.scopeCoverage).toBe("complete-cast");
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.coordinatedEvent?.frame : null)).toEqual(frames);
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.coordinatedEvent?.snapshotFrame : null)).toEqual([18, ...Array<number>(10).fill(isBurst ? 113 : 18)]);
    });
    it.each(["casterId", "targetId", "freshCastConfirmed", "fullObservedLifetime", "observedThroughFrame", "noHitlag", "noReplacement", "noInterruption", "allGeneratedHitsConfirmed", "statsStableAcrossHits", "noFischlA4", "noFischlHexerei", "fischlOzTravelFrames"] as const)(`${skillId}: missing %s cannot certify this observed branch`, field => {
      const doc = fixture(); delete doc.gameContext!.coordinatedCast![field]; assertBlocked(doc);
    });
    it.each(["freshCastConfirmed", "fullObservedLifetime", "noHitlag", "noReplacement", "noInterruption", "allGeneratedHitsConfirmed", "statsStableAcrossHits", "noFischlA4", "noFischlHexerei"] as const)(`${skillId}: false %s cannot silently omit other damage or interruptions`, field => {
      const doc = fixture(); doc.gameContext!.coordinatedCast![field] = false; assertBlocked(doc);
    });
    it(`${skillId}: the last emitted projectile must be observed after Oz expiry`, () => {
      const doc = fixture(), context = doc.gameContext!.coordinatedCast!;
      context.observedThroughFrame = isBurst ? 722 : 622; assertBlocked(doc);
      context.fischlOzTravelFrames = 20; context.observedThroughFrame = isBurst ? 732 : 632; assertBlocked(doc);
      context.observedThroughFrame = isBurst ? 733 : 633; assertNumeric(doc);
      expect(prepareCoordinatedCastDocument(doc).hits.at(-1)).toMatchObject({ coordinatedEvent: { frame: isBurst ? 733 : 633 } });
    });
    it(`${skillId}: C1 does not certify the C0 observed output`, () => {
      const doc = fixture(); doc.gameContext!.constellation = 1; assertBlocked(doc);
    });
    if (isBurst) {
      it.each(["noEarlySwapBeforeOz", "skillTalentLevel"] as const)(`${skillId}: independent required %s remains explicit`, field => {
        const doc = fixture(); delete doc.gameContext!.coordinatedCast![field]; assertBlocked(doc);
      });
      it(`${skillId}: early swap cannot borrow the complete branch, and Q1 never replaces independent E2`, () => {
        const early = fixture(); early.gameContext!.coordinatedCast!.noEarlySwapBeforeOz = false; assertBlocked(early);
        const e2 = fixture(); e2.gameContext!.coordinatedCast!.skillTalentLevel = 2; assertNumeric(e2, .9546);
      });
    }
  }
});


describe("Noelle observed physical plunge retains actual airborne and per-hit samples", () => {
  for (const [skillId, landingFrame, end, landingCoefficient] of [
    ["noelle-plunge-low-observed-c0", 39, 80, 1.49144], ["noelle-plunge-high-observed-c0", 42, 82, 1.862889],
  ] as const) {
    const fixture = () => {
      const doc = getCharacterDocuments("character:10000034", 1).find(row => row.gameContext?.skillId === skillId)!;
      doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
      doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
      doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Observed physical plunge under actual AirborneXianyun qualification, not arbitrary jump" };
      doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
      for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
      doc.gameContext!.noellePlungeCast = { casterId: "owner", targetId: "enemy", noHitlag: true, noInterruption: true, fullObservedLifetime: true,
        observedThroughFrame: end, statsStableAcrossHits: true, airborneXianyunConfirmed: true, returnedToGroundConfirmed: true,
        burstInactive: true, noExternalInfusion: true, collisionOccurred: true, targetContacts: { collision: true, landing: true } };
      return doc;
    };
    const assertBlocked = (doc: CalculatorDocument) => {
      const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0);
    };
    const expected = [2000 * .745878 * .5 * .9, 2000 * landingCoefficient * .5 * .9];
    const assertNumeric = (doc: CalculatorDocument, values: readonly number[] = expected) => {
      const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(values.length);
      result.hits.forEach((hit, index) => expect(hit.nonCritical).toBeCloseTo(values[index]!, 8));
      expect(result.totals?.nonCritical).toBeCloseTo(values.reduce((a, b) => a + b, 0), 8);
    };
    it(`${skillId}: exact unknown defaults and independent T1 collision/landing values at distinct frames`, () => {
      const initial = getCharacterDocuments("character:10000034", 10).find(doc => doc.gameContext?.skillId === skillId)!;
      const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS[skillId];
      expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined(); expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
      expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
      const prepared = prepareSourceCastDocument(fixture()); assertNumeric(prepared);
      expect(prepared.gameContext?.scopeCoverage).toBe("complete-cast");
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? [hit.element, hit.attackTag, hit.noellePlungeEvent?.frame, hit.noellePlungeEvent?.snapshotFrame] : null))
        .toEqual([["physical", "plunge", 33, 33], ["physical", "plunge", landingFrame, landingFrame]]);
    });
    it.each(["casterId", "targetId", "noHitlag", "noInterruption", "fullObservedLifetime", "observedThroughFrame", "airborneXianyunConfirmed", "returnedToGroundConfirmed", "burstInactive", "noExternalInfusion", "collisionOccurred", "targetContacts"] as const)(`${skillId}: missing %s cannot invent qualification or observation`, field => {
      const doc = fixture(); delete doc.gameContext!.noellePlungeCast![field]; assertBlocked(doc);
    });
    it.each(["noHitlag", "noInterruption", "fullObservedLifetime", "airborneXianyunConfirmed", "returnedToGroundConfirmed", "burstInactive", "noExternalInfusion"] as const)(`${skillId}: false %s cannot borrow the reviewed physical branch`, field => {
      const doc = fixture(); doc.gameContext!.noellePlungeCast![field] = false; assertBlocked(doc);
    });
    it.each(["collision", "landing"] as const)(`${skillId}: unknown %s contact is not a known miss`, id => {
      const doc = fixture(); delete doc.gameContext!.noellePlungeCast!.targetContacts![id]; assertBlocked(doc);
    });
    it(`${skillId}: known no-collision and known collision miss preserve only landing`, () => {
      const doc = fixture(), context = doc.gameContext!.noellePlungeCast!;
      context.targetContacts!.collision = false; assertNumeric(doc, expected.slice(1));
      context.collisionOccurred = false; assertNumeric(doc, expected.slice(1));
      context.targetContacts!.collision = true; assertBlocked(doc);
    });
    it(`${skillId}: even a missed landing must retain complete return-to-ground observation`, () => {
      const doc = fixture(); doc.gameContext!.noellePlungeCast!.targetContacts!.landing = false;
      assertNumeric(doc, expected.slice(0, 1)); doc.gameContext!.noellePlungeCast!.observedThroughFrame = end - 1; assertBlocked(doc);
    });
    it(`${skillId}: actual independent snapshots replace stability, never each other or current panel`, () => {
      const doc = fixture(), context = doc.gameContext!.noellePlungeCast!; context.statsStableAcrossHits = false; assertBlocked(doc);
      if (doc.build.mode !== "manual-final") throw new Error("manual fixture"); doc.build.stats.atk = 9999;
      const snapshot = (atk: number) => ({ stats: { atk, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, characterLevel: 90, ascension: 6, damageBonus: 0, additiveBaseDamage: 0, reactionBonus: 0, source: "Actual distinct per-hit offensive sample", sourceRefs: doc.hits[0]!.sourceRefs });
      context.snapshots = { "sample:33": snapshot(1000), [`sample:${landingFrame}`]: snapshot(3000) };
      assertNumeric(doc, [1000 * .745878 * .5 * .9, 3000 * landingCoefficient * .5 * .9]);
      for (const key of ["sample:33", `sample:${landingFrame}`]) {
        const missing = structuredClone(doc); delete missing.gameContext!.noellePlungeCast!.snapshots![key]; assertBlocked(missing);
      }
    });
    it(`${skillId}: C1 or an invented elemental reaction cannot redefine the physical source`, () => {
      const c1 = fixture(); c1.gameContext!.constellation = 1; assertBlocked(c1);
      const reaction = fixture(); const hit = reaction.hits[0]; if (!hit || hit.kind !== "ordinary") throw new Error("ordinary fixture"); hit.reaction = "reverseMelt"; assertBlocked(reaction);
    });
  }
});


describe("Noelle held charge uses observed spins and actual stamina rather than template sums", () => {
  const fixture = () => {
    const doc = getCharacterDocuments("character:10000034", 1).find(row => row.gameContext?.skillId === "held-noelle-charged-c0")!;
    doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
    doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Actual three-spin idle-start physical charge, explicit stamina and contact record" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
    doc.gameContext!.heldLifecycleCast = { casterId: "owner", targetId: "enemy", freshCastConfirmed: true, noHitlag: true, noInterruption: true,
      noReplacement: true, fullObservedLifetime: true, observedThroughFrame: 164, statsStableAcrossHits: true,
      noelle: { spinCount: 3, startsFromIdle: true, attackSpeedBonus: 0, initialStamina: 48, staminaCostMultiplier: 1,
        noExternalStaminaChanges: true, burstInactive: true, shieldInactive: true, sourceCastFrame: 10 },
      targetContacts: { "spin-1": true, "spin-2": true, "spin-3": true, finisher: true } };
    return doc;
  };
  const expected = [.5074, .5074, .5074, .90472].map(coefficient => 2000 * coefficient * .5 * .9);
  const assertNumeric = (doc: CalculatorDocument, values: readonly number[] = expected) => {
    const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(values.length);
    result.hits.forEach((hit, index) => expect(hit.nonCritical).toBeCloseTo(values[index]!, 8));
    expect(result.totals?.expected).toBeCloseTo(values.reduce((a, b) => a + b, 0) * 1.5, 8);
  };
  const assertBlocked = (doc: CalculatorDocument) => {
    const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0);
  };
  it("pins default four blockers and independent three-spin/finisher T1 damage and frame samples", () => {
    const initial = getCharacterDocuments("character:10000034", 10).find(doc => doc.gameContext?.skillId === "held-noelle-charged-c0")!;
    const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS["held-noelle-charged-c0"];
    expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined(); expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
    expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
    const prepared = prepareSourceCastDocument(fixture()); assertNumeric(prepared);
    expect(prepared.gameContext?.scopeCoverage).toBe("complete-cast");
    expect(prepared.hits.map(hit => hit.kind === "ordinary" ? [hit.element, hit.attackTag, hit.heldLifecycleEvent?.frame, hit.heldLifecycleEvent?.snapshotFrame] : null))
      .toEqual([["physical", "charged", 79, 79], ["physical", "charged", 102, 102], ["physical", "charged", 125, 125], ["physical", "charged", 164, 164]]);
  });
  it.each(["casterId", "targetId", "freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "observedThroughFrame", "statsStableAcrossHits", "noelle", "targetContacts"] as const)("missing required %s cannot certify the complete charge", field => {
    const doc = fixture(); delete doc.gameContext!.heldLifecycleCast![field]; assertBlocked(doc);
  });
  it.each(["freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits"] as const)("false %s does not certify the observed branch", field => {
    const doc = fixture(); doc.gameContext!.heldLifecycleCast![field] = false; assertBlocked(doc);
  });
  it.each(["spinCount", "startsFromIdle", "attackSpeedBonus", "initialStamina", "staminaCostMultiplier", "noExternalStaminaChanges", "burstInactive", "shieldInactive", "sourceCastFrame"] as const)("missing Noelle %s stays unknown", field => {
    const doc = fixture(); delete doc.gameContext!.heldLifecycleCast!.noelle![field]; assertBlocked(doc);
  });
  it.each(["startsFromIdle", "noExternalStaminaChanges", "burstInactive", "shieldInactive"] as const)("false Noelle %s cannot borrow the base physical cast", field => {
    const doc = fixture(); doc.gameContext!.heldLifecycleCast!.noelle![field] = false; assertBlocked(doc);
  });
  it.each(["spin-1", "spin-2", "spin-3", "finisher"] as const)("missing %s contact is not a known miss", id => {
    const doc = fixture(); delete doc.gameContext!.heldLifecycleCast!.targetContacts![id]; assertBlocked(doc);
  });
  it("four12-stamina drains at74/92/110/128 require48, even when a spin misses", () => {
    const low = fixture(); low.gameContext!.heldLifecycleCast!.noelle!.initialStamina = 47.999; assertBlocked(low);
    const miss = fixture(); miss.gameContext!.heldLifecycleCast!.targetContacts!["spin-2"] = false;
    assertNumeric(miss, [expected[0]!, expected[2]!, expected[3]!]);
    miss.gameContext!.heldLifecycleCast!.noelle!.initialStamina = 47.999; assertBlocked(miss);
  });
  it("known finisher miss still requires164 observation and nonzero absolute cast frame for continuous spins", () => {
    const doc = fixture(); doc.gameContext!.heldLifecycleCast!.targetContacts!.finisher = false; assertNumeric(doc, expected.slice(0, 3));
    doc.gameContext!.heldLifecycleCast!.observedThroughFrame = 163; assertBlocked(doc);
    const atZero = fixture(); atZero.gameContext!.heldLifecycleCast!.noelle!.sourceCastFrame = 0; assertBlocked(atZero);
  });
  it("speed or stamina-cost changes and C1 cannot reuse the fixed C0 source schedule", () => {
    const speed = fixture(); speed.gameContext!.heldLifecycleCast!.noelle!.attackSpeedBonus = .1; assertBlocked(speed);
    const cost = fixture(); cost.gameContext!.heldLifecycleCast!.noelle!.staminaCostMultiplier = .8; assertBlocked(cost);
    const c1 = fixture(); c1.gameContext!.constellation = 1; assertBlocked(c1);
  });
  it("a separately occurred spin retains only its actual no-Q/no-shield qualification", () => {
    const doc = fixture(); doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[0]!.id];
    doc.gameContext!.heldLifecycleCast = { noelle: { burstInactive: true, shieldInactive: true } };
    assertNumeric(doc, expected.slice(0, 1));
    delete doc.gameContext!.heldLifecycleCast!.noelle!.burstInactive; assertBlocked(doc);
  });
});


describe("Observed external damage drives Albedo, Yoimiya and Raiden schedules", () => {
  for (const [characterId, skillId, slug, end, frames, snapshots, initialValue, procValue] of [
    ["character:10000038", "coordinated-albedo-skill-c0", "albedo", 1825, [25, 101, 252], [0, 0, 0], 2000 * 1.304 * .5 * .9, 800 * 1.336 * 1.25 * .5 * .9],
    ["character:10000049", "coordinated-yoimiya-burst-c0", "yoimiya", 676, [75, 101, 252], [0, 100, 251], 2000 * 1.272 * .5 * .9, 2000 * 1.22 * .5 * .9],
    ["character:10000052", "coordinated-raiden-skill-c0", "raiden", 1567, [51, 105, 165, 256], [51, 105, 165, 256], 2000 * 1.172 * 1.4 * .5 * .9, 2000 * .42 * 1.4 * .5 * .9],
  ] as const) {
    const fixture = () => {
      const doc = getCharacterDocuments(characterId, 1).find(row => row.gameContext?.skillId === skillId)!;
      doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
      doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
      doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Actual external damage chronology and passive state; no inferred attack frequency" };
      doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
      for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
      doc.gameContext!.coordinatedCast = { casterId: "owner", targetId: "enemy", freshCastConfirmed: true, fullObservedLifetime: true,
        observedThroughFrame: end, noHitlag: true, noReplacement: true, noInterruption: true, allGeneratedHitsConfirmed: true, statsStableAcrossHits: true,
        damageEvents: [100, 130, 160, 251].map(frame => ({ id: `damage-${frame}`, frame, actorId: "driver", targetId: "enemy", tag: "normal", origin: "external", damagePositive: true, inRange: true, sourceAbility: "Normal Attack" })),
        sharedState: { includedDamageBonus: 0, targetHpFraction: .4, raidenNonExtraEnergyRecharge: 2 }, ...(slug === "yoimiya" ? { yoimiyaA1Inactive: true } : {}) };
      return doc;
    };
    const expected = [initialValue, ...Array<number>(frames.length - 1).fill(procValue)];
    const assertNumeric = (doc: CalculatorDocument, values: readonly number[] = expected) => {
      const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(values.length);
      result.hits.forEach((hit, index) => expect(hit.nonCritical).toBeCloseTo(values[index]!, 8));
      expect(result.totals?.expected).toBeCloseTo(values.reduce((a, b) => a + b, 0) * 1.5, 8);
    };
    const assertBlocked = (doc: CalculatorDocument) => {
      const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0);
    };
    it(`${skillId}: exact default blockers, independent T1/stat/passive/frame and snapshot oracles`, () => {
      const initial = getCharacterDocuments(characterId, 10).find(doc => doc.gameContext?.skillId === skillId)!;
      const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS[skillId];
      expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined(); expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
      expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
      const prepared = prepareCoordinatedCastDocument(fixture()); assertNumeric(prepared);
      expect(prepared.gameContext?.scopeCoverage).toBe("complete-cast");
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.coordinatedEvent?.frame : null)).toEqual(frames);
      expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.coordinatedEvent?.snapshotFrame : null)).toEqual(snapshots);
    });
    it.each(["casterId", "targetId", "freshCastConfirmed", "fullObservedLifetime", "observedThroughFrame", "noHitlag", "noReplacement", "noInterruption", "allGeneratedHitsConfirmed", "statsStableAcrossHits", "damageEvents"] as const)(`${skillId}: missing %s cannot create complete evidence`, field => {
      const doc = fixture(); delete doc.gameContext!.coordinatedCast![field]; assertBlocked(doc);
    });
    it.each(["freshCastConfirmed", "fullObservedLifetime", "noHitlag", "noReplacement", "noInterruption", "allGeneratedHitsConfirmed", "statsStableAcrossHits"] as const)(`${skillId}: false %s cannot certify the branch`, field => {
      const doc = fixture(); doc.gameContext!.coordinatedCast![field] = false; assertBlocked(doc);
    });
    const eventFields = slug === "albedo" ? ["origin", "actorId", "targetId", "damagePositive", "inRange", "sourceAbility"] as const
      : slug === "raiden" ? ["origin", "actorId", "targetId", "damagePositive", "tag"] as const : ["origin", "actorId", "targetId", "tag"] as const;
    for (const field of eventFields) it(`${skillId}: missing eligible event ${field} cannot imply qualification`, () => {
      const doc = fixture(); delete doc.gameContext!.coordinatedCast!.damageEvents![0]![field]; assertBlocked(doc);
    });
    it(`${skillId}: an explicit empty event log or self-generated attacks leave only the initial hit`, () => {
      const empty = fixture(); empty.gameContext!.coordinatedCast!.damageEvents = []; assertNumeric(empty, [initialValue]);
      const recursive = fixture(); for (const event of recursive.gameContext!.coordinatedCast!.damageEvents!) event.origin = "this-cast"; assertNumeric(recursive, [initialValue]);
    });
    it(`${skillId}: actual source cooldown boundary is not approximated by frequency`, () => {
      const doc = fixture(), template = doc.gameContext!.coordinatedCast!.damageEvents![0]!;
      const times = slug === "raiden" ? [100, 153, 154] : [100, 220, 221];
      doc.gameContext!.coordinatedCast!.damageEvents = times.map(frame => ({ ...template, id: `boundary-${frame}`, frame }));
      assertNumeric(doc, [initialValue, procValue, procValue]);
      expect(prepareCoordinatedCastDocument(doc).hits.map(hit => hit.kind === "ordinary" ? hit.coordinatedEvent?.frame : null))
        .toEqual(slug === "raiden" ? [51, 105, 159] : slug === "albedo" ? [25, 101, 222] : [75, 101, 222]);
    });
    it(`${skillId}: lifetime observation and C0 are both required`, () => {
      const short = fixture(); short.gameContext!.coordinatedCast!.observedThroughFrame = end - 1; assertBlocked(short);
      const c1 = fixture(); c1.gameContext!.constellation = 1; assertBlocked(c1);
    });
    if (slug !== "yoimiya") {
      it(`${skillId}: actual ASC and included passive share cannot be guessed`, () => {
        const asc = fixture(); delete asc.gameContext!.ascension; if (asc.build.mode === "manual-final") delete asc.build.ascension; assertBlocked(asc);
        const share = fixture(); delete share.gameContext!.coordinatedCast!.sharedState!.includedDamageBonus; assertBlocked(share);
      });
      it(`${skillId}: already-included own bonus is subtracted once, including initial with no Albedo A1`, () => {
        const doc = fixture(), included = slug === "albedo" ? .25 : .4;
        doc.gameContext!.coordinatedCast!.sharedState!.includedDamageBonus = included;
        for (const hit of doc.hits) if (hit.kind === "ordinary") hit.damageBonus = included; assertNumeric(doc);
      });
      it(`${skillId}: known zero damage cannot trigger its nonzero-damage hook`, () => {
        const doc = fixture(); for (const event of doc.gameContext!.coordinatedCast!.damageEvents!) event.damagePositive = false;
        assertNumeric(doc, [initialValue]);
      });
    }
    if (slug === "albedo") {
      it(`${skillId}: targetHP50% is not below50%, and absent actualHP stays unknown`, () => {
        const missing = fixture(); delete missing.gameContext!.coordinatedCast!.sharedState!.targetHpFraction; assertBlocked(missing);
        const boundary = fixture(); boundary.gameContext!.coordinatedCast!.sharedState!.targetHpFraction = .5;
        assertNumeric(boundary, [initialValue, procValue / 1.25, procValue / 1.25]);
      });
      it(`${skillId}: known outside-range and Albedo initial-hook events do not self-trigger`, () => {
        const outside = fixture(); for (const event of outside.gameContext!.coordinatedCast!.damageEvents!) event.inRange = false; assertNumeric(outside, [initialValue]);
        const own = fixture(); for (const event of own.gameContext!.coordinatedCast!.damageEvents!) event.sourceAbility = "Abiogenesis: Solar Isotoma (Initial)"; assertNumeric(own, [initialValue]);
      });
    }
    if (slug === "raiden") {
      it(`${skillId}: non-ExtraER uses actual updated sample, with zero excess below100%`, () => {
        const missing = fixture(); delete missing.gameContext!.coordinatedCast!.sharedState!.raidenNonExtraEnergyRecharge; assertBlocked(missing);
        const low = fixture(); low.gameContext!.coordinatedCast!.sharedState!.raidenNonExtraEnergyRecharge = .8; assertNumeric(low, expected.map(value => value / 1.4));
      });
      it(`${skillId}: enemy-owned reaction tags do not replace eligible direct damage`, () => {
        for (const tag of ["electro-charged", "burning", "hydro-swirl"] as const) {
          const doc = fixture(); for (const event of doc.gameContext!.coordinatedCast!.damageEvents!) event.tag = tag; assertNumeric(doc, [initialValue]);
        }
      });
    }
    if (slug === "yoimiya") {
      it(`${skillId}: old A1 must be explicitly inactive, and own attacks cannot trigger her mark`, () => {
        const missing = fixture(); delete missing.gameContext!.coordinatedCast!.yoimiyaA1Inactive; assertBlocked(missing);
        missing.gameContext!.coordinatedCast!.yoimiyaA1Inactive = false; assertBlocked(missing);
        const own = fixture(); for (const event of own.gameContext!.coordinatedCast!.damageEvents!) event.actorId = "owner"; assertNumeric(own, [initialValue]);
      });
      it(`${skillId}: a confirmed zero-damage direct hit is still eligible under this distinct source hook`, () => {
        const doc = fixture(); for (const event of doc.gameContext!.coordinatedCast!.damageEvents!) event.damagePositive = false; assertNumeric(doc);
      });
    }
  }
});


describe("Keqing followups and Xinyan level3 pulses require their actual finite branch", () => {
  for (const [characterId, skillId, kind, coefficients, frames] of [
    ["character:10000042", "finite-followup-keqing-skill-recast-c0", "recast", [.504, 1.68], [25, 51]],
    ["character:10000042", "finite-followup-keqing-skill-detonation-c0", "detonation", [.504, .84, .84], [25, 58, 61]],
    ["character:10000044", "finite-followup-xinyan-skill-level3-c0", "xinyan", [1.696, .336, .336, .336, .336, .336], [15, 149, 269, 389, 509, 629]],
  ] as const) {
    const fixture = () => {
      const doc = getCharacterDocuments(characterId, 1).find(row => row.gameContext?.skillId === skillId)!;
      doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
      doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
      doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Explicit finite actual contacts and retained state; no automatic trigger or shield survival" };
      doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
      for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
      doc.gameContext!.finiteFollowupCast = { completeCastConfirmed: true, statsStableAcrossHits: true, noHitlag: true, noReplacement: true, noInterruption: true,
        ...(kind === "xinyan" ? { xinyanInitialOpponentCount: 2, xinyanShieldUnbroken: true } : { keqingPriorQInactive: true, keqingFreshStiletto: true, keqingFollowupFrame: kind === "recast" ? 35 : 37 }) };
      return doc;
    };
    const expected = coefficients.map(coefficient => 2000 * coefficient * .5 * .9);
    const assertNumeric = (doc: CalculatorDocument, values: readonly number[] = expected) => {
      const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(values.length);
      result.hits.forEach((hit, index) => expect(hit.nonCritical).toBeCloseTo(values[index]!, 8));
      expect(result.totals?.expected).toBeCloseTo(values.reduce((a, b) => a + b, 0) * 1.5, 8);
    };
    const assertBlocked = (doc: CalculatorDocument) => {
      const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0);
    };
    it(`${skillId}: exact default missing contract and independent T1 component values with declared source times`, () => {
      const initial = getCharacterDocuments(characterId, 10).find(doc => doc.gameContext?.skillId === skillId)!;
      const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS[skillId];
      expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined(); expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
      expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
      const prepared = prepareSourceCastDocument(fixture()); assertNumeric(prepared);
      expect(prepared.gameContext?.scopeCoverage).toBe("complete-cast");
      // This finite source entry exposes declared timing labels, not a simulated collision/trigger timeline.
      expect(prepared.hits.map(hit => Number(hit.label.match(/ · (\d+)帧$/)?.[1]))).toEqual(frames);
    });
    it.each(["completeCastConfirmed", "statsStableAcrossHits", "noHitlag", "noReplacement", "noInterruption"] as const)(`${skillId}: missing or false %s cannot certify the finite sum`, field => {
      const unknown = fixture(); delete unknown.gameContext!.finiteFollowupCast![field]; assertBlocked(unknown);
      const falseFlag = fixture(); falseFlag.gameContext!.finiteFollowupCast![field] = false; assertBlocked(falseFlag);
    });
    it(`${skillId}: C1 cannot reuse the C0 action`, () => { const doc = fixture(); doc.gameContext!.constellation = 1; assertBlocked(doc); });
    if (kind !== "xinyan") {
      it.each(["keqingPriorQInactive", "keqingFreshStiletto", "keqingFollowupFrame"] as const)(`${skillId}: missing %s cannot reconstruct a consumed or old stiletto`, field => {
        const doc = fixture(); delete doc.gameContext!.finiteFollowupCast![field]; assertBlocked(doc);
      });
      it.each(["keqingPriorQInactive", "keqingFreshStiletto"] as const)(`${skillId}: false %s cannot fit this fresh branch`, field => {
        const doc = fixture(); doc.gameContext!.finiteFollowupCast![field] = false; assertBlocked(doc);
      });
      it(`${skillId}: actual start boundary and expiry are checked before any queued later hits`, () => {
        const doc = fixture(), context = doc.gameContext!.finiteFollowupCast!;
        context.keqingFollowupFrame = kind === "recast" ? 34 : 36; assertBlocked(doc);
        context.keqingFollowupFrame = 319; assertNumeric(doc);
        expect(prepareSourceCastDocument(doc).hits.map(hit => Number(hit.label.match(/ · (\d+)帧$/)?.[1])))
          .toEqual(kind === "recast" ? [25, 335] : [25, 340, 343]);
        // The public input schema rejects this out-of-domain frame before semantic calculation.
        context.keqingFollowupFrame = 320;
        const invalid = calculatorDocumentSchema.safeParse(doc); expect(invalid.success).toBe(false);
        if (invalid.success) throw new Error("Expected exact upper-bound rejection");
        expect(invalid.error.issues).toEqual([expect.objectContaining({ code: "too_big", maximum: 319, path: ["gameContext", "finiteFollowupCast", "keqingFollowupFrame"] })]);
        expect(() => calculateDocument(doc)).toThrowError(/expected number to be <=319/);
      });
      it(`${skillId}: an independently selected initial throw does not require future followup evidence`, () => {
        const doc = fixture(); doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[0]!.id];
        doc.gameContext!.finiteFollowupCast = { keqingPriorQInactive: true };
        assertNumeric(doc, expected.slice(0, 1));
        delete doc.gameContext!.finiteFollowupCast!.keqingPriorQInactive; assertBlocked(doc);
      });
    } else {
      it.each(["xinyanInitialOpponentCount", "xinyanShieldUnbroken"] as const)(`${skillId}: missing %s cannot create five persistent shield pulses`, field => {
        const doc = fixture(); delete doc.gameContext!.finiteFollowupCast![field]; assertBlocked(doc);
      });
      it(`${skillId}: shield break and too few actual initial opponents invalidate the complete branch`, () => {
        const broken = fixture(); broken.gameContext!.finiteFollowupCast!.xinyanShieldUnbroken = false; assertBlocked(broken);
        const few = fixture(); few.gameContext!.finiteFollowupCast!.xinyanInitialOpponentCount = 1; assertBlocked(few);
      });
      it(`${skillId}: actual ASC changes required opponent count, not these T1 damage coefficients`, () => {
        const doc = fixture(); delete doc.gameContext!.ascension; if (doc.build.mode === "manual-final") delete doc.build.ascension; assertBlocked(doc);
        doc.gameContext!.ascension = 0; if (doc.build.mode === "manual-final") doc.build.ascension = 0; assertBlocked(doc);
        doc.gameContext!.finiteFollowupCast!.xinyanInitialOpponentCount = 3; assertNumeric(doc);
      });
      it(`${skillId}: one occurred initial swing does not assert a surviving level3 shield`, () => {
        const doc = fixture(); doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[0]!.id]; doc.gameContext!.finiteFollowupCast = {};
        assertNumeric(doc, expected.slice(0, 1));
      });
    }
  }
});


describe("Hu Tao actual selected Paramita hits require independent E and health snapshots", () => {
  for (const [skillId, coefficient] of hutaoCases) {
    const fixture = () => {
      const doc = getCharacterDocuments("character:10000046", 10).find(row => row.gameContext?.skillId === skillId)!;
      doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[0]!.id]; doc.characterLevel = 90;
      doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
      doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 30000, def: 800, em: 200, critRate: .5, critDamage: 1 }, source: "Actual selected hit, explicit E10 conversion and stable half-health sample; not an E rotation" };
      doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
      for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
      Object.assign(hutaoContext(doc)!, { paramitaActive: true, skillTalentLevel: 10, skillAttackIncludedInPanel: false,
        maxHpUnchangedSinceSkillCast: true, baseAttack: 700, hpPercentAtSnapshot: 50, a4ThresholdStable: true, a4IncludedInDamageBonus: false });
      return doc;
    };
    const assertNumeric = (doc: CalculatorDocument, atk = 3876.8, bonus = .33) => {
      const prepared = prepareSourceCastDocument(doc), result = calculateDocument(prepared);
      expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(1);
      expect(result.totals?.nonCritical).toBeCloseTo(atk * coefficient * (1 + bonus) * .5 * .9, 8);
      expect(result.totals?.expected).toBeCloseTo(atk * coefficient * (1 + bonus) * .5 * .9 * 1.5, 8);
      expect(prepared.hits[0]).toMatchObject({ kind: "ordinary", element: "pyro", attackTag: skillId.includes("charged") ? "charged" : "normal" });
    };
    const assertBlocked = (doc: CalculatorDocument) => {
      const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0);
    };
    it(`${skillId}: exact unknown default and independent NA10/E10/half-health arithmetic`, () => {
      const initial = getCharacterDocuments("character:10000046", 10).find(doc => doc.gameContext?.skillId === skillId)!;
      const blocked = calculateDocument(initial), contract = DEFAULT_CONTEXT_CONTRACTS[skillId];
      expect(blocked.status).toBe("blocked"); expect(blocked.totals).toBeUndefined(); expect(blocked.blockers).toHaveLength(contract.defaultBlockerCount);
      expect([...new Set(blocked.blockers.map(reason => reason.split(":")[0]))]).toEqual(contract.blockerPrefixes);
      // E10 .06256*30000=1876.8, below400%*700 cap. NA10 coefficient independently pinned above.
      assertNumeric(fixture());
    });
    it.each(["paramitaActive", "skillTalentLevel", "skillAttackIncludedInPanel", "maxHpUnchangedSinceSkillCast", "baseAttack", "hpPercentAtSnapshot", "a4ThresholdStable", "a4IncludedInDamageBonus"] as const)(`${skillId}: missing %s remains unknown`, field => {
      const doc = fixture(); delete hutaoContext(doc)![field]; assertBlocked(doc);
    });
    it(`${skillId}: inactive E or unsettled half-health threshold cannot borrow this state`, () => {
      const inactive = fixture(); hutaoContext(inactive)!.paramitaActive = false; assertBlocked(inactive);
      const unsettled = fixture(); hutaoContext(unsettled)!.a4ThresholdStable = false; assertBlocked(unsettled);
    });
    it(`${skillId}: actual ASC and NA identity cannot be replaced by level90 or E talent`, () => {
      const asc = fixture(); delete asc.gameContext!.ascension; if (asc.build.mode === "manual-final") delete asc.build.ascension; assertBlocked(asc);
      const wrong = fixture(); wrong.gameContext!.abilityId = "talent:hutao:combat2"; assertBlocked(wrong);
    });
    it(`${skillId}: separate effective E7 and white-ATK cap do not rescale NA10`, () => {
      const e7 = fixture(); hutaoContext(e7)!.skillTalentLevel = 7; assertNumeric(e7, 2000 + 30000 * .05359);
      const capped = fixture(); hutaoContext(capped)!.baseAttack = 100; assertNumeric(capped, 2400);
    });
    it(`${skillId}: E's historical maximumHP is independent of later maximumHP and A4 ratio`, () => {
      const doc = fixture(); Object.assign(hutaoContext(doc)!, { maxHpUnchangedSinceSkillCast: false, skillCastMaxHp: 20000 });
      if (doc.build.mode !== "manual-final") throw new Error("manual fixture"); doc.build.stats.hp = 90000;
      assertNumeric(doc, 3251.2); hutaoContext(doc)!.hpPercentAtSnapshot = 80; assertNumeric(doc, 3251.2, 0);
      delete hutaoContext(doc)!.skillCastMaxHp; assertBlocked(doc);
    });
    it(`${skillId}: exactly50% includes A4, just above does not; locked ASC removes only A4`, () => {
      const doc = fixture(); hutaoContext(doc)!.hpPercentAtSnapshot = 50.001; assertNumeric(doc, 3876.8, 0);
      hutaoContext(doc)!.hpPercentAtSnapshot = 50; doc.gameContext!.ascension = 3; if (doc.build.mode === "manual-final") doc.build.ascension = 3;
      assertNumeric(doc, 3876.8, 0);
    });
    it(`${skillId}: explicitly included attack and A4 are not added a second time`, () => {
      const doc = fixture(); hutaoContext(doc)!.skillAttackIncludedInPanel = true; hutaoContext(doc)!.a4IncludedInDamageBonus = true;
      if (doc.build.mode !== "manual-final") throw new Error("manual fixture"); doc.build.stats.atk = 3876.8;
      for (const hit of doc.hits) if (hit.kind === "ordinary") hit.damageBonus = .33; assertNumeric(doc);
    });
    it(`${skillId}: supported C1 leaves this actual single contact unchanged, not an extra inferred strike`, () => {
      const doc = fixture(); doc.gameContext!.constellation = 1; assertNumeric(doc);
      const extra = fixture(); const duplicate = structuredClone(extra.hits[0]!); duplicate.id = "invented-next-contact"; extra.hits.push(duplicate); extra.selectedHitIds.push(duplicate.id); extra.scope = "one-cast"; assertBlocked(extra);
    });
  }
});

describe("Hu Tao E-owned observed marker preserves refresh cadence and post-stance tails", () => {
  const skillId = "observed-hutao-skill-c0";
  const fixture = () => {
    const doc = getCharacterDocuments("character:10000046", 1).find(row => row.gameContext?.skillId === skillId)!;
    doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
    doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 1000, hp: 90000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Explicit observed CA refreshes; current HP90000 is not historical E-cast HP30000; no CA damage in E subtotal" };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
    doc.gameContext!.observedEntityCast = {
      casterId: "caster", targetId: "enemy", freshCastConfirmed: true, noHitlag: true, noInterruption: true,
      noReplacement: true, fullObservedLifetime: true, statsStableAcrossHits: true, observedThroughFrame: 873,
      hutao: { allChargedAttacksRecorded: true, noSwapUntilNaturalEnd: true, skillStartCurrentHP: 15000,
        skillStartMaxHP: 30000, skillStartBaseATK: 1000, chargedAttacks: [
          { id: "ca1", startFrame: 30, removedFrame: 60, nextState: "other", actorId: "caster", targetId: "enemy", hitConfirmed: true },
          { id: "ca2", startFrame: 300, removedFrame: 340, nextState: "other", actorId: "caster", targetId: "enemy", hitConfirmed: true },
          { id: "later-normal-ca", startFrame: 700, removedFrame: 740, nextState: "other", actorId: "caster", targetId: "enemy", hitConfirmed: true },
        ] },
      sharedState: { actualHPRatioAtSnapshot: .5, includedAttackBonus: 0, includedDamageBonus: 0 },
      targetContacts: { "blossom-1-1": true, "blossom-1-2": true, "blossom-1-3": true },
    };
    return doc;
  };
  const blocked = (doc: CalculatorDocument) => {
    const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0);
  };
  // Independent pinned E1 .64 and HP conversion .03841; refresh extends expiry, not tick origin.
  const numeric = (doc: CalculatorDocument, attacks = [2152.3, 2152.3, 1000], bonus = .33) => {
    const prepared = prepareSourceCastDocument(doc), result = calculateDocument(prepared);
    expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(attacks.length);
    attacks.forEach((atk, index) => expect(result.hits[index]!.nonCritical).toBeCloseTo(atk * .64 * (1 + bonus) * .5 * .9, 8));
    expect(result.totals?.expected).toBeCloseTo(attacks.reduce((sum, atk) => sum + atk * .64 * (1 + bonus) * .5 * .9 * 1.5, 0), 8);
    return prepared;
  };
  it("pins the unknown default and three E-owned ticks, without charging the CA body to E", () => {
    const result = calculateDocument(getCharacterDocuments("character:10000046", 10).find(row => row.gameContext?.skillId === skillId)!);
    expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers).toHaveLength(1);
    expect([...new Set(result.blockers.map(reason => reason.split(":")[0]))]).toEqual(["observed-entity"]);
    const prepared = numeric(fixture());
    expect(prepared.hits.map(hit => hit.kind === "ordinary" ? [hit.observedEntityEvent?.candidateId, hit.observedEntityEvent?.frame, hit.observedEntityEvent?.snapshotFrame, hit.observedEntityEvent?.paramitaActiveAtSnapshot] : null))
      .toEqual([["blossom-1-1", 273, 273, true], ["blossom-1-2", 513, 513, true], ["blossom-1-3", 753, 753, false]]);
  });
  it.each(["casterId", "targetId", "freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits", "observedThroughFrame", "hutao", "sharedState", "targetContacts"] as const)("missing %s does not certify a full observed marker", field => {
    const doc = fixture(); delete doc.gameContext!.observedEntityCast![field]; blocked(doc);
  });
  it.each(["freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits"] as const)("false %s cannot be silently promoted", field => {
    const doc = fixture(); doc.gameContext!.observedEntityCast![field] = false; blocked(doc);
  });
  it.each(["allChargedAttacksRecorded", "noSwapUntilNaturalEnd", "skillStartCurrentHP", "skillStartMaxHP", "skillStartBaseATK", "chargedAttacks"] as const)("missing E observation %s remains unknown", field => {
    const doc = fixture(); delete doc.gameContext!.observedEntityCast!.hutao![field]; blocked(doc);
  });
  it.each(["actualHPRatioAtSnapshot", "includedAttackBonus", "includedDamageBonus"] as const)("missing sampled %s is not reconstructed from E startup", field => {
    const doc = fixture(); delete doc.gameContext!.observedEntityCast!.sharedState![field]; blocked(doc);
  });
  it("retains the complete873-frame marker lifetime even after last damage or a known miss", () => {
    const short = fixture(); short.gameContext!.observedEntityCast!.observedThroughFrame = 872; blocked(short);
    const miss = fixture(); miss.gameContext!.observedEntityCast!.targetContacts!["blossom-1-3"] = false; numeric(miss, [2152.3, 2152.3]);
    miss.gameContext!.observedEntityCast!.observedThroughFrame = 753; blocked(miss);
    const unknown = fixture(); delete unknown.gameContext!.observedEntityCast!.targetContacts!["blossom-1-3"]; blocked(unknown);
  });
  it("requires actual CA contacts, and refuses unresolved exact-expiry or contradictory swap histories", () => {
    const unknown = fixture(); delete unknown.gameContext!.observedEntityCast!.hutao!.chargedAttacks![0]!.hitConfirmed; blocked(unknown);
    const boundary = fixture(); boundary.gameContext!.observedEntityCast!.hutao!.chargedAttacks!.push({ id: "exact-expiry", startFrame: 554, removedFrame: 590, nextState: "other", actorId: "caster", targetId: "enemy", hitConfirmed: true }); blocked(boundary);
    const swap = fixture(); swap.gameContext!.observedEntityCast!.hutao!.exitFrame = 100; blocked(swap);
  });
  it("uses historical E HP and the400-percent base-ATK cap, plus actual threshold and passive unlock", () => {
    const cap = fixture(); cap.gameContext!.observedEntityCast!.hutao!.skillStartBaseATK = 100; numeric(cap, [1400, 1400, 1000]);
    const above = fixture(); above.gameContext!.observedEntityCast!.sharedState!.actualHPRatioAtSnapshot = .50001; numeric(above, [2152.3, 2152.3, 1000], 0);
    const asc3 = fixture(); asc3.gameContext!.ascension = 3; if (asc3.build?.mode === "manual-final") asc3.build.ascension = 3; numeric(asc3, [2152.3, 2152.3, 1000], 0);
    const unknown = fixture(); delete unknown.gameContext!.ascension; if (unknown.build?.mode === "manual-final") delete unknown.build.ascension; blocked(unknown);
    const c1 = fixture(); c1.gameContext!.constellation = 1; blocked(c1);
  });
  it("subtracts explicitly included E ATK even on the tail where E has expired", () => {
    const doc = fixture(); if (doc.build?.mode === "manual-final") doc.build.stats.atk = 2152.3;
    doc.gameContext!.observedEntityCast!.sharedState!.includedAttackBonus = 1152.3;
    numeric(doc);
  });
  it("does not add A4 twice when the explicit hit bonus already contains it", () => {
    const doc = fixture(); for (const hit of doc.hits) if (hit.kind === "ordinary") hit.damageBonus = .33;
    doc.gameContext!.observedEntityCast!.sharedState!.includedDamageBonus = .33; numeric(doc);
  });
  it("an independently occurred inactive blossom needs its actual state, not future CA history", () => {
    const doc = prepareSourceCastDocument(fixture()); doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[2]!.id];
    delete doc.gameContext!.observedEntityCast!.hutao;
    const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]);
    expect(result.totals?.expected).toBeCloseTo(1000 * .64 * 1.33 * .5 * .9 * 1.5, 8);
    delete doc.gameContext!.observedEntityCast!.sharedState!.includedAttackBonus; blocked(doc);
  });
});


describe("Kazuha complete unabsorbed Q requires actual contact and stable snapshots", () => {
  const fixture = () => {
    const doc = getCharacterDocuments("character:10000047", 10).find(row => row.gameContext?.skillId === "kazuha-burst-complete")!;
    doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
    doc.gameContext!.constellation = 0; doc.gameContext!.ascension = 6;
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 9999, critRate: .5, critDamage: 1 }, source: "Explicit six actual unabsorbed Q hits; stable81f/82f offensive samples, not inferred contacts" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = .466; hit.reaction = "none"; }
    Object.assign(kazuhaBurstContext(doc)!, { absorptionElement: "none", allHitsConnected: true, statsStableAcrossSnapshots: true });
    return doc;
  };
  const blocked = (doc: CalculatorDocument) => { const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0); };
  it("pins six exact unknown-default blockers and independent Q10 initial/five-tick arithmetic", () => {
    const initial = calculateDocument(getCharacterDocuments("character:10000047", 10).find(row => row.gameContext?.skillId === "kazuha-burst-complete")!);
    expect(initial.status).toBe("blocked"); expect(initial.totals).toBeUndefined(); expect(initial.blockers).toHaveLength(6);
    expect([...new Set(initial.blockers.map(reason => reason.split(":")[0]))]).toEqual(["kazuha-burst"]);
    const prepared = prepareSourceCastDocument(fixture()), result = calculateDocument(prepared);
    expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(6);
    [4.7232, 2.16, 2.16, 2.16, 2.16, 2.16].forEach((coefficient, index) => expect(result.hits[index]!.nonCritical).toBeCloseTo(2000 * coefficient * 1.466 * .5 * .9, 8));
    expect(result.totals?.expected).toBeCloseTo(2000 * (4.7232 + 5 * 2.16) * 1.466 * .5 * .9 * 1.5, 8);
    expect(Object.values(kazuhaBurstContext(prepared)!.hitEvents!).map(event => [event.frame, event.snapshotFrame, event.ownerId]))
      .toEqual([[82,82,"character:10000047"],[140,81,"character:10000047"],[257,81,"character:10000047"],[374,81,"character:10000047"],[491,81,"character:10000047"],[608,81,"character:10000047"]]);
  });
  it.each(["allHitsConnected", "statsStableAcrossSnapshots", "absorptionElement"] as const)("missing %s stays unknown", field => {
    const doc = fixture(); delete kazuhaBurstContext(doc)![field]; blocked(doc);
  });
  it.each(["allHitsConnected", "statsStableAcrossSnapshots"] as const)("false %s cannot certify all six hits", field => {
    const doc = fixture(); kazuhaBurstContext(doc)![field] = false; blocked(doc);
  });
  it("does not assume an absorption start or C2 snapshots", () => {
    const absorbed = fixture(); kazuhaBurstContext(absorbed)!.absorptionElement = "pyro"; delete kazuhaBurstContext(absorbed)!.absorptionStartFrame; blocked(absorbed);
    const c2 = fixture(); c2.gameContext!.constellation = 2; blocked(c2);
  });
});

describe("Yanfei actual initial Q and Aloy explicit reference protocol defaults", () => {
  const fixture = (characterId: string, skillId: RegisteredContextSkill) => {
    const doc = getCharacterDocuments(characterId, 1).find(row => row.gameContext?.skillId === skillId)!;
    doc.characterLevel = 90; doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Explicit source-contract sample; not independent in-game collision evidence" };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
    return doc;
  };
  const yanfei = () => {
    const doc = fixture("character:10000048", "idle-yanfei-burst-c0");
    doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[0]!.id];
    doc.gameContext!.idleStanceCast = { sharedState: { yanfeiA1Seals: 3, includedDamageBonus: 0 } }; return doc;
  };
  const aloy = () => {
    const doc = fixture("character:10000062", "observed-aloy-skill-c0"); doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id);
    doc.gameContext!.observedEntityCast = { casterId: "caster", targetId: "enemy", freshCastConfirmed: true, noHitlag: true,
      noInterruption: true, noReplacement: true, fullObservedLifetime: true, statsStableAcrossHits: true, observedThroughFrame: 122,
      aloy: { fixedSourceApproximationConfirmed: true, travelFrames: 30, bombDelayFrames: 60, bombletCount: 2, allSourceBombletsDeclared: true },
      targetContacts: { main: true, "bomblet-1": true, "bomblet-2": true } }; return doc;
  };
  const blocked = (doc: CalculatorDocument) => { const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0); };
  const numeric = (doc: CalculatorDocument, coefficients: number[], bonus = 0) => {
    const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(coefficients.length);
    coefficients.forEach((coefficient, index) => expect(result.hits[index]!.nonCritical).toBeCloseTo(2000 * coefficient * (1 + bonus) * .5 * .9, 8));
    expect(result.totals?.expected).toBeCloseTo(2000 * coefficients.reduce((a,b) => a+b, 0) * (1 + bonus) * .5 * .9 * 1.5, 8);
  };
  it.each([["character:10000048", "idle-yanfei-burst-c0", 1, "idle-stance"], ["character:10000062", "observed-aloy-skill-c0", 2, "observed-entity"]] as const)("pins exact unknown default %s/%s", (character, skillId, count, prefix) => {
    const result = calculateDocument(getCharacterDocuments(character, 10).find(row => row.gameContext?.skillId === skillId)!);
    expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers).toHaveLength(count);
    expect([...new Set(result.blockers.map(reason => reason.split(":")[0]))]).toEqual([prefix]);
  });
  it("calculates only Yanfei's occurred Q1 initial using its actual prior three-seal A1 share", () => { numeric(yanfei(), [1.824], .15); });
  it.each(["yanfeiA1Seals", "includedDamageBonus"] as const)("Yanfei missing %s cannot be guessed", field => {
    const doc = yanfei(); delete doc.gameContext!.idleStanceCast!.sharedState![field]; blocked(doc);
  });
  it("Yanfei explicitly inactive or ASC0 A1 differs from unknown, and included A1 is not doubled", () => {
    const inactive = yanfei(); inactive.gameContext!.idleStanceCast!.yanfei = { priorA1Inactive: true }; numeric(inactive, [1.824]);
    const asc0 = yanfei(); asc0.gameContext!.ascension = 0; if (asc0.build?.mode === "manual-final") asc0.build.ascension = 0; numeric(asc0, [1.824]);
    const included = yanfei(); included.gameContext!.idleStanceCast!.sharedState!.includedDamageBonus = .15;
    for (const hit of included.hits) if (hit.kind === "ordinary") hit.damageBonus = .15; numeric(included, [1.824], .15);
    const unknown = yanfei(); delete unknown.gameContext!.ascension; if (unknown.build?.mode === "manual-final") delete unknown.build.ascension; blocked(unknown);
    const c1 = yanfei(); c1.gameContext!.constellation = 1; blocked(c1);
  });
  it("Aloy's declared reference parameters preserve independent main/bomblet multipliers and snapshots", () => {
    const doc = aloy(); numeric(doc, [1.776, .4, .4]);
    expect(prepareSourceCastDocument(doc).hits.map(hit => hit.kind === "ordinary" ? [hit.observedEntityEvent?.frame, hit.observedEntityEvent?.snapshotFrame] : null)).toEqual([[50,20],[116,50],[122,50]]);
  });
  it.each(["casterId", "targetId", "freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits", "observedThroughFrame", "aloy", "targetContacts"] as const)("Aloy missing %s stays unknown", field => {
    const doc = aloy(); delete doc.gameContext!.observedEntityCast![field]; blocked(doc);
  });
  it.each(["fixedSourceApproximationConfirmed", "travelFrames", "bombDelayFrames", "bombletCount", "allSourceBombletsDeclared"] as const)("Aloy missing source %s cannot borrow a default", field => {
    const doc = aloy(); delete doc.gameContext!.observedEntityCast!.aloy![field]; blocked(doc);
  });
  it.each(["fixedSourceApproximationConfirmed", "allSourceBombletsDeclared"] as const)("Aloy false %s does not certify a reference protocol", field => {
    const doc = aloy(); doc.gameContext!.observedEntityCast!.aloy![field] = false; blocked(doc);
  });
  it("Aloy's known final miss still requires the122-frame opportunity; unknown contact stays blocked", () => {
    const doc = aloy(); doc.gameContext!.observedEntityCast!.targetContacts!["bomblet-2"] = false; numeric(doc, [1.776, .4]);
    doc.gameContext!.observedEntityCast!.observedThroughFrame = 121; blocked(doc);
    const unknown = aloy(); delete unknown.gameContext!.observedEntityCast!.targetContacts!["bomblet-2"]; blocked(unknown);
  });
  it("Aloy's explicit zero bomblets is not a missing count or an invented default of two", () => {
    const doc = aloy(); doc.gameContext!.observedEntityCast!.aloy!.bombletCount = 0; doc.gameContext!.observedEntityCast!.observedThroughFrame = 110;
    doc.gameContext!.observedEntityCast!.targetContacts = { main: true }; numeric(doc, [1.776]);
  });
});

describe("Kuki complete Q uses actual cast HP rather than branch names or maximum HP", () => {
  for (const [skillId, count, ratio] of [["kuki-burst-high-hp-complete-cast", 7, .50001], ["kuki-burst-low-hp-complete-cast", 12, .5]] as const) {
    const fixture = () => {
      const doc = getCharacterDocuments("character:10000065", 1).find(row => row.gameContext?.skillId === skillId)!;
      doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
      doc.gameContext!.constellation = 0; doc.gameContext!.ascension = 6;
      doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
      doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 9000, hp: 20000, def: 800, em: 9000, critRate: .5, critDamage: 1 }, source: "Explicit Q1 shared HP snapshot and actual cast-health branch; no E/C6 or reaction inference" };
      for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
      doc.gameContext!.kukiDamage = { statsStableAcrossHits: true, burstHpRatioAtCast: ratio }; return doc;
    };
    const calculate = (doc: CalculatorDocument) => calculateDocument(applyCharacterConstellationScope(doc));
    const blocked = (doc: CalculatorDocument) => { const result = calculate(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0); };
    it(`${skillId}: exact default blockers and independent Q1 per-hit HP arithmetic`, () => {
      const initial = calculateDocument(getCharacterDocuments("character:10000065", 10).find(row => row.gameContext?.skillId === skillId)!);
      expect(initial.status).toBe("blocked"); expect(initial.totals).toBeUndefined(); expect(initial.blockers).toHaveLength(count);
      expect([...new Set(initial.blockers.map(reason => reason.split(":")[0]))]).toEqual(["kuki-damage-context"]);
      const result = calculate(fixture()); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(count);
      for (const hit of result.hits) expect(hit.nonCritical).toBeCloseTo(20000 * .036048 * .5 * .9, 8);
      expect(result.totals?.expected).toBeCloseTo(count * 20000 * .036048 * .5 * .9 * 1.5, 8);
    });
    it.each(["burstHpRatioAtCast", "statsStableAcrossHits"] as const)(`${skillId}: missing %s stays unknown`, field => {
      const doc = fixture(); delete doc.gameContext!.kukiDamage![field]; blocked(doc);
    });
    it(`${skillId}: false stability or opposite inclusive50-percent branch cannot retain a cached result`, () => {
      const unstable = fixture(); unstable.gameContext!.kukiDamage!.statsStableAcrossHits = false; blocked(unstable);
      const opposite = applyCharacterConstellationScope(fixture()); opposite.gameContext!.kukiDamage!.burstHpRatioAtCast = count === 7 ? .5 : .50001; blocked(opposite);
    });
    it(`${skillId}: an actual first-seven hit does not need the future HP branch or shared stability`, () => {
      const doc = fixture(); doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[6]!.id];
      delete doc.gameContext!.kukiDamage!.burstHpRatioAtCast; delete doc.gameContext!.kukiDamage!.statsStableAcrossHits;
      const result = calculate(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]);
      expect(result.totals?.expected).toBeCloseTo(20000 * .036048 * .5 * .9 * 1.5, 8);
      if (count === 12) { doc.selectedHitIds = [doc.hits[7]!.id]; blocked(doc); }
    });
  }
});

describe("Collei complete E preserves independent release and return snapshots", () => {
  for (const [skillId, sprouts, count] of [["collei-skill-no-sprout-complete", 0, 2], ["collei-skill-sprout-complete", 2, 6], ["collei-skill-extended-sprout-complete", 4, 10]] as const) {
    const fixture = () => {
      const doc = getCharacterDocuments("character:10000067", 1).find(row => row.gameContext?.skillId === skillId)!;
      doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
      doc.gameContext!.constellation = sprouts === 4 ? 2 : 0; doc.gameContext!.ascension = 6;
      doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
      doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 1000, hp: 10000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Actual E release panel; distinct return panel independently supplied, not inferred collision evidence" };
      for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
      doc.gameContext!.colleiSkill = { reactionBeforeReturn: sprouts > 0, reactionDuringSprout: false, sproutUninterrupted: true,
        ...(sprouts ? { sproutSnapshot: { stats: { atk: 2000, hp: 11000, def: 750, em: 50, critRate: .2, critDamage: .5, energyRecharge: 1.2 },
          characterLevel: 90, ascension: 6, damageBonus: .3, additiveBaseDamage: 0, reactionBonus: 0,
          source: "Independent actual return snapshot; not E release panel", sourceRefs: ["conditioned-return-snapshot"] } } : {}) };
      return doc;
    };
    const prepare = (doc: CalculatorDocument) => applyColleiSkillContext(doc, doc.gameContext!.colleiSkill ?? {});
    const blocked = (doc: CalculatorDocument) => { const result = calculateDocument(prepare(doc)); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0); };
    const numeric = (doc: CalculatorDocument) => {
      const result = calculateDocument(prepare(doc)); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(2 + sprouts);
      for (let index = 0; index < 2; index++) expect(result.hits[index]!.expected).toBeCloseTo(1000 * 1.512 * .5 * .9 * 1.5, 8);
      for (let index = 2; index < 2 + sprouts; index++) expect(result.hits[index]!.expected).toBeCloseTo(2000 * .4 * 1.3 * .5 * .9 * 1.1, 8);
      expect(result.totals?.expected).toBeCloseTo(2 * 1000 * 1.512 * .5 * .9 * 1.5 + sprouts * 2000 * .4 * 1.3 * .5 * .9 * 1.1, 8);
    };
    it(`${skillId}: static default blockers and independent release/return arithmetic`, () => {
      const initial = calculateDocument(getCharacterDocuments("character:10000067", 10).find(row => row.gameContext?.skillId === skillId)!);
      expect(initial.status).toBe("blocked"); expect(initial.totals).toBeUndefined(); expect(initial.blockers).toHaveLength(count);
      expect([...new Set(initial.blockers.map(reason => reason.split(":")[0]))]).toEqual(["collei-skill-context"]); numeric(fixture());
    });
    it(`${skillId}: unknown or opposite trigger cannot certify the chosen full branch`, () => {
      const unknown = fixture(); delete unknown.gameContext!.colleiSkill!.reactionBeforeReturn; blocked(unknown);
      const opposite = fixture(); opposite.gameContext!.colleiSkill!.reactionBeforeReturn = !Boolean(sprouts); blocked(opposite);
      const c6 = fixture(); c6.gameContext!.constellation = 6; blocked(c6);
      const asc = fixture(); delete asc.gameContext!.ascension; if (asc.build?.mode === "manual-final") delete asc.build.ascension; blocked(asc);
    });
    if (sprouts) {
      it.each(["sproutUninterrupted", "sproutSnapshot"] as const)(`${skillId}: missing %s after materialization cannot retain old return data`, field => {
        const doc = prepare(fixture()); delete doc.gameContext!.colleiSkill![field]; blocked(doc);
      });
      it(`${skillId}: false uninterrupted or an ASC0 return snapshot cannot certify sprout`, () => {
        const interrupted = fixture(); interrupted.gameContext!.colleiSkill!.sproutUninterrupted = false; blocked(interrupted);
        const asc0 = fixture(); asc0.gameContext!.colleiSkill!.sproutSnapshot!.ascension = 0; blocked(asc0);
      });
      it(`${skillId}: one actual ring does not need the unselected future return snapshot`, () => {
        const doc = fixture(); doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[0]!.id]; delete doc.gameContext!.colleiSkill!.sproutSnapshot;
        delete doc.gameContext!.colleiSkill!.reactionBeforeReturn; delete doc.gameContext!.colleiSkill!.sproutUninterrupted;
        const result = calculateDocument(prepare(doc)); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]);
        expect(result.totals?.expected).toBeCloseTo(1000 * 1.512 * .5 * .9 * 1.5, 8);
      });
    } else {
      it("ASC0 explicitly permits no sprout without inventing a reaction record", () => {
        const doc = fixture(); doc.gameContext!.ascension = 0; if (doc.build?.mode === "manual-final") doc.build.ascension = 0;
        delete doc.gameContext!.colleiSkill!.reactionBeforeReturn; numeric(doc);
      });
    }
    if (sprouts === 4) it("C2 extension accepts either actual trigger, not an invented requirement for both", () => {
      const doc = fixture(); delete doc.gameContext!.colleiSkill!.reactionBeforeReturn; doc.gameContext!.colleiSkill!.reactionDuringSprout = true; numeric(doc);
    });
  }
});

describe("Actual Nilou and Alhaitham initial hits retain cast-time scaling inputs", () => {
  for (const [character, skillId, stat, field, sampled, panel] of [
    ["character:10000070", "idle-nilou-skill-c0", "hp", "scalingHp", 20000, 90000],
    ["character:10000078", "idle-alhaitham-skill-c0", "em", "scalingEm", 200, 900],
  ] as const) {
    const fixture = () => {
      const doc = getCharacterDocuments(character, 1).find(row => row.gameContext?.skillId === skillId)!;
      doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[0]!.id]; doc.characterLevel = 90;
      doc.gameContext!.constellation = 0; doc.gameContext!.ascension = 6;
      doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 1000, hp: 90000, def: 800, em: 900, critRate: .5, critDamage: 1 }, source: "Actual initial-hit panel with distinct explicit cast-time scaling; no subsequent stance or projection claim" };
      doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
      for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
      doc.gameContext!.idleStanceCast = { sharedState: { [field]: sampled } }; return doc;
    };
    const numeric = (doc: CalculatorDocument, value: number) => {
      const result = calculateDocument(doc), base = stat === "hp" ? value * .033389 : 1000 * 1.936 + value * 1.5488;
      expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(1);
      expect(result.totals?.nonCritical).toBeCloseTo(base * .5 * .9, 8); expect(result.totals?.expected).toBeCloseTo(base * .5 * .9 * 1.5, 8);
    };
    const blocked = (doc: CalculatorDocument) => { const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0); };
    it(`${skillId}: exact unknown default and independent T1 split-scaling arithmetic`, () => {
      const initial = calculateDocument(getCharacterDocuments(character, 10).find(row => row.gameContext?.skillId === skillId)!);
      expect(initial.status).toBe("blocked"); expect(initial.totals).toBeUndefined(); expect(initial.blockers).toHaveLength(1);
      expect([...new Set(initial.blockers.map(reason => reason.split(":")[0]))]).toEqual(["idle-stance"]); numeric(fixture(), sampled);
    });
    it(`${skillId}: explicit cast scalar overrides current panel and does not need same-panel permission`, () => {
      const doc = fixture(); doc.gameContext!.idleStanceCast!.sharedState!.scalingStatMatchesPanel = false;
      if (doc.build?.mode === "manual-final") doc.build.stats[stat] = panel * 2; numeric(doc, sampled);
    });
    it(`${skillId}: missing or false same-panel permission cannot restore a removed materialized sample`, () => {
      const doc = prepareSourceCastDocument(fixture()); delete doc.gameContext!.idleStanceCast!.sharedState![field]; delete doc.gameContext!.idleStanceCast!.snapshots;
      blocked(doc); doc.gameContext!.idleStanceCast!.sharedState!.scalingStatMatchesPanel = false; blocked(doc);
      doc.gameContext!.idleStanceCast!.sharedState!.scalingStatMatchesPanel = true; numeric(doc, panel);
    });
    it(`${skillId}: explicitly zero historical scaling remains zero rather than falling back to panel`, () => {
      const doc = fixture(); doc.gameContext!.idleStanceCast!.sharedState![field] = 0; numeric(doc, 0);
    });
    it(`${skillId}: C1 is not certified by this C0 initial contract`, () => { const doc = fixture(); doc.gameContext!.constellation = 1; blocked(doc); });
  }
});

describe("Cyno actual selected Q normals preserve action-start EM and independent Q talents", () => {
  for (const [skillId, coefficient] of cynoDefaultCases) {
    const fixture = () => {
      const doc = getCharacterDocuments("character:10000071", 10).find(row => row.gameContext?.skillId === skillId)!;
      doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[0]!.id]; doc.characterLevel = 90;
      doc.gameContext!.constellation = 0; doc.gameContext!.ascension = 6;
      doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 300, critRate: .5, critDamage: 1 }, source: "Actual selected Q normal; Q10 independent of NA, explicit action-start EM sampling and accounting" };
      doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
      for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; hit.additiveBaseDamage = 0; }
      Object.assign(cynoContext(doc)!, { burstActive: true, burstEmIncludedInPanel: false, emStableFromActionStart: true, includedA4Base: 0 }); return doc;
    };
    const numeric = (doc: CalculatorDocument, a4 = 600) => {
      const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(1);
      expect(result.totals?.nonCritical).toBeCloseTo((2000 * coefficient + a4) * .5 * .9, 8);
      expect(result.totals?.expected).toBeCloseTo((2000 * coefficient + a4) * .5 * .9 * 1.5, 8);
    };
    const blocked = (doc: CalculatorDocument) => { const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0); };
    it(`${skillId}: exact default blocker and independent shared-calculator Q10/A4 oracle`, () => {
      const result = calculateDocument(getCharacterDocuments("character:10000071", 10).find(row => row.gameContext?.skillId === skillId)!);
      expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers).toHaveLength(1);
      expect([...new Set(result.blockers.map(reason => reason.split(":")[0]))]).toEqual(["cyno-damage"]); numeric(fixture());
    });
    it.each(["burstActive", "burstEmIncludedInPanel", "emStableFromActionStart", "includedA4Base"] as const)(`${skillId}: missing %s remains unknown`, field => {
      const doc = fixture(); if (field === "includedA4Base" && doc.hits[0]!.kind === "ordinary") doc.hits[0]!.additiveBaseDamage = 100;
      delete cynoContext(doc)![field]; blocked(doc);
    });
    it(`${skillId}: inactive Q and changing EM without an actual action-start sample stay blocked`, () => {
      const inactive = fixture(); cynoContext(inactive)!.burstActive = false; blocked(inactive);
      const unknown = fixture(); cynoContext(unknown)!.emStableFromActionStart = false; blocked(unknown);
    });
    it(`${skillId}: actual action-start totalEM200 or0 is not replaced by the hit panel or another Q100`, () => {
      const doc = fixture(); Object.assign(cynoContext(doc)!, { emStableFromActionStart: false, actionStartEm: 200 });
      if (doc.build?.mode === "manual-final") doc.build.stats.em = 900; numeric(doc, 300);
      cynoContext(doc)!.actionStartEm = 0; numeric(doc, 0);
    });
    it(`${skillId}: included Q EM and included A4 base are each applied once`, () => {
      const doc = fixture(); if (doc.build?.mode === "manual-final") doc.build.stats.em = 400;
      cynoContext(doc)!.burstEmIncludedInPanel = true; numeric(doc);
      if (doc.hits[0]!.kind === "ordinary") doc.hits[0]!.additiveBaseDamage = 600;
      cynoContext(doc)!.includedA4Base = 600; numeric(doc);
    });
    it(`${skillId}: ASC3 removes A4 only, while unknownASC, NA-talent substitution and C1 remain blocked`, () => {
      const asc3 = fixture(); asc3.gameContext!.ascension = 3; if (asc3.build?.mode === "manual-final") asc3.build.ascension = 3;
      delete cynoContext(asc3)!.emStableFromActionStart; numeric(asc3, 0);
      const unknown = fixture(); delete unknown.gameContext!.ascension; if (unknown.build?.mode === "manual-final") delete unknown.build.ascension; blocked(unknown);
      const na = fixture(); na.gameContext!.abilityId = "talent:cyno:combat1"; blocked(na);
      const c1 = fixture(); c1.gameContext!.constellation = 1; blocked(c1);
    });
  }
});

describe("Cyno finite E branches keep Endseer main bonus and bolt cast-EM separate", () => {
  for (const [skillId, endseer, blockers] of [["finite-followup-cyno-skill-no-endseer-c0", false, 1], ["finite-followup-cyno-skill-endseer-c0", true, 8]] as const) {
    const fixture = () => {
      const doc = getCharacterDocuments("character:10000071", 1).find(row => row.gameContext?.skillId === skillId)!;
      doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
      doc.gameContext!.constellation = 0; doc.gameContext!.ascension = 6;
      doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 900, critRate: .5, critDamage: 1 }, source: "Explicit actual finite E contacts and E-start totalEM300; distinct later panelEM900, not an automatic Q rotation" };
      doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
      for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.additiveBaseDamage = 0; hit.reaction = "none"; }
      doc.gameContext!.finiteFollowupCast = { completeCastConfirmed: true, statsStableAcrossHits: true, noHitlag: true, noReplacement: true, noInterruption: true,
        cynoBurstActive: true, cynoEndseerActive: endseer, cynoBurstEmIncludedInPanel: false, cynoCastEm: 300,
        hitStates: Object.fromEntries(doc.hits.map(hit => [hit.id, { includedDamageBonus: 0, includedAdditiveBase: 0 }])) }; return doc;
    };
    const numeric = (doc: CalculatorDocument, boltA4 = 750) => {
      const result = calculateDocument(doc), bases = endseer ? [2000 * 1.568 * 1.35, 2000 + boltA4, 2000 + boltA4, 2000 + boltA4] : [2000 * 1.568];
      expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(bases.length);
      bases.forEach((base, index) => expect(result.hits[index]!.nonCritical).toBeCloseTo(base * .5 * .9, 8));
      expect(result.totals?.expected).toBeCloseTo(bases.reduce((a,b) => a+b,0) * .5 * .9 * 1.5, 8);
    };
    const blocked = (doc: CalculatorDocument) => { const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0); };
    it(`${skillId}: exact unknown default and independent E1 main/fixed-bolt arithmetic`, () => {
      const initial = calculateDocument(getCharacterDocuments("character:10000071", 10).find(row => row.gameContext?.skillId === skillId)!);
      expect(initial.status).toBe("blocked"); expect(initial.totals).toBeUndefined(); expect(initial.blockers).toHaveLength(blockers);
      expect([...new Set(initial.blockers.map(reason => reason.split(":")[0]))]).toEqual(["finite-followup"]); numeric(fixture());
    });
    it.each(["completeCastConfirmed", "noHitlag", "noReplacement", "noInterruption", "cynoBurstActive", "cynoEndseerActive", "cynoBurstEmIncludedInPanel"] as const)(`${skillId}: missing %s remains unknown`, field => {
      const doc = fixture(); delete doc.gameContext!.finiteFollowupCast![field]; blocked(doc);
    });
    it.each(["completeCastConfirmed", "noHitlag", "noReplacement", "noInterruption", "cynoBurstActive"] as const)(`${skillId}: false %s cannot certify the actual branch`, field => {
      const doc = fixture(); doc.gameContext!.finiteFollowupCast![field] = false; blocked(doc);
    });
    it.each(["includedDamageBonus", "includedAdditiveBase"] as const)(`${skillId}: each hit needs explicit %s accounting`, field => {
      for (const hit of fixture().hits) { const doc = fixture(); delete doc.gameContext!.finiteFollowupCast!.hitStates![hit.id]![field]; blocked(doc); }
    });
    it(`${skillId}: opposite Endseer, unknownASC and C1 are not the same contract`, () => {
      const opposite = fixture(); opposite.gameContext!.finiteFollowupCast!.cynoEndseerActive = !endseer; blocked(opposite);
      const asc = fixture(); delete asc.gameContext!.ascension; if (asc.build?.mode === "manual-final") delete asc.build.ascension; blocked(asc);
      const c1 = fixture(); c1.gameContext!.constellation = 1; blocked(c1);
    });
    it(`${skillId}: per-hit included bonus/base restores the same independent oracle`, () => {
      const doc = fixture();
      for (const hit of doc.hits) if (hit.kind === "ordinary") {
        const bolt = hit.id.includes("-bolt-"); hit.damageBonus = endseer && !bolt ? .35 : 0; hit.additiveBaseDamage = bolt ? 750 : 0;
        doc.gameContext!.finiteFollowupCast!.hitStates![hit.id] = { includedDamageBonus: hit.damageBonus, includedAdditiveBase: hit.additiveBaseDamage };
      }
      numeric(doc);
    });
    if (endseer) {
      it("Endseer bolt A4 requires an actual cast sample and stable full contact context", () => {
        for (const key of ["cynoCastEm", "statsStableAcrossHits"] as const) { const doc = fixture(); delete doc.gameContext!.finiteFollowupCast![key]; blocked(doc); }
        const unstable = fixture(); unstable.gameContext!.finiteFollowupCast!.statsStableAcrossHits = false; blocked(unstable);
        const zero = fixture(); zero.gameContext!.finiteFollowupCast!.cynoCastEm = 0; numeric(zero, 0);
        const asc3 = fixture(); asc3.gameContext!.ascension = 3; if (asc3.build?.mode === "manual-final") asc3.build.ascension = 3;
        delete asc3.gameContext!.finiteFollowupCast!.cynoCastEm; numeric(asc3, 0);
        asc3.gameContext!.ascension = 0; if (asc3.build?.mode === "manual-final") asc3.build.ascension = 0; blocked(asc3);
      });
    }
    it(`${skillId}: the actual selected main does not require a future bolt EM sample`, () => {
      const doc = fixture(); doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[0]!.id];
      delete doc.gameContext!.finiteFollowupCast!.cynoCastEm; delete doc.gameContext!.finiteFollowupCast!.completeCastConfirmed; delete doc.gameContext!.finiteFollowupCast!.statsStableAcrossHits;
      const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]);
      expect(result.totals?.expected).toBeCloseTo(2000 * 1.568 * (endseer ? 1.35 : 1) * .5 * .9 * 1.5, 8);
    });
  }
});

describe("Layla explicitly observed intrinsic volley keeps launch samples and shield lifetime", () => {
  const fixture = () => {
    const doc = getCharacterDocuments("character:10000074", 1).find(row => row.gameContext?.skillId === "observed-layla-skill-c0")!;
    doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
    doc.gameContext!.constellation = 0; doc.gameContext!.ascension = 6;
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 90000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Explicit empty external E/Q history and five target-search observations; actual launchHP20000 is not currentHP90000" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.additiveBaseDamage = 0; hit.reaction = "none"; }
    doc.gameContext!.observedEntityCast = { casterId: "caster", targetId: "enemy", freshCastConfirmed: true, noHitlag: true, noInterruption: true,
      noReplacement: true, fullObservedLifetime: true, statsStableAcrossHits: true, observedThroughFrame: 739,
      targetContacts: { initial: true, "volley-1-star-1": true, "volley-1-star-2": true, "volley-1-star-3": true, "volley-1-star-4": true },
      layla: { shieldEndFrame: 739, shieldLifetimeConfirmed: true, allStarEventsRecorded: true, skillEvents: [], burstHitEvents: [], targetChecks: {
        "volley-1-check-1": { targetId: "enemy", closestWithin10Confirmed: true }, "volley-1-check-2": { targetId: "enemy", closestWithin10Confirmed: true },
        "volley-1-check-3": { targetId: "enemy", closestWithin10Confirmed: true }, "volley-1-check-4": { targetId: "enemy", closestWithin10Confirmed: true },
        "volley-1-check-5": { targetId: "enemy", closestWithin10Confirmed: true },
      } }, sharedState: { actualMaxHPAtScaling: 20000, includedAdditiveBaseDamage: 0 } };
    return doc;
  };
  const numeric = (doc: CalculatorDocument, a4 = 300, stars = 4) => {
    const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(1 + stars);
    expect(result.hits[0]!.nonCritical).toBeCloseTo(2000 * .128 * .5 * .9, 8);
    for (let i = 1; i <= stars; i++) expect(result.hits[i]!.nonCritical).toBeCloseTo((2000 * .1472 + a4) * .5 * .9, 8);
    expect(result.totals?.expected).toBeCloseTo((2000 * .128 + stars * (2000 * .1472 + a4)) * .5 * .9 * 1.5, 8);
  };
  const blocked = (doc: CalculatorDocument) => { const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0); };
  it("pins three default blockers and independent intrinsic-star chronology/numerical oracles", () => {
    const initial = calculateDocument(getCharacterDocuments("character:10000074", 10).find(row => row.gameContext?.skillId === "observed-layla-skill-c0")!);
    expect(initial.status).toBe("blocked"); expect(initial.totals).toBeUndefined(); expect(initial.blockers).toHaveLength(3);
    expect([...new Set(initial.blockers.map(reason => reason.split(":")[0]))]).toEqual(["observed-entity"]); numeric(fixture());
    expect(prepareSourceCastDocument(fixture()).hits.map(hit => hit.kind === "ordinary" ? [hit.observedEntityEvent?.frame, hit.observedEntityEvent?.snapshotFrame] : null))
      .toEqual([[32,0],[450,415],[475,442],[499,469],[524,496]]);
  });
  it.each(["casterId", "targetId", "freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits", "observedThroughFrame", "targetContacts", "layla", "sharedState"] as const)("missing %s does not certify an observed volley", field => {
    const doc = fixture(); delete doc.gameContext!.observedEntityCast![field]; blocked(doc);
  });
  it.each(["freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits"] as const)("false %s remains unconfirmed", field => {
    const doc = fixture(); doc.gameContext!.observedEntityCast![field] = false; blocked(doc);
  });
  it.each(["shieldEndFrame", "shieldLifetimeConfirmed", "allStarEventsRecorded", "skillEvents", "burstHitEvents", "targetChecks"] as const)("missing shield/search history %s stays unknown", field => {
    const doc = fixture(); delete doc.gameContext!.observedEntityCast!.layla![field]; blocked(doc);
  });
  it.each(["volley-1-check-1", "volley-1-check-2", "volley-1-check-3", "volley-1-check-4", "volley-1-check-5"])("missing actual search %s cannot be inferred from later contacts", key => {
    const doc = fixture(); delete doc.gameContext!.observedEntityCast!.layla!.targetChecks![key]; blocked(doc);
  });
  it("a later null search retains the previous target, not an invented miss", () => {
    const doc = fixture(); doc.gameContext!.observedEntityCast!.layla!.targetChecks!["volley-1-check-3"]!.targetId = null; numeric(doc);
  });
  it("known final miss still needs739-frame shield observation; unknown contact is distinct", () => {
    const doc = fixture(); doc.gameContext!.observedEntityCast!.targetContacts!["volley-1-star-4"] = false; numeric(doc, 300, 3);
    doc.gameContext!.observedEntityCast!.observedThroughFrame = 738; blocked(doc);
    const unknown = fixture(); delete unknown.gameContext!.observedEntityCast!.targetContacts!["volley-1-star-4"]; blocked(unknown);
  });
  it.each(["actualMaxHPAtScaling", "includedAdditiveBaseDamage"] as const)("missing star %s cannot borrow currentHP or assume accounting", field => {
    const doc = fixture(); delete doc.gameContext!.observedEntityCast!.sharedState![field]; blocked(doc);
  });
  it("actual zero launchHP and ASC3 remove only A4; unknownASC still fails closed", () => {
    const zero = fixture(); zero.gameContext!.observedEntityCast!.sharedState!.actualMaxHPAtScaling = 0; numeric(zero, 0);
    const asc3 = fixture(); asc3.gameContext!.ascension = 3; if (asc3.build?.mode === "manual-final") asc3.build.ascension = 3;
    delete asc3.gameContext!.observedEntityCast!.sharedState!.actualMaxHPAtScaling; numeric(asc3, 0);
    const unknown = fixture(); delete unknown.gameContext!.ascension; if (unknown.build?.mode === "manual-final") delete unknown.build.ascension; blocked(unknown);
  });
  it("included star A4 is subtracted once and never assigned to initial damage", () => {
    const doc = prepareSourceCastDocument(fixture());
    for (const hit of doc.hits) if (hit.kind === "ordinary" && hit.observedEntityEvent?.templateRole === "star") hit.additiveBaseDamage = 300;
    doc.gameContext!.observedEntityCast!.sharedState!.includedAdditiveBaseDamage = 300; numeric(doc);
  });
});

describe("Wanderer actual Windfavored contacts and five-hit Q use independent effective talents", () => {
  for (const [skillId, coefficient, extra] of wandererDefaultCases) {
    const q = skillId === "wanderer-kyougen-five-hits";
    const fixture = () => {
      const doc = getCharacterDocuments("character:10000075", q ? 13 : 10).find(row => row.gameContext?.skillId === skillId)!;
      doc.scope = q ? "one-cast" : "single-hit"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
      doc.gameContext!.constellation = 6; doc.gameContext!.ascension = 6;
      doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Actual separately sampled contact; effective NA10/E13 or Q13 already includes applicable talent levels once, not a rotation" };
      doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
      for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
      Object.assign(wandererPrimaryContext(doc)!, { skillTalentLevel: 13, absorptionBonuses: "neither", pyroAttackIncludedPercent: 0, cryoCritRateIncludedPercent: 0,
        c6ParentQualified: true, burstWindfavoredAtCast: true, burstC2ConsumedPointsUpTo50: 50, burstC2IncludedPercent: 0, burstAllHitsConnected: true, burstConditionsStable: true });
      return doc;
    };
    const numeric = (doc: CalculatorDocument, atk = 2000, crit = .5, c2 = 2, count = q ? 5 : 1) => {
      const result = calculateDocument(doc), nonCritical = atk * coefficient * (q ? 1 + c2 : 1.614225 * (extra ? .4 : 1)) * .5 * .9;
      expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(count);
      for (const hit of result.hits) expect(hit.nonCritical).toBeCloseTo(nonCritical, 8);
      expect(result.totals?.expected).toBeCloseTo(nonCritical * count * (1 + crit), 8);
    };
    const blocked = (doc: CalculatorDocument) => { const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0); };
    it(`${skillId}: exact default and independent public-calculator NA/E/Q arithmetic`, () => {
      const initial = calculateDocument(getCharacterDocuments("character:10000075", 10).find(row => row.gameContext?.skillId === skillId)!);
      expect(initial.status).toBe("blocked"); expect(initial.totals).toBeUndefined(); expect(initial.blockers).toHaveLength(q ? 5 : 1);
      expect([...new Set(initial.blockers.map(reason => reason.split(":")[0]))]).toEqual(["wanderer-primary"]); numeric(fixture());
    });
    it.each(["absorptionBonuses", "pyroAttackIncludedPercent", "cryoCritRateIncludedPercent"] as const)(`${skillId}: missing %s is not inferred from team elements`, field => {
      const doc = fixture(); delete wandererPrimaryContext(doc)![field]; blocked(doc);
    });
    it(`${skillId}: actual Pyro/Cryo and partial included shares use whiteATK and percentage-point units`, () => {
      const doc = fixture(); Object.assign(wandererPrimaryContext(doc)!, { absorptionBonuses: "pyro-cryo", baseAttack: 1000 }); numeric(doc, 2300, .7);
      if (doc.build?.mode === "manual-final") { doc.build.stats.atk = 2150; doc.build.stats.critRate = .6; }
      Object.assign(wandererPrimaryContext(doc)!, { pyroAttackIncludedPercent: 15, cryoCritRateIncludedPercent: 10 }); numeric(doc, 2300, .7);
      delete wandererPrimaryContext(doc)!.baseAttack; blocked(doc);
    });
    it(`${skillId}: unknownASC and a substituted ability cannot inherit this source identity`, () => {
      const unknown = fixture(); delete unknown.gameContext!.ascension; if (unknown.build?.mode === "manual-final") delete unknown.build.ascension; blocked(unknown);
      const wrong = fixture(); wrong.gameContext!.abilityId = q ? "talent:wanderer:combat1" : "talent:wanderer:combat3"; blocked(wrong);
    });
    if (!q) {
      it(`${skillId}: missing independent effective E cannot borrow NA10`, () => { const doc = fixture(); delete wandererPrimaryContext(doc)!.skillTalentLevel; blocked(doc); });
      if (extra) it(`${skillId}: C6 child needs an actual qualifying parent and its own sampled panel`, () => {
        const doc = fixture(); if (doc.build?.mode === "manual-final") doc.build.stats.atk = 2500; numeric(doc, 2500);
        delete wandererPrimaryContext(doc)!.c6ParentQualified; blocked(doc);
        wandererPrimaryContext(doc)!.c6ParentQualified = false; blocked(doc);
        wandererPrimaryContext(doc)!.c6ParentQualified = true; doc.gameContext!.constellation = 5; blocked(doc);
      });
    } else {
      it.each(["burstWindfavoredAtCast", "burstC2ConsumedPointsUpTo50", "burstC2IncludedPercent", "burstAllHitsConnected", "burstConditionsStable"] as const)(`Q: missing %s cannot certify C6 five-hit Q`, field => {
        const doc = fixture(); delete wandererPrimaryContext(doc)![field]; blocked(doc);
      });
      it.each(["burstAllHitsConnected", "burstConditionsStable"] as const)(`Q: false %s is not a five-hit confirmation`, field => {
        const doc = fixture(); wandererPrimaryContext(doc)![field] = false; blocked(doc);
      });
      it("Q uses actual spent0/25/50 and subtracts already included C2 once", () => {
        for (const [spent, bonus] of [[0,0],[25,1],[50,2]] as const) { const doc = fixture(); wandererPrimaryContext(doc)!.burstC2ConsumedPointsUpTo50 = spent; numeric(doc,2000,.5,bonus); }
        const included = fixture(); for (const hit of included.hits) if (hit.kind === "ordinary") hit.damageBonus = 2;
        wandererPrimaryContext(included)!.burstC2IncludedPercent = 200; numeric(included);
      });
      it("Q outside Windfavored has no C2 or absorbed self-buffs; one actual hit need not claim five", () => {
        const outside = fixture(); wandererPrimaryContext(outside)!.burstWindfavoredAtCast = false; numeric(outside,2000,.5,0);
        wandererPrimaryContext(outside)!.absorptionBonuses = "cryo"; blocked(outside);
        const single = fixture(); single.scope = "single-hit"; single.selectedHitIds = [single.hits[4]!.id];
        delete wandererPrimaryContext(single)!.burstAllHitsConnected; delete wandererPrimaryContext(single)!.burstConditionsStable;
        numeric(single,2000,.5,2,1);
      });
    }
  }
});

describe("Wanderer actual initial E is independent of future Windfavored records", () => {
  const fixture = (constellation = 0, talent = 10) => {
    const doc = getCharacterDocuments("character:10000075", talent).find(row => row.gameContext?.skillId === "idle-wanderer-skill-c0")!;
    doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[0]!.id]; doc.characterLevel = 90;
    doc.gameContext!.constellation = constellation; doc.gameContext!.ascension = 6;
    doc.gameContext!.idleStanceCast = { wanderer: { noAbsorption: true, panelExcludesAbsorptionBonuses: true } };
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Actual unabsorbed E initial only; no future stance, contact list or normal/C6 parent record" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
    return doc;
  };
  const calculate = (doc: CalculatorDocument) => calculateDocument(applyCharacterConstellationScope(doc));
  it("pins its one unknown default blocker", () => {
    const result = calculateDocument(getCharacterDocuments("character:10000075", 10).find(row => row.gameContext?.skillId === "idle-wanderer-skill-c0")!);
    expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers).toHaveLength(1);
    expect([...new Set(result.blockers.map(reason => reason.split(":")[0]))]).toEqual(["idle-stance"]);
  });
  it.each([0,1,2,3,4,5,6])("actual C%i initial uses effective E10 once without future-state evidence", constellation => {
    const doc = fixture(constellation), result = calculate(doc);
    expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(1);
    expect(result.totals?.expected).toBeCloseTo(2000 * 1.7136 * .5 * .9 * 1.5, 8);
    expect(doc.gameContext!.idleStanceCast!.followupActions).toBeUndefined(); expect(doc.gameContext!.idleStanceCast!.observedThroughFrame).toBeUndefined();
  });
  it("effective E13 at C6 is2.023, not a second C5 talent increase", () => {
    const result = calculate(fixture(6,13)); expect(result.blockers).toEqual([]);
    expect(result.totals?.expected).toBeCloseTo(2000 * 2.023 * .5 * .9 * 1.5, 8);
  });
  it.each(["noAbsorption", "panelExcludesAbsorptionBonuses"] as const)("missing or false %s cannot borrow the unabsorbed snapshot", field => {
    const doc = fixture(6); delete doc.gameContext!.idleStanceCast!.wanderer![field];
    for (const state of [undefined,false] as const) {
      if (state === false) doc.gameContext!.idleStanceCast!.wanderer![field] = false;
      const result = calculate(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined();
      expect(result.blockers.some(reason => reason.includes("没有元素吸收"))).toBe(true);
    }
  });
  it("does not expand the complete idle stance beyond C0", () => {
    const doc = fixture(6); doc.scope = "one-cast";
    const result = calculate(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined();
    expect(result.blockers.some(reason => reason.includes("仅支持明确C0"))).toBe(true);
  });
});

describe("Faruzan finite E and actual fresh Q initial retain separate contracts", () => {
  const fixture = (q: boolean) => {
    const skillId = q ? "finite-followup-faruzan-burst-fresh-c0" : "finite-followup-faruzan-skill-hurricane-c0";
    const doc = getCharacterDocuments("character:10000076", q ? 13 : 1).find(row => row.gameContext?.skillId === skillId)!;
    doc.scope = q ? "single-hit" : "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
    doc.gameContext!.constellation = q ? 6 : 0; doc.gameContext!.ascension = 6;
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Explicit actual Faruzan source branch; separate effective E1/NA6 or Q13, whiteATK1000 not finalATK2000" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.additiveBaseDamage = 0; hit.reaction = "none"; }
    if (q) doc.gameContext!.faruzanBurstInitial = { freshBurstNoPriorEffects: true, insideBurstArea: true, noOtherAnemoBeforeInitial: true,
      baseAttack: 1000, includedBurstDamageBonus: 0, includedA4BaseDamage: 0, includedResistanceReduction: 0, c6CritDamageIncludedInPanel: false };
    else doc.gameContext!.finiteFollowupCast = { completeCastConfirmed: true, statsStableAcrossHits: true, noHitlag: true, noReplacement: true, noInterruption: true,
      faruzanFreshNoPriorEffects: true, faruzanHurricaneStartFrame: 40, normalTalentLevel: 6,
      hitStates: Object.fromEntries(doc.hits.map(hit => [hit.id, { includedDamageBonus: 0, includedAdditiveBase: 0, includedResistanceReduction: 0 }])) };
    return doc;
  };
  const calculate = (doc: CalculatorDocument) => calculateDocument(applyCharacterConstellationScope(doc));
  const blocked = (doc: CalculatorDocument) => { const result = calculate(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers.length).toBeGreaterThan(0); };
  const qNumeric = (doc: CalculatorDocument, a4 = 320, critDamage = 1.4) => {
    const result = calculate(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(1);
    expect(result.totals?.expected).toBeCloseTo((2000 * 8.024 + a4) * 1.3825 * .5 * .9 * (1 + .5 * critDamage), 8);
  };
  const eNumeric = (doc: CalculatorDocument) => {
    const result = calculate(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(3);
    [1.488,1.736,1.08].forEach((c,i) => expect(result.hits[i]!.nonCritical).toBeCloseTo(2000 * c * .5 * .9, 8));
    expect(result.totals?.expected).toBeCloseTo(2000 * (1.488+1.736+1.08) * .5 * .9 * 1.5, 8);
  };
  it.each([[false,6,"finite-followup"],[true,1,"faruzan-burst-initial"]] as const)("pins exact default branch q=%s", (q,count,prefix) => {
    const id = q ? "finite-followup-faruzan-burst-fresh-c0" : "finite-followup-faruzan-skill-hurricane-c0";
    const result = calculateDocument(getCharacterDocuments("character:10000076",10).find(row=>row.gameContext?.skillId===id)!);
    expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); expect(result.blockers).toHaveLength(count);
    expect([...new Set(result.blockers.map(reason=>reason.split(":")[0]))]).toEqual([prefix]);
  });
  it("actual C6 Q13 initial uses whiteATK A4 and C6 crit damage, with no pre-hit own resistance reduction",()=>{qNumeric(fixture(true));});
  it.each(["freshBurstNoPriorEffects","insideBurstArea","noOtherAnemoBeforeInitial","baseAttack","includedBurstDamageBonus","includedA4BaseDamage","includedResistanceReduction","c6CritDamageIncludedInPanel"] as const)("Q missing %s remains unknown",field=>{const doc=fixture(true);delete doc.gameContext!.faruzanBurstInitial![field];blocked(doc);});
  it.each(["freshBurstNoPriorEffects","insideBurstArea","noOtherAnemoBeforeInitial"] as const)("Q false %s cannot certify fresh initial",field=>{const doc=fixture(true);doc.gameContext!.faruzanBurstInitial![field]=false;blocked(doc);});
  it("Q included bonus/base/crit/shred shares restore the independent oracle without double counting",()=>{
    const doc=fixture(true);const h=doc.hits[0]!;if(h.kind!=="ordinary")throw Error("ordinary");h.damageBonus=.3825;h.additiveBaseDamage=320;
    if(doc.build?.mode==="manual-final")doc.build.stats.critDamage=1.4;doc.enemy.resistance=-.2;
    Object.assign(doc.gameContext!.faruzanBurstInitial!,{includedBurstDamageBonus:.3825,includedA4BaseDamage:320,includedResistanceReduction:.3,c6CritDamageIncludedInPanel:true});qNumeric(doc);
  });
  it("Q ASC3 removes A4 only and C0 has no C6 crit bonus; unknownASC is not a zero",()=>{
    const doc=fixture(true);doc.gameContext!.constellation=0;doc.gameContext!.ascension=3;if(doc.build?.mode==="manual-final")doc.build.ascension=3;
    delete doc.gameContext!.faruzanBurstInitial!.baseAttack;delete doc.gameContext!.faruzanBurstInitial!.noOtherAnemoBeforeInitial;qNumeric(doc,0,1);
    delete doc.gameContext!.ascension;if(doc.build?.mode==="manual-final")delete doc.build.ascension;blocked(doc);
  });
  it("E1 and separately levelled NA6 arrow/collapse use no fresh-Q bonus, A4 or pre-hit shred",()=>{
    const doc=fixture(false);eNumeric(doc);expect(prepareSourceCastDocument(doc).hits.map(hit=>hit.label.match(/ · (\d+)帧/)?.[1])).toEqual(["14","99","132"]);
  });
  it.each(["completeCastConfirmed","statsStableAcrossHits","noHitlag","noReplacement","noInterruption","faruzanFreshNoPriorEffects","faruzanHurricaneStartFrame","normalTalentLevel"] as const)("E missing %s remains unknown",field=>{const doc=fixture(false);delete doc.gameContext!.finiteFollowupCast![field];blocked(doc);});
  it.each(["completeCastConfirmed","statsStableAcrossHits","noHitlag","noReplacement","noInterruption","faruzanFreshNoPriorEffects"] as const)("E false %s cannot certify followups",field=>{const doc=fixture(false);doc.gameContext!.finiteFollowupCast![field]=false;blocked(doc);});
  it.each(["includedDamageBonus","includedAdditiveBase","includedResistanceReduction"] as const)("E each contact requires %s accounting",field=>{
    for(const hit of fixture(false).hits){const doc=fixture(false);delete doc.gameContext!.finiteFollowupCast!.hitStates![hit.id]![field];blocked(doc);}
  });
  it("E earliest35 start, ASC-dependent charge labels and final1092 start keep declared timing bounds",()=>{
    const tooEarly=fixture(false);tooEarly.gameContext!.finiteFollowupCast!.faruzanHurricaneStartFrame=34;blocked(tooEarly);
    const first=fixture(false);first.gameContext!.finiteFollowupCast!.faruzanHurricaneStartFrame=35;eNumeric(first);
    expect(prepareSourceCastDocument(first).hits.map(hit=>hit.label.match(/ · (\d+)帧/)?.[1])).toEqual(["14","94","127"]);
    first.gameContext!.ascension=0;if(first.build?.mode==="manual-final")first.build.ascension=0;eNumeric(first);
    expect(prepareSourceCastDocument(first).hits.map(hit=>hit.label.match(/ · (\d+)帧/)?.[1])).toEqual(["14","131","164"]);
    const last=fixture(false);last.gameContext!.finiteFollowupCast!.faruzanHurricaneStartFrame=1092;eNumeric(last);
    expect(prepareSourceCastDocument(last).hits.map(hit=>hit.label.match(/ · (\d+)帧/)?.[1])).toEqual(["14","1151","1184"]);
    const c1=fixture(false);c1.gameContext!.constellation=1;blocked(c1);
  });
});

describe("Alhaitham actual projection separates trigger EM from impact A4", () => {
  const cases = [["alhaitham-projection-1-mirror",1,2],["alhaitham-projection-2-mirrors",2,4],["alhaitham-projection-3-mirrors",3,6]] as const;
  const fixture = (skillId: string) => {
    const doc = getCharacterDocuments("character:10000078",10).find(row=>row.gameContext?.skillId===skillId)!;
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;
    doc.gameContext!.constellation=0;doc.gameContext!.ascension=6;
    doc.build={mode:"manual-final",ascension:6,stats:{atk:2000,hp:20000,def:800,em:900,critRate:.5,critDamage:1},source:"Actual single projection: triggerEM300 and separately sampled impactEM; panelEM900 is not a substitute"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.additiveBaseDamage=0;hit.reaction="none";}
    doc.gameContext!.alhaithamDamage={mirrorCount:cases.find(row=>row[0]===skillId)![1],projectionTriggerValid:true,masteryStableAcrossStages:false,triggerMastery:300,statsAndTargetStableAcrossHits:true,
      hitStates:Object.fromEntries(doc.hits.map((hit,i)=>[hit.id,{connected:true,hitTimeMastery:[0,300,1000][i]!,includedProjectionBase:0,includedA4Bonus:0}]))};
    return doc;
  };
  const blocked=(doc:CalculatorDocument)=>{const result=calculateDocument(doc);expect(result.status).toBe("blocked");expect(result.totals).toBeUndefined();expect(result.blockers.length).toBeGreaterThan(0);};
  const numeric=(doc:CalculatorDocument,impactEM:readonly number[],triggerEM=300)=>{
    const result=calculateDocument(doc);expect(result.status).toBe("calculated");expect(result.blockers).toEqual([]);expect(result.hits).toHaveLength(impactEM.length);
    // Pinned E10 vectors: 1.2096 ATK + 2.4192 actual trigger EM per contact.
    const amounts=impactEM.map(em=>(2000*1.2096+2.4192*triggerEM)*(1+Math.min(.001*em,1))*.5*.9);
    amounts.forEach((amount,i)=>expect(result.hits[i]!.nonCritical).toBeCloseTo(amount,8));
    expect(result.totals?.expected).toBeCloseTo(amounts.reduce((a,b)=>a+b,0)*1.5,8);
  };
  it.each(cases)("%s has exact unknown default, not assumed trigger/contact",(id,count,blockers)=>{
    const result=calculateDocument(getCharacterDocuments("character:10000078",10).find(row=>row.gameContext?.skillId===id)!);
    expect(result.status).toBe("blocked");expect(result.totals).toBeUndefined();expect(result.blockers).toHaveLength(blockers);
    expect([...new Set(result.blockers.map(reason=>reason.split(":")[0]))]).toEqual(["alhaitham-damage"]);
    numeric(fixture(id),[0,300,1000].slice(0,count));
  });
  it.each(cases)("%s requires each necessary global context",id=>{
    for(const field of ["projectionTriggerValid","masteryStableAcrossStages","triggerMastery","mirrorCount"] as const){const doc=fixture(id);delete doc.gameContext!.alhaithamDamage![field];blocked(doc);}
    const invalid=fixture(id);invalid.gameContext!.alhaithamDamage!.projectionTriggerValid=false;blocked(invalid);
    const unknown=fixture(id);delete unknown.gameContext!.ascension;if(unknown.build.mode==="manual-final")delete unknown.build.ascension;blocked(unknown);
  });
  it.each(cases)("%s retains per-contact samples and accounting",id=>{
    for(const hit of fixture(id).hits)for(const field of ["connected","hitTimeMastery","includedProjectionBase","includedA4Bonus"] as const){const doc=fixture(id);delete doc.gameContext!.alhaithamDamage!.hitStates![hit.id]![field];blocked(doc);}
    const miss=fixture(id);miss.gameContext!.alhaithamDamage!.hitStates![miss.hits[0]!.id]!.connected=false;blocked(miss);
  });
  it("zero trigger, cap boundary and included shares use independent samples, not current EM900",()=>{
    for(const em of [0,999.999,1000,1001]){const doc=fixture(cases[0][0]);doc.gameContext!.alhaithamDamage!.triggerMastery=0;doc.gameContext!.alhaithamDamage!.hitStates![doc.hits[0]!.id]!.hitTimeMastery=em;numeric(doc,[em],0);}
    const doc=fixture(cases[1][0]);const hit=doc.hits[1]!;if(hit.kind!=="ordinary")throw Error("ordinary");hit.additiveBaseDamage=725.76;hit.damageBonus=.3;
    Object.assign(doc.gameContext!.alhaithamDamage!.hitStates![hit.id]!,{includedProjectionBase:725.76,includedA4Bonus:.3});numeric(doc,[0,300]);
  });
  it("multihit shared-state confirmation is not required for an independently selected contact",()=>{
    const doc=fixture(cases[2][0]);delete doc.gameContext!.alhaithamDamage!.statsAndTargetStableAcrossHits;blocked(doc);
    doc.gameContext!.alhaithamDamage!.statsAndTargetStableAcrossHits=false;blocked(doc);
    doc.scope="single-hit";doc.selectedHitIds=[doc.hits[0]!.id];numeric(doc,[0]);
  });
  it("ASC3 removes only impact A4 sampling; actual trigger EM remains necessary",()=>{
    const doc=fixture(cases[0][0]);doc.gameContext!.ascension=3;if(doc.build.mode==="manual-final")doc.build.ascension=3;
    const state=doc.gameContext!.alhaithamDamage!.hitStates![doc.hits[0]!.id]!;delete state.hitTimeMastery;delete state.includedA4Bonus;numeric(doc,[0]);
    delete doc.gameContext!.alhaithamDamage!.triggerMastery;blocked(doc);
  });
});

describe("Yaoyao observed Q preserves the post-Q independently levelled E radish",()=>{
  const fixture=()=>{
    const doc=getCharacterDocuments("character:10000077",1).find(row=>row.gameContext?.skillId==="observed-yaoyao-burst-c0")!;
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.ascension=6;doc.gameContext!.constellation=0;
    doc.build={mode:"manual-final",ascension:6,stats:{atk:2000,hp:90000,def:800,em:999,critRate:.5,critDamage:1},source:"Synthetic explicitly supplied observation, not claimed game capture; independent Q1 and E9"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.reaction="none";}
    // Existing literal synthetic input was authored without running the compiler.
    doc.gameContext!.observedEntityCast=observedEntityCastContextSchema.parse(structuredClone(observedSourceCases.contexts["observed-yaoyao-burst-c0"]));
    return doc;
  };
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers.length).toBeGreaterThan(0);};
  const numeric=(doc:CalculatorDocument,tail=true)=>{
    const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(tail?11:10);
    // Independently pinned Q1 initial/radish and E9 radish, all ATK-scaling.
    const coefficients=[1.1456,...Array<number>(9).fill(.7216),...(tail?[.50864]:[])];
    coefficients.forEach((c,i)=>expect(r.hits[i]!.nonCritical).toBeCloseTo(2000*c*.5*.9,8));
    expect(r.totals?.expected).toBeCloseTo(2000*(1.1456+9*.7216+(tail ? .50864 : 0))*.5*.9*1.5,8);
  };
  it("pins exact four missing-default blockers",()=>{
    const r=calculateDocument(getCharacterDocuments("character:10000077",10).find(row=>row.gameContext?.skillId==="observed-yaoyao-burst-c0")!);
    expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(4);
    expect([...new Set(r.blockers.map(reason=>reason.split(":")[0]))]).toEqual(["observed-entity"]);
  });
  it("keeps pet-spawn snapshots and A1 natural-end sample372/impact373 after Q360",()=>{
    const doc=fixture();numeric(doc);
    expect(prepareSourceCastDocument(doc).hits.map(hit=>hit.kind==="ordinary"?[hit.observedEntityEvent?.frame,hit.observedEntityEvent?.snapshotFrame,hit.attackTag]:null))
      .toEqual([[16,16,"burst"],[146,104,"burst"],[204,162,"burst"],[206,104,"burst"],[263,221,"burst"],[264,162,"burst"],[266,104,"burst"],[323,221,"burst"],[324,162,"burst"],[326,104,"burst"],[373,372,"skill"]]);
  });
  it.each(["casterId","targetId","freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","observedThroughFrame","statsStableAcrossHits","skillTalentLevel"] as const)("missing %s is not a complete Q observation",field=>{const doc=fixture();delete doc.gameContext!.observedEntityCast![field];blocked(doc);});
  it.each(["freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","statsStableAcrossHits"] as const)("false %s does not certify full cast",field=>{const doc=fixture();doc.gameContext!.observedEntityCast![field]=false;blocked(doc);});
  it.each(["noPreexistingYuegui","onFieldUntilEndConfirmed","movementStates","throws"] as const)("missing Yaoyao %s stays unknown",field=>{const doc=fixture();delete doc.gameContext!.observedEntityCast!.yaoyao![field];blocked(doc);});
  it.each(["noPreexistingYuegui","onFieldUntilEndConfirmed"] as const)("false Yaoyao %s cannot certify fresh natural-end cast",field=>{const doc=fixture();doc.gameContext!.observedEntityCast!.yaoyao![field]=false;blocked(doc);});
  it("each recorded contact and each throw's required target facts are necessary",()=>{
    for(const key of Object.keys(observedSourceCases.contexts["observed-yaoyao-burst-c0"].targetContacts)){const doc=fixture();delete doc.gameContext!.observedEntityCast!.targetContacts![key];blocked(doc);}
    for(const [key,row] of Object.entries(observedSourceCases.contexts["observed-yaoyao-burst-c0"].yaoyao.throws)){
      for(const field of ["inRangeTargetIds","selectedTargetId","completeRosterConfirmed"] as const){const doc=fixture();delete doc.gameContext!.observedEntityCast!.yaoyao!.throws![key]![field];blocked(doc);}
      if("activeHpRatio" in row)for(const field of ["activeHpRatio","activeActorId"] as const){const doc=fixture();delete doc.gameContext!.observedEntityCast!.yaoyao!.throws![key]![field];blocked(doc);}
    }
  });
  it("known tail miss still needs the373 opportunity; complete empty enemy roster cancels the A1 throw",()=>{
    const doc=fixture();doc.gameContext!.observedEntityCast!.targetContacts!["a1-360"]=false;numeric(doc,false);
    doc.gameContext!.observedEntityCast!.observedThroughFrame=372;blocked(doc);
    const empty=fixture();Object.assign(empty.gameContext!.observedEntityCast!.yaoyao!.throws!["a1-360"]!,{inRangeTargetIds:[],selectedTargetId:null});
    delete empty.gameContext!.observedEntityCast!.targetContacts!["a1-360"];empty.gameContext!.observedEntityCast!.observedThroughFrame=360;numeric(empty,false);
    delete empty.gameContext!.observedEntityCast!.yaoyao!.throws!["a1-360"]!.completeRosterConfirmed;blocked(empty);
  });
  it("movement coverage, impossible early dash and stale target facts cannot be inferred",()=>{
    const gap=fixture();gap.gameContext!.observedEntityCast!.yaoyao!.movementStates![0]!.endFrame=323;blocked(gap);
    const early=fixture();early.gameContext!.observedEntityCast!.yaoyao!.movementStates![0]!.state="dash";blocked(early);
    const wrong=fixture();wrong.gameContext!.observedEntityCast!.yaoyao!.throws!["pet-1-throw-1"]!.selectedTargetId="absent";blocked(wrong);
    const missingAsc=fixture();delete missingAsc.gameContext!.ascension;if(missingAsc.build.mode==="manual-final")delete missingAsc.build.ascension;blocked(missingAsc);
    const c1=fixture();c1.gameContext!.constellation=1;blocked(c1);
  });
});

describe("Dehya observed fresh and repositioned fields preserve different snapshots",()=>{
  const ids=["coordinated-dehya-skill-fresh-c0","coordinated-dehya-skill-reposition-c0"] as const;
  const fixture=(reposition:boolean)=>{
    const doc=getCharacterDocuments("character:10000079",1).find(row=>row.gameContext?.skillId===ids[reposition?1:0])!;
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.ascension=6;doc.gameContext!.constellation=0;
    doc.build={mode:"manual-final",ascension:6,stats:{atk:2000,hp:20000,def:800,em:0,critRate:.5,critDamage:1},source:"Actual observed C0 field with independently recorded prior offensive snapshot for reposition"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.additiveBaseDamage=0;hit.reaction="none";}
    doc.gameContext!.coordinatedCast={casterId:"owner",targetId:"enemy",freshCastConfirmed:true,fullObservedLifetime:true,
      observedThroughFrame:reposition?566:742,noHitlag:true,noReplacement:true,noInterruption:true,allGeneratedHitsConfirmed:true,statsStableAcrossHits:true,
      damageEvents:[100,130,160,251].map(frame=>({id:`observed-${frame}`,frame,actorId:"driver",targetId:"enemy",origin:"external",damagePositive:true,inRange:true})),
      ...(reposition?{dehyaPrior:{snapshotId:"old-field",snapshotFrame:-100,remainingLifetimeFrames:500,remainingCooldownFrames:0},
        dehyaPriorSnapshot:{stats:{atk:1700,hp:23000,def:700,em:0,critRate:.6,critDamage:1.1},characterLevel:90,ascension:6,damageBonus:.3,additiveBaseDamage:0,reactionBonus:0,source:"Explicit prior field snapshot, not current panel",sourceRefs:["https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/dehya/skill.go"]}}:{})};
    return doc;
  };
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers.length).toBeGreaterThan(0);};
  const numeric=(doc:CalculatorDocument,reposition:boolean,procs=2)=>{
    const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(1+procs);
    const initial=reposition?1700*1.328*1.3*.5*.9:2000*1.1288*.5*.9;
    const proc=(2000*.602+20000*.01032)*.5*.9;
    expect(r.hits[0]!.nonCritical).toBeCloseTo(initial,8);
    for(let i=1;i<=procs;i++)expect(r.hits[i]!.nonCritical).toBeCloseTo(proc,8);
    expect(r.totals?.expected).toBeCloseTo(initial*(reposition?1+.6*1.1:1.5)+procs*proc*1.5,8);
  };
  it.each([false,true])("reposition=%s retains exact default and independent per-hit arithmetic",reposition=>{
    const r=calculateDocument(getCharacterDocuments("character:10000079",10).find(row=>row.gameContext?.skillId===ids[reposition?1:0])!);
    expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(reposition?3:2);
    expect([...new Set(r.blockers.map(reason=>reason.split(":")[0]))]).toEqual(["coordinated-context"]);
    const doc=fixture(reposition);numeric(doc,reposition);
    expect(prepareCoordinatedCastDocument(doc).hits.map(hit=>hit.kind==="ordinary"?[hit.coordinatedEvent?.frame,hit.coordinatedEvent?.snapshotFrame]:null))
      .toEqual(reposition?[[40,-100],[102,41],[253,41]]:[[20,0],[102,21],[253,21]]);
  });
  it.each([false,true])("reposition=%s requires common observations and external eligibility",reposition=>{
    for(const field of ["casterId","targetId","fullObservedLifetime","observedThroughFrame","noHitlag","noReplacement","noInterruption","allGeneratedHitsConfirmed","statsStableAcrossHits","damageEvents"] as const){const doc=fixture(reposition);delete doc.gameContext!.coordinatedCast![field];blocked(doc);}
    for(const field of ["fullObservedLifetime","noHitlag","noReplacement","noInterruption","allGeneratedHitsConfirmed","statsStableAcrossHits"] as const){const doc=fixture(reposition);doc.gameContext!.coordinatedCast![field]=false;blocked(doc);}
    for(const field of ["actorId","targetId","origin","damagePositive","inRange"] as const){const doc=fixture(reposition);delete doc.gameContext!.coordinatedCast!.damageEvents![0]![field];blocked(doc);}
    const c1=fixture(reposition);c1.gameContext!.constellation=1;blocked(c1);
  });
  it("fresh initial cannot certify a previous field and reposition cannot borrow the current panel",()=>{
    const fresh=fixture(false);delete fresh.gameContext!.coordinatedCast!.freshCastConfirmed;blocked(fresh);
    fresh.gameContext!.coordinatedCast!.freshCastConfirmed=false;blocked(fresh);
    for(const field of ["snapshotId","snapshotFrame","remainingLifetimeFrames","remainingCooldownFrames"] as const){const doc=fixture(true);delete doc.gameContext!.coordinatedCast!.dehyaPrior![field];blocked(doc);}
    const old=fixture(true);delete old.gameContext!.coordinatedCast!.dehyaPriorSnapshot;blocked(old);
    const prepared=prepareCoordinatedCastDocument(fixture(true));delete prepared.gameContext!.coordinatedCast!.dehyaPriorSnapshot;blocked(prepared);
  });
  it.each([false,true])("reposition=%s rejects cooldown150, accepts151 and observes inclusive expiry+1",reposition=>{
    const doc=fixture(reposition);doc.gameContext!.coordinatedCast!.damageEvents=[100,250,251].map(frame=>({id:`boundary-${frame}`,frame,actorId:"driver",targetId:"enemy",origin:"external",damagePositive:true,inRange:true}));numeric(doc,reposition);
    expect(prepareCoordinatedCastDocument(doc).hits.map(hit=>hit.kind==="ordinary"?hit.coordinatedEvent?.frame:null)).toEqual([reposition?40:20,102,253]);
    doc.gameContext!.coordinatedCast!.observedThroughFrame=reposition?565:741;blocked(doc);
  });
  it("known ineligible damage is not unknown, and preserved reposition cooldown is not reset",()=>{
    for(const field of ["damagePositive","inRange"] as const){const doc=fixture(false);for(const event of doc.gameContext!.coordinatedCast!.damageEvents!)event[field]=false;numeric(doc,false,0);}
    const doc=fixture(true);doc.gameContext!.coordinatedCast!.dehyaPrior!.remainingCooldownFrames=60;
    doc.gameContext!.coordinatedCast!.damageEvents=[100,101].map(frame=>({id:`prior-${frame}`,frame,actorId:"driver",targetId:"enemy",origin:"external",damagePositive:true,inRange:true}));numeric(doc,true,1);
    expect(prepareCoordinatedCastDocument(doc).hits.map(hit=>hit.kind==="ordinary"?hit.coordinatedEvent?.frame:null)).toEqual([40,103]);
  });
});

describe("Baizhu declared actual three-hit chain keeps initial active HP and A1 accounting",()=>{
  const fixture=()=>{
    const doc=getCharacterDocuments("character:10000082",1).find(row=>row.gameContext?.skillId==="baizhu-skill-complete-cast-c0")!;
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.ascension=6;doc.gameContext!.constellation=0;
    doc.build={mode:"manual-final",ascension:6,stats:{atk:2000,hp:90000,def:800,em:999,critRate:.5,critDamage:1},source:"Explicit three occurred same-target unbroken E contacts; initial active-character HP ratio is separate from panel maxHP"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.reaction="none";}
    doc.gameContext!.baizhuSkill={activeHpRatioAtCast:.5,a1IncludedInPanel:false};return doc;
  };
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers.length).toBeGreaterThan(0);};
  const numeric=(doc:CalculatorDocument,bonus:number)=>{
    const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(3);
    for(const hit of r.hits)expect(hit.nonCritical).toBeCloseTo(2000*.792*(1+bonus)*.5*.9,8);
    expect(r.totals?.expected).toBeCloseTo(3*2000*.792*(1+bonus)*.5*.9*1.5,8);
  };
  it("pins three unknown cast-HP default blockers",()=>{
    const r=calculateDocument(getCharacterDocuments("character:10000082",10).find(row=>row.gameContext?.skillId==="baizhu-skill-complete-cast-c0")!);
    expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(3);
    expect([...new Set(r.blockers.map(reason=>reason.split(":")[0]))]).toEqual(["baizhu-skill-context"]);
  });
  it.each([[0,0],[.49999,0],[.5,.25],[1,.25]])("actual cast HP%s gives A1%s equally to all three contacts",(hp,bonus)=>{const doc=fixture();doc.gameContext!.baizhuSkill!.activeHpRatioAtCast=hp;numeric(doc,bonus);});
  it("included .25 share is not added twice, and inactive included share is contradictory",()=>{
    const doc=fixture();doc.gameContext!.baizhuSkill!.a1IncludedInPanel=true;for(const hit of doc.hits)if(hit.kind==="ordinary")hit.damageBonus=.25;numeric(doc,.25);
    doc.gameContext!.baizhuSkill!.activeHpRatioAtCast=.49999;blocked(doc);
  });
  it("missing HP before or after preparation cannot become panelHP90000 or full health",()=>{
    const doc=fixture();delete doc.gameContext!.baizhuSkill!.activeHpRatioAtCast;blocked(doc);
    const prepared=applyCharacterConstellationScope(fixture());expect(prepared.hits.every(hit=>hit.kind==="ordinary"&&hit.damageBonusFormula?.ruleId==="baizhu-a1-cast-hp-accounting-b4ae769")).toBe(true);delete prepared.gameContext!.baizhuSkill!.activeHpRatioAtCast;blocked(prepared);
    const absent=fixture();delete absent.gameContext!.baizhuSkill;blocked(absent);
  });
  it("ASC0 needs no A1 HP sample; unknownASC and C1 cannot borrow C0's three-hit contract",()=>{
    const doc=fixture();doc.gameContext!.ascension=0;if(doc.build.mode==="manual-final")doc.build.ascension=0;delete doc.gameContext!.baizhuSkill!.activeHpRatioAtCast;numeric(doc,0);
    doc.gameContext!.baizhuSkill!.a1IncludedInPanel=true;blocked(doc);
    const unknown=fixture();delete unknown.gameContext!.ascension;if(unknown.build.mode==="manual-final")delete unknown.build.ascension;blocked(unknown);
    const c1=fixture();c1.gameContext!.constellation=1;blocked(c1);
  });
  it("supplied accounting boolean is schema-required rather than a semantic blocked default",()=>{
    const doc=fixture();Reflect.deleteProperty(doc.gameContext!.baizhuSkill!,"a1IncludedInPanel");
    expect(()=>calculateDocument(doc)).toThrow();
    const parsed=calculatorDocumentSchema.safeParse(doc);expect(parsed.success).toBe(false);
    if(!parsed.success)expect(parsed.error.issues.some(issue=>issue.code==="invalid_type"&&issue.path.join(".")==="gameContext.baizhuSkill.a1IncludedInPanel")).toBe(true);
  });
});

describe("Neuvillette actual E samples distinguish HP body from ATK Arkhe and per-hit A4",()=>{
  const ids=["neuvillette-skill","neuvillette-skill-complete-cast-c0-arkhe-ready"] as const;
  const fixture=(complete:boolean)=>{
    const doc=getCharacterDocuments("character:10000087",1).find(row=>row.gameContext?.skillId===ids[complete?1:0])!;
    doc.scope=complete?"one-cast":"single-hit";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.ascension=6;doc.gameContext!.constellation=0;
    doc.build={mode:"manual-final",ascension:6,stats:{atk:2000,hp:30000,def:800,em:0,critRate:.5,critDamage:1},source:"Declared actual E contact(s); separate per-hit HP ratios, no inferred full health or new snapshot timing model"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.reaction="none";}
    doc.gameContext!.batchProjectileCast={statsStableAcrossHits:true,hitStates:Object.fromEntries(doc.hits.map((hit,i)=>[hit.id,{actualHpRatio:i===0?.5:.8,includedHydroBonus:0}]))};return doc;
  };
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers.length).toBeGreaterThan(0);};
  const numeric=(doc:CalculatorDocument,bonuses:readonly number[])=>{
    const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(bonuses.length);
    const amounts=bonuses.map((bonus,i)=>(i===0?30000*.12864:2000*.208)*(1+bonus)*.5*.9);
    amounts.forEach((v,i)=>expect(r.hits[i]!.nonCritical).toBeCloseTo(v,8));expect(r.totals?.expected).toBeCloseTo(amounts.reduce((a,b)=>a+b,0)*1.5,8);
  };
  it.each([false,true])("complete=%s pins exact unknown default and separate scaling",complete=>{
    const r=calculateDocument(getCharacterDocuments("character:10000087",10).find(row=>row.gameContext?.skillId===ids[complete?1:0])!);
    expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(complete?4:1);
    expect([...new Set(r.blockers.map(reason=>reason.split(":")[0]))]).toEqual(["batch-projectile-cast"]);numeric(fixture(complete),complete?[.12,.3]:[.12]);
  });
  it.each([[0,0],[.3,0],[.5,.12],[.8,.3],[1,.3]])("actual body HP%s gives independently clamped A4%s",(hp,bonus)=>{const doc=fixture(false);doc.gameContext!.batchProjectileCast!.hitStates![doc.hits[0]!.id]!.actualHpRatio=hp;numeric(doc,[bonus]);});
  it.each([false,true])("complete=%s requires actual sample and explicit already-included share for each selected hit",complete=>{
    for(const hit of fixture(complete).hits)for(const field of ["actualHpRatio","includedHydroBonus"] as const){const doc=fixture(complete);delete doc.gameContext!.batchProjectileCast!.hitStates![hit.id]![field];blocked(doc);}
    const unknown=fixture(complete);delete unknown.gameContext!.ascension;if(unknown.build.mode==="manual-final")delete unknown.build.ascension;blocked(unknown);
    const c1=fixture(complete);c1.gameContext!.constellation=1;blocked(c1);
  });
  it("entered bonus shares are subtracted per hit; ASC3 removes A4 but not its bookkeeping",()=>{
    const doc=fixture(true);doc.hits.forEach((hit,i)=>{if(hit.kind!=="ordinary")throw Error("ordinary");hit.damageBonus=[.12,.3][i]!;doc.gameContext!.batchProjectileCast!.hitStates![hit.id]!.includedHydroBonus=[.12,.3][i]!;});numeric(doc,[.12,.3]);
    doc.gameContext!.ascension=3;if(doc.build.mode==="manual-final")doc.build.ascension=3;for(const state of Object.values(doc.gameContext!.batchProjectileCast!.hitStates!))delete state.actualHpRatio;numeric(doc,[0,0]);
    delete doc.gameContext!.batchProjectileCast!.hitStates![doc.hits[0]!.id]!.includedHydroBonus;blocked(doc);
  });
  it("missing or false wholecast stability cannot be guessed, while an actual selected body needs only its own sample",()=>{
    const doc=fixture(true);delete doc.gameContext!.batchProjectileCast!.statsStableAcrossHits;blocked(doc);
    doc.gameContext!.batchProjectileCast!.statsStableAcrossHits=false;blocked(doc);
    doc.scope="single-hit";doc.selectedHitIds=[doc.hits[0]!.id];delete doc.gameContext!.batchProjectileCast!.hitStates![doc.hits[1]!.id];numeric(doc,[.12]);
  });
  it("shared HP cannot fill an unstably selected hit, and zero-gauge Arkhe cannot Vaporize",()=>{
    const doc=fixture(false);doc.gameContext!.batchProjectileCast={statsStableAcrossHits:false,sharedState:{actualHpRatio:1,includedHydroBonus:0},hitStates:{}};blocked(doc);
    const arkhe=fixture(true);const hit=arkhe.hits[1]!;if(hit.kind!=="ordinary")throw Error("ordinary");hit.reaction="vaporize";blocked(arkhe);
  });
});

describe("Charlotte declared actual marks require roster and uninterrupted resampling conditions",()=>{
  const cases=[["charlotte-skill-press-complete",.672,.392,4,10],["charlotte-skill-hold-complete",1.392,.406,8,18]] as const;
  const fixture=(id:string)=>{
    const doc=getCharacterDocuments("character:10000088",1).find(row=>row.gameContext?.skillId===id)!;
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.ascension=6;doc.gameContext!.constellation=0;
    doc.build={mode:"manual-final",ascension:6,stats:{atk:2000,hp:20000,def:800,em:0,critRate:.5,critDamage:1},source:"Explicit actual same-target marks with stable other offensive conditions; marks resample, not an initial snapshot copied through time"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.reaction="none";}
    doc.gameContext!.charlotteSkill={nonFontaineTeammates:2,a4IncludedInPanel:false,markUninterrupted:true,statsStableAcrossHits:true};return doc;
  };
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers.length).toBeGreaterThan(0);};
  const numeric=(doc:CalculatorDocument,coefficients:readonly number[],bonus=.1)=>{
    const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(coefficients.length);
    coefficients.forEach((c,i)=>expect(r.hits[i]!.nonCritical).toBeCloseTo(2000*c*(1+bonus)*.5*.9,8));
    expect(r.totals?.expected).toBeCloseTo(2000*coefficients.reduce((a,b)=>a+b,0)*(1+bonus)*.5*.9*1.5,8);
  };
  for(const [id,initial,tick,count,blockers] of cases){
    const coefficients=[initial,...Array<number>(count).fill(tick)];
    it(`${id} pins exact unknown default and independent E1 contact vector`,()=>{
      const r=calculateDocument(getCharacterDocuments("character:10000088",10).find(row=>row.gameContext?.skillId===id)!);
      expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(blockers);
      expect([...new Set(r.blockers.map(reason=>reason.split(":")[0]))]).toEqual(["charlotte-skill-context"]);numeric(fixture(id),coefficients);
    });
    it.each(["nonFontaineTeammates","markUninterrupted","statsStableAcrossHits"] as const)(`${id} missing %s remains unknown`,field=>{const doc=fixture(id);delete doc.gameContext!.charlotteSkill![field];blocked(doc);});
    it.each(["markUninterrupted","statsStableAcrossHits"] as const)(`${id} false %s cannot certify all marks`,field=>{const doc=fixture(id);doc.gameContext!.charlotteSkill![field]=false;blocked(doc);});
    it(`${id} actual roster0/3 and included A4 are separately accounted`,()=>{
      const zero=fixture(id);zero.gameContext!.charlotteSkill!.nonFontaineTeammates=0;numeric(zero,coefficients,0);
      const three=fixture(id);three.gameContext!.charlotteSkill!.nonFontaineTeammates=3;numeric(three,coefficients,.15);
      three.gameContext!.charlotteSkill!.a4IncludedInPanel=true;for(const hit of three.hits)if(hit.kind==="ordinary")hit.damageBonus=.15;numeric(three,coefficients,.15);
    });
    it(`${id} ASC3 omits roster but not valid accounting; actual initial requires no future mark`,()=>{
      const doc=fixture(id);doc.gameContext!.ascension=3;if(doc.build.mode==="manual-final")doc.build.ascension=3;delete doc.gameContext!.charlotteSkill!.nonFontaineTeammates;numeric(doc,coefficients,0);
      doc.gameContext!.charlotteSkill!.a4IncludedInPanel=true;blocked(doc);
      const selected=fixture(id);selected.scope="single-hit";selected.selectedHitIds=[selected.hits[0]!.id];delete selected.gameContext!.charlotteSkill!.markUninterrupted;delete selected.gameContext!.charlotteSkill!.statsStableAcrossHits;numeric(selected,[initial]);
      delete selected.gameContext!.charlotteSkill!.nonFontaineTeammates;blocked(selected);
    });
    it(`${id} C1 healing does not add damage, while missing C2 context and unsupported C6 remain blocked`,()=>{
      const c1=fixture(id);c1.gameContext!.constellation=1;numeric(c1,coefficients);
      const c2=fixture(id);c2.gameContext!.constellation=2;blocked(c2);
      const c6=fixture(id);c6.gameContext!.constellation=6;blocked(c6);
      const unknown=fixture(id);delete unknown.gameContext!.ascension;if(unknown.build.mode==="manual-final")delete unknown.build.ascension;blocked(unknown);
    });
    it(`${id} supplied accounting is schema-required and stale materialization cannot preserve missing roster`,()=>{
      const doc=fixture(id);Reflect.deleteProperty(doc.gameContext!.charlotteSkill!,"a4IncludedInPanel");expect(()=>calculateDocument(doc)).toThrow();
      const parsed=calculatorDocumentSchema.safeParse(doc);expect(parsed.success).toBe(false);if(!parsed.success)expect(parsed.error.issues.some(issue=>issue.code==="invalid_type"&&issue.path.join(".")==="gameContext.charlotteSkill.a4IncludedInPanel")).toBe(true);
      const prepared=applyCharacterConstellationScope(fixture(id));expect(prepared.hits.every(hit=>hit.kind==="ordinary"&&hit.damageBonusFormula?.ruleId==="charlotte-a4-region-accounting-b4ae769")).toBe(true);
      delete prepared.gameContext!.charlotteSkill!.nonFontaineTeammates;blocked(prepared);
    });
  }
});

describe("Furina synthetic observed Salon separates launch HP, party eligibility and A4 refresh HP",()=>{
  // Independent literal accepted launches: source's late chevalmarin1749 lands
  // after1754 and is canceled; the terminating check is not another attack.
  const rows=[
    {id:"initial",role:"initial",frame:18,launch:0,coefficient:.07864},
    ...[90,188,286,383,481,578,676,773,871,969,1066,1164,1261,1359,1457,1554,1652].map((launch,i)=>({id:`chevalmarin-${i+1}`,role:"chevalmarin",frame:launch+20,launch,coefficient:.03232})),
    ...[93,295,497,699,901,1103,1305,1507,1710].map((launch,i)=>({id:`usher-${i+1}`,role:"usher",frame:launch+40,launch,coefficient:.0596})),
    ...[90,403,717,1031,1345,1659].map((launch,i)=>({id:`crabaletta-${i+1}`,role:"crabaletta",frame:launch+41,launch,coefficient:.08288})),
  ].sort((a,b)=>a.frame-b.frame);
  const fixture=()=>{
    const doc=getCharacterDocuments("character:10000089",1).find(row=>row.gameContext?.skillId==="observed-furina-skill-ousia-c0")!;
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.ascension=6;doc.gameContext!.constellation=0;
    doc.build={mode:"manual-final",ascension:6,stats:{atk:9999,hp:90000,def:800,em:0,critRate:.5,critDamage:1},source:"Synthetic supplied Salon observations, not game captures; launchHP20000, A4refreshHP40000 and panelHP90000 are independent"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.reaction="none";}
    const ctx=observedEntityCastContextSchema.parse(structuredClone(observedSourceCases.contexts["observed-furina-skill-ousia-c0"]));
    delete ctx.sharedState!.actualMaxHPAtScaling;
    for(const key of Object.keys(ctx.furina!.a4MaxHPByRefreshFrame!))ctx.furina!.a4MaxHPByRefreshFrame![key]=40000;
    doc.gameContext!.observedEntityCast=ctx;return doc;
  };
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers.length).toBeGreaterThan(0);};
  // The immutable synthetic fixture records all four members at48% for these
  // late landed attacks; their eligibility is explicitly zero, not unknown.
  const belowHalfPartyIds=["crabaletta-5","chevalmarin-14","chevalmarin-15","usher-8","chevalmarin-16","chevalmarin-17","crabaletta-6","usher-9"];
  const numeric=(doc:CalculatorDocument,options:{omit?:string;firstParty?:number;a4?:number}={})=>{
    const expected=rows.filter(row=>row.id!==options.omit),r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(expected.length);
    const amounts=expected.map(row=>20000*row.coefficient*(row.role==="initial"?1:1+.1*(row.id==="chevalmarin-1"?(options.firstParty??4):(belowHalfPartyIds.includes(row.id)?0:4)))*(row.role==="initial"?1:1+(options.a4??.28))*.5*.9);
    amounts.forEach((v,i)=>expect(r.hits[i]!.nonCritical).toBeCloseTo(v,8));expect(r.totals?.expected).toBeCloseTo(amounts.reduce((a,b)=>a+b,0)*1.5,8);
  };
  it("pins eight unknown-default blockers and independent33-contact scaling/snapshot vectors",()=>{
    const r=calculateDocument(getCharacterDocuments("character:10000089",10).find(row=>row.gameContext?.skillId==="observed-furina-skill-ousia-c0")!);
    expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(8);expect([...new Set(r.blockers.map(reason=>reason.split(":")[0]))]).toEqual(["observed-entity"]);
    const doc=fixture();numeric(doc);expect(rows).toHaveLength(33);
    expect(prepareSourceCastDocument(doc).hits.map(hit=>hit.kind==="ordinary"?[hit.observedEntityEvent?.candidateId,hit.observedEntityEvent?.frame,hit.observedEntityEvent?.snapshotFrame,hit.observedEntityEvent?.scalingFrame]:null))
      .toEqual(rows.map(row=>[row.id,row.frame,row.frame,row.launch]));
  });
  it.each(["casterId","targetId","freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","observedThroughFrame","statsStableAcrossHits","targetContacts","sharedState","furina"] as const)("missing %s cannot certify a complete observed Salon",field=>{const doc=fixture();delete doc.gameContext!.observedEntityCast![field];blocked(doc);});
  it.each(["freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","statsStableAcrossHits"] as const)("false %s cannot certify the full branch",field=>{const doc=fixture();doc.gameContext!.observedEntityCast![field]=false;blocked(doc);});
  it.each(["ousiaThroughoutConfirmed","salonTicks","partyAtLaunch","a4FirstRefreshFrame","a4MaxHPByRefreshFrame","maxHPByScalingFrame"] as const)("missing Furina %s cannot be replaced by current panel",field=>{const doc=fixture();delete doc.gameContext!.observedEntityCast!.furina![field];blocked(doc);});
  it("launch and A4-refresh sample removals are not repaired with each other or currentHP90000",()=>{
    const launch=fixture();delete launch.gameContext!.observedEntityCast!.furina!.maxHPByScalingFrame!["90"];blocked(launch);
    const refresh=fixture();delete refresh.gameContext!.observedEntityCast!.furina!.a4MaxHPByRefreshFrame!["90"];blocked(refresh);
    const included=fixture();delete included.gameContext!.observedEntityCast!.sharedState!.includedDamageBonus;blocked(included);
    const wrongMode=fixture();wrongMode.gameContext!.observedEntityCast!.furina!.ousiaThroughoutConfirmed=false;blocked(wrongMode);
  });
  it("party eligibility is strictly above half and active burst animation still counts",()=>{
    const doc=fixture();const party=doc.gameContext!.observedEntityCast!.furina!.partyAtLaunch!["chevalmarin-1"]!;
    party.members![0]!.currentHP=party.members![0]!.maxHP*.5;numeric(doc,{firstParty:3});
    party.members![0]!.currentHP=party.members![0]!.maxHP;party.activeInBurstAnimation=true;numeric(doc,{firstParty:4});
    for(const field of ["members","activeActorId","activeInBurstAnimation","completePartyConfirmed"] as const){const missing=fixture();delete missing.gameContext!.observedEntityCast!.furina!.partyAtLaunch!["chevalmarin-1"]![field];blocked(missing);}
    const duplicate=fixture();const members=duplicate.gameContext!.observedEntityCast!.furina!.partyAtLaunch!["chevalmarin-1"]!.members!;members[1]!.actorId=members[0]!.actorId;blocked(duplicate);
  });
  it("actual refresh HP0/20000/40000/50000 sets A4 independently of unchanged launch HP",()=>{
    for(const [hp,a4] of [[0,0],[20000,.14],[40000,.28],[50000,.28]] as const){const doc=fixture();for(const key of Object.keys(doc.gameContext!.observedEntityCast!.furina!.a4MaxHPByRefreshFrame!))doc.gameContext!.observedEntityCast!.furina!.a4MaxHPByRefreshFrame![key]=hp!;numeric(doc,{a4});}
  });
  it("already included pet A4 is subtracted without changing the independent initial hit",()=>{
    const doc=fixture();doc.gameContext!.observedEntityCast!.sharedState!.includedDamageBonus=.28;
    for(const hit of doc.hits)if(hit.kind==="ordinary"&&hit.id!=="observed-furina-skill-ousia-c0-initial")hit.damageBonus=.28;
    numeric(doc);
  });
  it("known final miss preserves lifetime; canceled late shot cannot be declared a hit",()=>{
    const unknownContact=fixture();delete unknownContact.gameContext!.observedEntityCast!.targetContacts!["usher-9"];blocked(unknownContact);
    const doc=fixture();doc.gameContext!.observedEntityCast!.targetContacts!["usher-9"]=false;numeric(doc,{omit:"usher-9"});doc.gameContext!.observedEntityCast!.observedThroughFrame=1753;blocked(doc);
    const canceled=fixture();canceled.gameContext!.observedEntityCast!.targetContacts!["chevalmarin-18"]=true;blocked(canceled);
    const noEnd=fixture();noEnd.gameContext!.observedEntityCast!.furina!.salonTicks!.chevalmarin!.pop();blocked(noEnd);
    const unknown=fixture();delete unknown.gameContext!.ascension;if(unknown.build.mode==="manual-final")delete unknown.build.ascension;blocked(unknown);
    const c1=fixture();c1.gameContext!.constellation=1;blocked(c1);
  });
});


describe("Chevreuse declared complete contacts restore actual prior A4 and pre-hit A1",()=>{
  // Independent pinned b4ae769 E1/Q1 literals; eight secondary grenades, not five groups.
  const cases=[
    ["chevreuse-burst-complete-cast-c0",[3.6816,.49088,.49088,.49088,.49088,.49088,.49088,.49088,.49088],18],
    ["chevreuse-skill-press-complete-cast-c0-arkhe-ready",[1.152,.288],4],
    ["chevreuse-skill-hold-complete-cast-c0-arkhe-ready",[1.728,.288],4],
    ["chevreuse-skill-overcharged-complete-cast-c0-arkhe-ready",[2.824,.288],4],
  ] as const;
  const fixture=(id:string)=>{
    const doc=getCharacterDocuments("character:10000090",1).find(row=>row.gameContext?.skillId===id)!;
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.ascension=6;doc.gameContext!.constellation=0;
    doc.build={mode:"manual-final",ascension:6,stats:{atk:2000,hp:90000,def:800,em:0,critRate:.5,critDamage:1},source:"Declared actual complete contacts; prior A4 source HP differs from current panel; pre-hit A1 is explicit, not inferred from this attack"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.reaction="none";}
    doc.gameContext!.batchProjectileCast={statsStableAcrossHits:true,baseAttack:1000,hitStates:Object.fromEntries(doc.hits.map(hit=>[hit.id,{chevreuseA4Active:true,a4SourceHp:20000,includedA4AtkPercent:0,a1Active:true,a1PartyEligible:true,includedA1Shred:0}]))};return doc;
  };
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers.length).toBeGreaterThan(0);};
  const numeric=(doc:CalculatorDocument,coefficients:readonly number[],atk=2200,resMultiplier=1.15)=>{
    const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(coefficients.length);
    coefficients.forEach((v,i)=>expect(r.hits[i]!.nonCritical).toBeCloseTo(v*atk*.5*resMultiplier,8));expect(r.totals?.expected).toBeCloseTo(coefficients.reduce((a,b)=>a+b,0)*atk*.5*resMultiplier*1.5,8);
  };
  it.each(cases)("%s pins defaults and independently restores each hit",(id,coefficients,count)=>{
    const r=calculateDocument(getCharacterDocuments("character:10000090",10).find(row=>row.gameContext?.skillId===id)!);
    expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(count);expect([...new Set(r.blockers.map(reason=>reason.split(":")[0]))]).toEqual(["batch-projectile-cast"]);numeric(fixture(id),coefficients);
  });
  it.each(cases)("%s rejects every missing actual sample and share",(id)=>{
    for(const hit of fixture(id).hits)for(const field of ["chevreuseA4Active","a4SourceHp","includedA4AtkPercent","a1Active","a1PartyEligible","includedA1Shred"] as const){const doc=fixture(id);delete doc.gameContext!.batchProjectileCast!.hitStates![hit.id]![field];blocked(doc);}
    const white=fixture(id);delete white.gameContext!.batchProjectileCast!.baseAttack;blocked(white);
    const asc=fixture(id);delete asc.gameContext!.ascension;if(asc.build.mode==="manual-final")delete asc.build.ascension;blocked(asc);
    const c1=fixture(id);c1.gameContext!.constellation=1;blocked(c1);
    const party=fixture(id);Object.values(party.gameContext!.batchProjectileCast!.hitStates!).forEach(state=>state.a1PartyEligible=false);blocked(party);
  });
  it.each(cases)("%s restores included shares without double counting and caps actual A4",(id,coefficients)=>{
    const included=fixture(id);if(included.build.mode!=="manual-final")throw Error("manual");included.build.stats.atk=2200;included.enemy.resistance=-.3;
    Object.values(included.gameContext!.batchProjectileCast!.hitStates!).forEach(state=>{state.includedA4AtkPercent=.2;state.includedA1Shred=.4;});delete included.gameContext!.batchProjectileCast!.baseAttack;numeric(included,coefficients);
    for(const [hp,atk] of [[0,2000],[40000,2400],[90000,2400]]){const doc=fixture(id);Object.values(doc.gameContext!.batchProjectileCast!.hitStates!).forEach(state=>state.a4SourceHp=hp!);numeric(doc,coefficients,atk!);}
    const locked=fixture(id);locked.gameContext!.ascension=0;if(locked.build.mode==="manual-final")locked.build.ascension=0;
    Object.values(locked.gameContext!.batchProjectileCast!.hitStates!).forEach(state=>{delete state.chevreuseA4Active;delete state.a4SourceHp;delete state.a1Active;delete state.a1PartyEligible;});numeric(locked,coefficients,2000,.9);
  });
  it.each(cases)("%s needs wholecast stability but not unselected future samples",(id,coefficients)=>{
    const doc=fixture(id);delete doc.gameContext!.batchProjectileCast!.statsStableAcrossHits;blocked(doc);doc.gameContext!.batchProjectileCast!.statsStableAcrossHits=false;blocked(doc);
    doc.scope="single-hit";doc.selectedHitIds=[doc.hits[0]!.id];for(const hit of doc.hits.slice(1))delete doc.gameContext!.batchProjectileCast!.hitStates![hit.id];numeric(doc,[coefficients[0]]);
  });
  it("Q and ordinary E do not invent A4 or pre-hit shred; unlocked overcharged E cannot deny its own prior A4",()=>{
    for(const [id,coefficients] of cases){const doc=fixture(id);Object.values(doc.gameContext!.batchProjectileCast!.hitStates!).forEach(state=>{state.chevreuseA4Active=false;delete state.a4SourceHp;state.a1Active=false;delete state.a1PartyEligible;});
      if(id.includes("overcharged"))blocked(doc);else numeric(doc,coefficients,2000,.9);
    }
  });
});


describe("Gaming actual special plunge uses hit-time HP before next-frame drain",()=>{
  const fixture=()=>{
    const doc=getCharacterDocuments("character:10000092",10).find(row=>row.gameContext?.skillId==="gaming-charmed-cloudstrider")!;
    doc.characterLevel=90;doc.gameContext!.ascension=6;doc.gameContext!.constellation=0;
    doc.build={mode:"manual-final",ascension:6,stats:{atk:2000,hp:20000,def:800,em:0,critRate:.5,critDamage:1},source:"One declared actual special-plunge contact; hit-time HP supplied, no inferred subsequent drain or repeat cast"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    doc.gameContext!.gamingDamage={hpPercent:50,a4Included:false,c2Active:false,c2Included:false,c6CritRateIncluded:false,c6CritDamageIncluded:false};
    for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.reaction="none";}return doc;
  };
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  const numeric=(doc:CalculatorDocument,bonus:number)=>{const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(1);expect(r.totals?.nonCritical).toBeCloseTo(2000*4.1472*(1+bonus)*.5*.9,8);expect(r.totals?.expected).toBeCloseTo(2000*4.1472*(1+bonus)*.5*.9*1.5,8);};
  it("pins the exact missing HP default without inventing zero",()=>{
    const r=calculateDocument(getCharacterDocuments("character:10000092",10).find(row=>row.gameContext?.skillId==="gaming-charmed-cloudstrider")!);
    expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(1);expect(r.blockers[0]).toMatch(/^gaming-damage:/);
  });
  it.each([[0,0],[49.999,0],[50,.2],[100,.2]])("actual HP%s percent yields A4%s",(hp,bonus)=>{const doc=fixture();doc.gameContext!.gamingDamage!.hpPercent=hp;numeric(doc,bonus);});
  it("requires actual HP, unlocked accounting and known ascension",()=>{
    for(const field of ["hpPercent","a4Included"] as const){const doc=fixture();delete doc.gameContext!.gamingDamage![field];blocked(doc);}
    const asc=fixture();delete asc.gameContext!.ascension;if(asc.build.mode==="manual-final")delete asc.build.ascension;blocked(asc);
    const locked=fixture();locked.gameContext!.ascension=3;if(locked.build.mode==="manual-final")locked.build.ascension=3;delete locked.gameContext!.gamingDamage!.hpPercent;numeric(locked,0);
  });
  it("subtracts already-included or stale A4 rather than multiplying the panel twice",()=>{
    const doc=fixture();if(doc.hits[0]!.kind!=="ordinary")throw Error("ordinary");doc.hits[0]!.damageBonus=.2;doc.gameContext!.gamingDamage!.a4Included=true;numeric(doc,.2);
    doc.gameContext!.gamingDamage!.hpPercent=49;numeric(doc,0);
  });
  it("retains supported C1 but rejects invented extra contacts and locked C2 claims",()=>{
    const c1=fixture();c1.gameContext!.constellation=1;numeric(c1,.2);
    const c2=fixture();c2.gameContext!.gamingDamage!.c2Active=true;blocked(c2);
    const extra=fixture();extra.hits.push({...extra.hits[0]!,id:"invented-extra-contact"});extra.selectedHitIds.push("invented-extra-contact");extra.scope="one-cast";blocked(extra);
  });
});


describe("Chiori explicit single-doll idle lifetime preserves real contacts and passive accounting",()=>{
  const fixture=(hold=false)=>{
    const doc=getCharacterDocuments("character:10000094",1).find(row=>row.gameContext?.skillId==="idle-chiori-skill-c0")!;
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.ascension=6;doc.gameContext!.constellation=0;
    doc.build={mode:"manual-final",ascension:6,stats:{atk:2000,hp:20000,def:800,em:0,critRate:.5,critDamage:1},source:"Observed single doll with no constructs, empty followup history and literal contact records; not inferred automatic full contact"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.reaction="none";}
    doc.gameContext!.idleStanceCast={casterId:"owner",targetId:"enemy",freshCastConfirmed:true,noHitlag:true,noInterruption:true,noReplacement:true,fullObservedLifetime:true,observedThroughFrame:hold?1084:1069,statsStableAcrossHits:true,followupActions:[],chiori:{hold,noGeoConstructs:true,priorA4Inactive:true},sharedState:{includedDamageBonus:0},targetContacts:{initial:true,"doll-1":true,"doll-2":true,"doll-3":true,"doll-4":true,"doll-5":true}};return doc;
  };
  const expected=[(2000*1.4928+800*1.866)*.5*.9,...Array<number>(5).fill((2000*.8208+800*1.026)*.5*.9)];
  const numeric=(doc:CalculatorDocument,values:readonly number[]=expected)=>{const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(values.length);values.forEach((v,i)=>expect(r.hits[i]!.nonCritical).toBeCloseTo(v,8));expect(r.totals?.expected).toBeCloseTo(values.reduce((a,b)=>a+b,0)*1.5,8);return r;};
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  it("pins four exact unknown default blockers",()=>{const r=calculateDocument(getCharacterDocuments("character:10000094",10).find(row=>row.gameContext?.skillId==="idle-chiori-skill-c0")!);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(4);expect([...new Set(r.blockers.map(reason=>reason.split(":")[0]))]).toEqual(["idle-stance"]);});
  it.each([false,true])("hold=%s preserves six literal frame/snapshot contacts and ATK+DEF oracle",hold=>{
    const prepared=prepareSourceCastDocument(fixture(hold));numeric(prepared);const frames=hold?[37,75,291,507,723,939]:[21,60,276,492,708,924];
    expect(prepared.hits.map(hit=>hit.kind==="ordinary"?hit.idleStanceEvent?.frame:null)).toEqual(frames);expect(prepared.hits.map(hit=>hit.kind==="ordinary"?hit.idleStanceEvent?.snapshotFrame:null)).toEqual(frames);
  });
  it.each([false,true])("hold=%s requires actual complete history, flags and each known contact",hold=>{
    for(const key of ["casterId","targetId","freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","observedThroughFrame","statsStableAcrossHits","followupActions","targetContacts","chiori"] as const){const doc=fixture(hold);delete doc.gameContext!.idleStanceCast![key];blocked(doc);}
    for(const key of ["freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","statsStableAcrossHits"] as const){const doc=fixture(hold);doc.gameContext!.idleStanceCast![key]=false;blocked(doc);}
    for(const key of ["hold","noGeoConstructs","priorA4Inactive"] as const){const doc=fixture(hold);delete doc.gameContext!.idleStanceCast!.chiori![key];blocked(doc);}
    for(const key of ["noGeoConstructs","priorA4Inactive"] as const){const doc=fixture(hold);doc.gameContext!.idleStanceCast!.chiori![key]=false;blocked(doc);}
    const unknown=fixture(hold);delete unknown.gameContext!.idleStanceCast!.targetContacts!["doll-5"];blocked(unknown);
    const missed=fixture(hold);missed.gameContext!.idleStanceCast!.targetContacts!["doll-5"]=false;numeric(missed,expected.slice(0,-1));missed.gameContext!.idleStanceCast!.observedThroughFrame=(hold?1084:1069)-1;blocked(missed);
  });
  it("requires explicit included A4 even when the branch proves actual zero and subtracts stale shares",()=>{
    const unknown=fixture();delete unknown.gameContext!.idleStanceCast!.sharedState!.includedDamageBonus;blocked(unknown);
    const included=fixture();included.gameContext!.idleStanceCast!.sharedState!.includedDamageBonus=.2;for(const hit of included.hits)if(hit.kind==="ordinary")hit.damageBonus=.2;numeric(included);
    const asc=fixture();delete asc.gameContext!.ascension;if(asc.build.mode==="manual-final")delete asc.build.ascension;blocked(asc);
    const c1=fixture();c1.gameContext!.constellation=1;blocked(c1);
    const extra=fixture();extra.gameContext!.idleStanceCast!.followupActions=[{id:"later-E",frame:100,actorId:"owner",kind:"skill"}];blocked(extra);
  });
});


describe("Arlecchino seven actual normal contacts require pre-consumption Bond of Life",()=>{
  const cases=[["1",.938961],["2",1.029996],["3",1.29251],["4-hit-1",.734264],["4-hit-2",.734264],["5",1.383358],["6",1.687709]] as const;
  const fixture=(suffix:string)=>{
    const doc=getCharacterDocuments("character:10000096",10).find(row=>row.gameContext?.skillId===`arlecchino-red-death-normal-${suffix}`)!;
    doc.characterLevel=90;doc.gameContext!.constellation=0;doc.gameContext!.ascension=6;
    doc.build={mode:"manual-final",ascension:6,stats:{atk:2000,hp:20000,def:800,em:0,critRate:.5,critDamage:1},source:"One actual independently sampled normal; declared pre-consumption bond, not a generated normal chain"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};doc.gameContext!.arlecchinoDamage={bondOfLifePercent:150,passivePyroBonusIncluded:false,includedBondBase:0};
    for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.additiveBaseDamage=0;hit.reaction="none";}return doc;
  };
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  const numeric=(doc:CalculatorDocument,coefficient:number,bond=150,c1=false)=>{
    const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(1);
    const nonCritical=(2000*coefficient+2000*bond*.01*(2.38+(c1?1:0)))*1.4*.5*.9;
    expect(r.totals?.nonCritical).toBeCloseTo(nonCritical,8);expect(r.totals?.expected).toBeCloseTo(nonCritical*1.5,8);
  };
  it.each(cases)("N%s keeps a separate actual bond sample and independent NA10 terms",(suffix,coefficient)=>{
    const r=calculateDocument(getCharacterDocuments("character:10000096",10).find(row=>row.gameContext?.skillId===`arlecchino-red-death-normal-${suffix}`)!);
    expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(1);expect(r.blockers[0]).toMatch(/^arlecchino-damage:/);numeric(fixture(suffix),coefficient);
  });
  it.each(cases)("N%s pins 30-percent qualification, maximum actual bond and missing inputs",(suffix,coefficient)=>{
    for(const bond of [30,200]){const doc=fixture(suffix);doc.gameContext!.arlecchinoDamage!.bondOfLifePercent=bond;numeric(doc,coefficient,bond);}
    for(const bond of [0,29.999]){const doc=fixture(suffix);doc.gameContext!.arlecchinoDamage!.bondOfLifePercent=bond;blocked(doc);}
    for(const field of ["bondOfLifePercent","passivePyroBonusIncluded"] as const){const doc=fixture(suffix);delete doc.gameContext!.arlecchinoDamage![field];blocked(doc);}
    const included=fixture(suffix);if(included.hits[0]!.kind!=="ordinary")throw Error("ordinary");included.hits[0]!.additiveBaseDamage=100;delete included.gameContext!.arlecchinoDamage!.includedBondBase;blocked(included);
  });
  it.each(cases)("N%s restores entered bond and innate Pyro shares; C1 adds one to masque",(suffix,coefficient)=>{
    const doc=fixture(suffix);if(doc.hits[0]!.kind!=="ordinary")throw Error("ordinary");doc.hits[0]!.additiveBaseDamage=7140;doc.hits[0]!.damageBonus=.4;
    doc.gameContext!.arlecchinoDamage!.includedBondBase=7140;doc.gameContext!.arlecchinoDamage!.passivePyroBonusIncluded=true;numeric(doc,coefficient);
    const c1=fixture(suffix);c1.gameContext!.constellation=1;numeric(c1,coefficient,150,true);
    const extra=fixture(suffix);extra.hits.push({...extra.hits[0]!,id:"invented-second-contact"});extra.selectedHitIds.push("invented-second-contact");extra.scope="one-cast";blocked(extra);
  });
});


describe("Emilie explicit non-Burning level-one E lifetime and independent actual A4 sample",()=>{
  const fixture=()=>{
    const doc=getCharacterDocuments("character:10000099",1).find(row=>row.gameContext?.skillId==="observed-emilie-skill-c0")!;
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.ascension=6;doc.gameContext!.constellation=0;
    doc.build={mode:"manual-final",ascension:6,stats:{atk:2000,hp:20000,def:800,em:0,critRate:.5,critDamage:1},source:"Explicit no-nearby-Burning observations and each level-one contact; no level-two or A1 lifecycle inferred"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.reaction="none";}
    doc.gameContext!.observedEntityCast={casterId:"owner",targetId:"enemy",freshCastConfirmed:true,noHitlag:true,noInterruption:true,noReplacement:true,fullObservedLifetime:true,observedThroughFrame:1336,statsStableAcrossHits:true,
      emilie:{caseTravelFrames:5,arkheReady:true,burningHistoryComplete:true,burningWithin20:[{startFrame:0,endFrame:1336,burningPresent:false}]},sharedState:{targetBurningAtHit:false,includedDamageBonus:0},
      targetContacts:{initial:true,arkhe:true,"case-1-1":true,"case-2-1":true,"case-3-1":true,"case-4-1":true,"case-5-1":true,"case-6-1":true,"case-7-1":true,"case-8-1":true,"case-9-1":true,"case-10-1":true,"case-11-1":true,"case-12-1":true,"case-13-1":true,"case-14-1":true}};return doc;
  };
  const expected=[.4708,.3852,...Array<number>(14).fill(.396)].map(coefficient=>2000*coefficient*.5*.9);
  const numeric=(doc:CalculatorDocument,values:readonly number[]=expected)=>{const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(values.length);values.forEach((v,i)=>expect(r.hits[i]!.nonCritical).toBeCloseTo(v,8));expect(r.totals?.expected).toBeCloseTo(values.reduce((a,b)=>a+b,0)*1.5,8);};
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  it("pins exact unknown default and independently literal level-one impacts",()=>{
    const r=calculateDocument(getCharacterDocuments("character:10000099",10).find(row=>row.gameContext?.skillId==="observed-emilie-skill-c0")!);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(10);expect([...new Set(r.blockers.map(reason=>reason.split(":")[0]))]).toEqual(["observed-entity"]);
    const doc=prepareSourceCastDocument(fixture());numeric(doc);const frames=[37,62,111,201,291,381,471,561,651,741,831,921,1011,1101,1191,1281];
    expect(doc.hits.map(hit=>hit.kind==="ordinary"?hit.observedEntityEvent?.frame:null)).toEqual(frames);expect(doc.hits.map(hit=>hit.kind==="ordinary"?hit.observedEntityEvent?.snapshotFrame:null)).toEqual(frames);
  });
  it("unknown history/contact is not known false, and final miss does not shorten lifetime",()=>{
    for(const key of ["casterId","targetId","freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","observedThroughFrame","statsStableAcrossHits","targetContacts","emilie"] as const){const doc=fixture();delete doc.gameContext!.observedEntityCast![key];blocked(doc);}
    for(const key of ["freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","statsStableAcrossHits"] as const){const doc=fixture();doc.gameContext!.observedEntityCast![key]=false;blocked(doc);}
    for(const key of ["caseTravelFrames","arkheReady","burningHistoryComplete","burningWithin20"] as const){const doc=fixture();delete doc.gameContext!.observedEntityCast!.emilie![key];blocked(doc);}
    const unknown=fixture();delete unknown.gameContext!.observedEntityCast!.emilie!.burningWithin20![0]!.burningPresent;blocked(unknown);
    const gap=fixture();gap.gameContext!.observedEntityCast!.emilie!.burningWithin20![0]!.endFrame=45;blocked(gap);
    const contact=fixture();delete contact.gameContext!.observedEntityCast!.targetContacts!["case-14-1"];blocked(contact);
    const missed=fixture();missed.gameContext!.observedEntityCast!.targetContacts!["case-14-1"]=false;numeric(missed,expected.slice(0,-1));missed.gameContext!.observedEntityCast!.observedThroughFrame=1335;blocked(missed);
    const arkhe=fixture();arkhe.gameContext!.observedEntityCast!.emilie!.arkheReady=false;blocked(arkhe);
  });
  it("requires hit-target burning and accounting, not just a complete nearby-burning record",()=>{
    for(const key of ["targetBurningAtHit","includedDamageBonus"] as const){const doc=fixture();delete doc.gameContext!.observedEntityCast!.sharedState![key];blocked(doc);}
    const asc=fixture();delete asc.gameContext!.ascension;if(asc.build.mode==="manual-final")delete asc.build.ascension;blocked(asc);
    const c1=fixture();c1.gameContext!.constellation=1;blocked(c1);
  });
  it.each([[0,0],[1000,.15],[2400,.36],[9000,.36]])("independent occurred initial reads actual impact ATK%s for A4%s, not panel2000",(atk,bonus)=>{
    const doc=fixture();doc.scope="single-hit";doc.selectedHitIds=[doc.hits[0]!.id];doc.gameContext!.observedEntityCast={sharedState:{targetBurningAtHit:true,actualAtkAtHit:atk,includedDamageBonus:0}};
    numeric(doc,[expected[0]!*(1+bonus)]);delete doc.gameContext!.observedEntityCast!.sharedState!.actualAtkAtHit;blocked(doc);
  });
  it("subtracts stale included A4 while ASC3 requires no actual target-burning sample",()=>{
    const doc=fixture();for(const hit of doc.hits)if(hit.kind==="ordinary")hit.damageBonus=.36;doc.gameContext!.observedEntityCast!.sharedState!.includedDamageBonus=.36;numeric(doc);
    doc.gameContext!.ascension=3;if(doc.build.mode==="manual-final")doc.build.ascension=3;delete doc.gameContext!.observedEntityCast!.sharedState!.targetBurningAtHit;numeric(doc);
  });
});


describe("Emilie observed Q selections retain mark exclusion and independent E-level tail",()=>{
  const fixture=()=>{
    const doc=getCharacterDocuments("character:10000099",1).find(row=>row.gameContext?.skillId==="observed-emilie-burst-c0")!;
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.ascension=6;doc.gameContext!.constellation=0;
    doc.build={mode:"manual-final",ascension:6,stats:{atk:2000,hp:20000,def:800,em:0,critRate:.5,critDamage:1},source:"Literal observed nine Q selections; no-nearby-Burning case tail, separate actual E9 from Q1"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.reaction="none";}
    const ctx=observedEntityCastContextSchema.parse(structuredClone(observedSourceCases.contexts["observed-emilie-burst-c0"]));
    ctx.skillTalentLevel=9;ctx.sharedState={targetBurningAtHit:false,includedDamageBonus:0};ctx.emilie!.burningWithin20=[{startFrame:0,endFrame:1626,burningPresent:false}];
    ctx.targetContacts={"burst-1":true,"burst-2":false,"burst-3":false,"burst-4":true,"burst-5":false,"burst-6":false,"burst-7":true,"burst-8":false,"burst-9":false,"case-1-1":true,"case-2-1":true,"case-3-1":true,"case-4-1":true,"case-5-1":true,"case-6-1":true,"case-7-1":true,"case-8-1":true,"case-9-1":true,"case-10-1":true,"case-11-1":true,"case-12-1":true,"case-13-1":true,"case-14-1":true};doc.gameContext!.observedEntityCast=ctx;return doc;
  };
  const expected=[...Array<number>(3).fill(2.172),...Array<number>(14).fill(.6732)].map(c=>2000*c*.5*.9);
  const numeric=(doc:CalculatorDocument,values:readonly number[]=expected)=>{const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(values.length);values.forEach((v,i)=>expect(r.hits[i]!.nonCritical).toBeCloseTo(v,8));expect(r.totals?.expected).toBeCloseTo(values.reduce((a,b)=>a+b,0)*1.5,8);};
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  it("pins eight exact default blockers and independent three-Q/fourteen-E hit arithmetic",()=>{
    const r=calculateDocument(getCharacterDocuments("character:10000099",10).find(row=>row.gameContext?.skillId==="observed-emilie-burst-c0")!);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(8);expect([...new Set(r.blockers.map(reason=>reason.split(":")[0]))]).toEqual(["observed-entity"]);
    const doc=prepareSourceCastDocument(fixture());numeric(doc);const frames=[126,180,234,401,491,581,671,761,851,941,1031,1121,1211,1301,1391,1481,1571];expect(doc.hits.map(hit=>hit.kind==="ordinary"?hit.observedEntityEvent?.frame:null)).toEqual(frames);expect(doc.hits.map(hit=>hit.kind==="ordinary"?hit.observedEntityEvent?.snapshotFrame:null)).toEqual(frames);
  });
  it("requires independent E talent and all actual observations rather than defaulting absence",()=>{
    for(const field of ["skillTalentLevel","casterId","targetId","freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","observedThroughFrame","statsStableAcrossHits","targetContacts","emilie"] as const){const doc=fixture();delete doc.gameContext!.observedEntityCast![field];blocked(doc);}
    for(const key of ["caseTravelFrames","burningHistoryComplete","burningWithin20","burstSelections"] as const){const doc=fixture();delete doc.gameContext!.observedEntityCast!.emilie![key];blocked(doc);}
    for(const key of ["targetBurningAtHit","includedDamageBonus"] as const){const doc=fixture();delete doc.gameContext!.observedEntityCast!.sharedState![key];blocked(doc);}
    for(const id of ["burst-1","burst-2","burst-3","burst-4","burst-5","burst-6","burst-7","burst-8","burst-9"]){const doc=fixture();delete doc.gameContext!.observedEntityCast!.emilie!.burstSelections![id];blocked(doc);}
  });
  it("keeps marked target exclusions and explicit random-location contact separate",()=>{
    const marked=fixture();marked.gameContext!.observedEntityCast!.emilie!.burstSelections!["burst-2"]!.selectedTargetId="enemy-1";blocked(marked);
    const eligible=fixture();eligible.gameContext!.observedEntityCast!.emilie!.burstSelections!["burst-4"]!.selectedTargetId=null;blocked(eligible);
    const roster=fixture();roster.gameContext!.observedEntityCast!.emilie!.burstSelections!["burst-1"]!.completeRosterConfirmed=false;blocked(roster);
    const wrong=fixture();wrong.gameContext!.observedEntityCast!.emilie!.burstSelections!["burst-1"]!.frame=115;blocked(wrong);
    const contact=fixture();delete contact.gameContext!.observedEntityCast!.targetContacts!["burst-2"];blocked(contact);
  });
  it("known final miss still requires complete restored-case lifetime and actual ascension",()=>{
    const doc=fixture();doc.gameContext!.observedEntityCast!.targetContacts!["case-14-1"]=false;numeric(doc,expected.slice(0,-1));doc.gameContext!.observedEntityCast!.observedThroughFrame=1625;blocked(doc);
    const asc=fixture();delete asc.gameContext!.ascension;if(asc.build.mode==="manual-final")delete asc.build.ascension;blocked(asc);
    const c1=fixture();c1.gameContext!.constellation=1;blocked(c1);
  });
});


describe("Kachina physical plunges use observed collision opportunities, not inferred height counts",()=>{
  const cases=[["low",2.527025],["high",3.15639]] as const;
  const fixture=(height:string)=>{
    const doc=getCharacterDocuments("character:10000100",10).find(row=>row.gameContext?.skillId===`kachina-plunge-${height}-with-collision`)!;
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.constellation=0;
    doc.build={mode:"manual-final",stats:{atk:1000,hp:10000,def:700,em:0,critRate:.5,critDamage:1},source:"Two declared physical collision opportunities, one known miss, and actual landing; no inferred height threshold or trajectory timing"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.reaction="none";}
    doc.gameContext!.observedPlunge={noExternalInfusion:true,collisionCount:2,collisionContacts:{"1":true,"2":false},landingContact:true,statsStableAcrossHits:true};return doc;
  };
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  const numeric=(doc:CalculatorDocument,coefficients:readonly number[])=>{const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(coefficients.length);coefficients.forEach((c,i)=>expect(r.hits[i]!.nonCritical).toBeCloseTo(1000*c*.5*.9,8));expect(r.totals?.expected).toBeCloseTo(coefficients.reduce((a,b)=>a+b,0)*1000*.5*.9*1.5,8);};
  it.each(cases)("%s pins unknown default and independent collision/landing NA10 coefficients",(height,landing)=>{
    const r=calculateDocument(getCharacterDocuments("character:10000100",10).find(row=>row.gameContext?.skillId===`kachina-plunge-${height}-with-collision`)!);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(1);expect(r.blockers[0]).toMatch(/^observed-plunge:/);
    numeric(fixture(height),[1.26378,landing]);
  });
  it.each(cases)("%s requires each opportunity's contact, actual count, landing and stable conditions",(height,landing)=>{
    for(const key of ["noExternalInfusion","collisionCount","collisionContacts","landingContact","statsStableAcrossHits"] as const){const doc=fixture(height);delete doc.gameContext!.observedPlunge![key];blocked(doc);}
    for(const key of ["noExternalInfusion","statsStableAcrossHits"] as const){const doc=fixture(height);doc.gameContext!.observedPlunge![key]=false;blocked(doc);}
    const unknown=fixture(height);delete unknown.gameContext!.observedPlunge!.collisionContacts!["2"];blocked(unknown);
    const both=fixture(height);both.gameContext!.observedPlunge!.collisionContacts!["2"]=true;numeric(both,[1.26378,1.26378,landing]);
    const noCollision=fixture(height);noCollision.gameContext!.observedPlunge!.collisionCount=0;noCollision.gameContext!.observedPlunge!.collisionContacts={};numeric(noCollision,[landing]);
    const missedLanding=fixture(height);missedLanding.gameContext!.observedPlunge!.landingContact=false;numeric(missedLanding,[1.26378]);
  });
  it.each(cases)("%s keeps no-contact distinct from zero numeric damage and retains physical C0 guard",height=>{
    const none=fixture(height);none.gameContext!.observedPlunge!.collisionContacts={"1":false,"2":false};none.gameContext!.observedPlunge!.landingContact=false;
    const r=calculateDocument(none);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(1);expect(r.hits[0]!.status).toBe("non-damaging");expect(r.totals).toBeUndefined();
    const c1=fixture(height);c1.gameContext!.constellation=1;blocked(c1);
    const reaction=fixture(height);if(reaction.hits[0]!.kind!=="ordinary")throw Error("ordinary");reaction.hits[0]!.reaction="melt";blocked(reaction);
  });
  it.each(cases)("%s actual selected collision or landing does not require unselected future trajectory",(height,landing)=>{
    for(const [role,coefficient] of [["collision-1",1.26378],["landing",landing]] as const){const doc=prepareSourceCastDocument(fixture(height));doc.scope="single-hit";doc.selectedHitIds=[doc.hits.find(hit=>hit.id.endsWith(`:${role}`))!.id];doc.gameContext!.observedPlunge={noExternalInfusion:true};numeric(doc,[coefficient]);delete doc.gameContext!.observedPlunge!.noExternalInfusion;blocked(doc);}
  });
});


describe("Kachina actual mode/contact/point ledger does not fabricate a drain schedule",()=>{
  const fixture=()=>{
    const doc=getCharacterDocuments("character:10000100",1).find(row=>row.gameContext?.skillId==="kachina-skill-observed-lifecycle")!;
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.ascension=6;doc.gameContext!.constellation=0;
    doc.build={mode:"manual-final",ascension:6,stats:{atk:9999,hp:20000,def:800,em:0,critRate:.5,critDamage:1},source:"Synthetic explicit observed-event protocol fixture; times and point balances are input facts, not measured or generated game drain rates"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    doc.gameContext!.kachinaCast={casterId:"owner",targetId:"enemy",startingMode:"independent",allActionsRecorded:true,fullObservedLifetime:true,noPhlogiston:true,noReplacement:true,noInterruption:true,statsStableAcrossHits:true,observedThroughFrame:300,
      events:[{id:"independent",frame:30,kind:"independent-slam",nightsoulPointsAfter:50,targetContact:true,a1Active:true,a1IncludedInDamageBonus:false},
        {id:"mount",frame:60,kind:"mount",nightsoulPointsAfter:45},
        {id:"riding",frame:90,kind:"riding-slam",nightsoulPointsAfter:20,targetContact:true,a1Active:false},
        {id:"dismount",frame:100,kind:"dismount",nightsoulPointsAfter:20},
        {id:"miss",frame:120,kind:"independent-slam",nightsoulPointsAfter:10,targetContact:false},
        {id:"drain",frame:299,kind:"points-observed",nightsoulPointsAfter:0},
        {id:"end",frame:300,kind:"end",nightsoulPointsAfter:0}]};return doc;
  };
  const expected=[800*(.6376+.2)*1.2*.5*.9,800*(.8776+.2)*.5*.9];
  const numeric=(doc:CalculatorDocument,values:readonly number[]=expected)=>{const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(values.length);values.forEach((v,i)=>expect(r.hits[i]!.nonCritical).toBeCloseTo(v,8));expect(r.totals?.expected).toBeCloseTo(values.reduce((a,b)=>a+b,0)*1.5,8);};
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  it("pins exact two unknown default blockers and distinct independent/riding DEF arithmetic",()=>{
    const r=calculateDocument(getCharacterDocuments("character:10000100",10).find(row=>row.gameContext?.skillId==="kachina-skill-observed-lifecycle")!);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(2);expect([...new Set(r.blockers.map(reason=>reason.split(":")[0]))]).toEqual(["kachina-cast"]);
    const doc=prepareSourceCastDocument(fixture());numeric(doc);expect(doc.hits.map(hit=>hit.kind==="ordinary"?hit.observedEntityEvent?.frame:null)).toEqual([30,90]);
  });
  it("requires full actual history and per-contact A1 rather than assuming missed or inactive",()=>{
    for(const key of ["casterId","targetId","startingMode","events","allActionsRecorded","fullObservedLifetime","noPhlogiston","noReplacement","noInterruption","statsStableAcrossHits","observedThroughFrame"] as const){const doc=fixture();delete doc.gameContext!.kachinaCast![key];blocked(doc);}
    for(const key of ["allActionsRecorded","fullObservedLifetime","noPhlogiston","noReplacement","noInterruption","statsStableAcrossHits"] as const){const doc=fixture();doc.gameContext!.kachinaCast![key]=false;blocked(doc);}
    for(const key of ["targetContact","a1Active","a1IncludedInDamageBonus"] as const){const doc=fixture();delete doc.gameContext!.kachinaCast!.events![0]![key];blocked(doc);}
    const miss=fixture();delete miss.gameContext!.kachinaCast!.events![4]!.targetContact;blocked(miss);
    const conflict=fixture();conflict.gameContext!.kachinaCast!.a1InactiveThroughout=true;blocked(conflict);
  });
  it("enforces actual modes, non-increasing points and a witnessed zero-point end",()=>{
    const mode=fixture();mode.gameContext!.kachinaCast!.events!.splice(1,1);blocked(mode);
    const increase=fixture();increase.gameContext!.kachinaCast!.events![1]!.nightsoulPointsAfter=51;blocked(increase);
    const end=fixture();end.gameContext!.kachinaCast!.events!.pop();blocked(end);
    const early=fixture();early.gameContext!.kachinaCast!.observedThroughFrame=299;blocked(early);
    const after=fixture();after.gameContext!.kachinaCast!.events!.push({id:"late",frame:301,kind:"independent-slam",nightsoulPointsAfter:0,targetContact:true,a1Active:false});blocked(after);
    const duplicate=fixture();duplicate.gameContext!.kachinaCast!.events![1]!.id="independent";blocked(duplicate);
    const c1=fixture();c1.gameContext!.constellation=1;blocked(c1);
  });
  it("accounts for included A1 once and removes only A4 below ASC4",()=>{
    const included=prepareSourceCastDocument(fixture());included.gameContext!.kachinaCast!.events![0]!.a1IncludedInDamageBonus=true;if(included.hits[0]!.kind!=="ordinary")throw Error("ordinary");included.hits[0]!.damageBonus=.2;numeric(included);
    const asc3=fixture();asc3.gameContext!.ascension=3;if(asc3.build.mode==="manual-final")asc3.build.ascension=3;numeric(asc3,[800*.6376*1.2*.5*.9,800*.8776*.5*.9]);
    const unknown=fixture();delete unknown.gameContext!.ascension;if(unknown.build.mode==="manual-final")delete unknown.build.ascension;blocked(unknown);
  });
  it("an independently occurred first slam does not require future mount or final disappearance",()=>{
    const doc=fixture();doc.scope="single-hit";doc.selectedHitIds=["kachina-skill-observed-lifecycle-hit-2"];doc.gameContext!.kachinaCast={casterId:"owner",targetId:"enemy",startingMode:"independent",events:[doc.gameContext!.kachinaCast!.events![0]!]};numeric(doc,[expected[0]!]);
    delete doc.gameContext!.kachinaCast!.events![0]!.a1Active;blocked(doc);
  });
});


describe("Kinich actual E contacts keep blessing, points and cannon creation samples explicit",()=>{
  const cases=[["kinich-loop-shot-single",2,1],["kinich-loop-shot-pair",4,2],["kinich-scalespiker-cannon",2,1]] as const;
  const fixture=(id:string)=>{
    const doc=getCharacterDocuments("character:10000101",10).find(row=>row.gameContext?.skillId===id)!;
    doc.scope=id==="kinich-loop-shot-pair"?"one-cast":"single-hit";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.ascension=6;doc.gameContext!.constellation=0;
    doc.build={mode:"manual-final",ascension:6,stats:{atk:2000,hp:20000,def:800,em:0,critRate:.5,critDamage:1},source:"Actual selected E contact(s); explicit current blessing and cannon pre-use points, no full rotation or point acquisition inferred"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.reaction="none";hit.additiveBaseDamage=0;}
    doc.gameContext!.kinichDamage={nightsoulBlessingActive:true,cannonPointsBeforeUse:20,a4Stacks:2,a4CreationAttack:1800,includedA4BaseDamage:0,c1CritDamageIncluded:false,bothLoopHitsConnected:true,statsStableAcrossHits:true};return doc;
  };
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  const numeric=(doc:CalculatorDocument,cannon:boolean,count=1,stacks=2,creationAtk=1800,c1=false)=>{
    const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(count);
    const value=(2000*(cannon?12.37392:1.03104)+(cannon?3.2*stacks*creationAtk:0))*.5*.9;
    r.hits.forEach(hit=>expect(hit.nonCritical).toBeCloseTo(value,8));expect(r.totals?.expected).toBeCloseTo(value*count*(cannon&&c1?2:1.5),8);
  };
  it.each(cases)("%s pins static blockers and independent E10 arithmetic",(id,blockers,count)=>{
    const r=calculateDocument(getCharacterDocuments("character:10000101",10).find(row=>row.gameContext?.skillId===id)!);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(blockers);expect([...new Set(r.blockers.map(reason=>reason.split(":")[0]))]).toEqual(["kinich-damage"]);numeric(fixture(id),id==="kinich-scalespiker-cannon",count);
  });
  it.each(cases)("%s retains source ability, shape, blessing and C0/C1 boundary",id=>{
    for(const active of [undefined,false]){const doc=fixture(id);if(active===undefined)delete doc.gameContext!.kinichDamage!.nightsoulBlessingActive;else doc.gameContext!.kinichDamage!.nightsoulBlessingActive=active;blocked(doc);}
    const wrong=fixture(id);wrong.gameContext!.abilityId="talent:kinich:combat1";blocked(wrong);
    const c2=fixture(id);c2.gameContext!.constellation=2;blocked(c2);
    const group=fixture(id);if(group.hits[0]!.kind!=="ordinary")throw Error("ordinary");group.hits[0]!.groupMultiplier=2;blocked(group);
    const extra=fixture(id);extra.hits.push({...extra.hits[0]!,id:"invented-extra-contact"});extra.selectedHitIds.push("invented-extra-contact");if(extra.scope==="single-hit")expect(()=>calculateDocument(extra)).toThrow(/Single Hit requires exactly one selected hit/);extra.scope="one-cast";blocked(extra);
  });
  it("cannon needs exactly20 points, real creation ATK when stacks nonzero and explicit included base",()=>{
    const id="kinich-scalespiker-cannon";
    for(const field of ["cannonPointsBeforeUse","a4Stacks","a4CreationAttack","includedA4BaseDamage"] as const){const doc=fixture(id);delete doc.gameContext!.kinichDamage![field];blocked(doc);}
    for(const points of [0,19]){const doc=fixture(id);doc.gameContext!.kinichDamage!.cannonPointsBeforeUse=points;blocked(doc);}
    for(const [stacks,atk] of [[0,0],[1,0],[1,1800],[2,1800]]){const doc=fixture(id);doc.gameContext!.kinichDamage!.a4Stacks=stacks!;doc.gameContext!.kinichDamage!.a4CreationAttack=atk!;if(stacks===0)delete doc.gameContext!.kinichDamage!.a4CreationAttack;numeric(doc,true,1,stacks!,atk!);}
    const unknown=fixture(id);delete unknown.gameContext!.ascension;if(unknown.build.mode==="manual-final")delete unknown.build.ascension;blocked(unknown);
    const locked=fixture(id);locked.gameContext!.ascension=3;if(locked.build.mode==="manual-final")locked.build.ascension=3;blocked(locked);delete locked.gameContext!.kinichDamage!.a4Stacks;delete locked.gameContext!.kinichDamage!.a4CreationAttack;numeric(locked,true,1,0,0);delete locked.gameContext!.kinichDamage!.includedA4BaseDamage;blocked(locked);
  });
  it("C1 cannon and A4 included shares are restored once, never given to loop shots",()=>{
    const doc=fixture("kinich-scalespiker-cannon");doc.gameContext!.constellation=1;numeric(doc,true,1,2,1800,true);delete doc.gameContext!.kinichDamage!.c1CritDamageIncluded;blocked(doc);
    doc.gameContext!.kinichDamage!.c1CritDamageIncluded=true;doc.gameContext!.kinichDamage!.includedA4BaseDamage=11520;if(doc.build.mode!=="manual-final"||doc.hits[0]!.kind!=="ordinary")throw Error("ordinary manual");doc.build.stats.critDamage=2;doc.hits[0]!.additiveBaseDamage=11520;numeric(doc,true,1,2,1800,true);
    for(const id of ["kinich-loop-shot-single","kinich-loop-shot-pair"]){const loop=fixture(id);loop.gameContext!.constellation=1;loop.gameContext!.kinichDamage!.a4CreationAttack=99999;numeric(loop,false,id.endsWith("pair")?2:1);}
  });
  it("pair totals require both actual contacts/stability, selected one retains only its own qualification",()=>{
    for(const field of ["bothLoopHitsConnected","statsStableAcrossHits"] as const)for(const value of [undefined,false]){const doc=fixture("kinich-loop-shot-pair");if(value===undefined)delete doc.gameContext!.kinichDamage![field];else doc.gameContext!.kinichDamage![field]=value;blocked(doc);doc.scope="single-hit";doc.selectedHitIds=[doc.hits[1]!.id];numeric(doc,false);}
  });
});

describe("Chasca observed Q bullet order",()=>{
  const id="periodic-ordinary-chasca-burst-c0";
  const fixture=()=>{
    const doc=getCharacterDocuments("character:10000104",1).find(row=>row.gameContext?.skillId===id)!;
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.ascension=6;
    doc.build={mode:"manual-final",ascension:6,stats:{atk:2000,hp:20000,def:800,em:20,critRate:.5,critDamage:1},source:"Explicit stable panel and observed Q bullet order"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.reaction="none";}
    doc.gameContext!.periodicOrdinaryCast={casterId:"owner",targetId:"enemy",freshCastConfirmed:true,noHitlag:true,noInterruption:true,noReplacement:true,fullObservedLifetime:true,observedThroughFrame:160,statsStableAcrossHits:true,
      targetContacts:{initial:true,"bullet-1":true,"bullet-2":true,"bullet-3":true,"bullet-4":true,"bullet-5":true,"bullet-6":true},
      chasca:{onlyOneEnemy:true,nightsoulInactive:true,noNightsoulBurst:true,partyElements:["pyro","hydro"],bulletElements:["pyro","hydro","hydro","pyro","anemo","anemo"]}};
    return doc;
  };
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  // Pinned periodic-ordinary-casts definitions: Q1 initial .88, Anemo 1.034, each converted element 2.068.
  const numeric=(doc:CalculatorDocument,coefficients:readonly number[])=>{const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(coefficients.length);r.hits.forEach((hit,index)=>expect(hit.nonCritical).toBeCloseTo(2000*coefficients[index]!*.5*.9,8));expect(r.totals?.expected).toBeCloseTo(coefficients.reduce((a,b)=>a+b,0)*2000*.5*.9*1.5,8);};
  it("pins the exact default blockers and independent seven-contact Q1 oracle",()=>{
    const r=calculateDocument(getCharacterDocuments("character:10000104",10).find(row=>row.gameContext?.skillId===id)!);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(6);expect([...new Set(r.blockers.map(reason=>reason.split(":")[0]))]).toEqual(["periodic-ordinary"]);
    const doc=fixture(),prepared=prepareSourceCastDocument(doc);
    expect(prepared.hits.map(hit=>hit.kind==="ordinary"?hit.periodicOrdinaryEvent?.frame:undefined)).toEqual([96,103,139,147,153,157,160]);
    expect(prepared.hits.map(hit=>hit.kind==="ordinary"?hit.periodicOrdinaryEvent?.snapshotFrame:undefined)).toEqual([96,103,139,147,153,157,160]);
    expect(prepared.hits.map(hit=>hit.kind==="ordinary"?hit.element:undefined)).toEqual(["anemo","pyro","hydro","hydro","pyro","anemo","anemo"]);
    numeric(doc,[.88,2.068,2.068,2.068,2.068,1.034,1.034]);
  });
  it("requires actual common conditions and all three branch confirmations",()=>{
    for(const field of ["casterId","targetId","freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","observedThroughFrame","statsStableAcrossHits","targetContacts","chasca"] as const){const doc=fixture();delete doc.gameContext!.periodicOrdinaryCast![field];blocked(doc);}
    for(const field of ["freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","statsStableAcrossHits"] as const){const doc=fixture();doc.gameContext!.periodicOrdinaryCast![field]=false;blocked(doc);}
    for(const field of ["onlyOneEnemy","nightsoulInactive","noNightsoulBurst"] as const)for(const value of [undefined,false]){const doc=fixture();if(value===undefined)delete doc.gameContext!.periodicOrdinaryCast!.chasca![field];else doc.gameContext!.periodicOrdinaryCast!.chasca![field]=value;blocked(doc);}
    for(const field of ["partyElements","bulletElements"] as const){const doc=fixture();delete doc.gameContext!.periodicOrdinaryCast!.chasca![field];blocked(doc);}
    const c1=fixture();c1.gameContext!.constellation=1;blocked(c1);
  });
  it("counts each party member and validates the converted prefix rather than an average element",()=>{
    const reordered=fixture();reordered.gameContext!.periodicOrdinaryCast!.chasca!.bulletElements=["hydro","pyro","pyro","hydro","anemo","anemo"];numeric(reordered,[.88,2.068,2.068,2.068,2.068,1.034,1.034]);
    const duplicate=fixture();duplicate.gameContext!.periodicOrdinaryCast!.chasca!.partyElements=["pyro","pyro"];duplicate.gameContext!.periodicOrdinaryCast!.chasca!.bulletElements=["pyro","pyro","pyro","pyro","anemo","anemo"];numeric(duplicate,[.88,2.068,2.068,2.068,2.068,1.034,1.034]);
    const empty=fixture();empty.gameContext!.periodicOrdinaryCast!.chasca!.partyElements=[];empty.gameContext!.periodicOrdinaryCast!.chasca!.bulletElements=["anemo","anemo","anemo","anemo","anemo","anemo"];numeric(empty,[.88,1.034,1.034,1.034,1.034,1.034,1.034]);
    const wrongPrefix=fixture();wrongPrefix.gameContext!.periodicOrdinaryCast!.chasca!.bulletElements=["anemo","hydro","hydro","pyro","pyro","anemo"];blocked(wrongPrefix);
    const wrongElement=fixture();wrongElement.gameContext!.periodicOrdinaryCast!.chasca!.bulletElements![0]="cryo";blocked(wrongElement);
    const wrongLength=fixture();wrongLength.gameContext!.periodicOrdinaryCast!.chasca!.bulletElements!.pop();const parsed=calculatorDocumentSchema.safeParse(wrongLength);expect(parsed.success).toBe(false);if(!parsed.success)expect(parsed.error.issues).toEqual([expect.objectContaining({code:"too_small",minimum:6,path:["gameContext","periodicOrdinaryCast","chasca","bulletElements"]})]);expect(()=>calculateDocument(wrongLength)).toThrow();
  });
  it("distinguishes an unknown final contact from a recorded miss without shortening observation",()=>{
    const unknown=fixture();delete unknown.gameContext!.periodicOrdinaryCast!.targetContacts!["bullet-6"];blocked(unknown);
    const miss=fixture();miss.gameContext!.periodicOrdinaryCast!.targetContacts!["bullet-6"]=false;numeric(miss,[.88,2.068,2.068,2.068,2.068,1.034]);miss.gameContext!.periodicOrdinaryCast!.observedThroughFrame=159;blocked(miss);
  });
});

describe("Iansan actual Swift with inactive Q",()=>{
  const id="iansan-swift-resolved-c0";
  const fixture=()=>{
    const doc=getCharacterDocuments("character:10000110",1).find(row=>row.gameContext?.skillId===id)!;
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.ascension=6;
    doc.build={mode:"manual-final",ascension:6,stats:{atk:2000,hp:20000,def:800,em:20,critRate:.5,critDamage:1},source:"Actual fast-window Swift, Q inactive and no prior A1"};doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.reaction="none";}
    doc.gameContext!.iansanSwiftResolvedCast={casterId:"owner",targetId:"enemy",freshCastConfirmed:true,noHitlag:true,noInterruption:true,noReplacement:true,fullObservedLifetime:true,observedThroughFrame:25,statsStableAcrossHits:true,inputKind:"normal",actionReadyConfirmed:true,groundedAtCast:true,fastSkillActiveAtCast:true,targetContacts:{swift:true},sharedState:{a1ActiveAtSnapshot:false,includedA1Attack:0,burstInactiveAtSnapshot:true}};
    return doc;
  };
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  // Pinned combat1 param5 NA1 .84194, independently corroborated by the original horizontal-source oracle.
  const numeric=(doc:CalculatorDocument,atk=2000)=>{const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(1);expect(r.totals?.nonCritical).toBeCloseTo(atk*.84194*.5*.9,8);expect(r.totals?.expected).toBeCloseTo(atk*.84194*.5*.9*1.5,8);};
  it("pins one default blocker and the NA1, not E, coefficient at actual frame25",()=>{
    const r=calculateDocument(getCharacterDocuments("character:10000110",10).find(row=>row.gameContext?.skillId===id)!);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(1);expect([...new Set(r.blockers.map(reason=>reason.split(":")[0]))]).toEqual(["iansan-swift-resolved"]);
    const doc=fixture(),prepared=prepareSourceCastDocument(doc);expect(prepared.hits[0]).toMatchObject({kind:"ordinary",element:"electro",attackTag:"charged",terms:[{stat:"atk",coefficient:.84194}],iansanSwiftResolvedEvent:{candidateId:"swift",frame:25,snapshotFrame:25,snapshotId:"snapshot-25",targetId:"enemy"}});numeric(doc);
    const wrong=fixture();wrong.gameContext!.abilityId="talent:iansan:combat2";blocked(wrong);
  });
  it("requires actual action qualification and recorded contact, not inferred continuing Nightsoul",()=>{
    for(const field of ["casterId","targetId","freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","observedThroughFrame","statsStableAcrossHits","inputKind","actionReadyConfirmed","groundedAtCast","fastSkillActiveAtCast","targetContacts"] as const){const doc=fixture();delete doc.gameContext!.iansanSwiftResolvedCast![field];blocked(doc);}
    for(const field of ["freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","statsStableAcrossHits","actionReadyConfirmed","groundedAtCast","fastSkillActiveAtCast"] as const){const doc=fixture();doc.gameContext!.iansanSwiftResolvedCast![field]=false;blocked(doc);}
    const noNightsoul=fixture();noNightsoul.gameContext!.iansanSwiftResolvedCast!.nightsoulBlessingAtCast=false;numeric(noNightsoul);
    const short=fixture();short.gameContext!.iansanSwiftResolvedCast!.observedThroughFrame=24;blocked(short);
    const miss=fixture();miss.gameContext!.iansanSwiftResolvedCast!.targetContacts!.swift=false;const r=calculateDocument(miss);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits[0]?.status).toBe("non-damaging");expect(r.totals).toBeUndefined();miss.gameContext!.iansanSwiftResolvedCast!.observedThroughFrame=24;blocked(miss);
  });
  it("does not retroactively give this hit its new A1 or invent inactive-Q update operands",()=>{
    for(const field of ["a1ActiveAtSnapshot","includedA1Attack","burstInactiveAtSnapshot"] as const){const doc=fixture();delete doc.gameContext!.iansanSwiftResolvedCast!.sharedState![field];blocked(doc);}
    const unknown=fixture();delete unknown.gameContext!.ascension;if(unknown.build.mode==="manual-final")delete unknown.build.ascension;blocked(unknown);
    const active=fixture();active.gameContext!.iansanSwiftResolvedCast!.sharedState!.a1ActiveAtSnapshot=true;blocked(active);active.gameContext!.iansanSwiftResolvedCast!.sharedState!.baseAttack=800;numeric(active,2160);
    active.gameContext!.iansanSwiftResolvedCast!.sharedState!.includedA1Attack=160;if(active.build.mode!=="manual-final")throw Error("manual");active.build.stats.atk=2160;numeric(active,2160);
    const stale=fixture();stale.gameContext!.iansanSwiftResolvedCast!.sharedState!.includedA1Attack=160;if(stale.build.mode!=="manual-final")throw Error("manual");stale.build.stats.atk=2160;numeric(stale);
    const locked=fixture();locked.gameContext!.ascension=0;if(locked.build.mode==="manual-final")locked.build.ascension=0;delete locked.gameContext!.iansanSwiftResolvedCast!.sharedState!.a1ActiveAtSnapshot;numeric(locked);locked.gameContext!.iansanSwiftResolvedCast!.sharedState!.a1ActiveAtSnapshot=true;blocked(locked);
    const qUnknown=fixture();qUnknown.gameContext!.iansanSwiftResolvedCast!.sharedState!.burstInactiveAtSnapshot=false;blocked(qUnknown);
    const c1=fixture();c1.gameContext!.constellation=1;numeric(c1);
  });
  it("an actual selected Swift needs its own qualification but no future full-action records",()=>{
    const doc=fixture();doc.scope="single-hit";doc.gameContext!.iansanSwiftResolvedCast={sharedState:{swiftQualifiedAtCast:true,a1ActiveAtSnapshot:false,includedA1Attack:0,burstInactiveAtSnapshot:true}};numeric(doc);delete doc.gameContext!.iansanSwiftResolvedCast.sharedState!.swiftQualifiedAtCast;blocked(doc);
  });
});

describe("Ifa observed shots with explicit manual end",()=>{
  const id="extended-ifa-skill-c0";
  const fixture=()=>{
    const doc=getCharacterDocuments("character:10000113",1).find(row=>row.gameContext?.skillId===id)!;
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.ascension=6;
    doc.build={mode:"manual-final",ascension:6,stats:{atk:2000,hp:20000,def:800,em:200,critRate:.5,critDamage:1},source:"Observed three-shot sequence and manual end, not maximum natural lifetime"};doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.reaction="none";}
    doc.gameContext!.extendedStanceCast={casterId:"ifa",targetId:"enemy",freshCastConfirmed:true,noHitlag:true,noInterruption:true,noReplacement:true,fullObservedLifetime:true,observedThroughFrame:244,statsStableAcrossHits:true,ifa:{noExternalNightsoulChanges:true,noUnlistedActions:true},followupActions:[
      {id:"tap1",frame:31,actorId:"ifa",kind:"normal",travelFrames:8,attackSpeedBonus:0},
      {id:"tap2",frame:85,actorId:"ifa",kind:"normal",travelFrames:10,attackSpeedBonus:0},
      {id:"hold1",frame:127,actorId:"ifa",kind:"charged",travelFrames:6,attackSpeedBonus:0},
      {id:"end",frame:200,actorId:"ifa",kind:"skill"}],targetContacts:{"tap1:shot":true,"tap2:shot":true,"hold1:shot":true},sharedState:{ifaA4Active:false,includedElementalMastery:0},hitStates:{[`${id}:tap2:shot`]:{ifaA4Active:true},[`${id}:hold1:shot`]:{ifaA4Active:true}}};
    return doc;
  };
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  // Independent E1 coefficient from pinned extended-stance definitions and original remaining-source-batch oracle.
  const numeric=(doc:CalculatorDocument,ems:readonly number[]=[200,280,280],a4Unlocked=true)=>{const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(ems.length);r.hits.forEach((hit,i)=>{expect(hit.nonCritical).toBeCloseTo(2000*1.3336*.5*.9,8);if(a4Unlocked)expect(hit.trace.find(node=>node.id==="hitElementalMastery")?.result?.value).toBe(ems[i]);else {expect(hit.trace.find(node=>node.id==="hitElementalMastery")).toBeUndefined();expect(hit.trace.find(node=>node.id==="sourceElementalMasteryAdjustment")).toBeUndefined();}});expect(r.totals?.expected).toBeCloseTo(ems.length*2000*1.3336*.5*.9*1.5,8);};
  it("pins the default and actual E1 shot chronology, with impact rather than launch snapshots",()=>{
    const r=calculateDocument(getCharacterDocuments("character:10000113",10).find(row=>row.gameContext?.skillId===id)!);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(1);expect([...new Set(r.blockers.map(reason=>reason.split(":")[0]))]).toEqual(["extended-stance"]);
    const doc=fixture(),prepared=prepareSourceCastDocument(doc);expect(prepared.hits.map(hit=>hit.kind==="ordinary"?hit.extendedStanceEvent?.frame:undefined)).toEqual([42,98,134]);expect(prepared.hits.map(hit=>hit.kind==="ordinary"?hit.extendedStanceEvent?.snapshotFrame:undefined)).toEqual([42,98,134]);expect(prepared.hits.map(hit=>hit.kind==="ordinary"?hit.extendedStanceEvent?.launchFrame:undefined)).toEqual([34,88,128]);expect(prepared.hits.map(hit=>hit.kind==="ordinary"?hit.attackTag:undefined)).toEqual(["normal","normal","normal"]);numeric(doc);
  });
  it("requires complete actual action records, speed and travel instead of assuming zero",()=>{
    for(const field of ["casterId","targetId","freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","observedThroughFrame","statsStableAcrossHits","followupActions","targetContacts","ifa"] as const){const doc=fixture();delete doc.gameContext!.extendedStanceCast![field];blocked(doc);}
    for(const field of ["freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","statsStableAcrossHits"] as const){const doc=fixture();doc.gameContext!.extendedStanceCast![field]=false;blocked(doc);}
    for(const field of ["noExternalNightsoulChanges","noUnlistedActions"] as const)for(const value of [undefined,false]){const doc=fixture();if(value===undefined)delete doc.gameContext!.extendedStanceCast!.ifa![field];else doc.gameContext!.extendedStanceCast!.ifa![field]=value;blocked(doc);}
    for(const field of ["travelFrames","attackSpeedBonus"] as const){const doc=fixture();delete doc.gameContext!.extendedStanceCast!.followupActions![0]![field];blocked(doc);}
    for(const [index,early] of [[0,30],[1,84],[2,126]]){const doc=fixture();doc.gameContext!.extendedStanceCast!.followupActions![index!]!.frame=early!;blocked(doc);}
    const actor=fixture();actor.gameContext!.extendedStanceCast!.followupActions![1]!.actorId="other";blocked(actor);
    const c1=fixture();c1.gameContext!.constellation=1;blocked(c1);
  });
  it("retains manual-end tail244 after a known miss, distinguishing unknown contact",()=>{
    const unknown=fixture();delete unknown.gameContext!.extendedStanceCast!.targetContacts!["hold1:shot"];blocked(unknown);
    const miss=fixture();miss.gameContext!.extendedStanceCast!.targetContacts!["hold1:shot"]=false;numeric(miss,[200,280]);miss.gameContext!.extendedStanceCast!.observedThroughFrame=243;blocked(miss);
    const short=fixture();short.gameContext!.extendedStanceCast!.observedThroughFrame=134;blocked(short);
  });
  it("pins actual per-hit A4 EM and subtracts included80 once without changing ordinary damage",()=>{
    for(const field of ["ifaA4Active","includedElementalMastery"] as const){const doc=fixture();delete doc.gameContext!.extendedStanceCast!.sharedState![field];blocked(doc);}
    const included=fixture();if(included.build.mode!=="manual-final")throw Error("manual");included.build.stats.em=280;included.gameContext!.extendedStanceCast!.sharedState!.includedElementalMastery=80;numeric(included);
    const unknown=fixture();delete unknown.gameContext!.ascension;if(unknown.build.mode==="manual-final")delete unknown.build.ascension;blocked(unknown);
    const locked=fixture();locked.gameContext!.ascension=3;if(locked.build.mode==="manual-final")locked.build.ascension=3;delete locked.gameContext!.extendedStanceCast!.sharedState;delete locked.gameContext!.extendedStanceCast!.hitStates;const prepared=prepareSourceCastDocument(locked);for(const hit of prepared.hits){expect(hit.kind).toBe("ordinary");if(hit.kind==="ordinary")expect(hit.elementalMasteryAdjustment).toBeUndefined();}numeric(locked,[200,200,200],false);
  });
});


describe("Ineffa observed ordinary E without Lunar field or prior Q", () => {
  const id = "periodic-ordinary-ineffa-skill-no-lunar-c0";
  const frames = [26, 110, 229, 348, 467, 586, 705, 824, 943, 1062, 1181] as const;
  const coefficients = [.864, .96, .96, .96, .96, .96, .96, .96, .96, .96, .96] as const;
  const fixture = () => {
    const doc = getCharacterDocuments("character:10000116", 1).find(row => row.gameContext?.skillId === id)!;
    doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
    doc.gameContext!.ascension = 6;
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 200, critRate: .5, critDamage: 1 }, source: "Explicit observed ordinary Birgitta contacts, no Lunar field and no Q A4 conversion" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
    doc.gameContext!.periodicOrdinaryCast = {
      casterId: "ineffa", targetId: "enemy", freshCastConfirmed: true, noHitlag: true,
      noInterruption: true, noReplacement: true, fullObservedLifetime: true,
      observedThroughFrame: 1268, statsStableAcrossHits: true,
      ineffa: { noLunarChargedField: true, burstInactive: true },
      targetContacts: { initial: true, "discharge-1": true, "discharge-2": true, "discharge-3": true,
        "discharge-4": true, "discharge-5": true, "discharge-6": true, "discharge-7": true,
        "discharge-8": true, "discharge-9": true, "discharge-10": true },
    };
    return doc;
  };
  const blocked = (doc: CalculatorDocument) => { const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); };
  // Independently pinned combat2 E1 .864 initial/.96 discharge; no inferred Lunar/A4 damage.
  const numeric = (doc: CalculatorDocument, values: readonly number[] = coefficients) => {
    const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]);
    expect(result.hits).toHaveLength(values.length);
    result.hits.forEach((hit, index) => expect(hit.nonCritical).toBeCloseTo(2000 * values[index]! * .5 * .9, 8));
    expect(result.totals?.expected).toBeCloseTo(values.reduce((sum, value) => sum + 2000 * value * .5 * .9 * 1.5, 0), 8);
  };
  it("pins the exact default and eleven independent E1 contact samples", () => {
    const result = calculateDocument(getCharacterDocuments("character:10000116", 10).find(row => row.gameContext?.skillId === id)!);
    expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined();
    expect(result.blockers).toHaveLength(DEFAULT_CONTEXT_CONTRACTS[id].defaultBlockerCount);
    expect([...new Set(result.blockers.map(reason => reason.split(":")[0]))]).toEqual(["periodic-ordinary"]);
    const doc = fixture(), prepared = prepareSourceCastDocument(doc);
    expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.periodicOrdinaryEvent?.frame : undefined)).toEqual(frames);
    expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.periodicOrdinaryEvent?.snapshotFrame : undefined)).toEqual(frames);
    expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.attackTag : undefined)).toEqual(Array(11).fill("skill"));
    numeric(doc);
  });
  it("requires explicit complete observation, contacts and both ordinary-branch exclusions", () => {
    for (const field of ["casterId", "targetId", "freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "observedThroughFrame", "statsStableAcrossHits", "targetContacts", "ineffa"] as const) {
      const doc = fixture(); delete doc.gameContext!.periodicOrdinaryCast![field]; blocked(doc);
    }
    for (const field of ["freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits"] as const) {
      const doc = fixture(); doc.gameContext!.periodicOrdinaryCast![field] = false; blocked(doc);
    }
    for (const field of ["noLunarChargedField", "burstInactive"] as const) for (const value of [undefined, false]) {
      const doc = fixture(); if (value === undefined) delete doc.gameContext!.periodicOrdinaryCast!.ineffa![field];
      else doc.gameContext!.periodicOrdinaryCast!.ineffa![field] = value; blocked(doc);
    }
    const c1 = fixture(); c1.gameContext!.constellation = 1; blocked(c1);
  });
  it("distinguishes a known final miss from unknown contact and retains full1268 lifetime", () => {
    const unknown = fixture(); delete unknown.gameContext!.periodicOrdinaryCast!.targetContacts!["discharge-10"]; blocked(unknown);
    const miss = fixture(); miss.gameContext!.periodicOrdinaryCast!.targetContacts!["discharge-10"] = false;
    numeric(miss, [.864, .96, .96, .96, .96, .96, .96, .96, .96, .96]);
    miss.gameContext!.periodicOrdinaryCast!.observedThroughFrame = 1267; blocked(miss);
    const lastContactOnly = fixture(); lastContactOnly.gameContext!.periodicOrdinaryCast!.observedThroughFrame = 1181; blocked(lastContactOnly);
  });
  it("keeps selected occurred initial or discharge independent of future schedule, but requires actual inactive A4", () => {
    for (const [index, coefficient] of [[0, .864], [1, .96]] as const) {
      const doc = prepareSourceCastDocument(fixture()); doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[index]!.id];
      doc.gameContext!.periodicOrdinaryCast = { sharedState: { ineffaA4Inactive: true } }; numeric(doc, [coefficient]);
      delete doc.gameContext!.ascension; if (doc.build.mode === "manual-final") delete doc.build.ascension;
      numeric(doc, [coefficient]); // This inactive branch does not invent a separate ASC prerequisite.
      doc.gameContext!.periodicOrdinaryCast = {}; blocked(doc);
      doc.gameContext!.periodicOrdinaryCast = { sharedState: { ineffaA4Inactive: false } }; blocked(doc);
      doc.gameContext!.periodicOrdinaryCast = { ineffa: { burstInactive: true } }; numeric(doc, [coefficient]);
      doc.gameContext!.periodicOrdinaryCast = { ineffa: { burstInactive: false } }; blocked(doc);
    }
  });
});


describe("Manekin first normal raw uninfused state contract", () => {
  const id = "manekin-normal-1-raw-base";
  const completeState = { actualHitConfirmed: true, talentLevelObserved: true, wholeActionObserved: true,
    infusionInactive: true, burstInactive: true, noExternalInfusion: true, noAdditionalCharacterDamage: true };
  const actualFields = ["actualHitConfirmed", "talentLevelObserved", "infusionInactive", "burstInactive", "noExternalInfusion"] as const;
  const fixture = (level: number) => {
    const doc = getCharacterDocuments("character:10000117", level).find(row => row.gameContext?.skillId === id)!;
    doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
    doc.gameContext!.constellation = 0;
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 1000, hp: 10000, def: 700, em: 0, critRate: .2, critDamage: 1.5 }, source: "Explicit hypothetical raw-source state, not independently measured gameplay" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    doc.gameContext!.rawSourceState = { sharedState: { ...completeState } };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.additiveBaseDamage = 0; hit.reaction = "none"; hit.reactionBonus = 0; hit.groupMultiplier = 1; }
    return doc;
  };
  const blocked = (doc: CalculatorDocument) => { const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); };
  // Fixed b061b403 ProudSkillGroup11731 literals, also retained by the original
  // raw-source suite. Arithmetic is independent; underlying data stays single-source extracted.
  const numeric = (doc: CalculatorDocument, coefficient: number) => {
    const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.verification).toBe("provisional"); expect(result.blockers).toEqual([]); expect(result.hits).toHaveLength(1);
    expect(result.totals?.nonCritical).toBeCloseTo(450 * coefficient, 8);
    expect(result.totals?.critical).toBeCloseTo(1125 * coefficient, 8);
    expect(result.totals?.expected).toBeCloseTo(585 * coefficient, 8);
  };
  it("pins the exact default and independently evaluates observed level1/10 raw coefficients", () => {
    const original = getCharacterDocuments("character:10000117", 10).find(row => row.gameContext?.skillId === id)!;
    expect(original.gameContext!.rawSourceState).toBeUndefined();
    const result = calculateDocument(original); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined();
    expect(result.blockers).toHaveLength(DEFAULT_CONTEXT_CONTRACTS[id].defaultBlockerCount);
    expect([...new Set(result.blockers.map(reason => reason.split(":")[0]))]).toEqual(["raw-source-state"]);
    numeric(fixture(1), .517995); numeric(fixture(10), 1.023944);
  });
  it("requires every explicit complete state and rejects contradictory or foreign source identity", () => {
    for (const field of Object.keys(completeState)) for (const value of [undefined, false]) {
      const doc = fixture(10); if (value === undefined) delete doc.gameContext!.rawSourceState!.sharedState![field];
      else doc.gameContext!.rawSourceState!.sharedState![field] = value; blocked(doc);
    }
    const missing = fixture(10); delete missing.gameContext!.rawSourceState; blocked(missing);
    const c1 = fixture(10); c1.gameContext!.constellation = 1; blocked(c1);
    const other = fixture(10); other.gameContext!.characterId = "character:10000118"; blocked(other);
    const wrongTalent = fixture(10); wrongTalent.gameContext!.abilityId = "talent:manekin:combat2"; blocked(wrongTalent);
    const forged = fixture(10); forged.hits[0]!.id = "unreviewed-hit"; forged.selectedHitIds = ["unreviewed-hit"]; blocked(forged);
  });
  it("allows one already occurred hit without whole-action promises while retaining all actual-hit qualifications", () => {
    const doc = fixture(10); doc.scope = "single-hit";
    delete doc.gameContext!.rawSourceState!.sharedState!.wholeActionObserved;
    delete doc.gameContext!.rawSourceState!.sharedState!.noAdditionalCharacterDamage;
    numeric(doc, 1.023944);
    for (const field of actualFields) for (const value of [undefined, false]) {
      const invalid = structuredClone(doc); if (value === undefined) delete invalid.gameContext!.rawSourceState!.sharedState![field];
      else invalid.gameContext!.rawSourceState!.sharedState![field] = value; blocked(invalid);
    }
  });
});


describe("exact raw-source family default registrations", () => {
  it("registers only the independently authored 44 source identities", () => {
    expect(rawSourceCases).toHaveLength(44);
    expect(new Set(rawSourceCases.map(([, id]) => id)).size).toBe(44);
    expect(Object.entries(DEFAULT_CONTEXT_CONTRACTS).filter(([, contract]) => contract.family === "raw-source-explicit-state").map(([id]) => id).sort())
      .toEqual(rawSourceCases.map(([, id]) => id).sort());
    expect(defaultContextContract("manekin-unreviewed-raw-base")).toBeUndefined();
    expect(defaultContextContract("vesna-normal-7-base-c0")).toBeUndefined();
  });
  it.each(rawSourceCases)("keeps %s / %s explicitly blocked at both source levels", (characterId, id, count) => {
    expect(DEFAULT_CONTEXT_CONTRACTS[id]).toEqual({ family: "raw-source-explicit-state", blockerPrefixes: ["raw-source-state"], defaultBlockerCount: count });
    for (const level of [1, 10]) {
      const doc = getCharacterDocuments(characterId, level).find(row => row.gameContext?.skillId === id);
      expect(doc, id).toBeDefined();
      expect(doc!.gameContext!.rawSourceState).toBeUndefined();
      const result = calculateDocument(doc!);
      expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined();
      expect(result.blockers).toHaveLength(count);
      expect([...new Set(result.blockers.map(reason => reason.split(":")[0]))]).toEqual(["raw-source-state"]);
    }
  });
});

describe("Lauma explicit mixed hold-source contract", () => {
  const id = "mixed-lauma-hold-skill-c0";
  const frames = [45, 45, 62, 179, 296, 413, 530, 647, 764, 881];
  const fixture = () => {
    const doc = getCharacterDocuments("character:10000119", 1).find(row => row.gameContext?.skillId === id)!;
    doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
    doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 200, critRate: .5, critDamage: 1 }, source: "Explicit hypothetical mixed-source samples, not automatic Lunar eligibility" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.additiveBaseDamage = 0; hit.reaction = "none"; }
    doc.gameContext!.mixedSourceCast = {
      casterId: "lauma", targetId: "enemy", noHitlag: true, noInterruption: true, noReplacement: true,
      fullObservedLifetime: true, observedThroughFrame: 1482, statsStableAcrossHits: true, moonsignLevel: 2,
      lauma: { initialDew: 2, dewHistoryComplete: true, dewEvents: [], burstInactive: true, noPriorShred: true, initializationEm: 50, noOtherMoonSongRefresh: true },
      targetContacts: { hold: true, "lunar-bloom": true, "sanctuary-1": true, "sanctuary-2": true, "sanctuary-3": true, "sanctuary-4": true, "sanctuary-5": true, "sanctuary-6": true, "sanctuary-7": true, "sanctuary-8": true },
      sharedState: { includedDamageBonus: 0, includedResistanceReduction: 0, includedLaumaA1CritRate: 0, includedLaumaA1CritDamage: 0, otherSpecialBaseBonus: 0, otherReactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1 },
    };
    return doc;
  };
  const blocked = (doc: CalculatorDocument) => { const r = calculateDocument(doc); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); };
  // Pinned b4ae769 source: E1 hold1.5808 ATK, sanctuary .96 ATK+1.92 EM,
  // direct Lunar1.52 EM per actual Dew. Initialization EM50 gives ordinary A4 .2;
  // impact EM200 gives special base .035. E1 shred .025 applies only after contact.
  const ordinaryHold = 2000 * 1.5808 * 1.2 * .5 * .9;
  const sanctuary = (2000 * .96 + 200 * 1.92) * 1.2 * .5 * .925;
  const lunar = (dew: number) => 200 * 1.52 * dew * 1.035 * (1 + 6 * 200 / 2200) * .925;
  const numeric = (doc: CalculatorDocument, dew = 2, tail = 8) => {
    const r = calculateDocument(doc); expect(r.status).toBe("calculated"); expect(r.blockers).toEqual([]);
    expect(r.hits).toHaveLength(2 + tail);
    const perHit = [ordinaryHold, lunar(dew), ...Array(tail).fill(sanctuary)];
    r.hits.forEach((hit, index) => expect(hit.nonCritical, hit.id).toBeCloseTo(perHit[index]!, 8));
    expect(r.totals?.nonCritical).toBeCloseTo(ordinaryHold + sanctuary * tail + lunar(dew), 8);
    expect(r.totals?.critical).toBeCloseTo((ordinaryHold + sanctuary * tail) * 2 + lunar(dew) * 2.2, 8);
    expect(r.totals?.expected).toBeCloseTo((ordinaryHold + sanctuary * tail) * 1.5 + lunar(dew) * 1.72, 8);
    return r;
  };
  it("pins default representatives and independent ordinary/special arithmetic and chronology", () => {
    const r = calculateDocument(getCharacterDocuments("character:10000119", 10).find(row => row.gameContext?.skillId === id)!);
    expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); expect(r.blockers).toHaveLength(4);
    expect([...new Set(r.blockers.map(reason => reason.split(":")[0]))]).toEqual(["mixed-source"]);
    const prepared = prepareSourceCastDocument(fixture());
    expect(prepared.hits.map(hit => hit.kind === "ordinary" || hit.kind === "special" ? hit.mixedSourceEvent?.frame : undefined)).toEqual(frames);
    expect(prepared.hits.map(hit => hit.kind === "ordinary" || hit.kind === "special" ? hit.mixedSourceEvent?.snapshotFrame : undefined)).toEqual(frames);
    expect(prepared.hits.map(hit => hit.kind === "ordinary" || hit.kind === "special" ? hit.mixedSourceEvent?.laumaOwnShredActive : undefined)).toEqual([false, true, true, true, true, true, true, true, true, true]);
    numeric(fixture());
  });
  it("requires explicit history, passive samples and complete observation", () => {
    for (const field of ["casterId", "targetId", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "observedThroughFrame", "statsStableAcrossHits", "targetContacts", "moonsignLevel", "lauma", "sharedState"] as const) {
      const doc = fixture(); delete doc.gameContext!.mixedSourceCast![field]; blocked(doc);
    }
    for (const field of ["noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits"] as const) {
      const doc = fixture(); doc.gameContext!.mixedSourceCast![field] = false; blocked(doc);
    }
    for (const field of ["initialDew", "dewHistoryComplete", "dewEvents", "burstInactive", "noPriorShred", "initializationEm", "noOtherMoonSongRefresh"] as const) {
      const doc = fixture(); delete doc.gameContext!.mixedSourceCast!.lauma![field]; blocked(doc);
    }
    for (const field of ["dewHistoryComplete", "burstInactive", "noPriorShred", "noOtherMoonSongRefresh"] as const) {
      const doc = fixture(); doc.gameContext!.mixedSourceCast!.lauma![field] = false; blocked(doc);
    }
    for (const field of ["includedDamageBonus", "includedResistanceReduction", "includedLaumaA1CritRate", "includedLaumaA1CritDamage", "otherSpecialBaseBonus", "otherReactionBonus", "specialAdditive", "elevationMultiplier"] as const) {
      const doc = fixture(); delete doc.gameContext!.mixedSourceCast!.sharedState![field]; blocked(doc);
    }
    const asc = fixture(); delete asc.gameContext!.ascension; if (asc.build.mode === "manual-final") delete asc.build.ascension; blocked(asc);
    const c1 = fixture(); c1.gameContext!.constellation = 1; blocked(c1);
  });
  it("keeps resource order, known misses and all effect expiry separate", () => {
    const gain = fixture(); gain.gameContext!.mixedSourceCast!.lauma!.dewEvents = [{ id: "actual-gain", frame: 28, kind: "gain", amount: 1 }]; numeric(gain, 3);
    const consumed = fixture(); consumed.gameContext!.mixedSourceCast!.lauma!.dewEvents = [{ id: "actual-consume", frame: 28, kind: "consume", amount: 2 }]; numeric(consumed, 0);
    const tie = fixture(); tie.gameContext!.mixedSourceCast!.lauma!.dewEvents = [{ id: "ambiguous", frame: 29, kind: "gain", amount: 1 }]; blocked(tie);
    const overdraft = fixture(); overdraft.gameContext!.mixedSourceCast!.lauma!.dewEvents = [{ id: "overdraft", frame: 28, kind: "consume", amount: 3 }]; blocked(overdraft);
    const unknown = fixture(); delete unknown.gameContext!.mixedSourceCast!.targetContacts!["sanctuary-8"]; blocked(unknown);
    const miss = fixture(); miss.gameContext!.mixedSourceCast!.targetContacts!["sanctuary-8"] = false; numeric(miss, 2, 7);
    miss.gameContext!.mixedSourceCast!.observedThroughFrame = 1365; numeric(miss, 2, 7);
    miss.gameContext!.mixedSourceCast!.observedThroughFrame = 1364; blocked(miss);
    const expiry = fixture(); expiry.gameContext!.mixedSourceCast!.observedThroughFrame = 1481; blocked(expiry);
  });
});

describe("Lauma explicit ordinary press-source contract", () => {
  const id = "periodic-ordinary-lauma-skill-press-c0";
  const frames = [16, 62, 179, 296, 413, 530, 647, 764, 881];
  const fixture = () => {
    const doc = getCharacterDocuments("character:10000119", 1).find(row => row.gameContext?.skillId === id)!;
    doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
    doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 200, critRate: .5, critDamage: 1 }, source: "Explicit ordinary press samples; initialization EM is separately supplied" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.additiveBaseDamage = 0; hit.reaction = "none"; }
    doc.gameContext!.periodicOrdinaryCast = { casterId: "lauma", targetId: "enemy", freshCastConfirmed: true, noHitlag: true, noInterruption: true, noReplacement: true, fullObservedLifetime: true, observedThroughFrame: 900, statsStableAcrossHits: true,
      lauma: { noPriorShred: true, initializationEm: 50 }, sharedState: { includedDamageBonus: 0, includedResistanceReduction: 0 },
      targetContacts: { initial: true, "sanctuary-1": true, "sanctuary-2": true, "sanctuary-3": true, "sanctuary-4": true, "sanctuary-5": true, "sanctuary-6": true, "sanctuary-7": true, "sanctuary-8": true } };
    return doc;
  };
  const blocked = (doc: CalculatorDocument) => { const r = calculateDocument(doc); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); };
  // Independent E1 literals: initial1.216 ATK, sanctuary .96 ATK+1.92 EM.
  // Press protocol covers the field through900, not expiry of all later shred effects.
  const expected = (bonus = .2) => [2000 * 1.216 * (1 + bonus) * .5 * .9, ...Array(8).fill((2000 * .96 + 200 * 1.92) * (1 + bonus) * .5 * .925)];
  const numeric = (doc: CalculatorDocument, values = expected()) => {
    const r = calculateDocument(doc); expect(r.status).toBe("calculated"); expect(r.blockers).toEqual([]); expect(r.hits).toHaveLength(values.length);
    r.hits.forEach((hit, index) => expect(hit.nonCritical, hit.id).toBeCloseTo(values[index]!, 8));
    const sum = values.reduce((a, b) => a + b, 0); expect(r.totals?.nonCritical).toBeCloseTo(sum, 8); expect(r.totals?.critical).toBeCloseTo(sum * 2, 8); expect(r.totals?.expected).toBeCloseTo(sum * 1.5, 8);
  };
  it("pins two default roles and all nine literal impact/snapshot/passive samples", () => {
    const r = calculateDocument(getCharacterDocuments("character:10000119", 10).find(row => row.gameContext?.skillId === id)!);
    expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); expect(r.blockers).toHaveLength(4); expect([...new Set(r.blockers.map(reason => reason.split(":")[0]))]).toEqual(["periodic-ordinary"]);
    const p = prepareSourceCastDocument(fixture());
    expect(p.hits.map(h => h.kind === "ordinary" ? h.periodicOrdinaryEvent?.frame : undefined)).toEqual(frames);
    expect(p.hits.map(h => h.kind === "ordinary" ? h.periodicOrdinaryEvent?.snapshotFrame : undefined)).toEqual(frames);
    expect(p.hits.map(h => h.kind === "ordinary" ? h.periodicOrdinaryEvent?.laumaOwnShredActive : undefined)).toEqual([false, true, true, true, true, true, true, true, true]); numeric(fixture());
  });
  it("requires actual context and accounting without inventing current-EM initialization", () => {
    for (const field of ["casterId", "targetId", "freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "observedThroughFrame", "statsStableAcrossHits", "targetContacts", "lauma", "sharedState"] as const) { const d = fixture(); delete d.gameContext!.periodicOrdinaryCast![field]; blocked(d); }
    for (const field of ["freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits"] as const) { const d = fixture(); d.gameContext!.periodicOrdinaryCast![field] = false; blocked(d); }
    for (const field of ["noPriorShred", "initializationEm"] as const) { const d = fixture(); delete d.gameContext!.periodicOrdinaryCast!.lauma![field]; blocked(d); }
    const prior = fixture(); prior.gameContext!.periodicOrdinaryCast!.lauma!.noPriorShred = false; blocked(prior);
    for (const field of ["includedDamageBonus", "includedResistanceReduction"] as const) { const d = fixture(); delete d.gameContext!.periodicOrdinaryCast!.sharedState![field]; blocked(d); }
    const asc = fixture(); delete asc.gameContext!.ascension; if (asc.build.mode === "manual-final") delete asc.build.ascension; blocked(asc);
    const c1 = fixture(); c1.gameContext!.constellation = 1; blocked(c1);
    const zero = fixture(); zero.gameContext!.periodicOrdinaryCast!.lauma!.initializationEm = 0; numeric(zero, expected(0));
    const cap = fixture(); cap.gameContext!.periodicOrdinaryCast!.lauma!.initializationEm = 1000; numeric(cap, expected(.32));
    const lowAsc = fixture(); lowAsc.gameContext!.ascension = 3; if (lowAsc.build.mode === "manual-final") lowAsc.build.ascension = 3; delete lowAsc.gameContext!.periodicOrdinaryCast!.lauma!.initializationEm; numeric(lowAsc, expected(0));
    const included = fixture(); for (const h of included.hits) if (h.kind === "ordinary") h.damageBonus = .2;
    included.gameContext!.periodicOrdinaryCast!.sharedState = { includedDamageBonus: .2, includedResistanceReduction: .025 }; included.enemy.resistance = .075; numeric(included);
  });
  it("does not grant shred for a miss or truncate the complete field", () => {
    const unknown = fixture(); delete unknown.gameContext!.periodicOrdinaryCast!.targetContacts!.initial; blocked(unknown);
    const miss = fixture(); miss.gameContext!.periodicOrdinaryCast!.targetContacts!.initial = false;
    numeric(miss, [(2000 * .96 + 200 * 1.92) * 1.2 * .5 * .9, ...Array(7).fill((2000 * .96 + 200 * 1.92) * 1.2 * .5 * .925)]);
    const tail = fixture(); tail.gameContext!.periodicOrdinaryCast!.targetContacts!["sanctuary-8"] = false; numeric(tail, expected().slice(0, 8)); tail.gameContext!.periodicOrdinaryCast!.observedThroughFrame = 899; blocked(tail);
  });
});

describe("Flins explicit mixed burst-source contract", () => {
  const id = "mixed-flins-burst-c0";
  const fixture = () => {
    const doc = getCharacterDocuments("character:10000120", 1).find(row => row.gameContext?.skillId === id)!;
    doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
    doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 200, critRate: .5, critDamage: 1 }, source: "Explicit Q sample with independent non-Extra ATK and impact ATK" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.additiveBaseDamage = 0; hit.reaction = "none"; }
    doc.gameContext!.mixedSourceCast = { casterId: "flins", targetId: "enemy", noHitlag: true, noInterruption: true, noReplacement: true, fullObservedLifetime: true, observedThroughFrame: 164, statsStableAcrossHits: true, moonsignLevel: 2,
      flins: { symphonyInactive: true }, targetContacts: { initial: true, "middle-1": true, "middle-2": true, "middle-3": true, "middle-4": true, final: true },
      sharedState: { nonExtraAtk: 1000, includedFlinsA4Em: 0, impactAtk: 1000, otherSpecialBaseBonus: 0, otherReactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1 } };
    return doc;
  };
  const blocked = (doc: CalculatorDocument) => { const r = calculateDocument(doc); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); };
  // Q1 literals corroborated by unchanged remaining-source-batch.test.ts. That
  // original suite separately tests equipment conversion; this manual panel does not.
  const values = (em = 280, middle = 4, a1 = .2, base = .07, final = true) => [2000 * 2.5984 * .5 * .9,
    ...[...Array(middle).fill(.1624), ...(final ? [1.16928] : [])].map(coefficient => 3 * 2000 * coefficient * (1 + base) * (1 + 6 * em / (em + 2000) + a1) * .9)];
  const numeric = (doc: CalculatorDocument, expected = values()) => {
    const r = calculateDocument(doc); expect(r.status).toBe("calculated"); expect(r.blockers).toEqual([]); expect(r.hits).toHaveLength(expected.length);
    r.hits.forEach((hit, index) => expect(hit.nonCritical, hit.id).toBeCloseTo(expected[index]!, 8));
    const sum = expected.reduce((a, b) => a + b, 0); expect(r.totals?.nonCritical).toBeCloseTo(sum, 8); expect(r.totals?.critical).toBeCloseTo(sum * 2, 8); expect(r.totals?.expected).toBeCloseTo(sum * 1.5, 8);
  };
  it("pins default initial and independently separates Q talent, snapshot and impact samples", () => {
    const original = getCharacterDocuments("character:10000120", 10).find(row => row.gameContext?.skillId === id)!;
    expect(original.scope).toBe("single-hit"); expect(original.gameContext!.constellation).toBe(0);
    expect(original.selectedHitIds).toEqual(["mixed-flins-burst-c0-initial"]);
    const r = calculateDocument(original);
    expect(r.blockers.map(reason => reason.split("：")[0])).toEqual(["mixed-source:mixed-flins-burst-c0-initial"]);
    expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); expect(r.blockers).toHaveLength(1); expect([...new Set(r.blockers.map(reason => reason.split(":")[0]))]).toEqual(["mixed-source"]);
    const p = prepareSourceCastDocument(fixture()); expect(p.gameContext!.abilityId).toBe("talent:flins:combat3");
    expect(p.hits.map(h => h.kind === "ordinary" || h.kind === "special" ? h.mixedSourceEvent?.frame : undefined)).toEqual([93, 110, 119, 128, 137, 164]);
    expect(p.hits.map(h => h.kind === "ordinary" || h.kind === "special" ? h.mixedSourceEvent?.snapshotFrame : undefined)).toEqual([93, 93, 93, 93, 93, 93]); numeric(fixture());
    const moon1 = fixture(); moon1.gameContext!.mixedSourceCast!.moonsignLevel = 1; numeric(moon1, values(280, 2, 0));
  });
  it("rejects unknown full chronology, passive accounting and unsupported constellation", () => {
    for (const field of ["casterId", "targetId", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "observedThroughFrame", "statsStableAcrossHits", "targetContacts", "moonsignLevel", "flins", "sharedState"] as const) { const d = fixture(); delete d.gameContext!.mixedSourceCast![field]; blocked(d); }
    for (const field of ["noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits"] as const) { const d = fixture(); d.gameContext!.mixedSourceCast![field] = false; blocked(d); }
    const inactive = fixture(); delete inactive.gameContext!.mixedSourceCast!.flins!.symphonyInactive; blocked(inactive);
    inactive.gameContext!.mixedSourceCast!.flins!.symphonyInactive = false; blocked(inactive);
    for (const field of ["nonExtraAtk", "includedFlinsA4Em", "otherSpecialBaseBonus", "otherReactionBonus", "specialAdditive", "elevationMultiplier"] as const) { const d = fixture(); delete d.gameContext!.mixedSourceCast!.sharedState![field]; blocked(d); }
    const asc = fixture(); delete asc.gameContext!.ascension; if (asc.build.mode === "manual-final") delete asc.build.ascension; blocked(asc);
    const c1 = fixture(); c1.gameContext!.constellation = 1; blocked(c1);
  });
  it("keeps independent A4 and impact-base zero/cap/accounting cases", () => {
    const zero = fixture(); zero.gameContext!.mixedSourceCast!.sharedState!.nonExtraAtk = 0; numeric(zero, values(200));
    const cap = fixture(); cap.gameContext!.mixedSourceCast!.sharedState!.nonExtraAtk = 5000; numeric(cap, values(360));
    const included = fixture(); if (included.build.mode === "manual-final") included.build.stats.em = 280;
    included.gameContext!.mixedSourceCast!.sharedState!.includedFlinsA4Em = 80; numeric(included);
    const impactZero = fixture(); impactZero.gameContext!.mixedSourceCast!.sharedState!.impactAtk = 0; numeric(impactZero, values(280, 4, .2, 0));
    const impactCap = fixture(); impactCap.gameContext!.mixedSourceCast!.sharedState!.impactAtk = 10000; numeric(impactCap, values(280, 4, .2, .14));
    const asc3 = fixture(); asc3.gameContext!.ascension = 3; if (asc3.build.mode === "manual-final") asc3.build.ascension = 3;
    delete asc3.gameContext!.mixedSourceCast!.sharedState!.nonExtraAtk; delete asc3.gameContext!.mixedSourceCast!.sharedState!.includedFlinsA4Em; numeric(asc3, values(200));
  });
  it("distinguishes unknown final contact from a miss while retaining frame164 observation", () => {
    const unknown = fixture(); delete unknown.gameContext!.mixedSourceCast!.targetContacts!.final; blocked(unknown);
    const miss = fixture(); miss.gameContext!.mixedSourceCast!.targetContacts!.final = false; numeric(miss, values(280, 4, .2, .07, false));
    miss.gameContext!.mixedSourceCast!.observedThroughFrame = 163; blocked(miss);
  });
});

describe("Nefer explicit observed five-part phantasm contract", () => {
  const id = "nefer-phantasm-observed-c0";
  const fixture = () => {
    const doc = getCharacterDocuments("character:10000122", 1).find(row => row.gameContext?.skillId === id)!;
    doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
    doc.gameContext!.ascension = 1; doc.gameContext!.constellation = 0;
    doc.build = { mode: "manual-final", ascension: 1, stats: { atk: 1000, hp: 20000, def: 800, em: 100, critRate: 0, critDamage: 0 }, source: "Synthetic observed five-hit panel, not fixed animation timing or full Shadow Dance" };
    doc.enemy = { level: 90, resistance: 0, defenseAdjustment: 0, defenseIgnore: 0 };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.additiveBaseDamage = 0; hit.reaction = "none"; }
    doc.gameContext!.neferPhantasmCast = { casterId: "nefer", targetId: "enemy", phantasmOccurred: true, shadowDanceActiveAtAction: true, verdantDewBefore: 3, phantasmsUsedBefore: 1, firstShadeSummonFrame: 15,
      fullObservedLifetime: true, observedThroughFrame: 50, statsStableAcrossHits: true,
      // Authored observation only: source orders Nefer1→2 and Shade1→2→3 separately.
      observations: [
        { candidateId: "nefer1", templateRole: "nefer1", frame: 10, snapshotFrame: 10, snapshotId: "actual-nefer1", targetId: "enemy" },
        { candidateId: "shade1", templateRole: "shade1", frame: 20, snapshotFrame: 20, snapshotId: "actual-shade1", targetId: "enemy" },
        { candidateId: "nefer2", templateRole: "nefer2", frame: 30, snapshotFrame: 30, snapshotId: "actual-nefer2", targetId: "enemy" },
        { candidateId: "shade2", templateRole: "shade2", frame: 40, snapshotFrame: 40, snapshotId: "actual-shade2", targetId: "enemy" },
        { candidateId: "shade3", templateRole: "shade3", frame: 50, snapshotFrame: 50, snapshotId: "actual-shade3", targetId: "enemy" },
      ], targetContacts: { nefer1: true, shade1: true, nefer2: true, shade2: true, shade3: true },
      sharedState: { moonsignLevel: 2, veilStacks: 3, fullVeilEmBuffActive: true, includedFullVeilEm: 0, intrinsicEmMatchesSnapshot: true, specialBaseBonus: 0, includedIntrinsicBaseBonus: 0, reactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1 } };
    return doc;
  };
  const blocked = (doc: CalculatorDocument) => { const r = calculateDocument(doc); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); };
  // Same fixed E1 literals as the unchanged independent horizontal-source oracle.
  // These observations do not infer resource generation or a whole nine-second stance.
  const expected = (em = 200, veilFactor = 1.24, intrinsic = em) => {
    const lunar = (coefficient: number) => em * coefficient * veilFactor * (1 + Math.min(intrinsic * .000175, .14)) * (1 + 6 * em / (em + 2000));
    return [(1000 * .2464 + em * .4928) * veilFactor * .5, lunar(.96), (1000 * .32032 + em * .64064) * veilFactor * .5, lunar(.96), lunar(1.28)];
  };
  const numeric = (doc: CalculatorDocument, values = expected()) => {
    const r = calculateDocument(doc); expect(r.status).toBe("calculated"); expect(r.blockers).toEqual([]); expect(r.hits).toHaveLength(values.length);
    r.hits.forEach((hit, index) => expect(hit.expected, hit.id).toBeCloseTo(values[index]!, 8));
    expect(r.totals?.expected).toBeCloseTo(values.reduce((a, b) => a + b, 0), 8);
  };
  it("pins exact default dependencies and independently calculates the five observed roles", () => {
    const r = calculateDocument(getCharacterDocuments("character:10000122", 10).find(row => row.gameContext?.skillId === id)!);
    expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined();
    expect(r.blockers.map(reason => reason.split("：")[0]).sort()).toEqual(["nefer-phantasm:nefer-phantasm-observed-c0-nefer1", "nefer-phantasm:schedule"]);
    const p = prepareSourceCastDocument(fixture());
    expect(p.hits.map(h => h.kind === "ordinary" || h.kind === "special" ? h.neferPhantasmEvent?.templateRole : undefined)).toEqual(["nefer1", "shade1", "nefer2", "shade2", "shade3"]);
    expect(p.hits.map(h => h.kind === "ordinary" || h.kind === "special" ? h.neferPhantasmEvent?.snapshotFrame : undefined)).toEqual([10, 20, 30, 40, 50]); numeric(fixture());
  });
  it("requires actual five-hit observation, resources and independent passive state", () => {
    for (const field of ["casterId", "targetId", "phantasmOccurred", "shadowDanceActiveAtAction", "verdantDewBefore", "phantasmsUsedBefore", "firstShadeSummonFrame", "fullObservedLifetime", "observedThroughFrame", "statsStableAcrossHits", "observations", "targetContacts", "sharedState"] as const) { const d = fixture(); delete d.gameContext!.neferPhantasmCast![field]; blocked(d); }
    for (const field of ["phantasmOccurred", "shadowDanceActiveAtAction", "fullObservedLifetime", "statsStableAcrossHits"] as const) { const d = fixture(); d.gameContext!.neferPhantasmCast![field] = false; blocked(d); }
    for (const field of ["moonsignLevel", "veilStacks", "fullVeilEmBuffActive", "includedFullVeilEm", "intrinsicEmMatchesSnapshot", "specialBaseBonus", "includedIntrinsicBaseBonus", "reactionBonus", "specialAdditive", "elevationMultiplier"] as const) { const d = fixture(); delete d.gameContext!.neferPhantasmCast!.sharedState![field]; blocked(d); }
    const noDew = fixture(); noDew.gameContext!.neferPhantasmCast!.verdantDewBefore = 0; blocked(noDew);
    const exhausted = fixture(); exhausted.gameContext!.neferPhantasmCast!.phantasmsUsedBefore = 3; blocked(exhausted);
    const last = fixture(); last.gameContext!.neferPhantasmCast!.verdantDewBefore = 1; last.gameContext!.neferPhantasmCast!.phantasmsUsedBefore = 2; numeric(last);
    const c1 = fixture(); c1.gameContext!.constellation = 1; blocked(c1);
    const asc = fixture(); delete asc.gameContext!.ascension; if (asc.build.mode === "manual-final") delete asc.build.ascension; blocked(asc);
    const wrongTalent = fixture(); wrongTalent.gameContext!.abilityId = "talent:nefer:combat1"; blocked(wrongTalent);
  });
  it("keeps window, Veil count and intrinsic-impact EM independent with explicit included shares", () => {
    const windowOff = fixture(); windowOff.gameContext!.neferPhantasmCast!.sharedState!.fullVeilEmBuffActive = false; numeric(windowOff, expected(100));
    const zeroStacks = fixture(); zeroStacks.gameContext!.neferPhantasmCast!.sharedState!.veilStacks = 0; numeric(zeroStacks, expected(200, 1));
    const included = fixture(); if (included.build.mode === "manual-final") included.build.stats.em = 200;
    included.gameContext!.neferPhantasmCast!.sharedState!.includedFullVeilEm = 100;
    included.gameContext!.neferPhantasmCast!.sharedState!.specialBaseBonus = .035; included.gameContext!.neferPhantasmCast!.sharedState!.includedIntrinsicBaseBonus = .035; numeric(included);
    for (const actual of [0, 1000]) { const d = fixture(); d.gameContext!.neferPhantasmCast!.sharedState!.intrinsicEmMatchesSnapshot = false; d.gameContext!.neferPhantasmCast!.sharedState!.actualIntrinsicEm = actual; numeric(d, expected(200, 1.24, actual)); }
  });
  it("rejects contradictory chains and unknown contacts without manufacturing a miss", () => {
    const missing = fixture(); missing.gameContext!.neferPhantasmCast!.observations!.pop(); blocked(missing);
    const duplicate = fixture(); duplicate.gameContext!.neferPhantasmCast!.observations![4]!.candidateId = "shade2"; blocked(duplicate);
    const reverse = fixture(); reverse.gameContext!.neferPhantasmCast!.observations![2]!.frame = 9; reverse.gameContext!.neferPhantasmCast!.observations![2]!.snapshotFrame = 9; blocked(reverse);
    const futureSample = fixture(); futureSample.gameContext!.neferPhantasmCast!.observations![0]!.snapshotFrame = 11; blocked(futureSample);
    const wrongTarget = fixture(); wrongTarget.gameContext!.neferPhantasmCast!.observations![0]!.targetId = "other"; blocked(wrongTarget);
    const lateSummon = fixture(); lateSummon.gameContext!.neferPhantasmCast!.firstShadeSummonFrame = 21; blocked(lateSummon);
    const unknown = fixture(); delete unknown.gameContext!.neferPhantasmCast!.targetContacts!.shade3; blocked(unknown);
    const miss = fixture(); miss.gameContext!.neferPhantasmCast!.targetContacts!.shade3 = false; numeric(miss, expected().slice(0, 4)); miss.gameContext!.neferPhantasmCast!.observedThroughFrame = 49; blocked(miss);
  });
});

describe("Durin actual selected white-Q tick contract", () => {
  const id = "durin-white-q-tick";
  const fixture = (level = 10) => {
    const doc = getCharacterDocuments("character:10000123", level).find(row => row.gameContext?.skillId === id)!;
    doc.scope = "single-hit"; doc.selectedHitIds = ["durin-white-q-tick-hit"]; doc.characterLevel = 90;
    doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0; doc.gameContext!.durinBurst = { tickIndex: 1 };
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Actual selected white-Q tick; not a twenty-tick burst or rotation" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.additiveBaseDamage = 0; hit.reaction = "none"; }
    return doc;
  };
  const blocked = (doc: CalculatorDocument) => { const r = calculateDocument(doc); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); };
  const numeric = (doc: CalculatorDocument, expected: number) => {
    const r = calculateDocument(doc); expect(r.status).toBe("calculated"); expect(r.blockers).toEqual([]); expect(r.hits).toHaveLength(1);
    expect(r.totals?.nonCritical).toBeCloseTo(expected, 8); expect(r.totals?.critical).toBeCloseTo(expected * 2, 8); expect(r.totals?.expected).toBeCloseTo(expected * 1.5, 8);
  };
  it("pins default missing tick index and real shared-calculator Q10 arithmetic", () => {
    const r = calculateDocument(getCharacterDocuments("character:10000123", 10).find(row => row.gameContext?.skillId === id)!);
    expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); expect(r.blockers.map(reason => reason.split("：")[0])).toEqual(["durin-burst:durin-white-q-tick-hit"]);
    // Independent old Durin oracle: Q10=1.70352; ATK2000 A4 multiplier1.6.
    for (const constellation of [0, 1, 2]) { const d = fixture(); d.gameContext!.constellation = constellation;
      if (constellation === 2) d.gameContext!.durinBurst = { tickIndex: 1, c2PyroBonusActive: true, c2PyroBonusIncluded: false };
      numeric(d, 2000 * 1.70352 * 1.6 * (constellation === 2 ? 1.5 : 1) * .5 * .9);
    }
  });
  it("uses actual tick10/11 boundary, A4 cap, ASC3 and effective Q13 exactly once", () => {
    for (const [tick, factor] of [[1, 1.6], [10, 1.6], [11, 1], [20, 1]] as const) { const d = fixture(); d.gameContext!.durinBurst!.tickIndex = tick; numeric(d, 2000 * 1.70352 * factor * .5 * .9); }
    const cap = fixture(13); if (cap.build.mode === "manual-final") cap.build.stats.atk = 3000; numeric(cap, 3000 * 2.0111 * 1.75 * .5 * .9);
    cap.gameContext!.ascension = 3; if (cap.build.mode === "manual-final") cap.build.ascension = 3; delete cap.gameContext!.durinBurst!.tickIndex; numeric(cap, 3000 * 2.0111 * .5 * .9);
    const missing = fixture(); delete missing.gameContext!.durinBurst!.tickIndex; blocked(missing);
    const asc = fixture(); delete asc.gameContext!.ascension; if (asc.build.mode === "manual-final") delete asc.build.ascension; blocked(asc);
  });
  it("requires actual C2 accounting and never grants C1's teammate bonus to Durin", () => {
    const d = fixture(); d.gameContext!.constellation = 2; d.gameContext!.durinBurst = { tickIndex: 1, c2PyroBonusActive: true, c2PyroBonusIncluded: false };
    for (const field of ["c2PyroBonusActive", "c2PyroBonusIncluded"] as const) { const missing = structuredClone(d); delete missing.gameContext!.durinBurst![field]; blocked(missing); }
    const h = d.hits[0]!; if (h.kind !== "ordinary") throw Error("Missing actual tick"); h.damageBonus = .5; d.gameContext!.durinBurst!.c2PyroBonusIncluded = true;
    numeric(d, 2000 * 1.70352 * 1.6 * 1.5 * .5 * .9);
    d.gameContext!.durinBurst!.c2PyroBonusActive = false; numeric(d, 2000 * 1.70352 * 1.6 * .5 * .9);
    const locked = fixture(); locked.gameContext!.durinBurst!.c2PyroBonusActive = true; blocked(locked);
  });
  it("retains the exact single-hit source and constellation boundaries", () => {
    const wrongTalent = fixture(); wrongTalent.gameContext!.abilityId = "talent:durin:combat2"; blocked(wrongTalent);
    const c3 = fixture(); c3.gameContext!.constellation = 3; blocked(c3);
    const cast = fixture(); cast.scope = "one-cast"; blocked(cast);
    const forged = fixture(); forged.hits[0]!.id = "forged"; forged.selectedHitIds = ["forged"]; blocked(forged);
    const grouped = fixture(); if (grouped.hits[0]!.kind === "ordinary") grouped.hits[0]!.groupMultiplier = 20; blocked(grouped);
    for (const tickIndex of [0, 21]) { const invalid = fixture(); invalid.gameContext!.durinBurst!.tickIndex = tickIndex;
      const parsed = calculatorDocumentSchema.safeParse(invalid); expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues).toHaveLength(1);
        expect(parsed.error.issues[0]).toMatchObject({ path: ["gameContext", "durinBurst", "tickIndex"], ...(tickIndex === 0 ? { code: "too_small", minimum: 1 } : { code: "too_big", maximum: 20 }) });
      }
      expect(() => calculateDocument(invalid)).toThrow();
    }
  });
});

describe("Durin selected black-E stable-panel contract", () => {
  const id = "durin-denial-of-darkness";
  const ids = ["durin-black-e-1", "durin-black-e-2", "durin-black-e-3"];
  const coefficients = [1.30032, .9576, 1.16352];
  const fixture = () => {
    const doc = getCharacterDocuments("character:10000123", 10).find(row => row.gameContext?.skillId === id)!;
    doc.scope = "one-cast"; doc.selectedHitIds = [...ids]; doc.characterLevel = 90;
    doc.gameContext!.constellation = 0; doc.gameContext!.durinSkill = { statsStableAcrossHits: true };
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Explicit three selected E contacts; no whole rotation or future reactions" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.additiveBaseDamage = 0; hit.reaction = "none"; }
    return doc;
  };
  const blocked = (doc: CalculatorDocument) => { const r = calculateDocument(doc); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); };
  const numeric = (doc: CalculatorDocument, values = coefficients.map(c => 2000 * c * .5 * .9)) => {
    const r = calculateDocument(doc); expect(r.status).toBe("calculated"); expect(r.blockers).toEqual([]); expect(r.hits).toHaveLength(values.length);
    r.hits.forEach((hit, i) => expect(hit.nonCritical).toBeCloseTo(values[i]!, 8)); const sum = values.reduce((a, b) => a + b, 0);
    expect(r.totals?.nonCritical).toBeCloseTo(sum, 8); expect(r.totals?.critical).toBeCloseTo(sum * 2, 8); expect(r.totals?.expected).toBeCloseTo(sum * 1.5, 8);
  };
  it("pins three copies of the one shared missing stability dependency and independent E10 arithmetic", () => {
    const original = getCharacterDocuments("character:10000123", 10).find(row => row.gameContext?.skillId === id)!;
    expect(original.hits.map(hit => hit.id)).toEqual(ids); expect(original.scope).toBe("one-cast");
    const r = calculateDocument(original); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined();
    // Calculator aggregates selected hit blockers without deduplicating this shared condition.
    expect(r.blockers.map(reason => reason.split("：")[0])).toEqual(["durin-skill:conditions", "durin-skill:conditions", "durin-skill:conditions"]);
    numeric(fixture()); const c1 = fixture(); c1.gameContext!.constellation = 1; numeric(c1);
  });
  it("requires stability for the selected sum, not an independently occurred member", () => {
    for (const value of [undefined, false]) { const d = fixture(); if (value === undefined) delete d.gameContext!.durinSkill!.statsStableAcrossHits; else d.gameContext!.durinSkill!.statsStableAcrossHits = value; blocked(d); }
    const one = fixture(); one.scope = "single-hit"; one.selectedHitIds = ["durin-black-e-2"]; delete one.gameContext!.durinSkill;
    numeric(one, [2000 * .9576 * .5 * .9]);
    const c3 = fixture(); c3.gameContext!.constellation = 3; blocked(c3);
    const forged = fixture(); forged.hits[1]!.id = "forged"; forged.selectedHitIds = ["forged"]; forged.scope = "single-hit"; blocked(forged);
  });
  it("requires each selected C2 actual and included share without retroactive reaction activation", () => {
    const d = fixture(); d.gameContext!.constellation = 2;
    d.gameContext!.durinSkill!.hitStates = { "durin-black-e-1": { c2PyroBonusActive: false, c2PyroBonusIncluded: false }, "durin-black-e-2": { c2PyroBonusActive: true, c2PyroBonusIncluded: false }, "durin-black-e-3": { c2PyroBonusActive: true, c2PyroBonusIncluded: false } };
    numeric(d, coefficients.map((c, i) => 2000 * c * (i === 0 ? 1 : 1.5) * .5 * .9));
    for (const hitId of ids) for (const field of ["c2PyroBonusActive", "c2PyroBonusIncluded"] as const) { const missing = structuredClone(d); delete missing.gameContext!.durinSkill!.hitStates![hitId]![field]; blocked(missing); }
    const reaction = structuredClone(d); if (reaction.hits[0]!.kind === "ordinary") reaction.hits[0]!.reaction = "reverseVaporize"; blocked(reaction);
    const locked = fixture(); locked.gameContext!.durinSkill!.hitStates = { "durin-black-e-1": { c2PyroBonusActive: true, c2PyroBonusIncluded: false } }; blocked(locked);
  });
});

describe("Jahoda explicitly observed Pyro-A1 robot branch", () => {
  const id = "entity-followup-jahoda-burst-c0";
  const frames = [43, 47, 88, 187, 228, 327, 368, 467, 508, 607, 648, 747, 788];
  const fixture = () => {
    const doc = getCharacterDocuments("character:10000124", 1).find(row => row.gameContext?.skillId === id)!;
    doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
    doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 200, critRate: .5, critDamage: 1 }, source: "Explicit supported Pyro-A1 observations; absorption-time ATK separately supplied" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.additiveBaseDamage = 0; hit.reaction = "none"; }
    doc.gameContext!.entityFollowupCast = { casterId: "jahoda", targetId: "enemy", freshCastConfirmed: true, noHitlag: true, noInterruption: true, noReplacement: true, fullObservedLifetime: true, observedThroughFrame: 791, statsStableAcrossHits: true,
      jahoda: { moonsignLevel: 2, noShadowPursuit: true, partyElements: ["anemo", "pyro"], completePartyConfirmed: true,
        absorptionChecks: { "robot-1:absorb:6": { allAurasInAreaConfirmed: true, elementsPresent: ["pyro"] }, "robot-2:absorb:47": { allAurasInAreaConfirmed: true, elementsPresent: ["pyro"] } },
        attackSelections: {
          "robot-1:tick-1": { completeSelectionConfirmed: true, closestAliveEnemyIds: ["enemy"] }, "robot-1:tick-2": { completeSelectionConfirmed: true, closestAliveEnemyIds: ["enemy"] },
          "robot-1:tick-3": { completeSelectionConfirmed: true, closestAliveEnemyIds: ["enemy"] }, "robot-1:tick-4": { completeSelectionConfirmed: true, closestAliveEnemyIds: ["enemy"] },
          "robot-1:tick-5": { completeSelectionConfirmed: true, closestAliveEnemyIds: ["enemy"] }, "robot-1:tick-6": { completeSelectionConfirmed: true, closestAliveEnemyIds: ["enemy"] },
          "robot-2:tick-1": { completeSelectionConfirmed: true, closestAliveEnemyIds: ["enemy"] }, "robot-2:tick-2": { completeSelectionConfirmed: true, closestAliveEnemyIds: ["enemy"] },
          "robot-2:tick-3": { completeSelectionConfirmed: true, closestAliveEnemyIds: ["enemy"] }, "robot-2:tick-4": { completeSelectionConfirmed: true, closestAliveEnemyIds: ["enemy"] },
          "robot-2:tick-5": { completeSelectionConfirmed: true, closestAliveEnemyIds: ["enemy"] }, "robot-2:tick-6": { completeSelectionConfirmed: true, closestAliveEnemyIds: ["enemy"] },
        }, healChecks: {
          "heal:12": { activeActorId: "jahoda", hpRatioBeforeHeal: .7 }, "heal:99": { activeActorId: "jahoda", hpRatioBeforeHeal: .7 }, "heal:186": { activeActorId: "jahoda", hpRatioBeforeHeal: .7 },
          "heal:273": { activeActorId: "jahoda", hpRatioBeforeHeal: .7 }, "heal:360": { activeActorId: "jahoda", hpRatioBeforeHeal: .7 }, "heal:447": { activeActorId: "jahoda", hpRatioBeforeHeal: .7 },
          "heal:534": { activeActorId: "jahoda", hpRatioBeforeHeal: .7 }, "heal:621": { activeActorId: "jahoda", hpRatioBeforeHeal: .7 }, "heal:708": { activeActorId: "jahoda", hpRatioBeforeHeal: .7 },
        } },
      targetContacts: { initial: true, "robot-1:tick-1:target-1": true, "robot-1:tick-2:target-1": true, "robot-1:tick-3:target-1": true, "robot-1:tick-4:target-1": true, "robot-1:tick-5:target-1": true, "robot-1:tick-6:target-1": true,
        "robot-2:tick-1:target-1": true, "robot-2:tick-2:target-1": true, "robot-2:tick-3:target-1": true, "robot-2:tick-4:target-1": true, "robot-2:tick-5:target-1": true, "robot-2:tick-6:target-1": true },
      sharedState: { actualAtkAtScaling: 1000, includedJahodaA4EM: 0 } };
    return doc;
  };
  const blocked = (d: CalculatorDocument) => { const r = calculateDocument(d); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); };
  // Newly source-derived Q1 oracle; not claimed as a preexisting Jahoda numeric suite.
  const initial = 2000 * 2.072 * .5 * .9, robot = 1000 * .172664 * 1.3 * .5 * .9;
  const numeric = (d: CalculatorDocument, count = 12, em = 200) => {
    const r = calculateDocument(d); expect(r.status).toBe("calculated"); expect(r.blockers).toEqual([]); expect(r.hits).toHaveLength(count + 1);
    r.hits.forEach((hit, index) => { expect(hit.nonCritical).toBeCloseTo(index === 0 ? initial : robot, 8);
      if (index > 0) expect(hit.trace.find(node => node.id === "hitElementalMastery")?.result?.value).toBe(em);
    });
    expect(r.totals?.nonCritical).toBeCloseTo(initial + count * robot, 8); expect(r.totals?.expected).toBeCloseTo((initial + count * robot) * 1.5, 8);
  };
  it("pins default representatives and independent thirteen-hit chronology/frozen-base arithmetic", () => {
    const r = calculateDocument(getCharacterDocuments("character:10000124", 10).find(row => row.gameContext?.skillId === id)!);
    expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); expect(r.blockers).toHaveLength(3); expect([...new Set(r.blockers.map(reason => reason.split(":")[0]))]).toEqual(["entity-followup"]);
    const p = prepareSourceCastDocument(fixture());
    expect(p.hits.map(h => h.kind === "ordinary" ? h.entityFollowupEvent?.frame : undefined)).toEqual(frames);
    expect(p.hits.map(h => h.kind === "ordinary" ? h.entityFollowupEvent?.snapshotFrame : undefined)).toEqual([0, 47, 88, 187, 228, 327, 368, 467, 508, 607, 648, 747, 788]);
    expect(p.hits.map(h => h.kind === "ordinary" ? h.entityFollowupEvent?.scalingFrame : undefined)).toEqual([undefined, 6, 47, 6, 47, 6, 47, 6, 47, 6, 47, 6, 47]); numeric(fixture());
  });
  it("requires full roster, actual absorption/selection/healing and explicit frozen-ATK accounting", () => {
    for (const field of ["casterId", "targetId", "freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "observedThroughFrame", "statsStableAcrossHits", "targetContacts", "jahoda", "sharedState"] as const) { const d = fixture(); delete d.gameContext!.entityFollowupCast![field]; blocked(d); }
    for (const field of ["freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits"] as const) { const d = fixture(); d.gameContext!.entityFollowupCast![field] = false; blocked(d); }
    for (const field of ["moonsignLevel", "noShadowPursuit", "partyElements", "completePartyConfirmed", "absorptionChecks", "attackSelections", "healChecks"] as const) { const d = fixture(); delete d.gameContext!.entityFollowupCast!.jahoda![field]; blocked(d); }
    for (const field of ["noShadowPursuit", "completePartyConfirmed"] as const) { const d = fixture(); d.gameContext!.entityFollowupCast!.jahoda![field] = false; blocked(d); }
    for (const field of ["actualAtkAtScaling", "includedJahodaA4EM"] as const) { const d = fixture(); delete d.gameContext!.entityFollowupCast!.sharedState![field]; blocked(d); }
    const aura = fixture(); aura.gameContext!.entityFollowupCast!.jahoda!.absorptionChecks!["robot-1:absorb:6"]!.allAurasInAreaConfirmed = false; blocked(aura);
    const selection = fixture(); selection.gameContext!.entityFollowupCast!.jahoda!.attackSelections!["robot-1:tick-1"]!.completeSelectionConfirmed = false; blocked(selection);
    const heal = fixture(); delete heal.gameContext!.entityFollowupCast!.jahoda!.healChecks!["heal:708"]!.hpRatioBeforeHeal; blocked(heal);
    const asc = fixture(); delete asc.gameContext!.ascension; if (asc.build.mode === "manual-final") delete asc.build.ascension; blocked(asc);
    const c1 = fixture(); c1.gameContext!.constellation = 1; blocked(c1);
  });
  it("keeps the known non-Pyro source conflict blocked and exact miss lifetime intact", () => {
    const nonPyro = fixture(); nonPyro.gameContext!.entityFollowupCast!.jahoda!.partyElements = ["anemo", "hydro"]; blocked(nonPyro);
    const unknown = fixture(); delete unknown.gameContext!.entityFollowupCast!.targetContacts!["robot-2:tick-6:target-1"]; blocked(unknown);
    const miss = fixture(); miss.gameContext!.entityFollowupCast!.targetContacts!["robot-2:tick-6:target-1"] = false; numeric(miss, 11); miss.gameContext!.entityFollowupCast!.observedThroughFrame = 790; blocked(miss);
  });
  it("observes strict preheal HP threshold and caster identity without changing frozen robot base", () => {
    const active = fixture(); for (const row of Object.values(active.gameContext!.entityFollowupCast!.jahoda!.healChecks!)) row.hpRatioBeforeHeal = .70001; numeric(active, 12, 300);
    const once = fixture(); once.gameContext!.entityFollowupCast!.jahoda!.healChecks!["heal:12"]!.hpRatioBeforeHeal = .70001;
    const onceResult = calculateDocument(once); expect(onceResult.status).toBe("calculated"); expect(onceResult.blockers).toEqual([]);
    // One actual early heal expires at 372; later threshold-equal heals do not refresh it.
    expect(onceResult.hits.slice(1).map(hit => hit.trace.find(node => node.id === "hitElementalMastery")?.result?.value)).toEqual([300, 300, 300, 300, 300, 300, 200, 200, 200, 200, 200, 200]);
    expect(onceResult.totals?.nonCritical).toBeCloseTo(initial + 12 * robot, 8);
    const other = fixture(); for (const row of Object.values(other.gameContext!.entityFollowupCast!.jahoda!.healChecks!)) { row.hpRatioBeforeHeal = .8; row.activeActorId = "teammate"; } numeric(other);
    const included = fixture(); if (included.build.mode === "manual-final") included.build.stats.em = 300; included.gameContext!.entityFollowupCast!.sharedState!.includedJahodaA4EM = 100; numeric(included);
  });
});


describe("Columbina observed ordinary E without Lunar or prior gravity", () => {
  const id = "periodic-ordinary-columbina-skill-no-lunar-c0";
  const frames = [21, 138, 255, 372, 489, 606, 723, 840, 957, 1074, 1191, 1308, 1425] as const;
  const coefficients = [.1672, .0936, .0936, .0936, .0936, .0936, .0936, .0936, .0936, .0936, .0936, .0936, .0936] as const;
  const fixture = () => {
    const doc = getCharacterDocuments("character:10000125", 1).find(row => row.gameContext?.skillId === id)!;
    doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
    doc.gameContext!.ascension = 6;
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 200, critRate: .5, critDamage: 1 }, source: "Explicit observed ordinary ripples, no Lunar events or prior gravity/A1 stacks" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
    doc.gameContext!.periodicOrdinaryCast = {
      casterId: "columbina", targetId: "enemy", freshCastConfirmed: true, noHitlag: true,
      noInterruption: true, noReplacement: true, fullObservedLifetime: true,
      observedThroughFrame: 1521, statsStableAcrossHits: true,
      columbina: { noLunarEvents: true, noPriorGravityOrA1: true },
      targetContacts: { initial: true, "ripple-1": true, "ripple-2": true, "ripple-3": true,
        "ripple-4": true, "ripple-5": true, "ripple-6": true, "ripple-7": true,
        "ripple-8": true, "ripple-9": true, "ripple-10": true, "ripple-11": true, "ripple-12": true },
    };
    return doc;
  };
  const blocked = (doc: CalculatorDocument) => { const result = calculateDocument(doc); expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined(); };
  // Independently pinned combat2 E1 .1672 HP initial/.0936 HP ripple; no inferred Lunar/A1 damage.
  const numeric = (doc: CalculatorDocument, values: readonly number[] = coefficients) => {
    const result = calculateDocument(doc); expect(result.status).toBe("calculated"); expect(result.blockers).toEqual([]);
    expect(result.hits).toHaveLength(values.length);
    result.hits.forEach((hit, index) => expect(hit.nonCritical).toBeCloseTo(20000 * values[index]! * .5 * .9, 8));
    expect(result.totals?.expected).toBeCloseTo(values.reduce((sum, value) => sum + 20000 * value * .5 * .9 * 1.5, 0), 8);
  };
  it("pins the exact default and thirteen independent E1 contact samples", () => {
    const result = calculateDocument(getCharacterDocuments("character:10000125", 10).find(row => row.gameContext?.skillId === id)!);
    expect(result.status).toBe("blocked"); expect(result.totals).toBeUndefined();
    expect(result.blockers).toHaveLength(DEFAULT_CONTEXT_CONTRACTS[id].defaultBlockerCount);
    expect([...new Set(result.blockers.map(reason => reason.split(":")[0]))]).toEqual(["periodic-ordinary"]);
    const doc = fixture(), prepared = prepareSourceCastDocument(doc);
    expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.periodicOrdinaryEvent?.frame : undefined)).toEqual(frames);
    expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.periodicOrdinaryEvent?.snapshotFrame : undefined)).toEqual(frames);
    expect(prepared.hits.map(hit => hit.kind === "ordinary" ? hit.attackTag : undefined)).toEqual(Array(13).fill("skill"));
    numeric(doc);
  });
  it("requires explicit complete observation, contacts and both ordinary-branch exclusions", () => {
    for (const field of ["casterId", "targetId", "freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "observedThroughFrame", "statsStableAcrossHits", "targetContacts", "columbina"] as const) {
      const doc = fixture(); delete doc.gameContext!.periodicOrdinaryCast![field]; blocked(doc);
    }
    for (const field of ["freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits"] as const) {
      const doc = fixture(); doc.gameContext!.periodicOrdinaryCast![field] = false; blocked(doc);
    }
    for (const field of ["noLunarEvents", "noPriorGravityOrA1"] as const) for (const value of [undefined, false]) {
      const doc = fixture(); if (value === undefined) delete doc.gameContext!.periodicOrdinaryCast!.columbina![field];
      else doc.gameContext!.periodicOrdinaryCast!.columbina![field] = value; blocked(doc);
    }
    const c1 = fixture(); c1.gameContext!.constellation = 1; blocked(c1);
  });
  it("distinguishes a known final miss from unknown contact and retains full1521 lifetime", () => {
    const unknown = fixture(); delete unknown.gameContext!.periodicOrdinaryCast!.targetContacts!["ripple-12"]; blocked(unknown);
    const miss = fixture(); miss.gameContext!.periodicOrdinaryCast!.targetContacts!["ripple-12"] = false;
    numeric(miss, [.1672, .0936, .0936, .0936, .0936, .0936, .0936, .0936, .0936, .0936, .0936, .0936]);
    miss.gameContext!.periodicOrdinaryCast!.observedThroughFrame = 1520; blocked(miss);
    const lastContactOnly = fixture(); lastContactOnly.gameContext!.periodicOrdinaryCast!.observedThroughFrame = 1425; blocked(lastContactOnly);
  });
  it("keeps selected occurred initial or ripple independent of future schedule, but requires actual inactive A1", () => {
    for (const [index, coefficient] of [[0, .1672], [1, .0936]] as const) {
      const doc = prepareSourceCastDocument(fixture()); doc.scope = "single-hit"; doc.selectedHitIds = [doc.hits[index]!.id];
      doc.gameContext!.periodicOrdinaryCast = { sharedState: { columbinaA1Inactive: true } }; numeric(doc, [coefficient]);
      delete doc.gameContext!.ascension; if (doc.build.mode === "manual-final") delete doc.build.ascension;
      numeric(doc, [coefficient]); // This inactive branch does not invent a separate ASC prerequisite.
      doc.gameContext!.periodicOrdinaryCast = {}; blocked(doc);
      doc.gameContext!.periodicOrdinaryCast = { sharedState: { columbinaA1Inactive: false } }; blocked(doc);
      doc.gameContext!.periodicOrdinaryCast = { columbina: { noPriorGravityOrA1: true } }; numeric(doc, [coefficient]);
      doc.gameContext!.periodicOrdinaryCast = { columbina: { noPriorGravityOrA1: false } }; blocked(doc);
    }
  });
});

describe("Zibai actually observed finite Spirit Steed pair", () => {
  const id = "zibai-finite-spirit-steed-c0";
  const fixture = () => {
    const doc = getCharacterDocuments("character:10000126", 1).find(row => row.gameContext?.skillId === id)!;
    doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
    doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 9000, hp: 20000, def: 1000, em: 200, critRate: 0, critDamage: 0 }, source: "Explicit finite observed pair, not a whole stance or certified animation timeline" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    doc.gameContext!.zibaiFiniteCast = {
      casterId: "zibai", targetId: "enemy", legalCastConfirmed: true, spiritSteedRecastConfirmed: true,
      fullObservedLifetime: true, observedThroughFrame: 20, statsStableAcrossHits: true,
      observations: [
        { candidateId: "first", templateRole: "ordinary", frame: 10, snapshotFrame: 10, snapshotId: "first", targetId: "enemy" },
        { candidateId: "second", templateRole: "lunar", frame: 20, snapshotFrame: 20, snapshotId: "second", targetId: "enemy" },
      ], targetContacts: { first: true, second: true },
      sharedState: { otherGeoTeammates: 1, hydroTeammates: 2, baseDefense: 800, includedA4DefensePercent: 0, includedA4ElementalMastery: 0,
        a1WindowActive: true, specialBaseBonus: 0, includedIntrinsicBaseBonus: 0, reactionBonus: 0, specialAdditive: 0, includedA1Additive: 0, elevationMultiplier: 1 },
    };
    return doc;
  };
  const blocked = (doc: CalculatorDocument) => { const r = calculateDocument(doc); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); };
  // Literal E1 coefficients; A4 applies to white DEF800, not current DEF1000. Lunar has no ordinary DEF multiplier.
  const values = (def = 1120, em = 320, a1 = true) => [def * 1.72528 * .5 * .9,
    (1.6 * def * 1.40968 * (1 + Math.min(def * .00007, .14)) * (1 + 6 * em / (em + 2000)) + (a1 ? .6 * def : 0)) * .9];
  const numeric = (doc: CalculatorDocument, expected = values()) => {
    const r = calculateDocument(doc); expect(r.status).toBe("calculated"); expect(r.blockers).toEqual([]); expect(r.hits).toHaveLength(expected.length);
    r.hits.forEach((hit, i) => expect(hit.expected).toBeCloseTo(expected[i]!, 8)); expect(r.totals?.expected).toBeCloseTo(expected.reduce((a, b) => a + b, 0), 8);
  };
  it("pins the singleton default and independent ordinary/Lunar pair arithmetic", () => {
    const original = getCharacterDocuments("character:10000126", 10).find(row => row.gameContext?.skillId === id)!;
    expect(original.scope).toBe("single-hit"); expect(original.hits.map(hit => hit.id)).toEqual([`${id}-ordinary`]);
    const r = calculateDocument(original); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); expect(r.blockers).toHaveLength(1);
    expect([...new Set(r.blockers.map(reason => reason.split(":")[0]))]).toEqual(["zibai-finite"]);
    const p = prepareSourceCastDocument(fixture()); expect(p.hits.map(hit => hit.kind)).toEqual(["ordinary", "special"]);
    expect(p.hits.map(hit => (hit.kind === "ordinary" || hit.kind === "special") ? [hit.zibaiFiniteEvent?.frame, hit.zibaiFiniteEvent?.snapshotFrame] : [])).toEqual([[10, 10], [20, 20]]);
    numeric(fixture());
  });
  it("requires actual cast, ordered observations, accounting and known contact", () => {
    for (const field of ["casterId", "targetId", "legalCastConfirmed", "spiritSteedRecastConfirmed", "fullObservedLifetime", "observedThroughFrame", "statsStableAcrossHits", "observations", "targetContacts", "sharedState"] as const) { const d = fixture(); delete d.gameContext!.zibaiFiniteCast![field]; blocked(d); }
    for (const field of ["legalCastConfirmed", "spiritSteedRecastConfirmed", "fullObservedLifetime", "statsStableAcrossHits"] as const) { const d = fixture(); d.gameContext!.zibaiFiniteCast![field] = false; blocked(d); }
    for (const field of ["otherGeoTeammates", "hydroTeammates", "baseDefense", "includedA4DefensePercent", "includedA4ElementalMastery", "a1WindowActive", "specialBaseBonus", "includedIntrinsicBaseBonus", "reactionBonus", "specialAdditive", "includedA1Additive", "elevationMultiplier"] as const) { const d = fixture(); delete d.gameContext!.zibaiFiniteCast!.sharedState![field]; blocked(d); }
    const party = fixture(); party.gameContext!.zibaiFiniteCast!.sharedState!.otherGeoTeammates = 2; blocked(party);
    const asc = fixture(); delete asc.gameContext!.ascension; if (asc.build.mode === "manual-final") delete asc.build.ascension; blocked(asc);
    const c1 = fixture(); c1.gameContext!.constellation = 1; blocked(c1);
    for (const mutate of [
      (d: CalculatorDocument) => { d.gameContext!.zibaiFiniteCast!.observations!.reverse(); },
      (d: CalculatorDocument) => { d.gameContext!.zibaiFiniteCast!.observations![1]!.candidateId = "first"; },
      (d: CalculatorDocument) => { d.gameContext!.zibaiFiniteCast!.observations![1]!.frame = 9; d.gameContext!.zibaiFiniteCast!.observations![1]!.snapshotFrame = 9; },
      (d: CalculatorDocument) => { d.gameContext!.zibaiFiniteCast!.observations![1]!.snapshotFrame = 21; },
      (d: CalculatorDocument) => { d.gameContext!.zibaiFiniteCast!.observations![1]!.targetId = "other"; },
    ]) { const d = fixture(); mutate(d); blocked(d); }
    const unknown = fixture(); delete unknown.gameContext!.zibaiFiniteCast!.targetContacts!.second; blocked(unknown);
    const miss = fixture(); miss.gameContext!.zibaiFiniteCast!.targetContacts!.second = false; numeric(miss, [values()[0]!]); miss.gameContext!.zibaiFiniteCast!.observedThroughFrame = 19; blocked(miss);
  });
  it("keeps A1 actual state and included shares separate from A4 and its cap", () => {
    const inactive = fixture(); inactive.gameContext!.zibaiFiniteCast!.sharedState!.a1WindowActive = false; numeric(inactive, values(1120, 320, false));
    const included = fixture(); if (included.build.mode === "manual-final") { included.build.stats.def = 1120; included.build.stats.em = 320; }
    Object.assign(included.gameContext!.zibaiFiniteCast!.sharedState!, { includedA4DefensePercent: .15, includedA4ElementalMastery: 120, specialBaseBonus: .0784, includedIntrinsicBaseBonus: .0784, specialAdditive: 672, includedA1Additive: 672 });
    delete included.gameContext!.zibaiFiniteCast!.sharedState!.baseDefense; numeric(included);
    const low = fixture(); low.gameContext!.ascension = 3; if (low.build.mode === "manual-final") low.build.ascension = 3;
    for (const field of ["otherGeoTeammates", "hydroTeammates", "baseDefense", "includedA4DefensePercent", "includedA4ElementalMastery"] as const) delete low.gameContext!.zibaiFiniteCast!.sharedState![field]; numeric(low, values(1000, 200));
    const locked = structuredClone(low); locked.gameContext!.ascension = 0; if (locked.build.mode === "manual-final") locked.build.ascension = 0;
    delete locked.gameContext!.zibaiFiniteCast!.sharedState!.a1WindowActive; delete locked.gameContext!.zibaiFiniteCast!.sharedState!.includedA1Additive; numeric(locked, values(1000, 200, false));
    const cap = structuredClone(low); if (cap.build.mode === "manual-final") cap.build.stats.def = 3000; numeric(cap, values(3000, 200));
    const selected = prepareSourceCastDocument(fixture()); selected.scope = "single-hit"; selected.selectedHitIds = [selected.hits[0]!.id];
    for (const field of ["observations", "targetContacts", "fullObservedLifetime", "observedThroughFrame", "statsStableAcrossHits"] as const) delete selected.gameContext!.zibaiFiniteCast![field];
    for (const field of ["a1WindowActive", "specialBaseBonus", "includedIntrinsicBaseBonus", "reactionBonus", "specialAdditive", "includedA1Additive", "elevationMultiplier"] as const) delete selected.gameContext!.zibaiFiniteCast!.sharedState![field]; numeric(selected, [values()[0]!]);
  });
});

describe("Zibai actually observed finite burst pair", () => {
  const id = "zibai-finite-burst-c0";
  const fixture = () => {
    const doc = getCharacterDocuments("character:10000126", 1).find(row => row.gameContext?.skillId === id)!;
    doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
    doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 9000, hp: 20000, def: 1000, em: 200, critRate: 0, critDamage: 0 }, source: "Explicit finite observed pair, not a whole stance or certified animation timeline" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    doc.gameContext!.zibaiFiniteCast = {
      casterId: "zibai", targetId: "enemy", legalCastConfirmed: true,
      fullObservedLifetime: true, observedThroughFrame: 20, statsStableAcrossHits: true,
      observations: [
        { candidateId: "first", templateRole: "ordinary", frame: 10, snapshotFrame: 10, snapshotId: "first", targetId: "enemy" },
        { candidateId: "second", templateRole: "lunar", frame: 20, snapshotFrame: 20, snapshotId: "second", targetId: "enemy" },
      ], targetContacts: { first: true, second: true },
      sharedState: { otherGeoTeammates: 1, hydroTeammates: 2, baseDefense: 800, includedA4DefensePercent: 0, includedA4ElementalMastery: 0,
        specialBaseBonus: 0, includedIntrinsicBaseBonus: 0, reactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1 },
    };
    return doc;
  };
  const blocked = (doc: CalculatorDocument) => { const r = calculateDocument(doc); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); };
  // Literal Q1 coefficients; A4 applies to white DEF800, not current DEF1000. Lunar has no ordinary DEF multiplier.
  const values = (def = 1120, em = 320) => [def * 1.2696 * .5 * .9,
    (1.6 * def * 1.77744 * (1 + Math.min(def * .00007, .14)) * (1 + 6 * em / (em + 2000))) * .9];
  const numeric = (doc: CalculatorDocument, expected = values()) => {
    const r = calculateDocument(doc); expect(r.status).toBe("calculated"); expect(r.blockers).toEqual([]); expect(r.hits).toHaveLength(expected.length);
    r.hits.forEach((hit, i) => expect(hit.expected).toBeCloseTo(expected[i]!, 8)); expect(r.totals?.expected).toBeCloseTo(expected.reduce((a, b) => a + b, 0), 8);
  };
  it("pins the singleton default and independent ordinary/Lunar pair arithmetic", () => {
    const original = getCharacterDocuments("character:10000126", 10).find(row => row.gameContext?.skillId === id)!;
    expect(original.scope).toBe("single-hit"); expect(original.hits.map(hit => hit.id)).toEqual([`${id}-ordinary`]);
    const r = calculateDocument(original); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); expect(r.blockers).toHaveLength(1);
    expect([...new Set(r.blockers.map(reason => reason.split(":")[0]))]).toEqual(["zibai-finite"]);
    const p = prepareSourceCastDocument(fixture()); expect(p.hits.map(hit => hit.kind)).toEqual(["ordinary", "special"]);
    expect(p.hits.map(hit => (hit.kind === "ordinary" || hit.kind === "special") ? [hit.zibaiFiniteEvent?.frame, hit.zibaiFiniteEvent?.snapshotFrame] : [])).toEqual([[10, 10], [20, 20]]);
    numeric(fixture());
  });
  it("requires actual cast, ordered observations, accounting and known contact", () => {
    for (const field of ["casterId", "targetId", "legalCastConfirmed", "fullObservedLifetime", "observedThroughFrame", "statsStableAcrossHits", "observations", "targetContacts", "sharedState"] as const) { const d = fixture(); delete d.gameContext!.zibaiFiniteCast![field]; blocked(d); }
    for (const field of ["legalCastConfirmed", "fullObservedLifetime", "statsStableAcrossHits"] as const) { const d = fixture(); d.gameContext!.zibaiFiniteCast![field] = false; blocked(d); }
    for (const field of ["otherGeoTeammates", "hydroTeammates", "baseDefense", "includedA4DefensePercent", "includedA4ElementalMastery", "specialBaseBonus", "includedIntrinsicBaseBonus", "reactionBonus", "specialAdditive", "elevationMultiplier"] as const) { const d = fixture(); delete d.gameContext!.zibaiFiniteCast!.sharedState![field]; blocked(d); }
    const party = fixture(); party.gameContext!.zibaiFiniteCast!.sharedState!.otherGeoTeammates = 2; blocked(party);
    const asc = fixture(); delete asc.gameContext!.ascension; if (asc.build.mode === "manual-final") delete asc.build.ascension; blocked(asc);
    const c1 = fixture(); c1.gameContext!.constellation = 1; blocked(c1);
    for (const mutate of [
      (d: CalculatorDocument) => { d.gameContext!.zibaiFiniteCast!.observations!.reverse(); },
      (d: CalculatorDocument) => { d.gameContext!.zibaiFiniteCast!.observations![1]!.candidateId = "first"; },
      (d: CalculatorDocument) => { d.gameContext!.zibaiFiniteCast!.observations![1]!.frame = 9; d.gameContext!.zibaiFiniteCast!.observations![1]!.snapshotFrame = 9; },
      (d: CalculatorDocument) => { d.gameContext!.zibaiFiniteCast!.observations![1]!.snapshotFrame = 21; },
      (d: CalculatorDocument) => { d.gameContext!.zibaiFiniteCast!.observations![1]!.targetId = "other"; },
    ]) { const d = fixture(); mutate(d); blocked(d); }
    const unknown = fixture(); delete unknown.gameContext!.zibaiFiniteCast!.targetContacts!.second; blocked(unknown);
    const miss = fixture(); miss.gameContext!.zibaiFiniteCast!.targetContacts!.second = false; numeric(miss, [values()[0]!]); miss.gameContext!.zibaiFiniteCast!.observedThroughFrame = 19; blocked(miss);
  });
  it("excludes Spirit Steed A1 from Q while retaining A4 and intrinsic accounting", () => {
    for (const active of [true, false]) {
      const irrelevant = fixture(); irrelevant.gameContext!.zibaiFiniteCast!.sharedState!.a1WindowActive = active;
      irrelevant.gameContext!.zibaiFiniteCast!.sharedState!.includedA1Additive = 999;
      irrelevant.gameContext!.zibaiFiniteCast!.spiritSteedRecastConfirmed = false; numeric(irrelevant);
      const r = calculateDocument(irrelevant); const a1 = r.hits[1]!.trace.find(node => node.id === "zibai.a1Additive");
      expect(a1?.result?.value).toBe(0); expect(a1?.status).toBe("not-applicable");
    }
    const included = fixture(); if (included.build.mode === "manual-final") { included.build.stats.def = 1120; included.build.stats.em = 320; }
    Object.assign(included.gameContext!.zibaiFiniteCast!.sharedState!, { includedA4DefensePercent: .15, includedA4ElementalMastery: 120, specialBaseBonus: .0784, includedIntrinsicBaseBonus: .0784 });
    delete included.gameContext!.zibaiFiniteCast!.sharedState!.baseDefense; numeric(included);
    const low = fixture(); low.gameContext!.ascension = 3; if (low.build.mode === "manual-final") low.build.ascension = 3;
    for (const field of ["otherGeoTeammates", "hydroTeammates", "baseDefense", "includedA4DefensePercent", "includedA4ElementalMastery"] as const) delete low.gameContext!.zibaiFiniteCast!.sharedState![field]; numeric(low, values(1000, 200));
    const locked = structuredClone(low); locked.gameContext!.ascension = 0; if (locked.build.mode === "manual-final") locked.build.ascension = 0;
    delete locked.gameContext!.zibaiFiniteCast!.sharedState!.a1WindowActive; delete locked.gameContext!.zibaiFiniteCast!.sharedState!.includedA1Additive; numeric(locked, values(1000, 200));
    const cap = structuredClone(low); if (cap.build.mode === "manual-final") cap.build.stats.def = 3000; numeric(cap, values(3000, 200));
    const selected = prepareSourceCastDocument(fixture()); selected.scope = "single-hit"; selected.selectedHitIds = [selected.hits[0]!.id];
    for (const field of ["observations", "targetContacts", "fullObservedLifetime", "observedThroughFrame", "statsStableAcrossHits"] as const) delete selected.gameContext!.zibaiFiniteCast![field];
    for (const field of ["specialBaseBonus", "includedIntrinsicBaseBonus", "reactionBonus", "specialAdditive", "elevationMultiplier"] as const) delete selected.gameContext!.zibaiFiniteCast!.sharedState![field]; numeric(selected, [values()[0]!]);
  });
});

describe("Varka explicit two-normal stance observation", () => {
  const id = "extended-varka-skill-c0";
  const roles = ["initial", "normal1", "normal2a", "normal2b", "normal3a", "normal3b", "normal4a", "normal4b", "normal5a", "normal5b", "chargedA", "chargedB", "azureA", "azureB", "specialA", "specialB"];
  const fixture = () => {
    const doc = getCharacterDocuments("character:10000128", 1).find(row => row.gameContext?.skillId === id)!;
    doc.scope = "one-cast"; doc.selectedHitIds = doc.hits.map(hit => hit.id); doc.characterLevel = 90;
    doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 0, critRate: .5, critDamage: 1 }, source: "Explicit two-normal action history; last-refresh non-extra ATK supplied separately" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    for (const hit of doc.hits) if (hit.kind === "ordinary") { hit.damageBonus = 0; hit.reaction = "none"; }
    doc.gameContext!.extendedStanceCast = { casterId: "varka", targetId: "enemy", freshCastConfirmed: true, noHitlag: true, noInterruption: true, noReplacement: true, fullObservedLifetime: true, observedThroughFrame: 761, statsStableAcrossHits: true,
      followupActions: [{ id: "n1", frame: 49, actorId: "varka", kind: "normal", attackSpeedBonus: 0 }, { id: "n2", frame: 72, actorId: "varka", kind: "normal", attackSpeedBonus: 0 }],
      targetContacts: { initial: true, "n1:1": true, "n2:1": true, "n2:2": true },
      varka: { teamElements: ["anemo", "anemo"], completeTeamConfirmed: true, hexerei: false, hexereiCount: 0, noUnlistedActions: true, noExternalCooldownChanges: true, allSwirlsRecorded: true, swirlEvents: [] },
      sharedState: { varkaA1NonExtraAtkAtLastRefresh: 1000, includedDamageBonus: 0 } };
    return doc;
  };
  const blocked = (doc: CalculatorDocument) => { const r = calculateDocument(doc); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); };
  // Newly source-derived E1 vector, not a claim of a preexisting Varka numeric suite.
  const expected = (multiplier = 1.4, bonus = .1, stacks = [0, 0, 0, 0]) => [2.784, .818247, .299856, .556876].map((c, i) => 2000 * c * (i === 0 ? 1 : multiplier) * (1 + bonus + .075 * stacks[i]!) * .5 * .9);
  const numeric = (doc: CalculatorDocument, values = expected()) => {
    const r = calculateDocument(doc); expect(r.status).toBe("calculated"); expect(r.blockers).toEqual([]); expect(r.hits).toHaveLength(values.length);
    r.hits.forEach((hit, i) => expect(hit.nonCritical).toBeCloseTo(values[i]!, 8)); expect(r.totals?.expected).toBeCloseTo(values.reduce((a, b) => a + b, 0) * 1.5, 8);
  };
  it("pins all default representatives and separate team multiplier versus refreshed attack bonus", () => {
    const original = getCharacterDocuments("character:10000128", 10).find(row => row.gameContext?.skillId === id)!;
    expect(original.hits.map(hit => hit.id)).toEqual(roles.map(role => `${id}-${role}`));
    const r = calculateDocument(original); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); expect(r.blockers).toHaveLength(32);
    expect([...new Set(r.blockers.map(reason => reason.split(":")[0]))]).toEqual(["extended-stance"]);
    const p = prepareSourceCastDocument(fixture()); expect(p.hits.map(hit => hit.kind === "ordinary" ? [hit.extendedStanceEvent?.frame, hit.extendedStanceEvent?.snapshotFrame, hit.element] : [])).toEqual([[40, 40, "anemo"], [68, 68, "physical"], [90, 90, "anemo"], [100, 100, "physical"]]); numeric(fixture());
    const one = fixture(); one.gameContext!.extendedStanceCast!.varka!.teamElements = ["anemo"]; numeric(one, expected(1));
    const zero = fixture(); zero.gameContext!.extendedStanceCast!.sharedState!.varkaA1NonExtraAtkAtLastRefresh = 0; numeric(zero, expected(1.4, 0));
    const cap = fixture(); cap.gameContext!.extendedStanceCast!.sharedState!.varkaA1NonExtraAtkAtLastRefresh = 3000; numeric(cap, expected(1.4, .25));
    const included = fixture(); for (const hit of included.hits) if (hit.kind === "ordinary") hit.damageBonus = .1; included.gameContext!.extendedStanceCast!.sharedState!.includedDamageBonus = .1; numeric(included);
  });
  it("requires exact action/history/state evidence and source-supported ASC", () => {
    for (const field of ["casterId", "targetId", "freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "observedThroughFrame", "statsStableAcrossHits", "followupActions", "targetContacts", "varka", "sharedState"] as const) { const d = fixture(); delete d.gameContext!.extendedStanceCast![field]; blocked(d); }
    for (const field of ["freshCastConfirmed", "noHitlag", "noInterruption", "noReplacement", "fullObservedLifetime", "statsStableAcrossHits"] as const) { const d = fixture(); d.gameContext!.extendedStanceCast![field] = false; blocked(d); }
    for (const field of ["teamElements", "completeTeamConfirmed", "hexerei", "hexereiCount", "noUnlistedActions", "noExternalCooldownChanges", "allSwirlsRecorded", "swirlEvents"] as const) { const d = fixture(); delete d.gameContext!.extendedStanceCast!.varka![field]; blocked(d); }
    for (const field of ["completeTeamConfirmed", "noUnlistedActions", "noExternalCooldownChanges", "allSwirlsRecorded"] as const) { const d = fixture(); d.gameContext!.extendedStanceCast!.varka![field] = false; blocked(d); }
    for (const field of ["varkaA1NonExtraAtkAtLastRefresh", "includedDamageBonus"] as const) { const d = fixture(); delete d.gameContext!.extendedStanceCast!.sharedState![field]; blocked(d); }
    const speed = fixture(); delete speed.gameContext!.extendedStanceCast!.followupActions![0]!.attackSpeedBonus; blocked(speed);
    const early = fixture(); early.gameContext!.extendedStanceCast!.followupActions![0]!.frame = 48; blocked(early);
    const actor = fixture(); actor.gameContext!.extendedStanceCast!.followupActions![0]!.actorId = "other"; blocked(actor);
    const asc = fixture(); delete asc.gameContext!.ascension; if (asc.build.mode === "manual-final") delete asc.build.ascension; blocked(asc);
    const asc3 = fixture(); asc3.gameContext!.ascension = 3; if (asc3.build.mode === "manual-final") asc3.build.ascension = 3; blocked(asc3);
    const c1 = fixture(); c1.gameContext!.constellation = 1; blocked(c1);
  });
  it("preserves known miss lifetime and late cooldown tails when actual elemental conversion exists", () => {
    const unknown = fixture(); delete unknown.gameContext!.extendedStanceCast!.targetContacts!["n2:2"]; blocked(unknown);
    const miss = fixture(); miss.gameContext!.extendedStanceCast!.targetContacts!["n2:2"] = false; numeric(miss, expected().slice(0, 3)); miss.gameContext!.extendedStanceCast!.observedThroughFrame = 760; blocked(miss);
    const converted = fixture(); converted.gameContext!.extendedStanceCast!.varka!.teamElements = ["anemo", "anemo", "pyro", "pyro"];
    converted.gameContext!.extendedStanceCast!.enemyHits = { "n1:1": true, "n2:1": true, "n2:2": true }; converted.gameContext!.extendedStanceCast!.observedThroughFrame = 1270;
    numeric(converted, expected(2.2)); expect(prepareSourceCastDocument(converted).hits.map(hit => hit.kind === "ordinary" ? hit.element : undefined)).toEqual(["anemo", "pyro", "anemo", "pyro"]);
    const tail = structuredClone(converted); tail.gameContext!.extendedStanceCast!.observedThroughFrame = 1269; blocked(tail);
    const unknownEnemy = structuredClone(converted); delete unknownEnemy.gameContext!.extendedStanceCast!.enemyHits!["n1:1"]; blocked(unknownEnemy);
    const contradiction = structuredClone(converted); contradiction.gameContext!.extendedStanceCast!.enemyHits!["n1:1"] = false; blocked(contradiction);
  });
  it("applies observed earlier teammate Swirl only to later eligible hits and keeps initial standalone", () => {
    const swirl = fixture(); swirl.gameContext!.extendedStanceCast!.varka!.swirlEvents = [{ id: "swirl", frame: 80, actorId: "teammate", targetId: "enemy", targetIsEnemy: true, element: "pyro" }]; numeric(swirl, expected(1.4, .1, [0, 0, 1, 1]));
    const selected = prepareSourceCastDocument(fixture()); selected.scope = "single-hit"; selected.selectedHitIds = [selected.hits[0]!.id]; selected.gameContext!.extendedStanceCast = { sharedState: { varkaA1NonExtraAtkAtLastRefresh: 1000, includedDamageBonus: 0 } }; numeric(selected, [expected()[0]!]);
    delete selected.gameContext!.extendedStanceCast!.sharedState!.varkaA1NonExtraAtkAtLastRefresh; blocked(selected);
  });
});


describe("Lohen physical plunges use observed collision opportunities, not inferred height counts",()=>{
  const cases=[["low",2.527025],["high",3.15639]] as const;
  const fixture=(height:string)=>{
    const doc=getCharacterDocuments("character:10000129",10).find(row=>row.gameContext?.skillId===`lohen-plunge-${height}-observed-base`)!;
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.constellation=0;
    doc.build={mode:"manual-final",stats:{atk:1000,hp:10000,def:700,em:0,critRate:.5,critDamage:1},source:"Two declared physical collision opportunities, one known miss, and actual landing; no inferred height threshold or trajectory timing"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.reaction="none";}
    doc.gameContext!.observedPlunge={noExternalInfusion:true,collisionCount:2,collisionContacts:{"1":true,"2":false},landingContact:true,statsStableAcrossHits:true};return doc;
  };
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  const numeric=(doc:CalculatorDocument,coefficients:readonly number[])=>{const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(coefficients.length);coefficients.forEach((c,i)=>expect(r.hits[i]!.nonCritical).toBeCloseTo(1000*c*.5*.9,8));expect(r.totals?.expected).toBeCloseTo(coefficients.reduce((a,b)=>a+b,0)*1000*.5*.9*1.5,8);};
  it.each(cases)("%s pins unknown default and independent collision/landing NA10 coefficients",(height,landing)=>{
    const r=calculateDocument(getCharacterDocuments("character:10000129",10).find(row=>row.gameContext?.skillId===`lohen-plunge-${height}-observed-base`)!);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(1);expect(r.blockers[0]).toMatch(/^observed-plunge:/);
    expect(prepareSourceCastDocument(getCharacterDocuments("character:10000129",10).find(row=>row.gameContext?.skillId===`lohen-plunge-${height}-observed-base`)!).hits.map(hit=>hit.id)).toEqual([`lohen-plunge-${height}-observed-base:landing`]);
    // Independently pinned Lohen combat1 NA10 vectors, not inferred from the observed expansion.
    numeric(fixture(height),[1.26378,landing]);
  });
  it.each(cases)("%s requires each opportunity's contact, actual count, landing and stable conditions",(height,landing)=>{
    for(const key of ["noExternalInfusion","collisionCount","collisionContacts","landingContact","statsStableAcrossHits"] as const){const doc=fixture(height);delete doc.gameContext!.observedPlunge![key];blocked(doc);}
    for(const key of ["noExternalInfusion","statsStableAcrossHits"] as const){const doc=fixture(height);doc.gameContext!.observedPlunge![key]=false;blocked(doc);}
    const unknown=fixture(height);delete unknown.gameContext!.observedPlunge!.collisionContacts!["2"];blocked(unknown);
    const both=fixture(height);both.gameContext!.observedPlunge!.collisionContacts!["2"]=true;numeric(both,[1.26378,1.26378,landing]);
    const noCollision=fixture(height);noCollision.gameContext!.observedPlunge!.collisionCount=0;noCollision.gameContext!.observedPlunge!.collisionContacts={};numeric(noCollision,[landing]);
    const missedLanding=fixture(height);missedLanding.gameContext!.observedPlunge!.landingContact=false;numeric(missedLanding,[1.26378]);
  });
  it.each(cases)("%s keeps no-contact distinct from zero numeric damage and retains physical C0 guard",height=>{
    const none=fixture(height);none.gameContext!.observedPlunge!.collisionContacts={"1":false,"2":false};none.gameContext!.observedPlunge!.landingContact=false;
    const r=calculateDocument(none);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(1);expect(r.hits[0]!.status).toBe("non-damaging");expect(r.totals).toBeUndefined();
    const c1=fixture(height);c1.gameContext!.constellation=1;blocked(c1);
    const reaction=fixture(height);if(reaction.hits[0]!.kind!=="ordinary")throw Error("ordinary");reaction.hits[0]!.reaction="melt";blocked(reaction);
    const additive=fixture(height);if(additive.hits[0]!.kind!=="ordinary")throw Error("ordinary");additive.hits[0]!.additiveReaction="spread";blocked(additive);
  });
  it.each(cases)("%s actual selected collision or landing does not require unselected future trajectory",(height,landing)=>{
    for(const [role,coefficient] of [["collision-1",1.26378],["landing",landing]] as const){const doc=prepareSourceCastDocument(fixture(height));doc.scope="single-hit";doc.selectedHitIds=[doc.hits.find(hit=>hit.id.endsWith(`:${role}`))!.id];doc.gameContext!.observedPlunge={noExternalInfusion:true};numeric(doc,[coefficient]);delete doc.gameContext!.observedPlunge!.noExternalInfusion;blocked(doc);}
  });
});

describe("Linnea physical plunges use observed collision opportunities, not inferred height counts",()=>{
  const cases=[["low",2.246244],["high",2.80568]] as const;
  const fixture=(height:string)=>{
    const doc=getCharacterDocuments("character:10000130",10).find(row=>row.gameContext?.skillId===`linnea-plunge-${height}-observed-base`)!;
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.constellation=0;
    doc.build={mode:"manual-final",stats:{atk:1000,hp:10000,def:700,em:0,critRate:.5,critDamage:1},source:"Two declared physical collision opportunities, one known miss, and actual landing; no inferred height threshold or trajectory timing"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.reaction="none";}
    doc.gameContext!.observedPlunge={noExternalInfusion:true,collisionCount:2,collisionContacts:{"1":true,"2":false},landingContact:true,statsStableAcrossHits:true};return doc;
  };
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  const numeric=(doc:CalculatorDocument,coefficients:readonly number[])=>{const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(coefficients.length);coefficients.forEach((c,i)=>expect(r.hits[i]!.nonCritical).toBeCloseTo(1000*c*.5*.9,8));expect(r.totals?.expected).toBeCloseTo(coefficients.reduce((a,b)=>a+b,0)*1000*.5*.9*1.5,8);};
  it.each(cases)("%s pins unknown default and independent collision/landing NA10 coefficients",(height,landing)=>{
    const r=calculateDocument(getCharacterDocuments("character:10000130",10).find(row=>row.gameContext?.skillId===`linnea-plunge-${height}-observed-base`)!);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(1);expect(r.blockers[0]).toMatch(/^observed-plunge:/);
    expect(prepareSourceCastDocument(getCharacterDocuments("character:10000130",10).find(row=>row.gameContext?.skillId===`linnea-plunge-${height}-observed-base`)!).hits.map(hit=>hit.id)).toEqual([`linnea-plunge-${height}-observed-base:landing`]);
    // Independently pinned Linnea combat1 NA10 vectors, not inferred from the observed expansion.
    numeric(fixture(height),[1.12336,landing]);
  });
  it.each(cases)("%s requires each opportunity's contact, actual count, landing and stable conditions",(height,landing)=>{
    for(const key of ["noExternalInfusion","collisionCount","collisionContacts","landingContact","statsStableAcrossHits"] as const){const doc=fixture(height);delete doc.gameContext!.observedPlunge![key];blocked(doc);}
    for(const key of ["noExternalInfusion","statsStableAcrossHits"] as const){const doc=fixture(height);doc.gameContext!.observedPlunge![key]=false;blocked(doc);}
    const unknown=fixture(height);delete unknown.gameContext!.observedPlunge!.collisionContacts!["2"];blocked(unknown);
    const both=fixture(height);both.gameContext!.observedPlunge!.collisionContacts!["2"]=true;numeric(both,[1.12336,1.12336,landing]);
    const noCollision=fixture(height);noCollision.gameContext!.observedPlunge!.collisionCount=0;noCollision.gameContext!.observedPlunge!.collisionContacts={};numeric(noCollision,[landing]);
    const missedLanding=fixture(height);missedLanding.gameContext!.observedPlunge!.landingContact=false;numeric(missedLanding,[1.12336]);
  });
  it.each(cases)("%s keeps no-contact distinct from zero numeric damage and retains physical C0 guard",height=>{
    const none=fixture(height);none.gameContext!.observedPlunge!.collisionContacts={"1":false,"2":false};none.gameContext!.observedPlunge!.landingContact=false;
    const r=calculateDocument(none);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(1);expect(r.hits[0]!.status).toBe("non-damaging");expect(r.totals).toBeUndefined();
    const c1=fixture(height);c1.gameContext!.constellation=1;blocked(c1);
    const reaction=fixture(height);if(reaction.hits[0]!.kind!=="ordinary")throw Error("ordinary");reaction.hits[0]!.reaction="melt";blocked(reaction);
    const additive=fixture(height);if(additive.hits[0]!.kind!=="ordinary")throw Error("ordinary");additive.hits[0]!.additiveReaction="spread";blocked(additive);
  });
  it.each(cases)("%s actual selected collision or landing does not require unselected future trajectory",(height,landing)=>{
    for(const [role,coefficient] of [["collision-1",1.12336],["landing",landing]] as const){const doc=prepareSourceCastDocument(fixture(height));doc.scope="single-hit";doc.selectedHitIds=[doc.hits.find(hit=>hit.id.endsWith(`:${role}`))!.id];doc.gameContext!.observedPlunge={noExternalInfusion:true};numeric(doc,[coefficient]);delete doc.gameContext!.observedPlunge!.noExternalInfusion;blocked(doc);}
  });
});

describe("Linnea independently occurred Heavy Overdrive Hammer", () => {
  const id = "linnea-lumi-heavy-overdrive-hammer-component";
  const fixture = () => {
    const doc = getCharacterDocuments("character:10000130", 1).find(row => row.gameContext?.skillId === id)!;
    doc.characterLevel = 90; doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 9000, hp: 20000, def: 1000, em: 200, critRate: 0, critDamage: 0 }, source: "One actually observed Hammer; intrinsic impact DEF and A4 pre-conversion DEF separately supplied" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    doc.gameContext!.observedSpecialComponent = { casterId: "linnea", targetId: "enemy", actualComponentOccurred: true,
      independentEvent: { candidateId: "hammer", frame: 10, snapshotFrame: 10, snapshotId: "sample", targetId: "enemy" },
      sharedState: { actualIntrinsicStat: 500, specialBaseBonus: 0, includedIntrinsicBaseBonus: 0, reactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1,
        linneaA4AppliesToSelf: true, a4PreConversionStat: 800, includedCharacterEm: 0,
        lumiForm: "super-power", nearbyMoondrift: true, lumiPresent: true, targetWithinLumiA1Range: true, moonsignLevel: 2, includedResistanceReduction: 0 } };
    return doc;
  };
  const blocked = (doc: CalculatorDocument) => { const r = calculateDocument(doc); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); };
  // Pinned E1 hammer coefficient1.0, factor1.6; no ordinary defense term. A4 uses800 while intrinsic uses500, not snapshotDEF1000.
  const expected = (em = 240, intrinsic = .035, resistance = 1.1) => 1.6 * 1000 * 1 * (1 + intrinsic) * (1 + 6 * em / (em + 2000)) * resistance;
  const numeric = (doc: CalculatorDocument, value = expected()) => { const r = calculateDocument(doc); expect(r.status).toBe("calculated"); expect(r.blockers).toEqual([]); expect(r.hits).toHaveLength(1); expect(r.hits[0]!.expected).toBeCloseTo(value, 8); expect(r.totals?.expected).toBeCloseTo(value, 8); };
  it("pins one aggregated unknown component and independent actual-hit arithmetic", () => {
    const original = getCharacterDocuments("character:10000130", 10).find(row => row.gameContext?.skillId === id)!;
    expect(original.scope).toBe("single-hit"); const r = calculateDocument(original); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); expect(r.blockers).toHaveLength(1); expect(r.blockers[0]).toMatch(/^observed-special-component:source/);
    numeric(fixture()); const p = prepareSourceCastDocument(fixture()); expect(p.hits.map(hit => hit.kind)).toEqual(["special"]);
    expect(p.hits[0]!.kind === "special" && p.hits[0]!.observedSpecialComponentEvent).toEqual({ candidateId: "hammer", frame: 10, snapshotFrame: 10, snapshotId: "sample", targetId: "enemy" });
  });
  it("requires actual event, qualified form, individual passive facts and explicit accounting", () => {
    for (const field of ["actualComponentOccurred", "independentEvent", "sharedState"] as const) { const d = fixture(); delete d.gameContext!.observedSpecialComponent![field]; blocked(d); }
    for (const field of ["actualIntrinsicStat", "specialBaseBonus", "includedIntrinsicBaseBonus", "reactionBonus", "specialAdditive", "elevationMultiplier", "linneaA4AppliesToSelf", "a4PreConversionStat", "includedCharacterEm", "lumiForm", "nearbyMoondrift", "lumiPresent", "targetWithinLumiA1Range", "moonsignLevel", "includedResistanceReduction"] as const) { const d = fixture(); delete d.gameContext!.observedSpecialComponent!.sharedState![field]; blocked(d); }
    const occurred = fixture(); occurred.gameContext!.observedSpecialComponent!.actualComponentOccurred = false; blocked(occurred);
    const form = fixture(); form.gameContext!.observedSpecialComponent!.sharedState!.lumiForm = "ultimate-power"; blocked(form);
    const moondrift = fixture(); moondrift.gameContext!.observedSpecialComponent!.sharedState!.nearbyMoondrift = false; blocked(moondrift);
    const future = fixture(); future.gameContext!.observedSpecialComponent!.independentEvent!.snapshotFrame = 11; blocked(future);
    const target = fixture(); target.gameContext!.observedSpecialComponent!.independentEvent!.targetId = "other"; blocked(target);
    const asc = fixture(); delete asc.gameContext!.ascension; if (asc.build.mode === "manual-final") delete asc.build.ascension; blocked(asc);
    const c1 = fixture(); c1.gameContext!.constellation = 1; blocked(c1);
    const talent = fixture(); talent.gameContext!.abilityId = "talent:linnea:combat3"; blocked(talent);
  });
  it("keeps A4 recipient, actual impact DEF and A1 range/moonsign independent", () => {
    const other = fixture(); other.gameContext!.observedSpecialComponent!.sharedState!.linneaA4AppliesToSelf = false; delete other.gameContext!.observedSpecialComponent!.sharedState!.a4PreConversionStat; numeric(other, expected(200));
    const zero = fixture(); zero.gameContext!.observedSpecialComponent!.sharedState!.actualIntrinsicStat = 0; numeric(zero, expected(240, 0));
    const cap = fixture(); cap.gameContext!.observedSpecialComponent!.sharedState!.actualIntrinsicStat = 3000; numeric(cap, expected(240, .14));
    const same = fixture(); delete same.gameContext!.observedSpecialComponent!.sharedState!.actualIntrinsicStat; same.gameContext!.observedSpecialComponent!.sharedState!.intrinsicStatMatchesSnapshot = true; numeric(same, expected(240, .07)); same.gameContext!.observedSpecialComponent!.sharedState!.intrinsicStatMatchesSnapshot = false; blocked(same);
    for (const field of ["lumiPresent", "targetWithinLumiA1Range"] as const) { const d = fixture(); d.gameContext!.observedSpecialComponent!.sharedState![field] = false; numeric(d, expected(240, .035, .9)); }
    const moon = fixture(); moon.gameContext!.observedSpecialComponent!.sharedState!.moonsignLevel = 1; numeric(moon, expected(240, .035, 1.025));
    const included = fixture(); if (included.build.mode === "manual-final") included.build.stats.em = 240; included.enemy.resistance = -.2;
    Object.assign(included.gameContext!.observedSpecialComponent!.sharedState!, { includedCharacterEm: 40, specialBaseBonus: .035, includedIntrinsicBaseBonus: .035, includedResistanceReduction: .3 }); numeric(included);
    const low = fixture(); low.gameContext!.ascension = 3; if (low.build.mode === "manual-final") low.build.ascension = 3;
    for (const field of ["linneaA4AppliesToSelf", "a4PreConversionStat", "includedCharacterEm"] as const) delete low.gameContext!.observedSpecialComponent!.sharedState![field]; numeric(low, expected(200));
    const locked = structuredClone(low); locked.gameContext!.ascension = 0; if (locked.build.mode === "manual-final") locked.build.ascension = 0;
    for (const field of ["lumiPresent", "targetWithinLumiA1Range", "moonsignLevel", "includedResistanceReduction"] as const) delete locked.gameContext!.observedSpecialComponent!.sharedState![field]; numeric(locked, expected(200, .035, .9));
  });
});

describe("Linnea independently occurred Million-Ton Crush", () => {
  const id = "linnea-lumi-million-ton-crush-component";
  const fixture = () => {
    const doc = getCharacterDocuments("character:10000130", 1).find(row => row.gameContext?.skillId === id)!;
    doc.characterLevel = 90; doc.gameContext!.ascension = 6; doc.gameContext!.constellation = 0;
    doc.build = { mode: "manual-final", ascension: 6, stats: { atk: 9000, hp: 20000, def: 1000, em: 200, critRate: 0, critDamage: 0 }, source: "One actually observed Crush; intrinsic impact DEF and A4 pre-conversion DEF separately supplied" };
    doc.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    doc.gameContext!.observedSpecialComponent = { casterId: "linnea", targetId: "enemy", actualComponentOccurred: true,
      independentEvent: { candidateId: "crush", frame: 10, snapshotFrame: 10, snapshotId: "sample", targetId: "enemy" },
      sharedState: { actualIntrinsicStat: 500, specialBaseBonus: 0, includedIntrinsicBaseBonus: 0, reactionBonus: 0, specialAdditive: 0, elevationMultiplier: 1,
        linneaA4AppliesToSelf: true, a4PreConversionStat: 800, includedCharacterEm: 0,
        lumiForm: "ultimate-power", lumiPresent: true, targetWithinLumiA1Range: true, moonsignLevel: 2, includedResistanceReduction: 0 } };
    return doc;
  };
  const blocked = (doc: CalculatorDocument) => { const r = calculateDocument(doc); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); };
  // Pinned E1 crush coefficient4.0, factor1.6; no ordinary defense term. A4 uses800 while intrinsic uses500, not snapshotDEF1000.
  const expected = (em = 240, intrinsic = .035, resistance = 1.1) => 1.6 * 1000 * 4 * (1 + intrinsic) * (1 + 6 * em / (em + 2000)) * resistance;
  const numeric = (doc: CalculatorDocument, value = expected()) => { const r = calculateDocument(doc); expect(r.status).toBe("calculated"); expect(r.blockers).toEqual([]); expect(r.hits).toHaveLength(1); expect(r.hits[0]!.expected).toBeCloseTo(value, 8); expect(r.totals?.expected).toBeCloseTo(value, 8); };
  it("pins one aggregated unknown component and independent actual-hit arithmetic", () => {
    const original = getCharacterDocuments("character:10000130", 10).find(row => row.gameContext?.skillId === id)!;
    expect(original.scope).toBe("single-hit"); const r = calculateDocument(original); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); expect(r.blockers).toHaveLength(1); expect(r.blockers[0]).toMatch(/^observed-special-component:source/);
    numeric(fixture()); const p = prepareSourceCastDocument(fixture()); expect(p.hits.map(hit => hit.kind)).toEqual(["special"]);
    expect(p.hits[0]!.kind === "special" && p.hits[0]!.observedSpecialComponentEvent).toEqual({ candidateId: "crush", frame: 10, snapshotFrame: 10, snapshotId: "sample", targetId: "enemy" });
  });
  it("requires actual event, qualified form, individual passive facts and explicit accounting", () => {
    for (const field of ["actualComponentOccurred", "independentEvent", "sharedState"] as const) { const d = fixture(); delete d.gameContext!.observedSpecialComponent![field]; blocked(d); }
    for (const field of ["actualIntrinsicStat", "specialBaseBonus", "includedIntrinsicBaseBonus", "reactionBonus", "specialAdditive", "elevationMultiplier", "linneaA4AppliesToSelf", "a4PreConversionStat", "includedCharacterEm", "lumiForm", "lumiPresent", "targetWithinLumiA1Range", "moonsignLevel", "includedResistanceReduction"] as const) { const d = fixture(); delete d.gameContext!.observedSpecialComponent!.sharedState![field]; blocked(d); }
    const occurred = fixture(); occurred.gameContext!.observedSpecialComponent!.actualComponentOccurred = false; blocked(occurred);
    const form = fixture(); form.gameContext!.observedSpecialComponent!.sharedState!.lumiForm = "super-power"; blocked(form);
    const moondrift = fixture(); moondrift.gameContext!.observedSpecialComponent!.sharedState!.nearbyMoondrift = false; numeric(moondrift); moondrift.gameContext!.observedSpecialComponent!.sharedState!.nearbyMoondrift = true; numeric(moondrift);
    const future = fixture(); future.gameContext!.observedSpecialComponent!.independentEvent!.snapshotFrame = 11; blocked(future);
    const target = fixture(); target.gameContext!.observedSpecialComponent!.independentEvent!.targetId = "other"; blocked(target);
    const asc = fixture(); delete asc.gameContext!.ascension; if (asc.build.mode === "manual-final") delete asc.build.ascension; blocked(asc);
    const c1 = fixture(); c1.gameContext!.constellation = 1; blocked(c1);
    const talent = fixture(); talent.gameContext!.abilityId = "talent:linnea:combat3"; blocked(talent);
  });
  it("keeps A4 recipient, actual impact DEF and A1 range/moonsign independent", () => {
    const other = fixture(); other.gameContext!.observedSpecialComponent!.sharedState!.linneaA4AppliesToSelf = false; delete other.gameContext!.observedSpecialComponent!.sharedState!.a4PreConversionStat; numeric(other, expected(200));
    const zero = fixture(); zero.gameContext!.observedSpecialComponent!.sharedState!.actualIntrinsicStat = 0; numeric(zero, expected(240, 0));
    const cap = fixture(); cap.gameContext!.observedSpecialComponent!.sharedState!.actualIntrinsicStat = 3000; numeric(cap, expected(240, .14));
    const same = fixture(); delete same.gameContext!.observedSpecialComponent!.sharedState!.actualIntrinsicStat; same.gameContext!.observedSpecialComponent!.sharedState!.intrinsicStatMatchesSnapshot = true; numeric(same, expected(240, .07)); same.gameContext!.observedSpecialComponent!.sharedState!.intrinsicStatMatchesSnapshot = false; blocked(same);
    for (const field of ["lumiPresent", "targetWithinLumiA1Range"] as const) { const d = fixture(); d.gameContext!.observedSpecialComponent!.sharedState![field] = false; numeric(d, expected(240, .035, .9)); }
    const moon = fixture(); moon.gameContext!.observedSpecialComponent!.sharedState!.moonsignLevel = 1; numeric(moon, expected(240, .035, 1.025));
    const included = fixture(); if (included.build.mode === "manual-final") included.build.stats.em = 240; included.enemy.resistance = -.2;
    Object.assign(included.gameContext!.observedSpecialComponent!.sharedState!, { includedCharacterEm: 40, specialBaseBonus: .035, includedIntrinsicBaseBonus: .035, includedResistanceReduction: .3 }); numeric(included);
    const low = fixture(); low.gameContext!.ascension = 3; if (low.build.mode === "manual-final") low.build.ascension = 3;
    for (const field of ["linneaA4AppliesToSelf", "a4PreConversionStat", "includedCharacterEm"] as const) delete low.gameContext!.observedSpecialComponent!.sharedState![field]; numeric(low, expected(200));
    const locked = structuredClone(low); locked.gameContext!.ascension = 0; if (locked.build.mode === "manual-final") locked.build.ascension = 0;
    for (const field of ["lumiPresent", "targetWithinLumiA1Range", "moonsignLevel", "includedResistanceReduction"] as const) delete locked.gameContext!.observedSpecialComponent!.sharedState![field]; numeric(locked, expected(200, .035, .9));
  });
});

describe("Nicole observed no-skill-buff projection", () => {
  const id = "entity-followup-nicole-burst-c0";
  const fixture = () => {
    const d = getCharacterDocuments("character:10000131", 1).find(row => row.gameContext?.skillId === id)!;
    d.scope = "one-cast"; d.characterLevel = 90; d.gameContext!.ascension = 6; d.gameContext!.constellation = 0;
    d.build = { mode: "manual-final", ascension: 6, stats: { atk: 2000, hp: 20000, def: 800, em: 200, critRate: .5, critDamage: 1 }, source: "Explicit fixed-source Nicole panel, not projection owner" };
    d.enemy = { level: 90, resistance: .1, defenseAdjustment: 0, defenseIgnore: 0 };
    d.gameContext!.entityFollowupCast = { casterId: "nicole", targetId: "enemy", freshCastConfirmed: true, noHitlag: true, noInterruption: true, noReplacement: true, fullObservedLifetime: true, observedThroughFrame: 1310, statsStableAcrossHits: true,
      nicole: { noSkillBuffThroughout: true, allEnemyHitEventsRecorded: true, eventsInSourceOrderConfirmed: true, casterIsHexerei: true, partyHexereiCount: 2,
        enemyHitEvents: [{ id: "trigger", frame: 110, actorId: "owner", activeActorId: "owner", targetId: "enemy", actorElement: "hydro", actorIsHexerei: true, enemyHitHookFired: true }] },
      targetContacts: { initial: true, "projection-1": true },
      snapshots: { "sample:owner:140": { stats: { atk: 3000, hp: 18000, def: 700, em: 0, critRate: .2, critDamage: 1.5 }, characterLevel: 90, ascension: 6, damageBonus: 0, additiveBaseDamage: 0, reactionBonus: 0, source: "Actual different actor at projection execution", sourceRefs: ["test:actual-owner-sample"] } },
      sharedState: { includedAdditiveBaseDamage: 0, nicoleAtkAtProjection: 1800 } };
    return d;
  };
  const initial = 2000 * 3.168 * .5 * .9 * 1.5;
  const projection = (atk = 1800, bonus = true) => (3000 * .99 + (bonus ? 3 * atk : 0)) * .5 * .9 * 1.3;
  const numeric = (d: CalculatorDocument, values = [initial, projection()]) => { const r = calculateDocument(d); expect(r.status).toBe("calculated"); expect(r.blockers).toEqual([]); expect(r.hits.map(hit => hit.expected)).toHaveLength(values.length); r.hits.forEach((hit, i) => expect(hit.expected).toBeCloseTo(values[i]!, 8)); expect(r.totals?.expected).toBeCloseTo(values.reduce((a,b) => a+b,0),8); };
  const blocked = (d: CalculatorDocument) => { const r = calculateDocument(d); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); };
  it("pins two representative defaults and distinct owner/creator arithmetic", () => {
    const d = getCharacterDocuments("character:10000131",10).find(row=>row.gameContext?.skillId===id)!;
    expect(d.hits.map(hit=>hit.id)).toEqual([`${id}-initial`,`${id}-projection`]); const r=calculateDocument(d); expect(r.status).toBe("blocked"); expect(r.totals).toBeUndefined(); expect(r.blockers).toHaveLength(4); r.blockers.forEach(b=>expect(b).toMatch(/^entity-followup:/));
    numeric(fixture()); const p=prepareSourceCastDocument(fixture()); expect(p.hits.map(h=>h.kind==="ordinary" && [h.element,h.entityFollowupEvent?.frame,h.entityFollowupEvent?.snapshotFrame,h.entityFollowupEvent?.ownerId])).toEqual([["pyro",108,108,"nicole"],["hydro",140,140,"owner"]]);
    const changed=fixture(); changed.gameContext!.entityFollowupCast!.sharedState!.nicoleAtkAtProjection=0; numeric(changed,[initial,projection(0)]);
    const noBonus=fixture(); noBonus.gameContext!.entityFollowupCast!.nicole!.enemyHitEvents![0]!.actorIsHexerei=false; delete noBonus.gameContext!.entityFollowupCast!.sharedState!.nicoleAtkAtProjection; numeric(noBonus,[initial,projection(0,false)]);
    const included=fixture();included.gameContext!.entityFollowupCast!.snapshots!["sample:owner:140"]!.additiveBaseDamage=5400;included.gameContext!.entityFollowupCast!.sharedState!.includedAdditiveBaseDamage=5400;numeric(included);
  });
  it("requires complete history, actual attribution samples and explicit accounting", () => {
    for(const field of ["casterId","targetId","freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","observedThroughFrame","statsStableAcrossHits","nicole","targetContacts","snapshots","sharedState"] as const){const d=fixture();delete d.gameContext!.entityFollowupCast![field];blocked(d);}
    for(const field of ["freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","statsStableAcrossHits"] as const){const d=fixture();d.gameContext!.entityFollowupCast![field]=false;blocked(d);}
    for(const field of ["noSkillBuffThroughout","allEnemyHitEventsRecorded","eventsInSourceOrderConfirmed","casterIsHexerei","partyHexereiCount","enemyHitEvents"] as const){const d=fixture();delete d.gameContext!.entityFollowupCast!.nicole![field];blocked(d);}
    for(const field of ["noSkillBuffThroughout","allEnemyHitEventsRecorded","eventsInSourceOrderConfirmed"] as const){const d=fixture();d.gameContext!.entityFollowupCast!.nicole![field]=false;blocked(d);}
    for(const field of ["actorIsHexerei","enemyHitHookFired"] as const){const d=fixture();delete d.gameContext!.entityFollowupCast!.nicole!.enemyHitEvents![0]![field];blocked(d);}
    for(const field of ["includedAdditiveBaseDamage","nicoleAtkAtProjection"] as const){const d=fixture();delete d.gameContext!.entityFollowupCast!.sharedState![field];blocked(d);}
    const contact=fixture();delete contact.gameContext!.entityFollowupCast!.targetContacts!["projection-1"];blocked(contact);
    const materialized=prepareSourceCastDocument(fixture());delete materialized.gameContext!.entityFollowupCast!.snapshots;blocked(materialized);
    const c1=fixture();c1.gameContext!.constellation=1;blocked(c1);
    const reaction=prepareSourceCastDocument(fixture());for(const h of reaction.hits)if(h.kind==="ordinary"&&h.entityFollowupEvent?.templateRole==="projection")h.reaction="vaporize";blocked(reaction);
    const additive=prepareSourceCastDocument(fixture());for(const h of additive.hits)if(h.kind==="ordinary"&&h.entityFollowupEvent?.templateRole==="projection")h.additiveReaction="spread";blocked(additive);
  });
  it("distinguishes known misses and inactive hooks from unknown, retaining full observation", () => {
    const miss=fixture();miss.gameContext!.entityFollowupCast!.targetContacts!["projection-1"]=false;numeric(miss,[initial]);miss.gameContext!.entityFollowupCast!.observedThroughFrame=1309;blocked(miss);
    const empty=fixture();empty.gameContext!.entityFollowupCast!.nicole!.enemyHitEvents=[];numeric(empty,[initial]);
    const cooldown=fixture();const c=cooldown.gameContext!.entityFollowupCast!;c.nicole!.enemyHitEvents!.push({...c.nicole!.enemyHitEvents![0]!,id:"at-boundary",frame:290});numeric(cooldown);c.nicole!.enemyHitEvents![1]!.frame=291;c.targetContacts!["projection-2"]=true;c.snapshots!["sample:owner:321"]=c.snapshots!["sample:owner:140"]!;numeric(cooldown,[initial,projection(),projection()]);
    const noHook=fixture();noHook.gameContext!.entityFollowupCast!.nicole!.enemyHitEvents![0]!.enemyHitHookFired=false;numeric(noHook,[initial]);
    const tie=fixture();const t=tie.gameContext!.entityFollowupCast!;t.nicole!.enemyHitEvents![0]!.frame=109;t.snapshots!["sample:owner:139"]=t.snapshots!["sample:owner:140"]!;t.nicole!.enemyHitEvents![0]!.afterStatusActivation=true;numeric(tie);delete t.nicole!.enemyHitEvents![0]!.afterStatusActivation;blocked(tie);t.nicole!.enemyHitEvents![0]!.afterStatusActivation=false;numeric(tie,[initial]);
    const late=fixture();const ctx=late.gameContext!.entityFollowupCast!;ctx.nicole!.enemyHitEvents![0]!.frame=1309;ctx.snapshots!["sample:owner:1339"]=ctx.snapshots!["sample:owner:140"]!;ctx.observedThroughFrame=1339;numeric(late);ctx.targetContacts!["projection-1"]=false;numeric(late,[initial]);ctx.observedThroughFrame=1338;blocked(late);
  });
  it("keeps selected initial occurrence free of future projection requirements", () => {
    const d=fixture();d.scope="single-hit";d.selectedHitIds=[`${id}-initial`];d.gameContext!.entityFollowupCast={sharedState:{nicoleSkillBuffAbsentAtSnapshot:true}};numeric(d,[initial]);
    d.gameContext!.entityFollowupCast!.sharedState!.nicoleSkillBuffAbsentAtSnapshot=false;blocked(d);delete d.gameContext!.entityFollowupCast!.sharedState!.nicoleSkillBuffAbsentAtSnapshot;blocked(d);
  });
});

describe("Nicole actual initial skill accounting", () => {
  const id="nicole-skill";
  const fixture=()=>{const d=getCharacterDocuments("character:10000131",10).find(row=>row.gameContext?.skillId===id)!;d.characterLevel=90;d.gameContext!.ascension=6;d.gameContext!.constellation=0;
    d.build={mode:"manual-final",ascension:6,stats:{atk:2000,hp:20000,def:800,em:0,critRate:.5,critDamage:1},source:"Actual initial E; independently observed grant sample"};d.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    d.gameContext!.nicoleSkillInitial={noOtherEventsBeforeInitial:true,noDisplacementBeforeInitial:true,skillGrantNonExtraAttack:1000,grantAttackSource:"observed",includedSkillAttack:0,c2AttackIncludedInPanel:false,a1AttackIncludedInPanel:false,includedC2ResistanceReduction:0};return d;};
  const expected=(atk=2150,resistance=.9,coefficient=2.4912)=>atk*coefficient*.5*resistance*1.5;
  const numeric=(d:CalculatorDocument,value=expected())=>{const r=calculateDocument(d);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(1);expect(r.totals?.expected).toBeCloseTo(value,8);};
  const blocked=(d:CalculatorDocument)=>{const r=calculateDocument(d);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  it("pins singleton unknown conditions and actual E10 grant distinct from hit ATK",()=>{
    const d=getCharacterDocuments("character:10000131",10).find(row=>row.gameContext?.skillId===id)!;expect(d.scope).toBe("single-hit");expect(d.selectedHitIds).toEqual(["nicole-skill-hit"]);const r=calculateDocument(d);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(1);expect(r.blockers[0]).toMatch(/^nicole-skill-initial:conditions/);
    numeric(fixture());const observed=fixture();delete observed.gameContext!.nicoleSkillInitial!.grantAttackSource;numeric(observed);const zero=fixture();zero.gameContext!.nicoleSkillInitial!.skillGrantNonExtraAttack=0;numeric(zero,expected(2000));const cap=fixture();cap.gameContext!.nicoleSkillInitial!.skillGrantNonExtraAttack=5000;numeric(cap,expected(2600));
    const c1=fixture();c1.gameContext!.constellation=1;numeric(c1);const c2=fixture();c2.gameContext!.constellation=2;numeric(c2,expected(2450,1.075));
    const level=fixture();level.gameContext!.effectiveTalentLevel=13;numeric(level,expected(2177,.9,2.941));
  });
  it("requires actual initial chronology and accounting without inventing optional C2 range input",()=>{
    for(const field of ["noOtherEventsBeforeInitial","noDisplacementBeforeInitial","skillGrantNonExtraAttack","includedSkillAttack","c2AttackIncludedInPanel","a1AttackIncludedInPanel","includedC2ResistanceReduction"] as const){const d=fixture();delete d.gameContext!.nicoleSkillInitial![field];blocked(d);}
    for(const field of ["noOtherEventsBeforeInitial","noDisplacementBeforeInitial"] as const){const d=fixture();d.gameContext!.nicoleSkillInitial![field]=false;blocked(d);}
    const unknown=fixture();delete unknown.gameContext!.ascension;if(unknown.build.mode==="manual-final")delete unknown.build.ascension;blocked(unknown);
    const low=fixture();low.gameContext!.ascension=3;if(low.build.mode==="manual-final")low.build.ascension=3;numeric(low);low.gameContext!.constellation=2;blocked(low);
    const range=fixture();range.gameContext!.constellation=2;range.gameContext!.nicoleSkillInitial!.targetInC2AreaAtInitial=true;numeric(range,expected(2450,1.075));range.gameContext!.nicoleSkillInitial!.targetInC2AreaAtInitial=false;blocked(range);
    const c3=fixture();c3.gameContext!.constellation=3;blocked(c3);const shape=fixture();shape.hits.push({...structuredClone(shape.hits[0]!),id:"foreign"});shape.selectedHitIds.push("foreign");expect(()=>calculateDocument(shape)).toThrow(/Single Hit requires exactly one selected hit/);shape.scope="one-cast";blocked(shape);
  });
  it("subtracts already included E/C2/A1 and resistance shares exactly once",()=>{
    const d=fixture();d.gameContext!.constellation=2;if(d.build.mode==="manual-final")d.build.stats.atk=2750;d.enemy.resistance=-.15;
    Object.assign(d.gameContext!.nicoleSkillInitial!,{includedSkillAttack:150,c2AttackIncludedInPanel:true,a1AttackIncludedInPanel:true,includedC2ResistanceReduction:.25});numeric(d,expected(2450,1.075));
    const stale=fixture();stale.gameContext!.nicoleSkillInitial!.a1AttackIncludedInPanel=true;numeric(stale,expected(1850));
  });
});

describe("Prune explicit non-Hexerei first-Swirl recast",()=>{
  const id="extended-prune-skill-c0";
  const fixture=()=>{const d=getCharacterDocuments("character:10000132",1).find(row=>row.gameContext?.skillId===id)!;d.scope="one-cast";d.characterLevel=90;d.gameContext!.ascension=6;d.gameContext!.constellation=0;
    d.build={mode:"manual-final",ascension:6,stats:{atk:2000,hp:20000,def:800,em:9999,critRate:.5,critDamage:1},source:"Fixed-source observed first Swirl and recast; no team reaction bonus"};d.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    d.gameContext!.extendedStanceCast={casterId:"prune",targetId:"enemy",freshCastConfirmed:true,noHitlag:true,noInterruption:true,noReplacement:true,fullObservedLifetime:true,observedThroughFrame:110,statsStableAcrossHits:true,
      followupActions:[{id:"recast",frame:28,actorId:"prune",kind:"skill"}],targetContacts:{initial:true,"recast:converted":true},
      prune:{hexerei:false,allInitialSwirlsRecorded:true,initialSwirls:[{id:"swirl",frame:26,actorId:"prune",targetId:"enemy",targetIsEnemy:true,element:"hydro",triggerCandidateId:"initial"}]}};return d;};
  // Independent pinned E1 coefficients; reactions are observations for conversion, not extra damage in this E sum.
  const initial=2000*1.6744*.5*.9*1.5, converted=2000*2.0456*.5*.9*1.5;
  const numeric=(d:CalculatorDocument,values=[initial,converted])=>{const r=calculateDocument(d);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(values.length);r.hits.forEach((h,i)=>expect(h.expected).toBeCloseTo(values[i]!,8));expect(r.totals?.expected).toBeCloseTo(values.reduce((a,b)=>a+b,0),8);};
  const blocked=(d:CalculatorDocument)=>{const r=calculateDocument(d);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  it("pins exact representatives and source-derived first-conversion arithmetic",()=>{
    const d=getCharacterDocuments("character:10000132",10).find(row=>row.gameContext?.skillId===id)!;expect(d.hits.map(h=>h.id)).toEqual([`${id}-initial`,`${id}-converted`]);const r=calculateDocument(d);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(4);r.blockers.forEach(b=>expect(b).toMatch(/^extended-stance:/));
    numeric(fixture());const p=prepareSourceCastDocument(fixture());expect(p.hits.map(h=>h.kind==="ordinary"&&[h.element,h.extendedStanceEvent?.frame,h.extendedStanceEvent?.snapshotFrame])).toEqual([["anemo",26,26],["hydro",58,58]]);
    const ordered=fixture();ordered.gameContext!.extendedStanceCast!.prune!.initialSwirls!.push({id:"second",frame:26,actorId:"prune",targetId:"enemy",targetIsEnemy:true,element:"pyro",triggerCandidateId:"initial"});numeric(ordered);const prepared=prepareSourceCastDocument(ordered);expect(prepared.hits[1]!.kind==="ordinary"&&prepared.hits[1]!.element).toBe("hydro");ordered.gameContext!.extendedStanceCast!.prune!.initialSwirls!.reverse();numeric(ordered);const reversed=prepareSourceCastDocument(ordered);expect(reversed.hits[1]!.kind==="ordinary"&&reversed.hits[1]!.element).toBe("pyro");
  });
  it("requires explicit histories, contact, performer and non-Hexerei qualification",()=>{
    for(const field of ["casterId","targetId","freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","observedThroughFrame","statsStableAcrossHits","followupActions","targetContacts","prune"] as const){const d=fixture();delete d.gameContext!.extendedStanceCast![field];blocked(d);}
    for(const field of ["freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","statsStableAcrossHits"] as const){const d=fixture();d.gameContext!.extendedStanceCast![field]=false;blocked(d);}
    for(const field of ["hexerei","allInitialSwirlsRecorded","initialSwirls"] as const){const d=fixture();delete d.gameContext!.extendedStanceCast!.prune![field];blocked(d);}
    const hex=fixture();hex.gameContext!.extendedStanceCast!.prune!.hexerei=true;blocked(hex);const history=fixture();history.gameContext!.extendedStanceCast!.prune!.allInitialSwirlsRecorded=false;blocked(history);
    for(const field of ["targetIsEnemy","element","triggerCandidateId"] as const){const d=fixture();delete d.gameContext!.extendedStanceCast!.prune!.initialSwirls![0]![field];blocked(d);}
    const wrong=fixture();wrong.gameContext!.extendedStanceCast!.followupActions![0]!.actorId="other";blocked(wrong);const noContact=fixture();delete noContact.gameContext!.extendedStanceCast!.targetContacts!["recast:converted"];blocked(noContact);
    const contradiction=fixture();contradiction.gameContext!.extendedStanceCast!.targetContacts!.initial=false;blocked(contradiction);contradiction.gameContext!.extendedStanceCast!.prune!.initialSwirls![0]!.targetId="other-enemy";numeric(contradiction,[converted]);const c1=fixture();c1.gameContext!.constellation=1;blocked(c1);
  });
  it("keeps inclusive recast window and the actual action tail even on known miss",()=>{
    const early=fixture();early.gameContext!.extendedStanceCast!.followupActions![0]!.frame=27;blocked(early);
    const last=fixture();last.gameContext!.extendedStanceCast!.followupActions![0]!.frame=390;last.gameContext!.extendedStanceCast!.observedThroughFrame=472;numeric(last);const p=prepareSourceCastDocument(last);expect(p.hits.map(h=>h.kind==="ordinary"&&h.extendedStanceEvent?.frame)).toEqual([26,420]);last.gameContext!.extendedStanceCast!.targetContacts!["recast:converted"]=false;numeric(last,[initial]);last.gameContext!.extendedStanceCast!.observedThroughFrame=471;blocked(last);
    const late=fixture();late.gameContext!.extendedStanceCast!.followupActions![0]!.frame=391;late.gameContext!.extendedStanceCast!.observedThroughFrame=473;blocked(late);
    const declined=fixture();declined.gameContext!.extendedStanceCast!.followupActions=[];declined.gameContext!.extendedStanceCast!.prune!.recastDeclined=true;declined.gameContext!.extendedStanceCast!.observedThroughFrame=391;numeric(declined,[initial]);declined.gameContext!.extendedStanceCast!.observedThroughFrame=390;blocked(declined);
    const empty=fixture();empty.gameContext!.extendedStanceCast!.followupActions=[];empty.gameContext!.extendedStanceCast!.prune!.initialSwirls=[];empty.gameContext!.extendedStanceCast!.prune!.recastDeclined=true;empty.gameContext!.extendedStanceCast!.observedThroughFrame=59;numeric(empty,[initial]);empty.gameContext!.extendedStanceCast!.observedThroughFrame=58;blocked(empty);
  });
  it("keeps actual selected hits separate from future schedule and explicit converted element",()=>{
    const d=fixture();d.scope="single-hit";d.selectedHitIds=[`${id}-initial`];d.gameContext!.extendedStanceCast={prune:{hexerei:false}};numeric(d,[initial]);d.gameContext!.extendedStanceCast!.prune!.hexerei=true;blocked(d);
    const c=fixture();c.scope="single-hit";c.selectedHitIds=[`${id}-converted`];c.gameContext!.extendedStanceCast={prune:{hexerei:false},sharedState:{convertedElement:"cryo"}};numeric(c,[converted]);delete c.gameContext!.extendedStanceCast!.sharedState!.convertedElement;blocked(c);c.gameContext!.extendedStanceCast!.sharedState!.convertedElement="physical";blocked(c);
  });
});
describe("Sandrone physical plunges use observed collision opportunities, not inferred height counts",()=>{
  const cases=[["low",2.948195],["high",3.682455]] as const;
  const fixture=(height:string)=>{
    const doc=getCharacterDocuments("character:10000133",10).find(row=>row.gameContext?.skillId===`sandrone-plunge-${height}-observed-base`)!;
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.constellation=0;
    doc.build={mode:"manual-final",stats:{atk:1000,hp:10000,def:700,em:0,critRate:.5,critDamage:1},source:"Two declared physical collision opportunities, one known miss, and actual landing; no inferred height threshold or trajectory timing"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.reaction="none";}
    doc.gameContext!.observedPlunge={noExternalInfusion:true,collisionCount:2,collisionContacts:{"1":true,"2":false},landingContact:true,statsStableAcrossHits:true};return doc;
  };
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  const numeric=(doc:CalculatorDocument,coefficients:readonly number[])=>{const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(coefficients.length);coefficients.forEach((c,i)=>expect(r.hits[i]!.nonCritical).toBeCloseTo(1000*c*.5*.9,8));expect(r.totals?.expected).toBeCloseTo(coefficients.reduce((a,b)=>a+b,0)*1000*.5*.9*1.5,8);};
  it.each(cases)("%s pins unknown default and independent collision/landing NA10 coefficients",(height,landing)=>{
    const r=calculateDocument(getCharacterDocuments("character:10000133",10).find(row=>row.gameContext?.skillId===`sandrone-plunge-${height}-observed-base`)!);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(1);expect(r.blockers[0]).toMatch(/^observed-plunge:/);
    expect(prepareSourceCastDocument(getCharacterDocuments("character:10000133",10).find(row=>row.gameContext?.skillId===`sandrone-plunge-${height}-observed-base`)!).hits.map(hit=>hit.id)).toEqual([`sandrone-plunge-${height}-observed-base:landing`]);
    // Independently pinned Sandrone combat1 NA10 vectors, not inferred from the observed expansion.
    numeric(fixture(height),[1.47441,landing]);
  });
  it.each(cases)("%s requires each opportunity's contact, actual count, landing and stable conditions",(height,landing)=>{
    for(const key of ["noExternalInfusion","collisionCount","collisionContacts","landingContact","statsStableAcrossHits"] as const){const doc=fixture(height);delete doc.gameContext!.observedPlunge![key];blocked(doc);}
    for(const key of ["noExternalInfusion","statsStableAcrossHits"] as const){const doc=fixture(height);doc.gameContext!.observedPlunge![key]=false;blocked(doc);}
    const unknown=fixture(height);delete unknown.gameContext!.observedPlunge!.collisionContacts!["2"];blocked(unknown);
    const both=fixture(height);both.gameContext!.observedPlunge!.collisionContacts!["2"]=true;numeric(both,[1.47441,1.47441,landing]);
    const noCollision=fixture(height);noCollision.gameContext!.observedPlunge!.collisionCount=0;noCollision.gameContext!.observedPlunge!.collisionContacts={};numeric(noCollision,[landing]);
    const missedLanding=fixture(height);missedLanding.gameContext!.observedPlunge!.landingContact=false;numeric(missedLanding,[1.47441]);
  });
  it.each(cases)("%s keeps no-contact distinct from zero numeric damage and retains physical C0 guard",height=>{
    const none=fixture(height);none.gameContext!.observedPlunge!.collisionContacts={"1":false,"2":false};none.gameContext!.observedPlunge!.landingContact=false;
    const r=calculateDocument(none);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(1);expect(r.hits[0]!.status).toBe("non-damaging");expect(r.totals).toBeUndefined();
    const c1=fixture(height);c1.gameContext!.constellation=1;blocked(c1);
    const reaction=fixture(height);if(reaction.hits[0]!.kind!=="ordinary")throw Error("ordinary");reaction.hits[0]!.reaction="melt";blocked(reaction);
    const additive=fixture(height);if(additive.hits[0]!.kind!=="ordinary")throw Error("ordinary");additive.hits[0]!.additiveReaction="spread";blocked(additive);
  });
  it.each(cases)("%s actual selected collision or landing does not require unselected future trajectory",(height,landing)=>{
    for(const [role,coefficient] of [["collision-1",1.47441],["landing",landing]] as const){const doc=prepareSourceCastDocument(fixture(height));doc.scope="single-hit";doc.selectedHitIds=[doc.hits.find(hit=>hit.id.endsWith(`:${role}`))!.id];doc.gameContext!.observedPlunge={noExternalInfusion:true};numeric(doc,[coefficient]);delete doc.gameContext!.observedPlunge!.noExternalInfusion;blocked(doc);}
  });
});

describe("Sandrone actual Stellar-Conduct beam component",()=>{
  const id="sandrone-charged-beam-stellar-conduct-component";
  const fixture=()=>{const d=getCharacterDocuments("character:10000133",1).find(row=>row.gameContext?.skillId===id)!;d.characterLevel=90;d.gameContext!.ascension=6;d.gameContext!.constellation=0;
    d.build={mode:"manual-final",ascension:6,stats:{atk:1000,hp:20000,def:9000,em:200,critRate:0,critDamage:0},source:"One actually occurred beam, separately observed intrinsic and pre-conversion ATK"};d.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    d.gameContext!.observedSpecialComponent={casterId:"sandrone",targetId:"enemy",actualComponentOccurred:true,independentEvent:{candidateId:"beam",frame:20,snapshotFrame:20,snapshotId:"sample",targetId:"enemy"},sharedState:{actualIntrinsicStat:500,specialBaseBonus:0,includedIntrinsicBaseBonus:0,reactionBonus:0,specialAdditive:0,elevationMultiplier:1,a4PreConversionStat:800,includedCharacterEm:0,actualRadiance:"stellar-conduct",decodingMode:true,polestarApplicationCount:0}};return d;};
  // Pinned auto[5][0]=.817; direct Conduct count0 coefficient1, no ordinary DEF. Distinct A4 sample800 ->64EM.
  const expected=(em=264,intrinsic=.035,multiplier=1)=>1000*.817*(1+intrinsic)*(1+6*em/(em+2000))*.9*multiplier;
  const numeric=(d:CalculatorDocument,value=expected())=>{const r=calculateDocument(d);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(1);expect(r.totals?.expected).toBeCloseTo(value,8);};
  const blocked=(d:CalculatorDocument)=>{const r=calculateDocument(d);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  it("pins singleton unknown component and independently sampled ATK/EM/Polestar arithmetic",()=>{
    const d=getCharacterDocuments("character:10000133",10).find(row=>row.gameContext?.skillId===id)!;expect(d.scope).toBe("single-hit");const r=calculateDocument(d);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(1);expect(r.blockers[0]).toMatch(/^observed-special-component:source/);numeric(fixture());
    const p=prepareSourceCastDocument(fixture());expect(p.hits[0]!.kind==="special"&&p.hits[0]!.observedSpecialComponentEvent).toEqual({candidateId:"beam",frame:20,snapshotFrame:20,snapshotId:"sample",targetId:"enemy"});
    for(const [count,multiplier] of [[1,1.45],[12,2]] as const){const d=fixture();d.gameContext!.observedSpecialComponent!.sharedState!.polestarApplicationCount=count;numeric(d,expected(264,.035,multiplier));}
  });
  it("requires actual branch, mode, sample and accounting without generating a stance",()=>{
    for(const field of ["actualComponentOccurred","independentEvent","sharedState"] as const){const d=fixture();delete d.gameContext!.observedSpecialComponent![field];blocked(d);}
    for(const field of ["actualIntrinsicStat","specialBaseBonus","includedIntrinsicBaseBonus","reactionBonus","specialAdditive","elevationMultiplier","a4PreConversionStat","includedCharacterEm","actualRadiance","decodingMode","polestarApplicationCount"] as const){const d=fixture();delete d.gameContext!.observedSpecialComponent!.sharedState![field];blocked(d);}
    const occurred=fixture();occurred.gameContext!.observedSpecialComponent!.actualComponentOccurred=false;blocked(occurred);const mode=fixture();mode.gameContext!.observedSpecialComponent!.sharedState!.decodingMode=false;blocked(mode);const radiance=fixture();radiance.gameContext!.observedSpecialComponent!.sharedState!.actualRadiance="stellar-swirl";blocked(radiance);
    const future=fixture();future.gameContext!.observedSpecialComponent!.independentEvent!.snapshotFrame=21;blocked(future);const target=fixture();target.gameContext!.observedSpecialComponent!.independentEvent!.targetId="other";blocked(target);
    const asc=fixture();delete asc.gameContext!.ascension;if(asc.build.mode==="manual-final")delete asc.build.ascension;blocked(asc);const c1=fixture();c1.gameContext!.constellation=1;blocked(c1);const talent=fixture();talent.gameContext!.abilityId="talent:sandrone:combat2";blocked(talent);
  });
  it("keeps independent zero/cap samples, included shares and lower-ASC passive scope",()=>{
    const zero=fixture();zero.gameContext!.observedSpecialComponent!.sharedState!.a4PreConversionStat=0;numeric(zero,expected(200));const cap=fixture();cap.gameContext!.observedSpecialComponent!.sharedState!.a4PreConversionStat=3000;numeric(cap,expected(360));
    const intrinsic=fixture();intrinsic.gameContext!.observedSpecialComponent!.sharedState!.actualIntrinsicStat=0;numeric(intrinsic,expected(264,0));intrinsic.gameContext!.observedSpecialComponent!.sharedState!.actualIntrinsicStat=3000;numeric(intrinsic,expected(264,.14));
    const same=fixture();delete same.gameContext!.observedSpecialComponent!.sharedState!.actualIntrinsicStat;same.gameContext!.observedSpecialComponent!.sharedState!.intrinsicStatMatchesSnapshot=true;numeric(same,expected(264,.07));same.gameContext!.observedSpecialComponent!.sharedState!.intrinsicStatMatchesSnapshot=false;blocked(same);
    const included=fixture();if(included.build.mode==="manual-final")included.build.stats.em=264;Object.assign(included.gameContext!.observedSpecialComponent!.sharedState!,{includedCharacterEm:64,specialBaseBonus:.035,includedIntrinsicBaseBonus:.035});numeric(included);
    const low=fixture();low.gameContext!.ascension=3;if(low.build.mode==="manual-final")low.build.ascension=3;delete low.gameContext!.observedSpecialComponent!.sharedState!.a4PreConversionStat;delete low.gameContext!.observedSpecialComponent!.sharedState!.includedCharacterEm;numeric(low,expected(200));low.gameContext!.observedSpecialComponent!.sharedState!.includedCharacterEm=64;numeric(low,expected(136));
    const irrelevant=fixture();Object.assign(irrelevant.gameContext!.observedSpecialComponent!.sharedState!,{decodingPowerAtSkill:100,refinedTacticsConsumed:10});numeric(irrelevant);
  });
});

describe("Sandrone actual Stellar-Swirl beam component",()=>{
  const id="sandrone-charged-beam-stellar-swirl-component";
  const fixture=()=>{const d=getCharacterDocuments("character:10000133",1).find(row=>row.gameContext?.skillId===id)!;d.characterLevel=90;d.gameContext!.ascension=6;d.gameContext!.constellation=0;
    d.build={mode:"manual-final",ascension:6,stats:{atk:1000,hp:20000,def:9000,em:200,critRate:0,critDamage:0},source:"One actually occurred beam, separately observed intrinsic and pre-conversion ATK"};d.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    d.gameContext!.observedSpecialComponent={casterId:"sandrone",targetId:"enemy",actualComponentOccurred:true,independentEvent:{candidateId:"beam",frame:20,snapshotFrame:20,snapshotId:"sample",targetId:"enemy"},sharedState:{actualIntrinsicStat:500,specialBaseBonus:0,includedIntrinsicBaseBonus:0,reactionBonus:0,specialAdditive:0,elevationMultiplier:1,a4PreConversionStat:800,includedCharacterEm:0,actualRadiance:"stellar-swirl",decodingMode:true}};return d;};
  // Existing source adjudication preserves the conflicting node auto[5] in raw evidence; no game-measurement claim.
  // Pinned adjudicated auto[10][0]=1.2255; direct Swirl coefficient1, no ordinary DEF. Distinct A4 sample800 ->64EM.
  const expected=(em=264,intrinsic=.035)=>1000*1.2255*(1+intrinsic)*(1+6*em/(em+2000))*.9;
  const numeric=(d:CalculatorDocument,value=expected())=>{const r=calculateDocument(d);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(1);expect(r.totals?.expected).toBeCloseTo(value,8);};
  const blocked=(d:CalculatorDocument)=>{const r=calculateDocument(d);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  it("pins singleton unknown component and independently sampled ATK/EM arithmetic",()=>{
    const d=getCharacterDocuments("character:10000133",10).find(row=>row.gameContext?.skillId===id)!;expect(d.scope).toBe("single-hit");const r=calculateDocument(d);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(1);expect(r.blockers[0]).toMatch(/^observed-special-component:source/);numeric(fixture());
    const p=prepareSourceCastDocument(fixture());expect(p.hits[0]!.kind==="special"&&p.hits[0]!.observedSpecialComponentEvent).toEqual({candidateId:"beam",frame:20,snapshotFrame:20,snapshotId:"sample",targetId:"enemy"});
    const noConduct=fixture();noConduct.gameContext!.observedSpecialComponent!.sharedState!.polestarApplicationCount=12;numeric(noConduct); // Conduct-only count cannot multiply a Swirl component.
  });
  it("requires actual branch, mode, sample and accounting without generating a stance",()=>{
    for(const field of ["actualComponentOccurred","independentEvent","sharedState"] as const){const d=fixture();delete d.gameContext!.observedSpecialComponent![field];blocked(d);}
    for(const field of ["actualIntrinsicStat","specialBaseBonus","includedIntrinsicBaseBonus","reactionBonus","specialAdditive","elevationMultiplier","a4PreConversionStat","includedCharacterEm","actualRadiance","decodingMode"] as const){const d=fixture();delete d.gameContext!.observedSpecialComponent!.sharedState![field];blocked(d);}
    const occurred=fixture();occurred.gameContext!.observedSpecialComponent!.actualComponentOccurred=false;blocked(occurred);const mode=fixture();mode.gameContext!.observedSpecialComponent!.sharedState!.decodingMode=false;blocked(mode);const radiance=fixture();radiance.gameContext!.observedSpecialComponent!.sharedState!.actualRadiance="stellar-conduct";blocked(radiance);
    const future=fixture();future.gameContext!.observedSpecialComponent!.independentEvent!.snapshotFrame=21;blocked(future);const target=fixture();target.gameContext!.observedSpecialComponent!.independentEvent!.targetId="other";blocked(target);
    const asc=fixture();delete asc.gameContext!.ascension;if(asc.build.mode==="manual-final")delete asc.build.ascension;blocked(asc);const c1=fixture();c1.gameContext!.constellation=1;blocked(c1);const talent=fixture();talent.gameContext!.abilityId="talent:sandrone:combat2";blocked(talent);
  });
  it("keeps independent zero/cap samples, included shares and lower-ASC passive scope",()=>{
    const zero=fixture();zero.gameContext!.observedSpecialComponent!.sharedState!.a4PreConversionStat=0;numeric(zero,expected(200));const cap=fixture();cap.gameContext!.observedSpecialComponent!.sharedState!.a4PreConversionStat=3000;numeric(cap,expected(360));
    const intrinsic=fixture();intrinsic.gameContext!.observedSpecialComponent!.sharedState!.actualIntrinsicStat=0;numeric(intrinsic,expected(264,0));intrinsic.gameContext!.observedSpecialComponent!.sharedState!.actualIntrinsicStat=3000;numeric(intrinsic,expected(264,.14));
    const same=fixture();delete same.gameContext!.observedSpecialComponent!.sharedState!.actualIntrinsicStat;same.gameContext!.observedSpecialComponent!.sharedState!.intrinsicStatMatchesSnapshot=true;numeric(same,expected(264,.07));same.gameContext!.observedSpecialComponent!.sharedState!.intrinsicStatMatchesSnapshot=false;blocked(same);
    const included=fixture();if(included.build.mode==="manual-final")included.build.stats.em=264;Object.assign(included.gameContext!.observedSpecialComponent!.sharedState!,{includedCharacterEm:64,specialBaseBonus:.035,includedIntrinsicBaseBonus:.035});numeric(included);
    const low=fixture();low.gameContext!.ascension=3;if(low.build.mode==="manual-final")low.build.ascension=3;delete low.gameContext!.observedSpecialComponent!.sharedState!.a4PreConversionStat;delete low.gameContext!.observedSpecialComponent!.sharedState!.includedCharacterEm;numeric(low,expected(200));low.gameContext!.observedSpecialComponent!.sharedState!.includedCharacterEm=64;numeric(low,expected(136));
    const irrelevant=fixture();Object.assign(irrelevant.gameContext!.observedSpecialComponent!.sharedState!,{decodingPowerAtSkill:100,refinedTacticsConsumed:10});numeric(irrelevant);
  });
});

describe("Sandrone actual prism Conduct and Swirl components",()=>{
  const cases=[["conduct",.216,.3888],["swirl",.324,.5832]] as const;
  const fixture=(branch:"conduct"|"swirl")=>{const id=`sandrone-skill-prism-stellar-${branch}-component`;const d=getCharacterDocuments("character:10000133",1).find(row=>row.gameContext?.skillId===id)!;d.characterLevel=90;d.gameContext!.ascension=6;d.gameContext!.constellation=0;
    d.build={mode:"manual-final",ascension:6,stats:{atk:1000,hp:20000,def:9000,em:200,critRate:0,critDamage:0},source:"One actual prism; separate intrinsic and pre-conversion ATK"};d.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    d.gameContext!.observedSpecialComponent={casterId:"sandrone",targetId:"enemy",actualComponentOccurred:true,independentEvent:{candidateId:"prism",frame:20,snapshotFrame:20,snapshotId:"sample",targetId:"enemy"},sharedState:{actualIntrinsicStat:500,specialBaseBonus:0,includedIntrinsicBaseBonus:0,reactionBonus:0,specialAdditive:0,elevationMultiplier:1,a4PreConversionStat:800,includedCharacterEm:0,actualRadiance:`stellar-${branch}`,decodingPowerAtSkill:51,...(branch==="conduct"?{polestarApplicationCount:0}:{})}};return d;};
  // Source-derived literal E vectors, distinct from beam/Q. A1 multiplies the talent term, never the special additive term.
  const expected=(coefficient:number,heatMultiplier=4,em=264,intrinsic=.035,polestar=1,additive=0)=>(1000*coefficient*heatMultiplier*(1+intrinsic)*(1+6*em/(em+2000))*polestar+additive)*.9;
  const numeric=(d:CalculatorDocument,value:number)=>{const r=calculateDocument(d);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(1);expect(r.totals?.expected).toBeCloseTo(value,8);};
  const blocked=(d:CalculatorDocument)=>{const r=calculateDocument(d);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  it.each(cases)("%s pins its singleton source identity and independent talent/A1 arithmetic",(branch,c,c10)=>{
    const id=`sandrone-skill-prism-stellar-${branch}-component`,d=getCharacterDocuments("character:10000133",10).find(row=>row.gameContext?.skillId===id)!;expect(d.scope).toBe("single-hit");const r=calculateDocument(d);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(1);expect(r.blockers[0]).toMatch(/^observed-special-component:source/);numeric(fixture(branch),expected(c));
    const level=fixture(branch);level.gameContext!.effectiveTalentLevel=10;numeric(level,expected(c10));
    for(const heat of [0,50]){const x=fixture(branch);x.gameContext!.observedSpecialComponent!.sharedState!.decodingPowerAtSkill=heat;numeric(x,expected(c,1));}
    const additive=fixture(branch);additive.gameContext!.observedSpecialComponent!.sharedState!.specialAdditive=100;numeric(additive,expected(c,4,264,.035,1,100));
    const notBeam=fixture(branch);Object.assign(notBeam.gameContext!.observedSpecialComponent!.sharedState!,{decodingMode:false,refinedTacticsConsumed:10});numeric(notBeam,expected(c));
    const count=fixture(branch);count.gameContext!.observedSpecialComponent!.sharedState!.polestarApplicationCount=12;numeric(count,expected(c,4,264,.035,branch==="conduct"?2:1));
  });
  it.each(cases)("%s requires only its actual component, source samples and branch-specific operands",(branch,c)=>{
    for(const field of ["actualComponentOccurred","independentEvent","sharedState"] as const){const d=fixture(branch);delete d.gameContext!.observedSpecialComponent![field];blocked(d);}
    for(const field of ["actualIntrinsicStat","specialBaseBonus","includedIntrinsicBaseBonus","reactionBonus","specialAdditive","elevationMultiplier","a4PreConversionStat","includedCharacterEm","actualRadiance","decodingPowerAtSkill"] as const){const d=fixture(branch);delete d.gameContext!.observedSpecialComponent!.sharedState![field];blocked(d);}
    const count=fixture(branch);delete count.gameContext!.observedSpecialComponent!.sharedState!.polestarApplicationCount;if(branch==="conduct")blocked(count);else numeric(count,expected(c));
    const occurred=fixture(branch);occurred.gameContext!.observedSpecialComponent!.actualComponentOccurred=false;blocked(occurred);const radiance=fixture(branch);radiance.gameContext!.observedSpecialComponent!.sharedState!.actualRadiance=branch==="conduct"?"stellar-swirl":"stellar-conduct";blocked(radiance);
    const future=fixture(branch);future.gameContext!.observedSpecialComponent!.independentEvent!.snapshotFrame=21;blocked(future);const target=fixture(branch);target.gameContext!.observedSpecialComponent!.independentEvent!.targetId="other";blocked(target);
    const asc=fixture(branch);delete asc.gameContext!.ascension;if(asc.build.mode==="manual-final")delete asc.build.ascension;blocked(asc);const c1=fixture(branch);c1.gameContext!.constellation=1;blocked(c1);const talent=fixture(branch);talent.gameContext!.abilityId="talent:sandrone:combat1";blocked(talent);
  });
  it.each(cases)("%s separates A1 and A4 gates, actual samples and included shares",(branch,c)=>{
    const zero=fixture(branch);zero.gameContext!.observedSpecialComponent!.sharedState!.a4PreConversionStat=0;numeric(zero,expected(c,4,200));const cap=fixture(branch);cap.gameContext!.observedSpecialComponent!.sharedState!.a4PreConversionStat=3000;numeric(cap,expected(c,4,360));
    const intrinsic=fixture(branch);intrinsic.gameContext!.observedSpecialComponent!.sharedState!.actualIntrinsicStat=0;numeric(intrinsic,expected(c,4,264,0));intrinsic.gameContext!.observedSpecialComponent!.sharedState!.actualIntrinsicStat=3000;numeric(intrinsic,expected(c,4,264,.14));
    const same=fixture(branch);delete same.gameContext!.observedSpecialComponent!.sharedState!.actualIntrinsicStat;same.gameContext!.observedSpecialComponent!.sharedState!.intrinsicStatMatchesSnapshot=true;numeric(same,expected(c,4,264,.07));same.gameContext!.observedSpecialComponent!.sharedState!.intrinsicStatMatchesSnapshot=false;blocked(same);
    const included=fixture(branch);if(included.build.mode==="manual-final")included.build.stats.em=264;Object.assign(included.gameContext!.observedSpecialComponent!.sharedState!,{includedCharacterEm:64,specialBaseBonus:.035,includedIntrinsicBaseBonus:.035});numeric(included,expected(c));
    const low=fixture(branch);low.gameContext!.ascension=3;if(low.build.mode==="manual-final")low.build.ascension=3;delete low.gameContext!.observedSpecialComponent!.sharedState!.a4PreConversionStat;delete low.gameContext!.observedSpecialComponent!.sharedState!.includedCharacterEm;numeric(low,expected(c,4,200));delete low.gameContext!.observedSpecialComponent!.sharedState!.decodingPowerAtSkill;blocked(low);
    low.gameContext!.ascension=0;if(low.build.mode==="manual-final")low.build.ascension=0;numeric(low,expected(c,1,200));
  });
});

describe("Sandrone actual burst ray Conduct and Swirl components",()=>{
  const cases=[["conduct",2.205333,3.9696],["swirl",3.308,5.9544]] as const;
  const fixture=(branch:"conduct"|"swirl")=>{const id=`sandrone-burst-ray-stellar-${branch}-component`;const d=getCharacterDocuments("character:10000133",1).find(row=>row.gameContext?.skillId===id)!;d.characterLevel=90;d.gameContext!.ascension=6;d.gameContext!.constellation=0;
    d.build={mode:"manual-final",ascension:6,stats:{atk:1000,hp:20000,def:9000,em:200,critRate:0,critDamage:0},source:"One actual burst ray; separate intrinsic and pre-conversion ATK"};d.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    d.gameContext!.observedSpecialComponent={casterId:"sandrone",targetId:"enemy",actualComponentOccurred:true,independentEvent:{candidateId:"ray",frame:20,snapshotFrame:20,snapshotId:"sample",targetId:"enemy"},sharedState:{actualIntrinsicStat:500,specialBaseBonus:0,includedIntrinsicBaseBonus:0,reactionBonus:0,specialAdditive:0,elevationMultiplier:1,a4PreConversionStat:800,includedCharacterEm:0,actualRadiance:`stellar-${branch}`,refinedTacticsConsumed:5,...(branch==="conduct"?{polestarApplicationCount:0}:{})}};return d;};
  // Existing adjudication uses archived Q consumed-stack tooltip despite the shared raw a1Decoding node; no game-measurement claim.
  // Source-derived literal Q vectors, retaining six-decimal Conduct precision; distinct from beam/E. A1 multiplies the talent term, never the special additive term.
  const expected=(coefficient:number,tacticsMultiplier=1.5,em=264,intrinsic=.035,polestar=1,additive=0)=>(1000*coefficient*tacticsMultiplier*(1+intrinsic)*(1+6*em/(em+2000))*polestar+additive)*.9;
  const numeric=(d:CalculatorDocument,value:number)=>{const r=calculateDocument(d);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(1);expect(r.totals?.expected).toBeCloseTo(value,8);};
  const blocked=(d:CalculatorDocument)=>{const r=calculateDocument(d);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  it.each(cases)("%s pins its singleton source identity and independent talent/A1 arithmetic",(branch,c,c10)=>{
    const id=`sandrone-burst-ray-stellar-${branch}-component`,d=getCharacterDocuments("character:10000133",10).find(row=>row.gameContext?.skillId===id)!;expect(d.scope).toBe("single-hit");const r=calculateDocument(d);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(1);expect(r.blockers[0]).toMatch(/^observed-special-component:source/);numeric(fixture(branch),expected(c));
    const level=fixture(branch);level.gameContext!.effectiveTalentLevel=10;numeric(level,expected(c10));
    for(const [count,multiplier] of [[0,1],[10,2]] as const){const x=fixture(branch);x.gameContext!.observedSpecialComponent!.sharedState!.refinedTacticsConsumed=count;numeric(x,expected(c,multiplier));}
    const additive=fixture(branch);additive.gameContext!.observedSpecialComponent!.sharedState!.specialAdditive=100;numeric(additive,expected(c,1.5,264,.035,1,100));
    const notBeam=fixture(branch);Object.assign(notBeam.gameContext!.observedSpecialComponent!.sharedState!,{decodingMode:false,decodingPowerAtSkill:0});numeric(notBeam,expected(c));notBeam.gameContext!.observedSpecialComponent!.sharedState!.decodingPowerAtSkill=100;numeric(notBeam,expected(c));
    const count=fixture(branch);count.gameContext!.observedSpecialComponent!.sharedState!.polestarApplicationCount=12;numeric(count,expected(c,1.5,264,.035,branch==="conduct"?2:1));
  });
  it.each(cases)("%s requires only its actual component, source samples and branch-specific operands",(branch,c)=>{
    for(const field of ["actualComponentOccurred","independentEvent","sharedState"] as const){const d=fixture(branch);delete d.gameContext!.observedSpecialComponent![field];blocked(d);}
    for(const field of ["actualIntrinsicStat","specialBaseBonus","includedIntrinsicBaseBonus","reactionBonus","specialAdditive","elevationMultiplier","a4PreConversionStat","includedCharacterEm","actualRadiance","refinedTacticsConsumed"] as const){const d=fixture(branch);delete d.gameContext!.observedSpecialComponent!.sharedState![field];blocked(d);}
    const count=fixture(branch);delete count.gameContext!.observedSpecialComponent!.sharedState!.polestarApplicationCount;if(branch==="conduct")blocked(count);else numeric(count,expected(c));
    const occurred=fixture(branch);occurred.gameContext!.observedSpecialComponent!.actualComponentOccurred=false;blocked(occurred);const radiance=fixture(branch);radiance.gameContext!.observedSpecialComponent!.sharedState!.actualRadiance=branch==="conduct"?"stellar-swirl":"stellar-conduct";blocked(radiance);
    const future=fixture(branch);future.gameContext!.observedSpecialComponent!.independentEvent!.snapshotFrame=21;blocked(future);const target=fixture(branch);target.gameContext!.observedSpecialComponent!.independentEvent!.targetId="other";blocked(target);
    const asc=fixture(branch);delete asc.gameContext!.ascension;if(asc.build.mode==="manual-final")delete asc.build.ascension;blocked(asc);const c1=fixture(branch);c1.gameContext!.constellation=1;blocked(c1);const talent=fixture(branch);talent.gameContext!.abilityId="talent:sandrone:combat2";blocked(talent);
  });
  it.each(cases)("%s separates A1 and A4 gates, actual samples and included shares",(branch,c)=>{
    const zero=fixture(branch);zero.gameContext!.observedSpecialComponent!.sharedState!.a4PreConversionStat=0;numeric(zero,expected(c,1.5,200));const cap=fixture(branch);cap.gameContext!.observedSpecialComponent!.sharedState!.a4PreConversionStat=3000;numeric(cap,expected(c,1.5,360));
    const intrinsic=fixture(branch);intrinsic.gameContext!.observedSpecialComponent!.sharedState!.actualIntrinsicStat=0;numeric(intrinsic,expected(c,1.5,264,0));intrinsic.gameContext!.observedSpecialComponent!.sharedState!.actualIntrinsicStat=3000;numeric(intrinsic,expected(c,1.5,264,.14));
    const same=fixture(branch);delete same.gameContext!.observedSpecialComponent!.sharedState!.actualIntrinsicStat;same.gameContext!.observedSpecialComponent!.sharedState!.intrinsicStatMatchesSnapshot=true;numeric(same,expected(c,1.5,264,.07));same.gameContext!.observedSpecialComponent!.sharedState!.intrinsicStatMatchesSnapshot=false;blocked(same);
    const included=fixture(branch);if(included.build.mode==="manual-final")included.build.stats.em=264;Object.assign(included.gameContext!.observedSpecialComponent!.sharedState!,{includedCharacterEm:64,specialBaseBonus:.035,includedIntrinsicBaseBonus:.035});numeric(included,expected(c));
    const low=fixture(branch);low.gameContext!.ascension=3;if(low.build.mode==="manual-final")low.build.ascension=3;delete low.gameContext!.observedSpecialComponent!.sharedState!.a4PreConversionStat;delete low.gameContext!.observedSpecialComponent!.sharedState!.includedCharacterEm;numeric(low,expected(c,1.5,200));delete low.gameContext!.observedSpecialComponent!.sharedState!.refinedTacticsConsumed;blocked(low);
    low.gameContext!.ascension=0;if(low.build.mode==="manual-final")low.build.ascension=0;numeric(low,expected(c,1,200));
  });
});

describe("Alyosha physical plunges use observed collision opportunities, not inferred height counts",()=>{
  const cases=[["low",2.527025],["high",3.15639]] as const;
  const fixture=(height:string)=>{
    const doc=getCharacterDocuments("character:10000148",10).find(row=>row.gameContext?.skillId===`alyosha-plunge-${height}-observed-base`)!;
    doc.scope="one-cast";doc.selectedHitIds=doc.hits.map(hit=>hit.id);doc.characterLevel=90;doc.gameContext!.constellation=0;
    doc.build={mode:"manual-final",stats:{atk:1000,hp:10000,def:700,em:0,critRate:.5,critDamage:1},source:"Two declared physical collision opportunities, one known miss, and actual landing; no inferred height threshold or trajectory timing"};
    doc.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};for(const hit of doc.hits)if(hit.kind==="ordinary"){hit.damageBonus=0;hit.reaction="none";}
    doc.gameContext!.observedPlunge={noExternalInfusion:true,collisionCount:2,collisionContacts:{"1":true,"2":false},landingContact:true,statsStableAcrossHits:true};return doc;
  };
  const blocked=(doc:CalculatorDocument)=>{const r=calculateDocument(doc);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  const numeric=(doc:CalculatorDocument,coefficients:readonly number[])=>{const r=calculateDocument(doc);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(coefficients.length);coefficients.forEach((c,i)=>expect(r.hits[i]!.nonCritical).toBeCloseTo(1000*c*.5*.9,8));expect(r.totals?.expected).toBeCloseTo(coefficients.reduce((a,b)=>a+b,0)*1000*.5*.9*1.5,8);};
  it.each(cases)("%s pins unknown default and independent collision/landing NA10 coefficients",(height,landing)=>{
    const r=calculateDocument(getCharacterDocuments("character:10000148",10).find(row=>row.gameContext?.skillId===`alyosha-plunge-${height}-observed-base`)!);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(1);expect(r.blockers[0]).toMatch(/^observed-plunge:/);
    expect(prepareSourceCastDocument(getCharacterDocuments("character:10000148",10).find(row=>row.gameContext?.skillId===`alyosha-plunge-${height}-observed-base`)!).hits.map(hit=>hit.id)).toEqual([`alyosha-plunge-${height}-observed-base:landing`]);
    // Independently pinned Alyosha combat1 NA10 vectors, not inferred from the observed expansion.
    numeric(fixture(height),[1.26378,landing]);
  });
  it.each(cases)("%s requires each opportunity's contact, actual count, landing and stable conditions",(height,landing)=>{
    for(const key of ["noExternalInfusion","collisionCount","collisionContacts","landingContact","statsStableAcrossHits"] as const){const doc=fixture(height);delete doc.gameContext!.observedPlunge![key];blocked(doc);}
    for(const key of ["noExternalInfusion","statsStableAcrossHits"] as const){const doc=fixture(height);doc.gameContext!.observedPlunge![key]=false;blocked(doc);}
    const unknown=fixture(height);delete unknown.gameContext!.observedPlunge!.collisionContacts!["2"];blocked(unknown);
    const both=fixture(height);both.gameContext!.observedPlunge!.collisionContacts!["2"]=true;numeric(both,[1.26378,1.26378,landing]);
    const noCollision=fixture(height);noCollision.gameContext!.observedPlunge!.collisionCount=0;noCollision.gameContext!.observedPlunge!.collisionContacts={};numeric(noCollision,[landing]);
    const missedLanding=fixture(height);missedLanding.gameContext!.observedPlunge!.landingContact=false;numeric(missedLanding,[1.26378]);
  });
  it.each(cases)("%s keeps no-contact distinct from zero numeric damage and retains physical C0 guard",height=>{
    const none=fixture(height);none.gameContext!.observedPlunge!.collisionContacts={"1":false,"2":false};none.gameContext!.observedPlunge!.landingContact=false;
    const r=calculateDocument(none);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(1);expect(r.hits[0]!.status).toBe("non-damaging");expect(r.totals).toBeUndefined();
    const c1=fixture(height);c1.gameContext!.constellation=1;blocked(c1);
    const reaction=fixture(height);if(reaction.hits[0]!.kind!=="ordinary")throw Error("ordinary");reaction.hits[0]!.reaction="melt";blocked(reaction);
    const additive=fixture(height);if(additive.hits[0]!.kind!=="ordinary")throw Error("ordinary");additive.hits[0]!.additiveReaction="spread";blocked(additive);
  });
  it.each(cases)("%s actual selected collision or landing does not require unselected future trajectory",(height,landing)=>{
    for(const [role,coefficient] of [["collision-1",1.26378],["landing",landing]] as const){const doc=prepareSourceCastDocument(fixture(height));doc.scope="single-hit";doc.selectedHitIds=[doc.hits.find(hit=>hit.id.endsWith(`:${role}`))!.id];doc.gameContext!.observedPlunge={noExternalInfusion:true};numeric(doc,[coefficient]);delete doc.gameContext!.observedPlunge!.noExternalInfusion;blocked(doc);}
  });
});

describe("Odette fresh ordinary E entity without upgrade or refresh",()=>{
  const id="entity-followup-odette-skill-c0";
  // Source-derived a7dc4bf E1 oracle, not a preexisting Odette entity numeric suite.
  const events=[["initial",23,1.0808],["dance-1",157,.4304],["dance-2",266,.51464],["dance-3",391,.4304],["dance-4",500,.51464],["dance-5",625,.4304],["dance-6",734,.51464],["dance-7",859,.4304],["dance-8",968,.51464],["dance-9",1093,.4304],["dance-10",1202,.51464]] as const;
  const fixture=()=>{const d=getCharacterDocuments("character:10000150",1).find(x=>x.gameContext?.skillId===id)!;d.scope="one-cast";d.selectedHitIds=d.hits.map(x=>x.id);d.characterLevel=90;d.gameContext!.constellation=0;
    d.build={mode:"manual-final",stats:{atk:1000,hp:10000,def:700,em:9999,critRate:.5,critDamage:1},source:"Authored fresh C0 ordinary Dance Double contact history; no Stellar upgrade, refresh or inferred target geometry"};d.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};for(const h of d.hits)if(h.kind==="ordinary"){h.damageBonus=0;h.reaction="none";}
    d.gameContext!.entityFollowupCast={casterId:"odette",targetId:"enemy",freshCastConfirmed:true,noHitlag:true,noInterruption:true,noReplacement:true,fullObservedLifetime:true,observedThroughFrame:1286,statsStableAcrossHits:true,targetContacts:Object.fromEntries(events.map(([key])=>[key,true])),odette:{noPriorDanceDouble:true,noUpgradeThroughout:true,noCodaOrRefreshThroughout:true}};return d;};
  const blocked=(d:CalculatorDocument)=>{const r=calculateDocument(d);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  const numeric=(d:CalculatorDocument,expected:readonly (readonly [string,number,number])[]=events)=>{const p=prepareSourceCastDocument(d);expect(p.hits.map(h=>h.kind==="ordinary"?[h.entityFollowupEvent?.candidateId,h.entityFollowupEvent?.frame,h.entityFollowupEvent?.snapshotFrame,h.entityFollowupEvent?.ownerId]:[])).toEqual(expected.map(([key,frame])=>[key,frame,frame,"odette"]));const r=calculateDocument(d);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(expected.length);expected.forEach(([, ,c],i)=>expect(r.hits[i]!.nonCritical).toBeCloseTo(1000*c*.5*.9,8));expect(r.totals?.expected).toBeCloseTo(expected.reduce((sum,[,,c])=>sum+c,0)*1000*.5*.9*1.5,8);};
  it("pins three unknown representatives and eleven independently valued ordinary contacts",()=>{const d=getCharacterDocuments("character:10000150",10).find(x=>x.gameContext?.skillId===id)!;const p=prepareSourceCastDocument(d);expect(p.hits.map(h=>h.id)).toEqual([`${id}-initial`,`${id}-plume`,`${id}-wing`]);const r=calculateDocument(d);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(3);for(const b of r.blockers)expect(b).toMatch(/^entity-followup:schedule/);numeric(fixture());const ten=fixture();ten.gameContext!.effectiveTalentLevel=10;numeric(ten,events.map(([key,frame,c])=>[key,frame,c*1.8] as const));});
  it("requires complete actual lifetime, branch and contact evidence rather than unknown defaults",()=>{for(const field of ["casterId","targetId","freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","observedThroughFrame","statsStableAcrossHits","targetContacts","odette"] as const){const d=fixture();delete d.gameContext!.entityFollowupCast![field];blocked(d);}for(const field of ["freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","statsStableAcrossHits"] as const){const d=fixture();d.gameContext!.entityFollowupCast![field]=false;blocked(d);}for(const field of ["noPriorDanceDouble","noUpgradeThroughout","noCodaOrRefreshThroughout"] as const){const d=fixture();delete d.gameContext!.entityFollowupCast!.odette![field];blocked(d);d.gameContext!.entityFollowupCast!.odette![field]=false;blocked(d);}const c1=fixture();c1.gameContext!.constellation=1;blocked(c1);});
  it("distinguishes a known final miss from unknown contact and still observes end plus one",()=>{const unknown=fixture();delete unknown.gameContext!.entityFollowupCast!.targetContacts!["dance-10"];blocked(unknown);const miss=fixture();miss.gameContext!.entityFollowupCast!.targetContacts!["dance-10"]=false;numeric(miss,events.slice(0,-1));miss.gameContext!.entityFollowupCast!.observedThroughFrame=1285;blocked(miss);const early=fixture();early.gameContext!.entityFollowupCast!.observedThroughFrame=1202;blocked(early);});
  it("retains selected actual event ownership and source phase without unselected future guards",()=>{const d=prepareSourceCastDocument(fixture());d.scope="single-hit";d.selectedHitIds=[`${id}:dance-1`];d.gameContext!.entityFollowupCast={casterId:"odette",targetId:"enemy"};const r=calculateDocument(d);expect(r.status).toBe("calculated");expect(r.hits).toHaveLength(1);expect(r.totals?.nonCritical).toBeCloseTo(1000*.4304*.5*.9,8);for(const field of ["ownerId","targetId"] as const){const bad=structuredClone(d);const h=bad.hits.find(x=>x.id===`${id}:dance-1`)!;if(h.kind!=="ordinary")throw Error("ordinary");h.entityFollowupEvent![field]="other";blocked(bad);}const bad=structuredClone(d);const h=bad.hits.find(x=>x.id===`${id}:dance-1`)!;if(h.kind!=="ordinary")throw Error("ordinary");h.entityFollowupEvent!.frame=158;h.entityFollowupEvent!.snapshotFrame=158;blocked(bad);const element=structuredClone(d);const eh=element.hits.find(x=>x.id===`${id}:dance-1`)!;if(eh.kind!=="ordinary")throw Error("ordinary");eh.entityFollowupEvent!.element="hydro";blocked(element);});
});

describe("Odette fresh ordinary Q entity with separately leveled E tail without upgrade or refresh",()=>{
  const id="entity-followup-odette-burst-c0";
  // Source-derived a7dc4bf full-tail oracle; unchanged odette-independent.test.ts separately pins the four Q coefficients.
  const events=[["slash-1",112,1.10176],["slash-2",128,1.10176],["slash-3",140,1.10176],["final",144,1.70272],["dance-1",253,.4304],["dance-2",362,.51464],["dance-3",487,.4304],["dance-4",596,.51464],["dance-5",721,.4304],["dance-6",830,.51464],["dance-7",955,.4304],["dance-8",1064,.51464],["dance-9",1189,.4304]] as const;
  const fixture=()=>{const d=getCharacterDocuments("character:10000150",1).find(x=>x.gameContext?.skillId===id)!;d.scope="one-cast";d.selectedHitIds=d.hits.map(x=>x.id);d.characterLevel=90;d.gameContext!.constellation=0;
    d.build={mode:"manual-final",stats:{atk:1000,hp:10000,def:700,em:9999,critRate:.5,critDamage:1},source:"Authored fresh C0 ordinary Dance Double contact history; no Stellar upgrade, refresh or inferred target geometry"};d.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};for(const h of d.hits)if(h.kind==="ordinary"){h.damageBonus=0;h.reaction="none";}
    d.gameContext!.entityFollowupCast={casterId:"odette",targetId:"enemy",freshCastConfirmed:true,noHitlag:true,noInterruption:true,noReplacement:true,fullObservedLifetime:true,observedThroughFrame:1264,skillTalentLevel:1,statsStableAcrossHits:true,targetContacts:Object.fromEntries(events.map(([key])=>[key,true])),odette:{noPriorDanceDouble:true,noUpgradeThroughout:true,noCodaOrRefreshThroughout:true}};return d;};
  const blocked=(d:CalculatorDocument)=>{const r=calculateDocument(d);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  const numeric=(d:CalculatorDocument,expected:readonly (readonly [string,number,number])[]=events)=>{const p=prepareSourceCastDocument(d);expect(p.hits.map(h=>h.kind==="ordinary"?[h.entityFollowupEvent?.candidateId,h.entityFollowupEvent?.frame,h.entityFollowupEvent?.snapshotFrame,h.entityFollowupEvent?.ownerId]:[])).toEqual(expected.map(([key,frame])=>[key,frame,frame,"odette"]));const r=calculateDocument(d);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(expected.length);expected.forEach(([, ,c],i)=>expect(r.hits[i]!.nonCritical).toBeCloseTo(1000*c*.5*.9,8));expect(r.totals?.expected).toBeCloseTo(expected.reduce((sum,[,,c])=>sum+c,0)*1000*.5*.9*1.5,8);};
  it("pins four unknown roles and thirteen contacts with independent Q and E talent sources",()=>{const d=getCharacterDocuments("character:10000150",10).find(x=>x.gameContext?.skillId===id)!;const p=prepareSourceCastDocument(d);expect(p.hits.map(h=>h.id)).toEqual([`${id}-slash`,`${id}-final`,`${id}-plume`,`${id}-wing`]);const r=calculateDocument(d);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(r.blockers).toHaveLength(6);expect(r.blockers.filter(b=>b.startsWith("entity-followup:schedule"))).toHaveLength(4);expect(r.blockers.some(b=>b.startsWith(`entity-followup:${id}-plume`))).toBe(true);expect(r.blockers.some(b=>b.startsWith(`entity-followup:${id}-wing`))).toBe(true);numeric(fixture());const ten=fixture();ten.gameContext!.effectiveTalentLevel=10;numeric(ten,events.map(([key,frame,c],index)=>[key,frame,index<4?c*1.8:c] as const));});
  it("requires complete actual lifetime, branch and contact evidence rather than unknown defaults",()=>{for(const field of ["casterId","targetId","freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","observedThroughFrame","statsStableAcrossHits","targetContacts","odette","skillTalentLevel"] as const){const d=fixture();delete d.gameContext!.entityFollowupCast![field];blocked(d);}for(const field of ["freshCastConfirmed","noHitlag","noInterruption","noReplacement","fullObservedLifetime","statsStableAcrossHits"] as const){const d=fixture();d.gameContext!.entityFollowupCast![field]=false;blocked(d);}for(const field of ["noPriorDanceDouble","noUpgradeThroughout","noCodaOrRefreshThroughout"] as const){const d=fixture();delete d.gameContext!.entityFollowupCast!.odette![field];blocked(d);d.gameContext!.entityFollowupCast!.odette![field]=false;blocked(d);}const c1=fixture();c1.gameContext!.constellation=1;blocked(c1);});
  it("distinguishes a known final miss from unknown contact and still observes end plus one",()=>{const unknown=fixture();delete unknown.gameContext!.entityFollowupCast!.targetContacts!["dance-9"];blocked(unknown);const miss=fixture();miss.gameContext!.entityFollowupCast!.targetContacts!["dance-9"]=false;numeric(miss,events.slice(0,-1));miss.gameContext!.entityFollowupCast!.observedThroughFrame=1263;blocked(miss);const early=fixture();early.gameContext!.entityFollowupCast!.observedThroughFrame=1189;blocked(early);});
  it("retains selected actual event ownership and source phase without unselected future guards",()=>{const d=prepareSourceCastDocument(fixture());d.scope="single-hit";d.selectedHitIds=[`${id}:dance-1`];d.gameContext!.entityFollowupCast={casterId:"odette",targetId:"enemy",skillTalentLevel:1};const r=calculateDocument(d);expect(r.status).toBe("calculated");expect(r.hits).toHaveLength(1);expect(r.totals?.nonCritical).toBeCloseTo(1000*.4304*.5*.9,8);for(const field of ["ownerId","targetId"] as const){const bad=structuredClone(d);const h=bad.hits.find(x=>x.id===`${id}:dance-1`)!;if(h.kind!=="ordinary")throw Error("ordinary");h.entityFollowupEvent![field]="other";blocked(bad);}const bad=structuredClone(d);const h=bad.hits.find(x=>x.id===`${id}:dance-1`)!;if(h.kind!=="ordinary")throw Error("ordinary");h.entityFollowupEvent!.frame=254;h.entityFollowupEvent!.snapshotFrame=254;blocked(bad);const element=structuredClone(d);const eh=element.hits.find(x=>x.id===`${id}:dance-1`)!;if(eh.kind!=="ordinary")throw Error("ordinary");eh.entityFollowupEvent!.element="hydro";blocked(element);});
  it("does not borrow Q level for the E tail or require unselected tail level for a real Q slash",()=>{const e10=fixture();e10.gameContext!.entityFollowupCast!.skillTalentLevel=10;numeric(e10,events.map(([key,frame,c],index)=>[key,frame,index<4?c:c*1.8] as const));const q=prepareSourceCastDocument(fixture());q.scope="single-hit";q.selectedHitIds=[`${id}:slash-1`];q.gameContext!.entityFollowupCast={casterId:"odette",targetId:"enemy"};const r=calculateDocument(q);expect(r.status).toBe("calculated");expect(r.totals?.nonCritical).toBeCloseTo(1000*1.10176*.5*.9,8);const tail=prepareSourceCastDocument(fixture());tail.scope="single-hit";tail.selectedHitIds=[`${id}:dance-1`];tail.gameContext!.entityFollowupCast={casterId:"odette",targetId:"enemy"};blocked(tail);});
});

describe("Odette observed Coda with unrefreshed prior entity and explicit Radiance",()=>{
  const id="mixed-odette-coda-c0";
  // New hand oracle from pinned a7dc4bf, not the unrelated direct-four-Q numeric test.
  const ordinary=[["coda-1",11,.9584],["coda-2",20,.9584],["coda-3",28,.9584],["dance-1",114,.4304],["dance-2",223,.51464],["dance-3",348,.4304],["dance-4",457,.51464]] as const;
  type Row=readonly [string,number,number];
  const normal=(c:number)=>2000*c*.5*.9;
  const stellar=(c:number,stacks=2,a4=1.15,base=.07,count=1)=>2000*c*a4*(1+base)*(1+6*100/2100+.15*stacks)*count*.9;
  const rows=(branch:"none"|"conduct"|"swirl"="none"):Row[]=>[
    ...ordinary.slice(0,3).map(([key,f,c])=>[key,f,normal(c)] as const),["coda-final",62,stellar(branch==="swirl"?4.5864:3.0576)],
    ...ordinary.slice(3).flatMap(([key,f,c],i)=>[[key,f,normal(c)] as Row,...(branch==="none"?[]:[[`${key}-stellar`,f,stellar(branch==="swirl"?(i%2===0?.40528:.48464):(i%2===0?.27024:.32312))] as Row])])];
  const fixture=(branch:"none"|"conduct"|"swirl"="none")=>{const d=getCharacterDocuments("character:10000150",1).find(x=>x.gameContext?.skillId===id)!;d.scope="one-cast";d.selectedHitIds=d.hits.map(h=>h.id);d.characterLevel=90;d.gameContext!.ascension=6;d.gameContext!.constellation=0;d.build={mode:"manual-final",ascension:6,stats:{atk:2000,hp:10000,def:700,em:100,critRate:0,critDamage:0},source:"Authored actual prior-entity and Radiance histories; no inferred full stance"};d.enemy={level:90,resistance:.1,defenseAdjustment:0,defenseIgnore:0};
    d.gameContext!.mixedSourceCast={casterId:"odette",targetId:"enemy",noHitlag:true,noInterruption:true,noReplacement:true,fullObservedLifetime:true,observedThroughFrame:1263,statsStableAcrossHits:true,targetContacts:Object.fromEntries(rows(branch).map(([key])=>[key,true])),odette:{burstBuffInactive:true,danceDoubleRemainingFrames:500,recastWindowRemainingFrames:100,specialSkillCooldownReady:true,remainsOnFieldThroughout:true,a1StacksAtStart:2,radianceHistoryComplete:true,priorStellarSwirlRemainingFrames:branch==="swirl"?480:0,stellarSwirlFrames:[],polestarIntervals:branch==="conduct"?[{id:"actual-field",startFrame:0,endFrame:500}]:[]},sharedState:{impactAtk:1000,otherSpecialBaseBonus:0,otherReactionBonus:0,specialAdditive:0,elevationMultiplier:1,polestarApplicationCount:0}};return d;};
  const blocked=(d:CalculatorDocument)=>{const r=calculateDocument(d);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();};
  const numeric=(d:CalculatorDocument,expected:readonly Row[])=>{const p=prepareSourceCastDocument(d);expect(p.hits.map(h=>(h.kind==="ordinary"||h.kind==="special")?[h.mixedSourceEvent?.candidateId,h.mixedSourceEvent?.frame,h.mixedSourceEvent?.snapshotFrame]:[])).toEqual(expected.map(([key,f])=>[key,f,f]));const r=calculateDocument(d);expect(r.status).toBe("calculated");expect(r.blockers).toEqual([]);expect(r.hits).toHaveLength(expected.length);expected.forEach(([, ,n],i)=>expect(r.hits[i]!.expected).toBeCloseTo(n,8));expect(r.totals?.expected).toBeCloseTo(expected.reduce((s,[,,n])=>s+n,0),8);};
  it("pins three ordinary unknown representatives and separate ordinary versus Stellar arithmetic",()=>{const d=getCharacterDocuments("character:10000150",10).find(x=>x.gameContext?.skillId===id)!;expect(prepareSourceCastDocument(d).hits.map(h=>h.id)).toEqual([`${id}-coda`,`${id}-plume`,`${id}-wing`]);const r=calculateDocument(d);expect(r.status).toBe("blocked");expect(r.totals).toBeUndefined();expect(d.scope).toBe("one-cast");expect(d.gameContext!.ascension).toBe(6);expect(r.blockers).toHaveLength(3);for(const b of r.blockers)expect(b).toMatch(/^mixed-source:schedule/);numeric(fixture(),rows());const ten=fixture();ten.gameContext!.effectiveTalentLevel=10;numeric(ten,rows().map(([key,f,n])=>[key,f,n*1.8]));numeric(fixture("conduct"),rows("conduct"));numeric(fixture("swirl"),rows("swirl"));const priority=fixture("conduct");priority.gameContext!.mixedSourceCast!.odette!.priorStellarSwirlRemainingFrames=480;numeric(priority,rows("conduct"));});
  it("requires actual prior lifetime, cooldown, on-field and complete Radiance histories",()=>{for(const field of ["casterId","targetId","noHitlag","noInterruption","noReplacement","fullObservedLifetime","observedThroughFrame","statsStableAcrossHits","targetContacts","odette"] as const){const d=fixture();delete d.gameContext!.mixedSourceCast![field];blocked(d);}for(const field of ["noHitlag","noInterruption","noReplacement","fullObservedLifetime","statsStableAcrossHits"] as const){const d=fixture();d.gameContext!.mixedSourceCast![field]=false;blocked(d);}for(const field of ["burstBuffInactive","danceDoubleRemainingFrames","recastWindowRemainingFrames","specialSkillCooldownReady","remainsOnFieldThroughout","a1StacksAtStart","radianceHistoryComplete","priorStellarSwirlRemainingFrames","stellarSwirlFrames","polestarIntervals"] as const){const d=fixture();delete d.gameContext!.mixedSourceCast!.odette![field];blocked(d);}for(const field of ["burstBuffInactive","specialSkillCooldownReady","remainsOnFieldThroughout","radianceHistoryComplete"] as const){const d=fixture();d.gameContext!.mixedSourceCast!.odette![field]=false;blocked(d);}for(const field of ["danceDoubleRemainingFrames","recastWindowRemainingFrames"] as const){const d=fixture();d.gameContext!.mixedSourceCast!.odette![field]=0;blocked(d);}const c1=fixture();c1.gameContext!.constellation=1;blocked(c1);const asc=fixture();delete asc.gameContext!.ascension;if(asc.build.mode==="manual-final")delete asc.build.ascension;blocked(asc);});
  it("keeps special operands, construction ATK, impact ATK and actual A1 stacks independent",()=>{for(const field of ["otherSpecialBaseBonus","otherReactionBonus","specialAdditive","elevationMultiplier","polestarApplicationCount"] as const){const d=fixture();delete d.gameContext!.mixedSourceCast!.sharedState![field];blocked(d);}const impact=fixture();impact.gameContext!.mixedSourceCast!.sharedState!.impactAtk=2000;numeric(impact,rows().map(row=>row[0]==="coda-final"?[row[0],row[1],stellar(3.0576,2,1.15,.14)]:row));const zero=fixture();zero.gameContext!.mixedSourceCast!.odette!.a1StacksAtStart=0;numeric(zero,rows().map(row=>row[0]==="coda-final"?[row[0],row[1],stellar(3.0576,0)]:row));const low=fixture();low.gameContext!.ascension=3;if(low.build.mode==="manual-final")low.build.ascension=3;numeric(low,rows().map(row=>row[0]==="coda-final"?[row[0],row[1],stellar(3.0576,2,1)]:row));const count=fixture();count.gameContext!.mixedSourceCast!.sharedState!.polestarApplicationCount=12;numeric(count,rows().map(row=>row[0]==="coda-final"?[row[0],row[1],stellar(3.0576,2,1.15,.07,2)]:row));});
  it("does not refresh old entity expiry or infer contact and still observes upgrade end plus one",()=>{const short=fixture();short.gameContext!.mixedSourceCast!.odette!.danceDoubleRemainingFrames=61;numeric(short,[...rows().slice(0,3),["coda-final",62,stellar(3.0576,0)]]);const unknown=fixture();delete unknown.gameContext!.mixedSourceCast!.targetContacts!["dance-4"];blocked(unknown);const miss=fixture();miss.gameContext!.mixedSourceCast!.targetContacts!["dance-4"]=false;numeric(miss,rows().slice(0,-1));miss.gameContext!.mixedSourceCast!.observedThroughFrame=1262;blocked(miss);});
  it("actual selected final retains own source phase and no-Q proof without future history",()=>{const d=prepareSourceCastDocument(fixture());d.scope="single-hit";d.selectedHitIds=[`${id}:coda-final`];d.gameContext!.mixedSourceCast={sharedState:{impactAtk:1000,otherSpecialBaseBonus:0,otherReactionBonus:0,specialAdditive:0,elevationMultiplier:1,polestarApplicationCount:0,odetteBurstBuffInactive:true}};const r=calculateDocument(d);expect(r.status).toBe("calculated");expect(r.totals?.expected).toBeCloseTo(stellar(3.0576),8);const noQ=structuredClone(d);delete noQ.gameContext!.mixedSourceCast!.sharedState!.odetteBurstBuffInactive;blocked(noQ);const bad=structuredClone(d);const h=bad.hits.find(x=>x.id===`${id}:coda-final`)!;if(h.kind!=="special")throw Error("special");h.mixedSourceEvent!.frame=63;h.mixedSourceEvent!.snapshotFrame=63;blocked(bad);const stacks=structuredClone(d);const sh=stacks.hits.find(x=>x.id===`${id}:coda-final`)!;if(sh.kind!=="special")throw Error("special");delete sh.mixedSourceEvent!.odetteA1Stacks;blocked(stacks);});
});
