import { describe, expect, it } from "vitest";
import type { SimConfig, WeaponProcModel } from "@genshin-dps-lab/schemas";
import { getWeaponProcDefinition } from "@genshin-dps-lab/reaction-formulas";
import { makeConfig } from "./fixtures";
import { simulate } from "../simulator";
import { repeatLegalTimelineForDuration } from "../simulation-analysis";
import { IndependentWeaponProcRuntime } from "../weapon-proc";
import { captureSimulationHit, parseSimulationHit, replaySimulationHit, serializeSimulationHit } from "../calculator-bridge";
import { abilityPendingHorizonTicks } from "../action-pending-horizon";
import { phaseCheckpointBlockers } from "../phase-checkpoint";

const model = (weaponId: "theviridescenthunt" | "swordofnarzissenkreuz", hasInnateArkhe = false): WeaponProcModel => ({
  mode: "fixed-source-no-character-hitlag-v1", actors: [{ actorId: "a", weaponId, refinement: 1, physicalDamageBonus: 0,
    ...(weaponId === "swordofnarzissenkreuz" ? { hasInnateArkhe } : {}) }],
});
function fixture(weaponId: "theviridescenthunt" | "swordofnarzissenkreuz"): SimConfig {
  const config = makeConfig({ duration: 5, cycleLength: 5,
    meta: { name: "明确合成的多段与延迟取样回调", version: "1", verificationStatus: "user-supplied" },
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [
      { id: "enemy-0", name: "原目标", position: { x: 0, y: 0 }, hitboxRadius: 0 },
      { id: "nearby", name: "旁及目标", position: { x: 1, y: 0 }, hitboxRadius: 0 },
    ] }, weaponProcModel: model(weaponId),
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "source", actorId: "a", name: "已声明普通攻击", kind: "normal", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0,
        hits: [{ id: "normal", frame: 10, scaling: 0, element: "physical", attackTag: "normal", targeting: { targetId: "enemy-0", outcome: "landed" } }] }],
      commands: [{ type: "normal", actorId: "a", abilityId: "source", atFrame: 0 }, { type: "swap", characterId: "b", atFrame: 11 }] },
  });
  config.characters.push({ ...structuredClone(config.characters[0]!), id: "b", name: "合成后台角色" });
  config.rotation = [];
  return config;
}
const replay = (result: ReturnType<typeof simulate>, eventId: number): number =>
  replaySimulationHit(parseSimulationHit(serializeSimulationHit(captureSimulationHit(result, eventId)))).difference;

describe("remaining fixed-source weapon lifecycles", () => {
  it("keeps nine Viridescent activation snapshots and centres after expiry/swap, and replays actual deliveries", () => {
    const config = fixture("theviridescenthunt");
    config.timeline!.abilities[0]!.buffs = [{ key: "activation-atk", target: "self", stat: "atkPct", value: 1, startFrame: 0, durationFrames: 11 }];
    config.enemy.targetMotions = [{ id: "motion", label: "明确目标移动", targetId: "nearby", startFrame: 12, endFrame: 20, endPosition: { x: 10, y: 0 } }];
    const result = simulate(config, { randomSeed: "test-seed", execution: { detailedTraces: true } });
    const trigger = result.weaponProcLog!.find(row => row.outcome === "triggered")!;
    const hits = result.damageEvents.filter(row => row.weaponProcLogId === trigger.id);
    expect(trigger).toMatchObject({ frame: 10, snapshotFrame: 10, damageFrame: 11, triggerSnapshot: { atkPct: 1 }, random: { probability: .5, drawCountAfter: 1 } });
    expect(hits.filter(row => row.targetId === "enemy-0").map(row => row.frame)).toEqual([11, 41, 71, 101, 131, 161, 191, 221, 251]);
    expect(hits.filter(row => row.targetId === "nearby").map(row => row.frame)).toEqual([11]);
    expect(hits.every(row => row.statsBeforeDamage.atkPct === 1)).toBe(true);
    expect(result.hitResolutionLog.filter(row => trigger.hitResolutionIds.includes(row.id))).toHaveLength(18);
    expect(replay(result, hits[0]!.id)).toBe(0);
    expect(replay(result, hits.at(-1)!.id)).toBe(0);
    expect(abilityPendingHorizonTicks(config.timeline!.abilities[0]!, config.weaponProcModel)).toBe(251);
    expect(phaseCheckpointBlockers(config, { weaponProcStateAvailable: true }).join(" ")).toContain("随机武器追击");
  });

  it("samples Sword only at its actual delayed task, captures pending state, and excludes innate Arkhe owners", () => {
    const config = fixture("swordofnarzissenkreuz");
    config.timeline!.abilities[0]!.buffs = [{ key: "delayed-atk", target: "self", stat: "atkPct", value: 1, startFrame: 12, durationFrames: 100 }];
    config.enemy.targetMotions = [{ id: "motion", label: "明确目标移动", targetId: "enemy-0", startFrame: 10, endFrame: 16, endPosition: { x: 10, y: 0 } }];
    config.enemy.targets![1]!.position = { x: 10, y: 0 };
    const result = simulate(config, { execution: { detailedTraces: true, checkpointFrames: [12, 16] } });
    const trigger = result.weaponProcLog![0]!;
    const hits = result.damageEvents.filter(row => row.weaponProcLogId === trigger.id);
    expect(trigger).toMatchObject({ frame: 10, snapshotFrame: 16, damageFrame: 16, origin: { x: 10, y: 0 }, triggerSnapshot: { atkPct: 1 } });
    expect(hits.map(row => [row.frame, row.targetId, row.activeCharacterId, row.finalDamage])).toEqual([[16, "enemy-0", "b", 1600], [16, "nearby", "b", 1600]]);
    expect(replay(result, hits[0]!.id)).toBe(0);
    expect(abilityPendingHorizonTicks(config.timeline!.abilities[0]!, config.weaponProcModel)).toBe(16);
    const pendingConfig = { ...structuredClone(config), duration: 1 };
    pendingConfig.timeline!.abilities[0]!.hits![0]!.frame = 55;
    pendingConfig.timeline!.commands[1] = { type: "swap", characterId: "b", atFrame: 56 };
    delete pendingConfig.enemy.targetMotions; // moving-target checkpoint support is independently blocked
    pendingConfig.cycleLength = 1;
    pendingConfig.timeline!.commands.push({ type: "swap", characterId: "a", atFrame: 58 });
    const checkpointRun = simulate(repeatLegalTimelineForDuration(pendingConfig, 4), { execution: { checkpointFrames: [57] } });
    expect(checkpointRun.executionAudit!.checkpointCoverage).toMatchObject({ complete: true, reasons: [] });
    const state = checkpointRun.executionAudit!.phaseCheckpoints[0]!.state as Record<string, any>;
    expect(state.pendingEvents.inFlight.find((row: any) => row.type === "weaponProcDelayedSnapshot")).toMatchObject({ remainingTicks: 4,
      payload: { actor: { hasInnateArkhe: false }, triggerAgeTicks: 2, coefficient: 1.6 } });
    const beforeTask = simulate(pendingConfig);
    expect(beforeTask.weaponProcLog![0]).toMatchObject({ snapshotFrame: 61, snapshotEventSequence: null, triggerSnapshot: null, triggerBuffStatuses: [], origin: null, damageEventIds: [] });
    const innate = simulate({ ...config, weaponProcModel: model("swordofnarzissenkreuz", true) });
    expect(innate.weaponProcLog).toEqual([]);
    const runtime = new IndependentWeaponProcRuntime(model("swordofnarzissenkreuz"));
    const input = { actorId: "a", frame: 10, parentDamageEventId: 0, targetId: "enemy-0", activeCharacterId: "a", attackTag: "normal" as const, damage: 0 };
    expect(runtime.onDamage(input).outcome).toBe("triggered");
    expect(runtime.onDamage({ ...input, frame: 730 }).outcome).toBe("cooldown-blocked");
    expect(runtime.onDamage({ ...input, frame: 731 }).outcome).toBe("triggered");
    expect(getWeaponProcDefinition("eyeofperception")!.sourceNotes?.join(" ")).toContain("50%");
  });

  it("preserves causal callback FIFO when a Sword task creates a hit after an already queued Viridescent callback", () => {
    const config = fixture("swordofnarzissenkreuz");
    config.weaponProcModel!.actors.push({ actorId: "b", weaponId: "theviridescenthunt", refinement: 1, physicalDamageBonus: 0 });
    config.timeline!.initialActiveCharacterId = "b";
    config.timeline!.abilities[0]!.hits![0]!.frame = 8;
    config.timeline!.abilities.push({ ...structuredClone(config.timeline!.abilities[0]!), id: "bow", actorId: "b", hits: [{ id: "bow-normal", frame: 16, scaling: 0, element: "physical", attackTag: "normal", targeting: { targetId: "enemy-0", outcome: "landed" } }] });
    config.timeline!.commands = [{ type: "normal", actorId: "b", abilityId: "bow", atFrame: 0 }, { type: "swap", characterId: "a", atFrame: 1 },
      { type: "normal", actorId: "a", abilityId: "source", atFrame: 2 }, { type: "swap", characterId: "b", atFrame: 11 }];
    const result = simulate(config, { randomSeed: "test-seed", execution: { detailedTraces: true } });
    const bow = result.weaponProcLog!.find(row => row.weaponId === "theviridescenthunt" && row.outcome === "triggered")!;
    const swordHit = result.damageEvents.find(row => row.weaponProcLogId === 0)!;
    expect(bow.frame).toBe(16);
    expect(bow.eventSequence).toBeLessThan(swordHit.eventSequence);
    expect(replay(result, swordHit.id)).toBe(0);
    const forged = structuredClone(result);
    forged.weaponProcLog![0]!.snapshotEventSequence = result.damageEvents.find(row => row.hitId === "bow-normal")!.eventSequence - 1;
    expect(() => captureSimulationHit(forged, swordHit.id)).toThrow();
  });
});
