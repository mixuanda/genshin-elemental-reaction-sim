import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { simulationResultSchema } from "@genshin-dps-lab/schemas";
import { createKukiSkillBurstScenario, deriveSourceBackedRotationMappings, getSourceActionContract, validateSourceBackedActionSequence } from "../source-action-library";
import { simulate } from "../simulator";
import { captureSimulationHit, replaySimulationHit } from "../calculator-bridge";

const measured = JSON.parse(readFileSync("docs/cross-validation/action-library/kuki-eq-same-frame.comparison.json", "utf8")) as {
  hits: Array<{frame: number; kind: "skill" | "burst"; damage: number}>;
  heals: Array<{frame: number; hpAfter: number; raw: number}>;
  sameFrame564: {hpBeforeHeal: number; hpAfterHeal: number};
  totals: {totalDamage: number};
};
const burstId = "kuki-burst-gyoei-narukami";
const expectedSingleHit = 12288.654441100001 * 1.24 * .036048 * (190 / 380) * .9;

describe("Kuki E/Q actual-cast source contract", () => {
  it("matches the one external same-frame run: prior ring healing selects seven Q hits, delayed energy and calculator replay", () => {
    const config = createKukiSkillBurstScenario();
    expect(validateSourceBackedActionSequence(config).status).toBe("valid");
    expect(deriveSourceBackedRotationMappings(config)?.aliases?.kuki?.Q).toBe(burstId);
    const result = simulate(JSON.parse(JSON.stringify(config)), {execution: {captureHits: true, detailedTraces: true}});
    expect(result.damageEvents.map((row) => row.frame)).toEqual(measured.hits.map((row) => row.frame));
    result.damageEvents.forEach((row, index) => expect(row.finalDamage).toBeCloseTo(measured.hits[index]!.damage, 11));
    expect(result.totalDamage).toBeCloseTo(measured.totals.totalDamage, 10);
    const heals = result.playerHealthEvents!.filter((row) => row.operation === "heal");
    expect(heals.map((row) => row.frame)).toEqual(measured.heals.map((row) => row.frame));
    heals.forEach((row, index) => { expect(row.hpAfter).toBeCloseTo(measured.heals[index]!.hpAfter, 9); expect(row.requestedAmount).toBeCloseTo(measured.heals[index]!.raw, 9); });
    const crossing = heals.find((row) => row.frame === 564)!;
    expect(crossing.hpBefore).toBeLessThan(crossing.maxHp * .5);
    expect(crossing.hpAfter).toBeGreaterThan(crossing.maxHp * .5);
    expect(result.actionConditionLog).toHaveLength(1);
    const decision = result.actionConditionLog![0]!;
    expect(decision).toMatchObject({groupId: "kuki-burst-low-hp", frame: 564, selected: false, eventPriority: 8});
    expect(decision.ownerCurrentHp).toBe(crossing.hpAfter);
    expect(decision.ownerCurrentHp).toBeCloseTo(measured.sameFrame564.hpAfterHeal, 9);
    expect(crossing.eventPriority).toBeLessThan(decision.eventPriority);
    expect(result.energyCostLog).toMatchObject([{operation: "reserve", frame: 564, energyBefore: 60, energyAfter: 60}, {operation: "debit", frame: 568, energyBefore: 60, energyAfter: 0}]);
    const burstHits = result.damageEvents.filter((row) => row.hitId.startsWith(burstId));
    expect(burstHits).toHaveLength(7);
    const replayResiduals: number[] = [];
    for (const hit of burstHits) {
      expect(hit.finalDamage).toBeCloseTo(expectedSingleHit, 11);
      const replay = replaySimulationHit(captureSimulationHit(result, hit.id));
      replayResiduals.push(replay.difference);
      expect(replay.difference).toBe(0);
      expect(replay.actionConditions?.[0]).toMatchObject({selected: false, ownerCurrentHp: crossing.hpAfter});
      expect(replay.trace.some((node) => node.id === "action-condition.kuki-burst-low-hp.selected")).toBe(true);
    }
    expect(simulationResultSchema.safeParse(JSON.parse(JSON.stringify(result))).success).toBe(true);
    console.info("Kuki E/Q source measurement", JSON.stringify({totalDamage: result.totalDamage, damageHits: result.damageEvents.length, burstHits: burstHits.length, healingCount: heals.length, maximumHitResidual: Math.max(...result.damageEvents.map((row, index) => Math.abs(row.finalDamage - measured.hits[index]!.damage))), maximumHpResidual: Math.max(...heals.map((row, index) => Math.abs(row.hpAfter - measured.heals[index]!.hpAfter))), maximumReplayResidual: Math.max(...replayResiduals.map(Math.abs))}));
  });

  it("keeps C2 twelve hits when Q precedes healing, includes exactly 50% HP and skips the Q decision when energy is insufficient", () => {
    const config = createKukiSkillBurstScenario(2);
    config.timeline!.commands[3] = {type: "burst", actorId: "kuki", abilityId: burstId, atFrame: 563};
    expect(getSourceActionContract(config)?.id).toBe("kuki-eq-c2-a6-t1-b4ae769-v1");
    expect(validateSourceBackedActionSequence(config).status).toBe("valid");
    const result = simulate(config, {execution: {captureHits: true}});
    const decision = result.actionConditionLog![0]!;
    expect(decision).toMatchObject({frame: 563, selected: true});
    expect(decision.ownerCurrentHp).toBeCloseTo(measured.sameFrame564.hpBeforeHeal, 9);
    expect(result.playerHealthEvents!.find((row) => row.frame === 564)!.hpAfter).toBeGreaterThan(decision.ownerMaxHp * .5);
    const hits = result.damageEvents.filter((row) => row.hitId.startsWith(burstId));
    expect(hits.map((row) => row.frame)).toEqual(Array.from({length: 12}, (_, index) => 613 + 17 * index));
    expect(hits.every((row) => row.snapshot === "action")).toBe(true);
    expect(hits.at(-1)!.finalDamage).toBeCloseTo(expectedSingleHit, 11);
    expect(result.damageEvents.filter((row) => !row.hitId.startsWith(burstId))).toHaveLength(11);
    expect(result.hitResolutionLog.filter((row) => row.hitId.startsWith(burstId)).every((row) => row.geometryRadius === 6 && row.geometryOrigin?.y === 2)).toBe(true);
    const replay = replaySimulationHit(captureSimulationHit(result, hits.at(-1)!.id));
    expect(replay.difference).toBe(0); expect(replay.actionConditions?.[0]?.selected).toBe(true);

    const boundary = createKukiSkillBurstScenario(2);
    boundary.timeline!.commands = [{type: "burst", actorId: "kuki", abilityId: burstId, atFrame: 1}];
    const exactHalf = simulate(boundary);
    expect(exactHalf.actionConditionLog![0]!.ownerCurrentHp).toBe(exactHalf.actionConditionLog![0]!.ownerMaxHp * .5);
    expect(exactHalf.actionConditionLog![0]!.selected).toBe(true);
    expect(exactHalf.damageEvents).toHaveLength(12);

    const insufficient = createKukiSkillBurstScenario(); insufficient.characters[0]!.initialEnergy = 0;
    expect(validateSourceBackedActionSequence(insufficient).status).toBe("valid");
    const rejected = simulate(insufficient);
    expect(rejected.skippedActions).toHaveLength(1);
    expect(rejected.skippedActions[0]!.reasonCode).toBe("INSUFFICIENT_ENERGY");
    expect(rejected.actionConditionLog).toEqual([]);
    expect(rejected.energyCostLog).toEqual([]);
    expect(rejected.damageEvents.filter((row) => row.hitId.startsWith(burstId))).toHaveLength(0);
    console.info("Kuki E/Q branch measurement", JSON.stringify({c2LowHpAtCast: decision.ownerCurrentHp, c2BurstHits: hits.length, c2LastBurstFrame: hits.at(-1)!.frame, exactHalfBurstHits: exactHalf.damageEvents.length, insufficientEnergyDecisionCount: rejected.actionConditionLog!.length, lastHitReplayResidual: replay.difference}));
  });
});
