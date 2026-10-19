import { expect, it } from "vitest";
import { simulationResultSchema } from "./index";
import { simulate } from "../../sim-core/src/simulator";
import { makeConfig, neutralStats } from "../../sim-core/src/__tests__/fixtures";
import { captureSimulationHit, parseSimulationHit, replaySimulationHit, serializeSimulationHit } from "../../sim-core/src/calculator-bridge";

it("derives End of the Line activation from accepted skills and proves the third proc deletes its window without a fresh hit ICD", () => {
  const config = makeConfig({ duration: 13, cycleLength: 13,
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [{ id: "enemy-0", name: "目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    weaponProcModel: { mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "a", weaponId: "endoftheline", refinement: 1, physicalDamageBonus: 0 }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [
        { id: "e", actorId: "a", name: "合成 E", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
          hits: [{ id: "e-hit", frame: 1, scaling: 1, element: "physical", attackTag: "skill" }] },
        { id: "failed-e", actorId: "a", name: "能量不足的合成 E", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0, energyCost: 60 },
        { id: "n", actorId: "a", name: "合成普攻", kind: "normal", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
          hits: [{ id: "n-hit", frame: 0, scaling: 1, element: "physical", attackTag: "normal" }] },
      ], commands: [
        { type: "skill", actorId: "a", abilityId: "e", atFrame: 0 },
        { type: "skill", actorId: "a", abilityId: "failed-e", atFrame: 60 },
        ...[121, 122, 243, 244].map(atFrame => ({ type: "normal" as const, actorId: "a", abilityId: "n", atFrame })),
        { type: "skill", actorId: "a", abilityId: "e", atFrame: 300 },
        { type: "skill", actorId: "a", abilityId: "e", atFrame: 721 },
      ] } });
  const result = simulate(config, { critMode: "noCrit", randomSeed: "stateful-integrity" });
  const lifecycle = result.weaponProcLifecycleLog!;
  expect(result.skippedActions).toHaveLength(1);
  expect(lifecycle.map(row => [row.frame, row.outcome])).toEqual([[0, "window-activated"], [300, "activation-cooldown-blocked"], [721, "window-activated"]]);
  const triggers = result.weaponProcLog!.filter(row => row.outcome === "triggered");
  expect(triggers.map(row => [row.frame, row.stateAfter!.procCount])).toEqual([[1, 1], [122, 2], [243, 3], [722, 1]]);
  expect(triggers[2]!.stateAfter).toMatchObject({ effectExpiresFrame: null, hitCooldownExpiresFrame: 242, activationCooldownExpiresFrame: 720 });
  expect(result.weaponProcLog!.find(row => row.frame === 121)!.outcome).toBe("cooldown-blocked");
  expect(triggers.flatMap(row => row.damageEventIds).map(id => result.damageEvents[id]!.finalDamage)).toEqual([400, 400, 400, 400]);
  expect(result.totalDamage).toBe(7 * 1000 * .5 + 4 * (1000 * .8 * .5));
  const restored = simulationResultSchema.parse(JSON.parse(JSON.stringify(result)));
  const captured = captureSimulationHit(restored, triggers[2]!.damageEventIds[0]!);
  expect(replaySimulationHit(parseSimulationHit(serializeSimulationHit(captured))).difference).toBe(0);
  for (const mutate of [
    (copy: typeof result) => { copy.weaponProcLifecycleLog!.splice(0, 1); },
    (copy: typeof result) => { copy.weaponProcLifecycleLog![0]!.actionLogIndex = copy.actionLog.findIndex(row => row.sourceAbilityId === "n"); },
    (copy: typeof result) => { copy.weaponProcLog![triggers[2]!.id]!.stateAfter!.effectExpiresFrame = 900; },
    (copy: typeof result) => { copy.weaponProcLog![triggers[2]!.id]!.stateAfter!.procCount = 2; },
  ]) {
    const copy = structuredClone(result); mutate(copy);
    expect(simulationResultSchema.safeParse(copy).success).toBe(false);
  }
});

it("activates Crescent Pike only for the actual pickup front character and preserves its inclusive off-field hit window", () => {
  const characters = ["a", "b"].map(id => ({ id, name: id, element: "pyro" as const, color: "#ff0000", level: 90,
    energyMax: 60, initialEnergy: 60, stats: { ...neutralStats } }));
  const config = makeConfig({ duration: 6, cycleLength: 6, characters,
    enemy: { level: 90, resistance: 0, defReduction: 0 },
    weaponProcModel: { mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "a", weaponId: "crescentpike", refinement: 1, physicalDamageBonus: 0 }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "b", swapFrames: 1,
      abilities: [
        { id: "b-e", actorId: "b", name: "后台领取能量不激活", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
          particles: [{ id: "b-particle", element: "pyro", count: 1, spawnFrame: 0, travelFrames: 1 }],
          energyGains: [{ amount: 2, frame: 2, target: "team" }] },
        { id: "a-e", actorId: "a", name: "实际满能拾取", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
          particles: [{ id: "a-particle", element: "pyro", count: 1, spawnFrame: 0, travelFrames: 1 }] },
        { id: "a-n", actorId: "a", name: "合成延迟命中", kind: "normal", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
          hits: [10, 299, 300].map((frame, index) => ({ id: `a-n-${index}`, frame, scaling: 1, element: "physical" as const, attackTag: "normal" as const })) },
      ], commands: [
        { type: "skill", actorId: "b", abilityId: "b-e", atFrame: 0 },
        { type: "swap", characterId: "a", atFrame: 3 },
        { type: "skill", actorId: "a", abilityId: "a-e", atFrame: 5 },
        { type: "normal", actorId: "a", abilityId: "a-n", atFrame: 7 },
        { type: "swap", characterId: "b", atFrame: 8 },
      ] } });
  const result = simulate(config, { critMode: "noCrit", randomSeed: "stateful-pickup" });
  expect(result.weaponProcLifecycleLog!.map(row => [row.frame, row.kind, row.activeCharacterId, row.outcome])).toEqual([
    [1, "particle-received", "b", "off-field"], [6, "particle-received", "a", "window-activated"],
  ]);
  expect(result.energyLog.filter(row => row.kind === "particle" && row.receiverId === "a").map(row => row.gainedEnergy)).toEqual([0, 0]);
  const triggers = result.weaponProcLog!.filter(row => row.outcome === "triggered");
  expect(triggers.map(row => [row.frame, row.activeCharacterId, row.cooldownExpiresFrameAfter])).toEqual([[17, "b", null], [306, "b", null]]);
  expect(result.weaponProcLog!.find(row => row.frame === 307 && row.attackTag === "normal")!.outcome).toBe("window-inactive");
  expect(result.totalDamage).toBe(3 * 1000 * .5 + 2 * (1000 * .2 * .5));
  simulationResultSchema.parse(JSON.parse(JSON.stringify(result)));
  for (const mutate of [
    (copy: typeof result) => { copy.weaponProcLifecycleLog![0]!.outcome = "window-activated"; copy.weaponProcLifecycleLog![0]!.stateAfter.effectExpiresFrame = 301; },
    (copy: typeof result) => { copy.weaponProcLifecycleLog![1]!.particleEventId = 0; },
  ]) {
    const copy = structuredClone(result); mutate(copy);
    expect(simulationResultSchema.safeParse(copy).success).toBe(false);
  }
});
