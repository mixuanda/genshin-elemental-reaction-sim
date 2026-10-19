import { describe, expect, it } from "vitest";
import { simulationResultSchema, migrateConfig, type HealthChangeDefinition, type SimConfig } from "@genshin-dps-lab/schemas";
import { simulate } from "../simulator";
import { calculateDamageTrace } from "../calculator-formula";
import { evaluateFormulaExpression, type CalculationTraceNode } from "../calculation-trace";
import { makeConfig } from "./fixtures";

const refs = ["https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/kuki/skill.go"];
const cost: HealthChangeDefinition = { id: "hp-cost", label: "声明耗血", frameOffset: 0, target: { kind: "self" }, source: { kind: "source", refs }, operation: "consume", amount: { basis: "target-current-hp", value: 0.3 }, minimumHpRatio: 0.2 };
function fixture(): SimConfig {
  const config = makeConfig({ duration: 6, cycleLength: 6, rotation: [],
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [{ id: "enemy-0", name: "目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "ring", actorId: "a", name: "合成周期声明：非完整角色契约", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
        healthChanges: [cost], hits: [
          { id: "initial", frame: 11, element: "electro", snapshot: "hit", scaling: 0.75712, flatSources: [{ stat: "em", multiplier: 0.25 }] },
          { id: "ring-hit", frame: 0, element: "electro", snapshot: "hit", scaling: 0.2524, flatSources: [{ stat: "em", multiplier: 0.25 }] },
        ], periodicEntities: [{ kind: "periodic-active-heal-v1", id: "ring-entity", label: "合成草轮", spawnFrame: 23, durationFrames: 180, firstTickDelayFrames: 90, intervalFrames: 90, hitDelayFrames: 2, hitIds: ["ring-hit"],
          healing: { ownerHpCoefficient: 0.03, flat: 100, ownerEmCoefficient: 0.75, healingBonus: 0, incomingHealingBonus: 0, lowHpBonus: { thresholdRatio: 0.5, bonus: 0.15 } }, sourceRefs: refs }] }],
      commands: [{ type: "skill", actorId: "a", abilityId: "ring", atFrame: 1 }] } });
  config.characters[0]!.element = "electro";
  config.characters[0]!.stats.em = 200;
  config.playerDamageModel = { mode: "reaction-self-v1", position: { x: 0, y: 0 }, hitboxRadius: 0.5,
    shieldMode: "crystallize-v1", zeroHpPolicy: "clamp-and-continue", characters: [{ actorId: "a", initialHpRatio: 0.5,
      resistances: { pyro: 0, hydro: 0, electro: 0, cryo: 0, dendro: 0, anemo: 0, geo: 0, physical: 0 } }] };
  return config;
}
function assertReplay(result: ReturnType<typeof simulate>): void {
  expect(simulationResultSchema.safeParse(JSON.parse(JSON.stringify(result))).success).toBe(true);
  for (const hit of result.executionAudit!.hits) if (hit.inputKind === "ordinary") expect(calculateDamageTrace(hit.input).finalDamage).toBe(result.damageEvents[hit.eventId]!.finalDamage);
  for (const row of result.playerHealthEvents!) for (const opaque of row.trace) {
    const node = opaque as CalculationTraceNode;
    expect(evaluateFormulaExpression(node.expression, Object.fromEntries(node.inputs.map(input => [input.key, input.value])))).toBe(node.result!.value);
  }
}

describe("real replaceable periodic healing entities", () => {
  it("reads owner HP/A1 and EM at actual ticks, heals the current character, and replays delayed hit inputs", () => {
    const config = fixture();
    config.characters.push({ ...structuredClone(config.characters[0]!), id: "b", name: "当前受治疗者" });
    if (config.playerDamageModel.mode === "reaction-self-v1") config.playerDamageModel.characters.push({ ...structuredClone(config.playerDamageModel.characters[0]!), actorId: "b", initialHpRatio: 0.1 });
    config.timeline!.abilities.push({ id: "change", actorId: "b", name: "明确两时刻环境变化", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
      buffs: [{ target: "a", stat: "em", value: 200, startFrame: 111, durationFrames: 100 }],
      healthChanges: [{ id: "heal-owner", label: "施放者升越半血", frameOffset: 199, target: { kind: "actor", actorId: "a" }, source: { kind: "custom", note: "明确合成环境治疗" }, operation: "heal", amount: { basis: "fixed", value: 1600 }, healingBonus: 0, incomingHealingBonus: 0 }] });
    config.timeline!.commands.push({ type: "swap", characterId: "b", atFrame: 2 }, { type: "skill", actorId: "b", abilityId: "change", atFrame: 4 });
    const result = simulate(config, { execution: { captureHits: true, checkpointFrames: [0] } });
    expect(result.playerHealthEvents![0]).toMatchObject({ frame: 1, hpBefore: 5000, hpAfter: 3500, operation: "consume" });
    const ticks = result.periodicEntityLog!.filter(row => row.operation === "tick");
    expect(ticks.map(row => [row.frame, row.healing!.ownerCurrentHp, row.healing!.ownerEm, row.healing!.baseHealing, row.healing!.healingBonus])).toEqual([[114, 3500, 200, 550, 0.15], [204, 5100, 400, 700, 0]]);
    expect(result.playerHealthEvents!.filter(row => row.periodicEntityLogId !== undefined).map(row => [row.frame, row.targetActorId, row.requestedAmount])).toEqual([[114, "b", 632.5], [204, "b", 700]]);
    expect(result.damageEvents.map(row => [row.frame, row.flat, row.finalDamage])).toEqual([[12, 50, 403.56], [116, 50, 151.2], [206, 100, 176.2]]);
    expect(result.periodicEntityLog!.at(-1)).toMatchObject({ operation: "expire", frame: 204 });
    expect(result.executionAudit!.checkpointCoverage.reasons.join(" ")).toContain("不足两次完整输入周期");
    assertReplay(result);
    expect(simulate(JSON.parse(JSON.stringify(config)), { execution: { captureHits: true } }).playerHealthEvents).toEqual(result.playerHealthEvents);
  });

  it("replaces the live generation without retracting queued damage and respects the final tick/window boundary", () => {
    const config = fixture();
    config.timeline!.commands.push({ type: "skill", actorId: "a", abilityId: "ring", atFrame: 92 });
    const result = simulate(config, { execution: { captureHits: true } });
    expect(result.periodicEntityLog!.map(row => [row.operation, row.frame, row.generation])).toEqual([
      ["spawn", 24, 0], ["tick", 114, 0], ["replace", 115, 1], ["cancelled-tick", 204, 0], ["tick", 205, 1], ["tick", 295, 1], ["expire", 295, 1],
    ]);
    expect(result.damageEvents.map(row => row.frame)).toEqual([12, 103, 116, 207, 297]);
    expect(result.playerHealthEvents!.filter(row => row.periodicEntityLogId !== undefined).map(row => row.frame)).toEqual([114, 205, 295]);
    assertReplay(result);
    const boundary = fixture();
    boundary.duration = 114 / 60;
    const ending = simulate(boundary);
    expect(ending.periodicEntityLog!.at(-1)).toMatchObject({ operation: "tick", frame: 114 });
    expect(ending.playerHealthEvents!.at(-1)).toMatchObject({ operation: "heal", frame: 114 });
    expect(ending.damageEvents.map(row => row.frame)).toEqual([12]);
    expect(() => migrateConfig({ ...config, schemaVersion: "1.52.0" })).toThrow(/periodicEntities|healthChanges/);
  });

  it("locks hit-confirm ICD before a 45% roll, preserves no-draw gates and feeds reproducible actual particles", () => {
    const config = fixture();
    config.duration = config.cycleLength = 16;
    const ability = config.timeline!.abilities[0]!;
    ability.periodicEntities![0]!.durationFrames = 720;
    ability.hits!.push({ ...structuredClone(ability.hits![1]!), id: "same-frame" });
    ability.periodicEntities![0]!.hitIds.push("same-frame");
    ability.particles = [{ id: "particle", element: "electro", count: 1, travelFrames: 100, trigger: { kind: "hit-confirm", hitIds: ["ring-hit", "same-frame"], probability: 0.45, internalCooldown: { key: "ring-icd", durationFrames: 12 } } }];
    const first = simulate(config, { randomSeed: "periodic-a", execution: { captureHits: true } });
    const second = simulate(config, { randomSeed: "periodic-b", execution: { captureHits: true } });
    expect(first.particleTriggerLog.filter(row => row.drawIndex !== null).map(row => row.drawIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(first.particleTriggerLog.filter(row => row.hitId === "same-frame").every(row => row.roll === null && row.blockedReason === "INTERNAL_COOLDOWN")).toBe(true);
    expect(first.particleTriggerLog[0]).toMatchObject({ frame: 116, blockedReason: "PROBABILITY_FAILED", roll: 0.8623988595791161, internalCooldownReadyFrame: 128 });
    expect(first.particleEvents.map(row => row.spawnFrame)).toEqual([296, 566, 656, 746]);
    expect(second.particleEvents.map(row => row.spawnFrame)).toEqual([116, 566]);
    expect(first.energyStats.a!.particleGained).toBe(12);
    expect(second.energyStats.a!.particleGained).toBe(6);
    assertReplay(first);
    expect(simulate(JSON.parse(JSON.stringify(config)), { randomSeed: "periodic-a", execution: { captureHits: true } }).particleTriggerLog).toEqual(first.particleTriggerLog);
    const corrupted = structuredClone(first);
    corrupted.particleTriggerLog[0]!.roll = 0;
    expect(simulationResultSchema.safeParse(corrupted).success).toBe(false);
  });
});
