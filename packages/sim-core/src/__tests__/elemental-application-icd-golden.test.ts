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
import {
  GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
  GCSIM_ELEMENTAL_APPLICATION_ROOT,
} from "@genshin-dps-lab/icd-profiles";
import {
  ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION,
  ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION,
  ELEMENTAL_APPLICATION_ICD_RUN_MANIFEST_VERSION,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  assertTrustedSimulationResult,
  assertTrustedSimulationResultV147,
  elementalApplicationIcdDecisionV147Schema,
  elementalApplicationIcdSelectorSchema,
  simulationResultV147Schema,
  simulationResultSchema,
  type AbilityDefinition,
  type FrameHitDefinition,
  type SimConfig,
  type SimulationResult,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { simulate } from "../simulator";
import { parseSimulationHit, replaySimulationHit } from "../calculator-bridge";
import { projectSimulationResultV148ToV147 } from "../../../test-vectors/src/project-v148-to-v147";
import { projectSimulationResultV149ToV148 } from "../../../test-vectors/src/project-v149-to-v148";
import { projectSimulationResultV150ToV149 } from "../../../test-vectors/src/project-v150-to-v149";
import { projectSimulationResultV151ToV150 } from "../../../test-vectors/src/project-v151-to-v150";
import { projectSimulationResultV152ToV151 } from "../../../test-vectors/src/project-v152-to-v151";
import { projectSimulationResultV153ToV152 } from "../../../test-vectors/src/project-v153-to-v152";
import { makeConfig } from "./fixtures";

const PREVIEW_FLAG = "PREVIEW_ELEMENTAL_APPLICATION_ICD_V147_GOLDEN";
const UPDATE_FLAG = "UPDATE_ELEMENTAL_APPLICATION_ICD_V147_GOLDEN";
const REVIEWED_FIXTURE_SHA256 =
  "9238417a2b2e54414366ecb7bb9eeba7ed2070845dff0e6c978af8e96673ddf7";
const FIXTURE_URL = new URL(
  "../../../test-vectors/fixtures/elemental-application-icd-1.47.golden.json",
  import.meta.url,
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
  sequenceIndex,
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
  resetSchedulePolicy: "window-start-plus-reset-frames-minus-one" as const,
});

const projectionRow = ({
  id,
  frame,
  hitId,
  groupId,
  effectiveGaugeUnits,
  reaction,
  decision,
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
    groupId,
  },
  nominalGaugeUnits: 1,
  effectiveGaugeUnits,
  reaction,
  decision,
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
      sequenceIndex: 0,
    }),
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
      sequenceIndex: 1,
    }),
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
      sequenceIndex: 1,
    }),
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
      sequenceIndex: 3,
    }),
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
      sequenceIndex: 0,
    }),
  }),
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
    decision: elementalApplicationIcdDecisionV147Schema,
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
        completeGcsimParity: z.literal(false),
      })
      .strict(),
    expectedDecisionProjection: z.array(decisionProjectionSchema),
    elementalApplicationIcdLogCanonicalSha256: sha256Schema,
    damageEventsCanonicalSha256: sha256Schema,
    targetTimelineCanonicalSha256: sha256Schema,
    result: simulationResultV147Schema,
  })
  .strict()
  .superRefine((fixture, context) => {
    if (
      JSON.stringify(canonicalize(fixture.expectedDecisionProjection)) !==
      JSON.stringify(canonicalize(EXPECTED_DECISIONS))
    ) {
      context.addIssue({
        code: "custom",
        path: ["expectedDecisionProjection"],
        message:
          "must retain the exact reviewed five-hit application-ICD projection",
      });
    }
    if (
      fixture.result.schemaVersion !==
        ELEMENTAL_APPLICATION_ICD_ROOT_SCHEMA_VERSION ||
      fixture.result.engineVersion !==
        ELEMENTAL_APPLICATION_ICD_ROOT_ENGINE_VERSION ||
      fixture.result.runManifest.version !==
        ELEMENTAL_APPLICATION_ICD_RUN_MANIFEST_VERSION ||
      fixture.result.randomSeed !== VECTOR_SEED ||
      fixture.result.runManifest.plugins.length !== 0 ||
      JSON.stringify(fixture.result.runManifest.elementalApplicationIcdRoot) !==
        JSON.stringify(GCSIM_ELEMENTAL_APPLICATION_ROOT) ||
      fixture.result.config.elementalApplicationIcdModel.profileId !==
        GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID
    ) {
      context.addIssue({
        code: "custom",
        path: ["result", "runManifest"],
        message:
          "must bind the exact 1.47 identity, random seed, empty plugin order, and provisional application-ICD root",
      });
    }
  });

type ElementalApplicationFixture = z.output<typeof fixtureSchema>;

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

function serializeFixture(fixture: ElementalApplicationFixture): string {
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
      "Refusing to freeze the 1.47 elemental-application ICD Golden until REVIEWED_FIXTURE_SHA256 is replaced with the reviewed 64-hex candidate SHA-256.",
    );
  }
  return reviewed;
}

function directHit(
  id: string,
  frame: number,
  groupId: "default" | "nahida-skill" | "chasca-tap",
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
      radius: 1,
    },
    application: {
      gaugeUnits: 1,
      icd: {
        mode: "fixed-gcsim-application-v1",
        icdTag: SHARED_ICD_TAG,
        groupId,
      },
    },
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
      directHit("reset-nahida", 149, "nahida-skill"),
    ],
    particles: [],
  };
  const base = makeConfig({
    elementalApplicationIcdModel: {
      mode: "fixed-gcsim-elemental-application-v1",
      profileId: GCSIM_ELEMENTAL_APPLICATION_PROFILE_ID,
    },
  });
  return {
    ...base,
    dataVersion: "synthetic-test-vector-1.47",
    randomSeed: VECTOR_SEED,
    meta: {
      name: "Synthetic elemental-application ICD Golden",
      version: "1.47",
      verificationStatus: "provisional",
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
          initialAura: [{ element: "hydro", gaugeUnits: 4 }],
        },
      ],
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
          atFrame: 0,
        },
      ],
    },
  };
}

const OPTIONS = {
  energyMode: "configured",
  critMode: "noCrit",
  compatibilityMode: "legal-frame-v1",
  randomSeed: VECTOR_SEED,
} as const;

function projectHistoricalResultToV147(result: SimulationResult) {
  return projectSimulationResultV148ToV147(
    projectSimulationResultV149ToV148(
      projectSimulationResultV150ToV149(
        projectSimulationResultV151ToV150(
          projectSimulationResultV152ToV151(
            projectSimulationResultV153ToV152(
              result,
            ),
          ),
        ),
      ),
    ),
  );
}

function runVector() {
  return projectHistoricalResultToV147(historicalElementalIcdResult());
}

function targetTimelineProjection(result: ReturnType<typeof runVector>) {
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
    targetMotionTimeline: result.targetMotionTimeline,
  };
}

function decisionProjection(result: {
  elementalApplicationIcdLog: SimulationResult["elementalApplicationIcdLog"];
  damageEvents: ReadonlyArray<Pick<SimulationResult["damageEvents"][number], "reaction">>;
}) {
  return result.elementalApplicationIcdLog.map((entry) => ({
    ...entry,
    reaction:
      entry.damageEventId === null
        ? "none"
        : (result.damageEvents[entry.damageEventId]?.reaction ?? "none"),
  }));
}

function makeFixture(
  result: ReturnType<typeof runVector>,
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
      completeGcsimParity: false,
    },
    expectedDecisionProjection: EXPECTED_DECISIONS,
    elementalApplicationIcdLogCanonicalSha256: canonicalSha256(
      result.elementalApplicationIcdLog,
    ),
    damageEventsCanonicalSha256: canonicalSha256(result.damageEvents),
    targetTimelineCanonicalSha256: canonicalSha256(
      targetTimelineProjection(result),
    ),
    result,
  });
}

function printPreview(
  fixture: ElementalApplicationFixture,
  bytes: string,
): void {
  process.stdout.write(
    `${JSON.stringify(
      {
        fixture: "elemental-application-icd-1.47.golden.json",
        fixtureByteSha256: byteSha256(bytes),
        elementalApplicationIcdLogCanonicalSha256:
          fixture.elementalApplicationIcdLogCanonicalSha256,
        damageEventsCanonicalSha256: fixture.damageEventsCanonicalSha256,
        targetTimelineCanonicalSha256: fixture.targetTimelineCanonicalSha256,
        configHash: fixture.result.runManifest.configHash,
        reproducibilityKey: fixture.result.reproducibilityKey,
        totalDamage: fixture.result.totalDamage,
        dps: fixture.result.dps,
        damageEventCount: fixture.result.damageEvents.length,
        reactedHits: fixture.result.reactedHits,
        skippedActionCount: fixture.result.skippedActions.length,
        expectedDecisionProjection: fixture.expectedDecisionProjection,
        wroteFixture: false,
      },
      null,
      2,
    )}\n`,
  );
}

function loadPreviewOrCreateFixture(
  generated: ElementalApplicationFixture,
): ElementalApplicationFixture {
  const previewRequested = process.env[PREVIEW_FLAG] === "1";
  const updateRequested = process.env[UPDATE_FLAG] === "1";
  if (previewRequested && updateRequested) {
    throw new Error("Preview and update modes are mutually exclusive.");
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
        `Refusing to write the 1.47 elemental-application ICD fixture because its generated bytes do not match the reviewed SHA-256: received ${generatedSha256}.`,
      );
    }
    atomicCreateFixture(FIXTURE_URL, bytes);
    return generated;
  }

  const frozenBytes = readFileSync(FIXTURE_URL);
  const frozenSha256 = byteSha256(frozenBytes);
  if (frozenSha256 !== reviewedSha256) {
    throw new Error(
      `Frozen 1.47 elemental-application ICD fixture changed: received ${frozenSha256}.`,
    );
  }
  return fixtureSchema.parse(JSON.parse(frozenBytes.toString("utf8")));
}

const candidateEnabled =
  reviewedFixtureSha256() !== null ||
  process.env[PREVIEW_FLAG] === "1" ||
  process.env[UPDATE_FLAG] === "1";


const historicalElementalIcdBytes = readFileSync(new URL(
  "../../../test-vectors/src/fixtures/historical-elemental-application-icd-v153-84ff5cd.json", import.meta.url,
));
const historicalElementalIcdArchive = JSON.parse(historicalElementalIcdBytes.toString("utf8")) as {
  fixtureVersion: string; source: { commit: string }; observedRunCount: number; sourceWireSha256: string; sourceWireText: string;
};
function historicalElementalIcdResult(): SimulationResult {
  expect(byteSha256(historicalElementalIcdBytes)).toBe("3930dbcae13f9ca3bf54288652f46ac5d249354b4d95b7f13c3afb720cac1f41");
  expect(byteSha256(historicalElementalIcdArchive.sourceWireText)).toBe(historicalElementalIcdArchive.sourceWireSha256);
  const result = JSON.parse(historicalElementalIcdArchive.sourceWireText) as SimulationResult;
  expect(result.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(result.runManifest.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(simulationResultSchema.parse(result)).toEqual(result);
  expect(assertTrustedSimulationResult(result)).toBe(result);
  return result;
}

function elementalIcdMechanics(result: SimulationResult) {
  const { runManifest: _manifest, resolvedRuntimeOptions: _options, reproducibilityKey: _key, ...mechanics } = result;
  return mechanics;
}

function fixedIcdDecisionAt(result: SimulationResult, id: number) {
  const decision = result.elementalApplicationIcdLog[id]?.decision;
  if (decision?.kind !== "fixed-gcsim") {
    throw new Error(`Expected configured fixed-gcsim ICD decision at ${id}`);
  }
  return decision;
}

function expectCurrentElementalIcdContract(result: SimulationResult): void {
  const before = JSON.stringify(result);
  const historical = historicalElementalIcdResult();
  expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  expect(result.engineVersion).toBe(CURRENT_ENGINE_VERSION);
  expect(result.resolvedRuntimeOptions).toEqual({ ...historical.resolvedRuntimeOptions, flatStatBuffSemantics: "canonical-v1" });
  expect(result.runManifest.resolvedRuntimeOptions).toEqual(result.resolvedRuntimeOptions);
  expect(result.runManifest.reproducibilityKey).toBe(result.reproducibilityKey);
  expect(result.reproducibilityKey).not.toBe(historical.reproducibilityKey);
  const { reproducibilityKey: _oldKey, resolvedRuntimeOptions: _oldOptions, ...oldManifest } = historical.runManifest;
  const { reproducibilityKey: _key, resolvedRuntimeOptions: _options, ...manifest } = result.runManifest;
  expect(manifest).toEqual(oldManifest);
  expect(simulationResultSchema.parse(JSON.parse(before))).toEqual(result);
  expect(assertTrustedSimulationResult(result)).toBe(result);

  // Complete expected mechanics, not a current-wire converter. Only these five
  // direct application points move from I0 to I1: current hit resolution reserves
  // I0 first. The old/new resolution positions and every queue/reference remain
  // explicit. No IDs, phase rows, ICD decisions, Aura fields or damage are erased.
  const expected = structuredClone(elementalIcdMechanics(historical));
  expect(expected.targetStateTimeline.points.map((point) => point.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  for (const id of [0, 1, 2, 3, 4]) {
    const point = expected.targetStateTimeline.points[id + 1]!;
    expect(point).toMatchObject({ id: id + 1, frame: EXPECTED_DECISIONS[id]!.frame,
      targetFrame: EXPECTED_DECISIONS[id]!.frame, cause: "direct-hit-application",
      eventType: "hit", eventPriority: 3, eventSequence: id + 1, intraEventSequence: 0,
      primaryDamageEventId: id, links: [{ kind: "damage-event", id }] });
    expect(expected.hitResolutionLog[id]).toMatchObject({ id, frame: EXPECTED_DECISIONS[id]!.frame,
      eventPriority: 3, eventSequence: id + 1, intraEventSequence: 0, damageEventId: id });
    point.intraEventSequence = 1;
  }
  expect(elementalIcdMechanics(result)).toStrictEqual(expected);
  expect(decisionProjection(result)).toEqual(EXPECTED_DECISIONS);
  expect(canonicalSha256(result.elementalApplicationIcdLog)).toBe("66eab58f46d75556a661e51cd0ed16c9cc46d9ff5048365d3bb886b8c9643d62");
  expect(result.elementalApplicationIcdLog).toEqual(historical.elementalApplicationIcdLog);
  expect(result.damageEvents).toEqual(historical.damageEvents);

  // Independent neutral ATK1000, level90 vs90 DEF, resistance10%, EM0,
  // no crit/bonus: 450 ordinary damage and 675 reverse Vaporize. The final
  // Nahida application multiplier 1.5 changes gauge, NOT the damage multiplier
  // beyond the ordinary 1.5 Vaporize factor. ICD-blocked hits still deal damage.
  const defense = (90 + 100) / ((90 + 100) + (90 + 100));
  const ordinary = 1000 * defense * (1 - 0.1);
  const vaporize = ordinary * 1.5;
  const damage = [vaporize, ordinary, ordinary, ordinary, vaporize];
  expect(ordinary).toBe(450);
  expect(vaporize).toBe(675);
  expect(result.damageEvents.map((event) => event.finalDamage)).toEqual(damage);
  expect(result.totalDamage).toBe(2 * vaporize + 3 * ordinary);
  expect(result.dps).toBe((2 * vaporize + 3 * ordinary) / 3);
  expect(result.reactedHits).toBe(2);

  // Fixed actor/tag windows survive group changes. Current-group sequences
  // consume the shared counter, clamp Chasca's two-slot tail, and preserve the
  // first window's reset deadline. F149 = 0 + 150 - 1 resets BEFORE this hit,
  // while F148 does not; Nahida opens a new 60-frame window ending at F208.
  expect(result.elementalApplicationIcdLog.map((_, id) => fixedIcdDecisionAt(result, id).hitIndex)).toEqual([0, 1, 2, 3, 0]);
  expect(result.elementalApplicationIcdLog.map((_, id) => fixedIcdDecisionAt(result, id).sequenceIndex)).toEqual([0, 1, 1, 3, 0]);
  expect(result.elementalApplicationIcdLog.map((_, id) => fixedIcdDecisionAt(result, id).resetAtFrame)).toEqual([149, 149, 149, 149, 208]);
  expect(result.elementalApplicationIcdLog.map((entry) => entry.effectiveGaugeUnits)).toEqual([1, 0, 0, 0, 1.5]);
  expect(new Set(result.elementalApplicationIcdLog.map((entry) => entry.hitGroupId)).size).toBe(5);
  expect(result.elementalApplicationIcdLog.slice(0, 2).map((entry) => entry.hitId)).toEqual(["duplicate-hit", "duplicate-hit"]);

  // Independent aura-v9 durability: 4U becomes 3.2U after the 0.8 aura tax;
  // lifetime is 420 + 150*4 = 1020 frames. Reverse Vaporize consumes half the
  // effective Pyro gauge (0.5U then 0.75U) without resetting Hydro's decay rate.
  // Only expected values are rounded to the documented 12-digit snapshot form.
  const initialGauge = 4 * 0.8;
  const lifetime = 420 + 150 * 4;
  const decayPerFrame = initialGauge / lifetime;
  const clean = (gauge: number) => Number(gauge.toFixed(12));
  const hydro = (gauge: number, expiresAtFrame: number) => [{ element: "hydro", gaugeUnits: clean(gauge), expiresAtFrame,
    sourceSlots: [{ sourceActorId: "__initial__", gaugeUnits: clean(gauge) }] }];
  const firstExpiry = Math.ceil((initialGauge - 0.5) / decayPerFrame);
  const lastAfter = initialGauge - 0.5 - 149 * decayPerFrame - 0.75;
  const lastExpiry = 149 + Math.ceil(lastAfter / decayPerFrame);
  expect([lifetime, firstExpiry, lastExpiry]).toEqual([1020, 861, 622]);
  expect(result.auraInitialStates).toHaveLength(1);
  expect(result.auraInitialStates[0]).toMatchObject({ targetId: "enemy-0", frame: 0, aura: hydro(initialGauge, lifetime) });
  expect(result.auraEndStates).toHaveLength(1);
  expect(result.auraEndStates[0]).toMatchObject({ targetId: "enemy-0", frame: 180,
    aura: hydro(initialGauge - 0.5 - 0.75 - 180 * decayPerFrame, lastExpiry) });
  expect(result.auraTimeline).toHaveLength(5);
  expect(result.targetPhaseLog).toHaveLength(5);
  for (const [id, expectedDecision] of EXPECTED_DECISIONS.entries()) {
    const { frame, effectiveGaugeUnits, reaction } = expectedDecision;
    const gaugeBefore = id === 0 ? initialGauge : initialGauge - 0.5 - frame * decayPerFrame;
    const gaugeConsumed = effectiveGaugeUnits * 0.5;
    const gaugeAfter = gaugeBefore - gaugeConsumed;
    const auraBefore = hydro(gaugeBefore, id === 0 ? lifetime : firstExpiry);
    const auraAfter = hydro(gaugeAfter, id === 4 ? lastExpiry : firstExpiry);
    const auraApplied = effectiveGaugeUnits === 0 ? [] : [{ element: "pyro", gaugeUnits: effectiveGaugeUnits, sourceActorId: "a" }];
    const auraConsumed = effectiveGaugeUnits === 0 ? [] : [{ element: "hydro", gaugeUnits: gaugeConsumed,
      sourceMutations: [{ sourceActorId: "__initial__", gaugeUnitsBefore: clean(gaugeBefore),
        consumedGaugeUnits: gaugeConsumed, gaugeUnitsAfter: clean(gaugeAfter) }] }];
    const event = result.damageEvents[id]!;
    expect(result.hitResolutionLog[id]).toMatchObject({ id, frame, outcome: "landed", landed: true,
      eventPriority: 3, eventSequence: id + 1, intraEventSequence: 0, damageEventId: id,
      hitGroupId: expectedDecision.hitGroupId, auraAllowed: true, finalDamage: damage[id] });
    expect(event).toMatchObject({ id, frame, kind: "direct", eventPriority: 3, eventSequence: id + 1,
      targetResolutionId: id, targetId: "enemy-0", sourceActorId: "a", scalingOwnerId: "a", creditOwnerId: "a",
      hitGroupId: expectedDecision.hitGroupId, element: "pyro", reaction, finalDamage: damage[id],
      damageComposition: { direct: damage[id], additiveReaction: 0, transformativeReaction: 0 },
      damageFactors: { scaling: 1, scalingValue: 1000, baseDamage: 1000, defenseMultiplier: defense,
        resistanceMultiplier: 0.9, critMultiplier: 1, groupMultiplier: 1,
        amplifyingReactionMultiplier: effectiveGaugeUnits > 0 ? 1.5 : 1 },
      reactionAudit: { icdAllowed: effectiveGaugeUnits > 0, applicationGaugeUnits: effectiveGaugeUnits,
        auraBefore, auraApplied, auraConsumed, auraAfter } });
    expect(result.auraTimeline[id]).toMatchObject({ damageEventId: id, frame, eventPriority: 3, eventSequence: id + 1,
      icdAllowed: effectiveGaugeUnits > 0, reaction, auraBefore, auraApplied, auraConsumed, auraAfter });
    expect(result.targetStateTimeline.points[id + 1]).toMatchObject({ id: id + 1, frame, targetFrame: frame,
      pointKind: effectiveGaugeUnits > 0 ? "mutation" : "observation", cause: "direct-hit-application",
      eventPriority: 3, eventSequence: id + 1, intraEventSequence: 1, primaryDamageEventId: id,
      links: [{ kind: "damage-event", id }], auraBefore, auraApplied, auraConsumed, auraAfter });
    // Target Reactable's lazy decay has completed before this direct hit. No
    // queued task, transition or skipped application may be fabricated here.
    expect(result.targetPhaseLog[id]).toMatchObject({ model: "target-phase-v2", id, globalFrame: frame,
      targetFrame: frame, targetOrder: 0, targetTasks: [], hitResolutionLogIds: [id], reactionTaskLogIds: [],
      auraBeforeTargetTasks: auraBefore, auraAfterTargetTasks: auraBefore,
      reactableTick: { fromTargetFrame: [0, 0, 1, 2, 148][id], toTargetFrame: frame,
        auraBefore, transitions: [], auraAfter: auraBefore } });
    const replay = replaySimulationHit({ schemaVersion: "calculator-event-v1", eventId: id, sourceResult: result });
    expect(replay.originalDamage).toBe(damage[id]);
    expect(replay.reproducedDamage).toBe(damage[id]);
    expect(replay.difference).toBe(0);
  }
  expect(result.reactionDamageLog).toEqual([]);
  expect(result.reactionTaskLog).toEqual([]);
  expect(result.skippedActions).toEqual([]);
  expect(JSON.stringify(result)).toBe(before);
}

const hostileElementalIcdCases: Array<{ name: string; mutate: (result: SimulationResult) => void }> = [
  { name: "numeric Nahida multiplier collapsed to a boolean", mutate: (result) => { result.elementalApplicationIcdLog[4]!.decision.applicationMultiplier = 1; } },
  { name: "blocked slot claims allowed application", mutate: (result) => { result.elementalApplicationIcdLog[1]!.decision.allowed = true; } },
  { name: "blocked slot manufactures effective gauge", mutate: (result) => { result.elementalApplicationIcdLog[2]!.effectiveGaugeUnits = 1; } },
  { name: "group switch replaces the existing window owner", mutate: (result) => { fixedIcdDecisionAt(result, 1).windowStartGroupId = "nahida-skill"; } },
  { name: "tail escapes the two-slot sequence", mutate: (result) => { fixedIcdDecisionAt(result, 2).sequenceIndex = 2; } },
  { name: "F148 prematurely resets the shared counter", mutate: (result) => { fixedIcdDecisionAt(result, 3).hitIndex = 0; } },
  { name: "F149 new deadline is off by one", mutate: (result) => { fixedIcdDecisionAt(result, 4).resetAtFrame = 209; } },
  { name: "new window retains the obsolete owner", mutate: (result) => { fixedIcdDecisionAt(result, 4).windowStartGroupId = "default"; } },
  { name: "duplicate labels alias the wrong damage event", mutate: (result) => { result.elementalApplicationIcdLog[1]!.damageEventId = 0; } },
  { name: "dangling resolution backlink", mutate: (result) => { result.elementalApplicationIcdLog[0]!.hitResolutionLogId = 999; } },
  { name: "coordinated ICD row order swap", mutate: (result) => {
    [result.elementalApplicationIcdLog[0], result.elementalApplicationIcdLog[1]] = [result.elementalApplicationIcdLog[1]!, result.elementalApplicationIcdLog[0]!];
    result.elementalApplicationIcdLog[0]!.id = 0; result.elementalApplicationIcdLog[1]!.id = 1;
  } },
  { name: "missing reset-hit ICD consumption", mutate: (result) => { result.elementalApplicationIcdLog.pop(); } },
  { name: "Aura point links to a later hit", mutate: (result) => { result.targetStateTimeline.points[1]!.links = [{ kind: "damage-event", id: 4 }]; } },
  { name: "unversioned ICD decision field", mutate: (result) => { Object.assign(result.elementalApplicationIcdLog[0]!.decision, { unversionedField: true }); } },
];

describe("current elemental-application ICD contract", () => {
  it("preserves shared-window timing, numeric gauge, exact causality and independent damage replay", () => {
    const result = simulate(makeVectorConfig(), OPTIONS);
    expect(simulate(makeVectorConfig(), OPTIONS)).toStrictEqual(result);
    expectCurrentElementalIcdContract(result);
    expect(() => projectHistoricalResultToV147(result)).toThrow(/flatStatBuffSemantics/);
  });
  it("pins authentic historical source and unchanged reviewed Golden bytes", () => {
    expect(historicalElementalIcdArchive).toMatchObject({ fixtureVersion: "historical-elemental-application-icd-v153-84ff5cd-v1",
      observedRunCount: 2, source: { commit: "84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5", tree: "72bd69a8c54a3e115685c7ee52f5862064c70f55" } });
    historicalElementalIcdResult();
    expect(byteSha256(readFileSync(FIXTURE_URL))).toBe(REVIEWED_FIXTURE_SHA256);
  });
  it.each(hostileElementalIcdCases)("rejects $name at public parsing and real capture import", ({ mutate }) => {
    const result = simulate(makeVectorConfig(), OPTIONS);
    const before = JSON.stringify(result);
    expect(simulationResultSchema.parse(result)).toEqual(result);
    expect(assertTrustedSimulationResult(result)).toBe(result);
    const capture = { schemaVersion: "calculator-event-v1", eventId: 0, sourceResult: result };
    expect(parseSimulationHit(JSON.stringify(capture)).sourceResult).toEqual(result);
    const forged = structuredClone(result); mutate(forged);
    expect(JSON.stringify(forged)).not.toBe(before);
    const parsed = simulationResultSchema.safeParse(forged);
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Forged elemental-application ICD result unexpectedly parsed");
    expect(() => parseSimulationHit(JSON.stringify({ ...capture, sourceResult: forged }))).toThrow(parsed.error.message);
    // Actual untrusted ingress parses all public facets before trusted integrity;
    // the internal trusted helper is not a standalone arbitrary-JSON validator.
    expect(JSON.stringify(result)).toBe(before);
  });
});

describe("1.47 elemental-application ICD Golden gate", () => {
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
      resolve(tmpdir(), "gdl-application-icd-v147-gate-"),
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

describe("1.47 elemental-application ICD Golden", () => {
  it.skipIf(!candidateEnabled)(
    "matches the synthetic shared-window, clamp, and reset vector",
    () => {
      const result = runVector();
      const repeated = runVector();
      expect(repeated).toEqual(result);
      expect(simulationResultV147Schema.parse(result)).toEqual(result);
      expect(assertTrustedSimulationResultV147(result)).toBe(result);
      expect(decisionProjection(result)).toEqual(EXPECTED_DECISIONS);

      const generated = makeFixture(result);
      const frozen = loadPreviewOrCreateFixture(generated);
      expect(frozen).toEqual(generated);
      expect(canonicalSha256(result.elementalApplicationIcdLog)).toBe(
        frozen.elementalApplicationIcdLogCanonicalSha256,
      );
      expect(canonicalSha256(result.damageEvents)).toBe(
        frozen.damageEventsCanonicalSha256,
      );
      expect(canonicalSha256(targetTimelineProjection(result))).toBe(
        frozen.targetTimelineCanonicalSha256,
      );

      expect(result.elementalApplicationIcdLog).toHaveLength(5);
      expect(result.damageEvents).toHaveLength(5);
      expect(result.reactedHits).toBe(2);
      expect(result.damageEvents.every((event) => event.finalDamage > 0)).toBe(
        true,
      );
      expect(
        result.elementalApplicationIcdLog.map((entry) => entry.hitGroupId),
      ).toEqual(EXPECTED_DECISIONS.map((entry) => entry.hitGroupId));

      for (const entry of result.elementalApplicationIcdLog) {
        const resolution = result.hitResolutionLog[entry.hitResolutionLogId];
        expect(resolution).toMatchObject({
          id: entry.hitResolutionLogId,
          outcome: "landed",
          damageEventId: entry.damageEventId,
        });
        expect(entry.damageEventId).not.toBeNull();
        expect(result.damageEvents[entry.damageEventId!]).toMatchObject({
          id: entry.damageEventId,
          hitId: entry.hitId,
          hitGroupId: entry.hitGroupId,
          frame: entry.frame,
          element: entry.element,
        });
      }
    },
  );
});
