import { expect, it } from "vitest";
import { simulationResultSchema } from "@genshin-dps-lab/schemas";
import { calculateDocument } from "../calculator";
import { MoonlightArtifactRuntime } from "../moonlight-artifact-runtime";
import { lunarMixedV2EventToCalculatorDocument } from "../lunar-mixed-v2-runtime";
import { simulateLunarMixedV2Profile } from "../simulator";
import { captureSpecialSimulation, parseSpecialSimulation, serializeSpecialSimulation } from "../special-result-capture";
import { mixedV2Config, mixedV2Declaration, mixedV2Party } from "./lunar-mixed-v2.fixture";

it("executes both fixed-source Moonlight sets through real Lunar events, portable arithmetic, windows and full replay", () => {
  const config = mixedV2Config();
  // The final panel already includes Night's +80 EM and Silken's +20% ER.
  config.characters.find(actor => actor.id === "e")!.stats.em += 80;
  config.characters.find(actor => actor.id === "g")!.stats.energyRecharge += 0.2;
  const baseline = simulateLunarMixedV2Profile(config, { party: mixedV2Party, abilities: [mixedV2Declaration] });
  config.meta.verificationStatus = "user-supplied";
  config.moonlightArtifactModel = { mode: "fixed-a7-moonlight-artifact-4pc-v1", baselineIncludesStaticTwoPiece: true, moonsignLevel: 2,
    actors: [{ actorId: "e", setId: "artifact-set:15041" }, { actorId: "g", setId: "artifact-set:15042" }] };
  const result = simulateLunarMixedV2Profile(config, { party: mixedV2Party, abilities: [mixedV2Declaration] });
  expect(result.baseResult.moonlightArtifactLog).toEqual(result.moonlightArtifactLog);
  expect(simulationResultSchema.parse(JSON.parse(JSON.stringify(result.baseResult))).moonlightArtifactLog).toEqual(result.moonlightArtifactLog);
  const night = result.moonlightArtifactLog!.find(row => row.event === "OnLunarCharged" && row.frame === 6 && row.wearerActorId === "e")!;
  expect(night.applications.find(row => row.key === "gleaming-moon-intent-cr")).toMatchObject({ value: 0.3, expiresAtFrame: 246 });
  expect(night.trace.find(node => node.id === "moonlightArtifact.durationFrames")!.result!.value).toBe(240);
  const silken = result.moonlightArtifactLog!.find(row => row.event === "OnEnemyDamage" && row.wearerActorId === "g")!;
  expect(silken.applications).toHaveLength(4);
  expect(silken.applications.every(row => row.key === "gleaming-moon-devotion-em" && row.value === 120)).toBe(true);
  expect(silken.trace.find(node => node.id === "moonlightArtifact.durationFrames")!.result!.value).toBe(480);
  const firstGeo = result.baseResult.damageEvents.find(event => event.kind === "direct" && event.sourceActorId === "g" && event.frame === silken.frame)!;
  const baselineGeo = baseline.baseResult.damageEvents.find(event => event.kind === "direct" && event.sourceActorId === "g" && event.frame === silken.frame)!;
  expect(firstGeo.statsBeforeDamage.em).toBe(baselineGeo.statsBeforeDamage.em);
  const secondGeo = result.baseResult.damageEvents.find(event => event.kind === "direct" && event.sourceActorId === "g" && event.frame > silken.frame)!;
  expect(secondGeo.statsBeforeDamage.em).toBe(firstGeo.statsBeforeDamage.em + 120);
  const laterElectro = result.baseResult.damageEvents.find(event => event.kind === "direct" && event.sourceActorId === "e" && event.frame === 56)!;
  expect(laterElectro.statsBeforeDamage.critRate).toBeCloseTo(0.6);
  const crystallize = result.specialDamageEvents.find(event => event.kind === "reaction" && event.intent.branch === "lunar-crystallize-reaction")!;
  const contributor = crystallize.context.contributors[0]!;
  const baselineCrystallize = baseline.specialDamageEvents.find(event => event.kind === "reaction" && event.intent.branch === "lunar-crystallize-reaction")!;
  const baselineContributor = baselineCrystallize.context.contributors.find(row => row.id === contributor.id)!;
  const latestNight = result.moonlightArtifactLog!.filter(row => row.wearerActorId === "e" && row.frame <= contributor.moonlightArtifactBonus!.snapshotFrame).at(-1)!;
  const nightExpiry = latestNight.applications.find(row => row.key === "gleaming-moon-intent-cr")!.expiresAtFrame;
  const latestSilken = result.moonlightArtifactLog!.filter(row => row.wearerActorId === "g" && row.frame <= contributor.moonlightArtifactBonus!.snapshotFrame).at(-1)!;
  expect(contributor.elementalMastery).toBe(baselineContributor.elementalMastery + 120);
  expect(contributor.moonlightArtifactBonus).toMatchObject({ sourceProfileId: "fixed-a7-moonlight-artifact-4pc-v1",
    nightWindows: expect.arrayContaining([{ receiverActorId: "e", sourceActorId: "e", expiresAtFrame: nightExpiry }]),
    silkenWindows: expect.arrayContaining([{ receiverActorId: "h", sourceActorId: "g", expiresAtFrame: latestSilken.frame + 480 }]) });
  const teamRead = result.moonlightArtifactReactionReads!.find(row => row.tag === "lunar-crystallize-reaction" && row.actorId === contributor.id && row.frame === contributor.moonlightArtifactBonus!.snapshotFrame)!;
  expect(teamRead).toMatchObject({ nightBonus: 0.1, silkenBonus: 0.1, totalBonus: 0.2 });
  expect(teamRead.trace.find(node => node.id === "moonlightArtifact.bonus")!.result!.value).toBeCloseTo(0.2);
  const standalone = calculateDocument(JSON.parse(JSON.stringify(lunarMixedV2EventToCalculatorDocument(result, crystallize.id))));
  const trace = standalone.hits[0]!.trace;
  expect(trace.find(node => node.id.endsWith(".moonlightArtifact.nightBonus"))!.result!.value).toBeCloseTo(0.1);
  expect(trace.find(node => node.id.endsWith(".moonlightArtifact.silkenBonus"))!.result!.value).toBeCloseTo(0.1);
  expect(trace.find(node => node.id.endsWith(".moonlightArtifact.bonus"))!.result!.value).toBeCloseTo(0.2);
  expect(standalone.totals!.expected).toBe(crystallize.damage);
  const tamperedBase = structuredClone(result.baseResult);
  tamperedBase.moonlightArtifactLog!.find(row => row.event === "OnEnemyDamage")!.applications[0]!.value += 1;
  expect(() => simulationResultSchema.parse(tamperedBase)).toThrow();
  const request = { profile: "lunar-mixed-v2" as const, config, options: {}, party: mixedV2Party, abilities: [mixedV2Declaration] };
  expect(parseSpecialSimulation(serializeSpecialSimulation(captureSpecialSimulation(request, result))).result).toEqual(JSON.parse(JSON.stringify(result)));

  const model = { mode: "fixed-a7-moonlight-artifact-4pc-v1" as const, baselineIncludesStaticTwoPiece: true as const, moonsignLevel: 2 as const,
    actors: [{ actorId: "n1", setId: "artifact-set:15041" as const }, { actorId: "n2", setId: "artifact-set:15041" as const },
      { actorId: "s1", setId: "artifact-set:15042" as const }, { actorId: "s2", setId: "artifact-set:15042" as const }] };
  const windows = new MoonlightArtifactRuntime(model, ["n1", "n2", "s1", "s2"], "n1");
  windows.onLunarReaction(6, "lunarCharged", "s1");
  windows.completedSwap("n2");
  windows.onLunarReaction(7, "lunarCrystallize", "s1");
  windows.onEnemyDamage(8, "s1", "geo");
  windows.onEnemyDamage(9, "s2", "dendro");
  expect(windows.log.at(-1)!.applications.every(row => row.replacedSourceActorId === "s1")).toBe(true);
  expect(windows.reactionBonus("s1", 10, "lunar-charged-reaction").value).toBeCloseTo(0.2);
  windows.statBonuses("n1", 246); // Stats read removes n1 at expiry, while n2 remains.
  expect(windows.reactionBonus("s1", 247, "lunar-charged-reaction").value).toBeCloseTo(0.2);
  windows.statBonuses("n2", 247);
  expect(windows.reactionBonus("s1", 247, "lunar-charged-reaction").value).toBeCloseTo(0.1);
  expect(windows.reactionBonus("s1", 489, "lunar-charged-reaction").value).toBeCloseTo(0.1);
  windows.statBonuses("s1", 489);
  expect(windows.reactionBonus("s1", 489, "lunar-charged-reaction").value).toBeCloseTo(0.1);
  for (const actorId of ["n1", "n2", "s2"]) windows.statBonuses(actorId, 489);
  expect(windows.reactionBonus("s1", 489, "lunar-charged-reaction").value).toBe(0);
  const zeroNight = new MoonlightArtifactRuntime({ ...model, moonsignLevel: 0, actors: [{ actorId: "n1", setId: "artifact-set:15041" }] }, ["n1"], "n1");
  zeroNight.onLunarReaction(1, "lunarBloom", "n1");
  expect(zeroNight.log[0]!.applications[0]!.value).toBe(0);
  expect(zeroNight.reactionBonus("n1", 2, "lunar-bloom-direct").value).toBeCloseTo(0.1);
  const zeroSilken = new MoonlightArtifactRuntime({ ...model, moonsignLevel: 0, actors: [{ actorId: "s1", setId: "artifact-set:15042" }] }, ["s1"], "s1");
  zeroSilken.onEnemyDamage(1, "s1", "geo");
  expect(zeroSilken.log).toHaveLength(0);
  expect(zeroSilken.reactionBonus("s1", 2, "lunar-bloom-direct").value).toBe(0);
});
