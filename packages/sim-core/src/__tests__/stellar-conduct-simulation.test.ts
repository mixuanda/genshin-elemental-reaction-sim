import { describe, expect, it } from "vitest";
import { simulate, simulateStellarConductProfile } from "../simulator";
import { captureSimulationHit, replaySimulationHit } from "../calculator-bridge";
import { makeConfig, neutralStats } from "./fixtures";
const party = [{ actorId: "c", characterKey: "sandrone" }, { actorId: "e", characterKey: "lisa" }];
import { stellarConfig } from "./special-profile-fixtures";

describe("actual Stellar-Conduct field", () => {
  it("replaces superconduct, records applications, publishes bonuses, and restores affected hits", () => {
    const result = simulateStellarConductProfile(stellarConfig(), { party, execution: { detailedTraces: true } });
    expect(result.baseResult.damageEvents.every(hit => hit.reaction !== "superconduct")).toBe(true);
    expect(result.baseResult.damageEvents[1]!.reactionAudit.auraConsumed![0]!.gaugeUnits).toBeGreaterThan(0);
    expect(result.executionLog.filter(entry => entry.type === "field-buffs").map(entry => [entry.frame, entry.details.applicationCount])).toEqual([[6,0],[246,2]]);
    const shots = result.baseResult.damageEvents.filter(hit => hit.frame === 260 && hit.element === "electro");
    expect(shots.map(hit => hit.damageFactors.damageBonus)).toEqual([0.2,0.3]);
    const physical = result.baseResult.damageEvents.filter(hit => hit.element === "physical");
    expect(physical.map(hit => hit.damageFactors.effectiveResistance)).toEqual([-0.30000000000000004,-0.30000000000000004,0.1]);
    expect(result.fieldInfluences.find(hit => hit.frame === 400)!.fieldPresent).toBe(false);
    for (const hit of result.fieldInfluences) {
      const replay = replaySimulationHit(JSON.parse(JSON.stringify(captureSimulationHit(result.baseResult, hit.eventId))));
      expect(replay.reproducedDamage).toBe(result.baseResult.damageEvents[hit.eventId]!.finalDamage);
      expect(replay.trace.some(node => node.id === "stellarConductDamageBonus")).toBe(true);
    }
    const changed = structuredClone(captureSimulationHit(result.baseResult, result.fieldInfluences[0]!.eventId));
    changed.sourceResult.executionAudit!.hits.find(hit => hit.eventId === changed.eventId)!.stellarConduct!.damageBonus += 0.01;
    expect(() => replaySimulationHit(changed)).toThrow();
    expect(simulate(stellarConfig()).damageEvents.some(hit => hit.reaction === "superconduct")).toBe(true);
  });
});
