import { expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";
import { captureSimulationHit, parseSimulationHit, serializeSimulationHit, replaySimulationHit } from "../calculator-bridge";

/** One module-level fixture prepared for the coordinated regression batch.
 * This source increment intentionally does not execute it. */
it("uses actual burst, zero-count pickup, elemental callback and kill events for equipment energy and shared-E reset", () => {
  const config = makeConfig({ duration: 7, cycleLength: 7,
    meta: { name: "声明场景：四套圣遗物事件综合回归", version: "1", verificationStatus: "user-supplied" },
    enemy: { level: 90, resistance: 0, defReduction: 0,
      targets: ["enemy-0", "enemy-1", "enemy-2"].map(id => ({ id, name: id })) },
    characters: ["a", "b", "c", "d"].map(id => ({ id, name: id, element: "pyro" as const,
      color: "#dd4444", level: 90, energyMax: 60, initialEnergy: 0, stats: { ...neutralStats, energyRecharge: 2 } })),
    artifactEventModel: { mode: "fixed-source-no-character-hitlag-v1", actors: [
      { actorId: "a", effectId: "exile-4pc" }, { actorId: "b", effectId: "scholar-4pc" },
      { actorId: "c", effectId: "scroll-2pc" }, { actorId: "d", effectId: "gambler-4pc" },
    ], partyWeaponTypes: [
      { actorId: "a", weaponType: "sword" }, { actorId: "b", weaponType: "catalyst" },
      { actorId: "c", weaponType: "bow" }, { actorId: "d", weaponType: "polearm" },
    ] },
    nightsoulBurstModel: { mode: "fixed-source-no-character-hitlag-v1", natlanActorIds: ["c"] },
    targetHealthModel: { mode: "declared-target-health-v1", externalDrops: [], targets: ["enemy-0", "enemy-1"].map(targetId => ({
      targetId, maxHp: 100, initialHp: 100, sourceRef: "user-declared:module-fixture", drops: [],
    })) },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "wait", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [
        { id: "q", actorId: "a", name: "显式大招事件", kind: "burst", cooldownFrames: 0, cancelFrame: 0, animationEndFrame: 0,
          particles: [{ id: "actual-zero-pickup", element: "neutral", count: 0, kind: "particle", spawnFrame: 70, travelFrames: 0 }] },
        { id: "elemental", actorId: "b", name: "普通元素命中", kind: "normal", cooldownFrames: 0, cancelFrame: 0, animationEndFrame: 0,
          hits: [{ id: "elemental-hit", frame: 1, scaling: 1, element: "pyro", targeting: { targetId: "enemy-2", outcome: "landed" } }] },
        ...["enemy-0", "enemy-1"].map((targetId, index) => ({ id: `e${index}`, actorId: "d", name: `同槽战技${index}`,
          kind: "skill" as const, cooldownFrames: 300, cooldownStartFrame: 0, maxCharges: 1, cancelFrame: 0, animationEndFrame: 0,
          hits: [{ id: `e${index}-hit`, frame: 1, scaling: 1, element: "physical" as const, targeting: { targetId, outcome: "landed" as const } }] })),
      ], commands: [
        { type: "burst", actorId: "a", abilityId: "q", atFrame: 0 },
        { type: "swap", characterId: "b", atFrame: 60 },
        { type: "normal", actorId: "b", abilityId: "elemental", atFrame: 100 },
        { type: "swap", characterId: "d", atFrame: 140 },
        { type: "skill", actorId: "d", abilityId: "e0", atFrame: 150 },
        { type: "skill", actorId: "d", abilityId: "e1", atFrame: 152 },
      ] },
  });
  const result = simulate(config, { execution: { checkpointFrames: [350] } });
  expect(result.actionLog.filter(row => row.actorId === "d" && row.sourceAbilityId !== undefined).map(row => row.frame)).toEqual([150, 152]);
  expect(result.artifactEventLog!.filter(row => row.kind === "target-died").map(row => [row.frame, row.outcome])).toEqual([
    [151, "skill-reset"], [153, "cooldown-blocked"],
  ]);
  expect(result.artifactEventLog!.filter(row => row.kind === "exile-tick")).toHaveLength(9);
  expect(result.nightsoulBurstLog!.map(row => [row.frame, row.outcome])).toEqual([[101, "triggered"]]);
  expect(result.energyLog.filter(row => row.artifactEventLogId !== undefined).every(row => row.energyRecharge === 1 && row.rawEnergy === row.finalEnergy)).toBe(true);
  expect(Object.fromEntries(Object.entries(result.energyStats).map(([actorId, value]) => [actorId, value.final]))).toEqual({ a: 0, b: 9, c: 15, d: 6 });
  expect(result.skillCooldownLog!.filter(row => row.artifactEventLogId !== undefined).map(row => [row.frame, row.operation, row.stateAfter.availableCharges])).toEqual([[151, "reset", 1]]);
  const hit = result.damageEvents[0]!;
  expect(replaySimulationHit(parseSimulationHit(serializeSimulationHit(captureSimulationHit(result, hit.id)))).difference).toBe(0);
});
