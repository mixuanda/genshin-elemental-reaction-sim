import { createHash } from "node:crypto";
import type {
  SimConfig,
  SimulationResult,
  TargetTaskPhaseLogEntry
} from "@genshin-dps-lab/schemas";
import {
  canonicalStringify,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  TARGET_TASK_PHASE_ENGINE_VERSION,
  TARGET_TASK_PHASE_SCHEMA_VERSION
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import targetTaskPhaseGoldenJson from "../../../test-vectors/fixtures/target-task-phase-1.37.golden.json";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

interface TargetTaskPhaseScenarioOptions {
  hitlag?: boolean;
  includeIncoming?: boolean;
  multiTarget?: boolean;
}

function makeTargetTaskPhaseLogConfig(
  mode: SimConfig["targetTaskModel"]["mode"],
  options: TargetTaskPhaseScenarioOptions = {}
): SimConfig {
  const base = makeConfig();
  const incomingFrame = options.hitlag === true ? 20 : 15;
  const targets: NonNullable<
    SimConfig["enemy"]["targets"]
  > = [
    {
      id: "enemy-0",
      name: "First target-phase target",
      position: { x: 0, y: 0 },
      initialAura: [
        {
          element: "dendro",
          gaugeUnits: 7 / 60
        }
      ]
    }
  ];
  if (options.multiTarget === true) {
    targets.push({
      id: "enemy-1",
      name: "Second target-phase target",
      position: { x: 0.5, y: 0 },
      initialAura: [
        {
          element: "dendro",
          gaugeUnits: 7 / 60
        }
      ]
    });
  }

  const hits: NonNullable<
    NonNullable<SimConfig["timeline"]>["abilities"]
  >[number]["hits"] = [
    {
      id: "burning-start",
      label: "Burning start",
      frame: 0,
      scaling: 1,
      element: "pyro",
      geometry: {
        kind: "circle",
        coordinateSpace: "world",
        origin: { x: 0, y: 0 },
        radius: options.multiTarget === true ? 1 : 0.1
      },
      application: {
        gaugeUnits: 1,
        icdTag: "burning-start",
        icdGroup: "no-icd"
      },
      ...(options.hitlag === true
        ? {
            targetHitlag: {
              haltFrames: 5,
              factor: 0
            }
          }
        : {})
    }
  ];
  if (options.includeIncoming === true) {
    hits.push({
      id: "same-frame-incoming",
      label: "Same-frame incoming hit",
      frame: incomingFrame,
      scaling: 1,
      element: "physical",
      ...(options.multiTarget === true
        ? {
            geometry: {
              kind: "circle" as const,
              coordinateSpace: "world" as const,
              origin: { x: 0, y: 0 },
              radius: 1
            }
          }
        : {
            targeting: {
              targetId: "enemy-0",
              outcome: "landed" as const
            }
          })
    });
  }

  return {
    ...base,
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "tester",
        name: "Target phase tester",
        element: "pyro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1000,
          em: 100
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v7" },
    targetClockModel:
      options.hitlag === true
        ? { mode: "target-local-hitlag-v1" }
        : { mode: "disabled" },
    targetTaskModel: { mode },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "tester",
      swapFrames: 12,
      abilities: [
        {
          id: "phase-log-sequence",
          actorId: "tester",
          name: "Target phase log sequence",
          kind: "skill",
          cancelFrame: incomingFrame + 1,
          animationEndFrame: incomingFrame + 1,
          cooldownFrames: 0,
          hits
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "tester",
          abilityId: "phase-log-sequence",
          atFrame: 0
        }
      ]
    }
  };
}

function phaseAt(
  result: SimulationResult,
  globalFrame: number,
  targetId: string
): TargetTaskPhaseLogEntry {
  const matches = result.targetTaskPhaseLog.filter(
    (entry) =>
      entry.globalFrame === globalFrame &&
      entry.targetId === targetId
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function auraGauge(
  aura: TargetTaskPhaseLogEntry["auraBeforeTasks"],
  element: string
): number | undefined {
  return aura.find((entry) => entry.element === element)
    ?.gaugeUnits;
}

type TargetTaskPhaseGoldenScenarioId =
  | "lowFuelPreDecay"
  | "hitlagReprojection"
  | "multiTargetOrder";

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(canonicalStringify(value))
    .digest("hex");
}

function projectTargetTaskPhaseScenario(
  result: SimulationResult,
  boundaryFrame: number
) {
  const boundaryPhases = result.targetTaskPhaseLog.filter(
    (entry) => entry.globalFrame === boundaryFrame
  );
  const burningStateLogIds = new Set(
    boundaryPhases.flatMap(
      (entry) => entry.burningStateLogIds
    )
  );
  const hitResolutionLogIds = new Set(
    boundaryPhases.flatMap(
      (entry) => entry.hitResolutionLogIds
    )
  );
  const reactionTaskLogIds = new Set(
    boundaryPhases.flatMap(
      (entry) => entry.reactionTaskLogIds
    )
  );
  const projectAura = (
    aura: TargetTaskPhaseLogEntry["auraBeforeTasks"]
  ) =>
    aura.map(
      (entry) =>
        [
          entry.element,
          entry.gaugeUnits,
          entry.expiresAtFrame,
          entry.expiresAtTargetFrame ?? null
        ] as const
    );

  const keyEventOrderRows = [
    ...boundaryPhases.map((entry) => ({
        kind: "target-task" as const,
        referenceId: entry.id,
        targetId: entry.targetId,
        eventType: entry.eventType,
        eventPriority: entry.eventPriority,
        eventSequence: entry.eventSequence,
        intraEventSequence: entry.intraEventSequence,
        targetOrder: entry.targetOrder
      })),
    ...result.damageEvents
      .filter((entry) => entry.frame === boundaryFrame)
      .map((entry) => ({
        kind:
          entry.kind === "direct"
            ? ("direct-damage" as const)
            : ("reaction-damage" as const),
        referenceId: entry.id,
        targetId: entry.targetId,
        eventType:
          entry.kind === "direct"
            ? entry.hitId
            : entry.reaction,
        eventPriority: entry.eventPriority,
        eventSequence: entry.eventSequence,
        intraEventSequence: null,
        targetOrder: entry.targetIndex
      })),
    ...result.reactionTaskLog
      .filter((entry) => entry.frame === boundaryFrame)
      .map((entry) => ({
        kind: "reaction-task" as const,
        referenceId: entry.id,
        targetId: entry.targetId,
        eventType: entry.kind,
        eventPriority: entry.eventPriority,
        eventSequence: entry.eventSequence,
        intraEventSequence: entry.intraEventSequence,
        targetOrder:
          result.enemyTargets.findIndex(
            (target) => target.id === entry.targetId
          )
      }))
  ].sort(
    (left, right) =>
      left.eventPriority - right.eventPriority ||
      left.eventSequence - right.eventSequence ||
      (left.intraEventSequence ?? -1) -
        (right.intraEventSequence ?? -1) ||
      left.targetOrder - right.targetOrder ||
      left.kind.localeCompare(right.kind)
  );
  const keyEventOrder = keyEventOrderRows.map(
    (entry) =>
      [
        entry.kind,
        entry.referenceId,
        entry.targetId,
        entry.eventType,
        entry.eventPriority,
        entry.eventSequence,
        entry.intraEventSequence,
        entry.targetOrder
      ] as const
  );

  return {
    identity: {
      schemaVersion: result.schemaVersion,
      engineVersion: result.engineVersion,
      targetTaskModel: result.config.targetTaskModel,
      targetClockModel: result.config.targetClockModel,
      reactionEngine: result.config.reactionEngine,
      timeline: {
        mode: result.config.timeline?.mode,
        fps: result.config.timeline?.fps
      }
    },
    boundaryFrame,
    phases: boundaryPhases.map((entry) => ({
      id: entry.id,
      targetId: entry.targetId,
      targetName: entry.targetName,
      frame: {
        global: entry.globalFrame,
        timeSeconds: entry.timeSeconds,
        target: entry.targetFrame
      },
      targetOrder: entry.targetOrder,
      wake: [entry.wakeKind, entry.eventType] as const,
      eventOrder: [
        entry.eventPriority,
        entry.eventSequence,
        entry.intraEventSequence
      ] as const,
      aura: {
        beforeTasks: projectAura(entry.auraBeforeTasks),
        afterTasks: projectAura(entry.auraAfterTasks),
        afterDecay: projectAura(entry.auraAfterDecay)
      },
      refs: {
        burning: entry.burningStateLogIds,
        hits: entry.hitResolutionLogIds,
        reactionTasks: entry.reactionTaskLogIds
      }
    })),
    referencedLogs: {
      burning: result.burningStateLog
        .filter((entry) => burningStateLogIds.has(entry.id))
        .map((entry) => ({
          id: entry.id,
          op: entry.operation,
          frame: entry.frame,
          targetFrame: entry.targetFrame ?? null,
          target: entry.targetId,
          order: [
            entry.eventPriority,
            entry.eventSequence
          ] as const,
          tick: entry.tickIndex,
          fuel: [
            entry.fuelGaugeUnitsBefore,
            entry.fuelGaugeUnitsAfter
          ] as const,
          nextTick: entry.nextTickFrame,
          reactionDamage: entry.reactionDamageLogId,
          damage: entry.damageEventIds
        })),
      hits: result.hitResolutionLog
        .filter((entry) => hitResolutionLogIds.has(entry.id))
        .map((entry) => ({
          id: entry.id,
          frame: entry.frame,
          target: entry.targetId,
          hit: entry.hitId,
          resolution: entry.resolutionKind,
          landed: entry.landed,
          damage: entry.damageEventId
        })),
      reactionTasks: result.reactionTaskLog
        .filter((entry) => reactionTaskLogIds.has(entry.id))
        .map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          frame: entry.frame,
          target: entry.targetId,
          status: entry.status,
          order: [
            entry.eventPriority,
            entry.eventSequence,
            entry.intraEventSequence
          ] as const
        }))
    },
    keyEventOrder,
    targetClock: {
      audit: result.targetClockAudit,
      transitions: result.targetClockLog.map(
        (entry) =>
          [
            entry.id,
            entry.targetId,
            entry.operation,
            entry.globalFrameBefore,
            entry.globalFrameAfter,
            entry.targetFrameBefore,
            entry.targetFrameAfter,
            entry.consumedFrozenFrames,
            entry.addedFrozenFrames,
            entry.frozenFramesAfter,
            entry.targetHitlagLogId,
            entry.cause
          ] as const
      ),
      hitlag: result.targetHitlagLog.map(
        (entry) =>
          [
            entry.id,
            entry.globalFrame,
            entry.targetFrame,
            entry.targetId,
            entry.hitResolutionLogId,
            entry.extensionFrames,
            entry.frozenFramesBefore,
            entry.frozenFramesAfter,
            entry.pausedGlobalFrameStart,
            entry.nextTargetAdvanceGlobalFrame,
            entry.applied
          ] as const
      )
    }
  };
}

type TargetTaskPhaseGoldenScenario = ReturnType<
  typeof projectTargetTaskPhaseScenario
>;

function normalizeIdentityForFrozenV137(
  scenario: TargetTaskPhaseGoldenScenario
) {
  return {
    ...scenario,
    identity: {
      ...scenario.identity,
      schemaVersion: TARGET_TASK_PHASE_SCHEMA_VERSION,
      engineVersion: TARGET_TASK_PHASE_ENGINE_VERSION
    }
  };
}

interface TargetTaskPhaseGoldenFixture {
  fixtureVersion: "target-task-phase-1.37";
  provenance: {
    mechanicsDataStatus: "fixed-gcsim-provisional";
    referenceProject: "genshinsim/gcsim";
    referenceCommit: string;
    officialServerTruth: false;
    completeGcsimParity: false;
    scope: string;
  };
  projectionFormat: {
    auraTuple: string[];
    keyEventOrderTuple: string[];
    targetClockTransitionTuple: string[];
    targetHitlagTuple: string[];
  };
  commonConfig: {
    schemaVersion: string;
    engineVersion: string;
    targetTaskModel: { mode: "target-phase-v1" };
    reactionEngine: { mode: "aura-v7" };
    timeline: { mode: "legal-frame-v1"; fps: 60 };
  };
  scenarios: Record<
    TargetTaskPhaseGoldenScenarioId,
    TargetTaskPhaseGoldenScenario
  >;
  hashes: Record<TargetTaskPhaseGoldenScenarioId, string>;
}

const targetTaskPhaseGolden =
  targetTaskPhaseGoldenJson as unknown as TargetTaskPhaseGoldenFixture;

function projectAllTargetTaskPhaseScenarios(): Record<
  TargetTaskPhaseGoldenScenarioId,
  TargetTaskPhaseGoldenScenario
> {
  return {
    lowFuelPreDecay: projectTargetTaskPhaseScenario(
      simulate(
        makeTargetTaskPhaseLogConfig("target-phase-v1")
      ),
      15
    ),
    hitlagReprojection: projectTargetTaskPhaseScenario(
      simulate(
        makeTargetTaskPhaseLogConfig("target-phase-v1", {
          hitlag: true,
          includeIncoming: true
        })
      ),
      20
    ),
    multiTargetOrder: projectTargetTaskPhaseScenario(
      simulate(
        makeTargetTaskPhaseLogConfig("target-phase-v1", {
          includeIncoming: true,
          multiTarget: true
        })
      ),
      15
    )
  };
}

describe("target task phase replay log", () => {
  it("keeps the frozen legacy event heap free of target-phase rows", () => {
    const result = simulate(
      makeTargetTaskPhaseLogConfig(
        "legacy-event-heap-v1",
        { includeIncoming: true }
      )
    );

    expect(result.targetTaskPhaseLog).toEqual([]);
  });

  it("records the low-Fuel F15 callback before decay as three explicit Aura states", () => {
    const result = simulate(
      makeTargetTaskPhaseLogConfig("target-phase-v1")
    );
    const phase = phaseAt(result, 15, "enemy-0");

    expect(phase).toMatchObject({
      id: expect.any(Number),
      targetId: "enemy-0",
      targetName: "First target-phase target",
      globalFrame: 15,
      timeSeconds: 15 / 60,
      targetFrame: 15,
      targetOrder: 0,
      wakeKind: "burning-tick",
      eventType: "burningTick",
      eventPriority: 0.5,
      eventSequence: expect.any(Number),
      intraEventSequence: expect.any(Number),
      hitResolutionLogIds: [],
      reactionTaskLogIds: []
    });
    expect(
      auraGauge(phase.auraBeforeTasks, "burningFuel")
    ).toBeCloseTo(1 / 150, 12);
    expect(
      auraGauge(phase.auraBeforeTasks, "burning")
    ).toBeGreaterThan(0);
    expect(phase.auraAfterTasks).toStrictEqual(
      phase.auraBeforeTasks
    );
    expect(
      auraGauge(phase.auraAfterDecay, "burningFuel")
    ).toBeUndefined();
    expect(
      auraGauge(phase.auraAfterDecay, "burning")
    ).toBeUndefined();

    expect(phase.burningStateLogIds).toHaveLength(1);
    const burningRow =
      result.burningStateLog[
        phase.burningStateLogIds[0]!
      ];
    expect(burningRow).toMatchObject({
      id: phase.burningStateLogIds[0],
      operation: "tick",
      frame: 15,
      targetId: "enemy-0",
      fuelGaugeUnitsBefore: expect.closeTo(
        1 / 150,
        12
      )
    });
  });

  it("coalesces the same-frame Burning callback and physical hit while preserving later damage links", () => {
    const result = simulate(
      makeTargetTaskPhaseLogConfig("target-phase-v1", {
        includeIncoming: true
      })
    );
    const phase = phaseAt(result, 15, "enemy-0");

    expect(phase.wakeKind).toBe("burning-tick");
    expect(phase.eventType).toBe("burningTick");
    expect(phase.burningStateLogIds).toHaveLength(1);
    expect(phase.hitResolutionLogIds).toHaveLength(1);
    expect(phase.reactionTaskLogIds).toEqual([]);

    const burningRow =
      result.burningStateLog[
        phase.burningStateLogIds[0]!
      ]!;
    const hitRow =
      result.hitResolutionLog[
        phase.hitResolutionLogIds[0]!
      ]!;
    expect(burningRow).toMatchObject({
      id: phase.burningStateLogIds[0],
      operation: "tick",
      frame: 15,
      targetId: "enemy-0"
    });
    expect(hitRow).toMatchObject({
      id: phase.hitResolutionLogIds[0],
      frame: 15,
      targetId: "enemy-0",
      hitId: "same-frame-incoming",
      element: "physical",
      resolutionKind: "direct",
      landed: true
    });

    const physicalDamage = result.damageEvents.find(
      (event) => event.id === hitRow.damageEventId
    );
    const burningDamage = burningRow.damageEventIds.map(
      (damageEventId) =>
        result.damageEvents.find(
          (event) => event.id === damageEventId
        )
    );
    expect(physicalDamage).toMatchObject({
      frame: 15,
      targetId: "enemy-0",
      kind: "direct",
      element: "physical"
    });
    expect(burningDamage).toHaveLength(1);
    expect(burningDamage[0]).toMatchObject({
      frame: 15,
      targetId: "enemy-0",
      kind: "transformative-reaction",
      reaction: "burning"
    });
    expect(burningRow.eventPriority).toBe(
      phase.eventPriority
    );
    expect(burningRow.eventSequence).toBe(
      phase.eventSequence
    );
    expect(burningRow.eventPriority).toBeLessThan(
      physicalDamage!.eventPriority
    );
    expect(physicalDamage!.eventPriority).toBeLessThan(
      burningDamage[0]!.eventPriority
    );
  });

  it("records a five-frame Hitlag reprojection at global F20 and target F15", () => {
    const result = simulate(
      makeTargetTaskPhaseLogConfig("target-phase-v1", {
        hitlag: true,
        includeIncoming: true
      })
    );
    const phase = phaseAt(result, 20, "enemy-0");

    expect(
      result.targetTaskPhaseLog.some(
        (entry) =>
          entry.globalFrame === 15 &&
          entry.targetId === "enemy-0"
      )
    ).toBe(false);
    expect(phase).toMatchObject({
      globalFrame: 20,
      timeSeconds: 20 / 60,
      targetFrame: 15,
      targetOrder: 0,
      wakeKind: "burning-tick",
      eventType: "burningTick",
      eventPriority: 0.5
    });
    expect(
      auraGauge(phase.auraBeforeTasks, "burningFuel")
    ).toBeCloseTo(1 / 150, 12);
    expect(phase.auraAfterTasks).toStrictEqual(
      phase.auraBeforeTasks
    );
    expect(
      auraGauge(phase.auraAfterDecay, "burningFuel")
    ).toBeUndefined();
    expect(result.targetClockAudit.targets).toEqual([
      expect.objectContaining({
        targetId: "enemy-0",
        finalGlobalFrame: 60,
        finalTargetFrame: 55,
        totalExtensionFrames: 5
      })
    ]);
  });

  it("emits stable target order with exactly one row per target and global frame", () => {
    const result = simulate(
      makeTargetTaskPhaseLogConfig("target-phase-v1", {
        includeIncoming: true,
        multiTarget: true
      })
    );
    const frame15 = result.targetTaskPhaseLog.filter(
      (entry) => entry.globalFrame === 15
    );

    expect(
      frame15.map((entry) => ({
        targetId: entry.targetId,
        targetOrder: entry.targetOrder,
        wakeKind: entry.wakeKind,
        eventType: entry.eventType
      }))
    ).toEqual([
      {
        targetId: "enemy-0",
        targetOrder: 0,
        wakeKind: "burning-tick",
        eventType: "burningTick"
      },
      {
        targetId: "enemy-1",
        targetOrder: 1,
        wakeKind: "burning-tick",
        eventType: "burningTick"
      }
    ]);
    expect(
      frame15.map((entry) => entry.eventPriority)
    ).toEqual([0.5, 0.5 + 0.5 / 3]);
    expect(
      frame15.map((entry) => ({
        burningRows: entry.burningStateLogIds.length,
        hitRows: entry.hitResolutionLogIds.length,
        reactionTasks: entry.reactionTaskLogIds.length
      }))
    ).toEqual([
      { burningRows: 1, hitRows: 1, reactionTasks: 0 },
      { burningRows: 1, hitRows: 1, reactionTasks: 0 }
    ]);

    const phaseKeys = result.targetTaskPhaseLog.map(
      (entry) => `${entry.globalFrame}:${entry.targetId}`
    );
    expect(new Set(phaseKeys).size).toBe(phaseKeys.length);
    expect(
      result.targetTaskPhaseLog.map((entry) => entry.id)
    ).toEqual(
      result.targetTaskPhaseLog.map((_, index) => index)
    );
    for (const entry of result.targetTaskPhaseLog) {
      expect(entry.targetOrder).toBe(
        entry.targetId === "enemy-0" ? 0 : 1
      );
    }
  });

  it("is deeply reproducible when the config and random seed are unchanged", () => {
    const config = makeTargetTaskPhaseLogConfig(
      "target-phase-v1",
      {
        hitlag: true,
        includeIncoming: true,
        multiTarget: true
      }
    );

    const first = simulate(config);
    const second = simulate(config);

    expect(second.targetTaskPhaseLog).toStrictEqual(
      first.targetTaskPhaseLog
    );
    expect(second).toStrictEqual(first);
  });

  it("matches the compact 1.37 target-phase Golden vectors", () => {
    const scenarios = projectAllTargetTaskPhaseScenarios();
    const scenarioIds: TargetTaskPhaseGoldenScenarioId[] = [
      "lowFuelPreDecay",
      "hitlagReprojection",
      "multiTargetOrder"
    ];

    expect(targetTaskPhaseGolden.commonConfig).toEqual({
      schemaVersion: TARGET_TASK_PHASE_SCHEMA_VERSION,
      engineVersion: TARGET_TASK_PHASE_ENGINE_VERSION,
      targetTaskModel: { mode: "target-phase-v1" },
      reactionEngine: { mode: "aura-v7" },
      timeline: { mode: "legal-frame-v1", fps: 60 }
    });
    expect(
      targetTaskPhaseGolden.provenance
    ).toMatchObject({
      mechanicsDataStatus: "fixed-gcsim-provisional",
      officialServerTruth: false,
      completeGcsimParity: false
    });
    expect(Object.keys(scenarios).sort()).toEqual(
      [...scenarioIds].sort()
    );
    expect(
      Object.keys(targetTaskPhaseGolden.scenarios).sort()
    ).toEqual([...scenarioIds].sort());
    expect(
      Object.keys(targetTaskPhaseGolden.hashes).sort()
    ).toEqual([...scenarioIds].sort());

    expect(CURRENT_SCHEMA_VERSION).toBe("1.39.0");
    expect(CURRENT_ENGINE_VERSION).toBe(
      "1.39.0-shatter-recursive-delivery"
    );

    for (const scenarioId of scenarioIds) {
      const currentScenario = scenarios[scenarioId];
      expect(currentScenario.identity.schemaVersion).toBe(
        CURRENT_SCHEMA_VERSION
      );
      expect(currentScenario.identity.engineVersion).toBe(
        CURRENT_ENGINE_VERSION
      );

      const frozenComparableScenario =
        normalizeIdentityForFrozenV137(currentScenario);
      expect(frozenComparableScenario).toStrictEqual(
        targetTaskPhaseGolden.scenarios[scenarioId]
      );
      expect(sha256(frozenComparableScenario)).toBe(
        targetTaskPhaseGolden.hashes[scenarioId]
      );
      expect(
        sha256(
          targetTaskPhaseGolden.scenarios[scenarioId]
        )
      ).toBe(targetTaskPhaseGolden.hashes[scenarioId]);
    }
  });
});
