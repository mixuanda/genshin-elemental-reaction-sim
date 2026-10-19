import { describe, expect, it } from "vitest";
import type { AbilityDefinition, SimConfig } from "@genshin-dps-lab/schemas";
import { makeConfig, neutralStats } from "./fixtures";
import { simulate } from "../simulator";
import { evaluateSimulationSteadyState, simulateWithStartup } from "../simulation-analysis";
import { IndependentWeaponProcRuntime } from "../weapon-proc";
import { capturePhaseCheckpoint, phaseCheckpointBlockers, type CapturePhaseCheckpointInput } from "../phase-checkpoint";
import { abilityPendingHorizonTicks, actionPendingHorizonTicks } from "../action-pending-horizon";

type State = Record<string, any>;
function fixture(): SimConfig {
  const config = makeConfig({ duration: 16, cycleLength: 16,
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [
      { id: "enemy-0", name: "合成中心", position: { x: 0, y: 0 }, hitboxRadius: 0 },
      { id: "edge", name: "合成边缘", position: { x: 3, y: 0 }, hitboxRadius: 0, resistance: 0.5 },
    ] },
    weaponProcModel: { mode: "fixed-source-no-character-hitlag-v1", actors: [
      { actorId: "a", weaponId: "halberd", refinement: 1, physicalDamageBonus: 0 },
      { actorId: "b", weaponId: "ashgravendrinkinghorn", refinement: 1, physicalDamageBonus: 0 },
      { actorId: "c", weaponId: "sequenceofsolitude", refinement: 1, physicalDamageBonus: 0 },
    ] },
  });
  config.meta.verificationStatus = "user-supplied";
  config.characters.push(...["b", "c"].map(id => ({ ...config.characters[0]!, id, name: id, stats: { ...neutralStats } })));
  config.rotation = ["a", "b", "c"].map((actorId, index) => ({ id: `host-${actorId}`, actorId, name: "明确合成宿主", at: (955 + 2 * index) / 60,
    ...(actorId === "c" ? { buffs: [{ key: "trigger-hp", target: "self" as const, stat: "hpPct" as const, value: 1, duration: 1 / 60 }] } : {}),
    hits: [{ id: `hit-${actorId}`, offset: 0, scaling: 0, element: "physical" as const, attackTag: "normal" as const }],
  }));
  return config;
}

describe("actual deterministic independent weapon checkpoints", () => {
  it("establishes all three source weapons with pending cross-boundary procs and the unchanged ordinary Aura scope", () => {
    const config = fixture();
    config.reactionEngine = { mode: "aura-v9", icdProfiles: { cycle: { resetFrames: 60, applicationSequence: [true, false], tailPolicy: "clamp" } } };
    config.targetTaskModel = { mode: "target-phase-v2" };
    for (const [index, element] of ["hydro", "pyro"].entries()) {
      config.rotation[index]!.hits![0]!.element = element as "hydro" | "pyro";
      config.rotation[index]!.hits![0]!.application = { gaugeUnits: 1, icd: { mode: "legacy-boolean-profile-v1", icdTag: element, profileId: "cycle" } };
      config.rotation[index]!.hits![0]!.geometry = { kind: "circle", coordinateSpace: "world", origin: { x: 0, y: 0 }, radius: 1 };
    }
    config.timeline = { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "c", swapFrames: 1,
      abilities: config.rotation.map(action => ({ id: action.id, actorId: action.actorId, name: action.name, kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
        hits: action.hits!.map(({ offset, ...hit }) => ({ ...hit, frame: 0 })),
        ...(action.buffs === undefined ? {} : { buffs: action.buffs.map(({ duration, ...buff }) => ({ ...buff, durationFrames: 1, startFrame: 0 })) }) })),
      commands: [{ type: "swap", characterId: "a", atFrame: 0 }, { type: "skill", actorId: "a", abilityId: "host-a", atFrame: 955 },
        { type: "swap", characterId: "b", atFrame: 956 }, { type: "skill", actorId: "b", abilityId: "host-b", atFrame: 957 },
        { type: "swap", characterId: "c", atFrame: 958 }, { type: "skill", actorId: "c", abilityId: "host-c", atFrame: 959 }] };
    config.rotation = [];
    const actual = simulateWithStartup(config, { mode: "steady-state", maximumWarmupCycles: 8, maximumPeriodCycles: 1 });
    expect(actual.status, actual.reasons.join("; ")).toBe("steady-state-established");
    expect(actual.result!.executionAudit!.checkpointCoverage).toMatchObject({ complete: true, reasons: [] });
    expect(actual.result!.config.reactionEngine!.mode).toBe("aura-v9");
    expect(actual.steadyState!.periodCycles).toBe(1);
    expect(actual.measurement!.totalDamage).toBe(9800);
    expect(actual.steadyState!.steadyStateDps).toBe(612.5);
    expect(actual.startup.simulationTicks).toBe(9600);
    const points = actual.result!.executionAudit!.phaseCheckpoints;
    const state = points[0]!.state as State;
    expect(points.at(-1)!.state).toEqual(points[0]!.state);
    expect(state.icdAndTriggerHistory.weaponProcs.actors.map((row: State) => row.remainingCooldownTicks)).toEqual([595, 897, 899]);
    const hits = state.pendingEvents.inFlight.filter((row: State) => row.type === "hit");
    expect(hits).toHaveLength(2);
    expect(hits.map((row: State) => [row.remainingTicks, row.priority, row.payload.targetIndex])).toEqual([[0, 3, 0], [0, 3, 1]]);
    expect(hits[0].payload).toMatchObject({ action: { id: "weapon-proc:c:sequenceofsolitude" },
      snapshots: { c: { hpPct: 1 } }, weaponProcContext: { triggerAgeTicks: 1,
        triggerBuffStatuses: [{ startAgeTicks: 1, endRemainingTicks: 0 }] } });
    expect(actual.result!.damageEvents.filter(hit => hit.weaponProcLogId !== undefined && hit.frame === 960)
      .map(hit => [hit.statsBeforeDamage.hpPct, hit.finalDamage])).toEqual([[1, 4000], [1, 2000]]);
    expect(state.buffsAndDebuffs.buffs).toEqual([]);
    expect(actual.result!.damageEvents.some(hit => hit.reaction === "reverseVaporize")).toBe(true);
  });

  it("keeps inclusive cooldown zero, trigger snapshots and FIFO distinct while normalizing only dead identity", () => {
    const config = fixture(); config.weaponProcModel!.actors = [config.weaponProcModel!.actors[0]!]; config.rotation = [];
    const runtime = new IndependentWeaponProcRuntime(config.weaponProcModel!);
    runtime.onDamage({ actorId: "a", frame: 0, parentDamageEventId: 0, targetId: "enemy-0", activeCharacterId: "a", attackTag: "normal", damage: 0 });
    const input: CapturePhaseCheckpointInput = { tick: 600, cumulativeDamage: 0, config: { ...config, duration: 100 },
      energies: new Map(config.characters.map(actor => [actor.id, 0])), fixedEnergyCooldownReadyFrames: new Map(), particleCooldownReadyFrames: new Map(),
      activeBuffs: [], activeDebuffs: [], activeTargetDebuffs: [], activeCharacterId: "a", pendingEvents: [], particleEvents: [], playerHpStateByActorId: new Map(),
      weaponProcState: runtime.captureState() };
    const expiry = capturePhaseCheckpoint(input).checkpoint!.state as State;
    expect(expiry.icdAndTriggerHistory.weaponProcs.actors[0].remainingCooldownTicks).toBe(0);
    const expired = capturePhaseCheckpoint({ ...input, tick: 601 }).checkpoint!.state;
    const never = capturePhaseCheckpoint({ ...input, tick: 601, weaponProcState: new IndependentWeaponProcRuntime(config.weaponProcModel!).captureState() }).checkpoint!.state;
    expect(expired).toEqual(never);
    expect(expiry).not.toEqual(expired);

    const sampled = (hpPct: number, reverseTargets = false) => {
      const source = fixture(); source.duration = 64; source.characters = [source.characters[0]!];
      if (reverseTargets) source.enemy.targets!.reverse();
      source.weaponProcModel!.actors = [{ actorId: "a", weaponId: "ashgravendrinkinghorn", refinement: 1, physicalDamageBonus: 0 }];
      source.rotation = [{ id: "once", actorId: "a", name: "明确一次触发", at: 0, once: true,
        buffs: [{ key: "sample", target: "self", stat: "hpPct", value: hpPct, duration: 1 / 60 }],
        hits: [{ offset: 0, scaling: 0, element: "physical" }] }];
      return simulate(source, { execution: { checkpointFrames: [1] } }).executionAudit!.phaseCheckpoints[0]!.state as State;
    };
    const first = sampled(1); const second = sampled(2);
    expect(first.buffsAndDebuffs).toEqual(second.buffsAndDebuffs);
    expect(first.icdAndTriggerHistory).toEqual(second.icdAndTriggerHistory);
    expect(first.pendingEvents).not.toEqual(second.pendingEvents);
    expect(first.pendingEvents.inFlight.map((row: State) => row.payload.snapshots.a.hpPct)).toEqual([1, 1]);
    expect(second.pendingEvents.inFlight.map((row: State) => row.payload.snapshots.a.hpPct)).toEqual([2, 2]);
    const reordered = sampled(1, true);
    expect(reordered.pendingEvents.inFlight.map((row: State) => row.payload.targeting.targetId)).toEqual(["edge", "enemy-0"]);
    expect(reordered.pendingEvents).not.toEqual(first.pendingEvents);
  });

  it("covers actual +1f tails, captures RNG, and retains clock and stochastic steady-state limits", () => {
    const config = fixture(); config.duration = 10; config.cycleLength = 2;
    config.weaponProcModel!.actors = [config.weaponProcModel!.actors[0]!];
    config.rotation = [{ id: "late", actorId: "a", name: "明确延迟宿主", at: 0, hits: [{ offset: 8, scaling: 0, element: "physical", attackTag: "normal" }] }];
    expect(actionPendingHorizonTicks(config.rotation[0]!)).toBe(480);
    expect(actionPendingHorizonTicks(config.rotation[0]!, config.weaponProcModel)).toBe(481);
    const cut = simulate(config, { execution: { checkpointFrames: [120] } });
    expect(cut.executionAudit!.checkpointCoverage.complete).toBe(false);
    expect(cut.executionAudit!.checkpointCoverage.reasons.join()).toContain("裁掉");
    const extended = simulateWithStartup({ ...config, duration: 2 }, { mode: "steady-state", maximumWarmupCycles: 8, maximumPeriodCycles: 1 });
    expect(extended.startup.simulationTicks).toBe(960 + 481);
    expect(extended.result!.executionAudit!.checkpointCoverage.reasons.join()).not.toContain("裁掉");
    const periodic: AbilityDefinition = { id: "periodic", actorId: "a", name: "明确合成周期", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
      hits: [{ id: "tick", frame: 0, scaling: 0, element: "physical", attackTag: "normal" }],
      periodicEntities: [{ kind: "periodic-active-heal-v1", id: "periodic", label: "明确合成周期", spawnFrame: 23, durationFrames: 180,
        firstTickDelayFrames: 90, intervalFrames: 90, hitDelayFrames: 2, hitIds: ["tick"],
        healing: { ownerHpCoefficient: 0, flat: 0, ownerEmCoefficient: 0, healingBonus: 0, incomingHealingBonus: 0 },
        sourceRefs: ["https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/kuki/skill.go"] }] };
    expect(abilityPendingHorizonTicks(periodic)).toBe(205);
    expect(abilityPendingHorizonTicks(periodic, config.weaponProcModel)).toBe(206);
    const delayed = structuredClone(periodic);
    Object.assign(delayed.periodicEntities![0]!, { durationFrames: 1, firstTickDelayFrames: 1, intervalFrames: 1, hitDelayFrames: 625 });
    delayed.hits![0]!.snapshot = "hit";
    const periodicConfig = makeConfig({ duration: 2, cycleLength: 2, enemy: config.enemy, weaponProcModel: config.weaponProcModel!,
      playerDamageModel: { mode: "reaction-self-v1", position: { x: 0, y: 0 }, hitboxRadius: 0.5, shieldMode: "crystallize-v1", zeroHpPolicy: "clamp-and-continue",
        characters: [{ actorId: "a", initialHpRatio: 1, resistances: { pyro: 0, hydro: 0, electro: 0, cryo: 0, dendro: 0, anemo: 0, geo: 0, physical: 0 } }] },
      timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
        abilities: [delayed], commands: [{ type: "skill", actorId: "a", abilityId: delayed.id, atFrame: 0 }] } });
    periodicConfig.meta.verificationStatus = "user-supplied";
    const actualPeriodic = simulateWithStartup(periodicConfig, { mode: "steady-state", maximumWarmupCycles: 8, maximumPeriodCycles: 1 });
    expect(actualPeriodic.result, actualPeriodic.reasons.join("; ")).not.toBeNull();
    expect(actualPeriodic.startup.simulationTicks).toBe(960 + 650);
    expect(actualPeriodic.result!.damageEvents.some(hit => hit.weaponProcLogId !== undefined && hit.frame === 650)).toBe(true);
    expect(actualPeriodic.result!.executionAudit!.checkpointCoverage.reasons.join()).not.toContain("裁掉");
    expect(phaseCheckpointBlockers(config).join()).toContain("独立武器追击");
    const random = simulate({ ...config, duration: 30 }, { execution: { checkpointFrames: [120], criticalSampling: "seeded-random-v1" } });
    expect(random.executionAudit!.checkpointCoverage).toEqual({ complete: true, missingDimensions: [], reasons: [] });
    expect(random.executionAudit!.phaseCheckpoints[0]!.state.icdAndTriggerHistory).toMatchObject({
      randomExecution: { version: "named-rng-state-v1", streams: { critical: { drawCount: 0 } } },
    });
    const stochasticSteady = evaluateSimulationSteadyState(random);
    expect(stochasticSteady.status).toBe("not-established");
    expect(stochasticSteady.reasons.join()).toContain("随机状态已捕获不等于分布收敛");
    expect(phaseCheckpointBlockers({ ...config, targetClockModel: { mode: "target-local-hitlag-v1" } }, { weaponProcStateAvailable: true }).join()).toContain("目标时钟");
  });
});
