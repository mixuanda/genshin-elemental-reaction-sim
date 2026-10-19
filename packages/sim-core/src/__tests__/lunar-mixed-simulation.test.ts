import { describe, expect, it } from "vitest";
import { simulationResultSchema } from "@genshin-dps-lab/schemas";
import { simulate, simulateLunarMixedProfile } from "../simulator";
import { lunarMixedEventToCalculatorDocument } from "../lunar-mixed-runtime";
import { calculateDocument } from "../calculator";
import { captureSimulationHit, replaySimulationHit } from "../calculator-bridge";
import { makeConfig, neutralStats } from "./fixtures";

const party = [{ actorId: "h", characterKey: "columbina" }, { actorId: "e", characterKey: "fischl" }, { actorId: "g", characterKey: "zibai" }];
function mixedConfig() {
  const base = makeConfig();
  return makeConfig({ duration: 3, cycleLength: 4, reactionEngine: { mode: "aura-v3" }, rotation: [],
    characters: (["hydro", "electro", "geo"] as const).map((element, i) => ({ ...base.characters[0]!, id: ["h", "e", "g"][i]!, element, stats: { ...neutralStats, em: 100 + i * 100, critRate: 0.3 + i * 0.2 } })),
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "h", swapFrames: 1,
      abilities: ["h", "e", "g"].map(actorId => ({ id: actorId, actorId, name: actorId, kind: "skill" as const, cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
        hits: [{ id: actorId, frame: 0, scaling: 1, element: actorId === "h" ? "hydro" as const : actorId === "e" ? "electro" as const : "geo" as const, application: { gaugeUnits: actorId === "h" ? 4 : 1, icd: { mode: "no-icd-v1" as const } } }] })),
      commands: [{ type: "skill", actorId: "h", abilityId: "h", atFrame: 0 }, { type: "swap", characterId: "e", atFrame: 5 }, { type: "skill", actorId: "e", abilityId: "e", atFrame: 6 }, { type: "swap", characterId: "g", atFrame: 17 },
        ...[18, 24, 30].map(atFrame => ({ type: "skill" as const, actorId: "g", abilityId: "g", atFrame })),
        { type: "swap", characterId: "e", atFrame: 99 }, { type: "skill", actorId: "e", abilityId: "e", atFrame: 100 }]
    }
  });
}

describe("shared actual Lunar state and queue", () => {
  it("shares one Aura budget across cloud consumption, Electro crystal and Hydro conversion, with exact replays", () => {
    const input = mixedConfig();
    input.timeline!.abilities.push({ id: "buff", actorId: "g", name: "In-flight live change", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0, buffs: [{ stat: "em", value: 300, target: "self", durationFrames: 20 }], debuffs: [{ element: "geo", resShred: 0.2, durationFrames: 20 }] });
    input.timeline!.commands.splice(7, 0, { type: "skill", actorId: "g", abilityId: "buff", atFrame: 50 });
    const result = simulateLunarMixedProfile(input, { party });
    const clouds = result.specialDamageEvents.filter(event => event.intent.branch === "lunar-charged-reaction");
    const shots = result.specialDamageEvents.filter(event => event.intent.branch === "lunar-crystallize-reaction");
    expect(clouds.map(event => event.frame)).toEqual([15, 135]);
    expect(shots.map(event => event.intent.snapshotFrame)).toEqual([43, 55, 67]);
    expect(shots.map(event => event.frame)).toEqual([53, 65, 77]);
    expect(shots.map(event => event.context.contributors.find(actor => actor.id === "g")!.elementalMastery)).toEqual([300, 600, 600]);
    expect(shots.map(event => event.context.effectiveResistance)).toEqual([-0.1, -0.1, 0.1]);
    const firstGeo = result.conversionEvents.find(event => event.frame === 18)!.geoResolution!;
    expect(firstGeo.electroCrystallize!.scheduled).toBe(true);
    expect(firstGeo.sourceGaugeUnitsAfterElectro).toBeGreaterThan(0);
    expect(firstGeo.sourceGaugeUnitsAfterElectro).toBeLessThan(1);
    expect(firstGeo.sourceGaugeUnitsSpentOnHydro).toBeCloseTo(firstGeo.sourceGaugeUnitsAfterElectro, 9);
    expect(firstGeo.sourceGaugeUnitsAfter).toBe(0);
    const geoHit = result.baseResult.damageEvents.find(event => event.frame === 18)!;
    expect(geoHit.reaction).toBe("crystallizeElectro");
    expect(geoHit.reactionAudit.auraConsumed!.map(entry => entry.element)).toEqual(["electro", "hydro"]);
    expect(result.baseResult.crystallizeShardLog.filter(entry => entry.operation === "spawn").map(entry => entry.element)).toEqual(["electro"]);
    expect(result.baseResult.damageEvents.some(event => event.reaction === "electroCharged")).toBe(false);
    expect(clouds.every(event => event.executionOrder.priority === 2.5 && event.auraConsumed.length === 2)).toBe(true);
    expect(result.totalDamage).toBe(result.classicDamage + result.lunarChargedDamage + result.lunarCrystallizeDamage);
    const restored = JSON.parse(JSON.stringify(result));
    expect(simulationResultSchema.parse(restored.baseResult).totalDamage).toBe(result.classicDamage);
    for (const event of result.specialDamageEvents) expect(calculateDocument(lunarMixedEventToCalculatorDocument(restored, event.id)).totals!.expected).toBe(event.damage);
    for (const event of result.baseResult.damageEvents) expect(replaySimulationHit(captureSimulationHit(restored.baseResult, event.id)).reproducedDamage).toBe(event.finalDamage);
    const tampered = structuredClone(result.baseResult);
    tampered.targetStateTimeline.points.find(point => point.cause === "lunar-charged-consumption")!.auraConsumed[0]!.gaugeUnits += 0.1;
    expect(() => simulationResultSchema.parse(tampered)).toThrow();
  });

  it("respects the shared Geo budget and ordinary crystal GCD, and lets actual Geo drain cancel a pending cloud hit", () => {
    const input = mixedConfig();
    input.timeline!.commands = input.timeline!.commands.filter(command => !(command.type === "swap" && command.atFrame === 99) && !(command.type === "skill" && command.atFrame === 100));
    input.timeline!.commands[3] = { type: "swap", characterId: "g", atFrame: 11 };
    input.timeline!.commands[4] = { type: "skill", actorId: "g", abilityId: "g", atFrame: 12 };
    input.timeline!.abilities[2]!.hits![0]!.application!.gaugeUnits = 2;
    const drained = simulateLunarMixedProfile(input, { party });
    expect(drained.specialDamageEvents.some(event => event.intent.branch === "lunar-charged-reaction")).toBe(false);
    expect(drained.executionLog.some(entry => entry.type === "entity-create" && entry.ruleId.endsWith(":lunar-charged"))).toBe(true);

    const highElectro = mixedConfig();
    highElectro.timeline!.abilities[1]!.hits![0]!.application!.gaugeUnits = 4;
    highElectro.timeline!.commands[3] = { type: "swap", characterId: "g", atFrame: 11 };
    highElectro.timeline!.commands[4] = { type: "skill", actorId: "g", abilityId: "g", atFrame: 12 };
    highElectro.timeline!.commands.splice(7, 0, { type: "skill", actorId: "g", abilityId: "g", atFrame: 36 });
    const result = simulateLunarMixedProfile(highElectro, { party });
    const geos = result.conversionEvents.filter(event => event.geoResolution).map(event => event.geoResolution!);
    expect(geos[0]!.sourceGaugeUnitsAfterElectro).toBe(0);
    expect(geos[0]!.lunarCrystallizeTriggered).toBe(false);
    expect(geos.slice(1).map(event => [event.electroCrystallize!.scheduled, event.sourceGaugeUnitsAfterElectro, event.sourceGaugeUnitsSpentOnHydro])).toEqual([[false, 1, 1], [false, 1, 1], [false, 1, 1]]);
    expect(result.specialDamageEvents.filter(event => event.intent.branch === "lunar-crystallize-reaction").map(event => event.frame)).toEqual([59, 71, 83]);
  });

  it("checks each branch's party enablement and blocks unsupported elemental mixtures and envelope bypass", () => {
    const input = mixedConfig();
    expect(() => simulateLunarMixedProfile(input, { party: [{ actorId: "h", characterKey: "barbara" }, { actorId: "e", characterKey: "fischl" }, { actorId: "g", characterKey: "zibai" }] })).toThrow(/electroCharged/);
    const unsupported = mixedConfig(); unsupported.timeline!.abilities[0]!.hits![0]!.element = "dendro";
    expect(() => simulateLunarMixedProfile(unsupported, { party })).toThrow(/dendro/);
    expect(() => simulate(input, { execution: { lunarMixed: { profileId: "lunar-mixed-reference-v1", party } } })).toThrow(/simulateLunarMixedProfile/);
  });
});
