import { describe, expect, it } from "vitest";
import { simulationResultSchema } from "@genshin-dps-lab/schemas";
import { simulate, simulateLunarChargedProfile } from "../simulator";
import { lunarChargedEventToCalculatorDocument } from "../lunar-charged-runtime";
import { captureSimulationHit, replaySimulationHit } from "../calculator-bridge";
import { calculateDocument } from "../calculator";
import { makeConfig, neutralStats } from "./fixtures";

const party = [{ actorId: "h", characterKey: "barbara" }, { actorId: "e", characterKey: "flins" }];
function config() {
  const base = makeConfig();
  return makeConfig({ duration: 6, cycleLength: 10, reactionEngine: { mode: "aura-v3" },
    characters: [ { ...base.characters[0]!, id: "h", element: "hydro", stats: { ...neutralStats, em: 100, critRate: 0.3 } }, { ...base.characters[0]!, id: "e", element: "electro", stats: { ...neutralStats, em: 200, critRate: 0.6 } } ],
    rotation: [],
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "h", swapFrames: 1,
      abilities: ["h", "e"].map(actorId => ({ id: actorId, actorId, name: actorId, kind: "skill" as const, cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
        hits: [{ id: actorId, frame: 0, scaling: 1, element: actorId === "h" ? "hydro" as const : "electro" as const, application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" as const } } }] })),
      commands: [{ type: "skill", actorId: "h", abilityId: "h", atFrame: 0 }, { type: "swap", characterId: "e", atFrame: 5 }, { type: "skill", actorId: "e", abilityId: "e", atFrame: 6 }]
    }
  });
}

describe("real Lunar-Charged reference simulation", () => {
  it("replaces ordinary EC before tasks, delivers real cloud damage and consumes every personal aura", () => {
    const multi = config();
    multi.characters.push({ ...multi.characters[0]!, id: "h2" });
    multi.timeline!.abilities.push({ ...multi.timeline!.abilities[0]!, id: "h2", actorId: "h2" });
    multi.timeline!.commands.splice(1, 0, { type: "swap", characterId: "h2", atFrame: 2 }, { type: "skill", actorId: "h2", abilityId: "h2", atFrame: 3 });
    const result = simulateLunarChargedProfile(multi, { party: [...party, { actorId: "h2", characterKey: "xingqiu" }] });
    expect(result.specialDamageEvents.map(event => event.frame)).toEqual([15, 135]);
    expect(result.baseResult.periodicReactionLog).toEqual([]);
    expect(result.baseResult.damageEvents.every(event => event.kind === "direct" && event.reaction === "none")).toBe(true);
    expect(result.baseResult.damageEvents[1]!.reactionAudit.auraConsumed).toEqual([]);
    const first = result.specialDamageEvents[0]!;
    expect(first.intent.contributorIds).toEqual(["e", "h", "h2"]);
    expect(first.auraConsumed.flatMap(entry => entry.sourceMutations.map(slot => slot.consumedGaugeUnits))).toEqual([0.4, 0.4, 0.4]);
    expect(first.damage).toBeGreaterThan(0);
    expect(result.totalDamage).toBe(result.classicDamage + result.lunarChargedDamage);
    expect(result.executionLog.some(entry => entry.type === "entity-expire" && entry.frame === 336)).toBe(true);
    expect(simulationResultSchema.parse(result.baseResult).totalDamage).toBe(result.classicDamage);
    const ordinary = replaySimulationHit(captureSimulationHit(result.baseResult, 2));
    expect(ordinary.reproducedDamage).toBe(result.baseResult.damageEvents[2]!.finalDamage);
    const replay = calculateDocument(lunarChargedEventToCalculatorDocument(JSON.parse(JSON.stringify(result)), first.id));
    expect(replay.totals!.expected).toBe(first.damage);
  });
  it("preserves classic EC when opt-in is absent, and blocks unsupported mode scope", () => {
    expect(simulate(config()).periodicReactionLog.length).toBeGreaterThan(0);
    expect(() => simulateLunarChargedProfile({ ...config(), reactionEngine: { mode: "aura-v2" } }, { party })).toThrow(/aura-v3/);
    expect(() => simulateLunarChargedProfile(config(), { party: party.map(member => ({ ...member, characterKey: "lisa" })) })).toThrow(/转换角色/);
    expect(() => simulate(config(), { execution: { lunarCharged: { profileId: "lunar-charged-reference-v1", party } } })).toThrow(/simulateLunarChargedProfile/);
  });
  it("uses live buff and resistance state at cloud snapshot and rejects tampered captures", () => {
    const base = config();
    base.timeline!.abilities.push({ id: "buff", actorId: "e", name: "Before cloud", kind: "skill", cooldownFrames: 0, cancelFrame: 1, animationEndFrame: 1, buffs: [{ stat: "em", value: 300, durationFrames: 60, target: "self" }], debuffs: [{ element: "electro", resShred: 0.2, durationFrames: 60 }] });
    base.timeline!.commands.push({ type: "skill", actorId: "e", abilityId: "buff", atFrame: 9 });
    const result = simulateLunarChargedProfile(base, { party });
    expect(result.baseResult.compatibilityMode).toBe("legal-frame-v1");
    expect(result.specialDamageEvents[0]!.context.contributors.find(contributor => contributor.id === "e")!.elementalMastery).toBe(500);
    expect(result.specialDamageEvents[1]!.context.contributors.find(contributor => contributor.id === "e")!.elementalMastery).toBe(200);
    expect(result.specialDamageEvents[0]!.context.effectiveResistance).toBe(-0.1);
    const modified = structuredClone(result);
    modified.specialDamageEvents[0]!.context.contributors[0]!.elementalMastery += 1;
    expect(() => lunarChargedEventToCalculatorDocument(modified, 0)).toThrow(/does not reproduce/);
    modified.specialDamageEvents[0]!.damage = Infinity;
    expect(() => lunarChargedEventToCalculatorDocument(modified, 0)).toThrow(/does not reproduce/);
  });
  it("retains separate natural Aura expiry frames between empty cloud scans", () => {
    const weak = config();
    for (const ability of weak.timeline!.abilities) ability.hits![0]!.application!.gaugeUnits = 0.6;
    const result = simulateLunarChargedProfile(weak, { party });
    expect(result.specialDamageEvents.map(event => event.frame)).toEqual([15]);
    const expiry = result.baseResult.targetStateTimeline.points.filter(point => point.cause === "aura-natural-expiry");
    expect(expiry.map(point => point.frame)).toEqual([85, 91]);
    expect(expiry[0]!.auraAfter.map(aura => aura.element)).toEqual(["electro"]);
    expect(expiry[1]!.auraAfter).toEqual([]);
  });
});
