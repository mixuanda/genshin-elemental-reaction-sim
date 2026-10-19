import { describe, expect, it } from "vitest";
import { simulationResultSchema } from "@genshin-dps-lab/schemas";
import { simulateLunarMixedV2Profile } from "../simulator";
import { lunarMixedV2EventToCalculatorDocument } from "../lunar-mixed-v2-runtime";
import { calculateDocument } from "../calculator";
import { captureSimulationHit, replaySimulationHit } from "../calculator-bridge";
import { AuraEngine } from "../aura";
import { mixedV2Config, mixedV2Declaration, mixedV2Party } from "./lunar-mixed-v2.fixture";

describe("mixed Lunar v2 real shared Dendro state", () => {
  it("shares actual Quicken/Bloom cores, Hyperbloom, three Lunar branches and one Dew consumption", () => {
    const result = simulateLunarMixedV2Profile(mixedV2Config(), { party: mixedV2Party, abilities: [mixedV2Declaration] });
    expect(result.baseResult.reactionTaskLog.some(task => task.kind === "quicken-bloom-followup" && task.status === "triggered" && task.frame === 8)).toBe(true);
    expect(result.baseResult.dendroCoreLog.filter(entry => entry.operation === "spawn")).toHaveLength(2);
    expect(result.baseResult.damageEvents.filter(event => event.reaction === "hyperbloom").map(event => event.frame)).toEqual([116, 116]);
    expect(result.baseResult.damageEvents.some(event => event.reaction === "electroCharged")).toBe(false);
    expect(result.specialDamageEvents.filter(event => event.kind === "reaction" && event.intent.branch === "lunar-charged-reaction").map(event => event.frame)).toEqual([57]);
    expect(result.specialDamageEvents.filter(event => event.kind === "reaction" && event.intent.branch === "lunar-crystallize-reaction").map(event => event.frame)).toEqual([105, 117, 129]);
    const direct = result.specialDamageEvents.filter(event => event.kind === "direct-ability");
    expect(direct.map(event => event.frame)).toEqual([222, 230, 252]);
    expect(direct.every(event => event.resourceConsumption.frame === 215 && event.executionOrder.priority === 3)).toBe(true);
    expect(result.executionLog.find(entry => entry.type === "resource-gain")?.frame).toBe(155);
    expect(result.verdantDew).toMatchObject({ ruleId: "verdant-dew-fixed-core-order-v2", full: 0, partialFrames: 2 });
    expect(result.totalDamage).toBe(result.classicDamage + result.lunarChargedDamage + result.lunarCrystallizeDamage + result.lunarBloomDamage);
    const restored = JSON.parse(JSON.stringify(result));
    expect(simulationResultSchema.parse(restored.baseResult).totalDamage).toBe(result.classicDamage);
    for (const event of result.specialDamageEvents) expect(calculateDocument(lunarMixedV2EventToCalculatorDocument(restored, event.id)).totals!.expected).toBe(event.damage);
    for (const event of result.baseResult.damageEvents) expect(replaySimulationHit(captureSimulationHit(restored.baseResult, event.id)).reproducedDamage).toBe(event.finalDamage);
  });

  it("places LC inside sourced Hydro and Electro order without suppressing Bloom or queued Quicken", () => {
    // Explicit lower-level modifier vectors; not legal team initial Aura or
    // fabricated character applications. They isolate both source branches.
    const flags = { mode: "aura-v7" as const, lunarChargedConversion: true, lunarMixedConversion: true, lunarDendroConversion: true };
    const hydro = new AuraEngine({ ...flags, initialAura: [{ element: "dendro", gaugeUnits: 1 }, { element: "electro", gaugeUnits: 1 }] });
    const h = hydro.processConfiguredHit({ frame: 0, sourceActorId: "h", element: "hydro", application: { gaugeUnits: 3, icd: { mode: "no-icd-v1" } } });
    expect(h.bloomReactions).toHaveLength(1);
    expect(hydro.didLastApplicationTriggerLunarCharged()).toBe(true);
    expect(h.auraAfter!.some(aura => aura.element === "hydro")).toBe(false);
    expect(h.periodicReaction).toBeNull();
    const electro = new AuraEngine({ ...flags, initialAura: [{ element: "hydro", gaugeUnits: 2 }, { element: "dendro", gaugeUnits: 1 }] });
    const e = electro.processConfiguredHit({ frame: 0, sourceActorId: "e", element: "electro", application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" } } });
    expect(e.catalyzeReaction!.quicken!.pendingHydroBloomFollowup).toBe(true);
    expect(e.bloomReactions).toEqual([]);
    expect(electro.didLastApplicationTriggerLunarCharged()).toBe(true);
    expect(e.periodicReaction).toBeNull();
    const followup = electro.processQuickenBloomFollowup({ frame: 0, sourceActorId: "e", triggerElement: "electro" });
    expect(followup.status).toBe("triggered");
    expect(followup.bloomReaction).toMatchObject({ sourceActorId: "e", triggerElement: "electro", operation: "quicken-followup" });
  });

  it("cannot borrow Dew produced later in the action-selection frame and requires each conversion identity", () => {
    const early = mixedV2Config();
    early.timeline!.commands[13] = { type: "swap", characterId: "h", atFrame: 154 };
    early.timeline!.commands[14] = { type: "charge", actorId: "h", abilityId: "moon", atFrame: 155 };
    expect(() => simulateLunarMixedV2Profile(early, { party: mixedV2Party, abilities: [mixedV2Declaration] })).toThrow(/已有草露/);
    const missing = mixedV2Party.map(member => member.actorId === "h" ? { ...member, characterKey: "barbara" } : member);
    expect(() => simulateLunarMixedV2Profile(mixedV2Config(false), { party: missing })).toThrow(/electroCharged/);
    const truncated = mixedV2Config(); truncated.duration = 4;
    expect(simulateLunarMixedV2Profile(truncated, { party: mixedV2Party, abilities: [mixedV2Declaration] }).specialDamageEvents.filter(event => event.kind === "direct-ability").map(event => event.frame)).toEqual([222, 230]);
  });
});
