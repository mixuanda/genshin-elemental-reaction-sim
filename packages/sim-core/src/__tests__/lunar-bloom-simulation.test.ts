import { describe, expect, it } from "vitest";
import { simulate, simulateLunarBloomProfile } from "../simulator";
import { lunarBloomEventToCalculatorDocument } from "../lunar-bloom-runtime";
import { calculateDocument } from "../calculator";
import { captureSimulationHit, replaySimulationHit } from "../calculator-bridge";
import { lunarBloomConfig, lunarBloomParty as party, lunarBloomDeclaration as declaration } from "./special-profile-fixtures";

describe("actual Lunar-Bloom resource and declared ability simulation", () => {
  it("retains the actual ordinary core and executes one real Dew spend and three source-defined hits", () => {
    const input = lunarBloomConfig();
    const result = simulateLunarBloomProfile(input, { party, abilities: [declaration] });
    const ordinary = simulate(input);
    expect(result.baseResult.damageEvents).toEqual(ordinary.damageEvents);
    expect(result.baseResult.dendroCoreLog.some(entry => entry.operation === "spawn")).toBe(true);
    expect(result.executionLog.find(entry => entry.type === "resource-gain")?.frame).toBe(153);
    expect(result.executionLog.find(entry => entry.type === "ability-resource-consumed")?.frame).toBe(215);
    expect(result.specialDamageEvents.map(event => event.frame)).toEqual([222,230,252]);
    for (const event of result.specialDamageEvents) expect(event.damage).toBeCloseTo(916.84341, 8);
    expect(result.totalDamage).toBe(result.classicDamage + result.lunarBloomDamage);
    for (const event of result.specialDamageEvents) expect(calculateDocument(lunarBloomEventToCalculatorDocument(JSON.parse(JSON.stringify(result)), event.id)).totals!.expected).toBe(event.damage);
    for (const event of result.baseResult.damageEvents) expect(replaySimulationHit(captureSimulationHit(result.baseResult, event.id)).reproducedDamage).toBe(event.finalDamage);
    expect(result.verdantDew).toMatchObject({ ruleId: "verdant-dew-fixed-core-order-v2", full: 0, partialFrames: 2 });
  });
  it("rejects missing resource and fake idle starts, and excludes undelivered hits beyond the horizon", () => {
    const short = lunarBloomConfig(); short.duration = 4;
    expect(simulateLunarBloomProfile(short, { party, abilities: [declaration] }).specialDamageEvents.map(event => event.frame)).toEqual([222,230]);
    const early = lunarBloomConfig(); early.timeline!.commands[3] = { type: "swap", characterId: "c", atFrame: 100 }; early.timeline!.commands[4] = { type: "charge", actorId: "c", abilityId: "moon", atFrame: 101 };
    expect(() => simulateLunarBloomProfile(early, { party, abilities: [declaration] })).toThrow(/已有草露/);
    const notIdle = lunarBloomConfig(); notIdle.timeline!.abilities[1]!.animationEndFrame = 200;
    expect(() => simulateLunarBloomProfile(notIdle, { party, abilities: [declaration] })).toThrow(/闲置起手/);
    const resourceOnly = simulateLunarBloomProfile(lunarBloomConfig(false), { party });
    expect(resourceOnly.specialDamageEvents).toEqual([]); expect(resourceOnly.verdantDew.full).toBe(1);
  });
});
