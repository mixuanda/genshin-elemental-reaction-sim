import {
  assertTrustedSimulationResult,
  electroChargedCleanupResultReferencesSchema,
  simulationResultSchema,
  type AuraReactionEngineConfig,
  type FrameHitDefinition,
  type SimConfig,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

type CleanupMode = Extract<
  AuraReactionEngineConfig["mode"],
  "aura-v7" | "aura-v8"
>;

const SAME_TARGET_GEOMETRY = {
  kind: "circle" as const,
  coordinateSpace: "world" as const,
  origin: { x: 0, y: 0 },
  radius: 1,
};

function expectAcceptedAtBothResultBoundaries(
  result: ReturnType<typeof simulate>,
): void {
  expect(simulationResultSchema.parse(result)).toEqual(result);
  expect(assertTrustedSimulationResult(result)).toBe(result);
}

function expectRejectedAtBothResultBoundaries(
  result: ReturnType<typeof simulate>,
): void {
  expect(simulationResultSchema.safeParse(result).success).toBe(
    false,
  );
  expect(() =>
    assertTrustedSimulationResult(result),
  ).toThrow(
    /Trusted SimulationResult 1\.46 integrity validation failed/,
  );
}

function applicationHit({
  id,
  element,
  gaugeUnits,
  hitlagFrames,
}: {
  id: string;
  element: NonNullable<FrameHitDefinition["element"]>;
  gaugeUnits: number;
  hitlagFrames?: number;
}): FrameHitDefinition {
  return {
    id,
    label: id,
    frame: 0,
    scaling: 0,
    element,
    geometry: SAME_TARGET_GEOMETRY,
    application: {
      gaugeUnits,
      icdTag: id,
      icdGroup: "no-icd",
    },
    ...(hitlagFrames === undefined
      ? {}
      : {
          targetHitlag: {
            haltFrames: hitlagFrames,
            factor: 0,
          },
        }),
  };
}

function makeCleanupConfig({
  mode = "aura-v8",
  hydroGaugeUnits = 1,
  hitlagFrames,
  durationFrames = 90,
  startFrame = 0,
}: {
  mode?: CleanupMode;
  hydroGaugeUnits?: number;
  hitlagFrames?: number;
  durationFrames?: number;
  startFrame?: number;
} = {}): SimConfig {
  const base = makeConfig();
  const hits = [
    applicationHit({
      id: "dendro-quicken",
      element: "dendro",
      gaugeUnits: 0.8,
    }),
    applicationHit({
      id: "electro-stream",
      element: "electro",
      gaugeUnits: 0.8,
      ...(hitlagFrames === undefined ? {} : { hitlagFrames }),
    }),
  ];
  return {
    ...base,
    dataVersion: "ec-quicken-cleanup-provisional-1",
    randomSeed: `ec-quicken-cleanup-${mode}-${hydroGaugeUnits}-${hitlagFrames ?? 0}-${durationFrames}-${startFrame}`,
    meta: {
      name: "EC cleanup after Quicken to Bloom",
      version: "1.40.0",
      verificationStatus: "provisional",
    },
    duration: durationFrames / 60,
    cycleLength: Math.max(1, durationFrames / 60),
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Hydro Electro target",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            {
              element: "hydro",
              gaugeUnits: hydroGaugeUnits,
            },
            { element: "electro", gaugeUnits: 1 },
          ],
        },
      ],
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "driver",
        name: "Reaction driver",
        element: "dendro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0,
        },
      },
    ],
    rotation: [],
    reactionEngine: { mode },
    targetClockModel:
      hitlagFrames === undefined
        ? { mode: "disabled" }
        : { mode: "target-local-hitlag-v1" },
    targetTaskModel: { mode: "target-phase-v2" },
    reactionDeliveryModel: {
      mode: "deferred-event-heap-v1",
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "driver",
      swapFrames: 1,
      abilities: [
        {
          id: "compound-chain",
          actorId: "driver",
          name: "Compound reaction chain",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits,
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "driver",
          abilityId: "compound-chain",
          atFrame: startFrame,
        },
      ],
    },
  };
}

function makeDelayedCleanupConfig(
  cleanupFrame = 5,
  cleanupGaugeUnits = 0.5,
): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    dataVersion: "ec-delayed-cleanup-provisional-1",
    randomSeed: `ec-delayed-cleanup-${cleanupFrame}`,
    meta: {
      name: "EC start F0 and delayed cleanup",
      version: "1.40.0",
      verificationStatus: "provisional",
    },
    duration: 90 / 60,
    cycleLength: 2,
    enemy: {
      ...base.enemy,
      targets: [
        {
          id: "enemy-0",
          name: "e",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
        },
      ],
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "driver",
        name: "Reaction driver",
        element: "dendro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0,
        },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v8" },
    targetClockModel: { mode: "disabled" },
    targetTaskModel: { mode: "target-phase-v2" },
    reactionDeliveryModel: {
      mode: "deferred-event-heap-v1",
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "driver",
      swapFrames: 1,
      abilities: [
        {
          id: "start",
          actorId: "driver",
          name: "Start EC",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            applicationHit({
              id: "start-hydro",
              element: "hydro",
              gaugeUnits: 1,
            }),
            applicationHit({
              id: "start-electro",
              element: "electro",
              gaugeUnits: 1,
            }),
          ],
        },
        {
          id: "q",
          actorId: "driver",
          name: "Delayed Quicken",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            applicationHit({
              id: "q-dendro",
              element: "dendro",
              gaugeUnits: cleanupGaugeUnits,
            }),
          ],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "driver",
          abilityId: "start",
          atFrame: 0,
        },
        {
          type: "skill",
          actorId: "driver",
          abilityId: "q",
          atFrame: cleanupFrame,
        },
      ],
    },
  };
}

function makeLateCleanupConfig({
  mode = "aura-v8",
  cleanupFrame,
  cleanupGaugeUnits = 0.5,
  restartFrame,
  durationFrames = 90,
}: {
  mode?: CleanupMode;
  cleanupFrame: number;
  cleanupGaugeUnits?: number;
  restartFrame?: number;
  durationFrames?: number;
}): SimConfig {
  const config = makeDelayedCleanupConfig(
    cleanupFrame,
    cleanupGaugeUnits,
  );
  config.reactionEngine = { mode };
  config.duration = durationFrames / 60;
  config.cycleLength = durationFrames / 60;
  config.randomSeed = `ec-late-cleanup-${mode}-${cleanupFrame}-${restartFrame ?? "none"}-${durationFrames}`;
  config.meta = {
    ...config.meta,
    name: "EC late cleanup generation isolation",
  };
  const timeline = config.timeline;
  if (timeline === undefined) {
    throw new Error("Expected legal-frame timeline.");
  }
  if (restartFrame === undefined) {
    return config;
  }
  timeline.abilities.push({
    id: "restart",
    actorId: "driver",
    name: "Restart EC",
    kind: "skill",
    cancelFrame: 1,
    animationEndFrame: 1,
    cooldownFrames: 0,
    hits: [
      applicationHit({
        id: "restart-hydro-clear-quicken",
        element: "hydro",
        gaugeUnits: 1,
      }),
      applicationHit({
        id: "restart-hydro-restore-coexistence",
        element: "hydro",
        gaugeUnits: 1,
      }),
    ],
  });
  timeline.commands.push({
    type: "skill",
    actorId: "driver",
    abilityId: "restart",
    atFrame: restartFrame,
  });
  return config;
}

function makeNaturalExpiryCollisionConfig(): SimConfig {
  const config = makeCleanupConfig({
    hydroGaugeUnits: 2,
    hitlagFrames: 5,
  });
  const timeline = config.timeline;
  if (timeline === undefined) {
    throw new Error("Expected legal-frame timeline.");
  }
  const addFollowupHit = ({
    id,
    element,
    gaugeUnits,
    atFrame,
  }: {
    id: string;
    element: NonNullable<FrameHitDefinition["element"]>;
    gaugeUnits: number;
    atFrame: number;
  }): void => {
    timeline.abilities.push({
      id,
      actorId: "driver",
      name: id,
      kind: "skill",
      cancelFrame: 1,
      animationEndFrame: 1,
      cooldownFrames: 0,
      hits: [
        applicationHit({
          id: `${id}-hit`,
          element,
          gaugeUnits,
        }),
      ],
    });
    timeline.commands.push({
      type: "skill",
      actorId: "driver",
      abilityId: id,
      atFrame,
    });
  };

  // The first follow-up consumes 1.6U Hydro and the full 0.8U Quicken
  // state. During the five frozen target frames, Hydro can therefore attach
  // normally, a smaller Dendro application leaves 0.001U Hydro, and a final
  // Electro refresh schedules that coexistence boundary at target F1 / G6.
  addFollowupHit({
    id: "restore-hydro",
    element: "hydro",
    gaugeUnits: 1,
    atFrame: 1,
  });
  addFollowupHit({
    id: "trim-hydro",
    element: "dendro",
    gaugeUnits: 0.3995,
    atFrame: 2,
  });
  addFollowupHit({
    id: "refresh-electro-expiry",
    element: "electro",
    gaugeUnits: 0.1,
    atFrame: 3,
  });
  return config;
}

function electroChargedDamageFrames(
  result: ReturnType<typeof simulate>,
): number[] {
  return result.damageEvents
    .filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "electroCharged",
    )
    .map((event) => event.frame);
}

type CleanupSimulationResult = ReturnType<typeof simulate>;
type CleanupResultMutation = (
  result: CleanupSimulationResult,
) => void;

function requirePeriodicRow(
  result: CleanupSimulationResult,
  frame: number,
  operation:
    | "start"
    | "refresh"
    | "tick"
    | "wane"
    | "wane-skipped"
    | "stop",
  generation = 1,
) {
  const row = result.periodicReactionLog.find(
    (entry) =>
      entry.reaction === "electroCharged" &&
      entry.generation === generation &&
      entry.operation === operation &&
      entry.frame === frame,
  );
  if (row === undefined) {
    throw new Error(
      `Expected generation ${generation} ${operation} row at F${frame}.`,
    );
  }
  return row;
}

function expectCleanupMutationsRejected(
  base: CleanupSimulationResult,
  mutations: ReadonlyArray<
    readonly [name: string, mutate: CleanupResultMutation]
  >,
): void {
  expect(
    electroChargedCleanupResultReferencesSchema.safeParse(base).success,
  ).toBe(true);
  for (const [name, mutate] of mutations) {
    const result = structuredClone(base);
    mutate(result);
    expect(
      electroChargedCleanupResultReferencesSchema.safeParse(result).success,
      name,
    ).toBe(false);
  }
}

function assertStoppedCleanup(
  result: ReturnType<typeof simulate>,
  expectedGlobalFrame: number,
): void {
  const [reactionTask] = result.reactionTaskLog;
  expect(reactionTask?.electroChargedCleanup).toEqual({
    generation: 1,
    requestedTargetFrame: 0,
    deadlineTargetFrame: 1,
    requestReason: "QUICKEN_BLOOM_DEPLETED_LAST_HYDRO",
    outcome: "stop",
    resolutionReason: "COEXISTING_AURA_REMOVED_BY_QUICKEN_BLOOM",
    resolvedGlobalFrame: expectedGlobalFrame,
    resolvedTargetFrame: 1,
    targetPhaseLogId: expect.any(Number),
    periodicReactionLogId: expect.any(Number),
    targetStateTimelinePointId: expect.any(Number),
  });
  const cleanup = reactionTask!.electroChargedCleanup!;
  if (cleanup.outcome !== "stop") {
    throw new Error("Expected a resolved EC cleanup stop.");
  }
  const phase = result.targetPhaseLog[cleanup.targetPhaseLogId];
  const transition = phase?.reactableTick.transitions.find(
    (candidate) => candidate.kind === "electro-charged-cleanup",
  );
  expect(phase).toMatchObject({
    globalFrame: expectedGlobalFrame,
    targetFrame: 1,
    targetId: "enemy-0",
  });
  expect(transition).toEqual({
    stage: "reactable-tick",
    kind: "electro-charged-cleanup",
    order: expect.any(Number),
    deadlineTargetFrame: 1,
    generation: 1,
    reactionTaskLogId: reactionTask!.id,
    outcome: "stop",
    periodicReactionLogId: cleanup.periodicReactionLogId,
    targetStateTimelinePointId: cleanup.targetStateTimelinePointId,
  });

  const stop = result.periodicReactionLog[cleanup.periodicReactionLogId];
  expect(stop).toMatchObject({
    reaction: "electroCharged",
    generation: 1,
    operation: "stop",
    frame: expectedGlobalFrame,
    targetFrame: 1,
    reactionTaskLogId: reactionTask!.id,
    nextTickFrame: null,
    waneFrame: null,
    reason: "COEXISTING_AURA_REMOVED_BY_QUICKEN_BLOOM",
  });
  expect(stop?.auraBefore).toEqual(stop?.auraAfter);

  const point =
    result.targetStateTimeline.points[cleanup.targetStateTimelinePointId];
  expect(point).toMatchObject({
    frame: expectedGlobalFrame,
    targetFrame: 1,
    pointKind: "observation",
    cause: "electro-charged-cleanup",
    eventType: "electroChargedCleanup",
    reaction: "electroCharged",
  });
  expect(point?.auraBefore).toEqual(point?.auraAfter);
  expect(point?.links).toEqual(
    expect.arrayContaining([
      {
        kind: "periodic-reaction-log",
        id: cleanup.periodicReactionLogId,
      },
      {
        kind: "target-phase-log",
        id: cleanup.targetPhaseLogId,
      },
    ]),
  );

  const ticks = result.periodicReactionLog.filter(
    (entry) =>
      entry.reaction === "electroCharged" && entry.operation === "tick",
  );
  expect(ticks.map((entry) => entry.frame)).toEqual([10]);
  expect(ticks[0]).toMatchObject({
    generation: 1,
    tickIndex: 0,
    nextTickFrame: null,
    waneFrame: null,
    reason: "QUEUED_FIRST_TICK_AFTER_STREAM_STOP",
  });
  expect(
    result.periodicReactionLog.some(
      (entry) =>
        entry.reaction === "electroCharged" &&
        (entry.operation === "wane" ||
          entry.operation === "wane-skipped" ||
          (entry.operation === "tick" && entry.frame === 70)),
    ),
  ).toBe(false);
  expect(electroChargedDamageFrames(result)).toEqual([10]);
}

describe("aura-v8 Quicken to Bloom Electro-Charged cleanup", () => {
  it("stops generation 1 at F1 while preserving the pinned F10 hit and suppressing F16/F70", () => {
    const result = simulate(makeCleanupConfig(), {
      critMode: "noCrit",
    });
    assertStoppedCleanup(result, 1);
  });

  it("keeps generation 1's F10 pinned hit when Quicken to Bloom requests cleanup at F5", () => {
    const result = simulate(makeDelayedCleanupConfig(), {
      critMode: "noCrit",
    });
    const task = result.reactionTaskLog[0];
    expect(task).toMatchObject({
      frame: 5,
      electroChargedCleanup: {
        generation: 1,
        requestedTargetFrame: 5,
        deadlineTargetFrame: 6,
        outcome: "stop",
        resolvedGlobalFrame: 6,
        resolvedTargetFrame: 6,
      },
    });
    expect(
      result.periodicReactionLog.filter(
        (entry) =>
          entry.targetId === task?.targetId &&
          entry.generation ===
            task?.electroChargedCleanup?.generation &&
          entry.operation === "start",
      ),
    ).toEqual([
      expect.objectContaining({
        frame: 0,
        generation: 1,
      }),
    ]);
    expect(electroChargedDamageFrames(result)).toEqual([10]);
    expect(() =>
      electroChargedCleanupResultReferencesSchema.parse(result),
    ).not.toThrow();
  });

  it("stops a late F11 cleanup at F12 without dispatching the already queued F16 wane or F70 tick", () => {
    const result = simulate(
      makeLateCleanupConfig({
        cleanupFrame: 11,
      }),
      { critMode: "noCrit" },
    );
    const task = result.reactionTaskLog.find(
      (candidate) => candidate.electroChargedCleanup !== null,
    );
    expect(task).toMatchObject({
      frame: 11,
      electroChargedCleanup: {
        generation: 1,
        requestedTargetFrame: 11,
        deadlineTargetFrame: 12,
        outcome: "stop",
        resolvedGlobalFrame: 12,
        resolvedTargetFrame: 12,
      },
    });
    const generationOne = result.periodicReactionLog.filter(
      (entry) =>
        entry.reaction === "electroCharged" && entry.generation === 1,
    );
    expect(generationOne).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: "start",
          frame: 0,
        }),
        expect.objectContaining({
          operation: "tick",
          frame: 10,
          waneFrame: 16,
        }),
        expect.objectContaining({
          operation: "stop",
          frame: 12,
          reason: "COEXISTING_AURA_REMOVED_BY_QUICKEN_BLOOM",
        }),
      ]),
    );
    expect(
      generationOne.some(
        (entry) =>
          (entry.frame === 16 &&
            (entry.operation === "wane" ||
              entry.operation === "wane-skipped")) ||
          (entry.frame === 70 && entry.operation === "tick"),
      ),
    ).toBe(false);
    expect(
      result.targetStateTimeline.points.some(
        (point) =>
          point.frame === 16 &&
          point.cause === "electro-charged-wane",
      ),
    ).toBe(false);
    expect(electroChargedDamageFrames(result)).toEqual([10]);
    expect(() =>
      electroChargedCleanupResultReferencesSchema.parse(result),
    ).not.toThrow();
  });

  it("preserves aura-v7's historical cross-generation F16 wane while aura-v8 isolates the F13 restart", () => {
    const legacyResult = simulate(
      makeLateCleanupConfig({
        mode: "aura-v7",
        cleanupFrame: 11,
        restartFrame: 13,
      }),
      { critMode: "noCrit" },
    );
    expect(
      legacyResult.periodicReactionLog.find(
        (entry) =>
          entry.reaction === "electroCharged" &&
          entry.generation === 2 &&
          entry.frame === 16 &&
          entry.operation === "wane",
      ),
    ).toMatchObject({
      reason: "AURA_DEPLETED_BY_WANE",
      nextTickFrame: null,
      coexistenceExpiresAtFrame: null,
    });
    expect(
      legacyResult.periodicReactionLog.find(
        (entry) =>
          entry.reaction === "electroCharged" &&
          entry.generation === 2 &&
          entry.frame === 23 &&
          entry.operation === "tick",
      ),
    ).toMatchObject({
      nextTickFrame: null,
      waneFrame: null,
      reason: "QUEUED_FIRST_TICK_AFTER_STREAM_STOP",
    });
    expectAcceptedAtBothResultBoundaries(legacyResult);
    const legacyWane = legacyResult.periodicReactionLog.find(
      (entry) =>
        entry.generation === 2 &&
        entry.frame === 16 &&
        entry.operation === "wane",
    );
    if (legacyWane === undefined) {
      throw new Error("Expected the historical cross-generation Wane.");
    }

    const forgedTickIndex = structuredClone(legacyResult);
    forgedTickIndex.periodicReactionLog[legacyWane.id]!.tickIndex = 1;
    expectRejectedAtBothResultBoundaries(forgedTickIndex);

    const forgedCallbackGeneration = structuredClone(legacyResult);
    forgedCallbackGeneration.periodicReactionLog[
      legacyWane.id
    ]!.generation = 1;
    expectRejectedAtBothResultBoundaries(
      forgedCallbackGeneration,
    );

    const result = simulate(
      makeLateCleanupConfig({
        cleanupFrame: 11,
        restartFrame: 13,
      }),
      { critMode: "noCrit" },
    );
    const cleanup = result.reactionTaskLog.find(
      (task) => task.electroChargedCleanup?.generation === 1,
    )?.electroChargedCleanup;
    expect(cleanup).toMatchObject({
      outcome: "stop",
      resolvedGlobalFrame: 12,
      resolvedTargetFrame: 12,
    });

    const generationTwo = result.periodicReactionLog.filter(
      (entry) =>
        entry.reaction === "electroCharged" && entry.generation === 2,
    );
    expect(generationTwo).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: "start",
          frame: 13,
        }),
        expect.objectContaining({
          operation: "tick",
          frame: 23,
          reason: null,
        }),
        expect.objectContaining({
          operation: "wane-skipped",
          frame: 29,
          reason: "ZERO_ACTUAL_DAMAGE",
        }),
        expect.objectContaining({
          operation: "tick",
          frame: 83,
        }),
        expect.objectContaining({
          operation: "wane",
          frame: 89,
        }),
      ]),
    );
    expect(
      result.periodicReactionLog.some(
        (entry) =>
          entry.reaction === "electroCharged" &&
          entry.generation === 1 &&
          entry.frame === 16 &&
          (entry.operation === "wane" ||
            entry.operation === "wane-skipped"),
      ),
    ).toBe(false);
    expect(
      result.targetStateTimeline.points.some(
        (point) =>
          point.frame === 16 &&
          point.cause === "electro-charged-wane",
      ),
    ).toBe(false);
    expect(electroChargedDamageFrames(result)).toEqual([10, 23, 83]);
    expect(() =>
      electroChargedCleanupResultReferencesSchema.parse(result),
    ).not.toThrow();
    expectAcceptedAtBothResultBoundaries(result);

    const forgedRestartGeneration = structuredClone(result);
    for (const event of [
      ...forgedRestartGeneration.damageEvents,
      ...forgedRestartGeneration.hitEvents,
    ]) {
      const audit = event.reactionAudit.periodicReaction;
      if (audit?.generation === 2) audit.generation = 3;
    }
    for (const row of forgedRestartGeneration.periodicReactionLog) {
      if (row.generation === 2) row.generation = 3;
    }
    for (const parent of forgedRestartGeneration.reactionDamageLog) {
      if (parent.electroChargedPropagation?.generation === 2) {
        parent.electroChargedPropagation.generation = 3;
      }
    }
    expectRejectedAtBothResultBoundaries(
      forgedRestartGeneration,
    );
  });

  it("preserves the historical F16 wane when cleanup starts at F17, then suppresses F70", () => {
    const result = simulate(
      makeLateCleanupConfig({
        cleanupFrame: 17,
        cleanupGaugeUnits: 0.2,
      }),
      { critMode: "noCrit" },
    );
    expect(
      result.reactionTaskLog.find(
        (task) => task.electroChargedCleanup !== null,
      ),
    ).toMatchObject({
      frame: 17,
      electroChargedCleanup: {
        generation: 1,
        outcome: "stop",
        resolvedGlobalFrame: 18,
        resolvedTargetFrame: 18,
      },
    });
    const generationOne = result.periodicReactionLog.filter(
      (entry) =>
        entry.reaction === "electroCharged" && entry.generation === 1,
    );
    expect(
      generationOne.filter(
        (entry) =>
          entry.frame === 16 &&
          (entry.operation === "wane" ||
            entry.operation === "wane-skipped"),
      ),
    ).toEqual([
      expect.objectContaining({
        operation: "wane",
      }),
    ]);
    expect(
      generationOne.some(
        (entry) =>
          entry.frame === 70 && entry.operation === "tick",
      ),
    ).toBe(false);
    expect(electroChargedDamageFrames(result)).toEqual([10]);
    expect(() =>
      electroChargedCleanupResultReferencesSchema.parse(result),
    ).not.toThrow();
  });

  it("preserves F10/F16/F70 before an F71 cleanup and suppresses the queued F76/F130 callbacks", () => {
    const result = simulate(
      makeLateCleanupConfig({
        cleanupFrame: 71,
        cleanupGaugeUnits: 0.2,
        durationFrames: 140,
      }),
      { critMode: "noCrit" },
    );
    expect(
      result.reactionTaskLog.find(
        (task) => task.electroChargedCleanup !== null,
      ),
    ).toMatchObject({
      frame: 71,
      electroChargedCleanup: {
        generation: 1,
        outcome: "stop",
        resolvedGlobalFrame: 72,
        resolvedTargetFrame: 72,
      },
    });
    const generationOne = result.periodicReactionLog.filter(
      (entry) =>
        entry.reaction === "electroCharged" && entry.generation === 1,
    );
    expect(
      generationOne
        .filter((entry) => entry.operation === "tick")
        .map((entry) => entry.frame),
    ).toEqual([10, 70]);
    expect(
      generationOne
        .filter(
          (entry) =>
            entry.operation === "wane" ||
            entry.operation === "wane-skipped",
        )
        .map((entry) => entry.frame),
    ).toEqual([16]);
    expect(
      generationOne.some(
        (entry) =>
          (entry.frame === 76 &&
            (entry.operation === "wane" ||
              entry.operation === "wane-skipped")) ||
          (entry.frame === 130 && entry.operation === "tick"),
      ),
    ).toBe(false);
    expect(electroChargedDamageFrames(result)).toEqual([10, 70]);
    expect(() =>
      electroChargedCleanupResultReferencesSchema.parse(result),
    ).not.toThrow();
  });

  it("rejects every forged F10 cadence or terminal lifecycle field around an L11 cleanup", () => {
    const base = simulate(
      makeLateCleanupConfig({
        cleanupFrame: 11,
      }),
      { critMode: "noCrit" },
    );
    expectCleanupMutationsRejected(base, [
      [
        "F10 next Tick must remain +60",
        (result) => {
          requirePeriodicRow(result, 10, "tick").nextTickFrame = 71;
        },
      ],
      [
        "F10 Wane must remain +6",
        (result) => {
          requirePeriodicRow(result, 10, "tick").waneFrame = 17;
        },
      ],
      [
        "F10 active tick cannot carry a stop reason",
        (result) => {
          requirePeriodicRow(result, 10, "tick").reason = "FORGED";
        },
      ],
      [
        "F10 source must remain the generation owner",
        (result) => {
          requirePeriodicRow(result, 10, "tick").sourceActorId =
            "forged-source";
        },
      ],
      [
        "F10 trigger must remain the generation owner trigger",
        (result) => {
          requirePeriodicRow(result, 10, "tick").triggerDamageEventId =
            999;
        },
      ],
      [
        "F10 target name must remain reciprocal",
        (result) => {
          requirePeriodicRow(result, 10, "tick").targetName =
            "forged-target";
        },
      ],
      [
        "F10 damage child cannot be detached",
        (result) => {
          requirePeriodicRow(result, 10, "tick").damageEventId = null;
        },
      ],
      [
        "F10 reaction damage next frame must match the tick",
        (result) => {
          const tick = requirePeriodicRow(result, 10, "tick");
          if (tick.reactionDamageLogId === null) {
            throw new Error("Expected F10 reaction damage.");
          }
          result.reactionDamageLog[
            tick.reactionDamageLogId
          ]!.nextAvailableFrame = 71;
        },
      ],
      [
        "F10 reaction damage must own its only damage child",
        (result) => {
          const tick = requirePeriodicRow(result, 10, "tick");
          if (tick.reactionDamageLogId === null) {
            throw new Error("Expected F10 reaction damage.");
          }
          result.reactionDamageLog[
            tick.reactionDamageLogId
          ]!.damageEventIds = [];
        },
      ],
      [
        "F10 damage child must point back to its trigger",
        (result) => {
          const tick = requirePeriodicRow(result, 10, "tick");
          if (tick.damageEventId === null) {
            throw new Error("Expected F10 damage child.");
          }
          const damage = result.damageEvents[tick.damageEventId]!;
          damage.parentDamageEventId =
            (damage.parentDamageEventId ?? 0) + 100;
        },
      ],
      [
        "F10 coexistence expiry must be derived from Aura",
        (result) => {
          requirePeriodicRow(
            result,
            10,
            "tick",
          ).coexistenceExpiresAtFrame = 999;
        },
      ],
      [
        "F10 timeline priority must remain periodic Tick priority",
        (result) => {
          const point = result.targetStateTimeline.points.find(
            (candidate) =>
              candidate.frame === 10 &&
              candidate.cause === "electro-charged-tick",
          );
          if (point === undefined) {
            throw new Error("Expected F10 Tick timeline point.");
          }
          point.eventPriority = 99;
        },
      ],
      [
        "stopped generation cannot refresh after L11 resolution",
        (result) => {
          const refresh = structuredClone(
            requirePeriodicRow(result, 0, "start"),
          );
          refresh.id = result.periodicReactionLog.length;
          refresh.operation = "refresh";
          refresh.frame = 16;
          refresh.timeSeconds = 16 / 60;
          result.periodicReactionLog.push(refresh);
        },
      ],
      [
        "cleanup stop must be the generation's only terminal row",
        (result) => {
          const task = result.reactionTaskLog.find(
            (candidate) =>
              candidate.electroChargedCleanup?.outcome === "stop",
          );
          const cleanup = task?.electroChargedCleanup;
          if (
            cleanup === undefined ||
            cleanup === null ||
            cleanup.outcome !== "stop"
          ) {
            throw new Error("Expected L11 cleanup stop.");
          }
          const stop = structuredClone(
            result.periodicReactionLog[
              cleanup.periodicReactionLogId
            ]!,
          );
          stop.id = result.periodicReactionLog.length;
          stop.frame = 5;
          stop.timeSeconds = 5 / 60;
          stop.reason = "COEXISTING_AURA_MISSING";
          delete stop.targetFrame;
          delete stop.reactionTaskLogId;
          result.periodicReactionLog.push(stop);
        },
      ],
    ]);
  });

  it("rejects forged F16 Wane rows and their timeline projection before an L17 cleanup", () => {
    const base = simulate(
      makeLateCleanupConfig({
        cleanupFrame: 17,
        cleanupGaugeUnits: 0.2,
      }),
      { critMode: "noCrit" },
    );
    expectCleanupMutationsRejected(base, [
      [
        "F16 Wane source must match its Tick",
        (result) => {
          requirePeriodicRow(result, 16, "wane").sourceActorId =
            "forged-source";
        },
      ],
      [
        "F16 Wane trigger must match its Tick",
        (result) => {
          requirePeriodicRow(result, 16, "wane").triggerDamageEventId =
            999;
        },
      ],
      [
        "F16 Wane damage child must match its Tick",
        (result) => {
          requirePeriodicRow(result, 16, "wane").damageEventId = null;
        },
      ],
      [
        "F16 Wane index must match its Tick",
        (result) => {
          requirePeriodicRow(result, 16, "wane").tickIndex = 1;
        },
      ],
      [
        "F16 Wane target name must remain reciprocal",
        (result) => {
          requirePeriodicRow(result, 16, "wane").targetName =
            "forged-target";
        },
      ],
      [
        "F16 positive-damage Wane cannot claim skipped semantics",
        (result) => {
          requirePeriodicRow(result, 16, "wane").operation =
            "wane-skipped";
        },
      ],
      [
        "F16 Wane consumption is fixed",
        (result) => {
          const wane = requirePeriodicRow(result, 16, "wane");
          wane.auraConsumed[0]!.gaugeUnits += 0.1;
        },
      ],
      [
        "F16 Wane coexistence expiry must be derived from Aura",
        (result) => {
          requirePeriodicRow(
            result,
            16,
            "wane",
          ).coexistenceExpiresAtFrame = 999;
        },
      ],
      [
        "F16 Wane timeline must preserve its damage backlink",
        (result) => {
          const point = result.targetStateTimeline.points.find(
            (candidate) =>
              candidate.frame === 16 &&
              candidate.cause === "electro-charged-wane",
          );
          if (point === undefined) {
            throw new Error("Expected F16 Wane timeline point.");
          }
          point.primaryDamageEventId = null;
        },
      ],
      [
        "F16 Wane timeline must preserve its periodic backlink",
        (result) => {
          const point = result.targetStateTimeline.points.find(
            (candidate) =>
              candidate.frame === 16 &&
              candidate.cause === "electro-charged-wane",
          );
          if (point === undefined) {
            throw new Error("Expected F16 Wane timeline point.");
          }
          point.links = point.links.filter(
            (link) => link.kind !== "periodic-reaction-log",
          );
        },
      ],
      [
        "F16 Wane timeline Aura must match its periodic row",
        (result) => {
          const point = result.targetStateTimeline.points.find(
            (candidate) =>
              candidate.frame === 16 &&
              candidate.cause === "electro-charged-wane",
          );
          if (point === undefined) {
            throw new Error("Expected F16 Wane timeline point.");
          }
          point.auraAfter = [];
        },
      ],
      [
        "F16 Wane timeline cannot become a post-resolution ghost",
        (result) => {
          const point = result.targetStateTimeline.points.find(
            (candidate) =>
              candidate.frame === 16 &&
              candidate.cause === "electro-charged-wane",
          );
          if (point === undefined) {
            throw new Error("Expected F16 Wane timeline point.");
          }
          point.frame = 18;
          point.timeSeconds = 18 / 60;
        },
      ],
      [
        "F16 Wane timeline priority must remain Wane priority",
        (result) => {
          const point = result.targetStateTimeline.points.find(
            (candidate) =>
              candidate.frame === 16 &&
              candidate.cause === "electro-charged-wane",
          );
          if (point === undefined) {
            throw new Error("Expected F16 Wane timeline point.");
          }
          point.eventPriority = 5;
        },
      ],
    ]);
  });

  it("rejects forged second-tick cadence fields before an L71 cleanup", () => {
    const base = simulate(
      makeLateCleanupConfig({
        cleanupFrame: 71,
        cleanupGaugeUnits: 0.2,
        durationFrames: 140,
      }),
      { critMode: "noCrit" },
    );
    expectCleanupMutationsRejected(base, [
      [
        "F70 next Tick must remain +60",
        (result) => {
          requirePeriodicRow(result, 70, "tick").nextTickFrame = 131;
        },
      ],
      [
        "F70 Wane must remain +6",
        (result) => {
          requirePeriodicRow(result, 70, "tick").waneFrame = 77;
        },
      ],
      [
        "F70 index must follow F10",
        (result) => {
          requirePeriodicRow(result, 70, "tick").tickIndex = 2;
        },
      ],
      [
        "F70 reaction damage next frame must match the Tick",
        (result) => {
          const tick = requirePeriodicRow(result, 70, "tick");
          if (tick.reactionDamageLogId === null) {
            throw new Error("Expected F70 reaction damage.");
          }
          result.reactionDamageLog[
            tick.reactionDamageLogId
          ]!.nextAvailableFrame = 131;
        },
      ],
      [
        "F70 coexistence expiry must be derived from Aura",
        (result) => {
          requirePeriodicRow(
            result,
            70,
            "tick",
          ).coexistenceExpiresAtFrame = 999;
        },
      ],
      [
        "F70 cannot be relabeled as an unprojected refresh",
        (result) => {
          requirePeriodicRow(result, 70, "tick").operation = "refresh";
        },
      ],
    ]);
  });

  it("reprojects the next effective target Tick through five Hitlag frames to F6", () => {
    const result = simulate(makeCleanupConfig({ hitlagFrames: 5 }), {
      critMode: "noCrit",
    });
    assertStoppedCleanup(result, 6);
    expect(
      result.targetHitlagLog.map(({ globalFrame, extensionFrames }) => ({
        frame: globalFrame,
        extensionFrames,
      })),
    ).toEqual([{ frame: 0, extensionFrames: 5 }]);
    expect(
      result.targetPhaseLog.some(
        (phase) =>
          phase.globalFrame >= 1 &&
          phase.globalFrame <= 5 &&
          phase.reactableTick.transitions.some(
            (transition) => transition.kind === "electro-charged-cleanup",
          ),
      ),
    ).toBe(false);
  });

  it("reuses the unique natural EC expiry when restored Hydro expires on the cleanup deadline", () => {
    const result = simulate(makeNaturalExpiryCollisionConfig(), {
      critMode: "noCrit",
    });
    const cleanupTask = result.reactionTaskLog.find(
      (task) => task.electroChargedCleanup !== null,
    );
    expect(cleanupTask?.electroChargedCleanup).toMatchObject({
      generation: 1,
      deadlineTargetFrame: 1,
      outcome: "natural-expiry",
      resolutionReason: "AURA_DECAY_EXPIRED_BEFORE_CLEANUP",
      resolvedGlobalFrame: 6,
      resolvedTargetFrame: 1,
      periodicReactionLogId: expect.any(Number),
      targetStateTimelinePointId: expect.any(Number),
    });
    const cleanup = cleanupTask?.electroChargedCleanup;
    if (
      cleanupTask === undefined ||
      cleanup?.outcome !== "natural-expiry"
    ) {
      throw new Error("Expected natural-expiry cleanup collision.");
    }

    const naturalStops = result.periodicReactionLog.filter(
      (entry) =>
        entry.reaction === "electroCharged" &&
        entry.generation === cleanup.generation &&
        entry.operation === "stop" &&
        entry.frame === 6 &&
        entry.reason === "AURA_DECAY_EXPIRED",
    );
    expect(naturalStops).toHaveLength(1);
    expect(naturalStops[0]).toMatchObject({
      id: cleanup.periodicReactionLogId,
      targetFrame: 1,
      reactionTaskLogId: cleanupTask.id,
    });
    expect(
      result.periodicReactionLog.filter(
        (entry) =>
          entry.reaction === "electroCharged" &&
          entry.generation === cleanup.generation &&
          entry.operation === "stop",
      ),
    ).toHaveLength(1);

    const point =
      result.targetStateTimeline.points[
        cleanup.targetStateTimelinePointId
      ];
    expect(point).toMatchObject({
      frame: 6,
      targetFrame: 1,
      cause: "electro-charged-expiry",
      eventType: "periodicReactionExpiry",
    });
    expect(
      result.targetStateTimeline.points.filter(
        (candidate) =>
          candidate.id === cleanup.targetStateTimelinePointId,
      ),
    ).toHaveLength(1);

    const phase = result.targetPhaseLog[cleanup.targetPhaseLogId];
    const ecTransitions =
      phase?.reactableTick.transitions.filter(
        (transition) =>
          transition.kind === "electro-charged-expiry" ||
          transition.kind === "electro-charged-cleanup",
      ) ?? [];
    expect(
      ecTransitions.map((transition) => transition.kind),
    ).toEqual([
      "electro-charged-expiry",
      "electro-charged-cleanup",
    ]);
    expect(
      ecTransitions.map(
        (transition) => transition.targetStateTimelinePointId,
      ),
    ).toEqual([
      cleanup.targetStateTimelinePointId,
      cleanup.targetStateTimelinePointId,
    ]);
  });

  it("keeps v3 natural-expiry cleanup typed backlinks even when both transitions share one point", () => {
    const config = makeNaturalExpiryCollisionConfig();
    config.targetTaskModel = { mode: "target-phase-v3" };
    const base = simulate(config, { critMode: "noCrit" });
    const cleanupTask = base.reactionTaskLog.find(
      (task) => task.electroChargedCleanup?.outcome === "natural-expiry",
    );
    const cleanup = cleanupTask?.electroChargedCleanup;
    if (
      cleanupTask === undefined ||
      cleanup?.outcome !== "natural-expiry"
    ) {
      throw new Error("Expected v3 natural-expiry cleanup collision.");
    }
    const forged = structuredClone(base);
    const phase = forged.targetPhaseLog[cleanup.targetPhaseLogId];
    if (phase?.model !== "target-phase-v3") {
      throw new Error("Expected a target-phase-v3 cleanup owner.");
    }
    const cleanupTransition = phase.reactableTick.transitions.find(
      (transition) =>
        transition.kind === "electro-charged-cleanup" &&
        transition.outcome === "natural-expiry",
    );
    if (cleanupTransition?.kind !== "electro-charged-cleanup") {
      throw new Error("Expected a v3 cleanup transition.");
    }
    cleanupTransition.reactionTaskLogId = 999;

    expect(simulationResultSchema.safeParse(forged).success).toBe(
      false,
    );
    expect(() =>
      assertTrustedSimulationResult(forged),
    ).toThrow(/Electro-Charged cleanup transition/);
  });

  it("rejects forged natural-expiry stop and lifecycle observation fields", () => {
    const base = simulate(makeNaturalExpiryCollisionConfig(), {
      critMode: "noCrit",
    });
    const cleanupTask = base.reactionTaskLog.find(
      (task) => task.electroChargedCleanup?.outcome === "natural-expiry",
    );
    const cleanup = cleanupTask?.electroChargedCleanup;
    if (
      cleanupTask === undefined ||
      cleanup?.outcome !== "natural-expiry"
    ) {
      throw new Error("Expected natural-expiry cleanup collision.");
    }

    const mutations: Array<(result: any) => void> = [
      (result) => {
        result.periodicReactionLog[
          cleanup.periodicReactionLogId
        ].auraConsumed = [
          {
            element: "hydro",
            gaugeUnits: 0.1,
          },
        ];
      },
      (result) => {
        result.targetStateTimeline.points[
          cleanup.targetStateTimelinePointId
        ].eventPriority = 99;
      },
      (result) => {
        result.periodicReactionLog[
          cleanup.periodicReactionLogId
        ].targetId = "forged-target";
      },
      (result) => {
        result.periodicReactionLog[
          cleanup.periodicReactionLogId
        ].targetName = "forged-target-name";
      },
      (result) => {
        result.periodicReactionLog[
          cleanup.periodicReactionLogId
        ].auraBefore = [];
      },
      (result) => {
        result.periodicReactionLog[
          cleanup.periodicReactionLogId
        ].auraAfter = [];
      },
      (result) => {
        const stop =
          result.periodicReactionLog[
            cleanup.periodicReactionLogId
          ];
        stop.sourceActorId =
          stop.sourceActorId === null
            ? "forged-source"
            : `${stop.sourceActorId}-forged`;
      },
      (result) => {
        const stop =
          result.periodicReactionLog[
            cleanup.periodicReactionLogId
          ];
        stop.triggerDamageEventId =
          stop.triggerDamageEventId === null
            ? 0
            : stop.triggerDamageEventId + 100;
      },
      (result) => {
        result.periodicReactionLog[
          cleanup.periodicReactionLogId
        ].damageEventId = 0;
      },
      (result) => {
        result.periodicReactionLog[
          cleanup.periodicReactionLogId
        ].reactionDamageLogId = 0;
      },
      (result) => {
        result.periodicReactionLog[
          cleanup.periodicReactionLogId
        ].tickIndex = 0;
      },
      (result) => {
        result.periodicReactionLog[
          cleanup.periodicReactionLogId
        ].coexistenceExpiresAtFrame = 1;
      },
      (result) => {
        const stop =
          result.periodicReactionLog[
            cleanup.periodicReactionLogId
          ];
        stop.frame += 1;
        stop.timeSeconds = stop.frame / 60;
      },
      (result) => {
        result.periodicReactionLog[
          cleanup.periodicReactionLogId
        ].targetFrame += 1;
      },
      (result) => {
        result.periodicReactionLog[
          cleanup.periodicReactionLogId
        ].nextTickFrame = 70;
      },
      (result) => {
        result.periodicReactionLog[
          cleanup.periodicReactionLogId
        ].waneFrame = 16;
      },
    ];

    for (const mutate of mutations) {
      const result = structuredClone(base);
      mutate(result);
      expect(
        electroChargedCleanupResultReferencesSchema.safeParse(result)
          .success,
      ).toBe(false);
    }
  });

  it("keeps aura-v7 output compatible and never arms the new cleanup contract", () => {
    const result = simulate(makeCleanupConfig({ mode: "aura-v7" }), {
      critMode: "noCrit",
    });
    expect(result.reactionTaskLog).toHaveLength(1);
    expect(result.reactionTaskLog[0]?.electroChargedCleanup).toBeNull();
    expect(
      result.targetPhaseLog.flatMap((phase) => phase.reactableTick.transitions),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "electro-charged-cleanup",
        }),
      ]),
    );
    expect(
      result.periodicReactionLog.some(
        (entry) => entry.reason === "COEXISTING_AURA_REMOVED_BY_QUICKEN_BLOOM",
      ),
    ).toBe(false);
  });

  it("does not arm when Quicken to Bloom leaves Hydro coexistence intact", () => {
    const result = simulate(makeCleanupConfig({ hydroGaugeUnits: 5 }), {
      critMode: "noCrit",
    });
    expect(result.reactionTaskLog).toHaveLength(1);
    expect(result.reactionTaskLog[0]?.electroChargedCleanup).toBeNull();
    expect(
      result.targetStateTimeline.points.some(
        (point) => point.cause === "electro-charged-cleanup",
      ),
    ).toBe(false);
  });

  it("reports pending-at-end only when the next target Tick is outside the simulation", () => {
    const result = simulate(
      makeCleanupConfig({
        durationFrames: 60,
        hitlagFrames: 120,
      }),
      { critMode: "noCrit" },
    );
    expect(result.reactionTaskLog[0]?.electroChargedCleanup).toEqual({
      generation: 1,
      requestedTargetFrame: 0,
      deadlineTargetFrame: 1,
      requestReason: "QUICKEN_BLOOM_DEPLETED_LAST_HYDRO",
      outcome: "pending-at-end",
      resolutionReason: null,
      resolvedGlobalFrame: null,
      resolvedTargetFrame: null,
      targetPhaseLogId: null,
      periodicReactionLogId: null,
      targetStateTimelinePointId: null,
    });
    expect(
      result.targetClockAudit.mode === "target-local-hitlag-v1"
        ? result.targetClockAudit.targets[0]?.finalTargetFrame
        : null,
    ).toBe(0);
    expect(
      result.targetPhaseLog.flatMap((phase) => phase.reactableTick.transitions),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "electro-charged-cleanup",
        }),
      ]),
    );
    expect(
      result.targetStateTimeline.points.some(
        (point) => point.cause === "electro-charged-cleanup",
      ),
    ).toBe(false);
    expect(
      result.periodicReactionLog.filter(
        (entry) =>
          entry.reaction === "electroCharged" && entry.operation === "tick",
      ),
    ).toEqual([
      expect.objectContaining({
        frame: 10,
        generation: 1,
        reason: "QUEUED_FIRST_TICK_WHILE_CLEANUP_PENDING",
        nextTickFrame: null,
        waneFrame: null,
      }),
    ]);
    expect(electroChargedDamageFrames(result)).toEqual([10]);
    expect(
      result.periodicReactionLog.some(
        (entry) =>
          entry.reaction === "electroCharged" &&
          (entry.operation === "wane" ||
            entry.operation === "wane-skipped" ||
            (entry.operation === "tick" && entry.frame === 70)),
      ),
    ).toBe(false);
  });

  it("keeps the cleanup pending through relative F5 and resolves exactly at relative F6", () => {
    const pendingAtFive = simulate(
      makeCleanupConfig({
        durationFrames: 60,
        hitlagFrames: 5,
        startFrame: 55,
      }),
      { critMode: "noCrit" },
    );
    expect(
      pendingAtFive.reactionTaskLog[0]?.electroChargedCleanup,
    ).toMatchObject({
      outcome: "pending-at-end",
      deadlineTargetFrame: 56,
      resolvedGlobalFrame: null,
      resolvedTargetFrame: null,
    });
    expect(
      pendingAtFive.targetClockAudit.mode === "target-local-hitlag-v1"
        ? pendingAtFive.targetClockAudit.targets[0]?.finalTargetFrame
        : null,
    ).toBe(55);
    expect(
      pendingAtFive.targetPhaseLog.some((phase) =>
        phase.reactableTick.transitions.some(
          (transition) => transition.kind === "electro-charged-cleanup",
        ),
      ),
    ).toBe(false);

    const resolvedAtSix = simulate(
      makeCleanupConfig({
        durationFrames: 61,
        hitlagFrames: 5,
        startFrame: 55,
      }),
      { critMode: "noCrit" },
    );
    expect(
      resolvedAtSix.reactionTaskLog[0]?.electroChargedCleanup,
    ).toMatchObject({
      outcome: "stop",
      deadlineTargetFrame: 56,
      resolvedGlobalFrame: 61,
      resolvedTargetFrame: 56,
    });
    expect(
      resolvedAtSix.targetClockAudit.mode === "target-local-hitlag-v1"
        ? resolvedAtSix.targetClockAudit.targets[0]?.finalTargetFrame
        : null,
    ).toBe(56);
    expect(
      resolvedAtSix.targetPhaseLog
        .flatMap((phase) => phase.reactableTick.transitions)
        .filter((transition) => transition.kind === "electro-charged-cleanup"),
    ).toHaveLength(1);
  });

  it("is byte-deterministic for the same config and random seed", () => {
    const config = makeCleanupConfig({
      hitlagFrames: 5,
    });
    expect(JSON.stringify(simulate(config, { critMode: "noCrit" }))).toBe(
      JSON.stringify(simulate(config, { critMode: "noCrit" })),
    );
  });
});
