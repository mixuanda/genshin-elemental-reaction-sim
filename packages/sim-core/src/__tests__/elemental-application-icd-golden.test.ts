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
import {
  GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  GCSIM_ELEMENTAL_APPLICATION_ROOT
} from "@genshin-dps-lab/icd-profiles";
import {
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  SIMULATION_RUN_MANIFEST_VERSION,
  assertTrustedSimulationResult,
  elementalApplicationIcdDecisionV147Schema,
  elementalApplicationIcdSelectorSchema,
  simulationResultSchema,
  type AbilityDefinition,
  type FrameHitDefinition,
  type SimConfig,
  type SimulationResult
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

const PREVIEW_FLAG =
  "PREVIEW_ELEMENTAL_APPLICATION_ICD_V147_GOLDEN";
const UPDATE_FLAG =
  "UPDATE_ELEMENTAL_APPLICATION_ICD_V147_GOLDEN";
const REVIEWED_FIXTURE_SHA256 =
  "9238417a2b2e54414366ecb7bb9eeba7ed2070845dff0e6c978af8e96673ddf7";
const FIXTURE_URL = new URL(
  "../../../test-vectors/fixtures/elemental-application-icd-1.47.golden.json",
  import.meta.url
);
const VECTOR_SEED = "synthetic-elemental-application-icd-v147";
const SHARED_ICD_TAG = "synthetic-shared-application-stream";
const ABILITY_ID = "synthetic-elemental-application-icd-ability";
const DESCRIPTION =
  "Full 1.47 synthetic elemental-application ICD result vector for shared actor/tag windows, group switching, numeric gauge multipliers, tail clamping, and reset-before-hit ordering.";
const SOURCE =
  "Synthetic five-hit engine regression vector bound to the fixed genshinsim/gcsim b4ae769 elemental-application profile root";
const NOTE =
  "This fixture verifies simulator state transitions only. It does not claim that the generic actor, hit labels, timings, multipliers, character skills, equipment data, or target scenario are verified game data. The bound elemental-application profile is fixed-gcsim-provisional, not official server truth or complete gcsim parity. Reaction-owned application groups, gcsim task-order parity beyond this explicit reset-before-hit boundary, particles, action-frame data, and a complete character database remain outside this fixture.";

const hitGroupId = (hitIndex: number, frame: number): string =>
  `${ABILITY_ID}#0:0:${hitIndex}:${frame}`;

const fixedDecision = ({
  multiplier,
  groupId,
  windowStartGroupId,
  resetFrames,
  windowStartFrame,
  resetAtFrame,
  hitIndex,
  sequenceIndex
}: {
  multiplier: number;
  groupId: "default" | "nahida-skill" | "chasca-tap";
  windowStartGroupId: "default" | "nahida-skill";
  resetFrames: number;
  windowStartFrame: number;
  resetAtFrame: number;
  hitIndex: number;
  sequenceIndex: number;
}) => ({
  kind: "fixed-gcsim" as const,
  evaluated: true as const,
  consumed: true as const,
  applicationMultiplier: multiplier,
  allowed: multiplier > 0,
  scope: "actor-tag" as const,
  profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  icdTag: SHARED_ICD_TAG,
  groupId,
  windowStartGroupId,
  resetFrames,
  windowStartFrame,
  resetAtFrame,
  hitIndex,
  sequenceIndex,
  tailPolicy: "clamp" as const,
  resetSchedulePolicy:
    "window-start-plus-reset-frames-minus-one" as const
});

const projectionRow = ({
  id,
  frame,
  hitId,
  groupId,
  effectiveGaugeUnits,
  reaction,
  decision
}: {
  id: number;
  frame: number;
  hitId: string;
  groupId: "default" | "nahida-skill" | "chasca-tap";
  effectiveGaugeUnits: number;
  reaction: "none" | "reverseVaporize";
  decision: ReturnType<typeof fixedDecision>;
}) => ({
  id,
  sourceKind: "configured-direct-hit" as const,
  hitResolutionLogId: id,
  damageEventId: id,
  frame,
  sourceActorId: "a",
  targetId: "enemy-0",
  hitId,
  hitGroupId: hitGroupId(id, frame),
  element: "pyro" as const,
  selector: {
    mode: "fixed-gcsim-application-v1" as const,
    icdTag: SHARED_ICD_TAG,
    groupId
  },
  nominalGaugeUnits: 1,
  effectiveGaugeUnits,
  reaction,
  decision
});

const EXPECTED_DECISIONS = [
  projectionRow({
    id: 0,
    frame: 0,
    hitId: "duplicate-hit",
    groupId: "default",
    effectiveGaugeUnits: 1,
    reaction: "reverseVaporize",
    decision: fixedDecision({
      multiplier: 1,
      groupId: "default",
      windowStartGroupId: "default",
      resetFrames: 150,
      windowStartFrame: 0,
      resetAtFrame: 149,
      hitIndex: 0,
      sequenceIndex: 0
    })
  }),
  projectionRow({
    id: 1,
    frame: 1,
    hitId: "duplicate-hit",
    groupId: "nahida-skill",
    effectiveGaugeUnits: 0,
    reaction: "none",
    decision: fixedDecision({
      multiplier: 0,
      groupId: "nahida-skill",
      windowStartGroupId: "default",
      resetFrames: 150,
      windowStartFrame: 0,
      resetAtFrame: 149,
      hitIndex: 1,
      sequenceIndex: 1
    })
  }),
  projectionRow({
    id: 2,
    frame: 2,
    hitId: "tail-clamp",
    groupId: "chasca-tap",
    effectiveGaugeUnits: 0,
    reaction: "none",
    decision: fixedDecision({
      multiplier: 0,
      groupId: "chasca-tap",
      windowStartGroupId: "default",
      resetFrames: 150,
      windowStartFrame: 0,
      resetAtFrame: 149,
      hitIndex: 2,
      sequenceIndex: 1
    })
  }),
  projectionRow({
    id: 3,
    frame: 148,
    hitId: "pre-reset",
    groupId: "nahida-skill",
    effectiveGaugeUnits: 0,
    reaction: "none",
    decision: fixedDecision({
      multiplier: 0,
      groupId: "nahida-skill",
      windowStartGroupId: "default",
      resetFrames: 150,
      windowStartFrame: 0,
      resetAtFrame: 149,
      hitIndex: 3,
      sequenceIndex: 3
    })
  }),
  projectionRow({
    id: 4,
    frame: 149,
    hitId: "reset-nahida",
    groupId: "nahida-skill",
    effectiveGaugeUnits: 1.5,
    reaction: "reverseVaporize",
    decision: fixedDecision({
      multiplier: 1.5,
      groupId: "nahida-skill",
      windowStartGroupId: "nahida-skill",
      resetFrames: 60,
      windowStartFrame: 149,
      resetAtFrame: 208,
      hitIndex: 0,
      sequenceIndex: 0
    })
  })
] as const;

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const decisionProjectionSchema = z
  .object({
    id: z.number().int().nonnegative(),
    sourceKind: z.literal("configured-direct-hit"),
    hitResolutionLogId: z.number().int().nonnegative(),
    damageEventId: z.number().int().nonnegative(),
    frame: z.number().int().nonnegative(),
    sourceActorId: z.string().min(1),
    targetId: z.string().min(1),
    hitId: z.string().min(1),
    hitGroupId: z.string().min(1),
    element: z.literal("pyro"),
    selector: elementalApplicationIcdSelectorSchema,
    nominalGaugeUnits: z.number().positive().finite(),
    effectiveGaugeUnits: z.number().nonnegative().finite(),
    reaction: z.enum(["none", "reverseVaporize"]),
    decision: elementalApplicationIcdDecisionV147Schema
  })
  .strict();

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
    expectedDecisionProjection: z.array(decisionProjectionSchema),
    elementalApplicationIcdLogCanonicalSha256: sha256Schema,
    damageEventsCanonicalSha256: sha256Schema,
    targetTimelineCanonicalSha256: sha256Schema,
    result: simulationResultSchema
  })
  .strict()
  .superRefine((fixture, context) => {
    if (
      JSON.stringify(
        canonicalize(fixture.expectedDecisionProjection)
      ) !== JSON.stringify(canonicalize(EXPECTED_DECISIONS))
    ) {
      context.addIssue({
        code: "custom",
        path: ["expectedDecisionProjection"],
        message:
          "must retain the exact reviewed five-hit application-ICD projection"
      });
    }
    if (
      fixture.result.schemaVersion !== CURRENT_SCHEMA_VERSION ||
      fixture.result.engineVersion !== CURRENT_ENGINE_VERSION ||
      fixture.result.runManifest.version !==
        SIMULATION_RUN_MANIFEST_VERSION ||
      fixture.result.randomSeed !== VECTOR_SEED ||
      fixture.result.runManifest.plugins.length !== 0 ||
      JSON.stringify(
        fixture.result.runManifest.elementalApplicationIcdRoot
      ) !== JSON.stringify(GCSIM_ELEMENTAL_APPLICATION_ROOT) ||
      fixture.result.config.elementalApplicationIcdModel.profileId !==
        GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID
    ) {
      context.addIssue({
        code: "custom",
        path: ["result", "runManifest"],
        message:
          "must bind the exact 1.47 identity, random seed, empty plugin order, and provisional application-ICD root"
      });
    }
  });

type ElementalApplicationFixture = z.output<
  typeof fixtureSchema
>;

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

function serializeFixture(
  fixture: ElementalApplicationFixture
): string {
  return `${JSON.stringify(fixture, null, 2)}\n`;
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

function reviewedFixtureSha256(): string | null {
  return /^[0-9a-f]{64}$/.test(REVIEWED_FIXTURE_SHA256)
    ? REVIEWED_FIXTURE_SHA256
    : null;
}

function assertReviewedFixtureSha256(): string {
  const reviewed = reviewedFixtureSha256();
  if (reviewed === null) {
    throw new Error(
      "Refusing to freeze the 1.47 elemental-application ICD Golden until REVIEWED_FIXTURE_SHA256 is replaced with the reviewed 64-hex candidate SHA-256."
    );
  }
  return reviewed;
}

function directHit(
  id: string,
  frame: number,
  groupId: "default" | "nahida-skill" | "chasca-tap"
): FrameHitDefinition {
  return {
    id,
    label: id,
    frame,
    scaling: 1,
    element: "pyro",
    geometry: {
      kind: "circle",
      coordinateSpace: "world",
      origin: { x: 0, y: 0 },
      radius: 1
    },
    application: {
      gaugeUnits: 1,
      icd: {
        mode: "fixed-gcsim-application-v1",
        icdTag: SHARED_ICD_TAG,
        groupId
      }
    }
  };
}

function makeVectorConfig(): SimConfig {
  const ability: AbilityDefinition = {
    id: ABILITY_ID,
    actorId: "a",
    name: "Synthetic elemental-application ICD vector",
    kind: "skill",
    cancelFrame: 149,
    animationEndFrame: 149,
    cooldownFrames: 0,
    hits: [
      directHit("duplicate-hit", 0, "default"),
      directHit("duplicate-hit", 1, "nahida-skill"),
      directHit("tail-clamp", 2, "chasca-tap"),
      directHit("pre-reset", 148, "nahida-skill"),
      directHit("reset-nahida", 149, "nahida-skill")
    ],
    particles: []
  };
  const base = makeConfig({
    elementalApplicationIcdModel: {
      mode: "fixed-gcsim-elemental-application-v1",
      profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID
    }
  });
  return {
    ...base,
    dataVersion: "synthetic-test-vector-1.47",
    randomSeed: VECTOR_SEED,
    meta: {
      name: "Synthetic elemental-application ICD Golden",
      version: "1.47",
      verificationStatus: "provisional"
    },
    duration: 3,
    cycleLength: 3,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Synthetic Hydro target",
          position: { x: 0, y: 0 },
          hitboxRadius: 0,
          initialAura: [
            { element: "hydro", gaugeUnits: 4 }
          ]
        }
      ]
    },
    rotation: [],
    reactionEngine: { mode: "aura-v9" },
    targetTaskModel: { mode: "target-phase-v2" },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "a",
      swapFrames: 1,
      abilities: [ability],
      commands: [
        {
          type: "skill",
          actorId: "a",
          abilityId: ABILITY_ID,
          atFrame: 0
        }
      ]
    }
  };
}

const OPTIONS = {
  energyMode: "configured",
  critMode: "noCrit",
  compatibilityMode: "legal-frame-v1",
  randomSeed: VECTOR_SEED
} as const;

function runVector() {
  return simulate(makeVectorConfig(), OPTIONS);
}

function targetTimelineProjection(
  result: ReturnType<typeof runVector>
) {
  return {
    auraInitialStates: result.auraInitialStates,
    auraEndStates: result.auraEndStates,
    auraTimeline: result.auraTimeline,
    targetStateTimeline: result.targetStateTimeline,
    targetClockAudit: result.targetClockAudit,
    targetClockLog: result.targetClockLog,
    targetHitlagLog: result.targetHitlagLog,
    targetTaskPhaseLog: result.targetTaskPhaseLog,
    targetPhaseLog: result.targetPhaseLog,
    targetPhaseTimeline: result.targetPhaseTimeline,
    targetMotionTimeline: result.targetMotionTimeline
  };
}

function decisionProjection(
  result: ReturnType<typeof runVector>
) {
  return result.elementalApplicationIcdLog.map((entry) => ({
    ...entry,
    reaction:
      entry.damageEventId === null
        ? "none"
        : (result.damageEvents[entry.damageEventId]?.reaction ??
          "none")
  }));
}

function makeFixture(
  result: ReturnType<typeof runVector>
): ElementalApplicationFixture {
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
    expectedDecisionProjection: EXPECTED_DECISIONS,
    elementalApplicationIcdLogCanonicalSha256: canonicalSha256(
      result.elementalApplicationIcdLog
    ),
    damageEventsCanonicalSha256: canonicalSha256(
      result.damageEvents
    ),
    targetTimelineCanonicalSha256: canonicalSha256(
      targetTimelineProjection(result)
    ),
    result
  });
}

function printPreview(
  fixture: ElementalApplicationFixture,
  bytes: string
): void {
  process.stdout.write(
    `${JSON.stringify(
      {
        fixture:
          "elemental-application-icd-1.47.golden.json",
        fixtureByteSha256: byteSha256(bytes),
        elementalApplicationIcdLogCanonicalSha256:
          fixture.elementalApplicationIcdLogCanonicalSha256,
        damageEventsCanonicalSha256:
          fixture.damageEventsCanonicalSha256,
        targetTimelineCanonicalSha256:
          fixture.targetTimelineCanonicalSha256,
        configHash: fixture.result.runManifest.configHash,
        reproducibilityKey: fixture.result.reproducibilityKey,
        totalDamage: fixture.result.totalDamage,
        dps: fixture.result.dps,
        damageEventCount: fixture.result.damageEvents.length,
        reactedHits: fixture.result.reactedHits,
        skippedActionCount: fixture.result.skippedActions.length,
        expectedDecisionProjection:
          fixture.expectedDecisionProjection,
        wroteFixture: false
      },
      null,
      2
    )}\n`
  );
}

function loadPreviewOrCreateFixture(
  generated: ElementalApplicationFixture
): ElementalApplicationFixture {
  const previewRequested = process.env[PREVIEW_FLAG] === "1";
  const updateRequested = process.env[UPDATE_FLAG] === "1";
  if (previewRequested && updateRequested) {
    throw new Error(
      "Preview and update modes are mutually exclusive."
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
        `Refusing to write the 1.47 elemental-application ICD fixture because its generated bytes do not match the reviewed SHA-256: received ${generatedSha256}.`
      );
    }
    atomicCreateFixture(FIXTURE_URL, bytes);
    return generated;
  }

  const frozenBytes = readFileSync(FIXTURE_URL);
  const frozenSha256 = byteSha256(frozenBytes);
  if (frozenSha256 !== reviewedSha256) {
    throw new Error(
      `Frozen 1.47 elemental-application ICD fixture changed: received ${frozenSha256}.`
    );
  }
  return fixtureSchema.parse(
    JSON.parse(frozenBytes.toString("utf8"))
  );
}

const candidateEnabled =
  reviewedFixtureSha256() !== null ||
  process.env[PREVIEW_FLAG] === "1" ||
  process.env[UPDATE_FLAG] === "1";

describe("1.47 elemental-application ICD Golden gate", () => {
  it("keeps the reviewed SHA and fixture presence coherent", () => {
    const reviewed = reviewedFixtureSha256();
    const fixtureExists = existsSync(fileURLToPath(FIXTURE_URL));
    if (reviewed === null) {
      expect(REVIEWED_FIXTURE_SHA256).toBe(
        "PENDING-V147-GOLDEN-REVIEW"
      );
      expect(fixtureExists).toBe(false);
      return;
    }
    expect(fixtureExists).toBe(true);
    expect(byteSha256(readFileSync(FIXTURE_URL))).toBe(reviewed);
  });

  it("requires a cryptographic reviewed hash before freezing", () => {
    if (reviewedFixtureSha256() === null) {
      expect(() => assertReviewedFixtureSha256()).toThrow(
        /reviewed 64-hex candidate SHA-256/
      );
    } else {
      expect(assertReviewedFixtureSha256()).toMatch(
        /^[0-9a-f]{64}$/
      );
    }
  });

  it("atomically refuses to overwrite an existing path", () => {
    const probeDirectory = mkdtempSync(
      resolve(tmpdir(), "gdl-application-icd-v147-gate-")
    );
    const existingUrl = pathToFileURL(
      resolve(probeDirectory, "existing.golden.json")
    );
    try {
      writeFileSync(existingUrl, "sentinel\n", { flag: "wx" });
      expect(() =>
        atomicCreateFixture(existingUrl, "replacement\n")
      ).toThrow(/Refusing to overwrite frozen fixture/);
      expect(readFileSync(existingUrl, "utf8")).toBe(
        "sentinel\n"
      );
    } finally {
      rmSync(probeDirectory, { recursive: true, force: true });
    }
  });
});

describe("1.47 elemental-application ICD Golden", () => {
  it.skipIf(!candidateEnabled)(
    "matches the synthetic shared-window, clamp, and reset vector",
    () => {
      const result = runVector();
      const repeated = runVector();
      expect(repeated).toEqual(result);
      expect(simulationResultSchema.parse(result)).toEqual(result);
      expect(assertTrustedSimulationResult(result)).toBe(result);
      expect(decisionProjection(result)).toEqual(
        EXPECTED_DECISIONS
      );

      const generated = makeFixture(result);
      const frozen = loadPreviewOrCreateFixture(generated);
      expect(frozen).toEqual(generated);
      expect(canonicalSha256(result.elementalApplicationIcdLog)).toBe(
        frozen.elementalApplicationIcdLogCanonicalSha256
      );
      expect(canonicalSha256(result.damageEvents)).toBe(
        frozen.damageEventsCanonicalSha256
      );
      expect(canonicalSha256(targetTimelineProjection(result))).toBe(
        frozen.targetTimelineCanonicalSha256
      );

      expect(result.elementalApplicationIcdLog).toHaveLength(5);
      expect(result.damageEvents).toHaveLength(5);
      expect(result.reactedHits).toBe(2);
      expect(
        result.damageEvents.every((event) => event.finalDamage > 0)
      ).toBe(true);
      expect(
        result.elementalApplicationIcdLog.map(
          (entry) => entry.hitGroupId
        )
      ).toEqual(EXPECTED_DECISIONS.map((entry) => entry.hitGroupId));

      for (const entry of result.elementalApplicationIcdLog) {
        const resolution =
          result.hitResolutionLog[entry.hitResolutionLogId];
        expect(resolution).toMatchObject({
          id: entry.hitResolutionLogId,
          outcome: "landed",
          damageEventId: entry.damageEventId
        });
        expect(entry.damageEventId).not.toBeNull();
        expect(result.damageEvents[entry.damageEventId!]).toMatchObject({
          id: entry.damageEventId,
          hitId: entry.hitId,
          hitGroupId: entry.hitGroupId,
          frame: entry.frame,
          element: entry.element
        });
      }
    }
  );
});
