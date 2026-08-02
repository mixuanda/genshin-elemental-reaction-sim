import {
  quickenStateLogEntrySchema,
  targetStateTimelineSchema,
  type AbilityDefinition,
  type SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function noIcd(gaugeUnits: number) {
  return {
    gaugeUnits,
    icd: { mode: "no-icd-v1" as const }
  };
}

function exactBoundaryConfig(): SimConfig {
  const base = makeConfig();
  const setup: AbilityDefinition = {
    id: "setup-quicken-and-cryo",
    actorId: "electro",
    name: "Setup Quicken and Cryo",
    kind: "skill",
    cancelFrame: 2,
    animationEndFrame: 2,
    cooldownFrames: 0,
    hits: [
      {
        id: "quicken-hit",
        label: "Quicken",
        frame: 0,
        scaling: 0,
        element: "electro",
        application: noIcd(1)
      },
      {
        id: "cryo-boundary-hit",
        label: "Cryo expiring with Quicken",
        frame: 1,
        scaling: 0,
        element: "cryo",
        // Aura-v3/v4 normal Aura duration is 420 + 150U frames.
        // Attached at frame 1, this expires at frame 600 exactly.
        application: noIcd(179 / 150)
      }
    ]
  };
  const boundaryAction: AbilityDefinition = {
    id: "priority-zero-boundary-action",
    actorId: "electro",
    name: "Priority-zero boundary action",
    kind: "skill",
    cancelFrame: 1,
    animationEndFrame: 1,
    cooldownFrames: 0,
    hits: []
  };

  return {
    ...base,
    duration: 10.1,
    cycleLength: 10.1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Exact expiry target",
          initialAura: [{ element: "dendro", gaugeUnits: 1 }]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "electro",
        name: "Electro",
        element: "electro",
        stats: {
          ...neutralStats,
          baseAtk: 0
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v4" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "electro",
      swapFrames: 1,
      abilities: [setup, boundaryAction],
      commands: [
        {
          type: "skill",
          actorId: "electro",
          abilityId: setup.id,
          atFrame: 0
        },
        {
          type: "skill",
          actorId: "electro",
          abilityId: boundaryAction.id,
          atFrame: 600
        }
      ]
    }
  };
}

describe("target-local Quicken expiry ordering", () => {
  it("keeps a priority-zero action from consuming a same-frame Quicken boundary", () => {
    const result = simulate(exactBoundaryConfig(), {
      critMode: "noCrit"
    });
    const expiry = result.quickenStateLog.find(
      (entry) => entry.operation === "expire"
    );

    expect(
      result.quickenStateLog.map((entry) => entry.operation)
    ).toEqual(["start", "expire"]);
    expect(expiry).toMatchObject({
      frame: 600,
      quickenGaugeUnitsBefore: expect.closeTo(1 / 750, 12),
      quickenGaugeUnitsAfter: 0,
      decayPerFrameBefore: expect.closeTo(1 / 750, 12),
      decayPerFrameAfter: 0,
      expiresAtFrameBefore: 600,
      expiresAtFrame: null,
      endCauseBefore: "QUICKEN_DECAY",
      endCauseAfter: null,
      reason: "QUICKEN_DECAY_EXPIRED"
    });
    expect(
      expiry?.auraBefore.find(
        (entry) => entry.element === "quicken"
      )
    ).toMatchObject({
      gaugeUnits: expect.closeTo(1 / 750, 12),
      expiresAtFrame: 600
    });
    expect(expiry?.auraBefore).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ element: "cryo" })
      ])
    );
    expect(expiry?.auraAfter).toEqual([]);

    for (const entry of result.quickenStateLog) {
      expect(quickenStateLogEntrySchema.parse(entry)).toEqual(
        entry
      );
    }
    expect(
      targetStateTimelineSchema.parse(
        result.targetStateTimeline
      )
    ).toEqual(result.targetStateTimeline);

    const expiryPoints =
      result.targetStateTimeline.points.filter(
        (point) =>
          point.frame === 600 &&
          point.cause === "quicken-expiry"
      );
    expect(expiryPoints).toHaveLength(1);
    expect(expiryPoints[0]).toMatchObject({
      pointKind: "mutation",
      links: [
        {
          kind: "quicken-state-log",
          id: expiry?.id
        }
      ]
    });
    expect(
      result.auraEndStates[0]?.aura.some(
        (entry) =>
          entry.element === "quicken" ||
          entry.element === "cryo"
      )
    ).toBe(false);
  });
});
