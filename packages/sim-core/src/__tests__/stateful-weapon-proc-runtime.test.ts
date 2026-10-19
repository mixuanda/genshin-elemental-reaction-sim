import { describe, expect, it } from "vitest";
import { simulationResultSchema, type SimConfig, type WeaponProcModel } from "@genshin-dps-lab/schemas";
import { makeConfig, neutralStats } from "./fixtures";
import { simulate } from "../simulator";
import { captureSimulationHit, parseSimulationHit, replaySimulationHit, serializeSimulationHit } from "../calculator-bridge";

const model = (weaponId: WeaponProcModel["actors"][number]["weaponId"]): WeaponProcModel => ({ mode: "fixed-source-no-character-hitlag-v1",
  actors: [{ actorId: "a", weaponId, refinement: 5, physicalDamageBonus: 0 }] });
const base = (weaponId: WeaponProcModel["actors"][number]["weaponId"]): SimConfig => makeConfig({ duration: 65, cycleLength: 65,
  meta: { name: "明确合成的状态武器回调", version: "1", verificationStatus: "user-supplied" },
  enemy: { level: 90, resistance: 0, defReduction: 0, targets: [{ id: "enemy-0", name: "原触发目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
  weaponProcModel: model(weaponId) });

describe("actual stateful independent weapon hooks", () => {
  it("counts Flute's actual notes, preserves inclusive clocks and expiry refresh, and hits only the real four-unit circle", () => {
    const config = base("flute");
    config.enemy.targets!.push({ id: "edge", name: "四单位边缘", position: { x: 4, y: 0 }, hitboxRadius: 0 },
      { id: "outside", name: "范围外", position: { x: 4.01, y: 0 }, hitboxRadius: 0 });
    config.timeline = { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "notes", actorId: "a", name: "零伤害普攻真实音符", kind: "normal", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
        hits: [0, 30, 31, 62, 93, 124, 200, 2000, 3801].map(frame => ({ id: `n${frame}`, frame,
          scaling: 0, element: "physical", attackTag: "normal", targeting: { targetId: "enemy-0", outcome: "landed" } })) }],
      commands: [{ type: "normal", actorId: "a", abilityId: "notes", atFrame: 0 }] };
    const result = simulate(config);
    const normals = result.weaponProcLog!.filter(row => row.attackTag === "normal");
    expect(normals.map(row => [row.frame, row.outcome, row.stateAfter!.notes])).toEqual([
      [0, "note-gained", 1], [30, "cooldown-blocked", 1], [31, "note-gained", 2], [62, "note-gained", 3],
      [93, "note-gained", 4], [124, "triggered", 0], [200, "note-gained", 1], [2000, "note-gained", 2], [3801, "note-gained", 1],
    ]);
    expect(normals[5]!.stateAfter).toMatchObject({ effectExpiresFrame: null, hitCooldownExpiresFrame: 154 });
    expect(normals[7]!.stateAfter!.effectExpiresFrame).toBe(3800);
    const children = result.damageEvents.filter(row => row.weaponProcLogId !== undefined);
    expect(children.map(row => [row.frame, row.targetId, row.finalDamage])).toEqual([[125, "enemy-0", 1000], [125, "edge", 1000]]);
    expect(result.weaponProcLifecycleLog).toEqual([]);
    expect(replaySimulationHit(parseSimulationHit(serializeSimulationHit(captureSimulationHit(result, children[1]!.id)))).difference).toBe(0);
    const changed = structuredClone(result); changed.weaponProcLog![0]!.stateAfter!.notes = 2;
    expect(simulationResultSchema.safeParse(changed).success).toBe(false);
  });

  it("refreshes Debate Club from accepted skills and clears its real hit ICD, while a rejected energy request grants no window", () => {
    const config = base("debateclub"); config.duration = 18; config.cycleLength = 18;
    config.timeline = { mode: "legal-frame-v1", fps: 60, legalityMode: "wait", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "e", actorId: "a", name: "真实无能耗E", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0 },
        { id: "failed-e", actorId: "a", name: "不足能量的E请求", kind: "skill", energyCost: 1, cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0 },
        { id: "n", actorId: "a", name: "允许零伤害的普通命中", kind: "normal", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
          hits: [{ id: "normal", frame: 0, scaling: 0, element: "physical", attackTag: "normal" }] }],
      commands: [{ type: "normal", actorId: "a", abilityId: "n", atFrame: 0 }, { type: "skill", actorId: "a", abilityId: "e", atFrame: 1 },
        { type: "normal", actorId: "a", abilityId: "n", atFrame: 2 }, { type: "skill", actorId: "a", abilityId: "failed-e", atFrame: 50 },
        { type: "normal", actorId: "a", abilityId: "n", atFrame: 51 }, { type: "skill", actorId: "a", abilityId: "e", atFrame: 100 },
        { type: "normal", actorId: "a", abilityId: "n", atFrame: 101 }, { type: "normal", actorId: "a", abilityId: "n", atFrame: 1000 },
        { type: "normal", actorId: "a", abilityId: "n", atFrame: 1001 }] };
    const result = simulate(config);
    expect(result.weaponProcLifecycleLog!.map(row => [row.frame, row.outcome, row.stateAfter.effectExpiresFrame])).toEqual([[1, "window-activated", 901], [100, "window-activated", 1000]]);
    expect(result.weaponProcLifecycleLog![1]).toMatchObject({ stateBefore: { hitCooldownExpiresFrame: 182 }, stateAfter: { hitCooldownExpiresFrame: null } });
    expect(result.timelineExecution!.commandResults[3]).toMatchObject({ status: "rejected", failureCode: "INSUFFICIENT_ENERGY" });
    expect(result.weaponProcLog!.filter(row => row.attackTag === "normal").map(row => [row.frame, row.outcome])).toEqual([
      [0, "window-inactive"], [2, "triggered"], [51, "cooldown-blocked"], [101, "triggered"], [1000, "triggered"], [1001, "window-inactive"],
    ]);
    expect(result.damageEvents.filter(row => row.weaponProcLogId !== undefined).map(row => [row.frame, row.finalDamage])).toEqual([[3, 600], [102, 600], [1001, 600]]);
  });

  it("activates Pike on a real zero-count full-energy pickup, ignores fixed energy and off-field pickups, then procs off field without an extra ICD", () => {
    const config = base("crescentpike"); config.duration = 6; config.cycleLength = 6;
    config.characters[0]!.initialEnergy = 60;
    config.characters.push({ ...config.characters[0]!, id: "b", name: "后台持有者测试前台", stats: { ...neutralStats } });
    config.timeline = { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "source", actorId: "a", name: "实际拾取与后台普通命中", kind: "skill", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
        particles: [{ id: "zero-orb", count: 0, kind: "orb", element: "pyro", spawnFrame: 0, travelFrames: 2 }],
        energyGains: [{ amount: 1, frame: 1, target: "a" }],
        hits: [0, 2, 2, 5, 302, 303].map((frame, index) => ({ id: `normal-${index}`, frame, scaling: 1, element: "physical", attackTag: "normal" })) },
        { id: "b-particle", actorId: "b", name: "后台也会分到能量的实际拾取", kind: "normal", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
          particles: [{ id: "off-field-particle", count: 1, kind: "particle", element: "pyro", spawnFrame: 0, travelFrames: 0 }] }],
      commands: [{ type: "skill", actorId: "a", abilityId: "source", atFrame: 0 }, { type: "swap", characterId: "b", atFrame: 3 },
        { type: "normal", actorId: "b", abilityId: "b-particle", atFrame: 5 }] };
    const result = simulate(config);
    expect(result.weaponProcLifecycleLog!.map(row => [row.frame, row.kind, row.outcome, row.stateAfter.effectExpiresFrame])).toEqual([
      [2, "particle-received", "window-activated", 302], [5, "particle-received", "off-field", 302],
    ]);
    expect(result.energyStats.a!.final).toBe(60);
    expect(result.weaponProcLog!.filter(row => row.attackTag === "normal").map(row => [row.frame, row.activeCharacterId, row.outcome])).toEqual([
      [0, "a", "window-inactive"], [2, "a", "triggered"], [2, "a", "triggered"], [5, "b", "triggered"], [302, "b", "triggered"], [303, "b", "window-inactive"],
    ]);
    expect(result.damageEvents.filter(row => row.weaponProcLogId !== undefined).map(row => [row.frame, row.finalDamage])).toEqual([[3, 200], [3, 200], [6, 200], [303, 200]]);
    const event = result.damageEvents.find(row => row.weaponProcLogId !== undefined && row.frame === 6)!;
    expect(replaySimulationHit(captureSimulationHit(result, event.id)).difference).toBe(0);
  });
});
