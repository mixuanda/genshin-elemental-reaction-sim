import { describe, expect, it } from "vitest";
import type { SimConfig } from "@genshin-dps-lab/schemas";
import { durinMeltPreset } from "@genshin-dps-lab/game-data/presets";
import burningGolden from "../../../test-vectors/fixtures/burning-aura-v4-1.30.golden.json";
import golden from "../../../test-vectors/fixtures/legacy-default-120s.golden.json";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

function makeBurningGoldenConfig(): SimConfig {
  const base = makeConfig();
  return {
    ...base,
    dataVersion: "burning-fixed-gcsim-cross-check-1",
    randomSeed: "burning-aura-v4-golden-seed",
    meta: {
      name: "Burning aura-v4 Golden",
      version: "1.30.0",
      verificationStatus: "provisional"
    },
    duration: 4.1,
    cycleLength: 4.1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "燃烧基线目标",
          position: { x: 0, y: 0 },
          initialAura: [
            {
              element: "dendro",
              gaugeUnits: 2
            }
          ]
        }
      ]
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "pyro",
        name: "Pyro Golden",
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
    reactionEngine: {
      mode: "aura-v4"
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "pyro",
      swapFrames: 12,
      abilities: [
        {
          id: "pyro-skill",
          actorId: "pyro",
          name: "Pyro Golden Skill",
          kind: "skill",
          cancelFrame: 1,
          animationEndFrame: 1,
          cooldownFrames: 0,
          hits: [
            {
              id: "pyro-hit",
              label: "燃烧 Golden 触发命中",
              frame: 0,
              scaling: 1,
              element: "pyro",
              targeting: {
                targetId: "enemy-0",
                outcome: "landed"
              },
              application: {
                gaugeUnits: 1,
                icdTag: "burning-golden",
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
          abilityId: "pyro-skill"
        }
      ]
    }
  };
}

function expectRelativeClose(
  actual: number,
  expected: number,
  tolerance = 1e-8
): void {
  const denominator = Math.max(1, Math.abs(expected));
  expect(Math.abs(actual - expected) / denominator).toBeLessThanOrEqual(
    tolerance
  );
}

describe("Vanilla v0.1 golden compatibility", () => {
  it("matches the full default 120-second baseline", () => {
    const result = simulate(durinMeltPreset, {
      energyMode: "configured",
      critMode: "average",
      compatibilityMode: "legacy-v0.1",
      randomSeed: golden.options.randomSeed
    });

    expectRelativeClose(result.totalDamage, golden.totalDamage);
    expectRelativeClose(result.dps, golden.dps);
    expect(result.actorPoses).toEqual([]);
    expect(result.enemyTargets).toEqual([
      {
        id: "enemy-0",
        name: "敌人 0",
        level: durinMeltPreset.enemy.level,
        resistance: durinMeltPreset.enemy.resistance,
        defReduction: durinMeltPreset.enemy.defReduction,
        freezeResistance: 0,
        initialAura: [],
        position: null,
        hitboxRadius: 0
      }
    ]);
    expect(result.damageEvents).toHaveLength(golden.hitCount);
    expect(result.hitResolutionLog).toHaveLength(golden.hitCount);
    expect(
      result.hitResolutionLog.every(
        (entry, index) =>
          entry.landed &&
          entry.outcome === "landed" &&
          entry.targetId === "enemy-0" &&
          entry.targetName === "敌人 0" &&
          entry.targetingSource === "default" &&
          entry.targetPosition === null &&
          entry.sourceActorPosition === null &&
          entry.sourceActorFacingDegrees === null &&
          entry.geometryKind === null &&
          entry.geometryCoordinateSpace === null &&
          entry.geometryOrigin === null &&
          entry.geometryStart === null &&
          entry.geometryEnd === null &&
          entry.geometryRadius === null &&
          entry.geometryHalfWidth === null &&
          entry.geometryHalfHeight === null &&
          entry.geometryRotationDegrees === null &&
          entry.geometryDirectionDegrees === null &&
          entry.geometryAngleDegrees === null &&
          entry.geometryDistance === null &&
          entry.geometryThreshold === null &&
          entry.targetIndex === 0 &&
          entry.targetCount === 1 &&
          entry.damageEventId === index &&
          entry.hitGroupId === result.damageEvents[index]?.hitGroupId &&
          entry.displayDamage === result.damageEvents[index]?.displayDamage
      )
    ).toBe(true);
    expect(result.targetMotionTimeline).toEqual([]);
    expect(result.auraInitialStates).toEqual([
      {
        targetId: "enemy-0",
        targetName: "敌人 0",
        frame: 0,
        timeSeconds: 0,
        aura: []
      }
    ]);
    expect(result.auraEndStates).toEqual([
      {
        targetId: "enemy-0",
        targetName: "敌人 0",
        frame: 7200,
        timeSeconds: 120,
        aura: []
      }
    ]);
    expect(result.damageCurve).toHaveLength(golden.hitCount);
    expect(
      result.damageCurve.every(
        (point) =>
          point.targetId === "enemy-0" &&
          point.targetName === "敌人 0"
      )
    ).toBe(true);
    expect(result.damageCurve.at(-1)?.cumulativeDamage).toBeCloseTo(
      result.totalDamage,
      8
    );
    expect(result.targetSummaries).toEqual([
      {
        targetId: "enemy-0",
        targetName: "敌人 0",
        damage: result.totalDamage,
        potentialDamage: result.totalDamage,
        damageEvents: golden.hitCount,
        landedChecks: golden.hitCount,
        missedChecks: 0,
        immuneDamageEvents: 0,
        dps: result.dps,
        share: 1
      }
    ]);
    expect(result.reactedHits).toBe(golden.reactedHits);
    expect(result.skippedActions).toHaveLength(golden.skippedActionCount);
    expect(result.burningStateLog).toEqual([]);
    expect(
      result.damageEvents.filter(
        (event) =>
          event.kind === "transformative-reaction" &&
          event.reaction === "burning"
      )
    ).toEqual([]);
    expect(
      result.damageCurve.every(
        (point) =>
          (point.cumulativeByReaction.burning ?? 0) === 0
      )
    ).toBe(true);

    for (const [characterId, expectedDamage] of Object.entries(
      golden.byCharacter
    )) {
      expectRelativeClose(
        result.byCharacter[characterId] ?? 0,
        expectedDamage
      );
    }

    expect(result.bySkill).toHaveLength(golden.bySkill.length);
    golden.bySkill.forEach((expectedSkill, index) => {
      const actualSkill = result.bySkill[index];
      expect(actualSkill?.creditId).toBe(expectedSkill.creditId);
      expect(actualSkill?.actionName).toBe(expectedSkill.actionName);
      expect(actualSkill?.hits).toBe(expectedSkill.hits);
      expectRelativeClose(
        actualSkill?.damage ?? 0,
        expectedSkill.damage
      );
    });

    expect(
      result.skippedActions.map(
        ({ time, actorId, action, reason, cycle }) => ({
          time,
          actorId,
          action,
          reason,
          cycle
        })
      )
    ).toEqual(golden.skippedActions);
  });
});

describe("Burning aura-v4 provisional golden", () => {
  it("matches the fixed-gcsim-code-cross-check lifecycle and damage vector", () => {
    const options = {
      energyMode: "configured" as const,
      critMode: "noCrit" as const,
      compatibilityMode: "legal-frame-v1" as const,
      randomSeed: burningGolden.options.randomSeed
    };
    expect(burningGolden.options).toEqual(options);
    const result = simulate(makeBurningGoldenConfig(), options);

    expect(result.schemaVersion).toBe(
      burningGolden.config.schemaVersion
    );
    expect(result.engineVersion).toBe(
      burningGolden.config.engineVersion
    );
    expect(result.dataVersion).toBe(
      burningGolden.config.dataVersion
    );
    expect(result.reproducibilityKey).toBe(
      burningGolden.reproducibilityKey
    );
    expectRelativeClose(
      result.totalDamage,
      burningGolden.totalDamage
    );
    expectRelativeClose(result.dps, burningGolden.dps);
    expect(result.damageEvents).toHaveLength(
      burningGolden.hitCount
    );
    expect(result.reactedHits).toBe(burningGolden.reactedHits);

    const burningDamageEvents = result.damageEvents.filter(
      (event) =>
        event.kind === "transformative-reaction" &&
        event.reaction === "burning"
    );
    expect(burningDamageEvents).toHaveLength(
      burningGolden.burningDamageEventCount
    );
    expect(
      burningDamageEvents.map((event) => event.frame)
    ).toEqual(burningGolden.cadence.tickFrames);
    expect(
      burningDamageEvents.every(
        (event) =>
          Math.abs(
            event.finalDamage -
              burningGolden.burningDamagePerTick
          ) < 1e-10 &&
          event.sourceActorId ===
            burningGolden.owners.damageSourceActorId &&
          event.creditOwnerId ===
            burningGolden.owners.creditOwnerId
      )
    ).toBe(true);

    expect(
      result.burningStateLog
        .filter((entry) => entry.operation === "tick-skipped")
        .map((entry) => entry.frame)
    ).toEqual(burningGolden.cadence.skippedFrames);
    expect(
      result.burningStateLog.map(({ frame, operation }) => ({
        frame,
        operation
      }))
    ).toEqual(burningGolden.cadence.operationFrames);
    expect(
      result.burningStateLog
        .filter((entry) => entry.operation === "tick")
        .map((entry) => entry.fuelGaugeUnitsAfter)
    ).toEqual(burningGolden.fuel.tickGaugeUnitsAfter);

    const start = result.burningStateLog[0]!;
    const skipped = result.burningStateLog.find(
      (entry) => entry.operation === "tick-skipped"
    )!;
    const finalTick = result.burningStateLog.find(
      (entry) =>
        entry.operation === "tick" &&
        entry.frame === burningGolden.curve.lastFrame
    )!;
    const expiry = result.burningStateLog.at(-1)!;
    expect(start).toMatchObject({
      operation: "start",
      damageSourceActorId:
        burningGolden.owners.damageSourceActorId,
      fuelSourceActorId:
        burningGolden.owners.fuelSourceActorId,
      fuelGaugeUnitsAfter:
        burningGolden.fuel.startGaugeUnits,
      fuelExpiresAtFrame:
        burningGolden.fuel.expiresAtFrame
    });
    expect(skipped).toMatchObject({
      tickIndex: burningGolden.cadence.skippedTickIndex,
      fuelGaugeUnitsAfter:
        burningGolden.fuel.skippedTickGaugeUnitsAfter
    });
    expect(finalTick.fuelGaugeUnitsAfter).toBe(
      burningGolden.fuel.finalTickGaugeUnitsAfter
    );
    expect(expiry).toMatchObject({
      operation: "fuel-expire",
      frame: burningGolden.fuel.expiresAtFrame,
      fuelGaugeUnitsBefore:
        burningGolden.fuel.expiryGaugeUnitsBefore,
      fuelGaugeUnitsAfter:
        burningGolden.fuel.expiryGaugeUnitsAfter,
      reason: "FUEL_EXPIRED"
    });
    expect(result.auraInitialStates).toEqual([
      {
        targetId: "enemy-0",
        targetName: "燃烧基线目标",
        frame: 0,
        timeSeconds: 0,
        aura: [
          {
            element: "dendro",
            gaugeUnits: 1.6,
            expiresAtFrame: 720,
            sourceSlots: [
              {
                sourceActorId: "__initial__",
                gaugeUnits: 1.6
              }
            ]
          }
        ]
      }
    ]);
    expect(result.auraEndStates).toEqual([
      {
        targetId: "enemy-0",
        targetName: "燃烧基线目标",
        frame: 246,
        timeSeconds: 4.1,
        aura: [
          {
            element: "pyro",
            gaugeUnits: 0.665263157895,
            expiresAtFrame: 720,
            sourceSlots: [
              {
                sourceActorId: "pyro",
                gaugeUnits: 0.665263157895
              }
            ]
          }
        ]
      }
    ]);
    expect(
      result.burningStateLog.every(
        (entry) =>
          entry.damageSourceActorId ===
            burningGolden.owners.damageSourceActorId &&
          entry.fuelSourceActorId ===
            burningGolden.owners.fuelSourceActorId
      )
    ).toBe(true);

    for (const [characterId, expectedDamage] of Object.entries(
      burningGolden.byCharacter
    )) {
      expectRelativeClose(
        result.byCharacter[characterId] ?? 0,
        expectedDamage
      );
    }

    expect(result.bySkill).toHaveLength(
      burningGolden.bySkill.length
    );
    burningGolden.bySkill.forEach((expectedSkill, index) => {
      const actualSkill = result.bySkill[index];
      expect(actualSkill).toMatchObject({
        creditId: expectedSkill.creditId,
        actionName: expectedSkill.actionName,
        hits: expectedSkill.hits
      });
      expectRelativeClose(
        actualSkill?.damage ?? 0,
        expectedSkill.damage
      );
    });

    expect(result.targetSummaries).toHaveLength(
      burningGolden.byTarget.length
    );
    burningGolden.byTarget.forEach((expectedTarget, index) => {
      const actualTarget = result.targetSummaries[index];
      expect(actualTarget).toMatchObject({
        targetId: expectedTarget.targetId,
        targetName: expectedTarget.targetName,
        damageEvents: expectedTarget.damageEvents,
        landedChecks: expectedTarget.landedChecks,
        missedChecks: expectedTarget.missedChecks,
        immuneDamageEvents: expectedTarget.immuneDamageEvents
      });
      expectRelativeClose(
        actualTarget?.damage ?? 0,
        expectedTarget.damage
      );
      expectRelativeClose(
        actualTarget?.potentialDamage ?? 0,
        expectedTarget.potentialDamage
      );
    });

    const finalCurve = result.damageCurve.at(-1)!;
    expect(finalCurve).toMatchObject({
      frame: burningGolden.curve.lastFrame,
      timeSeconds: burningGolden.curve.lastTimeSeconds,
      sourceActorId:
        burningGolden.owners.damageSourceActorId,
      creditOwnerId: burningGolden.owners.creditOwnerId
    });
    expectRelativeClose(
      finalCurve.finalDamage,
      burningGolden.curve.lastDamage
    );
    expectRelativeClose(
      finalCurve.cumulativeDamage,
      burningGolden.curve.cumulativeDamage
    );
    expectRelativeClose(
      finalCurve.cumulativeByComponent.direct,
      burningGolden.curve.cumulativeDirect
    );
    expectRelativeClose(
      finalCurve.cumulativeByComponent.additiveReaction,
      burningGolden.curve.cumulativeAdditiveReaction
    );
    expectRelativeClose(
      finalCurve.cumulativeByComponent
        .transformativeReaction,
      burningGolden.curve.cumulativeTransformativeReaction
    );
    expectRelativeClose(
      finalCurve.cumulativeByReaction.burning ?? 0,
      burningGolden.curve.cumulativeBurning
    );

    const repeated = simulate(
      makeBurningGoldenConfig(),
      options
    );
    expect(repeated.reproducibilityKey).toBe(
      result.reproducibilityKey
    );
    expect(repeated.damageEvents).toEqual(result.damageEvents);
    expect(repeated.burningStateLog).toEqual(
      result.burningStateLog
    );
  });
});
