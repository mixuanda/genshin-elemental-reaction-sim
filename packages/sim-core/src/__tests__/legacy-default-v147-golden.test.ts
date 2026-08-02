import { createHash } from "node:crypto";
import {
  existsSync,
  linkSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { durinMeltPreset } from "@genshin-dps-lab/game-data/presets";
import {
  GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  GCSIM_ELEMENTAL_APPLICATION_ROOT,
} from "@genshin-dps-lab/icd-profiles";
import {
  ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION,
  ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
  ELEMENTAL_APPLICATION_ICD_RUN_MANIFEST_VERSION,
  assertTrustedSimulationResultV147,
  directDamageGroupModelSchema,
  elementalApplicationIcdModelSchema,
  reactionFormulaModelSchema,
  simulationResultV147Schema,
  simulationRunManifestV147Schema,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import frozenV146Json from "../../../test-vectors/fixtures/legacy-default-120s-1.46.golden.json";
import { projectSimulationResultV148ToV147 } from "../../../test-vectors/src/project-v148-to-v147";
import { projectSimulationResultV149ToV148 } from "../../../test-vectors/src/project-v149-to-v148";
import { projectSimulationResultV150ToV149 } from "../../../test-vectors/src/project-v150-to-v149";
import { projectSimulationResultV151ToV150 } from "../../../test-vectors/src/project-v151-to-v150";
import { projectSimulationResultV152ToV151 } from "../../../test-vectors/src/project-v152-to-v151";
import { simulate } from "../simulator";

const PREVIEW_FLAG = "PREVIEW_LEGACY_DEFAULT_V147_GOLDEN";
const UPDATE_FLAG = "UPDATE_LEGACY_DEFAULT_V147_GOLDEN";
const REVIEWED_FIXTURE_SHA256 =
  "918a78d9cdd57d11d5fc9012896c5a7fc240a29b31cd9c09c9ff761fe38d8996";
const FROZEN_V146_SHA256 =
  "3ef783e206a4566fd935c3251f97d31aeb6cddb7ec7e82eccf661d62cb994465";
const DEFAULT_DAMAGE_EVENTS_SHA256 =
  "b3bddf486cf85967f8be689ccad860a450377fab5f3e2318655430324348652f";
const DEFAULT_DAMAGE_GROUP_LOG_SHA256 =
  "a9c1df34508e3fcdda365e3b6717460d618b263a2409ad843df2016de0ce0e88";
const EMPTY_APPLICATION_LOG_SHA256 =
  "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";
const DESCRIPTION =
  "Compact 1.47 elemental-application ICD root identity and result envelope for the frozen Vanilla v0.1 default 120-second compatibility baseline.";
const SOURCE =
  "simulate(durinMeltPreset) cross-checked against the byte-frozen 1.46 default fixture and legacy/v0.1-vanilla baseline";
const NOTE =
  "Regression baseline only. Character and equipment values are illustrative magic numbers, not verified game data. The 1.47 engine binds the fixed-gcsim-provisional elemental-application ICD root. This default preset configures no elemental applications, so the new audit log is exactly empty and the 1.46 damage numerics and ordinary direct-damage audit remain unchanged. This is neither official server truth nor complete gcsim parity; Aura, ICD, particles, action frames, and character database coverage not exercised here remain unverified.";

const FIXTURE_URL = new URL(
  "../../../test-vectors/fixtures/legacy-default-120s-1.47.golden.json",
  import.meta.url,
);
const FROZEN_V146_URL = new URL(
  "../../../test-vectors/fixtures/legacy-default-120s-1.46.golden.json",
  import.meta.url,
);
const EMPTY_LEGACY_COMPATIBILITY_ARRAY_FIELDS = new Set([
  "bloomReactions",
  "damageGroupDecisions",
  "playerHitResolutionLogIds",
  "playerDamageEventIds",
  "reactionTaskLog",
]);
const NULL_LEGACY_COMPATIBILITY_REFERENCE_FIELDS = new Set([
  "triggerHitGroupId",
  "sourceCoreId",
  "sourceCoreLogId",
  "selectionRadius",
  "selectedTargetId",
  "resolutionReason",
  "playerHitResolutionLogId",
  "playerDamageEventId",
]);
const V147_DAMAGE_EVENT_WIRE_ONLY_FIELDS = new Set([
  "applicationIcdDecision",
  "applicationIcdLogId",
  "applicationMultiplier",
  "nominalApplicationGaugeUnits",
  "effectiveApplicationGaugeUnits",
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
        completeGcsimParity: z.literal(false),
      })
      .strict(),
    schemaVersion: z.literal(ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION),
    engineVersion: z.literal(ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION),
    configHash: z.string().regex(/^fnv1a32:[0-9a-f]{8}$/),
    reproducibilityKey: z.string().regex(/^gdl-v2-fnv1a32-[0-9a-f]{8}$/),
    options: z
      .object({
        energyMode: z.literal("configured"),
        critMode: z.literal("average"),
        compatibilityMode: z.literal("legacy-v0.1"),
        randomSeed: z.literal("legacy-default"),
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
        lohen: z.literal(1813703.5786448019),
      })
      .strict(),
    bySkill: z.array(
      z
        .object({
          creditId: z.string().min(1),
          actionName: z.string().min(1),
          damage: z.number().finite(),
          hits: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    legacyDamageEventsSha256: z.literal(DEFAULT_DAMAGE_EVENTS_SHA256),
    reactionDeliveryModel: z.unknown(),
    electroChargedPropagationModel: z.unknown(),
    targetClock: z.unknown(),
    targetTask: z.unknown(),
    targetPhaseLog: z.unknown(),
    reactionFormulaModel: reactionFormulaModelSchema,
    directDamageGroupModel: directDamageGroupModelSchema,
    elementalApplicationIcdModel: elementalApplicationIcdModelSchema,
    directDamageGroupAudit: z
      .object({
        rowCount: z.literal(269),
        evaluatedCount: z.literal(0),
        bypassedCount: z.literal(269),
        canonicalSha256: z.literal(DEFAULT_DAMAGE_GROUP_LOG_SHA256),
      })
      .strict(),
    elementalApplicationIcdAudit: z
      .object({
        rowCount: z.literal(0),
        canonicalSha256: z.literal(EMPTY_APPLICATION_LOG_SHA256),
      })
      .strict(),
    runManifest: simulationRunManifestV147Schema,
  })
  .strict()
  .superRefine((fixture, context) => {
    if (
      fixture.runManifest.version !==
        ELEMENTAL_APPLICATION_ICD_RUN_MANIFEST_VERSION ||
      fixture.runManifest.schemaVersion !== fixture.schemaVersion ||
      fixture.runManifest.engineVersion !== fixture.engineVersion ||
      fixture.runManifest.configHash !== fixture.configHash ||
      fixture.runManifest.reproducibilityKey !== fixture.reproducibilityKey ||
      JSON.stringify(fixture.runManifest.resolvedRuntimeOptions) !==
        JSON.stringify(fixture.options) ||
      fixture.runManifest.plugins.length !== 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["runManifest"],
        message:
          "must bind the exact 1.47 default identity, options, empty plugin order, and reproducibility key",
      });
    }
    if (
      fixture.elementalApplicationIcdModel.profileId !==
        fixture.runManifest.elementalApplicationIcdRoot.profileId ||
      fixture.elementalApplicationIcdModel.profileId !==
        GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID ||
      JSON.stringify(fixture.runManifest.elementalApplicationIcdRoot) !==
        JSON.stringify(GCSIM_ELEMENTAL_APPLICATION_ROOT)
    ) {
      context.addIssue({
        code: "custom",
        path: ["runManifest", "elementalApplicationIcdRoot"],
        message:
          "must bind the exact elemental-application selector and provisional root",
      });
    }
  });

type DefaultV147Fixture = z.output<typeof fixtureSchema>;

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
        .map((key) => [key, canonicalize(record[key])]),
    );
  }
  return value;
}

function canonicalSha256(value: unknown): string {
  return byteSha256(JSON.stringify(canonicalize(value)));
}

/** Exact pre-1.45 damage-event digest projection retained by the chain. */
function legacyDamageEventCanonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => legacyDamageEventCanonicalize(entry));
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .filter((key) => {
          const field = record[key];
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
        .map((key) => [key, legacyDamageEventCanonicalize(record[key])]),
    );
  }
  return value;
}

function legacyDamageEventsSha256(value: unknown): string {
  const normalized = Array.isArray(value)
    ? value.map((entry) => {
        if (entry === null || typeof entry !== "object") {
          return entry;
        }
        const event = entry as Record<string, unknown>;
        const withoutWireOnlyFields = Object.fromEntries(
          Object.entries(event).filter(
            ([key]) => !V147_DAMAGE_EVENT_WIRE_ONLY_FIELDS.has(key),
          ),
        );
        const reactionAudit = event.reactionAudit;
        return reactionAudit !== null && typeof reactionAudit === "object"
          ? {
              ...withoutWireOnlyFields,
              reactionAudit: Object.fromEntries(
                Object.entries(reactionAudit as Record<string, unknown>).filter(
                  ([key]) => !V147_DAMAGE_EVENT_WIRE_ONLY_FIELDS.has(key),
                ),
              ),
            }
          : withoutWireOnlyFields;
      })
    : value;
  return byteSha256(JSON.stringify(legacyDamageEventCanonicalize(normalized)));
}

function serializeFixture(fixture: DefaultV147Fixture): string {
  return `${JSON.stringify(fixture, null, 2)}\n`;
}

function atomicCreateFixture(outputUrl: URL, bytes: string): void {
  const outputPath = fileURLToPath(outputUrl);
  const temporaryPath = `${outputPath}.tmp-${process.pid}-${Date.now()}`;
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
      throw new Error(`Refusing to overwrite frozen fixture ${outputPath}.`);
    }
    throw error;
  } finally {
    unlinkSync(temporaryPath);
  }
}

function reviewedFixtureSha256(): string | null {
  return /^[0-9a-f]{64}$/.test(REVIEWED_FIXTURE_SHA256)
    ? REVIEWED_FIXTURE_SHA256
    : null;
}

function assertReviewedFixtureSha256(): string {
  const reviewed = reviewedFixtureSha256();
  if (reviewed === null) {
    throw new Error(
      "Refusing to freeze the 1.47 default Golden until REVIEWED_FIXTURE_SHA256 is replaced with the reviewed 64-hex candidate SHA-256.",
    );
  }
  return reviewed;
}

function sourceV146Sha256(): string {
  return byteSha256(readFileSync(FROZEN_V146_URL));
}

function assertFrozenV146Source(): void {
  const sourceSha256 = sourceV146Sha256();
  if (sourceSha256 !== FROZEN_V146_SHA256) {
    throw new Error(
      `Refusing to derive 1.47 from modified 1.46 source; received ${sourceSha256}.`,
    );
  }
}

function compatibilityProjection(fixture: DefaultV147Fixture) {
  return {
    options: fixture.options,
    totalDamage: fixture.totalDamage,
    dps: fixture.dps,
    hitCount: fixture.hitCount,
    reactedHits: fixture.reactedHits,
    skippedActionCount: fixture.skippedActionCount,
    byCharacter: fixture.byCharacter,
    bySkill: fixture.bySkill,
    legacyDamageEventsSha256: fixture.legacyDamageEventsSha256,
    reactionDeliveryModel: fixture.reactionDeliveryModel,
    electroChargedPropagationModel: fixture.electroChargedPropagationModel,
    targetClock: fixture.targetClock,
    targetTask: fixture.targetTask,
    targetPhaseLog: fixture.targetPhaseLog,
    reactionFormulaModel: fixture.reactionFormulaModel,
    directDamageGroupModel: fixture.directDamageGroupModel,
    directDamageGroupAudit: fixture.directDamageGroupAudit,
  };
}

function frozenV146CompatibilityProjection() {
  return {
    options: frozenV146Json.options,
    totalDamage: frozenV146Json.totalDamage,
    dps: frozenV146Json.dps,
    hitCount: frozenV146Json.hitCount,
    reactedHits: frozenV146Json.reactedHits,
    skippedActionCount: frozenV146Json.skippedActionCount,
    byCharacter: frozenV146Json.byCharacter,
    bySkill: frozenV146Json.bySkill,
    legacyDamageEventsSha256: frozenV146Json.legacyDamageEventsSha256,
    reactionDeliveryModel: frozenV146Json.reactionDeliveryModel,
    electroChargedPropagationModel:
      frozenV146Json.electroChargedPropagationModel,
    targetClock: frozenV146Json.targetClock,
    targetTask: frozenV146Json.targetTask,
    targetPhaseLog: frozenV146Json.targetPhaseLog,
    reactionFormulaModel: frozenV146Json.reactionFormulaModel,
    directDamageGroupModel: frozenV146Json.directDamageGroupModel,
    directDamageGroupAudit: frozenV146Json.directDamageGroupAudit,
  };
}

function makeFixture(
  result: ReturnType<typeof runDefault>,
): DefaultV147Fixture {
  const evaluatedCount = result.directDamageGroupLog.filter(
    (entry) => entry.evaluation === "evaluated",
  ).length;
  return fixtureSchema.parse({
    fixtureVersion: "1.0.0",
    description: DESCRIPTION,
    provenance: {
      source: SOURCE,
      capturedAt: "2026-08-01",
      verificationStatus: "provisional",
      note: NOTE,
      officialServerTruth: false,
      completeGcsimParity: false,
    },
    schemaVersion: result.schemaVersion,
    engineVersion: result.engineVersion,
    configHash: result.runManifest.configHash,
    reproducibilityKey: result.reproducibilityKey,
    options: result.resolvedRuntimeOptions,
    totalDamage: result.totalDamage,
    dps: result.dps,
    hitCount: result.damageEvents.length,
    reactedHits: result.reactedHits,
    skippedActionCount: result.skippedActions.length,
    byCharacter: result.byCharacter,
    bySkill: result.bySkill.map(({ creditId, actionName, damage, hits }) => ({
      creditId,
      actionName,
      damage,
      hits,
    })),
    legacyDamageEventsSha256: legacyDamageEventsSha256(result.damageEvents),
    reactionDeliveryModel: result.config.reactionDeliveryModel,
    electroChargedPropagationModel:
      result.config.electroChargedPropagationModel,
    targetClock: {
      config: result.config.targetClockModel,
      audit: result.targetClockAudit,
      clockLog: result.targetClockLog,
      hitlagLog: result.targetHitlagLog,
    },
    targetTask: {
      config: result.config.targetTaskModel,
      phaseLog: result.targetTaskPhaseLog,
    },
    targetPhaseLog: result.targetPhaseLog,
    reactionFormulaModel: result.config.reactionFormulaModel,
    directDamageGroupModel: result.config.directDamageGroupModel,
    elementalApplicationIcdModel: result.config.elementalApplicationIcdModel,
    directDamageGroupAudit: {
      rowCount: result.directDamageGroupLog.length,
      evaluatedCount,
      bypassedCount: result.directDamageGroupLog.length - evaluatedCount,
      canonicalSha256: canonicalSha256(result.directDamageGroupLog),
    },
    elementalApplicationIcdAudit: {
      rowCount: result.elementalApplicationIcdLog.length,
      canonicalSha256: canonicalSha256(result.elementalApplicationIcdLog),
    },
    runManifest: result.runManifest,
  });
}

function printPreview(fixture: DefaultV147Fixture, bytes: string): void {
  process.stdout.write(
    `${JSON.stringify(
      {
        fixture: "legacy-default-120s-1.47.golden.json",
        sourceV146ByteSha256: sourceV146Sha256(),
        fixtureByteSha256: byteSha256(bytes),
        legacyDamageEventsSha256: fixture.legacyDamageEventsSha256,
        directDamageGroupLogCanonicalSha256:
          fixture.directDamageGroupAudit.canonicalSha256,
        elementalApplicationIcdLogCanonicalSha256:
          fixture.elementalApplicationIcdAudit.canonicalSha256,
        configHash: fixture.configHash,
        reproducibilityKey: fixture.reproducibilityKey,
        totalDamage: fixture.totalDamage,
        dps: fixture.dps,
        hitCount: fixture.hitCount,
        reactedHits: fixture.reactedHits,
        skippedActionCount: fixture.skippedActionCount,
        wroteFixture: false,
      },
      null,
      2,
    )}\n`,
  );
}

function loadPreviewOrCreateFixture(
  generated: DefaultV147Fixture,
): DefaultV147Fixture {
  const previewRequested = process.env[PREVIEW_FLAG] === "1";
  const updateRequested = process.env[UPDATE_FLAG] === "1";
  if (previewRequested && updateRequested) {
    throw new Error("Preview and update modes are mutually exclusive.");
  }
  assertFrozenV146Source();
  if (
    JSON.stringify(compatibilityProjection(generated)) !==
    JSON.stringify(frozenV146CompatibilityProjection())
  ) {
    throw new Error(
      "Refusing the 1.47 default fixture because its exact 1.46 compatibility projection changed.",
    );
  }
  const bytes = serializeFixture(fixtureSchema.parse(generated));
  if (previewRequested) {
    printPreview(generated, bytes);
    return generated;
  }
  const reviewedSha256 = assertReviewedFixtureSha256();
  if (updateRequested) {
    const generatedSha256 = byteSha256(bytes);
    if (generatedSha256 !== reviewedSha256) {
      throw new Error(
        `Refusing to write the 1.47 default fixture because its generated bytes do not match the reviewed SHA-256: received ${generatedSha256}.`,
      );
    }
    atomicCreateFixture(FIXTURE_URL, bytes);
    return generated;
  }

  const frozenBytes = readFileSync(FIXTURE_URL);
  const frozenSha256 = byteSha256(frozenBytes);
  if (frozenSha256 !== reviewedSha256) {
    throw new Error(
      `Frozen 1.47 default fixture changed: received ${frozenSha256}.`,
    );
  }
  const fixture = fixtureSchema.parse(JSON.parse(frozenBytes.toString("utf8")));
  if (
    JSON.stringify(compatibilityProjection(fixture)) !==
    JSON.stringify(frozenV146CompatibilityProjection())
  ) {
    throw new Error(
      "Frozen 1.47 default fixture changed its exact 1.46 compatibility projection.",
    );
  }
  return fixture;
}

function runDefault() {
  return projectSimulationResultV148ToV147(
    projectSimulationResultV149ToV148(
      projectSimulationResultV150ToV149(
        projectSimulationResultV151ToV150(
          projectSimulationResultV152ToV151(
            simulate(durinMeltPreset, {
              energyMode: "configured",
              critMode: "average",
              compatibilityMode: "legacy-v0.1",
              randomSeed: "legacy-default",
            }),
          ),
        ),
      ),
    ),
  );
}

const candidateEnabled =
  reviewedFixtureSha256() !== null ||
  process.env[PREVIEW_FLAG] === "1" ||
  process.env[UPDATE_FLAG] === "1";

describe("default 1.47 Golden gate", () => {
  it("derives only from the byte-frozen 1.46 source", () => {
    expect(sourceV146Sha256()).toBe(FROZEN_V146_SHA256);
    expect(() => assertFrozenV146Source()).not.toThrow();
  });

  it("keeps the reviewed SHA and fixture presence coherent", () => {
    const reviewed = reviewedFixtureSha256();
    const fixtureExists = existsSync(fileURLToPath(FIXTURE_URL));
    if (reviewed === null) {
      expect(REVIEWED_FIXTURE_SHA256).toBe("PENDING-V147-GOLDEN-REVIEW");
      expect(fixtureExists).toBe(false);
      return;
    }
    expect(fixtureExists).toBe(true);
    expect(byteSha256(readFileSync(FIXTURE_URL))).toBe(reviewed);
  });

  it("requires a cryptographic reviewed hash before freezing", () => {
    if (reviewedFixtureSha256() === null) {
      expect(() => assertReviewedFixtureSha256()).toThrow(
        /reviewed 64-hex candidate SHA-256/,
      );
    } else {
      expect(assertReviewedFixtureSha256()).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("atomically refuses to overwrite an existing path", () => {
    const probeDirectory = mkdtempSync(
      resolve(tmpdir(), "gdl-default-v147-gate-"),
    );
    const existingUrl = pathToFileURL(
      resolve(probeDirectory, "existing.golden.json"),
    );
    try {
      writeFileSync(existingUrl, "sentinel\n", { flag: "wx" });
      expect(() => atomicCreateFixture(existingUrl, "replacement\n")).toThrow(
        /Refusing to overwrite frozen fixture/,
      );
      expect(readFileSync(existingUrl, "utf8")).toBe("sentinel\n");
    } finally {
      rmSync(probeDirectory, { recursive: true, force: true });
    }
  });
});

describe("default 1.47 elemental-application ICD Golden", () => {
  it.skipIf(!candidateEnabled)(
    "matches the exact default 120-second 1.47 baseline",
    () => {
      const result = runDefault();
      const repeated = runDefault();
      expect(repeated).toEqual(result);
      expect(simulationResultV147Schema.parse(result)).toEqual(result);
      expect(assertTrustedSimulationResultV147(result)).toBe(result);

      const generated = makeFixture(result);
      const frozen = loadPreviewOrCreateFixture(generated);
      expect(frozen).toEqual(generated);
      expect(compatibilityProjection(frozen)).toEqual(
        frozenV146CompatibilityProjection(),
      );
      expect(result.elementalApplicationIcdLog).toEqual([]);
      expect(canonicalSha256(result.elementalApplicationIcdLog)).toBe(
        EMPTY_APPLICATION_LOG_SHA256,
      );
      expect(
        result.directDamageGroupLog.every(
          (entry) =>
            entry.evaluation === "bypassed" &&
            entry.sequenceMultiplier === 1 &&
            entry.effectiveMultiplier === entry.postPluginMultiplier,
        ),
      ).toBe(true);
      expect(canonicalSha256(result.directDamageGroupLog)).toBe(
        DEFAULT_DAMAGE_GROUP_LOG_SHA256,
      );
      expect(legacyDamageEventsSha256(result.damageEvents)).toBe(
        DEFAULT_DAMAGE_EVENTS_SHA256,
      );
      expect(result.runManifest.elementalApplicationIcdRoot).toEqual(
        GCSIM_ELEMENTAL_APPLICATION_ROOT,
      );
    },
  );
});
