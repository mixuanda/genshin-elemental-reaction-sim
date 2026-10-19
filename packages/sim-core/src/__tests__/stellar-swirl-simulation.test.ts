import { describe, expect, it } from "vitest";
import { simulationResultSchema } from "@genshin-dps-lab/schemas";
import { simulate, simulateStellarSwirlProfile } from "../simulator";
import { stellarSwirlEventToCalculatorDocument } from "../stellar-swirl-runtime";
import { calculateDocument } from "../calculator";
import { captureSimulationHit, replaySimulationHit } from "../calculator-bridge";
import { stellarSwirlConfig, stellarSwirlParty as party } from "./special-profile-fixtures";

describe("actual guide-reference Stellar-Swirl main queue", () => {
  it("replaces ordinary Swirl, snapshots initial hits, delivers real vortex Cryo, and replays the combined run", () => {
    const config = stellarSwirlConfig();
    const result = simulateStellarSwirlProfile(config, { party });
    expect(result.profile.evidence).toBe("guide-profile-source-conflict");
    expect(result.baseResult.damageEvents.every(event => event.reaction !== "swirlCryo")).toBe(true);
    expect(result.baseResult.damageEvents.every(event => event.reactionAudit.swirlReactions.length === 0)).toBe(true);
    expect(result.executionLog.filter(event => event.type === "vortex-trigger").map(event => event.details.triggers)).toEqual([2,3,4,5,6]);
    const initial = result.specialDamageEvents.find(event => event.intent.branch === "stellar-swirl-anemo-reaction")!;
    expect([initial.intent.snapshotFrame, initial.frame]).toEqual([6,9]);
    expect(initial.context.contributors.find(entry => entry.id === "a")!.elementalMastery).toBe(200);
    expect(initial.context.effectiveResistance).toBe(-0.1);
    const blasts = result.specialDamageEvents.filter(event => event.cryoDelivery !== null);
    expect(blasts.map(event => [event.frame,event.intent.branch])).toEqual([[36,"stellar-swirl-vortex-2"],[217,"stellar-swirl-vortex-1"]]);
    const firstBlast = blasts[0]!;
    expect(firstBlast.auraBefore).toEqual([]);
    expect(firstBlast.cryoDelivery).toMatchObject({ frame:36,ownerId:"a",targetId:"enemy-0",applied:true,element:"cryo",gaugeUnits:1 });
    expect(firstBlast.auraAfter).toEqual([{ element:"cryo",gaugeUnits:0.8,expiresAtFrame:606,sourceSlots:[{sourceActorId:"a",gaugeUnits:0.8}] }]);
    const trigger = result.baseResult.damageEvents.find(event => event.frame === 36)!;
    expect(firstBlast.executionOrder!.sequence).toBeGreaterThan(trigger.eventSequence);
    const feedback = result.baseResult.damageEvents.find(event => event.frame === 37)!;
    expect(feedback.reactionAudit.auraBefore![0]!.sourceSlots!.map(slot => slot.sourceActorId)).toEqual(["a"]);
    expect(result.specialDamageEvents.find(event => event.intent.snapshotFrame === 37)!.intent.contributorIds).toEqual(["a"]);
    expect(result.baseResult.targetStateTimeline.points.filter(point => point.cause === "stellar-swirl-attachment")).toHaveLength(2);
    expect(simulationResultSchema.parse(result.baseResult).totalDamage).toBe(result.classicDamage);
    const changed = structuredClone(result.baseResult);
    changed.targetStateTimeline.points.find(point => point.cause === "stellar-swirl-attachment")!.auraApplied[0]!.gaugeUnits = 2;
    expect(() => simulationResultSchema.parse(changed)).toThrow();
    for (const event of result.specialDamageEvents) expect(calculateDocument(stellarSwirlEventToCalculatorDocument(JSON.parse(JSON.stringify(result)),event.id)).totals!.expected).toBe(event.damage);
    for (const event of result.baseResult.damageEvents) expect(replaySimulationHit(captureSimulationHit(result.baseResult,event.id)).reproducedDamage).toBe(event.finalDamage);
    expect(result.totalDamage).toBe(result.classicDamage + result.stellarSwirlDamage);
    expect(simulate(config).damageEvents.some(event => event.reaction === "swirlCryo")).toBe(true);
  });
  it("expires a single level-one vortex at 180 frames and retains real per-owner refill decay", () => {
    const result = simulateStellarSwirlProfile(stellarSwirlConfig([6]), { party });
    const blast = result.specialDamageEvents.find(event => event.cryoDelivery !== null)!;
    expect([blast.frame,blast.intent.branch]).toEqual([186,"stellar-swirl-vortex-1"]);
    expect(blast.auraAfter[0]!.sourceSlots!.map(slot => slot.sourceActorId)).toEqual(["a","c"]);
    expect(blast.auraAfter[0]!.sourceSlots!.find(slot => slot.sourceActorId === "a")!.gaugeUnits).toBe(0.8);
    expect(result.highJump).toEqual({ available:true,expiresAt:486,consumptionImplemented:true,airborne:null });
  });
  it("does not count ICD-blocked attempts or damage still in flight at the observation boundary", () => {
    const blocked = stellarSwirlConfig([6,12,18]);
    blocked.timeline!.abilities[1]!.hits![0]!.application!.icd = { mode:"fixed-gcsim-application-v1",icdTag:"same-skill",groupId:"default" };
    const result = simulateStellarSwirlProfile(blocked,{party});
    expect(result.baseResult.damageEvents.filter(event => event.element === "anemo").map(event => event.reactionAudit.icdAllowed)).toEqual([true,false,false]);
    expect(result.specialDamageEvents.map(event => event.frame)).toEqual([9,186]);
    const short = stellarSwirlConfig([59]); short.duration = 1;
    expect(simulateStellarSwirlProfile(short,{party}).specialDamageEvents).toEqual([]);
  });
  it("captures the ordinary import run without discarding reaction-group blocked damage context", () => {
    const result = simulate(stellarSwirlConfig(), { compatibilityMode: "legal-frame-v1", critMode: "average", execution: { captureHits: true } });
    const restored = simulationResultSchema.parse(JSON.parse(JSON.stringify(result)));
    const blocked = restored.damageEvents.filter(event => event.kind === "transformative-reaction" && event.damageFactors.groupMultiplier === 0);
    expect(blocked.map(event => event.id)).toEqual([6,8,10]);
    for (const event of blocked) {
      expect(event.transformativeReactionFactors!.baseMultiplier).toBe(0.6);
      expect(event.transformativeReactionFactors!.preResistanceDamage).toBeGreaterThan(0);
      expect(event.potentialDamage).toBe(0);
      const replay = replaySimulationHit(captureSimulationHit(restored, event.id));
      const group = replay.trace.find(node => node.id === "reactionGroupPolicy")!;
      expect(group.inputs.find(input => input.key === "formulaDamage")!.value).toBeCloseTo(1917.738548181818,10);
      expect(group.inputs.find(input => input.key === "groupMultiplier")!.value).toBe(0);
      expect(group.result!.value).toBe(0);
      expect(replay.reproducedDamage).toBe(0);
    }
    const tampered = structuredClone(restored);
    tampered.damageEvents[6]!.damageFactors.groupMultiplier = 1;
    expect(() => simulationResultSchema.parse(tampered)).toThrow(/captured formula input|group/i);
  });

});
