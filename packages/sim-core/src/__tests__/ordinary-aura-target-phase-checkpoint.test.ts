import { describe, expect, it } from "vitest";
import { AuraEngine } from "../aura";
import { simulate } from "../simulator";
import { evaluateSimulationSteadyState, simulateWithStartup, repeatLegalTimelineForDuration } from "../simulation-analysis";
import { capturePhaseCheckpoint, phaseCheckpointBlockers, type CapturePhaseCheckpointInput, type CheckpointQueueEvent } from "../phase-checkpoint";
import { captureTargetPhaseV2State } from "../target-phase-checkpoint";
import { MinHeap } from "../min-heap";
import { makeConfig } from "./fixtures";

const application = (tag: string) => ({ gaugeUnits: 1, icd: { mode: "legacy-boolean-profile-v1" as const, icdTag: tag, profileId: "cycle" } });
function fixture() {
  return makeConfig({ duration: 2, cycleLength: 2,
    enemy: { level: 90, resistance: 0, defReduction: 0,
      targets: [{ id: "enemy-0", name: "合成目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    reactionEngine: { mode: "aura-v9", icdProfiles: { cycle: { resetFrames: 60, applicationSequence: [true, false], tailPolicy: "clamp" } } },
    targetTaskModel: { mode: "target-phase-v2" },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [
        { id: "hydro", actorId: "a", name: "合成水附着", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
          hits: [{ id: "hydro", frame: 0, scaling: 1, element: "hydro", application: application("hydro") }] },
        { id: "pyro", actorId: "a", name: "合成蒸发", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
          hits: [{ id: "pyro", frame: 0, scaling: 1, element: "pyro", application: application("pyro"),
            geometry: { kind: "circle", coordinateSpace: "world", origin: { x: 0, y: 0 }, radius: 1 },
            directDamageGroup: { icdTag: "damage", icdGroup: "pole-extra-attack" } }] },
      ], commands: [{ type: "skill", actorId: "a", abilityId: "hydro", atFrame: 0 }, { type: "skill", actorId: "a", abilityId: "pyro", atFrame: 108 }],
    },
  });
}
type StateRecord = Record<string, any>;

describe("ordinary aura-v9 with actual target-phase-v2 checkpoints", () => {
  it("establishes the unchanged v9 continuous cycle and measures its actual damage window", () => {
    const actual = simulateWithStartup(fixture(), { mode: "steady-state", maximumWarmupCycles: 8, maximumPeriodCycles: 1 });
    expect(actual.status, actual.reasons.join("; ")).toBe("steady-state-established");
    expect(actual.result!.executionAudit!.checkpointCoverage).toMatchObject({ complete: true, reasons: [] });
    expect(actual.result!.config.reactionEngine!.mode).toBe("aura-v9");
    expect(actual.measurement!.totalDamage).toBeCloseTo(1250);
    expect(actual.steadyState!.steadyStateDps).toBeCloseTo(625);
    expect(actual.steadyState!.periodCycles).toBe(1);
    const points = actual.result!.executionAudit!.phaseCheckpoints;
    const state = points[0]!.state as StateRecord;
    expect(state.auras.targets[0]).toMatchObject({ mode: "aura-v9", reactableTickModel: "cached-boundary-v2", reactableLifecycleBoundaries: [], materializedAgeTicks: 12 });
    expect(state.auras.targets[0].auras[0].gaugeUnits).toBeCloseTo(0.8 - 108 * 0.8 / 570 - 0.5);
    expect(state.pendingEvents.targetPhase.model).toBe("target-phase-v2");
    expect(points.at(-1)!.state).toEqual(points[0]!.state);
    expect(actual.result!.targetPhaseLog.some(row => row.globalFrame === 108 && row.model === "target-phase-v2")).toBe(true);
  });

  it("keeps real pending decay ordering distinct and captures a hit frame before its target Tick", () => {
    const source = fixture();
    source.timeline!.commands[1] = { type: "skill", actorId: "a", abilityId: "pyro", atFrame: 29 };
    const actual = simulate(repeatLegalTimelineForDuration(source, 10), { execution: { checkpointFrames: [29, 30] } });
    expect(actual.executionAudit!.checkpointCoverage.complete, actual.executionAudit!.checkpointCoverage.reasons.join()).toBe(true);
    const [before, after] = actual.executionAudit!.phaseCheckpoints.map(point => point.state as StateRecord);
    expect(before!.auras.targets[0]).toMatchObject({ materializedAgeTicks: 29, auras: [{ gaugeUnits: 0.8 }] });
    expect(after!.auras.targets[0].auras[0].gaugeUnits).toBeCloseTo(0.8 - 29 * 0.8 / 570 - 0.5);

    // A deliberately constructed future phase task uses the actual heap and
    // raw engine capture. It is a state-equality test, not an inferred schedule.
    const config = makeConfig({ duration: 10, cycleLength: 2, reactionEngine: { mode: "aura-v9" }, targetTaskModel: { mode: "target-phase-v2" } });
    const engine = new AuraEngine({ mode: "aura-v9", reactableTickModel: "cached-boundary-v2", initialAura: [{ element: "hydro", gaugeUnits: 1 }] });
    const queue = new MinHeap<CheckpointQueueEvent>((a, b) => a.frame - b.frame || a.priority - b.priority || a.sequence - b.sequence);
    queue.push({ type: "targetDecay", frame: 29, timeSeconds: 29 / 60, priority: 0.625, sequence: 20, payload: { targetId: "enemy-0" } });
    queue.push({ type: "buff", frame: 29, timeSeconds: 29 / 60, priority: 0.625, sequence: 21, payload: { key: "future", stat: "atkPct", value: 0.1 } });
    const rawPhase = captureTargetPhaseV2State({ lastProcessedFrame: 0, scheduledDecayKeys: new Set(["29\u0000enemy-0"]), completedDecayKeys: new Set(), states: [] });
    const input: CapturePhaseCheckpointInput = { tick: 10, cumulativeDamage: 0, config, energies: new Map([["a", 0]]),
      fixedEnergyCooldownReadyFrames: new Map(), particleCooldownReadyFrames: new Map(), activeBuffs: [], activeDebuffs: [], activeTargetDebuffs: [],
      activeCharacterId: "a", particleEvents: [], playerHpStateByActorId: new Map(), pendingEvents: queue.snapshot(), targetPhaseV2State: rawPhase,
      ordinaryAuraState: new Map([["enemy-0", engine.captureOrdinaryState()]]), auraObservationState: [{ targetId: "enemy-0", frame: 0, aura: engine.getAuraStateAt(0) }] };
    const original = capturePhaseCheckpoint(input);
    expect(original.blockers).toEqual([]);
    const swapped = capturePhaseCheckpoint({ ...input, pendingEvents: queue.snapshot().map(event => ({ ...event, sequence: 41 - event.sequence })) });
    expect(swapped.blockers).toEqual([]);
    expect(original.checkpoint!.state.auras).toEqual(swapped.checkpoint!.state.auras);
    expect(original.checkpoint!.state.pendingEvents).not.toEqual(swapped.checkpoint!.state.pendingEvents);
    const dropped = capturePhaseCheckpoint({ ...input, pendingEvents: [] });
    expect(dropped.checkpoint).toBeNull();
    const midFrame = capturePhaseCheckpoint({ ...input, targetPhaseV2State: { ...rawPhase, lastProcessedFrame: 10 } });
    expect(midFrame.checkpoint).toBeNull();
  });

  it.each(["nonPeriodicReactionStateAvailable", "periodicReactionStateAvailable"] as const)(
    "rejects the future reaction domain when target-phase-v2 lacks %s", (missing) => {
      const config = fixture();
      config.timeline!.abilities.push({ id: "future-electro", actorId: "a", name: "未选择雷能力", kind: "skill",
        cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
        hits: [{ frame: 0, scaling: 1, element: "electro", application: application("electro") }] });
      const capabilities = { ordinaryAuraStateAvailable: true, directDamageGroupStateAvailable: true,
        targetPhaseV2StateAvailable: true, nonPeriodicReactionStateAvailable: true, periodicReactionStateAvailable: true };
      expect(phaseCheckpointBlockers(config, capabilities)).toEqual([]);
      const blockers = phaseCheckpointBlockers(config, { ...capabilities, [missing]: false });
      expect(blockers).toHaveLength(1);
      expect(blockers[0]).toContain("完整未来元素输入域");
      expect(blockers[0]).toContain("尚未导出");
    });

  it("keeps unsupported reactions, clock and tails blocked while captured RNG remains outside deterministic steady state", () => {
    const future = fixture();
    future.timeline!.abilities.push({ id: "electro", actorId: "a", name: "未选择雷能力", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
      hits: [{ frame: 0, scaling: 1, element: "electro", application: application("electro"), geometry: { kind: "circle", coordinateSpace: "world", origin: { x: 0, y: 0 }, radius: 1 } }] });
    // The producer now exports the non-periodic/periodic reaction domain.
    // A dormant Electro ability alone no longer means missing private state.
    const supported = simulateWithStartup(future, { mode: "steady-state", maximumWarmupCycles: 8, maximumPeriodCycles: 1 });
    expect(supported.status).toBe("steady-state-established");
    expect(supported.result!.executionAudit!.checkpointCoverage).toEqual({ complete: true, missingDimensions: [], reasons: [] });
    const unproven = structuredClone(future);
    unproven.reactionEngine!.debugAllowReactionOverride = true;
    const blocked = simulateWithStartup(unproven, { mode: "steady-state", maximumWarmupCycles: 8, maximumPeriodCycles: 1 });
    expect(blocked.status).not.toBe("steady-state-established");
    expect(blocked.result!.executionAudit!.checkpointCoverage.reasons.join()).toContain("调试反应覆盖");
    const clocked = fixture(); clocked.targetClockModel = { mode: "target-local-hitlag-v1" };
    expect(phaseCheckpointBlockers(clocked, { ordinaryAuraStateAvailable: true, directDamageGroupStateAvailable: true, targetPhaseV2StateAvailable: true }).join()).toContain("目标时钟");
    const stochastic = simulate(repeatLegalTimelineForDuration(fixture(), 10), { execution: { checkpointFrames: [120], criticalSampling: "seeded-random-v1" } });
    expect(stochastic.executionAudit!.checkpointCoverage).toEqual({ complete: true, missingDimensions: [], reasons: [] });
    expect(stochastic.executionAudit!.phaseCheckpoints[0]!.state.icdAndTriggerHistory).toMatchObject({
      randomExecution: { version: "named-rng-state-v1", streams: { critical: { drawCount: 2 } } },
    });
    const stochasticSteady = evaluateSimulationSteadyState(stochastic);
    expect(stochasticSteady.status).toBe("not-established");
    expect(stochasticSteady.reasons.join()).toContain("随机状态已捕获不等于分布收敛");
    const cut = repeatLegalTimelineForDuration(fixture(), 10);
    cut.timeline!.abilities[1]!.hits![0]!.frame = 600;
    const truncated = simulate(cut, { execution: { checkpointFrames: [120] } });
    expect(truncated.executionAudit!.checkpointCoverage.complete).toBe(false);
    expect(truncated.executionAudit!.checkpointCoverage.reasons.join()).toContain("裁掉");
  });
});
