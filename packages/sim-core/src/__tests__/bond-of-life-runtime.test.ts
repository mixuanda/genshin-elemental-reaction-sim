import { describe, expect, it } from "vitest";
import { simulationResultSchema, type HealthChangeDefinition, type SimConfig } from "@genshin-dps-lab/schemas";
import { calculateHealthChange } from "../player-health";
import { BOND_OF_LIFE_PROFILE } from "../bond-of-life";
import { evaluateFormulaExpression, type CalculationTraceNode } from "../calculation-trace";
import { simulate } from "../simulator";
import { repeatLegalTimelineForDuration } from "../simulation-analysis";
import { makeConfig } from "./fixtures";

const source = { kind: "custom" as const, note: "明确合成的通用生命资源条件，不认证角色治疗覆写" };
const common = (id: string, frameOffset: number) => ({ id, label: id, frameOffset, target: { kind: "self" as const }, source });
const heal = (id: string, amount: number, frameOffset = 0): HealthChangeDefinition => ({ ...common(id, frameOffset), operation: "heal", amount: { basis: "fixed", value: amount }, healingBonus: 0, incomingHealingBonus: 0 });
const debt = (id: string, operation: "bond-add" | "bond-remove", amount: number, frameOffset = 0): HealthChangeDefinition => ({ ...common(id, frameOffset), operation, amount: { basis: "fixed", value: amount } });
function fixture(changes: HealthChangeDefinition[]): SimConfig {
  const config = makeConfig({ duration: 1, cycleLength: 1, rotation: [],
    enemy: { level: 90, resistance: 0, defReduction: 0, targets: [{ id: "enemy-0", name: "目标", position: { x: 0, y: 0 }, hitboxRadius: 0 }] },
    bondOfLifeModel: { mode: BOND_OF_LIFE_PROFILE.id, characters: [{ actorId: "a", initialRatio: .2 }] },
    timeline: { mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
      abilities: [{ id: "health", actorId: "a", name: "明确生命动作", kind: "normal", cancelFrame: 0, animationEndFrame: 0, cooldownFrames: 0, healthChanges: changes }],
      commands: [{ type: "normal", actorId: "a", abilityId: "health", atFrame: 0 }] },
  });
  config.playerDamageModel = { mode: "reaction-self-v1", position: { x: 0, y: 0 }, hitboxRadius: .5, shieldMode: "crystallize-v1", zeroHpPolicy: "clamp-and-continue",
    characters: [{ actorId: "a", initialHpRatio: .5, resistances: { physical: 0, pyro: 0, hydro: 0, cryo: 0, electro: 0, dendro: 0, anemo: 0, geo: 0 } }] };
  return config;
}
function assertTrace(nodes: unknown[]): void {
  for (const opaque of nodes) {
    const node = opaque as CalculationTraceNode;
    expect(evaluateFormulaExpression(node.expression, Object.fromEntries(node.inputs.map(input => [input.key, input.value])))).toBe(node.result!.value);
  }
}

describe("explicit default-source Bond of Life resource", () => {
  it("executes cap, callback zero rules and healing remainder through the shared AST", () => {
    const context = { mode: BOND_OF_LIFE_PROFILE.id, debtBefore: 1500 };
    const boosted = { ...heal("boosted", 2000), healingBonus: .2, incomingHealingBonus: .3 } as HealthChangeDefinition;
    const result = calculateHealthChange(boosted, 4000, 10000, context);
    expect(result).toMatchObject({ requestedAmount: 3000, actualChange: 1500, hpAfter: 5500, overheal: 0,
      bondOfLife: { debtBefore: 1500, debtAfter: 0, absorbedHealing: 1500, healingAfterDebt: 1500, sourceCallbackAmount: 1500 } });
    assertTrace(result.trace);
    const over = calculateHealthChange(heal("over", 4000), 9000, 10000, { ...context, debtBefore: 1000 });
    expect(over).toMatchObject({ actualChange: 1000, overheal: 2000, bondOfLife: { absorbedHealing: 1000 } });
    const capped = calculateHealthChange(debt("cap", "bond-add", 10000), 4000, 10000, { ...context, debtBefore: 19000 });
    expect(capped).toMatchObject({ actualChange: 0, hpAfter: 4000, bondOfLife: { debtAfter: 20000, actualDebtDelta: 1000, sourceCallbackAmount: -1000 } });
    expect(calculateHealthChange(debt("nonzero-at-cap", "bond-add", 1), 4000, 10000, { ...context, debtBefore: 20000 }).bondOfLife)
      .toMatchObject({ actualDebtDelta: 0, sourceEventEmitted: true, sourceCallbackAmount: 0 });
    expect(calculateHealthChange(debt("zero", "bond-remove", 0), 4000, 10000, context).bondOfLife).toMatchObject({ sourceEventEmitted: false, debtAfter: 1500 });
    expect(() => calculateHealthChange(debt("missing", "bond-add", 1000), 4000, 10000)).toThrow(/生命之契/);
  });

  it("replays actual active/party transitions and end state independently after JSON import", () => {
    const config = fixture([
      { ...debt("grant", "bond-add", 1000), amount: { basis: "target-max-hp", value: .1 } },
      { ...heal("active", 2000, 3), target: { kind: "active" } },
      { ...heal("party", 1000, 4), target: { kind: "party" } },
      { ...common("consume", 4), operation: "consume", amount: { basis: "fixed", value: 500 }, minimumHpRatio: 0 },
      debt("remove", "bond-remove", 500, 5),
    ]);
    config.characters.push({ ...structuredClone(config.characters[0]!), id: "b", name: "第二合成角色" });
    if (config.playerDamageModel.mode === "reaction-self-v1") config.playerDamageModel.characters.push({ ...structuredClone(config.playerDamageModel.characters[0]!), actorId: "b" });
    config.bondOfLifeModel!.characters.push({ actorId: "b", initialRatio: .1 });
    config.timeline!.commands.push({ type: "swap", characterId: "b", atFrame: 1 });
    const result = simulate(config);
    expect(result.playerHealthEvents!.map(event => [event.frame, event.targetActorId, event.hpAfter, event.bondOfLife!.debtAfter])).toEqual([
      [0, "a", 5000, 3000], [3, "b", 6000, 0], [4, "a", 5000, 2000], [4, "b", 7000, 0], [4, "a", 4500, 2000], [5, "a", 4500, 1500],
    ]);
    expect(result.playerHpSummaries.map(row => [row.actorId, row.initialBondOfLife, row.finalBondOfLife, row.finalHp])).toEqual([["a", 2000, 1500, 4500], ["b", 1000, 0, 7000]]);
    expect(simulationResultSchema.parse(JSON.parse(JSON.stringify(result))).playerHealthEvents).toEqual(result.playerHealthEvents);
    expect(simulate(JSON.parse(JSON.stringify(config))).playerHpSummaries).toEqual(result.playerHpSummaries);
    for (const event of result.playerHealthEvents!) assertTrace(event.trace);
    const forged = structuredClone(result);
    forged.playerHealthEvents![2]!.bondOfLife!.debtBefore += 1;
    expect(simulationResultSchema.safeParse(forged).success).toBe(false);
    const forgedEnd = structuredClone(result);
    forgedEnd.playerHpSummaries[0]!.finalBondOfLife! += 1;
    expect(simulationResultSchema.safeParse(forgedEnd).success).toBe(false);
  });

  it("captures the real debt pool and pending heal across a periodic input boundary", () => {
    const config = fixture([debt("grant", "bond-add", 1000, 55), heal("delayed", 1000, 61)]);
    const result = simulate(repeatLegalTimelineForDuration(config, 4), { execution: { checkpointFrames: [60] } });
    expect(result.executionAudit!.checkpointCoverage).toMatchObject({ complete: true, reasons: [] });
    const point = result.executionAudit!.phaseCheckpoints[0]!;
    expect(point.state.resourcesAndHp).toMatchObject({ hp: [{ currentHp: 5000, currentBondOfLife: 3000 }] });
    const pending = (point.state.pendingEvents as { inFlight: Array<{ type: string; remainingTicks: number; payload: { change?: HealthChangeDefinition } }> }).inFlight;
    expect(pending.find(event => event.type === "healthChange" && event.payload.change?.id === "delayed")).toMatchObject({ remainingTicks: 1, payload: { change: { operation: "heal" } } });
    expect(result.playerHealthEvents!.find(event => event.frame === 61)).toMatchObject({ hpAfter: 5000, bondOfLife: { debtBefore: 3000, debtAfter: 2000, absorbedHealing: 1000 } });
    const empty = fixture([]);
    const initialized = simulate(empty);
    expect(initialized.playerHpSummaries[0]).toMatchObject({ initialBondOfLife: 2000, finalBondOfLife: 2000 });
    expect(simulationResultSchema.safeParse(JSON.parse(JSON.stringify(initialized))).success).toBe(true);
  });
});
