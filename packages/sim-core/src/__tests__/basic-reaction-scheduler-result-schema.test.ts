import {
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT
} from "@genshin-dps-lab/icd-profiles";
import {
  parseVersionedSimulationResult,
  simulationResultSchema,
  simulationResultV150Schema,
  simulationResultV151Schema,
  type BasicReactionSchedulerModel,
  type SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import { projectSimulationResultV151ToV150 } from "../../../test-vectors/src/project-v151-to-v150";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const LEGACY_SCHEDULER = {
  mode: "legacy-immediate-basic-reaction-scheduler-v1",
  policyId: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID
} as const satisfies BasicReactionSchedulerModel;

const NATIVE_SCHEDULER = {
  mode: "fixed-gcsim-basic-reaction-scheduler-v2",
  policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID
} as const satisfies BasicReactionSchedulerModel;

function makeSchemaVector(
  basicReactionSchedulerModel: BasicReactionSchedulerModel,
  includeMiss: boolean
): SimConfig {
  const base = makeConfig({ basicReactionSchedulerModel });
  return {
    ...base,
    duration: 1,
    cycleLength: 1,
    targetTaskModel: { mode: "target-phase-v2" },
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "source",
          name: "Swirl source",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "pyro", gaugeUnits: 1 }]
        },
        {
          id: "enemy-0",
          name: "In-range recipient",
          position: { x: 3, y: 0 }
        },
        ...(includeMiss
          ? [
              {
                id: "miss",
                name: "Out-of-range target",
                position: { x: 20, y: 0 }
              }
            ]
          : [])
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "anemo",
        name: "Anemo trigger",
        element: "anemo",
        stats: { ...neutralStats, em: 100 }
      }
    ],
    reactionEngine: { mode: "aura-v9" },
    rotation: [],
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "anemo",
      swapFrames: 1,
      abilities: [
        {
          id: "schema-swirl",
          actorId: "anemo",
          name: "Schema Swirl",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "schema-swirl-hit",
              frame: 10,
              scaling: 1,
              element: "anemo",
              targeting: {
                targetId: "source",
                outcome: "landed"
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
          actorId: "anemo",
          abilityId: "schema-swirl"
        }
      ]
    }
  };
}

function runSchemaVector(
  model: BasicReactionSchedulerModel,
  includeMiss = true
) {
  return simulate(makeSchemaVector(model, includeMiss), {
    compatibilityMode: "legal-frame-v1",
    critMode: "noCrit"
  });
}

describe("1.51 basic-reaction scheduler public result schema", () => {
  it("accepts the mixed landed/miss scheduler projection", () => {
    const result = runSchemaVector(NATIVE_SCHEDULER);
    expect(
      result.basicReactionSchedulerLog.map((entry) => ({
        kind: entry.kind,
        targetId: entry.targetId,
        disposition: entry.disposition
      }))
    ).toEqual([
      {
        kind: "swirl-attack-resolution",
        targetId: "enemy-0",
        disposition: "deferred"
      },
      {
        kind: "swirl-attack-resolution",
        targetId: "miss",
        disposition: "not-attached"
      },
      {
        kind: "deferred-aura-attachment",
        targetId: "enemy-0",
        disposition: "committed"
      }
    ]);
    expect(simulationResultV151Schema.safeParse(result).success).toBe(
      true
    );
    expect(simulationResultSchema.safeParse(result).success).toBe(
      true
    );
    expect(parseVersionedSimulationResult(result)).toEqual(result);
  });

  it("rejects pair, sequence, reference, id, and timeline mutations", () => {
    const result = runSchemaVector(NATIVE_SCHEDULER);
    const expectRejected = (
      mutate: (wire: typeof result) => void
    ): void => {
      const wire = structuredClone(result);
      mutate(wire);
      expect(simulationResultV151Schema.safeParse(wire).success).toBe(
        false
      );
    };

    expectRejected((wire) => {
      wire.basicReactionSchedulerLog[0]!.id = 9;
    });
    expectRejected((wire) => {
      const commit = wire.basicReactionSchedulerLog.find(
        (entry) => entry.kind === "deferred-aura-attachment"
      )!;
      commit.pairedLogId = 1;
    });
    expectRejected((wire) => {
      const attack = wire.basicReactionSchedulerLog.find(
        (entry) =>
          entry.kind === "swirl-attack-resolution" &&
          entry.disposition === "deferred"
      )!;
      Object.assign(attack, {
        disposition: "legacy-immediate",
        pairedLogId: null
      });
    });
    expectRejected((wire) => {
      const commit = wire.basicReactionSchedulerLog.find(
        (entry) => entry.kind === "deferred-aura-attachment"
      )!;
      commit.eventSequence = commit.parentEventSequence;
    });
    expectRejected((wire) => {
      wire.basicReactionSchedulerLog[0]!.reactionDamageLogId = 999;
    });
    expectRejected((wire) => {
      const rowId = wire.basicReactionSchedulerLog[0]!.id;
      for (const point of wire.targetStateTimeline.points) {
        point.links = point.links.filter(
          (link) =>
            link.kind !== "basic-reaction-scheduler-log" ||
            link.id !== rowId
        );
      }
    });
  });

  it("rejects coherent-looking model/root and extra-field forgeries", () => {
    const result = runSchemaVector(NATIVE_SCHEDULER);
    const modelForgery = structuredClone(result);
    modelForgery.config.basicReactionSchedulerModel =
      LEGACY_SCHEDULER;
    expect(
      simulationResultV151Schema.safeParse(modelForgery).success
    ).toBe(false);

    const rootForgery = structuredClone(result);
    rootForgery.runManifest.basicReactionSchedulerRoot =
      LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ROOT;
    expect(
      simulationResultV151Schema.safeParse(rootForgery).success
    ).toBe(false);

    const rowForgery: unknown = structuredClone(result);
    (rowForgery as any).basicReactionSchedulerLog[0].futureField =
      true;
    expect(
      simulationResultV151Schema.safeParse(rowForgery).success
    ).toBe(false);
  });

  it("requires complete V1 and V2 attack projections", () => {
    const legacy = runSchemaVector(LEGACY_SCHEDULER, false);
    expect(legacy.basicReactionSchedulerLog).toHaveLength(1);
    const missingLegacyProof = structuredClone(legacy);
    missingLegacyProof.basicReactionSchedulerLog = [];
    for (const point of
      missingLegacyProof.targetStateTimeline.points) {
      point.links = point.links.filter(
        (link) =>
          link.kind !== "basic-reaction-scheduler-log"
      );
    }
    expect(
      simulationResultV151Schema.safeParse(missingLegacyProof)
        .success
    ).toBe(false);

    const native = runSchemaVector(NATIVE_SCHEDULER);
    const missingAttempt = structuredClone(native);
    const missingAttack =
      missingAttempt.basicReactionSchedulerLog.find(
        (entry) =>
          entry.kind === "swirl-attack-resolution" &&
          entry.disposition === "not-attached"
      )!;
    const removedId = missingAttack.id;
    missingAttempt.basicReactionSchedulerLog =
      missingAttempt.basicReactionSchedulerLog
        .filter((entry) => entry.id !== removedId)
        .map((entry, id) => ({ ...entry, id }));
    for (const entry of
      missingAttempt.basicReactionSchedulerLog) {
      if (
        entry.pairedLogId !== null &&
        entry.pairedLogId > removedId
      ) {
        entry.pairedLogId -= 1;
      }
    }
    for (const point of
      missingAttempt.targetStateTimeline.points) {
      point.links = point.links
        .filter(
          (link) =>
            link.kind !== "basic-reaction-scheduler-log" ||
            link.id !== removedId
        )
        .map((link) =>
          link.kind === "basic-reaction-scheduler-log" &&
          link.id > removedId
            ? { ...link, id: link.id - 1 }
            : link
        );
    }
    expect(
      simulationResultV151Schema.safeParse(missingAttempt).success
    ).toBe(false);
  });

  it("keeps 1.50 strict against scheduler fields and timeline literals", () => {
    const currentLegacy = runSchemaVector(
      LEGACY_SCHEDULER,
      false
    );
    const frozen = projectSimulationResultV151ToV150(
      currentLegacy
    );
    expect(simulationResultV150Schema.safeParse(frozen).success).toBe(
      true
    );

    const topLevelForgery: unknown = {
      ...structuredClone(frozen),
      basicReactionSchedulerLog: []
    };
    expect(
      simulationResultV150Schema.safeParse(topLevelForgery).success
    ).toBe(false);

    const expectFrozenTimelineRejected = (
      mutate: (point: any) => void
    ): void => {
      const wire: any = structuredClone(frozen);
      const point = wire.targetStateTimeline.points.find(
        (candidate: any) =>
          candidate.cause === "reaction-damage-application"
      );
      expect(point).toBeDefined();
      mutate(point);
      expect(
        simulationResultV150Schema.safeParse(wire).success
      ).toBe(false);
    };
    expectFrozenTimelineRejected((point) => {
      point.eventType = "reactionAuraAttachment";
    });
    expectFrozenTimelineRejected((point) => {
      point.cause = "reaction-aura-attachment";
    });
    expectFrozenTimelineRejected((point) => {
      point.links.push({
        kind: "basic-reaction-scheduler-log",
        id: 0
      });
    });
  });
});
