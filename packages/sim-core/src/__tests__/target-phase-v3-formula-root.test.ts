import {
  BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
  REACTION_FORMULA_ROOT_ENGINE_VERSION,
  REACTION_FORMULA_ROOT_SCHEMA_VERSION,
  targetPhaseV3ResultReferencesSchema,
  type SimConfig,
  type SimulationResult
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

type MutableIdentity = {
  schemaVersion: string;
  engineVersion: string;
  config: {
    schemaVersion: string;
    engineVersion: string;
  };
};

const DIRECT_GEOMETRY = {
  kind: "circle" as const,
  coordinateSpace: "world" as const,
  origin: { x: 0, y: 0 },
  radius: 0
};

function makeFormulaRootTargetPhaseV3Config(): SimConfig {
  const base = makeConfig();
  return makeConfig({
    dataVersion: "target-phase-v3-formula-root",
    randomSeed: "target-phase-v3-formula-root",
    meta: {
      name: "Target phase v3 formula-root identity vector",
      version: REACTION_FORMULA_ROOT_SCHEMA_VERSION,
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
          name: "Burning owner",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [{ element: "dendro", gaugeUnits: 1 }]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "pyro",
        name: "Pyro",
        element: "pyro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 0,
          em: 100,
          reactionBonus: 0.2
        }
      }
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v9" },
    targetClockModel: { mode: "disabled" },
    targetTaskModel: { mode: "target-phase-v3" },
    reactionDeliveryModel: { mode: "deferred-event-heap-v1" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "pyro",
      swapFrames: 1,
      abilities: [
        {
          id: "start-burning",
          actorId: "pyro",
          name: "Start Burning",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "start-burning-hit",
              label: "Start Burning hit",
              frame: 0,
              scaling: 0,
              element: "pyro",
              geometry: DIRECT_GEOMETRY,
              application: {
                gaugeUnits: 1,
                icdTag: "start-burning",
                icdGroup: "no-icd"
              }
            }
          ]
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "pyro",
          abilityId: "start-burning",
          atFrame: 0
        }
      ]
    }
  });
}

function cloneWithIdentity(
  result: SimulationResult,
  resultIdentity: { schemaVersion: string; engineVersion: string },
  configIdentity = resultIdentity
): SimulationResult {
  const clone = structuredClone(result);
  const mutable = clone as unknown as MutableIdentity;
  mutable.schemaVersion = resultIdentity.schemaVersion;
  mutable.engineVersion = resultIdentity.engineVersion;
  mutable.config.schemaVersion = configIdentity.schemaVersion;
  mutable.config.engineVersion = configIdentity.engineVersion;
  return clone;
}

describe("target-phase-v3 formula-root identity", () => {
  it("accepts exact 1.45 and preserves the exact 1.44 callback semantics", () => {
    const current = simulate(makeFormulaRootTargetPhaseV3Config(), {
      critMode: "noCrit"
    });

    expect(
      current.targetPhaseLog.some(
        (phase) =>
          phase.model === "target-phase-v3" &&
          phase.targetTasks.some((task) => task.delivery !== null)
      )
    ).toBe(true);
    expect(
      targetPhaseV3ResultReferencesSchema.safeParse(current).success
    ).toBe(true);

    const exactV144 = cloneWithIdentity(current, {
      schemaVersion: BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
      engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION
    });
    expect(
      targetPhaseV3ResultReferencesSchema.safeParse(exactV144).success
    ).toBe(true);
  });

  it.each([
    {
      label: "mixed result and config generations",
      resultIdentity: {
        schemaVersion: REACTION_FORMULA_ROOT_SCHEMA_VERSION,
        engineVersion: REACTION_FORMULA_ROOT_ENGINE_VERSION
      },
      configIdentity: {
        schemaVersion: BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
        engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION
      }
    },
    {
      label: "mixed schema and engine generations",
      resultIdentity: {
        schemaVersion: REACTION_FORMULA_ROOT_SCHEMA_VERSION,
        engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION
      },
      configIdentity: {
        schemaVersion: REACTION_FORMULA_ROOT_SCHEMA_VERSION,
        engineVersion: REACTION_FORMULA_ROOT_ENGINE_VERSION
      }
    },
    {
      label: "unknown matching identity",
      resultIdentity: {
        schemaVersion: "9.9.9",
        engineVersion: "9.9.9-unknown"
      },
      configIdentity: {
        schemaVersion: "9.9.9",
        engineVersion: "9.9.9-unknown"
      }
    }
  ])("fails closed for $label", ({ resultIdentity, configIdentity }) => {
    const current = simulate(makeFormulaRootTargetPhaseV3Config(), {
      critMode: "noCrit"
    });
    const forged = cloneWithIdentity(
      current,
      resultIdentity,
      configIdentity
    );

    const parsed = targetPhaseV3ResultReferencesSchema.safeParse(forged);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((issue) =>
          issue.message.includes("exact 1.44 or 1.45")
        )
      ).toBe(true);
    }
  });
});
