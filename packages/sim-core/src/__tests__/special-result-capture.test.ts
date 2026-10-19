import { expect, it } from "vitest";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import { makeConfig, neutralStats } from "./fixtures";
import { lunarBloomConfig, lunarBloomDeclaration, lunarBloomParty, stellarConfig,
  stellarSwirlConfig, stellarSwirlParty } from "./special-profile-fixtures";
import { mixedV2Config, mixedV2Declaration, mixedV2Party } from "./lunar-mixed-v2.fixture";
import { captureSpecialSimulation, parseSpecialSimulation, runSpecialSimulation,
  serializeSpecialSimulation, type CapturedSpecialSimulation, type SpecialSimulationRequest } from "../special-result-capture";

function classicLunarConfig(actors: Array<{ id: string; element: "hydro" | "electro" | "geo" }>): SimConfig {
  const base = makeConfig();
  const hydroGauge = actors.length === 2 && actors[1]!.element === "electro" ? 1 : 4;
  const commands = actors.length === 3
    ? [{ type: "skill" as const, actorId: "h", abilityId: "h", atFrame: 0 },
      { type: "swap" as const, characterId: "e", atFrame: 5 },
      { type: "skill" as const, actorId: "e", abilityId: "e", atFrame: 6 },
      { type: "swap" as const, characterId: "g", atFrame: 17 },
      ...[18, 24, 30].map(atFrame => ({ type: "skill" as const, actorId: "g", abilityId: "g", atFrame }))]
    : [{ type: "skill" as const, actorId: "h", abilityId: "h", atFrame: 0 },
      { type: "swap" as const, characterId: actors[1]!.id, atFrame: 5 },
      ...((actors[1]!.element === "geo" ? [6, 12, 18] : [6]).map(atFrame =>
        ({ type: "skill" as const, actorId: actors[1]!.id, abilityId: actors[1]!.id, atFrame })))];
  return makeConfig({ duration: 10, cycleLength: 11, reactionEngine: { mode: "aura-v3" }, rotation: [],
    characters: actors.map((actor, index) => ({ ...base.characters[0]!, id: actor.id, element: actor.element,
      stats: { ...neutralStats, em: 100 + index * 100, critRate: 0.3 } })),
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "h", swapFrames: 1,
      abilities: actors.map(actor => ({ id: actor.id, actorId: actor.id, name: actor.id, kind: "skill" as const,
        cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
        hits: [{ id: actor.id, frame: 0, scaling: 1, element: actor.element,
          application: { gaugeUnits: actor.id === "h" ? hydroGauge : 1, icd: { mode: "no-icd-v1" as const } } }] })),
      commands } });
}

it("imports full saved results by re-executing every special host and rejects missing special events", () => {
  const requests: SpecialSimulationRequest[] = [
    { profile: "lunar-charged", config: classicLunarConfig([{ id: "h", element: "hydro" }, { id: "e", element: "electro" }]),
      options: {}, party: [{ actorId: "h", characterKey: "barbara" }, { actorId: "e", characterKey: "flins" }] },
    { profile: "lunar-crystallize", config: classicLunarConfig([{ id: "h", element: "hydro" }, { id: "g", element: "geo" }]),
      options: {}, party: [{ actorId: "h", characterKey: "barbara" }, { actorId: "g", characterKey: "zibai" }] },
    { profile: "lunar-bloom", config: lunarBloomConfig(), options: {}, party: lunarBloomParty, abilities: [lunarBloomDeclaration] },
    { profile: "lunar-mixed", config: classicLunarConfig([{ id: "h", element: "hydro" }, { id: "e", element: "electro" }, { id: "g", element: "geo" }]),
      options: {}, party: [{ actorId: "h", characterKey: "columbina" }, { actorId: "e", characterKey: "fischl" }, { actorId: "g", characterKey: "zibai" }] },
    { profile: "lunar-mixed-v2", config: mixedV2Config(), options: {}, party: mixedV2Party, abilities: [mixedV2Declaration] },
    { profile: "stellar-conduct", config: stellarConfig(), options: {}, party: [{ actorId: "c", characterKey: "sandrone" }, { actorId: "e", characterKey: "lisa" }] },
    { profile: "stellar-swirl", config: stellarSwirlConfig(), options: {}, party: stellarSwirlParty },
  ];
  const serialized = new Map<string, string>();
  for (const request of requests) {
    const result = runSpecialSimulation(request);
    const exported = serializeSpecialSimulation(captureSpecialSimulation(request, result));
    const restored = parseSpecialSimulation(exported);
    expect(restored.request.profile).toBe(request.profile);
    expect(restored.result).toEqual(JSON.parse(JSON.stringify(result)));
    expect(restored.result.baseResult.damageEvents).toEqual(result.baseResult.damageEvents);
    if ("specialDamageEvents" in result) expect(result.specialDamageEvents.length).toBeGreaterThan(0);
    serialized.set(request.profile, exported);
  }

  const omitted = JSON.parse(serialized.get("lunar-charged")!) as CapturedSpecialSimulation & { result: { specialDamageEvents: unknown[] } };
  omitted.result.specialDamageEvents.pop();
  expect(() => parseSpecialSimulation(JSON.stringify(omitted))).toThrow(/differs from same-engine re-execution/);
  const reordered = JSON.parse(serialized.get("stellar-conduct")!) as CapturedSpecialSimulation;
  reordered.result = Object.fromEntries(Object.entries(reordered.result).reverse()) as typeof reordered.result;
  expect(parseSpecialSimulation(JSON.stringify(reordered)).request.profile).toBe("stellar-conduct");
  reordered.engineVersion = "older-engine";
  expect(() => parseSpecialSimulation(JSON.stringify(reordered))).toThrow(/requires engine/);

  const missingGuard = JSON.parse(serialized.get("lunar-bloom")!) as CapturedSpecialSimulation;
  const config = missingGuard.request.config as SimConfig;
  config.meta.verificationStatus = "user-supplied";
  config.weaponHitStackModel = { mode: "fixed-source-no-character-hitlag-v1", baselineUnbuffed: true,
    actors: [{ actorId: "c", weaponId: "weapon:14504", refinement: 1 }] };
  expect(() => parseSpecialSimulation(JSON.stringify(missingGuard))).toThrow(/独立月曜／星辉伤害/);
});
