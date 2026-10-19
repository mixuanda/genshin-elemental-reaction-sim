import { describe, expect, it } from "vitest";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import { makeConfig, neutralStats } from "./fixtures";
import { simulate } from "../simulator";
import { simulateWithStartup } from "../simulation-analysis";
import { captureSimulationHit, parseSimulationHit, replaySimulationHit, serializeSimulationHit } from "../calculator-bridge";
import { ThrillingTalesRuntime } from "../thrilling-tales";
import { capturePhaseCheckpoint, phaseCheckpointBlockers, type CapturePhaseCheckpointInput } from "../phase-checkpoint";

function fixture(): SimConfig {
  const config = makeConfig({ duration: 40, cycleLength: 40, enemy: { level: 90, resistance: 0, defReduction: 0 },
    thrillingTalesModel: { mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "a", refinement: 1 }, { actorId: "b", refinement: 5 }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "c", swapFrames: 1,
      abilities: [{ id: "normal", actorId: "c", name: "明确合成普通命中", kind: "normal", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
        hits: [{ id: "normal", frame: 0, scaling: 1, element: "physical", snapshot: "hit", attackTag: "normal" }] }],
      commands: [{ type: "normal", actorId: "c", abilityId: "normal", atFrame: 0 },
        { type: "swap", characterId: "a", atFrame: 20 }, { type: "swap", characterId: "c", atFrame: 100 },
        { type: "normal", actorId: "c", abilityId: "normal", atFrame: 102 },
        { type: "swap", characterId: "b", atFrame: 180 }, { type: "swap", characterId: "c", atFrame: 260 },
        { type: "normal", actorId: "c", abilityId: "normal", atFrame: 262 },
        { type: "normal", actorId: "c", abilityId: "normal", atFrame: 800 },
        { type: "swap", characterId: "b", atFrame: 1540 }, { type: "swap", characterId: "c", atFrame: 1620 },
        { type: "normal", actorId: "c", abilityId: "normal", atFrame: 1622 },
        { type: "normal", actorId: "c", abilityId: "normal", atFrame: 2300 }],
    } });
  config.characters.push(...["b", "c"].map(id => ({ ...config.characters[0]!, id, name: id, stats: { ...neutralStats, flatAtk: id === "c" ? 200 : 0 } })));
  config.meta.verificationStatus = "user-supplied";
  return config;
}

describe("actual Thrilling Tales swap, stat sampling and complete private state", () => {
  it("applies only on completed owner swaps, consumes a second owner's ICD without refresh, and preserves actual action snapshots", () => {
    const config = fixture();
    config.timeline!.abilities.push({ id: "snapshot", actorId: "c", name: "到期前实际取样", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
      hits: [{ id: "snapshot", frame: 2, scaling: 1, element: "physical", snapshot: "action" }] });
    config.timeline!.commands.splice(7, 0, { type: "skill", actorId: "c", abilityId: "snapshot", atFrame: 700 });
    const result = simulate(config, { execution: { detailedTraces: true } });
    expect(result.thrillingTalesLog!.map(row => [row.frame, row.ownerId, row.recipientId, row.outcome, row.cooldownExpiresFrameAfter, row.recipientExpiresFrameAfter])).toEqual([
      [101, "a", "c", "applied", 1301, 701], [261, "b", "c", "recipient-already-buffed", 1461, 701], [1621, "b", "c", "applied", 2821, 2221],
    ]);
    expect(result.thrillingTalesLog!.every(row => row.swapKind === "legal-completed" && row.actionLogIndex !== null && row.ownerId !== row.recipientId)).toBe(true);
    expect(result.damageEvents.map(hit => [hit.frame, hit.finalDamage])).toEqual([[0, 600], [102, 720], [262, 720], [702, 720], [800, 600], [1622, 840], [2300, 600]]);
    const snapshot = result.damageEvents.find(hit => hit.frame === 702)!;
    expect(snapshot.statsBeforeDamage.atkPct).toBe(0.24);
    expect(snapshot.activeStatuses).toContainEqual(expect.objectContaining({ key: "ttds:c", sourceActorId: "a", startTimeSeconds: 101 / 60, endTimeSeconds: 701 / 60 }));
    const restored = parseSimulationHit(serializeSimulationHit(captureSimulationHit(result, snapshot.id)));
    expect(replaySimulationHit(restored).difference).toBe(0);
  });

  it("distinguishes recipient expiry presence from actual Stats reads and preserves the owner's inclusive expiry", () => {
    const make = (lateInput: boolean) => {
      const config = fixture(); delete config.timeline; config.rotation = [];
      config.rotation = [
        { id: "give", actorId: "c", name: "明确旧式实际切人", at: 0, once: true,
          hits: [{ id: "read", offset: 10, scaling: 1, element: "physical", snapshot: "hit" }] },
        { id: "prepare-b", actorId: "b", name: "B上场", at: 100 / 60, once: true },
        { id: "boundary", actorId: "c", name: "到期帧切入", at: 10, once: true,
          ...(lateInput ? { actionPhase: "after-frame-tasks-v1" as const } : {}),
          hits: [{ id: "sample", offset: 1 / 60, scaling: 1, element: "physical", snapshot: "action" }] },
        { id: "prepare-a", actorId: "a", name: "A回场", at: 1199 / 60, once: true },
        { id: "owner-expiry", actorId: "c", name: "持有者到期帧", at: 20, once: true },
        { id: "prepare-a-next", actorId: "a", name: "A再次上场", at: 1201 / 60, once: true },
        { id: "owner-ready", actorId: "c", name: "到期之后", at: 1202 / 60, once: true },
      ];
      return simulate(config, { execution: { detailedTraces: true } });
    };
    const beforeRead = make(false); const afterRead = make(true);
    expect(beforeRead.thrillingTalesLog!.find(row => row.frame === 600)).toMatchObject({ outcome: "recipient-already-buffed", recipientExpiresFrameBefore: 600, recipientExpiresFrameAfter: 600, cooldownExpiresFrameAfter: 1800 });
    expect(afterRead.thrillingTalesLog!.find(row => row.frame === 600)).toMatchObject({ outcome: "applied", recipientExpiresFrameBefore: null, recipientExpiresFrameAfter: 1200, cooldownExpiresFrameAfter: 1800 });
    expect(beforeRead.damageEvents.find(hit => hit.frame === 601)!.finalDamage).toBe(600);
    expect(afterRead.damageEvents.find(hit => hit.frame === 601)!.finalDamage).toBe(840);
    expect(beforeRead.thrillingTalesLog!.find(row => row.frame === 1200)).toMatchObject({ outcome: "owner-cooldown", recipientExpiresFrameBefore: null, recipientExpiresFrameAfter: null });
    expect(beforeRead.thrillingTalesLog!.find(row => row.frame === 1202)!.outcome).toBe("applied");
    expect(beforeRead.thrillingTalesLog!.every(row => row.swapKind === "legacy-implicit")).toBe(true);
    expect(replaySimulationHit(captureSimulationHit(afterRead, afterRead.damageEvents.find(hit => hit.frame === 601)!.id)).difference).toBe(0);
  });

  it("establishes a real cycle with captured owner and recipient state, while expired numeric buffs cannot erase an equality gate", () => {
    const config = fixture();
    const result = simulateWithStartup(config, { mode: "steady-state", maximumWarmupCycles: 8, maximumPeriodCycles: 1 });
    expect(result.status, result.reasons.join("; ")).toBe("steady-state-established");
    expect(result.measurement!.totalDamage).toBe(4080);
    expect(result.steadyState!.steadyStateDps).toBe(102);
    expect(result.result!.executionAudit!.checkpointCoverage.complete).toBe(true);
    const points = result.result!.executionAudit!.phaseCheckpoints;
    expect(points.at(-1)!.state).toEqual(points[0]!.state);
    expect((points[0]!.state.icdAndTriggerHistory as any).thrillingTales).toMatchObject({ actors: [{ actorId: "a", remainingCooldownTicks: null }, { actorId: "b", remainingCooldownTicks: 421 }], recipients: [] });
    const plain = fixture(); delete plain.timeline; plain.rotation = []; plain.duration = 200;
    const runtime = new ThrillingTalesRuntime(plain.thrillingTalesModel!);
    runtime.onSwap({ frame: 0, previousActorId: "a", nextActorId: "c" });
    const input: CapturePhaseCheckpointInput = { tick: 600, cumulativeDamage: 0, config: plain,
      energies: new Map(plain.characters.map(actor => [actor.id, 0])), fixedEnergyCooldownReadyFrames: new Map(), particleCooldownReadyFrames: new Map(),
      activeBuffs: [], activeDebuffs: [], activeTargetDebuffs: [], activeCharacterId: "c", pendingEvents: [], particleEvents: [], playerHpStateByActorId: new Map(),
      thrillingTalesState: runtime.captureState() };
    const presence = capturePhaseCheckpoint(input).checkpoint!;
    runtime.markStatsSample("c", 600);
    const sampled = capturePhaseCheckpoint({ ...input, thrillingTalesState: runtime.captureState() }).checkpoint!;
    expect(presence.state.buffsAndDebuffs).toEqual(sampled.state.buffsAndDebuffs);
    expect(presence.state.icdAndTriggerHistory).not.toEqual(sampled.state.icdAndTriggerHistory);
    expect((presence.state.icdAndTriggerHistory as any).thrillingTales.recipients).toEqual([{ actorId: "c", remainingPresenceTicks: 0 }]);
    expect(phaseCheckpointBlockers(plain).join()).toContain("讨龙");
  });
});
