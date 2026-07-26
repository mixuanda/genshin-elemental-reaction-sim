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

const enterStateA: AbilityDefinition = {
  id: "a-enter-state",
  actorId: "a",
  name: "A 进入状态",
  kind: "skill",
  cancelFrame: 1,
  animationEndFrame: 5,
  cooldownFrames: 0,
  timelineState: {
    grants: [
      {
        key: "special-window",
        label: "特殊行动窗口",
        durationFrames: 10
      }
    ]
  }
};

const consumeStateA: AbilityDefinition = {
  id: "a-consume-state",
  actorId: "a",
  name: "A 状态派生攻击",
  kind: "normal",
  cancelFrame: 1,
  animationEndFrame: 5,
  cooldownFrames: 0,
  timelineState: {
    requires: ["special-window"],
    consumes: ["special-window"]
  },
  hits: [
    {
      id: "state-hit",
      frame: 0,
      scaling: 1,
      element: "pyro"
    }
  ]
};

const cooldownGatedStateA: AbilityDefinition = {
  ...consumeStateA,
  id: "a-cooldown-gated-state",
  name: "A 状态窗口冷却攻击",
  cooldownFrames: 120,
  timelineState: {
    requires: ["special-window"]
  }
};

const followupCancelA: AbilityDefinition = {
  id: "a-followup-cancel",
  actorId: "a",
  name: "A 分后续取消",
  kind: "skill",
  cancelFrame: 10,
  cancelFrames: {
    normal: 9,
    charge: 8,
    skill: 3,
    burst: 5,
    swap: 7
  },
  animationEndFrame: 20,
  cooldownFrames: 0
};

const burstA: AbilityDefinition = {
  id: "a-burst",
  actorId: "a",
  name: "A 爆发",
  kind: "burst",
  cancelFrame: 1,
  animationEndFrame: 1,
  cooldownFrames: 0,
  energyCost: 0
};

const chargeA: AbilityDefinition = {
  id: "a-charge",
  actorId: "a",
  name: "A 重击",
  kind: "charge",
  cancelFrame: 1,
  animationEndFrame: 1,
  cooldownFrames: 0
};

const energyBurstA: AbilityDefinition = {
  id: "a-energy-burst",
  actorId: "a",
  name: "A 能量爆发",
  kind: "burst",
  cancelFrame: 5,
  animationEndFrame: 10,
  cooldownFrames: 120,
  energyCost: 60,
  hits: [
    {
      id: "energy-burst-hit",
      frame: 1,
      scaling: 1,
      element: "pyro"
    }
  ],
  particles: [
    {
      id: "energy-burst-particle",
      element: "pyro",
      count: 1,
      spawnFrame: 1,
      travelFrames: 0
    }
  ],
  timelineState: {
    grants: [
      {
        key: "burst-succeeded",
        label: "爆发成功",
        durationFrames: 60
      }
    ]
  }
};

const refillSkillA: AbilityDefinition = {
  id: "a-refill",
  actorId: "a",
  name: "A 固定回能",
  kind: "skill",
  cancelFrame: 1,
  animationEndFrame: 1,
  cooldownFrames: 0,
  energyGains: [
    {
      target: "a",
      frame: 0,
      amount: 60,
      source: "test-refill"
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

  it("rolls back cooldown, state, hits, and particles when a burst lacks energy", () => {
    const config = legalConfig(
      "strict",
      [
        {
          type: "burst",
          actorId: "a",
          abilityId: "a-energy-burst"
        },
        {
          type: "skill",
          actorId: "a",
          abilityId: "a-refill"
        },
        {
          type: "burst",
          actorId: "a",
          abilityId: "a-energy-burst"
        }
      ],
      [energyBurstA, refillSkillA]
    );
    const result = simulate(config, { energyMode: "zero" });

    expect(result.timelineExecution?.commandResults).toMatchObject([
      {
        commandIndex: 0,
        startFrame: 0,
        endFrame: 0,
        status: "rejected",
        failureCode: "INSUFFICIENT_ENERGY",
        energyBefore: 0,
        energyCost: 60
      },
      {
        commandIndex: 1,
        startFrame: 0,
        cancelFrame: 1,
        status: "executed"
      },
      {
        commandIndex: 2,
        startFrame: 1,
        cancelFrame: 6,
        status: "executed"
      }
    ]);
    expect(result.timelineExecution?.adjustments).toEqual([]);
    expect(result.timelineExecution?.failures).toContainEqual(
      expect.objectContaining({
        commandIndex: 0,
        code: "INSUFFICIENT_ENERGY",
        frame: 0,
        energyBefore: 0,
        energyCost: 60
      })
    );
    expect(result.skippedActions).toEqual([
      expect.objectContaining({
        frame: 0,
        actionId: "a-energy-burst#0",
        timelineCommandIndex: 0,
        sourceAbilityId: "a-energy-burst",
        energyBefore: 0,
        energyCost: 60
      })
    ]);
    expect(result.actionLog.map((entry) => entry.timelineCommandIndex)).toEqual([
      1, 2
    ]);
    expect(result.damageEvents).toHaveLength(1);
    expect(result.damageEvents[0]).toMatchObject({
      frame: 2,
      timelineCommandIndex: 2
    });
    expect(result.particleEvents).toEqual([
      expect.objectContaining({
        sourceActionId: "a-energy-burst#2",
        spawnFrame: 2,
        receiveFrame: 2
      })
    ]);
    expect(
      result.timelineExecution?.stateLog.filter(
        (entry) => entry.operation === "grant"
      )
    ).toEqual([
      expect.objectContaining({
        frame: 1,
        commandIndex: 2,
        statusKey: "burst-succeeded"
      })
    ]);
    expect(result.energyStats.a).toMatchObject({
      fixedGained: 60,
      spent: 60,
      skipped: 1
    });
    const repeated = simulate(config, { energyMode: "zero" });
    expect(repeated.reproducibilityKey).toBe(result.reproducibilityKey);
    expect(repeated.timelineExecution).toEqual(result.timelineExecution);
    expect(repeated.skippedActions).toEqual(result.skippedActions);
    expect(repeated.damageEvents).toEqual(result.damageEvents);
  });

  it.each([
    {
      label: "normal",
      next: {
        type: "normal",
        actorId: "a",
        abilityId: "a-normal"
      } as const,
      abilities: [followupCancelA, normalA],
      expected: 9
    },
    {
      label: "skill",
      next: {
        type: "skill",
        actorId: "a",
        abilityId: "a-skill"
      } as const,
      abilities: [followupCancelA, skillA],
      expected: 3
    },
    {
      label: "charge",
      next: {
        type: "charge",
        actorId: "a",
        abilityId: "a-charge"
      } as const,
      abilities: [followupCancelA, chargeA],
      expected: 8
    },
    {
      label: "burst",
      next: {
        type: "burst",
        actorId: "a",
        abilityId: "a-burst"
      } as const,
      abilities: [followupCancelA, burstA],
      expected: 5
    },
    {
      label: "swap",
      next: { type: "swap", characterId: "b" } as const,
      abilities: [followupCancelA],
      expected: 7
    }
  ])(
    "selects the $label-specific cancel frame from the next command",
    ({ next, abilities, expected }) => {
      const result = simulate(
        legalConfig(
          "strict",
          [
            {
              type: "skill",
              actorId: "a",
              abilityId: "a-followup-cancel"
            },
            next
          ],
          abilities
        )
      );

      expect(result.timelineExecution?.commandResults[0]).toMatchObject({
        startFrame: 0,
        cancelFrame: expected,
        endFrame: expected
      });
      expect(
        result.timelineExecution?.commandResults[1]?.startFrame
      ).toBe(expected);
      expect(result.actionLog[0]).toMatchObject({
        cancelFrame: expected
      });
    }
  );

  it("uses the fallback cancel frame before an explicit wait", () => {
    const result = simulate(
      legalConfig(
        "strict",
        [
          {
            type: "skill",
            actorId: "a",
            abilityId: "a-followup-cancel"
          },
          { type: "wait", frames: 1 }
        ],
        [followupCancelA]
      )
    );

    expect(result.timelineExecution?.commandResults).toMatchObject([
      { startFrame: 0, cancelFrame: 10 },
      { startFrame: 10, endFrame: 11 }
    ]);
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

  it("rejects a derived action when its actor-owned state is absent", () => {
    const config = legalConfig(
      "strict",
      [
        {
          type: "normal",
          actorId: "a",
          abilityId: "a-consume-state"
        }
      ],
      [enterStateA, consumeStateA]
    );

    expect(() => compileLegalTimeline(config)).toThrow(
      /MISSING_REQUIRED_STATE/
    );
    try {
      compileLegalTimeline(config);
    } catch (error) {
      expect((error as TimelineLegalityError).failure).toEqual({
        commandIndex: 0,
        code: "MISSING_REQUIRED_STATE",
        frame: 0,
        message:
          "\"A 状态派生攻击\" 需要 \"special-window\" 行动状态。"
      });
    }
  });

  it("grants and consumes a state with a complete transition log", () => {
    const result = simulate(
      legalConfig(
        "strict",
        [
          {
            type: "skill",
            actorId: "a",
            abilityId: "a-enter-state"
          },
          {
            type: "normal",
            actorId: "a",
            abilityId: "a-consume-state"
          }
        ],
        [enterStateA, consumeStateA]
      )
    );

    expect(result.damageEvents).toHaveLength(1);
    expect(result.timelineExecution?.stateLog).toEqual([
      {
        sequence: 0,
        frame: 0,
        timeSeconds: 0,
        operation: "grant",
        actorId: "a",
        statusKey: "special-window",
        label: "特殊行动窗口",
        expiresAtFrame: 10,
        commandIndex: 0,
        abilityId: "a-enter-state"
      },
      {
        sequence: 1,
        frame: 1,
        timeSeconds: 1 / 60,
        operation: "consume",
        actorId: "a",
        statusKey: "special-window",
        label: "特殊行动窗口",
        expiresAtFrame: 10,
        commandIndex: 1,
        abilityId: "a-consume-state"
      }
    ]);
  });

  it("expires the state exactly at its boundary before checking requirements", () => {
    const result = simulate(
      legalConfig(
        "wait",
        [
          {
            type: "skill",
            actorId: "a",
            abilityId: "a-enter-state"
          },
          { type: "wait", frames: 9 },
          {
            type: "normal",
            actorId: "a",
            abilityId: "a-consume-state"
          }
        ],
        [enterStateA, consumeStateA]
      )
    );

    expect(result.timelineExecution?.stateLog).toEqual([
      expect.objectContaining({
        frame: 0,
        operation: "grant",
        expiresAtFrame: 10
      }),
      expect.objectContaining({
        frame: 10,
        operation: "expire",
        expiresAtFrame: 10
      })
    ]);
    expect(result.timelineExecution?.failures).toContainEqual({
      commandIndex: 2,
      code: "MISSING_REQUIRED_STATE",
      frame: 10,
      message:
        "\"A 状态派生攻击\" 需要 \"special-window\" 行动状态。"
    });
    expect(result.timelineExecution?.commandResults[2]).toMatchObject({
      status: "rejected",
      failureCode: "MISSING_REQUIRED_STATE"
    });
    expect(result.damageEvents).toHaveLength(0);
  });

  it("rechecks state after cooldown waiting and keeps the attempted frame", () => {
    const result = simulate(
      legalConfig(
        "wait",
        [
          {
            type: "skill",
            actorId: "a",
            abilityId: "a-enter-state"
          },
          {
            type: "normal",
            actorId: "a",
            abilityId: "a-cooldown-gated-state"
          },
          {
            type: "normal",
            actorId: "a",
            abilityId: "a-cooldown-gated-state"
          }
        ],
        [enterStateA, cooldownGatedStateA]
      )
    );

    expect(result.timelineExecution?.adjustments).toContainEqual({
      commandIndex: 2,
      code: "ABILITY_ON_COOLDOWN",
      requestedFrame: 2,
      executedFrame: 121,
      waitedFrames: 119,
      message:
        "\"A 状态窗口冷却攻击\" 等待冷却/充能至第 121 帧。"
    });
    expect(result.timelineExecution?.commandResults[2]).toMatchObject({
      status: "rejected",
      failureCode: "MISSING_REQUIRED_STATE",
      waitedFrames: 119
    });
    expect(result.timelineExecution?.totalFrames).toBe(121);
    expect(result.damageEvents).toHaveLength(1);
  });
});
