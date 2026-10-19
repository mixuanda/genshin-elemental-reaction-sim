import { describe, expect, it } from "vitest";
import { simulationResultSchema } from "@genshin-dps-lab/schemas";
import { simulate, simulateLunarCrystallizeProfile } from "../simulator";
import { lunarCrystallizeEventToCalculatorDocument } from "../lunar-crystallize-runtime";
import { calculateDocument } from "../calculator";
import { captureSimulationHit, replaySimulationHit } from "../calculator-bridge";
import { makeConfig, neutralStats } from "./fixtures";

const party = [{ actorId: "h", characterKey: "barbara" }, { actorId: "g", characterKey: "zibai" }];
function config() {
  const base = makeConfig();
  return makeConfig({ duration: 10, cycleLength: 11, reactionEngine: { mode: "aura-v3" },
    characters: [ { ...base.characters[0]!, id: "h", element: "hydro", stats: { ...neutralStats, em: 100, critRate: 0.3 } }, { ...base.characters[0]!, id: "g", element: "geo", stats: { ...neutralStats, em: 200, critRate: 0.6 } } ], rotation: [],
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "h", swapFrames: 1,
      abilities: ["h", "g"].map(actorId => ({ id: actorId, actorId, name: actorId, kind: "skill" as const, cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
        hits: [{ id: actorId, frame: 0, scaling: 1, element: actorId === "h" ? "hydro" as const : "geo" as const, application: { gaugeUnits: actorId === "h" ? 4 : 1, icd: { mode: "no-icd-v1" as const } } }] })),
      commands: [{ type: "skill", actorId: "h", abilityId: "h", atFrame: 0 }, { type: "swap", characterId: "g", atFrame: 5 }, ...[6, 12, 18].map(atFrame => ({ type: "skill" as const, actorId: "g", abilityId: "g", atFrame }))]
    }
  });
}

describe("real Lunar-Crystallize reference simulation", () => {
  it("uses three real conversions without ordinary shard ICD and delivers three delayed projectiles", () => {
    const result = simulateLunarCrystallizeProfile(config(), { party });
    expect(result.specialDamageEvents.map(event => event.intent.snapshotFrame)).toEqual([31, 43, 55]);
    expect(result.specialDamageEvents.map(event => event.frame)).toEqual([41, 53, 65]);
    const triggers = result.baseResult.damageEvents.filter(event => event.element === "geo");
    expect(triggers.map(event => event.reactionAudit.auraConsumed![0]!.gaugeUnits)).toEqual([0.5, 0.5, 0.5]);
    expect(triggers.every(event => event.reaction === "none" && event.reactionAudit.crystallizeReaction === null)).toBe(true);
    expect(result.baseResult.crystallizeShardLog).toEqual([]);
    expect(result.specialDamageEvents.every(event => event.intent.contributorIds.join(",") === "g,h" && event.auraConsumed.length === 0)).toBe(true);
    expect(result.totalDamage).toBe(result.classicDamage + result.lunarCrystallizeDamage);
    expect(result.executionLog.some(entry => entry.type === "entity-expire" && entry.frame === 558)).toBe(true);
    expect(simulationResultSchema.parse(result.baseResult).totalDamage).toBe(result.classicDamage);
    const restored = JSON.parse(JSON.stringify(result));
    expect(calculateDocument(lunarCrystallizeEventToCalculatorDocument(restored, 0)).totals!.expected).toBe(result.specialDamageEvents[0]!.damage);
    expect(replaySimulationHit(captureSimulationHit(result.baseResult, 3)).reproducedDamage).toBe(result.baseResult.damageEvents[3]!.finalDamage);
  });
  it("snapshots characters for each shot and reads enemy resistance only on delivery", () => {
    const input = config();
    input.timeline!.abilities.push({ id: "buff", actorId: "g", name: "During flight", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
      buffs: [{ stat: "em", value: 300, target: "self", durationFrames: 20 }], debuffs: [{ element: "geo", resShred: 0.2, durationFrames: 20 }] });
    input.timeline!.commands.push({ type: "skill", actorId: "g", abilityId: "buff", atFrame: 35 });
    const result = simulateLunarCrystallizeProfile(input, { party });
    expect(result.specialDamageEvents.map(event => event.context.contributors.find(actor => actor.id === "g")!.elementalMastery)).toEqual([200, 500, 200]);
    expect(result.specialDamageEvents.map(event => event.context.effectiveResistance)).toEqual([-0.1, -0.1, 0.1]);
    const tampered = structuredClone(result);
    tampered.specialDamageEvents[0]!.context.contributors[0]!.elementalMastery += 1;
    expect(() => lunarCrystallizeEventToCalculatorDocument(tampered, 0)).toThrow(/does not reproduce/);
    tampered.specialDamageEvents[0]!.damage = Infinity;
    expect(() => lunarCrystallizeEventToCalculatorDocument(tampered, 0)).toThrow(/does not reproduce/);
  });
  it("does not count ICD-blocked applications or projectiles beyond the observation horizon", () => {
    const gated = config();
    gated.timeline!.abilities[1]!.hits![0]!.application!.icd = { mode: "fixed-gcsim-application-v1", icdTag: "same-skill", groupId: "default" };
    const blocked = simulateLunarCrystallizeProfile(gated, { party });
    expect(blocked.specialDamageEvents).toEqual([]);
    expect(blocked.baseResult.damageEvents.filter(event => event.element === "geo").map(event => event.reactionAudit.icdAllowed)).toEqual([true, false, false]);
    const short = config(); short.duration = 1;
    expect(simulateLunarCrystallizeProfile(short, { party }).specialDamageEvents.map(event => event.frame)).toEqual([41, 53]);
    expect(simulate(config()).crystallizeShardLog.length).toBeGreaterThan(0);
  });
});
