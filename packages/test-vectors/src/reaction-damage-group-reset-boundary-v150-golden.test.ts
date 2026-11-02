import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID,
  GCSIM_REACTION_DAMAGE_GROUP_POLICY_ROOT,
} from "@genshin-dps-lab/icd-profiles";
import {
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
  REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
  assertTrustedSimulationResult,
  simulationResultSchema,
  type SimulationResult,
  assertTrustedSimulationResultV150,
  damageEventV148Schema,
  hitResolutionLogEntryV148Schema,
  reactionDamageGroupModelV2Schema,
  reactionDamageGroupResetLogEntryV150Schema,
  reactionDamageGroupRootV2Schema,
  reactionDamageLogEntryV150Schema,
  simulationResultV150Schema,
  simulationRunManifestV150Schema,
  type Element,
  type SimConfig,
  type SimulationResultForV150,
} from "@genshin-dps-lab/schemas";
import { z } from "zod";
import { describe, expect, it } from "vitest";

import { simulate } from "../../sim-core/src/simulator";
import { parseEventStepResult, simulateEventStepResult } from "../../sim-core/src/event-step-result";
import {
  makeConfig,
  neutralStats,
} from "../../sim-core/src/__tests__/fixtures";
import {
  byteSha256,
  canonicalSha256,
  loadPreviewOrCreateReviewedGolden,
} from "./reviewed-golden";
import { projectSimulationResultV151ToV150 } from "./project-v151-to-v150";
import { projectSimulationResultV152ToV151 } from "./project-v152-to-v151";
import { projectSimulationResultV153ToV152 } from "./project-v153-to-v152";
import { withV152CompatibilityPolicies } from "./v152-compatibility-config";

const PREVIEW_FLAG = "PREVIEW_REACTION_DAMAGE_GROUP_RESET_BOUNDARY_V150_GOLDEN";
const UPDATE_FLAG = "UPDATE_REACTION_DAMAGE_GROUP_RESET_BOUNDARY_V150_GOLDEN";
const REVIEWED_FIXTURE_SHA256 =
  "f58cdac88ec2395239fc5f8c4818adff92e563479268ee5c4aa5a75639ae06d1";
const FIXTURE_URL = new URL(
  "../fixtures/reaction-damage-group-reset-boundary-1.50.golden.json",
  import.meta.url,
);

const HISTORICAL_REVIEWED_GOLDEN_SHA256 = {
  "burning-callback-delivery-1.44.golden.json":
    "4caf9609daac1fde41195399e5c3af8daca60e14849aa4c5195b286ae947da65",
  "burning-reset-boundary-1.49.golden.json":
    "3e89c431c3b277fd1dc52881f7ea048b39060e0c16c5230af9c1a73b624e0e10",
  "direct-damage-group-1.46.golden.json":
    "eebbd992dddbf4a24b16dd5c9d00a31a2c6d107372ba9fc58994181061156899",
  "electro-charged-global-cadence-1.42.golden.json":
    "ed7a41b1bc67adb1908367172db2bcecd0e668dbdd9f214f14829adbb3375611",
  "electro-charged-propagation-1.41.golden.json":
    "b855f87f391a5f0dfd82e30a4666c8bb79a7777c94bc8f2bd675178fabdb0d18",
  "electro-charged-quicken-cleanup-1.40.golden.json":
    "bc1fb0bec7b526c1f3046ef81bb3aac5d947410fc013fbcc8d6fd2c6731563e0",
  "elemental-application-icd-1.47.golden.json":
    "9238417a2b2e54414366ecb7bb9eeba7ed2070845dff0e6c978af8e96673ddf7",
  "legacy-default-120s-1.46.golden.json":
    "3ef783e206a4566fd935c3251f97d31aeb6cddb7ec7e82eccf661d62cb994465",
  "legacy-default-120s-1.47.golden.json":
    "918a78d9cdd57d11d5fc9012896c5a7fc240a29b31cd9c09c9ff761fe38d8996",
  "legacy-default-120s-1.48.golden.json":
    "563c417efe82582c9647670104b39e0c34074ceb18259a8aaa36e9c997079d5c",
  "legacy-default-120s-1.49.golden.json":
    "961505ccb95b536c3563ebeb95ec114f236f3872850df2cb98e5bc8bb5218931",
  "quicken-bloom-task-order-1.40.golden.json":
    "b13f96768e589b77ff62daef1fd5cae0a3b1bab2a98fc88ce7c3f415356805b4",
  "reaction-matrix-1.35.golden.json":
    "d21e107dd1ed53f897d5f5d1f45af4735cd99297c281f5123d71e1fbc394d8c5",
  "reaction-owned-application-1.48.golden.json":
    "704c5db38dda87802aa000d664812b63673ea9498981ed21f26a21eac5c620bd",
  "shatter-recursive-delivery-1.39.golden.json":
    "a83ff459e5753ddef1082d923b6476bdbe5392dc9f574ac3d462e357df322579",
} as const;

type ReactionVector = "superconduct" | "overload";

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const nonNegativeIntegerSchema = z.number().int().nonnegative();

const resultIdentitySchema = z
  .object({
    schemaVersion: z.literal(
      REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
    ),
    engineVersion: z.literal(
      REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
    ),
    dataVersion: z.string().min(1),
    randomSeed: z.string().min(1),
    configHash: z.string().regex(/^fnv1a32:[0-9a-f]{8}$/),
    reproducibilityKey: z.string().regex(/^gdl-v2-fnv1a32-[0-9a-f]{8}$/),
    selectedModel: reactionDamageGroupModelV2Schema,
    runManifest: simulationRunManifestV150Schema,
  })
  .strict();

const scenarioSchema = z
  .object({
    identity: resultIdentitySchema,
    totals: z
      .object({
        totalDamage: z.number().finite().nonnegative(),
        dps: z.number().finite().nonnegative(),
        displayDamage: nonNegativeIntegerSchema,
        damageEventCount: nonNegativeIntegerSchema,
        hitResolutionCount: nonNegativeIntegerSchema,
        reactionDamageCount: nonNegativeIntegerSchema,
        reactionDamageEventCount: nonNegativeIntegerSchema,
        reactionDamageDisplayDamage: nonNegativeIntegerSchema,
        resetTaskCount: nonNegativeIntegerSchema,
      })
      .strict(),
    reactionDamageLog: z.array(reactionDamageLogEntryV150Schema).length(2),
    reactionDamageEvents: z.array(damageEventV148Schema).length(2),
    reactionHitResolutionLog: z
      .array(hitResolutionLogEntryV148Schema)
      .length(2),
    resetTasks: z.array(reactionDamageGroupResetLogEntryV150Schema).length(2),
    canonicalSha256: z
      .object({
        config: sha256Schema,
        runManifest: sha256Schema,
        damageEvents: sha256Schema,
        hitResolutionLog: sha256Schema,
        reactionDamageLog: sha256Schema,
        reactionDamageGroupResetLog: sha256Schema,
        targetStateTimeline: sha256Schema,
      })
      .strict(),
  })
  .strict();

const fixtureSchema = z
  .object({
    fixtureVersion: z.literal("1.0.0"),
    description: z.string().min(1),
    provenance: z
      .object({
        sourceProject: z.literal("genshinsim/gcsim"),
        sourceRevision: z.literal("b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541"),
        capturedAt: z.literal("2026-08-02"),
        verificationStatus: z.literal("reviewed-provisional"),
        note: z.string().min(1),
        officialServerTruth: z.literal(false),
        completeGcsimParity: z.literal(false),
      })
      .strict(),
    currentIdentity: z
      .object({
        schemaVersion: z.literal(
          REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
        ),
        engineVersion: z.literal(
          REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
        ),
        runManifestVersion: z.literal(
          REACTION_DAMAGE_GROUP_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
        ),
      })
      .strict(),
    selectedPolicyRoot: reactionDamageGroupRootV2Schema,
    expectedBoundary: z
      .object({
        openingDirectHitFrame: z.literal(0),
        openingReactionDamageFrame: z.literal(1),
        scheduledResetOffsetFrames: z.literal(29),
        scheduledResetAbsoluteFrame: z.literal(30),
        boundaryDirectHitFrame: z.literal(29),
        boundaryReactionDamageFrame: z.literal(30),
        representedSameFrameOrder: z.literal("reset-before-attempt"),
        taskSequenceOrder: z.tuple([
          z.literal("opening-attempt"),
          z.literal("scheduled-reset"),
          z.literal("boundary-attempt"),
          z.literal("next-scheduled-reset"),
        ]),
      })
      .strict(),
    limitations: z
      .object({
        simulatorHitBeforeResetTopologyCaptured: z.literal(true),
        simulatorResetBeforeHitTopologyCaptured: z.literal(true),
        hitBeforeResetCoverage: z.literal(
          "recursive-shatter-simulator-test-not-this-golden-fixture",
        ),
        note: z.string().min(1),
      })
      .strict(),
    scenarios: z
      .object({
        superconductReactionA: scenarioSchema,
        overloadReactionB: scenarioSchema,
      })
      .strict(),
  })
  .strict();

function makeRepeatedReactionConfig(reaction: ReactionVector): SimConfig {
  const base = withV152CompatibilityPolicies(makeConfig());
  const auraElement: Element = reaction === "superconduct" ? "cryo" : "pyro";
  const identity = `synthetic-reaction-damage-group-${reaction}-1.50`;

  return makeConfig({
    dataVersion: identity,
    randomSeed: identity,
    meta: {
      name: `V1.50 ${reaction} ReactionA/B reset boundary`,
      version: "1.50.0",
      verificationStatus: "provisional",
    },
    duration: 1,
    cycleLength: 1,
    enemy: {
      level: 90,
      resistance: 0.1,
      defReduction: 0,
      targets: [
        {
          id: "enemy-0",
          name: "Reaction target",
          position: { x: 0, y: 0 },
          initialAura: [{ element: auraElement, gaugeUnits: 8 }],
        },
      ],
    },
    characters: [
      {
        ...base.characters[0]!,
        id: "electro",
        name: "Electro trigger",
        element: "electro",
        level: 90,
        stats: {
          ...neutralStats,
          baseAtk: 1000,
          em: 100,
        },
      },
    ],
    rotation: [],
    reactionEngine: { mode: "aura-v2" },
    reactionDamageGroupModel: {
      mode: "fixed-gcsim-reaction-damage-task-order-v2",
      policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID,
    },
    timeline: {
      mode: "legal-frame-v1",
      fps: 60,
      legalityMode: "strict",
      initialActiveCharacterId: "electro",
      swapFrames: 1,
      abilities: [
        {
          id: `${reaction}-sequence`,
          actorId: "electro",
          name: `${reaction} reset vector`,
          kind: "skill",
          cancelFrame: 29,
          animationEndFrame: 29,
          cooldownFrames: 0,
          hits: [0, 29].map((frame, index) => ({
            id: `${reaction}-trigger-${index}`,
            frame,
            scaling: 1,
            element: "electro" as const,
            targeting: {
              targetId: "enemy-0",
              outcome: "landed" as const,
            },
            application: {
              gaugeUnits: 0.1,
              icd: { mode: "no-icd-v1" as const },
            },
          })),
        },
      ],
      commands: [
        {
          type: "skill",
          actorId: "electro",
          abilityId: `${reaction}-sequence`,
          atFrame: 0,
        },
      ],
    },
  });
}

type BoundaryCase = "superconductReactionA" | "overloadReactionB";
const HISTORICAL_URL = new URL("./fixtures/historical-reaction-damage-group-reset-boundary-v153-84ff5cd.json",import.meta.url);
function readHistoricalBoundary(): Record<BoundaryCase,SimulationResult> {
  const bytes=readFileSync(HISTORICAL_URL);expect(byteSha256(bytes)).toBe("2c4316a1ed23ca861938598d51f6ed32616ce76eed0985b5daf5c8a87a8b35fb");
  const archive=JSON.parse(bytes.toString("utf8")) as {fixtureVersion:string;source:{commit:string;tree:string};cases:Array<{caseId:BoundaryCase;sourceWireSha256:string;sourceWireText:string}>};
  expect(archive).toMatchObject({fixtureVersion:"historical-reaction-damage-group-reset-boundary-v153-84ff5cd-v1",source:{commit:"84ff5cd3efb70ac91d1a4501e6f16ada1d07a2e5",tree:"72bd69a8c54a3e115685c7ee52f5862064c70f55"}});
  expect(archive.cases.map(row=>row.caseId)).toEqual(["superconductReactionA","overloadReactionB"]);expect(archive.cases.map(row=>row.sourceWireSha256)).toEqual(["34af928e17540a6f32dd1da6cc70720261baf8bd9c1257907d95006812dd32aa","7503b353c86b75ab657944f76b0297c701a1d48cd0e8e042f111a7279e9b6474"]);
  const results={} as Record<BoundaryCase,SimulationResult>;for(const row of archive.cases){expect(byteSha256(Buffer.from(row.sourceWireText))).toBe(row.sourceWireSha256);results[row.caseId]=JSON.parse(row.sourceWireText) as SimulationResult;expect(results[row.caseId].resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");expect(results[row.caseId].runManifest.resolvedRuntimeOptions).not.toHaveProperty("flatStatBuffSemantics");}return results;
}
function runCurrentScenario(reaction:ReactionVector):SimulationResult {return simulate(makeRepeatedReactionConfig(reaction),{critMode:"noCrit",randomSeed:`synthetic-reaction-damage-group-${reaction}-1.50`});}
function runCurrentScenarios():Record<BoundaryCase,SimulationResult>{return {superconductReactionA:runCurrentScenario("superconduct"),overloadReactionB:runCurrentScenario("overload")};}
function historicalProjection(result:SimulationResult):SimulationResultForV150{return projectSimulationResultV151ToV150(projectSimulationResultV152ToV151(projectSimulationResultV153ToV152(result)));}
function runScenarios(){const historical=readHistoricalBoundary();return {superconductReactionA:historicalProjection(historical.superconductReactionA),overloadReactionB:historicalProjection(historical.overloadReactionB)};}
/** Closed expected-only adaptation:8 identity fields,4 direct Aura substeps,
 * and12 newly explicit direct-hit coordinates; no queue or backlink renaming. */
function expectedCurrentScenarios():Record<BoundaryCase,SimulationResult>{
  const results=readHistoricalBoundary();for(const [key,reproducibilityKey] of [["superconductReactionA","gdl-v2-fnv1a32-01745e17"],["overloadReactionB","gdl-v2-fnv1a32-a20b3459"]] as const){
    const r=results[key];r.resolvedRuntimeOptions.flatStatBuffSemantics="canonical-v1";r.runManifest.resolvedRuntimeOptions.flatStatBuffSemantics="canonical-v1";r.reproducibilityKey=reproducibilityKey;r.runManifest.reproducibilityKey=reproducibilityKey;
    for(const pointId of [1,2]){const point=r.targetStateTimeline.points[pointId]!;expect(point).toMatchObject({cause:"direct-hit-application",intraEventSequence:0});point.intraEventSequence=1;}
    for(const [hitId,sequence] of [[0,1],[2,2]]){const hit=r.hitResolutionLog[hitId!]!;for(const field of ["eventPriority","eventSequence","intraEventSequence"])expect(hit).not.toHaveProperty(field);Object.assign(hit,{eventPriority:3,eventSequence:sequence,intraEventSequence:0});}
  }return results;
}

function scenarioFixture(
  result: SimulationResultForV150,
  reaction: ReactionVector,
) {
  const reactionDamageLog = result.reactionDamageLog.filter(
    (entry) => entry.reaction === reaction,
  );
  const damageEventIds = new Set(
    reactionDamageLog.flatMap((entry) => entry.damageEventIds),
  );
  const hitResolutionLogIds = new Set(
    reactionDamageLog.flatMap((entry) => entry.hitResolutionLogIds),
  );
  const reactionDamageEvents = result.damageEvents.filter((entry) =>
    damageEventIds.has(entry.id),
  );
  const reactionHitResolutionLog = result.hitResolutionLog.filter((entry) =>
    hitResolutionLogIds.has(entry.id),
  );

  return {
    identity: {
      schemaVersion: result.schemaVersion,
      engineVersion: result.engineVersion,
      dataVersion: result.dataVersion,
      randomSeed: result.randomSeed,
      configHash: result.runManifest.configHash,
      reproducibilityKey: result.reproducibilityKey,
      selectedModel: result.config.reactionDamageGroupModel,
      runManifest: result.runManifest,
    },
    totals: {
      totalDamage: result.totalDamage,
      dps: result.dps,
      displayDamage: result.damageEvents.reduce(
        (sum, entry) => sum + entry.displayDamage,
        0,
      ),
      damageEventCount: result.damageEvents.length,
      hitResolutionCount: result.hitResolutionLog.length,
      reactionDamageCount: result.reactionDamageLog.length,
      reactionDamageEventCount: reactionDamageEvents.length,
      reactionDamageDisplayDamage: reactionDamageEvents.reduce(
        (sum, entry) => sum + entry.displayDamage,
        0,
      ),
      resetTaskCount: result.reactionDamageGroupResetLog.length,
    },
    reactionDamageLog,
    reactionDamageEvents,
    reactionHitResolutionLog,
    resetTasks: result.reactionDamageGroupResetLog,
    canonicalSha256: {
      config: canonicalSha256(result.config),
      runManifest: canonicalSha256(result.runManifest),
      damageEvents: canonicalSha256(result.damageEvents),
      hitResolutionLog: canonicalSha256(result.hitResolutionLog),
      reactionDamageLog: canonicalSha256(result.reactionDamageLog),
      reactionDamageGroupResetLog: canonicalSha256(
        result.reactionDamageGroupResetLog,
      ),
      targetStateTimeline: canonicalSha256(result.targetStateTimeline),
    },
  };
}

function makeFixture(results: ReturnType<typeof runScenarios>) {
  return {
    fixtureVersion: "1.0.0" as const,
    description:
      "Reviewed current-wire V1.50 ReactionA/B simulator Golden for the V2 F+29 scheduled-reset boundary, covering Superconduct and Overload.",
    provenance: {
      sourceProject: "genshinsim/gcsim" as const,
      sourceRevision: "b4ae769d7c1c1bce68fce5faf0b460c5b5b7f541" as const,
      capturedAt: "2026-08-02" as const,
      verificationStatus: "reviewed-provisional" as const,
      note: "The task ordering is pinned to a source-derived provisional policy. This fixture is not official server truth and does not claim complete gcsim scheduler, Aura, ICD, character, particle, or action-frame parity.",
      officialServerTruth: false as const,
      completeGcsimParity: false as const,
    },
    currentIdentity: {
      schemaVersion: REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
      engineVersion: REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
      runManifestVersion:
        REACTION_DAMAGE_GROUP_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
    },
    selectedPolicyRoot: GCSIM_REACTION_DAMAGE_GROUP_POLICY_ROOT,
    expectedBoundary: {
      openingDirectHitFrame: 0 as const,
      openingReactionDamageFrame: 1 as const,
      scheduledResetOffsetFrames: 29 as const,
      scheduledResetAbsoluteFrame: 30 as const,
      boundaryDirectHitFrame: 29 as const,
      boundaryReactionDamageFrame: 30 as const,
      representedSameFrameOrder: "reset-before-attempt" as const,
      taskSequenceOrder: [
        "opening-attempt",
        "scheduled-reset",
        "boundary-attempt",
        "next-scheduled-reset",
      ] as const,
    },
    limitations: {
      simulatorHitBeforeResetTopologyCaptured: true as const,
      simulatorResetBeforeHitTopologyCaptured: true as const,
      hitBeforeResetCoverage:
        "recursive-shatter-simulator-test-not-this-golden-fixture" as const,
      note: "This reviewed Golden captures reset-before-attempt for Superconduct and Overload. The opposite hit-before-reset topology is captured separately by the recursive Shatter simulator regression, and both FIFO orders are also covered by ReactionDamageGroupTaskEngine unit tests.",
    },
    scenarios: {
      superconductReactionA: scenarioFixture(
        results.superconductReactionA,
        "superconduct",
      ),
      overloadReactionB: scenarioFixture(results.overloadReactionB, "overload"),
    },
  };
}

function expectFrozenV150Trusted(result: SimulationResultForV150): void {
  expect(simulationResultV150Schema.parse(result)).toEqual(result);
  expect(assertTrustedSimulationResultV150(result)).toBe(result);
  expect(result.schemaVersion).toBe(
    REACTION_DAMAGE_GROUP_RESET_BOUNDARY_SCHEMA_VERSION,
  );
  expect(result.engineVersion).toBe(
    REACTION_DAMAGE_GROUP_RESET_BOUNDARY_ENGINE_VERSION,
  );
  expect(result.runManifest.version).toBe(
    REACTION_DAMAGE_GROUP_RESET_BOUNDARY_RUN_MANIFEST_VERSION,
  );
  expect(result.config.reactionDamageGroupModel).toEqual({
    mode: "fixed-gcsim-reaction-damage-task-order-v2",
    policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID,
  });
  expect(result.runManifest.reactionDamageGroupRoot).toEqual(
    GCSIM_REACTION_DAMAGE_GROUP_POLICY_ROOT,
  );
}

function expectBoundarySemantics(
  result: SimulationResultForV150 | SimulationResult,
  reaction: ReactionVector,
  icdGroup: "reaction-a" | "reaction-b",
  icdTag: "ICDTagSuperconductDamage" | "ICDTagOverloadDamage",
): void {
  const rows = result.reactionDamageLog.filter(
    (entry) => entry.reaction === reaction,
  );
  expect(rows).toHaveLength(2);
  expect(
    rows.map((entry) => ({
      triggerFrame: entry.triggerFrame,
      damageFrame: entry.damageFrame,
      damageEventIds: entry.damageEventIds,
      hitResolutionLogIds: entry.hitResolutionLogIds,
    })),
  ).toEqual([
    {
      triggerFrame: 0,
      damageFrame: 1,
      damageEventIds: [1],
      hitResolutionLogIds: [1],
    },
    {
      triggerFrame: 29,
      damageFrame: 30,
      damageEventIds: [3],
      hitResolutionLogIds: [3],
    },
  ]);

  const decisions = rows.flatMap((entry) => entry.damageGroupDecisions);
  expect(
    decisions.map((decision) => ({
      frame: decision.frame,
      policyId: decision.policyId,
      icdGroup: decision.icdGroup,
      icdTag: decision.icdTag,
      generation: decision.windowGeneration,
      windowStartFrame: decision.windowStartFrame,
      resetAtFrame: decision.resetAtFrame,
      attemptSequence: decision.damageGroupTaskSequence,
      resetTaskLogId: decision.resetTaskLogId,
      resetTaskSequence: decision.resetTaskSequence,
      hitIndex: decision.hitIndex,
      allowed: decision.damageAllowed,
    })),
  ).toEqual([
    {
      frame: 1,
      policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID,
      icdGroup,
      icdTag,
      generation: 0,
      windowStartFrame: 1,
      resetAtFrame: 30,
      attemptSequence: 3,
      resetTaskLogId: 0,
      resetTaskSequence: 4,
      hitIndex: 0,
      allowed: true,
    },
    {
      frame: 30,
      policyId: GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID,
      icdGroup,
      icdTag,
      generation: 1,
      windowStartFrame: 30,
      resetAtFrame: 59,
      attemptSequence: 5,
      resetTaskLogId: 1,
      resetTaskSequence: 6,
      hitIndex: 0,
      allowed: true,
    },
  ]);

  expect(result.reactionDamageGroupResetLog).toEqual([
    expect.objectContaining({
      id: 0,
      reaction,
      icdGroup,
      icdTag,
      windowGeneration: 0,
      windowStartFrame: 1,
      resetAtFrame: 30,
      taskSequence: 4,
      executed: true,
      executionFrame: 30,
      executedBeforeAttemptTaskSequence: 5,
      stale: false,
      invalidatedReason: null,
    }),
    expect.objectContaining({
      id: 1,
      reaction,
      icdGroup,
      icdTag,
      windowGeneration: 1,
      windowStartFrame: 30,
      resetAtFrame: 59,
      taskSequence: 6,
      executed: true,
      executionFrame: 59,
      executedBeforeAttemptTaskSequence: null,
      stale: false,
      invalidatedReason: null,
    }),
  ]);
  expect(decisions[0]!.damageGroupTaskSequence).toBeLessThan(
    result.reactionDamageGroupResetLog[0]!.taskSequence,
  );
  expect(result.reactionDamageGroupResetLog[0]!.taskSequence).toBeLessThan(
    decisions[1]!.damageGroupTaskSequence,
  );
  expect(decisions[1]!.damageGroupTaskSequence).toBeLessThan(
    result.reactionDamageGroupResetLog[1]!.taskSequence,
  );

  for (const [index, row] of rows.entries()) {
    const decision = decisions[index]!;
    if (
      decision.resetTaskLogId === null ||
      decision.resetTaskSequence === null
    ) {
      throw new Error("V2 Golden decisions require reset-task backlinks.");
    }
    const reset = result.reactionDamageGroupResetLog[decision.resetTaskLogId]!;
    const damage = result.damageEvents[row.damageEventIds[0]!]!;
    const hit = result.hitResolutionLog[row.hitResolutionLogIds[0]!]!;
    expect(reset.id).toBe(decision.resetTaskLogId);
    expect(reset.taskSequence).toBe(decision.resetTaskSequence);
    expect(reset.scopeKey).toBe(decision.scopeKey);
    expect(damage.parentDamageEventId).toBe(row.triggerDamageEventId);
    expect(damage.targetResolutionId).toBe(hit.id);
    expect(damage.eventSequence).toBe(decision.damageGroupTaskSequence);
    expect(damage.frame).toBe(row.damageFrame);
    expect(hit.reactionDamageLogId).toBe(row.id);
    expect(hit.damageEventId).toBe(damage.id);
    expect(hit.eventSequence).toBe(decision.damageGroupTaskSequence);
    expect(hit.frame).toBe(row.damageFrame);
  }
}

const candidateEnabled =
  /^[0-9a-f]{64}$/.test(REVIEWED_FIXTURE_SHA256) ||
  process.env[PREVIEW_FLAG] === "1" ||
  process.env[UPDATE_FLAG] === "1";

describe("Reaction damage-group reset boundary 1.50 Golden review gate", () => {
  it("keeps reviewed SHA and fixture presence coherent", () => {
    const exists = existsSync(fileURLToPath(FIXTURE_URL));
    if (!/^[0-9a-f]{64}$/.test(REVIEWED_FIXTURE_SHA256)) {
      expect(REVIEWED_FIXTURE_SHA256).toBe(
        "PENDING-V150-REACTION-DAMAGE-GROUP-RESET-BOUNDARY-GOLDEN-REVIEW",
      );
      expect(exists).toBe(false);
      return;
    }
    expect(exists).toBe(true);
    expect(byteSha256(readFileSync(FIXTURE_URL))).toBe(REVIEWED_FIXTURE_SHA256);
  });

  it("keeps every historical reviewed fixture byte-for-byte frozen", () => {
    for (const [filename, expectedSha256] of Object.entries(
      HISTORICAL_REVIEWED_GOLDEN_SHA256,
    )) {
      const fixtureUrl = new URL(`../fixtures/${filename}`, import.meta.url);
      expect(byteSha256(readFileSync(fixtureUrl)), filename).toBe(
        expectedSha256,
      );
    }
  });
});

describe("Reaction damage-group reset boundary 1.50 Golden", () => {
  it.skipIf(!candidateEnabled)(
    "matches the reviewed V2 Superconduct/Overload 29-frame-offset reset vector",
    () => {
      const results = runScenarios();
      const repeated = runScenarios();
      expect(repeated).toEqual(results);

      expectFrozenV150Trusted(results.superconductReactionA);
      expectFrozenV150Trusted(results.overloadReactionB);
      expectBoundarySemantics(
        results.superconductReactionA,
        "superconduct",
        "reaction-a",
        "ICDTagSuperconductDamage",
      );
      expectBoundarySemantics(
        results.overloadReactionB,
        "overload",
        "reaction-b",
        "ICDTagOverloadDamage",
      );

      const generated = fixtureSchema.parse(makeFixture(results));
      const frozen = loadPreviewOrCreateReviewedGolden({
        generated,
        fixtureUrl: FIXTURE_URL,
        previewFlag: PREVIEW_FLAG,
        updateFlag: UPDATE_FLAG,
        reviewedFixtureSha256: REVIEWED_FIXTURE_SHA256,
        previewSummary: (candidate) => ({
          fixture: "reaction-damage-group-reset-boundary-1.50.golden.json",
          schemaVersion: candidate.currentIdentity.schemaVersion,
          engineVersion: candidate.currentIdentity.engineVersion,
          runManifestVersion: candidate.currentIdentity.runManifestVersion,
          policyContentHash: candidate.selectedPolicyRoot.contentHash,
          superconductConfigHash:
            candidate.scenarios.superconductReactionA.identity.configHash,
          superconductReproducibilityKey:
            candidate.scenarios.superconductReactionA.identity
              .reproducibilityKey,
          overloadConfigHash:
            candidate.scenarios.overloadReactionB.identity.configHash,
          overloadReproducibilityKey:
            candidate.scenarios.overloadReactionB.identity.reproducibilityKey,
          superconductDecisionFrames:
            candidate.scenarios.superconductReactionA.reactionDamageLog.map(
              (row) => row.damageGroupDecisions[0]!.frame,
            ),
          overloadDecisionFrames:
            candidate.scenarios.overloadReactionB.reactionDamageLog.map(
              (row) => row.damageGroupDecisions[0]!.frame,
            ),
          representedSameFrameOrder:
            candidate.expectedBoundary.representedSameFrameOrder,
          hitBeforeResetSimulatorTopologyCaptured:
            candidate.limitations.simulatorHitBeforeResetTopologyCaptured,
        }),
      });
      expect(fixtureSchema.parse(frozen)).toEqual(generated);
      expect(frozen).toEqual(generated);
    },
  );
});

describe("current reaction-group reset-boundary contracts",()=>{
  it("preserves full current wires, source FIFO boundaries and independent damage",()=>{
    const actual=runCurrentScenarios();expect(runCurrentScenarios()).toStrictEqual(actual);expect(actual).toStrictEqual(expectedCurrentScenarios());
    for(const [key,reaction,multiplier,group,tag] of [["superconductReactionA","superconduct",1.5,"reaction-a","ICDTagSuperconductDamage"],["overloadReactionB","overload",2.75,"reaction-b","ICDTagOverloadDamage"]] as const){
      const r=actual[key];expect(simulationResultSchema.parse(r)).toEqual(r);expect(assertTrustedSimulationResult(r)).toBe(r);expectBoundarySemantics(r,reaction,group,tag);
      expect(r.config.reactionDamageGroupModel).toEqual({mode:"fixed-gcsim-reaction-damage-task-order-v2",policyId:GCSIM_REACTION_DAMAGE_GROUP_POLICY_ID});expect(r.runManifest.reactionDamageGroupRoot).toEqual(GCSIM_REACTION_DAMAGE_GROUP_POLICY_ROOT);
      // Pinned level90 curve1446.8535 and classic multipliers1.5/2.75; actualEM100.
      const direct=1000*.5*.9,damage=1446.8535*multiplier*(1+16*100/2100)*.9;
      expect(r.damageEvents.map(row=>row.frame)).toEqual([0,1,29,30]);expect(r.damageEvents.map(row=>row.targetId)).toEqual(Array(4).fill("enemy-0"));r.damageEvents.forEach((row,index)=>expect(row.finalDamage).toBeCloseTo(index%2===0?direct:damage,10));expect(r.totalDamage).toBeCloseTo(2*(direct+damage),9);
      for(const [pointId,hitId,frame,sequence,damageId] of [[1,0,0,1,0],[2,2,29,2,2]]){expect(r.targetStateTimeline.points[pointId!]!).toMatchObject({cause:"direct-hit-application",frame,eventPriority:3,eventSequence:sequence,intraEventSequence:1,primaryDamageEventId:damageId});expect(r.hitResolutionLog[hitId!]!).toMatchObject({frame,eventPriority:3,eventSequence:sequence,intraEventSequence:0,damageEventId:damageId});}
    }
  });
  it("preserves strict canonical refusal/nonmutation and exact authentic frozen fixture",()=>{
    const current=runCurrentScenarios(),before=structuredClone(current);for(const r of Object.values(current))expect(()=>historicalProjection(r)).toThrow(/flatStatBuffSemantics/);expect(current).toStrictEqual(before);expect(fixtureSchema.parse(makeFixture(runScenarios()))).toStrictEqual(JSON.parse(readFileSync(FIXTURE_URL,"utf8")));
  });
  it.each(["superconduct","overload"] as const)("%s owns allocation chronology in the real event-step witness, not historical parsing",reaction=>{
    const key=reaction==="superconduct"?"superconductReactionA":"overloadReactionB",original=runCurrentScenario(reaction),forged=structuredClone(original);forged.targetStateTimeline.points[1]!.intraEventSequence=0;
    expect(simulationResultSchema.parse(forged)).toEqual(forged);expect(()=>expect(forged).toStrictEqual(expectedCurrentScenarios()[key])).toThrow();
    const captured=simulateEventStepResult(makeRepeatedReactionConfig(reaction),{critMode:"noCrit",randomSeed:`synthetic-reaction-damage-group-${reaction}-1.50`});const before=structuredClone(captured.wire),parsed=parseEventStepResult(JSON.parse(JSON.stringify(captured.wire)));expect(parsed.result.damageEvents).toStrictEqual(original.damageEvents);expect(parsed.result.targetStateTimeline).toStrictEqual(original.targetStateTimeline);const bad=structuredClone(captured.wire);bad.result.targetStateTimeline.points[1]!.intraEventSequence=0;expect(()=>parseEventStepResult(JSON.parse(JSON.stringify(bad)))).toThrow();expect(captured.wire).toStrictEqual(before);
  });
  for(const reaction of ["superconduct","overload"] as const)it.each(["reset-sequence","reset-before-attempt","damage-parent","hit-reaction"] as const)(`${reaction}: public ingress rejects forged %s`,mutation=>{
    const original=runCurrentScenario(reaction);expect(simulationResultSchema.parse(JSON.parse(JSON.stringify(original)))).toEqual(original);const forged=structuredClone(original);
    if(mutation==="reset-sequence")forged.reactionDamageLog[0]!.damageGroupDecisions[0]!.resetTaskSequence=999;
    if(mutation==="reset-before-attempt")forged.reactionDamageGroupResetLog[0]!.executedBeforeAttemptTaskSequence=3;
    if(mutation==="damage-parent")forged.damageEvents[1]!.parentDamageEventId=2;
    if(mutation==="hit-reaction")forged.hitResolutionLog[1]!.reactionDamageLogId=1;
    expect(simulationResultSchema.safeParse(JSON.parse(JSON.stringify(forged))).success).toBe(false);expect(()=>expect(forged).toStrictEqual(expectedCurrentScenarios()[reaction==="superconduct"?"superconductReactionA":"overloadReactionB"])).toThrow();expect(simulationResultSchema.parse(original)).toEqual(original);
  });
});
