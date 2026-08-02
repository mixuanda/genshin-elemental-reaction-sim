import {
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
} from "@genshin-dps-lab/icd-profiles";
import type {
  BasicReactionSchedulerModel,
  SimConfig,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const LEGACY_SCHEDULER = {
  mode: "legacy-immediate-basic-reaction-scheduler-v1",
  policyId: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
} as const satisfies BasicReactionSchedulerModel;

const NATIVE_SCHEDULER = {
  mode: "fixed-gcsim-basic-reaction-scheduler-v2",
  policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
} as const satisfies BasicReactionSchedulerModel;

type SwirledElement = "pyro" | "cryo";

function makeSameFrameSwirlConfig(
  basicReactionSchedulerModel: BasicReactionSchedulerModel,
  sourceElements: readonly [SwirledElement, SwirledElement] = ["pyro", "cryo"],
): SimConfig {
  const base = makeConfig({ basicReactionSchedulerModel });
  const actors = ["anemo-pyro", "anemo-cryo"] as const;
  const sourceTargets = ["source-pyro", "source-cryo"] as const;
  return {
    ...base,
    duration: 1,
    cycleLength: 1,
    basicReactionSchedulerModel,
    targetTaskModel: { mode: "target-phase-v2" },
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: sourceTargets[0],
          name: "左侧扩散源",
          position: { x: -4, y: 0 },
          initialAura: [{ element: sourceElements[0], gaugeUnits: 1 }],
        },
        {
          id: sourceTargets[1],
          name: "右侧扩散源",
          position: { x: 4, y: 0 },
          initialAura: [{ element: sourceElements[1], gaugeUnits: 1 }],
        },
        {
          id: "enemy-0",
          name: "共同空目标",
          position: { x: 0, y: 0 },
        },
      ],
    },
    characters: actors.map((actorId, index) => ({
      ...base.characters[0]!,
      id: actorId,
      name: `Anemo ${index + 1}`,
      element: "anemo" as const,
      level: 90,
      stats: {
        ...neutralStats,
        em: 100,
      },
    })),
    reactionEngine: { mode: "aura-v9" },
    rotation: [],
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: actors[0],
      swapFrames: 1,
      abilities: actors.map((actorId, index) => ({
        id: `same-frame-swirl-${index}`,
        actorId,
        name: `Same-frame Swirl ${index + 1}`,
        kind: "skill" as const,
        cancelFrame: 1,
        animationEndFrame: 1,
        cooldownFrames: 0,
        hits: [
          {
            id: `same-frame-swirl-hit-${index}`,
            frame: index === 0 ? 10 : 8,
            scaling: 1,
            element: "anemo" as const,
            targeting: {
              targetId: sourceTargets[index]!,
              outcome: "landed" as const,
            },
            application: {
              gaugeUnits: 1,
              icd: { mode: "no-icd-v1" as const },
            },
          },
        ],
      })),
      commands: [
        {
          type: "skill",
          actorId: actors[0],
          abilityId: "same-frame-swirl-0",
        },
        { type: "swap", characterId: actors[1] },
        {
          type: "skill",
          actorId: actors[1],
          abilityId: "same-frame-swirl-1",
        },
      ],
    },
  };
}

function runSameFrameSwirl(
  model: BasicReactionSchedulerModel,
  sourceElements?: readonly [SwirledElement, SwirledElement],
) {
  return simulate(makeSameFrameSwirlConfig(model, sourceElements), {
    compatibilityMode: "legal-frame-v1",
    critMode: "noCrit",
  });
}

describe("basic reaction scheduler", () => {
  it("defers mixed same-frame Swirl attachments until both attacks resolve", () => {
    const result = runSameFrameSwirl(NATIVE_SCHEDULER);
    const sharedPropagations = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.frame === 15 &&
        event.targetId === "enemy-0",
    );

    expect(
      sharedPropagations.map((event) => ({
        sourceActorId: event.sourceActorId,
        reaction: event.reaction,
        nestedReaction: event.reactionAudit.reaction,
        finalDamage: event.finalDamage,
      })),
    ).toEqual([
      {
        sourceActorId: "anemo-pyro",
        reaction: "swirlPyro",
        nestedReaction: "none",
        finalDamage: 1376.5777585714284,
      },
      {
        sourceActorId: "anemo-cryo",
        reaction: "swirlCryo",
        nestedReaction: "none",
        finalDamage: 1376.5777585714284,
      },
    ]);
    expect(
      result.auraEndStates
        .find((state) => state.targetId === "enemy-0")
        ?.aura.map(({ element, gaugeUnits }) => ({
          element,
          gaugeUnits,
        })),
    ).toEqual([
      { element: "cryo", gaugeUnits: 1.6544 },
      { element: "pyro", gaugeUnits: 1.6544 },
    ]);

    const attacks = result.basicReactionSchedulerLog.filter(
      (entry) =>
        entry.kind === "swirl-attack-resolution" &&
        entry.targetId === "enemy-0",
    );
    const commits = result.basicReactionSchedulerLog.filter(
      (entry) =>
        entry.kind === "deferred-aura-attachment" &&
        entry.targetId === "enemy-0",
    );
    expect(attacks).toHaveLength(2);
    expect(commits).toHaveLength(2);
    expect(
      commits
        .at(-1)
        ?.auraAfter.map(({ element, gaugeUnits }) => ({ element, gaugeUnits }))
        .sort((left, right) => left.element.localeCompare(right.element)),
    ).toEqual([
      { element: "cryo", gaugeUnits: 1.76 },
      { element: "pyro", gaugeUnits: 1.76 },
    ]);
    expect(
      attacks.map((entry) => ({
        disposition: entry.disposition,
        frame: entry.frame,
        eventPriority: entry.eventPriority,
        eventSequence: entry.eventSequence,
        parentEventSequence: entry.parentEventSequence,
        reaction: entry.reaction,
        reactions: entry.reactions,
        auraBefore: entry.auraBefore,
        auraApplied: entry.auraApplied,
        auraConsumed: entry.auraConsumed,
        auraAfter: entry.auraAfter,
      })),
    ).toEqual([
      {
        disposition: "deferred",
        frame: 15,
        eventPriority: 5,
        eventSequence: expect.any(Number),
        parentEventSequence: expect.any(Number),
        reaction: "none",
        reactions: [],
        auraBefore: [],
        auraApplied: [],
        auraConsumed: [],
        auraAfter: [],
      },
      {
        disposition: "deferred",
        frame: 15,
        eventPriority: 5,
        eventSequence: expect.any(Number),
        parentEventSequence: expect.any(Number),
        reaction: "none",
        reactions: [],
        auraBefore: [],
        auraApplied: [],
        auraConsumed: [],
        auraAfter: [],
      },
    ]);
    const lastAttackSequence = Math.max(
      ...attacks.map((entry) => entry.eventSequence),
    );
    for (const attack of attacks) {
      expect(attack.parentEventSequence).toBe(attack.eventSequence);
      const commit = commits.find((entry) => entry.id === attack.pairedLogId);
      expect(commit).toBeDefined();
      expect(commit?.pairedLogId).toBe(attack.id);
      expect(commit?.parentEventSequence).toBe(attack.eventSequence);
      expect(commit?.eventSequence).toBeGreaterThan(lastAttackSequence);
      expect(commit?.eventPriority).toBe(5);
      expect(commit?.reactionDamageLogId).toBe(attack.reactionDamageLogId);
      expect(commit?.hitResolutionLogId).toBe(attack.hitResolutionLogId);
      expect(commit?.elementalApplicationIcdLogId).toBe(
        attack.elementalApplicationIcdLogId,
      );
    }

    for (const row of result.basicReactionSchedulerLog) {
      const points = result.targetStateTimeline.points.filter((point) =>
        point.links.some(
          (link) =>
            link.kind === "basic-reaction-scheduler-log" && link.id === row.id,
        ),
      );
      expect(points).toHaveLength(1);
      expect(points[0]).toMatchObject({
        frame: row.frame,
        targetId: row.targetId,
        eventPriority: row.eventPriority,
        eventSequence: row.eventSequence,
        reaction: row.reaction,
        reactions: row.reactions,
        auraBefore: row.auraBefore,
        auraApplied: row.auraApplied,
        auraConsumed: row.auraConsumed,
        auraAfter: row.auraAfter,
      });
      expect(points[0]?.cause).toBe(
        row.kind === "swirl-attack-resolution"
          ? "reaction-damage-application"
          : "reaction-aura-attachment",
      );
    }
  });

  it("retains the frozen immediate mixed-Swirl compatibility result", () => {
    const result = runSameFrameSwirl(LEGACY_SCHEDULER);
    const sharedPropagations = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.frame === 15 &&
        event.targetId === "enemy-0",
    );

    expect(
      sharedPropagations.map((event) => ({
        sourceActorId: event.sourceActorId,
        nestedReaction: event.reactionAudit.reaction,
        finalDamage: event.finalDamage,
      })),
    ).toEqual([
      {
        sourceActorId: "anemo-pyro",
        nestedReaction: "none",
        finalDamage: 1376.5777585714284,
      },
      {
        sourceActorId: "anemo-cryo",
        nestedReaction: "reverseMelt",
        finalDamage: 2447.55525474,
      },
    ]);
    expect(result.basicReactionSchedulerLog).toMatchObject([
      {
        kind: "swirl-attack-resolution",
        disposition: "legacy-immediate",
        sourceActorId: "anemo-pyro",
        targetId: "enemy-0",
        element: "pyro",
        pairedLogId: null,
      },
    ]);
  });

  it("isolates application and ReactionA windows by Anemo actor", () => {
    const result = runSameFrameSwirl(NATIVE_SCHEDULER, ["pyro", "pyro"]);
    const attacks = result.basicReactionSchedulerLog.filter(
      (entry) =>
        entry.kind === "swirl-attack-resolution" &&
        entry.targetId === "enemy-0",
    );

    expect(attacks).toHaveLength(2);
    expect(
      attacks.map((attack) => {
        const application =
          result.elementalApplicationIcdLog[
            attack.elementalApplicationIcdLogId!
          ];
        const damageGroup = result.reactionDamageLog[
          attack.reactionDamageLogId
        ]?.damageGroupDecisions.find(
          (decision) => decision.targetId === "enemy-0",
        );
        return {
          sourceActorId: attack.sourceActorId,
          applicationSourceActorId: application?.sourceActorId,
          applicationHitIndex:
            application?.decision.kind === "reaction-fixed-gcsim"
              ? application.decision.hitIndex
              : null,
          applicationScope:
            application?.decision.kind === "reaction-fixed-gcsim"
              ? application.decision.scope
              : null,
          damageGroupSourceActorId: damageGroup?.sourceActorId,
          damageGroupHitIndex: damageGroup?.hitIndex,
          damageAllowed: damageGroup?.damageAllowed,
        };
      }),
    ).toEqual([
      {
        sourceActorId: "anemo-pyro",
        applicationSourceActorId: "anemo-pyro",
        applicationHitIndex: 0,
        applicationScope: "actor-tag",
        damageGroupSourceActorId: "anemo-pyro",
        damageGroupHitIndex: 0,
        damageAllowed: true,
      },
      {
        sourceActorId: "anemo-cryo",
        applicationSourceActorId: "anemo-cryo",
        applicationHitIndex: 0,
        applicationScope: "actor-tag",
        damageGroupSourceActorId: "anemo-cryo",
        damageGroupHitIndex: 0,
        damageAllowed: true,
      },
    ]);
  });
});
