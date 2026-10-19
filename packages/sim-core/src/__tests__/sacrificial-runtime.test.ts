import { describe, expect, it } from "vitest";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import { makeConfig } from "./fixtures";
import { simulate } from "../simulator";
import { SacrificialRuntime } from "../sacrificial";
import { captureSimulationHit, parseSimulationHit, replaySimulationHit, serializeSimulationHit } from "../calculator-bridge";
import { phaseCheckpointBlockers } from "../phase-checkpoint";

/** Explicit synthetic variants; this is not a verified whole-character rotation. */
function fixture(): SimConfig {
  return makeConfig({ duration: 37, cycleLength: 37, randomSeed: "sacrificial-consumer-reference",
    meta: { name: "祭礼共享串行技能队列", version: "1", verificationStatus: "user-supplied" },
    enemy: { level: 90, resistance: 0, defReduction: 0 },
    sacrificialModel: { mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "a", weaponId: "sacrificialfragments", refinement: 5 }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "wait", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [600, 900, 1200].map((recovery, index) => ({ id: `e${index}`, actorId: "a", name: `明确合成技能变体${index}`,
        kind: "skill", maxCharges: 2, cooldownFrames: recovery, cooldownStartFrame: 9, cancelFrame: 1, animationEndFrame: 1,
        hits: [{ id: `hit${index}`, frame: 42, scaling: 1, element: "physical", attackTag: "skill", snapshot: "hit" }],
        particles: [{ id: `particle${index}`, source: "明确合成命中产球", element: "pyro", count: 4, kind: "particle", travelFrames: 100,
          trigger: { kind: "hit-confirm", hitIds: [`hit${index}`] } }] })),
      commands: [{ type: "skill", actorId: "a", abilityId: "e0", atFrame: 1 },
        { type: "skill", actorId: "a", abilityId: "e1", atFrame: 57 },
        { type: "skill", actorId: "a", abilityId: "e2", atFrame: 99 }] } });
}

describe("actual Sacrificial callbacks and legal serial skill feedback", () => {
  it("uses actual resets to advance the next cast, sharing variant charges and restarting the remaining serial queue", () => {
    const result = simulate(fixture(), { execution: { detailedTraces: true } });
    expect(result.timelineExecution!.commandResults.map(row => row.startFrame)).toEqual([1, 57, 100]);
    expect(result.timelineExecution!.adjustments).toContainEqual(expect.objectContaining({ commandIndex: 2, code: "ABILITY_ON_COOLDOWN", requestedFrame: 99, executedFrame: 100 }));
    expect(result.sacrificialLog!.map(row => [row.frame, row.outcome, row.drawIndex])).toEqual([[43, "skill-ready", null], [99, "triggered", 0], [142, "cooldown-blocked", null]]);
    expect(result.skillCooldownLog!.filter(row => row.operation === "start").map(row => [row.frame, row.stateAfter.availableCharges])).toEqual([[10, 1], [66, 0], [109, 0]]);
    const reset = result.skillCooldownLog!.find(row => row.operation === "reset")!;
    expect(reset).toMatchObject({ frame: 99, sacrificialLogId: 1, stateBefore: { availableCharges: 0 }, stateAfter: { availableCharges: 1, workerStartedFrame: 99,
      queue: [{ abilityId: "e1", recoveryFrames: 900 }] } });
    expect(result.sacrificialLog![1]!.skillCooldownLogId).toBe(reset.id);
    expect(result.skillCooldownLog!.filter(row => row.operation === "recover").map(row => [row.frame, row.stateAfter.availableCharges])).toEqual([[999, 1], [2199, 2]]);
    expect(result.skillCooldownLog!.find(row => row.frame === 610)).toMatchObject({ operation: "stale-worker", stateBefore: { availableCharges: 0 }, stateAfter: { availableCharges: 0 } });
    expect(result.damageEvents.map(row => [row.frame, row.finalDamage])).toEqual([[43, 500], [99, 500], [142, 500]]);
    expect(result.particleEvents.map(row => row.receiveFrame)).toEqual([143, 199, 242]);
    expect(result.energyStats.a!.final).toBe(36);
    expect(replaySimulationHit(parseSimulationHit(serializeSimulationHit(captureSimulationHit(result, 2)))).difference).toBe(0);
  });

  it("accepts a real reset in phase 8 at the same frame, while strict phase 0 waits for the next frame and stamina remains a separate wait", () => {
    const early = fixture(); early.timeline!.legalityMode = "strict";
    expect(() => simulate(early)).toThrow(/第 100 帧/);
    const late = fixture(); late.timeline!.legalityMode = "strict"; late.timeline!.abilities[2]!.actionPhase = "after-frame-tasks-v1";
    const result = simulate(late);
    expect(result.timelineExecution!.commandResults[2]!.startFrame).toBe(99);
    expect(result.skillCooldownLog!.find(row => row.operation === "start" && row.abilityId === "e2")!.frame).toBe(108);
    const phaseOrder = fixture();
    phaseOrder.timeline!.abilities[0]!.actionPhase = "after-frame-tasks-v1";
    phaseOrder.timeline!.abilities[0]!.cancelFrame = 0;
    phaseOrder.timeline!.commands = [{ type: "skill", actorId: "a", abilityId: "e0", atFrame: 1 }, { type: "skill", actorId: "a", abilityId: "e1", atFrame: 1 }];
    const ordered = simulate(phaseOrder);
    expect(ordered.timelineExecution!.commandResults.map(row => row.startFrame)).toEqual([1, 2]);
    expect(ordered.timelineExecution!.adjustments[0]).toMatchObject({ code: "ACTION_OVERLAP", requestedFrame: 1, executedFrame: 2 });
    const resource = fixture(); resource.duration = 3; resource.cycleLength = 3;
    resource.staminaModel = { mode: "shared-stamina-v1", profileId: "gcsim-b4ae769-stamina-v1", initialStamina: 0 };
    resource.timeline!.commands = [{ type: "skill", actorId: "a", abilityId: "e0", atFrame: 0 }];
    resource.timeline!.abilities = [resource.timeline!.abilities[0]!];
    resource.timeline!.abilities[0]!.staminaCost = { amount: 10, consumeFrame: 0, source: { kind: "custom", note: "明确合成体力消耗" } };
    const waited = simulate(resource);
    expect(waited.timelineExecution!.commandResults[0]!.startFrame).toBe(114);
    expect(waited.timelineExecution!.adjustments.map(row => row.code)).toEqual(["INSUFFICIENT_STAMINA"]);
  });

  it("does not draw on earlier source guards or spend ICD on failure, and refuses unsupported legacy or deterministic checkpoint claims", () => {
    const config = fixture(); config.sacrificialModel!.actors[0]!.refinement = 1;
    const runtime = new SacrificialRuntime(config.randomSeed, config.sacrificialModel!);
    let queries = 0;
    const input = { actorId: "a", frame: 10, damageEventId: 0, activeCharacterId: "a", attackTag: "skill" as const,
      damage: 500, getSkillCooldown: () => { queries++; return 100; } };
    const off = runtime.onDamage({ ...input, activeCharacterId: "b" });
    const tag = runtime.onDamage({ ...input, attackTag: "normal" });
    expect([off.outcome, tag.outcome, queries, off.drawCountAfter, tag.drawCountAfter]).toEqual(["off-field", "attack-tag-blocked", 0, 0, 0]);
    expect(runtime.onDamage({ ...input, getSkillCooldown: () => 0 })).toMatchObject({ outcome: "skill-ready", roll: null, drawCountAfter: 0 });
    expect(runtime.onDamage({ ...input, damage: 0 })).toMatchObject({ outcome: "zero-damage", roll: null, drawCountAfter: 0 });
    expect(runtime.onDamage(input)).toMatchObject({ outcome: "failed-roll", roll: 0.6284964594524354, cooldownExpiresFrameAfter: null, drawIndex: 0 });
    expect(runtime.onDamage({ ...input, frame: 11 })).toMatchObject({ outcome: "triggered", roll: 0.32096404768526554, cooldownExpiresFrameAfter: 1811, drawIndex: 1 });
    expect(runtime.onDamage({ ...input, frame: 1811 })).toMatchObject({ outcome: "cooldown-blocked", skillCooldownBefore: null, drawCountAfter: 2 });
    expect(runtime.onDamage({ ...input, frame: 1812 })).toMatchObject({ outcome: "failed-roll", drawIndex: 2, cooldownExpiresFrameAfter: 1811 });
    expect(phaseCheckpointBlockers(config).join(" ")).toContain("祭礼独立随机流");
    delete config.timeline;
    expect(() => simulate(config)).toThrow(/explicit legal timeline/);
  });
});
