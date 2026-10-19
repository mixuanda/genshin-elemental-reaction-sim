import { simulationResultSchema } from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { captureSimulationHit, replaySimulationHit } from "../calculator-bridge";
import { makeConfig } from "./fixtures";

// Synthetic primitive tests: exact source character coefficients belong to the
// registered action library. These values make queue and snapshot errors visible.
describe("declared delayed energy and fixed-lifetime summons", () => {
  it("keeps actual energy capped until debit, does not reuse a reservation, and clips future debit", () => {
    const base = makeConfig();
    const config = makeConfig({
      duration: 2, cycleLength: 3,
      characters: [{ ...base.characters[0]!, energyMax: 40, initialEnergy: 40 }],
      rotation: [
        { id: "delayed", actorId: "a", name: "Delayed", at: 0, once: true, energyCost: 40, energyCostFrame: 59,
          energyGains: [{ amount: 10, offset: 30 / 60 }, { amount: 10, offset: 59 / 60 }] },
        { id: "cannot-borrow", actorId: "a", name: "Cannot borrow", at: 30 / 60, once: true, energyCost: 1 },
        { id: "later", actorId: "a", name: "Later", at: 1, once: true, energyCost: 5 }
      ]
    });
    const result = simulate(config);
    expect(result.actionLog[0]).toMatchObject({ energyBefore: 40, energyAfter: 40 });
    expect(result.skippedActions[0]).toMatchObject({ actionId: "cannot-borrow", energyBefore: 0 });
    expect(result.energyCostLog).toMatchObject([
      { operation: "reserve", frame: 0, energyBefore: 40, energyAfter: 40, reservedAfter: 40 },
      { operation: "debit", frame: 59, energyBefore: 40, energyAfter: 0, reservedAfter: 0 }
    ]);
    expect(result.energyLog.map(row => [row.frame, row.gainedEnergy, row.wastedEnergy])).toEqual([[30, 0, 10], [59, 10, 0]]);
    expect(result.energyStats.a).toMatchObject({ spent: 45, gained: 10, wasted: 10, final: 5 });
    expect(simulationResultSchema.safeParse(JSON.parse(JSON.stringify(result))).success).toBe(true);
    const tampered = structuredClone(result);
    tampered.energyCostLog![1]!.frame = 58;
    expect(simulationResultSchema.safeParse(tampered).success).toBe(false);
    const clipped = simulate({ ...config, duration: 1, rotation: [{ ...config.rotation[0]!, at: 1 }] });
    expect(clipped.energyCostLog).toHaveLength(1);
    expect(clipped.energyStats.a).toMatchObject({ spent: 0, final: 40 });
  });

  it("spawns and snapshots before expiry, emits only the expiry attack, and confirms particles once", () => {
    const config = makeConfig({ duration: 11, cycleLength: 12, rotation: [
      { id: "entity", actorId: "a", name: "Declared entity", at: 0, once: true,
        summons: [{ id: "timed", label: "Timed entity", spawnFrame: 45, lifetimeFrames: 484, expiryAttackDelayFrames: 1, hitIds: ["explode"] }],
        hits: [{ id: "explode", label: "Expiry", offset: 530 / 60, scaling: 1, element: "pyro", snapshot: "action" }],
        buffs: [{ stat: "atkPct", value: 1, duration: 30 / 60, offset: 30 / 60 }],
        particles: [{ id: "first-confirm", element: "pyro", count: 4, travelTime: 100 / 60, trigger: { kind: "hit-confirm", hitIds: ["explode"] } }]
      }
    ] });
    const result = simulate(config, { execution: { captureHits: true, detailedTraces: true } });
    expect(result.summonLog?.map(row => [row.operation, row.frame, row.snapshotFrame, row.attackFrame, row.snapshot.atkPct])).toEqual([
      ["spawn", 45, 45, 530, 1], ["expire", 529, 45, 530, 1]
    ]);
    expect(result.damageEvents).toHaveLength(1);
    expect(result.damageEvents[0]).toMatchObject({ frame: 530, scalingValue: 2000 });
    expect(result.particleEvents).toHaveLength(1);
    expect(result.particleEvents[0]).toMatchObject({ spawnFrame: 530, receiveFrame: 630, particleCount: 4 });
    expect(result.energyStats.a).toMatchObject({ gained: 12, final: 12 });
    expect(replaySimulationHit(captureSimulationHit(result, 0)).difference).toBe(0);
    const truncated = simulate({ ...config, duration: 8 });
    expect(truncated.summonLog?.map(row => row.operation)).toEqual(["spawn"]);
    expect(truncated.damageEvents).toHaveLength(0);
    expect(truncated.particleEvents).toHaveLength(0);
    expect(truncated.energyStats.a?.gained).toBe(0);
    const tampered = structuredClone(result);
    tampered.summonLog![1]!.snapshotFrame = 44;
    expect(simulationResultSchema.safeParse(tampered).success).toBe(false);
  });
});
