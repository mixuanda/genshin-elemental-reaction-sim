import { describe, expect, it } from "vitest";
import type { SimConfig, WeaponProcModel } from "@genshin-dps-lab/schemas";
import { makeConfig } from "./fixtures";
import { simulate } from "../simulator";
import { IndependentWeaponProcRuntime } from "../weapon-proc";
import { captureSimulationHit, parseSimulationHit, replaySimulationHit, serializeSimulationHit } from "../calculator-bridge";
import { phaseCheckpointBlockers } from "../phase-checkpoint";

const noIcd = (gaugeUnits = 1) => ({ gaugeUnits, icd: { mode: "no-icd-v1" as const } });
const model = (weaponId: WeaponProcModel["actors"][number]["weaponId"]): WeaponProcModel => ({ mode: "fixed-source-no-character-hitlag-v1",
  actors: [{ actorId: "a", weaponId, refinement: 5, physicalDamageBonus: 0 }] });
function fixture(): SimConfig {
  return makeConfig({ duration: 1, cycleLength: 1,
    meta: { name: "明确合成的延期霜葬回调", version: "1", verificationStatus: "user-supplied" },
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [
      { id: "enemy-0", name: "原触发目标", position: { x: 0, y: 0 }, hitboxRadius: 0, initialAura: [{ element: "cryo", gaugeUnits: 1 }] },
      { id: "nearby", name: "带冰的第二目标", position: { x: 1, y: 0 }, hitboxRadius: 0, initialAura: [{ element: "cryo", gaugeUnits: 1 }] },
    ] }, reactionEngine: { mode: "aura-v3" }, weaponProcModel: model("frostbearer"),
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "source", actorId: "a", name: "同帧物理后火", kind: "normal", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
        hits: [{ id: "normal", frame: 10, scaling: 1, element: "physical", attackTag: "normal", targeting: { targetId: "enemy-0", outcome: "landed" } },
          { id: "pyro", frame: 10, scaling: 0, element: "pyro", attackTag: "skill", application: noIcd(2), targeting: { targetId: "enemy-0", outcome: "landed" } }] }],
      commands: [{ type: "normal", actorId: "a", abilityId: "source", atFrame: 0 }] } });
}

describe("five source-random independent weapon procs", () => {
  it("samples actual deferred callback Aura after another same-frame hit, fixes the whole AoE coefficient and preserves calculator replay", () => {
    const config = fixture();
    const result = simulate(config, { execution: { detailedTraces: true } });
    const parent = result.damageEvents.find(row => row.hitId === "normal")!;
    const consume = result.damageEvents.find(row => row.hitId === "pyro")!;
    const trigger = result.weaponProcLog!.find(row => row.outcome === "triggered")!;
    expect(parent.reactionAudit.auraAfter!.some(aura => aura.element === "cryo")).toBe(true);
    expect(trigger).toMatchObject({ frame: 10, coefficient: 1.4, triggerAura: { cryo: false, frozen: false },
      random: { rngStream: "independent-weapon-proc-v1", probability: 1, successComparison: "<", drawIndex: 0, drawCountAfter: 1 } });
    expect(trigger.eventSequence).toBeGreaterThan(consume.eventSequence);
    const children = result.damageEvents.filter(row => row.weaponProcLogId === trigger.id);
    expect(children.map(row => [row.frame, row.targetId, row.scaling, row.finalDamage])).toEqual([[11, "enemy-0", 1.4, 700], [11, "nearby", 1.4, 700]]);
    expect(children[1]!.reactionAudit.auraBefore!.some(aura => aura.element === "cryo")).toBe(true);
    expect(result.totalDamage).toBe(1900);
    expect(replaySimulationHit(parseSimulationHit(serializeSimulationHit(captureSimulationHit(result, children[1]!.id)))).difference).toBe(0);
    expect(result.weaponProcLog!.filter(row => row.attackTag === "proc").map(row => row.outcome)).toEqual(["cooldown-blocked", "cooldown-blocked"]);
    expect(phaseCheckpointBlockers(config, { weaponProcStateAvailable: true }).join(" ")).toContain("随机武器追击");
    expect(() => simulate(config, { compatibilityMode: "legacy-v0.1" })).toThrow(/legal-frame-v1/);
  });

  it("observes newly created Frozen at the callback, then keeps the selected multiplier after the target loses it before landing", () => {
    const config = fixture();
    config.weaponProcModel = model("dragonspinespear");
    config.enemy.targets![0]!.initialAura = [{ element: "hydro", gaugeUnits: 1 }];
    config.enemy.targets![1]!.initialAura = [];
    const hits = config.timeline!.abilities[0]!.hits!;
    hits[0] = { ...hits[0]!, element: "cryo", application: noIcd() };
    hits[1] = { ...hits[1]!, frame: 11, application: noIcd(4) };
    const result = simulate(config);
    const trigger = result.weaponProcLog!.find(row => row.outcome === "triggered")!;
    expect(trigger.triggerAura!.frozen).toBe(true);
    expect(trigger.coefficient).toBe(3.6);
    expect(trigger.random).toMatchObject({ probability: 1, drawCountBefore: 0, drawCountAfter: 1 });
    const consume = result.damageEvents.find(row => row.hitId === "pyro")!;
    expect(consume.reactionAudit.auraAfter!.some(aura => aura.element === "frozen" || aura.element === "cryo")).toBe(false);
    expect(result.damageEvents.filter(row => row.weaponProcLogId === trigger.id).map(row => [row.targetId, row.finalDamage])).toEqual([["enemy-0", 1800], ["nearby", 1800]]);
  });

  it("preserves Fillet's post-roll zero gate, Archaic's zero-damage trigger, source guard order and inclusive cooldown", () => {
    const input = { actorId: "a", frame: 0, parentDamageEventId: 0, targetId: "enemy-0", activeCharacterId: "a", attackTag: "normal" as const, damage: 0 };
    const fillet = new IndependentWeaponProcRuntime(model("filletblade"), "test-seed");
    expect(fillet.onDamage({ ...input, activeCharacterId: "b" })).toMatchObject({ outcome: "off-field", random: { drawCountAfter: 0, roll: null } });
    expect(fillet.onDamage(input)).toMatchObject({ outcome: "zero-damage", cooldownExpiresFrameAfter: null,
      random: { successComparison: "<=", roll: 0.036787065444514155, drawIndex: 0, drawCountAfter: 1 } });
    expect(fillet.onDamage({ ...input, damage: 500 })).toMatchObject({ outcome: "failed-roll", cooldownExpiresFrameAfter: null,
      random: { drawIndex: 1, drawCountAfter: 2 } });
    const archaic = new IndependentWeaponProcRuntime(model("prototypearchaic"), "test-seed");
    expect(archaic.onDamage({ ...input, attackTag: "skill" })).toMatchObject({ outcome: "wrong-attack-tag", random: { drawCountAfter: 0 } });
    expect(archaic.onDamage(input)).toMatchObject({ outcome: "triggered", damage: 0, coefficient: 4.8, cooldownExpiresFrameAfter: 900,
      random: { successComparison: "<", drawIndex: 0 } });
    expect(archaic.onDamage({ ...input, frame: 900, attackTag: "skill" })).toMatchObject({ outcome: "cooldown-blocked", random: { drawCountAfter: 1 } });
    expect(archaic.onDamage({ ...input, frame: 901 })).toMatchObject({ outcome: "failed-roll", random: { drawIndex: 1 } });
    const snow = new IndependentWeaponProcRuntime(model("snowtombedstarsilver"), "test-seed");
    expect(snow.onDamage(input, () => ({ cryo: false, frozen: true }))).toMatchObject({ outcome: "triggered", coefficient: 3.6,
      triggerAura: { cryo: false, frozen: true }, random: { probability: 1, drawCountAfter: 1 } });
  });
});
