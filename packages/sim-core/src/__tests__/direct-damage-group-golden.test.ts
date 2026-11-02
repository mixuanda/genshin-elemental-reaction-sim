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
import { GCSIM_DAMAGE_GROUP_ROOT } from "@genshin-dps-lab/icd-profiles";
import {
  DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION,
  DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION,
  DIRECT_DAMAGE_GROUP_RUN_MANIFEST_VERSION,
  CURRENT_ENGINE_VERSION,
  CURRENT_SCHEMA_VERSION,
  assertTrustedSimulationResult,
  assertTrustedSimulationResultV146,
  simulationResultSchema,
  simulationResultV146Schema,
  type AbilityDefinition,
  type FrameHitDefinition,
  type SimConfig,
  type SimulationResult,
} from "@genshin-dps-lab/schemas";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { projectSimulationResultV152ToV151 } from "../../../test-vectors/src/project-v152-to-v151";
import { projectSimulationResultV153ToV152 } from "../../../test-vectors/src/project-v153-to-v152";
import { parseSimulationHit, replaySimulationHit } from "../calculator-bridge";
import { simulate } from "../simulator";
import { makeConfig } from "./fixtures";

const UPDATE_FLAG = "UPDATE_DIRECT_DAMAGE_GROUP_V146_GOLDEN";
const FIXTURE_SHA256 =
  "eebbd992dddbf4a24b16dd5c9d00a31a2c6d107372ba9fc58994181061156899";
const DIRECT_DAMAGE_GROUP_LOG_SHA256 =
  "eada780e1dcc8e435528085deeccce009137e2ce6810b565df9c1cc3c048b2e9";
const DAMAGE_EVENTS_SHA256 =
  "7583ffabde20d47e97b1f096787730631afc1038d0c6b04eacb96d62446bada0";
const FIXTURE_URL = new URL(
  "../../../test-vectors/fixtures/direct-damage-group-1.46.golden.json",
  import.meta.url,
);
const VECTOR_SEED = "synthetic-direct-damage-group-v146";
const VECTOR_CONFIG_HASH = "fnv1a32:3e6ab06a";
const VECTOR_REPRODUCIBILITY_KEY = "gdl-v2-fnv1a32-835cebb7";
const DESCRIPTION =
  "Full 1.46 synthetic ordinary direct-damage-group result vector for zero slots, group switching, tail clamping, and reset-before-hit ordering.";
const SOURCE =
  "Synthetic five-hit engine regression vector bound to the fixed genshinsim/gcsim b4ae769 damage-group root";
const NOTE =
  "This fixture verifies simulator state transitions only. It does not claim that the generic actor, hit labels, timings, multipliers, character skills, or equipment data are verified game data. The bound Damage Group profile is fixed-gcsim-provisional, not official server truth or complete gcsim parity, and elemental-application ICD is outside this fixture.";

const EXPECTED_DECISIONS = [
  {
    hitId: "open-xiao",
    frame: 0,
    icdGroup: "xiao-dash",
    windowStartGroup: "xiao-dash",
    resetFrames: 6,
    windowStartFrame: 0,
    resetAtFrame: 5,
    hitIndex: 0,
    sequenceIndex: 0,
    sequenceMultiplier: 1,
    effectiveMultiplier: 2,
    damageGroupOnEnemyHitAllowed: true,
  },
  {
    hitId: "zero-xiao",
    frame: 1,
    icdGroup: "xiao-dash",
    windowStartGroup: "xiao-dash",
    resetFrames: 6,
    windowStartFrame: 0,
    resetAtFrame: 5,
    hitIndex: 1,
    sequenceIndex: 1,
    sequenceMultiplier: 0,
    effectiveMultiplier: 0,
    damageGroupOnEnemyHitAllowed: false,
  },
  {
    hitId: "switch-tail",
    frame: 2,
    icdGroup: "chasca-tap",
    windowStartGroup: "xiao-dash",
    resetFrames: 6,
    windowStartFrame: 0,
    resetAtFrame: 5,
    hitIndex: 2,
    sequenceIndex: 1,
    sequenceMultiplier: 1,
    effectiveMultiplier: 2,
    damageGroupOnEnemyHitAllowed: true,
  },
  {
    hitId: "pre-reset-tail",
    frame: 4,
    icdGroup: "chasca-tap",
    windowStartGroup: "xiao-dash",
    resetFrames: 6,
    windowStartFrame: 0,
    resetAtFrame: 5,
    hitIndex: 3,
    sequenceIndex: 1,
    sequenceMultiplier: 1,
    effectiveMultiplier: 2,
    damageGroupOnEnemyHitAllowed: true,
  },
  {
    hitId: "reset-pole",
    frame: 5,
    icdGroup: "pole-extra-attack",
    windowStartGroup: "pole-extra-attack",
    resetFrames: 30,
    windowStartFrame: 5,
    resetAtFrame: 34,
    hitIndex: 0,
    sequenceIndex: 0,
    sequenceMultiplier: 1,
    effectiveMultiplier: 2,
    damageGroupOnEnemyHitAllowed: true,
  },
] as const;

const decisionProjectionSchema = z
  .object({
    hitId: z.string().min(1),
    frame: z.number().int().nonnegative(),
    icdGroup: z.string().min(1),
    windowStartGroup: z.string().min(1),
    resetFrames: z.number().int().positive(),
    windowStartFrame: z.number().int().nonnegative(),
    resetAtFrame: z.number().int().nonnegative(),
    hitIndex: z.number().int().nonnegative(),
    sequenceIndex: z.number().int().nonnegative(),
    sequenceMultiplier: z.number().finite(),
    effectiveMultiplier: z.number().finite(),
    damageGroupOnEnemyHitAllowed: z.boolean(),
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
    directDamageGroupLogCanonicalSha256: z.literal(
      DIRECT_DAMAGE_GROUP_LOG_SHA256,
    ),
    damageEventsCanonicalSha256: z.literal(DAMAGE_EVENTS_SHA256),
    result: simulationResultV146Schema,
  })
  .strict()
  .superRefine((fixture, context) => {
    if (
      JSON.stringify(fixture.expectedDecisionProjection) !==
      JSON.stringify(EXPECTED_DECISIONS)
    ) {
      context.addIssue({
        code: "custom",
        path: ["expectedDecisionProjection"],
        message: "must retain the exact reviewed five-hit mechanics projection",
      });
    }
    if (
      fixture.result.schemaVersion !==
        DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION ||
      fixture.result.engineVersion !==
        DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION ||
      fixture.result.runManifest.version !==
        DIRECT_DAMAGE_GROUP_RUN_MANIFEST_VERSION ||
      fixture.result.randomSeed !== VECTOR_SEED ||
      fixture.result.runManifest.configHash !== VECTOR_CONFIG_HASH ||
      fixture.result.reproducibilityKey !== VECTOR_REPRODUCIBILITY_KEY ||
      fixture.result.runManifest.reproducibilityKey !==
        VECTOR_REPRODUCIBILITY_KEY ||
      JSON.stringify(fixture.result.runManifest.directDamageGroupRoot) !==
        JSON.stringify(GCSIM_DAMAGE_GROUP_ROOT)
    ) {
      context.addIssue({
        code: "custom",
        path: ["result", "runManifest"],
        message:
          "must bind the exact 1.46 identity, random seed, manifest, and provisional Damage Group root",
      });
    }
  });

type DamageGroupFixture = z.output<typeof fixtureSchema>;

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

/** Historical-only projection: remove fields introduced after the frozen 1.46 wire.
 * Current results are tested in full and must not enter this conversion. */
function projectHistoricalResultToFrozenV146Wire(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(projectHistoricalResultToFrozenV146Wire);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([key]) =>
          key !== "elementalApplicationIcdLogId" &&
          key !== "elementalApplicationIcdLogIds",
      )
      .map(([key, entry]) => [key, projectHistoricalResultToFrozenV146Wire(entry)]),
  );
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

function directHit(
  id: string,
  frame: number,
  icdGroup: NonNullable<FrameHitDefinition["directDamageGroup"]>["icdGroup"],
): FrameHitDefinition {
  return {
    id,
    frame,
    scaling: 1,
    element: "physical",
    groupMultiplier: 2,
    directDamageGroup: {
      icdTag: "synthetic-shared-tag",
      icdGroup,
    },
  };
}

function makeVectorConfig(): SimConfig {
  const hits = [
    directHit("open-xiao", 0, "xiao-dash"),
    directHit("zero-xiao", 1, "xiao-dash"),
    directHit("switch-tail", 2, "chasca-tap"),
    directHit("pre-reset-tail", 4, "chasca-tap"),
    directHit("reset-pole", 5, "pole-extra-attack"),
  ];
  const ability: AbilityDefinition = {
    id: "synthetic-direct-damage-group-ability",
    actorId: "a",
    name: "Synthetic Damage Group vector",
    kind: "skill",
    cancelFrame: 0,
    animationEndFrame: 5,
    cooldownFrames: 0,
    hits,
    particles: [],
  };
  const base = makeConfig({
    dataVersion: "synthetic-test-vector-1.46",
    randomSeed: VECTOR_SEED,
    meta: {
      name: "Synthetic Damage Group Golden",
      version: "1.46",
      verificationStatus: "provisional",
    },
  });
  return {
    ...base,
    duration: 1,
    cycleLength: 1,
    rotation: [],
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
          abilityId: ability.id,
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

function runVector() {
  return simulate(makeVectorConfig(), OPTIONS);
}

function decisionProjection(result: ReturnType<typeof runVector>) {
  return result.directDamageGroupLog.map(
    ({
      hitId,
      frame,
      icdGroup,
      windowStartGroup,
      resetFrames,
      windowStartFrame,
      resetAtFrame,
      hitIndex,
      sequenceIndex,
      sequenceMultiplier,
      effectiveMultiplier,
      damageGroupOnEnemyHitAllowed,
    }) => ({
      hitId,
      frame,
      icdGroup,
      windowStartGroup,
      resetFrames,
      windowStartFrame,
      resetAtFrame,
      hitIndex,
      sequenceIndex,
      sequenceMultiplier,
      effectiveMultiplier,
      damageGroupOnEnemyHitAllowed,
    }),
  );
}

function makeHistoricalFixture(result: ReturnType<typeof runVector>): DamageGroupFixture {
  const projected = projectHistoricalResultToFrozenV146Wire(
    structuredClone(
      projectSimulationResultV152ToV151(
        projectSimulationResultV153ToV152(result),
      ),
    ),
  ) as Record<string, unknown>;
  delete projected.elementalApplicationIcdLog;
  delete projected.reactionDamageGroupResetLog;
  delete projected.basicReactionSchedulerLog;
  projected.schemaVersion = DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION;
  projected.engineVersion = DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION;

  const projectedConfig = projected.config as Record<string, unknown>;
  projectedConfig.schemaVersion = DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION;
  projectedConfig.engineVersion = DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION;
  delete projectedConfig.elementalApplicationIcdModel;
  delete projectedConfig.reactionOwnedElementalApplicationModel;
  delete projectedConfig.reactionDamageGroupModel;
  delete projectedConfig.basicReactionSchedulerModel;

  const projectedManifest = projected.runManifest as Record<string, unknown>;
  projectedManifest.version = DIRECT_DAMAGE_GROUP_RUN_MANIFEST_VERSION;
  projectedManifest.schemaVersion = DIRECT_DAMAGE_GROUP_ROOT_SCHEMA_VERSION;
  projectedManifest.engineVersion = DIRECT_DAMAGE_GROUP_ROOT_ENGINE_VERSION;
  projectedManifest.configHash = VECTOR_CONFIG_HASH;
  projectedManifest.reproducibilityKey = VECTOR_REPRODUCIBILITY_KEY;
  delete projectedManifest.elementalApplicationIcdRoot;
  delete projectedManifest.reactionOwnedElementalApplicationRoot;
  delete projectedManifest.reactionDamageGroupRoot;
  delete projectedManifest.basicReactionSchedulerRoot;
  for (const entry of projected.hitResolutionLog as Array<
    Record<string, unknown>
  >) {
    delete entry.reactionDamageLogId;
  }
  projected.reproducibilityKey = VECTOR_REPRODUCIBILITY_KEY;

  const frozenResult = simulationResultV146Schema.parse(projected);
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
    directDamageGroupLogCanonicalSha256: canonicalSha256(
      frozenResult.directDamageGroupLog,
    ),
    damageEventsCanonicalSha256: canonicalSha256(frozenResult.damageEvents),
    result: frozenResult,
  });
}

function serializeFixture(fixture: DamageGroupFixture): string {
  return `${JSON.stringify(fixture, null, 2)}\n`;
}

function loadOrCreateFixture(
  generated: DamageGroupFixture,
  options: {
    updateRequested?: boolean;
    outputUrl?: URL;
  } = {},
): DamageGroupFixture {
  const updateRequested =
    options.updateRequested ?? process.env[UPDATE_FLAG] === "1";
  const outputUrl = options.outputUrl ?? FIXTURE_URL;
  expect(
    decisionProjection(
      generated.result as unknown as ReturnType<typeof runVector>,
    ),
  ).toEqual(EXPECTED_DECISIONS);
  assertTrustedSimulationResultV146(
    generated.result as unknown as SimulationResult,
  );

  if (updateRequested) {
    const bytes = serializeFixture(fixtureSchema.parse(generated));
    const generatedSha256 = byteSha256(bytes);
    if (generatedSha256 !== FIXTURE_SHA256) {
      throw new Error(
        `Refusing to write the 1.46 Damage Group fixture because its generated bytes changed: received ${generatedSha256}.`,
      );
    }
    atomicCreateFixture(outputUrl, bytes);
    return generated;
  }

  const frozenBytes = readFileSync(outputUrl);
  const frozenSha256 = byteSha256(frozenBytes);
  if (frozenSha256 !== FIXTURE_SHA256) {
    throw new Error(
      `Frozen 1.46 Damage Group fixture changed: received ${frozenSha256}.`,
    );
  }
  return fixtureSchema.parse(JSON.parse(frozenBytes.toString("utf8")));
}


const historicalDirectGroupBytes = readFileSync(new URL(
  "../../../test-vectors/src/fixtures/historical-direct-damage-group-v153-84ff5cd.json", import.meta.url,
));
const historicalDirectGroupArchive = JSON.parse(historicalDirectGroupBytes.toString("utf8")) as {
  fixtureVersion: string; source: { commit: string }; observedRunCount: number; sourceWireSha256: string; sourceWireText: string;
};
function historicalDirectGroupResult(): SimulationResult {
  expect(byteSha256(historicalDirectGroupArchive.sourceWireText)).toBe(historicalDirectGroupArchive.sourceWireSha256);
  const result = JSON.parse(historicalDirectGroupArchive.sourceWireText) as SimulationResult;
  expect(result.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(result.runManifest.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");
  expect(simulationResultSchema.parse(result)).toEqual(result);
  expect(assertTrustedSimulationResult(result)).toBe(result);
  return result;
}

function directGroupMechanics(result: SimulationResult) {
  const { runManifest: _manifest, resolvedRuntimeOptions: _options, reproducibilityKey: _key, ...mechanics } = result;
  return mechanics;
}
function expectCurrentDirectGroupContract(result: SimulationResult): void {
  const before = JSON.stringify(result);
  const historical = historicalDirectGroupResult();
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

  // Exact expected full mechanics, not a wire converter. These five direct
  // resolution rows formerly omitted position; they now explicitly reserve I0.
  // Every event/group/timeline field and all references remain unmodified.
  const expected = structuredClone(directGroupMechanics(historical));
  expect(expected.hitResolutionLog.map((row) => row.id)).toEqual([0, 1, 2, 3, 4]);
  for (const [id, row] of expected.hitResolutionLog.entries()) {
    expect(row).toMatchObject({ id, frame: EXPECTED_DECISIONS[id]!.frame, resolutionKind: "direct",
      hitId: EXPECTED_DECISIONS[id]!.hitId, targetId: "enemy-0", damageEventId: id });
    expect(row).not.toHaveProperty("eventPriority");
    expect(row).not.toHaveProperty("eventSequence");
    expect(row).not.toHaveProperty("intraEventSequence");
    row.eventPriority = 3; row.eventSequence = id + 1; row.intraEventSequence = 0;
  }
  expect(directGroupMechanics(result)).toStrictEqual(expected);
  expect(decisionProjection(result)).toEqual(EXPECTED_DECISIONS);
  expect(result.directDamageGroupLog).toEqual(historical.directDamageGroupLog);
  expect(canonicalSha256(result.directDamageGroupLog)).toBe(DIRECT_DAMAGE_GROUP_LOG_SHA256);

  // Independent physical damage: ATK1000, scaling1, level90 vs110 DEF,
  // resistance10%, no crit/bonus/reaction; configured group multiplier2.
  const defense = (90 + 100) / ((90 + 100) + (110 + 100));
  const positive = 1000 * defense * (1 - 0.1) * 2;
  expect(positive).toBe(855);
  const damage = [positive, 0, positive, positive, positive];
  expect(result.damageEvents).toHaveLength(5);
  expect(result.directDamageGroupLog).toHaveLength(5);
  expect(result.damageEvents.map((event) => event.finalDamage)).toEqual(damage);
  for (const [id, decision] of result.directDamageGroupLog.entries()) {
    const event = result.damageEvents[id]!;
    const resolution = result.hitResolutionLog[id]!;
    expect(decision).toMatchObject({ id, damageEventId: id, hitResolutionLogId: id,
      sourceActorId: "a", targetId: "enemy-0", profileId: GCSIM_DAMAGE_GROUP_ROOT.profileId,
      evaluation: "evaluated", icdTag: "synthetic-shared-tag", configuredMultiplier: 2,
      prePluginMultiplier: 2, postPluginMultiplier: 2, pluginMultiplierTrace: [] });
    expect(resolution).toMatchObject({ id, frame: EXPECTED_DECISIONS[id]!.frame, eventPriority: 3,
      eventSequence: id + 1, intraEventSequence: 0, outcome: "landed", landed: true, damageEventId: id,
      potentialDamage: damage[id], finalDamage: damage[id], displayDamage: damage[id] });
    expect(event).toMatchObject({ id, frame: EXPECTED_DECISIONS[id]!.frame, hitId: decision.hitId,
      eventPriority: 3, eventSequence: id + 1, targetResolutionId: id, targetId: "enemy-0",
      sourceActorId: "a", scalingOwnerId: "a", creditOwnerId: "a", kind: "direct", element: "physical",
      reaction: "none", groupMultiplier: decision.effectiveMultiplier,
      potentialDamage: damage[id], finalDamage: damage[id], displayDamage: damage[id],
      damageComposition: { direct: damage[id], additiveReaction: 0, transformativeReaction: 0 },
      damageFactors: { scaling: 1, scalingValue: 1000, flatDamage: 0, baseDamage: 1000,
        damageBonusMultiplier: 1, defenseMultiplier: defense, resistanceMultiplier: 0.9,
        critMultiplier: 1, amplifyingReactionMultiplier: 1, groupMultiplier: decision.effectiveMultiplier } });
    // Exercise the actual calculator entry point, including the zero slot.
    const replay = replaySimulationHit({ schemaVersion: "calculator-event-v1", eventId: id, sourceResult: result });
    expect(replay.originalDamage).toBe(damage[id]);
    expect(replay.reproducedDamage).toBe(damage[id]);
    expect(replay.difference).toBe(0);
  }
  // One actor/tag window survives the group switch; the current group's tail
  // clamps at index1. At F5 the original six-frame window resets before consume,
  // opening pole-extra-attack at index0 with its own F34 deadline.
  expect(result.directDamageGroupLog.map((entry) => entry.hitIndex)).toEqual([0, 1, 2, 3, 0]);
  expect(result.directDamageGroupLog.map((entry) => entry.sequenceIndex)).toEqual([0, 1, 1, 1, 0]);
  expect(result.directDamageGroupLog.map((entry) => entry.damageGroupOnEnemyHitAllowed)).toEqual([true, false, true, true, true]);
  expect(result.directDamageGroupLog.map((entry) => entry.resetAtFrame)).toEqual([5, 5, 5, 5, 34]);
  expect(result.totalDamage).toBe(4 * positive);
  expect(result.dps).toBe(4 * positive);
  expect(result.byCharacter.a).toBe(4 * positive);
  expect(result.damageCurve.map((point) => [point.damageEventId, point.frame, point.cumulativeDamage])).toEqual([
    [0, 0, positive], [1, 1, positive], [2, 2, 2 * positive], [3, 4, 3 * positive], [4, 5, 4 * positive],
  ]);
  expect(result.elementalApplicationIcdLog).toEqual([]);
  expect(result.reactionDamageLog).toEqual([]);
  expect(result.reactionTaskLog).toEqual([]);
  expect(JSON.stringify(result)).toBe(before);
}

const hostileDirectGroupCases: Array<{ name: string; mutate: (result: SimulationResult) => void }> = [
  { name: "zero slot becomes a positive sequence slot", mutate: (result) => { result.directDamageGroupLog[1]!.sequenceMultiplier = 1; } },
  { name: "zero slot forges the OnEnemyHit gate", mutate: (result) => { result.directDamageGroupLog[1]!.damageGroupOnEnemyHitAllowed = true; } },
  { name: "group switch replaces the existing window owner", mutate: (result) => { result.directDamageGroupLog[2]!.windowStartGroup = "chasca-tap"; } },
  { name: "tail index escapes its clamped sequence", mutate: (result) => { result.directDamageGroupLog[3]!.sequenceIndex = 3; } },
  { name: "new window deadline uses the wrong reset boundary", mutate: (result) => { result.directDamageGroupLog[4]!.resetAtFrame = 35; } },
  { name: "F5 hit consumes the stale window index", mutate: (result) => { result.directDamageGroupLog[4]!.hitIndex = 4; } },
  { name: "damage backlink aliases the zero event", mutate: (result) => { result.directDamageGroupLog[0]!.damageEventId = 1; } },
  { name: "dangling resolution backlink", mutate: (result) => { result.directDamageGroupLog[0]!.hitResolutionLogId = 999; } },
  { name: "plugin-free post multiplier is forged", mutate: (result) => { result.directDamageGroupLog[0]!.postPluginMultiplier = 99; } },
  { name: "coordinated log order swap", mutate: (result) => {
    [result.directDamageGroupLog[0], result.directDamageGroupLog[1]] = [result.directDamageGroupLog[1]!, result.directDamageGroupLog[0]!];
    result.directDamageGroupLog[0]!.id = 0; result.directDamageGroupLog[1]!.id = 1;
  } },
  { name: "damage formula loses its group multiplier", mutate: (result) => { result.damageEvents[2]!.damageFactors.groupMultiplier = 1; } },
  { name: "unversioned group-log field", mutate: (result) => { Object.assign(result.directDamageGroupLog[0]!, { unversionedField: true }); } },
];

describe("current direct-damage-group contract", () => {
  it("retains exact current resolution positions, independent damage, group causality and calculator replay", () => {
    const result = runVector();
    expect(runVector()).toStrictEqual(result);
    expectCurrentDirectGroupContract(result);
    expect(() => makeHistoricalFixture(result)).toThrow(/flatStatBuffSemantics/);
  });
  it("pins genuine source provenance and immutable historical bytes", () => {
    expect(byteSha256(historicalDirectGroupBytes)).toBe("58e5028f6c29bb1169eae03b6aa884d7aff972d68e23e53fc3ec451c922fd4b0");
    expect(historicalDirectGroupArchive).toMatchObject({ fixtureVersion: "historical-direct-damage-group-v153-84ff5cd-v1",
      observedRunCount: 3, source: { commit: "84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5", tree: "72bd69a8c54a3e115685c7ee52f5862064c70f55" } });
    expect(byteSha256(readFileSync(FIXTURE_URL))).toBe(FIXTURE_SHA256);
  });
  it.each(hostileDirectGroupCases)("rejects $name at public parsing and real capture import", ({ mutate }) => {
    const result = runVector();
    const before = JSON.stringify(result);
    expect(simulationResultSchema.parse(result)).toEqual(result);
    expect(assertTrustedSimulationResult(result)).toBe(result);
    const capture = { schemaVersion: "calculator-event-v1", eventId: 0, sourceResult: result };
    expect(parseSimulationHit(JSON.stringify(capture)).sourceResult).toEqual(result);
    const forged = structuredClone(result); mutate(forged);
    expect(JSON.stringify(forged)).not.toBe(before);
    const parsed = simulationResultSchema.safeParse(forged);
    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Forged direct-damage-group result unexpectedly parsed");
    expect(() => parseSimulationHit(JSON.stringify({ ...capture, sourceResult: forged }))).toThrow(parsed.error.message);
    // The real untrusted ingress parses all public facets before the trusted
    // helper. Do not assign an arbitrary-JSON guarantee to that helper alone.
    expect(JSON.stringify(result)).toBe(before);
  });
});

describe("1.46 ordinary direct-damage-group Golden", () => {
  it("matches the authentic historical zero, switch, tail, and reset vector", () => {
    const result = historicalDirectGroupResult();
    const repeated = historicalDirectGroupResult();
    expect(repeated).toEqual(result);
    expect(simulationResultSchema.parse(result)).toEqual(result);
    expect(assertTrustedSimulationResult(result)).toBe(result);
    expect(decisionProjection(result)).toEqual(EXPECTED_DECISIONS);

    const generated = makeHistoricalFixture(result);
    const frozen = loadOrCreateFixture(generated);
    expect(frozen).toEqual(generated);
    expect(frozen.result.directDamageGroupLog).toEqual(
      result.directDamageGroupLog,
    );
    expect(canonicalSha256(result.directDamageGroupLog)).toBe(
      frozen.directDamageGroupLogCanonicalSha256,
    );
    expect(
      canonicalSha256(projectHistoricalResultToFrozenV146Wire(result.damageEvents)),
    ).toBe(frozen.damageEventsCanonicalSha256);

    expect(result.directDamageGroupLog).toHaveLength(5);
    for (const [index, entry] of result.directDamageGroupLog.entries()) {
      expect(entry).toEqual(frozen.result.directDamageGroupLog[index]);
      expect(entry).toMatchObject({
        id: index,
        damageEventId: index,
        hitResolutionLogId: index,
        sourceActorId: "a",
        targetId: "enemy-0",
        profileId: GCSIM_DAMAGE_GROUP_ROOT.profileId,
        evaluation: "evaluated",
        icdTag: "synthetic-shared-tag",
        configuredMultiplier: 2,
        prePluginMultiplier: 2,
        postPluginMultiplier: 2,
      });
      expect(result.hitResolutionLog[index]).toMatchObject({
        id: entry.hitResolutionLogId,
        outcome: "landed",
        damageEventId: entry.damageEventId,
      });
      expect(result.damageEvents[index]).toMatchObject({
        id: entry.damageEventId,
        hitId: entry.hitId,
        groupMultiplier: entry.effectiveMultiplier,
        damageFactors: {
          groupMultiplier: entry.effectiveMultiplier,
        },
      });
    }

    const zeroEvent = result.damageEvents[1]!;
    expect(zeroEvent).toMatchObject({
      hitId: "zero-xiao",
      potentialDamage: 0,
      finalDamage: 0,
      displayDamage: 0,
      damageComposition: {
        direct: 0,
        additiveReaction: 0,
        transformativeReaction: 0,
      },
    });
    const positiveDamage = result.damageEvents[0]!.finalDamage;
    expect(positiveDamage).toBeGreaterThan(0);
    expect(
      [0, 2, 3, 4].map((index) => result.damageEvents[index]!.finalDamage),
    ).toEqual([positiveDamage, positiveDamage, positiveDamage, positiveDamage]);
  });

  it("keeps the full synthetic result fixture byte-for-byte frozen", () => {
    if (
      process.env[UPDATE_FLAG] === "1" &&
      !existsSync(fileURLToPath(FIXTURE_URL))
    ) {
      return;
    }
    expect(byteSha256(readFileSync(FIXTURE_URL))).toBe(FIXTURE_SHA256);
    const fixture = fixtureSchema.parse(
      JSON.parse(readFileSync(FIXTURE_URL, "utf8")),
    );
    expect(
      assertTrustedSimulationResultV146(
        fixture.result as unknown as SimulationResult,
      ),
    ).toBe(fixture.result);
  });

  it("requires explicit creation and atomically refuses overwrite", () => {
    const generated = makeHistoricalFixture(historicalDirectGroupResult());
    const probeDirectory = mkdtempSync(
      resolve(tmpdir(), "gdl-direct-group-v146-gate-"),
    );
    const missingUrl = pathToFileURL(
      resolve(probeDirectory, "missing.golden.json"),
    );
    const existingUrl = pathToFileURL(
      resolve(probeDirectory, "existing.golden.json"),
    );
    try {
      expect(() =>
        loadOrCreateFixture(generated, {
          updateRequested: false,
          outputUrl: missingUrl,
        }),
      ).toThrow();
      expect(existsSync(fileURLToPath(missingUrl))).toBe(false);

      writeFileSync(existingUrl, "sentinel\n", { flag: "wx" });
      expect(() =>
        loadOrCreateFixture(generated, {
          updateRequested: true,
          outputUrl: existingUrl,
        }),
      ).toThrow(/Refusing to overwrite frozen fixture/);
      expect(readFileSync(existingUrl, "utf8")).toBe("sentinel\n");
    } finally {
      rmSync(probeDirectory, { recursive: true, force: true });
    }
  });
});
