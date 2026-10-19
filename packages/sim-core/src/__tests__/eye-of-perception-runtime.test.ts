import { expect, it } from "vitest";
import { simulationResultSchema } from "@genshin-dps-lab/schemas";
import { getWeaponProcDefinition, resolveEyeOfPerceptionDefinition } from "@genshin-dps-lab/reaction-formulas";
import { makeConfig } from "./fixtures";
import { simulate } from "../simulator";
import { captureSimulationHit, replaySimulationHit } from "../calculator-bridge";

it("runs the explicit archived Eye implementation through target selection, five queued hits, cooldown, and independent capture", () => {
  const catalog = getWeaponProcDefinition("eyeofperception")!;
  expect(catalog.coefficients[0]).toBe(2.4);
  expect(resolveEyeOfPerceptionDefinition(catalog, "gcsim-implementation-v1").coefficients[0]).toBe(2.1 * .3);
  const config = makeConfig({ duration: 13.5, cycleLength: 13.5,
    meta: { name: "固定实现昭心弹射合成场景", version: "1", verificationStatus: "user-supplied" },
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: Array.from({ length: 6 }, (_, index) =>
      ({ id: `enemy-${index}`, name: `敌人${index}`, position: { x: index * 3, y: 0 }, hitboxRadius: 0 })) },
    actorPoses: [{ actorId: "a", position: { x: -1, y: 0 }, facingDegrees: 0 }],
    weaponProcModel: { mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "a", weaponId: "eyeofperception",
      refinement: 1, physicalDamageBonus: 0, eyeOfPerceptionProfile: "gcsim-implementation-v1" }] },
    rotation: [], timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "normal", actorId: "a", name: "实际普攻命中", kind: "normal", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
        hits: [0, 720, 721].map(frame => ({ id: `hit-${frame}`, frame, scaling: 0, element: "physical" as const,
          attackTag: "normal" as const, targeting: { targetId: "enemy-0", outcome: "landed" as const } })) }],
      commands: [{ type: "normal", actorId: "a", abilityId: "normal", atFrame: 0 }] } });
  const result = simulate(config, { execution: { detailedTraces: true } });
  const normals = result.weaponProcLog!.filter(row => row.attackTag === "normal");
  expect(normals.map(row => [row.frame, row.outcome])).toEqual([[0, "triggered"], [720, "cooldown-blocked"], [721, "triggered"]]);
  expect(normals[0]).toMatchObject({ sourceProfileId: "gcsim-eye-of-perception-implementation-v1", coefficient: 2.1 * .3,
    cooldownFrames: 720, origin: { x: 0, y: 0 } });
  expect(normals[0]!.random).toBeUndefined();
  const firstChain = result.damageEvents.filter(row => row.weaponProcLogId === normals[0]!.id);
  expect(firstChain.map(row => [row.frame, row.targetId])).toEqual([10, 20, 30, 40, 50].map((frame, i) => [frame, `enemy-${i}`]));
  expect(firstChain.every(row => row.scaling === 2.1 * .3)).toBe(true);
  expect(result.damageEvents.filter(row => row.weaponProcLogId === normals[2]!.id)).toHaveLength(5);
  expect(replaySimulationHit(captureSimulationHit(result, firstChain[4]!.id)).difference).toBe(0);
  expect(simulationResultSchema.safeParse(result).success).toBe(true);

  const deadNearest = structuredClone(config);
  deadNearest.targetHealthModel = { mode: "declared-target-health-v1", externalDrops: [],
    targets: deadNearest.enemy.targets!.map((target, index) => ({ targetId: target.id, maxHp: 1_000_000,
      initialHp: index === 0 ? 0 : 1_000_000, sourceRef: "user-declared:eye-target-health", drops: [] })) };
  for (const hit of deadNearest.timeline!.abilities[0]!.hits!) hit.targeting = { targetId: "enemy-1", outcome: "landed" };
  const living = simulate(deadNearest);
  const livingFirst = living.weaponProcLog!.find(row => row.outcome === "triggered")!;
  expect(livingFirst.origin).toEqual({ x: 3, y: 0 });
  expect(living.damageEvents.filter(row => row.weaponProcLogId === livingFirst.id).map(row => row.targetId))
    .toEqual(["enemy-1", "enemy-2", "enemy-3", "enemy-4", "enemy-5"]);
  expect(simulationResultSchema.safeParse(living).success).toBe(true);
});
