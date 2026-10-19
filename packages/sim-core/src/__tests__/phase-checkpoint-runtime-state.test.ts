import { describe, expect, it } from "vitest";
import type { ActionDefinition, StatConversionDefinition } from "@genshin-dps-lab/schemas";
import { capturePhaseCheckpoint, type CapturePhaseCheckpointInput } from "../phase-checkpoint";
import { simulate } from "../simulator";
import { simulateWithStartup } from "../simulation-analysis";
import { makeConfig } from "./fixtures";

// Synthetic mechanics fixture: these values exercise generic runtime state,
// rather than claiming to be a source-validated character rotation.
const conversion: StatConversionDefinition = {
  key: "def-atk", label: "checkpoint fixture", sourceStat: "def", targetStat: "flatAtk",
  coefficient: 0.4, durationFrames: 165, snapshotFrame: 0,
  evidenceStatus: "fixed-source-assumed",
  sourceRefs: ["https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/noelle/burst.go"],
};

describe("phase checkpoints for actual deterministic action state", () => {
  it("keeps due reservations/entities before their events, expires conversions at the frame, and preserves the delayed hit snapshot", () => {
    const config = makeConfig({ duration: 10, cycleLength: 2, rotation: [{
      id: "fixture", actorId: "a", name: "fixture", at: 0, once: true,
      energyCost: 10, energyCostFrame: 59, statConversions: [conversion],
      summons: [{ id: "entity", label: "entity", spawnFrame: 45, lifetimeFrames: 120, expiryAttackDelayFrames: 3, hitIds: ["expiry"] }],
      hits: [{ id: "expiry", offset: 168 / 60, scaling: 1, element: "physical", snapshot: "action" }],
    }] });
    config.characters[0]!.initialEnergy = 60;
    const result = simulate(config, { execution: { checkpointFrames: [59, 60, 164, 165, 166, 168, 169] } });
    expect(result.executionAudit!.checkpointCoverage).toMatchObject({ complete: true, reasons: [] });
    const checkpoint = (tick: number) => result.executionAudit!.phaseCheckpoints.find((item) => item.tick === tick)!;
    expect(checkpoint(59).state.energy).toEqual([{ actorId: "a", current: 60, maximum: 60, reserved: 10 }]);
    expect(checkpoint(59).state.pendingEvents).toMatchObject({ inFlight: [
      { type: "energyCost", remainingTicks: 0, payload: { actorId: "a", actionId: "fixture", actionAgeTicks: 59, energyCost: 10 } },
      { type: "summonExpiry", remainingTicks: 106, payload: { instance: 0 } },
    ] });
    expect(checkpoint(60).state.energy).toMatchObject([{ current: 50, reserved: 0 }]);
    expect(checkpoint(164).state.buffsAndDebuffs).toMatchObject({ statConversions: [{ remainingTicks: 1, sourceValue: 700, appliedValue: 280, snapshot: { baseDef: 700 } }] });
    expect(checkpoint(165).state.buffsAndDebuffs).toMatchObject({ statConversions: [] });
    expect(checkpoint(165).state.entities).toMatchObject({ timedSummons: [{ instance: 0, spawnAgeTicks: 120, expiryRemainingTicks: 0, attackRemainingTicks: 3, snapshots: { a: { flatAtk: 280 } } }] });
    expect(checkpoint(166).state.entities).toMatchObject({ timedSummons: [] });
    expect(checkpoint(168).state.pendingEvents).toMatchObject({ inFlight: [{ type: "hit", remainingTicks: 0, payload: { snapshots: { a: { flatAtk: 280 } } } }] });
    expect(checkpoint(168).cumulativeDamage).toBe(0);
    expect(checkpoint(169).cumulativeDamage).toBe(result.totalDamage);
    expect(result.damageEvents[0]!.damageFactors.scalingValue).toBe(1280);
    expect(result.summonLog!.map((entry) => [entry.operation, entry.frame])).toEqual([["spawn", 45], ["expire", 165]]);
  });

  it("establishes a real legal periodic run with overlapping summons, pending spawns, reservations, and conversion snapshots", () => {
    const config = makeConfig({ duration: 2, cycleLength: 2 });
    config.characters[0]!.initialEnergy = 60;
    config.timeline = {
      mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 12,
      abilities: [{ id: "q", actorId: "a", name: "fixture", kind: "burst", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
        energyCost: 10, energyCostFrame: 150, energyGains: [{ amount: 10, frame: 152 }],
        statConversions: [{ ...conversion, durationFrames: 180 }],
        summons: [{ id: "entity", label: "entity", spawnFrame: 130, lifetimeFrames: 270, expiryAttackDelayFrames: 3, hitIds: ["expiry"] }],
        hits: [{ id: "expiry", frame: 403, scaling: 1, element: "physical", snapshot: "action" }],
      }],
      commands: [{ type: "burst", actorId: "a", abilityId: "q", atFrame: 1 }],
    };
    const actual = simulateWithStartup(config, { mode: "steady-state", maximumWarmupCycles: 9, maximumPeriodCycles: 1, warmupEnergyMode: "configured" });
    expect(actual.status, actual.reasons.join("; ")).toBe("steady-state-established");
    expect(actual.startup.simulationTicks).toBe(1080 + 403);
    expect(actual.startup.measurementEndTick).toBe(1200);
    expect(actual.result!.skippedActions).toEqual([]);
    expect(actual.steadyState!.periodCycles).toBe(1);
    const points = actual.result!.executionAudit!.phaseCheckpoints;
    expect(points.every((point) => JSON.stringify(point.state) === JSON.stringify(points[0]!.state))).toBe(true);
    const state = points[0]!.state;
    expect(state.energy).toMatchObject([{ actorId: "a", current: 60, reserved: 10 }]);
    expect(state.entities).toMatchObject({ timedSummons: [
      { instance: 0, expiryRemainingTicks: 41, snapshots: { a: { flatAtk: 280 } } },
      { instance: 1, expiryRemainingTicks: 161, snapshots: { a: { flatAtk: 280 } } },
    ] });
    expect(state.pendingEvents).toMatchObject({ inFlight: [
      { type: "summonSpawn", remainingTicks: 11 },
      { type: "energyCost", remainingTicks: 31 },
      { type: "energy", remainingTicks: 33 },
      { type: "summonExpiry", remainingTicks: 41, payload: { instance: 0 } },
      { type: "summonExpiry", remainingTicks: 161, payload: { instance: 1 } },
    ] });
    expect(state.buffsAndDebuffs).toMatchObject({ statConversions: [{ remainingTicks: 61, appliedValue: 280, snapshot: { flatAtk: 280 } }] });
    expect(actual.measurement!.includedDamageEventIds).toHaveLength(1);
    expect(actual.steadyState!.steadyStateDps).toBeCloseTo(actual.measurement!.dps, 10);

    // Exporting the deterministic facets never certifies this separate RNG model.
    config.normalHitEnergyModel = { mode: "fixed-source-independent-stream-v1", actors: [{ actorId: "a", weaponType: "claymore" }] };
    const stochastic = simulateWithStartup(config, { mode: "steady-state", maximumWarmupCycles: 6, warmupEnergyMode: "configured" });
    expect(stochastic.status).toBe("steady-state-not-established");
    expect(stochastic.steadyState!.steadyStateDps).toBeNull();
    expect(stochastic.reasons.join()).toContain("随机");
  });

  it("requires real exported state and its complete queued work instead of deleting capability blockers", () => {
    const action: ActionDefinition = { id: "q", actorId: "a", name: "fixture", at: 0, once: true, energyCost: 10, energyCostFrame: 150 };
    const config = makeConfig({ duration: 10, cycleLength: 2, rotation: [action] });
    const input: CapturePhaseCheckpointInput = {
      tick: 120, cumulativeDamage: 0, config, energies: new Map([["a", 60]]),
      fixedEnergyCooldownReadyFrames: new Map(), particleCooldownReadyFrames: new Map(), activeBuffs: [], activeDebuffs: [],
      activeTargetDebuffs: [], activeCharacterId: "a", pendingEvents: [], particleEvents: [], playerHpStateByActorId: new Map(),
    };
    expect(capturePhaseCheckpoint(input).blockers.join()).toContain("能量预留");
    input.reservedEnergy = new Map([["a", 10]]);
    input.actionLog = [{ actorId: "a", actionId: "q", action: "fixture", cycle: 0, frame: 0, time: 0, energyBefore: 60, energyAfter: 60 }];
    expect(capturePhaseCheckpoint(input).blockers.join()).toContain("预留与完整待扣能队列不一致");
    input.pendingEvents = [{ type: "energyCost", frame: 150, timeSeconds: 2.5, priority: 2, sequence: 5,
      payload: { actorId: "a", actionId: "q", actionLogIndex: 0, energyCost: 10 } }];
    expect(capturePhaseCheckpoint(input).blockers).toEqual([]);
    action.energyCostFrame = 500;
    expect(capturePhaseCheckpoint(input).blockers.join()).toContain("裁掉");
  });
});
