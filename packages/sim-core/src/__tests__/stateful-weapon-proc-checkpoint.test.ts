import { describe, expect, it } from "vitest";
import { currentResolvedSimulationRuntimeOptionsSchema, resolvedSimulationRuntimeOptionsSchema,
  type AbilityDefinition, type SimConfig, type LegalTimelineCommand } from "@genshin-dps-lab/schemas";
import { makeConfig, neutralStats } from "./fixtures";
import { simulateWithStartup } from "../simulation-analysis";
import { IndependentWeaponProcRuntime } from "../weapon-proc";
import { capturePhaseCheckpoint, type CapturePhaseCheckpointInput } from "../phase-checkpoint";
import { abilityPendingHorizonTicks } from "../action-pending-horizon";
import { captureSimulationHit, replaySimulationHit } from "../calculator-bridge";

type State = Record<string, any>;

/** Deliberately synthetic hosts; the source-backed scope is the four weapon passives. */
function fixture(): SimConfig {
  const normal = (actorId: string, scaling = 0): AbilityDefinition => ({ id: `${actorId}-normal`, actorId,
    name: "明确合成普攻", kind: "normal", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
    hits: [{ id: `${actorId}-host`, frame: 0, scaling, element: "physical", attackTag: "normal", snapshot: "hit" }] });
  const skill = (actorId: string): AbilityDefinition => ({ id: `${actorId}-skill`, actorId,
    name: "明确合成施放", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0 });
  const crescentSkill = skill("c");
  crescentSkill.particles = [{ id: "actual-particle", source: "明确合成粒子", element: "pyro", count: 1,
    kind: "particle", spawnFrame: 0, travelFrames: 1 }];
  const lineNormal = normal("d");
  lineNormal.buffs = [{ key: "boundary-snapshot", target: "self", stat: "atkFlat", value: 200,
    durationFrames: 1, startFrame: 0 }];
  const commands: LegalTimelineCommand[] = [{ type: "swap", characterId: "a", atFrame: 0 },
    ...[2, 33, 64, 1850, 1881].map(atFrame => ({ type: "normal" as const, actorId: "a", abilityId: "a-normal", atFrame })),
    { type: "swap", characterId: "b", atFrame: 1882 },
    { type: "skill", actorId: "b", abilityId: "b-skill", atFrame: 1883 },
    { type: "normal", actorId: "b", abilityId: "b-normal", atFrame: 1884 },
    { type: "swap", characterId: "c", atFrame: 1885 },
    { type: "skill", actorId: "c", abilityId: "c-skill", atFrame: 1886 },
    { type: "normal", actorId: "c", abilityId: "c-normal", atFrame: 1888 },
    { type: "swap", characterId: "d", atFrame: 1889 },
    { type: "skill", actorId: "d", abilityId: "d-skill", atFrame: 1890 },
    { type: "normal", actorId: "d", abilityId: "d-normal", atFrame: 1919 }];
  const config = makeConfig({ duration: 32, cycleLength: 32,
    meta: { name: "四种确定性武器的真实周期检查点", version: "1", verificationStatus: "user-supplied" },
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [
      { id: "enemy-0", name: "合成目标", position: { x: 0, y: 0 }, hitboxRadius: 0 },
    ] },
    weaponProcModel: { mode: "fixed-source-no-character-hitlag-v1", actors: [
      { actorId: "a", weaponId: "flute", refinement: 1, physicalDamageBonus: 0 },
      { actorId: "b", weaponId: "debateclub", refinement: 1, physicalDamageBonus: 0 },
      { actorId: "c", weaponId: "crescentpike", refinement: 1, physicalDamageBonus: 0 },
      { actorId: "d", weaponId: "endoftheline", refinement: 1, physicalDamageBonus: 0 },
    ] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "d", swapFrames: 1,
      abilities: [normal("a"), normal("b"), normal("c", 1), lineNormal, skill("b"), crescentSkill, skill("d")], commands },
  });
  config.characters = ["a", "b", "c", "d"].map(id => ({ ...config.characters[0]!, id, name: id,
    initialEnergy: 60, stats: { ...neutralStats } }));
  config.reactionEngine = { mode: "aura-v9", icdProfiles: { cycle: { resetFrames: 60, applicationSequence: [true, false], tailPolicy: "clamp" } } };
  config.targetTaskModel = { mode: "target-phase-v2" };
  for (const [index, element] of ["hydro", "pyro"].entries()) {
    const hit = config.timeline!.abilities[index]!.hits![0]!;
    hit.element = element as "hydro" | "pyro";
    hit.application = { gaugeUnits: 1, icd: { mode: "legacy-boolean-profile-v1", icdTag: element, profileId: "cycle" } };
    hit.geometry = { kind: "circle", coordinateSpace: "world", origin: { x: 0, y: 0 }, radius: 1 };
  }
  return config;
}

describe("actual deterministic stateful weapon checkpoints", () => {
  it("establishes all four live state machines, retains boundary snapshots and distinguishes unfinished Flute notes", () => {
    const config = fixture();
    const result = simulateWithStartup(config, { mode: "steady-state", warmupEnergyMode: "configured", maximumWarmupCycles: 8, maximumPeriodCycles: 1 });
    expect(result.status, result.reasons.join("; ")).toBe("steady-state-established");
    expect(result.result!.executionAudit!.checkpointCoverage).toMatchObject({ complete: true, reasons: [] });
    expect(result.steadyState!.periodCycles).toBe(1);
    expect(result.result!.damageEvents.some(event => event.reaction === "reverseVaporize")).toBe(true);
    expect(result.measurement!.totalDamage).toBe(1880);
    expect(result.steadyState!.steadyStateDps).toBe(58.75);
    expect(result.result!.resolvedRuntimeOptions.flatStatBuffSemantics).toBe("canonical-v1");
    const { flatStatBuffSemantics: marker, execution: _execution, ...historicalOptions } = result.result!.resolvedRuntimeOptions;
    expect(currentResolvedSimulationRuntimeOptionsSchema.parse(historicalOptions)).not.toHaveProperty("flatStatBuffSemantics");
    expect(resolvedSimulationRuntimeOptionsSchema.safeParse({ ...historicalOptions, flatStatBuffSemantics: marker }).success).toBe(false);
    const boundaryHit = result.result!.damageEvents.find(event => event.actorId === "d" && event.frame === 1920 && event.weaponProcLogId !== undefined)!;
    expect(boundaryHit).toMatchObject({ finalDamage: 480, statsBeforeDamage: { flatAtk: 200 } });
    const replay = replaySimulationHit(JSON.parse(JSON.stringify(captureSimulationHit(result.result!, boundaryHit.id))));
    expect(replay.difference).toBe(0);
    expect(replay.captured.sourceResult.resolvedRuntimeOptions.flatStatBuffSemantics).toBe("canonical-v1");
    const points = result.result!.executionAudit!.phaseCheckpoints;
    expect(points.at(-1)!.state).toEqual(points[0]!.state);
    const state = points[0]!.state as State;
    expect(state.icdAndTriggerHistory.weaponProcs.actors).toMatchObject([
      { actorId: "a", remainingCooldownTicks: null, lifecycle: { effectRemainingTicks: null, notes: 0 } },
      { actorId: "b", remainingCooldownTicks: 144, lifecycle: { effectRemainingTicks: 863 } },
      { actorId: "c", remainingCooldownTicks: null, lifecycle: { effectRemainingTicks: 267 } },
      { actorId: "d", remainingCooldownTicks: 119, lifecycle: { effectRemainingTicks: 870, activationCooldownRemainingTicks: 690, procCount: 1 } },
    ]);
    const pending = state.pendingEvents.inFlight.filter((event: State) => event.type === "hit");
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ remainingTicks: 0, payload: { action: { id: "weapon-proc:d:endoftheline" },
      snapshots: { d: { flatAtk: 200 } }, weaponProcContext: { triggerAgeTicks: 1,
        stateBefore: { procCount: 0, effectRemainingTicks: 870 }, stateAfter: { procCount: 1, hitCooldownRemainingTicks: 119 },
        triggerBuffStatuses: [{ startAgeTicks: 1, endRemainingTicks: 0 }] } } });
    expect(state.buffsAndDebuffs.buffs).toEqual([]);
    expect(abilityPendingHorizonTicks(config.timeline!.abilities[3]!, config.weaponProcModel)).toBe(1);

    const plain = fixture(); delete plain.timeline; delete plain.reactionEngine; plain.targetTaskModel = { mode: "legacy-event-heap-v1" }; plain.rotation = []; plain.duration = 160;
    plain.weaponProcModel!.actors = [plain.weaponProcModel!.actors[0]!];
    const runtime = new IndependentWeaponProcRuntime(plain.weaponProcModel!);
    const hit = { actorId: "a", parentDamageEventId: 0, targetId: "enemy-0", activeCharacterId: "a", attackTag: "normal" as const, damage: 0 };
    runtime.onDamage({ ...hit, frame: 0 });
    const input: CapturePhaseCheckpointInput = { tick: 31, cumulativeDamage: 0, config: plain,
      energies: new Map(plain.characters.map(actor => [actor.id, 60])), fixedEnergyCooldownReadyFrames: new Map(), particleCooldownReadyFrames: new Map(),
      activeBuffs: [], activeDebuffs: [], activeTargetDebuffs: [], activeCharacterId: "a", pendingEvents: [], particleEvents: [], playerHpStateByActorId: new Map(),
      weaponProcState: runtime.captureState() };
    const one = capturePhaseCheckpoint(input).checkpoint!.state;
    runtime.onDamage({ ...hit, frame: 31 });
    const two = capturePhaseCheckpoint({ ...input, tick: 62, weaponProcState: runtime.captureState() }).checkpoint!.state;
    expect(one.icdAndTriggerHistory).not.toEqual(two.icdAndTriggerHistory);
    expect((one.icdAndTriggerHistory as State).weaponProcs.actors[0].lifecycle).toMatchObject({ notes: 1, effectRemainingTicks: 1769 });
    expect((two.icdAndTriggerHistory as State).weaponProcs.actors[0].lifecycle).toMatchObject({ notes: 2, effectRemainingTicks: 1769 });
    const equality = capturePhaseCheckpoint({ ...input, tick: 1831, weaponProcState: runtime.captureState() }).checkpoint!.state;
    const expired = capturePhaseCheckpoint({ ...input, tick: 1832, weaponProcState: runtime.captureState() }).checkpoint!.state;
    const never = capturePhaseCheckpoint({ ...input, tick: 1832, weaponProcState: new IndependentWeaponProcRuntime(plain.weaponProcModel!).captureState() }).checkpoint!.state;
    expect((equality.icdAndTriggerHistory as State).weaponProcs.actors[0].lifecycle).toMatchObject({ notes: 2, effectRemainingTicks: 0 });
    expect(equality.icdAndTriggerHistory).not.toEqual(expired.icdAndTriggerHistory);
    expect(expired.icdAndTriggerHistory).toEqual(never.icdAndTriggerHistory);
  });
});
