import {
  assertTrustedSimulationResultV144,
  simulationResultV144Schema,
  type SimConfig,
  type SimulationResult
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const SAME_TARGET_GEOMETRY = {
  kind: "circle" as const,
  coordinateSpace: "world" as const,
  origin: { x: 0, y: 0 },
  radius: 1
};

function makeBurningQuickenConfig(): SimConfig {
  const base = makeConfig();
  const actor = {
    ...base.characters[0]!,
    id: "burning-quicken-driver",
    name: "Burning Quicken driver",
    element: "pyro" as const,
    stats: { ...neutralStats, baseAtk: 0 }
  };
  return {
    ...base,
    dataVersion: "burning-quicken-ownership-integrity",
    randomSeed: "burning-quicken-ownership-integrity",
    duration: 1,
    cycleLength: 1,
    meta: {
      name: "Burning Quicken ownership integrity",
      version: "1.44.0",
      verificationStatus: "provisional"
    },
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Burning Quicken target",
          position: { x: 0, y: 0 },
          initialAura: [
            { element: "dendro", gaugeUnits: 1 }
          ]
        }
      ]
    },
    characters: [actor],
    rotation: [],
    reactionEngine: { mode: "aura-v5" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: actor.id,
      swapFrames: 1,
      abilities: [
        {
          id: "quicken-then-burning",
          actorId: actor.id,
          name: "Quicken then Burning",
          kind: "skill",
          cancelFrame: 2,
          animationEndFrame: 2,
          cooldownFrames: 0,
          hits: [
            {
              id: "quicken-hit",
              label: "Quicken hit",
              frame: 0,
              scaling: 0,
              element: "electro",
              geometry: SAME_TARGET_GEOMETRY,
              application: {
                gaugeUnits: 1,
                icdTag: "quicken-hit",
                icdGroup: "no-icd"
              }
            },
            {
              id: "burning-hit",
              label: "Burning hit",
              frame: 1,
              scaling: 0,
              element: "pyro",
              geometry: SAME_TARGET_GEOMETRY,
              application: {
                gaugeUnits: 1,
                icdTag: "burning-hit",
                icdGroup: "no-icd"
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: actor.id,
          abilityId: "quicken-then-burning",
          atFrame: 0
        }
      ]
    }
  };
}

function makeOwnershipFixture(): SimulationResult {
  const result = simulate(makeBurningQuickenConfig(), {
    critMode: "noCrit"
  });
  const burningEvent = result.damageEvents.find(
    (event) =>
      event.reactionAudit.burningReaction?.quickenStateMutation
        .operation === "decay-rebase"
  );
  const quickenRow = result.quickenStateLog.find(
    (row) => row.reason === "BURNING_REBASED_QUICKEN_DECAY"
  );
  const applicationPoint =
    result.targetStateTimeline.points.find(
      (point) =>
        point.primaryDamageEventId === burningEvent?.id &&
        point.cause === "direct-hit-application"
    );
  if (
    burningEvent === undefined ||
    quickenRow === undefined ||
    applicationPoint === undefined
  ) {
    throw new Error(
      "Ownership fixture must expose a Burning decay-rebase event, row, and application point."
    );
  }
  expect(
    applicationPoint.links.filter(
      (link) =>
        link.kind === "quicken-state-log" &&
        link.id === quickenRow.id
    )
  ).toHaveLength(1);
  return result;
}

function makeOrderedOwnershipFixture(): SimulationResult {
  const base = makeConfig();
  const actor = {
    ...base.characters[0]!,
    id: "ordered-burning-driver",
    name: "Ordered Burning driver",
    element: "dendro" as const,
    stats: { ...neutralStats, baseAtk: 0 }
  };
  const config: SimConfig = {
    ...base,
    dataVersion: "burning-quicken-order-integrity",
    randomSeed: "burning-quicken-order-integrity",
    duration: 12,
    cycleLength: 12,
    meta: {
      name: "Burning Quicken order integrity",
      version: "1.44.0",
      verificationStatus: "provisional"
    },
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Ordered Burning target",
          position: { x: 0, y: 0 },
          initialAura: [
            { element: "electro", gaugeUnits: 0.1 },
            { element: "pyro", gaugeUnits: 1 },
            { element: "hydro", gaugeUnits: 2.4 }
          ]
        }
      ]
    },
    characters: [actor],
    rotation: [],
    reactionEngine: { mode: "aura-v5" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: actor.id,
      swapFrames: 1,
      abilities: [
        {
          id: "ordered-quicken-burning-bloom",
          actorId: actor.id,
          name: "Ordered Quicken Burning Bloom",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "ordered-chain-hit",
              label: "Ordered chain hit",
              frame: 0,
              scaling: 0,
              element: "dendro",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed"
              },
              application: {
                gaugeUnits: 1,
                icdTag: "ordered-chain",
                icdGroup: "no-icd"
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: actor.id,
          abilityId: "ordered-quicken-burning-bloom",
          atFrame: 0
        }
      ]
    }
  };
  return simulate(config, { critMode: "noCrit" });
}

function ownershipParts(result: SimulationResult) {
  const event = result.damageEvents.find(
    (candidate) =>
      candidate.reactionAudit.burningReaction
        ?.quickenStateMutation.operation === "decay-rebase"
  );
  const row = result.quickenStateLog.find(
    (candidate) =>
      candidate.reason === "BURNING_REBASED_QUICKEN_DECAY"
  );
  const point = result.targetStateTimeline.points.find(
    (candidate) =>
      candidate.primaryDamageEventId === event?.id &&
      candidate.cause === "direct-hit-application"
  );
  if (event === undefined || row === undefined || point === undefined) {
    throw new Error("Burning Quicken ownership fixture is incomplete.");
  }
  return { event, row, point };
}

function expectAcceptedAtBothBoundaries(
  result: SimulationResult
): void {
  const parsed = simulationResultV144Schema.safeParse(result);
  if (!parsed.success) {
    throw new Error(
      JSON.stringify(
        parsed.error.issues.map(({ path, message }) => ({
          path,
          message
        })),
        null,
        2
      )
    );
  }
  expect(assertTrustedSimulationResultV144(result)).toBe(result);
}

function expectRejectedAtBothBoundaries(
  result: SimulationResult
): void {
  expect(simulationResultV144Schema.safeParse(result).success).toBe(
    false
  );
  expect(() =>
    assertTrustedSimulationResultV144(result)
  ).toThrow(
    /Trusted SimulationResult 1\.44 integrity validation failed/
  );
}

describe("Burning Quicken ownership integrity", () => {
  it("accepts the exact audit, lifecycle row, and application link", () => {
    expectAcceptedAtBothBoundaries(makeOwnershipFixture());
  });

  it("accepts same-application Quicken, Burning, and Bloom rows in Aura order", () => {
    expectAcceptedAtBothBoundaries(makeOrderedOwnershipFixture());
  });

  it("rejects a forged Burning Quicken source actor", () => {
    const result = makeOwnershipFixture();
    const { row } = ownershipParts(result);

    row.sourceActorId = "forged-quicken-source";

    expectRejectedAtBothBoundaries(result);
  });

  it("rejects replacing the inherited Quicken trigger with the Burning hit", () => {
    const result = makeOwnershipFixture();
    const { event, row } = ownershipParts(result);

    row.triggerDamageEventId = event.id;

    expectRejectedAtBothBoundaries(result);
  });

  it("rejects coordinated G2/G3 row reordering with ids and links rewritten", () => {
    const result = makeOrderedOwnershipFixture();
    const burningRow = result.quickenStateLog.find(
      (candidate) =>
        candidate.reason === "BURNING_REBASED_QUICKEN_DECAY"
    );
    const bloomRow = result.quickenStateLog.find(
      (candidate) =>
        candidate.reason === "BLOOM_PARTIALLY_CONSUMED_QUICKEN"
    );
    if (burningRow === undefined || bloomRow === undefined) {
      throw new Error("Ordered fixture must expose G2 and G3 rows.");
    }
    const burningId = burningRow.id;
    const bloomId = bloomRow.id;
    result.quickenStateLog[burningId] = {
      ...structuredClone(bloomRow),
      id: burningId
    };
    result.quickenStateLog[bloomId] = {
      ...structuredClone(burningRow),
      id: bloomId
    };
    for (const point of result.targetStateTimeline.points) {
      for (const link of point.links) {
        if (link.kind !== "quicken-state-log") continue;
        if (link.id === burningId) {
          link.id = bloomId;
        } else if (link.id === bloomId) {
          link.id = burningId;
        }
      }
    }

    expectRejectedAtBothBoundaries(result);
  });

  it("rejects deleting the owned row together with its link", () => {
    const result = makeOwnershipFixture();
    const { row, point } = ownershipParts(result);

    result.quickenStateLog.splice(row.id, 1);
    point.links = point.links.filter(
      (link) =>
        link.kind !== "quicken-state-log" || link.id !== row.id
    );

    expectRejectedAtBothBoundaries(result);
  });

  it("rejects deleting only the owned application link", () => {
    const result = makeOwnershipFixture();
    const { row, point } = ownershipParts(result);

    point.links = point.links.filter(
      (link) =>
        link.kind !== "quicken-state-log" || link.id !== row.id
    );

    expectRejectedAtBothBoundaries(result);
  });

  it("rejects pointing the application link at a different Quicken row", () => {
    const result = makeOwnershipFixture();
    const { row, point } = ownershipParts(result);
    const otherRow = result.quickenStateLog.find(
      (candidate) => candidate.id !== row.id
    );
    const link = point.links.find(
      (candidate) =>
        candidate.kind === "quicken-state-log" &&
        candidate.id === row.id
    );
    if (otherRow === undefined || link === undefined) {
      throw new Error("Fixture must expose two Quicken rows and its link.");
    }

    link.id = otherRow.id;

    expectRejectedAtBothBoundaries(result);
  });

  it("rejects an orphan Burning-owned Quicken row", () => {
    const result = makeOwnershipFixture();
    const { row } = ownershipParts(result);

    result.quickenStateLog.push({
      ...structuredClone(row),
      id: result.quickenStateLog.length
    });

    expectRejectedAtBothBoundaries(result);
  });

  it("rejects a duplicate application link to the owned row", () => {
    const result = makeOwnershipFixture();
    const { row, point } = ownershipParts(result);

    point.links.push({ kind: "quicken-state-log", id: row.id });

    expectRejectedAtBothBoundaries(result);
  });
});
