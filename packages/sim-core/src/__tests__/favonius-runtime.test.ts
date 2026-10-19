import { describe, expect, it } from "vitest";
import { simulationResultSchema } from "@genshin-dps-lab/schemas";
import { FavoniusRuntime, FAVONIUS_PROFILE } from "../favonius";
import { simulate } from "../simulator";
import { evaluateSimulationSteadyState } from "../simulation-analysis";
import { calculateDamageTrace } from "../calculator-formula";
import { makeConfig } from "./fixtures";

function fixture() {
  const config = makeConfig({ duration: 6.3, cycleLength: 6.3, rotation: [],
    favoniusModel: { mode: "fixed-source-independent-stream-v1", actors: [{ actorId: "a", weaponId: "favoniussword", refinement: 5, particleDelayFrames: 10 }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 12,
      abilities: [
        { id: "e", actorId: "a", name: "合成三段暴击判定", kind: "skill", cancelFrame: 3, animationEndFrame: 3, cooldownFrames: 0,
          hits: [0, 1, 2].map((frame) => ({ id: `e-${frame}`, frame, scaling: 1, element: "pyro" as const, critRate: frame === 0 ? 0 : 1 })) },
        { id: "late", actorId: "a", name: "冷却边界命中", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
          hits: [{ id: "late-hit", frame: 0, scaling: 1, element: "pyro", critRate: 1 }] },
        { id: "q", actorId: "a", name: "合成六能量消耗", kind: "burst", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0, energyCost: 6 },
      ], commands: [
        { type: "skill", actorId: "a", abilityId: "e" }, { type: "wait", frames: 2 },
        { type: "burst", actorId: "a", abilityId: "q" }, { type: "wait", frames: 7 },
        { type: "burst", actorId: "a", abilityId: "q" }, { type: "wait", frames: 348 },
        { type: "skill", actorId: "a", abilityId: "late" },
      ] } });
  config.characters[0]!.initialEnergy = 0;
  config.characters.push({ ...structuredClone(config.characters[0]!), id: "b", name: "后台队友" });
  return config;
}

describe("source-backed Favonius energy feedback", () => {
  it("checks zero damage, actual critical, on-field and character cooldown before drawing, including R5", () => {
    const runtime = new FavoniusRuntime("favonius-gates", { mode: "fixed-source-independent-stream-v1", actors: [
      { actorId: "a", weaponId: "favoniussword", refinement: 1, particleDelayFrames: 100 },
      { actorId: "b", weaponId: "favoniuscodex", refinement: 5, particleDelayFrames: 100 },
    ] });
    const damage = { actorId: "a", frame: 0, damageEventId: 0, activeCharacterId: "a", damage: 100, critical: true };
    expect(runtime.onDamage({ ...damage, damage: 0 })).toMatchObject({ outcome: "zero-damage", drawCountAfter: 0, roll: null });
    expect(runtime.onDamage({ ...damage, critical: false })).toMatchObject({ outcome: "noncritical", drawCountAfter: 0, roll: null });
    expect(runtime.onDamage({ ...damage, activeCharacterId: "b" })).toMatchObject({ outcome: "off-field", drawCountAfter: 0, roll: null });
    expect(runtime.onDamage(damage)).toMatchObject({ outcome: "triggered", probability: 0.6, cooldownFrames: 720, readyFrameAfter: 720,
      roll: 0.2852213536389172, drawIndex: 0, drawCountAfter: 1 });
    expect(runtime.onDamage({ ...damage, frame: 1 })).toMatchObject({ outcome: "cooldown-blocked", readyFrameAfter: 720, roll: null, drawCountAfter: 1 });
    expect(runtime.onDamage({ ...damage, frame: 1, actorId: "b", activeCharacterId: "b" })).toMatchObject({ outcome: "triggered", probability: 1,
      cooldownFrames: 360, readyFrameAfter: 361, roll: 0.8333827441092581, drawIndex: 1, drawCountAfter: 2 });
    expect(runtime.onDamage({ ...damage, frame: 720 })).toMatchObject({ outcome: "failed-roll", roll: 0.9273596082348377,
      readyFrameBefore: 720, readyFrameAfter: 720, drawIndex: 2 });
    expect(runtime.onDamage({ ...damage, frame: 721 }).drawIndex).toBe(3);
    expect(FAVONIUS_PROFILE.matchesGcsimRandomSequence).toBe(false);
  });

  it("feeds real seeded critical callbacks into delayed team particles and legal burst energy, retaining exact hit replay", () => {
    const result = simulate(fixture(), { energyMode: "zero", randomSeed: "favonius-feedback", execution: {
      captureHits: false, criticalSampling: "seeded-random-v1", checkpointFrames: [0, 360] } });
    expect(result.favoniusLog!.map(row => [row.frame, row.outcome, row.drawIndex])).toEqual([
      [0, "noncritical", null], [1, "triggered", 0], [2, "cooldown-blocked", null], [361, "triggered", 1],
    ]);
    expect(result.favoniusLog!.filter(row => row.outcome === "triggered").map(row => row.particleEventId)).toEqual([0, 1]);
    expect(result.particleEvents.map(row => [row.spawnFrame, row.receiveFrame, row.particleCount, row.particleElement])).toEqual([
      [1, 11, 3, "neutral"], [361, 371, 3, "neutral"],
    ]);
    expect(result.energyLog.map(row => [row.frame, row.receiverId, row.gainedEnergy])).toEqual([[11, "a", 6], [11, "b", 4.8], [371, "a", 6], [371, "b", 4.8]]);
    expect(result.skippedActions.map(row => [row.frame, row.energyBefore, row.energyCost])).toEqual([[5, 0, 6]]);
    expect(result.actionLog.find(row => row.sourceAbilityId === "q")!.frame).toBe(12);
    expect(result.energyStats.a).toMatchObject({ particleGained: 12, spent: 6, final: 6 });
    expect(result.energyStats.b).toMatchObject({ particleGained: 9.6, spent: 0, final: 9.6 });
    expect(result.resolvedRuntimeOptions.execution!.captureHits).toBe(true);
    expect(result.executionAudit!.checkpointCoverage.complete).toBe(false);
    expect(result.executionAudit!.checkpointCoverage.reasons.join(" ")).toContain("不足一个完整输入周期");
    expect(result.executionAudit!.phaseCheckpoints.find(point => point.tick === 0)!.state.icdAndTriggerHistory).toMatchObject({
      randomExecution: { version: "named-rng-state-v1", streams: { critical: { drawCount: 0 }, favonius: { drawCount: 0 } } },
    });
    expect(evaluateSimulationSteadyState(result).status).toBe("not-established");
    for (const hit of result.executionAudit!.hits) {
      expect(hit.inputKind).toBe("ordinary");
      if (hit.inputKind === "ordinary") expect(calculateDamageTrace(hit.input).finalDamage).toBe(result.damageEvents[hit.eventId]!.finalDamage);
    }
    expect(simulationResultSchema.safeParse(JSON.parse(JSON.stringify(result))).success).toBe(true);
    const altered = structuredClone(result);
    altered.favoniusLog![1]!.roll = 0;
    expect(simulationResultSchema.safeParse(altered).success).toBe(false);
  });

  it("does not turn analytic expectation or noncritical hits into proc energy and keeps no-effect input unchanged", () => {
    const config = fixture();
    expect(() => simulate(config)).toThrow("实际二元暴击");
    const result = simulate(config, { critMode: "noCrit", energyMode: "zero" });
    expect(result.favoniusLog!.every(row => row.outcome === "noncritical" && row.drawIndex === null)).toBe(true);
    expect(result.particleEvents).toEqual([]);
    expect(result.energyStats.a!.particleGained).toBe(0);
    expect(result.skippedActions).toHaveLength(2);
    const withoutEffect = structuredClone(config);
    delete withoutEffect.favoniusModel;
    expect(simulate(withoutEffect).favoniusLog).toBeUndefined();
  });
});
