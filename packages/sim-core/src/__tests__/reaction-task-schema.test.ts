import {
  dendroCoreResultReferencesSchema,
  playerDamageResultReferencesSchema,
  targetClockResultReferencesSchema,
  type AuraReactionEngineConfig,
  type FrameHitDefinition,
  type SimConfig,
  type SimulationResult
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
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
      icd: { mode: "no-icd-v1" }
    }
  };
}

function makeTaskSchemaConfig(
  mode: ReactionMode,
  interveningHit?: FrameHitDefinition
): SimConfig {
  const base = makeConfig();
  const hits = [
    applicationHit("dendro-quicken", "dendro", 0.8),
    ...(interveningHit === undefined ? [] : [interveningHit]),
    applicationHit("electro-followup", "electro", 0.8)
  ];

  return {
    ...base,
    dataVersion: "reaction-task-schema-provisional-1",
    randomSeed: `reaction-task-schema-${mode}-${
      interveningHit?.id ?? "triggered"
    }`,
    meta: {
      name: "Reaction task schema references",
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

function simulateTriggeredTask(): SimulationResult {
  return simulate(makeTaskSchemaConfig("aura-v7"), {
    critMode: "noCrit"
  });
}

function simulateMissingQuickenTask(): SimulationResult {
  return simulate(
    makeTaskSchemaConfig(
      "aura-v7",
      applicationHit("hydro-removes-quicken", "hydro", 2)
    ),
    { critMode: "noCrit" }
  );
}

function simulateMissingHydroTask(): SimulationResult {
  return simulate(
    makeTaskSchemaConfig(
      "aura-v7",
      applicationHit("cryo-removes-hydro", "cryo", 0.8)
    ),
    { critMode: "noCrit" }
  );
}

function requireTask(result: SimulationResult) {
  const task = result.reactionTaskLog[0];
  if (task === undefined) {
    throw new Error("Expected one Quicken→Bloom reaction task.");
  }
  return task;
}

function requireTaskPoint(result: SimulationResult, taskId = 0) {
  const point = result.targetStateTimeline.points.find((candidate) =>
    candidate.links.some(
      (link) =>
        link.kind === "reaction-task-log" && link.id === taskId
    )
  );
  if (point === undefined) {
    throw new Error(`Expected target-state point for task ${taskId}.`);
  }
  return point;
}

function expectValidReferences(result: SimulationResult): void {
  expect(() =>
    dendroCoreResultReferencesSchema.parse(result)
  ).not.toThrow();
  expect(() =>
    playerDamageResultReferencesSchema.parse(result)
  ).not.toThrow();
  expect(() =>
    targetClockResultReferencesSchema.parse(result)
  ).not.toThrow();
}

function expectDendroReferencesRejected(
  result: SimulationResult
): void {
  expect(
    dendroCoreResultReferencesSchema.safeParse(result).success
  ).toBe(false);
}

describe("reaction task result reference schemas", () => {
  it("accepts triggered, MISSING_QUICKEN, and MISSING_HYDRO results", () => {
    const triggered = simulateTriggeredTask();
    const missingQuicken = simulateMissingQuickenTask();
    const missingHydro = simulateMissingHydroTask();

    expect(requireTask(triggered)).toMatchObject({
      status: "triggered",
      blockedReason: null
    });
    expect(requireTask(missingQuicken)).toMatchObject({
      status: "skipped",
      blockedReason: "MISSING_QUICKEN"
    });
    expect(requireTask(missingHydro)).toMatchObject({
      status: "skipped",
      blockedReason: "MISSING_HYDRO"
    });

    expectValidReferences(triggered);
    expectValidReferences(missingQuicken);
    expectValidReferences(missingHydro);
  });

  it("rejects a reaction task outside aura-v7", () => {
    const forged = structuredClone(simulateTriggeredTask());
    if (forged.config.reactionEngine === undefined) {
      throw new Error("Expected an Aura reaction engine.");
    }
    forged.config.reactionEngine.mode = "aura-v6";

    expectDendroReferencesRejected(forged);
  });

  it("rejects a task whose origin no longer declares a pending follow-up", () => {
    const forged = structuredClone(simulateTriggeredTask());
    const task = requireTask(forged);
    const origin = forged.damageEvents[task.triggerDamageEventId];
    const quicken =
      origin?.reactionAudit.catalyzeReaction?.quicken;
    if (quicken === undefined || quicken === null) {
      throw new Error("Expected the originating Quicken audit.");
    }
    quicken.pendingHydroBloomFollowup = false;

    expectDendroReferencesRejected(forged);
  });

  it.each([
    [
      "action id",
      (origin: SimulationResult["damageEvents"][number]) => {
        origin.actionId = "forged-action";
      }
    ],
    [
      "hit id",
      (origin: SimulationResult["damageEvents"][number]) => {
        origin.hitId = "forged-hit";
      }
    ],
    [
      "hit group id",
      (origin: SimulationResult["damageEvents"][number]) => {
        origin.hitGroupId = "forged-hit-group";
      }
    ],
    [
      "event sequence",
      (origin: SimulationResult["damageEvents"][number]) => {
        origin.eventSequence += 1_000;
      }
    ]
  ] as const)("rejects a forged origin %s", (_label, mutateOrigin) => {
    const forged = structuredClone(simulateTriggeredTask());
    const task = requireTask(forged);
    const origin = forged.damageEvents[task.triggerDamageEventId];
    if (origin === undefined) {
      throw new Error("Expected the task origin damage event.");
    }
    mutateOrigin(origin);

    expectDendroReferencesRejected(forged);
  });

  it("rejects a missing Quicken-state reference", () => {
    const forged = structuredClone(simulateTriggeredTask());
    requireTask(forged).quickenStateLogIds = [999];

    expectDendroReferencesRejected(forged);
  });

  it("rejects bad, missing, and multiply-linked task timeline points", () => {
    const badLink = structuredClone(simulateTriggeredTask());
    const badLinkPoint = requireTaskPoint(badLink);
    const taskLink = badLinkPoint.links.find(
      (link) => link.kind === "reaction-task-log"
    );
    if (taskLink === undefined) {
      throw new Error("Expected a task timeline link.");
    }
    taskLink.id = 999;
    expectDendroReferencesRejected(badLink);

    const missingLink = structuredClone(simulateTriggeredTask());
    const missingLinkPoint = requireTaskPoint(missingLink);
    missingLinkPoint.links = missingLinkPoint.links.filter(
      (link) => link.kind !== "reaction-task-log"
    );
    expectDendroReferencesRejected(missingLink);

    const multipleLinks = structuredClone(simulateTriggeredTask());
    const originalPoint = requireTaskPoint(multipleLinks);
    const otherEventPoint = multipleLinks.targetStateTimeline.points.find(
      (point) =>
        point.id !== originalPoint.id &&
        point.pointKind !== "boundary" &&
        point.eventType === "hit"
    );
    if (otherEventPoint === undefined) {
      throw new Error("Expected another hit-owned target-state point.");
    }
    otherEventPoint.links.push({
      kind: "reaction-task-log",
      id: 0
    });
    expectDendroReferencesRejected(multipleLinks);
  });

  it("rejects an orphan reaction-task link on an unrelated timeline point", () => {
    const forged = structuredClone(simulateTriggeredTask());
    const taskPoint = requireTaskPoint(forged);
    const unrelatedPoint = forged.targetStateTimeline.points.find(
      (point) =>
        point.id !== taskPoint.id &&
        point.pointKind !== "boundary" &&
        point.eventType === "hit"
    );
    if (unrelatedPoint === undefined) {
      throw new Error("Expected an unrelated hit-owned timeline point.");
    }
    unrelatedPoint.links.push({
      kind: "reaction-task-log",
      id: 999
    });

    expectDendroReferencesRejected(forged);
    expect(
      playerDamageResultReferencesSchema.safeParse(forged).success
    ).toBe(false);
    expect(
      targetClockResultReferencesSchema.safeParse(forged).success
    ).toBe(false);
  });

  it("rejects a task timeline point with the opposite reaction status", () => {
    const forged = structuredClone(simulateTriggeredTask());
    const point = requireTaskPoint(forged);
    point.reaction = "none";
    point.reactions = [];

    expectDendroReferencesRejected(forged);
  });

  it("rejects task and task-owned core self-damage status mismatches", () => {
    const forgedTask = structuredClone(simulateTriggeredTask());
    const bloom = requireTask(forgedTask).bloomReaction;
    if (bloom === null) {
      throw new Error("Expected a triggered task Bloom audit.");
    }
    bloom.selfDamageStatus = "modeled-player-reaction-damage";
    expect(
      playerDamageResultReferencesSchema.safeParse(forgedTask).success
    ).toBe(false);

    const forgedCore = structuredClone(simulateTriggeredTask());
    const taskId = requireTask(forgedCore).id;
    const schedule = forgedCore.dendroCoreLog.find(
      (entry) =>
        entry.operation === "spawn-scheduled" &&
        entry.reactionTaskLogId === taskId
    );
    if (schedule === undefined) {
      throw new Error("Expected a task-owned core schedule.");
    }
    schedule.selfDamageStatus = "modeled-player-reaction-damage";
    expect(
      playerDamageResultReferencesSchema.safeParse(forgedCore).success
    ).toBe(false);
  });

  it("rejects a pending origin with no reaction task", () => {
    const forged = structuredClone(simulateMissingQuickenTask());
    const task = requireTask(forged);
    const taskPoint = requireTaskPoint(forged, task.id);
    forged.reactionTaskLog = [];
    forged.targetStateTimeline.points =
      forged.targetStateTimeline.points
        .filter((point) => point.id !== taskPoint.id)
        .map((point, id) => ({ ...point, id }));

    expectDendroReferencesRejected(forged);
  });

  it("rejects two reaction tasks owned by one pending origin", () => {
    const forged = structuredClone(simulateMissingQuickenTask());
    const task = requireTask(forged);
    const taskPoint = requireTaskPoint(forged, task.id);
    const duplicateTask = structuredClone(task);
    duplicateTask.id = 1;
    duplicateTask.eventSequence = task.eventSequence + 100;
    forged.reactionTaskLog.push(duplicateTask);

    const duplicatePoint = structuredClone(taskPoint);
    duplicatePoint.eventSequence = duplicateTask.eventSequence;
    duplicatePoint.intraEventSequence =
      duplicateTask.intraEventSequence + 1;
    duplicatePoint.links = duplicatePoint.links.map((link) =>
      link.kind === "reaction-task-log"
        ? { ...link, id: duplicateTask.id }
        : link
    );
    const insertionIndex =
      forged.targetStateTimeline.points.indexOf(taskPoint) + 1;
    forged.targetStateTimeline.points.splice(
      insertionIndex,
      0,
      duplicatePoint
    );
    forged.targetStateTimeline.points =
      forged.targetStateTimeline.points.map((point, id) => ({
        ...point,
        id
      }));

    expectDendroReferencesRejected(forged);
  });
});
