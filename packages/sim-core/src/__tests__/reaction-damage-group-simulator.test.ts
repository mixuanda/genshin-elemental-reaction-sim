import type { Element, SimConfig } from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

type ReactionVector = "superconduct" | "overload";

function makeRepeatedReactionConfig({
  reaction,
  triggerFrames,
  triggerTargetIds = triggerFrames.map(() => "enemy-0"),
  targets = [
    {
      id: "enemy-0",
      name: "Reaction target",
      position: { x: 0, y: 0 },
    },
  ],
  targetPhases = [],
}: {
  reaction: ReactionVector;
  triggerFrames: readonly number[];
  triggerTargetIds?: readonly string[];
  targets?: NonNullable<SimConfig["enemy"]["targets"]>;
  targetPhases?: NonNullable<SimConfig["enemy"]["targetPhases"]>;
}): SimConfig {
  const base = makeConfig();
  const auraElement: Element = reaction === "superconduct" ? "cryo" : "pyro";
  const lastTriggerFrame = Math.max(...triggerFrames);
  if (triggerTargetIds.length !== triggerFrames.length) {
    throw new Error("Each reaction trigger frame requires one target id.");
  }

  return makeConfig({
    dataVersion: `reaction-damage-group-${reaction}`,
    randomSeed: `reaction-damage-group-${reaction}`,
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: targets.map((target) => ({
        ...target,
        initialAura: [{ element: auraElement, gaugeUnits: 8 }],
      })),
      ...(targetPhases.length === 0 ? {} : { targetPhases }),
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "electro",
        name: "Electro trigger",
        element: "electro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1000,
          em: 100,
        },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "electro",
      swapFrames: 1,
      abilities: [
        {
          id: `${reaction}-sequence`,
          actorId: "electro",
          name: `${reaction} reset vector`,
          kind: "skill",
          cancelFrame: lastTriggerFrame,
          animationEndFrame: lastTriggerFrame,
          cooldownFrames: 0,
          hits: triggerFrames.map((frame, index) => ({
            id: `${reaction}-trigger-${index}`,
            frame,
            scaling: 1,
            element: "electro" as const,
            targeting: {
              targetId: triggerTargetIds[index]!,
              outcome: "landed" as const,
            },
            application: {
              gaugeUnits: 0.1,
              icd: { mode: "no-icd-v1" as const },
            },
          })),
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "electro",
          abilityId: `${reaction}-sequence`,
          atFrame: 0,
        },
      ],
    },
  });
}

function makeSwirlConfig(): SimConfig {
  const base = makeConfig();
  return makeConfig({
    dataVersion: "reaction-damage-group-swirl",
    randomSeed: "reaction-damage-group-swirl",
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Swirl source",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "pyro", gaugeUnits: 1 }],
        },
        {
          id: "recipient",
          name: "Swirl recipient",
          position: { x: 3, y: 0 },
        },
      ],
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "anemo",
        name: "Anemo trigger",
        element: "anemo",
        stats: { ...neutralStats, em: 100 },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "anemo",
      swapFrames: 1,
      abilities: [
        {
          id: "swirl-skill",
          actorId: "anemo",
          name: "Swirl Skill",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "swirl-hit",
              frame: 0,
              scaling: 1,
              element: "anemo",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed",
              },
              application: {
                gaugeUnits: 1,
                icd: { mode: "no-icd-v1" },
              },
            },
          ],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "anemo",
          abilityId: "swirl-skill",
          atFrame: 0,
        },
      ],
    },
  });
}

function decisionsFor(
  result: ReturnType<typeof simulate>,
  reaction: ReactionVector,
  targetId = "enemy-0",
) {
  return result.reactionDamageLog
    .filter((entry) => entry.reaction === reaction)
    .flatMap((entry) => entry.damageGroupDecisions)
    .filter(
      (decision) =>
        decision.reaction === reaction && decision.targetId === targetId,
    );
}

describe("reaction damage-group task ordering in the simulator", () => {
  it.each([
    ["superconduct", "reaction-a", "ICDTagSuperconductDamage"],
    ["overload", "reaction-b", "ICDTagOverloadDamage"],
  ] as const)(
    "executes the scheduled F+29 %s reset before a later-sequence same-frame attempt",
    (reaction, icdGroup, icdTag) => {
      const result = simulate(
        makeRepeatedReactionConfig({
          reaction,
          triggerFrames: [0, 29],
        }),
        { critMode: "noCrit" },
      );
      const decisions = decisionsFor(result, reaction);

      expect(decisions).toHaveLength(2);
      expect(
        decisions.map((decision) => ({
          frame: decision.frame,
          icdGroup: decision.icdGroup,
          icdTag: decision.icdTag,
          generation: decision.windowGeneration,
          windowStartFrame: decision.windowStartFrame,
          resetAtFrame: decision.resetAtFrame,
          hitIndex: decision.hitIndex,
          multiplier: decision.sequenceMultiplier,
          allowed: decision.damageAllowed,
        })),
      ).toEqual([
        {
          frame: 1,
          icdGroup,
          icdTag,
          generation: 0,
          windowStartFrame: 1,
          resetAtFrame: 30,
          hitIndex: 0,
          multiplier: 1,
          allowed: true,
        },
        {
          frame: 30,
          icdGroup,
          icdTag,
          generation: 1,
          windowStartFrame: 30,
          resetAtFrame: 59,
          hitIndex: 0,
          multiplier: 1,
          allowed: true,
        },
      ]);

      const firstReset = result.reactionDamageGroupResetLog.find(
        (entry) => entry.id === decisions[0]!.resetTaskLogId,
      );
      expect(firstReset).toMatchObject({
        reaction,
        targetId: "enemy-0",
        sourceActorId: "electro",
        icdGroup,
        icdTag,
        windowGeneration: 0,
        windowStartFrame: 1,
        resetAtFrame: 30,
        withinSimulation: true,
        executed: true,
        executionFrame: 30,
        stale: false,
        invalidatedReason: null,
        executedBeforeAttemptTaskSequence:
          decisions[1]!.damageGroupTaskSequence,
      });
      expect(firstReset?.taskSequence).toBe(decisions[0]!.resetTaskSequence);
      expect(firstReset!.taskSequence).toBeLessThan(
        decisions[1]!.damageGroupTaskSequence,
      );
      expect(firstReset!.scopeKey).toBe(decisions[0]!.scopeKey);
      expect(decisions[1]!.scopeKey).toBe(decisions[0]!.scopeKey);
    },
  );

  it("routes Swirl self-damage and propagation through target-scoped ReactionA tasks", () => {
    const result = simulate(makeSwirlConfig(), {
      critMode: "noCrit",
    });
    const decisions = result.reactionDamageLog
      .filter((entry) => entry.reaction === "swirlPyro")
      .flatMap((entry) => entry.damageGroupDecisions)
      .filter((decision) => decision.reaction === "swirlPyro");

    expect(
      decisions.map((decision) => ({
        frame: decision.frame,
        targetId: decision.targetId,
        sourceActorId: decision.sourceActorId,
        icdTag: decision.icdTag,
        icdGroup: decision.icdGroup,
        hitIndex: decision.hitIndex,
        multiplier: decision.sequenceMultiplier,
        allowed: decision.damageAllowed,
      })),
    ).toEqual([
      {
        frame: 1,
        targetId: "enemy-0",
        sourceActorId: "anemo",
        icdTag: "ICDTagSwirlPyro",
        icdGroup: "reaction-a",
        hitIndex: 0,
        multiplier: 1,
        allowed: true,
      },
      {
        frame: 5,
        targetId: "recipient",
        sourceActorId: "anemo",
        icdTag: "ICDTagSwirlPyro",
        icdGroup: "reaction-a",
        hitIndex: 0,
        multiplier: 1,
        allowed: true,
      },
    ]);

    expect(result.reactionDamageGroupResetLog).toHaveLength(2);
    for (const decision of decisions) {
      const reset = result.reactionDamageGroupResetLog.find(
        (entry) => entry.id === decision.resetTaskLogId,
      );
      expect(reset).toMatchObject({
        reaction: "swirlPyro",
        sourceActorId: "anemo",
        targetId: decision.targetId,
        scopeKey: decision.scopeKey,
        taskSequence: decision.resetTaskSequence,
        windowGeneration: 0,
        windowStartFrame: decision.frame,
        resetAtFrame: decision.frame + 29,
        withinSimulation: true,
        executed: true,
        executionFrame: decision.frame + 29,
        stale: false,
        invalidatedReason: null,
      });
    }
  });

  it("does not consume a spatial miss, while a landed damage-immune Overload consumes the target stream", () => {
    const result = simulate(
      makeRepeatedReactionConfig({
        reaction: "overload",
        triggerFrames: [0, 8, 16],
        triggerTargetIds: ["enemy-0", "enemy-0", "missed"],
        targets: [
          {
            id: "enemy-0",
            name: "Explosion center",
            position: { x: 0, y: 0 },
          },
          {
            id: "immune",
            name: "Immune landed target",
            position: { x: 3, y: 0 },
          },
          {
            id: "missed",
            name: "Outside radius target",
            position: { x: 3.1, y: 0 },
          },
        ],
        targetPhases: [
          {
            id: "immune-overload-window",
            label: "Overload damage immunity",
            targetId: "immune",
            startFrame: 1,
            endFrame: 10,
            reason: "OVERLOAD_DAMAGE_IMMUNE_WINDOW",
            effects: {
              damage: "immune",
              aura: "normal",
              hitConfirm: "normal",
            },
          },
        ],
      }),
      { critMode: "noCrit" },
    );

    const immuneDecisions = decisionsFor(result, "overload", "immune");
    expect(
      immuneDecisions.map((decision) => ({
        frame: decision.frame,
        hitIndex: decision.hitIndex,
        allowed: decision.damageAllowed,
        blockedReason: decision.blockedReason,
      })),
    ).toEqual([
      {
        frame: 1,
        hitIndex: 0,
        allowed: true,
        blockedReason: null,
      },
      {
        frame: 9,
        hitIndex: 1,
        allowed: false,
        blockedReason: "REACTION_B_DAMAGE_ICD",
      },
      {
        frame: 17,
        hitIndex: 2,
        allowed: false,
        blockedReason: "REACTION_B_DAMAGE_ICD",
      },
    ]);

    const immuneDamage = result.damageEvents.find(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "overload" &&
        event.targetId === "immune" &&
        event.frame === 1,
    );
    expect(immuneDamage).toMatchObject({
      targetDamagePolicy: "immune",
      potentialDamage: expect.any(Number),
      finalDamage: 0,
      damageFactors: { groupMultiplier: 1 },
    });
    expect(immuneDamage!.potentialDamage).toBeGreaterThan(0);

    const missedDecisions = decisionsFor(result, "overload", "missed");
    expect(missedDecisions).toHaveLength(1);
    expect(missedDecisions[0]).toMatchObject({
      frame: 17,
      windowGeneration: 0,
      windowStartFrame: 17,
      hitIndex: 0,
      sequenceIndex: 0,
      sequenceMultiplier: 1,
      damageAllowed: true,
      blockedReason: null,
    });
    const missedRows = result.hitResolutionLog.filter(
      (entry) =>
        entry.resolutionKind === "reaction-damage" &&
        entry.targetId === "missed" &&
        entry.outcome === "miss",
    );
    expect(missedRows).toHaveLength(2);
    expect(missedRows.every((entry) => !entry.landed)).toBe(true);
    expect(
      result.reactionDamageGroupResetLog.filter(
        (entry) => entry.targetId === "missed",
      ),
    ).toHaveLength(1);
  });
});
