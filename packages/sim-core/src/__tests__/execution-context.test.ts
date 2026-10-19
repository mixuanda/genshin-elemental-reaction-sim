import { describe, expect, it } from "vitest";
import { createVersionedContentHash, simulationResultSchema } from "@genshin-dps-lab/schemas";
import { simulate } from "../simulator";
import { captureSimulationHit, replaySimulationHit } from "../calculator-bridge";
import { defineDamageModifierPlugin } from "../plugins";
import { makeConfig, neutralStats } from "./fixtures";

const scenario = () => makeConfig({
  characters: [{ ...makeConfig().characters[0]!, stats: { ...neutralStats, critRate: 0.5, critDmg: 1 } }],
  rotation: [{ id: "multi", actorId: "a", name: "Multi", at: 0,
    hits: Array.from({ length: 8 }, (_, index) => ({ id: `hit-${index}`, offset: index / 60, scaling: 1, element: "pyro" as const })) }]
});

describe("resolved hit capture and critical sampling", () => {
  it("keeps legacy outputs unchanged unless execution audit is requested", () => {
    const plain = simulate(scenario());
    const captured = simulate(scenario(), { execution: { captureHits: true } });
    expect(plain.executionAudit).toBeUndefined();
    expect(captured.damageEvents).toEqual(plain.damageEvents);
    expect(captured.totalDamage).toBe(plain.totalDamage);
    expect(captured.reproducibilityKey).not.toBe(plain.reproducibilityKey);
    expect(captured.executionAudit?.hits).toHaveLength(8);
    expect(captured.executionAudit?.hits.every((hit) => hit.trace === undefined)).toBe(true);
  });

  it("uses a separate reproducible critical stream and captures every actual decision", () => {
    const options = { randomSeed: "critical-fixture", execution: { captureHits: true, criticalSampling: "seeded-random-v1" as const } };
    const first = simulate(scenario(), options);
    const second = simulate(scenario(), options);
    expect(second).toEqual(first);
    expect(first.executionAudit?.criticalSampling?.drawCount).toBe(8);
    expect(new Set(first.executionAudit?.hits.map((hit) => hit.critical.outcome)).size).toBe(2);
    for (const captured of first.executionAudit!.hits) {
      expect(captured.critical.drawIndex).toBe(captured.eventId);
      expect(captured.critical.outcome).toBe(captured.critical.roll! < 0.5 ? "critical" : "noncritical");
      const replay = replaySimulationHit(captureSimulationHit(first, captured.eventId));
      expect(replay.reproducedDamage).toBe(first.damageEvents[captured.eventId]!.finalDamage);
      expect(replay.trace.find((node) => node.id === "criticalSample")).toBeDefined();
    }
    expect(simulate(scenario(), { ...options, randomSeed: "different" }).executionAudit?.hits.map((hit) => hit.critical.roll))
      .not.toEqual(first.executionAudit?.hits.map((hit) => hit.critical.roll));
  });

  it("does not draw or crit an ineligible direct hit", () => {
    const config = scenario();
    config.rotation[0]!.hits![0]!.critEligible = false;
    const result = simulate(config, { execution: { criticalSampling: "seeded-random-v1" } });
    expect(result.executionAudit?.hits[0]?.critical).toMatchObject({ eligible: false, outcome: "ineligible", drawIndex: null, roll: null });
    expect(result.damageEvents[0]?.damageFactors.critMultiplier).toBe(1);
    expect(result.executionAudit?.criticalSampling?.drawCount).toBe(7);
    expect(result.executionAudit?.hits[1]?.critical.drawIndex).toBe(0);
    expect(simulate(config, { critMode: "allCrit" }).damageEvents[0]?.damageFactors.critMultiplier).toBe(1);
  });

  it("captures actual complete pre-event checkpoints without resetting ongoing energy", () => {
    const config = makeConfig({
      duration: 6, cycleLength: 1,
      rotation: [{ id: "repeat", actorId: "a", name: "Repeated", at: 0,
        energyGains: [{ amount: 5, offset: 0.2 }], hits: [{ offset: 0.1, scaling: 1 }] }]
    });
    const result = simulate(config, { execution: { captureHits: false, checkpointFrames: [0, 60, 120, 180, 240] } });
    expect(result.executionAudit?.checkpointCoverage.complete).toBe(true);
    expect(result.executionAudit?.phaseCheckpoints.map((point) => point.cumulativeDamage)).toEqual([0, 1, 2, 3, 4].map((count) => count * result.damageEvents[0]!.finalDamage));
    expect(result.executionAudit?.phaseCheckpoints.map((point) => (point.state.energy as { current: number }[])[0]!.current)).toEqual([0, 5, 10, 15, 20]);
    expect(result.executionAudit?.phaseCheckpoints[1]?.state.pendingEvents).toEqual(result.executionAudit?.phaseCheckpoints[2]?.state.pendingEvents);
  });

  it("does not certify stochastic or unexported aura state as deterministic checkpoints", () => {
    const result = simulate(scenario(), { execution: { criticalSampling: "seeded-random-v1", checkpointFrames: [0] } });
    expect(result.executionAudit?.checkpointCoverage.complete).toBe(false);
    expect(result.executionAudit?.phaseCheckpoints).toEqual([]);
    expect(result.executionAudit?.checkpointCoverage.reasons.join(" ")).toContain("随机暴击");
  });

  it("restores exact post-plugin levels, panel and critical-mode overrides", () => {
    const plugin = defineDamageModifierPlugin({ id: "resolved-context", version: "1", kind: "code", contentHash: createVersionedContentHash("resolved-context") }, () => ({
      modifyDamage: () => ({ scalingValue: 4321, characterLevel: 80, enemyLevel: 95, critMode: "allCrit" as const, flatDamage: 234 })
    }));
    const result = simulate(scenario(), { plugins: [plugin], execution: { captureHits: true, detailedTraces: true, criticalSampling: "seeded-random-v1" } });
    expect(result.executionAudit?.criticalSampling?.drawCount).toBe(0);
    expect(result.executionAudit?.hits[0]?.input).toMatchObject({ scalingValue: 4321, characterLevel: 80, enemyLevel: 95, critMode: "allCrit", flatDamage: 234 });
    expect(result.executionAudit?.hits[0]?.trace?.length).toBeGreaterThan(5);
    const replay = replaySimulationHit(captureSimulationHit(result, 0));
    expect(replay.reproducedDamage).toBe(result.damageEvents[0]!.finalDamage);
    expect(replay.formulaInput).toMatchObject({ scalingValue: 4321, characterLevel: 80, enemyLevel: 95, critMode: "allCrit" });
  });

  it("rejects a modified sampled roll and an altered captured input on import", () => {
    const result = simulate(scenario(), { execution: { captureHits: true, criticalSampling: "seeded-random-v1" } });
    const editedRoll = structuredClone(result);
    editedRoll.executionAudit!.hits[0]!.critical.roll = 0.999;
    expect(() => simulationResultSchema.parse(editedRoll)).toThrow();
    const editedInput = structuredClone(result);
    const input = editedInput.executionAudit!.hits[0]!;
    if (input.inputKind === "ordinary") input.input.scalingValue += 10;
    expect(() => simulationResultSchema.parse(editedInput)).toThrow();
  });
});
