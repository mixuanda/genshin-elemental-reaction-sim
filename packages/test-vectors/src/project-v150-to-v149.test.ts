import {
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
} from "@genshin-dps-lab/icd-profiles";
import {
  REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  simulationResultV149Schema,
  type ReactionDamageGroupModel,
  type SimConfig,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import {
  makeConfig,
  neutralStats,
} from "../../sim-core/src/__tests__/fixtures";
import { simulate } from "../../sim-core/src/simulator";
import { projectSimulationResultV150ToV149 } from "./project-v150-to-v149";
import { projectSimulationResultV151ToV150 } from "./project-v151-to-v150";
import { projectSimulationResultV152ToV151 } from "./project-v152-to-v151";

const NO_CRIT = {
  critMode: "noCrit",
  randomSeed: "v150-to-v149-projection",
} as const;

function makeThreeBloomConfig(
  reactionDamageGroupModel: ReactionDamageGroupModel,
): SimConfig {
  const base = makeConfig({ reactionDamageGroupModel });
  const hydro = {
    ...base.characters[0]!,
    id: "hydro",
    name: "Hydro projection driver",
    element: "hydro" as const,
    level: 90,
    stats: {
      ...neutralStats,
      baseAtk: 0,
      baseHp: 10_000,
      em: 0,
    },
  };
  return {
    ...base,
    dataVersion: "v150-to-v149-three-bloom",
    randomSeed: "v150-to-v149-three-bloom",
    duration: 6,
    cycleLength: 6,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Bloom projection target",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [{ element: "dendro", gaugeUnits: 1.875 }],
        },
      ],
    },
    characters: [hydro],
    rotation: [],
    reactionEngine: { mode: "aura-v5" },
    playerDamageModel: {
      mode: "reaction-self-v1",
      position: { x: 0, y: 0 },
      hitboxRadius: 10,
      shieldMode: "crystallize-v1",
      zeroHpPolicy: "clamp-and-continue",
      characters: [
        {
          actorId: hydro.id,
          initialHpRatio: 1,
          resistances: {
            pyro: 0,
            cryo: 0,
            hydro: 0,
            electro: 0,
            anemo: 0,
            geo: 0,
            dendro: 0,
            physical: 0,
          },
        },
      ],
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: hydro.id,
      swapFrames: 1,
      abilities: [
        {
          id: "three-blooms",
          actorId: hydro.id,
          name: "Three Blooms",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: Array.from({ length: 3 }, (_, index) => ({
            id: `hydro-${index}`,
            label: `Hydro ${index}`,
            frame: 0,
            scaling: 0,
            element: "hydro" as const,
            targeting: {
              targetId: "enemy-0",
              outcome: "landed" as const,
            },
            application: {
              gaugeUnits: 1,
              icd: { mode: "no-icd-v1" as const },
            },
          })),
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: hydro.id,
          abilityId: "three-blooms",
          atFrame: 0,
        },
      ],
    },
  };
}

function expectFrozenDecisionShape(
  decision: Record<string, unknown>,
  sequence: readonly boolean[],
): void {
  expect(decision).toMatchObject({
    resetFrames: 30,
    sequence,
  });
  for (const currentOnlyField of [
    "policyId",
    "profileId",
    "icdTag",
    "icdGroup",
    "scopeKey",
    "frame",
    "damageGroupTaskSequence",
    "windowGeneration",
    "resetAtFrame",
    "resetTaskLogId",
    "resetTaskSequence",
    "sequenceIndex",
    "sequenceMultiplier",
  ]) {
    expect(Object.hasOwn(decision, currentOnlyField)).toBe(false);
  }
}

describe("V1.50 to frozen V1.49 result projection", () => {
  it("losslessly rebuilds V1 enemy and player ReactionA decisions", () => {
    const current = simulate(
      makeThreeBloomConfig({
        mode: "legacy-reaction-damage-group-window-v1",
        policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_V1_ID,
      }),
      NO_CRIT,
    );
    const currentEnemyDecisions = current.reactionDamageLog.flatMap(
      (entry) => entry.damageGroupDecisions,
    );
    const currentPlayerDecisions = current.playerDamageEvents.flatMap(
      (event) =>
        event.damageFactors.damageGroupDecision === null
          ? []
          : [event.damageFactors.damageGroupDecision],
    );
    expect(currentEnemyDecisions.map((entry) => entry.damageAllowed)).toEqual([
      true,
      true,
      false,
    ]);
    expect(currentPlayerDecisions.map((entry) => entry.damageAllowed)).toEqual([
      true,
      true,
      false,
    ]);
    expect(current.reactionDamageGroupResetLog).toEqual([]);

    const currentV150 = projectSimulationResultV151ToV150(
      projectSimulationResultV152ToV151(current),
    );
    const projected = projectSimulationResultV150ToV149(currentV150);
    expect(simulationResultV149Schema.parse(projected)).toEqual(projected);
    expect(projected.schemaVersion).toBe(
      REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
    );
    expect(projected.engineVersion).toBe(
      REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
    );
    expect(projected.runManifest.version).toBe(
      REACTION_OWNED_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
    );
    expect(Object.hasOwn(projected.config, "reactionDamageGroupModel")).toBe(
      false,
    );
    expect(
      Object.hasOwn(projected.runManifest, "reactionDamageGroupRoot"),
    ).toBe(false);
    expect(Object.hasOwn(projected, "reactionDamageGroupResetLog")).toBe(false);
    expect(projected.runManifest.configHash).toBe(
      createSimulationConfigHash(projected.config),
    );
    const { reproducibilityKey: _reproducibilityKey, ...manifestIdentity } =
      projected.runManifest;
    expect(projected.reproducibilityKey).toBe(
      createSimulationReproducibilityKey(manifestIdentity),
    );
    expect(projected.totalDamage).toBe(current.totalDamage);
    expect(projected.dps).toBe(current.dps);
    expect(projected.damageEvents).toEqual(current.damageEvents);

    const projectedEnemyDecisions = projected.reactionDamageLog.flatMap(
      (entry) => entry.damageGroupDecisions,
    );
    const projectedPlayerDecisions = projected.playerDamageEvents.flatMap(
      (event) =>
        event.damageFactors.damageGroupDecision === null
          ? []
          : [event.damageFactors.damageGroupDecision],
    );
    for (const decision of projectedEnemyDecisions) {
      expectFrozenDecisionShape(
        decision as unknown as Record<string, unknown>,
        [true, true, false],
      );
    }
    for (const decision of projectedPlayerDecisions) {
      expectFrozenDecisionShape(
        decision as unknown as Record<string, unknown>,
        [true, true, false],
      );
    }
  });

  it("allows an inactive V2 run to discard only the unused identity", () => {
    const current = simulate(makeConfig(), NO_CRIT);
    expect(
      current.reactionDamageLog.flatMap((entry) => entry.damageGroupDecisions),
    ).toEqual([]);
    expect(current.playerDamageEvents).toEqual([]);
    expect(current.reactionDamageGroupResetLog).toEqual([]);

    const currentV150 = projectSimulationResultV151ToV150(
      projectSimulationResultV152ToV151(current),
    );
    const projected = projectSimulationResultV150ToV149(currentV150);
    expect(simulationResultV149Schema.parse(projected)).toEqual(projected);
    expect(projected.totalDamage).toBe(current.totalDamage);
    expect(projected.damageEvents).toEqual(current.damageEvents);
  });

  it("fails closed for V2 enemy/player decisions and reset rows", () => {
    const active = simulate(
      makeThreeBloomConfig({
        mode: "fixed-gcsim-reaction-damage-task-order-v2",
        policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID,
      }),
      NO_CRIT,
    );
    expect(
      active.reactionDamageLog.flatMap((entry) => entry.damageGroupDecisions)
        .length,
    ).toBeGreaterThan(0);
    expect(active.playerDamageEvents.length).toBeGreaterThan(0);
    expect(active.reactionDamageGroupResetLog.length).toBeGreaterThan(0);
    const activeV150 = projectSimulationResultV151ToV150(
      projectSimulationResultV152ToV151(active),
    );
    expect(() => projectSimulationResultV150ToV149(activeV150)).toThrow(
      /no faithful V1\.49 wire projection/,
    );

    const playerOnly = {
      ...activeV150,
      reactionDamageLog: activeV150.reactionDamageLog.map((entry) => ({
        ...entry,
        damageGroupDecisions: [],
      })),
      reactionDamageGroupResetLog: [],
    };
    expect(() => projectSimulationResultV150ToV149(playerOnly)).toThrow(
      /no faithful V1\.49 wire projection/,
    );

    const inactive = simulate(makeConfig(), NO_CRIT);
    const inactiveV150 = projectSimulationResultV151ToV150(
      projectSimulationResultV152ToV151(inactive),
    );
    expect(() =>
      projectSimulationResultV150ToV149({
        ...inactiveV150,
        reactionDamageGroupResetLog: [{}] as never,
      }),
    ).toThrow(/no faithful V1\.49 wire projection/);
  });
});
