import { expect, it } from "vitest";
import { ARTIFACT_BUFF_SOURCE } from "@genshin-dps-lab/reaction-formulas";
import { simulationResultSchema } from "@genshin-dps-lab/schemas";
import { simulateLunarBloomProfile, simulateLunarMixedV2Profile } from "../simulator";
import { lunarBloomConfig, lunarBloomDeclaration, lunarBloomParty } from "./special-profile-fixtures";
import { mixedV2Config, mixedV2Declaration, mixedV2Party } from "./lunar-mixed-v2.fixture";

it("composes ordinary artifact callbacks with a live Lunar contributor snapshot", () => {
  const config = lunarBloomConfig();
  config.timeline!.initialActiveCharacterId = "d";
  config.timeline!.commands = [
    { type: "skill", actorId: "d", abilityId: "d", atFrame: 0 },
    { type: "swap", characterId: "c", atFrame: 5 },
    { type: "skill", actorId: "c", abilityId: "c", atFrame: 6 },
    { type: "charge", actorId: "c", abilityId: "moon", atFrame: 160 },
  ];
  config.timeline!.abilities.find(ability => ability.id === "d")!.hits!.push({
    id: "ordinary-normal", frame: 4, scaling: 1, element: "physical", attackTag: "normal",
  });
  const baseline = simulateLunarBloomProfile(config, { party: lunarBloomParty, abilities: [lunarBloomDeclaration] });

  config.artifactBuffModel = { mode: ARTIFACT_BUFF_SOURCE.mode, actors: [{ actorId: "c", effectId: "gilded-4pc" }] };
  config.artifactEventModel = { mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "d", effectId: "exile-4pc" }] };
  // The source skill has a real burst callback, and the Hydro hit at frame 7
  // creates Bloom before Moondew samples the same actor's live EM.
  config.timeline!.abilities.find(ability => ability.id === "d")!.kind = "burst";
  config.timeline!.commands[0] = { type: "burst", actorId: "d", abilityId: "d", atFrame: 0 };
  const result = simulateLunarBloomProfile(config, { party: lunarBloomParty, abilities: [lunarBloomDeclaration] });
  expect(result.baseResult.artifactBuffLog!.some(row => row.effectId === "gilded-4pc" && row.event.kind === "reaction" && row.outcome === "applied")).toBe(true);
  expect(result.baseResult.artifactEventLog!.some(row => row.effectId === "exile-4pc" && row.kind === "burst" && row.outcome === "activated")).toBe(true);
  expect(result.baseResult.artifactEventLog!.some(row => row.effectId === "exile-4pc" && row.kind === "exile-tick")).toBe(true);
  expect(result.specialDamageEvents[0]!.context.contributors[0]!.elementalMastery).toBe(
    baseline.specialDamageEvents[0]!.context.contributors[0]!.elementalMastery + 50,
  );
  expect(result.lunarBloomDamage).toBeGreaterThan(baseline.lunarBloomDamage);
  expect(simulationResultSchema.parse(JSON.parse(JSON.stringify(result.baseResult))).artifactBuffState).toEqual(result.baseResult.artifactBuffState);

  delete config.artifactEventModel;
  config.artifactDamageModel = { mode: "gcsim-b4ae769-artifact-damage-v1", actors: [{ actorId: "d", effectId: "echoes-4pc" }] };
  const damageArtifact = simulateLunarBloomProfile(config, { party: lunarBloomParty, abilities: [lunarBloomDeclaration] });
  expect(damageArtifact.baseResult.artifactDamageLog!.some(row => row.effectId === "echoes-4pc" && row.kind === "enemy-hit" && row.attackTag === "normal" && row.random !== null)).toBe(true);
  expect(simulationResultSchema.parse(JSON.parse(JSON.stringify(damageArtifact.baseResult))).artifactDamageState).toEqual(damageArtifact.baseResult.artifactDamageState);

  const mixed = mixedV2Config();
  mixed.timeline!.abilities.find(ability => ability.id === "g")!.hits![0]!.application!.gaugeUnits = 4;
  mixed.artifactBuffModel = { mode: ARTIFACT_BUFF_SOURCE.mode, actors: [
    { actorId: "e", effectId: "gilded-4pc" }, { actorId: "g", effectId: "gilded-4pc" },
  ] };
  const mixedResult = simulateLunarMixedV2Profile(mixed, { party: mixedV2Party, abilities: [mixedV2Declaration] });
  const mixedReactionCallbacks = mixedResult.baseResult.artifactBuffLog!.filter(row => row.event.kind === "reaction")
    .map(row => row.event.kind === "reaction" ? row.event.reaction : "");
  expect(mixedReactionCallbacks).toContain("lunarCharged");
  expect(mixedReactionCallbacks).toContain("lunarCrystallize");
  expect(simulationResultSchema.parse(JSON.parse(JSON.stringify(mixedResult.baseResult))).artifactBuffState).toEqual(mixedResult.baseResult.artifactBuffState);
  config.artifactBuffModel = { mode: ARTIFACT_BUFF_SOURCE.mode, actors: [{ actorId: "c", effectId: "paradise-4pc" }] };
  expect(() => simulateLunarBloomProfile(config, { party: lunarBloomParty, abilities: [lunarBloomDeclaration] })).toThrow(/乐园/);
  console.info("artifact-special-metrics", JSON.stringify({ baselineEm: baseline.specialDamageEvents[0]!.context.contributors[0]!.elementalMastery,
    gildedEm: result.specialDamageEvents[0]!.context.contributors[0]!.elementalMastery,
    baselineLunarDamage: baseline.lunarBloomDamage, gildedLunarDamage: result.lunarBloomDamage,
    mixedLunarTriggers: mixedResult.baseResult.damageEvents.flatMap(event => event.reactionAudit.specialReactions ?? []) }));
});
