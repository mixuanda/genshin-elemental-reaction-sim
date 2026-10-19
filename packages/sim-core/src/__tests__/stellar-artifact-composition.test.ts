import { expect, it } from "vitest";
import { simulateStellarConductProfile, simulateStellarSwirlProfile } from "../simulator";
import { StellarArtifactRuntime } from "../stellar-artifact-runtime";
import { stellarSwirlEventToCalculatorDocument } from "../stellar-swirl-runtime";
import { calculateDocument } from "../calculator";
import { captureSpecialSimulation, parseSpecialSimulation, serializeSpecialSimulation } from "../special-result-capture";
import { stellarConfig, stellarSwirlConfig, stellarSwirlParty } from "./special-profile-fixtures";

it("executes fixed-a7 Stellar artifact callbacks, windows, contributor bonuses, and complete replay", () => {
  const conductParty = [{ actorId: "c", characterKey: "sandrone" }, { actorId: "e", characterKey: "lisa" }];
  const conductConfig = stellarConfig();
  conductConfig.characters.find(actor => actor.id === "e")!.stats.atkPct += 0.18;
  const conductBaseline = simulateStellarConductProfile(conductConfig, { party: conductParty });
  conductConfig.meta.verificationStatus = "user-supplied";
  conductConfig.stellarArtifactModel = { mode: "fixed-a7-stellar-artifact-4pc-v1", baselineIncludesStaticTwoPiece: true,
    actors: [{ actorId: "e", setId: "artifact-set:15048" }] };
  const conduct = simulateStellarConductProfile(conductConfig, { party: conductParty });
  expect(conduct.stellarArtifactLog!.some(row => row.event === "OnStellarConduct" && row.triggerActorId === "e" && row.applications.some(app => app.key === "furnace-4pc-atk" && app.value === 0.12))).toBe(true);
  expect(conduct.stellarArtifactLog![0]!.trace.find(node => node.id === "stellarArtifact.durationFrames")!.result!.value).toBe(720);
  expect(conduct.stellarArtifactLog![0]!.applications.filter(app => app.key === "furnace-4pc-react")).toHaveLength(2);
  expect(conduct.baseResult.damageEvents.find(event => event.frame === 6 && event.kind === "direct")!.finalDamage)
    .toBe(conductBaseline.baseResult.damageEvents.find(event => event.frame === 6 && event.kind === "direct")!.finalDamage);
  expect(conduct.baseResult.damageEvents.find(event => event.frame === 12 && event.kind === "direct")!.finalDamage)
    .toBeGreaterThan(conductBaseline.baseResult.damageEvents.find(event => event.frame === 12 && event.kind === "direct")!.finalDamage);

  const swirlConfig = stellarSwirlConfig([6]);
  swirlConfig.characters.find(actor => actor.id === "a")!.stats.atkPct += 0.18;
  swirlConfig.meta.verificationStatus = "user-supplied";
  swirlConfig.stellarArtifactModel = { mode: "fixed-a7-stellar-artifact-4pc-v1", baselineIncludesStaticTwoPiece: true,
    actors: [{ actorId: "a", setId: "artifact-set:15047" }] };
  expect(() => simulateStellarSwirlProfile(swirlConfig, { party: stellarSwirlParty })).toThrow(/来源冲突/);
  swirlConfig.stellarArtifactModel.allowGuideSourceConflict = true;
  const swirl = simulateStellarSwirlProfile(swirlConfig, { party: stellarSwirlParty });
  const first = swirl.specialDamageEvents.find(event => event.intent.branch === "stellar-swirl-anemo-reaction")!;
  expect(first.context.contributors.find(contributor => contributor.id === "a")!.reactionBonus).toBe(0.4);
  expect(first.context.contributors.find(contributor => contributor.id === "a")!.critRate).toBeCloseTo(0.76);
  expect(swirl.stellarArtifactReactionReads!.find(read => read.actorId === "a")!.trace.find(node => node.id === "stellarArtifact.bonus")!.result!.value).toBe(0.4);
  expect(first.context.contributors.find(contributor => contributor.id === "a")!.stellarArtifactBonus).toMatchObject({ snapshotFrame: 6, scarlet: { wearerActorId: "a", expiresAtFrame: 606 }, heart: null });
  const standalone = calculateDocument(JSON.parse(JSON.stringify(stellarSwirlEventToCalculatorDocument(swirl, first.id))));
  const artifactTrace = standalone.hits[0]!.trace;
  expect(artifactTrace.find(node => node.id.endsWith(".artifact.scarletWindow"))!.result!.value).toBe(1);
  expect(artifactTrace.find(node => node.id.endsWith(".artifact.scarletBonus"))!.result!.value).toBe(0.4);
  expect(artifactTrace.find(node => node.id.endsWith(".artifact.heartBonus"))!.result!.value).toBe(0);
  expect(artifactTrace.find(node => node.id.endsWith(".artifact.bonus"))!.result!.value).toBe(0.4);
  expect(standalone.totals!.expected).toBe(first.damage);
  const changedCalculator = structuredClone(stellarSwirlEventToCalculatorDocument(swirl, first.id));
  const changedHit = changedCalculator.hits[0]!;
  if (changedHit.kind !== "special") throw new Error("Expected an independent special calculator hit");
  changedHit.context.contributors.find(contributor => contributor.id === "a")!.reactionBonus += 0.01;
  expect(() => calculateDocument(changedCalculator)).toThrow(/recorded reaction bonus differs/);
  const request = { profile: "stellar-swirl" as const, config: swirlConfig, options: {}, party: stellarSwirlParty };
  expect(parseSpecialSimulation(serializeSpecialSimulation(captureSpecialSimulation(request, swirl))).result).toEqual(JSON.parse(JSON.stringify(swirl)));

  const windows = new StellarArtifactRuntime({ mode: "fixed-a7-stellar-artifact-4pc-v1", baselineIncludesStaticTwoPiece: true,
    allowGuideSourceConflict: true, actors: [{ actorId: "a", setId: "artifact-set:15047" }, { actorId: "b", setId: "artifact-set:15048" }, { actorId: "c", setId: "artifact-set:15048" }] }, ["a", "b", "c"]);
  windows.onReaction(6, "a", "stellar-swirl");
  windows.onReaction(7, "b", "stellar-swirl");
  expect(windows.reactionBonus("a", 7, "reaction-stellar-swirl", "stellar-swirl-anemo-reaction").value).toBe(0.9);
  windows.onReaction(8, "c", "stellar-conduct");
  expect(windows.log.at(-1)!.applications.find(app => app.key === "furnace-4pc-react")!.replacedSourceActorId).toBe("b");
  expect(windows.reactionBonus("a", 606, "reaction-stellar-swirl", "stellar-swirl-anemo-reaction").value).toBe(0.5);
  expect(windows.reactionBonus("a", 728, "reaction-stellar-swirl", "stellar-swirl-anemo-reaction").value).toBe(0);
});
