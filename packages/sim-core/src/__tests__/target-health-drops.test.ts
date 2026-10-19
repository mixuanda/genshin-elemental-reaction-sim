import { expect, it } from "vitest";
import { makeConfig, neutralStats } from "./fixtures";
import { simulate } from "../simulator";
import { captureSimulationHit, parseSimulationHit, serializeSimulationHit, replaySimulationHit } from "../calculator-bridge";
import { applyBenchmarkProfile, BENCHMARK_PROFILES } from "../benchmark-profiles";

it("settles declared HP and one-time drops with actual energy, death exclusion and complete JSON replay", () => {
  const config = makeConfig({ duration: 2, cycleLength: 2,
    characters: [{ id: "a", name: "声明测试角色", element: "pyro", color: "#f00", level: 90, energyMax: 60, initialEnergy: 0, stats: { ...neutralStats, energyRecharge: 2 } }],
    enemy: { level: 90, resistance: 0, defReduction: 0 },
    targetHealthModel: { mode: "declared-target-health-v1", targets: [{ targetId: "enemy-0", maxHp: 750, initialHp: 750, sourceRef: "synthetic:750hp", drops: [
      { id: "half", trigger: { kind: "hp-threshold", hpRatio: .5 }, element: "neutral", kind: "particle", count: 1, travelFrames: 1, sourceRef: "synthetic:threshold" },
      { id: "kill", trigger: { kind: "defeat" }, element: "neutral", kind: "orb", count: 1, travelFrames: 2, sourceRef: "synthetic:defeat" }
    ] }], externalDrops: [{ id: "external", frame: 5, element: "pyro", kind: "particle", count: 1, travelFrames: 0, sourceRef: "synthetic:external" }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "n", actorId: "a", name: "三次明确命中", kind: "normal", cooldownFrames: 0, cancelFrame: 0, animationEndFrame: 0,
        hits: [1, 2, 3].map(frame => ({ id: `h${frame}`, frame, scaling: 1, element: "physical" as const })) }],
      commands: [{ type: "normal", actorId: "a", abilityId: "n", atFrame: 0 }] }
  });
  const result = simulate(config, { execution: { captureHits: true } });
  expect(result.targetHealthSummaries![0]).toMatchObject({ finalHp: 0, totalRawDamage: 1000, totalEffectiveHpDamage: 750, totalOverkill: 250, defeatedFrame: 2 });
  expect(result.particleEvents.map(row => [row.origin!.kind, row.spawnFrame, row.receiveFrame])).toEqual([["enemy-hp-threshold", 1, 2], ["enemy-defeat", 2, 4], ["external", 5, 5]]);
  expect(result.energyStats.a!.final).toBe(22);
  expect(result.hitResolutionLog.some(row => row.frame === 3 && row.outcome === "miss")).toBe(true);
  const hit = result.damageEvents.find(row => row.finalDamage > 0)!;
  expect(replaySimulationHit(parseSimulationHit(serializeSimulationHit(captureSimulationHit(result, hit.id)))).difference).toBe(0);
  expect(() => applyBenchmarkProfile(config, BENCHMARK_PROFILES.find(row => row.id === "legacy-110-zero-120s")!)).toThrow(/掉落|粒子|微粒|外部/);
});
