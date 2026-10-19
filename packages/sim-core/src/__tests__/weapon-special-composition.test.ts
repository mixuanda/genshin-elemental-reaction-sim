import { expect, it } from "vitest";
import { simulationResultSchema } from "@genshin-dps-lab/schemas";
import { simulateLunarBloomProfile, simulateStellarConductProfile } from "../simulator";
import { lunarBloomConfig, lunarBloomDeclaration, lunarBloomParty, stellarConfig } from "./special-profile-fixtures";

it("shares real swaps and ordinary weapon callbacks with special hosts while gating independent special reads", () => {
  const stellar = stellarConfig();
  const stellarParty = [{ actorId: "c", characterKey: "sandrone" }, { actorId: "e", characterKey: "lisa" }];
  const stellarBaseline = simulateStellarConductProfile(stellar, { party: stellarParty });
  stellar.thrillingTalesModel = { mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "c", refinement: 5 }] };
  stellar.weaponHitStackModel = { mode: "fixed-source-no-character-hitlag-v1", baselineUnbuffed: true,
    actors: [{ actorId: "e", weaponId: "weapon:14504", refinement: 1 }] };
  stellar.meta.verificationStatus = "user-supplied";
  const stellarResult = simulateStellarConductProfile(stellar, { party: stellarParty });
  expect(stellarResult.baseResult.thrillingTalesLog!.some(row => row.outcome === "applied" && row.ownerId === "c" && row.recipientId === "e")).toBe(true);
  expect(stellarResult.baseResult.weaponHitStackLog!.some(row => row.actor.actorId === "e" && row.outcome === "stack-gained")).toBe(true);
  expect(stellarResult.baseResult.totalDamage).toBeGreaterThan(stellarBaseline.baseResult.totalDamage);
  expect(simulationResultSchema.parse(JSON.parse(JSON.stringify(stellarResult.baseResult))).weaponHitStackState)
    .toEqual(stellarResult.baseResult.weaponHitStackState);

  const lunar = lunarBloomConfig();
  lunar.weaponHitStackModel = { mode: "fixed-source-no-character-hitlag-v1", baselineUnbuffed: true,
    actors: [{ actorId: "d", weaponId: "weapon:14504", refinement: 1 }] };
  lunar.meta.verificationStatus = "user-supplied";
  const lunarResult = simulateLunarBloomProfile(lunar, { party: lunarBloomParty, abilities: [lunarBloomDeclaration] });
  expect(lunarResult.baseResult.weaponHitStackLog!.some(row => row.actor.actorId === "d" && row.outcome === "stack-gained")).toBe(true);
  expect(lunarResult.specialDamageEvents.some(event => event.ownerId === "c")).toBe(true);
  expect(simulationResultSchema.parse(JSON.parse(JSON.stringify(lunarResult.baseResult))).weaponHitStackState)
    .toEqual(lunarResult.baseResult.weaponHitStackState);

  lunar.weaponHitStackModel.actors[0] = { actorId: "c", weaponId: "weapon:14504", refinement: 1 };
  expect(() => simulateLunarBloomProfile(lunar, { party: lunarBloomParty, abilities: [lunarBloomDeclaration] }))
    .toThrow(/独立月曜／星辉伤害.*OnEnemyDamage.*Stats/);
});
