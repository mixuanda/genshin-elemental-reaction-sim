import { describe, expect, it } from "vitest";
import { simulationResultSchema } from "@genshin-dps-lab/schemas";
import { createKukiSkillBurstScenario, validateSourceBackedActionSequence } from "../source-action-library";
import { simulate } from "../simulator";

const burstId = "kuki-burst-gyoei-narukami";
describe("Kuki source timing uses energy-resolved execution", () => {
  it("releases rejected Q occupancy/cooldown while preserving successful animations and real swap cooldown", () => {
    const rejectedThenSwap = createKukiSkillBurstScenario();
    rejectedThenSwap.characters[0]!.initialEnergy = 0;
    rejectedThenSwap.timeline!.commands.push({ type: "swap", characterId: "amber", atFrame: 565 });
    expect(validateSourceBackedActionSequence(rejectedThenSwap).status).toBe("valid");
    const first = simulate(rejectedThenSwap);
    expect(first.timelineExecution!.commandResults[3]).toMatchObject({ status: "rejected", failureCode: "INSUFFICIENT_ENERGY", startFrame: 564, cancelFrame: null });
    expect(first.timelineExecution!.commandResults[4]).toMatchObject({ status: "executed", startFrame: 565, endFrame: 566 });
    expect(first.actionConditionLog).toEqual([]);
    expect(first.energyCostLog).toEqual([]);
    expect(first.damageEvents.some(row => row.hitId.startsWith(burstId))).toBe(false);
    expect(simulationResultSchema.safeParse(JSON.parse(JSON.stringify(first))).success).toBe(true);

    const consecutiveFailures = structuredClone(rejectedThenSwap);
    consecutiveFailures.timeline!.commands.splice(4, 0, { type: "burst", actorId: "kuki", abilityId: burstId, atFrame: 565 });
    consecutiveFailures.timeline!.commands[5] = { type: "swap", characterId: "amber", atFrame: 566 };
    const second = simulate(consecutiveFailures);
    expect(second.skippedActions.map(row => [row.frame, row.reasonCode])).toEqual([[564, "INSUFFICIENT_ENERGY"], [565, "INSUFFICIENT_ENERGY"]]);
    expect(second.timelineExecution!.commandResults[5]).toMatchObject({ status: "executed", startFrame: 566, endFrame: 567 });
    expect(second.actionConditionLog).toEqual([]);
    expect(second.energyCostLog).toEqual([]);

    const successfulThenEarlySwap = createKukiSkillBurstScenario();
    successfulThenEarlySwap.timeline!.commands.push({ type: "swap", characterId: "amber", atFrame: 565 });
    expect(() => simulate(successfulThenEarlySwap)).toThrow(/占用至第 626 帧/);

    const actualSwapCooldown = structuredClone(rejectedThenSwap);
    actualSwapCooldown.timeline!.commands.push({ type: "swap", characterId: "kuki", atFrame: 600 });
    expect(validateSourceBackedActionSequence(actualSwapCooldown).status).toBe("valid");
    expect(() => simulate(actualSwapCooldown)).toThrow(/60帧全队换人冷却/);
  });
});
