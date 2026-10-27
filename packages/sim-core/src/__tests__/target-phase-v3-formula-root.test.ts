import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
  DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
  ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION,
  ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
  REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION,
  REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
  REACTION_FORMULA_ROOT_ENGINE_VERSION,
  REACTION_FORMULA_ROOT_SCHEMA_VERSION,
  assertTrustedSimulationResult,
  simulationResultSchema,
  targetPhaseV3ResultReferencesSchema,
  type SimConfig,
  type SimulationResult,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { projectSimulationResultV150ToV149 } from "../../../test-vectors/src/project-v150-to-v149";
import { projectSimulationResultV151ToV150 } from "../../../test-vectors/src/project-v151-to-v150";
import { projectSimulationResultV152ToV151 } from "../../../test-vectors/src/project-v152-to-v151";
import { projectSimulationResultV153ToV152 } from "../../../test-vectors/src/project-v153-to-v152";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const historicalBytes = readFileSync(new URL("../../../test-vectors/src/fixtures/historical-target-phase-formula-v153-84ff5cd.json", import.meta.url));
const historicalArchive = JSON.parse(historicalBytes.toString("utf8")) as {
  fixtureVersion: string; source: { commit: string };
  cases: Array<{ caseId: string; sourceWireSha256: string; sourceWireText: string }>;
};
const sha256 = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function historicalTargetPhase(): SimulationResult {
  const row = historicalArchive.cases.find(candidate => candidate.caseId === "target-phase-v3");
  if (!row) throw new Error("Missing pinned historical target-phase input");
  expect(sha256(row.sourceWireText)).toBe(row.sourceWireSha256);
  const result = JSON.parse(row.sourceWireText) as SimulationResult;
  expect(result.schemaVersion).toBe("1.53.0");
  expect(result.targetPhaseLog.some(phase => phase.model === "target-phase-v3" && phase.targetTasks.some(task => task.delivery !== null))).toBe(true);
  expect(result.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(result.runManifest.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(simulationResultSchema.parse(result)).toEqual(result);
  expect(assertTrustedSimulationResult(result)).toBe(result);
  return result;
}

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
  radius: 0,
};

function makeFormulaRootTargetPhaseV3Config(): SimConfig {
  const base = makeConfig();
  return makeConfig({
    dataVersion: "target-phase-v3-formula-root",
    randomSeed: "target-phase-v3-formula-root",
    meta: {
      name: "Target phase v3 formula-root identity vector",
      version: REACTION_FORMULA_ROOT_SCHEMA_VERSION,
      verificationStatus: "provisional",
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
          initialAura: [{ element: "dendro", gaugeUnits: 1 }],
        },
      ],
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
          reactionBonus: 0.2,
        },
      },
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
                icd: { mode: "no-icd-v1" },
              },
            },
          ],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "pyro",
          abilityId: "start-burning",
          atFrame: 0,
        },
      ],
    },
  });
}

function cloneWithIdentity(
  result: SimulationResult,
  resultIdentity: { schemaVersion: string; engineVersion: string },
  configIdentity = resultIdentity,
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
  it("pins historical phase input and refuses current canonical semantics without mutation", () => {
    expect(sha256(historicalBytes)).toBe("e9b5c86a1bd59f5e059b3fad8d0a91abba9ba93f36004a1c66e982c08750d5a8");
    expect(historicalArchive.fixtureVersion).toBe("historical-target-phase-formula-v153-84ff5cd-v1");
    expect(historicalArchive.source.commit).toBe("84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5");
    expect(historicalArchive.cases.map(row => row.caseId)).toEqual(["target-phase-v3"]);
    const current = simulate(makeFormulaRootTargetPhaseV3Config(), { critMode: "noCrit" });
    expect(current.resolvedRuntimeOptions.flatStatBuffSemantics).toBe("canonical-v1");
    const before = JSON.stringify(current);
    expect(() => projectSimulationResultV153ToV152(current)).toThrow(/flatStatBuffSemantics/);
    expect(JSON.stringify(current)).toBe(before);
  });

  it("accepts the current identity and preserves the exact 1.44-1.49 callback semantics", () => {
    const current = simulate(makeFormulaRootTargetPhaseV3Config(), {
      critMode: "noCrit",
    });

    expect(current).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION,
      config: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        engineVersion: CURRENT_ENGINE_VERSION,
      },
    });

    expect(
      current.targetPhaseLog.some(
        (phase) =>
          phase.model === "target-phase-v3" &&
          phase.targetTasks.some((task) => task.delivery !== null),
      ),
    ).toBe(true);
    expect(simulationResultSchema.safeParse(current).success).toBe(true);
    const frozenV149Facet = projectSimulationResultV150ToV149(
      projectSimulationResultV151ToV150(
        projectSimulationResultV152ToV151(
          projectSimulationResultV153ToV152(historicalTargetPhase()),
        ),
      ),
    );
    expect(
      targetPhaseV3ResultReferencesSchema.safeParse(frozenV149Facet).success,
    ).toBe(true);

    const exactV144 = cloneWithIdentity(current, {
      schemaVersion: BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
      engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
    });
    expect(
      targetPhaseV3ResultReferencesSchema.safeParse(exactV144).success,
    ).toBe(true);

    const exactV145 = cloneWithIdentity(current, {
      schemaVersion: REACTION_FORMULA_ROOT_SCHEMA_VERSION,
      engineVersion: REACTION_FORMULA_ROOT_ENGINE_VERSION,
    });
    expect(
      targetPhaseV3ResultReferencesSchema.safeParse(exactV145).success,
    ).toBe(true);

    const exactV146 = cloneWithIdentity(current, {
      schemaVersion: DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
      engineVersion: DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
    });
    expect(
      targetPhaseV3ResultReferencesSchema.safeParse(exactV146).success,
    ).toBe(true);

    const exactV147 = cloneWithIdentity(current, {
      schemaVersion: ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
      engineVersion: ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION,
    });
    expect(
      targetPhaseV3ResultReferencesSchema.safeParse(exactV147).success,
    ).toBe(true);

    const exactV148 = cloneWithIdentity(current, {
      schemaVersion: REACTION_OWNED_APPLICATION_ROOT_SCHEMA_VERSION,
      engineVersion: REACTION_OWNED_APPLICATION_ROOT_ENGINE_VERSION,
    });
    expect(
      targetPhaseV3ResultReferencesSchema.safeParse(exactV148).success,
    ).toBe(true);
  });

  it.each([
    {
      label: "mixed result and config generations",
      resultIdentity: {
        schemaVersion: REACTION_FORMULA_ROOT_SCHEMA_VERSION,
        engineVersion: REACTION_FORMULA_ROOT_ENGINE_VERSION,
      },
      configIdentity: {
        schemaVersion: BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
        engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
      },
    },
    {
      label: "mixed schema and engine generations",
      resultIdentity: {
        schemaVersion: REACTION_FORMULA_ROOT_SCHEMA_VERSION,
        engineVersion: BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
      },
      configIdentity: {
        schemaVersion: REACTION_FORMULA_ROOT_SCHEMA_VERSION,
        engineVersion: REACTION_FORMULA_ROOT_ENGINE_VERSION,
      },
    },
    {
      label: "unknown matching identity",
      resultIdentity: {
        schemaVersion: "9.9.9",
        engineVersion: "9.9.9-unknown",
      },
      configIdentity: {
        schemaVersion: "9.9.9",
        engineVersion: "9.9.9-unknown",
      },
    },
    {
      label: "mixed current result and frozen config generations",
      resultIdentity: {
        schemaVersion: REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
        engineVersion: REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
      },
      configIdentity: {
        schemaVersion: ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
        engineVersion: ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION,
      },
    },
    {
      label: "mixed current schema and frozen engine generations",
      resultIdentity: {
        schemaVersion: REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
        engineVersion: ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION,
      },
      configIdentity: {
        schemaVersion: REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
        engineVersion: ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION,
      },
    },
  ])("fails closed for $label", ({ resultIdentity, configIdentity }) => {
    const current = simulate(makeFormulaRootTargetPhaseV3Config(), {
      critMode: "noCrit",
    });
    const forged = cloneWithIdentity(current, resultIdentity, configIdentity);

    const parsed = targetPhaseV3ResultReferencesSchema.safeParse(forged);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((issue) =>
          issue.message.includes("exact 1.44, 1.45, 1.46, 1.47, 1.48, or 1.49"),
        ),
      ).toBe(true);
    }
  });
});
