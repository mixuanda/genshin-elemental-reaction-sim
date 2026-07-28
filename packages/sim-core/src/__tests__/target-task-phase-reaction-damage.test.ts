import type {
  FrameHitDefinition,
  SimConfig,
  SimulationResult
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const TARGET_ID = "enemy-0";
const TARGET_NAME = "Delayed reaction target";

function applicationHit(
  id: string,
  element: "electro" | "dendro"
): FrameHitDefinition {
  return {
    id,
    label: id,
    frame: 0,
    scaling: 0,
    element,
    geometry: {
      kind: "circle",
      coordinateSpace: "world",
      origin: { x: 0, y: 0 },
      radius: 1
    },
    application: {
      gaugeUnits: 1,
      icdTag: id,
      icdGroup: "no-icd"
    }
  };
}

function makeDelayedReactionConfig(
  initialElement: "hydro",
  hit: FrameHitDefinition,
  duration: number
): SimConfig {
  const base = makeConfig();
  const driverElement = hit.element;
  if (
    driverElement !== "electro" &&
    driverElement !== "dendro"
  ) {
    throw new Error(
      `Unexpected delayed-reaction driver element "${driverElement}".`
    );
  }

  return {
    ...base,
    duration,
    cycleLength: duration,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: TARGET_ID,
          name: TARGET_NAME,
          position: { x: 0, y: 0 },
          initialAura: [
            {
              element: initialElement,
              gaugeUnits: 1
            }
          ]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "driver",
        name: "Delayed reaction driver",
        element: driverElement,
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v7" },
    targetTaskModel: { mode: "target-phase-v1" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "driver",
      swapFrames: 1,
      abilities: [
        {
          id: "delayed-reaction",
          actorId: "driver",
          name: "Delayed reaction",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [hit]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "driver",
          abilityId: "delayed-reaction",
          atFrame: 0
        }
      ]
    }
  };
}

function referencedReactionDamageAt(
  result: SimulationResult,
  frame: number,
  reaction: "electroCharged" | "bloom"
) {
  const phase = result.targetTaskPhaseLog.find(
    (entry) =>
      entry.globalFrame === frame &&
      entry.targetId === TARGET_ID
  );
  expect(phase).toMatchObject({
    wakeKind: "incoming",
    eventType: "reactionDamage",
    globalFrame: frame,
    targetId: TARGET_ID,
    hitResolutionLogIds: [expect.any(Number)]
  });

  const hitResolutionLogId =
    phase!.hitResolutionLogIds[0]!;
  const hit = result.hitResolutionLog[hitResolutionLogId];
  expect(hit).toMatchObject({
    id: hitResolutionLogId,
    frame,
    targetId: TARGET_ID,
    resolutionKind: "reaction-damage",
    landed: true,
    damageEventId: expect.any(Number)
  });

  const damageEvent = result.damageEvents[hit!.damageEventId!];
  expect(damageEvent).toMatchObject({
    id: hit!.damageEventId,
    frame,
    targetId: TARGET_ID,
    kind: "transformative-reaction",
    reaction
  });

  const timelinePoint =
    result.targetStateTimeline.points.find(
      (point) =>
        point.frame === frame &&
        point.targetId === TARGET_ID &&
        point.eventType === "reactionDamage" &&
        point.primaryDamageEventId === damageEvent!.id
    );
  expect(timelinePoint).toMatchObject({
    pointKind: "observation",
    cause: "reaction-damage-application",
    eventType: "reactionDamage",
    primaryDamageEventId: damageEvent!.id,
    auraApplied: [],
    auraConsumed: []
  });
  expect(timelinePoint!.auraAfter).toStrictEqual(
    timelinePoint!.auraBefore
  );
  expect(
    timelinePoint!.links.some(
      (link) =>
        link.kind === "reaction-damage-log" &&
        result.reactionDamageLog[link.id]?.reaction === reaction
    )
  ).toBe(true);

  return { phase: phase!, hit: hit!, damageEvent: damageEvent! };
}

describe("target-phase delayed reaction-damage observations", () => {
  it("links the F10 Electro-Charged tick to a no-op target-state observation", () => {
    const result = simulate(
      makeDelayedReactionConfig(
        "hydro",
        applicationHit("electro-start", "electro"),
        1
      ),
      { critMode: "noCrit" }
    );

    const { phase } = referencedReactionDamageAt(
      result,
      10,
      "electroCharged"
    );
    expect(phase.auraAfterDecay).not.toEqual([]);
  });

  it("links a naturally expired Bloom core's delayed explosion at F331", () => {
    const result = simulate(
      makeDelayedReactionConfig(
        "hydro",
        applicationHit("bloom-start", "dendro"),
        6
      ),
      { critMode: "noCrit" }
    );

    const expiredCore = result.dendroCoreLog.find(
      (entry) => entry.operation === "expire"
    );
    expect(expiredCore).toMatchObject({
      coreId: 0,
      frame: 330,
      reaction: "bloom",
      damageFrame: 331,
      withinSimulation: true
    });
    const { hit } = referencedReactionDamageAt(
      result,
      331,
      "bloom"
    );
    expect(hit.hitId).toContain(":core-0:");
  });
});
