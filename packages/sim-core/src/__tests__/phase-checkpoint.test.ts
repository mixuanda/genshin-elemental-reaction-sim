import { describe, expect, it } from "vitest";
import type { ActionDefinition, ParticleEventLog, TimelineExecution } from "@genshin-dps-lab/schemas";
import { capturePhaseCheckpoint, phaseCheckpointBlockers, type CapturePhaseCheckpointInput, type CheckpointQueueEvent } from "../phase-checkpoint";
import { MinHeap } from "../min-heap";
import { makeConfig, neutralStats } from "./fixtures";

function event(type: string, frame: number, payload: unknown, sequence = 0): CheckpointQueueEvent {
  return { type, frame, timeSeconds: frame / 60, priority: type === "action" ? 0 : 3, sequence, payload };
}

function input(overrides: Partial<CapturePhaseCheckpointInput> = {}): CapturePhaseCheckpointInput {
  return { tick: 120, cumulativeDamage: 100, config: makeConfig({ duration: 10, cycleLength: 2 }),
    energies: new Map([["a", 0]]), fixedEnergyCooldownReadyFrames: new Map(), particleCooldownReadyFrames: new Map(),
    activeBuffs: [], activeDebuffs: [], activeTargetDebuffs: [], activeCharacterId: "a", pendingEvents: [],
    particleEvents: [], playerHpStateByActorId: new Map(), ...overrides };
}

function repeatedQueue(tick: number, duration = 600): { actions: ActionDefinition[]; events: CheckpointQueueEvent[] } {
  const actions: ActionDefinition[] = [];
  const events: CheckpointQueueEvent[] = [];
  for (let frame = tick; frame < duration; frame += 120) {
    const index = frame / 120;
    const action: ActionDefinition = { id: `e#${index}`, sourceAbilityId: "e", actorId: "a", name: "E", at: frame / 60,
      once: true, timelineCommandIndex: index, startFrame: frame, cancelFrame: frame + 20, animationEndFrame: frame + 30,
      hits: [{ id: "first", offset: 0.1, scaling: 1, element: "pyro" }] };
    actions.push(action); events.push(event("action", frame, { action, cycle: 0 }, index));
  }
  return { actions, events };
}

describe("complete non-reactive phase checkpoint producer", () => {
  it("emits all nine real state dimensions as detached JSON", () => {
    const state = input({ activeBuffs: [{ key: "buff:a", actorId: "a", targetId: "a", stat: "atkPct", value: 0.2,
      start: 1, end: 3, label: "buff" }] });
    const result = capturePhaseCheckpoint(state);
    expect(result.blockers).toEqual([]);
    expect(Object.keys(result.checkpoint!.state)).toHaveLength(9);
    expect(result.checkpoint!.state.buffsAndDebuffs).toEqual({ buffs: [{ key: "buff:a", actorId: "a", targetId: "a",
      stat: "atkPct", value: 0.2, label: "buff", ageTicks: 60, remainingTicks: 60 }], debuffs: [] });
    (state.energies as Map<string, number>).set("a", 60);
    expect(result.checkpoint!.state.energy).toEqual([{ actorId: "a", current: 0, maximum: 60 }]);
    expect(JSON.parse(JSON.stringify(result.checkpoint))).toEqual(result.checkpoint);
  });

  it("normalizes compiled command identity and folds only identical future input cycles", () => {
    const first = repeatedQueue(120); const later = repeatedQueue(240);
    const a = capturePhaseCheckpoint(input({ config: makeConfig({ duration: 10, cycleLength: 2, rotation: first.actions }), pendingEvents: first.events }));
    const b = capturePhaseCheckpoint(input({ tick: 240, config: makeConfig({ duration: 10, cycleLength: 2, rotation: later.actions }), pendingEvents: later.events }));
    expect(a.blockers).toEqual([]); expect(b.blockers).toEqual([]);
    expect(a.checkpoint!.state).toEqual(b.checkpoint!.state);
    later.events[1]!.frame += 1;
    later.events[1]!.timeSeconds += 1 / 60;
    expect(capturePhaseCheckpoint(input({ tick: 240, config: makeConfig({ duration: 10, cycleLength: 2, rotation: later.actions }), pendingEvents: later.events })).blockers.join()).toContain("并不重复");
  });

  it("preserves alternating two-cycle input and its phase using actual queued action definitions", () => {
    const actions: ActionDefinition[] = Array.from({ length: 8 }, (_, cycle) => ({
      id: `${cycle % 2 ? "q" : "e"}#${cycle}`,
      sourceAbilityId: cycle % 2 ? "q" : "e", actorId: "a", name: cycle % 2 ? "Q" : "E",
      at: cycle * 2, once: true, timelineCommandIndex: cycle,
      startFrame: cycle * 120, cancelFrame: cycle * 120 + 20, animationEndFrame: cycle * 120 + 30,
      energyCost: cycle % 2 ? 60 : 0,
      hits: [{ id: "hit", offset: 0.1, scaling: cycle % 2 ? 4 : 1, element: "pyro" }],
    }));
    const config = makeConfig({ duration: 16, cycleLength: 2, rotation: actions });
    const capture = (tick: number) => capturePhaseCheckpoint(input({ tick, config,
      pendingEvents: actions.filter((action) => action.startFrame! >= tick)
        .map((action, index) => event("action", action.startFrame!, { action, cycle: 0 }, index)) }));
    const first = capture(120); const samePhase = capture(360); const oppositePhase = capture(240);
    expect(first.blockers).toEqual([]); expect(samePhase.blockers).toEqual([]); expect(oppositePhase.blockers).toEqual([]);
    expect(first.checkpoint!.state).toEqual(samePhase.checkpoint!.state);
    expect(first.checkpoint!.state.pendingEvents).toMatchObject({ periodCycles: 2, futureInputCycles: [
      [{ action: { id: "q", energyCost: 60 } }], [{ action: { id: "e", energyCost: 0 } }],
    ] });
    expect(oppositePhase.checkpoint!.state.pendingEvents).not.toEqual(first.checkpoint!.state.pendingEvents);
    expect(capture(600).blockers.join()).toContain("不足两次完整");
  });

  it("retains pending hit snapshots and particle receive context across a translated boundary", () => {
    function delayed(tick: number) {
      const action: ActionDefinition = { id: `e#${tick / 120}`, sourceAbilityId: "e", actorId: "a", name: "E",
        at: (tick - 10) / 60, once: true, timelineCommandIndex: tick / 120,
        startFrame: tick - 10, cancelFrame: tick + 10, animationEndFrame: tick + 20 };
      const particle: ParticleEventLog = { id: tick, sourceActorId: "a", sourceActionId: action.id, source: "E:particle",
        particleId: `${action.id}:particle-0`, spawnFrame: tick - 5, receiveFrame: tick + 20,
        spawnTimeSeconds: (tick - 5) / 60, receiveTimeSeconds: (tick + 20) / 60,
        particleElement: "pyro", particleKind: "particle", particleCount: 2, receivedWithinSimulation: true,
        cycle: 0, triggerLogId: tick + 5, triggerHitId: "hit" };
      return capturePhaseCheckpoint(input({ tick, config: makeConfig({ duration: 10, cycleLength: 2, rotation: [action] }),
        particleEvents: [particle], pendingEvents: [event("hit", tick + 10, { actorId: "a", action,
          hit: { id: "hit", offset: 1 / 3, scaling: 2, element: "pyro", snapshot: "action" }, hitIndex: 0,
          targetIndex: 0, targetCount: 1, hitGroupId: `${action.id}:0:0:${tick + 10}`,
          snapshots: { a: { ...neutralStats, atkPct: 0.8 } }, cycle: 0 }),
          event("particleReceive", tick + 20, { particleEventId: tick }, 1)] }));
    }
    const a = delayed(120); const b = delayed(240);
    expect(a.blockers).toEqual([]); expect(b.blockers).toEqual([]);
    expect(a.checkpoint!.state).toEqual(b.checkpoint!.state);
    expect(a.checkpoint!.state.pendingEvents).toMatchObject({ inFlight: [
      { type: "hit", remainingTicks: 10, payload: { snapshots: { a: { atkPct: 0.8 } } } },
      { type: "particleReceive", remainingTicks: 20, payload: { particleCount: 2, receiveRemainingTicks: 20 } },
    ] });
    expect(a.checkpoint!.state.entities).toMatchObject({ inFlightParticles: [{ spawnAgeTicks: 5, receiveRemainingTicks: 20 }] });
  });

  it("replays actual consumed charge slots and excludes rejected and boundary-time commands", () => {
    const execution: TimelineExecution = { mode: "legal-frame-v1", fps: 60, legalityMode: "strict",
      initialActiveCharacterId: "a", finalActiveCharacterId: "a", totalFrames: 140, adjustments: [], failures: [], stateLog: [],
      commandResults: [0, 20, 90, 100].map((startFrame, commandIndex) => ({ commandIndex, commandType: "skill", actorId: "a", abilityId: "e",
        requestedFrame: startFrame, startFrame, cancelFrame: startFrame + 10, animationEndFrame: startFrame + 40,
        endFrame: startFrame + 10, status: commandIndex === 2 ? "rejected" : "executed", waitedFrames: 0 })) };
    const result = capturePhaseCheckpoint(input({ tick: 100, timelineConfig: {
      mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 12, commands: [],
      abilities: [{ id: "e", actorId: "a", name: "E", kind: "skill", cancelFrame: 10, animationEndFrame: 40,
        cooldownFrames: 100, maxCharges: 2, chargeRecoveryFrames: 100 }],
    }, timelineExecution: execution }));
    expect(result.blockers).toEqual([]);
    expect(result.checkpoint!.state.cooldownsAndCharges).toEqual({ abilities: [
      { actorId: "a", abilityId: "e", availableCharges: 1, remainingRechargeTicks: [0, 20] },
    ] });
  });

  it("keeps cancel/animation phase, live timeline states, trigger timers and player HP", () => {
    const timelineConfig = { mode: "legal-frame-v1" as const, fps: 60 as const, legalityMode: "strict" as const,
      initialActiveCharacterId: "a", swapFrames: 12, commands: [], abilities: [] };
    const execution: TimelineExecution = { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a",
      finalActiveCharacterId: "a", totalFrames: 130, adjustments: [], failures: [],
      stateLog: [{ sequence: 0, frame: 110, timeSeconds: 110 / 60, operation: "grant", actorId: "a", statusKey: "infusion",
        label: "infusion", expiresAtFrame: 180, commandIndex: 0, abilityId: "e" }],
      commandResults: [{ commandIndex: 0, commandType: "dash", actorId: "a", abilityId: null, requestedFrame: 110,
        startFrame: 110, cancelFrame: 130, animationEndFrame: 140, endFrame: 130, status: "executed", waitedFrames: 0 }] };
    const result = capturePhaseCheckpoint(input({ timelineConfig, timelineExecution: execution,
      fixedEnergyCooldownReadyFrames: new Map([["old", 100], ["active", 150]]),
      playerHpStateByActorId: new Map([["a", { actorId: "a", maxHp: 10000, currentHp: 9000, zeroHpReached: false }]]) }));
    expect(result.checkpoint!.state.activeCharacterAndActionPhase).toEqual({ activeCharacterId: "a", occupancy: {
      actorId: "a", abilityId: null, commandType: "dash", elapsedTicks: 10, cancelRemainingTicks: 10, animationRemainingTicks: 20 } });
    expect(result.checkpoint!.state.icdAndTriggerHistory).toMatchObject({ fixedEnergy: [{ key: "active", remainingTicks: 30 }] });
    expect(result.checkpoint!.state.resourcesAndHp).toMatchObject({ hp: [{ currentHp: 9000 }],
      timelineStates: [{ statusKey: "infusion", remainingTicks: 60 }] });
  });

  it("excludes expired buffs but keeps particles arriving exactly at the event-before boundary", () => {
    const result = capturePhaseCheckpoint(input({ activeBuffs: [{ key: "expired", actorId: "a", targetId: "a",
      stat: "atkPct", value: 1, start: 0, end: 2, label: "expired" }] }));
    expect(result.checkpoint!.state.buffsAndDebuffs).toEqual({ buffs: [], debuffs: [] });
    const arriving: ParticleEventLog = { id: 1, sourceActorId: "a", sourceActionId: "e", source: "particle",
      particleId: "p", spawnFrame: 100, receiveFrame: 120, spawnTimeSeconds: 100 / 60, receiveTimeSeconds: 2,
      particleElement: "pyro", particleKind: "particle", particleCount: 1, receivedWithinSimulation: true,
      cycle: 0, triggerLogId: null, triggerHitId: null };
    const boundary = capturePhaseCheckpoint(input({ particleEvents: [arriving],
      pendingEvents: [event("particleReceive", 120, { particleEventId: 1 })] }));
    expect(boundary.blockers).toEqual([]);
    expect(boundary.checkpoint!.state.entities).toMatchObject({ inFlightParticles: [{ receiveRemainingTicks: 0 }] });
    const missing = capturePhaseCheckpoint(input({ pendingEvents: [event("particleReceive", 120, { particleEventId: 1 })] }));
    expect(missing.checkpoint).toBeNull(); expect(missing.blockers.join()).toContain("生成记录");
  });

  it("fails closed for private capabilities, unsupported pending tasks and incomplete inputs", () => {
    expect(phaseCheckpointBlockers(makeConfig())).toEqual([]);
    expect(phaseCheckpointBlockers(makeConfig(), { auraEnginePresent: true, targetClockPresent: true,
      pluginsPresent: true, privateReactionOrEntityStatePresent: true, privateTriggerStatePresent: true })).toHaveLength(5);
    expect(capturePhaseCheckpoint(input({ pendingEvents: [event("burningTick", 121, {})] })).checkpoint).toBeNull();
    expect(capturePhaseCheckpoint(input({ energies: new Map() })).blockers.join()).toContain("实际能量");
    expect(capturePhaseCheckpoint(input({ tick: 540 })).blockers.join()).toContain("不足一个完整");
    expect(capturePhaseCheckpoint(input({ tick: 480 })).blockers.join()).toContain("不足两次完整");
    expect(capturePhaseCheckpoint(input({ unsupportedState: ["private plugin state"] })).blockers).toEqual(["private plugin state"]);
    expect(capturePhaseCheckpoint(input({ pendingEvents: [event("buff", 119, {})] })).blockers.join()).toContain("边界之前");
  });

  it("refuses a duration-clipped pending tail even when the next static cycle is complete", () => {
    const config = makeConfig({ duration: 10, cycleLength: 2, rotation: [{ id: "delayed", actorId: "a", name: "delayed",
      at: 0, once: true, hits: [{ id: "late", offset: 6, scaling: 1, element: "pyro" }] }] });
    const result = capturePhaseCheckpoint(input({ tick: 360, config }));
    expect(result.checkpoint).toBeNull();
    expect(result.blockers.join()).toContain("裁掉");
  });

  it("identifies configured private counters and stochastic input without rejecting plain hits", () => {
    const plain = makeConfig({ rotation: [{ id: "e", actorId: "a", name: "E", at: 0,
      hits: [{ id: "hit", offset: 0, scaling: 1, element: "pyro" }] }] });
    expect(phaseCheckpointBlockers(plain)).toEqual([]);
    plain.rotation[0]!.particles = [{ id: "random", element: "pyro", count: { min: 1, max: 2 }, travelTime: 1 }];
    expect(phaseCheckpointBlockers(plain).join()).toContain("随机粒子");
  });
});

describe("non-destructive heap checkpoint inspection", () => {
  it("exposes the next event and an ordered detached array without consuming the heap", () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    heap.push(3); heap.push(1); heap.push(2);
    expect(heap.peek()).toBe(1);
    const snapshot = heap.snapshot();
    expect(snapshot).toEqual([1, 2, 3]); expect(heap.size).toBe(3);
    (snapshot as number[]).pop();
    expect([heap.pop(), heap.pop(), heap.pop()]).toEqual([1, 2, 3]);
    expect(heap.peek()).toBeUndefined();
  });
});
