import { expect, it } from "vitest";
import type { LegalTimelineCommand } from "@genshin-dps-lab/schemas";
import { makeConfig } from "./fixtures";
import { simulate } from "../simulator";
import { applyExecutionProfile, IDEALIZED_EXECUTION_PROFILE } from "../execution-profiles";

/** Prepared for the coordinated regression batch; no character fixture or weapon is required. */
it("executes generic delayed SetCD and shared serial E variants, excludes failed casts, and captures actual pending workers", () => {
  const commands: LegalTimelineCommand[] = [];
  for (let cycle = 0; cycle < 5; cycle++) {
    for (const [abilityId, frame] of [["short", 1], ["long", 12], ["unaffordable", 20], ["short", 23], ["long", 40]] as const) {
      commands.push({ type: "skill", actorId: "a", abilityId, atFrame: cycle * 180 + frame });
    }
  }
  const config = makeConfig({ duration: 15, cycleLength: 3,
    meta: { name: "通用共享战技队列综合回归", version: "1", verificationStatus: "user-supplied" },
    enemy: { level: 90, resistance: 0, defReduction: 0 },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "wait", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [
        { id: "short", actorId: "a", name: "延迟启动的短恢复变体", kind: "skill", cooldownStartFrame: 4,
          cooldownFrames: 30, maxCharges: 2, cancelFrame: 0, animationEndFrame: 0,
          hits: [{ id: "short-hit", frame: 1, scaling: 1, element: "physical" }] },
        { id: "long", actorId: "a", name: "同槽立即启动的长恢复变体", kind: "skill",
          cooldownFrames: 50, maxCharges: 2, cancelFrame: 0, animationEndFrame: 0,
          hits: [{ id: "long-hit", frame: 1, scaling: 1, element: "physical" }] },
        { id: "unaffordable", actorId: "a", name: "资源不足的同槽请求", kind: "skill", energyCost: 1,
          cooldownFrames: 30, maxCharges: 2, cancelFrame: 0, animationEndFrame: 0 },
      ], commands } });

  const result = simulate(config, { execution: { checkpointFrames: [40, 220, 400] } });
  expect(result.sacrificialLog).toBeUndefined();
  expect(result.timelineExecution!.commandResults.slice(0, 5).map(row => [row.startFrame, row.status, row.failureCode ?? null])).toEqual([
    [1, "executed", null], [12, "executed", null], [35, "rejected", "INSUFFICIENT_ENERGY"],
    [35, "waited", null], [85, "waited", null],
  ]);
  const firstCycle = result.skillCooldownLog!.filter(row => row.frame < 180);
  expect(firstCycle.map(row => [row.frame, row.operation, row.stateAfter.availableCharges,
    row.stateAfter.queue.map(entry => entry.recoveryFrames)])).toEqual([
    [5, "start", 1, [30]], [12, "start", 0, [30, 50]], [35, "recover", 1, [50]],
    [39, "start", 0, [50, 30]], [85, "recover", 1, [30]], [85, "start", 0, [30, 50]],
    [115, "recover", 1, [50]], [165, "recover", 2, []],
  ]);
  expect(result.skillCooldownLog!.some(row => row.abilityId === "unaffordable")).toBe(false);
  expect(result.totalDamage).toBe(10_000);
  expect(result.executionAudit!.checkpointCoverage).toMatchObject({ complete: true, reasons: [] });
  const checkpoints = result.executionAudit!.phaseCheckpoints;
  expect(checkpoints).toHaveLength(3);
  expect(checkpoints[0]!.state).toEqual(checkpoints[1]!.state);
  expect(checkpoints[1]!.state).toEqual(checkpoints[2]!.state);
  expect(checkpoints[0]!.state).toMatchObject({ cooldownsAndCharges: { abilities: [], sharedSkills: [{
    actorId: "a", maxCharges: 2, availableCharges: 0, workerStartAgeTicks: 5,
    queue: [{ abilityId: "long", recoveryFrames: 50 }, { abilityId: "short", recoveryFrames: 30 }],
  }] } });
  expect(() => applyExecutionProfile(config, { ...IDEALIZED_EXECUTION_PROFILE, version: "1.0.0", baselineMode: "structural-v1" })).toThrow(/结构基线/);
});
