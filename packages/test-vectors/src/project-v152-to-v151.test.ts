import {
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
  LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT,
  LEGACY_CALLBACK_BUS_POLICY_V1_ID,
  LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
} from "@genshin-dps-lab/icd-profiles";
import {
  BASIC_REACTION_SCHEDULER_ENGINE_VERSION,
  BASIC_REACTION_SCHEDULER_RUN_MANIFEST_VERSION,
  BASIC_REACTION_SCHEDULER_SCHEMA_VERSION,
  assertTrustedSimulationResultV152,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  simulationResultV151Schema,
  simulationResultV152Schema,
  type FreezeBrokenAttackModelV152,
  type FreezeBrokenAttackRootV152,
  type SimConfig,
  type SimulationResultForV152,
  type SimulationRunManifestV152,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import {
  makeConfig,
  neutralStats,
} from "../../sim-core/src/__tests__/fixtures";
import { simulate } from "../../sim-core/src/simulator";
import { projectSimulationResultV152ToV151 } from "./project-v152-to-v151";
import { projectSimulationResultV153ToV152 } from "./project-v153-to-v152";

const NO_CRIT = {
  compatibilityMode: "legal-frame-v1",
  critMode: "noCrit",
  randomSeed: "v152-to-v151-projection",
} as const;

const LEGACY_FREEZE_BROKEN = {
  mode: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_MODE,
  policyId: LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ID,
} as const satisfies FreezeBrokenAttackModelV152;

const FIXED_FREEZE_BROKEN = {
  mode: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_MODE,
  policyId: GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ID,
} as const satisfies FreezeBrokenAttackModelV152;

const LEGACY_CALLBACK_BUS = {
  mode: LEGACY_CALLBACK_BUS_POLICY_V1_MODE,
  policyId: LEGACY_CALLBACK_BUS_POLICY_V1_ID,
} as const;

function runEmpty(model: FreezeBrokenAttackModelV152) {
  return projectSimulationResultV153ToV152(
    simulate(
      makeConfig({
        freezeBrokenAttackModel: model,
        callbackBusModel: LEGACY_CALLBACK_BUS,
      }),
      NO_CRIT,
    ),
  );
}

function makeNaturalExpiryConfig(
  freezeBrokenAttackModel: FreezeBrokenAttackModelV152,
): SimConfig {
  const base = makeConfig({
    freezeBrokenAttackModel,
    callbackBusModel: LEGACY_CALLBACK_BUS,
  });
  const template = base.characters[0]!;
  return {
    ...base,
    duration: 4,
    cycleLength: 4,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      freezeResistance: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Projection frozen target",
          initialAura: [{ element: "cryo", gaugeUnits: 1 }],
        },
      ],
    },
    characters: [
      {
        ...template,
        id: "hydro",
        name: "Projection Hydro",
        element: "hydro",
        level: 90,
        stats: { ...neutralStats, baseAtk: 1000 },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "hydro",
      swapFrames: 1,
      abilities: [
        {
          id: "hydro-freeze",
          actorId: "hydro",
          name: "Hydro Freeze",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "hydro-freeze-hit",
              label: "Freeze",
              frame: 0,
              scaling: 1,
              element: "hydro",
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
          actorId: "hydro",
          abilityId: "hydro-freeze",
        },
      ],
    },
  };
}

function runNaturalExpiry(model: FreezeBrokenAttackModelV152) {
  return projectSimulationResultV153ToV152(
    simulate(makeNaturalExpiryConfig(model), NO_CRIT),
  );
}

function rebindFreezeBrokenPolicy(
  result: SimulationResultForV152,
  model: FreezeBrokenAttackModelV152,
  root: FreezeBrokenAttackRootV152,
): SimulationResultForV152 {
  const rebound = structuredClone(result);
  rebound.config.freezeBrokenAttackModel = model;
  const configHash = createSimulationConfigHash(rebound.config);
  const { reproducibilityKey: _reproducibilityKey, ...manifestRest } =
    rebound.runManifest;
  const manifestIdentity: Omit<
    SimulationRunManifestV152,
    "reproducibilityKey"
  > = {
    ...manifestRest,
    configHash,
    freezeBrokenAttackRoot: root,
  };
  rebound.runManifest = {
    ...manifestIdentity,
    reproducibilityKey: createSimulationReproducibilityKey(manifestIdentity),
  };
  rebound.reproducibilityKey = rebound.runManifest.reproducibilityKey;
  return rebound;
}

describe("V1.52 to frozen V1.51 result projection", () => {
  it.each([
    ["V1", LEGACY_FREEZE_BROKEN],
    ["V2", FIXED_FREEZE_BROKEN],
  ] as const)(
    "projects an inactive %s policy and rebuilds the exact V1.51 identity",
    (_label, model) => {
      const current = runEmpty(model);
      expect(current.freezeBrokenAttackLog).toEqual([]);
      expect(simulationResultV152Schema.parse(current)).toEqual(current);
      expect(assertTrustedSimulationResultV152(current)).toBe(current);

      const projected = projectSimulationResultV152ToV151(current);
      expect(simulationResultV151Schema.parse(projected)).toEqual(projected);
      expect(projected.schemaVersion).toBe(
        BASIC_REACTION_SCHEDULER_SCHEMA_VERSION,
      );
      expect(projected.engineVersion).toBe(
        BASIC_REACTION_SCHEDULER_ENGINE_VERSION,
      );
      expect(projected.runManifest.version).toBe(
        BASIC_REACTION_SCHEDULER_RUN_MANIFEST_VERSION,
      );
      expect(Object.hasOwn(projected.config, "freezeBrokenAttackModel")).toBe(
        false,
      );
      expect(
        Object.hasOwn(projected.runManifest, "freezeBrokenAttackRoot"),
      ).toBe(false);
      expect(Object.hasOwn(projected, "freezeBrokenAttackLog")).toBe(false);
      expect(projected.runManifest.configHash).toBe(
        createSimulationConfigHash(projected.config),
      );
      const { reproducibilityKey: _reproducibilityKey, ...manifestIdentity } =
        projected.runManifest;
      expect(projected.reproducibilityKey).toBe(
        createSimulationReproducibilityKey(manifestIdentity),
      );
      expect(projected.totalDamage).toBe(current.totalDamage);
      expect(projected.damageEvents).toEqual(current.damageEvents);
      expect(projected.targetStateTimeline).toEqual(
        current.targetStateTimeline,
      );
    },
  );

  it("projects an eligible V1 depletion only when its historical log stays empty", () => {
    const current = runNaturalExpiry(LEGACY_FREEZE_BROKEN);
    expect(current.frozenStateLog.map((entry) => entry.operation)).toEqual([
      "start",
      "expire",
    ]);
    expect(current.freezeBrokenAttackLog).toEqual([]);

    const projected = projectSimulationResultV152ToV151(current);
    expect(simulationResultV151Schema.parse(projected)).toEqual(projected);
    expect(projected.frozenStateLog).toEqual(current.frozenStateLog);
  });

  it("fails closed when V2 emitted any Freeze Broken callback semantics", () => {
    const active = runNaturalExpiry(FIXED_FREEZE_BROKEN);
    expect(simulationResultV152Schema.parse(active)).toEqual(active);
    expect(assertTrustedSimulationResultV152(active)).toBe(active);
    expect(active.freezeBrokenAttackLog.length).toBeGreaterThan(0);

    expect(() => projectSimulationResultV152ToV151(active)).toThrow(
      /only when freezeBrokenAttackLog is empty|callback semantics/i,
    );
  });

  it("rejects a V1 source carrying rows before any 1.52 proof is stripped", () => {
    const activeV2 = runNaturalExpiry(FIXED_FREEZE_BROKEN);
    expect(activeV2.freezeBrokenAttackLog.length).toBeGreaterThan(0);
    const forgedV1 = rebindFreezeBrokenPolicy(
      activeV2,
      LEGACY_FREEZE_BROKEN,
      LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT,
    );

    expect(() => projectSimulationResultV152ToV151(forgedV1)).toThrow(
      /freeze broken|V1|empty|log/i,
    );
  });

  it("rejects a mismatched config/root policy before stripping identity", () => {
    const current = runEmpty(FIXED_FREEZE_BROKEN);
    const mismatched = structuredClone(current);
    mismatched.runManifest.freezeBrokenAttackRoot =
      LEGACY_FREEZE_BROKEN_ATTACK_POLICY_V1_ROOT;

    expect(() => projectSimulationResultV152ToV151(mismatched)).toThrow(
      /freeze broken|root|policy|configHash|manifest/i,
    );
  });

  it("rejects an inactive V2 forged root before the root can be discarded", () => {
    const current = structuredClone(runEmpty(FIXED_FREEZE_BROKEN));
    const forged = current as unknown as {
      runManifest: {
        freezeBrokenAttackRoot: { contentHash: string };
      };
    };
    forged.runManifest.freezeBrokenAttackRoot.contentHash = `sha256:${"0".repeat(64)}`;

    expect(() =>
      projectSimulationResultV152ToV151(
        forged as unknown as SimulationResultForV152,
      ),
    ).toThrow(/freeze broken|root|contentHash/i);
  });

  it("does not mutate the validated V1.52 source", () => {
    const current = runEmpty(FIXED_FREEZE_BROKEN);
    const before = structuredClone(current);

    projectSimulationResultV152ToV151(current);
    expect(current).toEqual(before);
    expect(current.runManifest.freezeBrokenAttackRoot).toEqual(
      GCSIM_FREEZE_BROKEN_ATTACK_POLICY_V2_ROOT,
    );
  });

  it("preserves authored key order in unchanged historical nested wires", () => {
    const current = runNaturalExpiry(LEGACY_FREEZE_BROKEN);
    const projected = projectSimulationResultV152ToV151(current);
    const currentApplication = current.elementalApplicationIcdLog[0]!;
    const projectedApplication = projected.elementalApplicationIcdLog[0]!;

    expect(Object.keys(projectedApplication)).toEqual(
      Object.keys(currentApplication),
    );
  });
});
