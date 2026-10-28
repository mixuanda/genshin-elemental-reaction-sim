import { describe, expect, it } from "vitest";
import { AuraEngine } from "../aura";
import { DirectDamageGroupEngine } from "../direct-damage-group";
import { normalizeOrdinaryReactionCheckpoint, ordinaryAuraDomainBlockers } from "../ordinary-aura-checkpoint";
import { simulate } from "../simulator";
import { evaluateSimulationSteadyState, simulateWithStartup, repeatLegalTimelineForDuration } from "../simulation-analysis";
import { makeConfig } from "./fixtures";

const noIcd = (gaugeUnits = 1) => ({ gaugeUnits, icd: { mode: "no-icd-v1" as const } });
const legacyIcd = (tag: string) => ({ gaugeUnits: 1, icd: { mode: "legacy-boolean-profile-v1" as const, icdTag: tag, profileId: "cycle" } });
function fixture() {
  return makeConfig({ duration: 2, cycleLength: 2, enemy: { level: 90, resistance: 0, defReduction: 0,
      targets: [{ id: "enemy-0", name: "合成目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    reactionEngine: { mode: "aura-v7", icdProfiles: { cycle: { resetFrames: 60, applicationSequence: [true, false], tailPolicy: "clamp" } } },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [
        { id: "hydro", actorId: "a", name: "合成水附着", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
          hits: [{ id: "hydro", frame: 0, scaling: 1, element: "hydro", application: legacyIcd("hydro") }] },
        { id: "pyro", actorId: "a", name: "合成蒸发", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
          hits: [{ id: "pyro", frame: 0, scaling: 1, element: "pyro", application: legacyIcd("pyro"),
            geometry: { kind: "circle", coordinateSpace: "world", origin: { x: 0, y: 0 }, radius: 1 },
            directDamageGroup: { icdTag: "damage", icdGroup: "pole-extra-attack" } }] },
      ], commands: [{ type: "skill", actorId: "a", abilityId: "hydro", atFrame: 0 }, { type: "skill", actorId: "a", abilityId: "pyro", atFrame: 108 }],
    },
  });
}
type RecordState = Record<string, any>;

describe("actual ordinary Aura and ICD checkpoints", () => {
  it("establishes a continuous aura-v7 Vaporize cycle with live raw gauge, ICD and damage-group windows", () => {
    const actual = simulateWithStartup(fixture(), { mode: "steady-state", maximumWarmupCycles: 8, maximumPeriodCycles: 1 });
    expect(actual.status, actual.reasons.join("; ")).toBe("steady-state-established");
    expect(actual.result!.executionAudit!.checkpointCoverage).toMatchObject({ complete: true, reasons: [] });
    expect(actual.measurement!.totalDamage).toBeCloseTo(1250);
    expect(actual.steadyState!.steadyStateDps).toBeCloseTo(625);
    const checkpoints = actual.result!.executionAudit!.phaseCheckpoints;
    const state = checkpoints[0]!.state as RecordState;
    const aura = state.auras.targets[0];
    expect(aura.mode).toBe("aura-v7");
    expect(aura.materializedAgeTicks).toBe(12);
    expect(aura.auras[0].gaugeUnits).toBeCloseTo(0.8 - 108 * 0.8 / 570 - 0.5);
    expect(aura.auras[0].decayPerFrame).toBeCloseTo(0.8 / 570);
    expect(aura.applicationIcd.legacyWindows).toMatchObject([{ icdTag: "pyro", nextHitIndex: 1, resetRemainingTicks: 48, windowAgeTicks: 12 }]);
    expect(state.icdAndTriggerHistory.directDamageGroups[0].windows).toMatchObject([{ nextHitIndex: 1, resetRemainingTicks: 17, windowAgeTicks: 12 }]);
    expect(actual.result!.damageEvents.filter(hit => hit.element === "pyro").every(hit => hit.reaction === "reverseVaporize")).toBe(true);
    expect(checkpoints.at(-1)!.state).toEqual(checkpoints[0]!.state);
  });

  it("distinguishes identical gauge by real decay and ICD history and leaves raw capture detached", () => {
    const weak = new AuraEngine({ mode: "aura-v9", initialAura: [{ element: "hydro", gaugeUnits: 1 }] });
    const strong = new AuraEngine({ mode: "aura-v9", initialAura: [{ element: "hydro", gaugeUnits: 2 }] });
    strong.processHit({ frame: 0, sourceActorId: "a", element: "pyro", application: noIcd(1.6) });
    const left = weak.captureOrdinaryState();
    const right = strong.captureOrdinaryState();
    expect(left.auras[0]!.gaugeUnits).toBeCloseTo(right.auras[0]!.gaugeUnits);
    expect(left.auras[0]!.decayPerFrame).not.toBe(right.auras[0]!.decayPerFrame);
    const normalized = [weak, strong].map(engine => normalizeOrdinaryReactionCheckpoint({ tick: 1, config: fixture(),
      aura: new Map([["enemy-0", engine.captureOrdinaryState()]]),
      observations: [{ targetId: "enemy-0", frame: 0, aura: engine.getAuraStateAt(0) }],
    }));
    expect(normalized[0]).not.toEqual(normalized[1]);
    const engine = new AuraEngine({ mode: "aura-v9", icdProfiles: { cycle: { resetFrames: 60, applicationSequence: [true, false] } } });
    const hit = { frame: 0, sourceActorId: "a", element: "hydro" as const, application: legacyIcd("same") };
    engine.processHit(hit);
    const one = engine.captureOrdinaryState();
    engine.processHit(hit);
    const two = engine.captureOrdinaryState();
    expect(one.auras).toEqual(two.auras);
    expect(one.applicationIcd.legacyWindows[0]!.nextHitIndex).toBe(1);
    expect(two.applicationIcd.legacyWindows[0]!.nextHitIndex).toBe(2);
    engine.getAuraStateAt(20);
    expect(one.currentFrame).toBe(0);
    expect(one.auras[0]!.gaugeUnits).toBe(0.8);
  });

  it("captures before same-frame reset/hit, rejects unsupported Aura inputs, and separates RNG capture from steady state", () => {
    const config = fixture();
    config.timeline!.commands[1] = { type: "skill", actorId: "a", abilityId: "pyro", atFrame: 29 };
    config.timeline!.abilities[0]!.hits![0]!.directDamageGroup = { icdTag: "shared", icdGroup: "pole-extra-attack" };
    config.timeline!.abilities[1]!.hits![0]!.directDamageGroup = { icdTag: "shared", icdGroup: "pole-extra-attack" };
    const expanded = repeatLegalTimelineForDuration(config, 10);
    const actual = simulate(expanded, { execution: { checkpointFrames: [29, 30] } });
    expect(actual.executionAudit!.checkpointCoverage.complete, actual.executionAudit!.checkpointCoverage.reasons.join("; ")).toBe(true);
    const [before, after] = actual.executionAudit!.phaseCheckpoints.map(point => point.state as RecordState);
    expect(before!.auras.targets[0].materializedAgeTicks).toBe(29);
    expect(before!.auras.targets[0].auras[0].gaugeUnits).toBe(0.8);
    expect(before!.icdAndTriggerHistory.directDamageGroups[0].windows).toEqual([]);
    expect(after!.icdAndTriggerHistory.directDamageGroups[0].windows[0]).toMatchObject({ nextHitIndex: 1, resetRemainingTicks: 28, windowAgeTicks: 1 });
    const rawDamage = new DirectDamageGroupEngine();
    rawDamage.consumeLandedHit({ frame: 0, sourceActorId: "a", icdTag: "shared", icdGroup: "pole-extra-attack" });
    expect(rawDamage.captureState().windows[0]!.resetAtFrame).toBe(29);
    const future = fixture(); future.timeline!.abilities.push({ id: "future", actorId: "a", name: "尚未选择的雷能力", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
      hits: [{ frame: 0, scaling: 1, element: "electro", application: noIcd(), geometry: { kind: "circle", coordinateSpace: "world", origin: { x: 0, y: 0 }, radius: 1 } }] });
    expect(ordinaryAuraDomainBlockers(future).join()).toContain("完整未来元素输入域");
    const initial = fixture(); initial.enemy.targets = [{ id: "enemy-0", name: "雷初始目标", position: { x: 0, y: 0 }, hitboxRadius: 0, initialAura: [{ element: "electro", gaugeUnits: 1 }] }];
    expect(ordinaryAuraDomainBlockers(initial)).not.toEqual([]);
    const infusion = fixture(); infusion.timeline!.abilities[0]!.hits![0]!.infusion = { statusKey: "dormant", element: "geo", application: noIcd() };
    expect(ordinaryAuraDomainBlockers(infusion).join()).toContain("geo");
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
    const stochastic = simulate(expanded, { execution: { checkpointFrames: [29], criticalSampling: "seeded-random-v1" } });
    expect(stochastic.executionAudit!.checkpointCoverage).toEqual({ complete: true, missingDimensions: [], reasons: [] });
    expect(stochastic.executionAudit!.phaseCheckpoints[0]!.state.icdAndTriggerHistory).toMatchObject({
      randomExecution: { version: "named-rng-state-v1", streams: { critical: { drawCount: 1 } } },
    });
    const stochasticSteady = evaluateSimulationSteadyState(stochastic);
    expect(stochasticSteady.status).toBe("not-established");
    expect(stochasticSteady.reasons.join()).toContain("随机状态已捕获不等于分布收敛");
  });
});
