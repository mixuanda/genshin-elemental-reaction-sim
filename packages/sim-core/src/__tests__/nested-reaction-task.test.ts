import type {
  AuraStateEntry,
  SimConfig,
  SimulationResult
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function makeNestedReactionDamageTaskConfig(): SimConfig {
  const base = makeConfig();
  const template = base.characters[0]!;

  return {
    ...base,
    dataVersion: "nested-reaction-task-provisional-1",
    randomSeed: "nested-reaction-task-electro-swirl",
    meta: {
      name: "Reaction-damage Quicken Bloom follow-up",
      version: "1.36.0",
      verificationStatus: "provisional"
    },
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Electro Swirl source",
          position: { x: 0, y: 0 },
          initialAura: [
            { element: "electro", gaugeUnits: 1 }
          ]
        },
        {
          id: "nested-target",
          name: "Hydro and Dendro propagation target",
          position: { x: 3, y: 0 },
          initialAura: [
            { element: "hydro", gaugeUnits: 1 },
            { element: "dendro", gaugeUnits: 1 }
          ]
        }
      ]
    },
    characters: [
      {
        ...template,
        id: "anemo-driver",
        name: "Anemo driver",
        element: "anemo",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v7" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "anemo-driver",
      swapFrames: 1,
      abilities: [
        {
          id: "anemo-skill",
          actorId: "anemo-driver",
          name: "Electro Swirl propagation",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "anemo-hit",
              label: "Electro Swirl",
              frame: 0,
              scaling: 0,
              element: "anemo",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed"
              },
              application: {
                gaugeUnits: 1,
                icd: { mode: "no-icd-v1" }
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "anemo-driver",
          abilityId: "anemo-skill",
          atFrame: 0
        }
      ]
    }
  };
}

function requireReactionDamageOrigin(result: SimulationResult) {
  const origin = result.damageEvents.find(
    (event) =>
      event.kind === "transformative-reaction" &&
      event.reaction === "swirlElectro" &&
      event.targetId === "nested-target" &&
      event.frame === 5
  );
  if (origin === undefined) {
    throw new Error(
      "Expected the F5 Electro Swirl propagation damage event."
    );
  }
  return origin;
}

function auraGauge(
  aura: readonly AuraStateEntry[],
  element: AuraStateEntry["element"]
): number {
  return (
    aura.find((entry) => entry.element === element)
      ?.gaugeUnits ?? 0
  );
}

describe("aura-v7 nested reaction-damage task provenance", () => {
  it("queues Quicken to Bloom from an Electro Swirl propagation and consumes the live Aura", () => {
    const result = simulate(
      makeNestedReactionDamageTaskConfig(),
      { critMode: "noCrit" }
    );
    const direct = result.damageEvents.find(
      (event) =>
        event.kind === "direct" &&
        event.hitId === "anemo-hit"
    );
    const origin = requireReactionDamageOrigin(result);
    const [task] = result.reactionTaskLog;
    const sourcePropagation = result.damageEvents.find(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "swirlElectro" &&
        event.targetId === "enemy-0" &&
        event.frame === 1
    );
    const sourceReactionDamage = result.reactionDamageLog.find(
      (entry) =>
        sourcePropagation !== undefined &&
        entry.damageEventIds.includes(sourcePropagation.id)
    );
    const originReactionDamage = result.reactionDamageLog.find(
      (entry) => entry.damageEventIds.includes(origin.id)
    );
    const sourceDamageGroupDecision =
      sourceReactionDamage?.damageGroupDecisions[0];
    const originDamageGroupDecision =
      originReactionDamage?.damageGroupDecisions[0];
    const sourceReset = result.reactionDamageGroupResetLog.find(
      (entry) =>
        entry.id ===
        sourceDamageGroupDecision?.resetTaskLogId
    );
    const originReset = result.reactionDamageGroupResetLog.find(
      (entry) =>
        entry.id === originDamageGroupDecision?.resetTaskLogId
    );

    if (
      sourcePropagation === undefined ||
      sourceDamageGroupDecision === undefined ||
      originDamageGroupDecision === undefined ||
      sourceReset === undefined ||
      originReset === undefined
    ) {
      throw new Error(
        "Expected both Electro Swirl damage-group decisions and their V2 reset tasks."
      );
    }

    expect(direct).toMatchObject({
      frame: 0,
      targetId: "enemy-0",
      reaction: "swirlElectro"
    });
    expect(origin).toMatchObject({
      kind: "transformative-reaction",
      frame: 5,
      eventPriority: 5,
      parentDamageEventId: direct?.id,
      targetId: "nested-target",
      element: "electro",
      reaction: "swirlElectro",
      reactionAudit: {
        model: "aura-engine",
        reactions: ["electroCharged", "quicken"],
        catalyzeReaction: {
          quicken: {
            triggerElement: "electro",
            pendingHydroBloomFollowup: true
          }
        }
      }
    });

    expect(result.reactionTaskLog).toHaveLength(1);
    expect(task).toMatchObject({
      id: 0,
      kind: "quicken-bloom-followup",
      frame: origin.frame,
      targetId: origin.targetId,
      sourceActorId: origin.sourceActorId,
      sourceActionId: origin.actionId,
      triggerHitId: origin.hitId,
      triggerHitGroupId: origin.hitGroupId,
      triggerDamageEventId: origin.id,
      triggerElement: "electro",
      triggerEventType: "reactionDamage",
      triggerEventPriority: origin.eventPriority,
      triggerEventSequence: origin.eventSequence,
      eventPriority: origin.eventPriority,
      status: "triggered",
      blockedReason: null,
      quickenStateLogIds: [1],
      dendroCoreLogIds: [0],
      dendroCoreIds: [0]
    });
    expect(result.config.reactionDamageGroupModel.mode).toBe(
      "fixed-gcsim-reaction-damage-task-order-v2"
    );
    expect(sourceDamageGroupDecision).toMatchObject({
      reaction: "swirlElectro",
      targetId: sourcePropagation.targetId,
      frame: sourcePropagation.frame,
      damageGroupTaskSequence:
        sourcePropagation.eventSequence,
      resetTaskLogId: sourceReset.id,
      resetTaskSequence: sourceReset.taskSequence
    });
    expect(originDamageGroupDecision).toMatchObject({
      reaction: "swirlElectro",
      targetId: origin.targetId,
      frame: origin.frame,
      damageGroupTaskSequence: origin.eventSequence,
      resetTaskLogId: originReset.id,
      resetTaskSequence: originReset.taskSequence
    });
    expect(sourceReset).toMatchObject({
      scopeKey: sourceDamageGroupDecision.scopeKey,
      windowGeneration:
        sourceDamageGroupDecision.windowGeneration,
      windowStartFrame:
        sourceDamageGroupDecision.windowStartFrame,
      resetAtFrame: sourceDamageGroupDecision.resetAtFrame
    });
    expect(originReset).toMatchObject({
      scopeKey: originDamageGroupDecision.scopeKey,
      windowGeneration:
        originDamageGroupDecision.windowGeneration,
      windowStartFrame:
        originDamageGroupDecision.windowStartFrame,
      resetAtFrame: originDamageGroupDecision.resetAtFrame
    });

    // V2 reset tasks use the same global insertion ordinal as event-heap
    // tasks. Both Swirl damage events were prequeued before either reset was
    // allocated, so validate the semantic ordering instead of assuming the
    // follow-up's sequence is numerically adjacent to its origin event.
    const globalInsertionOrder = [
      {
        label: "source-propagation",
        sequence: sourcePropagation.eventSequence
      },
      {
        label: "nested-origin",
        sequence: origin.eventSequence
      },
      {
        label: "source-reset",
        sequence: sourceReset.taskSequence
      },
      {
        label: "origin-reset",
        sequence: originReset.taskSequence
      },
      {
        label: "quicken-bloom-followup",
        sequence: task!.eventSequence
      }
    ].sort((left, right) => left.sequence - right.sequence);
    expect(
      globalInsertionOrder.every(
        (entry, index) =>
          index === 0 ||
          globalInsertionOrder[index - 1]!.sequence <
            entry.sequence
      )
    ).toBe(true);
    expect(
      globalInsertionOrder.map((entry) => entry.label)
    ).toEqual([
      "source-propagation",
      "nested-origin",
      "source-reset",
      "origin-reset",
      "quicken-bloom-followup"
    ]);

    const originAuraAfter =
      origin.reactionAudit.auraAfter ?? [];
    expect(task!.auraBefore).toEqual(originAuraAfter);
    expect(
      task!.bloomReaction?.quickenStateMutation
        .operationAuraBefore
    ).toEqual(task!.auraBefore);
    expect(auraGauge(task!.auraBefore, "hydro")).toBeLessThan(
      0.8
    );
    expect(auraGauge(task!.auraBefore, "hydro")).toBeGreaterThan(
      0
    );
    expect(
      task!.bloomReaction?.hydroConsumedGaugeUnits
    ).toBe(auraGauge(task!.auraBefore, "hydro"));
    expect(
      task!.bloomReaction?.quickenConsumedGaugeUnits
    ).toBeCloseTo(
      auraGauge(task!.auraBefore, "quicken") / 2,
      10
    );
    expect(auraGauge(task!.auraAfter, "hydro")).toBe(0);
    expect(auraGauge(task!.auraAfter, "electro")).toBe(
      auraGauge(task!.auraBefore, "electro")
    );

    const scheduled = result.dendroCoreLog.find(
      (entry) => entry.operation === "spawn-scheduled"
    );
    const spawned = result.dendroCoreLog.find(
      (entry) => entry.operation === "spawn"
    );
    expect(scheduled).toMatchObject({
      id: task!.dendroCoreLogIds[0],
      coreId: task!.dendroCoreIds[0],
      operation: "spawn-scheduled",
      eventType: "quickenBloomFollowup",
      frame: task!.frame,
      eventPriority: task!.eventPriority,
      eventSequence: task!.eventSequence,
      sourceActorId: origin.sourceActorId,
      sourceTargetId: origin.targetId,
      originDamageEventId: origin.id,
      triggerFrame: origin.frame,
      reactionTaskLogId: task!.id,
      bloomReactionIndex: 0,
      spawnFrame: 35,
      reason: "BLOOM_TRIGGERED"
    });
    expect(spawned).toMatchObject({
      coreId: scheduled?.coreId,
      operation: "spawn",
      sourceActorId: origin.sourceActorId,
      sourceTargetId: origin.targetId,
      originDamageEventId: origin.id,
      triggerFrame: origin.frame,
      spawnedAtFrame: scheduled?.spawnFrame
    });
  });
});
