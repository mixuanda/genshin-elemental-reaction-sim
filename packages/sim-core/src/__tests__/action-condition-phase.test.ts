import { describe, expect, it } from "vitest";
import { migrateConfig, simulationResultSchema, type SimConfig } from "@genshin-dps-lab/schemas";
import { simulate } from "../simulator";
import { replaySimulationHit } from "../calculator-bridge";
import { evaluateFormulaExpression, type CalculationTraceNode } from "../calculation-trace";
import { makeConfig } from "./fixtures";

const sourceRefs = ["https://github.com/genshinsim/gcsim/blob/b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541/internal/characters/kuki/burst.go"];
function fixture(): SimConfig {
  const config = makeConfig({ duration: 5, cycleLength: 5, rotation: [], enemy: { level: 90, resistance: 0, defReduction: 0, targets: [{ id: "enemy-0", name: "目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] }, timeline: {
    mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
    abilities: [
      { id: "prepare", actorId: "a", name: "已有治疗与在途微粒", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
        particles: [{ id: "prior-particle", element: "electro", count: 1, spawnFrame: 0, travelFrames: 9 }],
        healthChanges: [{ id: "prior-heal", label: "同帧已有治疗", frameOffset: 9, operation: "heal", amount: { basis: "fixed", value: 1500 }, healingBonus: 0, incomingHealingBonus: 0, target: { kind: "self" }, source: { kind: "custom", note: "明确合成时序输入" } }] },
      { id: "burst", actorId: "a", name: "接受时锁定生命分支的合成Q", kind: "burst", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
        actionPhase: "after-frame-tasks-v1", energyCost: 60, energyCostFrame: 4,
        healthChanges: [{ id: "own-cost", label: "动作自产同帧效果", frameOffset: 0, operation: "consume", amount: { basis: "fixed", value: 2500 }, minimumHpRatio: 0, target: { kind: "self" }, source: { kind: "custom", note: "合成自耗血：证明取样先于自产效果" } }],
        conditionalHitGroups: [{ id: "low-hp", kind: "owner-hp-at-action-v1", comparison: "lte", thresholdRatio: 0.5, hitIds: ["q8", "q9", "q10", "q11", "q12"], sourceRefs }],
        hits: Array.from({ length: 12 }, (_, index) => ({ id: `q${index + 1}`, frame: 50 + index * 17, element: "electro" as const, scaling: 0.1, scalingStat: "hp" as const, snapshot: "action" as const })) },
    ], commands: [{ type: "skill", actorId: "a", abilityId: "prepare", atFrame: 1 }, { type: "burst", actorId: "a", abilityId: "burst", atFrame: 10 }] }
  });
  config.characters[0]!.element = "electro";
  config.characters[0]!.initialEnergy = 57;
  config.playerDamageModel = { mode: "reaction-self-v1", position: { x: 0, y: 0 }, hitboxRadius: 0.5, shieldMode: "crystallize-v1", zeroHpPolicy: "clamp-and-continue", characters: [{ actorId: "a", initialHpRatio: 0.45,
    resistances: { pyro: 0, hydro: 0, electro: 0, cryo: 0, dendro: 0, anemo: 0, geo: 0, physical: 0 } }] };
  return config;
}

describe("accepted-action HP branches and explicit task-before-action phase", () => {
  it("receives existing same-frame healing/particles before eligibility, then freezes seven hits before own zero-offset effects", () => {
    const config = fixture();
    const result = simulate(config, { execution: { captureHits: true, checkpointFrames: [0] } });
    expect(result.actionLog[1]).toMatchObject({ frame: 10, energyBefore: 60, energyAfter: 60 });
    expect(result.energyCostLog!.map(row => [row.operation, row.frame])).toEqual([["reserve", 10], ["debit", 14]]);
    expect(result.actionConditionLog![0]).toMatchObject({ frame: 10, eventPriority: 8, ownerCurrentHp: 6000, ownerMaxHp: 10000, selected: false });
    expect(result.playerHealthEvents!.map(row => [row.changeId, row.frame, row.eventPriority, row.hpAfter])).toEqual([["prior-heal", 10, 2, 6000], ["own-cost", 10, 12, 3500]]);
    expect(result.damageEvents.map(row => row.hitId)).toEqual(["q1", "q2", "q3", "q4", "q5", "q6", "q7"]);
    expect(result.executionAudit!.checkpointCoverage.reasons.join(" ")).toContain("不足两次完整输入周期");
    const replay = replaySimulationHit({ schemaVersion: "calculator-event-v1", eventId: 0, sourceResult: JSON.parse(JSON.stringify(result)) });
    expect(replay.difference).toBe(0);
    expect(replay.actionConditions?.[0]?.selected).toBe(false);
    expect(replay.trace.slice(0, 2).map(node => node.id)).toEqual(["action-condition.low-hp.threshold", "action-condition.low-hp.selected"]);
    for (const opaque of result.actionConditionLog![0]!.trace) {
      const node = opaque as CalculationTraceNode;
      expect(evaluateFormulaExpression(node.expression, Object.fromEntries(node.inputs.map(input => [input.key, input.value])))).toBe(node.result!.value);
    }
    expect(simulate(JSON.parse(JSON.stringify(config)), { execution: { captureHits: true, checkpointFrames: [0] } }).actionConditionLog).toEqual(result.actionConditionLog);
  });

  it("locks twelve hits at <=50% despite subsequent healing and preserves their original action snapshot/replay", () => {
    const config = fixture();
    config.characters[0]!.initialEnergy = 60;
    if (config.playerDamageModel.mode === "reaction-self-v1") config.playerDamageModel.characters[0]!.initialHpRatio = 0.5;
    config.timeline!.abilities[0]!.healthChanges![0]!.frameOffset = 10;
    config.timeline!.abilities[1]!.healthChanges = [];
    const result = simulate(config, { execution: { captureHits: true } });
    expect(result.actionConditionLog![0]).toMatchObject({ ownerCurrentHp: 5000, selected: true });
    expect(result.playerHealthEvents![0]).toMatchObject({ frame: 11, hpAfter: 6500 });
    expect(result.damageEvents).toHaveLength(12);
    expect(result.damageEvents.at(-1)).toMatchObject({ hitId: "q12", frame: 247, snapshot: "action" });
    const replay = replaySimulationHit({ schemaVersion: "calculator-event-v1", eventId: 11, sourceResult: result });
    expect(replay.difference).toBe(0);
    expect(replay.actionConditions?.[0]?.ownerCurrentHp).toBe(5000);
    const forged = structuredClone(result);
    forged.actionConditionLog![0]!.selected = false;
    expect(simulationResultSchema.safeParse(forged).success).toBe(false);
  });

  it("keeps undeclared action ordering and failed-input behavior, and rejects the new fields on old wire", () => {
    const legacyOrder = fixture();
    delete legacyOrder.timeline!.abilities[1]!.actionPhase;
    const oldResult = simulate(legacyOrder);
    expect(oldResult.timelineExecution!.commandResults[1]).toMatchObject({ status: "rejected", failureCode: "INSUFFICIENT_ENERGY", energyBefore: 57 });
    expect(oldResult.actionConditionLog).toEqual([]);
    expect(oldResult.damageEvents).toEqual([]);
    expect(oldResult.playerHealthEvents!.map(row => row.changeId)).toEqual(["prior-heal"]);
    const insufficient = fixture();
    insufficient.characters[0]!.initialEnergy = 0;
    const rejected = simulate(insufficient);
    expect(rejected.skippedActions[0]).toMatchObject({ reasonCode: "INSUFFICIENT_ENERGY", energyBefore: 3 });
    expect(rejected.actionConditionLog).toEqual([]);
    expect(rejected.energyCostLog).toEqual([]);
    expect(rejected.damageEvents).toEqual([]);
    expect(() => migrateConfig({ ...fixture(), schemaVersion: "1.52.0" })).toThrow(/actionPhase|conditionalHitGroups|healthChanges/);
    expect(() => simulate(fixture(), { compatibilityMode: "legacy-v0.1" })).toThrow(/actionPhase/);
  });
});
