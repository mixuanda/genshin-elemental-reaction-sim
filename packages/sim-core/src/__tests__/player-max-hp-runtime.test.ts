import { describe, expect, it } from "vitest";
import { migrateConfig, simulationResultSchema, type HealthChangeDefinition, type SimConfig } from "@genshin-dps-lab/schemas";
import { calculatePlayerMaxHpChange, PLAYER_MAX_HP_PROFILE } from "../player-max-hp";
import { calculateHealthChange } from "../player-health";
import { BOND_OF_LIFE_PROFILE } from "../bond-of-life";
import { evaluateFormulaExpression, type CalculationTraceNode } from "../calculation-trace";
import { simulate } from "../simulator";
import { repeatLegalTimelineForDuration } from "../simulation-analysis";
import { makeConfig } from "./fixtures";

const refs = [...PLAYER_MAX_HP_PROFILE.sourceRefs];
const change = (operation: "heal" | "consume" | "bond-add", amount: number): HealthChangeDefinition => ({
  id: operation, label: operation, frameOffset: 0, target: { kind: "self" }, source: { kind: "custom", note: "明确合成生命条件" },
  operation, amount: { basis: "fixed", value: amount }, ...(operation === "heal" ? { healingBonus: 0, incomingHealingBonus: 0 } : operation === "consume" ? { minimumHpRatio: 0 } : {}),
} as HealthChangeDefinition);
function fixture(): SimConfig {
  return makeConfig({ duration: 1, cycleLength: 1, playerMaxHpModel: { mode: PLAYER_MAX_HP_PROFILE.id },
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [{ id: "enemy-0", name: "合成目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    playerDamageModel: { mode: "reaction-self-v1", position: { x: 0, y: 0 }, hitboxRadius: .5, shieldMode: "crystallize-v1", zeroHpPolicy: "clamp-and-continue",
      characters: [{ actorId: "a", initialHpRatio: .5, resistances: { physical: 0, pyro: 0, hydro: 0, cryo: 0, electro: 0, dendro: 0, anemo: 0, geo: 0 } }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "resource", actorId: "a", name: "合成上限与生命动作", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0 }],
      commands: [{ type: "skill", actorId: "a", abilityId: "resource", atFrame: 0 }] },
  });
}
function verifyTrace(nodes: unknown[]): void {
  for (const opaque of nodes) {
    const node = opaque as CalculationTraceNode;
    expect(evaluateFormulaExpression(node.expression, Object.fromEntries(node.inputs.map(input => [input.key, input.value])))).toBe(node.result!.value);
  }
}

describe("explicit ratio-preserving dynamic maximum HP", () => {
  it("keeps HP ratio and raw debt while only nonzero later debt requests apply the new cap", () => {
    const reduced = calculatePlayerMaxHpChange({ hpBefore: 15000, maxHpBefore: 30000, maxHpAfter: 10000, statsAfter: { baseHp: 10000, hpPct: 0, flatHp: 0 }, bondOfLifeBefore: 30000 });
    expect(reduced).toMatchObject({ hpAfter: 5000, hpRatioBefore: .5, hpRatioAfter: .5, hpAdjustment: -10000, bondOfLifeAfter: 30000 });
    verifyTrace(reduced.trace);
    const context = { mode: BOND_OF_LIFE_PROFILE.id, debtBefore: reduced.bondOfLifeAfter! };
    for (const operation of [change("heal", 0), change("consume", 1)]) {
      expect(calculateHealthChange(operation, 5000, 10000, context).bondOfLife).toMatchObject({ debtAfter: 30000, sourceEventEmitted: false });
    }
    expect(calculateHealthChange(change("bond-add", 1), 5000, 10000, context).bondOfLife)
      .toMatchObject({ requestedDebtDelta: 1, actualDebtDelta: -10000, debtAfter: 20000, sourceCallbackAmount: 10000 });
  });

  it("replays team/self application, stacking, key replacement, expiry, healing and saved end state", () => {
    const config = fixture();
    config.characters.push({ ...structuredClone(config.characters[0]!), id: "b", name: "后台合成角色" });
    if (config.playerDamageModel.mode === "reaction-self-v1") config.playerDamageModel.characters.push({ ...structuredClone(config.playerDamageModel.characters[0]!), actorId: "b", initialHpRatio: .4 });
    config.bondOfLifeModel = { mode: BOND_OF_LIFE_PROFILE.id, characters: [{ actorId: "a", initialRatio: 2 }, { actorId: "b", initialRatio: 2 }] };
    config.timeline!.abilities[0]!.buffs = [
      { key: "vitality", target: "team", stat: "hpPct", value: 1, startFrame: 0, durationFrames: 30 },
      { key: "flat", target: "self", stat: "hpFlat", value: 5000, startFrame: 10, durationFrames: 30 },
      { key: "vitality", target: "self", stat: "hpPct", value: .5, startFrame: 20, durationFrames: 20 },
      { key: "vitality", target: "self", stat: "atkPct", value: .1, startFrame: 25, durationFrames: 20 },
    ];
    config.timeline!.abilities[0]!.healthChanges = [{ ...change("heal", 25000), frameOffset: 15 }];
    const result = simulate(config);
    expect(result.playerMaxHpEvents!.map(event => [event.frame, event.actorId, event.maxHpBefore, event.maxHpAfter])).toEqual([
      [0, "a", 10000, 20000], [0, "b", 10000, 20000], [10, "a", 20000, 25000], [20, "a", 25000, 20000], [25, "a", 20000, 15000], [30, "b", 20000, 10000], [40, "a", 15000, 10000],
    ]);
    expect(result.playerHealthEvents![0]).toMatchObject({ maxHp: 25000, hpBefore: 12500, hpAfter: 17500, actualChange: 5000, bondOfLife: { debtBefore: 20000, debtAfter: 0 } });
    expect(result.playerHpSummaries[0]).toMatchObject({ maxHp: 10000, finalMaxHp: 10000, initialHp: 5000, finalHp: 7000, totalHealing: 5000, totalMaxHpAdjustment: -3000, finalBondOfLife: 0 });
    expect(result.playerHpSummaries[1]).toMatchObject({ finalHp: 4000, totalMaxHpAdjustment: 0, finalBondOfLife: 20000 });
    for (const event of result.playerMaxHpEvents!) verifyTrace(event.trace);
    expect(simulationResultSchema.safeParse(JSON.parse(JSON.stringify(result))).success).toBe(true);
    expect(simulate(JSON.parse(JSON.stringify(config))).playerMaxHpEvents).toEqual(result.playerMaxHpEvents);
    const captured = simulate(repeatLegalTimelineForDuration(config, 4), { execution: { checkpointFrames: [20] } });
    expect(captured.executionAudit!.checkpointCoverage.complete).toBe(true);
    const state = captured.executionAudit!.phaseCheckpoints[0]!.state;
    expect(state.resourcesAndHp).toMatchObject({ hp: [{ actorId: "a", maxHp: 25000, currentHp: 17500, currentBondOfLife: 0 }, { actorId: "b", maxHp: 20000, currentHp: 8000, currentBondOfLife: 20000 }] });
    const pending = state.pendingEvents as { inFlight: Array<{ type: string; remainingTicks: number; payload: unknown }> };
    expect(pending.inFlight.filter(event => event.type === "playerMaxHpExpiry").map(event => event.remainingTicks)).toEqual([10, 20]);
    const forged = structuredClone(result); forged.playerMaxHpEvents![2]!.maxHpAfter += 1;
    expect(simulationResultSchema.safeParse(forged).success).toBe(false);
    const disabled = structuredClone(config); delete disabled.playerMaxHpModel;
    expect(() => migrateConfig(disabled)).toThrow(/playerMaxHpModel/);
  });

  it("expires before same-frame action conditions and periodic owner-HP healing", () => {
    const config = fixture(), ability = config.timeline!.abilities[0]!;
    ability.buffs = [{ key: "max", target: "self", stat: "hpPct", value: 1, startFrame: 0, durationFrames: 20 }];
    ability.hits = [{ id: "tick", frame: 0, element: "physical", snapshot: "hit", scaling: 0 }];
    ability.periodicEntities = [{ kind: "periodic-active-heal-v1", id: "pool", label: "合成周期治疗", spawnFrame: 0, durationFrames: 20, firstTickDelayFrames: 10, intervalFrames: 10, hitDelayFrames: 0, hitIds: ["tick"],
      healing: { ownerHpCoefficient: .1, flat: 0, ownerEmCoefficient: 0, healingBonus: 0, incomingHealingBonus: 0 }, sourceRefs: refs }];
    config.timeline!.abilities.push({ id: "condition", actorId: "a", name: "到期同帧声明条件", kind: "normal", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
      hits: [{ id: "branch", frame: 1, element: "physical", snapshot: "action", scaling: 1 }],
      conditionalHitGroups: [{ id: "condition", kind: "owner-hp-at-action-v1", comparison: "lte", thresholdRatio: .65, hitIds: ["branch"], sourceRefs: refs }] });
    config.timeline!.commands.push({ type: "normal", actorId: "a", abilityId: "condition", atFrame: 20 });
    const result = simulate(config);
    expect(result.playerMaxHpEvents!.at(-1)).toMatchObject({ frame: 20, cause: "buff-expire", eventPriority: -1, hpBefore: 12000, hpAfter: 6000 });
    expect(result.actionConditionLog![0]).toMatchObject({ frame: 20, ownerMaxHp: 10000, ownerCurrentHp: 6000, selected: true });
    expect(result.periodicEntityLog!.filter(row => row.operation === "tick").map(row => [row.frame, row.healing!.ownerMaxHp, row.healing!.baseHealing])).toEqual([[10, 20000, 2000], [20, 10000, 1000]]);
    expect(result.playerHpSummaries[0]).toMatchObject({ finalHp: 7000, finalMaxHp: 10000 });
    expect(simulationResultSchema.safeParse(JSON.parse(JSON.stringify(result))).success).toBe(true);
  });
});
