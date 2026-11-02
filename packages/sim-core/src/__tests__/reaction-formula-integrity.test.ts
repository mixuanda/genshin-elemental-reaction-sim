import {
  assertTrustedSimulationResult,
  createSimulationConfigHash,
  createSimulationReproducibilityKey,
  simulationResultSchema,
  type SimulationResult,
  type SimConfig,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function immuneTarget(
  initialAura: "cryo" | "pyro" | "electro" | "dendro",
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
        initialAura: [{ element: initialAura, gaugeUnits: 1 }],
      },
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
          hitConfirm: "normal",
        },
      },
    ],
  };
}

function makeOneHitConfig(
  element: "pyro" | "electro",
  initialAura: "cryo" | "pyro",
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
      reactionBonus: 0.2,
    },
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
                icd: { mode: "no-icd-v1" },
              },
            },
          ],
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "source",
          abilityId: "formula-hit",
        },
      ],
    },
  });
}

function makeAdditiveConfig(reaction: "aggravate" | "spread"): SimConfig {
  const base = makeConfig();
  const element: "electro" | "dendro" =
    reaction === "aggravate" ? "electro" : "dendro";
  const initialAura = reaction === "aggravate" ? "dendro" : "electro";
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
      reactionBonus: 0.2,
    },
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
              icd: { mode: "no-icd-v1" as const },
            },
          })),
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "source",
          abilityId: "additive-formula-hits",
        },
      ],
    },
  });
}

function cloneResult(result: SimulationResult): SimulationResult {
  const cloned = structuredClone(result);
  cloned.hitEvents = cloned.damageEvents;
  return cloned;
}

function refreshReproducibilityIdentity(
  result: SimulationResult,
  configChanged = false,
): void {
  if (configChanged) {
    result.runManifest.configHash = createSimulationConfigHash(result.config);
  }
  const { reproducibilityKey: _ignoredReproducibilityKey, ...identity } =
    result.runManifest;
  const key = createSimulationReproducibilityKey(identity);
  result.runManifest.reproducibilityKey = key;
  result.reproducibilityKey = key;
}

function expectFormulaRejection(
  result: SimulationResult,
  trustedMessage: RegExp,
): void {
  expect(simulationResultSchema.safeParse(result).success).toBe(false);
  expect(() => assertTrustedSimulationResult(result)).toThrow(trustedMessage);
}

function updatePotentialDamage(
  result: SimulationResult,
  damageEventId: number,
  potentialDamage: number,
): void {
  const event = result.damageEvents[damageEventId]!;
  const previousPotentialDamage = event.potentialDamage;
  event.potentialDamage = potentialDamage;
  result.hitResolutionLog[event.targetResolutionId]!.potentialDamage =
    potentialDamage;
  const targetSummary = result.targetSummaries.find(
    (summary) => summary.targetId === event.targetId,
  )!;
  targetSummary.potentialDamage += potentialDamage - previousPotentialDamage;
}

function damageFormulaMultiplier(
  event: SimulationResult["damageEvents"][number],
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
    const result = simulate(makeOneHitConfig("pyro", "cryo"), {
      critMode: "noCrit",
    });

    expect(result.totalDamage).toBe(0);
    const melt = result.damageEvents.find(event => event.reaction === "melt")!;
    // Independent no-crit potential: ATK 1000, DEF .5, RES .9, EM 100,
    // reaction bonus .2 and forward Melt base 2; target immunity applies last.
    expect(melt.potentialDamage).toBeCloseTo(1000 * .5 * .9 * 2 * (1 + 2.78 * 100 / 1500 + .2), 10);
    expect(simulationResultSchema.parse(result)).toEqual(result);
    expect(assertTrustedSimulationResult(result)).toBe(result);
  });

  it("rejects a coordinated Superconduct level-base rewrite", () => {
    const result = cloneResult(
      simulate(makeOneHitConfig("electro", "cryo"), {
        critMode: "noCrit",
      }),
    );
    const event = result.damageEvents.find(
      (candidate) =>
        candidate.kind === "transformative-reaction" &&
        candidate.reaction === "superconduct",
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
      factors.preResistanceDamage * damageFormulaMultiplier(event),
    );

    expectFormulaRejection(result, /levelBaseDamage/);
  });

  it("rejects a coordinated Melt base rewrite", () => {
    const result = cloneResult(
      simulate(makeOneHitConfig("pyro", "cryo"), {
        critMode: "noCrit",
      }),
    );
    const event = result.damageEvents.find(
      (candidate) =>
        candidate.kind === "direct" && candidate.reaction === "melt",
    )!;
    expect(event.targetDamageMultiplier).toBe(0);

    event.damageFactors.reactionBase = 20;
    event.reactionBase = 20;
    event.damageFactors.amplifyingReactionMultiplier =
      20 *
      (1 +
        event.damageFactors.elementalMasteryBonus +
        event.damageFactors.reactionBonus);
    event.reactionFactor = event.damageFactors.amplifyingReactionMultiplier;
    updatePotentialDamage(
      result,
      event.id,
      event.damageFactors.baseDamage * damageFormulaMultiplier(event),
    );

    expectFormulaRejection(result, /reactionBase/);
  });

  it.each([
    {
      reaction: "aggravate" as const,
      forgedField: "levelBaseDamage" as const,
    },
    {
      reaction: "spread" as const,
      forgedField: "baseMultiplier" as const,
    },
  ])(
    "rejects a coordinated $reaction $forgedField rewrite",
    ({ reaction, forgedField }) => {
      const result = cloneResult(
        simulate(makeAdditiveConfig(reaction), {
          critMode: "noCrit",
        }),
      );
      const event = result.damageEvents.find(
        (candidate) =>
          candidate.kind === "direct" && candidate.reaction === reaction,
      )!;
      expect(event.targetDamageMultiplier).toBe(0);
      const factors = event.additiveReactionFactors!;
      const previousAppliedFlatDamage = factors.appliedFlatDamage;
      const ordinaryFlatDamage =
        event.damageFactors.flatDamage - previousAppliedFlatDamage;

      factors[forgedField] *= 10;
      factors.flatDamage =
        factors.levelBaseDamage *
        factors.baseMultiplier *
        (1 + factors.elementalMasteryBonus + factors.reactionBonus);
      factors.appliedFlatDamage = factors.flatDamage;
      event.damageFactors.flatDamage =
        ordinaryFlatDamage + factors.appliedFlatDamage;
      event.flat = event.damageFactors.flatDamage;
      event.damageFactors.baseDamage =
        event.damageFactors.scaling * event.damageFactors.scalingValue +
        event.damageFactors.flatDamage;
      event.baseDamage = event.damageFactors.baseDamage;
      updatePotentialDamage(
        result,
        event.id,
        event.damageFactors.baseDamage * damageFormulaMultiplier(event),
      );

      // Historical V144 acceptance/rejection is checked against immutable
      // original wires in reaction-formula-legacy-v144.test.ts.
      expectFormulaRejection(result, new RegExp(forgedField));
    },
  );

  it.each([
    ["contentHash", "sha256:" + "0".repeat(64)],
    ["sourceRevision", "0".repeat(40)],
    ["mechanicsDataStatus", "verified"],
    ["officialServerTruth", true],
    ["completeGcsimParity", true],
  ] as const)(
    "rejects a re-keyed formula-root %s forgery",
    (field, forgedValue) => {
      const result = cloneResult(
        simulate(makeOneHitConfig("pyro", "cryo"), {
          critMode: "noCrit",
        }),
      );
      const root = result.runManifest.reactionFormulaRoot as unknown as Record<
        string,
        unknown
      >;
      root[field] = forgedValue;
      refreshReproducibilityIdentity(result);

      expectFormulaRejection(result, /reactionFormulaRoot/);
    },
  );

  it("rejects a config/profile forgery even when root and hashes agree with it", () => {
    const result = cloneResult(
      simulate(makeOneHitConfig("pyro", "cryo"), {
        critMode: "noCrit",
      }),
    );
    const forgedProfileId = "attacker-controlled-profile";
    const configModel = result.config.reactionFormulaModel as unknown as Record<
      string,
      unknown
    >;
    const root = result.runManifest.reactionFormulaRoot as unknown as Record<
      string,
      unknown
    >;
    configModel.profileId = forgedProfileId;
    root.profileId = forgedProfileId;
    refreshReproducibilityIdentity(result, true);

    expectFormulaRejection(result, /reactionFormula/);
  });
});
