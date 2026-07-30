import {
  electroChargedCleanupResultReferencesSchema,
  SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION,
  SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
  targetPhaseV2ResultReferencesSchema,
  targetTaskPhaseResultReferencesSchema,
  type FrameHitDefinition,
  type SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const sameTargetGeometry = {
  kind: "circle" as const,
  coordinateSpace: "world" as const,
  origin: { x: 0, y: 0 },
  radius: 1
};

function applicationHit(
  id: string,
  element: NonNullable<FrameHitDefinition["element"]>,
  gaugeUnits: number
): FrameHitDefinition {
  return {
    id,
    label: id,
    frame: 0,
    scaling: 0,
    element,
    geometry: sameTargetGeometry,
    application: {
      gaugeUnits,
      icdTag: id,
      icdGroup: "no-icd"
    }
  };
}

function makeCleanupConfig({
  mode = "aura-v8",
  hydroGaugeUnits = 1
}: {
  mode?: "aura-v7" | "aura-v8";
  hydroGaugeUnits?: number;
} = {}): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    dataVersion: "ec-cleanup-schema-provisional-1",
    randomSeed: `ec-cleanup-schema-${mode}-${hydroGaugeUnits}`,
    meta: {
      name: "EC cleanup schema mutation vector",
      version: "1.40.0",
      verificationStatus: "provisional"
    },
    duration: 1.5,
    cycleLength: 1.5,
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
            { element: "hydro", gaugeUnits: hydroGaugeUnits },
            { element: "electro", gaugeUnits: 1 }
          ]
        }
      ]
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
          baseAtk: 0
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode },
    targetClockModel: { mode: "disabled" },
    targetTaskModel: { mode: "target-phase-v2" },
    reactionDeliveryModel: {
      mode: "deferred-event-heap-v1"
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
          hits: [
            applicationHit("dendro-quicken", "dendro", 0.8),
            applicationHit("electro-stream", "electro", 0.8)
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "driver",
          abilityId: "compound-chain",
          atFrame: 0
        }
      ]
    }
  };
}

function makeDelayedCleanupConfig(
  cleanupFrame = 5
): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    dataVersion: "ec-delayed-cleanup-schema-provisional-1",
    randomSeed: `ec-delayed-cleanup-schema-${cleanupFrame}`,
    meta: {
      name: "EC start F0 and delayed cleanup",
      version: "1.40.0",
      verificationStatus: "provisional"
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
          hitboxRadius: 0
        }
      ]
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
          baseAtk: 0
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v8" },
    targetClockModel: { mode: "disabled" },
    targetTaskModel: { mode: "target-phase-v2" },
    reactionDeliveryModel: {
      mode: "deferred-event-heap-v1"
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
            applicationHit("start-hydro", "hydro", 1),
            applicationHit("start-electro", "electro", 1)
          ]
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
            applicationHit("q-dendro", "dendro", 0.5)
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "driver",
          abilityId: "start",
          atFrame: 0
        },
        {
          type: "skill",
          actorId: "driver",
          abilityId: "q",
          atFrame: cleanupFrame
        }
      ]
    }
  };
}

function makeStopResult() {
  return simulate(makeCleanupConfig(), {
    critMode: "noCrit"
  });
}

function expectDedicatedSchemaFailure(
  result: ReturnType<typeof makeStopResult>
): void {
  expect(
    electroChargedCleanupResultReferencesSchema.safeParse(result)
      .success
  ).toBe(false);
}

describe("Electro-Charged cleanup result schema", () => {
  it("accepts the simulator's exact 1.40 stop result", () => {
    const result = makeStopResult();
    expect(() =>
      electroChargedCleanupResultReferencesSchema.parse(result)
    ).not.toThrow();
    expect(() =>
      targetTaskPhaseResultReferencesSchema.parse(result)
    ).not.toThrow();
    expect(() =>
      targetPhaseV2ResultReferencesSchema.parse(result)
    ).not.toThrow();
  });

  it("anchors a cleanup requested at F5 to generation 1's pinned F10 first tick", () => {
    const result = simulate(makeDelayedCleanupConfig(), {
      critMode: "noCrit"
    });
    const task = result.reactionTaskLog[0]!;
    const cleanup = task.electroChargedCleanup;
    expect(task.frame).toBe(5);
    expect(cleanup).toMatchObject({
      generation: 1,
      outcome: "stop",
      resolvedGlobalFrame: 6
    });
    expect(
      result.periodicReactionLog.filter(
        (entry) =>
          entry.targetId === task.targetId &&
          entry.generation === cleanup?.generation &&
          entry.operation === "start"
      )
    ).toEqual([
      expect.objectContaining({
        frame: 0,
        generation: 1
      })
    ]);
    expect(
      result.periodicReactionLog
        .filter(
          (entry) =>
            entry.generation === cleanup?.generation &&
            entry.operation === "tick"
        )
        .map((entry) => entry.frame)
    ).toEqual([10]);
    expect(() =>
      electroChargedCleanupResultReferencesSchema.parse(result)
    ).not.toThrow();
  });

  it("rejects a forged F15 pinned child and a missing or duplicate generation start", () => {
    const result = simulate(makeDelayedCleanupConfig(), {
      critMode: "noCrit"
    });
    const task = result.reactionTaskLog[0]!;
    const cleanup = task.electroChargedCleanup;
    if (cleanup === null) {
      throw new Error("Expected an EC cleanup audit.");
    }

    const forgedFifteen: any = structuredClone(result);
    const forgedTick =
      forgedFifteen.periodicReactionLog.find(
        (entry: any) =>
          entry.generation === cleanup.generation &&
          entry.operation === "tick" &&
          entry.tickIndex === 0
      );
    forgedTick.frame = 15;
    forgedTick.timeSeconds = 15 / 60;
    const forgedDamage =
      forgedFifteen.reactionDamageLog[
        forgedTick.reactionDamageLogId
      ];
    forgedDamage.damageFrame = 15;
    for (const damageEventId of forgedDamage.damageEventIds) {
      forgedFifteen.damageEvents[damageEventId].frame = 15;
    }
    expectDedicatedSchemaFailure(forgedFifteen);

    const missingStart: any = structuredClone(result);
    const start = missingStart.periodicReactionLog.find(
      (entry: any) =>
        entry.targetId === task.targetId &&
        entry.generation === cleanup.generation &&
        entry.operation === "start"
    );
    start.operation = "refresh";
    expectDedicatedSchemaFailure(missingStart);

    const duplicateStart: any = structuredClone(result);
    const duplicate = structuredClone(
      duplicateStart.periodicReactionLog.find(
        (entry: any) =>
          entry.targetId === task.targetId &&
          entry.generation === cleanup.generation &&
          entry.operation === "start"
      )
    );
    duplicate.id = duplicateStart.periodicReactionLog.length;
    duplicateStart.periodicReactionLog.push(duplicate);
    expectDedicatedSchemaFailure(duplicateStart);
  });

  it("requires an own defined cleanup field for exact 1.40 aura-v7 and preserves 1.39 omission", () => {
    const result: any = simulate(
      makeCleanupConfig({ mode: "aura-v7" }),
      { critMode: "noCrit" }
    );
    expect(
      result.reactionTaskLog[0].electroChargedCleanup
    ).toBeNull();

    for (const schema of [
      targetTaskPhaseResultReferencesSchema,
      targetPhaseV2ResultReferencesSchema
    ]) {
      expect(() => schema.parse(result)).not.toThrow();

      const missing = structuredClone(result);
      delete missing.reactionTaskLog[0].electroChargedCleanup;
      expect(() => schema.parse(missing)).toThrow(
        /explicit cleanup audit or null/
      );

      const undefinedValue = structuredClone(result);
      undefinedValue.reactionTaskLog[0].electroChargedCleanup =
        undefined;
      expect(() => schema.parse(undefinedValue)).toThrow(
        /explicit cleanup audit or null|cleanup=null/
      );

      const historical = structuredClone(result);
      historical.schemaVersion =
        SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION;
      historical.engineVersion =
        SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION;
      historical.config.schemaVersion =
        SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION;
      historical.config.engineVersion =
        SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION;
      delete historical.config
        .electroChargedPropagationModel;
      delete historical.reactionTaskLog[0]
        .electroChargedCleanup;
      expect(() => schema.parse(historical)).not.toThrow();
    }
  });

  it("rejects cleanup values inherited through task prototypes", () => {
    const auraV7: any = simulate(
      makeCleanupConfig({ mode: "aura-v7" }),
      { critMode: "noCrit" }
    );
    delete auraV7.reactionTaskLog[0]
      .electroChargedCleanup;
    Object.setPrototypeOf(auraV7.reactionTaskLog[0], {
      electroChargedCleanup: null
    });
    expect(
      targetTaskPhaseResultReferencesSchema.safeParse(auraV7)
        .success
    ).toBe(false);
    expect(
      targetPhaseV2ResultReferencesSchema.safeParse(auraV7)
        .success
    ).toBe(false);

    const auraV8: any = structuredClone(makeStopResult());
    const inheritedAudit =
      auraV8.reactionTaskLog[0].electroChargedCleanup;
    delete auraV8.reactionTaskLog[0]
      .electroChargedCleanup;
    Object.setPrototypeOf(auraV8.reactionTaskLog[0], {
      electroChargedCleanup: inheritedAudit
    });
    expect(
      targetTaskPhaseResultReferencesSchema.safeParse(auraV8)
        .success
    ).toBe(false);
    expect(
      targetPhaseV2ResultReferencesSchema.safeParse(auraV8)
        .success
    ).toBe(false);
    expectDedicatedSchemaFailure(auraV8);
  });

  it("rejects a coordinated non-canonical generation rewrite", () => {
    const result: any = structuredClone(makeStopResult());
    result.reactionTaskLog[0].electroChargedCleanup.generation =
      2;
    for (const entry of result.periodicReactionLog) {
      if (
        entry.targetId === "enemy-0" &&
        entry.generation === 1
      ) {
        entry.generation = 2;
      }
    }
    for (const phase of result.targetPhaseLog) {
      for (const transition of phase.reactableTick
        .transitions) {
        if (
          (transition.kind ===
            "electro-charged-expiry" ||
            transition.kind ===
              "electro-charged-cleanup") &&
          transition.generation === 1
        ) {
          transition.generation = 2;
        }
      }
    }
    expectDedicatedSchemaFailure(result);
    expect(
      targetPhaseV2ResultReferencesSchema.safeParse(result)
        .success
    ).toBe(false);
  });

  it("rejects a deleted required audit even after every owned terminal row is removed", () => {
    const result: any = structuredClone(makeStopResult());
    const task = result.reactionTaskLog[0];
    const cleanup = task.electroChargedCleanup;
    delete task.electroChargedCleanup;
    result.targetPhaseLog[cleanup.targetPhaseLogId]
      .reactableTick.transitions = result.targetPhaseLog[
      cleanup.targetPhaseLogId
    ].reactableTick.transitions.filter(
      (transition: any) =>
        transition.kind !== "electro-charged-cleanup"
    );
    result.periodicReactionLog =
      result.periodicReactionLog.filter(
        (entry: any) =>
          entry.id !== cleanup.periodicReactionLogId
      );
    result.targetStateTimeline.points =
      result.targetStateTimeline.points.filter(
        (point: any) =>
          point.id !== cleanup.targetStateTimelinePointId
      );

    const parsed =
      electroChargedCleanupResultReferencesSchema.safeParse(
        result
      );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.map((issue) => issue.message).join("\n")
      ).toMatch(
        /explicit cleanup audit or null|required active-generation last-Hydro cleanup request/
      );
    }
  });

  it("rejects forged ordinary cleanup stop ownership, Aura, and damage fields", () => {
    const base = makeStopResult();
    const cleanup =
      base.reactionTaskLog[0]!.electroChargedCleanup;
    if (cleanup?.outcome !== "stop") {
      throw new Error("Expected an ordinary cleanup stop.");
    }
    const mutations: Array<
      (stop: any) => void
    > = [
      (stop) => {
        stop.targetName = "forged-target-name";
      },
      (stop) => {
        stop.auraBefore = [];
      },
      (stop) => {
        stop.auraAfter = [];
      },
      (stop) => {
        stop.sourceActorId =
          stop.sourceActorId === null
            ? "forged-source"
            : `${stop.sourceActorId}-forged`;
      },
      (stop) => {
        stop.triggerDamageEventId =
          stop.triggerDamageEventId === null
            ? 0
            : stop.triggerDamageEventId + 100;
      },
      (stop) => {
        stop.damageEventId = 0;
      },
      (stop) => {
        stop.reactionDamageLogId = 0;
      },
      (stop) => {
        stop.tickIndex = 0;
      },
      (stop) => {
        stop.coexistenceExpiresAtFrame = 1;
      }
    ];

    for (const mutate of mutations) {
      const result: any = structuredClone(base);
      mutate(
        result.periodicReactionLog[
          cleanup.periodicReactionLogId
        ]
      );
      expectDedicatedSchemaFailure(result);
    }
  });

  it("rejects task, phase, periodic, timeline, generation, deadline, outcome, and pending-ghost mutations", () => {
    const base = makeStopResult();
    const cases: Array<
      [
        string,
        (result: any, cleanup: any) => void
      ]
    > = [
      [
        "task backlink",
        (result, cleanup) => {
          const transition = result.targetPhaseLog[
            cleanup.targetPhaseLogId
          ].reactableTick.transitions.find(
            (candidate: any) =>
              candidate.kind ===
              "electro-charged-cleanup"
          );
          transition.reactionTaskLogId += 100;
        }
      ],
      [
        "phase id",
        (_result, cleanup) => {
          cleanup.targetPhaseLogId += 100;
        }
      ],
      [
        "periodic id",
        (_result, cleanup) => {
          cleanup.periodicReactionLogId += 100;
        }
      ],
      [
        "timeline id",
        (_result, cleanup) => {
          cleanup.targetStateTimelinePointId += 100;
        }
      ],
      [
        "generation",
        (_result, cleanup) => {
          cleanup.generation += 1;
        }
      ],
      [
        "deadline",
        (_result, cleanup) => {
          cleanup.deadlineTargetFrame += 1;
        }
      ],
      [
        "outcome",
        (_result, cleanup) => {
          cleanup.outcome = "retain";
          cleanup.resolutionReason =
            "COEXISTENCE_RESTORED_BEFORE_TARGET_TICK";
        }
      ],
      [
        "pending ghost references",
        (_result, cleanup) => {
          cleanup.outcome = "pending-at-end";
          cleanup.resolutionReason = null;
          cleanup.resolvedGlobalFrame = null;
          cleanup.resolvedTargetFrame = null;
          cleanup.targetPhaseLogId = null;
          cleanup.periodicReactionLogId = null;
          cleanup.targetStateTimelinePointId = null;
        }
      ],
      [
        "post-cleanup ghost stop",
        (result, cleanup) => {
          const ownedStop =
            result.periodicReactionLog[
              cleanup.periodicReactionLogId
            ];
          const ghost = structuredClone(ownedStop);
          ghost.id = result.periodicReactionLog.length;
          ghost.frame = cleanup.resolvedGlobalFrame + 5;
          ghost.targetFrame =
            cleanup.resolvedTargetFrame + 5;
          ghost.timeSeconds = ghost.frame / 60;
          ghost.reason = "BEFORE_WANE";
          delete ghost.reactionTaskLogId;
          result.periodicReactionLog.push(ghost);
        }
      ]
    ];

    for (const [label, mutate] of cases) {
      const mutated: any = structuredClone(base);
      mutate(
        mutated,
        mutated.reactionTaskLog[0].electroChargedCleanup
      );
      expectDedicatedSchemaFailure(mutated);
      expect(label).toBeTruthy();
    }
  });
});
