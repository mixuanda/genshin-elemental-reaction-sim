import { describe, expect, it } from "vitest";
import { applyExecutionProfile, IDEALIZED_EXECUTION_PROFILE, PRACTICAL_EXECUTION_PROFILE, parseExecutionProfile } from "../execution-profiles";
import { createKukiSkillBurstScenario } from "../kuki-burst-source-action";
import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

const savedLegacyProfile = {
  id: "practical-assumed-input", version: "1.0.0", label: "实用输入（声明的延迟假设）", referenceFps: 60,
  inputDelayFrames: 2, swapDelayFrames: 6, cancellationDelayFrames: 4, evidence: "explicit-assumption",
  assumptions: ["每次技能/移动/拾取请求延后2帧，换人请求延后6帧，接在技能后的闪避/跳跃/换人取消另延后4帧。", "这是可编辑工程情景，不是玩家操作实测分布，也不宣称KQMS延迟合规。"],
};

function sameFrameEnergy() {
  const config = makeConfig({duration: 2, cycleLength: 2, rotation: [], timeline: {
    mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 1,
    abilities: [
      {id: "prepare", actorId: "a", name: "明确同帧到达的微粒", kind: "skill", cancelFrame: 1, animationEndFrame: 1, cooldownFrames: 0,
        particles: [{id: "prior-particle", element: "electro", count: 1, spawnFrame: 0, travelFrames: 9}]},
      {id: "burst", actorId: "a", name: "真实能量资格Q", kind: "burst", actionPhase: "after-frame-tasks-v1", energyCost: 60, energyCostFrame: 4,
        cancelFrame: 20, cancelFrames: {swap: 2}, animationEndFrame: 20, cooldownFrames: 60,
        hits: [{id: "q", frame: 6, scaling: 1, element: "electro"}]},
    ], commands: [{type: "skill", actorId: "a", abilityId: "prepare", atFrame: 1}, {type: "burst", actorId: "a", abilityId: "burst", atFrame: 10}, {type: "swap", characterId: "b", atFrame: 12}],
  }});
  config.characters[0]!.element = "electro";
  config.characters[0]!.initialEnergy = 57;
  config.characters.push({...structuredClone(config.characters[0]!), id: "b", name: "切换队友", initialEnergy: 0});
  return config;
}

describe("execution profile actual-energy baseline", () => {
  it("retains a failed Kuki Q input without an invented cancel and preserves saved 1.0.0 structural semantics", () => {
    const input = createKukiSkillBurstScenario(); input.characters[0]!.initialEnergy = 0;
    input.timeline!.commands.push({type: "swap", characterId: "amber", atFrame: 565});
    const options = {randomSeed: "kuki-profile-energy-reference", critMode: "noCrit" as const};
    const ideal = applyExecutionProfile(input, IDEALIZED_EXECUTION_PROFILE, options);
    expect(ideal.changes.map((row) => row.requestedTick)).toEqual([1, 51, 300, 564, 565]);
    expect(ideal.changes[3]).toMatchObject({baselineStatus: "rejected", baselineFailureCode: "INSUFFICIENT_ENERGY", addedDelayFrames: 0});
    const practical = applyExecutionProfile(input, PRACTICAL_EXECUTION_PROFILE, options);
    expect(practical.changes.map((row) => row.requestedTick)).toEqual([3, 63, 318, 584, 591]);
    expect(practical.changes[3]).toMatchObject({baselineStatus: "rejected", addedDelayFrames: 2, reason: "ability-input"});
    expect(practical.changes[4]).toMatchObject({baselineStatus: "executed", addedDelayFrames: 6, reason: "swap-input"});
    expect(practical.config.timeline!.abilities).toEqual(input.timeline!.abilities);
    const delayed = simulate(practical.config, options);
    expect(delayed.timelineExecution!.commandResults[3]).toMatchObject({startFrame: 584, status: "rejected", failureCode: "INSUFFICIENT_ENERGY"});
    expect(delayed.timelineExecution!.commandResults[4]).toMatchObject({startFrame: 591, status: "executed"});
    expect(delayed.actionConditionLog).toEqual([]);
    const legacy = parseExecutionProfile(JSON.parse(JSON.stringify(savedLegacyProfile)));
    expect(legacy).toEqual(savedLegacyProfile);
    expect(legacy).not.toHaveProperty("baselineMode");
    expect(() => applyExecutionProfile(input, legacy, options)).toThrow("ACTION_OVERLAP");
  });

  it("uses same-frame received energy for successful cancellation while retaining strict errors and natural animation completion", () => {
    const input = sameFrameEnergy();
    const applied = applyExecutionProfile(input, PRACTICAL_EXECUTION_PROFILE, {randomSeed: "same-frame-profile"});
    expect(applied.baselineRuntimeOptions).toMatchObject({randomSeed: "same-frame-profile", compatibilityMode: "legal-frame-v1"});
    expect(applied.changes[1]!.baselineStatus).toBe("executed");
    expect(applied.changes[2]).toMatchObject({originalStartTick: 12, requestedTick: 26, reason: "cancellation-input", addedDelayFrames: 10});
    const result = simulate(applied.config, applied.baselineRuntimeOptions);
    expect(result.actionLog.find((row) => row.sourceAbilityId === "burst")).toMatchObject({frame: 14, energyBefore: 60});
    expect(result.energyCostLog!.find((row) => row.operation === "debit")).toMatchObject({frame: 18, energyAfter: 0});
    expect(result.timelineExecution!.commandResults[2]!.startFrame).toBe(26);
    input.timeline!.commands[2] = {type: "swap", characterId: "b", atFrame: 11};
    expect(() => applyExecutionProfile(input, PRACTICAL_EXECUTION_PROFILE)).toThrow("ACTION_OVERLAP");
    input.timeline!.commands[2] = {type: "swap", characterId: "b", atFrame: 40};
    expect(applyExecutionProfile(input, PRACTICAL_EXECUTION_PROFILE).changes[2]).toMatchObject({addedDelayFrames: 6, reason: "swap-input"});
    expect(applyExecutionProfile(input, parseExecutionProfile(savedLegacyProfile)).changes[2]).toMatchObject({addedDelayFrames: 10, reason: "cancellation-input"});
  });

  it("passes chosen critical sampling and seed through Favonius energy rather than substituting analytic expectation", () => {
    const input = sameFrameEnergy();
    input.characters[0]!.initialEnergy = 54;
    input.favoniusModel = {mode: "fixed-source-independent-stream-v1", actors: [{actorId: "a", weaponId: "favoniussword", refinement: 5, particleDelayFrames: 9}]};
    const prepare = input.timeline!.abilities[0]!;
    delete prepare.particles;
    prepare.hits = [{id: "favonius-trigger", frame: 0, scaling: 1, element: "electro", critRate: 1}];
    const options = {energyMode: "configured" as const, critMode: "average" as const, randomSeed: "explicit-favonius-profile-seed", execution: {criticalSampling: "seeded-random-v1" as const}};
    const applied = applyExecutionProfile(input, IDEALIZED_EXECUTION_PROFILE, options);
    expect(applied.baselineRuntimeOptions).toMatchObject(options);
    expect(applied.changes[1]!.baselineStatus).toBe("executed");
    const result = simulate(applied.config, options);
    expect(result.favoniusLog![0]).toMatchObject({frame: 1, outcome: "triggered"});
    expect(result.energyLog.find((row) => row.receiverId === "a")).toMatchObject({frame: 10, gainedEnergy: 6});
    expect(result.actionLog.find((row) => row.sourceAbilityId === "burst")).toMatchObject({frame: 10, energyBefore: 60});
    const noCritical = applyExecutionProfile(input, PRACTICAL_EXECUTION_PROFILE, {critMode: "noCrit", randomSeed: options.randomSeed});
    expect(noCritical.changes[1]).toMatchObject({baselineStatus: "rejected", baselineFailureCode: "INSUFFICIENT_ENERGY"});
    expect(noCritical.changes[2]).toMatchObject({addedDelayFrames: 6, reason: "swap-input"});
    expect(() => applyExecutionProfile(input, IDEALIZED_EXECUTION_PROFILE)).toThrow("实际二元暴击");
  });
});
