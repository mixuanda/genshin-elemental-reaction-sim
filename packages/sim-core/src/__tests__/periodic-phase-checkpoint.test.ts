import { describe, expect, it } from "vitest";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import { makeConfig } from "./fixtures";
import { simulate } from "../simulator";
import { simulateWithStartup, repeatLegalTimelineForDuration } from "../simulation-analysis";
import { abilityPendingHorizonTicks } from "../action-pending-horizon";
import { phaseCheckpointBlockers } from "../phase-checkpoint";

const refs = ["https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/kuki/skill.go"];
function fixture(): SimConfig {
  const config = makeConfig({ duration: 2, cycleLength: 2, rotation: [], enemy: { level: 90, resistance: 0, defReduction: 0, targets: [{ id: "enemy-0", name: "合成静止目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] }, timeline: {
    mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
    abilities: [{ id: "ring", actorId: "a", name: "合成确定性周期实体", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
      actionPhase: "after-frame-tasks-v1",
      conditionalHitGroups: [{ id: "condition", kind: "owner-hp-at-action-v1", comparison: "lte", thresholdRatio: 1, hitIds: ["branch"], sourceRefs: refs }],
      hits: [{ id: "branch", frame: 20, scaling: 0.1, element: "physical", snapshot: "action" },
        { id: "tick-hit", frame: 0, scaling: 1, element: "physical", snapshot: "hit", flatSources: [{ stat: "em", multiplier: 1 }] }],
      periodicEntities: [{ kind: "periodic-active-heal-v1", id: "ring", label: "明确合成数据", spawnFrame: 0, durationFrames: 400,
        firstTickDelayFrames: 60, intervalFrames: 180, hitDelayFrames: 230, hitIds: ["tick-hit"],
        healing: { ownerHpCoefficient: 0, flat: 1, ownerEmCoefficient: 0, healingBonus: 0, incomingHealingBonus: 0 }, sourceRefs: refs }],
    }], commands: [{ type: "skill", actorId: "a", abilityId: "ring", atFrame: 0 }],
  } });
  config.characters[0]!.stats.em = 200;
  config.playerDamageModel = { mode: "reaction-self-v1", position: { x: 0, y: 0 }, hitboxRadius: 0.5,
    shieldMode: "crystallize-v1", zeroHpPolicy: "clamp-and-continue", characters: [{ actorId: "a", initialHpRatio: 1,
      resistances: { pyro: 0, hydro: 0, electro: 0, cryo: 0, dendro: 0, anemo: 0, geo: 0, physical: 0 } }] };
  return config;
}
type StateRecord = Record<string, any>;
const points = (result: ReturnType<typeof simulate>) => result.executionAudit!.phaseCheckpoints;

describe("actual deterministic periodic and locked-action checkpoints", () => {
  it("establishes a real repeated run while retaining replaced ticks, delayed snapshots and action phase", () => {
    const config = fixture();
    const actual = simulateWithStartup(config, { mode: "steady-state", maximumWarmupCycles: 9, maximumPeriodCycles: 1 });
    expect(actual.status, actual.reasons.join("; ")).toBe("steady-state-established");
    expect(actual.startup.simulationTicks).toBe(1080 + 650);
    expect(actual.startup.measurementEndTick).toBe(1200);
    expect(actual.steadyState!.periodCycles).toBe(1);
    expect(actual.result!.executionAudit!.checkpointCoverage).toMatchObject({ complete: true, reasons: [] });
    const checkpoints = points(actual.result!);
    expect(checkpoints.every(point => JSON.stringify(point.state) === JSON.stringify(checkpoints[0]!.state))).toBe(true);
    const state = checkpoints[0]!.state as StateRecord;
    expect(state.entities.periodicEntities.map((entity: StateRecord) => [entity.relativeGeneration, entity.live, entity.spawnAgeTicks])).toEqual([[-1, false, 240], [0, true, 120]]);
    expect(state.pendingEvents.inFlight.map((event: StateRecord) => [event.type, event.remainingTicks])).toEqual([
      ["periodicEntityTick", 0], ["hit", 50], ["periodicEntityTick", 120], ["hit", 170],
    ]);
    expect(state.pendingEvents.inFlight[0].payload).toEqual({ instance: 0, tickIndex: 1, willExecute: false });
    expect(state.pendingEvents.inFlight[2].payload).toEqual({ instance: 1, tickIndex: 1, willExecute: true });
    expect(state.pendingEvents.inFlight[1].payload.periodicFlatSnapshots.a.em).toBe(200);
    expect(state.pendingEvents.inFlight[1].payload.periodicEntityContext).toEqual({ instance: 0, tickIndex: 0, snapshotAgeTicks: 180 });
    expect(state.pendingEvents.futureInputCycle[0].priority).toBe(8);
    expect(state.activeCharacterAndActionPhase.lockedConditions.map((row: StateRecord) => [row.selected, row.inputPriority, row.ownerCurrentHp])).toEqual([[true, 8, 10000], [true, 8, 10000]]);
    expect(actual.result!.periodicEntityLog!.some(row => row.operation === "cancelled-tick")).toBe(true);
    expect(actual.measurement!.includedDamageEventIds).toHaveLength(2);
  });

  it("keeps equal-HP states distinct when generation links, queued sampling or accepted branches differ", () => {
    const expanded = repeatLegalTimelineForDuration(fixture(), 20);
    const actual = simulate(expanded, { execution: { checkpointFrames: [120, 240] } });
    const [early, later] = points(actual).map(point => point.state as StateRecord);
    expect(early!.resourcesAndHp.hp).toEqual(later!.resourcesAndHp.hp);
    expect(early!.entities.periodicEntities.map((row: StateRecord) => row.relativeGeneration)).toEqual([0]);
    expect(later!.entities.periodicEntities.map((row: StateRecord) => row.relativeGeneration)).toEqual([-1, 0]);
    expect(early).not.toEqual(later);

    const sampled = repeatLegalTimelineForDuration(fixture(), 20);
    const source = sampled.timeline!.abilities[0]!;
    source.periodicEntities![0]!.firstTickDelayFrames = 0;
    sampled.timeline!.abilities.push({ id: "prepare", actorId: "a", name: "首帧瞬时精通", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
      buffs: [{ target: "self", stat: "em", value: 200, startFrame: 0, durationFrames: 5 }] });
    sampled.timeline!.commands.unshift({ type: "skill", actorId: "a", abilityId: "prepare", atFrame: 0 });
    const sampledResult = simulate(sampled, { execution: { checkpointFrames: [10, 130] } });
    const [first, second] = points(sampledResult).map(point => point.state as StateRecord);
    expect(first!.resourcesAndHp.hp).toEqual(second!.resourcesAndHp.hp);
    expect(first!.buffsAndDebuffs.buffs).toEqual([]);
    expect(second!.buffsAndDebuffs.buffs).toEqual([]);
    const sampleValues = (state: StateRecord) => state.pendingEvents.inFlight.filter((entry: StateRecord) => entry.type === "hit" && entry.payload.periodicFlatSnapshots).map((entry: StateRecord) => entry.payload.periodicFlatSnapshots.a.em);
    expect(sampleValues(first!)).toEqual([400]);
    expect(sampleValues(second!)).toEqual([400, 200]);

    const branch = fixture();
    branch.duration = 10;
    branch.timeline!.abilities[0]!.periodicEntities = [];
    branch.timeline!.abilities[0]!.hits = [{ id: "branch", frame: 100, scaling: 1, element: "physical", snapshot: "action" }];
    branch.timeline!.abilities[0]!.conditionalHitGroups![0]!.thresholdRatio = 0.5;
    branch.timeline!.abilities[0]!.healthChanges = [{ id: "restore", label: "分支后恢复满血", frameOffset: 1, target: { kind: "self" }, source: { kind: "custom", note: "合成明确治疗" },
      operation: "heal", amount: { basis: "fixed", value: 10000 }, healingBonus: 0, incomingHealingBonus: 0 }];
    branch.timeline!.abilities[0]!.animationEndFrame = 110;
    const low = structuredClone(branch);
    if (low.playerDamageModel.mode === "reaction-self-v1") low.playerDamageModel.characters[0]!.initialHpRatio = 0.4;
    if (branch.playerDamageModel.mode === "reaction-self-v1") branch.playerDamageModel.characters[0]!.initialHpRatio = 0.6;
    const locked = [low, branch].map(config => points(simulate(config, { execution: { checkpointFrames: [10] } }))[0]!.state as StateRecord);
    expect(locked[0]!.resourcesAndHp.hp).toEqual(locked[1]!.resourcesAndHp.hp);
    expect(locked.map(state => state.activeCharacterAndActionPhase.lockedConditions[0].selected)).toEqual([true, false]);
    expect(locked[0]).not.toEqual(locked[1]);
  });

  it("covers late final ticks and hit delivery in the real tail while retaining independent aura and RNG blockers", () => {
    const config = fixture();
    const entity = config.timeline!.abilities[0]!.periodicEntities![0]!;
    entity.durationFrames = 901;
    entity.firstTickDelayFrames = 1000;
    entity.hitDelayFrames = 230;
    expect(abilityPendingHorizonTicks(config.timeline!.abilities[0]!)).toBe(1230);
    const actual = simulateWithStartup(config, { mode: "steady-state", maximumWarmupCycles: 12, maximumPeriodCycles: 1 });
    expect(actual.startup.simulationTicks).toBe(1440 + 1230);
    expect(actual.result).not.toBeNull();
    expect(actual.result!.executionAudit!.checkpointCoverage.reasons.join()).not.toContain("裁掉");
    const shortened = repeatLegalTimelineForDuration(config, 10);
    const cut = simulate(shortened, { execution: { checkpointFrames: [120] } });
    expect(cut.executionAudit!.checkpointCoverage.complete).toBe(false);
    expect(cut.executionAudit!.checkpointCoverage.reasons.join()).toContain("裁掉");
    const capabilities = { periodicEntityStateAvailable: true, actionConditionStateAvailable: true, healthActionStateAvailable: true };
    expect(phaseCheckpointBlockers(config).join()).toContain("周期实体");
    config.reactionEngine = { mode: "aura-v1", initialAura: [], icdProfiles: {} };
    expect(phaseCheckpointBlockers(config, capabilities).join()).toContain("附着引擎");
    delete config.reactionEngine;
    config.normalHitEnergyModel = { mode: "fixed-source-independent-stream-v1", actors: [{ actorId: "a", weaponType: "sword" }] };
    expect(phaseCheckpointBlockers(config, capabilities).join()).toContain("随机");
  });
});
