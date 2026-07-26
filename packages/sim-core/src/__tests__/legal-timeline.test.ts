import type {
  AbilityDefinition,
  LegalTimelineCommand,
  SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import {
  compileLegalTimeline,
  TimelineLegalityError
} from "../legal-timeline";
import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

const skillA: AbilityDefinition = {
  id: "a-skill",
  actorId: "a",
  name: "A 元素战技",
  kind: "skill",
  cancelFrame: 30,
  animationEndFrame: 60,
  cooldownFrames: 120,
  hits: [
    {
      id: "a-skill-hit",
      frame: 20,
      scaling: 2,
      element: "pyro"
    }
  ]
};

const normalA: AbilityDefinition = {
  id: "a-normal",
  actorId: "a",
  name: "A 普攻",
  kind: "normal",
  cancelFrame: 20,
  animationEndFrame: 28,
  cooldownFrames: 0,
  hits: [
    {
      id: "a-normal-hit",
      frame: 10,
      scaling: 1,
      element: "pyro"
    }
  ]
};

const skillB: AbilityDefinition = {
  id: "b-skill",
  actorId: "b",
  name: "B 元素战技",
  kind: "skill",
  cancelFrame: 24,
  animationEndFrame: 40,
  cooldownFrames: 90,
  hits: [
    {
      id: "b-skill-hit",
      frame: 10,
      scaling: 1.5,
      element: "cryo"
    }
  ]
};

function legalConfig(
  legalityMode: "strict" | "wait",
  commands: LegalTimelineCommand[],
  abilities: AbilityDefinition[] = [skillA, normalA, skillB]
): SimConfig {
  const base = makeConfig();
  return makeConfig({
    duration: 10,
    cycleLength: 10,
    characters: [
      base.characters[0]!,
      {
        ...base.characters[0]!,
        id: "b",
        name: "B",
        element: "cryo",
        color: "#00aaff"
      }
    ],
    rotation: [],
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode,
      initialActiveCharacterId: "a",
      swapFrames: 12,
      abilities,
      commands
    }
  });
}

describe("legal 60 FPS action timeline", () => {
  it("schedules casts, swaps, hits, cancels, and animation ends on integer frames", () => {
    const config = legalConfig("strict", [
      { type: "skill", actorId: "a", abilityId: "a-skill" },
      { type: "swap", characterId: "b" },
      { type: "skill", actorId: "b", abilityId: "b-skill" }
    ]);
    const result = simulate(config);
    expect(result.compatibilityMode).toBe("legal-frame-v1");
    expect(result.timelineExecution?.commandResults).toMatchObject([
      {
        commandIndex: 0,
        startFrame: 0,
        cancelFrame: 30,
        animationEndFrame: 60,
        status: "executed"
      },
      {
        commandIndex: 1,
        startFrame: 30,
        endFrame: 42,
        status: "executed"
      },
      {
        commandIndex: 2,
        startFrame: 42,
        cancelFrame: 66,
        animationEndFrame: 82,
        status: "executed"
      }
    ]);
    expect(result.damageEvents.map((event) => event.frame)).toEqual([20, 52]);
    expect(
      result.damageEvents.map((event) => ({
        command: event.timelineCommandIndex,
        ability: event.sourceAbilityId,
        active: event.activeCharacterId,
        start: event.actionStartFrame,
        cancel: event.actionCancelFrame,
        end: event.actionAnimationEndFrame
      }))
    ).toEqual([
      {
        command: 0,
        ability: "a-skill",
        active: "a",
        start: 0,
        cancel: 30,
        end: 60
      },
      {
        command: 2,
        ability: "b-skill",
        active: "b",
        start: 42,
        cancel: 66,
        end: 82
      }
    ]);
  });

  it("rejects an early cooldown cast in strict mode", () => {
    const config = legalConfig("strict", [
      { type: "skill", actorId: "a", abilityId: "a-skill" },
      { type: "skill", actorId: "a", abilityId: "a-skill" }
    ]);
    expect(() => compileLegalTimeline(config)).toThrowError(
      TimelineLegalityError
    );
    try {
      compileLegalTimeline(config);
    } catch (error) {
      expect((error as TimelineLegalityError).failure).toMatchObject({
        commandIndex: 1,
        code: "ABILITY_ON_COOLDOWN",
        frame: 30
      });
    }
  });

  it("waits for cooldown in wait mode and records the adjustment", () => {
    const result = simulate(
      legalConfig("wait", [
        { type: "skill", actorId: "a", abilityId: "a-skill" },
        { type: "skill", actorId: "a", abilityId: "a-skill" }
      ])
    );
    expect(
      result.timelineExecution?.commandResults.map(
        (command) => command.startFrame
      )
    ).toEqual([0, 120]);
    expect(result.timelineExecution?.adjustments).toContainEqual({
      commandIndex: 1,
      code: "ABILITY_ON_COOLDOWN",
      requestedFrame: 30,
      executedFrame: 120,
      waitedFrames: 90,
      message: "\"A 元素战技\" 等待冷却/充能至第 120 帧。"
    });
  });

  it("supports multiple charges and waits only after all charges are consumed", () => {
    const chargedSkill: AbilityDefinition = {
      ...skillA,
      cancelFrame: 10,
      maxCharges: 2,
      chargeRecoveryFrames: 120
    };
    const result = simulate(
      legalConfig(
        "wait",
        [
          { type: "skill", actorId: "a", abilityId: "a-skill" },
          { type: "skill", actorId: "a", abilityId: "a-skill" },
          { type: "skill", actorId: "a", abilityId: "a-skill" }
        ],
        [chargedSkill]
      )
    );
    expect(
      result.timelineExecution?.commandResults.map(
        (command) => command.startFrame
      )
    ).toEqual([0, 10, 120]);
  });

  it("rejects overlap in strict mode and shifts it in wait mode", () => {
    const commands: LegalTimelineCommand[] = [
      { type: "skill", actorId: "a", abilityId: "a-skill" },
      {
        type: "normal",
        actorId: "a",
        abilityId: "a-normal",
        atFrame: 10
      }
    ];
    expect(() =>
      compileLegalTimeline(legalConfig("strict", commands))
    ).toThrow(/ACTION_OVERLAP/);

    const result = simulate(legalConfig("wait", commands));
    expect(result.timelineExecution?.commandResults[1]).toMatchObject({
      requestedFrame: 10,
      startFrame: 30,
      status: "waited",
      waitedFrames: 20
    });
    expect(result.timelineExecution?.adjustments[0]?.code).toBe(
      "ACTION_OVERLAP"
    );
  });

  it("records an off-field cast as rejected instead of silently switching", () => {
    const result = simulate(
      legalConfig("wait", [
        { type: "skill", actorId: "b", abilityId: "b-skill" }
      ])
    );
    expect(result.timelineExecution?.failures[0]).toMatchObject({
      commandIndex: 0,
      code: "WRONG_ACTIVE_CHARACTER",
      frame: 0
    });
    expect(result.timelineExecution?.commandResults[0]?.status).toBe(
      "rejected"
    );
    expect(result.damageEvents).toHaveLength(0);
  });
});
