import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createKukiSkillScenario, deriveSourceBackedRotationMappings, getSourceActionContract, validateSourceBackedActionSequence } from "../source-action-library";
import { simulate } from "../simulator";
import { captureSimulationHit, replaySimulationHit } from "../calculator-bridge";

const measured = JSON.parse(readFileSync("docs/cross-validation/action-library/kuki-external-comparison.json", "utf8")) as {
  sampleTotalDamage: number;
  damage: Array<{actualFrame: number; actual: number}>;
  healing: Array<{actualFrame: number; actualReceiver: number; actualBase: number; actualOutgoingMultiplier: number; actualRawHealing: number; actualHPAfter: number; actualEffectiveHPGain: number; actualOverheal: number}>;
};

describe("Kuki real E source contract", () => {
  it("matches the one external fixed-source run for damage, real HP healing and owner A1, with exact calculator hit replay", () => {
    const config = createKukiSkillScenario();
    expect(validateSourceBackedActionSequence(config).status).toBe("valid");
    expect(deriveSourceBackedRotationMappings(config)?.aliases?.kuki?.E).toBe("kuki-skill-sanctifying-ring");
    const result = simulate(config, {execution: {captureHits: true, detailedTraces: true}});
    expect(result.damageEvents.map((row) => row.frame)).toEqual(measured.damage.map((row) => row.actualFrame));
    const replayDifferences: number[] = [];
    result.damageEvents.forEach((row, index) => {
      expect(row.finalDamage).toBeCloseTo(measured.damage[index]!.actual, 11);
      const replay = replaySimulationHit(captureSimulationHit(result, row.id));
      replayDifferences.push(replay.difference); expect(replay.difference).toBe(0);
    });
    expect(result.totalDamage).toBeCloseTo(measured.sampleTotalDamage, 11);
    const cost = result.playerHealthEvents!.find((row) => row.operation === "consume")!;
    expect(cost.frame).toBe(1); expect(cost.hpBefore).toBeCloseTo(15237.931506964002 * .5, 9);
    expect(cost.actualChange).toBeCloseTo(15237.931506964002 * .5 * .3, 9);
    const healing = result.playerHealthEvents!.filter((row) => row.operation === "heal");
    expect(healing.map((row) => row.frame)).toEqual(measured.healing.map((row) => row.actualFrame));
    healing.forEach((row, index) => {
      const source = measured.healing[index]!;
      expect(row.targetActorId).toBe(source.actualReceiver === 0 ? "kuki" : "amber");
      expect(row.baseAmount).toBeCloseTo(source.actualBase, 9);
      expect(row.bonusMultiplier).toBe(source.actualOutgoingMultiplier);
      expect(row.requestedAmount).toBeCloseTo(source.actualRawHealing, 9);
      expect(row.hpAfter).toBeCloseTo(source.actualHPAfter, 9);
      expect(row.actualChange).toBeCloseTo(source.actualEffectiveHPGain, 9);
      expect(row.overheal).toBeCloseTo(source.actualOverheal, 9);
    });
    expect(healing.map((row) => row.bonusMultiplier)).toEqual([1.15, 1.15, 1.15, 1.15, 1.15, 1.15, 1, 1]);
    expect(result.playerHpSummaries.find((row) => row.actorId === "kuki")!.finalHp).toBeCloseTo(10216.632688826016, 9);
    expect(result.totalPlayerDamageTaken).toBe(0); // E cost is consumption, not incoming damage.
    console.info("Kuki source comparison", JSON.stringify({localDamage: result.totalDamage, sourceDamage: measured.sampleTotalDamage, maximumHitDamageResidual: Math.max(...result.damageEvents.map((row, index) => Math.abs(row.finalDamage - measured.damage[index]!.actual))), maximumRawHealingResidual: Math.max(...healing.map((row, index) => Math.abs(row.requestedAmount - measured.healing[index]!.actualRawHealing))), maximumHpAfterResidual: Math.max(...healing.map((row, index) => Math.abs(row.hpAfter - measured.healing[index]!.actualHPAfter))), damageHitCount: result.damageEvents.length, healingCount: healing.length, maximumCalculatorReplayDifference: Math.max(...replayDifferences.map(Math.abs))}));
  });

  it("executes the sourced C2 duration and permits real initial HP, waiting and swaps while enforcing E/swap timing", () => {
    const config = createKukiSkillScenario(2);
    expect(getSourceActionContract(config)?.id).toBe("kuki-ring-c2-a6-t1-b4ae769-v1");
    if (config.playerDamageModel.mode !== "reaction-self-v1") throw Error();
    config.playerDamageModel.characters.find((row) => row.actorId === "kuki")!.initialHpRatio = .21;
    expect(validateSourceBackedActionSequence(config).status).toBe("valid");
    const result = simulate(JSON.parse(JSON.stringify(config)));
    expect(result.damageEvents).toHaveLength(11);
    expect(result.damageEvents.at(-1)!.frame).toBe(926);
    expect(result.playerHealthEvents!.filter((row) => row.operation === "heal")).toHaveLength(10);
    expect(result.playerHealthEvents![0]!.hpAfter).toBeCloseTo(15237.931506964002 * .2, 9);
    const earlySwap = createKukiSkillScenario(); earlySwap.timeline!.commands[1] = {type: "swap", characterId: "amber", atFrame: 12};
    expect(validateSourceBackedActionSequence(earlySwap).status).toBe("invalid");
    const cooldownSwap = createKukiSkillScenario(); cooldownSwap.timeline!.commands[2] = {type: "swap", characterId: "kuki", atFrame: 100};
    expect(validateSourceBackedActionSequence(cooldownSwap).issues.join()).toContain("60帧全队换人冷却");
    const recast = createKukiSkillScenario(); recast.duration = 32; recast.cycleLength = 32;
    recast.timeline!.commands.push({type: "wait", frames: 1}, {type: "skill", actorId: "kuki", abilityId: "kuki-skill-sanctifying-ring", atFrame: 908});
    expect(validateSourceBackedActionSequence(recast).status).toBe("valid");
    recast.timeline!.commands[4] = {type: "skill", actorId: "kuki", abilityId: "kuki-skill-sanctifying-ring", atFrame: 907};
    expect(validateSourceBackedActionSequence(recast).status).toBe("invalid");
  });
});
