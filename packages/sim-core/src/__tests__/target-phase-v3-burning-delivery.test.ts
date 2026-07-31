import {
  assertTrustedSimulationResult,
  assertTrustedSimulationResultV144,
  simulationResultV144Schema,
  type EnemyTargetProfile,
  type FrameHitDefinition,
  type SimConfig,
  type SimulationResult,
  type TargetMotionDefinition,
  type TargetPhaseV3Delivery,
  type TargetPhaseV3LogEntry,
  type TargetPhaseV3TargetTask
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const OWNER_ID = "enemy-0";
const DRIVER_ID = "burning-delivery-driver";

interface V3ScenarioOptions {
  id: string;
  durationFrames: number;
  targets: EnemyTargetProfile[];
  hits: FrameHitDefinition[];
  targetMotions?: TargetMotionDefinition[];
  targetClockModel?: SimConfig["targetClockModel"];
  allowUnresolvedPositions?: boolean;
}

function makeV3Scenario({
  id,
  durationFrames,
  targets,
  hits,
  targetMotions,
  targetClockModel = { mode: "disabled" },
  allowUnresolvedPositions = false
}: V3ScenarioOptions): SimConfig {
  const base = makeConfig();
  const lastHitFrame = Math.max(
    0,
    ...hits.map((hit) => hit.frame)
  );
  const resolvedDurationFrames = Math.max(60, durationFrames);

  return {
    ...base,
    dataVersion: `target-phase-v3-${id}`,
    randomSeed: `target-phase-v3-${id}`,
    meta: {
      name: `Target phase v3 ${id}`,
      version: "1.44.0",
      verificationStatus: "provisional"
    },
    duration: resolvedDurationFrames / 60,
    cycleLength: resolvedDurationFrames / 60,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets,
      ...(targetMotions === undefined
        ? {}
        : { targetMotions })
    },
    characters: [
      {
        ...base.characters[0]!,
        id: DRIVER_ID,
        name: "Burning delivery driver",
        element: "pyro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0,
          em: 100,
          reactionBonus: 0.2
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v9" },
    targetClockModel,
    targetTaskModel: { mode: "target-phase-v3" },
    reactionDeliveryModel: {
      mode: "deferred-event-heap-v1"
    },
    electroChargedPropagationModel:
      allowUnresolvedPositions
        ? {
            mode: "nearby-wet-radius-v1",
            radius: 3,
            verificationStatus: "provisional"
          }
        : { mode: "single-target-v1" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: DRIVER_ID,
      swapFrames: 1,
      abilities: [
        {
          id: `${id}-ability`,
          actorId: DRIVER_ID,
          name: `${id} ability`,
          kind: "skill",
          cancelFrame: lastHitFrame + 1,
          animationEndFrame: lastHitFrame + 1,
          cooldownFrames: 0,
          hits
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: DRIVER_ID,
          abilityId: `${id}-ability`,
          atFrame: 0
        }
      ]
    }
  };
}

function expectCurrentV144Result(
  result: SimulationResult
): void {
  expect(simulationResultV144Schema.parse(result)).toEqual(
    result
  );
  expect(assertTrustedSimulationResultV144(result)).toBe(
    result
  );
  expect(assertTrustedSimulationResult(result)).toBe(result);
}

function v3PhaseAt(
  result: SimulationResult,
  frame: number,
  targetId: string
): TargetPhaseV3LogEntry {
  const matches = result.targetPhaseLog.filter(
    (entry): entry is TargetPhaseV3LogEntry =>
      entry.model === "target-phase-v3" &&
      entry.globalFrame === frame &&
      entry.targetId === targetId
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function burningDeliveryAt(
  result: SimulationResult,
  frame: number,
  tickIndex: number
): {
  phase: TargetPhaseV3LogEntry;
  task: TargetPhaseV3TargetTask;
  delivery: TargetPhaseV3Delivery;
} {
  const matches = result.targetPhaseLog.flatMap((phase) =>
    phase.model !== "target-phase-v3" ||
    phase.globalFrame !== frame
      ? []
      : phase.targetTasks.flatMap((task) =>
          task.kind === "burning-tick" &&
          task.tickIndex === tickIndex &&
          task.delivery !== null
            ? [{ phase, task, delivery: task.delivery }]
            : []
        )
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function attemptFor(
  delivery: TargetPhaseV3Delivery,
  targetId: string
) {
  const attempt = delivery.attempts.find(
    (candidate) => candidate.targetId === targetId
  );
  expect(attempt).toBeDefined();
  return attempt!;
}

function makeFrozenBoundaryConfig(
  ownerBeforeRecipient: boolean
): SimConfig {
  const owner: EnemyTargetProfile = {
    id: OWNER_ID,
    name: "Burning owner",
    position: { x: 0, y: 0 },
    hitboxRadius: 0,
    initialAura: [{ element: "dendro", gaugeUnits: 4 }]
  };
  const recipient: EnemyTargetProfile = {
    id: "frozen-recipient",
    name: "Frozen boundary recipient",
    position: { x: 2, y: 0 },
    hitboxRadius: 0,
    initialAura: [{ element: "cryo", gaugeUnits: 1 }]
  };

  return makeV3Scenario({
    id: ownerBeforeRecipient
      ? "frozen-owner-first"
      : "frozen-recipient-first",
    durationFrames: 182,
    targets: ownerBeforeRecipient
      ? [owner, recipient]
      : [recipient, owner],
    targetMotions: [
      {
        id: "recipient-enters-burning-radius",
        label: "Recipient enters Burning radius at F176",
        targetId: recipient.id,
        startFrame: 175,
        endFrame: 176,
        endPosition: { x: 0.5, y: 0 }
      }
    ],
    hits: [
      {
        id: "freeze-at-f0",
        label: "Freeze recipient at F0",
        frame: 0,
        scaling: 0,
        element: "hydro",
        targeting: {
          targetId: recipient.id,
          outcome: "landed"
        },
        application: {
          gaugeUnits: 1,
          icdTag: "freeze-at-f0",
          icdGroup: "no-icd"
        }
      },
      {
        id: "start-burning-at-f56",
        label: "Start Burning at F56",
        frame: 56,
        scaling: 0,
        element: "pyro",
        geometry: {
          kind: "circle",
          coordinateSpace: "world",
          origin: { x: 0, y: 0 },
          radius: 0
        },
        application: {
          gaugeUnits: 1,
          icdTag: "start-burning-at-f56",
          icdGroup: "no-icd"
        }
      }
    ]
  });
}

function makeHitlagConfig(): SimConfig {
  return makeV3Scenario({
    id: "hitlag-reprojection",
    durationFrames: 30,
    targets: [
      {
        id: OWNER_ID,
        name: "Hitlag Burning owner",
        position: { x: 0, y: 0 },
        hitboxRadius: 0,
        initialAura: [
          { element: "dendro", gaugeUnits: 1 }
        ]
      },
      {
        id: "hitlag-recipient",
        name: "Hitlag callback recipient",
        position: { x: 0.5, y: 0 },
        hitboxRadius: 0
      }
    ],
    targetClockModel: { mode: "target-local-hitlag-v1" },
    hits: [
      {
        id: "start-burning-with-hitlag",
        label: "Start Burning with five target-local frames of Hitlag",
        frame: 0,
        scaling: 0,
        element: "pyro",
        geometry: {
          kind: "circle",
          coordinateSpace: "world",
          origin: { x: 0, y: 0 },
          radius: 0
        },
        application: {
          gaugeUnits: 1,
          icdTag: "start-burning-with-hitlag",
          icdGroup: "no-icd"
        },
        targetHitlag: {
          haltFrames: 5,
          factor: 0
        }
      }
    ]
  });
}

function makeOverloadChildConfig(): SimConfig {
  return makeV3Scenario({
    id: "overload-positive-delay-child",
    durationFrames: 20,
    targets: [
      {
        id: OWNER_ID,
        name: "Burning owner",
        position: { x: 0, y: 0 },
        hitboxRadius: 0,
        initialAura: [
          { element: "dendro", gaugeUnits: 1 }
        ]
      },
      {
        id: "electro-recipient",
        name: "Electro callback recipient",
        position: { x: 0.5, y: 0 },
        hitboxRadius: 0,
        initialAura: [
          { element: "electro", gaugeUnits: 1 }
        ]
      }
    ],
    hits: [
      {
        id: "start-burning",
        label: "Start Burning",
        frame: 0,
        scaling: 0,
        element: "pyro",
        geometry: {
          kind: "circle",
          coordinateSpace: "world",
          origin: { x: 0, y: 0 },
          radius: 0
        },
        application: {
          gaugeUnits: 1,
          icdTag: "start-burning",
          icdGroup: "no-icd"
        }
      }
    ]
  });
}

function makeAttemptCoverageConfig(): SimConfig {
  return makeV3Scenario({
    id: "attempt-coverage",
    durationFrames: 20,
    allowUnresolvedPositions: true,
    targets: [
      {
        id: "before-owner",
        name: "Before owner",
        position: { x: 0.5, y: 0 },
        hitboxRadius: 0
      },
      {
        id: OWNER_ID,
        name: "Burning owner",
        position: { x: 0, y: 0 },
        hitboxRadius: 0,
        initialAura: [
          { element: "dendro", gaugeUnits: 1 }
        ]
      },
      {
        id: "outside-radius",
        name: "Outside Burning radius",
        position: { x: 5, y: 0 },
        hitboxRadius: 0
      },
      {
        id: "unresolved-position",
        name: "Unresolved position",
        hitboxRadius: 0
      }
    ],
    hits: [
      {
        id: "start-burning",
        label: "Start Burning",
        frame: 0,
        scaling: 0,
        element: "pyro",
        targeting: {
          targetId: OWNER_ID,
          outcome: "landed"
        },
        application: {
          gaugeUnits: 1,
          icdTag: "start-burning",
          icdGroup: "no-icd"
        }
      }
    ]
  });
}

describe("target-phase-v3 synchronous Burning delivery", () => {
  it.each([
    {
      ownerBeforeRecipient: true,
      expectedApplicationPhase: "before-reactable-tick" as const,
      expectedReaction: "melt",
      expectedTransition: false
    },
    {
      ownerBeforeRecipient: false,
      expectedApplicationPhase: "after-reactable-tick" as const,
      expectedReaction: "none",
      expectedTransition: true
    }
  ])(
    "orders the F176 callback against exact Frozen expiry when ownerBeforeRecipient=$ownerBeforeRecipient",
    ({
      ownerBeforeRecipient,
      expectedApplicationPhase,
      expectedReaction,
      expectedTransition
    }) => {
      const result = simulate(
        makeFrozenBoundaryConfig(ownerBeforeRecipient),
        { critMode: "noCrit" }
      );
      expectCurrentV144Result(result);

      const { phase: ownerPhase, task, delivery } =
        burningDeliveryAt(result, 176, 8);
      const recipientPhase = v3PhaseAt(
        result,
        176,
        "frozen-recipient"
      );
      const recipientAttempt = attemptFor(
        delivery,
        "frozen-recipient"
      );

      expect(ownerPhase.targetId).toBe(OWNER_ID);
      expect(recipientAttempt).toMatchObject({
        outcome: "landed",
        applicationPhase: expectedApplicationPhase
      });
      if (recipientAttempt.outcome !== "landed") {
        throw new Error("Frozen recipient must be landed.");
      }

      const callbackHit =
        result.hitResolutionLog[
          recipientAttempt.hitResolutionLogId
        ]!;
      const callbackDamage =
        result.damageEvents[recipientAttempt.damageEventId]!;
      const callbackTimelinePoint =
        result.targetStateTimeline.points[
          recipientAttempt.targetStateTimelinePointId
        ]!;
      expect(callbackHit).toMatchObject({
        frame: 176,
        targetId: "frozen-recipient",
        eventPriority: delivery.eventPriority,
        eventSequence: delivery.eventSequence
      });
      expect(callbackDamage).toMatchObject({
        frame: 176,
        targetId: "frozen-recipient",
        reaction: "burning",
        eventPriority: delivery.eventPriority,
        eventSequence: delivery.eventSequence,
        reactionAudit: { reaction: expectedReaction }
      });
      expect(callbackTimelinePoint).toMatchObject({
        frame: 176,
        targetId: "frozen-recipient",
        eventPriority: delivery.eventPriority,
        eventSequence: delivery.eventSequence,
        primaryDamageEventId: callbackDamage.id
      });
      expect(task.eventPriority).toBeLessThan(
        delivery.eventPriority
      );
      expect(task.eventSequence).toBeLessThan(
        delivery.eventSequence
      );

      expect(
        recipientPhase.reactableTick.transitions.some(
          (transition) => transition.kind === "frozen-expiry"
        )
      ).toBe(expectedTransition);
      expect(
        result.frozenStateLog.some(
          (entry) =>
            entry.frame === 176 &&
            entry.targetId === "frozen-recipient" &&
            entry.operation ===
              (ownerBeforeRecipient ? "consume" : "expire")
        )
      ).toBe(true);

      if (ownerBeforeRecipient) {
        expect(
          callbackDamage.damageFactors
            .amplifyingReactionMultiplier
        ).toBeGreaterThan(1);
        expect(
          recipientPhase.reactableTick.auraBefore.some(
            (aura) => aura.element === "frozen"
          )
        ).toBe(false);
      } else {
        expect(
          callbackDamage.damageFactors
            .amplifyingReactionMultiplier
        ).toBe(1);
        const expiry = recipientPhase.reactableTick.transitions.find(
          (transition) => transition.kind === "frozen-expiry"
        );
        expect(expiry).toBeDefined();
        expect(
          callbackTimelinePoint.id
        ).toBeGreaterThan(expiry!.targetStateTimelinePointId);
      }
    }
  );

  it("reprojects an F15 owner callback to F20 under five target-local Hitlag frames without changing delivery order", () => {
    const result = simulate(makeHitlagConfig(), {
      critMode: "noCrit"
    });
    expectCurrentV144Result(result);

    const { phase, task, delivery } = burningDeliveryAt(
      result,
      20,
      1
    );
    expect(phase).toMatchObject({
      targetId: OWNER_ID,
      globalFrame: 20,
      targetFrame: 15
    });
    expect(task).toMatchObject({
      deadlineTargetFrame: 15,
      status: "applied"
    });
    expect(delivery.attempts.map((attempt) => ({
      order: attempt.order,
      targetId: attempt.targetId,
      applicationPhase: attempt.applicationPhase,
      outcome: attempt.outcome
    }))).toEqual([
      {
        order: 0,
        targetId: OWNER_ID,
        applicationPhase: "before-reactable-tick",
        outcome: "landed"
      },
      {
        order: 1,
        targetId: "hitlag-recipient",
        applicationPhase: "before-reactable-tick",
        outcome: "landed"
      }
    ]);
    expect(task.eventPriority).toBeLessThan(
      delivery.eventPriority
    );
    expect(task.eventSequence).toBeLessThan(
      delivery.eventSequence
    );
    expect(
      result.burningStateLog.some(
        (entry) =>
          entry.operation === "tick" &&
          entry.tickIndex === 1 &&
          entry.frame === 15
      )
    ).toBe(false);
    expect(
      result.burningStateLog.find(
        (entry) =>
          entry.operation === "tick" &&
          entry.tickIndex === 1
      )
    ).toMatchObject({ frame: 20, targetFrame: 15 });
    expect(result.targetHitlagLog).toEqual([
      expect.objectContaining({
        globalFrame: 0,
        targetId: OWNER_ID,
        haltFrames: 5,
        factor: 0,
        extensionFrames: 5,
        applied: true,
        blockedReason: null
      }),
      expect.objectContaining({
        globalFrame: 0,
        targetId: "hitlag-recipient",
        haltFrames: 5,
        factor: 0,
        extensionFrames: 5,
        applied: false,
        blockedReason: "TARGET_MISS"
      })
    ]);
  });

  it("keeps an Overload child on the global heap at F16 instead of folding it into the F15 callback delivery", () => {
    const result = simulate(makeOverloadChildConfig(), {
      critMode: "noCrit"
    });
    expectCurrentV144Result(result);

    const { delivery } = burningDeliveryAt(result, 15, 1);
    const recipientAttempt = attemptFor(
      delivery,
      "electro-recipient"
    );
    expect(recipientAttempt.outcome).toBe("landed");
    if (recipientAttempt.outcome !== "landed") {
      throw new Error("Electro recipient must be landed.");
    }
    const rootDamage =
      result.damageEvents[recipientAttempt.damageEventId]!;
    expect(rootDamage).toMatchObject({
      frame: 15,
      reaction: "burning",
      reactionAudit: { reaction: "overload" }
    });

    const overloadLog = result.reactionDamageLog.find(
      (entry) =>
        entry.reaction === "overload" &&
        entry.triggerDamageEventId === rootDamage.id
    );
    expect(overloadLog).toMatchObject({
      triggerFrame: 15,
      damageFrame: 16,
      scheduled: true,
      withinSimulation: true
    });
    expect(overloadLog!.id).not.toBe(
      delivery.reactionDamageLogId
    );
    expect(overloadLog!.damageEventIds.length).toBeGreaterThan(0);
    expect(
      overloadLog!.damageEventIds.map(
        (id) => result.damageEvents[id]!.frame
      )
    ).toEqual(
      overloadLog!.damageEventIds.map(() => 16)
    );
    expect(
      delivery.attempts.some(
        (attempt) =>
          attempt.damageEventId !== null &&
          overloadLog!.damageEventIds.includes(
            attempt.damageEventId
          )
      )
    ).toBe(false);

    const overloadResolutionIds = overloadLog!.damageEventIds.map(
      (id) => result.damageEvents[id]!.targetResolutionId
    );
    expect(
      result.targetPhaseLog
        .filter(
          (phase) =>
            phase.model === "target-phase-v3" &&
            phase.globalFrame === 16
        )
        .flatMap((phase) => phase.hitResolutionLogIds)
    ).toEqual(expect.arrayContaining(overloadResolutionIds));
  });

  it("records landed, miss, and true unresolved callback attempts in enemy registration order", () => {
    const result = simulate(makeAttemptCoverageConfig(), {
      critMode: "noCrit"
    });
    expectCurrentV144Result(result);

    const { delivery } = burningDeliveryAt(result, 15, 1);
    expect(delivery.attempts).toEqual([
      expect.objectContaining({
        order: 0,
        targetId: "before-owner",
        targetOrder: 0,
        applicationPhase: "after-reactable-tick",
        outcome: "landed",
        hitResolutionLogId: expect.any(Number),
        damageEventId: expect.any(Number),
        targetStateTimelinePointId: expect.any(Number)
      }),
      expect.objectContaining({
        order: 1,
        targetId: OWNER_ID,
        targetOrder: 1,
        applicationPhase: "before-reactable-tick",
        outcome: "landed",
        hitResolutionLogId: expect.any(Number),
        damageEventId: expect.any(Number),
        targetStateTimelinePointId: expect.any(Number)
      }),
      {
        order: 2,
        targetId: "outside-radius",
        targetOrder: 2,
        applicationPhase: "before-reactable-tick",
        outcome: "miss",
        hitResolutionLogId: expect.any(Number),
        damageEventId: null,
        targetStateTimelinePointId: null
      },
      {
        order: 3,
        targetId: "unresolved-position",
        targetOrder: 3,
        applicationPhase: "before-reactable-tick",
        outcome: "unresolved",
        hitResolutionLogId: null,
        damageEventId: null,
        targetStateTimelinePointId: null
      }
    ]);

    const reactionLog =
      result.reactionDamageLog[
        delivery.reactionDamageLogId
      ]!;
    expect(reactionLog).toMatchObject({
      checkedTargetIds: [
        "before-owner",
        OWNER_ID,
        "outside-radius"
      ],
      hitTargetIds: ["before-owner", OWNER_ID],
      unresolvedTargetIds: ["unresolved-position"]
    });
  });

  it("is byte-for-byte deterministic for identical config, data identity, and seed", () => {
    const config = makeAttemptCoverageConfig();
    const first = simulate(config, { critMode: "noCrit" });
    const second = simulate(config, { critMode: "noCrit" });

    expectCurrentV144Result(first);
    expectCurrentV144Result(second);
    expect(second).toStrictEqual(first);
  });
});
