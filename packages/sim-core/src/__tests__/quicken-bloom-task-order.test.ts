import { createHash } from "node:crypto";
import {
  canonicalStringify,
  QUICKEN_BLOOM_TASK_ENGINE_VERSION,
  QUICKEN_BLOOM_TASK_SCHEMA_VERSION,
  type AuraReactionEngineConfig,
  type FrameHitDefinition,
  type SimConfig,
  type SimulationResult
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import taskOrderGoldenJson from "../../../test-vectors/fixtures/quicken-bloom-task-order-1.36.golden.json";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

type ReactionMode = Extract<
  AuraReactionEngineConfig["mode"],
  "aura-v6" | "aura-v7"
>;

const SAME_TARGET_GEOMETRY = {
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
    geometry: SAME_TARGET_GEOMETRY,
    application: {
      gaugeUnits,
      icdTag: id,
      icdGroup: "no-icd"
    }
  };
}

function makeTaskOrderConfig(
  mode: ReactionMode,
  interveningHit?: FrameHitDefinition
): SimConfig {
  const base = makeConfig();
  const hits = [
    applicationHit("dendro-quicken", "dendro", 0.8),
    ...(interveningHit === undefined
      ? []
      : [interveningHit]),
    applicationHit("electro-followup", "electro", 0.8)
  ];

  return {
    ...base,
    dataVersion: "quicken-bloom-task-order-provisional-1",
    randomSeed: `quicken-bloom-task-order-${mode}-${
      interveningHit?.id ?? "fifo"
    }`,
    meta: {
      name: "Quicken Bloom queued follow-up ordering",
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
          name: "Hydro + Electro target",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            { element: "hydro", gaugeUnits: 1 },
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
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "driver",
      swapFrames: 1,
      abilities: [
        {
          id: "same-frame-chain",
          actorId: "driver",
          name: "Same-frame chain",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "driver",
          abilityId: "same-frame-chain",
          atFrame: 0
        }
      ]
    }
  };
}

function directHit(
  result: ReturnType<typeof simulate>,
  hitId: string
) {
  const event = result.damageEvents.find(
    (candidate) =>
      candidate.kind === "direct" &&
      candidate.hitId === hitId
  );
  expect(event, `missing direct event for ${hitId}`).toBeDefined();
  return event!;
}

function projectAura(
  aura: readonly {
    element: string;
    gaugeUnits: number;
    expiresAtFrame: number | null;
  }[]
) {
  return aura.map(
    ({ element, gaugeUnits, expiresAtFrame }) =>
      `${element}:${gaugeUnits}@${expiresAtFrame ?? "none"}`
  );
}

function projectTaskOrderResult(result: SimulationResult) {
  return {
    version: {
      schemaVersion: result.config.schemaVersion,
      engineVersion: result.config.engineVersion,
      dataVersion: result.config.dataVersion,
      randomSeed: result.config.randomSeed,
      reactionEngineMode:
        result.config.reactionEngine?.mode ?? null,
      timelineMode: result.config.timeline?.mode ?? null
    },
    directDamageEvents: result.damageEvents
      .filter((event) => event.kind === "direct")
      .map((event) => ({
        id: event.id,
        order: `P${event.eventPriority}/S${event.eventSequence}`,
        frame: event.frame,
        hitId: event.hitId,
        element: event.element,
        reaction: event.reaction,
        reactions: event.reactionAudit.reactions,
        bloomOperations:
          event.reactionAudit.bloomReactions.map(
            (entry) => entry.operation
          ),
        pendingHydroBloomFollowup:
          event.reactionAudit.catalyzeReaction?.quicken
            ?.pendingHydroBloomFollowup ?? false,
        finalDamage: event.finalDamage,
        displayDamage: event.displayDamage
      })),
    reactionTasks: result.reactionTaskLog.map((task) => ({
      id: task.id,
      kind: task.kind,
      frame: task.frame,
      triggerHitId: task.triggerHitId,
      triggerDamageEventId: task.triggerDamageEventId,
      triggerOrder: `P${task.triggerEventPriority}/S${task.triggerEventSequence}`,
      taskOrder: `P${task.eventPriority}/S${task.eventSequence}/I${task.intraEventSequence}`,
      status: task.status,
      blockedReason: task.blockedReason,
      auraBefore: projectAura(task.auraBefore),
      auraConsumed: task.auraConsumed.map(
        ({ element, gaugeUnits }) =>
          `${element}:${gaugeUnits}`
      ),
      auraAfter: projectAura(task.auraAfter),
      bloomReaction:
        task.bloomReaction === null
          ? null
          : {
              operation: task.bloomReaction.operation,
              triggerElement:
                task.bloomReaction.triggerElement,
              sourceBudget:
                task.bloomReaction.sourceBudget,
              hydro: {
                before:
                  task.bloomReaction
                    .hydroGaugeUnitsBefore,
                consumed:
                  task.bloomReaction
                    .hydroConsumedGaugeUnits,
                after:
                  task.bloomReaction
                    .hydroGaugeUnitsAfter
              },
              quicken: {
                before:
                  task.bloomReaction
                    .quickenGaugeUnitsBefore,
                consumed:
                  task.bloomReaction
                    .quickenConsumedGaugeUnits,
                after:
                  task.bloomReaction
                    .quickenGaugeUnitsAfter
              },
              quickenMutation: {
                operation:
                  task.bloomReaction.quickenStateMutation
                    .operation,
                generationBefore:
                  task.bloomReaction.quickenStateMutation
                    .generationBefore,
                generationAfter:
                  task.bloomReaction.quickenStateMutation
                    .generationAfter,
                expiresAtFrameBefore:
                  task.bloomReaction.quickenStateMutation
                    .expiresAtFrameBefore,
                expiresAtFrameAfter:
                  task.bloomReaction.quickenStateMutation
                    .expiresAtFrameAfter
              },
              coreSpawnFrame:
                task.bloomReaction.coreSpawnFrame
            },
      quickenStateLogIds: task.quickenStateLogIds,
      dendroCoreLogIds: task.dendroCoreLogIds,
      dendroCoreIds: task.dendroCoreIds
    })),
    quickenStateOrder: result.quickenStateLog.map(
      (entry) =>
        `#${entry.id}:F${entry.frame}:${entry.operation}:G${entry.generation}:${entry.quickenGaugeUnitsBefore}>${entry.quickenGaugeUnitsAfter}:X${entry.expiresAtFrame ?? "none"}:D${entry.triggerDamageEventId ?? "none"}:${entry.reason}`
    ),
    dendroCoreOrder: result.dendroCoreLog.map(
      (entry) =>
        `#${entry.id}/C${entry.coreId}:F${entry.frame}:P${entry.eventPriority}/S${entry.eventSequence}/I${entry.intraEventSequence}:${entry.eventType}:${entry.operation}:D${entry.originDamageEventId}${
          entry.operation === "spawn-scheduled"
            ? `:T${entry.reactionTaskLogId ?? "none"}:spawnF${entry.spawnFrame}`
            : entry.operation === "spawn"
              ? `:spawnedF${entry.spawnedAtFrame}:expireF${entry.expiresAtFrame}`
              : ""
        }`
    ),
    targetTimelineOrder: result.targetStateTimeline.points.map(
      (point) =>
        `#${point.id}:F${point.frame}:${point.pointKind}:${point.cause}:${point.eventType ?? "none"}:P${point.eventPriority ?? "none"}/S${point.eventSequence ?? "none"}/I${point.intraEventSequence ?? "none"}:${point.reactions.join("+") || "none"}:D${point.primaryDamageEventId ?? "none"}:${
          point.links
            .map((link) => `${link.kind}#${link.id}`)
            .join("+") || "no-links"
        }`
    ),
    totalDamage: result.totalDamage,
    reactedHits: result.reactedHits
  };
}

type TaskOrderProjection = ReturnType<
  typeof projectTaskOrderResult
>;
type TaskOrderScenarioId =
  | "fifo"
  | "missingQuicken"
  | "missingHydro"
  | "auraV6Compatibility";

interface TaskOrderGoldenFixture {
  fixtureVersion: string;
  config: {
    schemaVersion: string;
    engineVersion: string;
    dataVersion: string;
    timelineMode: string;
    queuedReactionEngineMode: string;
    compatibilityReactionEngineMode: string;
  };
  vectors: Record<
    TaskOrderScenarioId,
    TaskOrderProjection
  >;
  hashes: Record<TaskOrderScenarioId, string>;
}

const taskOrderGolden =
  taskOrderGoldenJson as unknown as TaskOrderGoldenFixture;

function semanticHash(value: unknown): string {
  return createHash("sha256")
    .update(canonicalStringify(value))
    .digest("hex");
}

function projectAllTaskOrderVectors(): Record<
  TaskOrderScenarioId,
  TaskOrderProjection
> {
  return {
    fifo: projectTaskOrderResult(
      simulate(makeTaskOrderConfig("aura-v7"), {
        critMode: "noCrit"
      })
    ),
    missingQuicken: projectTaskOrderResult(
      simulate(
        makeTaskOrderConfig(
          "aura-v7",
          applicationHit(
            "hydro-removes-quicken",
            "hydro",
            2
          )
        ),
        { critMode: "noCrit" }
      )
    ),
    missingHydro: projectTaskOrderResult(
      simulate(
        makeTaskOrderConfig(
          "aura-v7",
          applicationHit(
            "cryo-removes-hydro",
            "cryo",
            0.8
          )
        ),
        { critMode: "noCrit" }
      )
    ),
    auraV6Compatibility: projectTaskOrderResult(
      simulate(makeTaskOrderConfig("aura-v6"), {
        critMode: "noCrit"
      })
    )
  };
}

describe("aura-v7 queued Quicken to Bloom follow-up", () => {
  it("matches the frozen 1.36 task-order Golden projection and hashes", () => {
    const vectors = projectAllTaskOrderVectors();
    const hashes = Object.fromEntries(
      Object.entries(vectors).map(([id, vector]) => [
        id,
        semanticHash(vector)
      ])
    );

    expect(taskOrderGolden.fixtureVersion).toBe("1.0.0");
    expect(taskOrderGolden.config).toEqual({
      schemaVersion: QUICKEN_BLOOM_TASK_SCHEMA_VERSION,
      engineVersion: QUICKEN_BLOOM_TASK_ENGINE_VERSION,
      dataVersion:
        "quicken-bloom-task-order-provisional-1",
      timelineMode: "legal-frame-v1",
      queuedReactionEngineMode: "aura-v7",
      compatibilityReactionEngineMode: "aura-v6"
    });
    expect(vectors).toEqual(taskOrderGolden.vectors);
    expect(hashes).toEqual(taskOrderGolden.hashes);
  });

  it("runs after an already-enqueued same-frame Electro hit in FIFO order", () => {
    const result = simulate(
      makeTaskOrderConfig("aura-v7"),
      { critMode: "noCrit" }
    );
    const dendro = directHit(result, "dendro-quicken");
    const electro = directHit(result, "electro-followup");
    const [task] = result.reactionTaskLog;

    expect(dendro.reactionAudit.reactions).toEqual([
      "quicken"
    ]);
    expect(dendro.reactionAudit.bloomReactions).toEqual([]);
    expect(
      dendro.reactionAudit.catalyzeReaction?.quicken
        ?.pendingHydroBloomFollowup
    ).toBe(true);
    expect(electro.reactionAudit.reactions).toEqual([
      "aggravate",
      "electroCharged"
    ]);

    expect(task).toMatchObject({
      id: 0,
      kind: "quicken-bloom-followup",
      frame: 0,
      triggerHitId: "dendro-quicken",
      triggerDamageEventId: dendro.id,
      triggerEventType: "hit",
      triggerEventPriority: dendro.eventPriority,
      triggerEventSequence: dendro.eventSequence,
      eventPriority: dendro.eventPriority,
      status: "triggered",
      blockedReason: null,
      quickenStateLogIds: [1],
      dendroCoreLogIds: [0],
      dendroCoreIds: [0]
    });
    expect(dendro.eventSequence).toBeLessThan(
      electro.eventSequence
    );
    expect(electro.eventSequence).toBeLessThan(
      task!.eventSequence
    );
    expect(task!.bloomReaction).toMatchObject({
      reaction: "bloom",
      operation: "quicken-followup",
      triggerElement: "dendro",
      quickenGaugeUnitsBefore: 0.8,
      quickenConsumedGaugeUnits: 0.4,
      quickenGaugeUnitsAfter: 0.4,
      hydroGaugeUnitsBefore: 0.8,
      hydroConsumedGaugeUnits: 0.8,
      hydroGaugeUnitsAfter: 0,
      coreSpawnFrame: 30
    });
    expect(
      result.dendroCoreLog
        .filter(
          (entry) => entry.operation === "spawn-scheduled"
        )
        .map((entry) => ({
          eventType: entry.eventType,
          reactionTaskLogId: entry.reactionTaskLogId,
          spawnFrame: entry.spawnFrame
        }))
    ).toEqual([
      {
        eventType: "quickenBloomFollowup",
        reactionTaskLogId: 0,
        spawnFrame: 30
      }
    ]);
    expect(
      result.damageEvents
        .filter(
          (event) =>
            event.kind === "transformative-reaction" &&
            event.reaction === "electroCharged"
        )
        .map((event) => event.frame)
    ).toEqual([10]);
    expect(result.totalDamage).toBeCloseTo(
      3353.08298625,
      10
    );
    expect(result.reactedHits).toBe(2);
  });

  it("skips with MISSING_QUICKEN when an intervening Hydro hit removes Quicken", () => {
    const result = simulate(
      makeTaskOrderConfig(
        "aura-v7",
        applicationHit(
          "hydro-removes-quicken",
          "hydro",
          2
        )
      ),
      { critMode: "noCrit" }
    );
    const dendro = directHit(result, "dendro-quicken");
    const intervening = directHit(
      result,
      "hydro-removes-quicken"
    );
    const [task] = result.reactionTaskLog;

    expect(
      dendro.reactionAudit.catalyzeReaction?.quicken
        ?.pendingHydroBloomFollowup
    ).toBe(true);
    expect(intervening.reactionAudit.reactions).toEqual([
      "bloom"
    ]);
    expect(task).toMatchObject({
      triggerHitId: "dendro-quicken",
      status: "skipped",
      blockedReason: "MISSING_QUICKEN",
      auraConsumed: [],
      bloomReaction: null,
      quickenStateLogIds: [],
      dendroCoreLogIds: [],
      dendroCoreIds: []
    });
    expect(task!.auraAfter).toEqual(task!.auraBefore);
  });

  it("skips with MISSING_HYDRO when an intervening Cryo hit consumes Hydro", () => {
    const result = simulate(
      makeTaskOrderConfig(
        "aura-v7",
        applicationHit("cryo-removes-hydro", "cryo", 0.8)
      ),
      { critMode: "noCrit" }
    );
    const dendro = directHit(result, "dendro-quicken");
    const intervening = directHit(
      result,
      "cryo-removes-hydro"
    );
    const [task] = result.reactionTaskLog;

    expect(
      dendro.reactionAudit.catalyzeReaction?.quicken
        ?.pendingHydroBloomFollowup
    ).toBe(true);
    expect(intervening.reactionAudit.reactions).toEqual([
      "freeze"
    ]);
    expect(task).toMatchObject({
      triggerHitId: "dendro-quicken",
      status: "skipped",
      blockedReason: "MISSING_HYDRO",
      auraConsumed: [],
      bloomReaction: null,
      quickenStateLogIds: [],
      dendroCoreLogIds: [],
      dendroCoreIds: []
    });
    expect(task!.auraAfter).toEqual(task!.auraBefore);
  });

  it("keeps aura-v6 synchronous compatibility output frozen", () => {
    const result = simulate(
      makeTaskOrderConfig("aura-v6"),
      { critMode: "noCrit" }
    );
    const dendro = directHit(result, "dendro-quicken");
    const electro = directHit(result, "electro-followup");

    expect(result.reactionTaskLog).toEqual([]);
    expect(dendro.reactionAudit.reactions).toEqual([
      "quicken",
      "bloom"
    ]);
    expect(
      dendro.reactionAudit.bloomReactions.map(
        (entry) => entry.operation
      )
    ).toEqual(["quicken-followup"]);
    expect(electro.reactionAudit.reactions).toEqual([
      "aggravate"
    ]);
    expect(
      result.damageEvents.filter(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.reaction === "electroCharged"
      )
    ).toEqual([]);
    expect(result.totalDamage).toBeCloseTo(
      748.7466862499999,
      10
    );
    expect(result.reactedHits).toBe(2);
    expect(
      result.dendroCoreLog
        .filter(
          (entry) => entry.operation === "spawn-scheduled"
        )
        .map((entry) => ({
          eventType: entry.eventType,
          reactionTaskLogId: entry.reactionTaskLogId
        }))
    ).toEqual([
      {
        eventType: "hit",
        reactionTaskLogId: undefined
      }
    ]);
  });
});
