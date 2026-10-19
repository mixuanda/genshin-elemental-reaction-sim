import { describe, expect, it } from "vitest";
import type { HitDefinition, SimConfig, SimulationResult, WeaponProcModel } from "@genshin-dps-lab/schemas";
import { simulate } from "../simulator";
import { captureSimulationHit, replaySimulationHit, serializeSimulationHit, parseSimulationHit } from "../calculator-bridge";
import { makeConfig, neutralStats } from "./fixtures";

const model = (weaponId: WeaponProcModel["actors"][number]["weaponId"], refinement = 1, physicalDamageBonus = 0): WeaponProcModel => ({
  mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "a", weaponId, refinement, physicalDamageBonus }],
});
const procEvents = (result: SimulationResult) => result.damageEvents.filter(event => event.weaponProcLogId !== undefined);
function base(weaponId: WeaponProcModel["actors"][number]["weaponId"]): SimConfig {
  const config = makeConfig({ duration: 16, cycleLength: 16,
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [{ id: "enemy-0", name: "合成中心目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    weaponProcModel: model(weaponId),
  });
  config.meta.verificationStatus = "user-supplied";
  return config;
}

describe("source-backed independent weapon damage runtime", () => {
  it("uses explicit Normal callbacks off field, zero damage and inclusive Halberd cooldown with its own snapshot and crit", () => {
    const config = base("halberd");
    config.weaponProcModel = model("halberd", 1, 0.5);
    config.characters[0]!.stats.dmgBonus = 0.1;
    config.characters.push({ ...config.characters[0]!, id: "b", name: "B", stats: { ...neutralStats } });
    const normal = (frame: number): HitDefinition => ({ id: `normal-${frame}`, offset: (frame - 1) / 60, scaling: 0, element: "physical",
      attackTag: "normal", critRate: 1, critDmg: 4, dmgBonus: 2, defIgnore: 0.8 });
    config.rotation = [
      { id: "fake-normal", actorId: "a", name: "普通攻击名字不是标签", at: 0,
        buffs: [{ key: "short-atk", target: "self", stat: "atkPct", value: 1, duration: 3 / 60 }],
        hits: [{ id: "untagged", offset: 0, scaling: 1, element: "physical", normalHitEnergyTag: "normal" }] },
      { id: "explicit-normal", actorId: "a", name: "明确普攻回调", at: 1 / 60, hits: [normal(2), normal(602), normal(603)] },
      { id: "switch", actorId: "b", name: "换至B", at: 2 / 60 },
    ];
    const result = simulate(config, { execution: { criticalSampling: "seeded-random-v1", detailedTraces: true } });
    const triggers = result.weaponProcLog!.filter(entry => entry.outcome === "triggered");
    expect(triggers.map(entry => [entry.frame, entry.activeCharacterId, entry.damage, entry.cooldownExpiresFrameAfter])).toEqual([[2, "b", 0, 602], [603, "b", 0, 1203]]);
    expect(result.weaponProcLog!.find(entry => entry.frame === 0)!.outcome).toBe("wrong-attack-tag");
    expect(result.weaponProcLog!.find(entry => entry.frame === 602)!.outcome).toBe("cooldown-blocked");
    const events = procEvents(result);
    expect(events.map(event => [event.frame, event.finalDamage])).toEqual([[3, 2560], [604, 1280]]);
    expect(events[0]).toMatchObject({ kind: "direct", element: "physical", scaling: 1.6, critRate: 0, critDmg: 0.5, defIgnore: 0, dmgBonus: 0.6 });
    expect(events[0]!.statsBeforeDamage.atkPct).toBe(1);
    expect(result.damageEvents[events[0]!.parentDamageEventId!]!.critRate).toBe(1);
    expect(result.executionAudit!.hits.find(hit => hit.eventId === events[0]!.id)!.critical.outcome).toBe("noncritical");
    const replay = replaySimulationHit(captureSimulationHit(result, events[0]!.id));
    expect(replay.difference).toBe(0);
    expect(replay.trace.length).toBeGreaterThan(5);
  });

  it("snapshots Ash-Graven maximum HP and selects actual targets within a fixed three-unit circle", () => {
    const config = base("ashgravendrinkinghorn");
    config.duration = 2; config.cycleLength = 2;
    config.weaponProcModel = model("ashgravendrinkinghorn", 1, 0.5);
    config.characters[0]!.stats.dmgBonus = 0.2;
    config.enemy.targets!.push(
      { id: "edge", name: "范围边缘", position: { x: 3, y: 0 }, hitboxRadius: 0, resistance: 0.5 },
      { id: "outside", name: "范围之外", position: { x: 4, y: 0 }, hitboxRadius: 0 },
    );
    config.rotation = [{ id: "skill", actorId: "a", name: "合成技能", at: 0,
      buffs: [{ key: "short-hp", target: "self", stat: "hpPct", value: 1, duration: 1 / 60 }],
      hits: [{ id: "host", offset: 0, scaling: 1, element: "pyro", attackTag: "skill", dmgBonus: 3, critRate: 1, critDmg: 4, defIgnore: 0.9 }],
    }];
    const result = simulate(config, { execution: { criticalSampling: "seeded-random-v1", detailedTraces: true } });
    const trigger = result.weaponProcLog!.find(entry => entry.outcome === "triggered")!;
    expect(trigger).toMatchObject({ coefficient: 0.4, scalingStat: "hp", frame: 0, damageFrame: 1, origin: { x: 0, y: 0 }, radius: 3, triggerSnapshot: { hpPct: 1 } });
    expect(trigger.hitResolutionIds).toHaveLength(3);
    expect(trigger.damageEventIds).toHaveLength(2);
    const events = procEvents(result);
    expect(events.map(event => [event.targetId, event.finalDamage])).toEqual([["enemy-0", 6800], ["edge", 3400]]);
    expect(result.hitResolutionLog[trigger.hitResolutionIds[2]!]!).toMatchObject({ targetId: "outside", landed: false, damageEventId: null });
    expect(events[0]!.statsBeforeDamage.hpPct).toBe(1);
    expect(replaySimulationHit(captureSimulationHit(result, events[1]!.id)).difference).toBe(0);
  });

  it("uses Sequence of Solitude's on-field filter and its own 900-frame inclusive clock", () => {
    const config = base("sequenceofsolitude");
    config.weaponProcModel = model("sequenceofsolitude", 5);
    config.characters.push({ ...config.characters[0]!, id: "b", name: "B", stats: { ...neutralStats } });
    config.rotation = [
      { id: "hp-probe", actorId: "a", name: "明确合成技能", at: 0, hits: [0, 2, 900, 901].map(frame => ({ id: `h${frame}`, offset: frame / 60, scaling: 0, element: "physical", attackTag: "skill" as const })) },
      { id: "off-field", actorId: "b", name: "B上场", at: 2 / 60 },
      { id: "return", actorId: "a", name: "A回场", at: 900 / 60 },
    ];
    const result = simulate(config, { execution: { detailedTraces: true } });
    expect(result.weaponProcLog!.filter(entry => entry.outcome === "triggered").map(entry => [entry.frame, entry.coefficient])).toEqual([[0, 0.8], [901, 0.8]]);
    expect(result.weaponProcLog!.find(entry => entry.frame === 2)!.outcome).toBe("off-field");
    expect(result.weaponProcLog!.find(entry => entry.frame === 900)!.outcome).toBe("cooldown-blocked");
    expect(procEvents(result).map(event => [event.frame, event.finalDamage])).toEqual([[1, 4000], [902, 4000]]);
    const captured = parseSimulationHit(serializeSimulationHit(captureSimulationHit(result, procEvents(result)[1]!.id)));
    expect(replaySimulationHit(captured).difference).toBe(0);
  });

  it("rejects forged proc lineage and incomplete observation windows while leaving the disabled wire unchanged", () => {
    const config = base("halberd"); config.duration = 2; config.cycleLength = 2;
    config.rotation = [{ id: "normal", actorId: "a", name: "明确普攻", at: 0, hits: [{ offset: 0, scaling: 1, element: "physical", attackTag: "normal" }] }];
    const result = simulate(config, { execution: { detailedTraces: true, checkpointFrames: [0] } });
    expect(result.executionAudit!.checkpointCoverage.complete).toBe(false);
    expect(result.executionAudit!.checkpointCoverage.reasons.join()).toContain("不足两次完整输入周期");
    const captured = captureSimulationHit(result, procEvents(result)[0]!.id);
    const forged = structuredClone(captured);
    forged.sourceResult.damageEvents[captured.eventId]!.parentDamageEventId = captured.eventId;
    expect(() => replaySimulationHit(forged)).toThrow();
    const without = structuredClone(config); delete without.weaponProcModel;
    const disabled = simulate(without);
    expect(disabled.weaponProcLog).toBeUndefined();
    expect(disabled.damageEvents).toHaveLength(1);
  });
});
