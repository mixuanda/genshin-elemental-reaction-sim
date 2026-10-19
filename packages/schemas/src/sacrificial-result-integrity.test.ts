import { expect, it } from "vitest";
import { simulationResultSchema } from "./index";
import { simulate } from "../../sim-core/src/simulator";
import { makeConfig } from "../../sim-core/src/__tests__/fixtures";
import { captureSimulationHit, parseSimulationHit, replaySimulationHit, serializeSimulationHit } from "../../sim-core/src/calculator-bridge";

it("authenticates delayed two-charge consumption, one-charge reset, real recast and complete JSON queue evidence", () => {
  const config = makeConfig({ duration: 32, cycleLength: 32, rotation: [],
    enemy: { level: 90, resistance: 0, defReduction: 0 },
    sacrificialModel: { mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "a", weaponId: "sacrificialfragments", refinement: 5 }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "e", actorId: "a", name: "合成两层技能：采用砂糖来源时序", kind: "skill", cancelFrame: 56,
        animationEndFrame: 56, cooldownFrames: 900, cooldownStartFrame: 9, maxCharges: 2,
        hits: [{ id: "e-hit", frame: 42, scaling: 1, element: "physical", attackTag: "skill", snapshot: "action" }] }],
      commands: [1, 57, 113].map(atFrame => ({ type: "skill" as const, actorId: "a", abilityId: "e", atFrame })) } });
  const result = simulate(config, { randomSeed: "sacrificial-consumer-reference", critMode: "noCrit" });
  expect(result.timelineExecution!.commandResults.map(row => row.startFrame)).toEqual([1, 57, 113]);
  expect(result.sacrificialLog!.map(row => [row.frame, row.outcome, row.drawCountAfter])).toEqual([
    [43, "skill-ready", 0], [99, "triggered", 1], [155, "cooldown-blocked", 1],
  ]);
  expect(result.skillCooldownLog!.filter(row => row.operation === "recover").map(row => row.frame)).toEqual([999, 1899]);
  const reset = result.skillCooldownLog!.find(row => row.operation === "reset")!;
  expect(reset.stateBefore.availableCharges).toBe(0);
  expect(reset.stateAfter.availableCharges).toBe(1);
  expect(reset.stateAfter.queue.map(row => row.recoveryFrames)).toEqual([900]);
  // Every hit is an independent 100% ATK ordinary attack: 1000 × 1 × 0.5.
  expect(result.totalDamage).toBe(1500);
  const restored = simulationResultSchema.parse(JSON.parse(JSON.stringify(result)));
  const hit = captureSimulationHit(restored, restored.damageEvents[2]!.id);
  expect(replaySimulationHit(parseSimulationHit(serializeSimulationHit(hit))).difference).toBe(0);
  for (const mutate of [
    (copy: typeof result) => { delete copy.skillCooldownLog; },
    (copy: typeof result) => { copy.sacrificialLog![1]!.roll = 0.999; },
    (copy: typeof result) => { copy.skillCooldownLog!.find(row => row.operation === "reset")!.stateAfter.availableCharges = 2; },
    (copy: typeof result) => { copy.skillCooldownLog!.find(row => row.operation === "recover")!.frame = 910; },
  ]) {
    const copy = structuredClone(result);
    mutate(copy);
    expect(simulationResultSchema.safeParse(copy).success).toBe(false);
  }
});
