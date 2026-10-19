import { describe, expect, it } from "vitest";
import { simulationResultSchema, type AbilityDefinition, type LegalTimelineCommand, type SimConfig } from "@genshin-dps-lab/schemas";
import { SeededRandom, type SeededRandomState } from "../energy";
import { simulate } from "../simulator";
import { evaluateSimulationSteadyState, repeatLegalTimelineForDuration } from "../simulation-analysis";
import { captureSimulationHit, replaySimulationHit } from "../calculator-bridge";
import { makeConfig } from "./fixtures";

/** All actors/actions are synthetic; no complete-character claim is involved. */
export function randomCheckpointFixture(): SimConfig {
  const normal = (id: string): AbilityDefinition => ({ id: `${id}-n`, actorId: id, name: "明确合成普通命中", kind: "normal",
    cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
    hits: [{ id: `${id}-hit`, frame: 0, scaling: 1, element: "physical", attackTag: "normal", normalHitEnergyTag: "normal" }] });
  const a = normal("a");
  a.particles = [{ id: "variable-count", source: "明确数量区间", element: "pyro", kind: "particle", count: { min: 1, max: 2 }, spawnFrame: 0, travelFrames: 300 }];
  const b: AbilityDefinition = { id: "b-e", actorId: "b", name: "明确合成元素战技", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 60,
    hits: [{ id: "b-hit", frame: 0, scaling: 1, element: "physical", attackTag: "skill" }] };
  const d = normal("d");
  d.particles = [{ id: "chance-particle", source: "明确概率产球", element: "pyro", kind: "particle", count: 1, travelFrames: 2,
    trigger: { kind: "hit-confirm", hitIds: ["d-hit"], probability: .5 } }];
  const commands: LegalTimelineCommand[] = [
    { type: "swap", characterId: "a", atFrame: 0 }, { type: "normal", actorId: "a", abilityId: "a-n", atFrame: 1 },
    { type: "swap", characterId: "b", atFrame: 9 }, { type: "skill", actorId: "b", abilityId: "b-e", atFrame: 10 },
    { type: "swap", characterId: "c", atFrame: 19 }, { type: "normal", actorId: "c", abilityId: "c-n", atFrame: 20 },
    { type: "swap", characterId: "d", atFrame: 29 }, { type: "normal", actorId: "d", abilityId: "d-n", atFrame: 30 },
  ];
  const config = makeConfig({ duration: 10, cycleLength: 10, randomSeed: "test-seed",
    meta: { name: "七类命名随机流的合成边界", version: "1", verificationStatus: "user-supplied" },
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [{ id: "enemy-0", name: "合成静止目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    favoniusModel: { mode: "fixed-source-independent-stream-v1", actors: [{ actorId: "a", weaponId: "favoniussword", refinement: 5, particleDelayFrames: 10 }] },
    sacrificialModel: { mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "b", weaponId: "sacrificialsword", refinement: 5 }] },
    weaponProcModel: { mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "c", weaponId: "prototypearchaic", refinement: 5, physicalDamageBonus: 0 }] },
    normalHitEnergyModel: { mode: "fixed-source-independent-stream-v1", actors: [
      { actorId: "a", weaponType: "sword" }, { actorId: "b", weaponType: "sword" }, { actorId: "c", weaponType: "claymore" }, { actorId: "d", weaponType: "bow" },
    ] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "d", swapFrames: 1,
      abilities: [a, b, normal("c"), d], commands },
  });
  config.characters = ["a", "b", "c", "d"].map(id => ({ ...structuredClone(config.characters[0]!), id, name: id, stats: { ...config.characters[0]!.stats, critRate: 1 } }));
  return repeatLegalTimelineForDuration(config, 60, { execution: { criticalSampling: "seeded-random-v1" } });
}

type Captured = { version: string; streams: Record<string, SeededRandomState>; normalHitEnergy: { actors: unknown[] }; favonius: { actors: unknown[] } };

describe("actual named random state at pre-event boundaries", () => {
  it("continues the exact existing stream after detached JSON capture, including the original floating accumulator", () => {
    const random = new SeededRandom("favonius-gates\u0000favonius-v1");
    expect(random.next()).toBe(.2852213536389172);
    const saved = JSON.parse(JSON.stringify(random.captureState()));
    const restored = SeededRandom.fromState(saved);
    expect(Array.from({ length: 8 }, () => restored.next())).toEqual(Array.from({ length: 8 }, () => random.next()));
    expect(saved.drawCount).toBe(1);
    const accumulator = 2 ** 53 + 6;
    const high = { ...saved, accumulator, state: accumulator >>> 0 };
    const original = SeededRandom.fromState(high);
    original.next();
    const continued = SeededRandom.fromState(JSON.parse(JSON.stringify(original.captureState())));
    expect(continued.next()).toBe(original.next());
  });

  it("captures all seven real streams, cooldowns, in-flight procs and particles without claiming stochastic steady state", () => {
    const result = simulate(randomCheckpointFixture(), { execution: { criticalSampling: "seeded-random-v1", checkpointFrames: [0, 1, 21, 300, 600, 601, 621, 900] } });
    expect(result.executionAudit!.checkpointCoverage).toEqual({ complete: true, missingDimensions: [], reasons: [] });
    const at = (tick: number) => result.executionAudit!.phaseCheckpoints.find(point => point.tick === tick)!;
    const rng = (tick: number) => (at(tick).state.icdAndTriggerHistory as { randomExecution: Captured }).randomExecution;
    expect(Object.keys(rng(0).streams).sort()).toEqual(["critical", "favonius", "normalHitEnergy", "particleCount", "particleTrigger", "sacrificial", "weaponProc"]);
    expect(Object.values(rng(0).streams).every(stream => stream.drawCount === 0)).toBe(true);
    // Before frame 1, neither that frame's hit nor its particle draw has run.
    expect(rng(1).streams.critical!.drawCount).toBe(0);
    expect(rng(21).streams).toMatchObject({ particleCount: { drawCount: 1 }, critical: { drawCount: 3 }, favonius: { drawCount: 1 }, sacrificial: { drawCount: 1 }, weaponProc: { drawCount: 1 } });
    expect(rng(21).favonius.actors).toMatchObject([{ actorId: "a", cooldownRemainingTicks: 340 }]);
    expect((at(21).state.pendingEvents as { inFlight: unknown[] }).inFlight).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "hit", remainingTicks: 0, payload: expect.objectContaining({ weaponProcContext: expect.objectContaining({ random: expect.objectContaining({ drawIndex: 0 }) }) }) }),
      expect.objectContaining({ type: "particleReceive", remainingTicks: 280 }),
    ]));
    const nextFavonius = result.favoniusLog!.find(row => row.frame >= 21 && row.drawIndex === rng(21).streams.favonius!.drawCount)!;
    expect(SeededRandom.fromState(rng(21).streams.favonius).next()).toBe(nextFavonius.roll);
    expect(rng(300).streams.particleTrigger!.drawCount).toBe(1);
    expect(rng(601).streams.critical!.drawCount).toBe(rng(600).streams.critical!.drawCount);
    const state = evaluateSimulationSteadyState(result);
    expect(state.status).toBe("not-established");
    expect(state.reasons.join(" ")).toContain("随机状态已捕获不等于分布收敛");
    expect(simulationResultSchema.parse(JSON.parse(JSON.stringify(result))).executionAudit!.phaseCheckpoints).toEqual(result.executionAudit!.phaseCheckpoints);
    const child = result.damageEvents.find(event => event.weaponProcLogId !== undefined)!;
    expect(replaySimulationHit(JSON.parse(JSON.stringify(captureSimulationHit(result, child.id)))).difference).toBe(0);
    const forged = structuredClone(result);
    ((forged.executionAudit!.phaseCheckpoints[2]!.state.icdAndTriggerHistory as { randomExecution: Captured }).randomExecution.streams.favonius!).drawCount += 1;
    expect(simulationResultSchema.safeParse(forged).success).toBe(false);
    console.log(JSON.stringify({ checkpoints: result.executionAudit!.phaseCheckpoints.length, streams: Object.keys(rng(0).streams).length, at21: Object.fromEntries(Object.entries(rng(21).streams).map(([key, value]) => [key, value.drawCount])), totalDamage: result.totalDamage, nextFavoniusRoll: nextFavonius.roll, steadyState: state.status }));
  });
});
