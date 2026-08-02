import {
  GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
  LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
} from "@genshin-dps-lab/icd-profiles";
import {
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  simulationResultV150Schema,
  type BasicReactionSchedulerModel,
  type SimConfig,
  type SimulationResultForV151,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import {
  makeConfig,
  neutralStats,
} from "../../sim-core/src/__tests__/fixtures";
import { simulate } from "../../sim-core/src/simulator";
import { projectSimulationResultV151ToV150 } from "./project-v151-to-v150";

const NO_CRIT = {
  compatibilityMode: "legal-frame-v1",
  critMode: "noCrit",
  randomSeed: "v151-to-v150-projection",
} as const;

const LEGACY_SCHEDULER = {
  mode: "legacy-immediate-basic-reaction-scheduler-v1",
  policyId: LEGACY_BASIC_REACTION_SCHEDULER_POLICY_V1_ID,
} as const satisfies BasicReactionSchedulerModel;

const DEFERRED_SCHEDULER = {
  mode: "fixed-gcsim-basic-reaction-scheduler-v2",
  policyId: GCSIM_BASIC_REACTION_SCHEDULER_POLICY_V2_ID,
} as const satisfies BasicReactionSchedulerModel;

function makeSingleSwirlConfig(
  basicReactionSchedulerModel: BasicReactionSchedulerModel,
): SimConfig {
  const base = makeConfig({ basicReactionSchedulerModel });
  const anemo = {
    ...base.characters[0]!,
    id: "anemo",
    name: "Projection Anemo",
    element: "anemo" as const,
    level: 90,
    stats: { ...neutralStats, em: 100 },
  };
  return {
    ...base,
    duration: 1,
    cycleLength: 1,
    characters: [anemo],
    targetTaskModel: { mode: "target-phase-v2" },
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "swirl-source",
          name: "Pyro source",
          position: { x: 0, y: 0 },
          initialAura: [{ element: "pyro", gaugeUnits: 1 }],
        },
        {
          id: "enemy-0",
          name: "Empty propagation target",
          position: { x: 2, y: 0 },
        },
      ],
    },
    reactionEngine: { mode: "aura-v9" },
    rotation: [],
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: anemo.id,
      swapFrames: 1,
      abilities: [
        {
          id: "single-swirl",
          actorId: anemo.id,
          name: "Single Swirl",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "single-swirl-hit",
              frame: 0,
              scaling: 0,
              element: "anemo",
              targeting: {
                targetId: "swirl-source",
                outcome: "landed",
              },
              application: {
                gaugeUnits: 1,
                icd: { mode: "no-icd-v1" },
              },
            },
          ],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: anemo.id,
          abilityId: "single-swirl",
          atFrame: 0,
        },
      ],
    },
  };
}

function runEmpty(model: BasicReactionSchedulerModel) {
  return simulate(makeConfig({ basicReactionSchedulerModel: model }), NO_CRIT);
}

function runSingleSwirl(model: BasicReactionSchedulerModel) {
  return simulate(makeSingleSwirlConfig(model), NO_CRIT);
}

describe("V1.51 to frozen V1.50 result projection", () => {
  it.each([
    ["V1", LEGACY_SCHEDULER],
    ["V2", DEFERRED_SCHEDULER],
  ] as const)(
    "projects an inactive %s scheduler and rebuilds the exact V1.50 identity",
    (_label, model) => {
      const current = runEmpty(model);
      expect(current.basicReactionSchedulerLog).toEqual([]);

      const projected = projectSimulationResultV151ToV150(current);
      expect(simulationResultV150Schema.parse(projected)).toEqual(projected);
      expect(projected.schemaVersion).toBe(
        REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
      );
      expect(projected.engineVersion).toBe(
        REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
      );
      expect(projected.runManifest.version).toBe(
        REACTION_DAMAGE_GROUP_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
      );
      expect(
        Object.hasOwn(projected.config, "basicReactionSchedulerModel"),
      ).toBe(false);
      expect(
        Object.hasOwn(
          projected.runManifest,
          "basicReactionSchedulerRoot",
        ),
      ).toBe(false);
      expect(Object.hasOwn(projected, "basicReactionSchedulerLog")).toBe(
        false,
      );
      expect(projected.runManifest.configHash).toBe(
        createSimulationConfigHash(projected.config),
      );
      const {
        reproducibilityKey: _reproducibilityKey,
        ...manifestIdentity
      } = projected.runManifest;
      expect(projected.reproducibilityKey).toBe(
        createSimulationReproducibilityKey(manifestIdentity),
      );
      expect(projected.totalDamage).toBe(current.totalDamage);
      expect(projected.damageEvents).toEqual(current.damageEvents);
    },
  );

  it("discards V1 legacy-immediate rows and their reciprocal timeline links", () => {
    const current = runSingleSwirl(LEGACY_SCHEDULER);
    expect(current.basicReactionSchedulerLog.length).toBeGreaterThan(0);
    expect(
      current.basicReactionSchedulerLog.every(
        (entry) =>
          entry.kind === "swirl-attack-resolution" &&
          entry.disposition === "legacy-immediate" &&
          entry.pairedLogId === null,
      ),
    ).toBe(true);
    expect(
      current.targetStateTimeline.points.some((point) =>
        point.links.some(
          (link) => link.kind === "basic-reaction-scheduler-log",
        ),
      ),
    ).toBe(true);

    const projected = projectSimulationResultV151ToV150(
      current,
    );
    expect(simulationResultV150Schema.parse(projected)).toEqual(projected);
    expect(Object.hasOwn(projected, "basicReactionSchedulerLog")).toBe(false);
    expect(
      projected.targetStateTimeline.points.some((point) =>
        point.links.some(
          (link) =>
            (link as { kind: string }).kind ===
            "basic-reaction-scheduler-log",
        ),
      ),
    ).toBe(false);

    const incompatibleV1Row = {
      ...current,
      basicReactionSchedulerLog: [
        {
          ...current.basicReactionSchedulerLog[0]!,
          disposition: "deferred",
          pairedLogId: 1,
        },
      ],
    } as SimulationResultForV151;
    expect(() =>
      projectSimulationResultV151ToV150(incompatibleV1Row),
    ).toThrow(/scheduler|legacy-immediate|disposition/i);
  });

  it("fails closed whenever V2 produced scheduler rows", () => {
    const active = runSingleSwirl(DEFERRED_SCHEDULER);
    expect(active.basicReactionSchedulerLog.length).toBeGreaterThan(0);
    expect(() => projectSimulationResultV151ToV150(active)).toThrow(
      /only when basicReactionSchedulerLog is empty/,
    );
  });

  it.each([
    [
      "event",
      (current: SimulationResultForV151) => ({
        ...current,
        targetStateTimeline: {
          ...current.targetStateTimeline,
          points: current.targetStateTimeline.points.map((point, index) =>
            index === 0
              ? { ...point, eventType: "reactionAuraAttachment" as const }
              : point,
          ),
        },
      }),
      /eventType|reactionAuraAttachment|boundary points/i,
    ],
    [
      "cause",
      (current: SimulationResultForV151) => ({
        ...current,
        targetStateTimeline: {
          ...current.targetStateTimeline,
          points: current.targetStateTimeline.points.map((point, index) =>
            index === 0
              ? { ...point, cause: "reaction-aura-attachment" as const }
              : point,
          ),
        },
      }),
      /cause|reaction-aura-attachment|simulation-start/i,
    ],
    [
      "link",
      (current: SimulationResultForV151) => ({
        ...current,
        targetStateTimeline: {
          ...current.targetStateTimeline,
          points: current.targetStateTimeline.points.map((point, index) =>
            index === 0
              ? {
                  ...point,
                  links: [
                    ...point.links,
                    { kind: "basic-reaction-scheduler-log" as const, id: 0 },
                  ],
                }
              : point,
          ),
        },
      }),
      /basic-reaction-scheduler-log|links/i,
    ],
  ] as const)("rejects a V2 1.51-only timeline %s", (_label, mutate, error) => {
    const current = runEmpty(DEFERRED_SCHEDULER);
    expect(current.targetStateTimeline.points.length).toBeGreaterThan(0);
    expect(() =>
      projectSimulationResultV151ToV150(mutate(current)),
    ).toThrow(error);
  });

  it("rejects a config/root scheduler policy mismatch before stripping identity", () => {
    const current = runEmpty(DEFERRED_SCHEDULER);
    const mismatched = {
      ...current,
      config: {
        ...current.config,
        basicReactionSchedulerModel: LEGACY_SCHEDULER,
      },
    };
    expect(() => projectSimulationResultV151ToV150(mismatched)).toThrow(
      /scheduler|configHash|not bound/i,
    );
  });

  it("rejects an inactive V1 orphan scheduler timeline link before stripping it", () => {
    const current = structuredClone(runEmpty(LEGACY_SCHEDULER));
    const point = current.targetStateTimeline.points[0];
    expect(point).toBeDefined();
    point!.links.push({
      kind: "basic-reaction-scheduler-log",
      id: 999,
    });

    expect(() => projectSimulationResultV151ToV150(current)).toThrow(
      /scheduler|timeline|link/i,
    );
  });

  it("rejects an inactive V2 forged scheduler-root hash before stripping it", () => {
    const current = structuredClone(runEmpty(DEFERRED_SCHEDULER));
    const forged = current as unknown as {
      runManifest: {
        basicReactionSchedulerRoot: { contentHash: string };
      };
    };
    forged.runManifest.basicReactionSchedulerRoot.contentHash =
      `sha256:${"0".repeat(64)}`;

    expect(() =>
      projectSimulationResultV151ToV150(
        forged as unknown as SimulationResultForV151,
      ),
    ).toThrow(/scheduler|root|contentHash/i);
  });
});
