import { describe, expect, it } from "vitest";
import type { HealthChangeDefinition, SimConfig } from "@genshin-dps-lab/schemas";
import { simulate } from "../simulator";
import { simulateWithStartup } from "../simulation-analysis";
import { makeConfig } from "./fixtures";

const source = { kind: "custom" as const, note: "明确延迟的合成生命周期；不声称角色技能完整机制" };
const consume = (frameOffset: number): HealthChangeDefinition => ({ id: "consume", label: "固定消耗", frameOffset,
  target: { kind: "self" }, source, operation: "consume", amount: { basis: "fixed", value: 1000 }, minimumHpRatio: 0.2 });
const heal = (frameOffset: number): HealthChangeDefinition => ({ id: "heal", label: "固定治疗", frameOffset,
  target: { kind: "self" }, source, operation: "heal", amount: { basis: "fixed", value: 1000 }, healingBonus: 0, incomingHealingBonus: 0 });
function fixture(changes = [consume(390), heal(391)]): SimConfig {
  return makeConfig({ duration: 2, cycleLength: 2, rotation: [],
    enemy: { level: 110, resistance: 0.1, defReduction: 0, targets: [{ id: "enemy-0", name: "静止目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    playerDamageModel: { mode: "reaction-self-v1", position: { x: 0, y: 0 }, hitboxRadius: 0.5,
      shieldMode: "crystallize-v1", zeroHpPolicy: "clamp-and-continue", characters: [{ actorId: "a", initialHpRatio: 0.5,
        resistances: { pyro: 0, hydro: 0, electro: 0, cryo: 0, dendro: 0, anemo: 0, geo: 0, physical: 0 } }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "health", actorId: "a", name: "跨周期生命动作", kind: "skill", cancelFrame: 1,
        animationEndFrame: 1, cooldownFrames: 0, healthChanges: changes,
        hits: [{ id: "hit", frame: 0, scaling: 1, element: "physical" }] }],
      commands: [{ type: "skill", actorId: "a", abilityId: "health", atFrame: 1 }] } });
}
function repeatedRotation(changes: HealthChangeDefinition[], duration = 16): SimConfig {
  const config = fixture(changes);
  delete config.timeline;
  config.duration = duration;
  config.rotation = [{ id: "health", actorId: "a", name: "重复生命动作", at: 1 / 60, healthChanges: changes,
    hits: [{ id: "hit", offset: 0, scaling: 1, element: "physical" }] }];
  return config;
}
type Pending = { inFlight: Array<{ type: string; remainingTicks: number; priority: number;
  payload: { sourceActorId: string; sourceActionId: string; actionAgeTicks: number; change: HealthChangeDefinition } }> };
const healthQueue = (state: { pendingEvents: unknown }) => (state.pendingEvents as Pending).inFlight.filter(event => event.type === "healthChange");

describe("complete deterministic health phase checkpoints", () => {
  it("establishes a real periodic run with every cross-cycle health task and extends the actual tail", () => {
    const actual = simulateWithStartup(fixture(), { mode: "steady-state", maximumWarmupCycles: 9, maximumPeriodCycles: 1, warmupEnergyMode: "configured" });
    expect(actual.status, actual.reasons.join("; ")).toBe("steady-state-established");
    expect(actual.steadyState!.periodCycles).toBe(1);
    expect(actual.result!.executionAudit!.checkpointCoverage).toMatchObject({ complete: true, reasons: [] });
    expect(actual.startup).toMatchObject({ warmupTicks: 1080, measurementStartTick: 1080, measurementEndTick: 1200, simulationTicks: 1471 });
    expect(actual.measurement!.totalDamage).toBeCloseTo(427.5, 12);
    expect(actual.steadyState!.steadyStateDps).toBeCloseTo(213.75, 12);
    const points = actual.result!.executionAudit!.phaseCheckpoints;
    expect(points.every(point => JSON.stringify(point.state) === JSON.stringify(points[0]!.state))).toBe(true);
    expect(points[0]!.state.resourcesAndHp).toMatchObject({ hp: [{ actorId: "a", maxHp: 10000, currentHp: 5000 }] });
    const pending = healthQueue(points.at(-1)!.state);
    expect(pending.map(event => [event.remainingTicks, event.payload.actionAgeTicks, event.payload.change.operation])).toEqual([
      [31, 359, "consume"], [32, 359, "heal"], [151, 239, "consume"], [152, 239, "heal"], [271, 119, "consume"], [272, 119, "heal"],
    ]);
    expect(pending.every(event => event.priority === 2 && event.payload.sourceActionId === "health" && event.payload.sourceActorId === "a")).toBe(true);
    expect(pending[0]!.payload.change).toEqual(consume(390));
    expect(actual.result!.playerHealthEvents!.some(event => event.frame > actual.startup.measurementEndTick)).toBe(true);
    // Old-style repeating rotation uses the same complete tail and queue producer.
    const rotation = repeatedRotation([consume(390), heal(391)], 2);
    const rotationActual = simulateWithStartup(rotation, { mode: "steady-state", maximumWarmupCycles: 9, maximumPeriodCycles: 1, warmupEnergyMode: "configured" });
    expect(rotationActual.status, rotationActual.reasons.join("; ")).toBe("steady-state-established");
    expect(rotationActual.startup.simulationTicks).toBe(1471);
    expect(healthQueue(rotationActual.result!.executionAudit!.phaseCheckpoints.at(-1)!.state)).toEqual(pending);
  });

  it("retains real same-frame FIFO semantics and captures a due health event before it changes HP", () => {
    const first = repeatedRotation([consume(390), heal(390)]);
    const second = repeatedRotation([heal(390), consume(390)]);
    for (const config of [first, second]) if (config.playerDamageModel.mode === "reaction-self-v1") config.playerDamageModel.characters[0]!.initialHpRatio = 1;
    const ordered = simulate(first, { execution: { checkpointFrames: [120, 391, 480] } });
    const reversed = simulate(second, { execution: { checkpointFrames: [120, 391, 480] } });
    const left = ordered.executionAudit!.phaseCheckpoints, right = reversed.executionAudit!.phaseCheckpoints;
    expect(left).toHaveLength(3);
    expect(right).toHaveLength(3);
    expect(left[0]!.state.resourcesAndHp).toEqual(right[0]!.state.resourcesAndHp);
    expect(left[0]!.state.pendingEvents).not.toEqual(right[0]!.state.pendingEvents);
    expect(healthQueue(left[0]!.state).map(event => event.payload.change.operation)).toEqual(["consume", "heal"]);
    expect(healthQueue(right[0]!.state).map(event => event.payload.change.operation)).toEqual(["heal", "consume"]);
    expect(healthQueue(left[1]!.state).slice(0, 2).map(event => event.remainingTicks)).toEqual([0, 0]);
    expect(left[1]!.state.resourcesAndHp).toMatchObject({ hp: [{ currentHp: 10000 }] });
    expect(ordered.playerHealthEvents!.filter(event => event.frame === 391).map(event => [event.operation, event.hpAfter])).toEqual([["consume", 9000], ["heal", 10000]]);
    expect(reversed.playerHealthEvents!.filter(event => event.frame === 391).map(event => [event.operation, event.hpAfter])).toEqual([["heal", 10000], ["consume", 9000]]);
    expect(left[2]!.state.resourcesAndHp).toMatchObject({ hp: [{ currentHp: 10000 }] });
    expect(right[2]!.state.resourcesAndHp).toMatchObject({ hp: [{ currentHp: 9000 }] });
  });

  it("refuses truncated tails and unsupported Aura state while preserving the no-health checkpoint shape", () => {
    const short = simulate(repeatedRotation([consume(390), heal(391)], 12), { execution: { checkpointFrames: [600] } });
    expect(short.executionAudit!.phaseCheckpoints).toEqual([]);
    expect(short.executionAudit!.checkpointCoverage.reasons.join("; ")).toContain("延迟任务");
    const auraConfig = fixture();
    auraConfig.duration = 16;
    auraConfig.reactionEngine = { mode: "aura-v5" };
    const aura = simulate(auraConfig, { execution: { checkpointFrames: [120] } });
    expect(aura.executionAudit!.checkpointCoverage.complete).toBe(false);
    expect(aura.executionAudit!.checkpointCoverage.reasons.join("; ")).toContain("附着引擎");
    const plain = repeatedRotation([]);
    delete plain.rotation[0]!.healthChanges;
    const baseline = simulate(plain, { execution: { checkpointFrames: [120] } });
    expect(baseline.playerHealthEvents).toBeUndefined();
    expect(baseline.executionAudit!.phaseCheckpoints[0]!.state.resourcesAndHp).toEqual({ playerHpModel: "reaction-self-v1", hp: [{ actorId: "a", maxHp: 10000, currentHp: 5000, zeroHpReached: false }], timelineStates: [] });
    expect(baseline.executionAudit!.phaseCheckpoints[0]!.state.pendingEvents).not.toHaveProperty("health");
  });
});
