import { describe, expect, it } from "vitest";
import { applyExecutionProfile, createCustomExecutionProfile, IDEALIZED_EXECUTION_PROFILE, PRACTICAL_EXECUTION_PROFILE } from "../execution-profiles";
import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

function config() {
  const input = makeConfig({ duration: 2, cycleLength: 2 });
  input.characters.push({ ...structuredClone(input.characters[0]!), id: "b", name: "B" });
  input.timeline = {
    mode: "legal-frame-v1", fps: 60, legalityMode: "strict", initialActiveCharacterId: "a", swapFrames: 12,
    abilities: [
      { id: "a-e", actorId: "a", name: "A", kind: "skill", cancelFrame: 20, cancelFrames: { swap: 10 }, animationEndFrame: 30, cooldownFrames: 60,
        hits: [{ id: "a-hit", frame: 4, scaling: 1, element: "pyro" }],
        buffs: [{ key: "short-buff", target: "self", stat: "dmgBonus", value: 0.5, startFrame: 0, durationFrames: 30 }],
        particles: [{ id: "p", element: "pyro", count: 1, spawnFrame: 5, travelFrames: 20 }] },
      { id: "b-e", actorId: "b", name: "B", kind: "skill", cancelFrame: 10, animationEndFrame: 20, cooldownFrames: 60,
        hits: [{ id: "b-hit", frame: 4, scaling: 1, element: "pyro" }] },
    ],
    commands: [{ type: "skill", actorId: "a", abilityId: "a-e" }, { type: "swap", characterId: "b" }, { type: "skill", actorId: "b", abilityId: "b-e" }],
  };
  return input;
}

describe("execution profiles delay human requests without modifying game timers", () => {
  it("changes real action/hit/particle timestamps and retains original frame offsets", () => {
    const input = config();
    const baseline = simulate(input);
    const applied = applyExecutionProfile(input, PRACTICAL_EXECUTION_PROFILE);
    const delayed = simulate(applied.config);
    expect(applied.config.timeline!.abilities).toEqual(input.timeline!.abilities);
    expect(applied.config.timeline!.swapFrames).toBe(12);
    expect(input.timeline!.commands[0]).not.toHaveProperty("atFrame");
    expect(baseline.damageEvents.map((hit) => hit.frame)).toEqual([4, 26]);
    expect(delayed.damageEvents.map((hit) => hit.frame)).toEqual([6, 40]);
    expect(delayed.timelineExecution!.commandResults.map((command) => command.startFrame)).toEqual([2, 22, 36]);
    expect(delayed.timelineExecution!.commandResults[0]!.cancelFrame).toBe(12); // same 10f game cancel window, then human swap input arrives 10f later.
    expect(delayed.particleEvents[0]!.spawnFrame - delayed.actionLog.find((action) => action.actorId === "a")!.frame).toBe(5);
    expect(delayed.particleEvents[0]!.receiveFrame - delayed.particleEvents[0]!.spawnFrame).toBe(20);
    expect(delayed.damageEvents[0]!.activeStatuses[0]!.endTimeSeconds - delayed.damageEvents[0]!.activeStatuses[0]!.startTimeSeconds).toBeCloseTo(0.5);
    expect(applied.changes[1]).toMatchObject({ addedDelayFrames: 10, reason: "cancellation-input" });
    expect(applied.config.characters).toEqual(input.characters);
  });

  it("idealized profile reproduces the event times, and explicit waits remain actual waits", () => {
    const input = config();
    input.timeline!.commands.splice(2, 0, { type: "wait", frames: 3 });
    const original = simulate(input);
    const ideal = simulate(applyExecutionProfile(input, IDEALIZED_EXECUTION_PROFILE).config);
    expect(ideal.damageEvents.map((hit) => [hit.frame, hit.finalDamage])).toEqual(original.damageEvents.map((hit) => [hit.frame, hit.finalDamage]));
    const practical = applyExecutionProfile(input, PRACTICAL_EXECUTION_PROFILE);
    expect(practical.config.timeline!.commands[2]).toEqual({ type: "wait", frames: 3 });
    expect(simulate(practical.config).damageEvents[1]!.frame).toBe(43);
  });

  it("does not repair strict conflicts or fabricate legality, and bounds custom frame inputs", () => {
    const invalid = config();
    invalid.timeline!.commands[1] = { type: "swap", characterId: "b", atFrame: 0 };
    expect(() => applyExecutionProfile(invalid, PRACTICAL_EXECUTION_PROFILE)).toThrow("ACTION_OVERLAP");
    expect(() => createCustomExecutionProfile({ inputDelayFrames: -1, swapDelayFrames: 0, cancellationDelayFrames: 0 })).toThrow();
    expect(() => createCustomExecutionProfile({ inputDelayFrames: 0.5, swapDelayFrames: 0, cancellationDelayFrames: 0 })).toThrow();
    expect(() => applyExecutionProfile(makeConfig(), PRACTICAL_EXECUTION_PROFILE)).toThrow("合法帧");
    expect(createCustomExecutionProfile({ inputDelayFrames: 3, swapDelayFrames: 8, cancellationDelayFrames: 5 }).evidence).toBe("explicit-assumption");
  });
});
