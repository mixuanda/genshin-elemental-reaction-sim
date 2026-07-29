import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { durinMeltPreset } from "@genshin-dps-lab/game-data/presets";
import { playerDamageResultReferencesSchema } from "@genshin-dps-lab/schemas";
import burningGolden from "../../../test-vectors/fixtures/burning-aura-v4-1.30.golden.json";
import goldenV133 from "../../../test-vectors/fixtures/legacy-default-120s-1.33.golden.json";
import goldenV134 from "../../../test-vectors/fixtures/legacy-default-120s-1.34.golden.json";
import goldenV135 from "../../../test-vectors/fixtures/legacy-default-120s-1.35.golden.json";
import goldenV136 from "../../../test-vectors/fixtures/legacy-default-120s-1.36.golden.json";
import goldenV137 from "../../../test-vectors/fixtures/legacy-default-120s-1.37.golden.json";
import goldenV138 from "../../../test-vectors/fixtures/legacy-default-120s-1.38.golden.json";
import golden from "../../../test-vectors/fixtures/legacy-default-120s.golden.json";
import { simulate } from "../simulator";
import { makeConfig, neutralStats } from "./fixtures";

const LEGACY_V130_REPRODUCIBILITY_KEY = "gdl-d1a42700";
const LEGACY_V130_COMPATIBILITY_SHA256 =
  "be150b9be5f33d18ef8942fbb13693aaef47b82a02712107ab04676dfcc24110";
const BURNING_V130_COMPATIBILITY_SHA256 =
  "7235c3faf3a61305aef85b5a6144d1c98196f2a8d222b3d453851cb53a83b772";
const BURNING_DAMAGE_EVENTS_SHA256 =
  "8e5c192e04f4599da093fc61f353aff3529a2d234aba19ef6dadd00bf89e1cf1";
const BURNING_STATE_LOG_SHA256 =
  "aedd0ba94477979a5c688e7496f925d073f36a0513ad3e274d38fbf0bff8b0b4";
const BURNING_V138_REPRODUCIBILITY_KEY =
  "gdl-v2-fnv1a32-b7a01ea2";
const BURNING_V138_CONFIG_HASH = "fnv1a32:9091b850";

const EMPTY_COMPATIBILITY_ARRAY_FIELDS = new Set([
  "bloomReactions",
  "damageGroupDecisions",
  "playerHitResolutionLogIds",
  "playerDamageEventIds",
  "reactionTaskLog"
]);
const NULL_COMPATIBILITY_REFERENCE_FIELDS = new Set([
  "triggerHitGroupId",
  "sourceCoreId",
  "sourceCoreLogId",
  "selectionRadius",
  "selectedTargetId",
  "resolutionReason",
  "playerHitResolutionLogId",
  "playerDamageEventId"
]);

/**
 * Hash the frozen pre-1.31 semantic surface. Empty Bloom arrays, 1.32 player
 * back-reference arrays, nullable Dendro/player references, and the disabled
 * 1.33 target-clock envelope and the absent aura-v6 multi-transform array are
 * additive wire fields. Legacy/v4 regressions normalize only those empty
 * values away while still failing if any new behavior becomes active.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .filter((key) => {
          const field = record[key];
          if (
            EMPTY_COMPATIBILITY_ARRAY_FIELDS.has(key) &&
            Array.isArray(field) &&
            field.length === 0
          ) {
            return false;
          }
          return !(
            NULL_COMPATIBILITY_REFERENCE_FIELDS.has(key) &&
            field === null
          );
        })
        .map((key) => [key, canonicalize(record[key])])
    );
  }
  return value;
}

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function stripV131QuickenLifecycleAudit(
  value: unknown
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      stripV131QuickenLifecycleAudit(entry)
    );
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "quickenStateMutation")
        .map(([key, entry]) => [
          key,
          stripV131QuickenLifecycleAudit(entry)
        ])
    );
  }
  return value;
}

/**
 * 1.32 made the already-frozen counter-9 audit explicit (`false` instead of
 * `null`) so the strict output Schema can validate it. Normalize that
 * audit-only correction solely inside the 1.30 compatibility digest.
 */
function stripV132BurningSkipAuditCorrection(
  value: unknown
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      stripV132BurningSkipAuditCorrection(entry)
    );
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(record).map(([key, entry]) => [
        key,
        key === "damageAllowed" &&
        entry === false &&
        record.operation === "tick-skipped" &&
        record.tickSkipped === true
          ? null
          : stripV132BurningSkipAuditCorrection(entry)
      ])
    );
  }
  return value;
}

function v130CompatibilityResult(
  result: ReturnType<typeof simulate>,
  reproducibilityKey: string
): unknown {
  const {
    targetStateTimeline: _targetStateTimeline,
    dendroCoreLog: _dendroCoreLog,
    dendroCoreContactLog: _dendroCoreContactLog,
    dendroCoreTimeline: _dendroCoreTimeline,
    playerHitResolutionLog: _playerHitResolutionLog,
    playerDamageEvents: _playerDamageEvents,
    playerHpTimeline: _playerHpTimeline,
    playerHpSummaries: _playerHpSummaries,
    playerSelfDamageStatus: _playerSelfDamageStatus,
    totalPlayerDamageTaken: _totalPlayerDamageTaken,
    totalReactionSelfDamageTaken:
      _totalReactionSelfDamageTaken,
    targetClockAudit: _targetClockAudit,
    targetClockLog: _targetClockLog,
    targetHitlagLog: _targetHitlagLog,
    targetTaskPhaseLog: _targetTaskPhaseLog,
    targetPhaseLog: _targetPhaseLog,
    runManifest: _runManifest,
    resolvedRuntimeOptions: _resolvedRuntimeOptions,
    pluginManifest: _pluginManifest,
    ...preDendroCoreResult
  } = result;
  // Versions and the reproducibility key intentionally change after migration;
  // restore only that envelope before comparing with the frozen 1.30 digest.
  return stripV131QuickenLifecycleAudit(
    stripV132BurningSkipAuditCorrection({
      ...preDendroCoreResult,
      schemaVersion: "1.30.0",
      engineVersion: "1.30.0-burning-reaction",
      reproducibilityKey,
      config: {
        ...Object.fromEntries(
          Object.entries(preDendroCoreResult.config).filter(
            ([key]) =>
              key !== "playerDamageModel" &&
              key !== "targetClockModel" &&
              key !== "targetTaskModel"
          )
        ),
        schemaVersion: "1.30.0",
        engineVersion: "1.30.0-burning-reaction"
      }
    })
  );
}

function expectContiguousTargetStateTimelineIds(
  result: ReturnType<typeof simulate>
): void {
  expect(result.targetStateTimeline.version).toBe("1.0.0");
  expect(
    result.targetStateTimeline.points.map((point) => point.id)
  ).toEqual(
    Array.from(
      { length: result.targetStateTimeline.points.length },
      (_, index) => index
    )
  );
}

function expectNoDendroCoreOutput(
  result: ReturnType<typeof simulate>
): void {
  expect(result.dendroCoreLog).toEqual([]);
  expect(result.dendroCoreContactLog).toEqual([]);
  expect(result.dendroCoreTimeline).toEqual({
    version: "1.0.0",
    points: []
  });
  expect(
    result.damageEvents.every(
      (event) => event.reactionAudit.bloomReactions.length === 0
    )
  ).toBe(true);
}

function makeBurningGoldenConfig(): unknown {
  const base = makeConfig();
  return {
    ...base,
    schemaVersion: burningGolden.config.schemaVersion,
    engineVersion: burningGolden.config.engineVersion,
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
    expect(
      playerDamageResultReferencesSchema.parse(result)
    ).toEqual(result);
    expect(goldenV133).toMatchObject({
      schemaVersion: "1.33.0",
      engineVersion: "1.33.0-target-local-hitlag",
      configHash: "fnv1a32:d250e585",
      reproducibilityKey: "gdl-v2-fnv1a32-7cbda09a"
    });
    expect(goldenV134).toMatchObject({
      schemaVersion: "1.34.0",
      engineVersion: "1.34.0-general-reaction-order",
      configHash: "fnv1a32:3a65d70b",
      reproducibilityKey: "gdl-v2-fnv1a32-1e62160a"
    });
    expect(goldenV135).toMatchObject({
      schemaVersion: "1.35.0",
      engineVersion: "1.35.0-elemental-enemy-resistance",
      configHash: "fnv1a32:cdbc3848",
      reproducibilityKey: "gdl-v2-fnv1a32-463ccabe"
    });
    expect(goldenV136).toMatchObject({
      schemaVersion: "1.36.0",
      engineVersion: "1.36.0-quicken-bloom-task",
      configHash: "fnv1a32:27198160",
      reproducibilityKey: "gdl-v2-fnv1a32-6c78b58b"
    });
    expect(goldenV137).toMatchObject({
      schemaVersion: "1.37.0",
      engineVersion: "1.37.0-target-task-phase",
      configHash: "fnv1a32:433ad3f2",
      reproducibilityKey: "gdl-v2-fnv1a32-7e16aaa2"
    });
    expect(goldenV138).toMatchObject({
      schemaVersion: "1.38.0",
      engineVersion: "1.38.0-target-reactable-phase",
      configHash: "fnv1a32:ac06871e",
      reproducibilityKey: "gdl-v2-fnv1a32-b4ba6a29"
    });
    expect(result.schemaVersion).toBe(goldenV138.schemaVersion);
    expect(result.engineVersion).toBe(goldenV138.engineVersion);
    expect(result.config.schemaVersion).toBe(
      goldenV138.schemaVersion
    );
    expect(result.config.engineVersion).toBe(
      goldenV138.engineVersion
    );
    expect(result.runManifest.configHash).toBe(
      goldenV138.configHash
    );
    expect(result.reproducibilityKey).toBe(
      goldenV138.reproducibilityKey
    );
    expect(goldenV138.options).toEqual(goldenV137.options);
    expect(goldenV137.options).toEqual(goldenV136.options);
    expect(goldenV136.options).toEqual(goldenV135.options);
    expect(goldenV135.options).toEqual(golden.options);
    expect(goldenV135.options).toEqual(goldenV134.options);
    expect(goldenV134.options).toEqual(goldenV133.options);
    expect(goldenV135.legacyDamageEventsSha256).toBe(
      goldenV134.legacyDamageEventsSha256
    );
    expect(goldenV135.legacyDamageEventsSha256).toBe(
      goldenV133.legacyDamageEventsSha256
    );
    expect(goldenV138.legacyDamageEventsSha256).toBe(
      goldenV137.legacyDamageEventsSha256
    );
    expect(result.runManifest).toMatchObject({
      version: "1.0.0",
      identityAlgorithm: "fnv1a32-v2",
      configHash: expect.stringMatching(
        /^fnv1a32:[0-9a-f]{8}$/
      ),
      resolvedRuntimeOptions: {
        energyMode: "configured",
        critMode: "average",
        compatibilityMode: "legacy-v0.1",
        randomSeed: golden.options.randomSeed
      },
      plugins: [],
      reproducibilityKey:
        goldenV138.reproducibilityKey
    });
    expect(result.resolvedRuntimeOptions).toBe(
      result.runManifest.resolvedRuntimeOptions
    );
    expect(result.pluginManifest).toBe(
      result.runManifest.plugins
    );
    expect(sha256(result.damageEvents)).toBe(
      goldenV138.legacyDamageEventsSha256
    );
    expect(result.config.targetClockModel).toEqual(
      { mode: "disabled" }
    );
    expect(result.targetClockAudit).toEqual({
      version: "1.0.0",
      mode: "disabled",
      hitlagStatus: "unsupported-enemy-hitlag",
      targets: []
    });
    expect(result.targetClockLog).toEqual(
      goldenV138.targetClock.clockLog
    );
    expect(result.targetHitlagLog).toEqual(
      goldenV138.targetClock.hitlagLog
    );
    expect(result.config.targetTaskModel).toEqual(
      goldenV138.targetTask.config
    );
    expect(result.targetTaskPhaseLog).toEqual(
      goldenV138.targetTask.phaseLog
    );
    expect(result.targetPhaseLog).toEqual(
      goldenV138.targetPhaseLog
    );
    expect(goldenV138.targetTask).toEqual(goldenV137.targetTask);
    expect(goldenV138.targetPhaseLog).toEqual([]);
    expect(
      sha256(
        v130CompatibilityResult(
          result,
          LEGACY_V130_REPRODUCIBILITY_KEY
        )
      )
    ).toBe(
      LEGACY_V130_COMPATIBILITY_SHA256
    );
    expectNoDendroCoreOutput(result);
    expectContiguousTargetStateTimelineIds(result);
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
    expect(result.totalDamage).toBe(goldenV138.totalDamage);
    expect(result.dps).toBe(goldenV138.dps);
    expect(result.damageEvents).toHaveLength(
      goldenV138.hitCount
    );
    expect(result.reactedHits).toBe(goldenV138.reactedHits);
    expect(result.skippedActions).toHaveLength(
      goldenV138.skippedActionCount
    );
    expect(result.byCharacter).toEqual(
      goldenV138.byCharacter
    );
    expect(
      result.bySkill.map(
        ({ creditId, actionName, damage, hits }) => ({
          creditId,
          actionName,
          damage,
          hits
        })
      )
    ).toEqual(goldenV138.bySkill);
    expect(goldenV138.totalDamage).toBe(goldenV137.totalDamage);
    expect(goldenV138.dps).toBe(goldenV137.dps);
    expect(goldenV138.hitCount).toBe(goldenV137.hitCount);
    expect(goldenV138.reactedHits).toBe(goldenV137.reactedHits);
    expect(goldenV138.skippedActionCount).toBe(
      goldenV137.skippedActionCount
    );
    expect(goldenV138.byCharacter).toEqual(
      goldenV137.byCharacter
    );
    expect(goldenV138.bySkill).toEqual(goldenV137.bySkill);
    expect(goldenV137.totalDamage).toBe(goldenV136.totalDamage);
    expect(goldenV137.dps).toBe(goldenV136.dps);
    expect(goldenV137.hitCount).toBe(goldenV136.hitCount);
    expect(goldenV137.reactedHits).toBe(goldenV136.reactedHits);
    expect(goldenV137.skippedActionCount).toBe(
      goldenV136.skippedActionCount
    );
    expect(goldenV137.byCharacter).toEqual(
      goldenV136.byCharacter
    );
    expect(goldenV137.bySkill).toEqual(goldenV136.bySkill);
    expect(goldenV136.totalDamage).toBe(goldenV135.totalDamage);
    expect(goldenV136.dps).toBe(goldenV135.dps);
    expect(goldenV136.hitCount).toBe(goldenV135.hitCount);
    expect(goldenV136.reactedHits).toBe(goldenV135.reactedHits);
    expect(goldenV136.skippedActionCount).toBe(
      goldenV135.skippedActionCount
    );
    expect(goldenV136.byCharacter).toEqual(
      goldenV135.byCharacter
    );
    expect(goldenV136.bySkill).toEqual(goldenV135.bySkill);
    expect(goldenV135.totalDamage).toBe(goldenV134.totalDamage);
    expect(goldenV135.dps).toBe(goldenV134.dps);
    expect(goldenV135.hitCount).toBe(goldenV134.hitCount);
    expect(goldenV135.reactedHits).toBe(goldenV134.reactedHits);
    expect(goldenV135.skippedActionCount).toBe(
      goldenV134.skippedActionCount
    );
    expect(goldenV135.byCharacter).toEqual(
      goldenV134.byCharacter
    );
    expect(goldenV135.bySkill).toEqual(goldenV134.bySkill);
    expect(goldenV134.totalDamage).toBe(goldenV133.totalDamage);
    expect(goldenV134.dps).toBe(goldenV133.dps);
    expect(goldenV134.hitCount).toBe(goldenV133.hitCount);
    expect(goldenV134.reactedHits).toBe(goldenV133.reactedHits);
    expect(goldenV134.skippedActionCount).toBe(
      goldenV133.skippedActionCount
    );
    expect(goldenV134.byCharacter).toEqual(
      goldenV133.byCharacter
    );
    expect(goldenV134.bySkill).toEqual(goldenV133.bySkill);
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

    const repeated = simulate(durinMeltPreset, {
      energyMode: "configured",
      critMode: "average",
      compatibilityMode: "legacy-v0.1",
      randomSeed: golden.options.randomSeed
    });
    expect(repeated.reproducibilityKey).toBe(
      result.reproducibilityKey
    );
    expect(repeated.damageEvents).toEqual(result.damageEvents);
    expect(repeated.targetStateTimeline).toEqual(
      result.targetStateTimeline
    );
    expectContiguousTargetStateTimelineIds(repeated);
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
    const input = makeBurningGoldenConfig();
    expect(input).toMatchObject({
      schemaVersion: "1.30.0",
      engineVersion: "1.30.0-burning-reaction",
      reactionEngine: { mode: "aura-v4" }
    });
    const result = simulate(input, options);
    expect(
      playerDamageResultReferencesSchema.parse(result)
    ).toEqual(result);
    expect(result.runManifest.configHash).toBe(
      BURNING_V138_CONFIG_HASH
    );

    expect(burningGolden.config.schemaVersion).toBe("1.30.0");
    expect(burningGolden.config.engineVersion).toBe(
      "1.30.0-burning-reaction"
    );
    expect(result.schemaVersion).toBe("1.38.0");
    expect(result.engineVersion).toBe(
      "1.38.0-target-reactable-phase"
    );
    expect(result.config.schemaVersion).toBe("1.38.0");
    expect(result.config.engineVersion).toBe(
      "1.38.0-target-reactable-phase"
    );
    expect(result.config.reactionEngine?.mode).toBe("aura-v4");
    expect(result.config.targetClockModel).toEqual(
      goldenV138.targetClock.config
    );
    expect(result.targetClockAudit).toEqual(
      goldenV138.targetClock.audit
    );
    expect(result.targetClockLog).toEqual([]);
    expect(result.targetHitlagLog).toEqual([]);
    expect(result.config.targetTaskModel).toEqual(
      goldenV138.targetTask.config
    );
    expect(result.targetTaskPhaseLog).toEqual([]);
    expect(result.targetPhaseLog).toEqual([]);
    expect(result.dataVersion).toBe(
      burningGolden.config.dataVersion
    );
    expect(burningGolden.reproducibilityKey).toBe(
      "gdl-37da25f5"
    );
    expect(result.reproducibilityKey).toBe(
      BURNING_V138_REPRODUCIBILITY_KEY
    );
    expect(result.runManifest).toMatchObject({
      version: "1.0.0",
      identityAlgorithm: "fnv1a32-v2",
      configHash: expect.stringMatching(
        /^fnv1a32:[0-9a-f]{8}$/
      ),
      resolvedRuntimeOptions: options,
      plugins: [],
      reproducibilityKey:
        BURNING_V138_REPRODUCIBILITY_KEY
    });
    expect(sha256(result.damageEvents)).toBe(
      BURNING_DAMAGE_EVENTS_SHA256
    );
    expect(sha256(result.burningStateLog)).toBe(
      BURNING_STATE_LOG_SHA256
    );
    expect(
      sha256(
        v130CompatibilityResult(
          result,
          burningGolden.reproducibilityKey
        )
      )
    ).toBe(
      BURNING_V130_COMPATIBILITY_SHA256
    );
    expectNoDendroCoreOutput(result);
    expectContiguousTargetStateTimelineIds(result);
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
    expect(repeated.targetStateTimeline).toEqual(
      result.targetStateTimeline
    );
    expectContiguousTargetStateTimelineIds(repeated);
  });
});
