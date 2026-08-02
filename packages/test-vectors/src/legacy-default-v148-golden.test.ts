import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { durinMeltPreset } from "@genshin-dps-lab/game-data/presets";
import {
  GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT
} from "@genshin-dps-lab/icd-profiles";
import {
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  SIMULATION_RUN_MANIFEST_VERSION,
  assertTrustedSimulationResult,
  simulationResultSchema
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import frozenV147 from "../fixtures/legacy-default-120s-1.47.golden.json";
import { simulate } from "../../sim-core/src/simulator";
import { projectSimulationResultV148ToV147 } from "./project-v148-to-v147";
import {
  atomicCreateGolden,
  byteSha256,
  canonicalSha256,
  loadPreviewOrCreateReviewedGolden
} from "./reviewed-golden";

const PREVIEW_FLAG = "PREVIEW_LEGACY_DEFAULT_V148_GOLDEN";
const UPDATE_FLAG = "UPDATE_LEGACY_DEFAULT_V148_GOLDEN";
const REVIEWED_FIXTURE_SHA256 =
  "563c417efe82582c9647670104b39e0c34074ceb18259a8aaa36e9c997079d5c";
const FROZEN_V147_SHA256 =
  "918a78d9cdd57d11d5fc9012896c5a7fc240a29b31cd9c09c9ff761fe38d8996";
const FROZEN_V147_APPLICATION_VECTOR_SHA256 =
  "9238417a2b2e54414366ecb7bb9eeba7ed2070845dff0e6c978af8e96673ddf7";
const EMPTY_LOG_SHA256 =
  "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";
const FIXTURE_URL = new URL(
  "../fixtures/legacy-default-120s-1.48.golden.json",
  import.meta.url
);
const FROZEN_V147_URL = new URL(
  "../fixtures/legacy-default-120s-1.47.golden.json",
  import.meta.url
);
const FROZEN_V147_APPLICATION_URL = new URL(
  "../fixtures/elemental-application-icd-1.47.golden.json",
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
const V147_DAMAGE_EVENT_WIRE_ONLY_FIELDS = new Set([
  "applicationIcdDecision",
  "applicationIcdLogId",
  "applicationMultiplier",
  "nominalApplicationGaugeUnits",
  "effectiveApplicationGaugeUnits"
]);

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
  const normalized = Array.isArray(value)
    ? value.map((entry) => {
        if (entry === null || typeof entry !== "object") {
          return entry;
        }
        const event = entry as Record<string, unknown>;
        const withoutWireOnlyFields = Object.fromEntries(
          Object.entries(event).filter(
            ([key]) => !V147_DAMAGE_EVENT_WIRE_ONLY_FIELDS.has(key)
          )
        );
        const reactionAudit = event.reactionAudit;
        return reactionAudit !== null &&
          typeof reactionAudit === "object"
          ? {
              ...withoutWireOnlyFields,
              reactionAudit: Object.fromEntries(
                Object.entries(
                  reactionAudit as Record<string, unknown>
                ).filter(
                  ([key]) =>
                    !V147_DAMAGE_EVENT_WIRE_ONLY_FIELDS.has(key)
                )
              )
            }
          : withoutWireOnlyFields;
      })
    : value;
  return createHash("sha256")
    .update(
      JSON.stringify(legacyDamageEventCanonicalize(normalized))
    )
    .digest("hex");
}

function runDefault() {
  return simulate(durinMeltPreset, {
    energyMode: "configured",
    critMode: "average",
    compatibilityMode: "legacy-v0.1",
    randomSeed: "legacy-default"
  });
}

function v147CompatibilityProjection(
  result: ReturnType<typeof runDefault>
) {
  const projected = projectSimulationResultV148ToV147(result);
  return {
    options: projected.resolvedRuntimeOptions,
    totalDamage: projected.totalDamage,
    dps: projected.dps,
    hitCount: projected.damageEvents.length,
    reactedHits: projected.reactedHits,
    skippedActionCount: projected.skippedActions.length,
    byCharacter: projected.byCharacter,
    bySkill: projected.bySkill.map(
      ({ creditId, actionName, damage, hits }) => ({
        creditId,
        actionName,
        damage,
        hits
      })
    ),
    legacyDamageEventsSha256: legacyDamageEventsSha256(
      projected.damageEvents
    ),
    reactionDeliveryModel: projected.config.reactionDeliveryModel,
    electroChargedPropagationModel:
      projected.config.electroChargedPropagationModel,
    targetClock: {
      config: projected.config.targetClockModel,
      audit: projected.targetClockAudit,
      clockLog: projected.targetClockLog,
      hitlagLog: projected.targetHitlagLog
    },
    targetTask: {
      config: projected.config.targetTaskModel,
      phaseLog: projected.targetTaskPhaseLog
    },
    targetPhaseLog: projected.targetPhaseLog,
    reactionFormulaModel: projected.config.reactionFormulaModel,
    directDamageGroupModel: projected.config.directDamageGroupModel,
    directDamageGroupAudit: {
      rowCount: projected.directDamageGroupLog.length,
      evaluatedCount: projected.directDamageGroupLog.filter(
        (entry) => entry.evaluation === "evaluated"
      ).length,
      bypassedCount: projected.directDamageGroupLog.filter(
        (entry) => entry.evaluation === "bypassed"
      ).length,
      canonicalSha256: canonicalSha256(
        projected.directDamageGroupLog
      )
    }
  };
}

function frozenV147CompatibilityProjection() {
  return {
    options: frozenV147.options,
    totalDamage: frozenV147.totalDamage,
    dps: frozenV147.dps,
    hitCount: frozenV147.hitCount,
    reactedHits: frozenV147.reactedHits,
    skippedActionCount: frozenV147.skippedActionCount,
    byCharacter: frozenV147.byCharacter,
    bySkill: frozenV147.bySkill,
    legacyDamageEventsSha256:
      frozenV147.legacyDamageEventsSha256,
    reactionDeliveryModel: frozenV147.reactionDeliveryModel,
    electroChargedPropagationModel:
      frozenV147.electroChargedPropagationModel,
    targetClock: frozenV147.targetClock,
    targetTask: frozenV147.targetTask,
    targetPhaseLog: frozenV147.targetPhaseLog,
    reactionFormulaModel: frozenV147.reactionFormulaModel,
    directDamageGroupModel: frozenV147.directDamageGroupModel,
    directDamageGroupAudit: frozenV147.directDamageGroupAudit
  };
}

function makeFixture(result: ReturnType<typeof runDefault>) {
  return {
    fixtureVersion: "1.0.0" as const,
    description:
      "Compact 1.48 reaction-owned elemental-application root identity for the frozen Vanilla v0.1 default 120-second compatibility baseline.",
    provenance: {
      source:
        "simulate(durinMeltPreset) projected through the byte-frozen 1.47 compatibility contract",
      capturedAt: "2026-08-02",
      verificationStatus: "provisional" as const,
      note:
        "Regression baseline only. Character and equipment values remain illustrative magic numbers, not verified game data. This default preset exercises no reaction-owned Burning or Swirl propagation application rows, so 1.48 changes identity and backlinks only while preserving the exact reviewed 1.47 compatibility projection. This is neither official server truth nor complete gcsim parity.",
      officialServerTruth: false as const,
      completeGcsimParity: false as const
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
    bySkill: result.bySkill.map(
      ({ creditId, actionName, damage, hits }) => ({
        creditId,
        actionName,
        damage,
        hits
      })
    ),
    v147Compatibility: {
      fixtureByteSha256: FROZEN_V147_SHA256,
      projection: v147CompatibilityProjection(result)
    },
    currentAudit: {
      damageEventsCanonicalSha256: canonicalSha256(
        result.damageEvents
      ),
      hitResolutionLogCanonicalSha256: canonicalSha256(
        result.hitResolutionLog
      ),
      reactionDamageLogRowCount: result.reactionDamageLog.length,
      reactionDamageLogCanonicalSha256: canonicalSha256(
        result.reactionDamageLog
      ),
      elementalApplicationIcdLogRowCount:
        result.elementalApplicationIcdLog.length,
      elementalApplicationIcdLogCanonicalSha256: canonicalSha256(
        result.elementalApplicationIcdLog
      )
    },
    reactionOwnedElementalApplicationModel:
      result.config.reactionOwnedElementalApplicationModel,
    runManifest: result.runManifest
  };
}

const candidateEnabled =
  /^[0-9a-f]{64}$/.test(REVIEWED_FIXTURE_SHA256) ||
  process.env[PREVIEW_FLAG] === "1" ||
  process.env[UPDATE_FLAG] === "1";

describe("default 1.48 Golden review gate", () => {
  it("keeps both reviewed 1.47 fixtures byte-frozen", () => {
    expect(byteSha256(readFileSync(FROZEN_V147_URL))).toBe(
      FROZEN_V147_SHA256
    );
    expect(
      byteSha256(readFileSync(FROZEN_V147_APPLICATION_URL))
    ).toBe(FROZEN_V147_APPLICATION_VECTOR_SHA256);
  });

  it("keeps reviewed SHA and fixture presence coherent", () => {
    const exists = existsSync(fileURLToPath(FIXTURE_URL));
    if (!/^[0-9a-f]{64}$/.test(REVIEWED_FIXTURE_SHA256)) {
      expect(REVIEWED_FIXTURE_SHA256).toBe(
        "PENDING-V148-GOLDEN-REVIEW"
      );
      expect(exists).toBe(false);
      return;
    }
    expect(exists).toBe(true);
    expect(byteSha256(readFileSync(FIXTURE_URL))).toBe(
      REVIEWED_FIXTURE_SHA256
    );
  });

  it("atomically refuses to overwrite an existing path", () => {
    const directory = mkdtempSync(
      resolve(tmpdir(), "gdl-default-v148-gate-")
    );
    const fixtureUrl = pathToFileURL(
      resolve(directory, "existing.golden.json")
    );
    try {
      writeFileSync(fixtureUrl, "sentinel\n", { flag: "wx" });
      expect(() =>
        atomicCreateGolden(fixtureUrl, "replacement\n")
      ).toThrow(/Refusing to overwrite frozen fixture/);
      expect(readFileSync(fixtureUrl, "utf8")).toBe("sentinel\n");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("default 1.48 reaction-owned application Golden", () => {
  it.skipIf(!candidateEnabled)(
    "matches the exact default 120-second 1.48 baseline",
    () => {
      const result = runDefault();
      expect(runDefault()).toEqual(result);
      expect(simulationResultSchema.parse(result)).toEqual(result);
      expect(assertTrustedSimulationResult(result)).toBe(result);
      expect(CURRENT_SCHEMA_VERSION).toBe("1.48.0");
      expect(CURRENT_ENGINE_VERSION).toBe(
        "1.48.0-reaction-owned-application-root"
      );
      expect(SIMULATION_RUN_MANIFEST_VERSION).toBe("1.4.0");
      expect(result.runManifest.version).toBe("1.4.0");
      expect(
        result.runManifest.reactionOwnedElementalApplicationRoot
      ).toEqual(GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT);
      expect(v147CompatibilityProjection(result)).toEqual(
        frozenV147CompatibilityProjection()
      );
      expect(result.elementalApplicationIcdLog).toEqual([]);
      expect(
        canonicalSha256(result.elementalApplicationIcdLog)
      ).toBe(EMPTY_LOG_SHA256);

      const generated = makeFixture(result);
      const frozen = loadPreviewOrCreateReviewedGolden({
        generated,
        fixtureUrl: FIXTURE_URL,
        previewFlag: PREVIEW_FLAG,
        updateFlag: UPDATE_FLAG,
        reviewedFixtureSha256: REVIEWED_FIXTURE_SHA256,
        previewSummary: (candidate) => ({
          fixture: "legacy-default-120s-1.48.golden.json",
          sourceV147ByteSha256: FROZEN_V147_SHA256,
          configHash: candidate.configHash,
          reproducibilityKey: candidate.reproducibilityKey,
          totalDamage: candidate.totalDamage,
          dps: candidate.dps,
          hitCount: candidate.hitCount,
          reactedHits: candidate.reactedHits,
          skippedActionCount: candidate.skippedActionCount,
          damageEventsCanonicalSha256:
            candidate.currentAudit.damageEventsCanonicalSha256
        })
      });
      expect(frozen).toEqual(generated);
    }
  );
});
