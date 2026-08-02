import {
  BURNING_CALLBACK_DELIVERY_ENGINE_VERSION,
  BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION,
  LEGACY_SIMULATION_RUN_MANIFEST_VERSION,
  assertTrustedSimulationResultV144,
  assertTrustedSimulationResult,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  simulationResultV144Schema,
  simulationResultSchema,
  type SimulationResult,
  type SimConfig
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function immuneTarget(
  initialAura: "cryo" | "pyro" | "electro" | "dendro"
): SimConfig["enemy"] {
  return {
    level: 90,
    resistance: 0.1,
    defReduction: 0,
    targets: [
      {
        id: "enemy-0",
        name: "Formula proof target",
        position: { x: 0, y: 0 },
        initialAura: [{ element: initialAura, gaugeUnits: 1 }]
      }
    ],
    targetPhases: [
      {
        id: "formula-proof-damage-immunity",
        label: "Formula proof damage immunity",
        targetId: "enemy-0",
        startFrame: 0,
        endFrame: 90,
        reason: "FORMULA_PROOF_ZERO_TOTAL",
        effects: {
          damage: "immune",
          aura: "normal",
          hitConfirm: "normal"
        }
      }
    ]
  };
}

function makeOneHitConfig(
  element: "pyro" | "electro",
  initialAura: "cryo" | "pyro"
): SimConfig {
  const base = makeConfig();
  const source = {
    ...base.characters[0]!,
    id: "source",
    name: "Formula Source",
    element,
    level: 90,
    stats: {
      ...neutralStats,
      baseAtk: 1000,
      em: 100,
      reactionBonus: 0.2
    }
  };
  return makeConfig({
    duration: 1.5,
    cycleLength: 2,
    enemy: immuneTarget(initialAura),
    characters: [source],
    rotation: [],
    reactionEngine: { mode: "aura-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "source",
      swapFrames: 12,
      abilities: [
        {
          id: "formula-hit",
          actorId: "source",
          name: "Formula Hit",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "formula-hit-0",
              label: "Formula Hit",
              frame: 0,
              scaling: 1,
              element,
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
          actorId: "source",
          abilityId: "formula-hit"
        }
      ]
    }
  });
}

function makeAdditiveConfig(
  reaction: "aggravate" | "spread"
): SimConfig {
  const base = makeConfig();
  const element: "electro" | "dendro" =
    reaction === "aggravate" ? "electro" : "dendro";
  const initialAura =
    reaction === "aggravate" ? "dendro" : "electro";
  const source = {
    ...base.characters[0]!,
    id: "source",
    name: "Additive Formula Source",
    element,
    level: 90,
    stats: {
      ...neutralStats,
      baseAtk: 1000,
      em: 100,
      reactionBonus: 0.2
    }
  };
  return makeConfig({
    duration: 1.5,
    cycleLength: 2,
    enemy: immuneTarget(initialAura),
    characters: [source],
    rotation: [],
    reactionEngine: { mode: "aura-v3" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "source",
      swapFrames: 12,
      abilities: [
        {
          id: "additive-formula-hits",
          actorId: "source",
          name: "Additive Formula Hits",
          kind: "skill",
          cancelFrame: 2,
          animationEndFrame: 2,
          cooldownFrames: 0,
          hits: [0, 1].map((frame) => ({
            id: `additive-formula-${frame}`,
            label: `Additive Formula ${frame}`,
            frame,
            scaling: 1,
            element,
            application: {
              gaugeUnits: 1,
              icd: { mode: "no-icd-v1" as const }
            }
          }))
        }
      ],
      commands: [
        {
          type: "skill",
          actorId: "source",
          abilityId: "additive-formula-hits"
        }
      ]
    }
  });
}

function cloneResult(result: SimulationResult): SimulationResult {
  const cloned = structuredClone(result);
  cloned.hitEvents = cloned.damageEvents;
  return cloned;
}

function projectApplicationsToFrozenWire(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(projectApplicationsToFrozenWire);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.gaugeUnits === "number" &&
    record.icd !== null &&
    typeof record.icd === "object"
  ) {
    const icd = record.icd as Record<string, unknown>;
    if (icd.mode === "legacy-boolean-profile-v1") {
      return {
        gaugeUnits: record.gaugeUnits,
        icdTag: icd.icdTag,
        icdGroup: icd.profileId
      };
    }
    return {
      gaugeUnits: record.gaugeUnits,
      icdTag:
        icd.mode === "fixed-gcsim-application-v1"
          ? icd.icdTag
          : "__no_icd_v1__",
      icdGroup: "no-icd"
    };
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [
      key,
      projectApplicationsToFrozenWire(entry)
    ])
  );
}

function refreshReproducibilityIdentity(
  result: SimulationResult,
  configChanged = false
): void {
  if (configChanged) {
    result.runManifest.configHash =
      createSimulationConfigHash(result.config);
  }
  const {
    reproducibilityKey: _ignoredReproducibilityKey,
    ...identity
  } = result.runManifest;
  const key = createSimulationReproducibilityKey(identity);
  result.runManifest.reproducibilityKey = key;
  result.reproducibilityKey = key;
}

function expectFormulaRejection(
  result: SimulationResult,
  trustedMessage: RegExp
): void {
  expect(simulationResultSchema.safeParse(result).success).toBe(
    false
  );
  expect(() =>
    assertTrustedSimulationResult(result)
  ).toThrow(trustedMessage);
}

function projectToFrozenV144(result: SimulationResult): unknown {
  const frozen = structuredClone(result) as unknown as Record<
    string,
    unknown
  >;
  frozen.schemaVersion =
    BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION;
  frozen.engineVersion =
    BURNING_CALLBACK_DELIVERY_ENGINE_VERSION;
  delete frozen.directDamageGroupLog;
  delete frozen.elementalApplicationIcdLog;
  for (const collectionName of ["damageEvents", "hitEvents"] as const) {
    const collection = frozen[collectionName];
    if (!Array.isArray(collection)) continue;
    for (const entry of collection) {
      if (entry !== null && typeof entry === "object") {
        delete (entry as Record<string, unknown>)
          .elementalApplicationIcdLogId;
      }
    }
  }
  const hitResolutionLog = frozen.hitResolutionLog;
  if (Array.isArray(hitResolutionLog)) {
    for (const entry of hitResolutionLog) {
      if (entry === null || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      delete record.reactionDamageLogId;
      delete record.elementalApplicationIcdLogId;
    }
  }
  const reactionDamageLog = frozen.reactionDamageLog;
  if (Array.isArray(reactionDamageLog)) {
    for (const entry of reactionDamageLog) {
      if (entry === null || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      delete record.hitResolutionLogIds;
      delete record.elementalApplicationIcdLogIds;
    }
  }
  const targetPhaseLog = frozen.targetPhaseLog;
  if (Array.isArray(targetPhaseLog)) {
    for (const phase of targetPhaseLog) {
      if (phase === null || typeof phase !== "object") continue;
      const targetTasks = (phase as Record<string, unknown>)
        .targetTasks;
      if (!Array.isArray(targetTasks)) continue;
      for (const task of targetTasks) {
        if (task === null || typeof task !== "object") continue;
        const delivery = (task as Record<string, unknown>).delivery;
        if (delivery === null || typeof delivery !== "object") continue;
        const attempts = (delivery as Record<string, unknown>).attempts;
        if (!Array.isArray(attempts)) continue;
        for (const attempt of attempts) {
          if (attempt !== null && typeof attempt === "object") {
            delete (attempt as Record<string, unknown>)
              .elementalApplicationIcdLogId;
          }
        }
      }
    }
  }
  const config = projectApplicationsToFrozenWire(
    frozen.config
  ) as Record<string, unknown>;
  frozen.config = config;
  config.schemaVersion = BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION;
  config.engineVersion = BURNING_CALLBACK_DELIVERY_ENGINE_VERSION;
  delete config.reactionFormulaModel;
  delete config.directDamageGroupModel;
  delete config.elementalApplicationIcdModel;
  delete config.reactionOwnedElementalApplicationModel;
  const manifest = frozen.runManifest as Record<string, unknown>;
  manifest.version = LEGACY_SIMULATION_RUN_MANIFEST_VERSION;
  manifest.schemaVersion = BURNING_CALLBACK_DELIVERY_SCHEMA_VERSION;
  manifest.engineVersion = BURNING_CALLBACK_DELIVERY_ENGINE_VERSION;
  delete manifest.reactionFormulaRoot;
  delete manifest.directDamageGroupRoot;
  delete manifest.elementalApplicationIcdRoot;
  delete manifest.reactionOwnedElementalApplicationRoot;
  manifest.configHash = createSimulationConfigHash(config);
  const {
    reproducibilityKey: _ignoredReproducibilityKey,
    ...identity
  } = manifest;
  const key = createSimulationReproducibilityKey(
    identity as Parameters<
      typeof createSimulationReproducibilityKey
    >[0]
  );
  manifest.reproducibilityKey = key;
  frozen.reproducibilityKey = key;
  return frozen;
}

function expectFrozenV144Accepts(
  currentResult: SimulationResult
): void {
  const parsed = simulationResultV144Schema.parse(
    projectToFrozenV144(currentResult)
  );
  expect(
    assertTrustedSimulationResultV144(
      parsed as unknown as SimulationResult
    )
  ).toBe(parsed);
}

function updatePotentialDamage(
  result: SimulationResult,
  damageEventId: number,
  potentialDamage: number
): void {
  const event = result.damageEvents[damageEventId]!;
  const previousPotentialDamage = event.potentialDamage;
  event.potentialDamage = potentialDamage;
  result.hitResolutionLog[
    event.targetResolutionId
  ]!.potentialDamage = potentialDamage;
  const targetSummary = result.targetSummaries.find(
    (summary) => summary.targetId === event.targetId
  )!;
  targetSummary.potentialDamage +=
    potentialDamage - previousPotentialDamage;
}

function damageFormulaMultiplier(
  event: SimulationResult["damageEvents"][number]
): number {
  const factors = event.damageFactors;
  return (
    factors.damageBonusMultiplier *
    factors.defenseMultiplier *
    factors.resistanceMultiplier *
    factors.critMultiplier *
    factors.amplifyingReactionMultiplier *
    factors.groupMultiplier
  );
}

describe("current SimulationResult reaction-formula root integrity", () => {
  it("accepts exact current results at both public and trusted boundaries", () => {
    const result = simulate(
      makeOneHitConfig("pyro", "cryo"),
      { critMode: "noCrit" }
    );

    expect(simulationResultSchema.parse(result)).toEqual(result);
    expect(assertTrustedSimulationResult(result)).toBe(result);
    expectFrozenV144Accepts(result);
  });

  it("rejects a coordinated Superconduct level-base rewrite", () => {
    const result = cloneResult(
      simulate(makeOneHitConfig("electro", "cryo"), {
        critMode: "noCrit"
      })
    );
    const event = result.damageEvents.find(
      (candidate) =>
        candidate.kind === "transformative-reaction" &&
        candidate.reaction === "superconduct"
    )!;
    expect(event.targetDamageMultiplier).toBe(0);
    const factors = event.transformativeReactionFactors!;

    factors.levelBaseDamage *= 10;
    factors.preResistanceDamage =
      factors.levelBaseDamage *
      factors.baseMultiplier *
      (1 + factors.elementalMasteryBonus + factors.reactionBonus);
    event.damageFactors.baseDamage = factors.preResistanceDamage;
    event.baseDamage = factors.preResistanceDamage;
    updatePotentialDamage(
      result,
      event.id,
      factors.preResistanceDamage * damageFormulaMultiplier(event)
    );

    // This is a deliberately frozen 1.44 limitation, not a claim that the
    // forged formula is trustworthy. The current boundary must reject it.
    expectFrozenV144Accepts(result);
    expectFormulaRejection(result, /levelBaseDamage/);
  });

  it("rejects a coordinated Melt base rewrite", () => {
    const result = cloneResult(
      simulate(makeOneHitConfig("pyro", "cryo"), {
        critMode: "noCrit"
      })
    );
    const event = result.damageEvents.find(
      (candidate) =>
        candidate.kind === "direct" && candidate.reaction === "melt"
    )!;
    expect(event.targetDamageMultiplier).toBe(0);

    event.damageFactors.reactionBase = 20;
    event.reactionBase = 20;
    event.damageFactors.amplifyingReactionMultiplier =
      20 *
      (1 +
        event.damageFactors.elementalMasteryBonus +
        event.damageFactors.reactionBonus);
    event.reactionFactor =
      event.damageFactors.amplifyingReactionMultiplier;
    updatePotentialDamage(
      result,
      event.id,
      event.damageFactors.baseDamage * damageFormulaMultiplier(event)
    );

    // This is a deliberately frozen 1.44 limitation, not a claim that the
    // forged formula is trustworthy. The current boundary must reject it.
    expectFrozenV144Accepts(result);
    expectFormulaRejection(result, /reactionBase/);
  });

  it.each([
    {
      reaction: "aggravate" as const,
      forgedField: "levelBaseDamage" as const
    },
    {
      reaction: "spread" as const,
      forgedField: "baseMultiplier" as const
    }
  ])(
    "rejects a coordinated $reaction $forgedField rewrite",
    ({ reaction, forgedField }) => {
      const result = cloneResult(
        simulate(makeAdditiveConfig(reaction), {
          critMode: "noCrit"
        })
      );
      const event = result.damageEvents.find(
        (candidate) =>
          candidate.kind === "direct" &&
          candidate.reaction === reaction
      )!;
      expect(event.targetDamageMultiplier).toBe(0);
      const factors = event.additiveReactionFactors!;
      const previousAppliedFlatDamage =
        factors.appliedFlatDamage;
      const ordinaryFlatDamage =
        event.damageFactors.flatDamage -
        previousAppliedFlatDamage;

      factors[forgedField] *= 10;
      factors.flatDamage =
        factors.levelBaseDamage *
        factors.baseMultiplier *
        (1 +
          factors.elementalMasteryBonus +
          factors.reactionBonus);
      factors.appliedFlatDamage = factors.flatDamage;
      event.damageFactors.flatDamage =
        ordinaryFlatDamage + factors.appliedFlatDamage;
      event.flat = event.damageFactors.flatDamage;
      event.damageFactors.baseDamage =
        event.damageFactors.scaling *
          event.damageFactors.scalingValue +
        event.damageFactors.flatDamage;
      event.baseDamage = event.damageFactors.baseDamage;
      updatePotentialDamage(
        result,
        event.id,
        event.damageFactors.baseDamage * damageFormulaMultiplier(event)
      );

      if (forgedField === "levelBaseDamage") {
        expectFrozenV144Accepts(result);
      } else {
        // The additive 1.15/1.25 multipliers were already fixed in the
        // frozen 1.44 proof; current now derives the same value from the root.
        expect(
          simulationResultV144Schema.safeParse(
            projectToFrozenV144(result)
          ).success
        ).toBe(false);
      }
      expectFormulaRejection(result, new RegExp(forgedField));
    }
  );

  it.each([
    ["contentHash", "sha256:" + "0".repeat(64)],
    ["sourceRevision", "0".repeat(40)],
    ["mechanicsDataStatus", "verified"],
    ["officialServerTruth", true],
    ["completeGcsimParity", true]
  ] as const)(
    "rejects a re-keyed formula-root %s forgery",
    (field, forgedValue) => {
      const result = cloneResult(
        simulate(makeOneHitConfig("pyro", "cryo"), {
          critMode: "noCrit"
        })
      );
      const root = result.runManifest
        .reactionFormulaRoot as unknown as Record<string, unknown>;
      root[field] = forgedValue;
      refreshReproducibilityIdentity(result);

      expectFormulaRejection(result, /reactionFormulaRoot/);
    }
  );

  it("rejects a config/profile forgery even when root and hashes agree with it", () => {
    const result = cloneResult(
      simulate(makeOneHitConfig("pyro", "cryo"), {
        critMode: "noCrit"
      })
    );
    const forgedProfileId = "attacker-controlled-profile";
    const configModel = result.config
      .reactionFormulaModel as unknown as Record<string, unknown>;
    const root = result.runManifest
      .reactionFormulaRoot as unknown as Record<string, unknown>;
    configModel.profileId = forgedProfileId;
    root.profileId = forgedProfileId;
    refreshReproducibilityIdentity(result, true);

    expectFormulaRejection(result, /reactionFormula/);
  });
});
