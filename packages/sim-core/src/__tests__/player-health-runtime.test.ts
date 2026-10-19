import { describe, expect, it } from "vitest";
import { migrateConfig, simulationResultSchema, type HealthChangeDefinition, type SimConfig } from "@genshin-dps-lab/schemas";
import { simulate } from "../simulator";
import { evaluateFormulaExpression, type CalculationTraceNode } from "../calculation-trace";
import { calculateHealthChange } from "../player-health";
import { createNoelleBurstNormalScenario } from "../noelle-source-action";
import { makeConfig } from "./fixtures";
const source = { kind: "custom" as const, note: "合成动作明确值，仅验证生命执行，不声称某角色完整机制" };
const heal = (id: string, value: number, frameOffset = 0): HealthChangeDefinition => ({ id, label: id, frameOffset, target: { kind: "self" }, source, operation: "heal", amount: { basis: "fixed", value }, healingBonus: 0, incomingHealingBonus: 0 });
const consume = (id: string, value: number, frameOffset = 0): HealthChangeDefinition => ({ id, label: id, frameOffset, target: { kind: "self" }, source, operation: "consume", amount: { basis: "target-current-hp", value }, minimumHpRatio: 0.2 });
function fixture(changes: HealthChangeDefinition[]): SimConfig {
  const config = makeConfig({ duration: 1, cycleLength: 1, rotation: [],
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [{ id: "enemy-0", name: "目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "health", actorId: "a", name: "生命动作", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0, healthChanges: changes }],
      commands: [{ type: "skill", actorId: "a", abilityId: "health", atFrame: 0 }] } });
  config.playerDamageModel = { mode: "reaction-self-v1", position: { x: 0, y: 0 }, hitboxRadius: 0.5,
    shieldMode: "crystallize-v1", zeroHpPolicy: "clamp-and-continue", characters: [{ actorId: "a", initialHpRatio: 0.25,
      resistances: { pyro: 0, hydro: 0, electro: 0, cryo: 0, dendro: 0, anemo: 0, geo: 0, physical: 0 } }] };
  return config;
}
function checkAst(result: ReturnType<typeof simulate>): void {
  for (const event of result.playerHealthEvents!) for (const opaque of event.trace) {
    const node = opaque as CalculationTraceNode;
    expect(evaluateFormulaExpression(node.expression, Object.fromEntries(node.inputs.map(input => [input.key, input.value])))).toBe(node.result!.value);
    expect(node.symbolicFormula).toBeTruthy();
    expect(node.substitution).toBeTruthy();
    expect(node.explanationKey).toBeTruthy();
  }
}

describe("explicit actions share the real player HP state", () => {
  it("executes delayed healing, bonuses, overheal and nonlethal current/max/fixed consumption through AST", () => {
    const ratioHeal = { ...heal("ratio", 0.25, 1), amount: { basis: "target-max-hp" as const, value: 0.25 }, healingBonus: 0.2, incomingHealingBonus: 0.1 } as HealthChangeDefinition;
    const config = fixture([consume("current", 0.3), ratioHeal, heal("overheal", 6000, 2),
      { ...consume("max", 0.9, 3), amount: { basis: "target-max-hp", value: 0.9 } },
      { ...consume("fixed", 500, 4), amount: { basis: "fixed", value: 500 } }, heal("outside", 1000, 61)]);
    const result = simulate(config, { execution: { checkpointFrames: [0] } });
    expect(result.playerHealthEvents!.map(event => [event.frame, event.hpBefore, event.hpAfter, event.actualChange, event.overheal])).toEqual([
      [0, 2500, 2000, 500, 0], [1, 2000, 5250, 3250, 0], [2, 5250, 10000, 4750, 1250], [3, 10000, 2000, 8000, 0], [4, 2000, 2000, 0, 0],
    ]);
    expect(result.playerHpSummaries[0]).toMatchObject({ initialHp: 2500, finalHp: 2000, totalHealing: 8000, totalOverheal: 1250, totalHpConsumed: 8500, totalHpDamage: 0 });
    expect(result.totalDamage).toBe(0);
    expect(result.totalPlayerDamageTaken).toBe(0);
    expect(result.executionAudit!.checkpointCoverage.complete).toBe(false);
    expect(result.executionAudit!.checkpointCoverage.reasons.join(" ")).toContain("延迟任务");
    expect(calculateHealthChange(consume("below-floor", 0.3), 1000, 10000).actualChange).toBe(0);
    checkAst(result);
    expect(simulationResultSchema.parse(JSON.parse(JSON.stringify(result))).playerHealthEvents).toEqual(result.playerHealthEvents);
    expect(simulate(JSON.parse(JSON.stringify(config))).playerHealthEvents).toEqual(result.playerHealthEvents);
  });

  it("orders same-frame active/party healing and Burning self damage on one HP timeline", () => {
    const config = fixture([{ ...heal("active", 1000, 15), target: { kind: "active" } }, { ...heal("party", 100, 15), target: { kind: "party" } }, { ...consume("same-frame", 100, 15), amount: { basis: "fixed", value: 100 }, target: { kind: "active" } }]);
    config.characters.push({ ...structuredClone(config.characters[0]!), id: "b", name: "B" });
    if (config.playerDamageModel.mode === "reaction-self-v1") config.playerDamageModel.characters.push({ ...structuredClone(config.playerDamageModel.characters[0]!), actorId: "b" });
    config.reactionEngine = { mode: "aura-v5" };
    config.enemy.targets![0]!.initialAura = [{ element: "dendro", gaugeUnits: 1 }];
    config.timeline!.abilities[0]!.hits = [{ id: "pyro", frame: 0, element: "pyro", scaling: 0,
      geometry: { kind: "circle", coordinateSpace: "world", origin: { x: 0, y: 0 }, radius: 1 }, application: { gaugeUnits: 1, icd: { mode: "no-icd-v1" } } }];
    config.timeline!.commands.push({ type: "swap", characterId: "b", atFrame: 1 });
    const result = simulate(config);
    expect(result.playerHealthEvents!.map(event => [event.frame, event.targetActorId])).toEqual([[15, "b"], [15, "a"], [15, "b"], [15, "b"]]);
    expect(result.playerDamageEvents.length).toBeGreaterThan(0);
    const firstDamage = result.playerDamageEvents[0]!;
    expect(firstDamage.frame).toBe(15);
    expect(firstDamage.hpResolution.currentHpBefore).toBe(3500);
    expect(result.playerHpTimeline.points.filter(point => point.frame === 15 && point.operation !== "initial").map(point => point.operation)).toEqual(["heal", "heal", "heal", "consume", "damage"]);
    for (const summary of result.playerHpSummaries) expect(summary.finalHp).toBeCloseTo(summary.initialHp + summary.totalHealing! - summary.totalHpConsumed! - summary.totalHpDamage, 9);
    checkAst(result);
    expect(simulationResultSchema.safeParse(JSON.parse(JSON.stringify(result))).success).toBe(true);
  });

  it("rejects malformed/old or forged health state, and failed actions never enqueue healing", () => {
    const config = fixture([heal("heal", 1000)]);
    config.timeline!.abilities[0]!.energyCost = 60;
    config.timeline!.abilities.push({ ...config.timeline!.abilities[0]!, id: "cooldown", cooldownFrames: 60, energyCost: 0 });
    config.timeline!.commands.push({ type: "skill", actorId: "a", abilityId: "cooldown", atFrame: 1 }, { type: "skill", actorId: "a", abilityId: "cooldown", atFrame: 2 });
    expect(() => simulate(config)).toThrow(/ABILITY_ON_COOLDOWN/);
    config.timeline!.commands.pop();
    const result = simulate(config);
    expect(result.skippedActions.map(row => row.reasonCode)).toEqual(["INSUFFICIENT_ENERGY"]);
    expect(result.timelineExecution!.commandResults[0]!.status).toBe("rejected");
    expect(result.playerHealthEvents!.map(event => event.frame)).toEqual([1]);
    const forged = JSON.parse(JSON.stringify(result));
    forged.playerHealthEvents[0].actualChange += 1;
    expect(simulationResultSchema.safeParse(forged).success).toBe(false);
    expect(() => migrateConfig({ ...config, schemaVersion: "1.52.0" })).toThrow(/healthChanges/);
    expect(() => migrateConfig({ ...config, playerDamageModel: { mode: "disabled" } })).toThrow(/healthChanges/);
    expect(() => migrateConfig({ ...config, duration: 1.001 })).toThrow(/frame|帧/);
    expect(() => simulate(config, { compatibilityMode: "legacy-v0.1" })).toThrow(/legacy-v0.1/);
    const dynamic = structuredClone(config);
    dynamic.timeline!.abilities[0]!.buffs = [{ stat: "hpPct", value: 0.2, durationFrames: 60 }];
    expect(() => migrateConfig(dynamic)).toThrow(/static max HP/);
    const aligned = fixture([]);
    delete aligned.timeline;
    aligned.characters.push({ ...structuredClone(aligned.characters[0]!), id: "b", name: "B" });
    if (aligned.playerDamageModel.mode === "reaction-self-v1") aligned.playerDamageModel.characters.push({ ...structuredClone(aligned.playerDamageModel.characters[0]!), actorId: "b" });
    aligned.rotation = [{ id: "first", actorId: "a", name: "延迟治疗", at: 5 / 60, once: true, healthChanges: [{ ...heal("active", 100, 1), target: { kind: "active" } }] },
      { id: "second", actorId: "b", name: "同帧换人", at: 6 / 60, once: true }];
    const alignedResult = simulate(aligned);
    expect(alignedResult.compatibilityMode).toBe("legal-frame-v1");
    expect(alignedResult.playerHealthEvents).toMatchObject([{ frame: 6, targetActorId: "b", hpBefore: 2500, hpAfter: 2600 }]);
    const baseline = fixture([]);
    delete baseline.timeline!.abilities[0]!.healthChanges;
    const oldResult = simulate(baseline);
    expect(oldResult.playerHealthEvents).toBeUndefined();
    expect(oldResult.playerHpSummaries[0]!.totalHealing).toBeUndefined();
    expect(simulationResultSchema.safeParse(JSON.parse(JSON.stringify(oldResult))).success).toBe(true);
    const sourceScenario = createNoelleBurstNormalScenario();
    sourceScenario.timeline!.abilities[0]!.healthChanges = [heal("fake", 1000)];
    expect(() => simulate(sourceScenario)).toThrow(/healthChanges|来源/);
  });
});
