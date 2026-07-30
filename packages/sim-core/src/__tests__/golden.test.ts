import { createHash } from "node:crypto";
import {
  linkSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { durinMeltPreset } from "@genshin-dps-lab/game-data/presets";
import {
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  playerDamageResultReferencesSchema
} from "@genshin-dps-lab/schemas";
import burningGolden from "../../../test-vectors/fixtures/burning-aura-v4-1.30.golden.json";
import goldenV133 from "../../../test-vectors/fixtures/legacy-default-120s-1.33.golden.json";
import goldenV134 from "../../../test-vectors/fixtures/legacy-default-120s-1.34.golden.json";
import goldenV135 from "../../../test-vectors/fixtures/legacy-default-120s-1.35.golden.json";
import goldenV136 from "../../../test-vectors/fixtures/legacy-default-120s-1.36.golden.json";
import goldenV137 from "../../../test-vectors/fixtures/legacy-default-120s-1.37.golden.json";
import goldenV138 from "../../../test-vectors/fixtures/legacy-default-120s-1.38.golden.json";
import goldenV139 from "../../../test-vectors/fixtures/legacy-default-120s-1.39.golden.json";
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
const BURNING_V141_REPRODUCIBILITY_KEY =
  "gdl-v2-fnv1a32-709c1c8c";
const BURNING_V141_CONFIG_HASH = "fnv1a32:a41cac38";
const FROZEN_VERSIONED_FIXTURE_SHA256 = {
  "legacy-default-120s-1.37.golden.json":
    "168595c9e3df60717fe2b5619278cc227789df7cbf56b9985a78ceb78e10bacc",
  "quicken-bloom-task-order-1.37.golden.json":
    "d7d6a4c5ec77fcc658f024b44044765cac74f5d60e59bff4fa4d8ed49317bfb6",
  "target-task-phase-1.37.golden.json":
    "5bb1ebe27d7bd5dd613abed4cb1326345925dec00311ee500b24648ffd97c60a",
  "legacy-default-120s-1.38.golden.json":
    "a3813cda16b831d6606df5976dc90e2d8410c272fadefd25551e29e94ff334ed",
  "quicken-bloom-task-order-1.38.golden.json":
    "07b35af482d2cf1f5cf77eb978682c51eb014300413ea516973dba1807863cfc",
  "target-reactable-phase-1.38.golden.json":
    "f6bd14ae2a86596cc7d50b2d63b4b75c9c00aeb14cb75f0ada10e3ae4b3f5db0",
  "legacy-default-120s-1.39.golden.json":
    "9765979c127cee707a99db1344a9569d25560d8a2f19ad2577fac2c7c9225151",
  "quicken-bloom-task-order-1.39.golden.json":
    "a09f6c001bc0282299f96a81232fab56caa0803f3b5b83f4d85233772ef50534",
  "target-reactable-phase-1.39.golden.json":
    "40f4c76f3469453b08436b2fbd1cddab1af8b9975ce8f1133b3315b03253d5f8",
  "shatter-recursive-delivery-1.39.golden.json":
    "a83ff459e5753ddef1082d923b6476bdbe5392dc9f574ac3d462e357df322579"
} as const;
const FROZEN_V140_FIXTURE_SHA256 = {
  "legacy-default-120s-1.40.golden.json":
    "843523027635a1026269fbe4711fbdb56e5a229a8cb2dbf45bcbb396fe62136f",
  "quicken-bloom-task-order-1.40.golden.json":
    "b13f96768e589b77ff62daef1fd5cae0a3b1bab2a98fc88ce7c3f415356805b4",
  "electro-charged-quicken-cleanup-1.40.golden.json":
    "bc1fb0bec7b526c1f3046ef81bb3aac5d947410fc013fbcc8d6fd2c6731563e0"
} as const;
const FROZEN_V141_FIXTURE_SHA256 = {
  "legacy-default-120s-1.41.golden.json":
    "9768d8b0461bd641ed5a4097e1cfe4204e1d6db9e9a6453e75754eb1a90bf9c8",
  "electro-charged-propagation-1.41.golden.json":
    "b855f87f391a5f0dfd82e30a4666c8bb79a7777c94bc8f2bd675178fabdb0d18"
} as const;
const LEGACY_DEFAULT_V141_FIXTURE_URL = new URL(
  "../../../test-vectors/fixtures/legacy-default-120s-1.41.golden.json",
  import.meta.url
);
const LEGACY_DEFAULT_V140_FIXTURE_URL = new URL(
  "../../../test-vectors/fixtures/legacy-default-120s-1.40.golden.json",
  import.meta.url
);
const LEGACY_DEFAULT_V139_FIXTURE_URL = new URL(
  "../../../test-vectors/fixtures/legacy-default-120s-1.39.golden.json",
  import.meta.url
);

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

function atomicCreateJsonFixture(
  outputUrl: URL,
  value: unknown
): void {
  const outputPath = fileURLToPath(outputUrl);
  const temporaryPath =
    `${outputPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(
    temporaryPath,
    `${JSON.stringify(value, null, 2)}\n`,
    { flag: "wx" }
  );
  try {
    linkSync(temporaryPath, outputPath);
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      throw new Error(
        `Refusing to overwrite frozen fixture ${outputPath}.`
      );
    }
    throw error;
  } finally {
    unlinkSync(temporaryPath);
  }
}

type LegacyDefaultV141Fixture = typeof goldenV139 & {
  electroChargedPropagationModel: {
    mode: "single-target-v1";
  };
};

function loadFrozenLegacyDefaultV140Fixture(): typeof goldenV139 {
  if (
    process.env.UPDATE_LEGACY_DEFAULT_V139_GOLDEN === "1"
  ) {
    throw new Error(
      "legacy-default-120s-1.39.golden.json is frozen; create only a new versioned fixture."
    );
  }
  if (
    process.env.UPDATE_LEGACY_DEFAULT_V140_GOLDEN === "1"
  ) {
    throw new Error(
      "legacy-default-120s-1.40.golden.json is frozen; create only the versioned 1.41 fixture."
    );
  }
  const sourceBytes = readFileSync(
    LEGACY_DEFAULT_V140_FIXTURE_URL
  );
  const sourceSha256 = createHash("sha256")
    .update(sourceBytes)
    .digest("hex");
  if (
    sourceSha256 !==
    FROZEN_V140_FIXTURE_SHA256[
      "legacy-default-120s-1.40.golden.json"
    ]
  ) {
    throw new Error(
      `Frozen 1.40 default fixture changed: received ${sourceSha256}.`
    );
  }
  return JSON.parse(sourceBytes.toString("utf8")) as typeof goldenV139;
}

function projectLegacyDefaultCompatibilitySemantics(
  fixture: typeof goldenV139 | LegacyDefaultV141Fixture
) {
  return {
    options: fixture.options,
    totalDamage: fixture.totalDamage,
    dps: fixture.dps,
    hitCount: fixture.hitCount,
    reactedHits: fixture.reactedHits,
    skippedActionCount: fixture.skippedActionCount,
    byCharacter: fixture.byCharacter,
    bySkill: fixture.bySkill,
    legacyDamageEventsSha256:
      fixture.legacyDamageEventsSha256,
    targetClock: fixture.targetClock,
    targetTask: fixture.targetTask,
    targetPhaseLog: fixture.targetPhaseLog,
    reactionDeliveryModel:
      fixture.reactionDeliveryModel
  };
}

function loadOrCreateLegacyDefaultV141Fixture(
  generatedFixture: LegacyDefaultV141Fixture,
  frozenV140: typeof goldenV139
): LegacyDefaultV141Fixture {
  if (
    process.env.UPDATE_LEGACY_DEFAULT_V141_GOLDEN === "1"
  ) {
    const sourceBytes = readFileSync(
      LEGACY_DEFAULT_V140_FIXTURE_URL
    );
    const sourceSha256 = createHash("sha256")
      .update(sourceBytes)
      .digest("hex");
    if (
      sourceSha256 !==
      FROZEN_V140_FIXTURE_SHA256[
        "legacy-default-120s-1.40.golden.json"
      ]
    ) {
      throw new Error(
        `Refusing to derive the 1.41 default fixture from an unfrozen 1.40 source: received ${sourceSha256}.`
      );
    }
    if (
      JSON.stringify(
        projectLegacyDefaultCompatibilitySemantics(
          generatedFixture
        )
      ) !==
      JSON.stringify(
        projectLegacyDefaultCompatibilitySemantics(
          frozenV140
        )
      )
    ) {
      throw new Error(
        "Refusing to write the 1.41 default fixture because its frozen 1.40 compatibility semantics changed."
      );
    }
    if (
      generatedFixture.schemaVersion !==
        CURRENT_SCHEMA_VERSION ||
      generatedFixture.engineVersion !==
        CURRENT_ENGINE_VERSION ||
      generatedFixture.electroChargedPropagationModel.mode !==
        "single-target-v1"
    ) {
      throw new Error(
        "Refusing to write the 1.41 default fixture without the exact current identity and source-only Electro-Charged propagation model."
      );
    }
    atomicCreateJsonFixture(
      LEGACY_DEFAULT_V141_FIXTURE_URL,
      generatedFixture
    );
    return generatedFixture;
  }
  return JSON.parse(
    readFileSync(LEGACY_DEFAULT_V141_FIXTURE_URL, "utf8")
  ) as LegacyDefaultV141Fixture;
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
              key !== "targetTaskModel" &&
              key !== "reactionDeliveryModel" &&
              key !== "electroChargedPropagationModel"
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
  const {
    reactionDeliveryModel: _reactionDeliveryModel,
    electroChargedPropagationModel:
      _electroChargedPropagationModel,
    ...v130Base
  } = base;
  return {
    ...v130Base,
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

describe("frozen versioned fixture integrity", () => {
  it("keeps every 1.37–1.39 fixture byte-for-byte frozen", () => {
    for (const [fileName, expectedSha256] of Object.entries(
      FROZEN_VERSIONED_FIXTURE_SHA256
    )) {
      const bytes = readFileSync(
        new URL(
          `../../../test-vectors/fixtures/${fileName}`,
          import.meta.url
        )
      );
      expect(
        createHash("sha256").update(bytes).digest("hex"),
        fileName
      ).toBe(expectedSha256);
    }
  });

  it("keeps the three 1.40 release fixtures byte-for-byte frozen", () => {
    for (const [fileName, expectedSha256] of Object.entries(
      FROZEN_V140_FIXTURE_SHA256
    )) {
      const bytes = readFileSync(
        new URL(
          `../../../test-vectors/fixtures/${fileName}`,
          import.meta.url
        )
      );
      expect(
        createHash("sha256").update(bytes).digest("hex"),
        fileName
      ).toBe(expectedSha256);
    }
  });

  it("keeps the two 1.41 release fixtures byte-for-byte frozen", () => {
    for (const [fileName, expectedSha256] of Object.entries(
      FROZEN_V141_FIXTURE_SHA256
    )) {
      const bytes = readFileSync(
        new URL(
          `../../../test-vectors/fixtures/${fileName}`,
          import.meta.url
        )
      );
      expect(
        createHash("sha256").update(bytes).digest("hex"),
        fileName
      ).toBe(expectedSha256);
    }
  });
});

describe("Vanilla v0.1 golden compatibility", () => {
  it("matches the full default 120-second baseline", () => {
    const options = {
      energyMode: "configured",
      critMode: "average",
      compatibilityMode: "legacy-v0.1",
      randomSeed: golden.options.randomSeed
    } as const;
    const result = simulate(durinMeltPreset, options);
    const repeated = simulate(durinMeltPreset, options);
    expect(repeated).toEqual(result);
    expect(
      playerDamageResultReferencesSchema.parse(result)
    ).toEqual(result);
    expect(
      playerDamageResultReferencesSchema.parse(repeated)
    ).toEqual(repeated);
    const projectedBySkill = result.bySkill.map(
      ({ creditId, actionName, damage, hits }) => ({
        creditId,
        actionName,
        damage,
        hits
      })
    );
    const goldenV140 =
      loadFrozenLegacyDefaultV140Fixture();
    const generatedV141Fixture = {
      ...goldenV140,
      description:
        "Compact 1.41 identity and result envelope for the frozen Vanilla v0.1 default 120-second compatibility baseline.",
      provenance: {
        ...goldenV140.provenance,
        source:
          "simulate(durinMeltPreset) cross-checked against legacy/v0.1-vanilla/app.js, legacy-default-120s.golden.json, and the frozen 1.40 identity fixture",
        capturedAt: "2026-07-29",
        note:
          "Regression baseline only. Character and equipment values are illustrative magic numbers, not verified game data. The 1.41 engine adds opt-in community-provisional nearby-Wet Electro-Charged propagation, while this default preset explicitly keeps single-target-v1 and the complete 269-event damage digest frozen to 1.40."
      },
      schemaVersion: result.schemaVersion,
      engineVersion: result.engineVersion,
      configHash: result.runManifest.configHash,
      reproducibilityKey: result.reproducibilityKey,
      options: {
        energyMode: "configured" as const,
        critMode: "average" as const,
        compatibilityMode: "legacy-v0.1" as const,
        randomSeed: golden.options.randomSeed
      },
      totalDamage: result.totalDamage,
      dps: result.dps,
      hitCount: result.damageEvents.length,
      reactedHits: result.reactedHits,
      skippedActionCount: result.skippedActions.length,
      byCharacter: result.byCharacter,
      bySkill: projectedBySkill,
      legacyDamageEventsSha256: sha256(result.damageEvents),
      targetClock: {
        config: result.config.targetClockModel,
        audit: result.targetClockAudit,
        clockLog: result.targetClockLog,
        hitlagLog: result.targetHitlagLog
      },
      targetTask: {
        config: result.config.targetTaskModel,
        phaseLog: result.targetTaskPhaseLog
      },
      targetPhaseLog: result.targetPhaseLog,
      reactionDeliveryModel:
        result.config.reactionDeliveryModel,
      electroChargedPropagationModel:
        result.config.electroChargedPropagationModel
    } as unknown as LegacyDefaultV141Fixture;
    expect(generatedV141Fixture).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      engineVersion: CURRENT_ENGINE_VERSION,
      totalDamage: 41410555.13728799,
      dps: 345087.9594773999,
      hitCount: 269,
      reactedHits: 129,
      skippedActionCount: 3,
      legacyDamageEventsSha256:
        "b3bddf486cf85967f8be689ccad860a450377fab5f3e2318655430324348652f",
      electroChargedPropagationModel: {
        mode: "single-target-v1"
      }
    });
    expect(
      projectLegacyDefaultCompatibilitySemantics(
        generatedV141Fixture
      )
    ).toEqual(
      projectLegacyDefaultCompatibilitySemantics(goldenV140)
    );
    const goldenV141 =
      loadOrCreateLegacyDefaultV141Fixture(
        generatedV141Fixture,
        goldenV140
      );

    expectRelativeClose(result.totalDamage, golden.totalDamage);
    expectRelativeClose(result.dps, golden.dps);
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
    expect(goldenV139).toMatchObject({
      schemaVersion: "1.39.0",
      engineVersion: "1.39.0-shatter-recursive-delivery",
      configHash: expect.stringMatching(/^fnv1a32:[0-9a-f]{8}$/),
      reproducibilityKey: expect.stringMatching(
        /^gdl-v2-fnv1a32-[0-9a-f]{8}$/
      ),
      reactionDeliveryModel: {
        mode: "deferred-event-heap-v1"
      }
    });
    expect(goldenV140).toMatchObject({
      schemaVersion: "1.40.0",
      engineVersion:
        "1.40.0-ec-next-target-tick-cleanup",
      configHash: expect.stringMatching(/^fnv1a32:[0-9a-f]{8}$/),
      reproducibilityKey: expect.stringMatching(
        /^gdl-v2-fnv1a32-[0-9a-f]{8}$/
      ),
      reactionDeliveryModel: {
        mode: "deferred-event-heap-v1"
      }
    });
    expect(goldenV141).toMatchObject({
      schemaVersion: "1.41.0",
      engineVersion:
        "1.41.0-ec-secondary-wet-propagation",
      configHash: expect.stringMatching(/^fnv1a32:[0-9a-f]{8}$/),
      reproducibilityKey: expect.stringMatching(
        /^gdl-v2-fnv1a32-[0-9a-f]{8}$/
      ),
      reactionDeliveryModel: {
        mode: "deferred-event-heap-v1"
      },
      electroChargedPropagationModel: {
        mode: "single-target-v1"
      },
      totalDamage: 41410555.13728799,
      dps: 345087.9594773999,
      hitCount: 269,
      reactedHits: 129,
      skippedActionCount: 3,
      legacyDamageEventsSha256:
        "b3bddf486cf85967f8be689ccad860a450377fab5f3e2318655430324348652f"
    });
    expect(result.schemaVersion).toBe(goldenV141.schemaVersion);
    expect(result.engineVersion).toBe(goldenV141.engineVersion);
    expect(result.config.schemaVersion).toBe(
      goldenV141.schemaVersion
    );
    expect(result.config.engineVersion).toBe(
      goldenV141.engineVersion
    );
    expect(result.runManifest.configHash).toBe(
      goldenV141.configHash
    );
    expect(result.reproducibilityKey).toBe(
      goldenV141.reproducibilityKey
    );
    expect(goldenV141.options).toEqual(goldenV140.options);
    expect(goldenV140.options).toEqual(goldenV139.options);
    expect(goldenV139.options).toEqual(goldenV138.options);
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
    expect(goldenV139.legacyDamageEventsSha256).toBe(
      goldenV138.legacyDamageEventsSha256
    );
    expect(goldenV140.legacyDamageEventsSha256).toBe(
      goldenV139.legacyDamageEventsSha256
    );
    expect(goldenV141.legacyDamageEventsSha256).toBe(
      goldenV140.legacyDamageEventsSha256
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
        goldenV141.reproducibilityKey
    });
    expect(result.resolvedRuntimeOptions).toBe(
      result.runManifest.resolvedRuntimeOptions
    );
    expect(result.pluginManifest).toBe(
      result.runManifest.plugins
    );
    expect(sha256(result.damageEvents)).toBe(
      goldenV141.legacyDamageEventsSha256
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
      goldenV141.targetClock.clockLog
    );
    expect(result.targetHitlagLog).toEqual(
      goldenV141.targetClock.hitlagLog
    );
    expect(result.config.targetTaskModel).toEqual(
      goldenV141.targetTask.config
    );
    expect(result.targetTaskPhaseLog).toEqual(
      goldenV141.targetTask.phaseLog
    );
    expect(result.targetPhaseLog).toEqual(
      goldenV141.targetPhaseLog
    );
    expect(result.config.reactionDeliveryModel).toEqual(
      goldenV141.reactionDeliveryModel
    );
    expect(result.config.electroChargedPropagationModel).toEqual(
      goldenV141.electroChargedPropagationModel
    );
    expect(
      projectLegacyDefaultCompatibilitySemantics(goldenV141)
    ).toEqual(
      projectLegacyDefaultCompatibilitySemantics(goldenV140)
    );
    expect(goldenV141.targetTask).toEqual(goldenV140.targetTask);
    expect(goldenV141.targetPhaseLog).toEqual(
      goldenV140.targetPhaseLog
    );
    expect(goldenV141.reactionDeliveryModel).toEqual(
      goldenV140.reactionDeliveryModel
    );
    expect(goldenV140.targetTask).toEqual(goldenV139.targetTask);
    expect(goldenV140.targetPhaseLog).toEqual(
      goldenV139.targetPhaseLog
    );
    expect(goldenV140.reactionDeliveryModel).toEqual(
      goldenV139.reactionDeliveryModel
    );
    expect(goldenV139.targetTask).toEqual(goldenV138.targetTask);
    expect(goldenV139.targetPhaseLog).toEqual(
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
    expect(result.totalDamage).toBe(goldenV141.totalDamage);
    expect(result.dps).toBe(goldenV141.dps);
    expect(result.damageEvents).toHaveLength(
      goldenV141.hitCount
    );
    expect(result.reactedHits).toBe(goldenV141.reactedHits);
    expect(result.skippedActions).toHaveLength(
      goldenV141.skippedActionCount
    );
    expect(result.byCharacter).toEqual(
      goldenV141.byCharacter
    );
    expect(projectedBySkill).toEqual(goldenV141.bySkill);
    expect(goldenV141.totalDamage).toBe(goldenV140.totalDamage);
    expect(goldenV141.dps).toBe(goldenV140.dps);
    expect(goldenV141.hitCount).toBe(goldenV140.hitCount);
    expect(goldenV141.reactedHits).toBe(
      goldenV140.reactedHits
    );
    expect(goldenV141.skippedActionCount).toBe(
      goldenV140.skippedActionCount
    );
    expect(goldenV141.byCharacter).toEqual(
      goldenV140.byCharacter
    );
    expect(goldenV141.bySkill).toEqual(goldenV140.bySkill);
    expect(goldenV140.totalDamage).toBe(goldenV139.totalDamage);
    expect(goldenV140.dps).toBe(goldenV139.dps);
    expect(goldenV140.hitCount).toBe(goldenV139.hitCount);
    expect(goldenV140.reactedHits).toBe(goldenV139.reactedHits);
    expect(goldenV140.skippedActionCount).toBe(
      goldenV139.skippedActionCount
    );
    expect(goldenV140.byCharacter).toEqual(
      goldenV139.byCharacter
    );
    expect(goldenV140.bySkill).toEqual(goldenV139.bySkill);
    expect(goldenV139.totalDamage).toBe(goldenV138.totalDamage);
    expect(goldenV139.dps).toBe(goldenV138.dps);
    expect(goldenV139.hitCount).toBe(goldenV138.hitCount);
    expect(goldenV139.reactedHits).toBe(goldenV138.reactedHits);
    expect(goldenV139.skippedActionCount).toBe(
      goldenV138.skippedActionCount
    );
    expect(goldenV139.byCharacter).toEqual(
      goldenV138.byCharacter
    );
    expect(goldenV139.bySkill).toEqual(goldenV138.bySkill);
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
      BURNING_V141_CONFIG_HASH
    );

    expect(burningGolden.config.schemaVersion).toBe("1.30.0");
    expect(burningGolden.config.engineVersion).toBe(
      "1.30.0-burning-reaction"
    );
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.engineVersion).toBe(CURRENT_ENGINE_VERSION);
    expect(result.config.schemaVersion).toBe(
      CURRENT_SCHEMA_VERSION
    );
    expect(result.config.engineVersion).toBe(
      CURRENT_ENGINE_VERSION
    );
    expect(result.config.reactionEngine?.mode).toBe("aura-v4");
    expect(result.config.targetClockModel).toEqual(
      goldenV139.targetClock.config
    );
    expect(result.targetClockAudit).toEqual(
      goldenV139.targetClock.audit
    );
    expect(result.targetClockLog).toEqual([]);
    expect(result.targetHitlagLog).toEqual([]);
    expect(result.config.targetTaskModel).toEqual(
      goldenV139.targetTask.config
    );
    expect(result.targetTaskPhaseLog).toEqual([]);
    expect(result.targetPhaseLog).toEqual([]);
    expect(result.config.reactionDeliveryModel).toEqual(
      goldenV139.reactionDeliveryModel
    );
    expect(result.dataVersion).toBe(
      burningGolden.config.dataVersion
    );
    expect(burningGolden.reproducibilityKey).toBe(
      "gdl-37da25f5"
    );
    expect(result.reproducibilityKey).toBe(
      BURNING_V141_REPRODUCIBILITY_KEY
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
        BURNING_V141_REPRODUCIBILITY_KEY
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
