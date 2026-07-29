import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import type {
  SimConfig,
  SimulationResult,
  TargetLifecycleTransition,
  TargetPhaseV2LogEntry
} from "@genshin-dps-lab/schemas";
import {
  canonicalStringify,
  TARGET_REACTABLE_PHASE_ENGINE_VERSION,
  TARGET_REACTABLE_PHASE_SCHEMA_VERSION
} from "@genshin-dps-lab/schemas";
import { afterAll, describe, expect, it } from "vitest";
import targetReactablePhaseGoldenJson from "../../../test-vectors/fixtures/target-reactable-phase-1.38.golden.json";
import { simulate } from "../simulator";
import { auraStateSnapshotsEqual } from "../target-state-timeline";
import { makeConfig, neutralStats } from "./fixtures";

type LifecycleScenario =
  | "frozen"
  | "quicken"
  | "burning-fuel"
  | "electro-charged";

interface ScenarioDefinition {
  boundaryFrame: number;
  burningStartFrame: number;
  durationFrames: number;
  triggerElement: "hydro" | "electro" | "pyro";
  triggerGaugeUnits: number;
  initialAura: NonNullable<
    NonNullable<
      SimConfig["enemy"]["targets"]
    >[number]["initialAura"]
  >;
}

const scenarioDefinitions: Record<
  LifecycleScenario,
  ScenarioDefinition
> = {
  frozen: {
    boundaryFrame: 176,
    burningStartFrame: 41,
    durationFrames: 182,
    triggerElement: "hydro",
    triggerGaugeUnits: 1,
    initialAura: [{ element: "cryo", gaugeUnits: 1 }]
  },
  quicken: {
    boundaryFrame: 600,
    burningStartFrame: 465,
    durationFrames: 606,
    triggerElement: "electro",
    triggerGaugeUnits: 1,
    initialAura: [{ element: "dendro", gaugeUnits: 1 }]
  },
  "burning-fuel": {
    boundaryFrame: 61,
    burningStartFrame: 46,
    durationFrames: 67,
    triggerElement: "pyro",
    triggerGaugeUnits: 1,
    initialAura: [{ element: "dendro", gaugeUnits: 0.5 }]
  },
  "electro-charged": {
    boundaryFrame: 570,
    burningStartFrame: 435,
    durationFrames: 576,
    triggerElement: "electro",
    triggerGaugeUnits: 1,
    initialAura: [{ element: "hydro", gaugeUnits: 1 }]
  }
};

type TargetReactablePhaseGoldenScenarioId =
  | "frozenF176"
  | "quickenF600"
  | "burningFuelF61"
  | "electroChargedF570"
  | "frozenHitlag5F181";

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(canonicalStringify(value))
    .digest("hex");
}

function shouldPrintTargetReactablePhaseGolden(
  printGolden: string | undefined,
  scenarioId: TargetReactablePhaseGoldenScenarioId
): boolean {
  return printGolden === "1" || printGolden === scenarioId;
}

function projectAura(
  aura: TargetPhaseV2LogEntry["auraBeforeTargetTasks"]
) {
  return aura.map(
    (entry) =>
      [
        entry.element,
        entry.gaugeUnits,
        entry.expiresAtFrame,
        entry.expiresAtTargetFrame ?? null,
        (entry.sourceSlots ?? []).map(
          (slot) =>
            [slot.sourceActorId, slot.gaugeUnits] as const
        )
      ] as const
  );
}

function projectTargetTask(
  task: TargetPhaseV2LogEntry["targetTasks"][number]
) {
  return {
    stage: task.stage,
    kind: task.kind,
    order: task.order,
    event: [
      task.eventType,
      task.eventPriority,
      task.eventSequence,
      task.intraEventSequence
    ],
    generation: task.generation,
    tickIndex: task.tickIndex,
    deadlineTargetFrame: task.deadlineTargetFrame,
    status: task.status,
    burningStateLogId: task.burningStateLogId,
    targetStateTimelinePointId:
      task.targetStateTimelinePointId
  };
}

function projectLifecycleTransition(
  transition: TargetLifecycleTransition
) {
  const stateLogRef =
    transition.kind === "frozen-expiry"
      ? {
          kind: "frozen-state-log" as const,
          id: transition.frozenStateLogId
        }
      : transition.kind === "quicken-expiry"
        ? {
            kind: "quicken-state-log" as const,
            id: transition.quickenStateLogId
          }
        : transition.kind === "burning-fuel-expiry"
          ? {
              kind: "burning-state-log" as const,
              id: transition.burningStateLogId
            }
          : transition.kind ===
              "electro-charged-expiry"
            ? {
                kind: "periodic-reaction-log" as const,
                id: transition.periodicReactionLogId
              }
            : null;

  return {
    stage: transition.stage,
    kind: transition.kind,
    order: transition.order,
    generation:
      "generation" in transition
        ? transition.generation
        : null,
    deadlineTargetFrame: transition.deadlineTargetFrame,
    stateLogRef,
    quickenStateLogIds:
      transition.kind === "burning-fuel-expiry"
        ? transition.quickenStateLogIds
        : [],
    targetStateTimelinePointId:
      transition.targetStateTimelinePointId
  };
}

function projectTargetPhase(phase: TargetPhaseV2LogEntry) {
  return {
    model: phase.model,
    id: phase.id,
    targetId: phase.targetId,
    targetName: phase.targetName,
    frame: [
      phase.globalFrame,
      phase.timeSeconds,
      phase.targetFrame
    ],
    targetOrder: phase.targetOrder,
    auraBeforeTargetTasks: projectAura(
      phase.auraBeforeTargetTasks
    ),
    targetTasks: phase.targetTasks.map(projectTargetTask),
    auraAfterTargetTasks: projectAura(
      phase.auraAfterTargetTasks
    ),
    reactableTick: {
      frame: [
        phase.reactableTick.fromTargetFrame,
        phase.reactableTick.toTargetFrame
      ],
      auraBefore: projectAura(
        phase.reactableTick.auraBefore
      ),
      transitions: phase.reactableTick.transitions.map(
        projectLifecycleTransition
      ),
      auraAfter: projectAura(
        phase.reactableTick.auraAfter
      )
    },
    refs: {
      hitResolutionLogIds: phase.hitResolutionLogIds,
      reactionTaskLogIds: phase.reactionTaskLogIds
    }
  };
}

function projectTargetReactablePhaseScenario(
  result: SimulationResult,
  boundaryFrame: number,
  abandonedWakeFrame: number | null = null
) {
  const phases = result.targetPhaseLog.filter(
    (entry) => entry.globalFrame === boundaryFrame
  );
  const burningStateLogIds = new Set<number>();
  const frozenStateLogIds = new Set<number>();
  const quickenStateLogIds = new Set<number>();
  const periodicReactionLogIds = new Set<number>();

  for (const phase of phases) {
    for (const task of phase.targetTasks) {
      if (task.burningStateLogId !== null) {
        burningStateLogIds.add(task.burningStateLogId);
      }
    }
    for (const transition of phase.reactableTick.transitions) {
      switch (transition.kind) {
        case "aura-natural-expiry":
          break;
        case "frozen-expiry":
          frozenStateLogIds.add(
            transition.frozenStateLogId
          );
          break;
        case "quicken-expiry":
          quickenStateLogIds.add(
            transition.quickenStateLogId
          );
          break;
        case "burning-fuel-expiry":
          burningStateLogIds.add(
            transition.burningStateLogId
          );
          transition.quickenStateLogIds.forEach((id) =>
            quickenStateLogIds.add(id)
          );
          break;
        case "electro-charged-expiry":
          periodicReactionLogIds.add(
            transition.periodicReactionLogId
          );
          break;
      }
    }
  }

  return {
    identity: {
      schemaVersion: result.schemaVersion,
      engineVersion: result.engineVersion,
      dataVersion: result.dataVersion,
      randomSeed: result.randomSeed,
      configHash: result.runManifest.configHash,
      reproducibilityKey: result.reproducibilityKey,
      resolvedRuntimeOptions:
        result.resolvedRuntimeOptions,
      targetTaskModel: result.config.targetTaskModel,
      targetClockModel: result.config.targetClockModel,
      reactionEngine: result.config.reactionEngine,
      timeline: {
        mode: result.config.timeline?.mode ?? null,
        fps: result.config.timeline?.fps ?? null
      }
    },
    boundaryFrame,
    phases: phases.map(projectTargetPhase),
    boundaryTimelinePoints:
      result.targetStateTimeline.points
        .filter(
          (point) => point.frame === boundaryFrame
        )
        .map((point) => [
          point.id,
          point.frame,
          point.targetFrame ?? null,
          point.targetId,
          point.pointKind,
          point.cause,
          point.eventType,
          point.eventPriority,
          point.eventSequence,
          point.intraEventSequence,
          point.reaction,
          point.reactions,
          point.primaryDamageEventId,
          point.links,
          projectAura(point.auraBefore),
          projectAura(point.auraAfter)
        ]),
    referencedStateLogs: {
      burning: result.burningStateLog
        .filter((entry) =>
          burningStateLogIds.has(entry.id)
        )
        .map((entry) => ({
          id: entry.id,
          generation: entry.generation,
          operation: entry.operation,
          frame: entry.frame,
          targetFrame: entry.targetFrame ?? null,
          targetId: entry.targetId,
          event: [
            entry.eventPriority,
            entry.eventSequence
          ],
          tickIndex: entry.tickIndex,
          reason: entry.reason,
          damageEventIds: entry.damageEventIds,
          fuel: [
            entry.fuelGaugeUnitsBefore,
            entry.fuelGaugeUnitsAfter,
            entry.fuelExpiresAtFrame,
            entry.fuelExpiresAtTargetFrame ?? null
          ],
          nextTick: [
            entry.nextTickFrame,
            entry.nextTickTargetFrame ?? null
          ],
          callbackAura:
            entry.callbackAuraBefore === undefined ||
            entry.callbackAuraAfter === undefined
              ? null
              : {
                  before: projectAura(
                    entry.callbackAuraBefore
                  ),
                  after: projectAura(
                    entry.callbackAuraAfter
                  )
                },
          globalApplicationAura: {
            before: projectAura(entry.auraBefore),
            after: projectAura(entry.auraAfter)
          }
        })),
      frozen: result.frozenStateLog
        .filter((entry) =>
          frozenStateLogIds.has(entry.id)
        )
        .map((entry) => ({
          id: entry.id,
          generation: entry.generation,
          operation: entry.operation,
          frame: entry.frame,
          targetFrame: entry.targetFrame ?? null,
          targetId: entry.targetId,
          expiresAt: [
            entry.expiresAtFrame,
            entry.expiresAtTargetFrame ?? null
          ],
          reason: entry.reason,
          auraBefore: projectAura(entry.auraBefore),
          auraAfter: projectAura(entry.auraAfter)
        })),
      quicken: result.quickenStateLog
        .filter((entry) =>
          quickenStateLogIds.has(entry.id)
        )
        .map((entry) => ({
          id: entry.id,
          generation: entry.generation,
          operation: entry.operation,
          frame: entry.frame,
          targetFrame: entry.targetFrame ?? null,
          targetId: entry.targetId,
          gauge: [
            entry.quickenGaugeUnitsBefore,
            entry.quickenGaugeUnitsAfter
          ],
          expiresAt: [
            entry.expiresAtFrame,
            entry.expiresAtTargetFrame ?? null
          ],
          reason: entry.reason,
          auraBefore: projectAura(entry.auraBefore),
          auraAfter: projectAura(entry.auraAfter)
        })),
      periodic: result.periodicReactionLog
        .filter((entry) =>
          periodicReactionLogIds.has(entry.id)
        )
        .map((entry) => ({
          id: entry.id,
          generation: entry.generation,
          operation: entry.operation,
          frame: entry.frame,
          targetFrame: entry.targetFrame ?? null,
          targetId: entry.targetId,
          tickIndex: entry.tickIndex,
          reason: entry.reason,
          auraBefore: projectAura(entry.auraBefore),
          auraAfter: projectAura(entry.auraAfter)
        }))
    },
    periodicGlobalRows: result.periodicReactionLog
      .filter(
        (entry) =>
          entry.operation === "tick" ||
          entry.operation === "wane-skipped"
      )
      .map((entry) => [
        entry.id,
        entry.operation,
        entry.frame,
        entry.targetFrame ?? null,
        entry.targetId,
        entry.tickIndex,
        entry.damageEventId,
        entry.reason
      ]),
    damage: {
      totalDamage: result.totalDamage,
      dps: result.dps,
      hitCount: result.damageEvents.length,
      rows: result.damageEvents.map((entry) => [
        entry.id,
        entry.kind,
        entry.frame,
        entry.targetId,
        entry.element,
        entry.reaction,
        entry.parentDamageEventId,
        entry.eventPriority,
        entry.eventSequence,
        entry.finalDamage,
        entry.displayDamage
      ])
    },
    targetClock: {
      audit: result.targetClockAudit,
      transitions: result.targetClockLog.map((entry) => [
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
      ]),
      hitlag: result.targetHitlagLog.map((entry) => [
        entry.id,
        entry.globalFrame,
        entry.targetFrame,
        entry.targetId,
        entry.hitResolutionLogId,
        entry.haltFrames,
        entry.factor,
        entry.extensionFrames,
        entry.frozenFramesBefore,
        entry.frozenFramesAfter,
        entry.pausedGlobalFrameStart,
        entry.nextTargetAdvanceGlobalFrame,
        entry.applied,
        entry.blockedReason
      ])
    },
    abandonedWake:
      abandonedWakeFrame === null
        ? null
        : {
            globalFrame: abandonedWakeFrame,
            targetPhaseRows: result.targetPhaseLog.filter(
              (entry) =>
                entry.globalFrame === abandonedWakeFrame &&
                entry.targetId === "enemy-0"
            ).length,
            frozenExpiryRows: result.frozenStateLog.filter(
              (entry) =>
                entry.operation === "expire" &&
                entry.frame === abandonedWakeFrame &&
                entry.targetId === "enemy-0"
            ).length,
            frozenTimelinePoints:
              result.targetStateTimeline.points.filter(
                (point) =>
                  point.cause === "frozen-expiry" &&
                  point.frame === abandonedWakeFrame &&
                  point.targetId === "enemy-0"
              ).length
          }
  };
}

type TargetReactablePhaseGoldenScenario = ReturnType<
  typeof projectTargetReactablePhaseScenario
>;

interface TargetReactablePhaseGoldenFixture {
  fixtureVersion: "target-reactable-phase-1.38";
  provenance: {
    mechanicsDataStatus: "fixed-gcsim-provisional";
    referenceProject: "genshinsim/gcsim";
    referenceCommit: string;
    officialServerTruth: false;
    completeGcsimParity: false;
    scope: string;
    limitations: string[];
  };
  projectionFormat: Record<string, string[]>;
  commonConfig: {
    schemaVersion: string;
    engineVersion: string;
    targetTaskModel: { mode: "target-phase-v2" };
    reactionEngine: { mode: "aura-v7" };
    timeline: { mode: "legal-frame-v1"; fps: 60 };
  };
  scenarios: Record<
    TargetReactablePhaseGoldenScenarioId,
    TargetReactablePhaseGoldenScenario
  >;
  hashes: Record<
    TargetReactablePhaseGoldenScenarioId,
    string
  >;
}

const targetReactablePhaseGolden =
  targetReactablePhaseGoldenJson as unknown as TargetReactablePhaseGoldenFixture;

const goldenScenarioIds: TargetReactablePhaseGoldenScenarioId[] =
  [
    "frozenF176",
    "quickenF600",
    "burningFuelF61",
    "electroChargedF570",
    "frozenHitlag5F181"
  ];

const generatedGoldenScenarios: Partial<
  Record<
    TargetReactablePhaseGoldenScenarioId,
    TargetReactablePhaseGoldenScenario
  >
> = {};

afterAll(() => {
  if (
    process.env.UPDATE_TARGET_REACTABLE_PHASE_GOLDEN !==
    "1"
  ) {
    return;
  }
  const generatedIds = Object.keys(
    generatedGoldenScenarios
  ).sort();
  if (
    canonicalStringify(generatedIds) !==
    canonicalStringify([...goldenScenarioIds].sort())
  ) {
    throw new Error(
      `Refusing to write incomplete target-reactable Golden: ${generatedIds.join(
        ", "
      )}`
    );
  }
  const scenarios =
    generatedGoldenScenarios as Record<
      TargetReactablePhaseGoldenScenarioId,
      TargetReactablePhaseGoldenScenario
    >;
  const hashes = Object.fromEntries(
    goldenScenarioIds.map((scenarioId) => [
      scenarioId,
      sha256(scenarios[scenarioId])
    ])
  );
  const fixture = {
    ...targetReactablePhaseGoldenJson,
    scenarios,
    hashes
  };
  writeFileSync(
    new URL(
      "../../../test-vectors/fixtures/target-reactable-phase-1.38.golden.json",
      import.meta.url
    ),
    `${JSON.stringify(fixture, null, 2)}\n`
  );
});

function expectGoldenScenario(
  scenarioId: TargetReactablePhaseGoldenScenarioId,
  result: SimulationResult,
  boundaryFrame: number,
  abandonedWakeFrame: number | null = null
): void {
  const scenario = projectTargetReactablePhaseScenario(
    result,
    boundaryFrame,
    abandonedWakeFrame
  );

  if (
    process.env.UPDATE_TARGET_REACTABLE_PHASE_GOLDEN ===
    "1"
  ) {
    generatedGoldenScenarios[scenarioId] = scenario;
    return;
  }
  const printGolden =
    process.env.PRINT_TARGET_REACTABLE_PHASE_GOLDEN;
  if (
    shouldPrintTargetReactablePhaseGolden(
      printGolden,
      scenarioId
    )
  ) {
    console.log(
      `TARGET_REACTABLE_PHASE_GOLDEN:${scenarioId}:${JSON.stringify(
        {
          scenario,
          hash: sha256(scenario)
        },
        null,
        2
      )}`
    );
    return;
  }

  expect(targetReactablePhaseGolden).toMatchObject({
    fixtureVersion: "target-reactable-phase-1.38",
    provenance: {
      mechanicsDataStatus: "fixed-gcsim-provisional",
      referenceProject: "genshinsim/gcsim",
      officialServerTruth: false,
      completeGcsimParity: false
    },
    commonConfig: {
      schemaVersion: TARGET_REACTABLE_PHASE_SCHEMA_VERSION,
      engineVersion: TARGET_REACTABLE_PHASE_ENGINE_VERSION,
      targetTaskModel: { mode: "target-phase-v2" },
      reactionEngine: { mode: "aura-v7" },
      timeline: { mode: "legal-frame-v1", fps: 60 }
    }
  });
  expect(
    targetReactablePhaseGolden.provenance.limitations
  ).toContain(
    "Synchronous cross-target Burning application remains unimplemented; queued reactionDamage resolves later in the global/core phase."
  );
  expect(
    Object.keys(targetReactablePhaseGolden.scenarios).sort()
  ).toEqual([...goldenScenarioIds].sort());
  expect(
    Object.keys(targetReactablePhaseGolden.hashes).sort()
  ).toEqual([...goldenScenarioIds].sort());
  expect(scenario).toStrictEqual(
    targetReactablePhaseGolden.scenarios[scenarioId]
  );
  expect(sha256(scenario)).toBe(
    targetReactablePhaseGolden.hashes[scenarioId]
  );
  expect(
    sha256(
      targetReactablePhaseGolden.scenarios[scenarioId]
    )
  ).toBe(targetReactablePhaseGolden.hashes[scenarioId]);
}

function makeLifecycleScenarioConfig(
  scenario: LifecycleScenario,
  mode: SimConfig["targetTaskModel"]["mode"] = "target-phase-v2",
  options: { frozenHitlagFrames?: number } = {}
): SimConfig {
  const base = makeConfig();
  const definition = scenarioDefinitions[scenario];
  const hitlagFrames = options.frozenHitlagFrames ?? 0;
  const globalBoundaryFrame =
    definition.boundaryFrame + hitlagFrames;
  const durationFrames =
    definition.durationFrames + hitlagFrames;
  const burningStartFrame =
    definition.burningStartFrame + hitlagFrames;

  return {
    ...base,
    duration: durationFrames / 60,
    cycleLength: durationFrames / 60,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: `${scenario} lifecycle target`,
          position: { x: 100, y: 0 },
          initialAura: definition.initialAura
        },
        {
          id: "enemy-1",
          name: "Later Burning target",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "dendro", gaugeUnits: 4 }]
        }
      ],
      ...(scenario === "electro-charged"
        ? {
            targetPhases: [
              {
                id: "ec-stream-damage-immune",
                label:
                  "Keep EC Aura intact until the natural coexistence boundary",
                targetId: "enemy-0",
                startFrame: 0,
                endFrame: globalBoundaryFrame,
                reason: "TEST_EC_DAMAGE_IMMUNITY",
                effects: {
                  damage: "immune" as const,
                  aura: "normal" as const,
                  hitConfirm: "normal" as const
                }
              }
            ]
          }
        : {})
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "phase-driver",
        name: "Target Reactable phase driver",
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
      hitlagFrames > 0
        ? { mode: "target-local-hitlag-v1" }
        : { mode: "disabled" },
    targetTaskModel: { mode },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "phase-driver",
      swapFrames: 1,
      abilities: [
        {
          id: `${scenario}-phase-vector`,
          actorId: "phase-driver",
          name: `${scenario} target Reactable phase vector`,
          kind: "skill",
          cancelFrame: burningStartFrame + 1,
          animationEndFrame: burningStartFrame + 1,
          cooldownFrames: 0,
          hits: [
            {
              id: `${scenario}-start`,
              label: `${scenario} start`,
              frame: 0,
              scaling: 0,
              element: definition.triggerElement,
              geometry: {
                kind: "circle",
                coordinateSpace: "world",
                origin: { x: 100, y: 0 },
                radius: 0.1
              },
              application: {
                gaugeUnits: definition.triggerGaugeUnits,
                icdTag: `${scenario}-start`,
                icdGroup: "no-icd"
              },
              ...(hitlagFrames > 0
                ? {
                    targetHitlag: {
                      haltFrames: hitlagFrames,
                      factor: 0
                    }
                  }
                : {})
            },
            {
              id: "later-burning-start",
              label: "Later target Burning start",
              frame: burningStartFrame,
              scaling: 0,
              element: "pyro",
              geometry: {
                kind: "circle",
                coordinateSpace: "world",
                origin: { x: 0, y: 0 },
                radius: 0.1
              },
              application: {
                gaugeUnits: 1,
                icdTag: "later-burning-start",
                icdGroup: "no-icd"
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "phase-driver",
          abilityId: `${scenario}-phase-vector`,
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
): TargetPhaseV2LogEntry {
  const matches = result.targetPhaseLog.filter(
    (entry) =>
      entry.globalFrame === globalFrame &&
      entry.targetId === targetId
  );
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function expectAuraOnlyDecreases(
  before: TargetPhaseV2LogEntry["auraAfterTargetTasks"],
  after: TargetPhaseV2LogEntry["reactableTick"]["auraBefore"]
): void {
  for (const afterEntry of after) {
    const beforeEntry = before.find(
      (candidate) =>
        candidate.element === afterEntry.element
    );
    expect(beforeEntry).toBeDefined();
    expect(afterEntry.gaugeUnits).toBeLessThanOrEqual(
      beforeEntry!.gaugeUnits + 1e-12
    );
    for (const afterSlot of afterEntry.sourceSlots ?? []) {
      const beforeSlot = beforeEntry!.sourceSlots?.find(
        (candidate) =>
          candidate.sourceActorId ===
          afterSlot.sourceActorId
      );
      expect(beforeSlot).toBeDefined();
      expect(afterSlot.gaugeUnits).toBeLessThanOrEqual(
        beforeSlot!.gaugeUnits + 1e-12
      );
    }
  }
}

function expectPhaseContinuity(
  result: SimulationResult,
  phase: TargetPhaseV2LogEntry
): void {
  expect(phase).toMatchObject({
    model: "target-phase-v2",
    targetFrame: phase.reactableTick.toTargetFrame
  });
  expect(phase.targetTasks.map((task) => task.order)).toEqual(
    phase.targetTasks.map((_, index) => index)
  );
  expect(
    phase.reactableTick.transitions.map(
      (transition) => transition.order
    )
  ).toEqual(
    phase.reactableTick.transitions.map((_, index) => index)
  );

  const ownedPointIds = [
    ...phase.targetTasks.map(
      (task) => task.targetStateTimelinePointId
    ),
    ...phase.reactableTick.transitions.map(
      (transition) => transition.targetStateTimelinePointId
    )
  ];
  const firstOwnedPointId =
    ownedPointIds.length === 0
      ? Number.POSITIVE_INFINITY
      : Math.min(...ownedPointIds);
  const precedingPoint = [
    ...result.targetStateTimeline.points
  ]
    .reverse()
    .find(
      (point) =>
        point.targetId === phase.targetId &&
        point.id < firstOwnedPointId &&
        (point.frame < phase.globalFrame ||
          (phase.globalFrame === 0 &&
            point.frame === 0 &&
            point.cause === "simulation-start"))
    );
  expect(precedingPoint).toBeDefined();
  expectAuraOnlyDecreases(
    precedingPoint!.auraAfter,
    phase.auraBeforeTargetTasks
  );

  let cursor = phase.auraBeforeTargetTasks;
  for (const task of phase.targetTasks) {
    const point =
      result.targetStateTimeline.points[
        task.targetStateTimelinePointId
      ];
    expect(point).toBeDefined();
    expect(point).toMatchObject({
      id: task.targetStateTimelinePointId,
      frame: phase.globalFrame,
      targetFrame: phase.targetFrame,
      targetId: phase.targetId,
      cause: "burning-tick"
    });
    expect(point!.auraBefore).toStrictEqual(cursor);
    cursor = point!.auraAfter;
  }
  expect(phase.auraAfterTargetTasks).toStrictEqual(cursor);
  // Ordinary per-frame gauge decay is the only implicit segment. It may
  // remove or reduce existing Aura, but cannot create or strengthen it.
  expectAuraOnlyDecreases(
    phase.auraAfterTargetTasks,
    phase.reactableTick.auraBefore
  );
  cursor = phase.reactableTick.auraBefore;

  for (const transition of phase.reactableTick.transitions) {
    const point =
      result.targetStateTimeline.points[
        transition.targetStateTimelinePointId
      ];
    expect(point).toBeDefined();
    expect(point).toMatchObject({
      id: transition.targetStateTimelinePointId,
      frame: phase.globalFrame,
      targetFrame: phase.targetFrame,
      targetId: phase.targetId
    });
    expect(point!.auraBefore).toStrictEqual(cursor);
    cursor = point!.auraAfter;
  }
  expect(phase.reactableTick.auraAfter).toStrictEqual(cursor);

  const phasePointIds = [
    ...phase.targetTasks.map(
      (task) => task.targetStateTimelinePointId
    ),
    ...phase.reactableTick.transitions.map(
      (transition) => transition.targetStateTimelinePointId
    )
  ];
  const lastPhasePointId =
    phasePointIds.length === 0
      ? null
      : Math.max(...phasePointIds);
  if (lastPhasePointId !== null) {
    const nextAuthoritativePoint =
      result.targetStateTimeline.points.find(
        (point) =>
          point.id > lastPhasePointId &&
          point.targetId === phase.targetId
      );
    if (
      nextAuthoritativePoint !== undefined &&
      nextAuthoritativePoint.frame === phase.globalFrame
    ) {
      expect(
        auraStateSnapshotsEqual(
          phase.reactableTick.auraAfter,
          nextAuthoritativePoint.auraBefore
        )
      ).toBe(true);
    }
  }
}

function expectEarlierTargetBeforeLaterBurning(
  result: SimulationResult,
  globalFrame: number,
  expectedTransitionKind: TargetLifecycleTransition["kind"],
  expectedTickIndex: number
): {
  earlier: TargetPhaseV2LogEntry;
  later: TargetPhaseV2LogEntry;
  transition: TargetLifecycleTransition;
} {
  const phases = result.targetPhaseLog.filter(
    (entry) => entry.globalFrame === globalFrame
  );
  expect(phases.map((entry) => entry.targetId)).toEqual([
    "enemy-0",
    "enemy-1"
  ]);

  const earlier = phaseAt(result, globalFrame, "enemy-0");
  const later = phaseAt(result, globalFrame, "enemy-1");
  expect(earlier.targetOrder).toBe(0);
  expect(later.targetOrder).toBe(1);
  expect(earlier.id).toBeLessThan(later.id);
  expectPhaseContinuity(result, earlier);
  expectPhaseContinuity(result, later);

  expect(earlier.targetTasks).toEqual([]);
  const expectedTransitionKinds =
    expectedTransitionKind === "electro-charged-expiry"
      ? [
          "aura-natural-expiry",
          "electro-charged-expiry"
        ]
      : [expectedTransitionKind];
  expect(
    earlier.reactableTick.transitions.map(
      (transition) => transition.kind
    )
  ).toEqual(expectedTransitionKinds);
  const transition =
    earlier.reactableTick.transitions.find(
      (candidate) =>
        candidate.kind === expectedTransitionKind
    );
  expect(transition).toBeDefined();

  expect(later.reactableTick.transitions).toEqual([]);
  expect(later.targetTasks).toHaveLength(1);
  const [burningTask] = later.targetTasks;
  // This phase contract covers the target-owned Burning callback only.
  // Its queued reactionDamage still resolves later in the global/core stage;
  // this test must not imply synchronous cross-target Burning application.
  expect(burningTask).toMatchObject({
    stage: "target-task",
    kind: "burning-tick",
    order: 0,
    eventType: "burningTick",
    tickIndex: expectedTickIndex,
    deadlineTargetFrame: globalFrame,
    status: "applied",
    burningStateLogId: expect.any(Number)
  });
  const burningLog =
    result.burningStateLog[burningTask!.burningStateLogId!];
  expect(burningLog).toMatchObject({
    id: burningTask!.burningStateLogId,
    generation: burningTask!.generation,
    operation:
      expectedTickIndex === 9 ? "tick-skipped" : "tick",
    frame: globalFrame,
    targetId: "enemy-1",
    tickIndex: expectedTickIndex
  });
  expect(
    transition!.targetStateTimelinePointId
  ).toBeLessThan(burningTask!.targetStateTimelinePointId);
  const orderedFramePointIds =
    result.targetStateTimeline.points
      .filter(
        (point) =>
          point.frame === globalFrame &&
          (point.id ===
            transition!.targetStateTimelinePointId ||
            point.id ===
              burningTask!.targetStateTimelinePointId)
      )
      .map((point) => point.id);
  expect(orderedFramePointIds).toEqual([
    transition!.targetStateTimelinePointId,
    burningTask!.targetStateTimelinePointId
  ]);

  return { earlier, later, transition: transition! };
}

function expectIntegerDisplayDamage(
  result: SimulationResult,
  expectedBurningTicks: number
): void {
  expect(
    result.damageEvents.every((event) =>
      Number.isInteger(event.displayDamage)
    )
  ).toBe(true);
  const burningDamage = result.damageEvents.filter(
    (event) =>
      event.kind === "transformative-reaction" &&
      event.reaction === "burning" &&
      event.finalDamage > 0
  );
  expect(burningDamage).toHaveLength(expectedBurningTicks);
  expect(
    burningDamage.map((event) => event.displayDamage)
  ).toEqual(Array(expectedBurningTicks).fill(574));
}

describe("target Reactable Golden print gate", () => {
  it.each([
    [undefined, false],
    ["0", false],
    ["false", false],
    ["quickenF600", false],
    ["1", true],
    ["frozenF176", true]
  ] as const)(
    "prints only for the global flag or the current scenario: %s",
    (printGolden, expected) => {
      expect(
        shouldPrintTargetReactablePhaseGolden(
          printGolden,
          "frozenF176"
        )
      ).toBe(expected);
    }
  );
});

describe("target-phase-v2 target callback to Reactable.Tick ordering", () => {
  it("forms one continuous same-target callback -> Fuel-expiry chain at F15", () => {
    const config = makeLifecycleScenarioConfig(
      "burning-fuel"
    );
    config.duration = 1;
    config.cycleLength = 1;
    config.enemy.targets = [
      {
        id: "enemy-0",
        name: "Same-target Burning boundary",
        position: { x: 100, y: 0 },
        initialAura: [
          { element: "dendro", gaugeUnits: 7 / 60 }
        ]
      }
    ];
    const ability = config.timeline!.abilities[0]!;
    ability.cancelFrame = 1;
    ability.animationEndFrame = 1;
    ability.hits = [ability.hits![0]!];

    const result = simulate(config, { critMode: "noCrit" });
    const phase = phaseAt(result, 15, "enemy-0");
    expectPhaseContinuity(result, phase);
    expect(phase.targetTasks).toHaveLength(1);
    expect(phase.reactableTick.transitions).toHaveLength(1);
    const task = phase.targetTasks[0]!;
    const transition =
      phase.reactableTick.transitions[0]!;
    expect(task).toMatchObject({
      kind: "burning-tick",
      tickIndex: 1,
      status: "applied",
      burningStateLogId: expect.any(Number)
    });
    expect(transition).toMatchObject({
      kind: "burning-fuel-expiry",
      deadlineTargetFrame: 15,
      burningStateLogId: expect.any(Number)
    });
    expect(task.targetStateTimelinePointId).toBeLessThan(
      transition.targetStateTimelinePointId
    );
    expect(result.totalDamage).toBe(573.5740660714285);
    expectIntegerDisplayDamage(result, 1);
  });

  it("expires Frozen on target 0 at F176 before target 1 Burning tick 9", () => {
    const result = simulate(
      makeLifecycleScenarioConfig("frozen"),
      { critMode: "noCrit" }
    );
    const { transition } =
      expectEarlierTargetBeforeLaterBurning(
        result,
        176,
        "frozen-expiry",
        9
      );

    expect(transition).toMatchObject({
      stage: "reactable-tick",
      kind: "frozen-expiry",
      order: 0,
      deadlineTargetFrame: 176,
      frozenStateLogId: expect.any(Number)
    });
    if (transition.kind !== "frozen-expiry") {
      throw new Error("Expected a Frozen lifecycle transition.");
    }
    expect(
      result.frozenStateLog[transition.frozenStateLogId]
    ).toMatchObject({
      id: transition.frozenStateLogId,
      generation: transition.generation,
      operation: "expire",
      frame: 176,
      targetFrame: 176,
      targetId: "enemy-0",
      reason: "FROZEN_DECAY_EXPIRED"
    });
    expect(
      result.targetStateTimeline.points[
        transition.targetStateTimelinePointId
      ]?.links
    ).toEqual([
      {
        kind: "frozen-state-log",
        id: transition.frozenStateLogId
      }
    ]);
    expect(result.totalDamage).toBe(4588.592528571428);
    expectIntegerDisplayDamage(result, 8);
    expectGoldenScenario(
      "frozenF176",
      result,
      176
    );
  });

  it("expires Quicken on target 0 at F600 before target 1 Burning tick 9", () => {
    const result = simulate(
      makeLifecycleScenarioConfig("quicken"),
      { critMode: "noCrit" }
    );
    const { transition } =
      expectEarlierTargetBeforeLaterBurning(
        result,
        600,
        "quicken-expiry",
        9
      );

    expect(transition).toMatchObject({
      stage: "reactable-tick",
      kind: "quicken-expiry",
      order: 0,
      deadlineTargetFrame: 600,
      quickenStateLogId: expect.any(Number)
    });
    if (transition.kind !== "quicken-expiry") {
      throw new Error("Expected a Quicken lifecycle transition.");
    }
    expect(
      result.quickenStateLog[transition.quickenStateLogId]
    ).toMatchObject({
      id: transition.quickenStateLogId,
      generation: transition.generation,
      operation: "expire",
      frame: 600,
      targetFrame: 600,
      targetId: "enemy-0",
      reason: "QUICKEN_DECAY_EXPIRED"
    });
    expect(
      result.targetStateTimeline.points[
        transition.targetStateTimelinePointId
      ]?.links
    ).toEqual([
      {
        kind: "quicken-state-log",
        id: transition.quickenStateLogId
      }
    ]);
    expect(result.totalDamage).toBe(4588.592528571428);
    expectIntegerDisplayDamage(result, 8);
    expectGoldenScenario(
      "quickenF600",
      result,
      600
    );
  });

  it("expires 0.5U Burning Fuel on target 0 at F61 before target 1 Burning tick 1", () => {
    const result = simulate(
      makeLifecycleScenarioConfig("burning-fuel"),
      { critMode: "noCrit" }
    );
    const { later, transition } =
      expectEarlierTargetBeforeLaterBurning(
        result,
        61,
        "burning-fuel-expiry",
        1
      );

    expect(transition).toMatchObject({
      stage: "reactable-tick",
      kind: "burning-fuel-expiry",
      order: 0,
      deadlineTargetFrame: 61,
      burningStateLogId: expect.any(Number),
      quickenStateLogIds: []
    });
    if (transition.kind !== "burning-fuel-expiry") {
      throw new Error("Expected a Burning Fuel lifecycle transition.");
    }
    expect(
      result.burningStateLog[transition.burningStateLogId]
    ).toMatchObject({
      id: transition.burningStateLogId,
      generation: transition.generation,
      operation: "fuel-expire",
      frame: 61,
      targetId: "enemy-0",
      reason: "FUEL_EXPIRED"
    });
    expect(
      result.targetStateTimeline.points[
        transition.targetStateTimelinePointId
      ]?.links
    ).toEqual([
      {
        kind: "burning-state-log",
        id: transition.burningStateLogId
      }
    ]);
    const taskPointId =
      later.targetTasks[0]!.targetStateTimelinePointId;
    const postReactablePoint =
      result.targetStateTimeline.points.find(
        (point) =>
          point.id > taskPointId &&
          point.frame === 61 &&
          point.targetId === "enemy-1"
      );
    expect(postReactablePoint).toBeDefined();
    expect(postReactablePoint!.auraBefore).toStrictEqual(
      later.reactableTick.auraAfter
    );
    expect(postReactablePoint!.links).toEqual(
      expect.arrayContaining([
        { kind: "target-phase-log", id: later.id }
      ])
    );
    expect(result.totalDamage).toBe(2867.870330357143);
    expectIntegerDisplayDamage(result, 5);
    expectGoldenScenario(
      "burningFuelF61",
      result,
      61
    );
  });

  it("expires EC coexistence before the later target callback while tick and wane stay global", () => {
    const result = simulate(
      makeLifecycleScenarioConfig("electro-charged"),
      { critMode: "noCrit" }
    );
    const { earlier, transition } =
      expectEarlierTargetBeforeLaterBurning(
        result,
        570,
        "electro-charged-expiry",
        9
      );

    const ordinaryExpiry =
      earlier.reactableTick.transitions[0]!;
    expect(ordinaryExpiry).toMatchObject({
      stage: "reactable-tick",
      kind: "aura-natural-expiry",
      order: 0,
      deadlineTargetFrame: 570
    });
    expect(
      result.targetStateTimeline.points[
        ordinaryExpiry.targetStateTimelinePointId
      ]
    ).toMatchObject({
      cause: "aura-natural-expiry",
      frame: 570,
      targetFrame: 570,
      targetId: "enemy-0",
      links: []
    });
    expect(transition).toMatchObject({
      stage: "reactable-tick",
      kind: "electro-charged-expiry",
      order: 1,
      deadlineTargetFrame: 570,
      periodicReactionLogId: expect.any(Number)
    });
    if (transition.kind !== "electro-charged-expiry") {
      throw new Error(
        "Expected an Electro-Charged lifecycle transition."
      );
    }
    expect(
      result.periodicReactionLog[
        transition.periodicReactionLogId
      ]
    ).toMatchObject({
      id: transition.periodicReactionLogId,
      generation: transition.generation,
      operation: "stop",
      frame: 570,
      targetFrame: 570,
      targetId: "enemy-0",
      reason: "AURA_DECAY_EXPIRED"
    });
    expect(
      result.targetStateTimeline.points[
        transition.targetStateTimelinePointId
      ]?.links
    ).toEqual([
      {
        kind: "periodic-reaction-log",
        id: transition.periodicReactionLogId
      }
    ]);

    const ticks = result.periodicReactionLog.filter(
      (entry) => entry.operation === "tick"
    );
    const wanes = result.periodicReactionLog.filter(
      (entry) => entry.operation === "wane-skipped"
    );
    expect(ticks.map((entry) => entry.frame)).toEqual([
      10, 70, 130, 190, 250, 310, 370, 430, 490, 550
    ]);
    expect(wanes.map((entry) => entry.frame)).toEqual([
      16, 76, 136, 196, 256, 316, 376, 436, 496, 556
    ]);
    expect(
      [...ticks, ...wanes].every(
        (entry) => entry.targetFrame === undefined
      )
    ).toBe(true);
    expect(
      result.targetStateTimeline.points
        .filter(
          (point) => point.cause === "electro-charged-tick"
        )
        .every(
          (point) =>
            point.eventType === "periodicReactionTick" &&
            point.eventPriority === 4
        )
    ).toBe(true);
    expect(
      result.targetStateTimeline.points
        .filter(
          (point) => point.cause === "electro-charged-wane"
        )
        .every(
          (point) =>
            point.eventType === "periodicReactionWane" &&
            point.eventPriority === 6
        )
    ).toBe(true);
    expect(result.totalDamage).toBe(4588.592528571428);
    expectIntegerDisplayDamage(result, 8);
    expectGoldenScenario(
      "electroChargedF570",
      result,
      570
    );
  });

  it("reprojects Frozen F176 to global F181 under H=5 without emitting the stale wake", () => {
    const result = simulate(
      makeLifecycleScenarioConfig("frozen", "target-phase-v2", {
        frozenHitlagFrames: 5
      }),
      { critMode: "noCrit" }
    );

    expect(result.targetHitlagLog).toMatchObject([
      {
        globalFrame: 0,
        targetFrame: 0,
        targetId: "enemy-0",
        haltFrames: 5,
        factor: 0,
        extensionFrames: 5,
        applied: true
      }
    ]);
    expect(
      result.targetPhaseLog.some(
        (entry) =>
          entry.globalFrame === 176 &&
          entry.targetId === "enemy-0"
      )
    ).toBe(false);
    expect(
      result.frozenStateLog.some(
        (entry) =>
          entry.operation === "expire" && entry.frame === 176
      )
    ).toBe(false);
    expect(
      result.targetStateTimeline.points.some(
        (point) =>
          point.cause === "frozen-expiry" &&
          point.frame === 176
      )
    ).toBe(false);

    const { earlier, later, transition } =
      expectEarlierTargetBeforeLaterBurning(
        result,
        181,
        "frozen-expiry",
        9
      );
    expect(earlier.targetFrame).toBe(176);
    expect(later.targetFrame).toBe(181);
    if (transition.kind !== "frozen-expiry") {
      throw new Error("Expected a Frozen lifecycle transition.");
    }
    expect(transition.deadlineTargetFrame).toBe(176);
    expect(
      result.frozenStateLog[transition.frozenStateLogId]
    ).toMatchObject({
      operation: "expire",
      frame: 181,
      targetFrame: 176,
      targetId: "enemy-0"
    });
    expect(result.totalDamage).toBe(4588.592528571428);
    expectIntegerDisplayDamage(result, 8);
    expectGoldenScenario(
      "frozenHitlag5F181",
      result,
      181,
      176
    );
  });

  it("keeps legacy, target-phase-v1, and target-phase-v2 logs mutually exclusive", () => {
    const legacy = simulate(
      makeLifecycleScenarioConfig(
        "burning-fuel",
        "legacy-event-heap-v1"
      ),
      { critMode: "noCrit" }
    );
    const v1 = simulate(
      makeLifecycleScenarioConfig(
        "burning-fuel",
        "target-phase-v1"
      ),
      { critMode: "noCrit" }
    );
    const v2 = simulate(
      makeLifecycleScenarioConfig(
        "burning-fuel",
        "target-phase-v2"
      ),
      { critMode: "noCrit" }
    );

    expect(legacy.targetTaskPhaseLog).toEqual([]);
    expect(legacy.targetPhaseLog).toEqual([]);
    expect(v1.targetTaskPhaseLog.length).toBeGreaterThan(0);
    expect(v1.targetPhaseLog).toEqual([]);
    expect(v2.targetTaskPhaseLog).toEqual([]);
    expect(v2.targetPhaseLog.length).toBeGreaterThan(0);
  });
});
