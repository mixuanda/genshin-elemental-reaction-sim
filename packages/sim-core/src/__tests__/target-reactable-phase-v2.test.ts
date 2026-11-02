import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type {
  SimConfig,
  SimulationResult,
  TargetLifecycleTransition,
  TargetPhaseV2LogEntry
} from "@genshin-dps-lab/schemas";
import {
  assertTrustedSimulationResult,
  canonicalStringify,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION,
  SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
  TARGET_REACTABLE_PHASE_ENGINE_VERSION,
  TARGET_REACTABLE_PHASE_SCHEMA_VERSION,
  simulationResultSchema
} from "@genshin-dps-lab/schemas";
import {
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID
} from "@genshin-dps-lab/icd-profiles";
import { describe, expect, it } from "vitest";
import targetReactablePhaseGoldenJson from "../../../test-vectors/fixtures/target-reactable-phase-1.38.golden.json";
import targetReactablePhaseV139GoldenJson from "../../../test-vectors/fixtures/target-reactable-phase-1.39.golden.json";
import { simulate } from "../simulator";
import { parseSimulationHit } from "../calculator-bridge";
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
  const phases = result.targetPhaseLog
    .filter((entry) => entry.globalFrame === boundaryFrame)
    .map((entry) => {
      if (entry.model !== "target-phase-v2") {
        throw new Error(
          `Expected target-phase-v2 at frame ${boundaryFrame}; got ${entry.model}.`
        );
      }
      return entry;
    });
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
      // This lifecycle fixture freezes applied clock reprojections. Blocked
      // miss audits are asserted directly below so the frozen 1.38 lifecycle
      // projection remains unchanged while the runtime audit becomes complete.
      hitlag: result.targetHitlagLog
        .filter((entry) => entry.applied)
        .map((entry) => [
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

function projectTargetReactablePhaseScenarioV139(
  result: SimulationResult,
  boundaryFrame: number,
  abandonedWakeFrame: number | null = null
) {
  const historicalProjection =
    projectTargetReactablePhaseScenario(
      result,
      boundaryFrame,
      abandonedWakeFrame
    );
  const targetClockAuditById =
    result.targetClockAudit.mode === "target-local-hitlag-v1"
      ? new Map(
          result.targetClockAudit.targets.map((target) => [
            target.targetId,
            target
          ])
        )
      : new Map();
  const targetMissAudits = result.targetHitlagLog
    .filter(
      (entry) =>
        entry.applied === false &&
        entry.blockedReason === "TARGET_MISS"
    )
    .map((entry) => {
      const hitResolution =
        result.hitResolutionLog[entry.hitResolutionLogId];
      if (hitResolution === undefined) {
        throw new Error(
          `Missing hit resolution ${entry.hitResolutionLogId} for target Miss audit.`
        );
      }
      const phase = result.targetPhaseLog.find(
        (candidate) =>
          candidate.globalFrame === entry.globalFrame &&
          candidate.targetId === entry.targetId &&
          candidate.hitResolutionLogIds.includes(
            hitResolution.id
          )
      );
      if (phase === undefined) {
        throw new Error(
          `Missing target-phase-v2 owner for target Miss resolution ${hitResolution.id}.`
        );
      }
      if (phase.model !== "target-phase-v2") {
        throw new Error(
          `Target Miss resolution ${hitResolution.id} was owned by ${phase.model}, not target-phase-v2.`
        );
      }
      return {
        hitResolution: [
          hitResolution.id,
          hitResolution.frame,
          hitResolution.eventPriority ?? null,
          hitResolution.eventSequence ?? null,
          hitResolution.intraEventSequence ?? null,
          hitResolution.hitId,
          hitResolution.targetId,
          hitResolution.outcome,
          hitResolution.reason,
          hitResolution.damageAllowed,
          hitResolution.auraAllowed,
          hitResolution.hitConfirmAllowed,
          hitResolution.damageEventId,
          hitResolution.potentialDamage,
          hitResolution.finalDamage,
          hitResolution.displayDamage
        ],
        targetHitlag: [
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
          entry.blockedReason,
          entry.extendedReactionStatusLogIds
        ],
        phase: projectTargetPhase(phase),
        targetClockAudit:
          targetClockAuditById.get(entry.targetId) ?? null,
        targetClockTransitionIds: result.targetClockLog
          .filter(
            (transition) =>
              transition.targetHitlagLogId === entry.id
          )
          .map((transition) => transition.id),
        damageEventIds: result.damageEvents
          .filter(
            (damageEvent) =>
              damageEvent.targetResolutionId ===
              hitResolution.id
          )
          .map((damageEvent) => damageEvent.id)
      };
    });

  return {
    ...historicalProjection,
    identity: {
      ...historicalProjection.identity,
      reactionDeliveryModel:
        result.config.reactionDeliveryModel
    },
    targetClock: {
      ...historicalProjection.targetClock,
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
    targetMissAudits
  };
}

type TargetReactablePhaseGoldenScenarioV138 = ReturnType<
  typeof projectTargetReactablePhaseScenario
>;
type TargetReactablePhaseGoldenScenarioV139 = ReturnType<
  typeof projectTargetReactablePhaseScenarioV139
>;

interface TargetReactablePhaseGoldenFixtureV138 {
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
    TargetReactablePhaseGoldenScenarioV138
  >;
  hashes: Record<
    TargetReactablePhaseGoldenScenarioId,
    string
  >;
}

interface TargetReactablePhaseGoldenFixtureV139 {
  fixtureVersion: "target-reactable-phase-1.39";
  provenance: TargetReactablePhaseGoldenFixtureV138["provenance"];
  projectionFormat: Record<string, string[]>;
  commonConfig: {
    schemaVersion: string;
    engineVersion: string;
    targetTaskModel: { mode: "target-phase-v2" };
    reactionEngine: { mode: "aura-v7" };
    reactionDeliveryModel: {
      mode: "deferred-event-heap-v1";
    };
    timeline: { mode: "legal-frame-v1"; fps: 60 };
  };
  scenarios: Record<
    TargetReactablePhaseGoldenScenarioId,
    TargetReactablePhaseGoldenScenarioV139
  >;
  hashes: Record<
    TargetReactablePhaseGoldenScenarioId,
    string
  >;
}

const targetReactablePhaseGoldenV138 =
  targetReactablePhaseGoldenJson as unknown as TargetReactablePhaseGoldenFixtureV138;
const targetReactablePhaseGoldenV139 =
  targetReactablePhaseV139GoldenJson as unknown as TargetReactablePhaseGoldenFixtureV139;

const goldenScenarioIds: TargetReactablePhaseGoldenScenarioId[] =
  [
    "frozenF176",
    "quickenF600",
    "burningFuelF61",
    "electroChargedF570",
    "frozenHitlag5F181"
  ];

function normalizeTargetReactableIdentity(
  scenario: TargetReactablePhaseGoldenScenarioV139
) {
  const {
    schemaVersion: _schemaVersion,
    engineVersion: _engineVersion,
    configHash: _configHash,
    reproducibilityKey: _reproducibilityKey,
    ...identity
  } = scenario.identity;
  return {
    ...scenario,
    identity
  };
}

function expectHistoricalGoldenScenario(
  scenarioId: TargetReactablePhaseGoldenScenarioId,
  result: SimulationResult,
  boundaryFrame: number,
  abandonedWakeFrame: number | null = null
): void {
  const historicalScenario =
    projectTargetReactablePhaseScenario(
      result,
      boundaryFrame,
      abandonedWakeFrame
    );
  const scenario = projectTargetReactablePhaseScenarioV139(
    result,
    boundaryFrame,
    abandonedWakeFrame
  );

  if (
    process.env.UPDATE_TARGET_REACTABLE_PHASE_GOLDEN ===
      "1" ||
    process.env.UPDATE_TARGET_REACTABLE_PHASE_V139_GOLDEN ===
      "1"
  ) {
    throw new Error(
      "target-reactable-phase-1.38.golden.json and target-reactable-phase-1.39.golden.json are frozen; validate authentic historical input separately from current execution instead of overwriting history."
    );
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

  expect(targetReactablePhaseGoldenV139).toMatchObject({
    fixtureVersion: "target-reactable-phase-1.39",
    provenance: {
      mechanicsDataStatus: "fixed-gcsim-provisional",
      referenceProject: "genshinsim/gcsim",
      officialServerTruth: false,
      completeGcsimParity: false
    },
    commonConfig: {
      schemaVersion:
        SHATTER_RECURSIVE_DELIVERY_SCHEMA_VERSION,
      engineVersion:
        SHATTER_RECURSIVE_DELIVERY_ENGINE_VERSION,
      targetTaskModel: { mode: "target-phase-v2" },
      reactionEngine: { mode: "aura-v7" },
      reactionDeliveryModel: {
        mode: "deferred-event-heap-v1"
      },
      timeline: { mode: "legal-frame-v1", fps: 60 }
    }
  });
  expect(
    targetReactablePhaseGoldenV139.provenance.limitations
  ).toContain(
    "Synchronous cross-target Burning application remains unimplemented; queued reactionDamage resolves later in the global/core phase."
  );
  expect(
    Object.keys(
      targetReactablePhaseGoldenV139.scenarios
    ).sort()
  ).toEqual([...goldenScenarioIds].sort());
  expect(
    Object.keys(targetReactablePhaseGoldenV139.hashes).sort()
  ).toEqual([...goldenScenarioIds].sort());
  expect(result.schemaVersion).toBe("1.53.0");
  expect(result.engineVersion).toBe("1.53.0-callback-bus");
  expect(
    normalizeTargetReactableIdentity(scenario)
  ).toStrictEqual(
    normalizeTargetReactableIdentity(
      targetReactablePhaseGoldenV139.scenarios[scenarioId]
    )
  );
  expect(
    sha256(
      targetReactablePhaseGoldenV139.scenarios[scenarioId]
    )
  ).toBe(targetReactablePhaseGoldenV139.hashes[scenarioId]);

  expect(targetReactablePhaseGoldenV138).toMatchObject({
    fixtureVersion: "target-reactable-phase-1.38",
    commonConfig: {
      schemaVersion: TARGET_REACTABLE_PHASE_SCHEMA_VERSION,
      engineVersion: TARGET_REACTABLE_PHASE_ENGINE_VERSION,
      targetTaskModel: { mode: "target-phase-v2" },
      reactionEngine: { mode: "aura-v7" },
      timeline: { mode: "legal-frame-v1", fps: 60 }
    }
  });
  const {
    identity: _currentIdentity,
    ...historicalSemantics
  } = historicalScenario;
  const {
    identity: _frozenIdentity,
    ...frozenHistoricalSemantics
  } = targetReactablePhaseGoldenV138.scenarios[scenarioId];
  expect(historicalSemantics).toStrictEqual(
    frozenHistoricalSemantics
  );
  expect(
    sha256(
      targetReactablePhaseGoldenV138.scenarios[scenarioId]
    )
  ).toBe(targetReactablePhaseGoldenV138.hashes[scenarioId]);
}


const historicalTargetPhaseBytes = readFileSync(new URL(
  "../../../test-vectors/src/fixtures/historical-target-reactable-phase-v153-84ff5cd.json", import.meta.url,
));
const historicalTargetPhaseArchive = JSON.parse(historicalTargetPhaseBytes.toString("utf8")) as {
  fixtureVersion: string; source: { commit: string };
  cases: Array<{
    caseId: TargetReactablePhaseGoldenScenarioId; boundaryFrame: number; abandonedWakeFrame: number | null;
    sourceWireSha256: string; sourceWireText: string;
  }>;
};
const byteSha256 = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function historicalTargetPhase(scenarioId: TargetReactablePhaseGoldenScenarioId): SimulationResult {
  const row = historicalTargetPhaseArchive.cases.find((entry) => entry.caseId === scenarioId);
  if (!row) throw new Error(`Missing authentic historical target-phase input ${scenarioId}`);
  expect(byteSha256(row.sourceWireText)).toBe(row.sourceWireSha256);
  const result = JSON.parse(row.sourceWireText) as SimulationResult;
  expect(result.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(result.runManifest.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(simulationResultSchema.parse(result)).toEqual(result);
  expect(assertTrustedSimulationResult(result)).toBe(result);
  return result;
}

// An expected-mechanics oracle, not a wire converter. Keep every result field
// except the three run-identity containers checked separately below. In
// particular no target IDs, references, state rows, queue edges or order are
// removed. The current output is never rewritten or relabelled as historical.
function targetPhaseMechanics(result: SimulationResult) {
  const { runManifest: _manifest, resolvedRuntimeOptions: _options, reproducibilityKey: _key, ...mechanics } = result;
  return mechanics;
}

// Exact queue correspondence for these five synthetic scenarios. The current
// disabled-clock runtime retains true future tasks: later Burning Fuel expiry
// plus its two targetDecay wakes, then (Fuel case) F75 tick/wake or (EC case)
// F610 periodic tick. These occupy queue positions without executing in-window.
// H=5 uses the target-local queue, so its positions are deliberately unchanged.
// These closed, injective, order-preserving maps are not a generic offset rule.
const CURRENT_TARGET_PHASE_ORDER: Record<TargetReactablePhaseGoldenScenarioId, {
  queuePairs: readonly (readonly [number, number])[]; applicationPointIds: readonly number[];
}> = {
  frozenF176: {
    queuePairs: [
      [1, 1], [2, 2], [3, 3], [4, 4], [7, 7], [11, 14],
      [14, 17], [15, 18], [18, 21], [19, 22], [22, 25], [23, 26],
      [26, 29], [27, 30], [30, 33], [31, 34], [34, 37], [35, 38],
      [38, 41], [39, 42], [42, 45], [43, 46],
    ],
    applicationPointIds: [2, 3],
  },
  quickenF600: {
    queuePairs: [
      [1, 1], [2, 2], [3, 3], [4, 4], [7, 7], [11, 14],
      [14, 17], [15, 18], [18, 21], [19, 22], [22, 25], [23, 26],
      [26, 29], [27, 30], [30, 33], [31, 34], [34, 37], [35, 38],
      [38, 41], [39, 42], [42, 45], [43, 46],
    ],
    applicationPointIds: [2, 3],
  },
  burningFuelF61: {
    queuePairs: [
      [1, 1], [2, 2], [3, 3], [4, 4], [7, 7], [9, 9],
      [11, 11], [12, 12], [15, 15], [16, 16], [19, 19], [20, 20],
      [25, 28], [27, 30], [29, 34],
    ],
    applicationPointIds: [2, 12],
  },
  electroChargedF570: {
    queuePairs: [
      [1, 1], [2, 2], [3, 3], [4, 4], [7, 7], [9, 9],
      [12, 12], [13, 13], [14, 14], [19, 19], [20, 20], [21, 21],
      [26, 26], [27, 27], [28, 28], [33, 33], [34, 34], [35, 35],
      [40, 40], [41, 41], [42, 42], [47, 47], [48, 48], [49, 49],
      [54, 54], [55, 55], [56, 56], [61, 61], [62, 62], [63, 63],
      [66, 69], [71, 74], [72, 75], [75, 78], [76, 79], [79, 82],
      [80, 83], [85, 88], [86, 89], [87, 90], [88, 91], [89, 92],
      [94, 97], [95, 98], [98, 101], [99, 102], [102, 105], [103, 106],
      [108, 111], [109, 113], [110, 114], [111, 115],
    ],
    applicationPointIds: [2, 26],
  },
  frozenHitlag5F181: {
    queuePairs: [
      [1, 1], [2, 2], [3, 3], [4, 4], [7, 7], [11, 11],
      [14, 14], [15, 15], [18, 18], [19, 19], [22, 22], [23, 23],
      [26, 26], [27, 27], [30, 30], [31, 31], [34, 34], [35, 35],
      [38, 38], [39, 39], [42, 42], [43, 43],
    ],
    applicationPointIds: [2, 3],
  },
};

function expectCurrentTargetPhaseContract(
  scenarioId: TargetReactablePhaseGoldenScenarioId,
  result: SimulationResult,
  boundaryFrame: number,
  abandonedWakeFrame: number | null = null
): void {
  const before = JSON.stringify(result);
  const archivedCase = historicalTargetPhaseArchive.cases.find((row) => row.caseId === scenarioId)!;
  expect([boundaryFrame, abandonedWakeFrame]).toEqual([archivedCase.boundaryFrame, archivedCase.abandonedWakeFrame]);
  expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  expect(result.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  expect(result.resolvedRuntimeOptions.flatStatBuffSemantics).toBe("canonical-v1");
  expect(result.runManifest.resolvedRuntimeOptions).toEqual(result.resolvedRuntimeOptions);
  expect(simulationResultSchema.parse(JSON.parse(before))).toEqual(result);
  expect(assertTrustedSimulationResult(result)).toBe(result);
  const historical = historicalTargetPhase(scenarioId);
  expect(result.reproducibilityKey).not.toBe(historical.reproducibilityKey);
  expect(result.runManifest.reproducibilityKey).toBe(result.reproducibilityKey);
  const { reproducibilityKey: _oldKey, resolvedRuntimeOptions: _oldOptions, ...oldManifest } = historical.runManifest;
  const { reproducibilityKey: _currentKey, resolvedRuntimeOptions: _currentOptions, ...currentManifest } = result.runManifest;
  expect(currentManifest).toEqual(oldManifest);
  expect(result.resolvedRuntimeOptions).toEqual({ ...historical.resolvedRuntimeOptions, flatStatBuffSemantics: "canonical-v1" });

  const order = CURRENT_TARGET_PHASE_ORDER[scenarioId];
  const sequenceMap = new Map(order.queuePairs);
  expect(sequenceMap.size).toBe(order.queuePairs.length);
  expect(new Set(sequenceMap.values()).size).toBe(sequenceMap.size);
  expect([...sequenceMap.keys()]).toEqual([...sequenceMap.keys()].sort((a, b) => a - b));
  expect([...sequenceMap.values()]).toEqual([...sequenceMap.values()].sort((a, b) => a - b));
  const currentSequence = (old: number): number => {
    const next = sequenceMap.get(old);
    if (next === undefined) throw new Error(`Unreviewed target-phase queue position ${old}`);
    return next;
  };
  const mapSequence = <T extends object>(row: T): T => {
    if (!("eventSequence" in row) || row.eventSequence == null) return row;
    if (typeof row.eventSequence !== "number") throw new Error("Expected a numeric queue position");
    return { ...row, eventSequence: currentSequence(row.eventSequence) };
  };
  const expected = structuredClone(targetPhaseMechanics(historical));
  expected.damageEvents = expected.damageEvents.map(mapSequence);
  expected.hitEvents = expected.hitEvents.map(mapSequence);
  expected.elementalApplicationIcdLog = expected.elementalApplicationIcdLog.map(mapSequence);
  expected.hitResolutionLog = expected.hitResolutionLog.map(mapSequence);
  expected.burningStateLog = expected.burningStateLog.map(mapSequence);
  expected.auraTimeline = expected.auraTimeline.map(mapSequence);
  expected.targetPhaseLog = expected.targetPhaseLog.map((phase) => {
    if (phase.model !== "target-phase-v2") throw new Error("Expected the exact V2 phase contract");
    return { ...phase, targetTasks: phase.targetTasks.map(mapSequence) };
  });
  expected.reactionDamageLog = expected.reactionDamageLog.map((delivery) => ({
    ...delivery, damageGroupDecisions: delivery.damageGroupDecisions.map((decision) => ({
      ...decision, damageGroupTaskSequence: currentSequence(decision.damageGroupTaskSequence),
    })),
  }));
  expected.targetStateTimeline.points = expected.targetStateTimeline.points.map(mapSequence);
  expect(expected.targetStateTimeline.points.filter((point) => point.cause === "direct-hit-application").map((point) => point.id)).toEqual(order.applicationPointIds);
  for (const [index, id] of order.applicationPointIds.entries()) {
    const point = expected.targetStateTimeline.points[id]!;
    expect(point).toMatchObject({ id, cause: "direct-hit-application", eventType: "hit", eventPriority: 3,
      eventSequence: index === 0 ? 1 : 4, intraEventSequence: 0, targetId: `enemy-${index}` });
    // The current direct hit-resolution allocation owns substep 0; the same
    // event's Aura application owns 1. Its original damage/backlinks stay exact.
    point.intraEventSequence = 1;
  }
  if (scenarioId === "frozenHitlag5F181") {
    expect(expected.targetHitlagLog.map((row) => [row.id, row.hitResolutionLogId, row.eventSequence, row.intraEventSequence])).toEqual([[0, 0, 1, 1], [1, 1, 2, 0]]);
    expected.targetHitlagLog[0]!.intraEventSequence = 2;
    expected.targetHitlagLog[1]!.intraEventSequence = 1;
  } else {
    expect(expected.targetHitlagLog).toEqual([]);
  }
  expect(targetPhaseMechanics(result)).toStrictEqual(expected);

  // Independent arithmetic and schedule oracles, not totals copied from the
  // historical archive or calls to the implementation's formula helpers.
  const burningDamage = 1446.8535 * 0.25 * (1 + 16 * 100 / (2000 + 100)) * 0.9;
  const tickFrames = {
    frozenF176: [56, 71, 86, 101, 116, 131, 146, 161],
    quickenF600: [480, 495, 510, 525, 540, 555, 570, 585],
    burningFuelF61: [15, 30, 45, 60, 61],
    electroChargedF570: [450, 465, 480, 495, 510, 525, 540, 555],
    frozenHitlag5F181: [61, 76, 91, 106, 121, 136, 151, 166],
  }[scenarioId];
  const ticks = result.damageEvents.filter((event) => event.kind === "transformative-reaction" && event.reaction === "burning");
  expect(ticks.map((event) => event.frame)).toEqual(tickFrames);
  ticks.forEach((event, index) => {
    expect(event.sourceActorId).toBe("phase-driver");
    expect(event.targetId).toBe(scenarioId === "burningFuelF61" && index < 4 ? "enemy-0" : "enemy-1");
    expect(event.finalDamage).toBeCloseTo(burningDamage, 10);
    expect(event.displayDamage).toBe(Math.round(burningDamage));
  });
  expect(result.damageEvents.filter((event) => !ticks.includes(event)).every((event) => event.finalDamage === 0)).toBe(true);
  const total = burningDamage * tickFrames.length;
  expect(result.totalDamage).toBeCloseTo(total, 10);
  expect(result.dps).toBeCloseTo(total / result.config.duration, 10);
  expect(result.byCharacter["phase-driver"]).toBeCloseTo(total, 10);
  const immuneTicks = result.hitResolutionLog.filter((row) => row.reactionDamageLogId !== null && row.targetId === "enemy-0" && row.element === "electro");
  expect(immuneTicks).toHaveLength(scenarioId === "electroChargedF570" ? 10 : 0);
  for (const row of immuneTicks) {
    expect(row.potentialDamage).toBeCloseTo(1446.8535 * 2 * (1 + 16 * 100 / (2000 + 100)) * 0.9, 10);
    expect([row.damageAllowed, row.finalDamage]).toEqual([false, 0]);
  }
  expect(JSON.stringify(result)).toBe(before);
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
    reactionDamageGroupModel: {
      mode: "legacy-reaction-damage-group-window-v1",
      policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID
    },
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
                icd: { mode: "no-icd-v1" }
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
                icd: { mode: "no-icd-v1" }
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
  const phase = matches[0];
  if (phase === undefined || phase.model !== "target-phase-v2") {
    throw new Error(
      `Expected one target-phase-v2 entry for ${targetId} at frame ${globalFrame}.`
    );
  }
  return phase;
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

const hostileTargetPhaseCases: Array<{
  name: string; scenario: LifecycleScenario; hitlagFrames?: number; trustedNegative?: true; mutate: (result: SimulationResult) => void;
}> = [
  { name: "dangling Frozen state log", scenario: "frozen", mutate: (result) => {
    const transition = phaseAt(result, 176, "enemy-0").reactableTick.transitions[0]!;
    if (transition.kind !== "frozen-expiry") throw new Error("Expected Frozen expiry");
    transition.frozenStateLogId = 999;
  } },
  { name: "cross-target lifecycle point", scenario: "frozen", mutate: (result) => {
    phaseAt(result, 176, "enemy-0").reactableTick.transitions[0]!.targetStateTimelinePointId = 29;
  } },
  { name: "dangling callback timeline point", scenario: "frozen", mutate: (result) => {
    phaseAt(result, 176, "enemy-1").targetTasks[0]!.targetStateTimelinePointId = 999;
  } },
  { name: "callback queue split from its Burning state log", scenario: "frozen", mutate: (result) => {
    phaseAt(result, 176, "enemy-1").targetTasks[0]!.eventSequence += 1;
  } },
  { name: "dangling callback Burning state log", scenario: "frozen", mutate: (result) => {
    phaseAt(result, 176, "enemy-1").targetTasks[0]!.burningStateLogId = 999;
  } },
  { name: "wrong target order", scenario: "frozen", mutate: (result) => {
    phaseAt(result, 176, "enemy-0").targetOrder = 1;
  } },
  { name: "swapped lifecycle and later-target callback rows", trustedNegative: true, scenario: "frozen", mutate: (result) => {
    [result.targetPhaseLog[20], result.targetPhaseLog[21]] = [result.targetPhaseLog[21]!, result.targetPhaseLog[20]!];
  } },
  { name: "wrong lifecycle target deadline", scenario: "frozen", mutate: (result) => {
    phaseAt(result, 176, "enemy-0").reactableTick.transitions[0]!.deadlineTargetFrame = 175;
  } },
  { name: "dangling owned hit-resolution reference", scenario: "frozen", mutate: (result) => {
    phaseAt(result, 176, "enemy-0").hitResolutionLogIds.push(999);
  } },
  { name: "missing lifecycle timeline backlink", trustedNegative: true, scenario: "frozen", mutate: (result) => {
    result.targetStateTimeline.points[28]!.links = [];
  } },
  { name: "Miss Hitlag audit aliases the landed target resolution", scenario: "frozen", hitlagFrames: 5, mutate: (result) => {
    result.targetHitlagLog[1]!.hitResolutionLogId = 0;
  } },
  { name: "EC expiry loses its periodic stream reference", trustedNegative: true, scenario: "electro-charged", mutate: (result) => {
    const transition = phaseAt(result, 570, "enemy-0").reactableTick.transitions[1]!;
    if (transition.kind !== "electro-charged-expiry") throw new Error("Expected EC expiry");
    transition.periodicReactionLogId = 999;
  } },
];

describe("current target-phase causal boundaries", () => {
  it.each(hostileTargetPhaseCases)("rejects $name at public parsing and real capture import", ({ scenario, hitlagFrames, trustedNegative, mutate }) => {
    const result = simulate(makeLifecycleScenarioConfig(scenario, "target-phase-v2", { frozenHitlagFrames: hitlagFrames ?? 0 }), { critMode: "noCrit" });
    const before = JSON.stringify(result);
    expect(simulationResultSchema.parse(result)).toEqual(result);
    expect(assertTrustedSimulationResult(result)).toBe(result);
    const capture = { schemaVersion: "calculator-event-v1", eventId: 0, sourceResult: result };
    expect(parseSimulationHit(JSON.stringify(capture)).sourceResult).toEqual(result);
    const forged = structuredClone(result);
    mutate(forged);
    expect(JSON.stringify(forged)).not.toBe(before);
    const parsed = simulationResultSchema.safeParse(forged);
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Forged target-phase result unexpectedly parsed");
    expect(() => parseSimulationHit(JSON.stringify({ ...capture, sourceResult: forged }))).toThrow(parsed.error.message);
    // The trusted API accepts already-constructed/facet-validated results, not
    // arbitrary JSON (result-integrity.ts). It conditionally owns V2 EC
    // transitions, plus core ID/timeline proofs; ordinary V2/clock facets belong
    // to public parsing. Do not invent a standalone full-wire guarantee.
    if (trustedNegative) expect(() => assertTrustedSimulationResult(forged)).toThrow();
    expect(JSON.stringify(result)).toBe(before);
  });
});

describe("authentic historical target-phase Goldens", () => {
  it("pins both frozen byte streams and the genuine pre-marker input provenance", () => {
    expect(byteSha256(historicalTargetPhaseBytes)).toBe("76eb996fdf32bfaa8a93a682fd581048f540b47f5938f4b46c744d4fe640abca");
    expect(historicalTargetPhaseArchive).toMatchObject({
      fixtureVersion: "historical-target-reactable-phase-v153-84ff5cd-v1",
      source: { commit: "84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5" },
    });
    expect(historicalTargetPhaseArchive.cases.map((row) => row.caseId)).toEqual(goldenScenarioIds);
    expect(byteSha256(readFileSync(new URL("../../../test-vectors/fixtures/target-reactable-phase-1.38.golden.json", import.meta.url)))).toBe("f6bd14ae2a86596cc7d50b2d63b4b75c9c00aeb14cb75f0ada10e3ae4b3f5db0");
    expect(byteSha256(readFileSync(new URL("../../../test-vectors/fixtures/target-reactable-phase-1.39.golden.json", import.meta.url)))).toBe("40f4c76f3469453b08436b2fbd1cddab1af8b9975ce8f1133b3315b03253d5f8");
  });
  it.each(goldenScenarioIds)("keeps both original frozen semantic comparisons for %s", (scenarioId) => {
    const row = historicalTargetPhaseArchive.cases.find((entry) => entry.caseId === scenarioId)!;
    expectHistoricalGoldenScenario(scenarioId, historicalTargetPhase(scenarioId), row.boundaryFrame, row.abandonedWakeFrame);
  });
  it.each(["UPDATE_TARGET_REACTABLE_PHASE_GOLDEN", "UPDATE_TARGET_REACTABLE_PHASE_V139_GOLDEN"])("refuses frozen replacement through %s", (name) => {
    const previous = process.env[name];
    process.env[name] = "1";
    try {
      expect(() => expectHistoricalGoldenScenario("frozenF176", historicalTargetPhase("frozenF176"), 176)).toThrow(/are frozen/);
    } finally {
      if (previous === undefined) delete process.env[name]; else process.env[name] = previous;
    }
  });
});

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
    expectCurrentTargetPhaseContract(
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
    expectCurrentTargetPhaseContract(
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
    expectCurrentTargetPhaseContract(
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
    expectCurrentTargetPhaseContract(
      "electroChargedF570",
      result,
      570
    );
  });

  it("rejects orphan EC expiry and cleanup transitions at both result boundaries", () => {
    const result = simulate(
      makeLifecycleScenarioConfig("quicken"),
      { critMode: "noCrit" }
    );
    expect(result.periodicReactionLog).toHaveLength(0);
    expect(simulationResultSchema.parse(result)).toEqual(result);
    expect(assertTrustedSimulationResult(result)).toBe(result);

    for (const transition of [
      {
        stage: "reactable-tick",
        kind: "electro-charged-expiry",
        order: 0,
        generation: 1,
        deadlineTargetFrame: 0,
        periodicReactionLogId: 999,
        targetStateTimelinePointId: 999
      },
      {
        stage: "reactable-tick",
        kind: "electro-charged-cleanup",
        order: 0,
        generation: 1,
        deadlineTargetFrame: 0,
        reactionTaskLogId: 999,
        targetStateTimelinePointId: 999,
        outcome: "retain",
        periodicReactionLogId: null
      }
    ] as const) {
      const forged = structuredClone(result);
      const phase = forged.targetPhaseLog[0];
      if (phase === undefined) {
        throw new Error(
          "target-phase-v2 fixture must produce one target phase"
        );
      }
      phase.reactableTick.transitions.push({
        ...transition,
        order: phase.reactableTick.transitions.length,
        deadlineTargetFrame: phase.reactableTick.toTargetFrame
      });

      expect(
        simulationResultSchema.safeParse(forged).success
      ).toBe(false);
      expect(() =>
        assertTrustedSimulationResult(forged)
      ).toThrow(/target phase v2 references/);
    }
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
      },
      {
        globalFrame: 0,
        targetFrame: 0,
        targetId: "enemy-1",
        hitResolutionLogId: 1,
        haltFrames: 5,
        factor: 0,
        extensionFrames: 5,
        frozenFramesBefore: 0,
        frozenFramesAfter: 0,
        pausedGlobalFrameStart: null,
        nextTargetAdvanceGlobalFrame: null,
        applied: false,
        blockedReason: "TARGET_MISS",
        extendedReactionStatusLogIds: []
      }
    ]);
    expect(result.targetHitlagLog).toHaveLength(2);
    expect(
      result.targetClockLog
        .filter((entry) => entry.operation === "apply-hitlag")
        .map((entry) => ({
          targetId: entry.targetId,
          targetHitlagLogId: entry.targetHitlagLogId
        }))
    ).toEqual([
      {
        targetId: "enemy-0",
        targetHitlagLogId: 0
      }
    ]);
    if (
      result.targetClockAudit.mode !==
      "target-local-hitlag-v1"
    ) {
      throw new Error("Expected a target-local Hitlag audit.");
    }
    expect(
      result.targetClockAudit.targets.find(
        (target) => target.targetId === "enemy-1"
      )
    ).toMatchObject({
      finalGlobalFrame: 187,
      finalTargetFrame: 187,
      frozenFramesConsumed: 0,
      frozenFramesRemaining: 0,
      hitlagApplications: 0,
      totalExtensionFrames: 0
    });
    const missedTargetPhase = result.targetPhaseLog.find(
      (entry) =>
        entry.globalFrame === 0 &&
        entry.targetId === "enemy-1"
    );
    expect(missedTargetPhase).toMatchObject({
      hitResolutionLogIds: [1],
      targetTasks: [],
      reactableTick: {
        transitions: []
      }
    });
    expect(
      auraStateSnapshotsEqual(
        missedTargetPhase?.auraBeforeTargetTasks ?? [],
        missedTargetPhase?.auraAfterTargetTasks ?? []
      )
    ).toBe(true);
    expect(
      auraStateSnapshotsEqual(
        missedTargetPhase?.auraAfterTargetTasks ?? [],
        missedTargetPhase?.reactableTick.auraAfter ?? []
      )
    ).toBe(true);
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
    expectCurrentTargetPhaseContract(
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
