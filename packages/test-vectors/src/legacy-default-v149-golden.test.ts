import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { durinMeltPreset } from "@genshin-dps-lab/game-data/presets";
import { GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT } from "@genshin-dps-lab/icd-profiles";
import {
  REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
  REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION,
  assertTrustedSimulationResultV147,
  assertTrustedSimulationResultV148,
  assertTrustedSimulationResultV149,
  simConfigV148Schema,
  simulationResultV147Schema,
  simulationResultV148Schema,
  simulationResultV149Schema,
  simulationRunManifestV148Schema,
  type SimulationResultForV148,
  type SimulationResultForV147,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";

import frozenV148 from "../fixtures/legacy-default-120s-1.48.golden.json";
import { simulate } from "../../sim-core/src/simulator";
import { projectSimulationResultV148ToV147 } from "./project-v148-to-v147";
import { projectSimulationResultV149ToV148 } from "./project-v149-to-v148";
import { projectSimulationResultV150ToV149 } from "./project-v150-to-v149";
import { projectSimulationResultV151ToV150 } from "./project-v151-to-v150";
import {
  byteSha256,
  canonicalSha256,
  loadPreviewOrCreateReviewedGolden,
} from "./reviewed-golden";

const PREVIEW_FLAG = "PREVIEW_LEGACY_DEFAULT_V149_GOLDEN";
const UPDATE_FLAG = "UPDATE_LEGACY_DEFAULT_V149_GOLDEN";
const REVIEWED_FIXTURE_SHA256 =
  "961505ccb95b536c3563ebeb95ec114f236f3872850df2cb98e5bc8bb5218931";
const FROZEN_V148_SHA256 =
  "563c417efe82582c9647670104b39e0c34074ceb18259a8aaa36e9c997079d5c";
const FROZEN_V147_SHA256 =
  "918a78d9cdd57d11d5fc9012896c5a7fc240a29b31cd9c09c9ff761fe38d8996";
const FROZEN_V147_APPLICATION_VECTOR_SHA256 =
  "9238417a2b2e54414366ecb7bb9eeba7ed2070845dff0e6c978af8e96673ddf7";
const EMPTY_LOG_SHA256 =
  "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";
const FIXTURE_URL = new URL(
  "../fixtures/legacy-default-120s-1.49.golden.json",
  import.meta.url,
);
const FROZEN_V148_URL = new URL(
  "../fixtures/legacy-default-120s-1.48.golden.json",
  import.meta.url,
);
const FROZEN_V147_URL = new URL(
  "../fixtures/legacy-default-120s-1.47.golden.json",
  import.meta.url,
);
const FROZEN_V147_APPLICATION_URL = new URL(
  "../fixtures/elemental-application-icd-1.47.golden.json",
  import.meta.url,
);

function runDefault() {
  return projectSimulationResultV150ToV149(
    projectSimulationResultV151ToV150(
      simulate(durinMeltPreset, {
        energyMode: "configured",
        critMode: "average",
        compatibilityMode: "legacy-v0.1",
        randomSeed: "legacy-default",
      }),
    ),
  );
}

function compactBaseline(
  result:
    | ReturnType<typeof runDefault>
    | SimulationResultForV148
    | SimulationResultForV147,
) {
  return {
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
  };
}

function frozenV148Baseline() {
  return {
    options: frozenV148.options,
    totalDamage: frozenV148.totalDamage,
    dps: frozenV148.dps,
    hitCount: frozenV148.hitCount,
    reactedHits: frozenV148.reactedHits,
    skippedActionCount: frozenV148.skippedActionCount,
    byCharacter: frozenV148.byCharacter,
    bySkill: frozenV148.bySkill,
  };
}

function currentAudit(result: ReturnType<typeof runDefault>) {
  return {
    damageEventsCanonicalSha256: canonicalSha256(result.damageEvents),
    hitResolutionLogCanonicalSha256: canonicalSha256(result.hitResolutionLog),
    reactionDamageLogRowCount: result.reactionDamageLog.length,
    reactionDamageLogCanonicalSha256: canonicalSha256(result.reactionDamageLog),
    elementalApplicationIcdLogRowCount:
      result.elementalApplicationIcdLog.length,
    elementalApplicationIcdLogCanonicalSha256: canonicalSha256(
      result.elementalApplicationIcdLog,
    ),
  };
}

function makeV148Compatibility(result: ReturnType<typeof runDefault>) {
  const projected = projectSimulationResultV149ToV148(result);
  return {
    fixtureByteSha256: FROZEN_V148_SHA256,
    schemaVersion: projected.schemaVersion,
    engineVersion: projected.engineVersion,
    configHash: projected.runManifest.configHash,
    reproducibilityKey: projected.reproducibilityKey,
    reactionOwnedElementalApplicationModel:
      projected.config.reactionOwnedElementalApplicationModel,
    runManifest: projected.runManifest,
    baseline: compactBaseline(projected),
    currentAudit: {
      damageEventsCanonicalSha256: canonicalSha256(projected.damageEvents),
      hitResolutionLogCanonicalSha256: canonicalSha256(
        projected.hitResolutionLog,
      ),
      reactionDamageLogRowCount: projected.reactionDamageLog.length,
      reactionDamageLogCanonicalSha256: canonicalSha256(
        projected.reactionDamageLog,
      ),
      elementalApplicationIcdLogRowCount:
        projected.elementalApplicationIcdLog.length,
      elementalApplicationIcdLogCanonicalSha256: canonicalSha256(
        projected.elementalApplicationIcdLog,
      ),
    },
  };
}

function frozenV148Compatibility() {
  return {
    fixtureByteSha256: FROZEN_V148_SHA256,
    schemaVersion: frozenV148.schemaVersion,
    engineVersion: frozenV148.engineVersion,
    configHash: frozenV148.configHash,
    reproducibilityKey: frozenV148.reproducibilityKey,
    reactionOwnedElementalApplicationModel:
      frozenV148.reactionOwnedElementalApplicationModel,
    runManifest: frozenV148.runManifest,
    baseline: frozenV148Baseline(),
    currentAudit: frozenV148.currentAudit,
  };
}

function makeFixture(result: ReturnType<typeof runDefault>) {
  return {
    fixtureVersion: "1.0.0" as const,
    description:
      "Compact 1.49 channel-specific reaction-owned reset-boundary identity for the frozen Vanilla v0.1 default 120-second compatibility baseline.",
    provenance: {
      source:
        "simulate(durinMeltPreset) projected through the byte-frozen 1.48 compatibility contract",
      capturedAt: "2026-08-02",
      verificationStatus: "provisional" as const,
      note: "Regression baseline only. Character and equipment values remain illustrative magic numbers, not verified game data. This default preset selects the 1.49 v2 reaction-owned policy but exercises no Burning or Swirl propagation application rows, so damage and exact 1.48 compatibility remain unchanged. This is neither official server truth nor complete gcsim parity.",
      officialServerTruth: false as const,
      completeGcsimParity: false as const,
    },
    schemaVersion: result.schemaVersion,
    engineVersion: result.engineVersion,
    configHash: result.runManifest.configHash,
    reproducibilityKey: result.reproducibilityKey,
    ...compactBaseline(result),
    v148Compatibility: makeV148Compatibility(result),
    currentAudit: currentAudit(result),
    reactionOwnedElementalApplicationModel:
      result.config.reactionOwnedElementalApplicationModel,
    runManifest: result.runManifest,
  };
}

const candidateEnabled =
  /^[0-9a-f]{64}$/.test(REVIEWED_FIXTURE_SHA256) ||
  process.env[PREVIEW_FLAG] === "1" ||
  process.env[UPDATE_FLAG] === "1";

describe("default 1.49 Golden review gate", () => {
  it("keeps every historical compatibility fixture byte-frozen", () => {
    expect(byteSha256(readFileSync(FROZEN_V148_URL))).toBe(FROZEN_V148_SHA256);
    expect(byteSha256(readFileSync(FROZEN_V147_URL))).toBe(FROZEN_V147_SHA256);
    expect(byteSha256(readFileSync(FROZEN_V147_APPLICATION_URL))).toBe(
      FROZEN_V147_APPLICATION_VECTOR_SHA256,
    );
  });

  it("keeps reviewed SHA and fixture presence coherent", () => {
    const exists = existsSync(fileURLToPath(FIXTURE_URL));
    if (!/^[0-9a-f]{64}$/.test(REVIEWED_FIXTURE_SHA256)) {
      expect(REVIEWED_FIXTURE_SHA256).toBe("PENDING-V149-GOLDEN-REVIEW");
      expect(exists).toBe(false);
      return;
    }
    expect(exists).toBe(true);
    expect(byteSha256(readFileSync(FIXTURE_URL))).toBe(REVIEWED_FIXTURE_SHA256);
  });
});

describe("default 1.49 reset-boundary Golden", () => {
  it.skipIf(!candidateEnabled)(
    "matches the exact default 120-second 1.49 baseline",
    () => {
      const result = runDefault();
      expect(runDefault()).toEqual(result);
      expect(simulationResultV149Schema.parse(result)).toEqual(result);
      expect(assertTrustedSimulationResultV149(result as never)).toBe(result);
      expect(REACTION_OWNED_RESET_BOUNDARY_SCHEMA_VERSION).toBe("1.49.0");
      expect(REACTION_OWNED_RESET_BOUNDARY_ENGINE_VERSION).toBe(
        "1.49.0-reaction-owned-reset-boundary",
      );
      expect(REACTION_OWNED_RESET_BOUNDARY_RUN_MANIFEST_VERSION).toBe("1.5.0");
      expect(result.runManifest.version).toBe("1.5.0");
      expect(result.config.reactionOwnedElementalApplicationModel.mode).toBe(
        "fixed-gcsim-reaction-owned-application-v2",
      );
      expect(result.runManifest.reactionOwnedElementalApplicationRoot).toEqual(
        GCSIM_REACTION_OWNED_APPLICATION_POLICY_ROOT,
      );
      expect(compactBaseline(result)).toEqual(frozenV148Baseline());
      expect(result.elementalApplicationIcdLog).toEqual([]);
      expect(canonicalSha256(result.elementalApplicationIcdLog)).toBe(
        EMPTY_LOG_SHA256,
      );

      const projectedV148 = projectSimulationResultV149ToV148(result);
      expect(simConfigV148Schema.parse(projectedV148.config)).toEqual(
        projectedV148.config,
      );
      expect(
        simulationRunManifestV148Schema.parse(projectedV148.runManifest),
      ).toEqual(projectedV148.runManifest);
      expect(simulationResultV148Schema.parse(projectedV148)).toEqual(
        projectedV148,
      );
      expect(assertTrustedSimulationResultV148(projectedV148)).toBe(
        projectedV148,
      );
      expect(makeV148Compatibility(result)).toEqual(frozenV148Compatibility());

      const projectedV147 = projectSimulationResultV148ToV147(projectedV148);
      expect(simulationResultV147Schema.parse(projectedV147)).toEqual(
        projectedV147,
      );
      expect(assertTrustedSimulationResultV147(projectedV147)).toBe(
        projectedV147,
      );
      expect(projectedV147.schemaVersion).toBe("1.47.0");
      expect(projectedV147.engineVersion).toBe(
        "1.47.0-elemental-application-icd-root",
      );
      expect(compactBaseline(projectedV147)).toEqual(frozenV148Baseline());

      const generated = makeFixture(result);
      const frozen = loadPreviewOrCreateReviewedGolden({
        generated,
        fixtureUrl: FIXTURE_URL,
        previewFlag: PREVIEW_FLAG,
        updateFlag: UPDATE_FLAG,
        reviewedFixtureSha256: REVIEWED_FIXTURE_SHA256,
        previewSummary: (candidate) => ({
          fixture: "legacy-default-120s-1.49.golden.json",
          sourceV148ByteSha256: FROZEN_V148_SHA256,
          configHash: candidate.configHash,
          reproducibilityKey: candidate.reproducibilityKey,
          totalDamage: candidate.totalDamage,
          dps: candidate.dps,
          hitCount: candidate.hitCount,
          reactedHits: candidate.reactedHits,
          skippedActionCount: candidate.skippedActionCount,
          damageEventsCanonicalSha256:
            candidate.currentAudit.damageEventsCanonicalSha256,
        }),
      });
      expect(frozen).toEqual(generated);
    },
  );

  it.skipIf(!candidateEnabled)(
    "fails closed when a 1.49 run has reaction-owned rows",
    () => {
      const result = runDefault();
      const directRow = result.elementalApplicationIcdLog[0];
      expect(directRow).toBeUndefined();

      expect(() =>
        projectSimulationResultV149ToV148({
          ...result,
          elementalApplicationIcdLog: [
            {
              sourceKind: "burning-tick",
            },
          ] as never,
        }),
      ).toThrow(/no faithful V1\.48 wire projection/);
    },
  );
});
