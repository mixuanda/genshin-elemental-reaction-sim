import { describe, expect, it } from "vitest";
import { makeConfig } from "./fixtures";
import { simulate } from "../simulator";
import { repeatLegalTimelineForDuration, simulateWithStartup } from "../simulation-analysis";

// Synthetic closed ordinary-Aura input, not a character/team coverage claim.
function fixture(cycleLength = 20) {
  const config = makeConfig({ duration: cycleLength, cycleLength, rotation: [],
    enemy: { level: 110, resistance: 0.1, defReduction: 0, targets: [{ id: "enemy-0", name: "合成静止目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    reactionEngine: { mode: "aura-v9" }, targetTaskModel: { mode: "target-phase-v2" },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [
        { id: "e", actorId: "a", name: "合成水附着及固定火球", kind: "skill", cancelFrame: 1, animationEndFrame: 1,
          cooldownFrames: cycleLength * 60,
          particles: [{ id: "p", element: "pyro", count: 1, spawnFrame: 0, travelFrames: 1 }],
          hits: [{ id: "e-hit", frame: 0, scaling: 1, element: "hydro", application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" } } }] },
        { id: "q", actorId: "a", name: "合成蒸发耗能", kind: "burst", cancelFrame: 1, animationEndFrame: 1,
          cooldownFrames: cycleLength * 60, energyCost: 6,
          hits: [{ id: "q-hit", frame: 0, scaling: 1, element: "pyro", geometry: { kind: "circle", coordinateSpace: "world", origin: { x: 0, y: 0 }, radius: 1 }, application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" } } }] },
      ], commands: [{ type: "skill", actorId: "a", abilityId: "e", atFrame: 0 },
        { type: "burst", actorId: "a", abilityId: "q", atFrame: 2 }] } });
  config.characters[0]!.energyMax = 6;
  config.characters[0]!.stats.critRate = 0.5;
  return config;
}

describe("continuous finite simulation with an explicit 120-second window", () => {
  it.each([15, 18, 20])("expands %s-second inputs to 60/120 seconds without adding an action at the end boundary", cycle => {
    for (const duration of [60, 120]) {
      const source = fixture(cycle);
      const input = repeatLegalTimelineForDuration(source, duration);
      const frames = input.timeline!.commands.filter(command => command.type !== "wait").map(command => command.atFrame!);
      expect(input.duration).toBe(duration);
      expect(frames.filter(frame => frame % (cycle * 60) === 0))
        .toEqual(Array.from({ length: Math.ceil(duration / cycle) }, (_, i) => i * cycle * 60));
      expect(frames.every(frame => frame < duration * 60)).toBe(true);
      expect(source.duration).toBe(cycle);
    }
  });

  it.each(["zero", "full"] as const)("keeps energy continuous for a 120-second %s-energy opening", mode => {
    const input = repeatLegalTimelineForDuration(fixture(), 120);
    const answer = simulateWithStartup(input, { mode }, { critMode: "average", execution: { captureHits: true } });
    expect(answer.status, answer.reasons.join("; ")).toBe("completed");
    const result = answer.result!;
    expect(result.config.duration).toBe(120);
    expect(result.mechanicsStatus).toBe("complete");
    expect(result.damageEvents.filter(hit => hit.element === "hydro").map(hit => hit.frame))
      .toEqual([0, 1200, 2400, 3600, 4800, 6000]);
    const burstFrames = mode === "zero" ? [1202, 3602, 6002] : [2, 2402, 4802];
    const bursts = result.damageEvents.filter(hit => hit.element === "pyro");
    expect(bursts.map(hit => hit.frame)).toEqual(burstFrames);
    expect(bursts.every(hit => hit.reaction === "reverseVaporize")).toBe(true);
    expect(result.skippedActions).toHaveLength(3);
    expect(result.timelineExecution!.failures.every(row => row.code === "INSUFFICIENT_ENERGY")).toBe(true);
    // ATK 1000, DEF 190/(190+210), RES 0.9, mean crit 1+0.5*0.5;
    // six Hydro hits + three reverse Vaporizes at 1.5 with zero EM.
    expect(result.totalDamage).toBeCloseTo(1000 * 190 / 400 * 0.9 * 1.25 * (6 + 3 * 1.5), 8);
    expect(result.damageEvents.every(hit => hit.frame < 7200)).toBe(true);
  });

  it("samples crit exactly once per eligible hit and replays the same 120-second seed", () => {
    const input = repeatLegalTimelineForDuration(fixture(), 120);
    const before = structuredClone(input);
    const options = { randomSeed: "continuous-120-v1", execution: { criticalSampling: "seeded-random-v1" as const } };
    const first = simulate(input, options), replay = simulate(input, options);
    expect(first.damageEvents).toEqual(replay.damageEvents);
    expect(input).toEqual(before);
    expect(first.executionAudit!.criticalSampling!.drawCount).toBe(first.damageEvents.length);
    expect(first.damageEvents.every(hit => [1, 1.5].includes(hit.damageFactors.critMultiplier))).toBe(true);
    expect(first.executionAudit!.hits.map(hit => hit.critical.drawIndex)).toEqual(first.damageEvents.map((_, i) => i));
    expect(first.executionAudit!.hits.some(hit => hit.critical.outcome === "critical")).toBe(true);
    expect(first.executionAudit!.hits.some(hit => hit.critical.outcome === "noncritical")).toBe(true);
  });
});
