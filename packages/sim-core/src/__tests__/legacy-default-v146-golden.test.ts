import { createHash } from "node:crypto";
import {
  existsSync,
  linkSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { durinMeltPreset } from "@genshin-dps-lab/game-data/presets";
import { GCSIM_DAMAGE_GROUP_ROOT } from "@genshin-dps-lab/icd-profiles";
import {
  DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
  DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
  DIRECT_DAMAGE_GROUP_RUN_MANIFEST_VERSION,
  assertTrustedSimulationResult,
  directDamageGroupModelSchema,
  reactionFormulaModelSchema,
  simulationResultSchema,
  simulationRunManifestV146Schema
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import frozenV145Json from "../../../test-vectors/fixtures/legacy-default-120s-1.45.golden.json";
import { simulate } from "../simulator";

const UPDATE_FLAG = "UPDATE_LEGACY_DEFAULT_V146_GOLDEN";
const FROZEN_V145_SHA256 =
  "ce59efca02ea2a895195139a3775ec0eeefe6b73414603ee8650e46b2e3c2167";
const FROZEN_V146_SHA256 =
  "3ef783e206a4566fd935c3251f97d31aeb6cddb7ec7e82eccf661d62cb994465";
const DEFAULT_V146_CONFIG_HASH = "fnv1a32:a6bb82c4";
const DEFAULT_V146_REPRODUCIBILITY_KEY =
  "gdl-v2-fnv1a32-0441a6ea";
const DEFAULT_DAMAGE_EVENTS_SHA256 =
  "b3bddf486cf85967f8be689ccad860a450377fab5f3e2318655430324348652f";
const DEFAULT_DAMAGE_GROUP_LOG_SHA256 =
  "a9c1df34508e3fcdda365e3b6717460d618b263a2409ad843df2016de0ce0e88";
const DESCRIPTION =
  "Compact 1.46 direct-damage-group-root identity and result envelope for the frozen Vanilla v0.1 default 120-second compatibility baseline.";
const SOURCE =
  "simulate(durinMeltPreset) cross-checked against the byte-frozen 1.45 default fixture and legacy/v0.1-vanilla baseline";
const NOTE =
  "Regression baseline only. Character and equipment values are illustrative magic numbers, not verified game data. The 1.46 engine binds the fixed-gcsim-provisional ordinary direct-damage-group root. This default preset assigns no audited Damage Group descriptor, so all 269 direct-damage audit rows are explicit bypasses and the 1.45 damage numerics remain unchanged. This is neither official server truth nor complete gcsim parity, and elemental-application ICD is not covered by this fixture.";

const FIXTURE_URL = new URL(
  "../../../test-vectors/fixtures/legacy-default-120s-1.46.golden.json",
  import.meta.url
);
const FROZEN_V145_URL = new URL(
  "../../../test-vectors/fixtures/legacy-default-120s-1.45.golden.json",
  import.meta.url
);
const EMPTY_LEGACY_COMPATIBILITY_ARRAY_FIELDS = new Set([
  "bloomReactions",
  "damageGroupDecisions",
  "playerHitResolutionLogIds",
  "playerDamageEventIds",
  "reactionTaskLog"
]);
const NULL_LEGACY_COMPATIBILITY_REFERENCE_FIELDS = new Set([
  "triggerHitGroupId",
  "sourceCoreId",
  "sourceCoreLogId",
  "selectionRadius",
  "selectedTargetId",
  "resolutionReason",
  "playerHitResolutionLogId",
  "playerDamageEventId"
]);
const POST_V146_DAMAGE_EVENT_FIELDS = new Set([
  "elementalApplicationIcdLogId"
]);

const fixtureSchema = z
  .object({
    fixtureVersion: z.literal("1.0.0"),
    description: z.literal(DESCRIPTION),
    provenance: z
      .object({
        source: z.literal(SOURCE),
        capturedAt: z.literal("2026-08-01"),
        verificationStatus: z.literal("provisional"),
        note: z.literal(NOTE),
        officialServerTruth: z.literal(false),
        completeGcsimParity: z.literal(false)
      })
      .strict(),
    schemaVersion: z.literal(
      DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION
    ),
    engineVersion: z.literal(
      DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION
    ),
    configHash: z.literal(DEFAULT_V146_CONFIG_HASH),
    reproducibilityKey: z.literal(
      DEFAULT_V146_REPRODUCIBILITY_KEY
    ),
    options: z
      .object({
        energyMode: z.literal("configured"),
        critMode: z.literal("average"),
        compatibilityMode: z.literal("legacy-v0.1"),
        randomSeed: z.literal("legacy-default")
      })
      .strict(),
    totalDamage: z.literal(41410555.13728799),
    dps: z.literal(345087.9594773999),
    hitCount: z.literal(269),
    reactedHits: z.literal(129),
    skippedActionCount: z.literal(3),
    byCharacter: z
      .object({
        nicole: z.literal(740338.5919263127),
        citlali: z.literal(77244.84267655843),
        durin: z.literal(38779268.124040276),
        lohen: z.literal(1813703.5786448019)
      })
      .strict(),
    bySkill: z.array(
      z
        .object({
          creditId: z.string().min(1),
          actionName: z.string().min(1),
          damage: z.number().finite(),
          hits: z.number().int().nonnegative()
        })
        .strict()
    ),
    legacyDamageEventsSha256: z.literal(
      DEFAULT_DAMAGE_EVENTS_SHA256
    ),
    reactionDeliveryModel: z.unknown(),
    electroChargedPropagationModel: z.unknown(),
    targetClock: z.unknown(),
    targetTask: z.unknown(),
    targetPhaseLog: z.unknown(),
    reactionFormulaModel: reactionFormulaModelSchema,
    directDamageGroupModel: directDamageGroupModelSchema,
    directDamageGroupAudit: z
      .object({
        rowCount: z.literal(269),
        evaluatedCount: z.literal(0),
        bypassedCount: z.literal(269),
        canonicalSha256: z.literal(
          DEFAULT_DAMAGE_GROUP_LOG_SHA256
        )
      })
      .strict(),
    runManifest: simulationRunManifestV146Schema
  })
  .strict()
  .superRefine((fixture, context) => {
    if (
      fixture.runManifest.version !==
        DIRECT_DAMAGE_GROUP_RUN_MANIFEST_VERSION ||
      fixture.runManifest.schemaVersion !==
        fixture.schemaVersion ||
      fixture.runManifest.engineVersion !==
        fixture.engineVersion ||
      fixture.runManifest.configHash !== fixture.configHash ||
      fixture.runManifest.reproducibilityKey !==
        fixture.reproducibilityKey ||
      JSON.stringify(
        fixture.runManifest.resolvedRuntimeOptions
      ) !== JSON.stringify(fixture.options) ||
      fixture.runManifest.plugins.length !== 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["runManifest"],
        message:
          "must bind the exact 1.46 default identity, options, empty plugin order, and reproducibility key"
      });
    }
    if (
      fixture.directDamageGroupModel.profileId !==
        fixture.runManifest.directDamageGroupRoot.profileId ||
      JSON.stringify(fixture.runManifest.directDamageGroupRoot) !==
        JSON.stringify(GCSIM_DAMAGE_GROUP_ROOT)
    ) {
      context.addIssue({
        code: "custom",
        path: ["runManifest", "directDamageGroupRoot"],
        message:
          "must bind the exact direct-damage-group selector and provisional root"
      });
    }
  });

type DefaultV146Fixture = z.output<typeof fixtureSchema>;

function byteSha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonicalize(record[key])])
    );
  }
  return value;
}

function canonicalSha256(value: unknown): string {
  return byteSha256(JSON.stringify(canonicalize(value)));
}

/** Exact pre-1.45 damage-event digest projection retained by the frozen chain. */
function legacyDamageEventCanonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      legacyDamageEventCanonicalize(entry)
    );
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .filter((key) => {
          const field = record[key];
          if (POST_V146_DAMAGE_EVENT_FIELDS.has(key)) {
            return false;
          }
          if (
            EMPTY_LEGACY_COMPATIBILITY_ARRAY_FIELDS.has(key) &&
            Array.isArray(field) &&
            field.length === 0
          ) {
            return false;
          }
          return !(
            NULL_LEGACY_COMPATIBILITY_REFERENCE_FIELDS.has(key) &&
            field === null
          );
        })
        .map((key) => [
          key,
          legacyDamageEventCanonicalize(record[key])
        ])
    );
  }
  return value;
}

function legacyDamageEventsSha256(value: unknown): string {
  return byteSha256(
    JSON.stringify(legacyDamageEventCanonicalize(value))
  );
}

function serializeFixture(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function atomicCreateFixture(outputUrl: URL, bytes: string): void {
  const outputPath = fileURLToPath(outputUrl);
  const temporaryPath =
    `${outputPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporaryPath, bytes, { flag: "wx" });
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

function compatibilityProjection(fixture: DefaultV146Fixture) {
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
    reactionDeliveryModel: fixture.reactionDeliveryModel,
    electroChargedPropagationModel:
      fixture.electroChargedPropagationModel,
    targetClock: fixture.targetClock,
    targetTask: fixture.targetTask,
    targetPhaseLog: fixture.targetPhaseLog,
    reactionFormulaModel: fixture.reactionFormulaModel
  };
}

function frozenV145CompatibilityProjection() {
  return {
    options: frozenV145Json.options,
    totalDamage: frozenV145Json.totalDamage,
    dps: frozenV145Json.dps,
    hitCount: frozenV145Json.hitCount,
    reactedHits: frozenV145Json.reactedHits,
    skippedActionCount: frozenV145Json.skippedActionCount,
    byCharacter: frozenV145Json.byCharacter,
    bySkill: frozenV145Json.bySkill,
    legacyDamageEventsSha256:
      frozenV145Json.legacyDamageEventsSha256,
    reactionDeliveryModel:
      frozenV145Json.reactionDeliveryModel,
    electroChargedPropagationModel:
      frozenV145Json.electroChargedPropagationModel,
    targetClock: frozenV145Json.targetClock,
    targetTask: frozenV145Json.targetTask,
    targetPhaseLog: frozenV145Json.targetPhaseLog,
    reactionFormulaModel: frozenV145Json.reactionFormulaModel
  };
}

function makeFixture(
  result: ReturnType<typeof simulate>
): DefaultV146Fixture {
  const evaluatedCount = result.directDamageGroupLog.filter(
    (entry) => entry.evaluation === "evaluated"
  ).length;
  const {
    elementalApplicationIcdRoot: _elementalApplicationIcdRoot,
    reactionOwnedElementalApplicationRoot:
      _reactionOwnedElementalApplicationRoot,
    reactionDamageGroupRoot: _reactionDamageGroupRoot,
    ...currentManifestWithoutApplicationRoot
  } = result.runManifest;
  const frozenRunManifest = {
    ...currentManifestWithoutApplicationRoot,
    version: DIRECT_DAMAGE_GROUP_RUN_MANIFEST_VERSION,
    schemaVersion: DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
    engineVersion: DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
    configHash: DEFAULT_V146_CONFIG_HASH,
    reproducibilityKey: DEFAULT_V146_REPRODUCIBILITY_KEY
  };
  return fixtureSchema.parse({
    fixtureVersion: "1.0.0",
    description: DESCRIPTION,
    provenance: {
      source: SOURCE,
      capturedAt: "2026-08-01",
      verificationStatus: "provisional",
      note: NOTE,
      officialServerTruth: false,
      completeGcsimParity: false
    },
    schemaVersion: DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
    engineVersion: DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
    configHash: DEFAULT_V146_CONFIG_HASH,
    reproducibilityKey: DEFAULT_V146_REPRODUCIBILITY_KEY,
    options: result.resolvedRuntimeOptions,
    totalDamage: result.totalDamage,
    dps: result.dps,
    hitCount: result.damageEvents.length,
    reactedHits: result.reactedHits,
    skippedActionCount: result.skippedActions.length,
    byCharacter: result.byCharacter,
    bySkill: result.bySkill.map(
      ({ creditId, actionName, damage, hits }) => ({
        creditId,
        actionName,
        damage,
        hits
      })
    ),
    legacyDamageEventsSha256: legacyDamageEventsSha256(
      result.damageEvents
    ),
    reactionDeliveryModel: result.config.reactionDeliveryModel,
    electroChargedPropagationModel:
      result.config.electroChargedPropagationModel,
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
    reactionFormulaModel: result.config.reactionFormulaModel,
    directDamageGroupModel:
      result.config.directDamageGroupModel,
    directDamageGroupAudit: {
      rowCount: result.directDamageGroupLog.length,
      evaluatedCount,
      bypassedCount:
        result.directDamageGroupLog.length - evaluatedCount,
      canonicalSha256: canonicalSha256(
        result.directDamageGroupLog
      )
    },
    runManifest: frozenRunManifest
  });
}

function loadOrCreateFixture(
  generated: DefaultV146Fixture,
  options: {
    updateRequested?: boolean;
    outputUrl?: URL;
  } = {}
): DefaultV146Fixture {
  const updateRequested =
    options.updateRequested ?? process.env[UPDATE_FLAG] === "1";
  const outputUrl = options.outputUrl ?? FIXTURE_URL;
  const sourceBytes = readFileSync(FROZEN_V145_URL);
  const sourceSha256 = byteSha256(sourceBytes);
  if (sourceSha256 !== FROZEN_V145_SHA256) {
    throw new Error(
      `Refusing to derive 1.46 from modified 1.45 source; received ${sourceSha256}.`
    );
  }
  if (
    JSON.stringify(compatibilityProjection(generated)) !==
    JSON.stringify(frozenV145CompatibilityProjection())
  ) {
    throw new Error(
      "Refusing the 1.46 default fixture because its exact 1.45 compatibility projection changed."
    );
  }

  if (updateRequested) {
    const bytes = serializeFixture(fixtureSchema.parse(generated));
    const generatedSha256 = byteSha256(bytes);
    if (generatedSha256 !== FROZEN_V146_SHA256) {
      throw new Error(
        `Refusing to write the 1.46 default fixture because its generated bytes changed: received ${generatedSha256}.`
      );
    }
    atomicCreateFixture(outputUrl, bytes);
    return generated;
  }

  const frozenBytes = readFileSync(outputUrl);
  const frozenSha256 = byteSha256(frozenBytes);
  if (frozenSha256 !== FROZEN_V146_SHA256) {
    throw new Error(
      `Frozen 1.46 default fixture changed: received ${frozenSha256}.`
    );
  }
  const fixture = fixtureSchema.parse(
    JSON.parse(frozenBytes.toString("utf8"))
  );
  if (
    JSON.stringify(compatibilityProjection(fixture)) !==
    JSON.stringify(frozenV145CompatibilityProjection())
  ) {
    throw new Error(
      "Frozen 1.46 default fixture changed its exact 1.45 compatibility projection."
    );
  }
  return fixture;
}

function runDefault() {
  return simulate(durinMeltPreset, {
    energyMode: "configured",
    critMode: "average",
    compatibilityMode: "legacy-v0.1",
    randomSeed: "legacy-default"
  });
}

describe("default 1.46 direct-damage-group Golden", () => {
  it("matches the exact default 120-second 1.46 baseline", () => {
    expect(byteSha256(readFileSync(FROZEN_V145_URL))).toBe(
      FROZEN_V145_SHA256
    );
    const result = runDefault();
    const repeated = runDefault();
    expect(repeated).toEqual(result);
    expect(simulationResultSchema.parse(result)).toEqual(result);
    expect(assertTrustedSimulationResult(result)).toBe(result);

    const generated = makeFixture(result);
    const frozen = loadOrCreateFixture(generated);
    expect(frozen).toEqual(generated);
    expect(compatibilityProjection(frozen)).toEqual(
      frozenV145CompatibilityProjection()
    );
    expect(
      result.directDamageGroupLog.every(
        (entry) =>
          entry.evaluation === "bypassed" &&
          entry.sequenceMultiplier === 1 &&
          entry.effectiveMultiplier ===
            entry.postPluginMultiplier
      )
    ).toBe(true);
    expect(canonicalSha256(result.directDamageGroupLog)).toBe(
      frozen.directDamageGroupAudit.canonicalSha256
    );
    expect(legacyDamageEventsSha256(result.damageEvents)).toBe(
      DEFAULT_DAMAGE_EVENTS_SHA256
    );
  });

  it("keeps the 1.46 fixture byte-for-byte frozen", () => {
    if (
      process.env[UPDATE_FLAG] === "1" &&
      !existsSync(fileURLToPath(FIXTURE_URL))
    ) {
      return;
    }
    expect(byteSha256(readFileSync(FIXTURE_URL))).toBe(
      FROZEN_V146_SHA256
    );
  });

  it("requires explicit creation and atomically refuses overwrite", () => {
    const generated = makeFixture(runDefault());
    const probeDirectory = mkdtempSync(
      resolve(tmpdir(), "gdl-default-v146-gate-")
    );
    const missingUrl = pathToFileURL(
      resolve(probeDirectory, "missing.golden.json")
    );
    const existingUrl = pathToFileURL(
      resolve(probeDirectory, "existing.golden.json")
    );
    try {
      expect(() =>
        loadOrCreateFixture(generated, {
          updateRequested: false,
          outputUrl: missingUrl
        })
      ).toThrow();
      expect(existsSync(fileURLToPath(missingUrl))).toBe(false);

      writeFileSync(existingUrl, "sentinel\n", { flag: "wx" });
      expect(() =>
        loadOrCreateFixture(generated, {
          updateRequested: true,
          outputUrl: existingUrl
        })
      ).toThrow(/Refusing to overwrite frozen fixture/);
      expect(readFileSync(existingUrl, "utf8")).toBe(
        "sentinel\n"
      );
    } finally {
      rmSync(probeDirectory, { recursive: true, force: true });
    }
  });
});
